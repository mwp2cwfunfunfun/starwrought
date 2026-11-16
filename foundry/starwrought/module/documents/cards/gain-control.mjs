/**
 * Gain Control ❶ on the cards (0.27.0; rulings 274, 275, 280).
 *
 * The Maneuver's row (data/maneuvers.xlsx, the only source for what a Maneuver says since PHB
 * v4.25): "Roll Melee against the target's Guard. Critical Success You Control the weapon, and the
 * target is Off-Guard until its next Opportunity. Success You Control the weapon. Failure A neutral
 * Bind forms. Critical Failure You pressed badly. The target Controls your weapon instead."
 *
 * `SwActor#gainControl` (documents/actor/bind.mjs) makes the roll: a character's Melee check
 * against the partner's Guard Threshold, or, for an adversary (which rolls nothing in this system),
 * a request card whose Roll Guard button has the partner roll Guard against the adversary's Attack
 * Threshold, read from the other side. Either way the result is on a check card whose flags carry
 * `gainControl { bindId, userUuid, partnerUuid, state, inverted, from }`, and THIS file is how the
 * result reaches the Bind:
 *
 *  - `drawGainControlWidget`, in the chat render pass beside the Give widget: what the degree means
 *    for the Bind, and one button for the side the result favours (Take Control, which asks the
 *    Zone; or Make neutral), shown to whoever may write that side and to the GM, and only while the
 *    Bind is not already in that state. Drawn from the flags and the live Bind, so a reload, a
 *    reroll's new card and a second viewer all see the same thing;
 *  - `applyGainControl`, the press, also run by the roll itself for the side the roller may write,
 *    so the common case (a Success) opens the Zone picker with no second click;
 *  - `rollGuardFromCard`, the request card's button;
 *  - `registerGainControlCards`, which draws a recent card again when the Bind it speaks of moves
 *    and when a request has been answered.
 *
 * Nothing here decides a rule: `gainControlOutcome` (combat/bind-rules.mjs, pure and tested) reads
 * the degree, and the Bind's own verbs (`takeControl`, `releaseControl`) write.
 */

import * as SW from "../../config.mjs";
import { resolveActor } from "./shared.mjs";
import { gainControlOutcome } from "../../combat/bind-rules.mjs";
import { attackThreshold } from "../../combat/attack-source.mjs";
import { SwCheck } from "../../dice/check.mjs";

/** The `flags.starwrought.kind` of an adversary's request for the partner's Guard roll. */
export const GAIN_CONTROL_REQUEST = "gainControlRequest";

/** How far back in the chat log a Gain Control card is kept in step with its Bind. */
const REDRAW_DEPTH = 40;

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * What a check card's degree means for the Bind it was rolled for, with the two fighters and the
 * Bind as it stands. Null for a card that is no Gain Control, or whose fighters are gone.
 * @param {object} flags  A check card's `flags.starwrought`.
 * @returns {{gc: object, user: Actor, partner: Actor, outcome: object, live: object|null,
 *   standing: boolean, done: boolean}|null}
 */
function readCard(flags, messageId = "") {
  const gc = flags?.gainControl;
  if (!gc || (flags.kind !== "check") || !flags.degree) return null;
  const user = resolveActor(gc.userUuid);
  const partner = resolveActor(gc.partnerUuid);
  if (!user || !partner) return null;
  const outcome = gainControlOutcome(flags.degree, { state: gc.state, inverted: !!gc.inverted });
  if (!outcome) return null;
  const live = user.system?.bind ?? null;
  // The Bind the roll was made for, still standing: one formed since is another Bind.
  const standing = !!live?.state && ((live.id ?? "") === (gc.bindId ?? ""));
  // A result is written ONCE (the review of 2026-11-15). A Bind keeps its identity through Take
  // Control and Make neutral, so "the Bind is not in the result's state" cannot be the test: an
  // old Success would offer its button again the moment the Control was lost, a free Control with
  // no roll. So the result is offered only while nothing has been written from this card (the
  // Bind card its write posts is the record, as a give's card is), the result changes something,
  // and the Bind is still as it stood when the die was thrown.
  const applied = !!appliedRecord(messageId);
  const unchanged = outcome.state === (gc.state ?? "");
  const offer = standing && !applied && !unchanged && (live.state === (gc.state ?? ""));
  return { gc, user, partner, outcome, live, standing, applied, offer };
}

/**
 * The Bind card that says this Gain Control card's result was written, if one does: the record.
 * `takeControl` and `releaseControl` stamp the card they post with the id of the check card they
 * were applied from (`flags.starwrought.gainControlApplied`), which any client may do, where
 * stamping the check card itself would need its author or the GM.
 * @param {string} messageId  The Gain Control check card.
 * @returns {ChatMessage|null}
 */
export function appliedRecord(messageId) {
  if (!messageId) return null;
  for (const message of game.messages?.contents ?? []) {
    if (message.flags?.[SW.SYSTEM_ID]?.gainControlApplied === messageId) return message;
  }
  return null;
}

/**
 * A Gain Control's record for the card a reroll posts (documents/cards/reroll.mjs): the same Bind
 * and fighters, with `state` the side its user holds NOW. The first card's result may have been
 * written already, and the new die's result is offered against the Bind as it stands, not as it
 * stood before the first die.
 * @param {object|null} gc
 * @returns {object|null}
 */
export function gainControlForReroll(gc) {
  if (!gc) return null;
  const copy = foundry.utils.deepClone(gc);
  const live = resolveActor(gc.userUuid)?.system?.bind;
  if (live?.state && ((live.id ?? "") === (gc.bindId ?? ""))) copy.state = live.state;
  return copy;
}

/** The Gain Control cards being written from on this client, so a second press starts nothing. */
const applying = new Set();

/** Who writes the result: the fighter the result favours, or either for a neutral Bind. */
function writerOf({ user, partner, outcome }) {
  if (outcome.state === "controlling") return user.isOwner ? user : null;
  if (outcome.state === "controlled") return partner.isOwner ? partner : null;
  return user.isOwner ? user : (partner.isOwner ? partner : null);
}

/**
 * Draw the result under a Gain Control check card.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {object} flags
 */
export function drawGainControlWidget(message, html, flags) {
  if (!flags?.gainControl || flags.superseded) return;
  // A roll this viewer may not read shows nothing: the line would say the degree the card hides.
  if (message.isContentVisible === false) return;
  const read = readCard(flags, message.id);
  if (!read) return;
  const { user, partner, outcome, standing, offer } = read;

  const box = document.createElement("div");
  box.className = "sw-card-gain-control";
  box.dataset.swWidget = "gainControl";
  const note = (text, cls = "") => {
    const p = document.createElement("p");
    p.className = `sw-card-note ${cls}`.trim();
    p.textContent = text;
    box.append(p);
  };

  const names = { name: user.name, partner: partner.name };
  note(F(`STARWROUGHT.GainControl.result.${outcome.state}`, names), "sw-gain-control-result");
  if (outcome.pressed) note(F("STARWROUGHT.GainControl.pressed", names));

  if (!standing) {
    note(L("STARWROUGHT.GainControl.bindGone"), "sw-warn");
  } else if (offer) {
    const writer = writerOf(read);
    if (writer || game.user.isGM) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.swAction = "gainControlApply";
      const control = outcome.state !== "neutral";
      button.innerHTML = `<i class="fa-solid ${control ? "fa-link" : "fa-scale-balanced"}"></i> ${
        foundry.utils.escapeHTML(control
          ? F("STARWROUGHT.GainControl.takeFor", { name: (outcome.state === "controlling" ? user : partner).name })
          : L("STARWROUGHT.Bind.release"))}`;
      const row = document.createElement("div");
      row.className = "sw-card-buttons";
      row.append(button);
      box.append(row);
    } else {
      const who = (outcome.state === "controlled") ? partner : user;
      note(F("STARWROUGHT.GainControl.waiting", { name: who.name }));
    }
  }

  const card = html.querySelector(".starwrought") ?? html;
  const anchor = card.querySelector(".sw-card-outcome") ?? card.querySelector(".sw-card-modifiers");
  if (anchor) anchor.after(box);
  else card.append(box);
}

/**
 * Write a Gain Control card's result onto the Bind: Take Control for the side it favours (the
 * Controller picks the Zone; a Critical Success also carries the token that leaves the partner
 * Off-Guard until its next Opportunity), or the Bind made neutral. Read again from the card and
 * the Bind as they stand, so a press on a stale card does nothing.
 * @param {ChatMessage} message
 * @param {object} [options]
 * @param {boolean} [options.quiet=false]  The roll's own call: say nothing when this client is not
 *   the one to write, since the card's button waits for whoever is.
 * @returns {Promise<object|null>}  The Bind side written, or null.
 */
export async function applyGainControl(message, { quiet = false } = {}) {
  const flags = message?.flags?.[SW.SYSTEM_ID];
  if (flags?.superseded) return null;
  // A roll this client may not read (a blind roll, to its own roller) is not acted on here: the
  // Zone picker opening, or the Bind going neutral, would say the degree the card is hiding. The
  // GM's client draws the button.
  if (message.isContentVisible === false) return null;
  const read = readCard(flags, message.id);
  if (!read) return null;
  const { gc, outcome, standing, offer } = read;
  if (!standing) {
    if (!quiet) ui.notifications.warn(L("STARWROUGHT.GainControl.bindGone"));
    return null;
  }
  if (!offer) return null;
  const writer = writerOf(read);
  if (!writer) {
    if (!quiet) ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  // One write for a card at a time: the roll's own call may still have its Zone picker open when
  // the card's button is pressed.
  if (applying.has(message.id)) return null;
  applying.add(message.id);
  try {
    // `applies`: the Bind card the write posts names this card, which is the record that its
    // result was written (`appliedRecord`).
    if (outcome.state === "neutral") return await writer.releaseControl({ id: gc.bindId ?? "", applies: message.id });
    // The token is the card's own id: one Off-Guard for one Critical Success, however often pressed.
    const pressed = (outcome.state === "controlling" && outcome.pressed) ? message.id : "";
    return await writer.takeControl({ pressed, applies: message.id });
  } finally {
    applying.delete(message.id);
  }
}

/** The card's button. */
export async function applyGainControlFromCard(message) {
  return applyGainControl(message);
}

/* -------------------------------------------- */
/*  An adversary's Gain Control                 */
/* -------------------------------------------- */

/**
 * The check card that answered a request, if one has: a request is answered once.
 * @param {string} requestId
 * @returns {ChatMessage|null}
 */
export function answerTo(requestId) {
  if (!requestId) return null;
  for (const message of game.messages?.contents ?? []) {
    if (message.flags?.[SW.SYSTEM_ID]?.gainControl?.from === requestId) return message;
  }
  return null;
}

/**
 * Post an adversary's request (ruling 275): adversaries roll nothing, so the Bind partner rolls
 * Guard against the adversary's Attack Threshold, and the degree is read from the other side.
 * @param {Actor} user     The adversary using Gain Control.
 * @param {Actor} partner  Its Bind partner, who rolls.
 * @param {object} gc      `{ bindId, state, attackId, attackName, from, free }`; `free` when it was
 *   made as part of another Maneuver (a Parry), which the card's cost glyph says.
 * @param {string[]} [notes]
 * @returns {Promise<ChatMessage>}
 */
export async function postGainControlRequest(user, partner, gc, notes = []) {
  const esc = foundry.utils.escapeHTML;
  const names = { name: esc(user.name), partner: esc(partner.name) };
  const lines = [`<p>${F("STARWROUGHT.GainControl.requestText", names)}</p>`,
    ...notes.map(n => `<p class="sw-card-note sw-warn">${esc(n)}</p>`)];
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: user }),
    content: `<div class="starwrought action-card sw-bind-card sw-gain-control-request">
      <h3><span class="sw-spend-glyph">${SW.ACTION_GLYPHS[gc.free ? 0 : 1]}</span> ${L("STARWROUGHT.GainControl.label")}</h3>
      ${lines.join("")}
      <div class="sw-card-buttons" data-owner-uuid="${partner.uuid}">
        <button type="button" data-sw-action="gainControlGuard"><i class="fa-solid fa-dice-d20"></i> ${F("STARWROUGHT.GainControl.rollGuard", names)}</button>
      </div></div>`,
    flags: {
      [SW.SYSTEM_ID]: {
        kind: GAIN_CONTROL_REQUEST,
        // `from`: the card that offered this Gain Control (a Parry's result card), which is
        // answered by the request as it would be by a character's roll.
        gainControl: {
          bindId: gc.bindId ?? "", userUuid: user.uuid, partnerUuid: partner.uuid, state: gc.state ?? "neutral",
          attackId: gc.attackId ?? null, attackName: gc.attackName ?? "", from: gc.from ?? ""
        }
      }
    }
  });
}

/**
 * The request card's Roll Guard button: the partner's Guard check against the adversary's Attack
 * Threshold with the bound attack (`attackThreshold`, the Controlled implement's -2 never applied
 * here: ruling 280), the number withheld from a player as every adversary Threshold is. The card
 * it posts carries the Gain Control record with `inverted`, and the result is applied as a
 * character's is.
 * @param {ChatMessage} message  The request card.
 * @param {object} flags
 */
export async function rollGuardFromCard(message, flags) {
  const gc = flags?.gainControl;
  if ((flags?.kind !== GAIN_CONTROL_REQUEST) || !gc) return;
  if (answerTo(message.id)) return void ui.notifications.info(L("STARWROUGHT.GainControl.answered"));
  const user = resolveActor(gc.userUuid);
  const partner = resolveActor(gc.partnerUuid);
  if (!user || !partner) return void ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
  if (!(partner.isOwner || game.user.isGM)) return void ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
  const live = user.system?.bind;
  if (!live?.state || ((live.id ?? "") !== (gc.bindId ?? ""))) return void ui.notifications.warn(L("STARWROUGHT.GainControl.bindGone"));

  const threshold = attackThreshold(user, { attackId: gc.attackId ?? null, weaponName: gc.attackName ?? "" }, { controlled: false });
  // Withheld whoever presses the button (the review of 2026-11-15): the card is public and
  // spoken by the partner, and the attack flow never prints an adversary's Attack Threshold on a
  // Defense card, the GM's own roll included.
  const withhold = true;
  const guard = game.i18n.localize(SW.DEFENSES.guard.label);
  const userToken = user.tokenOnScene?.() ?? null;
  const result = await SwCheck.roll({
    actor: partner,
    kind: "check",
    slug: SW.DEFENSES.guard.slug,
    label: guard,
    subtitle: F("STARWROUGHT.GainControl.guardSubtitle", { name: userToken?.name ?? user.name }),
    threshold,
    thresholdLabel: F("STARWROUGHT.GainControl.thresholdLabel", { name: userToken?.name ?? user.name }),
    targetDefense: {
      key: null,
      label: withhold ? "" : `${F("STARWROUGHT.GainControl.thresholdLabel", { name: userToken?.name ?? user.name })} ${threshold}`,
      threshold: withhold ? null : threshold, unavailable: null, hidden: withhold
    },
    withholdThreshold: withhold,
    targetUuid: userToken?.uuid ?? "",
    targetName: userToken?.name ?? user.name,
    gainControl: { bindId: gc.bindId ?? "", userUuid: user.uuid, partnerUuid: partner.uuid, state: gc.state ?? "neutral", inverted: true, from: message.id, attackId: gc.attackId ?? null, attackName: gc.attackName ?? "" }
  });
  if (result?.message) await applyGainControl(result.message, { quiet: true });
  return result;
}

/**
 * The adversary's Attack Threshold a rerolled Guard card is read against, when the card could not
 * print it (documents/cards/reroll.mjs).
 * @param {object} gc  The card's `gainControl` record.
 * @returns {number|null}
 */
export function gainControlThreshold(gc) {
  if (!gc?.inverted) return null;
  const user = resolveActor(gc.userUuid);
  if (!user) return null;
  return attackThreshold(user, { attackId: gc.attackId ?? null, weaponName: gc.attackName ?? "" }, { controlled: false });
}

/* -------------------------------------------- */
/*  Keeping the cards in step                   */
/* -------------------------------------------- */

let registered = false;

/**
 * A card is not drawn again by itself. A Gain Control card's button stands for a write that may
 * be made from the sheet instead (Take Control, Make neutral, End Bind), by the other side, or by
 * a later card; and a request stands until its Guard is rolled. So when a fighter's Bind moves,
 * the recent cards that speak of that fighter are drawn again, and when a check answers a
 * request, the request is. On every client; idempotent; called once at ready.
 */
export function registerGainControlCards() {
  if (registered) return;
  registered = true;
  const redraw = message => {
    try {
      Promise.resolve(ui.chat?.updateMessage?.(message)).catch(() => {});
    } catch { /* the chat log is not there to redraw */ }
  };
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes ?? {}, "system.bind")) return;
    for (const message of (game.messages?.contents ?? []).slice(-REDRAW_DEPTH)) {
      const gc = message.flags?.[SW.SYSTEM_ID]?.gainControl;
      if (!gc) continue;
      if ((resolveActor(gc.userUuid)?.uuid !== actor.uuid) && (resolveActor(gc.partnerUuid)?.uuid !== actor.uuid)) continue;
      redraw(message);
    }
  });
  // The card a Gain Control answers: an adversary's request (its Roll Guard button goes), or the
  // Parry's result card that offered the free attempt (its button goes).
  const answered = message => {
    const own = message?.flags?.[SW.SYSTEM_ID];
    const from = own?.gainControl?.from;
    const asked = from ? game.messages.get(from) : null;
    if (asked) redraw(asked);
    // The Bind card that records a result as written: its check card loses the button.
    const applied = own?.gainControlApplied ? game.messages.get(own.gainControlApplied) : null;
    if (applied) redraw(applied);
  };
  Hooks.on("createChatMessage", answered);
  Hooks.on("deleteChatMessage", answered);
}

/**
 * A request already answered loses its button and says so (the render pass calls this).
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {object} flags
 */
export function drawGainControlRequest(message, html, flags) {
  if (flags?.kind !== GAIN_CONTROL_REQUEST) return;
  const gc = flags.gainControl;
  const user = resolveActor(gc?.userUuid);
  const live = user?.system?.bind;
  const gone = !live?.state || ((live.id ?? "") !== (gc?.bindId ?? ""));
  const answer = answerTo(message.id);
  if (!answer && !gone) return;
  for (const el of html.querySelectorAll("[data-sw-action='gainControlGuard']")) el.closest(".sw-card-buttons")?.remove();
  const p = document.createElement("p");
  p.className = "sw-card-note";
  p.textContent = L(answer ? "STARWROUGHT.GainControl.answered" : "STARWROUGHT.GainControl.bindGone");
  (html.querySelector(".starwrought") ?? html).append(p);
}
