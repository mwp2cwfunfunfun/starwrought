/**
 * Ring geometry to PIXI: the one renderer behind every range drawn on the map.
 *
 * Reach was the first range the system drew, and the look it settled on is the look everything
 * keeps: whole cells, outlines along grid lines, the footprint unfilled, fills faint so a busy map
 * stays readable. Auras (0.5.1) are the same shape at other distances, so the drawing lives here
 * once and reach.mjs and auras.mjs both call it: one for the preview on hover, control and drag,
 * the other for the rings pinned through an encounter.
 *
 * Everything is built in the token's own cell coordinates, cell (0,0) its top-left square, and the
 * container is moved onto the map afterwards (`placeOn`). The shape does not depend on where the
 * token stands, so a drag is one position write per frame, and the geometry of a ring is cached by
 * `feet|w|h|grid.size|grid.distance`, so every Medium creature with a 15 ft ring shares the
 * arithmetic. A 60 ft ring on a one-foot grid is thousands of cells; nothing here visits them one
 * at a time. Each ring is one run per row (geometry.mjs ringRuns), filled as one rectangle per row
 * and outlined as one staircase path: O(span), not O(cells).
 *
 * Why not Foundry's Regions: on an exact-diagonal square grid its "circle" is an eight-point
 * octagon, and the rules' membership is "the whole-square gap from the edge of your space, as a
 * hypotenuse, is N or less" (geometry.mjs cellGap). The two disagree at the diagonals.
 */

import * as SW from "../config.mjs";
import { ringRuns } from "./geometry.mjs";

/**
 * The reach bands keep their own colours and weights, as reach.mjs always drew them. A cell is
 * filled in the innermost ring it belongs to, so the colours never stack into mud, but every ring
 * is outlined along its own edge: a longspear is Unwieldy 7 and your Natural Reach is 2, so the
 * natural ring sits wholly inside the unwieldy one and would otherwise vanish at exactly the moment
 * the map is busiest.
 */
export const REACH_STYLES = Object.freeze({
  unwieldy: { color: 0xB4453F, fill: 0.16, line: 0.75, width: 2 },
  reach: { color: 0x7FB3C8, fill: 0.07, line: 0.7, width: 2 },
  totalReach: { color: 0xE3B23C, fill: 0.08, line: 0.7, width: 2 }
});

/**
 * Ability auras colour by audience: allies green, enemies blood, everyone presence (the hex values
 * of the stylesheet's tokens). `SW.AURA_COLORS` in config.mjs is the shipped table; this is the
 * fallback for a build that has not received it.
 */
export const AURA_COLORS = Object.freeze({ allies: 0x5F9E6A, enemies: 0xB4453F, all: 0xC07AD8 });

/** Labels for the reach entries when the range list carries none of its own. */
const REACH_LABELS = Object.freeze({
  reach: "STARWROUGHT.Aura.reach",
  totalReach: "STARWROUGHT.Aura.totalReach",
  unwieldy: "STARWROUGHT.Aura.unwieldy"
});

/** Fills stop at this range: a 60 ft wash would tint half the scene. Beyond it, outline only. */
export const FILL_LIMIT_FEET = 30;
const AURA_FILL = 0.06;
const AURA_LINE = 0.7;
const LINE_WIDTH = 2;

/**
 * How boldly a ring is drawn (0.5.3; Mike: "sometimes the Ranges are hard to see, depending on the
 * colour of the battlemap tiles"). Every outline sits on a dark halo, the way the targeting arrows
 * and the Bind chain carry an underlay, so a pale gold or mint line still reads on a sand-coloured
 * floor; Strong, the client setting `ringContrast`, thickens the lines and deepens the fills for a
 * bright or busy map. `halo` is added to the line width, `line` and `fill` multiply the style's.
 */
export const CONTRAST = Object.freeze({
  normal: { halo: 2.5, haloAlpha: 0.45, line: 1, fill: 1 },
  strong: { halo: 4, haloAlpha: 0.65, line: 1.5, fill: 1.8 }
});
const FILL_CEILING = 0.35;

/** The contrast this client draws at: its setting, or Normal before the setting exists. */
export function contrastLevel() {
  try {
    const key = game.settings.get(SW.SYSTEM_ID, "ringContrast");
    return (key in CONTRAST) ? key : "normal";
  } catch {
    return "normal";
  }
}

/* -------------------------------------------- */
/*  Colours                                     */
/* -------------------------------------------- */

/**
 * A colour as PIXI wants it, from whatever the data carries: a number, a "#rrggbb" string from a
 * colour picker, or a Color. Null when there is nothing usable.
 * @param {number|string|foundry.utils.Color|null|undefined} value
 * @returns {number|null}
 */
export function toColor(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(foundry.utils.Color.from(value.trim()));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The colour a range is drawn in: its own if it has one, else its reach band's, else its audience's. */
export function colorOf(range) {
  const explicit = toColor(range?.color);
  if (explicit !== null) return explicit;
  const band = REACH_STYLES[range?.kind];
  if (band) return band.color;
  const palette = SW.AURA_COLORS ?? AURA_COLORS;
  return toColor(palette[range?.audience]) ?? toColor(palette.all) ?? AURA_COLORS.all;
}

/** The same colour as a CSS string, for swatches on the sheets and in the palette. */
export function cssColorOf(range) {
  return new foundry.utils.Color(colorOf(range)).css;
}

/** How a range is drawn: the reach bands keep their weights; an aura is faint up to 30 ft and outline only past it. */
function styleOf(range) {
  const color = colorOf(range);
  const band = REACH_STYLES[range.kind];
  if (band) return { color, fill: band.fill, line: band.line, width: band.width };
  const fill = (Number(range.feet) <= FILL_LIMIT_FEET) ? AURA_FILL : 0;
  return { color, fill, line: AURA_LINE, width: LINE_WIDTH };
}

/* -------------------------------------------- */
/*  Labels                                      */
/* -------------------------------------------- */

/** A range's name: as the data labels it, localised when it is an i18n key, else by its kind. */
export function labelOf(range) {
  const raw = range?.label;
  if ((typeof raw === "string") && raw.startsWith("STARWROUGHT.")) return game.i18n.localize(raw);
  if (raw) return String(raw);
  const key = REACH_LABELS[range?.kind];
  return key ? game.i18n.localize(key) : "";
}

/** "Mark Prey 60 ft": the label drawn at a ring's top edge and shown in tooltips. */
export function labelText(range) {
  const units = canvas?.scene?.grid?.units || "ft";
  const feet = Number(range?.feet) || 0;
  return game.i18n.format("STARWROUGHT.Aura.labelFeet", {
    label: labelOf(range),
    feet: Number.isInteger(feet) ? feet : feet.toFixed(1),
    units
  }).trim();
}

/* -------------------------------------------- */
/*  Geometry                                    */
/* -------------------------------------------- */

/** Ring geometry by `feet|w|h|size|distance`. Cleared when the canvas is torn down, and when it grows silly. */
const geometry = new Map();
const CACHE_LIMIT = 256;

/** Forget every cached ring, for a canvas that has been torn down under us. */
export function resetRingCache() {
  geometry.clear();
}

/**
 * One ring's geometry, in the footprint's own cell coordinates: its rows (geometry.mjs ringRuns),
 * the staircase polygon around them in pixels, and where a label sits (the top edge, centred).
 * @param {number} feet
 * @param {number} w  Footprint width in cells.
 * @param {number} h  Footprint height in cells.
 * @returns {{feet: number, w: number, h: number, size: number, rows: Array<{r: number, c0: number, c1: number}>, points: number[], top: {x: number, y: number}}}
 */
export function ringGeometry(feet, w, h) {
  const grid = canvas.scene.grid;
  const size = grid.size;
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  feet = Math.max(0, Number(feet) || 0);
  const key = [feet, w, h, size, grid.distance].join("|");
  const cached = geometry.get(key);
  if (cached) return cached;

  const rows = ringRuns(w, h, feet, grid.distance);
  const entry = {
    feet, w, h, size, rows,
    points: staircase(rows, size),
    top: { x: (w * size) / 2, y: (rows[0]?.r ?? 0) * size }
  };
  if (geometry.size >= CACHE_LIMIT) geometry.clear();
  geometry.set(key, entry);
  return entry;
}

/**
 * The closed outline around a set of runs, as a flat list of pixel coordinates: down the right side
 * one step per row, back up the left. Consecutive rows of equal width share a vertex, which is
 * dropped so the dashed variant does not stutter at it.
 */
function staircase(rows, size) {
  const pts = [];
  const push = (cx, cy) => {
    const x = cx * size;
    const y = cy * size;
    const n = pts.length;
    if (n && (pts[n - 2] === x) && (pts[n - 1] === y)) return;
    pts.push(x, y);
  };
  for (const { r, c1 } of rows) {
    push(c1 + 1, r);
    push(c1 + 1, r + 1);
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    const { r, c0 } = rows[i];
    push(c0, r + 1);
    push(c0, r);
  }
  // The path closes back to its first vertex; a duplicate of it at the end would be a zero-length dash.
  if ((pts.length >= 4) && (pts[0] === pts[pts.length - 2]) && (pts[1] === pts[pts.length - 1])) pts.length -= 2;
  return pts;
}

/* -------------------------------------------- */
/*  Drawing                                     */
/* -------------------------------------------- */

/**
 * Everything a set of rings depends on. Position is deliberately absent: that is the whole reason a
 * drag is cheap. Consumers compare this against what they drew last and rebuild only on a change.
 * @param {object[]} ranges
 * @param {{w: number, h: number, dashed?: boolean, labels?: boolean}} options
 * @returns {string}
 */
export function ringSignature(ranges, { w, h, dashed = false, labels = false } = {}) {
  const grid = canvas.scene.grid;
  const parts = ranges.map(r => [r.key, r.kind, r.feet, r.audience, colorOf(r), labels ? labelText(r) : ""].join(":"));
  // The contrast level is part of the drawing, so a change of the setting redraws (its onChange
  // asks for a refresh, and the refresh sees a new signature).
  return [w, h, grid.size, grid.distance, dashed ? "d" : "s", labels ? "l" : "", contrastLevel(), ...parts].join("|");
}

/**
 * Draw a set of rings about one footprint, in its own cell coordinates. Largest first, so a smaller
 * ring is drawn over a larger one; each ring's fill stops at the next ring in, so the fills are
 * concentric bands rather than a stack of washes; every ring is outlined along its own edge.
 *
 * @param {object[]} ranges  Range entries: `feet` is what matters here, with `kind`, `audience`,
 *                           `color` and `label` deciding how each is drawn.
 * @param {object} options
 * @param {number} options.w             Footprint width in cells.
 * @param {number} options.h             Footprint height in cells.
 * @param {boolean} [options.dashed]     Dashed outlines: how the GM sees a hidden token's rings.
 * @param {boolean} [options.labels]     A label at each ring's top edge (name and feet).
 * @returns {PIXI.Container|null}  Null when there is nothing to draw.
 */
export function drawRings(ranges, { w, h, dashed = false, labels = false } = {}) {
  const size = canvas.scene.grid.size;
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const usable = (ranges ?? []).filter(r => Number.isFinite(Number(r?.feet)) && (Number(r.feet) >= 0));
  if (!usable.length) return null;

  const shapes = [...usable]
    .sort((a, b) => Number(b.feet) - Number(a.feet))
    .map(range => ({ range, geo: ringGeometry(Number(range.feet), w, h), style: styleOf(range) }));

  const g = new PIXI.Graphics();
  const contrast = CONTRAST[contrastLevel()];

  // Fills first, so the outlines drawn over them stay crisp. Each ring's hole is the next ring in;
  // two rings of one size leave nothing between them, and the innermost stops at the footprint.
  for (let i = 0; i < shapes.length; i++) {
    const { geo, style } = shapes[i];
    if (!(style.fill > 0)) continue;
    const fill = Math.min(FILL_CEILING, style.fill * contrast.fill);
    fillBand(g, geo, shapes[i + 1]?.geo ?? null, w, h, size, { ...style, fill });
  }

  // Then each ring's own edge, which is what makes it read as a boundary and not a wash. The
  // token's own space is not "outside" any ring, so no edge is ever drawn against it. A dark halo
  // goes under every edge first (0.5.3), so the colour reads on a pale floor as well as a dark one.
  const path = pts => (dashed ? dashedPath(g, pts, size) : solidPath(g, pts));
  for (const { geo, style } of shapes) {
    const width = style.width * contrast.line;
    g.lineStyle({ width: width + contrast.halo, color: 0x000000, alpha: contrast.haloAlpha, alignment: 0.5 });
    path(geo.points);
    g.lineStyle({ width, color: style.color, alpha: style.line, alignment: 0.5 });
    path(geo.points);
  }
  g.lineStyle(0);

  const container = new PIXI.Container();
  container.addChild(g);
  if (labels) addLabels(container, shapes);
  return container;
}

/** One ring's fill, row by row, leaving out the ring inside it (or the footprint). */
function fillBand(g, geo, inner, w, h, size, style) {
  const innerRows = new Map((inner?.rows ?? []).map(row => [row.r, row]));
  g.beginFill(style.color, style.fill);
  for (const row of geo.rows) {
    let hole = innerRows.get(row.r) ?? null;
    // The footprint is never filled: on its own rows, with no ring inside, it is the hole.
    if (!hole && (row.r >= 0) && (row.r < h)) hole = { c0: 0, c1: w - 1 };
    if (!hole) {
      rect(g, row.c0, row.c1, row.r, size);
      continue;
    }
    if (hole.c0 > row.c0) rect(g, row.c0, hole.c0 - 1, row.r, size);
    if (hole.c1 < row.c1) rect(g, hole.c1 + 1, row.c1, row.r, size);
  }
  g.endFill();
}

function rect(g, c0, c1, r, size) {
  if (c1 < c0) return;
  g.drawRect(c0 * size, r * size, (c1 - c0 + 1) * size, size);
}

function solidPath(g, pts) {
  if (pts.length < 4) return;
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

/**
 * The same path in dashes, the phase carried round the corners so the pattern runs evenly along
 * the staircase instead of restarting at every step. Dash and gap scale with the cell.
 */
function dashedPath(g, pts, size) {
  if (pts.length < 4) return;
  const dash = Math.clamp(size * 0.35, 4, 40);
  const gap = Math.clamp(size * 0.3, 3, 30);
  const period = dash + gap;
  let phase = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = pts[2 * i];
    const y0 = pts[(2 * i) + 1];
    const x1 = pts[(2 * i + 2) % pts.length];
    const y1 = pts[(2 * i + 3) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!len) continue;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    let t = 0;
    while (t < len) {
      const inDash = phase < dash;
      const remaining = inDash ? (dash - phase) : (period - phase);
      const step = Math.min(remaining, len - t);
      if (inDash) {
        g.moveTo(x0 + (ux * t), y0 + (uy * t));
        g.lineTo(x0 + (ux * (t + step)), y0 + (uy * (t + step)));
      }
      t += step;
      phase = (phase + step) % period;
    }
  }
}

/**
 * A label at each ring's top edge: the smallest ring's nearest the token, the others stacked
 * outward, nudged apart when two edges fall within a label of each other.
 */
function addLabels(container, shapes) {
  const cell = 100 * canvas.dimensions.uiScale;
  const fontSize = Math.clamp(cell * 0.9, 12, 22);
  const taken = [];
  for (const { range, geo, style } of [...shapes].reverse()) {
    const { label, height } = makeLabel(labelText(range), style.color, fontSize);
    let y = geo.top.y - (height / 2) - (fontSize * 0.2);
    for (const used of taken) {
      if (Math.abs(used - y) < height) y = used - height - 2;
    }
    taken.push(y);
    label.position.set(geo.top.x, y);
    container.addChild(label);
  }
}

/** A pill with the text in the ring's colour, as the targeting arrows print their distances. */
function makeLabel(text, color, fontSize) {
  const style = CONFIG.canvasTextStyle.clone();
  style.fontSize = fontSize;
  style.fill = color;
  style.stroke = 0x000000;
  style.strokeThickness = Math.max(2, fontSize / 6);
  const label = new foundry.canvas.containers.PreciseText(text, style);
  label.anchor.set(0.5, 0.5);

  const pad = fontSize * 0.35;
  const pill = new PIXI.Graphics();
  pill.beginFill(0x000000, 0.6)
    .drawRoundedRect(-(label.width / 2) - pad, -(label.height / 2) - (pad / 2), label.width + (pad * 2), label.height + pad, fontSize / 2)
    .endFill();

  const c = new PIXI.Container();
  c.addChild(pill, label);
  return { label: c, height: label.height + pad };
}

/**
 * Put a drawn set of rings over a token's space, snapped to whole cells. The rings are cells, so
 * they can only sit on cells; an unsnapped token takes the nearest. A drag clone's document carries
 * the in-flight position, so passing the clone follows the drag.
 * @param {PIXI.Container} container
 * @param {Token|TokenDocument} token
 */
export function placeOn(container, token) {
  const size = canvas.scene.grid.size;
  const doc = token.document ?? token;
  container.position.set(Math.round(doc.x / size) * size, Math.round(doc.y / size) * size);
}
