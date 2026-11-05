/**
 * Degrees of success: the four bands, the attack outcomes they name, and the comparison.
 * A Defense roll is the same comparison read from the other side (`invertDegree`).
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * The four bands, named from the attacker's point of view. STARWROUGHT's signature change is
 * that "failure" is a Graze: reduced damage, and a Zone opens on the defender.
 */
export const DEGREES = Object.freeze({
  critFail: { label: "STARWROUGHT.Degree.critFail", attack: "miss", order: 0 },
  fail: { label: "STARWROUGHT.Degree.fail", attack: "graze", order: 1 },
  success: { label: "STARWROUGHT.Degree.success", attack: "hit", order: 2 },
  critSuccess: { label: "STARWROUGHT.Degree.critSuccess", attack: "critical", order: 3 }
});

export const DEGREE_ORDER = Object.freeze(["critFail", "fail", "success", "critSuccess"]);

/** Attack outcome labels, keyed by degree. */
export const ATTACK_OUTCOMES = Object.freeze({
  critFail: { label: "STARWROUGHT.Outcome.miss", key: "miss", damage: null },
  fail: { label: "STARWROUGHT.Outcome.graze", key: "graze", damage: "graze" },
  success: { label: "STARWROUGHT.Outcome.hit", key: "hit", damage: "hit" },
  critSuccess: { label: "STARWROUGHT.Outcome.critical", key: "critical", damage: "critical" }
});

/**
 * Compare a check total to a Threshold and return the degree.
 * A natural 20 steps the result up one band, a natural 1 steps it down.
 * @param {number} total
 * @param {number} threshold
 * @param {number|null} natural  The face of the d20, if it was a single d20 roll.
 * @returns {string} A key of DEGREES.
 */
export function degreeOf(total, threshold, natural = null) {
  const delta = total - threshold;
  let index;
  if (delta >= 10) index = 3;
  else if (delta >= 0) index = 2;
  else if (delta > -10) index = 1;
  else index = 0;
  if (natural === 20) index = Math.min(3, index + 1);
  else if (natural === 1) index = Math.max(0, index - 1);
  return DEGREE_ORDER[index];
}

/**
 * Invert a degree. A Defense roll is the same comparison read from the other side: beating an
 * Attack Threshold by 10 is a Miss for the attacker, missing it by 10 is their Critical Hit.
 * @param {string} degree
 * @returns {string}
 */
export function invertDegree(degree) {
  return DEGREE_ORDER[3 - DEGREE_ORDER.indexOf(degree)];
}
