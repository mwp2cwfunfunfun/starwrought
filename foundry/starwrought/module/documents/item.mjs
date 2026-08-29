/**
 * The Item document. Talents, gear, and actions all know how to put themselves on the table.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";

export class SwItem extends Item {
  /** @inheritdoc */
  getRollData() {
    const data = this.actor?.getRollData() ?? {};
    data.item = foundry.utils.deepClone(this.system);
    return data;
  }

  /* -------------------------------------------- */

  /** Whether this Item is one of the Talent-like things that costs a Talent Point. */
  get isFeature() {
    return SW.FEATURE_TYPES.includes(this.type);
  }

  /** Whether this Item can be worn or wielded. */
  get isPhysical() {
    return SW.PHYSICAL_TYPES.includes(this.type);
  }

  /* -------------------------------------------- */

  /**
   * The default thing to do when a player clicks the Item: Strike with a weapon, roll the check
   * an action calls for, or simply post the card.
   * @param {object} [options]
   */
  async use(options = {}) {
    switch (this.type) {
      case "weapon":
        if (!this.actor) return this.toMessage();
        return this.actor.rollAttack(this.id, options);
      case "action":
        if (this.system.check.enabled && this.actor) {
          return SwCheck.roll(foundry.utils.mergeObject({
            actor: this.actor,
            item: this,
            kind: "check",
            slug: this.system.check.constellation,
            label: this.name,
            subtitle: `${this.system.glyph} ${this.system.category}`.trim(),
            outcomes: this.#outcomeList()
          }, options, { inplace: false }));
        }
        return this.toMessage();
      case "shield":
        return this.raise();
      default:
        return this.toMessage();
    }
  }

  /* -------------------------------------------- */

  /** Raise a Shield: its item bonus to Guard until the start of your next turn. */
  async raise() {
    if (!this.actor) return;
    if (!this.system.held) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notHeld", { name: this.name }));
    }
    const raised = !this.system.raised;
    // Raising it costs an action. Lowering it is free: you simply stop.
    if (raised) {
      await this.actor.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.raiseShield") });
    }
    await this.update({ "system.raised": raised });
    await this.actor.update({
      "system.bonuses.defenses.guard": raised
        ? this.actor.system.bonuses.defenses.guard + this.system.bonus
        : this.actor.system.bonuses.defenses.guard - this.system.bonus
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="starwrought action-card"><h3>◆ ${game.i18n.localize("STARWROUGHT.Action.raiseShield")}</h3>
        <p>${game.i18n.format(raised ? "STARWROUGHT.Action.raiseShieldOn" : "STARWROUGHT.Action.raiseShieldOff", {
          name: this.actor.name, shield: this.name, bonus: this.system.bonus
        })}</p></div>`
    });
  }

  /* -------------------------------------------- */

  /** Put the Item on the table as a card, with no roll. */
  async toMessage() {
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const description = await TextEditor.enrichHTML(this.system.chatDescription ?? "", {
      rollData: this.getRollData(),
      relativeTo: this
    });
    const { renderTemplate } = foundry.applications.handlebars;
    const content = await renderTemplate("systems/starwrought/templates/chat/item-card.hbs", {
      item: this,
      description,
      subtitle: this.#subtitle(),
      traits: this.system.traits ?? [],
      outcomes: this.#outcomeList()
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: { [SW.SYSTEM_ID]: { kind: "item", itemUuid: this.uuid } }
    });
  }

  /* -------------------------------------------- */

  /** The grey line under the Item's name on a card. */
  #subtitle() {
    switch (this.type) {
      case "talent": {
        const con = SW.getConstellation(this.system.constellation);
        return `${con.name} • ${game.i18n.localize(this.system.tierLabel)}`;
      }
      case "constellation":
        return this.system.meta || game.i18n.localize(this.system.categoryLabel);
      case "chassis":
        return game.i18n.localize(this.system.kindLabel);
      case "weapon":
        return `${this.system.handlingLabel ? game.i18n.localize(this.system.handlingLabel) : ""} • ${this.system.group}`;
      case "armor":
        return `${game.i18n.localize(this.system.zoneLabel)} • ${game.i18n.localize("STARWROUGHT.Field.protection")} ${this.system.protection}`;
      case "action":
        return `${this.system.glyph} ${this.system.category}`.trim();
      default:
        return "";
    }
  }

  /** The four degrees, when an action prints them. */
  #outcomeList() {
    const out = this.system.outcomes;
    if (!out) return null;
    const rows = [
      { key: "critSuccess", label: "STARWROUGHT.Degree.critSuccess", text: out.critSuccess },
      { key: "success", label: "STARWROUGHT.Degree.success", text: out.success },
      { key: "fail", label: "STARWROUGHT.Degree.fail", text: out.fail },
      { key: "critFail", label: "STARWROUGHT.Degree.critFail", text: out.critFail }
    ].filter(r => r.text);
    return rows.length ? rows : null;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    // Give new Items a type-appropriate icon rather than the generic bag.
    if (!data.img || (data.img === "icons/svg/item-bag.svg")) {
      const img = SW.TYPE_ICONS[this.type];
      if (img) this.updateSource({ img });
    }
  }

  /* -------------------------------------------- */

  /**
   * Hand over a Talent named by another Talent's Free Talent column, with no point spent.
   * Drilled is the case this exists for: it gives you Weapon Familiarity outright.
   * @param {Actor} actor
   * @param {string} name  The Talent's name, which may live in any Constellation.
   */
  static async grantFreeTalent(actor, name, { inherit = "" } = {}) {
    if (!actor || !name) return null;
    const key = String(name).replace(/[◆◇↺★]/g, "").trim().toLowerCase();
    const owned = actor.items.some(i => (i.type === "talent")
      && (i.name.replace(/[◆◇↺★]/g, "").trim().toLowerCase() === key));
    if (owned) return null;

    const pack = game.packs.get(`${SW.SYSTEM_ID}.talents`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.constellation"] });
    const entry = index.find(e => e.name.replace(/[◆◇↺★]/g, "").trim().toLowerCase() === key);
    if (!entry) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Chargen.freeTalentMissing", { name }));
      return null;
    }

    const doc = await pack.getDocument(entry._id);
    await this.ensureConstellation(actor, doc.system.constellation);
    const data = doc.toObject();

    // The granting Talent's answer carries across when it is a legal answer here, so Drilled and
    // the Weapon Familiarity it hands over are one question rather than two.
    if (inherit && data.system.choice?.prompt && !data.system.choice.value) {
      const { loadChargenContent, choiceOptions } = await import("../helpers/chargen-data.mjs");
      await loadChargenContent();
      const options = choiceOptions(data.system.choice.prompt);
      if (!options || options.includes(inherit)) data.system.choice.value = inherit;
    }

    // Deliberately not swAuto unless the question is already settled: the free Talent may have a
    // build-time question of its own, and the createItem hook is what asks it. The owned check
    // above is what stops that recursing.
    const settled = !data.system.choice?.prompt || !!data.system.choice.value;
    const [created] = await actor.createEmbeddedDocuments("Item", [data], { swAuto: settled });
    ui.notifications.info(game.i18n.format("STARWROUGHT.Chargen.freeTalentGranted", { name: doc.name }));
    return created ?? null;
  }

  /**
   * Opening a Constellation is buying its Root, so when a Talent arrives on a character who has
   * no Constellation Item for it, fetch one from the compendium so the sky is drawn.
   */
  static async ensureConstellation(actor, slug) {
    if (!actor || !slug) return null;
    const existing = actor.items.find(i => (i.type === "constellation")
      && ((i.system.slug || SW.slugify(i.name)) === slug));
    if (existing) return existing;
    const pack = game.packs.get(`${SW.SYSTEM_ID}.constellations`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.slug"] });
    const entry = index.find(e => (e.system?.slug ?? SW.slugify(e.name)) === slug);
    if (!entry) return null;
    const doc = await pack.getDocument(entry._id);
    const created = await actor.createEmbeddedDocuments("Item", [doc.toObject()], { swAuto: true });
    return created[0] ?? null;
  }
}
