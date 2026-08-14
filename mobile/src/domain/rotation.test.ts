import { bodySites } from './bodySites.ts';
import { recommendNextSite, type RotationHistoryEntry } from './rotation.ts';

const DAY = 24 * 60 * 60 * 1000;

// Read out of the catalogue rather than written down here, so a site that
// changes routes moves this test with it instead of breaking it.
const offeredNotSuggested = bodySites.filter(
  (site) => site.routes.includes('sc') && !(site.suggestRoutes ?? site.routes).includes('sc'),
);
const suggestedOnSc = bodySites.filter((site) =>
  (site.suggestRoutes ?? site.routes).includes('sc'),
);

/* ── what the rotation puts forward ───────────────────────────────────── */

test('the catalogue still holds a site offered on one route and not put forward on it', () => {
  assert(offeredNotSuggested.length > 0, 'at least one site the diagram offers and Poke does not');
  assert(suggestedOnSc.length > 0, 'and sites Poke does put forward');
});

test('a fresh subcutaneous rotation never lands on a site the labels do not name', () => {
  // Twice around the whole subcutaneous catalogue, each pick fed back as
  // history exactly as a logged shot would be. A site outside the labels has
  // to stay out for the whole run, not only the first pick.
  const history: RotationHistoryEntry[] = [];
  const now = Date.UTC(2026, 7, 13);
  for (let index = 0; index < suggestedOnSc.length * 2; index++) {
    const site = recommendNextSite(history, 'sc');
    assert(site !== undefined, `pick ${index} exists`);
    assert(
      (site!.suggestRoutes ?? site!.routes).includes('sc'),
      `${site!.label} is put forward on a subcutaneous shot`,
    );
    history.push({ siteId: site!.id, takenAt: now + index * DAY });
  }
});

test('the same site is put forward on the route it does cover', () => {
  const seen = new Set<string>();
  const history: RotationHistoryEntry[] = [];
  const now = Date.UTC(2026, 7, 13);
  const imSites = bodySites.filter((site) => site.routes.includes('im'));
  for (let index = 0; index < imSites.length; index++) {
    const site = recommendNextSite(history, 'im');
    assert(site !== undefined, `pick ${index} exists`);
    seen.add(site!.id);
    history.push({ siteId: site!.id, takenAt: now + index * DAY });
  }
  for (const site of offeredNotSuggested) {
    assert(seen.has(site.id), `${site.label} is put forward on an intramuscular shot`);
  }
});

test('a site the user has already used rejoins the subcutaneous rotation', () => {
  // The user answered the question themselves by injecting there. A site in
  // use and out of the rotation is the one way this rule could send somebody
  // back to the same spot, so use re-admits it.
  const rested = offeredNotSuggested[0]!;
  const now = Date.now();
  const history: RotationHistoryEntry[] = suggestedOnSc.map((site, index) => ({
    siteId: site.id,
    takenAt: now - index * 1000,
  }));
  history.push({ siteId: rested.id, takenAt: now - 90 * DAY });

  const site = recommendNextSite(history, 'sc');
  assert(site?.id === rested.id, `${rested.label} is due again, and got ${site?.label}`);
});

/* ── the rest of the rule, unchanged by the above ─────────────────────── */

test('the longest rested site wins over one used yesterday', () => {
  const now = Date.now();
  const [first, second] = suggestedOnSc;
  const history: RotationHistoryEntry[] = suggestedOnSc.map((site) => ({
    siteId: site.id,
    takenAt: site.id === first!.id ? now - 60 * DAY : now - DAY,
  }));
  assert(recommendNextSite(history, 'sc')?.id === first!.id, 'the rested one');
  assert(second !== undefined, 'the catalogue holds more than one');
});

test('the newest entry for a site is the one that counts', () => {
  const now = Date.now();
  const [first, ...others] = suggestedOnSc;
  const history: RotationHistoryEntry[] = others.map((site) => ({
    siteId: site.id,
    takenAt: now - DAY,
  }));
  // Out of order on purpose: an old row must not make a fresh site look rested.
  history.push({ siteId: first!.id, takenAt: now - 90 * DAY });
  history.push({ siteId: first!.id, takenAt: now });
  assert(recommendNextSite(history, 'sc')?.id !== first!.id, 'the fresh one waits its turn');
});

test('a region with no site on the route gives no answer', () => {
  assert(recommendNextSite([], 'sc', 'glute') === undefined, 'no glute on a fresh sc rotation');
  assert(recommendNextSite([], 'im', 'belly') === undefined, 'no belly on an im rotation');
});

test('a region that does hold sites answers inside it', () => {
  const site = recommendNextSite([], 'sc', 'belly');
  assert(site?.region === 'belly', `stayed in the belly, and got ${site?.label}`);
});

console.log('8 rotation tests passed.');

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
