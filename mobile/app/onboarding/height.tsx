import { StyleSheet, View } from 'react-native';

import { HeightPicker } from '@/components/HeightPicker';
import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import type { HeightUnit } from '@/domain/units';
import { useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly { id: HeightUnit; label: string }[] = [
  { id: 'in', label: 'feet and inches' },
  { id: 'cm', label: 'cm' },
];

export default function HeightScreen() {
  const height = useOnboardingStore((state) => state.height);
  const setHeightUnit = useOnboardingStore((state) => state.setHeightUnit);
  const setHeightValue = useOnboardingStore((state) => state.setHeightValue);

  return (
    <OnboardingStep
      step="height"
      title="How tall are you?"
      // The one number in this run that Poke does arithmetic with beyond the
      // weight pair: height plus weight is a BMI, and a BMI is a formula, not a
      // guess about a body.
      subtitle="Poke needs your height and your weight for a BMI. Skip it and Poke shows no BMI."
      // The wheel rests on a middle row so it does not open on 4 ft 0 in, and it
      // writes nothing until a finger settles it. A BMI on the plan card built
      // from a row the user never touched would be a made-up number.
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
