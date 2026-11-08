#!/usr/bin/env node
/**
 * parse_cells.mjs: the grammar's verdict on a batch of Automation cells, for highlight_automation.py.
 *
 *   node assets/lib/parse_cells.mjs <request.json> <reply.json>
 *
 * The Python highlighter (assets/highlight_automation.py, 2026-11-08; Mike: "Any automation fields
 * that I may have mis-typed, or for which there are not yet Kinds, highlight those cells in red")
 * reads the workbooks and paints the cells; it holds no parser (ruling 120: Python never holds a
 * second grammar). This helper is the one parse, with the system's own `parseAutomation` and the
 * build's own resolver (assets/lib/rule_targets.mjs), so a cell is red here exactly when
 * parse_rules.mjs would refuse it. It reads the workbooks' facts from the request rather than from
 * trees.json and actions.json, because the converter may be refusing to write those while the
 * sheets are mid-restructure, which is precisely when the author wants the red cells.
 *
 * Request:  { trees: { "<name>": { parent, category } }, sheetActions: [{ name, enabled }],
 *             cells: [{ id, text, itemName, constellation, itemType, source }] }
 * Reply:    { vocabulary: { kinds, tags, keywords, conditions, components, terrainKinds, ranks,
 *                           sizes, grantScopes, defenses, threats },
 *             results: [{ id, rules, errors: [{ line, text, message }], warnings: [...] }] }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAutomation } from "../../foundry/starwrought/module/rules/grammar.mjs";
import { knownKinds } from "../../foundry/starwrought/module/rules/kinds/index.mjs";
import { EFFECT_TAGS, CONDITIONS, COMPONENTS } from "../../foundry/starwrought/module/rules/effects.mjs";
import { FEATURE_KEYWORD_LIST } from "../../foundry/starwrought/module/rules/features.mjs";
import { GRANT_SCOPES } from "../../foundry/starwrought/module/rules/kinds/grant.mjs";
import { registerTerrainKinds, TERRAIN_KINDS, RANKS, SIZES, DEFENSES, THREATS } from "../../foundry/starwrought/module/config.mjs";
import { buildResolver } from "./rule_targets.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, "..");

const [requestFile, replyFile] = process.argv.slice(2);
if (!requestFile || !replyFile) {
  console.error("usage: node assets/lib/parse_cells.mjs <request.json> <reply.json>");
  process.exit(2);
}

const request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
const roster = JSON.parse(fs.readFileSync(path.join(ASSETS, "roster.json"), "utf8"));

// The terrain kinds are the roster's (0.18.0), registered before any `[EFFECT IGNORE: terrain, ...]` is read.
registerTerrainKinds(roster.terrainKinds);

const trees = {};
for (const [name, facts] of Object.entries(request.trees ?? {})) {
  trees[name] = { parent: facts?.parent ?? "", group: !!facts?.parent, category: facts?.category ?? "" };
}
const resolve = buildResolver({ trees, sheetActions: request.sheetActions ?? [], roster });

const results = (request.cells ?? []).map(cell => {
  const parsed = parseAutomation(String(cell.text ?? ""), {
    itemName: cell.itemName, constellation: cell.constellation, itemType: cell.itemType, source: cell.source, resolve
  });
  return { id: cell.id, rules: parsed.rules, errors: parsed.errors, warnings: parsed.warnings };
});

const vocabulary = {
  kinds: knownKinds(),
  tags: Object.keys(EFFECT_TAGS).map(t => t.toUpperCase()),
  keywords: [...FEATURE_KEYWORD_LIST],
  conditions: [...CONDITIONS],
  components: [...COMPONENTS],
  terrainKinds: Object.values(TERRAIN_KINDS).map(k => k.name ?? k.slug ?? String(k)),
  ranks: Object.keys(RANKS ?? {}),
  sizes: Object.keys(SIZES ?? {}),
  grantScopes: Object.values(GRANT_SCOPES ?? {}),
  defenses: Object.values(DEFENSES ?? {}).map(d => d.slug ?? d),
  threats: Object.keys(THREATS ?? {})
};

fs.writeFileSync(replyFile, JSON.stringify({ vocabulary, results }, null, 1), "utf8");
console.log(`parse_cells: ${results.length} cells parsed, ${results.filter(r => r.errors.length).length} with errors`);
