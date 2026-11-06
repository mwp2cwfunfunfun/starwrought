/**
 * The `aura` rule kind (0.13.0): the ring on the map, the `Aura` column's successor. Mike's own
 * first example of what the framework was for (2026-10-03: "the Torchbearer 15' aura ... the
 * syntax that will work for OTHER auras, too, without additional coding").
 *
 *   [AURA <N> <Who>]                 [AURA <N> <Who>; <tag>: ...; <component>; ...]
 *
 *   [AURA 30 all]                                                           Seek
 *   [AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]   Torchbearer Human
 *
 * `<N>` is the range in feet (`15`, `15ft`, `15 ft`), edge to edge from the carrier's token; `<Who>`
 * is whom the ring is about, which picks its colour (SW.AURA_COLORS): allies, enemies, all. Every
 * ring is preview-only by default since 0.17.0 (Mike: "ALL auras should be preview-only by
 * default"): it draws on hover and when the owner shows it from the Auras window; the `visible`
 * word of 0.13.0 to 0.16.0 is refused. Since 0.18.0 (Mike: "the Effects should be within the
 * AURA's brackets") the block may carry its effect after a semicolon: the grammar parses the ring
 * here, then the rest as an effect line whose FOR is the ring (`for: { who, range }`), so the
 * Rally Aura says "15 feet, allies" once; an explicit FOR inside the block is refused.
 *
 * The ring is a drawing and nothing more: what happens inside it is the effect it carries or the
 * other rules on the same Talent, so the kind has no hook. The stored rule is
 * `{ kind: "aura", line, text, range, affects }`, and `toAuraField(rule)` is `system.aura`
 * (data/items/aura.mjs), so `rangesOf`, the canvas, the token HUD and the sheets read nothing new;
 * the build writes it and the Talent and action models derive it again from the rule at prepare.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readRange } from "../operators.mjs";

const EXAMPLE = "[AURA 15 allies]";
const WHO = Object.freeze(["allies", "enemies", "all"]);

/**
 * `system.aura` from a rule.
 * @param {object} rule
 * @returns {{range: number|null, affects: string}}
 */
export function toAuraField(rule) {
  return {
    range: Number.isInteger(rule?.range) ? rule.range : null,
    affects: WHO.includes(rule?.affects) ? rule.affects : "all"
  };
}

export default {
  id: "aura",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form !== "feature") throw new RuleSyntaxError(`an aura is a bracketed feature: \`${EXAMPLE}\``);
    const tokens = String(args ?? "").trim().split(/[\s,]+/).filter(Boolean);
    // The retired word (warned in 0.17.0, refused since 0.18.0).
    if (tokens.length && ["visible", "pinned"].includes(tokens.at(-1).toLowerCase())) {
      throw new RuleSyntaxError("[AURA ... visible]: every ring is preview-only and the Auras window shows one; drop the word");
    }
    // `15 ft allies` reads as well as `15ft allies`.
    if ((tokens.length === 3) && /^(ft\.?|feet)$/i.test(tokens[1])) tokens.splice(1, 1);
    if (tokens.length !== 2) throw new RuleSyntaxError(`AURA is written \`[AURA <N> <who>]\`, as in \`${EXAMPLE}\``);
    const range = readRange(tokens[0]);
    if (range < 1) throw new RuleSyntaxError("a ring needs a range of 1 ft or more; adjacency is the reach band, not an aura");
    const who = tokens[1].toLowerCase();
    if (!WHO.includes(who)) throw new RuleSyntaxError(`a ring is about allies, enemies or all, not "${tokens[1]}"`);
    return { range, affects: who };
  },

  /** `a 15 ft ring about allies`. */
  summary(rule) {
    const range = Number(rule?.range) || 0;
    return `a ${range} ft ring about ${rule?.affects ?? "all"}`;
  },

  hooks: {}
};
