import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { Pill } from '@/components/Pill';
import { LineChart } from '@/components/LineChart';
import { TimeRangeToggle } from '@/components/TimeRangeToggle';
import { chartHeightFor } from '@/components/chart-height';

import { ProLock } from '@/components/ProLock';

import { listMedications } from '@/repositories/medications';
import { listInjections } from '@/repositories/injections';
import type { InjectionRow, MedicationRow } from '@/db/types';
import { EVIDENCE_LABELS, getPreset, type PeptidePreset, type Unit } from '@/domain/peptides';
import { levelTrajectory, peakTroughAvg, trendLabel, tmaxOrDefault, type DoseEvent } from '@/domain/pk';
import { formatDose } from '@/domain/units';
import { maybePromptForReview } from '@/services/review';
import { useAppStore } from '@/stores/app';
import { useIsPro } from '@/stores/entitlement';
import { colors, spacing } from '@/theme';

const RANGES = ['7d', '14d', '30d'] as const;
type Range = typeof RANGES[number];

const TREND_LABEL = {
  rising: 'Rising',
  falling: 'Falling',
  steady: 'Steady',
} as const;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** The chart needs a smooth line. 100 segments draw one across any range. */
const CHART_STEPS = 100;
/** The curve on a phone. A wider screen grows it; see `chartHeightFor`. */
const CHART_HEIGHT = 200;
/** The card the curve sits in is `padding="md"` on all four sides. */
const CHART_PAD = spacing.md;

/** The screen ends on one caption, and every state of it is one caption. */
const FOOTNOTE = 'Poke estimates this level from the shots you logged and the half-life on file for'
  + ' this medication. The estimate is not a measurement. This trend is not for dosing.';

/**
 * What stands behind the half-life, when the number is not a published one.
 *
 * A label or a trial half-life is cited where the user set the medication up,
 * and repeating the tier here would be a caption the reader does not need. An
 * estimate is different: the peak, the trough and the average on this screen are
 * all read off a number with limited evidence, and the screen has to say so
 * where the numbers are. A medication Poke carries no sourced half-life for is
 * running on the number the user typed, and only that is honest to print.
 *
 * It joins the footnote rather than standing on its own, so this stays one
 * caption and not a caption with a badge over it.
 *
 * The preset is only the basis while the number on file is still the preset's.
 * `medications/[id]` lets the user type over it, and after that the curve runs
 * on the user's number. Citing the preset's evidence tier there would credit
 * Poke's source for a figure Poke did not supply, so the override is named
 * first and every other branch stays as it was.
 */
function halfLifeBasis(preset: PeptidePreset | undefined, med: MedicationRow | null): string {
  if (!preset) return 'Half-life entered by you.';
  if (med && med.half_life_hours !== preset.halfLifeHours) return 'Half-life entered by you.';
  if (preset.evidence === 'estimate') return `${EVIDENCE_LABELS.estimate}.`;
  if (preset.evidence === 'unsourced') return 'Half-life entered by you.';
  return '';
}

function rangeMs(r: Range): number {
  if (r === '7d') return 7 * DAY;
  if (r === '14d') return 14 * DAY;
  return 30 * DAY;
}

/**
 * The peak and the trough are the point of this screen, so the stats read the
 * range once an hour. The chart grid steps 3 to 7 hours at a time and walks
 * past the minimum that sits between two shots.
 */
function statsSteps(r: Range): number {
  return Math.round(rangeMs(r) / HOUR);
}

/**
 * A medication carries one default unit, and every logged shot keeps the unit
 * it was logged with. `updateMedicationDefaults` can move the two apart, so the
 * doses convert to one unit before anything adds them up. IU is medication
 * specific and converts to nothing, so it returns null and the screen says how
 * many shots it left out.
 */
function doseIn(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value;
  if (from === 'mg' && to === 'mcg') return value * 1000;
  if (from === 'mcg' && to === 'mg') return value / 1000;
  return null;
}

function toDoses(rows: InjectionRow[] | null, unit: Unit): { events: DoseEvent[]; skipped: number } | null {
  if (!rows) return null;
  const events: DoseEvent[] = [];
  let skipped = 0;
  for (const row of rows) {
    const dose = doseIn(row.dose, row.unit, unit);
    if (dose === null) skipped += 1;
    else events.push({ takenAt: row.taken_at, dose });
  }
  return { events, skipped };
}

/**
 * `formatDose` rounds mcg to a whole number and prints two decimals below 1 mg.
 * Under that the screen prints a zero, and a chart of zeros is not a chart.
 */
function printsAboveZero(level: number, unit: Unit): boolean {
  if (unit === 'mcg') return level >= 0.5;
  if (unit === 'mg') return level >= 0.005;
  return level > 0;
}

/** A stat hint names the day. A bare clock time reads as today on a 30d range. */
function fmtMoment(ms: number): string {
  return format(new Date(ms), "MMM d 'at' h:mm a");
}

function unitLabel(unit: Unit): string {
  return unit === 'iu' ? 'IU' : unit;
}

/** Each branch is a different truth. None of them may claim the user logged nothing. */
function emptyChartCopy(
  rows: InjectionRow[] | null,
  doses: { events: DoseEvent[]; skipped: number } | null,
  unit: Unit,
): string {
  if (!rows || !doses) return 'Poke is reading your shots.';
  if (doses.events.length === 0 && doses.skipped > 0) {
    return `Poke cannot convert the logged unit to ${unitLabel(unit)}. The chart needs one unit.`;
  }
  if (doses.events.length === 0) return 'Log a shot to see the level chart.';
  return 'The estimated level in this range rounds to zero. Log a shot to see the level chart.';
}

export default function LevelReportScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ medicationId?: string }>();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const pro = useIsPro();
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('14d');
  // The rows carry the medication they were read for. Nothing else can tell a
  // late answer for the last chip from the answer for the chip on screen.
  const [shots, setShots] = useState<{ medicationId: string; rows: InjectionRow[] } | null>(null);

  useEffect(() => {
    (async () => {
      const all = await listMedications();
      const withHalfLife = all.filter((m) => m.status === 'active' && m.half_life_hours);
      setMeds(withHalfLife);
      if (withHalfLife.length > 0) {
        setSelected((cur) => {
          const requested = params.medicationId && withHalfLife.find((m) => m.id === params.medicationId);
          if (requested) return requested.id;
          return cur && withHalfLife.find((m) => m.id === cur) ? cur : withHalfLife[0].id;
        });
      }
    })();
  }, [dataVersion, params.medicationId]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    (async () => {
      const list = await listInjections({ medicationId: selected, fromMs: Date.now() - 60 * DAY });
      if (live) setShots({ medicationId: selected, rows: list });
    })().catch(() => {});
    return () => { live = false; };
  }, [selected, dataVersion]);

  const med = meds.find((m) => m.id === selected) ?? null;
  // One medication owns the name, the half-life, the unit and the curve. Rows
  // read for another medication never pass this line, so no frame paints one
  // medication's shots under another medication's name.
  const rows = med && shots?.medicationId === med.id ? shots.rows : null;
  const unit: Unit = med?.default_unit ?? 'mg';
  const halfLife = med?.half_life_hours ?? null;
  const doses = useMemo(() => toDoses(rows, unit), [rows, unit]);
  const events = doses?.events ?? null;

  const now = Date.now();
  const tmax = halfLife ? tmaxOrDefault(halfLife, med?.tmax_hours) : 0;
  const rangeStart = now - rangeMs(range);
  // Extend forward to show the elimination tail of what's already been logged.
  // No future doses are projected — peaks reflect only actual injections.
  const forecastEndMs = halfLife
    ? now + Math.max(2 * DAY, halfLife * HOUR * 2)
    : now;

  const past = useMemo(
    () => (events && halfLife ? levelTrajectory(events, halfLife, tmax, rangeStart, now, CHART_STEPS) : []),
    [events, halfLife, tmax, rangeStart, now],
  );
  const future = useMemo(
    () => (events && halfLife ? levelTrajectory(events, halfLife, tmax, now, forecastEndMs, CHART_STEPS) : []),
    [events, halfLife, tmax, now, forecastEndMs],
  );
  // The stats cover the selected range and stop at now. The forecast tail decays
  // below every real trough, so a stat taken across it reports a level the user
  // has not reached yet.
  const stats = useMemo(
    () => peakTroughAvg(
      events && halfLife ? levelTrajectory(events, halfLife, tmax, rangeStart, now, statsSteps(range)) : [],
    ),
    [events, halfLife, tmax, rangeStart, now, range],
  );

  const data = past.map((p) => ({ t: p.t, v: p.level }));
  const proj = future.map((p) => ({ t: p.t, v: p.level }));
  const hasLevel = printsAboveZero(stats.peak.level, unit);
  const trend = events && halfLife ? trendLabel(events, halfLife, tmax, now) : 'steady';

  const chartW = Math.min(width, 600) - spacing.screen * 2;
  // The card is what the reader sees, so the card's width is what its height
  // follows. The curve inside it keeps whatever the padding leaves.
  const chartH = chartHeightFor(chartW, CHART_HEIGHT + CHART_PAD * 2) - CHART_PAD * 2;

  const preset = med?.preset_id ? getPreset(med.preset_id) : undefined;
  const footnote = [halfLifeBasis(preset, med), FOOTNOTE].filter(Boolean).join(' ');

  // The curve is the paid hook, and it only becomes one at the third dose: below that
  // it is a single rise and decay, which is a textbook diagram, not the user's routine.
  // The dwell timer keeps this a read, not a screen the user passed through.
  const dosesInWindow = useMemo(
    () => (rows ? rows.filter((r) => r.taken_at >= rangeStart).length : 0),
    [rows, rangeStart],
  );

  useEffect(() => {
    if (!pro || dosesInWindow < 3) return;
    const timer = setTimeout(() => { maybePromptForReview('level-curve').catch(() => {}); }, 3000);
    return () => clearTimeout(timer);
  }, [pro, dosesInWindow]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Header title="Medication level" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.hero, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        {!pro ? (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <ProLock
              source="level_report"
              title="Your level day by day"
              body="See the estimated amount in your body between shots. Poke shows the peak, the trough and the average across each dose window."
            />
          </View>
        ) : meds.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.screen }}>
            <Card padding="lg">
              <Text variant="h3">No medication has a half-life yet.</Text>
              <Text variant="small" color={colors.inkMuted} style={{ marginTop: 4 }}>
                Add a half-life to a medication. Poke then draws the estimated level chart.
              </Text>
            </Card>
          </View>
        ) : (
          <>
            <Section gap="sm">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {meds.map((m) => {
                  const active = m.id === selected;
                  return (
                    <Pressable key={m.id} onPress={() => setSelected(m.id)} style={[styles.chip, active && styles.chipActive]}>
                      <Text variant="smallStrong" color={active ? colors.inkInverse : colors.ink}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Section>

            <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.md }}>
              <View style={styles.headRow}>
                <View>
                  <Text variant="smallStrong" color={colors.inkMuted}>{med?.name}</Text>
                  <Text variant="hero" style={{ marginTop: 4 }}>
                    {hasLevel ? formatDose(stats.peak.level, unit) : '—'}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>peak in this range</Text>
                </View>
                {hasLevel ? (
                  <Pill tone={trend === 'rising' ? 'success' : trend === 'falling' ? 'warning' : 'neutral'}>
                    {TREND_LABEL[trend]}
                  </Pill>
                ) : null}
              </View>

              <TimeRangeToggle options={RANGES} value={range} onChange={setRange} size="sm" />
              <View style={{ height: spacing.md }} />

              <Card padding="md">
                {hasLevel && data.length >= 2 ? (
                  <>
                    <LineChart
                      data={data}
                      projection={proj.length >= 2 ? proj : undefined}
                      width={chartW - spacing.lg * 2}
                      height={chartH}
                      xLabel={(t) => {
                        const d = new Date(t);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    {doses && doses.skipped > 0 ? (
                      <Text variant="caption" color={colors.inkSubtle} style={{ marginTop: spacing.sm }}>
                        {`Poke left ${doses.skipped} ${doses.skipped === 1 ? 'shot' : 'shots'} out of this chart. Poke cannot convert the logged unit to ${unitLabel(unit)}.`}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text variant="small" color={colors.inkMuted}>{emptyChartCopy(rows, doses, unit)}</Text>
                )}
              </Card>

              <View style={{ height: spacing.lg }} />

              <View style={styles.statRow}>
                <Stat
                  label="Peak"
                  value={hasLevel ? formatDose(stats.peak.level, unit) : '—'}
                  hint={hasLevel ? fmtMoment(stats.peak.t) : undefined}
                />
                <Stat
                  label="Trough"
                  value={hasLevel ? formatDose(stats.trough.level, unit) : '—'}
                  hint={hasLevel ? fmtMoment(stats.trough.t) : undefined}
                />
                <Stat
                  label="Average"
                  value={hasLevel ? formatDose(stats.avg, unit) : '—'}
                  hint={hasLevel ? 'this range' : undefined}
                />
              </View>

              <View style={{ height: spacing.xl }} />

              {/* "the half-life you set" was false for almost everybody. A
                  medication picked from the catalogue carries the published
                  half-life `medications/new.tsx` fills in, and an onboarding run
                  never shows that field at all. The old line handed Poke's own
                  cited number back to the user as theirs. "on file" is true
                  whether Poke supplied the number or the user typed it, and
                  `halfLifeBasis` says which it was when that matters. */}
              <Text variant="caption" color={colors.inkSubtle}>{footnote}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="smallStrong" color={colors.inkMuted}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
      {hint ? <Text variant="caption" color={colors.inkSubtle}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
