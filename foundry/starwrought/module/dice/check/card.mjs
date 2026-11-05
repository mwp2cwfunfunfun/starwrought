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

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Post the card. One renderer for every check card: `roll()` and `resolveAgainst` both come
 * through here, so an attack resolved by the coordinator is the very card an immediate attack
 * posts, with the same content, flags and buttons (0.5.0 brief).
 */
export async function toMessage(result) {
  const cfg = result.config;
  const isExchange = ["attack", "defense"].includes(cfg.kind);
  const position = isExchange ? settlePosition(cfg, result) : null;

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
  const canDamage = !!result.outcome?.damage && (!!cfg.weaponId || spellDamages);
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
    // Why the defender answered with a Defense other than their stance, if they did. The card is
    // where the answer is revealed, so this is where the reason belongs.
    defenseNote: cfg.defenseNote ?? "",
    rangeNote: cfg.rangeNote ?? "",
    // The Reaction behind the Defense: the roller's own on a Defense card, the defender's stance
    // on an attack card. The ❶ is charged to the defender when the attack resolves; when the
    // rolling client does not own them, the card offers the button to whoever does.
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
  // new card lists them), the adversary's attack row behind a Defense card (its Threshold is
  // read again, on the GM's client), and which card this one replaced, and why.
  if (isExchange) {
    flags.modifiers = (result.modifiers ?? []).map(m => ({ label: m.label, value: m.value, type: m.type ?? null }));
    flags.attackId = cfg.attackId ?? null;
    if (cfg.rerollOf) {
      flags.rerollOf = cfg.rerollOf;
      flags.rerollReason = cfg.rerollReason ?? "";
    }
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
