#!/usr/bin/env node
/**
 * build_foundry.js
 *
 * assets/trees.json + assets/roster.json + assets/backgrounds.json + assets/languages.json
 *   + assets/actions.json and assets/equipment.json when the converter has written them
 *   -> foundry/starwrought/packs/_source/<pack>/*.json     (compendium pack sources)
 *   -> foundry/starwrought/packs/_source/index.json        (the content index the in-game sync reads)
 *   -> foundry/starwrought/content/constellations.json     (the runtime Constellation index)
 *   -> foundry/starwrought/content/terrain.json            (the roster's terrainKinds block, 0.18.0)
 *   -> foundry/starwrought/assets/constellations/*.png     (plate art, copied)
 *   -> foundry/starwrought/packs/<pack>                    (compiled LevelDB, if the CLI is present)
 *
 * The Foundry system is generated content in exactly the way the app HTML is: edit the
 * spreadsheets, run the pipeline, run this. Nothing here is authored by hand. Since 0.17.0 the
 * rules pack also carries AUTOMATION_GRAMMAR.md from the project root as the "STARWROUGHT
 * Automation Grammar" journal, one page per `## ` section, rendered by assets/lib/markdown.mjs, so
 * the grammar the author reads and the one the Item sheet's Grammar button opens are one file.
 *
 * Document ids are a hash of pack plus name, so they are stable across rebuilds. That matters:
 * an id becomes a compendium UUID the moment somebody drags a Talent onto a character sheet.
 *
 * Since 0.8.0 every document also carries `flags.starwrought.contentHash`, a hash of its content
 * alone, and packs/_source/index.json lists every Item and Folder with its id, file and hash
 * (ruling 116). The sources are the content and the compiled packs are a release artifact (ruling
 * 115): an open Foundry world syncs its compendia from the sources in place through Settings >
 * STARWROUGHT > Sync content, diffing by id and hash, and the LevelDB compile below is for a release
 * or a fresh install, run with Foundry closed. `node assets/build_all.mjs --content` is the loop
 * that runs this with --no-compile.
 *
 * Foundry is the play surface and ships only what the spreadsheets mark `Enabled? = Yes` (Mike,
 * 2026-10-01; ruling 61). The converter drops nothing: every talent, tree, background and action in
 * the JSON carries `enabled: true|false`, and this build writes a compendium document only for the
 * enabled ones. The web app, the compendium docx and the plates are authoring views of the whole
 * book and do not read the flag. Because the ids are hashes, enabling a row later restores the
 * same UUID, so nothing already on a character sheet is orphaned by a round trip through disabled.
 *
 * Usage:  node assets/build_foundry.js [--no-compile]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// The slug rule and the action-cost parser are imported from the system rather than copied, so
// they cannot drift: a slug that disagrees is a Talent that stops matching its Constellation.
// This is why module/config.mjs must stay free of Foundry globals at module scope.
import {
  slugify, parseActionCost, DEFENSES, ACTIVITY_SPEEDS, EXPLORATION_EFFECTS, ACTIVITY_CHOICE,
  // The terrain kinds' registry (0.18.0): the roster's `terrainKinds` block is registered before any
  // Automation cell is parsed, so `[EFFECT IGNORE: terrain, mud]` is checked against the roster.
  registerTerrainKinds, terrainKindRecord, terrainKinds, TERRAIN_COLOUR_PATTERN
} from "../foundry/starwrought/module/config.mjs";
// The automation grammar (0.9.0; ruling 120) is imported from the system for the same reason: the
// build and the client must read an Automation cell identically, so there is one parser and it is
// the system's. grammar.mjs imports the kinds registry itself, so the registry is live here (the
// `bonus` kind since 0.10.0); the index is also imported directly for the summary line's count of
// kinds. Both are free of Foundry globals at module scope, as config.mjs is.
import { parseAutomation } from "../foundry/starwrought/module/rules/grammar.mjs";
// The rule targets' resolver (0.16.0): one module, imported here and by assets/parse_rules.mjs, so
// the step that parses every cell and this build's fallback parse answer a name identically.
import { buildResolver } from "./lib/rule_targets.mjs";
// The grammar journal (0.17.0): AUTOMATION_GRAMMAR.md cut at its `## ` headings and rendered to the
// HTML a journal text page holds, by the build's own small converter (node built-ins only).
import { markdownToHtml, splitSections } from "./lib/markdown.mjs";
// The two kinds whose rules fill a field the system has read since before them (0.13.0): the
// mapping lives in the kind file, so the build and the Talent model derive the same field.
import { toGrantField } from "../foundry/starwrought/module/rules/kinds/grant.mjs";
import { toAuraField } from "../foundry/starwrought/module/rules/kinds/aura.mjs";
import { knownKinds } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { traitKey } from "../foundry/starwrought/module/rules/operators.mjs";
// The system's own Trait-line splitter (0.10.1), pure as the grammar is, so the build and the
// client read a Trait cell the same way; through 0.10.0 this file carried a copy of it.
import { splitTraits } from "../foundry/starwrought/module/data/items/weapon-traits.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SYSTEM = path.join(ROOT, "foundry", "starwrought");
const SOURCE = path.join(SYSTEM, "packs", "_source");
const CONTENT = path.join(SYSTEM, "content");
// The manifest, for the system version the content index records (the Foundry side shows it beside
// the build it is syncing to). Read once, here, so a missing manifest fails before any writing.
const manifest = JSON.parse(fs.readFileSync(path.join(SYSTEM, "system.json"), "utf8"));

const ICON = {
  constellation: "systems/starwrought/assets/icons/constellation.svg",
  talent: "systems/starwrought/assets/icons/talent.svg",
  chassis: "systems/starwrought/assets/icons/chassis.svg",
  weapon: "icons/svg/sword.svg",
  armor: "icons/svg/shield.svg",
  shield: "icons/svg/shield.svg",
  gear: "icons/svg/item-bag.svg",
  action: "icons/svg/target.svg",
  journal: "icons/svg/book.svg",
  macro: "icons/svg/dice-target.svg"
};

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, "assets", name), "utf8"));

/**
 * The `Enabled?` gate (ruling 61). The converter writes `enabled: true|false` on every node, tree,
 * background, action and equipment row; only an explicit `false` turns a row off here, so JSON from
 * before the column existed, or a sheet that has not been curated yet, still ships everything.
 */
const isEnabled = row => row?.enabled !== false;

/** Enabled-versus-authored tallies for the build summary and content/sync.json. */
const tally = {
  constellations: { enabled: 0, total: 0 },
  talents: { enabled: 0, total: 0 },
  chassis: { enabled: 0, total: 0 },
  sheetActions: { enabled: 0, total: 0 },
  equipment: { enabled: 0, total: 0 }
};
function count(kind, enabled) {
  tally[kind].total += 1;
  if (enabled) tally[kind].enabled += 1;
  return enabled;
}

/** A stable 16-character document id. */
function docId(pack, key) {
  return crypto.createHash("sha1").update(`starwrought|${pack}|${key}`).digest("hex").slice(0, 16);
}

/**
 * The same value with its object keys sorted, recursively, arrays kept in order. JSON.stringify
 * writes keys in insertion order, so two documents assembled in a different order would stringify
 * differently while meaning the same thing; canonical form is what makes the content hash below
 * stable across runs and across the order this script happens to put the fields together.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

/**
 * The content hash (0.8.0, ruling 116): the SHA-1 of a document's canonical content, sixteen hex
 * characters like the ids. The id says which document; the hash says whether it changed. The
 * in-game Sync content tool compares the hash in the index against `flags.starwrought.contentHash`
 * on the document in the compendium and updates only the ones that differ, so a rerun with nothing
 * changed syncs nothing.
 */
function contentHash(value) {
  return crypto.createHash("sha1").update(JSON.stringify(canonical(value))).digest("hex").slice(0, 16);
}

/**
 * The fields the content hash covers. An Item is its name, type, image, system data, folder and
 * sort; a Folder its name, type, parent, sorting, sort and color. Both leave out the id and the key
 * (fixed by construction), the flags (where the hash itself lives), ownership and `_stats`. The
 * rules journal and the macros are hashed over everything but those same bookkeeping fields, so
 * every document in packs/_source carries a hash and the index lists them all; the in-game sync
 * writes a journal by deleting and recreating it under its id (its pages are an embedded
 * collection) and a macro through updateDocuments, as it does an Item.
 */
const UNHASHED = new Set(["_id", "_key", "flags", "_stats", "ownership"]);
function hashable(collection, doc) {
  if (collection === "items") {
    const { name, type, img, system, folder, sort } = doc;
    return { name, type, img, system, folder, sort };
  }
  if (collection === "folders") {
    const { name, type, folder, sorting, sort, color } = doc;
    return { name, type, folder, sorting, sort, color };
  }
  return Object.fromEntries(Object.entries(doc).filter(([key]) => !UNHASHED.has(key)));
}

/**
 * Strip the action glyphs from a Talent or Maneuver name for matching and slugs: the v4.10
 * ⓿ ❶ ❷ ❸ ❹ ❺ ❻ and ↺, a bracketed Reaction cost such as "(⓿↺)", the v3 ◆ and ◇, and the
 * capstone star. Slugs come from the bare name, so a glyph change never moves a document id.
 */
const stripGlyphs = name => String(name)
  .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
  .replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "")
  .trim();

/**
 * The plain name of a Maneuver, with the cost glyphs and the connective that joined them removed.
 * "Strike ❶ to ❸" is the Maneuver Strike; "Disarm ❶ or ❸" is Disarm; "Aid ❶ (⓿↺)" is Aid. The
 * cost itself is parsed separately by parseActionCost, so nothing is lost here.
 */
function actionName(name) {
  const bare = stripGlyphs(name)
    .replace(/\s+(to|or)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return bare || String(name).trim();
}

/**
 * The ring on the map (0.5.1). Since 0.13.0 an aura rule in the Automation cell is the authoring
 * (`[AURA 15 allies]` since 0.16.0; AUTOMATION_GRAMMAR.md), parsed by the grammar like every rule
 * and carrying `{ range, affects }`; the Aura column still reads on the sheets that have it, and the
 * converter refuses a row with both. One `aura` rule per document (a second is the kind's own
 * refusal). The field written is the same `system.aura`, so `rangesOf` and the canvas read nothing
 * new. Every ring is preview-only until its owner shows it (0.17.0): the column's Visible flag,
 * like the retired `visible` word, writes nothing.
 */
const auraOf = (row, rules = []) => {
  const rule = rules.find(r => r.kind === "aura");
  if (rule) return { aura: toAuraField(rule) };
  return row.aura ? {
    aura: {
      range: Number.isInteger(row.aura.range) ? row.aura.range : null,
      affects: row.aura.affects ?? "all"
    }
  } : {};
};

/**
 * The restricted Talent Point a Talent hands out (the wizard's slot). Since 0.13.0 a `grant:` rule
 * ("grant: 1, Calling"; "grant: 2, Skill, DIFFERENT") is the authoring and the Grants column is
 * retired: the converter still reads a column cell this release and warns, and when both exist
 * they must agree or the build fails. The stored shape is the one `chargen.mjs` has read since
 * 0.4 ({ n, mode, scope }, GRANT_SCOPES there): the grammar's `Opening` is mode "open" anywhere
 * (a Root in a Constellation not yet opened), `Comet` is any Constellation you qualify for, and
 * every other Scope is its category, "different" when the flag is set.
 */
function grantOf(row, rules, source) {
  const rule = rules.find(r => r.kind === "grant");
  const fromRule = rule ? toGrantField(rule) : null;
  // The column never directed a point at a Constellation, so its `constellation` is "" (0.16.0).
  const fromColumn = row.grant ? { n: row.grant.n, mode: row.grant.mode, scope: row.grant.scope, constellation: "" } : null;
  if (fromRule && fromColumn && JSON.stringify(fromRule) !== JSON.stringify(fromColumn)) {
    fail(`grant: ${source}: the Grants column (${JSON.stringify(fromColumn)}) and the 'grant:' line `
      + `(${JSON.stringify(fromRule)}) disagree; the column is retired, so clear it`);
  }
  const grant = fromRule ?? fromColumn;
  return { grant: { n: grant?.n ?? 0, mode: grant?.mode ?? "", scope: grant?.scope ?? "", constellation: grant?.constellation ?? "" } };
}

/**
 * The build-time pick a Talent demands (0.16.0): `[CHOICE Weapon Group]` in the cell is the
 * authoring and the Choice column is retired; a filled cell still reads this release, and when
 * both are present they must agree or the build fails, as the Grants column's disagreement does.
 */
function choiceOf(row, rules, source) {
  const rule = rules.find(r => r.kind === "choice");
  const fromRule = rule?.prompt ? String(rule.prompt).trim() : "";
  const fromColumn = String(row.choice ?? "").trim();
  if (fromRule && fromColumn && (fromRule.toLowerCase() !== fromColumn.toLowerCase())) {
    fail(`choice: ${source}: the Choice column ("${fromColumn}") and the [CHOICE] line ("${fromRule}") disagree; `
      + "the column is retired, so clear it");
  }
  return { choice: { prompt: fromRule || fromColumn, value: "" } };
}

/**
 * The Talent handed over free (0.16.0): `[TALENT Weapon Familiarity]` is the authoring and the
 * Free Talent column is retired; read, warned and checked as the Choice column is.
 */
function freeTalentOf(row, rules, source) {
  const rule = rules.find(r => r.kind === "talent");
  const fromRule = rule?.name ? String(rule.name).trim() : "";
  const fromColumn = String(row.freeTalent ?? "").trim();
  if (fromRule && fromColumn && (stripGlyphs(fromRule).toLowerCase() !== stripGlyphs(fromColumn).toLowerCase())) {
    fail(`talent: ${source}: the Free Talent column ("${fromColumn}") and the [TALENT] line ("${fromRule}") disagree; `
      + "the column is retired, so clear it");
  }
  return { freeTalent: fromRule || fromColumn };
}

/* -------------------------------------------- */
/*  The automation framework (0.9.0)            */
/* -------------------------------------------- */

/** What the Automation cells added up to, for the summary line: rules, documents carrying any, kinds used. */
const automationTally = { rules: 0, documents: 0, kinds: new Set(), traitsAsked: new Map(), unread: 0, unreadDocuments: 0 };

/**
 * An Item's `automation` and `rules` from the cell the converter copied through (0.9.0; rulings
 * 118 to 120). The cell is parsed here with the system's own grammar, and a line that does not
 * parse FAILS the build naming the Constellation, the Talent and the line, as a bad Aura cell stops
 * the converter: nothing half-read ships, and sync_content.cmd stops before the sources are
 * written (fail() exits before writeSources() runs). What is written is the text itself, so the
 * sheet shows the cell as the author wrote it, and the parsed rules, `{ kind, line, text, ...data }`
 * each, so the client never has to parse a compendium Item to use it. One kind is defined since
 * 0.10.0, `bonus` (Humanity's; rulings 121 to 124); a line in any other word is "unknown rule
 * kind" and fails here, which is the framework working as built: the kinds are added one at a
 * time with Mike (ruling 119). An empty cell is `automation: ""` and `rules: []`, written on every
 * Talent, Constellation and action so the field is always present on a source.
 *
 * Since 0.16.0 the parse is assets/parse_rules.mjs's, the pipeline step before inject, which
 * writes `rules` beside every cell in the JSON for every consumer; this build reads them when the
 * carrier has them and parses only a cell no step pre-parsed (a JSON written by hand, or the
 * converter run alone), with the same grammar and the same resolver, so the outcome is one.
 * @param {string} text           The cell, or "" / undefined for none.
 * @param {object} context        For the messages: `source` is "<Constellation> / <Talent>" (or the
 *                                action's sheet and name); itemName, constellation and itemType
 *                                travel to the kinds' own parse for their messages, and `resolve`
 *                                (resolveRuleTarget below) is what a kind asks about a target's name.
 * @param {object[]} [preparsed]  The carrier's `rules` from the JSON, when parse_rules wrote them.
 * @returns {{automation: string, rules: object[]}}
 */
function automationOf(text, context, preparsed) {
  const automation = String(text ?? "");
  if (!automation.trim()) return { automation: "", rules: [] };
  let rules;
  if (Array.isArray(preparsed)) {
    rules = preparsed;
  } else {
    const parsed = parseAutomation(automation, context);
    if (parsed.errors.length) {
      fail(parsed.errors.map(e => `automation: ${context.source}, line ${e.line}: ${e.message} ("${e.text}")`).join("\n  "));
    }
    rules = parsed.rules;
  }
  // An error entry (`{ error, line, text }`, a line parse_rules --lenient could not read, 2026-11-07)
  // travels onto the document as the client stores a GM's unparsed line: red on the sheet, skipped
  // in play. It is counted apart and is no rule.
  const unread = rules.filter(r => r?.error);
  if (unread.length) {
    automationTally.unread += unread.length;
    automationTally.unreadDocuments += 1;
  }
  const parsedRules = rules.filter(r => !r?.error);
  if (parsedRules.length) {
    automationTally.rules += parsedRules.length;
    automationTally.documents += 1;
    for (const rule of parsedRules) {
      automationTally.kinds.add(rule.kind);
      // `IF(Trait=<Trait>)` (0.14.0): remembered, and checked at the end against every trait a
      // shipping weapon, action or Talent carries; a trait nothing carries is a WARNING, not a
      // failure (ruling 171), since the rule reads and fires when the first such attack is authored.
      const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
      for (const w of whens) {
        if (w?.trait) (automationTally.traitsAsked.get(w.trait) ?? automationTally.traitsAsked.set(w.trait, []).get(w.trait)).push(`${context.source} (${w.name})`);
      }
    }
  }
  return { automation, rules };
}

const DAMAGE_ABBR = { B: "bludgeoning", P: "piercing", S: "slashing" };

/** "1d8 S" into a die size and a damage type. */
function parseDamage(text) {
  const match = String(text).match(/(\d*)d(\d+)\s*([BPS])?/i);
  if (!match) return { die: 6, type: "bludgeoning" };
  return { die: Number(match[2]), type: DAMAGE_ABBR[(match[3] ?? "B").toUpperCase()] };
}

/** "Adjacent", "3 ft", 4 into a number of feet. */
function parseReach(text) {
  if (typeof text === "number") return text;
  const value = String(text ?? "").trim();
  if (/adjacent/i.test(value)) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/* -------------------------------------------- */
/*  Document builders                           */
/* -------------------------------------------- */

const packs = {};

/**
 * Queue one document into a pack, stamped with its content hash (ruling 116). Every builder
 * (item(), folder(), the journal and the macros) passes through here once its document is complete,
 * so this is the one place the hash is set. It is written onto the document itself before the copy
 * is taken, so the object the builder keeps and the one that is written agree.
 */
function push(pack, collection, doc) {
  doc.flags = {
    ...(doc.flags ?? {}),
    starwrought: { ...(doc.flags?.starwrought ?? {}), contentHash: contentHash(hashable(collection, doc)) }
  };
  (packs[pack] ??= []).push({ ...doc, _key: `!${collection}!${doc._id}` });
  return doc;
}

function item(pack, { key, name, type, img, system, folder = null, sort = 0 }) {
  const _id = docId(pack, key ?? `${type}:${name}`);
  return push(pack, "items", {
    _id,
    name,
    type,
    img: img ?? ICON[type],
    system,
    folder,
    sort,
    ownership: { default: 0 },
    flags: {},
    effects: [],
    _stats: { systemId: "starwrought" }
  });
}

function folder(pack, name, { color = "#3b2f63", sort = 0, type = "Item" } = {}) {
  const _id = docId(pack, `folder:${name}`);
  push(pack, "folders", {
    _id,
    name,
    type,
    description: "",
    folder: null,
    sorting: "a",
    sort,
    color,
    flags: {}
  });
  return _id;
}

/* -------------------------------------------- */
/*  Constellations and Talents                  */
/* -------------------------------------------- */

const CATEGORY_ALIASES = {
  Ancestry: "origin",
  Bloodline: "origin",
  Heritage: "origin",
  Culture: "origin",
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
  // PHB v4.21: the five magical disciplines and their specialties (a specialty names its discipline
  // in the Parent column, as a Combat Style names Melee or Ranged).
  Magic: "magic",
  General: "general"
};

const trees = read("trees.json");
const roster = read("roster.json");
const backgrounds = read("backgrounds.json");
const languages = read("languages.json");
// The action sheets are read here, before the trees loop, rather than beside the Actions section
// below where they are used: the rule-target resolver needs every Maneuver's name while the
// Talents are built (0.10.0), and a `const` read further down would still be in its dead zone.
const actionsPath = path.join(ROOT, "assets", "actions.json");
const actionsFile = fs.existsSync(actionsPath) ? read("actions.json") : {};
const sheetActions = actionsFile.actions ?? [];
// The index names with no row on any sheet (0.20.0): the workbook's, so a roster row of the name
// is retired as a blank sheet row retired it through 0.19.0.
const retiredByIndex = (actionsFile.retired ?? []).map(n => String(n).toLowerCase());

/**
 * THE AUTOMATION RULES' TARGETS (0.10.0; rulings 121 and 122). What a rule's target or condition
 * names, for the grammar's kinds, handed to both `automationOf` calls as `resolve` in the parse
 * context. Since 0.16.0 the map is built by assets/lib/rule_targets.mjs, which assets/parse_rules.mjs
 * (the one parse of every cell) imports too, so the step and this build's fallback parse never
 * answer a name differently; the client's counterpart is `resolveRuleTarget` in
 * module/helpers/content.mjs, over the registry and the compendium. The shape and the rules of the
 * match (every tree, disabled ones included, Origin, every sheet action and roster row by plain
 * name or slug, a Constellation winning over an action) are documented in that module.
 */
const resolveRuleTarget = buildResolver({ trees, sheetActions, roster });

/**
 * THE TERRAIN KINDS (0.18.0). The kinds of difficult terrain are the roster's hand-kept
 * `terrainKinds` block, rows of `[name, description, difficulty, colour]`, and nothing else: the
 * Difficult terrain behavior's Kind select, the `[EFFECT IGNORE: terrain, <kind>]` descriptors, the
 * grammar's messages, the ruler's label and the player's overlay all read the registry in
 * module/config/terrain.mjs, which this block fills here (before any cell is parsed, so an unknown
 * kind's message lists the roster's names) and which the system fills at init from
 * content/terrain.json (written by writeContentIndex below). The slug is `slugify(name)`, so
 * "Shallow Water" keeps the `shallow-water` a 0.15.0 region stored. The block is refused when it
 * is missing or empty, when a name repeats after slugify, when a colour is not `#rrggbb`, when a
 * difficulty is not a number from 1 to 5 (the behavior's own range), or when `other` is absent
 * (the behavior's initial kind). A kind is added in the roster and nowhere else.
 */
function registerRosterTerrainKinds() {
  const rows = roster.terrainKinds;
  if (!Array.isArray(rows) || !rows.length) {
    fail("roster.json has no terrainKinds block (rows of [name, description, difficulty, colour]); the Difficult terrain kinds are read from it since 0.18.0.");
  }
  const problems = [];
  const slugs = new Set();
  rows.forEach((row, i) => {
    const where = `roster.json terrainKinds row ${i + 1}`;
    if (!Array.isArray(row) || (row.length < 4)) {
      problems.push(`${where} is not [name, description, difficulty, colour]`);
      return;
    }
    const [name, description, difficulty, colour] = row;
    if (!String(name ?? "").trim()) problems.push(`${where} has no name`);
    const slug = slugify(name);
    if (slug && slugs.has(slug)) problems.push(`${where} ("${name}") repeats the slug "${slug}" of an earlier row`);
    slugs.add(slug);
    if (typeof description !== "string") problems.push(`${where} ("${name}"): the description must be text`);
    const d = Number(difficulty);
    if ((typeof difficulty !== "number") || !Number.isFinite(d) || (d < 1) || (d > 5)) {
      problems.push(`${where} ("${name}"): the difficulty must be a number from 1 to 5, not ${JSON.stringify(difficulty)}`);
    }
    if (!TERRAIN_COLOUR_PATTERN.test(String(colour ?? ""))) {
      problems.push(`${where} ("${name}"): the colour must be #rrggbb, not ${JSON.stringify(colour)}`);
    }
  });
  if (!slugs.has("other")) problems.push("roster.json terrainKinds has no \"Other\" row, the behavior's initial kind");
  if (problems.length) fail(problems.join("\n  "));
  try {
    registerTerrainKinds(rows.map(terrainKindRecord));
  } catch (error) {
    fail(`roster.json terrainKinds: ${error.message}`);
  }
}
registerRosterTerrainKinds();

/**
 * THE SPELL (PHB v4.21; the magic workbook's spell columns, read by the converter into `node.spell`,
 * the Aura column's precedent). On the Talent Item as `system.spell`, the shape the Cast Maneuver
 * reads: the Threat (which two Defenses answer it), the Delivery (Zoned meets Protection, Pervasive
 * does not), the range, the die and its damage types, the targets, what each cast does (Quick ❷,
 * Focused ❸, Committed ❹) and an optional override of the Threat's Defenses. A Talent that is not a
 * spell writes nothing, so the field reads its schema default.
 */
function spellOf(node) {
  const s = node.spell;
  if (!s) return {};
  const feet = /^(\d+)\s*ft$/.exec(String(s.range ?? ""));
  return {
    spell: {
      enabled: true,
      threat: s.threat ?? "blow",
      delivery: s.delivery || "",
      range: feet ? Number(feet[1]) : 0,
      adjacent: String(s.range ?? "").toLowerCase() === "adjacent",
      die: Number.isFinite(s.die) ? s.die : null,
      types: s.types ?? [],
      targets: s.targets ?? "",
      defenses: s.defenses ?? [],
      effects: { quick: s.effects?.quick ?? "", focused: s.effects?.focused ?? "", committed: s.effects?.committed ?? "" }
    }
  };
}

const constellationIndex = [];
const plateDir = path.join(ROOT, "assets", "constellations");
const plates = fs.existsSync(plateDir) ? new Set(fs.readdirSync(plateDir)) : new Set();

for (const [name, tree] of Object.entries(trees)) {
  const slug = slugify(name);
  const category = CATEGORY_ALIASES[tree.category] ?? "general";
  // The tree-level Primary Attribute (the index's `Feeds` through 0.12.0). The converter requires
  // one on every tree that rolls Untrained; an identity tree may leave it blank, and "" slipped
  // past `??` for a build when the column was renamed (0.13.0), so a blank is said and read as Might.
  if (!tree.feeds) console.warn(`  WARNING: ${name}: no Primary Attribute on the _Tree Index; Might assumed`);
  const attribute = String(tree.feeds || "Might").toLowerCase();
  const plate = plates.has(`${slug}.png`) ? `systems/starwrought/assets/constellations/${slug}.png` : null;
  // A tree with a Parent is a GROUP of that Constellation's Talents (PHB v4.21: a fighting style
  // within Melee or Ranged, a specialty within a magical discipline): it has no rank of its own, and
  // every Talent in it counts once toward the parent's. Through v4.20 a child kept a rank of its own.
  const parent = tree.parent ? slugify(tree.parent) : "";
  const group = !!tree.group || !!parent;
  // A Constellation exists in play when its Root does: the converter sets the tree's flag from
  // its root talent (ruling 60), and the Constellation document ships only when that is on.
  const treeEnabled = count("constellations", isEnabled(tree));

  if (treeEnabled) item("constellations", {
    key: `constellation:${slug}`,
    name,
    type: "constellation",
    img: plate ?? ICON.constellation,
    system: {
      slug,
      category,
      attribute,
      // `parent` is the owning Item on a data model, so the field is parentSlug; the registry
      // entry in content/constellations.json keeps the plain name.
      parentSlug: parent,
      group,
      meta: tree.meta ?? "",
      flareTrigger: tree.sparks ?? "",
      identity: ["Ancestry", "Culture", "Bloodline", "Heritage"].includes(tree.category),
      description: tree.meta ? `<p>${tree.meta}</p>` : "",
      traits: [],
      // A Constellation Item may carry rules one day (0.9.0); the _Tree Index has no Automation
      // column yet, so both are empty and present, as on every Talent and action.
      automation: "",
      rules: [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });

  // The runtime index keeps EVERY Constellation, disabled ones included, so a character who already
  // owns a Talent of a Constellation that has since been turned off still resolves its name,
  // category, attribute and parent. `enabled` is what the runtime filters its pickers on.
  constellationIndex.push({ slug, name, category, attribute, parent, group, img: plate ?? ICON.constellation, enabled: treeEnabled });

  // One folder per Constellation keeps 170 Talents navigable in the sidebar. A Constellation that
  // ships no Talent gets no folder, so the sidebar shows nothing it cannot open.
  const shipped = tree.nodes.filter(node => count("talents", isEnabled(node)));
  const folderId = shipped.length ? folder("talents", name, { color: "#3b2f63" }) : null;

  for (const node of shipped) {
    const bare = stripGlyphs(node.name);
    // The Automation cell, parsed with the system's grammar; a bad line stops the build here.
    // `resolve` is what a kind asks about a target's name (0.10.0): a Constellation or a Maneuver
    // the book has, else the line fails naming the word. Parsed before the document is shaped,
    // since the `aura` and `grant` rules fill `system.aura` and `system.grant` (0.13.0).
    const source = `${name} / ${node.name}`;
    const automation = automationOf(node.automation, {
      itemName: node.name, constellation: name, itemType: "talent", source, resolve: resolveRuleTarget
    }, node.rules);
    item("talents", {
      key: `talent:${slug}:${slugify(bare)}`,
      name: node.name,
      type: "talent",
      folder: folderId,
      img: ICON.talent,
      system: {
        constellation: slug,
        constellationName: name,
        tier: node.tier ?? "T",
        root: !!node.root,
        bloodlineRoot: !!node.hroot,
        capstone: /★/.test(node.name),
        requires: node.requires ?? [],
        prerequisites: node.prereqs ?? "",
        attribute: node.feeds ? String(node.feeds).toLowerCase() : "",
        effect: node.effect ?? "",
        description: node.desc ? `<p>${node.desc}</p>` : "",
        ...parseActionCost(node.name),
        ...grantOf(node, automation.rules, source),
        // `[CHOICE ...]` and `[TALENT ...]` in the cell are the authoring (0.16.0); the columns
        // are read one release and must agree.
        ...choiceOf(node, automation.rules, source),
        ...freeTalentOf(node, automation.rules, source),
        ...auraOf(node, automation.rules),
        ...spellOf(node),
        ...automation,
        // The sheet's Traits column (0.14.0), so a spell Talent can carry the trait a defender's
        // `IF(Trait=...)` asks about.
        traits: Array.isArray(node.traits) ? node.traits.map(String) : [],
        source: "STARWROUGHT Playtest v4.24"
      }
    });
  }
}

/* -------------------------------------------- */
/*  Chassis: Ancestries, Bloodlines, Cultures,  */
/*  Backgrounds, Callings                       */
/* -------------------------------------------- */

const chassisFolders = {
  ancestry: folder("chassis", "Ancestries", { sort: 0 }),
  bloodline: folder("chassis", "Bloodlines", { sort: 1 }),
  culture: folder("chassis", "Cultures", { sort: 2 }),
  background: folder("chassis", "Backgrounds", { sort: 3 }),
  calling: folder("chassis", "Callings", { sort: 4 })
};

// Which chassis ship (ruling 61): an Ancestry, Culture or Calling when the Constellation of that
// name is enabled (the converter also copies the ancestry tree's flag onto the roster block, so
// both are checked); a Bloodline on its own root talent's flag, since the two Human bloodlines are
// curated separately from Humanity; a Background on its own flag. The folders always ship, so an
// empty step in chargen still has somewhere to say that nothing is enabled.
const ancestryTree = ancestry => trees[ancestry.tree ?? ancestry.name];

// Every chassis, enabled or not, for content/chassis.json: a character stores the names it chose
// at creation, not the Items, and the sheet explains a locked name from this index when the pack
// does not carry it (a Background or Calling switched off after the character was made, or never
// enabled at all). The pack holds only the enabled ones; the index is the whole book.
const chassisIndex = [];
function chassis(enabled, doc) {
  chassisIndex.push({ name: doc.name, img: doc.img ?? ICON.chassis, enabled, system: doc.system });
  if (count("chassis", enabled)) item("chassis", doc);
}

function bloodlineEnabled(ancestry, bloodName) {
  const want = stripGlyphs(bloodName).toLowerCase();
  const root = (ancestryTree(ancestry)?.nodes ?? []).find(n => n.hroot && stripGlyphs(n.name).toLowerCase() === want);
  // A bloodline row with no hroot talent of that name is a roster-versus-sheet mismatch the
  // converter does not police here; it follows its ancestry rather than vanishing on a typo.
  return root ? isEnabled(root) : isEnabled(ancestryTree(ancestry));
}

for (const ancestry of roster.ancestries ?? []) {
  const treeSlug = slugify(ancestry.tree ?? ancestry.name);
  chassis(isEnabled(ancestry) && isEnabled(ancestryTree(ancestry)), {
    key: `chassis:ancestry:${slugify(ancestry.name)}`,
    name: ancestry.name,
    type: "chassis",
    folder: chassisFolders.ancestry,
    img: plates.has(`${treeSlug}.png`)
      ? `systems/starwrought/assets/constellations/${treeSlug}.png`
      : ICON.chassis,
    system: {
      kind: "ancestry",
      constellation: treeSlug,
      attribute: String(trees[ancestry.tree]?.feeds || "Presence").toLowerCase(),
      vigor: ancestry.vigor ?? ancestry.hp ?? 0,
      size: String(ancestry.size ?? "Medium").toLowerCase(),
      speed: parseReach(ancestry.speed),
      senses: ancestry.senses === "—" ? "" : (ancestry.senses ?? ""),
      description: `<p>${ancestry.blurb ?? ""}</p>`,
      // The "<Ancestry> Lore" sheet (0.13.0): the player-facing sections in the author's order,
      // shown on the Description tab and under the highlighted card in Character Creation. The
      // converter carries rich text as the Effect column's; each section is one paragraph here.
      lore: (ancestry.lore ?? []).map(({ label, text }) => ({ label, text: `<p>${text}</p>` })),
      // The index's Traits column (0.14.0): the creature traits the Ancestry confers ("Human"),
      // which the character sheet's header reads off the chassis by name.
      traits: Array.isArray(ancestry.traits) ? ancestry.traits.map(String) : [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });

  for (const [bloodName, effect] of ancestry.bloodlines ?? []) {
    chassis(bloodlineEnabled(ancestry, bloodName), {
      key: `chassis:bloodline:${slugify(bloodName)}`,
      name: bloodName,
      type: "chassis",
      folder: chassisFolders.bloodline,
      system: {
        kind: "bloodline",
        constellation: treeSlug,
        attribute: String(trees[ancestry.tree]?.feeds || "Presence").toLowerCase(),
        specialAbility: `<p>${effect}</p>`,
        description: `<p>A bloodline of the ${ancestry.name} ancestry. Its Root Talent is granted free by the character-creation choice.</p>`,
        traits: [],
        source: "STARWROUGHT Playtest v4.24"
      }
    });
  }
}

// The roster's cultures block is generated from data/cultures.xlsx since 0.15.0, one object per
// Culture tree (name, enabled, attribute, languages, blurb, lore, traits, tree), as the ancestries
// block is from ancestries.xlsx. The Special Ability is the Culture's Root Talent's own Effect,
// read off the tree, in place of the boilerplate sentence the positional block carried.
for (const culture of roster.cultures ?? []) {
  const name = culture.name;
  const tree = trees[culture.tree ?? name];
  const root = (tree?.nodes ?? []).find(n => n.root);
  chassis(isEnabled(culture) && isEnabled(tree), {
    key: `chassis:culture:${slugify(name)}`,
    name,
    type: "chassis",
    folder: chassisFolders.culture,
    img: plates.has(`${slugify(name)}.png`)
      ? `systems/starwrought/assets/constellations/${slugify(name)}.png`
      : ICON.chassis,
    system: {
      kind: "culture",
      constellation: slugify(name),
      attribute: String(culture.attribute || tree?.feeds || "Presence").toLowerCase(),
      languages: String(culture.languages ?? ""),
      description: culture.blurb ? `<p>${culture.blurb}</p>` : "",
      // The "<Culture> Lore" sheet, mapped as the Ancestry's is: one paragraph per section.
      lore: (culture.lore ?? []).map(({ label, text }) => ({ label, text: `<p>${text}</p>` })),
      specialAbility: root ? `<p>${root.effect}</p>` : "",
      traits: Array.isArray(culture.traits) ? culture.traits.map(String) : [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });
}

/**
 * A Background's Training (0.16.0): its `[<Skill> trained]` lines (the `grant` rules that name a
 * Constellation; a Lore reads as "Lore") when its Automation cell has any, else the retired Skills
 * and Lore columns' list. The rules were parsed by assets/parse_rules.mjs; a background JSON
 * written without that step carries the cell as text alone and is parsed here, the Talents' way.
 */
function backgroundGrants(background) {
  let rules = background.rules;
  if (!Array.isArray(rules) && String(background.automation ?? "").trim()) {
    rules = automationOf(background.automation, {
      itemName: background.name, constellation: "Backgrounds", itemType: "background",
      source: `Backgrounds / ${background.name}`, resolve: resolveRuleTarget
    }).rules;
  }
  const directed = (rules ?? []).filter(r => (r.kind === "grant") && r.constellation);
  if (directed.length) {
    return directed.map(r => (r.constellation === "lore" ? "Lore" : String(r.constellationName ?? r.constellation)));
  }
  return [...(background.skills ?? []), background.lore].filter(Boolean);
}

for (const background of backgrounds) {
  chassis(isEnabled(background), {
    key: `chassis:background:${slugify(background.name)}`,
    name: background.name,
    type: "chassis",
    folder: chassisFolders.background,
    system: {
      kind: "background",
      attribute: "wits",
      grants: backgroundGrants(background),
      specialAbility: `<p>${background.effect ?? ""}</p>`,
      description: `<p>${background.desc ?? ""}</p>`,
      traits: background.rarity ? [background.rarity] : [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });
}

// The roster's hand-kept callings rows: [name, training, openingVigor, attribute, ability]. The
// Opening Vigor is the row's, which assets/parse_rules.mjs has already overwritten from the Root's
// `[VIGOR opening N]` when the Root states one; the Training is the Root's `[<Skill> trained]`
// line when it has one (0.16.0), else the row's word, else the index's retired Skills column.
for (const [name, rowTraining, hp, attribute, ability] of roster.callings ?? []) {
  const root = (trees[name]?.nodes ?? []).find(n => n.root);
  const trained = (root?.rules ?? []).find(r => (r.kind === "grant") && r.constellation && r.trained);
  const training = trained
    ? (trained.constellation === "lore" ? "Lore" : String(trained.constellationName ?? trained.constellation))
    : (rowTraining || trees[name]?.skills?.[0] || "");
  chassis(isEnabled(trees[name]), {
    key: `chassis:calling:${slugify(name)}`,
    name,
    type: "chassis",
    folder: chassisFolders.calling,
    img: plates.has(`${slugify(name)}.png`)
      ? `systems/starwrought/assets/constellations/${slugify(name)}.png`
      : ICON.chassis,
    system: {
      kind: "calling",
      constellation: slugify(name),
      attribute: String(attribute).toLowerCase(),
      vigor: hp,
      grants: training ? [training] : [],
      specialAbility: `<p>${ability}</p>`,
      description: `<p>Grants Training in ${training}, and ${hp} Opening Vigor, added once if it is your first Calling.</p>`,
      traits: [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });
}

/* -------------------------------------------- */
/*  Equipment                                   */
/* -------------------------------------------- */

// data/equipment.xlsx is authoritative for weapons, armor and shields (Mike, 2026-10-01; ruling 64).
// The converter writes assets/equipment.json from it, every row carrying `enabled`, and regenerates
// the roster's weaponsMelee, weaponsRanged, armorPieces and shields blocks from the same rows for the
// authoring views (the ancestries precedent). This build reads the JSON when it is there and writes
// a document for each enabled row alone (ruling 61). A checkout without the workbook has no JSON,
// and then the roster blocks build the pack as they did before the sheet existed, every row
// shipping, because hand-kept roster JSON carries no flag (the actions precedent: roster rows
// always ship).
//
// Whichever source is read, a document is keyed `weapon:<slug>`, `armor:<slug>` or `shield:<slug>`
// of its name, exactly as the roster loops keyed it, so the sheet moves no id and orphans no owned
// Item's UUID, and a row disabled today restores the same document when it is enabled again.
const equipmentPath = path.join(ROOT, "assets", "equipment.json");
const equipment = fs.existsSync(equipmentPath) ? read("equipment.json") : null;
const equipmentSource = equipment ? "data/equipment.xlsx" : "STARWROUGHT Playtest v4.24";

// The roster blocks read into the sheet's row shape, so one builder per type serves both sources.
// The ranged block has no price column, and neither does the book's Ranged Weapons table, so a
// ranged weapon's price is blank from either source; the sheet's Price column is filled only for
// melee weapons (Unarmed Strike excepted), and priceOf turns the blank into "".
const rosterEquipment = {
  weapons: [
    ...(roster.weaponsMelee ?? []).map(([name, handling, group, damage, reach, traits, price]) =>
      ({ name, kind: "Melee", handling, group, damage, reach, traits, price, enabled: true })),
    ...(roster.weaponsRanged ?? []).map(([name, handling, group, damage, range, traits]) =>
      ({ name, kind: "Ranged", handling, group, damage, range, traits, enabled: true }))
  ],
  armor: (roster.armorPieces ?? []).map(([name, zone, protection, load, price, traits, material]) =>
    ({ name, zone, protection, load, price, traits, material, enabled: true })),
  shields: (roster.shields ?? []).map(([name, bonus, hardness, load, price, note]) =>
    ({ name, bonus, hardness, load, price, note, enabled: true }))
};
// The JSON, once present, is the whole truth: a block it lacks is an empty block, not a reason to
// read the roster for that type, so a sheet that drops every shield ships no shield.
const equipmentRows = type => (equipment ? equipment[type] : rosterEquipment[type]) ?? [];

/** A printed price, or blank: the tables mark a free or priceless row with a dash. */
const priceOf = price => (price == null || price === "—" || price === "-") ? "" : String(price);

/** A whole number from either source; a blank cell reads as 0. */
const whole = value => Number(value ?? 0) || 0;

// The four folders always ship, so the sidebar has a place to say nothing is enabled under them.
const equipFolders = {
  melee: folder("equipment", "Melee Weapons", { sort: 0, color: "#5a2f2f" }),
  ranged: folder("equipment", "Ranged Weapons", { sort: 1, color: "#5a2f2f" }),
  armor: folder("equipment", "Armor", { sort: 2, color: "#2f4a5a" }),
  shields: folder("equipment", "Shields", { sort: 3, color: "#2f4a5a" })
};

for (const row of equipmentRows("weapons")) {
  if (!count("equipment", isEnabled(row))) continue;
  const ranged = /^ranged$/i.test(String(row.kind ?? "").trim());
  item("equipment", {
    key: `weapon:${slugify(row.name)}`,
    name: row.name,
    type: "weapon",
    folder: ranged ? equipFolders.ranged : equipFolders.melee,
    system: {
      handling: String(row.handling ?? "").toLowerCase(),
      group: row.group ?? "",
      damage: parseDamage(row.damage),
      // A ranged weapon's Range lives in its Ranged N trait, which is where the system reads it; its
      // reach is 0 whatever the sheet's Range or Reach cell says.
      reach: ranged ? 0 : parseReach(row.reach),
      traits: splitTraits(row.traits),
      price: priceOf(row.price),
      quantity: 1,
      load: 0,
      state: "carried",
      // The sheet's Notes column (Unarmed Strike's "Varies; typically" remark) is the only prose a
      // weapon row has; the roster never carried any.
      description: row.notes ? `<p>${row.notes}</p>` : "",
      source: equipmentSource
    }
  });
}

for (const row of equipmentRows("armor")) {
  if (!count("equipment", isEnabled(row))) continue;
  item("equipment", {
    key: `armor:${slugify(row.name)}`,
    name: row.name,
    type: "armor",
    folder: equipFolders.armor,
    system: {
      zone: String(row.zone ?? "").toLowerCase(),
      protection: whole(row.protection),
      load: whole(row.load),
      // The converter fills a blank Material from the first trait, so the sheet always names one;
      // "none" is only for a roster row that never had the column.
      material: String(row.material ?? "none").toLowerCase(),
      traits: splitTraits(row.traits),
      price: priceOf(row.price),
      quantity: 1,
      state: "carried",
      description: "",
      source: equipmentSource
    }
  });
}

for (const row of equipmentRows("shields")) {
  if (!count("equipment", isEnabled(row))) continue;
  // The Tower Shield's Note is the book's footnote, and it is what makes the shield grant Cover.
  const note = String(row.note ?? "").trim();
  item("equipment", {
    key: `shield:${slugify(row.name)}`,
    name: row.name,
    type: "shield",
    folder: equipFolders.shields,
    system: {
      bonus: whole(row.bonus),
      hardness: whole(row.hardness),
      load: whole(row.load),
      cover: /cover/i.test(note),
      price: priceOf(row.price),
      quantity: 1,
      state: "carried",
      traits: [],
      description: note ? `<p>${note}</p>` : "",
      source: equipmentSource
    }
  });
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

// An actions workbook is authoritative for any action it names (Mike, 2026-09-26; data/actions.xlsx
// then, data/maneuvers.xlsx alone since 2026-10-03, when Mike moved Aid into it and deleted the
// other). A roster row of the same name is retired, so Aid written in the sheet replaces Aid
// printed in the roster under the same document id, and a character who already has Aid keeps a
// working link. Rows the sheet does not carry yet stay, so nothing vanishes until the sheet has
// it. The sheet's Basic Actions and the roster's Encounter Mode rows are flagged `basic`, which is
// what puts them on every character's Actions tab without a copy being made.
//
// The sheet stays authoritative when its row is disabled (ruling 61): a sheet action marked anything
// but `Enabled? = Yes` is not written, AND it still retires the roster row of the same name, so the
// action ships nowhere until Mike enables it (Aid reads Yes since 2026-10-03 and is the first
// Maneuver to ship). The build names those rows so the gap is deliberate rather than a surprise;
// the roster rows themselves (Encounter, Exploration, Downtime, Reactions) are hand-kept JSON and
// always ship.
//
// `sheetActions` itself is read at the top of the file, beside trees.json, because the rule-target
// resolver (0.10.0) needs the Maneuvers' names before the Talents are built.
/** The workbook that wrote a sheet action, as the Item's Source line; a pre-0.5.1 actions.json carried no stamp and was the old actions.xlsx alone. */
const actionSource = a => a.workbook ? `data/${a.workbook}` : "data/actions.xlsx";
const fromSheet = new Set([...sheetActions.map(a => a.name.toLowerCase()), ...retiredByIndex]);
const disabledOnSheet = new Set([...sheetActions.filter(a => !isEnabled(a)).map(a => a.name.toLowerCase()), ...retiredByIndex]);
const retired = [];
const retiredByDisabled = [];
function supersededBySheet(name) {
  const bare = actionName(name);
  if (!fromSheet.has(bare.toLowerCase())) return false;
  retired.push(bare);
  if (disabledOnSheet.has(bare.toLowerCase())) retiredByDisabled.push(bare);
  return true;
}

/**
 * Blank-line separated prose in a cell becomes paragraphs; single line breaks stay breaks. An
 * inline tag the converter wrapped around a run that spans a blank line is closed at the end of
 * each paragraph and reopened at the start of the next, so the HTML stays well formed, and a
 * segment with no text (a leading or trailing blank line) produces no paragraph.
 */
function paragraphs(html) {
  const text = String(html ?? "").trim();
  if (!text) return "";
  const out = [];
  let open = [];
  for (const segment of text.split(/(?:\s*<br\s*\/?>\s*){2,}/)) {
    const body = segment.trim();
    const after = openTags(open, body);
    if (body.replace(/<[^>]+>/g, "").trim()) {
      const closers = [...after].reverse().map(tag => `</${tag.match(/^<(\w+)/)[1]}>`).join("");
      out.push(`<p>${open.join("")}${body}${closers}</p>`);
    }
    open = after;
  }
  return out.join("");
}

/** The inline tags still open after a fragment, given those open before it. */
function openTags(before, fragment) {
  const stack = [...before];
  for (const m of fragment.matchAll(/<(\/?)(b|i|u|s|span)\b[^>]*>/g)) {
    if (!m[1]) { stack.push(m[0]); continue; }
    const i = stack.map(t => t.match(/^<(\w+)/)[1]).lastIndexOf(m[2]);
    if (i >= 0) stack.splice(i, 1);
  }
  return stack;
}

// A roster row is keyed on its printed name and its mode ("Strike ◆ to ◆◆◆" slugs to strike-to,
// Search lives under exploration:), and that key is the compendium UUID already sitting in macros,
// chat cards and journal links. A sheet action that takes a roster row over inherits the row's key
// rather than deriving one from its bare name, so the document id really is unchanged.
const rosterKey = new Map();
function inherit(name, key) {
  const bare = actionName(name).toLowerCase();
  if (rosterKey.has(bare)) console.warn(`  two roster actions are named "${bare}"; the sheet inherits ${rosterKey.get(bare)}`);
  else rosterKey.set(bare, key);
}
for (const rows of Object.values(roster.actions ?? {})) for (const [name] of rows) inherit(name, `action:${slugify(name)}`);
// The Activities and the Endeavors were roster rows keyed `exploration:` and `downtime:` through
// 0.19.0; since 0.20.0 they are rows of data/activities.xlsx and data/endeavors.xlsx and keep those
// keys by their Type (modeOf, below), so an Activity on a character's `system.exploration.activity`
// still resolves.
// The roster's `postures` block is the Reaction table now (Parry, Void, Counter, Intercept, and the
// Talent-granted Postures). The four named Reactions are also Defense & Recovery Maneuvers, and
// the Maneuver row is the one that ships; a Reaction row of the same name is skipped, not doubled.
const encounterNames = new Set(
  Object.values(roster.actions ?? {}).flat().map(([name]) => actionName(name).toLowerCase())
);
for (const [name] of roster.postures ?? []) {
  if (encounterNames.has(actionName(name).toLowerCase())) continue;
  inherit(name, `posture:${slugify(name)}`);
}

// Only enabled sheet actions are written, and a sheet type folder only when one of its actions
// ships; a roster category of the same name still claims the folder below with `??=`.
const shippedSheetActions = sheetActions.filter(a => count("sheetActions", isEnabled(a)));
const actionFolders = {};
let actionSort = 0;
// A sheet action's group is the sheet it sits on (data/maneuvers.xlsx: Basic Actions, Athletics
// Actions, ...), falling back to its Type for a workbook with no such grouping; it is the parse
// context and the Source line. The pack folder and `category` are finer since 0.20.0 (below).
const actionGroup = a => a.sheet || a.type;

/**
 * THE THREE TYPES (PHB v4.24, Chapter 8: Maneuvers, Activities, Endeavors; 0.20.0). A row's Type
 * cell says what it is. An Activity is an Exploration Mode Item (the road's select; category
 * "Exploration Mode", key `exploration:<slug>`), an Endeavor a Downtime Mode one (category
 * "Downtime Mode", key `downtime:<slug>`), whichever sheet it sits on (Treat Wounds on the Medicine
 * sheet is an Activity as Search is); the keys are the ones the roster rows had through 0.19.0, so
 * the ids an Activity left on a character do not move. Everything else is a Maneuver: its category
 * is the row's Category cell (the Basic Actions sheet's book groups: Movement Maneuvers, Attack
 * Maneuvers, ...) else its sheet, and its key the roster's when a roster row of the name existed.
 */
const typeWord = a => String(a.type ?? "").trim().toLowerCase();
const modeOf = a => typeWord(a) === "activity" ? "exploration" : typeWord(a) === "endeavor" ? "downtime" : null;
const MODE_CATEGORY = { exploration: "Exploration Mode", downtime: "Downtime Mode" };
const actionCategory = a => MODE_CATEGORY[modeOf(a)] ?? (a.category || actionGroup(a));
const actionKey = a => modeOf(a) ? `${modeOf(a)}:${slugify(a.name)}` : (rosterKey.get(a.name.toLowerCase()) ?? `action:${slugify(a.name)}`);

/**
 * BASIC (Mike, 2026-11-08, by question: "every ungranted Maneuver"). A row is on every character's
 * Actions tab unless a Talent grants it: its Type is `Talent Maneuver`, or a Talent's `[MANEUVER X]`
 * rule or `@Maneuver[X]` marker (any tree, enabled or not, and the Backgrounds) names it. Mike's
 * sheets type Rally, Battle Cry, Kip Up and the Ancestry and Culture Maneuvers as plain
 * "Maneuver"; the build reads them as granted and says so once, by name, so the sheet can be
 * tidied at leisure and ships right meanwhile. Through 0.19.0 the flag read a Type beginning
 * "Basic", which no row carries any more.
 */
const grantedManeuvers = new Set();
const noteGranted = name => grantedManeuvers.add(actionName(String(name ?? "")).toLowerCase());
const MARKER = /@Maneuver\[([^\]]+)\]/g;
const grantsOf = carrier => {
  for (const r of carrier.rules ?? []) if ((r?.kind === "maneuver") && !r.error && r.name) noteGranted(r.name);
  for (const m of String(carrier.effectSource ?? carrier.effect ?? "").matchAll(MARKER)) noteGranted(m[1]);
};
for (const tree of Object.values(trees)) for (const node of tree.nodes ?? []) grantsOf(node);
for (const background of backgrounds ?? []) grantsOf(background);
const isGranted = a => /^talent\b/i.test(typeWord(a)) || grantedManeuvers.has(a.name.toLowerCase());
const retyped = shippedSheetActions.filter(a => isGranted(a) && !/^talent\b/i.test(typeWord(a))).map(a => a.name);

/**
 * The Constellations an Activity column may name (0.7.2, ruling 104): every tree in trees.json and
 * the four Defenses, by name as the trees print them, case blind. The four Defenses are trees too,
 * and their lowercased names are their slugs, so the second loop is the brief's belt to the first
 * loop's braces. Lore is a template and its instances are the character's own, so a column cannot
 * name one; ACTIVITY_CHOICE covers Investigate's pick.
 */
const activityConstellations = new Map();
for (const treeName of Object.keys(trees)) {
  const slug = slugify(treeName);
  if (slug === "lore") continue; // the template: no character rolls it, so no column may name it
  activityConstellations.set(treeName.trim().toLowerCase(), slug);
}
for (const slug of Object.keys(DEFENSES)) activityConstellations.set(slug, slug);

/**
 * One Activity column (data/activities.xlsx `Check` and `Initiative`; 0.20.0, the roster's two
 * positional columns before it): "" as is, `choice` as is (written as the constant, whatever its
 * case), else the slug of the named Constellation. A name that is neither is an authoring error and
 * stops the build, because a slug nobody can roll would ship as a silent Awareness.
 */
function activityConstellation(cell, activity, column) {
  const text = String(cell ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === ACTIVITY_CHOICE) return ACTIVITY_CHOICE;
  const slug = activityConstellations.get(text.toLowerCase());
  if (!slug) {
    fail(`data/activities.xlsx: "${activity}" names "${text}" in its ${column} column, which is neither a `
      + `Constellation in trees.json nor a Defense (nor "${ACTIVITY_CHOICE}"; a Lore is the member's own pick, `
      + `so write "${ACTIVITY_CHOICE}" for one).`);
  }
  return slug;
}

/**
 * THE CHECK A ROW ROLLS (0.20.0). Mike's sheets carry a `Constellation` column ("read it rather
 * than inferring the Constellation from the sheet title"): when it names one Constellation or
 * Defense and the Effect says the row attempts or rolls a check, the Item's check is enabled on it,
 * so Use rolls Climb's Athletics and Hide's Stealth from the row; a cell naming two ("Melee or
 * Ranged"), nothing ("N/A", blank) or a Constellation the Effect never rolls (Steady the Line's
 * Human) leaves the field at the model's default. The Defense is read from the Effect when it
 * names exactly one after "vs." or "against" (Demoralize's Guard), so a Talent's `AGAINST(Guard)`
 * line has a shipped Maneuver to fire on. A Maneuver whose Effect calls for a Relevant Check
 * (0.10.0; ruling 123) is enabled with no Constellation named, which SwItem#use reads as the
 * picker carrying the Maneuver (Aid, Recall Knowledge).
 */
const ROLLS_A_CHECK = /\b(?:attempt|roll)s?\b[^.<]{0,80}?\bcheck\b/i;
const DEFENSE_NAMED = /\b(?:vs\.?|against)\s+(?:the\s+|its\s+|their\s+|a\s+|an\s+|one\s+|each\s+|your\s+)*(?:target(?:'|’)s\s+|creature(?:'|’)s\s+|foe(?:'|’)s\s+)?(Awareness|Evade|Guard|Endure)\b/gi;
const plainText = html => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function defenseIn(text) {
  const found = new Set([...text.matchAll(DEFENSE_NAMED)].map(m => m[1].toLowerCase()));
  return found.size === 1 ? [...found][0] : "";
}
/** The slug the row's Constellation cell names, when it names exactly one and the Effect rolls it. */
function rolledConstellation(a) {
  const named = String(a.constellation ?? "").trim();
  if (!named || /\bor\b|,|\//.test(named)) return "";
  if (!ROLLS_A_CHECK.test(plainText(a.effect))) return "";
  return activityConstellations.get(named.toLowerCase()) ?? "";
}
function checkOf(a) {
  const text = plainText(a.effect);
  if (/relevant\s+check/i.test(text)) return { check: { enabled: true, constellation: "", defense: defenseIn(text) } };
  const slug = rolledConstellation(a);
  return slug ? { check: { enabled: true, constellation: slug, defense: defenseIn(text) } } : {};
}

/**
 * AN ACTIVITY'S PART IN THE ROAD (0.7.2, ruling 104; the row's own columns since 0.20.0). `travel`
 * is the Movement Speed word, lowercased, a key of SW.ACTIVITY_SPEEDS ("" when the sheet has none,
 * which the road reads as Full); `check` the Check column, else the Constellation the row rolls
 * (Treat Wounds' Medicine), "" when it rolls nothing, or `choice` for the member's own pick
 * (Investigate); `initiative` the Initiative column the same way, "" meaning Awareness; `effect`
 * what Begin the encounter does for it beyond the Initiative Constellation, by name (scout,
 * defend). A named check-now Constellation is also the Item's own check, so an owned copy of Search
 * rolls Awareness from the sheet exactly as the road's Roll does; `choice` opens the picker (ruling
 * 107). Nothing here is Mike's hand-kept JSON any more: the roster's `explorationActions` and
 * `downtimeActions` blocks went with 0.20.0.
 */
function explorationOf(a) {
  if (modeOf(a) !== "exploration") return {};
  const travel = String(a.speed ?? "").trim().toLowerCase();
  if (travel && !ACTIVITY_SPEEDS[travel]) {
    fail(`data/activities.xlsx: "${a.name}" has Movement Speed "${a.speed}"; it must be one of `
      + `${Object.keys(ACTIVITY_SPEEDS).map(k => k[0].toUpperCase() + k.slice(1)).join(", ")}, or blank.`);
  }
  const check = activityConstellation(a.check, a.name, "Check") || rolledConstellation(a);
  const rolls = activityConstellation(a.initiative, a.name, "Initiative");
  const effectSlug = slugify(a.name);
  const effect = EXPLORATION_EFFECTS[effectSlug] ? effectSlug : "";
  const named = check && (check !== ACTIVITY_CHOICE);
  const relevant = /relevant\s+check/i.test(plainText(a.effect)) || (check === ACTIVITY_CHOICE);
  return {
    exploration: { travel, check, initiative: rolls, effect },
    ...(named ? { check: { enabled: true, constellation: check, defense: "" } }
      : relevant ? { check: { enabled: true, constellation: "", defense: "" } } : {})
  };
}

for (const a of shippedSheetActions) {
  const category = actionCategory(a);
  if (actionFolders[category]) continue;
  const mode = modeOf(a);
  actionFolders[category] = mode
    ? folder("actions", category, { sort: mode === "exploration" ? 90 : 91, color: "#2f5a3f" })
    : folder("actions", category, { sort: actionSort++, color: "#5a4a1e" });
}
let actionAutomation;
for (const a of shippedSheetActions) {
  item("actions", {
    key: actionKey(a),
    name: a.name,
    type: "action",
    folder: actionFolders[actionCategory(a)],
    system: {
      cost: a.cost,
      costMax: a.costMax ?? "",
      costMode: a.costMode ?? "to",
      reaction: a.reaction ?? false,
      reactionCost: a.reactionCost ?? "",
      category: actionCategory(a),
      basic: !isGranted(a),
      traits: a.traits ?? [],
      prerequisites: a.prerequisites ?? "",
      requirements: a.requirements ?? "",
      trigger: a.trigger ?? "",
      // The four columns Mike added on 2026-11-08, strings the sheet and the card print when set.
      frequency: a.frequency ?? "",
      range: a.range ?? "",
      target: a.target ?? "",
      duration: a.duration ?? "",
      description: a.description ? `<p>${a.description}</p>` : "",
      effect: paragraphs(a.effect),
      // The sheet's Automation column is the same column as a Talent's now (0.9.0), no longer
      // prose: parsed with the system's grammar, and a bad line stops the build naming the
      // workbook, the sheet and the action. The same `resolve` as a Talent's (0.10.0).
      ...(actionAutomation = automationOf(a.automation, {
        itemName: a.name, constellation: actionGroup(a), itemType: "action",
        source: `${actionSource(a)} / ${actionGroup(a)} / ${a.name}`,
        resolve: resolveRuleTarget
      }, a.rules)),
      // An action's ring may be an `aura:` line too (0.13.0), as a Talent's.
      ...auraOf(a, actionAutomation.rules),
      ...(modeOf(a) ? explorationOf(a) : checkOf(a)),
      source: actionSource(a)
    }
  });
}
if (retyped.length) console.log(`  granted by a Talent, so not basic though typed "Maneuver" on the sheet: ${retyped.join(", ")}`);

for (const [category, rows] of Object.entries(roster.actions ?? {})) {
  const folderId = (actionFolders[category] ??= folder("actions", category, { sort: actionSort++, color: "#3b2f63" }));
  for (const [name, traitLine, description] of rows) {
    if (supersededBySheet(name)) continue;
    item("actions", {
      key: `action:${slugify(name)}`,
      name: actionName(name),
      type: "action",
      folder: folderId,
      system: {
        ...parseActionCost(name),
        category,
        basic: true,
        traits: splitTraits(traitLine),
        description: `<p>${description}</p>`,
        // A roster row has no Automation cell; the fields are present and empty (0.9.0).
        automation: "",
        rules: [],
        source: "STARWROUGHT Playtest v4.24"
      }
    });
  }
}

/**
 * A content error the build must not paper over: say it and stop. Every document is queued in
 * memory until writeSources() runs at the end, so a build that fails here leaves packs/_source and
 * the compendia exactly as they were.
 */
function fail(message) {
  console.error(`\n  ${message}`);
  process.exit(1);
}

// The Exploration Mode Activities and the Downtime Mode Endeavors were hand-kept roster rows
// (`explorationActions`, `downtimeActions`) through 0.19.0; since 0.20.0 they are rows of
// data/activities.xlsx and data/endeavors.xlsx, written with the other sheet actions above under
// the keys the roster rows had (modeOf, explorationOf).

// Reactions (PHB v4.10, Answering an Attack): the roster row's second column reads
// "<Granting Talent> • <Defense> +N Situation", or "A Zone" for a Posture. The Defense it names is
// the one the Reaction answers with; the cost comes from the glyphs in the name (Parry ❶↺, a
// Posture ⓿↺). The four Reactions that are also Maneuvers were written above and are skipped here.
const reactionFolder = folder("actions", "Reactions", { sort: 92, color: "#5a2f4a" });
for (const [name, grantedBy, description] of roster.postures ?? []) {
  if (supersededBySheet(name)) continue;
  if (encounterNames.has(actionName(name).toLowerCase())) continue;
  const defenseWord = (String(grantedBy).match(/•\s*(Awareness|Evade|Guard|Endure)\b/i)?.[1]
    ?? String(grantedBy).match(/^(Awareness|Evade|Guard|Endure)\b/i)?.[1]
    ?? "").toLowerCase();
  const cost = parseActionCost(name);
  item("actions", {
    key: `posture:${slugify(name)}`,
    name: actionName(name),
    type: "action",
    folder: reactionFolder,
    system: {
      ...cost,
      reaction: true,
      category: "Reaction",
      requirements: grantedBy,
      trigger: "You are attacked, before you know whether the attack was successful.",
      check: { enabled: false, constellation: defenseWord, defense: defenseWord },
      traits: ["Reaction"],
      description: `<p>${description}</p>`,
      automation: "",
      rules: [],
      source: "STARWROUGHT Playtest v4.24"
    }
  });
}

if (sheetActions.length) {
  console.log(`  ${shippedSheetActions.length} of ${sheetActions.length} action(s) from ${[...new Set(sheetActions.map(actionSource))].join(", ")} enabled`
    + (retired.length ? `; roster rows retired in their favour: ${[...new Set(retired)].join(", ")}` : ""));
  // An action in this list is in neither the sheet's output nor the roster's: it is off the table
  // entirely until its sheet row reads Enabled? = Yes (or, since 0.20.0, until the index name has a
  // row at all), and the sync report flags it for Mike.
  if (retiredByDisabled.length) console.log(`  retired by a disabled sheet row or an index name with no row: ${[...new Set(retiredByDisabled)].join(", ")}`);
}

/* -------------------------------------------- */
/*  Rules reference journal                     */
/* -------------------------------------------- */

/** Render a table from an array of rows. */
function table(headers, rows) {
  const head = headers.map(h => `<th>${h}</th>`).join("");
  const body = rows.map(row => `<tr>${row.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/* The two pages the Bind and Exposed cards, the sheet's bind line, the Zones panel's EXPOSED badge
   and a condition's row open (system 0.5.1, T6). The rules prose is the handbook's, quoted
   (PHB v4.10, Chapter 2, 5. Position: Exposed; The Bind; Allies in the Exchange), with one change:
   the book writes a neutral Bind with a dash ("longsword, dash, spear") and the style rule allows
   no dash in shipping prose, so the notation is the slash the system draws on the map. The
   condition, Maneuver and Reaction rows are read from the roster so they cannot drift from the
   Conditions, Maneuvers and Reaction pages. */
const REFERENCE_ID = docId("rules", "journal:reference");
const pageLink = title =>
  `@UUID[Compendium.starwrought.rules.JournalEntry.${REFERENCE_ID}.JournalEntryPage.${docId("rules", `page:${title}`)}]{${title}}`;
const conditionRows = (...names) => names.map(n => (roster.conditions ?? []).find(r => r[0] === n)).filter(Boolean);
const actionRows = (...names) => {
  const all = Object.values(roster.actions ?? {}).flat();
  return names.map(n => all.find(r => r[0] === n)).filter(Boolean).map(([name, , effect]) => [name, effect]);
};
const reactionRows = (...names) => names.map(n => (roster.postures ?? []).find(r => r[0] === n)).filter(Boolean);

const exposedPage = [
  "<p>An Exposed Zone presents an opening for an attack (PHB v4.21, Exposed Zones):</p>",
  "<ul>",
  "<li>Its Protection counts as 0, subject to any exception in the Attack's description (a Quick Strike's says Protection applies even to an Exposed Zone).</li>",
  "<li>It remains Exposed until you Recenter ❶, unless the effect that Exposed it specifies another duration.</li>",
  "<li>A Critical Hit against it with a Deliberate or Committed Strike inflicts a Wound.</li>",
  "<li>Exposure caused by a Posture lasts until the end of the round and cannot be cleared by Recenter; Exposure caused by Control ends when that Control ends.</li>",
  "</ul>",
  "<p>When a Zone is Exposed, the following condition is placed on you: Exposed [Zone Name]. Zones become Exposed when your Deliberate or Committed Strike Misses, when a Committed Strike Grazes, when you take a Posture that says so, when a foe Controls your weapon in a Bind, when a Deliberate or Committed Strike of yours lands and you choose to open the Zone it struck, and through certain Talents and critical effects.</p>",
  "<h2>The condition</h2>",
  table(["Condition", "Effect"], conditionRows("Exposed [Zone]")),
  "<h2>Opening and closing a Zone</h2>",
  table(["Maneuver", "Effect"], actionRows("Recenter ❶")),
  table(["Reaction", "Grants", "Effect"], reactionRows("Give Ground ⓿↺", "Set Your Feet ⓿↺", "Drop Flat ⓿↺", "Kneel Behind the Shield ⓿↺")),
  `<p>What a Critical Hit does to each Zone, Exposed or not, is on ${pageLink("Zones and Critical Hits")}.</p>`,
  "<h2>In the system</h2>",
  "<p>Each Exposed Zone shows on the token as its own status (Exposed: Head, Exposed: Torso, Exposed: Arms, Exposed: Legs) and in the Zones panel of the sheet. Toggling the status on the token and toggling the Zone on the sheet are the same change. Recenter closes every Exposed Zone except one a Posture opened, and the statuses close with them.</p>"
].join("");

const bindPage = [
  "<p>A Bind forms when a rigid weapon or shield Guards against a melee Attack that Grazes or Misses, provided the implements involved can Bind (PHB v4.21, Binds): on a Graze a neutral Bind forms; on a Miss the defender gains Control of the attacking implement. Track one relationship per implement, and name the two implements: longsword / spear, or shield > bite. A Bind is neutral (/) when neither fighter has the line, or Controlled (>) when one does.</p>",
  "<p>Use Gain Control ❶ to contest an existing Bind. A Parry ❶↺ that Stops a melee Strike may at once attempt to Gain Control of the attacking weapon, and a Riposte makes a Quick Strike instead.</p>",
  "<h2>While you Control a weapon</h2>",
  "<ul>",
  "<li>Your partner has an Exposed Zone of your choice, and it stays Exposed while the Bind lasts.</li>",
  "<li>Your partner's attacks with the Controlled weapon take a −2 Situation penalty.</li>",
  "<li>You may Close ❶: Step toward your partner while keeping the Bind. The Controlled weapon cannot Intercept you.</li>",
  "</ul>",
  "<h2>How a Bind ends</h2>",
  "<p>A Bind ends when a participant uses the bound implement to Strike (a Strike against the other participant resolves before the Bind ends), when either participant Moves or Steps unless an ability expressly preserves the Bind, when either participant Recenters, when a third party attacks the combatant who currently has Control, or when either bound implement is dropped or Disarmed. Control redirects an implement; it does not itself make its wielder Grabbed or Restrained. The Controlled combatant can still Move, Step, or attack with another weapon or limb, and attacking with an unbound weapon or limb ends the Bind before the attack roll.</p>",
  "<p>Recenter ❶ ends every Bind you are in and clears your Exposed Zones, except those Exposed by a Posture. Exposure caused specifically by Control ends when that Control ends; Exposure from other sources follows its own duration.</p>",
  "<p><strong>Size.</strong> Creatures of the same Size, or one Size apart, Bind normally. Two or more Sizes apart, the smaller creature can gain only momentary Control: it ends after its first benefit is used or at the end of the controller's next Opportunity, whichever comes first, and the larger creature can Move without first breaking the Bind.</p>",
  "<p><strong>What cannot Bind.</strong> Unless an ability says otherwise: Flexible weapons such as whips and flails, bare hands, spells and area effects, and attacks with the Unparryable trait. Incorporeal and amorphous attackers cannot be Bound unless a rule provides a way to do so.</p>",
  "<p><strong>Third parties.</strong> An ally attacking the creature whose implement you Control does not break your Bind; a third party attacking you while you have Control does.</p>",
  "<h2>The conditions</h2>",
  table(["Condition", "Effect"], conditionRows("Bound [X]", "Controlled [X]", "Controlling [X]")),
  "<h2>Maneuvers and Reactions in the Bind</h2>",
  table(["Maneuver", "Effect"], actionRows("Gain Control ❶", "Close ❶", "Recenter ❶")),
  table(["Reaction", "Grants", "Effect"], reactionRows("Parry ❶↺")),
  `<p>The Zone a Controller opens follows the rules on ${pageLink("Exposed")}.</p>`,
  "<h2>In the system</h2>",
  "<p>A Bind is recorded on both fighters and drawn on the map as a gold chain between their tokens, labelled with the two implements; a Controlled Bind runs from the Controller to the Controlled with an arrowhead and the word Control. The token carries Bound, Controlling or Controlled, and that effect names the partner, both implements and the state. The sheet's bind line and the Recenter Maneuver end it; a Strike between the two ends it when the Strike resolves.</p>"
].join("");

const journalPages = [
  ["Key Terms: Talent Points", table(
    ["Type", "May be spent on", "Flare required?"], roster.talentPointTypes ?? [])],
  ["Character Creation", table(
    ["Step", "You choose", "You get", "Talent Points"], roster.chargenSteps ?? [])],
  ["Skills", table(["Skill", "Key Attribute", "Covers"], roster.skillRoster ?? [])],
  ["Combat Styles", table(["Style", "Key Attribute", "How you wield"], roster.weaponStyles ?? [])],
  ["Damage Delivery", table(["Example", "Threat and Delivery"], roster.damageDelivery ?? [])],
  ["Spellwork", table(["Rank in the discipline", "Damage Dice"], roster.spellwork ?? [])
    + table(["Cast", "What it does"], roster.castKinds ?? [])],
  ["Weapon Size", table(["Weapon Size", "Weapon Size Factor"], roster.weaponSize ?? [])],
  ["Defenses", table(
    ["Defense", "Key Attribute", "In a word", "Physical", "Mental"], roster.defenses ?? [])],
  ["Zones and Critical Hits", table(
    ["Zone", "Critical Hit", "Critical Hit on an Exposed Zone"],
    (roster.zones ?? []).map(([z, a, b]) => [z, a, b]))],
  ["Exposed", exposedPage],
  ["The Bind", bindPage],
  ["Damage: order of operations", table(["Step", "Do this"], roster.damageOrder ?? [])],
  ["Protection: finding a Zone's number", table(["Step", "Do this"], roster.protectionSteps ?? [])],
  ["Conditions", table(["Condition", "Effect"], roster.conditions ?? [])],
  ["Weapon Traits", table(["Trait", "Effect"], roster.weaponTraits ?? [])],
  ["Armor Traits", table(["Trait", "Effect"], roster.armorTraits ?? [])],
  ["Action Traits", table(["Trait", "Effect"], roster.actionTraits ?? [])],
  ["Weapon Handling", table(["Handling", "Meaning", "If you lack Familiarity"], roster.handling ?? [])],
  // The materials-turn-poorly rule left the book in v4.21; the page keeps its title (its id is a UUID
  // other pages link) and lists the armor Types.
  ["Armor Materials", table(["Armor Type"], (roster.materials ?? []).map(([m]) => [m]))],
  ["Size, Space and Reach", table(
    ["Size", "Space", "Natural Reach", "Evade and Guard"], roster.sizes ?? [])],
  ["Detection", table(["State", "What your foe knows", "Effect", "Examples"], roster.detection ?? [])],
  ["Light", table(["If a creature is in", "Effect on you"], roster.light ?? [])],
  ["Cover", table(["Zones covered", "Grade", "Effect"], roster.cover ?? [])],
  ["Recovery Checks", table(["Result", "Effect"], roster.recovery ?? [])],
  ["Languages", table(
    ["Language", "Rarity", "Notes"], languages.map(l => [l.name, l.rarity, l.desc]))]
];

{
  const _id = REFERENCE_ID;
  push("rules", "journal", {
    _id,
    name: "STARWROUGHT Reference",
    folder: null,
    sort: 0,
    ownership: { default: 2 },
    flags: {},
    categories: [],
    _stats: { systemId: "starwrought" },
    pages: journalPages.map(([title, html], index) => {
      const pageId = docId("rules", `page:${title}`);
      return {
        _id: pageId,
        _key: `!journal.pages!${_id}.${pageId}`,
        name: title,
        type: "text",
        title: { show: true, level: 1 },
        text: { format: 1, content: html },
        image: {},
        video: { controls: true, volume: 0.5 },
        src: null,
        system: {},
        sort: index * 100,
        ownership: { default: -1 },
        flags: {},
        category: null
      };
    })
  });
}

/* -------------------------------------------- */
/*  The Automation Grammar journal (0.17.0)     */
/* -------------------------------------------- */

/* AUTOMATION_GRAMMAR.md, the grammar's reference for the person typing in an Automation cell
   (CLAUDE.md, standing rule), shipped into the game as a second journal of the rules pack so the
   Item sheet's Grammar button and the Effects panel's open the document the author reads. One page
   per `## ` section, named by the heading without its "N. " number ("At a glance", "Feature lines
   ..."), each page's id hashed from that name so it keeps its UUID across builds and across the
   lead's renumbering; the H1 title goes on nothing, and the prose between it and the first section
   opens the first page. The file is read at build time and rendered by assets/lib/markdown.mjs; a
   missing or sectionless file fails the build, since the grammar is a standing document and the
   journal would otherwise go silently stale. */
const GRAMMAR_ID = docId("rules", "journal:grammar");
const GRAMMAR_NAME = "STARWROUGHT Automation Grammar";
const grammarPath = path.join(ROOT, "AUTOMATION_GRAMMAR.md");
if (!fs.existsSync(grammarPath)) fail(`grammar journal: ${path.relative(ROOT, grammarPath)} is missing; the journal is built from it`);
const grammar = splitSections(fs.readFileSync(grammarPath, "utf8"));
if (!grammar.sections.length) fail(`grammar journal: ${path.relative(ROOT, grammarPath)} has no "## " sections to make pages of`);
const grammarPages = grammar.sections.map((section, index) => {
  const body = (index === 0 && grammar.intro) ? `${grammar.intro}\n\n${section.body}` : section.body;
  return [section.name, markdownToHtml(body)];
});

{
  const _id = GRAMMAR_ID;
  push("rules", "journal", {
    _id,
    name: GRAMMAR_NAME,
    folder: null,
    sort: 100,
    ownership: { default: 2 },
    flags: {},
    categories: [],
    _stats: { systemId: "starwrought" },
    pages: grammarPages.map(([name, html], index) => {
      const pageId = docId("rules", `grammar:${name}`);
      return {
        _id: pageId,
        _key: `!journal.pages!${_id}.${pageId}`,
        name,
        type: "text",
        title: { show: true, level: 1 },
        text: { format: 1, content: html },
        image: {},
        video: { controls: true, volume: 0.5 },
        src: null,
        system: {},
        sort: index * 100,
        ownership: { default: -1 },
        flags: {},
        category: null
      };
    })
  });
}

/* -------------------------------------------- */
/*  Macros                                      */
/* -------------------------------------------- */

const MACROS = [
  {
    name: "Recenter",
    img: "icons/svg/shield.svg",
    command: `// Recenter: clear every Exposed Zone on the selected tokens (a Posture's stays) and end any Bind.
// The Maneuver is the entry point (0.10.1): each selected actor uses the Recenter Item from the
// Actions pack, and while its row is not enabled in data/maneuvers.xlsx the actor's method runs
// directly, which is the same behaviour.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
if ( !actors.length ) return ui.notifications.warn("Select a token first.");
const pack = game.packs.get("starwrought.actions");
const entry = pack?.index.find(e => e.name === "Recenter");
const item = entry ? await pack.getDocument(entry._id) : null;
for ( const actor of actors ) await (item ? item.use({ actor }) : actor.recenter());`
  },
  {
    name: "Recovery Check",
    img: "icons/svg/heal.svg",
    command: `// A Recovery check: Endure against 10 + your Dying value + the Wounds you carry.
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if ( !actor ) ui.notifications.warn("Select a token, or set a player character.");
else await actor.rollRecovery();`
  },
  {
    name: "A Night's Rest",
    img: "icons/svg/regen.svg",
    command: `// Restore level x Presence Vigor (at least level). Wounds do not clear with rest.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
const targets = actors.length ? actors : (game.user.character ? [game.user.character] : []);
if ( !targets.length ) ui.notifications.warn("Select a token first.");
for ( const actor of targets ) await actor.restForTheNight();`
  },
  {
    name: "Relevant Check",
    img: "icons/svg/book.svg",
    command: `// A Relevant Check: you choose the Constellation, say why, and the GM approves.
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if ( !actor ) return ui.notifications.warn("Select a token, or set a player character.");
await actor.rollRelevantCheck();`
  },
  {
    name: "Roll Initiative by Activity",
    img: "icons/svg/eye.svg",
    command: `// Initiative is whatever you were already doing.
const combat = game.combat;
if ( !combat ) return ui.notifications.warn("No encounter is running.");
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
const combatant = actor ? combat.getCombatantsByActor(actor)[0] : null;
if ( !combatant ) return ui.notifications.warn("That character is not in the encounter.");
const choices = Object.fromEntries(Object.values(actor.system.constellations)
  .sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.slug, c.name]));
const slug = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Initiative" },
  content: \`<p>What were you actually doing?</p>
    <select name="slug">\${Object.entries(choices).map(([k, v]) =>
      \`<option value="\${k}">\${v}</option>\`).join("")}</select>\`,
  ok: { callback: (event, button) => button.form.elements.slug.value }
});
if ( slug ) await combat.rollInitiativeWithCheck(combatant.id, slug);`
  }
];

for (const macro of MACROS) {
  const _id = docId("macros", `macro:${macro.name}`);
  push("macros", "macros", {
    _id,
    name: macro.name,
    type: "script",
    author: null,
    img: macro.img,
    scope: "global",
    command: macro.command,
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: { systemId: "starwrought" }
  });
}

/* -------------------------------------------- */
/*  Write everything out                        */
/* -------------------------------------------- */

/** Ids are lowercase hex, so a plain code-unit comparison is the stable order (no locale in it). */
const byId = (a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

/**
 * packs/_source/<pack>/*.json, one file per document, and beside them packs/_source/index.json
 * (0.8.0, ruling 116): the catalogue the in-game Sync content tool fetches as a static file under
 * systems/starwrought/ to diff an open world's compendia against the sources without a compile.
 *
 *   { stamp, build, system,
 *     packs: { <pack>: { documents: [{ _id, name, type, file, hash }], folders: [{ _id, name, file, hash }] } } }
 *
 * `file` is relative to packs/_source/<pack>/. Every pack is listed, the rules journal and the
 * macros with the Items, since the journal's Languages, Exposed and Bind pages are built from the
 * sheets and the roster and must reach an open world too; the sync writes each pack through its
 * own document class. The `stamp` is the time of this run and changes every time; the `build` is a hash
 * over every listed entry's id and content hash, packs by name and entries by id, so it changes
 * only when content changes, and it is the one field the Foundry side compares to decide whether a
 * world has anything to sync. Everything but the stamp must be deterministic: a second run over
 * unchanged sources writes the same build, and a rerun with nothing changed syncs nothing.
 */
function writeSources() {
  fs.rmSync(SOURCE, { recursive: true, force: true });
  let count = 0;
  const listed = {};
  for (const [pack, docs] of Object.entries(packs)) {
    const dir = path.join(SOURCE, pack);
    fs.mkdirSync(dir, { recursive: true });
    const documents = [];
    const folders = [];
    for (const doc of docs) {
      const prefix = doc._key.startsWith("!folders") ? "folder_" : "";
      const file = `${prefix}${slugify(doc.name) || doc._id}_${doc._id}.json`;
      fs.writeFileSync(path.join(dir, file), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      count += 1;
      const hash = doc.flags.starwrought.contentHash;
      // Every document is listed, whatever its class: the Items, the rules journal (whose
      // Languages, Exposed and Bind pages are built from the sheets and the roster) and the macros.
      // The sync writes each through its pack's own document class. A journal has no `type`.
      if (doc._key.startsWith("!folders!")) folders.push({ _id: doc._id, name: doc.name, file, hash });
      else documents.push({ _id: doc._id, name: doc.name, type: doc.type ?? "", file, hash });
    }
    console.log(`  ${pack.padEnd(16)} ${docs.length} documents`);
    listed[pack] = { documents: documents.sort(byId), folders: folders.sort(byId) };
  }

  const index = { stamp: new Date().toISOString(), build: "", system: manifest.version, packs: {} };
  const lines = [];
  for (const pack of Object.keys(listed).sort()) {
    index.packs[pack] = listed[pack];
    for (const entry of [...listed[pack].documents, ...listed[pack].folders].sort(byId)) {
      lines.push(`${pack}|${entry._id}|${entry.hash}`);
    }
  }
  index.build = crypto.createHash("sha1").update(lines.join("\n")).digest("hex").slice(0, 16);
  fs.writeFileSync(path.join(SOURCE, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`  index.json       ${lines.length} entries in ${Object.keys(index.packs).length} packs, build ${index.build}`);
  return count;
}

function writeContentIndex() {
  fs.mkdirSync(CONTENT, { recursive: true });
  constellationIndex.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(
    path.join(CONTENT, "constellations.json"),
    `${JSON.stringify(constellationIndex, null, 2)}\n`,
    "utf8"
  );

  // Every chassis, flagged, so the sheet can explain a locked name the pack no longer carries.
  fs.writeFileSync(
    path.join(CONTENT, "chassis.json"),
    `${JSON.stringify(chassisIndex, null, 2)}\n`,
    "utf8"
  );

  // The terrain kinds (0.18.0): the roster's block as the registry's records, in the roster's
  // order, for `loadTerrainKinds` (helpers/content.mjs) to read at init and after a content sync.
  fs.writeFileSync(
    path.join(CONTENT, "terrain.json"),
    `${JSON.stringify(terrainKinds(), null, 2)}\n`,
    "utf8"
  );

  // Carry the handbook version into the system, so the rules it implements can be read in game
  // rather than inferred from the system's own version number. `constellations`, `talents` and
  // `equipment` are the authored totals; `enabled` is what the packs actually hold, so the init log
  // in helpers/content.mjs can say how many of the authored Talents ship (ruling 61). Equipment
  // counts weapons, armor and shields together, from the sheet or from the roster fallback
  // (ruling 64).
  const syncPath = path.join(ROOT, "data", "SYNC.json");
  if (fs.existsSync(syncPath)) {
    const sync = JSON.parse(fs.readFileSync(syncPath, "utf8"));
    fs.writeFileSync(path.join(CONTENT, "sync.json"), `${JSON.stringify({
      phb: sync.phb,
      syncedOn: sync.syncedOn,
      constellations: tally.constellations.total,
      talents: tally.talents.total,
      equipment: tally.equipment.total,
      enabled: {
        constellations: tally.constellations.enabled,
        talents: tally.talents.enabled,
        equipment: tally.equipment.enabled
      }
    }, null, 2)}\n`, "utf8");
  }
}

function copyArt() {
  const dest = path.join(SYSTEM, "assets", "constellations");
  fs.mkdirSync(dest, { recursive: true });
  // Mirror the source: a plate the renderer pruned (a retired Constellation) leaves the system too.
  for (const file of fs.readdirSync(dest)) {
    if (file.endsWith(".png") && !plates.has(file)) fs.rmSync(path.join(dest, file));
  }
  let copied = 0;
  for (const file of plates) {
    if (!file.endsWith(".png")) continue;
    fs.copyFileSync(path.join(plateDir, file), path.join(dest, file));
    copied += 1;
  }
  const banner = path.join(ROOT, "assets", "cover_banner.png");
  if (fs.existsSync(banner)) {
    fs.copyFileSync(banner, path.join(SYSTEM, "assets", "cover_banner.png"));
  }
  return copied;
}

async function compile() {
  let compilePack;
  try {
    ({ compilePack } = await import("@foundryvtt/foundryvtt-cli"));
  } catch {
    console.log("\n  @foundryvtt/foundryvtt-cli is not installed, so the packs were not compiled.");
    console.log("  Run: npm install --save-dev @foundryvtt/foundryvtt-cli");
    return false;
  }
  // Foundry holds a lock on every LevelDB pack in a world it has open, and a half-deleted pack is
  // worse than an uncompiled one. So move the old pack aside first: a directory with open files
  // will not rename, which makes this the check and the backup in one move.
  const staged = [];
  for (const pack of Object.keys(packs)) {
    const dest = path.join(SYSTEM, "packs", pack);
    const aside = `${dest}.replacing`;
    try {
      fs.rmSync(aside, { recursive: true, force: true });
      if (fs.existsSync(dest)) fs.renameSync(dest, aside);
    } catch (error) {
      const locked = /LOCK|EBUSY|EPERM|resource temporarily unavailable/i.test(String(error?.message));
      console.error(`\n  Could not replace packs/${pack}: ${error.message}`);
      if (locked) console.error("  Foundry has these compendia open. Close Foundry and run this again.");
      console.error("  Nothing was changed under packs/, and packs/_source is written and current.");
      for (const [restore, from] of staged) fs.renameSync(from, restore);
      return false;
    }
    staged.push([dest, aside]);
  }

  for (const pack of Object.keys(packs)) {
    const dest = path.join(SYSTEM, "packs", pack);
    await compilePack(path.join(SOURCE, pack), dest);
    console.log(`  compiled packs/${pack}`);
  }
  for (const [, aside] of staged) fs.rmSync(aside, { recursive: true, force: true });
  return true;
}

/* -------------------------------------------- */

console.log("STARWROUGHT -> Foundry VTT");
console.log(`  system: ${path.relative(ROOT, SYSTEM)}`);
const total = writeSources();
writeContentIndex();
const art = copyArt();
console.log(`  ${total} documents written, ${constellationIndex.length} Constellations indexed, ${art} plates copied.`);
// What the Enabled? column let through, per pack, against what the sheets author (ruling 61).
const ratio = kind => `${tally[kind].enabled} of ${tally[kind].total}`;
console.log(`  enabled for Foundry: ${ratio("constellations")} constellations, ${ratio("talents")} talents, `
  + `${ratio("chassis")} chassis, ${ratio("sheetActions")} sheet actions.`);
// Weapons, armor and shields together (ruling 64), and which source built them: the roster fallback
// is always N of N, since hand-kept rows carry no flag.
console.log(`  equipment: ${ratio("equipment")} enabled`
  + (equipment ? " (data/equipment.xlsx)" : " (roster fallback: assets/equipment.json is absent)"));
// The Automation cells (0.9.0): what parsed, over how many documents, in how many kinds. With no
// kinds registered the framework can carry no rule, and the line says so rather than printing a
// bare zero; with kinds defined but no cell using them (0.10.0 until Mike pastes Humanity's cell),
// it says that instead, naming the count.
const kinds = knownKinds();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
if (automationTally.rules) {
  console.log(`  automation: ${plural(automationTally.rules, "rule")} on ${plural(automationTally.documents, "document")} `
    + `(${plural(automationTally.kinds.size, "kind")} in use)`
    + (automationTally.unread ? `; ${plural(automationTally.unread, "line")} on ${plural(automationTally.unreadDocuments, "document")} stored as errors (red on the sheet, skipped in play)` : ""));
} else if (!kinds.length) {
  console.log("  automation: no rules (no rule kinds are defined yet)");
} else {
  console.log(`  automation: no rules (${plural(kinds.length, "kind")} defined, none in use)`);
}
// The grammar journal (0.17.0): how many pages AUTOMATION_GRAMMAR.md made, one per `## ` section.
console.log(`  grammar journal: ${plural(grammarPages.length, "page")} from ${path.relative(ROOT, grammarPath)}`);

// The trait census (0.14.0; ruling 171): every trait a shipping weapon, action or Talent carries,
// by its first word, against the traits the rules' `IF(Trait=...)` ask about. A trait nothing
// carries is a warning: the rule reads and fires once an attack with that trait is authored.
if (automationTally.traitsAsked.size) {
  const carried = new Set();
  for (const weapon of equipment?.weapons ?? []) for (const t of splitTraits(weapon.traits)) carried.add(traitKey(t));
  for (const action of sheetActions) for (const t of action.traits ?? []) carried.add(traitKey(t));
  for (const tree of Object.values(trees)) for (const node of tree.nodes ?? []) for (const t of node.traits ?? []) carried.add(traitKey(t));
  for (const [trait, askers] of automationTally.traitsAsked) {
    if (carried.has(trait)) continue;
    console.warn(`  WARNING: IF(Trait=${askers[0].match(/\(([^)]*)\)$/)?.[1] ?? trait}): no shipping weapon, attack or Talent carries the trait "${trait}" yet `
      + `(asked by ${askers.map(a => a.replace(/ \([^)]*\)$/, "")).join(", ")}); the rule fires when one is authored`);
  }
}

// --no-compile is the content loop's way in (build_all.mjs --content): the sources and the index
// are the content, and the open world syncs from them in place (ruling 115). The compile is for a
// release or a fresh install, with Foundry closed, and its lock message in compile() stays as it was.
const noCompile = process.argv.includes("--no-compile");
let compiled = null;
if (!noCompile) compiled = await compile();

if (noCompile) {
  console.log("\nSources and index written. In an open Foundry world: Settings > STARWROUGHT > Sync content");
  console.log("(the GM is also offered it at load). The compendia on disk are compiled when the full pipeline");
  console.log("runs with Foundry closed.");
} else if (compiled === false) {
  console.log("\nSources are current; the compendia were left alone.");
  process.exitCode = 1;
} else {
  console.log("Done.");
}
