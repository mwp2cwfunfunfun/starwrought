/**
 * One question: how many actions? (0.23.0, ruling 233.) A Maneuver whose cost is a range (Leap ❶ to
 * ❸, Trip ❶ to ❷, Reload ⓿ to ❻) is a decision the player makes each time it is used in an
 * encounter, so the system asks and never picks: one button per number the row may be paid at
 * (`SW.actionCostOptions`). A number of three or more says it will be Prepared, since that is what
 * pressing it does (PHB v4.24: two actions now, the rest reserved). Returns the number, or null when
 * the dialog is dismissed, and then nothing happens at all: no charge, no gate, no card.
 */

import * as SW from "../config.mjs";

/**
 * @param {object} options
 * @param {string} options.name       The Maneuver's plain name, for the title and the question.
 * @param {number[]} options.options  The numbers of actions it may be paid at, ascending.
 * @returns {Promise<number|null>}
 */
export async function pickCost({ name = "", options = [] } = {}) {
  const costs = options.filter(n => Number.isInteger(n) && (n >= 0));
  if (!costs.length) return null;
  if (costs.length === 1) return costs[0];
  const prepares = costs.some(n => n >= SW.PREPARED_THRESHOLD);
  const buttons = costs.map((n, index) => ({
    action: `cost${n}`,
    label: (n >= SW.PREPARED_THRESHOLD)
      ? game.i18n.format("STARWROUGHT.Cost.prepareButton", { glyph: SW.ACTION_GLYPHS[n] ?? String(n) })
      : (SW.ACTION_GLYPHS[n] ?? String(n)),
    default: index === 0,
    callback: () => n
  }));
  const safe = foundry.utils.escapeHTML(name);
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("STARWROUGHT.Cost.title", { name }), icon: "fa-solid fa-hourglass-half" },
    classes: ["starwrought", "sw-cost-picker"],
    content: `<p>${game.i18n.format("STARWROUGHT.Cost.text", { name: safe })}</p>${
      prepares ? `<p class="sw-note">${game.i18n.format("STARWROUGHT.Cost.prepareHint", { spend: SW.PREPARE_SPEND })}</p>` : ""}`,
    buttons,
    rejectClose: false
  });
  return costs.includes(picked) ? picked : null;
}
