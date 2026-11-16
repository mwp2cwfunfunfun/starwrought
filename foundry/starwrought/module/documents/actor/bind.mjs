/**
 * SwActor: the Bind, this actor's side of it. Forming one or taking Control, ending it, and the one
 * write both go through, which marks the update for the pair-keeper (documents/bind.mjs, which keeps
 * the partner's side whole and is a different file from this one).
 */

import * as SW from "../../config.mjs";
// THE BIND'S PAIR (0.10.1): defined once with the pair-keeper in ../bind.mjs, a different file from
// documents/actor/bind.mjs (this actor's own Bind verbs).
import { MIRROR as BIND_MIRROR, resolveActor as resolveActorByUuid } from "../bind.mjs";
import { promptForZone } from "../../apps/zone-picker.mjs";
// The Bind's rules (0.27.0), pure: why a Bind ended, and whether a Control is a momentary one.
import {
  BIND_END_REASONS as SW_BIND_END_REASONS, momentaryFor, sizeGap, isLarger, MOMENTARY_FLAG, PRESSED_FLAG
} from "../../combat/bind-rules.mjs";
// Gain Control (0.27.0): the roll, the read of the partner's Guard, the tracking setting.
import { SwCheck } from "../../dice/check.mjs";
import { readTargetThreshold } from "../../helpers/threshold-read.mjs";
import { setting } from "../../helpers/settings.mjs";

/** The fighters with a Gain Control under way on this client, by uuid: one at a time each. */
const GAINING = new Set();

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
   * @param {string} [options.zone]  For a Control (0.19.0): the Zone it Exposes on the Controlled
   *   fighter, recorded on both sides; the Controlled side's write opens it and closes it when the
   *   Control ends. Ignored for a neutral Bind.
   * @param {string} [options.pressed]  For a Control gained by a Critical Success on Gain Control
   *   (0.27.0): a one-shot token; the Controlled side's write puts the Off-Guard on itself when it
   *   sees a token it has not seen. Ignored for a neutral Bind.
   */
  async formBind(partner, { state = "neutral", mine = "", theirs = "", announce = true, pair = true, id = "", zone = "", pressed = "", applies = "" } = {}) {
    const other = partner?.actor ?? (partner?.documentName === "Actor" ? partner : null);
    // A Bind is between two implements on two fighters; a token of your own is not a partner.
    if (!other || (other === this) || !other.uuid) return null;
    const mirror = BIND_MIRROR;
    if (!(state in mirror)) state = "neutral";
    mine = mine || this.rigidImplement?.name || "";
    theirs = theirs || other.rigidImplement?.name || "";
    zone = ((state !== "neutral") && (zone in SW.ZONES)) ? zone : "";
    pressed = (state !== "neutral") ? String(pressed ?? "") : "";

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
    await this.#writeBind({ state, partnerUuid: other.uuid, mine, theirs, id, zone, pressed }, { paired: bothSides || !pair });
    if (bothSides) {
      await other.#writeBind({ state: mirror[state], partnerUuid: this.uuid, mine: theirs, theirs: mine, id, zone, pressed }, { paired: true });
    }

    if (announce) {
      const controller = state === "controlling" ? this : state === "controlled" ? other : null;
      const partnerOf = controller === this ? other : this;
      const zoneText = (controller && zone)
        ? ` ${game.i18n.format("STARWROUGHT.Bind.zoneOpened", { partner: partnerOf.name, zone: game.i18n.localize(SW.ZONES[zone].label) })}`
        : "";
      const text = controller
        ? game.i18n.format("STARWROUGHT.Bind.controlTaken", {
            name: controller.name, partner: partnerOf.name,
            theirs: controller === this ? (theirs || game.i18n.localize("STARWROUGHT.Bind.weapon")) : (mine || game.i18n.localize("STARWROUGHT.Bind.weapon"))
          }) + zoneText
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
        }</div>`,
        // `applies` (0.27.0): the Gain Control check card this write was made from. The card is
        // the record that the result was written (documents/cards/gain-control.mjs).
        ...(applies ? { flags: { [SW.SYSTEM_ID]: { gainControlApplied: String(applies) } } } : {})
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
   * @param {string} [options.id]  End only the Bind of this identity (0.27.0). Every end the system
   *   makes by itself (an attack, a movement) names the Bind it decided about, so an end that
   *   lands late can never clear a Bind formed a moment later from the new card.
   * @param {string} [options.reason]  Why, as a key of `STARWROUGHT.Bind.endedBy.*` (0.27.0:
   *   strike, unbound, cast, thirdParty, moved); the card says it.
   * @returns {Promise<boolean>}  Whether a Bind was ended.
   */
  async endBind({ announce = true, pair = true, id = "", reason = "" } = {}) {
    const bind = this.system.bind;
    if (!bind?.state) return false;
    if (id && ((bind.id ?? "") !== id)) return false;
    const partner = resolveActorByUuid(bind.partnerUuid);
    const partnerMirrors = partner?.system?.bind?.partnerUuid === this.uuid;
    const bothSides = pair && !!partner?.isOwner && partnerMirrors;
    // The emptied record keeps the Bind's id as a tombstone: the pair-keeper reads it to tell a
    // Bind this side ended from a mirror that was never written (module/documents/bind.mjs).
    const ended = { state: "", partnerUuid: "", mine: "", theirs: "", id: bind.id ?? "", zone: "", pressed: "" };
    // The Zone the Control held open closes with it (0.19.0; PHB v4.24: "Exposure caused
    // specifically by Control ends when that Control ends"): the Controlled side's write does the
    // closing, here when this client owns it, else on its owner's client as the mirror is cleared.
    const zoneClosed = (bind.zone in SW.ZONES) ? game.i18n.localize(SW.ZONES[bind.zone].label) : "";
    await this.#writeBind(ended, {
      paired: bothSides || !pair || !partnerMirrors,
      previousPartner: bind.partnerUuid
    });
    if (bothSides) await partner.#writeBind({ ...ended }, { paired: true });
    if (announce) {
      const why = SW_BIND_END_REASONS.includes(reason) ? ` ${game.i18n.localize(`STARWROUGHT.Bind.endedBy.${reason}`)}` : "";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link-slash"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3>
          <p>${game.i18n.format("STARWROUGHT.Bind.ended", { name: this.name, partner: partner?.name ?? "" })}${why}${
            zoneClosed ? ` ${game.i18n.format("STARWROUGHT.Bind.zoneClosed", { zone: zoneClosed })}` : ""}</p></div>`
      });
    }
    return true;
  }

  /**
   * Let go of the line (0.27.0): a Control, this fighter's or the partner's, falls back to a
   * neutral Bind of the same identity. A Gain Control that Fails does this (ruling 274), a
   * momentary Control does it when its window closes (ruling 278), and the Bind line's Make
   * neutral button is how the table applies "after its first benefit is used". The Zone the
   * Control held open closes with it, on the Controlled side's own write.
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   * @param {string} [options.id]  Only the Bind of this identity.
   * @param {string} [options.note]  A line for the card (why the Control ended).
   * @param {string} [options.applies]  The Gain Control check card this write was made from; the
   *   card posted here names it, as the record that the result was written.
   * @returns {Promise<object|null>}  This side of the Bind, or null when nothing was done.
   */
  async releaseControl({ announce = true, id = "", note = "", applies = "" } = {}) {
    const bind = this.system.bind;
    if (!bind?.state || (bind.state === "neutral")) return null;
    if (id && ((bind.id ?? "") !== id)) return null;
    const partner = resolveActorByUuid(bind.partnerUuid);
    if (!partner) return null;
    const controller = (bind.state === "controlling") ? this : partner;
    const after = await this.formBind(partner, { state: "neutral", mine: bind.mine, theirs: bind.theirs, id: bind.id, announce: false });
    if (announce && after) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3>
          <p>${game.i18n.format("STARWROUGHT.Bind.madeNeutral", { name: controller.name, partner: (controller === this ? partner : this).name })}${
            note ? ` ${note}` : ""}</p></div>`,
        ...(applies ? { flags: { [SW.SYSTEM_ID]: { gainControlApplied: String(applies) } } } : {})
      });
    }
    return after;
  }

  /**
   * Take Control of the Bind this actor is in, by hand from the sheet (0.19.0; Mike, playtest:
   * "There should be a way to manually Take Control of a Bind on CharSheet, like there is for
   * Breaking the Bind"): a neutral Bind, or the partner's Control contested and won at the table
   * (Gain Control ❶ resolved by hand). The Controller picks the Zone the Control Exposes; the
   * record carries it, and the Controlled side's write opens the Zone wherever that side is
   * written (this client when it owns the partner, else the partner's owner's or the GM's as the
   * mirror reaches it), so no relay is needed. The card is `formBind`'s.
   * @param {object} [options]
   * @param {string} [options.zone]  The Zone, when the caller has already asked.
   * @param {string} [options.pressed]  A Critical Success on Gain Control (0.27.0): the one-shot
   *   token that leaves the partner Off-Guard until its next Opportunity.
   * @param {string} [options.applies]  The Gain Control check card this Control was won on.
   * @returns {Promise<object|null>}  This side of the Bind, or null when nothing was done.
   */
  async takeControl({ zone = "", pressed = "", applies = "" } = {}) {
    const bind = this.system.bind;
    if (!bind?.state) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Bind.noBindToControl", { name: this.name }));
      return null;
    }
    if (bind.state === "controlling") {
      ui.notifications.info(game.i18n.format("STARWROUGHT.Bind.alreadyControlling", { name: this.name }));
      return bind;
    }
    const partner = resolveActorByUuid(bind.partnerUuid);
    if (!partner) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.notFormed"));
      return null;
    }
    if (!(zone in SW.ZONES)) {
      zone = await promptForZone({
        title: game.i18n.localize("STARWROUGHT.Bind.takeControl"),
        text: game.i18n.format("STARWROUGHT.Bind.exposePrompt", { partner: partner.name })
      });
      if (!zone) return null;
    }
    return this.formBind(partner, { state: "controlling", mine: bind.mine, theirs: bind.theirs, id: bind.id, zone, pressed, applies });
  }

  /**
   * Gain Control ❶ (0.27.0; rulings 274, 275, 280): contest the Bind this actor is in. The row
   * (data/maneuvers.xlsx): "Roll Melee against the target's Guard" with four results, read by
   * `gainControlOutcome` (combat/bind-rules.mjs) and written from the check's card
   * (documents/cards/gain-control.mjs). Through 0.26.1 the row paid ❶ and showed its text, and the
   * contest was rolled and applied by hand.
   *
   * The target is the Bind partner, so nothing is targeted. With no Bind, or with the line
   * already held, nothing is spent (ruling 280: a fighter who Controls cannot use it). A partner
   * more than one Size larger is a warning, never a refusal, as every Requirement is.
   *
   *  - A CHARACTER rolls a Melee check against the partner's Guard Threshold, read as a Maneuver's
   *    check against a target is (helpers/threshold-read.mjs: an adversary's number withheld). No
   *    -2 for a Controlled implement (ruling 280). The Opportunity gate is passed and the ❶ paid
   *    when the roll is made, so a closed dialog spends nothing (0.23.0's rule for every Maneuver
   *    that rolls).
   *  - An ADVERSARY rolls nothing: it pays, and a request card asks the partner for a Guard roll
   *    against the adversary's Attack Threshold, read from the other side (ruling 275).
   *
   * `free` is a Gain Control made as part of another Maneuver (ruling 271: Parry's "you may
   * immediately attempt to Gain Control", at no further cost by the Subordinate Maneuver rule): no
   * gate and no cost, since the Parry was both.
   * @param {object} [options]
   * @param {Item|null} [options.item]   The Gain Control row, when the use came from it.
   * @param {boolean} [options.free]     Performed as part of another Maneuver.
   * @param {string} [options.note]      The card's subtitle (whose part it is).
   * @param {string} [options.from]      The card that offered it (Parry's result card).
   * @param {boolean} [options.dialog]   False rolls with no dialog.
   * @returns {Promise<object|null>}  The roll's result, the request card, or null.
   */
  async gainControl(options = {}) {
    // One Gain Control at a time for a fighter (the review of 2026-11-15): the row is held by
    // `SwItem#use`, but the Bind line's button and a card's come straight here, and a double-click
    // would open two rolls and pay twice.
    if (GAINING.has(this.uuid)) return null;
    GAINING.add(this.uuid);
    try {
      return await this.#gainControl(options);
    } finally {
      GAINING.delete(this.uuid);
    }
  }

  /** The body of `gainControl`, which holds it to one call at a time. */
  async #gainControl({ item = null, free = false, note = "", from = "", dialog } = {}) {
    const L = key => game.i18n.localize(key);
    const F = (key, data) => game.i18n.format(key, data);
    const bind = this.system.bind;
    if (!bind?.state) {
      ui.notifications.warn(F("STARWROUGHT.GainControl.noBind", { name: this.name }));
      return null;
    }
    if (bind.state === "controlling") {
      ui.notifications.info(F("STARWROUGHT.Bind.alreadyControlling", { name: this.name }));
      return null;
    }
    const partner = resolveActorByUuid(bind.partnerUuid);
    if (!partner) {
      ui.notifications.warn(L("STARWROUGHT.Bind.notFormed"));
      return null;
    }

    // The row itself, for the card's text, when the use came from the Bind line or a card.
    item ??= await this.#gainControlRow();
    const plain = item ? SW.plainName(item.name) : L("STARWROUGHT.GainControl.label");
    const counted = this.inEncounter && !!this.system.actions && setting("trackActions", true);
    const cost = (free || !counted) ? 0 : 1;
    const label = `${plain} ${SW.ACTION_GLYPHS[free ? 0 : 1]}`;
    const gated = !free && (typeof this.mayActNow === "function");
    const warnings = (isLarger(partner.system?.size, this.system.size)
      && (sizeGap(partner.system?.size, this.system.size) > SW.GAIN_CONTROL_SIZE_GAP))
      ? [F("STARWROUGHT.GainControl.sizeWarn", { partner: partner.name })]
      : [];
    const record = { bindId: bind.id ?? "", state: bind.state };

    if (this.type !== "character") {
      // An adversary's partner rolls for it; another adversary has no Guard to roll, so that
      // contest stays the GM's, with Take Control on the Bind line.
      if (partner.type !== "character") {
        ui.notifications.warn(F("STARWROUGHT.GainControl.byHand", { name: this.name, partner: partner.name }));
        return null;
      }
      if (gated && !(await this.mayActNow({ label }))) return null;
      if (cost) await this.spendActions(cost, { label });
      const attack = this.#boundAttack(bind);
      const { postGainControlRequest } = await import("../cards/gain-control.mjs");
      return postGainControlRequest(this, partner, {
        ...record, from: from ?? "", free: !!free, attackId: attack?.id ?? null, attackName: attack?.name ?? bind.mine ?? ""
      }, warnings);
    }

    // Outside the actor's Opportunity the request card is what the click is for; the gate itself
    // is passed where the cost is paid, in the roll.
    if (gated && !this.canActNow() && !(await this.mayActNow({ label }))) return null;
    for (const warning of warnings) ui.notifications.warn(warning);
    const read = readTargetThreshold({
      roller: this, target: partner, defense: "guard", check: SW.MELEE_SLUG, traits: item?.system?.traits ?? []
    });
    const result = await SwCheck.roll({
      actor: this,
      item,
      kind: "check",
      slug: SW.MELEE_SLUG,
      label: plain,
      subtitle: note || `${SW.ACTION_GLYPHS[free ? 0 : 1]} ${item?.system?.category ?? ""}`.trim(),
      ...(read ?? {}),
      ...((dialog === undefined) ? {} : { dialog }),
      gainControl: { ...record, userUuid: this.uuid, partnerUuid: partner.uuid, inverted: false, from: from ?? "" },
      beforeRoll: async () => {
        if (gated && !(await this.mayActNow({ label }))) return false;
        if (cost) await this.spendActions(cost, { label });
        return true;
      }
    });
    // The roller's own side of the result is written at once: a Success opens the Zone picker, a
    // Failure makes the Bind neutral. What is another's to write waits on the card's button.
    if (result?.message) {
      const { applyGainControl } = await import("../cards/gain-control.mjs");
      await applyGainControl(result.message, { quiet: true });
    }
    return result;
  }

  /**
   * Form a Bind by hand (0.27.0, ruling 279): a neutral Bind with the one token this user has
   * targeted, for a Bind the GM narrates or one ended by mistake (a move's undo does not bring a
   * Bind back). The dialog names both implements, suggesting what each fighter has in hand; the
   * Bind itself is `formBind`'s, with its card, its pair-keeper and its chain on the map. Control
   * is then taken with the Bind line's own buttons.
   * @returns {Promise<object|null>}  This side of the Bind, or null when nothing was formed.
   */
  async formBindByHand() {
    const target = SwCheck.currentTarget();
    const partner = target?.actor ?? null;
    if (!partner || (partner === this) || (partner.uuid === this.uuid)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.formByHandTarget"));
      return null;
    }
    const mine = this.#bindImplements();
    const theirs = partner.#bindImplements();
    const { promptForBind } = await import("../../apps/bind-picker.mjs");
    const picked = await promptForBind({
      name: this.name,
      partner: target.name ?? partner.name,
      mine: { value: mine[0] ?? "", options: mine },
      theirs: { value: theirs[0] ?? "", options: theirs }
    });
    if (!picked) return null;
    const bind = await this.formBind(partner, { state: "neutral", mine: picked.mine, theirs: picked.theirs });
    if (!bind?.state) ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.notFormed"));
    return bind;
  }

  /**
   * What this fighter could Bind with, by name, the likeliest first: a character's held shields
   * and rigid weapons (the rule `rigidImplement` reads), an adversary's attacks.
   * @returns {string[]}
   */
  #bindImplements() {
    if (this.type !== "character") {
      return [...new Set([
        ...this.items.filter(i => (i.type === "action") && i.system.attack?.enabled).map(i => i.name),
        ...(this.system.attacks ?? []).map(row => row.name)
      ].filter(Boolean))];
    }
    const held = this.items.filter(i => i.system?.held);
    const isRigid = i => (typeof i.system.rigid === "boolean") ? i.system.rigid : !i.system.flags?.flexible;
    return [...new Set([
      ...held.filter(i => i.type === "shield").map(i => i.name),
      ...held.filter(i => (i.type === "weapon") && isRigid(i) && !/natural/i.test(i.system.group ?? "")).map(i => i.name)
    ])];
  }

  /** The Gain Control row: this actor's own copy, else the Basic Maneuver. Null when neither exists. */
  async #gainControlRow() {
    const is = i => (i?.type === "action") && (SW.slugify(SW.plainName(i.name)) === "gain-control");
    const own = this.items.find(is);
    if (own) return own;
    try {
      const { loadBasicActions } = await import("../../helpers/content.mjs");
      return (await loadBasicActions()).find(is) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * The attack an adversary's Bind holds, for its Attack Threshold: the attack Item or row named
   * as the Bind's `mine`, else the adversary's first.
   * @param {object} bind
   * @returns {{id: string, name: string}|null}
   */
  #boundAttack(bind) {
    const attacks = [
      ...this.items.filter(i => (i.type === "action") && i.system.attack?.enabled).map(i => ({ id: i.id, name: i.name })),
      ...(this.system.attacks ?? []).map(row => ({ id: row.id, name: row.name }))
    ];
    return attacks.find(a => bind?.mine && SW.sameName(a.name, bind.mine)) ?? attacks[0] ?? null;
  }

  /**
   * Write one side of a Bind and keep the three token statuses in step with it. The status
   * effect carries the Bind (0.5.1, T4): its name says who with, its description names the
   * partner, both implements and the state, its origin is the partner, and
   * `flags.starwrought.bind = {partnerUuid, mine, theirs, state}` is the record for anything that
   * reads effects rather than actors. The update's `swBind` option tells the pair-keeper in
   * module/documents/bind.mjs whether the writer handled both sides.
   * The Control's Zone (0.19.0) follows the record on the Controlled side: a write that makes
   * this actor Controlled with a Zone opens it (and says so, unless it is already open); a write
   * that ends that Control, or moves it to another Zone, closes the old one, unless a Posture
   * holds it open ("Exposure caused specifically by Control ends when that Control ends"). The
   * Controlling side's write touches no Zone: the body is the partner's, and the partner's own
   * write, on whichever client owns it, does this.
   *
   * Two more things ride on a side's own write since 0.27.0, for the same reason the Zone does
   * (whoever may write this body is the one writing): the CONTROLLED side puts a flagged Off-Guard
   * on itself when the record carries a `pressed` token it has not seen (a Critical Success on
   * Gain Control), and the CONTROLLING side starts or forgets the window of a momentary Control
   * (ruling 278).
   * @param {{state: string, partnerUuid: string, mine: string, theirs: string, id?: string, zone?: string, pressed?: string}} bind
   * @param {{paired?: boolean, previousPartner?: string}} [mark]
   */
  async #writeBind(bind, { paired = true, previousPartner = "" } = {}) {
    const before = this.system.bind;
    const heldOpen = ((before?.state === "controlled") && (before.zone in SW.ZONES)) ? before.zone : "";
    const opens = ((bind.state === "controlled") && (bind.zone in SW.ZONES)) ? bind.zone : "";
    const pressedNow = (bind.state === "controlled") && !!bind.pressed && (bind.pressed !== (before?.pressed ?? ""));

    await this.update({ "system.bind": bind }, { swBind: { paired, previousPartner } });

    if (heldOpen && (heldOpen !== opens)) {
      const z = this.system.zones?.[heldOpen];
      if (z?.exposed && !z.postureExposed) await this.setExposed(heldOpen, false, { announced: true, say: true });
    }
    if (opens && !this.system.zones?.[opens]?.exposed) {
      await this.setExposed(opens, true, { announced: true });
      await this.sayExposed(opens, true, { by: "control" });
    }

    const partner = bind.state ? resolveActorByUuid(bind.partnerUuid) : null;

    // "The target is Off-Guard until its next Opportunity" (Gain Control, Critical Success): the
    // Off-Guard is the Gain Control's OWN, as a Torso Critical Hit's is its own (0.26.0): put on
    // only when the body is not Off-Guard already, flagged, and taken off only when flagged, by
    // the turn-change sweep as this fighter's next Opportunity begins (rules/effects-state.mjs).
    // Only in an encounter: outside one there is no Opportunity to end it at, and the condition
    // would sit on the body for good (the review of 2026-11-15). The card still says it.
    if (pressedNow && this.inEncounter && !this.statuses?.has("offGuard")) {
      await this.setCondition("offGuard", true, {
        flags: { [SW.SYSTEM_ID]: { [PRESSED_FLAG]: { combat: this.inEncounter ? (game.combat?.id ?? "") : "", by: partner?.name ?? "" } } }
      });
    }

    // A momentary Control (ruling 278): the Controller carries the window, counted on the turn
    // change. Written when the Control is, forgotten when this side stops Controlling that Bind.
    const momentary = (bind.state === "controlling") && !!partner && momentaryFor(this.system.size, partner.system?.size);
    const window = this.getFlag(SW.SYSTEM_ID, MOMENTARY_FLAG);
    if (momentary) {
      const same = window && (window.bindId === (bind.id ?? "")) && (before?.state === "controlling");
      if (!same) {
        await this.setFlag(SW.SYSTEM_ID, MOMENTARY_FLAG, {
          bindId: bind.id ?? "",
          combat: this.inEncounter ? (game.combat?.id ?? "") : "",
          combatant: this.inEncounter ? (this.combatant?.id ?? "") : "",
          begun: false
        });
      }
    } else if (window) {
      await this.unsetFlag(SW.SYSTEM_ID, MOMENTARY_FLAG);
    }

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
        flags: { [SW.SYSTEM_ID]: { bind: { partnerUuid: bind.partnerUuid, mine: bind.mine, theirs: bind.theirs, state, zone: bind.zone ?? "" } } }
      });
    }
  }
};
