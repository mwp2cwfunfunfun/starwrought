/**
 * The four Defenses, every modifier folded in, the Automation rules asked, and the stance read on top.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.constellations, data.attributes, data.bonuses, data.zones, data.shield, data.worn, data.helmPenalty, data.size, data.stance, the Actor's statuses and conditions, the rules index.
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
 * Folded in: Size (Evade and Guard, physical Attacks), Off-Guard, Frightened N, Fatigued N
 * (Evade and Guard), the helm on Awareness, a Parry weapon's Gear bonus and a raised shield's
 * Gear bonus on Guard (same type, so the better one stands), the first Arms Wound on Guard, and
 * the first Torso Wound as Off-Guard. Load Strain never touches Evade (PHB v4.11: "It never
 * comes off your Evade"; it came off until 0.6.0). Since 0.10.0 the Automation rules too: a
 * `bonus` whose target is this Defense's Constellation, through the `modifiers` hook point
 * (ruling 124), so the Threshold on the sheet, the Skills grid and the Defense roll agree; the
 * check engine's Defense branch rolls these resolved modifiers and asks the rules nothing more.
 */
export function prepareDefenses(data) {
  const statuses = data.parent.statuses ?? new Set();
  const offGuard = statuses.has("offGuard") ? SW.OFF_GUARD_PENALTY : 0;
  const frightened = -(data.parent.conditionValue("frightened") ?? 0);
  // Fatigued N (PHB v4.11, Wind): -N Condition to Evade and Guard, and to attack rolls below.
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
        value: offGuard, type: "situation"
      });
    }
    // The first Torso Wound is Off-Guard made lasting.
    if (physical && data.zones.torso.wounded) {
      modifiers.push({ label: woundLabel("torso"), value: SW.OFF_GUARD_PENALTY, type: "situation" });
    }
    if (physical && fatigued) {
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
    if (key === "awareness" && data.helmPenalty) {
      modifiers.push({
        label: game.i18n.format("STARWROUGHT.Defense.helmPenalty", { piece: data.worn.head.name }),
        value: data.helmPenalty, type: "situation"
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
 * The stance, read as a Defense plus an optional Reaction. Void answers with Evade, Parry with
 * Guard; Counter has no Defense of its own and is taken here as Guard (you meet the blow to
 * answer it). `stanceThreshold` is the basic Threshold; the Reaction's +2 Situation and its
 * action cost are applied by the roll that resolves the attack, so they are exposed as
 * `stanceBonus` and `stanceReaction` rather than folded in.
 */
export function prepareStance(data) {
  const reaction = SW.REACTIONS[data.stance] ? data.stance : null;
  // Counter has no Defense of its own: it stands on the better of the two basic Defenses that
  // are available (ruling 43), which is what the attacker's roll meets.
  const better = () => {
    const evade = data.defenses.evade?.unavailable ? -Infinity : (data.defenses.evade?.threshold ?? 10);
    const guard = data.defenses.guard?.unavailable ? -Infinity : (data.defenses.guard?.threshold ?? 10);
    return guard >= evade ? "guard" : "evade";
  };
  const defense = SW.REACTIONS[data.stance]?.defense
    ?? (data.stance === "counter" ? better() : data.stance);
  data.stanceReaction = reaction;
  data.stanceDefense = SW.DEFENSES[defense] ? defense : "evade";
  data.stanceBonus = reaction ? (SW.REACTIONS[reaction].bonus ?? 0) : 0;
  if (data.defenses[data.stanceDefense]) data.defenses[data.stanceDefense].isStance = true;
  data.stanceThreshold = data.defenses[data.stanceDefense]?.threshold ?? 10;
}
