import { create } from 'zustand';

import type { GoalKind } from '../db/types';
import { getPreset, type FrequencyKind, type Route, type Unit } from '../domain/peptides';
import { WEEKDAY_OPTIONS, type Weekday } from '../domain/scheduling';
import type { WeightUnit } from '../domain/units';

// The one id that is not a catalog preset. The user types the name instead.
export const CUSTOM_MEDICATION_ID = 'custom';

// A preset id, or CUSTOM_MEDICATION_ID. The picker searches the whole catalog,
// so this cannot be a fixed union of ids.
export type OnboardingMedicationId = string;
export type OnboardingFrequency = 'daily' | 'twice_weekly' | 'weekly';
export type SideEffectConcern = 'nausea' | 'fatigue' | 'constipation' | 'injection_site' | 'none';
export type ShotDay = Weekday;

export const GOAL_OPTIONS: readonly { id: GoalKind; label: string; description: string }[] = [
  { id: 'weight_loss', label: 'Weight loss', description: 'Keep your shot routine and weight goal together.' },
  { id: 'recovery', label: 'Recovery', description: 'Track the routine that supports your recovery.' },
  { id: 'longevity', label: 'Longevity', description: 'Build a consistent long-term routine.' },
  { id: 'performance', label: 'Performance', description: 'Keep every dose and every date in one log.' },
];

export const CONCERN_OPTIONS: readonly { id: SideEffectConcern; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'injection_site', label: 'Injection-site reactions' },
  { id: 'none', label: 'None right now' },
];

export const SHOT_DAY_OPTIONS = WEEKDAY_OPTIONS;

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
}

export type WeightDraft =
  | { kind: 'skipped'; unit: WeightUnit }
  | { kind: 'entered'; unit: WeightUnit; currentText: string; goalText: string };

export type ReminderDraft =
  | { kind: 'skipped'; time: string }
  | { kind: 'enabled'; time: string };

export interface OnboardingDraft {
  medicationIds: OnboardingMedicationId[];
  customMedicationName: string;
  // One schedule per selected medication, keyed by medication id. Every
  // selection gets its own screen, so nothing is filled in behind the user.
  schedules: Record<OnboardingMedicationId, MedicationScheduleDraft>;
  goalKind: GoalKind | null;
  weight: WeightDraft;
  concerns: SideEffectConcern[];
  reminder: ReminderDraft;
}

export interface OnboardingState extends OnboardingDraft {
  gate: OnboardingGate;
  setGate: (gate: OnboardingGate) => void;
  toggleMedication: (id: OnboardingMedicationId) => void;
  setCustomMedicationName: (name: string) => void;
  prepareSchedules: () => void;
  setScheduleDose: (id: OnboardingMedicationId, doseText: string) => void;
  setScheduleUnit: (id: OnboardingMedicationId, unit: Unit) => void;
  setScheduleRoute: (id: OnboardingMedicationId, route: Route) => void;
  setScheduleFrequency: (id: OnboardingMedicationId, frequencyKind: OnboardingFrequency) => void;
  setShotDay: (id: OnboardingMedicationId, shotDay: ShotDay) => void;
  setGoalKind: (goalKind: GoalKind) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setWeightValue: (field: 'current' | 'goal', value: string) => void;
  skipWeight: () => void;
  toggleConcern: (concern: SideEffectConcern) => void;
  setReminderTime: (time: string) => void;
  setReminderEnabled: (enabled: boolean) => void;
  resetDraft: () => void;
}

const initialDraft: OnboardingDraft = {
  medicationIds: [],
  customMedicationName: '',
  schedules: {},
  goalKind: null,
  weight: { kind: 'skipped', unit: 'lb' },
  concerns: [],
  reminder: { kind: 'skipped', time: '09:00' },
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialDraft,
  gate: { kind: 'checking' },
  setGate: (gate) => set({ gate }),
  toggleMedication: (id) => set((state) => {
    const selected = state.medicationIds.includes(id);
    const medicationIds = selected
      ? state.medicationIds.filter((item) => item !== id)
      : [...state.medicationIds, id];
    // Keep the draft of anything still selected. Deselecting and reselecting a
    // medication is a common slip, and losing the dose you typed is annoying.
    const schedules = selected ? withoutKey(state.schedules, id) : state.schedules;
    return { medicationIds, schedules };
  }),
  setCustomMedicationName: (customMedicationName) => set({ customMedicationName }),
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
  setGoalKind: (goalKind) => set({ goalKind }),
  setWeightUnit: (unit) => set((state) => ({
    weight: state.weight.kind === 'entered'
      ? { ...state.weight, unit }
      : { kind: 'skipped', unit },
  })),
  setWeightValue: (field, value) => set((state) => {
    const weight = state.weight.kind === 'entered'
      ? state.weight
      : { kind: 'entered', unit: state.weight.unit, currentText: '', goalText: '' } satisfies WeightDraft;
    return {
      weight: field === 'current'
        ? { ...weight, currentText: value }
        : { ...weight, goalText: value },
    };
  }),
  skipWeight: () => set((state) => ({ weight: { kind: 'skipped', unit: state.weight.unit } })),
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

function withoutKey(
  schedules: Record<OnboardingMedicationId, MedicationScheduleDraft>,
  id: OnboardingMedicationId,
): Record<OnboardingMedicationId, MedicationScheduleDraft> {
  const next = { ...schedules };
  delete next[id];
  return next;
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
  const preset = id === CUSTOM_MEDICATION_ID ? undefined : getPreset(id);
  return {
    medicationId: id,
    doseText: preset ? String(preset.defaultDose) : '',
    unit: preset?.unit ?? 'mg',
    route: preset?.defaultRoute ?? 'sc',
    frequencyKind: preset ? onboardingFrequency(preset.defaultFrequency.kind) : 'weekly',
    shotDay: currentShotDay(),
  };
}

// The catalog has more frequency kinds than onboarding offers. Anything that
// does not map lands on weekly, and the user confirms it on the schedule screen.
function onboardingFrequency(kind: FrequencyKind): OnboardingFrequency {
  if (kind === 'daily') return 'daily';
  if (kind === 'twice_weekly') return 'twice_weekly';
  return 'weekly';
}

function currentShotDay(): ShotDay {
  const day = new Date().getDay();
  if (day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5 || day === 6) return day;
  return 1;
}

export function getOnboardingDraft(state: OnboardingState): OnboardingDraft {
  return {
    medicationIds: state.medicationIds,
    customMedicationName: state.customMedicationName,
    schedules: state.schedules,
    goalKind: state.goalKind,
    weight: state.weight,
    concerns: state.concerns,
    reminder: state.reminder,
  };
}

export function medicationDisplayName(
  id: OnboardingMedicationId,
  customMedicationName: string,
): string {
  if (id === CUSTOM_MEDICATION_ID) return customMedicationName.trim() || 'Your medication';
  return getPreset(id)?.name ?? id;
}

// ---------------------------------------------------------------- Flow ----
//
// The flow length changes with the number of medications, because each one gets
// its own schedule screen. The progress dots and the back links both read from
// these helpers, so there is one place that knows the order.
//
//   0                welcome
//   1                what are you taking
//   2 … 2+n-1        one schedule screen per medication
//   2+n … 2+n+4      goal, weight, concerns, reminders, ready

export const SCHEDULE_STEP_OFFSET = 2;
export type PostScheduleStep = 'goal' | 'weight' | 'concerns' | 'reminders' | 'ready';

const POST_SCHEDULE_ORDER: readonly PostScheduleStep[] = [
  'goal',
  'weight',
  'concerns',
  'reminders',
  'ready',
];

function medicationCount(count: number): number {
  return Math.max(1, count);
}

export function onboardingTotalSteps(count: number): number {
  return SCHEDULE_STEP_OFFSET + medicationCount(count) + POST_SCHEDULE_ORDER.length;
}

export function scheduleStepIndex(index: number): number {
  return SCHEDULE_STEP_OFFSET + index;
}

export function postScheduleStepIndex(count: number, step: PostScheduleStep): number {
  return SCHEDULE_STEP_OFFSET + medicationCount(count) + POST_SCHEDULE_ORDER.indexOf(step);
}
