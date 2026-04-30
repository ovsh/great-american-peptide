import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

interface SyringeVizProps {
  units: number;
  capacity: 100 | 40;
  width?: number;
  height?: number;
}

export function SyringeViz({ units, capacity, width = 320, height = 80 }: SyringeVizProps) {
  const padX = 30;
  const barrelL = padX;
  const barrelR = width - 30;
  const barrelTop = 28;
  const barrelBottom = 56;
  const barrelW = barrelR - barrelL;
  const fillRatio = Math.max(0, Math.min(1, units / capacity));
  const fillRight = barrelL + barrelW * fillRatio;
  const tickStep = capacity === 100 ? 10 : 5;
  const tickCount = capacity / tickStep;
  return (
    <Svg width={width} height={height}>
      <Rect x={barrelL} y={barrelTop} width={barrelW} height={barrelBottom - barrelTop} fill={colors.surface} stroke={colors.ink} strokeWidth={1} rx={2} />
      <Rect x={barrelL} y={barrelTop} width={fillRight - barrelL} height={barrelBottom - barrelTop} fill={colors.red} opacity={0.6} />
      <Rect x={barrelR} y={barrelTop + 4} width={6} height={(barrelBottom - barrelTop) - 8} fill={colors.ink} />
      <Rect x={0} y={barrelTop + 8} width={barrelL} height={(barrelBottom - barrelTop) - 16} fill={colors.borderStrong} />
      <Line x1={width - 24} y1={(barrelTop + barrelBottom) / 2} x2={width - 6} y2={(barrelTop + barrelBottom) / 2} stroke={colors.ink} strokeWidth={1} />
      <G>
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const x = barrelL + (barrelW * i) / tickCount;
          const isMajor = i % (capacity === 100 ? 2 : 2) === 0;
          return (
            <G key={i}>
              <Line x1={x} y1={barrelTop} x2={x} y2={barrelTop - (isMajor ? 6 : 3)} stroke={colors.ink} strokeWidth={0.7} />
              {isMajor && (
                <SvgText x={x} y={barrelTop - 8} fontSize={8} fontFamily={fonts.sans} fill={colors.inkMuted} textAnchor="middle">
                  {i * tickStep}
                </SvgText>
              )}
            </G>
          );
        })}
      </G>
      <Line
        x1={fillRight}
        y1={barrelBottom + 2}
        x2={fillRight}
        y2={barrelBottom + 12}
        stroke={colors.red}
        strokeWidth={1.5}
      />
      <SvgText
        x={fillRight}
        y={barrelBottom + 22}
        fontSize={10}
        fontFamily={fonts.sansBold}
        fill={colors.red}
        textAnchor="middle"
      >
        {units < 0.1 ? '' : units.toFixed(units < 10 ? 2 : 1)}
      </SvgText>
    </Svg>
  );
}
