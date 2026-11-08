/**
 * SwActor: carrying. One write moves an Item between In hand, Worn and Packed, with the action the
 * draw or stow costs and the Bind a dropped implement ends.
 */

import * as SW from "../../config.mjs";

/** @param {typeof Actor} Base */
export const CarryingMixin = Base => class extends Base {
  /**
   * Move a piece of equipment between held, worn, and carried.
   *
   * Drawing or stowing something is an Interact, which costs an action in an encounter. Armor is
   * the exception the handbook is explicit about: putting a piece on or taking it off takes a
   * minute per point of Protection, so it is not something you do mid-fight at all. Putting away
   * an implement that is in a Bind ends the Bind (a dropped implement does).
   * @param {string} itemId
   * @param {string} state  A key of SW.CARRY_STATES.
   */
  async setCarryState(itemId, state) {
    const item = this.items.get(itemId);
    if (!item || !(state in SW.CARRY_STATES)) return;
    if (item.system.state === state) return;

    if (item.type === "armor") {
      // "Putting on or taking off a single piece takes 1 minute for each point of Protection."
      // Said plainly rather than forbidden: it is the table's call whether the fiction allows it.
      if (this.inEncounter) {
        const minutes = Math.max(1, item.system.protection);
        const body = game.i18n.format("STARWROUGHT.Actions.armorInCombat", { name: item.name, minutes });
        ui.notifications.warn(body);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          content: `<div class="starwrought action-card sw-overspend">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
              game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3><p>${body}</p></div>`
        });
      }
    } else if (state === "held" || item.system.state === "held") {
      // Drawing it or putting it away: one Interact, a Maneuver, so outside this actor's
      // Opportunity it waits for the GM (0.19.0).
      const label = game.i18n.format("STARWROUGHT.Actions.interactLabel", { name: item.name });
      if (!(await this.mayActNow({ label }))) return;
      await this.spendActions(1, { label });
    }

    if ((item.system.state === "held") && this.system.bind?.state && SW.sameName(this.system.bind.mine, item.name)) {
      await this.endBind();
    }
    return item.update({ "system.state": state });
  }
};
