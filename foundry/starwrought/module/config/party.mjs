/**
 * The party (0.7.0) and the road (0.7.2): the party Actor type, what an Activity and the terrain
 * do to Travel Speed, the Scout's and Defender's effects, and the book's travel figures.
 * Nothing here is enforced; the rulings are in the comments and in CHANGELOG.md.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * The Actor type of a party (party-sheet-plan.md, phase 1; Mike's "Go!", 2026-10-02): the GM's
 * console and the players' window at once, GM-owned with Observer players, holding only party
 * bookkeeping (members, the session, the last Milestone award, notes) and reading everything about
 * its members live at render. Its data model extends TypeDataModel directly, never SwActorData, so
 * it has no Zones, Vigor, stance or actions, and a party is never a combatant: Support's ally
 * count, `actorsIn` in combat.mjs and the Combat Tracker's readout skip an actor of this type by
 * name (the plan's risk 1), so no card, readout or bonus ever involves a party.
 *
 * The rulings the sheet is built to (91 to 95, continuing the v4.14 report's numbering): a
 * Milestone award goes to every member by default, with a checkbox per member to withhold it (91);
 * when the fourth Milestone raises a level, current Vigor rises by the same amount as the maximum
 * (92); Begin session sets every member's Hero Points to exactly 1 (93); Deferred Talent Points are
 * counted on the character and nothing is enforced (94); players see every member's Thresholds on
 * the Skills grid (95).
 *
 * Phase 2 (0.7.1; rulings 96 to 100): the party's embedded Items are its loot, PHYSICAL_TYPES only
 * (documents/item.mjs refuses the rest in `_preCreate`), and `system.currency` its purse. Neither
 * is a rule: they move Items and coin and value nothing (96). A player's Take or Give runs on the
 * active GM's client over the system socket (documents/party-socket.mjs), the asker read from the
 * server's stamp, destination written before source, requests served in arrival order, and with
 * no GM connected nothing is written (97); a party Item dropped on a character sheet moves the
 * whole stack (98); Split divides the purse equally in copper and the remainder stays (99); Ask
 * everyone posts one party card with a Roll button per member for its owner or the GM (100).
 */
export const PARTY_TYPE = "party";

/**
 * Phase 3 of the Party Sheet (party-sheet-plan.md, parts 8 and 9; rulings 101 to 107): the
 * Exploration Mode Activity each character is doing, the party's Travel Speed, and Initiative by
 * Activity when the encounter begins. The Activity data itself is content, not code: two
 * positional columns on the roster's `explorationActions` rows (the Constellation the Activity
 * rolls now, and the one it rolls for Initiative, each a name as the trees print it, blank, or
 * ACTIVITY_CHOICE for the member's own pick), which `assets/build_foundry.mjs` writes onto the
 * Activity Item as `system.exploration` and `system.check` (ruling 104). What follows here is the
 * handful of words the book uses that the data only names. Nothing in it is enforced: a Fatigued
 * character's select locks to Travel and the stored pick waits (ruling 101), the party's speed is
 * a line of text and no token moves (ruling 102), and a Scout's Step is announced and not taken
 * (ruling 105).
 */

/**
 * What an Activity does to Travel Speed (PHB v4.15, Exploration Mode: "Exploration Mode Activities
 * (such as Avoid Notice) halve it, except Hustle, which doubles it"; Travel is the full figure).
 * Keyed by the roster row's Speed word, lowercased; the Activity Item derives `multiplier` from it,
 * and the party's Travel Speed is the lowest member's Speed × multiplier, through the book's three
 * formulae in TRAVEL (ruling 102).
 */
export const ACTIVITY_SPEEDS = Object.freeze({
  full: { label: "STARWROUGHT.Travel.full", multiplier: 1 },
  half: { label: "STARWROUGHT.Travel.half", multiplier: 0.5 },
  double: { label: "STARWROUGHT.Travel.double", multiplier: 2 }
});

/**
 * Terrain (PHB v4.15, P343 to P344: "Difficult Terrain halves it; Greater Difficult Terrain cuts it
 * to one-third"). A select on the party (`system.travel.terrain`) and a word on the card, display
 * only (ruling 102).
 */
export const TERRAIN = Object.freeze({
  normal: { label: "STARWROUGHT.Travel.terrainNormal", multiplier: 1 },
  difficult: { label: "STARWROUGHT.Travel.terrainDifficult", multiplier: 0.5 },
  greater: { label: "STARWROUGHT.Travel.terrainGreater", multiplier: 1 / 3 }
});

/**
 * What Begin the encounter does for an Activity beyond its Initiative Constellation (ruling 105).
 * build_foundry.mjs sets the tag from the slug of the roster row's name, so Scout and Defend carry
 * one and every other row carries "": a row Mike adds needs no code unless it does something new
 * (ruling 104). `scout`: every OTHER member's Combatant gets +1 Situation to Initiative
 * (SCOUT_INITIATIVE_BONUS) and the Scout may Step ⓿ on rolling it, which the card says and
 * nothing moves. `defend`: the held shield begins Raised, no action spent and no card of its own;
 * it comes down at the Defender's first Opportunity as any raised shield does, which is what
 * "begins Raised" buys.
 */
export const EXPLORATION_EFFECTS = Object.freeze({
  scout: { label: "STARWROUGHT.Travel.effectScout" },
  defend: { label: "STARWROUGHT.Travel.effectDefend" }
});

/**
 * Scout (PHB v4.15, Table 95): "Every ally gains a +1 Situation bonus to initiative". Written onto
 * each other member's Combatant as an `initiativeModifiers` entry of type "situation", one per
 * Scout; two Scouts give each other one and everyone else two of the same type, of which one
 * applies, as the stacking rule in BONUS_TYPES says (ruling 105).
 */
export const SCOUT_INITIATIVE_BONUS = 1;

/**
 * The token the two roster columns use for "the member's own pick": Investigate rolls the Lore or
 * Skill the character chose (`system.exploration.constellation`) now and for Initiative. The
 * builder writes it through as is; Begin the encounter resolves it against the character's pick,
 * Awareness when there is none, before writing the Combatant's flag (ruling 105).
 */
export const ACTIVITY_CHOICE = "choice";

/** Exploration Mode: feet per minute, miles per hour, miles per day, as multiples of Speed. */
export const TRAVEL = Object.freeze({ feetPerMinute: 40, milesPerHour: 0.5, milesPerDay: 4 });
