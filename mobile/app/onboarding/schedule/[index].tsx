import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Info } from 'lucide-react-native';

import { BlendCompositionFields } from '@/components/BlendCompositionFields';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { DoseWheel } from '@/components/DoseWheel';
import { ChoicePill, OnboardingScreen } from '@/components/OnboardingScreen';
import { RouteChoice } from '@/components/RouteChoice';
import { ShotDayStrip } from '@/components/ShotDayStrip';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { blendParts, getPreset, isBlend } from '@/domain/peptides';
import {
  isCustomMedicationId,
  firstPostScheduleHref,
  medicationDisplayName,
  onboardingTotalSteps,
  scheduleIsComplete,
  scheduleStepIndex,
  type OnboardingFrequency,
  useOnboardingStore,
} from '@/stores/onboarding';
import { weekdayListLabel, type Weekday } from '@/domain/scheduling';
import { twiceWeeklyWeekdays } from '@/utils/schedule';
import { colors, spacing } from '@/theme';

// Five, in plain words. Three of them left a user on an every-three-days
// protocol, or on a fixed Monday, Wednesday and Friday, with nothing true to
// press. "Every few days" is the phrase people use for the first; the row under
// the chip asks for the number.
const FREQUENCIES: readonly { id: OnboardingFrequency; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'twice_weekly', label: 'Twice weekly' },
  { id: 'daily', label: 'Daily' },
  { id: 'every_n_days', label: 'Every few days' },
  { id: 'weekdays', label: 'Same days each week' },
];

/** The row that opens the source, and the sheet's own title. */
const SOURCE_TITLE = 'Half-life and source';

// One screen for each medication the user picked. A single medication looks
// exactly like the old single screen, and a second one adds a second screen.
// The dose wheel opens on "No dose" on every one of them: the user turns the
// wheel to a number, Poke does not offer one.
export default function ScheduleScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const index = Number.parseInt(params.index ?? '0', 10);

  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const schedules = useOnboardingStore((state) => state.schedules);
  const customNames = useOnboardingStore((state) => state.customNames);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const setScheduleDose = useOnboardingStore((state) => state.setScheduleDose);
  const setScheduleUnit = useOnboardingStore((state) => state.setScheduleUnit);
  const setScheduleRoute = useOnboardingStore((state) => state.setScheduleRoute);
  const setScheduleFrequency = useOnboardingStore((state) => state.setScheduleFrequency);
  const setShotDay = useOnboardingStore((state) => state.setShotDay);
  const setScheduleInterval = useOnboardingStore((state) => state.setScheduleInterval);
  const toggleScheduleWeekday = useOnboardingStore((state) => state.toggleScheduleWeekday);
  const setScheduleCompositionMg = useOnboardingStore((state) => state.setScheduleCompositionMg);
  const transition = useOnboardingTransition();
  const [sourceOpen, setSourceOpen] = useState(false);

  useEffect(() => {
    prepareSchedules();
  }, [prepareSchedules]);

  const total = medicationIds.length;
  const totalSteps = onboardingTotalSteps(journeyStage);
  const step = scheduleStepIndex(Number.isFinite(index) ? index : 0, total);
  const medicationId = Number.isInteger(index) && index >= 0 ? medicationIds[index] : undefined;
  const schedule = medicationId ? schedules[medicationId] : undefined;

  // Twice a week lands on a second day the user never picked, and the domain
  // owns which one. The strip asks for the whole week rather than restating the
  // rule, so a change to the rule reaches this screen without an edit.
  const frequencyKind = schedule?.frequencyKind;
  const shotDay = schedule?.shotDay;
  const shotDays = useMemo(() => {
    if (shotDay === undefined) return [];
    if (frequencyKind === 'twice_weekly') return twiceWeeklyWeekdays(shotDay);
    return [shotDay];
  }, [frequencyKind, shotDay]);

  if (!medicationId || !schedule) {
    return (
      <OnboardingScreen
        step={step}
        totalSteps={totalSteps}
        backHref="/onboarding/taking"
        transition={transition}
        title="When is shot day?"
        footer={<Button onPress={() => router.replace('/onboarding/taking')}>Choose a medication</Button>}
      >
        <Text color={colors.inkMuted}>Choose a medication before you set a schedule.</Text>
      </OnboardingScreen>
    );
  }

  const name = medicationDisplayName(medicationId, customNames);
  const isCustom = isCustomMedicationId(medicationId);
  const preset = isCustom ? undefined : getPreset(medicationId);
  const compositionParts = preset && isBlend(preset) ? blendParts(preset) : [];
  const isLast = index >= total - 1;
  // The dose and the schedule together. A frequency that carries a number is
  // not finished until the user gives the number, so Continue waits for it
  // rather than saving an interval or a week nobody chose.
  const canContinue = scheduleIsComplete(schedule);

  // Where the level curve comes from, or why there will not be one. It is the
  // same sentence it has always been, behind the (i) instead of under the fold.
  const sourceLine = preset
    ? (isBlend(preset)
        ? `${preset.source} With the milligrams from your vial label Poke draws the level curve as the sum of the parts.`
        : preset.evidence === 'unsourced'
          ? `${preset.source} Poke shows your shots for ${name} without a level curve.`
          : `Level curve source: ${preset.source}`)
    : 'Poke has no half-life for a custom medication. Poke shows your shots without a level curve. You can add a half-life later in Medications.';

  const goNext = () => {
    if (isLast) {
      // The first screen of the post-schedule run, whichever screen that is for
      // this journey stage. Naming a step here would send a user who has not
      // started to a question their stage already answered.
      transition.go(firstPostScheduleHref(journeyStage));
      return;
    }
    transition.go({ pathname: '/onboarding/schedule/[index]', params: { index: String(index + 1) } });
  };

  return (
    <OnboardingScreen
      step={step}
      totalSteps={totalSteps}
      backHref={index === 0
        ? '/onboarding/taking'
        : { pathname: '/onboarding/schedule/[index]', params: { index: String(index - 1) } }}
      transition={transition}
      title={total > 1 ? name : "When is shot day?"}
      // A single medication gets no subtitle: it repeated the title and named a
      // medication the user had just picked. A run of several keeps one, because
      // the count is the only place the run says how far along it is.
      subtitle={total > 1
        ? `Medication ${index + 1} of ${total}. Set the dose and the schedule.`
        : undefined}
      footer={(
        <Button disabled={!canContinue} onPress={goNext}>
          {isLast ? 'Continue' : 'Next medication'}
        </Button>
      )}
    >
      <View style={styles.section}>
        <Text variant="smallStrong">Dose</Text>
        <DoseWheel
          doseText={schedule.doseText}
          unit={schedule.unit}
          onChangeDose={(value) => setScheduleDose(medicationId, value)}
          onChangeUnit={(unit) => setScheduleUnit(medicationId, unit)}
          accessibilityLabel={`Dose for ${name}`}
        />
      </View>

      {/* The vial label, for a blend only. Skippable as a whole: with no
          milligrams entered Poke shows the shots without a curve, exactly as
          any unsourced preset does. */}
      {compositionParts.length > 0 ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Milligrams in the vial (optional)</Text>
          <BlendCompositionFields
            parts={compositionParts}
            values={schedule.compositionMg}
            onChange={(partId, text) => setScheduleCompositionMg(medicationId, partId, text)}
          />
        </View>
      ) : null}

      {isCustom ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Injection route</Text>
          <RouteChoice
            value={schedule.route}
            onChange={(route) => setScheduleRoute(medicationId, route)}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="smallStrong">How often?</Text>
        <View style={styles.wrapRow}>
          {FREQUENCIES.map((frequency) => (
            <ChoicePill
              key={frequency.id}
              label={frequency.label}
              selected={schedule.frequencyKind === frequency.id}
              onPress={() => setScheduleFrequency(medicationId, frequency.id)}
            />
          ))}
        </View>
      </View>

      {schedule.frequencyKind === 'weekly' || schedule.frequencyKind === 'twice_weekly' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">
            {schedule.frequencyKind === 'twice_weekly' ? 'Shot days' : 'Next shot day'}
          </Text>
          <ShotDayStrip
            days={shotDays}
            onPick={(day) => setShotDay(medicationId, day)}
            accessibilityLabel={`Shot days for ${name}`}
          />
        </View>
      ) : null}

      {/* The number sits inside the sentence it belongs to, and the line under
          it reads the sentence back. An empty box says it is empty rather than
          showing an interval nobody chose. */}
      {schedule.frequencyKind === 'every_n_days' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">How many days apart?</Text>
          <View style={styles.inlineRow}>
            <Text variant="small" color={colors.inkMuted}>Poke expects a shot every</Text>
            <TextInput
              value={schedule.intervalText}
              onChangeText={(value) => setScheduleInterval(medicationId, value)}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkSubtle}
              style={styles.intervalInput}
              accessibilityLabel={`Days between shots for ${name}`}
            />
            <Text variant="small" color={colors.inkMuted}>days</Text>
          </View>
          <Text variant="small" color={colors.inkMuted}>{intervalNote(schedule.intervalText)}</Text>
        </View>
      ) : null}

      {/* The same strip, pressed as many times as the week needs. Nothing opens
          filled, so the line below asks for a day until the user gives one. */}
      {schedule.frequencyKind === 'weekdays' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Shot days</Text>
          <ShotDayStrip
            days={schedule.weekdays}
            onPick={(day) => toggleScheduleWeekday(medicationId, day)}
            selection="many"
            accessibilityLabel={`Shot days for ${name}`}
          />
          <Text variant="small" color={colors.inkMuted}>{weekdayNote(schedule.weekdays)}</Text>
        </View>
      ) : null}

      {/* Legal copy does not move, so the (i) takes no entrance and no stagger. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SOURCE_TITLE}
        onPress={() => setSourceOpen(true)}
        hitSlop={8}
        style={styles.infoRow}
      >
        <Info size={18} color={colors.inkSubtle} />
        <Text variant="small" color={colors.inkMuted}>{SOURCE_TITLE}</Text>
      </Pressable>

      {index === 0 && !isLast ? (
        <Text variant="small" color={colors.inkMuted}>
          Next you check the other {total - 1 === 1 ? 'medication' : `${total - 1} medications`}.
        </Text>
      ) : null}

      <BottomSheet
        visible={sourceOpen}
        title={SOURCE_TITLE}
        onClose={() => setSourceOpen(false)}
      >
        <Text color={colors.inkMuted}>{sourceLine}</Text>
      </BottomSheet>
    </OnboardingScreen>
  );
}

/**
 * The interval read back as a sentence, or the line that says the box is empty.
 * Never a number the user did not type.
 */
function intervalNote(text: string): string {
  const days = Number.parseInt(text, 10);
  if (!Number.isFinite(days) || days < 1) return 'Enter how many days pass between shots.';
  return days === 1 ? 'Shots land every day.' : `Shots land every ${days} days.`;
}

/** The picked days read back, or the line that says none is picked yet. */
function weekdayNote(weekdays: readonly Weekday[]): string {
  const named = weekdayListLabel(weekdays);
  return named === '' ? 'Pick the days you take your shot.' : `Poke schedules ${named}.`;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  intervalInput: {
    width: 60,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    textAlign: 'center',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
});
