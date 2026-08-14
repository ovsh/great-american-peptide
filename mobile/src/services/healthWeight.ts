// Which Apple Health samples become weigh-ins, with no React Native or Expo
// imports, so it can be tested directly with `npx tsx`. `health.ts` owns the
// HealthKit call and the database; this file owns the reading.

import type { ImportedMeasurement } from '@/repositories/measurements';

/**
 * A body-mass sample, narrowed to the three fields Poke reads. The query asks
 * HealthKit for kilograms, so `quantity` is kilograms here and nowhere else in
 * this file is a unit named.
 */
export interface HealthWeightSample {
  readonly uuid: string;
  readonly quantity: number;
  readonly startDate: Date;
}

/**
 * The kilogram range Poke can hold. It repeats `WEIGHT_BOUNDS.kg`, the range the
 * weight wheel offers, rather than importing it, because that constant sits beside
 * the onboarding store and this file stays free of React Native. A sample outside
 * the range is a weight the user could not have entered by hand, so it is a bad
 * sample, and Poke drops it instead of drawing it on the progress chart.
 */
export const HEALTH_WEIGHT_KG = { min: 27, max: 273 } as const;

/** Thirty days. See `readWindowStart` for what the overlap is for. */
export const READ_OVERLAP_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Where the next read of Health starts, in ms, or null to read the whole history.
 *
 * A scale that was off the network writes its samples with the moment it took
 * them, not the moment it reached Health, so a read that started exactly where the
 * last one finished would step over them. Each read therefore goes back a month
 * before the last one, and the unique index from schema version 12 drops whatever
 * the overlap offers a second time.
 *
 * A missing timestamp, or one from ahead of now, reads the whole history. Both
 * cost one slow query and no wrong rows, which is the cheap side to fail on.
 */
export function readWindowStart(syncedAt: number | null, now: number): number | null {
  if (syncedAt === null) return null;
  if (!Number.isFinite(syncedAt) || syncedAt > now) return null;
  return syncedAt - READ_OVERLAP_MS;
}

/**
 * Turns the samples Health returned into rows for the measurements table, in the
 * order Health gave them.
 *
 * Health is another app's store, so its rows are not Poke's to trust. A sample can
 * carry a quantity that is not a number, a date that is not a date, or a weight no
 * body has. Each of those is dropped here, before it reaches the table, because
 * every row in that table is drawn on the progress chart and counted in the trend.
 */
export function toWeightRows(samples: readonly HealthWeightSample[]): ImportedMeasurement[] {
  const rows: ImportedMeasurement[] = [];
  for (const sample of samples) {
    if (typeof sample.uuid !== 'string' || sample.uuid.length === 0) continue;
    if (!Number.isFinite(sample.quantity)) continue;
    if (sample.quantity < HEALTH_WEIGHT_KG.min) continue;
    if (sample.quantity > HEALTH_WEIGHT_KG.max) continue;
    const takenAt = sample.startDate instanceof Date ? sample.startDate.getTime() : Number.NaN;
    if (!Number.isFinite(takenAt)) continue;
    rows.push({
      kind: 'weight',
      value: sample.quantity,
      unit: 'kg',
      takenAt,
      sourceId: sample.uuid,
    });
  }
  return rows;
}

/**
 * The newest row in a batch, or null when the batch is empty. Health returns its
 * samples in whatever order the query asked for, so the first row is not the
 * newest one and the screens must not read it as such.
 */
export function newestRow(rows: readonly ImportedMeasurement[]): ImportedMeasurement | null {
  let newest: ImportedMeasurement | null = null;
  for (const row of rows) {
    if (newest === null || row.takenAt > newest.takenAt) newest = row;
  }
  return newest;
}
