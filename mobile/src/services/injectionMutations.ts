// Every write to the injections table, with the invalidation attached.
//
// `refreshScheduledReminders` rebuilds the whole notification queue, and all
// three of its planners read this table: the shot-day loop skips a day that
// already carries a shot, the catch-up loop names a scheduled day with nothing
// on it, and the check-in loop counts forward from each logged shot. So a shot
// that appears, moves or disappears changes what is queued.
//
// Delete used to run straight from the History sheet with no refresh, which left
// a deleted shot's check-in banner queued and never gave the day back its
// shot-day reminder. Both verbs come through here now, so neither can forget.
// This file is `medicationMutations.ts` for shots, and it is where a third verb
// goes when one arrives.

import type { InjectionRow } from '../db/types';
import {
  createInjection,
  softDeleteInjection,
  updateInjection,
  type NewInjection,
  type UpdateInjection,
} from '../repositories/injections';
import { track } from './analytics';
import { refreshScheduledReminders } from './notifications';

export async function createInjectionAndRefresh(input: NewInjection): Promise<InjectionRow> {
  const injection = await createInjection(input);
  await refreshScheduledReminders().catch(() => {});
  // A count of shots, with no medication, no dose and no site attached.
  track('shot_logged', { edited: false });
  return injection;
}

export async function updateInjectionAndRefresh(
  id: string,
  patch: UpdateInjection,
): Promise<InjectionRow> {
  const injection = await updateInjection(id, patch);
  await refreshScheduledReminders().catch(() => {});
  track('shot_logged', { edited: true });
  return injection;
}

export async function deleteInjectionAndRefresh(id: string): Promise<void> {
  await softDeleteInjection(id);
  await refreshScheduledReminders().catch(() => {});
  track('shot_deleted');
}
