import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { GOAL_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function GoalScreen() {
  const goalKind = useOnboardingStore((state) => state.goalKind);
  const setGoalKind = useOnboardingStore((state) => state.setGoalKind);
  return (
    <OnboardingScreen
      step={3}
      backHref="./schedule"
      title="What's the goal?"
      subtitle="Your answer helps Poke keep the right details up front."
      footer={<Button disabled={!goalKind} onPress={() => router.push('/onboarding/weight')}>Continue</Button>}
    >
      <View style={styles.list}>
        {GOAL_OPTIONS.map((goal) => (
          <SelectionCard
            key={goal.id}
            role="radio"
            title={goal.label}
            description={goal.description}
            selected={goalKind === goal.id}
            onPress={() => setGoalKind(goal.id)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
