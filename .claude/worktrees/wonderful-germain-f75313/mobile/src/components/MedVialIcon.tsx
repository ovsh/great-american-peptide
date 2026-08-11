import Svg, { Rect, Path, G } from 'react-native-svg';
import { colors } from '../theme';

interface MedVialIconProps {
  size?: number;
  colorIndex?: number;
}

// Small vial illustration: cap + label + glass.
export function MedVialIcon({ size = 56, colorIndex = 0 }: MedVialIconProps) {
  const accent = colors.med[colorIndex % colors.med.length] ?? colors.red;
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 56 68">
      <G>
        <Rect x="20" y="2" width="16" height="6" rx="1.5" fill={colors.ink} />
        <Rect x="18" y="8" width="20" height="4" rx="1" fill={colors.borderStrong} />
        <Path d="M 18 12 L 18 60 Q 18 64 22 64 L 34 64 Q 38 64 38 60 L 38 12 Z" fill={colors.surface} stroke={colors.border} strokeWidth="1" />
        <Rect x="20" y="26" width="16" height="22" fill="rgba(15,27,45,0.04)" />
        <Rect x="20" y="32" width="16" height="3" fill={accent} />
        <Rect x="20" y="38" width="16" height="1" fill={colors.ink} opacity={0.3} />
        <Rect x="20" y="42" width="16" height="1" fill={colors.ink} opacity={0.3} />
      </G>
    </Svg>
  );
}
