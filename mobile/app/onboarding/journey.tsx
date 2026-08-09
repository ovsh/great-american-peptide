import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { OnboardingScreen, SelectionCard } from '@/components/OnboardingScreen';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import {
  JOURNEY_OPTIONS,
  onboardingTotalSteps,
  useOnboardingStore,
} from '@/stores/onboarding';
import { spacing } from '@/theme';

// Step 1, and the only branch in the flow. The answer changes the wording of the
// medication question on the next screen, exactly as it does in the recording:
// "taking" against "plan to use". Nothing else in the run depends on it.
export default function JourneyScreen() {
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const setJourneyStage = useOnboardingStore((state) => state.setJourneyStage);
  const transition = useOnboardingTransition();

  return (
    <OnboardingScreen
      step={1}
      totalSteps={onboardingTotalSteps()}
      backHref="/onboarding/privacy"
      transition={transition}
      title="Have you started yet?"
      subtitle="Your answer changes the next question."
      footer={(
        <Button
          disabled={!journeyStage}
          onPress={() => transition.go('/onboarding/taking')}
        >
          Continue
        </Button>
      )}
    >
      <View style={styles.list}>
        {JOURNEY_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            compact
            title={option.label}
            selected={journeyStage === option.id}
            onPress={() => setJourneyStage(option.id)}
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
