/**
 * The Exchange (PHB v4.21): the four Threats, the three Strikes, the Reactions the Talents grant,
 * and the flat numbers an attack or a Bind puts on a roll.
 * Imports MELEE_SLUG from constellations.mjs for the Reaction Melee Training grants.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

import { MELEE_SLUG } from "./constellations.mjs";

/**
 * The four kinds of threat and the two Defenses that answer each (PHB v4.10, The Four Threats).
 * Guard answers a ranged Blow only with a shield Raised.
 */
export const THREATS = Object.freeze({
  blow: { label: "STARWROUGHT.Threat.blow", defenses: ["evade", "guard"] },
  blast: { label: "STARWROUGHT.Threat.blast", defenses: ["evade", "endure"] },
  blight: { label: "STARWROUGHT.Threat.blight", defenses: ["endure", "awareness"] },
  beguilement: { label: "STARWROUGHT.Threat.beguilement", defenses: ["awareness", "guard"] }
});

/**
 * The three Strikes (PHB v4.10, The Exchange). The count of actions is a statement about how much
 * of yourself is behind the blow.
 *  - Quick ❶: one weapon die plus precision, nothing else; cannot Critically Hit unless the weapon
 *    is Agile (a natural 20 is a Hit); lands on the Torso; full Protection even on an Exposed Zone;
 *    Stopped, it forms at most a neutral Bind and is never Controlled; a Miss Exposes you whatever
 *    the Strike (The Result).
 *  - Deliberate ❷: all dice, specialization and Might; may be placed on an Exposed Zone; a Critical
 *    Hit lets the attacker Expose a plausible Zone; a Miss Exposes the attacker (defender's choice
 *    of Zone); a Parry that Stops it takes Control.
 *  - Committed ❸: Prepared (one action now, two reserved, resolves at the next Opportunity); all
 *    dice; on any Hit may Expose a plausible Zone; Weighted: Stopped at all (Graze or Miss) Exposes
 *    the attacker; a Parry that Stops it takes Control.
 */
export const STRIKE_KINDS = Object.freeze({
  // PHB v4.21 (Reading the Result, Table 9): a Quick Strike's Miss costs "Nothing"; a Deliberate
  // or Committed Miss Exposes the attacker. Through v4.15 the Result rules said any Miss Exposes
  // and the system followed them (ruling 51); v4.21 says it one way.
  quick: {
    label: "STARWROUGHT.Strike.quick", cost: 1, full: false, canCrit: false, agileCanCrit: true,
    placeOnExposed: false, ignoresExposedProtection: false, exposeOnMiss: false, weighted: false,
    prepared: false, controllable: false
  },
  deliberate: {
    label: "STARWROUGHT.Strike.deliberate", cost: 2, full: true, canCrit: true, agileCanCrit: true,
    placeOnExposed: true, ignoresExposedProtection: true, exposeOnMiss: true, weighted: false,
    prepared: false, controllable: true
  },
  committed: {
    label: "STARWROUGHT.Strike.committed", cost: 3, full: true, canCrit: true, agileCanCrit: true,
    placeOnExposed: true, ignoresExposedProtection: true, exposeOnMiss: true, weighted: true,
    prepared: true, controllable: true
  }
});
export const DEFAULT_STRIKE = "deliberate";

/**
 * The Cast Maneuver (PHB v4.21, Spellwork: "Cast ❷ to ❹"): the standard Maneuver for at-will
 * offensive Spellwork learned through a magical Constellation Talent. "Roll the named magical
 * parent's proficiency with the spell's Key Attribute against the Defenses permitted by its
 * Threat." Three commitments, as a Strike has three:
 *  - Quick Cast ❷: immediate, one damage die whatever the rank, one target, no extra effect; a
 *    Graze deals no damage unless the spell says otherwise. It may Critically Hit (ruling 135: the
 *    book gives spells no Agile rule).
 *  - Focused Cast ❸: Prepared under the three-action rule; the full Damage Dice of the discipline's
 *    rank; a Graze deals one die unless the spell says otherwise.
 *  - Committed Cast ❹: Prepared; the same full dice plus the Talent's listed extra capability (a
 *    secondary effect, an area, a duration), which adds no die of its own.
 */
export const CAST_KINDS = Object.freeze({
  quick: { label: "STARWROUGHT.Cast.quick", cost: 2, full: false, prepared: false, grazeDie: false },
  focused: { label: "STARWROUGHT.Cast.focused", cost: 3, full: true, prepared: true, grazeDie: true },
  committed: { label: "STARWROUGHT.Cast.committed", cost: 4, full: true, prepared: true, grazeDie: true }
});
export const DEFAULT_CAST = "focused";

/**
 * Spell damage dice by the discipline's rank (PHB v4.21, Spellwork: Trained 1, Expert 2, Master 3,
 * Legendary 4), as weapon dice are the Melee or Ranged rank's. A Quick Cast rolls one.
 */
export const SPELL_DICE_BY_RANK = Object.freeze({
  untrained: 1, trained: 1, expert: 2, master: 3, legendary: 4
});

/** @param {string} rank  A rank key. @returns {number} */
export function spellDice(rank) {
  return SPELL_DICE_BY_RANK[String(rank ?? "untrained").toLowerCase()] ?? 1;
}

/**
 * The Reactions the system implements (PHB v4.21, Answering an Attack and the Defense
 * Constellations). Since v4.21 every Reaction is a TALENT: Evade Training grants Give Ground ⓿↺
 * and Guard Training grants Set Your Feet ⓿↺ in their own text, Melee Training grants Intercept
 * ❶↺, and the rest are Talents of their own in Evade and Guard (Sidestep, Slip the Line, Drop
 * Flat; Parry, Riposte, Kneel Behind the Shield, Deflecting Palms, Cover the Angle). The v4.10
 * table's Void and Counter are gone. Keyed by the slug of the Talent's plain name
 * (`slugify(plainName(name))`, the `bonus` kind's match for a Maneuver), so an owned Talent named
 * as the book names it is the Reaction, and a Reaction Talent Mike authors later under another
 * name is offered only once it has a row here (data first; the engine knows what to do with a
 * +2, a Step or a Prone, not with prose).
 *
 *  - `kind`: "reaction" (❶↺, an answer to a Blow on your own Defense), "posture" (⓿↺, an answer
 *    that Exposes a Zone of your choice or carries its own drawback: PHB v4.21, Posture trait),
 *    "modifier" (Riposte changes what a Parry's Stop offers), "ally" (Cover the Angle answers
 *    for an adjacent ally; offered nowhere yet, the table's to run) or "movement" (Intercept).
 *  - `defense`: the Defense the answer stands on; `bonus`: its Situation bonus to that Defense for
 *    the triggering attack; `cost`: in actions, paid from the same six.
 *  - `melee`: answers a melee Blow only; `rigid`: needs a rigid implement in hand; `freeHand`,
 *    `raisedShield`: Requirements the card notes and never enforces.
 *  - `exposes`: for a posture, `true` (a Zone of the defender's choice), a Zone key (that Zone,
 *    Kneel's Arms) or `false` (Drop Flat Exposes nothing); `drawback`: "prone" (you drop Prone)
 *    or "rooted" (Speed 0 until you spend an action to rise), applied or said at the reveal.
 *  - `onStop`: what a Graze or Miss offers: "step" (Sidestep), "adjacent" (Slip the Line: Move to
 *    any space adjacent to the attacker), "control" (Parry: Gain Control of the attacking weapon,
 *    and the riposte Quick Strike when Riposte is owned).
 *  - `grantedBy`: the Constellation whose Training root grants it with no Talent of its own.
 */
export const REACTIONS = Object.freeze({
  "give-ground": {
    label: "STARWROUGHT.Reaction.giveGround", kind: "posture", cost: 0, defense: "evade", bonus: 2,
    exposes: true, drawback: null, melee: false, rigid: false, onStop: null, grantedBy: "evade"
  },
  "set-your-feet": {
    label: "STARWROUGHT.Reaction.setYourFeet", kind: "posture", cost: 0, defense: "guard", bonus: 2,
    exposes: true, drawback: null, melee: false, rigid: false, onStop: null, grantedBy: "guard"
  },
  sidestep: {
    label: "STARWROUGHT.Reaction.sidestep", kind: "reaction", cost: 1, defense: "evade", bonus: 2,
    melee: false, rigid: false, onStop: "step"
  },
  "slip-the-line": {
    label: "STARWROUGHT.Reaction.slipTheLine", kind: "reaction", cost: 1, defense: "evade", bonus: 2,
    melee: true, rigid: false, onStop: "adjacent"
  },
  "drop-flat": {
    label: "STARWROUGHT.Reaction.dropFlat", kind: "posture", cost: 0, defense: "evade", bonus: 4,
    exposes: false, drawback: "prone", melee: false, rigid: false, onStop: null
  },
  parry: {
    label: "STARWROUGHT.Reaction.parry", kind: "reaction", cost: 1, defense: "guard", bonus: 2,
    melee: true, rigid: true, onStop: "control"
  },
  riposte: {
    label: "STARWROUGHT.Reaction.riposte", kind: "modifier", cost: 0, defense: "guard", bonus: 0,
    melee: true, rigid: true, onStop: null
  },
  "kneel-behind-the-shield": {
    label: "STARWROUGHT.Reaction.kneelBehindTheShield", kind: "posture", cost: 0, defense: "guard", bonus: 4,
    exposes: "arms", drawback: "rooted", raisedShield: true, melee: false, rigid: false, onStop: null
  },
  "deflecting-palms": {
    label: "STARWROUGHT.Reaction.deflectingPalms", kind: "reaction", cost: 1, defense: "guard", bonus: 2,
    melee: true, rigid: false, freeHand: true, onStop: null
  },
  "cover-the-angle": {
    label: "STARWROUGHT.Reaction.coverTheAngle", kind: "ally", cost: 1, defense: "guard", bonus: 0,
    melee: true, rigid: true, onStop: null
  },
  intercept: {
    label: "STARWROUGHT.Reaction.intercept", kind: "movement", cost: 1, defense: null, bonus: 0,
    melee: true, rigid: false, onStop: null, grantedBy: MELEE_SLUG
  }
});

/** The Reactions a Training root grants in its own text, by the Constellation's slug (PHB v4.21). */
export const ROOT_REACTIONS = Object.freeze({
  evade: "give-ground",
  guard: "set-your-feet",
  [MELEE_SLUG]: "intercept"
});

/**
 * The Situation bonus of a ⓿↺ Reaction Talent in Evade or Guard that the table above does not
 * know (the general Posture rule, PHB v4.10 to v4.21: "+2 Situation to that Defense, a Zone of
 * your choice Exposed until the end of the round"). A row above wins when the name matches.
 */
export const POSTURE_DEFAULT_BONUS = 2;

/** Support (PHB v4.21): +1 Situation to melee attacks per other conscious ally whose Total Reach includes the target, to this maximum (+2 through v4.15). */
export const SUPPORT_MAX = 4;
/** Evading a Graze gives this much ground, directly away from the attacker. */
export const GIVE_GROUND_FEET = 3;
/** The Parry weapon trait: a Gear bonus to Guard against melee Attacks while wielded (PHB v4.10). */
export const PARRY_GUARD_BONUS = 1;
/** The Situation penalty to attacks with a weapon someone else Controls, and to attacks by a Controlled Arm's owner. */
export const CONTROLLED_PENALTY = -2;

/** Conditions that impose a flat penalty on Evade and Guard. */
export const OFF_GUARD_PENALTY = -2;

/** Unwieldy N: the Situation penalty to attack rolls against a target within N feet. */
export const UNWIELDY_PENALTY = -2;
