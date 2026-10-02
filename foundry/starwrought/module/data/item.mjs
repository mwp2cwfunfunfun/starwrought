/**
 * Item data models.
 *
 * Talents, Constellations, and the chassis pieces (Ancestry, Bloodline, Culture, Background,
 * Calling) are all Items, because that is what makes them compendium content. Equipment carries
 * its Traits as authored text and derives the mechanical flags from them, so a weapon's rules
 * come from its Trait line rather than from a second place that can drift.
 */

import * as SW from "../config.mjs";

const fields = foundry.data.fields;

/**
 * A stored Speed of this many feet or more is a v3.x value (the old five-foot scale, on which a
 * Human was 25). v4.10 Speed is feet per Move on the one-foot grid, and a Human is 6.
 */
export const LEGACY_SPEED_FLOOR = 15;

/**
 * A v3.x Speed (five-foot scale) becomes feet per Move on the one-foot grid: a quarter of it,
 * rounded down as the Math Conventions say, so a Human's 25 is 6.
 *
 * This is a one-time conversion, run by the world migration in `starwrought.mjs` and recorded in
 * the `systemVersion` world setting, not a rule in `migrateData`: there it ran on every load and on
 * every write, which made 15 a ceiling no Speed could ever be typed past.
 * @param {number} value
 * @returns {number}
 */
export function migrateSpeed(value) {
  if (typeof value !== "number" || value < LEGACY_SPEED_FLOOR) return value;
  return Math.max(1, Math.floor(value / 4));
}

/**
 * The helm penalty a Head piece imposes (PHB v4.10: Closed helm -2, Open helm -1 to Awareness
 * checks, the Awareness Threshold and Initiative), matched by name against SW.HELM_PENALTIES,
 * case blind, since the book has no trait for it.
 * @param {string} name
 * @returns {number}
 */
export function helmPenaltyFor(name) {
  if (!name) return 0;
  const wanted = String(name).trim().toLowerCase();
  for (const [piece, penalty] of Object.entries(SW.HELM_PENALTIES)) {
    if (piece.toLowerCase() === wanted) return penalty;
  }
  return 0;
}

/* -------------------------------------------- */
/*  Trait parsing                               */
/* -------------------------------------------- */

/**
 * Read the mechanical flags out of a weapon's Trait line. "A Trait is never flavor: if the word
 * is in a Trait line, some rule cares about it." (PHB v4.10, Weapon Traits.)
 * @param {string[]} traits
 * @returns {object}
 */
export function parseWeaponTraits(traits = []) {
  const flags = {
    agile: false,
    finesse: false,
    close: false,
    /** +1 Gear bonus to Guard against melee Attacks while wielded. */
    parry: false,
    sweep: false,
    mechanical: false,
    nonlethal: false,
    twoHanded: false,
    /** Cannot Parry, form a Bind, or be Bound. It can still Guard. */
    flexible: false,
    /** Wounds on any Critical Hit, Exposed Zone or not. */
    massive: false,
    /** An attack that offers nothing to bind. */
    unparryable: false,
    ranged: null,
    thrown: null,
    reload: 0,
    capacity: 0,
    unwieldy: 0,
    armorPiercing: 0,
    deadly: null,
    twoHandDie: null,
    versatile: null,
    maneuvers: []
  };
  for (const raw of traits) {
    const trait = String(raw).trim();
    const lower = trait.toLowerCase();
    let m;
    if (lower === "agile") flags.agile = true;
    else if (lower === "finesse") flags.finesse = true;
    else if (lower === "close") flags.close = true;
    else if (lower === "parry") flags.parry = true;
    else if (lower === "sweep") flags.sweep = true;
    else if (lower === "mechanical") flags.mechanical = true;
    else if (lower === "nonlethal") flags.nonlethal = true;
    else if (lower === "two-handed") flags.twoHanded = true;
    else if (lower === "flexible") flags.flexible = true;
    else if (lower === "massive") flags.massive = true;
    else if (lower === "unparryable") flags.unparryable = true;
    else if ((m = lower.match(/^ranged\s+(\d+)/))) flags.ranged = Number(m[1]);
    else if ((m = lower.match(/^thrown\s+(\d+)/))) flags.thrown = Number(m[1]);
    else if ((m = lower.match(/^reload\s+\[?(\d+)/))) flags.reload = Number(m[1]);
    else if ((m = lower.match(/^capacity\s+\[?(\d+)/))) flags.capacity = Number(m[1]);
    else if ((m = lower.match(/^unwieldy\s+\[?(\d+)/))) flags.unwieldy = Number(m[1]);
    // The book prints both "Armor-Piercing 1" and "Armor Piercing 1".
    else if ((m = lower.match(/^armor[- ]piercing\s+\[?(\d+)/))) flags.armorPiercing = Number(m[1]);
    else if ((m = lower.match(/^deadly\s+d(\d+)/))) flags.deadly = Number(m[1]);
    else if ((m = lower.match(/^two-hand\s+d(\d+)/))) flags.twoHandDie = Number(m[1]);
    else if ((m = lower.match(/^versatile\s+([bps])\b/))) flags.versatile = SW.DAMAGE_ABBR[m[1].toUpperCase()];
    else if (/^(grapple|trip|disarm|shove)$/.test(lower)) flags.maneuvers.push(lower);
    else if (/^(grapple|trip|disarm|shove)(,\s*(grapple|trip|disarm|shove))+$/.test(lower)) {
      flags.maneuvers.push(...lower.split(/,\s*/));
    }
  }
  return flags;
}

/** The table null-markers a Trait cell may hold instead of Traits: a hyphen, or the long dash (U+2014). */
const NULL_MARKERS = new Set(["-", String.fromCharCode(0x2014)]);

/** Split an authored Trait line ("Agile, Close, Finesse, Thrown 10 ft") into an array. */
export function splitTraits(line) {
  if (Array.isArray(line)) return line;
  return String(line ?? "")
    .split(/,(?![^(]*\))/)
    .map(t => t.trim())
    .filter(t => t && !NULL_MARKERS.has(t));
}

/* -------------------------------------------- */
/*  Shared fields                               */
/* -------------------------------------------- */

/**
 * The action cost of a Talent or an Action (PHB v4.10, Symbols). Costs run ⓿ to ❻ and are stored
 * as the strings "0" to "6"; "passive" is a Talent that is not something you do. Several cost a
 * range rather than a number, and the two ends are not always continuous: Strike is one action to
 * three, Disarm is one or three. The Reaction trait ↺ is a flag of its own, because a Reaction
 * still has a cost (Parry is ❶↺, a Posture ⓿↺), and a Maneuver whose Reaction half costs
 * something different carries that in `reactionCost` (Aid is ❶, or ⓿↺).
 */
function costFields(initial = "1") {
  return {
    cost: new fields.StringField({
      required: true, choices: Object.keys(SW.ACTION_COSTS), initial
    }),
    /** The upper end, when there is one. Blank means the cost is fixed. */
    costMax: new fields.StringField({
      required: false, blank: true, choices: [...Object.keys(SW.ACTION_COSTS), ""], initial: ""
    }),
    /** "to" for a continuous range, "or" when only the two ends are legal. */
    costMode: new fields.StringField({
      required: true, choices: ["to", "or"], initial: "to"
    }),
    /** The Reaction trait: performed outside your Opportunity, paid from the same six actions. */
    reaction: new fields.BooleanField({ initial: false }),
    /** The Reaction half's own cost, when it differs from `cost`. Blank means the same. */
    reactionCost: new fields.StringField({
      required: false, blank: true, choices: [...Object.keys(SW.ACTION_COSTS), ""], initial: ""
    })
  };
}

/**
 * v3.x cost keys to v4.10. "free" was ⓿; "reaction" was a free reaction slot, so it is ⓿ with the
 * Reaction trait; and a Talent's "0" meant passive (an Action's "0" is a free Maneuver and stays,
 * except for the Exploration Mode and Downtime Mode Activities, which 0.3.7 built with "0" to mean
 * "no glyph": a ten-minute Search or a week's Retraining is not a free Maneuver).
 * A v3.x source never carried the `reaction` flag, which is how one is told from new data: a
 * Talent built by v4.10 with cost "0" is a free Maneuver and arrives with `reaction` set.
 * @param {object} source
 * @param {"talent"|"action"} type
 */
function migrateCost(source, type) {
  if (source.reaction !== undefined) return source;
  let reaction = false;
  if (source.cost !== undefined) {
    const original = String(source.cost);
    const legacy = SW.LEGACY_ACTION_COSTS[original];
    const activity = /^(Exploration|Downtime) Mode$/.test(source.category ?? "");
    if (legacy) {
      source.cost = legacy.cost;
      reaction = legacy.reaction;
    } else if ((original === "0") && ((type === "talent") || activity)) {
      source.cost = "passive";
    }
  }
  if (source.costMax !== undefined && source.costMax !== "") {
    const legacy = SW.LEGACY_ACTION_COSTS[String(source.costMax)];
    if (legacy) {
      source.costMax = legacy.cost;
      reaction ||= legacy.reaction;
    }
  }
  source.reaction = reaction;
  source.reactionCost ??= "";
  return source;
}

/**
 * Glyph and label for a cost, as the handbook prints it: "❶", "❶ to ❸", "❶ or ❸", "❶↺", "⓿↺",
 * "❶ (⓿↺)"; and in words for a tooltip.
 * @param {object} system  Anything carrying cost, costMax, costMode, reaction and reactionCost.
 */
function prepareCost(system) {
  system.glyph = SW.costGlyphs(system);
  const words = key => game.i18n.localize(SW.ACTION_COSTS[key]?.label ?? "");
  let label = words(system.cost);
  if (system.costMax && (system.costMax !== system.cost)) {
    const joiner = game.i18n.localize(system.costMode === "or"
      ? "STARWROUGHT.Action.joinOr"
      : "STARWROUGHT.Action.joinTo");
    label = `${label} ${joiner} ${words(system.costMax)}`;
  }
  if (system.reaction) {
    label = (system.reactionCost !== "" && system.reactionCost !== system.cost)
      ? game.i18n.format("STARWROUGHT.Action.withReactionCost", { cost: label, reaction: words(system.reactionCost) })
      : game.i18n.format("STARWROUGHT.Action.withReaction", { cost: label });
  }
  system.costLabel = label;
  system.costValue = SW.actionCostValue(system.cost);
}

/**
 * The aura of a Talent or Maneuver (0.5.1): the "within N feet" its Effect speaks of, drawn on the
 * map around whoever carries it. `range` is feet from the edge of the carrier's space, null when
 * the ability has none (a blank Aura cell in the spreadsheet); `affects` is who it concerns, which
 * picks its colour (SW.AURA_COLORS); `visible` is the default mark. Visible auras are Pinned for
 * every combatant once an encounter starts, the rest show only as a preview (Mike's rule), and the
 * carrier's own mark in `actor.system.auras.visible` overrides this default.
 */
function auraFields() {
  return {
    aura: new fields.SchemaField({
      range: new fields.NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
      affects: new fields.StringField({
        required: true, choices: Object.keys(SW.AURA_AUDIENCES), initial: "all"
      }),
      visible: new fields.BooleanField({ initial: false })
    })
  };
}

/** Whether the ability has an aura at all, its colour, and the short line the sheet prints for it. */
function prepareAura(system) {
  const aura = system.aura;
  system.hasAura = Number.isInteger(aura?.range) && (aura.range > 0);
  system.auraColor = SW.AURA_COLORS[aura?.affects] ?? SW.AURA_COLORS.all;
  system.auraLabel = system.hasAura
    ? game.i18n.format("STARWROUGHT.Field.auraSummary", {
      feet: aura.range,
      affects: game.i18n.localize(SW.AURA_AUDIENCES[aura.affects]?.label ?? SW.AURA_AUDIENCES.all.label)
    })
    : "";
}

/** Description plus the Trait line, which every Item in the game has. */
function describedFields() {
  return {
    description: new fields.HTMLField({ initial: "" }),
    traits: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] }),
    source: new fields.StringField({ initial: "" })
  };
}

/** Fields that only a thing you can carry needs. */
function physicalFields(state = "worn") {
  return {
    quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    price: new fields.StringField({ initial: "" }),
    load: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    /** Held, worn, or carried. See SW.CARRY_STATES. */
    state: new fields.StringField({
      required: true, choices: Object.keys(SW.CARRY_STATES), initial: state
    })
  };
}

/**
 * Turn the old boolean into the three-state model, so a character built before this change keeps
 * their armor on and their sword in hand.
 * @param {object} source
 * @param {string} type
 */
function migrateCarryState(source, type) {
  if (source.state !== undefined) return source;
  if (source.equipped === undefined) return source;
  // Armor that is off the body is in a pack; a weapon that is not in hand is still on your belt.
  source.state = source.equipped ? SW.ACTIVE_STATE[type] : (type === "armor" ? "carried" : "worn");
  delete source.equipped;
  return source;
}

/** Shared derived flags for anything you can carry. */
function prepareCarry(system, type) {
  system.held = system.state === "held";
  system.worn = system.state === "worn";
  system.stowed = system.state === "carried";
  /** Doing its job: armor Protects while worn, a weapon or shield works while held. */
  system.equipped = system.state === SW.ACTIVE_STATE[type];
  system.stateLabel = SW.CARRY_STATES[system.state]?.label ?? "";
  system.stateIcon = SW.CARRY_STATES[system.state]?.icon ?? "";
}

/* -------------------------------------------- */

/** The common ancestor, so `item.system.description` is always safe to read. */
export class SwItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return describedFields();
  }

  /** The chat-card summary a roll uses. */
  get chatDescription() {
    return this.description;
  }
}

/* -------------------------------------------- */
/*  Constellation                               */
/* -------------------------------------------- */

/**
 * A Constellation Item is the sky itself: its Key Attribute, its category, its art, and (for a
 * Combat Style) which parent it belongs to. The points and the rank live on the character,
 * derived from the Talents owned.
 */
export class SwConstellationData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      slug: new fields.StringField({ initial: "" }),
      category: new fields.StringField({
        required: true, choices: Object.keys(SW.CATEGORIES), initial: "skill"
      }),
      attribute: new fields.StringField({
        required: true, choices: Object.keys(SW.ATTRIBUTES), initial: "might"
      }),
      /**
       * The parent Constellation's slug (PHB v4.10): Melee or Ranged for a Combat Style, blank for
       * everything else. A child's Talents count toward the parent's rank; only rank is inherited.
       * Named `parentSlug` because `parent` on a data model is the owning Item, and read only.
       */
      parentSlug: new fields.StringField({ initial: "" }),
      meta: new fields.StringField({ initial: "" }),
      flareTrigger: new fields.StringField({ initial: "" }),
      /** Identity Constellations are granted by a character-creation choice, never bought. */
      identity: new fields.BooleanField({ initial: false })
    });
  }

  /** @inheritdoc Content built as `system.parent` is filed under `parentSlug`. */
  static migrateData(source) {
    if (source.parent !== undefined) {
      if (typeof source.parent === "string") source.parentSlug ??= source.parent;
      delete source.parent;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    if (!this.slug) this.slug = SW.slugify(this.parent.name);
    this.categoryLabel = SW.CATEGORIES[this.category]?.label ?? "";
    this.attributeGlyph = SW.ATTRIBUTES[this.attribute]?.glyph ?? "";
    this.parentName = this.parentSlug ? (SW.getConstellation(this.parentSlug)?.name ?? "") : "";
  }
}

/* -------------------------------------------- */
/*  Talent                                      */
/* -------------------------------------------- */

/** One Talent. Every Talent costs exactly 1 Talent Point, from the humblest to the most legendary. */
export class SwTalentData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      constellation: new fields.StringField({ initial: "" }),
      constellationName: new fields.StringField({ initial: "" }),
      tier: new fields.StringField({ required: true, choices: Object.keys(SW.TIERS), initial: "T" }),
      /** Buying the Root is what makes you Trained. Nothing else can be bought before it. */
      root: new fields.BooleanField({ initial: false }),
      /** A Bloodline root: granted by the chargen choice, never listed among buyable Talents. */
      bloodlineRoot: new fields.BooleanField({ initial: false }),
      capstone: new fields.BooleanField({ initial: false }),
      requires: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] }),
      prerequisites: new fields.StringField({ initial: "" }),
      /** A Talent may feed an Attribute other than its Constellation's Key Attribute. */
      attribute: new fields.StringField({ required: false, blank: true, initial: "" }),
      effect: new fields.HTMLField({ initial: "" }),
      /** Action cost, if this Talent is something you do rather than something you are. */
      ...costFields("passive"),
      /** A restricted Talent Point this Talent hands out. */
      grant: new fields.SchemaField({
        n: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        mode: new fields.StringField({ initial: "" }),
        scope: new fields.StringField({ initial: "" })
      }),
      /**
       * A build-time pick the Talent's effect demands, and what the player picked. Weapon
       * Familiarity is the case this exists for: without the answer recorded, the Talent has no
       * mechanical effect at all, because nothing knows which Weapon Group you are Familiar with.
       */
      choice: new fields.SchemaField({
        prompt: new fields.StringField({ initial: "" }),
        value: new fields.StringField({ initial: "" })
      }),
      /** Another Talent this one hands over outright, with no Talent Point spent. */
      freeTalent: new fields.StringField({ initial: "" }),
      /** The "within N feet" of the Effect, drawn on the map (0.5.1). */
      ...auraFields()
    });
  }

  /**
   * @inheritdoc
   * The v3.4 Weapons Constellation split into Melee and Ranged (PHB v4.10). A Talent still filed
   * under Weapons is filed under Melee, since that is where a weapon in hand rolls; a character
   * whose training was really Ranged moves the Talent by hand.
   */
  static migrateData(source) {
    migrateCost(source, "talent");
    if (source.constellation === SW.WEAPONS_SLUG) {
      source.constellation = SW.MELEE_SLUG;
      if (source.constellationName) source.constellationName = SW.getConstellation(SW.MELEE_SLUG).name;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    this.tierLabel = SW.TIERS[this.tier]?.label ?? "";
    this.requiredRank = SW.TIERS[this.tier]?.rank ?? "trained";
    prepareCost(this);
    // A Talent the book moved between Constellations follows it (Loose and Move, Archery to
    // Ranged in v4.10): the owned copy keeps its id and counts where the book now files it.
    const moved = SW.MOVED_TALENTS[SW.slugify(this.parent?.name ?? "")];
    if (moved && (this.constellation === moved.from)) {
      this.constellation = moved.to;
      this.constellationName = SW.getConstellation(moved.to).name;
    }
    /** A Talent that wants an answer and has not been given one is not doing anything yet. */
    this.needsChoice = !!this.choice.prompt && !this.choice.value;
    if (!this.constellation && this.constellationName) {
      this.constellation = SW.slugify(this.constellationName);
    }
    prepareAura(this);
  }

  get chatDescription() {
    return this.effect || this.description;
  }
}

/* -------------------------------------------- */
/*  Chassis                                     */
/* -------------------------------------------- */

/**
 * Ancestry, Bloodline, Culture, Background and Calling. These are the character-creation choices
 * that hand out roots and set the body: Vigor per level, Size, Speed, Senses.
 */
export class SwChassisData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      kind: new fields.StringField({
        required: true,
        choices: ["ancestry", "bloodline", "culture", "background", "calling"],
        initial: "ancestry"
      }),
      constellation: new fields.StringField({ initial: "" }),
      attribute: new fields.StringField({
        required: true, choices: Object.keys(SW.ATTRIBUTES), initial: "might"
      }),
      /** Vigor per level this choice adds (PHB v4.10: 10 + Ancestry + Calling at 1st, the sum again each level). */
      vigor: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      size: new fields.StringField({ required: true, choices: Object.keys(SW.SIZES), initial: "medium" }),
      /** Feet per Move. A Human's is 6. */
      speed: new fields.NumberField({ required: true, integer: true, min: 0, initial: SW.DEFAULT_SPEED }),
      senses: new fields.StringField({ initial: "" }),
      languages: new fields.StringField({ initial: "" }),
      /** The Skills or Constellations this choice grants Training in. */
      grants: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] }),
      specialAbility: new fields.HTMLField({ initial: "" })
    });
  }

  /**
   * @inheritdoc The v3.4 `hp` (per level) became `vigor`. Speed moved to the one-foot grid too,
   * but that conversion is the one-time world migration's (`migrateSpeed`, run from
   * `starwrought.mjs`), so a v4.10 Speed is stored as typed.
   */
  static migrateData(source) {
    if (source.hp !== undefined) {
      source.vigor ??= source.hp;
      delete source.hp;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    this.kindLabel = `STARWROUGHT.Chassis.${this.kind}`;
  }

  get chatDescription() {
    return this.specialAbility || this.description;
  }
}

/* -------------------------------------------- */
/*  Weapon                                      */
/* -------------------------------------------- */

/**
 * "A weapon gives you a damage die and a handful of Traits. It never touches your attack roll;
 * that comes from your Melee or Ranged Proficiency and your Strike Attribute."
 */
export class SwWeaponData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), physicalFields("worn"), {
      handling: new fields.StringField({
        required: true, choices: Object.keys(SW.HANDLING), initial: "intuitive"
      }),
      group: new fields.StringField({ initial: "" }),
      damage: new fields.SchemaField({
        die: new fields.NumberField({ required: true, integer: true, min: 2, initial: 6 }),
        type: new fields.StringField({
          required: true, choices: Object.keys(SW.DAMAGE_TYPES), initial: "bludgeoning"
        })
      }),
      /** Weapon Reach in feet. Total Reach is your Natural Reach plus this. */
      reach: new fields.NumberField({ required: true, integer: true, min: 0, initial: 2 }),
      /**
       * Which Combat Style you are wielding it in. It is load-bearing (PHB v4.10): if you own that
       * Style's root, its Key Attribute is eligible as your Strike Attribute with this weapon.
       */
      style: new fields.StringField({ initial: "" }),
      /** Held in two hands right now, which matters for the Two-Hand dX trait. */
      twoHands: new fields.BooleanField({ initial: false }),
      /** Using the Versatile trait's alternate damage type right now. */
      versatileActive: new fields.BooleanField({ initial: false })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateCarryState(source, "weapon"));
  }

  prepareDerivedData() {
    prepareCarry(this, "weapon");
    this.flags = parseWeaponTraits(this.traits);
    this.handlingLabel = SW.HANDLING[this.handling].label;
    this.isRanged = this.flags.ranged !== null;
    this.range = this.flags.ranged ?? this.flags.thrown ?? null;
    /** Melee for anything in your hand, Ranged for anything that leaves it. A throw is decided at the roll. */
    this.strikeSlug = this.isRanged ? SW.RANGED_SLUG : SW.MELEE_SLUG;

    // Two-Hand dX: wielded in two hands, its damage die becomes dX.
    this.effectiveDie = (this.twoHands && this.flags.twoHandDie) ? this.flags.twoHandDie : this.damage.die;
    this.effectiveType = (this.versatileActive && this.flags.versatile) ? this.flags.versatile : this.damage.type;

    // The weapon's natural Attribute: Agility for Ranged N and for Finesse, Might otherwise
    // (Thrown X uses Might). The Strike Attribute may still be a Combat Style's; see the actor.
    this.attackAttribute = this.isRanged ? "agility" : (this.flags.finesse ? "agility" : "might");
    this.addsMight = !this.flags.mechanical;

    // A rigid implement can Parry, form a Bind and take Control. A Flexible weapon cannot, and a
    // bare hand (the Natural Weapons group) cannot without a Talent (PHB v4.10, The Bind).
    this.natural = /natural\s+weapons?/i.test(this.group);
    this.rigid = !this.flags.flexible && !this.natural;
    this.totalTraits = this.traits.join(", ");
  }

  /**
   * The damage formula for one kind of blow (PHB v4.10, Strike damage). A Deliberate or Committed
   * Hit is all the dice plus specialization, Might (unless Mechanical), bonuses and precision. A
   * Quick Hit is one die plus precision. A Graze is one die and nothing else.
   */
  damageFormula({
    dice = 1, might = 0, specialization = 0, bonus = 0, precision = 0, graze = false, quick = false
  } = {}) {
    const die = `d${this.effectiveDie}`;
    if (graze) return die;
    if (quick) return precision ? `1${die} + ${precision}` : `1${die}`;
    const parts = [`${dice}${die}`];
    const flat = (this.addsMight ? might : 0) + specialization + bonus + precision;
    if (flat) parts.push(String(flat));
    return parts.join(" + ");
  }
}

/* -------------------------------------------- */
/*  Armor                                       */
/* -------------------------------------------- */

/**
 * "Armor is worn in four places. Each zone holds one piece, and each piece is bought, worn, and
 * lost separately."
 */
export class SwArmorData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), physicalFields("carried"), {
      zone: new fields.StringField({ required: true, choices: Object.keys(SW.ZONES), initial: "torso" }),
      protection: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      material: new fields.StringField({
        required: true, choices: Object.keys(SW.MATERIALS), initial: "padded"
      })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateCarryState(source, "armor"));
  }

  prepareDerivedData() {
    prepareCarry(this, "armor");
    this.zoneLabel = SW.ZONES[this.zone].label;
    this.materialLabel = SW.MATERIALS[this.material].label;
    this.weakTo = SW.MATERIALS[this.material].weakTo;
    this.comfort = this.traits.some(t => /comfort/i.test(t));
    this.noisy = this.traits.some(t => /noisy/i.test(t));
    this.quiet = this.traits.some(t => /quiet/i.test(t));
    /** Putting it on takes 1 minute per point of Protection. */
    this.donTime = this.protection;
    /**
     * Attended (ruling 82; Mike's "Yes to all", 2026-10-02): the piece fastens behind the shoulder,
     * beyond its wearer's own reach, so alone it takes twice as long to put on; with a second pair
     * of hands, and coming off, it takes the usual time. Display only: the equipment tab's time tag
     * prints both numbers and nothing else acts on it. The Breastplate alone carries the trait, and
     * the data runs one step ahead of the handbook on it until Mike accepts the redline.
     */
    this.attended = this.traits.some(t => /attended/i.test(t));
    this.donTimeAlone = this.attended ? 2 * this.donTime : this.donTime;
    /** A helm's cost in sight and hearing, by name (PHB v4.10): Closed helm -2, Open helm -1. */
    this.helmPenalty = (this.zone === "head") ? helmPenaltyFor(this.parent?.name) : 0;
  }
}

/* -------------------------------------------- */
/*  Shield                                      */
/* -------------------------------------------- */

/**
 * "A shield is not armor. It grants no Protection, because it does not cover a zone." Raised, it
 * gives its Gear bonus to Guard until your next Opportunity, and it is a rigid implement: you may
 * Parry, Bind and Gain Control with it.
 */
export class SwShieldData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), physicalFields("worn"), {
      bonus: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      hardness: new fields.NumberField({ required: true, integer: true, min: 0, initial: 3 }),
      /** A tower shield gives Cover rather than a Guard bonus. */
      cover: new fields.BooleanField({ initial: false }),
      raised: new fields.BooleanField({ initial: false })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateCarryState(source, "shield"));
  }

  prepareDerivedData() {
    prepareCarry(this, "shield");
    this.rigid = true;
  }
}

/* -------------------------------------------- */
/*  Gear                                        */
/* -------------------------------------------- */

/** Everything else you own. */
export class SwGearData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), physicalFields("carried"), {
      consumable: new fields.BooleanField({ initial: false }),
      uses: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateCarryState(source, "gear"));
  }

  prepareDerivedData() {
    prepareCarry(this, "gear");
  }
}

/* -------------------------------------------- */
/*  Action                                      */
/* -------------------------------------------- */

/**
 * A Maneuver or Activity: Move, Recenter, Seek, or an adversary's claw. When `attack.enabled`
 * is set this is something a creature does to a player character, so it carries an Attack
 * Threshold rather than an attack bonus, and the player rolls a Defense against it.
 */
export class SwActionData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), costFields("1"), {
      category: new fields.StringField({ initial: "" }),
      /** On every character's Maneuvers tab, whether or not the character owns a copy. */
      basic: new fields.BooleanField({ initial: false }),
      prerequisites: new fields.StringField({ initial: "" }),
      requirements: new fields.StringField({ initial: "" }),
      trigger: new fields.StringField({ initial: "" }),
      /** The rules text. `description` is the flavour line above it. */
      effect: new fields.HTMLField({ initial: "" }),
      /**
       * What the system should do when this action is used, as the author wrote it in the
       * Automation column of data/actions.xlsx. Prose for now: nothing reads it yet, and it is
       * shown on the Item sheet so the intent travels with the action until it is implemented.
       */
      automation: new fields.StringField({ initial: "" }),
      /** The "within N feet" of the Effect, drawn on the map (0.5.1). */
      ...auraFields(),
      /** Rolled as a check: which Constellation, and which Defense it is measured against. */
      check: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        constellation: new fields.StringField({ initial: "" }),
        defense: new fields.StringField({ initial: "" })
      }),
      /** An adversary's attack, expressed the way the players meet it. */
      attack: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        threshold: new fields.NumberField({ required: true, integer: true, initial: 10 }),
        damage: new fields.StringField({ initial: "1d6" }),
        damageType: new fields.StringField({
          required: true, choices: Object.keys(SW.DAMAGE_TYPES), initial: "bludgeoning"
        }),
        reach: new fields.NumberField({ required: true, integer: true, min: 0, initial: 2 }),
        armorPiercing: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      /** Degrees of success text, printed on the card. */
      outcomes: new fields.SchemaField({
        critSuccess: new fields.StringField({ initial: "" }),
        success: new fields.StringField({ initial: "" }),
        fail: new fields.StringField({ initial: "" }),
        critFail: new fields.StringField({ initial: "" })
      })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateCost(source, "action"));
  }

  prepareDerivedData() {
    prepareCost(this);
    /** A Maneuver of three or more actions is Prepared: one now, the rest at your next Opportunity. */
    this.prepared = this.costValue >= SW.PREPARED_THRESHOLD;
    prepareAura(this);
  }

  /** The rules, when the action has them written separately from its flavour. */
  get chatDescription() {
    return this.effect || this.description;
  }
}
