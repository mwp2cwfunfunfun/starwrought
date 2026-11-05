/**
 * The `grant` rule kind (0.13.0): Talent Points a Talent hands out at creation, the `Grants`
 * column's successor (Mike, 2026-11-05: "Move to Automation").
 *
 *   grant: <N>, <Scope> [, DIFFERENT] [, IF(...)]
 *
 *   grant: 1, Calling            Driven
 *   grant: 1, Skill              Quick Study
 *   grant: 1, Opening            Versatile Human
 *   grant: 2, Skill, DIFFERENT
 *
 * `<N>` is a whole number of 1 or more. `<Scope>` is where the points may be spent: Opening (a Root
 * of a Constellation not yet opened, the book's Opening Talent Point), Calling, Skill, Lore,
 * Defense, Combat Style, or Comet (anywhere you qualify). `DIFFERENT`, with N above 1, puts each
 * point in a different Constellation of the scope. `IF` is accepted and stored; the wizard does not
 * read it yet (a Talent whose point depends on a rank at creation has not been written).
 *
 * The stored rule: `{ kind: "grant", line, text, n, scope, different, when }`. `toGrantField(rule)`
 * is the shape the creation wizard has read since 0.4 (`system.grant { n, mode, scope }`,
 * `GRANT_SCOPES` in apps/chargen.mjs): Opening is mode "open" anywhere, Comet mode "any" anywhere,
 * every other scope its own word with mode "different" or "any". The build writes it onto the Talent
 * and the Talent model derives it again from the rule at prepare, so a world Item whose textarea a
 * GM edits is read the same way. No hook: a grant is consumed by the wizard, not by a roll.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readLine, summarizeOperators } from "../operators.mjs";

const SHAPE = "grant: <N>, <Scope> [, DIFFERENT]";
const EXAMPLE = "grant: 1, Calling";
const OPERATORS_TAKEN = Object.freeze(["IF", "DIFFERENT"]);

/** The scopes, by the lower-cased word with its spaces removed, to the word as stored and printed. */
export const GRANT_SCOPES = Object.freeze({
  opening: "Opening", calling: "Calling", skill: "Skill", lore: "Lore", defense: "Defense",
  combatstyle: "Combat Style", comet: "Comet"
});

/** The scope word, checked; plurals read ("Skills"). */
function readScope(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/s$/, "");
  if (Object.hasOwn(GRANT_SCOPES, key)) return GRANT_SCOPES[key];
  const names = Object.values(GRANT_SCOPES);
  throw new RuleSyntaxError(`"${String(word ?? "").trim()}" is not a grant scope: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
}

/**
 * The wizard's field from a rule: `{ n, mode, scope }`.
 * @param {object} rule
 * @returns {{n: number, mode: string, scope: string}}
 */
export function toGrantField(rule) {
  const n = Number(rule?.n) || 0;
  if (!n || !rule?.scope) return { n: 0, mode: "", scope: "" };
  if (rule.scope === "Opening") return { n, mode: "open", scope: "anywhere" };
  if (rule.scope === "Comet") return { n, mode: "any", scope: "anywhere" };
  return { n, mode: rule.different ? "different" : "any", scope: rule.scope };
}

export default {
  id: "grant",
  aliases: [],

  parse(args, context = {}) {
    const { args: parts, ops } = readLine(args, { allow: OPERATORS_TAKEN, kind: "grant", context });
    if (parts.length !== 2) {
      throw new RuleSyntaxError(`a grant is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} argument${parts.length === 1 ? "" : "s"} given, 2 wanted)`);
    }
    const [nText, scopeWord] = parts;
    if (!/^\d+$/.test(nText) || (Number(nText) < 1)) throw new RuleSyntaxError(`a grant is a whole number of points, 1 or more, not "${nText}"`);
    const n = Number(nText);
    const scope = readScope(scopeWord);
    if (ops.different && (n < 2)) throw new RuleSyntaxError("DIFFERENT needs 2 or more points to put in different Constellations");
    return { n, scope, different: ops.different, when: ops.when };
  },

  /** `1 Calling Talent Point`; `2 Skill Talent Points, each in a different Constellation`. */
  summary(rule) {
    const n = Number(rule?.n) || 0;
    const scope = rule?.scope === "Comet" ? "Comet" : rule?.scope === "Opening" ? "Opening" : rule?.scope ?? "";
    let out = `${n} ${scope} Talent Point${n === 1 ? "" : "s"}`;
    if (rule?.different) out += ", each in a different Constellation";
    const tail = summarizeOperators({ when: rule?.when });
    return tail ? `${out}, ${tail}` : out;
  },

  hooks: {}
};
