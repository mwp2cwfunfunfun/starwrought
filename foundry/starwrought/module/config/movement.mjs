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
