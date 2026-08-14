/**
 * The recurrences, on real local dates.
 *
 *     npx tsx src/domain/scheduling.test.ts
 */
import {
  medicationScheduleFromStored,
  nextScheduledDoses,
  scheduledDosesBetween,
  weekdayMask,
  weekdaysFromMask,
  type StoredMedicationSchedule,
  type Weekday,
} from './scheduling.ts';

/** A local midnight, so every case reads as the date a user would name. */
function day(year: number, month: number, date: number): number {
  return new Date(year, month - 1, date, 0, 0, 0, 0).getTime();
}

const MONDAY: Weekday = 1;
const WEDNESDAY: Weekday = 3;
const FRIDAY: Weekday = 5;
const SUNDAY: Weekday = 0;
const SATURDAY: Weekday = 6;

/** 1 August 2026 is a Saturday, so the run below starts mid-week on purpose. */
const AUGUST_1 = day(2026, 8, 1);

function stored(patch: Partial<StoredMedicationSchedule>): StoredMedicationSchedule {
  return {
    medicationId: 'med-1',
    frequencyKind: 'weekdays',
    frequencyValue: weekdayMask([MONDAY, WEDNESDAY, FRIDAY]),
    createdAt: AUGUST_1,
    reminderTime: '09:00',
    ...patch,
  };
}

/** The weekday of every dose in a run, in the order the doses come. */
function doseWeekdays(from: number, through: number, patch: Partial<StoredMedicationSchedule> = {}): number[] {
  const schedule = medicationScheduleFromStored(stored(patch));
  if (!schedule) throw new Error('FAIL: the schedule did not build');
  return scheduledDosesBetween(schedule, from, through).map((dose) => new Date(dose.scheduledDay).getDay());
}

/* ── the bitmask ──────────────────────────────────────────────────────── */

test('bit n is weekday n, counting Sunday as zero', () => {
  assert(weekdayMask([SUNDAY]) === 1, `Sunday is bit 0, got ${weekdayMask([SUNDAY])}`);
  assert(weekdayMask([MONDAY]) === 2, `Monday is bit 1, got ${weekdayMask([MONDAY])}`);
  assert(weekdayMask([SATURDAY]) === 64, `Saturday is bit 6, got ${weekdayMask([SATURDAY])}`);
  assert(weekdayMask([MONDAY, WEDNESDAY, FRIDAY]) === 42, 'Monday, Wednesday and Friday is 42');
  assert(weekdayMask([]) === 0, 'no day picked is zero');
});

test('the whole week fits in seven bits', () => {
  const everyDay = weekdayMask([0, 1, 2, 3, 4, 5, 6]);
  assert(everyDay === 127, `got ${everyDay}`);
});

test('a mask reads back the days it was built from, Monday first', () => {
  const days = weekdaysFromMask(weekdayMask([FRIDAY, SUNDAY, MONDAY]));
  assert(days.join(',') === '1,5,0', `the week is offered Monday to Sunday, got ${days.join(',')}`);
});

test('a mask that names nothing reads back as nothing', () => {
  assert(weekdaysFromMask(0).length === 0, 'zero names no day');
  assert(weekdaysFromMask(null).length === 0, 'a row with no value names no day');
  assert(weekdaysFromMask(-4).length === 0, 'a negative value names no day');
  assert(weekdaysFromMask(2.5).length === 0, 'a fraction names no day');
});

/* ── the picked weekdays ──────────────────────────────────────────────── */

test('a picked set lands on exactly those weekdays', () => {
  const weekdays = doseWeekdays(AUGUST_1, day(2026, 8, 21));
  assert(weekdays.length > 0, 'the run has doses in it');
  assert(weekdays.every((weekday) => weekday === 1 || weekday === 3 || weekday === 5), `got ${weekdays.join(',')}`);
});

test('three picked days give three doses a week, every week', () => {
  // 3 August is a Monday, so this is four whole weeks with no partial one.
  const weekdays = doseWeekdays(day(2026, 8, 3), day(2026, 8, 30));
  assert(weekdays.length === 12, `four weeks of three shots is twelve, got ${weekdays.length}`);
});

test('the set wraps across the week boundary and holds its shape', () => {
  // Sunday and Monday sit either side of the wrap, so a rule that counted from
  // the start of a week would drop one of them.
  const weekdays = doseWeekdays(day(2026, 8, 3), day(2026, 8, 16), {
    frequencyValue: weekdayMask([SUNDAY, MONDAY]),
  });
  assert(weekdays.join(',') === '1,0,1,0', `two weeks of Monday then Sunday, got ${weekdays.join(',')}`);
});

test('the run starts at the medication and not before it', () => {
  // 1 August is a Saturday. The first Monday, Wednesday or Friday after it is
  // Monday 3 August, and the read reaches back a month to prove nothing older
  // comes out.
  const schedule = medicationScheduleFromStored(stored({}));
  if (!schedule) throw new Error('FAIL: the schedule did not build');
  const doses = scheduledDosesBetween(schedule, day(2026, 7, 1), day(2026, 8, 7));
  assert(doses[0]?.scheduledDay === day(2026, 8, 3), 'the first dose is the Monday after the start');
  assert(doses.length === 3, `Monday, Wednesday and Friday of that week, got ${doses.length}`);
});

test('a single picked day behaves like a weekly schedule', () => {
  const weekdays = doseWeekdays(day(2026, 8, 3), day(2026, 8, 30), {
    frequencyValue: weekdayMask([WEDNESDAY]),
  });
  assert(weekdays.join(',') === '3,3,3,3', `four Wednesdays, got ${weekdays.join(',')}`);
});

test('an empty set is not a schedule', () => {
  assert(medicationScheduleFromStored(stored({ frequencyValue: 0 })) === null, 'zero builds nothing');
  assert(medicationScheduleFromStored(stored({ frequencyValue: null })) === null, 'no value builds nothing');
});

test('the next doses come in order, at the reminder time', () => {
  const schedule = medicationScheduleFromStored(stored({ reminderTime: '20:30' }));
  if (!schedule) throw new Error('FAIL: the schedule did not build');
  const doses = nextScheduledDoses(schedule, day(2026, 8, 3), 3);
  assert(doses.length === 3, `got ${doses.length}`);
  assert(doses[0]?.scheduledDay === day(2026, 8, 3), 'Monday 3 August');
  assert(doses[1]?.scheduledDay === day(2026, 8, 5), 'Wednesday 5 August');
  assert(doses[2]?.scheduledDay === day(2026, 8, 7), 'Friday 7 August');
  const first = new Date(doses[0]?.scheduledAt ?? 0);
  assert(first.getHours() === 20 && first.getMinutes() === 30, 'the reminder time carries');
});

test('a cycle anchor does not move a fixed weekday', () => {
  // `every_n_days` re-phases on a resume. A picked weekday cannot, because the
  // weekday is the schedule.
  const weekdays = doseWeekdays(day(2026, 8, 3), day(2026, 8, 16), {
    createdAt: day(2026, 1, 1),
    cycleStartedAt: day(2026, 8, 4),
  });
  assert(weekdays.every((weekday) => weekday === 1 || weekday === 3 || weekday === 5), `got ${weekdays.join(',')}`);
  assert(weekdays.length === 5, `the anchor bounds the start, so Monday 3 August drops, got ${weekdays.length}`);
});

/* ── the kinds that were already there ────────────────────────────────── */

test('every three days still counts from the anchor, whatever weekday it lands on', () => {
  const schedule = medicationScheduleFromStored({
    medicationId: 'med-1',
    frequencyKind: 'every_n_days',
    frequencyValue: 3,
    createdAt: AUGUST_1,
    reminderTime: '09:00',
  });
  if (!schedule) throw new Error('FAIL: the schedule did not build');
  const days = scheduledDosesBetween(schedule, AUGUST_1, day(2026, 8, 13)).map((dose) => dose.scheduledDay);
  assert(days.length === 5, `1, 4, 7, 10 and 13 August, got ${days.length}`);
  assert(days[0] === day(2026, 8, 1), 'the first dose is the day it starts');
  assert(days[1] === day(2026, 8, 4), 'three days later');
  assert(days[4] === day(2026, 8, 13), 'and it has drifted off the Saturday it started on');
});

test('every three days re-anchors on the cycle start, as it always has', () => {
  const schedule = medicationScheduleFromStored({
    medicationId: 'med-1',
    frequencyKind: 'every_n_days',
    frequencyValue: 3,
    createdAt: day(2026, 1, 1),
    cycleStartedAt: day(2026, 8, 2),
    reminderTime: '09:00',
  });
  if (!schedule) throw new Error('FAIL: the schedule did not build');
  const days = scheduledDosesBetween(schedule, day(2026, 8, 2), day(2026, 8, 8)).map((dose) => dose.scheduledDay);
  assert(days[0] === day(2026, 8, 2), 'the resume day is a dose day');
  assert(days[1] === day(2026, 8, 5), 'and the count runs from it');
});

test('an interval below one is not a schedule', () => {
  for (const frequencyValue of [0, -3, null]) {
    const schedule = medicationScheduleFromStored({
      medicationId: 'med-1',
      frequencyKind: 'every_n_days',
      frequencyValue,
      createdAt: AUGUST_1,
      reminderTime: '09:00',
    });
    assert(schedule === null, `an interval of ${String(frequencyValue)} builds nothing`);
  }
});

test('weekly and twice weekly are untouched', () => {
  const weekly = medicationScheduleFromStored({
    medicationId: 'med-1',
    frequencyKind: 'weekly',
    frequencyValue: MONDAY,
    createdAt: AUGUST_1,
    reminderTime: '09:00',
  });
  if (!weekly) throw new Error('FAIL: the weekly schedule did not build');
  const weeklyDays = scheduledDosesBetween(weekly, AUGUST_1, day(2026, 8, 21))
    .map((dose) => new Date(dose.scheduledDay).getDay());
  assert(weeklyDays.join(',') === '1,1,1', `three Mondays, got ${weeklyDays.join(',')}`);

  const twice = medicationScheduleFromStored({
    medicationId: 'med-1',
    frequencyKind: 'twice_weekly',
    frequencyValue: MONDAY,
    createdAt: AUGUST_1,
    reminderTime: '09:00',
  });
  if (!twice) throw new Error('FAIL: the twice weekly schedule did not build');
  const twiceDays = scheduledDosesBetween(twice, day(2026, 8, 3), day(2026, 8, 9))
    .map((dose) => new Date(dose.scheduledDay).getDay());
  assert(twiceDays.join(',') === '1,4', `Monday and Thursday, got ${twiceDays.join(',')}`);
});

console.log('16 scheduling tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
