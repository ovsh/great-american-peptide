import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

// RevenueCat identifiers. These must match the dashboard exactly:
//   entitlement -> the thing we check for at runtime
//   offering    -> the set of packages the paywall renders
//   products    -> the App Store Connect subscription product ids
export const ENTITLEMENT_ID = 'pro';
export const OFFERING_ID = 'default';

export const PRODUCT_IDS = {
  monthly: 'poke_pro_monthly',
  annual: 'poke_pro_annual',
} as const;

export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * Why this can be unavailable: the SDK is a native module (so it cannot run on
 * web), and it needs a public API key that only exists once the RevenueCat
 * project is created. Until both hold we must not lock anything — see
 * `useIsPro` in the entitlement store.
 */
export type PurchasesAvailability =
  | { kind: 'ready' }
  | { kind: 'unavailable'; reason: 'web' | 'missing_key' | 'init_failed'; detail?: string };

type PurchasesModule = typeof import('react-native-purchases');

let modulePromise: Promise<PurchasesModule | null> | null = null;
let configuredPromise: Promise<PurchasesAvailability> | null = null;

export function revenueCatApiKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.revenueCatIosKey;
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) return fromExtra.trim();

  return null;
}

// The native module is loaded lazily so that `import`ing this file stays safe on
// web, where `react-native-purchases` has no implementation to bind to.
async function loadModule(): Promise<PurchasesModule | null> {
  if (Platform.OS === 'web') return null;
  if (!modulePromise) {
    modulePromise = Promise.resolve()
      .then(() => require('react-native-purchases') as PurchasesModule)
      .catch(() => null);
  }
  return modulePromise;
}

export function initPurchases(): Promise<PurchasesAvailability> {
  if (!configuredPromise) {
    configuredPromise = configure().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      return { kind: 'unavailable', reason: 'init_failed', detail } as const;
    });
  }
  return configuredPromise;
}

async function configure(): Promise<PurchasesAvailability> {
  if (Platform.OS === 'web') return { kind: 'unavailable', reason: 'web' };

  const apiKey = revenueCatApiKey();
  if (!apiKey) return { kind: 'unavailable', reason: 'missing_key' };

  const rc = await loadModule();
  if (!rc) return { kind: 'unavailable', reason: 'init_failed', detail: 'Native module missing.' };

  rc.default.setLogLevel(__DEV__ ? rc.LOG_LEVEL.WARN : rc.LOG_LEVEL.ERROR);
  // No `appUserID`: RevenueCat mints an anonymous id per install. Poke has no
  // accounts yet, so an anonymous id is the only identity we can honestly claim.
  // When Sign in with Apple lands, call `logIn` with the stable user id here.
  await rc.default.configure({ apiKey });
  return { kind: 'ready' };
}

export function isPro(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  const availability = await initPurchases();
  if (availability.kind !== 'ready') return null;
  const rc = await loadModule();
  if (!rc) return null;
  return rc.default.getCustomerInfo();
}

export async function fetchOffering(): Promise<PurchasesOffering | null> {
  const availability = await initPurchases();
  if (availability.kind !== 'ready') return null;
  const rc = await loadModule();
  if (!rc) return null;

  const offerings = await rc.default.getOfferings();
  return offerings.all[OFFERING_ID] ?? offerings.current ?? null;
}

export type PurchaseOutcome =
  | { kind: 'purchased'; info: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const rc = await loadModule();
  if (!rc) return { kind: 'failed', message: 'Purchases are not available on this device.' };

  try {
    const { customerInfo } = await rc.default.purchasePackage(pkg);
    return { kind: 'purchased', info: customerInfo };
  } catch (caught: unknown) {
    if (isUserCancelled(caught)) return { kind: 'cancelled' };
    return { kind: 'failed', message: purchaseErrorMessage(caught) };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const availability = await initPurchases();
  if (availability.kind !== 'ready') return null;
  const rc = await loadModule();
  if (!rc) return null;
  return rc.default.restorePurchases();
}

export async function addCustomerInfoListener(
  listener: (info: CustomerInfo) => void,
): Promise<() => void> {
  const availability = await initPurchases();
  if (availability.kind !== 'ready') return () => {};
  const rc = await loadModule();
  if (!rc) return () => {};

  rc.default.addCustomerInfoUpdateListener(listener);
  return () => {
    rc.default.removeCustomerInfoUpdateListener(listener);
  };
}

export async function openManageSubscriptions(): Promise<void> {
  await Linking.openURL(MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
}

function isUserCancelled(caught: unknown): boolean {
  if (typeof caught !== 'object' || caught === null) return false;
  const record = caught as Record<string, unknown>;
  return record.userCancelled === true;
}

function purchaseErrorMessage(caught: unknown): string {
  if (typeof caught === 'object' && caught !== null) {
    const record = caught as Record<string, unknown>;
    const message = record.underlyingErrorMessage ?? record.message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return 'The purchase did not complete. Try again.';
}
