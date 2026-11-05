/**
 * The Talent data model. Shared pieces: cost.mjs, aura.mjs, rules.mjs. The layout is item.mjs's:
 * one file per type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { costFields, migrateCost, prepareCost } from "./cost.mjs";
import { auraFields, prepareAura } from "./aura.mjs";
import { rulesFields, prepareRules } from "./rules.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Talent                                      */
/* -------------------------------------------- */

/** One Talent. Every Talent costs exactly 1 Talent Point, from the humblest to the most legendary. */
export class SwTalentData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      constellation: new fields.StringField({ initial: "" }),
      constellationName: new fields.StringField({ initial: "" }),
      tier: new fields.StringField({ required: true, choices: Object.keys(SW.TIERS), initial: "T" }),
      /** Buying the Root is what makes you Trained. Nothing else can be bought before it. */
      root: new fields.BooleanField({ initial: false }),
      /** A Bloodline root: granted by the chargen choice, never listed among buyable Talents. */
      bloodlineRoot: new fields.BooleanField({ initial: false }),
      capstone: new fields.BooleanField({ initial: false }),
      requires: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
      prerequisites: new fields.StringField({ initial: "" }),
      /** A Talent may feed an Attribute other than its Constellation's Key Attribute. */
      attribute: new fields.StringField({ required: false, blank: true, initial: "" }),
      effect: new fields.HTMLField({ initial: "" }),
      /** Action cost, if this Talent is something you do rather than something you are. */
      ...costFields("passive"),
      /** A restricted Talent Point this Talent hands out. */
      grant: new fields.SchemaField({
        n: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        mode: new fields.StringField({ initial: "" }),
        scope: new fields.StringField({ initial: "" })
      }),
      /**
       * A build-time pick the Talent's effect demands, and what the player picked. Weapon
       * Familiarity is the case this exists for: without the answer recorded, the Talent has no
       * mechanical effect at all, because nothing knows which Weapon Group you are Familiar with.
       */
      choice: new fields.SchemaField({
        prompt: new fields.StringField({ initial: "" }),
        value: new fields.StringField({ initial: "" })
      }),
      /** Another Talent this one hands over outright, with no Talent Point spent. */
      freeTalent: new fields.StringField({ initial: "" }),
      /** The "within N feet" of the Effect, drawn on the map (0.5.1). */
      ...auraFields(),
      /** The Automation cell and the rules read from it (0.9.0). See rulesFields. */
      ...rulesFields()
    });
  }

  /**
   * @inheritdoc
   * The v3.4 Weapons Constellation split into Melee and Ranged (PHB v4.10). A Talent still filed
   * under Weapons is filed under Melee, since that is where a weapon in hand rolls; a character
   * whose training was really Ranged moves the Talent by hand.
   */
  static migrateData(source) {
    migrateCost(source, "talent");
    if (source.constellation === SW.WEAPONS_SLUG) {
      source.constellation = SW.MELEE_SLUG;
      if (source.constellationName) source.constellationName = SW.getConstellation(SW.MELEE_SLUG).name;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    this.tierLabel = SW.TIERS[this.tier]?.label ?? "";
    this.requiredRank = SW.TIERS[this.tier]?.rank ?? "trained";
    prepareCost(this);
    // A Talent the book moved between Constellations follows it (Loose and Move, Archery to
    // Ranged in v4.10): the owned copy keeps its id and counts where the book now files it.
    const moved = SW.MOVED_TALENTS[SW.slugify(this.parent?.name ?? "")];
    if (moved && (this.constellation === moved.from)) {
      this.constellation = moved.to;
      this.constellationName = SW.getConstellation(moved.to).name;
    }
    /** A Talent that wants an answer and has not been given one is not doing anything yet. */
    this.needsChoice = !!this.choice.prompt && !this.choice.value;
    if (!this.constellation && this.constellationName) {
      this.constellation = SW.slugify(this.constellationName);
    }
    prepareAura(this);
    prepareRules(this);
  }

  get chatDescription() {
    return this.effect || this.description;
  }
}
