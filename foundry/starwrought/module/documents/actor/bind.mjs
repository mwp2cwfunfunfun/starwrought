/**
 * SwActor: the Bind, this actor's side of it. Forming one or taking Control, ending it, and the one
 * write both go through, which marks the update for the pair-keeper (documents/bind.mjs, which keeps
 * the partner's side whole and is a different file from this one).
 */

import * as SW from "../../config.mjs";
// THE BIND'S PAIR (0.10.1): defined once with the pair-keeper in ../bind.mjs, a different file from
// documents/actor/bind.mjs (this actor's own Bind verbs).
import { MIRROR as BIND_MIRROR, resolveActor as resolveActorByUuid } from "../bind.mjs";

/** @param {typeof Actor} Base */
export const BindMixin = Base => class extends Base {
  /**
   * Form a Bind with a partner (PHB v4.10, The Bind): neutral when neither has the line, or
   * Controlled by one of them. One relationship per implement, both named. Written on both
   * actors when this client owns both; otherwise on this one, marked unpaired, and the partner's
   * owning client writes the mirror as the update reaches it (module/documents/bind.mjs).
   * @param {Actor|Token} partner
   * @param {object} [options]
   * @param {"neutral"|"controlling"|"controlled"} [options.state]  This actor's side of it.
   * @param {string} [options.mine]    This actor's implement. Defaults to the rigid one in hand.
   * @param {string} [options.theirs]  The partner's implement.
   * @param {boolean} [options.announce=true]
   * @param {boolean} [options.pair=true]  Write the partner's side too when this client owns it.
   *   False when this call IS the partner's side, picked up from the other's write
   *   (module/documents/bind.mjs keeps the pair whole), so the pickup never bounces back.
   * @param {string} [options.id]  The Bind's identity, shared by both sides; a pickup passes the
   *   one it is mirroring, a fresh Bind gets a new one.
   */
  async formBind(partner, { state = "neutral", mine = "", theirs = "", announce = true, pair = true, id = "" } = {}) {
    const other = partner?.actor ?? (partner?.documentName === "Actor" ? partner : null);
    // A Bind is between two implements on two fighters; a token of your own is not a partner.
    if (!other || (other === this) || !other.uuid) return null;
    const mirror = BIND_MIRROR;
    if (!(state in mirror)) state = "neutral";
    mine = mine || this.rigidImplement?.name || "";
    theirs = theirs || other.rigidImplement?.name || "";

    // One Bind per fighter (PHB v4.10, The Bind): forming one over a Bind with someone else ends
    // the old one first, on both sides. endBind clears the old partner's side when this client
    // owns it; otherwise its write carries previousPartner and the elected client clears it
    // (module/documents/bind.mjs, pickUpMirror). Review, 2026-10-01.
    const current = this.system.bind;
    if (current?.state && (current.partnerUuid !== other.uuid)) await this.endBind({ announce: false });
    id = id || foundry.utils.randomID();

    // Both sides land here when this client owns both. Otherwise the write goes out marked
    // unpaired, and the partner's owning client (the GM's, when one is connected) writes the
    // mirror as the update reaches it, so a player's click on the card still forms the pair.
    const bothSides = pair && other.isOwner;
    await this.#writeBind({ state, partnerUuid: other.uuid, mine, theirs, id }, { paired: bothSides || !pair });
    if (bothSides) {
      await other.#writeBind({ state: mirror[state], partnerUuid: this.uuid, mine: theirs, theirs: mine, id }, { paired: true });
    }

    if (announce) {
      const controller = state === "controlling" ? this : state === "controlled" ? other : null;
      const partnerOf = controller === this ? other : this;
      const text = controller
        ? game.i18n.format("STARWROUGHT.Bind.controlTaken", {
            name: controller.name, partner: partnerOf.name,
            theirs: controller === this ? (theirs || game.i18n.localize("STARWROUGHT.Bind.weapon")) : (mine || game.i18n.localize("STARWROUGHT.Bind.weapon"))
          })
        : game.i18n.format("STARWROUGHT.Bind.formed", {
            name: this.name, partner: other.name,
            mine: mine || game.i18n.localize("STARWROUGHT.Bind.weapon"),
            theirs: theirs || game.i18n.localize("STARWROUGHT.Bind.weapon")
          });
      // The title opens the rules page for the Bind (0.5.1, T6): chat.mjs wires `rulesPage` on
      // every card, flags or none.
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3><p>${text}</p>${
          bothSides ? "" : `<p class="sw-card-note">${game.i18n.format("STARWROUGHT.Bind.partnerNotOwned", { partner: other.name })}</p>`
        }</div>`
      });
    }
    return this.system.bind;
  }

  /**
   * End the Bind this actor is in: a Strike between the two resolved, someone Moved or Stepped
   * (Close excepted), someone Recentered, the Controller was attacked by a third party, or an
   * implement was dropped or Disarmed. The partner's side is cleared too when this client owns it;
   * otherwise the write goes out unpaired and the partner's owning client clears the mirror.
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   * @param {boolean} [options.pair=true]  False when this call is the mirror being picked up.
   */
  async endBind({ announce = true, pair = true } = {}) {
    const bind = this.system.bind;
    if (!bind?.state) return;
    const partner = resolveActorByUuid(bind.partnerUuid);
    const partnerMirrors = partner?.system?.bind?.partnerUuid === this.uuid;
    const bothSides = pair && !!partner?.isOwner && partnerMirrors;
    // The emptied record keeps the Bind's id as a tombstone: the pair-keeper reads it to tell a
    // Bind this side ended from a mirror that was never written (module/documents/bind.mjs).
    const ended = { state: "", partnerUuid: "", mine: "", theirs: "", id: bind.id ?? "" };
    await this.#writeBind(ended, {
      paired: bothSides || !pair || !partnerMirrors,
      previousPartner: bind.partnerUuid
    });
    if (bothSides) await partner.#writeBind({ ...ended }, { paired: true });
    if (announce) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link-slash"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3>
          <p>${game.i18n.format("STARWROUGHT.Bind.ended", { name: this.name, partner: partner?.name ?? "" })}</p></div>`
      });
    }
  }

  /**
   * Write one side of a Bind and keep the three token statuses in step with it. The status
   * effect carries the Bind (0.5.1, T4): its name says who with, its description names the
   * partner, both implements and the state, its origin is the partner, and
   * `flags.starwrought.bind = {partnerUuid, mine, theirs, state}` is the record for anything that
   * reads effects rather than actors. The update's `swBind` option tells the pair-keeper in
   * module/documents/bind.mjs whether the writer handled both sides.
   * @param {{state: string, partnerUuid: string, mine: string, theirs: string}} bind
   * @param {{paired?: boolean, previousPartner?: string}} [mark]
   */
  async #writeBind(bind, { paired = true, previousPartner = "" } = {}) {
    await this.update({ "system.bind": bind }, { swBind: { paired, previousPartner } });

    const partner = bind.state ? resolveActorByUuid(bind.partnerUuid) : null;
    const weapon = game.i18n.localize("STARWROUGHT.Bind.weapon");
    const args = {
      partner: partner?.name ?? game.i18n.localize("STARWROUGHT.Bind.unknownPartner"),
      mine: bind.mine || weapon,
      theirs: bind.theirs || weapon
    };
    const states = { neutral: "bound", controlling: "controlling", controlled: "controlled" };
    for (const [state, conditionId] of Object.entries(states)) {
      const on = bind.state === state;
      if (!on) {
        await this.setCondition(conditionId, false);
        continue;
      }
      const condition = SW.CONDITIONS[conditionId];
      const stateWord = state.charAt(0).toUpperCase() + state.slice(1);
      await this.setCondition(conditionId, true, {
        name: `${game.i18n.localize(condition.name)}: ${game.i18n.format(`STARWROUGHT.Bind.effect${stateWord}`, args)}`,
        description: `<p>${game.i18n.format(`STARWROUGHT.Bind.${state}`, args)}</p>`
          + `<p>${game.i18n.localize(`${condition.name}Hint`)}</p>`
          + `<p>${game.i18n.format("STARWROUGHT.Rules.where", { page: condition.rulesPage })}</p>`,
        origin: partner?.uuid ?? bind.partnerUuid ?? "",
        flags: { [SW.SYSTEM_ID]: { bind: { partnerUuid: bind.partnerUuid, mine: bind.mine, theirs: bind.theirs, state } } }
      });
    }
  }
};
