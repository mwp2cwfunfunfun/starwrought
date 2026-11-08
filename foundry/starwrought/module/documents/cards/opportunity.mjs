/**
 * The out-of-turn request (0.19.0). Mike, playtest: "In Combat, any actions a player attempts to
 * make when it is not their turn should not be able to be carried out unless the GM approves it in
 * the chat window."
 *
 * PHB v4.24, Rounds and Opportunities: one Maneuver at your own Opportunity; "A Maneuver with the
 * Reaction ↺ trait may be performed outside your Opportunity"; "At 0 actions you still roll your
 * basic Defense, and you may still use ⓿ Reactions such as Postures." So a Reaction, a Posture, a
 * Defense roll, a reroll, Finish and Abandon are never asked about, and everything else a
 * player-controlled combatant tries outside its Opportunity is: `SwActor#mayActNow`
 * (documents/actor/actions.mjs) refuses it and posts ONE card here, public for the table, with
 * **Approve** and **Refuse** for the GM alone. Approve writes a one-shot permit on the actor
 * (`flags.starwrought.opportunityPermit`, this round's), and the player performs the Maneuver
 * again, which spends it; Refuse says so. While a request is pending for the actor, a second
 * attempt gets the notice and no second card; a request the GM never answers goes stale with the
 * round. With no GM connected the card waits, as an adversary's Blow does (ruling 162). The GM's
 * own creatures are never asked about: the GM is the one who approves.
 */

import * as SW from "../../config.mjs";
import { cardActions, cardHtml, postCard, tableFor } from "../../helpers/cards.mjs";

const { escapeHTML } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** The actor flags: the permit the GM wrote, and the request waiting on the GM. */
export const PERMIT_FLAG = "opportunityPermit";
export const REQUEST_FLAG = "opportunityRequest";

/** Register the card's buttons in `cardActions`. Idempotent. */
export function registerOpportunityCards() {
  cardActions.set("opportunityApprove", onApprove);
  cardActions.set("opportunityRefuse", onRefuse);
}

/**
 * Ask the GM. One card per actor at a time: a pending request this round, whose message still
 * exists, is only pointed at again.
 * @param {Actor} actor
 * @param {string} what   The Maneuver, as the spend would label it ("Deliberate Strike ❷: Battleaxe").
 */
export async function requestOpportunity(actor, what = "") {
  const round = game.combat?.round ?? 0;
  const label = what || localize("STARWROUGHT.Opportunity.aManeuver");
  const pending = actor.getFlag(SW.SYSTEM_ID, REQUEST_FLAG);
  if (pending && (pending.round === round) && game.messages.get(pending.messageId)) {
    ui.notifications.warn(format("STARWROUGHT.Opportunity.pending", { name: actor.name, what: pending.what || label }));
    return null;
  }
  const gm = game.users.activeGM;
  ui.notifications.warn(format(gm ? "STARWROUGHT.Opportunity.waiting" : "STARWROUGHT.Opportunity.noGm", { name: actor.name, what: label }));
  const content = cardHtml({
    root: "sw-opportunity-card",
    actorUuid: actor.uuid,
    title: `<i class="fa-solid fa-hand"></i> ${localize("STARWROUGHT.Opportunity.title")}`,
    lines: [format("STARWROUGHT.Opportunity.request", { name: escapeHTML(actor.name), what: escapeHTML(label), round })],
    notes: [localize("STARWROUGHT.Opportunity.note"), gm ? "" : localize("STARWROUGHT.Opportunity.noGmNote")],
    buttons: [
      { action: "opportunityApprove", icon: "fa-solid fa-check", label: localize("STARWROUGHT.Opportunity.approve"), data: { "gm-only": "", what: label } },
      { action: "opportunityRefuse", icon: "fa-solid fa-xmark", label: localize("STARWROUGHT.Opportunity.refuse"), data: { "gm-only": "", what: label } }
    ]
  });
  const message = await postCard(actor, content, { whisper: tableFor(actor), flags: { kind: "opportunity", actorUuid: actor.uuid, what: label } });
  if (actor.isOwner) {
    await actor.setFlag(SW.SYSTEM_ID, REQUEST_FLAG, { messageId: message?.id ?? "", what: label, round }).catch(() => {});
  }
  return message;
}

/** Is a permit the GM wrote live on this actor this round? */
export function hasPermit(actor) {
  const permit = actor.getFlag(SW.SYSTEM_ID, PERMIT_FLAG);
  return !!permit && (permit.round === (game.combat?.round ?? 0));
}

/** Spend the permit: the approved Maneuver is being performed. The owner or the GM may write it. */
export async function spendPermit(actor) {
  if (actor.getFlag(SW.SYSTEM_ID, PERMIT_FLAG) === undefined) return;
  try {
    await actor.unsetFlag(SW.SYSTEM_ID, PERMIT_FLAG);
  } catch (err) {
    console.warn(`STARWROUGHT | ${actor.name}: the permit could not be spent`, err);
  }
}

/* -------------------------------------------- */
/*  The buttons                                 */
/* -------------------------------------------- */

/** The GM approves: a permit for this round, the card settled, one public line. */
async function onApprove({ actor, button, message }) {
  if (!requireGm() || !actor) return;
  const what = button.dataset.what || message?.flags?.[SW.SYSTEM_ID]?.what || localize("STARWROUGHT.Opportunity.aManeuver");
  const round = game.combat?.round ?? 0;
  await actor.setFlag(SW.SYSTEM_ID, PERMIT_FLAG, { round, what, by: game.user.name });
  await actor.unsetFlag(SW.SYSTEM_ID, REQUEST_FLAG).catch(() => {});
  await settle(message, actor, format("STARWROUGHT.Opportunity.approved", { gm: escapeHTML(game.user.name), name: escapeHTML(actor.name), what: escapeHTML(what) }), "approved");
}

/** The GM refuses: the request cleared, one public line, nothing else written. */
async function onRefuse({ actor, button, message }) {
  if (!requireGm() || !actor) return;
  const what = button.dataset.what || message?.flags?.[SW.SYSTEM_ID]?.what || localize("STARWROUGHT.Opportunity.aManeuver");
  await actor.unsetFlag(SW.SYSTEM_ID, REQUEST_FLAG).catch(() => {});
  await settle(message, actor, format("STARWROUGHT.Opportunity.refused", { gm: escapeHTML(game.user.name), name: escapeHTML(actor.name), what: escapeHTML(what) }), "refused");
}

function requireGm() {
  if (game.user.isGM) return true;
  ui.notifications.warn(localize("STARWROUGHT.Opportunity.notGm"));
  return false;
}

/** The request card loses its buttons and gains the decision; the GM may write any message. */
async function settle(message, actor, line, decision) {
  if (!message) return;
  const content = cardHtml({
    root: `sw-opportunity-card sw-opportunity-${decision}`,
    actorUuid: actor.uuid,
    title: `<i class="fa-solid fa-hand"></i> ${localize("STARWROUGHT.Opportunity.title")}`,
    lines: [line],
    notes: decision === "approved" ? [localize("STARWROUGHT.Opportunity.approvedNote")] : []
  });
  try {
    await message.update({ content, [`flags.${SW.SYSTEM_ID}.decision`]: decision });
  } catch (err) {
    console.warn("STARWROUGHT | the request card could not be settled", err);
  }
}
