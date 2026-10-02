/**
 * Actor data models.
 *
 * The character model stores only what a player chooses. Everything a machine can work out is
 * derived: Attribute Points from the Talents you own, Proficiency Rank from your spend and your
 * level, Vigor from Ancestry and Calling, Protection from the armor on each Zone, and the effect
 * of every Wound from the count each Zone carries.
 *
 * PHB v4.10 in one paragraph, as this file knows it: a check is d20 + Attribute Bonus +
 * Proficiency Bonus + bonuses and penalties, and level never touches the die. Six actions a round,
 * paid for Maneuvers and Reactions alike, with a Prepared Maneuver holding a reserve. Vigor is
 * wind and luck; Wounds are the meat, per Zone, with a capacity set by Size. Melee and Ranged are
 * parents, and a Combat Style's Talents count toward its parent's rank.
 */

import * as SW from "../config.mjs";
import { helmPenaltyFor } from "./item.mjs";
import { rangesOf } from "../helpers/ranges.mjs";

/** Re-exported so the canvas can import the ranges list from the model that derives it (0.5.1). */
export { rangesOf } from "../helpers/ranges.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Local rules constants                       */
/* -------------------------------------------- */

/** The five stances a defender can hold: the two basic Defenses and the three Reactions that answer a Blow. */
export const STANCES = Object.freeze(["evade", "guard", "void", "parry", "counter"]);

/** The first Arms Wound (PHB v4.10, Wounds): -2 Situation to attacks and to Guard. */
const ARMS_WOUND_PENALTY = -2;

/* -------------------------------------------- */
/*  Field helpers                               */
/* -------------------------------------------- */

/** A damage-modifier row: `resistance 5 (fire)`. */
function damageModifierField(label) {
  return new fields.ArrayField(
    new fields.SchemaField({
      type: new fields.StringField({ required: true, blank: false, initial: "untyped" }),
      value: new fields.NumberField({ required: true, integer: true, initial: 0 })
    }),
    { label }
  );
}

/** The fields every Zone carries. Extra fields are merged in for adversaries. */
function zoneFields(extra = {}) {
  return new fields.SchemaField(Object.assign({
    exposed: new fields.BooleanField({ initial: false }),
    /** Exposed by a Posture: it lasts to the end of the round, and Recenter does not clear it. */
    postureExposed: new fields.BooleanField({ initial: false }),
    /** The Wounds this Zone carries. Its capacity is derived from Size (PHB v4.10, Wounds). */
    wounds: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
  }, extra));
}

/**
 * Six actions a round (PHB v4.10). `value` is what is left to spend this round; `reserved` is
 * held back by a Prepared Maneuver (one spent now, the rest waiting for the next Opportunity);
 * `preparing` describes that Maneuver, or is null: {kind: "strike"|"maneuver", label, weaponId,
 * targetTokenId, cost, strike}. There is no reaction slot: a Reaction is paid from the same six.
 */
function actionFields() {
  return new fields.SchemaField({
    value: new fields.NumberField({
      required: true, integer: true, min: 0, max: 12, initial: SW.ACTIONS_PER_ROUND
    }),
    reserved: new fields.NumberField({ required: true, integer: true, min: 0, max: 12, initial: 0 }),
    preparing: new fields.ObjectField({ required: true, nullable: true, initial: null })
  });
}

/**
 * The Bind (PHB v4.10, Position): one relationship per implement, neutral or Controlled. The
 * implement names are free text ("longsword", "shield", "bite"), since the partner's weapon may
 * not be an Item at all.
 */
function bindFields() {
  return new fields.SchemaField({
    state: new fields.StringField({
      required: true, blank: true, choices: ["", "neutral", "controlling", "controlled"], initial: ""
    }),
    partnerUuid: new fields.StringField({ initial: "" }),
    mine: new fields.StringField({ initial: "" }),
    theirs: new fields.StringField({ initial: "" }),
    /**
     * The Bind's identity, the same on both sides, kept in the emptied record after the Bind
     * ends: the tombstone the pair-keeper reads to tell "my partner ended this very Bind" from
     * "my partner's side was never written" (review, 2026-10-01).
     */
    id: new fields.StringField({ initial: "" })
  });
}

/** Fields shared by both Actor types, as a plain object so subclasses can compose freely. */
function commonActorFields() {
  return {
    level: new fields.NumberField({ required: true, integer: true, min: 0, max: 30, initial: 1 }),
    dying: new fields.NumberField({ required: true, integer: true, min: 0, max: SW.DYING_MAX, initial: 0 }),
    size: new fields.StringField({ required: true, choices: Object.keys(SW.SIZES), initial: "medium" }),
    /**
     * How the next Blow is answered. "The defender decides", so the decision is stored on the
     * defender and read by the attacker's roll at the moment the die is cast. Evade and Guard are
     * the basic Defenses; Void, Parry and Counter are Reactions that cost an action when an attack
     * lands and are only offered when the Talent that grants them is owned (and, for Counter, the
     * rank it needs is reached; see `reactions`).
     */
    stance: new fields.StringField({ required: true, choices: STANCES, initial: "evade" }),
    actions: actionFields(),
    bind: bindFields(),
    /**
     * Auras (0.5.1). `visible` holds the Visible marks, key to boolean: the Item id of a Talent or
     * Maneuver that carries an aura, `reach`, `totalReach` or `unwieldy` for the reach bands, or
     * a custom ring's key. A key absent from the map means the data default: the Item's own
     * `aura.visible`, false for a band, true for a custom ring. Stored on the actor rather than
     * the token so a new token inherits it (Mike). `custom` is the rings drawn by hand on the token
     * HUD; `gmOnly` keeps one from the players for good. The derived list that reads all of this
     * is `system.ranges`; see helpers/ranges.mjs.
     */
    auras: new fields.SchemaField({
      visible: new fields.ObjectField({ initial: {} }),
      custom: new fields.ArrayField(new fields.SchemaField({
        key: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
        label: new fields.StringField({ initial: "" }),
        feet: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        audience: new fields.StringField({
          required: true, choices: Object.keys(SW.AURA_AUDIENCES), initial: "all"
        }),
        /** "#rrggbb"; blank takes the audience's colour. */
        color: new fields.StringField({
          required: true, blank: true, initial: "",
          validate: value => (value === "") || /^#[0-9a-f]{6}$/i.test(value),
          validationError: "must be a #rrggbb colour, or blank for the audience's colour"
        }),
        gmOnly: new fields.BooleanField({ initial: false })
      }), { initial: [] })
    }),
    traits: new fields.SchemaField({
      resistances: damageModifierField("STARWROUGHT.Field.resistances"),
      weaknesses: damageModifierField("STARWROUGHT.Field.weaknesses"),
      immunities: new fields.SetField(new fields.StringField({ blank: false }))
    })
  };
}

/* -------------------------------------------- */
/*  Migration                                   */
/* -------------------------------------------- */

/**
 * v3.4 to v4.10, for both Actor types. The `hp` block became `vigor`; the numeric `wounded` value
 * is retired (Wounds are per Zone now, and an old count has no Zone to go to); the reaction slot
 * dissolved into the six actions; the Ancestry's and Calling's per-level `hp` became `vigor`.
 * Anything already present under the new name wins, so a half-migrated document is not undone.
 */
function migrateActorSource(source) {
  if (source.hp !== undefined) {
    source.vigor ??= {};
    for (const key of ["value", "max", "temp"]) {
      if ((source.hp?.[key] !== undefined) && (source.vigor[key] === undefined)) source.vigor[key] = source.hp[key];
    }
    delete source.hp;
  }
  delete source.wounded;
  // A v3.x actor carried a reaction slot and three actions a turn. The slot goes, and the count
  // starts the new economy full: six a round, the way every round begins.
  if (source.actions?.reaction !== undefined) {
    delete source.actions.reaction;
    source.actions.value = SW.ACTIONS_PER_ROUND;
    source.actions.reserved ??= 0;
    source.actions.preparing ??= null;
  }
  for (const part of ["ancestry", "calling"]) {
    const block = source.details?.[part];
    if (block?.hp !== undefined) {
      block.vigor ??= block.hp;
      delete block.hp;
    }
  }
  if (source.bonuses?.hp !== undefined) {
    source.bonuses.vigor ??= source.bonuses.hp;
    delete source.bonuses.hp;
  }
  // Speed is not converted here. migrateData runs on every construction and every update, so a
  // "15 or more is five-foot scale" rule would quarter a v4.10 Speed of 15 for ever; the one-time
  // conversion of a v3.x Speed is the world migration in starwrought.mjs.
  return source;
}

/* -------------------------------------------- */
/*  Base                                        */
/* -------------------------------------------- */

/** Behaviour shared by every kind of Actor: Zones, Protection, Wounds, movement, damage modifiers. */
export class SwActorData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static migrateData(source) {
    return super.migrateData(migrateActorSource(source));
  }

  /** Are we in the ground yet. */
  get isDying() {
    return this.dying > 0;
  }

  /** The Zones currently Exposed. */
  get exposedZones() {
    return Object.entries(this.zones).filter(([, z]) => z.exposed).map(([k]) => k);
  }

  /* -------------------------------------------- */

  /**
   * Protection on one Zone against one damage type, worked down the handbook's list (PHB v4.10,
   * Finding a Zone's Protection).
   * @param {string} zone                 A key of SW.ZONES.
   * @param {object} [options]
   * @param {string|null} [options.type]    The incoming damage type, for the material step.
   * @param {number} [options.ignore]       Protection the attacker ignores (Armor-Piercing).
   * @param {string|null} [options.strike]  The kind of Strike (a key of SW.STRIKE_KINDS). An Exposed
   *   Zone's Protection is 0 only against a Deliberate or Committed Strike; a Quick Strike meets it
   *   in full. Omitted, the default Strike is assumed; null means the damage is not a Strike at all
   *   (a Blast, a fall), and Exposure does nothing for it.
   * @returns {{value: number, steps: Array<{label: string, value: number}>}}
   */
  zoneProtection(zone, { type = null, ignore = 0, strike = SW.DEFAULT_STRIKE } = {}) {
    const steps = [];
    const z = this.zones?.[zone];
    const kind = strike === null ? null : (SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE]);

    // 1. If the Zone is Exposed and the Strike is Deliberate or Committed, its Protection is 0.
    if (z?.exposed && kind?.ignoresExposedProtection) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Protection.exposed"), value: 0 });
      return { value: 0, steps };
    }

    // 2. Start with the Protection of the piece worn there. No piece worn means 0. `armor` is the
    //    raw number either way (a character's `protection` already carries the Zone bonus for
    //    the sheet), so step 3 adds that bonus exactly once.
    const piece = this.armorOnZone(zone);
    let total = piece ? (piece.system.protection ?? 0) : (z?.armor ?? 0);
    steps.push({
      label: piece?.name ?? game.i18n.localize("STARWROUGHT.Protection.armor"),
      value: total
    });

    // 3. Add any bonus that applies to that Zone.
    const bonus = (z?.bonus ?? 0)
      + (this.matchedHarness && zone === "torso" ? 1 : 0)
      + (this.bonuses?.protection ?? 0);
    if (bonus) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Protection.bonus"), value: bonus });
      total += bonus;
    }

    // 4. Subtract 1 if the incoming damage type is the one that material turns poorly.
    const materialKey = piece?.system.material ?? z?.material ?? "none";
    const material = SW.MATERIALS[materialKey];
    if (type && material?.weakTo === type) {
      steps.push({
        label: game.i18n.format("STARWROUGHT.Protection.material", {
          material: game.i18n.localize(material.label)
        }),
        value: -1
      });
      total -= 1;
    }

    // 5. Subtract any Protection the attacker ignores.
    if (ignore) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Protection.ignored"), value: -ignore });
      total -= ignore;
    }

    return { value: Math.max(0, total), steps };
  }

  /** Which armor Item covers a Zone. Adversaries wear none; the Zone's number is the story. */
  armorOnZone(_zone) {
    return null;
  }

  /* -------------------------------------------- */
  /*  Wounds                                      */
  /* -------------------------------------------- */

  /**
   * How many Wounds a Zone carries before its final effect: Medium or smaller 2, Large 3, Huge 4,
   * Gargantuan 5, plus anything a creature template adds (PHB v4.10, Wound capacity). Every Zone
   * of a body has the same capacity, so the argument is there for the day a rule says otherwise.
   * @param {string} [_zone]
   * @returns {number}
   */
  woundCapacity(_zone) {
    return (SW.WOUND_CAPACITY[this.size] ?? SW.WOUND_CAPACITY.medium) + (this.woundBonus ?? 0);
  }

  /**
   * Per-Zone Wound state. A Zone with Wounds is Wounded; the Wound that fills its capacity is the
   * final one and carries the final effect; every Wound before it repeats the first effect. The
   * Torso's and Head's final Wound is Dying; a useless Arm or Leg takes no further Wounds (they go
   * to the Torso). Sets `woundCount`, the total the Recovery and Treat Wound Thresholds add.
   */
  _prepareWounds() {
    let count = 0;
    for (const zone of Object.keys(SW.ZONES)) {
      const z = this.zones[zone];
      const rules = SW.ZONE_CRITICALS[zone];
      z.capacity = this.woundCapacity(zone);
      z.wounded = z.wounds > 0;
      z.final = z.wounds >= z.capacity;
      z.woundEffect = !z.wounded ? null : (z.final ? rules.final : rules.first);
      z.useless = z.final && !rules.finalDying;
      z.dyingWound = z.final && rules.finalDying;
      count += z.wounds;
    }
    this.woundCount = count;
  }

  /* -------------------------------------------- */
  /*  Movement                                    */
  /* -------------------------------------------- */

  /**
   * Speed in feet per Move, and what it buys (PHB v4.10, Grid Size and Speed; Load and Load
   * Strain). Each Legs Wound short of the last halves what Speed is left ("a second Legs Wound
   * halves what Speed it had left"); the final Legs Wound is Prone and cannot Stand, so 0. A Step
   * is half Speed, a Rush five times Speed less Load Strain, a Leap 10 feet less Load Strain.
   * @param {number} base        Speed before Wounds.
   * @param {number} loadStrain  The wearer's Load Strain.
   */
  _prepareMovement(base, loadStrain = 0) {
    let speed = Math.max(0, base);
    const legs = this.zones.legs;
    this.cannotStand = false;
    if (legs.final) {
      speed = 0;
      this.cannotStand = true;
    } else {
      for (let i = 0; i < legs.wounds; i++) speed = Math.floor(speed / 2);
    }
    this.moveSpeed = speed;
    this.step = Math.floor(speed / SW.STEP_DIVISOR);
    this.rush = Math.max(0, (speed * SW.RUSH_MULTIPLIER) - loadStrain);
    this.leap = Math.max(0, SW.LEAP_FEET - loadStrain);
    this.crawl = SW.CRAWL_FEET;
    // Speed ÷ 2 for the hour, rounded down (PHB v4.10, Math Conventions): an odd Speed never
    // prints a half mile.
    this.travel = {
      feetPerMinute: speed * SW.TRAVEL.feetPerMinute,
      milesPerHour: Math.floor(speed * SW.TRAVEL.milesPerHour),
      milesPerDay: speed * SW.TRAVEL.milesPerDay
    };
  }

  /* -------------------------------------------- */

  /** Total Weakness against one damage type. Same-type weaknesses do not stack. */
  weaknessTo(type) {
    return (this.traits.weaknesses ?? []).filter(w => w.type === type)
      .reduce((n, w) => Math.max(n, w.value), 0);
  }

  /** Total Resistance against one damage type. */
  resistanceTo(type) {
    return (this.traits.resistances ?? []).filter(r => r.type === type)
      .reduce((n, r) => Math.max(n, r.value), 0);
  }

  /** Is this creature Immune to the named damage type or effect. */
  isImmuneTo(type) {
    return this.traits.immunities?.has(type) ?? false;
  }
}

/* -------------------------------------------- */
/*  Character                                   */
/* -------------------------------------------- */

export class SwCharacterData extends SwActorData {
  static defineSchema() {
    return Object.assign(commonActorFields(), {
      /**
       * Vigor: wind, focus and luck (PHB v4.10). Damage comes out of it first and it returns with
       * rest. At 0 you are Spent, not down: every Hit then Wounds the Zone it strikes. Temporary
       * Vigor is one pool laid over it, spent first, never healing.
       */
      vigor: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        temp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      heroPoints: new fields.SchemaField({
        value: new fields.NumberField({
          required: true, integer: true, min: 0, max: SW.HERO_POINTS_MAX, initial: 1
        })
      }),

      milestone: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),

      zones: new fields.SchemaField(
        Object.keys(SW.ZONES).reduce((obj, z) => {
          obj[z] = zoneFields();
          return obj;
        }, {})
      ),

      details: new fields.SchemaField({
        ancestry: new fields.SchemaField({
          name: new fields.StringField({ initial: "" }),
          /** Vigor per level from your Ancestry. */
          vigor: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          /** Feet per Move. A Human's is 6. */
          speed: new fields.NumberField({ required: true, integer: true, min: 0, initial: SW.DEFAULT_SPEED }),
          senses: new fields.StringField({ initial: "" })
        }),
        bloodline: new fields.SchemaField({
          name: new fields.StringField({ initial: "" })
        }),
        culture: new fields.SchemaField({
          name: new fields.StringField({ initial: "" })
        }),
        background: new fields.SchemaField({
          name: new fields.StringField({ initial: "" })
        }),
        calling: new fields.SchemaField({
          name: new fields.StringField({ initial: "" }),
          /**
           * Opening Vigor from your first Calling (PHB v4.11): added once, at 1st level. Only the
           * first counts, however many you open. Until v4.11 this was a per-level number; the
           * 0.6.0 world migration brings a stored table value across.
           */
          vigor: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
        }),
        languages: new fields.StringField({ initial: "" }),
        biography: new fields.HTMLField({ initial: "" }),
        notes: new fields.HTMLField({ initial: "" })
      }),

      /** Weapon Groups and Technical weapons this character is Familiar with. */
      familiarity: new fields.SetField(new fields.StringField({ blank: false })),

      /** Which Constellations are currently Flared, keyed by slug. A flag, not a counter. */
      flares: new fields.ObjectField({ initial: {} }),

      /** Manual adjustments, for anything the system cannot see for itself. All untyped. */
      bonuses: new fields.SchemaField({
        attack: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damage: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        checks: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        initiative: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        speed: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        vigor: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        protection: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        defenses: new fields.SchemaField(
          Object.keys(SW.DEFENSES).reduce((obj, d) => {
            obj[d] = new fields.NumberField({ required: true, integer: true, initial: 0 });
            return obj;
          }, {})
        )
      }),

      currency: new fields.SchemaField({
        gp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        sp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        cp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      })
    });
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    // Scaffolding the derived pass fills in, declared here so an Active Effect pointed at one of
    // these paths finds a number rather than undefined.
    this.attributes = {};
    for (const key of Object.keys(SW.ATTRIBUTES)) this.attributes[key] = { points: 0, mod: 0 };
    this.constellations = {};
    this.originPoints = 0;
    this.defenses = {};
    this.worn = { head: null, torso: null, arms: null, legs: null };
    this.shield = null;
    this.helmPenalty = 0;
    this.vigor.max = 0;
    this.spent = false;
    this.loadStrain = 0;
    this.wind = { threshold: 10, endureThreshold: 10, exempt: true, due: false };
    this.matchedHarness = false;
    this.clatter = false;
    this.speed = this.details.ancestry.speed;
    this.moveSpeed = this.speed;
    this.step = 0;
    this.rush = 0;
    this.leap = 0;
    this.woundCount = 0;
    this.weaponDice = 1;
    this.melee = { rank: "untrained", proficiency: 0, specialization: 0 };
    this.ranged = { rank: "untrained", proficiency: 0, specialization: 0 };
    this.reactions = { parry: false, void: false, counter: false, intercept: false, rigid: false, blocked: null };
    this.attackModifiers = [];
    this.ranges = [];
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.#prepareConstellations();
    this.#prepareAttributes();
    this.#prepareArmor();
    this._prepareWounds();
    this.#prepareDefenses();
    // Wind needs both Load Strain (#prepareArmor) and the Endure Threshold (#prepareDefenses) final.
    this.#prepareWind();
    this.#prepareVigor();
    this.#prepareOffense();
    // Every ring the map can draw (0.5.1): the reach bands derived just above and the auras of
    // the Talents owned. Last, because Total Reach and Unwieldy are read from the offense pass.
    this.ranges = rangesOf(this.parent);
  }

  /* -------------------------------------------- */

  /**
   * Roll the Talents this character owns up into Constellations. Every Talent costs 1 point, so a
   * Constellation's spend is simply the number of its Talents you own, the Root included.
   *
   * Parents (PHB v4.10): Melee and Ranged are parents, and every Combat Style is a child of one
   * of them. A child's Talents count toward the parent's rank as well as the child's, so a
   * parent's pool is its own points plus its children's. Only rank is inherited: the parent's own
   * Talents must still be bought for their effects, and an Attribute Point is counted once, at
   * the Talent's own feed (see #prepareAttributes).
   *
   * Root first governs the inheritance (ruling, v4.10 sync): the children's points count only
   * once the parent's own Root is owned. Read literally, "every Talent you buy in a child counts
   * toward the parent's rank" would make Archery alone Trained in Ranged, against "buying the
   * Root is what makes you Trained". Without the Root the parent is Untrained whatever the Combat
   * Styles hold; `inherited` is exposed either way so the sheet can say what is waiting.
   */
  #prepareConstellations() {
    const level = this.level;
    const entries = {};

    const ensure = slug => {
      if (entries[slug]) return entries[slug];
      const meta = SW.getConstellation(slug);
      return (entries[slug] = {
        slug,
        name: meta.name,
        category: meta.category,
        attribute: meta.attribute,
        parent: meta.parent ?? "",
        img: meta.img ?? null,
        item: null,
        points: 0,
        inherited: 0,
        children: [],
        talents: [],
        flared: !!this.flares?.[slug]
      });
    };

    // Constellation Items the character has opened carry the authoritative metadata.
    for (const item of this.parent.items) {
      if (item.type !== "constellation") continue;
      const slug = item.system.slug || SW.slugify(item.name);
      // v3.4's Weapons Constellation is Melee in PHB v4.10. Its Talents are refiled by the Talent
      // model; a stale Weapons Item left on the character is ignored rather than drawn as an
      // empty sky, and the next Melee Talent opens a proper Melee Item.
      if (slug === SW.WEAPONS_SLUG) continue;
      const entry = ensure(slug);
      entry.item = item;
      entry.name = item.name;
      entry.category = item.system.category || entry.category;
      entry.attribute = item.system.attribute || entry.attribute;
      entry.parent = item.system.parentSlug || entry.parent;
      entry.img = item.img ?? entry.img;
    }

    // Talents contribute the points.
    for (const item of this.parent.items) {
      if (item.type !== "talent") continue;
      const slug = item.system.constellation;
      if (!slug) continue;
      const entry = ensure(slug);
      entry.points += 1;
      entry.talents.push(item);
    }

    // A Constellation needn't be open to Flare: an untrained critical lights ground you have
    // never bought into, and the Milestone point that follows can buy its Root. So a Flare is
    // reason enough to draw the sky on the sheet.
    for (const slug of Object.keys(this.flares ?? {})) ensure(slug);

    // A child's points flow up to its parent. The parent is drawn even before its own Root is
    // bought, so the sheet can show what its Combat Styles are holding for it; the points only
    // count toward its rank once the Root is owned (below).
    for (const entry of Object.values(entries)) {
      if (!entry.parent || !entry.points) continue;
      const parent = ensure(entry.parent);
      parent.inherited += entry.points;
      parent.children.push(entry.slug);
    }

    // Owning a Constellation's Root: the Root Talent itself, or the Constellation Item with any
    // Talent bought in it (an older character whose Root was not flagged).
    const ownsRoot = entry => entry.talents.some(t => t.system.root)
      || (!!entry.item && entry.points > 0);

    // The Origin Constellation has three Roots. Ancestry, Bloodline and Culture are authored as
    // separate skies, but they merge into one: rank counts all the points across its sources.
    this.originPoints = Object.values(entries)
      .filter(e => e.category === "origin")
      .reduce((n, e) => n + e.points, 0);

    // Rank, Proficiency Bonus, and what the next rank is still waiting on.
    for (const entry of Object.values(entries)) {
      entry.rootOwned = ownsRoot(entry);
      const pool = entry.category === "origin"
        ? this.originPoints
        : entry.points + (entry.rootOwned ? entry.inherited : 0);
      entry.pool = pool;
      entry.isParent = entry.children.length > 0
        || Object.values(SW.constellations).some(c => c.parent === entry.slug);
      entry.rank = SW.rankFor(pool, level);
      entry.bonus = SW.rankBonus(entry.rank);
      entry.rankLabel = SW.RANKS[entry.rank].label;
      const nextKey = SW.RANK_ORDER[SW.RANK_ORDER.indexOf(entry.rank) + 1];
      entry.next = nextKey ? {
        rank: nextKey,
        label: SW.RANKS[nextKey].label,
        points: Math.max(0, SW.RANKS[nextKey].points - pool),
        level: Math.max(0, SW.RANKS[nextKey].level - level)
      } : null;
      // Every Lore files under Lore, whatever the compendium says its category is.
      if (SW.isLoreSlug(entry.slug)) entry.category = "lore";
      entry.categoryLabel = SW.CATEGORIES[entry.category]?.label ?? SW.CATEGORIES.general.label;
      entry.order = SW.CATEGORIES[entry.category]?.order ?? 9;
      entry.talents.sort((a, b) =>
        ((SW.TIERS[a.system.tier]?.order ?? 9) - (SW.TIERS[b.system.tier]?.order ?? 9))
        || a.name.localeCompare(b.name));
    }

    this.constellations = entries;
  }

  /* -------------------------------------------- */

  /**
   * Attribute Points are counted per Talent bought: each point flows to that Talent's feed,
   * defaulting to its Constellation's Key Attribute. Attribute Bonus = points divided by 4,
   * rounded down (PHB v4.10), through SW.attributeBonus. A child Constellation's Talent feeds its
   * own Attribute once; the parent inherits rank, never points.
   */
  #prepareAttributes() {
    for (const item of this.parent.items) {
      if (item.type !== "talent") continue;
      const feed = item.system.attribute
        || this.constellations[item.system.constellation]?.attribute
        || SW.getConstellation(item.system.constellation)?.attribute;
      if (feed && this.attributes[feed]) this.attributes[feed].points += 1;
    }
    for (const [key, attr] of Object.entries(this.attributes)) {
      attr.mod = SW.attributeBonus(attr.points);
      attr.label = SW.ATTRIBUTES[key].label;
      attr.abbr = SW.ATTRIBUTES[key].abbr;
      attr.glyph = SW.ATTRIBUTES[key].glyph;
      attr.next = (attr.mod >= SW.ATTRIBUTE_MAX)
        ? null
        : ((attr.mod + 1) * SW.ATTRIBUTE_DIVISOR) - attr.points;
    }
  }

  /* -------------------------------------------- */

  /** Armor: which piece sits on which Zone, matched harness, Clatter, Load Strain, the helm. */
  #prepareArmor() {
    for (const item of this.parent.items) {
      if (!item.system.equipped) continue;
      if (item.type === "armor") {
        const zone = item.system.zone;
        if (zone in this.worn && !this.worn[zone]) this.worn[zone] = item;
      } else if (item.type === "shield" && !this.shield) {
        this.shield = item;
      }
    }

    const pieces = Object.values(this.worn).filter(Boolean);

    // Matched harness: all four pieces the same Material and Protection.
    this.matchedHarness = pieces.length === 4
      && pieces.every(p => p.system.material === pieces[0].system.material
        && p.system.protection === pieces[0].system.protection);

    // Clatter: two or more mail or plate pieces while the torso is neither.
    const rigid = pieces.filter(p => ["mail", "plate"].includes(p.system.material)).length;
    const torsoRigid = ["mail", "plate"].includes(this.worn.torso?.system.material);
    this.clatter = (rigid >= 2) && !torsoRigid;
    this.noisy = this.clatter || pieces.some(p => p.system.traits?.includes?.("Noisy"));

    // Load Strain, relieved by your Endure rank once you own Endure Training: 1 at Trained, 2 at
    // Expert, 3 at Master, 4 at Legendary (PHB v4.11), to a minimum of 0.
    let load = pieces.reduce((n, p) => n + (p.system.load ?? 0), 0);
    load += this.shield?.system.load ?? 0;
    if (this.matchedHarness) load -= 1;
    const endure = this.constellations[SW.DEFENSES.endure.slug];
    if (endure?.points > 0) load -= SW.LOAD_RELIEF[endure.rank] ?? 0;
    this.loadStrain = Math.max(0, load);

    // Sight and hearing (PHB v4.10, Load and Load Strain): a Closed helm is -2 Situation to
    // Awareness checks, the Awareness Threshold and Initiative; an Open helm -1. Matched by the
    // Head piece's name, since the book has no trait for it.
    this.helmPenalty = helmPenaltyFor(this.worn.head?.name);

    // The Protection number each Zone shows, computed with no damage type in hand. `protection`
    // is what the armor gives (and what a Quick Strike meets whatever the Zone's state);
    // `effective` is what a Deliberate or Committed Strike meets, which is 0 on an Exposed Zone.
    for (const zone of Object.keys(SW.ZONES)) {
      const piece = this.worn[zone];
      const z = this.zones[zone];
      const bonus = (z.bonus ?? 0)
        + (this.matchedHarness && zone === "torso" ? 1 : 0)
        + this.bonuses.protection;
      // The piece's own number, before any bonus: what zoneProtection starts from.
      z.armor = piece?.system.protection ?? 0;
      z.protection = Math.max(0, (piece?.system.protection ?? 0) + bonus);
      z.effective = z.exposed ? 0 : z.protection;
      z.piece = piece;
      z.material = piece?.system.material ?? "none";
      z.materialLabel = SW.MATERIALS[z.material].label;
      z.weakTo = SW.MATERIALS[z.material].weakTo;
      z.label = SW.ZONES[zone].label;
      z.key = zone;
    }
  }

  /** @override */
  armorOnZone(zone) {
    return this.worn?.[zone] ?? null;
  }

  /* -------------------------------------------- */

  /**
   * The four Defenses. Each is a Constellation, so each is Attribute Bonus + Proficiency Bonus +
   * bonuses and penalties, with no level term (PHB v4.10, Checks & Thresholds). A Threshold is
   * that check with a 10 in place of the die.
   *
   * Folded in: Size (Evade and Guard, physical Attacks), Off-Guard, Frightened N, Fatigued N
   * (Evade and Guard), the helm on Awareness, a Parry weapon's Gear bonus and a raised shield's
   * Gear bonus on Guard (same type, so the better one stands), the first Arms Wound on Guard, and
   * the first Torso Wound as Off-Guard. Load Strain never touches Evade (PHB v4.11: "It never
   * comes off your Evade"; it came off until 0.6.0).
   */
  #prepareDefenses() {
    const statuses = this.parent.statuses ?? new Set();
    const offGuard = statuses.has("offGuard") ? SW.OFF_GUARD_PENALTY : 0;
    const frightened = -(this.parent.conditionValue("frightened") ?? 0);
    // Fatigued N (PHB v4.11, Wind): -N Condition to Evade and Guard, and to attack rolls below.
    const fatigued = -(this.parent.conditionValue("fatigued") ?? 0);
    const sizeMods = SW.SIZES[this.size] ?? SW.SIZES.medium;

    // A Parry weapon in hand (PHB v4.10 weapon traits): +1 Gear to Guard against melee Attacks.
    const parryWeapon = this.parent.items.find(i => (i.type === "weapon") && i.system.held && i.system.flags?.parry) ?? null;
    // A raised shield: its Gear bonus to Guard for physical Attacks until your next Opportunity.
    // A tower shield gives Cover instead of a number.
    const shield = (this.shield?.system.raised && !this.shield.system.cover) ? this.shield : null;

    const woundLabel = zone => game.i18n.format("STARWROUGHT.Wound.woundedZone", {
      zone: game.i18n.localize(SW.ZONES[zone].label)
    });

    for (const [key, def] of Object.entries(SW.DEFENSES)) {
      const con = this.constellations[def.slug];
      const rank = con?.rank ?? "untrained";
      const attribute = con?.attribute ?? def.attribute;
      const physical = (key === "evade") || (key === "guard");
      const modifiers = [
        { label: game.i18n.localize(SW.ATTRIBUTES[attribute].label), value: this.attributes[attribute].mod },
        { label: game.i18n.localize(SW.RANKS[rank].label), value: SW.rankBonus(rank) },
        { label: game.i18n.localize("STARWROUGHT.Field.customBonus"), value: this.bonuses.defenses[key] }
      ];
      if (physical && offGuard) {
        modifiers.push({
          label: game.i18n.localize("STARWROUGHT.Condition.offGuard"),
          value: offGuard, type: "situation"
        });
      }
      // The first Torso Wound is Off-Guard made lasting.
      if (physical && this.zones.torso.wounded) {
        modifiers.push({ label: woundLabel("torso"), value: SW.OFF_GUARD_PENALTY, type: "situation" });
      }
      if (physical && fatigued) {
        modifiers.push({
          label: game.i18n.localize("STARWROUGHT.Condition.fatigued"),
          value: fatigued, type: "condition"
        });
      }
      if (frightened) {
        modifiers.push({
          label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
          value: frightened, type: "condition"
        });
      }
      if (key === "guard") {
        if (this.zones.arms.wounded) {
          modifiers.push({ label: woundLabel("arms"), value: ARMS_WOUND_PENALTY, type: "situation" });
        }
        if (parryWeapon) {
          modifiers.push({
            label: game.i18n.format("STARWROUGHT.Defense.parryWeapon", { weapon: parryWeapon.name }),
            value: SW.PARRY_GUARD_BONUS, type: "gear"
          });
        }
        if (shield) {
          modifiers.push({
            label: game.i18n.format("STARWROUGHT.Defense.raisedShield", { shield: shield.name }),
            value: shield.system.bonus ?? 0, type: "gear"
          });
        }
      }
      if (key === "awareness" && this.helmPenalty) {
        modifiers.push({
          label: game.i18n.format("STARWROUGHT.Defense.helmPenalty", { piece: this.worn.head.name }),
          value: this.helmPenalty, type: "situation"
        });
      }

      // Size touches only Evade and Guard, and only against physical Attacks.
      const sizeMod = key === "evade" ? sizeMods.evade : key === "guard" ? sizeMods.guard : 0;
      const { total, applied } = SW.resolveModifiers(modifiers);

      this.defenses[key] = {
        key,
        slug: def.slug,
        label: def.label,
        hint: def.hint,
        attribute,
        attributeGlyph: SW.ATTRIBUTES[attribute].glyph,
        rank,
        rankLabel: SW.RANKS[rank].label,
        proficiency: SW.rankBonus(rank),
        trained: rank !== "untrained",
        points: con?.points ?? 0,
        mod: total,
        sizeMod,
        threshold: 10 + total + sizeMod,
        modifiers: applied,
        isStance: false,
        unavailable: null
      };
    }
    // "Evade is unavailable while you are Grabbed or Restrained. You cannot slip what is already
    // holding you." Guard's own exceptions (unaware of the attack, or nothing in hand and no hand
    // free) are not things the sheet can see, so they stay with the table. Recorded, not enforced.
    this.defenses.evade.unavailable = unavailableEvade(statuses);
    this.#prepareStance();
  }

  /* -------------------------------------------- */

  /**
   * The stance, read as a Defense plus an optional Reaction. Void answers with Evade, Parry with
   * Guard; Counter has no Defense of its own and is taken here as Guard (you meet the blow to
   * answer it). `stanceThreshold` is the basic Threshold; the Reaction's +2 Situation and its
   * action cost are applied by the roll that resolves the attack, so they are exposed as
   * `stanceBonus` and `stanceReaction` rather than folded in.
   */
  #prepareStance() {
    const reaction = SW.REACTIONS[this.stance] ? this.stance : null;
    // Counter has no Defense of its own: it stands on the better of the two basic Defenses that
    // are available (ruling 43), which is what the attacker's roll meets.
    const better = () => {
      const evade = this.defenses.evade?.unavailable ? -Infinity : (this.defenses.evade?.threshold ?? 10);
      const guard = this.defenses.guard?.unavailable ? -Infinity : (this.defenses.guard?.threshold ?? 10);
      return guard >= evade ? "guard" : "evade";
    };
    const defense = SW.REACTIONS[this.stance]?.defense
      ?? (this.stance === "counter" ? better() : this.stance);
    this.stanceReaction = reaction;
    this.stanceDefense = SW.DEFENSES[defense] ? defense : "evade";
    this.stanceBonus = reaction ? (SW.REACTIONS[reaction].bonus ?? 0) : 0;
    if (this.defenses[this.stanceDefense]) this.defenses[this.stanceDefense].isStance = true;
    this.stanceThreshold = this.defenses[this.stanceDefense]?.threshold ?? 10;
  }

  /* -------------------------------------------- */

  /**
   * Wind (PHB v4.13, Load and Load Strain; rulings 74, 79 and 80): "If your Load Strain is at
   * least 1 and your Endure Threshold is less than 10 + your Load Strain, then at the end of every
   * round while in an encounter, you must roll Endure against 10 + Load Strain. On a failure your
   * Fatigued rises by 1." So the Wind Threshold is 10 + Load Strain, and a fighter whose Endure
   * Threshold meets it is exempt: no check at all, however long the fight runs. The Endure
   * Threshold is the one the sheet shows, with everything the Defense pass folds in (Frightened
   * reaches it; Fatigued does not, so being winded never brings the next check nearer).
   *
   * Derived after Load Strain (#prepareArmor) and the Defenses (#prepareDefenses); that order
   * matters. `due` is whether the round-end check comes at all: Load Strain 1 or more, and no
   * exemption. A fighter carrying no Load has nothing to be winded by, whatever penalties sit on
   * their Endure; the system has kept that gate since 0.6.0 and v4.13 wrote it into the book
   * (ruling 80). The check comes from the end of round 1 (ruling 79; v4.11 and v4.12 waited for
   * the third round). `combat.mjs` reads `exempt` at the end of the round and the sheet's Load
   * Strain tooltip reads all of it (actor-sheet.mjs, windTip).
   */
  #prepareWind() {
    const threshold = 10 + this.loadStrain;
    const endureThreshold = this.defenses.endure?.threshold ?? 10;
    const exempt = endureThreshold >= threshold;
    this.wind = {
      threshold,
      endureThreshold,
      exempt,
      due: (this.loadStrain >= 1) && !exempt
    };
  }

  /* -------------------------------------------- */

  /**
   * Vigor (PHB v4.11, Your Vigor): at 1st level, Ancestry Vigor + Endure Bonus + your first
   * Calling's Opening Vigor + 10; at every level after, Ancestry Vigor + Endure Bonus again. So
   * max = 10 + Opening Vigor + (Ancestry Vigor + Endure Bonus) x level, plus the sheet's
   * adjustment. The Endure Bonus is the conditioning clause of Endure Training (1 at Expert, 2 at
   * Master, 3 at Legendary), read live from the current Endure rank, so it is 0 at 1st level and
   * grows into every level already lived (ruling R1). Only your first Calling counts. A night's
   * rest restores level x Presence, or level if Presence is 1 or less. At 0 you are Spent.
   */
  #prepareVigor() {
    const endure = this.constellations[SW.DEFENSES.endure.slug];
    const endureBonus = SW.ENDURE_VIGOR_BONUS[endure?.rank ?? "untrained"] ?? 0;
    const perLevel = this.details.ancestry.vigor + endureBonus;
    this.vigor.opening = this.details.calling.vigor;
    this.vigor.endureBonus = endureBonus;
    this.vigor.perLevel = perLevel;
    this.vigor.max = Math.max(1, 10 + this.vigor.opening + (perLevel * this.level) + this.bonuses.vigor);
    this.vigor.value = Math.clamp(this.vigor.value, 0, this.vigor.max);
    this.vigor.pct = Math.round((this.vigor.value / this.vigor.max) * 100);
    this.vigor.rest = this.level * Math.max(1, this.attributes.presence.mod);
    this.spent = this.vigor.value === 0;
  }

  /* -------------------------------------------- */

  /** Attack-side numbers that do not depend on which weapon is in hand, and what the body can do. */
  #prepareOffense() {
    // Familiarity is what a Talent recorded, not a field somebody remembered to fill in. Weapon
    // Familiarity and Drilled each ask for a Weapon Group when they are taken, and the answer
    // lives on the Talent; the sheet's own list is kept as a manual override on top.
    const declared = new Set(this.familiarity ?? []);
    for (const item of this.parent.items) {
      if (item.type !== "talent") continue;
      const value = item.system.choice?.value;
      if (value) declared.add(value);
    }
    this.familiar = declared;

    // Melee for anything in your hand, Ranged for anything that leaves it (PHB v4.10). Each is a
    // parent Constellation, so its rank may come from a Combat Style's Talents.
    this.melee = this.#weaponProficiency(SW.MELEE_SLUG);
    this.ranged = this.#weaponProficiency(SW.RANGED_SLUG);
    // Weapon dice by level: two at 4th, three at 8th, four at 12th, five at 16th.
    this.weaponDice = SW.weaponDice(this.level);

    // Initiative is an Awareness check unless you were doing something else: no level, and the
    // helm's penalty rides along inside Awareness. `helm` is broken out for a roll made in
    // another Constellation, which the book says the helm still penalises.
    this.initiative = {
      mod: this.defenses.awareness.mod + this.bonuses.initiative,
      slug: SW.DEFENSES.awareness.slug,
      helm: this.helmPenalty
    };
    this.reach = SW.SIZES[this.size]?.reach ?? 2;
    this.space = SW.SIZES[this.size]?.space ?? 3;

    // Total Reach is your Natural Reach plus the weapon's, measured from the edge of your space
    // to the edge of your target's. The longest thing in your hands is what the token ring shows.
    const held = this.parent.items.filter(i => (i.type === "weapon") && i.system.held);
    this.totalReach = held.reduce((longest, weapon) => {
      const reach = weapon.system.isRanged ? 0 : (this.reach + (weapon.system.reach ?? 0));
      return Math.max(longest, reach);
    }, held.length ? 0 : this.reach);
    this.reachWeapon = held
      .filter(w => !w.system.isRanged)
      .sort((a, b) => (b.system.reach ?? 0) - (a.system.reach ?? 0))[0] ?? null;

    // Unwieldy N: a -2 Situation penalty against anything within N feet, and no attack at all
    // while Grabbed. It is the inner edge of what a long weapon is good for.
    this.unwieldy = this.reachWeapon?.system.flags?.unwieldy ?? 0;

    // Modifiers every attack roll carries, whatever the weapon. The first Arms Wound is -2
    // Situation to attacks (and to Guard, folded in above); Fatigued N is -N Condition to attack
    // rolls (PHB v4.11, Wind), as it is to Evade and Guard. The check engine spreads this list
    // into every attack, so the sheet's weapon rows and the die agree.
    this.attackModifiers = [];
    if (this.zones.arms.wounded) {
      this.attackModifiers.push({
        label: game.i18n.format("STARWROUGHT.Wound.woundedZone", {
          zone: game.i18n.localize(SW.ZONES.arms.label)
        }),
        value: ARMS_WOUND_PENALTY, type: "situation"
      });
    }
    const fatigued = this.parent.conditionValue("fatigued") ?? 0;
    if (fatigued) {
      this.attackModifiers.push({
        label: game.i18n.localize("STARWROUGHT.Condition.fatigued"),
        value: -fatigued, type: "condition"
      });
    }

    // Speed, Step, Rush, Leap, after the Legs' Wounds and less Load Strain where the book says.
    this._prepareMovement(this.details.ancestry.speed + this.bonuses.speed, this.loadStrain);
    this.speed = this.moveSpeed;

    const statuses = this.parent.statuses ?? new Set();
    this.conscious = !statuses.has("unconscious") && !this.isDying;
    this.reactions = this.#prepareReactions(held);
  }

  /* -------------------------------------------- */

  /** Rank, Proficiency Bonus and specialization damage for Melee or Ranged. */
  #weaponProficiency(slug) {
    const con = this.constellations[slug];
    const rank = con?.rank ?? "untrained";
    return {
      slug,
      rank,
      rankLabel: SW.RANKS[rank].label,
      proficiency: SW.rankBonus(rank),
      specialization: SW.SPECIALIZATION[rank] ?? 0,
      points: con?.points ?? 0,
      pool: con?.pool ?? 0,
      trained: rank !== "untrained"
    };
  }

  /* -------------------------------------------- */

  /**
   * Which Reactions this character can take (PHB v4.10, Answering an Attack). Each is granted by
   * the Training root of a Constellation: Parry by Guard Training, Void by Evade Training,
   * Intercept by Melee Training. Owning the root is what counts, not an inherited rank, since
   * only rank is inherited and the parent's own Talents must be bought for their effects. Counter
   * asks for both (ruling 63, Mike 2026-10-01: Melee Training gives one Reaction at Trained, and
   * Counter arrives at Expert): Melee Training owned and the derived Melee rank at Expert or
   * better. That rank is `this.melee.rank`, which already counts a Combat Style's points once the
   * Root is owned (ruling 13); `#prepareOffense` derives it before calling here, and that order
   * matters. Parry also needs a rigid implement in hand: a weapon without the Flexible trait, or a
   * shield. A Head Wound's first effect is no Reactions at all.
   * @param {Item[]} held  The weapons in hand.
   */
  #prepareReactions(held) {
    const owns = slug => !!this.constellations[slug]?.rootOwned;
    const rigid = held.some(w => w.system.rigid)
      || this.parent.items.some(i => (i.type === "shield") && i.system.held);
    const blocked = this.zones.head.wounded ? SW.ZONE_CRITICALS.head.first : null;
    return {
      parry: !blocked && owns(SW.REACTIONS.parry.talent) && rigid,
      void: !blocked && owns(SW.REACTIONS.void.talent),
      counter: !blocked && owns(SW.REACTIONS.counter.talent)
        && SW.rankAtLeast(this.melee.rank, SW.REACTIONS.counter.rank),
      intercept: !blocked && owns(SW.REACTIONS.intercept.talent),
      rigid,
      blocked
    };
  }

  /* -------------------------------------------- */

  /**
   * The Strike Attribute for a weapon (PHB v4.10, The Attack): the higher of the weapon's natural
   * Attribute (Might; Agility for Finesse or a ranged weapon that is neither thrown nor a
   * composite bow) and the Key Attribute of a Combat Style whose root you own and in which you
   * are wielding the weapon (`weapon.system.style`). Damage still adds Might where the Strike
   * allows it; this is the attack roll only.
   * @param {Item} weapon
   * @returns {{attribute: string, mod: number, source: "weapon"|"style", style: string|null}}
   */
  strikeAttributeFor(weapon) {
    const natural = weapon?.system?.attackAttribute ?? "might";
    const result = { attribute: natural, mod: this.attributes[natural]?.mod ?? 0, source: "weapon", style: null };
    const styleSlug = SW.slugify(weapon?.system?.style ?? "");
    if (!styleSlug) return result;
    const entry = this.constellations[styleSlug];
    if (!entry?.rootOwned) return result;
    const attribute = entry.attribute || SW.getConstellation(styleSlug).attribute;
    const mod = this.attributes[attribute]?.mod ?? 0;
    if (mod > result.mod) return { attribute, mod, source: "style", style: styleSlug };
    return result;
  }

  /* -------------------------------------------- */

  /**
   * The Proficiency that applies to a named Constellation, and the Attribute it keys off.
   * Untrained is a real answer, not an error: it is simply +0 Proficiency.
   * @param {string} slug
   * @returns {{rank: string, proficiency: number, attribute: string, points: number, name: string}}
   */
  proficiency(slug) {
    const entry = this.constellations[slug];
    if (entry) {
      return {
        rank: entry.rank,
        proficiency: entry.bonus,
        attribute: entry.attribute,
        points: entry.points,
        name: entry.name
      };
    }
    const meta = SW.getConstellation(slug);
    return { rank: "untrained", proficiency: 0, attribute: meta.attribute, points: 0, name: meta.name };
  }
}

/* -------------------------------------------- */
/*  NPC                                         */
/* -------------------------------------------- */

/**
 * Adversaries are written Threshold-first, because the players roll everything. An NPC's Attack
 * Thresholds are what a player's Defense roll is measured against, and its Defense Thresholds are
 * what a player's attack roll is measured against.
 */
export class SwNpcData extends SwActorData {
  static defineSchema() {
    return Object.assign(commonActorFields(), {
      /** Vigor, entered directly. `max` is stored: there is no Ancestry and Calling to derive it from. */
      vigor: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        temp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      thresholds: new fields.SchemaField(
        Object.keys(SW.DEFENSES).reduce((obj, d) => {
          obj[d] = new fields.NumberField({ required: true, integer: true, initial: 10 });
          return obj;
        }, {
          initiative: new fields.NumberField({ required: true, integer: true, initial: 10 })
        })
      ),

      /** Feet per Move. */
      speed: new fields.NumberField({ required: true, integer: true, min: 0, initial: SW.DEFAULT_SPEED }),

      /** Some creatures have more or fewer than six actions a round (PHB v4.10). */
      actionsPerRound: new fields.NumberField({
        required: true, integer: true, min: 0, max: 12, initial: SW.ACTIONS_PER_ROUND
      }),

      /** Extra Wound capacity from a creature template such as Elite or Boss. */
      woundBonus: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),

      // Protection is entered directly on an adversary; there is no armor paperwork.
      zones: new fields.SchemaField(
        Object.keys(SW.ZONES).reduce((obj, z) => {
          obj[z] = zoneFields({
            protection: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            material: new fields.StringField({
              required: true, choices: Object.keys(SW.MATERIALS), initial: "none"
            })
          });
          return obj;
        }, {})
      ),

      details: new fields.SchemaField({
        creatureType: new fields.StringField({ initial: "" }),
        senses: new fields.StringField({ initial: "" }),
        languages: new fields.StringField({ initial: "" }),
        source: new fields.StringField({ initial: "" }),
        biography: new fields.HTMLField({ initial: "" }),
        notes: new fields.HTMLField({ initial: "" })
      })
    });
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.spent = false;
    this.woundCount = 0;
    this.moveSpeed = this.speed;
    this.reactions = { parry: true, void: true, counter: true, intercept: true, rigid: true, blocked: null };
    this.ranges = [];
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.vigor.value = Math.clamp(this.vigor.value, 0, this.vigor.max);
    this.vigor.pct = this.vigor.max ? Math.round((this.vigor.value / this.vigor.max) * 100) : 0;
    this.spent = this.vigor.value === 0;
    this.reach = SW.SIZES[this.size]?.reach ?? 2;
    this.space = SW.SIZES[this.size]?.space ?? 3;

    // There is no Multiple Attack Penalty in v4.10: an adversary's second swing costs it actions,
    // not accuracy, so each attack carries one Threshold.
    this.attacks = this.parent.items
      .filter(i => (i.type === "action") && i.system.attack?.enabled)
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        threshold: i.system.attack.threshold,
        damage: i.system.attack.damage,
        damageType: i.system.attack.damageType,
        reach: i.system.attack.reach,
        traits: i.system.traits
      }));

    for (const zone of Object.keys(SW.ZONES)) {
      const z = this.zones[zone];
      z.key = zone;
      // An adversary's stored Protection is the raw armor number; its Zone bonus is applied only
      // in zoneProtection, so the two are the same here.
      z.armor = z.protection;
      z.label = SW.ZONES[zone].label;
      z.materialLabel = SW.MATERIALS[z.material].label;
      z.weakTo = SW.MATERIALS[z.material].weakTo;
      // What a Deliberate or Committed Strike meets; a Quick Strike meets `protection` in full.
      z.effective = z.exposed ? 0 : z.protection;
    }
    this._prepareWounds();

    // Adversaries answer with Thresholds, but the sheet still speaks the same language.
    this.defenses = {};
    for (const [key, def] of Object.entries(SW.DEFENSES)) {
      this.defenses[key] = {
        key,
        slug: def.slug,
        label: def.label,
        hint: def.hint,
        attribute: def.attribute,
        threshold: this.thresholds[key],
        mod: this.thresholds[key] - 10,
        isStance: false,
        unavailable: null
      };
    }
    const statuses = this.parent.statuses ?? new Set();
    this.defenses.evade.unavailable = unavailableEvade(statuses);

    // Stance: the same reading as a character's. An adversary's Reactions are the GM's to declare,
    // so all four stand available unless a Head Wound forbids them.
    const reaction = SW.REACTIONS[this.stance] ? this.stance : null;
    const better = (this.defenses.guard?.threshold ?? 10) >= (this.defenses.evade?.threshold ?? 10) ? "guard" : "evade";
    const defense = SW.REACTIONS[this.stance]?.defense ?? (this.stance === "counter" ? better : this.stance);
    this.stanceReaction = reaction;
    this.stanceDefense = SW.DEFENSES[defense] ? defense : "evade";
    this.stanceBonus = reaction ? (SW.REACTIONS[reaction].bonus ?? 0) : 0;
    this.defenses[this.stanceDefense].isStance = true;
    this.stanceThreshold = this.defenses[this.stanceDefense]?.threshold ?? 10;
    const blocked = this.zones.head.wounded ? SW.ZONE_CRITICALS.head.first : null;
    this.reactions = {
      parry: !blocked, void: !blocked, counter: !blocked, intercept: !blocked, rigid: true, blocked
    };

    // Movement. The stored `speed` is the creature's own; `moveSpeed` is what its Legs allow.
    this._prepareMovement(this.speed, 0);
    this.conscious = !statuses.has("unconscious") && !this.isDying;
    // Every ring the map can draw (0.5.1): reach from the attacks above, and the auras of any
    // Talent or Maneuver the adversary owns.
    this.ranges = rangesOf(this.parent);
  }
}

/* -------------------------------------------- */
/*  Shared helpers                              */
/* -------------------------------------------- */

/** Why Evade cannot be used right now, as a condition id, or null when it can. */
function unavailableEvade(statuses) {
  if (statuses.has("grabbed")) return "grabbed";
  if (statuses.has("restrained")) return "restrained";
  return null;
}
