import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, isSameDay } from 'date-fns';
import { Flame } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { TodayHeroCard } from '@/components/today-hero-card';
import { TodayMedicationList } from '@/components/today-medication-list';
import { TodayTrackCard } from '@/components/today-track-card';
import type {
  DayMark,
  DoseState,
  LevelPoint,
  LevelSeries,
  TodayMedicationSummary,
  WeekDay,
} from '@/components/today-types';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
} from '@/db/types';
import type { Unit } from '@/domain/peptides';
import { estimatedLevelAt, suggestedLevelWindowHours, tmaxOrDefault } from '@/domain/pk';
import {
  medicationScheduleFromStored,
  nextScheduledDoses,
  scheduledDosesBetween,
} from '@/domain/scheduling';
import {
  computeMedicationScheduleStreak,
  type ScheduleStreak,
} from '@/domain/streaks';
import type { WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications, reorderMedications } from '@/repositories/medications';
import { getPreferences, setFocusedMedicationId } from '@/repositories/preferences';
import { listSideEffects, type SideEffectLog } from '@/repositories/sideEffects';
import { maybePromptForReview } from '@/services/review';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { endOfDay, startOfDay } from '@/utils/date';

const HOUR_MS = 60 * 60 * 1000;
const CONTENT_MAX_WIDTH = 600;
/** Three days behind today and three ahead: the week the axis draws. */
const WEEK_LOOKBACK_DAYS = 3;
const CURVE_STEPS_PAST = 100;
const CURVE_STEPS_FUTURE = 40;

interface TodayDashboard {
  medications: TodayMedicationSummary[];
  weight: MeasurementRow | null;
  weightUnit: WeightUnit;
  sideEffect: SideEffectLog | null;
  streak: ScheduleStreak;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const handoffMedicationId = useAppStore((state) => state.focusMedicationId);
  const setFocusMedication = useAppStore((state) => state.setFocusMedication);
  const pro = useIsPro();

  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<Record<string, InjectionRow[]>>({});
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [medicationRows, weightRows, preferenceRow, effectRows] = await Promise.all([
        listMedications(),
        listMeasurements('weight', { limit: 1 }),
        getPreferences(),
        listSideEffects({ limit: 1 }),
      ]);
      const active = medicationRows.filter((medication) => medication.status === 'active');
      const shotLists = await Promise.all(
        active.map((medication) => listInjections({ medicationId: medication.id, limit: 500 })),
      );
      const byMedication: Record<string, InjectionRow[]> = {};
      active.forEach((medication, index) => {
        byMedication[medication.id] = shotLists[index] ?? [];
      });
      setMedications(active);
      setInjections(byMedication);
      setWeights(weightRows);
      setPreferences(preferenceRow);
      setSideEffects(effectRows);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [dataVersion, load]);

  useFocusEffect(useCallback(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;
    const syncClock = () => {
      const current = Date.now();
      setNow(current);
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(
        syncClock,
        Math.max(1000, endOfDay(current) - current + 1000),
      );
    };
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncClock();
    });

    syncClock();
    return () => {
      clearTimeout(midnightTimer);
      appStateSubscription.remove();
    };
  }, []));

  const dashboard = useMemo(
    () => buildDashboard({
      medications,
      injections,
      weights,
      preferences,
      sideEffects,
      now,
    }),
    [injections, medications, now, preferences, sideEffects, weights],
  );

  /**
   * Which card the screen opens on.
   *
   * The saved focus wins, because the user put it there. A medication that is
   * due today does not: the row chip says "Due" and the log band is one tap
   * away, and a screen that rearranges itself around the calendar is a screen
   * you cannot learn. The only thing that overrides the saved focus is the
   * medication a just-logged shot names, which is the user pointing at it.
   */
  useEffect(() => {
    if (!hasLoaded) return;
    const validIds = new Set(dashboard.medications.map((summary) => summary.medication.id));

    if (handoffMedicationId) {
      if (validIds.has(handoffMedicationId)) {
        setFocusedId(handoffMedicationId);
        setFocusedMedicationId(handoffMedicationId).catch(() => {});
      }
      setFocusMedication(null);
      return;
    }

    setFocusedId((current) => {
      if (current && validIds.has(current)) return current;
      const saved = preferences?.focused_medication_id ?? null;
      if (saved && validIds.has(saved)) return saved;
      return dashboard.medications[0]?.medication.id ?? null;
    });
  }, [
    dashboard.medications,
    handoffMedicationId,
    hasLoaded,
    preferences?.focused_medication_id,
    setFocusMedication,
  ]);

  const focused = dashboard.medications.find(
    (summary) => summary.medication.id === focusedId,
  ) ?? dashboard.medications[0] ?? null;
  const rest = dashboard.medications.filter(
    (summary) => summary.medication.id !== focused?.medication.id,
  );

  const selectMedication = useCallback((medicationId: string) => {
    setFocusedId(medicationId);
    setFocusedMedicationId(medicationId).catch(() => {});
  }, []);

  /**
   * The list shows every medication but the focused one, so the order it hands
   * back has a hole in it. The focused medication keeps the slot it already
   * had, and the dragged rows fill the rest in the order they now read.
   */
  const reorder = useCallback((visibleIds: readonly string[]) => {
    const fullIds = mergeOrder(
      medications.map((medication) => medication.id),
      focused?.medication.id ?? null,
      visibleIds,
    );
    setMedications((current) => [...current].sort(
      (first, second) => fullIds.indexOf(first.id) - fullIds.indexOf(second.id),
    ));
    reorderMedications(fullIds).catch(() => {});
  }, [focused?.medication.id, medications]);

  const contentWidth = Math.max(
    0,
    Math.min(windowWidth, CONTENT_MAX_WIDTH) - spacing.screen * 2,
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const streakWeeks = dashboard.streak.current;
  useEffect(() => {
    if (streakWeeks < 4) return;
    const timer = setTimeout(() => {
      maybePromptForReview('streak').catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [streakWeeks]);

  return (
    <View style={styles.root}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        )}
      >
        <TodayHeader streak={dashboard.streak.current} now={now} />

        {!hasLoaded ? (
          loadError ? <TodayLoadError onRetry={() => load().catch(() => {})} /> : <TodayLoading />
        ) : (
          <>
            {focused ? (
              <TodayHeroCard
                summary={focused}
                pro={pro}
                contentWidth={contentWidth}
                nowMs={now}
              />
            ) : null}

            <TodayMedicationList
              rows={rest}
              onSelect={selectMedication}
              onReorder={reorder}
              onDragChange={setDragging}
            />
          </>
        )}

        <TodayTrackCard
          weight={dashboard.weight}
          weightUnit={dashboard.weightUnit}
          sideEffect={dashboard.sideEffect}
        />
      </ScrollView>
    </View>
  );
}

function TodayHeader({ streak, now }: { streak: number; now: number }) {
  return (
    <View style={styles.header}>
      <Text variant="bodyStrong">{format(now, 'EEEE, MMMM d')}</Text>
      {streak >= 2 ? (
        <View accessible accessibilityLabel={`${streak}-week streak`} style={styles.streakChip}>
          <Flame size={15} fill={colors.accent} color={colors.accent} />
          <Text variant="caption" color={colors.successDeep}>{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TodayLoading() {
  return (
    <Card style={styles.stateCard}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="small" color={colors.inkMuted}>Loading today…</Text>
    </Card>
  );
}

function TodayLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card style={styles.errorCard}>
      <Text variant="h2">Today did not load.</Text>
      <Text color={colors.inkMuted}>Your saved data is still on this device.</Text>
      <Button onPress={onRetry}>Try again</Button>
    </Card>
  );
}

function buildDashboard({
  medications,
  injections,
  weights,
  preferences,
  sideEffects,
  now,
}: {
  medications: readonly MedicationRow[];
  injections: Readonly<Record<string, readonly InjectionRow[]>>;
  weights: readonly MeasurementRow[];
  preferences: PreferencesRow | null;
  sideEffects: readonly SideEffectLog[];
  now: number;
}): TodayDashboard {
  const reminderTime = preferences?.reminder_time ?? '09:00';
  const summaries = medications.map((medication): TodayMedicationSummary => {
    const medicationInjections = injections[medication.id] ?? [];
    const schedule = medicationScheduleFromStored({
      medicationId: medication.id,
      frequencyKind: medication.frequency_kind,
      frequencyValue: medication.frequency_value,
      createdAt: medication.created_at,
      reminderTime,
    });
    const dose = buildDoseState({
      latestInjection: medicationInjections[0] ?? null,
      schedule,
      now,
    });
    const windowHours = suggestedLevelWindowHours(medication.half_life_hours);
    const windowFromMs = now - windowHours * HOUR_MS;
    const nextDoseAt = nextDoseFrom(dose);
    // Ahead of now the chart draws to the next dose. With no next dose there is
    // nothing to draw toward, so it shows a fraction of the window instead and
    // the curve simply runs off the right edge, which is what it does.
    const windowToMs = nextDoseAt ?? now + windowHours * 0.15 * HOUR_MS;

    return {
      medication,
      dose,
      week: buildWeek({ injections: medicationInjections, dose, schedule, now }),
      level: buildLevelSeries({
        injections: medicationInjections,
        medication,
        now,
        fromMs: windowFromMs,
        toMs: windowToMs,
        nextDoseAt,
      }),
      windowFromMs,
      windowToMs,
    };
  });

  const streak = computeMedicationScheduleStreak({
    medications: medications.map((row) => ({
      id: row.id,
      frequencyKind: row.frequency_kind,
      frequencyValue: row.frequency_value,
      createdAt: row.created_at,
    })),
    injections: Object.values(injections).flatMap((rows) => rows.map((row) => ({
      id: row.id,
      medicationId: row.medication_id,
      takenAt: row.taken_at,
    }))),
    reminderTime,
    now,
  }) ?? { current: 0, best: 0, weeks: [] };

  return {
    medications: summaries,
    weight: weights[0] ?? null,
    weightUnit: preferences?.weight_unit ?? 'lb',
    sideEffect: sideEffects[0] ?? null,
    streak,
  };
}

function buildDoseState({
  latestInjection,
  schedule,
  now,
}: {
  latestInjection: InjectionRow | null;
  schedule: ReturnType<typeof medicationScheduleFromStored>;
  now: number;
}): DoseState {
  const endOfToday = endOfDay(now);
  const nextScheduledAt = schedule
    ? nextScheduledDoses(schedule, endOfToday, 1)[0]?.scheduledAt ?? null
    : null;

  if (latestInjection && isSameDay(latestInjection.taken_at, now)) {
    return { kind: 'loggedToday', injection: latestInjection, nextScheduledAt };
  }
  if (!schedule) return { kind: 'unscheduled' };

  const scheduledToday = scheduledDosesBetween(schedule, startOfDay(now), endOfToday)[0];
  if (scheduledToday) return { kind: 'due', scheduledAt: scheduledToday.scheduledAt };
  if (nextScheduledAt !== null) return { kind: 'upcoming', scheduledAt: nextScheduledAt };
  return { kind: 'unscheduled' };
}

function nextDoseFrom(dose: DoseState): number | null {
  switch (dose.kind) {
    case 'due':
    case 'upcoming':
      return dose.scheduledAt;
    case 'loggedToday':
      return dose.nextScheduledAt;
    case 'unscheduled':
      return null;
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

/** The seven days under the chart, marked for this medication only. */
function buildWeek({
  injections,
  dose,
  schedule,
  now,
}: {
  injections: readonly InjectionRow[];
  dose: DoseState;
  schedule: ReturnType<typeof medicationScheduleFromStored>;
  now: number;
}): WeekDay[] {
  const today = startOfDay(now);
  const days: number[] = [];
  for (let offset = -WEEK_LOOKBACK_DAYS; offset < 7 - WEEK_LOOKBACK_DAYS; offset += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    date.setHours(0, 0, 0, 0);
    days.push(date.getTime());
  }
  const first = days[0] ?? today;
  const last = days[days.length - 1] ?? today;

  const loggedDays = new Set<number>();
  for (const injection of injections) {
    if (injection.taken_at < first || injection.taken_at > endOfDay(last)) continue;
    loggedDays.add(startOfDay(injection.taken_at));
  }
  const scheduledDays = new Set<number>(
    schedule
      ? scheduledDosesBetween(schedule, first, endOfDay(last)).map((entry) => entry.scheduledDay)
      : [],
  );

  return days.map((dayStart): WeekDay => {
    const isToday = dayStart === today;
    let mark: DayMark = 'rest';
    if (loggedDays.has(dayStart)) mark = 'logged';
    else if (isToday && dose.kind === 'due') mark = 'due';
    else if (scheduledDays.has(dayStart)) mark = 'scheduled';
    return { dayStart, mark, isToday };
  });
}

function buildLevelSeries({
  injections,
  medication,
  now,
  fromMs,
  toMs,
  nextDoseAt,
}: {
  injections: readonly InjectionRow[];
  medication: MedicationRow;
  now: number;
  fromMs: number;
  toMs: number;
  nextDoseAt: number | null;
}): LevelSeries {
  const halfLife = medication.half_life_hours;
  // A medication with no half-life on file draws its shots instead of a curve.
  // Poke cannot model it, and saying so in a sentence shows nothing.
  if (halfLife === null || halfLife <= 0) {
    return {
      kind: 'shots',
      shots: injections
        .filter((injection) => injection.taken_at >= fromMs && injection.taken_at <= toMs)
        .map((injection) => injection.taken_at),
    };
  }
  if (injections.length === 0) return { kind: 'empty', nextDoseAt };

  const doses = injections
    .map((injection) => {
      const dose = doseIn(injection.dose, injection.unit, medication.default_unit);
      return dose === null ? null : { takenAt: injection.taken_at, dose };
    })
    .filter((dose): dose is { takenAt: number; dose: number } => dose !== null);
  if (doses.length === 0) return { kind: 'empty', nextDoseAt };

  const tmax = tmaxOrDefault(halfLife, medication.tmax_hours);
  const sample = (t: number): LevelPoint => ({
    t,
    v: estimatedLevelAt(doses, halfLife, tmax, t),
  });
  const past = seriesBetween(fromMs, now, CURVE_STEPS_PAST).map(sample);
  const future = toMs > now ? seriesBetween(now, toMs, CURVE_STEPS_FUTURE).map(sample) : [];

  return {
    kind: 'curve',
    past,
    future,
    current: estimatedLevelAt(doses, halfLife, tmax, now),
    nextDoseAt,
  };
}

function seriesBetween(fromMs: number, toMs: number, steps: number): number[] {
  const out: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    out.push(fromMs + ((toMs - fromMs) * index) / steps);
  }
  return out;
}

/**
 * A logged shot keeps the unit it was logged in, and the curve adds numbers, so
 * they all have to be in the medication's unit before anything sums them. IU is
 * medication specific and converts to nothing, so that shot stays out.
 */
function doseIn(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value;
  if (from === 'mg' && to === 'mcg') return value * 1000;
  if (from === 'mcg' && to === 'mg') return value / 1000;
  return null;
}

function mergeOrder(
  fullIds: readonly string[],
  focusedId: string | null,
  visibleIds: readonly string[],
): string[] {
  const queue = [...visibleIds];
  return fullIds.map((id) => (id === focusedId ? id : queue.shift() ?? id));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  header: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakChip: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  stateCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorCard: {
    gap: spacing.lg,
  },
});
