import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MonthGrid } from '@/components/MonthGrid';
import { Text } from '@/components/Text';
import type { InjectionRow, MedicationRow } from '@/db/types';
import { getBodySite } from '@/domain/bodySites';
import { formatDose } from '@/domain/units';
import {
  listInjectionMarks,
  listInjections,
  softDeleteInjection,
  type InjectionMark,
} from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import { refreshScheduledReminders } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { endOfDay, fmtDayLabel, fmtTime, startOfDay } from '@/utils/date';

type HistoryMode = 'list' | 'calendar';

interface HistoryDay {
  key: string;
  label: string;
  at: number;
  injections: InjectionRow[];
}

/**
 * How many shots the list reads at a time.
 *
 * The screen used to read 500 shots once and hand the same rows to the list and
 * to the calendar. Two daily medications pass 500 in under a year, so the older
 * months drew empty and the day under them said the user had logged nothing.
 * The calendar now reads the month it shows, and the list reads a page and says
 * how many shots it is showing.
 */
const PAGE_SIZE = 200;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [mode, setMode] = useState<HistoryMode>('list');
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [medications, setMedications] = useState<Record<string, MedicationRow>>({});
  const [listLimit, setListLimit] = useState(PAGE_SIZE);
  // Null means Poke has not read yet. Every empty state on this screen makes a
  // claim about the user's own data, so none of them may render over a query
  // that has not answered.
  const [listRows, setListRows] = useState<InjectionRow[] | null>(null);
  const [listHasMore, setListHasMore] = useState(false);
  const [monthDots, setMonthDots] = useState<ReadonlyMap<string, readonly string[]>>(() => new Map());
  const [dayRows, setDayRows] = useState<InjectionRow[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const selectedDay = startOfDay(selected.getTime());

  useEffect(() => {
    let live = true;
    listMedications(true)
      .then((rows) => {
        if (!live) return;
        const byId: Record<string, MedicationRow> = {};
        for (const medication of rows) byId[medication.id] = medication;
        setMedications(byId);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [dataVersion]);

  // One page of shots, newest first. The extra row answers "is there more"
  // without a second query, and it never reaches the screen.
  useEffect(() => {
    if (mode !== 'list') return;
    let live = true;
    listInjections({ limit: listLimit + 1 })
      .then((rows) => {
        if (!live) return;
        setListHasMore(rows.length > listLimit);
        setListRows(rows.slice(0, listLimit));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [dataVersion, listLimit, mode]);

  // The dots for the month on screen, and only that month.
  useEffect(() => {
    if (mode !== 'calendar') return;
    let live = true;
    listInjectionMarks(startOfMonth(month).getTime(), endOfMonth(month).getTime())
      .then((marks) => { if (live) setMonthDots(groupMarksByDay(marks)); })
      .catch(() => {});
    return () => { live = false; };
  }, [dataVersion, mode, month]);

  // The rows for the day the user tapped, read from the day itself rather than
  // filtered out of a capped list.
  useEffect(() => {
    if (mode !== 'calendar') return;
    let live = true;
    setDayRows(null);
    listInjections({ fromMs: selectedDay, toMs: endOfDay(selectedDay) })
      .then((rows) => { if (live) setDayRows(rows); })
      .catch(() => {});
    return () => { live = false; };
  }, [dataVersion, mode, selectedDay]);

  // A shot logged on the wrong medication skews the level curve and the rotation
  // until it goes. The row soft deletes, so every list query drops it from here on.
  const deleteInjection = useCallback(async (injection: InjectionRow, medicationName: string | null) => {
    const dose = formatDose(injection.dose, injection.unit);
    const when = `${fmtDayLabel(injection.taken_at)} at ${fmtTime(injection.taken_at).toLocaleLowerCase()}`;
    const confirmed = await confirmDelete(
      'Delete this shot?',
      `Poke removes ${medicationName ?? 'Unknown medication'} ${dose} from ${when}. You cannot undo this.`,
    );
    if (!confirmed) return;
    setDeletingId(injection.id);
    try {
      await softDeleteInjection(injection.id);
      await refreshScheduledReminders().catch(() => {});
      bumpVersion();
    } catch (error: unknown) {
      Alert.alert('Poke could not delete your shot', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setDeletingId(null);
    }
  }, [bumpVersion]);

  const grouped = useMemo(() => groupByDay(listRows ?? []), [listRows]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <Text variant="display">History</Text>
        <SegmentedControl value={mode} onChange={setMode} />

        {mode === 'calendar' ? (
          <>
            <MonthGrid
              month={month}
              onMonthChange={setMonth}
              dotsByDay={monthDots}
              medications={medications}
              selected={selected}
              onSelect={setSelected}
            />
            <HistoryGroup
              label={format(selected, 'EEEE, MMMM d')}
              day={selected}
              injections={dayRows}
              medications={medications}
              deletingId={deletingId}
              onDelete={deleteInjection}
            />
          </>
        ) : listRows === null ? (
          <Card style={styles.emptyDay}>
            <Text color={colors.inkMuted}>Poke is reading your history.</Text>
          </Card>
        ) : grouped.length > 0 ? (
          <>
            {grouped.map((day) => (
              <HistoryGroup
                key={day.key}
                label={day.label}
                day={new Date(day.at)}
                injections={day.injections}
                medications={medications}
                deletingId={deletingId}
                onDelete={deleteInjection}
              />
            ))}
            {listHasMore ? (
              <View style={styles.group}>
                <Text variant="small" color={colors.inkMuted}>
                  Poke shows your {listRows.length} most recent shots. Your older shots
                  are still here and the calendar reaches all of them.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => setListLimit((limit) => limit + PAGE_SIZE)}
                >
                  {`Show ${PAGE_SIZE} more shots`}
                </Button>
              </View>
            ) : null}
          </>
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
  day,
  injections,
  medications,
  deletingId,
  onDelete,
}: {
  label: string;
  day: Date;
  /** Null until the query answers. See the empty states. */
  injections: readonly InjectionRow[] | null;
  medications: Readonly<Record<string, MedicationRow>>;
  deletingId: string | null;
  onDelete: (injection: InjectionRow, medicationName: string | null) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      {injections === null ? (
        <Card style={styles.emptyDay}>
          <Text color={colors.inkMuted}>Poke is reading this day.</Text>
        </Card>
      ) : injections.length > 0 ? (
        <Card padding="xs" style={styles.rows}>
          {injections.map((injection, index) => (
            <HistoryRow
              key={injection.id}
              injection={injection}
              medication={medications[injection.medication_id] ?? null}
              divider={index < injections.length - 1}
              deleting={deletingId === injection.id}
              onDelete={onDelete}
            />
          ))}
        </Card>
      ) : (
        <EmptyDay day={day} />
      )}
    </View>
  );
}

/**
 * A day the user tapped that holds no shot.
 *
 * The button carries the day to the log screen. It used to open on today, so a
 * user filing a shot they forgot on Tuesday got a row on the wrong day.
 *
 * The calendar also reaches days that have not arrived. A log records a shot
 * that happened, so a future day gets the sentence and no button.
 */
function EmptyDay({ day }: { day: Date }) {
  const dayStart = startOfDay(day.getTime());
  const todayStart = startOfDay(Date.now());
  if (dayStart > todayStart) {
    return (
      <Card style={styles.emptyDay}>
        <Text color={colors.inkMuted}>
          This day has not arrived. Poke logs a shot on the day you take it.
        </Text>
      </Card>
    );
  }
  const past = dayStart < todayStart;
  return (
    <Card style={styles.emptyDay}>
      <Text color={colors.inkMuted}>You logged no shot on this day.</Text>
      <Button
        size="sm"
        onPress={() => router.push(past
          ? { pathname: '/log-shot', params: { takenAt: String(dayStart) } }
          : '/log-shot')}
      >
        {past ? 'Log shot on this day' : 'Log shot'}
      </Button>
    </Card>
  );
}

function HistoryRow({
  injection,
  medication,
  divider,
  deleting,
  onDelete,
}: {
  injection: InjectionRow;
  medication: MedicationRow | null;
  divider: boolean;
  deleting: boolean;
  onDelete: (injection: InjectionRow, medicationName: string | null) => void;
}) {
  const site = injection.site_id ? getBodySite(injection.site_id) : undefined;
  const color = medication
    ? colors.med[medication.color_index % colors.med.length] ?? colors.accent
    : colors.inkSubtle;
  const name = medication?.name ?? 'Unknown medication';
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={[styles.medicationDot, { backgroundColor: color }]} />
      <View style={styles.rowCopy}>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="small" color={colors.inkMuted}>
          {fmtTime(injection.taken_at).toLocaleLowerCase()}{' '}
          {site ? `in the ${site.label.toLocaleLowerCase()}` : 'with no site'}
        </Text>
      </View>
      <Text variant="smallStrong">{formatDose(injection.dose, injection.unit)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete the ${name} shot from ${fmtDayLabel(injection.taken_at)} at ${fmtTime(injection.taken_at)}`}
        accessibilityState={{ disabled: deleting }}
        onPress={() => onDelete(injection, medication?.name ?? null)}
        disabled={deleting}
        style={[styles.delete, deleting && styles.deleteBusy]}
      >
        <Trash2 size={18} color={colors.inkSubtle} />
      </Pressable>
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

/**
 * Ask before a delete, and name the shot in the question. `Alert.alert` is a no-op
 * on react-native-web, and the web preview is the fast loop, so ask through the
 * browser there instead of dropping the step.
 */
function confirmDelete(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete shot', style: 'destructive', onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) },
    );
  });
}

function groupByDay(injections: readonly InjectionRow[]): HistoryDay[] {
  const groups = new Map<string, HistoryDay>();
  for (const injection of injections) {
    const key = format(injection.taken_at, 'yyyy-MM-dd');
    const existing = groups.get(key);
    if (existing) existing.injections.push(injection);
    else {
      groups.set(key, {
        key,
        label: fmtDayLabel(injection.taken_at),
        at: injection.taken_at,
        injections: [injection],
      });
    }
  }
  return Array.from(groups.values());
}

/**
 * Which medications have a shot on each day, keyed the way the grid reads a
 * square. The grouping is in JavaScript rather than in SQL because a day is a
 * local day here and `date-fns` already answers that on both platforms.
 */
function groupMarksByDay(marks: readonly InjectionMark[]): ReadonlyMap<string, readonly string[]> {
  const days = new Map<string, string[]>();
  for (const mark of marks) {
    const key = format(mark.takenAt, 'yyyy-MM-dd');
    const medicationIds = days.get(key);
    if (!medicationIds) days.set(key, [mark.medicationId]);
    else if (!medicationIds.includes(mark.medicationId)) medicationIds.push(mark.medicationId);
  }
  return days;
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
  delete: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  deleteBusy: {
    opacity: 0.4,
  },
  emptyDay: {
    gap: spacing.md,
  },
});
