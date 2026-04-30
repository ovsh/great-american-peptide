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
  const candidates = bodySites.filter(
    (s) => s.routes.includes(route) && (!region || s.region === region),
  );
  if (candidates.length === 0) return undefined;

  const lastUsedAt = new Map<string, number>();
  for (const h of history) {
    const cur = lastUsedAt.get(h.siteId);
    if (!cur || h.takenAt > cur) lastUsedAt.set(h.siteId, h.takenAt);
  }

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
