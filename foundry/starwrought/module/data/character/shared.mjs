/**
 * What two of the character's passes and the adversary's model share: the first Arms Wound's
 * penalty (Defenses and the offense) and why Evade is unavailable (the character's Defense pass and
 * SwNpcData). Through 0.10.1 both sat at module scope in module/data/actor.mjs.
 */

import { conditionSetOf, heldIds } from "../../rules/condition-set.mjs";

/** The first Arms Wound (PHB v4.10, Wounds): -2 Situation to attacks and to Guard. */
export const ARMS_WOUND_PENALTY = -2;

/**
 * Why Evade cannot be used right now, as a condition id, or null when it can. Since 0.33.0 it is
 * asked of what the creature HAS (`heldConditions` below), so a Condition that includes Grabbed
 * takes Evade away as Grabbed does; Restrained is named first, since it includes Grabbed.
 */
export function unavailableEvade(statuses) {
  if (statuses.has("restrained")) return "restrained";
  if (statuses.has("grabbed")) return "grabbed";
  return null;
}

/**
 * The Conditions an Actor has, as a set of ids: its statuses closed over what each includes
 * (0.33.0; module/rules/condition-set.mjs).
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function heldConditions(actor) {
  return new Set(heldIds(conditionSetOf(actor)));
}
