import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '../theme';

interface LineChartProps {
  data: { t: number; v: number }[];
  projection?: { t: number; v: number }[];
  width: number;
  height: number;
  /**
   * One gridline value as text. `decimals` is what the gridline step needs, and
   * a label with fewer decimals than that prints the same number on two lines a
   * step apart. Leave it out for the plain number.
   */
  yLabel?: (value: number, decimals: number) => string;
  xLabel?: (t: number) => string;
  xTickCount?: number;
  yTickCount?: number;
  fillUnder?: boolean;
  color?: string;
  fillColor?: string;
  includeZero?: boolean;
}

export function LineChart({
  data,
  projection,
  width,
  height,
  yLabel = (value, decimals) => value.toFixed(decimals),
  xLabel,
  xTickCount = 6,
  yTickCount = 4,
  fillUnder = true,
  color = colors.ink,
  fillColor = colors.chartFill,
  includeZero = true,
}: LineChartProps) {
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const all = projection ? [...data, ...projection] : data;
  const firstDataPoint = data[0];
  const lastDataPoint = data[data.length - 1];
  if (all.length < 2 || !firstDataPoint || !lastDataPoint) {
    return <View style={{ width, height }} />;
  }
  const minT = Math.min(...all.map((p) => p.t));
  const maxT = Math.max(...all.map((p) => p.t));
  const rawMin = Math.min(...all.map((point) => point.v));
  const rawMax = Math.max(...all.map((point) => point.v));
  // Two mornings at the same weight give a range of nothing to draw in. Open it
  // up around the value, and only then: a real range of three pounds is the
  // chart the reader came for, and widening that flattens the line.
  const realRange = rawMax - rawMin;
  const air = realRange > 0 ? 0 : Math.max(Math.abs(rawMax) * 0.02, 0.0001) / 2;
  // Round the ends out to the gridline step, so the axis reads as a ladder. The
  // ticks own the range rather than the other way round, and the rounding is the
  // headroom over the highest point.
  const yTicks = niceTicks(
    includeZero ? 0 : Math.max(0, rawMin - air),
    rawMax + air,
    yTickCount,
  );
  const minV = yTicks[0] ?? 0;
  const maxV = yTicks[yTicks.length - 1] ?? realRange;
  const yDecimals = stepDecimals((yTicks[1] ?? 1) - minV);

  const xFor = (t: number) => padL + ((t - minT) / (maxT - minT || 1)) * innerW;
  const yFor = (v: number) => padT + innerH - ((v - minV) / (maxV - minV || 1)) * innerH;

  const pathFor = (pts: { t: number; v: number }[]) => {
    const firstPoint = pts[0];
    if (!firstPoint) return '';

    let d = `M ${xFor(firstPoint.t)} ${yFor(firstPoint.v)}`;
    for (const point of pts.slice(1)) {
      d += ` L ${xFor(point.t)} ${yFor(point.v)}`;
    }
    return d;
  };

  const fillPath = () => {
    let d = `M ${xFor(firstDataPoint.t)} ${yFor(minV)}`;
    for (const p of data) d += ` L ${xFor(p.t)} ${yFor(p.v)}`;
    d += ` L ${xFor(lastDataPoint.t)} ${yFor(minV)} Z`;
    return d;
  };

  // Ticks a reader can tell apart. Both charts label by day, so two weights from
  // one morning asked for four ticks and printed 8/9 four times, which reads as a
  // broken axis rather than as a single day of data. Drop a tick whose label
  // repeats the one before it, and when one day is all there is, centre the label
  // it leaves rather than pinning it to the left edge.
  const xTicks: { t: number; label: string }[] = [];
  if (xLabel) {
    for (let i = 0; i < xTickCount; i++) {
      const t = minT + ((maxT - minT) / (xTickCount - 1 || 1)) * i;
      const label = xLabel(t);
      if (xTicks[xTicks.length - 1]?.label === label) continue;
      xTicks.push({ t, label });
    }
    const only = xTicks[0];
    if (xTicks.length === 1 && only) xTicks[0] = { ...only, t: minT + (maxT - minT) / 2 };
  }
  return (
    <Svg width={width} height={height}>
      {yTicks.map((v, i) => (
        <Line
          key={`y-${i}`}
          x1={padL}
          x2={width - padR}
          y1={yFor(v)}
          y2={yFor(v)}
          stroke={colors.chartGrid}
          strokeWidth={1}
        />
      ))}
      {yTicks.map((v, i) => (
        <SvgText
          key={`yl-${i}`}
          x={padL - 6}
          y={yFor(v) + 3}
          fontSize={10}
          fontFamily={fonts.sans}
          fill={colors.inkSubtle}
          textAnchor="end"
        >
          {yLabel(v, yDecimals)}
        </SvgText>
      ))}
      {xTicks.map((tick, i) => (
        <SvgText
          key={`xl-${i}`}
          x={xFor(tick.t)}
          y={height - 6}
          fontSize={10}
          fontFamily={fonts.sans}
          fill={colors.inkSubtle}
          textAnchor="middle"
        >
          {tick.label}
        </SvgText>
      ))}
      {fillUnder && (
        <Path d={fillPath()} fill={fillColor} />
      )}
      <Path
        d={pathFor(data)}
        stroke={color}
        strokeWidth={1.75}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {projection && projection.length >= 2 && (
        <Path
          d={pathFor(projection)}
          stroke={colors.chartProjection}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <Circle
        cx={xFor(lastDataPoint.t)}
        cy={yFor(lastDataPoint.v)}
        r={3.5}
        fill={color}
      />
    </Svg>
  );
}

/**
 * Gridline values that read as a ladder, and the range the chart draws in.
 *
 * Cutting the data range into equal parts puts the lines a fraction of a pound
 * apart, and every label here rounds, so the axis prints one number twice or
 * skips one. Evenly spaced lines carrying 232, 233, 234, 236 say the chart
 * climbs faster at the top than it does. A round step lands on round labels.
 */
function niceTicks(min: number, max: number, count: number): number[] {
  const step = niceStep(Math.max((max - min) / count, Number.EPSILON));
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Multiply out from the first tick rather than add a step at a time, so the
  // values carry no running float error into the label.
  for (let i = 0; first + i * step <= last + step / 2; i++) ticks.push(first + i * step);
  return ticks;
}

/** How many decimals it takes to write `step` whole. Four is the floor of the axis. */
function stepDecimals(step: number): number {
  for (let decimals = 0; decimals < 4; decimals++) {
    const scaled = Math.abs(step) * Math.pow(10, decimals);
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return decimals;
  }
  return 4;
}

/** The rungs a reader counts in. Every one is a power of ten times one of these. */
const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * The nearest round step to `raw`. Nearest and not the next one up, because
 * rounding up turns a step of 2.1 into 5, and then the chart draws a range two
 * and a half times the one the data needs.
 */
function niceStep(raw: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const scaled = raw / magnitude;
  let best = NICE_STEPS[0] as number;
  for (const candidate of NICE_STEPS) {
    if (Math.abs(candidate - scaled) < Math.abs(best - scaled)) best = candidate;
  }
  return best * magnitude;
}
