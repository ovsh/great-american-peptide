import {
  appendStamp,
  appendTrigger,
  canPrompt,
  MIN_DAYS_BETWEEN_PROMPTS,
  YEAR_MS,
  type ReviewGateState,
} from './reviewGate.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 7, 7, 12, 0, 0, 0).getTime();

const ready: ReviewGateState = {
  onboardingCompletedAt: NOW - 30 * DAY,
  shotCount: 3,
  promptLog: null,
  triggersUsed: null,
};

test('never asks before onboarding is done', () => {
  assert(!canPrompt({ ...ready, onboardingCompletedAt: null }, 'calculation', NOW));
});

test('a calculation asks once one shot exists, so the first ask can land in week one', () => {
  assert(!canPrompt({ ...ready, shotCount: 0 }, 'calculation', NOW));
  assert(canPrompt({ ...ready, shotCount: 1 }, 'calculation', NOW));
});

test('a logged shot asks on the first shot, and never on none', () => {
  assert(!canPrompt({ ...ready, shotCount: 0 }, 'shot-logged', NOW));
  assert(canPrompt({ ...ready, shotCount: 1 }, 'shot-logged', NOW));
});

test('the level curve asks on the first dose, and never over an empty chart', () => {
  assert(!canPrompt({ ...ready, shotCount: 0 }, 'level-curve', NOW));
  assert(canPrompt({ ...ready, shotCount: 1 }, 'level-curve', NOW));
});

test('a trigger fires once, ever', () => {
  const used = { ...ready, triggersUsed: 'calculation' };
  assert(!canPrompt(used, 'calculation', NOW));
  assert(canPrompt(used, 'shot-logged', NOW), 'a different trigger is still allowed');
});

test('the cooldown blocks a second ask, then releases it', () => {
  const justAsked = { ...ready, promptLog: String(NOW - 3 * DAY) };
  assert(!canPrompt(justAsked, 'shot-logged', NOW));
  const older = { ...ready, promptLog: String(NOW - (MIN_DAYS_BETWEEN_PROMPTS + 1) * DAY) };
  assert(canPrompt(older, 'shot-logged', NOW));
});

test('three asks in a year is the ceiling, matching StoreKit', () => {
  const spent = {
    ...ready,
    promptLog: [NOW - 300 * DAY, NOW - 200 * DAY, NOW - 100 * DAY].join(','),
  };
  assert(!canPrompt(spent, 'shot-logged', NOW));
});

test('the ceiling is a rolling year, so old asks stop counting', () => {
  const aged = {
    ...ready,
    promptLog: [NOW - (YEAR_MS + DAY), NOW - 300 * DAY, NOW - 200 * DAY].join(','),
  };
  assert(canPrompt(aged, 'shot-logged', NOW));
});

test('two wins on the same first shot cannot both ask, because of the cooldown', () => {
  // Every floor is one shot, so a user who calculates a dose and then logs that shot
  // trips two eligible triggers minutes apart. Only the first may ask.
  const first = { ...ready, shotCount: 1 };
  assert(canPrompt(first, 'calculation', NOW));
  const after = {
    ...first,
    promptLog: appendStamp(first.promptLog, NOW),
    triggersUsed: appendTrigger(first.triggersUsed, 'calculation'),
  };
  assert(!canPrompt(after, 'shot-logged', NOW + 60 * 1000), 'the same session cannot ask twice');
  assert(canPrompt(after, 'shot-logged', NOW + (MIN_DAYS_BETWEEN_PROMPTS + 1) * DAY));
});

test('three different wins fit inside thirty days', () => {
  // The whole point of the redesign: spend the yearly budget while the app is new.
  // One shot now carries all three floors, so the cooldown alone sets the pace.
  let state: ReviewGateState = { ...ready, shotCount: 1 };
  const days: number[] = [];
  const plan = [
    { day: 1, trigger: 'calculation' as const },
    { day: 12, trigger: 'shot-logged' as const },
    { day: 23, trigger: 'level-curve' as const },
  ];
  for (const step of plan) {
    const at = NOW + step.day * DAY;
    assert(canPrompt(state, step.trigger, at), `ask on day ${step.day}`);
    days.push(step.day);
    state = {
      ...state,
      promptLog: appendStamp(state.promptLog, at),
      triggersUsed: appendTrigger(state.triggersUsed, step.trigger),
    };
  }
  assert(days[days.length - 1] <= 30, 'all three asks land inside 30 days');
  // And the budget is then genuinely spent.
  assert(!canPrompt(state, 'export', NOW + 40 * DAY), 'a fourth ask is refused');
});

test('the stamp log drops entries older than a year', () => {
  const log = appendStamp([NOW - (YEAR_MS + DAY), NOW - DAY].join(','), NOW);
  assert(log.split(',').length === 2, `expected 2 entries, received ${log}`);
});

console.log('11 review-gate tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
