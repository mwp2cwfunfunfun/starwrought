/**
 * The terrain a token's movement crosses, with its kinds (0.15.0; ruling 178; Terrain on the map).
 *
 * Foundry's `TerrainData` carries one number, `difficulty`, resolved from every region behavior's
 * `_getTerrainEffects` along a path; the Difficult terrain behavior of this system
 * (region-behaviors/difficult-terrain.mjs) adds a `kind` to its effect, and this subclass keeps
 * the kinds crossed beside the number, so the ruler can say "difficult: mud" and the move's card
 * can name what was waded through. Installed as `CONFIG.Token.movement.TerrainData` at init,
 * before the Token schema is built, since core embeds it in a token's movement history: it stays
 * plain data (a number and an array of strings).
 *
 * Overlapping difficulties combine as the book's Multipliers and Divisors do (0.26.0; PHB v4.25,
 * Chapter 8): each region is one effect, and two at ×2 are ×3, not the ×4 core's multiplication
 * gave through 0.25.0 (`SW.combineDifficulties`). A kind the token's actor ignores never reaches
 * here, because the behavior answers with no effect for that token (research of 2026-11-05:
 * `resolveTerrainEffects` never sees the token, so the per-token decision belongs in the behavior).
 */

import * as SW from "../config.mjs";

const fields = foundry.data.fields;

export class SwTerrainData extends foundry.data.TerrainData {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      kinds: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] })
    };
  }

  /**
   * Combine the difficulties (each region one effect: 1 plus every region's increase) and collect
   * the kinds crossed. Null when nothing is difficult, as core returns null for a difficulty of 1.
   * @param {Array<{name: string, difficulty?: number, kind?: string}>} effects
   * @param {object} options
   * @returns {SwTerrainData|null}
   */
  static resolveTerrainEffects(effects, options) {
    const difficulties = [];
    const kinds = [];
    for (const effect of effects ?? []) {
      if (effect?.name !== "difficulty") continue;
      difficulties.push(effect.difficulty);
      if (effect.kind && !kinds.includes(effect.kind)) kinds.push(effect.kind);
    }
    // Impassable is stored as null, as core's TerrainData stores it (its field takes no Infinity
    // and reads null back as Infinity).
    const combined = SW.combineDifficulties(difficulties);
    const difficulty = Number.isFinite(combined) ? combined : null;
    if ((difficulty === 1) && !kinds.length) return null;
    return new this({ difficulty, kinds: kinds.sort() });
  }

  /** @inheritdoc */
  equals(other) {
    if (!(other instanceof SwTerrainData)) return super.equals(other) && !this.kinds.length;
    if (this.difficulty !== other.difficulty) return false;
    if (this.kinds.length !== other.kinds.length) return false;
    return this.kinds.every((k, i) => k === other.kinds[i]);
  }
}
