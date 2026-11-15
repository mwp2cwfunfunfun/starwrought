/**
 * The `permit` rule kind (0.24.0; rulings 239 to 244): using this Maneuver lets the creature you
 * target make one Move now, outside its Opportunity. From the Human's Move Together ❶ (Mike,
 * 2026-11-14): "You Move up to your Speed. The chosen ally may then spend ❶ of its own actions to
 * immediately Move up to its Speed as part of this same Maneuver. It must finish adjacent to you."
 * Through 0.23.1 nothing of it was automated, and the ally's drag on the user's Opportunity waited
 * for the GM as any off-turn Maneuver does (0.19.0). The tag is Mike's choice: "permit" is already
 * the system's word for what the GM's Approve gives a player off-turn, and this is the same thing
 * given by a Maneuver.
 *
 *   [EFFECT PERMIT: <what>; FOR: <who> [<N>]; LIMIT: round | encounter; IF: RANK(...)]
 *
 *   [EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]                         Move Together ❶
 *
 * One descriptor, what is permitted: `move`, the one word in this version. `FOR:` says who may be
 * permitted and how near, in the grammar's existing words (`allies 0` is an adjacent ally, as
 * Steady the Line writes it); it is required, and `self` is refused, since nobody needs leave at
 * their own Opportunity. `LIMIT:` is the Maneuver's Frequency. `IF: RANK(...)` reads the owner's
 * rank. Written on a Maneuver's own row and nowhere else, as `GIVE` is.
 *
 * The stored rule: `{ kind: "permit", line, text, what: "move", for: { who, range }, limit, when }`.
 *
 * THE HOOK, `hooks.use(entries, context, actor)` on the `use` hook point (../engine.mjs, `ruleUses`;
 * defined with the `mark` kind): "the owner used this Maneuver; what does the kind do?" The context
 * is `{ item, target: { actor, uuid, tokenUuid, tokenId, token, name, relation, inEncounter } | null,
 * encounter: { combat, round, combatant } | null, scene, alterations, nonce }`. The answer, one per
 * line, is a refusal (`{ item, refuse }`: nothing is paid) or an action:
 *
 *   { item, say, warn: [...],                                      // lines for the Maneuver's card
 *     write: { "flags.starwrought.maneuverMove": <the record> },   // on the owner (../maneuver-move.mjs)
 *     marks: [{ key, per }] }                                      // the LIMIT, filed as FIRST and ONCE are
 *
 * REFUSED (Mike: "With nobody targeted it always refuses"): no target, the owner itself, a target
 * who is not one the `FOR` names, and a second use within the `LIMIT`. WARNED, and the Maneuver
 * still happens (Mike: "Warn and go on"): a target farther than the `FOR` range, with no action
 * left, unconscious or dying, or not in the encounter. Outside an encounter nothing is written or
 * limited: the answer is the say line alone.
 *
 * The alteration `ALTER: <Maneuver>.movement; VALUE: step` (./alter.mjs; Coordinated Footwork) is
 * handed in by the engine as `context.alterations` and sets the record's `step`.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node). It
 * imports ../syntax.mjs, ../operators.mjs and ../maneuver-move.mjs (all pure) and the config.
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, refuseOutcome, summarizeOperators, whoMatches } from "../operators.mjs";
import { MOVE_RECORD_FLAG, moveRecord } from "../maneuver-move.mjs";
import { plainName, ruleCarrierKey } from "../../config.mjs";

const SHAPE = "PERMIT: <what>; FOR: <who> [<N>]";
const EXAMPLE = "PERMIT: move; FOR: allies 0; LIMIT: round";

/** What a PERMIT may permit. One word so far. */
export const PERMIT_WHAT = Object.freeze(["move"]);

/** Who a PERMIT may be for: anyone but the owner. */
export const PERMIT_WHO = Object.freeze(["allies", "enemies", "all"]);

/** The conditions of a rule as a list, whatever shape `when` was stored in. */
function whensOf(rule) {
  return Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
}

/** The key the rule's LIMIT mark is filed under, as the `bonus` and `substitute` kinds key theirs. */
function limitKey(carrier, rule) {
  return `${carrier?.id ?? carrier?.name ?? "rule"}:${rule?.line ?? 0}`;
}

/** Has the owner spent this rule's LIMIT in the encounter as it stands? */
function limitSpent(actor, key, rule, encounter) {
  const combat = encounter?.combat ?? null;
  if (!rule?.limit || !combat) return false;
  const held = actor?.flags?.starwrought?.rules?.[rule.limit.per]?.[key] ?? null;
  if (!held) return false;
  if (rule.limit.per === "round") return (held.combat === combat) && (held.round === (encounter.round ?? 0));
  return (held === combat) || (held.combat === combat);
}

/** "an adjacent ally", "an ally within 10 ft", "a creature". */
function whoWords(rule) {
  const who = rule?.for?.who;
  const noun = who === "allies" ? "ally" : who === "enemies" ? "enemy" : "creature";
  const range = rule?.for?.range;
  if ((range === null) || (range === undefined)) return `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;
  if (range === 0) return `an adjacent ${noun}`;
  return `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun} within ${range} ft`;
}

export default {
  id: "permit",
  aliases: [],

  /**
   * @param {string} args      The text after the tag, trimmed (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect` and `itemType` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a permission is an effect: \`[EFFECT ${EXAMPLE}]\``);
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`a permission is given when its Maneuver is used and cannot ride an [AURA ...] block; write it as its own \`[EFFECT ${EXAMPLE}]\``);
    }
    if (context.itemType && (context.itemType !== "action")) {
      throw new RuleSyntaxError("PERMIT is written on the Maneuver's own row: it is what using that Maneuver lets another creature do");
    }
    const e = context.effect;
    const ops = refuseComponents(e.ops, "PERMIT", ["when", "for", "limit"]);
    refuseOutcome(ops);
    for (const w of whensOf(ops)) {
      if (w?.trait) throw new RuleSyntaxError("PERMIT does not take IFT: TRAIT(...)");
      if (w?.roll) throw new RuleSyntaxError("PERMIT acts when the Maneuver is used, before any roll: `IF: RANK(roll ...)` has no roll to read; name a Constellation, as in `IF: RANK(Origin >= expert)`");
    }
    if (e.descriptors.length !== 1) {
      throw new RuleSyntaxError(`a permission is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${e.descriptors.length} descriptors given, 1 wanted: what is permitted)`);
    }
    const what = e.descriptors[0].toLowerCase().replace(/\s+/g, "");
    if (!PERMIT_WHAT.includes(what)) {
      throw new RuleSyntaxError(`"${e.descriptors[0]}": PERMIT permits a ${PERMIT_WHAT.join(" or ")} in this version, as in \`${EXAMPLE}\``);
    }
    if (!ops.for) {
      throw new RuleSyntaxError(`PERMIT says who may be permitted: add \`FOR: allies 0\` (an adjacent ally), as in \`${EXAMPLE}\``);
    }
    if (!PERMIT_WHO.includes(ops.for.who)) {
      throw new RuleSyntaxError(`PERMIT is for another creature (FOR: ${PERMIT_WHO.join(", ")}), not "${ops.for.who}": nobody needs leave at their own Opportunity`);
    }
    return { what, for: ops.for, limit: ops.limit, when: ops.when };
  },

  /** `lets an adjacent ally you target make one Move now, outside its Opportunity, once a round`. */
  summary(rule) {
    const whens = summarizeOperators({ when: rule?.when });
    const limit = rule?.limit ? (rule.limit.per === "round" ? ", once a round" : ", once an encounter") : "";
    return `lets ${whoWords(rule)} you target make one Move now, outside its Opportunity${limit}${whens ? `, ${whens}` : ""}`;
  },

  hooks: {
    /**
     * The owner used the Maneuver (the header, THE HOOK).
     * @param {Array<{rule: object, item: object}>} entries  This kind's rules on the used Item.
     * @param {object} context
     * @param {object} actor  The owner, who used it.
     * @returns {Array<{item: object, refuse?: string, say?: string, warn?: string[], write?: object, marks?: object[]}>}
     */
    use(entries, context = {}, actor = null) {
      const out = [];
      const target = context?.target ?? null;
      const encounter = context?.encounter ?? null;
      // In the fight: a started Combat is viewed AND the owner is a fighter in it. A Combat on
      // screen that the owner is no part of pays nothing (documents/item.mjs asks the same), so it
      // must write and limit nothing either; a plain test object has no such getter and reads as in.
      const inFight = !!encounter?.combat && (actor?.inEncounter !== false);
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || !carrier || (carrier !== context?.item)) continue;
        // IF: the owner's rank.
        let holds = true;
        for (const w of whensOf(rule)) {
          if (w.roll || w.trait || w.outcome || (typeof actor?.system?.proficiency !== "function")) { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;

        const name = plainName(carrier.name ?? "");
        const owner = actor?.name ?? "The owner";
        if (!target || (!target.uuid && !target.tokenUuid)) {
          out.push({ item: carrier, refuse: `${name}: target exactly one creature first, the one who moves with you.` });
          continue;
        }
        const who = target.name ?? "the target";
        if ((target.relation === "self") || (target.uuid && (target.uuid === actor?.uuid))) {
          out.push({ item: carrier, refuse: `${name}: target the creature who moves with you, not ${owner}.` });
          continue;
        }
        if (target.relation && !whoMatches(rule.for?.who, target.relation)) {
          out.push({ item: carrier, refuse: `${name} is for ${whoWords(rule)}; ${who} is not one.` });
          continue;
        }
        const key = limitKey(carrier, rule);
        if (inFight && limitSpent(actor, key, rule, encounter)) {
          out.push({ item: carrier, refuse: `${name}: already used this ${rule.limit.per}.` });
          continue;
        }

        // The requirements a machine can read are said, never enforced (Mike: "Warn and go on").
        const warn = [];
        const range = rule.for?.range;
        const scene = context?.scene ?? null;
        if ((range !== null) && (range !== undefined) && scene?.token && target.token && (typeof scene.gap === "function")) {
          const gap = Number(scene.gap(scene.token, target.token));
          if (Number.isFinite(gap) && (gap > range)) {
            warn.push(`${who} is ${Math.round(gap)} ft from ${owner}: ${name} asks for ${whoWords(rule)}.`);
          }
        }
        const statuses = target.actor?.statuses;
        if ((typeof statuses?.has === "function") && ["unconscious", "dying", "dead"].some(s => statuses.has(s))) {
          warn.push(`${who} is not conscious.`);
        }
        if (inFight && (target.inEncounter === false)) {
          warn.push(`${who} is not in the encounter, so its Move is not counted.`);
        } else if (inFight && (Number(target.actor?.system?.actions?.value) <= 0)) {
          warn.push(`${who} has no action left to Move with.`);
        }

        if (!inFight) {
          out.push({ item: carrier, warn, say: `${who} may Move with ${owner}. Outside an encounter nothing is counted.` });
          continue;
        }
        if (!encounter.combatant) {
          out.push({ item: carrier, warn, say: `${who} may Move with ${owner}. Nobody's Opportunity is running, so the Moves are not counted.` });
          continue;
        }
        // The owner's alterations of this Maneuver's movement (the engine hands them in). A line on
        // Skip is left out this once, and a custom effect that lasts one roll is used up: each
        // carries the mark that says so, filed with this use's own.
        const moves = (context?.alterations ?? []).filter(a => a?.property === "movement");
        const step = moves.some(a => (a.skipped !== true) && (a.movement === "step"));
        const spent = moves.flatMap(a => Array.isArray(a.marks) ? a.marks : []);
        const record = moveRecord({
          nonce: context?.nonce ?? `${encounter.combat}:${encounter.round ?? 0}:${ruleCarrierKey(carrier)}`,
          combat: encounter.combat, round: encounter.round ?? 0, during: encounter.combatant,
          from: name, userTokenId: scene?.token?.id ?? null,
          allyTokenId: target.tokenId ?? target.token?.id ?? null, allyName: who,
          range: ((range === null) || (range === undefined)) ? null : range, step
        });
        const action = {
          item: carrier,
          warn,
          write: { [`flags.starwrought.${MOVE_RECORD_FLAG}`]: record },
          say: `${owner}'s own Move is paid for: the next drag of ${owner}'s token is it. ${who} may then make one Move now, outside its Opportunity, paying for it itself.${step ? " A drag within half Speed is a Step for either of them." : " Each is a Move, however short."}`
        };
        const marks = [...(rule.limit ? [{ key, per: rule.limit.per }] : []), ...spent];
        if (marks.length) action.marks = marks;
        out.push(action);
      }
      return out;
    }
  }
};
