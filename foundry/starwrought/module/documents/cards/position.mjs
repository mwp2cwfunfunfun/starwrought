/**
 * The Position buttons (PHB v4.10, The Exchange, step 5): a Stopped blow carried through to a Zone
 * Exposed, a Bind formed or Control taken, ground given, a Step, the defender's Counter or riposte,
 * a Reaction charged after the fact, and Recenter. The choice is often one side's and the body the
 * other's, so an Expose the clicker cannot write goes to the GM's client over the system socket
 * (0.5.3; Mike: "it gave an error saying he could not expose my zone because my character is not
 * owned by him"). Through 0.10.0 this lived in documents/chat.mjs.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { resolveActor, resolveTokenDoc, ownedActor, zoneFrom, resolveTargets, SOCKET, replyTo } from "./shared.mjs";

/**
 * Expose a Zone on an actor from a card: the attacker after a Miss or a Weighted Graze (the
 * defender's choice of Zone), or the defender after a Committed Hit or a Deliberate Critical Hit
 * (the attacker's choice of a plausible Zone). The Zone comes from the widget's own select.
 *
 * The choice is one side's and the body is the other's, so the clicker usually cannot write the
 * actor the Zone opens on (a player's Committed Hit on another player, or on an adversary). The
 * GM's client does it then, asked over the system socket as Apply is (0.5.3; Mike: "it gave an
 * error saying he could not expose my zone because my character is not owned by him"). The widget's
 * `data-owner-uuid` names the side the choice belongs to; the GM's client checks the asker owns it.
 */
export async function exposeFromCard(message, flags, button) {
  const zone = zoneFrom(button);
  const named = resolveActor(button.dataset.actorUuid ?? button.dataset.targetUuid);
  const targets = named ? [named] : resolveTargets("");
  if (!targets.length) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));
  const chooser = resolveActor(button.closest("[data-owner-uuid]")?.dataset.ownerUuid);
  for (const actor of targets) {
    if (actor.isOwner) await exposeAndSay(actor, zone);
    else await relayExpose(message, { actor, chooser, zone });
  }
}

/** Open a Zone and say so: the Exposed card, whose title opens the rules page (0.5.1, T6). */
async function exposeAndSay(actor, zone) {
  await actor.setExposed(zone, true, { announced: true });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="starwrought action-card sw-exposed-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="Exposed" data-tooltip="STARWROUGHT.Rules.openExposed"><i class="fa-solid fa-bullseye"></i> ${
      game.i18n.localize("STARWROUGHT.Condition.exposed")}</a></h3>
      <p>${game.i18n.format("STARWROUGHT.Position.exposedText", {
        name: actor.name, zone: game.i18n.localize(SW.ZONES[zone].label)
      })}</p></div>`
  });
}

/**
 * Ask the GM's client to open a Zone on a body this client cannot write, on a card that gives
 * this client's side the choice. Without a GM, or without owning the choosing side, the old
 * notice stands: the body's owner marks it.
 */
async function relayExpose(message, { actor, chooser, zone }) {
  if (!chooser?.isOwner || !message) {
    return ui.notifications.warn(game.i18n.format("STARWROUGHT.Position.notOwnedExpose", { name: actor.name }));
  }
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn(game.i18n.format("STARWROUGHT.Position.noGmToExpose", { name: actor.name }));
  game.socket.emit(SOCKET, {
    type: "expose:apply", to: gm.id, messageId: message.id, actorUuid: actor.uuid, chooserUuid: chooser.uuid, zone
  }, { recipients: [gm.id] });
  return ui.notifications.info(game.i18n.format("STARWROUGHT.Position.exposeSent", {
    name: actor.name, zone: game.i18n.localize(SW.ZONES[zone].label)
  }));
}

/**
 * Form a Bind, or take Control of the attacking weapon. The defender is the one who Guarded, so
 * the defender's owner clicks; the attacker's side is mirrored when this client owns it too.
 * Taking Control also opens a Zone of the Controller's choice on the partner, while it lasts.
 */
export async function formBindFromCard(message, flags, button) {
  const defender = ownedActor(button, "controllerUuid");
  if (!defender) return;
  const partner = resolveActor(button.dataset.partnerUuid);
  if (!partner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));
  // A card can name the same creature twice (a linked actor's token striking another of its
  // tokens); a Bind is between two fighters, so there is nothing to form.
  if (partner === defender) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.samePartner"));
  const control = button.dataset.mode === "control";
  const bind = await defender.formBind(partner, {
    state: control ? "controlling" : "neutral",
    mine: button.dataset.mine ?? "",
    theirs: button.dataset.theirs ?? ""
  });
  // formBind returns the recorded side, or null when it could not form one; say so rather than
  // leaving the player to find out from the sheet (0.5.1, T4).
  if (!bind?.state) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.notFormed"));
  if (!control) return;

  // "Your partner has an Exposed Zone of your choice, and it stays Exposed while the Bind lasts."
  // The partner is usually not this client's to write; the GM's client opens the Zone (0.5.3).
  const options = Object.entries(SW.ZONES)
    .map(([key, z]) => `<option value="${key}" ${key === SW.DEFAULT_ZONE ? "selected" : ""}>${game.i18n.localize(z.label)}</option>`)
    .join("");
  const zone = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Bind.takeControl"), icon: "fa-solid fa-link" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.format("STARWROUGHT.Bind.exposePrompt", { partner: partner.name })}</p>
      <select name="zone" style="width: 100%">${options}</select>`,
    ok: {
      label: game.i18n.localize("STARWROUGHT.Condition.exposed"),
      callback: (event, target) => target.form.elements.zone.value
    },
    rejectClose: false
  });
  if (!zone || !(zone in SW.ZONES)) return;
  if (partner.isOwner) await exposeAndSay(partner, zone);
  else await relayExpose(message, { actor: partner, chooser: defender, zone });
}

/** An Evade that Grazed gives 3 feet of ground, directly away from the attacker. */
export async function giveGroundFromCard(button) {
  const defender = ownedActor(button);
  if (!defender) return;
  const attackerToken = resolveTokenDoc(button.dataset.attackerTokenUuid || button.dataset.attackerUuid);
  if (!attackerToken) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noToken"));
  const feet = Number(button.dataset.feet) || SW.GIVE_GROUND_FEET;
  return defender.giveGround(attackerToken, feet);
}

/**
 * A Step granted by the exchange, or a Slip the Line's Move to any space adjacent to the attacker
 * (PHB v4.21; `data-mode="adjacent"`): announced, and the player moves the token.
 */
export async function stepFromCard(button) {
  const actor = ownedActor(button);
  if (!actor) return;
  return actor.announceStep({ adjacent: button.dataset.mode === "adjacent" });
}

/**
 * The defender's Quick Strike back: the Riposte after a Parry Stopped the Strike (⓿; PHB v4.21, a
 * Guard Talent). It declares into the attack flow like any Blow (0.12.0, ruling 161), answered by
 * the original attacker's basic Defense alone. The weapon is the melee weapon in hand that sets
 * the defender's Total Reach; with none in hand there is nothing to strike with.
 */
export async function reactionStrikeFromCard(button, reaction) {
  const actor = ownedActor(button);
  if (!actor) return;
  const weapon = actor.system.reachWeapon
    ?? actor.items.find(i => (i.type === "weapon") && i.system.held && !i.system.isRanged)
    ?? actor.items.find(i => (i.type === "weapon") && i.system.held);
  if (!weapon) return ui.notifications.warn(game.i18n.format("STARWROUGHT.Reaction.noWeapon", { name: actor.name }));
  return actor.rollAttack(weapon.id, {
    reaction,
    targetUuid: button.dataset.targetUuid || ""
  });
}

/**
 * Charge the defender's Reaction from the card, when the attacker's client could not: the ❶↺
 * comes off the defender's six.
 */
export async function chargeReactionFromCard(message, button) {
  const actor = ownedActor(button);
  if (!actor) return;
  const key = button.dataset.reaction;
  if (!SW.REACTIONS[key]) return;
  const charged = await SwCheck.chargeReaction(actor, key);
  if (!charged) return;
  button.closest("[data-sw-widget='reaction']")?.remove();
  if (message.isAuthor || game.user.isGM) {
    await message.update({ [`flags.${SW.SYSTEM_ID}.reactionCharged`]: true });
  }
}

/** Recenter from a card. */
export async function recenterFromCard(button) {
  const named = resolveActor(button.dataset.actorUuid);
  const targets = named?.isOwner ? [named] : resolveTargets(button.dataset.targetUuid);
  for (const actor of targets) await actor.recenter();
}

/* -------------------------------------------- */
/*  Over the socket (0.5.3)                     */
/* -------------------------------------------- */

const EXPOSE_REFUSALS = {
  noCard: "STARWROUGHT.Position.exposeRefusedNoCard",
  notYours: "STARWROUGHT.Position.exposeRefusedNotYours"
};

/**
 * The `expose:*` half of the system socket (0.5.3), routed here by `onChatSocket`: an
 * `expose:apply` is answered by the GM's client with `expose:done` or `expose:refused`, addressed
 * to the asker alone.
 * @param {object} message
 * @param {string|null} sender  The emitting user's id, from the server's stamp; null when unknown.
 */
export async function onExposeSocket(message, sender) {
  switch (message.type) {
    case "expose:apply": {
      if (!sender || !game.user.isGM) return;
      return replyTo(sender, message.messageId, await exposeForUser(message, sender));
    }
    case "expose:done":
      ui.notifications.info(game.i18n.format("STARWROUGHT.Position.exposeDone", { name: message.name ?? "", zone: message.zone ?? "" }));
      return;
    case "expose:refused":
      ui.notifications.warn(game.i18n.localize(EXPOSE_REFUSALS[message.reason] ?? "STARWROUGHT.Position.exposeRefused"));
      return;
    default:
      return;
  }
}

/**
 * Open a Zone for another user, on the GM's client. The card names its two sides (the attacker
 * and the defender, as Actor uuids in its flags); the body must be one of them, the chooser the
 * other, and the asker must own the chooser. Nothing else in the request is trusted.
 */
async function exposeForUser(request, userId) {
  const chat = game.messages.get(request.messageId);
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || !flags) return { type: "expose:refused", reason: "noCard" };
  const user = game.users.get(userId);
  const body = resolveActor(request.actorUuid);
  const chooser = resolveActor(request.chooserUuid);
  if (!user || !body || !chooser || (body.uuid === chooser.uuid)) return { type: "expose:refused", reason: "notYours" };
  const sides = [flags.attackerUuid, flags.defenderUuid, flags.actorUuid].map(u => resolveActor(u)?.uuid).filter(Boolean);
  if (!sides.includes(body.uuid) || !sides.includes(chooser.uuid)) return { type: "expose:refused", reason: "notYours" };
  if (!chooser.testUserPermission(user, "OWNER")) return { type: "expose:refused", reason: "notYours" };
  if (!body.isOwner) return { type: "expose:refused", reason: "noCard" };
  const asked = String(request.zone ?? "");
  const zone = (asked in SW.ZONES) ? asked : SW.DEFAULT_ZONE;
  await exposeAndSay(body, zone);
  return { type: "expose:done", name: body.name, zone: game.i18n.localize(SW.ZONES[zone].label) };
}
