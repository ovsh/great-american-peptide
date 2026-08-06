import { useEffect, useState } from 'react';
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
import { MedVialIcon } from '@/components/MedVialIcon';

import { peptidePresets, type PeptidePreset, type FrequencyKind, type Route, type Unit } from '@/domain/peptides';
import { WEEKDAY_OPTIONS, isWeekday, type Weekday } from '@/domain/scheduling';
import { getMedication, nextColorIndex, type NewMedication } from '@/repositories/medications';
import { createMedicationAndRefresh, updateMedicationAndRefresh } from '@/services/medicationMutations';
import { useAppStore } from '@/stores/app';
import { safeBack } from '@/utils/nav';
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

  useEffect(() => {
    if (!editingId) return;
    getMedication(editingId)
      .then((medication) => {
        if (!medication) {
          Alert.alert('Medication not found');
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
        Alert.alert('Could not load medication', error instanceof Error ? error.message : 'Try again.');
      });
  }, [editingId]);

  const pickPreset = (p: PeptidePreset) => {
    setPresetId(p.id);
    setName(p.name);
    setDose(String(p.defaultDose));
    setUnit(p.unit);
    setRoute(p.defaultRoute);
    setFreq(editableFrequency(p.defaultFrequency.kind));
    setFreqValue(p.defaultFrequency.value ? String(p.defaultFrequency.value) : '');
    setWeekday(currentWeekday());
    setHalfLife(String(p.halfLifeHours));
    setTmax(String(p.tmaxHours));
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
    if (!name.trim()) { Alert.alert('Name is required'); return; }
    const d = parseFloat(dose);
    if (!Number.isFinite(d) || d <= 0) { Alert.alert('Enter a valid dose'); return; }
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        presetId,
        defaultDose: d,
        defaultUnit: unit,
        defaultRoute: route,
        frequencyKind: freq,
        frequencyValue: freq === 'every_n_days' ? parseInt(freqValue, 10) || 1 : freq === 'daily' ? null : weekday,
        halfLifeHours: halfLife ? parseFloat(halfLife) : null,
        tmaxHours: tmax ? parseFloat(tmax) : null,
      } satisfies Omit<NewMedication, 'colorIndex'>;
      if (editingId) {
        await updateMedicationAndRefresh(editingId, input);
      } else {
        const colorIndex = await nextColorIndex();
        await createMedicationAndRefresh({ ...input, colorIndex });
      }
      bumpVersion();
      safeBack('/medications');
    } catch (err: unknown) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
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
        title={editingId ? 'Edit medication' : step === 'pick' ? 'Add Medication' : 'Configure'}
        leading={
          <Pressable
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
        trailing={step === 'config' ? (
          <Pressable onPress={onSave} hitSlop={10} disabled={submitting}>
            <Check size={22} color={colors.accent} />
          </Pressable>
        ) : null}
      />

      {step === 'pick' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero }}>
          <Section eyebrow="Preset Library" gap="sm">
            {peptidePresets.map((p, idx) => (
              <Pressable key={p.id} onPress={() => pickPreset(p)}>
                <Card padding="md" style={styles.presetCard}>
                  <MedVialIcon size={36} colorIndex={idx} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{p.name}</Text>
                    <Text variant="caption" color={colors.inkMuted}>
                      {p.defaultDose} {p.unit} · {p.defaultRoute.toUpperCase()} · t½ {p.halfLifeHours}h
                    </Text>
                  </View>
                  <Pill tone="neutral">{p.category}</Pill>
                </Card>
              </Pressable>
            ))}
          </Section>

          <View style={{ height: spacing.xl }} />

          <Section eyebrow="Custom">
            <Pressable onPress={pickCustom}>
              <Card padding="md">
                <Text variant="bodyStrong">Add custom peptide</Text>
                <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                  Set name, dose, route, and schedule yourself.
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
            <Input value={name} onChangeText={setName} placeholder="e.g. Tirzepatide" size="lg" />
          </Field>

          <Field label="Default dose">
            <View style={styles.doseRow}>
              <TextInput
                value={dose}
                onChangeText={setDose}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={colors.inkSubtle}
                style={styles.doseInput}
              />
              <View style={{ width: spacing.md }} />
              <TimeRangeToggle
                options={['mg', 'mcg', 'iu'] as const}
                value={unit}
                onChange={setUnit}
              />
            </View>
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
                  placeholder="3"
                  placeholderTextColor={colors.inkSubtle}
                  style={styles.smallInput}
                />
                <Text variant="small" color={colors.inkMuted}>days</Text>
              </View>
            )}
          </Field>

          {freq === 'weekly' || freq === 'twice_weekly' ? (
            <Field label="Shot day">
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
            </Field>
          ) : null}

          <Field label="Half-life (hours, optional)">
            <TextInput
              value={halfLife}
              onChangeText={setHalfLife}
              keyboardType="decimal-pad"
              placeholder="48"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              Drives the elimination tail of the level chart.
            </Text>
          </Field>

          <Field label="Time to peak (Tmax hours, optional)" divider={false}>
            <TextInput
              value={tmax}
              onChangeText={setTmax}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.inkSubtle}
              style={styles.doseInput}
            />
            <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: 4 }}>
              How long after the shot the level peaks. SC peptides usually 0.5–2 h; weekly GLP-1s 24–48 h.
            </Text>
          </Field>

          <View style={{ height: spacing.xl }} />
          <Button onPress={onSave} disabled={submitting} trailingChevron>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Save'}
          </Button>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
