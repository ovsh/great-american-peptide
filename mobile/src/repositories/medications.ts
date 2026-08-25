import { getDb } from '../db/client';
import type { MedicationRow, VialForm } from '../db/types';
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
  /**
   * The cycle, in days, and always a number the user typed. Poke has no default
   * length for any peptide and offers none, so undefined and null both mean the
   * user set no cycle rather than meaning "use the usual one".
   */
  cycleDaysOn?: number | null;
  cycleDaysOff?: number | null;
  /** The day week 1 counts from. Backdatable, because users arrive mid cycle. */
  cycleStartedAt?: number | null;
  /**
   * The vial label of a blend, serialized by `serializeComposition` in
   * `domain/blends.ts`. Undefined and null both mean no composition entered.
   */
  composition?: string | null;
  /**
   * The per-weekday dose map, serialized by `serializeDoseByDay` in
   * `domain/doseByDay.ts`. Undefined and null both mean one dose every day.
   */
  doseByDay?: string | null;
  /**
   * The whole vial in milligrams, off the label. A packaging fact and not a
   * dose. Undefined and null both mean the user has not said, which is also
   * what a pen carries.
   */
  vialMg?: number | null;
  /** `vial` or `pen`. Undefined and null both mean unknown, never vial. */
  vialForm?: VialForm | null;
  /**
   * The water mixed into the vial, in millilitres, and the record of a mix the
   * user made. Undefined and null both mean the user has not said.
   */
  diluentMl?: number | null;
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
      (id, name, preset_id, default_dose, default_unit, default_route, frequency_kind, frequency_value, half_life_hours, tmax_hours, color_index, status, sort_order, cycle_days_on, cycle_days_off, cycle_started_at, composition, dose_by_day, vial_mg, vial_form, diluent_ml, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM medications), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.cycleDaysOn ?? null,
      input.cycleDaysOff ?? null,
      // A cycle with no day picked starts today. No cycle leaves the column
      // null, so `scheduling.ts` keeps anchoring on `created_at`.
      input.cycleDaysOn == null ? null : (input.cycleStartedAt ?? now),
      input.composition ?? null,
      input.doseByDay ?? null,
      input.vialMg ?? null,
      input.vialForm ?? null,
      input.diluentMl ?? null,
      now,
      now,
    ],
  );
  const row = await getMedication(id);
  if (!row) throw new Error('Failed to create medication');
  return row;
}

/**
 * Everything an edit can rewrite.
 *
 * `colorIndex` is optional here and required on `NewMedication`, because a new
 * medication always gets a hue and an edit does not always carry one. Onboarding
 * rewrites the defaults of a medication the user already had, and the hue that
 * medication draws with everywhere else is not part of what onboarding asked, so
 * an absent `colorIndex` keeps the stored one.
 */
export type MedicationDefaults = Omit<NewMedication, 'colorIndex'> & { colorIndex?: number };

export async function updateMedicationDefaults(
  id: string,
  input: MedicationDefaults,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET
      name = ?, preset_id = ?, default_dose = ?, default_unit = ?, default_route = ?,
      frequency_kind = ?, frequency_value = ?, half_life_hours = ?, tmax_hours = ?,
      cycle_days_on = ?, cycle_days_off = ?, cycle_started_at = ?,
      color_index = CASE WHEN ? = 1 THEN ? ELSE color_index END,
      composition = CASE WHEN ? = 1 THEN ? ELSE composition END,
      dose_by_day = CASE WHEN ? = 1 THEN ? ELSE dose_by_day END,
      vial_mg = CASE WHEN ? = 1 THEN ? ELSE vial_mg END,
      vial_form = CASE WHEN ? = 1 THEN ? ELSE vial_form END,
      diluent_ml = CASE WHEN ? = 1 THEN ? ELSE diluent_ml END,
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
      input.cycleDaysOn ?? null,
      input.cycleDaysOff ?? null,
      // Turning the cycle off clears the anchor, which hands the schedule back
      // to `created_at`. The editor always sends the day it drew, so an edit
      // that leaves the cycle alone rewrites the same number.
      input.cycleDaysOn == null ? null : (input.cycleStartedAt ?? Date.now()),
      // The same keep-or-write split as the two columns below. The medication
      // form always sends the hue it drew, so undefined only comes from a
      // caller that shows no colour picker.
      input.colorIndex === undefined ? 0 : 1,
      input.colorIndex ?? 0,
      // Undefined means the caller never drew the composition, so the row
      // keeps what it holds. Null is the user clearing it, and that writes.
      input.composition === undefined ? 0 : 1,
      input.composition ?? null,
      // The same keep-or-write split. The form always sends the map it drew,
      // so undefined only comes from callers that never touch doses.
      input.doseByDay === undefined ? 0 : 1,
      input.doseByDay ?? null,
      // The same keep-or-write split again. A caller that never asked about the
      // vial leaves both columns alone, so a second pass through setup with the
      // vial question deferred does not wipe a size the user gave the first
      // time. Null is the user clearing it, and that writes.
      input.vialMg === undefined ? 0 : 1,
      input.vialMg ?? null,
      input.vialForm === undefined ? 0 : 1,
      input.vialForm ?? null,
      // The same keep-or-write split once more. A caller that never asked about
      // the mix leaves the column alone, so an editor that draws no water field
      // cannot wipe the mix the setup run saved. Null is the user clearing it.
      input.diluentMl === undefined ? 0 : 1,
      input.diluentMl ?? null,
      Date.now(),
      id,
    ],
  );
}

/**
 * Status, and the one date that goes with it.
 *
 * `paused_at` is written on every pause, whether or not the medication has a
 * cycle: the break readout needs a date, and a column filled only for the
 * medications that had a cycle at pause time would leave a user who adds the
 * cycle afterwards with a break that started at no time at all. Archiving keeps
 * whatever date is there, because an archived medication shows no cycle anyway.
 */
export async function setMedicationStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  if (status === 'paused') {
    await db.runAsync(
      `UPDATE medications SET status = 'paused', paused_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id],
    );
    return;
  }
  await db.runAsync(`UPDATE medications SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
}

/**
 * Back on, and a new cycle from today.
 *
 * A resume is the start of the next cycle rather than the continuation of the
 * last one, so week 1 counts from today and the shot days count from today too.
 * The confirm sheet on `medications/index.tsx` says exactly that before this
 * runs, because the old anchor cannot be recovered once it is overwritten.
 */
export async function resumeMedication(id: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE medications SET
       status = 'active',
       cycle_started_at = CASE WHEN cycle_days_on IS NULL THEN cycle_started_at ELSE ? END,
       paused_at = NULL,
       updated_at = ?
     WHERE id = ?`,
    [now, now, id],
  );
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
