import Constants from 'expo-constants';

import { getTesterProAt, setTesterProAt } from '../repositories/preferences';

/**
 * Poke Pro for an invited tester, granted by a code instead of a payment.
 *
 * READ THIS BEFORE YOU TRUST IT. A code that ships inside the app is a public
 * string. Anyone can unpack the IPA and run `strings` on the binary, and every
 * code below falls out of it. Poke has no server, so there is nothing to check a
 * code against and nothing that can revoke a leaked code on other devices. This
 * is a convenience for people Poke already invited, and it is not a lock.
 *
 * That is also why there is no hashing, no obfuscation, no attempt counter and
 * no rate limit here. Each of those would make the code look protected while an
 * attacker reads the compiled string and skips the whole check. Fake security is
 * worse than none, because it invites someone to put real value behind it.
 *
 * The rules that follow from that:
 *   - Rotate `EXPO_PUBLIC_TESTER_CODES` for every tester round.
 *   - Never gate anything behind this that Poke could not give away for free.
 *   - Keep `app/redeem.tsx` off the paywall. It is a tester path, not a discount.
 */

/**
 * The compiled-in fallback, used when no environment value is set. Same shape as
 * `revenueCatApiKey()`: the environment wins, so a code changes without a code
 * change. Set `EXPO_PUBLIC_TESTER_CODES` in `mobile/.env.local` for a local run
 * and as an EAS secret for a store build. Several codes go in one comma
 * separated string.
 */
const DEFAULT_TESTER_CODES = ['POKE-TESTER-2026'];

/** Case and punctuation are noise on a phone keyboard, so Poke drops both. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseCodes(raw: string): string[] {
  return raw.split(',').map(normalizeCode).filter((code) => code.length > 0);
}

export function testerCodes(): string[] {
  const fromEnv = process.env.EXPO_PUBLIC_TESTER_CODES;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return parseCodes(fromEnv);

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.testerCodes;
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) return parseCodes(fromExtra);

  return DEFAULT_TESTER_CODES.map(normalizeCode);
}

export function codeIsKnown(entered: string): boolean {
  const candidate = normalizeCode(entered);
  if (candidate.length === 0) return false;
  return testerCodes().includes(candidate);
}

/** The stored grant, read back from the preferences row on every launch. */
export function loadTesterPro(): Promise<number | null> {
  return getTesterProAt();
}

export type RedeemOutcome = 'granted' | 'rejected';

/**
 * Writes the grant only when the code matches. A wrong code leaves the row
 * exactly as it was.
 */
export async function grantTesterPro(entered: string): Promise<{ outcome: RedeemOutcome; at: number | null }> {
  if (!codeIsKnown(entered)) return { outcome: 'rejected', at: null };
  const at = Date.now();
  await setTesterProAt(at);
  return { outcome: 'granted', at };
}

/**
 * Clears the grant. This touches nothing the App Store knows about, so a real
 * subscriber keeps Poke Pro through the subscription after this runs.
 */
export async function revokeTesterPro(): Promise<void> {
  await setTesterProAt(null);
}
