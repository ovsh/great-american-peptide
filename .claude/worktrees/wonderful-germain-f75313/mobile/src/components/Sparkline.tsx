import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '../theme';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showLastPoint?: boolean;
}

export function Sparkline({ data, width = 80, height = 28, color = colors.ink, showLastPoint = true }: SparklineProps) {
  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const yFor = (v: number) => height - 4 - ((v - min) / range) * (height - 8);

  let d = `M 0 ${yFor(data[0]!)}`;
  for (let i = 1; i < data.length; i++) {
    d += ` L ${i * stepX} ${yFor(data[i]!)}`;
  }
  const lastX = (data.length - 1) * stepX;
  const lastY = yFor(data[data.length - 1]!);

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showLastPoint && <Circle cx={lastX} cy={lastY} r={2.5} fill={color} />}
    </Svg>
  );
}
