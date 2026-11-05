# The automation framework (system 0.9.0; the first kind, `bonus`, 0.10.0)

Mike, 2026-10-03: "I'd like an Automation field in the data .xlsx files. And based on what is in
there, when I run sync_content.cmd (or when you run it as part of a build), it will create the
Foundry VTT automation code. However, I want to make sure the Foundry VTT automation code is
well-built. For example, if I create an automation syntax for the Torchbearer 15' aura, we should
create the syntax that will work for OTHER auras, too, without additional coding." And then:
"Important - do NOT survey the talents yet or build ANY of the automation hooks. just build the
framework. we will build automation syntax hooks one at a time."

This folder is that framework and its kinds. 0.9.0 shipped it with **no rule kinds and no engine
hooks**, by that instruction (rulings 118 to 120). 0.10.0 adds the first kind, **`bonus`**, from
Mike's own next sentence ("first automation kind we will create is the Human Ancestry one"), and
with it the first and only hook point, **`modifiers`**, which the check engine and the Defense pass
call (rulings 121 to 124). Every other Automation cell in the book is still empty; the kinds come
one at a time, with Mike, and the aura for Torchbearer is next. `automation-plan.md` in the project
root is the design record; the rulings are in the 0.9.0 and 0.10.0 changelog entries.

## The files

| File | What it is |
|---|---|
| `grammar.mjs` | The line structure of a cell and nothing else: `parseAutomation`, `summarize`, `ruleEntries`, and the plain-data check on what a kind returns. Re-exports the registry's words and `syntax.mjs`. |
| `syntax.mjs` | What a kind file imports: `RuleSyntaxError`, `splitArgs`, `keyValues`. Imports nothing, so a kind never imports the grammar and no circle exists (0.10.1; the class alone as `errors.mjs` in 0.10.0). |
| `kinds/index.mjs` | The registry: `KINDS`, `registerKind`, `kindOf`, `knownKinds`, `KIND_WORD`. Registers `bonus`. |
| `kinds/bonus.mjs` | The `bonus` kind: a typed bonus or penalty to a Constellation's checks or a Maneuver's roll, gated on a rank. |
| `kinds/<kind>.mjs` | One file per kind, each exporting the definition below. |
| `engine.mjs` | `collectRules(actor)` and `rulesOfKind(actor, kind)`: the index the Actor keeps so a hook never walks the Items. `ruleModifiers(actor, context)`: the `modifiers` hook point's dispatcher. |

Every one of them stays free of Foundry globals at module scope, because `assets/build_foundry.mjs`
and `assets/test_rules.mjs` import them from plain Node. The build and the client parse a cell with
the same function (ruling 120); the converter, `assets/xlsx_to_trees.py`, copies the cell's text
through as `automation` and knows no grammar, so Python and JavaScript never hold two parsers.

## The grammar

One rule per line. The word before the colon names a kind; everything after it is that kind's.

```
# a line beginning with # is a comment; a blank line is nothing
bonus: +1 Condition to Aid if Human is Trained
bonus +2 Condition to Aid if Human is Expert          (the colon is optional)
```

The kind word is everything up to the first `:` or whitespace, lower-cased. A word no kind answers
to is an error, `unknown rule kind "<word>" (known kinds: bonus)`. At build time any error **fails
the build**, naming the Constellation, the Talent and the line, as a bad Aura cell stops the
converter's write; at runtime, when a GM edits a world Item's textarea, the same error is saved as
an entry the Item sheet shows in red and the engine skips. Nothing is ever thrown for a cell's sake
(ruling 118).

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
actor.rulesOfKind("bonus");                  // always an array; an alias resolves to its id
```

The content loop carries a cell's rules to an open world as it carries any field: `system` is in
the content hash, so a changed cell changes the hash and Sync content updates the compendium Item;
the copies refresh overwrites an owned copy's `automation` and `rules` from the source, since the
cell is the author (ruling 120).

**A rule is plain data.** What a kind's `parse` returns is stored on the Item, hashed, written to
the pack sources, carried by Sync content and saved by the database, all as JSON, so the grammar
checks it before storing it (0.10.1): null, booleans, finite numbers, strings, arrays and plain
objects of the same, and nothing else. NaN, Infinity, a function, a symbol, a Date, a Map, a class
instance or a cycle is reported as the kind's bug with the path to it (`the "aura" kind returned
data that cannot be stored (range is NaN)`), and the stored copy drops undefined properties as JSON
would, so a stored rule always equals its own JSON image.

**When a kind changes what it stores.** There is no version number on a rule; the cell's text is
the version, and a parse is re-derived from it wherever it is stale: the build rewrites every
compendium rule on every run, Sync content's copies refresh rewrites an owned copy's `rules` from
the source (ticked by default), and a world Item re-parses on its next edit of the textarea. The
one residue is an owned copy whose GM unticked the refresh, or a world Item nobody edits again. So
a kind that changes the shape of its data does one of two things in the release that changes it:
its hooks read the old shape as well as the new for that release, or the release's world
migration re-parses `system.automation` on every Item of `RULE_ITEM_TYPES` that carries a rule of
that kind (the migration block in `starwrought.mjs`, which already walks the world's documents
once per version). Which, is decided with the change; neither has been needed.

## The `bonus` kind (0.10.0; rulings 121 to 124)

Mike's ask, for Humanity, the Root of the Human Ancestry: "You gain a +1 Condition bonus on checks
to Aid. If you are Expert in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you
are Legendary, +4." His sketch, "IF (Constellation Proficiency = VALUE) ... Grant [X Value]; [Y
type]; [Z Check (Constellation or Maneuver Roll)]", made concrete (ruling 121):

```
bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]

bonus: +1 Condition to Aid if Human is Trained
bonus: +2 Condition to Aid if Human is Expert
bonus: +3 Condition to Aid if Human is Master
bonus: +4 Condition to Aid if Human is Legendary
bonus: -2 Situation to Stealth
```

- `<value>`: a signed integer; a bare `1` reads as `+1`. `0` is refused ("a bonus of 0 does
  nothing").
- `<Type>`: `Situation`, `Condition` or `Gear`, case blind (the book's three since v3.3). The
  retired words are refused by name ("write Condition, not status: the book renamed the types in
  v3.3"); `untyped` is refused ("no Talent bonus is untyped").
- `to <Target>`: required. A Constellation or a Maneuver, by the name the trees and the action
  sheets print, case blind; the slug form (`armored-fighting`) reads too, and a Maneuver's cost
  glyphs are ignored (`slugify(plainName(name))`). A Lore is refused: it is the character's own.
- `if <Constellation> is <Rank>`: optional. `<Rank>` is `Untrained`, `Trained`, `Expert`, `Master`
  or `Legendary`, case blind. The condition is **equality**, as Mike wrote it: the rule applies
  while the character's rank in that Constellation is exactly that rank, which is why Humanity is
  four lines, one per sentence, and never two at once. The word between is `is`, not `=`, and the
  error says so ("write `if Human is Expert`"). A line that matches none of this prints the shape.

The stored rule:

```js
{ kind: "bonus", line, text,
  value: 1,                                              // signed integer, never 0
  type: "condition",                                     // "situation" | "condition" | "gear"
  to:   { name: "Aid", slug: "aid", type: "action" },    // type: "constellation" | "action" | null
  when: { constellation: "human", name: "Human", rank: "expert" } }   // or null
```

`to.type` and the resolved names come from `context.resolve` (below). With a resolver, a target it
returns null for is an error (`"Aidd" names no Constellation or Maneuver`), and so is an `if`
Constellation that resolves to a Maneuver or to nothing (`"Aid" is not a Constellation`). With no
resolver (the self-test, a caller that has none) `to.type` is `null`, `to.slug` is
`slugify(plainName(name))`, `to.name` is the name as written, the `when` Constellation is
`slugify(name)`, and the hook matches on slug alone, trying both readings of the target.

The summary, for the Item sheet's As read list: `+1 Condition bonus to Aid while Human is Expert`;
a negative value says `penalty` (`-2 Situation penalty to Stealth`); no clause, no `while`.

What the hook does, on the `modifiers` hook point (below): a conditioned rule is skipped unless
`actor.system.proficiency(constellation).rank` is the named rank (an adversary has no
`proficiency`, so a conditioned rule never fires for one; an unconditioned one still can where the
engine asks). A Constellation target is **applied** when the roll's slug is the target's, a check
and an Initiative rolled with that Constellation alike (ruling 111), and, through the Defense pass,
on a Defense's Threshold and roll. A Maneuver target is **applied** when the roll carries that
Maneuver's Item (ruling 123: a Maneuver's roll is a roll made from its Item; Aid's Relevant Check
carries Aid), and when a check is made with no Maneuver behind it the bonus is **offered** unticked
in the roll dialog instead, labelled `Humanity: Aid`, so the judgement "is this roll an Aid?" sits
with the player (ruling 122). It is never offered on an attack, a Defense or an Initiative, and not
on a check made from another Maneuver's Item (a Search is not an Aid). The applied modifier is
`{ label: "Humanity", value, type }`, so the card reads "Humanity +1"; typed stacking is the
engine's.

## The contract of a kind

```js
import { RuleSyntaxError, splitArgs, keyValues } from "../syntax.mjs";   // never from the grammar

export default {
  id: "bonus",                      // lower-case letters and hyphens; the word before the colon
  aliases: [],                      // other words accepted before the colon
  parse(args, context) { ... },     // the text after the colon, trimmed; returns the rule's data
                                    // (a plain object) or throws RuleSyntaxError(message) with a
                                    // message a game designer can act on; context = { itemName,
                                    // constellation, itemType, source, resolve?, line, text, kind }
  summary(rule) { ... },            // one short string for the sheet, from the parsed data
  hooks: {                          // the engine hook points this kind speaks at, by name; the
    modifiers(entries, context, actor) { ... }   // engine calls each where that moment comes
  }
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
- `context.resolve`, when the caller gives one: `resolve(name) -> { type: "constellation" |
  "action", slug, name } | null`, the names a cell may point at. The build builds one over every
  Constellation in `trees.json` and every Maneuver on the action sheets and in the roster's
  `actions` block, enabled or not (a disabled Maneuver still resolves: the cell is right, the row
  is simply off); the client's is `resolveRuleTarget` in `module/helpers/content.mjs`, over the
  Constellation registry, the Actions pack's index and the world's Maneuvers. A Constellation wins
  over a Maneuver of the same name. The grammar passes the caller's context through to `parse` as
  `{ ...context, line, text, kind }`, so `resolve` rides in it with no grammar change. A kind must
  work without one (the self-test gives none) and should then store what it can make itself.
- `throw new RuleSyntaxError("...")` is the designer's error and is printed as written. Any other
  throw is reported as the kind's failure ("a bug in the kind, not in the cell") so the build log
  points at the file. Either way the grammar never crashes.
- `splitArgs(text)` splits on the commas outside quotes, trims, unquotes a part wholly in quotes,
  drops empty parts, and throws RuleSyntaxError on an unclosed quote. `keyValues(parts)` sorts
  `key=value` pairs (keys lower-cased) from the rest and throws on a key given twice. Nothing more
  until a kind needs it; a helper two kinds share moves into `syntax.mjs` then. (`bonus` reads its
  line with one regular expression and uses neither.)
- `summary(rule)` gets the stored entry. A summary that throws falls back to the rule's text.
- **A kind file imports from `../syntax.mjs` and `../../config/*` and never from `../grammar.mjs`
  or `./index.mjs`.** The grammar imports the registry and the registry imports every kind, so a
  kind that imported either would close a circle, and a circle breaks whenever the kind file
  happens to be the first module evaluated (0.10.0 met this: `registerKind(bonus)` ran before
  `bonus` existed). `syntax.mjs` imports nothing, so there is no circle and nothing to be careful
  about at module scope. A kind file is still never an entry point: the system, the build and the
  self-test enter through the grammar, the registry or the engine.
- What `parse` returns must be plain data (the "A rule is plain data" paragraph above); the
  grammar refuses anything else as the kind's bug and names the path.
- `slugify`, `plainName`, `RANKS`, `LEGACY_BONUS_TYPES`, `isLoreSlug` and the rest of
  `module/config.mjs` are pure and may be imported from a kind; the build imports that module from
  Node already.

## Hook points

A hook point is a moment in the engine where every registered kind is asked one question about
its own rules on an Actor. The engine's call sites exist once per hook point; a kind takes part by
naming the point in its `hooks`, and a new kind that wants an existing moment adds no engine code
(ruling 124). A new moment is still defined with the first kind that needs it (ruling 119). There
is one.

### Calculated and triggered

Two categories of hook point, told apart by whether a hook may change anything (the
automation-framework review, 2026-11-04). Every hook point declares which it is in its section
below, and a kind's hook keeps to it.

- **Calculated.** The engine asks a question and the hook answers with data: modifiers, an
  adjustment, a list of what applies. The hook writes no document, posts no card, and may be
  called on any client and any number of times with the same answer. `modifiers` is one. A
  failure is isolated to the kind that failed: the dispatcher reports it once and takes nothing
  from that kind, and the roll or the sheet goes on with the rest. Stacking and ordering are the
  caller's, through the rule the caller already has (`SW.resolveModifiers` for a roll), never the
  dispatcher's.
- **Triggered.** Something happened (a Critical Hit landed, a Wound was taken, a round ended) and
  a rule asks for an operation in answer: a condition set, Vigor restored, a card posted. Every
  client sees the event, so a triggered hook point must say, when it is defined, **which one
  client executes** (the pattern the system already has: the attack coordinator and the loot
  relay run on the active GM's client, the asker read from the server's stamp), **what names the
  event** so an operation already done is recognised and not done twice (the Combat round and
  turn, the message id, the attack id), and **what a failure does** to the operation it was part
  of (abort it whole, or record the rule and go on), since a half-applied state change is worse
  than none. None exists yet; the first kind that needs one defines it with these three answers
  in its section here, and not before.

A kind may speak at both: an aura is calculated while it adjusts a Defense and triggered if it
ever restores Vigor. The two are two hook points, not one with a flag.

### `modifiers` (0.10.0)

Calculated. `hooks.modifiers(entries, context, actor) -> Modifier[]`, dispatched by
`ruleModifiers(actor, context)` in `engine.mjs`, which returns `{ applied, offered }`.

- **When the engine calls it.** Twice in the system, once per roll each: in `baseModifiers`
  (`module/dice/check/modifiers.mjs`, the check engine's)
  (`module/dice/check.mjs`), the non-Defense branch, after the sheet's own terms and before the
  caller's; and in `prepareDefenses` (`module/data/character/defenses.mjs`, the character's
  Defense pass, called from `SwCharacterData#prepareDerivedData`), per Defense,
  before `SW.resolveModifiers`, so a bonus to Guard moves the Threshold on the sheet, the Skills
  grid and the Guard roll alike. The Defense branch of `baseModifiers` rolls the Defense's own
  folded modifiers and does not ask again, so a Defense roll, an Initiative rolled with Awareness
  and a Defense rolled as a check all carry a bonus once and never twice. The npc early return
  stands: adversaries roll flat, and rules do not reach them in 0.10.0.
- **What it is handed.** `entries`: this kind's rules on this actor, `[{ rule, item }]`, from
  `rulesOfKind` (never the whole index). `context`: `{ kind: "check" | "attack" | "defense" |
  "initiative", slug, item }`, the roll's kind, the Constellation slug supplying the Proficiency
  Bonus (`""` when none), and the Item behind the roll (a Maneuver, a weapon, a Talent) or null.
  `actor`: the Actor, whose `system.proficiency(slug).rank` a kind may read.
- **What it may return.** An array of `{ label, value, type?, offer?, key?, hint? }`. A modifier
  without `offer` is **applied** to the roll as the sheet's own terms are. One with `offer: true`
  is **offered** unticked in the roll dialog (the Load Strain Climb-or-Swim precedent, PHB v4.11,
  ruling R2), `key` the checkbox's name, unique per offer, `hint` its tooltip; `previewTotal`
  ignores offers, and the Defense pass does too.
- **What the dispatcher does.** Walks `KINDS`; skips a kind without the hook and a kind with no
  entries on this actor; calls the hook inside try/catch, a throw reported once as
  `STARWROUGHT | the "<id>" kind's modifiers hook failed:` and contributing nothing, so a roll never
  dies over a rule; drops a modifier whose `value` is not a non-zero number (a numeric string is
  read as a number); gives a keyless offer a key of its own (`<kind>-<n>`) and suffixes a key two
  offers share. Typed stacking is not its job: the caller's `SW.resolveModifiers` treats what comes
  back as it treats every other term.

## Adding a rule kind

One at a time, with Mike (ruling 119). The first was `bonus`; the next is the aura, for
Torchbearer, and its syntax is his to settle. Each kind lands as one change with all of these in it:

1. **The file.** `kinds/<id>.mjs`, exporting the definition above. Its `parse` reads one syntax
   for every Talent that will ever use the word: the aura that serves Torchbearer must serve
   every aura in the book without a second kind, as `bonus` serves every typed bonus.
2. **The registration.** Two lines at the foot of `kinds/index.mjs`: the import and
   `registerKind(<id>)`.
3. **The test.** In `assets/test_rules.mjs`: add the id to `SHIPPED_KINDS` (the self-test asserts
   the registry holds exactly that list, so a kind cannot ship unannounced; the unknown-kind
   checks use the reserved word `not-a-real-kind`, so no real kind's name is assumed unknown
   anywhere in the file), then checks of its own: the forms its `parse` accepts, the data it returns, the message of each thing it refuses,
   its `summary`, and its hooks through the dispatcher with a fake actor (`rulesActor` in the
   `bonus` section is the model). `node assets/test_rules.mjs` must pass; `build_all.mjs` runs it
   in every mode as the step `test_rules`, right before `build_foundry`.
4. **The syntax line in `data/README.txt`.** Under the Automation column's entry, one line naming
   the kind and the forms its arguments take, in the voice the Aura column's entry uses. That file
   is what a designer reads with the workbook open.
5. **The hook.** A kind names the hook point(s) it speaks at in `hooks`, and the engine's call
   sites exist once per hook point, so a kind that wants a moment the engine already asks about
   (`modifiers`) adds no engine code: `bonus` is wired by its `hooks.modifiers` alone. A kind that
   needs a NEW moment (an aura's, in `canvas/auras.mjs` beside the Aura column's rings, say)
   defines the hook point with it and not before: its dispatcher in `engine.mjs` in the shape of
   `ruleModifiers` (walk `KINDS`, skip the silent, try/catch the hook, validate what comes back),
   its call site(s) where the effect lives, and its section under "Hook points" above (its name,
   when the engine calls it, what it is handed, what it may return). Every hook asks
   `rulesOfKind` for the rules in play and never walks `actor.items`.
6. **The docs.** A `CHANGELOG.md` entry under the system version it ships in, with the ruling that
   settled the syntax; a paragraph in `FEATURES.md`'s "Automation" section saying what the kind
   does on screen; `CLAUDE.md`'s standing paragraph on the framework names the kind.
7. **The content loop that carries it.** A kind's code ships with the system (a release, with the
   three version stamps bumped). A cell that uses the kind reaches an open world through the
   content loop: save the workbook, run `sync_content.cmd` (or `node assets/build_all.mjs
   --content`), take Sync content in Foundry. The cell's rules travel as any field does, and a
   cell the grammar refuses stops the loop before the sources are written, naming the cell.

## What is deliberately not here

No survey of the Talents' Effects for what they would need; no kind but `bonus`, and no hook point
but `modifiers`; no engine code in the attack flow's resolution, damage, conditions, movement or
the auras on the map. All of it by Mike's instruction, quoted at the top: the kinds come one at a
time, from the Talent that wants each. The framework's job is to make each of those a small, local
addition when its turn comes, and `bonus` was the first proof: one file, two lines in the
registry, one dispatcher and two call sites, and nothing else in the system learned what a bonus
is.
