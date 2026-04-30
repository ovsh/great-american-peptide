import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

interface BrandSealProps {
  size?: number;
  variant?: 'navy' | 'cream' | 'inverse';
}

// Wax-seal medallion: light field, navy stars, red stripes — like a US flag emblem.
export function BrandSeal({ size = 32, variant = 'navy' }: BrandSealProps) {
  const isInverse = variant === 'inverse';
  // 'navy' variant = navy ring + cream/white field with navy stars + red stripes (default for masthead)
  // 'cream' variant = white field on cream background context (tab bar)
  // 'inverse' variant = navy field with cream stars + cream-tinted stripes (for dark backgrounds)
  const ringFill = isInverse ? colors.ink : colors.surface;
  const ringStroke = isInverse ? colors.surface : colors.ink;
  const starColor = isInverse ? colors.background : colors.ink;
  const stripeColor = colors.red;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="ring">
          <Circle cx="50" cy="50" r="44" />
        </ClipPath>
      </Defs>
      <Circle cx="50" cy="50" r="48" fill={ringFill} stroke={ringStroke} strokeWidth="2" />
      <G clipPath="url(#ring)">
        <Rect x="0" y="56" width="100" height="5" fill={stripeColor} />
        <Rect x="0" y="66" width="100" height="5" fill={stripeColor} />
        <Rect x="0" y="76" width="100" height="5" fill={stripeColor} />
        <Rect x="0" y="86" width="100" height="5" fill={stripeColor} />
      </G>
      <Circle cx="50" cy="50" r="44" fill="none" stroke={ringStroke} strokeWidth="1" opacity={0.35} />
      <G>
        <Star cx={32} cy={32} size={6} fill={starColor} />
        <Star cx={50} cy={26} size={7} fill={starColor} />
        <Star cx={68} cy={32} size={6} fill={starColor} />
      </G>
    </Svg>
  );
}

function Star({ cx, cy, size, fill }: { cx: number; cy: number; size: number; fill: string }) {
  const outer = size;
  const inner = size * 0.4;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return <Path d={`M ${points.join(' L ')} Z`} fill={fill} />;
}

export function ThreeStars({ size = 24, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size * 3} height={size} viewBox="0 0 72 24">
      <Star cx={12} cy={12} size={8} fill={color} />
      <Star cx={36} cy={12} size={10} fill={color} />
      <Star cx={60} cy={12} size={8} fill={color} />
    </Svg>
  );
}
