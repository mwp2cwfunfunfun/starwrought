/**
 * The character sheet.
 *
 * Laid out the way the handbook reads: who you are, then the four Defenses and the four Zones,
 * then the sky of Constellations you have actually invested in, then what you are carrying.
 */

import * as SW from "../config.mjs";
import { SwItem } from "../documents/item.mjs";
import { SwChargen } from "./chargen.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SwCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["starwrought", "sheet", "actor", "character"],
    position: { width: 880, height: 820 },
    window: {
      resizable: true,
      icon: "fa-solid fa-star",
      controls: [{
        action: "chargen",
        icon: "fa-solid fa-wand-magic-sparkles",
        label: "STARWROUGHT.Chargen.title",
        ownership: "OWNER"
      }]
    },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      chargen: SwCharacterSheet.#onChargen,
      editImage: SwCharacterSheet.#onEditImage,
      rollConstellation: SwCharacterSheet.#onRollConstellation,
      rollDefense: SwCharacterSheet.#onRollDefense,
      rollInitiative: SwCharacterSheet.#onRollInitiative,
      toggleFlare: SwCharacterSheet.#onToggleFlare,
      toggleZone: SwCharacterSheet.#onToggleZone,
      recenter: SwCharacterSheet.#onRecenter,
      rest: SwCharacterSheet.#onRest,
      recovery: SwCharacterSheet.#onRecovery,
      refuseDeath: SwCharacterSheet.#onRefuseDeath,
      itemUse: SwCharacterSheet.#onItemUse,
      itemEdit: SwCharacterSheet.#onItemEdit,
      itemDelete: SwCharacterSheet.#onItemDelete,
      itemChat: SwCharacterSheet.#onItemChat,
      itemCreate: SwCharacterSheet.#onItemCreate,
      setCarry: SwCharacterSheet.#onSetCarry,
      wearArmor: SwCharacterSheet.#onWearArmor,
      setActions: SwCharacterSheet.#onSetActions,
      toggleReaction: SwCharacterSheet.#onToggleReaction,
      resetActions: SwCharacterSheet.#onResetActions,
      toggleCollapse: SwCharacterSheet.#onToggleCollapse,
      adjust: SwCharacterSheet.#onAdjust,
      effectCreate: SwCharacterSheet.#onEffectCreate,
      effectEdit: SwCharacterSheet.#onEffectEdit,
      effectDelete: SwCharacterSheet.#onEffectDelete,
      effectToggle: SwCharacterSheet.#onEffectToggle
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: "systems/starwrought/templates/actor/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    overview: { template: "systems/starwrought/templates/actor/overview.hbs", scrollable: [""] },
    constellations: { template: "systems/starwrought/templates/actor/constellations.hbs", scrollable: [""] },
    equipment: { template: "systems/starwrought/templates/actor/equipment.hbs", scrollable: [""] },
    actions: { template: "systems/starwrought/templates/actor/actions.hbs", scrollable: [""] },
    effects: { template: "systems/starwrought/templates/actor/effects.hbs", scrollable: [""] },
    biography: { template: "systems/starwrought/templates/actor/biography.hbs", scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      initial: "overview",
      labelPrefix: "STARWROUGHT.Tab",
      tabs: [
        { id: "overview", icon: "fa-solid fa-shield-halved" },
        { id: "constellations", icon: "fa-solid fa-star" },
        { id: "equipment", icon: "fa-solid fa-sack" },
        { id: "actions", icon: "fa-solid fa-bolt" },
        { id: "effects", icon: "fa-solid fa-wand-sparkles" },
        { id: "biography", icon: "fa-solid fa-book-open" }
      ]
    }
  };

  /** Which Constellations the user has folded shut. Session state, not saved on the Actor. */
  #collapsed = new Set();

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const sys = actor.system;

    Object.assign(context, {
      actor,
      system: sys,
      source: actor.toObject().system,
      fields: actor.system.schema.fields,
      editable: this.isEditable,
      owner: actor.isOwner,
      limited: actor.limited,
      config: SW,
      SW
    });

    context.attributes = Object.entries(sys.attributes).map(([key, attr]) => ({
      key, ...attr, label: game.i18n.localize(attr.label)
    }));

    context.defenses = Object.values(sys.defenses).map(def => ({
      ...def,
      label: game.i18n.localize(def.label),
      hint: game.i18n.localize(def.hint),
      rankLabel: game.i18n.localize(def.rankLabel)
    }));

    context.zones = Object.keys(SW.ZONES).map(key => {
      const z = sys.zones[key];
      return {
        key,
        label: game.i18n.localize(SW.ZONES[key].label),
        protection: z.protection,
        exposed: z.exposed,
        piece: z.piece,
        material: z.material,
        materialLabel: game.i18n.localize(z.materialLabel ?? SW.MATERIALS.none.label),
        weakTo: z.weakTo ? game.i18n.localize(SW.DAMAGE_TYPES[z.weakTo].label) : null,
        crit: game.i18n.localize(SW.ZONE_CRITICALS[key].effect)
      };
    });

    context.constellations = this.#prepareConstellations();
    context.inventory = this.#prepareInventory();
    context.actionItems = actor.items.filter(i => i.type === "action")
      .sort((a, b) => a.name.localeCompare(b.name));
    context.effects = actor.effects.map(e => ({
      id: e.id, name: e.name, img: e.img, disabled: e.disabled,
      description: e.description, isSuppressed: e.isSuppressed
    }));

    // The wizard's own state, so a half-built character says so instead of looking broken.
    const chargenFlag = actor.getFlag(SW.SYSTEM_ID, "chargen");
    context.chargen = {
      unbuilt: actor.items.filter(i => i.type === "talent").length === 0,
      inProgress: !!chargenFlag,
      step: chargenFlag?.step ?? 0
    };

    // The action economy, shown only when it means something: in an encounter.
    const left = sys.actions?.value ?? 3;
    context.actions = {
      show: actor.inEncounter,
      isTurn: actor.isTurn,
      value: left,
      reaction: sys.actions?.reaction ?? true,
      pips: [1, 2, 3].map(value => ({
        value,
        spent: value > left,
        tooltip: game.i18n.format("STARWROUGHT.Actions.setTo", { n: value })
      })),
      tooltip: actor.isTurn
        ? game.i18n.format("STARWROUGHT.Actions.yourTurn", { left })
        : game.i18n.localize("STARWROUGHT.Actions.notYourTurn")
    };

    context.totalReachHint = sys.reachWeapon
      ? game.i18n.format("STARWROUGHT.Field.totalReachHint", {
          natural: sys.reach, weapon: sys.reachWeapon.system.reach, total: sys.totalReach
        })
      : game.i18n.format("STARWROUGHT.Field.totalReachHint", {
          natural: sys.reach, weapon: 0, total: sys.totalReach
        });

    context.dyingMax = SW.DYING_MAX;
    context.heroMax = SW.HERO_POINTS_MAX;
    context.resistancesText = SwCharacterSheet.formatDamageMods(sys.traits.resistances);
    context.weaknessesText = SwCharacterSheet.formatDamageMods(sys.traits.weaknesses);
    context.immunitiesText = Array.from(sys.traits.immunities ?? []).join(", ");
    context.sizeChoices = Object.fromEntries(
      Object.entries(SW.SIZES).map(([k, v]) => [k, game.i18n.localize(v.label)])
    );

    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    context.enrichedBiography = await TextEditor.enrichHTML(sys.details.biography, {
      relativeTo: actor, rollData: actor.getRollData()
    });
    context.enrichedNotes = await TextEditor.enrichHTML(sys.details.notes, {
      relativeTo: actor, rollData: actor.getRollData()
    });

    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context) {
    context.partId = partId;
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */

  /** Group the character's Constellations by category, in handbook order. */
  #prepareConstellations() {
    const groups = {};
    for (const entry of Object.values(this.document.system.constellations)) {
      const category = entry.category ?? "general";
      const group = (groups[category] ??= {
        key: category,
        label: game.i18n.localize(SW.CATEGORIES[category]?.label ?? SW.CATEGORIES.general.label),
        order: SW.CATEGORIES[category]?.order ?? 9,
        constellations: []
      });
      group.constellations.push({
        ...entry,
        rankLabel: game.i18n.localize(entry.rankLabel),
        attributeGlyph: SW.ATTRIBUTES[entry.attribute]?.glyph ?? "",
        attributeLabel: game.i18n.localize(SW.ATTRIBUTES[entry.attribute]?.label ?? ""),
        collapsed: this.#collapsed.has(entry.slug),
        talents: entry.talents.map(t => ({
          id: t.id,
          name: t.name,
          img: t.img,
          tier: t.system.tier,
          glyph: t.system.glyph,
          root: t.system.root || t.system.bloodlineRoot,
          effect: t.system.effect
        }))
      });
    }
    // The Origin's three Roots share one rank, so say so at the top of the group.
    if (groups.origin) {
      groups.origin.pooled = this.document.system.originPoints;
      groups.origin.pooledHint = "STARWROUGHT.Hint.originPool";
    }

    return Object.values(groups)
      .sort((a, b) => a.order - b.order)
      .map(g => {
        g.constellations.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        return g;
      });
  }

  /* -------------------------------------------- */

  /**
   * Everything the character is carrying, sorted by where it is rather than by what it is.
   *
   * Held is what is in your hands and working. Worn armor covers a Zone. Everything else is in
   * the pack or on the belt, and that is the one list: a sheathed sword and a stowed breastplate
   * belong in the same place, because in both cases the answer to "is it doing anything" is no.
   */
  #prepareInventory() {
    const actor = this.document;
    const inventory = { held: [], stowed: [], armorRows: [] };
    const wornArmor = {};

    for (const item of actor.items) {
      if (!SW.PHYSICAL_TYPES.includes(item.type)) continue;

      if (item.type === "armor") {
        if (item.system.worn && !wornArmor[item.system.zone]) wornArmor[item.system.zone] = item;
        else inventory.stowed.push(this.#carryRow(item));
        continue;
      }

      const row = item.type === "weapon" ? this.#weaponRow(item) : this.#carryRow(item);
      if (item.system.held) inventory.held.push(row);
      else inventory.stowed.push(row);
    }

    inventory.armorRows = Object.keys(SW.ZONES).map(zone => ({
      zone,
      label: game.i18n.localize(SW.ZONES[zone].label),
      item: wornArmor[zone],
      protection: actor.system.zones[zone].protection,
      exposed: actor.system.zones[zone].exposed
    }));

    // A piece can only be worn on an empty Zone, so the picker offers what is actually stowed.
    inventory.stowedArmorByZone = {};
    for (const zone of Object.keys(SW.ZONES)) {
      inventory.stowedArmorByZone[zone] = actor.items
        .filter(i => (i.type === "armor") && !i.system.worn && (i.system.zone === zone))
        .map(i => ({ id: i.id, name: i.name, protection: i.system.protection }));
    }

    inventory.held.sort((a, b) => a.name.localeCompare(b.name));
    inventory.stowed.sort((a, b) => a.name.localeCompare(b.name));
    inventory.inEncounter = actor.inEncounter;
    return inventory;
  }

  /** A plain carried thing: a shield, a stowed weapon, a piece of armor in the pack, gear. */
  #carryRow(item) {
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      state: item.system.state,
      stateLabel: game.i18n.localize(item.system.stateLabel ?? ""),
      quantity: item.system.quantity,
      price: item.system.price,
      load: item.system.load,
      raised: item.system.raised,
      isShield: item.type === "shield",
      isArmor: item.type === "armor",
      isWeapon: item.type === "weapon",
      zoneLabel: item.type === "armor" ? game.i18n.localize(item.system.zoneLabel) : "",
      protection: item.system.protection,
      bonus: item.system.bonus,
      hardness: item.system.hardness,
      // Armor is the one thing you cannot shuffle mid-fight.
      donTime: item.type === "armor" ? Math.max(1, item.system.protection) : 0
    };
  }

  /**
   * A weapon row, with the attack modifier already worked out: Weapons Proficiency after
   * Handling and Familiarity, plus the Attribute the weapon actually uses.
   */
  #weaponRow(item) {
    const actor = this.document;
    const sys = actor.system;
    const rank = actor.weaponRank(item);
    const attribute = item.system.attackAttribute;
    const attackMod = sys.level + sys.attributes[attribute].mod + SW.rankBonus(rank) + sys.bonuses.attack;
    const dice = item.system.flags.mechanical || !sys.attributes.might.mod
      ? `${sys.weapons.dice}d${item.system.effectiveDie}`
      : `${sys.weapons.dice}d${item.system.effectiveDie}+${sys.attributes.might.mod + sys.weapons.specialization}`;
    return {
      ...this.#carryRow(item),
      attackMod,
      rank,
      rankLabel: game.i18n.localize(SW.RANKS[rank].label),
      damage: `${dice} ${game.i18n.localize(SW.DAMAGE_TYPES[item.system.effectiveType].label)}`,
      // Total Reach is your Natural Reach plus the weapon's. A ranged weapon shows its range.
      reach: item.system.isRanged
        ? `${item.system.range} ft`
        : `${item.system.reach + sys.reach} ft`,
      reachHint: item.system.isRanged
        ? game.i18n.localize("STARWROUGHT.Field.rangeHint")
        : game.i18n.format("STARWROUGHT.Field.totalReachHint", {
            natural: sys.reach, weapon: item.system.reach, total: item.system.reach + sys.reach
          }),
      traits: item.system.totalTraits
    };
  }

  /* -------------------------------------------- */
  /*  Drops                                       */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDropItem(event, item) {
    const created = await super._onDropItem(event, item);
    // Buying a Talent in a Constellation you have not opened is buying its Root, so draw the sky.
    const docs = Array.isArray(created) ? created : [created];
    for (const doc of docs) {
      if (doc?.type === "talent") await SwItem.ensureConstellation(this.document, doc.system.constellation);
    }
    return created;
  }

  /* -------------------------------------------- */
  /*  Submission                                  */
  /* -------------------------------------------- */

  /**
   * Three fields on the sheet are free text over structured data: Familiarity is a Set, and
   * Resistance and Weakness are lists of type-and-number. Parse them here rather than making the
   * player fill in a table.
   * @inheritdoc
   */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);

    if ("familiarityText" in submitData) {
      foundry.utils.setProperty(submitData, "system.familiarity",
        SwCharacterSheet.splitList(submitData.familiarityText));
      delete submitData.familiarityText;
    }
    for (const key of ["resistances", "weaknesses"]) {
      const field = `${key}Text`;
      if (!(field in submitData)) continue;
      foundry.utils.setProperty(submitData, `system.traits.${key}`,
        SwCharacterSheet.parseDamageMods(submitData[field]));
      delete submitData[field];
    }
    if ("immunitiesText" in submitData) {
      foundry.utils.setProperty(submitData, "system.traits.immunities",
        SwCharacterSheet.splitList(submitData.immunitiesText).map(s => s.toLowerCase()));
      delete submitData.immunitiesText;
    }
    return submitData;
  }

  /** Split a comma-separated list, dropping the blanks. */
  static splitList(text) {
    return String(text ?? "").split(",").map(s => s.trim()).filter(Boolean);
  }

  /** "fire 5, piercing 3" into rows the data model can hold. */
  static parseDamageMods(text) {
    return SwCharacterSheet.splitList(text).map(entry => {
      const match = entry.match(/^(.*?)\s*(\d+)$/);
      if (match) return { type: match[1].trim().toLowerCase(), value: Number(match[2]) };
      return { type: entry.toLowerCase(), value: 1 };
    });
  }

  /** The reverse, for the input's value. */
  static formatDamageMods(rows) {
    return (rows ?? []).map(r => `${r.type} ${r.value}`).join(", ");
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Open the creation wizard, picking up wherever it was left. */
  static async #onChargen() {
    return new SwChargen(this.document).render({ force: true });
  }

  static async #onEditImage(event, target) {
    if (!this.isEditable) return;
    const current = this.document.img;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: path => this.document.update({ img: path })
    });
    return fp.browse();
  }

  static async #onRollConstellation(event, target) {
    const slug = target.dataset.slug;
    return this.document.rollCheck(slug, { dialog: !event.shiftKey });
  }

  static async #onRollDefense(event, target) {
    const key = target.dataset.defense;
    return this.document.rollDefense(key, { dialog: !event.shiftKey });
  }

  static async #onRollInitiative(event, target) {
    const combat = game.combat;
    const combatant = combat?.getCombatantsByActor(this.document)?.[0];
    if (!combatant) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noCombatant"));
      return;
    }
    return combat.rollInitiativeWithCheck(combatant.id, this.document.system.initiative.slug);
  }

  static async #onToggleFlare(event, target) {
    return this.document.toggleFlare(target.dataset.slug);
  }

  static async #onToggleZone(event, target) {
    const zone = target.dataset.zone;
    return this.document.setExposed(zone, !this.document.system.zones[zone].exposed);
  }

  static async #onRecenter() {
    return this.document.recenter();
  }

  static async #onRest() {
    return this.document.restForTheNight();
  }

  static async #onRecovery() {
    return this.document.rollRecovery();
  }

  static async #onRefuseDeath() {
    return this.document.refuseDeath();
  }

  static async #onItemUse(event, target) {
    const item = this.#getItem(target);
    return item?.use({ dialog: !event.shiftKey });
  }

  static async #onItemEdit(event, target) {
    return this.#getItem(target)?.sheet.render({ force: true });
  }

  static async #onItemChat(event, target) {
    return this.#getItem(target)?.toMessage();
  }

  static async #onItemDelete(event, target) {
    const item = this.#getItem(target);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format("STARWROUGHT.Prompt.deleteTitle", { name: item.name }) },
      content: `<p>${game.i18n.format("STARWROUGHT.Prompt.deleteBody", { name: item.name })}</p>`
    });
    if (confirmed) return item.delete();
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("STARWROUGHT.Prompt.newItem", {
      type: game.i18n.localize(CONFIG.Item.typeLabels[type] ?? type)
    });
    const data = { name, type };
    if (target.dataset.zone) data["system.zone"] = target.dataset.zone;
    return this.document.createEmbeddedDocuments("Item", [foundry.utils.expandObject(data)]);
  }

  /** Draw it, put it away, take it off: one control for every kind of equipment. */
  static async #onSetCarry(event, target) {
    const item = this.#getItem(target);
    if (!item) return;
    return this.document.setCarryState(item.id, target.dataset.state);
  }

  /** Put a stowed piece of armor on a Zone, chosen from what is actually in the pack. */
  static async #onWearArmor(event, target) {
    return this.document.setCarryState(target.dataset.itemId, "worn");
  }

  /** Click a pip to set how many actions are left. */
  static async #onSetActions(event, target) {
    const value = Number(target.dataset.value);
    const current = this.document.system.actions.value;
    // Clicking the pip you are already on spends it, which is the common case.
    return this.document.update({ "system.actions.value": value === current ? value - 1 : value });
  }

  static async #onToggleReaction() {
    return this.document.update({ "system.actions.reaction": !this.document.system.actions.reaction });
  }

  static async #onResetActions() {
    return this.document.resetActions();
  }

  static #onToggleCollapse(event, target) {
    const slug = target.dataset.slug;
    if (this.#collapsed.has(slug)) this.#collapsed.delete(slug);
    else this.#collapsed.add(slug);
    return this.render({ parts: ["constellations"] });
  }

  /** Plus and minus buttons on Hero Points, Wounded, Dying, and Temporary Hit Points. */
  static async #onAdjust(event, target) {
    const path = target.dataset.path;
    const delta = Number(target.dataset.delta) || 0;
    const current = foundry.utils.getProperty(this.document, path) ?? 0;
    const next = Math.max(0, current + delta);
    await this.document.update({ [path]: next });
    // Dying is also a token condition, so keep the two in step.
    if (path === "system.dying") await this.document.setCondition("dying", next);
    if (path === "system.wounded") await this.document.setCondition("wounded", next);
  }

  static async #onEffectCreate() {
    return this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("STARWROUGHT.Effect.new"),
      img: "icons/svg/aura.svg"
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

  static async #onEffectToggle(event, target) {
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(id);
    return effect?.update({ disabled: !effect.disabled });
  }

  /** Find the Item a clicked row belongs to. */
  #getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.document.items.get(id) ?? null;
  }
}
