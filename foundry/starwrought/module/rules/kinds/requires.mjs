/**
 * The `requires` rule kind (0.28.0; rulings 281 to 289): what a Maneuver needs before it can be
 * used, written where the system can check it. Mike, 2026-11-15, of the Maneuvers tab: "I would
 * like to only show Maneuvers that the system detects are applicable ... if you are not Prone or
 * Supine, you cannot Stand", and by question: the conditions are written "In your sheets".
 *
 *   [REQUIRES <condition> or <condition> ...]
 *
 *   [REQUIRES prone or supine]                                     Stand, Kip Up
 *   [REQUIRES free hand or weapon grapple][REQUIRES creature in reach]  Grapple
 *   [REQUIRES grabbed or restrained]                               Escape
 *   [REQUIRES not prone]                                           Drop Prone
 *
 * A feature block, on a Maneuver's own row and nowhere else (a Maneuver a Talent grants is a copy
 * of its row, so it carries the block too). Every block on the row must hold; inside one, `or`
 * gives alternatives and `not` turns a word round. The words, their reading and the three answers
 * (true, false, cannot tell) are ../requires.mjs's, which this file only wraps.
 *
 * The stored rule: `{ kind: "requires", line, text, any: [{ test, not?, ... }] }`.
 *
 * NO HOOK. Nothing here is asked at a roll and nothing is ever refused: the block decides whether
 * the Maneuvers tab LISTS the row (module/apps/actor-sheet.mjs, through `maneuverStatus`), and a
 * player who shows every Maneuver may still use one that does not apply. The Maneuvers the system
 * itself runs carry their conditions in code (`ENGINE_REQUIRES` in documents/maneuvers.mjs), and a
 * block in the cell replaces those.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readRequires, requireWords } from "../requires.mjs";

const EXAMPLE = "[REQUIRES prone or supine]";

export default {
  id: "requires",
  aliases: [],

  /**
   * @param {string} args      The block's data, after the keyword.
   * @param {object} context   The grammar's context; `form` and `itemType` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form && (context.form !== "feature")) {
      throw new RuleSyntaxError(`REQUIRES is a block of its own, not an effect: \`${EXAMPLE}\``);
    }
    if (context?.itemType && (context.itemType !== "action")) {
      throw new RuleSyntaxError("REQUIRES is written on the Maneuver's own row: it says when that Maneuver can be used, and the Maneuvers tab lists the row only then");
    }
    return readRequires(args);
  },

  /** `needs: Prone or Supine`; `needs: a foe in reach`. */
  summary(rule) {
    return `needs: ${requireWords(rule)}`;
  },

  hooks: {}
};
