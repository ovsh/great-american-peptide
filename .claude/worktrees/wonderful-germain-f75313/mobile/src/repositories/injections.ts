import { getDb } from '../db/client';
import type { InjectionRow } from '../db/types';
import type { Route, Unit } from '../domain/peptides';
import { newId } from '../utils/id';

export interface NewInjection {
  medicationId: string;
  dose: number;
  unit: Unit;
  route: Route;
  siteId?: string | null;
  takenAt: number;
  scheduledAt?: number | null;
  notes?: string | null;
}

export async function listInjections(opts?: {
  medicationId?: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
}): Promise<InjectionRow[]> {
  const db = await getDb();
  const where = ['deleted_at IS NULL'];
  const args: (string | number)[] = [];
  if (opts?.medicationId) { where.push('medication_id = ?'); args.push(opts.medicationId); }
  if (opts?.fromMs !== undefined) { where.push('taken_at >= ?'); args.push(opts.fromMs); }
  if (opts?.toMs !== undefined) { where.push('taken_at <= ?'); args.push(opts.toMs); }
  const limit = opts?.limit ? `LIMIT ${Math.floor(opts.limit)}` : '';
  return db.getAllAsync<InjectionRow>(
    `SELECT * FROM injections WHERE ${where.join(' AND ')} ORDER BY taken_at DESC ${limit}`,
    args,
  );
}

export async function createInjection(input: NewInjection): Promise<InjectionRow> {
  const db = await getDb();
  const id = newId('inj');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO injections
      (id, medication_id, dose, unit, route, site_id, taken_at, scheduled_at, notes, deleted_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      id,
      input.medicationId,
      input.dose,
      input.unit,
      input.route,
      input.siteId ?? null,
      input.takenAt,
      input.scheduledAt ?? null,
      input.notes ?? null,
      now,
    ],
  );
  const row = await db.getFirstAsync<InjectionRow>(`SELECT * FROM injections WHERE id = ?`, [id]);
  if (!row) throw new Error('Failed to create injection');
  return row;
}

export async function softDeleteInjection(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE injections SET deleted_at = ? WHERE id = ?`, [Date.now(), id]);
}

export async function lastInjectionFor(medicationId: string): Promise<InjectionRow | null> {
  const db = await getDb();
  return (await db.getFirstAsync<InjectionRow>(
    `SELECT * FROM injections WHERE medication_id = ? AND deleted_at IS NULL ORDER BY taken_at DESC LIMIT 1`,
    [medicationId],
  )) ?? null;
}
