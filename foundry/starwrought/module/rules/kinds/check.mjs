/**
 * The `check` rule kind (0.34.0; rulings 337 to 349): the check a Maneuver rolls, declared on the
 * Maneuver's own row. Mike, 2026-11-19: "when I add new talents I don't want to hard-code what
 * the check is. So wouldn't it make sense if the check was also using automation grammar, as well
 * as the success/failure effects?"
 *
 *   [CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>]
 *
 *   [CHECK Athletics vs Evade or Guard]     Trip, Shove, Disarm, Grapple: the target picks
 *   [CHECK Athletics or Acrobatics]         the one using the Maneuver picks
 *   [CHECK Intimidation vs Guard]           Demoralize
 *   [CHECK relevant]                        Aid, Recall Knowledge
 *   [CHECK Crafting vs 15]                  a Threshold the row names
 *
 * A feature block, on a Maneuver's own row and nowhere else (a Maneuver a Talent grants is a copy
 * of its row, so it carries the block too; a Talent that needs a roll grants one). The words, the
 * reading and the plan every caller asks are ../check.mjs's, which this file only wraps.
 *
 * The stored rule: `{ kind: "check", line, text, rolls: "relevant" | [{ slug, name }],
 * against: null | { defenses: [...] } | { threshold: n } }`.
 *
 * NO HOOK, ON PURPOSE. A kind with a `use` hook takes the whole use (`usableByRule`,
 * documents/item.mjs), and the row would then never roll its check; one with a `card` hook would
 * be called paid from its card. The Maneuver's own use reads the plan off the Item
 * (`system.checkPlan`, data/items/action.mjs).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readCheck, checkSummary, isBonusShape, BONUS_FORM } from "../check.mjs";

const EXAMPLE = "[CHECK Athletics vs Evade or Guard]";

export default {
  id: "check",
  aliases: [],

  /**
   * @param {string} args      The block's data, after the keyword.
   * @param {object} context   The grammar's context; `form`, `itemType` and `resolve` are read.
   */
  parse(args, context = {}) {
    // A bonus to checks written as a block is told the effect form first, whatever the carrier:
    // on a Talent that is the likeliest slip, and "write it on the Maneuver's row" would send
    // the author the wrong way (the review of 0.34.0).
    if (isBonusShape(args)) throw new RuleSyntaxError(BONUS_FORM);
    if (context?.form && (context.form !== "feature")) {
      throw new RuleSyntaxError(`the check a Maneuver rolls is a block of its own, not an effect: \`${EXAMPLE}\``);
    }
    if (context?.itemType && (context.itemType !== "action")) {
      throw new RuleSyntaxError("CHECK is written on the Maneuver's own row: it says what that Maneuver rolls. A Talent that needs a roll grants a Maneuver, `[MANEUVER <Name>]`, and the Maneuver's row carries the check");
    }
    return readCheck(args, context);
  },

  /** `rolls Athletics vs Evade or Guard (the target picks the Defense)`. */
  summary(rule) {
    return checkSummary(rule);
  },

  hooks: {}
};
