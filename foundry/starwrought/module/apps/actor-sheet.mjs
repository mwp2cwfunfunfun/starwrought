/**
 * The character sheet.
 *
 * Laid out the way the handbook reads: who you are, then the four Defenses and the four Zones,
 * then the sky of Constellations you have actually invested in, then what you are carrying.
 */

import * as SW from "../config.mjs";
import { SwItem } from "../documents/item.mjs";
import { SwChargen } from "./chargen.mjs";
import { stanceContext } from "../helpers/stance.mjs";
import { loadBasicActions } from "../helpers/content.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/* -------------------------------------------- */
/*  Shared context: the header's live state      */
/* -------------------------------------------- */

/**
 * The action economy as the header shows it: six pips a round (more for a creature with more),
 * lit while free, marked while reserved for a Prepared Maneuver, dim once spent. Only meaningful
 * in an encounter, so `show` is false outside one. Shared by the character and adversary sheets.
 * @param {Actor} actor
 * @returns {object}
 */
export function actionsContext(actor) {
  const sys = actor.system;
  const actions = sys.actions;
  if (!actions || !actor.inEncounter) return { show: false };

  const perRound = Math.max(1, Number(sys.actionsPerRound) || SW.ACTIONS_PER_ROUND);
  const value = Math.max(0, Number(actions.value) || 0);
  const reserved = Math.max(0, Number(actions.reserved) || 0);
  const slots = Math.max(perRound, value + reserved);
  const isTurn = actor.isTurn;

  const pips = Array.fromRange(slots, 1).map(n => {
    const state = n <= value ? "free" : n <= value + reserved ? "reserved" : "spent";
    return {
      value: n,
      state,
      glyph: SW.ACTION_GLYPHS[Math.min(6, n)] ?? "●",
      tooltip: state === "reserved"
        ? game.i18n.format("STARWROUGHT.Actions.reserved", { n: reserved })
        : game.i18n.format("STARWROUGHT.Actions.setTo", { n })
    };
  });

  const preparing = actions.preparing ?? null;
  let preparingLabel = null;
  if (preparing) {
    preparingLabel = preparing.label
      || (preparing.strike ? game.i18n.localize(SW.STRIKE_KINDS[preparing.strike]?.label ?? "") : "")
      || game.i18n.localize(SW.CONDITIONS.preparing.name);
    const cost = SW.ACTION_GLYPHS[Number(preparing.cost)] ?? "";
    if (cost) preparingLabel = `${preparingLabel} ${cost}`;
  }

  return {
    show: true,
    isTurn,
    value,
    reserved,
    perRound,
    pips,
    preparing,
    preparingLabel,
    passGlyph: SW.ACTION_GLYPHS[0],
    tooltip: isTurn
      ? game.i18n.format("STARWROUGHT.Actions.yourTurn", { left: value, total: perRound })
      : game.i18n.localize("STARWROUGHT.Actions.notYourTurn")
  };
}

/**
 * The Bind this actor is in, as one line: neutral, Controlling, or Controlled, with the partner's
 * name and both implements. Null when there is none. Shared by both sheets.
 * @param {Actor} actor
 * @returns {object|null}
 */
export function bindContext(actor) {
  const bind = actor.system.bind;
  const state = bind?.state;
  if (!state || !(state in BIND_KEYS)) return null;

  let partner = null;
  try { partner = bind.partnerUuid ? fromUuidSync(bind.partnerUuid) : null; } catch { partner = null; }
  const args = {
    partner: partner?.name ?? game.i18n.localize("STARWROUGHT.Bind.unknownPartner"),
    mine: bind.mine || game.i18n.localize("STARWROUGHT.Bind.unnamedImplement"),
    theirs: bind.theirs || game.i18n.localize("STARWROUGHT.Bind.unnamedImplement")
  };
  const condition = SW.CONDITIONS[BIND_KEYS[state]];
  return {
    state,
    text: game.i18n.format(`STARWROUGHT.Bind.${state}`, args),
    conditionLabel: game.i18n.localize(condition.name),
    img: condition.img
  };
}

/** Bind states, mapped onto the condition each shows on the token. */
const BIND_KEYS = Object.freeze({ neutral: "bound", controlling: "controlling", controlled: "controlled" });

/**
 * Vigor as the bar draws it: the value's share of the track, and Temporary Vigor laid on top as
 * its own segment, capped so the two together never overflow. Shared by both sheets.
 * @param {Actor} actor
 * @returns {object}
 */
export function vigorContext(actor) {
  const vigor = actor.system.vigor ?? {};
  const max = Math.max(0, Number(vigor.max) || 0);
  const value = Math.max(0, Number(vigor.value) || 0);
  const temp = Math.max(0, Number(vigor.temp) || 0);
  const pct = max ? Math.clamp(Math.round((value / max) * 100), 0, 100) : 0;
  const tempPct = max ? Math.clamp(Math.round((temp / max) * 100), 0, 100 - pct) : 0;
  return {
    value, temp, max, pct, tempPct,
    perLevel: vigor.perLevel ?? 0,
    rest: vigor.rest ?? 0
  };
}

/**
 * The Wounds one Zone carries, as pips against its capacity, with the effect in force. Reads the
 * derived fields when the data model provides them and falls back to the rules constants when it
 * does not, so the sheet never shows a blank where a number belongs. Shared by both sheets.
 * @param {Actor} actor
 * @param {string} key  A key of SW.ZONES.
 * @returns {object}
 */
export function zoneWounds(actor, key) {
  const sys = actor.system;
  const z = sys.zones?.[key] ?? {};
  const wounds = Math.max(0, Number(z.wounds) || 0);
  const capacity = Math.max(1,
    Number(z.capacity)
    || Number(sys.woundCapacity?.(key))
    || ((SW.WOUND_CAPACITY[sys.size] ?? SW.WOUND_CAPACITY.medium) + (Number(sys.woundBonus) || 0)));
  const final = z.final ?? (wounds >= capacity);
  const crit = SW.ZONE_CRITICALS[key];
  const effectKey = z.woundEffect ?? (wounds <= 0 ? null : final ? crit.final : crit.first);
  const effect = effectKey ? game.i18n.localize(effectKey) : null;
  const zoneLabel = game.i18n.localize(SW.ZONES[key].label);

  return {
    key,
    wounds,
    capacity,
    final,
    wounded: wounds > 0,
    effect,
    pips: Array.fromRange(capacity, 1).map(n => ({
      filled: n <= wounds,
      final: n === capacity
    })),
    tooltip: wounds > 0
      ? game.i18n.format("STARWROUGHT.Wound.inForce", { zone: zoneLabel, effect })
      : game.i18n.format("STARWROUGHT.Field.woundsHint", { capacity })
  };
}

/* -------------------------------------------- */

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
      toggleZone: SwCharacterSheet.#onToggleZone,
      recenter: SwCharacterSheet.#onRecenter,
      rest: SwCharacterSheet.#onRest,
      recovery: SwCharacterSheet.#onRecovery,
      refuseDeath: SwCharacterSheet.#onRefuseDeath,
      treatWound: SwCharacterSheet.#onTreatWound,
      adjustWound: SwCharacterSheet.#onAdjustWound,
      endBind: SwCharacterSheet.#onEndBind,
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
      setStance: SwCharacterSheet.#onSetStance,
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

    context.defenses = Object.values(sys.defenses).map(def => ({
      ...def,
      label: game.i18n.localize(def.label),
      hint: game.i18n.localize(def.hint),
      rankLabel: game.i18n.localize(def.rankLabel)
    }));
    context.stance = stanceContext(actor);
    context.bind = bindContext(actor);

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
        materialLabel: game.i18n.localize(z.materialLabel ?? SW.MATERIALS.none.label),
        weakTo: z.weakTo ? game.i18n.localize(SW.DAMAGE_TYPES[z.weakTo].label) : null,
        crit: game.i18n.localize(SW.ZONE_CRITICALS[key].effect),
        wounds: zoneWounds(actor, key)
      };
    });

    // Spent: at 0 Vigor. Derived by the data model; read defensively so an older document that has
    // not been through prepareDerivedData yet still renders.
    context.spent = sys.spent ?? ((sys.vigor?.value ?? 1) === 0);
    context.vigor = vigorContext(actor);

    context.constellations = this.#prepareConstellations();
    context.inventory = this.#prepareInventory();
    context.strikes = this.#prepareStrikes();
    context.actionItems = actor.items.filter(i => i.type === "action")
      .sort((a, b) => a.name.localeCompare(b.name));
    context.basicActions = await this.#prepareBasicActions();
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
    context.actions = actionsContext(actor);

    // Movement, in feet: a Move, a Step, a Rush, a Leap.
    context.movement = {
      speed: sys.speed ?? 0,
      step: sys.step ?? Math.floor((sys.speed ?? 0) / SW.STEP_DIVISOR),
      rush: sys.rush ?? Math.max(0, (sys.speed ?? 0) * SW.RUSH_MULTIPLIER - (sys.loadStrain ?? 0)),
      leap: sys.leap ?? Math.max(0, SW.LEAP_FEET - (sys.loadStrain ?? 0))
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

  /**
   * Melee and Ranged as the overview shows them: rank and Proficiency for each, the specialization
   * damage the better of the two earns, and the number of weapon dice your level rolls.
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
        specialization: entry.specialization ?? 0,
        attribute: sys.constellations?.[slug]?.attribute ?? SW.constellations[slug]?.attribute ?? fallbackAttribute
      };
    };
    const melee = row(SW.MELEE_SLUG, "melee", "might");
    const ranged = row(SW.RANGED_SLUG, "ranged", "agility");
    return {
      melee,
      ranged,
      weaponDice: sys.weaponDice ?? SW.weaponDice(sys.level),
      kinds: Object.entries(SW.STRIKE_KINDS).map(([key, kind]) => ({
        key,
        label: game.i18n.localize(kind.label),
        glyph: SW.ACTION_GLYPHS[kind.cost] ?? "",
        hint: game.i18n.localize(`STARWROUGHT.Strike.${key}Hint`)
      }))
    };
  }

  /* -------------------------------------------- */

  /** Group the character's Constellations by category, in handbook order. */
  #prepareConstellations() {
    const groups = {};
    const all = this.document.system.constellations;
    for (const entry of Object.values(all)) {
      const category = entry.category ?? "general";
      const group = (groups[category] ??= {
        key: category,
        label: game.i18n.localize(SW.CATEGORIES[category]?.label ?? SW.CATEGORIES.general.label),
        order: SW.CATEGORIES[category]?.order ?? 9,
        constellations: []
      });
      // A parent (Melee, Ranged) counts its Combat Styles' points toward its rank; a child says
      // which parent it feeds. Neither changes what the Talents themselves cost.
      const inherited = Number(entry.inherited) || 0;
      const parent = entry.parent ? (all[entry.parent]?.name ?? SW.getConstellation(entry.parent)?.name ?? entry.parent) : null;
      group.constellations.push({
        ...entry,
        pool: entry.pool ?? entry.points,
        inherited,
        parentName: parent,
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
      exposed: actor.system.zones[zone].exposed,
      wounds: zoneWounds(actor, zone)
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
    const training = sys[slugKey] ?? { rank: "untrained", proficiency: 0, specialization: 0 };
    // Handling still applies: Practiced drops a rank without Familiarity, Technical drops to Untrained.
    const rank = actor.weaponRank?.(item) ?? training.rank ?? "untrained";

    const strike = sys.strikeAttributeFor?.(item) ?? { attribute: item.system.attackAttribute, source: "weapon" };
    const attribute = strike.attribute in SW.ATTRIBUTES ? strike.attribute : "might";
    const attributeLabel = game.i18n.localize(SW.ATTRIBUTES[attribute].label);
    const standing = SW.resolveModifiers(sys.attackModifiers ?? []).total;
    const attackMod = sys.attributes[attribute].mod + SW.rankBonus(rank) + sys.bonuses.attack + standing;

    const dice = sys.weaponDice ?? SW.weaponDice(sys.level);
    const might = item.system.flags.mechanical ? 0 : sys.attributes.might.mod;
    const flat = might + (training.specialization ?? 0);
    const die = item.system.effectiveDie;
    const full = flat ? `${dice}d${die}+${flat}` : `${dice}d${die}`;
    // The Combat Style whose Key Attribute won, named for the tooltip. `system.style` is the
    // Style's name or slug as authored on the weapon; slugify so either spelling finds it.
    const styleSlug = SW.slugify(item.system.style ?? "");
    const styleName = strike.source === "style"
      ? (sys.constellations?.[styleSlug]?.name ?? SW.getConstellation(styleSlug)?.name ?? item.system.style)
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
      strikeAttributeHint: strike.source === "style"
        ? game.i18n.format("STARWROUGHT.Strike.attributeFromStyle", { attribute: attributeLabel, style: styleName })
        : game.i18n.format("STARWROUGHT.Strike.attributeFromWeapon", { attribute: attributeLabel }),
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

  /** Ten minutes and an Endure check against 10 + the Wounds carried. The actor rolls it. */
  static async #onTreatWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    return this.document.treatWound(zone);
  }

  /**
   * The GM's bookkeeping on a Zone's Wounds. Adding one goes through `applyWound` so everything a
   * Wound does (abandoning a Prepared Maneuver, Torso bleed, Dying on a final Torso or Head Wound)
   * fires; taking one off is a correction with no rules attached, so it is a plain update.
   */
  static async #onAdjustWound(event, target) {
    const zone = target.closest("[data-zone]")?.dataset.zone ?? target.dataset.zone;
    if (!(zone in SW.ZONES)) return;
    const delta = Number(target.dataset.delta) || 0;
    if (delta > 0) return this.document.applyWound(zone, delta);
    const current = this.document.system.zones[zone]?.wounds ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    await this.document.update({ [`system.zones.${zone}.wounds`]: next });
    // Wounded is also a token condition: on while any Zone carries a Wound.
    const any = Object.keys(SW.ZONES).some(z => (this.document.system.zones[z]?.wounds ?? 0) > 0);
    return this.document.setCondition("wounded", any);
  }

  static async #onEndBind() {
    return this.document.endBind();
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

  static async #onSetStance(event, target) {
    return this.document.setStance(target.dataset.stance);
  }

  static async #onResetActions() {
    return this.document.resetActions();
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

  /** Find the Item a clicked row belongs to. */
  #getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.document.items.get(id) ?? null;
  }
}
