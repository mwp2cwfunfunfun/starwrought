/**
 * Actor data models.
 *
 * The character model stores only what a player chooses. Everything a machine can work out is
 * derived: Attribute Points from the Talents you own, Proficiency Rank from your spend and your
 * level, Hit Points from Ancestry and Calling, Protection from the armor on each Zone.
 */

import * as SW from "../config.mjs";

const fields = foundry.data.fields;

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
    bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
  }, extra));
}

/** Fields shared by both Actor types, as a plain object so subclasses can compose freely. */
function commonActorFields() {
  return {
    level: new fields.NumberField({ required: true, integer: true, min: 0, max: 30, initial: 1 }),
    wounded: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    dying: new fields.NumberField({ required: true, integer: true, min: 0, max: SW.DYING_MAX, initial: 0 }),
    size: new fields.StringField({ required: true, choices: Object.keys(SW.SIZES), initial: "medium" }),
    traits: new fields.SchemaField({
      resistances: damageModifierField("STARWROUGHT.Field.resistances"),
      weaknesses: damageModifierField("STARWROUGHT.Field.weaknesses"),
      immunities: new fields.SetField(new fields.StringField({ blank: false }))
    })
  };
}

/* -------------------------------------------- */
/*  Base                                        */
/* -------------------------------------------- */

/** Behaviour shared by every kind of Actor: Zones, Protection, damage modifiers. */
export class SwActorData extends foundry.abstract.TypeDataModel {
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
   * Protection on one Zone against one damage type, worked down the handbook's list.
   * @param {string} zone              A key of SW.ZONES.
   * @param {object} [options]
   * @param {string|null} [options.type]  The incoming damage type, for the material step.
   * @param {number} [options.ignore]     Protection the attacker ignores (Armor-Piercing).
   * @returns {{value: number, steps: Array<{label: string, value: number}>}}
   */
  zoneProtection(zone, { type = null, ignore = 0 } = {}) {
    const steps = [];
    const z = this.zones?.[zone];

    // 1. If the Zone is Exposed, its Protection is 0; you can stop here.
    if (z?.exposed) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Protection.exposed"), value: 0 });
      return { value: 0, steps };
    }

    // 2. Start with the Protection of the piece worn there. No piece worn means 0.
    const piece = this.armorOnZone(zone);
    let total = piece ? (piece.system.protection ?? 0) : (z?.protection ?? 0);
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
      hp: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        temp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      heroPoints: new fields.SchemaField({
        value: new fields.NumberField({
          required: true, integer: true, min: 0, max: SW.HERO_POINTS_MAX, initial: 1
        })
      }),

      milestone: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),

      /**
       * The three actions and one reaction of a turn. Only meaningful in Encounter Mode; the
       * tracker resets them at the start of each of your turns.
       */
      actions: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, max: 9, initial: 3 }),
        reaction: new fields.BooleanField({ initial: true })
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
          hp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          speed: new fields.NumberField({ required: true, integer: true, min: 0, initial: 25 }),
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
          hp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
        }),
        languages: new fields.StringField({ initial: "" }),
        biography: new fields.HTMLField({ initial: "" }),
        notes: new fields.HTMLField({ initial: "" })
      }),

      /** Weapon Groups and Technical weapons this character is Familiar with. */
      familiarity: new fields.SetField(new fields.StringField({ blank: false })),

      /** Which Constellations are currently Flared, keyed by slug. A flag, not a counter. */
      flares: new fields.ObjectField({ initial: {} }),

      /** Manual adjustments, for anything the system cannot see for itself. */
      bonuses: new fields.SchemaField({
        attack: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damage: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        checks: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        initiative: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        speed: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        hp: new fields.NumberField({ required: true, integer: true, initial: 0 }),
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
    this.hp.max = 0;
    this.loadStrain = 0;
    this.matchedHarness = false;
    this.clatter = false;
    this.speed = this.details.ancestry.speed;
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.#prepareConstellations();
    this.#prepareAttributes();
    this.#prepareArmor();
    this.#prepareDefenses();
    this.#prepareHitPoints();
    this.#prepareOffense();
  }

  /* -------------------------------------------- */

  /**
   * Roll the Talents this character owns up into Constellations. Every Talent costs 1 point, so a
   * Constellation's spend is simply the number of its Talents you own, the Root included.
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
        img: meta.img ?? null,
        item: null,
        points: 0,
        talents: [],
        flared: !!this.flares?.[slug]
      });
    };

    // Constellation Items the character has opened carry the authoritative metadata.
    for (const item of this.parent.items) {
      if (item.type !== "constellation") continue;
      const slug = item.system.slug || SW.slugify(item.name);
      const entry = ensure(slug);
      entry.item = item;
      entry.name = item.name;
      entry.category = item.system.category || entry.category;
      entry.attribute = item.system.attribute || entry.attribute;
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

    // The Origin Constellation has three Roots. Ancestry, Bloodline and Culture are authored as
    // separate skies, but they merge into one: rank counts all the points across its sources.
    this.originPoints = Object.values(entries)
      .filter(e => e.category === "origin")
      .reduce((n, e) => n + e.points, 0);

    // Rank, Proficiency Bonus, and what the next rank is still waiting on.
    for (const entry of Object.values(entries)) {
      const pool = entry.category === "origin" ? this.originPoints : entry.points;
      entry.pool = pool;
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
   * defaulting to its Constellation's Key Attribute.
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

  /** Armor: which piece sits on which Zone, matched harness, Clatter, and Load Strain. */
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

    // Load Strain, relieved by your Endure rank once you own Endure Training.
    let load = pieces.reduce((n, p) => n + (p.system.load ?? 0), 0);
    load += this.shield?.system.load ?? 0;
    if (this.matchedHarness) load -= 1;
    const endure = this.constellations[SW.DEFENSES.endure.slug];
    if (endure?.points > 0) load -= SW.LOAD_RELIEF[endure.rank] ?? 0;
    this.loadStrain = Math.max(0, load);

    // The Protection number each Zone shows, computed with no damage type in hand.
    for (const zone of Object.keys(SW.ZONES)) {
      const piece = this.worn[zone];
      const z = this.zones[zone];
      const bonus = (z.bonus ?? 0)
        + (this.matchedHarness && zone === "torso" ? 1 : 0)
        + this.bonuses.protection;
      z.protection = z.exposed ? 0 : Math.max(0, (piece?.system.protection ?? 0) + bonus);
      z.piece = piece;
      z.material = piece?.system.material ?? "none";
      z.materialLabel = SW.MATERIALS[z.material].label;
      z.weakTo = SW.MATERIALS[z.material].weakTo;
      z.label = SW.ZONES[zone].label;
      z.key = zone;
    }

    this.speed = Math.max(0, this.details.ancestry.speed + this.bonuses.speed);
  }

  /** @override */
  armorOnZone(zone) {
    return this.worn?.[zone] ?? null;
  }

  /* -------------------------------------------- */

  /**
   * The four Defenses. Each is a Constellation, so each is level + Attribute + Proficiency.
   * A Threshold is that check with a 10 in place of the die.
   */
  #prepareDefenses() {
    const statuses = this.parent.statuses ?? new Set();
    const offGuard = statuses.has("offGuard") ? SW.OFF_GUARD_PENALTY : 0;
    const frightened = -(this.parent.conditionValue("frightened") ?? 0);
    const sizeMods = SW.SIZES[this.size] ?? SW.SIZES.medium;

    for (const [key, def] of Object.entries(SW.DEFENSES)) {
      const con = this.constellations[def.slug];
      const rank = con?.rank ?? "untrained";
      const attribute = con?.attribute ?? def.attribute;
      const modifiers = [
        { label: game.i18n.localize("STARWROUGHT.Roll.level"), value: this.level },
        { label: game.i18n.localize(SW.ATTRIBUTES[attribute].label), value: this.attributes[attribute].mod },
        { label: game.i18n.localize(SW.RANKS[rank].label), value: SW.rankBonus(rank) },
        { label: game.i18n.localize("STARWROUGHT.Field.customBonus"), value: this.bonuses.defenses[key] }
      ];
      if (offGuard && (key === "evade" || key === "guard")) {
        modifiers.push({
          label: game.i18n.localize("STARWROUGHT.Condition.offGuard"),
          value: offGuard, type: "circumstance"
        });
      }
      if (frightened) {
        modifiers.push({
          label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
          value: frightened, type: "status"
        });
      }
      if (key === "evade" && this.loadStrain) {
        modifiers.push({ label: game.i18n.localize("STARWROUGHT.Field.loadStrain"), value: -this.loadStrain });
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
        points: con?.points ?? 0,
        mod: total,
        sizeMod,
        threshold: 10 + total + sizeMod,
        modifiers: applied
      };
    }
  }

  /* -------------------------------------------- */

  /** Hit Points: 10 + (Ancestry HP + Calling HP) per level. Only your first Calling counts. */
  #prepareHitPoints() {
    const perLevel = this.details.ancestry.hp + this.details.calling.hp;
    this.hp.perLevel = perLevel;
    this.hp.max = Math.max(1, 10 + (perLevel * this.level) + this.bonuses.hp);
    this.hp.value = Math.clamp(this.hp.value, 0, this.hp.max);
    this.hp.pct = Math.round((this.hp.value / this.hp.max) * 100);
    // A night's rest restores level * Presence Hit Points, or level if Presence is 1 or less.
    this.hp.rest = this.level * Math.max(1, this.attributes.presence.mod);
  }

  /* -------------------------------------------- */

  /** Attack-side numbers that do not depend on which weapon is in hand. */
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

    const weapons = this.constellations[SW.WEAPONS_SLUG];
    this.weapons = {
      rank: weapons?.rank ?? "untrained",
      proficiency: weapons?.bonus ?? 0,
      specialization: SW.SPECIALIZATION[weapons?.rank ?? "untrained"] ?? 0,
      dice: SW.weaponDice(this.level)
    };
    this.initiative = {
      mod: this.defenses.awareness.mod + this.bonuses.initiative,
      slug: SW.DEFENSES.awareness.slug
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

    // Unwieldy N: a −2 circumstance penalty against anything within N feet, and no attack at all
    // while Grabbed. It is the inner edge of what a long weapon is good for.
    this.unwieldy = this.reachWeapon?.system.flags?.unwieldy ?? 0;
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
      hp: new fields.SchemaField({
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

      speed: new fields.NumberField({ required: true, integer: true, min: 0, initial: 25 }),

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
  prepareDerivedData() {
    this.hp.value = Math.clamp(this.hp.value, 0, this.hp.max);
    this.hp.pct = this.hp.max ? Math.round((this.hp.value / this.hp.max) * 100) : 0;
    this.reach = SW.SIZES[this.size]?.reach ?? 2;
    this.space = SW.SIZES[this.size]?.space ?? 3;

    // The Multiple Attack Penalty works on adversaries too, and player-facing rolls make it
    // visible in a pleasant way: a monster's second swing is simply an easier number to beat.
    this.attacks = this.parent.items
      .filter(i => (i.type === "action") && i.system.attack?.enabled)
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        thresholds: [
          i.system.attack.threshold,
          i.system.attack.threshold - 5,
          i.system.attack.threshold - 10
        ],
        damage: i.system.attack.damage,
        damageType: i.system.attack.damageType,
        reach: i.system.attack.reach,
        traits: i.system.traits
      }));

    for (const zone of Object.keys(SW.ZONES)) {
      const z = this.zones[zone];
      z.key = zone;
      z.label = SW.ZONES[zone].label;
      z.materialLabel = SW.MATERIALS[z.material].label;
      z.weakTo = SW.MATERIALS[z.material].weakTo;
      z.effective = z.exposed ? 0 : z.protection;
    }

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
        mod: this.thresholds[key] - 10
      };
    }
  }
}
