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
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';

import { Text } from '@/components/Text';
import {
  CHART,
  laneTop,
  textWidth,
  xFor,
  yFor,
  type ChartLayout,
  type Journey,
  type JourneyMedication,
  type ProgressMetric,
} from '@/components/progress-geometry';
import { DROP_HEIGHT, progressBeats } from '@/components/progress-motion';
import { usePressScale } from '@/components/today-motion';
import {
  colors,
  easing,
  fonts,
  motion,
  radius,
  spacing,
  springTo,
  springs,
  timeTo,
} from '@/theme';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const AMBER_SOFT = 'rgba(232,161,60,0.55)';
const VIOLET_SOFT = 'rgba(139,123,216,0.35)';
const LANE_GUIDE = 'rgba(17,20,24,0.055)';
const HOLLOW = 'rgba(17,20,24,0.16)';
const WAITING = 'rgba(17,20,24,0.20)';
const LABEL_SIZE = 13;

/** One flattened state of the curve, so the UI thread can interpolate it. */
interface WeightShape {
  xs: number[];
  ys: number[];
  value: number;
}

interface ProgressChartProps {
  journey: Journey;
  layout: ChartLayout;
  metric: ProgressMetric;
  pro: boolean;
  /** Bumped once per weight the user has just logged. Zero means nothing to play. */
  logToken: number;
}

/**
 * The journey axis and everything hanging off it.
 *
 * The rail — one micro-lane per medication, the side-effect marks above them and
 * the month labels under them — is the same in all three metrics and never
 * moves. Only the band above it changes, and it crossfades rather than cuts, so
 * no reader sees a chart half swapped.
 */
export function ProgressChart({ journey, layout, metric, pro, logToken }: ProgressChartProps) {
  const reduced = useReducedMotion();
  const [shownMetric, setShownMetric] = useState<ProgressMetric>(metric);
  const bandFade = useSharedValue(1);

  useEffect(() => {
    if (shownMetric === metric) return;
    if (reduced) {
      setShownMetric(metric);
      return;
    }
    bandFade.value = timeTo(0, { duration: motion.fast, easing: easing.in });
    const timer = setTimeout(() => {
      setShownMetric(metric);
      bandFade.value = timeTo(1, { duration: motion.base, easing: easing.out });
    }, motion.fast);
    return () => clearTimeout(timer);
  }, [bandFade, metric, reduced, shownMetric]);

  const shape = useMemo<WeightShape>(() => ({
    xs: journey.weights.map((weight) => xFor(layout, weight.day, journey.spanDays)),
    ys: journey.weights.map((weight) => yFor(layout, weight.value)),
    value: journey.weights[journey.weights.length - 1]?.value ?? 0,
  }), [journey.spanDays, journey.weights, layout]);

  const from = useSharedValue<WeightShape>(shape);
  const to = useSharedValue<WeightShape>(shape);
  const progress = useSharedValue(1);
  const bracket = useSharedValue(1);
  const drop = useSharedValue(0);
  const dropOpacity = useSharedValue(0);
  const previous = useRef<WeightShape | null>(null);
  const lastToken = useRef(logToken);
  /** True while the log sequence is on screen, so a re-render cannot cut it. */
  const playing = useRef(false);

  useEffect(() => {
    const before = previous.current;
    previous.current = shape;
    const logged = logToken !== 0 && logToken !== lastToken.current;
    lastToken.current = logToken;

    to.value = shape;
    // The new reading is one point longer than the curve the user left behind.
    // Starting it as a repeat of the old last point is what makes the last
    // segment spring out of the curve to meet the dot that falls onto it.
    const morphable = logged
      && before !== null
      && before.xs.length > 0
      && shape.xs.length === before.xs.length + 1;

    if (!morphable) {
      if (playing.current) return;
      from.value = shape;
      progress.value = 1;
      bracket.value = 1;
      return;
    }

    playing.current = true;
    const settle = setTimeout(() => { playing.current = false; }, progressBeats.bracket + motion.slow);

    const lastX = before.xs[before.xs.length - 1] ?? 0;
    const lastY = before.ys[before.ys.length - 1] ?? 0;
    from.value = {
      xs: [...before.xs, lastX],
      ys: [...before.ys, lastY],
      value: before.value,
    };
    progress.value = 0;
    progress.value = springTo(1, { config: springs.settle, delay: progressBeats.curve, reduced });
    bracket.value = 0;
    bracket.value = springTo(1, { config: springs.settle, delay: progressBeats.bracket, reduced });
    playDrop(drop, dropOpacity, reduced);
    return () => clearTimeout(settle);
  }, [bracket, drop, dropOpacity, from, logToken, progress, reduced, shape, to]);

  const bandProps = useAnimatedProps(() => ({ opacity: bandFade.value }));
  const bandStyle = useAnimatedStyle(() => ({ opacity: bandFade.value }));

  const goalLineY = journey.goal !== null && layout.hasScale
    ? yFor(layout, journey.goal)
    : layout.goalY;
  const lastEffect = journey.effects[journey.effects.length - 1] ?? null;

  return (
    <View style={{ width: layout.width, height: layout.height }}>
      <Svg width={layout.width} height={layout.height}>
        <Defs>
          <LinearGradient
            id="progressGap"
            x1="0"
            y1={String(layout.plotT)}
            x2="0"
            y2={String(layout.goalY)}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.amber} stopOpacity="0.14" />
            <Stop offset="1" stopColor={colors.amber} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        <AnimatedG animatedProps={bandProps} opacity={1}>
          {shownMetric === 'weight' ? (
            <WeightBand
              journey={journey}
              layout={layout}
              goalLineY={goalLineY}
              pro={pro}
              from={from}
              to={to}
              progress={progress}
              bracket={bracket}
              drop={drop}
              dropOpacity={dropOpacity}
            />
          ) : null}
          {shownMetric === 'shots' ? <ShotsBand journey={journey} layout={layout} /> : null}
          {shownMetric === 'effects' ? <EffectsBand journey={journey} layout={layout} /> : null}
        </AnimatedG>

        <Rail journey={journey} layout={layout} />
      </Svg>

      {/* The band's own labels fade with it. The rail's do not: they belong to
          the axis, and the axis is the same under every metric. */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, bandStyle]}>
        {shownMetric === 'weight' ? (
          <WeightOverlay
            journey={journey}
            layout={layout}
            goalLineY={goalLineY}
            pro={pro}
            from={from}
            to={to}
            bracket={bracket}
            lastEffect={lastEffect}
          />
        ) : null}
        {shownMetric === 'effects' ? <EffectsOverlay journey={journey} layout={layout} /> : null}
      </Animated.View>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {journey.medications.length === 0 ? (
          <ActionPill
            testID="progress-add-medication"
            label="Add a medication"
            tone={colors.successDeep}
            border="rgba(20,122,82,0.30)"
            top={layout.laneY + CHART.tickH / 2 - 11}
            onPress={() => router.push('/medications/new')}
          />
        ) : null}
        {journey.effects.length === 0 ? (
          <StaticPill
            label="No effects logged"
            tone={colors.violet}
            border={VIOLET_SOFT}
            top={layout.effY - 11}
          />
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ the rail */

/**
 * One lane per medication, on the same x as the curve above.
 *
 * Forty-seven ticks in a single row read as a barcode; four rows read as four
 * rhythms, and a gap in one of them is visible without a tap. A scheduled dose
 * with nothing logged against it keeps its slot and is drawn hollow, so a miss
 * is a hole rather than an absence.
 */
function Rail({ journey, layout }: { journey: Journey; layout: ChartLayout }) {
  const { plotL, plotR, laneY, effY, monthY } = layout;
  const span = journey.spanDays;
  const baseline = laneY + CHART.tickH / 2;
  const lanes = journey.medications.length;

  return (
    <>
      {lanes === 0 ? (
        <Line
          x1={plotL}
          y1={baseline}
          x2={plotR}
          y2={baseline}
          stroke={WAITING}
          strokeWidth={1.6}
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
      ) : null}

      {journey.medications.map((medication, index) => (
        <Line
          key={`guide-${medication.id}`}
          x1={plotL}
          y1={laneTop(layout, index) + CHART.tickH / 2}
          x2={plotR}
          y2={laneTop(layout, index) + CHART.tickH / 2}
          stroke={LANE_GUIDE}
          strokeWidth={1}
        />
      ))}

      {journey.medications.map((medication, index) => (
        <G key={`lane-${medication.id}`}>
          {medication.shots.map((day) => (
            <Rect
              key={`shot-${day}`}
              x={xFor(layout, day, span) - 1.6}
              y={laneTop(layout, index)}
              width={3.2}
              height={CHART.tickH}
              rx={1.6}
              fill={medication.color}
            />
          ))}
          {medication.missed.map((day) => (
            <Rect
              key={`missed-${day}`}
              x={xFor(layout, day, span) - 1.6}
              y={laneTop(layout, index)}
              width={3.2}
              height={CHART.tickH}
              rx={1.6}
              fill={HOLLOW}
            />
          ))}
          {medication.due.map((day) => (
            <G key={`due-${day}`}>
              <Circle
                cx={xFor(layout, day, span)}
                cy={laneTop(layout, index) + CHART.tickH / 2}
                r={4.6}
                fill="none"
                stroke={colors.successDeep}
                strokeWidth={2}
              />
              <Circle
                cx={xFor(layout, day, span)}
                cy={laneTop(layout, index) + CHART.tickH / 2}
                r={1.6}
                fill={colors.successDeep}
              />
            </G>
          ))}
        </G>
      ))}

      {journey.effects.length === 0 ? (
        <Line
          x1={plotL}
          y1={effY}
          x2={plotR}
          y2={effY}
          stroke={colors.violet}
          strokeOpacity={0.45}
          strokeWidth={1.6}
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
      ) : (
        journey.effects.map((effect) => {
          const x = xFor(layout, effect.day, span);
          // A clear day is a hollow ring with no stem: the day was asked and
          // answered, and there was nothing to hang above it. Next to the
          // filled dots it reads as a deliberate empty, not a missing mark.
          if (effect.kind === 'clear') {
            return (
              <Circle
                key={`effect-${effect.takenAt}`}
                cx={x}
                cy={effY}
                r={3.2}
                fill={colors.surface}
                stroke={colors.violet}
                strokeOpacity={0.55}
                strokeWidth={1.4}
              />
            );
          }
          const r = 3.2 + effect.severity * 0.38;
          return (
            <G key={`effect-${effect.takenAt}`}>
              <Line
                x1={x}
                y1={baseline}
                x2={x}
                y2={effY + r}
                stroke={colors.violet}
                strokeOpacity={0.45}
                strokeWidth={1.4}
              />
              <Circle cx={x} cy={effY} r={r} fill={colors.violet} />
            </G>
          );
        })
      )}

      {journey.edgeLabels ? (
        <>
          <SvgText
            x={plotL}
            y={monthY}
            fontSize={LABEL_SIZE}
            fontFamily={fonts.sansMedium}
            fill={colors.inkSubtle}
          >
            {journey.edgeLabels[0]}
          </SvgText>
          <SvgText
            x={plotR}
            y={monthY}
            textAnchor="end"
            fontSize={LABEL_SIZE}
            fontFamily={fonts.sansMedium}
            fill={colors.inkSubtle}
          >
            {journey.edgeLabels[1]}
          </SvgText>
        </>
      ) : (
        journey.months.map((month) => (
          <SvgText
            key={month.day}
            x={xFor(layout, month.day, span)}
            y={monthY}
            fontSize={LABEL_SIZE}
            fontFamily={fonts.sansMedium}
            fill={colors.inkSubtle}
          >
            {month.label}
          </SvgText>
        ))
      )}
    </>
  );
}

/* ---------------------------------------------------------- the weight metric */

interface WeightBandProps {
  journey: Journey;
  layout: ChartLayout;
  goalLineY: number;
  pro: boolean;
  from: SharedValue<WeightShape>;
  to: SharedValue<WeightShape>;
  progress: SharedValue<number>;
  bracket: SharedValue<number>;
  drop: SharedValue<number>;
  dropOpacity: SharedValue<number>;
}

/**
 * The curve, the goal as the floor of the plot, and the bracket between them.
 *
 * Putting the goal on the same y-scale as the readings squashes the curve into
 * the top half, and that is the honest trade: this screen reads the journey, and
 * the week belongs to History. No projection is drawn, so the app still predicts
 * nothing.
 */
function WeightBand({
  journey,
  layout,
  goalLineY,
  pro,
  from,
  to,
  progress,
  bracket,
  drop,
  dropOpacity,
}: WeightBandProps) {
  const floorY = layout.goalY;
  const points = journey.weights.length;
  const hasCurve = points >= 2;
  const flatY = points > 0
    ? yFor(layout, journey.weights[0]?.value ?? 0)
    : layout.plotT + CHART.firstReadingDrop;
  const bracketX = layout.plotR;

  const lineProps = useAnimatedProps(() => ({ d: curvePath(from.value, to.value, progress.value) }));
  const areaProps = useAnimatedProps(() => {
    const line = curvePath(from.value, to.value, progress.value);
    if (line === '') return { d: '' };
    const firstX = mix(from.value.xs[0] ?? 0, to.value.xs[0] ?? 0, progress.value);
    const lastX = mix(lastOf(from.value.xs), lastOf(to.value.xs), progress.value);
    return { d: `${line} L ${lastX.toFixed(1)} ${floorY} L ${firstX.toFixed(1)} ${floorY} Z` };
  });
  const nowProps = useAnimatedProps(() => ({
    cx: mix(lastOf(from.value.xs), lastOf(to.value.xs), progress.value),
    cy: mix(lastOf(from.value.ys), lastOf(to.value.ys), progress.value),
  }));
  const dropProps = useAnimatedProps(() => ({
    cx: lastOf(to.value.xs),
    cy: lastOf(to.value.ys) - DROP_HEIGHT * (1 - drop.value),
    opacity: dropOpacity.value,
  }));
  const bracketTopProps = useAnimatedProps(() => ({
    y1: mix(lastOf(from.value.ys), lastOf(to.value.ys), bracket.value) + 9,
  }));
  const bracketCapProps = useAnimatedProps(() => {
    const y = mix(lastOf(from.value.ys), lastOf(to.value.ys), bracket.value) + 9;
    return { y1: y, y2: y };
  });

  const lastPoint = journey.weights[journey.weights.length - 1];
  const lastY = lastPoint ? yFor(layout, lastPoint.value) : flatY;
  const drawBracket = journey.goal !== null && points > 0 && goalLineY - lastY > 26;

  return (
    <>
      <Line
        x1={layout.plotL}
        y1={goalLineY}
        x2={layout.plotR}
        y2={goalLineY}
        stroke={journey.goal !== null ? colors.amber : WAITING}
        strokeOpacity={journey.goal !== null ? 0.55 : 1}
        strokeWidth={journey.goal !== null ? 1.6 : 1.4}
        strokeDasharray={journey.goal !== null ? '5 5' : '4 6'}
        strokeLinecap="round"
      />

      {hasCurve ? (
        <>
          <AnimatedPath animatedProps={areaProps} d="" fill="url(#progressGap)" />
          <AnimatedPath
            animatedProps={lineProps}
            d=""
            fill="none"
            stroke={colors.amber}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {journey.weights.slice(1, -1).map((weight) => (
            <Circle
              key={weight.takenAt}
              cx={xFor(layout, weight.day, journey.spanDays)}
              cy={yFor(layout, weight.value)}
              r={2.6}
              fill={colors.surface}
              stroke={colors.amber}
              strokeWidth={1.6}
            />
          ))}
          <Circle
            cx={xFor(layout, journey.weights[0]?.day ?? 0, journey.spanDays)}
            cy={yFor(layout, journey.weights[0]?.value ?? 0)}
            r={4}
            fill={colors.surface}
            stroke={colors.amber}
            strokeWidth={2.2}
          />
        </>
      ) : (
        <>
          <Line
            x1={layout.plotL}
            y1={flatY}
            x2={layout.plotR}
            y2={flatY}
            stroke={colors.amber}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeDasharray="3 5"
            strokeLinecap="round"
          />
          {points === 1 ? (
            <>
              <Circle cx={layout.plotL} cy={flatY} r={8.5} fill={colors.amber} fillOpacity={0.16} />
              <Circle
                cx={layout.plotL}
                cy={flatY}
                r={4.2}
                fill={colors.amber}
                stroke={colors.surface}
                strokeWidth={2.2}
              />
            </>
          ) : null}
        </>
      )}

      {hasCurve ? (
        <>
          <AnimatedCircle animatedProps={nowProps} r={8.5} fill={colors.amber} fillOpacity={0.16} />
          <AnimatedCircle
            animatedProps={nowProps}
            r={4.2}
            fill={colors.amber}
            stroke={colors.surface}
            strokeWidth={2.2}
          />
          <AnimatedCircle
            animatedProps={dropProps}
            r={5.2}
            fill={colors.amber}
            stroke={colors.surface}
            strokeWidth={2.2}
          />
        </>
      ) : null}

      {drawBracket ? (
        <>
          <AnimatedLine
            animatedProps={bracketTopProps}
            x1={bracketX}
            x2={bracketX}
            y1={lastY + 9}
            y2={goalLineY - 4}
            stroke={colors.amber}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeDasharray="2 4"
          />
          <AnimatedLine
            animatedProps={bracketCapProps}
            x1={bracketX - 5}
            x2={bracketX + 5}
            y1={lastY + 9}
            y2={lastY + 9}
            stroke={colors.amber}
            strokeOpacity={0.55}
            strokeWidth={1.4}
          />
          <Line
            x1={bracketX - 5}
            y1={goalLineY - 4}
            x2={bracketX + 5}
            y2={goalLineY - 4}
            stroke={colors.amber}
            strokeOpacity={0.55}
            strokeWidth={1.4}
          />
        </>
      ) : null}

      {/* The start weight is one of the four numbers Pro buys. */}
      {pro && hasCurve ? (
        <SvgText
          x={layout.plotL}
          y={yFor(layout, journey.weights[0]?.value ?? 0) - 11}
          fontSize={LABEL_SIZE}
          fontFamily={fonts.sansSemiBold}
          fill={colors.inkMuted}
        >
          {(journey.weights[0]?.value ?? 0).toFixed(1)}
        </SvgText>
      ) : null}

      {/* The stem that ties the last effect to the pill naming it. */}
      {journey.effects.length > 0 ? (
        <Line
          x1={xFor(layout, journey.effects[journey.effects.length - 1]?.day ?? 0, journey.spanDays)}
          y1={layout.effY - 12}
          x2={xFor(layout, journey.effects[journey.effects.length - 1]?.day ?? 0, journey.spanDays)}
          y2={layout.effY - 6}
          stroke={colors.violet}
          strokeOpacity={0.35}
          strokeWidth={1.2}
        />
      ) : null}
    </>
  );
}

/** The pills and labels the weight band hangs off the chart, outside the SVG. */
function WeightOverlay({
  journey,
  layout,
  goalLineY,
  pro,
  from,
  to,
  bracket,
  lastEffect,
}: {
  journey: Journey;
  layout: ChartLayout;
  goalLineY: number;
  pro: boolean;
  from: SharedValue<WeightShape>;
  to: SharedValue<WeightShape>;
  bracket: SharedValue<number>;
  lastEffect: Journey['effects'][number] | null;
}) {
  const points = journey.weights.length;
  const lastPoint = journey.weights[points - 1];
  const lastY = lastPoint ? yFor(layout, lastPoint.value) : layout.plotT + CHART.firstReadingDrop;
  const drawBracket = journey.goal !== null && points > 0 && goalLineY - lastY > 26;
  const toGo = journey.goal !== null && lastPoint
    ? Math.abs(lastPoint.value - journey.goal)
    : 0;

  const pillStyle = useAnimatedStyle(() => {
    const y = mix(lastOf(from.value.ys), lastOf(to.value.ys), bracket.value);
    return { transform: [{ translateY: (y - lastY) / 2 }] };
  });
  const goalGap = useDerivedValue(() => {
    const value = mix(from.value.value, to.value.value, bracket.value);
    return Math.abs(value - (journey.goal ?? value));
  });

  return (
    <>
      {journey.goal !== null ? (
        <StaticPill
          label={`Goal ${formatWeightValue(journey.goal)} ${journey.unit}`}
          tone={colors.ink}
          border={AMBER_SOFT}
          top={goalLineY - 11}
          right={layout.width - (layout.plotR - 16)}
        />
      ) : (
        <ActionPill
          testID="progress-set-goal"
          label="Set a goal weight"
          tone={colors.successDeep}
          border="rgba(20,122,82,0.30)"
          top={layout.goalY - 11}
          right={layout.width - (layout.plotR - 16)}
          onPress={() => router.push('/(tabs)/profile')}
        />
      )}

      {drawBracket && pro ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { borderColor: colors.borderStrong },
            { position: 'absolute', top: (lastY + goalLineY) / 2 - 11, right: layout.width - (layout.plotR - 9) },
            pillStyle,
          ]}
        >
          <GapValue gap={goalGap} initial={toGo} unit={journey.unit} />
        </Animated.View>
      ) : null}

      {points < 2 ? (
        <View pointerEvents="none" style={[styles.centred, { top: lastY - 12 }]}>
          <View style={[styles.pill, styles.hint]}>
            <Text variant="caption" color={colors.inkMuted}>
              {points === 0 ? 'Log a weight to start your line' : 'Log a weight to see your line'}
            </Text>
          </View>
        </View>
      ) : null}

      {lastEffect !== null ? (
        <View
          pointerEvents="none"
          style={[styles.pill, styles.effectPill, { top: layout.effY - 34, right: layout.width - layout.plotR }]}
        >
          <Text variant="caption" color={colors.violet}>{lastEffect.label}</Text>
          {/* A clear day has no severity to show, so the pill is the label alone. */}
          {lastEffect.kind === 'clear' ? null : pro ? (
            <Text variant="caption" color={colors.violet}>{lastEffect.severity}/10</Text>
          ) : (
            <View style={styles.severityTrack}>
              <View style={[styles.severityFill, { flex: Math.max(lastEffect.severity, 0.001) }]} />
              <View style={{ flex: Math.max(10 - lastEffect.severity, 0.001) }} />
            </View>
          )}
        </View>
      ) : null}
    </>
  );
}

/** The distance still to walk, counting down with the bracket that measures it. */
function GapValue({
  gap,
  initial,
  unit,
}: {
  gap: SharedValue<number>;
  initial: number;
  unit: string;
}) {
  const [label, setLabel] = useState(initial.toFixed(1));

  useAnimatedReaction(
    () => gap.value.toFixed(1),
    (current, last) => {
      if (current !== last && last !== null) runOnJS(setLabel)(current);
    },
  );

  return <Text variant="caption">{label} {unit} to go</Text>;
}

/* ----------------------------------------------------------- the shots metric */

/**
 * Every scheduled dose in the run, on time or not.
 *
 * One row per medication, one column per week. The name sits over its own row
 * rather than in a gutter: a gutter would eat the axis the whole screen is built
 * on, and a row of weeks with nothing above it names nothing.
 */
function ShotsBand({ journey, layout }: { journey: Journey; layout: ChartLayout }) {
  const rows = journey.medications;
  const columns = Math.max(1, Math.ceil(journey.spanDays / 7));
  const cellWidth = (layout.plotR - layout.plotL) / columns;
  const radiusPx = Math.min(8.5, Math.max(3.2, cellWidth * 0.34));
  const withCheck = radiusPx >= 7;
  // The plot is as tall as the most demanding metric, so a single medication
  // would otherwise hang from the top of a space built for six.
  const blockHeight = 40 + Math.max(1, rows.length) * CHART.shotsRow;
  const blockTop = layout.plotT + Math.max(6, (layout.plotH - blockHeight) / 2);
  const firstRow = blockTop + 40;

  if (rows.length === 0) {
    return (
      <Line
        x1={layout.plotL}
        y1={firstRow}
        x2={layout.plotR}
        y2={firstRow}
        stroke={WAITING}
        strokeWidth={1.4}
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
    );
  }

  return (
    <>
      {journey.edgeLabels === null ? journey.months.map((month) => (
        <SvgText
          key={`week-${month.day}`}
          x={layout.plotL + cellWidth * (Math.floor(month.day / 7) + 0.5)}
          y={blockTop}
          textAnchor="middle"
          fontSize={LABEL_SIZE}
          fontFamily={fonts.sansMedium}
          fill={colors.inkSubtle}
        >
          {month.label}
        </SvgText>
      )) : null}

      {rows.map((medication, index) => {
        const cy = firstRow + index * CHART.shotsRow;
        return (
          <G key={medication.id}>
            <Circle cx={layout.plotL + 5} cy={cy - 22} r={5} fill={medication.color} />
            <SvgText
              x={layout.plotL + 16}
              y={cy - 17.6}
              fontSize={LABEL_SIZE}
              fontFamily={fonts.sansMedium}
              fill={colors.ink}
            >
              {medication.name}
            </SvgText>
            <SvgText
              x={layout.plotR}
              y={cy - 17.6}
              textAnchor="end"
              fontSize={LABEL_SIZE}
              fontFamily={fonts.sansMedium}
              fill={colors.inkSubtle}
            >
              {medication.scheduleLabel}
            </SvgText>
            <Line
              x1={layout.plotL}
              y1={cy}
              x2={layout.plotR}
              y2={cy}
              stroke="rgba(17,20,24,0.06)"
              strokeWidth={1}
            />
            {Array.from({ length: columns }, (_, week) => {
              const cx = layout.plotL + cellWidth * (week + 0.5);
              return (
                <WeekCell
                  key={week}
                  medication={medication}
                  week={week}
                  cx={cx}
                  cy={cy}
                  radius={radiusPx}
                  withCheck={withCheck}
                />
              );
            })}
          </G>
        );
      })}

      <SvgText
        x={layout.plotL}
        y={firstRow + (rows.length - 1) * CHART.shotsRow + 40}
        fontSize={LABEL_SIZE}
        fontFamily={fonts.sansMedium}
        fill={colors.inkMuted}
      >
        {shotSummary(journey)}
      </SvgText>
    </>
  );
}

function WeekCell({
  medication,
  week,
  cx,
  cy,
  radius: r,
  withCheck,
}: {
  medication: JourneyMedication;
  week: number;
  cx: number;
  cy: number;
  radius: number;
  withCheck: boolean;
}) {
  const inWeek = (day: number) => Math.floor(day / 7) === week;
  if (medication.shots.some(inWeek)) {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={r} fill={medication.color} />
        {withCheck ? (
          <Path
            d={`M ${(cx - 3.5).toFixed(1)} ${cy} l 2.5 2.6 l 4.6 -5.1`}
            fill="none"
            stroke={colors.inkInverse}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </G>
    );
  }
  if (medication.due.some(inWeek)) {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.successDeep} strokeWidth={2} />
        <Circle cx={cx} cy={cy} r={r * 0.4} fill={colors.successDeep} />
      </G>
    );
  }
  if (medication.missed.some(inWeek)) {
    return (
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(17,20,24,0.22)" strokeWidth={1.6} />
    );
  }
  return <Rect x={cx - 3.5} y={cy - 1} width={7} height={2} rx={1} fill="rgba(17,20,24,0.14)" />;
}

function shotSummary(journey: Journey): string {
  const parts = [`${journey.shotTotal} taken`];
  if (journey.missedTotal > 0) parts.push(`${journey.missedTotal} missed`);
  if (journey.dueTotal > 0) parts.push(`${journey.dueTotal} due today`);
  return parts.join(', ');
}

/* --------------------------------------------------------- the effects metric */

const SEVERITY_STEPS = [5, 10] as const;

/** Severity over the same axis. Every reading names itself and reads without a tap. */
function EffectsBand({ journey, layout }: { journey: Journey; layout: ChartLayout }) {
  const base = layout.goalY - 32;
  const unit = severityUnit(layout);

  return (
    <>
      <Line
        x1={layout.plotL}
        y1={base}
        x2={layout.plotR}
        y2={base}
        stroke={colors.borderStrong}
        strokeWidth={1}
      />
      {SEVERITY_STEPS.map((step) => (
        <G key={step}>
          <Line
            x1={layout.plotL}
            y1={base - step * unit}
            x2={layout.plotR}
            y2={base - step * unit}
            stroke="rgba(139,123,216,0.20)"
            strokeWidth={1}
            strokeDasharray="4 6"
          />
          <SvgText
            x={layout.plotR}
            y={base - step * unit - 6}
            textAnchor="end"
            fontSize={LABEL_SIZE}
            fontFamily={fonts.sansMedium}
            fill={colors.inkSubtle}
          >
            {step}/10
          </SvgText>
        </G>
      ))}
      {journey.effects.map((effect) => {
        const x = xFor(layout, effect.day, journey.spanDays);
        // A clear day sits on the axis itself: the baseline is zero severity,
        // and the hollow ring says the zero was answered, not assumed. That is
        // the honest floor the severity dots are measured against.
        if (effect.kind === 'clear') {
          return (
            <Circle
              key={effect.takenAt}
              cx={x}
              cy={base}
              r={5}
              fill={colors.surface}
              stroke={colors.violet}
              strokeOpacity={0.7}
              strokeWidth={2}
            />
          );
        }
        const y = base - effect.severity * unit;
        return (
          <G key={effect.takenAt}>
            <Line x1={x} y1={base} x2={x} y2={y} stroke={colors.violet} strokeWidth={2} />
            <Circle cx={x} cy={y} r={6} fill={colors.violet} stroke={colors.surface} strokeWidth={2} />
          </G>
        );
      })}
    </>
  );
}

/** The labels of the Effects band, placed so no two of them sit on each other. */
function EffectsOverlay({ journey, layout }: { journey: Journey; layout: ChartLayout }) {
  const placed = useMemo(
    () => placeEffectLabels(journey, layout),
    [journey, layout],
  );

  return (
    <>
      {placed.map((entry) => (
        <View
          key={entry.key}
          pointerEvents="none"
          style={[styles.pill, styles.effectPill, { top: entry.top, left: entry.left }]}
        >
          <Text variant="caption" color={colors.violet}>{entry.label}</Text>
        </View>
      ))}
    </>
  );
}

interface PlacedLabel {
  key: number;
  label: string;
  left: number;
  top: number;
  width: number;
}

function placeEffectLabels(journey: Journey, layout: ChartLayout): PlacedLabel[] {
  const base = layout.goalY - 32;
  const unit = severityUnit(layout);
  const placed: PlacedLabel[] = [];

  for (const effect of journey.effects) {
    // Clear days are not labelled one by one: the mark on the axis baseline is
    // the reading, and a quiet week would otherwise stack a column of
    // identical pills. The legend names the ring once.
    if (effect.kind === 'clear') continue;
    const label = `${effect.label} ${effect.severity}/10`;
    const width = textWidth(label, LABEL_SIZE) + 22;
    const x = xFor(layout, effect.day, journey.spanDays);
    const left = Math.min(Math.max(x - width / 2, layout.plotL), layout.plotR - width);
    let top = base - effect.severity * unit - 32;
    while (
      placed.some((other) => (
        left < other.left + other.width + 6
        && other.left < left + width + 6
        && top < other.top + 26
        && other.top < top + 26
      ))
      && top > layout.plotT
    ) {
      top -= 12;
    }
    placed.push({ key: effect.takenAt, label, left, top, width });
  }
  return placed;
}

function severityUnit(layout: ChartLayout): number {
  return Math.max(6, (layout.goalY - 32 - layout.plotT - 40) / 10);
}

/* ------------------------------------------------------------------- the pills */

function StaticPill({
  label,
  tone,
  border,
  top,
  right,
}: {
  label: string;
  tone: string;
  border: string;
  top: number;
  right?: number;
}) {
  if (right === undefined) {
    return (
      <View pointerEvents="none" style={[styles.centred, { top }]}>
        <View style={[styles.pill, { borderColor: border }]}>
          <Text variant="caption" color={tone}>{label}</Text>
        </View>
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[styles.pill, { borderColor: border, top, right }]}>
      <Text variant="caption" color={tone}>{label}</Text>
    </View>
  );
}

/** The same pill, when the state it names is one the user can leave. */
function ActionPill({
  testID,
  label,
  tone,
  border,
  top,
  right,
  onPress,
}: {
  testID: string;
  label: string;
  tone: string;
  border: string;
  top: number;
  right?: number;
  onPress: () => void;
}) {
  const press = usePressScale();
  const body = (
    <Animated.View style={press.style}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={10}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.pill, styles.pillStatic, { borderColor: border }]}
      >
        <Text variant="caption" color={tone}>{label}</Text>
      </Pressable>
    </Animated.View>
  );

  if (right === undefined) {
    return <View pointerEvents="box-none" style={[styles.centred, { top }]}>{body}</View>;
  }
  return <View pointerEvents="box-none" style={{ position: 'absolute', top, right }}>{body}</View>;
}

/* ------------------------------------------------------------------- worklets */

function mix(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

function lastOf(values: number[]): number {
  'worklet';
  return values.length > 0 ? (values[values.length - 1] ?? 0) : 0;
}

/** The path between two states of the curve, point for point. */
function curvePath(from: WeightShape, to: WeightShape, t: number): string {
  'worklet';
  const count = Math.min(from.xs.length, to.xs.length);
  if (count < 2) return '';
  let d = '';
  for (let index = 0; index < count; index += 1) {
    const x = (from.xs[index] ?? 0) + ((to.xs[index] ?? 0) - (from.xs[index] ?? 0)) * t;
    const y = (from.ys[index] ?? 0) + ((to.ys[index] ?? 0) - (from.ys[index] ?? 0)) * t;
    d += `${index === 0 ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** The reading falls onto the end of the curve, then hands the line over to it. */
function playDrop(drop: SharedValue<number>, opacity: SharedValue<number>, reduced: boolean) {
  if (reduced) return;
  const fall = progressBeats.curve - progressBeats.drop;
  drop.value = 0;
  opacity.value = 0;
  drop.value = withDelay(progressBeats.drop, withTiming(1, { duration: fall, easing: easing.in }));
  opacity.value = withDelay(
    progressBeats.drop,
    withSequence(
      withTiming(1, { duration: motion.press }),
      withDelay(fall - motion.press, withTiming(0, { duration: motion.fast, easing: easing.out })),
    ),
  );
}

function formatWeightValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pillStatic: {
    position: 'relative',
  },
  hint: {
    position: 'relative',
    height: 24,
    paddingHorizontal: spacing.md,
    borderColor: colors.border,
  },
  effectPill: {
    borderColor: VIOLET_SOFT,
  },
  centred: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  severityTrack: {
    width: 40,
    height: 3.5,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(139,123,216,0.22)',
  },
  severityFill: {
    borderRadius: radius.pill,
    backgroundColor: colors.violet,
  },
});
