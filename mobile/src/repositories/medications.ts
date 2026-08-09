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

export async function listMedications(includeArchived = false): Promise<MedicationRow[]> {
  const db = await getDb();
  if (includeArchived) {
    return db.getAllAsync<MedicationRow>(
      `SELECT * FROM medications ORDER BY status='active' DESC, name COLLATE NOCASE`,
    );
  }
  return db.getAllAsync<MedicationRow>(
    `SELECT * FROM medications WHERE status != 'archived' ORDER BY name COLLATE NOCASE`,
  );
}

/** The free tier keeps one medication. An archived one does not count against it. */
export const FREE_MEDICATION_LIMIT = 1;

export async function countActiveMedications(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM medications WHERE status != 'archived'`,
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
      (id, name, preset_id, default_dose, default_unit, default_route, frequency_kind, frequency_value, half_life_hours, tmax_hours, color_index, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
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
