// The plan shown on the last onboarding screen.
//
// Every number here is arithmetic on what the user typed, plus a published
// half-life. A level curve is a restatement of a half-life. A shot date is
// calendar arithmetic. A goal date is a division.
//
// The projection is the one number that leaves the ground, so it is the one
// number this module is strict about. It is division and nothing else: the
// distance the user typed, over the weekly pace the user chose. It is not a
// forecast, no model stands behind it, and the screen that draws it says so in
// those words. If that sentence ever comes off the screen, take this out.
//
// This module holds the math so the screen only draws it.

import { isSameDay } from 'date-fns';

import { bodySites } from '../domain/bodySites';
import { getPreset, hasPublishedHalfLife, type Route, type Unit } from '../domain/peptides';
import { levelTrajectory, type DoseEvent } from '../domain/pk';
import { medicationScheduleFromStored, nextScheduledDoses } from '../domain/scheduling';
import { recommendNextSite } from '../domain/rotation';
import { bmi, bmiCategory } from '../domain/units';
import { startOfDay } from '../utils/date';
import {
  CUSTOM_MEDICATION_ID,
  SHOT_DAY_OPTIONS,
  medicationDisplayName,
  type MedicationScheduleDraft,
  type OnboardingDraft,
  type WeightDraft,
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

export interface PlanProjection {
  current: number;
  goal: number;
  unit: 'lb' | 'kg';
  /** Weight change per week, as the user set it. Always positive. */
  pace: number;
  weeks: number;
  /** The date the division lands on. Arithmetic, not a forecast. */
  reachesAt: number;
  direction: 'down' | 'up';
}

export interface PlanBody {
  value: number;
  category: string;
}

export interface OnboardingPlan {
  medications: PlanMedication[];
  nextShot: { name: string; at: number } | null;
  sites: string[];
  curveCount: number;
  projection: PlanProjection | null;
  body: PlanBody | null;
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
    projection: planProjection(draft.weight, draft.pace, now),
    body: body(draft),
  };
}

// The longest run the division is allowed to produce. Past this the answer is
// arithmetically correct and useless, and a date in 2041 reads as a promise
// rather than as a sum. A pace that slow gets no card.
const MAX_PROJECTION_WEEKS = 260;

/**
 * Distance over pace. That is the whole calculation.
 *
 * It needs both weights and a pace above zero, and it refuses to run when the
 * pace points away from the goal, because a slider set to lose weight against a
 * goal above the current weight is a contradiction and not a longer timeline.
 *
 * It takes the weights and the pace rather than the whole draft because the plan
 * screen calls it again on every drag of its own pace slider, against a `now`
 * fixed at mount. Everything else on that screen is frozen, so passing the two
 * inputs that move keeps the recompute honest and the dependency list short.
 */
export function planProjection(
  weight: WeightDraft,
  weeklyPace: number,
  now: number,
): PlanProjection | null {
  const { current, goal } = weight;
  const pace = Math.abs(weeklyPace);
  if (current === null || goal === null) return null;
  if (current <= 0 || goal <= 0 || current === goal) return null;
  if (!Number.isFinite(pace) || pace <= 0) return null;

  const weeks = Math.abs(current - goal) / pace;
  if (weeks > MAX_PROJECTION_WEEKS) return null;

  return {
    current,
    goal,
    unit: weight.unit,
    pace,
    weeks,
    reachesAt: now + weeks * WEEK_MS,
    direction: goal < current ? 'down' : 'up',
  };
}

// BMI from the two numbers the user chose, through the same `domain/units`
// function the rest of the app uses. No height, no BMI, and no card.
function body(draft: OnboardingDraft): PlanBody | null {
  const weight = draft.weight.current;
  const height = draft.height.value;
  if (weight === null || height === null) return null;
  if (weight <= 0 || height <= 0) return null;

  const value = bmi(weight, draft.weight.unit, height, draft.height.unit);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, category: bmiCategory(value) };
}

function planMedication(
  id: string,
  schedule: MedicationScheduleDraft,
  draft: OnboardingDraft,
  now: number,
): PlanMedication {
  const preset = id === CUSTOM_MEDICATION_ID ? undefined : getPreset(id);
  const dose = Number.parseFloat(schedule.doseText);
  // The last-shot answer is worth asking only if it changes something. It does:
  // a dose already in the body puts the curve above zero at week one instead of
  // starting it from a flat line the user knows is wrong. Only the two answers
  // that name an exact day are used. See `lastShotAt` in `services/onboarding`.
  const prior = priorDose(draft.lastShot, now, dose);
  // A shot taken today is today's shot, and the calendar still names today, so
  // one of the two has to go or the plan counts one dose twice: the curve opens
  // on a peak nobody dosed for, and the card offers a shot the user has just
  // said they took. The answer beats the calendar, because the answer happened.
  const scheduled = upcomingDoses(id, schedule, draft.reminder.time, now, dose);
  const doses = prior
    ? scheduled.filter((event) => !isSameDay(event.takenAt, prior.takenAt))
    : scheduled;
  const curveDoses = prior ? [prior, ...doses] : doses;
  // What the next four weeks hold, counting a shot already taken today and not
  // one taken yesterday. Both are in the curve. Only one is in the window.
  const windowStart = startOfDay(now);

  return {
    id,
    name: medicationDisplayName(id, draft.customMedicationName),
    doseLabel: `${schedule.doseText.trim()} ${schedule.unit}`,
    scheduleLabel: scheduleLabel(schedule),
    nextShotAt: doses[0]?.takenAt ?? null,
    shotsInFourWeeks: curveDoses.filter((event) => event.takenAt >= windowStart).length,
    curve: preset && hasPublishedHalfLife(preset) && curveDoses.length > 0
      ? buildCurve(curveDoses, preset.halfLifeHours, preset.tmaxHours, schedule.unit, now)
      : null,
    evidenceNote: preset
      ? preset.source
      : 'Poke has no half-life for a custom medication. Poke draws no level curve.',
  };
}

function priorDose(
  choice: OnboardingDraft['lastShot'],
  now: number,
  dose: number,
): DoseEvent | null {
  if (!Number.isFinite(dose) || dose <= 0) return null;
  if (choice === 'today') return { takenAt: now, dose };
  if (choice === 'yesterday') return { takenAt: now - DAY_MS, dose };
  return null;
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
