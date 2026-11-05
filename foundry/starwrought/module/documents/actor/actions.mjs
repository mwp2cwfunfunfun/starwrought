/**
 * SwActor: six actions a round (PHB v4.10). Whether this actor is in an encounter and at its own
 * Opportunity, spending and announcing, the reset at the start of a round, a Prepared Maneuver
 * (one action now, the rest reserved, finished or abandoned at the next Opportunity), Pass, and the
 * end of an Opportunity. The Combat's side of the same rules is documents/combat.mjs.
 */

import * as SW from "../../config.mjs";

/** @param {typeof Actor} Base */
export const ActionsMixin = Base => class extends Base {
  /** Is this Actor in a running encounter, where actions and rounds mean anything? */
  get inEncounter() {
    return !!game.combat?.started && game.combat.combatants.some(c => c.actor?.id === this.id);
  }

  /** Is it this Actor's Opportunity right now? (A Foundry turn is an Opportunity.) */
  get isTurn() {
    return this.inEncounter && (game.combat.combatant?.actor?.id === this.id);
  }

  /** This Actor's combatant in the running encounter, if any. */
  get combatant() {
    return game.combat?.combatants.find(c => c.actor?.id === this.id) ?? null;
  }

  /**
   * Spend actions from the six a round (PHB v4.10). There is no reaction slot: a Reaction is paid
   * from the same pool.
   *
   * This never stops anything happening. The table is in charge of the fiction, and a system that
   * refuses a Strike because its own arithmetic disagrees is worse than one that says so and gets
   * out of the way. So an overspend goes to chat, where both the player and the GM can see it, and
   * the action still resolves. Outside an encounter nothing is counted at all.
   * Every spend by a player-controlled actor is said in public chat (Mike, 2026-10-01): what it
   * was, how many actions it took, and how many are left this round. A caller whose own card
   * already carries that line (a Move, Raise a Shield, Recenter) passes `announce: false` so the
   * table reads it once. An adversary the GM runs stays quiet unless it overspends.
   * @param {number|string} cost   A number, or a key of SW.ACTION_COSTS (legacy "free"/"reaction" map).
   * @param {object} [options]
   * @param {string} [options.label]      What is being paid for.
   * @param {boolean} [options.announce]  Post the spend card (default true).
   * @returns {Promise<boolean>} always true; the return value is kept for callers that read it
   */
  async spendActions(cost, { label = "", announce = true } = {}) {
    if (!this.inEncounter) return true;
    if (!this.system.actions) return true;

    let n;
    if (typeof cost === "string") {
      const legacy = SW.LEGACY_ACTION_COSTS[cost];
      if (legacy) n = SW.actionCostValue(legacy.cost);
      else if (cost in SW.ACTION_COSTS) n = SW.actionCostValue(cost);
      else n = Number(cost) || 0;
    } else {
      n = Number(cost) || 0;
    }
    if (n <= 0) return true;

    const left = this.system.actions.value ?? 0;
    // swAnnounced: the spend card (or the overspend card) says it; the audit stays quiet.
    await this.update({ "system.actions.value": Math.max(0, left - n) }, { swAnnounced: true });
    if (n > left) await this.#announceOverspend({ label, need: n, left });
    else if (announce && this.announcesSpends) await this.#announceSpend({ label, spent: n });

    // A Maneuver paid for at your own Opportunity keeps the round going: the Combat's pass streak
    // starts over.
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);
    return true;
  }

  /**
   * Does this actor's spending go to public chat? A player's character, or any actor a player
   * owns. The GM's adversaries keep their pips to themselves.
   * @type {boolean}
   */
  get announcesSpends() {
    return (this.type === "character") || this.hasPlayerOwner;
  }

  /**
   * The actions a round starts with: a character's six plus the sheet's Actions adjustment
   * (derived, data/character/actions.mjs), an adversary's own number (its field). The one reader
   * of `system.actionsPerRound` the rest of the system goes through (0.10.1; through 0.10.0 a
   * character was six here and again in resetActions, and no field could raise it). A party has
   * neither and reads six, which nothing counts.
   * @type {number}
   */
  get actionsPerRound() {
    const per = Number(this.system.actionsPerRound);
    return Number.isFinite(per) ? Math.clamp(per, 0, SW.ACTIONS_MAX) : SW.ACTIONS_PER_ROUND;
  }

  /**
   * "4 of 6 actions left this round" (and the reserved count while Preparing), for the cards that
   * announce a spend. Empty outside an encounter, where nothing is counted.
   * @returns {string}
   */
  actionsLeftLine() {
    if (!this.inEncounter || !this.system.actions) return "";
    const left = this.system.actions.value ?? 0;
    const reserved = this.system.actions.reserved ?? 0;
    const per = this.actionsPerRound;
    return reserved > 0
      ? game.i18n.format("STARWROUGHT.Actions.leftReserved", { left, per, reserved })
      : game.i18n.format("STARWROUGHT.Actions.leftLine", { left, per });
  }

  /**
   * The spend card: what was done, in the glyph the book prints, how many actions it took, and
   * how many are left. Always public, so the whole table keeps the same count.
   */
  async #announceSpend({ label, spent }) {
    const glyph = SW.ACTION_GLYPHS[spent] ?? `${spent}`;
    // Labels such as "Deliberate ❷: Battleaxe" or "Parry ❶↺" already carry their glyph.
    const title = label.includes(glyph)
      ? foundry.utils.escapeHTML(label)
      : `<span class="sw-spend-glyph">${glyph}</span> ${foundry.utils.escapeHTML(label)}`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-spend-card" data-actor-uuid="${this.uuid}">
        <h3>${title}</h3>
        <p>${game.i18n.format("STARWROUGHT.Actions.spent", { name: foundry.utils.escapeHTML(this.name), spent })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`
    });
  }

  /**
   * Say plainly, in chat, that something happened without the actions to pay for it, and how many
   * are left (none). Whispered to the GM for an adversary, public for a player's actor, because
   * the table needs to see it.
   */
  async #announceOverspend({ label, need = 0, left = 0 }) {
    const body = game.i18n.format("STARWROUGHT.Actions.overActions", {
      name: this.name, what: label, need, left, over: need - left
    });
    ui.notifications.warn(body);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-overspend">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
          game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3>
        <p>${body} <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p>
        <p class="sw-card-note">${game.i18n.localize("STARWROUGHT.Actions.overNote")}</p></div>`,
      whisper: this.announcesSpends ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /**
   * A fresh round: six actions (an adversary's own number), nothing reserved, nothing Preparing.
   * Unspent actions expired with the old round; a Prepared Maneuver that never reached its next
   * Opportunity expires with them. Slowed N loses N actions at the start of the round.
   * @param {object} [options]
   * @param {boolean} [options.byHand=false]  The sheet's reset arrow rather than the round's turn:
   *                                           a player's hand adjustment, which the audit announces
   *                                           (0.5.1, T10); the round's own reset is marked silent.
   */
  async resetActions({ byHand = false } = {}) {
    const sys = this.system;
    if (!sys.actions) return;
    const per = this.actionsPerRound;
    const slowed = this.conditionValue("slowed");
    const hadPreparation = sys.actions.preparing;
    await this.update({
      "system.actions.value": Math.max(0, per - slowed),
      "system.actions.reserved": 0,
      "system.actions.preparing": null
    }, { swAnnounced: !byHand });
    if (hadPreparation) {
      await this.setCondition("preparing", false);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
          <p>${game.i18n.format("STARWROUGHT.Prepared.expired", { name: this.name, what: hadPreparation.label ?? "" })}</p></div>`,
        whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
      });
    }
  }

  /**
   * Prepare a Maneuver of three or more actions (PHB v4.10): spend one now, set the rest aside as
   * reserved, mark yourself Preparing. Nothing happens yet. At your next Opportunity you finish
   * it or abandon it; you cannot Pass while Preparing. Taking a Wound abandons it.
   * @param {object} config
   * @param {"strike"|"maneuver"} [config.kind]
   * @param {string} config.label
   * @param {number} config.cost           The whole cost; one is spent now.
   * @param {string} [config.weaponId]     For a Committed Strike.
   * @param {string} [config.targetTokenId]
   * @param {string} [config.targetUuid]
   * @param {string} [config.strike]       "committed" for a Strike.
   * @param {string} [config.talentId]     The spell Talent, for a Cast.
   * @param {string} [config.cast]         "focused" or "committed" for a Cast.
   * @param {string[]} [config.targetUuids]  Every target a Cast was aimed at (0.12.0), so the
   *                                       finished preparation declares against them all.
   * @returns {Promise<object|null>} what is being prepared
   */
  async prepare({
    kind = "maneuver", label = "", cost = SW.PREPARED_THRESHOLD, weaponId = "", targetTokenId = "", targetUuid = "",
    strike = "", talentId = "", cast = "", targetUuids = []
  } = {}) {
    if (!this.inEncounter || !this.system.actions) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Prepared.outsideEncounter"));
      return null;
    }
    if (this.system.actions.preparing) {
      // One preparation at a time: the old one is abandoned, its action lost.
      await this.abandonPrepared({ reason: "replaced" });
    }
    cost = Math.max(1, Math.floor(Number(cost) || SW.PREPARED_THRESHOLD));
    const reserve = cost - 1;
    const left = this.system.actions.value ?? 0;
    // A Cast's preparation (PHB v4.21: a Focused or Committed Cast is Prepared under the
    // three-action rule) remembers the spell Talent and the commitment as a Strike's remembers
    // the weapon and the Strike.
    const preparing = {
      kind, label, weaponId, targetTokenId, targetUuid, cost, strike, talentId, cast,
      targetUuids: Array.isArray(targetUuids) ? targetUuids.filter(Boolean) : []
    };
    await this.update({
      "system.actions.value": Math.max(0, left - cost),
      "system.actions.reserved": reserve,
      "system.actions.preparing": preparing
    }, { swAnnounced: true });
    // "You must have enough unspent actions." Announced, not enforced.
    if (cost > left) await this.#announceOverspend({ label: game.i18n.format("STARWROUGHT.Prepared.paying", { what: label }), need: cost, left });
    await this.setCondition("preparing", true);
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-prepared-card" data-actor-uuid="${this.uuid}">
        <h3><i class="fa-solid fa-hourglass-half"></i> ${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Prepared.begun", { name: this.name, what: label, reserved: reserve })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p>
        <div class="sw-card-buttons">
          <button type="button" data-sw-action="finishPrepared" data-actor-uuid="${this.uuid}" data-owner-uuid="${this.uuid}">
            <i class="fa-solid fa-check"></i> ${game.i18n.localize("STARWROUGHT.Prepared.finish")}
          </button>
          <button type="button" data-sw-action="abandonPrepared" data-actor-uuid="${this.uuid}" data-owner-uuid="${this.uuid}">
            <i class="fa-solid fa-xmark"></i> ${game.i18n.localize("STARWROUGHT.Prepared.abandon")}
          </button>
        </div></div>`,
      flags: { [SW.SYSTEM_ID]: { kind: "prepared", actorUuid: this.uuid } }
    });
    return preparing;
  }

  /**
   * Finish a Prepared Maneuver at your Opportunity: the reserved actions are spent (they left the
   * pool when the preparation began) and the Maneuver resolves. A Committed Strike rolls now,
   * already paid for. Range, line of effect and requirements are the table's to check again.
   */
  async finishPrepared() {
    const prep = this.system.actions?.preparing;
    if (!prep) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Prepared.nothing"));
      return null;
    }
    await this.update({ "system.actions.reserved": 0, "system.actions.preparing": null });
    await this.setCondition("preparing", false);
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);

    if (prep.kind === "strike" && prep.weaponId) {
      const targetUuid = prep.targetUuid
        || (prep.targetTokenId ? (canvas.tokens?.get(prep.targetTokenId)?.document.uuid ?? "") : "");
      return this.rollAttack(prep.weaponId, {
        strike: SW.STRIKE_KINDS[prep.strike] ? prep.strike : "committed",
        prepared: true,
        targetUuid
      });
    }
    if (prep.kind === "cast" && prep.talentId && (typeof this.castSpell === "function")) {
      // The Cast declares against every target it was aimed at (0.12.0); a target gone from the
      // scene falls back to the user's targets, else the Cast rolls at once with no defender.
      return this.castSpell(prep.talentId, {
        cast: SW.CAST_KINDS[prep.cast] ? prep.cast : SW.DEFAULT_CAST,
        prepared: true,
        targetUuid: prep.targetUuid || "",
        targetUuids: Array.isArray(prep.targetUuids) ? prep.targetUuids : []
      });
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Prepared.finished", { name: this.name, what: prep.label ?? "" })}</p></div>`
    });
    return prep;
  }

  /**
   * Abandon a Prepared Maneuver: the action already spent is lost, the reserved actions return.
   * @param {object} [options]
   * @param {"choice"|"wound"|"replaced"} [options.reason]
   */
  async abandonPrepared({ reason = "choice" } = {}) {
    const actions = this.system.actions;
    const prep = actions?.preparing;
    if (!prep) return null;
    await this.update({
      "system.actions.value": (actions.value ?? 0) + (actions.reserved ?? 0),
      "system.actions.reserved": 0,
      "system.actions.preparing": null
    }, { swAnnounced: true });
    await this.setCondition("preparing", false);
    const key = reason === "wound" ? "STARWROUGHT.Wound.abandonsPrepared"
      : reason === "replaced" ? "STARWROUGHT.Prepared.abandonedReplaced"
      : "STARWROUGHT.Prepared.abandoned";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format(key, { name: this.name, what: prep.label ?? "", returned: actions.reserved ?? 0 })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`,
      whisper: this.announcesSpends ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
    return prep;
  }

  /**
   * Pass ⓿: decline this Opportunity. You may still use Reactions. When a full circuit passes in
   * which everyone Passes, the round ends; the Combat keeps that count. You cannot Pass while
   * Preparing (finish or abandon first), so that one is refused rather than announced: it is a
   * tracker control, not a thing that happens in the fiction.
   * @returns {Promise<boolean>} whether the Opportunity was passed
   */
  async pass() {
    if (!this.inEncounter) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noCombatant"));
      return false;
    }
    if (!this.isTurn) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Actions.notYourOpportunity"));
      return false;
    }
    if (this.system.actions?.preparing) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Prepared.cannotPass", { name: this.name }));
      return false;
    }
    const combatant = this.combatant;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-pass-card"><h3>⓿ ${game.i18n.localize("STARWROUGHT.Actions.pass")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Actions.passText", { name: this.name, left: this.system.actions?.value ?? 0 })}</p></div>`
    });
    // The Combat registers the Pass, keeps the streak, and advances the turn only if the round
    // did not just end on a full circuit of Passes.
    if (game.combat.pass) return game.combat.pass(combatant);
    await game.combat.registerPass?.(combatant);
    await game.combat.nextTurn();
    return true;
  }

  /**
   * End this Opportunity after a Maneuver, without Passing: play moves to the next combatant and
   * the round keeps going.
   * @returns {Promise<boolean>}
   */
  async endOpportunity() {
    if (!this.isTurn) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Actions.notYourOpportunity"));
      return false;
    }
    await game.combat.nextTurn();
    return true;
  }
};
