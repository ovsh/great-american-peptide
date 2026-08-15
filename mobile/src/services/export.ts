import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { openUnmigratedDb } from '../db/client';
import { getBodySite } from '../domain/bodySites';
import { buildExportCsv, exportFileName, type ExportSideEffect } from '../domain/exportCsv';
import { parseStoredSideEffect, sideEffectLabel } from '../domain/sideEffects';
import type { InjectionRow, MeasurementRow, MedicationRow } from '../db/types';
import { listInjections } from '../repositories/injections';
import { listMeasurements } from '../repositories/measurements';
import { listMedications } from '../repositories/medications';
import { listSideEffects } from '../repositories/sideEffects';
import { track } from './analytics';

export type ExportOutcome =
  | { kind: 'shared' }
  | { kind: 'dismissed' }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string };

/**
 * `SC in the upper left abdomen`. The CSV has no route column, so the route
 * rides in the detail column with the site. An id Poke no longer knows stays
 * as it is rather than becoming a blank cell.
 *
 * Both arguments are nullable because the rescue export below reads them off a
 * schema it has never seen, where either column can be absent.
 */
function injectionDetail(route: string | null, siteId: string | null): string {
  const label = route ? route.toUpperCase() : '';
  if (!siteId) return label;
  const site = getBodySite(siteId);
  const where = `in the ${site ? site.label.toLocaleLowerCase() : siteId}`;
  return label ? `${label} ${where}` : where;
}

export async function exportHistory(now = Date.now()): Promise<ExportOutcome> {
  try {
    const [medications, injections, weights, sideEffectLogs] = await Promise.all([
      listMedications(true),
      listInjections({ limit: 5000 }),
      listMeasurements('weight', { limit: 5000 }),
      listSideEffects({ limit: 5000 }),
    ]);

    if (injections.length === 0 && weights.length === 0 && sideEffectLogs.length === 0) {
      return { kind: 'empty' };
    }

    const csv = buildExportCsv({
      medications,
      // The file writes `site_id` into the detail column, and a clinician reads
      // the file without knowing Poke. So the column carries the route and the
      // site label instead of the storage key.
      injections: injections.map((row) => ({
        ...row,
        site_id: injectionDetail(row.route, row.site_id),
      })),
      weights,
      // The store keeps effects as a parsed shape; the file wants the label a
      // human reads, and the clear flag so an all-clear day exports without a
      // severity it never had.
      sideEffects: sideEffectLogs.map((log) => ({
        taken_at: log.taken_at,
        effect: sideEffectLabel(log.effect),
        severity: log.severity,
        notes: log.notes,
        clear: log.effect.kind === 'clear',
      })),
    }, now);

    return await shareCsv(csv, now);
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : 'The export did not finish.';
    return { kind: 'failed', message };
  }
}

/** Writes the file into the cache and hands it to the system share sheet. */
async function shareCsv(csv: string, now: number): Promise<ExportOutcome> {
  const file = new File(Paths.cache, exportFileName(now));
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  // iOS shares a file by url; Android's share sheet only takes text.
  const result = Platform.OS === 'ios'
    ? await Share.share({ url: file.uri })
    : await Share.share({ message: csv });

  if (result.action === Share.dismissedAction) return { kind: 'dismissed' };
  // The file itself never leaves the phone by this route, so the event says
  // only that an export reached the share sheet.
  track('export_csv');
  return { kind: 'shared' };
}

/**
 * The columns the CSV needs from each table. Nothing else is read, and a column
 * that is not in the file is simply not selected.
 */
const RESCUE_COLUMNS = {
  medications: ['id', 'name'],
  injections: ['medication_id', 'dose', 'unit', 'route', 'site_id', 'taken_at', 'notes'],
  measurements: ['kind', 'value', 'unit', 'taken_at', 'source', 'notes'],
  side_effect_logs: ['effect', 'severity', 'taken_at', 'notes'],
} as const;

type RescueTable = keyof typeof RESCUE_COLUMNS;
type RescueRow = Record<string, string | number | null>;

/**
 * The export the launch error screen offers, for a database Poke could not
 * upgrade.
 *
 * It opens the file on its own read-only connection and runs no migration, so
 * the schema it meets is by definition not the schema the app expects: a
 * migration stopped halfway leaves a table short a column, and a database from
 * a build older than this one is short whole tables. Every read here is
 * therefore asked of `PRAGMA table_info` first, and a table or a column that is
 * not there costs its own cells and never the file.
 *
 * It does not check the Poke Pro entitlement that gates the export in Profile.
 * A user who cannot open the app cannot buy anything either, and a person
 * locked out of their own records is owed the way out.
 */
export async function exportWithoutMigrating(now = Date.now()): Promise<ExportOutcome> {
  let db: SQLiteDatabase | null = null;
  try {
    db = await openUnmigratedDb();

    const read = {
      medications: await readWhatIsThere(db, 'medications'),
      injections: await readWhatIsThere(db, 'injections'),
      measurements: await readWhatIsThere(db, 'measurements'),
      side_effect_logs: await readWhatIsThere(db, 'side_effect_logs'),
    };

    // Null is a table Poke could not read, and an empty array is a table that
    // holds no rows. When all four come back null the file is unreadable, and
    // saying "nothing to export" there would tell a user their history is gone.
    if (Object.values(read).every((rows) => rows === null)) {
      return { kind: 'failed', message: 'Poke could not read any table in this database file.' };
    }

    const medicationRows = read.medications ?? [];
    const injectionRows = read.injections ?? [];
    const sideEffectRows = read.side_effect_logs ?? [];

    // A weight and a height live in one table, and only the weights have a lane
    // in the file. A database with no `kind` column cannot tell them apart, and
    // that is a schema no Poke build has ever written, so those rows go in
    // rather than being dropped on a guess.
    const weightRows = (read.measurements ?? [])
      .filter((row) => !('kind' in row) || row.kind === 'weight');

    if (injectionRows.length === 0 && weightRows.length === 0 && sideEffectRows.length === 0) {
      return { kind: 'empty' };
    }

    // The zeros below only ever appear for a column the file does not hold, so
    // they stand for "this database never said", not for a measured zero.
    const medications = medicationRows.map((row) => ({
      id: textAt(row, 'id') ?? '',
      name: textAt(row, 'name') ?? 'Unknown medication',
    }));

    const injections = injectionRows.map((row) => ({
      taken_at: numberAt(row, 'taken_at'),
      medication_id: textAt(row, 'medication_id') ?? '',
      dose: numberAt(row, 'dose'),
      unit: textAt(row, 'unit') ?? '',
      site_id: injectionDetail(textAt(row, 'route'), textAt(row, 'site_id')),
      notes: textAt(row, 'notes'),
    }));

    const weights = weightRows.map((row) => ({
      taken_at: numberAt(row, 'taken_at'),
      value: numberAt(row, 'value'),
      unit: textAt(row, 'unit'),
      source: textAt(row, 'source') ?? 'manual',
      notes: textAt(row, 'notes'),
    }));

    const sideEffects: ExportSideEffect[] = sideEffectRows.map((row) => {
      const stored = textAt(row, 'effect');
      const effect = stored ? parseStoredSideEffect(stored) : null;
      return {
        taken_at: numberAt(row, 'taken_at'),
        effect: effect ? sideEffectLabel(effect) : 'Side effect',
        severity: numberAt(row, 'severity'),
        notes: textAt(row, 'notes'),
        clear: effect?.kind === 'clear',
      };
    });

    // The builder reads two columns off a medication, six off an injection and
    // five off a weight, and it takes the full row types. The casts hand it
    // less than the types promise on purpose: a rescue row carries what the
    // database held, and no column is invented to satisfy a type.
    const csv = buildExportCsv({
      medications: medications as MedicationRow[],
      injections: injections as unknown as InjectionRow[],
      weights: weights as unknown as MeasurementRow[],
      sideEffects,
    }, now);

    return await shareCsv(csv, now);
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : 'The export did not finish.';
    return { kind: 'failed', message };
  } finally {
    if (db) await db.closeAsync().catch(() => {});
  }
}

/**
 * Every wanted column the table actually has, for every row it holds. Null
 * means Poke could not read the table at all, which is not the same answer as
 * a table with no rows in it.
 */
async function readWhatIsThere(db: SQLiteDatabase, table: RescueTable): Promise<RescueRow[] | null> {
  try {
    // The table name is one of the four constants above and never user input,
    // so it goes straight into the SQL. `PRAGMA` takes no bound parameter, and
    // it answers with no rows at all for a table that does not exist.
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    const present = new Set(columns.map((column) => column.name));
    const wanted = RESCUE_COLUMNS[table].filter((column) => present.has(column));
    if (wanted.length === 0) return null;
    const where = present.has('deleted_at') ? ' WHERE deleted_at IS NULL' : '';
    return await db.getAllAsync<RescueRow>(`SELECT ${wanted.join(', ')} FROM ${table}${where}`);
  } catch {
    // One unreadable table costs its own rows. The other three still export.
    return null;
  }
}

/** A number, whatever the column was declared as, or 0 when there is none. */
function numberAt(row: RescueRow, column: string): number {
  const value = row[column];
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

/** Text, whatever the column was declared as, or null when there is none. */
function textAt(row: RescueRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : String(value);
}
