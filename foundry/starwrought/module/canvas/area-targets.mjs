/**
 * TARGET WHAT IS INSIDE A TEMPLATE (0.26.0). Mike, 2026-11-15, on the v4.25 sync's plan: "for
 * Areas on the map... is there functionality to place/move Area templates around, to automatically
 * include targets?"
 *
 * Foundry v14 folded measured templates into Regions: anyone may draw one in the Regions controls'
 * template mode (a circle, a cone, a line, a ring, an emanation, a rectangle; a player's controls
 * open in that mode), move it and turn it, and a Token can say whether it stands inside a Region
 * (`TokenDocument#testInsideRegion`). Core does nothing more with it. This module is the missing
 * step, and only that step: the tokens inside a template become the user's targets, so the next
 * Strike or Cast declares at every one of them (`SwActor#declaredTargets` takes every token the
 * user has targeted) and, since 0.26.0, rolls once for each.
 *
 *  - A TEMPLATE is a Region made in template mode. Core marks it by nothing but its look (the
 *    user's colour, measurements shown, the user its owner), so the system stamps its own flag,
 *    `flags.starwrought.template`, as the Region is created (`preCreateRegion`, on the creating
 *    client, which is the one that knows the mode). A Region that carries a behavior (Difficult
 *    terrain, a teleport) is never a template, whatever its flag says.
 *  - AUTOMATIC: when a user draws a template, or moves, turns or reshapes one, that user's targets
 *    are replaced by the tokens inside it. On the client of the user who made the change and no
 *    other; the client setting `templateTargets` turns it off.
 *  - BY HAND: the Regions controls' "Target what is inside" tool, for the selected Region or
 *    Regions (any Region, flagged or not: the GM may aim with a hand-drawn one), else the user's
 *    newest template on the scene; and `game.starwrought.targetInside(region)` for a macro.
 *  - "Inside" is Foundry's own test. A token with no actor behind it and a party's token are left
 *    out. So is anything the user could not target by clicking it: for a player, a token the GM
 *    has hidden and a token they cannot SEE (behind a wall, in the dark, out of their vision), so
 *    a template drawn over a closed room names nobody in it; for the GM, a hidden token in the
 *    automatic step (an adversary's attack would put its name on the public card), though the
 *    button and the macro, pressed on purpose, take it. The user's own token is not left out: a
 *    blast centred on yourself catches you, and one press of T lets a target go.
 *
 * Nothing here is an area Attack's rules: a spell's own shape and size are still the Talent's
 * prose (`system.spell.targets`), no template is placed by a Cast or removed after it, and the
 * book's "an area Attack does not automatically gain these location-specific effects" is the
 * GM's to apply. Those wait for the spells' area columns.
 */

import * as SW from "../config.mjs";

const FLAG = "template";

/** Register the hooks. Called once at init. */
export function registerAreaTargets() {
  // The creating client knows whether its Regions layer is in template mode: mark the Region.
  Hooks.on("preCreateRegion", (region, data, options, userId) => {
    try {
      if (userId !== game.user.id) return;
      if (!canvas?.regions?.templateMode) return;
      if (region.behaviors?.size) return;
      region.updateSource({ [`flags.${SW.SYSTEM_ID}.${FLAG}`]: true });
    } catch (err) {
      console.error("STARWROUGHT | a template could not be marked", err);
    }
  });
  Hooks.on("createRegion", (region, options, userId) => follow(region, userId));
  Hooks.on("updateRegion", (region, changed, options, userId) => {
    // Only what moves the area: its shapes, its elevation, its levels, or the token it rides on.
    if (!["shapes", "elevation", "levels", "attachment"].some(key => key in (changed ?? {}))) return;
    follow(region, userId);
  });
}

/** Is automatic targeting on for this client? The setting, read safely before settings exist. */
export function templateTargetsOn() {
  try {
    return game.settings.get(SW.SYSTEM_ID, "templateTargets") !== false;
  } catch {
    return true;
  }
}

/**
 * Is this Region a template: one drawn in template mode, which this system flagged, and carrying
 * no behavior (a Difficult terrain region is ground, never an aim)?
 * @param {RegionDocument} region
 * @returns {boolean}
 */
export function isTemplate(region) {
  if (!region) return false;
  if (region.behaviors?.size) return false;
  return !!region.getFlag?.(SW.SYSTEM_ID, FLAG);
}

/**
 * The tokens standing inside a Region that this user could aim an attack at: on the Region's
 * scene, with an actor that is not a party, and targetable by this user as a click would be. A
 * player never targets what they cannot see: a hidden token, or one their vision does not reach
 * (core's own rule for a target, `Token#visible`), so a template over a room behind a wall names
 * nobody in it. The GM sees everything; a token the GM has hidden is included only when asked
 * for (`hidden`), which the automatic step never does.
 * @param {RegionDocument} region
 * @param {object} [options]
 * @param {boolean} [options.hidden=false]  For the GM: include tokens the GM has hidden.
 * @returns {TokenDocument[]}
 */
export function tokensInside(region, { hidden = false } = {}) {
  const scene = region?.parent;
  if (!scene) return [];
  const out = [];
  for (const token of scene.tokens) {
    const actor = token.actor;
    if (!actor || (actor.type === SW.PARTY_TYPE)) continue;
    if (game.user.isGM) {
      if (token.hidden && !hidden) continue;
    } else if (token.hidden || !token.object?.visible) {
      continue;
    }
    let inside = false;
    try {
      inside = !!token.testInsideRegion(region);
    } catch {
      inside = false;
    }
    if (inside) out.push(token);
  }
  return out;
}

/**
 * Make the tokens inside a Region this user's targets, replacing the ones they had.
 * @param {RegionDocument|RegionDocument[]|null} [regions]  One Region or several (their tokens
 *   together); omitted, the selected Regions, else this user's newest template on the viewed scene.
 * @param {object} [options]
 * @param {boolean} [options.notify=true]  Say how many were targeted, or that none stand inside.
 * @param {boolean} [options.hidden=true]  For the GM: take the tokens the GM has hidden too. The
 *   button and a macro are pressed on purpose; the automatic step passes false.
 * @returns {TokenDocument[]} the tokens targeted
 */
export function targetInside(regions = null, { notify = true, hidden = true } = {}) {
  if (!canvas?.ready) return [];
  let list = regions ? (Array.isArray(regions) ? regions : [regions]) : [];
  list = list.map(r => r?.document ?? r).filter(r => r?.parent === canvas.scene);
  if (!list.length) list = (canvas.regions?.controlled ?? []).map(r => r.document);
  if (!list.length) {
    const mine = canvas.scene.regions.filter(r => isTemplate(r) && r.isOwner);
    if (mine.length) list = [mine[mine.length - 1]];
  }
  if (!list.length) {
    if (notify) ui.notifications.warn(game.i18n.localize("STARWROUGHT.Template.none"));
    return [];
  }
  const seen = new Set();
  const tokens = [];
  for (const region of list) {
    for (const token of tokensInside(region, { hidden })) {
      if (seen.has(token.id)) continue;
      seen.add(token.id);
      tokens.push(token);
    }
  }
  canvas.tokens.setTargets(tokens.map(t => t.id), { mode: "replace" });
  if (notify) {
    ui.notifications.info(tokens.length
      ? game.i18n.format("STARWROUGHT.Template.targeted", { n: tokens.length, names: tokens.map(t => t.name).join(", ") })
      : game.i18n.localize("STARWROUGHT.Template.empty"));
  }
  return tokens;
}

/** The automatic step: this user drew or moved their own template, so their targets follow it. */
function follow(region, userId) {
  try {
    if (userId !== game.user.id) return;
    if (!templateTargetsOn() || !isTemplate(region)) return;
    if (region.parent !== canvas?.scene) return;
    // Never a hidden token here: the GM's next attack would name it on the public card.
    targetInside(region, { notify: false, hidden: false });
  } catch (err) {
    console.error("STARWROUGHT | the targets could not follow the template", err);
  }
}
