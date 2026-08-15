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
  /**
   * Where the user dragged this medication in the Today list. Null only for a
   * row written by a build older than schema version 10; readers sort those
   * last and fall back to `created_at`.
   */
  sort_order: number | null;
  /**
   * The cycle, which is a plan the user typed and nothing Poke worked out.
   *
   * `cycle_days_on` null means this medication has no cycle at all, and every
   * cycle readout is then off. `cycle_days_off` null on a medication that does
   * have a cycle means the user chose no break reminder. `cycle_started_at` is
   * the day week 1 counts from, backdatable and rewritten on every resume, and
   * `scheduling.ts` uses it as the schedule anchor in place of `created_at`.
   *
   * `paused_at` is written on every pause, cycle or not.
   */
  cycle_days_on: number | null;
  cycle_days_off: number | null;
  cycle_started_at: number | null;
  paused_at: number | null;
  /**
   * The vial label of a blend, as JSON `{presetId, mg}` lines the user typed.
   * Null means no composition entered and the blend draws no curve. Read it
   * with `parseComposition` in `domain/blends.ts`, never with a bare
   * `JSON.parse`.
   */
  composition: string | null;
  /**
   * The dose each scheduled weekday carries, as JSON keyed by the getDay
   * weekday. Null means the one default dose covers every day. Read it with
   * `parseDoseByDay` in `domain/doseByDay.ts`, never with a bare JSON.parse.
   */
  dose_by_day: string | null;
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
  /**
   * The tester id the redeemed code carried, from `domain/testerCode.ts`. Null
   * when no code is active, and null on a device that redeemed a code before
   * this column existed. `tester_pro_at` is the grant; this is only who holds it.
   */
  tester_id: number | null;
  /**
   * The medication Today opens its hero card on. Null until the user taps a
   * row, and stale ids are ignored rather than repaired.
   */
  focused_medication_id: string | null;
  /**
   * The three notification loops. `notifications_enabled` above is both the
   * shot-day switch and the master switch, so these two only ever narrow it.
   * `notif_checkin_delay_hours` holds 24, 36 or 48; readers normalise anything
   * else back to 36 rather than trusting the column.
   */
  notif_checkin_enabled: 0 | 1;
  notif_checkin_delay_hours: number;
  notif_missed_enabled: 0 | 1;
  /**
   * The cycle loop: the last planned day, and the day a break ends. Two banners
   * per cycle and no repeat, so this switch turns off a total of two.
   */
  notif_cycle_enabled: 0 | 1;
  /**
   * Apple Health weight sync. `health_sync_enabled` is Poke's own switch and
   * not the iOS permission: HealthKit never tells an app whether a read was
   * granted, so this column records what the user asked Poke to do and nothing
   * about what iOS allows. `health_synced_at` is the last read that finished.
   */
  health_sync_enabled: 0 | 1;
  health_synced_at: number | null;
  updated_at: number;
}

export type JourneyStage = 'taking' | 'starting';
export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'low' | 'light' | 'active' | 'very_active';
