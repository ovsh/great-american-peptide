import { create } from 'zustand';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { setTesterId, track } from '../services/analytics';
import {
  addCustomerInfoListener,
  fetchCustomerInfo,
  fetchOffering,
  initPurchases,
  isPro,
  purchasePackage,
  restorePurchases,
  type PurchaseOutcome,
  type PurchasesAvailability,
} from '../services/purchases';
import {
  grantTesterPro,
  loadTesterId,
  loadTesterPro,
  revokeTesterPro,
  type RedeemOutcome,
} from '../services/testerAccess';

/**
 * What the App Store said about this device.
 *
 * `unreachable` is the case that earns its keep. Poke asked and got no answer,
 * which is not the same as an answer of `free`. Keeping the two apart is what
 * lets Poke ask again instead of settling, and it is why a late `pro` can still
 * arrive and win. It is not a grant: see `accessFromState`.
 */
export type EntitlementStatus = 'unknown' | 'free' | 'pro' | 'unreachable';

/**
 * The answer every paid feature reads. `pending` means Poke has not decided
 * yet, so nothing should render either the feature or the lock.
 */
export type ProAccess = 'pro' | 'free' | 'pending';

export type OfferingState = 'idle' | 'loading' | 'loaded' | 'error';
export type DevOverride = 'free' | 'pro' | null;

interface EntitlementState {
  availability: PurchasesAvailability | null;
  status: EntitlementStatus;
  /**
   * True once Poke has stopped waiting for the App Store, whether or not the
   * store answered. Until then every reader gets `pending` instead of a guess.
   */
  decided: boolean;
  offering: PurchasesOffering | null;
  offeringState: OfferingState;
  purchasing: boolean;
  restoring: boolean;
  error: string | null;
  devOverride: DevOverride;
  /**
   * When a tester code unlocked Pro on this device, or null. Read from the
   * preferences row at launch, so the grant survives a restart.
   */
  testerProAt: number | null;
  /**
   * The tester id the redeemed code carried, for the tester screen to show. It
   * is never read as the grant: a device that redeemed a code before the column
   * existed holds a grant and no id.
   */
  testerId: number | null;

  bootstrap: () => Promise<void>;
  /** Asks the store who this user is, and records whether it answered at all. */
  refreshStatus: () => Promise<void>;
  loadOffering: () => Promise<void>;
  buy: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<'restored' | 'none' | 'error'>;
  redeemTesterCode: (code: string) => Promise<RedeemOutcome>;
  revokeTesterCode: () => Promise<void>;
  setDevOverride: (value: DevOverride) => void;
  clearError: () => void;
}

let bootstrapped = false;
let unsubscribe: (() => void) | null = null;

/**
 * How long Poke waits for the App Store before it stops waiting. `app/_layout`
 * holds the first paint until Poke decides, so this cap is what keeps a silent
 * store from holding the app on the splash screen.
 *
 * Missing the cap does not unlock anything. A store that is configured and can
 * sell owes an answer, and until it gives one the user sees the free view with
 * the paywall in reach. A late answer still wins when it arrives, and
 * `retryUntilAnswered` keeps asking for it.
 */
const STORE_ANSWER_TIMEOUT_MS = 3000;

/**
 * When Poke asks a ready store again after it missed the cap, in ms after the
 * one before. Short enough that a subscriber on a slow train gets their
 * features back inside a minute, few enough that a store that is down is asked
 * three times and then left alone until the next paywall or launch.
 */
const STORE_RETRY_DELAYS_MS = [2000, 5000, 15000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** True when the App Store itself said which side of the paywall this user is on. */
function storeAnswered(status: EntitlementStatus): boolean {
  return status === 'pro' || status === 'free';
}

/**
 * Asks a ready store again until it answers, or until the attempts run out.
 *
 * This is what keeps the timeout honest. Poke stops waiting after three
 * seconds so the app opens, and a subscriber whose network was slow at that
 * moment is briefly on the free side. Each answer that arrives here puts them
 * back, without a tap.
 */
async function retryUntilAnswered(get: () => EntitlementState): Promise<void> {
  for (const delay of STORE_RETRY_DELAYS_MS) {
    await sleep(delay);
    // A listener answer, a restore, or a purchase may have landed meanwhile.
    if (get().availability?.kind !== 'ready') return;
    if (storeAnswered(get().status)) return;
    await get().refreshStatus();
  }
}

/**
 * Debug builds can start in a forced entitlement, so the locked and unlocked
 * states are both reachable before any store account exists:
 * `EXPO_PUBLIC_DEV_ENTITLEMENT=free npx expo start`
 */
function initialDevOverride(): DevOverride {
  if (!__DEV__) return null;
  const value = process.env.EXPO_PUBLIC_DEV_ENTITLEMENT;
  return value === 'free' || value === 'pro' ? value : null;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  availability: null,
  status: 'unknown',
  decided: false,
  offering: null,
  offeringState: 'idle',
  purchasing: false,
  restoring: false,
  error: null,
  devOverride: initialDevOverride(),
  testerProAt: null,
  testerId: null,

  bootstrap: async () => {
    if (bootstrapped) return;
    bootstrapped = true;

    // First, because a tester must reach Pro even when the store answers late or
    // never answers at all.
    const testerProAt = await loadTesterPro().catch(() => null);
    const testerId = await loadTesterId().catch(() => null);
    set({ testerProAt, testerId });

    const ask = async () => {
      const availability = await initPurchases();
      set({ availability });
      if (availability.kind !== 'ready') return;

      // The listener goes on before the first read, so an answer that arrives
      // after a failed read still lands.
      unsubscribe?.();
      unsubscribe = await addCustomerInfoListener((next: CustomerInfo) => {
        set({ status: isPro(next) ? 'pro' : 'free' });
      });

      await get().refreshStatus();
    };

    await Promise.race([ask().catch(() => {}), sleep(STORE_ANSWER_TIMEOUT_MS)]);
    set({ decided: true });

    // The first paint no longer waits, but the question is still open. A ready
    // store that missed the cap gets asked again, because the user is on the
    // free side until it answers.
    if (get().availability?.kind === 'ready' && !storeAnswered(get().status)) {
      void retryUntilAnswered(get);
    }
  },

  refreshStatus: async () => {
    try {
      const info = await fetchCustomerInfo();
      // A null read means the store was never asked, so it says nothing about
      // this user. It is recorded as its own case, so Poke knows to ask again.
      set({ status: info === null ? 'unreachable' : isPro(info) ? 'pro' : 'free' });
    } catch {
      set({ status: 'unreachable' });
    }
  },

  loadOffering: async () => {
    if (get().offeringState === 'loading') return;
    set({ offeringState: 'loading' });
    try {
      const offering = await fetchOffering();
      set({ offering, offeringState: offering ? 'loaded' : 'error' });
      // A loaded offering proves the store answers again, so an entitlement Poke
      // could not read at launch is worth reading now.
      if (offering && !storeAnswered(get().status)) await get().refreshStatus();
    } catch {
      set({ offering: null, offeringState: 'error' });
    }
  },

  buy: async (pkg) => {
    set({ purchasing: true, error: null });
    const outcome = await purchasePackage(pkg);
    if (outcome.kind === 'purchased') {
      set({ status: isPro(outcome.info) ? 'pro' : 'free', purchasing: false });
    } else {
      set({
        purchasing: false,
        error: outcome.kind === 'failed' ? outcome.message : null,
      });
    }
    return outcome;
  },

  restore: async () => {
    set({ restoring: true, error: null });
    try {
      const info = await restorePurchases();
      if (info === null) {
        // Poke could not ask, which is not an answer of "no subscription". Say
        // so, and leave the recorded status alone.
        set({ restoring: false, error: 'Poke could not reach the App Store.' });
        return 'error';
      }
      const pro = isPro(info);
      set({ status: pro ? 'pro' : 'free', restoring: false });
      if (pro) {
        // Here rather than on the paywall, because the profile tab restores
        // through this same door.
        track('purchase_restored');
        return 'restored';
      }
      set({ error: 'Poke found no active subscription for this Apple Account.' });
      return 'none';
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'The restore did not complete.';
      set({ restoring: false, error: message });
      return 'error';
    }
  },

  redeemTesterCode: async (code) => {
    const { outcome, at, id } = await grantTesterPro(code);
    if (outcome === 'granted' && id !== null) {
      set({ testerProAt: at, testerId: id });
      setTesterId(id);
      track('tester_code_redeemed', { tester_id: id });
    }
    return outcome;
  },

  // Clears the tester grant and nothing else. `status` still holds whatever the
  // App Store said, so a real subscriber stays Pro through this.
  revokeTesterCode: async () => {
    await revokeTesterPro();
    set({ testerProAt: null, testerId: null });
    setTesterId(null);
  },

  setDevOverride: (value) => set({ devOverride: value }),
  clearError: () => set({ error: null }),
}));

/**
 * The one place that answers "may this user open a paid feature". Six callers
 * read it, so the order of the cases lives here once.
 *
 * The order matters. A debug override wins, so a developer can force the free
 * view over a tester grant. A tester grant wins over the store, so an invited
 * tester sees Pro without paying. Before Poke decides, the answer is `pending`
 * rather than a guess, because a guess renders as a lock or as a feature and
 * both flicker into the opposite a moment later.
 *
 * After that, only one case unlocks by itself: a store Poke cannot sell
 * through. Locking a door Poke cannot sell a key for only breaks the app, and
 * `paywallFromState` reads the same field, so the lock and the way past it
 * appear and disappear together.
 *
 * A store that can sell but has not answered yet is a different case, and it
 * ends in `free`. It is a three second timeout, not a broken store, so
 * unlocking on it hands Pro to every user on a slow network and hides the
 * paywall from App Review. The user sees the free view with the paywall in
 * reach, `retryUntilAnswered` keeps asking, and a real subscriber flips back on
 * the first answer.
 */
function accessFromState(state: EntitlementState): ProAccess {
  if (__DEV__ && state.devOverride !== null) return state.devOverride === 'pro' ? 'pro' : 'free';
  if (state.testerProAt !== null) return 'pro';
  if (!state.decided) return 'pending';
  // `null` means `initPurchases` itself never came back. That call reads a key
  // and configures the SDK on the device, with no network in it, so this is the
  // same "cannot sell" case as an explicit `unavailable`, and the paywall is
  // hidden here too.
  if (state.availability === null || state.availability.kind !== 'ready') return 'pro';
  return state.status === 'pro' ? 'pro' : 'free';
}

/**
 * A tester grant is deliberately absent here. This answers "can Poke sell a
 * subscription", and a free code does not make Poke able to sell anything.
 */
function paywallFromState(state: EntitlementState): boolean {
  if (__DEV__ && state.devOverride !== null) return true;
  return state.availability?.kind === 'ready';
}

/**
 * True when Poke can actually sell a subscription. Until the RevenueCat key and
 * the App Store products exist this is false, and every paid feature stays open:
 * locking a door we cannot sell a key for only breaks the app.
 */
export function usePaywallEnabled(): boolean {
  return useEntitlementStore(paywallFromState);
}

/**
 * True once Poke has an answer to act on. `app/_layout.tsx` holds the first
 * paint on this, so no screen renders a lock or a paid chart over a question
 * Poke has not asked yet.
 */
export function useEntitlementSettled(): boolean {
  return useEntitlementStore((state) => accessFromState(state) !== 'pending');
}

/**
 * The boolean the paid screens read. `pending` counts as unlocked so a lock
 * never flashes over a question Poke has not asked yet, and the first paint
 * waits for the answer, so a rendered screen never sees this value while it is
 * still pending.
 */
export function useIsPro(): boolean {
  return useEntitlementStore((state) => accessFromState(state) !== 'free');
}

/** Non-hook form for imperative paths (routing decisions inside callbacks). */
export function isProNow(): boolean {
  return accessFromState(useEntitlementStore.getState()) !== 'free';
}

export function paywallEnabledNow(): boolean {
  return paywallFromState(useEntitlementStore.getState());
}

/** When a tester code unlocked Pro on this device, or null when no code is active. */
export function useTesterProAt(): number | null {
  return useEntitlementStore((state) => state.testerProAt);
}

/** The tester id on this device, or null when the grant carries no id. */
export function useTesterId(): number | null {
  return useEntitlementStore((state) => state.testerId);
}
