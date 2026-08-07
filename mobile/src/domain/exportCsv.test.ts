import type { InjectionRow, MeasurementRow, MedicationRow, SideEffectLogRow } from '../db/types.ts';
import { buildExportCsv, csvCell, exportFileName } from './exportCsv.ts';

process.env.TZ = 'America/Chicago';

const NOW = localTime(2026, 8, 7, 11);

test('cells are quoted only when they need it', () => {
  assertEqual(csvCell('Nausea'), 'Nausea', 'plain');
  assertEqual(csvCell('felt rough, then fine'), '"felt rough, then fine"', 'comma');
  assertEqual(csvCell('he said "ok"'), '"he said ""ok"""', 'inner quotes');
  assertEqual(csvCell('two\nlines'), '"two\nlines"', 'newline');
});

test('the file name carries the export date', () => {
  assertEqual(exportFileName(NOW), 'poke-export-2026-08-07.csv', 'file name');
});

test('every event kind lands in one reverse-chronological table', () => {
  const csv = buildExportCsv({
    medications: [med('m1', 'Tirzepatide')],
    injections: [injection('i1', 'm1', 2.5, localTime(2026, 8, 1, 9))],
    weights: [weight('w1', 196.4, localTime(2026, 8, 5, 7))],
    sideEffects: [sideEffect('s1', 'Nausea', 4, localTime(2026, 8, 3, 20))],
  }, NOW);

  const lines = csv.trim().split('\n');
  assertEqual(lines[0], '# Poke export, 2026-08-07', 'title comment');
  assertEqual(lines[2], 'date,time,type,name,value,unit,detail,notes', 'header');
  assertEqual(lines[3], '2026-08-05,07:00,weight,Weight,196.4,lb,manual,', 'newest first');
  assertEqual(lines[4], '2026-08-03,20:00,side effect,Nausea,4,of 10,,', 'then the side effect');
  assertEqual(lines[5], '2026-08-01,09:00,injection,Tirzepatide,2.5,mg,left_thigh,', 'then the injection');
  assertEqual(lines.length, 6, 'no extra rows');
});

test('an injection for a deleted medication still exports', () => {
  const csv = buildExportCsv({
    medications: [],
    injections: [injection('i1', 'gone', 0.25, localTime(2026, 8, 1, 9))],
    weights: [],
    sideEffects: [],
  }, NOW);
  assertEqual(csv.includes('Unknown medication'), true, 'named rather than dropped');
});

test('notes with commas do not break the columns', () => {
  const csv = buildExportCsv({
    medications: [med('m1', 'Tirzepatide')],
    injections: [{ ...injection('i1', 'm1', 2.5, localTime(2026, 8, 1, 9)), notes: 'sore, but fine' }],
    weights: [],
    sideEffects: [],
  }, NOW);
  const row = csv.trim().split('\n')[3];
  assertEqual(row.endsWith(',"sore, but fine"'), true, 'quoted note');
  assertEqual(row.split(',').length, 9, 'the comma stays inside the quoted cell');
});

test('an empty log still produces a readable file', () => {
  const csv = buildExportCsv({ medications: [], injections: [], weights: [], sideEffects: [] }, NOW);
  assertEqual(csv.trim().split('\n').length, 3, 'two comments and a header');
});

function med(id: string, name: string): MedicationRow {
  return { id, name, preset_id: null, default_dose: 1, default_unit: 'mg', default_route: 'sc', frequency_kind: 'weekly', frequency_value: 1, half_life_hours: 165, tmax_hours: 24, color_index: 0, status: 'active', created_at: 0, updated_at: 0 } as MedicationRow;
}

function injection(id: string, medicationId: string, dose: number, takenAt: number): InjectionRow {
  return { id, medication_id: medicationId, dose, unit: 'mg', route: 'sc', site_id: 'left_thigh', taken_at: takenAt, scheduled_at: null, notes: null, deleted_at: null, created_at: takenAt } as InjectionRow;
}

function weight(id: string, value: number, takenAt: number): MeasurementRow {
  return { id, kind: 'weight', value, unit: 'lb', taken_at: takenAt, source: 'manual', source_id: null, notes: null, deleted_at: null, created_at: takenAt } as MeasurementRow;
}

function sideEffect(id: string, effect: string, severity: number, takenAt: number): SideEffectLogRow {
  return { id, effect, severity, taken_at: takenAt, notes: null, deleted_at: null, created_at: takenAt };
}

function localTime(year: number, month: number, day: number, hour: number): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  console.assert(actual === expected, `${label}: expected ${String(expected)}, received ${String(actual)}`);
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
