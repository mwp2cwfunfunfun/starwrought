/**
 * Applying what a Maneuver puts on a creature (0.32.0; rulings 311 to 321): the write behind an
 * `APPLY` or `REMOVE` line, the button on a check card for a line about another creature, and the
 * record that it was done.
 *
 * A check made from a Maneuver's Item whose row carries APPLY or REMOVE lines writes
 * `flags.applies` on its card: every line at the rank rolled, each with the degree and the cost it
 * waits on, the cost this use was paid at, the one creature targeted and the Combat
 * (rules/engine.mjs, `ruleApplies`; dice/check.mjs). Then (Mike, 2026-11-17, by question: "Auto
 * on self, button for others"):
 *
 *   ON THE ROLLER   the lines that stand for the degree rolled land at once, on the roller's own
 *                   client, as the card is posted (`applyOwnFromCard`). Never from a blind roll,
 *                   whose degree the roller may not know: there the GM gets the button.
 *   ON A TARGET     nothing lands by itself. The render pass draws a button for the roller's owner
 *                   and the GM, "Apply to Bandit: Prone"; pressing it writes on the ONE client
 *                   that may (`writerFor`: the active GM's, else the creature's first active
 *                   owner's), asked over the system socket as `effect:apply` from any other.
 *
 * Either way one RECORD CARD is posted, spoken by the roller, naming the check card and which side
 * it settled (`flags.starwrought { kind: "applied", from, who }`). The record is what makes a
 * result applied once: the button gives way to the record's words on every client, after a reload
 * too. A reroll is a new card: what the first die put on the roller is taken back before the new
 * degree's lines land; what it put on another creature stays for the GM to take off.
 *
 * A Maneuver with no check has no such card: its lines of no degree are applied by the use itself
 * and said on the Maneuver's own card (documents/item.mjs, `#applyOnUse`), through `applyLinesTo`
 * below, which every path shares.
 *
 * TRIGGERED, so the three answers rules/README.md asks of a triggered moment:
 *
 *   WHO WRITES. The roller's own client for the roller's own lines. For a target, one client
 *   (`writerFor`), and one application of a card's side at a time on it (`applying`).
 *   THE EVENT. The check card's message id and the side, `self` or `target`. The record card names
 *   both, and each applied Effect's own record names the card (`from`).
 *   FAILURE. A line that cannot be written is said on the record card with why (prevented, already
 *   there by other means, a window with no encounter to count in). A request that cannot be served
 *   writes nothing, posts nothing and tells the presser.
 *
 * The executing client trusts a request for two things, which side and which creature. The lines,
 * the degree, the cost and the Maneuver are read again from the check card; the asker is the
 * server's stamp on the socket message and must own the card's roller (or be a GM).
 */

import * as SW from "../../config.mjs";
import { immunityRecord } from "../../rules/prevent.mjs";
import { SOCKET, replyTo, resolveActor } from "./shared.mjs";
import { postCard } from "../../helpers/cards.mjs";
import { sameBody, wasRerolled, writerFor } from "./give.mjs";
import { linesFor, appliedRecord, appliedWindow, effectWords, lineWords, wordsToSay } from "../../rules/applied.mjs";
import { untilWords } from "../../rules/operators.mjs";
import { applyEffectTo, removeEffectFrom, removeAppliedFrom } from "../../rules/effects-state.mjs";

/** The `flags.starwrought.kind` of the record card. */
export const APPLIED_CARD = "applied";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));

/** Why an application was refused, by the reply's `reason`. */
const REFUSALS = Object.freeze({
  noCard: "STARWROUGHT.Applied.refusedNoCard",
  superseded: "STARWROUGHT.Applied.refusedSuperseded",
  already: "STARWROUGHT.Applied.refusedAlready",
  notYours: "STARWROUGHT.Applied.refusedNotYours",
  nothing: "STARWROUGHT.Applied.refusedNothing",
  recipient: "STARWROUGHT.Applied.refusedRecipient",
  cannotWrite: "STARWROUGHT.Applied.refusedCannotWrite"
});

/* -------------------------------------------- */
/*  Reading a card                              */
/* -------------------------------------------- */

/**
 * The records that a check card's lines were applied: the flags of the record cards that name it,
 * by side. Read from the chat log, so every client and a reload agree with no write to the check
 * card (which only its author or a GM could make).
 * @param {string} messageId  The check card's id.
 * @returns {{self: object|null, target: object|null}}
 */
export function appliedRecords(messageId) {
  const out = { self: null, target: null };
  if (!messageId) return out;
  for (const message of game.messages?.contents ?? []) {
    const flags = message.flags?.[SW.SYSTEM_ID];
    if ((flags?.kind !== APPLIED_CARD) || (flags.from !== messageId)) continue;
    out[(flags.who === "target") ? "target" : "self"] ??= flags;
  }
  return out;
}

/** The lines of one side that stand for the card's own degree and the cost its use was paid at. */
function standing(flags, who) {
  const side = (flags?.applies?.lines ?? []).filter(line => ((line?.who === "target") ? "target" : "self") === who);
  return linesFor(side, { degree: flags?.degree ?? null, cost: flags?.applies?.cost ?? null });
}

/**
 * The encounter a window is counted in (ruling 316): a started Combat that the creature that used
 * the Maneuver, or the one the Effect goes on, is a fighter in. By MEMBERSHIP, never by what this
 * client has on screen: the one writer for a target is usually the GM's client, which may be
 * viewing another scene or another Combat (the review of 0.32.0), and a Combat on screen that
 * neither creature is part of is somebody else's fight (found live). The Combat the check was
 * rolled in is tried first, then the one viewed, then every other.
 * @param {Actor} giver
 * @param {Actor} recipient
 * @param {string|null} [preferred]  The Combat's id the check card recorded, if any.
 * @returns {Combat|null}
 */
function runningCombat(giver, recipient, preferred = null) {
  const combats = globalThis.game?.combats;
  const fights = (combat, actor) => !!actor && ((combat.getCombatantsByActor?.(actor)?.length ?? 0) > 0);
  const tried = [];
  const add = combat => { if (combat?.started && !tried.includes(combat)) tried.push(combat); };
  if (preferred) add(combats?.get?.(preferred));
  add(globalThis.game?.combat);
  for (const combat of combats ?? []) add(combat);
  return tried.find(combat => fights(combat, giver) || fights(combat, recipient)) ?? null;
}

/* -------------------------------------------- */
/*  The write every path shares                 */
/* -------------------------------------------- */

/**
 * What became of one line, in a sentence for a card. Plain text: the caller escapes it where it
 * builds markup (the Maneuver's own card escapes its lines itself).
 */
function wordsFor(recipient, giver, line, result, record) {
  const name = recipient.name;
  const effect = effectWords(line.effect);
  const condition = !!line.effect?.condition;
  if (line.op === "remove") {
    if (result?.ok) return F(condition ? "STARWROUGHT.Applied.offCondition" : "STARWROUGHT.Applied.offEffect", { name, effect });
    if (result?.skipped === "held") return F("STARWROUGHT.Applied.held", { name, effect });
    return F("STARWROUGHT.Applied.absent", { name, effect });
  }
  if (result?.ok) {
    // The window as it was really set: one whose Opportunities cannot be counted lasts the encounter.
    const until = record?.until ? ((record.until.who === "encounter") ? { who: "encounter", n: 0 } : line.until) : null;
    // The creature already named in the sentence is "their" the second time: "Tess is Off-Guard
    // until their next Opportunity".
    const own = sameBody(giver, recipient);
    const window = until ? ` ${untilWords(until, { giver: own ? "they" : giver.name, recipient: "they" })}` : "";
    const key = result.refreshed
      ? (condition ? "STARWROUGHT.Applied.stillCondition" : "STARWROUGHT.Applied.stillEffect")
      : (condition ? "STARWROUGHT.Applied.onCondition" : "STARWROUGHT.Applied.onEffect");
    return F(key, { name, effect, window });
  }
  switch (result?.skipped) {
    case "window": return F("STARWROUGHT.Applied.noEncounter", { name, effect });
    case "prevented": return F("STARWROUGHT.Applied.prevented", { name, effect });
    case "stronger": return F("STARWROUGHT.Applied.stronger", { name, effect });
    default: return F("STARWROUGHT.Applied.otherMeans", { name, effect });
  }
}

/**
 * Apply lines to one creature, on a client that may write it, and say what became of each. The
 * one write behind the roller's own lines, a target's, and a Maneuver used with no check.
 * @param {Actor} recipient
 * @param {object[]} lines   The lines that stand (rules/applied.mjs, `linesFor`).
 * @param {object} options
 * @param {Actor} options.giver                         Who used the Maneuver.
 * @param {{slug: string, name: string}} options.maneuver
 * @param {string|null} [options.from]                  The check card, or null for a use with no check.
 * @param {boolean} [options.force]                     The user's own act: never prevented (ruling 315).
 * @param {string|null} [options.combat]                The Combat the check was rolled in, tried first.
 * @returns {Promise<Array<{line: object, result: object, words: string}>>}
 */
export async function applyLinesTo(recipient, lines, { giver, maneuver, from = null, force = false, combat: preferred = null } = {}) {
  const combat = runningCombat(giver, recipient, preferred);
  const combatantOf = actor => combat?.getCombatantsByActor?.(actor)?.[0]?.id ?? null;
  const out = [];
  for (const line of lines ?? []) {
    let result;
    let record = null;
    try {
      if (line.op === "remove") {
        result = await removeEffectFrom(recipient, line);
      } else {
        const until = (line.until && combat)
          ? appliedWindow(line.until, { giverCombatant: combatantOf(giver), recipientCombatant: combatantOf(recipient) })
          : null;
        record = appliedRecord({
          effect: line.effect, maneuver,
          giver: { uuid: giver?.uuid ?? "", name: giver?.name ?? "" },
          combat: combat?.id ?? null, until, from
        });
        result = await applyEffectTo(recipient, line, record, { force });
      }
    } catch (error) {
      console.error(`STARWROUGHT | ${effectWords(line.effect)} could not be written on ${recipient?.name}:`, error);
      continue;
    }
    out.push({ line, result, words: wordsFor(recipient, giver, line, result, record) });
  }
  return out;
}

/**
 * Who sees a record card: whoever saw the check. A whispered roll applies in a whisper, with the
 * roll's own author added, since the record is posted by the WRITER (the GM's client, for a
 * target) and a player who rolled privately to the GM is otherwise neither its author nor one of
 * its recipients, and would keep a button that only ever says "already applied" (the review of
 * 0.32.0). A blind roll's author is left out: the degree is the GM's to know.
 * @param {ChatMessage} chat  The check card.
 * @returns {string[]}
 */
function recordWhisper(chat) {
  const whisper = Array.isArray(chat?.whisper) ? [...chat.whisper] : [];
  if (!whisper.length || chat.blind) return whisper;
  const author = chat.author?.id ?? null;
  return (author && !whisper.includes(author)) ? [...whisper, author] : whisper;
}

/** The application of a card's side being written on this client, so a second is not started beside it. */
const applying = new Set();

/**
 * Apply one side of a check card and post its record card.
 * @returns {Promise<{name: string, words: string[]}>}
 */
async function applySide({ chat, flags, roller, recipient, who, lines, notes = [] }) {
  const maneuver = { slug: String(flags.applies?.maneuver?.slug ?? ""), name: String(flags.applies?.maneuver?.name ?? "") };
  const done = await applyLinesTo(recipient, lines, { giver: roller, maneuver, from: chat.id, combat: flags.applies?.combat ?? null });
  // A REMOVE that found nothing is not said beside a line that did something (0.32.1).
  const words = wordsToSay(done);
  if (!words.length && !notes.length) return { name: recipient.name, words };
  const content = `<div class="starwrought action-card sw-applied-card"><h3>${esc(maneuver.name)}</h3>${
    words.map(w => `<p>${esc(w)}</p>`).join("")}${notes.map(n => `<p class="sw-card-note">${esc(n)}</p>`).join("")}</div>`;
  try {
    await postCard(roller, content, {
      whisper: recordWhisper(chat),
      flags: {
        kind: APPLIED_CARD, from: chat.id, who,
        recipientUuid: recipient.uuid, recipientName: recipient.name,
        giverUuid: roller.uuid, maneuver: maneuver.slug, words: [...words, ...notes]
      }
    });
  } catch (error) {
    console.error("STARWROUGHT | the record of what was applied could not be posted:", error);
  }
  return { name: recipient.name, words };
}

/* -------------------------------------------- */
/*  The roller's own lines                      */
/* -------------------------------------------- */

/**
 * Land the roller's own lines for a check card that has just been posted (ruling 312), on the
 * roller's client. For a reroll's card, what the first die put on the roller is taken back first.
 * Nothing from a blind roll: its degree is the GM's to know, and the GM's card has the button.
 * @param {ChatMessage} message  The check card.
 * @returns {Promise<object|null>}
 */
export async function applyOwnFromCard(message) {
  const flags = message?.flags?.[SW.SYSTEM_ID];
  if ((flags?.kind !== "check") || !flags.applies?.lines?.length) return null;
  const roller = resolveActor(flags.actorUuid);
  if (!roller || !(roller.isOwner || game.user.isGM)) return null;
  if (message.blind) return null;
  const key = `${message.id}:self`;
  if (applying.has(key) || appliedRecords(message.id).self) return null;
  applying.add(key);
  try {
    const notes = [];
    if (flags.rerollOf) {
      const undone = await removeAppliedFrom(roller, flags.rerollOf);
      if (undone) notes.push(F("STARWROUGHT.Applied.takenBack", { name: roller.name }));
    }
    const lines = standing(flags, "self");
    if (!lines.length && !notes.length) return null;
    return await applySide({ chat: message, flags, roller, recipient: roller, who: "self", lines, notes });
  } finally {
    applying.delete(key);
  }
}

/* -------------------------------------------- */
/*  The widget                                  */
/* -------------------------------------------- */

/**
 * Draw the apply widget on a rendered check card (called by the chat render pass,
 * documents/chat.mjs): each side's record once it is applied, else its button for the roller's
 * owner and the GM. The roller's own side shows a button only when the roll did not land it (a
 * blind roll). Built here rather than by the card's template so a reload, and an application made
 * on another client, draw the same thing from the same record.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {object} flags  The card's `flags.starwrought`.
 */
export function drawApplyWidget(message, html, flags) {
  if ((flags?.kind !== "check") || !flags.applies?.lines?.length || !flags.actorUuid) return;
  // A roll this viewer may not read shows no widget: the button's words would say the degree.
  if (message.isContentVisible === false) return;
  const roller = resolveActor(flags.actorUuid);
  if (!roller) return;
  const may = (roller.isOwner || game.user.isGM) && !wasRerolled(message, flags);
  const records = appliedRecords(message.id);

  const box = document.createElement("div");
  box.className = "sw-card-effects";
  box.dataset.swWidget = "apply";
  const note = (text, cls = "") => {
    const p = document.createElement("p");
    p.className = `sw-card-note ${cls}`.trim();
    p.textContent = text;
    box.append(p);
  };
  const row = document.createElement("div");
  row.className = "sw-card-buttons";

  for (const who of ["self", "target"]) {
    const record = records[who];
    if (record) {
      for (const words of record.words ?? []) note(words, "sw-applied-done");
      continue;
    }
    if (!may) continue;
    // The roller's own side has one writer, the roller's client, which lands it as the card is
    // posted. Its button is for the one roll that client does not apply: a blind one. Offered
    // on any other card it would be a second writer in the moment before the record arrives.
    if ((who === "self") && !message.blind) continue;
    const lines = standing(flags, who);
    if (!lines.length) continue;
    const named = (who === "self") ? roller : (flags.applies.target?.uuid ? resolveActor(flags.applies.target.uuid) : null);
    const name = (who === "self") ? roller.name : (named ? (flags.applies.target?.name || named.name) : "");
    const effects = lines.map(line => lineWords(line, { giver: roller.name, recipient: name || L("STARWROUGHT.Applied.theTarget") })).join("; ");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.swAction = "applyEffects";
    b.dataset.who = who;
    if (named && (who === "target")) b.dataset.recipientUuid = named.uuid;
    b.dataset.tooltip = L(name ? "STARWROUGHT.Applied.buttonHint" : "STARWROUGHT.Applied.buttonHintTarget");
    b.innerHTML = `<i class="fa-solid fa-person-rays"></i> ${esc(name
      ? F("STARWROUGHT.Applied.button", { name, effects })
      : F("STARWROUGHT.Applied.buttonTarget", { effects }))}`;
    row.append(b);
  }
  if (row.childElementCount) box.append(row);

  // No Threshold, no degree: the lines that wait on a result cannot be read.
  if (may && !flags.degree && flags.applies.lines.some(line => line?.degree)) {
    note(F("STARWROUGHT.Applied.noDegree", { maneuver: flags.applies.maneuver?.name ?? "" }));
  }
  if (!box.childElementCount) return;

  const card = html.querySelector(".starwrought") ?? html;
  const anchor = card.querySelector(".sw-card-give") ?? card.querySelector(".sw-card-rule-offers") ?? card.querySelector(".sw-card-outcome")
    ?? card.querySelector(".sw-card-threshold") ?? card.querySelector(".sw-substitute-note") ?? card.querySelector(".sw-card-modifiers");
  if (anchor) anchor.after(box);
  else card.append(box);
}

/* -------------------------------------------- */
/*  The press                                   */
/* -------------------------------------------- */

/**
 * The apply button, on the presser's client: find the creature (the one the card names, else the
 * presser's one target), then write here when this client is that creature's one writer, else ask
 * the client that is.
 * @param {ChatMessage} message  The check card.
 * @param {object} flags         Its `flags.starwrought`.
 * @param {HTMLButtonElement} button
 */
export async function applyFromCard(message, flags, button) {
  const roller = resolveActor(flags?.actorUuid);
  if (!roller) return ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
  if (!(roller.isOwner || game.user.isGM)) return ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
  if (wasRerolled(message, flags)) return ui.notifications.warn(L(REFUSALS.superseded));
  const who = (button.dataset.who === "target") ? "target" : "self";
  if (appliedRecords(message.id)[who]) return ui.notifications.warn(L(REFUSALS.already));
  if (!standing(flags, who).length) return ui.notifications.warn(L(REFUSALS.nothing));

  let recipient = roller;
  if (who === "target") {
    recipient = button.dataset.recipientUuid ? resolveActor(button.dataset.recipientUuid) : null;
    if (!recipient) {
      const targets = Array.from(game.user.targets ?? []).filter(t => t.actor);
      if (targets.length !== 1) return ui.notifications.warn(L("STARWROUGHT.Applied.targetOne"));
      recipient = targets[0].actor;
    }
    if (sameBody(recipient, roller)) return ui.notifications.warn(L(REFUSALS.recipient));
  }

  const request = { messageId: message.id, who, recipientUuid: recipient.uuid };
  const writer = writerFor(recipient);
  if (!writer) return ui.notifications.warn(F("STARWROUGHT.Applied.noWriter", { name: recipient.name }));
  if (writer.id === game.user.id) {
    // Written here: the record card that follows is the notice, so only a refusal is said.
    const reply = await applyLines(request, game.user.id);
    return (reply?.type === "effect:done") ? reply : notify(reply);
  }
  game.socket.emit(SOCKET, { type: "effect:apply", to: writer.id, ...request }, { recipients: [writer.id] });
  return null;
}

/** Say a refusal to the presser. An application that went through says nothing: its card is the notice. */
function notify(reply) {
  if (reply?.type === "effect:done") return null;
  return ui.notifications.warn(L(REFUSALS[reply?.reason] ?? "STARWROUGHT.Applied.refused"));
}

/* -------------------------------------------- */
/*  The write for a pressed button              */
/* -------------------------------------------- */

/**
 * Apply one side of a check card to a creature, on a client that may write that creature.
 * Everything but which side and which creature is read from the card; the asker must own the
 * card's roller.
 * @param {{messageId: string, who: string, recipientUuid: string}} request
 * @param {string} userId  Who asked: this user for a local press, the server's stamp for a relayed one.
 * @returns {Promise<object>}  `{ type: "effect:done", name, words }` or `{ type: "effect:refused", reason }`.
 */
export async function applyLines(request, userId) {
  const who = (request?.who === "target") ? "target" : "self";
  const key = `${String(request?.messageId ?? "")}:${who}`;
  if (applying.has(key)) return { type: "effect:refused", reason: "already" };
  applying.add(key);
  try {
    return await applyOnce(request, who, userId);
  } finally {
    applying.delete(key);
  }
}

/** `applyLines`' body, run for one card's side at a time. */
async function applyOnce(request, who, userId) {
  const refused = reason => ({ type: "effect:refused", reason });
  const chat = game.messages.get(String(request?.messageId ?? ""));
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || (flags?.kind !== "check") || !flags.applies?.lines?.length) return refused("noCard");
  if (wasRerolled(chat, flags)) return refused("superseded");
  if (appliedRecords(chat.id)[who]) return refused("already");
  const user = game.users.get(userId);
  const roller = resolveActor(flags.actorUuid);
  if (!user || !roller || !(user.isGM || roller.testUserPermission(user, "OWNER"))) return refused("notYours");
  const recipient = resolveActor(request.recipientUuid);
  if (!recipient) return refused("recipient");
  // The roller's side is the roller; a target is anybody else.
  if ((who === "self") !== sameBody(recipient, roller)) return refused("recipient");
  // The roller's own side is pressed only for a blind roll (the roller's client lands the rest).
  if ((who === "self") && !chat.blind) return refused("already");
  // A card that names its target is held to it: a request may choose the creature only when the
  // roll had none targeted, or the one it had is gone (the review of 0.32.0).
  if (who === "target") {
    const named = flags.applies.target?.uuid ? resolveActor(flags.applies.target.uuid) : null;
    if (named && !sameBody(named, recipient)) return refused("recipient");
  }
  // This client must be the creature's one writer, and able to write it.
  if ((writerFor(recipient)?.id !== game.user.id) || !(recipient.isOwner || game.user.isGM)) return refused("cannotWrite");
  const lines = standing(flags, who);
  if (!lines.length) return refused("nothing");
  // IMMUNITY TO A TRAIT (0.35.0; rulings 354 and 358). The creature this would land on is immune
  // to a trait the Maneuver carries (Blinded: `[EFFECT IMMUNE: TRAIT(Visual)]`): the system says
  // it and goes on, so nothing is refused, NOTHING IS APPLIED, and the record card says why, which
  // is also what makes the button give way on every client. Asked here, on the one writer, at the
  // moment of the write: a creature Blinded after the roll is immune, one cured since is not. The
  // roller's own side is never asked: what a Maneuver puts on its user lands as always.
  // `itemTraits` is the Maneuver's traits as the roll kept them (dice/check/card.mjs).
  const named = flags.applies.target?.uuid ? resolveActor(flags.applies.target.uuid) : null;
  const shown = (named && sameBody(named, recipient) && flags.applies.target?.name) ? flags.applies.target.name : recipient.name;
  const immune = ((who === "target") && Array.isArray(flags.itemTraits))
    ? immunityRecord(recipient, shown, flags.itemTraits, { other: roller, key: "applied" })
    : null;
  const done = await applySide({ chat, flags, roller, recipient, who, lines: immune ? [] : lines, notes: immune ? [immune.note] : [] });
  return { type: "effect:done", name: done.name, words: immune ? [immune.note] : done.words };
}

/* -------------------------------------------- */
/*  The socket and the hooks                    */
/* -------------------------------------------- */

/**
 * The `effect:*` half of the system socket, routed here by `onChatSocket`: an `effect:apply` is
 * served on the client it is addressed to, when that client may write the creature, and answered
 * with `effect:done` or `effect:refused`, addressed to the asker alone.
 * @param {object} message
 * @param {string|null} sender  The emitting user's id, from the server's stamp; null when unknown.
 */
export async function onApplySocket(message, sender) {
  switch (message.type) {
    case "effect:apply": {
      if (!sender) return;
      let reply;
      try {
        reply = await applyLines(message, sender);
      } catch (error) {
        console.error("STARWROUGHT | a relayed application failed:", error);
        reply = { type: "effect:refused", reason: "cannotWrite" };
      }
      return replyTo(sender, message.messageId, reply);
    }
    case "effect:done":
    case "effect:refused":
      return notify(message);
    default:
      return;
  }
}

let registered = false;

/**
 * Register the two hooks that keep a check card's widget in step with the chat log: a record card
 * created (the button gives way to the record) or deleted (the button comes back), on every
 * client. Idempotent; called once at ready.
 */
export function registerApplyCards() {
  if (registered) return;
  registered = true;
  const redraw = message => {
    const flags = message?.flags?.[SW.SYSTEM_ID];
    if ((flags?.kind !== APPLIED_CARD) || !flags.from) return;
    const source = game.messages.get(flags.from);
    if (!source) return;
    try {
      Promise.resolve(ui.chat?.updateMessage?.(source)).catch(() => {});
    } catch { /* the chat log is not there to redraw */ }
  };
  Hooks.on("createChatMessage", redraw);
  Hooks.on("deleteChatMessage", redraw);
}
