/**
 * One question: Strike with what? (0.29.0, ruling 295.) Mike: "There should be 1/2/3 action buttons
 * on the Strike row on the Maneuvers tab... when you click on it, you can choose what you want to
 * Strike with (eg unarmed, the weapon in your left hand, the weapon in your right hand, etc.)."
 *
 * The choices are the weapons in hand, the real ones first and the Unarmed Strike last
 * (`strikeOptions` in data/items/weapon-traits.mjs, pure; a weapon worn or packed is drawn first
 * and is not offered). The system does not know a left hand from a right: two weapons in hand are
 * two named choices. Each is one button, so the pick is one click in a fight, and its label carries
 * what the Equipment row says of the weapon (`weaponNumbers`): the attack modifier, the damage, the
 * reach or the range, and "not loaded" for an empty ranged weapon, which may still be chosen (the
 * Strike warns and goes on, ruling 291). With one thing to Strike with there is nothing to ask.
 * Returns the weapon's id, or null when the dialog is dismissed, and then nothing happens at all.
 */

import * as SW from "../config.mjs";
import { strikeOptions } from "../data/items/weapon-traits.mjs";
import { weaponNumbers } from "../helpers/actor-context.mjs";

/** "+5" or "-1", as the sheets sign a modifier. */
const signed = n => `${(Number(n) || 0) < 0 ? "-" : "+"}${Math.abs(Number(n) || 0)}`;

/**
 * One choice's button text: "Shortsword: +5, 2d6+2 Slashing, reach 4 ft". The damage is the
 * Strike's own: a Quick Strike is one weapon die and nothing else, so it reads "1d6 Slashing".
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {string} [strike]  quick | deliberate | committed.
 * @returns {string}
 */
export function strikeOptionLabel(actor, weapon, strike = SW.DEFAULT_STRIKE) {
  const numbers = weaponNumbers(actor, weapon);
  const where = game.i18n.format(weapon.system.isRanged ? "STARWROUGHT.StrikeWith.range" : "STARWROUGHT.StrikeWith.reach", { feet: numbers.reach });
  const damage = (strike === "quick") ? `${numbers.quickDamage} ${numbers.damageType}` : numbers.damage;
  const parts = [signed(numbers.attackMod), damage, where];
  if (weapon.system.takesAmmunition && !weapon.system.isLoaded) parts.push(game.i18n.localize("STARWROUGHT.StrikeWith.notLoaded"));
  return `${weapon.name}: ${parts.join(", ")}`;
}

/**
 * One question: Reload which? (0.29.0.) Asked by `SwActor#reloadWeapon` when two weapons in hand
 * could be loaded; one button each, naming what the Reload costs for that weapon and what is in
 * it now. Returns the weapon's id, or null when the dialog is dismissed.
 * @param {Actor} actor
 * @param {string[]} ids  The ids of the weapons that can be loaded, in the order to list them.
 * @returns {Promise<string|null>}
 */
export async function pickReloadWeapon(actor, ids = []) {
  const weapons = ids.map(id => actor.items.get(id)).filter(Boolean);
  if (!weapons.length) return null;
  if (weapons.length === 1) return weapons[0].id;
  const buttons = weapons.map((weapon, index) => ({
    action: `weapon-${weapon.id}`,
    label: game.i18n.format("STARWROUGHT.Reload.option", {
      weapon: weapon.name,
      cost: SW.ACTION_GLYPHS[weapon.system.reloadCost] ?? String(weapon.system.reloadCost),
      n: weapon.system.shots, max: weapon.system.magazine
    }),
    icon: "fa-solid fa-arrows-rotate",
    default: index === 0,
    callback: () => weapon.id
  }));
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("STARWROUGHT.Reload.title"), icon: "fa-solid fa-arrows-rotate" },
    classes: ["starwrought", "sw-strike-picker"],
    content: `<p>${game.i18n.format("STARWROUGHT.Reload.text", { name: foundry.utils.escapeHTML(actor.name) })}</p>`,
    buttons,
    rejectClose: false
  });
  return weapons.some(weapon => weapon.id === picked) ? picked : null;
}

/**
 * @param {Actor} actor
 * @param {object} [options]
 * @param {string} [options.strike]  quick | deliberate | committed, for the window's title.
 * @returns {Promise<string|null>}  The id of the weapon to Strike with.
 */
export async function pickStrikeWeapon(actor, { strike = SW.DEFAULT_STRIKE } = {}) {
  const weapons = actor.items.filter(i => i.type === "weapon");
  const options = strikeOptions(weapons.map(w => ({
    id: w.id, name: w.name, held: !!w.system.held, natural: !!w.system.natural
  })));
  if (!options.length) {
    ui.notifications.warn(game.i18n.format("STARWROUGHT.StrikeWith.nothing", { name: actor.name }));
    return null;
  }
  if (options.length === 1) return options[0].id;

  const kind = SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  const named = `${game.i18n.localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost] ?? ""}`.trim();
  const buttons = options.map((option, index) => ({
    action: `weapon-${option.id}`,
    label: strikeOptionLabel(actor, actor.items.get(option.id), strike),
    icon: option.natural ? "fa-solid fa-hand-fist" : "fa-solid fa-khanda",
    default: index === 0,
    callback: () => option.id
  }));
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("STARWROUGHT.StrikeWith.title", { strike: named }), icon: "fa-solid fa-hand-fist" },
    classes: ["starwrought", "sw-strike-picker"],
    content: `<p>${game.i18n.format("STARWROUGHT.StrikeWith.text", { name: foundry.utils.escapeHTML(actor.name) })}</p>`,
    buttons,
    rejectClose: false
  });
  return options.some(option => option.id === picked) ? picked : null;
}
