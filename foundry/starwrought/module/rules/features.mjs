/**
 * The feature line (0.16.0; AUTOMATION_GRAMMAR.md section 2): what owning a Talent does to the
 * character, in the shape of Fantasy Grounds' PC feature automation, blocks in square brackets:
 *
 *   [TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
 *   [LANGUAGE Common, Serrovine]
 *   [Acrobatics trained][Athletics trained][Lore trained]
 *   [POINT Calling]  [POINT 2 Skill different]  [POINT Opening]
 *   [MANEUVER Steady the Line]  [TALENT Weapon Familiarity]  [CHOICE Weapon Group]
 *   [AURA 15 allies visible]  [VIGOR opening 12]  [SENSES Low-light vision]
 *
 * A line that begins with `[` is a feature line; it may hold any number of blocks. Each block is
 * `[KEYWORD data]`, the keyword naming the kind that reads the data (FEATURE_KEYWORDS), with one
 * exception in FG's own form: `[<Constellation> trained]` is a Trained Root, read by the `grant`
 * kind. Case never matters. The reader splits the blocks and names the kind; each kind reads its
 * own data (its `parse` with `context.form === "feature"` and `context.block`).
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

/** The keywords as the document lists them, one per kind, for messages. */
export const FEATURE_KEYWORD_LIST = Object.freeze(["TRAIT", "SIZE", "SPEED", "VIGOR", "SENSES", "LANGUAGE", "POINT", "MANEUVER", "TALENT", "CHOICE", "AURA"]);

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
    const close = line.indexOf("]", i);
    if (close < 0) throw new RuleSyntaxError("a [ has no closing ]");
    const inner = line.slice(i + 1, close).trim();
    if (!inner) throw new RuleSyntaxError("an empty [] names nothing");
    blocks.push(readBlock(inner));
    i = close + 1;
  }
  if (!blocks.length) throw new RuleSyntaxError("a feature line is blocks in square brackets, as in `[TRAIT Human][SPEED 6]`");
  return blocks;
}

/** One block's inside: `KEYWORD data`, or `<Constellation> trained`. */
function readBlock(inner) {
  const text = `[${inner}]`;
  const words = inner.split(/\s+/);
  const keyword = words[0].toLowerCase();
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
  throw new RuleSyntaxError(`"${words[0]}" is not a feature keyword: write ${FEATURE_KEYWORD_LIST.join(", ")}, or \`[<Constellation> trained]\``);
}

function titled(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}
