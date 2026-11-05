/**
 * The offense: Familiarity, Melee and Ranged proficiency, weapon dice, Initiative, reach, Unwieldy, the attack modifiers, movement, the Reactions owned.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items, data.familiarity, data.constellations, data.level, data.defenses.awareness, data.bonuses, data.visorPenalty, data.size, data.zones, data.loadStrain, data.details, the Actor's statuses and conditions.
 * Writes: data.familiar, data.melee, data.ranged (each with its weapon dice), data.initiative, data.reach, data.space, data.totalReach, data.reachWeapon, data.unwieldy, data.attackModifiers, movement through _prepareMovement, data.speed, data.conscious, data.reactions.
 */

import * as SW from "../../config.mjs";
import { ARMS_WOUND_PENALTY } from "./shared.mjs";
import { ownedReactions } from "../../helpers/answers.mjs";

/** Attack-side numbers that do not depend on which weapon is in hand, and what the body can do. */
export function prepareOffense(data) {
  // Familiarity is what a Talent recorded, not a field somebody remembered to fill in. Weapon
  // Familiarity and Drilled each ask for a Weapon Group when they are taken, and the answer
  // lives on the Talent; the sheet's own list is kept as a manual override on top.
  const declared = new Set(data.familiarity ?? []);
  for (const item of data.parent.items) {
    if (item.type !== "talent") continue;
    const value = item.system.choice?.value;
    if (value) declared.add(value);
  }
  data.familiar = declared;

  // Melee for anything in your hand, Ranged for anything that leaves it (PHB v4.10). Each is a
  // parent Constellation, so its rank may come from a Combat Style's Talents.
  data.melee = weaponProficiency(data, SW.MELEE_SLUG);
  data.ranged = weaponProficiency(data, SW.RANGED_SLUG);
  // Weapon dice are by rank since PHB v4.21 (one at Trained, two at Expert, three at Master, four
  // at Legendary; ruling 153), so each of the two blocks carries its own `dice`; the level table
  // of v4.10 to v4.15 and `data.weaponDice` are gone.

  // Initiative is an Awareness check unless you were doing something else: no level, and a
  // lowered visor's penalty rides along inside Awareness. `visor` is broken out for a roll made in
  // another Constellation, which the book says the visor still penalises (PHB v4.21, Visored:
  // "-1 Gear penalty to Awareness and Initiative").
  data.initiative = {
    mod: data.defenses.awareness.mod + data.bonuses.initiative,
    slug: SW.DEFENSES.awareness.slug,
    visor: data.visorPenalty
  };
  data.reach = SW.SIZES[data.size]?.reach ?? 2;
  data.space = SW.SIZES[data.size]?.space ?? 3;

  // Total Reach is your Natural Reach plus the weapon's, measured from the edge of your space
  // to the edge of your target's. The longest thing in your hands is what the token ring shows.
  const held = data.parent.items.filter(i => (i.type === "weapon") && i.system.held);
  data.totalReach = held.reduce((longest, weapon) => {
    const reach = weapon.system.isRanged ? 0 : (data.reach + (weapon.system.reach ?? 0));
    return Math.max(longest, reach);
  }, held.length ? 0 : data.reach);
  data.reachWeapon = held
    .filter(w => !w.system.isRanged)
    .sort((a, b) => (b.system.reach ?? 0) - (a.system.reach ?? 0))[0] ?? null;

  // Unwieldy N: a -2 Situation penalty against anything within N feet, and no attack at all
  // while Grabbed. It is the inner edge of what a long weapon is good for.
  data.unwieldy = data.reachWeapon?.system.flags?.unwieldy ?? 0;

  // Modifiers every attack roll carries, whatever the weapon. The first Arms Wound is -2
  // Situation to attacks (and to Guard, folded in above); Fatigued N is -N Condition to attack
  // rolls (PHB v4.21, Conditions), as it is to every Defense. The check engine spreads this list
  // into every attack, so the sheet's weapon rows and the die agree.
  data.attackModifiers = [];
  if (data.zones.arms.wounded) {
    data.attackModifiers.push({
      label: game.i18n.format("STARWROUGHT.Wound.woundedZone", {
        zone: game.i18n.localize(SW.ZONES.arms.label)
      }),
      value: ARMS_WOUND_PENALTY, type: "situation"
    });
  }
  const fatigued = data.parent.conditionValue("fatigued") ?? 0;
  if (fatigued) {
    data.attackModifiers.push({
      label: game.i18n.localize("STARWROUGHT.Condition.fatigued"),
      value: -fatigued, type: "condition"
    });
  }

  // Speed, Step, Rush, Leap, after the Legs' Wounds and less Load Strain where the book says.
  // The Talents' `[SPEED +N]` lines (0.16.0) add to the chassis's Speed and the sheet's adjustment.
  data._prepareMovement(data.details.ancestry.speed + data.bonuses.speed + (data.features?.speed ?? 0), data.loadStrain);
  data.speed = data.moveSpeed;

  const statuses = data.parent.statuses ?? new Set();
  data.conscious = !statuses.has("unconscious") && !data.isDying;
  data.reactions = prepareReactions(data, held);
}

/**
 * Rank, Proficiency Bonus and weapon dice for Melee or Ranged (PHB v4.21: the dice are the
 * rank's, 1 / 2 / 3 / 4, and there is no specialization damage any more; ruling 153).
 */
export function weaponProficiency(data, slug) {
  const con = data.constellations[slug];
  const rank = con?.rank ?? "untrained";
  return {
    slug,
    rank,
    rankLabel: SW.RANKS[rank].label,
    proficiency: SW.rankBonus(rank),
    dice: SW.weaponDice(rank),
    points: con?.points ?? 0,
    pool: con?.pool ?? 0,
    trained: rank !== "untrained"
  };
}

/**
 * Which Reactions this character can take (PHB v4.21, Answering an Attack): the Talents owned
 * whose names are rows of SW.REACTIONS (Sidestep, Parry, Drop Flat, ...), and the ones a Training
 * root grants in its own text (Give Ground with Evade Training, Set Your Feet with Guard
 * Training, Intercept with Melee Training; SW.ROOT_REACTIONS). Owning the root is what counts,
 * not an inherited rank. `owned` maps each Reaction key to the Item id that carries it, which
 * `helpers/answers.mjs` reads for the prompt; the flat booleans by key are the same answer for a
 * reader that asks `reactions.intercept` (the Intercept offer on a move). Parry needs a rigid
 * implement in hand, a weapon without the Flexible trait or a shield, noted and never enforced
 * (`rigid`). A Head Wound's first effect is no Reactions at all (`blocked`), and then nothing is
 * owned for the purpose. Through v4.15 the four were Parry, Void, Counter and Intercept, each by
 * a Training root and Counter by Melee Expert (ruling 63); Void and Counter are gone from the book.
 * @param {Item[]} held  The weapons in hand.
 */
export function prepareReactions(data, held) {
  const rigid = held.some(w => w.system.rigid)
    || data.parent.items.some(i => (i.type === "shield") && i.system.held);
  const blocked = data.zones.head.wounded ? SW.ZONE_CRITICALS.head.first : null;
  const owned = blocked ? {} : ownedReactions(data.parent);
  const out = { owned, rigid, blocked };
  for (const key of Object.keys(SW.REACTIONS)) out[key] = key in owned;
  return out;
}
