import { planProjection } from './onboardingPlan.ts';
import {
  formatPace,
  formatPaceRate,
  isMaintainPace,
  MAINTAIN_PACE_LABEL,
  PACE_MIN_LB,
  paceBounds,
  type WeightDraft,
} from '../stores/onboarding.ts';

const NOW = Date.UTC(2026, 7, 14);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const losing: WeightDraft = { unit: 'lb', current: 220, goal: 180 };
// The report that started this file: the user sits under their own goal and
// wants to hold there, so the goal is above the current weight.
const underGoal: WeightDraft = { unit: 'lb', current: 170, goal: 180 };
const inKg: WeightDraft = { unit: 'kg', current: 77, goal: 82 };

/* ── the pace slider reaches zero ─────────────────────────────────────── */

test('the pace floor is zero in both units', () => {
  assert(PACE_MIN_LB === 0, 'the pound floor is zero');
  assert(paceBounds('lb').min === 0, 'the pound slider starts at zero');
  assert(paceBounds('kg').min === 0, 'the kilogram slider starts at zero');
});

test('every step of both sliders lands on an exact zero at the floor', () => {
  // The same arithmetic `Slider` runs: snap to a multiple of the step, then
  // clamp. A floor of zero has to come back as zero and not as 0.049.
  for (const step of [0.1, 0.05]) {
    const bounds = paceBounds(step === 0.1 ? 'lb' : 'kg');
    const snapped = Math.max(bounds.min, Math.min(bounds.max, Math.round(0 / step) * step));
    assert(snapped === 0, `step ${step} lands on zero`);
    assert(Object.is(snapped, 0) || snapped === 0, `step ${step} gives a printable zero`);
  }
});

/* ── the division still runs ──────────────────────────────────────────── */

test('a pace above zero still divides the distance by the pace', () => {
  const projection = planProjection(losing, 2, NOW);
  assert(projection !== null, 'a projection comes back');
  assert(projection?.kind === 'date', 'and it is the date kind');
  if (projection?.kind !== 'date') return;
  assert(projection.weeks === 20, '40 lb at 2 lb a week is 20 weeks');
  assert(projection.reachesAt === NOW + 20 * WEEK_MS, 'and the date is 20 weeks out');
  assert(projection.direction === 'down', 'a goal under the current weight points down');
});

test('a goal above the current weight points up', () => {
  const projection = planProjection(underGoal, 1, NOW);
  assert(projection?.kind === 'date' && projection.direction === 'up', 'direction is up');
});

test('a pace too slow for the distance still gives no card', () => {
  // 40 lb at 0.1 lb a week is 400 weeks, past the five-year ceiling.
  assert(planProjection(losing, 0.1, NOW) === null, 'over five years gives null');
});

/* ── a pace of zero means maintain ────────────────────────────────────── */

test('a pace of zero returns the maintain plan and never a date', () => {
  const projection = planProjection(underGoal, 0, NOW);
  assert(projection !== null, 'zero is an answer, not a missing one');
  assert(projection?.kind === 'maintain', 'and it is the maintain kind');
  if (projection?.kind !== 'maintain') return;
  assert(projection.pace === 0, 'the pace is zero');
  assert(projection.current === 170 && projection.goal === 180, 'both weights survive');
  assert(projection.unit === 'lb', 'and the unit with them');
  assert(!('reachesAt' in projection), 'the maintain plan carries no date at all');
  assert(!('direction' in projection), 'and no direction to force a verb from');
});

test('a pace of zero short-circuits before any division', () => {
  // Every shape that would divide by zero, in both units and both directions.
  const drafts: WeightDraft[] = [losing, underGoal, inKg];
  for (const draft of drafts) {
    for (const pace of [0, -0, 0.0000001, -0.0000001]) {
      const projection = planProjection(draft, pace, NOW);
      assert(projection?.kind === 'maintain', `pace ${pace} maintains`);
      const values = Object.values(projection ?? {});
      assert(
        values.every((value) => typeof value !== 'number' || Number.isFinite(value)),
        `pace ${pace} produces no Infinity and no NaN`,
      );
    }
  }
});

test('a maintain pace against a goal that equals the weight still gives no card', () => {
  // Nothing to draw: the bar would run from a number to the same number.
  assert(planProjection({ unit: 'lb', current: 180, goal: 180 }, 0, NOW) === null, 'null');
});

test('a maintain pace with a weight missing gives no card', () => {
  assert(planProjection({ unit: 'lb', current: null, goal: 180 }, 0, NOW) === null, 'no current');
  assert(planProjection({ unit: 'lb', current: 170, goal: null }, 0, NOW) === null, 'no goal');
});

test('a pace that is not a number gives no card', () => {
  assert(planProjection(underGoal, Number.NaN, NOW) === null, 'NaN');
  assert(planProjection(underGoal, Number.POSITIVE_INFINITY, NOW) === null, 'Infinity');
});

/* ── what the user reads ──────────────────────────────────────────────── */

test('a pace of zero never prints a number and never prints a unit', () => {
  for (const unit of ['lb', 'kg'] as const) {
    assert(formatPace(0, unit) === MAINTAIN_PACE_LABEL, `${unit} value is the word`);
    assert(formatPaceRate(0, unit) === MAINTAIN_PACE_LABEL, `${unit} readout is the word`);
    assert(!formatPaceRate(0, unit).includes(unit), `${unit} never appears`);
    assert(!formatPaceRate(0, unit).includes('0'), 'no zero digit reaches the screen');
    assert(!formatPaceRate(0, unit).includes('week'), 'and no rate after the word');
  }
});

test('a pace above zero keeps its number, its unit and its rate', () => {
  assert(formatPace(1, 'lb') === '1.0 lb', 'one pound');
  assert(formatPaceRate(1, 'lb') === '1.0 lb a week', 'one pound a week');
  assert(formatPace(0.45, 'kg') === '0.45 kg', 'a kilogram pace keeps two places');
  assert(formatPaceRate(0.45, 'kg') === '0.45 kg a week', 'and its rate');
});

test('a pace a hair off zero after a unit switch still reads as maintain', () => {
  // `setWeightUnit` divides the pace by 2.20462, so an exact zero survives. The
  // guard is here for the float that does not.
  assert(isMaintainPace(0 / 2.20462), 'a converted zero maintains');
  assert(isMaintainPace(1e-12), 'and so does a float a hair above it');
  assert(!isMaintainPace(0.05), 'the finest kilogram step does not');
  assert(!isMaintainPace(0.1), 'and neither does the finest pound step');
});

console.log('13 onboarding plan projection tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
