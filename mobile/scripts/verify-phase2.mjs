import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const typecheck = spawnSync(
  process.execPath,
  [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'],
  { cwd: root, encoding: 'utf8', stdio: 'pipe' },
);

if (typecheck.stdout) process.stdout.write(typecheck.stdout);
if (typecheck.stderr) process.stderr.write(typecheck.stderr);
if (typecheck.status !== 0) process.exit(typecheck.status ?? 1);

if (!process.argv.includes('--final')) {
  process.stdout.write('TypeScript check passed.\n');
  process.exit(0);
}

const requiredFiles = [
  'app/(tabs)/progress.tsx',
  'app/(tabs)/history.tsx',
  'app/(tabs)/profile.tsx',
  'app/(tabs)/index.tsx',
  'app/log-shot/index.tsx',
];
const removedFiles = [
  'app/(tabs)/calendar.tsx',
  'app/(tabs)/seal.tsx',
  'src/components/BrandSeal.tsx',
  'src/components/MastHead.tsx',
  'src/components/Eyebrow.tsx',
];
const bannedSourceText = [
  'BrandSeal',
  'MastHead',
  'Eyebrow',
  'Fraunces_',
  'colors.red',
  'colors.navy',
  'colors.gold',
];
const requiredSourceText = {
  'src/components/Button.tsx': ['accessibilityLabel={accessibilityLabel}'],
  'app/onboarding/weight.tsx': ['placeholder="198"', 'placeholder="175"'],
  'app/onboarding/ready.tsx': ['now · goal', 'transform: [{ scale }]'],
  'app/(tabs)/_layout.tsx': ["label: 'Today'", "label: 'Progress'", "label: 'History'", "label: 'Profile'", 'width: 56'],
  'src/components/LogActionSheet.tsx': ['Log shot', 'Log weight', 'Log side effect', 'Calculator'],
  'app/(tabs)/index.tsx': ['Estimated current level', 'Shot day is', 'How are you feeling?'],
  'app/log-shot/index.tsx': ['recommendNextSite', 'suggestedId=', 'detailsOpen', "'Log shot'"],
  'app/(tabs)/history.tsx': ["type HistoryMode = 'list' | 'calendar'", '<MonthGrid'],
  'app/(tabs)/progress.tsx': ["const RANGES = ['7d', '30d', '90d']", 'Current streak', 'Best streak'],
  'app/(tabs)/profile.tsx': ['My medications', 'Reminder time', 'Goal weight'],
};
const failures = [];

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) failures.push(`Missing required file: ${path}`);
}

for (const path of removedFiles) {
  if (existsSync(join(root, path))) failures.push(`Legacy file still exists: ${path}`);
}

for (const [path, requiredTexts] of Object.entries(requiredSourceText)) {
  const source = readFileSync(join(root, path), 'utf8');
  for (const required of requiredTexts) {
    if (!source.includes(required)) failures.push(`Required source text ${required} is missing from ${path}`);
  }
}

for (const path of sourceFiles(join(root, 'app')).concat(sourceFiles(join(root, 'src')))) {
  const source = readFileSync(path, 'utf8');
  for (const banned of bannedSourceText) {
    if (source.includes(banned)) failures.push(`Legacy source text ${banned} remains in ${path.slice(root.length + 1)}`);
  }
}

for (const path of ['package.json', 'package-lock.json']) {
  if (readFileSync(join(root, path), 'utf8').includes('@expo-google-fonts/fraunces')) {
    failures.push(`Fraunces dependency remains in ${path}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Phase 2 source checks passed.\n');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}
