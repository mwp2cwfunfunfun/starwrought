/**
 * Auras and reach rings on the map (0.5.1): who an aura concerns, and the colours the sheet's
 * swatch and the canvas share.
 * The colours are the stylesheet's tokens as strings; the canvas converts them.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Who an aura concerns. An ability's "within N feet" is drawn around its carrier, and the colour
 * says at a glance whether the ring is a gift to allies, a threat to enemies, or simply a distance.
 */
export const AURA_AUDIENCES = Object.freeze({
  all: { label: "STARWROUGHT.Field.auraAffectsAll" },
  allies: { label: "STARWROUGHT.Field.auraAffectsAllies" },
  enemies: { label: "STARWROUGHT.Field.auraAffectsEnemies" }
});

/**
 * The colour an aura is drawn in, by audience, as the "#rrggbb" strings the stylesheet's tokens
 * hold (--sw-green, --sw-blood, --sw-presence), so a swatch on the sheet and the ring on the map are
 * the same colour. A custom ring carries its own colour in this form, which is why these are strings
 * and not PIXI numbers; the canvas converts with Color.from.
 */
export const AURA_COLORS = Object.freeze({
  allies: "#5f9e6a",
  enemies: "#b4453f",
  all: "#c07ad8"
});

/**
 * The reach bands in the same form, keyed as the entries of `actor.system.ranges` are: Natural
 * Reach, Total Reach and the Unwieldy dead zone. They mirror the colours reach.mjs has always drawn.
 */
export const REACH_COLORS = Object.freeze({
  reach: "#7fb3c8",
  totalReach: "#e3b23c",
  unwieldy: "#b4453f"
});
