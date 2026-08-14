// What one medication did on one day, for every day of a month.
//
// History draws a month as a board: one row of cells per week, and inside each
// day cell one fixed lane per medication. The lane order is the medication list
// order and never changes, so a medication is the same stripe on every day of
// every month. That is the whole concept — get the ordering wrong and the board
// stops being readable.
//
// The marks are Today's own axis vocabulary at month scale, so the two screens
// say the same words about the same day:
//
//   logged      the user logged a shot        solid
//   loggedTwice two or more shots that day    solid, split
//   due         scheduled, and today          tinted with a ring
//   scheduled   scheduled, still open         tinted
//   missed      scheduled, the window closed  hollow ring
//   none        the schedule names no dose    nothing
//
// This module is pure. It reads a medication row, a schedule and a count of
// shots per day, and returns marks. Every query lives in the screen.

import type { MedicationRow } from '../db/types';
import {
  WEEKDAY_OPTIONS,
  isWeekday,
  medicationScheduleFromStored,
  scheduledDosesBetween,
  weekdayListLabel,
  weekdaysFromMask,
  type MedicationSchedule,
} from './scheduling';
import { SCHEDULE_GRACE_DAYS } from './streaks';

export type LaneMark = 'logged' | 'loggedTwice' | 'due' | 'scheduled' | 'missed' | 'none';

/** One day of the board. `marks` holds one entry per lane, in lane order. */
export interface BoardDay {
  /** Start of the local day. The key every query, testID and sheet reads. */
  dayStart: number;
  dayOfMonth: number;
  isToday: boolean;
  /** True for a day that has already passed. Today is neither past nor future. */
  isPast: boolean;
  marks: readonly LaneMark[];
}

/** A calendar row. `null` is a cell before the 1st or after the last day. */
export type BoardWeek = readonly (BoardDay | null)[];

const DAYS_IN_WEEK = 7;

/** How a day and a medication are keyed in the shot count map. */
export function shotCountKey(dayStart: number, medicationId: string): string {
  return `${dayStart}:${medicationId}`;
}

/**
 * The schedule a lane draws its plan from, or null when it draws none.
 *
 * A paused medication draws no plan. Poke has no record of *when* it was paused,
 * so a paused medication that kept its schedule would go on collecting missed
 * doses for a course the user has said they stopped. Its logged shots stay: the
 * shots happened, the plan did not.
 */
export function laneSchedule(medication: MedicationRow, reminderTime: string): MedicationSchedule | null {
  if (medication.status !== 'active') return null;
  return medicationScheduleFromStored({
    medicationId: medication.id,
    frequencyKind: medication.frequency_kind,
    frequencyValue: medication.frequency_value,
    createdAt: medication.created_at,
    reminderTime,
  });
}

/**
 * One month of the board, as calendar weeks.
 *
 * `shotCounts` is how many shots each medication has on each day, keyed by
 * `shotCountKey`. The screen builds it from the month's injection marks; a day
 * this map does not name has no shot on it.
 */
export function buildMonthWeeks({
  monthStart,
  lanes,
  reminderTime,
  shotCounts,
  now,
}: {
  monthStart: number;
  lanes: readonly MedicationRow[];
  reminderTime: string;
  shotCounts: ReadonlyMap<string, number>;
  now: number;
}): BoardWeek[] {
  const today = startOfLocalDay(now);
  const first = startOfLocalMonth(monthStart);
  const length = daysInMonth(first);
  const last = addLocalDays(first, length - 1);

  // The days the schedule names inside this month, per lane. `scheduledDosesBetween`
  // never reaches back past the medication's own start, so a month before the
  // medication existed carries no missed dose.
  const scheduledDays = lanes.map((medication) => {
    const schedule = laneSchedule(medication, reminderTime);
    if (!schedule) return new Set<number>();
    return new Set(scheduledDosesBetween(schedule, first, last).map((dose) => dose.scheduledDay));
  });

  const cells: (BoardDay | null)[] = [];
  for (let index = 0; index < new Date(first).getDay(); index += 1) cells.push(null);

  for (let dayOfMonth = 1; dayOfMonth <= length; dayOfMonth += 1) {
    const dayStart = addLocalDays(first, dayOfMonth - 1);
    cells.push({
      dayStart,
      dayOfMonth,
      isToday: dayStart === today,
      isPast: dayStart < today,
      marks: lanes.map((medication, lane) => laneMark({
        shots: shotCounts.get(shotCountKey(dayStart, medication.id)) ?? 0,
        scheduled: scheduledDays[lane]?.has(dayStart) ?? false,
        dayStart,
        today,
      })),
    });
  }

  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);

  const weeks: BoardWeek[] = [];
  for (let index = 0; index < cells.length; index += DAYS_IN_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_IN_WEEK));
  }
  return weeks;
}

/**
 * One lane of one day. A shot on file outranks whatever the schedule said.
 *
 * A dose is not lost the moment its day ends: it keeps the same grace window
 * `streaks` gives it, so a shot kept one day late reads the same on the board as
 * it does on Today and on Progress. The window closes at the start of the day
 * after the grace, which is `closesAt` in `scheduledDoseWindow`.
 */
export function laneMark({
  shots,
  scheduled,
  dayStart,
  today,
}: {
  shots: number;
  scheduled: boolean;
  dayStart: number;
  today: number;
}): LaneMark {
  if (shots >= 2) return 'loggedTwice';
  if (shots === 1) return 'logged';
  if (!scheduled) return 'none';
  if (addLocalDays(dayStart, SCHEDULE_GRACE_DAYS + 1) <= today) return 'missed';
  if (dayStart === today) return 'due';
  return 'scheduled';
}

/** How one week went for one lane: the doses kept, the ones it lost, the ones still ahead. */
export interface WeekFill {
  kept: number;
  lost: number;
  ahead: number;
  total: number;
}

export function summarizeWeek(week: BoardWeek, lane: number): WeekFill {
  let kept = 0;
  let lost = 0;
  let ahead = 0;
  for (const day of week) {
    const mark = day?.marks[lane];
    if (mark === undefined || mark === 'none') continue;
    if (mark === 'logged' || mark === 'loggedTwice') kept += 1;
    else if (mark === 'missed') lost += 1;
    else ahead += 1;
  }
  return { kept, lost, ahead, total: kept + lost + ahead };
}

/**
 * How often this medication is taken, in the words the sheet says it in:
 * `Missed, every Tuesday`. Null when the frequency names no repeating day,
 * and then the row says only what happened.
 */
export function cadenceLabel(medication: MedicationRow): string | null {
  switch (medication.frequency_kind) {
    case 'daily':
      return 'every day';
    case 'weekly': {
      const weekday = isWeekday(medication.frequency_value)
        ? medication.frequency_value
        : new Date(medication.created_at).getDay();
      const label = WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label;
      return label ? `every ${label}` : null;
    }
    case 'twice_weekly':
      return 'twice a week';
    case 'weekdays': {
      // The days themselves, because the user picked them and a count of them
      // would say less than the list does.
      const named = weekdayListLabel(weekdaysFromMask(medication.frequency_value));
      return named === '' ? null : `every ${named}`;
    }
    case 'every_n_days': {
      const days = medication.frequency_value;
      if (days === null || !Number.isInteger(days) || days < 1) return null;
      return days === 1 ? 'every day' : `every ${days} days`;
    }
    case 'custom':
      return null;
    default: {
      const exhaustive: never = medication.frequency_kind;
      return exhaustive;
    }
  }
}

/** Every month from the oldest to the newest, oldest first — the order the board stacks in. */
export function monthStartsBetween(fromMs: number, toMs: number): number[] {
  const months: number[] = [];
  let month = startOfLocalMonth(fromMs);
  const last = startOfLocalMonth(toMs);
  // A month at a time, and never more than a lifetime of them: a corrupt
  // timestamp must not spin here.
  for (let step = 0; month <= last && step < 2400; step += 1) {
    months.push(month);
    month = addLocalMonths(month, 1);
  }
  return months;
}

/** How many calendar rows this month draws. Five or six, and February can be four. */
export function weeksInMonth(monthStart: number): number {
  const first = startOfLocalMonth(monthStart);
  return Math.ceil((new Date(first).getDay() + daysInMonth(first)) / DAYS_IN_WEEK);
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfLocalMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfLocalMonth(timestamp: number): number {
  const first = new Date(startOfLocalMonth(timestamp));
  first.setMonth(first.getMonth() + 1);
  return first.getTime() - 1;
}

export function addLocalMonths(timestamp: number, amount: number): number {
  const date = new Date(startOfLocalMonth(timestamp));
  date.setMonth(date.getMonth() + amount);
  return date.getTime();
}

function daysInMonth(monthStart: number): number {
  const date = new Date(monthStart);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addLocalDays(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
