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
    | { kind: 'every_n_days'; intervalDays: number };
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
  reminderTime: string;
}

export function medicationScheduleFromStored(input: StoredMedicationSchedule): MedicationSchedule | null {
  const base = {
    medicationId: input.medicationId,
    startsAt: startOfLocalDay(input.createdAt),
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
          weekday: isWeekday(input.frequencyValue) ? input.frequencyValue : localWeekday(input.createdAt),
        },
      };
    case 'twice_weekly':
      return {
        ...base,
        recurrence: {
          kind: 'twice_weekly',
          firstWeekday: isWeekday(input.frequencyValue) ? input.frequencyValue : localWeekday(input.createdAt),
        },
      };
    case 'every_n_days':
      return Number.isInteger(input.frequencyValue) && input.frequencyValue !== null && input.frequencyValue > 0
        ? { ...base, recurrence: { kind: 'every_n_days', intervalDays: input.frequencyValue } }
        : null;
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
