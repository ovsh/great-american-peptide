import { getDb } from '../db/client';
import type { PreferencesRow } from '../db/types';

export type PreferencesPatch = Partial<Omit<PreferencesRow, 'id' | 'updated_at'>>;

const PREFERENCE_COLUMNS = [
  'weight_unit',
  'height_unit',
  'reminder_time',
  'notifications_enabled',
  'disclaimer_accepted_at',
  'onboarding_completed_at',
  'start_weight',
  'start_weight_at',
  'goal_weight',
  'height',
  'review_event_count',
  'review_first_event_at',
  'review_last_prompted_at',
  'review_prompted_version',
  'review_prompt_log',
  'review_triggers_used',
  'goal_kind',
  'display_name',
  'side_effect_concerns',
  // Schema version 7. A column missing from this list is written nowhere and
  // fails silently, because the loop below skips what it cannot see.
  'journey_stage',
  'sex',
  'birth_year',
  'activity_level',
  'motivation',
  'weekly_pace',
  'last_shot_at',
  // Schema version 8.
  'tester_pro_at',
  // Schema version 10.
  'focused_medication_id',
] as const satisfies readonly (keyof PreferencesPatch)[];

export async function getPreferences(): Promise<PreferencesRow> {
  const db = await getDb();
  const row = await db.getFirstAsync<PreferencesRow>(`SELECT * FROM preferences WHERE id = 1`);
  if (!row) throw new Error('preferences row missing — schema migration failed');
  return row;
}

export async function updatePreferences(patch: PreferencesPatch): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const column of PREFERENCE_COLUMNS) {
    const value = patch[column];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    args.push(value);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(Date.now());
  await db.runAsync(`UPDATE preferences SET ${sets.join(', ')} WHERE id = 1`, args);
}

export async function updateGoalWeight(goalWeight: number | null): Promise<void> {
  await updatePreferences({ goal_weight: goalWeight });
}

export async function markOnboardingComplete(): Promise<void> {
  await updatePreferences({ onboarding_completed_at: Date.now(), disclaimer_accepted_at: Date.now() });
}

/** When a tester code unlocked Poke Pro on this device, or null. */
export async function getTesterProAt(): Promise<number | null> {
  const row = await getPreferences();
  return row.tester_pro_at;
}

/** Pass a timestamp to grant tester access and null to take it back. */
export async function setTesterProAt(at: number | null): Promise<void> {
  await updatePreferences({ tester_pro_at: at });
}

/**
 * The medication Today opens on. Written when the user taps a row, and when a
 * logged shot hands Today the medication it was written for.
 */
export async function setFocusedMedicationId(id: string | null): Promise<void> {
  await updatePreferences({ focused_medication_id: id });
}
