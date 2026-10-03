/**
 * Sync content (0.8.0): the open world's compendia brought level with the pack sources on disk,
 * without a restart (the content-loop brief, Mike 2026-10-03; rulings 115 to 117).
 *
 * Mike's loop is: add rows to a spreadsheet, run `node assets/build_all.mjs --content`, and have
 * the new content in the web app and in the open Foundry world. The build writes the pack SOURCES
 * (`packs/_source/<pack>/*.json`) and an index of them (`packs/_source/index.json`: every document
 * and folder by id with a content hash, and one `build` hash over all of them) but never compiles
 * the LevelDB packs, because Foundry holds those open; the compiled packs are a release artifact,
 * rebuilt by the full pipeline with Foundry closed and read by a fresh install before its first
 * sync (ruling 115). This module is the other half of the loop: it reads the index over HTTP (the
 * system folder is served as static files), diffs it against the world's compendia by document id
 * and content hash, shows the plan by name, and applies it with each pack unlocked for the moment
 * of the write and locked again (ruling 116). Document ids hash the pack and the key, so a
 * document keeps its id across builds and its UUID on every sheet; the hash
 * (`flags.starwrought.contentHash`) says whether it changed. A document in a system pack that the
 * sources no longer carry is stale and is deleted, by name in the plan first: a GM's own content
 * belongs in the world, not in the system's packs. Optionally the same sync refreshes the
 * characters' owned copies of changed Items while keeping each copy's own state (ruling 117).
 *
 * Three exports do the work and are what a macro would call: `fetchContentIndex`,
 * `planContentSync` and `applyContentSync`. `ContentSync` is the window over them (the Settings
 * menu entry, the offer at load in starwrought.mjs, `game.starwrought.syncContent()`), GM only,
 * one at a time. Everything fails soft: a missing index is a notice and null, a file that cannot be
 * read is an error line in the result and the build is not recorded (the offer at load comes again
 * while the compendia still differ; a failure in the copies alone is retried from Settings, since
 * the compendia are level and the offer is quiet); a pack is never left unlocked, whatever
 * happened inside the write.
 */

import * as SW from "../config.mjs";
import { cardHtml } from "../documents/combat.mjs";
import { reloadContentIndexes } from "../helpers/content.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { escapeHTML, getProperty, setProperty, hasProperty, deepClone } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

const TEMPLATE = "systems/starwrought/templates/apps/content-sync.hbs";

/** The flag the builder stamps on every document and folder: the SHA-1 of its canonical content. */
const HASH_FLAG = "contentHash";
const HASH_PATH = `flags.${SW.SYSTEM_ID}.${HASH_FLAG}`;
/** The two world settings the sync records (registered in starwrought.mjs). */
const SETTING_BUILD = "contentBuild";
const SETTING_STAMP = "contentStamp";
/** Source files fetched at once. Hundreds of small files; a few dozen in flight is plenty. */
const FETCH_BATCH = 24;

/**
 * The fields of an owned copy that are the character's own and survive a refresh (ruling 117):
 * how many they carry, where it is (held, worn, carried), whether the shield is Raised, the option
 * a Talent's build-time Choice recorded, a weapon's Combat Style (the "write it on your sheet" of
 * the Strike Attribute), whether it is held in two hands and which face of a Versatile weapon is
 * up, an adversary's attack block on an action (never written by the builder), and a consumable's
 * remaining uses. Written back from the copy onto the source's `system` wherever the copy's stored
 * data has the path, so a Talent is never given a quantity and a weapon never a Choice. A Lore
 * instance's placement (`system.constellation` naming "lore-warfare" on a Talent cloned from the
 * Lore template, or the `slug` and name of a Lore (X) Constellation Item) is the character's own
 * too, and copyUpdate keeps it (the review of 0.8.0).
 */
const PRESERVED_PATHS = Object.freeze([
  "quantity", "state", "raised", "choice.value", "style", "twoHands", "versatileActive", "attack", "uses.value", "uses.max"
]);

/* -------------------------------------------- */
/*  The index                                   */
/* -------------------------------------------- */

/**
 * Read `packs/_source/index.json` from the server, past any cache. Null, with a notice, when it is
 * not there or not an index: a checkout that has never run the content build has no index, and a
 * world on such a system simply has nothing to sync.
 * @param {{notify?: boolean}} [options]  Say so in a notification (the load offer stays quiet).
 * @returns {Promise<object|null>}
 */
export async function fetchContentIndex({ notify = true } = {}) {
  try {
    const index = await foundry.utils.fetchJsonWithTimeout(`${SW.CONTENT_INDEX_PATH}?t=${Date.now()}`);
    if (!index || (typeof index !== "object") || !index.packs || (typeof index.packs !== "object")) {
      throw new Error("the file is not a content index");
    }
    return index;
  } catch (error) {
    console.warn("STARWROUGHT | the content index could not be read", error);
    if (notify) ui.notifications.warn(localize("STARWROUGHT.Content.noIndex"));
    return null;
  }
}

/** The content hash a document or folder carries, from a Document, an index entry or raw data. */
function hashOf(doc) {
  const value = getProperty(doc ?? {}, HASH_PATH) ?? getProperty(doc?._source ?? {}, HASH_PATH);
  return (typeof value === "string") && value ? value : null;
}

/** The compendium collection name of a pack the index names. */
function packKey(name) {
  return `${SW.SYSTEM_ID}.${name}`;
}

/**
 * A date and time for a stamp, in the user's locale; the raw text when it is not a date. Exported
 * for the load offer in starwrought.mjs, so the dialog and the window print the same moment the
 * same way.
 * @param {string} stamp  An ISO time.
 * @returns {string}
 */
export function formatWhen(stamp) {
  if (!stamp) return "";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return String(stamp);
  try {
    return date.toLocaleString(game.i18n.lang, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return date.toLocaleString();
  }
}

/** The first eight characters of a build hash, which is all a reader needs to tell two apart. */
function shortHash(hash) {
  return String(hash ?? "").slice(0, 8);
}

/* -------------------------------------------- */
/*  The plan                                    */
/* -------------------------------------------- */

/**
 * Diff one kind of thing (documents or folders) between what the index wants and what the pack
 * holds. Create is an id the pack lacks; update is an id whose stored hash differs from the
 * index's, or is absent (a pack compiled before 0.8.0 carries none, so its first plan updates
 * everything, which is what stamps the hashes in); delete is an id the index no longer names. An
 * index entry without a hash (a document the builder does not hash) has nothing to compare, so it
 * is created when missing and otherwise left as it is.
 * @param {object[]} wanted             Index entries: {_id, name, type?, file, hash}.
 * @param {Map<string, {name: string, hash: string|null}>} stored  By id, what the pack holds.
 * @returns {{create: object[], update: object[], delete: object[]}}
 */
function diffEntries(wanted, stored) {
  const create = [];
  const update = [];
  const remove = [];
  const wantedIds = new Set();
  for (const entry of wanted) {
    if (!entry?._id) continue;
    // Named by the index, so never stale; without a file there is nothing to write it from.
    wantedIds.add(entry._id);
    if (!entry.file) continue;
    const row = { _id: entry._id, name: String(entry.name ?? entry._id), type: entry.type ?? "", file: entry.file, hash: entry.hash ?? null };
    const have = stored.get(entry._id);
    if (!have) {
      create.push(row);
      continue;
    }
    if (!row.hash) continue;
    if (have.hash !== row.hash) update.push(row);
  }
  for (const [id, have] of stored) {
    if (!wantedIds.has(id)) remove.push({ _id: id, name: have.name });
  }
  return { create, update, delete: remove };
}

/**
 * The plan: per pack the index names that this world has, what would be created, updated and
 * deleted, documents and folders alike, every entry with its name so the plan reads; the packs the
 * world lacks, listed as skipped; and the owned copies a refresh would touch (ruling 117).
 * Nothing is written.
 * @param {object} index  From fetchContentIndex.
 * @returns {Promise<object>}  See the shape assembled below; `empty` when no pack has work.
 */
export async function planContentSync(index) {
  const plan = {
    build: String(index?.build ?? ""),
    stamp: String(index?.stamp ?? ""),
    system: String(index?.system ?? ""),
    packs: [],
    skipped: [],
    counts: { create: 0, update: 0, delete: 0 },
    empty: true,
    /** Every Item-pack index entry by id: {pack, entry}, for the copies. */
    indexById: new Map(),
    /** "type|lowercased name" to the same, for a copy with no recorded source. */
    byTypeName: new Map(),
    copies: { count: 0, actorCount: 0, actors: [], names: [] }
  };

  for (const [name, entry] of Object.entries(index?.packs ?? {})) {
    const pack = game.packs.get(packKey(name));
    const documents = Array.isArray(entry?.documents) ? entry.documents : [];
    const folders = Array.isArray(entry?.folders) ? entry.folders : [];
    if (!pack) {
      plan.skipped.push({ name, label: name, documents: documents.length });
      continue;
    }
    const label = pack.title ?? pack.metadata?.label ?? name;

    let stored;
    try {
      const packIndex = await pack.getIndex({ fields: [HASH_PATH, "folder", "type"] });
      stored = new Map();
      for (const e of packIndex) stored.set(e._id, { name: e.name, hash: hashOf(e) });
    } catch (error) {
      console.error(`STARWROUGHT | the index of ${pack.collection} could not be read`, error);
      plan.skipped.push({ name, label, documents: documents.length, error: error.message });
      continue;
    }
    const storedFolders = new Map();
    for (const folder of pack.folders ?? []) storedFolders.set(folder.id, { name: folder.name, hash: hashOf(folder) });

    const docs = diffEntries(documents, stored);
    const fols = diffEntries(folders, storedFolders);
    const counts = {
      create: docs.create.length + fols.create.length,
      update: docs.update.length + fols.update.length,
      delete: docs.delete.length + fols.delete.length
    };
    const work = counts.create + counts.update + counts.delete;
    plan.packs.push({
      name,
      key: pack.collection,
      label,
      documentName: pack.documentName,
      locked: pack.locked,
      documents: docs,
      folders: fols,
      counts,
      work
    });
    plan.counts.create += counts.create;
    plan.counts.update += counts.update;
    plan.counts.delete += counts.delete;
    if (work > 0) plan.empty = false;

    if (pack.documentName === "Item") {
      for (const e of documents) {
        if (!e?._id || !e.file) continue;
        const row = { _id: e._id, name: String(e.name ?? e._id), type: e.type ?? "", file: e.file, hash: e.hash ?? null };
        plan.indexById.set(e._id, { pack: name, entry: row });
        const byName = `${row.type}|${row.name.trim().toLowerCase()}`;
        if (!plan.byTypeName.has(byName)) plan.byTypeName.set(byName, { pack: name, entry: row });
      }
    }
  }

  plan.copies = planCopyRefresh(plan);
  return plan;
}

/**
 * The source of an owned copy: its recorded compendium source (`_stats.compendiumSource`, or the
 * older `flags.core.sourceId`) when it names one of this system's packs and the index still has
 * the id; a copy recorded as coming from any other compendium is somebody else's and is left
 * alone; a copy with no record at all is matched by type and name, case-insensitive, in any pack
 * (ruling 117), as the 0.5.1 aura migration matched.
 * @param {Item} item
 * @param {object} plan
 * @returns {{pack: string, entry: object}|null}
 */
function sourceOf(item, plan) {
  const recorded = String(item._stats?.compendiumSource || item.flags?.core?.sourceId || "");
  if (recorded) {
    const match = /^Compendium\.([^.]+)\.([^.]+)\.(?:Item\.)?([A-Za-z0-9]+)$/.exec(recorded);
    if (!match || (match[1] !== SW.SYSTEM_ID)) return null;
    const found = plan.indexById.get(match[3]);
    return (found && (found.pack === match[2])) ? found : null;
  }
  return plan.byTypeName.get(`${item.type}|${String(item.name ?? "").trim().toLowerCase()}`) ?? null;
}

/**
 * The owned copies a refresh would touch: for every world Actor (character, adversary and party
 * alike; the party's loot is a copy too), every embedded Item whose source resolves and whose
 * stored hash is not the index's. Unlinked token actors are synthetic and never in `game.actors`,
 * so nothing here reaches them. A copy that already carries the index's hash is level, whether or
 * not the pack behind it is; a copy without a hash (dragged before 0.8.0) is refreshed once, which
 * stamps it.
 * @param {object} plan
 * @returns {{count: number, actorCount: number, actors: object[], names: string[]}}
 */
function planCopyRefresh(plan) {
  const actors = [];
  let count = 0;
  for (const actor of game.actors ?? []) {
    const items = [];
    for (const item of actor.items ?? []) {
      const found = sourceOf(item, plan);
      if (!found?.entry?.hash) continue;
      if (hashOf(item) === found.entry.hash) continue;
      items.push({ item, pack: found.pack, entry: found.entry });
    }
    if (!items.length) continue;
    actors.push({ actor, name: actor.name, items });
    count += items.length;
  }
  return { count, actorCount: actors.length, actors, names: actors.map(a => a.name) };
}

/* -------------------------------------------- */
/*  Apply                                       */
/* -------------------------------------------- */

/**
 * Take every `_key` out of a source document, at the top and inside its embedded collections
 * (a journal's pages carry their own). `_key` is the LevelDB key the compiler reads; the data
 * model has no field for it.
 */
function stripKeys(value) {
  if (Array.isArray(value)) {
    for (const v of value) stripKeys(v);
    return value;
  }
  if (value && (typeof value === "object")) {
    delete value._key;
    for (const v of Object.values(value)) stripKeys(v);
  }
  return value;
}

/**
 * Fetch one source document, keyed by pack and file, once per apply. The file must carry the id
 * the index names it under: a mismatch means the index and the files disagree (a build ran while
 * the sync was reading), and the row is skipped rather than written under the wrong id. A source
 * the builder did not hash is stamped with the index's hash, so the pack converges and the next
 * plan is clean.
 * @param {Map<string, Promise<object>>} cache
 * @param {string} packName
 * @param {{_id: string, file: string, hash: string|null}} row
 * @returns {Promise<object>}
 */
function fetchSource(cache, packName, row) {
  const key = `${packName}/${row.file}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const url = `${SW.CONTENT_SOURCE_PATH}/${encodeURIComponent(packName)}/${encodeURIComponent(row.file)}?t=${Date.now()}`;
      const data = await foundry.utils.fetchJsonWithTimeout(url);
      if (!data || (typeof data !== "object") || (data._id !== row._id)) {
        throw new Error(format("STARWROUGHT.Content.indexMismatch", { file: row.file }));
      }
      stripKeys(data);
      if (row.hash && !hashOf(data)) setProperty(data, HASH_PATH, row.hash);
      return data;
    })());
  }
  return cache.get(key);
}

/**
 * Fetch the sources of a list of rows, a batch at a time. A file that fails is an error line and
 * is left out; the rest go on.
 * @returns {Promise<object[]>}
 */
async function fetchSources(cache, packName, rows, errors, where) {
  const out = [];
  for (let i = 0; i < rows.length; i += FETCH_BATCH) {
    const slice = rows.slice(i, i + FETCH_BATCH);
    const settled = await Promise.allSettled(slice.map(row => fetchSource(cache, packName, row)));
    settled.forEach((outcome, n) => {
      if (outcome.status === "fulfilled") out.push(outcome.value);
      else {
        console.error(`STARWROUGHT | ${where}: ${slice[n].file}`, outcome.reason);
        errors.push({ where, name: slice[n].name, message: outcome.reason?.message ?? String(outcome.reason) });
      }
    });
  }
  return out;
}

/**
 * A source document as an update: whole-document replacement under its id, less what an update
 * may not carry. `type` cannot change on an update (and a changed type is a new id anyway, since
 * ids hash the key); `_stats` is the server's; the embedded collections (`effects`, `pages`) are
 * left out, since every Item source ships `effects: []` and a journal with pages is replaced
 * whole by applyPack instead. Applied with `recursive: false, diff: false`, so `system` and
 * `flags` become exactly the source's and a key the source dropped leaves the stored document.
 */
function asUpdate(data) {
  const { _key, type, _stats, effects, pages, ...rest } = data;
  return rest;
}

/** The Document class of a pack: our subclass where the system registers one. */
function documentClassOf(pack) {
  return CONFIG[pack.documentName]?.documentClass ?? foundry.utils.getDocumentClass?.(pack.documentName) ?? globalThis[pack.documentName];
}

/**
 * Apply one pack's part of the plan: unlock, folders first (created and updated), then the
 * documents (created, updated, deleted), then the stale folders last, then the lock back where it
 * was. A JournalEntry whose hash changed is deleted and created again under the same id rather
 * than updated, so its pages follow the source exactly (`keepEmbeddedIds` keeps every page id, so
 * links into the Rules Reference hold). Every write is counted; every failure is an error line
 * and the pack still gets its lock back.
 */
async function applyPack(packPlan, plan, { cache, result, say }) {
  const pack = game.packs.get(packPlan.key);
  const done = {
    name: packPlan.name, label: packPlan.label,
    create: 0, update: 0, delete: 0,
    folders: { create: 0, update: 0, delete: 0 }
  };
  result.packs.push(done);
  if (!pack) {
    result.errors.push({ where: packPlan.label, name: "", message: localize("STARWROUGHT.Content.packGone") });
    return;
  }
  const cls = documentClassOf(pack);
  const Folder = CONFIG.Folder?.documentClass ?? globalThis.Folder;
  const operation = { pack: pack.collection };
  const wasLocked = pack.locked;
  try {
    if (wasLocked) await pack.configure({ locked: false });

    // Folders first, so a created document has its folder to land in.
    if (packPlan.folders.create.length || packPlan.folders.update.length) {
      say(format("STARWROUGHT.Content.progressFolders", { pack: packPlan.label }));
      const created = await fetchSources(cache, packPlan.name, packPlan.folders.create, result.errors, packPlan.label);
      if (created.length) {
        await Folder.createDocuments(created, { ...operation, keepId: true });
        done.folders.create += created.length;
      }
      const updated = await fetchSources(cache, packPlan.name, packPlan.folders.update, result.errors, packPlan.label);
      if (updated.length) {
        await Folder.updateDocuments(updated.map(asUpdate), { ...operation, recursive: false, diff: false });
        done.folders.update += updated.length;
      }
    }

    if (packPlan.documents.create.length) {
      say(format("STARWROUGHT.Content.progressCreate", { pack: packPlan.label, count: packPlan.documents.create.length }));
      const created = await fetchSources(cache, packPlan.name, packPlan.documents.create, result.errors, packPlan.label);
      if (created.length) {
        await cls.createDocuments(created, { ...operation, keepId: true });
        done.create += created.length;
      }
    }

    if (packPlan.documents.update.length) {
      say(format("STARWROUGHT.Content.progressUpdate", { pack: packPlan.label, count: packPlan.documents.update.length }));
      const updated = await fetchSources(cache, packPlan.name, packPlan.documents.update, result.errors, packPlan.label);
      if (updated.length) {
        if (pack.documentName === "JournalEntry") {
          // Pages are an embedded collection; replace the entry whole, under the same ids.
          await cls.deleteDocuments(updated.map(d => d._id), operation);
          await cls.createDocuments(updated, { ...operation, keepId: true });
        } else {
          await cls.updateDocuments(updated.map(asUpdate), { ...operation, recursive: false, diff: false });
        }
        done.update += updated.length;
      }
    }

    if (packPlan.documents.delete.length) {
      say(format("STARWROUGHT.Content.progressDelete", { pack: packPlan.label, count: packPlan.documents.delete.length }));
      await cls.deleteDocuments(packPlan.documents.delete.map(d => d._id), operation);
      done.delete += packPlan.documents.delete.length;
    }

    // Stale folders last, once nothing is left in them.
    if (packPlan.folders.delete.length) {
      await Folder.deleteDocuments(packPlan.folders.delete.map(f => f._id), operation);
      done.folders.delete += packPlan.folders.delete.length;
    }
  } catch (error) {
    console.error(`STARWROUGHT | Sync content: ${packPlan.label}`, error);
    result.errors.push({ where: packPlan.label, name: "", message: error.message });
  } finally {
    if (wasLocked) {
      try {
        await pack.configure({ locked: true });
      } catch (error) {
        console.error(`STARWROUGHT | ${packPlan.label} could not be locked again`, error);
        result.errors.push({ where: packPlan.label, name: "", message: format("STARWROUGHT.Content.lockRestoreFailed", { pack: packPlan.label }) });
      }
    }
  }
}

/**
 * The update that refreshes one owned copy from its source (ruling 117): the source's name, image
 * and `system`, with the character's own fields written back from the copy's stored data wherever
 * the copy has them; the copy's flags kept whole (its recorded source among them) with the content
 * hash set to the index's. Applied with `recursive: false, diff: false`, so the copy's `system` is
 * the source's and nothing else on the copy (its id, its Active Effects, its sort) moves.
 */
function copyUpdate(item, source, hash) {
  const stored = item._source ?? item.toObject();
  const system = deepClone(source.system ?? {});
  for (const path of PRESERVED_PATHS) {
    if (!hasProperty(stored.system ?? {}, path)) continue;
    setProperty(system, path, getProperty(stored.system, path));
  }
  let name = source.name ?? stored.name;
  // A Lore opened for a character is a clone of the Lore template with its own Constellation
  // ("lore-warfare", "Lore (Warfare)"), recorded nowhere but on the clone; the refresh takes the
  // template's text and keeps the placement, else every Lore would collapse back into "Lore".
  const placed = String(stored.system?.constellation ?? "");
  if ((item.type === "talent") && SW.isLoreSlug(placed) && (placed !== "lore")) {
    system.constellation = placed;
    if (stored.system?.constellationName !== undefined) system.constellationName = stored.system.constellationName;
  }
  const slug = String(stored.system?.slug ?? "");
  if ((item.type === "constellation") && SW.isLoreSlug(slug) && (slug !== "lore")) {
    system.slug = slug;
    name = stored.name;
  }
  const flags = deepClone(stored.flags ?? {});
  setProperty(flags, `${SW.SYSTEM_ID}.${HASH_FLAG}`, hash ?? hashOf(source) ?? "");
  return { _id: item.id, name, img: source.img ?? stored.img, system, flags };
}

/**
 * Refresh the characters' copies the plan found, one Actor at a time, each as a single
 * updateEmbeddedDocuments so a sheet re-renders once. `swAnnounced` keeps the audit quiet: a
 * refresh is the content moving, not a hand edit.
 */
async function refreshCopies(plan, { cache, result, say }) {
  for (const { actor, name, items } of plan.copies.actors) {
    if (!actor || !items.length) continue;
    say(format("STARWROUGHT.Content.progressCopies", { name }));
    const updates = [];
    for (const { item, pack, entry } of items) {
      try {
        const source = await fetchSource(cache, pack, entry);
        updates.push(copyUpdate(item, source, entry.hash));
      } catch (error) {
        console.error(`STARWROUGHT | ${name}: ${item.name} could not be refreshed`, error);
        result.errors.push({ where: name, name: item.name, message: error.message });
      }
    }
    if (!updates.length) continue;
    try {
      await actor.updateEmbeddedDocuments("Item", updates, { recursive: false, diff: false, swAnnounced: true });
      result.copies.count += updates.length;
      result.copies.actors.push({ name, count: updates.length });
    } catch (error) {
      console.error(`STARWROUGHT | ${name}: the copies could not be refreshed`, error);
      result.errors.push({ where: name, name: "", message: error.message });
    }
  }
}

/** Every open window over a Document, drawn again so its lists read the new content. */
function rerenderOpenSheets() {
  for (const app of foundry.applications.instances.values()) {
    if (!app.rendered || !app.document) continue;
    try {
      app.render();
    } catch (error) {
      console.warn("STARWROUGHT | a sheet could not be re-rendered after the sync", error);
    }
  }
}

/** The GM-whispered record of what the sync did, in the system's card idiom. */
async function postSyncCard(result) {
  const lines = result.packs.map(p => {
    const folders = p.folders.create + p.folders.update + p.folders.delete;
    return format("STARWROUGHT.Content.resultPack", {
      pack: escapeHTML(p.label), create: p.create, update: p.update, delete: p.delete,
      folders: folders ? format("STARWROUGHT.Content.resultFolders", { count: folders }) : ""
    });
  });
  if (result.copies.count) {
    lines.push(format("STARWROUGHT.Content.resultCopies", {
      count: result.copies.count,
      actors: escapeHTML(result.copies.actors.map(a => `${a.name} (${a.count})`).join(", "))
    }));
  }
  const notes = [format("STARWROUGHT.Content.cardWhen", { when: escapeHTML(formatWhen(result.stamp)), build: escapeHTML(shortHash(result.build)) })];
  if (result.errors.length) {
    notes.push(`<span class="sw-warn">${format("STARWROUGHT.Content.resultErrors", { count: result.errors.length })}</span>`);
  }
  const content = cardHtml({
    root: "sw-content-card",
    glyph: '<i class="fa-solid fa-rotate"></i>',
    title: localize("STARWROUGHT.Content.cardTitle"),
    lines,
    notes
  });
  try {
    await ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id) });
  } catch (error) {
    console.warn("STARWROUGHT | the sync card could not be posted", error);
  }
}

/**
 * Apply a plan from planContentSync: every pack in turn (applyPack), then the characters' copies
 * when asked (refreshCopies), then the record. The build and stamp are written to the world
 * settings only when nothing failed; a sync with an error line in a pack is offered again at the
 * next load (the compendia still differ), while one whose packs went through and whose copies or
 * lock restore failed is retried from Settings; the content indexes are re-read and the open
 * sheets redrawn either way, since whatever was written is live; and one GM-whispered card says
 * what happened.
 * @param {object} plan
 * @param {object} [options]
 * @param {boolean} [options.refreshCopies=true]   Refresh the owned copies the plan found (ruling 117).
 * @param {(text: string) => void} [options.onProgress]  Told each step, for a progress line.
 * @returns {Promise<object>}  {packs, copies, errors, build, stamp, recorded}
 */
export async function applyContentSync(plan, { refreshCopies: withCopies = true, onProgress = null } = {}) {
  if (!game.user.isGM) throw new Error(localize("STARWROUGHT.Content.gmOnly"));
  if (!plan) throw new Error(localize("STARWROUGHT.Content.noPlan"));
  const result = {
    packs: [],
    copies: { count: 0, actors: [] },
    errors: [],
    build: plan.build,
    stamp: plan.stamp,
    recorded: false
  };
  const say = text => {
    try {
      onProgress?.(text);
    } catch {
      // A progress line is a courtesy; never let it stop the writes.
    }
  };
  const cache = new Map();
  const context = { cache, result, say };

  for (const packPlan of plan.packs) {
    if (!packPlan.work) continue;
    await applyPack(packPlan, plan, context);
  }
  if (withCopies && plan.copies?.count) await refreshCopies(plan, context);

  if (!result.errors.length) {
    try {
      await game.settings.set(SW.SYSTEM_ID, SETTING_BUILD, plan.build);
      await game.settings.set(SW.SYSTEM_ID, SETTING_STAMP, plan.stamp);
      result.recorded = true;
    } catch (error) {
      console.error("STARWROUGHT | the synced build could not be recorded", error);
      result.errors.push({ where: "", name: "", message: error.message });
    }
  }

  say(localize("STARWROUGHT.Content.progressReload"));
  try {
    await reloadContentIndexes();
  } catch (error) {
    console.error("STARWROUGHT | the content indexes could not be re-read after the sync", error);
  }
  rerenderOpenSheets();
  await postSyncCard(result);
  return result;
}

/* -------------------------------------------- */
/*  The window                                  */
/* -------------------------------------------- */

/**
 * Sync content: the plan, by pack and by name, the copies line with its checkbox, and the three
 * buttons; while applying, the buttons disabled and a progress line; after, the result in place
 * of the plan. GM only (the Settings menu is `restricted`; `open` refuses a player). One window:
 * the Settings menu constructs its own instance, so the newest render closes the one before it
 * rather than two plans disagreeing.
 */
export class ContentSync extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "sw-content-sync",
    classes: ["starwrought", "sw-content-sync"],
    position: { width: 560, height: "auto" },
    window: {
      title: "STARWROUGHT.Content.title",
      icon: "fa-solid fa-rotate",
      resizable: true,
      minimizable: true
    },
    actions: {
      refresh: ContentSync.#onRefresh,
      sync: ContentSync.#onSync,
      close: ContentSync.#onCloseButton
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: TEMPLATE, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Opening                                     */
  /* -------------------------------------------- */

  static #instance = null;

  /** The one window of this client, or null. */
  static get instance() {
    return ContentSync.#instance;
  }

  /**
   * Open the window, or bring the open one to the front. A plan already computed (the load offer
   * has one) is shown as it is rather than computed again.
   * @param {{plan?: object|null}} [options]
   * @returns {Promise<ContentSync|null>}
   */
  static async open({ plan = null } = {}) {
    if (!game.user?.isGM) {
      ui.notifications.warn(localize("STARWROUGHT.Content.gmOnly"));
      return null;
    }
    let app = ContentSync.#instance;
    if (!app?.rendered) app = new ContentSync();
    if (plan) app.#seed(plan);
    await app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  /** The plan on show, or null while none has been computed (or after a sync, until Refresh). */
  #plan = null;
  /** The result of the last Sync, shown in place of the plan. */
  #result = null;
  /** A message when the index or the plan could not be read. */
  #error = null;
  #loading = false;
  #applying = false;
  #progress = "";
  /**
   * The checkbox: ticked by default (ruling 117) once the world has synced before. On the very
   * first sync of a world (no build recorded, so no copy carries a hash) every owned Item would be
   * rewritten from its source and a hand edit to a copy lost, so it starts unticked and the GM
   * opts in.
   */
  #refreshCopies = !!game.settings.get(SW.SYSTEM_ID, SETTING_BUILD);

  #seed(plan) {
    this.#plan = plan;
    this.#result = null;
    this.#error = null;
  }

  /** Read the index and compute the plan, recording a failure as the window's message. */
  async #load() {
    this.#loading = true;
    try {
      const index = await fetchContentIndex({ notify: false });
      if (!index) {
        this.#error = localize("STARWROUGHT.Content.noIndex");
        this.#plan = null;
        return;
      }
      this.#plan = await planContentSync(index);
      this.#error = null;
    } catch (error) {
      console.error("STARWROUGHT | the content plan could not be made", error);
      this.#error = error.message;
      this.#plan = null;
    } finally {
      this.#loading = false;
    }
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!game.user.isGM) {
      return Object.assign(context, {
        error: localize("STARWROUGHT.Content.gmOnly"),
        buttons: { refreshDisabled: true, syncDisabled: true, closeDisabled: false }
      });
    }
    if (!this.#plan && !this.#result && !this.#error && !this.#applying) await this.#load();

    const plan = this.#plan ? this.#planContext(this.#plan) : null;
    const copies = this.#plan?.copies?.count ?? 0;
    const canSync = !!this.#plan && !this.#applying && (!this.#plan.empty || (this.#refreshCopies && (copies > 0)));
    return Object.assign(context, {
      loading: this.#loading,
      applying: this.#applying,
      progress: this.#progress,
      error: this.#error,
      result: this.#result ? this.#resultContext(this.#result) : null,
      plan,
      refreshCopies: this.#refreshCopies,
      copiesDisabled: this.#applying || (copies === 0),
      // Spelled as the template's `disabled` helper wants them, so no helper expression is nested.
      buttons: {
        refreshDisabled: this.#applying,
        syncDisabled: !canSync,
        closeDisabled: this.#applying
      }
    });
  }

  /** One pack's three name lists, documents and folders together, folders marked. */
  static #lists(packPlan) {
    const rows = (docs, folders) => [
      ...docs.map(r => ({ name: r.name, folder: false })),
      ...folders.map(r => ({ name: r.name, folder: true }))
    ];
    const list = (kind, key, docs, folders) => {
      const items = rows(docs, folders);
      return { kind, items, count: items.length, any: items.length > 0, label: format(key, { count: items.length }) };
    };
    return [
      list("create", "STARWROUGHT.Content.createdList", packPlan.documents.create, packPlan.folders.create),
      list("update", "STARWROUGHT.Content.updatedList", packPlan.documents.update, packPlan.folders.update),
      list("delete", "STARWROUGHT.Content.deletedList", packPlan.documents.delete, packPlan.folders.delete)
    ];
  }

  #planContext(plan) {
    const lastStamp = game.settings.get(SW.SYSTEM_ID, SETTING_STAMP);
    const lastBuild = game.settings.get(SW.SYSTEM_ID, SETTING_BUILD);
    const when = formatWhen(plan.stamp);
    const copies = plan.copies ?? { count: 0, actorCount: 0, names: [] };
    return {
      when,
      stamp: plan.stamp,
      build: plan.build,
      buildShort: shortHash(plan.build),
      system: plan.system,
      lastWhen: lastStamp ? formatWhen(lastStamp) : localize("STARWROUGHT.Content.never"),
      lastBuildShort: shortHash(lastBuild),
      sameBuild: !!plan.build && (plan.build === lastBuild),
      empty: plan.empty,
      emptyText: format("STARWROUGHT.Content.nothing", { when }),
      counts: plan.counts,
      packs: plan.packs.map(p => ({
        label: p.label,
        work: p.work,
        hasWork: p.work > 0,
        counts: p.counts,
        lists: ContentSync.#lists(p).filter(l => l.any)
      })),
      skipped: plan.skipped.length ? format("STARWROUGHT.Content.skipped", { packs: plan.skipped.map(s => s.label).join(", ") }) : "",
      copies: {
        count: copies.count,
        any: copies.count > 0,
        line: copies.count
          ? format("STARWROUGHT.Content.copiesLine", { count: copies.count, actors: copies.actorCount, names: copies.names.join(", ") })
          : localize("STARWROUGHT.Content.copiesNone")
      }
    };
  }

  #resultContext(result) {
    return {
      when: formatWhen(result.stamp),
      buildShort: shortHash(result.build),
      recorded: result.recorded,
      packs: result.packs.map(p => {
        const folders = p.folders.create + p.folders.update + p.folders.delete;
        return {
          label: p.label,
          text: format("STARWROUGHT.Content.resultPack", {
            pack: p.label, create: p.create, update: p.update, delete: p.delete,
            folders: folders ? format("STARWROUGHT.Content.resultFolders", { count: folders }) : ""
          })
        };
      }),
      copies: result.copies.count
        ? format("STARWROUGHT.Content.resultCopies", { count: result.copies.count, actors: result.copies.actors.map(a => `${a.name} (${a.count})`).join(", ") })
        : localize("STARWROUGHT.Content.resultCopiesNone"),
      errors: result.errors.map(e => [e.where, e.name, e.message].filter(Boolean).join(": ")),
      errorsText: result.errors.length ? format("STARWROUGHT.Content.resultErrors", { count: result.errors.length }) : "",
      done: result.recorded ? format("STARWROUGHT.Content.resultDone", { when: formatWhen(result.stamp) }) : ""
    };
  }

  /**
   * One window: the Settings menu constructs its own instance, so whichever renders next closes
   * the one before it. Done here, before this window's frame exists, because ApplicationV2 keys
   * `foundry.applications.instances` by id and the two share one: closing the old window after
   * the new frame registered would unregister the new one.
   * @inheritdoc
   */
  async _preFirstRender(context, options) {
    await super._preFirstRender?.(context, options);
    const previous = ContentSync.#instance;
    if (previous && (previous !== this) && previous.rendered) await previous.close();
    ContentSync.#instance = this;
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // The checkbox is read on change, not on submit, and never forces a re-render: the plan does
    // not depend on it, only the Sync button's state does.
    const box = this.element?.querySelector('input[name="refreshCopies"]');
    box?.addEventListener("change", event => {
      this.#refreshCopies = !!event.currentTarget.checked;
      this.#syncButtonState();
    });
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose?.(options);
    if (ContentSync.#instance === this) ContentSync.#instance = null;
  }

  /** Enable or disable Sync from the plan and the checkbox, without a render. */
  #syncButtonState() {
    const button = this.element?.querySelector('button[data-action="sync"]');
    if (!button) return;
    const copies = this.#plan?.copies?.count ?? 0;
    button.disabled = !this.#plan || this.#applying || (this.#plan.empty && !(this.#refreshCopies && (copies > 0)));
  }

  /** The progress line, written in place so the window does not redraw on every step. */
  #setProgress(text) {
    this.#progress = text;
    const line = this.element?.querySelector(".sw-content-progress span");
    if (line) line.textContent = text;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Read the index and compute the plan again. */
  static async #onRefresh() {
    if (this.#applying) return;
    this.#plan = null;
    this.#result = null;
    this.#error = null;
    await this.render();
  }

  /** Apply the plan on show. */
  static async #onSync() {
    if (this.#applying || !this.#plan) return;
    const plan = this.#plan;
    this.#applying = true;
    this.#progress = localize("STARWROUGHT.Content.starting");
    await this.render();
    try {
      this.#result = await applyContentSync(plan, {
        refreshCopies: this.#refreshCopies,
        onProgress: text => this.#setProgress(text)
      });
      this.#plan = null;
      this.#error = null;
    } catch (error) {
      console.error("STARWROUGHT | Sync content failed", error);
      this.#error = error.message;
      ui.notifications.error(error.message);
    } finally {
      this.#applying = false;
      this.#progress = "";
      if (this.rendered) await this.render();
    }
  }

  static async #onCloseButton() {
    if (this.#applying) return;
    await this.close();
  }
}
