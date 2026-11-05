/**
 * Vigor: the maximum from the Calling's Opening Vigor, Ancestry Vigor and the Endure Bonus by level.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.constellations (Endure's rank), data.details, data.level, data.bonuses, data.attributes.presence.
 * Writes: data.vigor.opening, endureBonus, perLevel, max, value (clamped), pct, rest; data.spent.
 */

import * as SW from "../../config.mjs";

/**
 * Vigor (PHB v4.11, Your Vigor): at 1st level, Ancestry Vigor + Endure Bonus + your first
 * Calling's Opening Vigor + 10; at every level after, Ancestry Vigor + Endure Bonus again. So
 * max = 10 + Opening Vigor + (Ancestry Vigor + Endure Bonus) x level, plus the sheet's
 * adjustment. The Endure Bonus is the conditioning clause of Endure Training (1 at Expert, 2 at
 * Master, 3 at Legendary), read live from the current Endure rank, so it is 0 at 1st level and
 * grows into every level already lived (ruling R1). Only your first Calling counts. A night's
 * rest restores level x Presence, or level if Presence is 1 or less. At 0 you are Spent.
 */
export function prepareVigor(data) {
  const endure = data.constellations[SW.DEFENSES.endure.slug];
  const endureBonus = SW.ENDURE_VIGOR_BONUS[endure?.rank ?? "untrained"] ?? 0;
  const perLevel = data.details.ancestry.vigor + endureBonus;
  data.vigor.opening = data.details.calling.vigor;
  data.vigor.endureBonus = endureBonus;
  data.vigor.perLevel = perLevel;
  data.vigor.max = Math.max(1, 10 + data.vigor.opening + (perLevel * data.level) + data.bonuses.vigor);
  data.vigor.value = Math.clamp(data.vigor.value, 0, data.vigor.max);
  data.vigor.pct = Math.round((data.vigor.value / data.vigor.max) * 100);
  data.vigor.rest = data.level * Math.max(1, data.attributes.presence.mod);
  data.spent = data.vigor.value === 0;
}
