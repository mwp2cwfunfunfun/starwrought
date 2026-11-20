/**
 * The Constellation registry.
 *
 * Talents reference their Constellation by slug, and a slug has to resolve to a Key Attribute
 * before any arithmetic can happen. The shipped index gives us that at init, before compendia are
 * readable; the compendium and the world then override it, so a GM's homebrew Constellation Item
 * wins over the printed one of the same slug. Since PHB v4.10 an entry also carries `parent`: the
 * slug of the Constellation whose rank its Talents count toward (Melee or Ranged for a Combat
 * Style, blank for everything else).
 *
 * Every entry also carries `enabled` (ruling 61). The spreadsheets' `Enabled?` column decides
 * what ships to Foundry; the index keeps every authored Constellation, flagged, so a character who
 * already owns a Talent of a Constellation that has since been switched off still resolves its
 * name, category, attribute and parent. Anything read from a compendium or the world is enabled by
 * definition: it is there. `getConstellation` keeps resolving disabled slugs; only the lists that
 * are offered to a player (chargen, the Item sheet's selects) filter on the flag, through
 * `enabledConstellations()` below.
 */

import * as SW from "../config.mjs";

const INDEX_PATH = "systems/starwrought/content/constellations.json";
const SYNC_PATH = "systems/starwrought/content/sync.json";

/**
 * Which Player's Handbook this system's content was built from. `constellations` and `talents`
 * are the authored totals; `enabled` is what the packs actually hold (ruling 61).
 */
export const rulesVersion = {
  phb: null, syncedOn: null, constellations: 0, talents: 0,
  enabled: { constellations: 0, talents: 0 }
};

/**
 * The slugs the shipped index registered on its last read. `reloadContentIndexes` (0.8.0) compares
 * the next read against it: a Constellation the index has dropped, and no pack or world Item still
 * carries, is switched off in the registry rather than left enabled on the strength of a file that
 * no longer names it. Lore instances and anything registered by a Talent at runtime are not in this
 * set, so they are never touched.
 */
let indexedSlugs = new Set();

/**
 * Read the shipped Constellation index into the registry. `fresh` adds a cache-busting query, for
 * a re-read after the sources changed under a running world (the content loop, 0.8.0).
 * @param {{fresh?: boolean}} [options]
 * @returns {Promise<boolean>}  Whether the index was read.
 */
async function registerShippedIndex({ fresh = false } = {}) {
  const url = fresh ? `${INDEX_PATH}?t=${Date.now()}` : INDEX_PATH;
  const response = await foundry.utils.fetchJsonWithTimeout(url);
  const seen = new Set();
  for (const entry of response ?? []) {
    if (!entry?.slug) continue;
    seen.add(entry.slug);
    // An index written before the Enabled? gate has no flag; absent means enabled, the same
    // reading the converter gives a sheet without the column (ruling 60).
    SW.registerConstellation({ ...entry, parent: entry.parent ?? "", enabled: entry.enabled !== false });
  }
  // Dropped from the index since the last read: off, until the pack or the world says otherwise
  // (refreshConstellationRegistry re-enables whatever either still holds).
  for (const slug of indexedSlugs) {
    if (!seen.has(slug) && SW.constellations[slug]) SW.constellations[slug].enabled = false;
  }
  indexedSlugs = seen;
  return true;
}

/** Read the sync stamp (which handbook, how much of the book is enabled) into `rulesVersion`. */
async function readSyncStamp({ fresh = false } = {}) {
  const url = fresh ? `${SYNC_PATH}?t=${Date.now()}` : SYNC_PATH;
  Object.assign(rulesVersion, await foundry.utils.fetchJsonWithTimeout(url));
}

/** Load the shipped Constellation index. Safe to call before compendia are ready. */
export async function loadConstellationIndex() {
  try {
    await registerShippedIndex();
    const total = Object.keys(SW.constellations).length;
    console.log(`STARWROUGHT | Registered ${total} Constellations (${enabledConstellations().length} enabled for play).`);
  } catch (error) {
    console.warn("STARWROUGHT | Could not read the shipped Constellation index.", error);
  }

  try {
    await readSyncStamp();
    console.log(`STARWROUGHT | Rules content built from Player's Handbook v${rulesVersion.phb}.`);
    // A stamp written before ruling 61 has no `enabled` block; the default above stands in.
    if (rulesVersion.enabled?.constellations || rulesVersion.enabled?.talents) {
      console.log(`STARWROUGHT | Enabled for play: ${rulesVersion.enabled.constellations} of ${rulesVersion.constellations} Constellations, ${rulesVersion.enabled.talents} of ${rulesVersion.talents} Talents.`);
    }
  } catch {
    // A system built before the sync stamp existed. Not worth a warning.
  }
}

/**
 * THE CONTENT LOOP (0.8.0; ruling 115): after Sync content has written the compendia from the pack
 * sources, read everything this module and its neighbours cached at load again, so the open world
 * sees the new content without a reload. In order: the shipped Constellation index and the sync
 * stamp (fresh, past any cache), then the registry from the pack and the world as at ready; then
 * every memoised list is forgotten and, where a reader expects it loaded, loaded again: the Basic
 * Actions, the chassis by name, the Exploration and Downtime Activities (helpers/party.mjs) and the
 * creation wizard's shop (helpers/chargen-data.mjs, only if it had been read this session). The
 * last two are reached through dynamic imports: party.mjs imports the Flare picker and
 * chargen-data.mjs imports this module, so a static import either way would close a circle. Every
 * step is fenced on its own: a list that cannot be re-read is left for its next reader, and the
 * sync that called this has already succeeded.
 * @returns {Promise<void>}
 */
export async function reloadContentIndexes() {
  // Start from an empty registry, so a Constellation the sources dropped is forgotten too: every
  // register call below adds or overrides and none removes, and a stale entry would keep offering
  // the deleted Constellation in every picker until the page reloaded (the 0.8.0 live test, where
  // a throwaway "Sync Test" outlived its own deletion). Lore instances are never in the registry,
  // so nothing a character holds is lost by this.
  for (const slug of Object.keys(SW.constellations)) delete SW.constellations[slug];
  try {
    await registerShippedIndex({ fresh: true });
  } catch (error) {
    console.warn("STARWROUGHT | the shipped Constellation index could not be re-read", error);
  }
  try {
    await readSyncStamp({ fresh: true });
  } catch {
    // As at load: a system without the stamp.
  }
  try {
    await refreshConstellationRegistry();
  } catch (error) {
    console.error("STARWROUGHT | the Constellation registry could not be refreshed", error);
  }
  invalidateBasicActions();
  invalidateChassisIndex();
  try {
    await loadChassisIndex({ fresh: true });
  } catch (error) {
    console.warn("STARWROUGHT | the chassis index could not be re-read", error);
  }
  // The terrain kinds (0.18.0): a kind added to the roster reaches the open world with the sync.
  await loadTerrainKinds({ fresh: true });
  // The Conditions (0.33.0): the workbook's rows, read again and put to work on this client. The
  // sync then tells every other connected client to do the same (helpers/content-sync.mjs).
  await loadConditions({ fresh: true });
  try {
    const { invalidateExplorationActivities } = await import("./party.mjs");
    invalidateExplorationActivities();
  } catch (error) {
    console.warn("STARWROUGHT | the Activities cache could not be forgotten", error);
  }
  try {
    const { SwContent, loadChargenContent } = await import("./chargen-data.mjs");
    if (SwContent?.loaded) await loadChargenContent({ force: true });
  } catch (error) {
    console.warn("STARWROUGHT | the creation wizard's content could not be re-read", error);
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
      fields: ["system.slug", "system.category", "system.attribute", "system.parentSlug", "system.parent", "system.group"]
    });
    for (const entry of index) {
      const parent = entry.system?.parentSlug || entry.system?.parent || "";
      SW.registerConstellation({
        slug: entry.system?.slug || SW.slugify(entry.name),
        name: entry.name,
        category: entry.system?.category ?? "general",
        attribute: entry.system?.attribute ?? "might",
        parent,
        // A group (PHB v4.21) wears its parent's rank; a parent slug alone says so too.
        group: !!entry.system?.group || !!parent,
        img: entry.img,
        uuid: entry.uuid,
        // The build writes a Constellation document only when its Root is enabled (ruling 61),
        // so being in the pack is what enabled means.
        enabled: true
      });
    }
  }
  for (const item of game.items ?? []) {
    if (item.type !== "constellation") continue;
    const slug = SW.constellationSlugOf(item);
    // A world copy that predates the field (0.3.7) stores "" here; blank is silent, not "no
    // parent", so it falls back to what the index or the pack already registered.
    const parent = item.system.parentSlug || SW.constellations[slug]?.parent || "";
    SW.registerConstellation({
      slug,
      name: item.name,
      category: item.system.category,
      attribute: item.system.attribute,
      parent,
      group: !!item.system.group || !!parent,
      img: item.img,
      uuid: item.uuid,
      // A GM authored it into the world, so it is theirs to offer.
      enabled: true
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

/**
 * The Constellations a player may be offered: every registry entry not flagged off by the
 * spreadsheets' `Enabled?` column (ruling 61). This is the list for chargen pickers and the Item
 * sheet's selects; arithmetic and display of what a character already owns go through
 * `SW.getConstellation`, which resolves disabled slugs too.
 * @returns {object[]}  Registry entries, in registration order.
 */
export function enabledConstellations() {
  return Object.values(SW.constellations).filter(c => c.enabled !== false);
}

/**
 * Is this slug enabled for play? A slug the registry does not know (a Lore instance lives only
 * on the character that opened it) is not disabled, so it reads as enabled.
 * @param {string} slug
 * @returns {boolean}
 */
export function constellationEnabled(slug) {
  return SW.constellations[slug]?.enabled !== false;
}

/* -------------------------------------------- */

/**
 * THE AUTOMATION RULES' TARGETS (0.10.0; rulings 121 and 122). What a rule's `to <Target>` or
 * `if <Constellation>` names, for the grammar's kinds: the client's counterpart of the resolver
 * `assets/build_foundry.mjs` builds over trees.json and the action sheets, handed to the same
 * grammar by `SwItem#_preUpdate` as `resolve` in the parse context, so a line typed into a world
 * Item's textarea is checked as a cell is at build time and stores the same shape.
 *
 * Constellations first, from the registry (shipped index, pack and world, disabled ones included:
 * a rule may name a Constellation that has since been switched off, and the character who holds it
 * still has it), by slug or by name, case blind. Then Maneuvers: the Actions pack's index (the
 * compendium `index` is synchronous and carries `name` and `type`, so no await and no
 * getDocuments), then world Items of type action, so a GM's own Maneuver can be named; matched on
 * the plain name (glyphs ignored, `SW.plainName`) or its slug. A Constellation wins over a
 * Maneuver of the same name (none today). The Origin (SW.ORIGIN_SLUG; PHB v4.21's shared rank)
 * answers as a Constellation though no Item carries it, since Humanity's cell names it; a
 * Constellation answer also says whether it is a group (`group`) and of what (`parent`), so a
 * kind can refuse "if Archery is Expert" naming Ranged. Null for anything else, and null before
 * `game` is ready, since the grammar must never throw for a cell's sake; the Lore refusal is the
 * kind's, not this function's, which resolves the template like any Constellation.
 * @param {string} name  As written in the cell: "Aid", "Armored Fighting", "armored-fighting".
 * @returns {{type: "constellation"|"action", slug: string, name: string, group?: boolean, parent?: string}|null}
 */
export function resolveRuleTarget(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const slug = SW.slugify(raw);

  if ((slug === SW.ORIGIN_SLUG) || (lower === SW.ORIGIN_SLUG)) {
    return { type: "constellation", slug: SW.ORIGIN_SLUG, name: "Origin", group: false, parent: "" };
  }
  for (const con of Object.values(SW.constellations)) {
    if (!con?.slug) continue;
    const conName = String(con.name ?? "").trim().toLowerCase();
    if ((con.slug === slug) || (con.slug === lower) || (conName && (conName === lower))) {
      const parent = con.parent ?? "";
      return {
        type: "constellation", slug: con.slug, name: con.name ?? con.slug,
        group: !!con.group || !!parent,
        parent: parent ? (SW.getConstellation(parent)?.name ?? parent) : "",
        // The category (0.16.0): a `[<Constellation> trained]` point's scope word comes from it. The
        // system's key ("skill", "combatStyle"), which the kind reads beside the index's word.
        category: String(con.category ?? "")
      };
    }
  }

  const plain = SW.plainName(raw).toLowerCase();
  const asAction = entry => {
    const entryName = SW.plainName(entry?.name ?? "");
    return { type: "action", slug: SW.slugify(entryName), name: entryName };
  };
  const matches = entry => {
    if (!entry || ((entry.type ?? "action") !== "action")) return false;
    const entryName = SW.plainName(entry.name ?? "");
    return (entryName.toLowerCase() === plain) || (SW.slugify(entryName) === slug);
  };
  try {
    const game = globalThis.game;
    const index = game?.packs?.get?.(`${SW.SYSTEM_ID}.actions`)?.index;
    for (const entry of index ?? []) {
      if (matches(entry)) return asAction(entry);
    }
    for (const item of game?.items ?? []) {
      if (matches(item)) return asAction(item);
    }
  } catch {
    // `game` not ready, or a pack mid-sync: no answer rather than a throw inside a parse.
  }
  return null;
}

/* -------------------------------------------- */

let basicActions = null;

/**
 * The Basic Actions: everything in the Actions compendium flagged `system.basic`, which is what
 * every character can do without owning a copy. They are authored in data/maneuvers.xlsx (the one
 * actions workbook since Mike moved Aid into it on 2026-10-03; until its rows are enabled, the
 * roster's Encounter Mode rows stand in), so the compendium is the one source
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

/**
 * The Maneuver of this name for this actor (0.25.0; in documents/item.mjs through 0.36.0): the
 * actor's own copy (one a Talent granted, or a GM's), else the Basic Maneuver every character has
 * (the Actions pack's, with a world Item of the same name standing in for the printed one), else
 * any world Maneuver, else the pack's document by its index. Read by a Maneuver that performs
 * another (`SwItem##performSubordinate`) and, since 0.37.0, by Recenter, whose own code reads its
 * row's traits to know whether a Condition raises its cost (`SwActor#recenterCost`).
 * @param {Actor|null} actor
 * @param {string} slug  `slugify(plainName(name))`.
 * @returns {Promise<Item|null>}
 */
export async function findManeuver(actor, slug) {
  const slugOf = name => SW.slugify(SW.plainName(name ?? ""));
  const is = item => (item?.type === "action") && (slugOf(item.name) === slug);
  const owned = actor?.items?.find(is);
  if (owned) return owned;
  const basic = (await loadBasicActions()).find(is);
  if (basic) return basic;
  const world = game.items?.find(is);
  if (world) return world;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.actions`);
  if (!pack) return null;
  const entry = (await pack.getIndex()).find(e => slugOf(e.name) === slug);
  return entry ? pack.getDocument(entry._id) : null;
}

/* -------------------------------------------- */

/** The name the Equipment compendium prints for the weapon every character has (0.29.0). */
export const UNARMED_STRIKE_NAME = "Unarmed Strike";

/**
 * THE UNARMED STRIKE, READY TO GIVE (0.29.0, ruling 294; Mike, by question: "Give every character
 * one now"). The Equipment compendium's Unarmed Strike as plain Item data, for the one-time update
 * that gives it to every existing character (starwrought.mjs, `migrateWorld`) and for a character's
 * creation (documents/actor.mjs, `_preCreate`). A world weapon of the same name stands over the
 * printed one, as a GM's rewrite of a Basic Maneuver does. Null when neither can be read (the pack
 * missing, not compiled, or hidden from this user): the caller gives nothing, and a drag from the
 * compendium still can (the one-time step leaves the world's stamp short when it could not read
 * the pack, so it alone tries again). The copy is the character's own to edit (a better fist).
 * @returns {Promise<object|null>}
 */
export async function unarmedStrikeData() {
  const named = item => (item?.type === "weapon") && SW.sameName(item.name, UNARMED_STRIKE_NAME);
  let source = [...(game.items ?? [])].find(named) ?? null;
  if (!source) {
    const pack = game.packs.get(`${SW.SYSTEM_ID}.equipment`);
    if (!pack) return null;
    const index = pack.index?.size ? pack.index : await pack.getIndex();
    const entry = [...index].find(named);
    source = entry ? await pack.getDocument(entry._id) : null;
  }
  if (!source) return null;
  const data = game.items.fromCompendium(source, { clearFolder: true });
  delete data._id;
  delete data.folder;
  return data;
}

/* -------------------------------------------- */

let chassisIndex = null;
const CHASSIS_PATH = "systems/starwrought/content/chassis.json";

/**
 * The chassis (Ancestries, Bloodlines, Cultures, Backgrounds, Callings) by name, so a sheet can
 * say what the name on it means: a character stores the names it chose at creation, not the
 * Items (Mike, 2026-10-01: the locked fields explain themselves). Three sources, each overriding
 * the last: the shipped index, which holds every authored chassis whether or not the Enabled?
 * column let it into the pack (a Soldier stays a Soldier after Backgrounds are switched off); the
 * compendium; and a world Item of the same name, as the Basic Actions do. An index entry is a
 * plain record shaped like an Item ({name, img, system}), so a reader needs no second code path.
 * `fresh` adds a cache-busting query to the shipped index, for the re-read after a content sync
 * (0.8.0); the pack and the world are always read live.
 * @param {{fresh?: boolean}} [options]
 * @returns {Promise<Map<string, Item|object>>}  Lowercased name to the unowned Item or record.
 */
export async function loadChassisIndex({ fresh = false } = {}) {
  if (chassisIndex) return chassisIndex;
  const byName = new Map();
  try {
    const url = fresh ? `${CHASSIS_PATH}?t=${Date.now()}` : CHASSIS_PATH;
    for (const entry of await foundry.utils.fetchJsonWithTimeout(url) ?? []) {
      byName.set(String(entry.name).toLowerCase(), { ...entry, type: "chassis", shipped: true });
    }
  } catch {
    // A system built before the index existed; the pack alone still answers for what it holds.
  }
  const pack = game.packs.get(`${SW.SYSTEM_ID}.chassis`);
  if (pack) {
    for (const item of await pack.getDocuments()) {
      if (item.type === "chassis") byName.set(item.name.toLowerCase(), item);
    }
  }
  for (const item of game.items ?? []) {
    if (item.type === "chassis") byName.set(item.name.toLowerCase(), item);
  }
  chassisIndex = byName;
  return chassisIndex;
}

/** The chassis Item behind a name, once the index is loaded; null before that or for a name it lacks. */
export function chassisByName(name) {
  if (!name || !chassisIndex) return null;
  return chassisIndex.get(String(name).trim().toLowerCase()) ?? null;
}

/** Forget the chassis, so a GM's new world chassis is read on the next sheet render. */
export function invalidateChassisIndex() {
  chassisIndex = null;
}

/* -------------------------------------------- */

const TERRAIN_PATH = "systems/starwrought/content/terrain.json";

/**
 * The kinds of difficult terrain (0.18.0): the roster's hand-kept `terrainKinds` block, which
 * `build_foundry.mjs` writes to content/terrain.json as the registry's records, read into
 * `SW.TERRAIN_KINDS` (module/config/terrain.mjs). Called at init, before the world's documents are
 * built, so a region's Kind select, the overlay, the ruler and the `ignore` kind read the roster's
 * names; and again, `fresh`, after a content sync, so a kind Mike adds reaches the open world with
 * the rest of the content. A file that cannot be read leaves the registry as it was (empty on a
 * first load: a region then draws in the fallback colour with its slug title-cased, and the
 * behavior's `kind` field does not gate on the list, so nothing becomes invalid).
 * @param {{fresh?: boolean}} [options]
 * @returns {Promise<number>}  How many kinds are registered now.
 */
export async function loadTerrainKinds({ fresh = false } = {}) {
  try {
    // Keyed on the system's version at init, so a release never reads the last one's file from the
    // browser's cache, and on the clock after a sync, so a content loop's new row reaches an open
    // world without a hard reload (0.18.1; the first load went uncached through 0.18.0).
    const url = `${TERRAIN_PATH}?v=${encodeURIComponent(fresh ? Date.now() : (game.system?.version ?? SW.SYSTEM_VERSION))}`;
    const rows = await foundry.utils.fetchJsonWithTimeout(url);
    const count = SW.registerTerrainKinds(rows);
    console.log(`STARWROUGHT | Registered ${count} kinds of difficult terrain.`);
    return count;
  } catch (error) {
    console.warn("STARWROUGHT | Could not read the difficult terrain kinds (content/terrain.json); the registry stands as it was.", error);
    return Object.keys(SW.TERRAIN_KINDS).length;
  }
}

/* -------------------------------------------- */
/*  The Conditions (0.33.0)                     */
/* -------------------------------------------- */

const CONDITIONS_PATH = "systems/starwrought/content/conditions.json";

/** What the last load of the Conditions found: `ok`, the file's `build` hash, how many, the error. */
const conditionsState = { ok: false, build: "", count: 0, created: [], error: null, loaded: false };
/** The load in flight, or the last one finished: `ready` waits on it before the world is used. */
let conditionsLoad = null;
/** Is a load in flight? A second ask while one runs joins it (the socket may ask at any time). */
let conditionsLoading = false;
/** How many reads have finished, and the last one whose failure was said: one notice for each. */
let conditionsReads = 0;
let conditionsSaid = 0;

/** The Conditions' state, for a reader that wants to know whether the workbook was read. */
export function conditionsLoaded() {
  return { ...conditionsState };
}

/**
 * The token palette's list, from the registry: one status for each Condition, under the static id
 * `SwActor#setCondition` creates under too. Built from the built-ins at init (the hook cannot
 * wait for a file) and again once the workbook's rows are registered, when a new Condition
 * (Supine) joins it and a built-in takes the name its row gives it.
 * @returns {object[]}
 */
export function statusEffectList() {
  return Object.values(SW.CONDITIONS).map(c => ({
    id: c.id,
    name: SW.conditionNameKey(c.id),
    img: c.img,
    _id: SW.statusEffectId(c.id)
  }));
}

/**
 * THE CONDITIONS (0.33.0; rulings 322 and 323): `data/conditions.xlsx`, which the build writes to
 * content/conditions.json as the registry's rows, laid over the Conditions the system ships with
 * (`SW.registerConditions`; module/config/conditions.mjs). Read at init, awaited at ready, and
 * again after a content sync, ALWAYS past the browser's cache: the file moves with the content
 * loop, between releases, and a stale copy would be last week's rules.
 *
 * On success the palette's list is rebuilt, and, once the world is up, every creature that has a
 * Condition (or a Wounded or struck Torso, which is Off-Guard) is prepared again, since its
 * numbers were worked out before these rows were known; open sheets redraw.
 *
 * A file that cannot be read, or rows the registry refuses, leave the registry as it was and say
 * so LOUDLY to the GM: the system then runs on the Conditions it ships with, whose numbers are
 * the ones it had before the workbook (ruling 329), and a Condition a row made does not exist.
 * @param {{fresh?: boolean}} [options]  Kept for the callers' symmetry; the read is always fresh.
 * @returns {Promise<object>}  `conditionsLoaded()`.
 */
export function loadConditions(options = {}) {
  // One read at a time: `content:conditions` may arrive from any client at any moment, and a
  // second fetch while one is in flight would only register the same file twice.
  if (conditionsLoading && conditionsLoad) return conditionsLoad;
  conditionsLoading = true;
  conditionsLoad = (async () => {
    try {
      const json = await foundry.utils.fetchJsonWithTimeout(`${CONDITIONS_PATH}?t=${Date.now()}`);
      if (!json || !Array.isArray(json.conditions)) throw new Error("the file holds no list of Conditions");
      const answer = SW.registerConditions(json.conditions);
      Object.assign(conditionsState, { ok: true, build: String(json.build ?? ""), count: json.conditions.length, created: answer.created, error: null, loaded: true });
      console.log(`STARWROUGHT | Registered ${json.conditions.length} Conditions from the workbook`
        + (answer.created.length ? ` (${answer.created.map(id => SW.conditionLabel(id)).join(", ")} made by ${answer.created.length === 1 ? "its row" : "their rows"})` : "")
        + `, build ${conditionsState.build || "?"}.`);
      if (answer.missing.length) {
        console.warn(`STARWROUGHT | The Conditions file has no row for ${answer.missing.join(", ")}; those run on the system's own text.`);
      }
    } catch (error) {
      Object.assign(conditionsState, { ok: false, error: String(error?.message ?? error), loaded: true });
      console.error("STARWROUGHT | The Conditions could not be read (content/conditions.json); the registry stands as it was.", error);
    }
    conditionsLoading = false;
    conditionsReads += 1;
    applyConditions();
    return conditionsLoaded();
  })();
  return conditionsLoad;
}

/** Wait for the Conditions' load that init began (or the last one asked for). */
export async function conditionsReady() {
  try { await conditionsLoad; } catch { /* said by loadConditions */ }
  return conditionsLoaded();
}

/**
 * Put the registry to work: the palette's list, and, once the world is up, the creatures whose
 * numbers a Condition moves, prepared again, with the open sheets redrawn. Safe at any time.
 */
export function applyConditions() {
  try {
    CONFIG.statusEffects = statusEffectList();
  } catch (error) {
    console.error("STARWROUGHT | the status list could not be rebuilt", error);
  }
  if (!globalThis.game?.ready) return;
  refreshConditionHolders();
  // A read that failed is said once (`ready` and the read itself both come here), to the GM in
  // a notice that stays, and to a player too: a client that could not read the Conditions works
  // out its own sheet and its own dice from the system's old numbers, which would disagree with
  // the GM's reading of the same attack (the review of 0.33.0).
  if (!conditionsState.ok && conditionsState.loaded && (conditionsSaid !== conditionsReads)) {
    conditionsSaid = conditionsReads;
    // Two cases, said apart: nothing was ever read (the system runs on the Conditions it ships
    // with), or an earlier read stands and only this one failed (those rows are still in force).
    const key = SW.conditionsRegistered() ? "STARWROUGHT.Conditions.notReadAgain" : "STARWROUGHT.Conditions.notRead";
    const message = game.i18n.format(key, { reason: conditionsState.error ?? "" });
    if (game.user?.isGM) ui.notifications.error(message, { permanent: true });
    else ui.notifications.warn(`${message} ${game.i18n.localize("STARWROUGHT.Conditions.notReadPlayer")}`, { permanent: true });
  }
}

/** Does anything on this Actor make a Condition's lines matter: a status, or a Torso that is Off-Guard? */
function holdsAnyCondition(actor) {
  if (!actor || (actor.type === SW.PARTY_TYPE)) return false;
  if (actor.statuses?.size) return true;
  const torso = actor.system?.zones?.torso;
  return !!torso && (((Number(torso.wounds) || 0) > 0) || (torso.critical === true));
}

/**
 * Prepare again every creature a Condition's lines reach: the world's Actors, the unlinked tokens'
 * own Actors on EVERY scene (a Bandit on the map is one; the scene in view first) and every
 * fighter in a Combat, then redraw what shows them. Every scene, as the 0.29.0 migration walks
 * them (the review of 0.33.0: with the scene in view alone, a Frightened Bandit on a scene the
 * GM had left kept its old numbers after a sync until something else touched it).
 */
function refreshConditionHolders() {
  const seen = new Set();
  const refresh = actor => {
    if (!actor || seen.has(actor)) return;
    seen.add(actor);
    if (!holdsAnyCondition(actor)) return;
    try {
      actor.reset();
      for (const app of Object.values(actor.apps ?? {})) app?.render?.();
    } catch (error) {
      console.error(`STARWROUGHT | ${actor.name}: could not be prepared again for the Conditions`, error);
    }
  };
  for (const actor of game.actors ?? []) refresh(actor);
  const viewed = globalThis.canvas?.scene ?? null;
  for (const scene of [viewed, ...[...(game.scenes ?? [])].filter(s => s !== viewed)]) {
    for (const token of scene?.tokens ?? []) {
      if (!token.actorLink) refresh(token.actor);
    }
  }
  for (const combat of game.combats ?? []) {
    for (const combatant of combat.combatants ?? []) refresh(combatant.actor);
  }
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
