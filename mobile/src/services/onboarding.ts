import type { PreferencesPatch } from '../repositories/preferences';
import type { NewMedication } from '../repositories/medications';
import { CUSTOM_MEDICATION_ID, type OnboardingDraft, type OnboardingMedicationId } from '../stores/onboarding';
import { getPreset } from '../domain/peptides';
import { createMeasurement, latestMeasurement } from '../repositories/measurements';
import {
  createMedication,
  listMedications,
  nextColorIndex,
  setMedicationStatus,
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
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Enter a ${label} above zero.`);
  return parsed;
}

function medicationSeeds(draft: OnboardingDraft): MedicationSeed[] {
  if (draft.medicationIds.length === 0) throw new Error('Choose at least one medication.');

  // Every selected medication has its own schedule screen, so every one of them
  // must have its own draft here. Nothing is filled in behind the user.
  return draft.medicationIds.map((selectionId) => {
    const schedule = draft.schedules[selectionId];
    if (!schedule) throw new Error('Add a dose and a schedule for every medication.');
    const dose = parsePositive(schedule.doseText, 'dose');
    const frequencyValue = schedule.frequencyKind === 'daily' ? null : schedule.shotDay;

    if (selectionId === CUSTOM_MEDICATION_ID) {
      const name = draft.customMedicationName.trim();
      if (!name) throw new Error('Enter a name for your custom medication.');
      return {
        selectionId,
        medication: {
          name,
          presetId: null,
          defaultDose: dose,
          defaultUnit: schedule.unit,
          defaultRoute: schedule.route,
          frequencyKind: schedule.frequencyKind,
          frequencyValue,
          halfLifeHours: null,
          tmaxHours: null,
        },
      };
    }

    const preset = getPreset(selectionId);
    if (!preset) throw new Error('Poke no longer has that medication preset.');
    return {
      selectionId,
      medication: {
        name: preset.name,
        presetId: preset.id,
        defaultDose: dose,
        defaultUnit: schedule.unit,
        defaultRoute: schedule.route,
        frequencyKind: schedule.frequencyKind,
        frequencyValue,
        // Null for a peptide with no published half-life. The level card says
        // so rather than drawing a curve nobody can cite.
        halfLifeHours: preset.halfLifeHours,
        tmaxHours: preset.tmaxHours,
      },
    };
  });
}

export async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
  const seeds = medicationSeeds(draft);
  if (!draft.goalKind) throw new Error('Choose your goal.');
  if (draft.concerns.length === 0) throw new Error('Choose what you want to watch.');

  const reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminder.time)
    ? draft.reminder.time
    : '09:00';
  const now = Date.now();
  const existingMedications = await listMedications(true);

  for (const seed of seeds) {
    const existing = existingMedications.find((medication) => {
      if (seed.selectionId === CUSTOM_MEDICATION_ID) {
        return medication.preset_id === null
          && medication.name.trim().toLocaleLowerCase() === seed.medication.name.trim().toLocaleLowerCase();
      }
      return medication.preset_id === seed.selectionId;
    });
    if (existing) {
      await updateMedicationDefaults(existing.id, seed.medication);
      if (existing.status !== 'active') await setMedicationStatus(existing.id, 'active');
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
        notes: 'Added during setup',
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
