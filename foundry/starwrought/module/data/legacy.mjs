/**
 * Conversions of v3.x stored values, run once by the world migration in starwrought.mjs and
 * recorded in the `systemVersion` world setting. They lived in the Item data model file
 * through 0.10.0 by accident of history; nothing about an Item reads them, and the one caller
 * is the migration block.
 */

/**
 * A stored Speed of this many feet or more is a v3.x value (the old five-foot scale, on which a
 * Human was 25). v4.10 Speed is feet per Move on the one-foot grid, and a Human is 6.
 */
export const LEGACY_SPEED_FLOOR = 15;

/**
 * A v3.x Speed (five-foot scale) becomes feet per Move on the one-foot grid: a quarter of it,
 * rounded down as the Math Conventions say, so a Human's 25 is 6.
 *
 * This is a one-time conversion, run by the world migration in `starwrought.mjs` and recorded in
 * the `systemVersion` world setting, not a rule in `migrateData`: there it ran on every load and on
 * every write, which made 15 a ceiling no Speed could ever be typed past.
 * @param {number} value
 * @returns {number}
 */
export function migrateSpeed(value) {
  if (typeof value !== "number" || value < LEGACY_SPEED_FLOOR) return value;
  return Math.max(1, Math.floor(value / 4));
}
