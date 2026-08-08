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

  // Every question the flow asks lands somewhere. A question whose answer goes
  // nowhere is a question Poke should not be asking. The medication and schedule
  // answers went to the medications table above. The other thirteen land here.
  const preferences: PreferencesPatch = {
    goal_kind: draft.goalKind,
    side_effect_concerns: JSON.stringify(draft.concerns),
    reminder_time: reminderTime,
    notifications_enabled: draft.reminder.kind === 'enabled' ? 1 : 0,
    onboarding_completed_at: now,
    // The disclaimer sits above the button that calls this function, and the
    // button label is the acceptance. Write the timestamp here or that sentence
    // is untrue, and `store.config.json` review notes make the same promise to
    // App Review. This is the only writer: `markOnboardingComplete` is not called.
    disclaimer_accepted_at: now,
    journey_stage: draft.journeyStage,
    sex: draft.sex,
    birth_year: parseOptionalInt(draft.birthYearText),
    activity_level: draft.activityLevel,
    motivation: draft.motivation,
    weight_unit: draft.weight.unit,
    height_unit: draft.height.unit,
    last_shot_at: lastShotAt(draft.lastShot, now),
  };

  // Current weight, goal weight and height each have their own screen and each
  // can be skipped on its own, so each is parsed on its own. An unreadable or
  // skipped field leaves its column alone rather than writing a zero.
  const currentWeight = parseOptionalPositive(draft.weight.currentText);
  const goalWeight = parseOptionalPositive(draft.weight.goalText);
  const height = parseOptionalPositive(draft.height.valueText);

  if (currentWeight !== null) {
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
    preferences.start_weight = currentWeight;
    preferences.start_weight_at = now;
  }
  if (goalWeight !== null) preferences.goal_weight = goalWeight;
  if (height !== null) preferences.height = height;
  // The pace only means something next to a goal. On its own it is a slider
  // position, so it is stored only when there is something to apply it to.
  if (currentWeight !== null && goalWeight !== null) preferences.weekly_pace = draft.pace;

  await updatePreferences(preferences);
  await refreshScheduledReminders().catch(() => {});
}

function parseOptionalPositive(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The date of the prior dose, when the answer gives one.
 *
 * "Today" and "yesterday" are exact days. "Earlier this week" and "longer ago"
 * are not, and a curve started from a guessed date is a guessed curve, so those
 * answers are held in the flow and written as null here.
 */
function lastShotAt(choice: OnboardingDraft['lastShot'], now: number): number | null {
  if (choice === 'today') return now;
  if (choice === 'yesterday') return now - 24 * 60 * 60 * 1000;
  return null;
}
