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

/** The last time one site carried a shot of one medication. */
export interface SiteUse {
  siteId: string;
  takenAt: number;
}

/**
 * The last use of every site this medication has gone into, newest first.
 *
 * Rotation asks one question: which site has waited longest for this medication.
 * `recommendNextSite` reduces a history to exactly this, so the query reduces it
 * instead and the screen holds no row it does not need.
 *
 * A capped list of recent shots cannot answer the question. On two daily
 * medications the cap fills with the other medication, a site this medication
 * used last month falls off the end and reads as never used, and the two
 * medications then push each other around the body.
 */
export async function lastSiteUseFor(medicationId: string): Promise<SiteUse[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ site_id: string; taken_at: number }>(
    `SELECT site_id, MAX(taken_at) AS taken_at
       FROM injections
      WHERE medication_id = ? AND deleted_at IS NULL AND site_id IS NOT NULL
      GROUP BY site_id
      ORDER BY taken_at DESC`,
    [medicationId],
  );
  return rows.map((row) => ({ siteId: row.site_id, takenAt: row.taken_at }));
}

/** One shot, cut down to the two fields a calendar square draws. */
export interface InjectionMark {
  takenAt: number;
  medicationId: string;
}

/**
 * The shots inside a range, as the two fields a month grid needs.
 *
 * A month of two daily medications is about sixty of these. The grid used to
 * read a capped list of every shot ever logged, so a user past the cap saw empty
 * squares over months that hold shots, and the day card under them said so.
 */
export async function listInjectionMarks(fromMs: number, toMs: number): Promise<InjectionMark[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ taken_at: number; medication_id: string }>(
    `SELECT taken_at, medication_id FROM injections
      WHERE deleted_at IS NULL AND taken_at >= ? AND taken_at <= ?
      ORDER BY taken_at DESC`,
    [fromMs, toMs],
  );
  return rows.map((row) => ({ takenAt: row.taken_at, medicationId: row.medication_id }));
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
