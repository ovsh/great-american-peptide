import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { reduceMotionNow } from '@/components/onboardingTransition';
import {
  SHOT_DAY_OPTIONS,
  medicationDisplayName,
  useOnboardingStore,
  type OnboardingDraft,
} from '@/stores/onboarding';
import { getPreset, hasUsableHalfLife } from '@/domain/peptides';
import { colors, onboardingMotion, radius, spacing } from '@/theme';
import { fmtClock } from '@/utils/date';

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

export default function ComputeScreen() {
  const insets = useSafeAreaInsets();
  const draft = useOnboardingStore((state) => state);
  const lines = useMemo(() => computeLines(draft), [draft]);
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
    run.start(({ finished }) => {
      if (finished) router.replace('/onboarding/plan');
    });

    return () => {
      run.stop();
      progress.removeListener(id);
    };
  }, [clock, progress]);

  // One line is active at a time and the ones above it are done, so the list
  // reads top to bottom as it fills. A line turns over on its own share of the
  // ring, which keeps the two in step at any line count.
  const done = Math.floor((percent / 100) * lines.length);
  const visible = lines.slice(0, Math.min(lines.length, done + 1));

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

      <Text variant="bodyStrong" align="center" style={styles.heading}>
        Poke is putting your plan together
      </Text>

      <View style={styles.lines}>
        {visible.map((line, index) => {
          const complete = index < done;
          return (
            <View key={line} style={styles.line}>
              <View style={[styles.marker, complete && styles.markerDone]}>
                {complete ? <Check size={12} strokeWidth={3} color={colors.inkInverse} /> : null}
              </View>
              <Text
                variant="small"
                color={complete ? colors.inkSubtle : colors.ink}
                style={styles.lineLabel}
              >
                {line}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * What the beat says it is doing, restricted to what the plan screen then does.
 *
 * MeAgain fills this stack with nutrition targets it invents on the spot. Every
 * line here names a calculation `services/onboardingPlan.ts` actually runs on
 * the answer it quotes, so a user who reads them and then reads the plan finds
 * the same six things. A line whose answer was skipped is not written.
 */
export function computeLines(draft: OnboardingDraft): string[] {
  const lines: string[] = [];
  const firstId = draft.medicationIds[0];
  const first = firstId ? draft.schedules[firstId] : undefined;

  if (firstId) {
    const name = medicationDisplayName(firstId, draft.customMedicationName);
    const preset = getPreset(firstId);
    lines.push(preset && hasUsableHalfLife(preset)
      ? `Reading the half-life for ${name}`
      : `Filing ${name} with the dose you set`);
  }

  if (first) {
    lines.push(first.frequencyKind === 'daily'
      ? 'Drawing four weeks of levels from a daily shot'
      : `Drawing four weeks of levels from ${dayLabel(first.shotDay)}`);
  }

  if (draft.medicationIds.length > 1) {
    // "all 2 of your medications" is what the plain template renders at the
    // count this branch is reached at most often, and it reads like a mail
    // merge. Two gets a word.
    lines.push(draft.medicationIds.length === 2
      ? 'Lining up both of your medications on one calendar'
      : `Lining up all ${draft.medicationIds.length} of your medications on one calendar`);
  }

  lines.push('Working out the first four injection sites in the rotation');

  const current = draft.weight.current;
  const goal = draft.weight.goal;
  if (current !== null && goal !== null && current !== goal) {
    lines.push(`Mapping ${format(current)} ${draft.weight.unit} to ${format(goal)} ${draft.weight.unit} at your pace`);
  }

  if (draft.concerns.length > 0) {
    lines.push('Filing the side effects you want to keep an eye on');
  }

  // Only when there is a reminder to set. A user who pressed `Not now`, or who
  // refused the OS permission, sets no reminder, and a line that says otherwise
  // is the one kind of claim this list exists to avoid.
  if (draft.reminder.kind === 'enabled') {
    lines.push(`Setting your reminder for ${fmtClock(draft.reminder.time)}`);
  }

  return lines;
}

function dayLabel(day: number): string {
  return SHOT_DAY_OPTIONS.find((option) => option.value === day)?.label ?? 'your shot day';
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  lineLabel: {
    flex: 1,
  },
});
