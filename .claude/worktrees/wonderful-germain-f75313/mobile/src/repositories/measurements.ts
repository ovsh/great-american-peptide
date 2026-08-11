import { getDb } from '../db/client';
import type { MeasurementKind, MeasurementRow } from '../db/types';
import { newId } from '../utils/id';

export interface NewMeasurement {
  kind: MeasurementKind;
  value: number;
  unit?: string | null;
  takenAt: number;
  notes?: string | null;
}

export interface UpdateManualMeasurement {
  value?: number;
  unit?: string | null;
  takenAt?: number;
  notes?: string | null;
}

export async function listMeasurements(kind: MeasurementKind, opts?: {
  fromMs?: number;
  toMs?: number;
  limit?: number;
}): Promise<MeasurementRow[]> {
  const db = await getDb();
  const where = ['deleted_at IS NULL', 'kind = ?'];
  const args: (string | number)[] = [kind];
  if (opts?.fromMs !== undefined) { where.push('taken_at >= ?'); args.push(opts.fromMs); }
  if (opts?.toMs !== undefined) { where.push('taken_at <= ?'); args.push(opts.toMs); }
  const limit = opts?.limit ? `LIMIT ${Math.floor(opts.limit)}` : '';
  return db.getAllAsync<MeasurementRow>(
    `SELECT * FROM measurements WHERE ${where.join(' AND ')} ORDER BY taken_at DESC ${limit}`,
    args,
  );
}

export async function createMeasurement(input: NewMeasurement): Promise<MeasurementRow> {
  const db = await getDb();
  const id = newId('m');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO measurements (id, kind, value, unit, taken_at, source, source_id, notes, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'manual', NULL, ?, NULL, ?)`,
    [id, input.kind, input.value, input.unit ?? null, input.takenAt, input.notes ?? null, now],
  );
  const row = await db.getFirstAsync<MeasurementRow>(`SELECT * FROM measurements WHERE id = ?`, [id]);
  if (!row) throw new Error('Failed to create measurement');
  return row;
}

export async function updateManualMeasurement(id: string, patch: UpdateManualMeasurement): Promise<MeasurementRow> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.value !== undefined) { sets.push('value = ?'); args.push(patch.value); }
  if (patch.unit !== undefined) { sets.push('unit = ?'); args.push(patch.unit); }
  if (patch.takenAt !== undefined) { sets.push('taken_at = ?'); args.push(patch.takenAt); }
  if (patch.notes !== undefined) { sets.push('notes = ?'); args.push(patch.notes); }
  if (sets.length === 0) {
    const existing = await db.getFirstAsync<MeasurementRow>(
      `SELECT * FROM measurements WHERE id = ? AND source = 'manual' AND deleted_at IS NULL`,
      [id],
    );
    if (!existing) throw new Error('Manual measurement not found');
    return existing;
  }
  await db.runAsync(
    `UPDATE measurements SET ${sets.join(', ')} WHERE id = ? AND source = 'manual' AND deleted_at IS NULL`,
    [...args, id],
  );
  const row = await db.getFirstAsync<MeasurementRow>(
    `SELECT * FROM measurements WHERE id = ? AND source = 'manual' AND deleted_at IS NULL`,
    [id],
  );
  if (!row) throw new Error('Manual measurement not found');
  return row;
}

export async function latestMeasurement(kind: MeasurementKind): Promise<MeasurementRow | null> {
  const db = await getDb();
  return (await db.getFirstAsync<MeasurementRow>(
    `SELECT * FROM measurements WHERE kind = ? AND deleted_at IS NULL ORDER BY taken_at DESC LIMIT 1`,
    [kind],
  )) ?? null;
}

export async function earliestMeasurement(kind: MeasurementKind): Promise<MeasurementRow | null> {
  const db = await getDb();
  return (await db.getFirstAsync<MeasurementRow>(
    `SELECT * FROM measurements WHERE kind = ? AND deleted_at IS NULL ORDER BY taken_at ASC LIMIT 1`,
    [kind],
  )) ?? null;
}
