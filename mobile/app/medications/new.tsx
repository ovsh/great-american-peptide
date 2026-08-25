import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, Switch, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';

import { BlendCompositionFields } from '@/components/BlendCompositionFields';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input } from '@/components/Input';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { RouteChoice } from '@/components/RouteChoice';
import { Pill } from '@/components/Pill';
import { MarkChip, estimateMark } from '@/components/EstimateMark';
import { MedVialIcon } from '@/components/MedVialIcon';
import {
  AddActionCard,
  FilterRail,
  GhostAddRow,
  NO_CURVE_NOTE,
  NoMatchLine,
  SectionHead,
  sectionLabel,
  usePresetCatalog,
} from '@/components/preset-picker';

import { compositionDraft, parseComposition, serializeComposition } from '@/domain/blends';
import { parseDoseByDay, scheduledWeekdays, serializeDoseByDay, type DoseByDay } from '@/domain/doseByDay';
import {
  blendParts,
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  getPreset,
  isBlend,
  type PeptidePreset,
  type PresetEntry,
  type FrequencyKind,
  type Route,
  type Unit,
} from '@/domain/peptides';
import {
  WEEKDAY_OPTIONS,
  isWeekday,
  weekdayListLabel,
  weekdayMask,
  weekdaysFromMask,
  type Weekday,
} from '@/domain/scheduling';
import { cycleDurationLabel } from '@/domain/cycle';
import { fmtDayLabel } from '@/utils/date';
import { ProLock } from '@/components/ProLock';
import {
  countActiveMedications,
  FREE_MEDICATION_LIMIT,
  getMedication,
  nextColorIndex,
  type NewMedication,
} from '@/repositories/medications';
import { track, type AnalyticsEvents } from '@/services/analytics';
import { createMedicationAndRefresh, setMedicationStatusAndRefresh, updateMedicationAndRefresh } from '@/services/medicationMutations';
import { useAppStore } from '@/stores/app';
import { isProNow, useIsPro } from '@/stores/entitlement';
import { safeBack } from '@/utils/nav';
import { twiceWeeklyScheduleNote } from '@/utils/schedule';
import { colors, spacing, radius } from '@/theme';

type EditableFrequency = Exclude<FrequencyKind, 'custom'>;

/**
 * The chips, in plain words.
 *
 * "Every N days" was the name of the field and not the name of the schedule, so
 * a user who takes a shot every third day read past it. "Every few days" is the
 * phrase they use, and the row under the chip asks for the number.
 *
 * "Same days each week" is the fixed set: Monday, Wednesday and Friday holds
 * those three weekdays for good, where "Every few days" walks around the week.
 */
const FREQS: { id: EditableFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'twice_weekly', label: '2× / week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'every_n_days', label: 'Every few days' },
  { id: 'weekdays', label: 'Same days each week' },
];

/**
 * The cycle lengths on offer, in weeks, and the same five on every medication.
 *
 * They are the shapes people write down and not a recommendation: the list does
 * not change with the peptide, nothing opens selected, and Poke saves no cycle
 * until the user presses a chip. "Other" takes a count of days, because a 60 day
 * protocol is a real protocol and no number of weeks says 60.
 */
const WEEKS_ON_OPTIONS = [4, 6, 8, 12] as const;
const WEEKS_OFF_OPTIONS = [2, 4, 6, 8] as const;

type WeeksOnChoice = (typeof WEEKS_ON_OPTIONS)[number] | 'other';
type WeeksOffChoice = (typeof WEEKS_OFF_OPTIONS)[number] | 'none';

/**
 * Which medications open the cycle section already unfolded.
 *
 * Visibility only. A GLP-1 user can still track a cycle, and the row is there to
 * press; the categories that cycle in practice simply do not have to go looking
 * for it. Poke fills nothing in either way.
 */
const CYCLING_CATEGORIES = new Set(['recovery', 'growth', 'longevity']);

/**
 * The ramp read aloud, in the order of `colors.med`. A dot on a calendar cell
 * carries no name, so a screen reader has to say the colour out loud. The type
 * follows the ramp, so a seventh hue will not compile without a name.
 */
type NameEach<T extends readonly unknown[]> = { [K in keyof T]: string };
const COLOR_NAMES: NameEach<typeof colors.med> =
  ['Green', 'Blue', 'Pink', 'Olive', 'Indigo', 'Teal'];

/**
 * The dot, the ring the picked one wears, and the touch target that holds both.
 * The targets sit edge to edge, so the dots still stand 12 pt apart.
 */
const SWATCH_DOT = 32;
const SWATCH_RING_WIDTH = 2;
const SWATCH_TARGET = SWATCH_DOT + 2 * (SWATCH_RING_WIDTH + spacing.xs);
/** The picked dot grows into its ring by a hair. */
const SWATCH_GROWTH = 1.08;

export default function AddMedicationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const editingId = params.medicationId;

  const [step, setStep] = useState<'pick' | 'config'>('pick');
  const [presetId, setPresetId] = useState<string | null>(null);
  // Which shape of row opened this form, for `medication_added`. The name it
  // carries is never sent.
  const [pickedKind, setPickedKind] = useState<AnalyticsEvents['medication_added']['kind']>('custom');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  // The dose of each shot day, held as typed and keyed by weekday. Off for a
  // new medication: one dose is the whole plan for most people, and the rows
  // open empty rather than on a number Poke picked.
  const [doseByDayOn, setDoseByDayOn] = useState(false);
  const [dayDoses, setDayDoses] = useState<Partial<Record<Weekday, string>>>({});
  const [unit, setUnit] = useState<Unit>('mg');
  const [route, setRoute] = useState<Route>('sc');
  const [freq, setFreq] = useState<EditableFrequency>('weekly');
  const [freqValue, setFreqValue] = useState('');
  const [weekday, setWeekday] = useState<Weekday>(currentWeekday());
  // The fixed weekday set. Empty on arrival, and it stays empty until the user
  // presses a day: Poke picks no shot day for anybody.
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  // The hue this medication draws with on Today, on the calendar and on the
  // vial. A new medication opens on the one `nextColorIndex` hands out, and the
  // catalogue tints its vials with the same number, so the colour on the row
  // the user presses is the colour they get.
  const [colorIndex, setColorIndex] = useState(0);
  const [halfLife, setHalfLife] = useState('');
  const [tmax, setTmax] = useState('');
  // The vial label of a blend, held as typed: milligrams per part, keyed by
  // the part's preset id. Empty for everything that is not a blend.
  const [compositionMg, setCompositionMg] = useState<Record<string, string>>({});
  // The cycle. `weeksOn` null is the whole point of the section: it means the
  // user has picked no length, and Poke saves no cycle rather than a usual one.
  const [cycleOpen, setCycleOpen] = useState(false);
  const [weeksOn, setWeeksOn] = useState<WeeksOnChoice | null>(null);
  const [customDaysOn, setCustomDaysOn] = useState('');
  const [weeksOff, setWeeksOff] = useState<WeeksOffChoice | null>(null);
  const [startedEarlier, setStartedEarlier] = useState(false);
  const [daysAgo, setDaysAgo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pro = useIsPro();
  // The route is reachable directly, so the screen checks the limit itself.
  const [atFreeLimit, setAtFreeLimit] = useState(false);
  const selectedPreset = presetId ? getPreset(presetId) : undefined;
  const catalog = usePresetCatalog();
  // The days this schedule names, Monday first. Two of them or more is what
  // makes a dose per day a question worth asking: a daily plan and an interval
  // plan name no weekday, so they hide the row and save one dose.
  const planDays = scheduledWeekdays(freq, freq === 'weekdays' ? weekdayMask(weekdays) : weekday);
  const perDayEligible = planDays.length >= 2;

  useEffect(() => {
    if (editingId || pro) { setAtFreeLimit(false); return; }
    countActiveMedications()
      .then((count) => setAtFreeLimit(count >= FREE_MEDICATION_LIMIT))
      .catch(() => {});
  }, [editingId, pro]);

  useEffect(() => {
    if (editingId) return;
    nextColorIndex()
      .then(setColorIndex)
      .catch(() => {});
  }, [editingId]);

  /**
   * True when the row under edit was saved by setup without a dose and archived
   * as bookkeeping rather than by choice. Saving the dose is what finishes that
   * setup, so the save path restores the row instead of leaving it hidden.
   */
  const wasDeferred = useRef(false);

  useEffect(() => {
    if (!editingId) return;
    getMedication(editingId)
      .then((medication) => {
        if (!medication) {
          Alert.alert('Poke could not find that medication');
          safeBack('/medications');
          return;
        }
        wasDeferred.current = medication.status === 'archived' && !(medication.default_dose > 0);
        setPresetId(medication.preset_id);
        setName(medication.name);
        // Zero is a deferred dose from setup and not a dose, so the box opens
        // empty and asks rather than showing a number nobody gave.
        setDose(medication.default_dose > 0 ? String(medication.default_dose) : '');
        // A stored dose plan opens the rows already on. A column that does not
        // parse reads as no plan, which is the single dose row it would be.
        const storedDoses = parseDoseByDay(medication.dose_by_day);
        setDoseByDayOn(storedDoses !== null);
        setDayDoses(doseTexts(storedDoses));
        setUnit(medication.default_unit);
        setRoute(medication.default_route);
        setFreq(medication.frequency_kind === 'custom' ? 'daily' : medication.frequency_kind);
        setFreqValue(medication.frequency_kind === 'every_n_days' && medication.frequency_value !== null
          ? String(medication.frequency_value)
          : '');
        setWeekday(isWeekday(medication.frequency_value)
          ? medication.frequency_value
          : weekdayFromTimestamp(medication.created_at));
        setWeekdays(medication.frequency_kind === 'weekdays'
          ? weekdaysFromMask(medication.frequency_value)
          : []);
        setColorIndex(medication.color_index);
        setHalfLife(medication.half_life_hours === null ? '' : String(medication.half_life_hours));
        setTmax(medication.tmax_hours === null ? '' : String(medication.tmax_hours));
        setCompositionMg(compositionTexts(medication.composition));
        // The cycle round-trips: a stored length that is not one of the chips
        // lands on Other, and a backdated anchor lands on Earlier with the day
        // count that produced it, so an edit that leaves the section alone
        // writes back the same plan.
        const daysOn = medication.cycle_days_on;
        setCycleOpen(daysOn !== null);
        setWeeksOn(weeksOnChoiceFor(daysOn));
        setCustomDaysOn(weeksOnChoiceFor(daysOn) === 'other' && daysOn !== null ? String(daysOn) : '');
        setWeeksOff(daysOn === null ? null : weeksOffChoiceFor(medication.cycle_days_off));
        const startedDaysAgo = medication.cycle_started_at === null
          ? 0
          : daysBetweenLocal(medication.cycle_started_at, Date.now());
        setStartedEarlier(startedDaysAgo > 0);
        setDaysAgo(startedDaysAgo > 0 ? String(startedDaysAgo) : '');
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
    setPickedKind(isBlend(p) ? 'blend' : entry.moleculeName ? 'brand' : 'preset');
    setName(entry.name);
    setDose('');
    resetDoseByDay();
    setUnit(p.unit);
    setRoute(p.defaultRoute);
    setFreq(editableFrequency(p.defaultFrequency.kind));
    setFreqValue(p.defaultFrequency.value ? String(p.defaultFrequency.value) : '');
    setWeekday(currentWeekday());
    setWeekdays([]);
    // An unsourced preset carries no half-life and no Tmax. `String(null)` wrote
    // the word "null" into the field and NaN into the database.
    setHalfLife(p.halfLifeHours === null ? '' : String(p.halfLifeHours));
    setTmax(p.tmaxHours === null ? '' : String(p.tmaxHours));
    // Empty even for a blend. The milligrams come off the user's vial label.
    setCompositionMg({});
    // The category unfolds the section and fills none of it in.
    resetCycle(CYCLING_CATEGORIES.has(p.category));
    setStep('config');
  };

  // The two doors into one act: the ghost row opens the form blank, and the
  // action card at the foot of a search carries the typed name in with it, so
  // nobody types the same name twice.
  const pickCustom = (typedName?: string) => {
    setPresetId(null);
    setPickedKind('custom');
    setName(typedName ?? '');
    setDose('');
    resetDoseByDay();
    setUnit('mg');
    setRoute('sc');
    setFreq('weekly');
    setFreqValue('');
    setWeekday(currentWeekday());
    setWeekdays([]);
    setHalfLife('');
    setTmax('');
    setCompositionMg({});
    resetCycle(false);
    setStep('config');
  };

  const resetCycle = (open: boolean) => {
    setCycleOpen(open);
    setWeeksOn(null);
    setCustomDaysOn('');
    setWeeksOff(null);
    setStartedEarlier(false);
    setDaysAgo('');
  };

  const resetDoseByDay = () => {
    setDoseByDayOn(false);
    setDayDoses({});
  };

  /**
   * The rows open on the dose the user already typed, and open empty when that
   * field is empty. Poke copies a number the user gave and proposes none.
   */
  const toggleDoseByDay = (next: boolean) => {
    setDoseByDayOn(next);
    if (!next) return;
    const seeded: Partial<Record<Weekday, string>> = {};
    for (const day of planDays) seeded[day] = dose;
    setDayDoses(seeded);
  };

  const toggleWeekday = (day: Weekday) => {
    setWeekdays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]);
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a medication name'); return; }
    // One dose, or one for every day the schedule names. A row left empty is
    // not a plan, so Poke asks for the missing day rather than falling back to
    // the default dose on it.
    const perDay = doseByDayOn && perDayEligible;
    const dayMap: DoseByDay = {};
    if (perDay) {
      for (const day of planDays) {
        const dayDose = parseFloat(dayDoses[day] ?? '');
        if (!Number.isFinite(dayDose) || dayDose <= 0) {
          Alert.alert('Enter a dose above zero for every shot day');
          return;
        }
        dayMap[day] = dayDose;
      }
    }
    // The default dose stays the number every other screen falls back to, so a
    // dose plan hands it the first day of the week it covers.
    const d = perDay ? dayMap[planDays[0]] ?? 0 : parseFloat(dose);
    if (!Number.isFinite(d) || d <= 0) { Alert.alert('Enter a dose above zero'); return; }
    // An empty box used to fall through `parseInt('') || 1` and save a daily
    // schedule, with a daily reminder, that the user never chose. Poke asks for
    // the interval instead.
    const interval = parseInt(freqValue, 10);
    if (freq === 'every_n_days' && (!Number.isFinite(interval) || interval < 1)) {
      Alert.alert('Enter a number of days above zero');
      return;
    }
    // An empty set is not a schedule, and Poke picks no day to fill it in.
    const dayMask = weekdayMask(weekdays);
    if (freq === 'weekdays' && dayMask === 0) {
      Alert.alert('Pick at least one shot day');
      return;
    }
    // The vial label saves whole or not at all. A label copied halfway hands
    // the missing parts' milligrams to the typed parts, so Poke refuses it.
    // Null clears a stored label whose boxes the user emptied.
    let composition: string | null = null;
    if (selectedPreset && isBlend(selectedPreset)) {
      const draft = compositionDraft(
        blendParts(selectedPreset).map((part) => part.id),
        compositionMg,
      );
      if (draft.kind === 'partial') {
        Alert.alert('Enter a number for every part or leave every box empty');
        return;
      }
      composition = draft.kind === 'complete' ? serializeComposition(draft.components) : null;
    }
    // The cycle saves only when the user has answered every part of it. A
    // section left open and empty is not a cycle, and Poke will not guess the
    // half the user skipped.
    let cycleDaysOn: number | null = null;
    let cycleDaysOff: number | null = null;
    let cycleStartedAt: number | null = null;
    if (cycleOpen) {
      if (weeksOn === null) { Alert.alert('Pick how long the cycle runs, or turn the cycle off'); return; }
      if (weeksOn === 'other') {
        const days = parseInt(customDaysOn, 10);
        if (!Number.isFinite(days) || days < 1) { Alert.alert('Enter a number of days above zero'); return; }
        cycleDaysOn = days;
      } else {
        cycleDaysOn = weeksOn * DAYS_IN_WEEK;
      }
      if (weeksOff === null) { Alert.alert('Pick how long the break runs, or pick None'); return; }
      cycleDaysOff = weeksOff === 'none' ? null : weeksOff * DAYS_IN_WEEK;
      if (startedEarlier) {
        const ago = parseInt(daysAgo, 10);
        if (!Number.isFinite(ago) || ago < 1) { Alert.alert('Enter how many days ago the cycle started'); return; }
        cycleStartedAt = localDaysAgo(ago);
      } else {
        cycleStartedAt = Date.now();
      }
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        presetId,
        defaultDose: d,
        // Null clears a stored plan whose schedule no longer names two days.
        doseByDay: perDay ? serializeDoseByDay(dayMap) : null,
        defaultUnit: unit,
        defaultRoute: route,
        frequencyKind: freq,
        // One column, four meanings: the interval in days, the weekday set as a
        // bitmask, nothing at all, or the single shot day.
        frequencyValue: freq === 'every_n_days'
          ? interval
          : freq === 'weekdays'
            ? dayMask
            : freq === 'daily'
              ? null
              : weekday,
        halfLifeHours: optionalHours(halfLife),
        tmaxHours: optionalHours(tmax),
        composition,
        cycleDaysOn,
        cycleDaysOff,
        cycleStartedAt,
        colorIndex,
      } satisfies NewMedication;
      if (editingId) {
        await updateMedicationAndRefresh(editingId, input);
        // The save above passed the dose check, so a deferred row now has its
        // dose and comes back on, under the same allowance rule setup applied.
        // Over the limit it stays archived and Restore owns the paywall.
        if (wasDeferred.current
          && (isProNow() || (await countActiveMedications()) < FREE_MEDICATION_LIMIT)) {
          await setMedicationStatusAndRefresh(editingId, 'active');
          wasDeferred.current = false;
        }
      } else {
        // Last check before the write: the entitlement can change while the
        // form is open.
        if (!isProNow() && (await countActiveMedications()) >= FREE_MEDICATION_LIMIT) {
          setAtFreeLimit(true);
          setStep('pick');
          return;
        }
        await createMedicationAndRefresh(input);
        track('medication_added', { kind: pickedKind, source: 'app' });
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
            source="medication_limit"
            title="Track a third medication"
            body="The free version keeps two medications. Pro tracks as many as you take, each with its own schedule, level and history."
          />
        </View>
      ) : step === 'pick' ? (
        <ScrollView
          contentContainerStyle={styles.pickContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Input
            value={catalog.query}
            onChangeText={catalog.changeQuery}
            placeholder="Search a peptide or a brand name"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search peptides"
          />

          <FilterRail activeFilter={catalog.railFilter} onPick={catalog.pickFilter} />

          {!catalog.hasQuery ? <GhostAddRow onPress={() => pickCustom()} /> : null}

          {catalog.entries.length > 0 ? (
            <>
              <SectionHead
                label={sectionLabel(catalog.hasQuery, catalog.filter)}
                count={catalog.entries.length}
              />
              <View style={styles.pickList}>
                {/* Every vial in the catalogue wears the one hue this
                    medication will get. The row's place in the list is not a
                    colour, and tinting by it promised six colours the user
                    could not have. */}
                {catalog.entries.map((entry) => (
                  <PresetRow
                    key={entry.id}
                    entry={entry}
                    colorIndex={colorIndex}
                    onPress={() => pickPreset(entry)}
                  />
                ))}
                {catalog.hasQuery ? (
                  <AddActionCard
                    name={catalog.trimmed}
                    description="Poke starts a custom medication with this name."
                    onPress={() => pickCustom(catalog.trimmed)}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.pickList}>
              <NoMatchLine query={catalog.trimmed} />
              <AddActionCard
                name={catalog.trimmed}
                description="Poke starts a custom medication with this name."
                onPress={() => pickCustom(catalog.trimmed)}
              />
            </View>
          )}

          {catalog.filter === 'blend' && !catalog.hasQuery ? (
            <Text variant="small" color={colors.inkSubtle}>{NO_CURVE_NOTE}</Text>
          ) : null}
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

          <Field label="Color">
            <View style={styles.colorRow}>
              {colors.med.map((hue, index) => (
                <ColorSwatch
                  key={hue}
                  hue={hue}
                  name={COLOR_NAMES[index]}
                  active={colorIndex === index}
                  onPress={() => {
                    setColorIndex(index);
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  }}
                />
              ))}
            </View>
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

          {/* The vial label, for a blend only. Skippable as a whole: with no
              milligrams entered Poke shows the shots without a curve, exactly
              as any unsourced preset does. */}
          {selectedPreset && isBlend(selectedPreset) ? (
            <Field label="Milligrams in the vial (optional)">
              <BlendCompositionFields
                parts={blendParts(selectedPreset)}
                values={compositionMg}
                onChange={(partId, text) =>
                  setCompositionMg((current) => ({ ...current, [partId]: text }))}
              />
            </Field>
          ) : null}

          <Field label="Injection route">
            <RouteChoice value={route} onChange={setRoute} />
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
            {/* The number sits inside the sentence it belongs to, and the line
                under it reads the sentence back. An empty box says it is empty
                rather than showing an interval nobody chose. */}
            {freq === 'every_n_days' && (
              <>
                <View style={styles.inlineRow}>
                  <Text variant="small" color={colors.inkMuted}>Poke expects a shot every</Text>
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
                <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                  {intervalNote(freqValue)}
                </Text>
              </>
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
                      // The state is for a phone, the ARIA prop is for the web build.
                      // react-native-web drops `accessibilityState` and reads `aria-*`.
                      accessibilityState={{ selected: active }}
                      aria-checked={active}
                      accessibilityLabel={day.label}
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

          {/* The same seven chips, pressed as many times as the week needs.
              Nothing opens selected, so the caption below asks for a day until
              the user gives one. */}
          {freq === 'weekdays' ? (
            <Field label="Shot days">
              <View style={styles.weekdayRow}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = weekdays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      accessibilityRole="checkbox"
                      // The state is for a phone, the ARIA prop is for the web build.
                      // react-native-web drops `accessibilityState` and reads `aria-*`.
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      accessibilityLabel={day.label}
                      onPress={() => toggleWeekday(day.value)}
                      style={[styles.weekdayChip, active && styles.freqChipActive]}
                    >
                      <Text variant="caption" color={active ? colors.inkInverse : colors.ink}>{day.shortLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                {weekdayNote(weekdays)}
              </Text>
            </Field>
          ) : null}

          {/* A dose per shot day, for a plan that carries two. It sits under the
              days it splits, and it appears only once the schedule names two of
              them, because there is nothing to split otherwise. */}
          {perDayEligible ? (
            <Field
              label="Dose changes by day"
              trailing={
                <Switch
                  value={doseByDayOn}
                  onValueChange={toggleDoseByDay}
                  accessibilityLabel="Dose changes by day"
                  trackColor={{ true: colors.accent, false: colors.borderStrong }}
                />
              }
            >
              {doseByDayOn ? (
                <View style={{ gap: spacing.xs }}>
                  {WEEKDAY_OPTIONS.filter((day) => planDays.includes(day.value)).map((day) => (
                    <View key={day.value} style={styles.dayDoseRow}>
                      <Text variant="small" color={colors.inkMuted} style={styles.dayDoseName}>{day.label}</Text>
                      <TextInput
                        value={dayDoses[day.value] ?? ''}
                        onChangeText={(value) =>
                          setDayDoses((current) => ({ ...current, [day.value]: value }))}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.inkSubtle}
                        style={styles.smallInput}
                        accessibilityLabel={`Dose on ${day.label}`}
                      />
                      <Text variant="small" color={colors.inkMuted}>{unit}</Text>
                    </View>
                  ))}
                  <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                    Poke shows the dose you set for each day.
                  </Text>
                </View>
              ) : null}
            </Field>
          ) : null}

          {/* The cycle. The toggle opens the section, and the section starts
              with nothing chosen, so a user who opens it and changes their mind
              simply turns it off again and saves a medication with no cycle. */}
          <Field
            label="Track a cycle"
            trailing={
              <Switch
                value={cycleOpen}
                onValueChange={(next) => { if (next) setCycleOpen(true); else resetCycle(false); }}
                accessibilityLabel="Track a cycle"
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
              />
            }
          >
            <Text variant="caption" color={colors.inkSubtle}>
              Poke tracks the plan you set. Poke does not suggest one.
            </Text>

            {cycleOpen ? (
              <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
                <View>
                  <Text variant="small" color={colors.inkMuted}>Weeks on</Text>
                  <View style={[styles.weekdayRow, { marginTop: spacing.xs }]}>
                    {WEEKS_ON_OPTIONS.map((weeks) => (
                      <CycleChip
                        key={weeks}
                        label={String(weeks)}
                        accessibilityLabel={`${weeks} weeks on`}
                        active={weeksOn === weeks}
                        onPress={() => setWeeksOn(weeks)}
                      />
                    ))}
                    <CycleChip
                      label="Other"
                      accessibilityLabel="Another number of days on"
                      active={weeksOn === 'other'}
                      onPress={() => setWeeksOn('other')}
                    />
                  </View>
                  {weeksOn === 'other' ? (
                    <View style={styles.inlineRow}>
                      <Text variant="small" color={colors.inkMuted}>Run for</Text>
                      <TextInput
                        value={customDaysOn}
                        onChangeText={setCustomDaysOn}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.inkSubtle}
                        style={styles.smallInput}
                        accessibilityLabel="Days the cycle runs"
                      />
                      <Text variant="small" color={colors.inkMuted}>days</Text>
                    </View>
                  ) : null}
                </View>

                <View>
                  <Text variant="small" color={colors.inkMuted}>Weeks off</Text>
                  <View style={[styles.weekdayRow, { marginTop: spacing.xs }]}>
                    {WEEKS_OFF_OPTIONS.map((weeks) => (
                      <CycleChip
                        key={weeks}
                        label={String(weeks)}
                        accessibilityLabel={`${weeks} weeks off`}
                        active={weeksOff === weeks}
                        onPress={() => setWeeksOff(weeks)}
                      />
                    ))}
                    <CycleChip
                      label="None"
                      accessibilityLabel="No break reminder"
                      active={weeksOff === 'none'}
                      onPress={() => setWeeksOff('none')}
                    />
                  </View>
                  <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                    None turns the break reminder off.
                  </Text>
                </View>

                <View>
                  <Text variant="small" color={colors.inkMuted}>First day</Text>
                  <View style={[styles.freqRow, { marginTop: spacing.xs }]}>
                    <Pressable
                      onPress={() => { setStartedEarlier(false); setDaysAgo(''); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: !startedEarlier }}
                      aria-checked={!startedEarlier}
                      style={[styles.freqChip, !startedEarlier && styles.freqChipActive]}
                    >
                      <Text variant="caption" color={!startedEarlier ? colors.inkInverse : colors.ink}>Today</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setStartedEarlier(true)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: startedEarlier }}
                      aria-checked={startedEarlier}
                      style={[styles.freqChip, startedEarlier && styles.freqChipActive]}
                    >
                      <Text variant="caption" color={startedEarlier ? colors.inkInverse : colors.ink}>Earlier</Text>
                    </Pressable>
                  </View>
                  {startedEarlier ? (
                    <View style={styles.inlineRow}>
                      <Text variant="small" color={colors.inkMuted}>Started</Text>
                      <TextInput
                        value={daysAgo}
                        onChangeText={setDaysAgo}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.inkSubtle}
                        style={styles.smallInput}
                        accessibilityLabel="Days since the cycle started"
                      />
                      <Text variant="small" color={colors.inkMuted}>days ago</Text>
                    </View>
                  ) : null}
                  {/* The one line that proves the arithmetic before the save.
                      It reads back the day and the length the user chose, and
                      it says nothing when either one is still missing. */}
                  <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.xs }}>
                    {cycleSummary(weeksOn, customDaysOn, startedEarlier, daysAgo)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Field>

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
 * Wegovy is. A blend row names its parts there, because for a blend the parts
 * are what it is. A molecule row has no such line. The evidence tier read the
 * same on almost every card, so it moved to the estimate sheet on Today, and
 * only two exceptions stayed on the row itself: a missing half-life, because it
 * changes what the app can draw, and the estimate mark, because an estimate is
 * the one tier whose number is not a published measurement.
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
  const middleLine = isBlend(entry.preset)
    ? blendParts(entry.preset).map((part) => part.name).join(', ')
    : entry.moleculeName;
  return (
    <Pressable onPress={onPress}>
      <Card padding="md" style={styles.presetCard}>
        <MedVialIcon size={36} colorIndex={colorIndex} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" style={styles.presetName}>{entry.name}</Text>
            {mark ? <MarkChip label={mark} /> : null}
          </View>
          {middleLine ? (
            <Text variant="caption" color={colors.inkMuted}>
              {middleLine}
            </Text>
          ) : null}
          {entry.preset.evidence === 'unsourced' ? (
            <Text variant="caption" color={colors.inkMuted}>
              {EVIDENCE_LABELS.unsourced}
            </Text>
          ) : null}
        </View>
        <Pill tone="neutral">{categoryPillLabel(entry.preset.category)}</Pill>
      </Card>
    </Pressable>
  );
}

/**
 * The category as the right-hand pill reads it. The filter rail says Blends
 * because it names a group, and this pill names one row, so the plural drops.
 */
function categoryPillLabel(category: PeptidePreset['category']): string {
  return category === 'blend' ? 'Blend' : CATEGORY_LABELS[category];
}

/**
 * One hue of the medication ramp.
 *
 * The picked one wears a ring of its own colour, set off from the dot, and
 * grows into it. A tick would cover the one thing the dot is there to show, and
 * a ring reads across a row of six without one.
 *
 * A hue another medication already uses stays on offer. Two medications in the
 * same colour is the user's call, and a warning here would be Poke arguing with
 * a choice it cannot make better.
 */
function ColorSwatch({
  hue,
  name,
  active,
  onPress,
}: {
  hue: string;
  name: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      // The state is for a phone, the ARIA prop is for the web build.
      // react-native-web drops `accessibilityState` and reads `aria-*`.
      accessibilityState={{ selected: active }}
      aria-checked={active}
      accessibilityLabel={name}
      onPress={onPress}
      style={[styles.swatchTarget, active && { borderColor: hue }]}
    >
      <View style={[styles.swatchDot, { backgroundColor: hue }, active && styles.swatchDotActive]} />
    </Pressable>
  );
}

/**
 * One cycle chip. The same size as a weekday chip, five to a row, so the group
 * fits one line on the narrowest phone Poke supports.
 */
function CycleChip({
  label,
  accessibilityLabel,
  active,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      aria-checked={active}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.weekdayChip, active && styles.freqChipActive]}
    >
      <Text variant="caption" color={active ? colors.inkInverse : colors.ink}>{label}</Text>
    </Pressable>
  );
}

const DAYS_IN_WEEK = 7;

/** Which chip a stored length sits on. Anything off the list lands on Other. */
function weeksOnChoiceFor(daysOn: number | null): WeeksOnChoice | null {
  if (daysOn === null) return null;
  const weeks = daysOn / DAYS_IN_WEEK;
  return WEEKS_ON_OPTIONS.find((option) => option === weeks) ?? 'other';
}

/**
 * The break chip. A cycle with no break length is the None chip, which is the
 * user saying they want no break reminder rather than a value Poke lost.
 */
function weeksOffChoiceFor(daysOff: number | null): WeeksOffChoice | null {
  if (daysOff === null) return 'none';
  const weeks = daysOff / DAYS_IN_WEEK;
  return WEEKS_OFF_OPTIONS.find((option) => option === weeks) ?? null;
}

/** Local midnight, that many days back. */
function localDaysAgo(days: number): number {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysBetweenLocal(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
}

/**
 * The plan read back in words, or a line that says what is still missing.
 *
 * Never a number the user did not type: an unfinished section says it is
 * unfinished rather than showing a length nobody chose.
 */
function cycleSummary(
  weeksOn: WeeksOnChoice | null,
  customDaysOn: string,
  startedEarlier: boolean,
  daysAgo: string,
): string {
  const days = weeksOn === null
    ? null
    : weeksOn === 'other'
      ? readCount(customDaysOn)
      : weeksOn * DAYS_IN_WEEK;
  if (days === null) return 'Pick a length to see the last day of the plan.';

  const ago = startedEarlier ? readCount(daysAgo) : 0;
  if (ago === null) return 'Enter how many days ago the cycle started.';

  const start = localDaysAgo(ago);
  const lastDay = new Date(start);
  lastDay.setDate(lastDay.getDate() + days - 1);
  return `${cycleDurationLabel(days)} from ${fmtDayLabel(start)}. The plan ends ${fmtDayLabel(lastDay.getTime())}.`;
}

/**
 * The interval read back as a sentence, or the line that says the box is empty.
 * Never a number the user did not type.
 */
function intervalNote(text: string): string {
  const days = readCount(text);
  if (days === null) return 'Enter how many days pass between shots.';
  return days === 1 ? 'Shots land every day.' : `Shots land every ${days} days.`;
}

/** The picked days read back, or the line that says none is picked yet. */
function weekdayNote(weekdays: readonly Weekday[]): string {
  const named = weekdayListLabel(weekdays);
  return named === '' ? 'Pick the days you take your shot.' : `Poke schedules ${named}.`;
}

function readCount(text: string): number | null {
  const value = parseInt(text, 10);
  return Number.isFinite(value) && value >= 1 ? value : null;
}

function currentWeekday(): Weekday {
  return weekdayFromTimestamp(Date.now());
}

/**
 * A stored vial label back into the boxes, for the edit round-trip. A row with
 * no label, or one that does not parse, opens every box empty.
 */
function compositionTexts(text: string | null): Record<string, string> {
  const components = parseComposition(text);
  if (!components) return {};
  return Object.fromEntries(components.map((component) => [component.presetId, String(component.mg)]));
}

/**
 * A stored dose plan back into the boxes, for the edit round-trip. A row with
 * no plan, or one that does not parse, opens every box empty.
 */
function doseTexts(map: DoseByDay | null): Partial<Record<Weekday, string>> {
  if (map === null) return {};
  const texts: Partial<Record<Weekday, string>> = {};
  for (const option of WEEKDAY_OPTIONS) {
    const dose = map[option.value];
    if (dose !== undefined) texts[option.value] = String(dose);
  }
  return texts;
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
  pickContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.hero,
    gap: spacing.md,
  },
  pickList: {
    gap: spacing.sm,
  },
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
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // The touch target is wider than the dot, so the row pulls back by the
    // slack and the first dot lines up with the label above it.
    marginLeft: -(SWATCH_TARGET - SWATCH_DOT) / 2,
  },
  swatchTarget: {
    width: SWATCH_TARGET,
    height: SWATCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: SWATCH_RING_WIDTH,
    // The ring is there on every swatch and coloured on the picked one, so the
    // row does not shift by two points when the user presses another hue.
    borderColor: 'transparent',
  },
  swatchDot: {
    width: SWATCH_DOT,
    height: SWATCH_DOT,
    borderRadius: radius.pill,
  },
  swatchDotActive: {
    transform: [{ scale: SWATCH_GROWTH }],
  },
  doseInput: {
    flex: 1,
    // A text field carries an intrinsic width, and a flex row honours it as a
    // floor, so the field kept its own width and pushed the unit chips off the
    // screen. On a 375 pt phone the third chip lost its right half. The floor
    // goes, and the field gives the chips the room they measure.
    minWidth: 0,
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
  dayDoseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // The row is the touch target of the box inside it.
    minHeight: 44,
  },
  dayDoseName: {
    flex: 1,
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
  inlineRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
