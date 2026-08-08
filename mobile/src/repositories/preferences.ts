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
