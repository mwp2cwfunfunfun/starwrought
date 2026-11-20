/**
 * Giving a Maneuver's result (0.22.0; rulings 223 to 230): the button on a check card that hands
 * what the check gives to another character, and the write behind it.
 *
 * A check made from a Maneuver's Item whose row carries GIVE lines (Aid) writes `flags.given` on
 * its card: the results by degree at the rank rolled, with the roller's ALTER lines applied
 * (rules/engine.mjs, `ruleGives`). Nothing is given by the roll. The render pass draws this
 * family's widget from those flags for the roller's owner and the GM (Mike, 2026-11-14: "A button
 * on the card", pressed by the aider or the GM, never automatic):
 *
 *   Give Wren +1 to Crafting     one click, when the roller had one character targeted
 *   Other...                     the dialog: who, and for a `chosen` result which Constellation,
 *                                opening on the one the roller rolled (Mike: "Named separately")
 *   Give the result...           the dialog, when nobody was targeted
 *
 * Pressing it writes ONE PENDING RESULT on the recipient (`flags.starwrought.rules.given.<maneuver>`,
 * rules/given.mjs, `pendingEntry`), replacing the one that Maneuver left there, and posts the give
 * card, spoken by the giver. The recipient's next roll with the Constellation carries it and it is
 * gone (the `give` kind's `modifiers` hook); unused, it goes when its window closes
 * (rules/effects-state.mjs, `settleGivenResults`) or with the encounter.
 *
 * TRIGGERED, so the three answers rules/README.md asks of a triggered moment:
 *
 *   WHO WRITES. ONE client for a recipient (`writerFor`): the active GM's when one is connected,
 *   else the client of the recipient's first active owner. The presser's own client writes only
 *   when it is that one; otherwise it asks over the system socket, `give:apply`, answered with
 *   `give:done` or `give:refused` to the asker alone. One writer, and one give of a card at a time
 *   on it (`giving`), so two presses of one card are served in turn and the second is told
 *   "already": the check for a give card and the writes that follow are not one step. With no GM
 *   and no owner connected nothing is written and the presser is told. (With no GM, two presses of
 *   one card for two recipients owned by different players are served by two clients and can both
 *   land; that table's limit.)
 *   THE EVENT. The check card's message id. The give card names it (`flags.starwrought.from`), and
 *   a give card naming a check card means that card's result was given: its button gives way to
 *   the record, on every client, after a reload too. A reroll is a new card with its own result,
 *   and a card that was thrown again gives nothing, whether or not the reroll could mark it
 *   (`wasRerolled`).
 *   FAILURE. A give that cannot be written writes nothing, posts nothing, tells the presser why
 *   and leaves the button where it was.
 *
 * The executing client trusts the request for two things, who and which Constellation. The result,
 * its window, the Maneuver and the giver are read again from the check card; the asker is the
 * server's stamp on the socket message and must own the card's roller (or be a GM).
 */

import * as SW from "../../config.mjs";
import { immunityRecord } from "../../rules/prevent.mjs";
import { SOCKET, replyTo, resolveActor } from "./shared.mjs";
import { postCard } from "../../helpers/cards.mjs";
import { enabledConstellations } from "../../helpers/content.mjs";
import { pendingEntry, resultWords, windowWords, degreeName, signedValue } from "../../rules/given.mjs";
import { givenResults } from "../../rules/engine.mjs";
import { writeGiven } from "../../rules/effects-state.mjs";
import { encounterContext, momentIn } from "../../rules/scene.mjs";

/** The `flags.starwrought.kind` of the card a give posts. */
export const GIVEN_CARD = "given";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));

/** Why a give was refused, by the reply's `reason`. */
const REFUSALS = Object.freeze({
  noCard: "STARWROUGHT.Given.refusedNoCard",
  superseded: "STARWROUGHT.Given.refusedSuperseded",
  already: "STARWROUGHT.Given.refusedAlready",
  notYours: "STARWROUGHT.Given.refusedNotYours",
  nothing: "STARWROUGHT.Given.refusedNothing",
  recipient: "STARWROUGHT.Given.refusedRecipient",
  constellation: "STARWROUGHT.Given.refusedConstellation",
  cannotWrite: "STARWROUGHT.Given.refusedCannotWrite",
  // 0.35.0: the recipient is immune to a trait the Maneuver carries. The reply's own `note` says
  // who, to what and by what; this is the sentence for a reply that lost it.
  immune: "STARWROUGHT.Immune.givenRefused"
});

/* -------------------------------------------- */
/*  Reading a card                              */
/* -------------------------------------------- */

/**
 * The record that a check card's result was given: the flags of the give card that names it, or
 * null. Read from the chat log, so every client and a reload agree with no write to the check card
 * (which only its author or a GM could make).
 * @param {string} messageId  The check card's id.
 * @returns {object|null}
 */
export function givenRecord(messageId) {
  if (!messageId) return null;
  for (const message of game.messages?.contents ?? []) {
    const flags = message.flags?.[SW.SYSTEM_ID];
    if ((flags?.kind === GIVEN_CARD) && (flags.from === messageId)) return flags;
  }
  return null;
}

/**
 * Was this check thrown again? Its own `superseded` flag when the reroll could mark it (its author
 * or a GM), else a later card that names it as the one it replaces: a co-owner's reroll posts the
 * new card and cannot mark the old, and the old one must still give nothing.
 * @param {ChatMessage} message
 * @param {object} flags
 * @returns {boolean}
 */
export function wasRerolled(message, flags) {
  if (flags?.superseded) return true;
  for (const other of game.messages?.contents ?? []) {
    if (other.flags?.[SW.SYSTEM_ID]?.rerollOf === message?.id) return true;
  }
  return false;
}

/**
 * Are these two Actors one body? The same document, or a token's Actor and the world Actor it is
 * drawn from: an unlinked token reads its base Actor's flags, so a result written on the one is
 * held by the other. Two unlinked tokens of one Actor are two bodies.
 */
export function sameBody(a, b) {
  if (!a || !b) return false;
  if (a.uuid === b.uuid) return true;
  return (a.id === b.id) && !(a.isToken && b.isToken);
}

/**
 * The one client that writes a give for this recipient: the active GM's when one is connected,
 * else the recipient's first active owner's. One writer, so that two presses of one card (the GM
 * and a player, the sidebar and a popout) are served in turn and the second is told "already".
 * @param {Actor} recipient
 * @returns {User|null}
 */
export function writerFor(recipient) {
  const users = game.users;
  return users.activeGM ?? users.find(u => u.active && recipient.testUserPermission(u, "OWNER")) ?? null;
}

/** The check cards a give is being written for on this client, so a second is not started beside it. */
const giving = new Set();

/** What the card's own degree gives: the table's result, or null. */
function resultOf(flags) {
  const degree = flags?.degree;
  return (degree && flags?.given?.table) ? (flags.given.table[degree] ?? null) : null;
}

/**
 * The Constellations a character may roll, for the dialog: every one that ships (the Lore template
 * aside, since a Lore is always Lore (X)), then the character's own that the registry does not
 * hold (its Lores), by name. The same list the Relevant Check picker draws.
 * @param {Actor} actor
 * @returns {Array<{slug: string, name: string}>}
 */
function constellationsFor(actor) {
  const rows = new Map();
  for (const meta of enabledConstellations()) {
    if (!meta.slug || (meta.slug === SW.LORE_TEMPLATE_SLUG)) continue;
    rows.set(meta.slug, { slug: meta.slug, name: actor?.system?.proficiency?.(meta.slug)?.name ?? meta.name });
  }
  for (const [slug, con] of Object.entries(actor?.system?.constellations ?? {})) {
    if (!rows.has(slug) && (slug !== SW.LORE_TEMPLATE_SLUG)) rows.set(slug, { slug, name: con.name ?? slug });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** One of a character's Constellations by slug, or null when it is not one the character may roll. */
function constellationOf(actor, slug) {
  return constellationsFor(actor).find(c => c.slug === slug) ?? null;
}

/**
 * The characters a result may go to: the ones with a token on the viewed scene, then the world's
 * player characters, the roller never. An adversary rolls flat and holds no such line.
 * @param {Actor} roller
 * @returns {Actor[]}
 */
function recipientsFor(roller) {
  const seen = new Set([roller?.uuid]);
  const out = [];
  const add = actor => {
    if (!actor || (actor.type !== "character") || seen.has(actor.uuid) || sameBody(actor, roller)) return;
    seen.add(actor.uuid);
    out.push(actor);
  };
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (!token.document?.hidden || game.user.isGM) add(token.actor);
  }
  for (const actor of game.actors ?? []) {
    if (actor.hasPlayerOwner) add(actor);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------------------------------- */
/*  The widget                                  */
/* -------------------------------------------- */

/**
 * Draw the give widget on a rendered check card (called by the chat render pass, documents/chat.mjs).
 * For the roller's owner and the GM, never on a superseded card. Built here rather than by the
 * card's template so a reload, and a give made on another client, draw the same thing from the
 * same record.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {object} flags  The card's `flags.starwrought`.
 */
export function drawGiveWidget(message, html, flags) {
  if ((flags?.kind !== "check") || !flags.given?.table || !flags.actorUuid) return;
  // A roll this viewer may not read (a blind roll, to its own roller) shows no widget: the
  // button's words would say the degree the card is hiding.
  if (message.isContentVisible === false) return;
  if (wasRerolled(message, flags)) return;
  const roller = resolveActor(flags.actorUuid);
  if (!roller || !(roller.isOwner || game.user.isGM)) return;

  const maneuver = flags.given.maneuver?.name ?? "";
  const box = document.createElement("div");
  box.className = "sw-card-give";
  box.dataset.swWidget = "give";
  const note = (text, cls = "") => {
    const p = document.createElement("p");
    p.className = `sw-card-note ${cls}`.trim();
    p.textContent = text;
    box.append(p);
  };

  const degree = flags.degree ?? null;
  const result = resultOf(flags);
  const record = givenRecord(message.id);
  if (record) {
    note(F("STARWROUGHT.Given.done", { recipient: record.recipientName ?? "", result: record.words ?? "" }), "sw-given-done");
  } else if (!degree) {
    // No Threshold, no degree: the table is there and nothing in it can be read.
    note(F("STARWROUGHT.Given.noDegree", { maneuver }));
  } else if (!result) {
    // A degree a Talent emptied says whose doing it is; a degree that simply gives nothing says nothing.
    const changed = flags.given.notes?.[degree] ?? [];
    if (!changed.length) return;
    for (const c of changed) note(F("STARWROUGHT.Given.nothingBy", { talent: c.label ?? "", degree: degreeName(degree) }), "sw-given-altered");
  } else {
    const giver = roller.name;
    const inEncounter = !!encounterContext().combat;
    const fixed = (result.to?.type !== "chosen") ? result.to : null;
    const rolled = flags.slug ? (SW.getConstellation(flags.slug)?.name ?? "") : "";
    const row = document.createElement("div");
    row.className = "sw-card-buttons";
    const button = ({ label, icon, hint, data }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.swAction = "giveResult";
      for (const [k, v] of Object.entries(data ?? {})) b.dataset[k] = v;
      if (hint) b.dataset.tooltip = hint;
      b.innerHTML = `<i class="${icon}"></i> ${esc(label)}`;
      row.append(b);
    };

    const ally = flags.given.ally?.uuid ? resolveActor(flags.given.ally.uuid) : null;
    const allyTo = ally ? (fixed ? { slug: fixed.slug, name: fixed.name } : constellationOf(ally, flags.slug ?? "")) : null;
    if (ally && (ally.type === "character") && !sameBody(ally, roller) && allyTo) {
      button({
        label: F("STARWROUGHT.Given.giveTo", { recipient: ally.name, value: signedValue(result.value), constellation: allyTo.name }),
        icon: "fa-solid fa-hand-holding-heart",
        hint: F("STARWROUGHT.Given.giveHint", { result: resultWords(result, allyTo.name), window: windowWords(result.until, { giver, recipient: ally.name, encounter: inEncounter }) }),
        data: { recipientUuid: ally.uuid, slug: allyTo.slug }
      });
      button({ label: L("STARWROUGHT.Given.other"), icon: "fa-solid fa-users", hint: L("STARWROUGHT.Given.otherHint"), data: { choose: "1" } });
    } else {
      button({
        label: L("STARWROUGHT.Given.giveResult"),
        icon: "fa-solid fa-hand-holding-heart",
        hint: F("STARWROUGHT.Given.giveHint", { result: resultWords(result, fixed?.name ?? rolled), window: windowWords(result.until, { giver, encounter: inEncounter }) }),
        data: { choose: "1" }
      });
    }
    box.append(row);
    // A Talent that changed this result is named under the button, so "why two Opportunities" has an answer.
    if (result.altered?.length) note(F("STARWROUGHT.Given.alteredBy", { talents: result.altered.join(", ") }), "sw-given-altered");
  }

  const card = html.querySelector(".starwrought") ?? html;
  const anchor = card.querySelector(".sw-card-rule-offers") ?? card.querySelector(".sw-card-outcome")
    ?? card.querySelector(".sw-card-threshold") ?? card.querySelector(".sw-substitute-note") ?? card.querySelector(".sw-card-modifiers");
  if (anchor) anchor.after(box);
  else card.append(box);
}

/* -------------------------------------------- */
/*  The press                                   */
/* -------------------------------------------- */

/**
 * The give button, on the presser's client: read who and which Constellation (from the button, or
 * from the dialog), then write here when this client may write the recipient, else ask a client
 * that may.
 * @param {ChatMessage} message  The check card.
 * @param {object} flags         Its `flags.starwrought`.
 * @param {HTMLButtonElement} button
 */
export async function giveFromCard(message, flags, button) {
  const roller = resolveActor(flags?.actorUuid);
  if (!roller) return ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
  if (!(roller.isOwner || game.user.isGM)) return ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
  const result = resultOf(flags);
  if (!result) return ui.notifications.warn(L(REFUSALS.nothing));
  if (wasRerolled(message, flags)) return ui.notifications.warn(L(REFUSALS.superseded));
  if (givenRecord(message.id)) return ui.notifications.warn(L(REFUSALS.already));

  let recipientUuid = button.dataset.recipientUuid ?? "";
  let slug = button.dataset.slug ?? "";
  if (button.dataset.choose || !recipientUuid) {
    const answer = await chooseRecipient(roller, flags, result);
    if (!answer) return;
    ({ recipientUuid, slug } = answer);
  }
  const recipient = resolveActor(recipientUuid);
  if (!recipient) return ui.notifications.warn(L(REFUSALS.recipient));

  const request = { messageId: message.id, recipientUuid: recipient.uuid, slug };
  const writer = writerFor(recipient);
  if (!writer) return ui.notifications.warn(F("STARWROUGHT.Given.noWriter", { recipient: recipient.name }));
  if (writer.id === game.user.id) {
    // Written here: the give card that follows is the notice, so only a refusal is said.
    const reply = await applyGive(request, game.user.id);
    return (reply?.type === "give:done") ? reply : notify(reply);
  }
  // The one writer is another client (the GM's, even for the presser's own character, so that
  // every give of a card is served in one place): ask it. The give card it posts is the notice.
  game.socket.emit(SOCKET, { type: "give:apply", to: writer.id, ...request }, { recipients: [writer.id] });
  return null;
}

/** Say a refusal to the presser. A give that went through says nothing: its card is the notice. */
function notify(reply) {
  if (reply?.type === "give:done") return null;
  // A refusal that carries its own sentence says it (0.35.0: who is immune, to what, and by what).
  return ui.notifications.warn(reply?.note || L(REFUSALS[reply?.reason] ?? "STARWROUGHT.Given.refused"));
}

/**
 * The dialog: who gets the result, and for a `chosen` result which of that character's
 * Constellations it is a bonus to, opening on the ally the roller targeted (else the user's one
 * target) and on the Constellation the roller rolled. DialogV2's content is static HTML, so the
 * Constellation list is redrawn in the `render` callback when the recipient changes (a Lore is the
 * character's own).
 * @returns {Promise<{recipientUuid: string, slug: string}|null>}
 */
async function chooseRecipient(roller, flags, result) {
  const recipients = recipientsFor(roller);
  if (!recipients.length) {
    ui.notifications.warn(L("STARWROUGHT.Given.noRecipients"));
    return null;
  }
  const fixed = (result.to?.type !== "chosen") ? result.to : null;
  const targeted = Array.from(game.user.targets ?? []).map(t => t.actor?.uuid).filter(Boolean);
  const opening = [flags.given?.ally?.uuid, ...targeted].find(uuid => recipients.some(r => r.uuid === uuid)) ?? recipients[0].uuid;
  const byUuid = new Map(recipients.map(r => [r.uuid, r]));
  const optionsFor = (uuid, selected) => constellationsFor(byUuid.get(uuid))
    .map(c => `<option value="${esc(c.slug)}"${c.slug === selected ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  const who = recipients.map(r => `<option value="${esc(r.uuid)}"${r.uuid === opening ? " selected" : ""}>${esc(r.name)}</option>`).join("");
  const maneuver = flags.given?.maneuver?.name ?? "";
  const constellationField = fixed
    ? `<p class="hint">${esc(F("STARWROUGHT.Given.fixedTo", { constellation: fixed.name }))}</p>`
    : `<div class="form-group">
        <label>${esc(L("STARWROUGHT.Given.constellationLabel"))}</label>
        <select name="slug">${optionsFor(opening, flags.slug ?? "")}</select>
      </div>
      <p class="hint">${esc(L("STARWROUGHT.Given.constellationHint"))}</p>`;

  const answer = await foundry.applications.api.DialogV2.prompt({
    window: { title: F("STARWROUGHT.Given.title", { maneuver }), icon: "fa-solid fa-hand-holding-heart" },
    classes: ["starwrought", "sw-give-dialog"],
    content: `<p>${esc(F("STARWROUGHT.Given.prompt", { result: resultWords(result, fixed?.name ?? ""), degree: degreeName(flags.degree) }))}</p>
      <div class="form-group">
        <label>${esc(L("STARWROUGHT.Given.recipientLabel"))}</label>
        <select name="recipient">${who}</select>
      </div>${constellationField}`,
    render: (event, dialog) => {
      // v14 hands the DialogV2 instance; an earlier build handed the <dialog> element itself.
      const root = (dialog instanceof HTMLElement) ? dialog : (dialog?.element ?? null);
      const recipient = root?.querySelector?.("select[name='recipient']");
      const select = root?.querySelector?.("select[name='slug']");
      if (!recipient || !select) return;
      recipient.addEventListener("change", () => { select.innerHTML = optionsFor(recipient.value, select.value); });
    },
    ok: {
      label: L("STARWROUGHT.Given.button"),
      callback: (event, target) => ({
        recipientUuid: String(target.form.elements.recipient?.value ?? ""),
        slug: fixed ? String(fixed.slug) : String(target.form.elements.slug?.value ?? "")
      })
    },
    rejectClose: false
  });
  if (!answer?.recipientUuid) return null;
  return { recipientUuid: answer.recipientUuid, slug: answer.slug ?? "" };
}

/* -------------------------------------------- */
/*  The write                                   */
/* -------------------------------------------- */

/**
 * Give a check card's result to a character, on a client that may write that character. Everything
 * but who and which Constellation is read from the card; the asker must own the card's roller.
 * @param {{messageId: string, recipientUuid: string, slug: string}} request
 * @param {string} userId  Who asked: this user for a local give, the server's stamp for a relayed one.
 * @returns {Promise<object>}  `{ type: "give:done", name, words }` or `{ type: "give:refused", reason }`.
 */
export async function applyGive(request, userId) {
  // One give of a card at a time on this client: the check for "already given" and the two
  // writes that follow it are not one step, and a second request for the same card arriving
  // between them (the GM's own press and a player's relayed one) must wait its turn and be told.
  const id = String(request?.messageId ?? "");
  if (giving.has(id)) return { type: "give:refused", reason: "already" };
  giving.add(id);
  try {
    return await giveOnce(request, userId);
  } finally {
    giving.delete(id);
  }
}

/** `applyGive`'s body, run for one card at a time. */
async function giveOnce(request, userId) {
  const refused = reason => ({ type: "give:refused", reason });
  const chat = game.messages.get(String(request?.messageId ?? ""));
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || (flags?.kind !== "check") || !flags.given?.table) return refused("noCard");
  if (wasRerolled(chat, flags)) return refused("superseded");
  if (givenRecord(chat.id)) return refused("already");
  const user = game.users.get(userId);
  const roller = resolveActor(flags.actorUuid);
  if (!user || !roller || !(user.isGM || roller.testUserPermission(user, "OWNER"))) return refused("notYours");
  const result = resultOf(flags);
  if (!result) return refused("nothing");
  const recipient = resolveActor(request.recipientUuid);
  if (!recipient || (recipient.type !== "character") || sameBody(recipient, roller)) return refused("recipient");
  // This client must be the recipient's one writer, and able to write it.
  if ((writerFor(recipient)?.id !== game.user.id) || !(recipient.isOwner || game.user.isGM)) return refused("cannotWrite");
  // IMMUNITY TO A TRAIT (0.35.0; ruling 354): the recipient is immune to a trait the Maneuver
  // carries, so its result is not given, and the presser is told who, to what and by what. Asked
  // here, on the one writer, at the moment of the write, as an Effect's is (./apply.mjs). The
  // Give button stays: the result may still be given to somebody else.
  const immune = Array.isArray(flags.itemTraits) ? immunityRecord(recipient, recipient.name, flags.itemTraits, { other: roller, key: "given" }) : null;
  if (immune) return { ...refused("immune"), note: immune.note };
  // The Constellation: the line's own when it names one, else the one asked for, which must be
  // one the recipient may roll.
  const to = (result.to?.type !== "chosen")
    ? { slug: String(result.to.slug ?? ""), name: String(result.to.name ?? "") }
    : constellationOf(recipient, String(request.slug ?? ""));
  if (!to?.slug) return refused("constellation");

  // The window is counted from now, in the encounter this client views (ruling 228).
  const combat = globalThis.game?.combat ?? null;
  const combatantOf = actor => combat?.getCombatantsByActor?.(actor)?.[0]?.id ?? null;
  const maneuver = { slug: String(flags.given.maneuver?.slug ?? ""), name: String(flags.given.maneuver?.name ?? "") };
  const replaced = givenResults(recipient).find(e => e.maneuver === maneuver.slug) ?? null;
  const entry = pendingEntry({
    result, to, maneuver,
    giver: { uuid: roller.uuid, name: roller.name },
    combat: combat?.id ?? null,
    giverCombatant: combatantOf(roller),
    recipientCombatant: combatantOf(recipient),
    message: chat.id,
    // 0.39.0: a window in rounds is counted from the Maneuver's use, as its card kept it
    // (ruling 400), and only in a Combat that has started.
    // In a Combat that has not started yet there is no Opportunity to count from: the stamp is
    // round 0 with nobody, so "for 1 round" ends with round 1 and not with the whole encounter
    // (the review of 0.39.0).
    moment: momentIn(combat, flags.given.moment ?? null) ?? (combat ? { anchor: null, init: null, round: 0 } : null)
  });
  if (!entry.maneuver || !entry.value) return refused("nothing");

  try {
    await writeGiven(recipient, entry);
  } catch (error) {
    console.error(`STARWROUGHT | the result could not be given to ${recipient.name}:`, error);
    return refused("cannotWrite");
  }

  // The card is the record, and what makes the button go on every client.
  const words = resultWords(result, to.name);
  const names = { giver: roller.name, recipient: recipient.name };
  const window = entry.until
    ? windowWords({ who: entry.until.who, n: entry.until.n }, { ...names, encounter: true })
    : windowWords(null, { encounter: false });
  const lines = [F("STARWROUGHT.Given.card", {
    giver: esc(roller.name), recipient: esc(recipient.name),
    // "+1 Situation": the amount and where it comes from, without the Constellation the line names next.
    amount: esc(resultWords({ value: result.value, type: result.type })),
    word: L(result.value < 0 ? "STARWROUGHT.Given.penalty" : "STARWROUGHT.Given.bonus"),
    constellation: esc(to.name), window: esc(window)
  })];
  const notes = [];
  if (replaced) notes.push(F("STARWROUGHT.Given.replaced", { maneuver: esc(replaced.maneuverName ?? maneuver.name), giver: esc(replaced.byName ?? "") }));
  if (result.altered?.length) notes.push(F("STARWROUGHT.Given.alteredBy", { talents: esc(result.altered.join(", ")) }));
  const content = `<div class="starwrought action-card sw-given-card"><h3>${esc(maneuver.name)}</h3>${
    lines.map(l => `<p>${l}</p>`).join("")}${notes.map(n => `<p class="sw-card-note">${n}</p>`).join("")}</div>`;
  try {
    // Seen by whoever saw the check: a whispered roll gives in a whisper, with the roll's own
    // author added (0.32.0's review): the give card is posted by the WRITER, and a player who
    // rolled privately to the GM would otherwise never see it and keep a dead button.
    const whisper = Array.isArray(chat.whisper) ? [...chat.whisper] : [];
    if (whisper.length && !chat.blind && chat.author?.id && !whisper.includes(chat.author.id)) whisper.push(chat.author.id);
    await postCard(roller, content, {
      whisper,
      flags: { kind: GIVEN_CARD, from: chat.id, recipientUuid: recipient.uuid, recipientName: recipient.name, giverUuid: roller.uuid, maneuver: maneuver.slug, words }
    });
  } catch (error) {
    console.error("STARWROUGHT | the give card could not be posted:", error);
  }
  return { type: "give:done", name: recipient.name, words };
}

/* -------------------------------------------- */
/*  The socket and the hooks                    */
/* -------------------------------------------- */

/**
 * The `give:*` half of the system socket, routed here by `onChatSocket`: a `give:apply` is served
 * on the client it is addressed to, when that client may write the recipient, and answered with
 * `give:done` or `give:refused`, addressed to the asker alone.
 * @param {object} message
 * @param {string|null} sender  The emitting user's id, from the server's stamp; null when unknown.
 */
export async function onGiveSocket(message, sender) {
  switch (message.type) {
    case "give:apply": {
      if (!sender) return;
      let reply;
      try {
        reply = await applyGive(message, sender);
      } catch (error) {
        console.error("STARWROUGHT | a relayed give failed:", error);
        reply = { type: "give:refused", reason: "cannotWrite" };
      }
      return replyTo(sender, message.messageId, reply);
    }
    case "give:done":
    case "give:refused":
      return notify(message);
    default:
      return;
  }
}

let registered = false;

/**
 * Register the two hooks that keep a check card's widget in step with the chat log: a give card
 * created (the button gives way to the record) or deleted (the button comes back), on every client.
 * Idempotent; called once at ready.
 */
export function registerGiveCards() {
  if (registered) return;
  registered = true;
  const redraw = message => {
    const flags = message?.flags?.[SW.SYSTEM_ID];
    if ((flags?.kind !== GIVEN_CARD) || !flags.from) return;
    const source = game.messages.get(flags.from);
    if (!source) return;
    // A log being flushed has nothing left to redraw; a redraw that fails is not worth a throw.
    try {
      Promise.resolve(ui.chat?.updateMessage?.(source)).catch(() => {});
    } catch { /* the chat log is not there to redraw */ }
  };
  Hooks.on("createChatMessage", redraw);
  Hooks.on("deleteChatMessage", redraw);
}
