/**
 * The party's half of the system socket (0.7.1; party-sheet-plan.md, part 6): a player's Take
 * from the party's loot and Give to the party, run on the active GM's client.
 *
 * A Take is two writes a player cannot make alone (the create on their own character they could;
 * the decrement or delete on the party they cannot), and a Give is the same pair the other way
 * round, so the whole move runs where both documents can be written, exactly as `damage:apply`,
 * `reroll:apply` and `expose:apply` do in documents/chat.mjs (ruling 97, Mike 2026-10-02). The
 * asker emits `party:take` or `party:give` carrying nothing but ids and a count, addressed to
 * `game.users.activeGM`. The GM's client reads who is asking from the server's stamp on the
 * socket event, never from the payload; re-reads the party, the Item and the character from
 * their uuids and ids; checks that the asker owns the character (the destination of a Take, the
 * source of a Give), that the character is a member of that party, that the Item is gear and
 * that the count is in stock; writes the destination FIRST and the source SECOND, so a failure
 * between the two leaves a duplicate and never a loss; posts the card, spoken by the member; and
 * answers `party:done` or `party:refused` to the asker alone. Requests are served in arrival
 * order through one promise chain, as `SwActor#setCondition` queues its condition writes, so two
 * players taking the last potion resolve as one Take and one refusal (plan, risk 5). With no GM
 * connected the asker is told so and nothing is written (risk 5). Every request is addressed to
 * one user, and a second GM's client ignores a request not addressed to it (risk 6), as
 * `onChatSocket` does.
 *
 * The GM's own Take or Give (a party Item dragged onto a character sheet, or a character's Item
 * onto the party by a GM who is not the one the sheet routes to Foundry's copy) runs the same code
 * here, locally, through the same chain, with no socket.
 *
 * Ruling 98: a party Item dragged onto a character sheet moves the whole stack; the Loot tab's
 * Take asks a count for a stack. The drop route in apps/actor-sheet.mjs passes the stack's
 * quantity here. Ruling 96 stands over all of it: the loot and the purse are a convenience with
 * no rule authority. They move Items and coin and value nothing; a row prints a price, and
 * nothing computes with it.
 */

import * as SW from "../config.mjs";
import { cardHtml, postCard } from "./combat.mjs";

const SOCKET = `system.${SW.SYSTEM_ID}`;
const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));

/** The asker's notice for each refusal the GM's client answers with; any other reason gets the plain one. */
const REFUSALS = Object.freeze({
  gone: "STARWROUGHT.Loot.relayRefusedGone",
  notEnough: "STARWROUGHT.Loot.relayRefusedNotEnough",
  notYours: "STARWROUGHT.Loot.relayRefusedNotYours",
  noMember: "STARWROUGHT.Loot.relayRefusedNoMember",
  notPhysical: "STARWROUGHT.Loot.relayRefusedNotPhysical"
});

/* -------------------------------------------- */
/*  The asking side                              */
/* -------------------------------------------- */

/**
 * Take an Item, or part of a stack, from the party's loot onto a character (ruling 97). The GM
 * moves it here and now; a player asks the active GM's client, and is told when it is done or
 * why it was not; with no GM connected nothing is written and the notice says so.
 * @param {object} options
 * @param {Actor} options.party     The party holding the Item.
 * @param {Item} options.item       The Item on the party.
 * @param {Actor} options.actor     The member taking it; the asker must own this character.
 * @param {number} [options.quantity]  How many of the stack; the whole stack when omitted (ruling 98).
 * @returns {Promise<object|null>}  The GM's own reply when the move ran locally, else null.
 */
export async function requestTake({ party, item, actor, quantity } = {}) {
  return request("party:take", { party, item, actor, quantity });
}

/**
 * Give an Item, or part of a stack, from a character to the party's loot (ruling 97), the same way
 * with the sides swapped: the asker must own the character the Item leaves.
 * @param {object} options
 * @param {Actor} options.actor     The member giving it.
 * @param {Item} options.item       The Item on the character.
 * @param {Actor} options.party     The party receiving it.
 * @param {number} [options.quantity]  How many of the stack; the whole stack when omitted.
 * @returns {Promise<object|null>}  The GM's own reply when the move ran locally, else null.
 */
export async function requestGive({ actor, item, party, quantity } = {}) {
  return request("party:give", { party, item, actor, quantity });
}

/** The two requests share everything but their type and the side the Item sits on. */
async function request(type, { party, item, actor, quantity }) {
  if (!isParty(party) || !item || !isCharacter(actor)) {
    ui.notifications.warn(L(REFUSALS.gone));
    return null;
  }
  // The side the asker must own is the character, whichever way the Item is going. The GM's
  // client checks this again against the server's stamp; refusing here saves the round trip.
  if (!actor.isOwner) {
    ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const count = countOf(quantity ?? item.system?.quantity);
  if (count === null) {
    ui.notifications.warn(L(REFUSALS.notEnough));
    return null;
  }

  // The GM's own move: the code the relay runs, through the chain the relay uses, with no socket.
  if (game.user.isGM) {
    const perform = (type === "party:take") ? performTake : performGive;
    const reply = await queued(() => guarded(() => perform({ party, itemId: item.id, actor, count, user: game.user })));
    notifyReply(reply);
    return reply;
  }

  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.warn(L("STARWROUGHT.Loot.relayNoGm"));
    return null;
  }
  game.socket.emit(SOCKET, {
    type, to: gm.id, partyUuid: party.uuid, itemId: item.id, actorUuid: actor.uuid, quantity: count
  }, { recipients: [gm.id] });
  ui.notifications.info(F((type === "party:take") ? "STARWROUGHT.Loot.relaySentTake" : "STARWROUGHT.Loot.relaySentGive", {
    name: item.name, count
  }));
  return null;
}

/* -------------------------------------------- */
/*  The socket                                   */
/* -------------------------------------------- */

/**
 * The party's half of the system socket: starwrought.mjs routes every `party:*` message here. A
 * `party:take` or `party:give` is served on the GM's client, in arrival order, and answered with
 * `party:done { name, count }` or `party:refused { reason }` addressed to the asker alone; the
 * answer shows as a notice on the asker's client. Modelled on `onChatSocket` in chat.mjs.
 * @param {object} message
 * @param {string} [senderId]  The emitting user's id, supplied by the server.
 */
export async function onPartySocket(message, senderId) {
  if (!message || (typeof message !== "object") || (message.to !== game.user.id)) return;
  const sender = ((typeof senderId === "string") && game.users.has(senderId)) ? senderId : null;
  switch (message.type) {
    case "party:take":
    case "party:give": {
      if (!sender || !game.user.isGM) return;
      const serve = (message.type === "party:take") ? takeForUser : giveForUser;
      const reply = await queued(() => guarded(() => serve(message, sender)));
      game.socket.emit(SOCKET, { ...reply, to: sender }, { recipients: [sender] });
      return;
    }
    case "party:done":
    case "party:refused":
      notifyReply(message);
      return;
    default:
      return;
  }
}

/**
 * Take for another user, on the GM's client: the party, the Item and the character are re-read
 * from the ids the request carries, and the request is trusted for nothing else but the count.
 */
async function takeForUser(request, userId) {
  const user = game.users.get(userId) ?? null;
  const party = resolveActor(request.partyUuid);
  const actor = resolveActor(request.actorUuid);
  return performTake({ party, itemId: request.itemId, actor, count: countOf(request.quantity), user });
}

/** Give for another user, on the GM's client: the same, with the Item read from the character. */
async function giveForUser(request, userId) {
  const user = game.users.get(userId) ?? null;
  const party = resolveActor(request.partyUuid);
  const actor = resolveActor(request.actorUuid);
  return performGive({ party, itemId: request.itemId, actor, count: countOf(request.quantity), user });
}

/* -------------------------------------------- */
/*  The moves                                    */
/* -------------------------------------------- */

/**
 * One Take, checked and written on a client that can write both documents. The checks, in order:
 * the party and the Item still exist (gone); the user owns the character (notYours); the character
 * is a member of this party (noMember); the Item is gear (notPhysical); the count is a whole
 * number in stock (notEnough). Then the character first, the party second, and the card.
 * @returns {Promise<object>}  The reply: `party:done` or `party:refused`.
 */
async function performTake({ party, itemId, actor, count, user }) {
  if (!isParty(party)) return refused("gone");
  const item = party.items.get(String(itemId ?? "")) ?? null;
  if (!item) return refused("gone");
  if (!isCharacter(actor) || !user || !actor.testUserPermission(user, "OWNER")) return refused("notYours");
  if (!isMember(party, actor)) return refused("noMember");
  if (!item.isPhysical) return refused("notPhysical");
  const stock = Number(item.system.quantity) || 0;
  if ((count === null) || (count > stock)) return refused("notEnough");

  const left = stock - count;
  const name = item.name;
  await moveStack(item, actor, count, left);
  await postMoveCard(actor, {
    root: "sw-loot-take",
    icon: "fa-solid fa-box-open",
    title: L("STARWROUGHT.Loot.cardTakeTitle"),
    line: ((stock === 1) && (count === 1))
      ? F("STARWROUGHT.Loot.cardTakesOne", { name: esc(actor.name), item: esc(name) })
      : F("STARWROUGHT.Loot.cardTakesStack", { name: esc(actor.name), count, item: esc(name), left })
  });
  return { type: "party:done", kind: "take", name, count };
}

/**
 * One Give, the mirror of performTake: the Item is read from the character, who must be the
 * user's and a member; the party first, the character second, and the card.
 * @returns {Promise<object>}  The reply: `party:done` or `party:refused`.
 */
async function performGive({ party, itemId, actor, count, user }) {
  if (!isParty(party)) return refused("gone");
  if (!isCharacter(actor) || !user || !actor.testUserPermission(user, "OWNER")) return refused("notYours");
  const item = actor.items.get(String(itemId ?? "")) ?? null;
  if (!item) return refused("gone");
  if (!isMember(party, actor)) return refused("noMember");
  if (!item.isPhysical) return refused("notPhysical");
  const stock = Number(item.system.quantity) || 0;
  if ((count === null) || (count > stock)) return refused("notEnough");

  const left = stock - count;
  const name = item.name;
  await moveStack(item, party, count, left);
  await postMoveCard(actor, {
    root: "sw-loot-give",
    icon: "fa-solid fa-sack",
    title: L("STARWROUGHT.Loot.cardGiveTitle"),
    line: ((stock === 1) && (count === 1))
      ? F("STARWROUGHT.Loot.cardGivesOne", { name: esc(actor.name), item: esc(name) })
      : F("STARWROUGHT.Loot.cardGivesStack", { name: esc(actor.name), count, item: esc(name) })
  });
  return { type: "party:done", kind: "give", name, count };
}

/**
 * Move `count` of an Item's stack to another Actor: a copy of the Item's source data with the
 * moved count, created on the destination FIRST, then the source brought down to what is left or
 * deleted when nothing is. A failure between the two writes leaves a duplicate, never a loss. The
 * copy lands packed (`system.state` "carried"): on a character, drawing it is an Interact as the
 * book prices it; on a party the state means nothing and reads the same. Both writes are the
 * GM's and marked announced, so the player-edit audit never says them a second time.
 */
async function moveStack(item, destination, count, left) {
  const data = item.toObject();
  delete data._id;
  data.system ??= {};
  data.system.quantity = count;
  data.system.state = "carried";
  await destination.createEmbeddedDocuments("Item", [data], { swAnnounced: true });
  if (left > 0) await item.update({ "system.quantity": left }, { swAnnounced: true });
  else await item.delete({ swAnnounced: true });
}

/** A public card spoken by the member, in the system's card idiom. */
function postMoveCard(actor, { root, icon, title, line }) {
  const content = cardHtml({
    root: `sw-loot-card ${root}`,
    actorUuid: actor.uuid,
    title: `<i class="${esc(icon)}"></i> ${esc(title)}`,
    lines: [line]
  });
  return postCard(actor, content);
}

/* -------------------------------------------- */
/*  Arrival order, replies, small readers        */
/* -------------------------------------------- */

/** The move in flight on this client, so the next one waits for it (see queued). */
let chain = Promise.resolve();

/**
 * Serve one move after the last, whoever asked (plan, risk 5): the promise chain
 * `SwActor#setCondition` uses for its condition writes, with one chain for every party on this
 * client, since a Give and a Take on the same stack must see each other's writes. A task's
 * failure never blocks the next; the chain is let go once it has drained.
 * @param {() => Promise<object>} task
 * @returns {Promise<object>}
 */
function queued(task) {
  const run = chain.catch(() => null).then(task);
  chain = run;
  return run.finally(() => { if (chain === run) chain = Promise.resolve(); });
}

/** A move that throws answers with a plain refusal rather than leaving the asker waiting. */
async function guarded(task) {
  try {
    return await task();
  } catch (err) {
    console.error("STARWROUGHT | a party loot request could not be served", err);
    return refused("error");
  }
}

function refused(reason) {
  return { type: "party:refused", reason };
}

/** The asker's notice for a reply, on the asker's client (or the GM's own, for a local move). */
function notifyReply(reply) {
  if (!reply || (typeof reply !== "object")) return;
  if (reply.type === "party:done") {
    const key = (reply.kind === "give") ? "STARWROUGHT.Loot.relayDoneGive"
      : (reply.kind === "take") ? "STARWROUGHT.Loot.relayDoneTake"
      : "STARWROUGHT.Loot.relayDone";
    ui.notifications.info(F(key, { name: reply.name ?? "", count: Number(reply.count) || 1 }));
    return;
  }
  if (reply.type === "party:refused") {
    ui.notifications.warn(L(REFUSALS[reply.reason] ?? "STARWROUGHT.Loot.relayRefused"));
  }
}

/** A whole number of one or more, or null for anything else (a payload is not trusted to be one). */
function countOf(value) {
  const n = Math.floor(Number(value));
  return (Number.isFinite(n) && (n >= 1)) ? n : null;
}

/** The Actor a uuid names, through a Token when it names one; null for anything else. */
function resolveActor(uuid) {
  if (!uuid || (typeof uuid !== "string")) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { doc = null; }
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  if (doc.documentName === "Token") return doc.actor ?? null;
  return null;
}

function isParty(actor) {
  return (actor?.documentName === "Actor") && (actor.type === SW.PARTY_TYPE);
}

function isCharacter(actor) {
  return (actor?.documentName === "Actor") && (actor.type === "character");
}

/** Membership as the party records it: the character's own uuid in the roster. */
function isMember(party, actor) {
  const uuids = party.system?.memberUuids ?? (party.system?.members ?? []).map(m => m.uuid);
  return uuids.includes(actor.uuid);
}
