/**
 * What a creature HAS: its Conditions, closed over what each one includes (0.33.0; rulings 325
 * and 327). The Conditions workbook (`data/conditions.xlsx`) writes "Prone: Off-Guard, ..." as
 * Prone INCLUDING Off-Guard, so a Prone creature is Off-Guard to every rule, once, however many
 * ways it got there: the status itself, Prone, Grabbed, or a first Torso Wound.
 *
 * Three ways a creature has a Condition:
 *
 *   DIRECTLY       the status is on it (the token palette, `setCondition`, a Maneuver's APPLY).
 *   BY INCLUSION   a Condition it has includes this one (the registry's `includes`), and so on
 *                  down: Restrained includes Grabbed, which includes Off-Guard.
 *   BY ITS TORSO   a Wound or a Critical Hit effect on the Torso is Off-Guard (PHB v4.25; through
 *                  0.32.1 a hard-coded line of the Defense pass under the same circumstance).
 *
 * and one way it has a Condition only AGAINST ONE CREATURE: an inclusion written "Off-Guard
 * against X" (Wrong-Footed's) holds only against the creature that put the including Condition
 * on, which the applied record names (`flags.starwrought.applied.by`, ./applied.mjs). A
 * Wrong-Footed that a hand put on names nobody, so it includes nothing: `unknown` lists those.
 *
 * The answer is plain data:
 *
 *   held      Map<id, { value, by, bys, direct, via }>   the Conditions held against everyone.
 *             `bys` is everyone who applied it, a direct applier first and then each includer's
 *             (an Off-Guard that comes from a Prone you applied is yours for `mine`), `by` the
 *             first of them; `via` the Conditions (or "torso") it comes through.
 *   against   Map<id, Map<uuid, { via }>>           the Conditions held against that creature alone.
 *   unknown   Set<id>                                the Conditions whose "against X" names nobody.
 *
 * The answer does not depend on the order the statuses are met in (the review of 0.33.0): what a
 * Condition includes is spread once for each applier it is reached with, so an includer that is
 * itself included (P and S both include Q, and Q includes "R against X") gives R against S's
 * applier whether P or S is met first.
 *
 * `APPLY` and `REMOVE` never read this: they put a status on and take it off, and a status is on
 * the creature or it is not (./effects-state.mjs).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the self-test imports it from Node).
 */

import { CONDITIONS } from "../config.mjs";

/** The Condition a Torso Wound or a Torso Critical Hit effect is. */
export const TORSO_CONDITION = "offGuard";

/** The `via` word for a Condition held through the Torso. */
export const VIA_TORSO = "torso";

/** An empty set, for a creature nothing is known of. */
export function emptyConditionSet() {
  return { held: new Map(), against: new Map(), unknown: new Set() };
}

/**
 * Close a creature's direct Conditions over what they include.
 * @param {object} input
 * @param {Iterable<[string, {value?: number, by?: string|null}]>|Map} [input.direct]
 *        The Conditions on the creature itself: id to its value and who applied it.
 * @param {boolean} [input.torso]   Its Torso carries a Wound or a Critical Hit effect.
 * @param {Object<string, object>} [registry]  The Conditions' records (the live registry).
 * @returns {{held: Map, against: Map, unknown: Set}}
 */
export function closeConditions({ direct = [], torso = false } = {}, registry = CONDITIONS) {
  const set = emptyConditionSet();
  const hold = (id, entry) => {
    const have = set.held.get(id);
    if (!have) {
      set.held.set(id, { value: entry.value, by: entry.by ?? null, bys: entry.by ? [entry.by] : [], direct: entry.direct === true, via: [...entry.via] });
      return;
    }
    for (const v of entry.via) if (!have.via.includes(v)) have.via.push(v);
    if (entry.by && !have.bys.includes(entry.by)) have.bys.push(entry.by);
    have.by ??= entry.by ?? null;
  };
  const holdAgainst = (id, uuid, via) => {
    const who = set.against.get(id) ?? set.against.set(id, new Map()).get(id);
    const have = who.get(uuid);
    if (!have) who.set(uuid, { via: [via] });
    else if (!have.via.includes(via)) have.via.push(via);
  };

  // The includers whose "against X" found its X, and those met with nobody to name: `unknown` is
  // the second less the first, worked out at the end, so it does not depend on the order.
  const named = new Set();
  const nameless = new Set();
  const seen = new Set();

  // What `id` includes, held against everyone (`uuid` null) or against one creature. Spread once
  // for each applier (`by`) the Condition is reached with, which bounds the walk and ends a cycle.
  const spread = (id, by, uuid) => {
    const key = `${id}|${uuid ?? ""}|${by ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    for (const include of registry[id]?.includes ?? []) {
      if (!registry[include.id]) continue;
      if (uuid) {
        // Already held against one creature: everything it includes is held against that creature.
        holdAgainst(include.id, uuid, id);
        spread(include.id, by, uuid);
        continue;
      }
      if (include.against) {
        if (!by) { nameless.add(id); continue; }
        named.add(id);
        holdAgainst(include.id, by, id);
        spread(include.id, by, by);
        continue;
      }
      hold(include.id, { value: 1, by: by ?? null, direct: false, via: [id] });
      spread(include.id, by ?? null, null);
    }
  };

  const entries = (direct instanceof Map) ? [...direct] : [...(direct ?? [])];
  for (const [id, info] of entries) {
    if (!id) continue;
    const value = Number(info?.value);
    hold(String(id), { value: (Number.isFinite(value) && (value > 0)) ? value : 1, by: info?.by ? String(info.by) : null, direct: true, via: [] });
  }
  if (torso && registry[TORSO_CONDITION]) hold(TORSO_CONDITION, { value: 1, by: null, direct: false, via: [VIA_TORSO] });

  // The Conditions on the creature itself (and its Torso's Off-Guard), each with its own applier.
  for (const [id, held] of [...set.held]) spread(id, held.bys[0] ?? null, null);
  for (const id of nameless) if (!named.has(id)) set.unknown.add(id);
  // A Condition held against everyone is not also listed against one creature.
  for (const id of [...set.against.keys()]) if (set.held.has(id)) set.against.delete(id);
  return set;
}

/**
 * A creature's Condition set, read off the Actor (a plain object in a test): its statuses that
 * are Conditions, each with its value and the creature its applied record names, and its Torso.
 * The STORED Torso fields are read (`wounds`, `critical`): the derived `wounded` is set after the
 * rules are collected, and would be a round behind.
 * @param {object|null} actor
 * @param {Object<string, object>} [registry]
 * @returns {{held: Map, against: Map, unknown: Set}}
 */
export function conditionSetOf(actor, registry = CONDITIONS) {
  if (!actor) return emptyConditionSet();
  const statuses = [...(actor.statuses ?? [])];
  const direct = new Map();
  for (const id of statuses) {
    const record = registry[id];
    if (!record || record.zone) continue;
    const value = record.numeric && (typeof actor.conditionValue === "function") ? actor.conditionValue(id) : 1;
    direct.set(id, { value: Number(value) || 1, by: null });
  }
  // Who applied each: the applied record on the Condition's own effect.
  for (const effect of actor.effects ?? []) {
    if (effect?.disabled || effect?.isSuppressed || effect?.suppressed) continue;
    const own = [...(effect?.statuses ?? [])];
    if ((own.length !== 1) || !direct.has(own[0])) continue;
    const by = effect?.flags?.starwrought?.applied?.by ?? effect?.applied?.by ?? null;
    if (by && !direct.get(own[0]).by) direct.get(own[0]).by = String(by);
  }
  const zone = actor.system?.zones?.torso ?? null;
  const torso = !!zone && ((Number(zone.wounds) || 0) > 0 || zone.critical === true);
  return closeConditions({ direct, torso }, registry);
}

/**
 * Does the creature have this Condition, as one creature sees it? Against everyone, or against
 * `viewer` (a uuid): a creature Wrong-Footed to Tess is Off-Guard when Tess asks, and to nobody
 * else.
 * @param {{held: Map, against: Map}|null} set
 * @param {string} id
 * @param {string|null} [viewer]  The uuid of the creature the question is asked for, if any.
 * @returns {boolean}
 */
export function holdsCondition(set, id, viewer = null) {
  if (!set || !id) return false;
  if (set.held.has(id)) return true;
  return !!viewer && !!set.against.get(id)?.has(String(viewer));
}

/** The ids held against everyone, as a list (what a sheet's own Threshold and a REQUIRES block read). */
export function heldIds(set) {
  return set ? [...set.held.keys()] : [];
}

/** The ids held as `viewer` sees the creature: against everyone, and against that creature. */
export function heldIdsFor(set, viewer = null) {
  const out = heldIds(set);
  if (viewer && set) for (const [id, who] of set.against) if (who.has(String(viewer)) && !out.includes(id)) out.push(id);
  return out;
}
