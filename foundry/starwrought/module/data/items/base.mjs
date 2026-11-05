/**
 * The common ancestor of every Item data model, and the fields every Item in the game has.
 * Talents, Constellations, and the chassis pieces (Ancestry, Bloodline, Culture, Background,
 * Calling) are all Items, because that is what makes them compendium content.
 *
 * One file per Item type under module/data/items/, the shared pieces beside them one concern
 * per file (base, cost, aura, rules, physical, weapon-traits), and module/data/item.mjs a barrel
 * that re-exports the lot, so a registration imports one module. A type's file imports only the
 * shared pieces its schema uses; no type file imports another type file.
 */

const fields = foundry.data.fields;

/** Description plus the Trait line, which every Item in the game has. */
export function describedFields() {
  return {
    description: new fields.HTMLField({ initial: "" }),
    // A function initial, for the reason rulesFields() gives: a literal `[]` is one shared array.
    traits: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
    source: new fields.StringField({ initial: "" })
  };
}

/** The common ancestor, so `item.system.description` is always safe to read. */
export class SwItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return describedFields();
  }

  /** The chat-card summary a roll uses. */
  get chatDescription() {
    return this.description;
  }
}
