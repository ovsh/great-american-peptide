import type { FrequencyKind } from './peptides';

const HOUR_MS = 60 * 60 * 1000;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_OPTIONS = [
  { value: 1, shortLabel: 'Mon', label: 'Monday' },
  { value: 2, shortLabel: 'Tue', label: 'Tuesday' },
  { value: 3, shortLabel: 'Wed', label: 'Wednesday' },
  { value: 4, shortLabel: 'Thu', label: 'Thursday' },
  { value: 5, shortLabel: 'Fri', label: 'Friday' },
  { value: 6, shortLabel: 'Sat', label: 'Saturday' },
  { value: 0, shortLabel: 'Sun', label: 'Sunday' },
] as const satisfies readonly { value: Weekday; shortLabel: string; label: string }[];

/**
 * A user-picked set of weekdays, packed into the `frequency_value` INTEGER.
 *
 * Bit n is weekday n in the `Weekday` numbering above, which is the numbering
 * `Date.getDay()` uses: bit 0 is Sunday, bit 1 is Monday, and bit 6 is Saturday.
 * Monday, Wednesday and Friday is therefore (1 << 1) | (1 << 3) | (1 << 5),
 * which is 42. The whole set fits in seven bits, so it stores in the column the
 * other kinds already use and needs no migration.
 *
 * Zero is no day picked. Zero is not a schedule, so it reads back as no
 * schedule rather than as an empty week that silently never comes due.
 */
export function weekdayMask(weekdays: readonly Weekday[]): number {
  let mask = 0;
  for (const weekday of weekdays) mask |= 1 << weekday;
  return mask;
}

/**
 * The days a mask names, in the order the week is offered on screen, so a list
 * built from this reads Monday first and Sunday last.
 */
export function weekdaysFromMask(mask: number | null): Weekday[] {
  if (mask === null || !Number.isInteger(mask) || mask <= 0) return [];
  return WEEKDAY_OPTIONS
    .map((option) => option.value)
    .filter((weekday) => (mask & (1 << weekday)) !== 0);
}

/**
 * A set of weekdays named in full, as an enumerated list keeps its commas:
 * "Monday, Wednesday and Friday". Empty when no day is picked, so the caller
 * says the set is empty rather than printing a bare "and".
 */
export function weekdayListLabel(weekdays: readonly Weekday[]): string {
  const names: string[] = [];
  for (const weekday of weekdays) {
    const label = WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label;
    if (label !== undefined) names.push(label);
  }
  const last = names[names.length - 1];
  if (last === undefined) return '';
  return names.length === 1 ? last : `${names.slice(0, -1).join(', ')} and ${last}`;
}

export interface ScheduleTime {
  hour: number;
  minute: number;
}

export type MedicationSchedule = {
  medicationId: string;
  startsAt: number;
  time: ScheduleTime;
  recurrence:
    | { kind: 'daily' }
    | { kind: 'weekly'; weekday: Weekday }
    | { kind: 'twice_weekly'; firstWeekday: Weekday }
    | { kind: 'every_n_days'; intervalDays: number }
    // The days the user picked, and only those. Unlike `every_n_days` this one
    // never drifts across the week, and unlike `twice_weekly` it decides no day
    // for the user. `startsAt` still bounds the first dose, but the anchor sets
    // no phase here: a fixed weekday falls on the same weekday whenever the
    // medication or its cycle started.
    | { kind: 'weekdays'; weekdays: readonly Weekday[] };
};

export interface ScheduledDose {
  medicationId: string;
  scheduledDay: number;
  scheduledAt: number;
}

export interface StoredMedicationSchedule {
  medicationId: string;
  frequencyKind: FrequencyKind;
  frequencyValue: number | null;
  createdAt: number;
  /**
   * The day the current cycle started, when the medication has one. It moves on
   * every resume, and the user can backdate it, so the schedule counts from it
   * in place of `created_at`. Optional: a caller with no cycle in hand omits it
   * and gets the old behaviour.
   */
  cycleStartedAt?: number | null;
  reminderTime: string;
}

export function medicationScheduleFromStored(input: StoredMedicationSchedule): MedicationSchedule | null {
  const anchoredAt = input.cycleStartedAt ?? input.createdAt;
  const base = {
    medicationId: input.medicationId,
    startsAt: startOfLocalDay(anchoredAt),
    time: parseReminderTime(input.reminderTime),
  };

  switch (input.frequencyKind) {
    case 'daily':
      return { ...base, recurrence: { kind: 'daily' } };
    case 'weekly':
      return {
        ...base,
        recurrence: {
          kind: 'weekly',
          weekday: isWeekday(input.frequencyValue) ? input.frequencyValue : localWeekday(anchoredAt),
        },
      };
    case 'twice_weekly':
      return {
        ...base,
        recurrence: {
          kind: 'twice_weekly',
          firstWeekday: isWeekday(input.frequencyValue) ? input.frequencyValue : localWeekday(anchoredAt),
        },
      };
    case 'every_n_days':
      return Number.isInteger(input.frequencyValue) && input.frequencyValue !== null && input.frequencyValue > 0
        ? { ...base, recurrence: { kind: 'every_n_days', intervalDays: input.frequencyValue } }
        : null;
    case 'weekdays': {
      // No day picked is no schedule. The form will not save an empty set, and
      // a row that carries one anyway draws no plan rather than a silent one.
      const weekdays = weekdaysFromMask(input.frequencyValue);
      return weekdays.length > 0 ? { ...base, recurrence: { kind: 'weekdays', weekdays } } : null;
    }
    case 'custom':
      return null;
    default: {
      const exhaustive: never = input.frequencyKind;
      return exhaustive;
    }
  }
}

export function scheduledDosesBetween(
  schedule: MedicationSchedule,
  from: number,
  through: number,
): ScheduledDose[] {
  const doses: ScheduledDose[] = [];
  const firstDay = Math.max(startOfLocalDay(from), schedule.startsAt);
  const lastDay = startOfLocalDay(through);

  for (let day = firstDay; day <= lastDay; day = addLocalDays(day, 1)) {
    if (!isScheduledDay(schedule, day)) continue;
    doses.push({
      medicationId: schedule.medicationId,
      scheduledDay: day,
      scheduledAt: atLocalTime(day, schedule.time.hour, schedule.time.minute),
    });
  }
  return doses;
}

export function nextScheduledDoses(
  schedule: MedicationSchedule,
  after: number,
  count: number,
): ScheduledDose[] {
  if (count <= 0) return [];
  const doses: ScheduledDose[] = [];
  let day = Math.max(startOfLocalDay(after), schedule.startsAt);
  const searchLimit = addLocalDays(day, Math.max(3660, count * 400));

  while (day <= searchLimit && doses.length < count) {
    if (isScheduledDay(schedule, day)) {
      const scheduledAt = atLocalTime(day, schedule.time.hour, schedule.time.minute);
      if (scheduledAt > after) {
        doses.push({ medicationId: schedule.medicationId, scheduledDay: day, scheduledAt });
      }
    }
    day = addLocalDays(day, 1);
  }
  return doses;
}

export function parseReminderTime(value: string): ScheduleTime {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match ? Number.parseInt(match[1] ?? '', 10) : 9;
  const minute = match ? Number.parseInt(match[2] ?? '', 10) : 0;
  return {
    hour: hour >= 0 && hour <= 23 ? hour : 9,
    minute: minute >= 0 && minute <= 59 ? minute : 0,
  };
}

function atLocalTime(timestamp: number, hour: number, minute: number): number {
  const date = new Date(timestamp);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function isWeekday(value: number | null): value is Weekday {
  return Number.isInteger(value) && value !== null && value >= 0 && value <= 6;
}

function isScheduledDay(schedule: MedicationSchedule, day: number): boolean {
  switch (schedule.recurrence.kind) {
    case 'daily':
      return true;
    case 'weekly':
      return localWeekday(day) === schedule.recurrence.weekday;
    case 'twice_weekly': {
      const weekday = localWeekday(day);
      const secondWeekday = weekdayFromNumber((schedule.recurrence.firstWeekday + 3) % 7);
      return weekday === schedule.recurrence.firstWeekday || weekday === secondWeekday;
    }
    case 'every_n_days':
      return calendarDayDistance(schedule.startsAt, day) % schedule.recurrence.intervalDays === 0;
    case 'weekdays':
      return schedule.recurrence.weekdays.includes(localWeekday(day));
    default: {
      const exhaustive: never = schedule.recurrence;
      return exhaustive;
    }
  }
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

function localWeekday(timestamp: number): Weekday {
  return weekdayFromNumber(new Date(timestamp).getDay());
}

function weekdayFromNumber(value: number): Weekday {
  if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6) return value;
  return 0;
}

function calendarDayDistance(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / (24 * HOUR_MS));
}
