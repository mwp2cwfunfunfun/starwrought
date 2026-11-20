/**
 * A Maneuver's check that waits on another player (0.34.0; rulings 339 to 348).
 *
 * A row's `[CHECK ...]` block may hand a choice to the target (`vs Evade or Guard`: ruling 338,
 * Mike: "on the right side of the 'vs' the target chooses"), and an adversary's Maneuver against
 * a player's character is rolled by the player (ruling 340, Mike: "players ALWAYS roll vs. NPCs").
 * Both wait on someone who is not the Maneuver's user, so both are a REQUEST card with buttons
 * for that someone, modelled on the Gain Control request (./gain-control.mjs):
 *
 *  - `mode: "answer"`. "Tess uses Trip (Athletics) on the Bandit. The Bandit answers with:
 *    [Evade] [Guard]". The target's player presses one (the GM for an adversary, or for a player
 *    who is away), which posts an ANSWER card naming the request, with a Roll button for the
 *    user's player. That roll is the normal check (`SwItem#resumeCheck`, documents/item.mjs),
 *    read against the Defense answered.
 *  - `mode: "roll"`. "The Bandit uses Trip (Athletics) on Tess. Tess rolls: [Roll Evade] [Roll
 *    Guard]". The character's player presses one and ROLLS that Defense as a check, against the
 *    adversary's number for the Constellation (`checkNumber`, data/actor.mjs), which is withheld
 *    as every adversary Threshold is. The GM's client then posts the Maneuver's RESULT card,
 *    spoken by the adversary, with the degree read from the other side (the player's Failure is
 *    the Maneuver's Success), the Maneuver's result rows and its APPLY buttons. Because that card
 *    is the adversary's own check card, the APPLY code (./apply.mjs) reads it as any other.
 *
 * NOTHING IS WRITTEN TO A REQUEST AFTER IT IS POSTED. Its state is read from the cards that name
 * it (`checkAnswer.from`, `check.from`), the first valid one in log order, so a reload, a second
 * client and a late press all read one record, and a player may answer a card they cannot edit.
 * Any user can create a chat message carrying those flags, so every reader checks the AUTHOR:
 * a REQUEST counts only from the GM or an owner of the creature using the Maneuver (`recordOf`:
 * one from anybody else is no request at all, so nothing answers it, rolls for it or posts a
 * result from it; the review of 0.34.0, since the GM's client acts on a roll by itself), an
 * answer only from someone who owns the target, a roll only from someone who owns the creature
 * that should have rolled (`validAnswer`, `standingAnswer`, rules/check-request.mjs).
 *
 * NO DEFENSE IS EVER CHOSEN BY THE SYSTEM (ruling 159): a request has buttons and no default.
 */

import * as SW from "../../config.mjs";
import { resolveActor, resolveTokenDoc } from "./shared.mjs";
import { sameBody } from "./give.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { ruleApplies } from "../../rules/engine.mjs";
import { immunityRecord } from "../../rules/prevent.mjs";
import { CHECK_REQUEST, CHECK_ANSWER, usableDefenses, validRequest, standingAnswer, requestState, userDegree } from "../../rules/check-request.mjs";

export { CHECK_REQUEST, CHECK_ANSWER };

const SYS = SW.SYSTEM_ID;
const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const defenseLabel = key => (SW.DEFENSES[key] ? L(SW.DEFENSES[key].label) : String(key ?? ""));

/** How far back in the chat log a request is kept in step with the cards that name it. */
const REDRAW_DEPTH = 60;

/** One press at a time for a request on this client. */
const PRESSING = new Set();

/* -------------------------------------------- */
/*  Posting a request                           */
/* -------------------------------------------- */

/**
 * Post the request and say the roll is waiting.
 * @param {object} args
 * @param {"answer"|"roll"} args.mode
 * @param {Actor} args.user            Who is using the Maneuver.
 * @param {Item} args.item             The Maneuver.
 * @param {TokenDocument} args.token   The one creature targeted.
 * @param {{slug: string, name: string}} args.rolled  What is rolled (the user's pick is made).
 * @param {string} [args.line]         The roll card's subtitle.
 * @param {string[]} args.defenses     The Defenses the row names.
 * @param {number} [args.cost]         What the roll will pay (0 when it is paid already).
 * @param {string} [args.label]        The spend's label.
 * @param {"none"|"turn"|"permit"} [args.gate]  How the roll passes the Opportunity gate.
 * @param {{cost: number|null, target: object|null}|null} [args.applies]  For the row's APPLY lines.
 * @param {{uuid: string, name: string}|null} [args.ally]
 * @param {boolean} [args.prepared]    A Prepared Maneuver, being finished.
 * @param {number|null} [args.paid]    The cost it was Prepared at.
 * @param {boolean} [args.dialog]      False when the roll is to open no window.
 * @param {string|null} [args.glyph]   What the card's head prints in place of the row's own cost,
 *                                     when a Condition raised it (0.37.0).
 * @returns {Promise<{pending: true, message: ChatMessage}|null>}
 */
export async function postCheckRequest({ mode, user, item, token, rolled, line = "", defenses = [], cost = 0, label = "", gate = "none", applies = null, ally = null, prepared = false, paid = null, dialog, traits = null, glyph = null } = {}) {
  const target = token?.actor ?? null;
  if (!user || !item || !target || !rolled?.slug) return null;
  const userToken = user.tokenOnScene?.() ?? null;
  const userName = userToken?.name ?? user.name;
  const targetName = token.name ?? target.name;
  // The Combat the user is fighting in, by membership and never by what this client views (the
  // GM may have another Combat on screen): the one a request lapses with.
  const combat = fightOf(user);
  const record = {
    mode: (mode === "roll") ? "roll" : "answer",
    userUuid: user.uuid, userName, userTokenUuid: userToken?.uuid ?? "",
    itemUuid: item.uuid, itemName: SW.plainName(item.name),
    // The Maneuver's traits (0.35.0): a card asks the target's immunity with them as it is drawn.
    // With the traits of a Maneuver it is performed as part of, when its caller hands them over
    // (the review of 0.35.0: an adversary's subordinate lost its parent's on the way to a request).
    traits: [...new Set([...(item.system?.traits ?? []), ...(Array.isArray(traits) ? traits : [])])],
    tokenUuid: token.uuid, targetUuid: target.uuid, targetName,
    rolled: { slug: String(rolled.slug), name: String(rolled.name || rolled.slug) },
    line: String(line ?? ""),
    defenses: [...defenses],
    cost: Number(cost) || 0, label: String(label ?? ""), gate,
    applies: applies ? { cost: applies.cost ?? null, target: applies.target ?? null } : null,
    ally: ally ?? null,
    prepared: prepared === true,
    paid: Number.isInteger(paid) ? paid : null,
    dialog: dialog !== false,
    combat: combat?.id ?? null, round: combat?.round ?? null
  };
  const names = { name: esc(userName), maneuver: esc(record.itemName), check: esc(record.rolled.name), target: esc(targetName) };
  const buttons = record.defenses.map(key => (record.mode === "roll")
    ? `<button type="button" data-sw-action="checkDefend" data-defense="${esc(key)}"><i class="fa-solid fa-dice-d20"></i> ${esc(F("STARWROUGHT.CheckRequest.rollDefense", { defense: defenseLabel(key) }))}</button>`
    : `<button type="button" data-sw-action="checkAnswer" data-defense="${esc(key)}"><i class="fa-solid fa-shield-halved"></i> ${esc(defenseLabel(key))}</button>`).join("");
  const content = `<div class="starwrought action-card sw-check-request" data-request-mode="${record.mode}">
    <h3><span class="sw-spend-glyph">${esc(glyph || (item.system?.glyph ?? ""))}</span> ${names.maneuver}</h3>
    <p>${F((record.mode === "roll") ? "STARWROUGHT.CheckRequest.asksRoll" : "STARWROUGHT.CheckRequest.asksAnswer", names)}</p>
    <div class="sw-card-buttons sw-check-defenses" data-owner-uuid="${esc(target.uuid)}">${buttons}</div>
    <div class="sw-card-buttons sw-check-withdraw" data-owner-uuid="${esc(user.uuid)}">
      <button type="button" data-sw-action="checkWithdraw"><i class="fa-solid fa-rotate-left"></i> ${esc(L("STARWROUGHT.CheckRequest.withdraw"))}</button>
    </div></div>`;
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: user }),
    content,
    flags: { [SYS]: { kind: CHECK_REQUEST, checkRequest: record } }
  });
  return { pending: true, message };
}

/** The started Combat an actor is a fighter in, or null: the one viewed first, then any other. */
function fightOf(actor) {
  const holds = combat => !!combat?.started && combat.combatants.some(c => c.actor?.id === actor?.id);
  if (holds(game.combat)) return game.combat;
  return game.combats?.find(holds) ?? null;
}

/* -------------------------------------------- */
/*  Reading the log                             */
/* -------------------------------------------- */

/**
 * Was this request posted by its user's side: the GM, or an owner of the creature using the
 * Maneuver? A `mode: "roll"` request is an adversary's alone (a character's Maneuver is rolled by
 * its own player), so one that names a character as its user is no request either.
 */
function postedByUserSide(message, request) {
  const author = message?.author ?? message?.user ?? null;
  const user = resolveActor(request?.userUuid);
  if (!author || !user) return false;
  return validRequest(request, {
    isGM: !!author.isGM,
    ownsUser: !!user.testUserPermission?.(author, "OWNER"),
    userIsCharacter: user.type === "character"
  });
}

/** A request card's record, or null: a card its user's side did not post is no request. */
function recordOf(message) {
  const flags = message?.flags?.[SYS];
  if (flags?.kind !== CHECK_REQUEST) return null;
  const request = flags.checkRequest ?? null;
  return (request && postedByUserSide(message, request)) ? request : null;
}

/** What a card's author may speak for, of the request's two creatures. */
function authorFacts(message, request) {
  const author = message?.author ?? message?.user ?? null;
  const owns = uuid => {
    const actor = resolveActor(uuid);
    return !!(author && actor?.testUserPermission?.(author, "OWNER"));
  };
  return { isGM: !!author?.isGM, ownsTarget: owns(request?.targetUuid), ownsUser: owns(request?.userUuid) };
}

/**
 * The answer that stands for a request: the first valid card that names it, in log order (a
 * Defense from the target's side, or a withdrawal from the user's).
 * @param {ChatMessage} requestMessage
 * @returns {{id: string, answer: object}|null}
 */
export function answerOf(requestMessage) {
  const request = recordOf(requestMessage);
  if (!request) return null;
  const answers = [];
  for (const message of game.messages?.contents ?? []) {
    const flags = message.flags?.[SYS];
    if ((flags?.kind !== CHECK_ANSWER) || (flags.checkAnswer?.from !== requestMessage.id)) continue;
    answers.push({ id: message.id, answer: flags.checkAnswer, author: authorFacts(message, request) });
  }
  return standingAnswer(request, answers);
}

/** Is this check card a roll the request can take: by the creature that should roll, from its side? */
function validRoll(message, request, requestId) {
  const flags = message?.flags?.[SYS];
  if ((flags?.kind !== "check") || (flags.check?.from !== requestId) || flags.check.resultOf) return false;
  if (!request) return false;
  const roller = resolveActor(flags.actorUuid);
  const expected = resolveActor((request.mode === "roll") ? request.targetUuid : request.userUuid);
  if (roller && expected && !sameBody(roller, expected)) return false;
  const facts = authorFacts(message, request);
  return facts.isGM || ((request.mode === "roll") ? facts.ownsTarget : facts.ownsUser);
}

/**
 * The roll a request was waiting on, once made: one request gives one roll. A reroll of that
 * roll names the request too, and is the same roll thrown again.
 * @param {string} requestId
 * @returns {ChatMessage|null}
 */
export function resultOf(requestId) {
  if (!requestId) return null;
  const request = recordOf(game.messages?.get(requestId));
  for (const message of game.messages?.contents ?? []) {
    if (validRoll(message, request, requestId)) return message;
  }
  return null;
}

/**
 * Is this roll card THE roll of its request: the first valid one in the log, or that one thrown
 * again? Two presses inside one moment (two tabs of one player, the player and the GM) can each
 * post a roll; only the first counts, and the other gets no result.
 * @param {ChatMessage} rollCard
 * @returns {boolean}
 */
export function countsForRequest(rollCard) {
  const from = rollCard?.flags?.[SYS]?.check?.from;
  const standing = from ? resultOf(from) : null;
  if (!standing) return false;
  let card = rollCard;
  for (let step = 0; card && (step < 20); step += 1) {
    if (card.id === standing.id) return true;
    const before = card.flags?.[SYS]?.rerollOf;
    card = before ? game.messages.get(before) : null;
  }
  return false;
}

/**
 * Is this request still waiting on somebody: not yet answered, or answered and not yet rolled?
 * A Prepared Maneuver's Finish asks it of the request that preparation already posted, so one
 * preparation has one request at a time (documents/actor/actions.mjs).
 * @param {string} requestId
 * @returns {boolean}
 */
export function requestWaiting(requestId) {
  const message = requestId ? game.messages.get(requestId) : null;
  const st = message ? stateOf(message) : null;
  return !!st && ["open", "answered"].includes(st.state);
}

/**
 * May the roll a request waits on be thrown now? Asked again as the die is thrown, since the
 * request may have been rolled, withdrawn or lapsed while the roll window stood open.
 * @param {string} requestId
 * @param {{mode: "answer"|"roll", defense?: string}} how  For an answered request, the Defense
 *   the roll is about to be read against: the answer that stands must still be that one.
 * @returns {boolean}  False after saying why.
 */
export function requestStillWaits(requestId, { mode, defense = null } = {}) {
  const message = requestId ? game.messages.get(requestId) : null;
  const st = message ? stateOf(message) : null;
  if (!st) {
    ui.notifications.warn(L("STARWROUGHT.CheckRequest.gone"));
    return false;
  }
  const wanted = (mode === "roll") ? "open" : "answered";
  if ((st.state === wanted) && ((mode === "roll") || (st.answer?.answer?.defense === defense))) return true;
  ui.notifications.info(L((st.state === "open") ? "STARWROUGHT.CheckRequest.noAnswer" : (STATE_NOTE[st.state] ?? "STARWROUGHT.CheckRequest.rolled")));
  return false;
}

/** The Maneuver's result card for a player's roll (`mode: "roll"`), when the GM's client posted one. */
export function resultCardOf(rollId) {
  if (!rollId) return null;
  for (const message of game.messages?.contents ?? []) {
    if (message.flags?.[SYS]?.check?.resultOf === rollId) return message;
  }
  return null;
}

/**
 * Where a request stands, from the log.
 * @param {ChatMessage} requestMessage
 * @returns {{request: object, answer: {id: string, answer: object}|null, result: ChatMessage|null, state: string}|null}
 */
export function stateOf(requestMessage) {
  const request = recordOf(requestMessage);
  if (!request) return null;
  const answer = answerOf(requestMessage);
  const result = resultOf(requestMessage.id);
  const combatGone = !!request.combat && !game.combats?.get(request.combat);
  return { request, answer, result, state: requestState({ answer: answer?.answer ?? null, rolled: !!result, combatGone }) };
}

/** The Defenses of a request its target can use now. */
function usableNow(request) {
  const target = resolveActor(request.targetUuid);
  return usableDefenses(request.defenses, key => target?.system?.defenses?.[key]?.unavailable);
}

/** An adversary's number for the Constellation its Maneuver rolls, in effect (ruling 341). */
export function checkRequestThreshold(check) {
  const user = resolveActor(check?.userUuid);
  const number = user?.system?.checkNumber?.(check?.slug ?? "");
  return Number.isFinite(number?.threshold) ? number.threshold : null;
}

/* -------------------------------------------- */
/*  The buttons                                 */
/* -------------------------------------------- */

const STATE_NOTE = Object.freeze({
  answered: "STARWROUGHT.CheckRequest.alreadyAnswered",
  rolled: "STARWROUGHT.CheckRequest.rolled",
  withdrawn: "STARWROUGHT.CheckRequest.stateWithdrawn",
  lapsed: "STARWROUGHT.CheckRequest.stateLapsed"
});

/** Hold a request to one press at a time on this client. */
async function once(key, fn) {
  if (PRESSING.has(key)) return null;
  PRESSING.add(key);
  try {
    return await fn();
  } finally {
    PRESSING.delete(key);
  }
}

/** The request a button's card speaks of, open for this press, or a notice and null. */
function openRequest(message, mode) {
  const st = stateOf(message);
  if (!st || (st.request.mode !== mode)) return null;
  if (st.state !== "open") {
    ui.notifications.info(L(STATE_NOTE[st.state] ?? "STARWROUGHT.CheckRequest.rolled"));
    return null;
  }
  return st;
}

/** The Defense a button names, when the request offers it and the target can use it. */
function pressedDefense(button, request) {
  const defense = button?.dataset?.defense;
  if (!request.defenses.includes(defense)) return null;
  if (!usableNow(request).includes(defense)) {
    ui.notifications.warn(F("STARWROUGHT.CheckRequest.unavailable", { target: request.targetName, defense: defenseLabel(defense) }));
    return null;
  }
  return defense;
}

/** The target's side of a request: its owner, or the GM. */
function mayAnswer(request) {
  const target = resolveActor(request.targetUuid);
  if (!target) return void ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
  if (!(target.isOwner || game.user.isGM)) return void ui.notifications.warn(F("STARWROUGHT.CheckRequest.notYours", { target: request.targetName }));
  return target;
}

/**
 * The request card's Defense button (`mode: "answer"`): the target answers, and the answer card
 * carries the Roll button for the user's player.
 */
export async function answerFromCard(message, flags, button) {
  return once(`answer:${message.id}`, async () => {
    const st = openRequest(message, "answer");
    if (!st) return null;
    const request = st.request;
    const target = mayAnswer(request);
    if (!target) return null;
    const defense = pressedDefense(button, request);
    if (!defense) return null;
    const user = resolveActor(request.userUuid);
    const names = { target: esc(request.targetName), defense: esc(defenseLabel(defense)), check: esc(request.rolled.name), name: esc(request.userName) };
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: target, token: resolveTokenDoc(request.tokenUuid) ?? undefined }),
      content: `<div class="starwrought action-card sw-check-answer">
        <h3>${esc(request.itemName)}</h3>
        <p>${F("STARWROUGHT.CheckRequest.answered", names)}</p>
        <div class="sw-card-buttons sw-check-roll" data-owner-uuid="${esc(user?.uuid ?? request.userUuid)}">
          <button type="button" data-sw-action="checkRoll"><i class="fa-solid fa-dice-d20"></i> ${esc(F("STARWROUGHT.CheckRequest.rollButton", { check: request.rolled.name }))}</button>
        </div></div>`,
      flags: { [SYS]: { kind: CHECK_ANSWER, checkAnswer: { from: message.id, defense } } }
    });
  });
}

/** The request card's Withdraw button: the user's side takes the request back before the roll. */
export async function withdrawFromCard(message) {
  return once(`answer:${message.id}`, async () => {
    const st = stateOf(message);
    if (!st) return null;
    if (!["open", "answered"].includes(st.state)) {
      ui.notifications.info(L(STATE_NOTE[st.state] ?? "STARWROUGHT.CheckRequest.rolled"));
      return null;
    }
    const request = st.request;
    const user = resolveActor(request.userUuid);
    if (!user) return void ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
    if (!(user.isOwner || game.user.isGM)) return void ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    // An answer already stands: the withdrawal must come first in the log to stand, which it
    // cannot, so the request is closed by the user simply not rolling. Said, so the press is not silent.
    if (st.state === "answered") {
      ui.notifications.info(L("STARWROUGHT.CheckRequest.withdrawTooLate"));
      return null;
    }
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: user }),
      content: `<div class="starwrought action-card sw-check-answer">
        <h3>${esc(request.itemName)}</h3>
        <p>${F("STARWROUGHT.CheckRequest.withdrew", { name: esc(request.userName), maneuver: esc(request.itemName) })}</p></div>`,
      flags: { [SYS]: { kind: CHECK_ANSWER, checkAnswer: { from: message.id, withdrawn: true } } }
    });
  });
}

/**
 * The Roll button, on the answer card or on the request card once answered: the user's roll,
 * against the Defense that stands.
 */
export async function rollFromCard(message, flags) {
  const requestMessage = (flags?.kind === CHECK_ANSWER) ? game.messages.get(flags.checkAnswer?.from) : message;
  const st = requestMessage ? stateOf(requestMessage) : null;
  if (!st) return void ui.notifications.warn(L("STARWROUGHT.CheckRequest.gone"));
  if (st.state !== "answered") {
    ui.notifications.info(L((st.state === "open") ? "STARWROUGHT.CheckRequest.noAnswer" : (STATE_NOTE[st.state] ?? "STARWROUGHT.CheckRequest.rolled")));
    return null;
  }
  if ((flags?.kind === CHECK_ANSWER) && (st.answer.id !== message.id)) {
    return void ui.notifications.warn(L("STARWROUGHT.CheckRequest.void"));
  }
  let item = null;
  try { item = await fromUuid(st.request.itemUuid); } catch { item = null; }
  if (!item || (typeof item.resumeCheck !== "function")) return void ui.notifications.warn(L("STARWROUGHT.CheckRequest.itemGone"));
  return item.resumeCheck(st.request, { requestId: requestMessage.id, defense: st.answer.answer.defense });
}

/**
 * The request card's Roll button (`mode: "roll"`; ruling 340): the character's player rolls the
 * Defense they pick, as a check, against the adversary's number for the Constellation its
 * Maneuver rolls. The number is withheld whoever presses, as on a Gain Control's Guard: the card
 * is public and spoken by the character.
 */
export async function defendFromCard(message, flags, button) {
  return once(`answer:${message.id}`, async () => {
    const st = openRequest(message, "roll");
    if (!st) return null;
    const request = st.request;
    const target = mayAnswer(request);
    if (!target) return null;
    const defense = pressedDefense(button, request);
    if (!defense) return null;
    const user = resolveActor(request.userUuid);
    if (!user) return void ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
    let item = null;
    try { item = await fromUuid(request.itemUuid); } catch { item = null; }
    const check = { from: message.id, inverted: true, defense, userUuid: request.userUuid, itemUuid: request.itemUuid, slug: request.rolled.slug };
    const threshold = checkRequestThreshold(check) ?? 10;
    const userToken = resolveTokenDoc(request.userTokenUuid) ?? user.tokenOnScene?.() ?? null;
    const userName = userToken?.name ?? request.userName ?? user.name;
    // The row names this Defense alone and the character cannot use it now: it is still the one
    // rolled, and the window and the card say so (ruling 345), as a character's own use does.
    // The character is immune to a trait the Maneuver carries (0.35.0): said in the window, and
    // the roll is still theirs to make. The card says it for itself as it is posted.
    const immune = immunityRecord(target, request.targetName, request.traits ?? item?.system?.traits ?? [], { other: user });
    const blocked = target.system?.defenses?.[defense]?.unavailable ?? null;
    const blockedNote = blocked
      ? F("STARWROUGHT.CheckRequest.rollUnavailable", { target: request.targetName, defense: defenseLabel(defense), reason: L(SW.conditionNameKey(blocked)) })
      : "";
    return SwCheck.roll({
      actor: target,
      kind: "check",
      slug: SW.DEFENSES[defense].slug,
      label: defenseLabel(defense),
      subtitle: F("STARWROUGHT.CheckRequest.defendSubtitle", { name: userName, maneuver: request.itemName, check: request.rolled.name }),
      threshold,
      thresholdLabel: F("STARWROUGHT.CheckRequest.thresholdLabel", { name: userName, check: request.rolled.name }),
      ...(blockedNote ? { targetNote: blockedNote } : {}),
      ...(immune ? { immuneNote: immune.note } : {}),
      targetDefense: {
        key: null, label: "", threshold: null, unavailable: blockedNote || null, hidden: true,
        heading: L("STARWROUGHT.Roll.readAgainst"),
        note: F("STARWROUGHT.CheckRequest.hiddenNumber", { name: userName, check: request.rolled.name }),
        hint: F("STARWROUGHT.CheckRequest.hiddenNumberHint", { name: userName, maneuver: request.itemName })
      },
      withholdThreshold: true,
      // The other party of the roll is the adversary, and the Threat its check, so the
      // character's `AGAINST(<Constellation>)`, `MARKED` and `IFT:` lines hold as they would
      // against that check read the other way round.
      targetUuid: userToken?.uuid ?? "",
      targetName: userName,
      targetActor: user,
      // The request's own traits, which the window above read too, so the card says what the
      // window said though the Item is gone or the Maneuver was part of another.
      threat: { threat: "check", melee: false, traits: Array.isArray(request.traits) ? request.traits : (item?.system?.traits ?? []), check: request.rolled.slug },
      checkRequest: check,
      // Once more as the die is thrown: another client of this player may have rolled meanwhile,
      // or the GM withdrawn the request, or its Combat ended.
      beforeRoll: () => requestStillWaits(message.id, { mode: "roll" })
    });
  });
}

/* -------------------------------------------- */
/*  The Maneuver's result, from the other side  */
/* -------------------------------------------- */

/**
 * Post the result of an adversary's Maneuver from the roll a player made for it (`mode: "roll"`),
 * on a client that owns the adversary (the GM's). The card is the adversary's own check card: the
 * same die, the degree read from the other side, the Maneuver's result rows, and its APPLY and
 * REMOVE lines, so the adversary's own land at once and the target's are the GM's button
 * (./apply.mjs, unchanged). A reroll of the player's card gets a new result card, which names
 * the one it replaces, so what the first die put on is taken back.
 * @param {ChatMessage} rollCard  The player's Defense check card.
 * @returns {Promise<object|null>}
 */
export async function postManeuverResult(rollCard) {
  const flags = rollCard?.flags?.[SYS];
  const check = flags?.check;
  if ((flags?.kind !== "check") || !check?.inverted || !check.from || check.resultOf) return null;
  if (!flags.degree || resultCardOf(rollCard.id)) return null;
  // Only for a request its user's side posted (`recordOf`), only in `mode: "roll"`, only while it
  // is not withdrawn, and only for its one roll or that roll thrown again. A card with the right
  // flags and no such request behind it does nothing here: this runs unasked on the GM's client.
  const requestMessage = game.messages.get(check.from);
  const request = recordOf(requestMessage);
  if (!request || (request.mode !== "roll")) return null;
  if (!validRoll(rollCard, request, check.from) || !countsForRequest(rollCard)) return null;
  if (answerOf(requestMessage)?.answer?.withdrawn) return null;
  const user = resolveActor(request.userUuid);
  if (!user?.isOwner) return null;
  return once(`result:${rollCard.id}`, async () => {
    if (resultCardOf(rollCard.id)) return null;
    let item = null;
    try { item = await fromUuid(request.itemUuid); } catch { item = null; }
    const source = rollCard.rolls?.[0];
    if (!source) return null;
    const roll = Roll.fromData(source.toJSON());
    const natural = roll.dice[0]?.results?.[0]?.result ?? null;
    const degree = userDegree(flags.degree);
    const target = resolveActor(flags.actorUuid);
    const targetToken = request?.tokenUuid ? resolveTokenDoc(request.tokenUuid) : null;
    const targetName = targetToken?.name ?? request?.targetName ?? target?.name ?? "";
    const userToken = resolveTokenDoc(request?.userTokenUuid) ?? user.tokenOnScene?.() ?? null;
    const userName = userToken?.name ?? request?.userName ?? user.name;
    const plain = SW.plainName(item?.name ?? request?.itemName ?? "");
    const maneuver = { slug: SW.slugify(plain), name: plain };
    // What the Maneuver puts on a creature: the adversary's lines, asked as its own use would
    // ask them (it has no rank, so only the lines that ask for none stand).
    let applied = null;
    if (item && request?.applies) {
      const asked = ruleApplies(user, { item, rank: "untrained" });
      if (asked.lines.length) {
        applied = {
          lines: asked.lines, maneuver,
          target: target ? { uuid: target.uuid, name: targetName } : null,
          cost: request.applies.cost ?? null,
          combat: request.combat ?? null
        };
      }
    }
    // A reroll of the player's roll: the result it replaces.
    const previous = flags.rerollOf ? resultCardOf(flags.rerollOf) : null;
    const cfg = {
      actor: user,
      item,
      kind: "check",
      slug: request?.rolled?.slug ?? check.slug ?? "",
      rank: null,
      label: plain || L("STARWROUGHT.Roll.check"),
      subtitle: F("STARWROUGHT.CheckRequest.resultSubtitle", {
        target: targetName, defense: defenseLabel(check.defense),
        theirs: L(SW.DEGREES[flags.degree]?.label ?? ""), name: userName
      }),
      outcomes: item?.checkOutcomes ?? null,
      applied,
      threshold: null,
      thresholdLabel: "",
      withholdThreshold: true,
      targetUuid: targetToken?.uuid ?? "",
      rollMode: rollCard.whisper?.length ? "gmroll" : "publicroll",
      checkRequest: { from: check.from, resultOf: rollCard.id },
      // The request's traits (0.35.0), for the result card's own note and for its Apply to ask
      // with: the Maneuver's own and those of one it was performed as part of.
      ...(Array.isArray(request.traits) ? { itemTraits: [...request.traits] } : {}),
      ...(previous ? { rerollOf: previous.id, rerollReason: flags.rerollReason ?? "" } : {})
    };
    const result = {
      roll, natural, total: roll.total,
      threshold: null, thresholdLabel: "",
      degree, outcome: SW.ATTACK_OUTCOMES[degree] ?? null, critDenied: false,
      modifiers: [], extras: [], modTotal: 0,
      config: cfg
    };
    await SwCheck.postResult(result);
    if (previous && !previous.flags?.[SYS]?.superseded) {
      await previous.update({ [`flags.${SYS}.superseded`]: { by: result.message?.id ?? null, reason: flags.rerollReason ?? "" } })
        .catch(err => console.error("STARWROUGHT | the replaced result card could not be marked", err));
    }
    return result;
  });
}

/** The GM's button on a player's roll whose result was never posted (the GM was away). */
export async function postResultFromCard(message) {
  if (!game.user.isGM) return void ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
  return postManeuverResult(message);
}

/* -------------------------------------------- */
/*  Drawing                                     */
/* -------------------------------------------- */

function note(card, text, warn = false) {
  const p = document.createElement("p");
  p.className = warn ? "sw-card-note sw-warn" : "sw-card-note";
  p.textContent = text;
  card.append(p);
  return p;
}

function rollRow(card, request, action = "checkRoll") {
  const row = document.createElement("div");
  row.className = "sw-card-buttons sw-check-roll";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.swAction = action;
  button.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${esc(F("STARWROUGHT.CheckRequest.rollButton", { check: request.rolled.name }))}`;
  row.append(button);
  card.append(row);
}

/**
 * A request, an answer, and a player's roll for an adversary's Maneuver, drawn from the log (the
 * chat render pass calls this after the owner-gated rows have been pruned).
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {object} flags
 */
export function drawCheckRequest(message, html, flags) {
  const card = html.querySelector(".starwrought") ?? html;
  if (flags?.kind === CHECK_REQUEST) return drawRequest(message, card);
  if (flags?.kind === CHECK_ANSWER) return drawAnswer(message, card, flags);
  if ((flags?.kind === "check") && flags.check?.inverted && !flags.check.resultOf && !flags.superseded) {
    if (!countsForRequest(message)) {
      // A second roll for one request (two presses inside one moment): the first stands.
      if (recordOf(game.messages.get(flags.check.from))) note(card, L("STARWROUGHT.CheckRequest.secondRoll"), true);
      return;
    }
    // The GM was away when the player rolled: the result is one press.
    if (game.user.isGM && !resultCardOf(message.id) && flags.degree) {
      const row = document.createElement("div");
      row.className = "sw-card-buttons sw-check-result";
      const user = resolveActor(flags.check.userUuid);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.swAction = "checkResult";
      button.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${esc(F("STARWROUGHT.CheckRequest.postResult", { name: user?.name ?? "" }))}`;
      row.append(button);
      card.append(row);
    }
  }
}

function drawRequest(message, card) {
  const st = stateOf(message);
  if (!st) return;
  const { request, state } = st;
  const names = { target: request.targetName, name: request.userName };
  // The target is immune to a trait the Maneuver carries (0.35.0): said while the request still
  // waits, read as the card is drawn, and the card is drawn again when a Condition comes to the
  // target or goes (`registerCheckRequestCards`), so a creature Blinded since the request was
  // posted is said to be, and one cured is not. Nothing is refused: the answer and the roll are
  // still theirs to make.
  if (["open", "answered"].includes(state) && Array.isArray(request.traits) && request.traits.length) {
    const target = resolveActor(request.targetUuid);
    const immune = target ? immunityRecord(target, request.targetName, request.traits, { other: resolveActor(request.userUuid) }) : null;
    if (immune) note(card, immune.note, true);
  }
  if (state === "open") {
    const usable = usableNow(request);
    for (const button of card.querySelectorAll("[data-defense]")) {
      if (usable.includes(button.dataset.defense)) continue;
      button.disabled = true;
      button.dataset.tooltip = F("STARWROUGHT.CheckRequest.unavailable", { target: request.targetName, defense: defenseLabel(button.dataset.defense) });
    }
    // An adversary's side is the GM's: with none connected the request waits, and says so.
    const target = resolveActor(request.targetUuid);
    if (target && !target.hasPlayerOwner && !game.users.activeGM) note(card, L("STARWROUGHT.CheckRequest.noGM"), true);
    return;
  }
  for (const el of card.querySelectorAll(".sw-check-defenses, .sw-check-withdraw")) el.remove();
  if (state === "answered") {
    note(card, F("STARWROUGHT.CheckRequest.stateAnswered", { ...names, defense: defenseLabel(st.answer.answer.defense) }));
    if (resolveActor(request.userUuid)?.isOwner) rollRow(card, request);
    return;
  }
  note(card, (state === "rolled")
    ? F("STARWROUGHT.CheckRequest.stateRolled", names)
    : L(STATE_NOTE[state] ?? "STARWROUGHT.CheckRequest.rolled"));
}

function drawAnswer(message, card, flags) {
  const requestMessage = game.messages.get(flags.checkAnswer?.from);
  const st = requestMessage ? stateOf(requestMessage) : null;
  const drop = () => { for (const el of card.querySelectorAll(".sw-check-roll")) el.remove(); };
  if (!st) {
    drop();
    note(card, L("STARWROUGHT.CheckRequest.gone"));
    return;
  }
  if (st.answer?.id !== message.id) {
    drop();
    note(card, L("STARWROUGHT.CheckRequest.void"), true);
    return;
  }
  if (st.state !== "answered") drop();
}

/* -------------------------------------------- */
/*  Keeping the cards in step                   */
/* -------------------------------------------- */

let registered = false;

/**
 * A card is not drawn again by itself, and a request's state is other cards: so when a card that
 * names a request appears or goes, the request and the cards beside it are drawn again, on every
 * client; and when a Combat ends, the open requests made in it are (they have lapsed). The GM's
 * client also posts the result of an adversary's Maneuver as the player's roll arrives.
 * Idempotent; called once at ready.
 */
export function registerCheckRequestCards() {
  if (registered) return;
  registered = true;
  const redraw = message => {
    if (!message) return;
    try {
      Promise.resolve(ui.chat?.updateMessage?.(message)).catch(() => {});
    } catch { /* the chat log is not there to redraw */ }
  };
  const linked = message => {
    const own = message?.flags?.[SYS];
    const from = own?.checkAnswer?.from ?? own?.check?.from ?? null;
    if (from) {
      redraw(game.messages.get(from));
      for (const other of (game.messages?.contents ?? []).slice(-REDRAW_DEPTH)) {
        if ((other.id !== message.id) && (other.flags?.[SYS]?.checkAnswer?.from === from)) redraw(other);
      }
    }
    if (own?.check?.resultOf) redraw(game.messages.get(own.check.resultOf));
  };
  Hooks.on("createChatMessage", message => {
    linked(message);
    // Players always roll against adversaries (ruling 340): the roll is the player's, the result
    // the adversary's, posted by the one GM client the table has.
    const own = message?.flags?.[SYS];
    if ((own?.kind === "check") && own.check?.inverted && !own.check.resultOf && (game.users.activeGM?.id === game.user.id)) {
      postManeuverResult(message).catch(err => console.error("STARWROUGHT | the result of an adversary's Maneuver could not be posted", err));
    }
  });
  Hooks.on("deleteChatMessage", linked);
  // A waiting request says whether its target is immune (0.35.0), and that is the target's
  // Conditions as they stand: when one comes or goes, the requests that name the creature and
  // carry a trait are drawn again (the review of 0.35.0: the note was only as fresh as the card's
  // last draw). A redraw reads; nothing is written.
  const conditionsMoved = effect => {
    const actor = (effect?.parent?.documentName === "Actor") ? effect.parent : null;
    if (!actor) return;
    for (const message of (game.messages?.contents ?? []).slice(-REDRAW_DEPTH)) {
      const request = recordOf(message);
      // A request with a trait says whether its target is immune; one that names two Defenses
      // disables the button of a Defense the target cannot use (0.38.0: through 0.37.0 only the
      // first was drawn again, so a button stayed disabled after Escape had freed the target).
      if (!request || !(request.traits?.length || ((request.defenses?.length ?? 0) > 1))) continue;
      const target = resolveActor(request.targetUuid);
      if (target && sameBody(target, actor)) redraw(message);
    }
  };
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(hook, conditionsMoved);
  Hooks.on("deleteCombat", combat => {
    for (const message of (game.messages?.contents ?? []).slice(-REDRAW_DEPTH)) {
      if (recordOf(message)?.combat === combat.id) redraw(message);
    }
  });
}
