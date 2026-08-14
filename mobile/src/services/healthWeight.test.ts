import {
  HEALTH_WEIGHT_KG,
  READ_OVERLAP_MS,
  newestRow,
  readWindowStart,
  toWeightRows,
  type HealthWeightSample,
} from './healthWeight.ts';

const NOW = new Date(2026, 7, 13, 9, 0, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

function sample(over: Partial<HealthWeightSample> = {}): HealthWeightSample {
  return { uuid: 'hk-1', quantity: 82.3, startDate: new Date(NOW), ...over };
}

test('a good sample becomes one kilogram row keyed by its uuid', () => {
  const rows = toWeightRows([sample()]);
  assert(rows.length === 1, 'one row');
  assert(rows[0].kind === 'weight', 'kind is weight');
  assert(rows[0].unit === 'kg', 'stored in kilograms whatever the user reads');
  assert(rows[0].value === 82.3, 'the value is not rounded on the way in');
  assert(rows[0].takenAt === NOW, 'the row is dated when the sample was taken');
  assert(rows[0].sourceId === 'hk-1', 'the uuid is the dedupe key');
});

test('the exact bounds are kept, because they are weights a body has', () => {
  const rows = toWeightRows([
    sample({ uuid: 'a', quantity: HEALTH_WEIGHT_KG.min }),
    sample({ uuid: 'b', quantity: HEALTH_WEIGHT_KG.max }),
  ]);
  assert(rows.length === 2, `expected 2 rows, received ${rows.length}`);
});

test('a weight no body has is dropped rather than drawn on the chart', () => {
  const rows = toWeightRows([
    sample({ uuid: 'a', quantity: HEALTH_WEIGHT_KG.min - 0.1 }),
    sample({ uuid: 'b', quantity: HEALTH_WEIGHT_KG.max + 0.1 }),
    sample({ uuid: 'c', quantity: 0 }),
    sample({ uuid: 'd', quantity: -70 }),
  ]);
  assert(rows.length === 0, `expected 0 rows, received ${rows.length}`);
});

test('a quantity that is not a number is dropped', () => {
  const rows = toWeightRows([
    sample({ uuid: 'a', quantity: Number.NaN }),
    sample({ uuid: 'b', quantity: Number.POSITIVE_INFINITY }),
  ]);
  assert(rows.length === 0, `expected 0 rows, received ${rows.length}`);
});

test('a date that is not a date is dropped', () => {
  const rows = toWeightRows([
    sample({ uuid: 'a', startDate: new Date('nonsense') }),
    // The bridge can hand back anything, whatever the type says it hands back.
    sample({ uuid: 'b', startDate: undefined as unknown as Date }),
    sample({ uuid: 'c', startDate: String(NOW) as unknown as Date }),
  ]);
  assert(rows.length === 0, `expected 0 rows, received ${rows.length}`);
});

test('a sample with no uuid is dropped, because the index cannot dedupe it', () => {
  const rows = toWeightRows([
    sample({ uuid: '' }),
    sample({ uuid: undefined as unknown as string }),
  ]);
  assert(rows.length === 0, `expected 0 rows, received ${rows.length}`);
});

test('the good samples survive a bad one beside them', () => {
  const rows = toWeightRows([
    sample({ uuid: 'a', quantity: 81 }),
    sample({ uuid: 'bad', quantity: 900 }),
    sample({ uuid: 'b', quantity: 83 }),
  ]);
  assert(rows.length === 2, `expected 2 rows, received ${rows.length}`);
  assert(rows[0].sourceId === 'a' && rows[1].sourceId === 'b', 'the order Health gave is kept');
});

test('a first read has no timestamp, so it reads the whole history', () => {
  assert(readWindowStart(null, NOW) === null);
});

test('a later read opens its window a month before the last one', () => {
  assert(readWindowStart(NOW - DAY, NOW) === NOW - DAY - READ_OVERLAP_MS);
});

test('a timestamp from ahead of now reads the whole history rather than a future window', () => {
  assert(readWindowStart(NOW + DAY, NOW) === null);
});

test('a timestamp that is not a number reads the whole history', () => {
  assert(readWindowStart(Number.NaN, NOW) === null);
});

test('the newest row is found wherever it sits in the batch', () => {
  const rows = toWeightRows([
    sample({ uuid: 'old', quantity: 81, startDate: new Date(NOW - 5 * DAY) }),
    sample({ uuid: 'new', quantity: 83, startDate: new Date(NOW) }),
    sample({ uuid: 'mid', quantity: 82, startDate: new Date(NOW - DAY) }),
  ]);
  assert(newestRow(rows)?.sourceId === 'new', 'the batch order does not decide the newest');
});

test('an empty batch has no newest row, which is how an empty read is told apart', () => {
  assert(newestRow([]) === null);
});

console.log('13 health-weight tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
