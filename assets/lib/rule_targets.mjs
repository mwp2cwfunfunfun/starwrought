/**
 * THE AUTOMATION RULES' TARGETS at build time (0.10.0; rulings 121 and 122; shared since 0.16.0).
 *
 * What a rule's target or condition names, for the grammar's kinds: `bonus ... Aid`,
 * `IF(Origin=Trained)`, `[Acrobatics trained]`, `[MANEUVER Steady the Line]`. The resolver built
 * here is handed to `parseAutomation` as `resolve` in the parse context by both of its build-time
 * callers, `assets/parse_rules.mjs` (the one parse of every cell) and `assets/build_foundry.mjs`
 * (which falls back to parsing a cell no step pre-parsed), so the two never answer differently. The
 * client's counterpart is `resolveRuleTarget` in module/helpers/content.mjs, over the registry and
 * the compendium, and the three return one shape:
 *
 *   { type: "constellation", slug, name, group, parent, category }
 *   { type: "action", slug, name, enabled }
 *   null
 *
 * Constellations are every key of trees.json (the four Defenses are trees too), matched case blind
 * on the name or on `slugify(name)`, disabled ones included: a cell may name a Constellation whose
 * Root is off, and the rule is right even while the row is. A group (PHB v4.21: a tree with a
 * Parent) has no rank of its own, so the answer carries `group` and `parent` for the kinds that
 * refuse one; `category` (0.16.0) is the index's word, from which a `[<Constellation> trained]`
 * point takes its scope. Origin is a virtual Constellation (PHB v4.21: Ancestry, Bloodline and
 * Culture share one rank). Maneuvers are every sheet action's name and every roster `actions`
 * row's plain name, enabled or not (a disabled Aid still resolves: the cell is right, the row is
 * simply off, ruling 61), matched case blind on the plain name or its slug, so a glyphed
 * "Aid ❶ (⓿↺)" and a bare "Aid" are one Maneuver; `enabled` is the sheet row's flag (a roster row
 * is always on) so a `[MANEUVER ...]` naming a row that is off can be refused by the step. A
 * Constellation wins over an action of the same name (none today). Null for anything else; the
 * Lore refusal is the kind's, not this map's, which resolves the template like any Constellation.
 *
 * Pure: imports the system's name rules (module/config/names.mjs, free of Foundry globals) and
 * nothing else.
 */

import { slugify, plainName } from "../../foundry/starwrought/module/config/names.mjs";

/**
 * @param {object} input
 * @param {object} input.trees          assets/trees.json, parsed.
 * @param {object[]} [input.sheetActions]  The `actions` list of assets/actions.json (each with `name`, `enabled`).
 * @param {object} [input.roster]       assets/roster.json, parsed, for its hand-kept `actions` block.
 * @returns {(name: string) => object|null}
 */
export function buildResolver({ trees, sheetActions = [], roster = {} }) {
  const targets = new Map();
  const add = (keys, entry) => {
    for (const key of keys) if (key && !targets.has(key)) targets.set(key, entry);
  };

  for (const treeName of Object.keys(trees ?? {})) {
    const tree = trees[treeName] ?? {};
    const slug = slugify(treeName);
    const parentName = tree.parent ?? "";
    add([treeName.trim().toLowerCase(), slug], {
      type: "constellation", slug, name: treeName,
      group: !!tree.group || !!parentName, parent: parentName,
      category: tree.category ?? ""
    });
  }
  add(["origin"], { type: "constellation", slug: "origin", name: "Origin", group: false, parent: "", category: "" });

  // Sheet actions first, so a sheet row's `enabled` is the answer for a Maneuver the roster also names.
  for (const action of sheetActions) {
    const name = plainName(action?.name ?? "");
    if (!name) continue;
    add([name.toLowerCase(), slugify(name)], { type: "action", slug: slugify(name), name, enabled: action.enabled !== false });
  }
  for (const [label] of Object.values(roster?.actions ?? {}).flat()) {
    const name = plainName(label);
    if (!name) continue;
    add([name.toLowerCase(), slugify(name)], { type: "action", slug: slugify(name), name, enabled: true });
  }

  /**
   * @param {string} name  As written in the cell: "Aid", "Armored Fighting", "armored-fighting".
   * @returns {object|null}
   */
  return function resolve(name) {
    const raw = String(name ?? "").trim();
    if (!raw) return null;
    return targets.get(raw.toLowerCase())
      ?? targets.get(plainName(raw).toLowerCase())
      ?? targets.get(slugify(raw))
      ?? null;
  };
}
