/**
 * SwActor: auras (0.5.1). A Talent's aura pinned visible or not, the marks cleared, and the GM's
 * custom auras on an actor. The drawing is canvas/auras.mjs; this is the record on the document.
 * Since 0.17.0 every ring is preview only until a mark lights it: the Item's `aura.visible` field
 * is gone and a custom ring is added unlit, so `system.auras.visible` is the one way a ring shows.
 */



/** @param {typeof Actor} Base */
export const AurasMixin = Base => class extends Base {
  /**
   * Mark a range Visible, or not. A Visible range is pinned on the map for everyone while an
   * encounter runs; the rest show only in the preview. The marks live on the actor
   * (`system.auras.visible[key]`; Mike: new tokens inherit them), so a flip reaches every client
   * as an ordinary actor update, and the owner and the GM can both make it.
   * @param {string|string[]} key  A range key (an Item id; `reach`, `totalReach` or `unwieldy`; a
   *                               custom ring's key), or several at once for one update.
   * @param {boolean} visible
   */
  async setAuraVisible(key, visible) {
    const keys = (Array.isArray(key) ? key : [key]).filter(k => (typeof k === "string") && k && !k.includes("."));
    if (!keys.length) return this;
    const updates = {};
    for (const k of keys) updates[`system.auras.visible.${k}`] = !!visible;
    return this.update(updates);
  }

  /**
   * Every mark unset: back to the default, in which every ring is preview only (0.17.0; through
   * 0.16.0 an ability's own Visible flag still counted). The GM's Clear control calls it on every
   * combatant.
   * @returns {Promise<boolean>}  True when there was something to clear.
   */
  async clearAuraMarks() {
    const marks = foundry.utils.getProperty(this._source, "system.auras.visible") ?? {};
    const keys = Object.keys(marks);
    if (!keys.length) return false;
    const updates = {};
    for (const k of keys) updates[`system.auras.visible.-=${k}`] = null;
    await this.update(updates);
    return true;
  }

  /**
   * Add a custom ring, preview only until lit (0.17.0; through 0.16.0 it was Visible from the
   * start): the "within 20 feet" the GM improvises mid-fight, or a player's own marker. `gmOnly`
   * hides it from players always.
   * @param {object} spec
   * @param {string} [spec.label]
   * @param {number} [spec.feet]
   * @param {"all"|"allies"|"enemies"} [spec.audience]
   * @param {string|null} [spec.color]  A CSS colour, or null for the audience's.
   * @param {boolean} [spec.gmOnly]
   * @returns {Promise<string>}  The new ring's key.
   */
  async addCustomAura({ label = "", feet = 0, audience = "all", color = null, gmOnly = false } = {}) {
    const key = `custom-${foundry.utils.randomID(8)}`;
    const custom = foundry.utils.deepClone(foundry.utils.getProperty(this._source, "system.auras.custom") ?? []);
    custom.push({
      key,
      label: String(label ?? ""),
      feet: Math.max(0, Number(feet) || 0),
      audience: ["all", "allies", "enemies"].includes(audience) ? audience : "all",
      color: color || null,
      gmOnly: !!gmOnly
    });
    await this.update({ "system.auras.custom": custom });
    return key;
  }

  /**
   * Take a custom ring off, and its mark with it.
   * @param {string} key
   */
  async removeCustomAura(key) {
    const custom = foundry.utils.deepClone(foundry.utils.getProperty(this._source, "system.auras.custom") ?? []);
    const next = custom.filter(c => c.key !== key);
    if (next.length === custom.length) return this;
    return this.update({ "system.auras.custom": next, [`system.auras.visible.-=${key}`]: null });
  }
};
