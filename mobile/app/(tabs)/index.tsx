import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

import {
  TodayMedicationSection,
  type DoseState,
  type LevelEstimate,
  type TodayMedicationSummary,
} from '@/components/today-medication-section';
import { Text } from '@/components/Text';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
} from '@/db/types';
import { estimatedLevelAt, tmaxOrDefault } from '@/domain/pk';
import {
  medicationScheduleFromStored,
  nextScheduledDoses,
  scheduledDosesBetween,
} from '@/domain/scheduling';
import {
  computeMedicationScheduleStreak,
  type ScheduleStreak,
} from '@/domain/streaks';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications } from '@/repositories/medications';
import { getPreferences } from '@/repositories/preferences';
import { listSideEffects, type SideEffectLog } from '@/repositories/sideEffects';
import { maybePromptForReview } from '@/services/review';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { endOfDay, startOfDay } from '@/utils/date';

const DAY_MS = 24 * 60 * 60 * 1000;
const CONTENT_MAX_WIDTH = 600;

interface TodayDashboard {
  medications: TodayMedicationSummary[];
  weight: MeasurementRow | null;
  weightSeries: number[];
  weightUnit: WeightUnit;
  sideEffect: SideEffectLog | null;
  streak: ScheduleStreak;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const focusMedicationId = useAppStore((state) => state.focusMedicationId);
  const setFocusMedication = useAppStore((state) => state.setFocusMedication);
  const pro = useIsPro();

  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<Record<string, InjectionRow[]>>({});
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [medicationRows, weightRows, preferenceRow, effectRows] = await Promise.all([
        listMedications(),
        listMeasurements('weight', { limit: 30 }),
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

  useEffect(() => {
    if (!hasLoaded) return;
    const validIds = new Set(
      dashboard.medications.map((summary) => summary.medication.id),
    );

    if (focusMedicationId) {
      if (validIds.has(focusMedicationId)) setSelectedMedicationId(focusMedicationId);
      setFocusMedication(null);
      return;
    }

    setSelectedMedicationId((current) => {
      if (current && validIds.has(current)) return current;
      return dashboard.medications[0]?.medication.id ?? null;
    });
  }, [dashboard.medications, focusMedicationId, hasLoaded, setFocusMedication]);

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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        )}
      >
        <TodayHeader streak={dashboard.streak.current} now={now} />

        <TodayMedicationSection
          status={hasLoaded ? 'ready' : loadError ? 'error' : 'loading'}
          medications={dashboard.medications}
          selectedMedicationId={selectedMedicationId}
          onSelectMedication={setSelectedMedicationId}
          pro={pro}
          contentWidth={contentWidth}
          weight={dashboard.weight}
          weightSeries={dashboard.weightSeries}
          weightUnit={dashboard.weightUnit}
          sideEffect={dashboard.sideEffect}
          onRetry={() => load().catch(() => {})}
        />
      </ScrollView>
    </View>
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
    const latestInjection = medicationInjections[0] ?? null;
    const schedule = medicationScheduleFromStored({
      medicationId: medication.id,
      frequencyKind: medication.frequency_kind,
      frequencyValue: medication.frequency_value,
      createdAt: medication.created_at,
      reminderTime,
    });

    return {
      medication,
      injections: medicationInjections,
      latestInjection,
      dose: buildDoseState({
        medicationId: medication.id,
        latestInjection,
        schedule,
        now,
      }),
      level: buildLevelEstimate({
        injections: medicationInjections,
        halfLifeHours: medication.half_life_hours,
        tmaxHours: medication.tmax_hours,
        now,
      }),
    };
  }).sort(byTodayThenName);

  const weightUnit = preferences?.weight_unit ?? 'lb';
  const weightSeries = weights
    .slice()
    .reverse()
    .map((weight) => convertWeight(weight.value, weight.unit, weightUnit));
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
    weightSeries,
    weightUnit,
    sideEffect: sideEffects[0] ?? null,
    streak,
  };
}

function buildDoseState({
  medicationId,
  latestInjection,
  schedule,
  now,
}: {
  medicationId: string;
  latestInjection: InjectionRow | null;
  schedule: ReturnType<typeof medicationScheduleFromStored>;
  now: number;
}): DoseState {
  const endOfToday = endOfDay(now);
  const nextScheduledAt = schedule
    ? nextScheduledDoses(schedule, endOfToday, 1)[0]?.scheduledAt ?? null
    : null;

  if (latestInjection && isSameDay(latestInjection.taken_at, now)) {
    return {
      kind: 'loggedToday',
      injection: latestInjection,
      nextScheduledAt,
    };
  }

  if (!schedule) return { kind: 'unscheduled', medicationId };

  const scheduledToday = scheduledDosesBetween(
    schedule,
    startOfDay(now),
    endOfToday,
  )[0];
  if (scheduledToday) {
    return {
      kind: 'due',
      medicationId,
      scheduledAt: scheduledToday.scheduledAt,
    };
  }

  if (nextScheduledAt !== null) {
    return { kind: 'upcoming', scheduledAt: nextScheduledAt };
  }

  return { kind: 'unscheduled', medicationId };
}

function buildLevelEstimate({
  injections,
  halfLifeHours,
  tmaxHours,
  now,
}: {
  injections: readonly InjectionRow[];
  halfLifeHours: number | null;
  tmaxHours: number | null;
  now: number;
}): LevelEstimate {
  if (halfLifeHours === null || halfLifeHours <= 0) return { kind: 'unsupported' };
  if (injections.length === 0) return { kind: 'empty' };

  const doses = injections.map((injection) => ({
    takenAt: injection.taken_at,
    dose: injection.dose,
  }));
  const tmax = tmaxOrDefault(halfLifeHours, tmaxHours);
  const points = Array.from({ length: 7 }, (_, index) => {
    const timestamp = now - (6 - index) * DAY_MS;
    return {
      t: timestamp,
      v: estimatedLevelAt(doses, halfLifeHours, tmax, timestamp),
    };
  });
  const currentPoint = points[points.length - 1];

  return currentPoint
    ? { kind: 'ready', current: currentPoint.v, points }
    : { kind: 'empty' };
}

function byTodayThenName(
  first: TodayMedicationSummary,
  second: TodayMedicationSummary,
): number {
  return doseRank(first.dose) - doseRank(second.dose)
    || first.medication.name.localeCompare(second.medication.name);
}

function doseRank(dose: DoseState): number {
  switch (dose.kind) {
    case 'due':
    case 'loggedToday':
      return 0;
    case 'upcoming':
      return 1;
    case 'unscheduled':
      return 2;
    default: {
      const exhaustive: never = dose;
      return exhaustive;
    }
  }
}

function TodayHeader({ streak, now }: { streak: number; now: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text variant="display">Today</Text>
        <Text variant="small" color={colors.inkMuted}>
          {format(now, 'EEEE, MMMM d')}
        </Text>
      </View>
      {streak >= 2 ? (
        <View accessible accessibilityLabel={`${streak}-week streak`} style={styles.streakChip}>
          <Flame size={17} fill={colors.accent} color={colors.accent} />
          <Text variant="smallStrong" color={colors.accent}>{streak}</Text>
        </View>
      ) : null}
    </View>
  );
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
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerCopy: {
    gap: 2,
  },
  streakChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
});
