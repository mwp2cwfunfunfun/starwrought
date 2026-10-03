/**
 * The Item document. Talents, gear, and Maneuvers all know how to put themselves on the table.
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
   * a Maneuver calls for, or simply post the card.
   *
   * A Basic Maneuver lives in the compendium and is used straight from a character's Maneuvers
   * tab without ever being copied onto the character, so it has no `actor` of its own. The sheet
   * passes the character in `options.actor`, and that character is who rolls and who speaks.
   *
   * A Maneuver with the Reaction trait (PHB v4.10) is paid from the same six actions the moment
   * its Trigger occurs, so using one spends its cost; every other Maneuver is the table's to pay,
   * with the pips, because the system cannot see most of them being used.
   * @param {object} [options]
   * @param {Actor} [options.actor]   Who is using an unowned Item.
   * @param {string} [options.strike] For a weapon: quick | deliberate | committed.
   */
  async use(options = {}) {
    const { actor: given, ...rest } = options;
    const actor = this.actor ?? given ?? null;
    switch (this.type) {
      case "weapon":
        if (!this.actor) return this.toMessage({ actor });
        return this.actor.rollAttack(this.id, rest);
      case "action": {
        if (this.system.reaction && actor) {
          // A Reaction with a cost of its own (Aid ❶ (⓿↺)) pays that one; otherwise the cost printed.
          const own = this.system.reactionCost;
          const key = (own !== undefined && own !== null && own !== "") ? own : this.system.cost;
          const n = SW.actionCostValue(key);
          if (n) {
            // The plain name, so the glyph appended here is the only one (0.5.1, T16).
            await actor.spendActions(n, { label: `${SW.plainName(this.name)} ${this.system.glyph ?? ""}`.trim() });
          }
        }
        if (this.system.check.enabled && actor) {
          return SwCheck.roll(foundry.utils.mergeObject({
            actor,
            item: this,
            kind: "check",
            slug: this.system.check.constellation,
            label: SW.plainName(this.name),
            subtitle: `${this.system.glyph} ${this.system.category}`.trim(),
            outcomes: this.#outcomeList()
          }, rest, { inplace: false }));
        }
        return this.toMessage({ actor });
      }
      case "shield":
        return this.raise();
      default:
        return this.toMessage({ actor });
    }
  }

  /* -------------------------------------------- */

  /**
   * Raise a Shield ❶ (PHB v4.10): its Gear bonus to Guard until your next Opportunity. The bonus
   * itself is derived by the data model from `system.raised`, so all this does is flip the flag
   * and pay the action; the combat tracker lowers it when the actor's next Opportunity begins.
   * A raised shield is a rigid implement: it can Parry, Bind and Gain Control. Lowering it is
   * free: you simply stop.
   */
  async raise() {
    if (!this.actor) return;
    if (!this.system.held) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notHeld", { name: this.name }));
    }
    const raised = !this.system.raised;
    if (raised) {
      // The card below carries the actions-left line, so the spend itself posts nothing.
      await this.actor.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.raiseShield"), announce: false });
    }
    await this.update({ "system.raised": raised });
    const left = raised ? (this.actor.actionsLeftLine?.() ?? "") : "";
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="starwrought action-card"><h3><span class="sw-spend-glyph">❶</span> ${game.i18n.localize("STARWROUGHT.Action.raiseShield")}</h3>
        <p>${game.i18n.format(raised ? "STARWROUGHT.Action.raiseShieldOn" : "STARWROUGHT.Action.raiseShieldOff", {
          name: this.actor.name, shield: this.name, bonus: this.system.bonus
        })}${left ? ` <strong class="sw-actions-left">${left}</strong>` : ""}</p></div>`
    });
  }

  /* -------------------------------------------- */

  /**
   * Put the Item on the table as a card, with no roll.
   * @param {object} [options]
   * @param {Actor} [options.actor]  Who speaks, when the Item is not owned (a Basic Maneuver).
   */
  async toMessage({ actor = null } = {}) {
    const speaker = this.actor ?? actor;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = html => TextEditor.enrichHTML(html ?? "", { rollData: this.getRollData(), relativeTo: this });
    const description = await enrich(this.system.chatDescription);
    // A Maneuver authored with separate flavour and rules prints both, flavour first.
    const flavor = (this.type === "action" && this.system.effect && this.system.description)
      ? await enrich(this.system.description)
      : "";
    const { renderTemplate } = foundry.applications.handlebars;
    const content = await renderTemplate("systems/starwrought/templates/chat/item-card.hbs", {
      item: this,
      description,
      flavor,
      subtitle: this.#subtitle(),
      traits: this.system.traits ?? [],
      outcomes: this.#outcomeList()
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: speaker }),
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
        // The card's title carries the glyph (item-card.hbs, 0.5.1 T16), so the subline does not.
        return String(this.system.category ?? "").trim();
      default:
        return "";
    }
  }

  /** The four degrees, when a Maneuver prints them. */
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

  /**
   * @inheritdoc
   *
   * THE PARTY'S LOOT (0.7.1; party-sheet-plan.md, part 6): a party holds gear and nothing else.
   * A Talent, a Constellation, a chassis or a Maneuver dropped on a party is refused here, with a
   * notice, before it lands, whoever drops it and from wherever (the compendium, the sidebar, a
   * character sheet). The fence is on the document so every path meets it: the party sheet's
   * drop, a macro, a module.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    const parent = this.parent;
    if ((parent?.documentName === "Actor") && (parent.type === SW.PARTY_TYPE) && !this.isPhysical) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Loot.fenceNotPhysical", {
        name: this.name,
        type: game.i18n.localize(CONFIG.Item.typeLabels?.[this.type] ?? this.type)
      }));
      return false;
    }
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
    const key = String(name).replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "").trim().toLowerCase();
    const clean = n => n.replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "").trim().toLowerCase();
    const owned = actor.items.some(i => (i.type === "talent") && (clean(i.name) === key));
    if (owned) return null;

    const pack = game.packs.get(`${SW.SYSTEM_ID}.talents`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.constellation"] });
    const entry = index.find(e => clean(e.name) === key);
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
