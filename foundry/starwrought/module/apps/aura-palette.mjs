/**
 * The aura palette: the small window the Token HUD's ring button opens (0.5.1).
 *
 * One row per range the token carries, with its name, its feet, a swatch in the colour the ring is
 * drawn in, and the Visible toggle: lit, the ring is pinned for everyone while an encounter runs;
 * unlit, it shows only in the preview, on hover, control and drag. Below the list, a Custom row
 * for owners and the GM (feet, label, who it concerns, a colour; the GM also gets GM-only), for the
 * "within 20 feet" the GM improvises mid-fight and the data has no cell for.
 *
 * Non-modal and small, beside the HUD, like the Combat Prompt. It re-renders itself as the actor
 * changes (every mark is an actor update, so another client's flip shows at once) and closes when
 * the canvas changes under it or the token goes.
 */

import * as SW from "../config.mjs";
import { AUDIENCES, rangesFor, rangeFor, rangeContext, visibleRanges } from "../canvas/auras.mjs";
import { AURA_COLORS } from "../canvas/rings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = "systems/starwrought/templates/apps/aura-palette.hbs";

export class SwAuraPalette extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "sw-aura-palette",
    tag: "form",
    classes: ["starwrought", "sw-aura-palette"],
    position: { width: 340, height: "auto" },
    window: {
      title: "STARWROUGHT.Aura.paletteTitle",
      icon: "fa-solid fa-circle-dot",
      resizable: false,
      minimizable: false
    },
    form: { handler: SwAuraPalette.#onAddCustom, submitOnChange: false, closeOnSubmit: false },
    actions: {
      toggleVisible: SwAuraPalette.#onToggleVisible,
      removeCustom: SwAuraPalette.#onRemoveCustom,
      allOff: SwAuraPalette.#onAllOff
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: TEMPLATE }
  };

  /**
   * @param {Token} token
   * @param {object} [options]
   */
  constructor(token, options = {}) {
    super(options);
    this.#token = token;
  }

  /** The token whose actor this palette edits. */
  #token = null;

  /** The hooks registered while rendered, as [name, id] pairs, taken off on close. */
  #hooks = [];

  get token() {
    return this.#token;
  }

  get actor() {
    return this.#token?.actor ?? null;
  }

  /** @inheritdoc */
  get title() {
    const name = this.actor?.name ?? "";
    return `${game.i18n.localize("STARWROUGHT.Aura.paletteTitle")}: ${name}`.trim();
  }

  /* -------------------------------------------- */
  /*  Opening                                     */
  /* -------------------------------------------- */

  /** The one palette of this client. */
  static #instance = null;

  static get instance() {
    return SwAuraPalette.#instance;
  }

  /**
   * Open the palette for a token beside the HUD button that asked, or close it if it is already
   * open for that token: the button is a toggle.
   * @param {Token} token
   * @param {object} [options]
   * @param {HTMLElement} [options.anchor]  The element to sit beside.
   * @returns {Promise<SwAuraPalette|null>}
   */
  static async open(token, { anchor = null } = {}) {
    const existing = SwAuraPalette.#instance;
    if (existing?.rendered) {
      const same = existing.token === token;
      await existing.close();
      if (same) return null;
    }
    const app = new SwAuraPalette(token);
    SwAuraPalette.#instance = app;
    const position = anchor ? SwAuraPalette.#beside(anchor) : {};
    return app.render({ force: true, position });
  }

  /** A position just right of an element, kept on screen. */
  static #beside(element) {
    const rect = element.getBoundingClientRect();
    const width = SwAuraPalette.DEFAULT_OPTIONS.position.width;
    return {
      left: Math.max(0, Math.min(window.innerWidth - width - 16, rect.right + 12)),
      top: Math.max(0, Math.min(window.innerHeight - 200, rect.top - 8))
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const rows = actor ? rangesFor(actor).map(rangeContext) : [];
    const isGM = game.user.isGM;
    const palette = SW.AURA_COLORS ?? AURA_COLORS;
    return Object.assign(context, {
      actor,
      rows,
      any: rows.length > 0,
      visibleCount: rows.filter(r => r.visible).length,
      isGM,
      owner: !!actor?.isOwner,
      audiences: Object.fromEntries(Object.entries(AUDIENCES).map(([k, v]) => [k, game.i18n.localize(v)])),
      // Color.from reads a "#rrggbb" string; the constructor takes a number, and a string there
      // comes out black.
      defaultColor: foundry.utils.Color.from(palette.all ?? AURA_COLORS.all).css
    });
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#listen();
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    if (SwAuraPalette.#instance === this) SwAuraPalette.#instance = null;
  }

  /**
   * Follow the actor: every mark is an actor update and every aura is an Item, so a change from any
   * client re-renders the rows, and the HUD's badge with them. Close when the ground moves.
   */
  #listen() {
    if (this.#hooks.length) return;
    const follow = doc => {
      const actor = this.actor;
      if (!actor) return;
      if ((doc !== actor) && (doc?.parent !== actor)) return;
      this.render();
      const hud = canvas.tokens?.hud ?? canvas.hud?.token;
      if (hud?.rendered && (hud.object === this.#token)) hud.render();
    };
    for (const name of ["updateActor", "createItem", "updateItem", "deleteItem"]) {
      this.#hooks.push([name, Hooks.on(name, follow)]);
    }
    this.#hooks.push(["canvasReady", Hooks.on("canvasReady", () => this.close())]);
    this.#hooks.push(["deleteToken", Hooks.on("deleteToken", doc => {
      if (doc.id === this.#token?.document?.id) this.close();
    })]);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Flip one range's Visible mark. */
  static async #onToggleVisible(event, target) {
    const actor = this.actor;
    const key = target.dataset.key;
    if (!actor || !key) return;
    const current = rangeFor(actor, key)?.visible ?? false;
    await actor.setAuraVisible(key, !current);
  }

  /** Take a custom ring off the actor. */
  static async #onRemoveCustom(event, target) {
    const actor = this.actor;
    const key = target.dataset.key;
    if (!actor || !key) return;
    await actor.removeCustomAura(key);
  }

  /** Every mark on this actor off: what the HUD button's right-click does, with a button for it. */
  static async #onAllOff() {
    const actor = this.actor;
    if (!actor) return;
    const keys = visibleRanges(actor).map(r => r.key);
    if (keys.length) await actor.setAuraVisible(keys, false);
  }

  /** The Custom row's submit: a new ring, Visible from the start. */
  static async #onAddCustom(event, form, formData) {
    const actor = this.actor;
    if (!actor) return;
    const data = foundry.utils.expandObject(formData.object);
    const feet = Number(data.feet);
    if (!Number.isFinite(feet) || (feet < 0)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Aura.badFeet"));
      return;
    }
    const label = String(data.label ?? "").trim() || game.i18n.format("STARWROUGHT.Aura.customDefaultLabel", { feet });
    const audience = (data.audience in AUDIENCES) ? data.audience : "all";
    const color = ((typeof data.color === "string") && data.color.trim()) ? data.color.trim() : null;
    const gmOnly = game.user.isGM && !!data.gmOnly;
    await actor.addCustomAura({ label, feet, audience, color, gmOnly });
  }
}
