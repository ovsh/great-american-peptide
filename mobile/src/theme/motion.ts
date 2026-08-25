import {
  Easing,
  withDelay,
  withSpring,
  withTiming,
  type EasingFunction,
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
  /**
   * The metronome. Motion rule 5 already says an arrival wipe crosses its axis
   * at a constant rate and that the easing belongs to whatever pops out of it,
   * so the rate the rule names now has a token instead of a literal.
   */
  linear: Easing.linear,
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

/**
 * The welcome poster's arrival, once per cold run of the app.
 *
 * The approved mock counts in seconds — the curve alone strokes for 1.55 s and
 * the button lands at 2.18 s. That is a web comp's pace, not Poke's: rule 3
 * caps an arrival at 700 ms. The order of the mock survives the compression and
 * the seconds do not. The curve still draws first and the words still land on
 * top of it.
 *
 * The dose pins are not listed here because their delays are geometry: each one
 * pops on the first beat after the wipe has uncovered it, which is why the mock
 * reads as the shots landing on the curve rather than beside it.
 *
 * The CTA and the (i) caption take no delay at all. The primary action is a
 * permanent slot (principles rule 4) and legal copy does not move (motion rule
 * 8), so both are already there in frame one. Last timed frame: 675 ms.
 */
export const welcomeBeats = {
  /** The wordmark, with the screen. */
  wordmark: 0,
  /** The level curve starts drawing itself left to right. */
  curve: motion.beat,
  /** The first headline line rises out of its own clip. */
  headline: 4 * motion.beat,
  /** The second line follows one beat later, so the two read as one sentence. */
  headlineStep: motion.beat,
  /** The support line under the headline. */
  support: 6 * motion.beat,
  /** The proof card, last. */
  proof: 7 * motion.beat,
} as const;

/**
 * The plan reveal, once per cold mount of the last onboarding screen.
 *
 * The order builds to the curve, which sits at the top of the screen as the
 * hero: first the date, then the bar the date is measured on, then the fill
 * and the dot that ride it, and the curve strokes in last as the finale.
 * The fill does not overshoot. Everywhere else a soft overshoot reads as life,
 * and here the right end of the bar is the goal weight, so a bar that ran past
 * it and came back would be a claim. Last frame at 655 ms.
 */
export const planBeats = {
  /** The card label fades and the date rises out of its own clip. */
  date: 0,
  /** The empty track rises under it. */
  bar: motion.beat,
  /** The fill grows from the left, with the pace dot on its edge. */
  fill: 2 * motion.beat,
  /** The level curve draws itself, left to right, once. */
  curve: 3 * motion.beat,
} as const;

/** How far a card travels on arrival, and how far the small header line does. */
export const rise = { card: 14, line: 8 } as const;

interface TimeOptions {
  duration: number;
  /** A bezier from the table returns a factory; `linear` is the bare function. */
  easing?: EasingFunction | EasingFunctionFactory;
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
