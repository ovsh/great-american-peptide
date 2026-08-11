import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { easing, motion, springTo, springs, timeTo } from '@/theme';

/** What every hook here hands back: a style a view can be given. */
export type MotionStyle = AnimatedStyle<ViewStyle>;

/**
 * The pieces every Today animation is built from. They exist here rather than in
 * each component because the same press, the same swap and the same tint happen
 * in four places, and a token that is read twice is a token that drifts once.
 *
 * Every one of them collapses to an instant state change when the OS asks for
 * less motion. Nothing is removed from the screen; the same state is reached in
 * one frame.
 */

/**
 * Press feedback: down in `press`, back up on the `lift` spring, so a tap feels
 * answered and a release feels forgiving.
 */
export function usePressScale(target = 0.97): {
  pressed: SharedValue<number>;
  style: MotionStyle;
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = timeTo(1, { duration: motion.press, easing: easing.out, reduced });
  }, [pressed, reduced]);

  const onPressOut = useCallback(() => {
    pressed.value = springTo(0, { config: springs.lift, reduced });
  }, [pressed, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (target - 1) * pressed.value }],
  }));

  return { pressed, style, onPressIn, onPressOut };
}

/** A Pressable that scales under the finger, with the press styles left alone. */
export function PressScale({
  target,
  style,
  children,
}: {
  target?: number;
  style?: StyleProp<ViewStyle>;
  children: (handlers: { onPressIn: () => void; onPressOut: () => void }) => ReactNode;
}) {
  const press = usePressScale(target);
  return (
    <Animated.View style={[style, press.style]}>
      {children({ onPressIn: press.onPressIn, onPressOut: press.onPressOut })}
    </Animated.View>
  );
}

/**
 * The arrival rise: a card that is not there, then is, on its beat. It plays on
 * the mount that first turns `show` true and never again, so coming back to the
 * tab does not replay the screen.
 */
export function TodayRise({
  show,
  delay,
  distance,
  style,
  children,
}: {
  show: boolean;
  delay: number;
  distance: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(show && reduced ? 1 : 0);
  const played = useRef(false);

  useEffect(() => {
    if (!show || played.current) return;
    played.current = true;
    progress.value = timeTo(1, {
      duration: distance > 10 ? motion.base : motion.fast,
      easing: easing.out,
      delay,
      reduced,
    });
  }, [delay, distance, progress, reduced, show]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * An overlapping crossfade between two contents that occupy the same place: the
 * old one leaves on `in`, the new one arrives on `out` from the other side, and
 * the content itself swaps at `swapAt` while nothing is on screen.
 *
 * The caller keeps a plain snapshot of what it draws — a name, a label — rather
 * than a node, so the outgoing content is the one that was there.
 */
export function useSwapTransition<T>(
  next: T,
  id: string,
  {
    swapAt,
    axis = 'y',
    distance = 6,
    out = motion.fast,
  }: { swapAt: number; axis?: 'x' | 'y'; distance?: number; out?: number },
): { shown: T; style: MotionStyle } {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(next);
  const started = useRef(id);
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (started.current === id) return;
    started.current = id;
    if (reduced) {
      setShown(next);
      return;
    }
    opacity.value = timeTo(0, { duration: out, easing: easing.in });
    offset.value = timeTo(-distance, { duration: out, easing: easing.in });
    const timer = setTimeout(() => {
      setShown(next);
      offset.value = distance;
      opacity.value = timeTo(1, { duration: motion.base, easing: easing.out });
      offset.value = timeTo(0, { duration: motion.base, easing: easing.out });
    }, swapAt);
    return () => clearTimeout(timer);
  }, [distance, id, next, offset, opacity, out, reduced, swapAt]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [axis === 'x' ? { translateX: offset.value } : { translateY: offset.value }],
  }));

  return { shown, style };
}

/**
 * A colour that moves rather than cuts: the medication tint under the hero dot,
 * the curve stroke, the band fill. Paint only, so it costs no layout.
 */
export function useTint(color: string, duration = motion.base): SharedValue<string> {
  const reduced = useReducedMotion();
  const from = useSharedValue(color);
  const to = useSharedValue(color);
  const progress = useSharedValue(1);
  const current = useRef(color);

  useEffect(() => {
    if (current.current === color) return;
    from.value = current.current;
    current.current = color;
    to.value = color;
    progress.value = 0;
    progress.value = timeTo(1, { duration, easing: easing.standard, reduced });
  }, [color, duration, from, progress, reduced, to]);

  return useDerivedValue(() => interpolateColor(progress.value, [0, 1], [from.value, to.value]));
}
