/**
 * One sheet for every kind of Item. The Details part branches on the Item type rather than
 * registering eight nearly identical Applications.
 */

import * as SW from "../config.mjs";
import { enabledConstellations } from "../helpers/content.mjs";
import { promptForChoice } from "./chargen.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class SwItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["starwrought", "sheet", "item"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: SwItemSheet.#onEditImage,
      addTrait: SwItemSheet.#onAddTrait,
      removeTrait: SwItemSheet.#onRemoveTrait,
      addRequirement: SwItemSheet.#onAddRequirement,
      removeRequirement: SwItemSheet.#onRemoveRequirement,
      effectCreate: SwItemSheet.#onEffectCreate,
      effectEdit: SwItemSheet.#onEffectEdit,
      effectDelete: SwItemSheet.#onEffectDelete,
      chooseValue: SwItemSheet.#onChooseValue
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: "systems/starwrought/templates/item/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    description: { template: "systems/starwrought/templates/item/description.hbs", scrollable: [""] },
    details: { template: "systems/starwrought/templates/item/details.hbs", scrollable: [""] },
    effects: { template: "systems/starwrought/templates/item/effects.hbs", scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      initial: "description",
      labelPrefix: "STARWROUGHT.Tab",
      tabs: [
        { id: "description", icon: "fa-solid fa-align-left" },
        { id: "details", icon: "fa-solid fa-sliders" },
        { id: "effects", icon: "fa-solid fa-wand-sparkles" }
      ]
    }
  };

  /* -------------------------------------------- */

  /**
   * Item types that are the book's rather than the player's: a non-GM user opens their sheet to
   * read, never to edit (0.5.1, T15). A Talent's build-time choice is still the owner's to answer,
   * through the dialog that asks when the Talent arrives, or the Choose control this sheet keeps
   * for the owner when that dialog was declined. Gear and Maneuvers stay the owner's to edit: a
   * player renames their own sword.
   */
  static READ_ONLY_FOR_PLAYERS = Object.freeze(["talent", "constellation", "chassis"]);

  /** Is this sheet read-only for this user only because of what the Item is, not who owns it? */
  get lockedForPlayer() {
    return !game.user.isGM && SwItemSheet.READ_ONLY_FOR_PLAYERS.includes(this.document.type);
  }

  /**
   * @inheritdoc
   * False for a player on a Talent, Constellation or Chassis: DocumentSheetV2 then disables every
   * form element on render and refuses the form's submission, and the templates hide the add and
   * delete controls behind `editable`.
   */
  get isEditable() {
    if (!super.isEditable) return false;
    return !this.lockedForPlayer;
  }

  /**
   * A player's Talent sheet is read-only, but its build-time choice is still the owner's to
   * answer: ask the arrival question again and write that one field through the document, not
   * the form. The control is an anchor, not a form element, so DocumentSheetV2's disabling pass
   * leaves it clickable (review, 2026-10-01).
   */
  static async #onChooseValue() {
    const item = this.document;
    if (!item.isOwner || (item.type !== "talent") || !item.system.choice?.prompt) return;
    const { loadChargenContent } = await import("../helpers/chargen-data.mjs");
    await loadChargenContent();
    const value = await promptForChoice(item.system.choice.prompt, item.name);
    if (value) await item.update({ "system.choice.value": value });
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;

    Object.assign(context, {
      item,
      system: item.system,
      fields: item.system.schema.fields,
      editable: this.isEditable,
      lockedForPlayer: this.lockedForPlayer,
      canAnswerChoice: this.lockedForPlayer && item.isOwner && !!item.system.choice?.prompt,
      config: SW,
      SW,
      type: item.type,
      typeLabel: game.i18n.localize(CONFIG.Item.typeLabels[item.type] ?? item.type),
      isTalent: item.type === "talent",
      isConstellation: item.type === "constellation",
      isChassis: item.type === "chassis",
      isWeapon: item.type === "weapon",
      isArmor: item.type === "armor",
      isShield: item.type === "shield",
      isGear: item.type === "gear",
      isAction: item.type === "action",
      isPhysical: SW.PHYSICAL_TYPES.includes(item.type)
    });

    // Choice lists, localized once here so the templates stay declarative.
    const costs = Object.fromEntries(Object.keys(SW.ACTION_COSTS).map(k => [k, costLabel(k)]));
    const ownSlug = item.type === "constellation" ? (item.system.slug || SW.slugify(item.name)) : null;
    // The selects offer what the spreadsheets enable (ruling 61), plus whatever this Item already
    // says: an owned Talent of a Constellation that has since been switched off still shows its
    // own Constellation rather than a blank, and saving the sheet does not silently move it.
    const enabled = enabledConstellations();
    const current = [item.system.constellation, item.system.check?.constellation];
    context.choices = {
      attributes: this.#choices(SW.ATTRIBUTES),
      categories: this.#choices(SW.CATEGORIES),
      tiers: Object.fromEntries(Object.entries(SW.TIERS).map(([k, v]) => [k, game.i18n.localize(v.label)])),
      zones: this.#choices(SW.ZONES),
      materials: this.#choices(SW.MATERIALS),
      damageTypes: this.#choices(SW.DAMAGE_TYPES),
      handling: this.#choices(SW.HANDLING),
      // passive, then ⓿ through ❻, each labelled with its glyph (PHB v4.10, Symbols).
      costs,
      // A Reaction's own cost: the same keys, minus passive, since a Reaction is something you do.
      reactionCosts: Object.fromEntries(Object.entries(costs).filter(([k]) => k !== "passive")),
      costModes: {
        to: game.i18n.localize("STARWROUGHT.Field.costModeTo"),
        or: game.i18n.localize("STARWROUGHT.Field.costModeOr")
      },
      sizes: this.#choices(SW.SIZES),
      defenses: this.#choices(SW.DEFENSES),
      groups: Object.fromEntries(SW.WEAPON_GROUPS.map(g => [g, g])),
      constellations: Object.fromEntries(
        withCurrent(enabled, current)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => [c.slug, c.name])
      ),
      // A parent Constellation: Melee or Ranged today, listed first; anything but itself is allowed
      // so a third parent (the book promises Magic) needs no code change.
      parents: Object.fromEntries(
        withCurrent(enabled, [item.system.parentSlug])
          .filter(c => c.slug !== ownSlug)
          .sort((a, b) => (isParentSlug(b.slug) - isParentSlug(a.slug)) || a.name.localeCompare(b.name))
          .map(c => [c.slug, c.name])
      ),
      kinds: {
        ancestry: game.i18n.localize("STARWROUGHT.Chassis.ancestry"),
        bloodline: game.i18n.localize("STARWROUGHT.Chassis.bloodline"),
        culture: game.i18n.localize("STARWROUGHT.Chassis.culture"),
        background: game.i18n.localize("STARWROUGHT.Chassis.background"),
        calling: game.i18n.localize("STARWROUGHT.Chassis.calling")
      }
    };

    // A Talent's build-time question gets a real list where the system knows one.
    if (item.type === "talent" && item.system.choice?.prompt) {
      const { loadChargenContent, choiceOptions } = await import("../helpers/chargen-data.mjs");
      await loadChargenContent();
      const options = choiceOptions(item.system.choice.prompt);
      // Keep the Item's own answer even when the list no longer offers it (a Skill switched off
      // after it was chosen), as withCurrent does for the Constellation selects: the sheet submits
      // the whole form on every change, so a select showing blank would write "" and reopen the
      // question.
      const value = item.system.choice.value;
      if (options && value && !options.includes(value)) options.push(value);
      context.choiceOptions = options ? Object.fromEntries(options.map(o => [o, o])) : null;
    }

    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    context.enrichedDescription = await TextEditor.enrichHTML(item.system.description ?? "", {
      relativeTo: item, rollData: item.getRollData()
    });
    context.enrichedEffect = await TextEditor.enrichHTML(item.system.effect ?? "", {
      relativeTo: item, rollData: item.getRollData()
    });
    context.enrichedSpecial = await TextEditor.enrichHTML(item.system.specialAbility ?? "", {
      relativeTo: item, rollData: item.getRollData()
    });

    // The parent's name, for the Constellation subline and the "counts toward" note. The field is
    // `parentSlug` (`parent` on a data model is the owning Item); the model derives `parentName`.
    if (item.type === "constellation" && item.system.parentSlug) {
      context.parentName = item.system.parentName || SW.getConstellation(item.system.parentSlug).name;
    }
    // Weapon trait flags the sheet calls out, since three of them decide what the weapon can do in
    // a Bind: a Flexible weapon cannot Parry or Bind, Massive Wounds on any crit, Unparryable
    // cannot be Parried. The data model parses the Traits string into `system.flags`.
    if (item.type === "weapon") {
      context.bindTraits = ["flexible", "massive", "unparryable", "parry"]
        .filter(flag => item.system.flags?.[flag])
        .map(flag => game.i18n.localize(`STARWROUGHT.Trait.${flag}`));
    }

    context.effects = item.effects.map(e => ({ id: e.id, name: e.name, img: e.img, disabled: e.disabled }));
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context) {
    context.partId = partId;
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /** Turn a config map into a {key: localizedLabel} object for a select. */
  #choices(map) {
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, game.i18n.localize(v.label)]));
  }

  /* -------------------------------------------- */

  static async #onEditImage() {
    if (!this.isEditable) return;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.document.img,
      callback: path => this.document.update({ img: path })
    });
    return fp.browse();
  }

  static async #onAddTrait(event, target) {
    const input = target.closest(".trait-editor")?.querySelector("input[name='newTrait']");
    const value = input?.value?.trim();
    if (!value) return;
    const traits = [...this.document.system.traits, value];
    input.value = "";
    return this.document.update({ "system.traits": traits });
  }

  static async #onRemoveTrait(event, target) {
    const index = Number(target.dataset.index);
    const traits = this.document.system.traits.filter((_, i) => i !== index);
    return this.document.update({ "system.traits": traits });
  }

  static async #onAddRequirement(event, target) {
    const input = target.closest(".requirement-editor")?.querySelector("input[name='newRequirement']");
    const value = input?.value?.trim();
    if (!value) return;
    const requires = [...this.document.system.requires, value];
    input.value = "";
    return this.document.update({ "system.requires": requires });
  }

  static async #onRemoveRequirement(event, target) {
    const index = Number(target.dataset.index);
    const requires = this.document.system.requires.filter((_, i) => i !== index);
    return this.document.update({ "system.requires": requires });
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
}

/* -------------------------------------------- */

/**
 * The label a cost key gets in a select: the localized text with its glyph shown exactly once.
 * The Action.* strings are written with the glyph on the end ("One action ❶"); if a lang file
 * leaves it off, it is appended here rather than doubled. A key with no text at all falls back to
 * the glyph, so nothing renders blank.
 */
function costLabel(key) {
  const entry = SW.ACTION_COSTS[key];
  if (!entry) return key;
  const text = game.i18n.localize(entry.label);
  if (!text || text === entry.label) return entry.glyph || key;
  if (!entry.glyph || text.includes(entry.glyph)) return text;
  return `${text} ${entry.glyph}`;
}

/** 1 for Melee or Ranged, 0 for anything else: the sort key that puts the real parents first. */
function isParentSlug(slug) {
  return [SW.MELEE_SLUG, SW.RANGED_SLUG].includes(slug) ? 1 : 0;
}

/**
 * The enabled Constellations, plus any slug the Item currently holds that the list leaves out.
 * A disabled slug resolves through `getConstellation`, which keeps answering for it (ruling 61);
 * a slug nobody knows gets the synthetic entry, so the select never shows a bare blank for a
 * value that is actually set.
 * @param {object[]} enabled  Registry entries from `enabledConstellations()`.
 * @param {string[]} slugs    The Item's current values; blanks are skipped.
 * @returns {object[]}
 */
function withCurrent(enabled, slugs) {
  const list = [...enabled];
  for (const slug of slugs) {
    if (!slug || list.some(c => c.slug === slug)) continue;
    list.push(SW.getConstellation(slug));
  }
  return list;
}
