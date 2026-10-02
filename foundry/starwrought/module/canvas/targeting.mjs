/**
 * Who has whom targeted, made visible.
 *
 * Foundry's own indicator is four small corner brackets that only the targeting user can see, plus
 * a pip the size of a fingernail for everyone else. At a table where the players roll everything,
 * the question "who is that thing going for" comes up every round, and a fingernail does not answer
 * it. Two things do:
 *
 *   An arrow on the map, from the token doing the targeting to whatever it targets, in the
 *   targeting player's colour, drawn for everyone who can see both tokens.
 *
 *   A line in the Combat Tracker under each combatant naming its targets, and a tint on the rows of
 *   whoever the active combatant has in its sights.
 *
 * Both read from the same place. Foundry targets belong to a *user* and vanish on reload; here they
 * are written onto the *token* as it acquires them, so they belong to the creature the way they do
 * at a physical table, survive a refresh, and can be read by any client without asking the user
 * who set them. The token flag is `flags.starwrought.targets = {user, ids}`.
 *
 * While a token is being dragged the arrows and their distances follow the drag clone rather than
 * the token left behind (Mike, 2026-09-26), so a player can see the range change as they move and
 * stop where it suits them, instead of finding out after the move has been paid for.
 */

import * as SW from "../config.mjs";
import { gapBetween } from "./geometry.mjs";
import { reachesOf, previewOf } from "./reach.mjs";

const FLAG = "targets";

/** The PIXI container the arrows live in, one per canvas. */
let layer = null;

/** Register the hooks that keep the arrows and the tracker in step with the targets. */
export function registerTargeting() {
  Hooks.on("targetToken", onTargetToken);
  Hooks.on("canvasReady", () => {
    // A layer drawn between the canvas turning ready and this hook would otherwise be forgotten
    // while still attached (see reach.mjs).
    if (layer && !layer.destroyed) layer.destroy({ children: true });
    layer = null;
    refresh();
  });
  Hooks.on("refreshToken", () => refresh());
  Hooks.on("createToken", () => refresh());
  Hooks.on("deleteToken", () => refresh());
  Hooks.on("updateToken", (doc, changes) => {
    refresh();
    // A change of target is worth a fresh tracker; a token moving is not.
    if (foundry.utils.hasProperty(changes, `flags.${SW.SYSTEM_ID}`)) ui.combat?.render();
  });
  Hooks.on("renderCombatTracker", onRenderTracker);
  Hooks.on("deleteCombat", onCombatEnds);

  // Foundry clears the drag preview itself: at once on a cancel, and on a drop only after the token
  // update has come back from the server; either way it flags the original for a refresh, so the
  // refreshToken hook above is what normally settles the arrows. This timer is a fallback for a
  // client whose ticker is not running (a hidden tab), where render flags never flush. On a drop it
  // may fire while the clone is still in flight, which draws one more in-flight frame and no worse.
  document.addEventListener("pointerup", () => setTimeout(refresh, 0));
}

/* -------------------------------------------- */
/*  Remembering                                 */
/* -------------------------------------------- */

/**
 * Foundry tells every client about every user's target changes, one token at a time. Only the
 * client whose user made the change writes it down, and only after the burst has settled: a click
 * with releaseOthers fires once for the old target and once for the new.
 */
const persist = foundry.utils.debounce(async () => {
  if (!canvas?.ready) return;
  const ids = Array.from(game.user.targets).map(t => t.id);
  const sources = sourcesFor(game.user);

  for (const { token, explicit } of sources) {
    const doc = token.document;
    const mine = ids.filter(id => id !== token.id);
    const current = doc.getFlag(SW.SYSTEM_ID, FLAG);
    if (!mine.length) {
      // Take back what you wrote, or what a token you have selected is carrying. A token you are
      // only standing in for keeps whatever another user recorded on it.
      if (current && ((current.user === game.user.id) || explicit)) await doc.unsetFlag(SW.SYSTEM_ID, FLAG);
      continue;
    }
    if (current && (current.user === game.user.id) && sameSet(current.ids, mine)) continue;
    await doc.setFlag(SW.SYSTEM_ID, FLAG, { user: game.user.id, ids: mine });
  }

  // A player who retargets with nothing to carry it has made their last record stale, so it goes.
  // Not for a GM: a GM with nothing selected is usually inspecting a Threshold, and the monsters
  // they set up one by one must keep their targets.
  if (!sources.length && !game.user.isGM) {
    for (const token of canvas.tokens.placeables) {
      const current = token.document.getFlag(SW.SYSTEM_ID, FLAG);
      if ((current?.user === game.user.id) && token.document.isOwner) {
        await token.document.unsetFlag(SW.SYSTEM_ID, FLAG);
      }
    }
  }
}, 60);

/**
 * Only the user who changed targets records it, and never during a scene change: drawing a new
 * scene clears the old scene's targets through this same hook, with the old placeables already
 * destroyed, and that must not be read as the GM clearing the monster's targets.
 */
function onTargetToken(user, token) {
  if (user.id !== game.user.id) return;
  if (token.destroyed) return;
  persist();
}

/**
 * Whose targets are these? The tokens the user has selected, since that is who they are acting as.
 * Failing that, a player means their own character on this scene, or the one token they own here
 * if there is exactly one; a GM with nothing selected means the combatant whose Opportunity it is, so
 * long as no player owns it. Those stand-ins are not "explicit": the user speaks for them, but does
 * not overwrite what another user recorded on them.
 * @returns {Array<{token: Token, explicit: boolean}>}
 */
function sourcesFor(user) {
  const controlled = canvas.tokens.controlled.filter(t => t.document.isOwner);
  if (controlled.length) return controlled.map(token => ({ token, explicit: true }));

  if (user.isGM) {
    const combatant = game.combat?.combatant;
    const active = combatant?.token;
    const ownedByPlayer = combatant?.actor?.hasPlayerOwner ?? false;
    if (active && (active.parent === canvas.scene) && active.object && !ownedByPlayer) {
      return [{ token: active.object, explicit: false }];
    }
    return [];
  }

  const own = canvas.tokens.placeables.filter(t => t.document.isOwner && !t.document.hidden);
  const mine = user.character ? own.filter(t => t.actor?.id === user.character.id) : [];
  const fallback = mine.length ? mine : ((own.length === 1) ? own : []);
  return fallback.map(token => ({ token, explicit: false }));
}

function sameSet(a, b) {
  return (a.length === b.length) && a.every(id => b.includes(id));
}

/** A fight over is targets over: the active GM clears every remembered target on the scene. */
async function onCombatEnds(combat) {
  if (!game.user.isActiveGM) return;
  const scene = combat.scene ?? canvas?.scene;
  if (!scene) return;
  const updates = scene.tokens
    .filter(t => t.getFlag(SW.SYSTEM_ID, FLAG))
    .map(t => ({ _id: t.id, [`flags.${SW.SYSTEM_ID}.-=${FLAG}`]: null }));
  if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
}

/* -------------------------------------------- */
/*  The arrows                                  */
/* -------------------------------------------- */

/** Where the arrows are drawn: above the tokens, so a target is never hidden under one. */
function getLayer() {
  if (layer?.parent) return layer;
  if (!canvas?.ready) return null;
  const parent = canvas.interface ?? canvas.tokens;
  const existing = parent.children.find(c => (c.name === "starwrought.targets") && !c.destroyed);
  if (existing) {
    layer = existing;
    return layer;
  }
  layer = new PIXI.Container();
  layer.name = "starwrought.targets";
  layer.eventMode = "none";
  parent.addChild(layer);
  return layer;
}

/**
 * Redraw every arrow, coalesced so a token animating across the map costs one redraw per frame's
 * worth of hooks rather than one per hook. A timer rather than requestAnimationFrame on purpose:
 * a background tab gets no animation frames, and a latch waiting on one would swallow every
 * refresh until the tab came back.
 */
export const refresh = foundry.utils.debounce(draw, 16);

function draw() {
  const container = getLayer();
  if (!container) return;
  container.removeChildren().forEach(c => c.destroy({ children: true }));
  if (!game.settings.get(SW.SYSTEM_ID, "showTargetArrows")) return;

  for (const source of canvas.tokens.placeables) {
    const flag = source.document.getFlag(SW.SYSTEM_ID, FLAG);
    if (!flag?.ids?.length || !canSee(source)) continue;
    const color = colorOf(flag.user);
    for (const id of flag.ids) {
      const target = canvas.tokens.get(id);
      if (!target || (target === source) || !canSee(target)) continue;
      // Either end may be mid-drag; the clone is where the player is thinking, so draw to that.
      container.addChild(arrow(previewOf(source) ?? source, previewOf(target) ?? target, color));
    }
  }
}

/** A hidden token's targets are the GM's business. */
function canSee(token) {
  if (token.document.hidden && !game.user.isGM) return false;
  return token.visible;
}

/** The targeting player's colour, so it matches Foundry's own pips; gold if they have gone. */
function colorOf(userId) {
  const c = game.users.get(userId)?.color;
  return c ? Number(c) : 0xE3B23C;
}

/**
 * One arrow, from the edge of the source's space to the edge of the target's, so it reads as
 * "this one, at that one" rather than a line through two portraits.
 */
function arrow(source, target, color) {
  // Sized against the grid cell, which is what `100 * uiScale` is, so the arrow is the same
  // fraction of a creature's space whether the scene is drawn at 20 pixels a foot or 100.
  const cell = 100 * canvas.dimensions.uiScale;
  const width = Math.clamp(cell * 0.22, 3, 10);
  const head = Math.clamp(cell * 0.9, 12, 40);
  const wing = head / 2;

  // Touching spaces share an edge, so the two edge points coincide and there would be nothing to
  // draw, in exactly the melee case this exists for. Start from the centre instead, and if even
  // that leaves no room for the head, end at the target's centre too.
  let from = edgePoint(source, target.center);
  let to = edgePoint(target, source.center);
  if (distance(from, to) < head * 1.25) from = source.center;
  if (distance(from, to) < head * 1.25) to = target.center;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const tip = to;
  const base = { x: tip.x - (ux * head), y: tip.y - (uy * head) };
  const left = { x: base.x - (uy * wing), y: base.y + (ux * wing) };
  const right = { x: base.x + (uy * wing), y: base.y - (ux * wing) };

  const g = new PIXI.Graphics();

  // A dark underlay first, so the arrow reads on a light map as well as a dark one.
  g.lineStyle({ width: width * 2, color: 0x000000, alpha: 0.45, cap: PIXI.LINE_CAP.ROUND });
  g.moveTo(from.x, from.y).lineTo(base.x, base.y);
  g.lineStyle({ width: width * 0.8, color: 0x000000, alpha: 0.45, join: PIXI.LINE_JOIN.ROUND });
  g.beginFill(0x000000, 0.45).drawPolygon([tip.x, tip.y, left.x, left.y, right.x, right.y]).endFill();

  g.lineStyle({ width, color, alpha: 0.95, cap: PIXI.LINE_CAP.ROUND });
  g.moveTo(from.x, from.y).lineTo(base.x, base.y);
  g.lineStyle(0);
  g.beginFill(color, 0.95).drawPolygon([tip.x, tip.y, left.x, left.y, right.x, right.y]).endFill();
  g.beginFill(color, 0.95).drawCircle(from.x, from.y, width * 1.1).endFill();

  const whole = new PIXI.Container();
  whole.addChild(g);
  whole.addChild(distanceLabel(source, target, { x: (from.x + tip.x) / 2, y: (from.y + tip.y) / 2 }, cell));
  return whole;
}

/**
 * How far it is to the target, on the arrow, measured the way the handbook measures everything:
 * edge to edge, in whole squares, diagonals exact. Gold when the target is within the source's
 * Total Reach, since that is the question the number is usually answering. A drag clone's
 * document carries the in-flight position, so the number moves with the drag.
 */
function distanceLabel(source, target, at, cell) {
  const feet = gapBetween(source.document, target.document);
  const text = `${Number.isInteger(feet) ? feet : feet.toFixed(1)} ${canvas.scene.grid.units || "ft"}`;
  const actor = source.actor ?? source._original?.actor ?? null;
  const inReach = actor ? (feet <= (reachesOf(actor).total ?? 0)) : false;

  const style = CONFIG.canvasTextStyle.clone();
  style.fontSize = Math.clamp(cell * 0.9, 12, 22);
  style.fill = inReach ? 0xE3B23C : 0xF2EFFA;
  style.stroke = 0x000000;
  style.strokeThickness = Math.max(2, style.fontSize / 6);
  const label = new foundry.canvas.containers.PreciseText(text, style);
  label.anchor.set(0.5, 0.5);
  label.position.set(at.x, at.y);

  // A pill behind it, so the number reads over the line it sits on and whatever map is beneath.
  const pad = style.fontSize * 0.35;
  const pill = new PIXI.Graphics();
  pill.beginFill(0x000000, 0.6)
    .drawRoundedRect(at.x - (label.width / 2) - pad, at.y - (label.height / 2) - (pad / 2), label.width + (pad * 2), label.height + pad, style.fontSize / 2)
    .endFill();

  const c = new PIXI.Container();
  c.addChild(pill, label);
  return c;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Where a line from a token's centre towards a point leaves the token's bounds. */
function edgePoint(token, towards) {
  const c = token.center;
  const hw = token.w / 2;
  const hh = token.h / 2;
  const dx = towards.x - c.x;
  const dy = towards.y - c.y;
  if (!dx && !dy) return { x: c.x, y: c.y };
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + (dx * t), y: c.y + (dy * t) };
}

/* -------------------------------------------- */
/*  The tracker                                 */
/* -------------------------------------------- */

/**
 * Under each combatant, who it is targeting; on each row, whether the active combatant is
 * targeting it. Injected into core's rows rather than replacing its template, so a Foundry update
 * that reshapes the tracker leaves this a one-line fix rather than a rewrite.
 */
function onRenderTracker(app, element) {
  const combat = app.viewed ?? game.combat;
  if (!combat) return;
  const rows = element.querySelectorAll("li.combatant[data-combatant-id]");
  const inCrosshairs = new Set(combat.combatant?.token?.getFlag(SW.SYSTEM_ID, FLAG)?.ids ?? []);

  for (const li of rows) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    const token = combatant?.token;
    if (!token) continue;

    if (inCrosshairs.has(token.id)) li.classList.add("sw-in-crosshairs");

    const names = (token.getFlag(SW.SYSTEM_ID, FLAG)?.ids ?? [])
      .map(id => token.parent?.tokens.get(id))
      .filter(t => t && (t.id !== token.id) && (!t.hidden || game.user.isGM))
      .map(t => t.name);
    if (!names.length) continue;

    const line = document.createElement("div");
    line.className = "sw-tracker-targets";
    line.dataset.tooltip = game.i18n.localize("STARWROUGHT.Targeting.targets");
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-crosshairs";
    line.append(icon, " ", document.createTextNode(names.join(", ")));
    li.querySelector(".token-name")?.append(line);
  }
}
