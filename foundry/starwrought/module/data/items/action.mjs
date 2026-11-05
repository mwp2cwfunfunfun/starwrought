/**
 * The action data model (a Maneuver, an Activity, or an adversary's attack). Shared pieces:
 * cost.mjs, aura.mjs, rules.mjs. The layout is item.mjs's: one file per type, and no type file
 * imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { costFields, migrateCost, prepareCost } from "./cost.mjs";
import { auraFields, prepareAura } from "./aura.mjs";
import { rulesFields, prepareRules } from "./rules.mjs";

const fields = foundry.data.fields;

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
       * The Automation column of the actions workbooks, and the rules read from it (0.9.0). The
       * field has carried the cell since 0.5.x, as prose nothing acted on; it is the framework's
       * column now, the same column as a Talent's, parsed with the same grammar. See rulesFields.
       */
      ...rulesFields(),
      /** The "within N feet" of the Effect, drawn on the map (0.5.1). */
      ...auraFields(),
      /** Rolled as a check: which Constellation, and which Defense it is measured against. */
      check: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        constellation: new fields.StringField({ initial: "" }),
        defense: new fields.StringField({ initial: "" })
      }),
      /**
       * An Exploration Mode Activity's part in the road (0.7.2; party-sheet-plan.md, part 8;
       * ruling 104), written by assets/build_foundry.mjs from the two positional columns on the
       * roster's `explorationActions` rows and blank on every other action. `travel` is the row's
       * Speed word, lowercased, a key of SW.ACTIVITY_SPEEDS; `check` is the slug of the
       * Constellation the Activity rolls now (Search's Awareness, Look Harmless's Guile), "" when it
       * rolls nothing, or SW.ACTIVITY_CHOICE for the member's own pick (Investigate); `initiative`
       * is the same for the Constellation it rolls for Initiative, "" meaning Awareness, the
       * default; `effect` is what Begin the encounter does for it beyond the Initiative
       * Constellation, a key of SW.EXPLORATION_EFFECTS set by the row's name (scout, defend) or "".
       * The Party Sheet reads all of it from the Item and never from a table of its own, so a row
       * Mike adds to the roster ships here with no code (the plan's risk 9). `blank: true` is said
       * outright on the two choice fields: a StringField with choices refuses "" by default, and ""
       * is the value every Maneuver carries.
       */
      exploration: new fields.SchemaField({
        travel: new fields.StringField({
          required: true, blank: true, choices: ["", ...Object.keys(SW.ACTIVITY_SPEEDS)], initial: ""
        }),
        check: new fields.StringField({ initial: "" }),
        initiative: new fields.StringField({ initial: "" }),
        effect: new fields.StringField({
          required: true, blank: true, choices: ["", ...Object.keys(SW.EXPLORATION_EFFECTS)], initial: ""
        })
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
    // The road (0.7.2, ruling 104): the Activity's Travel Speed multiplier, 1 for anything that is
    // not an Activity (a Maneuver's `travel` is ""), and whether this is an Exploration Mode
    // Activity at all, which is its folder in the pack and its `category` here. The Party Sheet
    // reads both from the Item.
    this.exploration.multiplier = SW.ACTIVITY_SPEEDS[this.exploration.travel]?.multiplier ?? 1;
    this.isExploration = this.category === "Exploration Mode";
    prepareRules(this);
  }

  /** The rules, when the action has them written separately from its flavour. */
  get chatDescription() {
    return this.effect || this.description;
  }
}
