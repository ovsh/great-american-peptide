import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoicePill, OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import type { WeightUnit } from '@/domain/units';
import {
  onboardingTotalSteps,
  postScheduleStepIndex,
  useOnboardingStore,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly WeightUnit[] = ['lb', 'kg'];

export default function WeightScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightUnit = useOnboardingStore((state) => state.setWeightUnit);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);
  const skipWeight = useOnboardingStore((state) => state.skipWeight);
  const currentText = weight.kind === 'entered' ? weight.currentText : '';
  const goalText = weight.kind === 'entered' ? weight.goalText : '';
  const current = Number.parseFloat(currentText);
  const goal = Number.parseFloat(goalText);
  const canContinue = Number.isFinite(current) && current > 0 && Number.isFinite(goal) && goal > 0;

  return (
    <OnboardingScreen
      step={postScheduleStepIndex(medicationIds.length, 'weight')}
      totalSteps={onboardingTotalSteps(medicationIds.length)}
      backHref="/onboarding/goal"
      title="Want to add your weight?"
      subtitle="Your weight gives the charts a starting point. You can skip this screen."
      footer={(
        <View style={styles.actions}>
          <Button disabled={!canContinue} onPress={() => router.push('/onboarding/concerns')}>
            Choose what to watch
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              skipWeight();
              router.push('/onboarding/concerns');
            }}
          >
            Skip this step
          </Button>
        </View>
      )}
    >
      <View style={styles.unitRow}>
        {UNITS.map((unit) => (
          <ChoicePill
            key={unit}
            label={unit}
            selected={weight.unit === unit}
            onPress={() => setWeightUnit(unit)}
          />
        ))}
      </View>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text variant="smallStrong">Current weight</Text>
          <Input
            value={currentText}
            onChangeText={(value) => setWeightValue('current', value)}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="Enter a number"
          />
        </View>
        <View style={styles.field}>
          <Text variant="smallStrong">Goal weight</Text>
          <Input
            value={goalText}
            onChangeText={(value) => setWeightValue('goal', value)}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="Enter a number"
          />
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  unitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fields: {
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  field: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
