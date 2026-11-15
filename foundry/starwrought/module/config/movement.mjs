/**
 * Movement on the one-foot grid: Speed, Step, Rush, Leap and Crawl (PHB v4.21, Motion).
 * Exploration travel figures are the road's, in party.mjs.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Speed is how far a single Move ❶ carries you, in feet; a Human's is 6. A Step ❶ is half your
 * Speed and never provokes. Since PHB v4.21 a Rush is ❷ for three times your Speed in a straight
 * line, less your Load Strain in feet, and leaves you Off-Guard until your next Opportunity (v4.10
 * to v4.15: ❸ for five times); Leap is ❶ for half your Speed, ❷ for your Speed, ❸ for one and a
 * half times it after a run of at least half your Speed, each less Load Strain (through v4.15 a
 * flat 10 feet); Crawl ❶ is half your Speed while prone (through v4.15 three feet). Crawl's
 * Speed is the one you had before the final Legs Wound took it to 0 (ruling 138), since a fighter
 * who cannot Stand still has a Speed to halve.
 */
export const DEFAULT_SPEED = 6;
export const STEP_DIVISOR = 2;
export const RUSH_MULTIPLIER = 3;
/** What a Rush costs in actions; a straight line longer than this many Moves is cheaper as a Rush. */
export const RUSH_COST = 2;
/** Leap ❶ ❷ ❸, as a multiple of Speed: Quick Jump, Standing Long Jump, Running Long Jump. */
export const LEAP_STEPS = Object.freeze({ 1: 0.5, 2: 1, 3: 1.5 });
export const CRAWL_DIVISOR = 2;

/**
 * Multipliers and Divisors (PHB v4.25, Chapter 8): "When multiple effects multiply or divide a
 * value, combine them additively rather than applying them in sequence. Start with a multiplier and
 * divisor of 1, then add each effect's increase above 1 to the appropriate number ... Two effects
 * that each double a value combine to triple it (×3) ... Two effects that each halve a value
 * combine to divide it by 3 ... If both multipliers and divisors apply, multiply by the combined
 * multiplier, then divide by the combined divisor. Round down the final result."
 *
 * An effect is `{ times: n }` or `{ over: n }` (n above 1; anything else is no effect), so a third
 * is `{ over: 3 }` and never the float 1/3. The rule is applied where two effects MEET on one
 * value and nowhere else (Mike, 2026-11-15, the v4.25 sync): overlapping Difficult terrain, the
 * party's Travel Speed (an Activity's pace and the terrain's), and the Legs (a Critical Hit's
 * halving and a Wound's). A Step, a Crawl, a Leap and a Rush still take their own fraction of the
 * Speed you have, a second Legs Wound "halves what Speed it had left" in the book's own words, and
 * the damage order keeps its own halving and doubling.
 * @param {Array<{times?: number, over?: number}>} effects
 * @returns {{multiplier: number, divisor: number}}
 */
export function combineFactors(effects = []) {
  let multiplier = 1;
  let divisor = 1;
  for (const effect of effects ?? []) {
    const times = Number(effect?.times);
    const over = Number(effect?.over);
    if (Number.isFinite(times) && (times > 1)) multiplier += times - 1;
    if (Number.isFinite(over) && (over > 1)) divisor += over - 1;
  }
  return { multiplier, divisor };
}

/** A value under the effects that meet on it, not yet rounded: the caller rounds its final figure down. */
export function applyFactors(value, effects = []) {
  const { multiplier, divisor } = combineFactors(effects);
  return ((Number(value) || 0) * multiplier) / divisor;
}

/**
 * What several overlapping regions cost to cross (0.26.0): each region's difficulty is one effect,
 * so two at ×2 are ×3, where through 0.25.0 they multiplied as core's do (×4). A difficulty below 1
 * (ground that is quicker to cross) is a divisor. The two ends are not effects to combine and
 * keep the meaning multiplying gave them: an impassable region (Infinity) makes the ground
 * impassable whatever it overlaps, and otherwise a region of 0 (core's Modify Movement Cost set to
 * nothing) makes it free.
 * @param {number[]} difficulties
 * @returns {number}
 */
export function combineDifficulties(difficulties = []) {
  const effects = [];
  let free = false;
  for (const raw of difficulties ?? []) {
    if ((raw === null) || (raw === undefined) || (raw === "")) continue;
    const d = Number(raw);
    if (d === Infinity) return Infinity;
    if (d === 0) { free = true; continue; }
    if (!Number.isFinite(d) || (d < 0) || (d === 1)) continue;
    effects.push((d > 1) ? { times: d } : { over: 1 / d });
  }
  if (free) return 0;
  const { multiplier, divisor } = combineFactors(effects);
  return multiplier / divisor;
}

/**
 * Speed in feet per Move after the Legs (PHB v4.25). The Legs' Critical Hit effect ("The target's
 * Speed is halved until it Recenters") and the first Legs Wound ("Your Speed is halved") are two
 * effects that meet: together a third. Each further Wound short of the final one "halves what
 * Speed it had left", in sequence, as the book says. The final Wound is Prone and cannot Stand:
 * Speed 0, with `beforeFinal` the Speed a Crawl is measured from (ruling 138).
 * @param {number} base  Speed before the Legs.
 * @param {object} [legs]
 * @param {boolean} [legs.critical]  The Legs' Critical Hit effect is running.
 * @param {number} [legs.wounds]
 * @param {boolean} [legs.final]     The Wound that fills the Zone's capacity has landed.
 * @returns {{speed: number, beforeFinal: number}}
 */
export function speedAfterLegs(base, { critical = false, wounds = 0, final = false } = {}) {
  let speed = Math.max(0, Number(base) || 0);
  const short = Math.max(0, (Number(wounds) || 0) - (final ? 1 : 0));
  const meeting = [];
  if (critical) meeting.push({ over: 2 });
  if (short >= 1) meeting.push({ over: 2 });
  if (meeting.length) speed = Math.floor(applyFactors(speed, meeting));
  for (let i = 1; i < short; i++) speed = Math.floor(speed / 2);
  return { speed: final ? 0 : speed, beforeFinal: speed };
}
