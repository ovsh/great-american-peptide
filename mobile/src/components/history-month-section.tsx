// One month of the History board: the rail, then the grid.
//
// The rail is one row per medication and one cell per week — solid is the doses
// the week kept, grey is the ones it lost, tinted is the ones still ahead. It
// carries the medication's name and colour, so it is also the legend for the
// stripes below it. The grid is the calendar, and every day cell carries the
// same lanes in the same order.
//
// Every height in here is fixed and exported, because the screen has to know how
// tall a month is before it renders one: the month list is a `FlatList` with
// `getItemLayout`, so it can open on the newest month with older months already
// measured above it.

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { Text } from './Text';
import { medicationColor } from './today-hero-card';
import type { MedicationRow } from '../db/types';
import {
  buildMonthWeeks,
  endOfLocalMonth,
  shotCountKey,
  summarizeWeek,
  weeksInMonth,
  type BoardDay,
  type BoardWeek,
  type LaneMark,
} from '../domain/historyBoard';
import { listInjectionMarks } from '../repositories/injections';
import { colors, easing, motion, radius, spacing, timeTo } from '../theme';

/* ── geometry ─────────────────────────────────────────────────────────────
   These are the mock's own numbers. Change one here and change it in the
   stylesheet below, or the month list will scroll to the wrong place. */

const LANE_WIDTH = 30;
const LANE_HEIGHT = 5;
const LANE_GAP = 2;
const DAY_NUMERAL = 24;
const DAY_CELL_MIN = 60;
const GRID_PADDING_TOP = 8;
const GRID_PADDING_BOTTOM = 10;
const WEEKDAY_ROW_HEIGHT = 20;
const RAIL_PADDING_V = 13;
const RAIL_ROW_HEIGHT = 19;
const RAIL_ROW_GAP = 8;

/** The gap between the divider, the rail, the grid, and the next month. */
export const SECTION_GAP = 10;
/** The month name and its hairline, above every month. */
export const MONTH_DIVIDER_HEIGHT = 28;

export function laneStackHeight(lanes: number): number {
  if (lanes <= 0) return 0;
  return lanes * LANE_HEIGHT + (lanes - 1) * LANE_GAP;
}

export function dayCellHeight(lanes: number): number {
  return Math.max(DAY_CELL_MIN, 2 + DAY_NUMERAL + 2 + laneStackHeight(lanes) + 4);
}

export function railHeight(lanes: number): number {
  if (lanes <= 0) return 0;
  return RAIL_PADDING_V * 2 + lanes * RAIL_ROW_HEIGHT + (lanes - 1) * RAIL_ROW_GAP;
}

export function gridHeight(weeks: number, lanes: number): number {
  return GRID_PADDING_TOP + WEEKDAY_ROW_HEIGHT + weeks * dayCellHeight(lanes) + GRID_PADDING_BOTTOM;
}

/** How tall this month is, gap below it included. The month list measures with this. */
export function monthSectionHeight(monthStart: number, lanes: number): number {
  const rail = railHeight(lanes);
  return (
    MONTH_DIVIDER_HEIGHT +
    SECTION_GAP +
    (rail > 0 ? rail + SECTION_GAP : 0) +
    gridHeight(weeksInMonth(monthStart), lanes) +
    SECTION_GAP
  );
}

/* ── colour ───────────────────────────────────────────────────────────── */

/** A medication's hue at plan strength. The mock's `.22` tint, from its own hex. */
function softMedicationColor(hex: string): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return colors.border;
  return `rgba(${red},${green},${blue},0.22)`;
}

/** The one grey the board owns: a scheduled dose that did not happen. */
const GAP_FILL = 'rgba(17,20,24,0.11)';
const TRACK = 'rgba(17,20,24,0.05)';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function monthLabel(monthStart: number): string {
  const date = new Date(monthStart);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function isoDay(dayStart: number): string {
  const date = new Date(dayStart);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MARK_WORDS: Record<LaneMark, string | null> = {
  logged: 'logged',
  loggedTwice: 'logged twice',
  due: 'due today',
  scheduled: 'planned',
  missed: 'missed',
  none: null,
};

/* ── the lane ─────────────────────────────────────────────────────────── */

/**
 * One medication's stripe on one day.
 *
 * This is where the screen's single fun moment lives. A lane that becomes
 * logged while History is mounted — the user tapped the band, logged the shot,
 * and came back — fills itself from the left. A lane that was already logged
 * when the board mounted does not: arrival is not an event.
 */
const Lane = memo(function Lane({ mark, hex }: { mark: LaneMark; hex: string }) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(1);
  const previous = useRef(mark);

  useEffect(() => {
    const became = (mark === 'logged' || mark === 'loggedTwice')
      && previous.current !== 'logged' && previous.current !== 'loggedTwice';
    previous.current = mark;
    if (!became) return;
    fill.value = 0;
    fill.value = timeTo(1, { duration: motion.slow, easing: easing.out, reduced });
  }, [mark, fill, reduced]);

  const style = useAnimatedStyle(() => ({
    // Anchored to the left edge: the stripe grows the way a week reads.
    transform: [
      { translateX: -LANE_WIDTH / 2 },
      { scaleX: fill.value },
      { translateX: LANE_WIDTH / 2 },
    ],
  }));

  if (mark === 'none') return <View style={styles.lane} />;

  const soft = softMedicationColor(hex);
  if (mark === 'loggedTwice') {
    return (
      <Animated.View style={[styles.lane, styles.laneSplit, style]}>
        <View style={[styles.laneHalf, { backgroundColor: hex }]} />
        <View style={[styles.laneHalf, { backgroundColor: hex }]} />
      </Animated.View>
    );
  }

  const tone =
    mark === 'logged' ? { backgroundColor: hex }
    : mark === 'due' ? { backgroundColor: soft, borderWidth: 1.4, borderColor: hex }
    : mark === 'scheduled' ? { backgroundColor: soft }
    : { borderWidth: 1.4, borderColor: hex };

  return <Animated.View style={[styles.lane, tone, style]} />;
});

/* ── the day cell ─────────────────────────────────────────────────────── */

interface DayCellProps {
  day: BoardDay | null;
  lanes: readonly MedicationRow[];
  hexes: readonly string[];
  selected: boolean;
  height: number;
  onSelect: (day: BoardDay) => void;
}

const DayCell = memo(function DayCell({ day, lanes, hexes, selected, height, onSelect }: DayCellProps) {
  if (!day) return <View style={[styles.dayCell, { height }]} />;

  const spoken = lanes
    .map((medication, index) => {
      const word = MARK_WORDS[day.marks[index] ?? 'none'];
      return word ? `${medication.name} ${word}` : null;
    })
    .filter((part): part is string => part !== null);

  return (
    <Pressable
      testID={`history-day-${isoDay(day.dayStart)}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        spoken.length > 0
          ? `${day.dayOfMonth}. ${spoken.join('. ')}`
          : `${day.dayOfMonth}. Nothing logged`
      }
      onPress={() => onSelect(day)}
      style={[styles.dayCell, { height }]}
    >
      <View
        style={[
          styles.dayNumeral,
          day.isToday && !selected ? styles.dayNumeralToday : null,
          selected ? styles.dayNumeralSelected : null,
          selected && day.isToday ? styles.dayNumeralSelectedToday : null,
        ]}
      >
        <Text
          variant="bodyStrong"
          color={
            selected ? colors.inkInverse
            : day.isToday ? colors.successDeep
            : colors.ink
          }
          style={styles.dayNumeralText}
        >
          {day.dayOfMonth}
        </Text>
      </View>
      <View style={styles.laneStack}>
        {lanes.map((medication, index) => (
          <Lane
            key={medication.id}
            mark={day.marks[index] ?? 'none'}
            hex={hexes[index] ?? colors.accent}
          />
        ))}
      </View>
    </Pressable>
  );
});

/* ── the rail ─────────────────────────────────────────────────────────── */

function MonthRail({
  weeks,
  lanes,
  hexes,
}: {
  weeks: readonly BoardWeek[];
  lanes: readonly MedicationRow[];
  hexes: readonly string[];
}) {
  return (
    <View style={styles.rail}>
      {lanes.map((medication, laneIndex) => {
        const hex = hexes[laneIndex] ?? colors.accent;
        return (
          <View key={medication.id} style={styles.railRow}>
            <View style={[styles.railDot, { backgroundColor: hex }]} />
            <Text variant="smallStrong" numberOfLines={1} style={styles.railName}>
              {medication.name}
            </Text>
            <View style={styles.railCells}>
              {weeks.map((week, weekIndex) => {
                const fill = summarizeWeek(week, laneIndex);
                return (
                  <View key={weekIndex} style={styles.railCell}>
                    {fill.kept > 0 ? (
                      <View style={{ flex: fill.kept, backgroundColor: hex }} />
                    ) : null}
                    {fill.lost > 0 ? (
                      <View style={{ flex: fill.lost, backgroundColor: GAP_FILL }} />
                    ) : null}
                    {fill.ahead > 0 ? (
                      <View style={{ flex: fill.ahead, backgroundColor: softMedicationColor(hex) }} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── the month ────────────────────────────────────────────────────────── */

interface HistoryMonthSectionProps {
  monthStart: number;
  lanes: readonly MedicationRow[];
  reminderTime: string;
  now: number;
  /** Bumped whenever anything is logged or deleted, so the month reloads. */
  dataVersion: number;
  selectedDay: number | null;
  onSelectDay: (day: BoardDay) => void;
}

export function HistoryMonthSection({
  monthStart,
  lanes,
  reminderTime,
  now,
  dataVersion,
  selectedDay,
  onSelectDay,
}: HistoryMonthSectionProps) {
  const [shotCounts, setShotCounts] = useState<ReadonlyMap<string, number>>(() => new Map());

  // Each month loads only its own shots, when it first comes into view. Scrolling
  // back a year does not read a year of injections.
  useEffect(() => {
    let alive = true;
    listInjectionMarks(monthStart, endOfLocalMonth(monthStart))
      .then((marks) => {
        if (!alive) return;
        const counts = new Map<string, number>();
        for (const mark of marks) {
          const day = new Date(mark.takenAt);
          day.setHours(0, 0, 0, 0);
          const key = shotCountKey(day.getTime(), mark.medicationId);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        setShotCounts(counts);
      })
      .catch(() => {
        if (alive) setShotCounts(new Map());
      });
    return () => {
      alive = false;
    };
  }, [monthStart, dataVersion]);

  const hexes = useMemo(() => lanes.map((medication) => medicationColor(medication.color_index)), [lanes]);
  const weeks = useMemo(
    () => buildMonthWeeks({ monthStart, lanes, reminderTime, shotCounts, now }),
    [monthStart, lanes, reminderTime, shotCounts, now],
  );
  const cellHeight = dayCellHeight(lanes.length);

  return (
    <View style={styles.section}>
      <View style={styles.divider}>
        <Text variant="h2">{monthLabel(monthStart)}</Text>
        <View style={styles.dividerRule} />
      </View>

      {lanes.length > 0 ? (
        <View style={styles.card}>
          <MonthRail weeks={weeks} lanes={lanes} hexes={hexes} />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.grid}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_INITIALS.map((initial, index) => (
              <View key={index} style={styles.weekdayCell}>
                <Text variant="caption" color={colors.inkSubtle} style={styles.weekdayText}>
                  {initial}
                </Text>
              </View>
            ))}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => (
                <DayCell
                  key={day ? day.dayStart : `pad-${weekIndex}-${dayIndex}`}
                  day={day}
                  lanes={lanes}
                  hexes={hexes}
                  selected={day !== null && day.dayStart === selectedDay}
                  height={cellHeight}
                  onSelect={onSelectDay}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.screen,
    paddingBottom: SECTION_GAP,
  },
  divider: {
    height: MONTH_DIVIDER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  dividerRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  card: {
    marginTop: SECTION_GAP,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  rail: {
    paddingVertical: RAIL_PADDING_V,
    paddingHorizontal: 16,
    gap: RAIL_ROW_GAP,
  },
  railRow: {
    height: RAIL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  railDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  railName: {
    width: 88,
    lineHeight: RAIL_ROW_HEIGHT,
  },
  railCells: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  railCell: {
    flex: 1,
    height: 18,
    borderRadius: 5,
    backgroundColor: TRACK,
    flexDirection: 'row',
    overflow: 'hidden',
  },

  grid: {
    paddingTop: GRID_PADDING_TOP,
    paddingHorizontal: GRID_PADDING_TOP,
    paddingBottom: GRID_PADDING_BOTTOM,
  },
  weekdayRow: {
    height: WEEKDAY_ROW_HEIGHT,
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  dayNumeral: {
    width: DAY_NUMERAL,
    height: DAY_NUMERAL,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumeralToday: {
    borderWidth: 2,
    borderColor: colors.successDeep,
  },
  dayNumeralSelected: {
    backgroundColor: colors.ink,
  },
  dayNumeralSelectedToday: {
    backgroundColor: colors.successDeep,
    borderWidth: 0,
  },
  dayNumeralText: {
    fontVariant: ['tabular-nums'],
  },
  laneStack: {
    marginTop: 2,
    gap: LANE_GAP,
  },
  lane: {
    width: LANE_WIDTH,
    height: LANE_HEIGHT,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  laneSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  laneHalf: {
    width: LANE_WIDTH * 0.46,
    height: LANE_HEIGHT,
    borderRadius: 3,
  },
});
