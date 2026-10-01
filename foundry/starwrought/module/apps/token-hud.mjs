/**
 * The stance toggle on the Token HUD.
 *
 * "The defender chooses one of the two Defenses that answer it, and decides whether to spend an
 * action on a Reaction." The sheet has the chips, but the sheet is a window away; the HUD is a
 * right-click on the token that just had an arrow pointed at it. One button, showing the current
 * answer, cycling to the next one this actor can actually take: Evade, Guard, then Void, Parry and
 * Counter when the Talents behind them are owned. A Reaction stance the actor has not earned is
 * skipped, not offered.
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

  column.prepend(button);
}
