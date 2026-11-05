/**
 * The armor data model, and the helm penalty by name, which the actor model imports from here
 * too. Shared pieces: physical.mjs. The layout is item.mjs's: one file per type, and no type file
 * imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { physicalFields, migrateCarryState, prepareCarry } from "./physical.mjs";

const fields = foundry.data.fields;

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
