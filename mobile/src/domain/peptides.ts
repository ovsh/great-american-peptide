// Curated peptide preset library.
//
// One rule governs this file: **a half-life must have a stated basis, and the
// app names that basis.** An invented half-life is worse than a missing
// peptide, because the level curve then shows a number that no source
// supports. So each preset carries an evidence tier:
//
//   'label'     — the half-life is in an FDA (or equivalent) prescribing label.
//   'trial'     — the half-life is in a published human pharmacokinetic study.
//   'estimate'  — no human half-life is published, but a number can be built
//                 from animal data, from a metabolite, or from peptides of the
//                 same size. The `source` string says which, in plain words,
//                 so the app never passes an estimate off as a measurement.
//   'unsourced' — nothing usable at all. The preset carries no half-life, no
//                 Tmax and no level curve. The app says so.
//
// The type makes this an error you cannot write: an 'unsourced' preset cannot
// hold a half-life, and a sourced preset cannot omit one.
//
// Users can override any value when they add a custom medication.

export type Unit = 'mg' | 'mcg' | 'iu';
export type Route = 'sc' | 'im';
export type FrequencyKind = 'daily' | 'every_n_days' | 'weekly' | 'twice_weekly' | 'custom';

export type EvidenceTier = 'label' | 'trial' | 'estimate' | 'unsourced';

interface PeptidePresetBase {
  id: string;
  name: string;
  // Brand names and trial codes. The picker searches these too, so a user who
  // knows "Zepbound" finds Tirzepatide.
  aliases?: readonly string[];
  category: 'glp1' | 'recovery' | 'longevity' | 'growth' | 'other';
  // No default dose. A per-peptide number in the bundle is a proposal waiting
  // for a caller to read it, and `store.config.json` `review.notes` tells App
  // Review that Poke never proposes one. The unit below is not a dose.
  unit: Unit;
  defaultRoute: Route;
  defaultFrequency: { kind: FrequencyKind; value?: number };
  // Where the half-life comes from, or why there is none. Shown on screen.
  source: string;
}

export type SourcedPeptidePreset = PeptidePresetBase & {
  evidence: 'label' | 'trial' | 'estimate';
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
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 168,
    tmaxHours: 48,
    source: 'FDA label for Ozempic, Wegovy. Half-life about 1 week. Peak 1 to 3 days.',
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    aliases: ['Mounjaro', 'Zepbound'],
    category: 'glp1',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 120,
    tmaxHours: 24,
    source: 'FDA label for Mounjaro, Zepbound. Half-life about 5 days. Peak 8 to 72 hours.',
  },
  {
    id: 'liraglutide',
    name: 'Liraglutide',
    aliases: ['Victoza', 'Saxenda'],
    category: 'glp1',
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
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 120,
    tmaxHours: 48,
    source: 'FDA label for Trulicity. Half-life about 5 days. Peak 24 to 72 hours.',
  },
  {
    id: 'exenatide',
    name: 'Exenatide',
    aliases: ['Byetta', 'exendin-4'],
    category: 'glp1',
    unit: 'mcg',
    defaultRoute: 'sc',
    // Byetta is dosed before the two main meals. `FrequencyKind` has no
    // twice-daily member, so the user sets the schedule.
    defaultFrequency: { kind: 'custom' },
    evidence: 'label',
    halfLifeHours: 2.4,
    tmaxHours: 2.1,
    source: 'FDA label for Byetta. Half-life 2.4 hours. Peak 2.1 hours.',
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    aliases: ['LY3437943', 'reta'],
    category: 'glp1',
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
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 144,
    tmaxHours: 18,
    source: 'Phase 1 trials, Diabetes Obes Metab 2023. Half-life more than 100 hours.',
  },
  {
    id: 'mazdutide',
    name: 'Mazdutide',
    aliases: ['IBI362', 'LY3305677', 'Xinermei'],
    category: 'glp1',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 175,
    tmaxHours: 72,
    source: 'Phase 1b trial, eClinicalMedicine 2022. Half-life 175 hours or more.',
  },
  {
    id: 'cagrilintide',
    name: 'Cagrilintide',
    aliases: ['AM833', 'cagri'],
    category: 'glp1',
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
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    // The 26 to 38 minute pair came from the 1 mg/vial Egrifta, a formulation
    // that is no longer marketed. Both current labels are far shorter.
    evidence: 'label',
    halfLifeHours: 0.18,
    tmaxHours: 0.15,
    source: 'FDA label for Egrifta WR. Half-life about 11 minutes. Peak at 9 minutes.',
  },
  {
    id: 'sermorelin',
    name: 'Sermorelin',
    aliases: ['Geref', 'GRF 1-29'],
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 0.2,
    // The label puts the peak at the end of the infusion, which for the
    // subcutaneous dose is the injection itself plus the same few minutes the
    // half-life runs to. Without a Tmax the curve jumps to full height at the
    // moment of the shot, which no injected peptide does.
    tmaxHours: 0.2,
    source: 'FDA label for Geref. Half-life about 12 minutes. Peak within minutes of the shot.',
  },
  {
    id: 'ghrp-6',
    name: 'GHRP-6',
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 2.5,
    // The study dosed by vein, so it has no Tmax for an injection under the
    // skin. `tmaxOrDefault` derives one rather than the file inventing it.
    tmaxHours: null,
    source: 'Human PK study in 9 volunteers, Eur J Pharm Sci 2013. IV dosing. Half-life about 2.5 hours.',
  },
  {
    id: 'ghrp-2',
    name: 'GHRP-2',
    aliases: ['pralmorelin', 'KP-102'],
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 0.55,
    tmaxHours: null,
    source: 'Human PK study, JCEM 1998. IV dosing in 10 children. Half-life about 33 minutes.',
  },
  {
    id: 'somatropin',
    name: 'Somatropin (HGH)',
    aliases: ['HGH', 'growth hormone', 'Genotropin', 'Norditropin', 'Omnitrope'],
    category: 'growth',
    unit: 'iu',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 3,
    // Peak later than the half-life. The label says so: absorption from the
    // depot, not elimination, sets the shape of the curve.
    tmaxHours: 6,
    source: 'FDA label for Genotropin. Half-life about 3 hours after injection under the skin.',
  },
  {
    id: 'mecasermin',
    name: 'Mecasermin (IGF-1)',
    aliases: ['Increlex', 'IGF-1', 'rhIGF-1'],
    category: 'growth',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 5.8,
    tmaxHours: 2,
    source: 'FDA label for Increlex. Half-life about 5.8 hours. This is not IGF-1 LR3.',
  },
  {
    id: 'hexarelin',
    name: 'Hexarelin',
    aliases: ['examorelin'],
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 2,
    tmaxHours: null,
    source: 'No human half-life is published. Dog studies show about 2 hours.',
  },
  {
    id: 'cjc-1295-no-dac',
    name: 'CJC-1295 (no DAC)',
    aliases: ['mod GRF 1-29', 'modified GRF', 'CJC1295 no DAC'],
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 0.5,
    tmaxHours: null,
    source: 'No human half-life is published for this form. About 30 minutes is an estimate.',
  },
  {
    id: 'aod-9604',
    name: 'AOD-9604',
    aliases: ['HGH fragment 176-191', 'hGH frag'],
    category: 'growth',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 0.1,
    tmaxHours: null,
    source: 'No human half-life is published. Animal studies show 3 to 4 minutes.',
  },

  // ----------------------------------------------------------- Recovery ----
  {
    id: 'thymosin-alpha-1',
    name: 'Thymosin Alpha-1',
    aliases: ['Zadaxin', 'Ta1', 'thymalfasin'],
    category: 'recovery',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'trial',
    halfLifeHours: 2,
    tmaxHours: 2,
    source:
      'Zadaxin prescribing information. Doses under the skin in volunteers. ' +
      'Peak at about 2 hours, half-life about 2 hours.',
  },
  {
    id: 'bpc-157',
    name: 'BPC-157',
    category: 'recovery',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 0.75,
    tmaxHours: 0.25,
    source:
      'No human study. Rats and dogs clear it in less than 30 minutes ' +
      '(Front Pharmacol 2022). Scaled to human size, about 45 minutes.',
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    aliases: ['thymosin beta-4', 'TB4'],
    category: 'recovery',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'estimate',
    halfLifeHours: 2,
    tmaxHours: 1,
    source:
      'Vials sold as TB-500 hold one of two molecules: full thymosin beta-4, ' +
      'or a short piece of it. A human study of the full one by vein gives ' +
      '0.5 to 2 hours (J Cell Mol Med 2021). The piece has no study.',
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    aliases: ['copper peptide'],
    category: 'recovery',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 0.5,
    tmaxHours: 0.25,
    source:
      'No study of any kind measures this. Estimated from tripeptides of the ' +
      'same size, which the blood breaks down in minutes.',
  },

  // ---------------------------------------------------------- Longevity ----
  {
    id: 'nad-plus',
    name: 'NAD+',
    category: 'longevity',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'estimate',
    halfLifeHours: 1.5,
    tmaxHours: 1,
    source:
      'NAD+ itself leaves the blood in minutes. This curve follows the ' +
      'nicotinamide it becomes, about 1.5 hours at these doses.',
  },
  {
    id: 'epitalon',
    name: 'Epitalon',
    aliases: ['epithalon'],
    category: 'longevity',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'estimate',
    halfLifeHours: 0.5,
    tmaxHours: 0.25,
    source:
      'No study of any kind measures this. Estimated from tetrapeptides of ' +
      'the same size, which the blood breaks down in minutes.',
  },

  // -------------------------------------------------------------- Other ----
  {
    id: 'bremelanotide',
    name: 'Bremelanotide (PT-141)',
    aliases: ['PT-141', 'PT141', 'Vyleesi'],
    category: 'other',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'custom' },
    evidence: 'label',
    halfLifeHours: 2.7,
    tmaxHours: 1,
    source: 'FDA label for Vyleesi. Half-life about 2.7 hours.',
  },
  {
    id: 'hcg',
    name: 'HCG',
    aliases: ['human chorionic gonadotropin', 'Pregnyl', 'Novarel', 'Ovidrel'],
    category: 'other',
    unit: 'iu',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'label',
    halfLifeHours: 29,
    tmaxHours: 24,
    source: 'FDA label for Ovidrel. Half-life about 29 hours after injection under the skin.',
  },
  {
    id: 'teriparatide',
    name: 'Teriparatide (PTH 1-34)',
    aliases: ['Forteo', 'PTH 1-34'],
    category: 'other',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'label',
    halfLifeHours: 1,
    tmaxHours: 0.5,
    source: 'FDA label for Forteo. Half-life about 1 hour. Peak at 30 minutes.',
  },
  {
    id: 'melanotan-1',
    name: 'Melanotan I',
    aliases: ['afamelanotide', 'MT-1', 'MT1', 'Scenesse'],
    category: 'other',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 1.25,
    tmaxHours: 0.5,
    source: 'Human PK study, Biopharm Drug Dispos 1997. Half-life 0.8 to 1.7 hours.',
  },
  {
    id: 'melanotan-2',
    name: 'Melanotan II',
    aliases: ['MT-2', 'MT2', 'MTII'],
    category: 'other',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'custom' },
    evidence: 'estimate',
    halfLifeHours: 1,
    tmaxHours: null,
    source: 'No half-life is published for this peptide. Melanotan I shows about 1 hour.',
  },
  {
    id: 'gonadorelin',
    name: 'Gonadorelin',
    aliases: ['GnRH', 'Factrel', 'Lutrepulse', 'LHRH'],
    category: 'other',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'every_n_days', value: 2 },
    evidence: 'trial',
    halfLifeHours: 0.08,
    tmaxHours: null,
    source: 'Human PK review, Endocrine Reviews 1986. Half-life 2 to 8 minutes.',
  },
  {
    id: 'kisspeptin-10',
    name: 'Kisspeptin-10',
    aliases: ['KP-10', 'kisspeptin', 'metastin 45-54'],
    category: 'other',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'custom' },
    evidence: 'trial',
    halfLifeHours: 0.07,
    tmaxHours: null,
    source: 'Human PK study, Imperial College group. IV dosing. Half-life about 4 minutes.',
  },
];

export function getPreset(id: string): PeptidePreset | undefined {
  return peptidePresets.find((p) => p.id === id);
}

// True when the preset carries a half-life the app can draw a curve from. Not
// the same as "published": an 'estimate' preset has a number with a stated
// basis, not a measurement. Narrows the type, so the curve code cannot read a
// null half-life.
export function hasUsableHalfLife(preset: PeptidePreset): preset is SourcedPeptidePreset {
  return preset.evidence !== 'unsourced';
}

export const EVIDENCE_LABELS: Record<EvidenceTier, string> = {
  label: 'Half-life from the drug label',
  trial: 'Half-life from a human study',
  estimate: 'Estimated half-life — limited evidence',
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
