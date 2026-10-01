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
  const flags = message.flags?.[SW.SYSTEM_ID];
  if (!flags) return;

  // Offers meant for one side of the exchange vanish for everyone who cannot act on them.
  for (const el of html.querySelectorAll("[data-owner-uuid]")) {
    const actor = resolveActor(el.dataset.ownerUuid);
    if (actor && !actor.isOwner) el.remove();
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
    button.addEventListener("click", event => onCardButton(event, message, flags));
  }

  // Hide the apply row from players who cannot spend it.
  if (!game.user.isGM && (flags.kind === "damage")) {
    for (const el of html.querySelectorAll(".gm-only")) el.remove();
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
      case "applyDamage": return await applyDamageFromCard(message, flags, button);
      case "flare": return await flareFromCard(message, flags, button);
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

/** The damage card's Apply row. */
async function applyDamageFromCard(message, flags, button) {
  const multiplier = Number(button.dataset.multiplier ?? 1);
  const card = button.closest(".starwrought.damage-card");
  const zone = card?.querySelector("select[name='zone']")?.value ?? SW.DEFAULT_ZONE;

  const targets = resolveTargets(flags.targetUuid);
  if (!targets.length) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));

  for (const actor of targets) {
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
  }
}

/** Which Actors this apply-click should land on. */
function resolveTargets(targetUuid) {
  const controlled = canvas.tokens?.controlled?.map(t => t.actor).filter(a => a?.isOwner) ?? [];
  if (controlled.length) return controlled;
  const targeted = Array.from(game.user.targets).map(t => t.actor).filter(a => a?.isOwner);
  if (targeted.length) return targeted;
  if (targetUuid) {
    const actor = resolveActor(targetUuid);
    if (actor?.isOwner) return [actor];
  }
  return [];
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
    await actor.setExposed(zone, true);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Condition.exposed")}</h3>
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
  const control = button.dataset.mode === "control";
  await defender.formBind(partner, {
    state: control ? "controlling" : "neutral",
    mine: button.dataset.mine ?? "",
    theirs: button.dataset.theirs ?? ""
  });
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
  if (zone && (zone in SW.ZONES)) await partner.setExposed(zone, true);
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
