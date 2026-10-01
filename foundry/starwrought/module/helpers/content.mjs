/**
 * The Constellation registry.
 *
 * Talents reference their Constellation by slug, and a slug has to resolve to a Key Attribute
 * before any arithmetic can happen. The shipped index gives us that at init, before compendia are
 * readable; the compendium and the world then override it, so a GM's homebrew Constellation Item
 * wins over the printed one of the same slug. Since PHB v4.10 an entry also carries `parent`: the
 * slug of the Constellation whose rank its Talents count toward (Melee or Ranged for a Combat
 * Style, blank for everything else).
 */

import * as SW from "../config.mjs";

const INDEX_PATH = "systems/starwrought/content/constellations.json";
const SYNC_PATH = "systems/starwrought/content/sync.json";

/** Which Player's Handbook this system's content was built from. */
export const rulesVersion = { phb: null, syncedOn: null, constellations: 0, talents: 0 };

/** Load the shipped Constellation index. Safe to call before compendia are ready. */
export async function loadConstellationIndex() {
  try {
    const response = await foundry.utils.fetchJsonWithTimeout(INDEX_PATH);
    for (const entry of response ?? []) {
      SW.registerConstellation({ ...entry, parent: entry.parent ?? "" });
    }
    console.log(`STARWROUGHT | Registered ${Object.keys(SW.constellations).length} Constellations.`);
  } catch (error) {
    console.warn("STARWROUGHT | Could not read the shipped Constellation index.", error);
  }

  try {
    Object.assign(rulesVersion, await foundry.utils.fetchJsonWithTimeout(SYNC_PATH));
    console.log(`STARWROUGHT | Rules content built from Player's Handbook v${rulesVersion.phb}.`);
  } catch {
    // A system built before the sync stamp existed. Not worth a warning.
  }
}

/* -------------------------------------------- */

/**
 * Refresh the registry from the compendium and the world, so anything a GM has authored is what
 * the arithmetic uses.
 */
export async function refreshConstellationRegistry() {
  const pack = game.packs.get(`${SW.SYSTEM_ID}.constellations`);
  if (pack) {
    // The index is raw stored data, so a pack built as `system.parent` (before the field was
    // renamed for the data model, whose own `parent` is the Item) is read under either name.
    const index = await pack.getIndex({
      fields: ["system.slug", "system.category", "system.attribute", "system.parentSlug", "system.parent"]
    });
    for (const entry of index) {
      SW.registerConstellation({
        slug: entry.system?.slug || SW.slugify(entry.name),
        name: entry.name,
        category: entry.system?.category ?? "general",
        attribute: entry.system?.attribute ?? "might",
        parent: entry.system?.parentSlug || entry.system?.parent || "",
        img: entry.img,
        uuid: entry.uuid
      });
    }
  }
  for (const item of game.items ?? []) {
    if (item.type !== "constellation") continue;
    const slug = item.system.slug || SW.slugify(item.name);
    SW.registerConstellation({
      slug,
      name: item.name,
      category: item.system.category,
      attribute: item.system.attribute,
      // A world copy that predates the field (0.3.7) stores "" here; blank is silent, not "no
      // parent", so it falls back to what the index or the pack already registered.
      parent: item.system.parentSlug || SW.constellations[slug]?.parent || "",
      img: item.img,
      uuid: item.uuid
    });
  }
}

/**
 * The registered Constellations whose Talents count toward the named parent's rank.
 * @param {string} slug  A parent's slug (SW.MELEE_SLUG, SW.RANGED_SLUG).
 * @returns {string[]}   Child slugs.
 */
export function childrenOf(slug) {
  if (!slug) return [];
  return Object.values(SW.constellations).filter(c => c.parent === slug).map(c => c.slug);
}

/* -------------------------------------------- */

let basicActions = null;

/**
 * The Basic Actions: everything in the Actions compendium flagged `system.basic`, which is what
 * every character can do without owning a copy. They are authored in data/actions.xlsx (and, until
 * that sheet has them all, the roster's Encounter Mode rows), so the compendium is the one source
 * and the character sheet reads it rather than copying it. Loaded once per session; a world Item
 * of the same name flagged basic replaces the printed one, so a GM's rewrite wins.
 * @returns {Promise<Item[]>}  Unowned Items, sorted by category then name.
 */
export async function loadBasicActions() {
  if (basicActions) return basicActions;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.actions`);
  const printed = pack ? (await pack.getDocuments()).filter(i => (i.type === "action") && i.system.basic) : [];
  // Book order lives in the compendium folders. Remember each printed action's place, so a world
  // Item that replaces one keeps that place, and a world-only addition goes after the book.
  const place = new Map(printed.map(i => [i.name.toLowerCase(), i.folder?.sort ?? 0]));
  const byName = new Map(printed.map(i => [i.name.toLowerCase(), i]));
  for (const item of game.items ?? []) {
    if ((item.type === "action") && item.system.basic) byName.set(item.name.toLowerCase(), item);
  }
  const order = item => place.get(item.name.toLowerCase()) ?? 1000;
  basicActions = [...byName.values()].sort((a, b) =>
    (order(a) - order(b))
    || a.system.category.localeCompare(b.system.category)
    || a.name.localeCompare(b.name));
  return basicActions;
}

/** Forget the cached list, so the next sheet render reads the world again. */
export function invalidateBasicActions() {
  basicActions = null;
}

/* -------------------------------------------- */

/**
 * STARWROUGHT measures diagonals exactly, and that is a property of the system rather than of any
 * one scene: the Scene document has no diagonals field, so the rule comes from the manifest and
 * applies to every grid Foundry builds. This only fires if the manifest has been edited by hand.
 */
export function checkSceneGrid() {
  if (!game.user.isGM) return;
  if (game.system.grid?.diagonals === CONST.GRID_DIAGONALS.EXACT) return;
  ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.diagonals"));
}

/**
 * Are the shipped compendium packs actually populated? A fresh clone of the repository ships the
 * pack sources as JSON and needs a build step, so say so plainly rather than failing quietly.
 */
export async function checkContent() {
  if (!game.user.isGM) return;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.talents`);
  if (!pack) return;
  const index = await pack.getIndex();
  if (index.size > 0) return;
  ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.emptyPacks"), { permanent: true });
}
