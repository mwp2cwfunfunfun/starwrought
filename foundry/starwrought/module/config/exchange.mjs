/**
 * The Exchange (PHB v4.10): the four Threats, the three Strikes, the Reactions and the root
 * Postures, and the flat numbers an attack or a Bind puts on a roll.
 * Imports MELEE_SLUG from constellations.mjs for the Reactions Melee Training grants.
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
  quick: {
    label: "STARWROUGHT.Strike.quick", cost: 1, full: false, canCrit: false, agileCanCrit: true,
    placeOnExposed: false, ignoresExposedProtection: false, exposeOnMiss: true, weighted: false,
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
 * The Reactions the Exchange names (PHB v4.10, Answering an Attack). Each is granted by a Talent
 * (`talent`: the slug of the Constellation whose Training root grants it) and paid from the same
 * six actions. `rank`, when present, is the minimum rank in that Constellation as well: the Root
 * must be owned and the derived rank must have reached it (a Combat Style's points count toward
 * Melee once Melee Training is owned, ruling 13). Absent, the Root alone grants the Reaction.
 * Counter is Melee Expert (Mike, 2026-10-01, ruling 63: Melee Training gives one Reaction at
 * Trained, Intercept; Counter arrives at Expert). The handbook still prints Counter under Melee
 * Training; the book is Mike's to bring across.
 */
export const REACTIONS = Object.freeze({
  parry: { label: "STARWROUGHT.Reaction.parry", cost: 1, defense: "guard", bonus: 2, talent: "guard", rigid: true },
  void: { label: "STARWROUGHT.Reaction.void", cost: 1, defense: "evade", bonus: 2, talent: "evade", rigid: false },
  counter: { label: "STARWROUGHT.Reaction.counter", cost: 1, defense: null, bonus: 0, talent: MELEE_SLUG, rank: "expert", rigid: false },
  intercept: { label: "STARWROUGHT.Reaction.intercept", cost: 1, defense: null, bonus: 0, talent: MELEE_SLUG, rigid: false },
  posture: { label: "STARWROUGHT.Reaction.posture", cost: 0, defense: null, bonus: 0, talent: null, rigid: false }
});

/**
 * The Postures the two Defense Training roots grant in their own text (PHB v4.10, the Reaction
 * table: Give Ground ⓿↺ with Evade Training, Set Your Feet ⓿↺ with Guard Training; +2 Situation to
 * the named Defense for the triggering attack, a Zone of your choice Exposed until the end of the
 * round, win or lose). They are not Talents of their own, so the Combat Prompt offers them on the
 * root Talent's id once the root is owned (0.5.3; Mike: "Where can I choose my Posture, like Give
 * Ground or Set Your Feet?"). Keyed by the Defense's Constellation slug.
 */
export const ROOT_POSTURES = Object.freeze({
  evade: {
    name: "Give Ground ⓿↺",
    label: "STARWROUGHT.Posture.giveGround",
    effect: "+2 Situation bonus to Evade for the triggering attack. A Zone of your choice becomes Exposed until the end of the round, win or lose; Recenter does not clear it."
  },
  guard: {
    name: "Set Your Feet ⓿↺",
    label: "STARWROUGHT.Posture.setYourFeet",
    effect: "+2 Situation bonus to Guard for the triggering attack. A Zone of your choice becomes Exposed until the end of the round, win or lose; Recenter does not clear it."
  }
});

/** Support: +1 Situation to melee attacks per other conscious ally whose Total Reach includes the target, to this maximum. */
export const SUPPORT_MAX = 2;
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
