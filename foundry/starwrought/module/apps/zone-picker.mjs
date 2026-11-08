/**
 * One question: which Zone? (0.19.0.) The Controller picks the Zone its Control Exposes on the
 * partner (PHB v4.24, The Bind), from the check card's Take Control button and from the sheet's,
 * so the dialog is written once here rather than in each caller. Returns the Zone key, or null when
 * the dialog is dismissed.
 */

import * as SW from "../config.mjs";

/**
 * @param {object} options
 * @param {string} options.title     The window's title.
 * @param {string} options.text      The question above the select.
 * @param {string} [options.initial] The Zone selected to begin with (SW.DEFAULT_ZONE when absent).
 * @param {string} [options.ok]      The confirm button's label (the Exposed condition's name when absent).
 * @returns {Promise<string|null>}
 */
export async function promptForZone({ title, text, initial = SW.DEFAULT_ZONE, ok = "" } = {}) {
  const options = Object.entries(SW.ZONES)
    .map(([key, z]) => `<option value="${key}"${key === initial ? " selected" : ""}>${game.i18n.localize(z.label)}</option>`)
    .join("");
  const zone = await foundry.applications.api.DialogV2.prompt({
    window: { title, icon: "fa-solid fa-link" },
    classes: ["starwrought"],
    content: `<p>${text}</p><select name="zone" style="width: 100%">${options}</select>`,
    ok: {
      label: ok || game.i18n.localize("STARWROUGHT.Condition.exposed"),
      callback: (event, target) => target.form.elements.zone.value
    },
    rejectClose: false
  });
  return (zone && (zone in SW.ZONES)) ? zone : null;
}
