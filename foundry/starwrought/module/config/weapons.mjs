/**
 * Weapons: Handling, the Weapon Groups and the damage dice by rank.
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
 * Weapon damage dice by rank (PHB v4.21, Weapon Damage Dice): a Deliberate or Committed Strike
 * rolls one weapon die at Trained, two at Expert, three at Master and four at Legendary, the rank
 * being Melee's or Ranged's as the Strike rolled it (Handling still applies); a Quick Strike and a
 * Graze roll one whatever the rank. Untrained rolls one. The book adds: "do not add them a second
 * time as weapon specialization", so the +2 / +3 / +4 specialization damage of v4.10 to v4.15 is
 * gone with the level table (two dice at 4th, three at 8th, four at 12th, five at 16th; ruling
 * 153).
 */
export const WEAPON_DICE_BY_RANK = Object.freeze({
  untrained: 1, trained: 1, expert: 2, master: 3, legendary: 4
});

/**
 * @param {string} rank  A rank key (untrained to legendary).
 * @returns {number}
 */
export function weaponDice(rank) {
  return WEAPON_DICE_BY_RANK[String(rank ?? "untrained").toLowerCase()] ?? 1;
}

// There is no Multiple Attack Penalty in v4.10 and since. Tempo is paid in actions: six a round,
// spread across Opportunities, and a Reaction costs the same actions an attack does.
