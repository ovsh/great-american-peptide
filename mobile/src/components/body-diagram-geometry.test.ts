import { bodySites, type BodySite, type View as BodyView } from '../domain/bodySites.ts';
import type { Route } from '../domain/peptides.ts';
import {
  DOT_RADIUS_VB,
  TAP_RADIUS_VB,
  VIEWBOX,
  diagramLayout,
  dotCenter,
  dotSize,
  nearestDot,
  tapPointFrom,
  type DiagramLayout,
  type Point,
} from './body-diagram-geometry.ts';

// The two sizes the log screen hands the diagram: 17 % of the window height for
// the width, twice that for the height. REAL is an iPhone 16 Pro, SMALL is the
// floor the sizing clamps to on the shortest phone.
const REAL = { width: 149, height: 298 };
const SMALL = { width: 110, height: 220 };
const LARGE = { width: 298, height: 596 };
const VIEWS: readonly BodyView[] = ['front', 'back'];
const ROUTES: readonly Route[] = ['sc', 'im'];

test('every visible site answers to a tap on its own centre, at the size the log screen draws', () => {
  everySiteAnswersToItself(REAL.width, REAL.height);
});

test('every visible site answers to a tap on its own centre, on a diagram twice the size', () => {
  everySiteAnswersToItself(LARGE.width, LARGE.height);
});

test('every visible site answers to a tap on its own centre, at the smallest size drawn', () => {
  everySiteAnswersToItself(SMALL.width, SMALL.height);
});

test('two drawn dots never touch, on any view a route puts them on together', () => {
  const { gap, pair } = closestDrawnPair();
  assert(gap > DOT_RADIUS_VB * 2, `${pair} sit ${gap} units apart, and two dots span ${DOT_RADIUS_VB * 2}`);
});

test('a dot is drawn big enough to read as a target at the size the log screen draws', () => {
  // The surface answers a tap from 24 units out, but the dot is the only part
  // of that the eye can see, so a dot the size of a full stop asks for a care
  // the diagram does not need. This is the floor that keeps the two honest.
  const drawn = dotSize(diagramLayout(REAL.width, REAL.height));
  assert(drawn >= 12, `a dot is drawn ${drawn.toFixed(1)} pt across`);
  const smallest = dotSize(diagramLayout(SMALL.width, SMALL.height));
  assert(smallest >= 9, `on the shortest phone a dot is drawn ${smallest.toFixed(1)} pt across`);
});

test('a box taller than 1:2 letterboxes the body, and the sites follow the drawing', () => {
  // The log screen asks for exactly 1:2, so this is the box a caller who does
  // not gets, and the sites have to follow the drawing rather than the box.
  const tall = 400;
  const layout = diagramLayout(REAL.width, tall);
  assert(layout.offsetY === (tall - VIEWBOX.height * layout.scale) / 2, 'the spare height is split above and below');
  assert(layout.offsetY > 0, 'there is spare height to split');
  const thigh = site('thigh_left_front');
  const drawn = dotCenter(thigh, layout);
  assert(
    Math.abs(drawn.y - thigh.y * tall) > 1,
    'the drawing does not stretch, so `y * height` is the wrong answer here',
  );
  everySiteAnswersToItself(REAL.width, tall);
});

test('the back view offers four subcutaneous sites, the two glutes included', () => {
  const ids = visibleSites('back', 'sc').map((s) => s.id);
  assert(ids.length === 4, `expected 4 sites, received ${ids.length}`);
  assert(ids.includes('glute_left_back') && ids.includes('glute_right_back'), 'both glutes are reachable');
});

test('a tap far from every dot selects nothing', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const front = visibleSites('front', 'sc');
  assert(nearestDot(front, atViewBox(50, 12, layout), layout) === null, 'the head is not a site');
  assert(nearestDot(front, atViewBox(50, 190, layout), layout) === null, 'the ankles are not a site');
  assert(nearestDot(front, atViewBox(2, 2, layout), layout) === null, 'the margin beside the body is not a site');
  const back = visibleSites('back', 'sc');
  assert(nearestDot(back, atViewBox(50, 12, layout), layout) === null, 'the back of the head is not a site');
});

test('the seam between two side-by-side dots sits halfway between them', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const front = visibleSites('front', 'sc');
  // The two upper abdomen sites, 16 viewBox units apart with the navel between.
  assert(nearestDot(front, atViewBox(49.5, 84, layout), layout)?.id === 'belly_upper_left', 'left of the seam');
  assert(nearestDot(front, atViewBox(50.5, 84, layout), layout)?.id === 'belly_upper_right', 'right of the seam');
});

test('the seam between two dots on a diagonal sits halfway between them', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const front = visibleSites('front', 'sc');
  // Upper left abdomen at (42, 84) and the left flank at (32, 100).
  assert(nearestDot(front, atViewBox(38, 90, layout), layout)?.id === 'belly_upper_left', 'the upper half of the seam');
  assert(nearestDot(front, atViewBox(36, 94, layout), layout)?.id === 'belly_mid_left', 'the lower half of the seam');
});

test('a tap on the seam itself takes a site, and an exact tie takes the earlier one', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const front = visibleSites('front', 'sc');
  const onTheSeam = nearestDot(front, atViewBox(50, 84, layout), layout)?.id;
  assert(
    onTheSeam === 'belly_upper_left' || onTheSeam === 'belly_upper_right',
    `the seam reports one of the two, received ${onTheSeam ?? 'nothing'}`,
  );
  // No two real sites are ever exactly equidistant, because the halves of the
  // body land on either side of a float. Two dots in one place is the only
  // exact tie, and list order breaks it.
  const twins = [{ id: 'first', x: 0.5, y: 0.5 }, { id: 'second', x: 0.5, y: 0.5 }];
  assert(nearestDot(twins, atViewBox(50, 100, layout), layout)?.id === 'first', 'the tie is broken by list order');
});

test('the last dot inside the reach wins, and one step further selects nothing', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const thighs = visibleSites('front', 'im');
  const reach = TAP_RADIUS_VB - 0.5;
  // Straight down from the left outer thigh at (24, 132).
  assert(nearestDot(thighs, atViewBox(24, 132 + reach, layout), layout)?.id === 'thigh_left_outer', 'inside the reach');
  assert(nearestDot(thighs, atViewBox(24, 132 + TAP_RADIUS_VB + 0.5, layout), layout) === null, 'past the reach');
});

test('a diagram with no size selects nothing rather than dividing by zero', () => {
  for (const [width, height] of [[0, 0], [119, 0], [Number.NaN, 238], [-119, -238]]) {
    const layout = diagramLayout(width, height);
    assert(layout.scale === 0, `expected no scale for ${width} x ${height}`);
    assert(nearestDot(visibleSites('front', 'sc'), { x: 50, y: 100 }, layout) === null, 'and no site');
  }
});

test('a press that reports no coordinates selects nothing', () => {
  const layout = diagramLayout(REAL.width, REAL.height);
  const front = visibleSites('front', 'sc');
  assert(nearestDot(front, { x: Number.NaN, y: 100 }, layout) === null, 'a tap with no x');
  assert(nearestDot([], { x: 50, y: 100 }, layout) === null, 'a view with no sites');
});

test('a press is read from a phone touch and from a web click alike', () => {
  assert(pointsMatch(tapPointFrom({ locationX: 12, locationY: 34 }), { x: 12, y: 34 }), 'React Native fills locationX');
  assert(pointsMatch(tapPointFrom({ offsetX: 12, offsetY: 34 }), { x: 12, y: 34 }), 'the web click fills offsetX');
  assert(pointsMatch(tapPointFrom({ locationX: 12, locationY: 34, offsetX: 99, offsetY: 99 }), { x: 12, y: 34 }), 'the touch wins');
  // A press with the coordinates at zero is the top left corner, not a miss.
  assert(pointsMatch(tapPointFrom({ locationX: 0, locationY: 0 }), { x: 0, y: 0 }), 'zero is a place');
  assert(tapPointFrom({}) === null, 'a payload with neither pair says nothing');
  assert(tapPointFrom({ locationX: Number.NaN, locationY: 4 }) === null, 'a payload that is not a number says nothing');
});

console.log('15 body-diagram geometry tests passed.');

/**
 * The two dots the diagram ever draws closest together, in viewBox units.
 *
 * Read off the catalogue rather than written down, so a site moved or added
 * answers here rather than in a bug report about one dot covering another.
 */
function closestDrawnPair(): { gap: number; pair: string } {
  let gap = Number.POSITIVE_INFINITY;
  let pair = 'no pair';
  for (const view of VIEWS) {
    for (const route of ROUTES) {
      const visible = visibleSites(view, route);
      for (let i = 0; i < visible.length; i += 1) {
        for (let j = i + 1; j < visible.length; j += 1) {
          const a = visible[i]!;
          const b = visible[j]!;
          const dx = (a.x - b.x) * VIEWBOX.width;
          const dy = (a.y - b.y) * VIEWBOX.height;
          const distance = Math.hypot(dx, dy);
          if (distance < gap) {
            gap = distance;
            pair = `${a.id} and ${b.id}`;
          }
        }
      }
    }
  }
  return { gap, pair };
}

function everySiteAnswersToItself(width: number, height: number) {
  const layout = diagramLayout(width, height);
  for (const view of VIEWS) {
    for (const route of ROUTES) {
      const visible = visibleSites(view, route);
      assert(visible.length > 0, `${view} ${route} draws at least one site`);
      for (const target of visible) {
        const hit = nearestDot(visible, dotCenter(target, layout), layout);
        assert(
          hit?.id === target.id,
          `${width}x${height} ${view} ${route}: a tap on ${target.id} answered ${hit?.id ?? 'nothing'}`,
        );
      }
    }
  }
}

function visibleSites(view: BodyView, route: Route): BodySite[] {
  return bodySites.filter((s) => s.view === view && s.routes.includes(route));
}

function site(id: string): BodySite {
  const found = bodySites.find((s) => s.id === id);
  if (!found) throw new Error(`FAIL: no site ${id}`);
  return found;
}

/** A press at a point named in viewBox units, which is how the sites are named. */
function atViewBox(x: number, y: number, layout: DiagramLayout): Point {
  return { x: layout.offsetX + x * layout.scale, y: layout.offsetY + y * layout.scale };
}

function pointsMatch(actual: Point | null, expected: Point): boolean {
  return actual !== null && actual.x === expected.x && actual.y === expected.y;
}

function assert(value: boolean, label = 'assertion') {
  if (!value) throw new Error(`FAIL: ${label}`);
}

function test(name: string, body: () => void) {
  body();
  console.log(`PASS ${name}`);
}
