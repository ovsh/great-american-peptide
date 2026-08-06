import { getDb } from '../db/client';
import type { SideEffectLogRow } from '../db/types';
import {
  parseStoredSideEffect,
  sideEffectStorageKey,
  type SideEffect,
} from '../domain/sideEffects';
import { newId } from '../utils/id';

export interface NewSideEffect {
  effect: SideEffect;
  severity: number;
  takenAt: number;
  notes?: string | null;
}

export type SideEffectLog = Omit<SideEffectLogRow, 'effect'> & { effect: SideEffect };

export async function listSideEffects(opts?: {
  effect?: SideEffect;
  fromMs?: number;
  toMs?: number;
  limit?: number;
}): Promise<SideEffectLog[]> {
  const db = await getDb();
  const where = ['deleted_at IS NULL'];
  const args: (string | number)[] = [];
  if (opts?.effect !== undefined) {
    where.push('effect = ?');
    args.push(sideEffectStorageKey(opts.effect));
  }
  if (opts?.fromMs !== undefined) {
    where.push('taken_at >= ?');
    args.push(opts.fromMs);
  }
  if (opts?.toMs !== undefined) {
    where.push('taken_at <= ?');
    args.push(opts.toMs);
  }
  const limit = opts?.limit ? `LIMIT ${Math.floor(opts.limit)}` : '';
  const rows = await db.getAllAsync<SideEffectLogRow>(
    `SELECT * FROM side_effect_logs WHERE ${where.join(' AND ')} ORDER BY taken_at DESC ${limit}`,
    args,
  );
  return rows.map((row) => ({ ...row, effect: parseStoredSideEffect(row.effect) }));
}

export async function createSideEffect(input: NewSideEffect): Promise<SideEffectLog> {
  if (!Number.isInteger(input.severity) || input.severity < 0 || input.severity > 10) {
    throw new Error('Severity must be a whole number from 0 to 10.');
  }
  const db = await getDb();
  const id = newId('se');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO side_effect_logs (id, effect, severity, taken_at, notes, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, sideEffectStorageKey(input.effect), input.severity, input.takenAt, input.notes ?? null, now],
  );
  const row = await db.getFirstAsync<SideEffectLogRow>(
    `SELECT * FROM side_effect_logs WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error('Failed to create side-effect log');
  return { ...row, effect: parseStoredSideEffect(row.effect) };
}

export async function softDeleteSideEffect(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE side_effect_logs SET deleted_at = ? WHERE id = ?`, [Date.now(), id]);
}
