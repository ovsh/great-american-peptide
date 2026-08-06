import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
} from 'date-fns';

import { Card } from './Card';
import { Text } from './Text';
import type { InjectionRow, MedicationRow } from '../db/types';
import { colors, radius, spacing } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface MonthGridProps {
  injections: readonly InjectionRow[];
  medications: Readonly<Record<string, MedicationRow>>;
  selected: Date;
  onSelect: (date: Date) => void;
}

export function MonthGrid({ injections, medications, selected, onSelect }: MonthGridProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(selected));
  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const padding = Array.from({ length: getDay(first) }, () => null);
    return [...padding, ...eachDayOfInterval({ start: first, end: endOfMonth(cursor) })];
  }, [cursor]);
  const dotsByDay = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const injection of injections) {
      const key = format(injection.taken_at, 'yyyy-MM-dd');
      const medicationIds = result.get(key) ?? new Set<string>();
      medicationIds.add(injection.medication_id);
      result.set(key, medicationIds);
    }
    return result;
  }, [injections]);

  const moveMonth = (amount: number) => {
    const next = addMonths(cursor, amount);
    setCursor(next);
    if (!isSameMonth(selected, next)) onSelect(startOfMonth(next));
  };

  return (
    <Card style={styles.card}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => moveMonth(-1)}
          style={styles.navButton}
        >
          <ChevronLeft size={20} color={colors.ink} />
        </Pressable>
        <Text variant="h3">{format(cursor, 'MMMM yyyy')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => moveMonth(1)}
          style={styles.navButton}
        >
          <ChevronRight size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday, index) => (
          <View key={`${weekday}-${index}`} style={styles.weekCell}>
            <Text variant="caption" color={colors.inkSubtle}>{weekday}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day, index) => {
          if (!day) return <View key={`padding-${index}`} style={styles.cell} />;
          const selectedDay = isSameDay(day, selected);
          const medicationIds = dotsByDay.get(format(day, 'yyyy-MM-dd'));
          return (
            <Pressable
              key={day.getTime()}
              accessibilityRole="radio"
              accessibilityLabel={format(day, 'EEEE, MMMM d')}
              accessibilityState={{ selected: selectedDay }}
              onPress={() => onSelect(day)}
              style={styles.cell}
            >
              <View style={[styles.day, isToday(day) && styles.today, selectedDay && styles.selectedDay]}>
                <Text variant="smallStrong" color={selectedDay ? colors.inkInverse : colors.ink}>
                  {format(day, 'd')}
                </Text>
              </View>
              <View style={styles.dots}>
                {medicationIds
                  ? Array.from(medicationIds).slice(0, 3).map((medicationId) => {
                      const medication = medications[medicationId];
                      const color = medication
                        ? colors.med[medication.color_index % colors.med.length] ?? colors.accent
                        : colors.inkSubtle;
                      return <View key={medicationId} style={[styles.dot, { backgroundColor: color }]} />;
                    })
                  : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    backgroundColor: colors.accentSoft,
  },
  selectedDay: {
    backgroundColor: colors.accent,
  },
  dots: {
    height: 5,
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
