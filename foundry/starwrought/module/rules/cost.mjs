/**
 * Where a Maneuver's cost is settled, and whether a Condition raises it (0.37.0; rulings 375 to
 * 384). The `cost` kind (./kinds/cost.mjs) reads the line that says how many more actions a thing
 * with a trait costs a creature; this module asks it of a creature (`costRaise`) and says WHICH
 * THINGS that reaches, in one place, for three readers that must agree:
 *
 *  - the charge (`SwItem##chargePlan`, documents/item.mjs): what a use is paid at;
 *  - the Maneuvers tab and the adversary sheet (helpers/situation.mjs): the "+1" beside a row's
 *    cost, and whether the row can still be paid for;
 *  - the build (assets/build_foundry.mjs): its warning when a `COST` line names a trait carried
 *    by a row the raise does not reach.
 *
 * So the tab never promises a raise the system does not charge (the second reader of the design,
 * 2026-11-19).
 *
 * THE ROADS, in the order `SwItem##useManeuver` takes them:
 *   builtin    the system runs the Maneuver in its own code and pays there (Raise a Shield, Reload,
 *              Gain Control, Strike, Pass). NOT REACHED, except Recenter, whose own method asks
 *              (`SwActor#recenterCost`): road `recenter`.
 *   use        an owned row whose rule acts when it is used (MARK, PERMIT, SUBORDINATE): paid in
 *              `##useWithRules`, which has no Prepared branch. Not reached.
 *   elsewhere  paid by the drag, the weapon or the spell (`PAID_ELSEWHERE`), by an attack of the
 *              row's own, or from a button on a card (a REROLL, a Reaction's IMMUNE). Not reached.
 *   reaction   a Reaction pays its own half at the click. Not reached.
 *   passive    an Activity or an Endeavor costs no actions. Nothing to raise.
 *   row        everything else: `##chargePlan` settles the cost, and the raise is added there.
 *
 * A Maneuver performed as part of another is paid at its parent's listed cost and is not raised
 * either (`partOf`, which never comes through `##chargePlan`).
 *
 * THE READER LIVES HERE TOO (`costRaise`, with `carriesTrait`, `raiseWords` and `raiseReason`),
 * not in the kind's file: it reads the actor's rule index, which is the engine's, and the engine
 * imports the registry, which imports the kind. This module imports the registry FIRST, so it may
 * be the first module of the rules that anything imports (the review of 0.37.0).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE: the self-test and the build import it
 * from Node, and hand it plain objects shaped like an action Item (`{ name, type, system }`).
 */

import { slugify, plainName, actionCostOptions } from "../config.mjs";
import { kindOf } from "./kinds/index.mjs";
import { rulesOfKind, isConditionCarrier } from "./engine.mjs";
import { COST_RAISE_MAX } from "./kinds/cost.mjs";
import { traitGroups, traitKeysOf } from "./immunity.mjs";
import { BUILT_IN_MANEUVERS, CHARACTER_BUILT_INS, PAID_ELSEWHERE, RAISED_BUILT_INS, BUILT_IN_TRAITS } from "../documents/maneuvers.mjs";

/**
 * Does a thing carry a trait OUTRIGHT (ruling 384)? A trait written "Auditory or Visual" says the
 * thing works one way or the other, so it is neither trait for a cost: only a trait written alone
 * counts. (An immunity reads the same list the other way round: such a thing is stopped only by
 * immunity to both, ./immunity.mjs.)
 * @param {string[]|null|undefined} traits  The thing's traits, as its Item stores them.
 * @param {string} key  A trait's key (`traitKey`).
 * @returns {boolean}
 */
export function carriesTrait(traits, key) {
  if (!key) return false;
  return traitGroups(traits).some(group => (group.length === 1) && (group[0] === key));
}

/**
 * How many more actions does a thing with these traits cost this creature now, and by which
 * Conditions? The reader every place that settles a cost asks (the `cost` kind, ./kinds/cost.mjs).
 *
 * ONE CONDITION COUNTS ONCE, its largest line that matches; TWO CONDITIONS ADD (ruling 381). A
 * Condition held only against one creature (an "against X" inclusion; ./engine.mjs,
 * `conditionCarriers`) is passed over: a cost has no other party. Only a Condition's lines are
 * read (ruling 379): a `cost` rule stored on anything else is not this version's to apply. A
 * stored value above the kind's ceiling (a hand-edited file; the parse refuses one) counts as the
 * ceiling.
 *
 * A calculation: nothing is spent, nothing is written, and every client answers the same.
 * @param {object|null} actor
 * @param {string[]|null|undefined} traits  The traits of the thing being used.
 * @returns {{extra: number, by: Array<{id: string, name: string, value: number, trait: string, traitName: string}>}}
 */
export function costRaise(actor, traits) {
  const none = { extra: 0, by: [] };
  if (!actor || !Array.isArray(traits) || !traits.length) return none;
  let entries;
  try {
    entries = rulesOfKind(actor, "cost");
  } catch {
    return none;
  }
  const byCarrier = new Map();
  for (const { rule, item } of entries ?? []) {
    if (!rule || !isConditionCarrier(item)) continue;
    const stored = Math.floor(Number(rule.value));
    if (!Number.isFinite(stored) || (stored <= 0) || !rule.trait) continue;
    const value = Math.min(stored, COST_RAISE_MAX);
    if (Array.isArray(item.condition?.against)) continue;
    if (!carriesTrait(traits, String(rule.trait))) continue;
    const key = String(item.condition?.id ?? item.id ?? item.name ?? "");
    const held = byCarrier.get(key);
    if (held && (held.value >= value)) continue;
    byCarrier.set(key, { id: key, name: String(item.name ?? key), value, trait: String(rule.trait), traitName: String(rule.name ?? rule.trait) });
  }
  const by = [...byCarrier.values()];
  return { extra: by.reduce((n, b) => n + b.value, 0), by };
}

/**
 * The raise in a few words, for a spend's label: "Heedless +1"; two Conditions, "Heedless +1,
 * Dazed +1". Empty when nothing is raised. Plain English, as every summary of the grammar is.
 * @param {{by?: Array<{name: string, value: number}>}} raise
 * @returns {string}
 */
export function raiseWords(raise) {
  return (raise?.by ?? []).map(b => `${b.name} +${b.value}`).join(", ");
}

/**
 * The raise as a reason, for a card's own line: "Heedless: Concentrate takes 1 extra action"; two
 * Conditions are joined by a semicolon. Empty when nothing is raised.
 * @param {{by?: Array<{name: string, value: number, traitName: string}>}} raise
 * @returns {string}
 */
export function raiseReason(raise) {
  return (raise?.by ?? [])
    .map(b => `${b.name}: ${b.traitName} takes ${b.value} extra action${b.value === 1 ? "" : "s"}`)
    .join("; ");
}

/**
 * Is this Maneuver's cost taken somewhere other than its own row (0.23.0, ruling 235)? The i18n
 * key of the line its card says, or null. By name (`PAID_ELSEWHERE`: Cast, the movement
 * rows); by an attack of its own, which `attackWith` pays for; or by a rule that acts from a
 * button on a card, asked of the registry rather than a list of kinds (a `reroll`'s button, as
 * Quick Tongue's; a `prevent`'s Reaction button): such a Maneuver pays when that button is pressed,
 * so its row must not pay as well. (In documents/item.mjs through 0.36.0.)
 * @param {object} item  An action Item, or its plain data.
 * @returns {string|null}
 */
export function paidElsewhere(item) {
  // An own key only: a Maneuver named "Constructor" is no row of the table (the review of 0.37.0).
  const slug = slugify(plainName(item?.name ?? ""));
  const named = Object.hasOwn(PAID_ELSEWHERE, slug) ? PAID_ELSEWHERE[slug] : null;
  if (named) return named;
  if (item?.system?.attack?.enabled) return "STARWROUGHT.Cost.paidByAttack";
  // A `prevent` pays from the Expose card's button only when its carrier is a Reaction (the kind
  // offers no button for any other, rules/kinds/prevent.mjs), so a carrier without the trait still
  // pays from its row; a `card` kind's button pays whatever the carrier is.
  const fromCard = (item?.system?.rules ?? []).some(rule => {
    const hooks = kindOf(rule?.kind)?.hooks;
    // A kind that also acts when the Item is used (0.25.0: `subordinate`, whose card button uses
    // the Item) is paid on that one path, whichever door opened it: its button is no second place
    // of payment, and its row must not say that it is.
    if (hooks?.use) return false;
    return !!(hooks?.card || (hooks?.prevent && (item?.system?.reaction === true)));
  });
  return fromCard ? "STARWROUGHT.Cost.paidFromCard" : null;
}

/** Does a rule on this Item act when the Item is used (a kind with a `use` hook)? */
function actsOnUse(item) {
  return (item?.system?.rules ?? []).some(rule => typeof kindOf(rule?.kind)?.hooks?.use === "function");
}

/**
 * The road a Maneuver's cost takes (the header), and whether a raise is read on it.
 * @param {object} item  An action Item, or its plain data.
 * @param {object} [options]
 * @param {string} [options.actorType="character"]  A built-in that is a character's alone (Reload)
 *        is a plain row for anyone else.
 * @param {boolean} [options.owned]  Is the Item on an actor? Only an OWNED row with a use rule is
 *        paid in `##useWithRules`; a Basic Maneuver used straight from the compendium is charged
 *        as a row. Defaults to whether the Item has an `actor`.
 * @returns {{road: "builtin"|"recenter"|"use"|"elsewhere"|"reaction"|"passive"|"row"|"none", reached: boolean}}
 */
export function costRoad(item, { actorType = "character", owned = !!item?.actor } = {}) {
  if (!item || (item.type !== "action")) return { road: "none", reached: false };
  const slug = slugify(plainName(item.name ?? ""));
  const builtIn = Object.hasOwn(BUILT_IN_MANEUVERS, slug) && !(CHARACTER_BUILT_INS.has(slug) && (actorType !== "character"));
  if (builtIn) {
    return RAISED_BUILT_INS.has(slug) ? { road: "recenter", reached: true } : { road: "builtin", reached: false };
  }
  if (owned && actsOnUse(item)) return { road: "use", reached: false };
  if (paidElsewhere(item)) return { road: "elsewhere", reached: false };
  if (item.system?.reaction === true) return { road: "reaction", reached: false };
  if (!actionCostOptions(item.system ?? {}).length) return { road: "passive", reached: false };
  return { road: "row", reached: true };
}

/**
 * What a Condition adds to this Maneuver's cost for this creature now: nothing on a road the raise
 * does not reach, else `costRaise` of the row's own traits. The one function the charge and the
 * sheets share.
 * @param {object|null} actor
 * @param {object} item
 * @param {object} [options]
 * @param {boolean} [options.owned]
 * @returns {{extra: number, by: object[], road: string}}
 */
export function rowRaise(actor, item, { owned = !!item?.actor } = {}) {
  const { road, reached } = costRoad(item, { actorType: actor?.type ?? "character", owned });
  if (!reached || !actor) return { extra: 0, by: [], road };
  return { ...costRaise(actor, item.system?.traits ?? []), road };
}

/** Why a road is not reached, in the build's words. */
const ROAD_WHY = Object.freeze({
  builtin: "the system pays for it in its own code",
  use: "its rule acts when it is used",
  elsewhere: "it is paid for elsewhere",
  reaction: "it is a Reaction"
});

/**
 * What the build says of the `COST` lines (0.37.0): a trait nothing shipping carries outright (a
 * misspelling, or content not written yet), and a trait carried by something the raise does not
 * reach (the roads above; a Talent, a weapon). Warnings, never failures: the cells read.
 * @param {object} args
 * @param {Array<{trait: string, name: string, source: string}>} [args.asked]  Every COST rule.
 * @param {object[]} [args.rows]    The shipping action documents, `{ name, type, system }`.
 * @param {Array<{name: string, what: string, traits: string[]}>} [args.others]  Whatever else
 *        carries traits and is paid for in the system's own code: Talents (spells, Reactions) and
 *        weapons, each with what it is in words ("a Talent").
 * @returns {string[]}
 */
export function costCensus({ asked = [], rows = [], others = [] } = {}) {
  const warnings = [];
  const byTrait = new Map();
  for (const a of asked) {
    if (!a?.trait) continue;
    const entry = byTrait.get(a.trait) ?? byTrait.set(a.trait, { name: a.name ?? a.trait, sources: [] }).get(a.trait);
    if (a.source && !entry.sources.includes(a.source)) entry.sources.push(a.source);
  }
  for (const [trait, { name, sources }] of byTrait) {
    let reached = 0;
    const missed = [];
    const free = [];
    for (const row of rows) {
      if (!carriesTrait(row?.system?.traits, trait)) continue;
      // A row a Talent grants is owned when it is used, so a use rule takes it; a BASIC row is
      // used straight from the compendium and charged as a row whatever rule it carries (the
      // review of 0.37.0: with every row read as owned, a basic row with a use rule was named as
      // not reached when it is).
      const { road, reached: ok } = costRoad(row, { owned: row?.system?.basic !== true });
      const slug = slugify(plainName(row.name ?? ""));
      if (ok) reached += 1;
      else if (road === "passive") free.push(plainName(row.name ?? ""));
      // A built-in that is a character's alone (Reload) is a plain row, and raised, for an adversary.
      else if ((road === "builtin") && CHARACTER_BUILT_INS.has(slug)) missed.push(`${plainName(row.name ?? "")} (for a character, ${ROAD_WHY.builtin}; an adversary's is raised)`);
      else if (ROAD_WHY[road]) missed.push(`${plainName(row.name ?? "")} (${ROAD_WHY[road]})`);
    }
    for (const other of others) {
      if (carriesTrait(other?.traits, trait)) missed.push(`${plainName(other.name ?? "")} (${other.what ?? "paid in the system's own code"})`);
    }
    const by = sources.length ? ` (asked by ${sources.join(", ")})` : "";
    if (!reached && !missed.length) {
      warnings.push(free.length
        ? `COST with TRAIT(${name}): only Maneuvers that cost no actions carry the trait "${trait}" (${free.join(", ")}), so nothing costs more yet${by}`
        : `COST with TRAIT(${name}): no shipping Maneuver carries the trait "${trait}" outright, so nothing costs more yet${by}`);
    }
    if (missed.length) {
      warnings.push(`COST with TRAIT(${name}) does not reach ${missed.join(", ")}: a COST line raises a Maneuver paid from its own row, and Recenter${by}`);
    }
  }
  return warnings;
}

/**
 * Do the traits the system keeps for a raised built-in (`BUILT_IN_TRAITS`: what stands in when its
 * row cannot be read) still agree with the shipping row? One warning for each that does not.
 * @param {object[]} rows  The shipping action documents.
 * @param {Readonly<Record<string, readonly string[]>>} [kept]
 * @returns {string[]}
 */
export function builtInTraitNotes(rows = [], kept = BUILT_IN_TRAITS) {
  const warnings = [];
  for (const [slug, traits] of Object.entries(kept ?? {})) {
    const row = rows.find(r => (r?.type === "action") && (slugify(plainName(r.name ?? "")) === slug));
    if (!row) continue;
    const want = [...traitKeysOf([...traits])].sort().join(", ");
    const have = [...traitKeysOf(row.system?.traits ?? [])].sort().join(", ");
    if (want !== have) {
      warnings.push(`${plainName(row.name)}: the traits kept for when its row cannot be read (${want || "none"}) differ from the row's (${have || "none"}); update BUILT_IN_TRAITS in module/documents/maneuvers.mjs`);
    }
  }
  return warnings;
}

/**
 * The costs a row may be paid at, each with the raise on it: what the tab's "cannot pay" test
 * compares with the actions left (rules/requires.mjs, `maneuverStatus`, which stays pure and is
 * handed these as plain numbers).
 * @param {number[]} options  `actionCostOptions(system)`.
 * @param {number} extra
 * @returns {number[]}
 */
export function raisedCosts(options, extra) {
  const n = Math.max(0, Math.floor(Number(extra) || 0));
  return (options ?? []).map(cost => cost + n);
}
