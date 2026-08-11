import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/Text';
import type { DayMark, WeekDay } from '@/components/today-types';
import {
  arrivalBeats,
  colors,
  easing,
  fonts,
  logBeats,
  motion,
  radius,
  spacing,
  timeTo,
} from '@/theme';

const MARK_SIZE = 17;
const COLUMNS = 7;
/** The pulse ring that leaves the mark, and where it sits over the column. */
const PULSE_SIZE = 34;
const LABEL_BLOCK = 18;
/** The one number in the log sequence that is not a token: the pop runs a beat over `base`. */
const MARK_POP_MS = motion.base + 40;

/**
 * The x-axis of the hero chart is the week, and the marks belong to the focused
 * medication alone. A check is a shot the user logged, a filled ring is today's
 * dose, a hollow ring is a day the schedule names, a dash is a day off.
 *
 * Seven columns and no more. A month belongs to History; this row exists so the
 * curve above it has days under it rather than numbers.
 *
 * Motion. On arrival a wipe crosses the seven columns one beat apart, which is
 * also `draw ÷ 7`, so each mark lands as the curve above it is drawn. A logged
 * shot holds today's mark at its old state for five beats, then swaps it for the
 * check and pops it, and one ring leaves it in the medication's colour.
 */
export function TodayWeekAxis({
  week,
  color,
  medicationName,
  medicationId,
  entered,
  logToken,
}: {
  week: readonly WeekDay[];
  color: string;
  medicationName: string;
  medicationId: string;
  entered: boolean;
  logToken: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(week);
  const lastMedication = useRef(medicationId);
  const lastLogToken = useRef(logToken);

  const fade = useSharedValue(1);
  /** How far the arrival wipe has crossed the row, in columns. */
  const wipe = useSharedValue(entered && reduced ? COLUMNS : 0);
  const pop = useSharedValue(1);
  const pulse = useSharedValue(0);

  const signature = weekSignature(week);

  useEffect(() => {
    if (!entered) return;
    if (reduced) {
      wipe.value = COLUMNS;
      return;
    }
    wipe.value = withDelay(
      arrivalBeats.axis,
      // Linear on purpose: the wipe is a metronome, and each mark's own pop is
      // what carries the easing.
      withTiming(COLUMNS, { duration: COLUMNS * arrivalBeats.axisStep, easing: Easing.linear }),
    );
  }, [entered, reduced, wipe]);

  useEffect(() => {
    if (lastMedication.current !== medicationId) {
      lastMedication.current = medicationId;
      lastLogToken.current = logToken;
      if (reduced) {
        setShown(week);
        return;
      }
      // A crossfade with the content swapped halfway: the marks belong to the
      // medication, and no mark should be seen turning into another one.
      fade.value = timeTo(0, { duration: motion.fast / 2, easing: easing.in });
      const timer = setTimeout(() => {
        setShown(week);
        fade.value = timeTo(1, { duration: motion.fast, easing: easing.out });
      }, motion.fast / 2);
      return () => clearTimeout(timer);
    }

    if (logToken !== 0 && logToken !== lastLogToken.current) {
      lastLogToken.current = logToken;
      if (reduced) {
        setShown(week);
        return;
      }
      // Today's mark holds its old state until the shot reaches it.
      const timer = setTimeout(() => {
        setShown(week);
        pop.value = 0;
        pop.value = withSequence(
          withTiming(0.55, { duration: MARK_POP_MS * 0.55, easing: easing.out }),
          withTiming(1, { duration: MARK_POP_MS * 0.45, easing: easing.out }),
        );
        pulse.value = 0;
        pulse.value = withTiming(1, { duration: motion.slow, easing: easing.out });
      }, logBeats.mark);
      return () => clearTimeout(timer);
    }

    setShown((current) => (weekSignature(current) === signature ? current : week));
  }, [fade, logToken, medicationId, pop, pulse, reduced, signature, week]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${medicationName} this week. ${week.map(spokenDay).join('. ')}.`}
      style={[styles.row, rowStyle]}
    >
      {shown.map((day, index) => (
        <View key={day.dayStart} style={styles.column}>
          <Text
            style={[styles.label, day.isToday && styles.labelToday]}
            color={day.isToday ? colors.ink : colors.inkSubtle}
          >
            {format(day.dayStart, 'EEEEE')}
            {day.isToday ? ` ${format(day.dayStart, 'd')}` : ''}
          </Text>
          <DayMarkView
            mark={day.mark}
            color={color}
            index={index}
            wipe={wipe}
            pop={day.isToday ? pop : null}
          />
          {day.isToday ? <PulseRing color={color} pulse={pulse} /> : null}
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * One mark, and the two things that can move it: the arrival wipe passing its
 * column, and — for today alone — the shot landing on it.
 */
function DayMarkView({
  mark,
  color,
  index,
  wipe,
  pop,
}: {
  mark: DayMark;
  color: string;
  index: number;
  wipe: SharedValue<number>;
  pop: SharedValue<number> | null;
}) {
  const animated = useAnimatedStyle(() => {
    const arrival = interpolate(
      (wipe.value - index) * arrivalBeats.axisStep,
      [0, motion.fast],
      [0, 1],
      'clamp',
    );
    const landing = pop === null ? 1 : pop.value;
    const scale = interpolate(arrival, [0, 0.55, 1], [0.5, 1.14, 1], 'clamp')
      * interpolate(landing, [0, 0.55, 1], [0.5, 1.14, 1], 'clamp');
    return {
      opacity: interpolate(arrival, [0, 0.35], [0, 1], 'clamp')
        * interpolate(landing, [0, 0.35], [0, 1], 'clamp'),
      transform: [{ scale }],
    };
  });

  return <Animated.View style={animated}>{markBody(mark, color)}</Animated.View>;
}

function markBody(mark: DayMark, color: string) {
  switch (mark) {
    case 'logged':
      return (
        <View style={[styles.mark, { backgroundColor: color }]}>
          <Check size={10} strokeWidth={3} color={colors.inkInverse} />
        </View>
      );
    case 'due':
      return (
        <View style={[styles.mark, styles.markDue]}>
          <View style={styles.markDueCore} />
        </View>
      );
    case 'scheduled':
      return <View style={[styles.mark, styles.markScheduled]} />;
    case 'rest':
      return <View style={styles.markRest} />;
    default: {
      const exhaustive: never = mark;
      return exhaustive;
    }
  }
}

/**
 * The whole celebration: one ring, in the medication's colour, leaving the mark
 * once. Poke is a medical app, and a logged shot is not confetti.
 */
function PulseRing({ color, pulse }: { color: string; pulse: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.02, 1], [0, 0.45, 0], 'clamp'),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.5, 2.5], 'clamp') }],
  }));

  return (
    <View pointerEvents="none" style={styles.pulseLayer}>
      <Animated.View style={[styles.pulse, { borderColor: color }, animated]} />
    </View>
  );
}

function weekSignature(week: readonly WeekDay[]): string {
  return week.map((day) => `${day.dayStart}:${day.mark}`).join('|');
}

function spokenDay(day: WeekDay): string {
  const name = day.isToday ? 'Today' : format(day.dayStart, 'EEEE');
  switch (day.mark) {
    case 'logged':
      return `${name} logged`;
    case 'due':
      return `${name} due`;
    case 'scheduled':
      return `${name} scheduled`;
    case 'rest':
      return `${name} none`;
    default: {
      const exhaustive: never = day.mark;
      return exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: 2,
    paddingBottom: 14,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
  },
  labelToday: {
    fontFamily: fonts.sansSemiBold,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  markDue: {
    borderWidth: 2,
    borderColor: colors.successDeep,
  },
  markDueCore: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.successDeep,
  },
  markScheduled: {
    borderWidth: 1.6,
    borderColor: 'rgba(17,20,24,0.18)',
  },
  markRest: {
    width: 6,
    height: 2,
    marginVertical: (MARK_SIZE - 2) / 2,
    borderRadius: 1,
    backgroundColor: 'rgba(17,20,24,0.14)',
  },
  pulseLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LABEL_BLOCK - (PULSE_SIZE - MARK_SIZE) / 2,
    alignItems: 'center',
  },
  pulse: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderWidth: 2,
    borderRadius: radius.pill,
  },
});
