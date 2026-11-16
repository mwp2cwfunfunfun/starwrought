/**
 * The Maneuvers the system implements, by name (0.10.1).
 *
 * A Maneuver is an action Item, authored on a sheet of `data/maneuvers.xlsx` and used from the
 * character's Maneuvers tab (a Basic Maneuver straight from the compendium, never copied). Most
 * of them the table resolves by hand: using one posts its card or rolls its check, and since
 * 0.23.0 pays its printed cost in an encounter (documents/item.mjs; through 0.22.0 the pips were
 * the player's to spend). A few the system does itself (Recenter clears the Exposed Zones and ends the Bind; Pass
 * declines the Opportunity, since 0.23.1; Raise
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
   * Pass ⓿ (0.23.1; Mike, 2026-11-14, of the row that only showed its card: "plan it"): the
   * actor's own Pass, the one the sheet's Pass button and the combat tracker's call. At the
   * actor's Opportunity it posts the Pass card, registers the Pass with the Combat and moves the
   * turn on, or ends the round on a full circuit of Passes. When a Pass is not possible (it is not
   * the actor's Opportunity, there is no encounter, the actor is Preparing) the method says why
   * and does nothing, and so does the row, by Mike's choice: the speech bubble beside the name is
   * the door that only shows the card. Pass is not a Maneuver: no gate, no cost.
   */
  pass: actor => actor.pass(),

  /**
   * Gain Control ❶ (0.27.0; rulings 274, 275, 280): the actor's own method, which finds the Bind
   * partner, passes the gate and pays when the roll is made, rolls Melee against the partner's
   * Guard and writes the result from the card (documents/actor/bind.mjs, `gainControl`). Engine
   * code, as Strike and Cast are, so the row's Automation cell is `N/A`. Through 0.26.1 the row
   * paid ❶ and showed its text.
   */
  "gain-control": (actor, item, options) => actor.gainControl({ item, ...((options?.dialog === undefined) ? {} : { dialog: options.dialog }) }),

  /**
   * Strike ❶ to ❸ (0.29.0, ruling 295): a character chooses what to Strike with (the weapons in
   * hand, the Unarmed Strike last) and the weapon row's own Strike runs, which gates, declares and
   * pays for its kind (documents/actor/attack.mjs, `strikeWith`). `strike` is the button pressed
   * on the row (Quick, Deliberate or Committed); the row's name is a Deliberate Strike. Through
   * 0.28.0 the row only showed its card and said the weapon's row pays. An adversary has attack
   * rows and no weapons, so for one the row is still its card.
   */
  strike: (actor, item, options) => ((actor.type === "character") && (typeof actor.strikeWith === "function")
    ? actor.strikeWith({ strike: options?.strike, ...((options?.dialog === undefined) ? {} : { dialog: options.dialog }) })
    : item.toMessage({ actor })),

  /**
   * Reload ⓿ to ❻ (0.29.0; rulings 292 and 293): the actor's own method, which finds the weapon in
   * hand that needs loading (asking which, when two do), passes the gate, pays THAT WEAPON'S
   * Reload cost (Prepared at three), loads it and posts the Reload card
   * (documents/actor/carrying.mjs, `reloadWeapon`). Through 0.28.0 the row asked how many actions,
   * paid and showed its text. `prepared` is Finish coming back for a Reload of three or more.
   */
  reload: (actor, item, options) => actor.reloadWeapon({ item, prepared: options?.prepared === true }),

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

/**
 * The built-ins that are a CHARACTER'S alone (0.29.0; the review's finding), by slug: for any
 * other actor `SwItem#use` passes them by and uses the row as a plain Maneuver. Reload loads a
 * weapon Item in hand, and an adversary has attack rows and no weapons: through 0.28.0 its Reload
 * row asked the cost, paid and showed its text, and it still does. (Strike is not listed: for an
 * adversary the built-in itself shows the card, since the plain path would charge for a Strike
 * the attack row then charges for.)
 * @type {ReadonlySet<string>}
 */
export const CHARACTER_BUILT_INS = Object.freeze(new Set(["reload"]));

/**
 * The Maneuvers whose cost the system takes somewhere other than their own row (0.23.0, ruling
 * 235), by the slug of the plain name, each with the line its card says in an encounter. Since
 * 0.23.0 a Maneuver used from the sheet in an encounter pays its printed cost; these would pay
 * twice, because the thing the player does next already pays:
 *  - Strike: the weapon's row declares the Strike and pays for its kind (documents/actor/attack.mjs);
 *  - Cast: the spell's own Cast pays (documents/actor/cast.mjs);
 *  - Move, Step, Crawl, Rush, Leap, Squeeze: moving the token pays, as the Move, Step, Crawl or
 *    Rush the drag reads (documents/movement.mjs). A Leap's own ❶ to ❸ and a Squeeze's are not
 *    read by the drag; what it charges beyond that is the table's, on the pips;
 *  - Close (0.27.0): the Step you drag toward the foe whose weapon you Control is the Close, and
 *    the drag pays and keeps the Bind (documents/movement.mjs, `settleBindOnMove`).
 * A Maneuver whose rule acts from a button on a card (a `reroll`, a `prevent`: Quick Tongue, Steady
 * the Line) and one that carries an attack of its own are paid elsewhere too; documents/item.mjs
 * reads those off the Item, since this module imports nothing.
 * @type {Readonly<Record<string, string>>}
 */
export const PAID_ELSEWHERE = Object.freeze({
  // Strike left this table in 0.29.0: its row Strikes now (`BUILT_IN_MANEUVERS.strike`), and a
  // built-in pays for itself.
  cast: "STARWROUGHT.Cost.paidBySpell",
  move: "STARWROUGHT.Cost.paidByMoving",
  step: "STARWROUGHT.Cost.paidByMoving",
  crawl: "STARWROUGHT.Cost.paidByMoving",
  rush: "STARWROUGHT.Cost.paidByMoving",
  leap: "STARWROUGHT.Cost.paidByMoving",
  squeeze: "STARWROUGHT.Cost.paidByMoving",
  // Close ❶ (0.27.0, ruling 277): the Controller's Step toward the foe IS the Close, so the drag
  // pays and keeps the Bind. Through 0.26.1 the row paid ❶ and the Step then paid ❶ again.
  close: "STARWROUGHT.Cost.paidByClosing"
});

/**
 * What the Maneuvers the system itself runs need before they can be used (0.28.0), by the slug of
 * the plain name: each entry is the data of one or more `[REQUIRES ...]` blocks, in the grammar's
 * own words (module/rules/requires.mjs), every one of which must hold. The Maneuvers tab reads a
 * row's own `[REQUIRES ...]` blocks; these six rows are engine code with an `N/A` in the cell
 * (Cast, Close, Gain Control, Raise a Shield, Pass, and Reload since 0.29.0), so their conditions are said here, where the
 * behaviour is, and the tab lists them correctly with no cell written. A row that does carry a
 * block of its own is read from the cell and never from here: the sheet is the author.
 *
 *  - Cast: a spell to cast (documents/actor/cast.mjs asks the same of the Talent);
 *  - Close: you Control a foe's weapon (the row's Requirements; `settleBindOnMove` reads the Step);
 *  - Gain Control: you are in a Bind you do not already Control (`gainControl` refuses otherwise);
 *  - Raise a Shield: a shield in hand (the entry above warns without one);
 *  - Pass: a fighter in a running encounter (`actor.pass()` says why and does nothing otherwise);
 *  - Reload: a weapon in hand that takes ammunition and is not full (`reloadWeapon` says there is
 *    nothing to reload otherwise).
 *
 * Strings and not parsed rules, so this module still imports nothing; the self-test reads every
 * one through `readRequires` and holds each key to a row the system runs or pays for.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const ENGINE_REQUIRES = Object.freeze({
  cast: Object.freeze(["spell"]),
  close: Object.freeze(["controlling"]),
  "gain-control": Object.freeze(["bind", "not controlling"]),
  "raise-a-shield": Object.freeze(["shield"]),
  pass: Object.freeze(["encounter"]),
  // Reload (0.29.0): a weapon in hand that takes ammunition and is not full.
  reload: Object.freeze(["weapon unloaded"])
});

/** The worn Visored piece, or null with a notice. */
function visorOf(actor) {
  const piece = actor.items.find(i => (i.type === "armor") && i.system.worn && i.system.visored);
  if (!piece) ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.noVisorWorn", { name: actor.name }));
  return piece ?? null;
}
