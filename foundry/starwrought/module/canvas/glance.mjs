/**
 * THE GLANCE (0.19.0). Mike, playtest: "a feature that allows players to see certain things about
 * other actors --- for example, what weapons and armor are Equipped… what Zones are Exposed or
 * Wounded, etc."
 *
 * What anyone standing near could see: the actor's name, what it holds (a raised shield marked),
 * the armor it wears on each Zone by piece name, which Zones are Exposed or Wounded (the count),
 * and the conditions its token shows. The sheet's numbers stay the sheet's: Protection, Vigor,
 * Thresholds and Load Strain are shown to the actor's owner and the GM alone (`full`).
 *
 * Two surfaces read one `glanceData`: a hover card beside any token the user can see, drawn into
 * the page (not the canvas HUD layer, which scales with the zoom) after a short delay so a pass of
 * the mouse shows nothing, hidden as the mouse leaves or the canvas pans, re-rendered while shown
 * as the actor changes; and the LIMITED sheet, where a user with LIMITED permission sees this
 * panel and nothing else (`_configureRenderParts` on both actor sheets). Client setting
 * `showGlance` switches the hover card off; the sheet view does not depend on it.
 */

import * as SW from "../config.mjs";

const ELEMENT_ID = "sw-glance";
const TEMPLATE = "systems/starwrought/templates/actor/glance.hbs";
const DELAY_MS = 250;
const MARGIN = 8;

let timer = null;
let shown = null;

/** Register the hover card's hooks. Called once at init. */
export function registerGlance() {
  Hooks.on("hoverToken", onHoverToken);
  Hooks.on("canvasPan", hideGlance);
  Hooks.on("canvasTearDown", hideGlance);
  Hooks.on("deleteToken", hideGlance);
  Hooks.on("updateActor", actor => {
    if (shown?.actor === actor) refreshGlance();
  });
  Hooks.on("updateItem", item => {
    if (shown && (item.parent === shown.actor)) refreshGlance();
  });
}

/** Is the hover card switched on for this user? Read defensively for a build without the setting. */
export function glanceEnabled() {
  try {
    return game.settings.get(SW.SYSTEM_ID, "showGlance") !== false;
  } catch {
    return true;
  }
}

/* -------------------------------------------- */
/*  The data                                    */
/* -------------------------------------------- */

/**
 * What the glance shows of an actor.
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.full=false]  The owner's or the GM's view: Protection and Vigor too.
 * @returns {object}
 */
export function glanceData(actor, { full = false } = {}) {
  const localize = key => game.i18n.localize(key);
  const items = actor.items ?? [];
  const sys = actor.system ?? {};

  const held = items
    .filter(i => SW.PHYSICAL_TYPES.includes(i.type) && (i.type !== "armor") && i.system?.held)
    .map(i => ({ id: i.id, name: i.name, img: i.img, type: i.type, raised: (i.type === "shield") && !!i.system.raised }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const zones = Object.keys(SW.ZONES).map(zone => {
    const z = sys.zones?.[zone] ?? {};
    const piece = items.find(i => (i.type === "armor") && i.system?.worn && (i.system.zone === zone)) ?? null;
    const wounds = Number(z.wounds) || 0;
    const woundsLabel = wounds
      ? (wounds === 1 ? localize("STARWROUGHT.Glance.woundOne") : game.i18n.format("STARWROUGHT.Glance.wounds", { n: wounds }))
      : "";
    return {
      zone,
      label: localize(SW.ZONES[zone].label),
      piece: piece?.name ?? "",
      pieceImg: piece?.img ?? "",
      exposed: !!z.exposed,
      postureExposed: !!z.postureExposed,
      wounds,
      woundsLabel,
      protection: full && Number.isFinite(Number(z.protection)) ? Number(z.protection) : null
    };
  });

  // The conditions the token shows, by the registry's names, the four Exposed ones left out
  // (they are the Zones' marks above). A numeric one carries its value.
  const byStatus = new Map();
  for (const c of Object.values(SW.CONDITIONS)) {
    byStatus.set(c.id, c);
    if (c.statusId) byStatus.set(c.statusId, c);
  }
  const conditions = [...(actor.statuses ?? [])]
    .map(id => ({ id, condition: byStatus.get(id) ?? null }))
    .filter(({ condition }) => !condition?.zone)
    .map(({ id, condition }) => {
      const value = condition?.numeric ? (Number(actor.conditionValue?.(condition.id)) || 0) : 0;
      return { id, label: condition ? localize(condition.name) : id, img: condition?.img ?? "", value: value > 0 ? value : null };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    name: actor.name,
    img: actor.img,
    type: actor.type,
    full,
    held,
    zones,
    conditions,
    vigor: full && sys.vigor ? { value: sys.vigor.value ?? 0, max: sys.vigor.max ?? 0 } : null,
    anyWorn: zones.some(z => z.piece)
  };
}

/* -------------------------------------------- */
/*  The hover card                              */
/* -------------------------------------------- */

function onHoverToken(token, hovered) {
  clearTimeout(timer);
  timer = null;
  if (!hovered) return hideGlance();
  if (!glanceEnabled()) return;
  const actor = token?.actor;
  if (!actor?.system || !["character", "npc"].includes(actor.type)) return;
  timer = setTimeout(() => {
    timer = null;
    showGlance(token).catch(err => console.error("STARWROUGHT | the glance could not be drawn", err));
  }, DELAY_MS);
}

async function showGlance(token) {
  // The mouse left while the delay ran, or the scene went.
  if (!token?.hover || !canvas?.ready || token.destroyed) return;
  const actor = token.actor;
  if (!actor) return;
  const full = actor.isOwner || game.user.isGM;
  const html = await renderTemplate(TEMPLATE, { ...glanceData(actor, { full }), hover: true });
  let el = document.getElementById(ELEMENT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ELEMENT_ID;
    el.className = "starwrought sw-glance";
    document.body.append(el);
  }
  el.innerHTML = html;
  el.classList.add("sw-glance-shown");
  place(el, token);
  shown = { token, actor };
}

/** Beside the token, to its right, to its left when the right edge of the screen is near, inside the viewport. */
function place(el, token) {
  const topRight = canvas.clientCoordinatesFromCanvas({ x: token.x + token.w, y: token.y });
  const topLeft = canvas.clientCoordinatesFromCanvas({ x: token.x, y: token.y });
  const width = el.offsetWidth || 260;
  const height = el.offsetHeight || 200;
  let left = topRight.x + MARGIN;
  if (left + width > window.innerWidth - MARGIN) left = topLeft.x - MARGIN - width;
  left = Math.max(MARGIN, left);
  let top = topRight.y;
  if (top + height > window.innerHeight - MARGIN) top = window.innerHeight - MARGIN - height;
  top = Math.max(MARGIN, top);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

/** Re-draw the card while it is shown and its actor changed. */
function refreshGlance() {
  if (!shown?.token?.hover) return hideGlance();
  showGlance(shown.token).catch(err => console.error("STARWROUGHT | the glance could not be redrawn", err));
}

/** Take the card down. */
export function hideGlance() {
  clearTimeout(timer);
  timer = null;
  shown = null;
  const el = document.getElementById(ELEMENT_ID);
  if (el) {
    el.classList.remove("sw-glance-shown");
    el.innerHTML = "";
  }
}
