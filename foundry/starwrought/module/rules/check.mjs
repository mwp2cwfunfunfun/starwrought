/**
 * The check a Maneuver rolls, declared (0.34.0; rulings 337 to 349). Mike, 2026-11-19, of Gain
 * Control and of the Talents still to be written: "when I add new talents I don't want to
 * hard-code what the check is. So wouldn't it make sense if the check was also using automation
 * grammar, as well as the success/failure effects?", and: "make sure there is room for the Checker
 * to choose (eg Athletics or Acrobatics) or for the Checked to choose".
 *
 * Through 0.33.0 the build GUESSED a row's check from its prose (the Constellation column, the
 * words "attempt ... check" in the Effect and the word after "vs."), and the guess failed three
 * ways: "vs. Evade or Guard" read as Evade alone, a cell naming two Constellations rolled nothing,
 * and a fixed Threshold could not be said. The check is now a block on the Maneuver's own row (the
 * `check` kind, ./kinds/check.mjs, reads it with `readCheck` below):
 *
 *   [CHECK Athletics]                              roll Athletics; the Threshold is typed
 *   [CHECK Athletics vs Guard]                     against the target's Guard
 *   [CHECK Athletics or Acrobatics vs Guard]       the one using the Maneuver picks which
 *   [CHECK Athletics vs Evade or Guard]            the target picks which
 *   [CHECK relevant]                               any Constellation, picked when it is rolled
 *   [CHECK relevant vs Guard]
 *   [CHECK Crafting vs 15]                         a Threshold of 15, which the roll may change
 *
 * `OR` IS WHOEVER IS AFFECTED (Mike, by question; ruling 338): "'or' should always mean the actor
 * being affected by the choice chooses. So on the left side of the 'vs' the actor chooses. On the
 * right side of the 'vs' the target chooses." No word hands a choice to the other side.
 *
 * THE WORD IS `CHECK` (ruling 337), though `CHECK:` with a colon is already the tag of a bonus to
 * checks (`[EFFECT CHECK: 1 condition, aid]`): Mike's reason is that the word does not say who
 * rolls, and a player rolls for an adversary's Maneuver (ruling 340). The two are told apart by
 * the EFFECT in front, and each written the other way is told the form that was meant
 * (./features.mjs, ./effects.mjs).
 *
 * The stored rule: `{ kind: "check", line, text, rolls: "relevant" | [{ slug, name }],
 * against: null | { defenses: [key, ...] } | { threshold: n } }`.
 *
 * THE PLAN (`planOf`) is what every reader asks: the row's `check` rule when it has one, else the
 * three fields the build has always written (`system.check { enabled, constellation, defense }`),
 * which stay for a row with no block and for a world Item made by hand.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError, splitAlternatives } from "./syntax.mjs";
import { DEFENSES, ORIGIN_SLUG, isLoreSlug, slugify, plainName } from "../config.mjs";

/** The word that stands for "any Constellation, picked when it is rolled". */
export const RELEVANT = "relevant";

/** The Threshold a `vs <number>` may name. */
export const THRESHOLD_RANGE = Object.freeze({ min: 1, max: 60 });

const SHAPE = "[CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>]";
const EXAMPLE = "[CHECK Athletics vs Evade or Guard]";
const VS = /^vs\.?$/i;
const NOT_VS = /^(versus|against|v|v\.)$/i;
const HAS_AND = /(^|\s)and(\s|$)/i;
const NO_AND = `CHECK has no \`and\`: a Maneuver rolls one check, and \`or\` is a choice, as in \`${EXAMPLE}\``;

/** What a bonus to checks is written as, said to a `[CHECK ...]` that reads like one. */
export const BONUS_FORM = "a bonus to checks is an effect: write `[EFFECT CHECK: 1 condition, aid]`. The check a Maneuver rolls is `[CHECK Athletics vs Guard]`, with no colon and no number first";

/**
 * Does the text after `CHECK` read like a bonus to checks (`: 1 condition, aid`, `1 condition,
 * aid`, `-N condition`), and not like the check a Maneuver rolls? Asked before anything else is
 * said about a `CHECK`, wherever it was written, so the author is told the effect form and never
 * sent to a block that cannot hold a bonus (the review of 0.34.0).
 * @param {string} text
 * @returns {boolean}
 */
export function isBonusShape(text) {
  const data = String(text ?? "").trim();
  return data.startsWith(":") || /^[+-]?(\d+|N)\s+[A-Za-z]/.test(data);
}

const titled = word => (word ? word[0].toUpperCase() + word.slice(1) : word);

/** The four Defenses by their printed names: "Awareness", "Evade", "Guard", "Endure". */
export function defenseNames() {
  return Object.keys(DEFENSES).map(titled);
}

/** The Defense a word names, or null: the four are a closed list, so no resolver is asked. */
export function defenseKeyOf(written) {
  const slug = slugify(plainName(String(written ?? "")));
  return Object.hasOwn(DEFENSES, slug) ? slug : null;
}

/* -------------------------------------------- */
/*  Reading the block                           */
/* -------------------------------------------- */

/**
 * A `[CHECK ...]` block's data, read.
 * @param {string} data      The text after the keyword.
 * @param {object} [context] The grammar's context; `resolve` is read from it.
 * @returns {{rolls: "relevant"|Array<{slug: string, name: string}>, against: null|{defenses: string[]}|{threshold: number}}}
 */
export function readCheck(data, context = {}) {
  const text = String(data ?? "").trim().replace(/\.$/, "").trim();
  if (!text) throw new RuleSyntaxError(`CHECK is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  if (isBonusShape(text)) throw new RuleSyntaxError(BONUS_FORM);
  if (/[,;]/.test(text)) {
    throw new RuleSyntaxError(`CHECK joins alternatives with \`or\` and names what the check is read against after \`vs\`, with no comma: \`${EXAMPLE}\``);
  }
  // `and` is no joiner here, but it is a word of some names ("Spear and Polearm Fighting"). With a
  // resolver the names decide (`constellationOf`, below); without one nothing can, so it is refused.
  if ((typeof context?.resolve !== "function") && HAS_AND.test(text)) throw new RuleSyntaxError(NO_AND);
  const words = text.split(/\s+/);
  const wrong = words.find(word => NOT_VS.test(word));
  if (wrong) throw new RuleSyntaxError(`"${wrong}": CHECK writes it \`vs\`, as in \`${EXAMPLE}\``);
  const at = words.flatMap((word, index) => (VS.test(word) ? [index] : []));
  if (at.length > 1) throw new RuleSyntaxError(`CHECK has one \`vs\`: what is rolled before it, what it is read against after it, as in \`${EXAMPLE}\``);
  const left = (at.length ? words.slice(0, at[0]) : words).join(" ");
  const right = at.length ? words.slice(at[0] + 1).join(" ") : null;
  if (!left) throw new RuleSyntaxError(`CHECK names what is rolled before \`vs\`, as in \`${EXAMPLE}\``);
  if ((right !== null) && !right) throw new RuleSyntaxError(`CHECK names a Defense or a number after \`vs\`, as in \`${EXAMPLE}\` or \`[CHECK Crafting vs 15]\``);
  return { rolls: readRolls(left, context), against: (right === null) ? null : readAgainst(right) };
}

/** Left of `vs`: `relevant`, or Constellations joined by `or` (the user's pick). */
function readRolls(left, context) {
  const parts = splitAlternatives(left);
  if (parts.some(part => !part)) throw new RuleSyntaxError(`CHECK is written \`${SHAPE}\`: an \`or\` has nothing beside it`);
  if (parts.some(part => /^relevant(\s+check)?$/i.test(part))) {
    if (parts.length > 1) throw new RuleSyntaxError("`relevant` already means any Constellation, picked when it is rolled: write it alone before `vs`, as in `[CHECK relevant vs Guard]`");
    return RELEVANT;
  }
  const seen = new Set();
  const rolls = [];
  for (const part of parts) {
    const found = constellationOf(part, context);
    if (seen.has(found.slug)) throw new RuleSyntaxError(`"${found.name}" is named twice`);
    seen.add(found.slug);
    rolls.push(found);
  }
  return rolls;
}

/** One Constellation a check may roll, by the name the trees print. */
function constellationOf(written, context) {
  const resolve = (typeof context?.resolve === "function") ? context.resolve : null;
  let slug;
  let name;
  if (resolve) {
    const found = resolve(written);
    if (found?.type === "action") {
      throw new RuleSyntaxError(`"${found.name ?? written}" is a Maneuver: CHECK names the Constellation that is rolled, as in \`${EXAMPLE}\``);
    }
    if (found?.type === "constellation") {
      slug = String(found.slug);
      name = String(found.name ?? written);
    } else if (defenseKeyOf(written)) {
      // A resolver that knows no Defenses (a caller with the trees alone): the four are still names.
      slug = defenseKeyOf(written);
      name = titled(slug);
    } else if (HAS_AND.test(written)) {
      // No Constellation is called that, so the `and` was meant as a joiner.
      throw new RuleSyntaxError(NO_AND);
    } else {
      throw new RuleSyntaxError(`"${written}" names no Constellation: CHECK rolls a Skill, a Defense, Melee, Ranged or a Combat Style by the name the trees print, or \`relevant\``);
    }
  } else {
    slug = slugify(plainName(written));
    name = written;
    if (!slug) throw new RuleSyntaxError(`"${written}" names no Constellation`);
  }
  if (isLoreSlug(slug)) {
    throw new RuleSyntaxError("a Lore is each character's own, so no row can name one: write `[CHECK relevant]`, and the Lore is picked when it is rolled");
  }
  if (slug === ORIGIN_SLUG) throw new RuleSyntaxError("Origin is a rank a rule may ask about, not a check that is rolled: name the Constellation the Maneuver rolls");
  return { slug, name };
}

/** Right of `vs`: Defenses joined by `or` (the target's pick), or one number. */
function readAgainst(right) {
  const parts = splitAlternatives(right);
  if (parts.some(part => !part)) throw new RuleSyntaxError(`CHECK is written \`${SHAPE}\`: an \`or\` has nothing beside it`);
  if ((parts.length === 1) && /^\d+$/.test(parts[0])) {
    const threshold = Number(parts[0]);
    if ((threshold < THRESHOLD_RANGE.min) || (threshold > THRESHOLD_RANGE.max)) {
      throw new RuleSyntaxError(`a Threshold is a whole number from ${THRESHOLD_RANGE.min} to ${THRESHOLD_RANGE.max}, not ${parts[0]}`);
    }
    return { threshold };
  }
  if ((parts.length === 1) && /^[+-]?\d/.test(parts[0])) {
    throw new RuleSyntaxError(`a Threshold is a whole number from ${THRESHOLD_RANGE.min} to ${THRESHOLD_RANGE.max}, with no sign, as in \`[CHECK Crafting vs 15]\`, not ${parts[0]}`);
  }
  if (parts.some(part => /^[+-]?\d/.test(part))) {
    throw new RuleSyntaxError("after `vs` a number stands alone, as in `[CHECK Crafting vs 15]`: a Threshold is not one of a choice");
  }
  const defenses = [];
  for (const part of parts) {
    const key = defenseKeyOf(part);
    if (!key) {
      if (HAS_AND.test(part)) throw new RuleSyntaxError(NO_AND);
      throw new RuleSyntaxError(`"${part}" is not a Defense: after \`vs\` CHECK names ${defenseNames().join(", ")}, or a number; the Threshold of another Constellation is not read yet`);
    }
    if (defenses.includes(key)) throw new RuleSyntaxError(`"${titled(key)}" is named twice`);
    defenses.push(key);
  }
  return { defenses };
}

/* -------------------------------------------- */
/*  Saying it                                   */
/* -------------------------------------------- */

/**
 * The check in the cell's own words: "Athletics or Acrobatics vs Evade or Guard", "a Relevant
 * Check vs Guard", "Crafting vs 15". Reads a stored rule or a plan.
 * @param {object} check  `{ rolls, against }` (a rule) or a plan from `planOf`.
 * @param {(slug: string) => string} [nameOf]  A Constellation's printed name, for a plan built
 *   from the stored fields, which hold slugs alone.
 * @returns {string}
 */
export function checkWords(check, nameOf = null) {
  const plan = isPlan(check) ? check : planOf([{ ...check, kind: "check" }]);
  const label = roll => roll.name || (nameOf ? nameOf(roll.slug) : "") || titled(String(roll.slug ?? "").replace(/-/g, " "));
  const left = plan.relevant ? "a Relevant Check" : plan.rolls.map(label).join(" or ");
  const right = plan.defenses.length ? plan.defenses.map(titled).join(" or ") : (plan.threshold !== null ? String(plan.threshold) : "");
  return right ? `${left} vs ${right}` : left;
}

/** As read on the Item's sheet: the words, and whose each choice is. */
export function checkSummary(rule) {
  const plan = planOf([{ ...rule, kind: "check" }]);
  const notes = [];
  if (plan.relevant) notes.push("the Constellation is picked when it is rolled");
  else if (plan.rolls.length > 1) notes.push("the one using the Maneuver picks which is rolled");
  if (plan.defenses.length > 1) notes.push("the target picks the Defense");
  if (plan.threshold !== null) notes.push("the roll may change the Threshold");
  return `rolls ${checkWords(plan)}${notes.length ? ` (${notes.join("; ")})` : ""}`;
}

/* -------------------------------------------- */
/*  The plan                                    */
/* -------------------------------------------- */

const isPlan = value => !!value && (typeof value === "object") && Array.isArray(value.defenses) && ("declared" in value);

/**
 * What a Maneuver's check is, from the rules on its Item and the three stored fields.
 *
 *  - A `check` rule on the row is the word (the first, if a hand typed two: `extra` counts the
 *    rest, which the build refuses and the sheet says).
 *  - With none, the stored fields stand as they always have: `enabled` with a Constellation is
 *    that check, with none a Relevant Check, and `defense` the one Defense it is read against.
 *    A row that is not enabled has no check, whatever else it stores (a Posture's row).
 *
 * @param {object[]} rules   The Item's parsed rules (`system.rules`).
 * @param {{enabled?: boolean, constellation?: string, defense?: string}|null} [stored]
 * @returns {{enabled: boolean, declared: boolean, relevant: boolean, rolls: Array<{slug: string, name: string}>, defenses: string[], threshold: number|null, extra: number}}
 */
export function planOf(rules, stored = null) {
  const declared = (Array.isArray(rules) ? rules : []).filter(rule => rule && (rule.kind === "check") && !rule.error);
  if (declared.length) {
    const rule = declared[0];
    const relevant = rule.rolls === RELEVANT;
    const threshold = Number(rule.against?.threshold);
    return {
      enabled: true,
      declared: true,
      relevant,
      rolls: relevant ? [] : (Array.isArray(rule.rolls) ? rule.rolls : [])
        .filter(roll => roll && roll.slug)
        .map(roll => ({ slug: String(roll.slug), name: String(roll.name ?? "") })),
      defenses: (Array.isArray(rule.against?.defenses) ? rule.against.defenses : []).filter(key => Object.hasOwn(DEFENSES, key)),
      threshold: (rule.against && ("threshold" in rule.against) && Number.isFinite(threshold)) ? threshold : null,
      extra: declared.length - 1
    };
  }
  const enabled = stored?.enabled === true;
  const slug = String(stored?.constellation ?? "").trim();
  const defense = String(stored?.defense ?? "").trim();
  return {
    enabled,
    declared: false,
    relevant: enabled && !slug,
    rolls: (enabled && slug) ? [{ slug, name: "" }] : [],
    defenses: (enabled && Object.hasOwn(DEFENSES, defense)) ? [defense] : [],
    threshold: null,
    extra: 0
  };
}

/**
 * The three stored fields a plan comes to, for the readers that have only ever had them and for
 * the build, which writes them on every row. A choice has no single answer, so two Constellations
 * store none (which an old reader takes as a Relevant Check, a wider pick and never a wrong one)
 * and two Defenses store none.
 * @param {object} plan
 * @returns {{enabled: boolean, constellation: string, defense: string}}
 */
export function storedCheck(plan) {
  return {
    enabled: plan?.enabled === true,
    constellation: (plan?.enabled && !plan.relevant && (plan.rolls.length === 1)) ? plan.rolls[0].slug : "",
    defense: (plan?.enabled && (plan.defenses.length === 1)) ? plan.defenses[0] : ""
  };
}

/** Must the one using the Maneuver pick what is rolled? */
export function userPicks(plan) {
  return !!plan?.enabled && (plan.relevant || (plan.rolls.length > 1));
}

/** Must the target pick the Defense it is read against? */
export function targetPicks(plan) {
  return !!plan?.enabled && (plan.defenses.length > 1);
}
