/**
 * Terrain on the map (0.15.0; ruling 178). Mike, 2026-11-05, on Riverfoot's "You ignore difficult
 * terrain from mud, decking, loose stone, and shallow water": "Let's build Difficult terrain INTO
 * the maps! using a region or some sort of method! so this can be automated. and players can
 * toggle layers to see what is difficult etc."
 *
 * A Difficult terrain region behavior (module/data/region-behaviors/difficult-terrain.mjs) carries
 * one of these kinds and a cost multiplier; a Talent's `ignore: Terrain, <Kind>, ...` line
 * (module/rules/kinds/ignore.mjs) names the same words, so the cell and the map share one
 * vocabulary. The colour is the player's overlay's (module/canvas/terrain.mjs). A kind is added
 * here and nowhere else.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

/** The kinds of difficult terrain, keyed by slug. `label` is an i18n key; `colour` the overlay's fill. */
export const TERRAIN_KINDS = Object.freeze({
  mud: { label: "STARWROUGHT.Terrain.kind.mud", colour: "#6b4a2b" },
  "shallow-water": { label: "STARWROUGHT.Terrain.kind.shallowWater", colour: "#2f7fb8" },
  decking: { label: "STARWROUGHT.Terrain.kind.decking", colour: "#9a7a4a" },
  "loose-stone": { label: "STARWROUGHT.Terrain.kind.looseStone", colour: "#7d7d7d" },
  rubble: { label: "STARWROUGHT.Terrain.kind.rubble", colour: "#5c5c5c" },
  undergrowth: { label: "STARWROUGHT.Terrain.kind.undergrowth", colour: "#3f7a3a" },
  snow: { label: "STARWROUGHT.Terrain.kind.snow", colour: "#cfe3f2" },
  ice: { label: "STARWROUGHT.Terrain.kind.ice", colour: "#9fd3e8" },
  sand: { label: "STARWROUGHT.Terrain.kind.sand", colour: "#d8b56a" },
  other: { label: "STARWROUGHT.Terrain.kind.other", colour: "#8a6fb0" }
});

/** The book's difficult terrain: every foot costs two. The behavior's default multiplier. */
export const DEFAULT_TERRAIN_DIFFICULTY = 2;

/**
 * The slug of a terrain kind written in a cell or a select: "Shallow Water", "shallow-water" and
 * "shallowwater" are one kind. Null when the word names none.
 * @param {string} word
 * @returns {string|null}
 */
export function terrainKindOf(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (Object.hasOwn(TERRAIN_KINDS, key)) return key;
  const squeezed = key.replace(/-/g, "");
  for (const slug of Object.keys(TERRAIN_KINDS)) {
    if (slug.replace(/-/g, "") === squeezed) return slug;
  }
  return null;
}

/** The kind's printed name for a message: "shallow-water" to "Shallow Water". */
export function terrainKindName(slug) {
  return String(slug ?? "").split("-").map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}
