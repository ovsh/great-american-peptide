// Curated peptide preset library. Half-lives sourced from published literature
// where available; research-community references for non-FDA peptides.
// Users can override any value when adding a custom medication.

export type Unit = 'mg' | 'mcg' | 'iu';
export type Route = 'sc' | 'im';
export type FrequencyKind = 'daily' | 'every_n_days' | 'weekly' | 'twice_weekly' | 'custom';

export interface PeptidePreset {
  id: string;
  name: string;
  category: 'glp1' | 'recovery' | 'longevity' | 'growth' | 'other';
  defaultDose: number;
  unit: Unit;
  defaultRoute: Route;
  halfLifeHours: number;
  // Time to peak plasma concentration after SC injection (Tmax). Drives the
  // absorption-phase rise in the PK forecast. From published trial data
  // where available; community estimates otherwise.
  tmaxHours: number;
  defaultFrequency: { kind: FrequencyKind; value?: number };
  source: string;
}

export const peptidePresets: PeptidePreset[] = [
  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    category: 'glp1',
    defaultDose: 2.5,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 117,
    tmaxHours: 24,
    defaultFrequency: { kind: 'weekly' },
    source: 'FDA label (Mounjaro/Zepbound)',
  },
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    category: 'glp1',
    defaultDose: 0.25,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 165,
    tmaxHours: 48,
    defaultFrequency: { kind: 'weekly' },
    source: 'FDA label (Ozempic/Wegovy)',
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    category: 'glp1',
    defaultDose: 2,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 144,
    tmaxHours: 24,
    defaultFrequency: { kind: 'weekly' },
    source: 'Eli Lilly Phase 2 trials',
  },
  {
    id: 'bpc-157',
    name: 'BPC-157',
    category: 'recovery',
    defaultDose: 250,
    unit: 'mcg',
    defaultRoute: 'sc',
    halfLifeHours: 4,
    tmaxHours: 0.75,
    defaultFrequency: { kind: 'daily' },
    source: 'Research-community consensus',
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    category: 'recovery',
    defaultDose: 2.5,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 48,
    tmaxHours: 1.5,
    defaultFrequency: { kind: 'twice_weekly' },
    source: 'Thymosin Beta-4 research',
  },
  {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'growth',
    defaultDose: 200,
    unit: 'mcg',
    defaultRoute: 'sc',
    halfLifeHours: 2,
    tmaxHours: 0.5,
    defaultFrequency: { kind: 'daily' },
    source: 'Pharmacokinetic studies',
  },
  {
    id: 'cjc-1295',
    name: 'CJC-1295 (DAC)',
    category: 'growth',
    defaultDose: 100,
    unit: 'mcg',
    defaultRoute: 'sc',
    halfLifeHours: 168,
    tmaxHours: 24,
    defaultFrequency: { kind: 'weekly' },
    source: 'Theratechnologies trial data',
  },
  {
    id: 'nad-plus',
    name: 'NAD+',
    category: 'longevity',
    defaultDose: 100,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 8,
    tmaxHours: 2,
    defaultFrequency: { kind: 'twice_weekly' },
    source: 'Research community',
  },
  {
    id: 'epitalon',
    name: 'Epitalon',
    category: 'longevity',
    defaultDose: 10,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 1.5,
    tmaxHours: 0.5,
    defaultFrequency: { kind: 'daily' },
    source: 'Khavinson research',
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    category: 'recovery',
    defaultDose: 2,
    unit: 'mg',
    defaultRoute: 'sc',
    halfLifeHours: 12,
    tmaxHours: 1,
    defaultFrequency: { kind: 'daily' },
    source: 'Pickart copper-peptide research',
  },
];

export function getPreset(id: string): PeptidePreset | undefined {
  return peptidePresets.find((p) => p.id === id);
}
