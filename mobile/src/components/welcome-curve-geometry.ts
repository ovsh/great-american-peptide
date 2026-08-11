import { estimatedLevelAt, type DoseEvent } from '@/domain/pk';

/**
 * The welcome poster's curve, as numbers.
 *
 * Kept clear of react-native-svg and Reanimated for the same reason
 * `progress-geometry.ts` is: the shape of the drawing is the part worth reading
 * on its own, and a pure module can be run and checked without a simulator.
 */

const HOUR_MS = 60 * 60 * 1000;

/**
 * The shape, and only the shape.
 *
 * Four shots a week apart, drawn by `estimatedLevelAt` — the same function that
 * draws Today's hero — so what a first-time reader sees on the welcome screen is
 * the curve the app will actually draw for them, not an illustrator's idea of
 * one. A week's half-life against a weekly interval is the textbook case: each
 * dose lands on half of the one before it, so the saw-tooth climbs and then
 * holds. Nothing here is anybody's data, no number is printed, and the dose is 1
 * of nothing: the y-axis is normalised away before it reaches the screen.
 *
 * The lead-in and the tail are framing, not pharmacology. The lead-in keeps the
 * first pin's halo off the left edge. The tail is a whole interval because half
 * of one is worse than none: the drawing would stop in the middle of a fall and
 * the fill would end on a wall of colour at the frame edge. Given the interval,
 * the last dose decays exactly as far as its three predecessors did, which is
 * the point — the saw-tooth climbs and then holds.
 */
const DOSE_COUNT = 4;
const INTERVAL_HOURS = 7 * 24;
const HALF_LIFE_HOURS = 7 * 24;
const LEAD_IN_HOURS = 40;
const TAIL_HOURS = INTERVAL_HOURS;
const SAMPLES = 180;

/**
 * Where the drawing sits inside its box, as fractions of the height, taken off
 * the approved mock so the composition survives every screen size: the baseline
 * near the floor, the tallest peak just under half way, and three faint rules a
 * sixth of the height apart.
 *
 * The peak is a default, not a rule. The headline sits on the canvas rather than
 * above it, and the whole composition rests on the peaks staying clear of the
 * words — so the caller passes the measured foot of the headline block and the
 * curve keeps under it. On a small phone the words take more of the box and the
 * curve gives way; the clamp stops it giving away so much that it flattens.
 */
const BASELINE_Y = 0.955;
const PEAK_Y = 0.47;
const PEAK_Y_MIN = 0.3;
const PEAK_Y_MAX = 0.64;
const GRID_STEP_Y = 0.17;
const GRID_LINES = 3;

export interface WelcomePin {
  x: number;
  y: number;
  /** The first beat after the wipe has uncovered this pin. */
  delay: number;
}

export interface WelcomeCurve {
  line: string;
  area: string;
  pins: WelcomePin[];
  gridYs: number[];
  baseY: number;
}

export interface WelcomeCurveInput {
  width: number;
  height: number;
  /** The foot of the headline block. Zero or less falls back to the mock's proportion. */
  peakTop: number;
  /** When the wipe starts, how long it runs, and the grid it counts on. */
  drawDelayMs: number;
  drawMs: number;
  beatMs: number;
}

export function buildWelcomeCurve({
  width,
  height,
  peakTop,
  drawDelayMs,
  drawMs,
  beatMs,
}: WelcomeCurveInput): WelcomeCurve | null {
  if (width <= 0 || height <= 0) return null;

  const doses: DoseEvent[] = Array.from({ length: DOSE_COUNT }, (_, index) => ({
    takenAt: index * INTERVAL_HOURS * HOUR_MS,
    dose: 1,
  }));

  const fromMs = -LEAD_IN_HOURS * HOUR_MS;
  const toMs = ((DOSE_COUNT - 1) * INTERVAL_HOURS + TAIL_HOURS) * HOUR_MS;
  const span = toMs - fromMs;
  const levelAt = (at: number) => estimatedLevelAt(doses, HALF_LIFE_HOURS, 0, at);

  // A uniform grid, plus the instant of each shot and the instant before it. The
  // rise at a dose is a step, and without those two samples the polyline would
  // cut the corner off it and leave the pin floating above its own peak.
  const times: number[] = [];
  for (let index = 0; index <= SAMPLES; index += 1) {
    times.push(fromMs + (span * index) / SAMPLES);
  }
  for (const dose of doses) {
    times.push(dose.takenAt - 1, dose.takenAt);
  }
  times.sort((a, b) => a - b);

  const peak = levelAt(doses[doses.length - 1]?.takenAt ?? 0);
  const baseY = height * BASELINE_Y;
  const wanted = peakTop > 0 ? peakTop / height : PEAK_Y;
  const topY = height * Math.min(Math.max(wanted, PEAK_Y_MIN), PEAK_Y_MAX);
  const xFor = (at: number) => ((at - fromMs) / span) * width;
  const yFor = (level: number) => baseY - (level / peak) * (baseY - topY);

  let line = '';
  for (const [index, at] of times.entries()) {
    line += `${index === 0 ? 'M' : ' L'} ${xFor(at).toFixed(1)} ${yFor(levelAt(at)).toFixed(1)}`;
  }

  const pins: WelcomePin[] = doses.map((dose) => {
    const x = xFor(dose.takenAt);
    // The wipe crosses at a constant rate, so where a pin sits says when it is
    // uncovered. Rounded up to the beat grid, never down: a pin that popped
    // early would already be standing there when the curtain passed it.
    const uncoveredAt = drawDelayMs + drawMs * (x / width);
    return {
      x,
      y: yFor(levelAt(dose.takenAt)),
      delay: Math.ceil(uncoveredAt / beatMs) * beatMs,
    };
  });

  const gridYs = Array.from({ length: GRID_LINES }, (_, index) => baseY - index * height * GRID_STEP_Y)
    .filter((y) => y > 0);

  return {
    line,
    area: `${line} L ${width.toFixed(1)} ${baseY.toFixed(1)} L 0 ${baseY.toFixed(1)} Z`,
    pins,
    gridYs,
    baseY,
  };
}
