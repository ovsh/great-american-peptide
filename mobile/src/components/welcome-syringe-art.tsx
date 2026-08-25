import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * The drawing's own coordinates. Everything below is written in this box and the
 * `viewBox` scales it, so one set of numbers survives every phone width. The
 * curve beside it measures its own box instead, because a curve is geometry and
 * this is a picture.
 *
 * The box stands rather than lies down. A welcome slide leaves a tall hole under
 * two lines of words, and a wide drawing would float in the middle of it at half
 * the size, so the syringe stands up and the vial stands beside it.
 */
const VB_WIDTH = 288;
const VB_HEIGHT = 304;

/** The middle of the barrel, and the line the needle runs down. */
const AXIS_X = 108;

/** Where the draw stops. The one thing the picture is about. */
const MARK_Y = 134;

/** The pin on the mark is the level curve's pin, at the same two radii. */
const HALO_R = 13;
const DOT_R = 6;

/** Nine plain rules down the barrel. The picture carries no scale and no unit. */
const TICKS = Array.from({ length: 9 }, (_, index) => 76 + index * 18);

interface WelcomeSyringeArtProps {
  width: number;
  height: number;
}

/**
 * Slide two's picture: a syringe with the draw mark lit, and the vial it came
 * from.
 *
 * There is no number anywhere in it, and there is no scale the reader could
 * count off either. Poke never proposes a dose, so a drawing of a syringe that
 * carried a printed volume would be the app answering a question the user has
 * not asked yet. The mark says where the draw stops, and the app says how far
 * once the user has typed a vial and a volume of water.
 *
 * The pin on the mark is the same halo and dot the welcome level curve puts on a
 * shot, so the two pictures name the same event with the same mark.
 */
export function WelcomeSyringeArt({ width, height }: WelcomeSyringeArtProps) {
  if (width <= 0 || height <= 0) return null;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} pointerEvents="none">
      {/* Thumb rest, rod, and the flange the two fingers pull against. */}
      <Rect x={72} y={14} width={72} height={11} rx={5.5} fill={colors.inkSubtle} />
      <Rect x={102} y={25} width={12} height={32} rx={6} fill={colors.inkSubtle} />
      <Rect x={68} y={52} width={80} height={11} rx={5.5} fill={colors.inkSubtle} />

      <Rect
        x={80}
        y={60}
        width={56}
        height={182}
        rx={14}
        fill={colors.surface}
        stroke={colors.borderStrong}
        strokeWidth={2.5}
      />
      {/* The draw sits at the needle end, so it fills down from the mark. */}
      <Rect
        x={84}
        y={MARK_Y}
        width={48}
        height={238 - MARK_Y}
        rx={10}
        fill={colors.accent}
        fillOpacity={0.3}
      />

      {TICKS.map((y, index) => (
        <Line
          key={y}
          x1={80}
          y1={y}
          x2={index % 4 === 0 ? 100 : 92}
          y2={y}
          stroke={colors.borderStrong}
          strokeWidth={1.5}
        />
      ))}

      <Rect x={98} y={242} width={20} height={18} rx={4} fill={colors.inkSubtle} />
      <Line
        x1={AXIS_X}
        y1={260}
        x2={AXIS_X}
        y2={292}
        stroke={colors.inkSubtle}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* The vial the draw came out of. */}
      <Rect x={190} y={118} width={44} height={18} rx={6} fill={colors.inkSubtle} />
      <Rect
        x={184}
        y={136}
        width={56}
        height={114}
        rx={14}
        fill={colors.surface}
        stroke={colors.borderStrong}
        strokeWidth={2.5}
      />
      <Rect x={188} y={190} width={48} height={56} rx={11} fill={colors.accent} fillOpacity={0.3} />

      {/* The mark, last, so it sits over the barrel and the rules alike. */}
      <Line
        x1={62}
        y1={MARK_Y}
        x2={154}
        y2={MARK_Y}
        stroke={colors.accent}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Circle cx={62} cy={MARK_Y} r={HALO_R} fill={colors.accent} fillOpacity={0.16} />
      <Circle
        cx={62}
        cy={MARK_Y}
        r={DOT_R}
        fill={colors.accent}
        stroke={colors.surface}
        strokeWidth={2.5}
      />
    </Svg>
  );
}
