/**
 * Wind: the Wind Threshold, the Endure Threshold it is rolled with, and whether the round-end check is due.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.loadStrain (armor), data.defenses.endure (defenses).
 * Writes: data.wind.
 */

/**
 * Wind (PHB v4.21, Load and Load Strain): "If your Load Strain is at least 1, then at the end of
 * every round while in an encounter, you must roll Endure against 10 + Load Strain": on a failure
 * Fatigued rises by 1, on a critical failure by 2. So the Wind Threshold is 10 + Load Strain and
 * `due` is whether the round-end check comes at all: Load Strain 1 or more. A fighter carrying no
 * Load has nothing to be winded by, whatever penalties sit on their Endure. v4.12 to v4.15
 * exempted a fighter whose Endure Threshold already met the Wind Threshold (ruling 74); v4.21
 * drops that clause, so `exempt` is always false now and stays on the shape for the one reader
 * that compared it (ruling 150). The Endure Threshold is kept for the tooltip: it is the one the
 * sheet shows, with everything the Defense pass folds in (Frightened and, since v4.21, Fatigued).
 *
 * Derived after Load Strain (prepareArmor) and the Defenses (prepareDefenses); that order
 * matters. The check comes from the end of round 1 (ruling 79). `combat.mjs` reads `due` at the
 * end of the round and the sheet's Load Strain tooltip reads all of it (actor-context.mjs,
 * windTip).
 */
export function prepareWind(data) {
  const threshold = 10 + data.loadStrain;
  const endureThreshold = data.defenses.endure?.threshold ?? 10;
  data.wind = {
    threshold,
    endureThreshold,
    exempt: false,
    due: data.loadStrain >= 1
  };
}
