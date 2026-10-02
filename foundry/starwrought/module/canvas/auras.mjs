/**
 * Auras: every "within N feet" an actor carries, pinned on the map through an encounter (0.5.1).
 *
 * The handbook is full of them (Mike: "There are a lot of 'within X feet' abilities"), and a
 * table that measures from the edge of a space, in whole squares, exact across the diagonal,
 * cannot eyeball 15 feet. So every range an actor has is one entry in one list (`rangesOf`, in
 * module/data/actor.mjs; `actor.system.ranges`): the three reach bands, each ability with an Aura
 * cell in the data, and any custom ring the owner has added. Two ways to see them:
 *
 *   Preview   on hover, control and drag, every range of the token is drawn on this client only.
 *             That is reach.mjs, generalised.
 *   Pinned    while an encounter is started, every combatant's **Visible** ranges are drawn on
 *             every client, always, following the token and its drag clone. A combatant added
 *             mid-fight lights its rings as it joins; flipping a mark pins or unpins at once,
 *             since the actor update reaches every client. Out of an encounter nothing is pinned.
 *
 * The Visible mark is stored on the actor (`system.auras.visible[key]`; Mike: new tokens inherit
 * it): an ability's key is its Item id, the reach bands are `reach`, `totalReach` and `unwieldy`,
 * a custom ring carries its own. A mark absent from the store means the data default (`aura.visible`
 * on the Item; false for reach). The owner toggles marks, the GM toggles anyone's, from the Token
 * HUD's palette or the ring icons on the sheets.
 *
 * Who sees what: players see nothing of a hidden token, and the GM sees its rings dashed; a custom
 * ring flagged GM-only never reaches a player; the scene flag `aurasSuppressed` (the GM's Token
 * control) hides every pinned ring from players until released, marks untouched, and dims them for
 * the GM as a reminder; the client setting `showAuras` mutes the pinned drawing locally.
 *
 * This module also holds the reading side the sheets, the HUD and the palette share: `rangesFor`,
 * `visibleRanges`, `rangeContext` and friends.
 */

import * as SW from "../config.mjs";
import * as ActorData from "../data/actor.mjs";
import { drawRings, ringSignature, placeOn, resetRingCache, cssColorOf, labelOf, labelText } from "./rings.mjs";
import { reachesOf, previewOf, previewing } from "./reach.mjs";

/** The range kinds the body supplies, as opposed to an ability or a custom ring. */
export const REACH_KINDS = Object.freeze(["reach", "totalReach", "unwieldy"]);

/** Who a range concerns, and the word for it. */
export const AUDIENCES = Object.freeze({
  all: "STARWROUGHT.Aura.audienceAll",
  allies: "STARWROUGHT.Aura.audienceAllies",
  enemies: "STARWROUGHT.Aura.audienceEnemies"
});

/** The scene flag the GM's Suppress control sets: `flags.starwrought.aurasSuppressed`. */
export const SUPPRESS_FLAG = "aurasSuppressed";

/* -------------------------------------------- */
/*  Reading the ranges                          */
/* -------------------------------------------- */

/**
 * Every range an actor carries, each `{ key, label, feet, audience, color, source, kind, visible }`.
 * The data model derives the list (`rangesOf` in module/data/actor.mjs, or `system.ranges`);
 * this reads it defensively, so a build in which that half has not landed still draws reach.
 * Entries without a usable range are dropped here, once, for every consumer.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function rangesFor(actor) {
  if (!actor?.system) return [];
  let list = null;
  try {
    if (typeof ActorData.rangesOf === "function") list = ActorData.rangesOf(actor);
    else if (Array.isArray(actor.system.ranges)) list = actor.system.ranges;
  } catch (err) {
    console.warn("STARWROUGHT | the range list could not be read", err);
    list = null;
  }
  if (!Array.isArray(list)) list = fallbackRanges(actor);
  return list.filter(usable);
}

/** A range the renderer can do something with: keyed, with a finite range; Unwieldy 0 is no Unwieldy. */
function usable(range) {
  const feet = Number(range?.feet);
  if (!range?.key || !Number.isFinite(feet) || (feet < 0)) return false;
  if ((range.kind === "unwieldy") && (feet <= 0)) return false;
  return true;
}

/**
 * TEMPORARY FALLBACK: the three reach bands and the custom rings, built here when the data model
 * does not yet export `rangesOf`. Remove once module/data/actor.mjs carries it; nothing else in
 * this module depends on it.
 */
function fallbackRanges(actor) {
  const reaches = reachesOf(actor);
  const marks = actor.system.auras?.visible ?? {};
  const entry = (key, kind, feet) => ({
    key, kind, feet, label: `STARWROUGHT.Aura.${kind}`, audience: "all", color: null, source: null,
    visible: marks[key] === true
  });
  const list = [entry("reach", "reach", reaches.natural), entry("totalReach", "totalReach", reaches.total)];
  if (reaches.unwieldy > 0) list.push(entry("unwieldy", "unwieldy", reaches.unwieldy));
  for (const custom of actor.system.auras?.custom ?? []) {
    list.push({ ...custom, kind: "custom", source: null, visible: marks[custom.key] !== false });
  }
  return list;
}

/** One range by key, or null. */
export function rangeFor(actor, key) {
  return rangesFor(actor).find(r => r.key === key) ?? null;
}

/** The ranges marked Visible: what an encounter pins. */
export function visibleRanges(actor) {
  return rangesFor(actor).filter(r => r.visible);
}

/** The word for an audience. */
export function audienceLabel(audience) {
  return game.i18n.localize(AUDIENCES[audience] ?? AUDIENCES.all);
}

/**
 * A range as a sheet row, a palette row or a HUD count wants it: localised, with the colour as
 * CSS and the tooltip the ring toggle shows.
 * @param {object} range
 * @returns {object}
 */
export function rangeContext(range) {
  const label = labelOf(range);
  const feet = Number(range.feet) || 0;
  const visible = !!range.visible;
  return {
    key: range.key,
    kind: range.kind,
    label,
    feet,
    audience: range.audience ?? "all",
    audienceLabel: audienceLabel(range.audience),
    color: cssColorOf(range),
    visible,
    gmOnly: !!range.gmOnly,
    isCustom: range.kind === "custom",
    isReach: REACH_KINDS.includes(range.kind),
    text: labelText(range),
    tooltip: game.i18n.format(visible ? "STARWROUGHT.Aura.toggleOff" : "STARWROUGHT.Aura.toggleOn", { label, feet })
  };
}

/**
 * The ring toggles for the Item rows on a sheet, keyed by Item id, so a template can look a row's
 * ring up with `(lookup @root.auraByItem item.id)` and draw nothing for an Item without one.
 * @param {Actor} actor
 * @returns {Record<string, object>}
 */
export function auraRowsByItem(actor) {
  const rows = {};
  for (const range of rangesFor(actor)) {
    if (!actor.items?.has?.(range.key)) continue;
    rows[range.key] = rangeContext(range);
  }
  return rows;
}

/** The body's own ranges for the Overview's Ranges line: Natural Reach, Total Reach, Unwieldy when the weapon has it. */
export function reachRangeRows(actor) {
  return rangesFor(actor).filter(r => REACH_KINDS.includes(r.kind)).map(rangeContext);
}

/* -------------------------------------------- */
/*  Suppress and Clear (the GM's controls)      */
/* -------------------------------------------- */

/** Has the GM suppressed the pinned auras on this scene? */
export function aurasSuppressed(scene = canvas?.scene) {
  return !!scene?.getFlag?.(SW.SYSTEM_ID, SUPPRESS_FLAG);
}

/**
 * Suppress or release the pinned auras on a scene. Players see none while it is set; the marks
 * themselves are untouched, so releasing brings every ring straight back.
 * @param {boolean} active
 * @param {Scene} [scene]
 */
export async function setAurasSuppressed(active, scene = canvas?.scene) {
  if (!scene || !game.user.isGM) return;
  if (active) await scene.setFlag(SW.SYSTEM_ID, SUPPRESS_FLAG, true);
  else if (aurasSuppressed(scene)) await scene.unsetFlag(SW.SYSTEM_ID, SUPPRESS_FLAG);
  refresh();
}

/**
 * Clear every Visible mark on every combatant's actor, back to the data defaults, after a confirm.
 * @param {object} [options]
 * @param {boolean} [options.confirm=true]
 * @returns {Promise<number>}  How many actors had marks to clear.
 */
export async function clearAuraMarks({ confirm = true } = {}) {
  if (!game.user.isGM) return 0;
  const actors = new Map();
  for (const combatant of game.combat?.combatants ?? []) {
    if (combatant.actor) actors.set(combatant.actor.uuid, combatant.actor);
  }
  if (!actors.size) {
    ui.notifications.info(game.i18n.localize("STARWROUGHT.Aura.clearNone"));
    return 0;
  }
  if (confirm) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("STARWROUGHT.Aura.clearTitle") },
      content: `<p>${game.i18n.format("STARWROUGHT.Aura.clearBody", { count: actors.size })}</p>`
    });
    if (!ok) return 0;
  }
  let count = 0;
  for (const actor of actors.values()) {
    if (typeof actor.clearAuraMarks !== "function") continue;
    if (await actor.clearAuraMarks()) count++;
  }
  ui.notifications.info(game.i18n.format("STARWROUGHT.Aura.cleared", { count }));
  return count;
}

/* -------------------------------------------- */
/*  The pinned drawing                          */
/* -------------------------------------------- */

/** The PIXI container the pinned rings live in, one per canvas. */
let layer = null;

/** Token id -> the drawn rings and the signature they were drawn from. */
const drawn = new Map();

/** Register the hooks that keep the pinned rings in step with the encounter and the tokens. */
export function registerAuras() {
  Hooks.on("canvasReady", () => { reset(); refresh(); });
  // The encounter: starting, moving on, gaining or losing a combatant, ending.
  Hooks.on("combatStart", () => refresh());
  Hooks.on("updateCombat", () => refresh());
  Hooks.on("createCombatant", () => refresh());
  Hooks.on("deleteCombatant", () => refresh());
  Hooks.on("deleteCombat", () => refresh());
  // The marks, the ranges behind them, and an aura Talent arriving or leaving.
  Hooks.on("updateActor", () => refresh());
  Hooks.on("updateItem", () => refresh());
  Hooks.on("createItem", () => refresh());
  Hooks.on("deleteItem", () => refresh());
  // The GM's Suppress flag: redraw, and rebuild the scene controls so the toggle shows its state.
  Hooks.on("updateScene", (scene, changes) => {
    if (scene !== canvas?.scene) return;
    if (!foundry.utils.hasProperty(changes, `flags.${SW.SYSTEM_ID}.${SUPPRESS_FLAG}`)
      && !foundry.utils.hasProperty(changes, `flags.${SW.SYSTEM_ID}.-=${SUPPRESS_FLAG}`)) return;
    refresh();
    ui.controls?.render({ reset: true });
  });
  // The tokens: moving, hiding, hovering, controlled (the label rule), an unlinked actor's delta.
  Hooks.on("refreshToken", () => refresh());
  Hooks.on("updateToken", () => refresh());
  Hooks.on("hoverToken", () => refresh());
  Hooks.on("controlToken", () => refresh());
  Hooks.on("deleteToken", () => refresh());

  // The same fallback reach.mjs uses: settle the rings once a drag's button comes up.
  document.addEventListener("pointerup", () => setTimeout(refresh, 0));
}

/** Where the pinned rings are drawn: above the grid, below the tokens, beneath the preview. */
function getLayer() {
  if (layer?.parent) return layer;
  if (!canvas?.ready) return null;
  layer = new PIXI.Container();
  layer.name = "starwrought.auras";
  layer.eventMode = "none";
  const parent = canvas.interface ?? canvas.tokens;
  // Beneath the preview layer when it is already there, so a hovered token's labels stay on top.
  const preview = parent.children.find(c => c.name === "starwrought.reach");
  if (preview) parent.addChildAt(layer, parent.getChildIndex(preview));
  else parent.addChild(layer);
  return layer;
}

/** Forget everything, for a canvas that has been torn down under us. */
function reset() {
  drawn.clear();
  layer = null;
  resetRingCache();
}

/** Throw away a shape, tolerating one that is already gone (see reach.mjs for why). */
function discard(g) {
  if (!g || g.destroyed) return;
  try {
    g.destroy({ children: true });
  } catch (err) {
    console.warn("STARWROUGHT | aura ring was already destroyed", err);
  }
}

/** Is the pinned drawing on for this client? Registered by starwrought.mjs; read defensively. */
function showing() {
  try {
    return !!game.settings.get(SW.SYSTEM_ID, "showAuras");
  } catch {
    return true;
  }
}

/**
 * Bring the pinned rings up to date. Cheap by the same trick as the preview: nothing is rebuilt
 * unless its shape changed, so a token animating across the map moves a container that exists.
 */
export function refresh() {
  const container = getLayer();
  if (!container) return;
  const live = new Set();

  if (showing()) for (const token of canvas.tokens?.placeables ?? []) {
    const pinned = pinnedFor(token);
    if (!pinned) continue;
    const g = shapeFor(token, pinned, container);
    if (!g) continue;
    placeOn(g, previewOf(token) ?? token);
    g.alpha = pinned.dim ? 0.45 : 1;
    live.add(token.id);
  }

  for (const [id, entry] of drawn) {
    if (live.has(id)) continue;
    discard(entry.g);
    drawn.delete(id);
  }
}

/**
 * Is this token a combatant in a started encounter? `game.combat` is the encounter on this scene;
 * a combatant's `sceneId` is checked where it carries one, since a combat may span scenes.
 * @param {TokenDocument} doc
 * @returns {boolean}
 */
export function inStartedEncounter(doc) {
  const combat = game.combat;
  if (!combat?.started || !doc) return false;
  const sceneId = doc.parent?.id ?? null;
  return combat.combatants.some(c => (c.tokenId === doc.id) && (!c.sceneId || !sceneId || (c.sceneId === sceneId)));
}

/**
 * What to pin for a token, for this user, or null for nothing: the rules in the module header.
 * @param {Token} token
 * @returns {{ranges: object[], dashed: boolean, dim: boolean, labels: boolean}|null}
 */
function pinnedFor(token) {
  const doc = token.document;
  const actor = token.actor;
  if (!doc || !actor?.system) return null;
  if (!inStartedEncounter(doc)) return null;
  const gm = game.user.isGM;
  // Hidden to a player, out of sight, or otherwise not drawn: Foundry's own visibility rule.
  if (!token.visible) return null;
  if (doc.hidden && !gm) return null;
  const suppressed = aurasSuppressed(doc.parent);
  if (suppressed && !gm) return null;
  // The preview draws every range of a token under the pointer, these included, so step aside
  // rather than draw the same rings twice over each other.
  if (previewing(token)) return null;

  const ranges = visibleRanges(actor).filter(r => gm || !r.gmOnly);
  if (!ranges.length) return null;
  return {
    ranges,
    dashed: !!doc.hidden,
    dim: suppressed,
    // The label rule: name and feet while the carrier is hovered or controlled.
    labels: !!(token.hover || token.controlled)
  };
}

/** The cached rings for a token, rebuilt only if the shape has actually changed. */
function shapeFor(token, pinned, container) {
  const w = Math.max(1, Math.round(token.document.width));
  const h = Math.max(1, Math.round(token.document.height));
  const options = { w, h, dashed: pinned.dashed, labels: pinned.labels };
  const sig = ringSignature(pinned.ranges, options);

  const cached = drawn.get(token.id);
  if (cached && !cached.g.destroyed && cached.g.parent) {
    if (cached.sig === sig) return cached.g;
    discard(cached.g);
  }

  const g = drawRings(pinned.ranges, options);
  if (!g) {
    drawn.delete(token.id);
    return null;
  }
  container.addChild(g);
  drawn.set(token.id, { g, sig });
  return g;
}
