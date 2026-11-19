/**
 * The modifiers a roll starts from: the base terms the sheet can see, the Automation rules' modifiers hook, the caller's own.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. `baseModifiers` is the `modifiers` hook point's first call site (ruling 124; the second is the character's Defense pass).
 */

import * as SW from "../../config.mjs";
import { ruleModifiers, ruleSubstitutions, conditionModifiers } from "../../rules/engine.mjs";
import { sceneContextFor, encounterContext } from "../../rules/scene.mjs";
import { swapTerms, substitutionRecord, chooseVariant, mergeMarks } from "./substitute.mjs";

/**
 * The base terms plus the caller's own modifiers.
 *
 * A CHECK MADE WITH OTHER TERMS (0.21.0; rulings 215 to 222; the `substitutions` hook point). A
 * rule may offer to swap a check's Attribute Bonus and Proficiency Bonus for another pair
 * (Cooperative Instinct: `[EFFECT USE: Presence, Origin, aid]`). When the rules offer any swap on
 * this roll, the roll is assembled once with its own terms and once with each swap, every one in
 * full, because another rule may read the rank the roll is made at; the variants are left on
 * `cfg.substituteVariants` for the dialog, and one stands:
 *
 *   cfg.substitute undefined   the default rule: the swap whose total is strictly the best, else none
 *   cfg.substitute null        none (the player unticked the box)
 *   cfg.substitute "<key>"     that swap (the player ticked it)
 *
 * What stands is written back as the roll's own: its parts are returned, `cfg.rank` is the rank
 * rolled, `cfg.ruleOffers` and `cfg.ruleMarks` are that variant's (with the swap's own marks, so a
 * LIMIT is spent and a one-roll custom effect removed only when its swap is the one rolled), and
 * `cfg.substituted` is the record the card keeps, null when the check kept its terms.
 * `cfg.attribute` stays the check's OWN Attribute throughout, so a second assembly prices the same
 * pair. A roll no rule offers a swap on is assembled exactly as before 0.21.0.
 */
export function assemble(actor, cfg) {
  const asked = substitutionsFor(actor, cfg);
  if (!asked.candidates.length) {
    cfg.substituteVariants = null;
    cfg.substituted = null;
    const parts = baseModifiers(actor, cfg);
    parts.push(...(cfg.modifiers ?? []));
    // A Skip line that would have offered a swap is spent by this roll all the same.
    if (asked.marks.length) cfg.ruleMarks = mergeMarks(cfg.ruleMarks, asked.marks);
    return parts;
  }

  const variants = [null, ...asked.candidates].map(candidate => {
    const copy = { ...cfg, substituted: null };
    const parts = baseModifiers(actor, copy, candidate);
    parts.push(...(cfg.modifiers ?? []));
    return {
      key: candidate?.key ?? null,
      label: candidate?.label ?? "",
      certain: candidate ? (candidate.certain !== false) : true,
      parts,
      total: SW.resolveModifiers(parts).total,
      attribute: copy.attribute,
      rank: copy.rank,
      handlingNote: copy.handlingNote === true,
      ruleOffers: copy.ruleOffers ?? [],
      ruleMarks: mergeMarks(copy.ruleMarks, asked.marks, candidate?.marks),
      substituted: copy.substituted ?? null
    };
  });
  const chosen = chooseVariant(variants, cfg.substitute);
  if (chosen.attribute) cfg.attribute = chosen.attribute;
  cfg.rank = chosen.rank;
  if (chosen.handlingNote) cfg.handlingNote = true;
  cfg.ruleOffers = chosen.ruleOffers;
  cfg.ruleMarks = chosen.ruleMarks;
  cfg.substituted = chosen.substituted;
  cfg.substituteVariants = variants;
  // A copy: the caller pushes the dialog's extras onto what it is given, and a variant's own list
  // is what the dialog shows.
  return [...chosen.parts];
}

/**
 * The swaps the Automation rules offer on this roll (the `substitutions` hook point; ruling 221).
 * A character's check in a Constellation, and nothing else: an adversary rolls flat, and a Strike,
 * a Cast, a Defense roll and an Initiative are never swapped (ruling 220). A check made WITH a
 * Defense (an Aid rolled with Awareness) is asked only when a Maneuver's Item is behind it: the
 * Defense's Threshold and its roll against an attack never swap, so nothing else on that branch
 * may. The rank handed over is the check's own, before any swap.
 * @returns {{candidates: object[], marks: object[]}}
 */
function substitutionsFor(actor, cfg) {
  const none = { candidates: [], marks: [] };
  const sys = actor?.system;
  if ((actor?.type === "npc") || (cfg.kind !== "check") || !cfg.slug || (typeof sys?.proficiency !== "function")) return none;
  const defense = SW.DEFENSES[cfg.slug] ? sys.defenses?.[cfg.slug] : null;
  if (defense && (cfg.item?.type !== "action")) return none;
  const rank = defense ? defense.rank : sys.proficiency(cfg.slug)?.rank;
  return ruleSubstitutions(actor, {
    kind: cfg.kind, slug: cfg.slug, item: cfg.item ?? null, rank: rank ?? "untrained", encounter: encounterContext()
  });
}

/**
 * The terms a swap rolls for this character and the record of it (check/substitute.mjs holds the
 * arithmetic; this reads the sheet). `own` is the check's own pair.
 */
function swapFor(actor, candidate, own) {
  const sys = actor.system;
  const terms = swapTerms(candidate, own, {
    attributeBonus: key => sys.attributes?.[key]?.mod ?? 0,
    proficiency: slug => {
      const p = sys.proficiency(slug);
      return { name: p.name, rank: p.rank, bonus: p.proficiency };
    }
  });
  return { terms, record: substitutionRecord(candidate, terms, own) };
}

/**
 * A swap in words, for the dialog's row and the card's note: only the terms that were swapped, on
 * both sides. "Presence and Origin (Trained)" in place of "Wits and Crafting (Untrained)"; an
 * Attribute alone, "Presence" in place of "Wits".
 * @param {object} record  `cfg.substituted`, or a variant's.
 * @returns {{talent: string, swap: string, own: string}}
 */
export function describeSubstitution(record) {
  const attribute = key => (key && SW.ATTRIBUTES[key]) ? game.i18n.localize(SW.ATTRIBUTES[key].label) : "";
  const ranked = (name, rank) => name ? `${name} (${game.i18n.localize(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label)})` : "";
  const join = parts => {
    const said = parts.filter(Boolean);
    return (said.length === 2) ? game.i18n.format("STARWROUGHT.Roll.substituteAnd", { a: said[0], b: said[1] }) : (said[0] ?? "");
  };
  const swap = join([
    record?.attribute ? attribute(record.attribute) : "",
    record?.proficiency ? ranked(record.proficiency.name, record.proficiency.rank) : ""
  ]);
  const own = join([
    record?.attribute ? attribute(record.from?.attribute) : "",
    record?.proficiency ? ranked(record.from?.name, record.from?.rank) : ""
  ]);
  return { talent: String(record?.itemName ?? ""), swap, own };
}

/**
 * The one line that says a swap: "Cooperative Instinct: Presence and Origin (Trained) in place of
 * Wits and Crafting (Untrained)". The roll dialog's row is this line, and the card's note is this
 * line with a full stop. A swap with nothing named on the check's side says the swap alone.
 * @param {object} record
 * @returns {string}
 */
export function substitutionLine(record) {
  const said = describeSubstitution(record);
  return said.own
    ? game.i18n.format("STARWROUGHT.Roll.substituteOption", said)
    : game.i18n.format("STARWROUGHT.Roll.substituteOptionBare", said);
}

/**
 * The roll's other party for the rules (0.15.0, `MARKED`): the attacker a Defense answers
 * (`cfg.attacker`), the defender an immediate attack names (`cfg.defender`), with the token the
 * card calls the target (`cfg.targetUuid`). Null when nobody is known, as on the attack flow's
 * blind die, whose pairings ask again as each resolves.
 *
 * Since 0.31.0 (ruling 308) also the creature a check is READ AGAINST (`cfg.targetActor`, which
 * helpers/threshold-read.mjs sets for a Maneuver that names one Defense: Demoralize against
 * Guard). Through 0.30.0 such a check had the target's token and no Actor, so a rule about the
 * other party's own state could not hold on it; `IFT: EFFECT(...)` is the first that asks.
 * @param {object} cfg
 * @returns {{actor: object|null, uuid: string|null, tokenUuid: string|null, name: string}|null}
 */
export function otherOf(cfg) {
  const actor = cfg?.attacker ?? cfg?.defender ?? cfg?.targetActor ?? null;
  const tokenUuid = cfg?.targetUuid || null;
  if (!actor && !tokenUuid) return null;
  return { actor, uuid: actor?.uuid ?? null, tokenUuid, name: String(cfg?.targetName ?? actor?.name ?? "") };
}

/**
 * Attribute Bonus and Proficiency Bonus, the two terms every check in the game has (PHB v4.10:
 * there is no level term), the conditions the sheet can see for itself, and, since 0.10.0, the
 * bonuses the Automation rules on the character's Items grant to this roll (the `modifiers` hook
 * point, ruling 124). The rules' offers, modifiers a kind names but cannot decide, are left on
 * `cfg.ruleOffers` for prompt to show unticked; they are never applied here.
 * @param {object} actor
 * @param {object} cfg
 * @param {object|null} [candidate]  A swap of the two base terms to assemble the roll with (0.21.0;
 *                                   one answer of `ruleSubstitutions`), or null for the check's own.
 *                                   `assemble` is the only caller that passes one.
 * @returns {Array}
 */
export function baseModifiers(actor, cfg, candidate = null) {
  const parts = [];
  const sys = actor.system;

  // Adversaries roll flat; the players own the dice in STARWROUGHT, so an NPC check is rare
  // and uses whatever the GM typed on the sheet. The Automation rules do not reach an adversary
  // in 0.10.0 (it has no Constellations to be ranked in, and it carries Thresholds, not
  // bonuses), so the early return stands as it was.
  if (actor.type === "npc") {
    if (cfg.flatBonus) parts.push({ label: cfg.label, value: cfg.flatBonus });
    // THE CONDITIONS IT HAS (0.33.0; rulings 324 and 335): the one thing that reaches an
    // adversary's die. A Frightened 2 Bandit's attack roll is at -2, as its Attack Threshold is
    // when a player's Defense answers it (combat/attack-source.mjs), so the two faces of one
    // attack agree. Its own Talents stay unread: `conditionModifiers` answers for the Conditions
    // alone, with no scene, so no player's aura reaches it either. A Defense is not rolled by an
    // adversary; were one, its Threshold already carries the standing lines, so only an attack, a
    // check and an Initiative take them here.
    if (cfg.kind !== "defense") {
      parts.push(...conditionModifiers(actor, {
        kind: cfg.kind, slug: cfg.slug ?? "", item: cfg.item ?? null, threat: cfg.threat ?? null, other: otherOf(cfg)
      }));
    }
    return parts;
  }

  // A Defense roll is the Defense's own Threshold with a die in place of the 10, so it rolls the
  // very modifiers the derived Defense already resolved: Attribute, Proficiency, the sheet's
  // adjustment, Off-Guard, Frightened N, Fatigued N, a Parry weapon or a Wounded Arm on Guard,
  // a lowered visor on Awareness. Load Strain is not among them (PHB v4.11 and since: armor
  // never makes you easier to hit). Nothing here can drift from the number on the sheet.
  // The Automation rules are NOT asked again on this branch: the data model's Defense pass
  // (prepareDefenses in data/character/defenses.mjs) already folded a `bonus ... to Guard` into these very
  // modifiers, so the Threshold on the sheet, a Defense roll, an Initiative rolled with
  // Awareness and a Defense rolled as a check all carry it once and never twice (0.10.0).
  const defense = SW.DEFENSES[cfg.slug] ? sys.defenses?.[cfg.slug] : null;
  if (defense && Array.isArray(defense.modifiers)) {
    let own = defense.modifiers.map(m => ({ ...m }));
    let rank = defense.rank;
    cfg.substituted = null;
    // A check made with this Defense from a Maneuver's Item, with other terms (0.21.0; an Aid
    // rolled with Awareness under Cooperative Instinct). The Defense pass tagged its two base
    // entries (`base`), and the swap replaces the tagged ones; everything else the Defense carries
    // stays. A Defense roll, a Threshold read and an Initiative never come here with a candidate.
    if (candidate && (cfg.kind === "check")) {
      const { terms, record } = swapFor(actor, candidate, {
        attribute: defense.attribute, slug: cfg.slug, name: sys.proficiency(cfg.slug)?.name ?? "", rank: defense.rank, value: defense.proficiency
      });
      const attributeEntry = candidate.attribute
        ? { label: game.i18n.localize(SW.ATTRIBUTES[terms.attribute].label), value: terms.attributeValue, base: "attribute" }
        : (own.find(m => m.base === "attribute") ?? null);
      const proficiencyEntry = candidate.proficiency
        ? { label: `${terms.name} (${game.i18n.localize(SW.RANKS[terms.rank]?.label ?? SW.RANKS.untrained.label)})`, value: terms.value, base: "proficiency" }
        : (own.find(m => m.base === "proficiency") ?? null);
      own = [attributeEntry, proficiencyEntry, ...own.filter(m => !m.base)].filter(Boolean);
      rank = terms.rank;
      cfg.substituted = record;
    }
    parts.push(...own);
    // Size touches only Evade and Guard, and sits outside the typed stack.
    if (defense.sizeMod) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.size"), value: defense.sizeMod });
    }
    cfg.attribute = defense.attribute;
    // The rank rolled: the borrowed Constellation's when a swap stands, and what the rules read.
    cfg.rank = rank;
    // Initiative rolled with Awareness (the default) comes through here, and the sheet's
    // Initiative adjustment belongs on it as the tracker's formula has always had it
    // (`_getInitiativeFormula` folds `system.initiative.mod`, which includes it). The helm is
    // already among Awareness's own modifiers, so only the adjustment is added (0.7.2).
    if ((cfg.kind === "initiative") && sys.bonuses?.initiative) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.initiativeBonus"), value: sys.bonuses.initiative });
    }
    // The rules the sheet's pass could not read (0.13.0): those that need the map (`FOR` reaching
    // others, `WHILE`), the Threat (`AGAINST`) or the round (`FIRST`, `ONCE`). Asked here with
    // `momentOnly`, so the static ones the Defense already folded in are never counted twice.
    const moment = ruleModifiers(actor, {
      kind: cfg.kind, slug: cfg.slug ?? "", item: cfg.item ?? null, rank: cfg.rank ?? "untrained",
      threat: cfg.threat ?? null, other: otherOf(cfg), scene: sceneContextFor(actor, cfg.token ?? null), encounter: encounterContext(),
      momentOnly: true, leavePending: cfg.leavePending === true
    });
    parts.push(...moment.applied);
    cfg.ruleOffers = moment.offered;
    cfg.ruleMarks = moment.marks;
    return parts;
  }

  const prof = cfg.slug ? sys.proficiency(cfg.slug) : null;
  // A weapon's Handling can lower the rank that applies without changing what you have bought.
  if (prof && cfg.rankOverride && (cfg.rankOverride !== prof.rank)) {
    prof.rank = cfg.rankOverride;
    prof.proficiency = SW.rankBonus(cfg.rankOverride);
    cfg.handlingNote = true;
  }
  const ownAttribute = cfg.attribute || prof?.attribute;
  // A check made with other terms (0.21.0; `assemble` above): the swap names the Attribute, the
  // Constellation whose Proficiency Bonus is borrowed, or both, and what it does not name is the
  // check's own. `cfg.attribute` stays the check's own Attribute; `cfg.rank` is the rank rolled,
  // which is what every rule asked below reads (ruling 217).
  const swap = (candidate && prof && (cfg.kind === "check"))
    ? swapFor(actor, candidate, { attribute: ownAttribute || "", slug: cfg.slug, name: prof.name, rank: prof.rank, value: prof.proficiency })
    : null;
  const attribute = swap ? swap.terms.attribute : ownAttribute;
  if (attribute) {
    parts.push({
      label: game.i18n.localize(SW.ATTRIBUTES[attribute].label),
      value: swap ? swap.terms.attributeValue : sys.attributes[attribute].mod
    });
  }
  if (ownAttribute) cfg.attribute = ownAttribute;
  if (prof) {
    const name = swap ? swap.terms.name : prof.name;
    const rank = swap ? swap.terms.rank : prof.rank;
    parts.push({
      label: `${name} (${game.i18n.localize(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label)})`,
      value: swap ? swap.terms.value : prof.proficiency
    });
    cfg.rank = rank;
  }
  cfg.substituted = swap ? swap.record : null;

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
    // PHB v4.21, Visored: a lowered visor is -1 Gear to Initiative, whatever Constellation rolls
    // it (Awareness carries it inside its own modifiers, on the Defense branch above).
    const visor = Number(sys.visorPenalty) || 0;
    if (visor) {
      parts.push({
        label: game.i18n.format("STARWROUGHT.Defense.visorLowered", { piece: sys.worn?.head?.name ?? "" }),
        value: visor, type: "gear"
      });
    }
  }

  // Conditions the system can see for itself. Since 0.33.0 Frightened's numbers are its row's in
  // the Conditions workbook, which the rules asked below carry; this is the fallback, standing
  // only while no row of the workbook describes it (ruling 329; data/character/defenses.mjs).
  const frightened = SW.conditionHasRow("frightened") ? 0 : actor.conditionValue("frightened");
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

  // Load Strain (PHB v4.21, Speed at the margin): "Apply your Load Strain as a Condition penalty
  // to Stealth, Acrobatics, Climb, and Swim checks." Stealth and Acrobatics are applied here,
  // typed Condition as the book says. Climb and Swim are Athletics checks the engine cannot tell
  // from a grapple or a tumble, so the dialog offers the penalty on an Athletics check instead
  // (prompt). Until 0.6.0 every Might or Agility check took it, and Evade did too. An Initiative
  // rolled with Stealth (Avoid Notice) is a Stealth check and takes it too (ruling 111, 0.7.4).
  if (asCheck && (SW.STRAIN_CHECKS[cfg.slug] === "always") && sys.loadStrain) {
    parts.push({ label: game.i18n.localize("STARWROUGHT.Field.loadStrain"), value: -sys.loadStrain, type: SW.STRAIN_TYPE });
  }

  // The Automation rules (0.10.0; rulings 122 and 124): every registered kind with a `modifiers`
  // hook is asked once, with the roll's kind, the Constellation supplying the Proficiency Bonus
  // and the Item behind the roll (a Maneuver, a weapon, a Talent, or null). What a kind applies
  // joins the typed stack here, so Humanity's +1 Condition to Aid resolves against Frightened as
  // the book says it should; what a kind only offers (a bonus to a Maneuver on a check made
  // without that Maneuver's Item) waits on `cfg.ruleOffers` for the dialog, unticked, and is
  // never applied unasked. A kind that throws contributes nothing and the roll goes on; the
  // dispatcher in ../rules/engine.mjs holds that fence, not this file.
  // Since 0.13.0 the context also carries the roll's own rank (`IF(Rank=Untrained)`), the Threat it
  // answers when it does, where the tokens stand and which round it is, so every operator can be
  // read; the marks a FIRST or ONCE asks for wait on `cfg.ruleMarks` for SwCheck.roll to write
  // once the die has landed (a preview writes none).
  const { applied, offered, marks } = ruleModifiers(actor, {
    kind: cfg.kind, slug: cfg.slug ?? "", item: cfg.item ?? null, rank: cfg.rank ?? "untrained",
    threat: cfg.threat ?? null, other: otherOf(cfg), scene: sceneContextFor(actor, cfg.token ?? null), encounter: encounterContext(),
    // The tracker's own Initiative die (0.22.0): a total nothing is written after.
    leavePending: cfg.leavePending === true
  });
  parts.push(...applied);
  cfg.ruleOffers = offered;
  cfg.ruleMarks = marks;

  return parts;
}
