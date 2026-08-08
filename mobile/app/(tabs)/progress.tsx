import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Flame, Target } from 'lucide-react-native';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/LineChart';
import { ProLock, openPaywall } from '@/components/ProLock';
import { Text } from '@/components/Text';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
} from '@/db/types';
import {
  sameSideEffect,
  sideEffectLabel,
  sideEffectStorageKey,
  type SideEffect,
} from '@/domain/sideEffects';
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
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = ['7d', '30d', '90d'] as const;
type ProgressRange = typeof RANGES[number];

interface WeightPoint {
  t: number;
  v: number;
}

interface GoalProgress {
  change: number;
  percent: number;
  unit: WeightUnit;
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const pro = useIsPro();
  const [range, setRange] = useState<ProgressRange>('30d');
  // Free keeps the last week. Longer history is the paid part, so we clamp the
  // range rather than trusting whatever the toggle last held.
  const effectiveRange: ProgressRange = pro ? range : '7d';
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<InjectionRow[]>([]);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [selectedEffect, setSelectedEffect] = useState<SideEffect | null>(null);

  useEffect(() => {
    Promise.all([
      listMeasurements('weight', { limit: 365 }),
      getPreferences(),
      listMedications(),
      listInjections({ limit: 1000 }),
      listSideEffects({ fromMs: sideEffectWindowStart(Date.now()) }),
    ]).then(([weightRows, preferenceRow, medicationRows, injectionRows, sideEffectRows]) => {
      setWeights(weightRows);
      setPreferences(preferenceRow);
      setMedications(medicationRows.filter((medication) => medication.status === 'active'));
      setInjections(injectionRows);
      setSideEffects(sideEffectRows);
    }).catch(() => {});
  }, [dataVersion]);

  const unit = preferences?.weight_unit ?? 'lb';
  const points = useMemo(
    () => weightPoints(weights, unit, effectiveRange),
    [effectiveRange, unit, weights],
  );
  const goal = useMemo(
    () => goalProgress(weights, preferences),
    [preferences, weights],
  );
  const streak = useMemo(() => computeMedicationScheduleStreak({
    medications: medications.map((row) => ({
      id: row.id,
      frequencyKind: row.frequency_kind,
      frequencyValue: row.frequency_value,
      createdAt: row.created_at,
    })),
    injections: injections.map((row) => ({
      id: row.id,
      medicationId: row.medication_id,
      takenAt: row.taken_at,
    })),
    reminderTime: preferences?.reminder_time ?? '09:00',
    now: Date.now(),
  }) ?? { current: 0, best: 0, weeks: [] }, [injections, medications, preferences?.reminder_time]);
  const effectCounts = useMemo(() => countEffects(sideEffects), [sideEffects]);
  const selectedEffectLogs = useMemo(
    () => selectedEffect
      ? sideEffects.filter((log) => sameSideEffect(log.effect, selectedEffect))
      : [],
    [selectedEffect, sideEffects],
  );
  const chartWidth = Math.max(220, Math.min(width, 600) - spacing.screen * 2 - spacing.xl * 2);
  const latest = points[points.length - 1];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}> 
        <Text variant="display">Progress</Text>

        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitle}>
              <Text variant="smallStrong">Weight</Text>
              <View style={styles.currentRow}>
                <Text style={styles.currentValue}>{latest ? latest.v.toFixed(1) : '—'}</Text>
                <Text variant="small" color={colors.inkMuted}>{latest ? unit : 'No weight yet'}</Text>
              </View>
            </View>
            <TimeRangeToggle
              options={RANGES}
              value={effectiveRange}
              onChange={(next) => {
                if (!pro && next !== '7d') openPaywall();
                else setRange(next);
              }}
              size="sm"
            />
          </View>
          {points.length >= 2 ? (
            <LineChart
              data={points}
              width={chartWidth}
              height={220}
              includeZero={false}
              color={colors.amber}
              fillColor="rgba(232,161,60,0.12)"
              yLabel={(value) => value.toFixed(0)}
              xLabel={(timestamp) => format(timestamp, 'M/d')}
              xTickCount={4}
            />
          ) : (
            <View style={styles.chartEmpty}>
              <Text color={colors.inkMuted}>Log two weights to see your trend.</Text>
              <Button size="sm" onPress={() => router.push('/log-weight')}>Log weight</Button>
            </View>
          )}
        </Card>

        <GoalCard goal={goal} hasGoal={preferences?.goal_weight !== null && preferences?.goal_weight !== undefined} />
        <StreakCard streak={streak} />

        {effectCounts.length > 0 && !pro ? (
          <ProLock
            title="Side effect patterns"
            body="See which effects come back, how often and how bad they get."
          />
        ) : null}

        {effectCounts.length > 0 && pro ? (
          <Card style={styles.effectsCard}>
            <View style={styles.effectsHead}>
              <Text variant="h2">Side effects</Text>
              <Text variant="small" color={colors.inkMuted}>Last 14 days</Text>
            </View>
            {effectCounts.map(({ effect, count }) => {
              const maximum = effectCounts[0]?.count ?? 1;
              return (
                <Pressable
                  key={sideEffectStorageKey(effect)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sideEffectLabel(effect)}, ${count} ${count === 1 ? 'log' : 'logs'} in the last 14 days`}
                  onPress={() => setSelectedEffect(effect)}
                  style={({ pressed }) => [styles.effectRow, pressed && styles.pressed]}
                >
                  <View style={styles.effectCopy}>
                    <Text variant="smallStrong" style={styles.effectLabel}>{sideEffectLabel(effect)}</Text>
                    <View style={styles.effectTrack}>
                      <View style={[styles.effectFill, { flex: count }]} />
                      <View style={{ flex: Math.max(maximum - count, 0.001) }} />
                    </View>
                  </View>
                  <Text variant="smallStrong" color={colors.violet}>{count}</Text>
                  <ChevronRight size={17} color={colors.inkSubtle} />
                </Pressable>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={selectedEffect !== null}
        title={selectedEffect ? sideEffectLabel(selectedEffect) : 'Side effect'}
        onClose={() => setSelectedEffect(null)}
      >
        <ScrollView contentContainerStyle={styles.filteredList}>
          {selectedEffectLogs.map((log) => (
            <View key={log.id} style={styles.filteredRow}>
              <View style={styles.filteredDate}>
                <Text variant="smallStrong">{format(log.taken_at, 'MMM d')}</Text>
                <Text variant="caption" color={colors.inkMuted}>{format(log.taken_at, 'h:mm a')}</Text>
              </View>
              <View style={styles.filteredCopy}>
                <Text variant="smallStrong" color={colors.violet}>Severity {log.severity}/10</Text>
                {log.notes ? <Text variant="small" color={colors.inkMuted}>{log.notes}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function GoalCard({ goal, hasGoal }: { goal: GoalProgress | null; hasGoal: boolean }) {
  if (!goal) {
    return (
      <Card style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Target size={21} color={colors.amber} />
        </View>
        <View style={styles.summaryCopy}>
          <Text variant="h2">{hasGoal ? 'Log weight to measure your goal.' : 'Set a goal weight.'}</Text>
          <Text color={colors.inkMuted}>Poke then shows how far you have come.</Text>
        </View>
        <Button size="sm" onPress={() => hasGoal ? router.push('/log-weight') : router.push('/profile')}>
          {hasGoal ? 'Log weight' : 'Open Profile'}
        </Button>
      </Card>
    );
  }
  const direction = goal.change <= 0 ? 'down' : 'up';
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryHead}>
        <View style={styles.summaryIcon}>
          <Target size={21} color={colors.amber} />
        </View>
        <Text variant="h2">
          {Math.abs(goal.change).toFixed(1)} {goal.unit} {direction} · {goal.percent}% to goal
        </Text>
      </View>
      <View accessibilityLabel={`${goal.percent} percent to goal`} style={styles.progressTrack}>
        {goal.percent > 0 ? <View style={[styles.progressFill, { flex: goal.percent }]} /> : null}
        <View style={{ flex: Math.max(100 - goal.percent, 0.001) }} />
      </View>
    </Card>
  );
}

function StreakCard({ streak }: { streak: ScheduleStreak }) {
  return (
    <Card style={styles.streakCard}>
      <View style={styles.streakIcon}>
        <Flame size={22} color={colors.accent} fill={colors.accent} />
      </View>
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{streak.current}</Text>
        <Text variant="small" color={colors.inkMuted}>Current streak</Text>
      </View>
      <View style={styles.streakDivider} />
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{streak.best}</Text>
        <Text variant="small" color={colors.inkMuted}>Best streak</Text>
      </View>
    </Card>
  );
}

function weightPoints(weights: readonly MeasurementRow[], unit: WeightUnit, range: ProgressRange): WeightPoint[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const since = Date.now() - days * DAY_MS;
  return weights
    .filter((weight) => weight.taken_at >= since)
    .slice()
    .reverse()
    .map((weight) => ({ t: weight.taken_at, v: convertWeight(weight.value, weight.unit, unit) }));
}

function goalProgress(weights: readonly MeasurementRow[], preferences: PreferencesRow | null): GoalProgress | null {
  const latest = weights[0];
  const earliest = weights[weights.length - 1];
  const goal = preferences?.goal_weight;
  if (!latest || !earliest || goal === null || goal === undefined || !preferences) return null;
  const unit = preferences.weight_unit;
  const current = convertWeight(latest.value, latest.unit, unit);
  const start = preferences.start_weight ?? convertWeight(earliest.value, earliest.unit, unit);
  const total = goal - start;
  if (total === 0) return { change: current - start, percent: 100, unit };
  const achieved = current - start;
  return {
    change: current - start,
    percent: Math.round(Math.max(0, Math.min(100, achieved / total * 100))),
    unit,
  };
}

function countEffects(sideEffects: readonly SideEffectLog[]): { effect: SideEffect; count: number }[] {
  const counts = new Map<string, { effect: SideEffect; count: number }>();
  for (const sideEffect of sideEffects) {
    const key = sideEffectStorageKey(sideEffect.effect);
    const current = counts.get(key);
    counts.set(key, { effect: current?.effect ?? sideEffect.effect, count: (current?.count ?? 0) + 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count);
}

function sideEffectWindowStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 13);
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
    maxWidth: 600,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  chartCard: {
    gap: spacing.xl,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chartTitle: {
    gap: spacing.xs,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  currentValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '600',
    color: colors.ink,
  },
  chartEmpty: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  summaryCard: {
    gap: spacing.lg,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSoft,
  },
  summaryCopy: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  progressFill: {
    borderRadius: radius.pill,
    backgroundColor: colors.amber,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  streakIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  streakStat: {
    flex: 1,
    gap: 2,
  },
  streakValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    color: colors.ink,
  },
  streakDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
    backgroundColor: colors.divider,
  },
  effectsCard: {
    gap: spacing.md,
  },
  effectsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  effectRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  effectCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  effectTrack: {
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(139,123,216,0.14)',
  },
  effectFill: {
    borderRadius: radius.pill,
    backgroundColor: colors.violet,
  },
  effectLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.68,
  },
  filteredList: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  filteredRow: {
    minHeight: 64,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  filteredDate: {
    width: 64,
    gap: 2,
  },
  filteredCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
