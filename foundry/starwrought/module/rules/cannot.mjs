/**
 * Which Defenses a creature cannot use, and why (0.38.0; rulings 385 to 392). The `cannot` kind
 * (./kinds/cannot.mjs) reads the line a Condition's row carries, `[EFFECT CANNOT: evade]`; this
 * module asks it of a creature. Mike, 2026-11-19: "Grabbed currently is hard-coded to 'cannot
 * Evade' ... I would like to make that an automation grammar to prevent the use of a Defense."
 *
 * ONE READER, `unusableDefenses(actor)`, asked by the two Defense passes
 * (data/character/defenses.mjs, `prepareDefenses`; data/actor.mjs, the adversary's model), which
 * write its answer onto `system.defenses[key].unavailable`: a Condition's id, or null. Every reader
 * of an unusable Defense already looks there (the Combat window, the coordinator, a Maneuver's
 * request card, the Threshold reads), and each is generic over the Defense's key, so a row may
 * take any of the four away.
 *
 * THE ROW IS THE WORD (ruling 386; ruling 329's rule): a Condition whose row carries no `CANNOT`
 * line takes no Defense away, Grabbed included. THE OLD RULE IS A GUARD, NOT GONE: through 0.37.0
 * the code made Evade unusable while a creature was Grabbed or Restrained, and that stands for
 * each of the two only while NO ROW of the workbook describes it (the Conditions file could not be
 * read), so such a world keeps what the system always did.
 *
 * WHAT IT IS ABOUT (ruling 389): answering. See ./kinds/cannot.mjs.
 *
 * THE REGISTRY IS IMPORTED FIRST (the lesson of 0.37.0's review): the reader needs the engine,
 * the engine imports the registry and the registry imports the kinds, so this module may be the
 * first of the rules that anything imports.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE: the self-test imports it from Node.
 */

import "./kinds/index.mjs";
import { rulesOfKind, isConditionCarrier } from "./engine.mjs";
import { conditionSetOf, heldIds } from "./condition-set.mjs";
import { DEFENSES, CONDITIONS, conditionHasRow } from "../config.mjs";

/** The two Conditions the code itself took Evade away for, through 0.37.0, in the order it named them. */
export const EVADE_BY_HAND = Object.freeze(["restrained", "grabbed"]);

/**
 * The Condition a carrier's line is shown as coming from (ruling 392): the Condition the creature
 * HAS. A creature that is only Restrained reads "Restrained", though the line is Grabbed's row's
 * (Restrained counts as Grabbed through Includes); one that has Grabbed itself reads "Grabbed".
 *
 * A carrier knows only the Condition it comes through NEXT. With the creature's whole set handed
 * in (`held`: ./condition-set.mjs, `conditionSetOf(actor).held`) the chain is walked up to the
 * Condition the creature has itself, however many rows lie between (the review of 0.38.0); with
 * none the nearest one is named. What a Condition comes through may also be a Torso Wound, which
 * is no Condition: then the name reached so far stands.
 * @param {object} item  A Condition's carrier (./engine.mjs, `conditionCarrier`).
 * @param {Map<string, {direct?: boolean, via?: string[]}>|null} [held]
 * @returns {string}  A Condition's id.
 */
export function reasonOf(item, held = null) {
  let id = String(item?.condition?.id ?? "");
  let direct = item?.condition?.direct === true;
  let via = Array.isArray(item?.condition?.via) ? item.condition.via : [];
  const seen = new Set([id]);
  while (!direct) {
    const next = via.find(through => (typeof through === "string") && Object.hasOwn(CONDITIONS, through) && !seen.has(through));
    if (!next) break;
    id = next;
    seen.add(id);
    const entry = (held instanceof Map) ? held.get(id) : null;
    if (!entry) break;
    direct = entry.direct === true;
    via = Array.isArray(entry.via) ? entry.via : [];
  }
  return id;
}

/**
 * The old rule, for a Condition no row describes: Evade cannot be used while Restrained or
 * Grabbed. Asked of what the creature HAS (./condition-set.mjs), as it was since 0.33.0.
 * @param {object} actor
 * @returns {string|null}
 */
function evadeByHand(actor) {
  const waiting = EVADE_BY_HAND.filter(id => !conditionHasRow(id));
  if (!waiting.length) return null;
  let held;
  try {
    held = new Set(heldIds(conditionSetOf(actor)));
  } catch {
    return null;
  }
  return waiting.find(id => held.has(id)) ?? null;
}

/**
 * The Defenses this creature cannot use now, each with the Condition that takes it away.
 *
 * Only a Condition's lines are read (ruling 388). A Condition held only against one creature (an
 * "against X" inclusion) is passed over: the sheet's answer has no other party (stated, not
 * built). Of two Conditions that take one Defense away the first is named.
 *
 * A calculation: nothing is spent, nothing is written, and every client answers the same.
 * @param {object|null} actor
 * @returns {Record<string, string|null>}  For each key of `DEFENSES`: a Condition's id, or null.
 */
export function unusableDefenses(actor) {
  const out = Object.fromEntries(Object.keys(DEFENSES).map(key => [key, null]));
  if (!actor) return out;
  // This runs inside both Defense passes, so nothing here may throw: a rule or a carrier of a
  // shape it does not know is passed over (the review of 0.38.0).
  let entries;
  try {
    entries = rulesOfKind(actor, "cannot");
  } catch {
    entries = [];
  }
  // The creature's own set, read only when a carrier comes through another Condition.
  let held;
  const heldSet = () => {
    if (held === undefined) {
      try { held = conditionSetOf(actor).held; } catch { held = null; }
    }
    return held;
  };
  for (const entry of Array.isArray(entries) ? entries : []) {
    try {
      const rule = entry?.rule;
      const item = entry?.item;
      if (!rule || !isConditionCarrier(item)) continue;
      const key = (typeof rule.defense === "string") ? rule.defense : "";
      if (!Object.hasOwn(out, key) || out[key]) continue;
      if (Array.isArray(item.condition?.against)) continue;
      out[key] = reasonOf(item, (item.condition?.direct === true) ? null : heldSet()) || null;
    } catch {
      continue;
    }
  }
  if (!out.evade) out.evade = evadeByHand(actor);
  return out;
}
