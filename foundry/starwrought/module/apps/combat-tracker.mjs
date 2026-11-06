/**
 * The combat tracker's additions: under each combatant's name the actions it has left, beside its
 * controls a Pass button live at its own Opportunity, beside the round the pass streak. Injected
 * into core's rows on `renderCombatTracker` rather than replacing the template, so a Foundry update
 * that reshapes the tracker is a one-line fix. The readout is live: an actor whose `system.actions`
 * changes re-renders the tracker. Registered by `starwrought.mjs` at init (`registerTrackerReadout`),
 * not by `registerCombatTracking`, because this module imports `SwCombat` from documents/combat.mjs,
 * where the readout lived through 0.10.0. The styles are hud.css.
 */

import * as SW from "../config.mjs";
import { SwCombat } from "../documents/combat.mjs";
import { actionPips } from "../helpers/actor-context.mjs";
// CHARACTER EFFECTS (0.16.0): the badge beside the actions readout.
import { effectsBadge } from "../helpers/effects.mjs";

const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

let registered = false;

/** Register the tracker hooks. Idempotent. */
export function registerTrackerReadout() {
  if (registered) return;
  registered = true;
  Hooks.on("renderCombatTracker", onRenderTracker);
  Hooks.on("updateActor", onActorChanged);
  // The effects badge (0.16.0) follows the Items that carry the lines.
  for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, onItemChanged);
}

/* -------------------------------------------- */

/**
 * Under each combatant's name, the actions it has left (and anything reserved for a Prepared
 * Maneuver); beside its controls, a Pass button for its owner, live only at its own Opportunity;
 * beside the round, the pass streak. Injected into core's rows rather than replacing its template,
 * as the targeting line is, so a Foundry update that reshapes the tracker is a one-line fix.
 */
function onRenderTracker(app, element) {
  const combat = app.viewed ?? game.combat;
  if (!(combat instanceof SwCombat)) return;

  if (combat.started) {
    const title = element.querySelector(".encounter-title");
    if (title) {
      // A partial re-render of the rows leaves the header standing, so replace rather than skip.
      title.querySelector(".sw-pass-streak")?.remove();
      const span = document.createElement("span");
      span.className = "sw-pass-streak";
      span.dataset.tooltip = localize("STARWROUGHT.Tracker.passStreakHint");
      span.textContent = format("STARWROUGHT.Tracker.passStreak", {
        n: combat.passStreak, of: combat.opportunityHolders.length
      });
      title.append(" ", span);
    }
  }

  for (const li of element.querySelectorAll("li.combatant[data-combatant-id]")) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    const actor = combatant?.actor;
    if (!actor?.system) continue;
    // A party is never a combatant (0.7.0, risk 1): no actions readout, no Pass button.
    if (actor.type === SW.PARTY_TYPE) continue;

    const actions = actor.system.actions;
    if (actions && combat.started && !li.querySelector(".sw-tracker-actions")) {
      li.querySelector(".token-name")?.append(actionsReadout(actor, actions));
    }
    // CHARACTER EFFECTS (0.16.0): the count of live effect lines, the lines in the tooltip, on
    // the actions line when there is one (beside the pips), else under the name.
    if (!li.querySelector(".sw-tracker-effects")) {
      const badge = effectsReadout(actor);
      if (badge) (li.querySelector(".sw-tracker-actions") ?? li.querySelector(".token-name"))?.append(badge);
    }

    if (combatant.isOwner && combat.started && !li.querySelector(".sw-pass")) {
      const controls = li.querySelector(".combatant-controls");
      if (!controls) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inline-control combatant-control icon fa-solid fa-hand sw-pass";
      const live = combat.combatant?.id === combatant.id;
      button.disabled = !live;
      button.dataset.tooltip = live
        ? localize("STARWROUGHT.Tracker.pass")
        : format("STARWROUGHT.Combat.notOpportunity", { name: combatant.name });
      button.setAttribute("aria-label", localize("STARWROUGHT.Tracker.pass"));
      // No data-action: the row itself is core's "activate this combatant" control, and the click
      // must not reach it.
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        onPassClick(combat, combatant);
      });
      const effects = controls.querySelector(".token-effects");
      if (effects) controls.insertBefore(button, effects);
      else controls.append(button);
    }
  }
}

/**
 * The line under the name: the actions free to spend now as a large number over the round's
 * count, with a pip per action in one of three states (free, reserved for a Prepared Maneuver,
 * spent; `actionPips`, the sheet's own computation, so the two readouts agree at a glance), plus
 * the reserved count and an hourglass while Preparing. It was one small circled glyph until 0.5.3
 * (Mike: "# actions remaining in combat tracker are very small/hard to read"); through 0.10.0 a
 * reserved pip looked spent here (Mike, 2026-11-04: "take Reserved actions into account"). The
 * big number stays the free count, what a player can act on; the pips and the tooltip's legend
 * carry the reserve.
 */
function actionsReadout(actor, actions) {
  const line = document.createElement("div");
  line.className = "sw-tracker-actions";
  const { perRound: per, free: value, reserved, states, legend } = actionPips(actor);
  line.dataset.tooltip = `${format("STARWROUGHT.Tracker.actionsLeft", { value, per })} ${legend}`;
  if (!value) line.classList.add("sw-none");

  const count = document.createElement("span");
  count.className = "sw-tracker-actions-left";
  count.textContent = String(value);
  const of = document.createElement("span");
  of.className = "sw-tracker-actions-of";
  of.textContent = `/${per}`;
  count.append(of);
  line.append(count);

  const pips = document.createElement("span");
  pips.className = "sw-tracker-pips";
  for (const state of states.slice(0, SW.ACTIONS_MAX)) {
    const pip = document.createElement("i");
    pip.className = `sw-tracker-pip sw-${state}`;
    pips.append(pip);
  }
  line.append(pips);

  if (reserved) {
    const held = document.createElement("span");
    held.className = "sw-tracker-actions-reserved";
    held.textContent = format("STARWROUGHT.Tracker.reserved", { n: reserved });
    line.append(" ", held);
  }
  if (actions.preparing) {
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-hourglass-half sw-tracker-preparing";
    icon.dataset.tooltip = format("STARWROUGHT.Tracker.preparing", {
      label: actions.preparing.label || localize("STARWROUGHT.Condition.preparing")
    });
    line.append(" ", icon);
  }
  return line;
}

/**
 * The effects badge (0.16.0; the sheet's Effects panel count, `effectsBadge` in helpers/effects.mjs):
 * a small wand with the number of effect lines live on the actor (a Talent's rule not switched Off,
 * a custom effect), and every line in the tooltip, so the GM reads what a combatant carries without
 * opening the sheet. Nothing when there is none.
 */
function effectsReadout(actor) {
  const badge = effectsBadge(actor);
  if (!badge) return null;
  const span = document.createElement("span");
  span.className = "sw-tracker-effects";
  const title = badge.count === 1 ? localize("STARWROUGHT.Effects.badgeOne") : format("STARWROUGHT.Effects.badge", { n: badge.count });
  const escape = foundry.utils.escapeHTML;
  // The tooltip is HTML (the Wind tooltip's precedent): one line per effect.
  span.dataset.tooltip = `<strong>${escape(title)}</strong><br>${badge.lines.map(l => escape(l)).join("<br>")}`;
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-wand-sparkles";
  span.append(icon, ` ${badge.count}`);
  return span;
}

/** The tracker's Pass: the Actor's own Pass when it has one (it may have things to tidy), else the Combat's. */
async function onPassClick(combat, combatant) {
  const actor = combatant.actor;
  try {
    if (typeof actor?.pass === "function") return await actor.pass();
    return await combat.pass(combatant);
  } catch (err) {
    console.error("STARWROUGHT | Pass failed", err);
    ui.notifications.error(localize("STARWROUGHT.Combat.passFailed"));
  }
}

/** The pending redraw, or null: one timer collects a burst of changes into one render (0.18.1). */
let renderTimer = null;

/**
 * Redraw the tracker once a burst settles, on a short timer as the party sheet does (never a
 * requestAnimationFrame latch): six Defense rolls against an aura, or a Sync content refresh of
 * every copy, render it once rather than once per write.
 */
function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    if (game.combat?.isView) ui.combat?.render();
  }, 50);
}

/** The readout is live: an actor spending actions re-renders its row. */
function onActorChanged(actor, changes) {
  const combat = game.combat;
  if (!combat?.isView) return;
  // The actions readout in a started encounter; the effects badge (0.16.0) whenever a line's
  // state or a custom effect changes. The rules' other flags (a FIRST/ONCE mark, an armed claim, a
  // Talent's mark) draw nothing on the tracker and do not re-render it (0.18.1).
  const actions = combat.started && foundry.utils.hasProperty(changes, "system.actions");
  const effects = foundry.utils.hasProperty(changes, "system.effects") || foundry.utils.hasProperty(changes, "flags.starwrought.rules.state");
  if (!actions && !effects) return;
  if (combat.getCombatantsByActor(actor).length) scheduleRender();
}

/**
 * An Item that may carry rules came, went or changed on a combatant: the effects badge follows
 * (0.16.0). The three hooks pass different second arguments, so nothing finer than the type is read.
 */
function onItemChanged(item) {
  const actor = item?.parent;
  const combat = game.combat;
  if (!actor || !combat?.isView || !["talent", "action", "constellation"].includes(item.type)) return;
  if (combat.getCombatantsByActor(actor).length) scheduleRender();
}
