import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info, ShieldCheck, Star } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { WelcomeLevelCurve } from '@/components/welcome-level-curve';
import {
  colors,
  easing,
  fonts,
  motion,
  radius,
  rise,
  spacing,
  timeTo,
  welcomeBeats,
} from '@/theme';

/**
 * Which card sits between the curve and the button.
 *
 * `trust` is what ships. It is the one claim Poke can make from its own
 * architecture and check by reading its own code: there is no account and there
 * is no network call.
 *
 * `tester` is the shape the card would take once real beta feedback exists. It
 * is inert until then — see `TESTER_QUOTE` — and switching this constant on its
 * own changes nothing on screen.
 *
 * Poke never renders an App Store rating, a rating count, or a review it did not
 * receive. There is no variant of this screen that does.
 */
type WelcomeProof = 'trust' | 'tester';
const WELCOME_PROOF: WelcomeProof = 'trust';

/**
 * These two may only ever be filled with a real, attributable quote from a real
 * beta tester who agreed to be quoted, together with the handle that tester
 * chose. Not a paraphrase, not a composite, not something written to sound like
 * one. While either is empty the `tester` variant renders the `trust` card
 * instead, so an unfinished edit cannot ship a fabricated review by accident.
 *
 * The five stars belong to the quoted tester. They are not a store rating and
 * they must never be presented as an average.
 */
const TESTER_QUOTE: string = '';
const TESTER_HANDLE: string = '';

/** The line Poke may never drop, wherever it puts it. */
const ESTIMATE_DISCLAIMER = 'Estimate only. Do not use it to make dosing decisions.';

/**
 * The poster plays once per cold run of the app. The privacy screen's back
 * chevron replaces this route, so without this flag every step backwards would
 * redraw the curve from nothing and the entrance would become a loop.
 */
let arrived = false;

/**
 * Screen zero: what Poke is, in one image and two lines.
 *
 * The image is the estimated level curve, drawing itself. It is the one picture
 * only this category owns, and it says what the app gives back before a word is
 * read. The headline sits on top of the canvas rather than above it, in the
 * space the curve's own peaks leave clear.
 *
 * The button is not `Log my first shot`, which copy.md would otherwise ask for,
 * because this button does not log a shot: the next screen is a promise about
 * where answers go, and the log is several screens further on. `Start my shot
 * log` names the thing the run ends in and stays inside the app's vocabulary.
 */
export default function WelcomeScreen() {
  const transition = useOnboardingTransition();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [hero, setHero] = useState({ width: 0, height: 0 });
  const [headFoot, setHeadFoot] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);

  const first = useRef<boolean | null>(null);
  if (first.current === null) {
    first.current = !arrived;
    arrived = true;
  }
  const play = first.current && !reduced;

  // The mock's 45 px is a comp on a fixed 393 pt canvas. Two lines of a headline
  // this size have to fit the narrowest phone Poke supports without hyphenating,
  // so the size is read off the width. "and peptide shots." is the longer line
  // and it governs: about nine and a half ems of Inter at this weight.
  const headlineSize = Math.round(clamp((width - spacing.screen * 2) / 9.4, 27, 38));
  const headlineLine = Math.round(headlineSize * 1.12);

  const proof = WELCOME_PROOF === 'tester' && TESTER_QUOTE !== '' && TESTER_HANDLE !== ''
    ? 'tester'
    : 'trust';

  return (
    <View testID="welcome-screen" style={styles.root}>
      <RNAnimated.View style={[styles.body, { opacity: transition.opacity }]}>
        <View style={[styles.wordmarkRow, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.wordmark}>Poke</Text>
          <View style={styles.wordmarkDot} />
        </View>

        <View
          style={styles.hero}
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            setHero((current) => (current.width === w && current.height === h ? current : { width: w, height: h }));
          }}
        >
          {/* The headline comes first so a screen reader reads the words before
              the picture, and sits on top through `zIndex` rather than through
              tree order, which is what the mock's own z-index does. */}
          <View
            testID="welcome-headline"
            style={styles.head}
            onLayout={(event) => {
              const foot = event.nativeEvent.layout.y + event.nativeEvent.layout.height;
              setHeadFoot((current) => (current === foot ? current : foot));
            }}
          >
            <HeadlineLine
              delay={welcomeBeats.headline}
              play={play}
              size={headlineSize}
              lineHeight={headlineLine}
            >
              Track your GLP-1
            </HeadlineLine>
            <HeadlineLine
              delay={welcomeBeats.headline + welcomeBeats.headlineStep}
              play={play}
              size={headlineSize}
              lineHeight={headlineLine}
              color={colors.successDeep}
            >
              and peptide shots.
            </HeadlineLine>
            <Enter delay={welcomeBeats.support} play={play} travel={rise.line}>
              <Text color={colors.inkMuted} style={styles.support}>
                Log each injection. Poke keeps the dose, the day, the site, and your estimated level.
              </Text>
            </Enter>
          </View>

          <View
            testID="welcome-curve"
            style={styles.canvas}
            accessible
            accessibilityRole="image"
            accessibilityLabel="An estimated level curve climbing over four weekly shots."
          >
            <WelcomeLevelCurve
              width={hero.width}
              height={hero.height}
              peakTop={headFoot + spacing.md}
              play={play}
            />
          </View>
        </View>

        {/* Legal copy does not move, so this row takes no delay and no travel. */}
        <Pressable
          testID="welcome-estimate-info"
          accessibilityRole="button"
          accessibilityLabel="About this estimate"
          hitSlop={10}
          onPress={() => setAboutOpen(true)}
          style={({ pressed }) => [styles.captionRow, pressed && styles.pressed]}
        >
          <View style={styles.infoDot}>
            <Info size={12} color={colors.inkMuted} />
          </View>
          <Text variant="caption" color={colors.inkMuted}>Estimated level between shots</Text>
        </Pressable>

        <Enter delay={welcomeBeats.proof} play={play} travel={rise.card} style={styles.proofSlot}>
          {proof === 'tester' ? <TesterCard /> : <TrustCard />}
        </Enter>
      </RNAnimated.View>

      {/* Outside the fading body: the primary action holds still through every
          transition, exactly as it does on every other onboarding screen. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <View testID="welcome-cta">
          <Button onPress={() => transition.go('/onboarding/privacy')}>Start my shot log</Button>
        </View>
      </View>

      <BottomSheet
        visible={aboutOpen}
        title="About this estimate"
        onClose={() => setAboutOpen(false)}
      >
        <View style={styles.aboutBody}>
          <Text>{ESTIMATE_DISCLAIMER}</Text>
          <Text variant="smallStrong">The curve on this screen is an example shape.</Text>
          <Text variant="small" color={colors.inkMuted}>
            In the app, Poke draws this line from the shots you log and the half-life saved with the
            medication, and it names the evidence behind that half-life.
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}

/**
 * What ships. No stars and no numbers, because the only proof Poke has on a
 * first run is the way it is built, and that is a sentence it can keep.
 */
function TrustCard() {
  return (
    <View testID="welcome-proof">
      <Card padding="lg" style={styles.proofCard}>
        <View style={styles.proofBadge}>
          <ShieldCheck size={20} color={colors.accent} />
        </View>
        <Text variant="smallStrong" style={styles.proofLabel}>
          No account. Nothing leaves this phone.
        </Text>
      </Card>
    </View>
  );
}

/**
 * Unreachable until a real tester quote exists. Before it is ever switched on it
 * has to be read against the reviewer's checklist again: three stacked text
 * lines is a redesign trigger, and this card has them.
 */
function TesterCard() {
  return (
    <View testID="welcome-proof">
      <Card padding="lg" style={styles.testerCard}>
        <View style={styles.testerHead}>
          <View style={styles.stars} accessibilityElementsHidden importantForAccessibility="no">
            {[0, 1, 2, 3, 4].map((index) => (
              <Star key={index} size={14} color={colors.accent} fill={colors.accent} />
            ))}
          </View>
          <Text variant="smallStrong">Early tester reviews</Text>
        </View>
        <Text variant="small">{TESTER_QUOTE}</Text>
        <Text variant="caption" color={colors.inkMuted}>{TESTER_HANDLE}</Text>
      </Card>
    </View>
  );
}

/**
 * One headline line rising out of its own clip. The clip is a still box and only
 * the text inside it moves, so this stays transform-only.
 */
function HeadlineLine({
  children,
  delay,
  play,
  size,
  lineHeight,
  color = colors.ink,
}: {
  children: string;
  delay: number;
  play: boolean;
  size: number;
  lineHeight: number;
  color?: string;
}) {
  const shift = useSharedValue(play ? 1 : 0);

  useEffect(() => {
    shift.value = timeTo(0, {
      duration: motion.slow,
      easing: easing.out,
      delay,
      reduced: !play,
    });
  }, [delay, play, shift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value * (lineHeight + HEADLINE_CLIP_SLACK) }],
  }));

  return (
    <View style={[styles.headlineClip, { height: lineHeight + HEADLINE_CLIP_SLACK }]}>
      <Animated.View style={style}>
        <Text
          numberOfLines={1}
          color={color}
          style={[
            styles.headline,
            { fontSize: size, lineHeight, letterSpacing: -size * 0.042 },
          ]}
        >
          {children}
        </Text>
      </Animated.View>
    </View>
  );
}

/** The app's plain arrival: up by a card or a line, and in. */
function Enter({
  children,
  delay,
  play,
  travel,
  style,
}: {
  children: ReactNode;
  delay: number;
  play: boolean;
  travel: number;
  style?: StyleProp<ViewStyle>;
}) {
  const enter = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    enter.value = timeTo(1, {
      duration: motion.base,
      easing: easing.out,
      delay,
      reduced: !play,
    });
  }, [delay, enter, play]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * travel }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Room for the descenders of "your" and "peptide" inside the clip. */
const HEADLINE_CLIP_SLACK = 4;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screen,
  },
  wordmark: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.63,
    color: colors.ink,
  },
  wordmarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 6,
    marginLeft: 2,
  },
  // The canvas and the words share this box. The curve's peaks stay under the
  // support line, so the overlap is composition rather than collision.
  hero: {
    flex: 1,
    position: 'relative',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  head: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    top: spacing.lg,
    zIndex: 1,
  },
  headlineClip: {
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  headline: {
    fontFamily: fonts.sansSemiBold,
  },
  support: {
    marginTop: spacing.md,
    maxWidth: 300,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.sm,
    minHeight: 28,
    paddingHorizontal: spacing.screen,
  },
  infoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  proofSlot: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  proofCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  proofBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofLabel: {
    flex: 1,
  },
  testerCard: {
    gap: spacing.sm,
  },
  testerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  aboutBody: {
    gap: spacing.md,
  },
});
