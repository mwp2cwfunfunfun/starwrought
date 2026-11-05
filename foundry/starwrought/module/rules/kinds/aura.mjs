/**
 * The `aura` rule kind (0.13.0): the ring on the map, the `Aura` column's successor. Mike's own
 * first example of what the framework was for (2026-10-03: "the Torchbearer 15' aura ... the
 * syntax that will work for OTHER auras, too, without additional coding").
 *
 *   aura: <N>ft, <Who> [, VISIBLE]
 *
 *   aura: 15ft, allies, VISIBLE     Torchbearer Human
 *   aura: 30ft, all                 Seek
 *
 * `<N>ft` is the range in feet, edge to edge from the carrier's token; `<Who>` is whom the ring is
 * about, which picks its colour (SW.AURA_COLORS): allies, enemies, all; `VISIBLE` pins it for
 * everyone by default once an encounter starts, else it draws on hover and when the owner pins it.
 *
 * The ring is a drawing and nothing more: what happens inside it is said by the other rules on
 * the same Talent (Torchbearer's `bonus ... FOR(allies, 15ft)`), so the kind has no hook. The
 * stored rule is `{ kind: "aura", line, text, range, affects, visible }`, and `toAuraField(rule)`
 * is `system.aura` exactly as the column wrote it (data/items/aura.mjs), so `rangesOf`, the canvas,
 * the token HUD and the sheets read nothing new; the build writes it and the Talent and action
 * models derive it again from the rule at prepare. The converter refuses a row with both the cell
 * and the line.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readLine, readRange } from "../operators.mjs";

const SHAPE = "aura: <N>ft, <Who> [, VISIBLE]";
const EXAMPLE = "aura: 15ft, allies, VISIBLE";
const OPERATORS_TAKEN = Object.freeze(["VISIBLE"]);
const WHO = Object.freeze(["allies", "enemies", "all"]);

/**
 * `system.aura` from a rule.
 * @param {object} rule
 * @returns {{range: number|null, affects: string, visible: boolean}}
 */
export function toAuraField(rule) {
  return {
    range: Number.isInteger(rule?.range) ? rule.range : null,
    affects: WHO.includes(rule?.affects) ? rule.affects : "all",
    visible: !!rule?.visible
  };
}

export default {
  id: "aura",
  aliases: [],

  parse(args, context = {}) {
    // The 0.16.0 shape: a feature block, `[AURA 15 allies visible]`.
    if (context?.form === "feature") {
      const tokens = String(args ?? "").trim().split(/[\s,]+/).filter(Boolean);
      const visible = tokens.length && ["visible", "pinned"].includes(tokens.at(-1).toLowerCase());
      if (visible) tokens.pop();
      // `15 ft allies` reads as well as `15ft allies`.
      if ((tokens.length === 3) && /^(ft\.?|feet)$/i.test(tokens[1])) tokens.splice(1, 1);
      if (tokens.length !== 2) throw new RuleSyntaxError("AURA is written `[AURA <N> <who> [visible]]`, as in `[AURA 15 allies visible]`");
      const range = readRange(tokens[0]);
      if (range < 1) throw new RuleSyntaxError("a ring needs a range of 1 ft or more; adjacency is the reach band, not an aura");
      const who = tokens[1].toLowerCase();
      if (!WHO.includes(who)) throw new RuleSyntaxError(`a ring is about allies, enemies or all, not "${tokens[1]}"`);
      return { range, affects: who, visible: !!visible };
    }
    if (context?.form === "effect") throw new RuleSyntaxError("an aura is a bracketed feature: `[AURA 15 allies visible]`");
    const { args: parts, ops } = readLine(args, { allow: OPERATORS_TAKEN, kind: "aura", context });
    if (parts.length !== 2) {
      throw new RuleSyntaxError(`an aura is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} argument${parts.length === 1 ? "" : "s"} given, 2 wanted)`);
    }
    const range = readRange(parts[0]);
    if (range < 1) throw new RuleSyntaxError("a ring needs a range of 1 ft or more; adjacency is the reach band, not an aura");
    const who = String(parts[1]).trim().toLowerCase();
    if (!WHO.includes(who)) throw new RuleSyntaxError(`a ring is about allies, enemies or all, not "${parts[1]}"`);
    return { range, affects: who, visible: ops.visible };
  },

  /** `a 15 ft ring about allies, pinned by default`. */
  summary(rule) {
    const range = Number(rule?.range) || 0;
    return `a ${range} ft ring about ${rule?.affects ?? "all"}${rule?.visible ? ", pinned by default" : ""}`;
  },

  hooks: {}
};
