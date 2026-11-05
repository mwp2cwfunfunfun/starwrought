/**
 * Item types: the default icon of each, which types are features and which are things you can
 * carry, and the carry states.
 * The Item data models are module/data/items/.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/** The icon a freshly created Item of each type gets, rather than the generic bag. */
export const TYPE_ICONS = Object.freeze({
  constellation: "systems/starwrought/assets/icons/constellation.svg",
  talent: "systems/starwrought/assets/icons/talent.svg",
  chassis: "systems/starwrought/assets/icons/chassis.svg",
  weapon: "icons/svg/sword.svg",
  armor: "icons/svg/shield.svg",
  shield: "icons/svg/shield.svg",
  gear: "icons/svg/item-bag.svg",
  action: "icons/svg/target.svg"
});

/** Item types that represent an owned Talent-like thing rather than gear. */
export const FEATURE_TYPES = Object.freeze(["talent", "chassis", "action"]);

/** Item types that can be equipped. */
export const PHYSICAL_TYPES = Object.freeze(["weapon", "armor", "shield", "gear"]);

/**
 * Where a piece of equipment is.
 *
 * Held is in your hands: a weapon you can Strike with, a shield you can Raise. Worn is on your
 * body: armor covering a Zone, or a sheathed blade you could draw. Carried is in a pack, which
 * needs an action and a container to get at; containers are not in this playtest, so Carried is
 * where armor goes when it comes off.
 */
export const CARRY_STATES = Object.freeze({
  held: { label: "STARWROUGHT.Carry.held", icon: "fa-solid fa-hand-fist" },
  worn: { label: "STARWROUGHT.Carry.worn", icon: "fa-solid fa-shirt" },
  carried: { label: "STARWROUGHT.Carry.carried", icon: "fa-solid fa-sack" }
});

/**
 * The state in which each kind of equipment is actually doing its job: armor Protects while worn,
 * a weapon or shield works while held.
 */
export const ACTIVE_STATE = Object.freeze({
  armor: "worn",
  weapon: "held",
  shield: "held",
  gear: "held"
});
