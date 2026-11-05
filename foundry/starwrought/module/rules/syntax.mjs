/**
 * What a kind file needs from the grammar, in a module that imports nothing (0.10.0 as errors.mjs
 * with the error class alone; 0.10.1 with the two argument helpers beside it).
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
