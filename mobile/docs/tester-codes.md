# Tester codes

A tester code is a ten character string, `POKE-VQ7CE`, that carries one tester id. The app
reads the id back out of the code with no network call and no list of codes in the binary.
This file is the whole spec. Hand it to another codebase, or to a model, and the codes will
match.

The app implements it in `mobile/src/domain/testerCode.ts`, the owner mints codes with
`node mobile/scripts/tester-codes.mjs <id> [lastId]`, and
`mobile/src/domain/testerCode.test.ts` is the proof. Change one of the four and change all
four.

## The alphabet

Crockford base32, in this exact order. Index 0 is `0`, index 31 is `Z`.

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

`I`, `L`, `O` and `U` are absent. The first three are lookalikes for `1`, `1` and `0`, and
the decoder maps them back. `U` is absent so a scrambled payload cannot spell an unwanted
word.

## The constants

| Name | Value | Why |
|---|---|---|
| `M` | 1048576 | 32^4, everything a four character payload can hold |
| `K` | 246809 | The multiplier. Odd, so it has an inverse modulo a power of two |
| `KINV` | 350249 | The inverse of `K` modulo `M`, so `K * KINV mod M = 1` |
| `C` | 77777 | The offset, so id 0 does not land on the all zero payload |
| `MIN_ID` | 1 | |
| `MAX_ID` | 50000 | Any higher id encodes fine and decodes as invalid |

## Encoding an id

1. Take the tester id `n`, a whole number from `MIN_ID` to `MAX_ID`.
2. Scramble it: `s = (n * K + C) mod M`. `K` is odd and `M` is a power of two, so this step
   is reversible and no two ids share a value of `s`.
3. Write `s` as exactly four base32 digits, most significant first. Each digit is one
   alphabet character. This is the payload.
4. Checksum the payload: multiply each digit by its position, counting the first digit as
   position 1, add the four products, and take the total modulo 32. That digit is the fifth
   character. Positions are what make a swapped pair of characters read as a different code
   rather than the same one.
5. The code is `POKE-` then the four payload characters then the checksum character.

## Decoding a typed code

Never throw. Every reject is the same answer, so the screen cannot tell a bad checksum from
an id nobody was given, and neither can the person at the keyboard.

1. Uppercase the input and drop everything that is not a letter or a digit. That covers the
   hyphen, stray spaces, and whatever else a phone keyboard added.
2. If what is left starts with `POKE` or `P0KE`, drop those four characters. Do this before
   step 3, or the `O` in the prefix becomes a zero and the prefix stops matching.
3. Map the lookalikes: `I` and `L` become `1`, `O` becomes `0`.
4. Require exactly five characters, each one in the alphabet. Anything else is invalid.
5. Read the five characters as digits by their alphabet index. Recompute the checksum over
   the first four and compare it with the fifth. A mismatch is invalid.
6. Rebuild `s` from the four payload digits: `s = ((d1 * 32 + d2) * 32 + d3) * 32 + d4`.
7. Unscramble: `n = ((s - C) * KINV) mod M`. The subtraction can go negative, so add `M`
   and take the modulo again before you read the result.
8. The code is valid when `MIN_ID <= n <= MAX_ID`. Return `n`, or nothing at all.

## Worked example, id 339

```
n           = 339
n * K       = 339 * 246809      = 83668251
+ C         = 83668251 + 77777  = 83746028
s = mod M   = 83746028 mod 1048576 = 908524      (83746028 = 79 * 1048576 + 908524)

908524 in base 32, four digits:
  908524 / 32768 = 27 remainder 23788           digit 1 = 27 = "V"
   23788 /  1024 = 23 remainder   236           digit 2 = 23 = "Q"
     236 /    32 =  7 remainder    12           digit 3 =  7 = "7"
                                                digit 4 = 12 = "C"
payload     = "VQ7C"

checksum    = 1*27 + 2*23 + 3*7 + 4*12
            = 27 + 46 + 21 + 48 = 142
142 mod 32  = 14                                 checksum = 14 = "E"

code        = POKE-VQ7CE
```

Back the other way:

```
s           = ((27 * 32 + 23) * 32 + 7) * 32 + 12 = 908524
s - C       = 908524 - 77777 = 830747
* KINV      = 830747 * 350249 = 290968306003
mod M       = 290967715003 mod 1048576 = 339      in range, so the id is 339
```

Neighbouring ids look nothing alike: id 340 is `POKE-3885Z`, which shares no character with
`VQ7C`.

## Reference implementation, JavaScript

```js
const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const M = 1048576, K = 246809, KINV = 350249, C = 77777, MIN = 1, MAX = 50000;

export function encode(id) {
  const s = (id * K + C) % M;
  const d = [(s >> 15) & 31, (s >> 10) & 31, (s >> 5) & 31, s & 31];
  const sum = d.reduce((t, v, i) => t + (i + 1) * v, 0) % 32;
  return 'POKE-' + d.map((v) => A[v]).join('') + A[sum];
}

export function decode(input) {
  let t = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.startsWith('POKE') || t.startsWith('P0KE')) t = t.slice(4);
  t = t.replace(/[IL]/g, '1').replace(/O/g, '0');
  const d = [...t].map((c) => A.indexOf(c));
  if (d.length !== 5 || d.some((v) => v < 0)) return null;
  if (d.slice(0, 4).reduce((x, v, i) => x + (i + 1) * v, 0) % 32 !== d[4]) return null;
  const s = d.slice(0, 4).reduce((x, v) => x * 32 + v, 0);
  const id = ((((s - C) * KINV) % M) + M) % M;
  return id >= MIN && id <= MAX ? id : null;
}
```

## Reference implementation, Python

```python
A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
M, K, KINV, C, MIN_ID, MAX_ID = 1048576, 246809, 350249, 77777, 1, 50000

def encode(tester_id):
    s = (tester_id * K + C) % M
    d = [(s >> 15) & 31, (s >> 10) & 31, (s >> 5) & 31, s & 31]
    checksum = sum((i + 1) * v for i, v in enumerate(d)) % 32
    return "POKE-" + "".join(A[v] for v in d) + A[checksum]

def decode(text):
    t = "".join(c for c in text.upper() if c.isalnum())
    if t[:4] in ("POKE", "P0KE"):
        t = t[4:]
    t = t.replace("I", "1").replace("L", "1").replace("O", "0")
    if len(t) != 5 or any(c not in A for c in t):
        return None
    d = [A.index(c) for c in t]
    if sum((i + 1) * v for i, v in enumerate(d[:4])) % 32 != d[4]:
        return None
    s = d[0] * 32768 + d[1] * 1024 + d[2] * 32 + d[3]
    tester_id = ((s - C) * KINV) % M
    return tester_id if MIN_ID <= tester_id <= MAX_ID else None
```

## Limits

Read these before you put anything behind a code.

- **A code is not single use.** There is no server and no ledger, so nothing counts
  redemptions. One tester can pass their code to a hundred people and every one of them
  unlocks. The id tells the owner who the code went to, and that is all it tells anyone.
- **The constants ship in the app bundle.** Anyone can unpack the IPA, read `K`, `C` and
  the alphabet out of the JavaScript, and mint every code from 1 to 50000 in a second. The
  scrambling stops a tester guessing the next code from their own. It stops nothing else.
- **This gates a tester unlock and must never gate real revenue.** Put behind a code only
  what Poke could give away for free. A paid feature is guarded by the App Store receipt,
  never by this.
- **The checksum catches the ordinary typo, not every one.** A single wrong character in
  payload position 2 or 4 can hold the checksum when the change is exactly 16, and the code
  then decodes to a different number. That number is outside 1 to 50000 about 95 times in
  100, so it reads as invalid anyway. It is a typo catcher, not an error correcting code.
- **Revoking one code is not possible.** The only way to retire a round of codes is to
  change `K` or `C` and ship a new build, which invalidates every code at once.
