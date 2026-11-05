/**
 * Actions a round: the number a character's round starts with.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline). A plain function over the data model: `data` is
 * the SwCharacterData instance. Reads: data.bonuses.actions. Writes: data.actionsPerRound.
 */

import * as SW from "../../config.mjs";

/**
 * PHB v4.10: "every combatant receives six actions (some creatures have more or fewer)". A
 * character's six, plus the sheet's Actions adjustment (0.10.1; an Active Effect's target for a
 * haste-like effect, negative for the reverse), never below 0 and never above the system's
 * ceiling. An adversary carries its own number as a field instead, so `system.actionsPerRound`
 * reads on both types and `SwActor#actionsPerRound` is the one getter over it. Slowed is not
 * taken here: it comes off the count at the start of each round (`resetActions`), as the book
 * has it, and the pips still show the round's full number.
 */
export function prepareActions(data) {
  const bonus = Number(data.bonuses?.actions) || 0;
  data.actionsPerRound = Math.clamp(SW.ACTIONS_PER_ROUND + bonus, 0, SW.ACTIONS_MAX);
}
