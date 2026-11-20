/**
 * SwActor: Conditions. The value of a numeric condition and the one-effect-per-condition write,
 * queued per actor on this client so two writes never race to create twins (0.5.1).
 */

import * as SW from "../../config.mjs";
import { conditionPrevented } from "../../rules/prevent.mjs";
// 0.32.0: whether an effect still carries the application a window's end was decided on (pure).
import { sameApplication } from "../../rules/applied.mjs";
// 0.39.0: a Condition whose row says its value drops as rounds pass carries a clock
// (rules/clock.mjs), stamped here as the Condition goes on, is raised or is switched back on.
import { CLOCK_FLAG, clockOf, fadeOf, sameClock } from "../../rules/clock.mjs";
import { momentIn } from "../../rules/scene.mjs";

/**
 * The started Combat a creature is a fighter in, by MEMBERSHIP and never by what this client
 * views (the rule of `runningCombat` in documents/cards/apply.mjs): the viewed one first, then
 * any other. Null outside a running encounter.
 */
function fightOf(actor) {
  const fights = combat => !!combat?.started && ((combat.getCombatantsByActor?.(actor)?.length ?? 0) > 0);
  const viewed = globalThis.game?.combat ?? null;
  if (fights(viewed)) return viewed;
  for (const combat of globalThis.game?.combats ?? []) if (fights(combat)) return combat;
  return null;
}

/**
 * The clock a Condition takes as it goes ON (0.39.0; rulings 393, 394 and 398): where in the
 * fight that is, for a Condition whose row says its own value drops as rounds pass
 * (`UNTIL: each round -1`). Null for a Condition with no such line, and for a creature that is
 * no fighter in a running encounter, where no rounds pass (ruling 399).
 *
 * `stored` is the moment a Maneuver was USED, as its check card kept it (ruling 400; the review
 * of 0.39.0): a Condition put on by a card's button, pressed late, is counted from the use and
 * not from the press, as a window in rounds is. It stands when it is of a Combat this creature
 * is fighting in; else the count is from now.
 * @param {Actor} actor
 * @param {string} id  A key of SW.CONDITIONS.
 * @param {{combat?: string, anchor?: string|null, init?: number|null, round?: number}|null} [stored]
 * @returns {object|null}
 */
export function conditionClockFor(actor, id, stored = null) {
  const config = SW.CONDITIONS[id];
  if (!config?.numeric || !fadeOf(config.rules)) return null;
  const fights = combat => !!combat?.started && ((combat.getCombatantsByActor?.(actor)?.length ?? 0) > 0);
  const named = stored?.combat ? (globalThis.game?.combats?.get(stored.combat) ?? null) : null;
  const combat = fights(named) ? named : fightOf(actor);
  const moment = momentIn(combat, stored);
  if (!moment) return null;
  // The holder: the Combatant this creature fights as. A clock counts only while it is one of
  // the creature's Combatants (rules/clock.mjs, `clockRuns`).
  return clockOf(moment, combat.getCombatantsByActor(actor)[0]?.id ?? null);
}

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
   * @param {object} [options]
   * @param {boolean} [options.force]  Write it whatever the Automation rules say (0.13.0): a
   *                         `prevent` rule on the body or on an ally in reach (Stubborn Footing's
   *                         Prone, once each encounter) otherwise stops a Condition going ON, with a
   *                         card saying which Talent did; off is never prevented, and a Zone's
   *                         Exposed mirror is the Zone's, answered at the Expose offer instead.
   * @param {boolean} [options.applied]  The write is an `APPLY` line's (0.32.0): the Condition
   *                         goes on only when it is ABSENT, or when the effect already there was
   *                         itself applied (its `flags.starwrought.applied`), which is then given
   *                         the new record. An effect put on by any other means (the GM's hand, a
   *                         Critical Hit, a Bind) is returned untouched: without this `data` is
   *                         merged onto whatever is there, which would stamp the GM's own Off-Guard
   *                         and let a window take it off. Decided inside the write queue, so a
   *                         write that lands between the caller's look and this one is seen.
   *                         An effect that is SWITCHED OFF is not on: it is switched on again and
   *                         becomes the line's.
   * @param {boolean} [options.raise]  For a Condition with a value (0.32.0, ruling 317): the
   *                         value is written only when that RAISES it, decided inside the queue,
   *                         so two writes in one moment never leave the lower one standing. A
   *                         Condition already on is raised and keeps whose it was (the record in
   *                         `data` is dropped); one put on fresh carries the record.
   * @param {object|null} [options.only]  For a Condition going OFF (0.32.0): take it off only
   *                         while its effect still carries THIS applied record. A window's end
   *                         passes the record its verdict was made on, so a later APPLY that
   *                         refreshed the Condition a moment ago keeps it.
   * @param {number} [options.drop]  For a Condition with a value (0.39.0): LOWER it by this
   *                         much, whatever `value` says, and take it off at 0. Decided inside
   *                         the queue on the value it has THEN, so a drop and a raise in one
   *                         moment never write over each other. Touches only an effect that
   *                         is switched on; `data` (the clock, as it now stands) rides on it.
   * @param {object|null} [options.from]  With `drop`: the clock the drop was worked out from.
   *                         The drop lands only while the effect still carries THAT clock at
   *                         that count, so a raise or another drop that landed first is never
   *                         undone or doubled (the review of 0.39.0).
   * @param {object|null} [options.moment]  The moment a Maneuver was used, as its card kept it
   *                         (ruling 400): what the Condition's clock is counted from when this
   *                         write puts it on, or raises it. With none, now.
   * @returns {Promise<ActiveEffect|null>}  The effect carrying the condition, or null when off or prevented.
   */
  async setCondition(id, value = true, data = {}, { force = false, applied = false, raise = false, only = null, drop = 0, from = null, moment = null } = {}) {
    const config = SW.CONDITIONS[id];
    if (!config) return null;
    const turningOn = !drop && !((value === false) || (config.numeric && Number(value) <= 0));
    if (turningOn && !force && !config.zone && !this.statuses?.has(id)) {
      const prevented = await conditionPrevented(this, id).catch(err => {
        console.error(`STARWROUGHT | ${this.name}: the prevent rules could not be read for ${id}`, err);
        return null;
      });
      if (prevented) return null;
    }
    const prior = conditionWrites.get(this.uuid) ?? Promise.resolve();
    const run = prior.catch(() => null).then(() => this.#writeCondition(id, value, data, { applied, raise, only, drop, from, moment }));
    conditionWrites.set(this.uuid, run);
    try {
      return await run;
    } finally {
      if (conditionWrites.get(this.uuid) === run) conditionWrites.delete(this.uuid);
    }
  }

  /** One queued condition write; the rules are in setCondition's note. */
  async #writeCondition(id, value, data, { applied = false, raise = false, only = null, drop = 0, from = null, moment = null } = {}) {
    const config = SW.CONDITIONS[id];
    const staticId = SW.statusEffectId(id);
    // Foundry's own ownership rule for a status: the effect under its static id, or a single-status
    // effect. An authored effect carrying several statuses (a net that is Prone and Restrained
    // with a Speed change) is the GM's and is never deleted as a twin (review, 2026-10-01).
    const ours = e => e.statuses?.has(id) && ((e.id === staticId) || (e.statuses.size === 1));
    const matching = this.effects.filter(ours);

    // A DROP (0.39.0): the Condition's own value falling as rounds pass. Read off the effect as
    // it is now, inside the queue; an effect that is switched off is not on the creature and is
    // left as it is, and a Condition held only through an authored effect of several statuses
    // has no value of its own to lower.
    if (drop) {
      if (!config.numeric) return null;
      const live = matching.filter(e => !e.disabled);
      const target = live.find(e => e.id === staticId) ?? live[0] ?? null;
      if (!target) return null;
      // Only on the clock the tick was worked out from: a raise queued ahead of this has given
      // the Condition a new clock, and a second sweep's drop has moved the count.
      if (from && !sameClock(target.getFlag(SW.SYSTEM_ID, CLOCK_FLAG), from)) return target;
      const current = Number(target.getFlag(SW.SYSTEM_ID, "value")) || 1;
      const next = current - Math.max(1, Math.trunc(Number(drop) || 1));
      if (next <= 0) {
        await this.deleteEmbeddedDocuments("ActiveEffect", [target.id], { swAnnounced: true });
        return null;
      }
      const lowered = foundry.utils.deepClone(data ?? {});
      lowered.name = `${game.i18n.localize(SW.conditionNameKey(id))} ${next}`;
      foundry.utils.setProperty(lowered, `flags.${SW.SYSTEM_ID}.value`, next);
      await target.update(lowered, { swAnnounced: true });
      return target;
    }

    const off = (value === false) || (config.numeric && Number(value) <= 0);

    if (off) {
      // `only` (0.32.0): a window's end, which goes ahead only for an effect that still carries
      // the application it was decided on.
      const going = only ? matching.filter(e => sameApplication(e.getFlag(SW.SYSTEM_ID, "applied"), only)) : matching;
      if (going.length) await this.deleteEmbeddedDocuments("ActiveEffect", going.map(e => e.id));
      return null;
    }

    // The one under the static id is the one the palette knows; any other goes.
    matching.sort((a, b) => (a.id === staticId ? -1 : 0) - (b.id === staticId ? -1 : 0));
    const [existing, ...twins] = matching;
    if (twins.length) await this.deleteEmbeddedDocuments("ActiveEffect", twins.map(e => e.id));

    const update = foundry.utils.deepClone(data ?? {});
    if (config.numeric) {
      const n = Number(value) || 1;
      update.name ??= `${game.i18n.localize(SW.conditionNameKey(id))} ${n}`;
      foundry.utils.setProperty(update, `flags.${SW.SYSTEM_ID}.value`, n);
    }
    if (existing) {
      // An effect that is switched off (the Effects tab's toggle) is not ON the creature:
      // `actor.statuses` leaves it out. Any write that puts the Condition on switches it on again
      // (0.32.0; through 0.31.0 the data was merged and the effect stayed off, so the caller
      // believed a Condition was on that was not).
      const live = !existing.disabled;
      // An APPLY line's write (0.32.0) leaves alone a Condition that anything else put on.
      if (applied && live && !existing.getFlag(SW.SYSTEM_ID, "applied")) return existing;
      // A value is only ever raised by an APPLY (ruling 317), and a Condition already on keeps
      // whose it was.
      if (raise && live && config.numeric) {
        const current = Number(existing.getFlag(SW.SYSTEM_ID, "value")) || 1;
        if (current >= (Number(value) || 1)) return existing;
        if (update.flags?.[SW.SYSTEM_ID]) delete update.flags[SW.SYSTEM_ID].applied;
      }
      // THE CLOCK STARTS AGAIN (0.39.0, ruling 398) when the Condition is switched back on, and
      // when its value is RAISED: "counted when it was applied". A value lowered, or written as
      // it was, keeps the clock it has.
      const before = live ? (Number(existing.getFlag(SW.SYSTEM_ID, "value")) || 1) : 0;
      const rising = !live || (config.numeric && ((Number(value) || 1) > before));
      if (rising && !foundry.utils.hasProperty(update, `flags.${SW.SYSTEM_ID}.${CLOCK_FLAG}`)) {
        const clock = conditionClockFor(this, id, moment);
        if (clock) foundry.utils.setProperty(update, `flags.${SW.SYSTEM_ID}.${CLOCK_FLAG}`, clock);
      }
      if (!live) update.disabled = false;
      if (!foundry.utils.isEmpty(update)) await existing.update(update);
      return existing;
    }

    // A Condition that goes on fresh takes its clock here (0.39.0), in the fight it goes on in.
    if (!foundry.utils.hasProperty(update, `flags.${SW.SYSTEM_ID}.${CLOCK_FLAG}`)) {
      const clock = conditionClockFor(this, id, moment);
      if (clock) foundry.utils.setProperty(update, `flags.${SW.SYSTEM_ID}.${CLOCK_FLAG}`, clock);
    }
    const source = foundry.utils.mergeObject({
      _id: staticId, name: game.i18n.localize(SW.conditionNameKey(id)), img: config.img, statuses: [id]
    }, update);
    try {
      // `swChecked`: the prevent rules were asked above, so the preCreateActiveEffect hook that
      // asks for the token palette's path (starwrought.mjs) does not ask again.
      const [created] = await this.createEmbeddedDocuments("ActiveEffect", [source], { keepId: true, swChecked: true });
      return created ?? this.effects.get(staticId) ?? null;
    } catch (err) {
      // Another client got there first under the same id: that effect is the one to keep.
      const theirs = this.effects.get(staticId) ?? this.effects.find(ours);
      if (!theirs) throw err;
      return theirs;
    }
  }
};
