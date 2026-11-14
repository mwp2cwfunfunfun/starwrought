/**
 * The `substitute` rule kind (0.21.0; rulings 215 to 222): a check made with another Attribute and
 * another Constellation's Proficiency Bonus. From the Human's Cooperative Instinct (Mike,
 * 2026-11-10): "When you Aid, you may use Presence + Origin proficiency in place of the Attribute
 * and proficiency normally used for that Aid check", and his generalisation: "Replacing the
 * Constellation AND the Attribute bonus for a check with something else". The tag is his own
 * word, written in his cell before the kind existed:
 *
 *   [EFFECT USE: <Attribute>, <Constellation>, <Maneuver>; IF: RANK(...); LIMIT: round | encounter]
 *
 *   [EFFECT USE: Presence, Origin, aid]        Cooperative Instinct
 *   [EFFECT USE: same, Origin, aid]            the Proficiency alone; the check keeps its Attribute
 *   [EFFECT USE: Presence, same, aid]          the Attribute alone
 *
 * Exactly three descriptors. The first is an Attribute (might, agility, wits, presence) or `same`;
 * the second the Constellation whose Proficiency Bonus is borrowed (Origin, a Skill, a Defense) or
 * `same`; `same` is "the term this check would use without this line", and `same, same` swaps
 * nothing. The third is the MANEUVER whose check is swapped, by the name the action sheets print.
 * A Constellation there is refused in this version (its own checks bring the Initiative question
 * of ruling 111 with the first Talent that wants them), and so are a Defense, a scope word and a
 * Lore: a USE never means every check. The components are `IF: RANK(...)` and `LIMIT:`; inside a
 * USE line `RANK(roll ...)` is the check's own rank, before any swap.
 *
 * The stored rule:
 *
 *   { kind: "substitute", line, text,
 *     attribute: "presence" | null,                              // null: the check keeps its own
 *     proficiency: { constellation: "origin", name: "Origin" } | null,
 *     to: { name: "Aid", slug: "aid", type: "action" | null },   // null without a resolver
 *     when: [{ constellation, name, op, rank } | { roll: true, op, rank }] | null,
 *     limit: { per } | null }
 *
 * `to`, `when` and `limit` under the names `bonus` gives them, so `summarizeOperators` reads them.
 * A flat Proficiency Bonus (a Talent that says "+3 instead of +0") would later be a new member
 * under `proficiency`, with no migration of the rules stored today.
 *
 * THE HOOK, `hooks.substitutions(entries, context, actor)` on the `substitutions` hook point
 * (../engine.mjs, `ruleSubstitutions`), defined with this kind and calculated in category
 * (../README.md): "this check is about to be assembled; which of the owner's rules would swap its
 * base terms?" The context is `{ kind, slug, item, rank, encounter }`, `rank` the check's own. The
 * answer is a list of candidates that mirror the rule, `{ key, item, label, attribute,
 * proficiency, certain: true, mark? }`: one per rule whose every IF holds, whose LIMIT is not
 * spent, and whose Maneuver is the Item the roll carries (`item.type === "action"`, the plain
 * name's slug). A check made without that Item is offered nothing (Mike, 2026-11-10: "Only from
 * Aid"), and nothing but a `check` is ever answered. The hook prices nothing, chooses nothing and
 * writes nothing: the check engine totals each candidate, offers them in the roll dialog, ticks the
 * one whose total is strictly the best, and files the chosen candidate's mark when the die is
 * thrown (dice/check/modifiers.mjs, dice/check/substitute.mjs).
 *
 * The hook is NOT named `use`: that hook point draws a Use control on the Talent's row and runs
 * when the Talent is used (../engine.mjs, `usableByRule`), which a substitution never is.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. It imports ../syntax.mjs and
 * ../operators.mjs (both pure) and the config, never the grammar or the registry (no circle).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, refuseOutcome, summarizeOperators, titled, readTargetName } from "../operators.mjs";
import { slugify, plainName, isLoreSlug, ATTRIBUTES, RANKS, DEFENSES, ruleCarrierKey } from "../../config.mjs";

const SHAPE = "USE: <Attribute>, <Constellation>, <Maneuver>";
const EXAMPLE = "USE: Presence, Origin, aid";

/** The word that keeps a term: "the term this check would use without this line". */
export const SAME = "same";

/** The scope words of the `bonus` kind, none of which a USE may name: it never means every check. */
const SCOPE_WORDS = Object.freeze(["checks", "defenses", "attacks", "initiative", "speed"]);

/** The four Attribute words, as a message lists them. */
function attributeList() {
  const words = Object.keys(ATTRIBUTES);
  return `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

/** Is this descriptor one of the four Attribute words, or `same`? */
function isAttributeWord(word) {
  const lower = String(word ?? "").trim().toLowerCase();
  return (lower === SAME) || Object.hasOwn(ATTRIBUTES, lower);
}

/** A Defense by the slug its name makes, with no resolver needed (the `DEF` tag's precedent). */
function isDefenseWord(word) {
  const slug = slugify(word);
  return Object.values(DEFENSES).some(d => d.slug === slug);
}

/**
 * The slips a count alone would misname (the grammar's review, 2026-11-10): a `+` between the two
 * terms (the Talent's own prose says "Presence + Origin proficiency"), a value and type (a bonus
 * is CHECK's), and two descriptors, where what is missing depends on what the two are.
 */
function refuseSlips(descriptors, resolve) {
  // A plus with a word before it; a signed number (`+3`) is the flat-bonus refusal's, further on.
  const plus = descriptors.find(d => /[^\s+]\s*\+/.test(d));
  if (plus !== undefined) {
    throw new RuleSyntaxError(`"${plus}": the Attribute and the Constellation are two descriptors with a comma between them, as in \`${EXAMPLE}\``);
  }
  if (descriptors.length && /^[+-]?\d+(\s|$)/.test(descriptors[0])) {
    throw new RuleSyntaxError(`USE takes no value: it names the terms a check is made with, \`${SHAPE}\`, as in \`${EXAMPLE}\`; a bonus is \`CHECK: 1 condition, aid\``);
  }
  if (descriptors.length === 3) return;
  if (!descriptors.length) throw new RuleSyntaxError(`a substitution is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  if (descriptors.length > 3) {
    throw new RuleSyntaxError(`USE takes three descriptors, the Attribute, the Constellation and the Maneuver, not ${descriptors.length}: \`${EXAMPLE}\``);
  }
  if (descriptors.length === 1) {
    throw new RuleSyntaxError(`a substitution is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (1 descriptor given, 3 wanted)`);
  }
  // Two descriptors: say which of the three is missing, and how `same` fills it. An example is
  // never one the parser would refuse in its turn (the review of 2026-11-10): `same, aid` is not
  // told to write `same, same, aid`, and `Origin, same` is not told to end a line in `same`.
  const [first, second] = descriptors;
  const isSame = word => String(word ?? "").trim().toLowerCase() === SAME;
  const noManeuver = `the Maneuver is missing: USE never means every check; name the Maneuver whose check is swapped third, as in \`${EXAMPLE}\` (write same for a term the check keeps)`;
  if (!isAttributeWord(first)) {
    if (isSame(second)) throw new RuleSyntaxError(noManeuver);
    throw new RuleSyntaxError(`the Attribute is missing: USE takes three descriptors, as in \`USE: same, ${first}, ${second}\` to keep the check's own Attribute (${attributeList()} names another)`);
  }
  const named = (typeof resolve === "function") ? resolve(second) : null;
  if (named?.type === "action") {
    if (isSame(first)) {
      throw new RuleSyntaxError(`a term is missing: USE takes three descriptors, and same twice swaps nothing; name the Attribute, the Constellation, or both, as in \`USE: Presence, same, ${second}\` or \`USE: same, Origin, ${second}\``);
    }
    throw new RuleSyntaxError(`the Constellation is missing: USE takes three descriptors, as in \`USE: ${first}, same, ${second}\` to keep the check's own Proficiency Bonus`);
  }
  throw new RuleSyntaxError(noManeuver);
}

/** The first descriptor: an Attribute key, or null for `same`. */
function readAttribute(word) {
  const lower = String(word ?? "").trim().toLowerCase();
  if (lower === SAME) return null;
  if (lower === "roll") throw new RuleSyntaxError("`roll` is RANK's word; in a USE line write same for a term the check keeps");
  if (Object.hasOwn(ATTRIBUTES, lower)) return lower;
  throw new RuleSyntaxError(`"${String(word ?? "").trim()}" is not an Attribute: write ${attributeList()}, or same to keep the check's own`);
}

/** The second descriptor: the Constellation whose Proficiency Bonus is borrowed, or null for `same`. */
function readProficiency(word, resolve) {
  const written = String(word ?? "").trim();
  const lower = written.toLowerCase();
  if (lower === SAME) return null;
  if (lower === "roll") throw new RuleSyntaxError("`roll` is RANK's word; in a USE line write same for a term the check keeps");
  // Before any resolver, so a cell reads the same refusal with and without one: these are the
  // words a flat Proficiency Bonus would be written with, and that form is not built.
  if (Object.hasOwn(RANKS, lower) || /^[+-]?\d+$/.test(lower)) {
    throw new RuleSyntaxError(`"${written}": a flat Proficiency Bonus is not read yet; the second descriptor is the Constellation whose Proficiency Bonus is borrowed, or same`);
  }
  if (Object.hasOwn(ATTRIBUTES, lower)) {
    throw new RuleSyntaxError(`"${written}" is an Attribute, and the first descriptor is where it goes; the second is the Constellation whose Proficiency Bonus is borrowed, or same`);
  }
  const read = readTargetName(written, resolve);
  if (!read || !read.slug) throw new RuleSyntaxError(`"${written}" is not a Constellation`);
  if ((read.type !== null) && (read.type !== "constellation")) {
    throw new RuleSyntaxError(`"${read.name}" is not a Constellation: a Maneuver has no Proficiency Bonus to borrow`);
  }
  if (read.found?.group) {
    throw new RuleSyntaxError(`"${read.name}" is a group and has no rank of its own;${read.found.parent ? ` borrow ${read.found.parent} instead` : " borrow its parent instead"}`);
  }
  if (isLoreSlug(read.slug)) throw new RuleSyntaxError("a Lore is the character's own; a substitution cannot borrow it");
  return { constellation: read.slug, name: read.name };
}

/** The third descriptor: the Maneuver whose check is swapped. */
function readCheck(word, resolve) {
  const written = String(word ?? "").trim();
  const lower = written.toLowerCase();
  if (lower === SAME) throw new RuleSyntaxError(`same keeps one of the first two terms; the third descriptor names the Maneuver whose check is swapped, as in \`${EXAMPLE}\``);
  if (SCOPE_WORDS.includes(slugify(written))) {
    throw new RuleSyntaxError(`"${written}" is a scope word, and USE never means every check: name the Maneuver whose check is swapped, as in \`${EXAMPLE}\``);
  }
  if (isDefenseWord(written)) {
    throw new RuleSyntaxError(`"${written}" is a Defense: its Threshold and its roll against an attack are never substituted; name the Maneuver that rolls it`);
  }
  const read = readTargetName(written, resolve);
  if (!read || !read.slug) throw new RuleSyntaxError(`"${written}" names no Constellation or Maneuver`);
  if (isLoreSlug(read.slug)) throw new RuleSyntaxError("a Lore is the character's own; a substitution cannot name it");
  if (read.type === "constellation") {
    throw new RuleSyntaxError(`"${read.name}" is a Constellation: USE reads a Maneuver's check in this version, as in \`${EXAMPLE}\`; a Constellation's own checks are not read yet`);
  }
  return { name: read.name, slug: read.slug, type: read.type };
}

/** The conditions of a rule as a list, whatever shape `when` was stored in. */
function whensOf(rule) {
  return Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
}

/* -------------------------------------------- */

export default {
  id: "substitute",
  aliases: [],

  /**
   * @param {string} args      The text after the tag, trimmed (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect` and `resolve` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a substitution is an effect: \`[EFFECT ${EXAMPLE}]\``);
    const e = context.effect;
    // Inside `[AURA ...; USE: ...]` the grammar has made the ring the FOR, so the component
    // refusal below would name a FOR the author never wrote. Say what was written instead.
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`a substitution is the owner's own roll and cannot ride an [AURA ...] block; write it as its own \`[EFFECT ${EXAMPLE}]\``);
    }
    const ops = refuseComponents(e.ops, "USE", ["when", "limit"]);
    refuseOutcome(ops);
    if (whensOf(ops).some(w => w?.trait)) throw new RuleSyntaxError("USE does not take IFT: TRAIT(...)");

    const descriptors = e.descriptors;
    refuseSlips(descriptors, context.resolve);
    const attribute = readAttribute(descriptors[0]);
    const proficiency = readProficiency(descriptors[1], context.resolve);
    if (!attribute && !proficiency) {
      throw new RuleSyntaxError(`\`USE: same, same\` swaps nothing: name the Attribute, the Constellation, or both, as in \`${EXAMPLE}\``);
    }
    const to = readCheck(descriptors[2], context.resolve);
    return { attribute, proficiency, to, when: ops.when, limit: ops.limit };
  },

  /** `may use Presence + Origin proficiency on checks to Aid`, the Talent's own phrase. */
  summary(rule) {
    const terms = [];
    if (rule?.attribute) terms.push(titled(rule.attribute));
    if (rule?.proficiency) terms.push(`${rule.proficiency.name ?? titled(rule.proficiency.constellation)} proficiency`);
    // On a USE line `RANK(roll ...)` is the check's own rank, before the swap (the header).
    const tail = summarizeOperators(rule).replace(/the roll's rank/g, "the check's own rank");
    return `may use ${terms.join(" + ")} on checks to ${rule?.to?.name ?? ""}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * The swaps this kind's rules offer on a check about to be assembled (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object}>} entries  This kind's rules on the roller.
     * @param {{kind: string, slug: string, item: object|null, rank?: string, encounter?: object|null}} context
     *        `rank` is the check's own rank, before any swap; `item` the Item behind the roll.
     * @param {object} actor  The roller.
     * @returns {Array<{key: string, item: object, label: string, attribute: string|null, proficiency: {constellation: string, name: string}|null, certain: boolean, mark?: {key: string, per: string}}>}
     */
    substitutions(entries, context = {}, actor = null) {
      const out = [];
      if ((context?.kind ?? "check") !== "check") return out;
      const rollItem = context?.item ?? null;
      const rollManeuver = (rollItem?.type === "action") ? slugify(plainName(rollItem.name)) : null;
      // Only from the Maneuver's own Item: a check made without one is offered nothing.
      if (!rollManeuver) return out;
      const encounter = context?.encounter ?? null;

      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule?.to?.slug || (!rule.attribute && !rule.proficiency?.constellation)) continue;
        // A Constellation as the check is not read in this version (the parse refuses it; a rule
        // stored by hand is passed over here).
        if (rule.to.type === "constellation") continue;
        if (rollManeuver !== rule.to.slug) continue;

        // IF: every condition holds for the owner. `roll` is the check's own rank; an entry this
        // kind does not know (a trait, a degree, a condition of a later version) does not hold.
        let holds = true;
        for (const w of whensOf(rule)) {
          if (w?.roll === true) {
            if ((context?.rank === undefined) || (context?.rank === null) || !rankMeets(context.rank, w.op ?? "=", w.rank)) { holds = false; break; }
            continue;
          }
          if (!w?.constellation || w.trait || w.outcome || (typeof actor?.system?.proficiency !== "function")) { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;

        // LIMIT: the roller's mark for this round or this encounter, as the `bonus` kind reads it.
        // The mark rides on the candidate and is filed only if this is the swap the die is thrown with.
        let mark = null;
        if (rule.limit) {
          const key = `${carrier?.id ?? carrier?.name ?? "rule"}:${rule.line ?? 0}`;
          const combat = encounter?.combat ?? null;
          if (combat) {
            const marks = actor?.flags?.starwrought?.rules ?? {};
            const held = marks[rule.limit.per]?.[key] ?? null;
            if (rule.limit.per === "round") {
              if (held && (held.combat === combat) && (held.round === (encounter.round ?? 0))) continue;
            } else if (held && ((held === combat) || (held.combat === combat))) continue;
            mark = { key, per: rule.limit.per };
          }
        }

        out.push({
          key: `use-${ruleCarrierKey(carrier)}-${rule.line ?? 0}`,
          item: carrier,
          label: plainName(carrier?.name ?? ""),
          attribute: rule.attribute ?? null,
          proficiency: rule.proficiency?.constellation
            ? { constellation: String(rule.proficiency.constellation), name: String(rule.proficiency.name ?? titled(rule.proficiency.constellation)) }
            : null,
          certain: true,
          ...(mark ? { mark } : {})
        });
      }
      return out;
    }
  }
};
