import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { format } from 'date-fns';

import { HalfLifeScene } from '@/components/onboarding/half-life-scene';
import { Text } from '@/components/Text';
import { medicationColor, unitLabel } from '@/components/today-hero-card';
import { HERO_CHART_HEIGHT, TodayLevelChart } from '@/components/today-level-chart';
import {
  blendCurvePartsFor,
  buildLevelSeries,
  convertedDoses,
  levelWindow,
} from '@/components/today-level-series';
import { slowestBlendHalfLifeHours } from '@/domain/blends';
import type { LevelSeries } from '@/components/today-types';
import type { MedicationRow } from '@/db/types';
import { listInjections } from '@/repositories/injections';
import { listMedications } from '@/repositories/medications';
import { getPreferences } from '@/repositories/preferences';
import { colors, elevation, radius, spacing } from '@/theme';

/** How many shots one medication contributes to the drawn curve. Today reads the same depth. */
const SHOT_LIMIT = 500;
/** The paywall's content column, so the chart is drawn as wide as the card holding it. */
const CONTENT_WIDTH = 560;
/**
 * The strip height, when the paywall asks for one.
 *
 * The offer now carries a headline, four benefit lines and a pricing block, so
 * the proof has to be a strip rather than a hero. The curve keeps its whole
 * window at this height: `TodayLevelChart` scales the level to the box it is
 * given, so a shorter box is a shorter curve and never a cropped one.
 */
const STRIP_CHART_HEIGHT = 120;
/** The gap the chart's own arrival curtain needs above it, inside the card. */
const CHART_TOP_INSET = 6;

/**
 * The paywall's hero: the user's own estimated level curve.
 *
 * The curve is the thing being sold, so the paywall shows it rather than
 * describing it. It is the free reading, exactly as Today draws it for a user
 * without Pro: the shape is there and the number is not. There is no unlock
 * chip, because the chip's only job is to open this screen.
 *
 * A user who has logged nothing has no curve, and Poke never draws a curve out
 * of numbers nobody entered. That state gets the onboarding half-life drawing
 * instead, which is a picture of what a level is and states no reading.
 *
 * `compact` draws the same curve as a strip. The paywall asks for it, because
 * the offer has to hold a headline, four benefit lines and a pricing block on
 * one phone screen. The drawing has no compact form: it is a fixed scene, and
 * the user who sees it is the one with no curve to shrink.
 */

/** What the hero found to draw. `null` while the read is still running. */
type Hero =
  | { kind: 'curve'; medication: MedicationRow; level: LevelSeries; fromMs: number; toMs: number; nowMs: number }
  | { kind: 'none' };

export function PaywallHero({ compact = false }: { compact?: boolean }) {
  const { width: windowWidth } = useWindowDimensions();
  const [hero, setHero] = useState<Hero | null>(null);
  const chartHeight = compact ? STRIP_CHART_HEIGHT : HERO_CHART_HEIGHT;

  useEffect(() => {
    let live = true;
    loadHero()
      .then((found) => {
        if (live) setHero(found);
      })
      .catch(() => {
        if (live) setHero({ kind: 'none' });
      });
    return () => {
      live = false;
    };
  }, []);

  if (hero === null) return <View style={{ height: chartHeight }} />;

  if (hero.kind === 'none') {
    return (
      <View style={styles.drawing}>
        <HalfLifeScene source={null} />
      </View>
    );
  }

  const { medication } = hero;
  const color = medicationColor(medication.color_index);
  // The card is as wide as the paywall's own content column, and the chart is
  // as wide as the card. `TodayLevelChart` paints its arrival curtain in the
  // surface colour, so it has to sit on a surface.
  const chartWidth = Math.max(0, Math.min(windowWidth - spacing.screen * 2, CONTENT_WIDTH));

  const range = `${format(hero.fromMs, 'MMM d')} to today`;

  return (
    <View style={styles.shadow}>
      <View style={[styles.clip, compact && styles.clipCompact]}>
        {/* Compact puts the name and the range on one row. The strip has to give
            its height to the curve, and a range that costs a whole line of its
            own is the first thing a strip cannot afford. */}
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="smallStrong" numberOfLines={1} style={styles.name}>{medication.name}</Text>
          {compact ? (
            <Text variant="caption" color={colors.inkSubtle}>{range}</Text>
          ) : null}
        </View>
        <View style={[styles.chartBox, { height: chartHeight + CHART_TOP_INSET }]}>
          <TodayLevelChart
            width={chartWidth}
            height={chartHeight}
            color={color}
            series={hero.level}
            fromMs={hero.fromMs}
            toMs={hero.toMs}
            nowMs={hero.nowMs}
            medicationId={medication.id}
            value={null}
            valueDecimals={0}
            unitLabel={unitLabel(medication.default_unit)}
            onUnlock={null}
            emptyHint="Log a shot to see your level"
            entered
            logToken={0}
          />
        </View>
        {compact ? null : (
          <Text variant="caption" color={colors.inkSubtle} style={styles.axis}>{range}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * The first medication that draws a curve, preferring the one the user reads on
 * Today. A medication with no shots, or with no sourced half-life, has no curve
 * to show here, so it is passed over rather than drawn as a flat line.
 */
async function loadHero(): Promise<Hero> {
  const [medications, preferences] = await Promise.all([listMedications(), getPreferences()]);
  const active = medications.filter((medication) => medication.status === 'active');
  if (active.length === 0) return { kind: 'none' };

  const shotLists = await Promise.all(
    active.map((medication) => listInjections({ medicationId: medication.id, limit: SHOT_LIMIT })),
  );
  const nowMs = Date.now();

  const drawable = active.flatMap((medication, index) => {
    const injections = shotLists[index] ?? [];
    // No next dose is passed, so the window ends on a short forecast tail
    // instead of on a scheduled date. The estimate is the same either way: the
    // curve only ever falls out of shots already logged.
    // The paywall keeps the six half-life window: it has no day axis under the
    // chart, so the whole decay is what it has to show. A blend sizes that
    // window by its slowest part, the one whose tail the chart has to hold.
    const blendParts = blendCurvePartsFor(medication);
    const { fromMs, toMs } = levelWindow({
      doses: convertedDoses(injections, medication),
      halfLifeHours: blendParts ? slowestBlendHalfLifeHours(blendParts) : medication.half_life_hours,
      nextDoseAt: null,
      now: nowMs,
    });
    const level = buildLevelSeries({ injections, medication, now: nowMs, fromMs, toMs, nextDoseAt: null });
    if (level.kind !== 'curve') return [];
    return [{ kind: 'curve' as const, medication, level, fromMs, toMs, nowMs }];
  });

  const focused = drawable.find(
    (candidate) => candidate.medication.id === preferences.focused_medication_id,
  );
  return focused ?? drawable[0] ?? { kind: 'none' };
}

const styles = StyleSheet.create({
  drawing: {
    alignItems: 'center',
  },
  shadow: {
    borderRadius: radius.xl,
    ...elevation.card,
  },
  clip: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  // The axis line is gone in compact, so the card closes on its own padding.
  clipCompact: {
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  headerCompact: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  name: {
    flex: 1,
  },
  chartBox: {
    paddingTop: CHART_TOP_INSET,
  },
  axis: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
});
