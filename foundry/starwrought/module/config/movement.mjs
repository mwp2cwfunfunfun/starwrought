/**
 * Movement on the one-foot grid: Speed, Step, Rush, Leap and Crawl (PHB v4.10).
 * Exploration travel figures are the road's, in party.mjs.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * PHB v4.10: Speed is how far a single Move ❶ carries you, in feet; a Human's is 6. A Step ❶ is
 * half your Speed and never provokes; a Rush ❸ is five times your Speed in a straight line, less
 * your Load Strain in feet. Leap ❶ is 10 feet (less Load Strain) or 3 up; Crawl ❶ is 3 feet.
 */
export const DEFAULT_SPEED = 6;
export const STEP_DIVISOR = 2;
export const RUSH_MULTIPLIER = 5;
export const LEAP_FEET = 10;
export const CRAWL_FEET = 3;
