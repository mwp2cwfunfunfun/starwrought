/**
 * Proficiency Ranks, Talent tiers and the rank arithmetic.
 * `stepRank` uses Foundry's `Math.clamp` inside its body, which is fine for the build so long
 * as it stays inside the body.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Proficiency Ranks. `points` is the minimum spend in the Constellation, `level` the minimum
 * character level. Both gates must be met.
 */
// PHB v4.10: the Proficiency Bonus is the whole of a check's training term; level never touches
// the die. Trained +3, Expert +6, Master +9, Legendary +12, gated at levels 1 / 5 / 10 / 15.
export const RANKS = Object.freeze({
  untrained: { label: "STARWROUGHT.Rank.untrained", abbr: "U", bonus: 0, points: 0, level: 0, order: 0 },
  trained: { label: "STARWROUGHT.Rank.trained", abbr: "T", bonus: 3, points: 1, level: 1, order: 1 },
  expert: { label: "STARWROUGHT.Rank.expert", abbr: "E", bonus: 6, points: 4, level: 5, order: 2 },
  master: { label: "STARWROUGHT.Rank.master", abbr: "M", bonus: 9, points: 9, level: 10, order: 3 },
  legendary: { label: "STARWROUGHT.Rank.legendary", abbr: "L", bonus: 12, points: 16, level: 15, order: 4 }
});

/** Rank keys in ascending order. */
export const RANK_ORDER = Object.freeze(["untrained", "trained", "expert", "master", "legendary"]);

/** Talent tier letters, as authored in the spreadsheets, mapped to the rank they require. */
export const TIERS = Object.freeze({
  T: { label: "STARWROUGHT.Rank.trained", rank: "trained", order: 1 },
  E: { label: "STARWROUGHT.Rank.expert", rank: "expert", order: 2 },
  M: { label: "STARWROUGHT.Rank.master", rank: "master", order: 3 },
  L: { label: "STARWROUGHT.Rank.legendary", rank: "legendary", order: 4 }
});

/**
 * Resolve a Proficiency Rank from points spent in a Constellation and character level.
 * @param {number} points
 * @param {number} level
 * @returns {string} A key of RANKS.
 */
export function rankFor(points, level) {
  points = Number(points) || 0;
  level = Number(level) || 1;
  let rank = "untrained";
  for (const key of RANK_ORDER) {
    const gate = RANKS[key];
    if (points >= gate.points && level >= gate.level) rank = key;
  }
  return rank;
}

/** The Proficiency Bonus of a rank key. */
export function rankBonus(rank) {
  return RANKS[rank]?.bonus ?? 0;
}

/**
 * Has a rank reached a minimum? Compares `RANKS[...].order`, so Legendary satisfies an Expert
 * gate. An absent minimum (null or undefined) is no gate at all and is always met: that is how a
 * Reaction granted by a Root alone reads (see REACTIONS). An unrecognised actor rank reads as
 * Untrained; an unrecognised minimum is a gate nobody can name, so it is never met rather than
 * silently open (ruling 63, Counter at Melee Expert).
 * @param {string} rank      The rank held, a key of RANKS.
 * @param {string} [minimum] The rank required, a key of RANKS, or nothing for no requirement.
 * @returns {boolean}
 */
export function rankAtLeast(rank, minimum) {
  if (minimum === undefined || minimum === null) return true;
  const need = RANKS[minimum]?.order;
  if (need === undefined) return false;
  return (RANKS[rank]?.order ?? 0) >= need;
}

/** Step a rank down by N steps, floored at untrained. Used by Practiced weapon Handling. */
export function stepRank(rank, steps = -1) {
  const i = RANK_ORDER.indexOf(rank);
  if (i < 0) return "untrained";
  return RANK_ORDER[Math.clamp(i + steps, 0, RANK_ORDER.length - 1)];
}
