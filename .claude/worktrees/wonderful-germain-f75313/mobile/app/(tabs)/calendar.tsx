import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday, addMonths, getDay,
} from 'date-fns';

import { MastHead } from '@/components/MastHead';
import { TitleBlock } from '@/components/TitleBlock';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Section } from '@/components/Section';

import { listInjections } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import type { InjectionRow, MedicationRow } from '@/db/types';
import { fmtTime } from '@/utils/date';
import { formatDose } from '@/domain/units';
import { useAppStore } from '@/stores/app';
import { colors, spacing } from '@/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [cursor, setCursor] = useState(new Date());
  const [injections, setInjections] = useState<InjectionRow[]>([]);
  const [meds, setMeds] = useState<Map<string, MedicationRow>>(new Map());
  const [selected, setSelected] = useState<Date>(new Date());

  const load = useCallback(async (anchor: Date) => {
    const from = startOfMonth(addMonths(anchor, -1)).getTime();
    const to = endOfMonth(addMonths(anchor, 1)).getTime();
    const [list, ms] = await Promise.all([
      listInjections({ fromMs: from, toMs: to, limit: 500 }),
      listMedications(true),
    ]);
    setInjections(list);
    setMeds(new Map(ms.map((m) => [m.id, m])));
  }, []);

  useEffect(() => { load(cursor); }, [cursor, load, dataVersion]);

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const firstDay = getDay(start);
    const all = eachDayOfInterval({ start, end });
    const padding = Array(firstDay).fill(null);
    return [...padding, ...all];
  }, [cursor]);

  const dotsByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const inj of injections) {
      const key = format(new Date(inj.taken_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(inj.medication_id);
    }
    return map;
  }, [injections]);

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const selectedInjections = injections
    .filter((i) => format(new Date(i.taken_at), 'yyyy-MM-dd') === selectedKey)
    .sort((a, b) => b.taken_at - a.taken_at);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero + 80 }}>
        <MastHead />
        <TitleBlock title="Calendar" />

        <View style={{ paddingHorizontal: spacing.screen }}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setCursor(addMonths(cursor, -1))} hitSlop={10} style={styles.navBtn}>
              <ChevronLeft size={20} color={colors.ink} />
            </Pressable>
            <Text variant="h3">{format(cursor, 'MMMM yyyy')}</Text>
            <Pressable onPress={() => setCursor(addMonths(cursor, 1))} hitSlop={10} style={styles.navBtn}>
              <ChevronRight size={20} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={styles.weekCell}>
                <Text variant="caption" color={colors.inkSubtle}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.cell} />;
              const key = format(day, 'yyyy-MM-dd');
              const dots = dotsByDay.get(key);
              const isSel = isSameDay(day, selected);
              const today = isToday(day);
              return (
                <Pressable key={idx} onPress={() => setSelected(day)} style={styles.cell}>
                  <View style={[styles.dayCircle, isSel && styles.dayCircleActive, today && !isSel && styles.dayCircleToday]}>
                    <Text
                      variant="bodyStrong"
                      color={isSel ? colors.inkInverse : colors.ink}
                      align="center"
                    >
                      {format(day, 'd')}
                    </Text>
                  </View>
                  {dots && (
                    <View style={styles.dotsRow}>
                      {Array.from(dots).slice(0, 3).map((medId, i) => {
                        const m = meds.get(medId);
                        const c = m ? colors.med[m.color_index % colors.med.length] : colors.ink;
                        return <View key={i} style={[styles.dot, { backgroundColor: c }]} />;
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: spacing.xl }} />

        <Section eyebrow={format(selected, 'EEEE, MMM d').toUpperCase()} gap="sm">
          {selectedInjections.length === 0 ? (
            <Card padding="md" variant="muted">
              <Text variant="small" color={colors.inkMuted}>No shots logged on this day.</Text>
            </Card>
          ) : (
            selectedInjections.map((inj) => {
              const med = meds.get(inj.medication_id);
              const accent = med ? colors.med[med.color_index % colors.med.length] : colors.ink;
              return (
                <Card key={inj.id} padding="md" style={styles.entryCard}>
                  <View style={[styles.dotLg, { backgroundColor: accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{med?.name ?? 'Unknown'}</Text>
                    <Text variant="small" color={colors.inkMuted}>
                      {formatDose(inj.dose, inj.unit)} · {inj.route.toUpperCase()}
                    </Text>
                  </View>
                  <Text variant="caption" color={colors.inkMuted}>{fmtTime(inj.taken_at)}</Text>
                </Card>
              );
            })
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
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
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.surfaceInverse,
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: colors.red,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 4,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotLg: { width: 10, height: 10, borderRadius: 5 },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
