/**
 * SwActor: the two points a player spends by hand. A Hero Point (0.5.1, T9) and a Deferred Talent
 * Point (0.7.0, ruling 94); each is a write on the character and one card.
 */



/** @param {typeof Actor} Base */
export const PointsMixin = Base => class extends Base {
  /**
   * Spend one Hero Point, and say so. Players cannot add Hero Points (the GM awards them, with the
   * stepper the GM's sheet keeps), so the player's header carries one button, this, and every
   * press is a public card: "Hrolda spends a Hero Point (2 left)." Refuse Death keeps its own
   * path and takes every point at once. The update is marked for the audit (module/documents/
   * audit.mjs), which would otherwise announce the same change a second time.
   * @returns {Promise<number|null>} the points left, or null when there was nothing to spend
   */
  async spendHeroPoint() {
    const have = Number(this.system.heroPoints?.value) || 0;
    if (have <= 0) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noHeroPoints"));
      return null;
    }
    const left = have - 1;
    await this.update({ "system.heroPoints.value": left }, { swAnnounced: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-hero-card" data-actor-uuid="${this.uuid}">
        <h3><i class="fa-solid fa-star"></i> ${game.i18n.localize("STARWROUGHT.HeroPoints.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.HeroPoints.spent", { name: foundry.utils.escapeHTML(this.name), left })}</p></div>`
    });
    return left;
  }

  /**
   * Spend one Deferred Talent Point, and say so (party-sheet-plan.md, part 3; ruling 94). The
   * count is a reminder with a number on it: the Party Sheet's Milestone award adds one when a
   * member has no Flared Constellation to receive the point (PHB v4.15, Table 4), and this takes
   * one off when the player spends it, which is a Talent bought or dragged as today and policed by
   * nothing. The header's Deferred badge and the party's roster both come here, so the one-line
   * card ("{name} spends a Deferred Talent Point.") is said once from either; the update is marked
   * for the audit, since the card is the announcement. Spending one that is not held writes
   * nothing and says so in a notice.
   * @returns {Promise<number|null>} the points still held, or null when there was nothing to spend
   */
  async spendDeferred() {
    const have = Number(this.system.deferred) || 0;
    if (have <= 0) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Deferred.none"));
      return null;
    }
    const left = have - 1;
    await this.update({ "system.deferred": left }, { swAnnounced: true });
    const key = left > 0 ? "STARWROUGHT.Deferred.spentLeft" : "STARWROUGHT.Deferred.spent";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-deferred-card" data-actor-uuid="${this.uuid}">
        <p><i class="fa-solid fa-hourglass-end"></i> ${game.i18n.format(key, { name: foundry.utils.escapeHTML(this.name), left })}</p></div>`
    });
    return left;
  }
};
