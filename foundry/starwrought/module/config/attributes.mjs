/**
 * The four Attributes and the Attribute Bonus (PHB, Character Mechanics).
 * Derived from Talents, never bought.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * The four Attributes. Never bought, never rolled: derived from the Talents you own.
 * Attribute Bonus = Attribute Points / 3, rounded down, maximum +5. There is no minimum +1;
 * 0-2 points is +0 (PHB v3.1 Attribute table).
 */
export const ATTRIBUTES = Object.freeze({
  might: { label: "STARWROUGHT.Attribute.might", abbr: "STARWROUGHT.Attribute.mightAbbr", glyph: "▲" },
  agility: { label: "STARWROUGHT.Attribute.agility", abbr: "STARWROUGHT.Attribute.agilityAbbr", glyph: "⚡" },
  wits: { label: "STARWROUGHT.Attribute.wits", abbr: "STARWROUGHT.Attribute.witsAbbr", glyph: "◉" },
  presence: { label: "STARWROUGHT.Attribute.presence", abbr: "STARWROUGHT.Attribute.presenceAbbr", glyph: "✦" }
});

/**
 * Attribute Bonus = Attribute Points ÷ 4, rounded down (PHB v4.21, Key Terms: "An Attribute Bonus
 * equals the number of associated Attribute Points divided by 4, rounded down"; 0-3 is +0, 4-7 is
 * +1, 8-11 is +2, every 4 more is +1 more). The +5 cap of v4.10 to v4.15 was the old Key Terms
 * sentence, kept until the book repealed it (v4.10 sync report, ruling 1); v4.21's Key Terms
 * names no maximum, so there is none (v4.21 sync report, ruling 158). `ATTRIBUTE_MAX` stays on
 * the shape as Infinity for the one reader that compares against it.
 */
export const ATTRIBUTE_DIVISOR = 4;
export const ATTRIBUTE_MAX = Infinity;

/**
 * Convert Attribute Points into an Attribute Bonus.
 * @param {number} points
 * @returns {number}
 */
export function attributeBonus(points) {
  return Math.min(ATTRIBUTE_MAX, Math.floor((Number(points) || 0) / ATTRIBUTE_DIVISOR));
}
