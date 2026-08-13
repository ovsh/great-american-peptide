import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { CONCERN_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function ConcernsScreen() {
  const concerns = useOnboardingStore((state) => state.concerns);
  const toggleConcern = useOnboardingStore((state) => state.toggleConcern);

  return (
    <OnboardingStep
      step="concerns"
      title="What do you want to keep an eye on?"
      // Poke stores the list and shows it back on the plan. Nothing in the app
      // reorders anything from it yet, so this line does not say that it does.
      subtitle="Pick as many as you like."
      canContinue={concerns.length > 0}
    >
      <View style={styles.list}>
        {CONCERN_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            compact
            title={option.label}
            selected={concerns.includes(option.id)}
            onPress={() => toggleConcern(option.id)}
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
