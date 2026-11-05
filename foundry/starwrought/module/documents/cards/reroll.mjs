/**
 * The Reroll button on an Attack or Defense card (0.5.3; Mike, 2026-10-01: "Players (and the GM)
 * should have a 'reroll' option on the Attack, for special cases", "and for Defense rolls, too").
 * The roller's owner or the GM clicks; a small dialog takes the reason and offers a Hero Point; the
 * new d20 is thrown on the clicking client with the first die's formula, and read where the
 * Threshold can be known and the old card marked: here when the card showed its Threshold and this
 * client may update it, else on the active GM's client over the system socket. Inside the attack
 * flow one die filled every pairing, so the set of sibling resolution cards is rerolled with the
 * one new die. Through 0.10.0 this lived in documents/chat.mjs.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { AttackCoordinator } from "../../combat/attack-coordinator.mjs";
import { resolveActor, SOCKET, replyTo } from "./shared.mjs";

const REROLL_REFUSALS = {
  noCard: "STARWROUGHT.Reroll.refusedNoCard",
  already: "STARWROUGHT.Reroll.already",
  notYours: "STARWROUGHT.Reroll.refusedNotYours",
  noThreshold: "STARWROUGHT.Reroll.noThreshold"
};

/**
 * Throw an Attack or Defense card's die again (Mike, 2026-10-01: "Players (and the GM) should have
 * a 'reroll' option on the Attack, for special cases", "and for Defense rolls, too"). The roller's
 * owner or the GM clicks; a small dialog takes the reason, for the record, and offers to spend a
 * Hero Point when the roller is a character holding one. The new d20 is thrown here, with the
 * first die's formula, so a player throws the die they own. The reading happens where the
 * Threshold can be known and the old card can be marked: on this client when the card showed its
 * Threshold (or this is the GM, who may read a hidden one again) and this client may update the
 * old card; otherwise on the active GM's client, over the socket, which answers with the outcome.
 */
export async function rerollFromCard(message, flags) {
  if (flags.superseded) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.already"));
  const roller = resolveActor(flags.actorUuid);
  if (!roller) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
  if (!roller.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
  const original = message.rolls?.[0];
  if (!original?.formula) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.noRoll"));

  const answer = await rerollDialog(roller);
  if (!answer) return;
  let reason = answer.reason;
  // The Hero Point is spent once the reroll has gone through (below, or on the GM's reply), so a
  // refused or stale request costs nothing.
  if (answer.heroPoint && !reason) reason = game.i18n.localize("STARWROUGHT.Reroll.heroPointReason");

  const roll = await new Roll(original.formula).evaluate();
  // Dice So Nice, when present, shows the die as it shows any roll's.
  try { await game.dice3d?.showForRoll?.(roll, game.user, true); } catch { /* the dice module's business */ }
  const rollData = {
    roll: roll.toJSON(),
    total: roll.total,
    natural: roll.dice[0]?.results?.[0]?.result ?? null,
    formula: roll.formula,
    modifiers: flags.modifiers ?? []
  };

  // One die, every pairing it filled: inside the attack flow a player attacker's single roll
  // resolves against every defender, so rerolling one of those cards rerolls them all, with the
  // one new die. The coordinator authored those cards, so the set goes to the GM's client unless
  // this is the GM.
  const siblings = AttackCoordinator.siblingResolutions(message.id);
  const gm = game.users.activeGM;
  if (game.user.isGM) {
    const result = await rerollSet(siblings, { rollData, reason, clicked: message.id });
    if (!result) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.noThreshold"));
    if (answer.heroPoint) await spendHeroPointFor(roller);
    return notifyReroll(outcomeLabel(result));
  }
  const shown = Number.isNumeric(flags.threshold) ? Number(flags.threshold) : null;
  if ((siblings.length === 1) && (shown !== null) && (message.isAuthor || !gm)) {
    const result = await SwCheck.rerollCard(message, { rollData, reason, threshold: shown });
    if (result && !message.isAuthor) ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.notMarked"));
    if (result && answer.heroPoint) await spendHeroPointFor(roller);
    return notifyReroll(outcomeLabel(result));
  }
  if (!gm) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.noGm"));
  game.socket.emit(SOCKET, {
    type: "reroll:apply", to: gm.id, messageId: message.id, rollData, reason, heroPoint: !!answer.heroPoint
  }, { recipients: [gm.id] });
  return ui.notifications.info(game.i18n.localize("STARWROUGHT.Reroll.sent"));
}

/**
 * Reroll a set of resolution cards with one die, on a client that may read every Threshold and
 * mark every card (the GM's). Each card's Threshold is its own where it showed one, else read
 * again from actor data. A card already superseded is left alone. Returns the clicked card's
 * result (else the first), or null when no card could be read.
 */
async function rerollSet(ids, { rollData, reason, clicked = null }) {
  let first = null;
  let chosen = null;
  for (const id of ids) {
    const msg = game.messages.get(id);
    const flags = msg?.flags?.[SW.SYSTEM_ID];
    if (!flags || flags.superseded || !["attack", "defense"].includes(flags.kind)) continue;
    const threshold = Number.isNumeric(flags.threshold) ? Number(flags.threshold) : AttackCoordinator.thresholdForCard(flags);
    if (threshold === null) continue;
    const result = await SwCheck.rerollCard(msg, { rollData, reason, threshold });
    if (!result) continue;
    first ??= result;
    if (id === clicked) chosen = result;
  }
  return chosen ?? first;
}

/** Spend one Hero Point for a reroll that went through, by the actor's own method, which posts its card. */
async function spendHeroPointFor(actor) {
  if (!actor?.isOwner || (typeof actor.spendHeroPoint !== "function")) return;
  if (!(Number(actor.system?.heroPoints?.value) > 0)) return;
  try {
    await actor.spendHeroPoint();
  } catch (err) {
    console.error("STARWROUGHT | the Hero Point for a reroll could not be spent", err);
  }
}

/** The small dialog: why, for the record, and a Hero Point to spend when the roller has one. */
async function rerollDialog(roller) {
  const L = key => game.i18n.localize(key);
  const hero = (roller.type === "character") ? (Number(roller.system.heroPoints?.value) || 0) : 0;
  const content = `
    <p>${game.i18n.format("STARWROUGHT.Reroll.prompt", { label: foundry.utils.escapeHTML(roller.name) })}</p>
    <div class="form-group">
      <label>${L("STARWROUGHT.Reroll.reasonLabel")}</label>
      <input type="text" name="reason" maxlength="80" placeholder="${foundry.utils.escapeHTML(L("STARWROUGHT.Reroll.reasonPlaceholder"))}">
    </div>
    ${hero > 0 ? `<div class="form-group"><label class="checkbox"><input type="checkbox" name="heroPoint"> ${
      game.i18n.format("STARWROUGHT.Reroll.heroPoint", { n: hero })}</label></div>` : ""}`;
  return foundry.applications.api.DialogV2.prompt({
    window: { title: L("STARWROUGHT.Reroll.title"), icon: "fa-solid fa-rotate-right" },
    classes: ["starwrought"],
    content,
    ok: {
      label: L("STARWROUGHT.Reroll.confirm"),
      icon: "fa-solid fa-rotate-right",
      callback: (event, button) => ({
        reason: String(button.form.elements.reason?.value ?? "").trim().slice(0, 80),
        heroPoint: !!button.form.elements.heroPoint?.checked
      })
    },
    rejectClose: false
  });
}

/**
 * The new card's outcome as a label, for the notification: the attack's result (Hit, Graze, Miss,
 * Critical Hit) on either side's card, since a Defense card's degree is written from the
 * attacker's side and "Critical success" would read backwards to the defender.
 */
function outcomeLabel(result) {
  const key = (typeof result?.outcome === "string") ? result.outcome : result?.outcome?.key;
  const entry = key ? Object.values(SW.ATTACK_OUTCOMES).find(o => o.key === key) : null;
  if (entry) return game.i18n.localize(entry.label);
  if (result?.degree && SW.DEGREES[result.degree]) return game.i18n.localize(SW.DEGREES[result.degree].label);
  return "";
}

function notifyReroll(outcome) {
  return ui.notifications.info(outcome
    ? game.i18n.format("STARWROUGHT.Reroll.done", { outcome })
    : game.i18n.localize("STARWROUGHT.Reroll.donePlain"));
}

/* -------------------------------------------- */
/*  Over the socket (0.5.3)                     */
/* -------------------------------------------- */

/**
 * The `reroll:*` half of the system socket (0.5.3), routed here by `onChatSocket`: a `reroll:apply`
 * is answered by the GM's client with `reroll:done` or `reroll:refused`, addressed to the asker
 * alone; on `reroll:done` the Hero Point the asker offered is spent now, by the asker's own client.
 * @param {object} message
 * @param {string|null} sender  The emitting user's id, from the server's stamp; null when unknown.
 */
export async function onRerollSocket(message, sender) {
  switch (message.type) {
    case "reroll:apply": {
      if (!sender || !game.user.isGM) return;
      return replyTo(sender, message.messageId, await rerollForUser(message, sender));
    }
    case "reroll:done": {
      // The die was read; the Hero Point the asker offered is spent now, by the asker's own client.
      if (message.heroPoint) {
        const flags = game.messages.get(message.messageId ?? "")?.flags?.[SW.SYSTEM_ID];
        await spendHeroPointFor(resolveActor(flags?.actorUuid));
      }
      notifyReroll(message.outcome ?? "");
      return;
    }
    case "reroll:refused":
      ui.notifications.warn(game.i18n.localize(REROLL_REFUSALS[message.reason] ?? "STARWROUGHT.Reroll.refused"));
      return;
    default:
      return;
  }
}

/**
 * Read a rerolled die for another user, on the GM's client. The asker must own the roller; the
 * die must be a Roll of the first card's own formula (the modifiers are not the asker's to
 * change); the Threshold is the card's where it showed one, else read again from actor data.
 */
async function rerollForUser(request, userId) {
  const chat = game.messages.get(request.messageId);
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || !["attack", "defense"].includes(flags?.kind)) return { type: "reroll:refused", reason: "noCard" };
  if (flags.superseded) return { type: "reroll:refused", reason: "already" };
  const user = game.users.get(userId);
  const roller = resolveActor(flags.actorUuid);
  if (!roller || !user || !roller.testUserPermission(user, "OWNER")) return { type: "reroll:refused", reason: "notYours" };
  const rollData = rerollData(request.rollData, chat.rolls?.[0]?.formula ?? "");
  if (!rollData) return { type: "reroll:refused", reason: "noCard" };
  // The one die fills every pairing it filled the first time (the attack flow's multi-target Strike).
  const result = await rerollSet(AttackCoordinator.siblingResolutions(chat.id), {
    rollData, reason: String(request.reason ?? "").slice(0, 80), clicked: chat.id
  });
  if (!result) return { type: "reroll:refused", reason: "noThreshold" };
  return { type: "reroll:done", outcome: outcomeLabel(result), heroPoint: !!request.heroPoint };
}

/** A submitted die, if it is a Roll of the expected formula; null for anything else. */
function rerollData(payload, formula) {
  try {
    const roll = Roll.fromData(payload?.roll);
    if (!roll?.total || (roll.formula !== formula)) return null;
    return {
      roll: roll.toJSON(),
      total: roll.total,
      natural: roll.dice[0]?.results?.[0]?.result ?? null,
      formula: roll.formula,
      modifiers: null
    };
  } catch {
    return null;
  }
}
