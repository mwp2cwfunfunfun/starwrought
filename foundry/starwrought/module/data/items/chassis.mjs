/**
 * The chassis data model (Ancestry, Bloodline, Culture, Background, Calling). Shared pieces: none
 * beyond base.mjs. The layout is item.mjs's: one file per type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";

const fields = foundry.data.fields;

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
      grants: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
      specialAbility: new fields.HTMLField({ initial: "" }),
      /**
       * The player-facing text of an Ancestry (0.13.0): the "<Ancestry> Lore" sheet's sections in
       * the author's order (Summary, About, You Might..., Names, ...), written by the build and shown
       * on the Description tab and under the highlighted card in Character Creation. Any kind may
       * carry them; only the Ancestries are authored so far.
       */
      lore: new fields.ArrayField(new fields.SchemaField({
        label: new fields.StringField({ initial: "" }),
        text: new fields.HTMLField({ initial: "" })
      }), { initial: () => [] })
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
    /** Which kinds have a Special Ability of their own: an Ancestry's effects are its Talents'. */
    this.hasSpecialAbility = this.kind !== "ancestry";
    /** Only a Culture grants a language (Mike, 2026-11-05: Languages do not belong on an Ancestry). */
    this.hasLanguages = this.kind === "culture";
  }

  get chatDescription() {
    return this.specialAbility || this.description;
  }
}
