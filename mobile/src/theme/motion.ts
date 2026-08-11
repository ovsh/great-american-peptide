import {
  Easing,
  withDelay,
  withSpring,
  withTiming,
  type EasingFunctionFactory,
  type WithSpringConfig,
} from 'react-native-reanimated';

/**
 * Every duration Today animates on, in one place.
 *
 * `fast`, `base` and `slow` are the app's own values and did not move. `press`,
 * `draw`, `beat` and `hold` come from the R3 "Calm" motion spec: `beat` is
 * `onboardingMotion.holdMs` reused as the stagger unit, so the log sequence and
 * the onboarding transition count in the same rhythm.
 *
 * `hold` is an input gate, not a duration. Nothing moves during it.
 */
export const motion = {
  /** Pointer-down feedback only. Half of `fast`, so a press registers before the finger settles. */
  press: 90,
  /** Micro: label swaps, chip tints, the lift, the press release. */
  fast: 150,
  /** Selection: focus switch, the curve morph between medications, a row settling. */
  base: 220,
  /** Content: the log curve redraw, rows parting, the celebration pulse. */
  slow: 320,
  /** The curve drawing itself on arrival. Once per mount. */
  draw: 460,
  /** The stagger unit. Every event in the log sequence lands on a multiple of it. */
  beat: 65,
  /** Long-press threshold before a row lifts. */
  hold: 250,
} as const;

/**
 * `standard` is `onboardingMotion.easing`, measured off the real recording.
 * `out` decelerates and belongs to entrances, `in` accelerates and belongs to
 * exits and to the shot dot falling onto the curve.
 */
export const easing = {
  standard: Easing.bezier(0.42, 0, 0.58, 1),
  out: Easing.bezier(0.2, 0.7, 0.3, 1),
  in: Easing.bezier(0.5, 0, 0.9, 0.4),
} as const;

/**
 * The three springs. `settle` is the soft overshoot — about 4 % past the target
 * and back — that the redrawn curve and every dropped row land with.
 */
export const springs = {
  settle: { damping: 20, stiffness: 180, mass: 1 },
  pop: { damping: 12, stiffness: 260, mass: 0.9 },
  lift: { damping: 24, stiffness: 300, mass: 1 },
} satisfies Record<string, WithSpringConfig>;

/** Where each event of the log sequence lands, on the beat grid: 0, 1, 4, 5, 6. */
export const logBeats = {
  /** Band fill and label swap. */
  band: 0,
  /** The shot dot starts falling. */
  drop: motion.beat,
  /** It lands, and the forecast springs upward out of it. */
  curve: 4 * motion.beat,
  /** The week-axis ring fills into a check, and one soft pulse leaves it. */
  mark: 5 * motion.beat,
  /** The streak, last. */
  streak: 6 * motion.beat,
} as const;

/**
 * Arrival, once per cold mount: four cards a beat apart, then the curve draws
 * itself and each axis mark pops as the wipe reaches its column. 460 ÷ 7
 * columns is 65.7 ms, which is the beat again. Last frame at 670 ms.
 */
export const arrivalBeats = {
  header: 0,
  hero: motion.beat,
  list: 2 * motion.beat,
  draw: 2 * motion.beat,
  axis: 2 * motion.beat,
  axisStep: motion.beat,
  track: 3 * motion.beat,
} as const;

/** How far a card travels on arrival, and how far the small header line does. */
export const rise = { card: 14, line: 8 } as const;

interface TimeOptions {
  duration: number;
  easing?: EasingFunctionFactory;
  delay?: number;
  /** True when the OS asks for less motion: the same state, reached in one frame. */
  reduced?: boolean;
}

/** `withTiming` on a token, with the delay and the reduced-motion collapse built in. */
export function timeTo(to: number, options: TimeOptions) {
  const { duration, delay = 0, reduced = false } = options;
  if (reduced) return withTiming(to, { duration: 0 });
  const animation = withTiming(to, { duration, easing: options.easing ?? easing.standard });
  return delay > 0 ? withDelay(delay, animation) : animation;
}

/** `withSpring` on one of the three configs, with the same two rules. */
export function springTo(
  to: number,
  options: { config: WithSpringConfig; delay?: number; reduced?: boolean },
) {
  const { config, delay = 0, reduced = false } = options;
  if (reduced) return withTiming(to, { duration: 0 });
  const animation = withSpring(to, config);
  return delay > 0 ? withDelay(delay, animation) : animation;
}

/** A delay that disappears entirely when the OS asks for less motion. */
export function beatDelay(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms;
}
