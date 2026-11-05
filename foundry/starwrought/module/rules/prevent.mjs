/**
 * What the `prevent` kind does at the table (0.13.0): the Foundry side of the `prevent` hook
 * point, as scene.mjs is the Foundry side of `modifiers`. Two moments, each with its one
 * executing client (../README.md, the triggered category):
 *
 *  - A CONDITION on a body. `SwActor#setCondition` asks `conditionPrevented` before it writes a
 *    Condition on (never off, never a Zone's Exposed mirror), and the token palette's path asks
 *    the same through the `preCreateActiveEffect` hook registered in starwrought.mjs. The client
 *    writing the Condition is the one that asks and acts: it skips the write, posts one card
 *    naming the Talent ("Stubborn Footing: Tess is not knocked Prone") and writes the FIRST/ONCE
 *    mark on the body. The event is the write itself, so nothing is done twice. Only an AUTOMATIC
 *    preventer (a Talent without ↺) acts here; a ↺ one is a Reaction the owner chooses, which no
 *    Condition write offers yet (no Talent asks for it).
 *
 *  - AN EXPOSE on the card. `position()` asks `exposePreventers` for the Reaction Talents that
 *    reach the body a Stop would Expose (Steady the Line, an adjacent ally's); each is a button in
 *    the Expose widget, and `preventExposeFromCard` (documents/cards/position.mjs) is pressed by
 *    the Talent's owner, pays its cost, writes the mark, flags the card `prevented` and says "It
 *    Exposes nothing". The card is the event; a widget already prevented draws no Expose button.
 */

import * as SW from "../config.mjs";
import { rulePreventers } from "./engine.mjs";
import { sceneContextFor, encounterContext, writeRuleMarks } from "./scene.mjs";
import { EXPOSE } from "./kinds/prevent.mjs";

/**
 * The preventers of an effect on an actor, split into the automatic ones and the Reactions.
 * @param {Actor} actor
 * @param {string} effect  A condition id, or "expose".
 * @param {{token?: TokenDocument|null, threat?: object|null}} [options]
 * @returns {{automatic: import("./engine.mjs").Preventer[], reactions: import("./engine.mjs").Preventer[]}}
 */
export function preventersFor(actor, effect, { token = null, threat = null } = {}) {
  const all = rulePreventers(actor, {
    effect, threat, scene: sceneContextFor(actor, token), encounter: encounterContext()
  });
  // CHARACTER EFFECTS (0.16.0): a line on Skip answered nothing this once; the dispatcher left the
  // mark that returns it to On on the array, and the asking spends it.
  if (all.marks?.length) writeRuleMarks(actor, all.marks).catch(err => console.error("STARWROUGHT | the skip marks could not be written", err));
  return { automatic: all.filter(p => !p.reaction), reactions: all.filter(p => p.reaction) };
}

/**
 * Would a rule stop this Condition landing on the actor? When one does: the card, the mark, and
 * the preventer back, so the caller skips its write. Null when nothing prevents it.
 * @param {Actor} actor
 * @param {string} conditionId  A key of SW.CONDITIONS.
 * @returns {Promise<import("./engine.mjs").Preventer|null>}
 */
export async function conditionPrevented(actor, conditionId) {
  const config = SW.CONDITIONS[conditionId];
  if (!config || config.zone) return null;
  const { automatic } = preventersFor(actor, conditionId);
  const preventer = automatic[0] ?? null;
  if (!preventer) return null;
  await sayPrevented(actor, preventer, game.i18n.localize(config.name));
  if (preventer.mark) await writeRuleMarks(actor, [preventer.mark]);
  return preventer;
}

/** The Reaction Talents that could stop an Expose on this body, for the card's widget. */
export function exposePreventers(actor, token = null) {
  if (!actor) return [];
  return preventersFor(actor, EXPOSE, { token }).reactions.map(p => ({
    itemId: p.item.id ?? "", itemName: p.item.name ?? "", ownerUuid: p.owner?.uuid ?? "", ownerName: p.owner?.name ?? "",
    cost: Number(p.item.system?.costValue ?? SW.actionCostValue?.(p.item.system?.cost) ?? 0) || 0
  }));
}

/**
 * The card that says an effect did not land, spoken by the body, naming the Talent and, when it is
 * someone else's, whose. Outside an encounter a FIRST or ONCE applies every time, and the card
 * says so.
 * @param {Actor} actor
 * @param {import("./engine.mjs").Preventer} preventer
 * @param {string} effectLabel  The Condition's localized name, or "Exposed".
 */
export async function sayPrevented(actor, preventer, effectLabel) {
  const talent = SW.plainName(preventer.item?.name ?? "");
  const owner = preventer.owner;
  const ownerNote = (owner && (owner !== actor)) ? ` (${owner.name})` : "";
  const body = game.i18n.format("STARWROUGHT.Rules.prevented", { talent: `${talent}${ownerNote}`, name: actor.name, effect: effectLabel });
  const outside = (preventer.mark === null) && !game.combat
    && (preventer.item?.system?.rules ?? []).some(r => (r?.kind === "prevent") && r.limit)
    ? `<p class="sw-card-note">${game.i18n.localize("STARWROUGHT.Rules.preventedOutside")}</p>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="starwrought action-card sw-prevented-card"><h3><i class="fa-solid fa-shield-halved"></i> ${
      game.i18n.localize("STARWROUGHT.Rules.preventedTitle")}</h3><p>${body}</p>${outside}</div>`
  });
}
