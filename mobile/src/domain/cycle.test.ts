/**
 * The cycle arithmetic, on real local dates.
 *
 *     npx tsx src/domain/cycle.test.ts
 */
import {
  breakEndsAt,
  cycleDurationLabel,
  cycleFrame,
  cycleProgressLabel,
  cycleShortLabel,
  cycleState,
  dayIndexFrom,
  elapsedLabel,
  lastPlannedDay,
  type CycleInput,
} from './cycle.ts';

/** A local midnight, so every case reads as the date a user would name. */
function day(year: number, month: number, date: number): number {
  return new Date(year, month - 1, date, 0, 0, 0, 0).getTime();
}

function at(year: number, month: number, date: number, hour: number): number {
  return new Date(year, month - 1, date, hour, 0, 0, 0).getTime();
}

const RUNNING: CycleInput = {
  status: 'active',
  cycleDaysOn: 56,
  cycleDaysOff: 28,
  cycleStartedAt: day(2026, 7, 1),
  pausedAt: null,
  createdAt: day(2026, 1, 1),
};

/* ── the display frame ────────────────────────────────────────────────── */

test('a length that divides by seven reads in weeks', () => {
  const frame = cycleFrame(29, 56);
  assert(frame.unit === 'week', 'a 56 day plan is eight weeks');
  assert(cycleProgressLabel(frame) === 'Week 5 of 8', `got ${cycleProgressLabel(frame)}`);
  assert(cycleShortLabel(frame) === 'Wk 5/8', `got ${cycleShortLabel(frame)}`);
});

test('a length that does not divide by seven keeps its days', () => {
  const frame = cycleFrame(60, 60);
  assert(frame.unit === 'day', 'a 60 day plan is not a whole number of weeks');
  assert(cycleProgressLabel(frame) === 'Day 60 of 60', `got ${cycleProgressLabel(frame)}`);
  assert(cycleShortLabel(frame) === 'Day 60/60', `got ${cycleShortLabel(frame)}`);
});

test('the first seven days are all week 1 and the eighth is week 2', () => {
  for (let index = 1; index <= 7; index += 1) {
    assert(cycleFrame(index, 56).index === 1, `day ${index} is week 1`);
  }
  assert(cycleFrame(8, 56).index === 2, 'day 8 is week 2');
  assert(cycleFrame(56, 56).index === 8, 'the last day of an eight week plan is week 8');
});

test('a duration reads in the frame it was set in', () => {
  assert(cycleDurationLabel(28) === '4 weeks', `got ${cycleDurationLabel(28)}`);
  assert(cycleDurationLabel(7) === '1 week', `got ${cycleDurationLabel(7)}`);
  assert(cycleDurationLabel(30) === '30 days', `got ${cycleDurationLabel(30)}`);
  assert(cycleDurationLabel(1) === '1 day', `got ${cycleDurationLabel(1)}`);
});

/* ── the day count ────────────────────────────────────────────────────── */

test('the first day is day 1, whatever hour the plan started at', () => {
  assert(dayIndexFrom(at(2026, 7, 1, 22), at(2026, 7, 1, 23)) === 1, 'the same evening');
  assert(dayIndexFrom(at(2026, 7, 1, 22), at(2026, 7, 2, 1)) === 2, 'past midnight is day 2');
});

test('the last planned day is the start plus one day less than the length', () => {
  assert(lastPlannedDay(day(2026, 7, 1), 56) === day(2026, 8, 25), 'a 56 day plan from 1 July');
  assert(lastPlannedDay(day(2026, 7, 1), 1) === day(2026, 7, 1), 'a one day plan ends the day it starts');
});

/* ── state derivation ─────────────────────────────────────────────────── */

test('no cycle set means no cycle state', () => {
  const state = cycleState({ ...RUNNING, cycleDaysOn: null }, day(2026, 7, 20));
  assert(state.kind === 'none', `got ${state.kind}`);
});

test('an archived medication shows nothing, cycle or not', () => {
  const state = cycleState({ ...RUNNING, status: 'archived' }, day(2026, 7, 20));
  assert(state.kind === 'none', `got ${state.kind}`);
});

test('mid plan reads as running, with the week and a fraction', () => {
  const state = cycleState(RUNNING, at(2026, 7, 29, 9));
  assert(state.kind === 'running', `got ${state.kind}`);
  if (state.kind !== 'running') return;
  assert(state.dayIndex === 29, `got day ${state.dayIndex}`);
  assert(cycleProgressLabel(state.frame) === 'Week 5 of 8', `got ${cycleProgressLabel(state.frame)}`);
  assert(!state.onLastDay, 'day 29 of 56 is not the last day');
  assert(state.progress > 0.51 && state.progress < 0.52, `got ${state.progress}`);
});

test('the last planned day is running and says so', () => {
  const state = cycleState(RUNNING, at(2026, 8, 25, 9));
  assert(state.kind === 'running', `got ${state.kind}`);
  if (state.kind !== 'running') return;
  assert(state.onLastDay, 'day 56 of 56');
  assert(state.progress === 1, `got ${state.progress}`);
  assert(cycleProgressLabel(state.frame) === 'Week 8 of 8', `got ${cycleProgressLabel(state.frame)}`);
});

test('the day after the plan keeps counting honestly', () => {
  const state = cycleState(RUNNING, at(2026, 8, 26, 9));
  assert(state.kind === 'pastPlan', `got ${state.kind}`);
  if (state.kind !== 'pastPlan') return;
  assert(state.dayIndex === 57, `got day ${state.dayIndex}`);
  assert(cycleProgressLabel(state.frame) === 'Week 9 of 8', `got ${cycleProgressLabel(state.frame)}`);
});

test('a plan with no anchor falls back to the day the medication was added', () => {
  const state = cycleState(
    { ...RUNNING, cycleStartedAt: null, createdAt: day(2026, 7, 1) },
    at(2026, 7, 29, 9),
  );
  assert(state.kind === 'running' && state.dayIndex === 29, 'created_at carried the count');
});

/* ── the break ────────────────────────────────────────────────────────── */

test('a break ends on the first day back', () => {
  assert(breakEndsAt(at(2026, 8, 15, 20), 28) === day(2026, 9, 12), 'four weeks from 15 August');
});

test('a paused medication with a cycle reads as on break, with the end date', () => {
  const state = cycleState(
    { ...RUNNING, status: 'paused', pausedAt: at(2026, 8, 15, 20) },
    at(2026, 8, 20, 9),
  );
  assert(state.kind === 'onBreak', `got ${state.kind}`);
  if (state.kind !== 'onBreak') return;
  assert(state.endsAt === day(2026, 9, 12), 'the end date is the plan plus the pause');
  assert(state.dayIndex === 6, `the pause day is day 1, so got day ${state.dayIndex}`);
});

test('a break with no length set has no end date and does not invent one', () => {
  const state = cycleState(
    { ...RUNNING, status: 'paused', cycleDaysOff: null, pausedAt: at(2026, 8, 15, 20) },
    at(2026, 8, 20, 9),
  );
  assert(state.kind === 'onBreak' && state.endsAt === null, 'None means no end date');
});

test('a pause written before the column existed has no end date either', () => {
  const state = cycleState(
    { ...RUNNING, status: 'paused', pausedAt: null },
    at(2026, 8, 20, 9),
  );
  assert(state.kind === 'onBreak' && state.endsAt === null, 'no paused_at, no arithmetic');
  assert(state.kind === 'onBreak' && state.dayIndex === 0, 'and no day count');
});

test('an elapsed break reads in weeks when it lands on one', () => {
  assert(elapsedLabel(day(2026, 8, 15), day(2026, 9, 12)) === '4 weeks', 'twenty eight days');
  assert(elapsedLabel(day(2026, 8, 15), day(2026, 9, 14)) === '30 days', 'thirty days');
  assert(elapsedLabel(day(2026, 8, 15), day(2026, 8, 15)) === '1 day', 'a break resumed the same day');
});

console.log('18 cycle tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
