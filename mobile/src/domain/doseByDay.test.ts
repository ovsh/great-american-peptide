// Tests for doseByDay.ts. Run with: npx tsx src/domain/doseByDay.test.ts

import {
  doseByDayLabel,
  doseForWeekday,
  doseOnDay,
  maxPlannedDose,
  parseDoseByDay,
  scheduledWeekdays,
  serializeDoseByDay,
  type DoseByDay,
} from './doseByDay.ts';
import { weekdayMask } from './scheduling.ts';

let passed = 0;

function assert(value: boolean, label: string) {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('parses a valid map', () => {
  const map = parseDoseByDay('{"1":6,"4":2}');
  assert(map !== null, 'map parses');
  assert(map?.[1] === 6, 'Monday reads 6');
  assert(map?.[4] === 2, 'Thursday reads 2');
});

test('reads null and garbage as null', () => {
  assert(parseDoseByDay(null) === null, 'null column');
  assert(parseDoseByDay('not json') === null, 'garbage text');
  assert(parseDoseByDay('[6,2]') === null, 'array shape');
  assert(parseDoseByDay('"6"') === null, 'bare string');
  assert(parseDoseByDay('{}') === null, 'empty object');
});

test('one bad entry reads the whole map as null', () => {
  assert(parseDoseByDay('{"1":6,"9":2}') === null, 'key off the week');
  assert(parseDoseByDay('{"1":6,"4":-2}') === null, 'negative dose');
  assert(parseDoseByDay('{"1":6,"4":0}') === null, 'zero dose');
  assert(parseDoseByDay('{"1":6,"4":"2"}') === null, 'string dose');
  assert(parseDoseByDay('{"1":null}') === null, 'null dose');
});

test('serializes round-trip and empty to null', () => {
  const raw = serializeDoseByDay({ 1: 6, 4: 2 });
  assert(raw !== null, 'map serializes');
  const back = parseDoseByDay(raw);
  assert(back?.[1] === 6 && back?.[4] === 2, 'round-trip holds');
  assert(serializeDoseByDay({}) === null, 'empty map is null');
});

test('falls back to the default dose on a day the map skips', () => {
  const map: DoseByDay = { 1: 6 };
  assert(doseForWeekday(map, 5, 1) === 6, 'mapped day');
  assert(doseForWeekday(map, 5, 4) === 5, 'unmapped day');
  assert(doseForWeekday(null, 5, 1) === 5, 'no map at all');
});

test('reads the dose off a timestamp', () => {
  // 2026-08-10 is a Monday, 2026-08-13 a Thursday.
  const monday = new Date(2026, 7, 10, 9, 0).getTime();
  const thursday = new Date(2026, 7, 13, 9, 0).getTime();
  const raw = '{"1":6,"4":2}';
  assert(doseOnDay(raw, 5, monday) === 6, 'Monday dose');
  assert(doseOnDay(raw, 5, thursday) === 2, 'Thursday dose');
  assert(doseOnDay(null, 5, monday) === 5, 'no map falls back');
});

test('reports the largest planned dose', () => {
  assert(maxPlannedDose('{"1":6,"4":2}', 3) === 6, 'map holds the max');
  assert(maxPlannedDose('{"1":1}', 3) === 3, 'default holds the max');
  assert(maxPlannedDose(null, 3) === 3, 'no map');
});

test('names the weekdays each schedule kind covers', () => {
  assert(scheduledWeekdays('weekly', 1).length === 1, 'weekly names one day');
  assert(scheduledWeekdays('weekly', null).length === 0, 'weekly without a day');
  assert(scheduledWeekdays('daily', null).length === 0, 'daily names none');
  assert(scheduledWeekdays('every_n_days', 3).length === 0, 'every_n_days names none');
  assert(scheduledWeekdays('custom', null).length === 0, 'custom names none');
});

test('twice weekly names both days in week order', () => {
  const fromMonday = scheduledWeekdays('twice_weekly', 1);
  assert(fromMonday.length === 2, 'two days');
  assert(fromMonday[0] === 1 && fromMonday[1] === 4, 'Monday then Thursday');
  // Friday's pair wraps to Monday, and Monday sorts first on screen.
  const fromFriday = scheduledWeekdays('twice_weekly', 5);
  assert(fromFriday[0] === 1 && fromFriday[1] === 5, 'Monday then Friday');
});

test('weekdays kind reads its mask', () => {
  const days = scheduledWeekdays('weekdays', weekdayMask([1, 3, 5]));
  assert(days.length === 3, 'three days');
  assert(days[0] === 1 && days[1] === 3 && days[2] === 5, 'Mon Wed Fri in order');
});

test('labels the plan as one line', () => {
  assert(
    doseByDayLabel({ 1: 6, 4: 2 }, 'mg') === '6.0 mg on Monday and 2.0 mg on Thursday',
    'two days',
  );
  assert(
    doseByDayLabel({ 1: 6, 3: 4, 5: 2 }, 'mg') ===
      '6.0 mg on Monday, 4.0 mg on Wednesday and 2.0 mg on Friday',
    'three days keep their commas',
  );
  assert(doseByDayLabel({ 1: 6 }, 'mg') === '6.0 mg on Monday', 'one day');
  assert(doseByDayLabel({}, 'mg') === '', 'empty map');
});

console.log(`${passed} doseByDay tests passed.`);
