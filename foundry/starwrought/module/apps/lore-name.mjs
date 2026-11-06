/**
 * Naming a Lore (0.18.0). Mike, 2026-11-05: "Immediately when getting Trained in Lore... I should
 * be forced to create the Lore. For example Lore (Circus) or Lore (Warfare)."
 *
 * Every Lore (X) is a copy of the one authored Lore template, and the template itself is never a
 * character's: a Lore point is spent into a named field. This is the one question, asked from the
 * wizard (a Background's bare "Lore", a `[Lore trained]` grant), from the createItem hook (a Deep
 * Knowledge or the template Constellation dropped on a sheet) and from the Constellations tab's
 * "Name this Lore" on a leftover template; `SwActor#nameLore` (documents/actor/lore.mjs) is the
 * one writer. Through 0.17.0 the prompt was the wizard's own and only its buy button asked it.
 */

import * as SW from "../config.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * The Lores a character has open, named, for the prompt's hint and the "already have" refusal.
 * @param {Actor} actor
 * @returns {string[]}
 */
export function openLores(actor) {
  return Object.values(actor?.system?.constellations ?? {})
    .filter(e => SW.isLoreSlug(e.slug) && (e.slug !== SW.LORE_TEMPLATE_SLUG))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Ask which field of Lore this is. The answer is the field alone ("Circus"); `SW.loreSlug` and
 * `SW.loreName` make the slug and the printed name from it. Null on Cancel or a blank answer.
 * @param {object} [options]
 * @param {string[]} [options.taken]  Fields already open on the character, listed in the hint.
 * @returns {Promise<string|null>}
 */
export async function promptForLoreField({ taken = [] } = {}) {
  const have = taken.length
    ? `<p class="sw-note">${game.i18n.format("STARWROUGHT.Chargen.loreOpen", { list: taken.join(", ") })}</p>`
    : "";
  const field = await DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Chargen.loreTitle"), icon: "fa-solid fa-book-open" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.localize("STARWROUGHT.Chargen.lorePrompt")}</p>${have}
      <input type="text" name="field" autofocus placeholder="${game.i18n.localize("STARWROUGHT.Chargen.lorePlaceholder")}">`,
    ok: { callback: (event, target) => target.form.elements.field.value.trim() },
    rejectClose: false
  });
  return field || null;
}

/**
 * Ask for a field until the answer names a Lore the character does not have, or the player
 * cancels. A field already open is refused with `STARWROUGHT.Notify.loreTaken` and the prompt
 * reopens, so a slip of the keyboard never silently merges two Lores.
 * @param {Actor} actor
 * @returns {Promise<{field: string, slug: string, name: string}|null>}
 */
export async function promptForNewLore(actor) {
  for (;;) {
    const field = await promptForLoreField({ taken: openLores(actor) });
    if (!field) return null;
    const slug = SW.loreSlug(field);
    const name = SW.loreName(slug);
    if (slug === SW.LORE_TEMPLATE_SLUG) continue;
    const open = actor.items.find(i => (i.type === "constellation") && ((i.system.slug || SW.slugify(i.name)) === slug));
    if (open) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.loreTaken", { name: open.name }));
      continue;
    }
    return { field, slug, name };
  }
}

/**
 * Prompt, then name: the whole exchange for the hook and the sheet. `talentIds` is handed to
 * `nameLore` as given.
 * @param {Actor} actor
 * @param {object} [options]
 * @param {string[]|null} [options.talentIds]
 * @returns {Promise<{slug: string, name: string}|null>}
 */
export async function askToNameLore(actor, { talentIds = null } = {}) {
  const picked = await promptForNewLore(actor);
  if (!picked) return null;
  return actor.nameLore(picked.field, { talentIds });
}
