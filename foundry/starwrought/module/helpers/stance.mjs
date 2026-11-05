/**
 * Stance: the basic Defense this actor stands ready with against the next Blow.
 *
 * "The defender chooses one of the two Defenses that answer it." The decision is the defender's,
 * so it lives on the defender, as a setting they can change at any moment before the attacker
 * rolls, and the attack dialog simply reads it. Two answers: Evade (do not be there) and Guard
 * (do not let it through). A Reaction is never stood ready (PHB v4.21: every Reaction is a Talent,
 * chosen per Blow in the Combat Prompt; Mike, 2026-10-01: "Standing Stance should only include
 * Evade or Guard"); a stance stored as Void, Parry or Counter by a release before 0.11.0 reads as
 * the Defense it stood on (SW.LEGACY_STANCES). Awareness and Endure are not stances; the handbook
 * calls for them by name.
 */

import * as SW from "../config.mjs";

/** The two answers to a Blow, in the order the HUD cycles them, and how each is drawn. */
export const STANCES = Object.freeze({
  evade: { icon: "fa-solid fa-person-running", defense: "evade", reaction: null },
  guard: { icon: "fa-solid fa-shield-halved", defense: "guard", reaction: null }
});

export const STANCE_ORDER = Object.freeze(Object.keys(STANCES));

/** The two basic stances: the whole list since PHB v4.21. */
export const BASIC_STANCES = Object.freeze(["evade", "guard"]);

/** A stored stance read as one of the two: a legacy Reaction stance as the Defense it stood on. */
export function stanceKey(stored) {
  const key = SW.LEGACY_STANCES[stored] ?? stored;
  return (key in STANCES) ? key : "evade";
}

/**
 * Is a stance one this actor can take right now: always, for the two basic Defenses.
 * @param {Actor} _actor
 * @param {string} key
 * @returns {boolean}
 */
export function stanceAvailable(_actor, key) {
  return stanceKey(key) === key;
}

/**
 * The Defense a stance is rolled with, and its Threshold as the attacker will meet it.
 * @param {Actor} actor
 * @param {string} key
 * @returns {{defense: string, threshold: number, bonus: number}}
 */
export function stanceDefense(actor, key) {
  const sys = actor.system;
  const defense = stanceKey(key);
  return { defense, threshold: sys.defenses?.[defense]?.threshold ?? 10, bonus: 0 };
}

/**
 * Everything a sheet, a HUD or a chat card needs to show an actor's stance.
 *
 * `options` is both, in order, each saying whether it is active and whether the rules make it
 * unavailable right now (Evade while Grabbed, shown and never enforced). `next` is the other one,
 * which is what the HUD button flips to.
 * @param {Actor} actor
 * @returns {{key: string, current: object, next: object|null, options: object[]}}
 */
export function stanceContext(actor) {
  const sys = actor.system;
  const key = stanceKey(sys.stance);

  const options = BASIC_STANCES.map(k => {
    const stance = STANCES[k];
    const { defense, threshold, bonus } = stanceDefense(actor, k);
    const defenseLabel = game.i18n.localize(SW.DEFENSES[defense].label);
    // Evade while Grabbed or Restrained.
    const blocked = sys.defenses?.[defense]?.unavailable ?? null;
    const reason = blocked ? game.i18n.localize(SW.CONDITIONS[blocked]?.name ?? blocked) : null;
    const tooltip = reason
      ? game.i18n.format("STARWROUGHT.Stance.switchToUnavailable", { defense: defenseLabel, reason })
      : game.i18n.format("STARWROUGHT.Stance.switchTo", { defense: defenseLabel });
    return {
      key: k,
      label: defenseLabel,
      defense,
      defenseLabel,
      threshold,
      bonus,
      active: k === key,
      unavailable: reason,
      disabled: false,
      reaction: false,
      cost: "",
      icon: stance.icon,
      tooltip
    };
  });

  const current = options.find(o => o.active) ?? options[0];
  const next = options.find(o => o.key !== current.key) ?? null;
  return { key, current, next, options };
}
