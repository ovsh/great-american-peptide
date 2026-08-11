import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';

import { getPreferences, updatePreferences } from '@/repositories/preferences';

import {
  appendStamp,
  appendTrigger,
  canPrompt,
  type ReviewTrigger,
} from './reviewGate';

// Apple's rules shape every gate here:
//  - HIG: never ask on first launch or during onboarding. Ask after a completed task,
//    at a natural stopping point.
//  - StoreKit: the system shows the sheet at most 3 times per 365 days, can show
//    nothing at all, and never tells us which happened.
//  - Guideline 5.6.1: custom review prompts are disallowed. No question before the
//    sheet, and no routing of unhappy users somewhere else.
//
// The policy itself lives in `reviewGate.ts`, which is pure and has a test.

export type { ReviewTrigger } from './reviewGate';

/** Lets the screen settle before the sheet covers it. */
const POST_EVENT_DELAY_MS = 1500;

const appVersion = (): string => {
  const v = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';
  return String(v);
};

/** Counts a logged shot. The count is a floor for every trigger, not a trigger itself. */
export async function recordPositiveEvent(): Promise<void> {
  const prefs = await getPreferences();
  await updatePreferences({
    review_event_count: prefs.review_event_count + 1,
    review_first_event_at: prefs.review_first_event_at ?? Date.now(),
  });
}

/**
 * Asks StoreKit for the rating sheet, if this moment has earned it.
 * Returns whether we asked — never whether the user saw anything, because no API
 * reports that.
 */
export async function maybePromptForReview(trigger: ReviewTrigger): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
  } catch {
    return false;
  }

  const prefs = await getPreferences();
  const state = {
    onboardingCompletedAt: prefs.onboarding_completed_at,
    shotCount: prefs.review_event_count,
    promptLog: prefs.review_prompt_log,
    triggersUsed: prefs.review_triggers_used,
  };
  if (!canPrompt(state, trigger, Date.now())) return false;

  await new Promise((resolve) => setTimeout(resolve, POST_EVENT_DELAY_MS));

  try {
    await StoreReview.requestReview();
  } catch {
    return false;
  }

  // We record the attempt, not a sighting. Spending an attempt on a silent no-op is
  // the safe error: a user who turned off all rating prompts sees nothing either way.
  const now = Date.now();
  await updatePreferences({
    review_prompt_log: appendStamp(state.promptLog, now),
    review_triggers_used: appendTrigger(state.triggersUsed, trigger),
    review_last_prompted_at: now,
    review_prompted_version: appVersion(),
  });
  return true;
}

/**
 * The manual row in Profile. StoreKit says not to call requestReview from a button,
 * because it can show nothing and leave a dead tap. This link is Apple's own answer,
 * and it is also the way back for anyone the system skipped in silence.
 */
export async function openWriteReview(): Promise<void> {
  const base = Constants.expoConfig?.ios?.appStoreUrl;
  if (!base) return;
  const url = `${base}${base.includes('?') ? '&' : '?'}action=write-review`;
  try {
    await Linking.openURL(url);
  } catch {
    /* noop */
  }
}
