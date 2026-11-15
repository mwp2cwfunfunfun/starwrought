/**
 * The `give` rule kind (0.22.0; rulings 223 to 230): what a degree of a Maneuver's check gives
 * another character. From Aid (PHB v4.24, Chapter 8): "Critical Success You grant your ally a +2
 * Situation bonus to the triggering check. If you're a master with the check you attempted, the
 * bonus is +3, and if you're legendary, it's +4. Success You grant your ally a +1 Situation bonus
 * to the triggering check. Critical Failure Your ally takes a -1 Situation penalty to the
 * triggering check." Through 0.21.0 that was prose on the card, applied by hand, so a Talent that
 * changes it (Patient Assistance, Sure Assistance) had nothing to change. The lines sit on the
 * MANEUVER'S OWN ROW:
 *
 *   [EFFECT GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>); IF: RANK(...); UNTIL: <window>]
 *
 *   [EFFECT GIVE: 2 situation, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]
 *   [EFFECT GIVE: 3 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = master)]
 *   [EFFECT GIVE: 4 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = legendary)]
 *   [EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]
 *   [EFFECT GIVE: -1 situation, chosen; IF: RESULT(critical failure)]        Aid
 *
 * A signed whole number and a bonus type, then one descriptor: `chosen` (the Constellation is
 * named when the result is given; Mike, 2026-11-14: "Named separately") or a Constellation by
 * name. Exactly one `IF: RESULT(...)` says which degree gives it; `IF: RANK(...)` reads the
 * owner's rank, and `RANK(roll ...)` the rank ROLLED (ruling 217), which is how "a master with the
 * check you attempted" is said. The first line that holds for a degree is that degree's result.
 * `UNTIL:` is the window (../operators.mjs, `readUntil`); with none it is `giver opportunity`,
 * until the giver's next Opportunity begins. Refused: FOR, SEEN, the counts, every IFT, CLAIM,
 * LIMIT, an `[AURA ...]` block, and a GIVE anywhere but a Maneuver's row.
 *
 * The stored rule:
 *
 *   { kind: "give", line, text, value: 1, type: "situation",
 *     to: { name: "chosen", slug: "", type: "chosen" } | { name: "Stealth", slug: "stealth", type: "constellation" | null },
 *     when: [{ outcome, name }, { roll: true, op, rank } | { constellation, name, op, rank }],
 *     until: { who: "giver" | "recipient" | "encounter", n } | null }
 *
 * and the one rule of a PENDING result on its recipient (../given.mjs, `pendingRule`), which no
 * cell ever writes: `{ kind: "give", pending: true, line: 1, text, value, type, to: { name, slug,
 * type: "constellation" } }`.
 *
 * TWO HOOKS, because a give has two moments.
 *
 * `hooks.gives(entries, context, actor)`, on the `gives` hook point (../engine.mjs, `ruleGives`),
 * defined with this kind and calculated in category (../README.md): "this check was made from a
 * Maneuver's Item; what would each degree give?" The entries carry `from`: `"item"` for the rules
 * on the Item behind the roll (owned or not, since a basic Maneuver is used straight from the
 * compendium) and `"own"` for the roller's own. This kind reads the first and answers one
 * `{ line }` per rule whose rank conditions hold at the rank rolled; the `alter` kind reads the
 * second. The hook gives nothing: the table goes on the card, and the press of the card's button
 * is the one moment anything is written (documents/cards/give.mjs).
 *
 * `hooks.modifiers(entries, context, actor)`, on the `modifiers` hook point: the recipient's
 * pending result as a modifier on its next roll with the Constellation named. It answers a check,
 * an attack, a Defense roll and an Initiative whose slug is the result's, and nothing for the
 * sheet's Defense pass (`staticOnly`), a Threshold read (`read`), a Strike's pairing
 * (`pairingOnly`) or the tracker's own Initiative die (`leavePending`): a result is used up by a
 * ROLL that can remove it, so it is never folded into the Threshold on the sheet, reading a
 * Threshold never spends it, and a total nothing is written after never carries it. The carrier is
 * a one-roll effect, so the dispatcher asks for its removal with the roll.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. It imports ../syntax.mjs,
 * ../operators.mjs and ../given.mjs (all pure) and the config, never the grammar or the registry.
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, summarizeOperators, titled, readTargetName, readBonusType, untilWords } from "../operators.mjs";
import { appliesNow, signedValue } from "../given.mjs";
import { slugify, isLoreSlug, ruleCarrierKey } from "../../config.mjs";

const SHAPE = "GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>)";
const EXAMPLE = "GIVE: 1 situation, chosen; IF: RESULT(success)";

/** The word for "named when the result is given". */
export const CHOSEN = "chosen";

/** The scope words of the `bonus` kind, none of which a GIVE may name: it is one Constellation's roll. */
const SCOPE_WORDS = Object.freeze(["checks", "defenses", "attacks", "initiative", "speed"]);

/** The conditions of a rule as a list, whatever shape `when` was stored in. */
function whensOf(rule) {
  return Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
}

/** The one descriptor: `chosen`, or a Constellation by name. */
function readTo(word, resolve) {
  const written = String(word ?? "").trim();
  if (written.toLowerCase() === CHOSEN) return { name: CHOSEN, slug: "", type: "chosen" };
  if (SCOPE_WORDS.includes(slugify(written))) {
    throw new RuleSyntaxError(`"${written}" is a scope word; GIVE names one Constellation, or chosen for one named when the result is given`);
  }
  const read = readTargetName(written, resolve);
  if (!read || !read.slug) throw new RuleSyntaxError(`"${written}" is not a Constellation: GIVE names one, or chosen for one named when the result is given`);
  if ((read.type !== null) && (read.type !== "constellation")) {
    throw new RuleSyntaxError(`"${read.name}" is a Maneuver: GIVE names the Constellation the recipient rolls, or chosen for one named when the result is given`);
  }
  if (read.found?.group) {
    throw new RuleSyntaxError(`"${read.name}" is a group and its Talents roll the parent;${read.found.parent ? ` write ${read.found.parent} instead` : " write its parent instead"}`);
  }
  if (isLoreSlug(read.slug)) throw new RuleSyntaxError("a Lore is the character's own; write chosen, and the Lore is named when the result is given");
  return { name: read.name, slug: read.slug, type: read.type };
}

/* -------------------------------------------- */

export default {
  id: "give",
  aliases: [],

  /**
   * @param {string} args      The text after the tag, trimmed (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect`, `resolve` and `itemType` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a give is an effect: \`[EFFECT ${EXAMPLE}]\``);
    const e = context.effect;
    // Inside `[AURA ...; GIVE: ...]` the grammar has made the ring the FOR, so the component
    // refusal below would name a FOR the author never wrote. Say what was written instead.
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`a give is what a Maneuver's check gives and cannot ride an [AURA ...] block; write it on the Maneuver's row as \`[EFFECT ${EXAMPLE}]\``);
    }
    // A give is the Maneuver's own result, so it is written where the Maneuver is: a Talent that
    // changes it says so with ALTER, and a custom effect row has no check to give from.
    if (context.itemType !== "action") {
      throw new RuleSyntaxError("GIVE is written on the Maneuver's own row: it says what a result of that Maneuver's check gives. A Talent changes it with ALTER, as in `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]`");
    }
    const ops = refuseComponents(e.ops, "GIVE", ["when", "until"]);
    const whens = whensOf(ops);
    if (whens.some(w => w?.trait)) throw new RuleSyntaxError("GIVE does not take IFT: TRAIT(...)");
    const outcomes = whens.filter(w => w?.outcome);
    if (!outcomes.length) {
      throw new RuleSyntaxError(`GIVE says which result of the check gives it: add \`IF: RESULT(<degree>)\`, as in \`${EXAMPLE}\``);
    }
    if (outcomes.length > 1) {
      throw new RuleSyntaxError(`GIVE takes one \`IF: RESULT(...)\` (${outcomes.length} given): write one line for each degree`);
    }

    const type = readBonusType(e.type ?? "untyped");
    if (!e.descriptors.length) {
      throw new RuleSyntaxError(`GIVE names what the bonus is to after a comma: chosen (named when the result is given) or a Constellation, as in \`${EXAMPLE}\``);
    }
    if (e.descriptors.length > 1) {
      throw new RuleSyntaxError(`GIVE takes one descriptor, chosen or a Constellation, not ${e.descriptors.length}: \`${SHAPE}\``);
    }
    const to = readTo(e.descriptors[0], context.resolve);
    return { value: e.value, type, to, when: ops.when, until: ops.until };
  },

  /**
   * `gives a +1 Situation bonus to the next roll with the Constellation chosen, on a Success,
   * until the giver's next Opportunity`; a pending result reads `+1 Situation bonus to the next
   * Crafting roll`.
   */
  summary(rule) {
    const value = Number(rule?.value) || 0;
    const word = value < 0 ? "penalty" : "bonus";
    const amount = `${signedValue(value)} ${titled(rule?.type)} ${word}`;
    if (rule?.pending) return `${amount} to the next ${rule?.to?.name ?? ""} roll`;
    const to = (rule?.to?.type === "chosen") ? "the Constellation chosen" : (rule?.to?.name ?? "");
    const tail = summarizeOperators(rule).replace(/the roll's rank/g, "the rank rolled");
    return `gives a ${amount} to the next roll with ${to}${tail ? `, ${tail}` : ""}, ${untilWords(rule?.until ?? null)}`;
  },

  hooks: {
    /**
     * What each degree of this Maneuver's check gives (the header, TWO HOOKS).
     * @param {Array<{rule: object, item: object, from: "item"|"own"}>} entries
     * @param {{rank?: string}} context  `rank` is the rank ROLLED (ruling 217).
     * @param {object} actor  The roller.
     * @returns {Array<{line: import("../given.mjs").GiveLine}>}
     */
    gives(entries, context = {}, actor = null) {
      const out = [];
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        if ((entry?.from !== "item") || !rule || rule.pending) continue;
        let degree = null;
        let holds = true;
        for (const w of whensOf(rule)) {
          if (w?.outcome) { degree = w.outcome; continue; }
          if (w?.roll === true) {
            if ((context?.rank === undefined) || (context?.rank === null) || !rankMeets(context.rank, w.op ?? "=", w.rank)) { holds = false; break; }
            continue;
          }
          // An entry this kind does not know (a trait, a condition of a later version) does not hold.
          if (!w?.constellation || w.trait || (typeof actor?.system?.proficiency !== "function")) { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds || !degree) continue;
        out.push({ line: { degree, value: rule.value, type: rule.type, to: rule.to, until: rule.until ?? null } });
      }
      return out;
    },

    /**
     * The recipient's pending result on a roll (the header, TWO HOOKS).
     * @param {Array<{rule: object, item: object}>} entries  This kind's rules on the roller; only a
     *        pending result's (`rule.pending`, on a carrier with `given`) is ever answered.
     * @param {object} context  The roll (../engine.mjs, RollContext).
     * @returns {Array<{label: string, value: number, type: string, source: string, given?: string, givenFrom?: string}>}
     */
    modifiers(entries, context = {}) {
      const out = [];
      // A result is used up by a roll: the sheet's Threshold, a Threshold read and a Strike's
      // pairing (whose blind die had everything else) never carry it. Nor does a total that is
      // itself the roll and writes nothing after (`leavePending`: the tracker's own Initiative
      // die), which would carry the result and leave it to be used again.
      if (context?.staticOnly || context?.read || context?.pairingOnly || context?.leavePending) return out;
      const slug = String(context?.slug ?? "");
      if (!slug) return out;
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const pending = entry?.item?.given;
        if (!rule?.pending || !pending || (rule.to?.slug !== slug)) continue;
        if (!appliesNow(pending, context?.encounter)) continue;
        // One pending result is one circumstance (PHB v4.21's stacking): its own source. `given`
        // (0.25.0) names the Maneuver whose result this is, which the roll's card keeps, so a card
        // knows its roll used the result up (./subordinate.mjs offers Pay It Forward on it).
        // `givenFrom` names WHICH result: the card of the check that gave it, which the used
        // Effect remembers too, so the offer is drawn on the card of that roll and no other (the
        // review of 2026-11-15: an older card that had used another Aid showed the button as well).
        out.push({
          label: String(entry.item.name ?? "Given result"), value: rule.value, type: rule.type,
          source: `rule:${ruleCarrierKey(entry.item)}:${slug}`,
          ...(pending.maneuver ? { given: String(pending.maneuver) } : {}),
          ...(pending.message ? { givenFrom: String(pending.message) } : {})
        });
      }
      return out;
    }
  }
};
