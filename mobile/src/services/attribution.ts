import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, Platform } from 'react-native';

import {
  createAttributionCoordinator,
  type TrackingDecision,
} from './attributionCoordinator';
import { syncRevenueCatMetaAttribution } from './purchases';

/**
 * The one outbound advertising boundary.
 *
 * No medication, dose, weight, side effect, site, note, schedule or HealthKit
 * value enters this file. Meta starts only after iOS has answered ATT. A denial
 * keeps advertiser identifiers off and never joins a RevenueCat customer to a
 * Meta identifier. RevenueCat still owns StoreKit entitlements independently.
 */

const coordinator = createAttributionCoordinator({
  resolveTrackingDecision,
  initializeMeta,
  getFacebookAnonymousId,
  syncRevenueCat: syncRevenueCatMetaAttribution,
});

/** Starts after first paint. Repeated calls share or retry the same safe work. */
export function startAttribution(): Promise<void> {
  if (!supportsNativeAttribution()) return Promise.resolve();
  return coordinator.start();
}

/**
 * Finishes the current ATT decision and, after a grant, RevenueCat's Meta
 * identifier sync before StoreKit opens. The coordinator absorbs SDK errors,
 * so a failed advertising service still cannot reject the purchase.
 */
export async function prepareAttributionForPurchase(): Promise<void> {
  if (!supportsNativeAttribution()) return;
  await coordinator.prepareForPurchase();
}

function supportsNativeAttribution(): boolean {
  return (
    Platform.OS === 'ios' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

async function resolveTrackingDecision(): Promise<TrackingDecision> {
  if (!supportsNativeAttribution()) return 'unsupported';
  if (AppState.currentState !== 'active') return 'undetermined';

  let att: typeof import('expo-tracking-transparency');
  try {
    // Expo Go does not include this native module. Keep the store client inert.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    att = require('expo-tracking-transparency');
  } catch {
    return 'unsupported';
  }

  const current = await att.getTrackingPermissionsAsync();
  const response = current.status === 'undetermined'
    ? await att.requestTrackingPermissionsAsync()
    : current;

  if (response.status === 'granted') return 'granted';
  if (response.status === 'undetermined') return 'undetermined';
  return response.canAskAgain ? 'denied' : 'restricted';
}

async function initializeMeta(trackingEnabled: boolean): Promise<void> {
  const fbsdk = loadMetaSdk();
  if (!fbsdk) throw new Error('Meta SDK is unavailable.');

  await fbsdk.Settings.setAdvertiserTrackingEnabled(trackingEnabled);
  fbsdk.Settings.setAdvertiserIDCollectionEnabled(trackingEnabled);
  fbsdk.Settings.initializeSDK();
}

async function getFacebookAnonymousId(): Promise<string | null> {
  const fbsdk = loadMetaSdk();
  if (!fbsdk) return null;
  return fbsdk.AppEventsLogger.getAnonymousID();
}

function loadMetaSdk(): typeof import('react-native-fbsdk-next') | null {
  try {
    // Lazy loading keeps web and Expo Go from binding an unavailable module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-fbsdk-next');
  } catch {
    return null;
  }
}
