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

/** The date cell, which is the whole mark. Every column reserves this height. */
const CELL_SIZE = 24;
const COLUMNS = 7;
/** The check that rides the corner of a logged cell, and how far it hangs off it. */
const BADGE_SIZE = 12;
const BADGE_OFFSET = -3;
/**
 * The pulse ring that leaves the cell, and where it sits over the column. The
 * layer starts at the label block, which is the label's own line box plus the
 * column gap, and lifts by half the ring's overhang so the ring stays centred on
 * the cell. The ring opens at `CELL_SIZE` exactly, so it reads as leaving the
 * cell rather than as a second ring appearing over it.
 */
const PULSE_SIZE = 40;
const LABEL_BLOCK = 18;
/** The one number in the log sequence that is not a token: the pop runs a beat over `base`. */
const MARK_POP_MS = motion.base + 40;

/**
 * The x-axis of the hero chart is the week, and the cells belong to the focused
 * medication alone. One column is a weekday letter over one date cell, and the
 * cell carries the state: a filled disc with a corner check is a shot the user
 * logged, a strong ring is today's dose waiting, a hollow ring is a day the
 * schedule names, a bare number is a day off. Today's letter is the word TODAY
 * in the medication's colour.
 *
 * These seven days are the chart's own window: both read `weekWindow` and
 * `WEEK_LOOKBACK_DAYS` in `today-level-series.ts`, and the row insets by
 * `spacing.xl`, the chart's `PAD_X`. So a column centre is the x of that day's
 * midpoint on the curve.
 *
 * Seven columns and no more. A month belongs to History; this row exists so the
 * curve above it has days under it rather than numbers.
 *
 * Motion. On arrival a wipe crosses the seven columns one beat apart, which is
 * also `draw ÷ 7`, so each cell lands as the curve above it is drawn. A logged
 * shot holds today's cell at its old state for five beats, then swaps it for the
 * checked disc and pops it, and one ring leaves it in the medication's colour.
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
            color={day.isToday ? color : colors.inkSubtle}
          >
            {day.isToday ? 'TODAY' : format(day.dayStart, 'EEEEE')}
          </Text>
          <DayCell
            mark={day.mark}
            date={format(day.dayStart, 'd')}
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
 * One date cell, and the two things that can move it: the arrival wipe passing
 * its column, and — for today alone — the shot landing on it.
 */
function DayCell({
  mark,
  date,
  color,
  index,
  wipe,
  pop,
}: {
  mark: DayMark;
  date: string;
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

  return <Animated.View style={animated}>{cellBody(mark, date, color)}</Animated.View>;
}

function cellBody(mark: DayMark, date: string, color: string) {
  switch (mark) {
    case 'logged':
      return (
        <View style={[styles.cell, { backgroundColor: color }]}>
          <Text style={styles.dateStrong} color={colors.inkInverse}>{date}</Text>
          <View style={[styles.badge, { backgroundColor: deepMedicationColor(color) }]}>
            <Check size={7} strokeWidth={3} color={colors.inkInverse} />
          </View>
        </View>
      );
    case 'due':
      return (
        <View style={[styles.cell, styles.cellDue]}>
          <Text style={styles.dateStrong} color={colors.successDeep}>{date}</Text>
        </View>
      );
    case 'scheduled':
      return (
        <View style={[styles.cell, styles.cellScheduled]}>
          <Text style={styles.dateStrong} color={colors.inkSubtle}>{date}</Text>
        </View>
      );
    case 'rest':
      return (
        <View style={styles.cell}>
          <Text style={styles.dateRest} color={colors.inkSubtle}>{date}</Text>
        </View>
      );
    default: {
      const exhaustive: never = mark;
      return exhaustive;
    }
  }
}

/**
 * The badge fill: the medication's own hue, taken to about a third of its
 * lightness, rather than `successDeep`. The badge sits on the medication's
 * colour, and a green check on a blue or a pink disc would read as a second
 * meaning. The parse is the one `softMedicationColor` in `history-month-section`
 * uses, and the ramp in `colors.med` is all six-digit hex, so a bad string can
 * only come from a hand-edited row: that falls back to the app's ink.
 */
function deepMedicationColor(hex: string): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return colors.ink;
  return `rgb(${Math.round(red * 0.42)},${Math.round(green * 0.42)},${Math.round(blue * 0.42)})`;
}

/**
 * The whole celebration: one ring, in the medication's colour, leaving the cell
 * once. Poke is a medical app, and a logged shot is not confetti.
 */
function PulseRing({ color, pulse }: { color: string; pulse: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.02, 1], [0, 0.45, 0], 'clamp'),
    // 0.6 is `CELL_SIZE ÷ PULSE_SIZE`: the ring opens on the cell's own edge and
    // ends where the old, smaller ring ended, so it still clears one column.
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.6, 2.1], 'clamp') }],
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
  // The cell now shows the date, so the sentence says it too. Today needs no
  // date read out: the word TODAY is the label the user sees.
  const name = day.isToday ? 'Today' : `${format(day.dayStart, 'EEEE')} the ${format(day.dayStart, 'do')}`;
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
    // Five upright letters in a column of about 50 pt: the tracking gives way
    // before the size does, because 11 px is the floor the row reads at.
    letterSpacing: 0.2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  cellDue: {
    borderWidth: 2,
    borderColor: colors.successDeep,
  },
  cellScheduled: {
    borderWidth: 1.6,
    borderColor: 'rgba(17,20,24,0.18)',
  },
  dateStrong: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  dateRest: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 15,
  },
  badge: {
    position: 'absolute',
    top: BADGE_OFFSET,
    right: BADGE_OFFSET,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    // The card, not the disc under it: the ring has to cut the badge free of the
    // medication colour it sits on.
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  pulseLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LABEL_BLOCK - (PULSE_SIZE - CELL_SIZE) / 2,
    alignItems: 'center',
  },
  pulse: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderWidth: 2,
    borderRadius: radius.pill,
  },
});
