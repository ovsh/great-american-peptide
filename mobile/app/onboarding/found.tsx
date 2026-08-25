import { StyleSheet, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import { SelectionCard } from '@/components/OnboardingScreen';
import { OnboardingStep } from '@/components/OnboardingStep';
import { track } from '@/services/analytics';
import { FOUND_OPTIONS, useOnboardingStore, type FoundChannel } from '@/stores/onboarding';
import { colors, spacing, text } from '@/theme';

/**
 * The mark in front of every answer, keyed on `FoundChannel`, so a channel added
 * to the store without a mark does not compile.
 *
 * FontAwesome 6 rather than lucide, which draws the rest of the app: lucide
 * carries no TikTok, no Reddit and no App Store mark, and a list where five rows
 * show the real logo and three show a stand-in reads as a defect. One set for
 * the whole list also keeps the eight marks at one weight.
 *
 * `brand` picks the Brands face and the rest come from Solid. The three answers
 * that name no product get a plain glyph, because a friend has no logo.
 */
const CHANNEL_GLYPHS: Record<FoundChannel, { name: string; brand: boolean }> = {
  app_store: { name: 'app-store-ios', brand: true },
  tiktok: { name: 'tiktok', brand: true },
  instagram: { name: 'instagram', brand: true },
  youtube: { name: 'youtube', brand: true },
  reddit: { name: 'reddit-alien', brand: true },
  creator: { name: 'bullhorn', brand: false },
  friend: { name: 'user-group', brand: false },
  other: { name: 'ellipsis', brand: false },
};

/** One size for all eight, so a column of different logos reads as one column. */
const GLYPH_SIZE = text.h2.fontSize;

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
        {FOUND_OPTIONS.map((option) => {
          const glyph = CHANNEL_GLYPHS[option.id];
          const selected = foundChannel === option.id;
          return (
            <SelectionCard
              key={option.id}
              title={option.label}
              compact
              role="radio"
              leading={(
                <FontAwesome6
                  name={glyph.name}
                  brand={glyph.brand}
                  solid={!glyph.brand}
                  size={GLYPH_SIZE}
                  color={selected ? colors.accent : colors.inkMuted}
                />
              )}
              selected={selected}
              onPress={() => setFoundChannel(option.id)}
            />
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
