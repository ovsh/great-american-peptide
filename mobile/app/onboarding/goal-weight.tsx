import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/Input';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function GoalWeightScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);

  const current = Number.parseFloat(weight.currentText);
  const goal = Number.parseFloat(weight.goalText);
  const canContinue = Number.isFinite(goal) && goal > 0;
  const distance = Number.isFinite(current) && canContinue ? Math.abs(current - goal) : null;

  return (
    <OnboardingStep
      step="goal-weight"
      title="What is your goal weight?"
      subtitle="Poke measures the distance between the two numbers."
      canContinue={canContinue}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setWeightValue('goal', '');
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <Input
          size="lg"
          value={weight.goalText}
          onChangeText={(value) => setWeightValue('goal', value)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={`Your goal in ${weight.unit}`}
          returnKeyType="done"
          accessibilityLabel="Goal weight"
        />
        {distance !== null ? (
          <Text variant="small" color={colors.inkMuted}>
            That is {formatDistance(distance)} {weight.unit} from where you are today.
          </Text>
        ) : null}
      </View>
    </OnboardingStep>
  );
}

function formatDistance(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.md,
  },
});
