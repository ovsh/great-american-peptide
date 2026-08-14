import type { LevelPoint, LevelSeries } from '@/components/today-types';
import type { InjectionRow, MedicationRow } from '@/db/types';
import type { Unit } from '@/domain/peptides';
import {
  MIN_LEVEL_WINDOW_HOURS,
  estimatedLevelAt,
  suggestedLevelWindowHours,
  tmaxOrDefault,
} from '@/domain/pk';

/**
 * The estimated level as a drawable series, and the time window it is drawn in.
 *
 * This lived inside the Today screen until the paywall had to show the same
 * curve. Two screens that each build the curve their own way drift apart on the
 * first edit, and the curve is the one picture the user trusts, so both screens
 * read this module instead. The math itself stays in `src/domain/pk.ts`. Nothing
 * here decides anything: it samples the domain and shapes the result.
 */

const HOUR_MS = 60 * 60 * 1000;
const CURVE_STEPS_PAST = 100;
const CURVE_STEPS_FUTURE = 40;
/**
 * The run-up before the first shot, as a share of the history behind it. The
 * curve needs a little baseline to leave, and no more than that.
 */
const LEVEL_WINDOW_RUN_UP = 0.15;
/** The forecast tail when no next dose sets the right edge, as a share of the history drawn. */
const LEVEL_WINDOW_TAIL = 0.15;

/** The x range of the level chart. */
export interface LevelWindow {
  fromMs: number;
  toMs: number;
}

/**
 * Where the chart starts and where it ends.
 *
 * Ahead of now the chart draws to the next dose. With no next dose there is
 * nothing to draw toward, so it shows a fraction of the window instead and the
 * curve simply runs off the right edge, which is what it does. The fraction is
 * of the window actually drawn, so a short history does not put three days of
 * empty forecast next to one day of curve.
 */
export function levelWindow({
  injections,
  halfLifeHours,
  nextDoseAt,
  now,
}: {
  injections: readonly InjectionRow[];
  halfLifeHours: number | null;
  nextDoseAt: number | null;
  now: number;
}): LevelWindow {
  const fromMs = levelWindowFrom({
    injections,
    windowHours: suggestedLevelWindowHours(halfLifeHours),
    now,
  });
  return {
    fromMs,
    toMs: nextDoseAt ?? now + (now - fromMs) * LEVEL_WINDOW_TAIL,
  };
}

export function buildLevelSeries({
  injections,
  medication,
  now,
  fromMs,
  toMs,
  nextDoseAt,
}: {
  injections: readonly InjectionRow[];
  medication: MedicationRow;
  now: number;
  fromMs: number;
  toMs: number;
  nextDoseAt: number | null;
}): LevelSeries {
  const halfLife = medication.half_life_hours;
  // A medication with no half-life on file draws its shots instead of a curve.
  // Poke cannot model it, and saying so in a sentence shows nothing.
  if (halfLife === null || halfLife <= 0) {
    return {
      kind: 'shots',
      shots: injections
        .filter((injection) => injection.taken_at >= fromMs && injection.taken_at <= toMs)
        .map((injection) => injection.taken_at),
    };
  }
  if (injections.length === 0) return { kind: 'empty', nextDoseAt };

  const doses = injections
    .map((injection) => {
      const dose = doseIn(injection.dose, injection.unit, medication.default_unit);
      return dose === null ? null : { takenAt: injection.taken_at, dose };
    })
    .filter((dose): dose is { takenAt: number; dose: number } => dose !== null);
  if (doses.length === 0) return { kind: 'empty', nextDoseAt };

  const tmax = tmaxOrDefault(halfLife, medication.tmax_hours);
  const sample = (t: number): LevelPoint => ({
    t,
    v: estimatedLevelAt(doses, halfLife, tmax, t),
  });
  const past = seriesBetween(fromMs, now, CURVE_STEPS_PAST).map(sample);
  const future = toMs > now ? seriesBetween(now, toMs, CURVE_STEPS_FUTURE).map(sample) : [];

  return {
    kind: 'curve',
    past,
    future,
    current: estimatedLevelAt(doses, halfLife, tmax, now),
    nextDoseAt,
  };
}

/**
 * Where the level chart starts.
 *
 * Six half-lives is the right span for a medication that has been taken for a
 * while, and the wrong one for a medication whose first shot went in this
 * morning. Semaglutide asks for the full three weeks, so a user one shot into
 * it got twenty days of flat zero and the whole real curve squeezed into the
 * last few pixels under the now dot, which reads as a straight line with a
 * vertical jump at the end rather than as a level.
 *
 * So the window never opens long before the first shot. It keeps a short
 * run-up, enough to show the curve leaving the baseline, and it never shrinks
 * below a day, because the chart has to cover the day the user is looking at.
 * A full history is untouched: the six half-lives still win.
 */
function levelWindowFrom({
  injections,
  windowHours,
  now,
}: {
  injections: readonly InjectionRow[];
  windowHours: number;
  now: number;
}): number {
  const fullFrom = now - windowHours * HOUR_MS;
  const firstDoseAt = injections.reduce<number | null>(
    (earliest, injection) => (earliest === null ? injection.taken_at : Math.min(earliest, injection.taken_at)),
    null,
  );
  if (firstDoseAt === null) return fullFrom;
  // The run-up is a share of the history, not of the full window. A share of
  // the window would put forty hours of flat zero in front of a shot taken six
  // hours ago, which is the same bug in a smaller frame.
  const runUp = (now - firstDoseAt) * LEVEL_WINDOW_RUN_UP;
  const shortest = now - Math.min(windowHours, MIN_LEVEL_WINDOW_HOURS) * HOUR_MS;
  return Math.min(shortest, Math.max(fullFrom, firstDoseAt - runUp));
}

function seriesBetween(fromMs: number, toMs: number, steps: number): number[] {
  const out: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    out.push(fromMs + ((toMs - fromMs) * index) / steps);
  }
  return out;
}

/**
 * A logged shot keeps the unit it was logged in, and the curve adds numbers, so
 * they all have to be in the medication's unit before anything sums them. IU is
 * medication specific and converts to nothing, so that shot stays out.
 */
function doseIn(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value;
  if (from === 'mg' && to === 'mcg') return value * 1000;
  if (from === 'mcg' && to === 'mg') return value / 1000;
  return null;
}
