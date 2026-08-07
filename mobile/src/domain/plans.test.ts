import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import { buildPlanOptions, savingsPercent, trialLabel } from './plans.ts';

test('savings is null when yearly is not cheaper than twelve months', () => {
  assertEqual(savingsPercent(119.88, 9.99), null, 'identical cost');
  assertEqual(savingsPercent(150, 9.99), null, 'yearly more expensive');
});

test('savings rounds the real discount', () => {
  assertEqual(savingsPercent(49.99, 9.99), 58, 'annual 49.99 vs monthly 9.99');
  assertEqual(savingsPercent(59.99, 9.99), 50, 'annual 59.99 vs monthly 9.99');
});

test('savings is null for prices that cannot be compared', () => {
  assertEqual(savingsPercent(0, 9.99), null, 'free annual');
  assertEqual(savingsPercent(49.99, 0), null, 'free monthly');
  assertEqual(savingsPercent(Number.NaN, 9.99), null, 'not a number');
});

test('a paid introductory price is not advertised as a free trial', () => {
  assertEqual(trialLabel(pkg('ANNUAL', 49.99, { price: 0.99, periodNumberOfUnits: 1, periodUnit: 'MONTH' })), null, 'paid intro');
});

test('a free introductory period becomes a day count', () => {
  assertEqual(trialLabel(pkg('ANNUAL', 49.99, { price: 0, periodNumberOfUnits: 1, periodUnit: 'WEEK' })), '7 days free', 'one week');
  assertEqual(trialLabel(pkg('ANNUAL', 49.99, { price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' })), '3 days free', 'three days');
  assertEqual(trialLabel(pkg('ANNUAL', 49.99, { price: 0, periodNumberOfUnits: 1, periodUnit: 'DAY' })), '1 day free', 'singular');
});

test('placeholder pricing is used when no offering exists', () => {
  const [annual, monthly] = buildPlanOptions(null);
  assertEqual(annual.pkg, null, 'annual has no package');
  assertEqual(annual.badge, 'Save 58%', 'placeholder badge');
  assertEqual(annual.trialLabel, '7 days free', 'placeholder trial');
  assertEqual(monthly.badge, null, 'monthly never carries a badge');
  assertEqual(monthly.perMonthLabel, null, 'monthly needs no per-month line');
});

test('real store prices drive the badge, not the placeholders', () => {
  const options = buildPlanOptions(offering([
    pkg('ANNUAL', 79.99, { price: 0, periodNumberOfUnits: 1, periodUnit: 'WEEK' }),
    pkg('MONTHLY', 9.99, null),
  ]));
  assertEqual(options[0].badge, 'Save 33%', 'badge from live prices');
  assertEqual(options[0].trialLabel, '7 days free', 'trial from live product');
  assertEqual(options[1].trialLabel, null, 'monthly has no trial');
});

type Intro = { price: number; periodNumberOfUnits: number; periodUnit: string } | null;

function pkg(packageType: string, price: number, introPrice: Intro): PurchasesPackage {
  return {
    identifier: `$rc_${packageType.toLowerCase()}`,
    packageType,
    offeringIdentifier: 'default',
    product: {
      identifier: `poke_pro_${packageType.toLowerCase()}`,
      price,
      priceString: `$${price.toFixed(2)}`,
      currencyCode: 'USD',
      introPrice,
    },
  } as unknown as PurchasesPackage;
}

function offering(packages: PurchasesPackage[]): PurchasesOffering {
  return {
    identifier: 'default',
    availablePackages: packages,
    annual: packages.find((p) => p.packageType === 'ANNUAL') ?? null,
    monthly: packages.find((p) => p.packageType === 'MONTHLY') ?? null,
  } as unknown as PurchasesOffering;
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  console.assert(actual === expected, `${label}: expected ${String(expected)}, received ${String(actual)}`);
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
