import type { PreferencesPatch } from '../repositories/preferences';
import type { NewMedication } from '../repositories/medications';
import type { OnboardingDraft, OnboardingMedicationId } from '../stores/onboarding';
import { getPreset } from '../domain/peptides';
import { createMeasurement, latestMeasurement } from '../repositories/measurements';
import {
  createMedication,
  listMedications,
  nextColorIndex,
  updateMedicationDefaults,
} from '../repositories/medications';
import { updatePreferences } from '../repositories/preferences';
import { refreshScheduledReminders } from './notifications';

interface MedicationSeed {
  selectionId: OnboardingMedicationId;
  medication: Omit<NewMedication, 'colorIndex'>;
}

function parsePositive(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Enter a valid ${label}.`);
  return parsed;
}

function medicationSeeds(draft: OnboardingDraft): MedicationSeed[] {
  if (draft.medicationIds.length === 0) throw new Error('Choose at least one medication.');
  const schedule = draft.schedule;
  if (schedule.kind !== 'ready') throw new Error('Add your dose and schedule.');
  if (schedule.primaryMedicationId !== draft.medicationIds[0]) {
    throw new Error('Review the schedule for your primary medication.');
  }

  const primaryDose = parsePositive(schedule.doseText, 'dose');
  return draft.medicationIds.map((selectionId, index) => {
    if (selectionId === 'custom') {
      const name = draft.customMedicationName.trim();
      if (!name) throw new Error('Add a name for your custom medication.');
      return {
        selectionId,
        medication: {
          name,
          presetId: null,
          defaultDose: primaryDose,
          defaultUnit: schedule.unit,
          defaultRoute: schedule.route,
          frequencyKind: schedule.frequencyKind,
          frequencyValue: schedule.frequencyKind === 'daily' ? null : schedule.shotDay,
          halfLifeHours: null,
          tmaxHours: null,
        },
      };
    }

    const preset = getPreset(selectionId);
    if (!preset) throw new Error('A selected medication preset is no longer available.');
    const isPrimary = index === 0;
    const frequencyKind = isPrimary ? schedule.frequencyKind : preset.defaultFrequency.kind;
    const frequencyValue = isPrimary && frequencyKind !== 'daily'
      ? schedule.shotDay
      : preset.defaultFrequency.value ?? null;
    return {
      selectionId,
      medication: {
        name: preset.name,
        presetId: preset.id,
        defaultDose: isPrimary ? primaryDose : preset.defaultDose,
        defaultUnit: isPrimary ? schedule.unit : preset.unit,
        defaultRoute: isPrimary ? schedule.route : preset.defaultRoute,
        frequencyKind,
        frequencyValue,
        halfLifeHours: preset.halfLifeHours,
        tmaxHours: preset.tmaxHours,
      },
    };
  });
}

export async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
  const seeds = medicationSeeds(draft);
  if (!draft.goalKind) throw new Error('Choose your goal.');
  if (draft.concerns.length === 0) throw new Error('Choose what you want to watch for.');

  const reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminder.time)
    ? draft.reminder.time
    : '09:00';
  const now = Date.now();
  const existingMedications = await listMedications(true);

  for (const seed of seeds) {
    const existing = existingMedications.find((medication) => {
      if (seed.selectionId === 'custom') {
        return medication.preset_id === null
          && medication.name.trim().toLocaleLowerCase() === seed.medication.name.trim().toLocaleLowerCase();
      }
      return medication.preset_id === seed.selectionId;
    });
    if (existing) {
      await updateMedicationDefaults(existing.id, seed.medication);
      continue;
    }
    const colorIndex = await nextColorIndex();
    const created = await createMedication({ ...seed.medication, colorIndex });
    existingMedications.push(created);
  }

  const preferences: PreferencesPatch = {
    goal_kind: draft.goalKind,
    side_effect_concerns: JSON.stringify(draft.concerns),
    reminder_time: reminderTime,
    notifications_enabled: draft.reminder.kind === 'enabled' ? 1 : 0,
    onboarding_completed_at: now,
  };

  if (draft.weight.kind === 'entered') {
    const currentWeight = parsePositive(draft.weight.currentText, 'current weight');
    const goalWeight = parsePositive(draft.weight.goalText, 'goal weight');
    const latest = await latestMeasurement('weight');
    const alreadyRecorded = latest?.value === currentWeight && latest.unit === draft.weight.unit;
    if (!alreadyRecorded) {
      await createMeasurement({
        kind: 'weight',
        value: currentWeight,
        unit: draft.weight.unit,
        takenAt: now,
        notes: 'Added during onboarding',
      });
    }
    preferences.weight_unit = draft.weight.unit;
    preferences.start_weight = currentWeight;
    preferences.start_weight_at = now;
    preferences.goal_weight = goalWeight;
  }

  await updatePreferences(preferences);
  await refreshScheduledReminders().catch(() => {});
}
