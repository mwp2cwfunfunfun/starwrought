/**
 * The `bonus` rule kind (0.10.0; rulings 121 to 124; rewritten to the operator grammar in 0.13.0):
 * a typed bonus or penalty to a roll, and to the Threshold that roll's Constellation presents.
 *
 * The first kind, and Mike's own (2026-10-03): "first automation kind we will create is the Human
 * Ancestry one. The Effect is: 'You gain a +1 Condition bonus on checks to Aid. If you are Expert
 * in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you are Legendary, +4.'"
 * Since 0.16.0 in Fantasy Grounds' shape, and since 0.17.0 in FG's block (AUTOMATION_GRAMMAR.md):
 *
 *   [EFFECT <TAG>: <±N> <type>, <descriptor>; <component>; ...]
 *
 *   [EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]                              Humanity
 *   [EFFECT SKILL: 1 situation; IF: RANK(roll = untrained)]                                    Jack of Trades
 *   [EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]        Close Ranks
 *   [EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]        Torchbearer Human
 *
 * The tag names the target's kind (CHECK a Constellation or a Maneuver, or with none EVERY ROLL AND
 * THRESHOLD since 0.36.0; SKILL the checks that are no attack and no Defense; DEF one Defense or
 * all four; ATK, INIT, SPEED), the value is a signed integer (`0` refused), the type is
 * situation, condition or gear (the retired words refused by name, `untyped` refused), and the
 * components are the effect reader's (../effects.mjs). The 0.13.0 operator form and the 0.10.0
 * prose form are refused by the grammar.
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
 * and the sheet's Defense pass asks for the rest (`staticOnly`); see ../engine.mjs. One static rule
 * is answered under `momentOnly` as well (0.21.0, ruling 222): a bonus to a Maneuver, on a check
 * rolled with a Defense Constellation from that Maneuver's Item (Aid made with Awareness), which
 * the Defense pass could never have folded in. Then the
 * target: a Constellation applies on its slug; a scope word on the roll's kind; a Maneuver when the
 * roll carries that Maneuver's Item, and is OFFERED unticked on a check made without one (ruling
 * 122), never on an attack, a Defense or an Initiative. The label is the carrier's plain name (with
 * the owner's name when it is someone else's Talent), and ALL OF ONE CARRIER'S LINES SHARE A
 * `source` (0.36.0; ruling 367), so one Talent or one Condition is one circumstance under PHB
 * v4.21's stacking: of its lines that reach a roll, the strongest bonus and the strongest penalty
 * count. Through 0.35.1 the source was the carrier AND the target, so two lines to different
 * targets that reached one roll both counted.
 *
 * EVERY ROLL, AND THE NARROW WORD (0.36.0; rulings 366 to 371). Mike: "Can't CHECK include ALL
 * rolls/thresholds, but ATK and DEF just mean attack checks and defense checks respectively?" A
 * bare `CHECK:` is read as the scope `rolls` (checks, Initiative, attacks, Defenses), and the new
 * bare tag `SKILL:` as the scope `checks`, which is what a bare CHECK was read as through 0.35.1
 * and reaches what it always reached. So A STORED RULE KEEPS THE MEANING IT WAS READ WITH: nothing
 * changes for a rule until its cell is read again.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. It imports ../syntax.mjs and
 * ../operators.mjs (both pure) and the config, never the grammar or the registry (no circle).
 */

import { RuleSyntaxError, CONDITION_ROW } from "../syntax.mjs";
import { rankMeets, whoMatches, compare, hasTrait, needsMoment, againstHolds, markedHolds, effectHolds, readsOtherEffects, refuseOutcome, summarizeOperators, titled, readTargetName, readBonusType } from "../operators.mjs";
import { effectsOn } from "../effect-list.mjs";
import { slugify, plainName, isLoreSlug, DEFENSES, flagKey, ruleCarrierKey } from "../../config.mjs";

const EXAMPLE = "CHECK: 1 condition, aid; IF: RANK(Origin >= trained)";


/**
 * The target words that are not a Constellation or a Maneuver: a scope of rolls. Keyed by the
 * slug the word makes; the value is the roll kinds it applies to. `Speed` (0.15.0) is feet on a
 * Move, asked by the movement tracker and the ruler with `kind: "move"`.
 */
export const SCOPES = Object.freeze({
  // Every roll and Threshold (0.36.0): what a bare CHECK is read as.
  rolls: { name: "every roll and Threshold", kinds: ["check", "initiative", "attack", "defense"] },
  defenses: { name: "Defenses", kinds: ["defense"] },
  // What SKILL is read as (0.36.0), and what a bare CHECK was read as through 0.35.1: every check
  // that is no attack and no Defense, an Initiative rolled with a Constellation among them.
  checks: { name: "Skill checks", kinds: ["check", "initiative"] },
  attacks: { name: "Attacks", kinds: ["attack"] },
  initiative: { name: "Initiative", kinds: ["initiative"] },
  speed: { name: "Speed", kinds: ["move"] }
});

/** Does a scope reach a kind of roll (`check`, `initiative`, `attack`, `defense`, `move`)? */
export function scopeReaches(slug, kind) {
  return !!SCOPES[slug]?.kinds.includes(kind);
}

/** The words an author might write after CHECK for the narrow scope: each is told the tag. */
const SKILL_WORDS = Object.freeze(["skill", "skills", "skill-check", "skill-checks"]);

/** The flag path of an armed claim on an owner (0.15.0; module/rules/claims.mjs writes it). */
export const ARMED_FLAG = "rules.armed";

/** A signed integer as the book prints it. */
function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

/* -------------------------------------------- */

/** The type word, checked; the retired words name the current one (shared with `give` since 0.22.0). */
const readType = readBonusType;

/**
 * The target: a scope word, else the caller's resolver, else the slug made here. A Maneuver's
 * glyphs never reach the slug, so `Aid ❶ (⓿↺)` and `Aid` are one target. A Lore is refused.
 */
function readTarget(name, resolve) {
  const written = String(name ?? "").trim();
  const scopeSlug = slugify(written);
  if (Object.hasOwn(SCOPES, scopeSlug)) return { name: SCOPES[scopeSlug].name, slug: scopeSlug, type: "scope" };
  const read = readTargetName(written, resolve);
  if (!read) throw new RuleSyntaxError(`"${written}" names no Constellation or Maneuver`);
  const target = { name: read.name, slug: read.slug, type: read.type };
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
    // The 0.16.0 shape (AUTOMATION_GRAMMAR.md section 3): a tag names the target's kind, the
    // reader (../effects.mjs) has split the value, the type and the descriptors; one descriptor
    // narrows CHECK to a Constellation or a Maneuver and DEF to one Defense.
    if (context?.form === "effect") {
      const e = context.effect;
      const TAG = e.tag.toUpperCase();
      const type = readType(e.type ?? "untyped");
      // The value AS WRITTEN, for a message that says what to write: `-N` on a Condition's row is
      // stored as its sign, and a message that printed `-1` would turn Frightened 2's -2 into -1
      // for an author who followed it (the review of 0.36.0).
      const written = e.scale ? `${e.value < 0 ? "-" : ""}${e.scale}` : String(e.value);
      let to;
      if (e.tag === "check") {
        if (e.descriptors.length > 1) throw new RuleSyntaxError(`CHECK takes one descriptor, a Constellation or a Maneuver, not ${e.descriptors.length}: \`CHECK: ${written} ${type}, diplomacy\``);
        if (e.descriptors.length) {
          if (SKILL_WORDS.includes(slugify(e.descriptors[0]))) {
            throw new RuleSyntaxError(`for checks that are no attack and no Defense write the tag: \`SKILL: ${written} ${type}\``);
          }
          to = readTarget(e.descriptors[0], context.resolve);
          if (to.type === "scope") throw new RuleSyntaxError(`"${e.descriptors[0]}" is a scope word; CHECK takes a Constellation or a Maneuver, or no descriptor for every roll and Threshold (SKILL, ATK, DEF and INIT are the narrower tags)`);
        } else {
          // Every roll and Threshold (0.36.0; ruling 366). Through 0.35.1 this was `checks`.
          to = { name: SCOPES.rolls.name, slug: "rolls", type: "scope" };
        }
      } else if (e.tag === "skill") {
        // The narrow word (0.36.0; ruling 368): what a bare CHECK was read as through 0.35.1.
        if (e.descriptors.length) {
          throw new RuleSyntaxError(`SKILL takes no descriptor: to name a Constellation or a Maneuver write \`CHECK: ${written} ${type}, ${e.descriptors[0]}\``);
        }
        to = { name: SCOPES.checks.name, slug: "checks", type: "scope" };
      } else if (e.tag === "def") {
        if (e.descriptors.length > 1) throw new RuleSyntaxError(`DEF takes one descriptor, a Defense, not ${e.descriptors.length}: \`DEF: ${written} ${type}, guard\``);
        if (e.descriptors.length) {
          const slug = slugify(e.descriptors[0]);
          if (!Object.values(DEFENSES).some(d => d.slug === slug)) throw new RuleSyntaxError(`"${e.descriptors[0]}" is not a Defense: DEF takes evade, guard, endure or awareness, or none for all four`);
          const found = (typeof context.resolve === "function") ? context.resolve(e.descriptors[0]) : null;
          to = { name: String(found?.name ?? titled(slug)), slug, type: "constellation" };
        } else {
          to = { name: SCOPES.defenses.name, slug: "defenses", type: "scope" };
        }
      } else {
        if (e.descriptors.length) throw new RuleSyntaxError(`${TAG} takes no descriptor: \`${TAG}: ${written} ${type}\``);
        const slug = { atk: "attacks", init: "initiative", speed: "speed" }[e.tag];
        to = { name: SCOPES[slug].name, slug, type: "scope" };
      }
      refuseOutcome(e.ops);
      // A line that reaches Defenses and asks about THE ROLL'S OWN RANK (0.36.0): the sheet's
      // Defense pass reads a Defense's number with no roll in hand, so such a line is never folded
      // into it and never reaches a Defense roll, a Defense rolled as a check or the default
      // Initiative. It reads, and the author is told what it reaches.
      const rollRank = (Array.isArray(e.ops.when) ? e.ops.when : (e.ops.when ? [e.ops.when] : [])).some(w => w?.roll);
      if (rollRank && ((e.tag === "def") || ((to.type === "scope") && scopeReaches(to.slug, "defense")))) {
        context.warn?.((e.tag === "check")
          ? "CHECK with IF: RANK(roll ...) is not read on a Defense yet: the line reaches checks, attacks and an Initiative rolled with a Skill, and no Defense's number (so not a Defense roll, a Defense rolled as a check or the default Initiative). For checks alone write SKILL"
          : `${TAG} with IF: RANK(roll ...) is not read on a Defense yet: a Defense's number is read with no roll's rank in hand, so the line never applies`);
      }
      // 0.25.0: this kind reads its ops without a refusal list, so the one condition it has no
      // reading for is refused here by name rather than dropped in silence.
      if (e.ops.used) {
        throw new RuleSyntaxError(`${TAG} does not take IF: EFFECT(${e.ops.used.name}, used): a used Effect is what a SUBORDINATE line waits for. For an Effect you have now, write \`IF: EFFECT(${e.ops.used.name})\``);
      }
      // 0.31.0 (ruling 307): `IF: EFFECT(<name>)` and `IFT: EFFECT(<name>)`. With a FOR that
      // reaches others (an `[AURA ...]` block's ring is one) "you" would be two creatures, the
      // owner and whoever stands in the ring, so the pair is refused until a Talent wants it.
      if (e.ops.has && e.ops.for && (e.ops.for.who !== "self")) {
        throw new RuleSyntaxError(`${TAG} does not read EFFECT(...) beside a FOR that reaches others (an aura's ring is one): it is not read yet whether the Effect would be the owner's or the recipient's`);
      }
      // 0.32.0: the version of a Maneuver that was used (its listed cost) is read by APPLY and
      // REMOVE alone. Refused here by name, since this kind reads its ops with no refusal list.
      if ((e.ops.cost !== null) && (e.ops.cost !== undefined)) {
        throw new RuleSyntaxError(`${TAG} does not take IF: COST(<n>): the version of a Maneuver that was used is read by APPLY and REMOVE`);
      }
      // Two places an `IFT: EFFECT(...)` could never hold are refused rather than stored (the
      // review of 0.31.0): an Initiative and a Move have no other party; and a claim is asked at
      // the die, which through the attack flow knows nobody, while the pairing that does know
      // drops an offer.
      const other = (e.ops.has ?? []).find(h => h.on === "other");
      if (other && ["init", "speed"].includes(e.tag)) {
        throw new RuleSyntaxError(`${TAG} has no other party, so IFT: EFFECT(${other.name}) could never hold; for an Effect of your own write \`IF: EFFECT(${other.name})\``);
      }
      if (other && e.ops.claim) {
        throw new RuleSyntaxError(`${TAG} does not read IFT: EFFECT(${other.name}) beside IF: CLAIM(...): a claim is asked at the die, before the other party is known`);
      }
      // A CONDITION'S ROW (0.33.0; rulings 322 to 326): the line acts for whoever HAS the Condition,
      // a character or an adversary, so it may ask about the attack answered (a Threat, a trait)
      // and nothing about an owner: no rank, no choice, no reach to others, no once-a-round. Each
      // is refused by name, since this kind reads its ops with no refusal list.
      if (context?.itemType === CONDITION_ROW) {
        const whens = Array.isArray(e.ops.when) ? e.ops.when : (e.ops.when ? [e.ops.when] : []);
        const refused = whens.some(w => !w?.trait) ? "IF: RANK(...)"
          : e.ops.for ? "FOR:"
            : e.ops.while ? "IF: ALLIES(...), ENEMIES(...) or ALL(...)"
              : e.ops.seen ? "IF: SEEN"
                : e.ops.limit ? "LIMIT:"
                  : e.ops.claim ? "IF: CLAIM(...)"
                    : e.ops.marked ? "IFT: MARKED"
                      : e.ops.has ? "EFFECT(...)"
                        : null;
        if (refused) {
          throw new RuleSyntaxError(`${TAG} on a Condition's row does not take ${refused} yet: the line acts for whoever has the Condition, and may ask only about the attack it answers (IFT: RANGED, MELEE, BLOW, BLAST, BLIGHT, BEGUILEMENT, TRAIT(...))`);
        }
        if (e.scale && (context.takes !== undefined) && (String(context.takes ?? "").trim().toLowerCase() !== "n")) {
          throw new RuleSyntaxError(`\`${e.value < 0 ? "-" : ""}N\` is the Condition's own value, and this Condition takes none: put N in the row's Takes cell, or write a whole number`);
        }
      }
      // THE RETURN IS A FIXED LIST OF FIELDS: a component this kind reads must be copied here, or
      // it is dropped in silence and the bonus applies always. `has` rides only when the line asks
      // for one, so a rule that asks for none is stored exactly as it was before 0.31.0.
      return {
        value: e.value, type, to, when: e.ops.when, for: e.ops.for, while: e.ops.while, against: e.ops.against, seen: e.ops.seen, limit: e.ops.limit,
        claim: e.ops.claim, marked: e.ops.marked, ...(e.ops.has ? { has: e.ops.has } : {}),
        // `scale: "N"` (0.33.0): `value` is the sign, and the hook multiplies it by the value of
        // the Condition whose row this is. Copied only when set, as `has` is.
        ...(e.scale ? { scale: e.scale } : {})
      };
    }
    // A bonus is an effect: a feature block names no bonus, and the 0.13.0 form is refused by the
    // grammar before a kind sees it (0.17.0).
    throw new RuleSyntaxError(`a bonus is an effect: \`[EFFECT ${EXAMPLE}]\``);
  },

  /** `+1 Condition bonus to Aid while Origin is Trained`; `penalty` when negative. */
  summary(rule) {
    const value = Number(rule?.value) || 0;
    const word = value < 0 ? "penalty" : "bonus";
    const tail = summarizeOperators(rule);
    // A scaled line says its letter: "-N Condition penalty to Defenses" (0.33.0).
    const shown = (rule?.scale === "N") ? `${value < 0 ? "-" : "+"}N` : signed(value);
    // A scope is named as it is known NOW, whatever name the rule was stored with: a line read
    // before 0.36.0 says "to Skill checks", which is what it does (it was stored "Checks").
    const target = ((rule?.to?.type === "scope") ? SCOPES[rule.to.slug]?.name : null) ?? rule?.to?.name ?? "";
    return `${shown} ${titled(rule?.type)} ${word} to ${target}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * The modifiers this kind's rules put on a roll (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object, ownerToken?: object}>} entries
     * @param {object} context  { kind, slug, item, rank, threat, other, scene, encounter, staticOnly, momentOnly, pairingOnly, read }
     *                          `other` (0.15.0) is the roll's other party, `{ actor, uuid, tokenUuid, name }`
     *                          or null; `pairingOnly` asks for the rules about the other party alone (a
     *                          Strike's pairing as it resolves, the blind die having had the rest);
     *                          `read` says this is a Threshold read with no dialog, where a claim is
     *                          applied only when armed.
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
      // The Effects lists of the roller and of the other party (0.31.0), read when a rule asks.
      let lists = null;

      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || (typeof rule.value !== "number") || !rule.to?.slug) continue;
        const owner = entry.owner ?? actor;
        const ownRoll = owner === actor;
        // A CONDITION'S OWN LINE (0.33.0): the carrier is the Condition the creature has
        // (../engine.mjs, `conditionCarriers`), with its value and, for one held "against X" alone
        // (Wrong-Footed's Off-Guard), the creatures it is held against. Such a line can be read
        // only where the roll's other party is known, as an `IFT: EFFECT(...)` line is.
        const held = (carrier?.type === CONDITION_ROW) ? (carrier.condition ?? null) : null;
        const against = Array.isArray(held?.against) ? held.against : null;
        const moment = needsMoment(rule) || !!against;
        if (context?.staticOnly && moment) continue;
        if (context?.momentOnly && !moment) {
          // A static rule is the sheet's Defense pass's, which folded it into the Threshold and the
          // Defense's own modifiers, so a `momentOnly` ask leaves it out. One static rule that pass
          // could never have folded in (0.21.0, ruling 222): a bonus to a MANEUVER, on a check
          // rolled with a Defense Constellation from that Maneuver's Item (Aid made with Awareness
          // and Humanity's +1). It is matched by the Item alone; a target that is also this roll's
          // own Constellation was the pass's, and nothing is offered on this branch.
          const to = rule.to;
          const byManeuver = (rollKind === "check") && (rollManeuver !== null)
            && ((to.type === "action") || (to.type == null)) && (rollManeuver === to.slug)
            && !((to.type == null) && rollSlug && (rollSlug === to.slug));
          // And a second (0.31.0, the review; a defect since 0.13.0): a bonus to INITIATIVE, on an
          // Initiative rolled with a Defense Constellation, which the default Initiative is
          // (Awareness). The Defense pass folds in what is a bonus to that Defense; an `INIT` line
          // is to no Defense, so it was in neither half and never applied.
          const toInitiative = (rollKind === "initiative") && (to.type === "scope") && (to.slug === "initiative");
          if (!byManeuver && !toInitiative) continue;
        }
        // A pairing asks for the rules about the other party alone (0.15.0, ruling 175): the one
        // blind die already carried everything else, and a claim was the dialog's. Since 0.31.0 a
        // rule that reads the other party's Effects (`IFT: EFFECT(...)`) is one of them.
        if (context?.pairingOnly && !(rule.marked || readsOtherEffects(rule) || against)) continue;
        // AGAINST X (0.33.0): the roll's other party must be one of the creatures this Condition is
        // held against. With nobody known (the blind attack die, the sheet) it does not hold.
        if (against) {
          const otherUuid = context?.other?.uuid ?? context?.other?.actor?.uuid ?? null;
          if (!otherUuid || !against.includes(String(otherUuid))) continue;
        }
        // MARKED (0.15.0): the other party must be the creature this Talent marked.
        if (!markedHolds(rule, { item: carrier, owner }, context)) continue;
        // EFFECT (0.31.0; ruling 307): the roller has it (`IF:`), the other party has it (`IFT:`).
        // The lists are read once for the call, and only when a rule asks. With no other party
        // known (the blind attack die) an `IFT:` rule does not hold, and the pairing reads it.
        if (rule.has !== undefined && rule.has !== null) {
          lists ??= {
            self: effectsOn(actor), other: effectsOn(context?.other?.actor ?? null), by: actor?.uuid ?? null,
            otherBy: context?.other?.uuid ?? context?.other?.actor?.uuid ?? null
          };
          if (!effectHolds(rule, lists)) continue;
        }

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

        // AGAINST: the Threat being answered, or (0.15.0) the Constellation of the check read
        // against this Defense.
        if (!againstHolds(rule, context?.threat)) continue;

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
        const carrierKey = ruleCarrierKey(carrier);
        // ONE CARRIER IS ONE CIRCUMSTANCE (0.36.0; ruling 367): the source names the Talent or the
        // Condition alone, so of its lines that reach this roll `resolveModifiers` keeps the
        // strongest bonus and the strongest penalty. Through 0.35.1 it named the target too.
        const source = `rule:${carrierKey}`;
        // `-N` (0.33.0): the Condition's own value, so Frightened 2 is -2. Read off the carrier, so
        // a line written with `N` anywhere else (the parse refuses one) counts once.
        const scaled = (rule.scale === "N") ? rule.value * Math.max(1, Number(held?.value) || 1) : rule.value;
        const modifier = { label, value: scaled, type: rule.type, source, ...(mark ? { mark } : {}) };

        // The target: a scope word on the roll's kind; a Constellation on its slug; a Maneuver when
        // the roll carries that Maneuver's Item, else OFFERED on a check (ruling 122).
        let matched = false;
        let maneuverOffer = false;
        if (target.type === "scope") {
          matched = scopeReaches(target.slug, rollKind);
        } else {
          const asConstellation = (target.type === "constellation") || (target.type == null);
          const asManeuver = (target.type === "action") || (target.type == null);
          if (asConstellation && rollSlug && (rollSlug === target.slug)) matched = true;
          else if (asManeuver) {
            if (rollManeuver !== null) matched = rollManeuver === target.slug;
            else if ((rollKind === "check") && (target.type != null)) maneuverOffer = true;
          }
        }
        if (!matched && !maneuverOffer) continue;

        if (maneuverOffer) {
          out.push({
            ...modifier,
            label: `${label}: ${target.name}`,
            offer: true,
            key: `bonus-${carrierKey}-${rule.line ?? 0}`,
            hint: `${label}: this bonus applies to checks to ${target.name}. Tick it if this roll is one.`
          });
          continue;
        }

        // CLAIM (0.15.0, ruling 174): the player's decision. Offered in the dialog, ticked when the
        // Talent is armed; on a Threshold read (no dialog) applied only when armed; either way an
        // armed claim carries the mark that spends it once the roll or the read resolves.
        if (rule.claim) {
          const armed = !!owner?.flags?.starwrought?.rules?.armed?.[flagKey(carrierKey)];
          const spend = { key: carrierKey, per: "claim" };
          if (context?.read) {
            if (armed) out.push({ ...modifier, mark: spend });
            continue;
          }
          const value = rule.value > 0 ? `+${rule.value}` : String(rule.value);
          out.push({
            ...modifier,
            offer: true,
            ticked: armed,
            key: `claim-${carrierKey}-${rule.line ?? 0}`,
            hint: `${label}: ${value} ${titled(rule.type)} ${rule.value < 0 ? "penalty" : "bonus"} ${rule.claim.text}. Tick it if this roll is one.`,
            ...(armed ? { mark: spend } : {})
          });
          continue;
        }

        out.push(modifier);
      }
      return out;
    }
  }
};
