import { Platform } from 'react-native';

import { importMeasurements } from '@/repositories/measurements';
import { getPreferences, updatePreferences } from '@/repositories/preferences';

import { newestRow, readWindowStart, toWeightRows } from './healthWeight';

/**
 * The one type Poke reads from Apple Health. Every extra type is another checkbox
 * on the permission sheet, and weight is the whole point: a smart scale writes
 * here, and the user should not type in a number their bathroom already knows.
 */
const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass';

/**
 * Kilograms, always, whatever the user reads. A stored row must not depend on the
 * unit preference in force the day it was written, and `rowWeightUnit` in
 * `log-weight.tsx` already reads `'kg'` back correctly.
 */
const HK_UNIT = 'kg';

/** What a read of Health did.
 *
 * `empty` also covers a refused permission, and this is not a gap Poke can close.
 * iOS never tells an app whether a read was granted: a denied type answers every
 * query with no samples, exactly as an empty Health store does. So Poke reports
 * what it can see, which is that no weight came back, and points at Settings.
 */
export type HealthImport =
  | { kind: 'unsupported' }
  | { kind: 'failed'; message: string }
  | { kind: 'empty' }
  | { kind: 'imported'; added: number; latestKg: number; latestAt: number };

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

let modulePromise: Promise<HealthKitModule | null> | null = null;

// The native module is loaded lazily so that `import`ing this file stays safe on
// web, where HealthKit has no implementation to bind to. This library binds at
// import time rather than on first call, so a plain top-level import would throw
// while the web bundle was still starting and take the whole app down with it.
async function loadModule(): Promise<HealthKitModule | null> {
  if (Platform.OS !== 'ios') return null;
  if (!modulePromise) {
    modulePromise = import('@kingstinct/react-native-healthkit').catch(() => null);
  }
  return modulePromise;
}

/**
 * Whether to offer the Health rows at all. This answers for the platform, not for
 * the device: an iPad runs iOS and has no Health store, so the row is offered
 * there and the read comes back `unsupported`. Deciding that here would mean
 * loading the native module before the first frame, and the rows would appear late.
 */
export function isHealthSupported(): boolean {
  return Platform.OS === 'ios';
}

/** Poke's own switch, and when the last read finished. */
export async function getHealthSync(): Promise<{ enabled: boolean; syncedAt: number | null }> {
  const prefs = await getPreferences();
  return { enabled: prefs.health_sync_enabled === 1, syncedAt: prefs.health_synced_at };
}

/**
 * Turns Poke's own switch off. It cannot take back the iOS permission, which only
 * the user can do in Settings, and it does not delete the weigh-ins Poke has
 * already read. It stops Poke from asking Health again.
 */
export async function stopHealthSync(): Promise<void> {
  await updatePreferences({ health_sync_enabled: 0 });
}

/**
 * Asks for the weight permission if it has not been asked for, reads the window
 * that `readWindowStart` chose, and writes what came back.
 *
 * The switch goes on only when weight actually arrived. A read that returns
 * nothing may be a refusal, and a Profile row reading "On" under a refused
 * permission would be a lie Poke told itself.
 */
export async function importHealthWeights(): Promise<HealthImport> {
  const healthKit = await loadModule();
  if (!healthKit) return { kind: 'unsupported' };

  try {
    if (!healthKit.isHealthDataAvailable()) return { kind: 'unsupported' };
    await healthKit.requestAuthorization({ toRead: [BODY_MASS] });

    const { syncedAt } = await getHealthSync();
    const now = Date.now();
    const from = readWindowStart(syncedAt, now);

    const samples = await healthKit.queryQuantitySamples(BODY_MASS, {
      unit: HK_UNIT,
      // -1 is this library's "every sample". The window keeps a routine read
      // small, and the first read is meant to bring the whole history in.
      limit: -1,
      filter: from === null ? undefined : { date: { startDate: new Date(from) } },
    });

    const rows = toWeightRows(samples);
    const newest = newestRow(rows);
    if (newest === null) return { kind: 'empty' };

    const added = await importMeasurements(rows);
    await updatePreferences({ health_sync_enabled: 1, health_synced_at: now });

    return { kind: 'imported', added, latestKg: newest.value, latestAt: newest.takenAt };
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The read Poke runs on its own, for a user who has already connected Health.
 * Returns null when there is nothing to do, so a caller can ignore it in one line.
 */
export async function syncHealthIfConnected(): Promise<HealthImport | null> {
  if (!isHealthSupported()) return null;
  const { enabled } = await getHealthSync();
  if (!enabled) return null;
  return importHealthWeights();
}
