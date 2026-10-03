/**
 * The party data model (0.7.0; party-sheet-plan.md, part 1).
 *
 * A party is the characters who travel together, and this document stores only what is party
 * bookkeeping: who is in it, which session the table is on, the last Milestone award so it can be
 * taken back, and the GM's notes. Everything about the members (level, Milestones, Hero Points,
 * Vigor, Wounds, Flares, every rank and Threshold) stays on the characters and is read live by the
 * sheet at render, never copied here: one Actor's derived data must not depend on another's
 * prepare order (plan, risk 2), so `prepareDerivedData` below derives nothing from the members.
 *
 * It extends `TypeDataModel` directly and never `SwActorData` (risk 1): a party has no Zones, no
 * Wounds, no Vigor, no stance and no actions, so the combat machinery never sees one and nothing
 * draws or counts its token. The type is `SW.PARTY_TYPE` ("party"); `_preCreate` in
 * documents/actor.mjs sets its prototype token linked and its default ownership to Observer, so
 * every player can open the sheet while only the GM writes it.
 */

const fields = foundry.data.fields;

export class SwPartyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      /**
       * The members, as world Actor uuids in insertion order (insertion order is the order; the
       * plan struck drag-to-reorder). A linked token drop resolves to its Actor before it lands
       * here; an unlinked token, an adversary, a party or a compendium Actor is refused at the
       * drop. A uuid that resolves to nothing prints as a missing row with Remove only.
       */
      members: new fields.ArrayField(new fields.SchemaField({
        uuid: new fields.StringField({ required: true, blank: false })
      }), { initial: [] }),

      /**
       * The session: its number, which Begin session raises and the session card names, and the
       * moment of the last Begin session as a timestamp (null until the first).
       */
      session: new fields.SchemaField({
        number: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        began: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null })
      }),

      /**
       * The last Milestone award, for Take back (plan, part 3): when it was made, the session, and
       * for every member it wrote the numbers before and after (level, milestone, deferred, the
       * Vigor rise of a level). Null once taken back, or before any award. Take back reverses
       * exactly those numbers on exactly those members and refuses if any has been edited by hand
       * since; see helpers/party.mjs.
       */
      lastAward: new fields.ObjectField({ required: true, nullable: true, initial: null }),

      /**
       * The GM's notes. GM-only in the template, not a vault: a player with Observer ownership can
       * read the document from the console, and FEATURES says so (plan, risk 8).
       */
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /* -------------------------------------------- */

  /**
   * Nothing member-dependent is derived here, on purpose (plan, risk 2): the sheet resolves the
   * members and computes the board at render, and re-renders on their hooks. Only the party's own
   * counts are set, so a template or a macro can read them without touching the array.
   * @override
   */
  prepareDerivedData() {
    this.memberCount = this.members.length;
    this.hasAwardToTakeBack = !!(this.lastAward?.members?.length);
  }

  /** The members' uuids, in order. */
  get memberUuids() {
    return this.members.map(m => m.uuid);
  }
}
