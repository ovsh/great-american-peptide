import type { InjectionRow, MeasurementRow, MedicationRow } from '../db/types';

/**
 * A side-effect row with its label already resolved. `clear` marks an all-clear
 * day, whose stored severity of 0 only fills the column: exporting it as
 * "0 of 10" would hand a clinician a symptom at the bottom of the scale.
 */
export interface ExportSideEffect {
  taken_at: number;
  effect: string;
  severity: number;
  notes: string | null;
  clear: boolean;
}

export interface ExportInput {
  medications: readonly MedicationRow[];
  injections: readonly InjectionRow[];
  weights: readonly MeasurementRow[];
  sideEffects: readonly ExportSideEffect[];
}

const HEADER = ['date', 'time', 'type', 'name', 'value', 'unit', 'detail', 'notes'] as const;

interface Row {
  takenAt: number;
  type: 'injection' | 'weight' | 'side effect';
  name: string;
  value: string;
  unit: string;
  detail: string;
  notes: string;
}

/**
 * One flat, reverse-chronological table a clinician can read without knowing
 * anything about Poke. One row per logged event — no derived or estimated
 * values, because an export that mixes measurements with model output invites
 * someone to treat our arithmetic as a clinical reading.
 */
export function buildExportCsv(input: ExportInput, now: number): string {
  const medicationNames = new Map(input.medications.map((row) => [row.id, row.name]));

  const rows: Row[] = [
    ...input.injections.map((row) => ({
      takenAt: row.taken_at,
      type: 'injection' as const,
      name: medicationNames.get(row.medication_id) ?? 'Unknown medication',
      value: String(row.dose),
      unit: row.unit,
      detail: row.site_id ?? '',
      notes: row.notes ?? '',
    })),
    ...input.weights.map((row) => ({
      takenAt: row.taken_at,
      type: 'weight' as const,
      name: 'Weight',
      value: String(row.value),
      unit: row.unit ?? '',
      detail: row.source,
      notes: row.notes ?? '',
    })),
    ...input.sideEffects.map((row) => ({
      takenAt: row.taken_at,
      type: 'side effect' as const,
      name: row.effect,
      value: row.clear ? '' : String(row.severity),
      unit: row.clear ? '' : 'of 10',
      detail: '',
      notes: row.notes ?? '',
    })),
  ].sort((a, b) => b.takenAt - a.takenAt);

  const lines = [
    `# Poke export, ${isoDate(now)}`,
    '# Personal record keeping only. Not a medical record and not medical advice.',
    HEADER.join(','),
    ...rows.map((row) => [
      isoDate(row.takenAt),
      isoTime(row.takenAt),
      row.type,
      row.name,
      row.value,
      row.unit,
      row.detail,
      row.notes,
    ].map(csvCell).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

export function exportFileName(now: number): string {
  return `poke-export-${isoDate(now)}.csv`;
}

/** RFC 4180: quote when the cell holds a comma, quote, or line break; double inner quotes. */
export function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function isoDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
