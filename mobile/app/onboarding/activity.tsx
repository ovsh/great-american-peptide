import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { ACTIVITY_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function ActivityScreen() {
  const activityLevel = useOnboardingStore((state) => state.activityLevel);
  const setActivityLevel = useOnboardingStore((state) => state.setActivityLevel);

  return (
    <OnboardingStep
      step="activity"
      title="How much do you move in a normal week?"
      // The hedge is the whole line. Poke stores this answer and reads it back
      // nowhere, so a sentence about where it is kept was padding in front of
      // the one sentence that carries a claim.
      subtitle="Poke works out no calorie budget from this."
      canContinue={activityLevel !== null}
    >
      <View style={styles.list}>
        {ACTIVITY_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            title={option.label}
            description={option.description}
            selected={activityLevel === option.id}
            onPress={() => setActivityLevel(option.id)}
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
