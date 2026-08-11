import type { InjectionRow, MedicationRow } from '@/db/types';

/** Where a medication stands today. One state, read by the band, the row chip and the axis. */
export type DoseState =
  | { kind: 'due'; scheduledAt: number }
  | { kind: 'upcoming'; scheduledAt: number }
  | { kind: 'loggedToday'; injection: InjectionRow; nextScheduledAt: number | null }
  | { kind: 'unscheduled' };

/** One mark under one day of the week axis, for the focused medication only. */
export type DayMark = 'logged' | 'due' | 'scheduled' | 'rest';

export interface WeekDay {
  dayStart: number;
  mark: DayMark;
  isToday: boolean;
}

export interface LevelPoint {
  t: number;
  v: number;
}

/**
 * What the hero card can draw. Every branch is a picture:
 *
 * - `curve`  — the estimated level, solid up to now and dashed to the next dose.
 * - `shots`  — no half-life to model, so the logged shots themselves, on a line.
 * - `empty`  — a half-life but nothing logged yet, so the bare axis and a hint.
 */
export type LevelSeries =
  | {
    kind: 'curve';
    past: readonly LevelPoint[];
    future: readonly LevelPoint[];
    current: number;
    nextDoseAt: number | null;
  }
  | { kind: 'shots'; shots: readonly number[] }
  | { kind: 'empty'; nextDoseAt: number | null };

export interface TodayMedicationSummary {
  medication: MedicationRow;
  dose: DoseState;
  week: readonly WeekDay[];
  level: LevelSeries;
  /** The x range of the hero chart: the level window behind now, the next dose ahead of it. */
  windowFromMs: number;
  windowToMs: number;
}
