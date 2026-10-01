/**
 * The content the character-creation wizard shops from.
 *
 * Everything is read once out of the compendia and kept for the session. 170 Talents and 13
 * chassis Items is small enough that indexing it whole is cheaper than asking the pack a question
 * on every render.
 */

import * as SW from "../config.mjs";
import { enabledConstellations } from "./content.mjs";

const TALENT_FIELDS = [
  "system.constellation", "system.constellationName", "system.tier", "system.root",
  "system.bloodlineRoot", "system.capstone", "system.requires", "system.grant",
  "system.effect", "system.attribute", "system.cost", "system.costMax", "system.costMode",
  "system.reaction", "system.reactionCost", "system.choice", "system.freeTalent"
];

// `system.vigor` is the v4.10 chassis field. `system.hp` is still asked for so a compendium built
// before the rename reads as zero Vigor rather than as a crash; `vigorOf` below picks whichever is set.
const CHASSIS_FIELDS = [
  "system.kind", "system.constellation", "system.attribute", "system.vigor", "system.hp",
  "system.size", "system.speed", "system.senses", "system.languages", "system.grants",
  "system.specialAbility", "system.description"
];

/** @type {{talents: object, chassis: object, loaded: boolean}} */
export const SwContent = {
  talents: {},        // slug -> talent index entries
  byName: new Map(),  // "slug||Talent Name" -> entry
  chassis: {},        // kind -> chassis index entries
  loaded: false
};

/* -------------------------------------------- */

/** Read the compendia into the cache. Safe to call repeatedly. */
export async function loadChargenContent({ force = false } = {}) {
  if (SwContent.loaded && !force) return SwContent;

  SwContent.talents = {};
  SwContent.byName = new Map();
  SwContent.chassis = { ancestry: [], bloodline: [], culture: [], background: [], calling: [] };

  const talents = game.packs.get(`${SW.SYSTEM_ID}.talents`);
  if (talents) {
    const index = await talents.getIndex({ fields: TALENT_FIELDS });
    for (const entry of index) {
      const slug = entry.system?.constellation;
      if (!slug) continue;
      const talent = {
        id: entry._id,
        uuid: entry.uuid,
        pack: talents.collection,
        name: entry.name,
        img: entry.img,
        slug,
        constellationName: entry.system.constellationName || SW.getConstellation(slug).name,
        tier: entry.system.tier ?? "T",
        root: !!entry.system.root,
        bloodlineRoot: !!entry.system.bloodlineRoot,
        capstone: !!entry.system.capstone,
        requires: entry.system.requires ?? [],
        grant: entry.system.grant ?? null,
        effect: entry.system.effect ?? "",
        attribute: entry.system.attribute || "",
        choice: entry.system.choice?.prompt ?? "",
        freeTalent: entry.system.freeTalent ?? ""
      };
      (SwContent.talents[slug] ??= []).push(talent);
      SwContent.byName.set(`${slug}||${normalize(talent.name)}`, talent);
    }
    for (const list of Object.values(SwContent.talents)) {
      list.sort((a, b) => (b.root - a.root) || a.name.localeCompare(b.name));
    }
  }

  const chassis = game.packs.get(`${SW.SYSTEM_ID}.chassis`);
  if (chassis) {
    const index = await chassis.getIndex({ fields: CHASSIS_FIELDS });
    for (const entry of index) {
      const kind = entry.system?.kind;
      if (!kind || !(kind in SwContent.chassis)) continue;
      SwContent.chassis[kind].push({
        id: entry._id,
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img,
        ...entry.system,
        vigor: vigorOf(entry.system)
      });
    }
    for (const list of Object.values(SwContent.chassis)) list.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Weapon Familiarity may name a Weapon Group or one Technical weapon, so the picker needs both.
  SwContent.technicalWeapons = [];
  const equipment = game.packs.get(`${SW.SYSTEM_ID}.equipment`);
  if (equipment) {
    const index = await equipment.getIndex({ fields: ["system.handling"] });
    SwContent.technicalWeapons = index
      .filter(e => (e.type === "weapon") && (e.system?.handling === "technical"))
      .map(e => e.name)
      .sort();
  }

  SwContent.loaded = true;
  return SwContent;
}

/* -------------------------------------------- */

/**
 * A chassis Item's Vigor per level. The field is `vigor` since PHB v4.10; a chassis compiled under
 * the old name still says `hp`, and either way the number means the same thing.
 * @param {object} system
 * @returns {number}
 */
export function vigorOf(system) {
  const value = system?.vigor ?? system?.hp ?? 0;
  return Number(value) || 0;
}

/**
 * Strip the action glyphs before comparing Talent names. The Requires column is authored without
 * them, so "Kip Up" has to match the Talent called "Kip Up ❶" (or "Kip Up ◆" in older data).
 */
export function normalize(name) {
  return String(name ?? "").replace(/[⓿❶❷❸❹❺❻◆◇↺★]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/* -------------------------------------------- */

/**
 * The Constellations whose Talents count toward this one's rank: every registered Constellation
 * that names it as `parent`. Melee and Ranged are the parents the book has (PHB v4.10, Parent
 * Constellations); a Combat Style is a child of one of them.
 * @param {string} slug
 * @returns {Array<{slug: string, name: string}>}
 */
export function childrenOf(slug) {
  if (!slug) return [];
  return Object.values(SW.constellations)
    .filter(c => c.parent === slug)
    .map(c => ({ slug: c.slug, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The parent Constellation of a slug, as {slug, name}, or null when it has none. */
export function parentOf(slug) {
  const parent = SW.constellations[slug]?.parent;
  if (!parent) return null;
  return { slug: parent, name: SW.getConstellation(parent).name };
}

/**
 * Every Talent authored for a Constellation.
 *
 * A Lore (X) has no Talents of its own: it is a copy of the one authored Lore template, so it
 * shops from the template's list while keeping its own slug, and therefore its own rank.
 */
export function talentsIn(slug) {
  if (SwContent.talents[slug]) return SwContent.talents[slug];
  if (String(slug).startsWith("lore-")) return SwContent.talents.lore ?? [];
  return [];
}

/** The Root Talent of a Constellation, if it has one. */
export function rootOf(slug) {
  return talentsIn(slug).find(t => t.root) ?? null;
}

/** The Bloodline roots inside an Ancestry's Constellation. */
export function bloodlinesIn(slug) {
  return talentsIn(slug).filter(t => t.bloodlineRoot);
}

/** Fetch the real Item document for a cached Talent entry. */
export async function talentDocument(entry) {
  const pack = game.packs.get(entry.pack);
  return pack?.getDocument(entry.id) ?? null;
}

/* -------------------------------------------- */

/**
 * Every Lore (X) is a copy of the one authored Lore template, so a character can grow several
 * Lores side by side. This turns "Lore (Circus)" into its own Constellation slug.
 */
export function loreSlug(field) {
  return SW.slugify(`lore ${field}`);
}

/** Re-exported so callers here need only one import. The rule itself lives in config.mjs. */
export const isLoreSlug = SW.isLoreSlug;

/** "Lore (Circus)" out of a slug, for display. */
export function loreName(slug) {
  if (slug === "lore") return SW.getConstellation("lore").name;
  return `Lore (${slug.replace(/^lore-/, "").replace(/-/g, " ").titleCase()})`;
}

/* -------------------------------------------- */

/**
 * The options a build-time choice offers, worked out from what the spreadsheet's Choice cell says.
 * An unrecognized prompt falls through to free text, so authoring a new kind of choice does not
 * need code before it can be answered.
 * @param {string} prompt
 * @returns {string[]|null} null means free text
 */
export function choiceOptions(prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (!text) return null;
  if (text.includes("weapon group")) {
    const groups = [...SW.WEAPON_GROUPS];
    // "a Weapon Group or a Technical weapon" also lets you name one Technical weapon.
    if (text.includes("technical")) groups.push(...technicalWeapons());
    return groups;
  }
  if (text.includes("skill")) {
    // Only the Skills the spreadsheets enable (ruling 61): a Talent that asks you to name a Skill
    // must not be answered with one that cannot be bought.
    return enabledConstellations()
      .filter(c => c.category === "skill")
      .map(c => c.name)
      .sort();
  }
  return null;
}

/** Every Technical weapon in the Equipment compendium, for the Familiarity picker. */
function technicalWeapons() {
  return SwContent.technicalWeapons ?? [];
}
