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
 * Difficulties multiply as core multiplies them (an overlap of two regions at ×2 is ×4); a kind the
 * token's actor ignores never reaches here, because the behavior answers with no effect for that
 * token (research of 2026-11-05: `resolveTerrainEffects` never sees the token, so the per-token
 * decision belongs in the behavior).
 */

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
   * Multiply the difficulties as core does and collect the kinds crossed. Null when nothing is
   * difficult, as core returns null for a difficulty of 1.
   * @param {Array<{name: string, difficulty?: number, kind?: string}>} effects
   * @param {object} options
   * @returns {SwTerrainData|null}
   */
  static resolveTerrainEffects(effects, options) {
    let difficulty = 1;
    const kinds = [];
    for (const effect of effects ?? []) {
      if (effect?.name !== "difficulty") continue;
      const d = Number(effect.difficulty);
      if (Number.isFinite(d)) difficulty *= d;
      if (effect.kind && !kinds.includes(effect.kind)) kinds.push(effect.kind);
    }
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
