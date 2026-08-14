import { bodySites, type BodySite, type Region } from './bodySites';
import type { Route } from './peptides';

export interface RotationHistoryEntry {
  siteId: string;
  takenAt: number;
}

export function recommendNextSite(
  history: RotationHistoryEntry[],
  route: Route,
  region?: Region,
): BodySite | undefined {
  const lastUsedAt = new Map<string, number>();
  for (const h of history) {
    const cur = lastUsedAt.get(h.siteId);
    if (!cur || h.takenAt > cur) lastUsedAt.set(h.siteId, h.takenAt);
  }

  // A site the diagram offers is not always a site Poke puts forward. The
  // buttock takes a subcutaneous injection and the diagram offers it, because
  // users asked for it, but no GLP-1 label describes a shot there, so Poke does
  // not name it "Suggested" over a site the label does describe. A user who has
  // already used it has answered that question themselves, and the site rejoins
  // the rotation, because a site in use and out of the rotation is the one way
  // this rule could send a user back to the same spot.
  const candidates = bodySites.filter((s) => {
    if (!s.routes.includes(route)) return false;
    if (region && s.region !== region) return false;
    return (s.suggestRoutes ?? s.routes).includes(route) || lastUsedAt.has(s.id);
  });
  if (candidates.length === 0) return undefined;

  let best: BodySite | undefined;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const last = lastUsedAt.get(c.id);
    const score = last == null ? Infinity : Date.now() - last;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
