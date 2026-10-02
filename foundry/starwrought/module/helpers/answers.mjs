/**
 * Legal answers to a Blow: the rules layer the Combat Prompt renders from and the attack
 * coordinator revalidates against (0.5.0 attack-flow brief, "Legal answers").
 *
 * A defender meets a Blow with one of the two basic Defenses that answer it, Evade or Guard
 * (PHB v4.10, The Four Threats), and builds an answer on it:
 *  - nothing: the basic Defense alone, always legal;
 *  - a Reaction the defender owns (PHB v4.10, Answering an Attack): Void ❶↺ stands on Evade, Parry
 *    ❶↺ on Guard, Counter ❶↺ on either, since it adds nothing to the Defense and Strikes back;
 *  - a Posture ⓿↺: an owned Talent with a ⓿↺ cost in the Defense's own Constellation (Slip the
 *    Line ⓿↺ under Evade, Catch the Blade ⓿↺ under Guard). It costs nothing and Exposes a Zone of
 *    the defender's choice until the end of the round, whether or not it works.
 * A Head Wound blocks every Reaction and Posture; the basic Defense still rolls (PHB v4.10,
 * Wounds). The data model records that as `system.reactions.blocked`.
 *
 * A commitment is a Reaction or a Posture, never both: the two would stack a second +2 Situation
 * on the same Defense, which the type rule forbids (CLAUDE.md, Bonus types).
 *
 * Nothing here touches `game` at module scope or in `legalAnswers`, so the function runs under
 * Node for its tests; only `describeAnswer` localizes.
 */

import * as SW from "../config.mjs";

/** The two Defenses that answer a Blow, in display order. */
export const BLOW_DEFENSES = Object.freeze([...SW.THREATS.blow.defenses]);

/** The Reactions the Exchange offers as an answer to a Blow. Intercept answers movement, not a Blow. */
export const ANSWERING_REACTIONS = Object.freeze(["void", "parry", "counter"]);

/**
 * Is this Item a Posture Talent: owned, a ⓿↺ Reaction, filed under the Defense's Constellation.
 * @param {Item} item
 * @param {string} slug  The Defense's Constellation slug (evade or guard).
 * @returns {boolean}
 */
function isPostureFor(item, slug) {
  if (item?.type !== "talent") return false;
  const sys = item.system ?? {};
  return (String(sys.cost) === "0") && (sys.reaction === true) && (sys.constellation === slug);
}

/**
 * The answers this actor may commit on a Defense right now.
 * @param {Actor} actor
 * @param {string} defense  "evade" or "guard".
 * @returns {{none: boolean, reactions: string[], postures: {talentId: string, name: string}[]}}
 */
export function legalAnswers(actor, defense) {
  const none = { none: true, reactions: [], postures: [] };
  if (!actor || !BLOW_DEFENSES.includes(defense)) return none;

  const reactions = actor.system?.reactions ?? {};
  // A Head Wound: no Reactions and no Postures at all; only the basic Defense answers.
  if (reactions.blocked) return none;

  const legalReactions = ANSWERING_REACTIONS.filter(key => {
    const reaction = SW.REACTIONS[key];
    if (!reaction || reactions[key] !== true) return false;
    return (reaction.defense === null) || (reaction.defense === defense);
  });

  const slug = SW.DEFENSES[defense]?.slug ?? defense;
  const postures = [];
  // The Posture the Defense's Training root grants in its own text (PHB v4.10, the Reaction table:
  // Give Ground ⓿↺ with Evade Training, Set Your Feet ⓿↺ with Guard Training). It is no Item of
  // its own, so it rides on the root Talent's id and carries the table's name and effect (0.5.3;
  // Mike: "Where can I choose my Posture, like Give Ground or Set Your Feet?").
  const granted = SW.ROOT_POSTURES?.[slug];
  if (granted && actor.system?.constellations?.[slug]?.rootOwned) {
    const root = [...(actor.items ?? [])].find(i => (i?.type === "talent") && i.system?.root && !i.system?.bloodlineRoot && (i.system?.constellation === slug));
    if (root) postures.push({ talentId: root.id, name: granted.name, hint: granted.effect, granted: true });
  }
  for (const item of actor.items ?? []) {
    if (isPostureFor(item, slug)) postures.push({ talentId: item.id, name: item.name });
  }

  return { none: true, reactions: legalReactions, postures };
}

/**
 * A Posture's name as the table reads it: the record's own when it carries one, else the Talent's,
 * and for a root-granted Posture (SW.ROOT_POSTURES) the Reaction table's name rather than the
 * root's ("Give Ground ⓿↺", never "Evade Training"). Null when nothing names it.
 * @param {Actor|null} actor
 * @param {{talentId?: string, name?: string}|null} posture
 * @returns {string|null}
 */
export function postureName(actor, posture) {
  if (posture?.name) return posture.name;
  const item = posture?.talentId ? actor?.items?.get?.(posture.talentId) : null;
  if (!item) return null;
  const sys = item.system ?? {};
  if (sys.root && !sys.bloodlineRoot && SW.ROOT_POSTURES?.[sys.constellation]) return SW.ROOT_POSTURES[sys.constellation].name;
  return item.name ?? null;
}

/**
 * Is a committed choice legal for this actor: the Defense answers a Blow, the Reaction or the
 * Posture is among the legal answers, and it is one or the other, never both.
 * @param {Actor} actor
 * @param {string} defense
 * @param {{reaction?: string|null, posture?: {talentId: string, zone?: string}|null}} [choice]
 * @returns {boolean}
 */
export function isLegalAnswer(actor, defense, { reaction = null, posture = null } = {}) {
  if (!BLOW_DEFENSES.includes(defense)) return false;
  if (reaction && posture) return false;
  const legal = legalAnswers(actor, defense);
  if (reaction) return legal.reactions.includes(reaction);
  if (posture) {
    if (!posture.talentId) return false;
    if (!legal.postures.some(p => p.talentId === posture.talentId)) return false;
    return !posture.zone || (posture.zone in SW.ZONES);
  }
  return legal.none;
}

/** A Talent's name without the glyphs it carries: "Slip the Line ⓿↺" reads "Slip the Line". */
export function bareName(name) {
  return String(name ?? "").replace(/[⓿❶❷❸❹❺❻↺◆◇★]/g, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * The answer as the table reads it: "No Reaction: the basic Defense", "Parry ❶↺", or
 * "Slip the Line ⓿↺ (Expose Legs)" (just "Slip the Line ⓿↺" until a Zone is named). Localized,
 * so for the browser only.
 * @param {{reaction?: string|null, posture?: {talentId?: string, name?: string, zone?: string|null}|null}} [answer]
 * @param {Actor} [actor]  Resolves a Posture's name from its talentId when the record lacks one.
 * @returns {string}
 */
export function describeAnswer({ reaction = null, posture = null } = {}, actor = null) {
  if (reaction && SW.REACTIONS[reaction]) {
    const r = SW.REACTIONS[reaction];
    return game.i18n.format("STARWROUGHT.Attack.answerReaction", {
      name: game.i18n.localize(r.label),
      glyph: `${SW.ACTION_GLYPHS[r.cost] ?? ""}${SW.REACTION_GLYPH}`
    });
  }
  if (posture) {
    const name = bareName(postureName(actor, posture) ?? "");
    const glyph = `${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`;
    if (!posture.zone) return game.i18n.format("STARWROUGHT.Attack.answerReaction", { name, glyph });
    const zone = game.i18n.localize(SW.ZONES[posture.zone]?.label ?? posture.zone);
    return game.i18n.format("STARWROUGHT.Attack.answerPosture", { name, zone });
  }
  return game.i18n.localize("STARWROUGHT.Attack.answerNone");
}
