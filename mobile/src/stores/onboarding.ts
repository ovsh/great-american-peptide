import type { Href } from 'expo-router';
import { create } from 'zustand';

import type { ActivityLevel, GoalKind, JourneyStage, Sex } from '../db/types';
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
  { id: 'taking', label: "I'm already taking something" },
  { id: 'starting', label: "I'm about to start" },
];

export const SEX_OPTIONS: readonly { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Prefer not to say' },
];

export const ACTIVITY_OPTIONS: readonly { id: ActivityLevel; label: string; description: string }[] = [
  { id: 'low', label: 'Mostly seated', description: 'Desk work and not much walking.' },
  { id: 'light', label: 'Lightly active', description: 'A walk most days.' },
  { id: 'active', label: 'Active', description: 'You train two or three times a week.' },
  { id: 'very_active', label: 'Very active', description: 'You move nearly every day.' },
];

// These five are the user talking, not Poke, so they keep their contractions the
// way `LAST_SHOT_OPTIONS` does. "No contractions" governs Poke's own voice, and a
// person picking the line closest to true does not say "I have started before".
// Every one of them is a sentence the user could say out loud about themselves.
// The health option used to be the exception, a fragment about a clinician, and
// it broke the read halfway down the list.
export const MOTIVATION_OPTIONS: readonly { id: string; label: string }[] = [
  { id: 'energy', label: 'I want my energy back' },
  { id: 'health', label: 'I want a better number at my next appointment' },
  { id: 'clothes', label: 'I want to feel right in my own clothes' },
  { id: 'longevity', label: "I'm playing the long game" },
  { id: 'consistency', label: "I've started before, and I want it to stick this time" },
];

export const LAST_SHOT_OPTIONS: readonly { id: LastShotChoice; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'Earlier this week' },
  { id: 'longer', label: 'Longer ago than that' },
  { id: 'none', label: "I haven't had one yet" },
];

// Labels only. Only the label is ever shown again, on the plan card, and a
// four-word gloss under `Weight loss` tells nobody anything.
export const GOAL_OPTIONS: readonly { id: GoalKind; label: string }[] = [
  { id: 'weight_loss', label: 'Weight loss' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'longevity', label: 'Longevity' },
  { id: 'performance', label: 'Performance' },
];

export const CONCERN_OPTIONS: readonly { id: SideEffectConcern; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'injection_site', label: 'Injection-site reactions' },
  { id: 'none', label: 'None right now' },
];

export const SHOT_DAY_OPTIONS = WEEKDAY_OPTIONS;

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

/** Whether the user has finished this schedule. The Continue button reads it. */
export function scheduleIsComplete(schedule: MedicationScheduleDraft): boolean {
  const dose = Number.parseFloat(schedule.doseText);
  if (!Number.isFinite(dose) || dose <= 0) return false;
  if (!compositionSettled(schedule)) return false;
  if (schedule.frequencyKind === 'daily') return true;
  return scheduleFrequencyValue(schedule) !== null;
}

/**
 * Whether the blend label boxes allow a save: every box filled or every box
 * empty. A label copied halfway hands the missing parts' milligrams to the
 * typed parts, so Continue waits rather than saving a vial nobody owns.
 * Anything that is not a blend has no boxes and always passes.
 */
function compositionSettled(schedule: MedicationScheduleDraft): boolean {
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
  activityLevel: ActivityLevel | null;
  concerns: SideEffectConcern[];
  goalKind: GoalKind | null;
  motivation: string | null;
  reminder: ReminderDraft;
}

export interface OnboardingState extends OnboardingDraft {
  gate: OnboardingGate;
  setGate: (gate: OnboardingGate) => void;
  setJourneyStage: (stage: JourneyStage) => void;
  toggleMedication: (id: OnboardingMedicationId) => void;
  addCustomMedication: (name: string) => OnboardingMedicationId;
  prepareSchedules: () => void;
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
  setGoalKind: (goalKind: GoalKind) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setWeightValue: (field: 'current' | 'goal', value: number | null) => void;
  setPace: (pace: number) => void;
  setActivityLevel: (level: ActivityLevel) => void;
  toggleConcern: (concern: SideEffectConcern) => void;
  setMotivation: (motivation: string) => void;
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
  activityLevel: null,
  concerns: [],
  goalKind: null,
  motivation: null,
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
  setScheduleDose: (id, doseText) => set((state) => patchSchedule(state, id, { doseText })),
  setScheduleUnit: (id, unit) => set((state) => patchSchedule(state, id, { unit })),
  setScheduleRoute: (id, route) => set((state) => patchSchedule(state, id, { route })),
  setScheduleFrequency: (id, frequencyKind) => set((state) => patchSchedule(state, id, { frequencyKind })),
  setShotDay: (id, shotDay) => set((state) => patchSchedule(state, id, { shotDay })),
  setScheduleInterval: (id, intervalText) => set((state) => patchSchedule(state, id, { intervalText })),
  toggleScheduleWeekday: (id, weekday) => set((state) => {
    const current = state.schedules[id]?.weekdays ?? [];
    return patchSchedule(state, id, {
      weekdays: current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday],
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
  setGoalKind: (goalKind) => set({ goalKind }),
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
  setActivityLevel: (activityLevel) => set({ activityLevel }),
  toggleConcern: (concern) => set((state) => {
    if (concern === 'none') return { concerns: ['none'] };
    const withoutNone = state.concerns.filter((item) => item !== 'none');
    return {
      concerns: withoutNone.includes(concern)
        ? withoutNone.filter((item) => item !== concern)
        : [...withoutNone, concern],
    };
  }),
  setMotivation: (motivation) => set({ motivation }),
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
    activityLevel: state.activityLevel,
    concerns: state.concerns,
    goalKind: state.goalKind,
    motivation: state.motivation,
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
// Twenty-three counted steps, fixed, matching the recording's own progress bar.
// Four of them are interstitials, four ask for no data, and fifteen are questions.
//
//   0                          privacy
//   1                          journey
//   2                          medication picker
//   3                          the schedule run, whatever its length
//   4 …                        the rest, in POST_SCHEDULE_ORDER
//
// The schedule run is one counted step and not n, even though it draws one
// screen per medication per DECISIONS row 17. Counting the screens instead made
// the total grow while the user was still choosing medications, and a bar whose
// denominator grows under a fixed numerator runs backwards: selecting a second
// medication on the picker moved the fill from 3/23 to 3/24, on screen, under
// the user's thumb. So the run divides the one step between its screens
// (`scheduleStepIndex`), which is monotonic at any medication count and is also
// what the recording does.
//
// The carousel, the compute screen and the plan sit outside this count, exactly
// as they do in the recording.

export const SCHEDULE_STEP_OFFSET = 3;

export type PostScheduleStep =
  | 'last-shot'
  | 'why'
  | 'sex'
  | 'birthday'
  | 'height'
  | 'weight'
  | 'goal-weight'
  | 'pace'
  | 'consistency'
  | 'activity'
  | 'rotation'
  | 'concerns'
  | 'evidence'
  | 'goal'
  | 'motivation'
  | 'on-device'
  | 'reminder-time'
  | 'notifications'
  | 'thanks';

// The order is the flow. Every screen reads its own index from here, so the
// progress bar, the back chevron and the Continue target cannot drift apart.
export const POST_SCHEDULE_ORDER: readonly PostScheduleStep[] = [
  'last-shot',
  'why', // interstitial 1 — recording step 6
  'sex',
  'birthday',
  'height',
  'weight',
  'goal-weight',
  'pace',
  'consistency', // interstitial 2 — recording step 13
  'activity',
  'rotation', // interstitial 3 — recording step 15
  'concerns',
  'evidence', // interstitial 4 — recording step 17
  'goal',
  'motivation',
  'on-device',
  'reminder-time',
  'notifications',
  'thanks',
];

/**
 * The run, for one journey stage.
 *
 * `starting` drops the last-shot question. The screen before it asked whether
 * the user had started, so asking a user who said no when their last shot was
 * reads as a flow that did not listen. `setJourneyStage` writes `none` instead,
 * which is what that user would have picked.
 */
export function postScheduleOrder(stage: JourneyStage | null): readonly PostScheduleStep[] {
  return stage === 'starting' ? STARTING_ORDER : POST_SCHEDULE_ORDER;
}

const STARTING_ORDER: readonly PostScheduleStep[] =
  POST_SCHEDULE_ORDER.filter((step) => step !== 'last-shot');

export const POST_SCHEDULE_ROUTES: Record<PostScheduleStep, Href> = {
  'last-shot': '/onboarding/last-shot',
  why: '/onboarding/why',
  sex: '/onboarding/sex',
  birthday: '/onboarding/birthday',
  height: '/onboarding/height',
  weight: '/onboarding/weight',
  'goal-weight': '/onboarding/goal-weight',
  pace: '/onboarding/pace',
  consistency: '/onboarding/consistency',
  activity: '/onboarding/activity',
  rotation: '/onboarding/rotation',
  concerns: '/onboarding/concerns',
  evidence: '/onboarding/evidence',
  goal: '/onboarding/goal',
  motivation: '/onboarding/motivation',
  'on-device': '/onboarding/on-device',
  'reminder-time': '/onboarding/reminder-time',
  notifications: '/onboarding/notifications',
  thanks: '/onboarding/thanks',
};

function medicationCount(count: number): number {
  return Math.max(1, count);
}

export function onboardingTotalSteps(stage: JourneyStage | null): number {
  return SCHEDULE_STEP_OFFSET + 1 + postScheduleOrder(stage).length;
}

/**
 * Where schedule screen `index` of `count` sits, as a fraction of one step.
 *
 * Two medications put the second schedule screen at 3.5, so the bar advances
 * half a step through the run and arrives at 4 alongside the screen that really
 * is step 4. The only reader is the progress bar, which takes a float.
 */
export function scheduleStepIndex(index: number, count: number): number {
  return SCHEDULE_STEP_OFFSET + index / medicationCount(count);
}

export function postScheduleStepIndex(stage: JourneyStage | null, step: PostScheduleStep): number {
  return SCHEDULE_STEP_OFFSET + 1 + postScheduleOrder(stage).indexOf(step);
}

/**
 * The screen before `step`. Back never guesses; it reads the same order the
 * forward path reads. The first post-schedule step falls back onto the last
 * schedule screen, whose index depends on how many medications were chosen.
 */
export function previousHref(
  stage: JourneyStage | null,
  count: number,
  step: PostScheduleStep,
): Href {
  const order = postScheduleOrder(stage);
  const index = order.indexOf(step);
  const previous = index > 0 ? order[index - 1] : undefined;
  if (previous) return POST_SCHEDULE_ROUTES[previous];
  return {
    pathname: '/onboarding/schedule/[index]',
    params: { index: String(Math.max(0, medicationCount(count) - 1)) },
  };
}

/**
 * The first screen of the post-schedule run. The schedule screens jump here,
 * and they read the order rather than a step name, because the first step is
 * not the same step for every journey stage.
 */
export function firstPostScheduleHref(stage: JourneyStage | null): Href {
  return POST_SCHEDULE_ROUTES[postScheduleOrder(stage)[0]];
}

/** The screen after `step`. The last one leads to the compute beat. */
export function nextHref(stage: JourneyStage | null, step: PostScheduleStep): Href {
  const order = postScheduleOrder(stage);
  const index = order.indexOf(step);
  const next = order[index + 1];
  return next ? POST_SCHEDULE_ROUTES[next] : '/onboarding/compute';
}
