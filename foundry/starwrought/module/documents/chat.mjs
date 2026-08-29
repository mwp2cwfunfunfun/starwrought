/**
 * Chat card behaviour: the buttons that carry an attack through to damage, and damage through to
 * a body. Everything here reads its state from the message's own flags, so a card still works
 * after a reload.
 */

import * as SW from "../config.mjs";
import { SwDamage } from "../dice/damage.mjs";

/** Wire up a rendered chat card. */
export function onRenderChatMessage(message, html) {
  const flags = message.flags?.[SW.SYSTEM_ID];
  if (!flags) return;

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
      case "expose": return await exposeFromCard(button);
      case "recenter": return await recenterFromCard(button);
      default: return;
    }
  } finally {
    button.disabled = false;
  }
}

/* -------------------------------------------- */

/** The attack card's Damage / Graze / Critical buttons. */
async function rollDamageFromCard(message, flags, outcome) {
  const actor = await fromUuid(flags.actorUuid);
  const doc = actor?.actor ?? actor;
  if (!doc) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
  if (!doc.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
  const weapon = doc.items.get(flags.weaponId);
  if (!weapon) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noWeapon"));
  return SwDamage.roll({ actor: doc, weapon, outcome, targetUuid: flags.targetUuid ?? "" });
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
      armorPiercing: flags.armorPiercing,
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
    const doc = fromUuidSync(targetUuid);
    const actor = doc?.actor ?? doc;
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
    zoneLabel: game.i18n.localize(SW.ZONES[result.zone]?.label ?? ""),
    exposed: result.exposed ? game.i18n.localize(SW.ZONES[result.exposed].label) : null
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
 * Bonus. Kessa's crit came off a Great Weapon Fighting talent, but the roll itself was Weapons.
 * So the button asks, defaulting to the Constellation that was rolled.
 */
async function flareFromCard(message, flags, button) {
  const doc = await fromUuid(flags.actorUuid);
  const actor = doc?.actor ?? doc;
  if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));

  const suggested = button.dataset.slug || "";
  const owned = Object.values(actor.system.constellations ?? {});
  const choices = new Map(owned.map(c => [c.slug, c.name]));
  for (const meta of Object.values(SW.constellations)) {
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

/** Open a Zone from a card: the Graze Cost, paid by the defender. */
async function exposeFromCard(button) {
  const zone = button.dataset.zone;
  const targets = resolveTargets(button.dataset.targetUuid);
  for (const actor of targets) await actor.setExposed(zone, true);
}

/** Recenter from a card. */
async function recenterFromCard(button) {
  const targets = resolveTargets(button.dataset.targetUuid);
  for (const actor of targets) await actor.recenter();
}
