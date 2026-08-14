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

/**
 * How a route is written on screen, in plain words and in the clinical word.
 *
 * "SC" and "IM" are what the database and the CSV export hold, and they stay
 * that way. They are not what a user reads: the abbreviation is the thing
 * people said they could not follow, and a choice nobody understands is not a
 * choice. So the plain line leads and the clinical word stays under it, because
 * a user has to be able to tell a clinician what they did, and a record that
 * drops the clinical word is a weaker record.
 *
 * Every screen that shows a route reads these two strings, so the wording
 * cannot drift from one screen to the next.
 */
export const ROUTE_LABELS: Record<Route, { plain: string; clinical: string }> = {
  sc: { plain: 'Under the skin', clinical: 'Subcutaneous' },
  im: { plain: 'Into the muscle', clinical: 'Intramuscular' },
};

/**
 * The plain wording as it reads inside a line, as in "0.25 mg under the skin".
 *
 * A list row carries the route after the dose, so the label cannot start with a
 * capital there. It comes off the same two strings as the choice cards, so a
 * screen that shows the route in a line cannot drift from a screen that shows
 * it on a card.
 */
export function routeInLine(route: Route): string {
  return ROUTE_LABELS[route].plain.toLowerCase();
}

/**
 * `weekdays` carries its day set as a bitmask in `frequency_value`. See
 * `weekdayMask` in `domain/scheduling` for the bit order.
 */
export type FrequencyKind =
  | 'daily'
  | 'every_n_days'
  | 'weekly'
  | 'twice_weekly'
  | 'weekdays'
  | 'custom';

export type EvidenceTier = 'label' | 'trial' | 'estimate' | 'unsourced';

interface PeptidePresetBase {
  id: string;
  name: string;
  // Trial codes, abbreviations and chemistry synonyms. The picker searches
  // these, so a user who knows "reta" finds Retatrutide. They get no row of
  // their own, because nobody buys a product called LY3437943.
  aliases?: readonly string[];
  // Names the molecule is sold under. Each one gets its own picker row and
  // names the medication it creates, because a user on Wegovy thinks
  // "Wegovy" and not "semaglutide". The picker searches these too.
  brandNames?: readonly string[];
  category: 'glp1' | 'recovery' | 'longevity' | 'growth' | 'hormones' | 'blend' | 'other';
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

/**
 * A vial that holds more than one molecule.
 *
 * A blend is an unsourced preset that also names its parts. Unsourced, because
 * the parts clear at different rates and no single half-life describes the
 * vial, so the blend itself carries no number and draws no curve of its own.
 * The parts are preset ids, each naming a non-blend preset that does carry a
 * sourced rate. When the user enters the vial composition, the curve is the
 * sum of the parts, each falling at its own rate.
 */
export type BlendPeptidePreset = UnsourcedPeptidePreset & {
  parts: readonly string[];
};

export type PeptidePreset = SourcedPeptidePreset | UnsourcedPeptidePreset | BlendPeptidePreset;

/** True when the preset is a blend of other presets in this catalog. */
export function isBlend(preset: PeptidePreset): preset is BlendPeptidePreset {
  return 'parts' in preset;
}

/**
 * The parts of a blend, resolved to their presets, in label order.
 *
 * A part id that no longer names a preset is dropped rather than thrown on,
 * because the catalog is data and a picker must not crash on a typo here.
 * `blends.test.ts` checks every part id resolves, so the drop cannot hide one.
 */
export function blendParts(preset: BlendPeptidePreset): PeptidePreset[] {
  return preset.parts.flatMap((id) => {
    const part = getPreset(id);
    return part ? [part] : [];
  });
}

export const peptidePresets: PeptidePreset[] = [
  // ---------------------------------------------------------------- GLP-1 --
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    brandNames: ['Ozempic', 'Wegovy'],
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
    brandNames: ['Mounjaro', 'Zepbound'],
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
    brandNames: ['Saxenda', 'Victoza'],
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
    brandNames: ['Trulicity'],
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
    aliases: ['exendin-4'],
    brandNames: ['Byetta'],
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
    aliases: ['IBI362', 'LY3305677'],
    brandNames: ['Xinermei'],
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
    brandNames: ['Egrifta'],
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
    aliases: ['GRF 1-29'],
    brandNames: ['Geref'],
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
    aliases: ['HGH', 'growth hormone'],
    brandNames: ['Genotropin', 'Norditropin', 'Omnitrope'],
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
    aliases: ['IGF-1', 'rhIGF-1'],
    brandNames: ['Increlex'],
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
    aliases: ['Ta1', 'thymalfasin'],
    brandNames: ['Zadaxin'],
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
  {
    id: 'kpv',
    name: 'KPV',
    aliases: ['lysine-proline-valine'],
    category: 'recovery',
    unit: 'mcg',
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
  {
    id: 'elamipretide',
    name: 'Elamipretide (SS-31)',
    aliases: ['SS-31', 'SS31', 'MTP-131', 'Bendavia'],
    brandNames: ['Forzinity'],
    category: 'longevity',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'trial',
    halfLifeHours: 3,
    // The Forzinity label gives the peak and not the half-life. The FDA
    // integrated review for the same approval gives the half-life: 3.16 h
    // after one 40 mg dose in healthy adults, 2.8 h at steady state.
    tmaxHours: 0.75,
    source:
      'FDA integrated review for Forzinity. Half-life about 3 hours in ' +
      'healthy adults. Peak from the FDA label, 30 to 60 minutes after ' +
      'injection under the skin.',
  },
  {
    id: 'mots-c',
    name: 'MOTS-c',
    category: 'longevity',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'estimate',
    halfLifeHours: 1.5,
    tmaxHours: null,
    // Vendor pages print a half-life of days. Nothing supports that: the
    // exercise studies show the level back at baseline within 4 hours.
    source:
      'No human half-life is published. Rodent data and the return to ' +
      'baseline after exercise point to 1 to 2 hours.',
  },

  // ---------------------------------------------------------- Hormones ----
  {
    id: 'testosterone-cypionate',
    name: 'Testosterone cypionate',
    aliases: ['test c', 'test cyp', 'TRT'],
    brandNames: ['Depo-Testosterone'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'label',
    halfLifeHours: 192,
    tmaxHours: null,
    source:
      'FDA label for Depo-Testosterone. Half-life about 8 days after ' +
      'injection into the muscle.',
  },
  {
    id: 'testosterone-enanthate',
    name: 'Testosterone enanthate',
    aliases: ['test e', 'TRT'],
    brandNames: ['Xyosted', 'Delatestryl'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    defaultFrequency: { kind: 'weekly' },
    // The Xyosted label gives the peak and not the half-life, so the two
    // numbers here have two sources and the string names both.
    evidence: 'trial',
    halfLifeHours: 108,
    tmaxHours: 11.9,
    source:
      'Human PK study, Fertility and Sterility 1980. Half-life about 4.5 ' +
      'days. Peak from the FDA label for Xyosted, about 12 hours.',
  },
  {
    id: 'testosterone-propionate',
    name: 'Testosterone propionate',
    aliases: ['test p', 'prop', 'TRT'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    defaultFrequency: { kind: 'every_n_days', value: 2 },
    evidence: 'estimate',
    halfLifeHours: 19,
    tmaxHours: null,
    source:
      'No current FDA label. Reference works give about 0.8 days, and ' +
      'published values disagree.',
  },
  {
    id: 'testosterone-undecanoate',
    name: 'Testosterone undecanoate',
    aliases: ['test u', 'TRT'],
    brandNames: ['Aveed', 'Nebido'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    // Dosed about every 10 weeks. `FrequencyKind` has no such member, so the
    // user sets the schedule.
    defaultFrequency: { kind: 'custom' },
    evidence: 'trial',
    halfLifeHours: 814,
    tmaxHours: 168,
    source:
      'Human PK study, Eur J Endocrinol 1999, castor oil formulation. ' +
      'Half-life about 34 days. Peak from the FDA label for Aveed, about 7 days.',
  },
  {
    id: 'estradiol-valerate',
    name: 'Estradiol valerate',
    aliases: ['EV', 'E2V'],
    brandNames: ['Delestrogen'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    defaultFrequency: { kind: 'every_n_days', value: 5 },
    evidence: 'trial',
    halfLifeHours: 84,
    tmaxHours: 48,
    source:
      'Human PK study, Contraception 1980. Half-life about 3.5 days. ' +
      'Peak about 2 days.',
  },
  {
    id: 'estradiol-cypionate',
    name: 'Estradiol cypionate',
    aliases: ['EC'],
    brandNames: ['Depo-Estradiol'],
    category: 'hormones',
    unit: 'mg',
    defaultRoute: 'im',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'trial',
    halfLifeHours: 216,
    tmaxHours: 96,
    source:
      'Human PK study, Contraception 1980. Half-life about 9 days. ' +
      'Peak about 4 days.',
  },
  {
    id: 'hcg',
    name: 'HCG',
    aliases: ['human chorionic gonadotropin'],
    brandNames: ['Novarel', 'Ovidrel', 'Pregnyl'],
    category: 'hormones',
    unit: 'iu',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'twice_weekly' },
    evidence: 'label',
    halfLifeHours: 29,
    tmaxHours: 24,
    source: 'FDA label for Ovidrel. Half-life about 29 hours after injection under the skin.',
  },
  {
    id: 'gonadorelin',
    name: 'Gonadorelin',
    aliases: ['GnRH', 'LHRH'],
    brandNames: ['Factrel', 'Lutrepulse'],
    category: 'hormones',
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
    category: 'hormones',
    unit: 'mcg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'custom' },
    evidence: 'trial',
    halfLifeHours: 0.07,
    tmaxHours: null,
    source: 'Human PK study, Imperial College group. IV dosing. Half-life about 4 minutes.',
  },

  // -------------------------------------------------------------- Other ----
  {
    id: 'bremelanotide',
    name: 'Bremelanotide (PT-141)',
    aliases: ['PT-141', 'PT141'],
    brandNames: ['Vyleesi'],
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
    id: 'teriparatide',
    name: 'Teriparatide (PTH 1-34)',
    aliases: ['PTH 1-34'],
    brandNames: ['Forteo'],
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

  // ------------------------------------------------------------- Blends ----
  // A blend names its parts twice: in `parts` as preset ids, which the curve
  // reads, and in `aliases` as names, so a search for one part finds the
  // blends that hold it. The part's own row always outranks the blend in the
  // results, because a row's own name scores above an inherited name.
  {
    id: 'glow',
    name: 'GLOW',
    aliases: ['GHK-Cu', 'BPC-157', 'TB-500'],
    category: 'blend',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    parts: ['ghk-cu', 'bpc-157', 'tb-500'],
    source:
      'A blend of GHK-Cu, BPC-157 and TB-500. Each part clears at its own ' +
      'rate, so the blend has no single half-life.',
  },
  {
    id: 'klow',
    name: 'KLOW',
    aliases: ['GHK-Cu', 'KPV', 'BPC-157', 'TB-500'],
    category: 'blend',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    parts: ['ghk-cu', 'kpv', 'bpc-157', 'tb-500'],
    source:
      'A blend of GHK-Cu, KPV, BPC-157 and TB-500. Each part clears at its ' +
      'own rate, so the blend has no single half-life.',
  },
  {
    id: 'wolverine',
    name: 'Wolverine',
    aliases: ['BPC-157', 'TB-500', 'wolverine stack'],
    category: 'blend',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    parts: ['bpc-157', 'tb-500'],
    source:
      'A blend of BPC-157 and TB-500. Each part clears at its own rate, so ' +
      'the blend has no single half-life.',
  },
  {
    id: 'cjc-ipamorelin',
    name: 'CJC-1295 + Ipamorelin',
    aliases: ['CJC-1295', 'Ipamorelin', 'cjc ipa'],
    category: 'blend',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'daily' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    parts: ['cjc-1295', 'ipamorelin'],
    source:
      'A blend of CJC-1295 with DAC and Ipamorelin. The parts clear at rates ' +
      'about 80 times apart, so the blend has no single half-life.',
  },
  {
    id: 'cagrisema',
    name: 'CagriSema',
    aliases: ['cagrilintide', 'semaglutide', 'cagri sema'],
    category: 'blend',
    unit: 'mg',
    defaultRoute: 'sc',
    defaultFrequency: { kind: 'weekly' },
    evidence: 'unsourced',
    halfLifeHours: null,
    tmaxHours: null,
    parts: ['cagrilintide', 'semaglutide'],
    source:
      'A blend of cagrilintide and semaglutide, in trials at Novo Nordisk. ' +
      'The blend itself has no single measured half-life.',
  },
];

// A brand row carries the preset id, this separator, and the brand in lower
// case: `semaglutide:wegovy`. No preset id holds a colon, so every reader can
// take the molecule back out of an entry id.
const ENTRY_SEPARATOR = ':';

/**
 * One row of a preset picker.
 *
 * A molecule has one row of its own and one row for each name it is sold
 * under, because a user on Wegovy looks for Wegovy. Every row points at the
 * same preset, so the brand row carries the molecule's half-life, unit, route
 * and frequency, and only the name differs.
 */
export interface PresetEntry {
  /** What the picker and the onboarding draft key on. */
  id: string;
  /** The row's name, and the name of the medication the row creates. */
  name: string;
  /** The molecule under a brand row. Undefined on a molecule row. */
  moleculeName?: string;
  preset: PeptidePreset;
}

function entriesFor(preset: PeptidePreset): PresetEntry[] {
  const rows: PresetEntry[] = [{ id: preset.id, name: preset.name, preset }];
  for (const brand of preset.brandNames ?? []) {
    rows.push({
      id: `${preset.id}${ENTRY_SEPARATOR}${brand.toLocaleLowerCase().replace(/\s+/g, '-')}`,
      name: brand,
      moleculeName: preset.name,
      preset,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every picker row, in catalog order. The catalog runs by category, and a
 * molecule keeps its brands beside it, sorted by name.
 */
export function pickerEntries(): PresetEntry[] {
  return peptidePresets.flatMap(entriesFor);
}

/** The row an id names, whether that id is a molecule or a brand. */
export function getPresetEntry(id: string): PresetEntry | undefined {
  const preset = getPreset(id);
  if (!preset) return undefined;
  return entriesFor(preset).find((entry) => entry.id === id);
}

/** The molecule an id names. A brand id resolves to the molecule it sells. */
export function getPreset(id: string): PeptidePreset | undefined {
  const separator = id.indexOf(ENTRY_SEPARATOR);
  const presetId = separator === -1 ? id : id.slice(0, separator);
  return peptidePresets.find((p) => p.id === presetId);
}

// True when the preset carries a half-life the app can draw a curve from. Not
// the same as "published": an 'estimate' preset has a number with a stated
// basis, not a measurement. Narrows the type, so the curve code cannot read a
// null half-life.
export function hasUsableHalfLife(preset: PeptidePreset): preset is SourcedPeptidePreset {
  return preset.evidence !== 'unsourced';
}

/**
 * What a category is called on screen.
 *
 * The data names are identifiers and two of them read wrong on a pill:
 * `glp1` has no hyphen and `recovery` is not the word the audience uses.
 * Every screen that shows a category reads this map, so the wording cannot
 * drift between the filter pills and the row badges.
 */
export const CATEGORY_LABELS: Record<PeptidePreset['category'], string> = {
  glp1: 'GLP-1',
  blend: 'Blends',
  recovery: 'Healing',
  growth: 'Growth',
  longevity: 'Longevity',
  hormones: 'Hormones',
  other: 'Other',
};

/**
 * The filter pill order: All first, then by audience size, with Blends third
 * so the new category shows before the rail scrolls off a 375 pt screen.
 */
export const CATEGORY_ORDER: PeptidePreset['category'][] = [
  'glp1', 'blend', 'recovery', 'growth', 'hormones', 'longevity', 'other',
];

export const EVIDENCE_LABELS: Record<EvidenceTier, string> = {
  label: 'Half-life from the drug label',
  trial: 'Half-life from a human study',
  estimate: 'Estimated half-life, limited evidence',
  unsourced: 'No published half-life',
};

/**
 * The picker rows a query matches, best first.
 *
 * The row's own name outranks everything a row only inherits, so "wegovy"
 * puts the Wegovy row above the Semaglutide row that sells it, and "sema"
 * puts Semaglutide above its three brands. A molecule row also answers to its
 * trial codes and its abbreviations, so "reta" still finds Retatrutide.
 */
export function searchPresets(query: string): PresetEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  const entries = pickerEntries();
  if (!needle) return entries;
  const scored: { entry: PresetEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = entry.name.toLocaleLowerCase();
    // A brand row answers to its molecule. A molecule row answers to every
    // other name the molecule goes by.
    const inherited = entry.moleculeName === undefined
      ? [...(entry.preset.aliases ?? []), ...(entry.preset.brandNames ?? [])]
      : [entry.preset.name];
    let score = -1;
    if (name === needle) score = 20;
    else if (name.startsWith(needle)) score = 10;
    else if (name.includes(needle)) score = 5;
    for (const value of inherited) {
      const haystack = value.toLocaleLowerCase();
      if (haystack === needle) score = Math.max(score, 9);
      else if (haystack.startsWith(needle)) score = Math.max(score, 4);
      else if (haystack.includes(needle)) score = Math.max(score, 2);
    }
    if (score >= 0) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((row) => row.entry);
}
