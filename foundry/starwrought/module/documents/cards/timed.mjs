/**
 * STARWROUGHT: the card that says what the clock changed (0.39.0; rulings 396 and 401).
 *
 * Mike, 2026-11-19: "any time a condition or effect changes, it should show in chat, just like
 * when other things change." The sweeps of rules/effects-state.mjs and the round's end
 * (documents/combat.mjs) collect a line for everything they end or lower as time passes: a
 * Condition's value dropping, an Effect a Maneuver put on running out, a given result that was
 * never used, a Gain Control's Off-Guard, a Posture's Exposed Zone, and whatever ends with the
 * encounter. This module posts them, ONE CARD FOR EACH CREATURE AND AUDIENCE.
 *
 * WHO SEES A LINE (ruling 401): whoever saw the thing go on.
 *
 *  - A line that names the card that put the thing on (`from`) goes to that card's audience: the
 *    GM alone for a blind roll, the whisper's recipients and the roll's author for a whispered
 *    one, so a private roll's result is never told to the table by its ending.
 *  - A hidden token's changes are the GM's alone. Hidden is asked of the creature's tokens in
 *    the fights it is in, not only of the scene this client happens to view.
 *  - A thing that shows on the token for everyone (`open`: a Condition, an Effect a Maneuver
 *    applied) is said to the table, an adversary's included: "Bandit is Frightened 2" was public.
 *  - A line whose card is gone, about something the token does not show, goes to the
 *    creature's owners and the GM.
 *  - Anything else goes where the creature's other cards go (`tableFor`): the table for a
 *    player's creature, the GM for an adversary.
 *
 * The rule itself is `audienceFor` in rules/effects-state.mjs, pure, where the self-test pins it.
 *
 * Posted by the client that made the change, which is one client for each creature
 * (`responsibleFor`, helpers/authority.mjs), so nothing is said twice. The lines arrive as PLAIN
 * text and are escaped here.
 *
 * Foundry-side: rules/effects-state.mjs, which the self-test imports in Node, loads this module
 * only when there is something to say.
 */

import { cardHtml, postCard, tableFor, ownersOf } from "../../helpers/cards.mjs";
import { audienceFor } from "../../rules/effects-state.mjs";

/** The `flags.starwrought.kind` of the card. */
export const TIMED_CARD = "timed";

const L = key => game.i18n.localize(key);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const gms = () => ChatMessage.getWhisperRecipients("GM").map(u => u.id);

/**
 * Is this creature hidden from the players? An unlinked token's own answer; for a linked Actor,
 * every token of it on the viewed scene AND in the fights it is in: the client that posts may be
 * viewing another scene, where a linked adversary has no token at all (the review of 0.39.0).
 */
function hiddenFromPlayers(actor) {
  if (actor?.token) return !!actor.token.hidden;
  const tokens = new Set(actor?.getActiveTokens?.(false, true) ?? []);
  for (const combat of game.combats ?? []) {
    for (const combatant of combat.getCombatantsByActor?.(actor) ?? []) if (combatant.token) tokens.add(combatant.token);
  }
  return (tokens.size > 0) && [...tokens].every(token => !!token.hidden);
}

/**
 * The users a line is whispered to; an empty list is the table. Reads the card, the token and
 * the users, and asks the rule (`audienceFor`).
 * @param {{actor: Actor, from: string|null, open: boolean}} line
 * @returns {string[]}
 */
export function audienceOf(line) {
  const chat = line.from ? (game.messages.get(line.from) ?? null) : undefined;
  return audienceFor({
    card: chat ? { blind: !!chat.blind, whisper: Array.isArray(chat.whisper) ? [...chat.whisper] : [], author: chat.author?.id ?? null } : chat,
    hidden: hiddenFromPlayers(line.actor),
    open: line.open === true,
    gms: gms(),
    owners: ownersOf(line.actor),
    table: tableFor(line.actor)
  });
}

/**
 * Post the lines: one card for each creature and audience, the lines in the order they came, a
 * line said twice in one change said once.
 * @param {Array<{actor: Actor, text: string, from: string|null, open: boolean}>} lines
 * @param {{encounter?: boolean}} [options]  These are the lines of an encounter's end.
 */
export async function postTimedChanges(lines, { encounter = false } = {}) {
  const groups = new Map();
  for (const line of lines ?? []) {
    if (!line?.actor || !line.text) continue;
    const whisper = audienceOf(line);
    const key = `${line.actor.uuid}|${[...whisper].sort().join(",")}`;
    const group = groups.get(key) ?? { actor: line.actor, whisper, texts: [] };
    if (!group.texts.includes(line.text)) group.texts.push(line.text);
    groups.set(key, group);
  }
  const title = `<i class="fa-solid fa-hourglass-half"></i> ${esc(L(encounter ? "STARWROUGHT.Timed.titleEncounter" : "STARWROUGHT.Timed.title"))}`;
  for (const group of groups.values()) {
    try {
      const content = cardHtml({ root: "sw-timed-card", actorUuid: group.actor.uuid, title, lines: group.texts.map(esc) });
      await postCard(group.actor, content, { whisper: group.whisper, flags: { kind: TIMED_CARD } });
    } catch (error) {
      console.error(`STARWROUGHT | ${group.actor?.name ?? "a creature"}: what the clock changed could not be said:`, error);
    }
  }
}
