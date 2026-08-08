// The plan shown on the last onboarding screen.
//
// Every number here is arithmetic on what the user typed, plus a published
// half-life. Nothing is a prediction about a body: no goal date, no pace, no
// outcome. A level curve is a restatement of a half-life. A shot date is
// calendar arithmetic. That is the whole payoff, and it is enough.
//
// This module holds the math so the screen only draws it.

import { bodySites } from '../domain/bodySites';
import { getPreset, hasPublishedHalfLife, type Route, type Unit } from '../domain/peptides';
import { levelTrajectory, type DoseEvent } from '../domain/pk';
import { medicationScheduleFromStored, nextScheduledDoses } from '../domain/scheduling';
import { recommendNextSite } from '../domain/rotation';
import {
  CUSTOM_MEDICATION_ID,
  SHOT_DAY_OPTIONS,
  medicationDisplayName,
  type MedicationScheduleDraft,
  type OnboardingDraft,
} from '../stores/onboarding';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const HORIZON_WEEKS = 4;
const HORIZON_MS = HORIZON_WEEKS * WEEK_MS;
// Sampling. A fixed step count aliases a short half-life: at one sample every
// six hours, a two-hour peak lands wherever the grid happens to fall, and the
// drawn peaks are then an artefact of the grid and not of the drug. So sample
// at least four times per half-life, inside these bounds.
const MIN_CURVE_STEPS = 112;
const MAX_CURVE_STEPS = 1344;
const SAMPLES_PER_HALF_LIFE = 4;
// A week counts as settled when its peak is within 5% of the fourth-week peak.
const STEADY_THRESHOLD = 0.95;
// Below this share of the peak, the level between two doses is back near zero.
const CLEARS_THRESHOLD = 0.1;
const ROTATION_PREVIEW = 4;

export interface PlanCurve {
  points: { t: number; v: number }[];
  unit: Unit;
  // 1 to 4, or null when the level is still climbing at the end of week 4.
  steadyWeek: number | null;
  // True when each dose is nearly gone before the next one arrives, so the
  // level repeats instead of building up. "Steady" would misdescribe it.
  clearsBetweenDoses: boolean;
}

export interface PlanMedication {
  id: string;
  name: string;
  doseLabel: string;
  scheduleLabel: string;
  nextShotAt: number | null;
  shotsInFourWeeks: number;
  curve: PlanCurve | null;
  // Where the half-life comes from, or why there is no curve.
  evidenceNote: string;
}

export interface OnboardingPlan {
  medications: PlanMedication[];
  nextShot: { name: string; at: number } | null;
  sites: string[];
  curveCount: number;
}

export function buildOnboardingPlan(draft: OnboardingDraft, now: number): OnboardingPlan {
  const medications: PlanMedication[] = [];

  for (const id of draft.medicationIds) {
    const schedule = draft.schedules[id];
    if (!schedule) continue;
    medications.push(planMedication(id, schedule, draft, now));
  }

  const nextShot = medications
    .filter((medication) => medication.nextShotAt !== null)
    .sort((a, b) => (a.nextShotAt ?? 0) - (b.nextShotAt ?? 0))
    .map((medication) => ({ name: medication.name, at: medication.nextShotAt as number }))[0] ?? null;

  const firstSchedule = draft.medicationIds
    .map((id) => draft.schedules[id])
    .find((schedule): schedule is MedicationScheduleDraft => Boolean(schedule));

  return {
    medications,
    nextShot,
    sites: rotationPreview(firstSchedule?.route ?? 'sc', now),
    curveCount: medications.filter((medication) => medication.curve !== null).length,
  };
}

function planMedication(
  id: string,
  schedule: MedicationScheduleDraft,
  draft: OnboardingDraft,
  now: number,
): PlanMedication {
  const preset = id === CUSTOM_MEDICATION_ID ? undefined : getPreset(id);
  const dose = Number.parseFloat(schedule.doseText);
  const doses = upcomingDoses(id, schedule, draft.reminder.time, now, dose);

  return {
    id,
    name: medicationDisplayName(id, draft.customMedicationName),
    doseLabel: `${schedule.doseText.trim()} ${schedule.unit}`,
    scheduleLabel: scheduleLabel(schedule),
    nextShotAt: doses[0]?.takenAt ?? null,
    shotsInFourWeeks: doses.length,
    curve: preset && hasPublishedHalfLife(preset) && doses.length > 0
      ? buildCurve(doses, preset.halfLifeHours, preset.tmaxHours, schedule.unit, now)
      : null,
    evidenceNote: preset
      ? preset.source
      : 'Poke has no half-life for a custom medication. Poke draws no level curve.',
  };
}

// The doses Poke will expect over the next four weeks, from the same scheduling
// code that drives the reminders. If the two ever disagree, this is a bug.
function upcomingDoses(
  id: string,
  schedule: MedicationScheduleDraft,
  reminderTime: string,
  now: number,
  dose: number,
): DoseEvent[] {
  if (!Number.isFinite(dose) || dose <= 0) return [];
  const medicationSchedule = medicationScheduleFromStored({
    medicationId: id,
    frequencyKind: schedule.frequencyKind,
    frequencyValue: schedule.frequencyKind === 'daily' ? null : schedule.shotDay,
    createdAt: now,
    reminderTime,
  });
  if (!medicationSchedule) return [];

  const horizonEnd = now + HORIZON_MS;
  return nextScheduledDoses(medicationSchedule, now, HORIZON_WEEKS * 7)
    .filter((scheduled) => scheduled.scheduledAt <= horizonEnd)
    .map((scheduled) => ({ takenAt: scheduled.scheduledAt, dose }));
}

function buildCurve(
  doses: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number | null,
  unit: Unit,
  now: number,
): PlanCurve {
  const to = now + HORIZON_MS;
  const steps = Math.round(Math.min(
    MAX_CURVE_STEPS,
    Math.max(MIN_CURVE_STEPS, (HORIZON_WEEKS * 7 * 24) / (halfLifeHours / SAMPLES_PER_HALF_LIFE)),
  ));
  const trajectory = levelTrajectory(doses, halfLifeHours, tmaxHours ?? 0, now, to, steps);
  const points = trajectory.map((point) => ({ t: point.t, v: point.level }));

  const weekPeaks: number[] = [];
  for (let week = 0; week < HORIZON_WEEKS; week++) {
    const from = now + week * WEEK_MS;
    const until = from + WEEK_MS;
    const inWeek = points.filter((point) => point.t >= from && point.t <= until);
    weekPeaks.push(inWeek.reduce((peak, point) => Math.max(peak, point.v), 0));
  }

  const finalPeak = weekPeaks[HORIZON_WEEKS - 1] ?? 0;
  let steadyWeek: number | null = null;
  if (finalPeak > 0) {
    for (let week = 0; week < HORIZON_WEEKS - 1; week++) {
      if ((weekPeaks[week] ?? 0) >= finalPeak * STEADY_THRESHOLD) {
        steadyWeek = week + 1;
        break;
      }
    }
  }

  // Measure the trough over the last week only, so the flat run before the
  // first dose cannot be mistaken for a trough between two doses.
  const lastWeek = points.filter((point) => point.t >= now + (HORIZON_WEEKS - 1) * WEEK_MS);
  const trough = lastWeek.reduce((low, point) => Math.min(low, point.v), Number.POSITIVE_INFINITY);
  const clearsBetweenDoses = finalPeak > 0
    && Number.isFinite(trough)
    && trough < finalPeak * CLEARS_THRESHOLD;

  return { points, unit, steadyWeek, clearsBetweenDoses };
}

function scheduleLabel(schedule: MedicationScheduleDraft): string {
  if (schedule.frequencyKind === 'daily') return 'Every day';
  const day = SHOT_DAY_OPTIONS.find((option) => option.value === schedule.shotDay)?.label ?? 'shot day';
  return schedule.frequencyKind === 'twice_weekly'
    ? `Twice a week, from ${day}`
    : `Every week on ${day}`;
}

// The first four sites the rotation will offer, in the order it will offer
// them. Each pick is fed back as history, exactly as a logged shot would be.
function rotationPreview(route: Route, now: number): string[] {
  const history: { siteId: string; takenAt: number }[] = [];
  const labels: string[] = [];
  const available = bodySites.filter((site) => site.routes.includes(route)).length;
  const wanted = Math.min(ROTATION_PREVIEW, available);

  for (let index = 0; index < wanted; index++) {
    const site = recommendNextSite(history, route);
    if (!site) break;
    labels.push(site.label);
    history.push({ siteId: site.id, takenAt: now + index });
  }
  return labels;
}
