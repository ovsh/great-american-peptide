// The rules that arrived with an editable shot.
//
// Both are one line inside a screen and both are wrong in a way nobody sees, so
// they live out here with a test beside them.
//
// The first decides what happens to the site when an edit moves a shot to
// another medication. The second decides which shots Today celebrates, a
// question that had an obvious answer right up until a shot could land on today
// without being new.

import { isSameDay } from 'date-fns';

import type { InjectionRow } from '../db/types';
import { getBodySite } from './bodySites';
import type { Route } from './peptides';

/**
 * The site, when the route still offers it, and null when it does not.
 *
 * Every site names the routes it takes: an abdomen is subcutaneous, an outer
 * thigh is intramuscular, and an anterior thigh takes either. So a shot moved
 * from a subcutaneous medication to an intramuscular one keeps the thigh and
 * loses the abdomen. An id no site answers to is dropped as well, which is what
 * a site retired out of the catalogue looks like from here.
 *
 * This is the whole of what follows a medication change, along with the route
 * that drives it. The dose and the unit stay where the user typed them.
 */
export function siteOnRoute(siteId: string | null, route: Route): string | null {
  if (!siteId) return null;
  return getBodySite(siteId)?.routes.includes(route) ? siteId : null;
}

export interface ShotIds {
  /** Every shot the load returned, whatever day it falls on. */
  all: Set<string>;
  /** The ones among them given today. */
  today: Set<string>;
}

/**
 * Every shot on file by id, and the ones among them given today, across every
 * medication.
 *
 * Two sets out of one pass, because the celebration needs both of them.
 */
export function shotIds(
  injections: Readonly<Record<string, readonly InjectionRow[]>>,
  now: number,
): ShotIds {
  const all = new Set<string>();
  const today = new Set<string>();
  for (const rows of Object.values(injections)) {
    for (const row of rows) {
      all.add(row.id);
      if (isSameDay(row.taken_at, now)) today.add(row.id);
    }
  }
  return { all, today };
}

/**
 * True when a shot dated today is one the screen has never seen.
 *
 * `seen` is every id of the load before this one, not only that load's today.
 * The wide memory is the point: an edit that moves Tuesday's shot onto today
 * puts an id into today that was not there before, and a memory of today alone
 * reads that as a fresh shot and throws the party over a correction. The id has
 * been on file since Tuesday, so a memory of every id knows better. A new shot
 * carries a new id, and nothing else does.
 *
 * A null memory is the first load, which celebrates nothing: a user opening the
 * app on a day they already logged is not logging anything.
 */
export function hasNewTodayShot(
  seen: ReadonlySet<string> | null,
  today: ReadonlySet<string>,
): boolean {
  if (seen === null) return false;
  for (const id of today) {
    if (!seen.has(id)) return true;
  }
  return false;
}
