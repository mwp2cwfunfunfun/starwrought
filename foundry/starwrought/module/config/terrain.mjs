/**
 * Terrain on the map (0.15.0; ruling 178). Mike, 2026-11-05, on Riverfoot's "You ignore difficult
 * terrain from mud, decking, loose stone, and shallow water": "Let's build Difficult terrain INTO
 * the maps! using a region or some sort of method! so this can be automated. and players can
 * toggle layers to see what is difficult etc."
 *
 * A Difficult terrain region behavior (module/data/region-behaviors/difficult-terrain.mjs) carries
 * one of these kinds and a cost multiplier; a Talent's `[EFFECT IGNORE: terrain, <kind>, ...]`
 * line (module/rules/kinds/ignore.mjs) names the same words, so the cell and the map share one
 * vocabulary. The colour is the player's overlay's (module/canvas/terrain.mjs).
 *
 * THE KINDS ARE DATA SINCE 0.18.0. Through 0.17.0 the ten kinds were a frozen table here, each with
 * an i18n key; now they are the hand-kept `terrainKinds` block of assets/roster.json, rows of
 * `[name, description, difficulty, colour]`, and this module is the registry they are read into:
 * `assets/build_foundry.mjs` writes the block to `content/terrain.json` and the system loads it at
 * init (helpers/content.mjs, `loadTerrainKinds`), while the build and `assets/parse_rules.mjs`
 * register the block straight from the roster before any Automation cell is parsed. The slug is
 * `slugify(name)` ("Shallow Water" to `shallow-water`), so the 0.15.0 slugs a region already
 * stores survive. A kind is added in the roster and nowhere else.
 *
 * `TERRAIN_KINDS` keeps its name and shape for readers that index it by slug: it is one plain object
 * that `registerTerrainKinds` empties and refills IN PLACE, so `TERRAIN_KINDS[slug]` and
 * `Object.keys(TERRAIN_KINDS)` read the current registry wherever they were imported. Until a
 * registration it is empty: `terrainKindOf` answers null for every word and the `ignore` kind
 * refuses every named kind, which is loud by design (a self-test or a build that forgot to seed
 * the registry fails at once rather than passing on a stale table).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { slugify } from "./names.mjs";

/**
 * The kinds of difficult terrain, keyed by slug, each `{ slug, name, description, difficulty,
 * colour }` (frozen). Filled by `registerTerrainKinds`; empty before it.
 * @type {Object<string, {slug: string, name: string, description: string, difficulty: number, colour: string}>}
 */
export const TERRAIN_KINDS = {};

/** The book's difficult terrain: every foot costs two. The behavior's default multiplier and a row's. */
export const DEFAULT_TERRAIN_DIFFICULTY = 2;

/** The overlay's fill for a slug the registry does not know (the 0.15.0 "Other" violet). */
export const FALLBACK_TERRAIN_COLOUR = "#8a6fb0";

/** `#rrggbb`, the one colour form the roster block may use. */
export const TERRAIN_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * Read one roster row or record into the registry's shape. A row is `[name, description,
 * difficulty, colour]` as assets/roster.json keeps it; a record is `{ slug?, name, description?,
 * difficulty?, colour? }` (content/terrain.json, or a caller's own). Throws on a row with no name;
 * a difficulty that is not a finite number reads as the default and a colour that is not
 * `#rrggbb` as the fallback, since the build has already refused both (build_foundry.mjs) and the
 * client should draw something rather than nothing.
 * @param {Array|object} row
 * @returns {{slug: string, name: string, description: string, difficulty: number, colour: string}}
 */
export function terrainKindRecord(row) {
  let name, description, difficulty, colour, slug;
  if (Array.isArray(row)) [name, description, difficulty, colour] = row;
  else if (row && (typeof row === "object")) ({ slug, name, description, difficulty, colour } = row);
  name = String(name ?? "").trim();
  if (!name) throw new Error("a terrain kind needs a name (the roster row's first column)");
  slug = String(slug ?? "").trim() || slugify(name);
  if (!slug) throw new Error(`the terrain kind "${name}" makes an empty slug`);
  const d = Number(difficulty);
  colour = String(colour ?? "").trim().toLowerCase();
  return Object.freeze({
    slug,
    name,
    description: String(description ?? "").trim(),
    difficulty: Number.isFinite(d) && (d > 0) ? d : DEFAULT_TERRAIN_DIFFICULTY,
    colour: TERRAIN_COLOUR_PATTERN.test(colour) ? colour : FALLBACK_TERRAIN_COLOUR
  });
}

/**
 * Fill the registry from the roster's `terrainKinds` block (or content/terrain.json's records),
 * replacing whatever it held: `TERRAIN_KINDS` is emptied and refilled in place, in the rows' order.
 * Throws on a row with no name or a slug two rows share; nothing is registered when it throws.
 * @param {Array<Array|object>} rows
 * @returns {number}  How many kinds are registered now.
 */
export function registerTerrainKinds(rows) {
  const records = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = terrainKindRecord(row);
    if (seen.has(record.slug)) throw new Error(`the terrain kind "${record.name}" repeats the slug "${record.slug}"`);
    seen.add(record.slug);
    records.push(record);
  }
  for (const slug of Object.keys(TERRAIN_KINDS)) delete TERRAIN_KINDS[slug];
  for (const record of records) TERRAIN_KINDS[record.slug] = record;
  return records.length;
}

/** The registered kinds in the roster's order, each a frozen record. */
export function terrainKinds() {
  return Object.values(TERRAIN_KINDS);
}

/** Slug to printed name, in order: the shape a select's `choices` wants. */
export function terrainKindChoices() {
  return Object.fromEntries(terrainKinds().map(k => [k.slug, k.name]));
}

/**
 * The slug of a terrain kind written in a cell or a select: "Shallow Water", "shallow-water" and
 * "shallowwater" are one kind, and the row's name matched case blind is too. Null when the word
 * names none, and null for every word while nothing is registered.
 * @param {string} word
 * @returns {string|null}
 */
export function terrainKindOf(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!key) return null;
  if (Object.hasOwn(TERRAIN_KINDS, key)) return key;
  const squeezed = key.replace(/-/g, "");
  for (const kind of terrainKinds()) {
    if (kind.slug.replace(/-/g, "") === squeezed) return kind.slug;
    if (kind.name.toLowerCase().replace(/[\s_-]+/g, "") === squeezed) return kind.slug;
  }
  return null;
}

/**
 * The kind's printed name: the roster row's. A slug the registry does not know (a kind Mike has
 * since removed, still stored on a region) is title-cased so a label still reads.
 * @param {string} slug
 * @returns {string}
 */
export function terrainKindName(slug) {
  const kind = TERRAIN_KINDS[String(slug ?? "")];
  if (kind) return kind.name;
  return String(slug ?? "").split("-").map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

/** The overlay's fill for a kind, `#rrggbb`; the fallback for one the registry does not know. */
export function terrainKindColour(slug) {
  return TERRAIN_KINDS[String(slug ?? "")]?.colour ?? FALLBACK_TERRAIN_COLOUR;
}

/** The row's cost multiplier for a kind; the book's 2 for one the registry does not know. */
export function terrainKindDifficulty(slug) {
  return TERRAIN_KINDS[String(slug ?? "")]?.difficulty ?? DEFAULT_TERRAIN_DIFFICULTY;
}

/**
 * The registered names for a message: "Mud, Shallow Water, ... or Other", or the plain statement
 * that nothing is registered, so a refusal never reads "write  or undefined".
 * @returns {string}
 */
export function terrainKindList() {
  const names = terrainKinds().map(k => k.name);
  if (!names.length) return "no terrain kinds are registered (the roster's terrainKinds block was not loaded)";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}
