/**
 * Chat card behaviour: the render pass, the button dispatch and the socket router. The buttons
 * carry an attack through to damage, damage through to a body, and a Stopped blow through to
 * Position (PHB v4.10, The Exchange, step 5). Everything reads its state from the message's own
 * flags and the button's own data, so a card still works after a reload.
 *
 * Buttons are offers, never automatic writes: "a plausible Zone", "if they Guarded with a rigid
 * weapon" and "the defender's choice" are the table's to confirm. Each button is shown only to
 * a user who owns the actor it acts for (`data-owner-uuid`), so the attacker sees the damage
 * buttons and the defender sees the Position buttons; the GM sees everything.
 *
 * The attack card (0.5.0, templates/chat/attack-workflow-card.hbs) follows the same rule and adds
 * two markers of its own: `data-gm-only` on the GM's recovery controls, and `data-sw-threshold-for`
 * on a character's Threshold, which the brief's visibility policy decides per viewer. Its buttons
 * never decide anything here: they open the Combat Prompt, hand the roll to the coordinator's
 * `rollFor`, or send a GM control through `AttackCoordinator.request`.
 *
 * Since 0.10.1 the handlers live by card family in documents/cards/ (`damage`, `reroll`, `flare`,
 * `position`, `attack`, with `shared` for the resolvers and the socket), and this file is the three
 * entry points only: `onRenderChatMessage` wires a card, `onCardButton` names the family's handler
 * for each `data-sw-action`, and `onChatSocket` routes `damage:*`, `reroll:*` and `expose:*` to the
 * family that answers it. The round's cards and the Intercept use `data-sw-combat` and
 * `cardActions` (helpers/cards.mjs) instead.
 */

import * as SW from "../config.mjs";
import { CARD_KIND as ATTACK_CARD_KIND, mayControl } from "../combat/attack-card.mjs";
// THE PARTY (0.7.1, part 7): the Ask everyone card's Roll buttons, one per member.
import { rollAskedCheck } from "../helpers/party.mjs";
import { resolveActor, ownedActor } from "./cards/shared.mjs";
import { rollDamageFromCard, applyDamageFromCard, onDamageSocket } from "./cards/damage.mjs";
import { rerollFromCard, onRerollSocket } from "./cards/reroll.mjs";
import { flareFromCard } from "./cards/flare.mjs";
import {
  exposeFromCard, formBindFromCard, giveGroundFromCard, stepFromCard, reactionStrikeFromCard,
  chargeReactionFromCard, recenterFromCard, onExposeSocket, preventExposeFromCard
} from "./cards/position.mjs";
import { pruneAttackThresholds, openAttackPrompt, rollFromAttackCard, gmAttackRequest } from "./cards/attack.mjs";

/** The resolvers, under the names other modules imported from here through 0.10.0. */
export { resolveActor, resolveTokenDoc, ownedActor } from "./cards/shared.mjs";

/** Wire up a rendered chat card. */
export function onRenderChatMessage(message, html) {
  // A card title that opens a Rules Reference page (0.5.1, T6: the Bind and Exposed cards). Those
  // cards carry no flags, so this is wired before the flags gate and skipped by the loop below.
  for (const link of html.querySelectorAll("[data-sw-action='rulesPage']")) {
    link.addEventListener("click", event => {
      event.preventDefault();
      openRulesPage(link.dataset.page);
    });
  }

  // A card with buttons of ours is wired whether or not it carries flags (0.7.1: the party's Ask
  // everyone card has a Roll button per member and may carry none a player can read).
  const flags = message.flags?.[SW.SYSTEM_ID] ?? (html.querySelector("[data-sw-action]") ? {} : null);
  if (!flags) return;

  // Offers meant for one side of the exchange vanish for everyone who cannot act on them. The
  // Ask everyone card's per-member Roll buttons (0.7.1) ride on this: each names its member.
  for (const el of html.querySelectorAll("[data-owner-uuid]")) {
    const actor = resolveActor(el.dataset.ownerUuid);
    if (actor && !actor.isOwner) el.remove();
  }

  // A rerolled card (0.5.3) keeps its place in the record and loses its controls: the new throw
  // below it is the one that acts. Done before the buttons are wired, so none of them is.
  if (flags.superseded) {
    const card = html.querySelector(".starwrought") ?? html;
    card.classList.add("sw-superseded");
    for (const el of card.querySelectorAll("button, select")) el.disabled = true;
    for (const el of card.querySelectorAll("[data-sw-action]")) {
      if (el.dataset.swAction !== "rulesPage") el.removeAttribute("data-sw-action");
    }
    const reason = flags.superseded.reason;
    const note = document.createElement("p");
    note.className = "sw-card-note sw-warn sw-superseded-note";
    note.textContent = reason
      ? game.i18n.format("STARWROUGHT.Reroll.supersededReason", { reason })
      : game.i18n.localize("STARWROUGHT.Reroll.superseded");
    const anchor = card.querySelector(".sw-card-roll");
    if (anchor) anchor.after(note);
    else card.prepend(note);
  }

  // A Reaction already charged offers no button.
  if (flags.reactionCharged) {
    for (const el of html.querySelectorAll("[data-sw-action='chargeReaction']")) el.remove();
  }

  // An Expose a `prevent` Reaction stopped (0.13.0): the widget goes and the card says so.
  if (flags.prevented) {
    let anchor = null;
    for (const el of html.querySelectorAll("[data-sw-widget='expose']")) {
      anchor ??= el.parentElement;
      el.remove();
    }
    const note = document.createElement("p");
    note.className = "sw-card-note sw-prevented-note";
    note.textContent = game.i18n.format("STARWROUGHT.Position.prevented", { owner: flags.prevented.owner ?? "", talent: flags.prevented.talent ?? "" });
    const position = html.querySelector(".sw-card-position");
    if (position) position.querySelector(".sw-card-note")?.after(note);
    else (anchor ?? html).prepend(note);
  }

  // The GM controls (the attack card's Cancel, Reset defenses and Resend prompts) are the GM's,
  // or the coordinator's at a table with no GM connected. The content is the same on every
  // client; the row is not.
  if (!mayControl(game.user, flags.attackWorkflow)) {
    for (const el of html.querySelectorAll("[data-gm-only]")) el.remove();
  }

  // The attack card prints "vs {threshold}" for a character defender; whether this viewer may see
  // it is the brief's visibility policy, read from the setting and actor ownership, never from a
  // flag (an adversary's Threshold is never in the flags at all).
  if (flags.kind === ATTACK_CARD_KIND) pruneAttackThresholds(html, flags.attackWorkflow);

  for (const button of html.querySelectorAll("[data-sw-action]")) {
    if (button.dataset.swAction === "rulesPage") continue;
    button.addEventListener("click", event => onCardButton(event, message, flags));
  }
}

/* -------------------------------------------- */

async function onCardButton(event, message, flags) {
  event.preventDefault();
  const button = event.currentTarget;
  const action = button.dataset.swAction;
  button.disabled = true;

  try {
    switch (action) {
      case "damage": return await rollDamageFromCard(message, flags, button.dataset.outcome);
      case "applyDamage": return await applyDamageFromCard(message, flags, button, event);
      case "flare": return await flareFromCard(message, flags, button);
      case "reroll": return await rerollFromCard(message, flags);
      case "expose":
      case "exposeZone": return await exposeFromCard(message, flags, button);
      case "preventExpose": return await preventExposeFromCard(message, flags, button);
      case "formBind": return await formBindFromCard(message, flags, button);
      case "giveGround": return await giveGroundFromCard(button);
      case "step": return await stepFromCard(button);
      case "riposte": return await reactionStrikeFromCard(button, "riposte");
      case "chargeReaction": return await chargeReactionFromCard(message, button);
      case "finishPrepared": return await ownedActor(button)?.finishPrepared();
      case "abandonPrepared": return await ownedActor(button)?.abandonPrepared();
      case "recovery": return await ownedActor(button)?.rollRecovery();
      case "recenter": return await recenterFromCard(button);
      // The attack card (0.5.0): recovery, never decision.
      case "attackOpenPrompt": return await openAttackPrompt(button);
      case "attackRoll": return await rollFromAttackCard(button);
      case "attackCancel": return await gmAttackRequest(flags, button, "cancel");
      case "attackReset": return await gmAttackRequest(flags, button, "resetDefenses");
      case "attackResend": return await gmAttackRequest(flags, button, "resendPrompts");
      // The party's Ask everyone card (0.7.1): the member's owner, or the GM, rolls as the member.
      case "partyAsk": return await rollAskedCheck(message, flags, button);
      default: return;
    }
  } finally {
    button.disabled = false;
  }
}

/* -------------------------------------------- */

/**
 * Open a page of the shipped Rules Reference by its title (0.5.1, T6). The page is found by name
 * in the `rules` compendium, never by id: the ids are deterministic in the build, but the client
 * has no business knowing them. Used by the Bind and Exposed card titles, the sheet's bind line,
 * the Zones panel's EXPOSED badge and the Effects tab.
 * @param {string} title  The page's name, as build_foundry.mjs's journalPages spells it.
 * @returns {Promise<Application|null>}
 */
export async function openRulesPage(title) {
  if (!title) return null;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.rules`);
  const entries = pack ? await pack.getDocuments() : [];
  const wanted = String(title).trim().toLowerCase();
  for (const entry of entries) {
    const page = entry.pages.find(p => p.name.trim().toLowerCase() === wanted);
    if (page) return entry.sheet.render({ force: true, pageId: page.id });
  }
  ui.notifications.warn(game.i18n.format("STARWROUGHT.Rules.missing", { page: title }));
  return null;
}

/* -------------------------------------------- */
/*  The system socket                           */
/* -------------------------------------------- */

/**
 * The chat cards' half of the system socket: starwrought.mjs routes `damage:*`, `reroll:*` and
 * `expose:*` here, `party:*` to party-socket.mjs (0.7.1) and everything else to the attack
 * coordinator. A message is for this client only when it is addressed to it; the asker is the
 * server's stamp, never a field of the payload; and each family answers its own prefix
 * (`onDamageSocket`, `onRerollSocket`, `onExposeSocket`), the GM's client replying to a `*:apply`
 * with `*:applied`/`*:done` or `*:refused`, addressed to the asker alone.
 * @param {object} message
 * @param {string} [senderId]  The emitting user's id, supplied by the server.
 */
export async function onChatSocket(message, senderId) {
  if (!message || (typeof message !== "object") || (message.to !== game.user.id)) return;
  const sender = ((typeof senderId === "string") && game.users.has(senderId)) ? senderId : null;
  const type = String(message.type ?? "");
  if (type.startsWith("damage:")) return onDamageSocket(message, sender);
  if (type.startsWith("reroll:")) return onRerollSocket(message, sender);
  if (type.startsWith("expose:")) return onExposeSocket(message, sender);
}
