/**
 * The `bonus` rule kind (0.10.0; rulings 121 to 124; rewritten to the operator grammar in 0.13.0):
 * a typed bonus or penalty to a roll, and to the Threshold that roll's Constellation presents.
 *
 * The first kind, and Mike's own (2026-10-03): "first automation kind we will create is the Human
 * Ancestry one. The Effect is: 'You gain a +1 Condition bonus on checks to Aid. If you are Expert
 * in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you are Legendary, +4.'"
 * Then, on the second draft of the grammar (2026-11-05): "I am OK using logical operands like
 * IF(Origin=Trained) and grammatical shortcuts like Bonus: +1, Condition, Aid". So (AUTOMATION_GRAMMAR.md):
 *
 *   bonus: <±N>, <Type>, <Target> [, operators]
 *
 *   bonus: +1, Condition, Aid, IF(Origin=Trained)                                              Humanity
 *   bonus: +1, Situation, Checks, IF(Rank=Untrained)                                           Jack of Trades
 *   bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)   Close Ranks
 *   bonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)      Torchbearer Human
 *
 * `<±N>` is a signed integer (a bare `1` reads as `+1`; `0` is refused). `<Type>` is Situation,
 * Condition or Gear (the retired words refused by name, `untyped` refused). `<Target>` is a
 * Constellation or a Maneuver by the book's name, or one of the words Defenses (all four), Checks
 * (every check that is not an attack, an Initiative included), Attacks, Initiative. The operators
 * are the grammar's (../operators.mjs): IF, FOR, WHILE, AGAINST, SEEN, FIRST, ONCE. The 0.10.0 prose
 * form (`+1 Condition to Aid if Human is Expert`) is retired and refused with the new shape.
 *
 * The stored rule:
 *
 *   { kind: "bonus", line, text,
 *     value: 1, type: "condition",
 *     to:   { name: "Aid", slug: "aid", type: "action" },     // "constellation" | "action" | "scope" | null
 *     when: [{ constellation: "origin", name: "Origin", op: "=", rank: "trained" }] | null,
 *           // or { roll: true, op, rank } for IF(Rank=...), or { trait, name } for IF(Trait=...)
 *     for: { who, range } | null, while: { who, op, count, range } | null,
 *     against: { threat, reach } | null, seen: boolean, limit: { per } | null }
 *
 * THE HOOK, `hooks.modifiers(entries, context, actor)` (ruling 124; the engine's ../engine.mjs).
 * `entries` are this kind's rules that may reach `actor`: the actor's own, and since 0.13.0 the
 * rules of other tokens on the scene whose FOR names others (each entry carries `owner` and
 * `ownerToken`). For each rule: every IF must hold for the OWNER (the roll's own rank for `Rank`,
 * the attack's traits in `context.threat.traits` for `Trait`); FOR must reach the recipient (self
 * for the owner's own roll, else the scene's relation and gap between the two tokens), and SEEN
 * asks the scene whether the recipient's token sees the owner's (`scene.sees`); WHILE counts the
 * tokens around the owner; AGAINST needs the Threat the roll answers; FIRST/ONCE reads the
 * recipient's mark and asks for one to be written. A rule that
 * needs the scene, the Threat or the round is answered only where they are known (`momentOnly`),
 * and the sheet's Defense pass asks for the rest (`staticOnly`); see ../engine.mjs. Then the
 * target: a Constellation applies on its slug; a scope word on the roll's kind; a Maneuver when the
 * roll carries that Maneuver's Item, and is OFFERED unticked on a check made without one (ruling
 * 122), never on an attack, a Defense or an Initiative. The label is the carrier's plain name (with
 * the owner's name when it is someone else's Talent), and one Talent's lines on one target share a
 * `source`, so they are one circumstance under PHB v4.21's stacking.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. It imports ../syntax.mjs and
 * ../operators.mjs (both pure) and the config, never the grammar or the registry (no circle).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readLine, rankMeets, whoMatches, compare, hasTrait, needsMoment, summarizeOperators, titled } from "../operators.mjs";
import { slugify, plainName, LEGACY_BONUS_TYPES, isLoreSlug } from "../../config.mjs";

const SHAPE = "bonus: <±N>, <Type>, <Target> [, operators]";
const EXAMPLE = "bonus: +1, Condition, Aid, IF(Origin=Trained)";
const OPERATORS_TAKEN = Object.freeze(["IF", "FOR", "WHILE", "AGAINST", "SEEN", "FIRST", "ONCE"]);

/** The three type words of PHB v3.3, lower-cased. */
const TYPES = Object.freeze(["situation", "condition", "gear"]);

/**
 * The target words that are not a Constellation or a Maneuver: a scope of rolls. Keyed by the
 * slug the word makes; the value is the roll kinds it applies to.
 */
const SCOPES = Object.freeze({
  defenses: { name: "Defenses", kinds: ["defense"] },
  checks: { name: "Checks", kinds: ["check", "initiative"] },
  attacks: { name: "Attacks", kinds: ["attack"] },
  initiative: { name: "Initiative", kinds: ["initiative"] }
});

/** A signed integer as the book prints it. */
function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

/* -------------------------------------------- */

/** The type word, checked; the retired words name the current one. */
function readType(word) {
  const lower = String(word ?? "").toLowerCase();
  if (TYPES.includes(lower)) return lower;
  if (Object.hasOwn(LEGACY_BONUS_TYPES, lower)) {
    throw new RuleSyntaxError(`write ${titled(LEGACY_BONUS_TYPES[lower])}, not ${lower}: the book renamed the types in v3.3`);
  }
  if (lower === "untyped") throw new RuleSyntaxError("no Talent bonus is untyped; name Situation, Condition or Gear");
  throw new RuleSyntaxError(`"${word}" is not a bonus type: write Situation, Condition or Gear`);
}

/**
 * The target: a scope word, else the caller's resolver, else the slug made here. A Maneuver's
 * glyphs never reach the slug, so `Aid ❶ (⓿↺)` and `Aid` are one target. A Lore is refused.
 */
function readTarget(name, resolve) {
  const written = String(name ?? "").trim();
  const scopeSlug = slugify(written);
  if (Object.hasOwn(SCOPES, scopeSlug)) return { name: SCOPES[scopeSlug].name, slug: scopeSlug, type: "scope" };
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

/* -------------------------------------------- */

export default {
  id: "bonus",
  aliases: [],

  /**
   * @param {string} args      The text after `bonus:`, trimmed.
   * @param {object} context   The grammar's context; `resolve` is read from it when present.
   */
  parse(args, context = {}) {
    const text = String(args ?? "").trim();
    // The 0.10.0 prose form, retired: a line with no comma and the word `to` in it.
    if (!text.includes(",") && /\s+to\s+/i.test(text)) {
      throw new RuleSyntaxError(`the 0.10.0 form "bonus: +1 Condition to Aid if Human is Expert" is retired; write \`${EXAMPLE}\``);
    }
    const { args: parts, ops } = readLine(text, { allow: OPERATORS_TAKEN, kind: "bonus", context });
    if (parts.length !== 3) {
      throw new RuleSyntaxError(`a bonus is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} argument${parts.length === 1 ? "" : "s"} given, 3 wanted)`);
    }
    const [valueText, typeWord, targetText] = parts;

    if (!/^[+-]?\d+$/.test(valueText)) throw new RuleSyntaxError(`a bonus is a whole number such as +1 or -2, not "${valueText}"`);
    const value = Number(valueText);
    if (value === 0) throw new RuleSyntaxError("a bonus of 0 does nothing");

    const type = readType(typeWord);
    const to = readTarget(targetText, context?.resolve);

    return { value, type, to, when: ops.when, for: ops.for, while: ops.while, against: ops.against, seen: ops.seen, limit: ops.limit };
  },

  /** `+1 Condition bonus to Aid while Origin is Trained`; `penalty` when negative. */
  summary(rule) {
    const value = Number(rule?.value) || 0;
    const word = value < 0 ? "penalty" : "bonus";
    const tail = summarizeOperators(rule);
    return `${signed(value)} ${titled(rule?.type)} ${word} to ${rule?.to?.name ?? ""}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * The modifiers this kind's rules put on a roll (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object, ownerToken?: object}>} entries
     * @param {object} context  { kind, slug, item, rank, threat, scene, encounter, staticOnly, momentOnly }
     * @param {object} actor    The recipient: whose roll or Threshold this is.
     */
    modifiers(entries, context = {}, actor = null) {
      const out = [];
      const rollKind = context?.kind ?? "check";
      const rollSlug = String(context?.slug ?? "");
      const rollItem = context?.item ?? null;
      const scene = context?.scene ?? null;
      const encounter = context?.encounter ?? null;
      const rollManeuver = (rollItem?.type === "action") ? slugify(plainName(rollItem.name)) : null;

      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || (typeof rule.value !== "number") || !rule.to?.slug) continue;
        const owner = entry.owner ?? actor;
        const ownRoll = owner === actor;
        const moment = needsMoment(rule);
        if (context?.staticOnly && moment) continue;
        if (context?.momentOnly && !moment) continue;

        // IF: every condition holds for the OWNER, the roll's own rank for `Rank`, the attack
        // answered for `Trait` (0.14.0; no attack known, no match).
        const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
        let holds = true;
        for (const w of whens) {
          if (w.trait) {
            if (!hasTrait(context?.threat?.traits, w.trait)) { holds = false; break; }
            continue;
          }
          if (w.roll) {
            if (context?.rank === undefined || context?.rank === null) { holds = false; break; }
            if (!rankMeets(context.rank, w.op ?? "=", w.rank)) { holds = false; break; }
            continue;
          }
          if (typeof owner?.system?.proficiency !== "function") { holds = false; break; }
          const rank = owner.system.proficiency(w.constellation)?.rank ?? "untrained";
          if (!rankMeets(rank, w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;

        // FOR: who receives it. No FOR, or self: the owner alone.
        const who = rule.for?.who ?? "self";
        if (who === "self") {
          if (!ownRoll) continue;
        } else if (ownRoll) {
          if (who !== "self+allies") continue;
        } else {
          if (!scene || !entry.ownerToken || !scene.token) continue;
          const relation = scene.relation(entry.ownerToken, scene.token);
          if (!whoMatches(who, relation)) continue;
          const range = rule.for?.range;
          if ((range !== null) && (range !== undefined) && (scene.gap(entry.ownerToken, scene.token) > range)) continue;
          // SEEN (0.14.0): the recipient must see the owner; the owner always sees themself.
          if (rule.seen && !((typeof scene.sees === "function") && scene.sees(scene.token, entry.ownerToken))) continue;
        }

        // WHILE: the count around the owner.
        if (rule.while) {
          const ownerToken = entry.ownerToken ?? (ownRoll ? scene?.token : null);
          if (!scene || !ownerToken) continue;
          let count = 0;
          for (const other of scene.tokens ?? []) {
            if (!other?.token || (other.token.id === ownerToken.id)) continue;
            if (!whoMatches(rule.while.who, scene.relation(ownerToken, other.token))) continue;
            const range = rule.while.range;
            if ((range !== null) && (range !== undefined) && (scene.gap(ownerToken, other.token) > range)) continue;
            count += 1;
          }
          if (!compare(count, rule.while.op, rule.while.count)) continue;
        }

        // AGAINST: the Threat being answered.
        if (rule.against) {
          const threat = context?.threat;
          if (!threat?.threat) continue;
          if (rule.against.threat && (rule.against.threat !== threat.threat)) continue;
          if (rule.against.reach === "melee" && threat.melee !== true) continue;
          if (rule.against.reach === "ranged" && threat.melee !== false) continue;
        }

        // FIRST / ONCE: the recipient's mark for this encounter.
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

        const target = rule.to;
        const label = ownRoll ? plainName(carrier?.name ?? "") : `${plainName(carrier?.name ?? "")} (${owner?.name ?? ""})`;
        const source = `rule:${carrier?.id ?? carrier?.name ?? "rule"}:${target.slug}`;
        const modifier = { label, value: rule.value, type: rule.type, source, ...(mark ? { mark } : {}) };

        if (target.type === "scope") {
          if (SCOPES[target.slug]?.kinds.includes(rollKind)) out.push(modifier);
          continue;
        }
        const asConstellation = (target.type === "constellation") || (target.type == null);
        const asManeuver = (target.type === "action") || (target.type == null);
        if (asConstellation && rollSlug && (rollSlug === target.slug)) {
          out.push(modifier);
          continue;
        }
        if (!asManeuver) continue;
        if (rollManeuver !== null) {
          if (rollManeuver === target.slug) out.push(modifier);
          continue;
        }
        if ((rollKind !== "check") || (target.type == null)) continue;
        out.push({
          ...modifier,
          label: `${label}: ${target.name}`,
          offer: true,
          key: `bonus-${carrier?.id ?? carrier?.name ?? "rule"}-${rule.line ?? 0}`,
          hint: `${label}: this bonus applies to checks to ${target.name}. Tick it if this roll is one.`
        });
      }
      return out;
    }
  }
};
