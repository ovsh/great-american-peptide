import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/Input';
import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import type { HeightUnit } from '@/domain/units';
import { useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly { id: HeightUnit; label: string }[] = [
  { id: 'in', label: 'inches' },
  { id: 'cm', label: 'cm' },
];

export default function HeightScreen() {
  const height = useOnboardingStore((state) => state.height);
  const setHeightUnit = useOnboardingStore((state) => state.setHeightUnit);
  const setHeightValue = useOnboardingStore((state) => state.setHeightValue);

  const value = height.valueText;
  const parsed = Number.parseFloat(value);
  const canContinue = Number.isFinite(parsed) && parsed > 0;

  return (
    <OnboardingStep
      step="height"
      title="How tall are you?"
      // The one number in this run that Poke does arithmetic with beyond the
      // weight pair: height plus weight is a BMI, and a BMI is a formula, not a
      // guess about a body.
      subtitle="Poke needs your height and your weight for a BMI. Skip it and Poke shows no BMI."
      canContinue={canContinue}
      // The skip clears the field rather than setting a flag. An empty string is
      // the only record of a skip anywhere in the draft, so a user who types a
      // height, goes back, then skips does not leave a stale number behind.
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setHeightValue('');
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <Input
          size="lg"
          value={value}
          onChangeText={setHeightValue}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={height.unit === 'in' ? 'Your height in inches' : 'Your height in cm'}
          returnKeyType="done"
          accessibilityLabel="Height"
        />
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
