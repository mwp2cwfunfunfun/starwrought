/**
 * The Flare picker (0.7.0): which Constellation did that belong to?
 *
 * The dialog the critical card's Flare button has opened since 0.6.3 (ruling 85; Mike: "the
 * drop-down list should only show Opened Constellations. There should be a toggle, though, to
 * instead show non-Opened Constellations to Flare"), moved out of `flareFromCard` in
 * documents/chat.mjs so the Party Sheet's GM Flare award can open the same one
 * (party-sheet-plan.md, part 1). The list is the character's own Constellations: every sky the
 * data model draws on the sheet, which is one whose Item or Talent the character holds, one
 * already Flared, and a parent whose Combat Styles hold points. A checkbox under the select adds
 * every Constellation that ships (Enabled? = Yes, ruling 61), each marked as not opened, since a
 * Milestone Talent Point spent in a Flared Constellation buys its Root. The box starts ticked
 * when the suggested Constellation is itself unopened, so the preselection can be seen. With
 * `askReason` an optional one-line text field follows, for the GM's award; `SwActor#toggleFlare`
 * prints it on the card. DialogV2's content is static HTML, so the box is wired in the `render`
 * callback, which DialogV2.prompt hands `(event, dialog)`.
 *
 * Nothing is written here. The caller lights the Flare through `SwActor#toggleFlare`, which posts
 * the card (ruling 86), so a Flare is said once whichever button lit it.
 */

import * as SW from "../config.mjs";
import { enabledConstellations } from "../helpers/content.mjs";

/** The reason is one line, for the card: the reroll dialog's own limit. */
const REASON_MAX = 80;

/**
 * Ask which Constellation to Flare.
 * @param {Actor} actor                   The character whose Constellations are listed.
 * @param {object} [options]
 * @param {string} [options.suggested]    The slug preselected: the Constellation that was rolled.
 * @param {boolean} [options.askReason]   Add the optional reason field (the GM's award).
 * @returns {Promise<{slug: string, reason: string}|null>}  The pick, or null when the dialog was
 *   dismissed or nothing was chosen. `reason` is "" unless it was asked for and given.
 */
export async function pickFlare(actor, { suggested = "", askReason = false } = {}) {
  if (!actor) return null;
  const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
  const L = key => game.i18n.localize(key);

  // The sheet's own entries (an owned one that has since been disabled stays listed).
  const opened = new Map(Object.values(actor.system.constellations ?? {}).map(c => [c.slug, c.name]));
  // Everything that ships and is not already there. The Lore template is not itself a sky a
  // character opens or rolls (a Lore is always Lore (X)), as the Relevant Check picker reads it.
  const unopened = new Map();
  for (const meta of enabledConstellations()) {
    if (!meta.slug || opened.has(meta.slug) || SW.isLoreSlug(meta.slug)) continue;
    unopened.set(meta.slug, meta.name);
  }
  const notOpened = L("STARWROUGHT.Flare.notOpened");
  const optionsFor = (showUnopened, selected) => {
    const rows = [...opened.entries()].map(([slug, name]) => ({ slug, name, label: name }));
    if (showUnopened) {
      for (const [slug, name] of unopened) rows.push({ slug, name, label: `${name} ${notOpened}` });
    }
    return rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => `<option value="${esc(r.slug)}"${r.slug === selected ? " selected" : ""}>${esc(r.label)}</option>`)
      .join("");
  };
  const startUnopened = !!suggested && !opened.has(suggested) && unopened.has(suggested);

  // The GM's reason, for the card's "Awarded by the GM" line. Optional, one line.
  const reasonField = askReason
    ? `<div class="form-group sw-flare-reason">
        <label>${esc(L("STARWROUGHT.Flare.reasonLabel"))}</label>
        <input type="text" name="reason" maxlength="${REASON_MAX}" placeholder="${esc(L("STARWROUGHT.Flare.reasonPlaceholder"))}">
      </div>`
    : "";

  const answer = await foundry.applications.api.DialogV2.prompt({
    window: { title: L("STARWROUGHT.Flare.title"), icon: "fa-solid fa-certificate" },
    classes: ["starwrought", "sw-flare-dialog"],
    content: `<p>${L("STARWROUGHT.Flare.prompt")}</p>
      <select name="slug" style="width: 100%">${optionsFor(startUnopened, suggested)}</select>
      <div class="form-group sw-flare-unopened">
        <label class="checkbox"><input type="checkbox" name="showUnopened"${startUnopened ? " checked" : ""}> ${
          L("STARWROUGHT.Flare.showUnopened")}</label>
      </div>${reasonField}`,
    render: (event, dialog) => {
      // v14 hands the DialogV2 instance; an earlier build handed the <dialog> element itself.
      const root = (dialog instanceof HTMLElement) ? dialog : (dialog?.element ?? null);
      const select = root?.querySelector?.("select[name='slug']");
      const box = root?.querySelector?.("input[name='showUnopened']");
      if (!select || !box) return;
      box.addEventListener("change", () => {
        // Keep the pick where it can be kept: an unopened pick falls back to the suggested
        // Constellation when the box is unticked and that one is opened.
        const current = select.value;
        const keep = (box.checked || opened.has(current)) ? current : (opened.has(suggested) ? suggested : "");
        select.innerHTML = optionsFor(box.checked, keep);
      });
    },
    ok: {
      label: L("STARWROUGHT.Flare.button"),
      callback: (event, target) => ({
        slug: String(target.form.elements.slug?.value ?? ""),
        reason: String(target.form.elements.reason?.value ?? "").trim().slice(0, REASON_MAX)
      })
    },
    rejectClose: false
  });
  if (!answer?.slug) return null;
  return { slug: answer.slug, reason: answer.reason ?? "" };
}
