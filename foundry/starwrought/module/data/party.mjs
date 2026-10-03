/**
 * The party data model (0.7.0; party-sheet-plan.md, part 1; 0.7.1 adds the purse, part 6; 0.7.2
 * adds the terrain, part 8; 0.7.5 adds the Downtime days, part 10).
 *
 * A party is the characters who travel together, and this document stores only what is party
 * bookkeeping: who is in it, which session the table is on, the last Milestone award so it can be
 * taken back, the purse, the terrain it is crossing, the Downtime days the GM has given it, and the
 * GM's notes. Its embedded Items are the loot (0.7.1): the four
 * physical types alone, since `SwItem._preCreate` refuses anything else on a party. Everything
 * about the members (level, Milestones, Hero Points, Vigor, Wounds, Flares, every rank and
 * Threshold) stays on the characters and is read live by the sheet at render, never copied here:
 * one Actor's derived data must not depend on another's prepare order (plan, risk 2), so
 * `prepareDerivedData` below derives nothing from the members.
 *
 * It extends `TypeDataModel` directly and never `SwActorData` (risk 1): a party has no Zones, no
 * Wounds, no Vigor, no stance and no actions, so the combat machinery never sees one and nothing
 * draws or counts its token. The type is `SW.PARTY_TYPE` ("party"); `_preCreate` in
 * documents/actor.mjs sets its prototype token linked and its default ownership to Observer, so
 * every player can open the sheet while only the GM writes it.
 */

import * as SW from "../config.mjs";

const fields = foundry.data.fields;

/**
 * What each coin is worth in copper, the larger coin first (the order matters to `fromCopper` in
 * helpers/party.mjs, which breaks a copper total down in this order). The book prices gear in
 * gold pieces and the travelling kit in coppers and states no ladder; ten to one, as the
 * character's `currency` field has always assumed, is the system's reading (0.7.1, ruling 99).
 */
export const COIN_IN_COPPER = Object.freeze({ gp: 100, sp: 10, cp: 1 });

/** The three coin fields, in the character's own shape (data/actor.mjs), so the template idiom carries over. */
function currencyFields() {
  return Object.keys(COIN_IN_COPPER).reduce((obj, coin) => {
    obj[coin] = new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 });
    return obj;
  }, {});
}

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
      }), { initial: () => [] }),

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
       * The purse (0.7.1; plan, part 6; ruling 99): gp, sp and cp, the coin the party has not
       * divided. The GM types it in and Split among the party divides it, in copper, equally
       * among the ticked members, the remainder staying here. A convenience with no rule
       * authority (ruling 96): the book has coin per character and no common purse, so nothing
       * computes with it. Integers, never negative, nothing until the GM writes some.
       */
      currency: new fields.SchemaField(currencyFields()),

      /**
       * The road (0.7.2; plan, part 8; ruling 102): the terrain the party is crossing, one of
       * `SW.TERRAIN` (normal, Difficult, Greater Difficult; PHB v4.15 P343 to P344), which the
       * Travel Speed line multiplies by (1, one half, one third). Display only: the party's
       * speed is the slowest member's after their Activity, times this, and nothing moves a
       * token. The GM's select writes it; a player reads the word. The choices are read when the
       * schema is built, so a config without the table (an older client's cached module) still
       * loads, with "normal" as the one value it accepts.
       */
      travel: new fields.SchemaField({
        terrain: new fields.StringField({
          required: true, choices: () => Object.keys(SW.TERRAIN ?? { normal: true }), initial: "normal"
        })
      }),

      /**
       * Downtime (0.7.5; plan, part 10; ruling 112): the days the GM has given the party, the
       * book's "you have ten days" (PHB v4.15 P348: the GM typically tells you how many before the
       * world begins to move quickly again). An integer the GM types and the players read, and
       * that is the whole of it: nothing in the system counts it down, spends it against an
       * Activity's duration or refuses anything for want of it, because how the days are spent is
       * the table's conversation and not a formula (the plan struck per-member day counters).
       * Downtime is a panel on the On the road tab, not a mode; the Activities it lists are read
       * from the Actions pack and Train is the member's own Flare, so this one number is all the
       * party itself stores. Never negative, 0 until the GM writes some.
       */
      downtime: new fields.SchemaField({
        days: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

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
   * counts are set, so a template or a macro can read them without touching the array; the purse
   * in copper is one of them, since Split and the sheet both want the one number, and the terrain's
   * multiplier is another (the party's own field, no member in it). The Downtime days derive
   * nothing at all (ruling 112): the number is shown as typed.
   * @override
   */
  prepareDerivedData() {
    this.memberCount = this.members.length;
    this.hasAwardToTakeBack = !!(this.lastAward?.members?.length);
    this.purseCopper = Object.entries(COIN_IN_COPPER)
      .reduce((sum, [coin, worth]) => sum + ((Number(this.currency?.[coin]) || 0) * worth), 0);
    this.travel.multiplier = SW.TERRAIN?.[this.travel.terrain]?.multiplier ?? 1;
  }

  /** The members' uuids, in order. */
  get memberUuids() {
    return this.members.map(m => m.uuid);
  }
}
