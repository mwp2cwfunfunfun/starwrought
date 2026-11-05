/**
 * SwActor: Conditions. The value of a numeric condition and the one-effect-per-condition write,
 * queued per actor on this client so two writes never race to create twins (0.5.1).
 */

import * as SW from "../../config.mjs";

/** Actor uuid -> the condition write in flight on this client, so they queue (see setCondition). */
const conditionWrites = new Map();

/** @param {typeof Actor} Base */
export const ConditionsMixin = Base => class extends Base {
  /**
   * The value of a numeric condition (Frightened 2, Slowed 1), or 0 if it is not on you. Wounded
   * reads the Wounds carried across every Zone (PHB v4.10: Wounds are per Zone, not a number).
   * @param {string} id  A key of SW.CONDITIONS.
   * @returns {number}
   */
  conditionValue(id) {
    if (id === "wounded") return this.woundCount;
    if (id === "dying") return this.system.dying ?? 0;
    if (!this.statuses?.has(id)) return 0;
    for (const effect of this.effects) {
      if (!effect.statuses?.has(id)) continue;
      const value = effect.getFlag(SW.SYSTEM_ID, "value");
      if (Number.isNumeric(value)) return Number(value);
    }
    return 1;
  }

  /**
   * Put a condition on, take it off, or set its value.
   *
   * One condition, one effect (0.5.1). Writes to one actor's conditions are run one after another
   * on this client, so a second call finds what the first created instead of creating its own; the
   * effect is created under the condition's static id (SW.statusEffectId), the id Foundry's token
   * palette creates and looks for, so a status set by the rules and one toggled from the token are
   * the same document and a create that loses a race with another client fails on the id rather
   * than landing a twin; and any twin that exists anyway (an older release's) is removed on the
   * way through.
   * @param {string} id
   * @param {number|boolean} [value]  A number for numeric conditions, true/false otherwise.
   * @param {object} [data]  Effect data to carry on it (name, description, origin, flags); applied
   *                         on creation and to an effect already there.
   * @returns {Promise<ActiveEffect|null>}  The effect carrying the condition, or null when off.
   */
  async setCondition(id, value = true, data = {}) {
    const config = SW.CONDITIONS[id];
    if (!config) return null;
    const prior = conditionWrites.get(this.uuid) ?? Promise.resolve();
    const run = prior.catch(() => null).then(() => this.#writeCondition(id, value, data));
    conditionWrites.set(this.uuid, run);
    try {
      return await run;
    } finally {
      if (conditionWrites.get(this.uuid) === run) conditionWrites.delete(this.uuid);
    }
  }

  /** One queued condition write; the rules are in setCondition's note. */
  async #writeCondition(id, value, data) {
    const config = SW.CONDITIONS[id];
    const staticId = SW.statusEffectId(id);
    // Foundry's own ownership rule for a status: the effect under its static id, or a single-status
    // effect. An authored effect carrying several statuses (a net that is Prone and Restrained
    // with a Speed change) is the GM's and is never deleted as a twin (review, 2026-10-01).
    const ours = e => e.statuses?.has(id) && ((e.id === staticId) || (e.statuses.size === 1));
    const matching = this.effects.filter(ours);
    const off = (value === false) || (config.numeric && Number(value) <= 0);

    if (off) {
      if (matching.length) await this.deleteEmbeddedDocuments("ActiveEffect", matching.map(e => e.id));
      return null;
    }

    // The one under the static id is the one the palette knows; any other goes.
    matching.sort((a, b) => (a.id === staticId ? -1 : 0) - (b.id === staticId ? -1 : 0));
    const [existing, ...twins] = matching;
    if (twins.length) await this.deleteEmbeddedDocuments("ActiveEffect", twins.map(e => e.id));

    const update = foundry.utils.deepClone(data ?? {});
    if (config.numeric) {
      const n = Number(value) || 1;
      update.name ??= `${game.i18n.localize(config.name)} ${n}`;
      foundry.utils.setProperty(update, `flags.${SW.SYSTEM_ID}.value`, n);
    }
    if (existing) {
      if (!foundry.utils.isEmpty(update)) await existing.update(update);
      return existing;
    }

    const source = foundry.utils.mergeObject({
      _id: staticId, name: game.i18n.localize(config.name), img: config.img, statuses: [id]
    }, update);
    try {
      const [created] = await this.createEmbeddedDocuments("ActiveEffect", [source], { keepId: true });
      return created ?? this.effects.get(staticId) ?? null;
    } catch (err) {
      // Another client got there first under the same id: that effect is the one to keep.
      const theirs = this.effects.get(staticId) ?? this.effects.find(ours);
      if (!theirs) throw err;
      return theirs;
    }
  }
};
