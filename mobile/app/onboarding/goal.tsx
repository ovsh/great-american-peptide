import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { GOAL_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function GoalScreen() {
  const goalKind = useOnboardingStore((state) => state.goalKind);
  const setGoalKind = useOnboardingStore((state) => state.setGoalKind);

  return (
    <OnboardingStep
      step="goal"
      title="What brings you to Poke?"
      // Today has no goal-ordered card stack, so this answer does not reorder
      // anything. It appears on the plan card and is written to `goal_kind`.
      subtitle="Poke puts your goal on your plan and keeps it with your log."
      canContinue={!!goalKind}
    >
      <View style={styles.list}>
        {GOAL_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            title={option.label}
            description={option.description}
            selected={goalKind === option.id}
            onPress={() => setGoalKind(option.id)}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
