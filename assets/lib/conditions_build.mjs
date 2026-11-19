/**
 * conditions_build.mjs: the Conditions workbook, read (0.33.0; rulings 322 and 323).
 *
 * `data/conditions.xlsx` is the ONLY source for what a Condition says and does. The converter
 * stages its rows as it found them (assets/xlsx_to_trees.py, build/conditions.staged.json) and
 * knows nothing of the grammar or of which Conditions the system has; this module is the rest:
 *
 *   1. every Automation cell parsed with the system's grammar, as a Condition's row
 *      (`itemType: "condition"`: CHECK, ATK, DEF, INIT, with `-N` for the Condition's own value);
 *   2. the rows laid over the system's own Conditions (`registerConditions`), which refuses a row
 *      it cannot take and says which rows made NEW Conditions;
 *   3. the checks only the whole sheet can make: every Condition the system has must have a row,
 *      every name must be one a cell can write, an "against X" needs a Condition that takes X;
 *   4. the two outputs, built together: `assets/conditions.json` (every row with its rules) and
 *      the roster's `conditions` block (`[name, effect]` for the Listed rows, which the web app,
 *      the compendium docx and the Rules Reference journal read).
 *
 * Nothing is written here: the caller (assets/parse_rules.mjs) writes both outputs only when
 * `errors` is empty, so a workbook with a slip in it never leaves a half-written file.
 *
 * Imported by assets/parse_rules.mjs; pure Node, no Foundry.
 */

import { parseAutomation, isNotApplicableCell } from "../../foundry/starwrought/module/rules/grammar.mjs";
import { CONDITION_ROW } from "../../foundry/starwrought/module/rules/syntax.mjs";
import { readRequires } from "../../foundry/starwrought/module/rules/requires.mjs";
import { readEffectName } from "../../foundry/starwrought/module/rules/effect-list.mjs";
// The registry is the config's CONDITIONS (module/rules/effects.mjs exports a list of condition
// WORDS under the same name; it is not that).
import {
  CONDITIONS as REGISTRY, registerConditions, conditionLabel, conditionRowName, readInclude
} from "../../foundry/starwrought/module/config.mjs";

/** The suffix the reference tables print after a Condition's name, by what it takes. */
const SUFFIX = Object.freeze({ n: " N", zone: " [Zone]", x: " [X]" });

/** The four Defenses, which a row's `DEF: ..., evade` names and a `--conditions` run may have no tree for. */
const DEFENSES = Object.freeze({
  evade: { type: "constellation", slug: "evade", name: "Evade", category: "Defense" },
  guard: { type: "constellation", slug: "guard", name: "Guard", category: "Defense" },
  endure: { type: "constellation", slug: "endure", name: "Endure", category: "Defense" },
  awareness: { type: "constellation", slug: "awareness", name: "Awareness", category: "Defense" }
});

/** A row's name as the reference tables print it: "Frightened N", "Exposed [Zone]", "Bound [X]". */
export function listedName(name, takes) {
  return `${name}${SUFFIX[String(takes ?? "").toLowerCase()] ?? ""}`;
}

/** A Description as the roster's tables hold one: its paragraphs with a blank line between. */
function listedText(description) {
  return String(description ?? "").split(/\n+/).map(s => s.trim()).filter(Boolean).join("\n\n");
}

/**
 * The registry's rows from a conditions.json (or the staged rows once parsed): what
 * `registerConditions` takes. Used by every tool that must know the Conditions before it parses a
 * cell (parse_rules, build_foundry, the red-cell tool).
 * @param {{conditions?: object[]}|null} json
 * @returns {object[]}
 */
export function registryRows(json) {
  return (json?.conditions ?? []).map(c => ({
    name: c.name, takes: c.takes, description: c.description, includes: c.includes, rules: c.rules,
    system: c.system === true, icon: c.icon, listed: c.listed !== false, ...(c.statusId ? { statusId: c.statusId } : {})
  }));
}

/**
 * Read the staged rows.
 * @param {object} input
 * @param {{source?: string[], conditions?: object[]}} input.staged  The converter's staged rows.
 * @param {(name: string) => object|null} [input.resolve]  The build's resolver (Constellations and
 *        Maneuvers by name), which a `DEF: ..., evade` is resolved with; the four Defenses are
 *        known here whatever it answers.
 * @returns {{errors: string[], warnings: string[], created: string[], json: object|null, block: Array|null, rules: number, cells: number}}
 *          `json` and `block` are null when `errors` is not empty. THE REGISTRY IS LEFT HOLDING
 *          THESE ROWS when there are no errors, and holding the system's own Conditions alone
 *          when there are (whatever it held before: the caller registers what it wants next, as
 *          assets/parse_rules.mjs registers the last conditions.json built).
 */
export function buildConditions({ staged, resolve = null } = {}) {
  const errors = [];
  const warnings = [];
  const source = staged?.source ?? [];
  const rows = Array.isArray(staged?.conditions) ? staged.conditions : [];
  const resolver = name => {
    const found = (typeof resolve === "function") ? resolve(name) : null;
    return found ?? DEFENSES[String(name ?? "").trim().toLowerCase()] ?? null;
  };
  let rules = 0;
  let cells = 0;

  // 1. The cells.
  const parsedRows = [];
  for (const row of rows) {
    const name = conditionRowName(row.name);
    const where = `${row.workbook ? `data/${row.workbook}` : "data/conditions.xlsx"} / Conditions / ${name}`;
    const takes = String(row.takes ?? "").trim().toLowerCase();
    const text = String(row.automation ?? "");
    let parsed = { rules: [], errors: [], warnings: [] };
    if (text.trim() && !isNotApplicableCell(text)) {
      parsed = parseAutomation(text, { resolve: resolver, itemName: name, constellation: "Conditions", itemType: CONDITION_ROW, takes });
      for (const e of parsed.errors) errors.push(`automation: ${where}, line ${e.line}: ${e.message} ("${e.text}")`);
      if (parsed.warnings.length) warnings.push(`${where}, line ${parsed.warnings[0].line}: ${parsed.warnings[0].message} ("${parsed.warnings[0].text}")`);
      if (!parsed.errors.length && parsed.rules.length) { rules += parsed.rules.length; cells += 1; }
    }
    // An `against X` is the creature that put the INCLUDING Condition on: that Condition takes X.
    const includes = (Array.isArray(row.includes) ? row.includes : []).map(readInclude).filter(Boolean);
    if (includes.some(i => i.against) && (takes !== "x")) {
      errors.push(`${where}: Includes says "against X", and this Condition's Takes is not X: there is no creature for X to be`);
    }
    // The author's traps: two lines of one row that both reach one roll are both counted.
    const scopes = new Set(parsed.rules.filter(r => r.to?.type === "scope").map(r => r.to.slug));
    if (scopes.has("checks") && scopes.has("initiative")) {
      warnings.push(`${where}: a CHECK line and an INIT line: an Initiative is a check, so it takes both. Keep the CHECK line alone unless Initiative is meant to count twice`);
    }
    if (scopes.has("defenses") && parsed.rules.some(r => (r.to?.type !== "scope") && Object.hasOwn(DEFENSES, String(r.to?.slug ?? "")))) {
      warnings.push(`${where}: a DEF line for every Defense and a DEF line for one of them: that Defense takes both`);
    }
    parsedRows.push({ row, name, takes, where, includes, rules: parsed.errors.length ? [] : parsed.rules });
  }

  // 2. The registry. Nothing is changed when it refuses a row.
  let answer = null;
  if (!errors.length) {
    try {
      answer = registerConditions(parsedRows.map(p => ({
        name: p.name, takes: p.takes, description: p.row.description, includes: p.includes, rules: p.rules,
        system: p.row.system === true, icon: p.row.icon, listed: p.row.listed !== false
      })));
    } catch (error) {
      errors.push(`${source.join(", ") || "data/conditions.xlsx"} / Conditions: ${error.message}`);
    }
  }

  // 3. What only the whole sheet can say.
  if (answer) {
    if (answer.missing.length) {
      const names = answer.missing.map(id => (id === "exposed") ? "Exposed" : conditionLabel(id));
      errors.push(`${source.join(", ") || "data/conditions.xlsx"} / Conditions: no row for ${names.join(", ")}. `
        + `Every Condition the system has needs its row: the workbook is the only source for what a Condition says`);
    }
    for (const p of parsedRows) {
      const key = p.name.toLowerCase().replace(/[\s-]+/g, "");
      if (key === "exposed") {
        if (p.rules.length) errors.push(`${p.where}: the Exposed row describes the four Zones' statuses together and carries no lines; an Exposed Zone is the Zone's own`);
        continue;
      }
      // A name a cell cannot write would be a Condition nothing could ever ask for.
      let id = null;
      try {
        const read = readEffectName(p.name);
        id = read.condition;
        if (!id) errors.push(`${p.where}: the name reads as a named Effect and not as this Condition; rename the row`);
      } catch (error) {
        errors.push(`${p.where}: the name cannot be written in a cell (${error.message}); rename the row`);
      }
      if (!id) continue;
      try {
        const term = readRequires(p.name).any?.[0] ?? null;
        const asCondition = (term?.test === "condition") && (term.id === id) && !term.not;
        const asSupine = (term?.test === "supine") && (id === "supine");
        if (!asCondition && !asSupine) errors.push(`${p.where}: \`[REQUIRES ${p.name.toLowerCase()}]\` would read the name as something else; rename the row`);
      } catch (error) {
        errors.push(`${p.where}: \`[REQUIRES ${p.name.toLowerCase()}]\` cannot read the name (${error.message}); rename the row`);
      }
      // A row that says N and a Condition the system counts no value for (a built-in keeps its own).
      if ((p.takes === "n") && !REGISTRY[id]?.numeric) {
        errors.push(`${p.where}: Takes is N, and the system keeps no value for ${conditionLabel(id)}: its \`-N\` lines would always count 1`);
      }
    }
  }

  // A failed sheet leaves the registry as the system ships it, never this sheet's and never an
  // earlier one's: every failure, whichever step found it.
  if (errors.length || !answer) {
    registerConditions([]);
    return { errors, warnings, created: [], json: null, block: null, rules: 0, cells: 0 };
  }

  // 4. The outputs.
  const conditions = parsedRows.map(p => {
    const key = p.name.toLowerCase().replace(/[\s-]+/g, "");
    const id = (key === "exposed") ? "exposed" : readEffectName(p.name).condition;
    const record = REGISTRY[id] ?? null;
    return {
      id,
      name: p.name,
      takes: p.takes,
      description: String(p.row.description ?? ""),
      includes: p.includes,
      automation: String(p.row.automation ?? ""),
      rules: p.rules,
      system: p.row.system === true,
      listed: p.row.listed !== false,
      icon: String(p.row.icon ?? ""),
      notes: String(p.row.notes ?? ""),
      builtIn: (id === "exposed") || (record?.builtIn === true),
      // A new Condition's static status id is fixed here, so every client and every build agree.
      ...((record && !record.builtIn) ? { statusId: record.statusId } : {})
    };
  });
  const block = conditions.filter(c => c.listed).map(c => [listedName(c.name, c.takes), listedText(c.description)]);
  return { errors, warnings, created: answer.created.map(id => conditionLabel(id)), json: { source, conditions }, block, rules, cells };
}
