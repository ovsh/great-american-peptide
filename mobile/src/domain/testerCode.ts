// The tester code, encoded and decoded on the device with no server in it.
//
// Poke invites a tester and hands them one code, "POKE-VQ7CE". The code carries
// a tester id, so the owner keeps a list of who holds which code, and the app
// checks a code without a network call. There is no list of codes in the
// binary: every id from 1 to 50000 has a code, and the app reads the id back out
// of the five characters.
//
// The map from id to payload is one affine step, `n * K + C` modulo 32^4. K is
// odd, so the step is a bijection and one inverse multiply reads the id back.
// The point of the multiply is only that ids 339 and 340 look nothing alike, so
// a tester who knows one code guesses nothing from it. A fifth character is a
// position weighted checksum, which catches the ordinary typo before it becomes
// a wrong tester id.
//
// READ THIS BEFORE YOU TRUST IT. The constants below ship inside the app, so
// anyone who unpacks the binary can mint every code. This is a convenience for
// people Poke already invited, not a lock. See `src/services/testerAccess.ts`
// for what that rules out.
//
// The alphabet is Crockford base32, which drops I, L, O and U. `decodeTesterCode`
// maps the three lookalikes back, so a code read off a screen and typed on a
// phone survives the trip.
//
// Pure, and tested with `npx tsx src/domain/testerCode.test.ts`. The generator
// in `scripts/tester-codes.mjs` and the spec in `docs/tester-codes.md` hold the
// same numbers; change one and change all three.

/** Crockford base32: the digits, then the letters, less I, L, O and U. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 32^4, the count a four character payload can hold. */
export const CODE_MODULUS = 1048576;

/** The multiplier. Odd, so it has an inverse modulo a power of two. */
export const CODE_MULTIPLIER = 246809;

/** The inverse of the multiplier modulo `CODE_MODULUS`. The test proves it. */
export const CODE_INVERSE = 350249;

/** The offset, which keeps id 0 off the all zero payload. */
export const CODE_OFFSET = 77777;

export const MIN_TESTER_ID = 1;
export const MAX_TESTER_ID = 50000;

/** What every code reads as on paper and in a message to a tester. */
export const CODE_PREFIX = 'POKE-';

/** How many alphabet characters a code carries: four payload and one checksum. */
const CODE_LENGTH = 5;

const PAYLOAD_LENGTH = 4;

/**
 * The code for one tester id, in the form "POKE-VQ7CE".
 *
 * Throws on an id outside the range, because the caller is the generator script
 * or a test and never a person typing. `decodeTesterCode` is the side that takes
 * user input, and it returns null rather than throwing.
 */
export function encodeTesterCode(id: number): string {
  if (!Number.isInteger(id) || id < MIN_TESTER_ID || id > MAX_TESTER_ID) {
    throw new Error(`tester id out of range: ${id}`);
  }
  const scrambled = (id * CODE_MULTIPLIER + CODE_OFFSET) % CODE_MODULUS;
  const digits = toDigits(scrambled);
  const payload = digits.map((digit) => CODE_ALPHABET[digit]).join('');
  return `${CODE_PREFIX}${payload}${CODE_ALPHABET[checksumDigit(digits)]}`;
}

/**
 * The tester id a typed code carries, or null when the code says nothing.
 *
 * Never throws. Every reject is the same null, so a screen cannot tell a bad
 * checksum from an id nobody was given, and neither can the person holding the
 * keyboard.
 */
export function decodeTesterCode(input: string): number | null {
  if (typeof input !== 'string') return null;

  // Case and punctuation are noise on a phone keyboard, so Poke drops both, and
  // the prefix goes before the lookalike mapping turns its O into a zero.
  let text = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (text.startsWith('POKE') || text.startsWith('P0KE')) text = text.slice(4);
  text = text.replace(/[IL]/g, '1').replace(/O/g, '0');
  if (text.length !== CODE_LENGTH) return null;

  const digits: number[] = [];
  for (const character of text) {
    const digit = CODE_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    digits.push(digit);
  }

  const payload = digits.slice(0, PAYLOAD_LENGTH);
  if (digits[PAYLOAD_LENGTH] !== checksumDigit(payload)) return null;

  const scrambled = payload.reduce((total, digit) => total * 32 + digit, 0);
  // The subtraction can go negative, so the result is pulled back into range
  // before the range check reads it.
  const id = (((scrambled - CODE_OFFSET) * CODE_INVERSE) % CODE_MODULUS + CODE_MODULUS) % CODE_MODULUS;
  if (id < MIN_TESTER_ID || id > MAX_TESTER_ID) return null;
  return id;
}

/** The four base32 digits of a payload, most significant first. */
function toDigits(scrambled: number): number[] {
  const digits: number[] = [];
  let rest = scrambled;
  for (let index = 0; index < PAYLOAD_LENGTH; index += 1) {
    digits.unshift(rest % 32);
    rest = Math.floor(rest / 32);
  }
  return digits;
}

/**
 * The checksum digit: each payload digit times its position, counting from one,
 * modulo 32. The positions are what make a swapped pair of characters read as a
 * different code instead of the same one.
 */
function checksumDigit(digits: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < digits.length; index += 1) {
    total += (index + 1) * digits[index];
  }
  return total % 32;
}
