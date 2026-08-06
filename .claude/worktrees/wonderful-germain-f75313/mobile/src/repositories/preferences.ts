import { getDb } from '../db/client';
import type { PreferencesRow } from '../db/types';

export async function getPreferences(): Promise<PreferencesRow> {
  const db = await getDb();
  const row = await db.getFirstAsync<PreferencesRow>(`SELECT * FROM preferences WHERE id = 1`);
  if (!row) throw new Error('preferences row missing — schema migration failed');
  return row;
}

export async function updatePreferences(patch: Partial<Omit<PreferencesRow, 'id' | 'updated_at'>>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    args.push(v as string | number | null);
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
