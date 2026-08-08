import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { format, isSameDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MonthGrid } from '@/components/MonthGrid';
import { Text } from '@/components/Text';
import type { InjectionRow, MedicationRow } from '@/db/types';
import { getBodySite } from '@/domain/bodySites';
import { formatDose } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { fmtDayLabel, fmtTime } from '@/utils/date';

type HistoryMode = 'list' | 'calendar';

interface HistoryDay {
  key: string;
  label: string;
  injections: InjectionRow[];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [mode, setMode] = useState<HistoryMode>('list');
  const [selected, setSelected] = useState(new Date());
  const [injections, setInjections] = useState<InjectionRow[]>([]);
  const [medications, setMedications] = useState<Record<string, MedicationRow>>({});

  const load = useCallback(async () => {
    const [injectionRows, medicationRows] = await Promise.all([
      listInjections({ limit: 500 }),
      listMedications(true),
    ]);
    const byId: Record<string, MedicationRow> = {};
    for (const medication of medicationRows) byId[medication.id] = medication;
    setInjections(injectionRows);
    setMedications(byId);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [dataVersion, load]);

  const grouped = useMemo(() => groupByDay(injections), [injections]);
  const selectedInjections = useMemo(
    () => injections.filter((injection) => isSameDay(injection.taken_at, selected)),
    [injections, selected],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}> 
        <Text variant="display">History</Text>
        <SegmentedControl value={mode} onChange={setMode} />

        {mode === 'calendar' ? (
          <>
            <MonthGrid
              injections={injections}
              medications={medications}
              selected={selected}
              onSelect={setSelected}
            />
            <HistoryGroup
              label={format(selected, 'EEEE, MMMM d')}
              injections={selectedInjections}
              medications={medications}
            />
          </>
        ) : grouped.length > 0 ? (
          grouped.map((day) => (
            <HistoryGroup
              key={day.key}
              label={day.label}
              injections={day.injections}
              medications={medications}
            />
          ))
        ) : (
          <EmptyHistory />
        )}
      </ScrollView>
    </View>
  );
}

function SegmentedControl({ value, onChange }: { value: HistoryMode; onChange: (mode: HistoryMode) => void }) {
  return (
    <View style={styles.segmented}>
      {(['list', 'calendar'] as const).map((mode) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(mode)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text variant="smallStrong" color={selected ? colors.inkInverse : colors.inkMuted}>
              {mode === 'list' ? 'List' : 'Calendar'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HistoryGroup({
  label,
  injections,
  medications,
}: {
  label: string;
  injections: readonly InjectionRow[];
  medications: Readonly<Record<string, MedicationRow>>;
}) {
  return (
    <View style={styles.group}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      {injections.length > 0 ? (
        <Card padding="xs" style={styles.rows}>
          {injections.map((injection, index) => (
            <HistoryRow
              key={injection.id}
              injection={injection}
              medication={medications[injection.medication_id] ?? null}
              divider={index < injections.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card style={styles.emptyDay}>
          <Text color={colors.inkMuted}>You logged no shot on this day.</Text>
          <Button size="sm" onPress={() => router.push('/log-shot')}>Log shot</Button>
        </Card>
      )}
    </View>
  );
}

function HistoryRow({
  injection,
  medication,
  divider,
}: {
  injection: InjectionRow;
  medication: MedicationRow | null;
  divider: boolean;
}) {
  const site = injection.site_id ? getBodySite(injection.site_id) : undefined;
  const color = medication
    ? colors.med[medication.color_index % colors.med.length] ?? colors.accent
    : colors.inkSubtle;
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={[styles.medicationDot, { backgroundColor: color }]} />
      <View style={styles.rowCopy}>
        <Text variant="bodyStrong">{medication?.name ?? 'Unknown medication'}</Text>
        <Text variant="small" color={colors.inkMuted}>
          {fmtTime(injection.taken_at).toLocaleLowerCase()} · {site?.label ?? 'No site'}
        </Text>
      </View>
      <Text variant="smallStrong">{formatDose(injection.dose, injection.unit)}</Text>
    </View>
  );
}

function EmptyHistory() {
  return (
    <Card style={styles.emptyDay}>
      <Text variant="h2">No shots yet.</Text>
      <Text color={colors.inkMuted}>Every shot you log appears here.</Text>
      <Button onPress={() => router.push('/log-shot')}>Log shot</Button>
    </Card>
  );
}

function groupByDay(injections: readonly InjectionRow[]): HistoryDay[] {
  const groups = new Map<string, HistoryDay>();
  for (const injection of injections) {
    const key = format(injection.taken_at, 'yyyy-MM-dd');
    const existing = groups.get(key);
    if (existing) existing.injections.push(injection);
    else groups.set(key, { key, label: fmtDayLabel(injection.taken_at), injections: [injection] });
  }
  return Array.from(groups.values());
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  segmented: {
    height: 48,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  group: {
    gap: spacing.sm,
  },
  rows: {
    overflow: 'hidden',
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  medicationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  emptyDay: {
    gap: spacing.md,
  },
});
