import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { LAST_SHOT_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

export default function LastShotScreen() {
  const lastShot = useOnboardingStore((state) => state.lastShot);
  const setLastShot = useOnboardingStore((state) => state.setLastShot);

  return (
    <OnboardingStep
      step="last-shot"
      title="When was your last shot?"
      // Today and yesterday are exact, so Poke starts the level curve from them.
      // The vaguer answers are stored and nothing is drawn from them, because a
      // curve drawn from "earlier this week" is a curve drawn from a guess.
      subtitle="A rough answer is fine."
      canContinue={lastShot !== null}
    >
      <View style={styles.list}>
        {LAST_SHOT_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            compact
            title={option.label}
            selected={lastShot === option.id}
            onPress={() => setLastShot(option.id)}
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
