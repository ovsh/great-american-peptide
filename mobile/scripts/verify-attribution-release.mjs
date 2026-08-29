#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(mobileRoot, '..');

const app = readJson(join(mobileRoot, 'app.json')).expo;
const pkg = readJson(join(mobileRoot, 'package.json'));
const store = readJson(join(mobileRoot, 'store.config.json'));
const privacy = readFileSync(join(repoRoot, 'privacy/index.html'), 'utf8');
const attribution = readFileSync(join(mobileRoot, 'src/services/attribution.ts'), 'utf8');
const purchases = readFileSync(join(mobileRoot, 'src/services/purchases.ts'), 'utf8');
const entitlement = readFileSync(join(mobileRoot, 'src/stores/entitlement.ts'), 'utf8');
const layout = readFileSync(join(mobileRoot, 'app/_layout.tsx'), 'utf8');
const onboarding = readFileSync(join(mobileRoot, 'src/stores/onboarding.ts'), 'utf8');

const meta = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next')?.[1];
const health = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === '@kingstinct/react-native-healthkit')?.[1];
const skan = new Set(app.ios.infoPlist.SKAdNetworkItems.map((item) => item.SKAdNetworkIdentifier));

check(app.version === '1.6.1', 'source version is 1.6.1');
check(app.ios.bundleIdentifier === 'industries.peptide.tracker', 'bundle id is unchanged');
check(meta?.appID === '1402932788402301', 'Meta app id matches Poke');
check(meta?.isAutoInitEnabled === false, 'Meta auto-init is off');
check(meta?.advertiserIDCollectionEnabled === false, 'advertiser id collection starts off');
check(meta?.autoLogAppEventsEnabled === true, 'activation auto-events stay on after manual init');
check(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-tracking-transparency' && plugin[1]?.userTrackingPermission.includes('installs and subscriptions')), 'ATT prompt names install and subscription measurement');
check(
  health?.NSHealthUpdateUsageDescription ===
    'Poke does not save data to Health and never asks for this permission. Apple requires this text because the Health library contains save functions.',
  'HealthKit write purpose truthfully explains the unused library API',
);
check(skan.has('v9wttpbfk9.skadnetwork') && skan.has('n38lu8286q.skadnetwork'), 'Meta SKAdNetwork ids exist');
check(pkg.dependencies?.['posthog-react-native'] === undefined, 'PostHog dependency is absent');
check(store.apple.version === '1.6.1', 'store metadata targets 1.6.1');
check(privacy.includes('Poke does not use a general product analytics service.'), 'privacy policy says product analytics is absent');

check(attribution.includes('Settings.initializeSDK()'), 'Meta initializes explicitly');
check(attribution.includes('AppEventsLogger.getAnonymousID()'), 'Meta anonymous id is read');
check(!attribution.includes('Promise.race'), 'purchase attribution has no fixed race timeout');
check(purchases.includes('collectDeviceIdentifiers()'), 'RevenueCat collects current device identifiers');
check(purchases.includes('setFBAnonymousID(facebookAnonymousId)'), 'RevenueCat receives Meta anonymous id');
check(purchases.includes('facebookAnonymousId: string | null'), 'RevenueCat can clear a revoked Meta id');
check(layout.includes("AppState.addEventListener('change'"), 'app activation re-checks ATT');
check(entitlement.indexOf('prepareAttributionForPurchase()') < entitlement.indexOf('purchasePackage(pkg)'), 'purchase preflight precedes StoreKit');
check(!existsSync(join(mobileRoot, 'app/onboarding/found.tsx')) && !onboarding.includes("'/onboarding/found'"), 'unused acquisition question is absent');

const sourceScan = run('rg', [
  '-n',
  'posthog|shot_logged|weight_logged|side_effect_logged|health_connect_enabled|medication_added',
  'app',
  'src',
], mobileRoot, true);
check(sourceScan.status === 1, 'no product analytics or health-event names remain');

const ipaArg = process.argv[2];
if (ipaArg) verifyIpa(resolve(ipaArg));

console.log(`PASS ${ipaArg ? 'source and IPA' : 'source'} attribution release checks`);

function verifyIpa(ipaPath) {
  check(existsSync(ipaPath), `IPA exists at ${ipaPath}`);
  const scratch = mkdtempSync(join(tmpdir(), 'poke-attribution-'));
  try {
    run('unzip', ['-q', ipaPath, '-d', scratch]);
    const payload = join(scratch, 'Payload');
    const appName = readdirSync(payload).find((name) => name.endsWith('.app'));
    check(Boolean(appName), 'IPA contains an app bundle');
    const appPath = join(payload, appName);
    const plistJson = run('plutil', ['-convert', 'json', '-o', '-', join(appPath, 'Info.plist')]).stdout;
    const plist = JSON.parse(plistJson);

    check(plist.CFBundleShortVersionString === '1.6.1', 'IPA version is 1.6.1');
    check(Number(plist.CFBundleVersion) >= 32, 'IPA build is 32 or newer');
    check(plist.FacebookAutoInitEnabled === false, 'IPA keeps Meta auto-init off');
    check(plist.FacebookAdvertiserIDCollectionEnabled === false, 'IPA keeps advertiser id collection off');
    check(plist.NSUserTrackingUsageDescription?.includes('installs and subscriptions'), 'IPA ATT purpose names install and subscription measurement');
    check(
      plist.NSHealthUpdateUsageDescription ===
        'Poke does not save data to Health and never asks for this permission. Apple requires this text because the Health library contains save functions.',
      'IPA explains that Poke does not request Health write access',
    );
    const ipaSkan = new Set((plist.SKAdNetworkItems ?? []).map((item) => item.SKAdNetworkIdentifier));
    check(ipaSkan.has('v9wttpbfk9.skadnetwork') && ipaSkan.has('n38lu8286q.skadnetwork'), 'IPA contains Meta SKAdNetwork ids');
    run('codesign', ['--verify', '--deep', '--strict', appPath]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function check(value, label) {
  if (!value) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

function run(command, args, cwd = mobileRoot, allowFailure = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}
