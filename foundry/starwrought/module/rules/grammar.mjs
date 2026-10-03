/**
 * The Automation grammar (0.9.0; rulings 118 to 120).
 *
 * An Automation cell on a Talent sheet or an action sheet holds one rule per line:
 *
 *   # a line beginning with # is a comment, and a blank line is nothing
 *   kind: arguments
 *   kind arguments          (the colon is optional)
 *
 * The word before the colon (or the first whitespace) names a rule kind; everything after it,
 * trimmed, is that kind's to read. This module reads the line structure and nothing else: it finds
 * the kind through the registry in ./kinds/index.mjs, hands the kind its arguments, and turns what
 * comes back into rule data. It knows no kind's syntax. The cell is data, not code: nothing here
 * or anywhere generates JavaScript from a cell (ruling 118).
 *
 * It is used in two places, with one parse (ruling 120). `assets/build_foundry.mjs` parses every
 * cell at build time, and a line that does not parse FAILS the build naming the Constellation, the
 * Talent and the line, as a bad Aura cell stops the converter's write; the client parses the same
 * text at runtime when a GM edits a world Item's textarea, where the same failure is an error
 * entry the Item sheet shows in red and the engine skips, never a throw. Both read the one
 * `parseAutomation` below, which is why it returns errors rather than throwing them. The converter
 * (`assets/xlsx_to_trees.py`) copies the cell's text through untouched, so Python and JavaScript
 * never hold two parsers.
 *
 * Messages are plain English for the build's console, not i18n keys: the sheet localizes its
 * labels around them (the "As read" list, the tag, the empty-list line) and prints a message as
 * the build would. A message names what a game designer can act on, in the cell.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. The build imports it from plain Node,
 * as it imports module/config.mjs; a `game.` or `CONFIG.` reference outside a function body breaks
 * the content build. `assets/test_rules.mjs` imports it the same way.
 */

import { KIND_WORD, kindOf, knownKinds } from "./kinds/index.mjs";

// The registry's vocabulary, re-exported so a module that needs the grammar and the words needs
// one import. `registerKind` stays in the index: that is where a kind is registered.
export { KIND_WORD, kindOf, knownKinds } from "./kinds/index.mjs";

/**
 * The words a parsed rule reserves for the framework. A kind's `parse` returns its own data and
 * the grammar writes these over it, so a kind cannot rename a rule's kind or move it to another
 * line; `error` marks an entry that did not parse, so no kind's data may carry it either.
 */
export const RESERVED_WORDS = Object.freeze(["kind", "line", "text", "error"]);

/* -------------------------------------------- */

/**
 * A line a kind could not read, said in words a designer can act on. A kind's `parse` throws one
 * of these for a bad argument; the grammar catches it and makes an error entry of its message,
 * with the line number and the text filled in. Any other throw from a kind is caught too, but is
 * reported as the kind's failure, not the cell's, since a TypeError is a bug in the kind.
 */
export class RuleSyntaxError extends Error {
  /**
   * @param {string} message             What is wrong, for the designer.
   * @param {{line?: number|null, text?: string}} [where]  Filled in by the grammar; a kind need not.
   */
  constructor(message, { line = null, text = "" } = {}) {
    super(message);
    this.name = "RuleSyntaxError";
    this.line = line;
    this.text = text;
  }
}

/* -------------------------------------------- */

/**
 * Parse an Automation cell.
 *
 * Lines are split on `\r?\n` (Excel saves either) and trimmed; a blank line and a line beginning
 * with `#` are skipped and are never an error. On every other line the kind word is everything up
 * to the first `:` or whitespace, lower-cased, and the arguments are the rest with one optional
 * colon and the surrounding space removed. Line numbers count every line of the cell from 1,
 * blanks and comments included, so "line 3" is the third line the designer sees.
 *
 * A rule is `{ ...data, kind, line, text }`: whatever the kind's `parse` returned, then the
 * reserved words, which win. An error is `{ line, text, message }`. The two lists come back
 * separately so the build can fail on `errors.length` and the client can store both (through
 * `ruleEntries`) and show them. Nothing in here throws for a cell's sake: an unknown word, a kind
 * that throws, a kind that returns something that is not an object, all become error lines.
 *
 * @param {string} text                      The cell's text.
 * @param {object} [context]                 For messages and for the kind: `itemName`,
 *                                           `constellation`, `itemType`, `source`, as the caller has
 *                                           them. The grammar adds `line`, `text` and `kind`.
 * @returns {{rules: object[], errors: Array<{line: number, text: string, message: string}>}}
 */
export function parseAutomation(text, context = {}) {
  const rules = [];
  const errors = [];
  const lines = String(text ?? "").split(/\r?\n/);

  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const { word, args } = splitLine(trimmed);
    if (!word) {
      errors.push({ line, text: trimmed, message: "this line has no kind word: a rule is written `kind: arguments`" });
      return;
    }
    const kind = kindOf(word);
    if (!kind) {
      errors.push({ line, text: trimmed, message: unknownKindMessage(word) });
      return;
    }

    let data;
    try {
      data = kind.parse(args, { ...context, line, text: trimmed, kind: kind.id });
    } catch (error) {
      errors.push({ line, text: trimmed, message: kindFailure(kind, error) });
      return;
    }
    if (data == null) data = {};
    if ((typeof data !== "object") || Array.isArray(data)) {
      errors.push({
        line, text: trimmed,
        message: `the "${kind.id}" kind returned ${Array.isArray(data) ? "an array" : `a ${typeof data}`} for this line, not an object (a bug in the kind, not in the cell)`
      });
      return;
    }
    // The reserved words are the framework's: a kind's data cannot rename the rule's kind, move it
    // to another line or, by carrying `error`, have a parsed rule filed as one that did not parse.
    const own = { ...data };
    for (const word of RESERVED_WORDS) delete own[word];
    rules.push({ ...own, kind: kind.id, line, text: trimmed });
  });

  return { rules, errors };
}

/**
 * The kind word and the arguments of one trimmed, non-blank, non-comment line. A line that begins
 * with a colon or has nothing before its first colon has no word.
 * @param {string} trimmed
 * @returns {{word: string, args: string}}
 */
function splitLine(trimmed) {
  const match = trimmed.match(/^([^:\s]+)\s*:?\s*([\s\S]*)$/);
  if (!match) return { word: "", args: trimmed.replace(/^:\s*/, "") };
  return { word: match[1].toLowerCase(), args: match[2].trim() };
}

/**
 * The message for a word no kind answers to. With the registry empty it says so, since "known
 * kinds:" followed by nothing would read as a bug; a word that is not even shaped like a kind word
 * gets the shape too, because `15 ft allies` on a line of its own is the likeliest slip.
 * @param {string} word
 * @returns {string}
 */
function unknownKindMessage(word) {
  const known = knownKinds();
  const tail = known.length ? `known kinds: ${known.join(", ")}` : "no rule kinds are defined yet";
  let message = `unknown rule kind "${word}" (${tail})`;
  if (!KIND_WORD.test(word)) message += "; a rule begins with its kind word, lower-case letters and hyphens, then a colon";
  return message;
}

/**
 * A kind's throw as an error message. A RuleSyntaxError is the designer's: its message stands as
 * written. Anything else is the kind's own failure and is labelled as such, so the line in the
 * build log points at the file to fix rather than at the cell.
 * @param {import("./kinds/index.mjs").RuleKind} kind
 * @param {unknown} error
 * @returns {string}
 */
function kindFailure(kind, error) {
  if ((error instanceof RuleSyntaxError) || (error?.name === "RuleSyntaxError")) return String(error.message);
  const detail = (error && (typeof error === "object") && ("message" in error)) ? error.message : String(error);
  return `the "${kind.id}" kind could not read this line: ${detail} (a bug in the kind, not in the cell)`;
}

/* -------------------------------------------- */

/**
 * The entries an Item stores in `system.rules`, from a parse: the parsed rules as they are and
 * each error as `{ error, line, text }`, the whole in line order. The build never stores an error
 * (it fails instead); the client does, when a GM edits a world Item's textarea, so the text always
 * saves, the sheet shows what is wrong and the engine skips it (ruling 118).
 * @param {{rules: object[], errors: Array<{line: number, text: string, message: string}>}} parsed
 * @returns {object[]}
 */
export function ruleEntries(parsed) {
  const entries = [
    ...(parsed?.rules ?? []),
    ...(parsed?.errors ?? []).map(e => ({ error: e.message, line: e.line, text: e.text }))
  ];
  return entries.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/**
 * One short line for the Item sheet: the kind's `summary` of a parsed rule, the message of an
 * error entry, or "unknown rule kind" for a rule whose kind is no longer registered (a world Item
 * built against a kind since renamed). A kind's `summary` that throws falls back to the rule's
 * text, so a sheet never fails to render over a summary.
 * @param {object} rule  An entry of `system.rules`.
 * @returns {string}
 */
export function summarize(rule) {
  if (!rule || (typeof rule !== "object")) return "";
  if (rule.error) return String(rule.error);
  const kind = kindOf(rule.kind);
  if (!kind) return rule.kind ? `unknown rule kind "${rule.kind}"` : "unknown rule kind";
  try {
    const summary = kind.summary(rule);
    return (summary == null) ? String(rule.text ?? "") : String(summary);
  } catch {
    return String(rule.text ?? rule.kind);
  }
}

/* -------------------------------------------- */
/*  Helpers a kind may use                      */
/* -------------------------------------------- */

/**
 * Split a kind's arguments on the commas outside quotes, each part trimmed, a part wholly in one
 * pair of quotes ("..." or '...') unquoted, empty parts dropped (a trailing comma is a slip, not
 * an argument). An opening quote with no closing one is a RuleSyntaxError, which the grammar
 * reports as that line's error when a kind's `parse` lets it through.
 * @param {string} text
 * @returns {string[]}
 */
export function splitArgs(text) {
  const parts = [];
  let current = "";
  let quote = null;
  for (const ch of String(text ?? "")) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"') || (ch === "'")) {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (quote) throw new RuleSyntaxError(`an opening ${quote} has no closing ${quote}`);
  parts.push(current);
  return parts.map(part => unquote(part.trim())).filter(part => part !== "");
}

/**
 * Sort parts into `key=value` pairs and the rest, in order. Keys are lower-cased; values are
 * trimmed and unquoted as `splitArgs` unquotes. A key given twice is a RuleSyntaxError, since a
 * cell that says `range=15, range=30` means one thing to its author and the kind cannot know which.
 * @param {string[]} parts
 * @returns {{pairs: Object<string, string>, rest: string[]}}
 */
export function keyValues(parts) {
  const pairs = {};
  const rest = [];
  for (const part of parts ?? []) {
    const match = String(part).match(/^([^=\s]+)\s*=\s*([\s\S]*)$/);
    if (!match) {
      rest.push(part);
      continue;
    }
    const key = match[1].toLowerCase();
    if (Object.hasOwn(pairs, key)) throw new RuleSyntaxError(`"${key}" is given twice`);
    pairs[key] = unquote(match[2].trim());
  }
  return { pairs, rest };
}

/** A string wholly inside one pair of matching quotes, without them; anything else as it is. */
function unquote(text) {
  if ((text.length >= 2) && ((text[0] === '"') || (text[0] === "'")) && (text.at(-1) === text[0])) {
    return text.slice(1, -1);
  }
  return text;
}
