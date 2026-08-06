import { nextScheduledDoses, type MedicationSchedule } from './scheduling.ts';
import { computeScheduleStreak } from './streaks.ts';

process.env.TZ = 'America/Chicago';

const weekly: MedicationSchedule = {
  medicationId: 'weekly',
  startsAt: localTime(2026, 1, 5),
  time: { hour: 9, minute: 0 },
  recurrence: { kind: 'weekly', weekday: 1 },
};

test('returns zero when no schedule exists', () => {
  assertResult(computeScheduleStreak({ schedules: [], injections: [], now: localTime(2026, 1, 5) }), 0, 0);
});

test('uses the one-day grace window and records the best run', () => {
  const result = computeScheduleStreak({
    schedules: [weekly],
    injections: [
      shot('a', 'weekly', localTime(2026, 1, 4, 18)),
      shot('b', 'weekly', localTime(2026, 1, 13, 8)),
    ],
    now: localTime(2026, 1, 22, 12),
  });
  assertResult(result, 0, 2);
});

test('keeps completed weeks current while this week is pending', () => {
  const result = computeScheduleStreak({
    schedules: [weekly],
    injections: [
      shot('a', 'weekly', localTime(2026, 1, 5, 9)),
      shot('b', 'weekly', localTime(2026, 1, 12, 9)),
    ],
    now: localTime(2026, 1, 19, 8),
  });
  assertResult(result, 2, 2);
});

test('requires every active medication in a streak week', () => {
  const wednesday: MedicationSchedule = {
    medicationId: 'wednesday',
    startsAt: localTime(2026, 1, 5),
    time: { hour: 9, minute: 0 },
    recurrence: { kind: 'weekly', weekday: 3 },
  };
  const result = computeScheduleStreak({
    schedules: [weekly, wednesday],
    injections: [
      shot('a1', 'weekly', localTime(2026, 1, 5)),
      shot('b1', 'wednesday', localTime(2026, 1, 7)),
      shot('a2', 'weekly', localTime(2026, 1, 12)),
      shot('b2', 'wednesday', localTime(2026, 1, 14)),
      shot('a3', 'weekly', localTime(2026, 1, 19)),
    ],
    now: localTime(2026, 1, 23, 12),
  });
  assertResult(result, 0, 2);
});

test('does not let one daily injection satisfy two doses', () => {
  const daily: MedicationSchedule = {
    medicationId: 'daily',
    startsAt: localTime(2026, 1, 5),
    time: { hour: 9, minute: 0 },
    recurrence: { kind: 'daily' },
  };
  const result = computeScheduleStreak({
    schedules: [daily],
    injections: [shot('only', 'daily', localTime(2026, 1, 6))],
    now: localTime(2026, 1, 8, 12),
  });
  assertResult(result, 0, 0);
});

test('keeps local reminder time across DST for sparse schedules', () => {
  const sparse: MedicationSchedule = {
    medicationId: 'sparse',
    startsAt: localTime(2026, 3, 1),
    time: { hour: 9, minute: 0 },
    recurrence: { kind: 'every_n_days', intervalDays: 14 },
  };
  const doses = nextScheduledDoses(sparse, localTime(2026, 3, 1), 3);
  assertEqual(doses.length, 3, 'expected three sparse doses');
  assertEqual(new Date(doses[0]?.scheduledAt ?? 0).getHours(), 9, 'first dose hour');
  assertEqual(new Date(doses[1]?.scheduledAt ?? 0).getHours(), 9, 'DST dose hour');
  assertEqual(new Date(doses[2]?.scheduledAt ?? 0).getHours(), 9, 'third dose hour');
});

console.log('6 streak tests passed.');

function shot(id: string, medicationId: string, takenAt: number) {
  return { id, medicationId, takenAt };
}

function localTime(year: number, month: number, day: number, hour = 9): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

function assertResult(result: { current: number; best: number }, current: number, best: number) {
  assertEqual(result.current, current, 'current streak');
  assertEqual(result.best, best, 'best streak');
}

function assertEqual(actual: number, expected: number, label: string) {
  console.assert(actual === expected, `${label}: expected ${expected}, received ${actual}`);
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
