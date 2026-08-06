import type { FrequencyKind } from './peptides';

const HOUR_MS = 60 * 60 * 1000;

export interface NextDoseInput {
  frequencyKind: FrequencyKind;
  frequencyValue: number | null;
  lastTakenAt: number | null;
  createdAt: number;
  reminderTime: string;
  now: number;
}

export interface ScheduleStreak {
  current: number;
  best: number;
}

export function frequencyHours(kind: FrequencyKind | string, value: number | null): number {
  switch (kind) {
    case 'daily': return 24;
    case 'weekly': return 24 * 7;
    case 'twice_weekly': return 24 * 3.5;
    case 'every_n_days': return 24 * (value ?? 1);
    default: return 24;
  }
}

export function nextDoseAt(input: NextDoseInput): number {
  const { hour, minute } = parseReminderTime(input.reminderTime);
  const intervalMs = frequencyHours(input.frequencyKind, input.frequencyValue) * HOUR_MS;

  if (input.lastTakenAt !== null) {
    return atLocalTime(input.lastTakenAt + intervalMs, hour, minute);
  }

  if (
    (input.frequencyKind === 'weekly' || input.frequencyKind === 'twice_weekly')
    && isWeekday(input.frequencyValue)
  ) {
    const candidate = new Date(input.now);
    const daysAhead = (input.frequencyValue - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(hour, minute, 0, 0);
    return candidate.getTime();
  }

  return atLocalTime(Math.max(input.createdAt, input.now), hour, minute);
}

export function deriveScheduleStreak(
  takenAt: readonly number[],
  intervalHours: number,
  now: number,
): ScheduleStreak {
  if (takenAt.length === 0 || intervalHours <= 0) return { current: 0, best: 0 };

  const ordered = [...takenAt].sort((a, b) => a - b);
  const maxGap = intervalHours * HOUR_MS * 1.5;
  let running = 1;
  let best = 1;

  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (current === undefined || previous === undefined) continue;
    running = current - previous <= maxGap ? running + 1 : 1;
    best = Math.max(best, running);
  }

  const latest = ordered[ordered.length - 1];
  return {
    current: latest !== undefined && now - latest <= maxGap ? running : 0,
    best,
  };
}

function parseReminderTime(value: string): { hour: number; minute: number } {
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

function isWeekday(value: number | null): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return Number.isInteger(value) && value !== null && value >= 0 && value <= 6;
}
