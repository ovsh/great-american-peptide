// Where the body diagram draws each site, and which site a tap means.
//
// No React Native import, so `npx tsx src/components/body-diagram-geometry.test.ts`
// runs the whole thing. `BodyDiagram.tsx` draws the picture and owns nothing else.
//
// A 44 pt box per site does not fit this diagram. The log screen sizes it to
// about 149 x 298 pt on an iPhone 16 Pro, which puts the two dots on one thigh
// about 18 pt apart, so the boxes overlapped and the last one rendered swallowed
// its neighbours: six of the ten front subcutaneous sites answered to the wrong
// dot. One surface that resolves a tap to the nearest dot gives every dot a fair
// share of the diagram at any size, and it cannot overlap by construction.

/** The drawing's own coordinate space. `BodyDiagram` passes it to the `viewBox`. */
export const VIEWBOX = { width: 100, height: 200 } as const;

/**
 * The radius of a plain site dot, in viewBox units.
 *
 * The dot is the only part of the target the eye can see. The surface below it
 * answers a tap from much further out, so a dot drawn small tells the finger the
 * target is small and invites the careful, slow tap the picture does not need.
 * The ceiling is the closest pair the diagram ever draws together: the outer and
 * the anterior thigh on one leg, 12 units apart on the front view of an
 * intramuscular shot. Two of these leave 3.2 units of daylight between them, and
 * the test holds the catalogue to it.
 */
export const DOT_RADIUS_VB = 4.4;

/**
 * How far from a dot centre a tap still counts, in viewBox units.
 *
 * Twice the closest gap between two dots, so no reachable part of the torso or
 * the thighs falls outside every dot. At the size the log screen draws
 * (149 x 298 pt) that is about 36 pt: a tap anywhere on the torso or on a thigh
 * reaches a site, and a tap on the head, on a shin, or on the margin beside the
 * silhouette reaches none and selects nothing rather than the nearest wrong
 * thing.
 */
export const TAP_RADIUS_VB = 24;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A site as the geometry needs it: an id and its position, normalized 0–1. */
export interface DiagramDot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * How the viewBox maps onto the pixels the caller asked for.
 *
 * The SVG scales uniformly and centres what is left over (`xMidYMid meet`), so
 * a box that is not exactly 1:2 letterboxes the body rather than stretching it.
 * The old tap targets read `site.x * width`, which is only true at exactly 1:2
 * and drifts everywhere else.
 */
export interface DiagramLayout {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** An empty box draws nothing, so its scale is zero and every tap misses. */
const NO_LAYOUT: DiagramLayout = { scale: 0, offsetX: 0, offsetY: 0 };

export function diagramLayout(width: number, height: number): DiagramLayout {
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) {
    return NO_LAYOUT;
  }
  const scale = Math.min(width / VIEWBOX.width, height / VIEWBOX.height);
  return {
    scale,
    offsetX: (width - VIEWBOX.width * scale) / 2,
    offsetY: (height - VIEWBOX.height * scale) / 2,
  };
}

/** Where a dot is drawn, in the same points a press reports. */
export function dotCenter(dot: DiagramDot, layout: DiagramLayout): Point {
  return {
    x: layout.offsetX + dot.x * VIEWBOX.width * layout.scale,
    y: layout.offsetY + dot.y * VIEWBOX.height * layout.scale,
  };
}

/** The drawn diameter of a dot, in points. */
export function dotSize(layout: DiagramLayout): number {
  return DOT_RADIUS_VB * 2 * layout.scale;
}

/**
 * The dot a press at `point` means, or null when the press landed too far from
 * every one of them.
 *
 * Distances are measured in viewBox units, so the rule reads the same on a
 * 119 pt diagram and on a 400 pt one. A press exactly on the line between two
 * dots takes the earlier one in the list, which keeps the answer stable rather
 * than leaving a seam that reports nothing.
 */
export function nearestDot<T extends DiagramDot>(
  dots: readonly T[],
  point: Point,
  layout: DiagramLayout,
): T | null {
  if (layout.scale <= 0) return null;
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;

  const tapX = (point.x - layout.offsetX) / layout.scale;
  const tapY = (point.y - layout.offsetY) / layout.scale;

  let closest: T | null = null;
  let closestDistance = TAP_RADIUS_VB * TAP_RADIUS_VB;
  for (const dot of dots) {
    const dx = tapX - dot.x * VIEWBOX.width;
    const dy = tapY - dot.y * VIEWBOX.height;
    const distance = dx * dx + dy * dy;
    if (distance < closestDistance) {
      closest = dot;
      closestDistance = distance;
    }
  }
  return closest;
}

/**
 * A press payload, as far as this file reads it.
 *
 * React Native fills `locationX` and `locationY` on the touch. React Native Web
 * raises `onPress` from the DOM click instead, and its payload is a MouseEvent
 * carrying `offsetX` and `offsetY` against the same box. Reading both keeps one
 * press handler for the phone and for the web preview.
 */
export interface TapSource {
  readonly locationX?: number;
  readonly locationY?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
}

/** Where a press landed inside the pressed view, or null when it says nothing. */
export function tapPointFrom(event: TapSource): Point | null {
  const x = firstFinite(event.locationX, event.offsetX);
  const y = firstFinite(event.locationY, event.offsetY);
  return x === null || y === null ? null : { x, y };
}

function firstFinite(...values: readonly (number | undefined)[]): number | null {
  for (const value of values) if (isFiniteNumber(value)) return value;
  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
