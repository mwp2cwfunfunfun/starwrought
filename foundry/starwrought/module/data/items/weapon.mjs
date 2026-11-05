/**
 * The weapon data model. Shared pieces: physical.mjs, weapon-traits.mjs. The layout is item.mjs's:
 * one file per type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { physicalFields, migrateCarryState, prepareCarry } from "./physical.mjs";
import { parseWeaponTraits } from "./weapon-traits.mjs";

const fields = foundry.data.fields;

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

    // The weapon's natural Attribute (PHB v4.14, The Attack): Might, or Agility for a Finesse
    // weapon and for a ranged weapon other than a composite bow (the Composite trait, 0.6.3,
    // ruling 87). A thrown weapon is not `isRanged`, so Thrown X reads as Might. The Strike
    // Attribute may still be a Combat Style's Key Attribute; see the actor's strikeAttributeFor.
    this.attackAttribute = (this.flags.finesse || (this.isRanged && !this.flags.composite)) ? "agility" : "might";
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
