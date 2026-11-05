/**
 * SwActor: Flares. Lighting or putting out a Constellation's Flare and saying so once, from
 * whichever button did it (ruling 86), with the GM's reason, the training line (ruling 113) and the
 * Comet reminder (ruling 94; PHB v4.21's name, ruling 145); and the lit set.
 */

import * as SW from "../../config.mjs";

/** @param {typeof Actor} Base */
export const FlaresMixin = Base => class extends Base {
  /**
   * A Constellation is Flared or it is not: a checkbox, not a count. It stays Flared until you
   * spend into it.
   *
   * The card is posted here, so a Flare is said once from every entry point (0.6.3, ruling 86;
   * Mike: the sheet's Flare button "doesn't send that to chat, like changing other things does").
   * Lit, it is the Flare card the chat button used to post itself; put out, a one-line card. The
   * audit stays out of it: Flares are an object, not a watched field, and the card is the
   * announcement. Putting out a Flare that was never lit writes nothing and says nothing.
   *
   * A reason (0.7.0, party-sheet-plan.md part 1: the Party Sheet's GM Flare award asks for one
   * through the shared picker) is printed on the lit card as its own line, "Awarded by the GM:
   * <reason>"; the put-out card never carries it.
   *
   * `trained` (0.7.5, party-sheet-plan.md part 10, ruling 113) is the Downtime panel's Train: the
   * card's second line reads "Flared by seven days' training." in place of the GM's award line
   * (both print when both are given, since a GM may Train a member with a reason of their own),
   * and the card carries the once-between-Milestones warning when the character's `trainedAt`
   * flag still matches their level and Milestone count, read before `train` in helpers/party.mjs
   * writes the new record. Lighting a Constellation that is already lit writes nothing (the
   * update would be an empty diff anyway) and still posts the card, as it always has, now with a
   * line saying the Constellation was already Flared, so a second Train or a GM's award on a lit
   * sky is said honestly rather than as a fresh Flare.
   * @param {string} slug
   * @param {boolean} [state]
   * @param {object} [options]
   * @param {string} [options.reason]    Why the GM lit it, for the card. Blank prints nothing.
   * @param {boolean} [options.trained]  Lit by seven days' training (the Downtime panel's Train).
   */
  async toggleFlare(slug, state, { reason = "", trained = false } = {}) {
    const lit = !!this.system.flares?.[slug];
    const next = state ?? !lit;
    if (!next && !lit) return this;
    // An update merges objects, so putting a Flare out takes the deletion key rather than a
    // clone with the property removed. Lighting a lit Flare has nothing to write.
    if (next !== lit) {
      await this.update(next
        ? { [`system.flares.${slug}`]: true }
        : { [`system.flares.-=${slug}`]: null });
    }
    await this.#announceFlare(slug, next, { reason, trained, already: next && lit });
    return this;
  }

  /**
   * The Flare card: lit (the title, the Milestone line, the training line when Train lit it with
   * its warning when Train was already used since the last Milestone, a line when the
   * Constellation was already lit, the GM's reason when one was given, and the Comet reminder
   * while the character holds one: a Comet spends in any Constellation, this one included, so a
   * Flare is a fine moment to remember it, ruling 94) or put out (one line).
   */
  async #announceFlare(slug, lit, { reason = "", trained = false, already = false } = {}) {
    const name = this.system.constellations?.[slug]?.name ?? SW.getConstellation(slug)?.name ?? slug;
    if (!lit) {
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-flare-card sw-flare-out">
        <p><i class="fa-solid fa-certificate"></i> ${game.i18n.format("STARWROUGHT.Flare.putOut", { name })}</p></div>`
      });
    }
    const lines = [`<p>${game.i18n.format("STARWROUGHT.Flare.message", { name })}</p>`];
    if (trained) {
      lines.push(`<p class="sw-card-note sw-flare-trained">${game.i18n.localize("STARWROUGHT.Flare.trained")}</p>`);
      // The once-between-Milestones warning (ruling 113; decision 14: warn, never refuse). The
      // record is the flag `train` writes AFTER this card, so what is read here is the previous
      // training; it matches while the level and the Milestone count are the ones it was written
      // at, and the next Milestone award makes it stale by comparison. The same comparison, for
      // the panel's amber mark, is `trainUsed` in helpers/party.mjs.
      const at = this.getFlag(SW.SYSTEM_ID, SW.TRAINED_AT_FLAG);
      const used = !!at
        && (Number(at.level) === (Number(this.system.level) || 0))
        && (Number(at.milestone) === (Number(this.system.milestone) || 0));
      if (used) {
        lines.push(`<p class="sw-card-note sw-warn sw-flare-trained-again">${game.i18n.localize("STARWROUGHT.Flare.trainedAgain")}</p>`);
      }
    }
    if (already) {
      lines.push(`<p class="sw-card-note sw-flare-already">${game.i18n.format("STARWROUGHT.Flare.alreadyLit", { name })}</p>`);
    }
    const why = String(reason ?? "").trim();
    if (why) {
      lines.push(`<p class="sw-card-note sw-flare-reason">${
        game.i18n.format("STARWROUGHT.Flare.awardedBy", { reason: foundry.utils.escapeHTML(why) })}</p>`);
    }
    const comets = Number(this.system.comets) || 0;
    if (comets > 0) {
      lines.push(`<p class="sw-card-note sw-flare-comets">${
        game.i18n.format(comets === 1 ? "STARWROUGHT.Flare.cometHeld" : "STARWROUGHT.Flare.cometHeldMany", { n: comets })}</p>`);
    }
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-flare-card">
        <h3><i class="fa-solid fa-certificate"></i> ${game.i18n.localize("STARWROUGHT.Flare.title")}</h3>
        ${lines.join("\n        ")}</div>`
    });
  }

  /** Which Constellations are currently Flared. */
  get flared() {
    return Object.keys(this.system.flares ?? {});
  }
};
