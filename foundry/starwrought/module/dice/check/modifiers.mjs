/**
 * The modifiers a roll starts from: the base terms the sheet can see, the Automation rules' modifiers hook, the caller's own.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. `baseModifiers` is the `modifiers` hook point's first call site (ruling 124; the second is the character's Defense pass).
 */

import * as SW from "../../config.mjs";
import { ruleModifiers } from "../../rules/engine.mjs";

/** The base terms plus the caller's own modifiers. */
export function assemble(actor, cfg) {
  const parts = baseModifiers(actor, cfg);
  parts.push(...(cfg.modifiers ?? []));
  return parts;
}

/**
 * Attribute Bonus and Proficiency Bonus, the two terms every check in the game has (PHB v4.10:
 * there is no level term), the conditions the sheet can see for itself, and, since 0.10.0, the
 * bonuses the Automation rules on the character's Items grant to this roll (the `modifiers` hook
 * point, ruling 124). The rules' offers, modifiers a kind names but cannot decide, are left on
 * `cfg.ruleOffers` for prompt to show unticked; they are never applied here.
 * @returns {Array}
 */
export function baseModifiers(actor, cfg) {
  const parts = [];
  const sys = actor.system;

  // Adversaries roll flat; the players own the dice in STARWROUGHT, so an NPC check is rare
  // and uses whatever the GM typed on the sheet. The Automation rules do not reach an adversary
  // in 0.10.0 (it has no Constellations to be ranked in, and it carries Thresholds, not
  // bonuses), so the early return stands as it was.
  if (actor.type === "npc") {
    if (cfg.flatBonus) parts.push({ label: cfg.label, value: cfg.flatBonus });
    return parts;
  }

  // A Defense roll is the Defense's own Threshold with a die in place of the 10, so it rolls the
  // very modifiers the derived Defense already resolved: Attribute, Proficiency, the sheet's
  // adjustment, Off-Guard, Frightened N, Fatigued N, a Parry weapon or a Wounded Arm on Guard,
  // a helm on Awareness. Load Strain is not among them (PHB v4.11: "It never comes off your
  // Evade"). Nothing here can drift from the number on the sheet.
  // The Automation rules are NOT asked again on this branch: the data model's Defense pass
  // (prepareDefenses in data/character/defenses.mjs) already folded a `bonus ... to Guard` into these very
  // modifiers, so the Threshold on the sheet, a Defense roll, an Initiative rolled with
  // Awareness and a Defense rolled as a check all carry it once and never twice (0.10.0).
  const defense = SW.DEFENSES[cfg.slug] ? sys.defenses?.[cfg.slug] : null;
  if (defense && Array.isArray(defense.modifiers)) {
    parts.push(...defense.modifiers.map(m => ({ ...m })));
    // Size touches only Evade and Guard, and sits outside the typed stack.
    if (defense.sizeMod) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.size"), value: defense.sizeMod });
    }
    cfg.attribute = defense.attribute;
    cfg.rank = defense.rank;
    // Initiative rolled with Awareness (the default) comes through here, and the sheet's
    // Initiative adjustment belongs on it as the tracker's formula has always had it
    // (`_getInitiativeFormula` folds `system.initiative.mod`, which includes it). The helm is
    // already among Awareness's own modifiers, so only the adjustment is added (0.7.2).
    if ((cfg.kind === "initiative") && sys.bonuses?.initiative) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.initiativeBonus"), value: sys.bonuses.initiative });
    }
    return parts;
  }

  const prof = cfg.slug ? sys.proficiency(cfg.slug) : null;
  // A weapon's Handling can lower the rank that applies without changing what you have bought.
  if (prof && cfg.rankOverride && (cfg.rankOverride !== prof.rank)) {
    prof.rank = cfg.rankOverride;
    prof.proficiency = SW.rankBonus(cfg.rankOverride);
    cfg.handlingNote = true;
  }
  const attribute = cfg.attribute || prof?.attribute;
  if (attribute) {
    parts.push({
      label: game.i18n.localize(SW.ATTRIBUTES[attribute].label),
      value: sys.attributes[attribute].mod
    });
    cfg.attribute = attribute;
  }
  if (prof) {
    parts.push({
      label: `${prof.name} (${game.i18n.localize(SW.RANKS[prof.rank].label)})`,
      value: prof.proficiency
    });
    cfg.rank = prof.rank;
  }

  // The sheet's own catch-all adjustments. An Initiative rolled with a Constellation is a check
  // in that Constellation (Mike, 2026-10-02, ruling 111: "ALL active modifiers for any roll
  // should be applied even if that roll is used for initiative"), so it carries everything the
  // check would, the check adjustment here and Load Strain below, and then Initiative's own terms
  // on top. Through 0.7.3 an Initiative rolled with Stealth took neither.
  const asCheck = (cfg.kind === "check") || (cfg.kind === "initiative");
  if (cfg.kind === "attack" && sys.bonuses?.attack) {
    parts.push({ label: game.i18n.localize("STARWROUGHT.Field.attackBonus"), value: sys.bonuses.attack });
  } else if (asCheck && sys.bonuses?.checks) {
    parts.push({ label: game.i18n.localize("STARWROUGHT.Field.checkBonus"), value: sys.bonuses.checks });
  }
  if (cfg.kind === "initiative") {
    if (sys.bonuses?.initiative) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.initiativeBonus"), value: sys.bonuses.initiative });
    }
    // PHB v4.10, Helms: a Closed helm is −2 Situation to Initiative, an Open helm −1.
    const helm = SW.HELM_PENALTIES[sys.worn?.head?.name] ?? 0;
    if (helm) parts.push({ label: sys.worn.head.name, value: helm, type: "situation" });
  }

  // Conditions the system can see for itself.
  const frightened = actor.conditionValue("frightened");
  if (frightened) {
    parts.push({
      label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
      value: -frightened,
      type: "condition"
    });
  }

  // The typed modifiers the data model says every attack carries: a Wounded Arm's −2 Situation
  // (PHB v4.10, Wounds), and whatever else the sheet can see. A Controlled weapon's −2 is the
  // same type and is resolved against them rather than added.
  if ((cfg.kind === "attack") && Array.isArray(sys.attackModifiers)) {
    parts.push(...sys.attackModifiers.map(m => ({ ...m })));
  }

  // Load Strain (PHB v4.11, Load and Load Strain): "Climb, Swim, and Stealth checks take your
  // Load Strain as a penalty. Nothing else does." Stealth is applied here, untyped, as the
  // system's own flat adjustment. Climb and Swim are Athletics checks the engine cannot tell
  // from a grapple or a tumble, so the dialog offers the penalty on an Athletics check instead
  // (prompt). Until 0.6.0 every Might or Agility check took it, and Evade did too. An Initiative
  // rolled with Stealth (Avoid Notice) is a Stealth check and takes it too (ruling 111, 0.7.4).
  if (asCheck && (SW.STRAIN_CHECKS[cfg.slug] === "always") && sys.loadStrain) {
    parts.push({ label: game.i18n.localize("STARWROUGHT.Field.loadStrain"), value: -sys.loadStrain });
  }

  // The Automation rules (0.10.0; rulings 122 and 124): every registered kind with a `modifiers`
  // hook is asked once, with the roll's kind, the Constellation supplying the Proficiency Bonus
  // and the Item behind the roll (a Maneuver, a weapon, a Talent, or null). What a kind applies
  // joins the typed stack here, so Humanity's +1 Condition to Aid resolves against Frightened as
  // the book says it should; what a kind only offers (a bonus to a Maneuver on a check made
  // without that Maneuver's Item) waits on `cfg.ruleOffers` for the dialog, unticked, and is
  // never applied unasked. A kind that throws contributes nothing and the roll goes on; the
  // dispatcher in ../rules/engine.mjs holds that fence, not this file.
  const { applied, offered } = ruleModifiers(actor, { kind: cfg.kind, slug: cfg.slug ?? "", item: cfg.item ?? null });
  parts.push(...applied);
  cfg.ruleOffers = offered;

  return parts;
}
