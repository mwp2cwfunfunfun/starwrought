/**
 * Every range an actor has, as one list (0.5.1).
 *
 * Reach was the first ring the map drew, and the handbook's "within N feet" abilities are rings of
 * the same kind: a distance from the edge of the carrier's space, measured the way the grid
 * measures everything. So the reach bands and the auras of the Talents and Maneuvers an actor owns
 * are entries of one derived list, `actor.system.ranges`, and the canvas, the token HUD and the
 * sheets read that list rather than each working the ranges out for themselves.
 *
 * An entry: { key, label, feet, audience, color, source, kind, visible, gmOnly }
 *   key       what a Visible mark in `actor.system.auras.visible` is filed under: the Item id for a
 *             Talent or Maneuver, `reach`, `totalReach` or `unwieldy` for the bands, a custom
 *             ring's own key
 *   label     the name to print beside the feet: the ability's name without its cost glyphs
 *   feet      the distance, a gap of this many feet or less being "within"
 *   audience  `all`, `allies` or `enemies` (SW.AURA_AUDIENCES); the bands are `all`
 *   color     "#rrggbb": SW.AURA_COLORS by audience for an ability, SW.REACH_COLORS for a band, the
 *             colour the user picked for a custom ring
 *   source    the Item the entry comes from (the Talent, the Maneuver, the weapon that sets Total
 *             Reach or the Unwieldy zone), or null
 *   kind      `reach`, `totalReach`, `unwieldy`, `talent`, `action` or `custom`
 *   visible   the mark as it stands: the actor's own if one is stored, else the default (the
 *             Item's `aura.visible`; false for a band; true for a custom ring, since a ring somebody
 *             drew by hand was drawn to be seen)
 *   gmOnly    a custom ring the players never see
 *
 * The list is in the order the sheet lists it: Total Reach, Natural Reach, Unwieldy, then the
 * abilities in the order the actor owns them, then the custom rings. The canvas sorts by feet when
 * it draws. A band whose distance is zero is left out; an ability's aura needs a positive range.
 */

import * as SW from "../config.mjs";

/**
 * The cost glyphs a Talent's or Maneuver's name carries, and a bracketed Reaction cost such as
 * "(⓿↺)", as build_foundry.mjs strips them: "Battle Cry ⓿↺" is labelled Battle Cry on the map.
 */
const GLYPHS = /\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)|[◆◇↺★⓿❶❷❸❹❺❻]/g;

/** The label keys of the three reach bands. */
const BAND_LABELS = Object.freeze({
  reach: "STARWROUGHT.Field.auraNaturalReach",
  totalReach: "STARWROUGHT.Field.totalReach",
  unwieldy: "STARWROUGHT.Trait.unwieldy"
});

/** Localize when a world is up; hand the key back when one is not, so the list is never broken by it. */
const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

/** A name with its glyphs removed and the spaces they left closed up. */
export function plainRangeLabel(name) {
  return String(name ?? "").replace(GLYPHS, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * The ranges of an actor, built from its prepared system data and the Items it owns. Called at
 * the end of the actor's own derived-data pass, which is what makes `actor.system.ranges` current;
 * callable afterwards by anything that wants the list fresh.
 * @param {Actor} actor
 * @returns {Array<object>}
 */
export function rangesOf(actor) {
  const system = actor?.system;
  if (!system) return [];
  const marks = system.auras?.visible ?? {};
  const markOf = (key, fallback) => (typeof marks[key] === "boolean") ? marks[key] : fallback;
  const out = [];

  // The reach bands. A character derives Total Reach from the longest melee weapon in hand; an
  // adversary carries reach on its attacks instead, so its longest attack stands in (as reach.mjs
  // has always read it), and its Natural Reach when it has none.
  const natural = system.reach ?? 0;
  const attacks = system.attacks ?? [];
  const longest = attacks.reduce((best, a) => ((a.reach ?? 0) > (best?.reach ?? 0) ? a : best), null);
  const total = system.totalReach ?? (longest?.reach || natural);
  const weapon = system.reachWeapon ?? (longest ? (actor.items?.get?.(longest.id) ?? null) : null);
  const unwieldy = system.unwieldy ?? 0;
  const band = (key, feet, source) => ({
    key, label: localize(BAND_LABELS[key]), feet, audience: "all", color: SW.REACH_COLORS[key],
    source, kind: key, visible: markOf(key, false), gmOnly: false
  });
  if (total > 0) out.push(band("totalReach", total, weapon));
  if (natural > 0) out.push(band("reach", natural, null));
  if (unwieldy > 0) out.push(band("unwieldy", unwieldy, weapon));

  // The abilities: every Talent or Maneuver owned whose aura has a range.
  for (const item of actor.items ?? []) {
    if ((item.type !== "talent") && (item.type !== "action")) continue;
    const aura = item.system?.aura;
    if (!Number.isInteger(aura?.range) || (aura.range <= 0)) continue;
    const audience = SW.AURA_COLORS[aura.affects] ? aura.affects : "all";
    out.push({
      key: item.id, label: plainRangeLabel(item.name), feet: aura.range, audience,
      color: SW.AURA_COLORS[audience], source: item, kind: item.type,
      visible: markOf(item.id, !!aura.visible), gmOnly: false
    });
  }

  // The custom rings drawn on the token HUD.
  for (const ring of system.auras?.custom ?? []) {
    if (!ring?.key || !(ring.feet > 0)) continue;
    const audience = SW.AURA_COLORS[ring.audience] ? ring.audience : "all";
    out.push({
      key: ring.key, label: ring.label || localize("STARWROUGHT.Field.auraCustom"), feet: ring.feet,
      audience, color: ring.color || SW.AURA_COLORS[audience], source: null, kind: "custom",
      visible: markOf(ring.key, true), gmOnly: !!ring.gmOnly
    });
  }

  return out;
}
