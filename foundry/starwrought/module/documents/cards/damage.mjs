/**
 * The damage cards' buttons: Critical / Hit / Graze on an attack card rolls damage; the damage
 * card's Apply row spends it on the creature the card names, on this client when it may write that
 * creature and over the system socket on the active GM's client when it may not (0.5.3; Mike:
 * "when I roll damage on my target, it damages me instead"); and the applied card says what the
 * body felt. The GM's half reads everything that matters from the message itself and the asker
 * from the server's stamp, as the attack flow does. Through 0.10.0 this lived in documents/chat.mjs.
 */

import * as SW from "../../config.mjs";
import { SwDamage } from "../../dice/damage.mjs";
import { resolveActor, resolveTargets, SOCKET, replyTo } from "./shared.mjs";

const MULTIPLIERS = [1, 0.5, -1];
const REFUSALS = {
  noCard: "STARWROUGHT.Notify.damageRefusedNoCard",
  notYours: "STARWROUGHT.Notify.damageRefusedNotYours",
  noTarget: "STARWROUGHT.Notify.damageRefusedNoTarget"
};

/** The attack card's Critical / Hit / Graze buttons. The Strike kind rides along from the card. */
export async function rollDamageFromCard(message, flags, outcome) {
  const actor = await fromUuid(flags.actorUuid);
  const doc = actor?.actor ?? actor;
  if (!doc) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
  if (!doc.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
  // A spell's card (PHB v4.21): the spell's dice, not a weapon's.
  if ((flags.source === "spell") && flags.spellId) {
    const talent = doc.items.get(flags.spellId);
    if (!talent) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noItem"));
    return SwDamage.rollSpell({ actor: doc, talent, outcome, cast: flags.cast ?? SW.DEFAULT_CAST, targetUuid: flags.targetUuid ?? "" });
  }
  const weapon = doc.items.get(flags.weaponId);
  if (!weapon) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noWeapon"));
  return SwDamage.roll({
    actor: doc, weapon, outcome,
    strike: flags.strike ?? SW.DEFAULT_STRIKE,
    // The Proficiency the attack rolled (Melee or Ranged) and its rank decide the dice (PHB v4.21).
    slug: flags.slug ?? "",
    rank: flags.rank ?? null,
    thrown: !!flags.thrown,
    targetUuid: flags.targetUuid ?? ""
  });
}

/**
 * The damage card's Apply row. The card names the creature it was rolled against, and that is who
 * takes the damage (0.5.3; Mike: "when I roll damage on my target, it damages me instead"): this
 * client spends it when it may write the actor, and otherwise asks the active GM's client to, over
 * the system socket, since a player's Strike nearly always lands on an adversary the player cannot
 * write. Shift-click spends it on the selected tokens instead: the GM's redirect, or a player
 * taking an adversary's blow on themselves. A card with no target (damage rolled from the sheet
 * with nothing targeted) falls back to the selection, then to the user's targets. The old order,
 * selection first, put a player's own blow on their own selected token, which a player who has
 * just Struck always has.
 */
export async function applyDamageFromCard(message, flags, button, event) {
  const multiplier = Number(button.dataset.multiplier ?? 1);
  const card = button.closest(".starwrought.damage-card");
  const zone = card?.querySelector("select[name='zone']")?.value ?? SW.DEFAULT_ZONE;

  let targets;
  if (event?.shiftKey) targets = resolveTargets("");
  else if (flags.targetUuid) {
    const named = resolveActor(flags.targetUuid);
    if (!named) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.targetGone"));
    if (!named.isOwner) return relayDamage(message, named, { zone, multiplier });
    targets = [named];
  } else targets = resolveTargets("");
  if (!targets.length) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));

  for (const actor of targets) await applyCard(actor, flags, { zone, multiplier });
}

/** Spend one damage card on one Actor, and post what the body felt. */
async function applyCard(actor, flags, { zone, multiplier }) {
  const result = await SwDamage.apply(actor, {
    base: flags.base,
    deadly: flags.deadly,
    type: flags.damageType,
    zone,
    critical: flags.critical,
    graze: flags.graze,
    strike: flags.strike ?? SW.DEFAULT_STRIKE,
    armorPiercing: flags.armorPiercing,
    massive: !!flags.massive,
    nonlethal: !!flags.nonlethal,
    multiplier,
    // How the damage arrives (PHB v4.21): a weapon's Strike is Zoned; a spell's card says.
    delivery: flags.delivery === "pervasive" ? "pervasive" : "zoned"
  });
  await postDamageSummary(actor, result, multiplier);
  return result;
}

/** A short card saying what the body actually felt. */
async function postDamageSummary(actor, result, multiplier) {
  const { renderTemplate } = foundry.applications.handlebars;
  const content = await renderTemplate("systems/starwrought/templates/chat/applied-card.hbs", {
    actor,
    result,
    healing: multiplier < 0,
    zoneLabel: result.zone ? game.i18n.localize(SW.ZONES[result.zone]?.label ?? "") : "",
    critEffect: result.critEffect ? game.i18n.localize(result.critEffect) : "",
    wound: result.wound ?? null,
    woundCapacity: result.wound ? actor.woundCapacity(result.zone) : 0
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: actor.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
  });
}

/* -------------------------------------------- */
/*  Over the socket (0.5.3)                     */
/* -------------------------------------------- */

/**
 * Ask the active GM's client to spend a damage card on a creature this client cannot write. The
 * request carries the card's id and the two things the clicker chose, the Zone and the multiplier;
 * the GM's client reads everything else (who was hit, the totals, the Strike) from the message
 * itself, and who is asking from the server's stamp on the socket event, as the attack flow does.
 */
function relayDamage(message, target, { zone, multiplier }) {
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.noGmToApply", { name: target.name }));
  game.socket.emit(SOCKET, { type: "damage:apply", to: gm.id, messageId: message.id, zone, multiplier }, { recipients: [gm.id] });
  return ui.notifications.info(game.i18n.format("STARWROUGHT.Notify.damageSent", { name: target.name }));
}

/**
 * The `damage:*` half of the system socket (0.5.3), routed here by `onChatSocket`: a `damage:apply`
 * is answered by the GM's client with `damage:applied` or `damage:refused`, addressed to the asker
 * alone; the other two are the asker's client hearing the answer.
 * @param {object} message
 * @param {string|null} sender  The emitting user's id, from the server's stamp; null when unknown.
 */
export async function onDamageSocket(message, sender) {
  switch (message.type) {
    case "damage:apply": {
      if (!sender || !game.user.isGM) return;
      return replyTo(sender, message.messageId, await applyDamageForUser(message, sender));
    }
    case "damage:applied":
      ui.notifications.info(game.i18n.format("STARWROUGHT.Notify.damageApplied", { name: message.name ?? "" }));
      return;
    case "damage:refused":
      ui.notifications.warn(game.i18n.localize(REFUSALS[message.reason] ?? "STARWROUGHT.Notify.damageRefused"));
      return;
    default:
      return;
  }
}

/**
 * Spend a damage card for another user, on the GM's client. The asker must have rolled it (the
 * card's author) or own the attacker; the creature is the one the card names, never one the
 * request names; the Zone is held to what the Strike allows (a Quick Strike lands on the Torso and
 * nowhere else) and the multiplier to the three buttons.
 */
async function applyDamageForUser(request, userId) {
  const chat = game.messages.get(request.messageId);
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || (flags?.kind !== "damage")) return { type: "damage:refused", reason: "noCard" };
  const user = game.users.get(userId);
  const attacker = resolveActor(flags.actorUuid);
  const may = (chat.author?.id === userId) || (!!attacker && !!user && attacker.testUserPermission(user, "OWNER"));
  if (!may) return { type: "damage:refused", reason: "notYours" };
  const target = resolveActor(flags.targetUuid);
  if (!target?.isOwner) return { type: "damage:refused", reason: "noTarget" };

  const asked = String(request.zone ?? "");
  let zone = (asked in SW.ZONES) ? asked : SW.DEFAULT_ZONE;
  const kind = SW.STRIKE_KINDS[flags.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  if (!flags.graze && !flags.critical && !kind.placeOnExposed) zone = SW.DEFAULT_ZONE;
  const multiplier = MULTIPLIERS.includes(Number(request.multiplier)) ? Number(request.multiplier) : 1;
  await applyCard(target, flags, { zone, multiplier });
  return { type: "damage:applied", name: target.name };
}
