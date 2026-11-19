/**
 * The GM's one window for an adversary's Maneuver with a check (0.34.0; rulings 338 and 341).
 *
 * A Maneuver's `[CHECK ...]` block may name a choice on either side of `vs`: the user's on the
 * left, the target's on the right. For a character each side is its own player's (the picker on
 * the sheet, the request card in chat). For an adversary the GM is the player, and when its
 * Maneuver is aimed at another adversary the GM is both, so the two choices are asked together
 * here, before the GM's roll: which Constellation the adversary rolls with (each with its number
 * in effect), and which Defense the target answers with.
 *
 * NO DEFENSE IS EVER CHOSEN BY THE SYSTEM (ruling 159): the Defense opens on nothing, and the
 * window is asked again until one is picked or it is closed.
 */

import * as SW from "../config.mjs";
import { enabledConstellations } from "../helpers/content.mjs";

const { DialogV2 } = foundry.applications.api;

const esc = text => foundry.utils.escapeHTML(String(text ?? ""));

/** The Constellations an adversary has a number for: every Skill that ships, then Melee and Ranged. */
export function adversaryConstellations() {
  const skills = enabledConstellations()
    .filter(c => c.slug && (c.category === "skill") && !SW.isLoreSlug(c.slug))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ slug: c.slug, name: c.name }));
  const martial = [SW.MELEE_SLUG, SW.RANGED_SLUG].map(slug => ({ slug, name: SW.getConstellation(slug)?.name ?? slug }));
  return [...skills, ...martial];
}

/**
 * Ask the GM what an adversary's Maneuver rolls and, against another adversary, which Defense
 * answers it.
 * @param {Actor} actor  The adversary using the Maneuver.
 * @param {object} ask
 * @param {string} ask.name                    The Maneuver.
 * @param {Array<{slug: string, name: string}>|null} [ask.rolls]  The Constellations to choose
 *   from; null for a Relevant Check (every Skill, Melee and Ranged); undefined when not asked.
 * @param {string[]} [ask.defenses]            The Defenses the target can answer with; undefined
 *   when not asked.
 * @param {string} [ask.targetName]
 * @returns {Promise<{rolled: {slug: string, name: string}|null, defense: string|null}|null>}
 *   Null when the window was closed.
 */
export async function pickAdversaryCheck(actor, { name = "", rolls, defenses, targetName = "" } = {}) {
  const askRoll = rolls !== undefined;
  const askDefense = Array.isArray(defenses) && (defenses.length > 0);
  if (!askRoll && !askDefense) return { rolled: null, defense: null };
  const offered = askRoll ? (Array.isArray(rolls) ? rolls : adversaryConstellations()) : [];
  const rows = offered.map(roll => ({
    slug: roll.slug,
    name: roll.name || SW.getConstellation(roll.slug)?.name || roll.slug,
    number: actor.system?.checkNumber?.(roll.slug)?.threshold ?? 10
  })).sort((a, b) => (b.number - a.number) || a.name.localeCompare(b.name));

  const rollField = askRoll ? `<div class="form-group">
      <label>${esc(game.i18n.localize("STARWROUGHT.CheckPicker.rollsWith"))}</label>
      <div class="form-fields"><select name="slug" autofocus>
        ${rows.map(r => `<option value="${esc(r.slug)}">${esc(r.name)} · ${r.number}</option>`).join("")}
      </select></div></div>` : "";
  const defenseField = askDefense ? `<div class="form-group">
      <label>${esc(game.i18n.format("STARWROUGHT.CheckPicker.answersWith", { target: targetName }))}</label>
      <div class="form-fields"><select name="defense">
        <option value="" selected>${esc(game.i18n.localize("STARWROUGHT.CheckPicker.choose"))}</option>
        ${defenses.map(key => `<option value="${esc(key)}">${esc(game.i18n.localize(SW.DEFENSES[key]?.label ?? key))}</option>`).join("")}
      </select></div></div>` : "";
  const content = `<div class="check-dialog-form sw-relevant">
    <p class="sw-relevant-intro">${esc(game.i18n.format("STARWROUGHT.CheckPicker.intro", { actor: actor.name, name }))}</p>
    ${rollField}${defenseField}</div>`;

  for (;;) {
    const answer = await DialogV2.wait({
      window: { title: game.i18n.format("STARWROUGHT.CheckPicker.title", { name }), icon: "fa-solid fa-scale-balanced" },
      classes: ["starwrought", "check-dialog"],
      position: { width: 420 },
      content,
      buttons: [
        { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel")) return null;
    const chosen = askRoll ? rows.find(r => r.slug === answer.slug) : null;
    if (askRoll && !chosen) return null;
    const defense = askDefense ? String(answer.defense ?? "") : "";
    if (askDefense && !defenses.includes(defense)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.CheckPicker.needDefense"));
      continue;
    }
    return { rolled: chosen ? { slug: chosen.slug, name: chosen.name } : null, defense: defense || null };
  }
}
