/**
 * Constellations: the categories, the four Defenses, the two parent Constellations every Strike
 * rolls, the Talents the book moved, and the RUNTIME REGISTRY of Constellation metadata.
 * The registry is the one piece of state in module/config/: `constellations` is filled at init
 * from the content index and by Sync content, and `getConstellation` is what turns a slug
 * into a Key Attribute. It is here because it is the Constellation vocabulary's lookup, and
 * nowhere else reads it directly. `getConstellation` uses Foundry's `String#titleCase` inside
 * its body only.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/** Constellation categories, in the order they should be listed on a sheet. */
export const CATEGORIES = Object.freeze({
  origin: { label: "STARWROUGHT.Category.origin", order: 0 },
  calling: { label: "STARWROUGHT.Category.calling", order: 1 },
  defense: { label: "STARWROUGHT.Category.defense", order: 2 },
  weapon: { label: "STARWROUGHT.Category.weapon", order: 3 },
  combatStyle: { label: "STARWROUGHT.Category.combatStyle", order: 4 },
  skill: { label: "STARWROUGHT.Category.skill", order: 5 },
  lore: { label: "STARWROUGHT.Category.lore", order: 6 },
  general: { label: "STARWROUGHT.Category.general", order: 7 }
});

/**
 * The categories the converter writes, mapped onto ours. Ancestry, Bloodline and Culture all
 * merge into the Origin Constellation (PHB: "your history, drawn as a single sky").
 */
export const CATEGORY_ALIASES = Object.freeze({
  Ancestry: "origin",
  Bloodline: "origin",
  Heritage: "origin",
  Culture: "origin",
  Origin: "origin",
  Background: "lore",
  Calling: "calling",
  Defense: "defense",
  Save: "defense",
  Weapon: "weapon",
  Weapons: "weapon",
  "Combat Style": "combatStyle",
  Armor: "combatStyle",
  Skill: "skill",
  Lore: "lore",
  General: "general"
});

/** The four Defenses, and the Attribute each keys off. */
export const DEFENSES = Object.freeze({
  awareness: {
    label: "STARWROUGHT.Defense.awareness",
    attribute: "wits",
    slug: "awareness",
    hint: "STARWROUGHT.Defense.awarenessHint"
  },
  evade: {
    label: "STARWROUGHT.Defense.evade",
    attribute: "agility",
    slug: "evade",
    hint: "STARWROUGHT.Defense.evadeHint"
  },
  guard: {
    label: "STARWROUGHT.Defense.guard",
    attribute: "presence",
    slug: "guard",
    hint: "STARWROUGHT.Defense.guardHint"
  },
  endure: {
    label: "STARWROUGHT.Defense.endure",
    attribute: "might",
    slug: "endure",
    hint: "STARWROUGHT.Defense.endureHint"
  }
});

/**
 * The two parent Constellations every Strike rolls (PHB v4.10): Melee for anything in your hand,
 * Ranged for anything that leaves it, a thrown dagger included. Every Combat Style is a child of
 * one of them, and a child's Talents count toward the parent's rank (rank only: the parent's own
 * Talents must still be bought, and Attribute Points are never counted twice).
 */
export const MELEE_SLUG = "melee";
export const RANGED_SLUG = "ranged";
/** @deprecated v3.4 had one Weapons Constellation. Kept for the migration of old Talents. */
export const WEAPONS_SLUG = "weapons";

/**
 * Talents the book moved between Constellations, keyed by the slug of their bare name. An owned
 * copy keeps its document id and is filed where the book now prints it (PHB v4.10: Loose and Move
 * left Archery for Ranged).
 */
export const MOVED_TALENTS = Object.freeze({
  "loose-and-move": { from: "archery", to: RANGED_SLUG }
});

/**
 * Constellation metadata, keyed by slug, populated at init from the shipped content index and
 * overridden by any Constellation Item found in the world or a compendium. Talents reference
 * their Constellation by slug, so this registry is what turns a slug into a Key Attribute.
 * @type {Record<string, {slug: string, name: string, category: string, attribute: string, img?: string}>}
 */
export const constellations = {};

/**
 * Register (or override) Constellation metadata.
 * @param {object} data
 */
export function registerConstellation(data) {
  if (!data?.slug) return;
  constellations[data.slug] = Object.assign(constellations[data.slug] ?? {}, data);
}

/** Look up a Constellation by slug, falling back to a synthetic entry so nothing ever throws. */
export function getConstellation(slug) {
  if (!slug) return null;
  return constellations[slug] ?? {
    slug,
    name: slug.replace(/-/g, " ").titleCase(),
    category: "general",
    attribute: "might"
  };
}

/**
 * Is this slug the Lore template or one of its instances?
 *
 * Lore is authored as a Skill constellation, because that is what it is in the book, but every
 * Lore (X) is a copy with its own rank and the game gives Lore its own kind of Talent Point. So
 * the system files them under their own category, and that decision lives here so the sheet, the
 * chargen pickers and the point scopes cannot disagree about it.
 */
export function isLoreSlug(slug) {
  return (slug === "lore") || String(slug ?? "").startsWith("lore-");
}
