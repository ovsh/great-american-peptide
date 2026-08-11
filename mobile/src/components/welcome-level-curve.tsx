import { useEffect, useMemo } from 'react';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { buildWelcomeCurve, type WelcomePin } from '@/components/welcome-curve-geometry';
import { colors, easing, motion, springTo, springs, timeTo, welcomeBeats } from '@/theme';

const HALO_R = 13;
const DOT_R = 5.5;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface WelcomeLevelCurveProps {
  width: number;
  height: number;
  /**
   * The foot of the headline block, in the same pixels as `height`. The tallest
   * peak is held below it. Zero or less falls back to the mock's proportion.
   */
  peakTop?: number;
  /**
   * False on a remount — the user stepped back into the poster — and false under
   * reduce motion. Either way the curve is already finished in frame one.
   */
  play: boolean;
}

/**
 * The welcome poster's hero: the level curve drawing itself left to right, with
 * a dose pin popping on each peak as the wipe reaches it.
 *
 * The draw is a curtain in the background's own colour sliding off to the right,
 * the same device Today's hero uses. It crosses at a constant rate (motion rule
 * 5) and every pin carries its own eased pop, which is what makes the shots read
 * as landing on the curve rather than travelling with it.
 *
 * The shape itself is in `welcome-curve-geometry.ts`.
 */
export function WelcomeLevelCurve({ width, height, peakTop = 0, play }: WelcomeLevelCurveProps) {
  const curve = useMemo(
    () => buildWelcomeCurve({
      width,
      height,
      // The geometry keeps the stroke below this line, and the pin on the
      // tallest peak sits on the stroke with its halo standing above it. The
      // halo is this file's invention, so this file pays for it — otherwise the
      // top pin would clear the words by the caller's margin minus 13 pixels.
      peakTop: peakTop > 0 ? peakTop + HALO_R : 0,
      drawDelayMs: welcomeBeats.curve,
      drawMs: motion.draw,
      beatMs: motion.beat,
    }),
    [height, peakTop, width],
  );
  const draw = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    draw.value = timeTo(1, {
      duration: motion.draw,
      easing: easing.linear,
      delay: welcomeBeats.curve,
      reduced: !play,
    });
  }, [draw, play]);

  const curtainProps = useAnimatedProps(() => ({
    x: draw.value * width,
    width: width * (1 - draw.value),
  }));

  if (curve === null) return null;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id="welcomeLevelFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.2} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {curve.gridYs.map((y) => (
        <Line key={y} x1={0} y1={y} x2={width} y2={y} stroke={colors.chartGrid} strokeWidth={1} />
      ))}

      {curve.pins.map((pin) => (
        <Line
          key={pin.x}
          x1={pin.x}
          y1={pin.y}
          x2={pin.x}
          y2={curve.baseY}
          stroke={colors.borderStrong}
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}

      <Path d={curve.area} fill="url(#welcomeLevelFill)" />
      <Path
        d={curve.line}
        stroke={colors.accent}
        strokeWidth={3.2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {curve.pins.map((pin) => (
        <DosePin key={pin.x} pin={pin} play={play} />
      ))}

      <AnimatedRect animatedProps={curtainProps} y={0} height={height} fill={colors.background} />
    </Svg>
  );
}

/**
 * One shot on one peak. The pop is a spring on the radius rather than a scale on
 * a group: it overshoots and comes back, which is the mock's `pinPop` exactly,
 * and it needs no transform origin to do it.
 */
function DosePin({ pin, play }: { pin: WelcomePin; play: boolean }) {
  const pop = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    pop.value = springTo(1, { config: springs.pop, delay: pin.delay, reduced: !play });
  }, [pin.delay, play, pop]);

  const haloProps = useAnimatedProps(() => ({ r: HALO_R * pop.value }));
  const dotProps = useAnimatedProps(() => ({ r: DOT_R * pop.value }));

  return (
    <>
      <AnimatedCircle
        animatedProps={haloProps}
        cx={pin.x}
        cy={pin.y}
        r={HALO_R}
        fill={colors.accent}
        fillOpacity={0.16}
      />
      <AnimatedCircle
        animatedProps={dotProps}
        cx={pin.x}
        cy={pin.y}
        r={DOT_R}
        fill={colors.accent}
        stroke={colors.surface}
        strokeWidth={2.5}
      />
    </>
  );
}
