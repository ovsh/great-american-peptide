import type { MeasurementRow, MedicationRow } from '../db/types';
import type { PreferencesPatch } from '../repositories/preferences';
import type { NewMedication } from '../repositories/medications';
import {
  isCustomMedicationId,
  parseDiluentMl,
  scheduleFrequencyValue,
  scheduleHasDose,
  scheduleHasFrequency,
  scheduleVialMg,
  type OnboardingDraft,
  type OnboardingMedicationId,
} from '../stores/onboarding';
import { compositionDraft, serializeComposition } from '../domain/blends';
import { blendParts, getPresetEntry, isBlend, type PeptidePreset } from '../domain/peptides';
import { kgToLb, lbToKg, type WeightUnit } from '../domain/units';
import { createInjection, listInjections } from '../repositories/injections';
import { createMeasurement, latestMeasurement } from '../repositories/measurements';
import {
  createMedication,
  FREE_MEDICATION_LIMIT,
  listMedications,
  nextColorIndex,
  setMedicationStatus,
  updateMedicationDefaults,
} from '../repositories/medications';
import { updatePreferences } from '../repositories/preferences';
import { isProNow } from '../stores/entitlement';
import { endOfDay, startOfDay } from '../utils/date';
import { refreshScheduledReminders } from './notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

interface MedicationSeed {
  selectionId: OnboardingMedicationId;
  medication: Omit<NewMedication, 'colorIndex'>;
  /**
   * Whether the user gave a dose for this medication.
   *
   * False when they pressed the hatch on the dose screen. `default_dose` is
   * `NOT NULL`, so a deferred dose is stored as zero, and a zero on a running
   * medication would read as "0 mg" on the Today card, which is fake data. So a
   * medication with no dose is saved archived instead: the row keeps everything
   * the user did give, no card draws it, no reminder fires for it, and
   * `medications/index.tsx` says in words that the dose is not set yet.
   */
  hasDose: boolean;
}

/**
 * One medication, as far as the user filled it in.
 *
 * A deferred answer is stored as absence and never as a number Poke chose. A
 * deferred dose is a zero on an archived row, a deferred frequency is the
 * `custom` kind with a null value, which `medicationScheduleFromStored` already
 * reads as no schedule, and a deferred vial is two null columns.
 */
function medicationSeeds(draft: OnboardingDraft): MedicationSeed[] {
  // The one thing setup still refuses to finish without. Everything else on
  // these screens can wait; a medication list with nothing in it cannot,
  // because the app that follows is entirely about medications.
  if (draft.medicationIds.length === 0) throw new Error('Choose at least one medication.');

  // Every selected medication has its own setup run, so every one of them must
  // have its own draft here. Nothing is filled in behind the user.
  return draft.medicationIds.map((selectionId) => {
    const schedule = draft.schedules[selectionId];
    if (!schedule) throw new Error('Add a dose and a schedule for every medication.');
    const hasDose = scheduleHasDose(schedule);
    const dose = hasDose ? Number.parseFloat(schedule.doseText) : 0;
    // `custom` with no value is how the schema already spells "no schedule".
    // Every reader goes through `medicationScheduleFromStored`, which returns
    // null for it, so no shot is expected and no reminder is scheduled.
    const settled = scheduleHasFrequency(schedule);
    const frequencyKind = settled ? schedule.frequencyKind : 'custom';
    const frequencyValue = settled ? scheduleFrequencyValue(schedule) : null;
    // Undefined keeps what an earlier pass through setup wrote, which is the
    // keep-or-write contract `updateMedicationDefaults` documents. The vial
    // question is answered only when a form was picked: the hatch clears the
    // form with the size, because a pass is not an erase. A pen writes its
    // nulls, clearing a size that belongs to a vial the user no longer has.
    const vialAnswered = schedule.vialForm !== null;
    const vialMg = vialAnswered ? scheduleVialMg(schedule) : undefined;
    const vialForm = vialAnswered ? schedule.vialForm : undefined;
    // The mix beat runs for at most one medication and only when its numbers
    // allow the sum, so this is a number on that one row at most.
    // `diluentMlText` is empty until the user presses Save, and a skip leaves
    // it empty, so a skipped mix keeps an earlier saved one rather than wiping
    // it. A pen clears the mix with the size, because a pen arrives mixed.
    const diluentMl = vialForm === 'pen'
      ? null
      : (parseDiluentMl(schedule.diluentMlText) ?? undefined);

    if (isCustomMedicationId(selectionId)) {
      const name = (draft.customNames[selectionId] ?? '').trim();
      if (!name) throw new Error('Enter a name for your custom medication.');
      return {
        selectionId,
        hasDose,
        medication: {
          name,
          presetId: null,
          defaultDose: dose,
          defaultUnit: schedule.unit,
          defaultRoute: schedule.route,
          frequencyKind,
          frequencyValue,
          halfLifeHours: null,
          tmaxHours: null,
          vialMg,
          vialForm,
          diluentMl,
        },
      };
    }

    // A brand row and its molecule row point at the same preset. The row the
    // user picked names the medication, and the preset carries the science.
    const entry = getPresetEntry(selectionId);
    if (!entry) throw new Error('Poke no longer has that medication preset.');
    const preset = entry.preset;
    return {
      selectionId,
      hasDose,
      medication: {
        name: entry.name,
        presetId: preset.id,
        defaultDose: dose,
        defaultUnit: schedule.unit,
        defaultRoute: schedule.route,
        frequencyKind,
        frequencyValue,
        // Null for a peptide with no published half-life. The level card says
        // so rather than drawing a curve nobody can cite.
        halfLifeHours: preset.halfLifeHours,
        tmaxHours: preset.tmaxHours,
        composition: seedComposition(preset, schedule.compositionMg),
        vialMg,
        vialForm,
        diluentMl,
      },
    };
  });
}

/**
 * The vial label as the medication row stores it, or undefined when the user
 * skipped the boxes. A partial label also lands here as undefined: the schedule
 * screen holds Continue on partial, so one can only arrive another way, and
 * saving nothing is safe where saving a half-copied label is not.
 */
function seedComposition(
  preset: PeptidePreset,
  compositionMg: Record<string, string>,
): string | undefined {
  if (!isBlend(preset)) return undefined;
  const draft = compositionDraft(blendParts(preset).map((part) => part.id), compositionMg);
  return draft.kind === 'complete' ? serializeComposition(draft.components) : undefined;
}

/** The row this seed already has, when setup runs a second time. */
function findMedication(
  medications: readonly MedicationRow[],
  seed: MedicationSeed,
): MedicationRow | undefined {
  if (isCustomMedicationId(seed.selectionId)) {
    return medications.find((medication) => medication.preset_id === null
      && medication.name.trim().toLocaleLowerCase() === seed.medication.name.trim().toLocaleLowerCase());
  }
  // The preset alone no longer identifies a row: Wegovy and Semaglutide share
  // one preset and are two medications, so the name has to match as well.
  return medications.find((medication) => medication.preset_id === seed.medication.presetId
    && medication.name.trim().toLocaleLowerCase() === seed.medication.name.trim().toLocaleLowerCase());
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
  const matched = seeds.map((seed) => ({ seed, existing: findMedication(existingMedications, seed) }));

  /**
   * How many of the medications the user named Poke switches on.
   *
   * The free tier carries two medications and the App Store listing says so.
   * `medications/new.tsx` held that line and this door did not, so anyone who
   * named four medications during setup kept four of them for nothing.
   *
   * Poke saves every medication the user named. They answered honestly about
   * their own regimen and Poke throws none of it away. The ones past the limit
   * are saved archived: an archived medication keeps its name, its dose, its
   * schedule and its half-life, it draws no card, it sends no reminder, and
   * `countActiveMedications` does not count it, which is the same rule the
   * other door applies. Setup raises no medication-limit paywall. The one
   * offer the flow makes is the subscription screen `onboarding/plan.tsx`
   * replaces itself with on the way to Today, and closing it costs nothing.
   *
   * Medications the user already had and did not name here hold their own
   * places, so a second pass through setup cannot lift the limit.
   */
  const claimed = new Set(matched.flatMap(({ existing }) => (existing ? [existing.id] : [])));
  const outsideActive = existingMedications
    .filter((medication) => medication.status === 'active' && !claimed.has(medication.id))
    .length;
  const activeAllowance = isProNow()
    ? seeds.length
    : Math.max(0, FREE_MEDICATION_LIMIT - outsideActive);

  let activeCount = 0;
  const saved: { id: string; seed: MedicationSeed }[] = [];
  for (const { seed, existing } of matched) {
    // Two reasons to save a medication archived, and they are the same
    // mechanism. The first is the free limit above. The second is a dose the
    // user deferred: `default_dose` is `NOT NULL`, so the row carries a zero,
    // and a running medication with a zero dose would print "0 mg" on the Today
    // card. Archived, it prints nothing anywhere and the medication list says
    // the dose is not set yet. Finishing the dose in the editor is what turns
    // it back on. A medication with no dose also claims no free slot, because
    // it is not running.
    const withinAllowance = activeCount < activeAllowance;
    const status: MedicationRow['status'] = seed.hasDose && withinAllowance ? 'active' : 'archived';
    if (status === 'active') activeCount += 1;
    if (existing) {
      await updateMedicationDefaults(existing.id, seed.medication);
      if (existing.status !== status) await setMedicationStatus(existing.id, status);
      saved.push({ id: existing.id, seed });
      continue;
    }
    const colorIndex = await nextColorIndex();
    const created = await createMedication({ ...seed.medication, colorIndex });
    if (status !== 'active') await setMedicationStatus(created.id, status);
    saved.push({ id: created.id, seed });
  }

  await recordLastShot(draft, saved, now);

  // Every question the flow asks lands somewhere. A question whose answer goes
  // nowhere is a question Poke should not be asking. The medication and schedule
  // answers went to the medications table above. The rest land here.
  const preferences: PreferencesPatch = {
    // The first goal the user picked, and then every one of them. `goal_kind`
    // is what a reader written before the multiple pick still reads, and it is
    // still one id, so nothing downstream changed.
    goal_kind: draft.goalKind,
    goal_tags: draft.goalTags.length > 0 ? JSON.stringify(draft.goalTags) : null,
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
    // Null when the user skipped the question. `postScheduleOrder` runs a null
    // as `basics`, and the column keeps the null rather than the guess.
    //
    // The `activity_level` and `motivation` writes stood here. The flow stopped
    // asking for either one, so nothing writes them any more. The columns stay
    // in the table, holding the answers older builds saved.
    experience_level: draft.experienceLevel,
    weight_unit: draft.weight.unit,
    height_unit: draft.height.unit,
    last_shot_at: lastShotAt(draft.lastShot, now),
  };

  // Current weight, goal weight and height each have their own screen and each
  // can be skipped on its own, so each is tested on its own. A skipped field
  // leaves its column alone rather than writing a zero.
  const currentWeight = positive(draft.weight.current);
  const goalWeight = positive(draft.weight.goal);
  const height = positive(draft.height.value);

  if (currentWeight !== null) {
    const latest = await latestMeasurement('weight');
    const alreadyRecorded = latest !== null && sameWeight(latest, currentWeight, draft.weight.unit);
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

function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Whether a row already holds the weight the setup wheel is showing.
 *
 * The wheel can be showing a weigh-in Poke read from Apple Health on the weight
 * screen, and that row is always in kilograms whatever the wheel reads, so the
 * comparison converts before it compares. Both sides are then rounded to the one
 * decimal place the wheel offers: a user who moved the wheel after the import
 * moved it by at least that much and meant the new number, which is written as
 * their own row.
 */
function sameWeight(row: MeasurementRow, wheel: number, unit: WeightUnit): boolean {
  const rowUnit = row.unit === 'kg' || row.unit === 'lb' ? row.unit : unit;
  const inWheelUnit = rowUnit === unit ? row.value : unit === 'kg' ? lbToKg(row.value) : kgToLb(row.value);
  return Math.round(inWheelUnit * 10) === Math.round(wheel * 10);
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
  if (choice === 'yesterday') return now - DAY_MS;
  return null;
}

/**
 * The shot the user says they already took, written as a shot.
 *
 * Setup asked when the last shot was, drew a curve from the answer, and then
 * dropped it. So the app opened on "Log today's shot" for a user who had just
 * said they took it, the level card started from nothing, and the first real
 * shot they logged got no interval before it.
 *
 * Everything in the row is theirs: the dose, the unit and the route are what
 * they typed on the schedule screen. Nothing is invented. The site is left
 * empty, because they were not asked which one, and `lastSiteUseFor` skips a
 * row with no site, so the rotation is untouched. The note says where the row
 * came from, in the same words the setup weight uses.
 *
 * Only the two answers that name an exact day are written. A second pass
 * through setup on the same day finds the first pass's row and adds nothing.
 */
async function recordLastShot(
  draft: OnboardingDraft,
  saved: { id: string; seed: MedicationSeed }[],
  now: number,
): Promise<void> {
  const takenAt = lastShotAt(draft.lastShot, now);
  if (takenAt === null) return;

  for (const { id, seed } of saved) {
    const schedule = draft.schedules[seed.selectionId];
    if (!schedule) continue;
    const dose = positive(Number.parseFloat(schedule.doseText));
    if (dose === null) continue;
    const already = await listInjections({
      medicationId: id,
      fromMs: startOfDay(takenAt),
      toMs: endOfDay(takenAt),
      limit: 1,
    });
    if (already.length > 0) continue;
    await createInjection({
      medicationId: id,
      dose,
      unit: schedule.unit,
      route: schedule.route,
      siteId: null,
      takenAt,
      notes: 'Added during setup',
    });
  }
}
