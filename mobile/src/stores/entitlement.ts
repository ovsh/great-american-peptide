import { create } from 'zustand';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

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

export type EntitlementStatus = 'unknown' | 'free' | 'pro';
export type DevOverride = 'free' | 'pro' | null;

interface EntitlementState {
  availability: PurchasesAvailability | null;
  status: EntitlementStatus;
  offering: PurchasesOffering | null;
  offeringState: 'idle' | 'loading' | 'loaded' | 'error';
  purchasing: boolean;
  restoring: boolean;
  error: string | null;
  devOverride: DevOverride;

  bootstrap: () => Promise<void>;
  loadOffering: () => Promise<void>;
  buy: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<'restored' | 'none' | 'error'>;
  setDevOverride: (value: DevOverride) => void;
  clearError: () => void;
}

let bootstrapped = false;
let unsubscribe: (() => void) | null = null;

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
  offering: null,
  offeringState: 'idle',
  purchasing: false,
  restoring: false,
  error: null,
  devOverride: initialDevOverride(),

  bootstrap: async () => {
    if (bootstrapped) return;
    bootstrapped = true;

    const availability = await initPurchases();
    set({ availability });
    if (availability.kind !== 'ready') {
      set({ status: 'unknown' });
      return;
    }

    const info = await fetchCustomerInfo().catch(() => null);
    set({ status: isPro(info) ? 'pro' : 'free' });

    unsubscribe?.();
    unsubscribe = await addCustomerInfoListener((next: CustomerInfo) => {
      set({ status: isPro(next) ? 'pro' : 'free' });
    });
  },

  loadOffering: async () => {
    if (get().offeringState === 'loading') return;
    set({ offeringState: 'loading' });
    try {
      const offering = await fetchOffering();
      set({ offering, offeringState: offering ? 'loaded' : 'error' });
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
      const pro = isPro(info);
      set({ status: pro ? 'pro' : 'free', restoring: false });
      if (pro) return 'restored';
      set({ error: 'Poke found no active subscription for this Apple Account.' });
      return 'none';
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'The restore did not complete.';
      set({ restoring: false, error: message });
      return 'error';
    }
  },

  setDevOverride: (value) => set({ devOverride: value }),
  clearError: () => set({ error: null }),
}));

/**
 * True when Poke can actually sell a subscription. Until the RevenueCat key and
 * the App Store products exist this is false, and every paid feature stays open:
 * locking a door we cannot sell a key for only breaks the app.
 */
export function usePaywallEnabled(): boolean {
  return useEntitlementStore((state) => {
    if (__DEV__ && state.devOverride !== null) return true;
    return state.availability?.kind === 'ready';
  });
}

export function useIsPro(): boolean {
  return useEntitlementStore((state) => {
    if (__DEV__ && state.devOverride !== null) return state.devOverride === 'pro';
    if (state.availability?.kind !== 'ready') return true;
    return state.status === 'pro';
  });
}

/** Non-hook form for imperative paths (routing decisions inside callbacks). */
export function isProNow(): boolean {
  const state = useEntitlementStore.getState();
  if (__DEV__ && state.devOverride !== null) return state.devOverride === 'pro';
  if (state.availability?.kind !== 'ready') return true;
  return state.status === 'pro';
}

export function paywallEnabledNow(): boolean {
  const state = useEntitlementStore.getState();
  if (__DEV__ && state.devOverride !== null) return true;
  return state.availability?.kind === 'ready';
}
