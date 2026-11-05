/**
 * Weapons: Handling, the Weapon Groups, the damage dice by level and specialization.
 * The weapon Traits themselves are parsed in module/data/items/weapon-traits.mjs.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Handling. What happens to your Weapons Proficiency Bonus when you lack Familiarity with
 * the weapon: Intuitive costs nothing, Practiced drops a rank, Technical drops you to Untrained.
 */
export const HANDLING = Object.freeze({
  intuitive: { label: "STARWROUGHT.Handling.intuitive", steps: 0, untrained: false },
  practiced: { label: "STARWROUGHT.Handling.practiced", steps: -1, untrained: false },
  technical: { label: "STARWROUGHT.Handling.technical", steps: 0, untrained: true }
});

/** Weapon groups, used by Weapon Familiarity. */
export const WEAPON_GROUPS = Object.freeze([
  "Axes", "Bows", "Clubs", "Crossbows", "Flails", "Hammers", "Knives",
  "Natural Weapons", "Picks", "Polearms", "Slings", "Spears", "Swords", "Whips"
]);

/**
 * Weapon damage dice by character level (PHB v4.10): two dice at 4th, three at 8th, four at 12th,
 * five at 16th. A Quick Strike and a Graze roll one die whatever the level.
 * @param {number} level
 * @returns {number}
 */
export function weaponDice(level) {
  level = Number(level) || 1;
  if (level >= 16) return 5;
  if (level >= 12) return 4;
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

/** Weapon specialization damage by Melee or Ranged rank: +2 Expert, +3 Master, +4 Legendary. */
export const SPECIALIZATION = Object.freeze({
  untrained: 0, trained: 0, expert: 2, master: 3, legendary: 4
});

// There is no Multiple Attack Penalty in v4.10. Tempo is paid in actions: six a round, spread
// across Opportunities, and a Reaction costs the same actions an attack does.
