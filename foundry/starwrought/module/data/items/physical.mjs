/**
 * What only a thing you can carry needs: quantity, price, load and the three-state carry
 * model, with the migration from the old boolean and the derived flags. Used by weapon.mjs,
 * armor.mjs, shield.mjs and gear.mjs.
 */

import * as SW from "../../config.mjs";

const fields = foundry.data.fields;

/** Fields that only a thing you can carry needs. */
export function physicalFields(state = "worn") {
  return {
    quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    price: new fields.StringField({ initial: "" }),
    load: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    /** Held, worn, or carried. See SW.CARRY_STATES. */
    state: new fields.StringField({
      required: true, choices: Object.keys(SW.CARRY_STATES), initial: state
    })
  };
}

/**
 * Turn the old boolean into the three-state model, so a character built before this change keeps
 * their armor on and their sword in hand.
 * @param {object} source
 * @param {string} type
 */
export function migrateCarryState(source, type) {
  if (source.state !== undefined) return source;
  if (source.equipped === undefined) return source;
  // Armor that is off the body is in a pack; a weapon that is not in hand is still on your belt.
  source.state = source.equipped ? SW.ACTIVE_STATE[type] : (type === "armor" ? "carried" : "worn");
  delete source.equipped;
  return source;
}

/** Shared derived flags for anything you can carry. */
export function prepareCarry(system, type) {
  system.held = system.state === "held";
  system.worn = system.state === "worn";
  system.stowed = system.state === "carried";
  /** Doing its job: armor Protects while worn, a weapon or shield works while held. */
  system.equipped = system.state === SW.ACTIVE_STATE[type];
  system.stateLabel = SW.CARRY_STATES[system.state]?.label ?? "";
  system.stateIcon = SW.CARRY_STATES[system.state]?.icon ?? "";
}
