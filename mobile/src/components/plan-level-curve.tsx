import { useEffect, useMemo, useRef } from 'react';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, easing, motion, planBeats, springTo, springs, timeTo } from '@/theme';

/**
 * The plan reveal's hero: one medication's first four weeks, drawing itself.
 *
 * The screen it sits on is the payoff of the whole funnel, so the curve is the
 * picture and not a figure beside a paragraph. No axis numbers, no legend and no
 * gridline labels: the shape is the reading, the two words under it carry the
 * time, and the sentence under those names the week. `today-level-chart.tsx`
 * makes the same trade for the same reason.
 *
 * The draw is a curtain in the card's own colour sliding off to the right, the
 * device Today's hero and the welcome poster both use. It crosses at a constant
 * rate (motion rule 5) and the steady mark carries its own eased pop, so the
 * mark reads as landing on the curve rather than travelling with it. The mark's
 * delay is geometry: the first beat after the curtain has uncovered its column.
 *
 * Under Reduce Motion the caller passes `play={false}` and every value starts
 * finished, so the first painted frame is the last frame of the sequence.
 */

/** Tall enough to read as a picture, short enough to leave the date on screen. */
export const PLAN_CHART_HEIGHT = 176;

/** Where the drawing sits in its box, as fractions of the height. */
const BASELINE_Y = 0.94;
const PEAK_Y = 0.12;
const GRID_STEP_Y = 0.22;
const GRID_LINES = 3;
/** The welcome poster's stroke weight, so the app's two hero curves match. */
const STROKE_WIDTH = 3.2;
const HALO_R = 12;
const MARK_R = 4.5;
/** The horizon `buildOnboardingPlan` samples. The mark counts weeks in it. */
const WEEKS = 4;
/** Week one opens at the left edge, so a mark there would mark nothing. */
const FIRST_MARKED_WEEK = 2;
const FILL_ID = 'planLevelFill';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface CurvePoint {
  t: number;
  v: number;
}

/** Where the level settles, and the beat the curtain uncovers it on. */
interface SteadyMark {
  x: number;
  y: number;
  delay: number;
}

interface PlanCurveShape {
  line: string;
  area: string;
  gridYs: number[];
  baseY: number;
  mark: SteadyMark | null;
}

interface PlanLevelCurveProps {
  points: readonly CurvePoint[];
  width: number;
  height?: number;
  /** 1 to 4, or null while the level is still climbing at the end of week 4. */
  steadyWeek: number | null;
  /** False under Reduce Motion: the finished curve in frame one. */
  play: boolean;
}

export function PlanLevelCurve({
  points,
  width,
  height = PLAN_CHART_HEIGHT,
  steadyWeek,
  play,
}: PlanLevelCurveProps) {
  const shape = useMemo(
    () => buildPlanCurve({ points, width, height, steadyWeek }),
    [height, points, steadyWeek, width],
  );
  const draw = useSharedValue(play ? 0 : 1);
  const swap = useSharedValue(1);
  const drawn = useRef(false);

  useEffect(() => {
    draw.value = timeTo(1, {
      duration: motion.draw,
      easing: easing.linear,
      delay: planBeats.curve,
      reduced: !play,
    });
  }, [draw, play]);

  // A second medication's curve replaces this one under the reader's eye, and
  // the arrival wipe is an arrival: playing it again would say the screen had
  // just opened. The new shape fades in over the old one instead.
  useEffect(() => {
    if (!drawn.current) {
      drawn.current = true;
      return;
    }
    swap.value = 0;
    swap.value = timeTo(1, { duration: motion.base, easing: easing.out, reduced: !play });
  }, [points, play, swap]);

  const curtainProps = useAnimatedProps(() => ({
    x: draw.value * width,
    width: width * (1 - draw.value),
  }));
  const swapStyle = useAnimatedStyle(() => ({ opacity: swap.value }));

  if (shape === null) return null;

  return (
    <Animated.View pointerEvents="none" style={swapStyle}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {shape.gridYs.map((y) => (
          <Line key={y} x1={0} y1={y} x2={width} y2={y} stroke={colors.chartGrid} strokeWidth={1} />
        ))}

        <Path d={shape.area} fill={`url(#${FILL_ID})`} />
        <Path
          d={shape.line}
          stroke={colors.accent}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {shape.mark ? <SteadyMarker mark={shape.mark} baseY={shape.baseY} play={play} /> : null}

        <AnimatedRect animatedProps={curtainProps} y={0} height={height} fill={colors.surface} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The week the level settles in, marked on the curve itself.
 *
 * The pop is a spring on the radius rather than a scale on a group, because
 * `react-native-svg` hands a group's transform to native as a matrix and a
 * worklet cannot write it. The opacity is clamped, because a `pop` spring
 * overshoots and an opacity above one is a warning rather than a brighter mark.
 */
function SteadyMarker({
  mark,
  baseY,
  play,
}: {
  mark: SteadyMark;
  baseY: number;
  play: boolean;
}) {
  const pop = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    pop.value = springTo(1, { config: springs.pop, delay: mark.delay, reduced: !play });
  }, [mark.delay, play, pop]);

  const stemProps = useAnimatedProps(() => ({ opacity: Math.min(1, pop.value) }));
  const haloProps = useAnimatedProps(() => ({ r: HALO_R * pop.value }));
  const dotProps = useAnimatedProps(() => ({ r: MARK_R * pop.value }));

  return (
    <>
      <AnimatedLine
        animatedProps={stemProps}
        x1={mark.x}
        y1={mark.y}
        x2={mark.x}
        y2={baseY}
        stroke={colors.borderStrong}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <AnimatedCircle
        animatedProps={haloProps}
        cx={mark.x}
        cy={mark.y}
        r={HALO_R}
        fill={colors.accent}
        fillOpacity={0.16}
      />
      <AnimatedCircle
        animatedProps={dotProps}
        cx={mark.x}
        cy={mark.y}
        r={MARK_R}
        fill={colors.accent}
        stroke={colors.surface}
        strokeWidth={2.5}
      />
    </>
  );
}

/**
 * The shape, and only the shape.
 *
 * The samples arrive from `services/onboardingPlan.ts`, which draws them with
 * the same `domain/pk` the rest of the app uses. Nothing here invents a point:
 * the peak sets the top of the box and every other height is read off it.
 */
function buildPlanCurve({
  points,
  width,
  height,
  steadyWeek,
}: {
  points: readonly CurvePoint[];
  width: number;
  height: number;
  steadyWeek: number | null;
}): PlanCurveShape | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (width <= 0 || height <= 0 || !first || !last) return null;
  const span = last.t - first.t;
  if (span <= 0) return null;

  const peak = points.reduce((highest, point) => Math.max(highest, point.v), 0);
  const baseY = height * BASELINE_Y;
  const topY = height * PEAK_Y;
  const xFor = (at: number) => ((at - first.t) / span) * width;
  // A curve that never leaves zero has no peak to measure against, and the
  // baseline is where it belongs. Dividing by that peak would be a NaN path.
  const yFor = (level: number) => (peak > 0 ? baseY - (level / peak) * (baseY - topY) : baseY);

  let line = '';
  for (const [index, point] of points.entries()) {
    line += `${index === 0 ? 'M' : ' L'} ${xFor(point.t).toFixed(1)} ${yFor(point.v).toFixed(1)}`;
  }

  return {
    line,
    area: `${line} L ${width.toFixed(1)} ${baseY.toFixed(1)} L 0 ${baseY.toFixed(1)} Z`,
    gridYs: Array.from({ length: GRID_LINES }, (_, index) => baseY - index * height * GRID_STEP_Y)
      .filter((y) => y > 0),
    baseY,
    mark: steadyMark({ points, steadyWeek, peak, span, from: first.t, width, xFor, yFor }),
  };
}

function steadyMark({
  points,
  steadyWeek,
  peak,
  span,
  from,
  width,
  xFor,
  yFor,
}: {
  points: readonly CurvePoint[];
  steadyWeek: number | null;
  peak: number;
  span: number;
  from: number;
  width: number;
  xFor: (at: number) => number;
  yFor: (level: number) => number;
}): SteadyMark | null {
  if (steadyWeek === null || steadyWeek < FIRST_MARKED_WEEK || peak <= 0) return null;

  // "Steady from week 3" means the level is settled as week 3 opens, so the mark
  // stands where that week starts and not where it ends.
  const at = from + ((steadyWeek - 1) / WEEKS) * span;
  const x = xFor(at);
  // The curtain crosses at a constant rate, so where the mark sits says when it
  // is uncovered. Rounded up to the beat grid, never down: a mark that popped
  // early would already be standing there when the curtain passed it.
  const uncoveredAt = planBeats.curve + motion.draw * (x / width);

  return {
    x,
    y: yFor(levelAt(points, at)),
    delay: Math.ceil(uncoveredAt / motion.beat) * motion.beat,
  };
}

/** The last sample on or before `at`. The mark sits on the curve, never near it. */
function levelAt(points: readonly CurvePoint[], at: number): number {
  let level = points[0]?.v ?? 0;
  for (const point of points) {
    if (point.t > at) break;
    level = point.v;
  }
  return level;
}
