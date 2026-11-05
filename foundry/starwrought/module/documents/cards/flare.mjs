/**
 * The Flare button on a critical's card. Through 0.10.0 this lived in documents/chat.mjs.
 */

import { pickFlare } from "../../apps/flare-picker.mjs";

/**
 * Light a Constellation from a critical.
 *
 * The die can say the roll was a critical; only the table can say which Constellation's Talent
 * it was related to, and the answer is often not the Constellation that supplied the Proficiency
 * Bonus. Kessa's crit came off a Great Weapon Fighting talent, but the roll itself was Melee.
 * So the button asks, defaulting to the Constellation that was rolled.
 *
 * The dialog is `pickFlare` (module/apps/flare-picker.mjs, 0.7.0), shared with the Party Sheet's
 * GM Flare award: the character's Opened Constellations (0.6.3, ruling 85), the "Show
 * Constellations you have not opened" checkbox and the preselection of the rolled Constellation,
 * exactly as this function built them until 0.7.0. The chat path asks for no reason.
 *
 * The card is the actor's to post (`toggleFlare`, ruling 86), so a Flare is said once whichever
 * button lit it.
 */
export async function flareFromCard(message, flags, button) {
  const doc = await fromUuid(flags.actorUuid);
  const actor = doc?.actor ?? doc;
  if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));

  const suggested = button.dataset.slug || "";
  const pick = await pickFlare(actor, { suggested });
  if (!pick) return;
  return actor.toggleFlare(pick.slug, true);
}
