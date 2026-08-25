import Svg, { Circle, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * The drawing's own coordinates, scaled by the `viewBox`. The box stands rather
 * than lies down, for the reason the syringe gives.
 */
const VB_WIDTH = 288;
const VB_HEIGHT = 314;

/** The reminder, over the plan and clear of it. */
const BANNER = { x: 32, y: 16, width: 224, height: 64 } as const;

/** The card the plan sits on. */
const CARD = { x: 24, y: 126, width: 240, height: 172 } as const;

/** Seven days, evenly inset in the card. */
const DAY_COUNT = 7;
const DAY_X = 43;
const DAY_STEP = 30;
const DAY_Y = 200;
const DAY_SIZE = 22;

/** Which day carries the next shot. */
const NEXT_DAY = 3;
const NEXT_HALO_R = 19;

interface WelcomePlanArtProps {
  width: number;
  height: number;
}

/**
 * Slide three's picture: one reminder arriving over the plan, and the plan with
 * the next shot marked on it.
 *
 * The card carries bars rather than words for the same reason the log scene
 * does: a drawn medication name would be a name Poke made up, and a drawn dose
 * would be a number. The bars stand for the rows the app already holds.
 *
 * The banner says as much as a real Poke reminder says on a locked phone, which
 * is a shape and no name. That is the claim the sentence under it makes, so the
 * picture has to keep it too.
 */
export function WelcomePlanArt({ width, height }: WelcomePlanArtProps) {
  if (width <= 0 || height <= 0) return null;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} pointerEvents="none">
      <Rect
        x={BANNER.x}
        y={BANNER.y}
        width={BANNER.width}
        height={BANNER.height}
        rx={20}
        fill={colors.surface}
        stroke={colors.borderStrong}
        strokeWidth={1.5}
      />
      <Rect x={52} y={32} width={32} height={32} rx={10} fill={colors.accent} />
      <Rect x={98} y={34} width={104} height={10} rx={5} fill={colors.ink} fillOpacity={0.22} />
      <Rect x={98} y={52} width={72} height={9} rx={4.5} fill={colors.ink} fillOpacity={0.12} />

      <Rect
        x={CARD.x}
        y={CARD.y}
        width={CARD.width}
        height={CARD.height}
        rx={24}
        fill={colors.surface}
        stroke={colors.accent}
        strokeOpacity={0.18}
        strokeWidth={1.5}
      />

      <Rect x={48} y={150} width={96} height={10} rx={5} fill={colors.accent} fillOpacity={0.38} />

      <Circle
        cx={DAY_X + NEXT_DAY * DAY_STEP + DAY_SIZE / 2}
        cy={DAY_Y + DAY_SIZE / 2}
        r={NEXT_HALO_R}
        fill={colors.accent}
        fillOpacity={0.16}
      />
      {Array.from({ length: DAY_COUNT }, (_, index) => {
        const x = DAY_X + index * DAY_STEP;
        const next = index === NEXT_DAY;
        return (
          <Rect
            key={x}
            x={x}
            y={DAY_Y}
            width={DAY_SIZE}
            height={DAY_SIZE}
            rx={DAY_SIZE / 2}
            fill={next ? colors.accent : colors.accentSoft}
            stroke={next ? colors.accent : colors.border}
            strokeWidth={1}
          />
        );
      })}

      <Rect x={48} y={264} width={140} height={10} rx={5} fill={colors.accent} fillOpacity={0.18} />
    </Svg>
  );
}
