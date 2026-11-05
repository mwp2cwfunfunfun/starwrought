/**
 * The `bonus` rule kind (0.10.0; rulings 121 to 124): a typed bonus or penalty to a Constellation's
 * checks or to a Maneuver's roll, optionally gated on the character's rank in a Constellation.
 *
 * The first kind, and Mike's own (2026-10-03): "first automation kind we will create is the Human
 * Ancestry one. The Effect is: 'You gain a +1 Condition bonus on checks to Aid. If you are Expert
 * in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you are Legendary, +4.'
 * So we need Automation for something like ... IF (Constellation Proficiency = VALUE) where VALUE
 * = Untrained, Trained, Expert, Master, Legendary, Grant [X Value (+1, +2, -1, -2, etc.)]; [Y type
 * (Condition, Situation, Gear, etc.)]; [Z Check (Constellation or Maneuver Roll)]. In this case,
 * it would use a Maneuver called Aid." His sketch, made concrete (ruling 121):
 *
 *   bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]
 *
 *   bonus: +1 Condition to Aid if Human is Trained
 *   bonus: +2 Condition to Aid if Human is Expert
 *   bonus: +3 Condition to Aid if Human is Master
 *   bonus: +4 Condition to Aid if Human is Legendary
 *
 * `<value>` is a signed integer (a bare `1` reads as `+1`; `0` does nothing and is refused).
 * `<Type>` is one of the book's three, Situation, Condition or Gear (PHB v3.3), case blind; the
 * retired words (circumstance, status, item: SW.LEGACY_BONUS_TYPES) are refused by name, and so is
 * `untyped`, since no Talent bonus is untyped. `to <Target>` is required and names a Constellation
 * or a Maneuver as the trees and the action sheets print it, case blind, the slug form accepted
 * and a Maneuver's cost glyphs ignored. The `if` clause is optional and is EQUALITY, as Mike wrote
 * it: the rule applies while the character's rank in that Constellation is exactly that rank, so
 * Humanity's Effect is four lines, one per sentence, and never two at once. The word between is
 * `is`, not `=`, and the error says so.
 *
 * The stored rule, which every reader agrees on:
 *
 *   { kind: "bonus", line, text,
 *     value: 1,                                              // signed integer, never 0
 *     type: "condition",                                     // "situation" | "condition" | "gear"
 *     to:   { name: "Aid", slug: "aid", type: "action" },    // type: "constellation" | "action" | null
 *     when: { constellation: "human", name: "Human", rank: "expert" } }   // or null
 *
 * `to.type` and the resolved names come from `context.resolve`, an OPTIONAL function the caller
 * puts on the parse context: `resolve(name) -> { type, slug, name } | null`. The build gives the
 * grammar one over the trees and the action sheets; the client gives it one over the registry,
 * the Actions pack and the world's Maneuvers. With a resolver a target it does not know is
 * refused, an `if` Constellation that is a Maneuver or nothing is refused, and a target that is
 * the Lore template is refused (a Lore is the character's own). With no resolver (the self-test,
 * a caller that has none) the kind stores `to.type: null` and the slugs it can make itself, and
 * the hook matches on slug alone.
 *
 * THE HOOK. `hooks.modifiers(entries, context, actor)` answers the engine's one question of a
 * kind at roll time (ruling 124: the engine asks every registered kind at the check assembly and
 * at the Defense pass, and a kind answers for its own rules). For each of this kind's rules on the
 * actor: a conditioned rule is skipped unless `actor.system.proficiency(constellation).rank` is
 * the named rank (an adversary has no `proficiency`, so a conditioned rule never fires for one; an
 * unconditioned one still can where the engine asks). A Constellation target APPLIES when the
 * roll's Constellation slug is the target's. A Maneuver target APPLIES when the roll carries that
 * Maneuver's Item (ruling 123: a Maneuver roll is a roll made from the Maneuver's Item; Aid's
 * Relevant Check carries Aid); when the roll carries no Maneuver at all and is a check, the bonus
 * is OFFERED unticked in the roll dialog instead (ruling 122: the judgement "is this roll an Aid?"
 * sits with the player at the edge, the Load Strain Climb-or-Swim precedent), and it is never
 * offered on an attack, a Defense or an Initiative, nor on a check made from another Maneuver's
 * Item, which is plainly not an Aid. The applied modifier's label is the carrier's plain name, so
 * the card reads "Humanity +1"; typed stacking is the engine's (SW.resolveModifiers), so two lines
 * that both match (a designer's overlap, never Humanity's) resolve to the highest of the type.
 *
 * What the hook does NOT do: it reaches no adversary's roll (adversaries roll flat in 0.10.0), it
 * reads no Effect text, and it moves nothing but a roll's modifiers and, through the Defense pass,
 * a Defense Threshold.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. `assets/build_foundry.mjs` imports the
 * registry, and through it this file, from plain Node (ruling 120). `RuleSyntaxError` is imported
 * from ../syntax.mjs, which imports nothing, never from the grammar: the grammar imports the
 * registry and the registry imports this file, so a kind that imported the grammar would close a
 * circle that breaks when the kind file is the first module loaded (review, 2026-10-03).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { slugify, plainName, RANKS, LEGACY_BONUS_TYPES, isLoreSlug } from "../../config.mjs";

/** The shape, printed in every error that is about the line as a whole. */
const SHAPE = "bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]";
const EXAMPLE = "bonus: +1 Condition to Aid if Human is Expert";

/** The three type words of PHB v3.3, lower-cased, in the book's order. */
const TYPES = Object.freeze(["situation", "condition", "gear"]);

/**
 * One case-blind pass over the whole argument string: the value, the type word, the target (lazy,
 * so an `if` clause at the end is read as the clause and not as part of the name), and the
 * optional clause. `to` is required: a line without it does not match and gets the shape.
 */
const PATTERN = /^([+-]?\d+)\s+([A-Za-z]+)\s+to\s+(.+?)(?:\s+if\s+(.+?)\s+is\s+([A-Za-z]+))?$/i;

/** The word in Title Case for a summary: "condition" to "Condition", "expert" to "Expert". */
function titled(word) {
  const w = String(word ?? "");
  return w ? w[0].toUpperCase() + w.slice(1) : w;
}

/** A signed integer as the book prints it: "+1", "-2". */
function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

/* -------------------------------------------- */

/**
 * The type word, checked. The retired words name the current one so the designer knows what to
 * write; `untyped` is refused outright, since no Talent bonus is untyped (CLAUDE.md, bonus types).
 * @param {string} word
 * @returns {string} A member of TYPES.
 */
function readType(word) {
  const lower = String(word ?? "").toLowerCase();
  if (TYPES.includes(lower)) return lower;
  // `hasOwn`, not a truthy lookup: "constructor" is a word a cell can hold and a property every
  // plain object has (review, 2026-10-03).
  if (Object.hasOwn(LEGACY_BONUS_TYPES, lower)) {
    const current = titled(LEGACY_BONUS_TYPES[lower]);
    throw new RuleSyntaxError(`write ${current}, not ${lower}: the book renamed the types in v3.3`);
  }
  if (lower === "untyped") throw new RuleSyntaxError("no Talent bonus is untyped; name Situation, Condition or Gear");
  throw new RuleSyntaxError(`"${word}" is not a bonus type: write Situation, Condition or Gear`);
}

/**
 * The rank word, checked against the keys of SW.RANKS. The message lists all five, since the
 * likeliest slip is a tier letter or a plural.
 * @param {string} word
 * @returns {string} A key of RANKS.
 */
function readRank(word) {
  const lower = String(word ?? "").toLowerCase();
  if (Object.hasOwn(RANKS, lower)) return lower;
  const names = Object.keys(RANKS).map(titled);
  const list = `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
  throw new RuleSyntaxError(`"${word}" is not a rank: write ${list}`);
}

/**
 * The target of `to`, through the caller's resolver when there is one. A Maneuver's glyphs never
 * reach the slug (`slugify(plainName(name))`), so `Aid ❶ (⓿↺)` and `Aid` are one target.
 * @param {string} name
 * @param {Function|undefined} resolve
 * @returns {{name: string, slug: string, type: string|null}}
 */
function readTarget(name, resolve) {
  const written = String(name ?? "").trim();
  let target;
  if (typeof resolve === "function") {
    const found = resolve(written);
    if (!found || !found.slug) throw new RuleSyntaxError(`"${written}" names no Constellation or Maneuver`);
    target = { name: String(found.name ?? written), slug: String(found.slug), type: found.type ?? null };
  } else {
    target = { name: written, slug: slugify(plainName(written)), type: null };
  }
  if (isLoreSlug(target.slug)) throw new RuleSyntaxError("a Lore is the character's own; a bonus cannot name it");
  return target;
}

/**
 * The Constellation of the `if` clause. With a resolver it must resolve to a Constellation: a
 * Maneuver has no rank to be at, and a name the resolver does not know is most likely a typo. A
 * Lore is refused with or without one: "if Lore is Expert" names no particular Lore, and a Lore
 * instance is the character's own (review, 2026-10-03).
 * @param {string} name
 * @param {Function|undefined} resolve
 * @returns {{constellation: string, name: string}}
 */
function readConstellation(name, resolve) {
  const written = String(name ?? "").trim();
  let out;
  if (typeof resolve === "function") {
    const found = resolve(written);
    if (!found || (found.type !== "constellation") || !found.slug) {
      throw new RuleSyntaxError(`"${written}" is not a Constellation`);
    }
    out = { constellation: String(found.slug), name: String(found.name ?? written) };
  } else {
    out = { constellation: slugify(written), name: written };
  }
  if (isLoreSlug(out.constellation)) {
    throw new RuleSyntaxError("a Lore is the character's own; a rank condition cannot name it");
  }
  return out;
}

/* -------------------------------------------- */

export default {
  id: "bonus",
  aliases: [],

  /**
   * @param {string} args      The text after `bonus:`, trimmed.
   * @param {object} context   The grammar's context; `resolve` is read from it when present.
   * @returns {{value: number, type: string, to: object, when: (object|null)}}
   */
  parse(args, context = {}) {
    // A designer ends a sentence with a period; one trailing period is not part of the last word
    // (review, 2026-10-03: "if Human is Expert." read as a shape error before this).
    const text = String(args ?? "").trim().replace(/\.$/, "").trim();
    const match = text.match(PATTERN);
    if (!match) {
      throw new RuleSyntaxError(`a bonus is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
    }
    const [, valueText, typeWord, targetText, whenName, rankWord] = match;

    const value = Number(valueText);
    if (!Number.isInteger(value)) throw new RuleSyntaxError(`a bonus is a whole number such as +1 or -2, not "${valueText}"`);
    if (value === 0) throw new RuleSyntaxError("a bonus of 0 does nothing");

    const type = readType(typeWord);

    // A target that still holds " if " is a clause the pattern could not read: `if Human = Expert`,
    // `if Human Expert`, `if Human is Expert extra`. Say what the clause looks like.
    if ((whenName === undefined) && /\s+if\s+/i.test(` ${targetText} `)) {
      throw new RuleSyntaxError("the condition is written `if <Constellation> is <Rank>`: write `if Human is Expert`");
    }

    const resolve = context?.resolve;
    const to = readTarget(targetText, resolve);

    let when = null;
    if (whenName !== undefined) {
      const rank = readRank(rankWord);
      const { constellation, name } = readConstellation(whenName, resolve);
      when = { constellation, name, rank };
    }

    return { value, type, to, when };
  },

  /**
   * `+1 Condition bonus to Aid while Human is Expert`; a negative value says `penalty`; no `when`,
   * no `while`. Type and rank words title-cased; names as stored.
   * @param {object} rule
   * @returns {string}
   */
  summary(rule) {
    const value = Number(rule?.value) || 0;
    const word = value < 0 ? "penalty" : "bonus";
    let out = `${signed(value)} ${titled(rule?.type)} ${word} to ${rule?.to?.name ?? ""}`;
    if (rule?.when) out += ` while ${rule.when.name} is ${titled(rule.when.rank)}`;
    return out;
  },

  hooks: {
    /**
     * The modifiers this kind's rules put on a roll (the header, THE HOOK).
     * @param {Array<{rule: object, item: object}>} entries   This kind's rules on the actor.
     * @param {{kind: string, slug: string, item: (object|null)}} context   The roll.
     * @param {object} actor
     * @returns {Array<{label: string, value: number, type: string, offer?: boolean, key?: string, hint?: string}>}
     */
    modifiers(entries, context = {}, actor = null) {
      const out = [];
      const rollKind = context?.kind ?? "check";
      const rollSlug = String(context?.slug ?? "");
      const rollItem = context?.item ?? null;
      // The engine says so when the roll's Constellation has already had its rules folded in (the
      // Defense pass did it for a Defense roll, and the check engine's Defense branch asks again
      // only for what depends on the Item): a Constellation target is then not answered twice.
      const folded = context?.constellationFolded === true;
      // The Maneuver the roll was made from, if it was made from one: an action Item's plain name
      // as a slug. A weapon or a Talent behind the roll is not a Maneuver.
      const rollManeuver = (rollItem?.type === "action") ? slugify(plainName(rollItem.name)) : null;
      // An actor with no `proficiency` (an adversary, a plain object) has no rank to be at, so a
      // conditioned rule never fires for one, "if Human is Untrained" included (review, 2026-10-03).
      const ranked = typeof actor?.system?.proficiency === "function";

      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || (typeof rule.value !== "number") || !rule.to?.slug) continue;

        // The rank condition: equality, read live from the prepared Constellations.
        if (rule.when) {
          if (!ranked) continue;
          const rank = actor.system.proficiency(rule.when.constellation)?.rank ?? "untrained";
          if (rank !== rule.when.rank) continue;
        }

        const target = rule.to;
        const asConstellation = (target.type === "constellation") || (target.type == null);
        const asManeuver = (target.type === "action") || (target.type == null);
        const label = plainName(carrier?.name ?? "");

        if (asConstellation && rollSlug && (rollSlug === target.slug)) {
          if (!folded) out.push({ label, value: rule.value, type: rule.type });
          continue;
        }
        if (!asManeuver) continue;

        if (rollManeuver !== null) {
          // The roll is some Maneuver's. The bonus applies when it is this one and is otherwise
          // nothing: a Search is not an Aid, and offering it would ask the player a question the
          // Item has already answered.
          if (rollManeuver === target.slug) out.push({ label, value: rule.value, type: rule.type });
          continue;
        }
        // No Maneuver behind the roll. On a check the player may know it is one (ruling 122);
        // an attack, a Defense or an Initiative is never a Maneuver's roll. A target of no known
        // type (a rule stored with no resolver) is never offered: the offer is for a Maneuver the
        // cell was checked against, not a guess at what a name might be (review, 2026-10-03).
        if ((rollKind !== "check") || (target.type == null)) continue;
        out.push({
          label: `${label}: ${target.name}`,
          value: rule.value,
          type: rule.type,
          offer: true,
          key: `bonus-${carrier?.id ?? carrier?.name ?? "rule"}-${rule.line ?? 0}`,
          hint: `${label}: this bonus applies to checks to ${target.name}. Tick it if this roll is one.`
        });
      }
      return out;
    }
  }
};
