// Body site catalog for SC + IM injection rotation.
// Coordinates are normalized 0–1 within each diagram view (front or back).

import type { Route } from './peptides';

export type Region = 'belly' | 'shoulder' | 'thigh' | 'glute';
export type Side = 'left' | 'right' | 'center';
export type View = 'front' | 'back';

export interface BodySite {
  id: string;
  region: Region;
  side: Side;
  view: View;
  routes: Route[];
  /**
   * The routes Poke proposes this site for on its own. Absent means every route
   * in `routes`, which is the case for all but the glutes.
   *
   * A site Poke offers is not always a site Poke puts forward. The rotation
   * names one site as "Suggested", and that is Poke speaking, so it stays
   * inside what the labels describe.
   */
  suggestRoutes?: Route[];
  label: string;
  // Normalized coordinates within the body diagram viewBox (0–1)
  x: number;
  y: number;
}

// Coordinates are normalized 0–1 within a 100x200 body diagram viewBox.
// Y axis: 0=crown, ~0.22=deltoid, ~0.42=upper abdomen, ~0.50=navel, ~0.65=mid-thigh, ~1.0=sole.
export const bodySites: BodySite[] = [
  // Belly — front, SC. Six-site grid around the navel: upper / mid (flanks) / lower.
  { id: 'belly_upper_left',  region: 'belly', side: 'left',  view: 'front', routes: ['sc'], label: 'Upper left abdomen',  x: 0.42, y: 0.42 },
  { id: 'belly_upper_right', region: 'belly', side: 'right', view: 'front', routes: ['sc'], label: 'Upper right abdomen', x: 0.58, y: 0.42 },
  { id: 'belly_mid_left',    region: 'belly', side: 'left',  view: 'front', routes: ['sc'], label: 'Left flank',           x: 0.32, y: 0.50 },
  { id: 'belly_mid_right',   region: 'belly', side: 'right', view: 'front', routes: ['sc'], label: 'Right flank',          x: 0.68, y: 0.50 },
  { id: 'belly_lower_left',  region: 'belly', side: 'left',  view: 'front', routes: ['sc'], label: 'Lower left abdomen',  x: 0.42, y: 0.58 },
  { id: 'belly_lower_right', region: 'belly', side: 'right', view: 'front', routes: ['sc'], label: 'Lower right abdomen', x: 0.58, y: 0.58 },

  // Shoulder — front + back, SC (deltoid)
  { id: 'shoulder_left_front',  region: 'shoulder', side: 'left',  view: 'front', routes: ['sc'], label: 'Left shoulder',  x: 0.16, y: 0.22 },
  { id: 'shoulder_right_front', region: 'shoulder', side: 'right', view: 'front', routes: ['sc'], label: 'Right shoulder', x: 0.84, y: 0.22 },
  { id: 'shoulder_left_back',   region: 'shoulder', side: 'left',  view: 'back',  routes: ['sc', 'im'], label: 'Left posterior shoulder',  x: 0.16, y: 0.22 },
  { id: 'shoulder_right_back',  region: 'shoulder', side: 'right', view: 'back',  routes: ['sc', 'im'], label: 'Right posterior shoulder', x: 0.84, y: 0.22 },

  // Thigh — front, SC + IM (vastus lateralis)
  { id: 'thigh_left_front',  region: 'thigh', side: 'left',  view: 'front', routes: ['sc', 'im'], label: 'Left anterior thigh',  x: 0.36, y: 0.66 },
  { id: 'thigh_right_front', region: 'thigh', side: 'right', view: 'front', routes: ['sc', 'im'], label: 'Right anterior thigh', x: 0.64, y: 0.66 },
  { id: 'thigh_left_outer',  region: 'thigh', side: 'left',  view: 'front', routes: ['im'], label: 'Left outer thigh',  x: 0.24, y: 0.66 },
  { id: 'thigh_right_outer', region: 'thigh', side: 'right', view: 'front', routes: ['im'], label: 'Right outer thigh', x: 0.76, y: 0.66 },

  // Glute — back, SC + IM (dorsogluteal / ventrogluteal).
  //
  // SC as well as IM: the buttock is a recognized subcutaneous site in standard
  // injection teaching, insulin included. The GLP-1 labels are narrower and name
  // only the abdomen, the thigh and the upper arm, so Ozempic, Wegovy and
  // Mounjaro do not describe a shot here. Poke offers the site because users
  // asked for it, and `suggestRoutes` keeps Poke from putting it forward on a
  // subcutaneous shot the labels do not cover.
  //
  // Every preset ships `defaultRoute: 'sc'`, so an IM-only row was a dot the
  // diagram filtered out and nobody could reach.
  { id: 'glute_left_back',  region: 'glute', side: 'left',  view: 'back', routes: ['sc', 'im'], suggestRoutes: ['im'], label: 'Left glute',  x: 0.38, y: 0.58 },
  { id: 'glute_right_back', region: 'glute', side: 'right', view: 'back', routes: ['sc', 'im'], suggestRoutes: ['im'], label: 'Right glute', x: 0.62, y: 0.58 },
];

export function getBodySite(id: string): BodySite | undefined {
  return bodySites.find((s) => s.id === id);
}

export function bodySitesFor(view: View, region: Region, route: Route): BodySite[] {
  return bodySites.filter(
    (s) => s.view === view && s.region === region && s.routes.includes(route),
  );
}

export function regionsForRoute(route: Route): Region[] {
  const set = new Set<Region>();
  for (const s of bodySites) if (s.routes.includes(route)) set.add(s.region);
  return Array.from(set);
}
