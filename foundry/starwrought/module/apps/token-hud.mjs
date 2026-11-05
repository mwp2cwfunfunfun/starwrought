/**
 * The action counter, the stance toggle and the aura ring on the Token HUD.
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
 *
 * Above both, in an encounter, the action counter (0.10.1; Mike: "show a small action counter in
 * the Token HUD, such as 4/6, rather than a full token bar"): the actions free to spend now over
 * the round's count, with the sheet's three-state pips beneath (`actionPips`, the one computation
 * the sheet and the tracker share), a readout and not a button, re-rendered while the HUD is open
 * as the actor spends.
 */

import * as SW from "../config.mjs";
import { stanceContext } from "../helpers/stance.mjs";
import { actionPips } from "../helpers/actor-context.mjs";
import { rangesFor } from "../canvas/auras.mjs";
import { SwAuraPalette } from "./aura-palette.mjs";

/** Register the HUD injection, and the re-render that keeps its counter live. */
export function registerStanceHud() {
  Hooks.on("renderTokenHUD", onRenderTokenHud);
  Hooks.on("updateActor", onActorChanged);
}

function onRenderTokenHud(hud, element) {
  const actor = hud.object?.actor;
  if (!actor?.system || !actor.isOwner) return;
  const column = element.querySelector(".col.right");
  if (!column) return;

  const counter = actionsCounter(actor);
  const stance = actor.system.stance ? stanceButton(hud, actor) : null;
  const ring = auraButton(hud, actor);
  // All above core's own controls: the counter first, the stance, the ring beneath it.
  column.prepend(...[counter, stance, ring].filter(Boolean));
}

/** The counter is live: the open HUD's actor spending re-renders it, as the tracker row does. */
function onActorChanged(actor, changes) {
  const hud = canvas.tokens?.hud;
  if (!hud?.rendered || (hud.object?.actor !== actor)) return;
  if (!foundry.utils.hasProperty(changes, "system.actions")) return;
  hud.render();
}

/* -------------------------------------------- */

/**
 * The action counter: "4/6" and a pip per action in the sheet's three states (free, reserved for
 * a Prepared Maneuver, spent), the legend as its tooltip. Only in an encounter, since nothing is
 * counted outside one; null otherwise. The number is the free count, what the player can act on.
 */
function actionsCounter(actor) {
  if (!actor.inEncounter || !actor.system.actions) return null;
  const { perRound, free, states, legend } = actionPips(actor);
  const box = document.createElement("div");
  box.className = "control-icon sw-hud-actions";
  if (!free) box.classList.add("sw-none");
  box.dataset.tooltip = `${game.i18n.format("STARWROUGHT.Tracker.actionsLeft", { value: free, per: perRound })} ${legend}`;
  box.setAttribute("aria-label", box.dataset.tooltip);

  const count = document.createElement("span");
  count.className = "sw-hud-actions-count";
  count.textContent = `${free}/${perRound}`;
  const pips = document.createElement("span");
  pips.className = "sw-hud-pips";
  for (const state of states.slice(0, SW.ACTIONS_MAX)) {
    const pip = document.createElement("i");
    pip.className = `sw-hud-pip sw-${state}`;
    pips.append(pip);
  }
  box.append(count, pips);
  return box;
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
