/**
 * Stance: how this actor answers the next Blow.
 *
 * "The defender chooses one of the two Defenses that answer it, and decides whether to spend an
 * action on a Reaction." The decision is the defender's, so it lives on the defender, as a setting
 * they can change at any moment before the attacker rolls, and the attack dialog simply reads it.
 *
 * Five answers (PHB v4.10, Answering an Attack). Two are the basic Defenses: Evade and Guard, which
 * cost nothing. Three are Reactions, paid ❶ from the same six actions when an attack lands on you:
 * Void (Evade +2, Evade Training), Parry (Guard +2, Guard Training and a rigid implement in hand),
 * and Counter (your basic Defense and a Quick Strike back, Melee Training). A Reaction the actor
 * has not earned is drawn, disabled, so the sheet still teaches what the Talent would buy.
 * Awareness and Endure are not stances; the handbook calls for them by name.
 */

import * as SW from "../config.mjs";

/** The five answers to a blow, in the order the HUD cycles them, and how each is drawn. */
export const STANCES = Object.freeze({
  evade: { icon: "fa-solid fa-person-running", defense: "evade", reaction: null },
  guard: { icon: "fa-solid fa-shield-halved", defense: "guard", reaction: null },
  void: { icon: "fa-solid fa-wind", defense: "evade", reaction: "void" },
  parry: { icon: "fa-solid fa-khanda", defense: "guard", reaction: "parry" },
  counter: { icon: "fa-solid fa-arrows-rotate", defense: null, reaction: "counter" }
});

export const STANCE_ORDER = Object.freeze(Object.keys(STANCES));

/** The two basic stances: what an actor with no Reactions can choose between. */
export const BASIC_STANCES = Object.freeze(["evade", "guard"]);

/** Why a Reaction stance is out of reach, per stance, as an i18n key. */
const NEEDS = Object.freeze({
  void: "STARWROUGHT.Stance.needsVoid",
  parry: "STARWROUGHT.Stance.needsParry",
  counter: "STARWROUGHT.Stance.needsCounter"
});

/**
 * Is a stance one this actor can take right now: always for the two basic Defenses, and for a
 * Reaction only when the derived `system.reactions[key]` says the Talent (and, for Parry, the
 * implement) is there. A missing `reactions` object reads as no Reactions at all.
 * @param {Actor} actor
 * @param {string} key
 * @returns {boolean}
 */
export function stanceAvailable(actor, key) {
  const stance = STANCES[key];
  if (!stance) return false;
  if (!stance.reaction) return true;
  return actor.system?.reactions?.[stance.reaction] === true;
}

/**
 * The Defense a stance is rolled with, and its Threshold as the attacker will meet it. Counter
 * has no Defense of its own: the defender rolls a basic Defense and Strikes back, so it shows the
 * better of the two basic Thresholds that are actually usable (ruling, v4.10 sync: 2b's
 * `answeringDefense()` should read the same way).
 * @param {Actor} actor
 * @param {string} key
 * @returns {{defense: string, threshold: number, bonus: number}}
 */
export function stanceDefense(actor, key) {
  const sys = actor.system;
  const stance = STANCES[key] ?? STANCES.evade;
  const reaction = stance.reaction ? SW.REACTIONS[stance.reaction] : null;
  const bonus = reaction?.bonus ?? 0;
  if (stance.defense) {
    return { defense: stance.defense, threshold: (sys.defenses?.[stance.defense]?.threshold ?? 10) + bonus, bonus };
  }
  // Counter: whichever basic Defense is available and better.
  const candidates = BASIC_STANCES.filter(d => !sys.defenses?.[d]?.unavailable);
  const pool = candidates.length ? candidates : BASIC_STANCES;
  const best = pool.reduce((a, b) =>
    ((sys.defenses?.[b]?.threshold ?? 10) > (sys.defenses?.[a]?.threshold ?? 10)) ? b : a);
  return { defense: best, threshold: sys.defenses?.[best]?.threshold ?? 10, bonus: 0 };
}

/**
 * Everything a sheet, a HUD or a chat card needs to show an actor's stance.
 *
 * `options` is all five, in order, each saying whether it is active, whether the rules make it
 * unavailable right now (Evade while Grabbed, shown and never enforced), and whether it is
 * disabled outright (a Reaction the actor has no Talent for). `next` is the next stance in the
 * cycle that is not disabled, which is what the HUD button flips to; null when there is nothing
 * else to flip to.
 * @param {Actor} actor
 * @returns {{key: string, current: object, next: object|null, options: object[]}}
 */
export function stanceContext(actor) {
  const sys = actor.system;
  const key = sys.stance in STANCES ? sys.stance : "evade";

  const options = STANCE_ORDER.map(k => {
    const stance = STANCES[k];
    const reaction = stance.reaction ? SW.REACTIONS[stance.reaction] : null;
    const { defense, threshold, bonus } = stanceDefense(actor, k);
    const defenseLabel = game.i18n.localize(SW.DEFENSES[defense].label);
    const label = reaction ? game.i18n.localize(reaction.label) : defenseLabel;
    const disabled = !stanceAvailable(actor, k);

    // Evade while Grabbed or Restrained, and so Void, which is Evade with an action behind it.
    const blocked = stance.defense ? sys.defenses?.[stance.defense]?.unavailable : null;
    const reason = blocked ? game.i18n.localize(SW.CONDITIONS[blocked]?.name ?? blocked) : null;

    let tooltip;
    if (disabled) {
      // A Head Wound blocks every Reaction (PHB v4.10, Wounds), Talent or no Talent, so that is
      // the reason to give before "needs X Training"; the data model records it as
      // `reactions.blocked` (an i18n key, or true).
      const noReactions = sys.reactions?.blocked;
      tooltip = (typeof noReactions === "string") ? game.i18n.localize(noReactions)
        : noReactions ? game.i18n.format("STARWROUGHT.Reaction.blocked", { name: actor.name })
        : game.i18n.localize(NEEDS[k]);
    }
    else if (k === "counter") tooltip = game.i18n.localize("STARWROUGHT.Stance.switchToCounter");
    else if (reaction) {
      tooltip = game.i18n.format("STARWROUGHT.Stance.switchToReaction", {
        stance: label, defense: defenseLabel, bonus: `+${bonus}`
      });
    } else if (reason) {
      tooltip = game.i18n.format("STARWROUGHT.Stance.switchToUnavailable", { defense: label, reason });
    } else tooltip = game.i18n.format("STARWROUGHT.Stance.switchTo", { defense: label });
    if (reaction && reason && !disabled) {
      tooltip += " " + game.i18n.format("STARWROUGHT.Stance.unavailableNote", { reason });
    }

    return {
      key: k,
      label,
      defense,
      defenseLabel,
      threshold,
      bonus,
      active: k === key,
      unavailable: reason,
      disabled,
      reaction: !!reaction,
      cost: reaction ? (SW.ACTION_GLYPHS[reaction.cost] ?? "") + SW.REACTION_GLYPH : "",
      icon: stance.icon,
      tooltip
    };
  });

  const current = options.find(o => o.active) ?? options[0];
  const start = STANCE_ORDER.indexOf(current.key);
  let next = null;
  for (let i = 1; i < STANCE_ORDER.length; i++) {
    const candidate = options[(start + i) % STANCE_ORDER.length];
    if (!candidate.disabled) { next = candidate; break; }
  }
  return { key, current, next, options };
}
