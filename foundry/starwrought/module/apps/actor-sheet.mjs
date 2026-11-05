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
import { loadBasicActions, enabledConstellations } from "../helpers/content.mjs";
// The header's live state and the tooltips, shared with the adversary and party sheets (0.10.1).
import { actionsContext, bindContext, rulesPageOf, vigorContext, zoneWounds, lockedTips, traitChips, windTip } from "../helpers/actor-context.mjs";
import { openRulesPage } from "../documents/chat.mjs";
// THE PARTY'S LOOT (0.7.1): a party Item dropped on this sheet is a Take over the relay, not a copy.
import { requestTake } from "../documents/party-socket.mjs";
// AURAS (0.5.1): the ring toggles on the Talent and Maneuver rows and the Overview's Ranges line.
import { auraRowsByItem, reachRangeRows, rangeFor } from "../canvas/auras.mjs";
// CLAIMS (0.15.0, ruling 174): the pin on a Talent row that arms its claims for the next roll.
import { claimsOf, armClaim } from "../rules/claims.mjs";
// The Threshold tooltip's conditional rules (0.15.0): the As read line of each rule the sheet's number leaves out.
import { needsMoment } from "../rules/operators.mjs";
import { summarize } from "../rules/grammar.mjs";
import { usableByRule } from "../rules/engine.mjs";
// CHARACTER EFFECTS (0.16.0): the Overview's Effects panel, its state switch and its custom rows.
import { effectsContext } from "../helpers/effects.mjs";
import { cycleRuleState, addEffect, removeEffect } from "../rules/effects-state.mjs";

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
    if ((slug !== "defenses") && !Object.values(SW.DEFENSES).some(d => d.slug === slug)) continue;
    out.push({ slug, talent: SW.plainName(item?.name ?? ""), summary: summarize(rule) });
  }
  return out;
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
      toggleZone: SwCharacterSheet.#onToggleZone,
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
      removeEffect: SwCharacterSheet.#onRemoveEffect
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
        ...conditional.filter(r => (r.slug === def.slug) || (r.slug === "defenses")).map(r => `${r.talent}: ${r.summary}`)
      ].join("\n")
    }));
    context.bind = bindContext(actor);
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
    context.inventory = this.#prepareInventory();
    context.strikes = this.#prepareStrikes();
    // TALENT MANEUVERS (0.16.0): the Maneuvers a Talent granted (`flags.starwrought.grantedBy`)
    // sit under their own heading, named for the Talent; the rest are the character's own.
    const actions = actor.items.filter(i => i.type === "action").sort((a, b) => a.name.localeCompare(b.name));
    const grantedBy = item => item.getFlag(SW.SYSTEM_ID, "grantedBy");
    context.actionItems = actions.filter(i => !grantedBy(i));
    context.talentActions = actions.filter(i => grantedBy(i)).map(i => ({
      item: i, talentName: SW.plainName(actor.items.get(grantedBy(i))?.name ?? "")
    }));
    context.basicActions = await this.#prepareBasicActions();
    context.effects = actor.effects.map(e => ({
      id: e.id, name: e.name, img: e.img, disabled: e.disabled,
      description: e.description, isSuppressed: e.isSuppressed,
      // The rules page a condition's row opens, when its condition has one (0.5.1, T6).
      rulesPage: rulesPageOf(e)
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

    // AURAS (0.5.1): the ring toggle beside each Talent or Maneuver row that carries an aura,
    // looked up by Item id in the templates, and the body's own ranges for the Ranges line.
    context.auraByItem = auraRowsByItem(actor);
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

  /**
   * An open Biography or Notes editor across a re-render (0.5.1, T19). The sheet redraws its parts
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
      group.constellations.push({
        ...entry,
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
        collapsed: this.#collapsed.has(entry.slug),
        unopened: false,
        talents: entry.talents.map(t => ({
          id: t.id,
          name: t.name,
          img: t.img,
          tier: t.system.tier,
          glyph: t.system.glyph,
          root: t.system.root || t.system.bloodlineRoot,
          effect: t.system.effect,
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

    inventory.held.sort((a, b) => a.name.localeCompare(b.name));
    inventory.stowed.sort((a, b) => a.name.localeCompare(b.name));
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
    const slugKey = item.system.isRanged ? "ranged" : "melee";
    const training = sys[slugKey] ?? { rank: "untrained", proficiency: 0, dice: 1 };
    // Handling still applies: Practiced drops a rank without Familiarity, Technical drops to Untrained.
    const rank = actor.weaponRank?.(item) ?? training.rank ?? "untrained";

    const strike = sys.strikeAttributeFor?.(item) ?? { attribute: item.system.attackAttribute, source: "weapon" };
    const attribute = strike.attribute in SW.ATTRIBUTES ? strike.attribute : "might";
    const attributeLabel = game.i18n.localize(SW.ATTRIBUTES[attribute].label);
    const standing = SW.resolveModifiers(sys.attackModifiers ?? []).total;
    const attackMod = sys.attributes[attribute].mod + SW.rankBonus(rank) + sys.bonuses.attack + standing;

    // The dice are the rank's (PHB v4.21), the rank Handling leaves this weapon with.
    const dice = SW.weaponDice(rank);
    const might = item.system.flags.mechanical ? 0 : sys.attributes.might.mod;
    const flat = might;
    const die = item.system.effectiveDie;
    const full = flat ? `${dice}d${die}+${flat}` : `${dice}d${die}`;
    // A Thrown weapon's throw is Might (PHB v4.21), said in the tooltip when it would differ.
    const thrownNote = (item.system.flags?.thrown && !item.system.isRanged && (attribute !== "might"))
      ? ` ${game.i18n.localize("STARWROUGHT.Strike.attributeThrown")}`
      : "";

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
      damage: `${full} ${game.i18n.localize(SW.DAMAGE_TYPES[item.system.effectiveType].label)}`,
      quickDamage: `1d${die}`,
      // Total Reach is your Natural Reach plus the weapon's. A ranged weapon shows its range.
      reach: item.system.isRanged
        ? `${item.system.range} ft`
        : `${item.system.reach + sys.reach} ft`,
      reachHint: item.system.isRanged
        ? game.i18n.localize("STARWROUGHT.Field.rangeHint")
        : game.i18n.format("STARWROUGHT.Field.totalReachHint", {
            natural: sys.reach, weapon: item.system.reach, total: item.system.reach + sys.reach
          }),
      traits: item.system.totalTraits,
      defaultStrike: SW.DEFAULT_STRIKE
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

  /**
   * The Basic Maneuvers, grouped by category for the Maneuvers tab. They come from the compendium
   * and are never copied onto the character, so what the sheet shows is what the book says today.
   */
  async #prepareBasicActions() {
    const groups = new Map();
    for (const item of await loadBasicActions()) {
      const key = item.system.category || game.i18n.localize("STARWROUGHT.Section.basicActions");
      if (!groups.has(key)) {
        groups.set(key, { key, label: key, collapsed: this.#collapsed.has(`basic:${key}`), actions: [] });
      }
      const flavour = String(item.system.description ?? "").replace(/<[^>]+>/g, "").trim();
      groups.get(key).actions.push({
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        glyph: item.system.glyph,
        costLabel: item.system.costLabel,
        traits: item.system.traits ?? [],
        requirements: item.system.requirements,
        hint: flavour || game.i18n.localize("STARWROUGHT.Sheet.basicUseHint")
      });
    }
    return [...groups.values()];
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

  /** Ten minutes' rest (PHB v4.21): level x Presence Vigor back and Fatigued off; the table's word that the minutes passed. */
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

  /** The bind line, the EXPOSED badge and a condition row open their Rules Reference page (0.5.1, T6). */
  static async #onRulesPage(event, target) {
    return openRulesPage(target.dataset.page);
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

  static async #onFinishPrepared() {
    return this.document.finishPrepared();
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
