/**
 * The adversary sheet.
 *
 * Written Threshold-first, because the players roll everything. Every number here is a number a
 * player has to beat, which is why the Attack rows show all three Multiple Attack Penalty steps:
 * a monster's second swing is a worse swing, and the table gets to watch it happen.
 */

import * as SW from "../config.mjs";
import { stanceContext } from "../helpers/stance.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SwNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["starwrought", "sheet", "actor", "npc"],
    position: { width: 720, height: 720 },
    window: { resizable: true, icon: "fa-solid fa-dragon" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: SwNpcSheet.#onEditImage,
      setStance: SwNpcSheet.#onSetStance,
      itemUse: SwNpcSheet.#onItemUse,
      itemEdit: SwNpcSheet.#onItemEdit,
      itemDelete: SwNpcSheet.#onItemDelete,
      itemCreate: SwNpcSheet.#onItemCreate,
      toggleZone: SwNpcSheet.#onToggleZone,
      recenter: SwNpcSheet.#onRecenter,
      effectCreate: SwNpcSheet.#onEffectCreate,
      effectEdit: SwNpcSheet.#onEffectEdit,
      effectDelete: SwNpcSheet.#onEffectDelete
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: "systems/starwrought/templates/actor/npc-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    statblock: { template: "systems/starwrought/templates/actor/npc-statblock.hbs", scrollable: [""] },
    abilities: { template: "systems/starwrought/templates/actor/npc-abilities.hbs", scrollable: [""] },
    effects: { template: "systems/starwrought/templates/actor/effects.hbs", scrollable: [""] },
    biography: { template: "systems/starwrought/templates/actor/biography.hbs", scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      initial: "statblock",
      labelPrefix: "STARWROUGHT.Tab",
      tabs: [
        { id: "statblock", icon: "fa-solid fa-shield-halved" },
        { id: "abilities", icon: "fa-solid fa-bolt" },
        { id: "effects", icon: "fa-solid fa-wand-sparkles" },
        { id: "biography", icon: "fa-solid fa-book-open" }
      ]
    }
  };

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const sys = actor.system;

    Object.assign(context, {
      actor,
      system: sys,
      fields: sys.schema.fields,
      editable: this.isEditable,
      owner: actor.isOwner,
      config: SW,
      SW
    });

    context.defenses = Object.values(sys.defenses).map(def => ({
      ...def,
      label: game.i18n.localize(def.label),
      hint: game.i18n.localize(def.hint)
    }));
    context.stance = stanceContext(actor);

    context.zones = Object.keys(SW.ZONES).map(key => ({
      ...sys.zones[key],
      key,
      label: game.i18n.localize(SW.ZONES[key].label),
      materialLabel: game.i18n.localize(sys.zones[key].materialLabel),
      weakTo: sys.zones[key].weakTo ? game.i18n.localize(SW.DAMAGE_TYPES[sys.zones[key].weakTo].label) : null
    }));

    context.attacks = sys.attacks;
    context.abilities = actor.items.filter(i => (i.type === "action") && !i.system.attack.enabled);
    context.otherItems = actor.items.filter(i => !["action"].includes(i.type));
    context.effects = actor.effects.map(e => ({ id: e.id, name: e.name, img: e.img, disabled: e.disabled }));

    context.sizeChoices = Object.fromEntries(
      Object.entries(SW.SIZES).map(([k, v]) => [k, game.i18n.localize(v.label)])
    );
    context.materialChoices = Object.fromEntries(
      Object.entries(SW.MATERIALS).map(([k, v]) => [k, game.i18n.localize(v.label)])
    );

    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    context.enrichedBiography = await TextEditor.enrichHTML(sys.details.biography, { relativeTo: actor });
    context.enrichedNotes = await TextEditor.enrichHTML(sys.details.notes, { relativeTo: actor });
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context) {
    context.partId = partId;
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */

  static async #onSetStance(event, target) {
    return this.document.setStance(target.dataset.stance);
  }

  static async #onEditImage() {
    if (!this.isEditable) return;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.document.img,
      callback: path => this.document.update({ img: path })
    });
    return fp.browse();
  }

  static async #onItemUse(event, target) {
    return this.#getItem(target)?.use();
  }

  static async #onItemEdit(event, target) {
    return this.#getItem(target)?.sheet.render({ force: true });
  }

  static async #onItemDelete(event, target) {
    return this.#getItem(target)?.delete();
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type ?? "action";
    const attack = target.dataset.attack === "true";
    return this.document.createEmbeddedDocuments("Item", [{
      name: game.i18n.format("STARWROUGHT.Prompt.newItem", {
        type: game.i18n.localize(CONFIG.Item.typeLabels[type] ?? type)
      }),
      type,
      system: attack ? { attack: { enabled: true } } : {}
    }]);
  }

  static async #onToggleZone(event, target) {
    const zone = target.dataset.zone;
    return this.document.setExposed(zone, !this.document.system.zones[zone].exposed);
  }

  static async #onRecenter() {
    return this.document.recenter();
  }

  static async #onEffectCreate() {
    return this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARWROUGHT.Effect.new"), img: "icons/svg/aura.svg"
    }]);
  }

  static async #onEffectEdit(event, target) {
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    return this.document.effects.get(id)?.sheet.render({ force: true });
  }

  static async #onEffectDelete(event, target) {
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    return this.document.effects.get(id)?.delete();
  }

  #getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.document.items.get(id) ?? null;
  }
}
