import {
  blendCurveParts,
  blendLevelAt,
  blendLevelWindowHours,
  compositionDraft,
  parseComposition,
  partDoses,
  serializeComposition,
  type BlendComponent,
} from './blends.ts';
import {
  getPreset,
  isBlend,
  peptidePresets,
  type BlendPeptidePreset,
} from './peptides.ts';
import {
  estimatedLevelAt,
  suggestedLevelWindowHours,
  tmaxOrDefault,
  type DoseEvent,
} from './pk.ts';

const HOUR = 60 * 60 * 1000;

const blends = peptidePresets.filter(isBlend);

/* ── the catalog's own promises ───────────────────────────────────────── */

test('the catalog holds blends at all', () => {
  assert(blends.length > 0, 'at least one blend preset');
});

test('every part id names a preset that exists and is not itself a blend', () => {
  // The promise `blendParts` makes in its doc comment: dropping a dead id is
  // a runtime mercy for old data, never a licence to ship one.
  for (const blend of blends) {
    assert(blend.parts.length >= 2, `${blend.name} names at least two parts`);
    for (const partId of blend.parts) {
      const part = getPreset(partId);
      assert(part !== undefined, `${blend.name} part '${partId}' resolves`);
      assert(!isBlend(part!), `${blend.name} part '${partId}' is not a blend`);
    }
  }
});

test('a blend carries no half-life of its own', () => {
  for (const blend of blends) {
    assertEqual(blend.evidence, 'unsourced', `${blend.name} is unsourced`);
    assertEqual(blend.halfLifeHours, null, `${blend.name} has no half-life`);
    assertEqual(blend.tmaxHours, null, `${blend.name} has no Tmax`);
  }
});

test('every part name appears in the blend aliases, so a part search finds the blend', () => {
  for (const blend of blends) {
    const aliases = (blend.aliases ?? []).map((alias) => alias.toLowerCase());
    for (const partId of blend.parts) {
      const part = getPreset(partId)!;
      assert(
        aliases.some((alias) => alias.includes(part.name.toLowerCase())
          || part.name.toLowerCase().includes(alias)
          || (part.aliases ?? []).some((partAlias) => alias === partAlias.toLowerCase())),
        `${blend.name} aliases carry '${part.name}'`,
      );
    }
  }
});

/* ── reading the composition column ───────────────────────────────────── */

test('a serialized composition reads back as itself', () => {
  const components: BlendComponent[] = [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 10 },
  ];
  assertEqual(
    JSON.stringify(parseComposition(serializeComposition(components))),
    JSON.stringify(components),
    'round trip',
  );
});

test('anything malformed reads as no composition', () => {
  assertEqual(parseComposition(null), null, 'null');
  assertEqual(parseComposition(undefined), null, 'undefined');
  assertEqual(parseComposition(''), null, 'empty string');
  assertEqual(parseComposition('not json'), null, 'not JSON');
  assertEqual(parseComposition('{}'), null, 'not an array');
  assertEqual(parseComposition('[]'), null, 'empty array');
  assertEqual(parseComposition('[1]'), null, 'not an object line');
  assertEqual(parseComposition('[{"presetId":"bpc-157"}]'), null, 'missing mg');
  assertEqual(parseComposition('[{"presetId":"bpc-157","mg":0}]'), null, 'zero mg');
  assertEqual(parseComposition('[{"presetId":"bpc-157","mg":-1}]'), null, 'negative mg');
  assertEqual(parseComposition('[{"presetId":"bpc-157","mg":"10"}]'), null, 'string mg');
  assertEqual(parseComposition('[{"presetId":"","mg":10}]'), null, 'empty id');
});

/* ── splitting the dose across the parts ──────────────────────────────── */

const wolverine = getPreset('wolverine') as BlendPeptidePreset;

test('fractions follow the milligrams on the label', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 30 },
  ]);
  assertEqual(parts.length, 2, 'both parts draw');
  assertClose(parts[0]!.fraction, 0.25, 'BPC-157 owns a quarter');
  assertClose(parts[1]!.fraction, 0.75, 'TB-500 owns three quarters');
  assertClose(parts[0]!.fraction + parts[1]!.fraction, 1, 'the whole vial draws');
});

test('a component the blend does not name keeps its mass and draws nothing', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'semaglutide', mg: 10 },
  ]);
  assertEqual(parts.length, 1, 'only the named part draws');
  assertClose(parts[0]!.fraction, 0.5, 'the stray milligrams stay in the denominator');
});

test('an empty or worthless composition draws nothing', () => {
  assertEqual(blendCurveParts(wolverine, []).length, 0, 'no components');
  assertEqual(
    blendCurveParts(wolverine, [{ presetId: 'bpc-157', mg: 0 }]).length,
    0,
    'zero milligrams',
  );
});

/* ── the superposition itself ─────────────────────────────────────────── */

test('the blend level is the sum of each part at its own rate', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 30 },
  ]);
  const doses: DoseEvent[] = [{ takenAt: 0, dose: 4 }];
  const at = 2 * HOUR;

  let expected = 0;
  for (const part of parts) {
    const halfLife = part.preset.halfLifeHours;
    expected += estimatedLevelAt(
      [{ takenAt: 0, dose: 4 * part.fraction }],
      halfLife,
      tmaxOrDefault(halfLife, part.preset.tmaxHours),
      at,
    );
  }
  assertClose(blendLevelAt(parts, doses, at), expected, 'sum of the parts');
  assert(expected > 0, 'the level is not trivially zero');
});

test('at the moment of the shot the blend level is the dose', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 10 },
  ]);
  assertClose(blendLevelAt(parts, [{ takenAt: 0, dose: 5 }], 0), 5, 'nothing has decayed yet');
});

test('each part decays by its own half-life', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 10 },
  ]);
  const tb500 = parts.find((part) => part.preset.id === 'tb-500')!;
  // At one TB-500 half-life, the TB-500 share of the dose has halved.
  const at = tb500.preset.halfLifeHours * HOUR;
  const scaled = partDoses([{ takenAt: 0, dose: 8 }], tb500);
  assertClose(scaled[0]!.dose, 4, 'half the dose belongs to TB-500');
  const level = estimatedLevelAt(
    scaled,
    tb500.preset.halfLifeHours,
    tmaxOrDefault(tb500.preset.halfLifeHours, tb500.preset.tmaxHours),
    at,
  );
  assertClose(level, 2, 'one half-life leaves half of the part');
});

/* ── the chart window ─────────────────────────────────────────────────── */

test('the window is sized by the slowest part', () => {
  const parts = blendCurveParts(wolverine, [
    { presetId: 'bpc-157', mg: 10 },
    { presetId: 'tb-500', mg: 10 },
  ]);
  const slowest = Math.max(...parts.map((part) => part.preset.halfLifeHours));
  assertEqual(
    blendLevelWindowHours(parts),
    suggestedLevelWindowHours(slowest),
    'window follows the longest tail',
  );
  assertEqual(
    blendLevelWindowHours([]),
    suggestedLevelWindowHours(null),
    'no drawable parts falls back to the default window',
  );
});

/* ── the typed boxes, whole or not at all ─────────────────────────────── */

const PART_IDS = ['bpc-157', 'tb-500'] as const;

test('all boxes empty saves nothing', () => {
  assertEqual(compositionDraft(PART_IDS, {}).kind, 'empty', 'no keys at all');
  assertEqual(
    compositionDraft(PART_IDS, { 'bpc-157': '', 'tb-500': '  ' }).kind,
    'empty',
    'blank and whitespace boxes',
  );
});

test('all boxes filled saves every line in part order', () => {
  const draft = compositionDraft(PART_IDS, { 'tb-500': '30', 'bpc-157': '10.5' });
  assertEqual(draft.kind, 'complete', 'every box has a number');
  if (draft.kind !== 'complete') return;
  assertEqual(
    JSON.stringify(draft.components),
    JSON.stringify([
      { presetId: 'bpc-157', mg: 10.5 },
      { presetId: 'tb-500', mg: 30 },
    ]),
    'components follow the blend order and not the typing order',
  );
});

test('one blank box among filled ones refuses to save', () => {
  assertEqual(
    compositionDraft(PART_IDS, { 'bpc-157': '10' }).kind,
    'partial',
    'a missing part hands its milligrams to the typed one',
  );
});

test('a box that does not read as a positive number refuses to save', () => {
  assertEqual(compositionDraft(PART_IDS, { 'bpc-157': '10', 'tb-500': '0' }).kind, 'partial', 'zero');
  assertEqual(compositionDraft(PART_IDS, { 'bpc-157': '10', 'tb-500': '-2' }).kind, 'partial', 'negative');
  assertEqual(compositionDraft(PART_IDS, { 'bpc-157': '10', 'tb-500': 'abc' }).kind, 'partial', 'not a number');
});

test('no parts at all reads as empty', () => {
  assertEqual(compositionDraft([], {}).kind, 'empty', 'nothing to ask for');
});

/* ── harness ──────────────────────────────────────────────────────────── */

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAIL ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertClose(actual: number, expected: number, label: string, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
