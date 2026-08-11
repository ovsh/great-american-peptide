import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Lock } from 'lucide-react-native';

import { Text } from '@/components/Text';
import type { LevelPoint, LevelSeries } from '@/components/today-types';
import { colors, elevation, fonts, radius, spacing } from '@/theme';

/**
 * The hero curve. No grid, no axis numbers, no legend: the shape is the reading
 * and the week axis under it carries the time.
 *
 * The height is fixed rather than a ratio of the width, because the card sits
 * above a list whose height the user controls, and a chart that grows with an
 * iPad's width pushes that list off the screen.
 */
export const HERO_CHART_HEIGHT = 170;
const PAD_X = 20;
const BASELINE_INSET = 16;
const CURVE_HEADROOM = 42;
/** How much room the tallest point leaves above itself, so the peak is not clipped by the card. */
const PEAK_HEADROOM = 1.15;

const VALUE_CHIP_WIDTH = 116;
const LOCK_CHIP_WIDTH = 172;

interface TodayLevelChartProps {
  width: number;
  color: string;
  series: LevelSeries;
  fromMs: number;
  toMs: number;
  nowMs: number;
  /** The estimate under the now dot, already formatted, or null when Poke holds it back. */
  valueLabel: string | null;
  unitLabel: string;
  onUnlock: (() => void) | null;
  emptyHint: string;
}

export function TodayLevelChart({
  width,
  color,
  series,
  fromMs,
  toMs,
  nowMs,
  valueLabel,
  unitLabel,
  onUnlock,
  emptyHint,
}: TodayLevelChartProps) {
  const height = HERO_CHART_HEIGHT;
  const baseY = height - BASELINE_INSET;
  const span = Math.max(1, toMs - fromMs);
  const plotWidth = Math.max(1, width - PAD_X * 2);
  const xFor = (t: number) => PAD_X + ((t - fromMs) / span) * plotWidth;

  if (series.kind === 'shots') {
    return (
      <ShotTimeline
        width={width}
        height={height}
        color={color}
        shots={series.shots}
        xFor={xFor}
        nowX={xFor(nowMs)}
      />
    );
  }

  if (series.kind === 'empty') {
    return (
      <View style={{ width, height }}>
        <Svg width={width} height={height}>
          <Line
            x1={PAD_X}
            y1={baseY}
            x2={width - PAD_X}
            y2={baseY}
            stroke={colors.chartGrid}
            strokeWidth={1}
          />
          <Path
            d={`M ${PAD_X} ${baseY} L ${width - PAD_X} ${baseY}`}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={2}
            strokeDasharray="3 4"
            fill="none"
          />
          {series.nextDoseAt !== null ? (
            <Circle cx={width - PAD_X} cy={baseY} r={5} fill={colors.surface} stroke={color} strokeWidth={2} />
          ) : null}
        </Svg>
        <View pointerEvents="none" style={styles.hintLayer}>
          <View style={styles.hintChip}>
            <Text variant="caption" color={colors.inkMuted}>{emptyHint}</Text>
          </View>
        </View>
      </View>
    );
  }

  const all: readonly LevelPoint[] = [...series.past, ...series.future];
  const peak = all.reduce((highest, point) => Math.max(highest, point.v), 0);
  const ceiling = peak > 0 ? peak * PEAK_HEADROOM : 1;
  const yFor = (v: number) => baseY - (v / ceiling) * (height - CURVE_HEADROOM);

  const solid = pathFrom(series.past, xFor, yFor);
  const dashed = pathFrom(series.future, xFor, yFor);
  const lastPast = series.past[series.past.length - 1];
  const lastFuture = series.future[series.future.length - 1];
  const nowX = lastPast ? xFor(lastPast.t) : xFor(nowMs);
  const nowY = lastPast ? yFor(lastPast.v) : baseY;
  const area = lastPast && series.past.length > 1
    ? `${solid} L ${nowX.toFixed(1)} ${baseY} L ${xFor(fromMs).toFixed(1)} ${baseY} Z`
    : '';

  const chipWidth = valueLabel !== null ? VALUE_CHIP_WIDTH : LOCK_CHIP_WIDTH;
  const chipRight = clamp(width - nowX + 10, spacing.sm, Math.max(spacing.sm, width - chipWidth - spacing.sm));
  const chipTop = clamp(nowY - 38, 4, height - 48);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {area ? <Path d={area} fill={color} fillOpacity={0.09} /> : null}
        <Line
          x1={PAD_X}
          y1={baseY}
          x2={width - PAD_X}
          y2={baseY}
          stroke={colors.chartGrid}
          strokeWidth={1}
        />
        {solid ? (
          <Path
            d={solid}
            stroke={color}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {dashed ? (
          <Path
            d={dashed}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="3 4"
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        <Circle cx={nowX} cy={nowY} r={8.5} fill={color} fillOpacity={0.15} />
        <Circle cx={nowX} cy={nowY} r={4.2} fill={color} stroke={colors.surface} strokeWidth={2.2} />
        {series.nextDoseAt !== null && lastFuture ? (
          <Circle
            cx={xFor(lastFuture.t)}
            cy={yFor(lastFuture.v)}
            r={5}
            fill={colors.surface}
            stroke={color}
            strokeWidth={2}
          />
        ) : null}
      </Svg>

      {valueLabel !== null ? (
        <View
          pointerEvents="none"
          style={[styles.valueChip, { right: chipRight, top: chipTop }]}
        >
          <Text style={styles.valueNumber}>{valueLabel}</Text>
          <Text variant="caption" color={colors.inkMuted}>{unitLabel} est.</Text>
        </View>
      ) : onUnlock ? (
        <Pressable
          testID="today-level-unlock"
          accessibilityRole="button"
          accessibilityLabel="Unlock exact levels with Poke Pro"
          onPress={onUnlock}
          style={({ pressed }) => [
            styles.lockChip,
            { right: chipRight, top: chipTop },
            pressed && styles.chipPressed,
          ]}
        >
          <Lock size={13} color={colors.successDeep} />
          <Text variant="caption" color={colors.successDeep}>Unlock exact levels</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The state for a medication Poke cannot model: the shots themselves, on the
 * same line the curve would have sat on. A sentence would say the same thing
 * and show nothing.
 */
function ShotTimeline({
  width,
  height,
  color,
  shots,
  xFor,
  nowX,
}: {
  width: number;
  height: number;
  color: string;
  shots: readonly number[];
  xFor: (t: number) => number;
  nowX: number;
}) {
  const lineY = Math.round(height / 2) + 8;
  const latest = shots.length > 0 ? Math.max(...shots) : null;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Line
          x1={PAD_X}
          y1={lineY}
          x2={width - PAD_X}
          y2={lineY}
          stroke={colors.chartGrid}
          strokeWidth={1}
        />
        <Line
          x1={nowX}
          y1={lineY - 14}
          x2={nowX}
          y2={lineY + 14}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />
        {shots.map((takenAt) => {
          const isLatest = takenAt === latest;
          return (
            <Circle
              key={takenAt}
              cx={xFor(takenAt)}
              cy={lineY}
              r={isLatest ? 5.5 : 4}
              fill={color}
              fillOpacity={isLatest ? 1 : 0.45}
              stroke={colors.surface}
              strokeWidth={isLatest ? 2 : 0}
            />
          );
        })}
        {latest !== null ? (
          <Circle cx={xFor(latest)} cy={lineY} r={10} fill={color} fillOpacity={0.12} />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={styles.timelineLabel}>
        <Text variant="caption" color={colors.inkSubtle}>
          {shots.length > 0 ? 'Your recent shots' : 'No shots logged yet'}
        </Text>
      </View>
    </View>
  );
}

function pathFrom(
  points: readonly LevelPoint[],
  xFor: (t: number) => number,
  yFor: (v: number) => number,
): string {
  let path = '';
  points.forEach((point, index) => {
    path += `${index === 0 ? 'M' : ' L'} ${xFor(point.t).toFixed(1)} ${yFor(point.v).toFixed(1)}`;
  });
  return path;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

const styles = StyleSheet.create({
  valueChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...elevation.raised,
  },
  valueNumber: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.38,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  lockChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...elevation.raised,
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  hintLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timelineLabel: {
    position: 'absolute',
    left: PAD_X,
    bottom: 10,
  },
});
