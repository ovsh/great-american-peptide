// History — the month board.
//
// A list answers "what did I take on the 4th". A month answers "am I actually
// doing this", which is why this tab gets opened. So there is no list, no
// List/Calendar toggle and no month cursor: months stack in one continuous
// scroll, oldest above, and the only thing you select is a day.
//
// The month label at the top is a label, not a control. The one control beside
// it is the Today chip, and it goes quiet when you are already on today.
// Tapping a day raises the half sheet; the board never reflows under the finger.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { HistoryDaySheet } from '../../src/components/history-day-sheet';
import {
  HistoryMonthSection,
  monthLabel,
  monthSectionHeight,
} from '../../src/components/history-month-section';
import type { MedicationRow } from '../../src/db/types';
import {
  addLocalMonths,
  monthStartsBetween,
  startOfLocalMonth,
  type BoardDay,
} from '../../src/domain/historyBoard';
import type { WeightUnit } from '../../src/domain/units';
import { listMedications } from '../../src/repositories/medications';
import { getPreferences } from '../../src/repositories/preferences';
import { useAppStore } from '../../src/stores/app';
import { colors, radius, spacing } from '../../src/theme';

/** The month bar's own height. The status bar sits above it, not inside it. */
const BAR_HEIGHT = 44;
/** The gap above the first month, matching the gap between months. */
const LIST_TOP = 10;
/** Clear of the tab bar and the centre button. */
const LIST_BOTTOM = 112;
/**
 * How far back the board scrolls before the first medication existed.
 *
 * Onboarding can record a last shot taken before the medication row was
 * written, so the board opens one month earlier than the oldest medication
 * rather than ending exactly on it.
 */
const LEAD_MONTHS = 1;
/** A guard on a bad `created_at`: the board is a treatment log, not an archive. */
const MAX_MONTHS = 72;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const bumpVersion = useAppStore((state) => state.bumpVersion);

  const [ready, setReady] = useState(false);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<BoardDay | null>(null);

  const listRef = useRef<FlatList<number>>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      // The day can have turned over while the app was in the background, so
      // "today" is read again on every focus, not once per mount.
      setNow(Date.now());
      Promise.all([listMedications(true), getPreferences()])
        .then(([rows, preferences]) => {
          if (!alive) return;
          setMedications(rows);
          setReminderTime(preferences.reminder_time ?? '09:00');
          setWeightUnit(preferences.weight_unit === 'kg' ? 'kg' : 'lb');
          setReady(true);
        })
        .catch(() => {
          if (alive) setReady(true);
        });
      return () => {
        alive = false;
      };
      // Medications and preferences change on other screens, so focus is the
      // trigger. `dataVersion` moves when a shot is logged or deleted, and the
      // months and the sheet read it themselves.
    }, []),
  );

  /** The lanes: every medication still on the list, in the order the user put them. */
  const lanes = useMemo(
    () => medications.filter((medication) => medication.status !== 'archived'),
    [medications],
  );
  const medicationsById = useMemo(
    () => new Map(medications.map((medication) => [medication.id, medication])),
    [medications],
  );

  const months = useMemo(() => {
    const thisMonth = startOfLocalMonth(now);
    if (medications.length === 0) return [thisMonth];
    const oldest = medications.reduce((min, medication) => Math.min(min, medication.created_at), now);
    const first = addLocalMonths(startOfLocalMonth(oldest), -LEAD_MONTHS);
    const all = monthStartsBetween(Math.min(first, thisMonth), thisMonth);
    return all.length > MAX_MONTHS ? all.slice(all.length - MAX_MONTHS) : all;
  }, [medications, now]);

  const laneCount = lanes.length;
  const heights = useMemo(
    () => months.map((month) => monthSectionHeight(month, laneCount)),
    [months, laneCount],
  );
  const offsets = useMemo(() => {
    let running = LIST_TOP;
    return heights.map((height) => {
      const offset = running;
      running += height;
      return offset;
    });
  }, [heights]);

  const monthCount = months.length;
  const lastIndex = monthCount - 1;
  const onToday = visibleIndex >= lastIndex;

  // The list opens on the newest month, and `initialScrollIndex` does not raise
  // a scroll event, so the bar is told where it landed. The count is the
  // trigger, not the array: `months` is rebuilt on every focus, and resetting on
  // that would drag the bar back to this month over a board still on 2024.
  useEffect(() => {
    setVisibleIndex(monthCount - 1);
  }, [monthCount]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y + LIST_TOP;
      let index = 0;
      for (let step = 0; step < offsets.length; step += 1) {
        if (offsets[step] <= y) index = step;
        else break;
      }
      setVisibleIndex((current) => (current === index ? current : index));
    },
    [offsets],
  );

  const jumpToToday = useCallback(() => {
    if (lastIndex < 0) return;
    listRef.current?.scrollToIndex({ index: lastIndex, animated: true });
  }, [lastIndex]);

  const openLogShot = useCallback((day: BoardDay) => {
    setSelected(null);
    router.push(
      day.isPast
        ? { pathname: '/log-shot', params: { takenAt: String(day.dayStart) } }
        : '/log-shot',
    );
  }, []);

  const renderMonth = useCallback(
    ({ item }: { item: number }) => (
      <HistoryMonthSection
        monthStart={item}
        lanes={lanes}
        reminderTime={reminderTime}
        now={now}
        dataVersion={dataVersion}
        selectedDay={selected?.dayStart ?? null}
        onSelectDay={setSelected}
      />
    ),
    [lanes, reminderTime, now, dataVersion, selected],
  );

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.bar,
          { height: BAR_HEIGHT + insets.top, paddingTop: insets.top },
          onToday ? null : styles.barRule,
        ]}
      >
        <Text variant="h2" numberOfLines={1} style={styles.barLabel}>
          {monthLabel(months[visibleIndex] ?? now)}
        </Text>
        <Pressable
          testID="history-today-chip"
          accessibilityRole="button"
          accessibilityLabel="Go to this month"
          onPress={jumpToToday}
          style={[styles.chip, onToday ? null : styles.chipAway]}
        >
          <View style={[styles.chipDot, onToday ? null : styles.chipDotAway]} />
          <Text
            variant="caption"
            color={onToday ? colors.inkMuted : colors.successDeep}
            style={styles.chipLabel}
          >
            Today
          </Text>
        </Pressable>
      </View>

      {ready ? (
        <FlatList
          ref={listRef}
          data={months}
          keyExtractor={(month) => String(month)}
          renderItem={renderMonth}
          getItemLayout={(_, index) => ({
            length: heights[index] ?? 0,
            offset: offsets[index] ?? LIST_TOP,
            index,
          })}
          initialScrollIndex={lastIndex > 0 ? lastIndex : undefined}
          onScrollToIndexFailed={() => listRef.current?.scrollToEnd({ animated: false })}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={<View style={styles.listTop} />}
          ListFooterComponent={<View style={{ height: LIST_BOTTOM + insets.bottom }} />}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          removeClippedSubviews={false}
        />
      ) : (
        <View style={styles.listTop} />
      )}

      <HistoryDaySheet
        day={selected}
        lanes={lanes}
        medicationsById={medicationsById}
        weightUnit={weightUnit}
        dataVersion={dataVersion}
        onClose={() => setSelected(null)}
        onChanged={bumpVersion}
        onLogShot={openLogShot}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.background,
    zIndex: 3,
  },
  barRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barLabel: {
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipAway: {
    backgroundColor: colors.successSoft,
    borderColor: 'rgba(20,122,82,0.2)',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.inkSubtle,
  },
  chipDotAway: {
    backgroundColor: colors.success,
  },
  chipLabel: {
    fontSize: 13,
  },
  listTop: {
    height: LIST_TOP,
  },
});
