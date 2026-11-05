/**
 * Claims (0.15.0; ruling 174): the player's decision on a bonus the system cannot decide.
 *
 * A `bonus` line with `CLAIM(<text>)` is offered in the roll dialog as an unticked checkbox (the
 * `bonus` kind's hook, module/rules/kinds/bonus.mjs). Mike (2026-11-05) wanted "both" the checkbox
 * and an arm button, so a Talent row that carries a claim has a pin: armed, the claim comes to the
 * next roll's dialog ticked and to the next Threshold read applied, and is spent by whichever
 * resolves first (`writeRuleMarks` with `per: "claim"` deletes the flag). The flag is
 * `flags.starwrought.rules.armed.<itemId> = { at }` on the owner; this module is its one writer
 * and its readers for the sheet. Nothing here touches a roll.
 */

/**
 * The Talents on an actor that carry at least one claim, with whether each is armed.
 * @param {object} actor
 * @returns {Map<string, {item: object, armed: boolean, texts: string[]}>}  By Item id.
 */
export function claimsOf(actor) {
  const out = new Map();
  const entries = (typeof actor?.rulesOfKind === "function") ? actor.rulesOfKind("bonus") : [];
  const armed = actor?.flags?.starwrought?.rules?.armed ?? {};
  for (const { rule, item } of entries) {
    if (!rule?.claim || !item?.id) continue;
    const held = out.get(item.id) ?? { item, armed: !!armed[item.id], texts: [] };
    held.texts.push(String(rule.claim.text ?? ""));
    out.set(item.id, held);
  }
  return out;
}

/** Is this Talent's claim armed on its owner? */
export function isArmed(actor, itemId) {
  return !!actor?.flags?.starwrought?.rules?.armed?.[itemId];
}

/**
 * Arm or disarm a Talent's claims for the owner's next roll. The owner or a GM writes; anyone else
 * is told. Says nothing in chat: a pin is a private intention, the roll's card is the record.
 * @param {object} actor
 * @param {string} itemId
 * @param {boolean} [state]  Toggle when omitted.
 * @returns {Promise<boolean|null>}  The new state, or null when refused.
 */
export async function armClaim(actor, itemId, state = null) {
  if (!actor || !itemId) return null;
  if (!(actor.isOwner || game.user.isGM)) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const item = actor.items.get(itemId);
  if (!item) return null;
  const now = isArmed(actor, itemId);
  const next = (state === null) ? !now : !!state;
  if (next === now) return now;
  const safe = String(itemId).replace(/\./g, "-");
  const update = next
    ? { [`flags.starwrought.rules.armed.${safe}`]: { at: Date.now() } }
    : { [`flags.starwrought.rules.armed.-=${safe}`]: null };
  await actor.update(update, { swAnnounced: true });
  return next;
}
