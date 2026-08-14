import type { LevelPoint, LevelSeries } from '@/components/today-types';
import type { InjectionRow, MedicationRow } from '@/db/types';
import {
  blendCurveParts,
  blendLevelAt,
  parseComposition,
  type BlendCurvePart,
} from '@/domain/blends';
import { getPreset, isBlend, type Unit } from '@/domain/peptides';
import {
  MIN_LEVEL_WINDOW_HOURS,
  estimatedLevelAt,
  suggestedLevelWindowHours,
  tmaxOrDefault,
  type DoseEvent,
} from '@/domain/pk';
import { endOfDay, startOfDay } from '@/utils/date';

/**
 * The estimated level as a drawable series, and the time window it is drawn in.
 *
 * This lived inside the Today screen until the paywall had to show the same
 * curve. Two screens that each build the curve their own way drift apart on the
 * first edit, and the curve is the one picture the user trusts, so both screens
 * read this module instead. The math itself stays in `src/domain/pk.ts`. Nothing
 * here decides anything: it samples the domain and shapes the result.
 *
 * Today draws `weekWindow`, which is the same seven days the axis under the
 * chart labels, so a feature in the curve sits over the day it happened on. The
 * left edge of that window is not a zero baseline: `estimatedLevelAt` sums every
 * dose taken at or before the sampled time, including doses before `fromMs`, so
 * the curve starts at the true residual left by earlier shots.
 *
 * The paywall keeps `levelWindow`, the six half-life span, because it has no day
 * axis under it and the whole decay is the picture it sells.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Three days behind today and three ahead: the week the axis draws. */
export const WEEK_LOOKBACK_DAYS = 3;
const WEEK_DAYS = 7;
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
 * The seven days the week axis draws, from the first column's midnight to the
 * last column's last millisecond. The hero chart is drawn in this window, so the
 * two cannot drift: one function states the range, the axis and the curve both
 * read it.
 *
 * The days are stepped on a `Date` rather than added in milliseconds, because a
 * day across a daylight-saving change is not 24 hours and the axis steps the
 * same way.
 */
export function weekWindow(now: number): LevelWindow {
  const first = new Date(startOfDay(now));
  first.setDate(first.getDate() - WEEK_LOOKBACK_DAYS);
  const last = new Date(startOfDay(now));
  last.setDate(last.getDate() + (WEEK_DAYS - 1 - WEEK_LOOKBACK_DAYS));
  return { fromMs: startOfDay(first.getTime()), toMs: endOfDay(last.getTime()) };
}

/**
 * Where the chart starts and where it ends.
 *
 * Ahead of now the chart draws to the next dose. With no next dose there is
 * nothing to draw toward, so it shows a fraction of the window instead and the
 * curve simply runs off the right edge, which is what it does. The fraction is
 * of the window actually drawn, so a short history does not put three days of
 * empty forecast next to one day of curve.
 *
 * The doses are the converted list, not the raw rows, because a shot the curve
 * cannot add is a shot the window must not open for.
 */
export function levelWindow({
  doses,
  halfLifeHours,
  nextDoseAt,
  now,
}: {
  doses: readonly DoseEvent[];
  halfLifeHours: number | null;
  nextDoseAt: number | null;
  now: number;
}): LevelWindow {
  const fromMs = levelWindowFrom({
    doses,
    windowHours: suggestedLevelWindowHours(halfLifeHours),
    now,
  });
  return {
    fromMs,
    toMs: nextDoseAt ?? now + (now - fromMs) * LEVEL_WINDOW_TAIL,
  };
}

/**
 * The parts a blend medication can draw, or null when it draws none.
 *
 * Null covers every quiet way the curve can be off: not a preset, not a blend,
 * no composition entered, or a composition whose parts all lack a half-life.
 * The window sizing on the paywall and the estimate sheet on Today read this
 * too, so all three answer "does this blend draw" the same way.
 */
export function blendCurvePartsFor(medication: MedicationRow): BlendCurvePart[] | null {
  if (!medication.preset_id) return null;
  const preset = getPreset(medication.preset_id);
  if (!preset || !isBlend(preset)) return null;
  const composition = parseComposition(medication.composition);
  if (!composition) return null;
  const parts = blendCurveParts(preset, composition);
  return parts.length > 0 ? parts : null;
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
  // A blend has no half-life of its own, but a vial label makes it drawable:
  // each part falls at its sourced rate and the curve is the sum.
  const blendPartsToDraw = halfLife === null ? blendCurvePartsFor(medication) : null;
  if (blendPartsToDraw) {
    return sampledCurve({
      injections,
      medication,
      now,
      fromMs,
      toMs,
      nextDoseAt,
      levelAt: (doses, t) => blendLevelAt(blendPartsToDraw, doses, t),
    });
  }
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
  const tmax = tmaxOrDefault(halfLife, medication.tmax_hours);
  return sampledCurve({
    injections,
    medication,
    now,
    fromMs,
    toMs,
    nextDoseAt,
    levelAt: (doses, t) => estimatedLevelAt(doses, halfLife, tmax, t),
  });
}

/**
 * The sampling both curves share. The single medication and the blend differ
 * only in what the level at one moment is, so that difference arrives as a
 * function and everything about steps and windows stays written once.
 */
function sampledCurve({
  injections,
  medication,
  now,
  fromMs,
  toMs,
  nextDoseAt,
  levelAt,
}: {
  injections: readonly InjectionRow[];
  medication: MedicationRow;
  now: number;
  fromMs: number;
  toMs: number;
  nextDoseAt: number | null;
  levelAt: (doses: DoseEvent[], atMs: number) => number;
}): LevelSeries {
  if (injections.length === 0) return { kind: 'empty', nextDoseAt };

  const doses = convertedDoses(injections, medication);
  if (doses.length === 0) return { kind: 'empty', nextDoseAt };

  const sample = (t: number): LevelPoint => ({ t, v: levelAt(doses, t) });
  const past = seriesBetween(fromMs, now, CURVE_STEPS_PAST).map(sample);
  const future = toMs > now ? seriesBetween(now, toMs, CURVE_STEPS_FUTURE).map(sample) : [];

  return {
    kind: 'curve',
    past,
    future,
    current: levelAt(doses, now),
    nextDoseAt,
  };
}

/**
 * The logged shots as doses the curve can add, in the medication's own unit.
 *
 * A row whose unit does not convert is dropped here, and it has to be dropped
 * before the window is chosen as well: an old IU row that the curve never sums
 * would otherwise pull the left edge back over weeks of flat zero.
 */
export function convertedDoses(
  injections: readonly InjectionRow[],
  medication: MedicationRow,
): DoseEvent[] {
  return injections
    .map((injection) => {
      const dose = doseIn(injection.dose, injection.unit, medication.default_unit);
      return dose === null ? null : { takenAt: injection.taken_at, dose };
    })
    .filter((dose): dose is DoseEvent => dose !== null);
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
  doses,
  windowHours,
  now,
}: {
  doses: readonly DoseEvent[];
  windowHours: number;
  now: number;
}): number {
  const fullFrom = now - windowHours * HOUR_MS;
  const firstDoseAt = doses.reduce<number | null>(
    (earliest, dose) => (earliest === null ? dose.takenAt : Math.min(earliest, dose.takenAt)),
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
