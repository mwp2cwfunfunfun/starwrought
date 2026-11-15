/**
 * SwActor: Zones and Position. Recenter, a Zone Exposed (by a Posture until the end of the round,
 * else until Recenter), ground given after a Graze, and the Step an Exchange grants.
 */

import * as SW from "../../config.mjs";

/** @param {typeof Actor} Base */
export const PositionMixin = Base => class extends Base {
  /**
   * Recenter ❶ (PHB v4.10): gather yourself, clear every Exposed Zone on you (except one Exposed
   * by a Posture, which lasts to the end of the round) and end any Bind you are in. Since 0.26.0
   * it also ends every Zone's Critical Hit effect (PHB v4.25: each lasts "until it Recenters"),
   * the Torso's Off-Guard with them, and the card names the ones it ended.
   */
  async recenter() {
    // A Maneuver: outside this actor's Opportunity it waits for the GM (0.19.0).
    if (!(await this.mayActNow({ label: game.i18n.localize("STARWROUGHT.Action.recenter") }))) return null;
    // The card below carries the actions-left line, so the spend itself posts nothing.
    await this.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.recenter"), announce: false });
    const updates = {};
    let kept = 0;
    const ended = [];
    for (const zone of Object.keys(SW.ZONES)) {
      if (this.system.zones?.[zone]?.critical) {
        updates[`system.zones.${zone}.critical`] = false;
        ended.push(zone);
      }
      if (this.system.zones?.[zone]?.postureExposed) { kept++; continue; }
      updates[`system.zones.${zone}.exposed`] = false;
    }
    await this.update(updates, { swAnnounced: true });
    // The Torso's effect is Off-Guard, the condition: the one the Critical Hit put on goes with
    // the effect. (A Torso Wound's Off-Guard is the Wound's own, read off the Zone, and stays; so
    // does an Off-Guard that was there before the Critical Hit landed.)
    if (ended.includes("torso")) await this._endCriticalOffGuard();
    const hadBind = !!this.system.bind?.state;
    if (hadBind) await this.endBind({ announce: false });
    const endedLine = ended.length
      ? " " + game.i18n.format("STARWROUGHT.Action.recenterCritical", {
        zones: ended.map(zone => game.i18n.localize(SW.ZONES[zone].label)).join(", ")
      })
      : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3><span class="sw-spend-glyph">❶</span> ${game.i18n.localize("STARWROUGHT.Action.recenter")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Action.recenterText", { name: this.name })}${endedLine}${
          kept ? " " + game.i18n.localize("STARWROUGHT.Action.recenterPosture") : ""}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`
    });
  }

  /**
   * Set or end one Zone's Critical Hit effect (0.26.0; PHB v4.25, the Critical Hit Effect table).
   * The Zone is the record; the Arms' -2 to Attack rolls, the Legs' halved Speed and the Head's
   * lost Reactions are derived from it, and the Torso's Off-Guard is the condition, set and
   * cleared with it. The damage pipeline sets it on a Critical Hit, Recenter clears it, and the
   * sheet's switch does either (a GM ruling that an area Attack's Critical Hit gains no such
   * effect, which the system cannot tell).
   * @param {string} zone
   * @param {boolean} [on=true]
   *
   * The Torso's Off-Guard is the Critical Hit's OWN: put on only when the body is not Off-Guard
   * already, flagged as the Critical Hit's (`flags.starwrought.criticalHit`), and taken off again
   * only when it carries that flag, so an Off-Guard the GM set from the token palette for another
   * reason outlives the Recenter. A Talent that prevents Off-Guard prevents the Torso's effect with
   * it: the Zone is not marked.
   * @param {object} [options]
   * @param {boolean} [options.announced=false]  The caller's card already says it (the damage
   *   card). A switch by hand is left to the audit, which says it as it says a Zone Exposed.
   */
  async setCriticalEffect(zone, on = true, { announced = false } = {}) {
    if (!(zone in SW.ZONES)) return;
    const want = !!on;
    if (zone === "torso") {
      if (!want) await this._endCriticalOffGuard();
      else if (!this.statuses?.has("offGuard")) {
        const effect = await this.setCondition("offGuard", true, { flags: { [SW.SYSTEM_ID]: { criticalHit: true } } });
        if (!effect) return this.system.zones?.[zone];
      }
    }
    if (!!this.system.zones?.[zone]?.critical !== want) {
      await this.update({ [`system.zones.${zone}.critical`]: want }, { swAnnounced: !!announced });
    }
    return this.system.zones?.[zone];
  }

  /** Take off the Off-Guard a Torso Critical Hit put on, and no other. */
  async _endCriticalOffGuard() {
    const ours = this.effects.some(e => e.statuses?.has("offGuard") && e.getFlag(SW.SYSTEM_ID, "criticalHit"));
    if (ours) await this.setCondition("offGuard", false);
  }

  /**
   * Open or close one Zone. A Zone Exposed by a Posture is marked so Recenter leaves it alone.
   * @param {string} zone
   * @param {boolean} [exposed=true]
   * @param {object} [options]
   * @param {boolean} [options.posture=false]
   * @param {boolean} [options.announced]  The caller's card already says it (a Posture's reveal,
   *                                        a Position offer), so the audit stays quiet (0.5.1,
   *                                        T10). Defaults to `posture`; a sheet toggle is announced.
   * @param {boolean} [options.say=false]   Post the Exposed card (0.19.0; the card the Position
   *                                        buttons posted from documents/cards/position.mjs through
   *                                        0.18.1, here so the Bind's own writes can say it too).
   */
  async setExposed(zone, exposed = true, { posture = false, announced = posture, say = false } = {}) {
    if (!(zone in SW.ZONES)) return;
    const on = !!exposed;
    const z = this.system.zones?.[zone];
    // The Zone is the record; a call that changes nothing writes nothing, so the palette hook
    // (which calls this when a status is toggled on the token) settles in one pass.
    if ((!!z?.exposed !== on) || (!!z?.postureExposed !== (on && !!posture))) {
      await this.update({
        [`system.zones.${zone}.exposed`]: on,
        [`system.zones.${zone}.postureExposed`]: on && !!posture
      }, { swAnnounced: !!announced });
    }
    // The token status mirrors the Zone (0.5.1): Exposed: Head on the token when the Head is open.
    await this.setCondition(SW.ZONE_CONDITIONS[zone], on);
    if (say) await this.sayExposed(zone, on);
    return this.system.zones?.[zone];
  }

  /**
   * The Exposed card: a Zone opened on this actor, or closed again, its title opening the rules
   * page (0.5.1, T6). Public, as the Zone is.
   * @param {string} zone
   * @param {boolean} [on=true]  False for the card that says a Zone closed.
   * @param {object} [options]
   * @param {"control"|""} [options.by]  What opened it, when the duration is not "until you
   *   Recenter": a Control's Zone lasts while the Control does (0.19.0).
   */
  async sayExposed(zone, on = true, { by = "" } = {}) {
    if (!(zone in SW.ZONES)) return;
    const key = !on ? "STARWROUGHT.Position.exposedClosedText"
      : by === "control" ? "STARWROUGHT.Position.exposedByControlText"
      : "STARWROUGHT.Position.exposedText";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-exposed-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="Exposed" data-tooltip="STARWROUGHT.Rules.openExposed"><i class="fa-solid fa-bullseye"></i> ${
        game.i18n.localize("STARWROUGHT.Condition.exposed")}</a></h3>
        <p>${game.i18n.format(key, { name: this.name, zone: game.i18n.localize(SW.ZONES[zone].label) })}</p></div>`
    });
  }

  /** End of round: a Zone Exposed by a Posture closes now, and only now. */
  async clearPostureExposed() {
    const updates = {};
    const closed = [];
    for (const zone of Object.keys(SW.ZONES)) {
      if (!this.system.zones?.[zone]?.postureExposed) continue;
      updates[`system.zones.${zone}.exposed`] = false;
      updates[`system.zones.${zone}.postureExposed`] = false;
      closed.push(zone);
    }
    if (Object.keys(updates).length) await this.update(updates, { swAnnounced: true });
    // The statuses follow the Zones they mirror.
    for (const zone of closed) await this.setCondition(SW.ZONE_CONDITIONS[zone], false);
  }

  /**
   * Give ground: an Evade that Grazes gives 3 feet directly away from the attacker (PHB v4.10,
   * Graze). The token moves along the line from the attacker, rounded to whole squares, and the
   * move is not charged as a Move.
   * @param {Token|TokenDocument} attackerToken
   * @param {number} [feet]
   * @returns {Promise<boolean>}
   */
  async giveGround(attackerToken, feet = SW.GIVE_GROUND_FEET) {
    const mine = this.tokenOnScene();
    const theirs = attackerToken?.document ?? attackerToken ?? null;
    if (!mine || !theirs || !canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noToken"));
      return false;
    }
    const size = canvas.scene.grid.size;
    const distance = canvas.scene.grid.distance || 1;
    const centre = doc => ({ x: doc.x + (doc.width * size / 2), y: doc.y + (doc.height * size / 2) });
    const a = centre(theirs);
    const b = centre(mine);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (!dx && !dy) dy = 1;
    const length = Math.hypot(dx, dy);
    const cells = feet / distance;
    const nx = Math.round((dx / length) * cells);
    const ny = Math.round((dy / length) * cells);
    await mine.update({ x: mine.x + (nx * size), y: mine.y + (ny * size) }, { swNoCost: true, animate: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Position.giveGround")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Position.gaveGround", { name: this.name, feet })}</p></div>`
    });
    return true;
  }

  /**
   * A Step granted by the Exchange (an Evade that answered a Miss, or a Void that Stopped the
   * attack) costs nothing: the card says so, and the player moves the token.
   */
  async announceStep({ adjacent = false } = {}) {
    const step = this.system.step ?? Math.floor((this.system.speed ?? SW.DEFAULT_SPEED) / SW.STEP_DIVISOR);
    // Slip the Line (PHB v4.21): on a Graze or Miss, a Move to any space adjacent to the
    // attacker, their space no Difficult Terrain for it.
    const title = adjacent ? "STARWROUGHT.Position.adjacent" : "STARWROUGHT.Position.step";
    const text = adjacent
      ? game.i18n.format("STARWROUGHT.Position.adjacentText", { name: this.name })
      : game.i18n.format("STARWROUGHT.Position.stepText", { name: this.name, feet: step });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>⓿ ${game.i18n.localize(title)}</h3>
        <p>${text}</p></div>`
    });
  }
};
