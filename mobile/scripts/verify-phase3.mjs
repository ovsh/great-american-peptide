import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);

const streakTest = join(root, 'src/domain/streaks.test.ts');
if (existsSync(streakTest)) {
  run(process.execPath, ['--no-warnings', '--experimental-strip-types', streakTest]);
}

if (!process.argv.includes('--final')) {
  process.stdout.write('Phase 3 TypeScript gate passed.\n');
  process.exit(0);
}

const failures = [];
const requiredFiles = [
  'src/domain/sideEffects.ts',
  'src/domain/streaks.ts',
  'src/domain/streaks.test.ts',
  'assets/images/icon-poke.svg',
  'assets/images/icon.png',
  'assets/images/splash-icon.png',
  'assets/images/android-icon-background.png',
  'assets/images/android-icon-foreground.png',
  'assets/images/android-icon-monochrome.png',
  'assets/images/favicon.png',
];

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) failures.push(`Missing required file: ${path}`);
}

const config = readFileSync(join(root, 'app.json'), 'utf8');
for (const required of ['#2FB47C', './assets/images/icon.png', './assets/images/splash-icon.png']) {
  if (!config.includes(required)) failures.push(`app.json is missing ${required}`);
}
for (const legacy of ['#F2E9D8', '#B0202E']) {
  if (config.includes(legacy)) failures.push(`app.json still contains legacy color ${legacy}`);
}

const requiredSnippets = new Map([
  ['app/log-side-effect.tsx', ['SIDE_EFFECT_PRESETS', '<SeveritySlider', 'createSideEffect']],
  ['app/(tabs)/index.tsx', ['streak >= 2', "router.push('/log-side-effect')", 'First weight logged.']],
  ['app/(tabs)/progress.tsx', ['Last 14 days', 'countEffects(sideEffects)', 'setSelectedEffect(effect)']],
  ['app/(tabs)/profile.tsx', ['personal record keeping only', 'About Poke']],
  ['app/log-shot/index.tsx', ['height * 0.46', 'siteCardMaxHeight']],
  ['app/medications/new.tsx', ['updateMedicationAndRefresh', "frequencyKind: freq"]],
  ['src/components/BodyDiagram.tsx', ['<Circle cx={50} cy={96}', "view === 'front'"]],
  ['src/services/notifications.ts', ['medicationScheduleFromStored', 'nextScheduledDoses(schedule, now, 6)']],
  ['src/services/onboarding.ts', ['createMeasurement({', 'refreshScheduledReminders()']],
  ['src/services/medicationMutations.ts', ['updateMedicationAndRefresh', 'refreshScheduledReminders()']],
  ['metro.config.js', ['config.resolver.useWatchman = false']],
  ['assets/images/icon-poke.svg', ['#2FB47C', 'rotate(-45)', '#FFFFFF']],
]);

for (const [path, snippets] of requiredSnippets) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) continue;
  const source = readFileSync(fullPath, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) failures.push(`${path} is missing ${snippet}`);
  }
}

const medicationRepository = readFileSync(join(root, 'src/repositories/medications.ts'), 'utf8');
const updateMedicationQuery = medicationRepository.slice(
  medicationRepository.indexOf('export async function updateMedicationDefaults'),
  medicationRepository.indexOf('export async function setMedicationStatus'),
);
if (updateMedicationQuery.includes("status = 'active'")) {
  failures.push('Medication edits still force paused medications to active');
}

const pngSizes = new Map([
  ['assets/images/icon.png', [1024, 1024]],
  ['assets/images/splash-icon.png', [1024, 1024]],
  ['assets/images/android-icon-background.png', [512, 512]],
  ['assets/images/android-icon-foreground.png', [512, 512]],
  ['assets/images/android-icon-monochrome.png', [432, 432]],
  ['assets/images/favicon.png', [48, 48]],
]);

for (const [path, expected] of pngSizes) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) continue;
  const bytes = readFileSync(fullPath);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    failures.push(`${path} is not a PNG file`);
    continue;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expected[0] || height !== expected[1]) {
    failures.push(`${path} is ${width}x${height}, expected ${expected[0]}x${expected[1]}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Phase 3 final checks passed.\n');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
