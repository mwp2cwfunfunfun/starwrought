/**
 * The Bind, made visible (0.5.1, T3).
 *
 * A Bind is two implements in contact (PHB v4.10, The Bind), and the handbook asks the table to
 * track it as a relationship: "longsword / spear", or "shield > bite" when one fighter has the
 * line. The actors record it on both sides (`system.bind`), the token shows a Bound, Controlling
 * or Controlled status, but neither says *with whom* at a glance. This draws the relationship on
 * the map, for everyone who can see both tokens:
 *
 *   A neutral Bind is a chain in gold between the two tokens, labelled with the two implements.
 *
 *   A Controlled Bind runs from the Controller to the Controlled, with an arrowhead at the
 *   Controlled end and a small "Control" label beside it, so who holds the line reads at once.
 *
 *   While either token is hidden the chain is dashed and only the GM sees it.
 *
 * The chain follows a drag clone, as the targeting arrows do, so a player sees the line stretch
 * before the Move that would end it is paid for.
 *
 * This module also keeps the pair whole. A Bind is written on two actors, and the client that
 * forms it may own only one of them (a player clicking "Form a Bind" on the card against an
 * adversary). The actor update carries an `swBind` option saying whether the writer handled both
 * sides; when it did not, the one client elected to write for the partner (the active GM, else the
 * first connected owner) writes the mirror as the update reaches it. The same pickup clears the
 * partner's side when a Bind ends. A sweep at ready settles anything left half-written while an
 * owner was away.
 */

import * as SW from "../config.mjs";
import { previewOf } from "./reach.mjs";

/** The system's gold (`--sw-gold`), the colour the Bind takes on the sheet as well. */
const GOLD = 0xE3B23C;

/** This actor's state -> the state the partner's side must show. */
const MIRROR = Object.freeze({ neutral: "neutral", controlling: "controlled", controlled: "controlling" });

/** The PIXI container the chains live in, one per canvas. */
let layer = null;

/** Register the hooks that keep the chains on the map and the pairs whole. */
export function registerBind() {
  // A scene change brings this scene's unlinked tokens into the sweep, so it runs again here.
  Hooks.on("canvasReady", () => { layer = null; refresh(); if (game.ready) keepPaired(); });
  Hooks.on("refreshToken", () => refresh());
  Hooks.on("createToken", () => refresh());
  Hooks.on("deleteToken", () => refresh());
  Hooks.on("updateToken", () => refresh());
  Hooks.on("deleteActor", () => refresh());
  Hooks.on("updateActor", onUpdateActor);
  Hooks.once("ready", () => keepPaired());

  // The drag preview is cleared by Foundry on a cancel or, on a drop, once the token update is
  // back from the server, and the refreshToken hook settles the chain then. A client whose
  // ticker is not running (a hidden tab) flushes no render flags, so this is the fallback.
  document.addEventListener("pointerup", () => setTimeout(refresh, 0));
}

/* -------------------------------------------- */
/*  Keeping the pair whole                      */
/* -------------------------------------------- */

/** A Bind written anywhere redraws the map and, if its other half is missing, writes it. */
function onUpdateActor(actor, changes, options) {
  if (!foundry.utils.hasProperty(changes, "system.bind")) return;
  refresh();
  pickUpMirror(actor, options?.swBind ?? {});
}

/**
 * Write the partner's side of a Bind this actor just recorded, or clear it for a Bind this actor
 * just ended, when the writer could not and this client is the one elected to.
 * @param {Actor} actor
 * @param {{paired?: boolean, previousPartner?: string}} mark  The update's `swBind` option.
 */
function pickUpMirror(actor, { paired = true, previousPartner = "" } = {}) {
  if (paired) return;
  const bind = actor.system?.bind;
  const partner = resolveActor(bind?.state ? bind.partnerUuid : previousPartner);
  if (!partner || (partner === actor) || !partner.isOwner || !isMirrorWriter(partner)) return;
  const theirs = partner.system?.bind;

  if (bind?.state) {
    const want = MIRROR[bind.state];
    if ((theirs?.state === want) && (theirs.partnerUuid === actor.uuid)) return;
    partner.formBind(actor, { state: want, mine: bind.theirs, theirs: bind.mine, announce: false, pair: false })
      .catch(err => console.error(`STARWROUGHT | ${partner.name}: the Bind's other side could not be written`, err));
    return;
  }
  if (theirs?.state && (theirs.partnerUuid === actor.uuid)) {
    partner.endBind({ announce: false, pair: false })
      .catch(err => console.error(`STARWROUGHT | ${partner.name}: the Bind's other side could not be cleared`, err));
  }
}

/**
 * Exactly one client writes a mirror: the active GM, who owns everything, else the connected
 * owner with the lowest id. Two owners of one character therefore never race each other.
 */
function isMirrorWriter(actor) {
  const gm = game.users.activeGM;
  if (gm) return gm.id === game.user.id;
  const owners = game.users
    .filter(u => u.active && actor.testUserPermission(u, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  return owners[0]?.id === game.user.id;
}

/**
 * Settle half-written pairs: every actor recording a Bind whose partner does not record it back
 * gets its mirror written, by the elected client. Run once at ready, for a Bind formed while the
 * partner's owner was away; a Bind formed while they are connected is picked up as it is written.
 */
export function keepPaired() {
  const actors = [...game.actors];
  for (const token of canvas?.scene?.tokens ?? []) {
    if (!token.actorLink && token.actor) actors.push(token.actor);
  }
  for (const actor of actors) {
    if (actor.system?.bind?.state) pickUpMirror(actor, { paired: false });
  }
}

/** The Actor behind a uuid, whether the uuid names an Actor or a Token; null when it names nothing. */
function resolveActor(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { doc = null; }
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  return doc.actor ?? null;
}

/* -------------------------------------------- */
/*  The chains                                  */
/* -------------------------------------------- */

/** Where the chains are drawn: above the tokens, with the targeting arrows. */
function getLayer() {
  if (layer?.parent) return layer;
  if (!canvas?.ready) return null;
  layer = new PIXI.Container();
  layer.name = "starwrought.binds";
  layer.eventMode = "none";
  (canvas.interface ?? canvas.tokens).addChild(layer);
  return layer;
}

/**
 * Redraw every chain, coalesced so a token animating across the map costs one redraw per frame's
 * worth of hooks. A timer rather than requestAnimationFrame, for the same reason as targeting.mjs:
 * a background tab gets no animation frames.
 */
export const refresh = foundry.utils.debounce(draw, 16);

function draw() {
  const container = getLayer();
  if (!container) return;
  container.removeChildren().forEach(c => c.destroy({ children: true }));

  const seen = new Set();
  for (const token of canvas.tokens.placeables) {
    const bind = token.actor?.system?.bind;
    if (!bind?.state || !(bind.state in MIRROR)) continue;
    const partner = partnerTokenOf(token, bind);
    if (!partner) continue;

    // One chain per pair, whichever side is met first.
    const key = [token.id, partner.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (!canSee(token) || !canSee(partner)) continue;

    // The Controller's token is the chain's source; a neutral Bind reads from whichever side came
    // first, with its own implement named first.
    let from = token;
    let to = partner;
    let mine = bind.mine;
    let theirs = bind.theirs;
    if (bind.state === "controlled") {
      [from, to, mine, theirs] = [partner, token, bind.theirs, bind.mine];
    }
    container.addChild(chain(previewOf(from) ?? from, previewOf(to) ?? to, {
      control: bind.state !== "neutral",
      dashed: token.document.hidden || partner.document.hidden,
      mine,
      theirs
    }));
  }
}

/**
 * The token on this scene at the other end of a Bind. A synthetic actor has exactly one; a linked
 * actor with several tokens here is taken to be the nearest one, since a Bind is contact.
 */
function partnerTokenOf(token, bind) {
  const actor = resolveActor(bind.partnerUuid);
  if (!actor) return null;
  const candidates = actor.getActiveTokens(false, false).filter(t => (t !== token) && !t.destroyed);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const d = t => Math.hypot(t.center.x - token.center.x, t.center.y - token.center.y);
  return candidates.sort((a, b) => d(a) - d(b))[0];
}

/** A hidden token's Bind is the GM's business. */
function canSee(token) {
  if (token.document.hidden && !game.user.isGM) return false;
  return token.visible;
}

/**
 * One chain: two gold rails a little apart with rungs between them, from the edge of one token's
 * space to the edge of the other's, a label at the midpoint naming the two implements, and for a
 * Controlled Bind an arrowhead at the Controlled end with "Control" beside it.
 */
function chain(from, to, { control, dashed, mine, theirs }) {
  // Sized against the grid cell (`100 * uiScale`), so the chain is the same fraction of a space
  // whether the scene draws a foot at 20 pixels or 100.
  const cell = 100 * canvas.dimensions.uiScale;
  const width = Math.clamp(cell * 0.16, 2.5, 8);
  const gap = width * 1.3;
  const head = control ? Math.clamp(cell * 0.9, 12, 40) : 0;

  // Touching spaces share an edge, and a Bind is almost always touching spaces, so the two edge
  // points would coincide. Fall back to the centres, as the targeting arrow does.
  let a = edgePoint(from, to.center);
  let b = edgePoint(to, from.center);
  if (distance(a, b) < Math.max(head * 1.25, cell * 0.6)) a = from.center;
  if (distance(a, b) < Math.max(head * 1.25, cell * 0.6)) b = to.center;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // The perpendicular, for the two rails.
  const nx = -uy * gap;
  const ny = ux * gap;

  // The rails stop short of the arrowhead.
  const end = control ? { x: b.x - (ux * head), y: b.y - (uy * head) } : b;
  const rails = [
    [{ x: a.x + nx, y: a.y + ny }, { x: end.x + nx, y: end.y + ny }],
    [{ x: a.x - nx, y: a.y - ny }, { x: end.x - nx, y: end.y - ny }]
  ];

  const g = new PIXI.Graphics();

  // A dark underlay first, so the chain reads on a pale map as well as a dark one.
  g.lineStyle({ width: width * 2.2, color: 0x000000, alpha: 0.45, cap: PIXI.LINE_CAP.ROUND });
  for (const [p, q] of rails) stroke(g, p, q, dashed, cell);
  g.lineStyle({ width, color: GOLD, alpha: 0.95, cap: PIXI.LINE_CAP.ROUND });
  for (const [p, q] of rails) stroke(g, p, q, dashed, cell);

  // The rungs, which are what make two lines read as a chain rather than a road.
  const railLength = distance(a, end);
  const step = Math.max(cell * 0.7, width * 6);
  g.lineStyle({ width: Math.max(1.5, width * 0.6), color: GOLD, alpha: 0.85, cap: PIXI.LINE_CAP.ROUND });
  for (let t = step / 2; t < railLength; t += step) {
    const cx = a.x + (ux * t);
    const cy = a.y + (uy * t);
    g.moveTo(cx + nx, cy + ny).lineTo(cx - nx, cy - ny);
  }
  g.lineStyle(0);

  if (control) {
    const wing = head / 2 + gap;
    const base = end;
    const left = { x: base.x - (uy * wing), y: base.y + (ux * wing) };
    const right = { x: base.x + (uy * wing), y: base.y - (ux * wing) };
    g.lineStyle({ width: width * 0.8, color: 0x000000, alpha: 0.45, join: PIXI.LINE_JOIN.ROUND });
    g.beginFill(0x000000, 0.45).drawPolygon([b.x, b.y, left.x, left.y, right.x, right.y]).endFill();
    g.lineStyle(0);
    g.beginFill(GOLD, 0.95).drawPolygon([b.x, b.y, left.x, left.y, right.x, right.y]).endFill();
  }

  const whole = new PIXI.Container();
  whole.addChild(g);

  const weapon = game.i18n.localize("STARWROUGHT.Bind.weapon");
  const names = game.i18n.format("STARWROUGHT.Bind.lineLabel", { mine: mine || weapon, theirs: theirs || weapon });
  whole.addChild(label(names, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cell, 0.9));
  if (control) {
    // "Control" sits beside the head, off the line so it never covers the implements.
    const at = { x: b.x - (ux * head * 1.6) - (uy * cell * 0.9), y: b.y - (uy * head * 1.6) + (ux * cell * 0.9) };
    whole.addChild(label(game.i18n.localize("STARWROUGHT.Bind.controlLabel"), at, cell, 0.75, 0xF2EFFA));
  }
  return whole;
}

/** One rail: solid, or dashed while a hidden token is at either end. */
function stroke(g, p, q, dashed, cell) {
  if (!dashed) {
    g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    return;
  }
  const len = distance(p, q);
  if (!len) return;
  const ux = (q.x - p.x) / len;
  const uy = (q.y - p.y) / len;
  const dash = Math.max(6, cell * 0.5);
  const space = Math.max(4, cell * 0.3);
  for (let t = 0; t < len; t += dash + space) {
    const e = Math.min(len, t + dash);
    g.moveTo(p.x + (ux * t), p.y + (uy * t)).lineTo(p.x + (ux * e), p.y + (uy * e));
  }
}

/** A label on a dark pill, in the style of the targeting arrows' distance. */
function label(text, at, cell, scale, color = GOLD) {
  const style = CONFIG.canvasTextStyle.clone();
  style.fontSize = Math.clamp(cell * scale, 11, 22);
  style.fill = color;
  style.stroke = 0x000000;
  style.strokeThickness = Math.max(2, style.fontSize / 6);
  const t = new foundry.canvas.containers.PreciseText(text, style);
  t.anchor.set(0.5, 0.5);
  t.position.set(at.x, at.y);

  const pad = style.fontSize * 0.35;
  const pill = new PIXI.Graphics();
  pill.beginFill(0x000000, 0.6)
    .drawRoundedRect(at.x - (t.width / 2) - pad, at.y - (t.height / 2) - (pad / 2), t.width + (pad * 2), t.height + pad, style.fontSize / 2)
    .endFill();

  const c = new PIXI.Container();
  c.addChild(pill, t);
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
