import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Text } from '@/components/Text';
import { HERO_CHART_HEIGHT, TodayLevelChart } from '@/components/today-level-chart';
import { TodayLogBand } from '@/components/today-log-band';
import { useSwapTransition, useTint } from '@/components/today-motion';
import type { TodayMedicationSummary } from '@/components/today-types';
import { TodayWeekAxis } from '@/components/today-week-axis';
import { blendCurvePartsFor } from '@/components/today-level-series';
import type { MedicationRow } from '@/db/types';
import { parseComposition } from '@/domain/blends';
import { cycleProgressLabel } from '@/domain/cycle';
import { doseOnDay } from '@/domain/doseByDay';
import { EVIDENCE_LABELS, getPreset, type Unit } from '@/domain/peptides';
import { colors, elevation, motion, radius, spacing } from '@/theme';

/** The line Poke may never drop, wherever it puts it. */
const ESTIMATE_DISCLAIMER = 'Estimate only. Do not use it to make dosing decisions.';

/**
 * The focused medication, and the whole of what Today says about it: what it
 * is, where the level stands, what the week looks like, and the one action.
 *
 * The chart, the axis and the band are their own components, and each of them
 * animates without the card knowing. What the card owns is the line at the top:
 * the dot tints to the new medication, and the name and dose leave together and
 * come back as the new pair, because they are one fact about one medication and
 * must never be seen half swapped.
 *
 * The info button is excluded from all of it. Legal copy does not move.
 */
export function TodayHeroCard({
  summary,
  pro,
  contentWidth,
  nowMs,
  entered,
  logToken,
  onStartBreak,
}: {
  summary: TodayMedicationSummary;
  pro: boolean;
  contentWidth: number;
  nowMs: number;
  entered: boolean;
  logToken: number;
  onStartBreak: (medicationId: string) => void;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  // "Keep going" writes nothing. The plan is a plan, and a user who passes its
  // last day has changed no fact about the medication, so the card simply stops
  // asking for the rest of the day. Tomorrow the state is `pastPlan`, which
  // counts on and offers nothing.
  const [lastDayDismissed, setLastDayDismissed] = useState(false);
  const { medication, level, cycle } = summary;
  const color = medicationColor(medication.color_index);
  const unit = unitLabel(medication.default_unit);
  const preset = medication.preset_id ? getPreset(medication.preset_id) : undefined;
  const blendSources = blendSourceLines(medication);
  // The dose this day carries, not the default. A plan of 6 mg on Monday and
  // 2 mg on Thursday must read 6 mg on a Monday. A day the plan skips takes the
  // default dose, which is what every medication without a plan reads.
  const plannedDose = doseOnDay(medication.dose_by_day, medication.default_dose, nowMs);

  const value = pro && level.kind === 'curve' ? level.current : null;
  const tint = useTint(color);
  const dotStyle = useAnimatedStyle(() => ({ backgroundColor: tint.value }));
  const title = useSwapTransition(
    { name: medication.name, dose: `${formatAmount(plannedDose, medication.default_unit)} ${unit}` },
    medication.id,
    { swapAt: motion.press, axis: 'x', distance: 10, out: motion.press },
  );

  return (
    <View testID="today-hero-card" style={styles.shadow}>
      <View style={styles.clip}>
        <View style={styles.header}>
          <Animated.View style={[styles.dot, dotStyle]} />
          <Animated.View style={[styles.title, title.style]}>
            <Text variant="h2" numberOfLines={1} style={styles.name}>{title.shown.name}</Text>
            <View style={styles.dosePill}>
              <Text variant="caption" color={colors.inkMuted}>{title.shown.dose}</Text>
            </View>
          </Animated.View>
          <Pressable
            testID="today-estimate-info"
            accessibilityRole="button"
            accessibilityLabel="About this estimate"
            hitSlop={8}
            onPress={() => setAboutOpen(true)}
            style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
          >
            <Info size={18} color={colors.inkSubtle} />
          </Pressable>
        </View>

        {/* Where the plan stands, and only when the user set one. The bar is a
            picture of the same sentence, so it needs no label of its own. */}
        {cycle.kind === 'running' || cycle.kind === 'pastPlan' ? (
          <View style={styles.cycleBox}>
            <Text variant="caption" color={colors.inkMuted}>
              {cycleProgressLabel(cycle.frame)}
            </Text>
            <View style={styles.cycleTrack}>
              <View
                style={[
                  styles.cycleFill,
                  { width: `${Math.round((cycle.kind === 'running' ? cycle.progress : 1) * 100)}%`, backgroundColor: color },
                ]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.chartBox}>
          <TodayLevelChart
            width={contentWidth}
            color={color}
            series={level}
            fromMs={summary.windowFromMs}
            toMs={summary.windowToMs}
            nowMs={nowMs}
            medicationId={medication.id}
            value={value}
            valueDecimals={levelDecimals(value, medication.default_unit)}
            unitLabel={unit}
            onUnlock={pro ? null : () => router.push('/paywall?source=today_level')}
            emptyHint="Log a shot to see your level"
            entered={entered}
            logToken={logToken}
          />
        </View>

        <TodayWeekAxis
          week={summary.week}
          color={color}
          medicationName={medication.name}
          medicationId={medication.id}
          entered={entered}
          logToken={logToken}
        />

        <TodayLogBand
          dose={summary.dose}
          medicationId={medication.id}
          medicationName={medication.name}
        />

        {/* The last day of the plan, and the only day this appears. Both
            choices are the user's, and neither one is presented as the right
            one: Poke states the date it was told and stands back. */}
        {cycle.kind === 'running' && cycle.onLastDay && !lastDayDismissed ? (
          <View style={styles.lastDayBox}>
            <Text variant="small" color={colors.ink}>The plan you set ends today.</Text>
            <View style={styles.lastDayActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Start a break from ${medication.name}`}
                onPress={() => onStartBreak(medication.id)}
                style={({ pressed }) => [styles.lastDayPrimary, pressed && styles.pressed]}
              >
                <Text variant="caption" color={colors.inkInverse}>Start break</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Keep taking ${medication.name}`}
                onPress={() => setLastDayDismissed(true)}
                style={({ pressed }) => [styles.lastDayQuiet, pressed && styles.pressed]}
              >
                <Text variant="caption" color={colors.inkMuted}>Keep going</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <BottomSheet
        visible={aboutOpen}
        title="About this estimate"
        onClose={() => setAboutOpen(false)}
      >
        <View style={styles.aboutBody}>
          <Text>{ESTIMATE_DISCLAIMER}</Text>
          {blendSources ? (
            <>
              <Text variant="smallStrong" color={colors.ink}>
                The curve is the sum of the parts on your vial label. Each part has its own source.
              </Text>
              {blendSources.map((line) => (
                <Text key={line.name} variant="small" color={colors.inkMuted}>
                  {`${line.name}: ${line.source}`}
                </Text>
              ))}
            </>
          ) : (
            <>
              <Text variant="smallStrong" color={colors.ink}>
                {preset ? EVIDENCE_LABELS[preset.evidence] : 'Half-life on file for this medication'}
              </Text>
              <Text variant="small" color={colors.inkMuted}>
                {preset
                  ? preset.source
                  : 'Poke draws this curve from the shots you logged and the half-life saved with this medication.'}
              </Text>
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

/**
 * The source lines for a blend that draws: one line per part of the entered
 * composition, in the label's own order. A part with a sourced half-life names
 * its source, and a part without one says so, because that part sits in the
 * total without adding to the curve and the sheet is where that is explained.
 * Null for everything that is not a drawing blend, which keeps the single
 * medication sheet exactly as it was.
 */
function blendSourceLines(medication: MedicationRow): { name: string; source: string }[] | null {
  const parts = blendCurvePartsFor(medication);
  if (!parts) return null;
  const drawable = new Set(parts.map((part) => part.preset.id));
  const composition = parseComposition(medication.composition) ?? [];
  return composition.map((component) => {
    const partPreset = getPreset(component.presetId);
    const name = partPreset?.name ?? component.presetId;
    if (partPreset && drawable.has(partPreset.id)) {
      return { name, source: partPreset.source };
    }
    return { name, source: EVIDENCE_LABELS.unsourced };
  });
}

export function medicationColor(colorIndex: number): string {
  return colors.med[colorIndex % colors.med.length] ?? colors.accent;
}

export function unitLabel(unit: Unit): string {
  return unit === 'iu' ? 'IU' : unit;
}

/** A dose as the user typed it: 0.5 stays 0.5, and 250 mcg keeps no decimals. */
export function formatAmount(value: number, unit: Unit): string {
  if (unit === 'mcg') return String(Math.round(value));
  return String(Number(value.toFixed(3)));
}

/** The estimate under the now dot. Two decimals below a milligram, none for mcg. */
export function formatLevel(value: number, unit: Unit): string {
  return value.toFixed(levelDecimals(value, unit));
}

/**
 * The same rule, as a count of decimals, because the chart counts the estimate
 * up on the UI thread and has to know how to read a number it has not reached.
 */
export function levelDecimals(value: number | null, unit: Unit): number {
  if (unit === 'mcg') return 0;
  return (value ?? 0) < 1 ? 2 : 1;
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.xl,
    ...elevation.card,
  },
  clip: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    flex: 1,
    letterSpacing: -0.2,
  },
  dosePill: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  infoButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  chartBox: {
    height: HERO_CHART_HEIGHT + 6,
    paddingTop: 6,
  },
  cycleBox: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: 6,
  },
  cycleTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  cycleFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  lastDayBox: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  lastDayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastDayPrimary: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
  },
  lastDayQuiet: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  aboutBody: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  pressed: {
    opacity: 0.72,
  },
});
