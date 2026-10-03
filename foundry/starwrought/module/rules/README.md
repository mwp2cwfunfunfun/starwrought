# The automation framework (system 0.9.0)

Mike, 2026-10-03: "I'd like an Automation field in the data .xlsx files. And based on what is in
there, when I run sync_content.cmd (or when you run it as part of a build), it will create the
Foundry VTT automation code. However, I want to make sure the Foundry VTT automation code is
well-built. For example, if I create an automation syntax for the Torchbearer 15' aura, we should
create the syntax that will work for OTHER auras, too, without additional coding." And then:
"Important - do NOT survey the talents yet or build ANY of the automation hooks. just build the
framework. we will build automation syntax hooks one at a time."

This folder is that framework, and nothing more. It ships with **no rule kinds and no engine
hooks**. Every Automation cell in the book is empty, every `system.rules` is `[]`, and the index on
every Actor is empty. The rulings are 118 to 120 in the 0.9.0 changelog entry; `automation-plan.md`
in the project root is the design record.

## The files

| File | What it is |
|---|---|
| `grammar.mjs` | The line structure of a cell and nothing else. `parseAutomation`, `summarize`, `ruleEntries`, `RuleSyntaxError`, and the two helpers a kind may use, `splitArgs` and `keyValues`. |
| `kinds/index.mjs` | The registry: `KINDS`, `registerKind`, `kindOf`, `knownKinds`, `KIND_WORD`. Registers nothing yet. |
| `kinds/<kind>.mjs` | One file per kind, each exporting the definition below. None exist. |
| `engine.mjs` | `collectRules(actor)` and `rulesOfKind(actor, kind)`: the index the Actor keeps so a hook never walks the Items. |

Every one of them stays free of Foundry globals at module scope, because `assets/build_foundry.mjs`
and `assets/test_rules.mjs` import them from plain Node. The build and the client parse a cell with
the same function (ruling 120); the converter, `assets/xlsx_to_trees.py`, copies the cell's text
through as `automation` and knows no grammar, so Python and JavaScript never hold two parsers.

## The grammar

One rule per line. The word before the colon names a kind; everything after it is that kind's.

```
# a line beginning with # is a comment; a blank line is nothing
aura: 15 ft allies
aura 15 ft allies          (the colon is optional)
```

The kind word is everything up to the first `:` or whitespace, lower-cased. A word no kind answers
to is an error, `unknown rule kind "<word>" (no rule kinds are defined yet)` or `(known kinds: a,
b, c)`. At build time any error **fails the build**, naming the Constellation, the Talent and the
line, as a bad Aura cell stops the converter's write; at runtime, when a GM edits a world Item's
textarea, the same error is saved as an entry the Item sheet shows in red and the engine skips.
Nothing is ever thrown for a cell's sake (ruling 118).

## The data

On a Talent, an action and a Constellation Item:

- `system.automation`: the cell's text, as written.
- `system.rules`: one entry per line that is a rule. A parsed rule is `{ ...data, kind, line, text }`
  (the kind's data, then the reserved words, which win); a line that did not parse is
  `{ error, line, text }`. The build writes only parsed rules; the client (`SwItem#_preUpdate`)
  writes both, through `ruleEntries(parseAutomation(text))`. The line number counts every line of the
  cell from 1, blanks and comments included, so it is the line the designer sees.

On a character and an npc, prepared first thing in `prepareDerivedData` by `collectRules`:

```js
actor.system.rules = {
  all:     [{ rule, item }],                 // every usable rule
  byKind:  { "<kind id>": [{ rule, item }] }, // the same, filed; a kind not in use has no key
  unknown: [{ rule, item, reason }]          // error entries and rules of an unregistered kind
};
actor.rulesOfKind("aura");                   // always an array; an alias resolves to its id
```

The content loop carries a cell's rules to an open world as it carries any field: `system` is in
the content hash, so a changed cell changes the hash and Sync content updates the compendium Item;
the copies refresh overwrites an owned copy's `automation` and `rules` from the source, since the
cell is the author (ruling 120).

## The contract of a kind

```js
import { RuleSyntaxError, splitArgs, keyValues } from "../grammar.mjs";

export default {
  id: "aura",                       // lower-case letters and hyphens; the word before the colon
  aliases: [],                      // other words accepted before the colon
  parse(args, context) { ... },     // the text after the colon, trimmed; returns the rule's data
                                    // (a plain object) or throws RuleSyntaxError(message) with a
                                    // message a game designer can act on; context = { itemName,
                                    // constellation, itemType, source, line, text, kind }
  summary(rule) { ... },            // one short string for the sheet, from the parsed data
  hooks: {}                         // the engine hook points this kind speaks at; EMPTY in 0.9.0
                                    // and defined one at a time with the kind that needs them
};
```

`registerKind` enforces it: a definition missing `id`, `parse` or `summary`, an id or alias that
is not a kind word or is already taken (as an id or an alias), or a hook that is not a function, is
refused with a plain Error at load. A broken kind should stop the system, not parse every cell that
names it into silence.

What a kind may rely on:

- `parse` gets the arguments trimmed, never the kind word or the colon. It may return nothing for
  a kind with no arguments; the grammar stores `{}`. It may not use the reserved words `kind`,
  `line`, `text` or `error` in its data: the grammar drops them from what `parse` returned and
  writes its own, so a kind cannot have a parsed rule filed as one that did not parse.
- `throw new RuleSyntaxError("...")` is the designer's error and is printed as written. Any other
  throw is reported as the kind's failure ("a bug in the kind, not in the cell") so the build log
  points at the file. Either way the grammar never crashes.
- `splitArgs(text)` splits on the commas outside quotes, trims, unquotes a part wholly in quotes,
  drops empty parts, and throws RuleSyntaxError on an unclosed quote. `keyValues(parts)` sorts
  `key=value` pairs (keys lower-cased) from the rest and throws on a key given twice. Nothing more
  until a kind needs it; a helper two kinds share moves into `grammar.mjs` then.
- `summary(rule)` gets the stored entry. A summary that throws falls back to the rule's text.
- A kind file imports `RuleSyntaxError` from `../grammar.mjs` while `grammar.mjs` imports the
  registry, which imports the kind file. The circle is harmless as long as the kind uses what it
  imports inside `parse` and `summary`, at call time, and never at module scope.

## Adding a rule kind

One at a time, with Mike (ruling 119). The first is the aura, for Torchbearer, and its syntax is
his to settle. Each kind lands as one change with all of these in it:

1. **The file.** `kinds/<id>.mjs`, exporting the definition above. Its `parse` reads one syntax
   for every Talent that will ever use the word: the aura that serves Torchbearer must serve
   every aura in the book without a second kind.
2. **The registration.** Two lines at the foot of `kinds/index.mjs`: the import and
   `registerKind(<id>)`.
3. **The test.** In `assets/test_rules.mjs`: add the id to `SHIPPED_KINDS` (the self-test asserts
   the registry holds exactly that list, so a kind cannot ship unannounced), then checks of its
   own: the forms its `parse` accepts, the data it returns, the message of each thing it refuses,
   and its `summary`. `node assets/test_rules.mjs` must pass; `build_all.mjs` runs it in every
   mode as the step `test_rules`, right before `build_foundry`.
4. **The syntax line in `data/README.txt`.** Under the Automation column's entry, one line naming
   the kind and the forms its arguments take, in the voice the Aura column's entry uses. That file
   is what a designer reads with the workbook open.
5. **The engine hook.** Defined with the kind and not before. The kind's `hooks` object names the
   hook point(s) it speaks at, and the engine code that calls them lands in the same change,
   wherever the rule's effect lives (an aura's in `canvas/auras.mjs` beside the Aura column's
   rings; a bonus's in `dice/check.mjs`). The hook asks `actor.rulesOfKind("<id>")` for the rules
   in play and never walks `actor.items`. This README gains a short section per hook point once
   one exists: its name, when the engine calls it, what it is handed and what it may return.
6. **The docs.** A `CHANGELOG.md` entry under the system version it ships in, with the ruling that
   settled the syntax; a paragraph in `FEATURES.md`'s "Automation" section saying what the kind
   does on screen; `CLAUDE.md`'s standing paragraph on the framework names the kind.
7. **The content loop that carries it.** A kind's code ships with the system (a release, with the
   three version stamps bumped). A cell that uses the kind reaches an open world through the
   content loop: save the workbook, run `sync_content.cmd` (or `node assets/build_all.mjs
   --content`), take Sync content in Foundry. The cell's rules travel as any field does, and a
   cell the grammar refuses stops the loop before the sources are written, naming the cell.

## What is deliberately not here

No survey of the Talents' Effects for what they would need; no kind, not even the aura; no hook
point; no engine code in any roll, the attack flow, damage, conditions, movement or the auras on the
map. All of it by Mike's instruction, quoted at the top. The framework's job in 0.9.0 is to make
each of those a small, local addition when its turn comes.
