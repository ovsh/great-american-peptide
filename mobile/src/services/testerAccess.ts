import { decodeTesterCode } from '../domain/testerCode';
import { getTesterId, getTesterProAt, setTesterGrant } from '../repositories/preferences';

/**
 * Poke Pro for an invited tester, granted by a code instead of a payment.
 *
 * A code carries a tester id and nothing else, so Poke checks it on the device
 * with no server and no list of codes in the binary. `src/domain/testerCode.ts`
 * holds the math and `docs/tester-codes.md` is the spec. The owner mints codes
 * with `node scripts/tester-codes.mjs <id>`.
 *
 * READ THIS BEFORE YOU TRUST IT. The constants that mint a code ship inside the
 * app. Anyone can unpack the IPA, read them, and mint every code from 1 to
 * 50000. Poke has no server, so there is nothing to check a code against and
 * nothing that can revoke a leaked code on other devices. This is a convenience
 * for people Poke already invited, and it is not a lock.
 *
 * That is also why there is no attempt counter and no rate limit here. Each
 * would make the check look protected while an attacker reads the constants and
 * skips it. Fake security is worse than none, because it invites someone to put
 * real value behind it.
 *
 * The rules that follow from that:
 *   - Never gate anything behind this that Poke could not give away for free.
 *   - Keep `app/redeem.tsx` off the paywall. It is a tester path, not a discount.
 *   - Retiring a round of codes means changing the constants and shipping a
 *     build, which retires every code at once.
 */

/** The stored grant, read back from the preferences row on every launch. */
export function loadTesterPro(): Promise<number | null> {
  return getTesterProAt();
}

/** The stored tester id, which is null on a device holding no grant. */
export function loadTesterId(): Promise<number | null> {
  return getTesterId();
}

export type RedeemOutcome = 'granted' | 'rejected';

/**
 * Writes the grant only when the code carries a tester id. A code that does not
 * leaves the row exactly as it was.
 */
export async function grantTesterPro(
  entered: string,
): Promise<{ outcome: RedeemOutcome; at: number | null; id: number | null }> {
  const id = decodeTesterCode(entered);
  if (id === null) return { outcome: 'rejected', at: null, id: null };
  const at = Date.now();
  await setTesterGrant(at, id);
  return { outcome: 'granted', at, id };
}

/**
 * Clears the grant. This touches nothing the App Store knows about, so a real
 * subscriber keeps Poke Pro through the subscription after this runs.
 */
export async function revokeTesterPro(): Promise<void> {
  await setTesterGrant(null, null);
}
