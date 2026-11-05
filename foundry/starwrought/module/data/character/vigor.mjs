/**
 * Vigor: the maximum from the Calling's Opening Vigor and Ancestry Vigor by level; the two rests.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.details, data.level, data.bonuses, data.attributes.presence.
 * Writes: data.vigor.opening, perLevel, max, value (clamped), pct, rest, shortRest; data.spent.
 */

/**
 * Vigor (PHB v4.21, Your Vigor): at 1st level, Ancestry Vigor + your first Calling's Opening Vigor
 * + 10; at every level after, Ancestry Vigor again. So max = 10 + Opening Vigor + Ancestry Vigor x
 * level, plus the sheet's adjustment. Only your first Calling counts. The Endure Bonus of v4.11 to
 * v4.15 (1 more Vigor a level at Expert in Endure, 2 at Master, 3 at Legendary) is gone: v4.21's
 * Endure Training grants Load Strain relief and nothing to Vigor (ruling 151). A full night's rest
 * restores all of it; ten minutes spent relaxing restore level x Presence when Presence is
 * positive, else nothing (ruling 144). At 0 you are Spent.
 */
export function prepareVigor(data) {
  const perLevel = data.details.ancestry.vigor;
  data.vigor.opening = data.details.calling.vigor;
  data.vigor.perLevel = perLevel;
  data.vigor.max = Math.max(1, 10 + data.vigor.opening + (perLevel * data.level) + data.bonuses.vigor);
  data.vigor.value = Math.clamp(data.vigor.value, 0, data.vigor.max);
  data.vigor.pct = Math.round((data.vigor.value / data.vigor.max) * 100);
  /** A night's rest restores everything (PHB v4.21). */
  data.vigor.rest = data.vigor.max;
  /** Ten minutes' rest: level x Presence, 0 when Presence is not positive (PHB v4.21; ruling 144). */
  data.vigor.shortRest = Math.max(0, data.level * Math.max(0, data.attributes.presence.mod));
  data.spent = data.vigor.value === 0;
}
