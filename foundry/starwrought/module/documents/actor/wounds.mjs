/**
 * SwActor: the body. Wounds per Zone and their capacity, the rigid implement in hand, taking a Wound
 * (PHB v4.10, Wounds), going down and coming back: Dying, the Recovery check at the start of a round,
 * refusing death with a Hero Point, and treating a Wound (Medicine).
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/** @param {typeof Actor} Base */
export const WoundsMixin = Base => class extends Base {
  /** Wounds carried across every Zone. Recovery and Treat Wound Thresholds count them all. */
  get woundCount() {
    if (Number.isNumeric(this.system.woundCount)) return this.system.woundCount;
    return Object.values(this.system.zones ?? {}).reduce((n, z) => n + (z?.wounds ?? 0), 0);
  }

  /**
   * How many Wounds a Zone carries before its final effect: Medium or smaller 2, Large 3, Huge 4,
   * Gargantuan 5, plus whatever a creature template adds (PHB v4.10, Wound capacity).
   * @param {string} zone
   * @returns {number}
   */
  woundCapacity(zone) {
    const derived = this.system.woundCapacity?.(zone);
    if (Number.isNumeric(derived)) return derived;
    return (SW.WOUND_CAPACITY[this.system.size] ?? 2) + (this.system.woundBonus ?? 0);
  }

  /**
   * The rigid implement in hand, if any: what a Guard forms a Bind with and what a Parry needs.
   * A shield counts, raised or not; a weapon counts unless it is Flexible or a bare hand
   * (PHB v4.10, The Bind: "a bare hand or a Flexible weapon can Guard, but cannot Bind"). An
   * adversary's profile decides for it, so an adversary is assumed to have one: the card offers
   * the Bind and the GM confirms.
   * @returns {{name: string, shield?: boolean, raised?: boolean, assumed?: boolean}|null}
   */
  get rigidImplement() {
    if (this.type !== "character") return { name: "", assumed: true };
    // The data model's own answer, when it has one, wins over the item scan below.
    if (this.system.reactions?.rigid === false) return null;
    const shield = this.items.find(i => (i.type === "shield") && i.system.held);
    if (shield) return { name: shield.name, shield: true, raised: !!shield.system.raised };
    const isRigid = i => (typeof i.system.rigid === "boolean") ? i.system.rigid : !i.system.flags?.flexible;
    const weapon = this.items.find(i => (i.type === "weapon") && i.system.held
      && isRigid(i)
      && !/natural/i.test(i.system.group ?? ""));
    return weapon ? { name: weapon.name } : null;
  }

  /**
   * Take Wounds on a Zone (PHB v4.10, Wounds). Each fills the Zone toward its capacity; a further
   * Wound to a useless Arm or Leg goes to the Torso instead. The first Wound has the Zone's first
   * effect, every one short of the last repeats it, and the last has the final effect: a useless
   * arm, a fall you cannot Stand from, or, for the Torso and the Head, Dying. Taking a Wound
   * abandons a Prepared Maneuver.
   * @param {string} zone
   * @param {number} [n=1]
   * @param {object} [options]
   * @param {boolean} [options.critical]  The blow was a Critical Hit (Dying starts at 2).
   * @param {string[]} [options.reasons]  i18n keys saying why, for the card.
   * @returns {Promise<object|null>}
   */
  async applyWound(zone, n = 1, { critical = false, reasons = [] } = {}) {
    if (!(zone in SW.ZONES)) zone = SW.DEFAULT_ZONE;
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n) return null;

    const current = {};
    for (const z of Object.keys(SW.ZONES)) current[z] = this.system.zones?.[z]?.wounds ?? 0;
    const updates = {};
    const landed = [];
    let dyingFrom = null;

    let overflow = false;
    for (let i = 0; i < n; i++) {
      let z = zone;
      // A further Wound to a useless Arm or Leg goes to the Torso instead.
      if (["arms", "legs"].includes(z) && (current[z] >= this.woundCapacity(z))) z = "torso";
      const capacity = this.woundCapacity(z);
      // A Torso or Head already at capacity has nothing left to mark: the body is Dying, or Dying
      // again (1, or 2 on a Critical Hit) if it had been brought back.
      if (current[z] >= capacity) {
        overflow = true;
        dyingFrom = z;
        continue;
      }
      current[z] += 1;
      updates[`system.zones.${z}.wounds`] = current[z];
      const final = current[z] >= capacity;
      const rules = SW.ZONE_CRITICALS[z];
      landed.push({
        zone: z,
        zoneLabel: game.i18n.localize(SW.ZONES[z].label),
        fromLabel: game.i18n.localize(SW.ZONES[zone].label),
        count: current[z],
        capacity,
        final,
        effect: game.i18n.localize(final ? rules.final : rules.first),
        bleed: (z === "torso") && !final ? SW.TORSO_WOUND_BLEED : null,
        redirected: z !== zone
      });
      if (final && rules.finalDying) dyingFrom = z;
    }
    if (!landed.length && !overflow) return null;

    if (landed.length) {
      await this.update(updates);
      await this.setCondition("wounded", true);
    }

    // Taking a Wound abandons preparation automatically; Vigor damage does not.
    if (this.system.actions?.preparing) await this.abandonPrepared({ reason: "wound" });

    // Legs, final: you fall Prone and cannot Stand.
    if (landed.some(w => (w.zone === "legs") && w.final)) await this.setCondition("prone", true);

    // Torso or Head, final: Dying (Head: and unconscious, which Dying already is).
    if (dyingFrom) await this.beginDying({ critical });

    const content = await renderTemplate("systems/starwrought/templates/chat/wound-card.hbs", {
      actor: this,
      landed,
      reasons: reasons.map(r => game.i18n.localize(r)),
      total: this.woundCount,
      dying: this.system.dying ?? 0,
      dyingFrom: dyingFrom ? game.i18n.localize(SW.ZONES[dyingFrom].label) : null,
      abandoned: false
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });

    return { zone, landed, total: this.woundCount, dying: this.system.dying ?? 0, dyingFrom };
  }

  /**
   * The sheet's Wound stepper, for a player or the GM (0.5.3; Mike: "player and GM should be able
   * to change Wounds, and log to chat"). Adding goes through `applyWound`, so everything a Wound
   * does fires and its card says it was marked by hand; taking one off is bookkeeping with no
   * check behind it, written silently for the audit and said in its own card. Dying, Prone and a
   * Zone's effects are not unwound by a removal: a corrected Wound is the table's to tidy after.
   * @param {string} zone
   * @param {number} delta  +1 or -1 from the stepper; any integer works.
   * @returns {Promise<object|null>}
   */
  async adjustWounds(zone, delta) {
    if (!(zone in SW.ZONES)) return null;
    delta = Math.trunc(Number(delta) || 0);
    if (!delta) return null;
    if (delta > 0) return this.applyWound(zone, delta, { reasons: ["STARWROUGHT.Wound.reasonHand"] });

    const current = this.system.zones?.[zone]?.wounds ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return null;
    await this.update({ [`system.zones.${zone}.wounds`]: next }, { swAnnounced: true });
    // Wounded is also a token condition: on while any Zone carries a Wound.
    const any = Object.keys(SW.ZONES).some(z => (this.system.zones?.[z]?.wounds ?? 0) > 0);
    await this.setCondition("wounded", any);

    const zoneLabel = game.i18n.localize(SW.ZONES[zone].label);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-wound-removed">
        <h3><i class="fa-solid fa-bandage"></i> ${game.i18n.localize("STARWROUGHT.Wound.removedTitle")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Wound.removedText", {
          name: foundry.utils.escapeHTML(this.name), zone: zoneLabel, count: next,
          capacity: this.woundCapacity(zone), by: foundry.utils.escapeHTML(game.user.name)
        })}</p></div>`,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
    return { zone, wounds: next, total: this.woundCount };
  }

  /**
   * Dying begins when the Torso or the Head takes its final Wound: Dying 1, or 2 if the blow was
   * a Critical Hit. Unconscious and helpless while it lasts (PHB v4.10, Dying).
   * @param {object} [options]
   * @param {boolean} [options.critical]
   */
  async beginDying({ critical = false } = {}) {
    const start = critical ? 2 : 1;
    const dying = Math.min(SW.DYING_MAX, Math.max(this.system.dying ?? 0, start));
    await this.update({ "system.dying": dying }, { swAnnounced: true });
    await this.setCondition("dying", dying);
    await this.setCondition("unconscious", true);
    if (this.system.actions?.preparing) await this.abandonPrepared({ reason: "wound" });
    if (dying >= SW.DYING_MAX) await this.#die();
    else ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.dying", { name: this.name, value: dying }));
  }

  /** Taking damage while Dying increases the value by 1, or by 2 from a Critical Hit. */
  async increaseDying(amount = 1) {
    const dying = Math.min(SW.DYING_MAX, (this.system.dying ?? 0) + amount);
    await this.update({ "system.dying": dying }, { swAnnounced: true });
    await this.setCondition("dying", dying);
    if (dying >= SW.DYING_MAX) await this.#die();
  }

  /**
   * Dying ends. Conscious with the Vigor given (at least 1) when healed or on a critical Recovery;
   * stable and still unconscious when the value simply reaches 0. Wounds remain: v4.10 has no
   * Wounded increment on the way back up.
   * @param {object} [options]
   * @param {boolean} [options.conscious]
   * @param {number} [options.vigor]
   */
  async endDying({ conscious = false, vigor = 0, hp = 0 } = {}) {
    const updates = { "system.dying": 0 };
    if (conscious) updates["system.vigor.value"] = Math.max(1, Number(vigor) || Number(hp) || 0);
    await this.update(updates, { swAnnounced: true });
    await this.setCondition("dying", 0);
    if (conscious) {
      await this.setCondition("unconscious", false);
      await this.setCondition("spent", false);
    }
  }

  async #die() {
    await this.setCondition("dead", true);
    ui.notifications.error(game.i18n.format("STARWROUGHT.Notify.dead", { name: this.name }));
  }

  /**
   * A Recovery check (PHB v4.10): at the start of each round while Dying, Endure against 10 + your
   * Dying value + the Wounds you carry. It costs no action. Critical success ends Dying, conscious
   * with 1 Vigor; success drops Dying by 1 (0 is stable, still unconscious); failure raises it by
   * 1; critical failure by 2. An adjacent ally's ❶ of help is the dialog's +2 Situation.
   */
  async rollRecovery() {
    if (!this.system.dying) {
      ui.notifications.info(game.i18n.localize("STARWROUGHT.Notify.notDying"));
      return null;
    }
    const wounds = this.woundCount;
    const threshold = SW.RECOVERY_BASE + this.system.dying + wounds;
    const result = await SwCheck.roll({
      actor: this,
      kind: "check",
      slug: SW.DEFENSES.endure.slug,
      label: game.i18n.localize("STARWROUGHT.Roll.recovery"),
      subtitle: game.i18n.format("STARWROUGHT.Roll.recoveryHint", { value: this.system.dying, wounds }),
      threshold,
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.recoveryThreshold")
    });
    if (!result) return null;

    switch (result.degree) {
      case "critSuccess":
        await this.endDying({ conscious: true, vigor: 1 });
        break;
      case "success": {
        const dying = this.system.dying - 1;
        if (dying <= 0) await this.endDying({ conscious: false });
        else await this.update({ "system.dying": dying }, { swAnnounced: true }).then(() => this.setCondition("dying", dying));
        break;
      }
      case "fail":
        await this.increaseDying(1);
        break;
      case "critFail":
        await this.increaseDying(2);
        break;
    }
    return result;
  }

  /**
   * Refusing Death. Not a roll: it cannot fail, and nothing in the game can stop it. Dying drops
   * to 0; unconscious and stable at 0 Vigor (Spent); the Wounds remain; every Hero Point is spent.
   */
  async refuseDeath() {
    if (!this.system.heroPoints?.value) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noHeroPoints"));
      return;
    }
    // Only the Dying refuse death (0.5.1, T13): the button is disabled otherwise, and a macro
    // that reaches here anyway is told why nothing happened.
    if (!((this.system.dying ?? 0) > 0)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Roll.refuseDeathNotDying"));
      return;
    }
    await this.update({
      "system.dying": 0,
      "system.vigor.value": 0,
      "system.heroPoints.value": 0
    }, { swAnnounced: true });
    await this.setCondition("dying", 0);
    await this.setCondition("dead", false);
    await this.setCondition("unconscious", true);
    await this.setCondition("spent", true);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought refuse-death"><h3>${game.i18n.localize("STARWROUGHT.Roll.refuseDeath")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Roll.refuseDeathText", { name: this.name })}</p></div>`
    });
  }

  /**
   * Treat a Wound (PHB v4.10): ten minutes and an Endure check against 10 + the Wounds the patient
   * carries. On a success the Wound is bound: its effect ends. The book keeps a bound Wound on the
   * count for a week; the system takes it off the Zone and says so on the card, which is the
   * simplification the sync brief asked for.
   * @param {string} zone
   * @param {object} [options]
   * @param {Actor} [options.healer]  Who rolls. Defaults to a selected token that is not the
   *                                  patient, then to the patient.
   */
  async treatWound(zone, { healer = null } = {}) {
    if (!(zone in SW.ZONES)) return null;
    const wounds = this.system.zones?.[zone]?.wounds ?? 0;
    if (!wounds) {
      ui.notifications.info(game.i18n.format("STARWROUGHT.Wound.none", {
        name: this.name, zone: game.i18n.localize(SW.ZONES[zone].label)
      }));
      return null;
    }
    const medic = healer
      ?? canvas?.tokens?.controlled?.map(t => t.actor).find(a => a && (a.id !== this.id) && a.isOwner)
      ?? this;
    const threshold = SW.TREAT_WOUND_BASE + this.woundCount;
    const zoneLabel = game.i18n.localize(SW.ZONES[zone].label);
    const result = await SwCheck.roll({
      actor: medic,
      kind: "check",
      slug: SW.DEFENSES.endure.slug,
      label: game.i18n.localize("STARWROUGHT.Wound.treat"),
      subtitle: `${this.name}: ${zoneLabel} · ${game.i18n.format("STARWROUGHT.Wound.count", { n: this.woundCount })}`,
      threshold,
      thresholdLabel: game.i18n.localize("STARWROUGHT.Wound.treatThreshold")
    });
    if (!result) return null;

    const success = ["success", "critSuccess"].includes(result.degree);
    if (success) {
      await this.update({ [`system.zones.${zone}.wounds`]: wounds - 1 });
      if (!this.woundCount) await this.setCondition("wounded", false);
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: medic }),
      content: `<div class="starwrought action-card"><h3><i class="fa-solid fa-bandage"></i> ${
        game.i18n.localize("STARWROUGHT.Wound.treat")}</h3>
        <p>${game.i18n.format(success ? "STARWROUGHT.Wound.treated" : "STARWROUGHT.Wound.notTreated", {
          healer: medic.name, name: this.name, zone: zoneLabel
        })}</p></div>`
    });
    return result;
  }
};
