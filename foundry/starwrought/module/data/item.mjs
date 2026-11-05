/**
 * Item data models: the barrel.
 *
 * Through 0.10.0 this file held all eight models and their shared pieces (873 lines); since
 * 0.10.1 it re-exports them from module/data/items/, one file per type and one per shared
 * concern, so `import { ... } from "./module/data/item.mjs"` still names everything a
 * registration needs. Edit the model in its own file, not here.
 *
 * One file per Item type under module/data/items/, the shared pieces beside them one concern
 * per file (base, cost, aura, rules, physical, weapon-traits), and module/data/item.mjs a barrel
 * that re-exports the lot, so a registration imports one module. A type's file imports only the
 * shared pieces its schema uses; no type file imports another type file.
 *
 * What is NOT here: `migrateSpeed` and `LEGACY_SPEED_FLOOR`, the one-time world migration's
 * conversions, now in module/data/legacy.mjs.
 */

export { SwItemData, describedFields } from "./items/base.mjs";
export { SwConstellationData } from "./items/constellation.mjs";
export { SwTalentData } from "./items/talent.mjs";
export { SwChassisData } from "./items/chassis.mjs";
export { SwWeaponData } from "./items/weapon.mjs";
export { SwArmorData } from "./items/armor.mjs";
export { SwShieldData } from "./items/shield.mjs";
export { SwGearData } from "./items/gear.mjs";
export { SwActionData } from "./items/action.mjs";
export { parseWeaponTraits, splitTraits } from "./items/weapon-traits.mjs";
