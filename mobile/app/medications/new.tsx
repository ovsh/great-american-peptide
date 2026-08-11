import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input } from '@/components/Input';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { Pill } from '@/components/Pill';
import { MarkChip, estimateMark } from '@/components/EstimateMark';
import { MedVialIcon } from '@/components/MedVialIcon';

import {
  EVIDENCE_LABELS,
  getPreset,
  pickerEntries,
  type PresetEntry,
  type FrequencyKind,
  type Route,
  type Unit,
} from '@/domain/peptides';
import { WEEKDAY_OPTIONS, isWeekday, type Weekday } from '@/domain/scheduling';
import { ProLock } from '@/components/ProLock';
import {
  countActiveMedications,
  FREE_MEDICATION_LIMIT,
  getMedication,
  nextColorIndex,
  type NewMedication,
} from '@/repositories/medications';
import { createMedicationAndRefresh, updateMedicationAndRefresh } from '@/services/medicationMutations';
import { useAppStore } from '@/stores/app';
import { isProNow, useIsPro } from '@/stores/entitlement';
import { safeBack } from '@/utils/nav';
import { twiceWeeklyScheduleNote } from '@/utils/schedule';
import { colors, spacing, radius } from '@/theme';

type EditableFrequency = Exclude<FrequencyKind, 'custom'>;

const FREQS: { id: EditableFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'twice_weekly', label: '2× / week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'every_n_days', label: 'Every N days' },
];

export default function AddMedicationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const editingId = params.medicationId;

  const [step, setStep] = useState<'pick' | 'config'>('pick');
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState<Unit>('mg');
  const [route, setRoute] = useState<Route>('sc');
  const [freq, setFreq] = useState<EditableFrequency>('weekly');
  const [freqValue, setFreqValue] = useState('');
  const [weekday, setWeekday] = useState<Weekday>(currentWeekday());
  const [halfLife, setHalfLife] = useState('');
  const [tmax, setTmax] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pro = useIsPro();
  // The route is reachable directly, so the screen checks the limit itself.
  const [atFreeLimit, setAtFreeLimit] = useState(false);
  const selectedPreset = presetId ? getPreset(presetId) : undefined;
  // The catalog does not change while the screen is open, and the list is the
  // same rows on every keystroke in the second step.
  const entries = useMemo(() => pickerEntries(), []);

  useEffect(() => {
    if (editingId || pro) { setAtFreeLimit(false); return; }
    countActiveMedications()
      .then((count) => setAtFreeLimit(count >= FREE_MEDICATION_LIMIT))
      .catch(() => {});
  }, [editingId, pro]);

  useEffect(() => {
    if (!editingId) return;
    getMedication(editingId)
      .then((medication) => {
        if (!medication) {
          Alert.alert('Poke could not find that medication');
          safeBack('/medications');
          return;
        }
        setPresetId(medication.preset_id);
        setName(medication.name);
        setDose(String(medication.default_dose));
        setUnit(medication.default_unit);
        setRoute(medication.default_route);
        setFreq(medication.frequency_kind === 'custom' ? 'daily' : medication.frequency_kind);
        setFreqValue(medication.frequency_kind === 'every_n_days' && medication.frequency_value !== null
          ? String(medication.frequency_value)
          : '');
        setWeekday(isWeekday(medication.frequency_value)
          ? medication.frequency_value
          : weekdayFromTimestamp(medication.created_at));
        setHalfLife(medication.half_life_hours === null ? '' : String(medication.half_life_hours));
        setTmax(medication.tmax_hours === null ? '' : String(medication.tmax_hours));
        setStep('config');
      })
      .catch((error: unknown) => {
        Alert.alert('Poke could not load your medication', error instanceof Error ? error.message : 'Try again.');
      });
  }, [editingId]);

  // A preset fills in what a published source says and nothing else. The dose
  // field stays empty: the user types the dose, Poke does not offer one. The
  // onboarding schedule screen works the same way.
  //
  // A brand row and its molecule row share one preset, so the science is the
  // same either way and only the name follows the row the user pressed.
  const pickPreset = (entry: PresetEntry) => {
    const p = entry.preset;
    setPresetId(p.id);
    setName(entry.name);
    setDose('');
    setUnit(p.unit);
    setRoute(p.defaultRoute);
    setFreq(editableFrequency(p.defaultFrequency.kind));
    setFreqValue(p.defaultFrequency.value ? String(p.defaultFrequency.value) : '');
    setWeekday(currentWeekday());
    // An unsourced preset carries no half-life and no Tmax. `String(null)` wrote
    // the word "null" into the field and NaN into the database.
    setHalfLife(p.halfLifeHours === null ? '' : String(p.halfLifeHours));
    setTmax(p.tmaxHours === null ? '' : String(p.tmaxHours));
    setStep('config');
  };

  const pickCustom = () => {
    setPresetId(null);
    setName('');
    setDose('');
    setUnit('mg');
    setRoute('sc');
    setFreq('weekly');
    setFreqValue('');
    setWeekday(currentWeekday());
    setHalfLife('');
    setTmax('');
    setStep('config');
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a medication name'); return; }
    const d = parseFloat(dose);
    if (!Number.isFinite(d) || d <= 0) { Alert.alert('Enter a dose above zero'); return; }
    // An empty box used to fall through `parseInt('') || 1` and save a daily
    // schedule, with a daily reminder, that the user never chose. Poke asks for
    // the interval instead.
    const interval = parseInt(freqValue, 10);
    if (freq === 'every_n_days' && (!Number.isFinite(interval) || interval < 1)) {
      Alert.alert('Enter a number of days above zero');
      return;
    }
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        presetId,
        defaultDose: d,
        defaultUnit: unit,
        defaultRoute: route,
        frequencyKind: freq,
        frequencyValue: freq === 'every_n_days' ? interval : freq === 'daily' ? null : weekday,
        halfLifeHours: optionalHours(halfLife),
        tmaxHours: optionalHours(tmax),
      } satisfies Omit<NewMedication, 'colorIndex'>;
      if (editingId) {
        await updateMedicationAndRefresh(editingId, input);
      } else {
        // Last check before the write: the entitlement can change while the
        // form is open.
        if (!isProNow() && (await countActiveMedications()) >= FREE_MEDICATION_LIMIT) {
          setAtFreeLimit(true);
          setStep('pick');
          return;
        }
        const colorIndex = await nextColorIndex();
        await createMedicationAndRefresh({ ...input, colorIndex });
      }
      bumpVersion();
      safeBack('/medications');
    } catch (err: unknown) {
      Alert.alert('Poke could not save your medication', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title={editingId ? 'Edit medication' : step === 'pick' ? 'Add medication' : 'Set the details'}
        leading={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 'config' && !editingId ? 'Go back' : 'Close'}
            onPress={() => {
              if (editingId) safeBack('/medications');
              else if (step === 'config') setStep('pick');
              else safeBack('/medications');
            }}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <X size={22} color={colors.ink} />
          </Pressable>
        }
        trailing={step === 'config' && !atFreeLimit ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Save this medication" onPress={onSave} hitSlop={10} disabled={submitting}>
            <Check size={22} color={colors.accent} />
          </Pressable>
        ) : null}
      />

      {atFreeLimit ? (
        <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.lg }}>
          <ProLock
            title="Track a third medication"
            body="The free version keeps two medications. Pro tracks as many as you take, each with its own schedule, level and history."
          />
        </View>
      ) : step === 'pick' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
          <Section eyebrow="Presets" gap="sm">
            {entries.map((entry, idx) => (
              <PresetRow
                key={entry.id}
                entry={entry}
                colorIndex={idx}
                onPress={() => pickPreset(entry)}
              />
            ))}
          </Section>

          <View style={{ height: spacing.xl }} />

          <Section eyebrow="Custom">
            <Pressable onPress={pickCustom}>
              <Card padding="md">
                <Text variant="bodyStrong">Add a custom medication</Text>
                <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  You enter every detail yourself.
                </Text>
              </Card>
            </Pressable>
          </Section>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.hero, paddingHorizontal: spacing.screen }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Name">
            <Input value={name} onChangeText={setName} placeholder="Type the name" size="lg" />
          </Field>

          <Field label="Default dose">
            <View style={styles.doseRow}>
              <TextInput
                value={dose}
                onChangeText={setDose}
                keyboardType="decimal-pad"
                placeholder="Enter a number"
                placeholderTextColor={colors.inkSubtle}
                style={styles.doseInput}
                accessibilityLabel="Default dose"
              />
              <View style={{ width: spacing.md }} />
              <TimeRangeToggle
                options={['mg', 'mcg', 'iu'] as const}
                value={unit}
                onChange={setUnit}
              />
            </View>
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              Poke records the dose you enter. Poke does not propose a dose.
            </Text>
          </Field>

          <Field label="Route">
            <TimeRangeToggle
              options={['sc', 'im'] as const}
              value={route}
              onChange={setRoute}
            />
          </Field>

          <Field label="Frequency">
            <View style={styles.freqRow}>
              {FREQS.map((f) => {
                const active = f.id === freq;
                return (
                  <Pressable key={f.id} onPress={() => setFreq(f.id)} style={[styles.freqChip, active && styles.freqChipActive]}>
                    <Text variant="caption" color={active ? colors.inkInverse : colors.ink}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {freq === 'every_n_days' && (
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="small" color={colors.inkMuted}>Every</Text>
                <TextInput
                  value={freqValue}
                  onChangeText={setFreqValue}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.smallInput}
                  accessibilityLabel="Days between shots"
                />
                <Text variant="small" color={colors.inkMuted}>days</Text>
              </View>
            )}
          </Field>

          {freq === 'weekly' || freq === 'twice_weekly' ? (
            <Field label={freq === 'twice_weekly' ? 'First shot day' : 'Shot day'}>
              <View style={styles.weekdayRow}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = weekday === day.value;
                  return (
                    <Pressable
                      key={day.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setWeekday(day.value)}
                      style={[styles.weekdayChip, active && styles.freqChipActive]}
                    >
                      <Text variant="caption" color={active ? colors.inkInverse : colors.ink}>{day.shortLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Twice a week picks the second day for the user. Name it here,
                  before the save, rather than in a reminder they did not expect. */}
              {freq === 'twice_weekly' ? (
                <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                  {twiceWeeklyScheduleNote(weekday)}
                </Text>
              ) : null}
            </Field>
          ) : null}

          <Field label="Half-life in hours (optional)">
            <TextInput
              value={halfLife}
              onChangeText={setHalfLife}
              keyboardType="decimal-pad"
              placeholder="Enter a number"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
              accessibilityLabel="Half-life in hours"
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              Poke uses the half-life to draw the fall of the level curve.
            </Text>
            {/* The one number a preset fills in is a cited one, so the citation
                travels with it. */}
            {selectedPreset ? (
              <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
                {selectedPreset.evidence === 'unsourced'
                  ? `${selectedPreset.source} Poke draws no level curve without a half-life.`
                  : `Source: ${selectedPreset.source}`}
              </Text>
            ) : null}
          </Field>

          <Field label="Time to peak in hours (optional)" divider={false}>
            <TextInput
              value={tmax}
              onChangeText={setTmax}
              keyboardType="decimal-pad"
              placeholder="Enter a number"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
              accessibilityLabel="Time to peak in hours"
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              The time from the shot to the peak level. Most SC peptides peak in 0.5 to 2 hours.
              Weekly GLP-1 medications peak in 24 to 48 hours.
            </Text>
          </Field>

          <View style={{ height: spacing.xl }} />
          <Button onPress={onSave} disabled={submitting} trailingChevron>
            {submitting ? 'Saving' : editingId ? 'Save changes' : 'Save this medication'}
          </Button>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * One row of the catalogue: the name, what it is, and nothing that reads the
 * same on every row.
 *
 * A brand row names its molecule, which differs on every row and says what
 * Wegovy is. A molecule row has no such line. The evidence tier read the same on
 * almost every card, so it moved to the estimate sheet on Today, and only two
 * exceptions stayed on the row itself: a missing half-life, because it changes
 * what the app can draw, and the estimate mark, because an estimate is the one
 * tier whose number is not a published measurement.
 */
function PresetRow({
  entry,
  colorIndex,
  onPress,
}: {
  entry: PresetEntry;
  colorIndex: number;
  onPress: () => void;
}) {
  const mark = estimateMark(entry.preset.evidence);
  return (
    <Pressable onPress={onPress}>
      <Card padding="md" style={styles.presetCard}>
        <MedVialIcon size={36} colorIndex={colorIndex} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" style={styles.presetName}>{entry.name}</Text>
            {mark ? <MarkChip label={mark} /> : null}
          </View>
          {entry.moleculeName ? (
            <Text variant="caption" color={colors.inkMuted}>
              {entry.moleculeName}
            </Text>
          ) : null}
          {entry.preset.evidence === 'unsourced' ? (
            <Text variant="caption" color={colors.inkMuted}>
              {EVIDENCE_LABELS.unsourced}
            </Text>
          ) : null}
        </View>
        <Pill tone="neutral">{entry.preset.category}</Pill>
      </Card>
    </Pressable>
  );
}

function currentWeekday(): Weekday {
  return weekdayFromTimestamp(Date.now());
}

function weekdayFromTimestamp(timestamp: number): Weekday {
  const weekday = new Date(timestamp).getDay();
  return isWeekday(weekday) ? weekday : 1;
}

function editableFrequency(frequency: FrequencyKind): EditableFrequency {
  return frequency === 'custom' ? 'daily' : frequency;
}

// Half-life and Tmax are optional, so an empty or unreadable field is null and
// never NaN. A NaN half-life reaches SQLite and the level curve reads it back.
function optionalHours(text: string): number | null {
  const value = parseFloat(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  presetName: {
    flexShrink: 1,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doseInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: colors.ink,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  smallInput: {
    width: 60,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    textAlign: 'center',
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekdayChip: {
    minWidth: 40,
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  freqChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  freqChipActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
});
