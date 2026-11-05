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
yet**: no rule kind exists, no engine hook is wired, and no Talent's text has been read. The first
kind followed the same day, as system 0.10.0 (the section at the end): Mike named it, and it was
not the aura.

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

1. **The first kind was `bonus`, for Humanity** (0.10.0; the section at the end). Mike named it on
   2026-10-03, ahead of the aura, and its syntax came from his own sketch.
2. **The aura, for Torchbearer Human.** Shipped in 0.13.0 as two lines on one Talent: `aura: 15ft,
   allies, VISIBLE` draws the ring (the `aura` kind, the Aura column's successor) and `bonus: +1,
   Situation, Defenses, FOR(allies, 15ft), FIRST(round)` is the effect inside it, read by the
   `bonus` kind through the operator grammar. Every aura in the book is the same two words. Mike
   rewrote the Talent as the Rally Aura on 2026-11-05 (an ally who can see you, against an attack
   with the Fear trait), and 0.14.0 added the two readings it needed to the operators every kind
   shares rather than a kind: `SEEN` (line of sight, `scene.sees`) and `IF(Trait=<Trait>)` (the
   attack record's traits, `threatContext`), so the line is now `bonus: +1, Situation, Defenses,
   FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)`. No kind was added; the grammar grew.
3. **Then one at a time.** Each kind from the Talent that wants it, by the recipe above, with its
   hook, its test, its section in `AUTOMATION_GRAMMAR.md` and its docs. 0.13.0 added `grant`,
   `aura` and `prevent` beside the rewritten `bonus`, enough for the level-1 Human; the grammar
   they share is `AUTOMATION_GRAMMAR.md` (the operators `IF`, `FOR`, `WHILE`, `AGAINST`, `FIRST`,
   `ONCE`, `DIFFERENT`, `VISIBLE`), and the second hook point, `prevent`, is triggered
   (`module/rules/README.md` has its three answers). No order is fixed beyond the next Talent.

## Decisions that are Mike's

1. **The first kind's syntax.** Settled in 0.10.0 (ruling 121) as prose, and in 0.13.0 (ruling 164)
   as the operator grammar at Mike's direction ("logical operands like IF(Origin=Trained) and
   grammatical shortcuts like Bonus: +1, Condition, Aid"): `bonus: <±N>, <Type>, <Target>
   [, operators]`, the prose form retired. The grammar is his document, `AUTOMATION_GRAMMAR.md`,
   and every change to the code changes it in the same commit.
2. **Whether the web app and the Constellation Compendium docx should print the cell.** Neither
   does today; both are the authoring views of the whole book, and the cell is addressed to the
   engine. Printing it would show an author what the system will do with a Talent beside what the
   Talent says. Still open after 0.10.0.
3. **Whether an owned copy's edited Automation should survive a refresh.** Today the copies refresh
   overwrites `system.automation` and `system.rules` from the source, as it overwrites every field
   but the character's own (quantity, carry state, a raised shield, a chosen option), because the
   cell is the author (ruling 120). Keeping a GM's edit would make the copy the author of its own
   rules and let a Talent on a sheet diverge from the book. Still open after 0.10.0.

## Risks

1. **A kind that needs GM judgement inside a formula.** The standing risk the working agreement
   names ("Expose a plausible Zone"). A kind's `parse` can validate syntax; it cannot validate a
   judgement. Prefer kinds a machine can resolve, and put the judgement at the edges. The `bonus`
   kind met it at once: whether a check made from the sheet is an Aid is a judgement, and the kind
   puts it at the edge, an unticked offer in the roll dialog, applied unasked only when the roll is
   made from the Maneuver's own Item (0.10.0, ruling 122).
2. **The grammar growing to fit one kind.** `splitArgs` and `keyValues` are the whole of the shared
   helpers until a kind needs more; a helper added for one kind is a helper every later kind
   inherits. The `bonus` kind needed neither, nor any grammar change: its resolver rides in the
   parse context the grammar already passes through.
3. **A hook point chosen too early.** None was chosen in 0.9.0. The first, `modifiers`, was chosen
   in 0.10.0 with the `bonus` kind, the first kind that needed it, and it is generic: the engine
   asks every registered kind at the two moments it is called, so a second kind at the same moment
   adds no engine code (ruling 124). A moment no kind yet speaks at is still undefined, the aura's
   among them, and stays so until its first kind.
4. **The build refusing on purpose.** With one kind, any other kind word stops `sync_content.cmd`,
   and so does a `bonus` line the kind refuses. That is the design, and `data/README.txt` says so,
   but a first-time author will meet it; the message names the cell and lists the known kinds, or
   says what is wrong with the line in words the author can act on.

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

## 0.10.0: the first kind, `bonus`

Built 2026-10-03, the same day as the framework, against system 0.9.0 and Player's Handbook v4.15.
Mike's words: "okay, first automation kind we will create is the Human Ancestry one. The Effect
is: 'You gain a +1 Condition bonus on checks to Aid. If you are Expert in Human, this becomes a +2
Condition bonus. If you are Master, +3. If you are Legendary, +4.' So we need Automation for
something like ... IF (Constellation Proficiency = VALUE) where VALUE = Untrained, Trained, Expert,
Master, Legendary, Grant [X Value (+1, +2, -1, -2, etc.)]; [Y type (Condition, Situation, Gear,
etc.)]; [Z Check (Constellation or Maneuver Roll)]. In this case, it would use a Maneuver called
Aid." So the first kind was not the aura the plan expected but a bonus, and its syntax was Mike's
own sketch, made concrete rather than designed. The rulings are 121 to 124 in the 0.10.0 changelog
entry. The release adds one kind and the one hook point it needs, and nothing else: no survey of
the other Talents, no second kind, no second moment (ruling 119 stands).

### The syntax (ruling 121)

Kind word `bonus`, no aliases. One rule:

```
bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]
```

- `<value>`: a signed integer, `+1`, `-2`; a bare `1` reads as `+1`. `0` is a RuleSyntaxError ("a
  bonus of 0 does nothing").
- `<Type>`: `Situation`, `Condition` or `Gear`, case blind (the book's three types since v3.3). The
  retired words `circumstance`, `status` and `item` (`SW.LEGACY_BONUS_TYPES`) are a RuleSyntaxError
  that names the current word; `untyped` is one too ("no Talent bonus is untyped").
- `to <Target>`: required. The Constellation or the Maneuver the bonus applies to, by name as the
  trees and the action sheets print it, case blind; the slug form (`armored-fighting`) also reads,
  and glyphs in a Maneuver's name are ignored (`slugify(plainName(name))`).
- `if <Constellation> is <Rank>`: optional. `<Rank>` is `Untrained`, `Trained`, `Expert`, `Master`
  or `Legendary`, case blind (keys of `SW.RANKS`). The condition is EQUALITY, as Mike wrote it
  ("Constellation Proficiency = VALUE"): the rule applies while the character's rank in that
  Constellation is exactly that rank. A bad rank word lists the five; `=` in place of `is` is
  refused with the shape ("write `if Human is Expert`").

One case-blind regex over the argument string reads it all; anything that does not match prints the
shape, `bonus: +1 Condition to Aid if Human is Expert`. Humanity's cell is four lines, one per
sentence of its Effect:

```
bonus: +1 Condition to Aid if Human is Trained
bonus: +2 Condition to Aid if Human is Expert
bonus: +3 Condition to Aid if Human is Master
bonus: +4 Condition to Aid if Human is Legendary
```

"Expert in Human" is the Origin's rank: the three Ancestry Roots pool one rank, which
`actor.system.proficiency("human").rank` already returns. Nothing in the syntax says "or higher";
a Talent that wants that form says so when it comes.

### The stored rule

```js
{ kind: "bonus", line, text,
  value: 1,                       // signed integer, never 0
  type: "condition",              // "situation" | "condition" | "gear"
  to:   { name: "Aid", slug: "aid", type: "action" },        // type: "constellation" | "action" | null
  when: { constellation: "human", name: "Human", rank: "expert" } }   // or null
```

`to.type` and the resolved names come from `context.resolve(name) -> { type, slug, name } | null`,
an optional function the caller puts on the parse context; the grammar passes the caller's context
through to `parse` already, so no grammar change. With a resolver, a target it does not know is a
RuleSyntaxError (`"Aidd" names no Constellation or Maneuver`), an `if` Constellation that resolves
to a Maneuver or to nothing is one (`"Aid" is not a Constellation`), and the Lore template
(`SW.isLoreSlug`) is one as a target ("a Lore is the character's own; a bonus cannot name it").
Without a resolver (the self-test) the kind stores `to.type: null` and the slugs it can compute,
and the hook matches on slug alone. The two callers of the grammar each give one:
`assets/build_foundry.mjs` builds a resolver over every key of `trees.json` and every sheet action
and roster `actions` row, enabled or not (a disabled action still resolves: the cell is right, the
row is simply off; Aid was one until Mike enabled it on 2026-10-03), a Constellation winning over
an action of the same name, and passes it to
both `automationOf` calls; `resolveRuleTarget(name)` in `module/helpers/content.mjs` answers from
`SW.constellations`, the Actions pack's index and world action Items, null while `game` is not
ready, for `SwItem._preUpdate`. The summary reads `+1 Condition bonus to Aid while Human is
Expert`, `penalty` for a negative value, no `while` without an `if`.

### The hook point, `modifiers` (ruling 124)

The one new engine seam, and it is generic. A kind that affects a roll declares
`hooks.modifiers(entries, context, actor) -> Modifier[]`: `entries` its own rules on this actor
(`[{ rule, item }]`, from `rulesOfKind`), `context` `{ kind: "check" | "attack" | "defense" |
"initiative", slug, item }` (the roll's kind, the Constellation supplying the Proficiency Bonus,
and the Item behind the roll when there is one), each Modifier `{ label, value, type, offer?,
key?, hint? }`. A Modifier without `offer` is APPLIED to the roll; one with `offer: true` is
OFFERED unticked in the roll dialog (the Load Strain Climb-or-Swim precedent, PHB v4.11, ruling
R2), with `key` unique per offer and `hint` the tooltip; `previewTotal` ignores offers.
`ruleModifiers(actor, context) -> { applied, offered }` in `module/rules/engine.mjs` is the
dispatcher: it walks `KINDS`, skips a kind without the hook or with no rules on this actor, calls
each inside try/catch (a kind's throw is logged as that kind's failure and contributes nothing; a
roll never dies over a rule), keeps only modifiers with a numeric non-zero value, and files
`offer === true` under `offered` with `key` defaulted to `<kind>-<item id or name>-<line>`. That
is the whole of what the engine knows: a second kind that wants the same moment names `modifiers`
in its `hooks` and adds no engine edit, which answers Mike's question of the day (are the
automations modular enough to tinker with one without touching the rest?) by construction.

**The two call sites**, both existing passes, no third:

- `module/dice/check.mjs`, `SwCheck.#baseModifiers`, the non-Defense branch, at its end: the
  applied modifiers join the base terms, the offered ones ride on the config as `ruleOffers`, and
  `#prompt` lists them after the Load Strain offer as unticked checkboxes; the existing
  `extra-<key>` loop carries a ticked one into the roll and `result.extras`, so a kept road roll
  re-counts it (0.7.3). The Defense branch returns the Defense's own `modifiers`, which the data
  model has already folded the rules into, so a Defense roll, an Initiative rolled with Awareness
  and a Defense rolled as a check carry the bonus once and never twice. The npc early return
  stands: adversaries roll flat, and rules do not reach them in 0.10.0.
- `module/data/actor.mjs`, `SwCharacterData.#prepareDefenses`, inside the per-Defense loop before
  `SW.resolveModifiers`: the applied modifiers of a `defense` context join the list. The index and
  the ranks are both final by then, so `bonus: +1 Gear to Guard if Human is Expert` moves the Guard
  Threshold on the sheet and the Guard roll alike, as Frightened does. Offers are ignored here.

**The `bonus` kind's hook.** For each rule: with an `if` clause, read
`actor.system.proficiency(when.constellation).rank` (`"untrained"` when the actor has no
`proficiency`, so a conditioned rule never fires for an adversary) and skip unless it equals
`when.rank`. A Constellation target applies when `context.slug` is `to.slug`. A Maneuver target
applies when `context.item` is an action whose `slugify(plainName(name))` is `to.slug`; when it is
not and the roll is a `check`, it is offered instead (`key: "bonus-<item.id ?? item.name>-<line>"`,
label `<Talent>: <Target>`, hint "<Talent>: this bonus applies to checks to <Target>. Tick it if
this roll is one."), never on an attack, a Defense or an Initiative (ruling 122). A `to.type` of
null tries both and offers only when the slug matched no Constellation. The applied modifier is
`{ label: plainName(item.name), value, type }`, so the card reads "Humanity +1". Typed stacking
is `SW.resolveModifiers`'s: two Humanity lines never both match (one rank at a time), and a
designer who writes overlapping lines gets the highest of the type.

### A Maneuver's roll carries the Maneuver (rulings 122 and 123)

A Maneuver roll is a roll made from the Maneuver's Item. `SwItem#use` for an action with a named
check (Search's Awareness) already passed `item: this` to `SwCheck.roll`, so the hook matches it
as it stands. Aid's check is a Relevant Check, which had no representation: `use()` posted the
card and the player rolled from the sheet with no Item. Now `check.enabled` with a blank
`constellation` means a Relevant Check, and `use()` calls `actor.rollRelevantCheck` with the
Maneuver as `item`, its plain name as the label and its glyph and category as the subtitle;
`rollRelevantCheck` lets a caller's `label` stand. `build_foundry.mjs` sets `check: { enabled:
true, constellation: "", defense: "" }` on a sheet action whose Effect says "relevant check" (case
blind) and names no check; Aid's row reads Yes since Mike moved it into `data/maneuvers.xlsx` on
2026-10-03, so Aid ships with `check` set and its roll opens the picker carrying the Maneuver
(verified live: the card reads "Aid", "Humanity +1 condition"). `templates/item/details.hbs` says so under the "Rolls a
check" panel (`STARWROUGHT.Hint.relevantCheck`). No new schema field. The judgement "is this roll
an Aid?" therefore sits at the edge: applied when the roll is the Maneuver's own, offered to the
player otherwise, decided by the engine never.

### What was deliberately not done, and why

- **Humanity's cell.** Excel held `data/ancestries.xlsx` open, and the Human sheet has no
  Automation column yet; the four lines above are Mike's to paste under a new `Automation` header,
  then `sync_content.cmd` and Sync content. Until then no cell in the book uses the kind, and the
  build's summary says so (`automation: no rules (1 kind defined, none in use)`).
- **The survey.** Still not made; the kind came from the one Talent Mike named.
- **A second kind, a second moment.** The aura is next, and its hook point, if `modifiers` does
  not serve it, is defined with it (ruling 119).
- **Adversaries.** The npc branch of the check engine returns the GM's flat bonus, and an
  adversary's Defenses are the Thresholds the GM typed; a rule on an adversary's action is indexed
  and read by nothing.

### Files, 0.10.0

Creates `module/rules/kinds/bonus.mjs`. Touches `module/rules/kinds/index.mjs` (the
registration), `module/rules/engine.mjs` (`ruleModifiers`), `module/rules/README.md` (the kind,
the hook point, step 5 for generic dispatch), `module/dice/check.mjs`, `module/data/actor.mjs`,
`module/documents/item.mjs`, `module/documents/actor.mjs`, `module/helpers/content.mjs`,
`templates/item/details.hbs`, `lang/en.json`, `assets/build_foundry.mjs` (the resolver, the
Relevant Check `check`, the summary's plurals), `assets/test_rules.mjs`, `module/config.mjs`,
`system.json` and the stylesheet (0.10.0), `CHANGELOG.md`, `FEATURES.md`, `CLAUDE.md`,
`data/README.txt` and this file. Untouched: the grammar module, the converter, every spreadsheet
cell (Humanity's included), `assets/roster.json`, the web app, the Constellation Compendium docx,
the handbook, `data/SYNC.json`, the attack flow, the damage pipeline, conditions, movement and the
auras on the map.

## 0.15.0: the two Cultures (2026-11-05)

The eight Culture Talents Mike rewrote, written in the grammar one Talent at a time (ruling 119);
the full record is the 0.15.0 changelog entry (rulings 174 to 181) and `AUTOMATION_GRAMMAR.md`.
What the grammar gained, and why each is an operator or a kind:

- **`CLAIM(<text>)`**, an operator on `bonus`: a roleplay-only bonus ("toward someone who shares
  your Culture", "when trading", "noticing hidden clauses") is a decision only the player can make,
  so it is a checkbox in the roll dialog, and (Mike: "both") a pin on the Talent row that arms it for
  the next roll or Threshold read. The judgement sits at the edge, as the Aid offer's does.
- **`MARKED`** with the **`mark`** kind (Oathbound): naming one creature is an act (the `use` hook
  point, the third, triggered); the bonus against it is a `bonus` line, so the engine learned the
  roll's other party (`other`) and the attack flow reads a defender-dependent rule per pairing.
- **`reroll`** with **`IF(Outcome=...)`** (Quick Tongue): acts after the die, so the fourth hook
  point, `card`, asks the kinds what to offer on a posted card; the press pays and rerolls.
- **`AGAINST(<Constellation>)`** (Iron Etiquette): a Defense read by a named check; it needed the
  check-against-a-target's-Threshold path, which the system had not had (ruling 179).
- **`Speed`** as a `bonus` scope and **`ignore: Terrain`** (Riverfoot): Mike's direction was to
  build difficult terrain into the maps, so the kind has no hook point; the Difficult terrain region
  behavior asks it at Foundry's own moment.

Deliberately not done: a cost for a Talent whose name carries no glyph (the sheet's data), the
survey, adversaries' rolls, and anything a Culture Talent's Effect says that no line above reads.

## 0.16.0: the grammar in Fantasy Grounds' shape (2026-11-05)

Mike, after the 0.15.0 push: "I REALLY, REALLY like the FantasyGrounds effects automation ... can
we use syntax substantially similar to this, instead of syntax we are currently using?", and with
it: the Human's trait, Size, Speed and Vigor and the Cultures' languages should be Automation
rather than columns the converter parses; Steady the Line's prevention belongs on the Maneuver in
`maneuvers.xlsx`, the Talent only adding it; and FG's Character Effects field. His decisions by
question: both FG layers in FG's shape; the chassis facts as feature lines with the index columns
retired; Talent Maneuvers as rows I add, with a marker in the Effect that reproduces the Maneuver's
text; Stubborn Footing and Close Ranks unchanged, plus the Character Effects panel.

The design in one line: **the surface syntax changed, the stored rules and the four hook points did
not.** `features.mjs` reads `[KEYWORD data]` blocks into the feature kinds (`trait`, `size`,
`speed`, `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`, and `grant`/`aura` from
their blocks); `effects.mjs` reads `TAG: value type, descriptors; IF: ...; IFT: ...; FOR: ...;
LIMIT: ...` into the same `ops` record the 0.13.0 reader filled, so `bonus`, `prevent`, `mark`,
`reroll` and `ignore` keep their shapes and their hooks. The 0.13.0 form reads one more release,
flagged `legacy`, since a cell may still carry it. The pipeline gained `assets/parse_rules.mjs`,
one parse of every cell that writes `rules` into the JSON, carries the Root's chassis blocks into
the roster records and expands `@Maneuver[Name]`, so the web app and the docx read structured data
without Python holding a grammar (ruling 120 kept). A Talent Maneuver is an owned action Item
copied from the pack when the Talent lands (`SwItem.grantManeuvers`), flagged with its Talent,
listed under "From your Talents", gone with the Talent; a Trained Root (`[Acrobatics trained]`) is
the Background slot the wizard always had, directed by `grant.constellation`. Character Effects:
the Overview panel with On / Skip / Off per line and custom lines in the grammar on the actor.

Deliberately not done: Rally ❶ and Battle Cry ⓿↺ rows (their Constellations are not enabled);
durations in rounds on a custom effect; dice values on a modifier; adversaries' rolls; the
`weapons.xlsx` Melee sheet's retired Choice column (Weapon Familiarity's "Weapon Group or Technical
Weapon"), warned and read, Mike's to move into a `[CHOICE ...]` block when he next edits it.
