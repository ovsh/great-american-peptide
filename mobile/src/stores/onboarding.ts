import { create } from 'zustand';

import type { GoalKind } from '../db/types';
import { getPreset, type Route, type Unit } from '../domain/peptides';
import type { WeightUnit } from '../domain/units';

export const ONBOARDING_PRESET_IDS = [
  'semaglutide',
  'tirzepatide',
  'retatrutide',
  'bpc-157',
  'tb-500',
  'ghk-cu',
] as const;

export type OnboardingPresetId = (typeof ONBOARDING_PRESET_IDS)[number];
export type OnboardingMedicationId = OnboardingPresetId | 'custom';
export type OnboardingFrequency = 'daily' | 'twice_weekly' | 'weekly';
export type SideEffectConcern = 'nausea' | 'fatigue' | 'constipation' | 'injection_site' | 'none';
export type ShotDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const GOAL_OPTIONS: readonly { id: GoalKind; label: string; description: string }[] = [
  { id: 'weight_loss', label: 'Weight loss', description: 'Keep your shot routine and weight goal together.' },
  { id: 'recovery', label: 'Recovery', description: 'Track the routine that supports your recovery.' },
  { id: 'longevity', label: 'Longevity', description: 'Build a consistent long-term routine.' },
  { id: 'performance', label: 'Performance', description: 'Keep doses and training days easy to review.' },
];

export const CONCERN_OPTIONS: readonly { id: SideEffectConcern; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'injection_site', label: 'Injection-site reactions' },
  { id: 'none', label: 'None right now' },
];

export const SHOT_DAY_OPTIONS = [
  { value: 1, shortLabel: 'Mon', label: 'Monday' },
  { value: 2, shortLabel: 'Tue', label: 'Tuesday' },
  { value: 3, shortLabel: 'Wed', label: 'Wednesday' },
  { value: 4, shortLabel: 'Thu', label: 'Thursday' },
  { value: 5, shortLabel: 'Fri', label: 'Friday' },
  { value: 6, shortLabel: 'Sat', label: 'Saturday' },
  { value: 0, shortLabel: 'Sun', label: 'Sunday' },
] as const satisfies readonly { value: ShotDay; shortLabel: string; label: string }[];

export type OnboardingGate =
  | { kind: 'checking' }
  | { kind: 'required' }
  | { kind: 'complete' }
  | { kind: 'error'; message: string };

export type ScheduleDraft =
  | { kind: 'unprepared' }
  | {
      kind: 'ready';
      primaryMedicationId: OnboardingMedicationId;
      doseText: string;
      unit: Unit;
      route: Route;
      frequencyKind: OnboardingFrequency;
      shotDay: ShotDay;
    };

export type WeightDraft =
  | { kind: 'skipped'; unit: WeightUnit }
  | { kind: 'entered'; unit: WeightUnit; currentText: string; goalText: string };

export type ReminderDraft =
  | { kind: 'skipped'; time: string }
  | { kind: 'enabled'; time: string };

export interface OnboardingDraft {
  medicationIds: OnboardingMedicationId[];
  customMedicationName: string;
  schedule: ScheduleDraft;
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
  prepareSchedule: () => void;
  setScheduleDose: (doseText: string) => void;
  setScheduleUnit: (unit: Unit) => void;
  setScheduleRoute: (route: Route) => void;
  setScheduleFrequency: (frequencyKind: OnboardingFrequency) => void;
  setShotDay: (shotDay: ShotDay) => void;
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
  schedule: { kind: 'unprepared' },
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
    const medicationIds: OnboardingMedicationId[] = selected
      ? state.medicationIds.filter((item) => item !== id)
      : id === 'custom'
        ? ['custom', ...state.medicationIds]
        : [...state.medicationIds, id];
    return { medicationIds, schedule: { kind: 'unprepared' } };
  }),
  setCustomMedicationName: (customMedicationName) => set({ customMedicationName }),
  prepareSchedule: () => {
    const state = get();
    const primaryMedicationId = state.medicationIds[0];
    if (!primaryMedicationId) return;
    if (state.schedule.kind === 'ready' && state.schedule.primaryMedicationId === primaryMedicationId) return;
    const preset = primaryMedicationId === 'custom' ? undefined : getPreset(primaryMedicationId);
    set({
      schedule: {
        kind: 'ready',
        primaryMedicationId,
        doseText: preset ? String(preset.defaultDose) : '',
        unit: preset?.unit ?? 'mg',
        route: preset?.defaultRoute ?? 'sc',
        frequencyKind: 'weekly',
        shotDay: currentShotDay(),
      },
    });
  },
  setScheduleDose: (doseText) => set((state) => ({
    schedule: state.schedule.kind === 'ready' ? { ...state.schedule, doseText } : state.schedule,
  })),
  setScheduleUnit: (unit) => set((state) => ({
    schedule: state.schedule.kind === 'ready' ? { ...state.schedule, unit } : state.schedule,
  })),
  setScheduleRoute: (route) => set((state) => ({
    schedule: state.schedule.kind === 'ready' ? { ...state.schedule, route } : state.schedule,
  })),
  setScheduleFrequency: (frequencyKind) => set((state) => ({
    schedule: state.schedule.kind === 'ready' ? { ...state.schedule, frequencyKind } : state.schedule,
  })),
  setShotDay: (shotDay) => set((state) => ({
    schedule: state.schedule.kind === 'ready' ? { ...state.schedule, shotDay } : state.schedule,
  })),
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
  resetDraft: () => set({ ...initialDraft }),
}));

function currentShotDay(): ShotDay {
  const day = new Date().getDay();
  if (day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5 || day === 6) return day;
  return 1;
}

export function getOnboardingDraft(state: OnboardingState): OnboardingDraft {
  return {
    medicationIds: state.medicationIds,
    customMedicationName: state.customMedicationName,
    schedule: state.schedule,
    goalKind: state.goalKind,
    weight: state.weight,
    concerns: state.concerns,
    reminder: state.reminder,
  };
}
