// Tests for testerCode.ts. Run with: npx tsx src/domain/testerCode.test.ts

import {
  CODE_ALPHABET,
  CODE_INVERSE,
  CODE_MODULUS,
  CODE_MULTIPLIER,
  MAX_TESTER_ID,
  MIN_TESTER_ID,
  decodeTesterCode,
  encodeTesterCode,
} from './testerCode.ts';

let passed = 0;

function assert(value: boolean, label: string) {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('the inverse really is the inverse', () => {
  assert((CODE_MULTIPLIER * CODE_INVERSE) % CODE_MODULUS === 1, 'K times KINV is 1 mod M');
  assert(CODE_MULTIPLIER % 2 === 1, 'the multiplier is odd');
  assert(CODE_ALPHABET.length === 32, 'the alphabet holds 32 characters');
  assert(!/[ILOU]/.test(CODE_ALPHABET), 'the alphabet drops I, L, O and U');
});

test('round-trips the ends and the middle of the range', () => {
  for (const id of [1, 2, 339, 340, 50000]) {
    const code = encodeTesterCode(id);
    assert(code.length === 10, `code for ${id} is ten characters`);
    assert(code.startsWith('POKE-'), `code for ${id} carries the prefix`);
    assert(decodeTesterCode(code) === id, `code for ${id} round-trips`);
  }
});

test('every id in the range has its own code', () => {
  const seen = new Set<string>();
  for (let id = MIN_TESTER_ID; id <= MAX_TESTER_ID; id += 1) {
    const code = encodeTesterCode(id);
    assert(!seen.has(code), `code for ${id} is new`);
    seen.add(code);
  }
  assert(seen.size === MAX_TESTER_ID, 'fifty thousand codes');
});

test('neighbouring ids share no payload character', () => {
  const before = payloadOf(encodeTesterCode(339));
  const after = payloadOf(encodeTesterCode(340));
  assert(before === 'VQ7C', 'id 339 is the worked example in the doc');
  for (const character of before) {
    assert(!after.includes(character), `340 drops ${character}`);
  }
});

test('the checksum rejects a corrupted character', () => {
  const code = encodeTesterCode(339);
  assert(decodeTesterCode(code) === 339, 'the clean code reads');
  // The first payload character carries weight one, so any other character
  // there moves the checksum.
  const corrupted = `${code.slice(0, 5)}W${code.slice(6)}`;
  assert(corrupted !== code, 'the corruption changed something');
  assert(decodeTesterCode(corrupted) === null, 'the corrupted code reads as null');
});

test('an id off the range reads as null', () => {
  // Poke never issues these, so the code exists on paper and nowhere else.
  assert(decodeTesterCode(codeForAnyNumber(0)) === null, 'id zero');
  assert(decodeTesterCode(codeForAnyNumber(MAX_TESTER_ID + 1)) === null, 'one past the end');
  assert(decodeTesterCode(codeForAnyNumber(999999)) === null, 'far past the end');
});

test('an id off the range never encodes', () => {
  for (const id of [0, -1, MAX_TESTER_ID + 1, 1.5, Number.NaN]) {
    let threw = false;
    try {
      encodeTesterCode(id);
    } catch {
      threw = true;
    }
    assert(threw, `encoding ${id} throws`);
  }
});

test('garbage reads as null and never throws', () => {
  for (const input of ['', '   ', 'POKE-', 'hello', 'POKE-ABC', 'POKE-ABCDEF', 'POKE-UUUUU', '?????']) {
    assert(decodeTesterCode(input) === null, `"${input}" reads as null`);
  }
});

test('case, prefix and punctuation are noise', () => {
  assert(decodeTesterCode('poke-vq7ce') === 339, 'lowercase with the prefix');
  assert(decodeTesterCode('VQ7CE') === 339, 'no prefix at all');
  assert(decodeTesterCode('  POKE - VQ 7-CE  ') === 339, 'spaces and stray hyphens');
  assert(decodeTesterCode('vq7ce') === 339, 'lowercase without the prefix');
});

test('the lookalike characters map back', () => {
  // 1 and 0 are in the alphabet, I, L and O are not, so a typed I reads as 1.
  const code = encodeTesterCode(2);
  assert(code === 'POKE-HE03S', 'id 2 holds a zero');
  assert(decodeTesterCode('POKE-HEO3S') === 2, 'a typed O reads as zero');
  const withOnes = encodeTesterCode(idWithDigit('1'));
  const id = decodeTesterCode(withOnes);
  assert(id !== null, 'the sample code reads');
  assert(decodeTesterCode(withOnes.replace('1', 'I')) === id, 'a typed I reads as one');
  assert(decodeTesterCode(withOnes.replace('1', 'L')) === id, 'a typed L reads as one');
});

function payloadOf(code: string): string {
  return code.slice(5, 9);
}

/** The code a number would carry, range or no range. Test scaffolding only. */
function codeForAnyNumber(id: number): string {
  const scrambled = (((id * CODE_MULTIPLIER + 77777) % CODE_MODULUS) + CODE_MODULUS) % CODE_MODULUS;
  const digits: number[] = [];
  let rest = scrambled;
  for (let index = 0; index < 4; index += 1) {
    digits.unshift(rest % 32);
    rest = Math.floor(rest / 32);
  }
  let total = 0;
  digits.forEach((digit, index) => {
    total += (index + 1) * digit;
  });
  return `POKE-${digits.map((digit) => CODE_ALPHABET[digit]).join('')}${CODE_ALPHABET[total % 32]}`;
}

/** The first id whose code holds the given character. */
function idWithDigit(character: string): number {
  for (let id = MIN_TESTER_ID; id <= MAX_TESTER_ID; id += 1) {
    if (encodeTesterCode(id).slice(5).includes(character)) return id;
  }
  throw new Error(`no code holds ${character}`);
}

console.log(`${passed} testerCode tests passed.`);
