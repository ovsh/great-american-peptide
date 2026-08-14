// The dose each day of the plan carries, when the user set more than one.
//
// A medication holds one default dose, and for most users that stays the whole
// story. This map is the exception a customer asked for: 6 mg on Monday and
// 2 mg on Thursday under one medication, so the level chart reads one history
// instead of a Reta1 and a Reta2. Every number in the map is user input. Poke
// proposes no dose and no split, the same line the default dose already holds.
//
// Stored as JSON in `medications.dose_by_day`, keyed by the `Date.getDay()`
// weekday the way the `weekdays` bitmask is. Read it with `parseDoseByDay`,
// never with a bare JSON.parse: a row damaged on disk or written by a build
// this one does not know reads as null, which is the single-dose medication it
// would have been anyway.
//
// Pure, and tested with `npx tsx src/domain/doseByDay.test.ts`.

import type { FrequencyKind, Unit } from './peptides';
import { WEEKDAY_OPTIONS, isWeekday, weekdaysFromMask, type Weekday } from './scheduling';
import { formatDose } from './units';

export type DoseByDay = Partial<Record<Weekday, number>>;

/**
 * The map a row holds, or null when it holds none.
 *
 * Strict on purpose: one bad entry reads the whole map as null rather than as
 * the good half of a plan. Half a dose plan applied silently is worse than the
 * default dose, because the default is at least the number the user can see.
 */
export function parseDoseByDay(raw: string | null): DoseByDay | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const map: DoseByDay = {};
  let entries = 0;
  for (const [key, value] of Object.entries(parsed)) {
    const weekday = Number(key);
    if (!isWeekday(weekday)) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    map[weekday] = value;
    entries += 1;
  }
  return entries > 0 ? map : null;
}

/** The column value for a map, and null for a map with nothing in it. */
export function serializeDoseByDay(map: DoseByDay): string | null {
  const out: Record<string, number> = {};
  let entries = 0;
  for (const option of WEEKDAY_OPTIONS) {
    const dose = map[option.value];
    if (dose === undefined) continue;
    out[String(option.value)] = dose;
    entries += 1;
  }
  return entries > 0 ? JSON.stringify(out) : null;
}

/** The dose one weekday carries, which is the default on a day the map skips. */
export function doseForWeekday(map: DoseByDay | null, defaultDose: number, weekday: Weekday): number {
  return map?.[weekday] ?? defaultDose;
}

/**
 * The dose a moment carries, straight off the row.
 *
 * The one call most screens need: the raw column, the default beside it, and
 * the day being drawn. Parsing on every call keeps the call sites to one line,
 * and the maps are seven entries at most.
 */
export function doseOnDay(raw: string | null, defaultDose: number, timestamp: number): number {
  return doseForWeekday(parseDoseByDay(raw), defaultDose, localWeekday(timestamp));
}

/** The largest dose the row can ask for on any day. The dose wheel's ceiling. */
export function maxPlannedDose(raw: string | null, defaultDose: number): number {
  const map = parseDoseByDay(raw);
  if (map === null) return defaultDose;
  return Math.max(defaultDose, ...Object.values(map));
}

/**
 * The weekdays a schedule names, in the order the week is offered on screen.
 *
 * Empty for the kinds that name no weekday. `daily` is every day, and one dose
 * covers a week of identical days, so it returns empty on purpose: a seven-row
 * dose sheet is a form nobody asked for. `every_n_days` walks off the week
 * grid entirely.
 */
export function scheduledWeekdays(
  frequencyKind: FrequencyKind,
  frequencyValue: number | null,
): Weekday[] {
  switch (frequencyKind) {
    case 'weekly':
      return isWeekday(frequencyValue) ? [frequencyValue] : [];
    case 'twice_weekly': {
      if (!isWeekday(frequencyValue)) return [];
      // The second day sits three days after the first, the same arithmetic
      // `isScheduledDay` runs in scheduling.ts.
      const second = ((frequencyValue + 3) % 7) as Weekday;
      return sortWeekOrder([frequencyValue, second]);
    }
    case 'weekdays':
      return weekdaysFromMask(frequencyValue);
    case 'daily':
    case 'every_n_days':
    case 'custom':
      return [];
    default: {
      const exhaustive: never = frequencyKind;
      return exhaustive;
    }
  }
}

/**
 * The plan as one line: "6.0 mg on Monday and 2.0 mg on Thursday".
 *
 * An enumerated list keeps its commas, so three days read
 * "a on Monday, b on Wednesday and c on Friday". Empty for an empty map, so
 * the caller falls back to the single dose rather than printing a bare "and".
 */
export function doseByDayLabel(map: DoseByDay, unit: Unit): string {
  const parts: string[] = [];
  for (const option of WEEKDAY_OPTIONS) {
    const dose = map[option.value];
    if (dose === undefined) continue;
    parts.push(`${formatDose(dose, unit)} on ${option.label}`);
  }
  const last = parts[parts.length - 1];
  if (last === undefined) return '';
  return parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`;
}

function sortWeekOrder(weekdays: readonly Weekday[]): Weekday[] {
  const order = WEEKDAY_OPTIONS.map((option) => option.value);
  return [...weekdays].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function localWeekday(timestamp: number): Weekday {
  return new Date(timestamp).getDay() as Weekday;
}
