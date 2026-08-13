import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { WeightPicker } from '@/components/WeightPicker';
import { WEIGHT_REST, useOnboardingStore } from '@/stores/onboarding';
import { colors, spacing } from '@/theme';

export default function GoalWeightScreen() {
  const weight = useOnboardingStore((state) => state.weight);
  const setWeightValue = useOnboardingStore((state) => state.setWeightValue);

  const rest = weight.current ?? WEIGHT_REST[weight.unit];
  const distance = weight.current !== null && weight.goal !== null
    ? Math.abs(weight.current - weight.goal)
    : null;

  // The row under the band is the answer, so the store agrees with the wheel
  // from the first frame and Continue is live on arrival. Mount only: the skip
  // below clears the answer, and an effect that watched the value would write
  // the resting row straight back over the skip. `birthday` does the same.
  useEffect(() => {
    if (weight.goal === null) setWeightValue('goal', rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingStep
      step="goal-weight"
      title="What is your goal weight?"
      canContinue={weight.goal !== null}
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setWeightValue('goal', null);
          advance();
        },
      }}
    >
      <View style={styles.field}>
        <WeightPicker
          unit={weight.unit}
          value={weight.goal}
          // The wheel rests on the weight the user has just given, so the scroll
          // starts from where they are. Resting it below that would be Poke
          // pointing at a target, and Poke does not pick the target.
          rest={rest}
          onChange={(value) => setWeightValue('goal', value)}
          accessibilityLabel="Goal weight"
        />
        {/* The wheel opens on today's weight, and "0 lb from where you are" is
            not a distance, so the line waits until the two numbers differ. */}
        {distance !== null && distance > 0 ? (
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
