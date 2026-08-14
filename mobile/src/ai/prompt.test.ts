import { createHash } from 'node:crypto';

import { ASK_POKE_SYSTEM_PROMPT, promptHash, sha256Hex } from './prompt.ts';

test('the hand-written SHA-256 matches node crypto', () => {
  for (const sample of ['', 'abc', 'a'.repeat(1000), ASK_POKE_SYSTEM_PROMPT]) {
    assertEqual(
      sha256Hex(sample),
      createHash('sha256').update(sample, 'utf8').digest('hex'),
      `digest of ${sample.length} characters`,
    );
  }
});

test('multi-byte text hashes like node crypto', () => {
  const sample = 'vial 5 mg, diluent 2 ml — 250 µg sample';
  assertEqual(
    sha256Hex(sample),
    createHash('sha256').update(sample, 'utf8').digest('hex'),
    'utf-8 bytes',
  );
});

test('the prompt hash is the hash of the prompt', () => {
  assertEqual(promptHash(), sha256Hex(ASK_POKE_SYSTEM_PROMPT), 'default argument');
  assertEqual(promptHash().length, 64, 'hex length');
});

test('the prompt keeps the rules that cannot bend', () => {
  assertEqual(ASK_POKE_SYSTEM_PROMPT.includes('You never compute a number.'), true, 'rule 1');
  assertEqual(ASK_POKE_SYSTEM_PROMPT.includes('licensed clinician'), true, 'the decline line');
  assertEqual(ASK_POKE_SYSTEM_PROMPT.includes('## Scenarios'), true, 'the repair surface');
});

function assertEqual<T>(actual: T, expected: T, label: string) {
  console.assert(actual === expected, `${label}: expected ${String(expected)}, received ${String(actual)}`);
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
