/**
 * The `apply` rule kind (0.32.0; rulings 311 to 321), the twenty-fourth: a Maneuver puts a
 * Condition or a named Effect on a creature, or takes one off. Named Effects, step two, the
 * writing half (Mike, 2026-11-15: "using a Maneuver can grant a custom Effect on a target (with a
 * specific duration)"; 2026-11-17, by question: the tags are APPLY and REMOVE). Two tags, one
 * kind, as CHECK, ATK and DEF share `bonus`.
 *
 *   [EFFECT APPLY: <Effect>[, self | target]; UNTIL: <window>; IF: RESULT(<degree>); IF: COST(<n>)]
 *   [EFFECT REMOVE: <Effect>[, self | target]; IF: RESULT(<degree>); IF: COST(<n>)]
 *
 *   [EFFECT APPLY: prone, target; IF: RESULT(success)]                                Trip
 *   [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]  an overcommit
 *   [EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]    Demoralize
 *   [EFFECT APPLY: Taking Cover]                                                      Take Cover
 *   [EFFECT REMOVE: prone]                                                            Stand
 *
 * WHERE. On a Maneuver's own row and nowhere else, as GIVE is: it is what using that Maneuver
 * does. THE EFFECT is a Condition by its name (with a number for one that carries a value,
 * `frightened 2`) or any other name, a named Effect (../effect-list.mjs). The Conditions the
 * system itself runs are refused (../applied.mjs, `SYSTEM_CONDITIONS`). WHO is `self` (the
 * default: the creature using the Maneuver) or `target` (the one creature it is used on).
 *
 * WHEN. With `IF: RESULT(<degree>)`, on that degree of the Maneuver's check, one line for each
 * degree; with none, whenever the Maneuver is used. `IF: COST(<n>)` narrows a line to the use
 * paid for with that many actions (Trip, Grapple and Demoralize print a table for each cost). `IF:
 * RANK(...)` is the owner's rank, `RANK(roll ...)` the rank rolled. A line about a TARGET needs a
 * degree: it lands by a button on the check's card (Mike's choice), and a Maneuver with no check
 * has no such card.
 *
 * HOW LONG. `UNTIL:` on an APPLY line, with the two edges written out (../operators.mjs,
 * `readUntil` with `edges`); none is "until something takes it off". Not beside a Condition with
 * a value, whose own rule moves it.
 *
 * The stored rule: `{ kind: "apply", op: "apply" | "remove", effect: { name, slug, condition,
 * value? }, who, when, until, cost }`.
 *
 * THE HOOK, `hooks.applies(entries, context, actor)` on the `applies` hook point (../engine.mjs,
 * `ruleApplies`), the seventh, calculated, defined with this kind: "this Maneuver was used; what
 * does each line of its row say?" The entries are this kind's rules ON THE ITEM behind the use
 * (a Basic Maneuver is used straight from the compendium and is in nobody's index); the answer is
 * a list of `{ line }` (../applied.mjs), every line whose rank conditions hold, each with its
 * degree and cost for the caller to choose from. It writes nothing. NO `use` AND NO `card` HOOK:
 * a `use` hook would send every row that carries an APPLY down the use-rule path, which never
 * rolls its check, and a `card` hook would make `paidElsewhere` call the row paid from its card.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents } from "../operators.mjs";
import { CONDITIONS, conditionIdOf } from "../../config.mjs";
import { readEffectName, conditionTitle } from "../effect-list.mjs";
import { APPLY_WHO, SYSTEM_CONDITIONS, ruleWords } from "../applied.mjs";

const EXAMPLE = "APPLY: prone, target; IF: RESULT(success)";

const whensOf = rule => (Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []));

export default {
  id: "apply",
  aliases: [],

  /**
   * @param {string} args      The text after the tag (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect`, `itemType` and `text` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`an APPLY is an effect: \`[EFFECT ${EXAMPLE}]\``);
    const e = context.effect;
    const TAG = String(e.tag ?? "apply").toUpperCase();
    const op = (e.tag === "remove") ? "remove" : "apply";
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`${TAG} is what using a Maneuver does and cannot ride an [AURA ...] block; write it on the Maneuver's row as \`[EFFECT ${EXAMPLE}]\``);
    }
    if (context.itemType !== "action") {
      throw new RuleSyntaxError(`${TAG} is written on the Maneuver's own row: it says what using that Maneuver puts on a creature or takes off. A line that READS an Effect goes on a Talent, as in \`[EFFECT ATK: 1 situation; IFT: EFFECT(prone)]\``);
    }
    const ops = refuseComponents(e.ops, TAG, (op === "apply") ? ["when", "until", "cost"] : ["when", "cost"]);
    const whens = whensOf(ops);
    if (whens.some(w => w?.trait)) throw new RuleSyntaxError(`${TAG} does not take IFT: TRAIT(...)`);
    const outcomes = whens.filter(w => w?.outcome);
    if (outcomes.length > 1) {
      throw new RuleSyntaxError(`${TAG} takes one \`IF: RESULT(...)\` (${outcomes.length} given): write one line for each degree`);
    }

    const parts = e.descriptors ?? [];
    if (!parts.length) {
      throw new RuleSyntaxError(`${TAG} names the Effect: a Condition (\`prone\`, \`frightened 2\`) or a name of your own (\`Taking Cover\`), as in \`${EXAMPLE}\``);
    }
    if (parts.length > 2) {
      throw new RuleSyntaxError(`${TAG} takes the Effect and then \`self\` or \`target\`, not ${parts.length} descriptors: \`${EXAMPLE}\``);
    }
    let who = "self";
    if (parts.length === 2) {
      who = parts[1].trim().toLowerCase();
      if (!APPLY_WHO.includes(who)) {
        throw new RuleSyntaxError(`"${parts[1]}": after the Effect comes \`self\` (you, and the default) or \`target\` (the creature the Maneuver is used on)`);
      }
    }

    // A forgotten comma (the review of 0.32.0): `APPLY: prone target` would otherwise read as a
    // named Effect called "prone target" on the user, with no error anywhere.
    const tail = (parts.length === 1) ? parts[0].match(/^(.*\S)\s+(self|target)$/i) : null;
    if (tail) {
      throw new RuleSyntaxError(`"${parts[0]}": a comma goes before \`${tail[2].toLowerCase()}\`, as in \`${TAG}: ${tail[1]}, ${tail[2].toLowerCase()}\``);
    }

    // A Condition that carries a value takes a number after its name: `frightened 2`.
    let written = parts[0];
    let value = null;
    const numbered = written.match(/^(.*\S)\s+(\d+)$/);
    const numberedId = numbered ? conditionIdOf(numbered[1]) : null;
    if (numberedId) {
      if (!CONDITIONS[numberedId].numeric) {
        throw new RuleSyntaxError(`"${written}": ${conditionTitle(numberedId)} carries no value; write \`${conditionTitle(numberedId).toLowerCase()}\``);
      }
      if (op === "remove") {
        throw new RuleSyntaxError(`REMOVE takes a Condition off whole: write \`REMOVE: ${conditionTitle(numberedId).toLowerCase()}\``);
      }
      value = Number(numbered[2]);
      if (value < 1) throw new RuleSyntaxError(`"${written}": a value is 1 or more; to take the Condition off write \`REMOVE: ${conditionTitle(numberedId).toLowerCase()}\``);
      written = numbered[1];
    }
    const read = readEffectName(written);
    // A name that BEGINS with a Condition's name is read as a named Effect of its own
    // (`frightened two`, `prone and grabbed`): almost always a slip, so it is said.
    if (!read.condition) {
      const words = written.trim().split(/\s+/);
      for (let k = words.length - 1; k >= 1; k -= 1) {
        const id = conditionIdOf(words.slice(0, k).join(" "));
        if (!id) continue;
        context.warn?.(`"${written}" is read as a named Effect of its own, not the Condition ${conditionTitle(id)}; for the Condition write \`${conditionTitle(id).toLowerCase()}\`${CONDITIONS[id].numeric ? ", with a whole number for its value" : ""}`);
        break;
      }
    }
    if (read.condition && SYSTEM_CONDITIONS.includes(read.condition)) {
      throw new RuleSyntaxError(`${TAG} cannot ${op === "remove" ? "take off" : "put on"} ${read.name}: the system runs that Condition itself (the Bind, Wounds, Dying, Spent and Preparing follow what happens to the creature)`);
    }
    if ((op === "apply") && read.condition && CONDITIONS[read.condition].numeric && (value === null)) value = 1;
    if ((value !== null) && ops.until) {
      throw new RuleSyntaxError(`APPLY takes no UNTIL beside a Condition with a value: ${read.name} ${value} moves by its own rule`);
    }
    if ((who === "target") && !outcomes.length) {
      throw new RuleSyntaxError(`${TAG} on a target lands from the card of the Maneuver's check, so it names the result: add \`IF: RESULT(<degree>)\`, as in \`${EXAMPLE}\``);
    }
    return {
      op,
      effect: { name: read.name, slug: read.slug, condition: read.condition, ...(value !== null ? { value } : {}) },
      who,
      when: ops.when,
      until: (op === "apply") ? (ops.until ?? null) : null,
      cost: ops.cost ?? null
    };
  },

  /** `puts Prone on the target, on a Success`; `takes Prone off you`. */
  summary(rule) {
    return ruleWords(rule);
  },

  hooks: {
    /**
     * What each line of this Maneuver's row says (the header, THE HOOK).
     * @param {Array<{rule: object, item: object}>} entries  This kind's rules on the Item used.
     * @param {{rank?: string|null}} context  `rank` is the rank ROLLED, or null for a use with no check.
     * @param {object} actor  The creature using the Maneuver.
     * @returns {Array<{line: object}>}
     */
    applies(entries, context = {}, actor = null) {
      const out = [];
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        if (!rule?.effect?.slug || !["apply", "remove"].includes(rule.op)) continue;
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
        if (!holds) continue;
        out.push({
          line: {
            op: rule.op,
            effect: { name: rule.effect.name, slug: rule.effect.slug, condition: rule.effect.condition ?? null, ...(rule.effect.value ? { value: rule.effect.value } : {}) },
            who: (rule.who === "target") ? "target" : "self",
            until: rule.until ?? null,
            degree,
            cost: (rule.cost === null || rule.cost === undefined) ? null : Number(rule.cost),
            line: rule.line ?? 0
          }
        });
      }
      return out;
    }
  }
};
