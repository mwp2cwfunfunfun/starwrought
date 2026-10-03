# The automation framework: a plan

Written 2026-10-03 against system 0.8.0 and Player's Handbook v4.15, and built the same day as
system 0.9.0. Mike's words, the first: "I'd like an Automation field in the data .xlsx files. And
based on what is in there, when I run sync_content.cmd (or when you run it as part of a build), it
will create the Foundry VTT automation code. However, I want to make sure the Foundry VTT
automation code is well-built. For example, if I create an automation syntax for the Torchbearer
15' aura, we should create the syntax that will work for OTHER auras, too, without additional
coding." And the second, which fixes the scope of the release: "Important - do NOT survey the
talents yet or build ANY of the automation hooks. just build the framework. we will build
automation syntax hooks one at a time." The design panel that would have debated the shape was
stopped at that word. What follows is the framework and nothing else, and **it does nothing in play
yet**: no rule kind exists, no engine hook is wired, and no Talent's text has been read.

## The shape, in one paragraph

An Automation cell is data, not code (ruling 118). It holds one rule per line, `kind: arguments`
(the colon optional when there are no arguments; `kind arguments` also reads), blank lines ignored,
a line beginning with `#` a comment. One grammar module owns that line structure,
`foundry/starwrought/module/rules/grammar.mjs`, written pure (no Foundry global at module scope, no
i18n inside) so that Node can import it: `build_foundry.mjs` parses every cell at build time, and a
line that does not parse fails the build naming the Constellation, the Talent and the line, as a
bad Aura cell stops the converter; the client parses the same text identically at runtime, so the
Item sheet can show what each line means and mark a line that does not parse without ever
throwing. The converter (`xlsx_to_trees.py`) copies the cell through as text and knows nothing of
the grammar, so Python and JavaScript never hold two parsers (ruling 120). Rule kinds are plug-ins
with one contract, one file each, registered in an index that is empty today (ruling 119): a kind
owns its word, its argument syntax and validation, its summary line for the sheet, and later the
engine hooks it speaks at. The framework knows nothing about auras, modifiers or conditions. Mike's
"create the Foundry VTT automation code" is read as rule data the one engine reads, never as
JavaScript generated from a cell: that is what makes "work for OTHER auras, too, without additional
coding" true by construction, because the kind owns the word and every cell that uses the word is
served by it.

## The data

| Where | Field | Shape | Notes |
|---|---|---|---|
| The tree sheets | `Automation` column | text | Beside `Aura` and `Enabled?`; order free, first word of the header wins. The action sheets had the column already; it is the same column now, no longer prose. |
| The node (`trees.json`, `actions.json`) | `automation` | text | Copied through by the converter when the cell is non-empty. No parsing, no validation. |
| Talent, action and Constellation Items | `system.automation` | string | The cell's text. The action model had it; the Talent and Constellation models gain it (the Constellation's so the shared panel's textarea has a field behind it; the `_Tree Index` has no Automation column, so the build writes it empty). |
| The same Items | `system.rules` | array of objects, initial `[]` | Written by the build from the parse: `{ kind, line, text, ...data }` per rule, `data` being whatever the kind's `parse` returned. `{ error, line, text }` for a line that did not parse: never written by the build, which fails instead; written by `SwItem._preUpdate` when a GM edits the textarea on a world Item or an owned copy, so the text always saves and the sheet shows what is wrong. |
| The same Items, derived | `ruleLines` | array | For the sheet: kind word, line, text, the kind's summary, and an error (the stored one, or "unknown rule kind" when the registry lacks the word). |
| Character and adversary, derived | `system.rules` | `{ all, byKind, unknown }` of `{ rule, item }` | `collectRules(actor)` from `module/rules/engine.mjs`, first thing in `prepareDerivedData`, over every owned Talent, action and Constellation Item; an error entry or a rule of an unknown kind goes to `unknown` with its reason. `SwActor#rulesOfKind(kind)` reads `byKind`. Nothing reads any of it yet. |

The content hash covers `system`, so a changed cell changes the hash and reaches an open world
through Sync content as any field does; the copies refresh (0.8.0) overwrites an owned copy's
`system.automation` and `system.rules` from the source, since the cell is the author (ruling 120).

## The contract of a kind

Documented in `module/rules/README.md` and enforced by `registerKind`, which refuses a definition
missing `id`, `parse` or `summary`, or whose id or alias is already taken.

```js
export default {
  id: "aura",                       // lower-case, letters and hyphens; the word before the colon
  aliases: [],                      // other words accepted before the colon
  parse(args, context) { ... },     // the text after the colon, trimmed; returns the rule's data
                                    // (a plain object) or throws RuleSyntaxError(message) with a
                                    // message a game designer can act on; context = { itemName,
                                    // constellation, itemType, line } for messages
  summary(rule) { ... },            // one short string for the sheet, from the parsed data
  hooks: {}                         // the engine hook points this kind speaks at; EMPTY in 0.9.0
                                    // and defined one at a time with the kind that needs them
};
```

The shared helpers a kind may use live in `grammar.mjs`: `splitArgs(text)` (commas outside quotes),
`keyValues(parts)` (`key=value` pairs), and nothing more until a kind needs it.

## Adding a kind

The recipe, in full, is `module/rules/README.md`. In outline, and every step with Mike:

1. Settle the syntax with Mike first, from the Talent that wants it, written so that every Talent
   using the word is served (the aura for Torchbearer serves every aura).
2. One file in `module/rules/kinds/` exporting the contract above; register it in
   `kinds/index.mjs`.
3. Its checks in `assets/test_rules.mjs`: the arguments parse, the summary prints, a bad argument
   throws `RuleSyntaxError` with a message that names the problem.
4. Its engine hook: defined with the kind, wired at the one place it speaks (a roll, the attack
   flow, damage, a condition, movement, an aura), and not before. The Actor's `rulesOfKind(word)`
   is where the hook asks for its rules.
5. One line in `data/README.txt` naming the kind and its syntax, so an author can write the cell.
6. The docs: a CHANGELOG entry and the FEATURES paragraph, saying what the kind does and what it
   leaves to the table.
7. The content loop carries it: the kind's code ships with the system (a release), and a cell that
   uses it reaches an open world through Sync content, no restart.

## What was deliberately not done, and why

- **The survey.** No Talent's Effect was read to find out which kinds the book wants, and no cell
  in `data/*.xlsx` was filled in. Mike: "do NOT survey the talents yet". The survey is a design
  conversation to have one kind at a time, from the Talent that wants it.
- **The kinds.** The registry is empty, and the index's comment names the first kind to come and
  says it is not here. Mike: "we will build automation syntax hooks one at a time." Until the first
  lands, every non-comment line in a cell is "unknown rule kind", which the build refuses and the
  sheet marks; that is the framework working as designed.
- **Any hook.** Nothing in `module/rules/` is called by a roll, the attack flow, the damage
  pipeline, a condition, movement or the auras on the map. Mike: "do NOT ... build ANY of the
  automation hooks". A hook is defined with the kind that needs it, because a hook point chosen
  before its first kind is a guess about what the kind will want.
- **A second parser.** The converter copies text; the grammar is the system's alone (ruling 120).
- **Generated code.** Nothing writes JavaScript from a cell (ruling 118).

## The backlog, as Mike framed it

1. **The aura, for Torchbearer Human.** The 15 feet the `Aura` column (0.5.1) already draws on the
   map; what the kind adds is the effect inside the ring, written so that every aura in the book is
   served by the same word. The syntax is Mike's to settle first (decision 1).
2. **Then one at a time.** Each kind from the Talent that wants it, by the recipe above, with its
   hook, its test, its README line and its docs. No order is fixed beyond the first.

## Decisions that are Mike's

1. **The first kind's syntax.** What `aura:` takes, and what the engine does inside the ring: the
   bonus, who it reaches, when it is read. Nothing in 0.9.0 presumes an answer.
2. **Whether the web app and the Constellation Compendium docx should print the cell.** Neither
   does today; both are the authoring views of the whole book, and the cell is addressed to the
   engine. Printing it would show an author what the system will do with a Talent beside what the
   Talent says.
3. **Whether an owned copy's edited Automation should survive a refresh.** Today the copies refresh
   overwrites `system.automation` and `system.rules` from the source, as it overwrites every field
   but the character's own (quantity, carry state, a raised shield, a chosen option), because the
   cell is the author (ruling 120). Keeping a GM's edit would make the copy the author of its own
   rules and let a Talent on a sheet diverge from the book.

## Risks

1. **A kind that needs GM judgement inside a formula.** The standing risk the working agreement
   names ("Expose a plausible Zone"). A kind's `parse` can validate syntax; it cannot validate a
   judgement. Prefer kinds a machine can resolve, and put the judgement at the edges.
2. **The grammar growing to fit one kind.** `splitArgs` and `keyValues` are the whole of the shared
   helpers until a kind needs more; a helper added for one kind is a helper every later kind
   inherits.
3. **A hook point chosen too early.** None is chosen in 0.9.0; the first is chosen with the aura.
4. **The build refusing on purpose.** With no kinds, any rule line stops `sync_content.cmd`. That is
   the design, and `data/README.txt` says so, but a first-time author will meet it; the message
   names the cell and says no kinds are defined yet.

## Files, 0.9.0

Creates `module/rules/grammar.mjs`, `module/rules/kinds/index.mjs`, `module/rules/engine.mjs`,
`module/rules/README.md`, `assets/test_rules.mjs` and this file.

Touches `assets/xlsx_to_trees.py` (the tree sheets' header map and node), `assets/build_foundry.mjs`
(the parse, the failure, the summary line), `assets/build_all.mjs` (the `test_rules` step),
`module/data/item.mjs`, `module/data/actor.mjs`, `module/documents/item.mjs`,
`module/documents/actor.mjs`, `module/apps/item-sheet.mjs`, `templates/item/details.hbs`,
`lang/en.json`, `styles/starwrought.css`, `module/config.mjs` and `system.json` (0.9.0),
`CHANGELOG.md`, `FEATURES.md`, both READMEs, `CLAUDE.md` and `data/README.txt`. Untouched: every
spreadsheet cell, `assets/roster.json`, the web app, the Constellation Compendium docx, the
handbook, `data/SYNC.json`, and every roll, card and canvas layer in the system.
