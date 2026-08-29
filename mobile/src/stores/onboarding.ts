import type { Href } from 'expo-router';
import { create } from 'zustand';

import type { ExperienceLevel, GoalKind, JourneyStage, Sex, VialForm } from '../db/types';
import { compositionDraft } from '../domain/blends';
import {
  blendParts,
  getPreset,
  getPresetEntry,
  isBlend,
  type FrequencyKind,
  type Route,
  type Unit,
} from '../domain/peptides';
import { WEEKDAY_OPTIONS, weekdayMask, type Weekday } from '../domain/scheduling';
import { cmToIn, inToCm, kgToLb, lbToKg, type HeightUnit, type WeightUnit } from '../domain/units';

// The ids that are not catalog presets. Each custom medication the user names
// gets its own id, `custom:1`, `custom:2` and so on, so setup can hold as many
// as they take. The name lives in `customNames` under the same id.
export const CUSTOM_MEDICATION_PREFIX = 'custom:';

export function isCustomMedicationId(id: string): boolean {
  return id.startsWith(CUSTOM_MEDICATION_PREFIX);
}

// A picker entry id, which is a molecule id or a brand id, or a custom id with
// the prefix above. The picker searches the whole catalog, so this cannot be a
// fixed union of ids.
export type OnboardingMedicationId = string;
/**
 * Every schedule setup can express. It used to stop at three, so a user on an
 * every-three-days protocol, or on a fixed Monday, Wednesday and Friday, had no
 * way to say so on the one screen that asks.
 */
export type OnboardingFrequency = 'daily' | 'twice_weekly' | 'weekly' | 'every_n_days' | 'weekdays';
export type SideEffectConcern = 'nausea' | 'fatigue' | 'constipation' | 'injection_site' | 'none';
export type ShotDay = Weekday;
export type LastShotChoice = 'today' | 'yesterday' | 'this_week' | 'longer' | 'none';

// Two labels and no description lines. The recording carries none here either,
// and the ones written for this screen said nothing the label had not already
// said.
export const JOURNEY_OPTIONS: readonly { id: JourneyStage; label: string }[] = [
  { id: 'taking', label: 'I am already taking something' },
  { id: 'starting', label: 'I am about to start' },
];

export const SEX_OPTIONS: readonly { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Prefer not to say' },
];

/**
 * The routing question, and the only answer that changes which screens run.
 *
 * The two labels on each row split the work: the title is the user talking
 * about themselves, and the description is Poke saying what it will do about
 * it. A user picking a level should see the consequence before they pick, so
 * the descriptions name the teach beats `postScheduleOrder` adds or drops.
 */
export const EXPERIENCE_OPTIONS: readonly {
  id: ExperienceLevel;
  label: string;
  description: string;
}[] = [
  { id: 'new', label: 'Brand new', description: 'Poke explains each step on the way.' },
  { id: 'basics', label: 'I know the basics', description: 'Poke keeps the notes short.' },
  { id: 'experienced', label: 'I have done this before', description: 'Poke skips the explanations.' },
];

export const LAST_SHOT_OPTIONS: readonly { id: LastShotChoice; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'Earlier this week' },
  { id: 'longer', label: 'Longer ago than that' },
  { id: 'none', label: 'I have not had one yet' },
];

/**
 * What every goal is called, including the two the screen no longer offers.
 *
 * A row saved by an older build can hold `performance` or `other`, and a label
 * lookup that misses one of them draws an empty line where the user's own
 * answer should be. Every reader goes through `goalLabel` for that reason.
 */
const GOAL_LABELS: Record<GoalKind, string> = {
  weight_loss: 'Weight loss',
  recovery: 'Muscle and recovery',
  sleep: 'Better sleep',
  focus: 'Focus',
  healing: 'Healing',
  longevity: 'Overall health',
  performance: 'Performance',
  other: 'Other',
};

/** What Poke calls a stored goal. Covers the ids the screen retired. */
export function goalLabel(kind: GoalKind): string {
  return GOAL_LABELS[kind];
}

/** The ids the goal screen offers, in the order it draws them. */
const GOAL_IDS = [
  'weight_loss',
  'recovery',
  'sleep',
  'focus',
  'healing',
  'longevity',
] as const satisfies readonly GoalKind[];

/**
 * A goal the screen still offers.
 *
 * Narrower than `GoalKind`, which also holds the two ids only old rows carry.
 * The screen keys its icons on this, so a goal added to the list above fails to
 * compile until it has a picture.
 */
export type GoalOptionId = (typeof GOAL_IDS)[number];

// Labels only. Only the label is ever shown again, on the plan card, and a
// four-word gloss under `Weight loss` tells nobody anything.
export const GOAL_OPTIONS: readonly { id: GoalOptionId; label: string }[] =
  GOAL_IDS.map((id) => ({ id, label: GOAL_LABELS[id] }));

export const CONCERN_OPTIONS: readonly { id: SideEffectConcern; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'injection_site', label: 'Injection-site reactions' },
  { id: 'none', label: 'None right now' },
];

export const SHOT_DAY_OPTIONS = WEEKDAY_OPTIONS;

/**
 * How the medication is packaged.
 *
 * `vial` carries a size in milligrams, printed on the label. `pen` carries
 * none: a pen is filled at the factory and its label names a dose rather than a
 * vial size. The peptide catalog holds neither a vial size nor a pen flag, so
 * Poke cannot read this off a preset and the setup run asks for it.
 *
 * The draft and the `vial_form` column hold the same two words, so the answer
 * travels from the screen to the row without a translation table between them.
 */
export type { VialForm };

/**
 * The vial sizes the chips offer, in milligrams.
 *
 * These are packaging facts and not doses. A vial is sold in a size, the size is
 * printed on the label, and reading it back is not Poke proposing anything. The
 * five here are the sizes lyophilized peptide vials ship in across the whole
 * catalog, so one list covers every compound and no compound gets a number
 * invented for it. Any other size is typed instead.
 */
export const VIAL_MG_OPTIONS: readonly number[] = [2, 5, 10, 15, 30];

// The pace slider's ends, in lb per week. Copied from the shape of MeAgain's
// slider, not its numbers: MeAgain runs 0.2 to 3.0 lb. Poke stops at 2.0 because
// the projection is arithmetic, and a 3 lb-a-week line drawn out to a date reads
// as a target rather than as a sum.
//
// The floor is zero and not 0.2. A user in maintenance sets no rate of change,
// and a slider that refuses zero tells that user their own plan is not a plan.
// Zero is a value with its own word, `MAINTAIN_PACE_LABEL`, and its own branch
// in `planProjection`. Never print it as "0.0 lb".
export const PACE_MIN_LB = 0;
export const PACE_MAX_LB = 2;
export const PACE_DEFAULT_LB = 1;

/** What Poke calls a weekly pace of zero. One word, and never a unit after it. */
export const MAINTAIN_PACE_LABEL = 'Maintain';

// A unit switch divides the pace, so a value that means zero can arrive a hair
// off zero. Anything under a fifth of the finest step either slider offers is
// the same answer, and only an exact zero can land inside this.
const PACE_ZERO_EPSILON = 0.001;

/** Whether the pace holds the weight rather than changes it. */
export function isMaintainPace(pace: number): boolean {
  return Number.isFinite(pace) && Math.abs(pace) < PACE_ZERO_EPSILON;
}

/** The pace as a value: "1.0 lb", "0.45 kg", or the maintain word on its own. */
export function formatPace(pace: number, unit: WeightUnit): string {
  if (isMaintainPace(pace)) return MAINTAIN_PACE_LABEL;
  return `${pace.toFixed(unit === 'lb' ? 1 : 2)} ${unit}`;
}

/** The pace as a readout. A maintain pace takes no rate after it. */
export function formatPaceRate(pace: number, unit: WeightUnit): string {
  if (isMaintainPace(pace)) return MAINTAIN_PACE_LABEL;
  return `${formatPace(pace, unit)} a week`;
}

/**
 * The ends of the height and weight wheels.
 *
 * The pickers build their rows from these and the store clamps to them when a
 * unit switch converts an answer, so a number can never sit off the wheel that
 * shows it. Each pair covers the same span twice: 48 to 95 inches is 4 ft 0 in
 * to 7 ft 11 in, and 122 to 241 is that same span in whole centimetres.
 */
export const HEIGHT_BOUNDS: Record<HeightUnit, { min: number; max: number }> = {
  in: { min: 48, max: 95 },
  cm: { min: 122, max: 241 },
};

export const WEIGHT_BOUNDS: Record<WeightUnit, { min: number; max: number }> = {
  lb: { min: 60, max: 600 },
  kg: { min: 27, max: 273 },
};

/**
 * Where each wheel rests before it is touched.
 *
 * A wheel that opens on row zero opens on 4 ft 0 in, which is nobody's first
 * guess at their own height and reads as a broken screen. The row under the band
 * is the answer, so each of those screens writes its resting row to the draft on
 * mount and Continue is live on arrival. Skip clears the answer back to null.
 */
export const HEIGHT_REST: Record<HeightUnit, number> = { in: 67, cm: 170 };
export const WEIGHT_REST: Record<WeightUnit, number> = { lb: 180, kg: 82 };

export type OnboardingGate =
  | { kind: 'checking' }
  | { kind: 'required' }
  | { kind: 'complete' }
  | { kind: 'error'; message: string };

export interface MedicationScheduleDraft {
  medicationId: OnboardingMedicationId;
  doseText: string;
  unit: Unit;
  route: Route;
  frequencyKind: OnboardingFrequency;
  shotDay: ShotDay;
  /** Days between shots, when the kind is `every_n_days`. Held as typed. */
  intervalText: string;
  /** The days picked, when the kind is `weekdays`. Empty until one is pressed. */
  weekdays: Weekday[];
  /**
   * The vial label of a blend, held as typed: milligrams per part, keyed by the
   * part's preset id. Empty for everything that is not a blend, and empty for a
   * blend whose label the user skipped, which is allowed as a whole.
   */
  compositionMg: Record<string, string>;
  /**
   * The whole vial, in milligrams, held as typed. Empty until the user answers
   * the vial question, empty for a pen, and empty for a blend, whose label is
   * `compositionMg` above.
   */
  vialMgText: string;
  /** Null until the vial question is answered. See `VialForm`. */
  vialForm: VialForm | null;
  /**
   * The bacteriostatic water that goes into the vial, in millilitres, held as
   * typed. Empty until the user saves a mix on the mix beat, and empty for every
   * medication that beat never runs for, which is most of them.
   *
   * It is what `domain/reconstitution.ts` calls `diluentMl`. The number is a
   * record of the mix the user made, and Poke proposes none of it: the beat
   * offers common amounts as chips and writes only the one the user pressed.
   */
  diluentMlText: string;
  /**
   * The three hatches, one per question in the setup run.
   *
   * Every question in the run offers "Not sure yet. Set it up later." A hatch
   * never blocks the run and it never writes a guess: it clears the answer it
   * covers and it records that the user passed, exactly as a null does for the
   * knowledge question. `services/onboarding.ts` reads these to decide what to
   * leave out of the medication row, and no reader may fill one in.
   */
  deferredVial: boolean;
  deferredDose: boolean;
  deferredFrequency: boolean;
}

/** Whether the user gave a dose for this medication. */
export function scheduleHasDose(schedule: MedicationScheduleDraft): boolean {
  const dose = Number.parseFloat(schedule.doseText);
  return Number.isFinite(dose) && dose > 0;
}

/**
 * Whether the frequency question is finished.
 *
 * Deferred is not finished. Neither is a kind that carries a number the user has
 * not given yet, so Continue waits rather than saving an interval or a week
 * nobody chose.
 */
export function scheduleHasFrequency(schedule: MedicationScheduleDraft): boolean {
  if (schedule.deferredFrequency) return false;
  if (schedule.frequencyKind === 'daily') return true;
  return scheduleFrequencyValue(schedule) !== null;
}

/**
 * The vial size in milligrams, or null when there is none to read.
 *
 * Null covers all three ways that happens: the user deferred the question, the
 * user said the medication comes in a pen, and the typed number does not parse.
 * The mix math takes a whole vial in milligrams, which is what
 * `domain/reconstitution.ts` calls `materialMassMg`.
 */
export function scheduleVialMg(schedule: MedicationScheduleDraft): number | null {
  if (schedule.deferredVial || schedule.vialForm !== 'vial') return null;
  const mg = Number.parseFloat(schedule.vialMgText);
  return Number.isFinite(mg) && mg > 0 ? mg : null;
}

/**
 * A typed water amount in millilitres, or null when there is none to read.
 *
 * The one parser for `diluentMlText`, because the mix beat runs the math on the
 * amount the user is still choosing and `services/onboarding.ts` writes the
 * amount they saved. The two read the same string through this, so a number the
 * screen showed cannot land in the row as something else.
 */
export function parseDiluentMl(text: string): number | null {
  const ml = Number.parseFloat(text);
  return Number.isFinite(ml) && ml > 0 ? ml : null;
}

/** Whether the vial question is finished, by an answer of any kind. */
export function scheduleHasVial(schedule: MedicationScheduleDraft): boolean {
  if (schedule.deferredVial) return false;
  if (schedule.vialForm === 'pen') return true;
  return scheduleVialMg(schedule) !== null;
}

/**
 * What the draft writes into the `frequency_value` column.
 *
 * One column carries four different things, so one function decides which, and
 * both the writer and the plan preview call it. They disagreed once and the
 * plan card drew a week the reminders never sent. Null means the schedule needs
 * no number, or the user has not given one yet.
 */
export function scheduleFrequencyValue(schedule: MedicationScheduleDraft): number | null {
  switch (schedule.frequencyKind) {
    case 'daily':
      return null;
    case 'every_n_days': {
      const days = Number.parseInt(schedule.intervalText, 10);
      return Number.isFinite(days) && days >= 1 ? days : null;
    }
    case 'weekdays': {
      const mask = weekdayMask(schedule.weekdays);
      return mask === 0 ? null : mask;
    }
    default:
      return schedule.shotDay;
  }
}

/**
 * Whether the blend label boxes allow a save: every box filled or every box
 * empty. A label copied halfway hands the missing parts' milligrams to the
 * typed parts, so Continue waits rather than saving a vial nobody owns.
 * Anything that is not a blend has no boxes and always passes.
 */
export function scheduleCompositionSettled(schedule: MedicationScheduleDraft): boolean {
  if (isCustomMedicationId(schedule.medicationId)) return true;
  const preset = getPreset(schedule.medicationId);
  if (!preset || !isBlend(preset)) return true;
  const partIds = blendParts(preset).map((part) => part.id);
  return compositionDraft(partIds, schedule.compositionMg).kind !== 'partial';
}

// Current weight, goal weight and height each get their own screen and each can
// be skipped on its own, so "skipped" cannot be a property of the group. Null is
// the skip, and every reader tests the fields independently.
//
// These are numbers rather than strings because a wheel hands over a row and not
// a keystroke. There is no half-typed state to hold, so there is nothing left
// for a reader to parse and nothing for two readers to parse differently.
export interface WeightDraft {
  unit: WeightUnit;
  /** In `unit`, to one decimal place. */
  current: number | null;
  goal: number | null;
}

export interface HeightDraft {
  unit: HeightUnit;
  /** In `unit`, whole inches or whole centimetres. */
  value: number | null;
}

export type ReminderDraft =
  | { kind: 'skipped'; time: string }
  | { kind: 'enabled'; time: string };

export interface OnboardingDraft {
  journeyStage: JourneyStage | null;
  medicationIds: OnboardingMedicationId[];
  // The name behind each custom id in `medicationIds`. An entry exists exactly
  // as long as its id is selected: `addCustomMedication` writes both together
  // and `toggleMedication` removes both together.
  customNames: Record<OnboardingMedicationId, string>;
  // One schedule per selected medication, keyed by medication id. Every
  // selection gets its own screen, so nothing is filled in behind the user.
  schedules: Record<OnboardingMedicationId, MedicationScheduleDraft>;
  lastShot: LastShotChoice | null;
  sex: Sex | null;
  birthYearText: string;
  height: HeightDraft;
  weight: WeightDraft;
  // Weight change per week, in the weight draft's unit.
  pace: number;
  concerns: SideEffectConcern[];
  /**
   * The first goal the user picked, and the one `goal_kind` stores. Null until
   * they pick one; `toggleGoal` is the only writer and it keeps this in step
   * with `goalTags`.
   */
  goalKind: GoalKind | null;
  /** Every goal they picked, in the order they picked them. */
  goalTags: GoalKind[];
  /** Null until the knowledge question is answered, and null when it is skipped. */
  experienceLevel: ExperienceLevel | null;
  reminder: ReminderDraft;
}

export interface OnboardingState extends OnboardingDraft {
  gate: OnboardingGate;
  setGate: (gate: OnboardingGate) => void;
  setJourneyStage: (stage: JourneyStage) => void;
  toggleMedication: (id: OnboardingMedicationId) => void;
  addCustomMedication: (name: string) => OnboardingMedicationId;
  /** Moves one medication to the front, which is the order the setup run takes. */
  setFirstMedication: (id: OnboardingMedicationId) => void;
  prepareSchedules: () => void;
  setVialMg: (id: OnboardingMedicationId, vialMgText: string) => void;
  setVialForm: (id: OnboardingMedicationId, vialForm: VialForm) => void;
  /** The water the user saved on the mix beat. See `diluentMlText`. */
  setDiluentMl: (id: OnboardingMedicationId, diluentMlText: string) => void;
  deferVial: (id: OnboardingMedicationId) => void;
  deferDose: (id: OnboardingMedicationId) => void;
  deferFrequency: (id: OnboardingMedicationId) => void;
  setScheduleDose: (id: OnboardingMedicationId, doseText: string) => void;
  setScheduleUnit: (id: OnboardingMedicationId, unit: Unit) => void;
  setScheduleRoute: (id: OnboardingMedicationId, route: Route) => void;
  setScheduleFrequency: (id: OnboardingMedicationId, frequencyKind: OnboardingFrequency) => void;
  setShotDay: (id: OnboardingMedicationId, shotDay: ShotDay) => void;
  setScheduleInterval: (id: OnboardingMedicationId, intervalText: string) => void;
  toggleScheduleWeekday: (id: OnboardingMedicationId, weekday: Weekday) => void;
  setScheduleCompositionMg: (id: OnboardingMedicationId, partId: string, text: string) => void;
  setLastShot: (choice: LastShotChoice) => void;
  setSex: (sex: Sex) => void;
  setBirthYearText: (value: string) => void;
  setHeightUnit: (unit: HeightUnit) => void;
  setHeightValue: (value: number | null) => void;
  toggleGoal: (goalKind: GoalKind) => void;
  setExperienceLevel: (level: ExperienceLevel | null) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setWeightValue: (field: 'current' | 'goal', value: number | null) => void;
  setPace: (pace: number) => void;
  toggleConcern: (concern: SideEffectConcern) => void;
  setReminderTime: (time: string) => void;
  setReminderEnabled: (enabled: boolean) => void;
  resetDraft: () => void;
}

const initialDraft: OnboardingDraft = {
  journeyStage: null,
  medicationIds: [],
  customNames: {},
  schedules: {},
  lastShot: null,
  sex: null,
  birthYearText: '',
  height: { unit: 'in', value: null },
  weight: { unit: 'lb', current: null, goal: null },
  pace: PACE_DEFAULT_LB,
  concerns: [],
  goalKind: null,
  goalTags: [],
  experienceLevel: null,
  reminder: { kind: 'skipped', time: '09:00' },
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialDraft,
  gate: { kind: 'checking' },
  setGate: (gate) => set({ gate }),
  // A user who has not started has exactly one true answer to the last-shot
  // question, so the stage writes it and `postScheduleOrder` drops the screen.
  // Going back and answering `taking` clears it again, because the answer that
  // was inferred is not an answer this user gave.
  setJourneyStage: (journeyStage) => set({
    journeyStage,
    lastShot: journeyStage === 'starting' ? 'none' : null,
  }),
  toggleMedication: (id) => set((state) => {
    const selected = state.medicationIds.includes(id);
    const medicationIds = selected
      ? state.medicationIds.filter((item) => item !== id)
      : [...state.medicationIds, id];
    // Keep the draft of anything still selected. Deselecting and reselecting a
    // medication is a common slip, and losing the dose you typed is annoying.
    const schedules = selected ? withoutKey(state.schedules, id) : state.schedules;
    // A deselected custom has no row to reselect from, so its name goes with
    // it. Adding it again is one typed name away.
    const customNames = selected && isCustomMedicationId(id)
      ? withoutName(state.customNames, id)
      : state.customNames;
    return { medicationIds, schedules, customNames };
  }),
  addCustomMedication: (name) => {
    const id = nextCustomId(get().customNames);
    set((state) => ({
      medicationIds: [...state.medicationIds, id],
      customNames: { ...state.customNames, [id]: name.trim() },
    }));
    return id;
  },
  // The order of `medicationIds` is the order of the setup run, of the plan
  // screen and of `sort_order` in the database. Moving one to the front is
  // therefore the whole of the which-first answer, and every reader downstream
  // follows without being told.
  setFirstMedication: (id) => set((state) => {
    if (!state.medicationIds.includes(id)) return {};
    return { medicationIds: [id, ...state.medicationIds.filter((item) => item !== id)] };
  }),
  prepareSchedules: () => set((state) => {
    const schedules: Record<OnboardingMedicationId, MedicationScheduleDraft> = {};
    let changed = Object.keys(state.schedules).length !== state.medicationIds.length;
    for (const id of state.medicationIds) {
      const existing = state.schedules[id];
      if (existing) {
        schedules[id] = existing;
        continue;
      }
      schedules[id] = defaultScheduleDraft(id);
      changed = true;
    }
    return changed ? { schedules } : {};
  }),
  // A typed size is a vial answer, so it says so and it lifts the hatch. The
  // user who reaches for the keyboard after pressing Skip has changed their
  // mind, and the flag has to follow the answer or the run would drop a number
  // the user gave.
  setVialMg: (id, vialMgText) => set((state) => patchSchedule(state, id, {
    vialMgText,
    vialForm: 'vial',
    deferredVial: false,
  })),
  // A pen has no size to read and arrives already mixed, so picking one clears
  // the box and the saved mix rather than keeping numbers that belong to a vial
  // the user does not have.
  setVialForm: (id, vialForm) => set((state) => patchSchedule(state, id, {
    vialForm,
    vialMgText: vialForm === 'pen' ? '' : (state.schedules[id]?.vialMgText ?? ''),
    diluentMlText: vialForm === 'pen' ? '' : (state.schedules[id]?.diluentMlText ?? ''),
    deferredVial: false,
  })),
  // The mix beat holds the amount on the screen until the user presses Save, so
  // this writer runs once and only on that press. Skip calls nothing, which is
  // how the beat records that the user passed.
  setDiluentMl: (id, diluentMlText) => set((state) => patchSchedule(state, id, { diluentMlText })),
  // The three hatches. Each one clears the answer it covers and records the
  // pass, so nothing downstream can read a half-answer as a whole one.
  deferVial: (id) => set((state) => patchSchedule(state, id, {
    deferredVial: true,
    vialMgText: '',
    vialForm: null,
    compositionMg: {},
    diluentMlText: '',
  })),
  deferDose: (id) => set((state) => patchSchedule(state, id, {
    deferredDose: true,
    doseText: '',
  })),
  deferFrequency: (id) => set((state) => patchSchedule(state, id, {
    deferredFrequency: true,
    intervalText: '',
    weekdays: [],
  })),
  setScheduleDose: (id, doseText) => set((state) => patchSchedule(state, id, {
    doseText,
    deferredDose: false,
  })),
  setScheduleUnit: (id, unit) => set((state) => patchSchedule(state, id, { unit })),
  setScheduleRoute: (id, route) => set((state) => patchSchedule(state, id, { route })),
  // Pressing any frequency chip is an answer, so it lifts that hatch too.
  setScheduleFrequency: (id, frequencyKind) => set((state) => patchSchedule(state, id, {
    frequencyKind,
    deferredFrequency: false,
  })),
  setShotDay: (id, shotDay) => set((state) => patchSchedule(state, id, {
    shotDay,
    deferredFrequency: false,
  })),
  setScheduleInterval: (id, intervalText) => set((state) => patchSchedule(state, id, {
    intervalText,
    deferredFrequency: false,
  })),
  toggleScheduleWeekday: (id, weekday) => set((state) => {
    const current = state.schedules[id]?.weekdays ?? [];
    return patchSchedule(state, id, {
      weekdays: current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday],
      deferredFrequency: false,
    });
  }),
  setScheduleCompositionMg: (id, partId, text) => set((state) => {
    const current = state.schedules[id]?.compositionMg ?? {};
    return patchSchedule(state, id, { compositionMg: { ...current, [partId]: text } });
  }),
  setLastShot: (lastShot) => set({ lastShot }),
  setSex: (sex) => set({ sex }),
  setBirthYearText: (birthYearText) => set({ birthYearText }),
  // A unit switch converts the answer, it does not clear it and it does not
  // relabel it. 70 inches is 178 cm, and a wheel that read 70 cm after the
  // switch would be showing a different person.
  setHeightUnit: (unit) => set((state) => ({
    height: { unit, value: convertHeight(state.height.value, state.height.unit, unit) },
  })),
  setHeightValue: (value) => set((state) => ({ height: { ...state.height, value } })),
  // The goal screen takes as many answers as the user has, and `goal_kind` is
  // one column. The first pick is the one that column holds, so it survives
  // every later pick and only changes when the user clears it themselves.
  toggleGoal: (goalKind) => set((state) => {
    const goalTags = state.goalTags.includes(goalKind)
      ? state.goalTags.filter((tag) => tag !== goalKind)
      : [...state.goalTags, goalKind];
    return { goalTags, goalKind: goalTags[0] ?? null };
  }),
  setExperienceLevel: (experienceLevel) => set({ experienceLevel }),
  setWeightUnit: (unit) => set((state) => ({
    weight: {
      unit,
      current: convertWeight(state.weight.current, state.weight.unit, unit),
      goal: convertWeight(state.weight.goal, state.weight.unit, unit),
    },
    // The pace is stored in the weight unit, so switching units has to carry it
    // over. Otherwise "1 lb a week" silently becomes "1 kg a week", which is a
    // different plan and a much sooner date.
    pace: convertPace(state.pace, state.weight.unit, unit),
  })),
  setWeightValue: (field, value) => set((state) => ({
    weight: field === 'current'
      ? { ...state.weight, current: value }
      : { ...state.weight, goal: value },
  })),
  setPace: (pace) => set({ pace }),
  toggleConcern: (concern) => set((state) => {
    if (concern === 'none') return { concerns: ['none'] };
    const withoutNone = state.concerns.filter((item) => item !== 'none');
    return {
      concerns: withoutNone.includes(concern)
        ? withoutNone.filter((item) => item !== concern)
        : [...withoutNone, concern],
    };
  }),
  setReminderTime: (time) => set((state) => ({ reminder: { ...state.reminder, time } })),
  setReminderEnabled: (enabled) => set((state) => ({
    reminder: enabled
      ? { kind: 'enabled', time: state.reminder.time }
      : { kind: 'skipped', time: state.reminder.time },
  })),
  resetDraft: () => set({ ...initialDraft, schedules: {} }),
}));

const LB_PER_KG = 2.20462;

// Both conversions round to the step the wheel offers and then clamp to the
// wheel's ends, so the converted answer always lands on a row. A stored number
// the wheel cannot show is a number the user cannot correct.
function convertHeight(value: number | null, from: HeightUnit, to: HeightUnit): number | null {
  if (value === null || from === to) return value;
  const converted = to === 'cm' ? inToCm(value) : cmToIn(value);
  return clampToBounds(Math.round(converted), HEIGHT_BOUNDS[to]);
}

function convertWeight(value: number | null, from: WeightUnit, to: WeightUnit): number | null {
  if (value === null || from === to) return value;
  const converted = to === 'kg' ? lbToKg(value) : kgToLb(value);
  return clampToBounds(Math.round(converted * 10) / 10, WEIGHT_BOUNDS[to]);
}

function clampToBounds(value: number, bounds: { min: number; max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * A weekly pace, carried across a unit switch.
 *
 * Exported because Profile switches units on a pace that is already saved, and
 * the setup flow switches units on one that is not saved yet. Both are the same
 * sum, and two copies of it would let a stored plan and a drafted plan disagree.
 */
export function convertPace(pace: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return pace;
  return to === 'kg' ? pace / LB_PER_KG : pace * LB_PER_KG;
}

export function paceBounds(unit: WeightUnit): { min: number; max: number } {
  return unit === 'lb'
    ? { min: PACE_MIN_LB, max: PACE_MAX_LB }
    : { min: PACE_MIN_LB / LB_PER_KG, max: PACE_MAX_LB / LB_PER_KG };
}

function withoutKey(
  schedules: Record<OnboardingMedicationId, MedicationScheduleDraft>,
  id: OnboardingMedicationId,
): Record<OnboardingMedicationId, MedicationScheduleDraft> {
  const next = { ...schedules };
  delete next[id];
  return next;
}

function withoutName(
  customNames: Record<OnboardingMedicationId, string>,
  id: OnboardingMedicationId,
): Record<OnboardingMedicationId, string> {
  const next = { ...customNames };
  delete next[id];
  return next;
}

// One above the highest number currently in use. A removed custom's number can
// come back, and that is safe: removal drops the name and the schedule draft
// together, so a reused id starts as clean as a fresh one.
function nextCustomId(customNames: Record<OnboardingMedicationId, string>): OnboardingMedicationId {
  let highest = 0;
  for (const key of Object.keys(customNames)) {
    const value = Number.parseInt(key.slice(CUSTOM_MEDICATION_PREFIX.length), 10);
    if (Number.isFinite(value) && value > highest) highest = value;
  }
  return `${CUSTOM_MEDICATION_PREFIX}${highest + 1}`;
}

function patchSchedule(
  state: OnboardingState,
  id: OnboardingMedicationId,
  patch: Partial<MedicationScheduleDraft>,
): Partial<OnboardingState> {
  const existing = state.schedules[id];
  if (!existing) return {};
  return { schedules: { ...state.schedules, [id]: { ...existing, ...patch } } };
}

export function defaultScheduleDraft(id: OnboardingMedicationId): MedicationScheduleDraft {
  const preset = isCustomMedicationId(id) ? undefined : getPreset(id);
  return {
    medicationId: id,
    // Empty. The preset carries no dose to read, because `store.config.json`
    // `review.notes` tells App Review that Poke never proposes a number, and a
    // dose field that opens on 0.25 proposes one louder than a placeholder
    // would. The unit, the route and the frequency below are not doses, so they
    // keep their defaults.
    doseText: '',
    unit: preset?.unit ?? 'mg',
    route: preset?.defaultRoute ?? 'sc',
    frequencyKind: preset ? onboardingFrequency(preset.defaultFrequency.kind) : 'weekly',
    shotDay: currentShotDay(),
    // The interval a published protocol names, the same number `medications/new`
    // reads from the same field. It is a citation and not a dose, and the user
    // reads it on the screen and changes it before Continue is live.
    intervalText: preset?.defaultFrequency.value ? String(preset.defaultFrequency.value) : '',
    // Nothing preselected. No preset names a weekday set, and Poke picks no
    // shot day for anybody.
    weekdays: [],
    // Empty until the user copies their vial label. Poke proposes no split.
    compositionMg: {},
    // Empty and unknown until the vial question is answered. The catalog names
    // no vial size and no packaging form, so there is nothing here to read from
    // a preset even if Poke wanted to.
    vialMgText: '',
    vialForm: null,
    // Empty until the user saves a mix, and empty for every medication the mix
    // beat never runs for. Poke names no volume of water for anybody.
    diluentMlText: '',
    // Nothing is deferred until the user presses the hatch.
    deferredVial: false,
    deferredDose: false,
    deferredFrequency: false,
  };
}

// The catalog has more frequency kinds than onboarding offers. `custom` is the
// only one left with nowhere to land, and it falls to weekly, which the user
// confirms on the schedule screen.
function onboardingFrequency(kind: FrequencyKind): OnboardingFrequency {
  if (kind === 'daily') return 'daily';
  if (kind === 'twice_weekly') return 'twice_weekly';
  if (kind === 'every_n_days') return 'every_n_days';
  if (kind === 'weekdays') return 'weekdays';
  return 'weekly';
}

function currentShotDay(): ShotDay {
  const day = new Date().getDay();
  if (day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5 || day === 6) return day;
  return 1;
}

export function getOnboardingDraft(state: OnboardingState): OnboardingDraft {
  return {
    journeyStage: state.journeyStage,
    medicationIds: state.medicationIds,
    customNames: state.customNames,
    schedules: state.schedules,
    lastShot: state.lastShot,
    sex: state.sex,
    birthYearText: state.birthYearText,
    height: state.height,
    weight: state.weight,
    pace: state.pace,
    concerns: state.concerns,
    goalKind: state.goalKind,
    goalTags: state.goalTags,
    experienceLevel: state.experienceLevel,
    reminder: state.reminder,
  };
}

export function medicationDisplayName(
  id: OnboardingMedicationId,
  customNames: Record<OnboardingMedicationId, string>,
): string {
  if (isCustomMedicationId(id)) return customNames[id]?.trim() || 'Your medication';
  // A brand row keeps its brand from here to the plan card and the reminder.
  return getPresetEntry(id)?.name ?? id;
}

// ---------------------------------------------------------------- Flow ----
//
// The counted run has three parts, and every one of them reads its length off
// an array in this file. No screen counts anything for itself, and no total is
// typed by hand.
//
//   PRE_SCHEDULE_ORDER            the questions Poke asks before the schedules
//   the setup run                 one counted step, at any medication count
//   postScheduleOrder(stage, …)   the rest, which two answers reshape
//
// The setup run is one counted step and not n, even though it draws an order
// question and then three questions per medication per DECISIONS row 17.
// Counting the screens instead made the total grow while the user was still
// choosing medications, and a bar whose denominator grows under a fixed
// numerator runs backwards: selecting a second medication on the picker moved
// the fill on screen, under the user's thumb. So the run divides its one step
// between its screens (`setupStepIndex`), which is monotonic at any count and
// at any number of hatches, because every screen in the run is drawn whether or
// not the user answers it.
//
// Two answers change the length of the run. The knowledge question adds or
// drops the teach beats, and the journey question drops the last-shot question.
// Both totals move on the screen that asks, so the user watches their own
// answer shorten the run, which is the one place a moving total reads as an
// answer landing rather than as a bar going wrong.
//
// The carousel, the mix beat, the compute screen and the plan sit outside this
// count. See `MIX_ROUTE` for why the mix beat is one of them.

export type PreScheduleStep =
  | 'sex'
  | 'birthday'
  | 'goal'
  | 'knowledge'
  | 'creator'
  | 'journey'
  | 'taking';

/**
 * The questions before the schedules.
 *
 * The order is the flow, and the length is the offset the setup run sits at.
 * Adding a screen here is one line, and the progress bar, the back chevron and
 * every Continue target follow it.
 */
export const PRE_SCHEDULE_ORDER: readonly PreScheduleStep[] = [
  'sex',
  'birthday',
  'goal',
  'knowledge',
  // The creator code sits after the last question about the user and before the
  // first one about their treatment. It has to land before the plan screen
  // decides whether to open the paywall.
  'creator',
  'journey',
  'taking',
];

export const PRE_SCHEDULE_ROUTES: Record<PreScheduleStep, Href> = {
  sex: '/onboarding/sex',
  birthday: '/onboarding/birthday',
  goal: '/onboarding/goal',
  knowledge: '/onboarding/knowledge',
  creator: '/onboarding/creator',
  journey: '/onboarding/journey',
  taking: '/onboarding/taking',
};

/** Where the setup run sits in the count. Read off the array, never typed. */
export const SCHEDULE_STEP_OFFSET = PRE_SCHEDULE_ORDER.length;

export type PostScheduleStep =
  | 'how-a-shot-works'
  | 'last-shot'
  | 'why'
  | 'height'
  | 'weight'
  | 'goal-weight'
  | 'pace'
  | 'consistency'
  | 'rotation'
  | 'concerns'
  | 'evidence'
  | 'reminder-time'
  | 'notifications'
  | 'thanks';

/**
 * The longest run after the schedules: every question, and every teach beat in
 * the place it belongs. Nothing is ever reordered out of this list. A shorter
 * run is this list with rows filtered out of it, so a beat cannot land in one
 * place for one user and another place for the next.
 */
export const POST_SCHEDULE_ORDER: readonly PostScheduleStep[] = [
  'how-a-shot-works',
  'last-shot',
  'why',
  'height',
  'weight',
  'goal-weight',
  'pace',
  'consistency',
  'rotation',
  'concerns',
  'evidence',
  'reminder-time',
  'notifications',
  'thanks',
];

/**
 * The teach beats each experience level keeps.
 *
 * They are the screens that explain rather than ask, and how many of them a
 * user wants is exactly what the knowledge question asks. Somebody who has
 * injected for a year does not need the tour, and holding them through five
 * screens of it is the fastest way to lose them before the plan.
 *
 * `basics` keeps the two that are about Poke's own behaviour rather than about
 * injecting: the rotation map and where a half-life comes from. Both are claims
 * about the app, and both are new to a user however long they have injected.
 */
const TEACH_BEATS: Record<ExperienceLevel, readonly PostScheduleStep[]> = {
  new: ['how-a-shot-works', 'why', 'consistency', 'rotation', 'evidence'],
  basics: ['rotation', 'evidence'],
  experienced: [],
};

/** Every screen that is a teach beat for somebody. The rest always run. */
const TEACH_STEPS: ReadonlySet<PostScheduleStep> = new Set(TEACH_BEATS.new);

/**
 * The run after the schedules, for one journey stage and one experience level.
 *
 * `starting` drops the last-shot question. The journey screen asked whether the
 * user had started, so asking a user who said no when their last shot was reads
 * as a flow that did not listen. `setJourneyStage` writes `none` instead, which
 * is what that user would have picked. The teach beat that follows it stays
 * where it is: for a `new` user who has not started, `why` simply follows
 * `how-a-shot-works`.
 *
 * A null experience level is a skipped question, and it runs as `basics`. The
 * middle answer is the one that assumes least about somebody who told Poke
 * nothing.
 */
export function postScheduleOrder(
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
): readonly PostScheduleStep[] {
  const level: ExperienceLevel = experience ?? 'basics';
  const key = `${stage ?? 'unknown'}:${level}`;
  const cached = orderCache.get(key);
  if (cached) return cached;
  const kept = new Set(TEACH_BEATS[level]);
  const order = POST_SCHEDULE_ORDER.filter((step) => {
    if (step === 'last-shot') return stage !== 'starting';
    return !TEACH_STEPS.has(step) || kept.has(step);
  });
  orderCache.set(key, order);
  return order;
}

/**
 * One array per stage and level, built once.
 *
 * Every screen in the run asks for its order three times per render, for the
 * index, the total and the back target. A fresh array each time is a fresh
 * identity each time, and anything that memoises on it would rebuild on every
 * frame. There are nine possible orders and they never change at runtime.
 */
const orderCache = new Map<string, readonly PostScheduleStep[]>();

export const POST_SCHEDULE_ROUTES: Record<PostScheduleStep, Href> = {
  'how-a-shot-works': '/onboarding/how-a-shot-works',
  'last-shot': '/onboarding/last-shot',
  why: '/onboarding/why',
  height: '/onboarding/height',
  weight: '/onboarding/weight',
  'goal-weight': '/onboarding/goal-weight',
  pace: '/onboarding/pace',
  consistency: '/onboarding/consistency',
  rotation: '/onboarding/rotation',
  concerns: '/onboarding/concerns',
  evidence: '/onboarding/evidence',
  'reminder-time': '/onboarding/reminder-time',
  notifications: '/onboarding/notifications',
  thanks: '/onboarding/thanks',
};

/** Every counted screen in the flow. The two runs share no step name. */
export type OnboardingStepName = PreScheduleStep | PostScheduleStep;

const PRE_SCHEDULE_STEPS: ReadonlySet<string> = new Set(PRE_SCHEDULE_ORDER);

export function isPreScheduleStep(step: OnboardingStepName): step is PreScheduleStep {
  return PRE_SCHEDULE_STEPS.has(step);
}

function medicationCount(count: number): number {
  return Math.max(1, count);
}

/**
 * The three questions Poke asks about one medication, in the order it asks them.
 *
 * The vial comes first because it is the fact printed on the box in the user's
 * hand, so it is the easiest thing in the run to answer and it opens the run on
 * a win. The dose comes next because it is the number the clinician gave. The
 * frequency comes last because it is the only one of the three that the user may
 * still be deciding.
 */
export type SetupQuestion = 'vial' | 'dose' | 'frequency';

export const SETUP_QUESTIONS: readonly SetupQuestion[] = ['vial', 'dose', 'frequency'];

const SETUP_ROUTES: Record<SetupQuestion, `/onboarding/setup/[index]/${SetupQuestion}`> = {
  vial: '/onboarding/setup/[index]/vial',
  dose: '/onboarding/setup/[index]/dose',
  frequency: '/onboarding/setup/[index]/frequency',
};

/**
 * Whether the run opens on the which-first question.
 *
 * One medication has no order to choose, so asking would be a screen that can
 * only be answered one way. Two or more do, and the answer reorders
 * `medicationIds`, which is the order of everything downstream.
 */
export function whichFirstRuns(count: number): boolean {
  return count >= 2;
}

/** How many screens the setup run draws in total. Read, never typed. */
function setupRunLength(count: number): number {
  return (whichFirstRuns(count) ? 1 : 0)
    + medicationCount(count) * SETUP_QUESTIONS.length;
}

/** Which screen of the setup run a given question is, counting from zero. */
function setupPosition(index: number, question: SetupQuestion, count: number): number {
  const opening = whichFirstRuns(count) ? 1 : 0;
  const medication = Math.min(Math.max(0, index), medicationCount(count) - 1);
  return opening + medication * SETUP_QUESTIONS.length + SETUP_QUESTIONS.indexOf(question);
}

/** The setup question for medication `index`, as a route. */
export function setupHref(index: number, question: SetupQuestion): Href {
  return {
    pathname: SETUP_ROUTES[question],
    params: { index: String(Math.max(0, index)) },
  };
}

/** Where the setup run starts. Two medications open on the order question. */
export function firstSetupHref(count: number): Href {
  return whichFirstRuns(count) ? '/onboarding/which-first' : setupHref(0, 'vial');
}

/** Where the setup run ends, which is the last medication's last question. */
export function lastSetupHref(count: number): Href {
  return setupHref(medicationCount(count) - 1, 'frequency');
}

/**
 * The mix beat, which sits between the setup run and the post-schedule run.
 *
 * Uncounted, exactly as the compute beat is. It draws no progress bar, it is in
 * neither order array, and `onboardingTotalSteps` never sees it. A beat that
 * added a step would move the bar under a user who answered nothing, and a beat
 * that only some users see would move it for some of them and not others.
 */
const MIX_ROUTE: Href = '/onboarding/mix';

/**
 * Whether Poke can run the mixing math on what this draft holds.
 *
 * All three are needed and none of them can be filled in behind the user. The
 * vial has to be a size in milligrams, which `scheduleVialMg` returns for a vial
 * the user measured and null for a pen, a blend, a deferred question and a
 * number that does not parse. The dose has to be a dose. The unit has to be a
 * mass, because an international unit is a measure of activity rather than of
 * weight, and no volume can be worked out from one.
 */
function scheduleMixes(schedule: MedicationScheduleDraft): boolean {
  return scheduleVialMg(schedule) !== null
    && scheduleHasDose(schedule)
    && schedule.unit !== 'iu';
}

/**
 * The medication the mix beat runs for, or null when the beat does not run.
 *
 * The one source of truth for that decision. `setupNextHref` reads it to decide
 * whether the run ends in the beat or in the post-schedule order, and the beat
 * itself reads it to know whose numbers it is showing, so the screen the user
 * lands on can never be about a different medication from the one that sent
 * them there. The first qualifying medication in `medicationIds` order wins,
 * which is the order the user set on the which-first screen.
 *
 * Shaped as a selector, so a component reads it with
 * `useOnboardingStore(mixCandidateIndex)` and re-renders only when the answer
 * itself changes.
 */
export function mixCandidateIndex(
  draft: Pick<OnboardingDraft, 'medicationIds' | 'schedules'>,
): number | null {
  for (const [index, id] of draft.medicationIds.entries()) {
    const schedule = draft.schedules[id];
    if (schedule && scheduleMixes(schedule)) return index;
  }
  return null;
}

export function onboardingTotalSteps(
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
): number {
  return SCHEDULE_STEP_OFFSET + 1 + postScheduleOrder(stage, experience).length;
}

/**
 * Where a setup screen sits, as a fraction of the run's one step.
 *
 * Three medications draw ten screens and the run is still one counted step, so
 * each screen is a tenth of it. The fraction walks 0, 0.1, 0.2 up to 0.9 and the
 * next whole number belongs to the screen that really is that step, so the bar
 * only ever moves forward. The only reader is the progress bar, which takes a
 * float, and no screen does this sum for itself.
 */
export function setupStepIndex(index: number, question: SetupQuestion, count: number): number {
  return SCHEDULE_STEP_OFFSET + setupPosition(index, question, count) / setupRunLength(count);
}

/** Where the which-first screen sits, which is the front of the same step. */
export function whichFirstStepIndex(): number {
  return SCHEDULE_STEP_OFFSET;
}

/**
 * The screen after a setup question. It walks the three questions, then the
 * medications, then leaves the run for the mix beat or the post-schedule order.
 *
 * `mixIndex` is `mixCandidateIndex` read off the store by the caller, and it is
 * the whole of the decision: the last screen of the run leads into the beat
 * when a medication qualifies for it and straight past it when none does. It is
 * a parameter rather than a store read because every other target this file
 * hands out is a pure function of what it is given, and one of them reaching
 * into the store for an answer would hide the decision from the caller.
 */
export function setupNextHref(
  index: number,
  question: SetupQuestion,
  count: number,
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
  mixIndex: number | null,
): Href {
  const nextQuestion = SETUP_QUESTIONS[SETUP_QUESTIONS.indexOf(question) + 1];
  if (nextQuestion) return setupHref(index, nextQuestion);
  const nextMedication = index + 1;
  if (nextMedication < medicationCount(count)) return setupHref(nextMedication, 'vial');
  if (mixIndex !== null) return MIX_ROUTE;
  return firstPostScheduleHref(stage, experience);
}

/**
 * The screen before a setup question. It walks the same path backwards, out
 * through the which-first screen when there is one and onto the picker when
 * there is not, so back works across the whole run.
 */
export function setupBackHref(index: number, question: SetupQuestion, count: number): Href {
  const previousQuestion = SETUP_QUESTIONS[SETUP_QUESTIONS.indexOf(question) - 1];
  if (previousQuestion) return setupHref(index, previousQuestion);
  if (index > 0) return setupHref(index - 1, 'frequency');
  return whichFirstRuns(count) ? '/onboarding/which-first' : PRE_SCHEDULE_ROUTES.taking;
}

/** Where a counted screen sits in the bar. Both runs read their own array. */
export function onboardingStepIndex(
  step: OnboardingStepName,
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
): number {
  if (isPreScheduleStep(step)) return PRE_SCHEDULE_ORDER.indexOf(step);
  return SCHEDULE_STEP_OFFSET + 1 + postScheduleOrder(stage, experience).indexOf(step);
}

/**
 * The screen before `step`. Back never guesses; it reads the same order the
 * forward path reads. The first question falls back onto the carousel, and the
 * first post-schedule step onto the mix beat when one ran, or onto the last
 * schedule screen, whose index depends on how many medications were chosen.
 *
 * `mixIndex` is `mixCandidateIndex` read off the store by the caller, exactly
 * as `setupNextHref` takes it, so Back retraces the same path forward took.
 */
export function onboardingBackHref(
  step: OnboardingStepName,
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
  count: number,
  mixIndex: number | null,
): Href {
  if (isPreScheduleStep(step)) {
    const index = PRE_SCHEDULE_ORDER.indexOf(step);
    const previous = index > 0 ? PRE_SCHEDULE_ORDER[index - 1] : undefined;
    return previous ? PRE_SCHEDULE_ROUTES[previous] : '/onboarding';
  }
  const order = postScheduleOrder(stage, experience);
  const index = order.indexOf(step);
  const previous = index > 0 ? order[index - 1] : undefined;
  if (previous) return POST_SCHEDULE_ROUTES[previous];
  if (mixIndex !== null) return MIX_ROUTE;
  return lastSetupHref(count);
}

/**
 * The screen after `step`. The last question before the schedules leads into
 * the setup run, whose first screen depends on how many medications were
 * chosen, and the last screen of all leads to the compute beat.
 */
export function onboardingNextHref(
  step: OnboardingStepName,
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
  count: number,
): Href {
  if (isPreScheduleStep(step)) {
    const index = PRE_SCHEDULE_ORDER.indexOf(step);
    const next = PRE_SCHEDULE_ORDER[index + 1];
    return next ? PRE_SCHEDULE_ROUTES[next] : firstSetupHref(count);
  }
  const order = postScheduleOrder(stage, experience);
  const next = order[order.indexOf(step) + 1];
  return next ? POST_SCHEDULE_ROUTES[next] : '/onboarding/compute';
}

/**
 * The first screen of the post-schedule run. The setup run jumps here,
 * and they read the order rather than a step name, because the first step is
 * not the same step for every stage and every experience level.
 */
export function firstPostScheduleHref(
  stage: JourneyStage | null,
  experience: ExperienceLevel | null,
): Href {
  return POST_SCHEDULE_ROUTES[postScheduleOrder(stage, experience)[0]];
}
