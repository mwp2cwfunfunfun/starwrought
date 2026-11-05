/**
 * Wind: the Wind Threshold against the Endure Threshold, and whether the round-end check is due.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.loadStrain (armor), data.defenses.endure (defenses).
 * Writes: data.wind.
 */

/**
 * Wind (PHB v4.13, Load and Load Strain; rulings 74, 79 and 80): "If your Load Strain is at
 * least 1 and your Endure Threshold is less than 10 + your Load Strain, then at the end of every
 * round while in an encounter, you must roll Endure against 10 + Load Strain. On a failure your
 * Fatigued rises by 1." So the Wind Threshold is 10 + Load Strain, and a fighter whose Endure
 * Threshold meets it is exempt: no check at all, however long the fight runs. The Endure
 * Threshold is the one the sheet shows, with everything the Defense pass folds in (Frightened
 * reaches it; Fatigued does not, so being winded never brings the next check nearer).
 *
 * Derived after Load Strain (prepareArmor) and the Defenses (prepareDefenses); that order
 * matters. `due` is whether the round-end check comes at all: Load Strain 1 or more, and no
 * exemption. A fighter carrying no Load has nothing to be winded by, whatever penalties sit on
 * their Endure; the system has kept that gate since 0.6.0 and v4.13 wrote it into the book
 * (ruling 80). The check comes from the end of round 1 (ruling 79; v4.11 and v4.12 waited for
 * the third round). `combat.mjs` reads `exempt` at the end of the round and the sheet's Load
 * Strain tooltip reads all of it (actor-sheet.mjs, windTip).
 */
export function prepareWind(data) {
  const threshold = 10 + data.loadStrain;
  const endureThreshold = data.defenses.endure?.threshold ?? 10;
  const exempt = endureThreshold >= threshold;
  data.wind = {
    threshold,
    endureThreshold,
    exempt,
    due: (data.loadStrain >= 1) && !exempt
  };
}
