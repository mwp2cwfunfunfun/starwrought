#!/usr/bin/env node
/**
 * parse_rules.mjs: the one parse of every Automation cell (0.16.0).
 *
 *   assets/trees.json + assets/actions.json + assets/backgrounds.json + assets/roster.json
 *     -> the same four files, with `rules` beside every non-empty `automation`, the chassis facts
 *        the Roots' feature lines state written onto the roster's records, and every
 *        `@Maneuver[Name]` marker in an Effect expanded into the Maneuver's block
 *
 * Runs right after xlsx_to_trees.py and before inject.py (build_all.mjs, every step-running mode),
 * so every consumer downstream (the web app, the plates, the compendium docx, the Foundry build)
 * reads one parse rather than each making its own. The grammar is the system's
 * (foundry/starwrought/module/rules/grammar.mjs, pure, imported from plain Node; ruling 120:
 * Python holds no parser), the resolver is the shared one in assets/lib/rule_targets.mjs, which
 * build_foundry.mjs also imports, and a cell that does not parse FAILS the pipeline here naming
 * the Constellation, the Talent and the line, as build_foundry.mjs failed through 0.15.0 (ruling
 * 118), before any file is written: nothing half-read reaches the app or the pack sources. A line
 * that reads but is on its way out (0.17.0: a bare effect line, which belongs in `[EFFECT ...]`; an
 * `[AURA ... visible]`) is WARNED about once per cell; the 0.13.0 operator form is refused.
 *
 * THE CHASSIS FACTS. A Root's feature lines are the authoring of what the chassis confers
 * ([VIGOR 8], [SIZE Medium], [SPEED 6], [SENSES ...], [TRAIT Human], [LANGUAGE Common, Serrovine],
 * a Calling's [VIGOR opening 12]); the _Tree Index columns that carried them are retired and read
 * for one release. Where the Root states a fact it WINS and the record is overwritten; where the
 * converter also put a value from a retired column that DISAGREES, that is an ERROR naming the
 * column (the Grants column's precedent); where the Root says nothing the column's value stands
 * silently. The converter supplies a default where the column is blank or absent (Size Medium,
 * Speed 6 ft, Senses "—"), and the record cannot tell a default from a typed value, so a record
 * that reads the default is taken as the column saying nothing: the Root wins without a word.
 *
 * THE MARKER. `@Maneuver[Name]` in a Talent's or a Background's Effect prints the named Maneuver's
 * block (its name with the cost glyphs, its Trigger and Requirements when it has them, then its
 * Effect) in place of the marker, from the matching row of assets/actions.json, so the Maneuver is
 * authored once, on its sheet. The text as written is kept beside it as `effectSource`. A name
 * that is no row is an ERROR naming the cell.
 *
 * Usage:  node assets/parse_rules.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAutomation, ruleEntries } from "../foundry/starwrought/module/rules/grammar.mjs";
import { knownKinds } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { plainName, costGlyphs, registerTerrainKinds } from "../foundry/starwrought/module/config.mjs";
import { buildResolver } from "./lib/rule_targets.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = HERE;

/* -------------------------------------------- */
/*  The files                                   */
/* -------------------------------------------- */

/**
 * The converter writes these with Python's `json.dump(indent=1, ensure_ascii=False)` in text mode,
 * which on Windows means CRLF line endings and no newline at the end. The same shape is written
 * back here, each file keeping the line ending it had, so a run that adds nothing changes nothing
 * and the diff of a run that does is the rules alone.
 */
function load(name) {
  const file = path.join(ASSETS, name);
  const text = fs.readFileSync(file, "utf8");
  return { file, name, data: JSON.parse(text), crlf: text.includes("\r\n") };
}

function save({ file, data, crlf }) {
  let text = JSON.stringify(data, null, 1);
  if (crlf) text = text.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, text, "utf8");
}

const trees = load("trees.json");
const actions = load("actions.json");
const backgrounds = load("backgrounds.json");
const roster = load("roster.json");

const sheetActions = actions.data.actions ?? [];
const resolve = buildResolver({ trees: trees.data, sheetActions, roster: roster.data });

// The terrain kinds (0.18.0) are the roster's hand-kept `terrainKinds` block, registered before any
// cell is parsed so `[EFFECT IGNORE: terrain, mud]` is checked against the roster and an unknown
// kind's message lists the roster's names. The block's shape is build_foundry.mjs's to refuse in
// detail (it fails the build); here a block that will not register fails the step the same way.
try {
  if (!registerTerrainKinds(roster.data.terrainKinds)) {
    throw new Error("the block is missing or empty (rows of [name, description, difficulty, colour])");
  }
} catch (error) {
  console.error(`RULE ERRORS (nothing written):\n  - roster.json terrainKinds: ${error.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const tally = { rules: 0, cells: 0, kinds: new Set(), warned: 0, roots: 0, markers: 0, unread: 0, unreadCells: 0 };

/**
 * `--lenient` (2026-11-07; the content loop passes it): a cell line the grammar cannot read does
 * NOT stop the step. Mike, with new sheets half-authored ("there are some duplicates and other
 * missing items in terms of the spreadsheets, but let's make a new build anyway"): a `[Medicine
 * trained]` on a Background before the Medicine sheet exists, a `[MANEUVER Rally]` before Rally's
 * row, a note-to-self typed in a cell. Each such line is stored on its carrier as the client
 * stores a GM's unparsed textarea line, `{ error, line, text }` (ruleEntries), which the Item
 * sheet shows in red and the engine skips (ruling 118's shape, the build's refusal lifted), and
 * every one is printed under an AUTOMATION ERRORS banner so the list stays in front of the author.
 * The full pipeline (a release) still fails on the first such line, as it always has.
 */
const lenient = process.argv.includes("--lenient");
const unread = [];

/* -------------------------------------------- */
/*  The cells                                   */
/* -------------------------------------------- */

/**
 * Parse one cell and write its rules onto the carrier. A line that does not parse is an error in
 * build_foundry's words (`automation: <source>, line <n>: <message> ("<text>")`); a cell the
 * grammar warns about (whatever warns next; the 0.17.0 bare line and `visible` are errors since
 * 0.18.0) is warned about once, quoting its first such line; a `[MANEUVER ...]` naming a row that
 * is not enabled is an error on an enabled carrier (Foundry could not grant it) and a warning on
 * one that is off.
 * @param {object} carrier    A node, an action or a background: `automation` in, `rules` out.
 * @param {object} context    `{ itemName, constellation, itemType, source }`.
 */
function parseCell(carrier, context) {
  const text = String(carrier.automation ?? "");
  if (!text.trim()) {
    delete carrier.rules;
    return;
  }
  const parsed = parseAutomation(text, { ...context, resolve });
  for (const e of parsed.errors) {
    (lenient ? unread : errors).push(`automation: ${context.source}, line ${e.line}: ${e.message} ("${e.text}")`);
  }
  if (parsed.errors.length) {
    if (!lenient) return;
    // Lenient: the lines that read are rules, the rest error entries, all on the carrier.
    tally.unread += parsed.errors.length;
    tally.unreadCells += 1;
    for (const rule of parsed.rules) tally.kinds.add(rule.kind);
    tally.rules += parsed.rules.length;
    tally.cells += 1;
    carrier.rules = ruleEntries(parsed);
    return;
  }
  // The grammar's warnings, one per cell, the first such line quoted.
  if (parsed.warnings.length) {
    tally.warned += 1;
    const first = parsed.warnings[0];
    warnings.push(`${context.source}, line ${first.line}: ${first.message} ("${first.text}")`);
  }
  for (const rule of parsed.rules) {
    tally.kinds.add(rule.kind);
    if ((rule.kind === "maneuver") && (rule.enabled === false)) {
      const message = `${context.source}: [MANEUVER ${rule.name}] names a Maneuver whose row is not enabled `
        + `(Enabled? in data/maneuvers.xlsx); Foundry cannot grant it`;
      (carrier.enabled === false ? warnings : errors).push(message);
    }
  }
  tally.rules += parsed.rules.length;
  tally.cells += 1;
  carrier.rules = parsed.rules;
}

for (const [treeName, tree] of Object.entries(trees.data)) {
  for (const node of tree.nodes ?? []) {
    parseCell(node, {
      itemName: node.name, constellation: treeName, itemType: "talent", source: `${treeName} / ${node.name}`
    });
  }
}

for (const action of sheetActions) {
  const group = action.sheet || action.type || "";
  const workbook = action.workbook ? `data/${action.workbook}` : "data/actions.xlsx";
  parseCell(action, {
    itemName: action.name, constellation: group, itemType: "action", source: `${workbook} / ${group} / ${action.name}`
  });
}

for (const background of backgrounds.data) {
  parseCell(background, {
    itemName: background.name, constellation: "Backgrounds", itemType: "background", source: `Backgrounds / ${background.name}`
  });
}

/* -------------------------------------------- */
/*  The chassis facts                           */
/* -------------------------------------------- */

const titled = word => (word ? word[0].toUpperCase() + word.slice(1) : word);
const sameWords = (a, b) => {
  const norm = list => list.map(s => String(s).trim().toLowerCase()).filter(Boolean).sort().join("|");
  return norm(a) === norm(b);
};
const splitList = text => String(text ?? "").split(/,|•/).map(s => s.trim()).filter(Boolean);

/** The Root of a tree and its rules; null when the tree or its Root is missing. */
function rootOf(treeName) {
  const tree = trees.data[treeName];
  const root = (tree?.nodes ?? []).find(n => n.root);
  return root ? { tree, root, rules: root.rules ?? [] } : null;
}

/**
 * One fact from one Root onto one record field. `read` turns the rule(s) into the value to store;
 * `shown` renders a value for the message; `agrees` compares the record's value with the Root's;
 * `isDefault` says the record holds the converter's default, which cannot be told from a column
 * saying nothing. Returns true when the Root supplied the fact.
 */
function fact({ where, column, keyword, record, field, current, value, shown, agrees, isDefault = () => false }) {
  if (value === undefined) return false;
  const has = (current !== undefined) && (current !== null) && (current !== "") && !isDefault(current);
  if (has && !agrees(current, value)) {
    errors.push(`${where}: the _Tree Index ${column} reads ${shown(current)} but the Root's [${keyword}] says ${shown(value)}; drop the column`);
    return false;
  }
  record[field] = value;
  return true;
}

/** The one rule of a kind on a Root, or an error when it is written twice. */
function single(rules, kind, where, keyword, predicate = () => true) {
  const found = rules.filter(r => (r.kind === kind) && predicate(r));
  if (found.length > 1) errors.push(`${where}: the Root carries [${keyword}] ${found.length} times; one states the fact`);
  return found[0];
}

function ancestryFacts(record) {
  const treeName = record.tree ?? record.name;
  const found = rootOf(treeName);
  if (!found) return;
  const { rules } = found;
  const where = treeName;
  let supplied = 0;

  const vigor = single(rules, "vigor", where, "VIGOR", r => r.scope === "level");
  if (rules.some(r => (r.kind === "vigor") && (r.scope === "opening"))) {
    warnings.push(`${where}: an Ancestry's Vigor is per level; [VIGOR opening N] is a Calling's and is ignored here`);
  }
  supplied += fact({
    where, column: "Vigor", keyword: "VIGOR", record, field: "vigor",
    current: record.vigor ?? record.hp, value: vigor?.value,
    shown: v => String(v), agrees: (a, b) => Number(a) === Number(b)
  });
  if (vigor) record.hp = vigor.value; // mirrored for one release, as the converter writes it

  const size = single(rules, "size", where, "SIZE");
  supplied += fact({
    where, column: "Size", keyword: "SIZE", record, field: "size",
    current: record.size, value: size ? titled(size.size) : undefined,
    shown: v => String(v), agrees: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
    isDefault: v => String(v).toLowerCase() === "medium"
  });

  const speed = single(rules, "speed", where, "SPEED", r => r.mode === "set");
  supplied += fact({
    where, column: "Speed", keyword: "SPEED", record, field: "speed",
    current: record.speed, value: speed ? `${speed.feet} ft` : undefined,
    shown: v => String(v), agrees: (a, b) => parseInt(String(a), 10) === parseInt(String(b), 10),
    isDefault: v => parseInt(String(v), 10) === 6
  });

  const senses = rules.filter(r => r.kind === "sense").map(r => r.name);
  supplied += fact({
    where, column: "Senses", keyword: "SENSES", record, field: "senses",
    current: record.senses, value: senses.length ? senses.join(", ") : undefined,
    shown: v => `"${v}"`, agrees: (a, b) => sameWords(splitList(a), splitList(b)),
    isDefault: v => ["—", "-", "none"].includes(String(v).trim().toLowerCase())
  });

  const traits = rules.filter(r => r.kind === "trait").map(r => r.name);
  supplied += fact({
    where, column: "Traits", keyword: "TRAIT", record, field: "traits",
    current: Array.isArray(record.traits) && record.traits.length ? record.traits : undefined,
    value: traits.length ? traits : undefined,
    shown: v => `"${[].concat(v).join(", ")}"`, agrees: sameWords
  });

  // An Ancestry record carries no languages today (only a Culture grants a language); a Root that
  // states them is written as the cultures' field, for a reader that wants it.
  const languages = rules.filter(r => r.kind === "language").flatMap(r => r.languages ?? []);
  supplied += fact({
    where, column: "Languages", keyword: "LANGUAGE", record, field: "languages",
    current: record.languages, value: languages.length ? languages.join(", ") : undefined,
    shown: v => `"${v}"`, agrees: (a, b) => sameWords(splitList(a), splitList(b))
  });

  if (supplied) tally.roots += 1;
}

function cultureFacts(record) {
  const treeName = record.tree ?? record.name;
  const found = rootOf(treeName);
  if (!found) return;
  const { rules } = found;
  const where = treeName;
  let supplied = 0;

  const languages = rules.filter(r => r.kind === "language").flatMap(r => r.languages ?? []);
  supplied += fact({
    where, column: "Languages", keyword: "LANGUAGE", record, field: "languages",
    current: record.languages, value: languages.length ? languages.join(", ") : undefined,
    shown: v => `"${v}"`, agrees: (a, b) => sameWords(splitList(a), splitList(b))
  });

  const traits = rules.filter(r => r.kind === "trait").map(r => r.name);
  supplied += fact({
    where, column: "Traits", keyword: "TRAIT", record, field: "traits",
    current: Array.isArray(record.traits) && record.traits.length ? record.traits : undefined,
    value: traits.length ? traits : undefined,
    shown: v => `"${[].concat(v).join(", ")}"`, agrees: sameWords
  });

  if (supplied) tally.roots += 1;
}

/** The roster's hand-kept callings rows: [name, training, openingVigor, attribute, ability]. */
function callingFacts(row) {
  const name = row[0];
  const found = rootOf(name);
  if (!found) return;
  const { rules } = found;
  const vigor = single(rules, "vigor", name, "VIGOR opening", r => r.scope === "opening");
  if (rules.some(r => (r.kind === "vigor") && (r.scope === "level"))) {
    warnings.push(`${name}: a Calling's Vigor is Opening Vigor, paid once; write [VIGOR opening N] (the per-level [VIGOR N] is an Ancestry's and is ignored here)`);
  }
  if (!vigor) return;
  const current = row[2];
  if ((current !== undefined) && (current !== null) && (current !== "") && (Number(current) !== vigor.value)) {
    errors.push(`${name}: the roster's callings row reads ${current} Opening Vigor but the Root's [VIGOR opening] says ${vigor.value}; correct the row`);
    return;
  }
  row[2] = vigor.value;
  tally.roots += 1;
}

for (const record of roster.data.ancestries ?? []) if (record && (typeof record === "object")) ancestryFacts(record);
for (const record of roster.data.cultures ?? []) if (record && (typeof record === "object") && !Array.isArray(record)) cultureFacts(record);
for (const row of roster.data.callings ?? []) if (Array.isArray(row)) callingFacts(row);

/* -------------------------------------------- */
/*  The @Maneuver[Name] marker                  */
/* -------------------------------------------- */

const MARKER = /@Maneuver\[([^\]]+)\]/g;
const actionsByName = new Map();
for (const action of sheetActions) {
  const key = plainName(action.name).toLowerCase();
  if (!actionsByName.has(key)) actionsByName.set(key, action);
}

/** Blank-line separated prose as paragraphs; single breaks stay breaks. */
function paragraphs(html) {
  const text = String(html ?? "").trim();
  if (!text) return "";
  return text.split(/(?:\s*<br\s*\/?>\s*){2,}/).map(s => s.trim()).filter(Boolean).map(s => `<p>${s}</p>`).join("");
}

/** The Maneuver's block: name and glyphs, Trigger and Requirements when present, then its Effect. */
function maneuverBlock(action) {
  const glyphs = costGlyphs(action);
  let out = `<div class="sw-maneuver-block"><p><strong>${plainName(action.name)}${glyphs ? ` ${glyphs}` : ""}</strong></p>`;
  if (String(action.trigger ?? "").trim()) out += `<p><strong>Trigger</strong> ${String(action.trigger).trim()}</p>`;
  if (String(action.requirements ?? "").trim()) out += `<p><strong>Requirements</strong> ${String(action.requirements).trim()}</p>`;
  out += paragraphs(action.effect);
  return `${out}</div>`;
}

/**
 * Expand the markers of one carrier's Effect. The text as written is kept as `effectSource`, and
 * is what a rerun expands from, so the step is the same run twice.
 */
function expandMarkers(carrier, where) {
  const source = carrier.effectSource ?? carrier.effect ?? "";
  MARKER.lastIndex = 0;
  if (!MARKER.test(source)) {
    delete carrier.effectSource;
    return;
  }
  let failed = false;
  const expanded = source.replace(MARKER, (whole, name) => {
    const action = actionsByName.get(plainName(name).trim().toLowerCase());
    if (!action) {
      errors.push(`${where}: @Maneuver[${name.trim()}] names no row of the actions workbook (data/maneuvers.xlsx)`);
      failed = true;
      return whole;
    }
    tally.markers += 1;
    return maneuverBlock(action);
  });
  if (failed) return;
  carrier.effectSource = source;
  carrier.effect = expanded;
}

for (const [treeName, tree] of Object.entries(trees.data)) {
  for (const node of tree.nodes ?? []) expandMarkers(node, `${treeName} / ${node.name}`);
}
for (const background of backgrounds.data) expandMarkers(background, `Backgrounds / ${background.name}`);

/* -------------------------------------------- */
/*  The verdict                                 */
/* -------------------------------------------- */

for (const w of warnings) console.log(`WARNING: ${w}`);
if (errors.length) {
  console.error("RULE ERRORS (nothing written):");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
if (unread.length) {
  console.log("");
  console.log("=".repeat(72));
  console.log(`AUTOMATION ERRORS (a warning in content mode): ${plural(unread.length, "line")} on ${plural(tally.unreadCells, "cell")} did not read.`);
  console.log("Each is stored on its Item as an error, shown in red on the Item sheet's Automation panel and skipped");
  console.log("in play; the full pipeline (a release) stops on the first of them until the cell is mended.");
  console.log("=".repeat(72));
  for (const e of unread) console.log(`  - ${e}`);
  console.log("");
}

save(trees);
save(actions);
save(backgrounds);
save(roster);

const kinds = tally.rules ? `${plural(tally.kinds.size, "kind")} in use` : `${plural(knownKinds().length, "kind")} defined, none in use`;
console.log(`rules: ${plural(tally.rules, "rule")} on ${plural(tally.cells, "cell")} (${kinds}), `
  + `${plural(tally.warned, "cell")} warned${unread.length ? `, ${plural(unread.length, "line")} unread on ${plural(tally.unreadCells, "cell")}` : ""}; `
  + `chassis: facts from ${plural(tally.roots, "root")}; markers: ${tally.markers} expanded`);
