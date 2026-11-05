/**
 * Going down and getting up: Dying, Hero Points, the Recovery check and treating a Wound.
 * Four numbers.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

export const DYING_MAX = 5;
export const HERO_POINTS_MAX = 3;
/** The Recovery check while Dying: Endure against 10 + Dying value + Wounds carried. */
export const RECOVERY_BASE = 10;
/** Treating a Wound: ten minutes and an Endure check against 10 + the Wounds the patient carries. */
export const TREAT_WOUND_BASE = 10;
