/**
 * The adversary sheet.
 *
 * Written Threshold-first, because the players roll everything. Every number here is a number a
 * player has to beat. An Attack has one Threshold: PHB v4.10 has no Multiple Attack Penalty, so a
 * monster's second swing costs it actions, not accuracy.
 */

import * as SW from "../config.mjs";
import { stanceContext } from "../helpers/stance.mjs";
import { actionsContext, bindContext, vigorContext, zoneWounds, rulesPageOf } from "./actor-sheet.mjs";
import { openRulesPage } from "../documents/chat.mjs";
// AURAS (0.5.1): the ring toggle on an ability row that carries an aura.
import { auraRowsByItem, rangeFor } from "../canvas/auras.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SwNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["starwrought", "sheet", "actor", "npc"],
    position: { width: 720, height: 760 },
    window: { resizable: true, icon: "fa-solid fa-dragon" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: SwNpcSheet.#onEditImage,
      setStance: SwNpcSheet.#onSetStance,
      attackWith: SwNpcSheet.#onAttackWith,
      itemUse: SwNpcSheet.#onItemUse,
      itemChat: SwNpcSheet.#onItemChat,
      itemEdit: SwNpcSheet.#onItemEdit,
      itemDelete: SwNpcSheet.#onItemDelete,
      itemCreate: SwNpcSheet.#onItemCreate,
      toggleZone: SwNpcSheet.#onToggleZone,
      recenter: SwNpcSheet.#onRecenter,
      treatWound: SwNpcSheet.#onTreatWound,
      adjustWound: SwNpcSheet.#onAdjustWound,
      endBind: SwNpcSheet.#onEndBind,
      rulesPage: SwNpcSheet.#onRulesPage,
      setActions: SwNpcSheet.#onSetActions,
      resetActions: SwNpcSheet.#onResetActions,
      pass: SwNpcSheet.#onPass,
      endOpportunity: SwNpcSheet.#onEndOpportunity,
      finishPrepared: SwNpcSheet.#onFinishPrepared,
      abandonPrepared: SwNpcSheet.#onAbandonPrepared,
      effectCreate: SwNpcSheet.#onEffectCreate,
      effectEdit: SwNpcSheet.#onEffectEdit,
      effectDelete: SwNpcSheet.#onEffectDelete,
      effectToggle: SwNpcSheet.#onEffectToggle,
      // AURAS (0.5.1)
      toggleAura: SwNpcSheet.#onToggleAura
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
      isGM: game.user.isGM,
      config: SW,
      SW
    });

    context.defenses = Object.values(sys.defenses).map(def => ({
      ...def,
      label: game.i18n.localize(def.label),
      hint: game.i18n.localize(def.hint)
    }));
    context.stance = stanceContext(actor);
    context.bind = bindContext(actor);
    context.actions = actionsContext(actor);
    context.vigor = vigorContext(actor);
    context.spent = sys.spent ?? ((sys.vigor?.value ?? 1) === 0);
    context.dyingMax = SW.DYING_MAX;
    context.actionsPerRound = sys.actionsPerRound ?? SW.ACTIONS_PER_ROUND;
    context.woundCount = sys.woundCount ?? Object.keys(SW.ZONES).reduce((n, z) => n + (sys.zones[z]?.wounds ?? 0), 0);

    context.zones = Object.keys(SW.ZONES).map(key => ({
      ...sys.zones[key],
      key,
      label: game.i18n.localize(SW.ZONES[key].label),
      materialLabel: game.i18n.localize(sys.zones[key].materialLabel),
      weakTo: sys.zones[key].weakTo ? game.i18n.localize(SW.DAMAGE_TYPES[sys.zones[key].weakTo].label) : null,
      wounds: zoneWounds(actor, key)
    }));

    // One Threshold per Attack. The derived row is expected to carry `threshold`; an older shape
    // that still carried the MAP ladder is read at its first step so nothing goes blank mid-sync.
    context.attacks = (sys.attacks ?? []).map(atk => ({
      ...atk,
      threshold: atk.threshold ?? atk.thresholds?.[0] ?? ""
    }));

    // The Reactions it has: its own abilities that carry the Reaction trait. The Talent-granted
    // four (Parry, Void, Counter, Intercept) are the GM's to declare for any adversary, so they
    // live on the stance chips and the Intercept card rather than in the profile, which the book
    // says lists the Reactions the creature has. Skipped entirely when there are none.
    const abilities = actor.items.filter(i => (i.type === "action") && i.system.reaction);
    context.reactions = {
      granted: [],
      abilities: abilities.map(i => ({ id: i.id, name: i.name, img: i.img, glyph: i.system.glyph })),
      any: abilities.length > 0
    };

    context.abilities = actor.items.filter(i => (i.type === "action") && !i.system.attack.enabled);
    // AURAS (0.5.1): the ring toggle beside each ability row that carries an aura, by Item id.
    context.auraByItem = auraRowsByItem(actor);
    context.otherItems = actor.items.filter(i => !["action"].includes(i.type));
    context.effects = actor.effects.map(e => ({
      id: e.id, name: e.name, img: e.img, disabled: e.disabled,
      // The rules page a condition's row opens, when its condition has one (0.5.1, T6).
      rulesPage: rulesPageOf(e)
    }));

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

  /**
   * An attack row's Strike buttons (0.5.0 brief, Entry points): declare this adversary's Maneuver,
   * Quick ❶, Deliberate ❷ or Committed ❸, against the GM's current targets. The Strike kind is the
   * button pressed; the defenders commit and reveal, and the players roll Defense.
   */
  static async #onAttackWith(event, target) {
    const item = this.#getItem(target);
    if (!item) return;
    const strike = SW.STRIKE_KINDS[target.dataset.strike] ? target.dataset.strike : SW.DEFAULT_STRIKE;
    return this.document.attackWith(item.id, { strike });
  }

  static async #onItemUse(event, target) {
    return this.#getItem(target)?.use({ dialog: !event.shiftKey });
  }

  static async #onItemChat(event, target) {
    return this.#getItem(target)?.toMessage();
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

  static async #onTreatWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    return this.document.treatWound(zone);
  }

  /** Adding a Wound fires its rules through `applyWound`; taking one off is plain bookkeeping. */
  static async #onAdjustWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    const delta = Number(target.dataset.delta) || 0;
    if (delta > 0) return this.document.applyWound(zone, delta);
    const current = this.document.system.zones[zone]?.wounds ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    await this.document.update({ [`system.zones.${zone}.wounds`]: next });
    const any = Object.keys(SW.ZONES).some(z => (this.document.system.zones[z]?.wounds ?? 0) > 0);
    return this.document.setCondition("wounded", any);
  }

  static async #onEndBind() {
    return this.document.endBind();
  }

  /** The bind line and a condition row open their Rules Reference page (0.5.1, T6). */
  static async #onRulesPage(event, target) {
    return openRulesPage(target.dataset.page);
  }

  static async #onSetActions(event, target) {
    if (target.dataset.state === "reserved") return;
    const value = Number(target.dataset.value);
    const current = this.document.system.actions?.value ?? 0;
    return this.document.update({ "system.actions.value": value === current ? value - 1 : value });
  }

  static async #onResetActions() {
    // By hand, so a player-owned adversary's reset is said in chat like the pips are (audit).
    return this.document.resetActions({ byHand: true });
  }

  /**
   * An open Biography editor across a re-render, as the character sheet keeps it (see
   * SwCharacterSheet._preSyncPartState for the why): the draft is written to the document here,
   * since the change the editor fires is dropped while the sheet is rendering, and the reopened
   * editor is seeded with it.
   * @inheritdoc
   */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    state.swOpenEditors = [];
    state.swDrafts = {};
    for (const editor of priorElement.querySelectorAll("prose-mirror[open]")) {
      if (editor.name) state.swOpenEditors.push(editor.name);
      let changed = false;
      const onChange = () => { changed = true; };
      editor.addEventListener("change", onChange);
      try { editor.save(); } catch (err) { console.error("STARWROUGHT | an open editor could not be saved before the sheet redrew", err); }
      editor.removeEventListener("change", onChange);
      if (changed && editor.name) state.swDrafts[editor.name] = editor.value;
    }
    if (this.isEditable && !foundry.utils.isEmpty(state.swDrafts)) {
      this.document.update(foundry.utils.deepClone(state.swDrafts))
        .catch(err => console.error("STARWROUGHT | an editor's draft could not be written while the sheet redrew", err));
    }
  }

  /** @inheritdoc */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    const drafts = state.swDrafts ?? {};
    for (const name of state.swOpenEditors ?? []) {
      const editor = newElement.querySelector(`prose-mirror[name="${CSS.escape(name)}"]`);
      if (!editor || editor.disabled) continue;
      if (name in drafts) editor.value = drafts[name];
      editor.toggleAttribute("open", true);
    }
  }

  static async #onPass() {
    return this.document.pass();
  }

  static async #onEndOpportunity() {
    if (!this.document.isTurn) return;
    return game.combat?.nextTurn();
  }

  static async #onFinishPrepared() {
    return this.document.finishPrepared();
  }

  static async #onAbandonPrepared() {
    return this.document.abandonPrepared();
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

  static async #onEffectToggle(event, target) {
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(id);
    return effect?.update({ disabled: !effect.disabled });
  }

  /* -------------------------------------------- */
  /*  Auras (0.5.1)                               */
  /* -------------------------------------------- */

  /** The ring toggle on an ability row: flip the Visible mark. */
  static async #onToggleAura(event, target) {
    const key = target.dataset.key;
    if (!key) return;
    const current = rangeFor(this.document, key)?.visible ?? false;
    return this.document.setAuraVisible(key, !current);
  }

  #getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.document.items.get(id) ?? null;
  }
}
