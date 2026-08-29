/**
 * Reach, drawn on the map, in grid squares.
 *
 * Reach in STARWROUGHT is measured from the edge of your space to the edge of your target's, so
 * "adjacent" is a gap of zero feet and one intervening square is one foot. That makes reach a
 * question about squares rather than a radius, and the drawing follows: whole cells are lit, and
 * the outlines run along grid lines.
 *
 * Three bands, from the inside out:
 *
 *   Unwieldy   the inner dead zone of a long weapon. Unwieldy N means a penalty against anything
 *              within N feet, so it is drawn as a warning rather than as reach.
 *   Natural    what your body reaches, set by your Size. Faint, because it is always true.
 *   Total      Natural Reach plus the longest melee weapon in hand. This is the one that matters.
 *
 * The bands follow a token while it is being dragged, before the move is committed, so a player can
 * see what they would threaten from a square and stop there rather than spend a second action
 * fixing it. That is affordable because **the shape does not depend on where the token is**: it is
 * built once in the token's own cell coordinates and cached, and a drag only moves the container.
 * Dragging therefore costs one position write per frame, not a redraw, however long the reach is.
 */

import * as SW from "../config.mjs";

/**
 * The bands, innermost first. A cell is *filled* in the first band it belongs to, so the colours do
 * not stack into mud, but every band is *outlined* along its own edge whether or not anything was
 * filled inside it. That distinction matters: a longspear is Unwieldy 7 and your Natural Reach is
 * 2, so the natural ring sits wholly inside the unwieldy one and would otherwise disappear at
 * exactly the moment the map is busiest.
 */
const BANDS = {
  unwieldy: { color: 0xB4453F, fill: 0.16, line: 0.75, width: 2 },
  natural: { color: 0x7FB3C8, fill: 0.07, line: 0.7, width: 2 },
  total: { color: 0xE3B23C, fill: 0.08, line: 0.7, width: 2 }
};

/** A guard against a pathological reach painting half the scene. */
const MAX_CELLS = 4096;

/** The PIXI container the bands live in, one per canvas. */
let layer = null;

/** Token id -> the drawn bands and the signature they were drawn from. */
const drawn = new Map();

/** Register the hooks that keep the bands in step with the tokens. */
export function registerReachRings() {
  Hooks.on("canvasReady", () => { reset(); refresh(); });
  Hooks.on("controlToken", () => refresh());
  Hooks.on("hoverToken", () => refresh());
  Hooks.on("refreshToken", () => refresh());
  Hooks.on("updateActor", () => refresh());
  Hooks.on("updateItem", () => refresh());
  Hooks.on("deleteToken", () => refresh());

  // Dropping or cancelling a drag destroys the preview without necessarily refreshing the token it
  // came from, which would leave the bands standing where the drag ended. Settle them once the
  // button comes up, after Foundry has cleared the preview.
  document.addEventListener("pointerup", () => setTimeout(refresh, 0));
}

/* -------------------------------------------- */

/** Where the bands are drawn: above the grid, below the tokens. */
function getLayer() {
  if (layer?.parent) return layer;
  if (!canvas?.ready) return null;
  layer = new PIXI.Container();
  layer.name = "starwrought.reach";
  layer.eventMode = "none";
  const parent = canvas.interface ?? canvas.tokens;
  parent.addChild(layer);
  return layer;
}

/** Forget everything, for a canvas that has been torn down under us. */
function reset() {
  drawn.clear();
  layer = null;
}

/**
 * Throw away a shape, tolerating one that is already gone.
 *
 * PIXI raises rather than shrugging when a Graphics is destroyed twice, and anything that tears
 * down the canvas destroys our children for us. Left unguarded that throws from inside `refresh`,
 * which abandons the redraw half-done and leaves every band off the map until something else
 * happens to call it.
 */
function discard(g) {
  if (!g || g.destroyed) return;
  try {
    g.destroy({ children: true });
  } catch (err) {
    console.warn("STARWROUGHT | reach band was already destroyed", err);
  }
}

/**
 * Bring the bands up to date.
 *
 * Nothing is rebuilt unless its shape actually changed, so the common cases (a drag, a pan, a token
 * animating) come down to moving containers that already exist.
 */
export function refresh() {
  const container = getLayer();
  if (!container) return;
  const showing = game.settings.get(SW.SYSTEM_ID, "showReach");
  const live = new Set();

  if (showing) for (const token of canvas.tokens?.placeables ?? []) {
    if (!shouldShow(token)) continue;
    const g = shapeFor(token, container);
    if (!g) continue;
    // While a drag is in flight the clone is where the player is thinking, so follow that.
    place(g, previewOf(token) ?? token);
    live.add(token.id);
  }

  for (const [id, entry] of drawn) {
    if (live.has(id)) continue;
    discard(entry.g);
    drawn.delete(id);
  }
}

/** A band shows on a token you control or are hovering, and never on a hidden one. */
function shouldShow(token) {
  if (!token.visible || token.document.hidden) return false;
  if (!token.actor?.system) return false;
  return token.controlled || token.hover;
}

/** The drag clone standing in for this token, if one is in flight. */
function previewOf(token) {
  for (const clone of canvas.tokens?.preview?.children ?? []) {
    if (clone.destroyed) continue;
    if ((clone._original === token) || (clone.document?.id === token.id)) return clone;
  }
  return null;
}

/**
 * Put the bands over a token's space, snapped to whole cells.
 * The bands are cells, so they can only sit on cells; an unsnapped token takes the nearest.
 */
function place(g, token) {
  const size = canvas.scene.grid.size;
  g.position.set(Math.round(token.document.x / size) * size, Math.round(token.document.y / size) * size);
}

/* -------------------------------------------- */

/**
 * The reaches a token wants drawn, in feet.
 * @returns {{total: number, natural: number, unwieldy: number}}
 */
function reachesOf(actor) {
  if (actor.type === "character") {
    return {
      total: actor.system.totalReach ?? actor.system.reach ?? 0,
      natural: actor.system.reach ?? 0,
      unwieldy: actor.system.unwieldy ?? 0
    };
  }
  // Adversaries carry their reach on their attacks instead.
  const longest = (actor.system.attacks ?? []).reduce((n, a) => Math.max(n, a.reach ?? 0), 0);
  const natural = actor.system.reach ?? 0;
  return { total: longest || natural, natural, unwieldy: 0 };
}

/**
 * Everything the shape depends on. Position is deliberately absent: that is the whole reason a drag
 * is cheap.
 */
function signatureOf(token, reaches) {
  const grid = canvas.scene.grid;
  return [
    reaches.total, reaches.natural, reaches.unwieldy,
    token.document.width, token.document.height,
    grid.size, grid.distance
  ].join("|");
}

/** The cached bands for a token, rebuilt only if the shape has actually changed. */
function shapeFor(token, container) {
  const reaches = reachesOf(token.actor);
  if (!reaches.total) return null;
  const sig = signatureOf(token, reaches);

  // A cached shape that something else destroyed counts as absent, not as something to tidy up.
  const cached = drawn.get(token.id);
  if (cached && !cached.g.destroyed && cached.g.parent) {
    if (cached.sig === sig) return cached.g;
    discard(cached.g);
  }

  const g = draw(token, reaches);
  if (!g) {
    drawn.delete(token.id);
    return null;
  }
  container.addChild(g);
  drawn.set(token.id, { g, sig });
  return g;
}

/* -------------------------------------------- */

/**
 * Build one token's bands, in its own cell coordinates: cell (0,0) is the token's top-left square,
 * and the container is moved onto the map afterwards. Diagonals are measured exactly, so a cell two
 * across and one up sits at the square root of five feet and the outer edge comes out a stepped
 * octagon rather than a stepped square.
 */
function draw(token, { total, natural, unwieldy }) {
  const grid = canvas.scene.grid;
  const size = grid.size;

  // The token's own footprint, in whole cells.
  const w = Math.max(1, Math.round(token.document.width));
  const h = Math.max(1, Math.round(token.document.height));

  // How far out to look, in cells: a gap of `total` feet plus the touching ring.
  const span = Math.ceil(total / grid.distance) + 1;
  if (((w + (span * 2)) * (h + (span * 2))) > MAX_CELLS) return null;

  // How far each band reaches, in feet. They nest, so a band never draws past the total.
  const edges = {
    unwieldy: unwieldy ? Math.min(unwieldy - 0.001, total) : 0,
    natural: Math.min(natural, total),
    total
  };

  /**
   * The gap between this cell and the token's space, in feet: the squares that lie between them,
   * which is zero when they are touching. Null for the token's own space.
   */
  const gapAt = (c, r) => {
    if ((c >= 0) && (c < w) && (r >= 0) && (r < h)) return null;
    const dc = Math.max(0, c - w, -1 - c);
    const dr = Math.max(0, r - h, -1 - r);
    return Math.hypot(dc, dr) * grid.distance;
  };

  // Work the whole block out once: the outlines need to know their neighbours.
  const cells = new Map();
  for (let c = -span; c < (w + span); c++) {
    for (let r = -span; r < (h + span); r++) {
      const gap = gapAt(c, r);
      if ((gap === null) || (gap > total)) continue;
      cells.set(`${c},${r}`, { c, r, gap });
    }
  }
  if (!cells.size) return null;

  const bands = Object.keys(BANDS).filter(b => edges[b] > 0);
  const inBand = (cell, band) => cell && (cell.gap <= edges[band]);

  const g = new PIXI.Graphics();

  // Fills first, innermost band winning, so the outlines drawn over them stay crisp.
  for (const [i, band] of bands.entries()) {
    const style = BANDS[band];
    const inner = bands[i - 1];
    g.beginFill(style.color, style.fill);
    for (const cell of cells.values()) {
      if (!inBand(cell, band)) continue;
      if (inner && inBand(cell, inner)) continue;
      g.drawRect(cell.c * size, cell.r * size, size, size);
    }
    g.endFill();
  }

  // Then each band's own edge, which is what makes it read as a boundary and not a wash. Drawn
  // from membership rather than from the fills, so an enclosed band still shows its ring.
  const SIDES = [[0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1]];
  for (const band of bands) {
    const style = BANDS[band];
    g.lineStyle({ width: style.width, color: style.color, alpha: style.line, alignment: 0.5 });
    for (const cell of cells.values()) {
      if (!inBand(cell, band)) continue;
      const x = cell.c * size;
      const y = cell.r * size;
      for (const [dc, dr, ax, ay, bx, by] of SIDES) {
        // The token's own space is not "outside" any band, so no edge is drawn against it.
        if (inBand(cells.get(`${cell.c + dc},${cell.r + dr}`), band)) continue;
        if (gapAt(cell.c + dc, cell.r + dr) === null) continue;
        g.moveTo(x + (ax * size), y + (ay * size));
        g.lineTo(x + (bx * size), y + (by * size));
      }
    }
  }
  g.lineStyle(0);

  return g;
}
