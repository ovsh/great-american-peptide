import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { reduceMotionNow } from '@/components/onboardingTransition';
import { useOnboardingStore, type OnboardingDraft } from '@/stores/onboarding';
import { getPreset, hasUsableHalfLife } from '@/domain/peptides';
import { goalFraming } from '@/utils/goalFraming';
import {
  beatDelay,
  colors,
  easing as easingTokens,
  motion,
  onboardingMotion,
  radius,
  spacing,
  springTo,
  springs,
  timeTo,
} from '@/theme';

const RING_SIZE = 176;
const RING_STROKE = 10;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The recording's ring, read off the frames rather than fitted to a curve.
// § Motion in the map gives four points: 50 % at 3.5 s, 79 % at 7.0 s, 95 % at
// 10.4 s and 100 % at 13.8 s. Ambiguity 5 in the same document says a single
// capture cannot tell a scripted keyframe list from an eased function, so this
// interpolates through the measured points and asserts nothing between them.
// The long crawl over the last five per cent is not a flourish: it is the shape
// the recording has, and it is most of why the beat reads as work.
const CURVE = [
  { at: 0, value: 0 },
  { at: 3.5 / 13.8, value: 0.5 },
  { at: 7.0 / 13.8, value: 0.79 },
  { at: 10.4 / 13.8, value: 0.95 },
  { at: 1, value: 1 },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The hairline of an unfinished line's marker. */
const MARKER_BORDER = 1;

/** The two beats a check waits, plus the time it takes to draw. */
const CHECK_MARK_DELAY = 2 * motion.beat;
const CHECK_TAIL_MS = CHECK_MARK_DELAY + motion.base;

export default function ComputeScreen() {
  const insets = useSafeAreaInsets();
  const draft = useOnboardingStore((state) => state);
  const lines = useMemo(() => computeLines(draft), [draft]);
  const framing = goalFraming(draft.goalTags);
  const clock = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

  // Memoised because the effect below depends on it. An interpolation built in
  // the render body is a new object every render, the percent listener renders
  // on every whole per cent, and the effect would then stop and restart the
  // timing about a hundred times. Each restart gives the remaining distance a
  // fresh 13.8 s, so the ring decays towards 100 % instead of arriving: the beat
  // measured at 26 s on the web preview rather than 13.8 s.
  const progress = useMemo(() => clock.interpolate({
    inputRange: CURVE.map((point) => point.at),
    outputRange: CURVE.map((point) => point.value),
  }), [clock]);

  useEffect(() => {
    // Reduce Motion skips the beat outright. There is no real work behind the
    // ring, so holding someone who asked for less motion in front of fourteen
    // seconds of decoration would be the wrong reading of the setting.
    if (reduceMotionNow()) {
      router.replace('/onboarding/plan');
      return;
    }

    // The integer needs a JS value, so this animation runs off the native
    // thread. It drives one Animated.Value and repaints only when the rounded
    // percent changes, which is at most a hundred times over the whole beat.
    const id = progress.addListener(({ value }) => {
      setPercent(Math.min(100, Math.round(value * 100)));
    });

    const run = Animated.timing(clock, {
      toValue: 1,
      duration: onboardingMotion.computeMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    let tail: ReturnType<typeof setTimeout> | undefined;
    run.start(({ finished }) => {
      // The fourth line turns over on the closing frame of the ring, and its
      // check takes two beats to arrive and a fifth of a second to draw. The
      // beat holds for exactly that, so the list is seen to finish rather than
      // being carried off the screen mid check.
      if (finished) tail = setTimeout(() => router.replace('/onboarding/plan'), CHECK_TAIL_MS);
    });

    return () => {
      run.stop();
      if (tail) clearTimeout(tail);
      progress.removeListener(id);
    };
  }, [clock, progress]);

  // One clock. The ring is the clock, and a line turns over on its own quarter
  // of it, so the fourth check and the closing of the ring are the same event.
  // The whole list stands there from the first frame: four lines that arrive one
  // at a time make the screen jump, and the user cannot read what is coming.
  const done = Math.floor((percent / 100) * lines.length);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.hero }]}>
      <View style={styles.ring}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={colors.accentSoft}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={colors.accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={progress.interpolate({
              inputRange: [0, 1],
              outputRange: [CIRCUMFERENCE, 0],
            })}
            // Start the fill at twelve o'clock instead of three.
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View
          style={styles.ringLabel}
          accessibilityRole="progressbar"
          accessibilityLabel="Building your plan"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <Text variant="display">{percent}%</Text>
        </View>
      </View>

      {/* The goal the user picked names the plan being built. The draft is
          already subscribed above, so this costs no second read, and a run with
          no goal answer keeps the sentence the beat has always carried. */}
      <Text variant="bodyStrong" align="center" style={styles.heading}>
        {framing
          ? `Poke is putting your ${framing.plan} plan together`
          : 'Poke is putting your plan together'}
      </Text>

      <View style={styles.lines}>
        {lines.map((line, index) => (
          <ComputeLine key={line} label={line} complete={index < done} />
        ))}
      </View>
    </View>
  );
}

/** How a line reads before its quarter of the ring closes. */
const PENDING_OPACITY = 0.55;

/**
 * One line of the list.
 *
 * The disc pops first and the check and the words follow two beats later, so
 * the eye reads the mark landing and then the line it belongs to, rather than
 * the whole row switching on at once.
 */
function ComputeLine({ label, complete }: { label: string; complete: boolean }) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(complete ? 1 : 0);
  const mark = useSharedValue(complete ? 1 : 0);

  useEffect(() => {
    fill.value = springTo(complete ? 1 : 0, { config: springs.pop, reduced });
    mark.value = timeTo(complete ? 1 : 0, {
      duration: motion.base,
      easing: easingTokens.out,
      delay: beatDelay(CHECK_MARK_DELAY, reduced),
      reduced,
    });
  }, [complete, fill, mark, reduced]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scale: fill.value }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: PENDING_OPACITY + (1 - PENDING_OPACITY) * mark.value,
  }));

  return (
    <View style={styles.line}>
      <View style={styles.marker}>
        <Reanimated.View style={[styles.markerFill, fillStyle]} />
        <Reanimated.View style={markStyle}>
          <Check size={12} strokeWidth={3} color={colors.inkInverse} />
        </Reanimated.View>
      </View>
      <Reanimated.View style={[styles.lineLabel, labelStyle]}>
        <Text variant="small">{label}</Text>
      </Reanimated.View>
    </View>
  );
}

/**
 * What the beat says it is doing, restricted to what the plan screen then does.
 *
 * MeAgain fills this stack with nutrition targets it invents on the spot. Every
 * line here names a calculation `services/onboardingPlan.ts` actually runs.
 *
 * Always four, and always short. The count is fixed because the ring is the
 * clock: four lines put a check on each quarter of it, and a list that grew or
 * shrank with the answers left the ring turning with nothing to show. A line
 * whose answer was skipped is not dropped, it is rewritten to the thing Poke
 * does instead, so no line ever claims work that did not happen.
 */
export function computeLines(draft: OnboardingDraft): string[] {
  const firstId = draft.medicationIds[0];
  const preset = firstId ? getPreset(firstId) : undefined;
  const modelled = Boolean(preset && hasUsableHalfLife(preset));

  return [
    modelled ? 'Reading the half-life' : 'Filing your medication',
    modelled ? 'Drawing four weeks of levels' : 'Marking four weeks of shots',
    'Planning the site rotation',
    draft.reminder.kind === 'enabled' ? 'Setting your reminder' : 'Saving your answers',
  ];
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xxl,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    maxWidth: 320,
  },
  lines: {
    width: '100%',
    maxWidth: 440,
    gap: spacing.md,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: MARKER_BORDER,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Over the ring, not inside it: an accent disc that stopped at the inside of
  // a grey hairline would wear the hairline as a halo.
  markerFill: {
    position: 'absolute',
    top: -MARKER_BORDER,
    left: -MARKER_BORDER,
    right: -MARKER_BORDER,
    bottom: -MARKER_BORDER,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  lineLabel: {
    flex: 1,
  },
});
