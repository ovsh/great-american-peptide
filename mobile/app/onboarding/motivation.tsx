import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { MOTIVATION_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

// The one question in the run that is not about a number. It is here for the
// same reason MeAgain asks it: the flow has spent a long run of screens on data,
// and this is the screen that remembers who is filling it in.
export default function MotivationScreen() {
  const motivation = useOnboardingStore((state) => state.motivation);
  const setMotivation = useOnboardingStore((state) => state.setMotivation);

  return (
    <OnboardingStep
      step="motivation"
      title="And what is behind that goal?"
      subtitle="Pick the one closest to true."
      canContinue={motivation !== null}
    >
      <View style={styles.list}>
        {MOTIVATION_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            compact
            title={option.label}
            selected={motivation === option.id}
            onPress={() => setMotivation(option.id)}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
