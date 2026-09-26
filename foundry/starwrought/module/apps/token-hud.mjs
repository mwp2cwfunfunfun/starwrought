/**
 * The stance toggle on the Token HUD.
 *
 * "Before an attack roll is made against them, they can choose a different Defense." The sheet has
 * the switch, but the sheet is a window away; the HUD is a right-click on the token that just had
 * an arrow pointed at it. One button, showing the current answer, flipping to the other.
 */

import { stanceContext } from "../helpers/stance.mjs";

/** Register the HUD injection. */
export function registerStanceHud() {
  Hooks.on("renderTokenHUD", onRenderTokenHud);
}

function onRenderTokenHud(hud, element) {
  const actor = hud.object?.actor;
  if (!actor?.system?.stance || !actor.isOwner) return;
  const column = element.querySelector(".col.right");
  if (!column) return;

  const { current, next } = stanceContext(actor);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon sw-hud-stance";
  button.dataset.stance = current.key;
  button.dataset.tooltip = game.i18n.format("STARWROUGHT.Stance.hudTooltip", {
    current: current.label, threshold: current.threshold, next: next.label
  });
  if (current.unavailable) {
    button.classList.add("unavailable");
    button.dataset.tooltip += " " + game.i18n.format("STARWROUGHT.Stance.unavailableNote", { reason: current.unavailable });
  }
  button.setAttribute("aria-label", button.dataset.tooltip);
  const icon = document.createElement("i");
  icon.className = current.icon;
  icon.inert = true;
  button.append(icon);

  button.addEventListener("click", async event => {
    event.preventDefault();
    await actor.setStance(next.key);
    hud.render();
  });

  column.prepend(button);
}
