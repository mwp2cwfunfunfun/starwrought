/**
 * The `ignore` rule kind (0.15.0; ruling 178): difficult terrain costs the owner nothing. From the
 * Kestrel Reach Culture's Riverfoot (Mike, 2026-11-05): "You ignore difficult terrain from mud,
 * decking, loose stone, and shallow water", and his direction on how: "Let's build Difficult
 * terrain INTO the maps! using a region or some sort of method! so this can be automated."
 *
 *   ignore: Terrain [, <Kind>, <Kind>, ...]
 *
 *   ignore: Terrain, Mud, Decking, Loose Stone, Shallow Water     Riverfoot
 *   ignore: Terrain                                               every kind
 *
 * `Terrain` is the one word so far (the Difficult terrain region behavior,
 * module/data/region-behaviors/difficult-terrain.mjs); the kinds are SW.TERRAIN_KINDS
 * (module/config/terrain.mjs), the same list the behavior's `kind` select offers, so a cell and a
 * region share one vocabulary. No kind named means every kind. The stored rule:
 * `{ kind: "ignore", line, text, what: "terrain", kinds: string[] (slugs; empty for all), when }`.
 *
 * NO HOOK POINT. The behavior asks `ignoresTerrain(actor, kind)` (below) from its
 * `_getTerrainEffects(token, ...)`, Foundry's own moment for the question, and answers with no
 * effect for a token whose actor ignores the kind, so that token is never split, charged, slowed or
 * labelled by the region (research of 2026-11-05: `TerrainData.resolveTerrainEffects` never sees
 * the token, so the decision belongs in the behavior). A triggered hook point would have added a
 * second dispatch for one reader; `rulesOfKind` is the index this reads.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readLine, rankMeets, refuseOutcome, refuseComponents, summarizeOperators } from "../operators.mjs";
import { TERRAIN_KINDS, terrainKindOf, terrainKindName } from "../../config.mjs";
import { rulesOfKind } from "../engine.mjs";

const SHAPE = "ignore: Terrain [, <Kind>, ...]";
const EXAMPLE = "ignore: Terrain, Mud, Shallow Water";
const OPERATORS_TAKEN = Object.freeze(["IF"]);

export default {
  id: "ignore",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form === "feature") throw new RuleSyntaxError("an ignore is an effect line, not a bracketed feature: `IGNORE: terrain, mud`");
    // `IGNORE: terrain, mud, decking` reads the same in both shapes.
    const { args: parts, ops } = (context?.form === "effect")
      ? { args: context.effect.descriptors, ops: refuseComponents(context.effect.ops, "IGNORE", ["when"]) }
      : readLine(args, { allow: OPERATORS_TAKEN, kind: "ignore", context });
    if (!parts.length || (parts[0].toLowerCase().replace(/\s+/g, "") !== "terrain")) {
      throw new RuleSyntaxError(`an ignore is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
    }
    const kinds = [];
    for (const part of parts.slice(1)) {
      const slug = terrainKindOf(part);
      if (!slug) {
        const names = Object.keys(TERRAIN_KINDS).map(terrainKindName);
        throw new RuleSyntaxError(`"${part}" is not a terrain kind: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
      }
      if (!kinds.includes(slug)) kinds.push(slug);
    }
    refuseOutcome(ops);
    return { what: "terrain", kinds, when: ops.when };
  },

  /** `ignores difficult terrain (Mud, Decking)`; `ignores all difficult terrain`. */
  summary(rule) {
    const kinds = Array.isArray(rule?.kinds) ? rule.kinds : [];
    const what = kinds.length ? `difficult terrain (${kinds.map(terrainKindName).join(", ")})` : "all difficult terrain";
    const tail = summarizeOperators(rule);
    return `ignores ${what}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {}
};

/**
 * Does this actor cross difficult terrain of a kind as open ground? Read by the Difficult terrain
 * region behavior for the token's actor; an actor with no `ignore` rules, or none naming the kind,
 * pays the region's cost. An `IF` on a rule is the owner's rank.
 * @param {object|null} actor
 * @param {string} kind  A slug of SW.TERRAIN_KINDS.
 * @returns {boolean}
 */
export function ignoresTerrain(actor, kind) {
  if (!actor || !kind) return false;
  let entries;
  try {
    entries = rulesOfKind(actor, "ignore");
  } catch {
    return false;
  }
  for (const { rule } of entries ?? []) {
    if (!rule || (rule.what !== "terrain")) continue;
    const kinds = Array.isArray(rule.kinds) ? rule.kinds : [];
    if (kinds.length && !kinds.includes(kind)) continue;
    const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
    let holds = true;
    for (const w of whens) {
      if (w.roll || w.trait || w.outcome) { holds = false; break; }
      if (typeof actor?.system?.proficiency !== "function") { holds = false; break; }
      if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
    }
    if (holds) return true;
  }
  return false;
}
