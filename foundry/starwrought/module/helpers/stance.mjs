/**
 * Stance: which Defense answers the next physical Attack.
 *
 * "The defender decides whether to Evade or Guard." The decision is the defender's, so it lives on
 * the defender, as a setting they can flip at any moment before the attacker rolls, and the attack
 * dialog simply reads it. Awareness and Endure are not stances; the handbook says they are almost
 * never chosen against an Attack, and are called for by specific situations instead.
 */

import * as SW from "../config.mjs";

/** The two answers to a blow, and how each is drawn. */
export const STANCES = Object.freeze({
  evade: { icon: "fa-solid fa-person-running" },
  guard: { icon: "fa-solid fa-shield-halved" }
});

/**
 * Everything a sheet, a HUD or a chat card needs to show an actor's stance.
 * @param {Actor} actor
 * @returns {{key: string, current: object, next: object, options: object[]}}
 */
export function stanceContext(actor) {
  const sys = actor.system;
  const key = sys.stance in STANCES ? sys.stance : "evade";
  const options = Object.keys(STANCES).map(k => {
    const label = game.i18n.localize(SW.DEFENSES[k].label);
    const def = sys.defenses?.[k];
    // Evade while Grabbed or Restrained. Shown, never enforced.
    const reason = def?.unavailable
      ? game.i18n.localize(SW.CONDITIONS[def.unavailable]?.name ?? def.unavailable)
      : null;
    return {
      key: k,
      label,
      threshold: def?.threshold ?? 10,
      active: k === key,
      unavailable: reason,
      icon: STANCES[k].icon,
      tooltip: reason
        ? game.i18n.format("STARWROUGHT.Stance.switchToUnavailable", { defense: label, reason })
        : game.i18n.format("STARWROUGHT.Stance.switchTo", { defense: label })
    };
  });
  const current = options.find(o => o.active);
  const next = options.find(o => !o.active);
  return { key, current, next, options };
}
