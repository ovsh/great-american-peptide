import {
  createAttributionCoordinator,
  type AttributionPorts,
  type TrackingDecision,
} from './attributionCoordinator.ts';

const cases: { name: string; body: () => Promise<void> }[] = [];

function ports(decision: TrackingDecision, calls: string[]): AttributionPorts {
  return {
    resolveTrackingDecision: async () => {
      calls.push('consent');
      return decision;
    },
    initializeMeta: async (trackingEnabled) => {
      calls.push(`meta:${trackingEnabled}`);
    },
    getFacebookAnonymousId: async () => {
      calls.push('facebook-id');
      return 'XZfb-anonymous';
    },
    syncRevenueCat: async (facebookAnonymousId) => {
      calls.push(`revenuecat:${facebookAnonymousId}`);
    },
  };
}

test('a grant initializes Meta before it gives RevenueCat the Facebook id', async () => {
  const calls: string[] = [];
  const coordinator = createAttributionCoordinator(ports('granted', calls));

  await coordinator.start();

  equal(
    calls,
    ['consent', 'meta:true', 'facebook-id', 'revenuecat:XZfb-anonymous'],
    'granted call order',
  );
});

test('a denial disables Meta and clears any RevenueCat Facebook id', async () => {
  const calls: string[] = [];
  const coordinator = createAttributionCoordinator(ports('denied', calls));

  await coordinator.start();

  equal(calls, ['consent', 'meta:false', 'revenuecat:null'], 'denied call order');
});

test('a later denial revokes a grant in Meta and RevenueCat', async () => {
  const calls: string[] = [];
  const decisions: TrackingDecision[] = ['granted', 'denied'];
  const fake = ports('granted', calls);
  fake.resolveTrackingDecision = async () => {
    calls.push('consent');
    return decisions.shift() ?? 'denied';
  };
  const coordinator = createAttributionCoordinator(fake);

  await coordinator.start();
  await coordinator.start();

  equal(
    calls,
    [
      'consent',
      'meta:true',
      'facebook-id',
      'revenuecat:XZfb-anonymous',
      'consent',
      'meta:false',
      'revenuecat:null',
    ],
    'revocation call order',
  );
});

test('an unchanged grant is re-read without repeating the RevenueCat sync', async () => {
  const calls: string[] = [];
  const coordinator = createAttributionCoordinator(ports('granted', calls));

  await coordinator.start();
  await coordinator.start();

  equal(
    calls,
    ['consent', 'meta:true', 'facebook-id', 'revenuecat:XZfb-anonymous', 'consent'],
    'unchanged grant calls',
  );
});

test('a Meta failure cannot prevent RevenueCat from clearing a revoked id', async () => {
  const calls: string[] = [];
  const fake = ports('denied', calls);
  fake.initializeMeta = async (trackingEnabled) => {
    calls.push(`meta:${trackingEnabled}`);
    throw new Error('Meta unavailable');
  };
  const coordinator = createAttributionCoordinator(fake);

  await coordinator.start();

  equal(calls, ['consent', 'meta:false', 'revenuecat:null'], 'independent revocation calls');
});

test('an undetermined answer waits for a later active retry before Meta starts', async () => {
  const calls: string[] = [];
  const decisions: TrackingDecision[] = ['undetermined', 'granted'];
  const fake = ports('granted', calls);
  fake.resolveTrackingDecision = async () => {
    calls.push('consent');
    return decisions.shift() ?? 'granted';
  };
  const coordinator = createAttributionCoordinator(fake);

  await coordinator.start();
  equal(calls, ['consent'], 'first undetermined attempt');
  await coordinator.prepareForPurchase();
  equal(
    calls,
    ['consent', 'consent', 'meta:true', 'facebook-id', 'revenuecat:XZfb-anonymous'],
    'active retry call order',
  );
});

test('concurrent callers share one consent and identifier attempt', async () => {
  const calls: string[] = [];
  const coordinator = createAttributionCoordinator(ports('granted', calls));

  await Promise.all([coordinator.start(), coordinator.prepareForPurchase()]);

  assert(calls.filter((call) => call === 'consent').length === 1, 'one consent read');
  assert(calls.filter((call) => call === 'facebook-id').length === 1, 'one Facebook id read');
});

test('a RevenueCat failure never rejects a purchase preflight and retries later', async () => {
  const calls: string[] = [];
  let syncAttempts = 0;
  const fake = ports('granted', calls);
  fake.syncRevenueCat = async () => {
    syncAttempts += 1;
    calls.push(`revenuecat:${syncAttempts}`);
    if (syncAttempts === 1) throw new Error('network unavailable');
  };
  const coordinator = createAttributionCoordinator(fake);

  await coordinator.prepareForPurchase();
  assert(syncAttempts === 1, 'first sync attempted');
  await coordinator.prepareForPurchase();
  assert(syncAttempts === 2, 'failed sync retried');
});

function assert(value: boolean, label: string) {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function equal(actual: string[], expected: string[], label: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function test(name: string, body: () => Promise<void>) {
  cases.push({ name, body });
}

async function run() {
  for (const entry of cases) {
    await entry.body();
    console.log(`PASS ${entry.name}`);
  }
  console.log(`${cases.length} attribution-coordinator tests passed.`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
