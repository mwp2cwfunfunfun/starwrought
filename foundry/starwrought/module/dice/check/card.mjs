/**
 * The check card: one renderer for every result, its render context, and the flags every card button rebuilds its state from.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. `toMessage` is what `roll` and `resolveAgainst` both end in, so a coordinator-resolved attack is the very card an immediate one posts.
 */

import * as SW from "../../config.mjs";
import { strikeCanCrit } from "./strike.mjs";
import { position as settlePosition } from "./position.mjs";
import { substitutionLine } from "./modifiers.mjs";
import { immunityRecord } from "../../rules/prevent.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/** An Actor by a uuid a card carries (a token's, or an Actor's own), or null. */
function actorOf(uuid) {
  if (!uuid) return null;
  try {
    const doc = fromUuidSync(uuid);
    return doc?.actor ?? ((doc?.documentName === "Actor") ? doc : null);
  } catch {
    return null;
  }
}

/**
 * IS THE CREATURE THIS CARD NAMES IMMUNE TO WHAT WAS USED ON IT (0.35.0; rulings 353, 354, 358)?
 * A Condition's row may say `[EFFECT IMMUNE: TRAIT(Visual)]` (Blinded), and the system says it and
 * goes on (Mike): the card says the target is immune, and nothing the roll does lands on it.
 *
 * Asked HERE, as the card is posted, so every card says it from the creature as it stands at
 * that moment: a direct roll, the roll that answers a request, a reroll, and the result card of
 * an adversary's Maneuver all come through `toMessage`, and none of them hands a note along.
 *
 *  - An attack's or a Defense's card (the attack flow): the coordinator asked as it resolved the
 *    pairing and handed the answer in as `cfg.immune` (a reroll hands back the one its card kept).
 *  - A player's Defense rolled for an adversary's Maneuver (`check.inverted`): the ROLLER is who
 *    the Maneuver would land on; its traits are the roll's Threat's.
 *  - A check made from a Maneuver with one creature named (the Defense it was read against, the
 *    target of its APPLY lines, the ally its result is given to): that creature, and the
 *    Maneuver's own traits with those of a Maneuver it is performed as part of.
 *
 * @returns {{targetUuid: string, target: string, traits: string, by: string, note: string}|null}
 */
function immunityOf(cfg, isExchange) {
  if (isExchange) return (cfg.immune && (typeof cfg.immune === "object")) ? cfg.immune : null;
  if (cfg.kind !== "check") return null;
  let target = null;
  let name = "";
  let traits = [];
  let other = null;
  if (cfg.checkRequest?.inverted) {
    target = cfg.actor;
    name = cfg.actor?.tokenOnScene?.()?.name ?? cfg.actor?.name ?? "";
    traits = itemTraitsOf(cfg);
    other = cfg.targetActor ?? actorOf(cfg.checkRequest.userUuid);
  } else if (cfg.item?.type === "action") {
    traits = itemTraitsOf(cfg);
    // (`given.ally` is the same ally as the roll's own `ally`, kept on the card: a reroll has only that.)
    const ally = cfg.ally ?? cfg.given?.ally ?? null;
    // `usedOn` is the token targeted at the use (documents/item.mjs), which a Maneuver with a
    // typed Threshold and no line about a target would otherwise leave unnamed on its card.
    const usedOn = cfg.usedOn ?? null;
    target = cfg.targetActor ?? actorOf(cfg.targetUuid) ?? actorOf(usedOn?.uuid) ?? actorOf(cfg.applied?.target?.uuid) ?? actorOf(ally?.uuid);
    name = cfg.targetName || usedOn?.name || cfg.applied?.target?.name || ally?.name || target?.name || "";
    other = cfg.actor;
  }
  if (!target || (target === other) || !traits.length) return null;
  return immunityRecord(target, name, traits, { other });
}

/**
 * The traits of the Maneuver behind a check: the ones its caller handed over (its own with its
 * parent's, when it is performed as part of one; a reroll's, from the first card), else the
 * Item's own. On a player's Defense rolled for an adversary's Maneuver there is no Item on the
 * roll: the Maneuver's traits are the roll's Threat's.
 */
function itemTraitsOf(cfg) {
  if (Array.isArray(cfg.itemTraits)) return cfg.itemTraits;
  if (cfg.checkRequest?.inverted) return [...(cfg.threat?.traits ?? [])];
  return (cfg.item?.type === "action") ? [...(cfg.item.system?.traits ?? [])] : [];
}

/**
 * Post the card. One renderer for every check card: `roll()` and `resolveAgainst` both come
 * through here, so an attack resolved by the coordinator is the very card an immediate attack
 * posts, with the same content, flags and buttons (0.5.0 brief).
 */
export async function toMessage(result) {
  const cfg = result.config;
  const isExchange = ["attack", "defense"].includes(cfg.kind);
  const position = isExchange ? settlePosition(cfg, result) : null;
  // Immunity to a trait (0.35.0): read once, for the note the card prints and the flag it keeps.
  cfg.immunity = immunityOf(cfg, isExchange);

  const content = await renderTemplate(
    "systems/starwrought/templates/chat/check-card.hbs",
    await cardContext(result, position)
  );

  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor: cfg.speakerActor ?? cfg.actor }),
    content,
    rolls: [result.roll],
    flags: { starwrought: cardFlags(result, position) }
  };
  // v14 renamed applyRollMode to applyMode and the modes to "public", "gm", "blind", "self";
  // the dialog still speaks the legacy keys, which core's own mapper translates. The old call
  // remains for a v13 world (review, 2026-10-01).
  if (typeof ChatMessage.applyMode === "function") {
    const mode = foundry.dice.Roll._mapLegacyRollMode?.(cfg.rollMode) ?? cfg.rollMode;
    ChatMessage.applyMode(messageData, mode);
  } else {
    ChatMessage.applyRollMode(messageData, cfg.rollMode);
  }
  result.message = await ChatMessage.create(messageData);
}

/** The render context of templates/chat/check-card.hbs for a result. */
export async function cardContext(result, position) {
  const cfg = result.config;
  const item = cfg.item;
  const isExchange = ["attack", "defense"].includes(cfg.kind);

  const enrich = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(
    html ?? "", { rollData: cfg.actor.getRollData(), relativeTo: item }
  );

  const isSpell = cfg.source === "spell";
  const strikeKind = (isExchange && !isSpell) ? SW.STRIKE_KINDS[cfg.strike] : null;
  const castKind = isSpell ? (SW.CAST_KINDS[cfg.cast] ?? null) : null;
  const reaction = cfg.reaction ? SW.REACTIONS[cfg.reaction] : null;
  // A Posture stands where a Reaction would on the card: "{name} ⓿↺ (Expose {zone})". The two
  // never answer the same Blow together, so the slot is one or the other.
  let postureLabel = "";
  if (!reaction && cfg.posture?.talentId) {
    const name = cfg.posture.name ?? game.i18n.localize("STARWROUGHT.Reaction.posture");
    postureLabel = SW.ZONES[cfg.posture.zone]
      ? game.i18n.format("STARWROUGHT.Attack.answerPosture", { name, zone: game.i18n.localize(SW.ZONES[cfg.posture.zone].label) })
      : `${name} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`;
  }

  // Which damage buttons the attacker gets: a Quick Strike that cannot crit has no Critical. A
  // spell's card (PHB v4.21) offers them when the spell rolls a die; a Quick Cast's Graze deals
  // nothing unless the spell says so, so its Graze button is left off.
  const spellDamages = isSpell && !!item?.system?.spell?.die;
  // A defender immune to the attack's trait takes no damage from it (0.35.0, ruling 355): the
  // outcome stands as rolled, and the card offers no damage to roll.
  const canDamage = !!result.outcome?.damage && (!!cfg.weaponId || spellDamages) && !cfg.immunity;
  const damageButtons = canDamage ? ["critical", "hit", "graze"]
    .filter(key => (key !== "critical") || strikeCanCrit(cfg.strike, item))
    .filter(key => (key !== "graze") || !isSpell || !!castKind?.grazeDie)
    .map(key => ({ key, label: `STARWROUGHT.Outcome.${key}`, primary: key === result.outcome.key }))
    : [];

  return {
    label: cfg.label,
    subtitle: cfg.subtitle ?? "",
    kind: cfg.kind,
    actor: cfg.actor,
    item,
    itemDescription: item ? await enrich(item.system.chatDescription) : "",
    // An action authored with separate flavour and rules prints both, flavour first, as the
    // item card does.
    itemFlavor: (item?.type === "action" && item.system.effect && item.system.description)
      ? await enrich(item.system.description)
      : "",
    total: result.total,
    formula: result.roll.formula,
    natural: result.natural,
    threshold: result.threshold,
    thresholdLabel: result.thresholdLabel,
    modifiers: result.modifiers,
    // A check made with other terms (0.21.0, ruling 216): the swap in words, under the modifiers.
    // The rows above already read "Presence +2" and "Origin (Trained) +3", but a term of +0 is
    // left out of them, so the note is what says a swap stood and what it replaced.
    substituteNote: cfg.substituted ? game.i18n.format("STARWROUGHT.Roll.substituteNote", { line: substitutionLine(cfg.substituted) }) : "",
    degree: result.degree,
    degreeLabel: result.degree ? game.i18n.localize(SW.DEGREES[result.degree].label) : "",
    outcome: result.outcome ? game.i18n.localize(result.outcome.label) : "",
    outcomeKey: result.outcome?.key ?? "",
    isAttack: isExchange,
    canDamage,
    damageButtons,
    weaponId: cfg.weaponId ?? "",
    targetUuid: cfg.targetUuid ?? "",
    strike: (isExchange && !isSpell) ? cfg.strike : "",
    strikeLabel: strikeKind ? game.i18n.localize(strikeKind.label) : (castKind ? game.i18n.localize(castKind.label) : ""),
    strikeGlyph: strikeKind ? SW.ACTION_GLYPHS[strikeKind.cost] : (castKind ? SW.ACTION_GLYPHS[castKind.cost] : ""),
    critDenied: result.critDenied,
    // Why the defender answered with a Defense other than the one they named (Evade while
    // Grabbed), if they did. The card is where the answer is revealed, so the reason belongs here.
    defenseNote: cfg.defenseNote ?? "",
    // A check read against the one Defense its row names, which the target cannot use now
    // (0.34.0): said whether or not the Threshold itself is printed.
    targetNote: cfg.targetNote ?? "",
    // The creature this was used on is immune to it (0.35.0): said, and nothing lands on it.
    immuneNote: cfg.immunity?.note ?? "",
    rangeNote: cfg.rangeNote ?? "",
    // The Zone the attacker's Control held open (0.27.0): the Bind ended as the attack resolved,
    // and this attack's damage may still be placed there.
    controlZoneNote: (isExchange && cfg.controlZone && result.outcome?.damage && !cfg.immunity)
      ? game.i18n.format("STARWROUGHT.Bind.controlZoneNote", {
        name: cfg.controlZoneName ?? "", zone: game.i18n.localize(SW.ZONES[cfg.controlZone].label)
      })
      : "",
    // The Reaction behind the Defense: the roller's own on a Defense card, the defender's
    // committed one on an attack card. The ❶ is charged to the defender when the attack resolves;
    // when the rolling client does not own them, the card offers the button to whoever does.
    reaction: cfg.reaction ?? "",
    reactionLabel: reaction
      ? `${game.i18n.localize(reaction.label)} ${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`
      : postureLabel,
    reactionNote: cfg.reactionNote ?? "",
    reactionDue: !!reaction && !cfg.reactionCharged && (cfg.kind === "attack") && !!position?.defenderUuid,
    position,
    outcomes: cfg.outcomes ?? null,
    // A Constellation Flares on a Critical Success or Critical Failure on a roll with
    // consequences, directly related to a Talent in it. The die can tell us the first half;
    // which Constellation it was related to is the table's call, so the button asks.
    canFlare: canFlare(result, cfg),
    flareSlug: cfg.slug ?? "",
    flareName: cfg.slug ? SW.getConstellation(cfg.slug).name : "",
    // Reroll (0.5.3): offered on every Attack and Defense card to the roller's owner and the GM;
    // a card that is itself a reroll says so, and why.
    canReroll: isExchange,
    reroll: cfg.rerollOf ? { reason: cfg.rerollReason ?? "" } : null
  };
}

/**
 * The `flags.starwrought` a check card carries. Every card button rebuilds its state from these
 * after a reload (chat.mjs), so the sixteen keys are a contract: none is renamed or dropped. A
 * Posture, when one answered, is a seventeenth key the attack flow's card reads.
 */
export function cardFlags(result, position) {
  const cfg = result.config;
  const isExchange = ["attack", "defense"].includes(cfg.kind);
  const flags = {
    kind: cfg.kind,
    degree: result.degree,
    outcome: result.outcome?.key ?? null,
    actorUuid: cfg.actor.uuid,
    itemUuid: cfg.item?.uuid ?? null,
    weaponId: cfg.weaponId ?? null,
    targetUuid: cfg.targetUuid ?? null,
    threshold: result.threshold,
    strike: isExchange ? (cfg.strike ?? null) : null,
    // A spell's Cast (PHB v4.21): the Talent and the commitment, so the damage buttons roll the
    // spell's dice rather than a weapon's.
    source: cfg.source ?? null,
    spellId: cfg.spellId ?? null,
    cast: cfg.cast ?? null,
    // The Proficiency rolled (melee or ranged) and the rank it rolled at (Handling applied), so
    // the damage card rolls the right dice (PHB v4.21: dice by rank).
    slug: cfg.slug ?? null,
    rank: cfg.rank ?? null,
    // The Attribute rolled (0.21.0): the check's own, or the one a swap put in its place.
    attribute: cfg.substituted?.attribute ?? cfg.attribute ?? null,
    thrown: !!cfg.thrown,
    defense: cfg.defense ?? null,
    reaction: cfg.reaction ?? null,
    reactionCharged: !!cfg.reactionCharged,
    attackerUuid: position?.attackerUuid ?? null,
    defenderUuid: position?.defenderUuid ?? null
  };
  if (cfg.posture?.talentId) {
    flags.posture = { talentId: cfg.posture.talentId, name: cfg.posture.name ?? "", zone: cfg.posture.zone ?? null };
  }
  // Rerolls (0.5.3) throw the same die again from the card alone, so the card keeps what a
  // reroll needs and the contract above does not carry: the applied modifiers by name (the
  // new card lists them; since 0.15.0 on every card, since a `reroll` rule throws a check's die
  // again too), the adversary's attack row behind a Defense card (its Threshold is read again, on
  // the GM's client), the pairing's own modifiers (0.15.0, ruling 175), and which card this one
  // replaced, and why.
  // `given` (0.25.0): a modifier that was a result a Maneuver gave the roller names that Maneuver,
  // so the card knows its roll used the result up (Pay It Forward's button is offered on it).
  flags.modifiers = (result.modifiers ?? []).map(m => ({
    label: m.label, value: m.value, type: m.type ?? null,
    ...(m.source ? { source: m.source } : {}),
    ...(m.given ? { given: String(m.given) } : {}),
    // Which result it was: the id of the card whose check gave it.
    ...(m.givenFrom ? { givenFrom: String(m.givenFrom) } : {})
  }));
  if (cfg.rerollOf) {
    flags.rerollOf = cfg.rerollOf;
    flags.rerollReason = cfg.rerollReason ?? "";
  }
  // Immunity to a trait (0.35.0): who was immune when the card was posted, to what, and by what.
  // A reroll of an attack's card hands it back; the write of an Effect asks again for itself.
  if (cfg.immunity) flags.immune = { ...cfg.immunity };
  if (isExchange) {
    flags.attackId = cfg.attackId ?? null;
    if (Array.isArray(cfg.pairingModifiers) && cfg.pairingModifiers.length) flags.pairingModifiers = cfg.pairingModifiers;
    // What the attack kept of a Bind it ended (0.27.0, ruling 276): the Zone its Control held
    // open on this defender, which this card's damage may still be placed on, and whether the
    // attack was made with a Controlled implement (a reroll of a Defense card reads the
    // adversary's Threshold with it). Always written, so a reroll can tell "no" from "not said".
    flags.controlZone = cfg.controlZone ?? null;
    flags.controlledAttack = !!cfg.controlledAttack;
    // What a reroll must meet again (0.33.0, ruling 335): the Threat answered, and the total the
    // Conditions of the adversary on the other side put on the Threshold the die was read against.
    if (cfg.threat && (typeof cfg.threat === "object")) {
      flags.threat = { threat: cfg.threat.threat ?? null, melee: !!cfg.threat.melee, traits: [...(cfg.threat.traits ?? [])] };
    }
    if (Number.isFinite(cfg.conditionShift)) flags.conditionShift = cfg.conditionShift;
  }
  // A check's own extras and the Threshold it was withheld (0.15.0): a reroll of the check keeps
  // its formula and reads the Threshold again from the target when the card could not print it.
  if (!isExchange) {
    // A check made with other terms (0.21.0): the record of the swap that stood. `slug` above is
    // still the check's own Constellation (the Flare button names it); `rank` is the rank rolled,
    // the borrowed Constellation's; this says which rule swapped which term for what.
    if (cfg.substituted) flags.substituted = cfg.substituted;
    // What this Maneuver's check gives another character (0.22.0): the results by degree at the
    // rank rolled, the Talents that changed them, the Maneuver, the ally targeted and the Combat.
    // The render pass draws the give button from it (documents/cards/give.mjs), and a reroll
    // copies it across, since the table already holds every degree.
    if (cfg.given?.table) flags.given = cfg.given;
    // What this Maneuver puts on a creature, and takes off (0.32.0): every APPLY and REMOVE line
    // of its row at the rank rolled, each with the degree and the cost it waits on, the cost this
    // use was paid at, the creature targeted and the Combat. documents/cards/apply.mjs applies the
    // roller's own from it and draws the button for a target's; a reroll copies it across.
    if (cfg.applied?.lines?.length) flags.applies = cfg.applied;
    // The traits of the Maneuver behind the check (0.35.0), with its parent's when it is performed
    // as part of one: the one writer of an Effect or a given result asks a recipient's immunity
    // with these, on its own client, with no Item to find.
    const itemTraits = itemTraitsOf(cfg);
    if (itemTraits.length) flags.itemTraits = itemTraits;
    // The creature the Maneuver was used on (0.35.0), for a reroll's card to ask about again.
    if (cfg.usedOn?.uuid) flags.usedOn = { uuid: String(cfg.usedOn.uuid), name: String(cfg.usedOn.name ?? "") };
    // A Gain Control (0.27.0): the Bind it was rolled for, the two fighters, the side of the one
    // who used it before the roll, and whether the degree is read from the other side (an
    // adversary's, rolled as the partner's Guard). documents/cards/gain-control.mjs draws the
    // result and its button from this and the Bind as it stands; a reroll copies it.
    if (cfg.gainControl) flags.gainControl = cfg.gainControl;
    // A check that answers a request (0.34.0; documents/cards/check-request.mjs): `from` names the
    // request card, so one request gives one roll; `inverted` with `defense`, `userUuid`,
    // `itemUuid` and `slug` on a player's Defense rolled for an adversary's Maneuver, whose degree
    // is read from the other side; `resultOf` on the Maneuver's result card, naming that roll.
    if (cfg.checkRequest && (typeof cfg.checkRequest === "object")) flags.check = { ...cfg.checkRequest };
    if (cfg.withholdThreshold === true) flags.withheldThreshold = true;
    if (cfg.targetDefenseKey) flags.targetDefense = cfg.targetDefenseKey;
    if (cfg.rerollOf) flags.rerollRule = cfg.rerollRule ?? null;
  }
  return flags;
}

/**
 * Was this a critical, on a character who can hold a Flare? The universal trigger also wants
 * the roll to have consequences, which no die can tell us, so the button is an offer.
 */
function canFlare(result, cfg) {
  if (!game.settings.get(SW.SYSTEM_ID, "offerFlares")) return false;
  if (cfg.actor?.type !== "character") return false;
  // A Defense roll's degree is written from the attacker's side, so read the defender's own.
  // A denied critical (a Quick Strike's natural 20) was still a critical on the die.
  let own = cfg.kind === "defense" ? SW.invertDegree(result.degree) : result.degree;
  if (result.critDenied) own = "critSuccess";
  return ["critSuccess", "critFail"].includes(own);
}
