/**
 * The automation framework's two fields (0.9.0) and the sheet's view of the stored rules.
 * Used by constellation.mjs, talent.mjs and action.mjs.
 */

// The automation framework (0.9.0; rulings 118 to 120): the grammar that read a cell at build
// time reads the stored rules again here, for the sheet's "As read" list, and the kinds registry
// says whether a stored rule's kind is one this system has. Both are pure modules.
import { summarize } from "../../rules/grammar.mjs";
import { kindOf } from "../../rules/kinds/index.mjs";

const fields = foundry.data.fields;

/**
 * The automation framework's two fields (0.9.0; rulings 118 to 120), on a Talent, a Constellation
 * and an action. `automation` is the cell as the author wrote it in the spreadsheet's Automation
 * column: one rule per line, `kind: arguments`, a `#` line a comment. `rules` is what the grammar
 * read from it: `{ kind, line, text, ...data }` per parsed rule, where `data` is whatever the
 * kind's own `parse` returned, written by assets/build_foundry.mjs for compendium content (a line
 * that does not parse fails the build there, so a built rule is never an error), and by
 * SwItem#_preUpdate when a GM edits the textarea on a world Item, which also writes
 * `{ error, line, text }` for a line that did not parse so the text always saves and the sheet can
 * say what is wrong. The entries are plain objects because each kind owns its own shape; the
 * engine (module/rules/engine.mjs) indexes them on the Actor by kind, and nothing reads them yet:
 * the kinds, and the hooks they speak at, are added one at a time (ruling 119).
 */
export function rulesFields() {
  return {
    automation: new fields.StringField({ initial: "" }),
    // `initial` as a function, never a literal array: Foundry hands the same literal to every
    // document whose source lacks the field and, since v13, updates an ArrayField in place to keep
    // its identity, so a literal `[]` made seven of Hrolda's Talents share one `rules` array and an
    // error typed on one of them appeared on all seven (the 0.9.0 live test).
    rules: new fields.ArrayField(new fields.ObjectField(), { initial: () => [] })
  };
}

/**
 * The sheet's view of the stored rules, one row per entry: the kind word for its tag, the line
 * number and text for the tooltip, the kind's summary (or the error text) through the grammar, and
 * `error` for the red row. A parsed rule whose kind this system does not have (a pack built by a
 * later system, or a kind since renamed) is marked `unknown` and the sheet localizes that itself;
 * an entry the client wrote as an error carries the grammar's own plain-English message, which the
 * sheet prints under a localized label, since the grammar holds no i18n (the build prints the same
 * message in the terminal). Derived every prepare, never stored.
 * @param {object} system  Anything carrying `rules`.
 */
export function prepareRules(system) {
  system.ruleLines = (system.rules ?? []).map(r => {
    const kind = r.kind ?? "";
    const unknown = !r.error && !kindOf(kind);
    return {
      kind,
      line: r.line,
      text: r.text ?? "",
      summary: summarize(r),
      error: r.error ?? (unknown ? "unknown rule kind" : ""),
      unknown
    };
  });
  system.hasRules = system.ruleLines.length > 0;
}
