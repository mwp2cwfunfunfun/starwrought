/**
 * The character sheet.
 *
 * Laid out the way the handbook reads: who you are, then the four Defenses and the four Zones,
 * then the sky of Constellations you have actually invested in, then what you are carrying.
 */

import * as SW from "../config.mjs";
import { MILESTONES_PER_LEVEL } from "../config.mjs";
import { SwItem } from "../documents/item.mjs";
import { SwChargen } from "./chargen.mjs";
// NAMING A LORE (0.18.0)
import { askToNameLore } from "./lore-name.mjs";
import { loadBasicActions, enabledConstellations } from "../helpers/content.mjs";
// The header's live state and the tooltips, shared with the adversary and party sheets (0.10.1).
import { actionsContext, bindContext, rulesPageOf, vigorContext, zoneWounds, lockedTips, traitChips, windTip, weaponNumbers, recenterButton } from "../helpers/actor-context.mjs";
import { openRulesPage } from "../documents/chat.mjs";
// THE GLANCE (0.19.0): the panel a LIMITED user's sheet shows alone.
import { glanceData } from "../canvas/glance.mjs";
// THE PARTY'S LOOT (0.7.1): a party Item dropped on this sheet is a Take over the relay, not a copy.
import { requestTake } from "../documents/party-socket.mjs";
// AURAS (0.5.1): the ring toggles on the Talent and Maneuver rows and the Overview's Ranges line.
import { auraRowsByItem, reachRangeRows, rangeFor } from "../canvas/auras.mjs";
// CLAIMS (0.15.0, ruling 174): the pin on a Talent row that arms its claims for the next roll.
import { claimsOf, armClaim } from "../rules/claims.mjs";
// The Threshold tooltip's conditional rules (0.15.0): the As read line of each rule the sheet's number leaves out.
import { needsMoment } from "../rules/operators.mjs";
import { summarize } from "../rules/grammar.mjs";
// Which rolls a scope word reaches (0.36.0), for the Threshold tooltip's list.
import { scopeReaches } from "../rules/kinds/bonus.mjs";
import { usableByRule } from "../rules/engine.mjs";
// CHARACTER EFFECTS (0.16.0): the Effects tab's panel (the Overview's through 0.16.0), its state
// switch and its custom rows; since 0.17.0 a claim line's "Apply to next roll" button too.
import { effectsContext, armClaimLine, effectReadAs, effectAppliedTag, conditionInfo } from "../helpers/effects.mjs";
import { cycleRuleState, addEffect, removeEffect, removeGiven, removeUsed } from "../rules/effects-state.mjs";
// THE MANEUVERS TAB (0.28.0): which Maneuvers apply now, the Favorites first, no row twice.
import { situationOf, statusOf } from "../helpers/situation.mjs";
import { arrangeManeuvers } from "../rules/requires.mjs";
// 0.29.0: the hand-correction of a ranged weapon's shots, and the chooser behind the Strike row.
import { nextLoaded, ammunitionFor } from "../data/items/weapon-traits.mjs";

/** The character flag that holds the Favorites (0.28.0): the slugs of the bookmarked Maneuvers, in the order marked. */
const FAVORITES_FLAG = "favoriteManeuvers";

/** How long the Maneuvers tab waits after a Combat or a token changes before it looks again (ms). */
const MANEUVER_WATCH_DELAY = 150;

/**
 * The hooks that may change which Maneuvers apply without touching the character's own document:
 * the Combat and its fighters (the encounter, the Opportunity); the tokens on the scene and which
 * of the character's is selected (who is near); ANOTHER creature's Conditions (a foe that dies,
 * or goes Hidden, beside the character is no longer counted); the walls and doors (sight); and a
 * world setting (`trackActions` decides whether a cost can leave a row out). All of them only ask
 * for a look, which redraws nothing unless the list changed.
 */
const MANEUVER_WATCH_HOOKS = Object.freeze([
  "createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant",
  "createToken", "deleteToken", "controlToken", "canvasReady",
  "createActiveEffect", "updateActiveEffect", "deleteActiveEffect",
  "createWall", "updateWall", "deleteWall",
  "createSetting", "updateSetting"
]);

/** The token changes that move who is near whom; anything else on a token is not looked at. */
const TOKEN_WATCH_KEYS = Object.freeze(["x", "y", "width", "height", "hidden", "disposition", "elevation"]);

/**
 * The `bonus` rules on a character that touch a Defense but need the moment to be read (0.15.0):
 * each as `{ slug, talent, summary }`, `slug` the Defense's or "defenses" for the scope word.
 */
function conditionalDefenseRules(actor) {
  const out = [];
  if (typeof actor?.rulesOfKind !== "function") return out;
  for (const { rule, item } of actor.rulesOfKind("bonus")) {
    if (!rule?.to?.slug || !needsMoment(rule)) continue;
    const slug = rule.to.slug;
    // A scope that reaches Defenses (`defenses`, and since 0.36.0 `rolls`, a bare CHECK) is listed
    // under every Defense; a line to one Defense under that one.
    const every = (rule.to.type === "scope") && scopeReaches(slug, "defense");
    if (!every && !Object.values(SW.DEFENSES).some(d => d.slug === slug)) continue;
    out.push({ slug, every, talent: SW.plainName(item?.name ?? ""), summary: summarize(rule) });
  }
  return out;
}

/**
 * A Talent row's rich tooltip (0.17.0), in the `lockedTips` idiom (helpers/actor-context.mjs): the
 * plain name with its cost glyph as the title, the tier's word, then the Talent's Effect as the
 * HTML it is stored as (the `@Maneuver` block included), or its Description when the Effect is
 * empty. Placed in the `data-tooltip` attribute, which Handlebars escapes and Foundry's tooltip
 * reads back as HTML, as the Load Strain and locked-field tips are.
 * @param {Item} talent
 * @returns {string}
 */
function talentTip(talent) {
  const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
  const sys = talent.system ?? {};
  const glyph = sys.glyph ? `<span class="sw-tip-kind">${esc(sys.glyph)}</span>` : "";
  const tierKey = SW.TIERS?.[sys.tier]?.label;
  const tier = tierKey ? game.i18n.localize(tierKey) : String(sys.tier ?? "");
  const parts = [`<span class="sw-tip-title">${esc(SW.plainName(talent.name))}${glyph}</span>`];
  if (tier) parts.push(`<span class="sw-tip-root">${esc(tier)}</span>`);
  const body = String(sys.effect ?? "").trim() || String(sys.description ?? "").trim();
  if (body) parts.push(body);
  return parts.join("");
}

/** The Cast ❷ ❸ ❹ a spell Talent's row carries (PHB v4.21, the Cast Maneuver). */
function castButtons() {
  return Object.entries(SW.CAST_KINDS).map(([key, kind]) => ({
    key,
    glyph: SW.ACTION_GLYPHS[kind.cost],
    label: game.i18n.localize(kind.label),
    hint: game.i18n.localize(`${kind.label}Hint`)
  }));
}

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
      relevantCheck: SwCharacterSheet.#onRelevantCheck,
      rollDefense: SwCharacterSheet.#onRollDefense,
      rollInitiative: SwCharacterSheet.#onRollInitiative,
      toggleFlare: SwCharacterSheet.#onToggleFlare,
      toggleUnopened: SwCharacterSheet.#onToggleUnopened,
      // NAMING A LORE (0.18.0): a leftover Lore template's row names its field.
      nameLore: SwCharacterSheet.#onNameLore,
      toggleZone: SwCharacterSheet.#onToggleZone,
      toggleCritical: SwCharacterSheet.#onToggleCritical,
      recenter: SwCharacterSheet.#onRecenter,
      rest: SwCharacterSheet.#onRest,
      recovery: SwCharacterSheet.#onRecovery,
      refuseDeath: SwCharacterSheet.#onRefuseDeath,
      spendHeroPoint: SwCharacterSheet.#onSpendHeroPoint,
      spendComet: SwCharacterSheet.#onSpendComet,
      restTenMinutes: SwCharacterSheet.#onRestTenMinutes,
      castSpell: SwCharacterSheet.#onCastSpell,
      toggleVisor: SwCharacterSheet.#onToggleVisor,
      toggleAdjusted: SwCharacterSheet.#onToggleAdjusted,
      treatWound: SwCharacterSheet.#onTreatWound,
      adjustWound: SwCharacterSheet.#onAdjustWound,
      endBind: SwCharacterSheet.#onEndBind,
      takeControl: SwCharacterSheet.#onTakeControl,
      gainControl: SwCharacterSheet.#onGainControl,
      releaseControl: SwCharacterSheet.#onReleaseControl,
      formBindByHand: SwCharacterSheet.#onFormBindByHand,
      rulesPage: SwCharacterSheet.#onRulesPage,
      strike: SwCharacterSheet.#onStrike,
      itemUse: SwCharacterSheet.#onItemUse,
      itemEdit: SwCharacterSheet.#onItemEdit,
      itemDelete: SwCharacterSheet.#onItemDelete,
      itemChat: SwCharacterSheet.#onItemChat,
      itemCreate: SwCharacterSheet.#onItemCreate,
      basicUse: SwCharacterSheet.#onBasicUse,
      basicChat: SwCharacterSheet.#onBasicChat,
      basicView: SwCharacterSheet.#onBasicView,
      basicAdopt: SwCharacterSheet.#onBasicAdopt,
      // THE MANEUVERS TAB (0.28.0): only what applies, or every Maneuver; and the bookmark.
      toggleAllManeuvers: SwCharacterSheet.#onToggleAllManeuvers,
      toggleFavorite: SwCharacterSheet.#onToggleFavorite,
      // 0.29.0: the Loaded chip on a ranged weapon's row, and the Strike row's three buttons.
      toggleLoaded: SwCharacterSheet.#onToggleLoaded,
      strikeWith: SwCharacterSheet.#onStrikeWith,
      adjustQuantity: SwCharacterSheet.#onAdjustQuantity,
      setCarry: SwCharacterSheet.#onSetCarry,
      wearArmor: SwCharacterSheet.#onWearArmor,
      setActions: SwCharacterSheet.#onSetActions,
      resetActions: SwCharacterSheet.#onResetActions,
      pass: SwCharacterSheet.#onPass,
      endOpportunity: SwCharacterSheet.#onEndOpportunity,
      finishPrepared: SwCharacterSheet.#onFinishPrepared,
      abandonPrepared: SwCharacterSheet.#onAbandonPrepared,
      toggleCollapse: SwCharacterSheet.#onToggleCollapse,
      adjust: SwCharacterSheet.#onAdjust,
      effectCreate: SwCharacterSheet.#onEffectCreate,
      effectEdit: SwCharacterSheet.#onEffectEdit,
      effectDelete: SwCharacterSheet.#onEffectDelete,
      effectToggle: SwCharacterSheet.#onEffectToggle,
      // AURAS (0.5.1)
      toggleAura: SwCharacterSheet.#onToggleAura,
      // CLAIMS (0.15.0)
      armClaim: SwCharacterSheet.#onArmClaim,
      // CHARACTER EFFECTS (0.16.0)
      cycleEffectState: SwCharacterSheet.#onCycleEffectState,
      addEffect: SwCharacterSheet.#onAddEffect,
      removeEffect: SwCharacterSheet.#onRemoveEffect,
      // 0.17.0: a claim line's arm button, and the Grammar button that opens the grammar's journal.
      armClaimLine: SwCharacterSheet.#onArmClaimLine,
      rulesJournal: SwCharacterSheet.#onRulesJournal,
      // 0.22.0: the GM's Remove on a result pending on the character.
      removeGiven: SwCharacterSheet.#onRemoveGiven
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
    biography: { template: "systems/starwrought/templates/actor/biography.hbs", scrollable: [""] },
    // 0.17.0: the Notes on their own tab; the Biography keeps Biography, Edicts and Anathema.
    notes: { template: "systems/starwrought/templates/actor/notes.hbs", scrollable: [""] },
    // THE GLANCE (0.19.0): a LIMITED user's whole sheet; dropped from every other render
    // (_configureRenderParts), so no tab names it.
    glance: { template: "systems/starwrought/templates/actor/glance-sheet.hbs", scrollable: [""] }
  };

  /** @inheritdoc. The `actions` tab keeps its id; the handbook now calls them Maneuvers, and the label says so. */
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
        { id: "biography", icon: "fa-solid fa-book-open" },
        // Its own label: `STARWROUGHT.Tab.notes` is the party sheet's "GM Notes".
        { id: "notes", icon: "fa-solid fa-note-sticky", label: "STARWROUGHT.Tab.characterNotes" }
      ]
    }
  };

  /** Which Constellations the user has folded shut. Session state, not saved on the Actor. */
  #collapsed = new Set();

  /**
   * THE FILTER (0.19.0): the text in the Constellations tab's search box. Session state, kept
   * across the part's re-renders; while set, every Constellation renders unfolded (the collapse
   * state is kept but not read) so the Talents can be matched.
   */
  #filter = "";

  /** Put the caret back in the filter box after a re-render the typing caused. */
  #refocusFilter = false;

  /**
   * THE MANEUVERS TAB (0.28.0): what the tab last drew (a signature of which Maneuvers apply), the
   * hooks that watch the Combat and the scene while the sheet is open, and the timer that lets a
   * burst of them settle before the list is worked out again.
   */
  #maneuverDrawn = "";
  #maneuverHooks = null;
  #maneuverTimer = null;

  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * A LIMITED user (0.19.0) sees the glance and nothing else: no header, no tabs. Everyone else
   * never sees the glance part. Through 0.18.1 a LIMITED user saw every tab read-only, which is
   * more than the permission means.
   */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (this.document.limited && !game.user.isGM) return { glance: parts.glance };
    delete parts.glance;
    return parts;
  }

  /**
   * @inheritdoc
   * The filter box (0.19.0) is wired here, the sheet's one listener outside `actions`: a text
   * input is not a click. Typing filters the rendered rows in place; going from nothing to
   * something, or back, re-renders the part, so the Talents come in unfolded (or the fold state
   * returns), and the caret is put back.
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // THE MANEUVERS TAB (0.28.0): watch the Combat and the scene while the sheet is open. Not for
    // a LIMITED user's sheet, which is the glance alone and has no tab to keep current. What the
    // tab shows is remembered only when the tab was among the parts drawn: every render prepares
    // the whole context, and a render of another part must not make a stale tab look current.
    if (!(this.document.limited && !game.user.isGM)) {
      this.#watchManeuvers();
      const parts = options?.parts;
      if (!Array.isArray(parts) || parts.includes("actions")) this.#maneuverDrawn = context?.maneuvers?.signature ?? "";
    }
    const input = this.element?.querySelector(".sw-constellation-filter");
    if (!input) return;
    input.value = this.#filter;
    input.addEventListener("input", () => this.#onFilterInput(input));
    input.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      input.value = "";
      this.#onFilterInput(input);
    });
    this.#applyFilter();
    if (this.#refocusFilter) {
      this.#refocusFilter = false;
      input.focus();
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch { /* a search input in some browsers refuses */ }
    }
  }

  /** @inheritdoc The Maneuvers tab's watch (0.28.0) is released with the window. */
  _onClose(options) {
    super._onClose?.(options);
    this.#unwatchManeuvers();
  }

  #onFilterInput(input) {
    const previous = this.#filter;
    this.#filter = input.value.trim().toLowerCase();
    if (!!previous !== !!this.#filter) {
      // Nothing to something: unfold everything so the Talents are there to match. Something to
      // nothing: the fold state returns. Either is a render of the part.
      this.#refocusFilter = true;
      this.render({ parts: ["constellations"] });
      return;
    }
    this.#applyFilter();
  }

  /** Show the rows whose names contain the filter, hide the rest; a group with no row left hides too. */
  #applyFilter() {
    const root = this.element?.querySelector(".sw-tab[data-tab='constellations']");
    if (!root) return;
    const q = this.#filter;
    for (const group of root.querySelectorAll(".sw-constellation-group")) {
      let anyRow = false;
      for (const row of group.querySelectorAll(".sw-constellation")) {
        const rowMatches = !q || (row.dataset.filter ?? "").includes(q);
        let anyTalent = false;
        for (const talent of row.querySelectorAll(".sw-talent")) {
          const matches = rowMatches || (talent.dataset.filter ?? "").includes(q);
          talent.classList.toggle("sw-hidden", !matches);
          if (matches) anyTalent = true;
        }
        const show = rowMatches || anyTalent;
        row.classList.toggle("sw-hidden", !show);
        if (show) anyRow = true;
      }
      group.classList.toggle("sw-hidden", !anyRow);
    }
  }

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
      isGM: game.user.isGM,
      config: SW,
      SW
    });

    context.attributes = Object.entries(sys.attributes).map(([key, attr]) => ({
      key, ...attr, label: game.i18n.localize(attr.label)
    }));

    // The Threshold's tooltip (0.15.0): the sheet's number is position-blind, so the rules it
    // leaves out (a FOR reaching others, an AGAINST, a MARKED, a claim) are listed under it by
    // their As read line, for the GM narrating an adversary's Demoralize by hand.
    const conditional = conditionalDefenseRules(actor);
    context.defenses = Object.values(sys.defenses).map(def => ({
      ...def,
      label: game.i18n.localize(def.label),
      hint: game.i18n.localize(def.hint),
      rankLabel: game.i18n.localize(def.rankLabel),
      thresholdTip: [
        game.i18n.localize("STARWROUGHT.Field.thresholdHint"),
        ...conditional.filter(r => r.every || (r.slug === def.slug)).map(r => `${r.talent}: ${r.summary}`)
      ].join("\n")
    }));
    context.bind = bindContext(actor);
    // Form a Bind by hand (0.27.0, ruling 279): offered in an encounter while in none.
    context.canFormBind = !context.bind && this.isEditable && !!actor.inEncounter;
    context.lockedTips = lockedTips(actor);
    context.traitChips = traitChips(actor);
    // Wind (PHB v4.12, ruling 74): the Load Strain field says whether this fighter is exempt, with
    // the numbers, to the GM and the player alike.
    context.loadStrainTip = windTip(actor);
    context.effectsPanel = effectsContext(actor); // CHARACTER EFFECTS (0.16.0)

    context.zones = Object.keys(SW.ZONES).map(key => {
      const z = sys.zones[key];
      return {
        key,
        label: game.i18n.localize(SW.ZONES[key].label),
        protection: z.protection,
        exposed: z.exposed,
        postureExposed: !!z.postureExposed,
        piece: z.piece,
        material: z.material,
        materialLabel: game.i18n.localize(z.materialLabel ?? SW.ARMOR_TYPES.none.label),
        crit: game.i18n.localize(SW.ZONE_CRITICALS[key].effect),
        // The Zone's Critical Hit effect is running, until a Recenter (0.26.0).
        critical: !!z.critical,
        wounds: zoneWounds(actor, key)
      };
    });

    // Spent: at 0 Vigor. Derived by the data model; read defensively so an older document that has
    // not been through prepareDerivedData yet still renders.
    context.spent = sys.spent ?? ((sys.vigor?.value ?? 1) === 0);
    context.vigor = vigorContext(actor);

    context.constellations = this.#prepareConstellations();
    // The Constellations tab's toolbar toggle (0.6.3, ruling 85): what it shows now, and so what
    // the button offers next.
    context.showUnopened = SwCharacterSheet.showUnopened();
    context.filter = this.#filter; // THE FILTER (0.19.0)
    context.inventory = this.#prepareInventory();
    context.strikes = this.#prepareStrikes();
    context.effects = actor.effects.map(e => ({
      id: e.id, name: e.name, img: e.img, disabled: e.disabled,
      description: e.description, isSuppressed: e.isSuppressed,
      // The rules page a condition's row opens, when its condition has one (0.5.1, T6).
      rulesPage: rulesPageOf(e),
      // How a line of Automation reads it (0.31.0): `prone`, or `EFFECT(Blessed)`.
      readAs: effectReadAs(e),
      // Put there by a Maneuver's APPLY line (0.32.0): who, with what, until when.
      applied: effectAppliedTag(e),
      // A Condition's own effect (0.33.0): its Description for the row's tooltip, and what it is
      // doing, read-only, listed under the row.
      condition: conditionInfo(actor, e)
    }));

    // The wizard's own state, so a half-built character says so instead of looking broken.
    const chargenFlag = actor.getFlag(SW.SYSTEM_ID, "chargen");
    context.chargen = {
      unbuilt: actor.items.filter(i => i.type === "talent").length === 0,
      inProgress: !!chargenFlag,
      step: chargenFlag?.step ?? 0
    };

    // The action economy, shown only when it means something: in an encounter.
    context.actions = actionsContext(actor);
    // What Recenter costs now (0.37.0): ❷ while a Condition raises it (Heedless), for its button.
    context.recenter = await recenterButton(actor);

    // AURAS (0.5.1): the ring toggle beside each Talent or Maneuver row that carries an aura,
    // looked up by Item id in the templates, and the body's own ranges for the Ranges line.
    context.auraByItem = auraRowsByItem(actor);

    // THE MANEUVERS TAB (0.28.0): the Favorites, the Basic Maneuvers, the Talents' and the
    // character's own, each row knowing whether it applies now and why not. After the auras, whose
    // toggle a row carries.
    context.maneuvers = await this.#prepareManeuvers(context.auraByItem);
    context.ranges = reachRangeRows(actor);

    // Movement, in feet (PHB v4.21): a Move, a Step, a Rush ❷, the three Leaps, a Crawl.
    const speed = sys.speed ?? 0;
    const strain = sys.loadStrain ?? 0;
    const leap = sys.leap ?? {};
    context.movement = {
      speed,
      step: sys.step ?? Math.floor(speed / SW.STEP_DIVISOR),
      rush: sys.rush ?? Math.max(0, speed * SW.RUSH_MULTIPLIER - strain),
      rushGlyph: SW.ACTION_GLYPHS[SW.RUSH_COST],
      leap: Object.entries(SW.LEAP_STEPS).map(([cost, factor]) => ({
        glyph: SW.ACTION_GLYPHS[cost],
        feet: leap[cost] ?? Math.max(0, Math.floor(speed * factor) - strain)
      })),
      crawl: sys.crawl ?? Math.floor(speed / SW.CRAWL_DIVISOR)
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
    context.woundCount = sys.woundCount ?? Object.keys(SW.ZONES).reduce((n, z) => n + (sys.zones[z]?.wounds ?? 0), 0);

    // 0.5.1 (T11): the Milestones as three star pips under the level, filled as they are reached;
    // the GM sees the same pips beside the inputs. The fourth Milestone is the level itself.
    const reached = Math.clamp(Number(sys.milestone) || 0, 0, MILESTONES_PER_LEVEL);
    context.milestones = {
      reached,
      pips: Array.fromRange(MILESTONES_PER_LEVEL, 1).map(n => ({ n, filled: n <= reached })),
      tooltip: game.i18n.format("STARWROUGHT.Milestone.pipHint", { n: reached, of: MILESTONES_PER_LEVEL })
    };

    // The Comets the character holds (PHB v4.21; 0.7.0's Deferred Talent Point renamed, rulings
    // 94 and 145): a Talent Point for any Constellation, from the fourth Milestone or a Milestone
    // point no Flare could take. A reminder with a number on it, shown beside the pips while
    // above 0, with one control, Spent, for the owner or the GM.
    const comets = Math.max(0, Number(sys.comets) || 0);
    context.comets = {
      count: comets,
      show: comets > 0,
      canSpend: actor.isOwner || game.user.isGM,
      tooltip: game.i18n.format("STARWROUGHT.Comet.badgeHint", { n: comets })
    };

    // 0.5.1 (T13): Refuse Death is for the Dying with a Hero Point to spend; the button says why
    // it is off otherwise. The tooltip rides on a wrapper, since a disabled button swallows hover.
    const dying = (Number(sys.dying) || 0) > 0;
    const heroPoints = (Number(sys.heroPoints?.value) || 0) > 0;
    context.refuse = {
      enabled: dying && heroPoints,
      hint: game.i18n.localize(!dying ? "STARWROUGHT.Roll.refuseDeathNotDying"
        : !heroPoints ? "STARWROUGHT.Roll.refuseDeathNoHero"
        : "STARWROUGHT.Roll.refuseDeathHint")
    };
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
    // Edicts and Anathema (0.17.0): two more prose panels on the Biography tab.
    context.enrichedEdicts = await TextEditor.enrichHTML(sys.details.edicts ?? "", {
      relativeTo: actor, rollData: actor.getRollData()
    });
    context.enrichedAnathema = await TextEditor.enrichHTML(sys.details.anathema ?? "", {
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
    // THE GLANCE (0.19.0): what anyone standing near could see; the numbers for the owner and the GM.
    if (partId === "glance") context.glance = glanceData(this.document, { full: this.document.isOwner || game.user.isGM });
    return context;
  }

  /**
   * An open Biography, Edicts, Anathema or Notes editor across a re-render (0.5.1, T19; the editors
   * found by their element, so a new one needs no entry here). The sheet redraws its parts
   * whenever the actor changes, and a change can arrive from anywhere while a player is typing: a
   * round's reset, a GM's edit, a Wound. Foundry's part sync keeps focus and scroll but not an
   * open <prose-mirror>, whose teardown saves into a detached element and so loses the draft. So
   * the draft is saved first, while the old part is still in the form. The save fires the change
   * the sheet would submit on, but ApplicationV2 drops every form change while it is rendering,
   * which it is here, so the draft is written to the document directly when the editor reports
   * one (its own value-versus-stored test, so an unchanged editor writes nothing back), and the
   * reopened editor on the new part is seeded with it so the round trip to the server shows the
   * draft rather than the old text (review, 2026-10-01).
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
      // The new part was rendered before the draft reached the document; seed it so the reopened
      // editor shows the draft and keeps typing done during the round trip, not the old text.
      if (name in drafts) editor.value = drafts[name];
      editor.toggleAttribute("open", true);
    }
  }

  /* -------------------------------------------- */

  /**
   * Melee and Ranged as the overview shows them: rank and Proficiency for each, and the weapon
   * dice each rank rolls (PHB v4.21: one at Trained to four at Legendary; no specialization).
   */
  #prepareStrikes() {
    const sys = this.document.system;
    // Melee is a Might sky and Ranged an Agility one (PHB v4.10); the registry can refine that
    // once the content index is loaded, but the glyph must not depend on it.
    const row = (slug, key, fallbackAttribute) => {
      const entry = sys[key] ?? {};
      const rank = entry.rank ?? "untrained";
      return {
        slug,
        key,
        label: game.i18n.localize(`STARWROUGHT.Field.${key}`),
        rank,
        rankLabel: game.i18n.localize(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label),
        proficiency: entry.proficiency ?? 0,
        dice: entry.dice ?? SW.weaponDice(rank),
        attribute: sys.constellations?.[slug]?.attribute ?? SW.constellations[slug]?.attribute ?? fallbackAttribute
      };
    };
    const melee = row(SW.MELEE_SLUG, "melee", "might");
    const ranged = row(SW.RANGED_SLUG, "ranged", "agility");
    return {
      melee,
      ranged,
      kinds: Object.entries(SW.STRIKE_KINDS).map(([key, kind]) => ({
        key,
        label: game.i18n.localize(kind.label),
        glyph: SW.ACTION_GLYPHS[kind.cost] ?? "",
        hint: game.i18n.localize(`STARWROUGHT.Strike.${key}Hint`)
      }))
    };
  }

  /* -------------------------------------------- */

  /**
   * Group the character's Constellations by category, in handbook order.
   *
   * The entries are the data model's: every sky the character has opened (its Item or a Talent
   * held), one Flared without being opened, and a parent whose Combat Styles hold points. With the
   * client setting `showUnopenedConstellations` on (0.6.3, ruling 85; the toolbar's toggle), every
   * Constellation that ships (Enabled? = Yes, ruling 61) and is not among them is added as a slim
   * row in its own category: Untrained, no Talents, the roll link and the Flare control, so an
   * unopened Constellation can be Flared from the sheet. The Lore template is left out, as the
   * Relevant Check picker leaves it out: a Lore a character opens is always Lore (X).
   */
  #prepareConstellations() {
    const groups = {};
    const all = this.document.system.constellations;
    const groupFor = category => (groups[category] ??= {
      key: category,
      label: game.i18n.localize(SW.CATEGORIES[category]?.label ?? SW.CATEGORIES.general.label),
      order: SW.CATEGORIES[category]?.order ?? 9,
      constellations: []
    });
    const parentNameOf = slug => (slug ? (all[slug]?.name ?? SW.getConstellation(slug)?.name ?? slug) : null);
    // The Talents carrying a claim, with their arming (0.15.0), for the pin on the row.
    const claims = claimsOf(this.document);

    for (const entry of Object.values(all)) {
      const group = groupFor(entry.category ?? "general");
      // A parent (Melee, Ranged, a discipline) counts its groups' points toward its rank; a group
      // (PHB v4.21: a Combat Style, a magical specialty) has no rank of its own and wears the
      // parent's, dimmed, with a hint saying whose. Neither changes what the Talents themselves cost.
      const inherited = Number(entry.inherited) || 0;
      const parentName = parentNameOf(entry.parent);
      // A Lore left unnamed (0.18.0): the template's own row, which should not exist on a
      // character, carries the control that names it. Its name is the Item's, "Lore (unnamed)"
      // since the 0.18.1 migration, printed as any row's is.
      const loreTemplate = entry.slug === SW.LORE_TEMPLATE_SLUG;
      group.constellations.push({
        ...entry,
        loreTemplate,
        pool: entry.pool ?? entry.points,
        inherited,
        parentName,
        rankFromName: entry.rankFrom ? parentName : "",
        rankHint: entry.rankFrom
          ? game.i18n.format("STARWROUGHT.Hint.groupRank", { parent: parentName })
          : game.i18n.localize(SW.ATTRIBUTES[entry.attribute]?.label ?? ""),
        rankLabel: game.i18n.localize(entry.rankLabel),
        attributeGlyph: SW.ATTRIBUTES[entry.attribute]?.glyph ?? "",
        attributeLabel: game.i18n.localize(SW.ATTRIBUTES[entry.attribute]?.label ?? ""),
        // A filter (0.19.0) unfolds every row so its Talents can be matched; the fold state is kept.
        collapsed: this.#filter ? false : this.#collapsed.has(entry.slug),
        filterText: `${entry.name} ${group.label}`.toLowerCase(),
        unopened: false,
        talents: entry.talents.map(t => ({
          id: t.id,
          name: t.name,
          filterText: SW.plainName(t.name).toLowerCase(),
          img: t.img,
          tier: t.system.tier,
          glyph: t.system.glyph,
          root: t.system.root || t.system.bloodlineRoot,
          effect: t.system.effect,
          // The name's rich tooltip (0.17.0): the Talent's Effect under its name and tier, in the
          // `lockedTips` idiom, so a player reads what a Talent does without opening it.
          tip: talentTip(t),
          // A spell Talent (PHB v4.21) carries the Cast ❷ ❸ ❹ on its row.
          spell: t.system.isSpell ? { casts: castButtons() } : null,
          // A Talent with a cost in its name is used from its row (0.15.0, ruling 176).
          usable: !t.system.isSpell && (((t.system.cost !== "passive") && !!t.system.glyph) || usableByRule(t)),
          useHint: game.i18n.format("STARWROUGHT.Sheet.useTalent", { name: SW.plainName(t.name), glyph: t.system.glyph ?? "" }),
          // A Talent with a claim has the pin (0.15.0, ruling 174).
          claim: claims.has(t.id) ? {
            armed: claims.get(t.id).armed,
            hint: game.i18n.format(claims.get(t.id).armed ? "STARWROUGHT.Sheet.claimArmed" : "STARWROUGHT.Sheet.claimArm", { texts: claims.get(t.id).texts.join("; ") })
          } : null
        }))
      });
    }

    if (SwCharacterSheet.showUnopened()) {
      for (const meta of enabledConstellations()) {
        if (!meta.slug || all[meta.slug] || SW.isLoreSlug(meta.slug)) continue;
        const attribute = (meta.attribute in SW.ATTRIBUTES) ? meta.attribute : "might";
        const category = SW.CATEGORIES[meta.category] ? meta.category : "general";
        // An unopened group wears its parent's rank too, when the parent is open (PHB v4.21).
        const parentEntry = meta.parent ? all[meta.parent] : null;
        const rank = parentEntry?.rank ?? "untrained";
        const parentName = parentNameOf(meta.parent);
        groupFor(category).constellations.push({
          slug: meta.slug,
          name: meta.name,
          filterText: `${meta.name} ${groupFor(category).label}`.toLowerCase(),
          category,
          attribute,
          attributeGlyph: SW.ATTRIBUTES[attribute].glyph,
          attributeLabel: game.i18n.localize(SW.ATTRIBUTES[attribute].label),
          rank,
          rankLabel: game.i18n.localize(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label),
          rankFromName: meta.parent ? parentName : "",
          rankHint: meta.parent
            ? game.i18n.format("STARWROUGHT.Hint.groupRank", { parent: parentName })
            : game.i18n.localize(SW.ATTRIBUTES[attribute].label),
          bonus: parentEntry?.bonus ?? 0,
          points: 0,
          pool: parentEntry?.pool ?? 0,
          inherited: 0,
          parentName,
          next: null,
          talents: [],
          unopened: true,
          // A Flared one is always an entry above, so an unopened row is never lit.
          flared: false,
          collapsed: true
        });
      }
    }

    // The Origin's three Roots share one rank, so say so at the top of the group.
    if (groups.origin) {
      groups.origin.pooled = this.document.system.originPoints;
      groups.origin.pooledHint = "STARWROUGHT.Hint.originPool";
    }

    // Opened skies first, the fuller ones higher; the unopened rows trail each group by name.
    return Object.values(groups)
      .sort((a, b) => a.order - b.order)
      .map(g => {
        g.constellations.sort((a, b) =>
          (Number(a.unopened) - Number(b.unopened)) || (b.points - a.points) || a.name.localeCompare(b.name));
        return g;
      });
  }

  /**
   * Whether this user's sheets list the Constellations the character has not opened (0.6.3,
   * ruling 85). A client setting, so it holds across sheets and sessions for that user; read
   * defensively for a build without it.
   * @returns {boolean}
   */
  static showUnopened() {
    try {
      return !!game.settings.get(SW.SYSTEM_ID, "showUnopenedConstellations");
    } catch {
      return false;
    }
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

    inventory.armorRows = Object.keys(SW.ZONES).map(zone => {
      const item = wornArmor[zone];
      return {
        zone,
        label: game.i18n.localize(SW.ZONES[zone].label),
        item,
        protection: actor.system.zones[zone].protection,
        exposed: actor.system.zones[zone].exposed,
        wounds: zoneWounds(actor, zone),
        // The two armor traits the system acts on (PHB v4.21): a Visored piece's visor, up or
        // down, flipped for an action; a Fitted piece's adjusted tick, the player's word.
        visored: !!item?.system.visored,
        lowered: !!item?.system.visorLowered,
        fitted: !!item?.system.fitted,
        adjusted: !!item?.system.fittedAdjusted
      };
    });
    inventory.fittedCount = actor.system.fittedCount ?? 0;
    inventory.fittedHarness = !!actor.system.fittedHarness;
    inventory.fittedZones = SW.FITTED_ZONES;

    // A piece can only be worn on an empty Zone, so the picker offers what is actually stowed.
    inventory.stowedArmorByZone = {};
    for (const zone of Object.keys(SW.ZONES)) {
      inventory.stowedArmorByZone[zone] = actor.items
        .filter(i => (i.type === "armor") && !i.system.worn && (i.system.zone === zone))
        .map(i => ({ id: i.id, name: i.name, protection: i.system.protection }));
    }

    // What is in hand, the bare fist last: it is always there, and it is never the first thing a
    // player is looking for on this list.
    inventory.held.sort((a, b) => ((a.natural ? 1 : 0) - (b.natural ? 1 : 0)) || a.name.localeCompare(b.name));
    inventory.stowed.sort((a, b) => a.name.localeCompare(b.name));
    // "Nothing in hand" is still said when the only thing there is the fist (0.29.0).
    inventory.emptyHanded = inventory.held.every(row => row.natural);
    inventory.inEncounter = actor.inEncounter;
    return inventory;
  }

  /** A plain carried thing: a shield, a stowed weapon, a piece of armor in the pack, gear. */
  #carryRow(item) {
    // Armor is the one thing you cannot shuffle mid-fight: a minute per point of Protection, with a
    // floor of 1 so a piece never reads "0 min". An Attended piece (ruling 82, display only) takes
    // twice that to put on alone; the sheet doubles its own floored number rather than reading the
    // data model's `donTimeAlone`, so the two figures in the tag always agree.
    const donTime = item.type === "armor" ? Math.max(1, item.system.protection) : 0;
    const attended = (item.type === "armor") && !!item.system.attended;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      state: item.system.state,
      stateLabel: game.i18n.localize(item.system.stateLabel ?? ""),
      quantity: item.system.quantity,
      // AMMUNITION (0.30.0): a stack of it shows its count on the row, with a minus and a plus.
      isAmmunition: (item.type === "gear") && !!item.system.isAmmunition,
      ammunitionTip: (item.type === "gear") && item.system.isAmmunition
        ? game.i18n.format("STARWROUGHT.Ammunition.rowHint", { group: item.system.ammunition })
        : "",
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
      donTime,
      attended,
      donTimeAlone: attended ? 2 * donTime : donTime
    };
  }

  /**
   * A weapon row, with the attack modifier already worked out: Melee or Ranged Proficiency after
   * Handling and Familiarity, plus the Strike Attribute (the weapon's own, or a Combat Style's Key
   * Attribute when you own that Style's root and are wielding its weapon). No level term: PHB
   * v4.10 checks are Attribute + Proficiency + bonuses. The standing attack modifiers the data
   * model derives (the first Arms Wound's −2 Situation) are folded in, so the row agrees with the
   * roll dialog's preview.
   */
  #weaponRow(item) {
    const actor = this.document;
    const sys = actor.system;
    // The numbers are the shared helper's (0.29.0), which the Strike chooser prints too, so the
    // row and the chooser can never disagree about a weapon.
    const { slugKey, rank, attribute, attributeLabel, attackMod, thrownNote, damage, quickDamage, reach } = weaponNumbers(actor, item);

    return {
      ...this.#carryRow(item),
      attackMod,
      rank,
      rankLabel: game.i18n.localize(SW.RANKS[rank].label),
      trainingLabel: game.i18n.localize(`STARWROUGHT.Field.${slugKey}`),
      strikeAttribute: attribute,
      strikeAttributeGlyph: SW.ATTRIBUTES[attribute].glyph,
      strikeAttributeAbbr: game.i18n.localize(SW.ATTRIBUTES[attribute].abbr),
      strikeAttributeHint: game.i18n.format("STARWROUGHT.Strike.attributeFromWeapon", { attribute: attributeLabel }) + thrownNote,
      damage,
      quickDamage,
      // Total Reach is your Natural Reach plus the weapon's. A ranged weapon shows its range.
      reach,
      reachHint: item.system.isRanged
        ? game.i18n.localize("STARWROUGHT.Field.rangeHint")
        : game.i18n.format("STARWROUGHT.Field.totalReachHint", {
            natural: sys.reach, weapon: item.system.reach, total: item.system.reach + sys.reach
          }),
      traits: item.system.totalTraits,
      defaultStrike: SW.DEFAULT_STRIKE,
      // A natural weapon (the Unarmed Strike every character has since 0.29.0) is always in hand:
      // its row has no stow control.
      natural: !!item.system.natural,
      // AMMUNITION (0.29.0): the chip on a ranged weapon that takes ammunition, Loaded or Empty
      // (a Repeating Crossbow "3 of 5"), which a click corrects by hand.
      ...this.#loadedChip(item)
    };
  }

  /** The Loaded chip of a weapon row: nothing for a weapon that takes no ammunition. */
  #loadedChip(item) {
    const sys = item.system;
    if (!sys.takesAmmunition) return { takesAmmunition: false };
    const several = sys.magazine > 1;
    // What is carried for it (0.30.0): the stacks that feed its Weapon Group, all told.
    const stacks = ammunitionFor(sys.group, this.document.items.filter(i => i.type === "gear").map(i => ({
      id: i.id, name: i.name, ammunition: i.system.ammunition, quantity: i.system.quantity, held: !!i.system.held
    })));
    const carried = stacks.reduce((sum, stack) => sum + (Number(stack.quantity) || 0), 0);
    const carriedTip = !String(sys.group ?? "").trim() ? ""
      : (stacks.length
        ? game.i18n.format("STARWROUGHT.Ammunition.carried", { n: carried, kind: stacks[0].name })
        : game.i18n.format("STARWROUGHT.Ammunition.carriedNone", { group: sys.group }));
    return {
      takesAmmunition: true,
      isLoaded: !!sys.isLoaded,
      loadedLabel: several
        ? game.i18n.format("STARWROUGHT.Loaded.count", { n: sys.shots, max: sys.magazine })
        : game.i18n.localize(sys.isLoaded ? "STARWROUGHT.Loaded.loaded" : "STARWROUGHT.Loaded.empty"),
      loadedTip: `${game.i18n.format("STARWROUGHT.Loaded.chipHint", { cost: SW.ACTION_GLYPHS[sys.reloadCost] ?? String(sys.reloadCost) })} ${carriedTip}`.trim()
    };
  }

  /* -------------------------------------------- */
  /*  Drops                                       */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   *
   * THE PARTY'S LOOT (0.7.1; party-sheet-plan.md, part 6; ruling 98): an Item dragged off a
   * party onto this sheet is a Take, not Foundry's silent copy. The whole stack moves (the Loot
   * tab's Take button is the place to ask for part of one), through `requestTake`: the GM's own
   * client moves it at once, a player's asks the active GM's client over the system socket, and
   * both post the member's card. The base class never sees the drop, so nothing is copied.
   */
  async _onDropItem(event, item) {
    if ((item?.parent?.documentName === "Actor") && (item.parent.type === SW.PARTY_TYPE)) {
      await requestTake({ party: item.parent, item, actor: this.document, quantity: item.system?.quantity });
      return null;
    }
    const created = await super._onDropItem(event, item);
    // Buying a Talent in a Constellation you have not opened is buying its Root, so draw the sky.
    // A Talent under the Lore template (0.18.0) is named by the createItem hook, which opens the
    // Lore (X) itself; opening the template here would leave a second, unnamed sky.
    const docs = Array.isArray(created) ? created : [created];
    for (const doc of docs) {
      if ((doc?.type === "talent") && (doc.system.constellation !== SW.LORE_TEMPLATE_SLUG)) {
        await SwItem.ensureConstellation(this.document, doc.system.constellation);
      }
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
  /*  The Maneuvers tab (0.28.0)                  */
  /* -------------------------------------------- */

  /**
   * Whether this user's sheets list every Maneuver, or only the ones that apply now (0.28.0,
   * ruling 281; Mike: "only show Maneuvers that the system detects are applicable, but still allow
   * the player to click a button to see all Maneuvers"). A client setting, as the Constellations
   * tab's toggle is, so it is this user's across every sheet; read defensively for a build
   * without it.
   * @returns {boolean}
   */
  static showAllManeuvers() {
    try {
      return !!game.settings.get(SW.SYSTEM_ID, "showAllManeuvers");
    } catch {
      return false;
    }
  }

  /** The character's Favorites (ruling 288): the slugs of the bookmarked Maneuvers, in the order marked. */
  #favorites() {
    const list = this.document.getFlag(SW.SYSTEM_ID, FAVORITES_FLAG);
    return Array.isArray(list) ? list.filter(slug => (typeof slug === "string") && slug) : [];
  }

  /**
   * Every Maneuver the tab may list, each knowing whether it applies now and why not: the
   * character's own copies first (the Talents' Maneuvers, then the ones picked up), then the Basic
   * Maneuvers, which come from the compendium and are never copied onto the character, so what
   * the sheet shows is what the book says today. In that order because a Maneuver is listed once
   * and the first row of a name stands (`arrangeManeuvers`): a copy on the sheet is the
   * character's own to edit, and it replaces the Basic row of the same name.
   * @param {object} [auras]  `auraRowsByItem(actor)`: the ring toggle a row carries, by Item id.
   * @returns {Promise<object[]>}
   */
  async #maneuverRows(auras = {}) {
    const actor = this.document;
    // Read once: every row is judged against the same moment.
    const situation = situationOf(actor);
    const esc = foundry.utils.escapeHTML;
    const useHint = game.i18n.localize("STARWROUGHT.Sheet.basicUseHint");
    const row = (item, source, extra = {}) => {
      const sys = item.system;
      const status = statusOf(item, situation, { owned: source !== "basic" });
      const flavour = String(sys.description ?? "").replace(/<[^>]+>/g, "").trim();
      const owned = source !== "basic";
      return {
        source,
        isBasic: !owned,
        isTalent: source === "talent",
        isOwn: source === "own",
        slug: status.slug,
        // The Strike row carries the three Strike buttons a weapon's row has (0.29.0, ruling 295).
        isStrike: status.slug === "strike",
        uuid: owned ? "" : item.uuid,
        itemId: owned ? item.id : "",
        name: item.name,
        img: item.img,
        glyph: sys.glyph,
        costLabel: sys.costLabel,
        // A Condition raises this row's cost (0.37.0; Heedless): "+1" beside the pips, why on hover.
        raise: status.raise?.n ?? 0,
        raiseTip: status.raise?.tip ?? "",
        traits: sys.traits ?? [],
        requirements: sys.requirements ?? "",
        hint: flavour || useHint,
        category: sys.category || "",
        tag: "",
        tagTip: "",
        aura: owned ? (auras?.[item.id] ?? null) : null,
        applicable: status.applicable,
        // The first reason is printed on a dimmed row; all of them are its tooltip, which Foundry
        // reads as HTML, so each is escaped here.
        reason: status.reasons[0] ?? "",
        reasonTip: status.reasons.map(text => esc(text)).join("<br>"),
        ...extra
      };
    };
    const rows = [];
    const owned = actor.items.filter(i => i.type === "action").sort((a, b) => a.name.localeCompare(b.name));
    const granted = [];
    const picked = [];
    for (const item of owned) {
      // TALENT MANEUVERS (0.16.0): the Maneuvers a Talent granted (`flags.starwrought.grantedBy`)
      // sit under their own heading, named for the Talent; the rest are the character's own.
      const by = item.getFlag(SW.SYSTEM_ID, "grantedBy");
      if (by) {
        granted.push(row(item, "talent", {
          tag: SW.plainName(actor.items.get(by)?.name ?? ""),
          tagTip: game.i18n.localize("STARWROUGHT.Hint.grantedByTalent")
        }));
      } else {
        picked.push(row(item, "own", { tag: item.system.category || "" }));
      }
    }
    rows.push(...granted, ...picked);
    for (const item of await loadBasicActions()) rows.push(row(item, "basic"));
    return rows;
  }

  /**
   * What the tab last drew, as one string: every Maneuver with whether it applies and why not.
   * The watch below compares a fresh one with it and redraws the tab only when they differ.
   */
  static #maneuverSignature(rows) {
    // The raise is part of what is drawn (0.37.0), so a row whose cost mark changes redraws.
    return rows.map(r => `${r.slug}|${r.applicable ? 1 : 0}|${r.reasonTip}|${r.raise ?? 0}`).join("\n");
  }

  /**
   * The Maneuvers tab: the toolbar's count, the Favorites, and the three panels (0.28.0).
   * @param {object} [auras]
   */
  async #prepareManeuvers(auras = {}) {
    const rows = await this.#maneuverRows(auras);
    // What this context would draw; `_onRender` keeps it once the tab has in fact been drawn.
    const signature = SwCharacterSheet.#maneuverSignature(rows);
    const showAll = SwCharacterSheet.showAllManeuvers();
    const arranged = arrangeManeuvers(rows, this.#favorites(), { showAll });
    const listed = source => arranged.rest.filter(r => r.source === source);
    const left = source => arranged.left.filter(r => r.source === source).length;
    const count = (one, many, n) => (n === 1 ? game.i18n.localize(one) : game.i18n.format(many, { n }));
    // A panel with nothing listed says why: nothing applies (and how many are left out), or
    // nothing is there at all. A panel whose every row is a Favorite says nothing.
    const empty = (source, none = "") => {
      if (listed(source).length) return "";
      const n = left(source);
      if (n) return count("STARWROUGHT.Maneuvers.noneApplyOne", "STARWROUGHT.Maneuvers.noneApply", n);
      return rows.some(r => r.source === source) ? "" : none;
    };

    // The Basic Maneuvers, grouped by category as the compendium folders are.
    const fallback = game.i18n.localize("STARWROUGHT.Section.basicActions");
    const groups = new Map();
    for (const r of listed("basic")) {
      const key = r.category || fallback;
      if (!groups.has(key)) groups.set(key, { key, label: key, collapsed: this.#collapsed.has(`basic:${key}`), actions: [] });
      groups.get(key).actions.push(r);
    }

    const hidden = arranged.hidden;
    return {
      signature,
      showAll,
      hidden,
      hiddenNote: !hidden ? ""
        : showAll ? count("STARWROUGHT.Maneuvers.dimmedNoteOne", "STARWROUGHT.Maneuvers.dimmedNote", hidden)
          : count("STARWROUGHT.Maneuvers.hiddenNoteOne", "STARWROUGHT.Maneuvers.hiddenNote", hidden),
      // In the Favorites panel a Basic row says which group it is from; the others keep their tag.
      favorites: arranged.favorites.map(r => (r.isBasic ? { ...r, tag: r.category } : r)),
      basic: { groups: [...groups.values()], empty: empty("basic", game.i18n.localize("STARWROUGHT.Sheet.noBasicActions")) },
      talent: { show: rows.some(r => r.isTalent), rows: listed("talent"), empty: empty("talent") },
      own: { rows: listed("own"), empty: empty("own", game.i18n.localize("STARWROUGHT.Sheet.noActions")) }
    };
  }

  /**
   * WATCHING (0.28.0). The sheet redraws for the character's own changes (Conditions, Items, the
   * Bind, the actions); which Maneuvers apply also turns on things that are not the character's:
   * the Combat (an encounter begun or ended, the Opportunity moving on) and the tokens on the
   * scene (who is adjacent, in reach, within 30 feet). So while the sheet is open it listens for
   * those, waits a moment for a burst to settle (a timer, as the party sheet's, never an animation
   * frame), works the list out again and redraws the tab ONLY when the list changed: a token
   * dragged across the map far from the character redraws nothing.
   */
  #watchManeuvers() {
    if (this.#maneuverHooks) return;
    const hooks = [];
    const look = () => this.#queueManeuverLook();
    for (const hook of MANEUVER_WATCH_HOOKS) hooks.push([hook, Hooks.on(hook, look)]);
    hooks.push(["updateToken", Hooks.on("updateToken", (doc, changes) => {
      if (TOKEN_WATCH_KEYS.some(key => key in (changes ?? {}))) look();
    })]);
    this.#maneuverHooks = hooks;
  }

  #unwatchManeuvers() {
    for (const [hook, id] of this.#maneuverHooks ?? []) Hooks.off(hook, id);
    this.#maneuverHooks = null;
    if (this.#maneuverTimer) {
      clearTimeout(this.#maneuverTimer);
      this.#maneuverTimer = null;
    }
  }

  #queueManeuverLook() {
    if (this.#maneuverTimer) return;
    this.#maneuverTimer = setTimeout(async () => {
      this.#maneuverTimer = null;
      if (!this.rendered) return;
      // A sheet whose viewer has since been cut down to LIMITED is the glance alone: it has no
      // Maneuvers part to draw, and asking for one is a warning on the screen.
      if (this.document.limited && !game.user.isGM) return;
      try {
        const fresh = SwCharacterSheet.#maneuverSignature(await this.#maneuverRows());
        if (fresh !== this.#maneuverDrawn) await this.render({ parts: ["actions"] });
      } catch (err) {
        console.error("STARWROUGHT | the Maneuvers tab could not look again", err);
      }
    }, MANEUVER_WATCH_DELAY);
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

  static async #onRelevantCheck(event) {
    return this.document.rollRelevantCheck({ dialog: !event.shiftKey });
  }

  /**
   * Roll Initiative with what the Combatant carries (0.7.2, ruling 105; party-sheet-plan.md, risk
   * 10): the Constellation the Party Sheet's Begin the encounter wrote for the character's Activity
   * and the Scout's +1 Situation beside it, or the actor's default when nothing was written. Through
   * 0.7.1 this passed the sheet's own default (Awareness) and so overrode the flag the tracker
   * honoured; `rollInitiativeWithCheck` now reads both flags itself when nothing is passed.
   */
  static async #onRollInitiative(event, target) {
    const combat = game.combat;
    const combatant = combat?.getCombatantsByActor(this.document)?.[0];
    if (!combatant) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noCombatant"));
      return;
    }
    return combat.rollInitiativeWithCheck(combatant.id);
  }

  static async #onToggleFlare(event, target) {
    return this.document.toggleFlare(target.dataset.slug);
  }

  /**
   * NAMING A LORE (0.18.0): the Constellations tab's "Name this Lore" on a row whose slug is the
   * template's. The prompt, then `SwActor#nameLore` with no Talent list, so the template Item is
   * renamed in place and every Talent filed under it goes with it; the sheet redraws from the Items.
   */
  static async #onNameLore() {
    return askToNameLore(this.document);
  }

  /**
   * The Constellations tab's toggle (0.6.3, ruling 85): list every Constellation that ships, the
   * unopened ones dimmed, or the opened ones only. A client setting, so it is this user's across
   * every sheet; the setting's onChange redraws any other character sheet this client has open,
   * and this one is redrawn here in case the setting was already what was asked for.
   */
  static async #onToggleUnopened() {
    const next = !SwCharacterSheet.showUnopened();
    try {
      await game.settings.set(SW.SYSTEM_ID, "showUnopenedConstellations", next);
    } catch (err) {
      console.error("STARWROUGHT | the unopened-Constellations toggle could not be saved", err);
    }
    return this.render({ parts: ["constellations"] });
  }

  static async #onToggleZone(event, target) {
    const zone = target.dataset.zone;
    return this.document.setExposed(zone, !this.document.system.zones[zone].exposed);
  }

  /** Set or end a Zone's Critical Hit effect by hand (0.26.0); a Recenter ends it too. */
  static async #onToggleCritical(event, target) {
    const zone = target.dataset.zone;
    return this.document.setCriticalEffect(zone, !this.document.system.zones[zone].critical);
  }

  /** Raise or lower a Visored piece's visor (PHB v4.21): the Item's own method pays the action and says so. */
  static async #onToggleVisor(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    return item?.toggleVisor?.();
  }

  /** Tick or untick a Fitted piece as adjusted to its wearer (PHB v4.21): the player's word, no action. */
  static async #onToggleAdjusted(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item || (item.type !== "armor")) return null;
    return item.update({ "system.adjusted": !item.system.adjusted });
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

  /** The player's one Hero Point control (0.5.1, T9): spend one, and the table is told. */
  static async #onSpendHeroPoint() {
    return this.document.spendHeroPoint();
  }

  /**
   * The Comet badge's one control (0.7.0, ruling 94; PHB v4.21's name, ruling 145): spend one
   * Comet, and the table is told. ApplicationV2 actions fire whatever the sheet's editability, so
   * the permission is checked again here: the owner, or the GM.
   */
  static async #onSpendComet() {
    const actor = this.document;
    if (!actor.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
      return null;
    }
    return actor.spendComet();
  }

  /** Ten minutes' rest (PHB v4.21): level x Presence Vigor back and Fatigued lowered by 1 (0.36.0); the table's word that the minutes passed. */
  static async #onRestTenMinutes() {
    return this.document.restTenMinutes();
  }

  /** Ten minutes and an Endure check against 10 + the Wounds carried. The actor rolls it. */
  static async #onTreatWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    return this.document.treatWound(zone);
  }

  /**
   * The Wound stepper, for a player or the GM (0.5.3). Adding one goes through `applyWound` so
   * everything a Wound does fires; taking one off is bookkeeping, said in chat. `adjustWounds`.
   */
  static async #onAdjustWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    return this.document.adjustWounds(zone, Number(target.dataset.delta) || 0);
  }

  static async #onEndBind() {
    return this.document.endBind();
  }

  /** Take Control of the Bind by hand (0.19.0): the Zone picker, then the record and the Exposure. */
  static async #onTakeControl() {
    return this.document.takeControl();
  }

  /** Gain Control ❶ (0.27.0): the roll for the line, against the Bind partner's Guard. */
  static async #onGainControl(event) {
    return this.document.gainControl({ ...(event?.shiftKey ? { dialog: false } : {}) });
  }

  /** Make neutral (0.27.0): the Controller lets go of the line; the Bind stays. */
  static async #onReleaseControl() {
    return this.document.releaseControl();
  }

  /** Form a Bind by hand (0.27.0, ruling 279): with the one token targeted, the implement picked. */
  static async #onFormBindByHand() {
    return this.document.formBindByHand();
  }

  /** The bind line, the EXPOSED badge and a condition row open their Rules Reference page (0.5.1, T6). */
  static async #onRulesPage(event, target) {
    return openRulesPage(target.dataset.page);
  }

  /**
   * A page of a named journal (0.17.0): the Effects panel's Grammar button opens the Automation
   * Grammar journal at the page the button names (`data-journal`, `data-page`).
   */
  static async #onRulesJournal(event, target) {
    return openRulesPage(target.dataset.page ?? "", { journal: target.dataset.journal });
  }

  /**
   * Strike: Quick ❶, Deliberate ❷ or Committed ❸, from the buttons on a weapon row. The kind is
   * a default the roll dialog can still change; shift-click skips the dialog.
   */
  static async #onStrike(event, target) {
    const weaponId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!weaponId) return;
    const strike = target.dataset.strike in SW.STRIKE_KINDS ? target.dataset.strike : SW.DEFAULT_STRIKE;
    return this.document.rollAttack(weaponId, { strike, dialog: !event.shiftKey });
  }

  /**
   * STRIKE FROM THE MANEUVERS TAB (0.29.0, ruling 295; Mike: "There should be 1/2/3 action buttons
   * on the Strike row ... when you click on it, you can choose what you want to Strike with"). The
   * button names the Strike, the chooser names the weapon (the fist, and each weapon in hand; one
   * choice asks nothing), and the Strike itself is the weapon row's own: `rollAttack`.
   */
  static async #onStrikeWith(event, target) {
    const strike = target.dataset.strike in SW.STRIKE_KINDS ? target.dataset.strike : SW.DEFAULT_STRIKE;
    const dialog = !event.shiftKey;
    // The row's own Item, used: the Strike Maneuver is a built-in (documents/maneuvers.mjs), so the
    // buttons, the row's name and a macro are doors to the one `strikeWith`, held to one use at a
    // time as every Maneuver is. A row whose Item cannot be found still Strikes.
    const row = target.closest("[data-item-id], [data-uuid]");
    const item = row?.dataset.itemId ? this.document.items.get(row.dataset.itemId)
      : (row?.dataset.uuid ? await fromUuid(row.dataset.uuid) : null);
    if (item?.type === "action") return item.use({ actor: this.document, strike, dialog });
    return this.document.strikeWith({ strike, dialog });
  }

  /**
   * The minus and the plus on an ammunition row (0.30.0): the count corrected by hand, one piece
   * at a time, at no cost. Recovering arrows after a fight is the table's (Mike, by question), and
   * this is how it is done. A player's change is an Adjusted line, as any quantity's is.
   */
  static async #onAdjustQuantity(event, target) {
    const item = this.#getItem(target);
    if (!item || !SW.PHYSICAL_TYPES.includes(item.type)) return null;
    const delta = Number(target.dataset.delta) || 0;
    const next = Math.max(0, (Number(item.system.quantity) || 0) + delta);
    if (!delta || (next === item.system.quantity)) return null;
    return item.update({ "system.quantity": next });
  }

  /**
   * The Loaded chip on a ranged weapon's row (0.29.0): correct the count by hand. An empty weapon
   * is made full; anything else gives up one shot, so one click flips a bow and a few step a
   * Repeating Crossbow down (`nextLoaded`). The Reload Maneuver is what loads it in play; this is
   * the table's word, as an armor piece's Adjusted tick is, and costs nothing.
   */
  static async #onToggleLoaded(event, target) {
    const item = this.#getItem(target);
    if (!item || (item.type !== "weapon") || !item.system.takesAmmunition) return null;
    return item.update({ "system.loaded": nextLoaded({ magazine: item.system.magazine, shots: item.system.shots }) });
  }

  static async #onItemUse(event, target) {
    const item = this.#getItem(target);
    return item?.use({ dialog: !event.shiftKey });
  }

  /** The pin on a Talent row (0.15.0): arm or disarm its claims for the next roll. */
  static async #onArmClaim(event, target) {
    const item = this.#getItem(target);
    if (!item) return null;
    return armClaim(this.document, item.id);
  }

  /* -------------------------------------------- */
  /*  Character Effects (0.16.0)                  */
  /* -------------------------------------------- */

  /** The state switch on an effect line: On to Skip to Off to On (module/rules/effects-state.mjs). */
  static async #onCycleEffectState(event, target) {
    const key = target.dataset.key;
    if (!key) return null;
    return cycleRuleState(this.document, key);
  }

  /** A new custom effect row, blank, for the owner to fill in. */
  static async #onAddEffect() {
    return addEffect(this.document);
  }

  /** Remove the custom effect of the row the control sits in. */
  static async #onRemoveEffect(event, target) {
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    if (!id) return false;
    return removeEffect(this.document, id);
  }

  /**
   * Remove a result pending on the character (0.22.0): the GM's control on its line of the Effects
   * tab; `removeGiven` refuses anyone else.
   */
  static async #onRemoveGiven(event, target) {
    const key = target.closest("[data-given-key]")?.dataset.givenKey;
    if (!key) return false;
    // A used Effect (0.25.0) is listed with the pending results and removed by the same control.
    if (key.startsWith("used:")) return removeUsed(this.document, key);
    return removeGiven(this.document, key);
  }

  /**
   * The "Apply to next roll" button on a claim line (0.17.0): arm or disarm the carrier's claims,
   * the same flag the Talent row's pin writes; `data-key` is the carrier key (an Item id, or a
   * custom effect's `effect:<row id>`).
   */
  static async #onArmClaimLine(event, target) {
    const key = target.dataset.key;
    if (!key) return null;
    return armClaimLine(this.document, key);
  }

  /** The Cast Maneuver on a spell Talent's row (PHB v4.21): ❷ Quick, ❸ Focused, ❹ Committed. */
  static async #onCastSpell(event, target) {
    const item = this.#getItem(target);
    if (!item) return null;
    return this.document.castSpell?.(item.id, { cast: target.dataset.cast, dialog: !event.shiftKey });
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

  /* -------------------------------------------- */
  /*  Basic Maneuvers: used from the compendium   */
  /* -------------------------------------------- */

  /** The compendium Item behind a Basic Maneuver row. */
  async #basicItem(target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    return uuid ? fromUuid(uuid) : null;
  }

  /** Use it as this character: roll the check it calls for, or put the card on the table. */
  static async #onBasicUse(event, target) {
    const item = await this.#basicItem(target);
    return item?.use({ actor: this.document, dialog: !event.shiftKey });
  }

  static async #onBasicChat(event, target) {
    const item = await this.#basicItem(target);
    return item?.toMessage({ actor: this.document });
  }

  static async #onBasicView(event, target) {
    const item = await this.#basicItem(target);
    return item?.sheet.render({ force: true });
  }

  /** Copy it onto the sheet, where it becomes this character's own to edit. */
  static async #onBasicAdopt(event, target) {
    const item = await this.#basicItem(target);
    if (!item) return;
    const data = item.toObject();
    delete data._id;
    data.system.basic = false;
    return this.document.createEmbeddedDocuments("Item", [data]);
  }

  /* -------------------------------------------- */
  /*  The Maneuvers tab's two switches (0.28.0)   */
  /* -------------------------------------------- */

  /**
   * The tab's toggle (ruling 281): only the Maneuvers that apply now, or every Maneuver with the
   * rest dimmed. A client setting, so it is this user's on every sheet and device session; the
   * setting's onChange redraws any other character sheet this client has open, and this one is
   * redrawn here in case the setting was already what was asked for.
   */
  static async #onToggleAllManeuvers() {
    const next = !SwCharacterSheet.showAllManeuvers();
    try {
      await game.settings.set(SW.SYSTEM_ID, "showAllManeuvers", next);
    } catch (err) {
      console.error("STARWROUGHT | the Maneuvers toggle could not be saved", err);
    }
    return this.render({ parts: ["actions"] });
  }

  /**
   * The bookmark on a Maneuver's row (ruling 288; Mike: "these are always at the top of the list
   * and are always visible"). The Favorites are the character's, so they follow it to every
   * device and the GM sees them: the slugs of the bookmarked Maneuvers under one flag, in the
   * order they were marked. By slug, so a Favorite holds whether the row is the Basic one or a
   * copy on the sheet. `swAnnounced`: a bookmark is no change the audit should speak of.
   */
  static async #onToggleFavorite(event, target) {
    if (!this.isEditable) return null;
    const slug = target.closest("[data-slug]")?.dataset.slug;
    if (!slug) return null;
    const current = this.#favorites();
    const next = current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug];
    return this.document.update({ [`flags.${SW.SYSTEM_ID}.${FAVORITES_FLAG}`]: next }, { swAnnounced: true });
  }

  /* -------------------------------------------- */

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

  /** Click a pip to set how many actions are left. A reserved pip is spoken for; it does nothing. */
  static async #onSetActions(event, target) {
    if (target.dataset.state === "reserved") return;
    const value = Number(target.dataset.value);
    const current = this.document.system.actions.value;
    // Clicking the pip you are already on spends it, which is the common case.
    return this.document.update({ "system.actions.value": value === current ? value - 1 : value });
  }

  /** The reset arrow: a hand adjustment, so the audit announces it (0.5.1, T10). */
  static async #onResetActions() {
    return this.document.resetActions({ byHand: true });
  }

  /** Pass: decline this Opportunity. Not a Maneuver; a full circuit of Passes ends the round. */
  static async #onPass() {
    return this.document.pass();
  }

  /** End the Opportunity: play moves to the next combatant. Only from the combatant whose turn it is. */
  static async #onEndOpportunity() {
    if (!this.document.isTurn) return;
    return game.combat?.nextTurn();
  }

  /** Finish waits for the next Opportunity (0.19.0); a GM's click from the sheet forces it. */
  static async #onFinishPrepared() {
    return this.document.finishPrepared({ force: game.user.isGM });
  }

  static async #onAbandonPrepared() {
    return this.document.abandonPrepared();
  }

  static #onToggleCollapse(event, target) {
    const slug = target.dataset.slug;
    if (this.#collapsed.has(slug)) this.#collapsed.delete(slug);
    else this.#collapsed.add(slug);
    // The Constellations tab folds Constellations; the Maneuvers tab folds Basic Maneuver groups.
    return this.render({ parts: [target.dataset.part || "constellations"] });
  }

  /** Plus and minus buttons on Hero Points and Dying. */
  static async #onAdjust(event, target) {
    const path = target.dataset.path;
    const delta = Number(target.dataset.delta) || 0;
    const current = foundry.utils.getProperty(this.document, path) ?? 0;
    const next = Math.max(0, current + delta);
    await this.document.update({ [path]: next });
    // Dying is also a token condition, so keep the two in step.
    if (path === "system.dying") await this.document.setCondition("dying", next);
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

  /* -------------------------------------------- */
  /*  Auras (0.5.1)                               */
  /* -------------------------------------------- */

  /** The ring toggle on a Talent or Maneuver row, or on the Overview's Ranges line: flip the Visible mark. */
  static async #onToggleAura(event, target) {
    const key = target.dataset.key;
    if (!key) return;
    const current = rangeFor(this.document, key)?.visible ?? false;
    return this.document.setAuraVisible(key, !current);
  }

  /** Find the Item a clicked row belongs to. */
  #getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.document.items.get(id) ?? null;
  }
}
