/**
 * SwActor: carrying. One write moves an Item between In hand, Worn and Packed, with the action the
 * draw or stow costs and the Bind a dropped implement ends. Since 0.29.0 also loading: the Reload
 * Maneuver's behaviour (`reloadWeapon`) and the one place a weapon is loaded (`loadWeapon`).
 */

import * as SW from "../../config.mjs";
import { setting } from "../../helpers/settings.mjs";
// What Reload may load (0.29.0), pure: the weapons in hand that take ammunition and are not full.
import { reloadOptions } from "../../data/items/weapon-traits.mjs";

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
    // A natural weapon is always in hand (0.29.0): a fist is not drawn or put away, and trying
    // costs no action.
    if (item.system.natural) return;

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

  /* -------------------------------------------- */
  /*  Loading (0.29.0)                            */
  /* -------------------------------------------- */

  /**
   * Reload (0.29.0; rulings 292 and 293). Mike: "For a ranged weapon, it must also be loaded", and
   * by question, loading is tracked fully. Through 0.28.0 the Reload row asked "how many actions?",
   * paid and showed its text, and touched no weapon. Now the Maneuver does the work:
   *
   *  - it loads a weapon IN HAND that takes ammunition and is not full (`reloadOptions`); with
   *    none it says so and does nothing; with two it asks which;
   *  - its cost is THAT WEAPON'S Reload (a bow ❶, a Light Crossbow ❷, a Heavy Crossbow ❸), never
   *    a number the player picks: the row's ⓿ to ❻ is the range the book's weapons span;
   *  - in an encounter with the round tracked it passes the Opportunity gate and pays; three or
   *    more is Prepared, as any such Maneuver is (PHB v4.24: two actions now, the rest reserved),
   *    and Finish comes back here with `prepared` to do the loading;
   *  - outside an encounter nothing is counted and it loads for nothing.
   *
   * @param {object} [options]
   * @param {Item} [options.item]        The Reload Maneuver's Item, for the card's text.
   * @param {string} [options.weaponId]  The weapon to load, when the caller knows.
   * @param {boolean} [options.prepared] Finish re-entering a Prepared Reload: already paid.
   * @returns {Promise<ChatMessage|object|null>}  The card, the preparation, or null when nothing was done.
   */
  async reloadWeapon({ item = null, weaponId = "", prepared = false } = {}) {
    const L = key => game.i18n.localize(key);
    const F = (key, data) => game.i18n.format(key, data);

    // A Prepared Reload finishing loads the weapon it was begun for.
    if (prepared && !weaponId) weaponId = this.system.actions?.preparing?.weaponId ?? "";
    let weapon = weaponId ? (this.items.get(weaponId) ?? null) : null;
    if (weapon && !weapon.system?.takesAmmunition) weapon = null;
    if (!weapon) {
      const options = reloadOptions(this.items.filter(i => i.type === "weapon").map(w => ({
        id: w.id, name: w.name, held: !!w.system.held, takesAmmunition: !!w.system.takesAmmunition, full: !!w.system.isFull
      })));
      if (!options.length) {
        ui.notifications.warn(F("STARWROUGHT.Reload.nothing", { name: this.name }));
        return null;
      }
      let id = options[0].id;
      if (options.length > 1) {
        const { pickReloadWeapon } = await import("../../apps/strike-picker.mjs");
        id = await pickReloadWeapon(this, options.map(o => o.id));
      }
      weapon = id ? (this.items.get(id) ?? null) : null;
      if (!weapon) return null;
      // Finish asked which weapon, and the preparation was abandoned under the open question:
      // nothing was Prepared any more, so nothing is loaded.
      if (prepared && !this.system.actions?.preparing?.kind) return null;
    }

    // The row itself, for the card's text, when the use did not come from it.
    if (!item) {
      try {
        const { loadBasicActions } = await import("../../helpers/content.mjs");
        item = this.items.find(i => (i.type === "action") && (SW.slugify(SW.plainName(i.name)) === "reload"))
          ?? (await loadBasicActions()).find(i => SW.slugify(SW.plainName(i.name)) === "reload") ?? null;
      } catch { item = null; }
    }
    const plain = item ? SW.plainName(item.name) : L("STARWROUGHT.Reload.label");
    const n = Math.max(0, Number(weapon.system.reloadCost) || 0);
    const counted = this.inEncounter && !!this.system.actions && setting("trackActions", true);
    const cost = (prepared || !counted) ? 0 : n;
    const label = `${plain} ${SW.ACTION_GLYPHS[n] ?? ""}: ${weapon.name}`.trim();

    // A Maneuver: outside this actor's Opportunity it waits for the GM (0.19.0). Finish was gated
    // when the Reload was begun.
    if (!prepared && (typeof this.mayActNow === "function") && !(await this.mayActNow({ label }))) return null;

    // Three or more is Prepared: nothing is loaded until Finish, which comes back with `prepared`.
    // The preparation remembers the weapon, as a Committed Strike's does. It needs the Reload row,
    // which is what Finish uses again; with no such row in the world or the pack (it ships) the
    // Reload is paid whole and loads at once.
    if ((cost >= SW.PREPARED_THRESHOLD) && item) {
      return this.prepare({ kind: "maneuver", label: `${plain}: ${weapon.name}`, cost, itemUuid: item.uuid, weaponId: weapon.id });
    }

    const lines = [];
    if (cost) {
      await this.spendActions(cost, { label, announce: false });
      if (this.announcesSpends) {
        lines.push(`${F("STARWROUGHT.Actions.spent", { name: this.name, spent: cost })} ${this.actionsLeftLine?.() ?? ""}`.trim());
      }
    }
    if (prepared) lines.push(L("STARWROUGHT.Cost.preparedPaid"));
    const shots = await this.loadWeapon(weapon);
    lines.push((weapon.system.magazine > 1)
      ? F("STARWROUGHT.Reload.loadedCount", { name: this.name, weapon: weapon.name, n: shots, max: weapon.system.magazine })
      : F("STARWROUGHT.Reload.loaded", { name: this.name, weapon: weapon.name }));
    if (item && (typeof item.toMessage === "function")) return item.toMessage({ actor: this, lines });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${foundry.utils.escapeHTML(plain)}</h3>${
        lines.map(line => `<p>${foundry.utils.escapeHTML(line)}</p>`).join("")}</div>`
    });
  }

  /**
   * THE ONE PLACE A WEAPON IS LOADED (0.29.0): fill it to its magazine. Counting ammunition is the
   * next step Mike asked for (arrows and bolts as counted gear), and this is where a Reload will
   * take it from the pack and stop short when there is not enough.
   * @param {Item} weapon  A weapon that takes ammunition.
   * @returns {Promise<number>}  The shots now in it.
   */
  async loadWeapon(weapon) {
    const magazine = Math.max(1, Number(weapon?.system?.magazine) || 1);
    // swAnnounced: the Reload card says it; the audit speaks only of a count corrected by hand.
    await weapon.update({ "system.loaded": magazine }, { swAnnounced: true });
    return magazine;
  }
};
