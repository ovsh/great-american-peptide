import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoicePill, OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { getPreset, type Route, type Unit } from '@/domain/peptides';
import {
  SHOT_DAY_OPTIONS,
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

export default function ScheduleScreen() {
  const schedule = useOnboardingStore((state) => state.schedule);
  const customMedicationName = useOnboardingStore((state) => state.customMedicationName);
  const prepareSchedule = useOnboardingStore((state) => state.prepareSchedule);
  const setScheduleDose = useOnboardingStore((state) => state.setScheduleDose);
  const setScheduleUnit = useOnboardingStore((state) => state.setScheduleUnit);
  const setScheduleRoute = useOnboardingStore((state) => state.setScheduleRoute);
  const setScheduleFrequency = useOnboardingStore((state) => state.setScheduleFrequency);
  const setShotDay = useOnboardingStore((state) => state.setShotDay);

  useEffect(() => {
    prepareSchedule();
  }, [prepareSchedule]);

  if (schedule.kind !== 'ready') {
    return (
      <OnboardingScreen
        step={2}
        backHref="./taking"
        title="When's shot day?"
        footer={<Button onPress={() => router.replace('/onboarding/taking')}>Choose a medication</Button>}
      >
        <Text color={colors.inkMuted}>Choose a medication before you set a schedule.</Text>
      </OnboardingScreen>
    );
  }

  const primaryName = schedule.primaryMedicationId === 'custom'
    ? customMedicationName.trim()
    : getPreset(schedule.primaryMedicationId)?.name ?? 'Primary medication';
  const dose = Number.parseFloat(schedule.doseText);
  const canContinue = Number.isFinite(dose) && dose > 0;

  return (
    <OnboardingScreen
      step={2}
      backHref="./taking"
      title="When's shot day?"
      subtitle={`Set the usual dose and schedule for ${primaryName}.`}
      footer={<Button disabled={!canContinue} onPress={() => router.push('/onboarding/goal')}>Continue</Button>}
    >
      <View style={styles.section}>
        <Text variant="smallStrong">Dose</Text>
        <View style={styles.doseRow}>
          <View style={styles.doseInput}>
            <Input
              value={schedule.doseText}
              onChangeText={setScheduleDose}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="Dose"
            />
          </View>
          <View style={styles.unitRow}>
            {UNITS.map((unit) => (
              <ChoicePill
                key={unit}
                label={unit}
                selected={schedule.unit === unit}
                onPress={() => setScheduleUnit(unit)}
              />
            ))}
          </View>
        </View>
      </View>

      {schedule.primaryMedicationId === 'custom' ? (
        <View style={styles.section}>
          <Text variant="smallStrong">Injection route</Text>
          <View style={styles.wrapRow}>
            {ROUTES.map((route) => (
              <ChoicePill
                key={route.id}
                label={route.label}
                selected={schedule.route === route.id}
                onPress={() => setScheduleRoute(route.id)}
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
              onPress={() => setScheduleFrequency(frequency.id)}
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
                onPress={() => setShotDay(day.value)}
                style={styles.dayPill}
              />
            ))}
          </View>
        </View>
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayPill: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
});
