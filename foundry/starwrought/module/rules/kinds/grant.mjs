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
 * The wizard's field from a rule: `{ n, mode, scope, constellation }`. `constellation` (0.16.0) is
 * the slug a `[<Constellation> trained]` point is directed at; "" otherwise.
 * @param {object} rule
 * @returns {{n: number, mode: string, scope: string, constellation: string}}
 */
export function toGrantField(rule) {
  const n = Number(rule?.n) || 0;
  if (!n || !rule?.scope) return { n: 0, mode: "", scope: "", constellation: "" };
  const constellation = rule.constellation ? String(rule.constellation) : "";
  if (rule.scope === "Opening") return { n, mode: "open", scope: "anywhere", constellation };
  if (rule.scope === "Comet") return { n, mode: "any", scope: "anywhere", constellation };
  return { n, mode: rule.different ? "different" : "any", scope: rule.scope, constellation };
}

/**
 * The Constellation a directed point names (`[Acrobatics trained]`): with a resolver it must be a
 * Constellation that is not a group, its scope word from its category (Skill, Defense, Calling,
 * Combat Style; a Lore is Lore; anything else Opening); without one the slug is made here and the
 * scope is Skill, the common case.
 * @param {string} name
 * @param {Function|undefined} resolve
 * @returns {{slug: string, name: string, scope: string}}
 */
/** A Constellation's category, spaces and case dropped, to the grant scope a directed point takes. */
const SCOPE_BY_CATEGORY = Object.freeze({
  skill: "Skill", defense: "Defense", calling: "Calling", combatstyle: "Combat Style", lore: "Lore"
});

function readConstellation(name, resolve) {
  const written = String(name ?? "").trim();
  if (!written) throw new RuleSyntaxError("a Trained Root names its Constellation: `[Acrobatics trained]`");
  if (/^lore$/i.test(written)) return { slug: "lore", name: "Lore", scope: "Lore" };
  if (typeof resolve === "function") {
    const found = resolve(written);
    if (!found || (found.type !== "constellation") || !found.slug) throw new RuleSyntaxError(`"${written}" is not a Constellation`);
    if (found.group) throw new RuleSyntaxError(`"${found.name ?? written}" is a group and has no Root of its own; name ${found.parent || "its parent"}`);
    // The build's resolver hands the index's word ("Skill", "Combat Style"); the client's hands the
    // system's key ("skill", "combatStyle"). Both read.
    const category = String(found.category ?? "").replace(/\s+/g, "").toLowerCase();
    const scope = SCOPE_BY_CATEGORY[category]
      ?? (/^lore/.test(String(found.slug)) ? "Lore" : "Opening");
    return { slug: String(found.slug), name: String(found.name ?? written), scope };
  }
  const slug = written.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return { slug, name: written, scope: /^lore/.test(slug) ? "Lore" : "Skill" };
}

export default {
  id: "grant",
  aliases: [],

  parse(args, context = {}) {
    // The 0.16.0 shape (AUTOMATION_GRAMMAR.md section 2): `[<Constellation> trained]`, FG's own
    // form for a proficiency, is one directed point that buys the Root; `[POINT <N> <Scope>
    // [different]]` is the points by scope.
    if (context?.form === "feature") {
      if (context.block?.trained) {
        const named = readConstellation(String(args ?? "").trim(), context.resolve);
        return { n: 1, scope: named.scope, constellation: named.slug, constellationName: named.name, different: false, when: null, trained: true };
      }
      const tokens = String(args ?? "").trim().split(/\s+/).filter(Boolean);
      let n = 1;
      if (tokens.length && /^\d+$/.test(tokens[0])) n = Number(tokens.shift());
      if (n < 1) throw new RuleSyntaxError("a grant is a whole number of points, 1 or more");
      let different = false;
      if (tokens.length && (tokens.at(-1).toLowerCase() === "different")) { different = true; tokens.pop(); }
      if (!tokens.length) throw new RuleSyntaxError("POINT is written `[POINT <N> <Scope> [different]]`, as in `[POINT Skill]` or `[POINT 2 Skill different]`");
      const scope = readScope(tokens.join(" "));
      if (different && (n < 2)) throw new RuleSyntaxError("different needs 2 or more points to put in different Constellations");
      return { n, scope, different, when: null };
    }
    if (context?.form === "effect") throw new RuleSyntaxError("a grant is a bracketed feature: `[POINT Skill]` or `[Acrobatics trained]`");

    // The 0.13.0 form, read one more release; a third argument naming the Constellation (Mike's
    // backgrounds of 2026-11-05, `grant: 1, Skill, Acrobatics`) reads as `[Acrobatics trained]`.
    const { args: parts, ops } = readLine(args, { allow: OPERATORS_TAKEN, kind: "grant", context });
    if ((parts.length !== 2) && (parts.length !== 3)) {
      throw new RuleSyntaxError(`a grant is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} argument${parts.length === 1 ? "" : "s"} given, 2 wanted)`);
    }
    const [nText, scopeWord, named] = parts;
    if (!/^\d+$/.test(nText) || (Number(nText) < 1)) throw new RuleSyntaxError(`a grant is a whole number of points, 1 or more, not "${nText}"`);
    const n = Number(nText);
    const scope = readScope(scopeWord);
    if (ops.different && (n < 2)) throw new RuleSyntaxError("DIFFERENT needs 2 or more points to put in different Constellations");
    if (named) {
      const found = readConstellation(named, context.resolve);
      return { n, scope, constellation: found.slug, constellationName: found.name, different: ops.different, when: ops.when, trained: true };
    }
    return { n, scope, different: ops.different, when: ops.when };
  },

  /** `1 Calling Talent Point`; `2 Skill Talent Points, each in a different Constellation`; `Trained in Acrobatics`. */
  summary(rule) {
    const n = Number(rule?.n) || 0;
    if (rule?.constellation) return `Trained in ${rule.constellationName ?? rule.constellation}${rule.scope === "Lore" ? " (a Lore of your naming)" : ""}`;
    const scope = rule?.scope === "Comet" ? "Comet" : rule?.scope === "Opening" ? "Opening" : rule?.scope ?? "";
    let out = `${n} ${scope} Talent Point${n === 1 ? "" : "s"}`;
    if (rule?.different) out += ", each in a different Constellation";
    const tail = summarizeOperators({ when: rule?.when });
    return tail ? `${out}, ${tail}` : out;
  },

  hooks: {}
};
