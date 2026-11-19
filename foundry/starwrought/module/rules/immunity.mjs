/**
 * Immunity to a trait, the pure half (0.35.0; rulings 350 to 360). Mike, of the Blinded Condition:
 * "We already have [IMMUNE] in automation grammar, so should we extend it to allow for adding of
 * Traits in there?" A Condition's row says `[EFFECT IMMUNE: TRAIT(Visual)]` (./kinds/prevent.mjs),
 * and whoever has the Condition is immune to anything that carries the trait.
 *
 * What a THING'S traits mean for that (ruling 357):
 *
 *  - SEPARATE TRAITS are each a way the thing works. Calm Animal is Auditory and Visual: a
 *    creature immune to either one is immune to it.
 *  - ONE TRAIT WRITTEN WITH `or` is alternatives. Captivate's trait is "Auditory or Visual": it
 *    works through either sense, so a creature is immune only when it is immune to BOTH. A Blinded
 *    creature that can hear is still Captivated.
 *
 * So a thing's traits are read as GROUPS OF ALTERNATIVES, one group for each trait written, and a
 * creature is immune when some group has every one of its alternatives among the traits the
 * creature is immune to. Only the first word of a trait is its key ("Reach 5" is `reach`), as
 * everywhere a trait is compared (./operators.mjs, `traitKey`).
 *
 * This module is the grouping, the covering and the words. Asking a creature which traits it is
 * immune to is ../rules/prevent.mjs (`traitImmunity`), which needs the actor's rules.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the self-test imports it from Node).
 */

import { traitKey } from "./operators.mjs";

/**
 * A thing's traits as groups of alternatives: `["Auditory or Visual", "Emotion"]` is
 * `[["auditory", "visual"], ["emotion"]]`. A trait that is blank, or no string, gives no group.
 * @param {string[]} traits  As an Item stores them (`system.traits`).
 * @returns {string[][]}  Keys, in the order written.
 */
export function traitGroups(traits) {
  const out = [];
  for (const written of Array.isArray(traits) ? traits : []) {
    if (typeof written !== "string") continue;
    const keys = [...new Set(written.split(/\s+or\s+/i).map(part => traitKey(part)).filter(Boolean))];
    if (keys.length) out.push(keys);
  }
  return out;
}

/** Every key a thing's traits name, once each: what a creature's immunity is asked about. */
export function traitKeysOf(traits) {
  return [...new Set(traitGroups(traits).flat())];
}

/**
 * The group of a thing's traits that a creature's immunities cover, or null: the first group
 * every alternative of which the creature is immune to.
 * @param {string[]} traits  The thing's traits, as written.
 * @param {Map<string, {name: string, by: string}>|Set<string>|string[]} immune  The trait keys the
 *   creature is immune to; as a Map, each with the trait's printed name and what makes it so.
 * @returns {Array<{trait: string, name: string, by: string}>|null}  One entry for each alternative.
 */
export function coveredGroup(traits, immune) {
  const has = key => ((immune instanceof Map) || (immune instanceof Set)) ? immune.has(key) : (Array.isArray(immune) && immune.includes(key));
  const of = key => ((immune instanceof Map) ? immune.get(key) : null) ?? {};
  for (const group of traitGroups(traits)) {
    if (!group.every(has)) continue;
    return group.map(key => ({ trait: key, name: String(of(key).name ?? titled(key)), by: String(of(key).by ?? "") }));
  }
  return null;
}

/** "Visual"; "Auditory and Visual"; "A, B and C". */
export function joinNames(names) {
  const list = [...new Set((names ?? []).map(n => String(n ?? "").trim()).filter(Boolean))];
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

/**
 * The words of a covered group, for a sentence: which traits ("Auditory and Visual") and what
 * makes the creature immune ("Blinded and Deafened").
 * @param {Array<{trait: string, name: string, by: string}>} covered  From `coveredGroup`.
 * @returns {{traits: string, by: string}}
 */
export function immunityWords(covered) {
  return { traits: joinNames((covered ?? []).map(c => c.name)), by: joinNames((covered ?? []).map(c => c.by)) };
}

function titled(word) {
  const text = String(word ?? "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
