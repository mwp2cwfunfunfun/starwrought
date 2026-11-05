/**
 * What two of the character's passes and the adversary's model share: the first Arms Wound's
 * penalty (Defenses and the offense) and why Evade is unavailable (the character's Defense pass and
 * SwNpcData). Through 0.10.1 both sat at module scope in module/data/actor.mjs.
 */

/** The first Arms Wound (PHB v4.10, Wounds): -2 Situation to attacks and to Guard. */
export const ARMS_WOUND_PENALTY = -2;

/** Why Evade cannot be used right now, as a condition id, or null when it can. */
export function unavailableEvade(statuses) {
  if (statuses.has("grabbed")) return "grabbed";
  if (statuses.has("restrained")) return "restrained";
  return null;
}
