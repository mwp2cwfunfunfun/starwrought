/**
 * Distance on the grid, the way the handbook measures it.
 *
 * Everything in STARWROUGHT is measured from the edge of one creature's space to the edge of the
 * other's, in whole squares, with diagonals exact (PHB v4.10, Measure: "the shortest gap between
 * the edges of your spaces, rounding up to the next foot; adjacent is 0"). "Adjacent" is a gap of
 * zero: the two spaces are touching, a corner included. One square between them is one foot. That
 * is a question about footprints, not about token centres, and this module answers it once so the
 * reach bands, the Unwieldy penalty, the Intercept trigger and anything else that needs a distance
 * all agree.
 */

/**
 * A token's footprint in whole grid cells.
 * @param {TokenDocument|{x: number, y: number, width: number, height: number}} doc
 * @returns {{c0: number, r0: number, c1: number, r1: number}}
 */
export function footprint(doc) {
  const size = canvas.scene.grid.size;
  const c0 = Math.round(doc.x / size);
  const r0 = Math.round(doc.y / size);
  const w = Math.max(1, Math.round(doc.width));
  const h = Math.max(1, Math.round(doc.height));
  return { c0, r0, c1: c0 + w - 1, r1: r0 + h - 1 };
}

/** Squares between two spans on one axis: zero when they touch or overlap. */
function axisGap(a0, a1, b0, b1) {
  return Math.max(0, b0 - a1 - 1, a0 - b1 - 1);
}

/**
 * The gap between two footprints, in cells, measured exactly across the diagonal.
 * A cell two across and one up from the edge of a space sits at the square root of five.
 */
export function cellGap(a, b) {
  return Math.hypot(axisGap(a.c0, a.c1, b.c0, b.c1), axisGap(a.r0, a.r1, b.r0, b.r1));
}

/**
 * The gap between two tokens in scene units, edge to edge.
 * @param {TokenDocument|{x: number, y: number, width: number, height: number}} docA
 * @param {TokenDocument|{x: number, y: number, width: number, height: number}} docB
 * @returns {number}  Feet, on the system's one-foot grid.
 */
export function gapBetween(docA, docB) {
  return cellGap(footprint(docA), footprint(docB)) * canvas.scene.grid.distance;
}

/**
 * The smallest gap, in feet, between a moving footprint and another token anywhere along a path.
 *
 * The Intercept trigger (PHB v4.10) is "a foe Moves from outside your Total Reach to inside it",
 * and the strike lands "at the moment they enter", so a Move that crosses a reach and leaves it
 * again still entered it. Each segment is sampled one grid cell at a time, which on a one-foot grid
 * is every foot of the path.
 *
 * @param {{width: number, height: number}} mover   The mover's footprint in cells.
 * @param {Array<{x: number, y: number}>} path      Top-left pixel positions, the start first.
 * @param {TokenDocument} other                     The token whose reach is in question.
 * @returns {number}  Feet. Infinity for an empty path.
 */
export function minGapAlongPath(mover, path, other) {
  const grid = canvas.scene.grid;
  const target = footprint(other);
  const at = (x, y) => cellGap(footprint({ x, y, width: mover.width, height: mover.height }), target) * grid.distance;

  let min = Infinity;
  for (let i = 0; i < path.length; i++) {
    const to = path[i];
    if (i === 0) {
      min = Math.min(min, at(to.x, to.y));
      continue;
    }
    const from = path[i - 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / grid.size));
    for (let s = 1; s <= steps; s++) {
      min = Math.min(min, at(from.x + (dx * s / steps), from.y + (dy * s / steps)));
    }
  }
  return min;
}
