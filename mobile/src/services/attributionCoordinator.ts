export type TrackingDecision =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'undetermined'
  | 'unsupported';

/** Native work kept behind ports so the consent boundary is executable in Node. */
export interface AttributionPorts {
  resolveTrackingDecision(): Promise<TrackingDecision>;
  initializeMeta(trackingEnabled: boolean): Promise<void>;
  getFacebookAnonymousId(): Promise<string | null>;
  syncRevenueCat(facebookAnonymousId: string | null): Promise<void>;
}

export interface AttributionCoordinator {
  /** Prime attribution after the first screen is visible. */
  start(): Promise<void>;
  /** Join, or retry, the same best-effort work before StoreKit opens. */
  prepareForPurchase(): Promise<void>;
}

/**
 * Serializes tracking decisions for the process.
 *
 * Each app-active or purchase boundary reads ATT again. This makes a later
 * revocation take effect in both Meta and RevenueCat instead of keeping the
 * process's first answer forever. Concurrent callers share one attempt.
 * Every public call resolves because an ad service failure must not reject an
 * app action or a purchase.
 */
export function createAttributionCoordinator(ports: AttributionPorts): AttributionCoordinator {
  let inFlight: Promise<void> | null = null;
  let lastAppliedDecision: TrackingDecision | null = null;

  const ensureStarted = async (): Promise<void> => {
    if (!inFlight) {
      inFlight = runAttempt(ports, lastAppliedDecision)
        .then((appliedDecision) => {
          if (appliedDecision) lastAppliedDecision = appliedDecision;
        })
        .catch(() => {
          // A later app-active or purchase boundary can retry.
        })
        .finally(() => {
          inFlight = null;
        });
    }
    await inFlight;
  };

  return {
    start: ensureStarted,
    prepareForPurchase: ensureStarted,
  };
}

async function runAttempt(
  ports: AttributionPorts,
  lastAppliedDecision: TrackingDecision | null,
): Promise<TrackingDecision | null> {
  const decision = await ports.resolveTrackingDecision();
  if (decision === 'undetermined' || decision === 'unsupported') return null;
  if (decision === lastAppliedDecision) return decision;

  const granted = decision === 'granted';
  if (!granted) {
    const results = await Promise.allSettled([
      ports.initializeMeta(false),
      ports.syncRevenueCat(null),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Consent revocation did not reach every attribution service.');
    }
    return decision;
  }

  await ports.initializeMeta(true);
  const facebookAnonymousId = await ports.getFacebookAnonymousId();
  if (!facebookAnonymousId || facebookAnonymousId.trim().length === 0) {
    throw new Error('Meta did not provide an anonymous identifier.');
  }

  await ports.syncRevenueCat(facebookAnonymousId);
  return decision;
}
