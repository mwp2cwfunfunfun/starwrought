/**
 * SwActor: naming a Lore (0.18.0). Every Lore (X) is a copy of the one authored Lore template,
 * and the template is never a character's: a Lore point is spent into a named field (Mike,
 * 2026-11-05: "Immediately when getting Trained in Lore... I should be forced to create the
 * Lore"). This is the one writer; the wizard, the createItem hook and the Constellations tab's
 * "Name this Lore" all ask through apps/lore-name.mjs and land here.
 */

import * as SW from "../../config.mjs";

/** @param {typeof Actor} Base */
export const LoreMixin = Base => class extends Base {
  /**
   * Give a Lore its field. The field is trimmed and slugged (`SW.loreSlug`: "Circus" to
   * "lore-circus") and printed back as the Constellation's name (`SW.loreName`: "Lore (Circus)").
   * Refused, with nothing written: a blank field, a field that slugs to the template itself, and
   * a field already open on this character (`STARWROUGHT.Notify.loreTaken`).
   *
   * Then: when the character owns the template Constellation Item (slug `lore`, a leftover the
   * 0.17.0 wizard's auto-spend left, or one just dropped from the pack), it is renamed in place,
   * `system.slug` and `name`, and every Talent filed under the template goes with it, whatever
   * `talentIds` says, since the Item they belong to has moved; a second template Item, should two
   * have landed, is deleted as the duplicate it is. Without one, the named Constellation is a
   * fresh copy of the pack's template (`SwItem.ensureConstellation` with `{ name }`) and the
   * Talents moved are `talentIds` when given, else every Talent filed under the template. One
   * `updateEmbeddedDocuments` carries the rewrite, with `swAnnounced` so the audit says nothing
   * of its own; the sheet redraws the sky from the Items.
   * @param {string} field
   * @param {object} [options]
   * @param {string[]|null} [options.talentIds]  The Talents to move; null means every one under the template.
   * @returns {Promise<{slug: string, name: string}|null>}
   */
  async nameLore(field, { talentIds = null } = {}) {
    const trimmed = String(field ?? "").trim();
    if (!trimmed) return null;
    const slug = SW.loreSlug(trimmed);
    const name = SW.loreName(slug);
    if (slug === SW.LORE_TEMPLATE_SLUG) return null;

    const slugOf = item => item.system.slug || SW.slugify(item.name);
    const open = this.items.find(i => (i.type === "constellation") && (slugOf(i) === slug));
    if (open) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.loreTaken", { name: open.name }));
      return null;
    }

    const templates = this.items.filter(i => (i.type === "constellation") && (slugOf(i) === SW.LORE_TEMPLATE_SLUG));
    const updates = [];
    if (templates.length) updates.push({ _id: templates[0].id, name, "system.slug": slug });
    const moveAll = (talentIds === null) || (templates.length > 0);
    for (const item of this.items) {
      if ((item.type !== "talent") || (item.system.constellation !== SW.LORE_TEMPLATE_SLUG)) continue;
      if (!moveAll && !talentIds.includes(item.id)) continue;
      updates.push({ _id: item.id, "system.constellation": slug, "system.constellationName": name });
    }
    if (updates.length) await this.updateEmbeddedDocuments("Item", updates, { swAnnounced: true });

    const duplicates = templates.slice(1).map(t => t.id);
    if (duplicates.length) await this.deleteEmbeddedDocuments("Item", duplicates, { swAuto: true });

    if (!templates.length) {
      const { SwItem } = await import("../item.mjs");
      await SwItem.ensureConstellation(this, slug, { name });
    }
    return { slug, name };
  }
};
