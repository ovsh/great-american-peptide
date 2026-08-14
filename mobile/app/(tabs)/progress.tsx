import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { dayDistance, type Journey, type JourneyMedication, type ProgressMetric } from '@/components/progress-geometry';
import { ProgressHeaderLine, ProgressJourneyCard } from '@/components/progress-journey-card';
import type { ProgressBandKind } from '@/components/progress-log-band';
import { medicationColor } from '@/components/today-hero-card';
import { TodayRise } from '@/components/today-motion';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
} from '@/db/types';
import {
  medicationScheduleFromStored,
  scheduledDosesBetween,
  weekdayListLabel,
  weekdaysFromMask,
} from '@/domain/scheduling';
import { sideEffectLabel } from '@/domain/sideEffects';
import {
  SCHEDULE_GRACE_DAYS,
  computeMedicationScheduleStreak,
  scheduledDoseWindow,
} from '@/domain/streaks';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications } from '@/repositories/medications';
import { getPreferences } from '@/repositories/preferences';
import { listSideEffects, type SideEffectLog } from '@/repositories/sideEffects';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { arrivalBeats, colors, rise, spacing } from '@/theme';
import { startOfDay } from '@/utils/date';

const CONTENT_MAX_WIDTH = 600;
/** The axis never draws less than a week, so week one is a week and not a dot. */
const MIN_SPAN_DAYS = 7;
/** Under five weeks the months have nothing to name, so the axis names its ends. */
const MONTH_LABEL_FROM_DAYS = 35;
/** How long a weight stands before the log slot asks for the next one. */
const WEIGHT_STALE_DAYS = 3;

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  twice_weekly: 'Twice a week',
  custom: 'No schedule',
};

/**
 * The metric the user last chose, kept for the life of the app run.
 *
 * It is a view preference and not a fact about their treatment, so it does not
 * belong in the database; but coming back to a screen you left on Shots and
 * finding Weight is the screen forgetting you.
 */
let lastMetric: ProgressMetric = 'weight';

/** Everything one load produces, held together so it can be applied in one go. */
interface ProgressData {
  medications: MedicationRow[];
  injections: Record<string, InjectionRow[]>;
  weights: MeasurementRow[];
  preferences: PreferencesRow | null;
  sideEffects: SideEffectLog[];
}

/**
 * Progress: the whole run on one axis.
 *
 * The weight curve, every shot in its medication's own lane, and every side
 * effect above them share one x-axis, so what happened at the same time is drawn
 * at the same place. The three metrics change the band above the rail and
 * nothing else, which is why this is one screen rather than three.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const pro = useIsPro();

  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<Record<string, InjectionRow[]>>({});
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [metric, setMetric] = useState<ProgressMetric>(lastMetric);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Bumped once per weight the user has just logged. Zero has nothing to play. */
  const [logToken, setLogToken] = useState(0);

  const drawnWeight = useRef<string | null | undefined>(undefined);
  const onScreen = useRef(false);
  const held = useRef<{ data: ProgressData; logged: boolean } | null>(null);

  const chooseMetric = useCallback((next: ProgressMetric) => {
    lastMetric = next;
    setMetric(next);
  }, []);

  const apply = useCallback((data: ProgressData, logged: boolean) => {
    setMedications(data.medications);
    setInjections(data.injections);
    setWeights(data.weights);
    setPreferences(data.preferences);
    setSideEffects(data.sideEffects);
    setNow(Date.now());
    setHasLoaded(true);
    // In the same batch as the data, so the chart takes its "before" snapshot
    // from the curve the user actually left behind.
    if (logged) setLogToken((token) => token + 1);
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [medicationRows, weightRows, preferenceRow, effectRows] = await Promise.all([
        listMedications(),
        listMeasurements('weight', { limit: 1000 }),
        getPreferences(),
        listSideEffects({ limit: 500 }),
      ]);
      const active = medicationRows.filter((medication) => medication.status === 'active');
      // Every scheduled dose since a medication started is scored, so the read is
      // bounded by each medication rather than by a shared row count.
      const shotLists = await Promise.all(active.map((medication) => listInjections({
        medicationId: medication.id,
        fromMs: graceStart(medication.created_at),
      })));
      const byMedication: Record<string, InjectionRow[]> = {};
      active.forEach((medication, index) => {
        byMedication[medication.id] = shotLists[index] ?? [];
      });

      const latest = weightRows[0]?.id ?? null;
      const seen = drawnWeight.current;
      const logged = seen !== undefined && latest !== null && latest !== seen;
      drawnWeight.current = latest;

      const data: ProgressData = {
        medications: active,
        injections: byMedication,
        weights: weightRows,
        preferences: preferenceRow,
        sideEffects: effectRows,
      };
      // A weight is logged on its own screen, so the reading almost always lands
      // while Progress is behind it. Applied there and then, the curve would have
      // moved before anyone could see it move.
      if (onScreen.current) apply(data, logged);
      else held.current = { data, logged: logged || (held.current?.logged ?? false) };
    } catch (error) {
      setLoadError(true);
      throw error;
    }
  }, [apply]);

  useEffect(() => {
    load().catch(() => {});
  }, [dataVersion, load]);

  useFocusEffect(useCallback(() => {
    onScreen.current = true;
    const waiting = held.current;
    if (waiting) {
      held.current = null;
      apply(waiting.data, waiting.logged);
    } else {
      setNow(Date.now());
    }
    return () => { onScreen.current = false; };
  }, [apply]));

  const journey = useMemo(
    () => buildJourney({ medications, injections, weights, preferences, sideEffects, now }),
    [injections, medications, now, preferences, sideEffects, weights],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      // The error state is already on screen; the spinner still has to stop.
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={(
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        )}
      >
        {!hasLoaded ? (
          loadError ? <LoadError onRetry={() => load().catch(() => {})} /> : <Loading />
        ) : (
          <>
            <TodayRise show delay={arrivalBeats.header} distance={rise.line}>
              <ProgressHeaderLine journey={journey} />
            </TodayRise>
            <TodayRise show delay={arrivalBeats.hero} distance={rise.card}>
              <ProgressJourneyCard
                journey={journey}
                metric={metric}
                onMetric={chooseMetric}
                pro={pro}
                band={bandKind(journey, now)}
                logToken={logToken}
                now={now}
              />
            </TodayRise>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.inkSubtle} />
    </View>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text color={colors.inkMuted} style={styles.stateCopy}>
        Your journey did not load.
      </Text>
      <Button size="sm" onPress={onRetry}>Try again</Button>
    </View>
  );
}

/**
 * Which emphasis the permanent log slot wears.
 *
 * Solid while the curve is waiting for its next point, soft green for the rest
 * of the day a weight lands, and quiet in between. The action never leaves.
 */
function bandKind(journey: Journey, now: number): ProgressBandKind {
  if (journey.loggedWeightAt !== null) return 'done';
  const last = journey.weights[journey.weights.length - 1];
  if (!last) return 'push';
  return dayDistance(last.takenAt, now) >= WEIGHT_STALE_DAYS ? 'push' : 'idle';
}

/* ------------------------------------------------------------- the journey */

/**
 * Every layer of the screen, in days since the run began.
 *
 * The run starts at the first thing the user did, whichever it was: a weight, a
 * medication, or a shot. Timestamps become day offsets here so nothing under
 * this point has to know what a millisecond is.
 */
function buildJourney({
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
}): Journey {
  const unit: WeightUnit = preferences?.weight_unit ?? 'lb';
  const reminderTime = preferences?.reminder_time ?? '09:00';
  const today = startOfDay(now);

  const stamps = [
    ...weights.map((weight) => weight.taken_at),
    ...medications.map((medication) => medication.created_at),
    ...Object.values(injections).flatMap((rows) => rows.map((row) => row.taken_at)),
  ];
  const startMs = stamps.length > 0 ? startOfDay(Math.min(...stamps)) : today;
  const spanDays = Math.max(MIN_SPAN_DAYS, dayDistance(startMs, now));
  const dayOf = (timestamp: number) => dayDistance(startMs, timestamp);

  const points = weights
    .slice()
    .reverse()
    .map((weight) => ({
      day: dayOf(weight.taken_at),
      value: convertWeight(weight.value, weight.unit, unit),
      takenAt: weight.taken_at,
    }));

  const lanes = medications.map((medication): JourneyMedication => {
    const rows = injections[medication.id] ?? [];
    const shots = uniqueDays(rows.map((row) => dayOf(row.taken_at)));
    const { missed, due } = scoreSchedule(medication, rows, reminderTime, now, dayOf);
    return {
      id: medication.id,
      name: medication.name,
      color: medicationColor(medication.color_index),
      scheduleLabel: frequencyLabel(medication),
      shots,
      missed,
      due,
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

  const latest = points[points.length - 1] ?? null;
  const goal = preferences?.goal_weight ?? null;

  return {
    startMs,
    spanDays,
    sinceLabel: format(startMs, 'd MMM'),
    months: spanDays >= MONTH_LABEL_FROM_DAYS ? monthMarks(startMs, now, dayOf) : [],
    edgeLabels: spanDays >= MONTH_LABEL_FROM_DAYS
      ? null
      : [format(startMs, 'd MMM'), 'Today'] as const,
    weights: points,
    startWeight: preferences?.start_weight ?? points[0]?.value ?? null,
    goal,
    unit,
    medications: lanes,
    effects: sideEffects
      .filter((log) => log.taken_at >= startMs)
      .slice()
      .reverse()
      .map((log) => ({
        day: dayOf(log.taken_at),
        label: sideEffectLabel(log.effect),
        severity: log.severity,
        kind: log.effect.kind === 'clear' ? ('clear' as const) : ('symptom' as const),
        takenAt: log.taken_at,
      })),
    shotTotal: Object.values(injections).reduce((total, rows) => total + rows.length, 0),
    missedTotal: lanes.reduce((total, lane) => total + lane.missed.length, 0),
    dueTotal: lanes.reduce((total, lane) => total + lane.due.length, 0),
    streakWeeks: streak.current,
    weeksOnTime: streak.weeks.filter((week) => week.status === 'complete').length,
    loggedWeightAt: latest !== null && latest.takenAt >= today ? latest.takenAt : null,
  };
}

/**
 * Which scheduled doses the user met, and which are still open.
 *
 * A shot counts for one dose only, and the earliest open window takes it, so a
 * double dose on Monday does not quietly pay for the Thursday nobody took. The
 * domain owns the window; this is the greedy pass over it that the streak keeps
 * to itself.
 */
function scoreSchedule(
  medication: MedicationRow,
  rows: readonly InjectionRow[],
  reminderTime: string,
  now: number,
  dayOf: (timestamp: number) => number,
): { missed: number[]; due: number[] } {
  const schedule = medicationScheduleFromStored({
    medicationId: medication.id,
    frequencyKind: medication.frequency_kind,
    frequencyValue: medication.frequency_value,
    createdAt: medication.created_at,
    reminderTime,
  });
  if (!schedule) return { missed: [], due: [] };

  const windows = scheduledDosesBetween(schedule, medication.created_at, now)
    .map(scheduledDoseWindow)
    .sort((left, right) => left.dose.scheduledAt - right.dose.scheduledAt);
  const taken = rows
    .map((row) => row.taken_at)
    .sort((left, right) => left - right);
  const used = new Set<number>();
  const missed: number[] = [];
  const due: number[] = [];

  for (const window of windows) {
    let matched = false;
    for (let index = 0; index < taken.length; index += 1) {
      const at = taken[index];
      if (at === undefined || used.has(index)) continue;
      if (at >= window.opensAt && at < window.closesAt) {
        used.add(index);
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const day = dayOf(window.dose.scheduledDay);
    if (now < window.closesAt) due.push(day);
    else missed.push(day);
  }

  return { missed: uniqueDays(missed), due: uniqueDays(due) };
}

/** The first of every month the run passes through, as a day offset. */
function monthMarks(
  startMs: number,
  now: number,
  dayOf: (timestamp: number) => number,
): { day: number; label: string }[] {
  const marks: { day: number; label: string }[] = [];
  const cursor = new Date(startMs);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() + 1);

  while (cursor.getTime() <= now) {
    marks.push({ day: dayOf(cursor.getTime()), label: format(cursor, 'MMM') });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return marks;
}

function frequencyLabel(medication: MedicationRow): string {
  if (medication.frequency_kind === 'every_n_days') {
    const days = medication.frequency_value ?? 0;
    return days === 1 ? 'Every day' : `Every ${days} days`;
  }
  if (medication.frequency_kind === 'weekdays') {
    const named = weekdayListLabel(weekdaysFromMask(medication.frequency_value));
    return named === '' ? 'No schedule' : `Every ${named}`;
  }
  return FREQUENCY_LABEL[medication.frequency_kind] ?? 'No schedule';
}

function uniqueDays(days: readonly number[]): number[] {
  return Array.from(new Set(days)).sort((left, right) => left - right);
}

/**
 * A shot counts for a scheduled dose from one grace day before it, so the read
 * opens that far ahead of the day the medication started.
 */
function graceStart(createdAt: number): number {
  const date = new Date(createdAt);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - SCHEDULE_GRACE_DAYS);
  return date.getTime();
}

function convertWeight(value: number, fromUnit: string | null, toUnit: WeightUnit): number {
  if (fromUnit === 'kg' && toUnit === 'lb') return kgToLb(value);
  if (fromUnit === 'lb' && toUnit === 'kg') return lbToKg(value);
  return value;
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
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  state: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  stateCopy: {
    textAlign: 'center',
  },
});
