/**
 * The stance toggle and the aura ring on the Token HUD.
 *
 * "The defender chooses one of the two Defenses that answer it, and decides whether to spend an
 * action on a Reaction." The sheet has the chips, but the sheet is a window away; the HUD is a
 * right-click on the token that just had an arrow pointed at it. One button, showing the current
 * answer, cycling to the next one this actor can actually take: Evade, Guard, then Void, Parry and
 * Counter when the Talent behind them is owned (and, for Counter, Expert rank in Melee reached;
 * ruling 63). A Reaction stance the actor has not earned is skipped, not offered.
 *
 * Below it, the ring (0.5.1): badged with how many of the actor's ranges are Visible, which is
 * what an encounter pins for everyone. Click opens the palette to choose; right-click switches
 * every ring on this actor off. Owners and the GM see it, on characters and adversaries alike.
 */

import { stanceContext } from "../helpers/stance.mjs";
import { rangesFor } from "../canvas/auras.mjs";
import { SwAuraPalette } from "./aura-palette.mjs";

/** Register the HUD injection. */
export function registerStanceHud() {
  Hooks.on("renderTokenHUD", onRenderTokenHud);
}

function onRenderTokenHud(hud, element) {
  const actor = hud.object?.actor;
  if (!actor?.system || !actor.isOwner) return;
  const column = element.querySelector(".col.right");
  if (!column) return;

  const stance = actor.system.stance ? stanceButton(hud, actor) : null;
  const ring = auraButton(hud, actor);
  // Both above core's own controls: the stance first, the ring beneath it.
  if (stance) column.prepend(stance);
  if (ring) {
    if (stance) stance.after(ring);
    else column.prepend(ring);
  }
}

/* -------------------------------------------- */

/** The stance button: the current answer, cycling to the next this actor can take. */
function stanceButton(hud, actor) {
  const { current, next } = stanceContext(actor);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon sw-hud-stance";
  button.dataset.stance = current.key;
  const currentName = current.reaction ? `${current.label} ${current.cost}` : current.label;
  button.dataset.tooltip = next
    ? game.i18n.format("STARWROUGHT.Stance.hudTooltip", {
        current: currentName, threshold: current.threshold, next: next.label
      })
    : game.i18n.format("STARWROUGHT.Stance.hudTooltipOnly", { current: currentName, threshold: current.threshold });
  if (current.unavailable) {
    button.classList.add("unavailable");
    button.dataset.tooltip += " " + game.i18n.format("STARWROUGHT.Stance.unavailableNote", { reason: current.unavailable });
  }
  // A Head Wound blocks every Reaction, so the HUD only cycles Evade and Guard; say why.
  const noReactions = actor.system.reactions?.blocked;
  if (noReactions) {
    button.dataset.tooltip += " " + ((typeof noReactions === "string") ? game.i18n.localize(noReactions)
      : game.i18n.format("STARWROUGHT.Reaction.blocked", { name: actor.name }));
  }
  if (current.reaction) button.classList.add("reaction");
  button.setAttribute("aria-label", button.dataset.tooltip);
  const icon = document.createElement("i");
  icon.className = current.icon;
  icon.inert = true;
  button.append(icon);

  if (next) {
    button.addEventListener("click", async event => {
      event.preventDefault();
      await actor.setStance(next.key);
      hud.render();
    });
  } else button.disabled = true;

  return button;
}

/* -------------------------------------------- */

/**
 * The ring button: how many ranges are Visible, as a badge. Click opens the palette beside it (a
 * second click closes it); right-click puts every mark on this actor off. Never disabled, since
 * the palette is also where a custom ring is added to an actor that has no ranges yet.
 */
function auraButton(hud, actor) {
  const ranges = rangesFor(actor);
  const visible = ranges.filter(r => r.visible);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon sw-hud-auras";
  if (visible.length) button.classList.add("sw-lit");
  button.dataset.tooltip = visible.length
    ? game.i18n.format("STARWROUGHT.Aura.hudTooltip", { count: visible.length })
    : game.i18n.localize("STARWROUGHT.Aura.hudTooltipNone");
  button.setAttribute("aria-label", button.dataset.tooltip);

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-circle-dot";
  icon.inert = true;
  button.append(icon);
  if (visible.length) {
    const badge = document.createElement("span");
    badge.className = "sw-hud-badge";
    badge.textContent = String(visible.length);
    badge.inert = true;
    button.append(badge);
  }

  button.addEventListener("click", async event => {
    event.preventDefault();
    await SwAuraPalette.open(hud.object, { anchor: button });
  });
  button.addEventListener("contextmenu", async event => {
    event.preventDefault();
    event.stopPropagation();
    const keys = rangesFor(actor).filter(r => r.visible).map(r => r.key);
    if (keys.length) await actor.setAuraVisible(keys, false);
    hud.render();
  });

  return button;
}
