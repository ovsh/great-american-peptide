import type { InjectionRow } from '../db/types.ts';
import { bodySites } from './bodySites.ts';
import type { Route } from './peptides.ts';
import { hasNewTodayShot, shotIds, siteOnRoute } from './shotEdit.ts';

process.env.TZ = 'America/Chicago';

const NOW = new Date(2026, 7, 13, 9, 0, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const ROUTES: Route[] = ['sc', 'im'];

// Read out of the catalogue rather than written down here, so a site that
// changes routes moves this test with it instead of breaking it.
const scOnly = bodySites.find((site) => site.routes.includes('sc') && !site.routes.includes('im'));
const bothRoutes = bodySites.find((site) => site.routes.includes('sc') && site.routes.includes('im'));

/* ── the site rule ────────────────────────────────────────────────────── */

test('the catalogue still holds both kinds of site, or the rule below proves nothing', () => {
  assert(scOnly !== undefined, 'a site that takes one route only');
  assert(bothRoutes !== undefined, 'a site that takes either route');
});

test('a site the new route does not offer is dropped', () => {
  assert(siteOnRoute(scOnly!.id, 'im') === null, `${scOnly!.label} is not an intramuscular site`);
});

test('a site the new route offers is kept exactly as the user left it', () => {
  assert(siteOnRoute(bothRoutes!.id, 'im') === bothRoutes!.id, 'kept on im');
  assert(siteOnRoute(bothRoutes!.id, 'sc') === bothRoutes!.id, 'kept on sc');
});

test('a shot with no site keeps having no site', () => {
  assert(siteOnRoute(null, 'sc') === null);
});

test('an id no site answers to is dropped rather than saved back', () => {
  assert(siteOnRoute('belly_upper_middle_left', 'sc') === null, 'a retired or misspelled id');
});

test('every site the rule keeps is a site that route can reach', () => {
  for (const site of bodySites) {
    for (const route of ROUTES) {
      const kept = siteOnRoute(site.id, route);
      assert(
        kept === null || bodySites.find((s) => s.id === kept)?.routes.includes(route) === true,
        `${site.label} on ${route}`,
      );
    }
  }
});

/* ── which shots are on file, and which are today's ───────────────────── */

test('a day with nothing on it has no ids at all', () => {
  const ids = shotIds({}, NOW);
  assert(ids.all.size === 0 && ids.today.size === 0);
});

test('every medication is read, and today is separated from the rest', () => {
  const ids = shotIds(
    {
      med_a: [shot('a1', NOW), shot('a2', NOW - 3 * DAY)],
      med_b: [shot('b1', NOW - 60 * 1000)],
    },
    NOW,
  );
  assert(ids.all.size === 3, `expected 3 ids on file, received ${ids.all.size}`);
  assert(ids.today.size === 2, `expected 2 ids today, received ${ids.today.size}`);
  assert(ids.today.has('a1') && ids.today.has('b1'), 'both of today have their id');
  assert(!ids.today.has('a2'), 'a shot from Sunday is not today');
});

test('a shot later the same day counts as today, whatever the hour', () => {
  const ids = shotIds({ med_a: [shot('late', NOW + 12 * 60 * 60 * 1000)] }, NOW);
  assert(ids.today.has('late'), 'nine in the morning and nine at night are one day');
});

/* ── what Today celebrates ────────────────────────────────────────────── */

test('the first load celebrates nothing, because it remembers nothing', () => {
  assert(hasNewTodayShot(null, new Set(['a1'])) === false);
});

test('a shot the screen has never seen, dated today, is a shot just logged', () => {
  assert(hasNewTodayShot(new Set(['old']), new Set(['old', 'new'])) === true);
});

test('a load that brings nothing new celebrates nothing', () => {
  assert(hasNewTodayShot(new Set(['a1']), new Set(['a1'])) === false);
});

test('a day with no shots on it celebrates nothing', () => {
  assert(hasNewTodayShot(new Set(['a1']), new Set()) === false);
});

test('an edit that moves an old shot onto today is a correction, not a shot', () => {
  // The load before the edit: one shot from three days back, one logged today.
  const before = shotIds({ med_a: [shot('old', NOW - 3 * DAY), shot('today', NOW)] }, NOW);
  assert(hasNewTodayShot(null, before.today) === false, 'the first load is quiet');
  // The user opens that older shot and dates it today. Same row, same id.
  const after = shotIds({ med_a: [shot('old', NOW), shot('today', NOW)] }, NOW);
  assert(after.today.size === 2, 'the edited shot does now fall on today');
  assert(
    hasNewTodayShot(before.all, after.today) === false,
    'a shot that was already on file is not a shot the user just gave',
  );
});

test('a shot logged right after that edit still gets its celebration', () => {
  const before = shotIds({ med_a: [shot('old', NOW)] }, NOW);
  const after = shotIds({ med_a: [shot('old', NOW), shot('fresh', NOW)] }, NOW);
  assert(hasNewTodayShot(before.all, after.today) === true, 'the new id is the whole signal');
});

test('an edit that moves a shot off today does not celebrate either', () => {
  const before = shotIds({ med_a: [shot('a1', NOW)] }, NOW);
  const after = shotIds({ med_a: [shot('a1', NOW - DAY)] }, NOW);
  assert(after.today.size === 0, 'the shot left today');
  assert(hasNewTodayShot(before.all, after.today) === false);
});

console.log('16 shot-edit tests passed.');

function shot(id: string, takenAt: number): InjectionRow {
  return {
    id,
    medication_id: 'med_a',
    dose: 0.5,
    unit: 'mg',
    route: 'sc',
    site_id: null,
    taken_at: takenAt,
    scheduled_at: null,
    notes: null,
    deleted_at: null,
    created_at: takenAt,
  };
}

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
