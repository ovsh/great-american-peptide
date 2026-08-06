import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '../theme';

interface LineChartProps {
  data: { t: number; v: number }[];
  projection?: { t: number; v: number }[];
  width: number;
  height: number;
  yLabel?: (v: number) => string;
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
  yLabel,
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
  const valueRange = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.02, 0.0001);
  const minV = includeZero ? 0 : Math.max(0, rawMin - valueRange * 0.15);
  const maxV = rawMax + valueRange * 0.15;

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

  const yTicks = [];
  for (let i = 0; i <= yTickCount; i++) {
    const v = minV + ((maxV - minV) / yTickCount) * i;
    yTicks.push(v);
  }
  const xTicks = [];
  for (let i = 0; i < xTickCount; i++) {
    const t = minT + ((maxT - minT) / (xTickCount - 1)) * i;
    xTicks.push(t);
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
      {yLabel && yTicks.map((v, i) => (
        <SvgText
          key={`yl-${i}`}
          x={padL - 6}
          y={yFor(v) + 3}
          fontSize={10}
          fontFamily={fonts.sans}
          fill={colors.inkSubtle}
          textAnchor="end"
        >
          {yLabel(v)}
        </SvgText>
      ))}
      {xLabel && xTicks.map((t, i) => (
        <SvgText
          key={`xl-${i}`}
          x={xFor(t)}
          y={height - 6}
          fontSize={10}
          fontFamily={fonts.sans}
          fill={colors.inkSubtle}
          textAnchor="middle"
        >
          {xLabel(t)}
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
