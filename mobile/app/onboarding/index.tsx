import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated as RNAnimated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Info, Syringe } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useOnboardingTransition } from '@/components/onboardingTransition';
import { WelcomeLevelCurve } from '@/components/welcome-level-curve';
import { WelcomeSyringeArt } from '@/components/welcome-syringe-art';
import { SHOT_REMINDER_BODY, SHOT_REMINDER_TITLE } from '@/services/notifications';
import {
  colors,
  easing,
  fonts,
  motion,
  radius,
  rise,
  spacing,
  text,
  timeTo,
  welcomeBeats,
} from '@/theme';
import { fmtTime } from '@/utils/date';

/** The line Poke may never drop, wherever it puts it. */
const ESTIMATE_DISCLAIMER = 'Estimate only. Do not use it to make dosing decisions.';

/**
 * Poke never renders an App Store rating, a rating count, or a review it did not
 * receive. There is no variant of this screen that does. The only proof on a
 * first run is the way the app is built, and that is the line under the button.
 */
const TRUST_LINE = 'No account. Your health record stays on this phone.';

/**
 * Slide three's headline, broken by hand.
 *
 * The line carries two promises and each one is a sentence, so each one gets a
 * line. Left to wrap, `Track` lands at the end of the first line on a 6.1 inch
 * phone and the two promises read as one long clause instead of two short ones.
 * The break also holds the block at the two lines the headline box reserves, on
 * every width Poke supports.
 */
const REMINDER_HEADLINE = 'Never miss a shot.\nTrack every symptom.';

/**
 * The one claim the banner earns, and the only half of it Poke can keep.
 *
 * iOS writes the app's own name into every banner header, so a preview that
 * promised no name at all would promise something the platform overrides. The
 * medication is the part Poke controls, and `SHOT_REMINDER_BODY` never carries
 * it: the dose variant of that sentence names a number and a unit, never a
 * drug. This is the same sentence the permission step makes later.
 */
const BANNER_PRIVACY = 'The banner never names your medication.';

const SLIDE_COUNT = 3;

/**
 * How far down its own box the curve's tallest peak sits.
 *
 * The poster's own proportion is a little under half way, because there the
 * headline lay on top of the canvas and the curve had to keep under the words.
 * Here the words sit above the box and the whole of it belongs to the picture,
 * so the curve climbs and leaves only the headroom its top pin needs.
 */
const CURVE_PEAK_TOP = 0.3;

/**
 * How long one slide holds before the pager moves on. Long enough to read a
 * headline and a sentence, and short enough that all three land before a thumb
 * reaches the button.
 */
const SLIDE_HOLD_MS = 4000;

/**
 * The poster plays once per cold run of the app. The first question's back
 * chevron replaces this route, so without this flag every step backwards would
 * redraw the curve from nothing and the entrance would become a loop.
 */
let arrived = false;

/**
 * Set by the first touch on the pager, and never cleared. "Stops for good" has
 * to outlive the screen: a user who took the pager over, walked to the first
 * question and stepped back would otherwise find it moving on its own again.
 */
let interacted = false;

/**
 * Screen zero: what Poke is, in three pictures and three sentences.
 *
 * Each slide makes one claim and shows the thing that backs it. The order is the
 * order the app earns them in: the level curve is what the user gets back, the
 * syringe math is what Poke does for them on the way, and the reminder is what
 * keeps the run going.
 *
 * The button and the line under it do not belong to any slide. The primary
 * action is a permanent slot, so it holds still while the pictures move, and the
 * one claim Poke can make from its own architecture sits under it the whole
 * time.
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
  const [page, setPage] = useState({ width: 0, height: 0 });
  const [slide, setSlide] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const pager = useRef<ScrollView>(null);

  const first = useRef<boolean | null>(null);
  if (first.current === null) {
    first.current = !arrived;
    arrived = true;
  }
  const play = first.current && !reduced;

  // Seeded from the module flag, so a screen the user has already taken over
  // comes back still.
  const [autoplay, setAutoplay] = useState(!interacted);

  // A headline of this weight has to fit the narrowest phone Poke supports over
  // two lines without hyphenating, so the size is read off the width rather than
  // fixed. "Poke does the syringe math." is the longest of the three.
  const headlineSize = Math.round(clamp((width - spacing.screen * 2) / 12.5, 24, 32));
  const headlineLine = Math.round(headlineSize * 1.16);

  // One timer per slide rather than one repeating interval: the hop resets the
  // clock, so a slide the user swiped to gets its whole turn.
  //
  // The hop does not set the slide itself. The scroll it starts is what moves
  // the dots, the same way a finger does, and a hop that lit the next dot before
  // the scroll had crossed the half way mark would light it, drop it, and light
  // it again.
  useEffect(() => {
    if (!autoplay || reduced || page.width <= 0) return;
    if (slide >= SLIDE_COUNT - 1) return;
    const timer = setTimeout(() => {
      pager.current?.scrollTo({ x: (slide + 1) * page.width, animated: true });
    }, SLIDE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [autoplay, page.width, reduced, slide]);

  const takeOver = () => {
    if (interacted) return;
    interacted = true;
    setAutoplay(false);
  };

  // Read the offset on every scroll frame rather than on momentum end. iOS fires
  // no momentum end when the finger drags a page across and lets go without a
  // flick, and dots that miss that gesture point at the wrong slide.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (page.width <= 0) return;
    const raw = Math.round(event.nativeEvent.contentOffset.x / page.width);
    const next = clamp(raw, 0, SLIDE_COUNT - 1);
    setSlide((current) => (current === next ? current : next));
  };

  // A page is sized rather than stretched. A child of a horizontal scroll view
  // sits on the main axis, so `flex: 1` there would fight the width instead of
  // filling the height.
  const onPagerLayout = (event: LayoutChangeEvent) => {
    const { width: measured, height } = event.nativeEvent.layout;
    setPage((current) => (current.width === measured && current.height === height
      ? current
      : { width: measured, height }));
  };

  return (
    <View testID="welcome-screen" style={styles.root}>
      <RNAnimated.View style={[styles.body, { opacity: transition.opacity }]}>
        <View style={[styles.wordmarkRow, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.wordmark}>Poke</Text>
          <View style={styles.wordmarkDot} />
        </View>

        <View style={styles.pagerBox} onLayout={onPagerLayout} onTouchStart={takeOver}>
          <ScrollView
            testID="welcome-pager"
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onScrollBeginDrag={takeOver}
          >
            <Slide
              testID="welcome-slide-level"
              headline="See your level between shots."
              body="Log a shot in two taps. Poke draws the rest."
              page={page}
              headlineSize={headlineSize}
              headlineLine={headlineLine}
              play={play}
              artLabel="An estimated level curve climbing over four weekly shots."
              note={
                <Pressable
                  testID="welcome-estimate-info"
                  accessibilityRole="button"
                  accessibilityLabel="About this estimate"
                  hitSlop={10}
                  onPress={() => setAboutOpen(true)}
                  style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}
                >
                  <View style={styles.infoDot}>
                    <Info size={12} color={colors.inkMuted} />
                  </View>
                  <Text variant="caption" color={colors.inkMuted}>Estimated level</Text>
                </Pressable>
              }
            >
              {(box) => (
                <View testID="welcome-curve" style={styles.fill}>
                  <WelcomeLevelCurve
                    width={box.width}
                    height={box.height}
                    peakTop={box.height * CURVE_PEAK_TOP}
                    play={play}
                  />
                </View>
              )}
            </Slide>

            <Slide
              testID="welcome-slide-syringe"
              headline="Poke does the syringe math."
              body="Type your vial and your water. Poke shows the draw."
              page={page}
              headlineSize={headlineSize}
              headlineLine={headlineLine}
              artLabel="A syringe with the draw mark lit, beside the vial it came from."
            >
              {(box) => <WelcomeSyringeArt width={box.width} height={box.height} />}
            </Slide>

            <Slide
              testID="welcome-slide-reminder"
              headline={REMINDER_HEADLINE}
              body="Poke reminds you on shot day and keeps your symptoms in one log."
              page={page}
              headlineSize={headlineSize}
              headlineLine={headlineLine}
              artLabel={`A lock screen carrying one Poke banner. ${SHOT_REMINDER_TITLE}. ${SHOT_REMINDER_BODY}`}
              note={
                <Text variant="caption" color={colors.inkMuted}>{BANNER_PRIVACY}</Text>
              }
            >
              {() => <ReminderLockScreen />}
            </Slide>
          </ScrollView>
        </View>

        <View
          testID="welcome-dots"
          style={styles.dots}
          accessibilityRole="tablist"
          accessibilityLabel={`Slide ${slide + 1} of ${SLIDE_COUNT}`}
        >
          {Array.from({ length: SLIDE_COUNT }, (_, index) => (
            <View key={index} style={[styles.dot, index === slide && styles.dotActive]} />
          ))}
        </View>
      </RNAnimated.View>

      {/* Outside the fading body, and outside the pager: the primary action and
          the claim under it hold still through every transition and every
          slide, exactly as the button does on every other onboarding screen. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <View testID="welcome-cta">
          <Button onPress={() => transition.go('/onboarding/sex')}>Start my shot log</Button>
        </View>
        <Text testID="welcome-trust" variant="caption" color={colors.inkMuted} align="center" style={styles.trust}>
          {TRUST_LINE}
        </Text>
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
 * One page of the pitch: two lines of words at the top, one picture under them.
 *
 * The words sit in a box tall enough for the longest of the three, so the
 * pictures start at the same height on every slide and nothing jumps as the
 * pager moves. The box is a floor rather than a fixed height, so a reader who
 * has turned the system type up gets the whole sentence.
 */
function Slide({
  testID,
  headline,
  body,
  page,
  headlineSize,
  headlineLine,
  artLabel,
  note,
  children,
  play = false,
}: {
  testID: string;
  headline: string;
  body: string;
  page: { width: number; height: number };
  headlineSize: number;
  headlineLine: number;
  artLabel: string;
  note?: ReactNode;
  children: (box: { width: number; height: number }) => ReactNode;
  play?: boolean;
}) {
  return (
    <View testID={testID} style={[styles.slide, { width: page.width, height: page.height }]}>
      <Enter delay={welcomeBeats.headline} play={play} travel={rise.line}>
        <Text
          style={[
            styles.headline,
            {
              fontSize: headlineSize,
              lineHeight: headlineLine,
              letterSpacing: -headlineSize * 0.032,
              minHeight: headlineLine * 2,
            },
          ]}
        >
          {headline}
        </Text>
      </Enter>
      <Enter delay={welcomeBeats.support} play={play} travel={rise.line}>
        <Text color={colors.inkMuted} style={styles.support}>{body}</Text>
      </Enter>

      <ArtBox label={artLabel}>{children}</ArtBox>
      {/* Every slide reserves the row, whether or not it fills it, so the three
          pictures stand in exactly the same box and none of them steps as the
          pager moves. */}
      <View style={styles.noteSlot}>{note}</View>
    </View>
  );
}

/**
 * The picture's own box, measured. The level curve draws itself into whatever
 * box it is given, and the two flat illustrations scale their `viewBox` into the
 * same one, so all three read at the same size on the same phone.
 */
function ArtBox({
  label,
  children,
}: {
  label: string;
  children: (box: { width: number; height: number }) => ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  return (
    <View
      style={styles.art}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
      }}
    >
      {children(box)}
    </View>
  );
}

/**
 * Slide three's picture: the banner Poke really sends, on a drawn lock screen.
 *
 * Both strings arrive from `services/notifications.ts`, which exports them for
 * exactly this, so the slide cannot show a sentence the phone does not send and
 * neither line drifts the next time the banner is rewritten. The clock is this
 * phone's own, read once on mount: a drawn 9:41 would be the placeholder a
 * shipping screen may not carry.
 *
 * The plate is dark because the banner is white and the screen behind it is
 * near white. The contrast is what makes the card read as a notification
 * arriving rather than as one more card on the page. It is the same plate the
 * permission step shows later, so the thing the user agrees to there is the
 * thing this slide promised.
 */
function ReminderLockScreen() {
  const [now] = useState(() => Date.now());

  return (
    <View style={styles.lockScreenBox}>
      <View style={styles.lockScreen}>
        <View style={styles.clock}>
          <Text variant="small" color={colors.inkSubtle}>{format(now, 'EEEE, MMMM d')}</Text>
          <Text variant="display" color={colors.inkInverse}>{fmtTime(now)}</Text>
        </View>

        <View style={styles.banner}>
          <View style={styles.appIcon}>
            <Syringe size={18} color={colors.inkInverse} />
          </View>
          <View style={styles.bannerCopy}>
            <View style={styles.bannerHead}>
              <Text variant="smallStrong" style={styles.bannerTitle}>{SHOT_REMINDER_TITLE}</Text>
              <Text variant="small" color={colors.inkSubtle}>now</Text>
            </View>
            <Text variant="small" color={colors.inkMuted}>{SHOT_REMINDER_BODY}</Text>
          </View>
        </View>
      </View>
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

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** The size the onboarding pager already uses for the same row of dots. */
const DOT_SIZE = spacing.sm;

/** The row under the picture, reserved on every slide. One tap target tall. */
const NOTE_HEIGHT = 28;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  fill: {
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
  pagerBox: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
  },
  headline: {
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
  },
  support: {
    marginTop: spacing.md,
    minHeight: text.body.lineHeight * 2,
    maxWidth: 320,
  },
  art: {
    flex: 1,
    marginTop: spacing.md,
  },
  // The plate keeps the width the support line keeps, and centres in whatever
  // box the picture is given, so it stands where the other two pictures stand.
  lockScreenBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockScreen: {
    width: '100%',
    maxWidth: 320,
    padding: spacing.lg,
    gap: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceInverse,
  },
  clock: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  appIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  bannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bannerTitle: {
    flexShrink: 1,
  },
  noteSlot: {
    minHeight: NOTE_HEIGHT,
    justifyContent: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.sm,
    minHeight: 28,
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
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingTop: spacing.lg,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  trust: {
    marginTop: spacing.md,
  },
  aboutBody: {
    gap: spacing.md,
  },
});
