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
import { rangesOf } from "../helpers/ranges.mjs";
import { collectRules } from "../rules/engine.mjs";
// The character's derived-data passes, one module each (0.10.1), called in order by
// SwCharacterData#prepareDerivedData below; the adversary shares the Evade availability.
import { prepareConstellations } from "./character/constellations.mjs";
import { prepareAttributes } from "./character/attributes.mjs";
import { prepareArmor } from "./character/armor.mjs";
import { prepareDefenses } from "./character/defenses.mjs";
import { prepareWind } from "./character/wind.mjs";
import { prepareVigor } from "./character/vigor.mjs";
import { prepareActions } from "./character/actions.mjs";
import { prepareOffense } from "./character/offense.mjs";
import { unavailableEvade } from "./character/shared.mjs";

/** Re-exported so the canvas can import the ranges list from the model that derives it (0.5.1). */
export { rangesOf } from "../helpers/ranges.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Local rules constants                       */
/* -------------------------------------------- */

/** The five stances a defender can hold: the two basic Defenses and the three Reactions that answer a Blow. */
export const STANCES = Object.freeze(["evade", "guard", "void", "parry", "counter"]);


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
      required: true, integer: true, min: 0, max: SW.ACTIONS_MAX, initial: SW.ACTIONS_PER_ROUND
    }),
    reserved: new fields.NumberField({ required: true, integer: true, min: 0, max: SW.ACTIONS_MAX, initial: 0 }),
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
      }), { initial: () => [] })
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
  /*  Automation rules                            */
  /* -------------------------------------------- */

  /**
   * The rule index (0.9.0; rulings 118 to 120): every rule on every owned Talent, action and
   * Constellation Item, collected once per prepare into `{ all, byKind, unknown }` (each entry
   * `{ rule, item }`), so a kind's engine hook can ask `actor.rulesOfKind("bonus")` without
   * walking the Items. It runs FIRST in the derived pass of a character and an adversary alike,
   * before the Constellations roll up, because the hooks read the index from inside the passes
   * that follow. Since 0.10.0 one does: the `modifiers` hook point (ruleModifiers in
   * ../rules/engine.mjs; ruling 124), asked by the check engine for every roll and by
   * prepareDefenses (character/defenses.mjs) for every Defense, so a `bonus ... to Guard if Human is Expert` moves
   * the Guard Threshold on the sheet and the Guard roll alike. The first kind, `bonus`, is the
   * only speaker; the rest come one at a time with Mike (ruling 119). Pure over the embedded
   * documents, which Foundry prepares before the parent's derived data, so each Item's
   * `system.rules` is final here. A party is not an SwActorData and gets no index;
   * SwActor#rulesOfKind answers it an empty list.
   */
  _prepareRules() {
    this.rules = collectRules(this.parent);
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

      milestone: new fields.NumberField({
        required: true, integer: true, min: 0, max: SW.MILESTONES_PER_LEVEL, initial: 0
      }),

      /**
       * Deferred Talent Points (PHB v4.15, Table 4: "a Milestone Talent Point with no Flared
       * Constellation becomes a Deferred Talent Point ... spent the instant a Constellation is
       * Flared"). A count, not a budget (ruling 94, 2026-10-02: counted on the character, nothing
       * enforced). The Party Sheet's Milestone award adds 1 for a member with no Flared
       * Constellation to receive the point; the header's Spent control, or the party's, takes 1 off
       * when the player spends it, which is a Talent bought or dragged as today and policed by
       * nothing; the Flare card carries a reminder line while this is above 0 (party-sheet-plan.md,
       * part 3 and risk 4). New in 0.7.0 with a default, so no world migration.
       */
      deferred: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),

      /**
       * On the road (0.7.2; party-sheet-plan.md, part 8; ruling 106): the Exploration Mode Activity
       * this character is doing, as the compendium `_id` of the Activity Item in the Actions pack's
       * "Exploration Mode" folder ("" is Travel, the default), and for Investigate the slug of the
       * Lore or Skill being rolled ("" otherwise). The pick is the character's: written by its owner
       * or the GM directly (an owner may write their own Actor, so no relay), announced as one line
       * spoken by the member, and read live by the Party Sheet's "On the road" tab, which computes
       * the party's Travel Speed from it at render (ruling 102) and writes the Initiative
       * Constellation it implies onto the Combatant when the encounter begins (ruling 105). A
       * Fatigued character Travels and does nothing else (ruling 101): the sheet locks the select
       * and leaves the stored pick alone, so it comes back when the Fatigue ends. Nothing here is
       * derived from it: the character's own numbers do not change with what they are doing on the
       * road. New with defaults, so no world migration.
       */
      exploration: new fields.SchemaField({
        activity: new fields.StringField({ initial: "" }),
        constellation: new fields.StringField({ initial: "" }),
        /**
         * The Activity's roll, remembered (0.7.3; rulings 108 to 110): the character's most recent
         * check in the Constellation their Activity rolls now (Avoid Notice's Stealth, Search's
         * Awareness, Investigate's pick), wherever it was rolled, as the slug, the total, the die
         * and when. Written on the roller's own client from the `starwrought.check` hook
         * (`rememberActivityRoll` in helpers/party.mjs), by the owner or the GM, so it is the
         * character's and public as the pick is (ruling 110); the card the roll posted is the record
         * of the die and this is a pointer to it. Cleared by `setActivity` when the Activity or the
         * pick changes, because a Search is not an Avoid Notice (ruling 108). Nothing computes with
         * it except Begin the encounter, which may keep it as the Initiative roll (ruling 109). New
         * with defaults, so no world migration.
         */
        roll: new fields.SchemaField({
          slug: new fields.StringField({ initial: "" }),
          total: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
          natural: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
          time: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
          /**
           * The typed modifiers the check carried beyond its base terms (the dialog's situational
           * entry, a caller's typed bonus), as `{ label, value, type }`, so a kept roll is
           * re-assembled as an Initiative in one typed-stacking pass with the Scouts' bonus rather
           * than added to it (ruling 109; the review of 0.7.3).
           */
          modifiers: new fields.ArrayField(new fields.ObjectField(), { initial: () => [] })
        })
      }),

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
        /** Actions a round beyond six (0.10.1): what a haste-like effect targets; may be negative. */
        actions: new fields.NumberField({ required: true, integer: true, initial: 0 }),
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
    // The rule index first (0.9.0), so every pass below can read it; prepareDefenses does (0.10.0),
    // and it needs the Constellations' ranks final too, hence the order.
    this._prepareRules();
    prepareConstellations(this);
    prepareAttributes(this);
    prepareArmor(this);
    this._prepareWounds();
    prepareDefenses(this);
    // Wind needs both Load Strain (prepareArmor) and the Endure Threshold (prepareDefenses) final.
    // Each pass is its own module under ./character/, headed with what it reads and writes; this
    // list is the one place the order lives.
    prepareWind(this);
    prepareVigor(this);
    prepareActions(this);
    prepareOffense(this);
    // Every ring the map can draw (0.5.1): the reach bands derived just above and the auras of
    // the Talents owned. Last, because Total Reach and Unwieldy are read from the offense pass.
    this.ranges = rangesOf(this.parent);
  }

  /* -------------------------------------------- */


  /** @override */
  armorOnZone(zone) {
    return this.worn?.[zone] ?? null;
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
        required: true, integer: true, min: 0, max: SW.ACTIONS_MAX, initial: SW.ACTIONS_PER_ROUND
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
    // The rule index first (0.9.0), as on a character: an adversary's Talents and attacks may carry rules too.
    this._prepareRules();
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
