import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/Text';
import type { DayMark, WeekDay } from '@/components/today-types';
import { colors, fonts, radius, spacing } from '@/theme';

const MARK_SIZE = 17;

/**
 * The x-axis of the hero chart is the week, and the marks belong to the focused
 * medication alone. A check is a shot the user logged, a filled ring is today's
 * dose, a hollow ring is a day the schedule names, a dash is a day off.
 *
 * Seven columns and no more. A month belongs to History; this row exists so the
 * curve above it has days under it rather than numbers.
 */
export function TodayWeekAxis({
  week,
  color,
  medicationName,
}: {
  week: readonly WeekDay[];
  color: string;
  medicationName: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${medicationName} this week. ${week.map(spokenDay).join('. ')}.`}
      style={styles.row}
    >
      {week.map((day) => (
        <View key={day.dayStart} style={styles.column}>
          <Text
            style={[styles.label, day.isToday && styles.labelToday]}
            color={day.isToday ? colors.ink : colors.inkSubtle}
          >
            {format(day.dayStart, 'EEEEE')}
            {day.isToday ? ` ${format(day.dayStart, 'd')}` : ''}
          </Text>
          <DayMarkView mark={day.mark} color={color} />
        </View>
      ))}
    </View>
  );
}

function DayMarkView({ mark, color }: { mark: DayMark; color: string }) {
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
});
