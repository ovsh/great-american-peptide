import { PostHog } from 'posthog-react-native';

import { getTesterId } from '../repositories/preferences';

/**
 * Product analytics. This file is the only place that may import PostHog.
 *
 * The one rule: no health data ever leaves the phone through an event. No
 * medication name, no dose, no unit, no weight, no side effect, no body site,
 * no note text, and nothing computed from any of them. An event carries a name
 * and coarse flags, so the schema below is a closed union. A property that
 * could name what a person takes, or how much, does not belong here.
 *
 * There is no account and no login, so Poke never calls `identify`. Every event
 * rides an anonymous device id that PostHog generates on the phone.
 *
 * Without `EXPO_PUBLIC_POSTHOG_KEY` the whole module is a no-op. No client is
 * built, nothing is queued, nothing is logged, and the app behaves as if
 * analytics were not installed.
 */

const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Every event Poke can send, with the properties it carries. `undefined` means
 * the event takes no properties. TypeScript rejects an unknown event name and
 * an unknown property, so a typo cannot ship.
 */
export interface AnalyticsEvents {
  /** One per onboarding screen. `step` is the route name, never a user value. */
  onboarding_step_viewed: { step: string };
  /**
   * Where a new user says they found Poke. A channel id off the closed list
   * below and nothing else, so nothing a person typed can reach the event. It
   * is the one thing the App Store's own numbers cannot say, and it says
   * nothing about anybody's treatment. `FOUND_OPTIONS` in
   * `src/stores/onboarding.ts` draws its rows from these ids.
   */
  onboarding_channel_picked: {
    channel:
      | 'app_store'
      | 'tiktok'
      | 'instagram'
      | 'youtube'
      | 'reddit'
      | 'creator'
      | 'friend'
      | 'other';
  };
  /** Setup finished and the app opened. */
  onboarding_completed: undefined;
  /** Apple Health import turned on, from setup or from the profile tab. */
  health_connect_enabled: { source: 'onboarding' | 'profile' };
  /** The answer to the system notification prompt. */
  notification_permission_result: { granted: boolean };
  /** A reminder switch moved. `kind` names the switch, never a schedule. */
  reminder_toggled: { kind: string; on: boolean };
  /** A medication was added. The kind is coarse. The name is never sent. */
  medication_added: {
    kind: 'preset' | 'brand' | 'custom' | 'blend';
    source: 'onboarding' | 'app';
  };
  /** A shot was saved. `edited` marks a change to an existing shot. */
  shot_logged: { edited: boolean };
  /** A shot was removed. */
  shot_deleted: undefined;
  /** A side effect entry was saved. `clear` marks a day reported as clear. */
  side_effect_logged: { clear: boolean };
  /** A weight was recorded, by hand or from Apple Health. */
  weight_logged: { source: 'manual' | 'health' };
  /** The paywall opened. `source` names the screen that opened it. */
  paywall_viewed: { source: string };
  /** The App Store confirmed a purchase. */
  purchase_completed: { plan: 'yearly' | 'monthly' };
  /** The App Store returned an earlier purchase. */
  purchase_restored: undefined;
  /** A CSV export reached the share sheet. */
  export_csv: undefined;
  /** A tester code unlocked Poke Pro. */
  tester_code_redeemed: { tester_id: number };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

let client: PostHog | null = null;
let initialized = false;

function readKey(): string {
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

/**
 * Builds the client once. Call this from the root layout. Without a key this
 * returns at once and leaves every other function in this file inert.
 */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const key = readKey();
  if (key === '') return;

  try {
    client = new PostHog(key, {
      host: POSTHOG_HOST,
      // App Opened and App Backgrounded, which is what retention is counted
      // from. Autocapture needs <PostHogProvider>, which Poke does not mount,
      // so no tap or screen is recorded on its own.
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
    });
  } catch {
    client = null;
    return;
  }

  // A tester keeps the same id across sessions, so read it back on launch. The
  // database may not be open yet, and that is not worth a retry.
  getTesterId()
    .then((id) => {
      if (id !== null) setTesterId(id);
    })
    .catch(() => {});
}

/**
 * Sends one event. The rest parameter makes the properties required for an
 * event that declares them, and forbidden for an event that does not.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...props: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]
): void {
  if (!client) return;
  try {
    // Every property in the schema above is a string, a number or a boolean,
    // which is what PostHog takes. The cast carries that fact across the rest
    // parameter, which TypeScript widens.
    client.capture(event, props[0] as Record<string, string | number | boolean> | undefined);
  } catch {
    // Analytics never breaks a user action.
  }
}

/**
 * Marks this device as a tester, or clears the mark. The id rides every later
 * event as a super property, so the owner can tell one invited tester from
 * another. It is an invite number, not a person and not a health record.
 */
export function setTesterId(id: number | null): void {
  if (!client) return;
  try {
    if (id === null) {
      client.unregister('tester_id').catch(() => {});
    } else {
      client.register({ tester_id: id }).catch(() => {});
    }
  } catch {
    // Same rule as above.
  }
}
