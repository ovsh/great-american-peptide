import type { InjectionRow, MedicationRow } from '../db/types.ts';
import { eliminationRatePerHour } from '../domain/pk.ts';
import { endOfDay, startOfDay } from '../utils/date.ts';
import {
  WEEK_LOOKBACK_DAYS,
  buildLevelSeries,
  convertedDoses,
  levelWindow,
  weekWindow,
} from './today-level-series.ts';

process.env.TZ = 'America/Chicago';

// The user who reported the bug: tirzepatide, a shot on 7 Aug and a shot on 14 Aug.
const NOW = new Date(2026, 7, 14, 9, 0, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TIRZEPATIDE_HALF_LIFE = 120;

const tirzepatide: MedicationRow = {
  id: 'med_a',
  name: 'Tirzepatide',
  preset_id: 'tirzepatide',
  default_dose: 2.5,
  default_unit: 'mg',
  default_route: 'sc',
  frequency_kind: 'weekly',
  frequency_value: 1,
  half_life_hours: TIRZEPATIDE_HALF_LIFE,
  tmax_hours: 24,
  color_index: 0,
  status: 'active',
  sort_order: 0,
  cycle_days_on: null,
  cycle_days_off: null,
  cycle_started_at: null,
  paused_at: null,
  composition: null,
  dose_by_day: null,
  vial_mg: null,
  vial_form: null,
  diluent_ml: null,
  created_at: NOW - 60 * DAY,
  updated_at: NOW,
};

/* ── the window is the axis ───────────────────────────────────────────── */

test('the window spans exactly the seven days the axis draws', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  assert(fromMs === startOfDay(axisDay(-WEEK_LOOKBACK_DAYS)), 'opens on the first column');
  assert(toMs === endOfDay(axisDay(6 - WEEK_LOOKBACK_DAYS)), 'closes on the last column');
});

test('the window holds seven days and no eighth', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  const days = new Set<number>();
  for (let t = fromMs; t <= toMs; t += HOUR) days.add(startOfDay(t));
  assert(days.size === 7, `expected 7 days in the window, received ${days.size}`);
  assert(days.has(startOfDay(NOW)), 'today is one of them');
});

/* ── what the left edge carries ───────────────────────────────────────── */

test('the curve enters the week at the residual of a shot taken before it', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  const injections = [shot('recent', NOW), shot('older', NOW - 7 * DAY)];
  const series = buildLevelSeries({
    injections,
    medication: tirzepatide,
    now: NOW,
    fromMs,
    toMs,
    nextDoseAt: null,
  });
  assert(series.kind === 'curve', 'a sourced half-life draws a curve');
  if (series.kind !== 'curve') return;

  const edge = series.past[0]!;
  assert(edge.t === fromMs, 'the first sample sits on the left edge');
  const hours = (fromMs - (NOW - 7 * DAY)) / HOUR;
  const expected = 2.5 * Math.exp(-eliminationRatePerHour(TIRZEPATIDE_HALF_LIFE) * hours);
  assert(edge.v > 0, 'the left edge is not a reset to zero');
  assert(Math.abs(edge.v - expected) < 1e-9, `the residual is the shot's own decay, received ${edge.v}`);
});

test('a shot on a day column samples at that column centre', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  // Noon two days back, which the axis draws in the second column.
  const takenAt = axisDay(-2) + 12 * HOUR;
  const fraction = (takenAt - fromMs) / (toMs - fromMs);
  const centre = (WEEK_LOOKBACK_DAYS - 2 + 0.5) / 7;
  assert(Math.abs(fraction - centre) < 0.01, `expected about ${centre}, received ${fraction}`);
});

/* ── a shot the curve cannot add does not move the window ─────────────── */

test('an old shot in a unit that does not convert leaves the window where it was', () => {
  const usable = [shot('recent', NOW - 2 * DAY)];
  const withOldIu = [...usable, { ...shot('old_iu', NOW - 40 * DAY), unit: 'iu' as const }];
  const clean = levelWindow({
    doses: convertedDoses(usable, tirzepatide),
    halfLifeHours: TIRZEPATIDE_HALF_LIFE,
    nextDoseAt: null,
    now: NOW,
  });
  const stretched = levelWindow({
    doses: convertedDoses(withOldIu, tirzepatide),
    halfLifeHours: TIRZEPATIDE_HALF_LIFE,
    nextDoseAt: null,
    now: NOW,
  });
  assert(convertedDoses(withOldIu, tirzepatide).length === 1, 'the IU row is not a dose the curve adds');
  assert(stretched.fromMs === clean.fromMs, 'so it does not open the window either');
});

test('a dose logged in another metric unit is converted rather than dropped', () => {
  const doses = convertedDoses(
    [{ ...shot('mcg', NOW), dose: 500, unit: 'mcg' as const }],
    tirzepatide,
  );
  assert(doses.length === 1 && doses[0]!.dose === 0.5, '500 mcg is 0.5 mg');
});

/* ── the states that are not a curve ──────────────────────────────────── */

test('a medication with no half-life still draws its shots', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  const series = buildLevelSeries({
    injections: [shot('a', NOW - DAY)],
    medication: { ...tirzepatide, half_life_hours: null },
    now: NOW,
    fromMs,
    toMs,
    nextDoseAt: null,
  });
  assert(series.kind === 'shots', `expected shots, received ${series.kind}`);
  if (series.kind === 'shots') assert(series.shots.length === 1, 'the shot inside the week');
});

test('a shot outside the week is not one of the drawn shot marks', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  const series = buildLevelSeries({
    injections: [shot('a', NOW - 30 * DAY)],
    medication: { ...tirzepatide, half_life_hours: null },
    now: NOW,
    fromMs,
    toMs,
    nextDoseAt: null,
  });
  assert(series.kind === 'shots' && series.shots.length === 0);
});

test('a medication whose every shot is unconvertible has nothing to draw', () => {
  const { fromMs, toMs } = weekWindow(NOW);
  const series = buildLevelSeries({
    injections: [{ ...shot('iu', NOW), unit: 'iu' as const }],
    medication: tirzepatide,
    now: NOW,
    fromMs,
    toMs,
    nextDoseAt: null,
  });
  assert(series.kind === 'empty', `expected empty, received ${series.kind}`);
});

console.log('9 level-series tests passed.');

/** The midnight of the axis column `offset` days from today, stepped the way the axis steps. */
function axisDay(offset: number): number {
  const date = new Date(startOfDay(NOW));
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shot(id: string, takenAt: number): InjectionRow {
  return {
    id,
    medication_id: 'med_a',
    dose: 2.5,
    unit: 'mg',
    route: 'sc',
    site_id: null,
    taken_at: takenAt,
    scheduled_at: null,
    notes: null,
    deleted_at: null,
    created_at: takenAt,
  };
}

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
