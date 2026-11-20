/**
 * One question: how many actions? (0.23.0, ruling 233.) A Maneuver whose cost is a range (Leap ❶ to
 * ❸, Trip ❶ to ❷, Reload ⓿ to ❻) is a decision the player makes each time it is used in an
 * encounter, so the system asks and never picks: one button per number the row may be paid at
 * (`SW.actionCostOptions`). A number of three or more says it will be Prepared, since that is what
 * pressing it does (PHB v4.24: two actions now, the rest reserved). Returns the number, or null when
 * the dialog is dismissed, and then nothing happens at all: no charge, no gate, no card.
 *
 * A RAISED COST (0.37.0; Heedless: a Concentrate Maneuver takes 1 extra action): each button says
 * the version and what it will cost ("❶ for ❷"), "Prepare" goes by what is paid, a line says why,
 * and the answer is still the VERSION: the caller adds the raise, and the row's `IF: COST(<n>)`
 * lines read the version.
 */

import * as SW from "../config.mjs";

/**
 * @param {object} options
 * @param {string} options.name       The Maneuver's plain name, for the title and the question.
 * @param {number[]} options.options  The numbers of actions it may be paid at, ascending.
 * @param {number} [options.extra]    What a Condition adds to each (0.37.0); 0 for none.
 * @param {string} [options.why]      Why: "Heedless: Concentrate takes 1 extra action".
 * @returns {Promise<number|null>}    The version chosen, never the raised price.
 */
export async function pickCost({ name = "", options = [], extra = 0, why = "" } = {}) {
  const costs = options.filter(n => Number.isInteger(n) && (n >= 0));
  if (!costs.length) return null;
  if (costs.length === 1) return costs[0];
  const more = Math.max(0, Math.floor(Number(extra) || 0));
  const glyph = n => SW.ACTION_GLYPHS[n] ?? String(n);
  const prepares = costs.some(n => (n + more) >= SW.PREPARED_THRESHOLD);
  const buttons = costs.map((n, index) => {
    const pays = n + more;
    // What is pressed is the version; what it costs is beside it when a Condition raised it.
    const shown = more ? game.i18n.format("STARWROUGHT.Cost.raisedButton", { glyph: glyph(n), pays: glyph(pays) }) : glyph(n);
    return {
      action: `cost${n}`,
      label: (pays >= SW.PREPARED_THRESHOLD) ? game.i18n.format("STARWROUGHT.Cost.prepareButton", { glyph: shown }) : shown,
      default: index === 0,
      callback: () => n
    };
  });
  const esc = foundry.utils.escapeHTML;
  const safe = esc(name);
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("STARWROUGHT.Cost.title", { name }), icon: "fa-solid fa-hourglass-half" },
    classes: ["starwrought", "sw-cost-picker"],
    content: `<p>${game.i18n.format("STARWROUGHT.Cost.text", { name: safe })}</p>${
      more ? `<p class="sw-note">${esc(game.i18n.format("STARWROUGHT.Cost.raised", { reason: why || `+${more}` }))}</p>` : ""}${
      prepares ? `<p class="sw-note">${game.i18n.format("STARWROUGHT.Cost.prepareHint", { spend: SW.PREPARE_SPEND })}</p>` : ""}`,
    buttons,
    rejectClose: false
  });
  return costs.includes(picked) ? picked : null;
}
