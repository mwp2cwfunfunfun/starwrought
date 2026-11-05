/**
 * The offense: Familiarity, Melee and Ranged proficiency, weapon dice, Initiative, reach, Unwieldy, the attack modifiers, movement, the Reactions owned.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items, data.familiarity, data.constellations, data.level, data.defenses.awareness, data.bonuses, data.helmPenalty, data.size, data.zones, data.loadStrain, data.details, the Actor's statuses and conditions.
 * Writes: data.familiar, data.melee, data.ranged, data.weaponDice, data.initiative, data.reach, data.space, data.totalReach, data.reachWeapon, data.unwieldy, data.attackModifiers, movement through _prepareMovement, data.speed, data.conscious, data.reactions.
 */

import * as SW from "../../config.mjs";
import { ARMS_WOUND_PENALTY } from "./shared.mjs";

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
  // Weapon dice by level: two at 4th, three at 8th, four at 12th, five at 16th.
  data.weaponDice = SW.weaponDice(data.level);

  // Initiative is an Awareness check unless you were doing something else: no level, and the
  // helm's penalty rides along inside Awareness. `helm` is broken out for a roll made in
  // another Constellation, which the book says the helm still penalises.
  data.initiative = {
    mod: data.defenses.awareness.mod + data.bonuses.initiative,
    slug: SW.DEFENSES.awareness.slug,
    helm: data.helmPenalty
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
  // rolls (PHB v4.11, Wind), as it is to Evade and Guard. The check engine spreads this list
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
  data._prepareMovement(data.details.ancestry.speed + data.bonuses.speed, data.loadStrain);
  data.speed = data.moveSpeed;

  const statuses = data.parent.statuses ?? new Set();
  data.conscious = !statuses.has("unconscious") && !data.isDying;
  data.reactions = prepareReactions(data, held);
}

/** Rank, Proficiency Bonus and specialization damage for Melee or Ranged. */
export function weaponProficiency(data, slug) {
  const con = data.constellations[slug];
  const rank = con?.rank ?? "untrained";
  return {
    slug,
    rank,
    rankLabel: SW.RANKS[rank].label,
    proficiency: SW.rankBonus(rank),
    specialization: SW.SPECIALIZATION[rank] ?? 0,
    points: con?.points ?? 0,
    pool: con?.pool ?? 0,
    trained: rank !== "untrained"
  };
}

/**
 * Which Reactions this character can take (PHB v4.10, Answering an Attack). Each is granted by
 * the Training root of a Constellation: Parry by Guard Training, Void by Evade Training,
 * Intercept by Melee Training. Owning the root is what counts, not an inherited rank, since
 * only rank is inherited and the parent's own Talents must be bought for their effects. Counter
 * asks for both (ruling 63, Mike 2026-10-01: Melee Training gives one Reaction at Trained, and
 * Counter arrives at Expert): Melee Training owned and the derived Melee rank at Expert or
 * better. That rank is `data.melee.rank`, which already counts a Combat Style's points once the
 * Root is owned (ruling 13); `prepareOffense` derives it before calling here, and that order
 * matters. Parry also needs a rigid implement in hand: a weapon without the Flexible trait, or a
 * shield. A Head Wound's first effect is no Reactions at all.
 * @param {Item[]} held  The weapons in hand.
 */
export function prepareReactions(data, held) {
  const owns = slug => !!data.constellations[slug]?.rootOwned;
  const rigid = held.some(w => w.system.rigid)
    || data.parent.items.some(i => (i.type === "shield") && i.system.held);
  const blocked = data.zones.head.wounded ? SW.ZONE_CRITICALS.head.first : null;
  return {
    parry: !blocked && owns(SW.REACTIONS.parry.talent) && rigid,
    void: !blocked && owns(SW.REACTIONS.void.talent),
    counter: !blocked && owns(SW.REACTIONS.counter.talent)
      && SW.rankAtLeast(data.melee.rank, SW.REACTIONS.counter.rank),
    intercept: !blocked && owns(SW.REACTIONS.intercept.talent),
    rigid,
    blocked
  };
}
