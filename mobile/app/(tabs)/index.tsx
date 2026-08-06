import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, Flame, Plus, Syringe } from 'lucide-react-native';
import { format, isSameDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sparkline } from '@/components/Sparkline';
import { Text } from '@/components/Text';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
  SideEffectKind,
  SideEffectLogRow,
} from '@/db/types';
import { estimatedLevelAt, tmaxOrDefault } from '@/domain/pk';
import { deriveScheduleStreak, frequencyHours, nextDoseAt, type ScheduleStreak } from '@/domain/scheduling';
import { getBodySite } from '@/domain/bodySites';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications } from '@/repositories/medications';
import { getPreferences } from '@/repositories/preferences';
import { listSideEffects } from '@/repositories/sideEffects';
import { useAppStore } from '@/stores/app';
import { colors, radius, spacing } from '@/theme';
import { endOfDay, fmtTime, startOfDay } from '@/utils/date';

const DAY_MS = 24 * 60 * 60 * 1000;

type TodayDoseAction =
  | { kind: 'none' }
  | { kind: 'due'; medicationId: string }
  | { kind: 'logged'; injection: InjectionRow };

interface MedicationSummary {
  medication: MedicationRow;
  injections: InjectionRow[];
  nextAt: number;
  level: number | null;
  weekLevels: number[];
  streak: ScheduleStreak;
}

interface TodayDashboard {
  medication: MedicationSummary | null;
  weight: MeasurementRow | null;
  weightSeries: number[];
  weightUnit: WeightUnit;
  sideEffect: SideEffectLogRow | null;
  action: TodayDoseAction;
}

const EFFECT_LABELS: Record<SideEffectKind, string> = {
  nausea: 'Nausea',
  fatigue: 'Fatigue',
  constipation: 'Constipation',
  headache: 'Headache',
  injection_site: 'Injection site',
  appetite_loss: 'Appetite loss',
  other: 'Other',
};

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<Record<string, InjectionRow[]>>({});
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectLogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [dataVersion, load]);

  const dashboard = useMemo(
    () => buildDashboard({ medications, injections, weights, preferences, sideEffects, now: Date.now() }),
    [injections, medications, preferences, sideEffects, weights],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <TodayHeader streak={dashboard.medication?.streak.current ?? 0} />

        {dashboard.medication ? (
          <>
            <MedicationCard summary={dashboard.medication} />
            <DoseAction action={dashboard.action} />
          </>
        ) : (
          <EmptyMedication />
        )}

        <View style={styles.tiles}>
          <WeightTile dashboard={dashboard} />
          <SideEffectTile sideEffect={dashboard.sideEffect} />
        </View>
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
  medications: MedicationRow[];
  injections: Record<string, InjectionRow[]>;
  weights: MeasurementRow[];
  preferences: PreferencesRow | null;
  sideEffects: SideEffectLogRow[];
  now: number;
}): TodayDashboard {
  const reminderTime = preferences?.reminder_time ?? '09:00';
  const summaries = medications.map((medication): MedicationSummary => {
    const medicationInjections = injections[medication.id] ?? [];
    const doses = medicationInjections.map((injection) => ({ takenAt: injection.taken_at, dose: injection.dose }));
    const halfLife = medication.half_life_hours;
    const tmax = halfLife ? tmaxOrDefault(halfLife, medication.tmax_hours) : 0;
    const level = halfLife ? estimatedLevelAt(doses, halfLife, tmax, now) : null;
    const weekLevels = halfLife
      ? Array.from({ length: 7 }, (_, index) => (
          estimatedLevelAt(doses, halfLife, tmax, now - (6 - index) * DAY_MS)
        ))
      : [];
    const lastTakenAt = medicationInjections[0]?.taken_at ?? null;
    return {
      medication,
      injections: medicationInjections,
      nextAt: nextDoseAt({
        frequencyKind: medication.frequency_kind,
        frequencyValue: medication.frequency_value,
        lastTakenAt,
        createdAt: medication.created_at,
        reminderTime,
        now,
      }),
      level,
      weekLevels,
      streak: deriveScheduleStreak(
        medicationInjections.map((injection) => injection.taken_at),
        frequencyHours(medication.frequency_kind, medication.frequency_value),
        now,
      ),
    };
  }).sort((a, b) => a.nextAt - b.nextAt);

  const medication = summaries[0] ?? null;
  const latestShot = medication?.injections[0];
  const action: TodayDoseAction = latestShot && isSameDay(latestShot.taken_at, now)
    ? { kind: 'logged', injection: latestShot }
    : medication && medication.nextAt <= endOfDay(now)
      ? { kind: 'due', medicationId: medication.medication.id }
      : { kind: 'none' };
  const weightUnit = preferences?.weight_unit ?? 'lb';
  const weightSeries = weights
    .slice()
    .reverse()
    .map((weight) => convertWeight(weight.value, weight.unit, weightUnit));

  return {
    medication,
    weight: weights[0] ?? null,
    weightSeries,
    weightUnit,
    sideEffect: sideEffects[0] ?? null,
    action,
  };
}

function TodayHeader({ streak }: { streak: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text variant="display">Today</Text>
        <Text variant="small" color={colors.inkMuted}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>
      {streak >= 2 ? (
        <View style={styles.streakChip}>
          <Flame size={17} fill={colors.accent} color={colors.accent} />
          <Text variant="smallStrong" color={colors.accent}>{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MedicationCard({ summary }: { summary: MedicationSummary }) {
  const { medication, level, weekLevels, nextAt } = summary;
  return (
    <Card style={styles.medicationCard}>
      <View style={styles.medicationHead}>
        <Text variant="small" color={colors.inkMuted}>Estimated current level</Text>
        <View style={styles.medicationChip}>
          <Text variant="caption" color={colors.accent}>{medication.name}</Text>
        </View>
      </View>
      <View style={styles.levelRow}>
        <Text style={styles.levelValue}>{level === null ? '—' : formatLevel(level, medication.default_unit)}</Text>
        <Text variant="bodyStrong" color={colors.inkMuted}>{level === null ? 'No estimate' : medication.default_unit}</Text>
      </View>
      {weekLevels.length === 7 ? <WeekBars levels={weekLevels} /> : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`View ${medication.name} level details`}
        onPress={() => router.push({ pathname: '/reports/level', params: { medicationId: medication.id } })}
        style={styles.nextDose}
      >
        <View style={styles.nextDoseCopy}>
          <Text variant="smallStrong">Shot day is {format(nextAt, 'EEEE')} · {countdownLabel(nextAt)}</Text>
          <Text variant="caption" color={colors.inkMuted}>{medication.default_dose} {medication.default_unit}</Text>
        </View>
        <ChevronRight size={18} color={colors.inkSubtle} />
      </Pressable>
    </Card>
  );
}

function WeekBars({ levels }: { levels: number[] }) {
  const maximum = Math.max(...levels, 0.001);
  return (
    <View style={styles.weekBars}>
      {levels.map((level, index) => {
        const date = Date.now() - (6 - index) * DAY_MS;
        const today = index === levels.length - 1;
        return (
          <View key={date} style={styles.dayBarWrap}>
            <View
              style={[
                styles.dayBar,
                {
                  height: 8 + (level / maximum) * 28,
                  backgroundColor: today ? colors.accent : colors.accentSoft,
                },
              ]}
            />
            <Text variant="caption" color={today ? colors.accent : colors.inkSubtle}>
              {format(date, 'EEEEE')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function DoseAction({ action }: { action: TodayDoseAction }) {
  if (action.kind === 'none') return null;
  if (action.kind === 'due') {
    return (
      <Button
        leadingIcon={<Syringe size={21} color={colors.inkInverse} />}
        onPress={() => router.push({ pathname: '/log-shot', params: { medicationId: action.medicationId } })}
      >
        Log shot
      </Button>
    );
  }
  const site = action.injection.site_id ? getBodySite(action.injection.site_id) : undefined;
  return (
    <View style={styles.loggedRow}>
      <View style={styles.loggedIcon}>
        <Check size={18} strokeWidth={2.5} color={colors.accent} />
      </View>
      <Text variant="smallStrong" style={styles.loggedText}>
        Logged {fmtTime(action.injection.taken_at).toLocaleLowerCase()}
        {site ? ` · ${site.label.toLocaleLowerCase()}` : ''}
      </Text>
    </View>
  );
}

function EmptyMedication() {
  return (
    <Card style={styles.emptyCard}>
      <Text variant="h2">Add your medication.</Text>
      <Text color={colors.inkMuted}>Poke will put your next shot and estimated level here.</Text>
      <Button onPress={() => router.push('/medications/new')}>Add medication</Button>
    </Card>
  );
}

function WeightTile({ dashboard }: { dashboard: TodayDashboard }) {
  const value = dashboard.weight
    ? convertWeight(dashboard.weight.value, dashboard.weight.unit, dashboard.weightUnit).toFixed(1)
    : '—';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log weight"
      onPress={() => router.push('/log-weight')}
      style={({ pressed }) => [styles.tilePressable, pressed && styles.pressed]}
    >
      <Card style={styles.tile}>
        <View style={styles.tileHead}>
          <Text variant="smallStrong">Weight</Text>
          <Plus size={17} color={colors.amber} />
        </View>
        <View style={styles.tileValueRow}>
          <Text style={styles.tileValue}>{value}</Text>
          {dashboard.weight ? <Text variant="caption" color={colors.inkMuted}>{dashboard.weightUnit}</Text> : null}
        </View>
        {dashboard.weightSeries.length >= 2 ? (
          <Sparkline data={dashboard.weightSeries} width={84} height={34} color={colors.amber} />
        ) : (
          <Text variant="small" color={colors.inkMuted}>No weight logged yet.</Text>
        )}
        <Text variant="smallStrong" color={colors.amber}>+ log</Text>
      </Card>
    </Pressable>
  );
}

function SideEffectTile({ sideEffect }: { sideEffect: SideEffectLogRow | null }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log side effect"
      onPress={() => router.push('/log-side-effect')}
      style={({ pressed }) => [styles.tilePressable, pressed && styles.pressed]}
    >
      <Card style={styles.tile}>
        <View style={styles.tileHead}>
          <Text variant="smallStrong">Side effect</Text>
          <Plus size={17} color={colors.violet} />
        </View>
        <Text variant="h2">How are you feeling?</Text>
        <Text variant="small" color={colors.inkMuted}>
          {sideEffect
            ? `Last: ${EFFECT_LABELS[sideEffect.effect]} · ${sideEffect.severity}/10`
            : 'Add a quick check-in.'}
        </Text>
        <Text variant="smallStrong" color={colors.violet}>Quick add</Text>
      </Card>
    </Pressable>
  );
}

function countdownLabel(timestamp: number): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(Date.now())) / DAY_MS);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days`;
}

function formatLevel(value: number, unit: MedicationRow['default_unit']): string {
  if (unit === 'mg') return value.toFixed(value < 1 ? 2 : 1);
  if (unit === 'mcg') return String(Math.round(value));
  return value.toFixed(value < 1 ? 2 : 1);
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
    maxWidth: 600,
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
  medicationCard: {
    gap: spacing.xl,
  },
  medicationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  medicationChip: {
    maxWidth: '58%',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  levelValue: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '600',
    color: colors.ink,
  },
  weekBars: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  dayBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  dayBar: {
    width: '100%',
    maxWidth: 24,
    borderRadius: 6,
  },
  nextDose: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  nextDoseCopy: {
    flex: 1,
    gap: 2,
  },
  loggedRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  loggedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  loggedText: {
    flex: 1,
  },
  emptyCard: {
    gap: spacing.lg,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    minHeight: 202,
    gap: spacing.md,
    padding: spacing.lg,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  tileValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    color: colors.ink,
  },
  pressed: {
    opacity: 0.72,
  },
});
