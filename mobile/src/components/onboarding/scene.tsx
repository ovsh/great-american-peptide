import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { motion, spacing, springTo, timeTo } from '@/theme';

/**
 * The pieces every onboarding interstitial scene is drawn from.
 *
 * The scenes are ports of the approved HTML prototypes, so this module exists
 * for the same reason `today-motion.tsx` does: six scenes share one entrance
 * vocabulary, and a vocabulary that is written twice drifts once. Nothing here
 * carries a number of its own — every duration, easing and spring arrives from
 * `src/theme/motion.ts`, which is the one table both the prototype and this
 * port read.
 *
 * Two rules shape the API:
 *
 * 1. **Geometry animates, groups do not.** `react-native-svg` hands a group's
 *    transform to native as a matrix, so a Reanimated worklet cannot write it.
 *    Anything that only fades, draws or grows therefore animates its own props
 *    (`opacity`, `strokeDashoffset`, `r`, `cx`, `x2`) inside one `SceneBase`
 *    surface, exactly as `welcome-level-curve.tsx` springs a pin's radius.
 *    Anything that must travel or scale about its own centre gets a
 *    `SceneLayer`: its own small `Svg`, cropped to its box, inside an
 *    `Animated.View` that RN can transform natively.
 * 2. **Reduce motion is the same frame, reached at once.** `useCue` starts at
 *    the finished value under the setting, so a reduced-motion user never sees
 *    a stagger, a faster stagger, or a blank scene.
 */

export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedLine = Animated.createAnimatedComponent(Line);
export const AnimatedPath = Animated.createAnimatedComponent(Path);
export const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The prototypes are all drawn 264 units wide, so the ports are too. */
export const SCENE_WIDTH = 264;

export interface SceneFrame {
  /** Painted width in points. */
  width: number;
  /** Painted height in points. */
  height: number;
  /** Points per viewBox unit. A layer's travel is measured in units, not points. */
  unit: number;
  vbWidth: number;
  vbHeight: number;
}

/** A box in viewBox units. A `SceneLayer` crops its own `Svg` to one. */
export interface SceneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The scene at its drawn size, or narrower on a small phone. Never wider: a
 * scene that grows past its prototype stops matching the type beside it.
 */
export function useSceneFrame(vbWidth: number, vbHeight: number): SceneFrame {
  const { width: screen } = useWindowDimensions();
  return useMemo(() => {
    const width = Math.min(vbWidth, screen - 2 * spacing.screen);
    const unit = width / vbWidth;
    return { width, height: vbHeight * unit, unit, vbWidth, vbHeight };
  }, [screen, vbHeight, vbWidth]);
}

/**
 * The scene's own box. It reads to a screen reader as one image with one
 * description, because the parts of a drawing are not separately meaningful.
 */
export function Scene({
  frame,
  label,
  children,
}: {
  frame: SceneFrame;
  label: string;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.scene, { width: frame.width, height: frame.height }]}
    >
      {children}
    </View>
  );
}

/** The surface everything that only fades, draws or grows is painted on. */
export function SceneBase({ frame, children }: { frame: SceneFrame; children: ReactNode }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={frame.width}
      height={frame.height}
      viewBox={`0 0 ${frame.vbWidth} ${frame.vbHeight}`}
    >
      {children}
    </Svg>
  );
}

/**
 * One piece of the scene that has to travel or scale about its own centre.
 *
 * The piece keeps the scene's coordinates — the `viewBox` is the box, not the
 * origin — so a ported shape is copied out of the prototype unchanged.
 */
export function SceneLayer({
  frame,
  box,
  style,
  children,
}: {
  frame: SceneFrame;
  box: SceneBox;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { unit } = frame;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          left: box.x * unit,
          top: box.y * unit,
          width: box.width * unit,
          height: box.height * unit,
        },
        style,
      ]}
    >
      <Svg
        width={box.width * unit}
        height={box.height * unit}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      >
        {children}
      </Svg>
    </Animated.View>
  );
}

/**
 * One event on the beat grid: when it starts, and how it moves.
 *
 * `delay` is always written as a multiple of `motion.beat` in the screen's own
 * `*Beats` object, never as a number here.
 */
export interface Cue {
  delay: number;
  /** A duration token. Ignored when `spring` is set. */
  duration?: number;
  easing?: EasingFunction | EasingFunctionFactory;
  /** A spring from the table, for a mark that lands rather than arrives. */
  spring?: WithSpringConfig;
}

/**
 * A cue as a 0-to-1 shared value, played once per mount.
 *
 * Under reduce motion it starts at 1 and `timeTo` finishes it in one frame, so
 * the first painted frame is the last frame of the sequence.
 */
export function useCue(cue: Cue, reduced: boolean): SharedValue<number> {
  const { delay, duration, spring } = cue;
  const ease = cue.easing;
  const value = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    value.value = spring
      ? springTo(1, { config: spring, delay, reduced })
      : timeTo(1, { duration: duration ?? motion.base, easing: ease, delay, reduced });
  }, [delay, duration, ease, reduced, spring, value]);

  return value;
}

/** Opacity, for anything on a `SceneBase`. */
export function useFade(cue: SharedValue<number>) {
  return useAnimatedProps(() => ({ opacity: cue.value }));
}

/**
 * A stroke drawing itself. The element carries `strokeDasharray={length}`, and
 * this walks the offset from one whole length back to zero.
 */
export function useDraw(cue: SharedValue<number>, length: number) {
  return useAnimatedProps(() => ({ strokeDashoffset: length * (1 - cue.value) }));
}

/** A `SceneLayer` arriving from `distance` viewBox units away. */
export function useTravel(cue: SharedValue<number>, frame: SceneFrame, distance: number) {
  const points = distance * frame.unit;
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, cue.value),
    transform: [{ translateX: (1 - cue.value) * points }],
  }));
}

/** A `SceneLayer` rising into place. `rise.card` and `rise.line` are the two distances. */
export function useLift(cue: SharedValue<number>, frame: SceneFrame, distance: number) {
  const points = distance * frame.unit;
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, cue.value),
    transform: [{ translateY: (1 - cue.value) * points }],
  }));
}

/**
 * A `SceneLayer` popping about its own centre, from `from` to full size.
 *
 * The opacity is clamped because a `pop` spring overshoots by about a tenth,
 * and an opacity above one is a warning rather than a brighter mark. The scale
 * keeps the overshoot: that is the whole point of the spring.
 */
export function usePop(cue: SharedValue<number>, from = 0.4) {
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, cue.value),
    transform: [{ scale: from + (1 - from) * cue.value }],
  }));
}

const styles = StyleSheet.create({
  scene: {
    alignSelf: 'center',
  },
  layer: {
    position: 'absolute',
  },
});
