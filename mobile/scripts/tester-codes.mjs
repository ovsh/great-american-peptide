#!/usr/bin/env node
// Prints the tester code for one id, or a block of them.
//
//   node scripts/tester-codes.mjs 339        one code
//   node scripts/tester-codes.mjs 1 100      ids 1 to 100, "id<TAB>code"
//
// The math is repeated here on purpose. The script runs on a bare node with no
// tsx and no install step, so the owner can mint a code on any machine. It must
// agree with `src/domain/testerCode.ts` and `docs/tester-codes.md`; the domain
// test is the one that proves the numbers.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const M = 1048576;
const K = 246809;
const C = 77777;
const MIN_ID = 1;
const MAX_ID = 50000;

function encode(id) {
  const scrambled = (id * K + C) % M;
  const digits = [];
  let rest = scrambled;
  for (let index = 0; index < 4; index += 1) {
    digits.unshift(rest % 32);
    rest = Math.floor(rest / 32);
  }
  let total = 0;
  for (let index = 0; index < 4; index += 1) total += (index + 1) * digits[index];
  return `POKE-${digits.map((digit) => ALPHABET[digit]).join('')}${ALPHABET[total % 32]}`;
}

function parseId(text, label) {
  const id = Number(text);
  if (!Number.isInteger(id) || id < MIN_ID || id > MAX_ID) {
    console.error(`${label} must be a whole number from ${MIN_ID} to ${MAX_ID}, and it was "${text}".`);
    process.exit(1);
  }
  return id;
}

const args = process.argv.slice(2);

if (args.length === 0 || args.length > 2) {
  console.error('Usage: node scripts/tester-codes.mjs <id> [lastId]');
  process.exit(1);
}

const first = parseId(args[0], 'The id');

if (args.length === 1) {
  console.log(encode(first));
} else {
  const last = parseId(args[1], 'The last id');
  if (last < first) {
    console.error('The last id must not be below the first id.');
    process.exit(1);
  }
  for (let id = first; id <= last; id += 1) console.log(`${id}\t${encode(id)}`);
}
