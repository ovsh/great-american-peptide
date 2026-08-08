import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoicePill, OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { getPreset, type Route, type Unit } from '@/domain/peptides';
import {
  CUSTOM_MEDICATION_ID,
  POST_SCHEDULE_ROUTES,
  SHOT_DAY_OPTIONS,
  medicationDisplayName,
  onboardingTotalSteps,
  scheduleStepIndex,
  type OnboardingFrequency,
  useOnboardingStore,
} from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

const FREQUENCIES: readonly { id: OnboardingFrequency; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'twice_weekly', label: 'Twice weekly' },
  { id: 'daily', label: 'Daily' },
];

const UNITS: readonly Unit[] = ['mg', 'mcg', 'iu'];
const ROUTES: readonly { id: Route; label: string }[] = [
  { id: 'sc', label: 'Subcutaneous' },
  { id: 'im', label: 'Intramuscular' },
];

// One screen for each medication the user picked. A single medication looks
// exactly like the old single screen, and a second one adds a second screen.
// The dose field starts empty on every one of them: the user types the dose,
// Poke does not offer one.
export default function ScheduleScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const index = Number.parseInt(params.index ?? '0', 10);

  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const schedules = useOnboardingStore((state) => state.schedules);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const prepareSchedules = useOnboardingStore((state) => state.prepareSchedules);
  const setScheduleDose = useOnboardingStore((state) => state.setScheduleDose);
  const setScheduleUnit = useOnboardingStore((state) => state.setScheduleUnit);
  const setScheduleRoute = useOnboardingStore((state) => state.setScheduleRoute);
  const setScheduleFrequency = useOnboardingStore((state) => state.setScheduleFrequency);
  const setShotDay = useOnboardingStore((state) => state.setShotDay);
  const transition = useOnboardingTransition();

  useEffect(() => {
    prepareSchedules();
  }, [prepareSchedules]);

  const total = medicationIds.length;
  const totalSteps = onboardingTotalSteps();
  const step = scheduleStepIndex(Number.isFinite(index) ? index : 0, total);
  const medicationId = Number.isInteger(index) && index >= 0 ? medicationIds[index] : undefined;
  const schedule = medicationId ? schedules[medicationId] : undefined;

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

  const name = medicationDisplayName(medicationId, customMedicationName);
  const preset = medicationId === CUSTOM_MEDICATION_ID ? undefined : getPreset(medicationId);
  const isCustom = medicationId === CUSTOM_MEDICATION_ID;
  const isLast = index >= total - 1;
  const dose = Number.parseFloat(schedule.doseText);
  const canContinue = Number.isFinite(dose) && dose > 0;

  const goNext = () => {
    if (isLast) {
      // The first screen of the post-schedule run. Its name lives in one place,
      // so adding a step at the front of that run cannot orphan this jump.
      transition.go(POST_SCHEDULE_ROUTES['last-shot']);
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
      subtitle={total > 1
        ? `Medication ${index + 1} of ${total}. Set the dose and the schedule.`
        : `Set the usual dose and schedule for ${name}.`}
      footer={(
        <Button disabled={!canContinue} onPress={goNext}>
          {isLast ? 'Continue' : 'Next medication'}
        </Button>
      )}
    >
      <View style={styles.section}>
        <Text variant="smallStrong">Dose</Text>
        <View style={styles.doseRow}>
          <View style={styles.doseInput}>
            <Input
              value={schedule.doseText}
              onChangeText={(value) => setScheduleDose(medicationId, value)}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="Enter a number"
              accessibilityLabel={`Dose for ${name}`}
            />
          </View>
          <View style={styles.unitRow}>
            {UNITS.map((unit) => (
              <ChoicePill
                key={unit}
                label={unit}
                selected={schedule.unit === unit}
                onPress={() => setScheduleUnit(medicationId, unit)}
              />
            ))}
          </View>
        </View>
      </View>

      {isCustom ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Injection route</Text>
          <View style={styles.wrapRow}>
            {ROUTES.map((route) => (
              <ChoicePill
                key={route.id}
                label={route.label}
                selected={schedule.route === route.id}
                onPress={() => setScheduleRoute(medicationId, route.id)}
              />
            ))}
          </View>
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

      {schedule.frequencyKind !== 'daily' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Next shot day</Text>
          <View style={styles.dayRow}>
            {SHOT_DAY_OPTIONS.map((day) => (
              <ChoicePill
                key={day.value}
                label={day.shortLabel}
                selected={schedule.shotDay === day.value}
                onPress={() => setShotDay(medicationId, day.value)}
                style={styles.dayPill}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Say here, once, where the level curve comes from — or that there will
          not be one. It is the last screen before the plan is built. */}
      {preset ? (
        <Text variant="small" color={colors.inkMuted}>
          {preset.evidence === 'unsourced'
            ? `${preset.source} Poke shows your shots for ${name} without a level curve.`
            : `Level curve source: ${preset.source}`}
        </Text>
      ) : (
        <Text variant="small" color={colors.inkMuted}>
          Poke has no half-life for a custom medication. Poke shows your shots without a
          level curve. You can add a half-life later in Medications.
        </Text>
      )}

      {index === 0 && !isLast ? (
        <Text variant="small" color={colors.inkMuted}>
          Next you check the other {total - 1 === 1 ? 'medication' : `${total - 1} medications`}.
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  doseRow: {
    gap: spacing.md,
  },
  doseInput: {
    width: '100%',
  },
  unitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayPill: {
    flex: 1,
    paddingHorizontal: 0,
  },
});
