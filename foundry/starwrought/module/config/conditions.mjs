/**
 * Conditions, registered as Foundry status effects, and the static effect id each is created under.
 * Imports SYSTEM_ID from system.mjs for the padded id; nothing here imports the barrel, so there
 * is no import cycle.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

import { SYSTEM_ID } from "./system.mjs";

/**
 * Conditions, registered as Foundry status effects so they can be toggled on a token.
 * `numeric` conditions carry a value (Frightened 2, Fatigued 1, Stunned 1, Wounded 3).
 * `zone` conditions are Exposed, one per Zone (0.5.1): the token status mirrors
 * `system.zones.<zone>.exposed`, and toggling the status from the palette writes the Zone.
 * `rulesPage` names the Rules Reference journal page the condition's row and card title open.
 * `statusId` is the static ActiveEffect id when the default (see statusEffectId) would collide.
 */
export const CONDITIONS = Object.freeze({
  offGuard: { id: "offGuard", name: "STARWROUGHT.Condition.offGuard", img: "icons/svg/downgrade.svg" },
  wrongFooted: { id: "wrongFooted", name: "STARWROUGHT.Condition.wrongFooted", img: "icons/svg/target.svg" },
  frightened: { id: "frightened", name: "STARWROUGHT.Condition.frightened", img: "icons/svg/terror.svg", numeric: true },
  prone: { id: "prone", name: "STARWROUGHT.Condition.prone", img: "icons/svg/falling.svg" },
  grabbed: { id: "grabbed", name: "STARWROUGHT.Condition.grabbed", img: "icons/svg/net.svg" },
  restrained: { id: "restrained", name: "STARWROUGHT.Condition.restrained", img: "icons/svg/padlock.svg" },
  heedless: { id: "heedless", name: "STARWROUGHT.Condition.heedless", img: "icons/svg/explosion.svg" },
  stunned: { id: "stunned", name: "STARWROUGHT.Condition.stunned", img: "icons/svg/daze.svg", numeric: true },
  slowed: { id: "slowed", name: "STARWROUGHT.Condition.slowed", img: "icons/svg/clockwork.svg", numeric: true },
  /**
   * Fatigued N (PHB v4.13, Conditions): -N Condition (maximum of 3, FATIGUED_MAX) to Evade, Guard
   * and attack rolls, and no Exploration Mode Activities; ends after ten minutes of rest, which is
   * the rest card (a night is longer than ten minutes) or the Fatigued card's own button, the
   * table's word that the ten minutes have passed (ruling 81). The end of the Combat clears
   * nothing. Raised by a failed Wind check, which a fighter whose Endure Threshold meets 10 + Load
   * Strain never makes.
   */
  fatigued: { id: "fatigued", name: "STARWROUGHT.Condition.fatigued", img: "icons/svg/unconscious.svg", numeric: true },
  blinded: { id: "blinded", name: "STARWROUGHT.Condition.blinded", img: "icons/svg/blind.svg" },
  deafened: { id: "deafened", name: "STARWROUGHT.Condition.deafened", img: "icons/svg/deaf.svg" },
  concealed: { id: "concealed", name: "STARWROUGHT.Condition.concealed", img: "icons/svg/light-off.svg" },
  hidden: { id: "hidden", name: "STARWROUGHT.Condition.hidden", img: "icons/svg/mystery-man.svg" },
  undetected: { id: "undetected", name: "STARWROUGHT.Condition.undetected", img: "icons/svg/invisible.svg" },
  unconscious: { id: "unconscious", name: "STARWROUGHT.Condition.unconscious", img: "icons/svg/unconscious.svg" },
  dying: { id: "dying", name: "STARWROUGHT.Condition.dying", img: "icons/svg/skull.svg", numeric: true },
  /** Any Zone carries a Wound. The Wounds themselves are per Zone on the actor (PHB v4.10). */
  wounded: { id: "wounded", name: "STARWROUGHT.Condition.wounded", img: "icons/svg/blood.svg" },
  /** At 0 Vigor: every Hit Wounds the Zone it strikes, a Critical Hit twice; Grazes never Wound. */
  spent: { id: "spent", name: "STARWROUGHT.Condition.spent", img: "icons/svg/degen.svg" },
  /** The Bind: a neutral Bind, or one someone Controls. The effect carries the particulars (0.5.1). */
  bound: { id: "bound", name: "STARWROUGHT.Condition.bound", img: "icons/svg/combat.svg", rulesPage: "The Bind" },
  // "starwroughtcontrolled" and "starwroughtcontrolling" share their first sixteen characters, so
  // these two name their ids: a shared id would make the palette treat one as the other.
  controlled: { id: "controlled", name: "STARWROUGHT.Condition.controlled", img: "icons/svg/downgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrld" },
  controlling: { id: "controlling", name: "STARWROUGHT.Condition.controlling", img: "icons/svg/upgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrlg" },
  /** A Maneuver of three or more actions begun: one spent, the rest reserved. */
  preparing: { id: "preparing", name: "STARWROUGHT.Condition.preparing", img: "icons/svg/hazard.svg" },
  dead: { id: "dead", name: "STARWROUGHT.Condition.dead", img: "icons/svg/skull.svg" },
  /**
   * Exposed, one status per Zone (PHB v4.10: "the following condition is placed on you: Exposed
   * [Zone Name]"). Mirrors of `system.zones.<zone>.exposed`, never the record of it: the Zone is
   * the truth and `SwActor#setExposed` keeps the status in step, while the palette hooks in
   * starwrought.mjs carry a toggle on the token back to the Zone.
   */
  exposedHead: { id: "exposedHead", name: "STARWROUGHT.Condition.exposedHead", img: "icons/svg/eye.svg", zone: "head", rulesPage: "Exposed", statusId: "starwroughtxHead" },
  exposedTorso: { id: "exposedTorso", name: "STARWROUGHT.Condition.exposedTorso", img: "icons/svg/bones.svg", zone: "torso", rulesPage: "Exposed", statusId: "starwroughtxTors" },
  exposedArms: { id: "exposedArms", name: "STARWROUGHT.Condition.exposedArms", img: "icons/svg/thrust.svg", zone: "arms", rulesPage: "Exposed", statusId: "starwroughtxArms" },
  exposedLegs: { id: "exposedLegs", name: "STARWROUGHT.Condition.exposedLegs", img: "icons/svg/leg.svg", zone: "legs", rulesPage: "Exposed", statusId: "starwroughtxLegs" }
});

/** Zone key -> the Exposed condition that mirrors it. */
export const ZONE_CONDITIONS = Object.freeze(Object.fromEntries(
  Object.values(CONDITIONS).filter(c => c.zone).map(c => [c.zone, c.id])
));

/**
 * The static ActiveEffect id a condition is created under, the one Foundry's token palette looks
 * for (`Actor#toggleStatusEffect` matches on `_id`, and the HUD lights a status only when the
 * effect carries it). Sixteen alphanumeric characters: the system id and the condition id, padded,
 * except where a condition names its own because the padded form would collide. The system's own
 * `SwActor#setCondition` creates under the same id, so a status set by the rules and one toggled
 * from the token are the same effect and never a pair (0.5.1, "one Bind, one effect").
 * @param {string} id  A key of CONDITIONS.
 * @returns {string}
 */
export function statusEffectId(id) {
  return CONDITIONS[id]?.statusId ?? `${SYSTEM_ID}${id}`.padEnd(16, "0").slice(0, 16);
}
