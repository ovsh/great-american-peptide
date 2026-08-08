import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/Input';
import { ChoicePill } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import type { WeightUnit } from '@/domain/units';
import { useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

const UNITS: readonly WeightUnit[] = ['lb', 'kg'];

export default function WeightScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightUnit = useOnboardingStore((state) => state.setWeightUnit);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);

  const parsed = Number.parseFloat(weight.currentText);
  const canContinue = Number.isFinite(parsed) && parsed > 0;

  return (
    <OnboardingStep
      step="weight"
      title="What do you weigh right now?"
      subtitle="This is your starting point. You can change this number whenever you weigh yourself."
      canContinue={canContinue}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setWeightValue('current', '');
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <Input
          size="lg"
          value={weight.currentText}
          onChangeText={(value) => setWeightValue('current', value)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={`Your weight in ${weight.unit}`}
          returnKeyType="done"
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
