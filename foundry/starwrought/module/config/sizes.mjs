/**
 * Creature sizes, cover and detection: the body in space and in sight.
 * COVER and DETECTION are the book's tables and nothing acts on them yet; they wait here for
 * the feature, as rules constants do.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Creature sizes. The grid is 1 foot, so `space` is the token footprint in feet and `reach`
 * is Natural Reach, to which a weapon's own Reach is added. Since PHB v4.21 (Size and Defenses)
 * size only penalises: the small are harder to brace (-1 Guard, Tiny -2) and the large harder to
 * slip (-1 Evade, Huge -2; Gargantuan keeps Huge's, ruling 139); Medium is 0 both ways, and nobody
 * gains anything. Through v4.15 Tiny had +2 Evade and Huge +2 Guard.
 */
export const SIZES = Object.freeze({
  tiny: { label: "STARWROUGHT.Size.tiny", space: 1, reach: 0, evade: 0, guard: -2 },
  small: { label: "STARWROUGHT.Size.small", space: 2, reach: 1, evade: 0, guard: -1 },
  medium: { label: "STARWROUGHT.Size.medium", space: 3, reach: 2, evade: 0, guard: 0 },
  large: { label: "STARWROUGHT.Size.large", space: 5, reach: 4, evade: -1, guard: 0 },
  huge: { label: "STARWROUGHT.Size.huge", space: 10, reach: 8, evade: -2, guard: 0 },
  gargantuan: { label: "STARWROUGHT.Size.gargantuan", space: 15, reach: 12, evade: -2, guard: 0 }
});

/** Cover grades, by the number of Zones the obstacle stands in front of. */
export const COVER = Object.freeze({
  none: { label: "STARWROUGHT.Cover.none", zones: 0, bonus: 0 },
  lesser: { label: "STARWROUGHT.Cover.lesser", zones: 1, bonus: 1 },
  standard: { label: "STARWROUGHT.Cover.standard", zones: 2, bonus: 2 },
  greater: { label: "STARWROUGHT.Cover.greater", zones: 3, bonus: 4 },
  total: { label: "STARWROUGHT.Cover.total", zones: 4, bonus: null }
});

/** Detection states, worst-known to best-known from the observer's point of view. */
export const DETECTION = Object.freeze({
  observed: { label: "STARWROUGHT.Detection.observed", bonus: 0, order: 3 },
  concealed: { label: "STARWROUGHT.Detection.concealed", bonus: 2, order: 2 },
  hidden: { label: "STARWROUGHT.Detection.hidden", bonus: 4, order: 1 },
  undetected: { label: "STARWROUGHT.Detection.undetected", bonus: 4, order: 0 }
});
