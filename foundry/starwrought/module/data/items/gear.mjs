/**
 * The gear data model. Shared pieces: physical.mjs. The layout is item.mjs's: one file per type,
 * and no type file imports another.
 */

import { SwItemData, describedFields } from "./base.mjs";
import { physicalFields, migrateCarryState, prepareCarry } from "./physical.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Gear                                        */
/* -------------------------------------------- */

/** Everything else you own. */
export class SwGearData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), physicalFields("carried"), {
      consumable: new fields.BooleanField({ initial: false }),
      /**
       * AMMUNITION (0.30.0, ruling 297): the Weapon Group this gear feeds ("Bows" for Arrows), blank
       * for anything else. A Reload takes one piece of it for each shot it loads, from `quantity`
       * (documents/actor/carrying.mjs, `loadWeapon`).
       */
      ammunition: new fields.StringField({ initial: "" }),
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
    /** Is this ammunition: does it name a Weapon Group it feeds? */
    this.isAmmunition = !!String(this.ammunition ?? "").trim();
  }
}
