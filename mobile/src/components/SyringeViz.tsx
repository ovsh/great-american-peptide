import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

interface SyringeVizProps {
  volumeMl: number;
  capacityMl?: number;
  width?: number;
  height?: number;
}

function fmt(value: number) {
  if (value === 0) return '0';
  if (value < 1) return value.toFixed(2).replace(/0$/, '');
  return value.toFixed(1);
}

export function SyringeViz({ volumeMl, capacityMl = 1, width = 320, height = 80 }: SyringeVizProps) {
  const padX = 30;
  const barrelL = padX;
  const barrelR = width - 30;
  const barrelTop = 28;
  const barrelBottom = 56;
  const barrelW = barrelR - barrelL;
  const safeCapacity = Math.max(0.1, capacityMl);
  const fillRatio = Math.max(0, Math.min(1, volumeMl / safeCapacity));
  const fillRight = barrelL + barrelW * fillRatio;
  const tickCount = 20;
  return (
    <Svg width={width} height={height}>
      <Rect x={barrelL} y={barrelTop} width={barrelW} height={barrelBottom - barrelTop} fill={colors.surface} stroke={colors.ink} strokeWidth={1} rx={2} />
      <Rect x={barrelL} y={barrelTop} width={fillRight - barrelL} height={barrelBottom - barrelTop} fill={colors.accent} opacity={0.6} />
      <Rect x={barrelR} y={barrelTop + 4} width={6} height={(barrelBottom - barrelTop) - 8} fill={colors.ink} />
      <Rect x={0} y={barrelTop + 8} width={barrelL} height={(barrelBottom - barrelTop) - 16} fill={colors.borderStrong} />
      <Line x1={width - 24} y1={(barrelTop + barrelBottom) / 2} x2={width - 6} y2={(barrelTop + barrelBottom) / 2} stroke={colors.ink} strokeWidth={1} />
      <G>
        {Array.from({ length: tickCount + 1 }).map((_, i) => {
          const x = barrelL + (barrelW * i) / tickCount;
          const isMajor = i % 5 === 0;
          return (
            <G key={i}>
              <Line x1={x} y1={barrelTop} x2={x} y2={barrelTop - (isMajor ? 6 : 3)} stroke={colors.ink} strokeWidth={0.7} />
              {isMajor && (
                <SvgText x={x} y={barrelTop - 8} fontSize={8} fontFamily={fonts.sans} fill={colors.inkMuted} textAnchor="middle">
                  {fmt((safeCapacity * i) / tickCount)}
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
        stroke={colors.accent}
        strokeWidth={1.5}
      />
      <SvgText
        x={fillRight}
        y={barrelBottom + 22}
        fontSize={10}
        fontFamily={fonts.sansBold}
        fill={colors.accent}
        textAnchor="middle"
      >
        {volumeMl <= 0 ? '' : `${fmt(volumeMl)} mL`}
      </SvgText>
    </Svg>
  );
}
