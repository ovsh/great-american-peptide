import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeightPicker } from '@/components/HeightPicker';
import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import type { HeightUnit } from '@/domain/units';
import { HEIGHT_REST, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly { id: HeightUnit; label: string }[] = [
  { id: 'in', label: 'feet and inches' },
  { id: 'cm', label: 'cm' },
];

export default function HeightScreen() {
  const height = useOnboardingStore((state) => state.height);
  const setHeightUnit = useOnboardingStore((state) => state.setHeightUnit);
  const setHeightValue = useOnboardingStore((state) => state.setHeightValue);

  // The row under the band is the answer, so the store agrees with the wheel
  // from the first frame and Continue is live on arrival. Mount only: the skip
  // below clears the answer, and an effect that watched the value would write
  // the resting row straight back over the skip. `birthday` does the same.
  useEffect(() => {
    if (height.value === null) setHeightValue(HEIGHT_REST[height.unit]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingStep
      step="height"
      title="How tall are you?"
      subtitle="Skip it and Poke shows no BMI."
      canContinue={height.value !== null}
      // The skip clears the answer rather than setting a flag. Null is the only
      // record of a skip anywhere in the draft, so a user who sets a height,
      // goes back, then skips does not leave a stale number behind.
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setHeightValue(null);
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <HeightPicker unit={height.unit} value={height.value} onChange={setHeightValue} />
        <View style={styles.units}>
          {UNITS.map((unit) => (
            <ChoicePill
              key={unit.id}
              label={unit.label}
              selected={height.unit === unit.id}
              onPress={() => setHeightUnit(unit.id)}
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
