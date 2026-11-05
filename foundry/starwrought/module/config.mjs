/**
 * STARWROUGHT rules constants: the barrel.
 *
 * Everything the system imports as `SW` is a rule from the Player's Handbook, expressed once so
 * the rest of the system can do arithmetic without repeating a number that might drift. If a
 * value disagrees with the handbook, the handbook wins and the constant is the bug.
 *
 * Since 0.10.1 the constants live in module/config/, one file per concept (system, attributes,
 * proficiency, constellations, the exchange, degrees, zones, sizes, weapons, load, recovery,
 * advancement, the party and the road, actions, movement, auras, items, conditions, modifiers,
 * names), and this file re-exports every one of them by name, so `import * as SW from
 * "./config.mjs"` still names the whole vocabulary and a reader can find a constant's file from
 * the list below. Add a constant in its concept's file AND in that file's line here;
 * `node assets/build_all.mjs` fails when a file exports a name this barrel does not re-export,
 * or re-exports one it does not have. One concept's file may import another's (the exchange
 * reads MELEE_SLUG, conditions read SYSTEM_ID) but never this barrel, so there is no cycle.
 *
 * KEEP EVERY FILE IN module/config/ FREE OF FOUNDRY GLOBALS AT MODULE SCOPE.
 * `assets/build_foundry.mjs` and `assets/test_rules.mjs` import them from plain Node so that
 * the slug rule, the action-cost parser and the rest exist in exactly one place; a `game.` or
 * `CONFIG.` reference outside a function body breaks the content build. Foundry's prototype
 * extensions (`Math.clamp`, `String#titleCase`, `Number.isNumeric`) are used inside three
 * function bodies, which is fine so long as they stay inside.
 */

export { SYSTEM_ID, SYSTEM_VERSION, CONTENT_INDEX_PATH, CONTENT_SOURCE_PATH } from "./config/system.mjs";

export { ATTRIBUTES, ATTRIBUTE_DIVISOR, ATTRIBUTE_MAX, attributeBonus } from "./config/attributes.mjs";

export { RANKS, RANK_ORDER, TIERS, rankFor, rankBonus, rankAtLeast, stepRank } from "./config/proficiency.mjs";

export {
  CATEGORIES, CATEGORY_ALIASES, DEFENSES, MELEE_SLUG, RANGED_SLUG, WEAPONS_SLUG, ORIGIN_SLUG,
  MOVED_TALENTS, constellations, registerConstellation, getConstellation, isLoreSlug, isGroupSlug
} from "./config/constellations.mjs";

export {
  THREATS, STRIKE_KINDS, DEFAULT_STRIKE, CAST_KINDS, DEFAULT_CAST, SPELL_DICE_BY_RANK, spellDice,
  REACTIONS, ROOT_REACTIONS, LEGACY_STANCES, POSTURE_DEFAULT_BONUS, SUPPORT_MAX, GIVE_GROUND_FEET,
  PARRY_GUARD_BONUS, CONTROLLED_PENALTY, OFF_GUARD_PENALTY, UNWIELDY_PENALTY
} from "./config/exchange.mjs";

export { DEGREES, DEGREE_ORDER, ATTACK_OUTCOMES, degreeOf, invertDegree } from "./config/degrees.mjs";

export {
  ZONES, DEFAULT_ZONE, ZONE_CRITICALS, WOUND_CAPACITY, TORSO_WOUND_BLEED,
  PHYSICAL_DAMAGE, DAMAGE_TYPES, DAMAGE_ABBR, DELIVERIES, ARMOR_TYPES, LEGACY_ARMOR_TYPES
} from "./config/zones.mjs";

export { SIZES, COVER, DETECTION } from "./config/sizes.mjs";

export { HANDLING, WEAPON_GROUPS, WEAPON_DICE_BY_RANK, weaponDice } from "./config/weapons.mjs";

export {
  LOAD_RELIEF, STRAIN_CHECKS, STRAIN_TYPE, WIND_ROUND, FATIGUED_MAX, WIND_FAIL_RISE,
  WIND_CRIT_FAIL_RISE, VISOR_PENALTY, VISOR_RAISED_PROTECTION, FITTED_ZONES, FITTED_RELIEF
} from "./config/load.mjs";

export { DYING_MAX, HERO_POINTS_MAX, RECOVERY_BASE, TREAT_WOUND_BASE } from "./config/recovery.mjs";

export { MILESTONES_PER_LEVEL, TRAINED_AT_FLAG } from "./config/advancement.mjs";

export {
  PARTY_TYPE, ACTIVITY_SPEEDS, TERRAIN, EXPLORATION_EFFECTS, SCOUT_INITIATIVE_BONUS,
  ACTIVITY_CHOICE, TRAVEL
} from "./config/party.mjs";

export {
  ACTIONS_PER_ROUND, ACTIONS_MAX, PREPARED_THRESHOLD, ACTION_GLYPHS, REACTION_GLYPH, ACTION_COSTS,
  LEGACY_ACTION_COSTS, actionCostValue, parseActionCost, costGlyphs
} from "./config/actions.mjs";

export { DEFAULT_SPEED, STEP_DIVISOR, RUSH_MULTIPLIER, RUSH_COST, LEAP_STEPS, CRAWL_DIVISOR } from "./config/movement.mjs";

export { AURA_AUDIENCES, AURA_COLORS, REACH_COLORS } from "./config/auras.mjs";

export { TYPE_ICONS, FEATURE_TYPES, PHYSICAL_TYPES, CARRY_STATES, ACTIVE_STATE } from "./config/items.mjs";

export { CONDITIONS, ZONE_CONDITIONS, statusEffectId } from "./config/conditions.mjs";

export { BONUS_TYPES, LEGACY_BONUS_TYPES, bonusType, resolveModifiers } from "./config/modifiers.mjs";

export { slugify, plainName, sameName } from "./config/names.mjs";
