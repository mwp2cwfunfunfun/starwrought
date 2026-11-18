/**
 * The Effects list (0.31.0; rulings 305 to 310): what is on a creature now, by name.
 *
 * Mike, 2026-11-17, writing `[REQUIRES ...]` cells down the Basic Actions list: "the more I think
 * about this, the more I think even the [REQUIRES] grammar should be effects-based ... assuming
 * each Actor has an Effects list of whatever effects they have, conditions, etc., REQUIRES should
 * just look for a string in that Effects list."
 *
 * Most of that list already existed. Every Condition is an ActiveEffect that carries a status id,
 * and the Bind (`bound`, `controlling`, `controlled`), an Exposed Zone, Preparing, Spent, Wounded
 * and Dying are Conditions too, so `actor.statuses` answered for all of them. What it lacked was
 * a name for anything that is NOT a Condition. So the list is two keyed sets:
 *
 *   conditions   the creature's status ids, each with its value (1 for one that carries none)
 *   names        every other ACTIVE effect on it, by the slug of its name ("Taking Cover" is
 *                `taking-cover`), and a character's custom effect rows by their label
 *
 * NOTHING NEW IS STORED. A named Effect is an ActiveEffect with a name: one the GM made by hand
 * on the Effects tab (the "new effect" control both sheets have had since the first release), or
 * one a Maneuver applied (0.32.0, `flags.starwrought.applied`). It carries NO status id of its
 * own: a hand-made effect has none to match on anyway, and the Condition writer's twin rule and
 * the palette's hook (documents/actor/conditions.mjs, starwrought.mjs) never have to tell a named
 * Effect from a Condition.
 *
 * What is NOT on the list, and stays what it is: a pending result ("Aid from Wren",
 * `flags.starwrought.rules.given`), a used Effect (`EFFECT(Aid, used)`, ./given.mjs), a mark
 * (`MARKED`), a Zone's Critical Hit effect, a raised shield. Each has its own word.
 *
 * A CONDITION'S NAME IS RESERVED: `readEffectName` reads "prone", "Off-Guard" and "off guard" as
 * the Condition, so a hand-made effect that is merely CALLED "Prone" and carries no status is
 * never matched by anything; and an effect that is a Condition's own (one status, a Condition's)
 * gives no name, or "Fatigued 2" would be an Effect called `fatigued-2`.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build and the self-test import it
 * from Node). It imports ./syntax.mjs and the config.
 */

import { RuleSyntaxError } from "./syntax.mjs";
import { CONDITIONS, SYSTEM_ID, conditionIdOf, slugify, plainName } from "../config.mjs";

/** The words a named Effect may not be called: each means something else where a name is read. */
export const RESERVED_EFFECT_NAMES = Object.freeze(["and", "or", "not", "self", "target", "mine", "used", "with", "na", "n/a", "none"]);

/**
 * What a named Effect's name may be made of: letters, digits, spaces, hyphens and apostrophes,
 * beginning with a letter or a digit. The curly apostrophe a spreadsheet types by itself is built
 * from its code, so this file holds none.
 */
const NAME_SHAPE = new RegExp(`^[\\p{L}\\p{N}][\\p{L}\\p{N} '${String.fromCharCode(0x2019)}-]*$`, "u");

/** A Condition's printed name from its id: "Prone", "Off-Guard", "Wrong-Footed". */
export function conditionTitle(id) {
  const word = String(CONDITIONS[id]?.name ?? id).split(".").at(-1);
  const spaced = word.replace(/([a-z])([A-Z])/g, "$1-$2");
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : String(id);
}

/** The slug a named Effect is matched by: "Taking Cover" and "taking  cover" are `taking-cover`. */
export function effectSlug(name) {
  return slugify(plainName(String(name ?? "")));
}

/**
 * A name as a cell writes it, read: a Condition (by `conditionIdOf`, so case, spaces and hyphens
 * do not matter) or a named Effect by its slug.
 * @param {string} written
 * @returns {{name: string, slug: string, condition: string|null}}
 */
export function readEffectName(written) {
  const text = String(written ?? "").trim().replace(/\s+/g, " ");
  if (!text) throw new RuleSyntaxError("an Effect has a name: a Condition (`prone`, `off-guard`) or a name of your own (`Taking Cover`)");
  const lower = text.toLowerCase();
  // An Exposed Zone is the Zone's own state, mirrored to a status: never a Condition a rule names
  // (`conditionIdOf` leaves the four out), and as a name it would be an Effect nobody ever has.
  // Read with spaces and hyphens out, as a Condition's name is: `exposedHead`, `Exposed-Head`.
  if (lower.replace(/[\s-]+/g, "").startsWith("exposed")) {
    throw new RuleSyntaxError(`"${text}": an Exposed Zone is read off the Zone, not as an Effect; no line reads it yet`);
  }
  // `not` turns a whole condition round and is never part of a name (the review of 0.31.0): read
  // as one, `effect not Blessed` would be an Effect CALLED "not Blessed", which nobody has, said
  // in the same words as the block that was meant.
  if (/^not(\s|$)/.test(lower)) {
    throw new RuleSyntaxError(`"${text}": \`not\` goes in front of the whole condition, as in \`[REQUIRES not effect Blessed]\`; a bonus line has no \`not\` yet`);
  }
  const condition = conditionIdOf(text);
  if (condition) return { name: conditionTitle(condition), slug: condition.toLowerCase(), condition };
  // A Condition with a number after it: the value is not compared, and read as a name it would
  // be an Effect nobody ever has (a Condition's own effect gives no name).
  const valued = text.match(/^(.*\S)\s+\d+$/);
  const valuedCondition = valued ? conditionIdOf(valued[1]) : null;
  if (valuedCondition) {
    throw new RuleSyntaxError(`"${text}": a Condition's value is not compared yet; write \`${conditionTitle(valuedCondition).toLowerCase()}\`, which is any value`);
  }
  if (RESERVED_EFFECT_NAMES.includes(lower) || /^-+$/.test(text)) {
    throw new RuleSyntaxError(`"${text}" cannot be an Effect's name: the word means something else here`);
  }
  if (!NAME_SHAPE.test(text)) {
    throw new RuleSyntaxError(`"${text}" cannot be an Effect's name: a name is letters, digits, spaces, hyphens and apostrophes`);
  }
  for (const word of lower.split(" ")) {
    if ((word === "or") || (word === "and")) {
      throw new RuleSyntaxError(`"${text}" cannot be an Effect's name: \`${word}\` joins conditions, so a name may not hold it as a word`);
    }
  }
  const slug = effectSlug(text);
  if (!slug) throw new RuleSyntaxError(`"${text}" cannot be an Effect's name`);
  return { name: text, slug, condition: null };
}

/**
 * The named Effect an effect's own name makes it, or null when no line could name it: the ONE
 * reading the list, the sheets' tag and the hover card share (the review of 0.31.0: the list once
 * took any name by its slug, so an effect called "Blessed!" was read by `EFFECT(Blessed)` while
 * its tag said nothing could read it). Glyphs are taken out first, as a Maneuver's name is read
 * everywhere; a name that is a Condition's is no named Effect.
 * @param {string} name  The effect's name, or a custom effect row's label.
 * @returns {{name: string, slug: string}|null}
 */
export function namedEffectOf(name) {
  try {
    const read = readEffectName(plainName(String(name ?? "")));
    return read.condition ? null : { name: read.name, slug: read.slug };
  } catch {
    return null;
  }
}

/**
 * @typedef {object} EffectList
 * @property {Map<string, number>} conditions  Status id -> its value (1 when it carries none).
 * @property {Map<string, {name: string, applied: object|null, row?: boolean}>} names
 *           Slug -> the named Effect: its name as written on it, the record a Maneuver left when it
 *           applied it (0.32.0; null for a hand-made one), `row` for a custom effect row.
 */

/**
 * The list, from plain data.
 * @param {object} [source]
 * @param {Iterable<string>} [source.statuses]   The status ids on the creature (`actor.statuses`).
 * @param {(id: string) => number} [source.conditionValue]  A Condition's value; 1 when not given.
 *        (Never called `valueOf`: every object inherits one, and a default would never be used.)
 * @param {Iterable<{name?: string, disabled?: boolean, suppressed?: boolean, statuses?: Iterable<string>, applied?: object|null}>} [source.effects]
 *        The creature's effects. A disabled or suppressed one counts for nothing.
 * @param {Iterable<{label?: string}>} [source.rows]  A character's custom effect rows.
 * @returns {EffectList}
 */
export function effectList({ statuses = [], conditionValue = null, effects = [], rows = [] } = {}) {
  const conditions = new Map();
  for (const id of statuses ?? []) {
    const key = String(id ?? "");
    if (!key) continue;
    const value = (typeof conditionValue === "function") ? Number(conditionValue(key)) : 1;
    conditions.set(key, Number.isFinite(value) && (value > 0) ? value : 1);
  }
  const names = new Map();
  // Only a name a line could write is on the list (`namedEffectOf`), so what a rule matches and
  // what the sheet's tag says are one answer.
  const add = (name, extra) => {
    const read = namedEffectOf(name);
    if (read && !names.has(read.slug)) names.set(read.slug, { name: read.name, ...extra });
  };
  for (const effect of effects ?? []) {
    if (!effect || (effect.disabled === true) || (effect.suppressed === true)) continue;
    // A Condition's own effect (the system's, or one toggled from the token) gives no name: its
    // name is the Condition's, with the value for a numeric one ("Fatigued 2").
    const own = [...(effect.statuses ?? [])];
    if ((own.length === 1) && Object.hasOwn(CONDITIONS, own[0])) continue;
    add(effect.name, { applied: (effect.applied && (typeof effect.applied === "object")) ? effect.applied : null });
  }
  for (const row of rows ?? []) add(row?.label, { applied: null, row: true });
  return { conditions, names };
}

/**
 * The list of an Actor (or anything shaped like one). Conditions come from `statuses`, which
 * counts an Item-borne effect as the system already does for `[REQUIRES prone]`; names from the
 * effects that apply to it now (`appliedEffects` where the Actor has it, so an Item's transferred
 * effect counts and a disabled or suppressed one does not).
 * @param {object|null} actor
 * @returns {EffectList|null}  Null when there is no creature to read.
 */
export function effectsOn(actor) {
  if (!actor) return null;
  const source = actor.appliedEffects ?? actor.effects ?? [];
  const effects = [];
  for (const e of source) {
    if (!e) continue;
    effects.push({
      name: e.name,
      disabled: e.disabled === true,
      suppressed: e.isSuppressed === true,
      statuses: [...(e.statuses ?? [])],
      applied: e.flags?.[SYSTEM_ID]?.applied ?? null
    });
  }
  return effectList({
    statuses: actor.statuses ?? [],
    conditionValue: (typeof actor.conditionValue === "function") ? id => actor.conditionValue(id) : null,
    effects,
    rows: Array.isArray(actor.system?.effects) ? actor.system.effects : []
  });
}

/**
 * Does a list hold what a rule names? True or false; null when there is no list to read, which a
 * caller treats as "cannot tell" (REQUIRES) or as "does not hold" (a bonus).
 * @param {EffectList|null} list
 * @param {{slug?: string, condition?: string|null}} ref  A `readEffectName` answer.
 * @returns {boolean|null}
 */
export function listHas(list, ref) {
  if (!list || !ref) return null;
  if (ref.condition) return list.conditions.has(ref.condition);
  return !!ref.slug && list.names.has(ref.slug);
}

/** The named Effects of a list, by name, for a screen: `[{ slug, name, applied, row }]`. */
export function namedEffects(list) {
  if (!list) return [];
  return [...list.names.entries()].map(([slug, e]) => ({ slug, name: e.name, applied: e.applied ?? null, row: e.row === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
