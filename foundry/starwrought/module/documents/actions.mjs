/**
 * The three-action turn, tracked.
 *
 * Encounter Mode gives every creature 3 actions and 1 reaction, gained at the start of its turn.
 * The system spends them where it can see them being spent: a Strike, a Raise a Shield, a
 * Recenter, drawing or stowing a weapon, and moving. Everything else the table pays by hand, with
 * the pips on the sheet and the tracker.
 *
 * Movement is the interesting one. The grid is one foot, so a Stride is not "one square"; it is up
 * to your Speed. Dragging a token 30 feet on a Speed of 25 is two Strides, and the system charges
 * two. Difficult terrain and forced movement are the GM's to adjust, which is why every charge is
 * announced rather than silent.
 */

import * as SW from "../config.mjs";

/** Register the hooks that keep the action economy honest. */
export function registerActionTracking() {
  Hooks.on("combatStart", onTurnBegins);
  Hooks.on("combatTurnChange", onTurnBegins);
  Hooks.on("preUpdateToken", onTokenMoved);
}

/* -------------------------------------------- */

/**
 * A new turn: the creature whose turn it is gets its actions back.
 * Only one client does the write, so three players do not race each other for it.
 */
async function onTurnBegins(combat, prior, current) {
  const combatant = combat.combatants.get(current?.combatantId ?? combat.combatant?.id);
  const actor = combatant?.actor;
  if (!actor?.system?.actions) return;
  if (!isResponsibleFor(actor)) return;
  await actor.resetActions();

  // A raised shield lasts "until the start of your next turn", so it comes down here.
  for (const shield of actor.items.filter(i => (i.type === "shield") && i.system.raised)) {
    await shield.update({ "system.raised": false });
    await actor.update({
      "system.bonuses.defenses.guard": actor.system.bonuses.defenses.guard - shield.system.bonus
    });
  }
}

/* -------------------------------------------- */

/**
 * Moving costs Strides. Charged on the token's own client, before the move lands, so the pips are
 * right by the time the token stops.
 */
function onTokenMoved(token, changes, options, userId) {
  if (game.user.id !== userId) return;
  if (!game.settings.get(SW.SYSTEM_ID, "trackActions")) return;
  if (options.swNoCost) return;
  if ((changes.x === undefined) && (changes.y === undefined)) return;

  const actor = token.actor;
  if (!actor?.system?.actions) return;
  if (!actor.isTurn) return;

  const speed = Math.max(1, actor.system.speed ?? 25);
  const grid = canvas?.grid;
  if (!grid) return;

  // Measured with Foundry's own grid rather than by straight-line arithmetic, so the number
  // charged is the number the ruler shows. The manifest sets diagonals to EXACT, which is the
  // handbook's rule: a diagonal step across a one-foot square costs about 1.4 feet.
  const size = token.parent?.grid?.size ?? grid.size;
  const from = { x: token.x + (token.width * size / 2), y: token.y + (token.height * size / 2) };
  const to = {
    x: (changes.x ?? token.x) + (token.width * size / 2),
    y: (changes.y ?? token.y) + (token.height * size / 2)
  };
  const feet = grid.measurePath([from, to]).distance;
  if (feet < 0.5) return;

  // A Stride is up to your Speed, so a long drag is several of them.
  const cost = Math.max(1, Math.ceil(feet / speed));

  // The move always happens. spendActions announces an overspend in chat rather than refusing:
  // the token is where the player put it, and the arithmetic reports rather than rules.
  actor.spendActions(cost, {
    label: game.i18n.format("STARWROUGHT.Actions.stride", { feet: Math.round(feet) })
  });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="starwrought action-card"><h3>${"◆".repeat(Math.min(3, cost))} ${
      game.i18n.localize("STARWROUGHT.Actions.strideTitle")}</h3>
      <p>${game.i18n.format("STARWROUGHT.Actions.strideText", {
        name: actor.name, feet: Math.round(feet), speed, cost
      })}</p></div>`,
    whisper: actor.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
  });
}

/* -------------------------------------------- */

/**
 * Exactly one connected client should write a shared change. The GM does it when there is one,
 * otherwise the first active owner in the user list.
 */
function isResponsibleFor(actor) {
  if (game.users.activeGM) return game.user.isActiveGM;
  const owner = game.users.find(u => u.active && actor.testUserPermission(u, "OWNER"));
  return owner?.id === game.user.id;
}
