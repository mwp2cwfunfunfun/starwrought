/**
 * The armor data model: a piece on a Zone, its Protection, Load and type, and the two traits the
 * system acts on since 0.11.0, Visored and Fitted (PHB v4.21). Shared pieces: physical.mjs. The
 * layout is item.mjs's: one file per type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { physicalFields, migrateCarryState, prepareCarry } from "./physical.mjs";

const fields = foundry.data.fields;

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
      /** The armor type (PHB v4.21's Type column; the field keeps its v4.10 name). */
      material: new fields.StringField({
        required: true, choices: Object.keys(SW.ARMOR_TYPES), initial: "padded"
      }),
      /**
       * Fitted (PHB v4.21): the player's word that this piece has been adjusted to its wearer. Read
       * only while the piece carries the Fitted trait; three adjusted Fitted pieces worn make the
       * Fitted Harness that takes 1 off Load Strain (the character model, character/armor.mjs).
       */
      adjusted: new fields.BooleanField({ initial: false }),
      /**
       * Visored (PHB v4.21): is the visor down. Read only while the piece carries the Visored
       * trait; lowered it is -1 Gear to Awareness and Initiative, raised the piece Protects 1 less.
       * Flipped by SwItem#toggleVisor, a single action, from the Equipment tab or the Maneuver.
       */
      lowered: new fields.BooleanField({ initial: false })
    });
  }

  /** @inheritdoc */
  static migrateData(source) {
    // PHB v4.21 renamed Scale to Lamellar (ruling 141); a piece stored under the old key comes across.
    if (source.material in SW.LEGACY_ARMOR_TYPES) source.material = SW.LEGACY_ARMOR_TYPES[source.material];
    return super.migrateData(migrateCarryState(source, "armor"));
  }

  prepareDerivedData() {
    prepareCarry(this, "armor");
    this.zoneLabel = SW.ZONES[this.zone].label;
    const type = SW.ARMOR_TYPES[this.material] ?? SW.ARMOR_TYPES.none;
    this.materialLabel = type.label;
    /** What Clatter counts (ruling 142): mail, lamellar, brigandine, splint and plate. */
    this.rigidType = !!type.rigid;
    const has = pattern => this.traits.some(t => pattern.test(t));
    this.comfort = has(/^comfort/i);
    this.noisy = has(/^noisy/i);
    this.quiet = has(/^quiet/i);
    /** Muffled (PHB v4.21): never contributes to Clatter. */
    this.muffled = has(/^muffled/i);
    /** Articulated (PHB v4.21): Flexible while adjusted. Flexible: Load 1 lower for a Climb or Swim; display only. */
    this.articulated = has(/^articulated/i);
    this.flexible = has(/^flexible/i) || (this.articulated && this.adjusted);
    /** Putting it on takes 1 minute per point of Protection. */
    this.donTime = Math.max(1, this.protection);
    /**
     * Attended (ruling 82; in the book since v4.14): the piece fastens behind the shoulder, beyond
     * its wearer's own reach, so alone it takes twice as long to put on. Display only: the
     * equipment tab's time tag prints both numbers and nothing else acts on it.
     */
    this.attended = has(/^attended/i);
    this.donTimeAlone = this.attended ? 2 * this.donTime : this.donTime;
    /**
     * Fitted (PHB v4.21): the trait, and whether this piece counts toward the Fitted Harness (the
     * trait AND the player's adjusted tick). A piece without the trait is never "adjusted".
     */
    this.fitted = has(/^fitted/i);
    this.fittedAdjusted = this.fitted && this.adjusted;
    /**
     * Visored (PHB v4.21): the trait, whether the visor is down, and what the piece Protects now:
     * its full number lowered, one less raised. A piece without the trait is never lowered and
     * Protects its number.
     */
    this.visored = has(/^visored/i);
    this.visorLowered = this.visored && this.lowered;
    this.visorPenalty = this.visorLowered ? SW.VISOR_PENALTY : 0;
    this.effectiveProtection = Math.max(0, this.protection + ((this.visored && !this.lowered) ? SW.VISOR_RAISED_PROTECTION : 0));
  }
}
