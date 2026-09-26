/**
 * The Actor document.
 *
 * Everything a character does at the table is a method here: rolling a check, answering a blow,
 * Recentering, going down, and coming back. The rules arithmetic lives in the data model; this
 * class is the verbs.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { SwDamage } from "../dice/damage.mjs";
import { gapBetween } from "../canvas/geometry.mjs";

export class SwActor extends Actor {
  /* -------------------------------------------- */
  /*  Conditions                                  */
  /* -------------------------------------------- */

  /**
   * The value of a numeric condition (Frightened 2, Slowed 1), or 0 if it is not on you.
   * @param {string} id  A key of SW.CONDITIONS.
   * @returns {number}
   */
  conditionValue(id) {
    if (id === "wounded") return this.system.wounded ?? 0;
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
   * @param {string} id
   * @param {number|boolean} [value]  A number for numeric conditions, true/false otherwise.
   */
  async setCondition(id, value = true) {
    const config = SW.CONDITIONS[id];
    if (!config) return;
    const existing = this.effects.find(e => e.statuses?.has(id));
    const off = (value === false) || (config.numeric && Number(value) <= 0);

    if (off) return existing?.delete();

    if (config.numeric) {
      const n = Number(value) || 1;
      const name = `${game.i18n.localize(config.name)} ${n}`;
      if (existing) return existing.update({ name, [`flags.${SW.SYSTEM_ID}.value`]: n });
      return this.createEmbeddedDocuments("ActiveEffect", [{
        name, img: config.img, statuses: [id], flags: { [SW.SYSTEM_ID]: { value: n } }
      }]);
    }

    if (existing) return existing;
    return this.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize(config.name), img: config.img, statuses: [id]
    }]);
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * Actor#getRollData returns the live system object, so this builds a plain copy instead: a
   * roll formula must never be able to write back onto the character. Active Effects also ask
   * for roll data during prepareEmbeddedDocuments, before the derived pass, so every derived
   * value read here has to survive being asked too early.
   */
  getRollData() {
    const sys = this.system;
    const data = sys.toObject();
    data.level = sys.level ?? 1;
    if (this.type !== "character") return data;
    for (const [key, attr] of Object.entries(sys.attributes ?? {})) data[key] = attr.mod ?? 0;
    data.spec = sys.weapons?.specialization ?? 0;
    data.dice = sys.weapons?.dice ?? 1;
    data.loadStrain = sys.loadStrain ?? 0;
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Roll a check in a Constellation. Untrained is a real answer, not an error.
   * @param {string} slug
   * @param {object} [options]
   */
  async rollCheck(slug, options = {}) {
    const meta = this.system.constellations?.[slug] ?? SW.getConstellation(slug);
    return SwCheck.roll(foundry.utils.mergeObject({
      actor: this,
      kind: "check",
      slug,
      label: meta.name,
      subtitle: game.i18n.localize("STARWROUGHT.Roll.check")
    }, options, { inplace: false }));
  }

  /* -------------------------------------------- */

  /**
   * Roll one of the four Defenses. When it answers an Attack, pass the attacker's Attack
   * Threshold; the degrees are then read from the attacker's side, so beating it by 10 is a Miss.
   * @param {string} key  A key of SW.DEFENSES.
   * @param {object} [options]
   */
  async rollDefense(key, options = {}) {
    const def = SW.DEFENSES[key];
    if (!def) return null;
    return SwCheck.roll(foundry.utils.mergeObject({
      actor: this,
      kind: options.threshold !== undefined ? "defense" : "check",
      slug: def.slug,
      label: game.i18n.localize(def.label),
      subtitle: game.i18n.localize(def.hint),
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.attackThreshold")
    }, options, { inplace: false }));
  }

  /* -------------------------------------------- */

  /**
   * Strike with a weapon. The attack roll is Weapons Proficiency, adjusted for the weapon's
   * Handling, plus the Attribute the weapon uses, against the target's chosen Defense Threshold.
   * @param {string} weaponId
   * @param {object} [options]
   */
  async rollAttack(weaponId, options = {}) {
    const weapon = this.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;

    // Striking with something you are not holding is worth saying out loud, and nothing more.
    if (!weapon.system.held) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notHeld", { name: weapon.name }));
    }
    // A Strike is one action; the two and three action versions buy control over where it lands.
    await this.spendActions(options.actionCost ?? 1, {
      label: game.i18n.localize("STARWROUGHT.Roll.strike")
    });

    const rank = this.weaponRank(weapon);

    // Your Foundry target first; failing that, the one target this token is remembered as having,
    // so a reload does not cost you the Threshold along with the arrow.
    let targetToken = SwCheck.currentTarget();
    if (!targetToken) {
      const remembered = this.tokenOnScene()?.getFlag(SW.SYSTEM_ID, "targets")?.ids ?? [];
      const only = (remembered.length === 1) ? canvas.tokens?.get(remembered[0]) : null;
      if (only?.actor) targetToken = only;
    }
    const targetActor = targetToken?.actor ?? null;

    // The defender decides whether to Evade or Guard. Their stance is that decision, made in
    // advance and changeable until the die leaves the hand, so the roll reads it rather than asking
    // the attacker: the dialog shows it and offers no choice. A caller may still force a Defense
    // (a Talent that targets Awareness, say); otherwise the defender's answer is read again at the
    // moment of the roll.
    const forced = options.defense !== undefined;
    const answering = targetActor?.answeringDefense() ?? null;
    const defense = options.defense ?? answering?.key ?? "evade";
    const target = targetToken ? SwCheck.thresholdOf(targetToken, defense) : null;
    const targetDefense = !targetActor ? null : forced
      ? { key: defense, label: game.i18n.localize(SW.DEFENSES[defense].label), threshold: target?.threshold ?? 10, unavailable: null }
      : answering;

    // Unwieldy N: a −2 circumstance penalty against a target within N feet, measured edge to edge
    // like everything else on the grid, and no attack at all while Grabbed. The penalty is applied;
    // the Grabbed clause is announced, since nothing in this system prevents a roll.
    const modifiers = [...(options.modifiers ?? [])];
    const unwieldy = weapon.system.flags?.unwieldy ?? 0;
    if (unwieldy) {
      const attackerToken = this.tokenOnScene();
      if (attackerToken && targetToken) {
        const gap = gapBetween(attackerToken, targetToken.document);
        if (gap <= unwieldy) {
          modifiers.push({
            label: game.i18n.format("STARWROUGHT.Roll.unwieldy", { n: unwieldy }),
            value: SW.UNWIELDY_PENALTY,
            type: "circumstance"
          });
        }
      }
      if (this.statuses?.has("grabbed")) await this.#announceGrabbed(weapon);
    }

    return SwCheck.roll(foundry.utils.mergeObject({
      actor: this,
      item: weapon,
      weaponId,
      kind: "attack",
      slug: SW.WEAPONS_SLUG,
      rankOverride: rank,
      attribute: weapon.system.attackAttribute,
      label: weapon.name,
      subtitle: game.i18n.localize("STARWROUGHT.Roll.strike"),
      map: weapon.system.map,
      modifiers,
      threshold: target?.threshold ?? null,
      thresholdLabel: target?.label ?? "",
      targetUuid: target?.uuid ?? "",
      targetDefense,
      defenseForced: forced,
      // The token's name, not the actor's: the token name is the one the GM chose to show.
      targetName: targetToken?.name ?? ""
    }, { ...options, modifiers }, { inplace: false }));
  }

  /**
   * The Defense that answers a physical Attack on this actor right now: the stance, unless the
   * rules make it unavailable (Evade while Grabbed or Restrained), in which case the other one.
   * Read live, so a stance changed a moment ago is what the attacker's roll meets.
   * @returns {{key: string, stance: string, label: string, threshold: number, unavailable: string|null}}
   */
  answeringDefense() {
    const stance = ["evade", "guard"].includes(this.system.stance) ? this.system.stance : "evade";
    const blocked = this.system.defenses?.[stance]?.unavailable ?? null;
    const key = blocked ? (stance === "evade" ? "guard" : "evade") : stance;
    return {
      key,
      stance,
      label: game.i18n.localize(SW.DEFENSES[key].label),
      threshold: this.system.defenses?.[key]?.threshold ?? 10,
      unavailable: blocked
        ? game.i18n.format("STARWROUGHT.Stance.answeringInstead", {
            stance: game.i18n.localize(SW.DEFENSES[stance].label),
            reason: game.i18n.localize(SW.CONDITIONS[blocked]?.name ?? blocked),
            defense: game.i18n.localize(SW.DEFENSES[key].label)
          })
        : null
    };
  }

  /**
   * "You cannot attack with it at all while you are Grabbed." Said to the table the way an
   * overspent action is, and never enforced: the roll posts, and the table decides.
   */
  async #announceGrabbed(weapon) {
    const body = game.i18n.format("STARWROUGHT.Roll.unwieldyGrabbed", { name: this.name, weapon: weapon.name });
    ui.notifications.warn(body);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-overspend">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
          game.i18n.localize("STARWROUGHT.Roll.unwieldyGrabbedTitle")}</h3>
        <p>${body}</p></div>`,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /**
   * This actor's token on the current scene: the one you have selected if it is one of yours,
   * otherwise the first. Null when the actor is not on the map, in which case nothing that needs a
   * distance applies.
   * @returns {TokenDocument|null}
   */
  tokenOnScene() {
    if (this.isToken) return this.token;
    const docs = this.getActiveTokens(false, true);
    return docs.find(d => d.object?.controlled) ?? docs[0] ?? null;
  }

  /**
   * Choose which Defense answers the next physical Attack. The defender's call, so it lives here,
   * and the attacker's roll reads it. Announced in chat during an encounter, because the attacker
   * needs to know and the table should not have to ask.
   * @param {"evade"|"guard"} key
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   */
  async setStance(key, { announce = true } = {}) {
    if (!["evade", "guard"].includes(key)) return;
    if (this.system.stance === key) return;
    await this.update({ "system.stance": key });
    const defense = this.system.defenses?.[key];
    // A Defense the rules say you cannot use right now is still yours to choose; the system says
    // so and leaves the ruling to the table.
    const note = defense?.unavailable
      ? " " + game.i18n.format("STARWROUGHT.Stance.unavailableNote", {
          reason: game.i18n.localize(SW.CONDITIONS[defense.unavailable]?.name ?? defense.unavailable)
        })
      : "";
    if (note) ui.notifications.warn(note.trim());
    if (!announce || !this.inEncounter) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought sw-stance-card">${game.i18n.format("STARWROUGHT.Stance.set", {
        name: this.name,
        defense: game.i18n.localize(SW.DEFENSES[key].label),
        threshold: defense?.threshold ?? 10
      })}${note}</div>`
    });
  }

  /**
   * The Proficiency Rank that actually applies to a weapon, after Handling and Familiarity.
   * Intuitive costs nothing; Practiced drops a rank; Technical drops you to Untrained.
   * @param {Item} weapon
   * @returns {string}
   */
  weaponRank(weapon) {
    const base = this.system.proficiency?.(SW.WEAPONS_SLUG)?.rank ?? "untrained";
    const handling = weapon.system.handling ?? "intuitive";
    // `familiar` is the derived set: what your Talents recorded, plus the sheet's own list.
    const familiar = this.system.familiar?.has(weapon.system.group)
      || this.system.familiar?.has(weapon.name);
    if (familiar || handling === "intuitive") return base;
    if (handling === "practiced") return SW.stepRank(base, -1);
    return "untrained";
  }

  /* -------------------------------------------- */

  /** Roll damage for an outcome of a Strike. */
  async rollDamage(weaponId, outcome, options = {}) {
    const weapon = this.items.get(weaponId);
    if (!weapon) return null;
    return SwDamage.roll({ actor: this, weapon, outcome, ...options });
  }

  /* -------------------------------------------- */
  /*  Going down and coming back                  */
  /* -------------------------------------------- */

  /**
   * Reduced to 0 Hit Points. Nonlethal simply knocks you out; otherwise you are Dying, starting
   * at 1, or 2 from a Critical Hit, plus your Wounded value.
   * @param {object} [options]
   * @param {boolean} [options.critical]
   * @param {boolean} [options.nonlethal]
   */
  async dropToZero({ critical = false, nonlethal = false } = {}) {
    await this.setCondition("unconscious", true);
    if (nonlethal) return;
    const start = (critical ? 2 : 1) + (this.system.wounded ?? 0);
    const dying = Math.min(SW.DYING_MAX, start);
    await this.update({ "system.dying": dying });
    await this.setCondition("dying", dying);
    if (dying >= SW.DYING_MAX) await this.#die();
    else {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.dying", { name: this.name, value: dying }));
    }
  }

  /** Taking damage while Dying increases the value by 1, or by 2 from a Critical Hit. */
  async increaseDying(amount = 1) {
    const dying = Math.min(SW.DYING_MAX, (this.system.dying ?? 0) + amount);
    await this.update({ "system.dying": dying });
    await this.setCondition("dying", dying);
    if (dying >= SW.DYING_MAX) await this.#die();
  }

  /** Whenever your Dying ends, for any reason, you become Wounded 1, or one worse. */
  async endDying({ conscious = false, hp = 0 } = {}) {
    const updates = {
      "system.dying": 0,
      "system.wounded": (this.system.wounded ?? 0) + 1
    };
    if (conscious) updates["system.hp.value"] = Math.max(1, hp);
    await this.update(updates);
    await this.setCondition("dying", 0);
    if (conscious) await this.setCondition("unconscious", false);
  }

  async #die() {
    await this.setCondition("dead", true);
    ui.notifications.error(game.i18n.format("STARWROUGHT.Notify.dead", { name: this.name }));
  }

  /* -------------------------------------------- */

  /**
   * A Recovery check: an Endure check against 10 + your level + your Dying value. It costs no
   * action, and it is made at the start of each of your turns while Dying.
   */
  async rollRecovery() {
    if (!this.system.dying) {
      ui.notifications.info(game.i18n.localize("STARWROUGHT.Notify.notDying"));
      return null;
    }
    const threshold = 10 + this.system.level + this.system.dying;
    const result = await SwCheck.roll({
      actor: this,
      kind: "check",
      slug: SW.DEFENSES.endure.slug,
      label: game.i18n.localize("STARWROUGHT.Roll.recovery"),
      subtitle: game.i18n.format("STARWROUGHT.Roll.recoveryHint", { value: this.system.dying }),
      threshold,
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.recoveryThreshold")
    });
    if (!result) return null;

    switch (result.degree) {
      case "critSuccess":
        await this.endDying({ conscious: true, hp: 1 });
        break;
      case "success": {
        const dying = this.system.dying - 1;
        if (dying <= 0) await this.update({ "system.dying": 0 }).then(() => this.setCondition("dying", 0));
        else await this.update({ "system.dying": dying }).then(() => this.setCondition("dying", dying));
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
   * Refusing Death. Not a roll: it cannot fail, and nothing in the game can stop it.
   */
  async refuseDeath() {
    if (!this.system.heroPoints?.value) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noHeroPoints"));
      return;
    }
    await this.update({
      "system.dying": 0,
      "system.hp.value": 0,
      "system.heroPoints.value": 0
    });
    await this.setCondition("dying", 0);
    await this.setCondition("dead", false);
    await this.setCondition("unconscious", true);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought refuse-death"><h3>${game.i18n.localize("STARWROUGHT.Roll.refuseDeath")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Roll.refuseDeathText", { name: this.name })}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Is this Actor in a running encounter, where actions and rounds mean anything? */
  get inEncounter() {
    return !!game.combat?.started && game.combat.combatants.some(c => c.actor?.id === this.id);
  }

  /** Is it this Actor's turn right now? */
  get isTurn() {
    return this.inEncounter && (game.combat.combatant?.actor?.id === this.id);
  }

  /**
   * Spend actions.
   *
   * This never stops anything happening. The table is in charge of the fiction, and a system that
   * refuses a Strike because its own arithmetic disagrees is worse than one that says so and gets
   * out of the way. So an overspend goes to chat, where both the player and the GM can see it, and
   * the action still resolves.
   *
   * Outside an encounter nothing is counted at all: the three-action turn is a rule of Encounter
   * Mode.
   * @param {number|string} cost   A number, or a key of SW.ACTION_COSTS.
   * @param {object} [options]
   * @param {string} [options.label]  What is being paid for.
   * @returns {Promise<boolean>} always true; the return value is kept for callers that read it
   */
  async spendActions(cost, { label = "" } = {}) {
    if (!this.inEncounter) return true;
    if (cost === "reaction") return this.#spendReaction(label);

    const n = Number(cost) || 0;
    if (n <= 0) return true;

    const left = this.system.actions?.value ?? 0;
    await this.update({ "system.actions.value": Math.max(0, left - n) });
    if (n > left) await this.#announceOverspend({ label, need: n, left });
    return true;
  }

  async #spendReaction(label) {
    const had = this.system.actions?.reaction ?? true;
    await this.update({ "system.actions.reaction": false });
    if (!had) {
      await this.#announceOverspend({ label, reaction: true });
    }
    return true;
  }

  /**
   * Say plainly, in chat, that something happened without the actions to pay for it. Whispered to
   * the GM for an adversary, public for a player character, because the table needs to see it.
   */
  async #announceOverspend({ label, need = 0, left = 0, reaction = false }) {
    const body = reaction
      ? game.i18n.format("STARWROUGHT.Actions.overReaction", { name: this.name, what: label })
      : game.i18n.format("STARWROUGHT.Actions.overActions", {
          name: this.name, what: label, need, left, over: need - left
        });
    ui.notifications.warn(body);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-overspend">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
          game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3>
        <p>${body}</p>
        <p class="sw-card-note">${game.i18n.localize("STARWROUGHT.Actions.overNote")}</p></div>`,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /** A fresh turn: three actions and a reaction. */
  async resetActions() {
    return this.update({ "system.actions.value": 3, "system.actions.reaction": true });
  }

  /* -------------------------------------------- */
  /*  Carrying                                    */
  /* -------------------------------------------- */

  /**
   * Move a piece of equipment between held, worn, and carried.
   *
   * Drawing or stowing something is an Interact, which costs an action in an encounter. Armor is
   * the exception the handbook is explicit about: putting a piece on or taking it off takes a
   * minute per point of Protection, so it is not something you do mid-fight at all.
   * @param {string} itemId
   * @param {string} state  A key of SW.CARRY_STATES.
   */
  async setCarryState(itemId, state) {
    const item = this.items.get(itemId);
    if (!item || !(state in SW.CARRY_STATES)) return;
    if (item.system.state === state) return;

    if (item.type === "armor") {
      // "Putting on or taking off a single piece takes 1 minute for each point of Protection."
      // Said plainly rather than forbidden: it is the table's call whether the fiction allows it.
      if (this.inEncounter) {
        const minutes = Math.max(1, item.system.protection);
        const body = game.i18n.format("STARWROUGHT.Actions.armorInCombat", { name: item.name, minutes });
        ui.notifications.warn(body);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          content: `<div class="starwrought action-card sw-overspend">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
              game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3><p>${body}</p></div>`
        });
      }
    } else if (state === "held" || item.system.state === "held") {
      // Drawing it or putting it away: one Interact.
      await this.spendActions(1, { label: item.name });
    }

    return item.update({ "system.state": state });
  }

  /* -------------------------------------------- */
  /*  Zones                                       */
  /* -------------------------------------------- */

  /** Recenter: gather yourself, and clear every Exposed Zone on you. */
  async recenter() {
    await this.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.recenter") });
    const updates = {};
    for (const zone of Object.keys(SW.ZONES)) updates[`system.zones.${zone}.exposed`] = false;
    await this.update(updates);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>◆ ${game.i18n.localize("STARWROUGHT.Action.recenter")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Action.recenterText", { name: this.name })}</p></div>`
    });
  }

  /** Open or close one Zone. */
  async setExposed(zone, exposed = true) {
    if (!(zone in SW.ZONES)) return;
    return this.update({ [`system.zones.${zone}.exposed`]: !!exposed });
  }

  /* -------------------------------------------- */
  /*  Flares                                      */
  /* -------------------------------------------- */

  /**
   * A Constellation is Flared or it is not: a checkbox, not a count. It stays Flared until you
   * spend into it.
   * @param {string} slug
   * @param {boolean} [state]
   */
  async toggleFlare(slug, state) {
    const next = state ?? !this.system.flares?.[slug];
    // An update merges objects, so putting a Flare out takes the deletion key rather than a
    // clone with the property removed.
    return this.update(next
      ? { [`system.flares.${slug}`]: true }
      : { [`system.flares.-=${slug}`]: null });
  }

  /** Which Constellations are currently Flared. */
  get flared() {
    return Object.keys(this.system.flares ?? {});
  }

  /* -------------------------------------------- */
  /*  Rest                                        */
  /* -------------------------------------------- */

  /**
   * A full night's rest restores Hit Points equal to your level times your Presence (or your
   * level, if Presence is 1 or less), and clears Wounded.
   */
  async restForTheNight() {
    const sys = this.system;
    const healed = Math.min(sys.hp.rest, sys.hp.max - sys.hp.value);
    await this.update({
      "system.hp.value": sys.hp.value + healed,
      "system.hp.temp": 0,
      "system.wounded": 0,
      "system.heroPoints.value": Math.max(sys.heroPoints.value, 1)
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Rest.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Rest.text", { name: this.name, hp: healed })}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Creation                                    */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const prototypeToken = {
      sight: { enabled: true },
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    };
    if (this.type === "character") {
      Object.assign(prototypeToken, { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
    }
    // The grid is 1 foot, so a Medium creature is a 3x3 token rather than a 1x1.
    const space = SW.SIZES[data.system?.size ?? "medium"]?.space ?? 3;
    prototypeToken.width = space;
    prototypeToken.height = space;
    this.updateSource({ prototypeToken });
  }

  /** @inheritdoc */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    // Keep the token footprint honest when Size changes: the grid is in feet.
    const size = changes.system?.size;
    if (size && SW.SIZES[size]) {
      const space = SW.SIZES[size].space;
      foundry.utils.setProperty(changes, "prototypeToken.width", space);
      foundry.utils.setProperty(changes, "prototypeToken.height", space);
    }
  }
}
