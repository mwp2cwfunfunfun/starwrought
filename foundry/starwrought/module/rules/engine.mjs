/**
 * The rules engine's index (0.9.0; rulings 118 to 120).
 *
 * A Talent, an action or a Constellation Item carries `system.rules`, the parsed rules of its
 * Automation cell. An Actor who owns a hundred Items should not be walked by every hook that wants
 * to know whether any of them carries an aura, so the character and npc data models call
 * `collectRules` first thing in `prepareDerivedData` and keep the answer as `system.rules`:
 *
 *   { all: [{ rule, item }], byKind: { <kind id>: [{ rule, item }] }, unknown: [{ rule, item, reason }] }
 *
 * `all` is every usable rule; `byKind` the same entries filed under the canonical id of their kind
 * (an alias in a stored rule resolves to the id; a kind not in use has no key, so read through
 * `rulesOfKind`); `unknown` what the engine must skip and the sheet may show: an entry the client
 * wrote with `error` when a GM typed a line that did not parse, or a rule whose kind is no longer
 * registered. The item in each entry is the Item document itself, so a hook can reach the
 * carrier's name, its Constellation and its chosen option without a second lookup.
 *
 * NOTHING READS THE INDEX YET. There are no kinds (Mike, 2026-10-03: "do NOT survey the talents yet
 * or build ANY of the automation hooks. just build the framework") and so no hooks; the first
 * kind, an aura for Torchbearer, will define the first hook point with it, and that hook will ask
 * `actor.rulesOfKind("aura")` rather than walking the Items. Until then this module collects and
 * files, and the index on every Actor is empty.
 *
 * Pure over the documents: no writes, no Foundry globals at module scope, so `assets/test_rules.mjs`
 * drives it with a plain `{ items: [...] }` from Node.
 */

import { kindOf } from "./kinds/index.mjs";

/**
 * The Item types that may carry rules. A Constellation Item is included now, before any carries
 * one, so that a rule authored on a Constellation one day (a Flare effect, say) is collected by the
 * same pass without a second edit here. Equipment is not: a weapon's traits are read by the weapon
 * trait parser in the Item model, and a sword with an Automation cell is a design the book does
 * not have.
 */
export const RULE_ITEM_TYPES = Object.freeze(["talent", "action", "constellation"]);

/**
 * @typedef {object} RuleEntry
 * @property {object} rule   An entry of the Item's `system.rules`.
 * @property {object} item   The Item that carries it.
 * @property {string} [reason]  On an `unknown` entry: why the engine skips it.
 */

/**
 * Collect and file every rule on an Actor's Items. `actor.items` may be Foundry's Collection
 * (iterable over its documents) or a plain array; an Item of another type, an Item whose
 * `system.rules` is not an array and an entry that is not an object are passed over without
 * comment, since a half-migrated world is not an error the engine should shout about on every
 * prepare.
 * @param {{items?: Iterable<object>}} actor
 * @returns {{all: RuleEntry[], byKind: Object<string, RuleEntry[]>, unknown: RuleEntry[]}}
 */
export function collectRules(actor) {
  const all = [];
  const unknown = [];
  // A null-prototype index, so a kind id that happens to be an Object.prototype name
  // ("constructor" passes KIND_WORD) files its rules instead of landing on a function (review).
  const byKind = Object.create(null);

  for (const item of actor?.items ?? []) {
    if (!RULE_ITEM_TYPES.includes(item?.type)) continue;
    const rules = item.system?.rules;
    if (!Array.isArray(rules)) continue;

    for (const rule of rules) {
      if (!rule || (typeof rule !== "object")) continue;
      // A line the client could not parse: saved with its message so the sheet can show it, and
      // skipped here so no hook ever sees half a rule (ruling 118).
      if (rule.error) {
        unknown.push({ rule, item, reason: String(rule.error) });
        continue;
      }
      const kind = kindOf(rule.kind);
      if (!kind) {
        unknown.push({ rule, item, reason: `unknown rule kind "${rule.kind ?? ""}"` });
        continue;
      }
      const entry = { rule, item };
      all.push(entry);
      (byKind[kind.id] ??= []).push(entry);
    }
  }

  return { all, byKind, unknown };
}

/**
 * The usable rules of one kind on an Actor, by id or alias. Reads the index the data model
 * prepared when there is one (`actor.system.rules.byKind`), else collects on the spot, so the
 * answer is the same from a prepared document and from a plain object in a test. Always an array,
 * so a hook can iterate without a guard; `SwActor#rulesOfKind` is this with `this`.
 * @param {object} actor
 * @param {string} kind
 * @returns {RuleEntry[]}
 */
export function rulesOfKind(actor, kind) {
  const id = kindOf(kind)?.id ?? String(kind ?? "").trim().toLowerCase();
  if (!id) return [];
  const prepared = actor?.system?.rules?.byKind;
  const byKind = (prepared && (typeof prepared === "object")) ? prepared : collectRules(actor).byKind;
  return Object.hasOwn(byKind, id) ? byKind[id] : [];
}
