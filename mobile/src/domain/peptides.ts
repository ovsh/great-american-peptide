// Curated peptide preset library.
//
// One rule governs this file: **a half-life must have a citation.** An invented
// half-life is worse than a missing peptide, because the level curve then shows
// a number that no source supports. So each preset carries an evidence tier:
//
//   'label'     — the half-life is in an FDA (or equivalent) prescribing label.
//   'trial'     — the half-life is in a published human pharmacokinetic study.
//   'unsourced' — no human half-life is published. The preset carries no
//                 half-life, no Tmax and no level curve. The app says so.
//
// The type makes this an error you cannot write: an 'unsourced' preset cannot
// hold a half-life, and a sourced preset cannot omit one.
//
// Users can override any value when they add a custom medication.

export type Unit = 'mg' | 'mcg' | 'iu';
export type Route = 'sc' | 'im';
export type FrequencyKind = 'daily' | 'every_n_days' | 'weekly' | 'twice_weekly' | 'custom';

export type EvidenceTier = 'label' | 'trial' | 'unsourced';

interface PeptidePresetBase {
  id: string;
  name: string;
  // Brand names and trial codes. The picker searches these too, so a user who
  // knows "Zepbound" finds Tirzepatide.
  aliases?: readonly string[];
  category: 'glp1' | 'recovery' | 'longevity' | 'growth' | 'other';
  // A starting point for the schedule screen, not a recommendation. The user
  // confirms or changes it before anything is saved.
  defaultDose: number;
  unit: Unit;
  defaultRoute: Route;
  defaultFrequency: { kind: FrequencyKind; value?: number };
  // Where the half-life comes from, or why there is none. Shown on screen.
  source: string;
}

export type SourcedPeptidePreset = PeptidePresetBase & {
  evidence: 'label' | 'trial';
  halfLifeHours: number;
  // Time to peak plasma concentration after injection (Tmax). Drives the
  // absorption rise in the forecast. Null when the source does not give one;
  // `tmaxOrDefault` in pk.ts then derives a value from the half-life.
  tmaxHours: number | null;
};

export type UnsourcedPeptidePreset = PeptidePresetBase & {
  evidence: 'unsourced';
  halfLifeHours: null;
  tmaxHours: null;
};

export type PeptidePreset = SourcedPeptidePreset | UnsourcedPeptidePreset;

export const peptidePresets: PeptidePreset[] = [
  // ---------------------------------------------------------------- GLP-1 --
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    aliases: ['Ozempic', 'Wegovy', 'Rybelsus'],
    category: 'glp1',
    defaultDose: 0.25,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 165,
    tmaxHours: 48,
    source: 'FDA label for Ozempic, Wegovy. Half-life about 1 week.',
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    aliases: ['Mounjaro', 'Zepbound'],
    category: 'glp1',
    defaultDose: 2.5,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 117,
    tmaxHours: 24,
    source: 'FDA label for Mounjaro, Zepbound. Half-life about 5 days.',
  },
  {
    id: 'liraglutide',
    name: 'Liraglutide',
    aliases: ['Victoza', 'Saxenda'],
    category: 'glp1',
    defaultDose: 0.6,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 13,
    tmaxHours: 10,
    source: 'FDA label for Victoza, Saxenda. Half-life about 13 hours.',
  },
  {
    id: 'dulaglutide',
    name: 'Dulaglutide',
    aliases: ['Trulicity'],
    category: 'glp1',
    defaultDose: 0.75,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 113,
    tmaxHours: 48,
    source: 'FDA label for Trulicity. Half-life about 4.7 days.',
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    aliases: ['LY3437943', 'reta'],
    category: 'glp1',
    defaultDose: 2,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 144,
    tmaxHours: 24,
    source: 'Eli Lilly phase 1 and 2 trials. Half-life about 6 days.',
  },
  {
    id: 'survodutide',
    name: 'Survodutide',
    aliases: ['BI 456906'],
    category: 'glp1',
    defaultDose: 0.6,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 144,
    tmaxHours: null,
    source: 'Boehringer Ingelheim phase 1 trial. Half-life about 6 days.',
  },
  {
    id: 'cagrilintide',
    name: 'Cagrilintide',
    aliases: ['AM833', 'cagri'],
    category: 'glp1',
    defaultDose: 0.3,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 175,
    tmaxHours: 48,
    source: 'Phase 1b trial, Lancet 2021. Half-life 159 to 195 hours.',
  },

  // ------------------------------------------------- Growth-hormone axis --
  {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'growth',
    defaultDose: 200,
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 2,
    tmaxHours: null,
    source: 'Human PK study, Pharmaceutical Research 1999. Half-life about 2 hours.',
  },
  {
    id: 'cjc-1295',
    name: 'CJC-1295 (DAC)',
    aliases: ['CJC1295', 'DAC'],
    category: 'growth',
    defaultDose: 100,
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 168,
    tmaxHours: null,
    source: 'Human PK study, JCEM 2006. Half-life 5.8 to 8.1 days.',
  },
  {
    id: 'tesamorelin',
    name: 'Tesamorelin',
    aliases: ['Egrifta'],
    category: 'growth',
    defaultDose: 2,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 0.63,
    tmaxHours: null,
    source: 'FDA label for Egrifta. Half-life 26 to 38 minutes.',
  },
  {
    id: 'sermorelin',
    name: 'Sermorelin',
    aliases: ['Geref', 'GRF 1-29'],
    category: 'growth',
    defaultDose: 200,
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 0.2,
    tmaxHours: null,
    source: 'FDA label for Geref. Half-life about 12 minutes.',
  },
  {
    id: 'ghrp-6',
    name: 'GHRP-6',
    category: 'growth',
    defaultDose: 100,
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 2.5,
    tmaxHours: null,
    source: 'Human PK study in 9 volunteers, Eur J Pharm Sci 2012. Half-life about 2.5 hours.',
  },

  // ----------------------------------------------------------- Recovery ----
  {
    id: 'thymosin-alpha-1',
    name: 'Thymosin Alpha-1',
    aliases: ['Zadaxin', 'Ta1', 'thymalfasin'],
    category: 'recovery',
    defaultDose: 1.6,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'trial',
    halfLifeHours: 2,
    tmaxHours: null,
    source: 'Zadaxin prescribing information. Half-life about 2 hours.',
  },
  {
    id: 'bpc-157',
    name: 'BPC-157',
    category: 'recovery',
    defaultDose: 250,
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    source: 'No human half-life is published. Animal studies show less than 30 minutes.',
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    aliases: ['thymosin beta-4', 'TB4'],
    category: 'recovery',
    defaultDose: 2.5,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    source: 'No human half-life is published for this fragment.',
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    aliases: ['copper peptide'],
    category: 'recovery',
    defaultDose: 2,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    source: 'No human injection half-life is published.',
  },

  // ---------------------------------------------------------- Longevity ----
  {
    id: 'nad-plus',
    name: 'NAD+',
    category: 'longevity',
    defaultDose: 100,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    source: 'No human injection half-life is published.',
  },
  {
    id: 'epitalon',
    name: 'Epitalon',
    aliases: ['epithalon'],
    category: 'longevity',
    defaultDose: 10,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    source: 'No human half-life is published.',
  },

  // -------------------------------------------------------------- Other ----
  {
    id: 'bremelanotide',
    name: 'Bremelanotide (PT-141)',
    aliases: ['PT-141', 'PT141', 'Vyleesi'],
    category: 'other',
    defaultDose: 1.75,
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'custom' },
    evidence: 'label',
    halfLifeHours: 2.7,
    tmaxHours: 1,
    source: 'FDA label for Vyleesi. Half-life about 2.7 hours.',
  },
];

export function getPreset(id: string): PeptidePreset | undefined {
  return peptidePresets.find((p) => p.id === id);
}

// True when the preset has a cited half-life, so the app can draw a level curve
// for it. Narrows the type, so the curve code cannot read a null half-life.
export function hasPublishedHalfLife(preset: PeptidePreset): preset is SourcedPeptidePreset {
  return preset.evidence !== 'unsourced';
}

export const EVIDENCE_LABELS: Record<EvidenceTier, string> = {
  label: 'Half-life from the drug label',
  trial: 'Half-life from a human study',
  unsourced: 'No published half-life',
};

// Search across name and brand names. A name that starts with the query ranks
// above a name that only contains it, so "sem" puts Semaglutide first.
export function searchPresets(query: string): PeptidePreset[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return peptidePresets;
  const scored: { preset: PeptidePreset; score: number }[] = [];
  for (const preset of peptidePresets) {
    const haystacks = [preset.name, ...(preset.aliases ?? [])].map((value) =>
      value.toLocaleLowerCase(),
    );
    let score = -1;
    for (const [index, haystack] of haystacks.entries()) {
      const aliasPenalty = index === 0 ? 0 : 1;
      if (haystack.startsWith(needle)) score = Math.max(score, 10 - aliasPenalty);
      else if (haystack.includes(needle)) score = Math.max(score, 5 - aliasPenalty);
    }
    if (score >= 0) scored.push({ preset, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.preset);
}
