import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, Flame, Plus, Syringe } from 'lucide-react-native';
import { format, isSameDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CardPager } from '@/components/CardPager';
import { ProLock } from '@/components/ProLock';
import { Sparkline } from '@/components/Sparkline';
import { Text } from '@/components/Text';
import type {
  InjectionRow,
  MeasurementRow,
  MedicationRow,
  PreferencesRow,
} from '@/db/types';
import { estimatedLevelAt, tmaxOrDefault } from '@/domain/pk';
import { sideEffectLabel } from '@/domain/sideEffects';
import { medicationScheduleFromStored, nextScheduledDoses } from '@/domain/scheduling';
import {
  computeMedicationScheduleStreak,
  type ScheduleStreak,
} from '@/domain/streaks';
import { getBodySite } from '@/domain/bodySites';
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/units';
import { listInjections } from '@/repositories/injections';
import { listMeasurements } from '@/repositories/measurements';
import { listMedications } from '@/repositories/medications';
import { getPreferences } from '@/repositories/preferences';
import { maybePromptForReview } from '@/services/review';
import { listSideEffects, type SideEffectLog } from '@/repositories/sideEffects';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, radius, spacing } from '@/theme';
import { endOfDay, fmtTime, startOfDay } from '@/utils/date';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The reading column. `styles.content` caps itself here, and so does one page. */
const CONTENT_MAX_WIDTH = 600;

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
  /** The one action this medication offers today. It rides with the card. */
  action: TodayDoseAction;
}

interface TodayDashboard {
  medications: MedicationSummary[];
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
  // The level is the paid part of this screen. `app/_layout.tsx` holds the first
  // paint until the entitlement settles, so this is an answer and never a guess.
  const pro = useIsPro();
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [injections, setInjections] = useState<Record<string, InjectionRow[]>>({});
  const [weights, setWeights] = useState<MeasurementRow[]>([]);
  const [preferences, setPreferences] = useState<PreferencesRow | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
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
    () => buildDashboard({
      medications,
      injections,
      weights,
      preferences,
      sideEffects,
      estimateLevels: pro,
      now: Date.now(),
    }),
    [injections, medications, preferences, pro, sideEffects, weights],
  );

  // The pager needs a page width before it can snap to one. The column already
  // fixes that width, so read it from the window rather than from `onLayout`:
  // a measured width costs one blank frame, and that frame is the hero card.
  const pageWidth = Math.max(0, Math.min(windowWidth, CONTENT_MAX_WIDTH) - spacing.screen * 2);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Streaks here count whole weeks, so four is a month on schedule. That is earned,
  // and the home screen is a resting place rather than a task the ask would interrupt.
  const streakWeeks = dashboard.streak.current;
  useEffect(() => {
    if (streakWeeks < 4) return;
    const timer = setTimeout(() => { maybePromptForReview('streak').catch(() => {}); }, 2000);
    return () => clearTimeout(timer);
  }, [streakWeeks]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <TodayHeader streak={dashboard.streak.current} />

        <MedicationSection medications={dashboard.medications} pageWidth={pageWidth} pro={pro} />

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
  estimateLevels,
  now,
}: {
  medications: MedicationRow[];
  injections: Record<string, InjectionRow[]>;
  weights: MeasurementRow[];
  preferences: PreferencesRow | null;
  sideEffects: SideEffectLog[];
  /** False on a free account, where the card prints no level to compute one for. */
  estimateLevels: boolean;
  now: number;
}): TodayDashboard {
  const reminderTime = preferences?.reminder_time ?? '09:00';
  const endOfToday = endOfDay(now);
  const summaries = medications.map((medication): MedicationSummary => {
    const medicationInjections = injections[medication.id] ?? [];
    const halfLife = medication.half_life_hours;
    const estimate = estimateLevels && halfLife
      ? estimateLevelSeries(medicationInjections, halfLife, medication.tmax_hours, now)
      : { level: null, weekLevels: [] };
    const schedule = medicationScheduleFromStored({
      medicationId: medication.id,
      frequencyKind: medication.frequency_kind,
      frequencyValue: medication.frequency_value,
      createdAt: medication.created_at,
      reminderTime,
    });
    const latestShot = medicationInjections[0];
    // A shot logged at 5 am sits before the 9 am reminder, so today's slot is
    // still in the future and the card named it "today" next to its own
    // "Logged" pill. That dose is taken, so the next one is the slot after it.
    const upcoming = schedule ? nextScheduledDoses(schedule, now, 2) : [];
    const takenAlready = latestShot !== undefined
      && upcoming[0] !== undefined
      && isSameDay(upcoming[0].scheduledAt, latestShot.taken_at);
    const nextAt = (takenAlready ? upcoming[1]?.scheduledAt : upcoming[0]?.scheduledAt) ?? now;
    return {
      medication,
      injections: medicationInjections,
      nextAt,
      level: estimate.level,
      weekLevels: estimate.weekLevels,
      action: latestShot && isSameDay(latestShot.taken_at, now)
        ? { kind: 'logged', injection: latestShot }
        : nextAt <= endOfToday
          ? { kind: 'due', medicationId: medication.id }
          : { kind: 'none' },
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

/**
 * The estimated level now, and the same estimate on each of the last seven days.
 * Eight passes over every shot a medication has, which is why the caller skips
 * this whole call when the card behind the lock will not print any of it.
 */
function estimateLevelSeries(
  medicationInjections: readonly InjectionRow[],
  halfLifeHours: number,
  tmaxHours: number | null,
  now: number,
): { level: number; weekLevels: number[] } {
  const doses = medicationInjections.map((injection) => ({ takenAt: injection.taken_at, dose: injection.dose }));
  const tmax = tmaxOrDefault(halfLifeHours, tmaxHours);
  return {
    level: estimatedLevelAt(doses, halfLifeHours, tmax, now),
    weekLevels: Array.from({ length: 7 }, (_, index) => (
      estimatedLevelAt(doses, halfLifeHours, tmax, now - (6 - index) * DAY_MS)
    )),
  };
}

/**
 * Card order. Two groups, and each group runs A to Z.
 *
 * First group: every medication with business today, which is a shot due today
 * or a shot already logged today. Today is what the screen is for, so the card
 * you see without a swipe is a card you can act on.
 *
 * A logged shot stays in the first group on purpose. If a shot moved its card to
 * the back the moment you logged it, the cards would slide under your finger on
 * the way back from the log screen and you would be looking at a medication you
 * did not choose.
 *
 * Everything else falls to the second group, so a weekly medication four days out
 * sits behind the daily one instead of in front of it. Sorting by the next dose
 * alone is what hid the weekly medication in the first place: a daily shot is
 * always sooner.
 *
 * A to Z inside each group, because the medication list and the picker are
 * already A to Z, and because it holds still from one day to the next.
 */
function byTodayThenName(a: MedicationSummary, b: MedicationSummary): number {
  const rank = (summary: MedicationSummary) => (summary.action.kind === 'none' ? 1 : 0);
  return rank(a) - rank(b) || a.medication.name.localeCompare(b.medication.name);
}

function TodayHeader({ streak }: { streak: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text variant="display">Today</Text>
        <Text variant="small" color={colors.inkMuted}>{format(new Date(), 'EEEE, MMMM d')}</Text>
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

function MedicationSection({
  medications,
  pageWidth,
  pro,
}: {
  medications: MedicationSummary[];
  pageWidth: number;
  pro: boolean;
}) {
  // The card the pager opens on after a shot. The order is A to Z, so without
  // this the card you land on after logging is the medication whose name sorts
  // first rather than the one you injected.
  const focusMedicationId = useAppStore((state) => state.focusMedicationId);
  const setFocusMedication = useAppStore((state) => state.setFocusMedication);

  if (medications.length === 0) return <EmptyMedication pro={pro} />;
  // One medication keeps the plain column. A pager around a single card would
  // draw a row of one dot, and one dot says nothing.
  if (medications.length === 1) return <MedicationPage summary={medications[0]} pro={pro} />;
  return (
    <CardPager
      pageWidth={pageWidth}
      pageName="Medication"
      focusKey={focusMedicationId}
      onUserScroll={() => setFocusMedication(null)}
    >
      {medications.map((summary) => (
        <MedicationPage key={summary.medication.id} summary={summary} pro={pro} />
      ))}
    </CardPager>
  );
}

/**
 * The card and the one action that belongs to it, in that order.
 *
 * On a free account the level comes off the card and the lock takes it, below
 * the action rather than above it: the shot is what the user came for, and a
 * paid offer does not stand between a card and its own button.
 */
function MedicationPage({ summary, pro }: { summary: MedicationSummary; pro: boolean }) {
  return (
    <View style={styles.medicationPage}>
      <MedicationCard summary={summary} pro={pro} />
      <DoseAction action={summary.action} medicationName={summary.medication.name} />
      {!pro && summary.medication.half_life_hours ? (
        <ProLock
          title="Your level day by day"
          body="Poke estimates the amount in your body from the shots you logged. Poke draws that estimate for each of the last seven days."
        />
      ) : null}
    </View>
  );
}

function MedicationCard({ summary, pro }: { summary: MedicationSummary; pro: boolean }) {
  const { medication, level, weekLevels } = summary;
  return (
    <Card style={styles.medicationCard}>
      <View style={styles.medicationHead}>
        <Text variant="small" color={colors.inkMuted}>
          {pro ? 'Estimated current level' : 'Next shot'}
        </Text>
        <View style={styles.medicationChip}>
          <Text variant="caption" color={colors.accent}>{medication.name}</Text>
        </View>
      </View>
      {pro ? (
        <>
          <View style={styles.levelRow}>
            <Text style={styles.levelValue}>{level === null ? '—' : formatLevel(level, medication.default_unit)}</Text>
            <Text variant="bodyStrong" color={colors.inkMuted}>{level === null ? 'No estimate' : medication.default_unit}</Text>
          </View>
          {weekLevels.length === 7 ? <WeekBars levels={weekLevels} /> : null}
        </>
      ) : null}
      <NextDose summary={summary} pro={pro} />
    </Card>
  );
}

/**
 * The medication name and the next shot day are free, so this row reads the same
 * on both sides of the paywall. Only the tap changes: `/reports/level` locks the
 * number this card no longer prints, so a free account does not travel to a
 * second lock. The lock under the card is the one tap to the paywall.
 */
function NextDose({ summary, pro }: { summary: MedicationSummary; pro: boolean }) {
  const { medication, nextAt } = summary;
  const cadence = cadenceLabel(medication, nextAt);
  const copy = (
    <View style={styles.nextDoseCopy}>
      {cadence === null ? null : (
        <Text variant="smallStrong">{cadence} · {countdownLabel(nextAt)}</Text>
      )}
      <Text variant="caption" color={colors.inkMuted}>{medication.default_dose} {medication.default_unit}</Text>
    </View>
  );
  if (!pro) return <View style={styles.nextDosePlain}>{copy}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${medication.name} level details`}
      onPress={() => router.push({ pathname: '/reports/level', params: { medicationId: medication.id } })}
      style={styles.nextDose}
    >
      {copy}
      <ChevronRight size={18} color={colors.inkSubtle} />
    </Pressable>
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

function DoseAction({ action, medicationName }: { action: TodayDoseAction; medicationName: string }) {
  if (action.kind === 'none') return null;
  if (action.kind === 'due') {
    return (
      <Button
        // The card above names the medication, so the button stays short. A
        // screen reader reads the button on its own, so that label names it.
        accessibilityLabel={`Log ${medicationName} shot`}
        leadingIcon={<Syringe size={21} color={colors.inkInverse} />}
        onPress={() => router.push({ pathname: '/log-shot', params: { medicationId: action.medicationId } })}
      >
        Log shot
      </Button>
    );
  }
  const site = action.injection.site_id ? getBodySite(action.injection.site_id) : undefined;
  const time = fmtTime(action.injection.taken_at).toLocaleLowerCase();
  return (
    <View style={styles.loggedRow}>
      <View style={styles.loggedIcon}>
        <Check size={18} strokeWidth={2.5} color={colors.accent} />
      </View>
      <Text variant="smallStrong" style={styles.loggedText}>
        Logged {time}
        {site ? ` · ${site.label.toLocaleLowerCase()}` : ''}
      </Text>
    </View>
  );
}

function EmptyMedication({ pro }: { pro: boolean }) {
  return (
    <Card style={styles.emptyCard}>
      <Text variant="h2">Add your medication.</Text>
      {/* A free account never sees the level on this card, so the promise on the
          empty card only names what that account will get. */}
      <Text color={colors.inkMuted}>
        {pro
          ? 'Poke will put your next shot and estimated level here.'
          : 'Poke will put your next shot day here.'}
      </Text>
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
        ) : dashboard.weight ? (
          <Text variant="small" color={colors.inkMuted}>Log a second weight to see a trend.</Text>
        ) : (
          <Text variant="small" color={colors.inkMuted}>No weight yet.</Text>
        )}
        <Text variant="smallStrong" color={colors.amber}>Log weight</Text>
      </Card>
    </Pressable>
  );
}

function SideEffectTile({ sideEffect }: { sideEffect: SideEffectLog | null }) {
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
            ? `Last: ${sideEffectLabel(sideEffect.effect)} · ${sideEffect.severity}/10`
            : 'No side effect yet.'}
        </Text>
        <Text variant="smallStrong" color={colors.violet}>Log side effect</Text>
      </Card>
    </Pressable>
  );
}

/**
 * How often the shot comes round, in the words of the schedule that was saved.
 *
 * The row named the weekday of the next dose whatever the frequency, so a daily
 * medication read "Shot day is Sunday" on a Sunday and "Shot day is Monday" the
 * next morning. Only a weekly schedule has one day to name.
 *
 * Null is the medication that carries no schedule, where a weekday and a
 * countdown would both be invented. `medicationScheduleFromStored` returns null
 * for the same row, so the card and the reminder agree on which medication has
 * no next dose.
 */
function cadenceLabel(medication: MedicationRow, nextAt: number): string | null {
  switch (medication.frequency_kind) {
    case 'weekly':
      return `Shot day is ${format(nextAt, 'EEEE')}`;
    case 'twice_weekly':
      // Two days, and the edit screen is where both are named. One of them here
      // would read as the only one.
      return 'Twice a week';
    case 'daily':
      return 'Every day';
    case 'every_n_days':
      return medication.frequency_value !== null && medication.frequency_value > 1
        ? `Every ${medication.frequency_value} days`
        : 'Every day';
    case 'custom':
      return null;
  }
}

function countdownLabel(timestamp: number): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(Date.now())) / DAY_MS);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  // "Sunday · 7 days" read as how long the week is. The preposition is what
  // turns the number back into a date.
  return `in ${days} days`;
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
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: 112,
  },
  // The same gap the column puts between its own children, so one medication
  // looks the way it looked before the pager existed.
  medicationPage: {
    gap: spacing.md,
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
  // No divider and no tap target: on a free account this row is the body of the
  // card rather than a row under a chart.
  nextDosePlain: {
    flexDirection: 'row',
    alignItems: 'center',
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
