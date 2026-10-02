/**
 * Chat card behaviour: the buttons that carry an attack through to damage, damage through to a
 * body, and a Stopped blow through to Position (PHB v4.10, The Exchange, step 5). Everything here
 * reads its state from the message's own flags and the button's own data, so a card still works
 * after a reload.
 *
 * Buttons are offers, never automatic writes: "a plausible Zone", "if they Guarded with a rigid
 * weapon" and "the defender's choice" are the table's to confirm. Each button is shown only to
 * a user who owns the actor it acts for (`data-owner-uuid`), so the attacker sees the damage
 * buttons and the defender sees the Position buttons; the GM sees everything.
 *
 * The attack card (0.5.0, templates/chat/attack-workflow-card.hbs) follows the same rule and adds
 * two markers of its own: `data-gm-only` on the GM's recovery controls, and `data-sw-threshold-for`
 * on a character's Threshold, which the brief's visibility policy decides per viewer. Its buttons
 * never decide anything here: they open the Combat Prompt, hand the roll to the coordinator's
 * `rollFor`, or send a GM control through `AttackCoordinator.request`.
 */

import * as SW from "../config.mjs";
import { SwDamage } from "../dice/damage.mjs";
import { SwCheck } from "../dice/check.mjs";
import { enabledConstellations } from "../helpers/content.mjs";
import { AttackCoordinator } from "../combat/attack-coordinator.mjs";
import { CARD_KIND as ATTACK_CARD_KIND, thresholdVisibleTo, mayControl } from "../combat/attack-card.mjs";
import { SwCombatPrompt } from "../apps/combat-prompt.mjs";

/** Wire up a rendered chat card. */
export function onRenderChatMessage(message, html) {
  // A card title that opens a Rules Reference page (0.5.1, T6: the Bind and Exposed cards). Those
  // cards carry no flags, so this is wired before the flags gate and skipped by the loop below.
  for (const link of html.querySelectorAll("[data-sw-action='rulesPage']")) {
    link.addEventListener("click", event => {
      event.preventDefault();
      openRulesPage(link.dataset.page);
    });
  }

  const flags = message.flags?.[SW.SYSTEM_ID];
  if (!flags) return;

  // Offers meant for one side of the exchange vanish for everyone who cannot act on them.
  for (const el of html.querySelectorAll("[data-owner-uuid]")) {
    const actor = resolveActor(el.dataset.ownerUuid);
    if (actor && !actor.isOwner) el.remove();
  }

  // A rerolled card (0.5.3) keeps its place in the record and loses its controls: the new throw
  // below it is the one that acts. Done before the buttons are wired, so none of them is.
  if (flags.superseded) {
    const card = html.querySelector(".starwrought") ?? html;
    card.classList.add("sw-superseded");
    for (const el of card.querySelectorAll("button, select")) el.disabled = true;
    for (const el of card.querySelectorAll("[data-sw-action]")) {
      if (el.dataset.swAction !== "rulesPage") el.removeAttribute("data-sw-action");
    }
    const reason = flags.superseded.reason;
    const note = document.createElement("p");
    note.className = "sw-card-note sw-warn sw-superseded-note";
    note.textContent = reason
      ? game.i18n.format("STARWROUGHT.Reroll.supersededReason", { reason })
      : game.i18n.localize("STARWROUGHT.Reroll.superseded");
    const anchor = card.querySelector(".sw-card-roll");
    if (anchor) anchor.after(note);
    else card.prepend(note);
  }

  // A Reaction already charged offers no button.
  if (flags.reactionCharged) {
    for (const el of html.querySelectorAll("[data-sw-action='chargeReaction']")) el.remove();
  }

  // The GM controls (the attack card's Cancel, Reset defenses, Resend prompts and Answer with
  // standing stances) are the GM's, or the coordinator's at a table with no GM connected. The
  // content is the same on every client; the row is not.
  if (!mayControl(game.user, flags.attackWorkflow)) {
    for (const el of html.querySelectorAll("[data-gm-only]")) el.remove();
  }

  // The attack card prints "vs {threshold}" for a character defender; whether this viewer may see
  // it is the brief's visibility policy, read from the setting and actor ownership, never from a
  // flag (an adversary's Threshold is never in the flags at all).
  if (flags.kind === ATTACK_CARD_KIND) pruneAttackThresholds(html, flags.attackWorkflow);

  for (const button of html.querySelectorAll("[data-sw-action]")) {
    if (button.dataset.swAction === "rulesPage") continue;
    button.addEventListener("click", event => onCardButton(event, message, flags));
  }
}

/* -------------------------------------------- */

async function onCardButton(event, message, flags) {
  event.preventDefault();
  const button = event.currentTarget;
  const action = button.dataset.swAction;
  button.disabled = true;

  try {
    switch (action) {
      case "damage": return await rollDamageFromCard(message, flags, button.dataset.outcome);
      case "applyDamage": return await applyDamageFromCard(message, flags, button, event);
      case "flare": return await flareFromCard(message, flags, button);
      case "reroll": return await rerollFromCard(message, flags);
      case "expose":
      case "exposeZone": return await exposeFromCard(button);
      case "formBind": return await formBindFromCard(button);
      case "giveGround": return await giveGroundFromCard(button);
      case "step": return await stepFromCard(button);
      case "counterStrike":
      case "riposte": return await reactionStrikeFromCard(button, action === "riposte" ? "riposte" : "counter");
      case "chargeReaction": return await chargeReactionFromCard(message, button);
      case "finishPrepared": return await ownedActor(button)?.finishPrepared();
      case "abandonPrepared": return await ownedActor(button)?.abandonPrepared();
      case "recovery": return await ownedActor(button)?.rollRecovery();
      case "recenter": return await recenterFromCard(button);
      // The attack card (0.5.0): recovery, never decision.
      case "attackOpenPrompt": return await openAttackPrompt(button);
      case "attackRoll": return await rollFromAttackCard(button);
      case "attackCancel": return await gmAttackRequest(flags, button, "cancel");
      case "attackReset": return await gmAttackRequest(flags, button, "resetDefenses");
      case "attackResend": return await gmAttackRequest(flags, button, "resendPrompts");
      case "attackUseStances": return await gmAttackRequest(flags, button, "useStances");
      default: return;
    }
  } finally {
    button.disabled = false;
  }
}

/* -------------------------------------------- */

/** The Actor behind a uuid, whether the uuid names an Actor or a Token. */
export function resolveActor(uuid) {
  if (!uuid) return null;
  const doc = fromUuidSync(uuid);
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  return doc.actor ?? null;
}

/** The TokenDocument behind a uuid that names a Token, or an Actor's first token on the scene. */
export function resolveTokenDoc(uuid) {
  if (!uuid) return null;
  const doc = fromUuidSync(uuid);
  if (!doc) return null;
  if (doc.documentName === "Token") return doc;
  if (doc.documentName === "Actor") return doc.getActiveTokens(false, true)[0] ?? null;
  return null;
}

/**
 * Open a page of the shipped Rules Reference by its title (0.5.1, T6). The page is found by name
 * in the `rules` compendium, never by id: the ids are deterministic in the build, but the client
 * has no business knowing them. Used by the Bind and Exposed card titles, the sheet's bind line,
 * the Zones panel's EXPOSED badge and the Effects tab.
 * @param {string} title  The page's name, as build_foundry.mjs's journalPages spells it.
 * @returns {Promise<Application|null>}
 */
export async function openRulesPage(title) {
  if (!title) return null;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.rules`);
  const entries = pack ? await pack.getDocuments() : [];
  const wanted = String(title).trim().toLowerCase();
  for (const entry of entries) {
    const page = entry.pages.find(p => p.name.trim().toLowerCase() === wanted);
    if (page) return entry.sheet.render({ force: true, pageId: page.id });
  }
  ui.notifications.warn(game.i18n.format("STARWROUGHT.Rules.missing", { page: title }));
  return null;
}

/** The owned Actor a button acts for, or a warning and null. */
export function ownedActor(button, key = "actorUuid") {
  const actor = resolveActor(button.dataset[key]);
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
    return null;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  return actor;
}

/** The Zone a widget's own select says, or the button's data, or the Torso. */
function zoneFrom(button) {
  const widget = button.closest("[data-sw-widget]") ?? button.parentElement;
  const select = widget?.querySelector("select[name='zone']");
  const zone = button.dataset.zone || select?.value || SW.DEFAULT_ZONE;
  return (zone in SW.ZONES) ? zone : SW.DEFAULT_ZONE;
}

/* -------------------------------------------- */

/** The attack card's Critical / Hit / Graze buttons. The Strike kind rides along from the card. */
async function rollDamageFromCard(message, flags, outcome) {
  const actor = await fromUuid(flags.actorUuid);
  const doc = actor?.actor ?? actor;
  if (!doc) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
  if (!doc.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
  const weapon = doc.items.get(flags.weaponId);
  if (!weapon) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noWeapon"));
  return SwDamage.roll({
    actor: doc, weapon, outcome,
    strike: flags.strike ?? SW.DEFAULT_STRIKE,
    // The Proficiency the attack rolled (Melee or Ranged) decides whose specialization lands.
    slug: flags.slug ?? "",
    thrown: !!flags.thrown,
    targetUuid: flags.targetUuid ?? ""
  });
}

/* -------------------------------------------- */

/**
 * The damage card's Apply row. The card names the creature it was rolled against, and that is who
 * takes the damage (0.5.3; Mike: "when I roll damage on my target, it damages me instead"): this
 * client spends it when it may write the actor, and otherwise asks the active GM's client to, over
 * the system socket, since a player's Strike nearly always lands on an adversary the player cannot
 * write. Shift-click spends it on the selected tokens instead: the GM's redirect, or a player
 * taking an adversary's blow on themselves. A card with no target (damage rolled from the sheet
 * with nothing targeted) falls back to the selection, then to the user's targets. The old order,
 * selection first, put a player's own blow on their own selected token, which a player who has
 * just Struck always has.
 */
async function applyDamageFromCard(message, flags, button, event) {
  const multiplier = Number(button.dataset.multiplier ?? 1);
  const card = button.closest(".starwrought.damage-card");
  const zone = card?.querySelector("select[name='zone']")?.value ?? SW.DEFAULT_ZONE;

  let targets;
  if (event?.shiftKey) targets = resolveTargets("");
  else if (flags.targetUuid) {
    const named = resolveActor(flags.targetUuid);
    if (!named) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.targetGone"));
    if (!named.isOwner) return relayDamage(message, named, { zone, multiplier });
    targets = [named];
  } else targets = resolveTargets("");
  if (!targets.length) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));

  for (const actor of targets) await applyCard(actor, flags, { zone, multiplier });
}

/** Spend one damage card on one Actor, and post what the body felt. */
async function applyCard(actor, flags, { zone, multiplier }) {
  const result = await SwDamage.apply(actor, {
    base: flags.base,
    deadly: flags.deadly,
    type: flags.damageType,
    zone,
    critical: flags.critical,
    graze: flags.graze,
    strike: flags.strike ?? SW.DEFAULT_STRIKE,
    armorPiercing: flags.armorPiercing,
    massive: !!flags.massive,
    nonlethal: !!flags.nonlethal,
    multiplier
  });
  await postDamageSummary(actor, result, multiplier);
  return result;
}

/**
 * Which Actors a card click should land on: the creature the uuid names when this user may write
 * it, then the selected tokens, then the user's targets.
 */
function resolveTargets(targetUuid) {
  const named = resolveActor(targetUuid);
  if (named?.isOwner) return [named];
  const controlled = canvas.tokens?.controlled?.map(t => t.actor).filter(a => a?.isOwner) ?? [];
  if (controlled.length) return controlled;
  return Array.from(game.user.targets).map(t => t.actor).filter(a => a?.isOwner);
}

/* -------------------------------------------- */
/*  Damage over the socket (0.5.3)              */
/* -------------------------------------------- */

const SOCKET = `system.${SW.SYSTEM_ID}`;
const MULTIPLIERS = [1, 0.5, -1];
const REFUSALS = {
  noCard: "STARWROUGHT.Notify.damageRefusedNoCard",
  notYours: "STARWROUGHT.Notify.damageRefusedNotYours",
  noTarget: "STARWROUGHT.Notify.damageRefusedNoTarget"
};

/**
 * Ask the active GM's client to spend a damage card on a creature this client cannot write. The
 * request carries the card's id and the two things the clicker chose, the Zone and the multiplier;
 * the GM's client reads everything else (who was hit, the totals, the Strike) from the message
 * itself, and who is asking from the server's stamp on the socket event, as the attack flow does.
 */
function relayDamage(message, target, { zone, multiplier }) {
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.noGmToApply", { name: target.name }));
  game.socket.emit(SOCKET, { type: "damage:apply", to: gm.id, messageId: message.id, zone, multiplier }, { recipients: [gm.id] });
  return ui.notifications.info(game.i18n.format("STARWROUGHT.Notify.damageSent", { name: target.name }));
}

/**
 * The chat cards' half of the system socket: starwrought.mjs routes `damage:*` and `reroll:*`
 * here and everything else to the attack coordinator. A `damage:apply` or `reroll:apply` is
 * answered by the GM's client with `damage:applied`, `reroll:done` or a refusal, each addressed
 * to the asker alone.
 * @param {object} message
 * @param {string} [senderId]  The emitting user's id, supplied by the server.
 */
export async function onChatSocket(message, senderId) {
  if (!message || (typeof message !== "object") || (message.to !== game.user.id)) return;
  const sender = ((typeof senderId === "string") && game.users.has(senderId)) ? senderId : null;
  switch (message.type) {
    case "damage:apply": {
      if (!sender || !game.user.isGM) return;
      const reply = await applyDamageForUser(message, sender);
      game.socket.emit(SOCKET, { ...reply, to: sender, messageId: message.messageId }, { recipients: [sender] });
      return;
    }
    case "damage:applied":
      ui.notifications.info(game.i18n.format("STARWROUGHT.Notify.damageApplied", { name: message.name ?? "" }));
      return;
    case "damage:refused":
      ui.notifications.warn(game.i18n.localize(REFUSALS[message.reason] ?? "STARWROUGHT.Notify.damageRefused"));
      return;
    case "reroll:apply": {
      if (!sender || !game.user.isGM) return;
      const reply = await rerollForUser(message, sender);
      game.socket.emit(SOCKET, { ...reply, to: sender, messageId: message.messageId }, { recipients: [sender] });
      return;
    }
    case "reroll:done":
      notifyReroll(message.outcome ?? "");
      return;
    case "reroll:refused":
      ui.notifications.warn(game.i18n.localize(REROLL_REFUSALS[message.reason] ?? "STARWROUGHT.Reroll.refused"));
      return;
    default:
      return;
  }
}

/** Kept under its old name for a module that imported it from 0.5.3's first cut. */
export const onDamageSocket = onChatSocket;

/**
 * Spend a damage card for another user, on the GM's client. The asker must have rolled it (the
 * card's author) or own the attacker; the creature is the one the card names, never one the
 * request names; the Zone is held to what the Strike allows (a Quick Strike lands on the Torso and
 * nowhere else) and the multiplier to the three buttons.
 */
async function applyDamageForUser(request, userId) {
  const chat = game.messages.get(request.messageId);
  const flags = chat?.flags?.[SW.SYSTEM_ID];
  if (!chat || (flags?.kind !== "damage")) return { type: "damage:refused", reason: "noCard" };
  const user = game.users.get(userId);
  const attacker = resolveActor(flags.actorUuid);
  const may = (chat.author?.id === userId) || (!!attacker && !!user && attacker.testUserPermission(user, "OWNER"));
  if (!may) return { type: "damage:refused", reason: "notYours" };
  const target = resolveActor(flags.targetUuid);
  if (!target?.isOwner) return { type: "damage:refused", reason: "noTarget" };

  const asked = String(request.zone ?? "");
  let zone = (asked in SW.ZONES) ? asked : SW.DEFAULT_ZONE;
  const kind = SW.STRIKE_KINDS[flags.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  if (!flags.graze && !flags.critical && !kind.placeOnExposed) zone = SW.DEFAULT_ZONE;
  const multiplier = MULTIPLIERS.includes(Number(request.multiplier)) ? Number(request.multiplier) : 1;
  await applyCard(target, flags, { zone, multiplier });
  return { type: "damage:applied", name: target.name };
}

/* -------------------------------------------- */
/*  Rerolls (0.5.3)                              */
/* -------------------------------------------- */

const REROLL_REFUSALS = {
  noCard: "STARWROUGHT.Reroll.refusedNoCard",
  already: "STARWROUGHT.Reroll.already",
  notYours: "STARWROUGHT.Reroll.refusedNotYours"
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
async function rerollFromCard(message, flags) {
  if (flags.superseded) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.already"));
  const roller = resolveActor(flags.actorUuid);
  if (!roller) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
  if (!roller.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
  const original = message.rolls?.[0];
  if (!original?.formula) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.noRoll"));

  const answer = await rerollDialog(roller);
  if (!answer) return;
  let reason = answer.reason;
  if (answer.heroPoint) {
    if (typeof roller.spendHeroPoint === "function") await roller.spendHeroPoint();
    if (!reason) reason = game.i18n.localize("STARWROUGHT.Reroll.heroPointReason");
  }

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

  const shown = Number.isNumeric(flags.threshold) ? Number(flags.threshold) : null;
  const threshold = shown ?? (game.user.isGM ? AttackCoordinator.thresholdForCard(flags) : null);
  const gm = game.users.activeGM;
  if ((threshold !== null) && (message.isAuthor || game.user.isGM || !gm)) {
    const result = await SwCheck.rerollCard(message, { rollData, reason, threshold });
    return notifyReroll(outcomeLabel(result));
  }
  if (!gm) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Reroll.noGm"));
  game.socket.emit(SOCKET, { type: "reroll:apply", to: gm.id, messageId: message.id, rollData, reason }, { recipients: [gm.id] });
  return ui.notifications.info(game.i18n.localize("STARWROUGHT.Reroll.sent"));
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
  const threshold = Number.isNumeric(flags.threshold) ? Number(flags.threshold) : AttackCoordinator.thresholdForCard(flags);
  const result = await SwCheck.rerollCard(chat, { rollData, reason: String(request.reason ?? "").slice(0, 80), threshold });
  return { type: "reroll:done", outcome: outcomeLabel(result) };
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

/** A short card saying what the body actually felt. */
async function postDamageSummary(actor, result, multiplier) {
  const { renderTemplate } = foundry.applications.handlebars;
  const content = await renderTemplate("systems/starwrought/templates/chat/applied-card.hbs", {
    actor,
    result,
    healing: multiplier < 0,
    zoneLabel: result.zone ? game.i18n.localize(SW.ZONES[result.zone]?.label ?? "") : "",
    critEffect: result.critEffect ? game.i18n.localize(result.critEffect) : "",
    wound: result.wound ?? null,
    woundCapacity: result.wound ? actor.woundCapacity(result.zone) : 0
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: actor.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
  });
}

/* -------------------------------------------- */

/**
 * Light a Constellation from a critical.
 *
 * The die can say the roll was a critical; only the table can say which Constellation's Talent
 * it was related to, and the answer is often not the Constellation that supplied the Proficiency
 * Bonus. Kessa's crit came off a Great Weapon Fighting talent, but the roll itself was Melee.
 * So the button asks, defaulting to the Constellation that was rolled.
 */
async function flareFromCard(message, flags, button) {
  const doc = await fromUuid(flags.actorUuid);
  const actor = doc?.actor ?? doc;
  if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));

  const suggested = button.dataset.slug || "";
  // The character's own Constellations first (an owned one that has since been disabled stays
  // listed), then every Constellation that ships (Enabled? = Yes, ruling 61).
  const owned = Object.values(actor.system.constellations ?? {});
  const choices = new Map(owned.map(c => [c.slug, c.name]));
  for (const meta of enabledConstellations()) {
    if (!choices.has(meta.slug)) choices.set(meta.slug, meta.name);
  }
  const options = [...choices.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([slug, name]) => `<option value="${slug}" ${slug === suggested ? "selected" : ""}>${name}</option>`)
    .join("");

  const slug = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Flare.title"), icon: "fa-solid fa-certificate" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.localize("STARWROUGHT.Flare.prompt")}</p>
      <select name="slug" style="width: 100%">${options}</select>`,
    ok: {
      label: game.i18n.localize("STARWROUGHT.Flare.button"),
      callback: (event, target) => target.form.elements.slug.value
    },
    rejectClose: false
  });
  if (!slug) return;

  await actor.toggleFlare(slug, true);
  const name = choices.get(slug) ?? slug;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="starwrought action-card sw-flare-card">
      <h3><i class="fa-solid fa-certificate"></i> ${game.i18n.localize("STARWROUGHT.Flare.title")}</h3>
      <p>${game.i18n.format("STARWROUGHT.Flare.message", { name })}</p></div>`
  });
}

/* -------------------------------------------- */
/*  Position                                    */
/* -------------------------------------------- */

/**
 * Expose a Zone on an actor from a card: the attacker after a Miss or a Weighted Graze (the
 * defender's choice of Zone), or the defender after a Committed Hit or a Deliberate Critical Hit
 * (the attacker's choice of a plausible Zone). The Zone comes from the widget's own select.
 */
async function exposeFromCard(button) {
  const zone = zoneFrom(button);
  const named = resolveActor(button.dataset.actorUuid ?? button.dataset.targetUuid);
  const targets = named ? [named] : resolveTargets("");
  if (!targets.length) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));
  for (const actor of targets) {
    if (!actor.isOwner) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Position.notOwnedExpose", { name: actor.name }));
      continue;
    }
    await actor.setExposed(zone, true, { announced: true });
    // The title opens the rules page for Exposed (0.5.1, T6).
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="starwrought action-card sw-exposed-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="Exposed" data-tooltip="STARWROUGHT.Rules.openExposed"><i class="fa-solid fa-bullseye"></i> ${
        game.i18n.localize("STARWROUGHT.Condition.exposed")}</a></h3>
        <p>${game.i18n.format("STARWROUGHT.Position.exposedText", {
          name: actor.name, zone: game.i18n.localize(SW.ZONES[zone].label)
        })}</p></div>`
    });
  }
}

/**
 * Form a Bind, or take Control of the attacking weapon. The defender is the one who Guarded, so
 * the defender's owner clicks; the attacker's side is mirrored when this client owns it too.
 * Taking Control also opens a Zone of the Controller's choice on the partner, while it lasts.
 */
async function formBindFromCard(button) {
  const defender = ownedActor(button, "controllerUuid");
  if (!defender) return;
  const partner = resolveActor(button.dataset.partnerUuid);
  if (!partner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));
  // A card can name the same creature twice (a linked actor's token striking another of its
  // tokens); a Bind is between two fighters, so there is nothing to form.
  if (partner === defender) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.samePartner"));
  const control = button.dataset.mode === "control";
  const bind = await defender.formBind(partner, {
    state: control ? "controlling" : "neutral",
    mine: button.dataset.mine ?? "",
    theirs: button.dataset.theirs ?? ""
  });
  // formBind returns the recorded side, or null when it could not form one; say so rather than
  // leaving the player to find out from the sheet (0.5.1, T4).
  if (!bind?.state) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Bind.notFormed"));
  if (!control) return;

  // "Your partner has an Exposed Zone of your choice, and it stays Exposed while the Bind lasts."
  if (!partner.isOwner) {
    return ui.notifications.warn(game.i18n.format("STARWROUGHT.Position.notOwnedExpose", { name: partner.name }));
  }
  const options = Object.entries(SW.ZONES)
    .map(([key, z]) => `<option value="${key}" ${key === SW.DEFAULT_ZONE ? "selected" : ""}>${game.i18n.localize(z.label)}</option>`)
    .join("");
  const zone = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Bind.takeControl"), icon: "fa-solid fa-link" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.format("STARWROUGHT.Bind.exposePrompt", { partner: partner.name })}</p>
      <select name="zone" style="width: 100%">${options}</select>`,
    ok: {
      label: game.i18n.localize("STARWROUGHT.Condition.exposed"),
      callback: (event, target) => target.form.elements.zone.value
    },
    rejectClose: false
  });
  if (zone && (zone in SW.ZONES)) await partner.setExposed(zone, true, { announced: true });
}

/** An Evade that Grazed gives 3 feet of ground, directly away from the attacker. */
async function giveGroundFromCard(button) {
  const defender = ownedActor(button);
  if (!defender) return;
  const attackerToken = resolveTokenDoc(button.dataset.attackerTokenUuid || button.dataset.attackerUuid);
  if (!attackerToken) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noToken"));
  const feet = Number(button.dataset.feet) || SW.GIVE_GROUND_FEET;
  return defender.giveGround(attackerToken, feet);
}

/** A Step granted by the exchange: announced, and the player moves the token. */
async function stepFromCard(button) {
  const actor = ownedActor(button);
  if (!actor) return;
  return actor.announceStep();
}

/**
 * The defender's Quick Strike back: Counter (its ❶↺ was charged when the attack resolved) or the
 * riposte after a Parry took Control (⓿). The weapon is the melee weapon in hand that sets the
 * defender's Total Reach; with none in hand there is nothing to strike with.
 */
async function reactionStrikeFromCard(button, reaction) {
  const actor = ownedActor(button);
  if (!actor) return;
  const weapon = actor.system.reachWeapon
    ?? actor.items.find(i => (i.type === "weapon") && i.system.held && !i.system.isRanged)
    ?? actor.items.find(i => (i.type === "weapon") && i.system.held);
  if (!weapon) return ui.notifications.warn(game.i18n.format("STARWROUGHT.Reaction.noWeapon", { name: actor.name }));
  return actor.rollAttack(weapon.id, {
    reaction,
    targetUuid: button.dataset.targetUuid || ""
  });
}

/**
 * Charge the defender's Reaction from the card, when the attacker's client could not: the ❶↺
 * comes off the defender's six and their stance falls back to its basic Defense.
 */
async function chargeReactionFromCard(message, button) {
  const actor = ownedActor(button);
  if (!actor) return;
  const key = button.dataset.reaction;
  if (!SW.REACTIONS[key]) return;
  const charged = await SwCheck.chargeReaction(actor, key);
  if (!charged) return;
  button.closest("[data-sw-widget='reaction']")?.remove();
  if (message.isAuthor || game.user.isGM) {
    await message.update({ [`flags.${SW.SYSTEM_ID}.reactionCharged`]: true });
  }
}

/** Recenter from a card. */
async function recenterFromCard(button) {
  const named = resolveActor(button.dataset.actorUuid);
  const targets = named?.isOwner ? [named] : resolveTargets(button.dataset.targetUuid);
  for (const actor of targets) await actor.recenter();
}

/* -------------------------------------------- */
/*  The attack card (0.5.0)                      */
/* -------------------------------------------- */

/**
 * The attack card's "vs {threshold}" spans: kept only where the brief's policy lets this viewer
 * see the number (the defender's owner and the GM always; the attacker's owner under the
 * attackShowPcThresholds setting; never a player for an adversary). The policy itself lives in
 * attack-card.mjs so a user-specific render and this prune can never disagree.
 */
function pruneAttackThresholds(html, state) {
  for (const el of html.querySelectorAll("[data-sw-threshold-for]")) {
    const targetId = el.closest("[data-target-id]")?.dataset.targetId;
    const target = state?.targets?.find(t => (t.id === targetId) || (!targetId && (t.actorUuid === el.dataset.swThresholdFor)));
    if (!target || !thresholdVisibleTo(game.user, state, target)) el.remove();
  }
}

/**
 * The per-user button's second gate. The render hook already removed it for anyone who cannot act
 * for its actor; a click that reaches here from a stale card is checked again, and the message is
 * the attack flow's own ("That decision belongs to another player.").
 */
function actsForAttackButton(button) {
  const uuid = button.dataset.ownerUuid;
  if (!uuid) return true;
  const actor = resolveActor(uuid);
  if (!actor) return game.user.isGM;
  if (actor.isOwner) return true;
  ui.notifications.warn(game.i18n.localize("STARWROUGHT.Attack.notYours"));
  return false;
}

/** Choose Defense, or reopen the Combat Prompt on this attack: the prompt lists what is yours to do. */
async function openAttackPrompt(button) {
  const workflowId = button.dataset.workflowId;
  if (!workflowId) return;
  if (!actsForAttackButton(button)) return;
  return SwCombatPrompt.open({ workflowId });
}

/**
 * Roll Attack or Roll Defense. The roller's own client throws the die blind (no Threshold) and
 * hands the result to the coordinator, which reads it against every pairing (brief, "The roll and
 * the resolution"); `AttackCoordinator.rollFor` is that whole step.
 */
async function rollFromAttackCard(button) {
  const { workflowId, targetId } = button.dataset;
  if (!workflowId) return;
  if (!actsForAttackButton(button)) return;
  return AttackCoordinator.rollFor(workflowId, targetId || null);
}

/**
 * A GM control: cancel, resetDefenses, resendPrompts or useStances, sent through the coordinator
 * like every other mutation. The expected revision is the live one when this client knows it
 * (the card's flags can lag a step behind the coordinator's memory), else the card's; a stale
 * request is refused visibly by the coordinator, never silently.
 */
async function gmAttackRequest(flags, button, action) {
  const state = flags?.attackWorkflow ?? null;
  const workflowId = button.dataset.workflowId || state?.id;
  if (!workflowId) return;
  const live = AttackCoordinator.get(workflowId);
  // The GM's, or the coordinator's with no GM connected: the same test the card and the
  // coordinator apply, read from the live state since the card's flags can lag a step.
  if (!mayControl(game.user, live ?? state)) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Attack.gmOnly"));
  const expectedRevision = live?.revision ?? state?.revision ?? 0;
  return AttackCoordinator.request(action, { workflowId, expectedRevision, payload: {} });
}
