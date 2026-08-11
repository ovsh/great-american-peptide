import { motion } from '@/theme';

/**
 * Progress's one fun moment: the gap closes.
 *
 * It attaches to the action the screen exists for. A logged weight drains the
 * band, drops an amber dot onto the right end of the curve, and the last segment
 * springs out to meet it; the bracket that measures the distance to the goal
 * springs shorter behind it and re-reads. Last frame at six beats.
 *
 * The delays are multiples of `motion.beat` and nothing here is a typed
 * duration. They live beside the screen rather than in `src/theme/motion.ts`
 * only because Today's table is being edited by another hand this week; the
 * table is still the one source of the numbers.
 */
export const progressBeats = {
  /** The band drains and its label swaps. */
  band: 0,
  /** The amber dot starts falling. */
  drop: motion.beat,
  /** It lands, and the curve's last segment springs out to meet it. */
  curve: 4 * motion.beat,
  /** The goal bracket springs shorter and re-reads. */
  bracket: 5 * motion.beat,
} as const;

/** How far above the curve the logged weight starts its fall. */
export const DROP_HEIGHT = 48;
