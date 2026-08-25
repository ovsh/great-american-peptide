import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { track } from '@/services/analytics';
import { FOUND_OPTIONS, useOnboardingStore, type FoundChannel } from '@/stores/onboarding';
import { spacing } from '@/theme';

// The answer that is reported once, on the way out.
//
// A tap is not an answer yet: a user reads eight rows and presses two of them
// before they settle, and three events for one person would read as three
// people. Continue is the moment the answer is theirs, so that is where the
// event goes.
//
// A module value rather than a ref, because the back chevron unmounts this
// screen and a fresh ref would report the same pick again on the way forward.
// Changing the pick on a second pass is a different answer and it reports
// again, which is right: the user changed their mind about a fact.
let reported: FoundChannel | null = null;

/**
 * The one screen in the flow that asks about Poke rather than about the user.
 *
 * It is also the only screen that sends a content event. The channel id travels
 * and nothing else does; see the rule at the top of `services/analytics.ts`.
 */
export default function FoundScreen() {
  const foundChannel = useOnboardingStore((state) => state.foundChannel);
  const setFoundChannel = useOnboardingStore((state) => state.setFoundChannel);

  return (
    <OnboardingStep
      step="found"
      title="How did you find Poke?"
      canContinue={foundChannel !== null}
      onContinue={(advance) => {
        if (foundChannel !== null && foundChannel !== reported) {
          reported = foundChannel;
          track('onboarding_channel_picked', { channel: foundChannel });
        }
        advance();
      }}
      // A skip sends nothing at all. Poke would rather count no answer than
      // count a guess, and null is the record that the user passed.
      secondary={{
        label: 'Skip this',
        onPress: (advance) => {
          setFoundChannel(null);
          advance();
        },
      }}
    >
      <View style={styles.list}>
        {FOUND_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            role="radio"
            compact
            title={option.label}
            selected={foundChannel === option.id}
            onPress={() => setFoundChannel(option.id)}
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
