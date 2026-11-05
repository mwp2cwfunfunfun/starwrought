/**
 * Can this Strike Critically Hit? The one rule the engine, the dialog, the card and the damage roll all ask.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. Imported by all of them, so it imports nothing but the config.
 */

import * as SW from "../../config.mjs";

/**
 * Can this Strike Critically Hit? Quick cannot, unless the weapon is Agile (PHB v4.10).
 * @param {string} strike
 * @param {Item|null} weapon
 * @returns {boolean}
 */
export function strikeCanCrit(strike, weapon) {
  const kind = SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  if (kind.canCrit) return true;
  return !!(kind.agileCanCrit && weapon?.system?.flags?.agile);
}
