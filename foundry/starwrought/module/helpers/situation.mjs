/**
 * The character's situation, read in one place (0.28.0; rulings 281 to 289): what the Maneuvers tab
 * needs to know to say which Maneuvers apply now. The words a `[REQUIRES ...]` block may use, the
 * three answers and the four reasons a row is left out are plain data in module/rules/requires.mjs;
 * this is the Foundry side, the one reader of the Actor, the Combat and the map for them.
 *
 * What it reads, and what it says when it cannot tell:
 *  - the Conditions (the Actor's statuses), the Bind's state, the spells owned;
 *  - what is in hand: a held shield and whether it is Raised, the held weapons with their reach and
 *    traits, a rigid implement, and the hand count (`freeHands`, an estimate that says null when
 *    gear marked In hand leaves it unsure);
 *  - who is near: every other token on the viewed scene the CHARACTER can see (`canSeeToken`: the
 *    walls, and the Hidden and Undetected statuses), with its relation, the gap in feet and whether
 *    that is within the character's reach. A token the players are not shown (hidden on the scene),
 *    a party token and a dead body are not counted. Null, "cannot tell", when the character has no
 *    token on the viewed scene or is Blinded;
 *  - the encounter: whether the character is a fighter in a running one, the actions left, whether
 *    it is the character's Opportunity, whether the GM's approval of one off-turn Maneuver stands,
 *    and the `trackActions` setting.
 *
 * THE GM SEES WHAT THE PLAYER SEES. Nothing here asks who is looking: the sight is the character's
 * token's and the Opportunity is the character's, so the GM's copy of a sheet lists what the
 * player's does (`actor.canActNow()` is true for any GM and is never asked here).
 */

import * as SW from "../config.mjs";
import { relation, canSeeToken } from "../rules/scene.mjs";
import { gapBetween } from "../canvas/geometry.mjs";
import { reachesOf } from "../canvas/reach.mjs";
import { hasPermit } from "../documents/cards/opportunity.mjs";
import { ENGINE_REQUIRES } from "../documents/maneuvers.mjs";
import { freeHands, requiresFor, maneuverStatus } from "../rules/requires.mjs";
import { setting } from "./settings.mjs";

/** The Bind states a character may be in; anything else is no Bind. */
const BIND_STATES = Object.freeze(["neutral", "controlling", "controlled"]);

/** A weapon's traits as the words a block names: the first word of each, lower-cased. */
function traitWords(item) {
  const words = new Set();
  for (const trait of item.system.traits ?? []) {
    // "Thrown 10 ft" is `thrown`; "Grapple, Trip" (one cell, two Maneuver traits) is both.
    for (const part of String(trait).split(",")) {
      const word = part.trim().toLowerCase().split(/\s+/)[0];
      if (word) words.add(word);
    }
  }
  for (const word of item.system.flags?.maneuvers ?? []) words.add(String(word).toLowerCase());
  return [...words];
}

/**
 * Who is near the character, as it can see them; null when that cannot be told.
 * @param {Actor} actor
 * @returns {Array<{relation: string, gap: number, inReach: boolean}>|null}
 */
function nearOf(actor) {
  if (!globalThis.canvas?.ready || !canvas.scene) return null;
  const own = actor.tokenOnScene?.() ?? null;
  if (!own || (own.parent !== canvas.scene)) return null;
  // A Blinded fighter sees nobody, and may still reach for somebody: not known either way.
  if (actor.statuses?.has("blinded")) return null;
  // "In reach" is the longer of the body's own reach and the reach of what is in hand. The sheet's
  // Total Reach alone would not do: it reads 0 for a character whose only weapon in hand is a
  // ranged one (a bow reaches nothing in melee), and the free hand beside it still reaches.
  const reaches = reachesOf(actor);
  const reach = Math.max(Number(reaches.total) || 0, Number(reaches.natural) || 0);
  const near = [];
  for (const placeable of canvas.tokens?.placeables ?? []) {
    const doc = placeable.document;
    if (!doc || (doc.id === own.id)) continue;
    const other = placeable.actor;
    if (!other || (other.type === SW.PARTY_TYPE)) continue;
    if (doc.hidden || other.statuses?.has("dead")) continue;
    if (!canSeeToken(own, doc)) continue;
    let gap;
    try { gap = gapBetween(own, doc); } catch { continue; }
    near.push({ relation: relation(own, doc), gap, inReach: gap <= reach });
  }
  return near;
}

/**
 * The character's situation, for `maneuverStatus` and `checkCondition` (module/rules/requires.mjs,
 * the `Situation` typedef there).
 * @param {Actor} actor
 * @returns {object}
 */
export function situationOf(actor) {
  const items = actor.items ?? [];
  const weapons = items.filter(i => (i.type === "weapon") && i.system.held);
  const shields = items.filter(i => (i.type === "shield") && i.system.held);
  const gear = items.filter(i => (i.type === "gear") && i.system.held);
  const state = actor.system?.bind?.state;
  const encounter = !!actor.inEncounter;
  // WHO IS NEAR is worked out only when a row asks (a `foe adjacent`, a `creature in reach`), and
  // then once: it is a sight test against the walls for every token on the scene, and most rows
  // name no one. A character none of whose Maneuvers carries such a block never pays for it.
  let near;
  let looked = false;
  return {
    get near() {
      if (!looked) {
        looked = true;
        near = nearOf(actor);
      }
      return near;
    },
    conditions: [...(actor.statuses ?? [])],
    bind: BIND_STATES.includes(state) ? state : null,
    spells: items.filter(i => (i.type === "talent") && i.system.isSpell).length,
    shield: { held: shields.length > 0, raised: shields.some(s => !!s.system.raised) },
    rigid: weapons.some(w => !!w.system.rigid) || shields.length > 0,
    hands: freeHands([
      ...weapons.map(w => ({ type: "weapon", natural: !!w.system.natural, twoHands: !!w.system.twoHands || !!w.system.flags?.twoHanded })),
      ...shields.map(() => ({ type: "shield" })),
      ...gear.map(() => ({ type: "gear" }))
    ]),
    weapons: weapons.map(w => ({ reach: w.system.isRanged ? "ranged" : "melee", traits: traitWords(w) })),
    encounter,
    tracking: !!setting("trackActions", true),
    actionsLeft: Math.max(0, Number(actor.system?.actions?.value) || 0),
    isTurn: !!actor.isTurn,
    permit: encounter && hasPermit(actor)
  };
}

/**
 * A Maneuver as `maneuverStatus` reads it: its slug, the conditions that stand for it (its own
 * `[REQUIRES ...]` blocks, else the engine's for one the system runs), its mode, whether it is
 * performed outside the Opportunity, and what it may cost.
 *
 * A REACTION, for the tab: the Item's Reaction flag, the Reaction trait, or a Trigger. Some rows
 * carry a Trigger with no ↺ in their Cost cell (Battle Cry, Sure Seat, Steady the Line); the engine
 * still charges and gates those as plain Maneuvers (the open point of 0.23.0), but a row with a
 * Trigger is by its own text something done when the Trigger comes, so the tab does not hide it for
 * want of the Opportunity.
 * @param {Item} item  An action Item, owned or straight from the compendium.
 * @returns {{slug: string, requires: object[], mode: string, reaction: boolean, costs: number[], reactionCost: number|null}}
 */
export function maneuverRow(item) {
  const sys = item.system ?? {};
  const slug = SW.slugify(SW.plainName(item.name));
  const traits = (sys.traits ?? []).map(t => String(t).trim().toLowerCase());
  const mode = (sys.isDowntime || traits.includes("downtime")) ? "downtime"
    : (sys.isExploration || traits.includes("exploration")) ? "exploration" : "encounter";
  const own = sys.reactionCost;
  let requires = [];
  try {
    requires = requiresFor(sys.rules, ENGINE_REQUIRES[slug]);
  } catch (error) {
    // The engine's own words are checked by the self-test; a failure here must not take the tab down.
    console.error(`STARWROUGHT | ${item.name}: its conditions could not be read`, error);
  }
  return {
    slug,
    requires,
    mode,
    reaction: !!sys.reaction || traits.includes("reaction") || !!String(sys.trigger ?? "").trim(),
    costs: SW.actionCostOptions(sys),
    reactionCost: (sys.reaction && (own !== undefined) && (own !== null) && (own !== "")) ? SW.actionCostValue(own) : null
  };
}

/**
 * Does this Maneuver apply now for this character, and if not, why not, in the viewer's language?
 * @param {Item} item
 * @param {object} situation  `situationOf(actor)`, read once for the whole tab.
 * @returns {{slug: string, applicable: boolean, reasons: string[]}}
 */
export function statusOf(item, situation) {
  const row = maneuverRow(item);
  const status = maneuverStatus(row, situation);
  return { slug: row.slug, applicable: status.applicable, reasons: status.reasons.map(reasonText) };
}

/** One reason as a line of the row's tooltip. */
function reasonText(reason) {
  const format = (key, data) => game.i18n.format(key, data);
  switch (reason.code) {
    case "requires": return format("STARWROUGHT.Maneuvers.reasonNeeds", { needs: reason.needs });
    case "mode": return game.i18n.localize(reason.mode === "downtime" ? "STARWROUGHT.Maneuvers.reasonDowntime" : "STARWROUGHT.Maneuvers.reasonExploration");
    case "opportunity": return game.i18n.localize("STARWROUGHT.Maneuvers.reasonOpportunity");
    case "cost": return format(reason.left === 1 ? "STARWROUGHT.Maneuvers.reasonCostOne" : "STARWROUGHT.Maneuvers.reasonCost", {
      cost: SW.ACTION_GLYPHS[reason.cost] ?? String(reason.cost), left: reason.left
    });
    default: return "";
  }
}
