/**
 * The party sheet's Loot tab (apps/party-sheet.mjs; 0.7.1; plan, part 6; rulings 96 to 98): the context one tab's templates render,
 * read live off the members and the party at render and computed nowhere else (the plan's risk 2).
 * Plain functions over the party and its members, no `this`: the sheet calls them from
 * `_prepareContext` and the handlers stay with the sheet. Through 0.10.1 these were the sheet's own
 * private methods.
 */

import { coinText, isLoot, toCopper } from "../../helpers/party.mjs";

const L = key => game.i18n.localize(key);

/**
 * The Loot tab (0.7.1; plan, part 6; rulings 96 to 98): one row per embedded Item of a physical
 * type, by name, with the price string the Item carries and nothing computed from it; the
 * purse; and who may do what. The GM edits quantities, Gives to a member and Deletes; a player
 * who owns a member Takes, which goes to the active GM's client, so the rows say when no GM is
 * connected and the Take would write nothing. Carry state means nothing on a party and is not
 * shown.
 * @param {Actor} party
 * @param {Array<{uuid: string, actor: Actor|null}>} members
 * @returns {object}
 */
export function prepareLoot(party, members) {
  const isGM = game.user.isGM;
  const present = members.filter(m => m.actor);
  const owned = present.filter(m => m.actor.testUserPermission(game.user, "OWNER"));
  const gmActive = !!game.users.activeGM;
  const canTake = !isGM && (owned.length > 0);

  const rows = party.items
    .filter(item => isLoot(item))
    .map(item => {
      const quantity = Math.max(0, Number(item.system.quantity) || 0);
      return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        typeLabel: L(CONFIG.Item.typeLabels?.[item.type] ?? `TYPES.Item.${item.type}`),
        quantity,
        price: String(item.system.price ?? "").trim(),
        traits: item.type === "weapon" ? (item.system.totalTraits ?? "") : "",
        inStock: quantity > 0,
        canTake: canTake && (quantity > 0),
        stack: quantity > 1
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const purse = party.system.currency ?? { gp: 0, sp: 0, cp: 0 };
  const copper = toCopper(purse);
  return {
    rows,
    count: rows.length,
    isGM,
    canTake,
    gmActive,
    ownedCount: owned.length,
    memberCount: present.length,
    purse: {
      gp: Number(purse.gp) || 0,
      sp: Number(purse.sp) || 0,
      cp: Number(purse.cp) || 0,
      copper,
      text: coinText(copper),
      empty: copper <= 0
    },
    canSplit: isGM && (copper > 0) && (present.length > 0)
  };
}
