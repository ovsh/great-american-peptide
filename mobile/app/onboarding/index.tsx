import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ChartLine, ShieldCheck, Syringe, Zap } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { colors, radius, spacing } from '@/theme';

const ICON_SIZE = 34;

// Four slides, in the recording's four positions: what the app is, how little
// work it asks for, what it gives back, and why you would trust it with any of
// it. The last one is Poke's own: MeAgain closes on a mascot, and Poke has no
// mascot to close on.
const SLIDES = [
  {
    id: 'partner',
    icon: <Syringe size={ICON_SIZE} color={colors.accent} />,
    title: 'One app for your whole routine',
    body: 'Your doses, your shot days and the numbers you want to watch.',
  },
  {
    id: 'log',
    icon: <Zap size={ICON_SIZE} color={colors.accent} />,
    title: 'Log a shot in seconds',
    body: 'Poke already knows your dose and your site. Two taps and you are back to your day.',
  },
  {
    id: 'progress',
    icon: <ChartLine size={ICON_SIZE} color={colors.accent} />,
    title: 'See how far you have come',
    body: 'Your levels, your weight and every shot you logged. Poke draws all of it from your own entries.',
  },
  {
    id: 'private',
    icon: <ShieldCheck size={ICON_SIZE} color={colors.accent} />,
    title: 'Nobody sees this but you',
    body: 'No account, no sign-in, no server. What you log stays on this phone.',
  },
] as const;

export default function WelcomeScreen() {
  const transition = useOnboardingTransition();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  // Read the offset on every scroll frame, not on momentum end. iOS fires no
  // momentum end when the user drags a page across and lets go without a flick,
  // and a dot row that misses that gesture tells the user they are on slide one
  // while they are looking at slide two.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex((current) => (current === next ? current : next));
  };

  return (
    <OnboardingScreen
      step={0}
      totalSteps={1}
      hideProgress
      transition={transition}
      contentStyle={styles.content}
      bodyStyle={styles.body}
      footer={(
        <Button onPress={() => transition.go('/onboarding/privacy')}>Get started</Button>
      )}
    >
      <View style={styles.wordmarkRow}>
        <Text variant="display" style={styles.wordmark}>Poke</Text>
        <View style={styles.wordmarkDot} />
      </View>

      <View style={styles.pager} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {SLIDES.map((slide) => (
              <View key={slide.id} style={[styles.slide, { width }]}>
                <View style={styles.medallion}>{slide.icon}</View>
                <Text variant="display" align="center">{slide.title}</Text>
                <Text color={colors.inkMuted} align="center" style={styles.slideBody}>
                  {slide.body}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View
        style={styles.dots}
        accessibilityRole="tablist"
        accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}
      >
        {SLIDES.map((slide, position) => (
          <View
            key={slide.id}
            style={[styles.dot, position === index && styles.dotActive]}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  wordmarkRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  wordmark: {
    fontSize: 40,
    lineHeight: 46,
  },
  wordmarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 4,
    marginLeft: 2,
  },
  pager: {
    width: '100%',
    // Four slides of different lengths would otherwise change the page height on
    // every swipe, and the dots and the button would walk up and down with it.
    height: 300,
  },
  slide: {
    height: '100%',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  medallion: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  slideBody: {
    maxWidth: 320,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.ink,
  },
});
