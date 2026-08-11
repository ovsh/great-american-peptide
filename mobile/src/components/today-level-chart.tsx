import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Lock } from 'lucide-react-native';

import { Text } from '@/components/Text';
import { usePressScale, useTint, type MotionStyle } from '@/components/today-motion';
import type { LevelPoint, LevelSeries } from '@/components/today-types';
import {
  arrivalBeats,
  colors,
  easing,
  elevation,
  fonts,
  logBeats,
  motion,
  radius,
  spacing,
  springTo,
  springs,
  timeTo,
} from '@/theme';

/**
 * The hero curve. No grid, no axis numbers, no legend: the shape is the reading
 * and the week axis under it carries the time.
 *
 * The height is fixed rather than a ratio of the width, because the card sits
 * above a list whose height the user controls, and a chart that grows with an
 * iPad's width pushes that list off the screen.
 *
 * Motion. The curve is one fixed-length array of samples per state, so any two
 * states have a point for every point and the path is a per-frame interpolation
 * between them on the UI thread. Switching medication morphs on `base`; a shot
 * you just logged springs on `settle`, four beats after the band, out of the dot
 * that falls onto the now-marker. The `d` prop also carries the finished path,
 * so a device that will not animate it still draws the right curve.
 */
export const HERO_CHART_HEIGHT = 170;
const PAD_X = 20;
const BASELINE_INSET = 16;
const CURVE_HEADROOM = 42;
/** How much room the tallest point leaves above itself, so the peak is not clipped by the card. */
const PEAK_HEADROOM = 1.15;
/** How far above the curve the logged shot starts its fall. */
const DROP_HEIGHT = 48;
/** How far the curve slides when two states cannot morph into one another. */
const CROSSFADE_SLIDE = 12;

const VALUE_CHIP_WIDTH = 116;
const LOCK_CHIP_WIDTH = 172;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface TodayLevelChartProps {
  width: number;
  color: string;
  series: LevelSeries;
  fromMs: number;
  toMs: number;
  nowMs: number;
  /** Which medication this is. A different one cannot inherit the last one's shot. */
  medicationId: string;
  /** The estimate under the now dot, or null when Poke holds it back. */
  value: number | null;
  /** Decimals the estimate is read to, so the count-up can run on the UI thread. */
  valueDecimals: number;
  unitLabel: string;
  onUnlock: (() => void) | null;
  emptyHint: string;
  /** Turns true once, when the card arrives. The curve draws itself on that. */
  entered: boolean;
  /** Bumped once per logged shot. Zero means nothing to celebrate. */
  logToken: number;
}

/** One state of the curve, flattened so the UI thread can interpolate it. */
interface CurveShape {
  xs: number[];
  ys: number[];
  pastCount: number;
  nowX: number;
  nowY: number;
  nextX: number;
  nextY: number;
  chipRight: number;
  chipTop: number;
  value: number;
}

const EMPTY_SHAPE: CurveShape = {
  xs: [],
  ys: [],
  pastCount: 0,
  nowX: 0,
  nowY: 0,
  nextX: 0,
  nextY: 0,
  chipRight: 0,
  chipTop: 0,
  value: 0,
};

export function TodayLevelChart({
  width,
  color,
  series,
  fromMs,
  toMs,
  nowMs,
  medicationId,
  value,
  valueDecimals,
  unitLabel,
  onUnlock,
  emptyHint,
  entered,
  logToken,
}: TodayLevelChartProps) {
  const reduced = useReducedMotion();
  const height = HERO_CHART_HEIGHT;
  const baseY = height - BASELINE_INSET;
  const chipWidth = value !== null ? VALUE_CHIP_WIDTH : LOCK_CHIP_WIDTH;

  const shape = useMemo(
    () => buildShape({ series, width, height, fromMs, toMs, nowMs, value, chipWidth }),
    [chipWidth, fromMs, height, nowMs, series, toMs, value, width],
  );

  const from = useSharedValue<CurveShape>(shape ?? EMPTY_SHAPE);
  const to = useSharedValue<CurveShape>(shape ?? EMPTY_SHAPE);
  const progress = useSharedValue(1);
  const drop = useSharedValue(0);
  const dropOpacity = useSharedValue(0);
  const swap = useSharedValue(1);
  const draw = useSharedValue(reduced ? 1 : 0);
  const stroke = useTint(color);

  const previous = useRef<{ shape: CurveShape | null; medicationId: string } | null>(null);
  const lastLogToken = useRef(logToken);

  useEffect(() => {
    const last = previous.current;
    const logged = logToken !== 0 && logToken !== lastLogToken.current;
    lastLogToken.current = logToken;
    const sameMedication = last !== null && last.medicationId === medicationId;
    previous.current = { shape, medicationId };

    if (shape === null) {
      // Nothing to morph into. The state that replaced the curve slides in.
      if (last !== null && last.shape !== null) playSwap(swap, reduced);
      return;
    }
    to.value = shape;

    const before = last?.shape ?? null;
    const morphable = before !== null
      && before.xs.length === shape.xs.length
      && before.pastCount === shape.pastCount;

    if (!morphable) {
      from.value = shape;
      progress.value = 1;
      if (last !== null) playSwap(swap, reduced);
      return;
    }

    from.value = before;
    progress.value = 0;

    if (logged && sameMedication) {
      progress.value = springTo(1, { config: springs.settle, delay: logBeats.curve, reduced });
      playDrop(drop, dropOpacity, reduced);
      return;
    }
    progress.value = timeTo(1, { duration: motion.base, easing: easing.standard, reduced });
  }, [drop, dropOpacity, from, logToken, medicationId, progress, reduced, shape, swap, to]);

  useEffect(() => {
    if (!entered) return;
    draw.value = timeTo(1, {
      duration: motion.draw,
      easing: easing.out,
      delay: arrivalBeats.draw,
      reduced,
    });
  }, [draw, entered, reduced]);

  const solidProps = useAnimatedProps(() => ({
    d: linePath(from.value, to.value, progress.value, 0, to.value.pastCount),
    stroke: stroke.value,
  }));
  const dashedProps = useAnimatedProps(() => ({
    d: linePath(from.value, to.value, progress.value, to.value.pastCount, to.value.xs.length),
    stroke: stroke.value,
  }));
  const areaProps = useAnimatedProps(() => {
    const p = progress.value;
    const solid = linePath(from.value, to.value, p, 0, to.value.pastCount);
    if (solid === '') return { d: '', fill: stroke.value };
    const nowX = mix(from.value.nowX, to.value.nowX, p);
    const startX = mix(from.value.xs[0] ?? 0, to.value.xs[0] ?? 0, p);
    return {
      d: `${solid} L ${nowX.toFixed(1)} ${baseY} L ${startX.toFixed(1)} ${baseY} Z`,
      fill: stroke.value,
    };
  });
  const haloProps = useAnimatedProps(() => ({
    cx: mix(from.value.nowX, to.value.nowX, progress.value),
    cy: mix(from.value.nowY, to.value.nowY, progress.value),
    fill: stroke.value,
  }));
  const nowProps = useAnimatedProps(() => ({
    cx: mix(from.value.nowX, to.value.nowX, progress.value),
    cy: mix(from.value.nowY, to.value.nowY, progress.value),
    fill: stroke.value,
  }));
  const nextProps = useAnimatedProps(() => ({
    cx: mix(from.value.nextX, to.value.nextX, progress.value),
    cy: mix(from.value.nextY, to.value.nextY, progress.value),
    stroke: stroke.value,
  }));
  const dropProps = useAnimatedProps(() => ({
    cx: from.value.nowX,
    cy: from.value.nowY - DROP_HEIGHT * (1 - drop.value),
    opacity: dropOpacity.value,
    fill: stroke.value,
  }));
  // The arrival draw is a curtain in the card's own colour that slides off to
  // the right. A clip path would say the same thing and depends on the SVG
  // library re-reading a definition node, which it does not promise to do.
  const curtainProps = useAnimatedProps(() => ({
    x: draw.value * width,
    width: width * (1 - draw.value),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ translateX: (1 - swap.value) * CROSSFADE_SLIDE }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - progress.value) * (to.value.chipRight - from.value.chipRight) },
      { translateY: (1 - progress.value) * (from.value.chipTop - to.value.chipTop) },
    ],
  }));
  const level = useDerivedValue(() => mix(from.value.value, to.value.value, progress.value));

  const chipRight = shape?.chipRight ?? spacing.sm;
  const chipTop = shape?.chipTop ?? 4;

  return (
    <Animated.View style={[{ width, height }, containerStyle]}>
      <Svg width={width} height={height}>
        <Line
          x1={PAD_X}
          y1={series.kind === 'shots' ? Math.round(height / 2) + 8 : baseY}
          x2={width - PAD_X}
          y2={series.kind === 'shots' ? Math.round(height / 2) + 8 : baseY}
          stroke={colors.chartGrid}
          strokeWidth={1}
        />

        {series.kind === 'curve' && shape !== null ? (
          <>
            <AnimatedPath
              animatedProps={areaProps}
              d={areaPath(shape, baseY)}
              fill={color}
              fillOpacity={0.09}
            />
            <AnimatedPath
              animatedProps={solidProps}
              d={linePathOf(shape, 0, shape.pastCount)}
              stroke={color}
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <AnimatedPath
              animatedProps={dashedProps}
              d={linePathOf(shape, shape.pastCount, shape.xs.length)}
              stroke={color}
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="3 4"
              fill="none"
              strokeLinecap="round"
            />
            <AnimatedCircle
              animatedProps={haloProps}
              cx={shape.nowX}
              cy={shape.nowY}
              r={8.5}
              fill={color}
              fillOpacity={0.15}
            />
            <AnimatedCircle
              animatedProps={nowProps}
              cx={shape.nowX}
              cy={shape.nowY}
              r={4.2}
              fill={color}
              stroke={colors.surface}
              strokeWidth={2.2}
            />
            {series.nextDoseAt !== null ? (
              <AnimatedCircle
                animatedProps={nextProps}
                cx={shape.nextX}
                cy={shape.nextY}
                r={5}
                fill={colors.surface}
                stroke={color}
                strokeWidth={2}
              />
            ) : null}
            <AnimatedCircle animatedProps={dropProps} r={5.2} stroke={colors.surface} strokeWidth={2.2} />
          </>
        ) : null}

        {series.kind === 'empty' ? (
          <>
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
          </>
        ) : null}

        {series.kind === 'shots' ? (
          <ShotMarks
            width={width}
            height={height}
            color={color}
            shots={series.shots}
            fromMs={fromMs}
            toMs={toMs}
            nowMs={nowMs}
          />
        ) : null}

        <AnimatedRect animatedProps={curtainProps} y={0} height={height} fill={colors.surface} />
      </Svg>

      {series.kind === 'empty' ? (
        <View pointerEvents="none" style={styles.hintLayer}>
          <View style={styles.hintChip}>
            <Text variant="caption" color={colors.inkMuted}>{emptyHint}</Text>
          </View>
        </View>
      ) : null}

      {series.kind === 'shots' ? (
        <View pointerEvents="none" style={styles.timelineLabel}>
          <Text variant="caption" color={colors.inkSubtle}>
            {series.shots.length > 0 ? 'Your recent shots' : 'No shots logged yet'}
          </Text>
        </View>
      ) : null}

      {series.kind === 'curve' && shape !== null ? (
        value !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.valueChip, { right: chipRight, top: chipTop }, chipStyle]}
          >
            <LevelValue level={level} decimals={valueDecimals} initial={shape.value.toFixed(valueDecimals)} />
            <Text variant="caption" color={colors.inkMuted}>{unitLabel} est.</Text>
          </Animated.View>
        ) : onUnlock ? (
          <UnlockChip onUnlock={onUnlock} right={chipRight} top={chipTop} style={chipStyle} />
        ) : null
      ) : null}
    </Animated.View>
  );
}

/** The estimate, counting up with the curve. Its own component, so the count re-renders one word. */
function LevelValue({
  level,
  decimals,
  initial,
}: {
  level: SharedValue<number>;
  decimals: number;
  initial: string;
}) {
  const [label, setLabel] = useState(initial);

  useAnimatedReaction(
    () => level.value.toFixed(decimals),
    (current, previous) => {
      if (current !== previous && previous !== null) runOnJS(setLabel)(current);
    },
    [decimals],
  );

  return <Text style={styles.valueNumber}>{label}</Text>;
}

function UnlockChip({
  onUnlock,
  right,
  top,
  style,
}: {
  onUnlock: () => void;
  right: number;
  top: number;
  style: MotionStyle;
}) {
  const press = usePressScale();
  return (
    <Animated.View style={[styles.chipLayer, { right, top }, style, press.style]}>
      <Pressable
        testID="today-level-unlock"
        accessibilityRole="button"
        accessibilityLabel="Unlock exact levels with Poke Pro"
        onPress={onUnlock}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.lockChip}
      >
        <Lock size={13} color={colors.successDeep} />
        <Text variant="caption" color={colors.successDeep}>Unlock exact levels</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The state for a medication Poke cannot model: the shots themselves, on the
 * same line the curve would have sat on. A sentence would say the same thing
 * and show nothing.
 */
function ShotMarks({
  width,
  height,
  color,
  shots,
  fromMs,
  toMs,
  nowMs,
}: {
  width: number;
  height: number;
  color: string;
  shots: readonly number[];
  fromMs: number;
  toMs: number;
  nowMs: number;
}) {
  const lineY = Math.round(height / 2) + 8;
  const span = Math.max(1, toMs - fromMs);
  const plotWidth = Math.max(1, width - PAD_X * 2);
  const xFor = (t: number) => PAD_X + ((t - fromMs) / span) * plotWidth;
  const latest = shots.length > 0 ? Math.max(...shots) : null;

  return (
    <>
      <Line
        x1={xFor(nowMs)}
        y1={lineY - 14}
        x2={xFor(nowMs)}
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
    </>
  );
}

/** The shot falls onto the now-marker, then hands the level over to it. */
function playDrop(drop: SharedValue<number>, opacity: SharedValue<number>, reduced: boolean) {
  if (reduced) return;
  const fall = logBeats.curve - logBeats.drop;
  drop.value = 0;
  opacity.value = 0;
  drop.value = withDelay(logBeats.drop, withTiming(1, { duration: fall, easing: easing.in }));
  opacity.value = withDelay(
    logBeats.drop,
    withSequence(
      withTiming(1, { duration: motion.press }),
      withDelay(
        fall - motion.press,
        withTiming(0, { duration: motion.fast, easing: easing.out }),
      ),
    ),
  );
}

/** Two states that are not the same model do not morph. The new one slides in. */
function playSwap(swap: SharedValue<number>, reduced: boolean) {
  swap.value = 0;
  swap.value = timeTo(1, { duration: motion.base, easing: easing.out, reduced });
}

function buildShape({
  series,
  width,
  height,
  fromMs,
  toMs,
  nowMs,
  value,
  chipWidth,
}: {
  series: LevelSeries;
  width: number;
  height: number;
  fromMs: number;
  toMs: number;
  nowMs: number;
  value: number | null;
  chipWidth: number;
}): CurveShape | null {
  if (series.kind !== 'curve') return null;

  const baseY = height - BASELINE_INSET;
  const span = Math.max(1, toMs - fromMs);
  const plotWidth = Math.max(1, width - PAD_X * 2);
  const xFor = (t: number) => PAD_X + ((t - fromMs) / span) * plotWidth;
  const all: readonly LevelPoint[] = [...series.past, ...series.future];
  const peak = all.reduce((highest, point) => Math.max(highest, point.v), 0);
  const ceiling = peak > 0 ? peak * PEAK_HEADROOM : 1;
  const yFor = (v: number) => baseY - (v / ceiling) * (height - CURVE_HEADROOM);

  const xs = all.map((point) => xFor(point.t));
  const ys = all.map((point) => yFor(point.v));
  const pastCount = series.past.length;
  const lastPast = series.past[series.past.length - 1];
  const lastFuture = series.future[series.future.length - 1];
  const nowX = lastPast ? xFor(lastPast.t) : xFor(nowMs);
  const nowY = lastPast ? yFor(lastPast.v) : baseY;

  return {
    xs,
    ys,
    pastCount,
    nowX,
    nowY,
    nextX: lastFuture ? xFor(lastFuture.t) : nowX,
    nextY: lastFuture ? yFor(lastFuture.v) : nowY,
    chipRight: clamp(width - nowX + 10, spacing.sm, Math.max(spacing.sm, width - chipWidth - spacing.sm)),
    chipTop: clamp(nowY - 38, 4, height - 48),
    value: value ?? 0,
  };
}

function mix(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** The path between two states, point for point, on whichever thread asks. */
function linePath(from: CurveShape, to: CurveShape, t: number, start: number, end: number): string {
  'worklet';
  // `end` comes from the target, and the two shapes rarely hold the same number
  // of samples: the count moves when a dose window passes or a half-life is
  // edited. Reading past the shorter one gives `undefined`, and `undefined`
  // reaches the SVG as `NaN` and takes the whole path with it. The walk stops at
  // the shorter of the two, and every read carries its own floor.
  const last = Math.min(from.xs.length, to.xs.length, end);
  let d = '';
  for (let index = Math.max(start, 0); index < last; index += 1) {
    const x = (from.xs[index] ?? 0) + ((to.xs[index] ?? 0) - (from.xs[index] ?? 0)) * t;
    const y = (from.ys[index] ?? 0) + ((to.ys[index] ?? 0) - (from.ys[index] ?? 0)) * t;
    d += `${d === '' ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function linePathOf(shape: CurveShape, start: number, end: number): string {
  return linePath(shape, shape, 1, start, end);
}

function areaPath(shape: CurveShape, baseY: number): string {
  const solid = linePathOf(shape, 0, shape.pastCount);
  if (solid === '') return '';
  return `${solid} L ${shape.nowX.toFixed(1)} ${baseY} L ${(shape.xs[0] ?? 0).toFixed(1)} ${baseY} Z`;
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
  chipLayer: {
    position: 'absolute',
  },
  lockChip: {
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
