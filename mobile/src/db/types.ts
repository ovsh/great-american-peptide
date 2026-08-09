import type { FrequencyKind, Route, Unit } from '../domain/peptides';

export interface MedicationRow {
  id: string;
  name: string;
  preset_id: string | null;
  default_dose: number;
  default_unit: Unit;
  default_route: Route;
  frequency_kind: FrequencyKind;
  frequency_value: number | null;
  half_life_hours: number | null;
  tmax_hours: number | null;
  color_index: number;
  status: 'active' | 'paused' | 'archived';
  created_at: number;
  updated_at: number;
}

export interface InjectionRow {
  id: string;
  medication_id: string;
  dose: number;
  unit: Unit;
  route: Route;
  site_id: string | null;
  taken_at: number;
  scheduled_at: number | null;
  notes: string | null;
  deleted_at: number | null;
  created_at: number;
}

export type MeasurementKind = 'weight' | 'bmi' | 'height';

export type GoalKind = 'weight_loss' | 'recovery' | 'longevity' | 'performance' | 'other';

export interface MeasurementRow {
  id: string;
  kind: MeasurementKind;
  value: number;
  unit: string | null;
  taken_at: number;
  source: 'manual' | 'healthkit';
  source_id: string | null;
  notes: string | null;
  deleted_at: number | null;
  created_at: number;
}

export interface SideEffectLogRow {
  id: string;
  effect: string;
  severity: number;
  taken_at: number;
  notes: string | null;
  deleted_at: number | null;
  created_at: number;
}

export interface PreferencesRow {
  id: 1;
  weight_unit: 'lb' | 'kg';
  height_unit: 'in' | 'cm';
  reminder_time: string;
  notifications_enabled: 0 | 1;
  disclaimer_accepted_at: number | null;
  onboarding_completed_at: number | null;
  start_weight: number | null;
  start_weight_at: number | null;
  goal_weight: number | null;
  height: number | null;
  review_event_count: number;
  review_first_event_at: number | null;
  review_last_prompted_at: number | null;
  review_prompted_version: string | null;
  /** Comma-separated ms timestamps of our prompt attempts, pruned to the last 365 days. */
  review_prompt_log: string | null;
  /** Comma-separated ReviewTrigger names already used. Each trigger asks once, ever. */
  review_triggers_used: string | null;
  goal_kind: GoalKind | null;
  display_name: string | null;
  side_effect_concerns: string | null;
  /** Onboarding answers. Every question the flow asks has a column here. */
  journey_stage: JourneyStage | null;
  sex: Sex | null;
  birth_year: number | null;
  activity_level: ActivityLevel | null;
  motivation: string | null;
  /** Weight change per week the user chose on the pace screen, in `weight_unit`. */
  weekly_pace: number | null;
  last_shot_at: number | null;
  /** When a tester code unlocked Poke Pro on this device. Null when no code is active. */
  tester_pro_at: number | null;
  updated_at: number;
}

export type JourneyStage = 'taking' | 'starting';
export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'low' | 'light' | 'active' | 'very_active';
