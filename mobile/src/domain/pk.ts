// Estimated level model for logged injections.
//
// The user-facing "level" is a half-life load estimate in dose units:
//   L(t) = D · exp(-ke·t)
//
// That means a newly logged 2 mg shot starts as 2 mg and then decays by the
// medication's elimination half-life. This is the behavior most users expect
// from a half-life chart.
//
// We still expose a one-compartment first-order absorption + first-order
// elimination model (Bateman equation) for cases where we want a plasma-like
// curve that rises toward Tmax after SC/IM injection.
//
// C(t) = D · ka / (ka − ke) · (exp(−ke·t) − exp(−ka·t))
//
// Where ke = ln2/halfLife and ka = ln2/absorptionHalfLife. The absorption
// half-life is derived from the published Tmax via:
//   t_max = ln(ka/ke) / (ka − ke)
// We invert this numerically; for the typical case ka ≫ ke, t_max ≈ ln(ka/ke)/ka,
// so absorption_half_life ≈ t_max · ln(2) / ln(ka/ke).
//
// Bioavailability and volume of distribution are intentionally not modeled, so
// all outputs are trend estimates only and should not be used for dosing.

export interface DoseEvent {
  takenAt: number;
  dose: number;
}

const LN2 = Math.log(2);
const HOUR_MS = 60 * 60 * 1000;

export function eliminationRatePerHour(halfLifeHours: number): number {
  return LN2 / halfLifeHours;
}

// Sensible default Tmax when a medication doesn't have one specified — short
// enough to show the absorption rise, long enough not to look IV-bolus-like.
export function tmaxOrDefault(halfLifeHours: number, tmaxHours: number | null | undefined): number {
  if (tmaxHours && tmaxHours > 0) return tmaxHours;
  return Math.max(0.25, halfLifeHours / 6);
}

// How wide a level chart should be for one medication.
//
// A fixed 7-day window is wrong at both ends. A peptide with a 30-minute
// half-life draws one spike and six days of flat zero; a 21-day depot never
// leaves the top of the chart. Six half-lives is the span over which a dose
// falls to about 1.5% of itself, which is the whole of the interesting part of
// the curve and nothing after it.
//
// Clamped to a day at the short end, so a chart always covers at least the day
// the user is looking at, and to three weeks at the long end, so a very long
// half-life does not push the last shot off the left edge.
//
// A medication with no half-life gets the old 7 days: there is no curve to
// size the window around, only the shot marks.
export const MIN_LEVEL_WINDOW_HOURS = 24;
export const MAX_LEVEL_WINDOW_HOURS = 21 * 24;
const DEFAULT_LEVEL_WINDOW_HOURS = 7 * 24;

export function suggestedLevelWindowHours(halfLifeHours: number | null | undefined): number {
  if (!halfLifeHours || !Number.isFinite(halfLifeHours) || halfLifeHours <= 0) {
    return DEFAULT_LEVEL_WINDOW_HOURS;
  }
  const span = halfLifeHours * 6;
  return Math.min(MAX_LEVEL_WINDOW_HOURS, Math.max(MIN_LEVEL_WINDOW_HOURS, span));
}

// Numerically invert t_max = ln(ka/ke)/(ka - ke) to recover ka given Tmax and ke.
// Bisection on ka in (ke·1.05, ke·1000). Cached per (halfLife, tmax) pair.
const kaCache = new Map<string, number>();
export function absorptionRatePerHour(halfLifeHours: number, tmaxHours: number): number {
  const ke = eliminationRatePerHour(halfLifeHours);
  if (tmaxHours <= 0) return ke * 1000;
  const key = `${halfLifeHours}|${tmaxHours}`;
  const hit = kaCache.get(key);
  if (hit !== undefined) return hit;

  const target = tmaxHours;
  let lo = ke * 1.05;
  let hi = ke * 1000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const tmax = Math.log(mid / ke) / (mid - ke);
    if (tmax > target) lo = mid; else hi = mid;
  }
  const ka = (lo + hi) / 2;
  kaCache.set(key, ka);
  return ka;
}

// Peak amplitude factor for a unit dose with the chosen ka, ke. Cmax of the
// Bateman curve relative to D — used to normalize so the chart's peak after a
// single injection equals the dose magnitude (consistent with how users
// intuit "level after a 2.5 mg shot ≈ 2.5"). Without this factor the curve
// would be much smaller than expected.
function peakFactor(ka: number, ke: number): number {
  const tmax = Math.log(ka / ke) / (ka - ke);
  return (ka / (ka - ke)) * (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
}

export function estimatedLevelAt(
  doses: DoseEvent[],
  halfLifeHours: number,
  _tmaxHours: number,
  atMs: number,
): number {
  const ke = eliminationRatePerHour(halfLifeHours);
  let total = 0;
  for (const dose of doses) {
    if (dose.takenAt > atMs) continue;
    const h = (atMs - dose.takenAt) / HOUR_MS;
    if (h < 0) continue;
    total += dose.dose * Math.exp(-ke * h);
  }
  return total;
}

export function estimatedAbsorbedLevelAt(
  doses: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  atMs: number,
): number {
  const ke = eliminationRatePerHour(halfLifeHours);
  const ka = absorptionRatePerHour(halfLifeHours, tmaxHours);
  const norm = peakFactor(ka, ke);
  let total = 0;
  for (const dose of doses) {
    if (dose.takenAt > atMs) continue;
    const h = (atMs - dose.takenAt) / HOUR_MS;
    if (h < 0) continue;
    const c = (ka / (ka - ke)) * (Math.exp(-ke * h) - Math.exp(-ka * h));
    total += dose.dose * (c / norm);
  }
  return total;
}

export function levelTrajectory(
  doses: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  fromMs: number,
  toMs: number,
  steps = 60,
): { t: number; level: number }[] {
  const out: { t: number; level: number }[] = [];
  const stepMs = (toMs - fromMs) / steps;
  for (let i = 0; i <= steps; i++) {
    const t = fromMs + stepMs * i;
    out.push({ t, level: estimatedLevelAt(doses, halfLifeHours, tmaxHours, t) });
  }
  return out;
}

export function trendLabel(
  doses: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  nowMs: number,
): 'rising' | 'falling' | 'steady' {
  const past = estimatedLevelAt(doses, halfLifeHours, tmaxHours, nowMs - 6 * HOUR_MS);
  const now = estimatedLevelAt(doses, halfLifeHours, tmaxHours, nowMs);
  if (now > past * 1.05) return 'rising';
  if (now < past * 0.95) return 'falling';
  return 'steady';
}

export function peakTroughAvg(
  trajectory: { t: number; level: number }[],
): { peak: { t: number; level: number }; trough: { t: number; level: number }; avg: number } {
  if (trajectory.length === 0) {
    return { peak: { t: 0, level: 0 }, trough: { t: 0, level: 0 }, avg: 0 };
  }
  let peak = trajectory[0]!;
  let trough = trajectory[0]!;
  let sum = 0;
  for (const p of trajectory) {
    if (p.level > peak.level) peak = p;
    if (p.level < trough.level) trough = p;
    sum += p.level;
  }
  return { peak, trough, avg: sum / trajectory.length };
}

// Project future doses forward at the medication's dosing interval, anchored
// off the most recent injection. Used to forecast where the level will be
// "if I keep taking shots on schedule." Caps at horizonMs.
export function projectFutureDoses(
  pastDoses: DoseEvent[],
  intervalHours: number,
  defaultDose: number,
  fromMs: number,
  toMs: number,
): DoseEvent[] {
  if (intervalHours <= 0 || toMs <= fromMs) return [];
  const intervalMs = intervalHours * HOUR_MS;
  const lastTaken = pastDoses.length
    ? Math.max(...pastDoses.map((d) => d.takenAt))
    : fromMs;
  const lastDose = pastDoses.length
    ? pastDoses.reduce((acc, d) => (d.takenAt > acc.takenAt ? d : acc), pastDoses[0]!).dose
    : defaultDose;

  const out: DoseEvent[] = [];
  let nextAt = lastTaken + intervalMs;
  while (nextAt <= toMs && out.length < 200) {
    if (nextAt >= fromMs) out.push({ takenAt: nextAt, dose: lastDose });
    nextAt += intervalMs;
  }
  return out;
}
