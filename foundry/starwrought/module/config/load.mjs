/**
 * Load Strain and what it touches (PHB v4.21, Load and Load Strain): Endure's relief, where the
 * Strain lands on a check, the Wind check and the Fatigued ceiling, and the two armor traits the
 * system acts on, Visored and Fitted.
 * The Load Strain formula itself is the character model's (module/data/character/armor.mjs).
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Load Strain reduction from your Endure rank, once you own Endure Training (PHB v4.11 and since,
 * Endure Training: "reduce your Load Strain by 1 at Trained, 2 at Expert, 3 at Master, and 4 at
 * Legendary", to a minimum of 0). Until v4.11 the relief began at Expert (ruling R5). v4.21's
 * Endure Training grants nothing to Vigor any more (ruling 151; the v4.11 to v4.15 Endure Bonus
 * is gone).
 */
export const LOAD_RELIEF = Object.freeze({
  untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4
});

/**
 * Where Load Strain lands on a check (PHB v4.21, Speed at the margin: "Apply your Load Strain as
 * a Condition penalty to Stealth, Acrobatics, Climb, and Swim checks"). Stealth and Acrobatics are
 * Constellations of their own, so the engine applies it. Climb and Swim are Athletics checks the
 * engine cannot tell from a grapple or a tumble, so the roll dialog offers the penalty there,
 * unticked, for the player to take when the check is one of those (ruling R2). Evade never takes
 * it. The penalty is typed Condition since v4.21 (untyped through v4.15); with v4.21's stacking it
 * adds to Fatigued's either way.
 */
export const STRAIN_CHECKS = Object.freeze({ stealth: "always", acrobatics: "always", athletics: "offered" });
/** The type the book gives the Load Strain penalty (PHB v4.21). */
export const STRAIN_TYPE = "condition";

/**
 * At the end of this round and every round after, a fighter carrying Load Strain 1 or more rolls
 * Endure against 10 + Load Strain or grows Fatigued (PHB v4.21, Wind). v4.12 to v4.15 exempted a
 * fighter whose Endure Threshold already met that number (ruling 74); v4.21 drops the clause, so
 * everyone carrying Load rolls, every round (ruling 150). The character model derives the
 * comparison as `system.wind` (threshold, endureThreshold, due) for the tooltip.
 */
export const WIND_ROUND = 1;
/**
 * Fatigued N rises by 1 on each failed Wind check and by 2 on a critical failure (PHB v4.21), to
 * this ceiling. It goes down with rest and with nothing else (never the end of the Combat,
 * ruling 81): by `FATIGUED_REST_STEP` for every ten minutes of uninterrupted rest, and whole with
 * a night's rest (0.36.0; rulings 372 and 373, below).
 */
export const FATIGUED_MAX = 3;
export const WIND_FAIL_RISE = 1;
export const WIND_CRIT_FAIL_RISE = 2;

/**
 * What ten minutes of uninterrupted rest take off Fatigued (0.36.0; ruling 372). The Fatigued row
 * of data/conditions.xlsx, the only authority for what a Condition says (ruling 322): "Reduce by 1
 * after every ten minutes of uninterrupted rest, unless otherwise specified." Through 0.35.1 the
 * row read "Ends after ten minutes of rest" and the rest took it off whole.
 */
export const FATIGUED_REST_STEP = 1;

/**
 * Fatigued after rest: the value less one step for each ten-minute stretch, never below 0 (0 is
 * "no longer Fatigued"). Pure, so the self-test drives it; `SwActor#restTenMinutes` is its one
 * caller, with one stretch for each press (ruling 374). A night's rest does not come through
 * here: it ends Fatigued whatever its value (ruling 373).
 * @param {number} value        The Fatigued value now.
 * @param {number} [stretches]  Ten-minute stretches of uninterrupted rest.
 * @returns {number}
 */
export function fatiguedAfterRest(value, stretches = 1) {
  const now = Math.max(0, Math.floor(Number(value) || 0));
  const rested = Math.max(0, Math.floor(Number(stretches) || 0));
  return Math.max(0, now - (FATIGUED_REST_STEP * rested));
}

/**
 * Visored (PHB v4.21, Armor Traits): "Can Raise or Lower the visor as a single action. Lowered:
 * Imposes -1 Gear penalty to Awareness and Initiative. Raised: Protection is reduced by 1, but no
 * Awareness or Initiative penalties." The armor Item stores `lowered`; the two Maneuvers that flip
 * it are the system's (documents/maneuvers.mjs). Through v4.15 the helm's cost was by name
 * (Closed helm -2, Open helm -1, Situation), which v4.21's tables no longer carry.
 */
export const VISOR_PENALTY = -1;
export const VISOR_RAISED_PROTECTION = -1;

/**
 * Fitted (PHB v4.21, Armor Traits): "If you wear armor with the Fitted trait in at least three
 * Zones, and they have all been adjusted to you, reduce total Load Strain by 1." The armor Item
 * stores `adjusted`, the player's word that the piece was fitted to them. This is the Fitted
 * Harness of the Load Strain formula; the matched harness of v4.10 to v4.15 (four pieces of one
 * material: +1 Torso Protection, -1 Load Strain) is gone with its tables.
 */
export const FITTED_ZONES = 3;
export const FITTED_RELIEF = 1;
