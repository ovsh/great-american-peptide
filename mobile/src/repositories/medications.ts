import { getDb } from '../db/client';
import type { MedicationRow } from '../db/types';
import type { FrequencyKind, Route, Unit } from '../domain/peptides';
import { newId } from '../utils/id';

export interface NewMedication {
  name: string;
  presetId?: string | null;
  defaultDose: number;
  defaultUnit: Unit;
  defaultRoute: Route;
  frequencyKind: FrequencyKind;
  frequencyValue?: number | null;
  halfLifeHours?: number | null;
  tmaxHours?: number | null;
  colorIndex: number;
}

/**
 * The one order the app shows a medication list in: the order the user dragged
 * the rows into on Today.
 *
 * Alphabetical was the old answer, and it made the list move under the reader
 * whenever a medication was renamed and put the medication someone actually
 * cares about wherever its initial happened to fall. A row written before
 * schema version 10 has no `sort_order`; it sorts after the ones that do, by
 * the date it was added.
 */
const MEDICATION_ORDER = `sort_order IS NULL, sort_order, created_at, name COLLATE NOCASE`;

export async function listMedications(includeArchived = false): Promise<MedicationRow[]> {
  const db = await getDb();
  if (includeArchived) {
    return db.getAllAsync<MedicationRow>(
      `SELECT * FROM medications ORDER BY status='active' DESC, ${MEDICATION_ORDER}`,
    );
  }
  return db.getAllAsync<MedicationRow>(
    `SELECT * FROM medications WHERE status != 'archived' ORDER BY ${MEDICATION_ORDER}`,
  );
}

/**
 * Writes the order the user dragged the rows into. `ids` is the full list of
 * the rows on screen, first to last; a medication this does not name keeps the
 * number it had, so a list drawn without the archived rows cannot renumber them.
 */
export async function reorderMedications(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const [index, id] of ids.entries()) {
      await db.runAsync(
        `UPDATE medications SET sort_order = ?, updated_at = ? WHERE id = ?`,
        [index, now, id],
      );
    }
  });
}

/**
 * The free tier keeps two medications. The third one opens the paywall.
 *
 * Only a running medication counts. A paused or archived one does not: it draws
 * no reminder and the user has said they are not on it, so holding a slot for it
 * would charge them for a medication they stopped. The way back in is gated
 * instead — `medications/index.tsx` sends Resume and Restore to the paywall when
 * the two running slots are already full — so a free user never runs three.
 */
export const FREE_MEDICATION_LIMIT = 2;

export async function countActiveMedications(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM medications WHERE status = 'active'`,
  );
  return row?.n ?? 0;
}

export async function getMedication(id: string): Promise<MedicationRow | null> {
  const db = await getDb();
  return (await db.getFirstAsync<MedicationRow>(`SELECT * FROM medications WHERE id = ?`, [id])) ?? null;
}

export async function createMedication(input: NewMedication): Promise<MedicationRow> {
  const db = await getDb();
  const now = Date.now();
  const id = newId('med');
  await db.runAsync(
    `INSERT INTO medications
      (id, name, preset_id, default_dose, default_unit, default_route, frequency_kind, frequency_value, half_life_hours, tmax_hours, color_index, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM medications), ?, ?)`,
    [
      id,
      input.name,
      input.presetId ?? null,
      input.defaultDose,
      input.defaultUnit,
      input.defaultRoute,
      input.frequencyKind,
      input.frequencyValue ?? null,
      input.halfLifeHours ?? null,
      input.tmaxHours ?? null,
      input.colorIndex,
      now,
      now,
    ],
  );
  const row = await getMedication(id);
  if (!row) throw new Error('Failed to create medication');
  return row;
}

export async function updateMedicationDefaults(
  id: string,
  input: Omit<NewMedication, 'colorIndex'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET
      name = ?, preset_id = ?, default_dose = ?, default_unit = ?, default_route = ?,
      frequency_kind = ?, frequency_value = ?, half_life_hours = ?, tmax_hours = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      input.name,
      input.presetId ?? null,
      input.defaultDose,
      input.defaultUnit,
      input.defaultRoute,
      input.frequencyKind,
      input.frequencyValue ?? null,
      input.halfLifeHours ?? null,
      input.tmaxHours ?? null,
      Date.now(),
      id,
    ],
  );
}

export async function setMedicationStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE medications SET status = ?, updated_at = ? WHERE id = ?`, [status, Date.now(), id]);
}

/**
 * How many injection rows name each medication, keyed by medication id. Every
 * medication appears, and one with no shots reads 0.
 *
 * Soft-deleted shots count. `injections.medication_id` has no foreign key and no
 * cascade, so the row survives the medication and still names it. Counting only
 * the live rows would let a delete strand the rest.
 */
export async function countInjectionsByMedication(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; n: number }>(
    `SELECT m.id AS id, COUNT(i.id) AS n
       FROM medications m
       LEFT JOIN injections i ON i.medication_id = m.id
      GROUP BY m.id`,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.id] = row.n;
  return counts;
}

/**
 * Hard delete, and the only one in the app. Archive is the primitive for a
 * medication with history; this is for one that was added by mistake and never
 * used. The `NOT EXISTS` clause makes the rule a property of the write rather
 * than of the screen, so a caller cannot delete a medication with shots on it.
 *
 * Returns true when a row went. False means the medication still has injections
 * and the caller should archive it instead.
 */
export async function deleteMedicationIfUnused(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.runAsync(
    `DELETE FROM medications
      WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM injections WHERE medication_id = ?)`,
    [id, id],
  );
  return result.changes > 0;
}

export async function nextColorIndex(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM medications`);
  return (row?.count ?? 0) % 6;
}
