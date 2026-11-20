/**
 * The rules of a check that waits on another player (0.34.0; rulings 339 to 348), as plain data
 * in and out, so the self-test drives them from Node. The cards themselves are
 * documents/cards/check-request.mjs.
 *
 * Two requests exist, and both begin with the Maneuver's user settling what is rolled:
 *
 *  - ANSWER (`mode: "answer"`; ruling 339). A character's Maneuver whose row names two Defenses
 *    (`[CHECK Athletics vs Evade or Guard]`), with one creature targeted: the target's player
 *    presses a Defense on the request card (the GM for an adversary, or for a player who is away),
 *    which posts an answer card naming the request; the user then rolls against that Defense.
 *  - ROLL (`mode: "roll"`; ruling 340, Mike: "players ALWAYS roll vs. NPCs"). An adversary's
 *    Maneuver against a player's character: the character's player presses a Defense on the
 *    request card and ROLLS it, against the adversary's number for the Constellation; the degree
 *    is then read from the other side, and the GM's client posts the Maneuver's result.
 *
 * NO DEFENSE IS EVER CHOSEN BY THE SYSTEM (ruling 159): a request has buttons and no default,
 * the first valid answer in the chat log stands, and only when the target can use exactly one of
 * the Defenses named is nobody asked (`usableDefenses`).
 *
 * Nothing is written to the request card after it is posted: its state is read from the cards
 * that name it (`from`), as the Gain Control request's is, so a reload, a second client and a
 * late answer all read one record.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the self-test imports it from Node).
 */

import { DEFENSES, invertDegree } from "../config.mjs";

/** `flags.starwrought.kind` of a request card and of the card that answers one. */
export const CHECK_REQUEST = "checkRequest";
export const CHECK_ANSWER = "checkAnswer";

/** The two requests. */
export const REQUEST_MODES = Object.freeze(["answer", "roll"]);

/**
 * Does a request card count at all? Only when its user's side posted it: the GM, or an owner of
 * the creature using the Maneuver. And a `roll` request is an adversary's alone, since a
 * character's Maneuver is rolled by its own player. Any user can create a chat message carrying
 * a request's flags, and the GM's client posts an adversary's result from a player's roll with
 * nobody pressing anything, so a card that fails this is no request: nothing answers it, rolls
 * for it or posts a result from it (the review of 0.34.0).
 * @param {object} request  The card's record (`mode`).
 * @param {{isGM?: boolean, ownsUser?: boolean, userIsCharacter?: boolean}} [author]  The card's
 *   author, and whether the creature it names as the Maneuver's user is a character.
 * @returns {boolean}
 */
export function validRequest(request, { isGM = false, ownsUser = false, userIsCharacter = false } = {}) {
  if (!request || !REQUEST_MODES.includes(request.mode)) return false;
  if ((request.mode === "roll") && userIsCharacter) return false;
  return isGM || ownsUser;
}

/**
 * The Defenses of those a row names that the target can use now. Which Defense a creature cannot
 * use is what the rows of the Conditions it has say (0.38.0: `[EFFECT CANNOT: evade]` on Grabbed,
 * which Restrained counts as; any of the four; ./cannot.mjs). With none usable every one named is
 * offered, and the read then says the Defense cannot be used, as it does for a row that names one.
 * @param {string[]} named
 * @param {(key: string) => unknown} [unavailable]  Truthy when the target cannot use that Defense.
 * @returns {string[]}
 */
export function usableDefenses(named, unavailable = () => null) {
  const list = [...new Set((named ?? []).filter(key => Object.hasOwn(DEFENSES, key)))];
  const usable = list.filter(key => !unavailable(key));
  return usable.length ? usable : list;
}

/**
 * Is this a card the request can take as its answer? An answer names a Defense the request
 * offered and is posted by someone who owns the target (the GM owns everyone); a withdrawal is
 * posted by someone who owns the Maneuver's user. Any user can create a chat message carrying
 * these flags, so the reader checks the author, never the flags alone.
 * @param {object} request  The request card's record (`defenses`).
 * @param {object} answer   The answering card's record (`defense`, or `withdrawn: true`).
 * @param {{ownsTarget?: boolean, ownsUser?: boolean, isGM?: boolean}} [author]
 * @returns {boolean}
 */
export function validAnswer(request, answer, { ownsTarget = false, ownsUser = false, isGM = false } = {}) {
  if (!request || !answer || (typeof answer !== "object")) return false;
  if (answer.withdrawn === true) return isGM || ownsUser;
  if (!(isGM || ownsTarget)) return false;
  return Array.isArray(request.defenses) && request.defenses.includes(answer.defense);
}

/**
 * The answer that stands: the first valid one, in the order of the chat log. A second press, on
 * another client or by another owner, is void.
 * @param {object} request
 * @param {Array<{id: string, answer: object, author: object}>} answers  In log order.
 * @returns {{id: string, answer: object}|null}
 */
export function standingAnswer(request, answers) {
  for (const entry of answers ?? []) {
    if (validAnswer(request, entry?.answer, entry?.author ?? {})) return { id: entry.id, answer: entry.answer };
  }
  return null;
}

/**
 * Where a request stands, from what the chat log holds for it.
 *
 *  - `rolled`: the roll it waited on has been made (one request gives one roll).
 *  - `withdrawn`: its user took it back before the roll.
 *  - `lapsed`: the Combat it was made in is gone, and nothing answered it.
 *  - `answered`: the target chose, and the user has yet to roll (`mode: "answer"` only).
 *  - `open`: nobody has pressed anything.
 *
 * @param {{answer?: object|null, rolled?: boolean, combatGone?: boolean}} [log]
 * @returns {"open"|"answered"|"rolled"|"withdrawn"|"lapsed"}
 */
export function requestState({ answer = null, rolled = false, combatGone = false } = {}) {
  if (rolled) return "rolled";
  if (answer?.withdrawn === true) return "withdrawn";
  if (answer) return "answered";
  if (combatGone) return "lapsed";
  return "open";
}

/**
 * The Maneuver's degree, read from the degree of the target's own roll (ruling 340): the same
 * comparison from the other side, as a Defense roll is read in the attack flow. The target's
 * Critical Success is the Maneuver's Critical Failure.
 * @param {string|null} degree  The degree of the target's roll.
 * @returns {string|null}
 */
export function userDegree(degree) {
  return degree ? invertDegree(degree) : null;
}

/**
 * An adversary's number for a check, in effect: the number typed on its sheet for the
 * Constellation (blank is 10), moved by what its Conditions put on a check (ruling 341).
 * @param {number|null|undefined} typed
 * @param {number} [shift]  The total of its Conditions' lines on this check.
 * @returns {{base: number, threshold: number, shift: number}}
 */
export function adversaryCheck(typed, shift = 0) {
  const number = Number(typed);
  const base = ((typed === null) || (typed === undefined) || (typed === "") || !Number.isFinite(number)) ? 10 : Math.trunc(number);
  const moved = Number.isFinite(Number(shift)) ? Number(shift) : 0;
  return { base, threshold: base + moved, shift: moved };
}
