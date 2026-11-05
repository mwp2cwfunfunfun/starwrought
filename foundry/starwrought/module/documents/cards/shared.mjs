/**
 * What the card families share: the uuid resolvers, the owner gate, the Zone a widget chose, the
 * targets a click lands on, and the system socket's name with the one-line reply to an asker.
 * Imported by every file in this folder and by documents/chat.mjs; imports nothing but the config,
 * so no family can close a circle through it. Through 0.10.0 these were the top of
 * documents/chat.mjs, which still re-exports the three resolvers under their old names.
 */

import * as SW from "../../config.mjs";

/** The system socket every relay in this folder speaks on (`damage:*`, `reroll:*`, `expose:*`). */
export const SOCKET = `system.${SW.SYSTEM_ID}`;

/** Answer an asker over the socket: the family's reply, addressed to them alone, naming the card. */
export function replyTo(sender, messageId, reply) {
  game.socket.emit(SOCKET, { ...reply, to: sender, messageId }, { recipients: [sender] });
}

/* -------------------------------------------- */

/** The Actor behind a uuid, whether the uuid names an Actor or a Token. */
export function resolveActor(uuid) {
  if (!uuid) return null;
  const doc = fromUuidSync(uuid);
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  return doc.actor ?? null;
}

/** The TokenDocument behind a uuid that names a Token, or an Actor's first token on the scene. */
export function resolveTokenDoc(uuid) {
  if (!uuid) return null;
  const doc = fromUuidSync(uuid);
  if (!doc) return null;
  if (doc.documentName === "Token") return doc;
  if (doc.documentName === "Actor") return doc.getActiveTokens(false, true)[0] ?? null;
  return null;
}

/** The owned Actor a button acts for, or a warning and null. */
export function ownedActor(button, key = "actorUuid") {
  const actor = resolveActor(button.dataset[key]);
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
    return null;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  return actor;
}

/** The Zone a widget's own select says, or the button's data, or the Torso. */
export function zoneFrom(button) {
  const widget = button.closest("[data-sw-widget]") ?? button.parentElement;
  const select = widget?.querySelector("select[name='zone']");
  const zone = button.dataset.zone || select?.value || SW.DEFAULT_ZONE;
  return (zone in SW.ZONES) ? zone : SW.DEFAULT_ZONE;
}

/**
 * Which Actors a card click should land on: the creature the uuid names when this user may write
 * it, then the selected tokens, then the user's targets.
 */
export function resolveTargets(targetUuid) {
  const named = resolveActor(targetUuid);
  if (named?.isOwner) return [named];
  const controlled = canvas.tokens?.controlled?.map(t => t.actor).filter(a => a?.isOwner) ?? [];
  if (controlled.length) return controlled;
  return Array.from(game.user.targets).map(t => t.actor).filter(a => a?.isOwner);
}
