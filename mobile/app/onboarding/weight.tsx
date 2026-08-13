import { useEffect } from 'react';
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

  // The row under the band is the answer, so the store agrees with the wheel
  // from the first frame and Continue is live on arrival. Mount only: the skip
  // below clears the answer, and an effect that watched the value would write
  // the resting row straight back over the skip. `birthday` does the same.
  useEffect(() => {
    if (weight.current === null) setWeightValue('current', WEIGHT_REST[weight.unit]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingStep
      step="weight"
      title="What do you weigh right now?"
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
