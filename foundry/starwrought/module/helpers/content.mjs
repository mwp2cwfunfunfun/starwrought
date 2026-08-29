/**
 * The Constellation registry.
 *
 * Talents reference their Constellation by slug, and a slug has to resolve to a Key Attribute
 * before any arithmetic can happen. The shipped index gives us that at init, before compendia are
 * readable; the compendium and the world then override it, so a GM's homebrew Constellation Item
 * wins over the printed one of the same slug.
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
    for (const entry of response ?? []) SW.registerConstellation(entry);
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
    const index = await pack.getIndex({ fields: ["system.slug", "system.category", "system.attribute"] });
    for (const entry of index) {
      SW.registerConstellation({
        slug: entry.system?.slug || SW.slugify(entry.name),
        name: entry.name,
        category: entry.system?.category ?? "general",
        attribute: entry.system?.attribute ?? "might",
        img: entry.img,
        uuid: entry.uuid
      });
    }
  }
  for (const item of game.items ?? []) {
    if (item.type !== "constellation") continue;
    SW.registerConstellation({
      slug: item.system.slug || SW.slugify(item.name),
      name: item.name,
      category: item.system.category,
      attribute: item.system.attribute,
      img: item.img,
      uuid: item.uuid
    });
  }
}

/* -------------------------------------------- */

/**
 * Are the shipped compendium packs actually populated? A fresh clone of the repository ships the
 * pack sources as JSON and needs a build step, so say so plainly rather than failing quietly.
 */
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

export async function checkContent() {
  if (!game.user.isGM) return;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.talents`);
  if (!pack) return;
  const index = await pack.getIndex();
  if (index.size > 0) return;
  ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.emptyPacks"), { permanent: true });
}
