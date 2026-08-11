import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Text } from '@/components/Text';
import { HERO_CHART_HEIGHT, TodayLevelChart } from '@/components/today-level-chart';
import { TodayLogBand } from '@/components/today-log-band';
import type { TodayMedicationSummary } from '@/components/today-types';
import { TodayWeekAxis } from '@/components/today-week-axis';
import { EVIDENCE_LABELS, getPreset, type Unit } from '@/domain/peptides';
import { colors, elevation, radius, spacing } from '@/theme';

/** The line Poke may never drop, wherever it puts it. */
const ESTIMATE_DISCLAIMER = 'Estimate only. Do not use it to make dosing decisions.';

/**
 * The focused medication, and the whole of what Today says about it: what it
 * is, where the level stands, what the week looks like, and the one action.
 *
 * The chart, the axis and the band are their own components. A motion pass
 * lands on the band and the chart next, and each of them has to animate
 * without the card knowing.
 */
export function TodayHeroCard({
  summary,
  pro,
  contentWidth,
  nowMs,
}: {
  summary: TodayMedicationSummary;
  pro: boolean;
  contentWidth: number;
  nowMs: number;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { medication, level } = summary;
  const color = medicationColor(medication.color_index);
  const unit = unitLabel(medication.default_unit);
  const preset = medication.preset_id ? getPreset(medication.preset_id) : undefined;

  const valueLabel = pro && level.kind === 'curve'
    ? formatLevel(level.current, medication.default_unit)
    : null;

  return (
    <View testID="today-hero-card" style={styles.shadow}>
      <View style={styles.clip}>
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="h2" numberOfLines={1} style={styles.name}>{medication.name}</Text>
          <View style={styles.dosePill}>
            <Text variant="caption" color={colors.inkMuted}>
              {formatAmount(medication.default_dose, medication.default_unit)} {unit}
            </Text>
          </View>
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

        <View style={styles.chartBox}>
          <TodayLevelChart
            width={contentWidth}
            color={color}
            series={level}
            fromMs={summary.windowFromMs}
            toMs={summary.windowToMs}
            nowMs={nowMs}
            valueLabel={valueLabel}
            unitLabel={unit}
            onUnlock={pro ? null : () => router.push('/paywall')}
            emptyHint="Log a shot to see your level"
          />
        </View>

        <TodayWeekAxis week={summary.week} color={color} medicationName={medication.name} />

        <TodayLogBand
          dose={summary.dose}
          medicationId={medication.id}
          medicationName={medication.name}
        />
      </View>

      <BottomSheet
        visible={aboutOpen}
        title="About this estimate"
        onClose={() => setAboutOpen(false)}
      >
        <View style={styles.aboutBody}>
          <Text>{ESTIMATE_DISCLAIMER}</Text>
          <Text variant="smallStrong" color={colors.ink}>
            {preset ? EVIDENCE_LABELS[preset.evidence] : 'Half-life on file for this medication'}
          </Text>
          <Text variant="small" color={colors.inkMuted}>
            {preset
              ? preset.source
              : 'Poke draws this curve from the shots you logged and the half-life saved with this medication.'}
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
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
  if (unit === 'mcg') return String(Math.round(value));
  return value.toFixed(value < 1 ? 2 : 1);
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
  aboutBody: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  pressed: {
    opacity: 0.72,
  },
});
