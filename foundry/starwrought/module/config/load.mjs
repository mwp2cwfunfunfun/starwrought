/**
 * Load Strain and what it touches (PHB v4.11 to v4.13): Endure's relief and Vigor bonus,
 * where the Strain lands on a check, the Wind check and the Fatigued ceiling, and the helm
 * penalties by name.
 * The Load Strain formula itself is the character model's (module/data/actor.mjs).
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Load Strain reduction from your Endure rank, once you own Endure Training (PHB v4.11, Endure
 * Training: "reduce your Load Strain by 1 at Trained, 2 at Expert, 3 at Master, and 4 at
 * Legendary", to a minimum of 0). Until v4.11 the relief began at Expert (ruling R5).
 */
export const LOAD_RELIEF = Object.freeze({
  untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4
});

/**
 * The Endure Bonus to Vigor (PHB v4.11, Endure Training: "at Expert rank in Endure you gain 1
 * more Vigor at every level, 2 at Master, and 3 at Legendary"). It is the per-level term beside
 * Ancestry Vigor, read live from the current Endure rank, so it counts at 1st level too, where it
 * is 0 (ruling R1).
 */
export const ENDURE_VIGOR_BONUS = Object.freeze({
  untrained: 0, trained: 0, expert: 1, master: 2, legendary: 3
});

/**
 * Where Load Strain lands on a check (PHB v4.11, Load and Load Strain: "Climb, Swim, and Stealth
 * checks take your Load Strain as a penalty. Nothing else does"). Stealth is a Constellation of
 * its own, so the engine applies it. Climb and Swim are Athletics checks the engine cannot tell
 * from a grapple or a tumble, so the roll dialog offers the penalty there, unticked, for the
 * player to take when the check is one of those (ruling R2). Evade never takes it.
 */
export const STRAIN_CHECKS = Object.freeze({ stealth: "always", athletics: "offered" });

/**
 * At the end of this round and every round after, a fighter carrying Load Strain 1 or more rolls
 * Endure against 10 + Load Strain or grows Fatigued (PHB v4.13, Wind), unless their Endure
 * Threshold already meets that number: then there is no Wind check at all (ruling 74). The v4.11
 * and v4.12 books delayed the first check to the end of the third round; v4.13 says "at the end
 * of every round while in an encounter", so the check comes from round 1 (ruling 79). The
 * character model derives the comparison as `system.wind` (threshold, endureThreshold, exempt,
 * due).
 */
export const WIND_ROUND = 1;
/**
 * Fatigued N rises by 1 on each failed Wind check, to this ceiling (PHB v4.13, Wind). It ends with
 * ten minutes of rest and with nothing else: the Fatigued card's "Ten minutes' rest" button or a
 * night's rest clears it (ruling 81), never the end of the Combat (through 0.6.1 it did).
 */
export const FATIGUED_MAX = 3;
/** Helm penalties to Awareness checks, the Awareness Threshold and Initiative, by the Head piece's name. */
export const HELM_PENALTIES = Object.freeze({ "Closed helm": -2, "Open helm": -1 });
