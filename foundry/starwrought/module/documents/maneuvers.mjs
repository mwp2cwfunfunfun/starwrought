/**
 * The Maneuvers the system implements, by name (0.10.1).
 *
 * A Maneuver is an action Item, authored on a sheet of `data/maneuvers.xlsx` and used from the
 * character's Maneuvers tab (a Basic Maneuver straight from the compendium, never copied). Most
 * of them the table resolves by hand: using one posts its card and the pips are the player's to
 * spend. A few the system does itself (Recenter clears the Exposed Zones and ends the Bind; Raise
 * a Shield flips the shield), and through 0.10.0 those behaviours were reachable from a sheet
 * button, a card button and a compendium Macro, while the Maneuver Item of the same name, used,
 * posted a card and did nothing: the Action was the one face with no behaviour behind it (the
 * eighth architecture recommendation, Mike, 2026-11-04: "Actions like Recenter should be an
 * Action first, and a Macro second"). `SwItem#use` asks this table first now, and the Macro uses
 * the Item.
 *
 * Keyed by the slug of the Maneuver's plain name, the match the `bonus` kind already uses for
 * "to Aid" (`slugify(plainName(name))`), so a row renamed in the workbook stops matching and
 * falls back to the card, visibly, rather than running the wrong thing. Each entry takes the
 * actor using the Maneuver, the Item, and the use options, and returns whatever the behaviour
 * returns; the behaviour itself stays where it was (the actor's and the shield's methods), since
 * the sheet buttons and the chat buttons still call it directly. This module imports nothing of
 * the system's, so it closes no circle with documents/item.mjs.
 */

/**
 * @callback BuiltInManeuver
 * @param {Actor} actor      Who is using the Maneuver (the Item's owner, or the character a Basic
 *                           Maneuver was used from).
 * @param {Item} item        The Maneuver Item.
 * @param {object} options   The use options, minus `actor`.
 * @returns {Promise<unknown>}
 */

/** @type {Readonly<Record<string, BuiltInManeuver>>} */
export const BUILT_IN_MANEUVERS = Object.freeze({
  /** Recenter ❶ (PHB v4.10): the actor's own method, which spends the action and posts the card. */
  recenter: actor => actor.recenter(),

  /**
   * Raise a Shield ❶ (PHB v4.10): the shield in hand is raised through its own method, which
   * spends the action and posts the card. With two shields in hand the first is raised, as the
   * equipment tab's row would raise that one; with none the player is told, since the Maneuver
   * says "you must be wielding it".
   */
  "raise-a-shield": async actor => {
    const shield = actor.items.find(i => (i.type === "shield") && i.system.held);
    if (!shield) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.noShieldHeld", { name: actor.name }));
      return null;
    }
    return shield.raise();
  },

  /**
   * Lower the Visor ❶ and Raise the Visor ❶ (PHB v4.21, the Visored armor trait: "Can Raise or
   * Lower the visor as a single action"): the worn Visored Head piece's own method, which spends
   * the action and posts the card. With no such piece worn the player is told. The rows do not
   * exist in `data/maneuvers.xlsx` yet; these entries are what they will run when Mike authors
   * them by these names, and the Equipment tab's control runs the same method today.
   */
  "lower-the-visor": async actor => visorOf(actor)?.toggleVisor(true) ?? null,
  "raise-the-visor": async actor => visorOf(actor)?.toggleVisor(false) ?? null,
  "lower-visor": async actor => visorOf(actor)?.toggleVisor(true) ?? null,
  "raise-visor": async actor => visorOf(actor)?.toggleVisor(false) ?? null
});

/** The worn Visored piece, or null with a notice. */
function visorOf(actor) {
  const piece = actor.items.find(i => (i.type === "armor") && i.system.worn && i.system.visored);
  if (!piece) ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.noVisorWorn", { name: actor.name }));
  return piece ?? null;
}
