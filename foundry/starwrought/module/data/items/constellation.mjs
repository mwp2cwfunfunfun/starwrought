/**
 * The Constellation data model. Shared pieces: rules.mjs. The layout is item.mjs's: one file per
 * type, and no type file imports another.
 */

import * as SW from "../../config.mjs";
import { SwItemData, describedFields } from "./base.mjs";
import { rulesFields, prepareRules } from "./rules.mjs";

const fields = foundry.data.fields;

/* -------------------------------------------- */
/*  Constellation                               */
/* -------------------------------------------- */

/**
 * A Constellation Item is the sky itself: its Key Attribute, its category, its art, and (for a
 * Combat Style) which parent it belongs to. The points and the rank live on the character,
 * derived from the Talents owned.
 */
export class SwConstellationData extends SwItemData {
  static defineSchema() {
    return Object.assign(describedFields(), {
      slug: new fields.StringField({ initial: "" }),
      category: new fields.StringField({
        required: true, choices: Object.keys(SW.CATEGORIES), initial: "skill"
      }),
      attribute: new fields.StringField({
        required: true, choices: Object.keys(SW.ATTRIBUTES), initial: "might"
      }),
      /**
       * The parent Constellation's slug (PHB v4.10): Melee or Ranged for a Combat Style, blank for
       * everything else. A child's Talents count toward the parent's rank; only rank is inherited.
       * Named `parentSlug` because `parent` on a data model is the owning Item, and read only.
       */
      parentSlug: new fields.StringField({ initial: "" }),
      /**
       * A group (PHB v4.21): a Combat Style within Melee or Ranged, a magical specialty within its
       * discipline. It has no rank of its own and wears the parent's; the build sets it for every
       * tree with a Parent, and a parent slug alone reads as a group too (the data model derives
       * `isGroup`), so a world copy made before the field behaves.
       */
      group: new fields.BooleanField({ initial: false }),
      meta: new fields.StringField({ initial: "" }),
      flareTrigger: new fields.StringField({ initial: "" }),
      /** Identity Constellations are granted by a character-creation choice, never bought. */
      identity: new fields.BooleanField({ initial: false }),
      /**
       * A Constellation Item may carry rules one day (0.9.0): the engine collects from it as from
       * a Talent, and the sheet shows the panel. Nothing authors a cell for one yet (the _Tree
       * Index has no Automation column), so the build writes both fields empty.
       */
      ...rulesFields()
    });
  }

  /** @inheritdoc Content built as `system.parent` is filed under `parentSlug`. */
  static migrateData(source) {
    if (source.parent !== undefined) {
      if (typeof source.parent === "string") source.parentSlug ??= source.parent;
      delete source.parent;
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    if (!this.slug) this.slug = SW.slugify(this.parent.name);
    this.categoryLabel = SW.CATEGORIES[this.category]?.label ?? "";
    this.attributeGlyph = SW.ATTRIBUTES[this.attribute]?.glyph ?? "";
    this.parentName = this.parentSlug ? (SW.getConstellation(this.parentSlug)?.name ?? "") : "";
    this.isGroup = this.group || !!this.parentSlug;
    prepareRules(this);
  }
}
