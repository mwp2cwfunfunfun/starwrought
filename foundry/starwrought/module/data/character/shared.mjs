/**
 * What two of the character's passes and the adversary's model share: the first Arms Wound's
 * penalty (Defenses and the offense). Through 0.10.1 it sat at module scope in
 * module/data/actor.mjs.
 *
 * WHY A DEFENSE CANNOT BE USED left this file in 0.38.0 (`unavailableEvade`, which named Grabbed
 * and Restrained in code, and `heldConditions`, which it alone asked): a Condition's row says it
 * now, `[EFFECT CANNOT: evade]`, and the two Defense passes ask `unusableDefenses` in
 * module/rules/cannot.mjs, where the old rule stands on as a guard for a world whose Conditions
 * file cannot be read.
 */

/** The first Arms Wound (PHB v4.10, Wounds): -2 Situation to attacks and to Guard. */
export const ARMS_WOUND_PENALTY = -2;
