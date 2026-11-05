/**
 * The shield data model. Shared pieces: physical.mjs. The layout is item.mjs's: one file per type,
 * and no type file imports another.
 */

import { SwItemData, describedFields } from "./base.mjs";
import { physicalFields, migrateCarryState, prepareCarry } from "./physical.mjs";

const fields = foundry.data.fields;

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
