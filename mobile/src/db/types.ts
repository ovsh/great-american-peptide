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
  updated_at: number;
}
