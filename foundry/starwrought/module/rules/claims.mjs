/**
 * Claims (0.15.0; ruling 174): the player's decision on a bonus the system cannot decide.
 *
 * A `bonus` line with `CLAIM(<text>)` is offered in the roll dialog as an unticked checkbox (the
 * `bonus` kind's hook, module/rules/kinds/bonus.mjs). Mike (2026-11-05) wanted "both" the checkbox
 * and an arm button, so a Talent row that carries a claim has a pin: armed, the claim comes to the
 * next roll's dialog ticked and to the next Threshold read applied, and is spent by whichever
 * resolves first (`writeRuleMarks` with `per: "claim"` deletes the flag). The flag is
 * `flags.starwrought.rules.armed.<carrier key> = { at }` on the owner, the carrier key an Item's
 * id or a custom effect's `effect:<row id>` (0.17.0; the Effects tab's "Apply to next roll"); this
 * module is its one writer and its readers for the sheet. Nothing here touches a roll.
 */

import { flagKey, ruleCarrierKey } from "../config.mjs";
import { effectsOf } from "./effects-state.mjs";

/**
 * The carriers on an actor that hold at least one claim, with whether each is armed: Talents by
 * Item id and custom effects by `effect:<row id>` (the effect carrier's id, module/rules/engine.mjs).
 * @param {object} actor
 * @returns {Map<string, {item: object, armed: boolean, texts: string[]}>}  By carrier key.
 */
export function claimsOf(actor) {
  const out = new Map();
  const entries = (typeof actor?.rulesOfKind === "function") ? actor.rulesOfKind("bonus") : [];
  for (const { rule, item } of entries) {
    if (!rule?.claim || !item?.id) continue;
    const key = ruleCarrierKey(item);
    const held = out.get(key) ?? { item, armed: isArmed(actor, key), texts: [] };
    held.texts.push(String(rule.claim.text ?? ""));
    out.set(key, held);
  }
  return out;
}

/** Is this carrier's claim armed on its owner? */
export function isArmed(actor, carrierKey) {
  return !!actor?.flags?.starwrought?.rules?.armed?.[flagKey(carrierKey)];
}

/**
 * Does the actor carry this key: an owned Item by id, or a custom effect row by `effect:<row id>`?
 * A flag is never written for a carrier that is not there.
 */
function carries(actor, carrierKey) {
  const id = String(carrierKey);
  if (id.startsWith("effect:")) return effectsOf(actor).some(e => `effect:${e.id}` === id);
  return !!actor.items?.get?.(id);
}

/**
 * Arm or disarm a carrier's claims for the owner's next roll: the pin on the Talent's row and the
 * Effects tab's "Apply to next roll" are one state through this one writer (0.18.1; through 0.18.0
 * helpers/effects.mjs carried a second copy for the effect carrier). The owner or a GM writes;
 * anyone else is told. Says nothing in chat: a pin is a private intention, the roll's card is the
 * record.
 * @param {object} actor
 * @param {string} carrierKey  An owned Item's id, or a custom effect's `effect:<row id>`.
 * @param {boolean} [state]    Toggle when omitted.
 * @returns {Promise<boolean|null>}  The new state, or null when refused or the carrier is not there.
 */
export async function armClaim(actor, carrierKey, state = null) {
  if (!actor || !carrierKey) return null;
  if (!(actor.isOwner || game.user.isGM)) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  if (!carries(actor, carrierKey)) return null;
  const now = isArmed(actor, carrierKey);
  const next = (state === null) ? !now : !!state;
  if (next === now) return now;
  const safe = flagKey(carrierKey);
  const update = next
    ? { [`flags.starwrought.rules.armed.${safe}`]: { at: Date.now() } }
    : { [`flags.starwrought.rules.armed.-=${safe}`]: null };
  await actor.update(update, { swAnnounced: true });
  return next;
}
