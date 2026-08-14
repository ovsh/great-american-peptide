// Where a medication stands inside the cycle the user wrote down.
//
// Everything here is arithmetic on two numbers the user typed and one day they
// picked. Poke proposes no length, reads nothing off the peptide, and predicts
// nothing about a body: a break-end date is the sum of a date and a count of
// days, which is a fact about the plan and not a claim about the person.
//
// Pure, and tested with `npx tsx src/domain/cycle.test.ts`.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days in a week, and the only reason this module ever divides by seven. */
const WEEK_DAYS = 7;

export interface CycleInput {
  status: 'active' | 'paused' | 'archived';
  cycleDaysOn: number | null;
  cycleDaysOff: number | null;
  cycleStartedAt: number | null;
  pausedAt: number | null;
  createdAt: number;
}

/**
 * How a length reads on screen.
 *
 * Weeks only when the count divides by seven. A 60-day protocol is a real
 * protocol, and "week 8.6 of 8.6" is not a sentence, so a custom length keeps
 * the unit the user typed it in.
 */
export type CycleFrame =
  | { unit: 'week'; index: number; total: number }
  | { unit: 'day'; index: number; total: number };

export type CycleState =
  /** No cycle on this medication, or one nothing can show. */
  | { kind: 'none' }
  /**
   * Inside the plan. `onLastDay` is the one day the hero offers the break, and
   * it is a state of the day rather than an instruction.
   */
  | {
    kind: 'running';
    dayIndex: number;
    totalDays: number;
    frame: CycleFrame;
    lastDayStart: number;
    onLastDay: boolean;
    progress: number;
  }
  /** Past the last planned day and still running. Poke counts on and says so. */
  | { kind: 'pastPlan'; dayIndex: number; totalDays: number; frame: CycleFrame }
  /**
   * Paused with a cycle set. `endsAt` is null when the user chose no break
   * reminder, and the screens then say the medication is on break and no more.
   */
  | { kind: 'onBreak'; daysOff: number | null; endsAt: number | null; dayIndex: number };

/**
 * The state a screen draws.
 *
 * An archived medication reads as `none`: it is off every list that could show
 * a cycle, and a readout nobody can reach is a readout that can only go stale.
 */
export function cycleState(input: CycleInput, now: number): CycleState {
  if (input.cycleDaysOn === null || input.cycleDaysOn <= 0) return { kind: 'none' };
  if (input.status === 'archived') return { kind: 'none' };

  if (input.status === 'paused') {
    const pausedAt = input.pausedAt;
    return {
      kind: 'onBreak',
      daysOff: input.cycleDaysOff,
      endsAt: pausedAt === null || input.cycleDaysOff === null
        ? null
        : breakEndsAt(pausedAt, input.cycleDaysOff),
      // A pause written by a build older than schema 13 carries no date, so the
      // break has no day count either. Zero says that, and the screens branch
      // on `endsAt` rather than printing a day nobody recorded.
      dayIndex: pausedAt === null ? 0 : dayIndexFrom(pausedAt, now),
    };
  }

  const totalDays = input.cycleDaysOn;
  const startedAt = input.cycleStartedAt ?? input.createdAt;
  const dayIndex = dayIndexFrom(startedAt, now);
  const frame = cycleFrame(dayIndex, totalDays);

  if (dayIndex > totalDays) return { kind: 'pastPlan', dayIndex, totalDays, frame };

  const lastDayStart = lastPlannedDay(startedAt, totalDays);
  return {
    kind: 'running',
    dayIndex,
    totalDays,
    frame,
    lastDayStart,
    onLastDay: dayIndex === totalDays,
    progress: Math.min(1, Math.max(0, dayIndex / totalDays)),
  };
}

/**
 * Which day of the plan a moment falls on, counting the first day as day 1.
 *
 * Counted on the calendar and not in milliseconds, so the two days a year the
 * offset moves do not shift the whole plan by a day.
 */
export function dayIndexFrom(startedAt: number, now: number): number {
  return calendarDayDistance(startedAt, now) + 1;
}

/** The start of the last day the plan covers. Day 1 is the day it started. */
export function lastPlannedDay(startedAt: number, daysOn: number): number {
  return addLocalDays(startOfLocalDay(startedAt), daysOn - 1);
}

/**
 * The first day back, which is the day the break ends.
 *
 * A break that starts on 15 August and runs 28 days covers 15 August to 11
 * September and ends on the 12th. "Break ends Sep 12" is that day, and it names
 * the plan rather than telling anybody what their body is ready for.
 */
export function breakEndsAt(pausedAt: number, daysOff: number): number {
  return addLocalDays(startOfLocalDay(pausedAt), daysOff);
}

/** Weeks when the count divides by seven, days when it does not. */
export function cycleFrame(dayIndex: number, totalDays: number): CycleFrame {
  if (totalDays % WEEK_DAYS === 0) {
    return {
      unit: 'week',
      index: Math.max(1, Math.ceil(dayIndex / WEEK_DAYS)),
      total: totalDays / WEEK_DAYS,
    };
  }
  return { unit: 'day', index: dayIndex, total: totalDays };
}

/** "Week 5 of 8", or "Day 60 of 60" when the plan does not fall on whole weeks. */
export function cycleProgressLabel(frame: CycleFrame): string {
  const noun = frame.unit === 'week' ? 'Week' : 'Day';
  return `${noun} ${frame.index} of ${frame.total}`;
}

/** The same fact in a chip: "Wk 5/8", or "Day 60/60". */
export function cycleShortLabel(frame: CycleFrame): string {
  const noun = frame.unit === 'week' ? 'Wk' : 'Day';
  return `${noun} ${frame.index}/${frame.total}`;
}

/** A length in the frame it was set in: "4 weeks", "1 week", "30 days", "1 day". */
export function cycleDurationLabel(days: number): string {
  if (days % WEEK_DAYS === 0) {
    const weeks = days / WEEK_DAYS;
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  return days === 1 ? '1 day' : `${days} days`;
}

/** How long a break has actually run, in words, counted from the pause. */
export function elapsedLabel(pausedAt: number, now: number): string {
  return cycleDurationLabel(Math.max(1, calendarDayDistance(pausedAt, now)));
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function calendarDayDistance(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / DAY_MS);
}
