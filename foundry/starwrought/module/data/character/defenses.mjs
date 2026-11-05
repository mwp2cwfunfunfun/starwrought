/**
 * The four Defenses, every modifier folded in, the Automation rules asked, and the stance (Evade or Guard) read on top.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.constellations, data.attributes, data.bonuses, data.zones, data.shield, data.worn, data.visorPenalty, data.size, data.stance, the Actor's statuses and conditions, the rules index.
 * Writes: data.defenses, data.stanceReaction, data.stanceDefense, data.stanceBonus, data.stanceThreshold.
 */

import * as SW from "../../config.mjs";
import { ruleModifiers } from "../../rules/engine.mjs";
import { ARMS_WOUND_PENALTY, unavailableEvade } from "./shared.mjs";

/**
 * The four Defenses. Each is a Constellation, so each is Attribute Bonus + Proficiency Bonus +
 * bonuses and penalties, with no level term (PHB v4.10, Checks & Thresholds). A Threshold is
 * that check with a 10 in place of the die.
 *
 * Folded in: Size (Evade and Guard, physical Attacks), Off-Guard, Frightened N, Fatigued N (all
 * four Defenses since PHB v4.21), a lowered visor's Gear penalty on Awareness, a Parry weapon's
 * Gear bonus and a raised shield's Gear bonus on Guard (two pieces of gear, both counted since
 * v4.21's stacking; ruling 125), the first Arms Wound on Guard, and the first Torso Wound as
 * Off-Guard. Load Strain never touches Evade (PHB v4.11 and since: "it never makes you easier to
 * hit"; it came off until 0.6.0). Since 0.10.0 the Automation rules too: a `bonus` whose target
 * is this Defense's Constellation, through the `modifiers` hook point (ruling 124), so the
 * Threshold on the sheet, the Skills grid and the Defense roll agree; the check engine's Defense
 * branch rolls these resolved modifiers and asks the rules nothing more.
 *
 * Stacking is PHB v4.21's (SW.resolveModifiers): everything adds, and a circumstance is counted
 * once. The one shared circumstance here is Off-Guard: the condition and the first Torso Wound
 * (which is Off-Guard made lasting) carry `source: "off-guard"`, so a Wounded fighter who is also
 * Off-Guard is -2, not -4. Frightened and Fatigued are two things and add; through 0.10.1 they
 * were one type and only the worse counted.
 */
export function prepareDefenses(data) {
  const statuses = data.parent.statuses ?? new Set();
  const offGuard = statuses.has("offGuard") ? SW.OFF_GUARD_PENALTY : 0;
  const frightened = -(data.parent.conditionValue("frightened") ?? 0);
  // Fatigued N (PHB v4.21, Conditions): -N Condition to all four Defenses and to attack rolls
  // (the offense pass). Through v4.15 it touched Evade and Guard only.
  const fatigued = -(data.parent.conditionValue("fatigued") ?? 0);
  const sizeMods = SW.SIZES[data.size] ?? SW.SIZES.medium;

  // A Parry weapon in hand (PHB v4.10 weapon traits): +1 Gear to Guard against melee Attacks.
  const parryWeapon = data.parent.items.find(i => (i.type === "weapon") && i.system.held && i.system.flags?.parry) ?? null;
  // A raised shield: its Gear bonus to Guard for physical Attacks until your next Opportunity.
  // A tower shield gives Cover instead of a number.
  const shield = (data.shield?.system.raised && !data.shield.system.cover) ? data.shield : null;

  const woundLabel = zone => game.i18n.format("STARWROUGHT.Wound.woundedZone", {
    zone: game.i18n.localize(SW.ZONES[zone].label)
  });

  for (const [key, def] of Object.entries(SW.DEFENSES)) {
    const con = data.constellations[def.slug];
    const rank = con?.rank ?? "untrained";
    const attribute = con?.attribute ?? def.attribute;
    const physical = (key === "evade") || (key === "guard");
    const modifiers = [
      { label: game.i18n.localize(SW.ATTRIBUTES[attribute].label), value: data.attributes[attribute].mod },
      { label: game.i18n.localize(SW.RANKS[rank].label), value: SW.rankBonus(rank) },
      { label: game.i18n.localize("STARWROUGHT.Field.customBonus"), value: data.bonuses.defenses[key] }
    ];
    if (physical && offGuard) {
      modifiers.push({
        label: game.i18n.localize("STARWROUGHT.Condition.offGuard"),
        value: offGuard, type: "situation", source: "off-guard"
      });
    }
    // The first Torso Wound is Off-Guard made lasting: the same circumstance, counted once.
    if (physical && data.zones.torso.wounded) {
      modifiers.push({ label: woundLabel("torso"), value: SW.OFF_GUARD_PENALTY, type: "situation", source: "off-guard" });
    }
    if (fatigued) {
      modifiers.push({
        label: game.i18n.localize("STARWROUGHT.Condition.fatigued"),
        value: fatigued, type: "condition"
      });
    }
    if (frightened) {
      modifiers.push({
        label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
        value: frightened, type: "condition"
      });
    }
    if (key === "guard") {
      if (data.zones.arms.wounded) {
        modifiers.push({ label: woundLabel("arms"), value: ARMS_WOUND_PENALTY, type: "situation" });
      }
      if (parryWeapon) {
        modifiers.push({
          label: game.i18n.format("STARWROUGHT.Defense.parryWeapon", { weapon: parryWeapon.name }),
          value: SW.PARRY_GUARD_BONUS, type: "gear"
        });
      }
      if (shield) {
        modifiers.push({
          label: game.i18n.format("STARWROUGHT.Defense.raisedShield", { shield: shield.name }),
          value: shield.system.bonus ?? 0, type: "gear"
        });
      }
    }
    // A lowered visor (PHB v4.21, Visored): -1 Gear to Awareness and Initiative. Initiative
    // rolled with Awareness comes through these modifiers; the check engine adds it to an
    // Initiative rolled with another Constellation.
    if (key === "awareness" && data.visorPenalty) {
      modifiers.push({
        label: game.i18n.format("STARWROUGHT.Defense.visorLowered", { piece: data.worn.head.name }),
        value: data.visorPenalty, type: "gear"
      });
    }

    // The Automation rules that apply to this Defense (0.10.0; ruling 124): the index
    // (_prepareRules) and the ranks (prepareConstellations) are both final by now, so a
    // `bonus ... to Guard if Human is Expert` is read at the rank the sheet shows. Only what a
    // kind applies is taken; an offer has no checkbox on a Threshold and is ignored here.
    modifiers.push(...ruleModifiers(data.parent, { kind: "defense", slug: def.slug, item: null }).applied);

    // Size touches only Evade and Guard, and only against physical Attacks.
    const sizeMod = key === "evade" ? sizeMods.evade : key === "guard" ? sizeMods.guard : 0;
    const { total, applied } = SW.resolveModifiers(modifiers);

    data.defenses[key] = {
      key,
      slug: def.slug,
      label: def.label,
      hint: def.hint,
      attribute,
      attributeGlyph: SW.ATTRIBUTES[attribute].glyph,
      rank,
      rankLabel: SW.RANKS[rank].label,
      proficiency: SW.rankBonus(rank),
      trained: rank !== "untrained",
      points: con?.points ?? 0,
      mod: total,
      sizeMod,
      threshold: 10 + total + sizeMod,
      modifiers: applied,
      isStance: false,
      unavailable: null
    };
  }
  // "Evade is unavailable while you are Grabbed or Restrained. You cannot slip what is already
  // holding you." Guard's own exceptions (unaware of the attack, or nothing in hand and no hand
  // free) are not things the sheet can see, so they stay with the table. Recorded, not enforced.
  data.defenses.evade.unavailable = unavailableEvade(statuses);
  prepareStance(data);
}

/**
 * The stance, read as the basic Defense the character stands ready with: Evade or Guard (PHB
 * v4.21: a Reaction is chosen per Blow in the Combat Prompt, never stood ready). A stance stored
 * as Void, Parry or Counter by a release before 0.11.0 reads as the Defense it stood on
 * (SW.LEGACY_STANCES; the migration rewrites the field too). `stanceReaction` and `stanceBonus`
 * stay on the shape, null and 0, for the readers that asked.
 */
export function prepareStance(data) {
  const defense = SW.LEGACY_STANCES[data.stance] ?? data.stance;
  data.stanceReaction = null;
  data.stanceDefense = SW.DEFENSES[defense] ? defense : "evade";
  data.stanceBonus = 0;
  if (data.defenses[data.stanceDefense]) data.defenses[data.stanceDefense].isStance = true;
  data.stanceThreshold = data.defenses[data.stanceDefense]?.threshold ?? 10;
}
