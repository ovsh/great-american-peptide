// What a schedule the user is about to save will actually do, in words.
//
// "Twice a week" is the one frequency that decides a day the user never picked:
// the domain schedules the day they chose and a second day after it. Nothing in
// `domain/scheduling` exports that step, so this module does not restate it. It
// builds the schedule the medication will be saved with, asks the domain for one
// whole week of doses, and reads the days back out. A change to the rule lands
// here without an edit.

import {
  isWeekday,
  medicationScheduleFromStored,
  scheduledDosesBetween,
  weekdayListLabel,
  type Weekday,
} from '../domain/scheduling';

const DAYS_IN_WEEK = 7;

/** The days a twice weekly schedule lands on, starting with the day the user picked. */
export function twiceWeeklyWeekdays(firstWeekday: Weekday): Weekday[] {
  // The week starts on the picked day, so the days come back in the order the
  // user will meet them rather than in calendar order from today.
  const startsAt = nextLocalDayOn(firstWeekday, Date.now());
  const schedule = medicationScheduleFromStored({
    medicationId: 'twice-weekly-preview',
    frequencyKind: 'twice_weekly',
    frequencyValue: firstWeekday,
    createdAt: startsAt,
    reminderTime: '09:00',
  });
  if (!schedule) return [];
  return scheduledDosesBetween(schedule, startsAt, addLocalDays(startsAt, DAYS_IN_WEEK - 1))
    .map((dose) => new Date(dose.scheduledDay).getDay())
    .filter(isWeekday);
}

/**
 * The line a picker shows under the day, so the second day is on screen before
 * the user saves. Null when Poke has nothing to name.
 */
export function twiceWeeklyScheduleNote(firstWeekday: Weekday): string | null {
  const named = weekdayListLabel(twiceWeeklyWeekdays(firstWeekday));
  return named === '' ? null : `Poke schedules ${named}.`;
}

function addLocalDays(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The start of the first day on or after `from` that falls on `weekday`. */
function nextLocalDayOn(weekday: Weekday, from: number): number {
  let day = addLocalDays(from, 0);
  for (let step = 0; step < DAYS_IN_WEEK; step += 1) {
    if (new Date(day).getDay() === weekday) return day;
    day = addLocalDays(day, 1);
  }
  return day;
}
