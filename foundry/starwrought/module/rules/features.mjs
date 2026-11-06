/**
 * The feature line (0.16.0; AUTOMATION_GRAMMAR.md section 2): what owning a Talent does to the
 * character, in the shape of Fantasy Grounds' PC feature automation, blocks in square brackets:
 *
 *   [TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
 *   [LANGUAGE Common, Serrovine]
 *   [Acrobatics trained][Athletics trained][Lore trained]
 *   [POINT Calling]  [POINT 2 Skill different]  [POINT Opening]
 *   [MANEUVER Steady the Line]  [TALENT Weapon Familiarity]  [CHOICE Weapon Group]
 *   [AURA 15 allies]  [VIGOR opening 12]  [SENSES Low-light vision]
 *   [EFFECT IMMUNE: prone; LIMIT: encounter]      (0.17.0: an effect line, in FG's own block)
 *
 * A line that begins with `[` is a feature line; it may hold any number of blocks. Each block is
 * `[KEYWORD data]`, the keyword naming the kind that reads the data (FEATURE_KEYWORDS), with two
 * exceptions in FG's own forms: `[<Constellation> trained]` is a Trained Root, read by the `grant`
 * kind, and `[EFFECT ...]` (0.17.0; Mike: "shouldn't ALL of those be enclosed in Brackets?") wraps
 * an effect line (../effects.mjs), which the grammar hands to the tag's kind; the block comes back
 * with `effect: true` and no kind of its own. Case never matters. The reader splits the blocks and
 * names the kind; each kind reads its own data (its `parse` with `context.form === "feature"` and
 * `context.block`). A block ends at the first `]` outside parentheses (0.18.1): a `CLAIM(...)`
 * text may say "[per the GM's table]" without ending the block early, since a condition's
 * parentheses are the one place prose lives inside a block.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "./syntax.mjs";

/** The keywords a block may begin with, each to the kind that reads it. */
export const FEATURE_KEYWORDS = Object.freeze({
  trait: "trait",
  size: "size",
  speed: "speed",
  vigor: "vigor",
  senses: "sense", sense: "sense",
  language: "language", languages: "language",
  point: "grant", points: "grant",
  maneuver: "maneuver",
  talent: "talent",
  choice: "choice",
  aura: "aura"
});

/** The block that wraps an effect line (0.17.0). */
export const EFFECT_KEYWORD = "effect";

/** The keywords as the document lists them, one per kind, for messages. */
export const FEATURE_KEYWORD_LIST = Object.freeze(["TRAIT", "SIZE", "SPEED", "VIGOR", "SENSES", "LANGUAGE", "POINT", "MANEUVER", "TALENT", "CHOICE", "AURA", "EFFECT"]);

/** Is this trimmed line a feature line? */
export function isFeatureLine(line) {
  return String(line ?? "").trim().startsWith("[");
}

/**
 * Split a feature line into its blocks.
 * @param {string} text  The trimmed line.
 * @returns {Array<{keyword: string, kind: string, data: string, text: string, trained?: string}>}
 */
export function readFeatureLine(text) {
  const line = String(text ?? "").trim();
  const blocks = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch !== "[") throw new RuleSyntaxError(`"${line.slice(i, i + 20)}": a feature line is blocks in square brackets, as in \`[TRAIT Human][SPEED 6]\``);
    const close = closingBracket(line, i);
    if (close < 0) throw new RuleSyntaxError("a [ has no closing ]");
    const inner = line.slice(i + 1, close).trim();
    if (!inner) throw new RuleSyntaxError("an empty [] names nothing");
    blocks.push(readBlock(inner));
    i = close + 1;
  }
  if (!blocks.length) throw new RuleSyntaxError("a feature line is blocks in square brackets, as in `[TRAIT Human][SPEED 6]`");
  return blocks;
}

/**
 * The index of the `]` that closes the block opened at `open`, skipping any `]` inside
 * parentheses (a `CLAIM(...)` text, a `RANK(...)`); -1 when none closes it.
 * @param {string} line
 * @param {number} open  The index of the `[`.
 * @returns {number}
 */
function closingBracket(line, open) {
  let depth = 0;
  for (let i = open + 1; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "(") depth += 1;
    else if ((ch === ")") && (depth > 0)) depth -= 1;
    else if ((ch === "]") && (depth === 0)) return i;
  }
  return -1;
}

/** One block's inside: `KEYWORD data`, `<Constellation> trained`, or `EFFECT <effect line>`. */
function readBlock(inner) {
  const text = `[${inner}]`;
  const words = inner.split(/\s+/);
  const keyword = words[0].toLowerCase();
  if (keyword === EFFECT_KEYWORD) {
    const data = inner.slice(words[0].length).trim();
    if (!data) throw new RuleSyntaxError("EFFECT is written `[EFFECT <tag>: ...]`, as in `[EFFECT IMMUNE: prone; LIMIT: encounter]`");
    return { keyword, kind: null, effect: true, data, text };
  }
  if (Object.hasOwn(FEATURE_KEYWORDS, keyword)) {
    return { keyword, kind: FEATURE_KEYWORDS[keyword], data: inner.slice(words[0].length).trim(), text };
  }
  // FG's own form for a proficiency: `[Athletics trained]`. The rank word is last; the name is
  // the rest. Only `trained` reads: the book's Roots are Trained, and nothing grants a higher rank.
  const last = words.at(-1).toLowerCase();
  if ((words.length >= 2) && ["trained", "expert", "master", "legendary"].includes(last)) {
    if (last !== "trained") throw new RuleSyntaxError(`[${inner}]: a Root is Trained; nothing grants ${titled(last)} at creation`);
    return { keyword: "trained", kind: "grant", data: inner.slice(0, inner.length - words.at(-1).length).trim(), text, trained: true };
  }
  throw new RuleSyntaxError(`"${words[0]}" is not a feature keyword: write ${FEATURE_KEYWORD_LIST.join(", ")}, or \`[<Constellation> trained]\`; an effect goes in \`[EFFECT <tag>: ...]\``);
}

function titled(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}
