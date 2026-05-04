import { useEffect, useState, useCallback } from 'react';
import { Alert, TextInput, View, ScrollView, StyleSheet, RefreshControl, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Clock3 } from 'lucide-react-native';

import { MastHead } from '@/components/MastHead';
import { TitleBlock } from '@/components/TitleBlock';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Eyebrow } from '@/components/Eyebrow';
import { Pill } from '@/components/Pill';
import { Button } from '@/components/Button';
import { Sparkline } from '@/components/Sparkline';
import { LineChart } from '@/components/LineChart';
import { MedVialIcon } from '@/components/MedVialIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';

import { listMedications } from '@/repositories/medications';
import { listInjections } from '@/repositories/injections';
import {
  createMeasurement,
  earliestMeasurement,
  latestMeasurement,
  listMeasurements,
  updateManualMeasurement,
} from '@/repositories/measurements';
import { getPreferences, updateGoalWeight, updatePreferences } from '@/repositories/preferences';
import type { MedicationRow, InjectionRow, MeasurementRow, PreferencesRow } from '@/db/types';
import { estimatedLevelAt, levelTrajectory, trendLabel, tmaxOrDefault } from '@/domain/pk';
import { frequencyHours } from '@/domain/scheduling';
import { fmtDate, fmtDateTime } from '@/utils/date';
import { formatDose, kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { useAppStore } from '@/stores/app';
import { colors, fonts, radius, spacing } from '@/theme';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface NextStep {
  med: MedicationRow;
  fireAt: number;
  overdue: boolean;
}

function nextStepFor(med: MedicationRow, lastTakenAt: number | null, reminderTimeHHMM: string): NextStep {
  const intervalH = frequencyHours(med.frequency_kind, med.frequency_value);
  const intervalMs = intervalH * HOUR;
  const [hour, minute] = reminderTimeHHMM.split(':').map((n) => parseInt(n, 10));
  let fire = (lastTakenAt ?? Date.now() - intervalMs) + intervalMs;
  const d = new Date(fire);
  d.setHours(hour ?? 9, minute ?? 0, 0, 0);
  fire = d.getTime();
  if (fire < Date.now() - 12 * HOUR && lastTakenAt == null) {
    const today = new Date();
    today.setHours(hour ?? 9, minute ?? 0, 0, 0);
    fire = today.getTime();
    if (fire < Date.now()) fire += DAY;
  }
  return { med, fireAt: fire, overdue: fire < Date.now() };
}

type HomeSheet = 'weight' | 'goal' | 'level' | null;
type WeightSaveMode = 'update' | 'add';

function convertWeight(value: number, fromUnit: string | null | undefined, toUnit: WeightUnit): number {
  if (fromUnit === 'kg' && toUnit === 'lb') return kgToLb(value);
  if (fromUnit === 'lb' && toUnit === 'kg') return lbToKg(value);
  return value;
}

function signedWeight(value: number, unit: WeightUnit): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} ${unit === 'kg' ? 'kg' : 'lbs'}`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpVersion = useAppStore((s) => s.bumpVersion);
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [injectionsByMed, setInjectionsByMed] = useState<Record<string, InjectionRow[]>>({});
  const [latestWeight, setLatestWeight] = useState<MeasurementRow | null>(null);
  const [earliestWeight, setEarliestWeight] = useState<MeasurementRow | null>(null);
  const [weightHistory, setWeightHistory] = useState<MeasurementRow[]>([]);
  const [prefs, setPrefs] = useState<PreferencesRow | null>(null);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<HomeSheet>(null);
  const [weightValue, setWeightValue] = useState('');
  const [selectedWeightUnit, setSelectedWeightUnit] = useState<WeightUnit>('lb');
  const [weightSaveMode, setWeightSaveMode] = useState<WeightSaveMode>('update');
  const [goalValue, setGoalValue] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);

  const load = useCallback(async () => {
    const [m, w, ew, wh, p] = await Promise.all([
      listMedications(),
      latestMeasurement('weight'),
      earliestMeasurement('weight'),
      listMeasurements('weight', { limit: 30 }),
      getPreferences(),
    ]);
    const active = m.filter((x) => x.status === 'active');
    setMeds(active);
    setLatestWeight(w);
    setEarliestWeight(ew);
    setWeightHistory(wh);
    setPrefs(p);

    const lists = await Promise.all(
      active.map((med) => listInjections({ medicationId: med.id, fromMs: Date.now() - 30 * DAY })),
    );
    const byMed: Record<string, InjectionRow[]> = {};
    active.forEach((med, i) => { byMed[med.id] = lists[i] ?? []; });
    setInjectionsByMed(byMed);

    let bestStep: NextStep | null = null;
    for (const med of active) {
      const last = byMed[med.id]?.[0]?.taken_at ?? null;
      const step = nextStepFor(med, last, p.reminder_time);
      if (!bestStep || step.fireAt < bestStep.fireAt) bestStep = step;
    }
    setNextStep(bestStep);
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  useEffect(() => {
    const unit = prefs?.weight_unit ?? 'lb';
    setSelectedWeightUnit(unit);
    if (latestWeight) {
      setWeightValue(convertWeight(latestWeight.value, latestWeight.unit, unit).toFixed(1));
    } else {
      setWeightValue('');
    }
    setGoalValue(prefs?.goal_weight != null ? prefs.goal_weight.toFixed(1) : '');
    setWeightSaveMode(latestWeight?.source === 'manual' ? 'update' : 'add');
  }, [latestWeight, prefs]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const weightUnit = prefs?.weight_unit ?? 'lb';
  const weightSeries = weightHistory.slice().reverse().map((m) => {
    return convertWeight(m.value, m.unit, weightUnit);
  });
  const weightDelta = weightSeries.length >= 2
    ? weightSeries[weightSeries.length - 1]! - weightSeries[0]!
    : 0;

  const weightDisplay = latestWeight
    ? convertWeight(latestWeight.value, latestWeight.unit, weightUnit)
    : null;

  const baselineWeight = prefs?.start_weight != null
    ? prefs.start_weight
    : earliestWeight
      ? convertWeight(earliestWeight.value, earliestWeight.unit, weightUnit)
      : null;
  const baselineAt = prefs?.start_weight_at ?? earliestWeight?.taken_at ?? null;
  const totalWeightChange = weightDisplay != null && baselineWeight != null
    ? weightDisplay - baselineWeight
    : null;
  const percentWeightChange = totalWeightChange != null && baselineWeight
    ? (totalWeightChange / baselineWeight) * 100
    : null;
  const goalWeight = prefs?.goal_weight ?? null;
  const remainingToGoal = weightDisplay != null && goalWeight != null
    ? weightDisplay - goalWeight
    : null;

  const headerMed = nextStep?.med ?? meds[0];
  const headerInjections = headerMed ? injectionsByMed[headerMed.id] ?? [] : [];
  const headerDoses = headerInjections.map((i) => ({ takenAt: i.taken_at, dose: i.dose }));
  const headerHL = headerMed?.half_life_hours ?? null;
  const headerTmax = headerHL ? tmaxOrDefault(headerHL, headerMed?.tmax_hours) : 0;
  const headerLevel = headerHL
    ? estimatedLevelAt(headerDoses, headerHL, headerTmax, Date.now())
    : null;
  const headerTrend = headerHL
    ? trendLabel(headerDoses, headerHL, headerTmax, Date.now())
    : null;
  const headerForecastEnd = headerHL
    ? Date.now() + Math.max(2 * DAY, headerHL * HOUR * 2)
    : Date.now();
  const headerTraj = headerHL
    ? levelTrajectory(headerDoses, headerHL, headerTmax, Date.now() - 7 * DAY, headerForecastEnd, 80)
    : null;

  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - spacing.screen * 2 - spacing.lg * 2;
  const sheetChartWidth = screenWidth - spacing.screen * 2;

  const saveWeightFromSheet = async () => {
    const v = parseFloat(weightValue);
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert('Enter a valid weight');
      return;
    }
    setSavingSheet(true);
    try {
      if (weightSaveMode === 'update' && latestWeight?.source === 'manual') {
        await updateManualMeasurement(latestWeight.id, {
          value: v,
          unit: selectedWeightUnit,
          takenAt: latestWeight.taken_at,
        });
      } else {
        await createMeasurement({ kind: 'weight', value: v, unit: selectedWeightUnit, takenAt: Date.now() });
      }

      const patch: Partial<Omit<PreferencesRow, 'id' | 'updated_at'>> = {
        weight_unit: selectedWeightUnit,
      };
      if (prefs && prefs.weight_unit !== selectedWeightUnit) {
        if (prefs.start_weight != null) {
          patch.start_weight = convertWeight(prefs.start_weight, prefs.weight_unit, selectedWeightUnit);
        }
        if (prefs.goal_weight != null) {
          patch.goal_weight = convertWeight(prefs.goal_weight, prefs.weight_unit, selectedWeightUnit);
        }
      }

      if (prefs?.start_weight == null) {
        const first = await earliestMeasurement('weight');
        if (first) {
          patch.start_weight = convertWeight(first.value, first.unit, selectedWeightUnit);
          patch.start_weight_at = first.taken_at;
        }
      }

      await updatePreferences(patch);
      bumpVersion();
      await load();
      setActiveSheet(null);
    } catch (err: any) {
      Alert.alert('Could not save weight', String(err?.message ?? err));
    } finally {
      setSavingSheet(false);
    }
  };

  const saveGoalFromSheet = async () => {
    const v = parseFloat(goalValue);
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert('Enter a valid goal weight');
      return;
    }
    setSavingSheet(true);
    try {
      await updateGoalWeight(v);
      bumpVersion();
      await load();
      setActiveSheet(null);
    } catch (err: any) {
      Alert.alert('Could not save goal', String(err?.message ?? err));
    } finally {
      setSavingSheet(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.hero + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        <MastHead />
        <TitleBlock title="Today" rightLabel={fmtDate(Date.now())} />

        <View style={{ paddingHorizontal: spacing.screen }}>
          {nextStep ? (
            <NextStepCard step={nextStep} />
          ) : meds.length === 0 ? (
            <EmptyMedsCard />
          ) : (
            <NoSchedCard />
          )}
        </View>

        <View style={{ height: spacing.lg }} />

        <View style={[styles.statRow, { paddingHorizontal: spacing.screen }]}>
          <MiniStat
            label="Weight"
            value={weightDisplay != null ? weightDisplay.toFixed(1) : '—'}
            unit={weightUnit === 'kg' ? 'kg' : 'lbs'}
            delta={weightHistory.length >= 2
              ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} vs first`
              : undefined}
            deltaTone={weightDelta < 0 ? 'success' : weightDelta > 0 ? 'danger' : 'neutral'}
            action="Log weight"
            onPress={() => setActiveSheet('weight')}
          />
          <MiniStat
            label="Goal"
            value={goalWeight != null ? goalWeight.toFixed(1) : '—'}
            unit={goalWeight != null ? (weightUnit === 'kg' ? 'kg' : 'lbs') : undefined}
            delta={remainingToGoal != null
              ? `${Math.abs(remainingToGoal).toFixed(1)} ${weightUnit === 'kg' ? 'kg' : 'lbs'} ${remainingToGoal >= 0 ? 'left' : 'past'}`
              : undefined}
            deltaTone={remainingToGoal != null && remainingToGoal <= 0 ? 'success' : 'neutral'}
            action="Set goal"
            onPress={() => setActiveSheet('goal')}
          />
          <MiniStat
            label="Est. Level"
            value={headerLevel != null ? formatDose(headerLevel, headerMed?.default_unit ?? 'mg').split(' ')[0] : '—'}
            unit={headerMed?.default_unit}
            delta={headerTrend ?? (meds.length === 0 ? 'Add med' : 'No data')}
            deltaTone={headerTrend === 'steady' ? 'success' : headerTrend ? 'neutral' : 'neutral'}
            onPress={() => headerMed ? setActiveSheet('level') : null}
          />
        </View>

        <View style={{ height: spacing.xl }} />

        {headerMed && headerTraj && headerTraj.length >= 2 && headerLevel != null && (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <Card padding="lg">
              <View style={styles.levelHead}>
                <Eyebrow>Medication Level</Eyebrow>
                <Pressable onPress={() => router.push({ pathname: '/reports/level' as any, params: { medicationId: headerMed.id } })} hitSlop={8}>
                  <View style={styles.linkRow}>
                    <Text variant="caption" color={colors.inkMuted}>7 DAYS</Text>
                    <ChevronRight size={14} color={colors.inkMuted} />
                  </View>
                </Pressable>
              </View>
              <View style={styles.levelValueRow}>
                <Text variant="hero">{formatDose(headerLevel, headerMed.default_unit).split(' ')[0]}</Text>
                <Text variant="bodyStrong" color={colors.inkMuted}>{headerMed.default_unit}</Text>
                {headerTrend ? (
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Pill tone={headerTrend === 'rising' ? 'success' : headerTrend === 'falling' ? 'warning' : 'neutral'}>
                      {`• ${headerTrend}`}
                    </Pill>
                  </View>
                ) : null}
              </View>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                {headerMed.name} · today
              </Text>
              <View style={{ height: spacing.md }} />
              <LineChart
                data={headerTraj.filter((p) => p.t <= Date.now()).map((p) => ({ t: p.t, v: p.level }))}
                projection={headerTraj.filter((p) => p.t >= Date.now()).map((p) => ({ t: p.t, v: p.level }))}
                width={chartWidth}
                height={140}
                yLabel={(v) => v.toFixed(v >= 1 ? 1 : 2)}
                xLabel={(t) => {
                  const d = new Date(t);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                xTickCount={5}
                yTickCount={3}
              />
            </Card>
          </View>
        )}

        {meds.length > 1 && (
          <>
            <View style={{ height: spacing.xl }} />
            <Section
              eyebrow="Other Medications"
              trailing={
                <Pressable onPress={() => router.push('/medications')} hitSlop={8}>
                  <View style={styles.linkRow}>
                    <Text variant="caption" color={colors.inkMuted}>MANAGE</Text>
                    <ChevronRight size={14} color={colors.inkMuted} />
                  </View>
                </Pressable>
              }
            >
              <Card padding="md">
                {meds.filter((m) => m.id !== headerMed?.id).slice(0, 3).map((med, idx, arr) => (
                  <MedLevelRow
                    key={med.id}
                    med={med}
                    injections={injectionsByMed[med.id] ?? []}
                    isLast={idx === arr.length - 1}
                  />
                ))}
              </Card>
            </Section>
          </>
        )}

        <View style={{ height: spacing.hero }} />
      </ScrollView>

      <BottomSheet visible={activeSheet === 'weight'} title="Log Weight" onClose={() => setActiveSheet(null)}>
        <View>
          <View style={styles.weightInputBlock}>
            <TextInput
              value={weightValue}
              onChangeText={setWeightValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={colors.inkSubtle}
              style={styles.weightHeroInput}
              autoFocus
            />
            <TimeRangeToggle
              options={['lb', 'kg'] as const}
              value={selectedWeightUnit}
              onChange={(v) => setSelectedWeightUnit(v)}
            />
          </View>
          {weightDisplay != null && (
            <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
              Current: {weightDisplay.toFixed(1)} {weightUnit === 'kg' ? 'kg' : 'lbs'}
              {totalWeightChange != null ? ` · ${signedWeight(totalWeightChange, weightUnit)} total` : ''}
            </Text>
          )}
          <View style={{ height: spacing.lg }} />
          {latestWeight?.source === 'manual' && (
            <>
              <TimeRangeToggle
                options={['update', 'add'] as const}
                value={weightSaveMode}
                onChange={(v) => setWeightSaveMode(v)}
                getLabel={(v) => v === 'update' ? 'Update latest' : 'Add new'}
              />
              {weightSaveMode === 'update' && latestWeight ? (
                <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
                  Updating {fmtDateTime(latestWeight.taken_at)}
                </Text>
              ) : null}
              <View style={{ height: spacing.lg }} />
            </>
          )}
          <Button onPress={saveWeightFromSheet} disabled={savingSheet}>
            Save weight
          </Button>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'goal'} title="Goal" onClose={() => setActiveSheet(null)}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.sheetStats}>
            <SheetMetric
              label="Current"
              value={weightDisplay != null ? weightDisplay.toFixed(1) : '—'}
              unit={weightUnit === 'kg' ? 'kg' : 'lbs'}
            />
            <SheetMetric
              label="Remaining"
              value={remainingToGoal != null ? Math.abs(remainingToGoal).toFixed(1) : '—'}
              unit={remainingToGoal != null ? (weightUnit === 'kg' ? 'kg' : 'lbs') : undefined}
              caption={remainingToGoal != null ? (remainingToGoal >= 0 ? 'to goal' : 'past goal') : undefined}
              tone={remainingToGoal != null && remainingToGoal <= 0 ? 'success' : 'neutral'}
            />
          </View>
          <View style={{ height: spacing.lg }} />
          <Text variant="caption" color={colors.inkMuted} style={styles.sheetLabel}>
            GOAL WEIGHT ({weightUnit === 'kg' ? 'KG' : 'LBS'})
          </Text>
          <View style={styles.weightInputBlock}>
            <TextInput
              value={goalValue}
              onChangeText={setGoalValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={colors.inkSubtle}
              style={styles.weightHeroInput}
            />
          </View>
          <View style={{ height: spacing.lg }} />
          <Button onPress={saveGoalFromSheet} disabled={savingSheet}>
            Save goal
          </Button>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'level'} title="Estimated Level" onClose={() => setActiveSheet(null)}>
        <ScrollView>
          {headerMed && headerLevel != null ? (
            <>
              <View style={styles.levelValueRow}>
                <Text variant="hero">{formatDose(headerLevel, headerMed.default_unit).split(' ')[0]}</Text>
                <Text variant="bodyStrong" color={colors.inkMuted}>{headerMed.default_unit}</Text>
                {headerTrend ? (
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Pill tone={headerTrend === 'rising' ? 'success' : headerTrend === 'falling' ? 'warning' : 'neutral'}>
                      {`• ${headerTrend}`}
                    </Pill>
                  </View>
                ) : null}
              </View>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: 2 }}>
                {headerMed.name} · selected medication
              </Text>
              <View style={{ height: spacing.lg }} />
              {headerTraj && headerTraj.length >= 2 ? (
                <LineChart
                  data={headerTraj.filter((p) => p.t <= Date.now()).map((p) => ({ t: p.t, v: p.level }))}
                  projection={headerTraj.filter((p) => p.t >= Date.now()).map((p) => ({ t: p.t, v: p.level }))}
                  width={sheetChartWidth}
                  height={128}
                  yLabel={(v) => v.toFixed(v >= 1 ? 1 : 2)}
                  xLabel={(t) => {
                    const d = new Date(t);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  xTickCount={4}
                  yTickCount={3}
                />
              ) : null}
            </>
          ) : (
            <Text variant="body" color={colors.inkMuted}>No medication level data yet.</Text>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function NextStepCard({ step }: { step: NextStep }) {
  return (
    <View style={styles.heroCard}>
      <Eyebrow tone="accent">Today&apos;s Next Step</Eyebrow>
      <View style={{ height: 6 }} />
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{step.overdue ? "Take today's shot" : "Log today's shot"}</Text>
          <View style={styles.heroMeta}>
            <Clock3 size={14} color={colors.inkMuted} />
            <Text variant="small" color={colors.inkMuted}>
              {step.med.name} · {formatDose(step.med.default_dose, step.med.default_unit)}
            </Text>
          </View>
        </View>
        <MedVialIcon size={56} colorIndex={step.med.color_index} />
      </View>
      <View style={{ height: spacing.md }} />
      <Button
        onPress={() => router.push({ pathname: '/log-shot', params: { medicationId: step.med.id } })}
        trailingChevron
      >
        Log shot
      </Button>
    </View>
  );
}

function NoSchedCard() {
  return (
    <View style={styles.heroCard}>
      <Eyebrow tone="accent">Today&apos;s Next Step</Eyebrow>
      <View style={{ height: 6 }} />
      <Text variant="h2">All caught up.</Text>
      <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
        Nothing scheduled. Log a shot anytime.
      </Text>

      <View style={{ height: spacing.md }} />
      <Button onPress={() => router.push('/log-shot')} trailingChevron>
        Log shot
      </Button>
    </View>
  );
}

function EmptyMedsCard() {
  return (
    <View style={styles.heroCard}>
      <Eyebrow tone="accent">Get Started</Eyebrow>
      <View style={{ height: 6 }} />
      <Text variant="h2">Welcome.</Text>
      <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
        Pick a preset or add your own to start tracking.
      </Text>
      <View style={{ height: spacing.md }} />
      <Button onPress={() => router.push('/medications/new')} trailingChevron>
        Add medication
      </Button>
    </View>
  );
}

function MiniStat({
  label,
  value,
  unit,
  delta,
  deltaTone = 'neutral',
  action,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'success' | 'danger' | 'neutral';
  action?: string;
  onPress?: (() => void) | null;
}) {
  const deltaColor =
    deltaTone === 'success' ? colors.successDeep :
    deltaTone === 'danger' ? colors.redDeep :
    colors.inkMuted;
  const isEmpty = value === '—';
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress ?? undefined} style={onPress
      ? ({ pressed }: { pressed: boolean }) => [styles.mini, pressed && { opacity: 0.7 }]
      : styles.mini
    }>
      <View style={styles.miniHeader}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {label}
        </Text>
        {onPress && !isEmpty ? <ChevronRight size={12} color={colors.inkSubtle} /> : null}
      </View>
      {isEmpty && action ? (
        <Text variant="smallStrong" color={colors.red} style={{ marginTop: spacing.xs }}>
          {action}
        </Text>
      ) : (
        <>
          <View style={styles.miniValueRow}>
            <Text variant="h2">{value}</Text>
            {unit ? <Text variant="caption" color={colors.inkMuted}>{unit}</Text> : null}
          </View>
          {delta ? <Text variant="caption" color={deltaColor}>{delta}</Text> : null}
        </>
      )}
    </Wrap>
  );
}

function SheetMetric({
  label,
  value,
  unit,
  caption,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  tone?: 'success' | 'danger' | 'neutral';
}) {
  const color =
    tone === 'success' ? colors.successDeep :
    tone === 'danger' ? colors.redDeep :
    colors.ink;
  return (
    <View style={styles.sheetMetric}>
      <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={styles.miniValueRow}>
        <Text variant="h2" color={color}>{value}</Text>
        {unit ? <Text variant="caption" color={colors.inkMuted}>{unit}</Text> : null}
      </View>
      {caption ? <Text variant="caption" color={colors.inkMuted}>{caption}</Text> : null}
    </View>
  );
}

function MedLevelRow({ med, injections, isLast }: { med: MedicationRow; injections: InjectionRow[]; isLast: boolean }) {
  if (!med.half_life_hours) return null;
  const now = Date.now();
  const doses = injections.map((i) => ({ takenAt: i.taken_at, dose: i.dose }));
  const tmax = tmaxOrDefault(med.half_life_hours, med.tmax_hours);
  const level = estimatedLevelAt(doses, med.half_life_hours, tmax, now);
  const trend = trendLabel(doses, med.half_life_hours, tmax, now);
  const traj = levelTrajectory(doses, med.half_life_hours, tmax, now - 7 * DAY, now, 40);
  const series = traj.map((p) => p.level);
  const accent = colors.med[med.color_index % colors.med.length] ?? colors.red;
  return (
    <View style={[styles.levelRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={[styles.medDot, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{med.name}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {formatDose(level, med.default_unit)} · {trend}
        </Text>
      </View>
      <Sparkline data={series} width={80} height={28} color={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.redSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(176, 32, 46, 0.18)',
    padding: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mini: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
    minHeight: 92,
  },
  miniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  levelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  medDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sheetStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetMetric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 92,
    gap: 4,
  },
  sheetLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  weightInputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  weightHeroInput: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 36,
    lineHeight: 44,
    color: colors.ink,
    paddingVertical: spacing.xs,
  },
});
