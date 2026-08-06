import {
  medicationScheduleFromStored,
  scheduledDosesBetween,
  type MedicationSchedule,
  type ScheduledDose,
} from './scheduling.ts';
import type { FrequencyKind } from './peptides';

export const SCHEDULE_GRACE_DAYS = 1 as const;
export type ScheduleGraceDays = typeof SCHEDULE_GRACE_DAYS;

export interface StreakInjection {
  id: string;
  medicationId: string;
  takenAt: number;
}

export interface ScheduledDoseWindow {
  dose: ScheduledDose;
  graceDays: ScheduleGraceDays;
  opensAt: number;
  closesAt: number;
}

export type StreakWeekStatus = 'complete' | 'pending' | 'missed';

export interface StreakWeek {
  startsAt: number;
  status: StreakWeekStatus;
}

export interface ScheduleStreak {
  current: number;
  best: number;
  weeks: StreakWeek[];
}

export interface StreakMedication {
  id: string;
  frequencyKind: FrequencyKind;
  frequencyValue: number | null;
  createdAt: number;
}

export function computeMedicationScheduleStreak({
  medications,
  injections,
  reminderTime,
  now,
}: {
  medications: readonly StreakMedication[];
  injections: readonly StreakInjection[];
  reminderTime: string;
  now: number;
}): ScheduleStreak | null {
  const schedules: MedicationSchedule[] = [];
  for (const medication of medications) {
    const schedule = medicationScheduleFromStored({
      medicationId: medication.id,
      frequencyKind: medication.frequencyKind,
      frequencyValue: medication.frequencyValue,
      createdAt: medication.createdAt,
      reminderTime,
    });
    if (!schedule) return null;
    schedules.push(schedule);
  }
  return computeScheduleStreak({ schedules, injections, now });
}

export function computeScheduleStreak({
  schedules,
  injections,
  now,
}: {
  schedules: readonly MedicationSchedule[];
  injections: readonly StreakInjection[];
  now: number;
}): ScheduleStreak {
  if (schedules.length === 0) return { current: 0, best: 0, weeks: [] };

  const firstDay = Math.min(...schedules.map((schedule) => schedule.startsAt));
  const through = addLocalDays(startOfLocalWeek(now), 6);
  const windows = schedules
    .flatMap((schedule) => scheduledDosesBetween(schedule, firstDay, through))
    .map(scheduledDoseWindow)
    .sort((left, right) => left.dose.scheduledAt - right.dose.scheduledAt);

  const matched = matchWindows(windows, injections);
  const byWeek = new Map<number, StreakWeekStatus[]>();

  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    if (!window) continue;
    const week = startOfLocalWeek(window.dose.scheduledDay);
    const statuses = byWeek.get(week) ?? [];
    statuses.push(matched.has(index) ? 'complete' : now < window.closesAt ? 'pending' : 'missed');
    byWeek.set(week, statuses);
  }

  const weeks = Array.from(byWeek, ([startsAt, statuses]): StreakWeek => ({
    startsAt,
    status: statuses.includes('missed')
      ? 'missed'
      : statuses.includes('pending')
        ? 'pending'
        : 'complete',
  })).sort((left, right) => left.startsAt - right.startsAt);

  let running = 0;
  let best = 0;
  for (const week of weeks) {
    running = week.status === 'complete' ? running + 1 : 0;
    best = Math.max(best, running);
  }

  let current = 0;
  let index = weeks.length - 1;
  while (index >= 0 && weeks[index]?.status === 'pending') index -= 1;
  while (index >= 0 && weeks[index]?.status === 'complete') {
    current += 1;
    index -= 1;
  }

  return { current, best, weeks };
}

export function scheduledDoseWindow(dose: ScheduledDose): ScheduledDoseWindow {
  return {
    dose,
    graceDays: SCHEDULE_GRACE_DAYS,
    opensAt: addLocalDays(dose.scheduledDay, -SCHEDULE_GRACE_DAYS),
    closesAt: addLocalDays(dose.scheduledDay, SCHEDULE_GRACE_DAYS + 1),
  };
}

function matchWindows(
  windows: readonly ScheduledDoseWindow[],
  injections: readonly StreakInjection[],
): Set<number> {
  const matched = new Set<number>();
  const medicationIds = new Set(windows.map((window) => window.dose.medicationId));

  for (const medicationId of medicationIds) {
    const medicationWindows = windows
      .map((window, index) => ({ window, index }))
      .filter((item) => item.window.dose.medicationId === medicationId);
    const medicationInjections = injections
      .filter((injection) => injection.medicationId === medicationId)
      .slice()
      .sort((left, right) => left.takenAt - right.takenAt);
    let injectionIndex = 0;

    for (const item of medicationWindows) {
      while (
        injectionIndex < medicationInjections.length
        && (medicationInjections[injectionIndex]?.takenAt ?? Number.POSITIVE_INFINITY) < item.window.opensAt
      ) {
        injectionIndex += 1;
      }
      const injection = medicationInjections[injectionIndex];
      if (injection && injection.takenAt < item.window.closesAt) {
        matched.add(item.index);
        injectionIndex += 1;
      }
    }
  }
  return matched;
}

function startOfLocalWeek(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

function addLocalDays(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
