import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { JOURNEY_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

// One of the two answers that change the length of the run. It changes the
// wording of the medication question on the next screen, exactly as it does in
// the recording: "taking" against "plan to use". It also takes the last-shot
// question out of the run for a user who has not started. See
// `postScheduleOrder`.
export default function JourneyScreen() {
  const journeyStage = useOnboardingStore((state) => state.journeyStage);
  const setJourneyStage = useOnboardingStore((state) => state.setJourneyStage);

  return (
    <OnboardingStep
      step="journey"
      title="Have you started yet?"
      canContinue={!!journeyStage}
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
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
