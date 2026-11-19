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
 *
 * `preventersFor` itself is a read and writes nothing (0.18.1): through 0.18.0 it spent a Skip
 * line's state as it was asked, and it is asked by renders and previews too (the Expose widget's
 * press re-reads it, the Combat Prompt previews through the engine), so a card re-rendered on
 * another client could clear a player's Skip before anything was prevented. The two acting
 * callers spend the Skips (`spendSkips`): `conditionPrevented` and the token palette's hook at
 * the Condition write, `exposePreventers` at the roll that posts the card.
 */

import * as SW from "../config.mjs";
import { rulePreventers, ruleTraitImmunity } from "./engine.mjs";
import { sceneContextFor, encounterContext, writeRuleMarks } from "./scene.mjs";
import { EXPOSE } from "./kinds/prevent.mjs";

/**
 * The preventers of an effect on an actor, split into the automatic ones and the Reactions, with
 * the Skip marks the reading asks for (0.16.0: a line on Skip answered nothing this once, and the
 * mark returns it to On). A READ, writing nothing: the Expose widget renders through it, the
 * Combat Prompt previews through it, and a render must never spend a Skip (0.18.1). The client
 * that ACTS on the answer (a Condition write refused, an Expose offered on a roll's card) writes
 * the marks through `spendSkips`, so a Skip is spent once, at the event.
 * @param {Actor} actor
 * @param {string} effect  A condition id, or "expose".
 * @param {{token?: TokenDocument|null, threat?: object|null}} [options]
 * @returns {{automatic: import("./engine.mjs").Preventer[], reactions: import("./engine.mjs").Preventer[], marks: Array<{key: string, per: string, owner?: string}>}}
 */
export function preventersFor(actor, effect, { token = null, threat = null } = {}) {
  const all = rulePreventers(actor, {
    effect, threat, scene: sceneContextFor(actor, token), encounter: encounterContext()
  });
  return { automatic: all.filter(p => !p.reaction), reactions: all.filter(p => p.reaction), marks: all.marks ?? [] };
}

/**
 * Spend the Skip marks a reading left, and the acting preventer's own FIRST/ONCE mark beside them,
 * on the client that acted (0.18.1). Never throws: a mark that will not write is logged.
 * @param {Actor} actor
 * @param {Array<{key: string, per: string, owner?: string}>} marks
 * @returns {Promise<void>}
 */
export async function spendSkips(actor, marks) {
  if (!marks?.length) return;
  try {
    await writeRuleMarks(actor, marks);
  } catch (err) {
    console.error("STARWROUGHT | the rule marks could not be written", err);
  }
}

/**
 * Would a rule stop this Condition landing on the actor? When one does: the card, the mark, and
 * the preventer back, so the caller skips its write. Null when nothing prevents it. The Condition
 * write is the event, so a Skip that would have prevented it is spent here either way.
 * @param {Actor} actor
 * @param {string} conditionId  A key of SW.CONDITIONS.
 * @returns {Promise<import("./engine.mjs").Preventer|null>}
 */
export async function conditionPrevented(actor, conditionId) {
  const config = SW.CONDITIONS[conditionId];
  if (!config || config.zone) return null;
  const { automatic, marks } = preventersFor(actor, conditionId);
  const preventer = automatic[0] ?? null;
  if (!preventer) {
    await spendSkips(actor, marks);
    return null;
  }
  await sayPrevented(actor, preventer, game.i18n.localize(SW.conditionNameKey(config.id)));
  await spendSkips(actor, [...marks, ...(preventer.mark ? [preventer.mark] : [])]);
  return preventer;
}

/**
 * The Reaction Talents that could stop an Expose on this body, for the card's widget, as plain
 * data the card's flags keep. The roll that posts the card is the event an Expose's Skip answers
 * nothing to, so the roller's client spends the Skips it read, relayed to the owner's or the GM's
 * when the body is not its own to write (`writeRuleMarks`); a widget drawn again from the flags
 * reads nothing here. Never throws, so a card never dies over a rule.
 * @param {Actor} actor
 * @param {TokenDocument|null} [token]
 * @returns {Array<{itemId: string, itemName: string, ownerUuid: string, ownerName: string, cost: number}>}
 */
export function exposePreventers(actor, token = null) {
  if (!actor) return [];
  const { reactions, marks } = preventersFor(actor, EXPOSE, { token });
  spendSkips(actor, marks);
  return reactions.map(p => ({
    itemId: p.item.id ?? "", itemName: p.item.name ?? "", ownerUuid: p.owner?.uuid ?? "", ownerName: p.owner?.name ?? "",
    cost: Number(p.item.system?.costValue ?? SW.actionCostValue?.(p.item.system?.cost) ?? 0) || 0
  }));
}

/* -------------------------------------------- */
/*  Immunity to a trait (0.35.0)                */
/* -------------------------------------------- */

/**
 * Is this creature immune to a thing that carries these traits (0.35.0; rulings 350 to 360)? The
 * Blinded row of the Conditions sheet says `[EFFECT IMMUNE: TRAIT(Visual)]`, and the system SAYS
 * IT AND GOES ON (Mike): the use is made and paid for, and nothing lands on the immune creature.
 *
 * A READ, on whichever client asks: the roller's for the roll window, the client that posts a
 * card for its note, the one writer of an Effect for the write itself, the coordinator for an
 * attack's result. Each asks at its own moment, so the answer is the creature as it stands THEN:
 * immunity is judged when a thing would land (ruling 358). No scene is read and nothing is
 * written, so every client answers the same. Never throws: a card never dies over a rule.
 *
 * @param {Actor} actor       The creature the thing would land on.
 * @param {string[]} traits   The thing's traits (a Maneuver's, a weapon's, a spell's).
 * @param {{other?: Actor|null}} [options]  The creature doing the thing.
 * @returns {{covered: object[], traits: string, by: string}|null}
 */
export function traitImmunity(actor, traits, { other = null } = {}) {
  if (!actor || !Array.isArray(traits) || !traits.length) return null;
  try {
    return ruleTraitImmunity(actor, traits, { other });
  } catch (err) {
    console.error("STARWROUGHT | a creature's immunity to a trait could not be read", err);
    return null;
  }
}

/**
 * The sentence that says it: "Bandit is immune to Visual effects (Blinded). Nothing this does
 * lands on Bandit."
 * @param {string} target  The creature's name, as the table sees it (its token's).
 * @param {{traits: string, by: string}} immunity  From `traitImmunity`.
 * @param {string} [key]   The i18n key: `note` for a Maneuver, `attack` for an attack's result,
 *                         `applied` for the write that applied nothing, `given` for a refused give.
 * @returns {string}
 */
export function immunityNote(target, immunity, key = "note") {
  if (!immunity) return "";
  return game.i18n.format(`STARWROUGHT.Immune.${key}`, { target: String(target ?? ""), traits: immunity.traits, by: immunity.by });
}

/**
 * What a card keeps of an immunity, and prints: who was immune, to which traits, by what, and the
 * sentence. Null when the creature is not immune. The one shape `flags.starwrought.immune` has,
 * whoever asked (the card as it is posted, the coordinator as it resolves an attack's pairing).
 * @param {Actor} target      The creature the thing would land on.
 * @param {string} name       Its name as the table sees it.
 * @param {string[]} traits   The thing's traits.
 * @param {{other?: Actor|null, key?: string}} [options]  `key`: which sentence (see `immunityNote`).
 * @returns {{targetUuid: string, target: string, traits: string, by: string, note: string}|null}
 */
export function immunityRecord(target, name, traits, { other = null, key = "note" } = {}) {
  const hit = traitImmunity(target, traits, { other });
  if (!hit) return null;
  const shown = String(name || target?.name || "");
  return { targetUuid: target.uuid, target: shown, traits: hit.traits, by: hit.by, note: immunityNote(shown, hit, key) };
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
