import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';

import { getPreferences, updatePreferences } from '@/repositories/preferences';

// Tuneable gates. Conservative defaults that follow Apple/Google guidance:
// prompt only after the user has gotten value, with long cooldowns to respect the
// per-year quotas (iOS hard-caps at 3/365d; Android has its own opaque quota).
const MIN_EVENTS = 3;
const MIN_DAYS_SINCE_FIRST_EVENT = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 60;
const POST_EVENT_DELAY_MS = 1500;

const DAY_MS = 24 * 60 * 60 * 1000;

const appVersion = (): string => {
  const v = (Constants.expoConfig as any)?.version ?? Constants.nativeAppVersion ?? 'unknown';
  return String(v);
};

export async function recordPositiveEvent(): Promise<void> {
  const prefs = await getPreferences();
  const now = Date.now();
  await updatePreferences({
    review_event_count: prefs.review_event_count + 1,
    review_first_event_at: prefs.review_first_event_at ?? now,
  });
}

export interface PromptOptions {
  // If true, skip the cooldown / event-count gates (used for the explicit
  // "Rate the app" tap in Profile). Platform quotas still apply.
  manual?: boolean;
}

export async function maybePromptForReview(opts: PromptOptions = {}): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      if (opts.manual) await openStoreFallback();
      return false;
    }
  } catch {
    return false;
  }

  if (!opts.manual) {
    const eligible = await isEligible();
    if (!eligible) return false;
    await new Promise((r) => setTimeout(r, POST_EVENT_DELAY_MS));
  }

  try {
    await StoreReview.requestReview();
    await updatePreferences({
      review_last_prompted_at: Date.now(),
      review_prompted_version: appVersion(),
    });
    return true;
  } catch {
    if (opts.manual) await openStoreFallback();
    return false;
  }
}

async function isEligible(): Promise<boolean> {
  const prefs = await getPreferences();

  if (!prefs.onboarding_completed_at) return false;
  if (prefs.review_event_count < MIN_EVENTS) return false;

  const firstAt = prefs.review_first_event_at;
  if (!firstAt) return false;
  if (Date.now() - firstAt < MIN_DAYS_SINCE_FIRST_EVENT * DAY_MS) return false;

  const lastPrompt = prefs.review_last_prompted_at;
  if (lastPrompt) {
    if (Date.now() - lastPrompt < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS) return false;
    if (prefs.review_prompted_version === appVersion()) return false;
  }

  return true;
}

async function openStoreFallback(): Promise<void> {
  try {
    const url = await StoreReview.storeUrl();
    if (url) await Linking.openURL(url);
  } catch {
    /* noop */
  }
}
