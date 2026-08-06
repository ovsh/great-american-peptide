import { getDb } from '../db/client';
import type { SideEffectKind, SideEffectLogRow } from '../db/types';
import { newId } from '../utils/id';

export interface NewSideEffect {
  effect: SideEffectKind;
  severity: number;
  takenAt: number;
  notes?: string | null;
}

export async function listSideEffects(opts?: {
  effect?: SideEffectKind;
  fromMs?: number;
  toMs?: number;
  limit?: number;
}): Promise<SideEffectLogRow[]> {
  const db = await getDb();
  const where = ['deleted_at IS NULL'];
  const args: (string | number)[] = [];
  if (opts?.effect !== undefined) {
    where.push('effect = ?');
    args.push(opts.effect);
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
  return db.getAllAsync<SideEffectLogRow>(
    `SELECT * FROM side_effect_logs WHERE ${where.join(' AND ')} ORDER BY taken_at DESC ${limit}`,
    args,
  );
}

export async function createSideEffect(input: NewSideEffect): Promise<SideEffectLogRow> {
  const db = await getDb();
  const id = newId('se');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO side_effect_logs (id, effect, severity, taken_at, notes, deleted_at, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, input.effect, input.severity, input.takenAt, input.notes ?? null, now],
  );
  const row = await db.getFirstAsync<SideEffectLogRow>(
    `SELECT * FROM side_effect_logs WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error('Failed to create side-effect log');
  return row;
}

export async function softDeleteSideEffect(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE side_effect_logs SET deleted_at = ? WHERE id = ?`, [Date.now(), id]);
}
