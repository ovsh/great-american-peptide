import { StyleSheet, View } from 'react-native';

import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { WeightPicker } from '@/components/WeightPicker';
import type { WeightUnit } from '@/domain/units';
import { WEIGHT_REST, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly WeightUnit[] = ['lb', 'kg'];

export default function WeightScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightUnit = useOnboardingStore((state) => state.setWeightUnit);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);

  return (
    <OnboardingStep
      step="weight"
      title="What do you weigh right now?"
      subtitle="This is your starting point. You can change this number whenever you weigh yourself."
      // The resting row is a place to start scrolling from and not an answer.
      // The plan card draws a line between this number and the goal, so Continue
      // waits until the wheel has been settled.
      canContinue={weight.current !== null}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setWeightValue('current', null);
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <WeightPicker
          unit={weight.unit}
          value={weight.current}
          rest={WEIGHT_REST[weight.unit]}
          onChange={(value) => setWeightValue('current', value)}
          accessibilityLabel="Current weight"
        />
        <View style={styles.units}>
          {UNITS.map((unit) => (
            <ChoicePill
              key={unit}
              label={unit}
              selected={weight.unit === unit}
              onPress={() => setWeightUnit(unit)}
            />
          ))}
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.md,
  },
  units: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
