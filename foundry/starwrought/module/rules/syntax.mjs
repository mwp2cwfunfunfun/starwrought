/**
 * What a kind file needs from the grammar, in a module that imports nothing (0.10.0 as errors.mjs
 * with the error class alone; 0.10.1 with the two argument helpers beside it; 0.26.1 with the
 * "no automation" words, which the build tools read from here too).
 *
 * grammar.mjs imports the registry, the registry imports every kind, and a kind that imported
 * grammar.mjs for any of these closed a circle that broke whenever the kind file was the first
 * module loaded (the registry's `registerKind(bonus)` ran before `bonus` was initialised). So a
 * kind imports from here and never from the grammar, and there is no circle to be careful about.
 * grammar.mjs re-exports all three, so every other reader keeps its one import.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE, like the rest of module/rules/.
 */

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
/*  A Condition's row (0.33.0)                  */
/* -------------------------------------------- */

/**
 * The `itemType` of a Condition's row of the Conditions workbook (`data/conditions.xlsx`). The
 * lines there act for whoever HAS the Condition, a character or an adversary, so they are plain
 * bonuses and penalties and nothing that asks about an owner's Talents, rank or choices.
 */
export const CONDITION_ROW = "condition";

/**
 * The effect tags a Condition's row may carry in this version. `immune` since 0.35.0, and there in
 * its `TRAIT(...)` form alone (Blinded: `[EFFECT IMMUNE: TRAIT(Visual)]`; the kind refuses the
 * rest, ./kinds/prevent.mjs).
 */
export const CONDITION_ROW_TAGS = Object.freeze(["check", "atk", "def", "init", "immune"]);

/* -------------------------------------------- */
/*  "No automation"                             */
/* -------------------------------------------- */

/**
 * The words that say "this row needs no automation" (0.26.1). Mike, 2026-11-15: "For Maneuvers,
 * Talents, etc. that do not require automation, I am going to put N/A in the Automation field. Make
 * sure the engine doesn't confuse that with automation grammar."
 *
 * A line that is one of these, and nothing else, is no rule and no error: the grammar skips it as
 * it skips a blank line and a `#` comment. They are the words the converter already reads as an
 * empty cell (`blank_none` in assets/xlsx_to_trees.py: "none", "n/a", a dash, "---"), so the
 * pipeline's two readers cannot disagree, with the spellings a hand will also type: `N/A` in any
 * case, `NA`, `N.A.`, `None`, a run of dashes; each with or without a closing full stop, and with
 * or without the square brackets every other line of a cell wears (`[N/A]`). It is a whole LINE:
 * `[EFFECT N/A]` is a mistyped effect and is still refused as one.
 */
// The dash may be a hyphen or one of the two long dashes Word and Excel substitute for it
// (written as escapes, so this file carries neither).
const NOT_APPLICABLE = /^(?:n\s*\/\s*a\.?|n\.?a\.?|none\.?|[-\u2013\u2014]+)$/i;

/**
 * Does this line say "no automation" and nothing else?
 * @param {string} line  One line of a cell.
 * @returns {boolean}
 */
export function isNotApplicable(line) {
  let text = String(line ?? "").trim();
  const bracketed = text.match(/^\[([^\[\]]*)\]$/);
  if (bracketed) text = bracketed[1].trim();
  return NOT_APPLICABLE.test(text);
}

/**
 * Is the whole cell a "no automation" mark: at least one such line, and nothing else but blank
 * lines and `#` comments? The pipeline treats such a cell as an empty one (no rules, nothing
 * stored, nothing counted), and the red-cell tool counts it as reviewed.
 * @param {string} text  The cell.
 * @returns {boolean}
 */
export function isNotApplicableCell(text) {
  let marked = false;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!isNotApplicable(line)) return false;
    marked = true;
  }
  return marked;
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

/**
 * Split text on the WORD `or`, wherever it stands, into its alternatives (0.28.0 for REQUIRES;
 * shared with CHECK since 0.34.0). One left dangling ("prone or") gives an empty alternative, so
 * the reader can say so, and never a name that ends in "or". A word that merely contains the
 * letters (Armor, Lore, Warrior) is left alone: only the whole word splits.
 * @param {string} text
 * @returns {string[]}  Each alternative, its words joined by one space; "" for an empty one.
 */
export function splitAlternatives(text) {
  const alternatives = [[]];
  for (const word of String(text ?? "").trim().split(/\s+/)) {
    if (word.toLowerCase() === "or") alternatives.push([]);
    else if (word) alternatives.at(-1).push(word);
  }
  return alternatives.map(words => words.join(" "));
}

/** A string wholly inside one pair of matching quotes, without them; anything else as it is. */
function unquote(text) {
  if ((text.length >= 2) && ((text[0] === '"') || (text[0] === "'")) && (text.at(-1) === text[0])) {
    return text.slice(1, -1);
  }
  return text;
}
