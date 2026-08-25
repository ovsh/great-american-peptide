import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { EXPERIENCE_OPTIONS, useOnboardingStore } from '@/stores/onboarding';
import { spacing } from '@/theme';

// The question that sets the length of the rest of the run. `postScheduleOrder`
// reads the answer and keeps five teach screens, two of them, or none.
//
// Each card says what Poke will do about the answer, so the user picks a
// consequence rather than a label about themselves. The bar at the top moves
// the moment the pick lands, which is the flow showing that it heard.
export default function KnowledgeScreen() {
  const experienceLevel = useOnboardingStore((state) => state.experienceLevel);
  const setExperienceLevel = useOnboardingStore((state) => state.setExperienceLevel);

  return (
    <OnboardingStep
      step="knowledge"
      title="How well do you know injections?"
      canContinue={experienceLevel !== null}
      // Null is the record of a skip, and `postScheduleOrder` runs it as
      // `basics`. The middle answer assumes least about somebody who told Poke
      // nothing. Clearing rather than flagging means a user who picks, goes
      // back, then skips leaves no stale answer behind.
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setExperienceLevel(null);
          advance();
        },
      }}
    >
      <View style={styles.list}>
        {EXPERIENCE_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            title={option.label}
            description={option.description}
            selected={experienceLevel === option.id}
            onPress={() => setExperienceLevel(option.id)}
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
