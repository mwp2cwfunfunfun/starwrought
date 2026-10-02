/**
 * Reach, drawn on the map, in grid squares; and since 0.5.1 every other range a token carries.
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
 * Beyond them, the auras: every "within N feet" an ability on the actor names (Mark Prey 60 ft, a
 * Torchbearer's 15 ft for allies), and any custom ring the owner has added. This module is the
 * **preview**: on hover, control and drag, every range of the token is drawn on this client only,
 * Visible or not, each labelled at its top edge. The rings pinned for everyone through an
 * encounter are auras.mjs's business, and both draw through rings.mjs so they look the same.
 *
 * The rings follow a token while it is being dragged, before the move is committed, so a player can
 * see what they would threaten from a square and stop there rather than spend a second action
 * fixing it. That is affordable because **the shape does not depend on where the token is**: it is
 * built once in the token's own cell coordinates and cached, and a drag only moves the container.
 * Dragging therefore costs one position write per frame, not a redraw, however long the reach is.
 */

import * as SW from "../config.mjs";
import { drawRings, ringSignature, placeOn, resetRingCache } from "./rings.mjs";
import { rangesFor } from "./auras.mjs";

/** The PIXI container the preview lives in, one per canvas. */
let layer = null;

/** Token id -> the drawn rings and the signature they were drawn from. */
const drawn = new Map();

/** Register the hooks that keep the preview in step with the tokens. */
export function registerReachRings() {
  Hooks.on("canvasReady", () => { reset(); refresh(); });
  Hooks.on("controlToken", () => refresh());
  Hooks.on("hoverToken", () => refresh());
  Hooks.on("refreshToken", () => refresh());
  Hooks.on("updateActor", () => refresh());
  Hooks.on("updateItem", () => refresh());
  // A Talent with an aura arriving on, or leaving, a sheet changes what there is to preview.
  Hooks.on("createItem", () => refresh());
  Hooks.on("deleteItem", () => refresh());
  Hooks.on("deleteToken", () => refresh());

  // Dropping or cancelling a drag destroys the preview without necessarily refreshing the token it
  // came from, which would leave the rings standing where the drag ended. Settle them once the
  // button comes up, after Foundry has cleared the preview.
  document.addEventListener("pointerup", () => setTimeout(refresh, 0));
}

/* -------------------------------------------- */

/** Where the preview is drawn: above the grid, below the tokens. */
function getLayer() {
  if (layer?.parent) return layer;
  if (!canvas?.ready) return null;
  const parent = canvas.interface ?? canvas.tokens;
  // A refresh can run between the canvas turning ready and the canvasReady hook (a token's render
  // flags flushing mid-draw), so a layer may already hang here from before reset() forgot it.
  // Reuse it, emptied, rather than stack a second one that nothing refreshes (live test,
  // 2026-10-01: two reach layers, one holding stale rings at the token's old square).
  const existing = parent.children.find(c => (c.name === "starwrought.reach") && !c.destroyed);
  if (existing) {
    for (const child of existing.removeChildren()) child.destroy({ children: true });
    drawn.clear();
    layer = existing;
    return layer;
  }
  layer = new PIXI.Container();
  layer.name = "starwrought.reach";
  layer.eventMode = "none";
  parent.addChild(layer);
  return layer;
}

/** Forget everything, for a canvas that has been torn down under us. */
function reset() {
  drawn.clear();
  // A layer still attached (drawn before canvasReady) goes with the rest; a torn-down canvas has
  // already destroyed its own.
  if (layer && !layer.destroyed) layer.destroy({ children: true });
  layer = null;
  resetRingCache();
}

/**
 * Throw away a shape, tolerating one that is already gone.
 *
 * PIXI raises rather than shrugging when a container is destroyed twice, and anything that tears
 * down the canvas destroys our children for us. Left unguarded that throws from inside `refresh`,
 * which abandons the redraw half-done and leaves every ring off the map until something else
 * happens to call it.
 */
function discard(g) {
  if (!g || g.destroyed) return;
  try {
    g.destroy({ children: true });
  } catch (err) {
    console.warn("STARWROUGHT | reach ring was already destroyed", err);
  }
}

/**
 * Bring the preview up to date.
 *
 * Nothing is rebuilt unless its shape actually changed, so the common cases (a drag, a pan, a token
 * animating) come down to moving containers that already exist.
 */
export function refresh() {
  const container = getLayer();
  if (!container) return;
  const live = new Set();

  for (const token of canvas.tokens?.placeables ?? []) {
    if (!previewing(token)) continue;
    const g = shapeFor(token, container);
    if (!g) continue;
    // While a drag is in flight the clone is where the player is thinking, so follow that.
    placeOn(g, previewOf(token) ?? token);
    live.add(token.id);
  }

  for (const [id, entry] of drawn) {
    if (live.has(id)) continue;
    discard(entry.g);
    drawn.delete(id);
  }
}

/**
 * Is this token's preview on? A ring shows on a token you control or are hovering, never on a
 * hidden one, and only while the client setting allows. Exported for auras.mjs, which steps aside
 * for the preview rather than draw the same rings twice.
 * @param {Token} token
 * @returns {boolean}
 */
export function previewing(token) {
  if (!token?.visible || token.document.hidden) return false;
  if (!token.actor?.system) return false;
  if (!(token.controlled || token.hover)) return false;
  try {
    return !!game.settings.get(SW.SYSTEM_ID, "showReach");
  } catch {
    return true;
  }
}

/**
 * The drag clone standing in for this token, if one is in flight. Anything drawn about a token
 * while the player is still deciding where it goes should be drawn about the clone: the reach
 * bands here, the pinned auras, and the targeting arrows and their distances.
 */
export function previewOf(token) {
  for (const clone of canvas.tokens?.preview?.children ?? []) {
    if (clone.destroyed) continue;
    if ((clone._original === token) || (clone.document?.id === token.id)) return clone;
  }
  return null;
}

/* -------------------------------------------- */

/**
 * The reaches a token wants drawn, in feet. Exported for the targeting arrows, which colour their
 * distance label by whether the target is within it, and for the range list's fallback entries.
 * @returns {{total: number, natural: number, unwieldy: number}}
 */
export function reachesOf(actor) {
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

/** The cached rings for a token, rebuilt only if the shape has actually changed. */
function shapeFor(token, container) {
  const ranges = rangesFor(token.actor);
  if (!ranges.length) return null;
  const w = Math.max(1, Math.round(token.document.width));
  const h = Math.max(1, Math.round(token.document.height));
  const sig = ringSignature(ranges, { w, h, labels: true });

  // A cached shape that something else destroyed counts as absent, not as something to tidy up.
  const cached = drawn.get(token.id);
  if (cached && !cached.g.destroyed && cached.g.parent) {
    if (cached.sig === sig) return cached.g;
    discard(cached.g);
  }

  const g = drawRings(ranges, { w, h, labels: true });
  if (!g) {
    drawn.delete(token.id);
    return null;
  }
  container.addChild(g);
  drawn.set(token.id, { g, sig });
  return g;
}
