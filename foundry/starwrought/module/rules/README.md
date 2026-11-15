# The automation framework (system 0.9.0; the first kind, `bonus`, 0.10.0; Fantasy Grounds' shape, 0.16.0; every line in brackets, 0.17.0; the `substitute` kind, 0.21.0; the `give` and `alter` kinds, 0.22.0)

**0.22.0 (2026-11-14).** The eighteenth and nineteenth kinds, `give` and `alter`, and the sixth
hook point, `gives` (rulings 223 to 230). Mike asked whether the grammar could say two Human
Talents that change Aid (Patient Assistance, Sure Assistance); it could not, because Aid's own
result was prose on the card. So a Maneuver's row now says what each degree of its check GIVES
another character (`[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]`, `kinds/give.mjs`), a
Talent changes one property of that (`[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]`,
`kinds/alter.mjs`), and `ruleGives` in `engine.mjs` turns both into the results by degree, which
the check writes into its card's flags. The table, the pending result and its window are plain
data in `given.mjs`. Giving is a triggered moment with its three answers
(`module/documents/cards/give.mjs`); the pending result is a one-roll carrier the `give` kind
answers `modifiers` for; its window is settled on the turn change
(`effects-state.mjs`, `settleGivenResults`). The hook point's section is under "Hook points" below.

**0.21.0 (2026-11-10).** The seventeenth kind, `substitute`, and the fifth hook point,
`substitutions` (rulings 215 to 222). `[EFFECT USE: Presence, Origin, aid]`, the line of Cooperative
Instinct on the Human sheet Mike is still writing, offers to make a check with another Attribute and
another Constellation's Proficiency Bonus when the roll is made from the named Maneuver's own Item.
The kind is `kinds/substitute.mjs` and the dispatcher `ruleSubstitutions` in `engine.mjs`; the check
engine prices the swaps and chooses (`assemble` in `module/dice/check/modifiers.mjs`, its pure half
in `module/dice/check/substitute.mjs`). The hook point's section is under "Hook points" below.

**0.16.0 and 0.17.0 (2026-11-05).** The grammar has two layers in the shape of Fantasy Grounds' PF2
automation, at Mike's direction, and since 0.17.0 every line of a cell is blocks in square brackets
(Mike: "shouldn't ALL of those be enclosed in Brackets?"): feature blocks (what owning the Talent
does to the character: `[TRAIT Human][SPEED 6]`, `[Acrobatics trained]`, `[MANEUVER Steady the
Line]`) and effect blocks, FG's own wrapper, `[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >=
trained)]`. `grammar.mjs` splits the blocks (`features.mjs`) and hands an `EFFECT` block's inside
to the effect reader (`effects.mjs`), whose tag names the kind; an `AURA` block may carry its
effect after a semicolon (0.18.0), the ring parsed first and the rest read as an effect whose FOR
is the ring; a bare effect line in a cell is refused since 0.18.0 (it is the custom effects field's
own form, `itemType: "effect"`), and the 0.13.0 operator form is refused with `LEGACY_REFUSAL`. The kinds keep
their ids and stored shapes, so every hook reads what it always read. `parseAutomation` returns
`{ rules, errors, warnings }`; a kind warns through `context.warn(message)`. `AUTOMATION_GRAMMAR.md`
is the reference, and the build turns it into the Automation Grammar journal of the Rules pack.

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
| `features.mjs` | The bracketed line (0.16.0; AUTOMATION_GRAMMAR.md section 2): `isFeatureLine`, `readFeatureLine(text)` splitting `[KEYWORD data]` blocks and naming each block's kind (`FEATURE_KEYWORDS`; `[<Constellation> trained]` to `grant`; `[EFFECT ...]` (0.17.0) back with `effect: true` for the grammar to hand to the effect reader). Pure. |
| `effects.mjs` | The effect line (0.16.0; section 3): `effectTagOf`, `readEffectLine(text, { context })` reading `TAG: value type, descriptors` and the components `IF:`, `IFT:`, `FOR:`, `LIMIT:` with their conditions (`RANK`, `SEEN`, `ALLIES`, `CLAIM`, `RESULT`, `TRAIT`, `MARKED`, the Threat words, `CHECK`) into the same `ops` record the 0.13.0 reader filled (`EFFECT_TAGS`, `MODIFIER_TAGS`, `COMPONENTS`, `CONDITIONS`). `EFFECT_TAGS` ends with `use: "substitute"` since 0.21.0: a tag that is not a modifier tag hands its kind descriptors alone. Pure. |
| `operators.mjs` | The shared vocabularies and readings (the 0.13.0 reader `readLine` is gone with the form, 0.17.0): `emptyOps`, `splitOperands`, `readRank`, `readRange`, `readWho`, `readDegree`, `readIf`, `readFor`, `readWhile`, `readAgainst`, `splitComparison`; `readTargetName(written, resolve)` (0.21.0), the one reading of a target's name that `bonus`, `reroll` and `substitute` share (through 0.20.1 `bonus` and `reroll` each kept a copy): with the caller's resolver the canonical name, the slug and the type, the resolver's own record under `found` (its `group` and `parent` a kind's to read, never to store), or null when the resolver knows nothing by the name; without one the name as written, the slug made here (a Maneuver's glyphs never reach it) and a null type; the refusals stay each kind's own; `refuseComponents` and `refuseOutcome` for a kind's refusals; and for the hooks `rankMeets`, `whoMatches`, `compare`, `hasTrait`, `traitKey`, `againstHolds`, `markedHolds`, `needsMoment`, `summarizeOperators`. `OPERATORS` stays for the document gate on section 9. Pure. |
| `scene.mjs` | The one Foundry-aware file here (0.13.0): `sceneContextFor(actor, token?)` (the tokens on the scene with `relation`, `gap` and, since 0.14.0, `sees`, line of sight by `canSeeToken`), `encounterContext()`, `threatContext(maneuver)` (the Threat, its reach and the attack's `traits`), `writeRuleMarks(actor, marks)` (written here when this client may, else relayed as `rules:marks` over the system socket to the GM's client or an active owner's; `onRulesSocket` serves it, 0.18.1). The callers put what it builds on the roll context; the engine and the kinds read it and never import this file. |
| `kinds/index.mjs` | The registry: `KINDS`, `registerKind`, `kindOf`, `knownKinds`, `KIND_WORD`. Registers the nineteen kinds. |
| `kinds/bonus.mjs` | The `bonus` kind: a typed bonus or penalty to a Constellation's or a Maneuver's roll, or to a scope of rolls (Defenses, Checks, Attacks, Initiative, Speed), made by the tags `CHECK`, `ATK`, `DEF`, `INIT`, `SPEED` in an `[EFFECT ...]` block. |
| `kinds/grant.mjs` | The `grant` kind (0.13.0): Talent Points at creation, `[POINT ...]` and `[<Constellation> trained]` (0.16.0, a directed point carrying `constellation`); `toGrantField` is the wizard's field. No hook. |
| `kinds/aura.mjs` | The `aura` kind (0.13.0): the ring on the map, `[AURA ...]`; `toAuraField` is `system.aura`. No hook. |
| `kinds/features.mjs` | The feature kinds (0.16.0): `trait`, `size`, `speed`, `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`, each read from its block; no hooks. The build and the pipeline step carry the chassis facts, the wizard the choice and the free Talent, `SwItem.grantManeuvers` the Maneuver, and the character's `_prepareRules` the Talents' additions (`system.features`). |
| `kinds/prevent.mjs` | The `prevent` kind (0.13.0): a Condition or an Expose does not land; the `prevent` hook. |
| `kinds/mark.mjs` | The `mark` kind (0.15.0): using the Talent names one creature; the `use` hook. Read back by `MARKED` (`markedHolds` in operators.mjs). |
| `kinds/reroll.mjs` | The `reroll` kind (0.15.0): a button on the matching check card throws the die again; the `card` hook. |
| `kinds/ignore.mjs` | The `ignore` kind (0.15.0): difficult terrain of named kinds costs nothing; no hook point. `ignoresTerrain(actor, kind)` is asked by the Difficult terrain region behavior (data/region-behaviors/difficult-terrain.mjs). |
| `kinds/substitute.mjs` | The `substitute` kind (0.21.0): a check made with another Attribute and another Constellation's Proficiency Bonus, by the tag `USE` (`[EFFECT USE: <Attribute>, <Constellation>, <Maneuver>]`, exactly three descriptors, `same` keeping a term); the `substitutions` hook. |
| `kinds/give.mjs` | The `give` kind (0.22.0): what a degree of a Maneuver's check gives another character, by the tag `GIVE` on the Maneuver's own row (`[EFFECT GIVE: <value> <type>, chosen \| <Constellation>; IF: RESULT(<degree>); UNTIL: <window>]`). Two hooks: `gives` (the Maneuver's lines, as `{ line }`) and `modifiers` (a result pending on its recipient, on the next roll with its Constellation). |
| `kinds/alter.mjs` | The `alter` kind (0.22.0): a Talent's change to one property of what a Maneuver gives, by the tag `ALTER` (`[EFFECT ALTER: <Maneuver>.<property>; VALUE: <value>]`; six properties read, any other refused as not read yet). The `gives` hook, answering `{ alteration }`. |
| `given.mjs` | The pure half of both (0.22.0): `buildTable(lines, alterations)` (the results by degree), `alterationTouches`, `pendingEntry` (what the recipient holds), `pendingRule` and `givenCarrier` (the one-roll carrier the engine indexes it through), `settle(entry, { combat, ended, began })` (what a turn change does to its window), `appliesNow`, and the words (`resultWords`, `windowWords`, `pendingWindowWords`). Imports `operators.mjs` alone. |
| `claims.mjs` | The arm pin for `CLAIM` (0.15.0): `claimsOf`, `isArmed`, `armClaim`. The sheet's; the roll reads the flag through the `bonus` hook. |
| `effects-state.mjs` | The writes behind the Effects tab (0.16.0): a line's state, the custom effect rows, the marks `writeRuleMarks` hands it. Since 0.22.0 also the pending results: `writeGiven`, `removeGiven` (the GM's), `settleGivenResults(combat, { ended, began })` on the turn change, the clearing of a deleted Combat's results, and the `per: "effect"` mark that removes a result a roll used. Foundry globals only inside functions. |
| `prevent.mjs` | The Foundry side of the `prevent` hook point: `preventersFor` (a read, writing nothing; its `marks` are the Skips the reading would spend), `spendSkips`, `conditionPrevented`, `exposePreventers`, `sayPrevented`. |
| `kinds/<kind>.mjs` | One file per kind, each exporting the definition below. |
| `engine.mjs` | `collectRules(actor)` and `rulesOfKind(actor, kind)`: the index the Actor keeps so a hook never walks the Items. `ruleModifiers(actor, context)`: the `modifiers` hook point's dispatcher, which since 0.13.0 also hands a kind the other tokens' rules whose `FOR` reaches the actor and lifts the `FIRST`/`ONCE` marks for the caller to write. `ruleSubstitutions(actor, context)` (0.21.0): the `substitutions` hook point's dispatcher, over the roller's own rules alone, answering `{ candidates, marks }`. `ruleGives(actor, context)` (0.22.0): the `gives` hook point's dispatcher, over the rules on the Item behind the roll and the roller's own, answering `{ table, notes, marks }`. `givenResults(actor)`: the results pending on an actor, which `collectRules` indexes as carriers. |
| `../dice/check/substitute.mjs` | Outside this folder (`module/dice/check/`): the pure half of the `substitutions` hook point's caller (0.21.0). `swapTerms` (the two terms a swap rolls), `substitutionRecord` (what the card's flags keep of it), `chooseVariant` (which variant of the roll stands) and `mergeMarks` (the roll's marks, each once). It imports nothing, so the self-test checks it from Node; `modifiers.mjs` beside it, which reads the actor and localizes labels, cannot be imported there. |

Every one of them stays free of Foundry globals at module scope, because `assets/build_foundry.mjs`
and `assets/test_rules.mjs` import them from plain Node. The build and the client parse a cell with
the same function (ruling 120); the converter, `assets/xlsx_to_trees.py`, copies the cell's text
through as `automation` and knows no grammar, so Python and JavaScript never hold two parsers.

## The grammar

**The reference for the person typing in the cell is `AUTOMATION_GRAMMAR.md` in the project
root** (0.13.0), kept current with every change to a kind, an operator or a vocabulary in the
same commit; `build_all.mjs` fails when a registered kind has no section there or an operator in
`operators.mjs` is not in its table. This file is the engineering side: how the modules fit.

A line is blocks in square brackets (0.17.0). A feature block is `[KEYWORD data]`, its keyword
naming the kind that reads the data; an effect block is `[EFFECT <tag>: <value> <type>,
<descriptor>; <component>; ...]`, its tag naming the kind.

```
# a line beginning with # is a comment; a blank line is nothing
[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]
[EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]
```

A keyword or tag nobody answers to is an error naming the tags and the keywords. A kind's `parse`
receives `context.form` (`"feature"` with `context.block`, or `"effect"` with `context.effect`, the
reader's `{ tag, value, type, descriptors, ops }`) and refuses the other form by name. A bare effect
line in a cell (no `[EFFECT ...]`) reads one more release flagged `bare: true` with a warning in the
parse's `warnings`; with `itemType: "effect"` (a custom effect row) the bare line is the form. The
0.13.0 operator form and the 0.10.0 prose form are refused. At build time any error **fails
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

## The `bonus` kind (0.10.0; rulings 121 to 124; the operator grammar since 0.13.0, ruling 164)

Mike's ask, for Humanity, the Root of the Human Ancestry: "You gain a +1 Condition bonus on checks
to Aid. If you are Expert in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you
are Legendary, +4." His sketch, "IF (Constellation Proficiency = VALUE) ... Grant [X Value]; [Y
type]; [Z Check (Constellation or Maneuver Roll)]", first made concrete as prose (0.10.0), then,
on his second-draft direction ("logical operands like IF(Origin=Trained) and grammatical shortcuts
like Bonus: +1, Condition, Aid"), as the operator grammar:

```
bonus: <±N>, <Type>, <Target> [, operators]

bonus: +1, Condition, Aid, IF(Origin=Trained)                                              Humanity
bonus: +1, Situation, Checks, IF(Rank=Untrained)                                           Jack of Trades
bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)   Close Ranks
bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)                            Torchbearer Human
bonus: -2, Situation, Stealth
```

The arguments and the operators are AUTOMATION_GRAMMAR.md's; the stored rule:

```js
{ kind: "bonus", line, text,
  value: 1, type: "condition",
  to:   { name: "Aid", slug: "aid", type: "action" },    // "constellation" | "action" | "scope" | null
  when: [{ constellation: "origin", name: "Origin", op: "=", rank: "trained" }] | null,   // or { roll: true, op, rank }
  for: { who, range } | null, while: { who, op, count, range } | null,
  against: { threat, reach } | null, limit: { per: "round" | "encounter" } | null }
```

A scope target (`Defenses`, `Checks`, `Attacks`, `Initiative`) is `type: "scope"` with the word's
slug; a Constellation's or a Maneuver's `type` comes from `context.resolve` as before, null with no
resolver. A 0.10.0 rule stored on an owned copy (`when` as one object, no `op`) still reads as
equality, so a copy a GM did not refresh keeps working.

The summary: `+1 Condition bonus to Aid, while Origin is Trained`; `penalty` when negative; the
operators after a comma in words (`for allies within 15 ft, the first time each round`).

**The hook** (`hooks.modifiers`), for each rule that reaches the recipient: every `IF` holds for
the OWNER of the Talent (`rankMeets` over SW.RANKS' order; `Rank` reads `context.rank`, the roll's
own rank Handling included, and never fires when the caller gave none; `Trait` reads
`context.threat.traits` through `hasTrait`, the attack's traits by first word, and never fires
when no attack is known); `FOR` reaches the
recipient (no FOR or `self`: the owner's own roll only; `allies`, `enemies`, `all`: another token's
roll, by `scene.relation(ownerToken, recipientToken)` and `scene.gap` against the range;
`self+allies`: either), and `SEEN` then asks `scene.sees(recipientToken, ownerToken)` (0.14.0; a
scene without `sees` reads as unseen, so the operator is never assumed); `WHILE` counts the
scene's tokens around the owner's token within the
range; `AGAINST` needs `context.threat` and matches its Threat word or its reach; `FIRST`/`ONCE`
reads the recipient's `flags.starwrought.rules.<per>[<item>:<line>]` against `context.encounter`
and, when it applies in an encounter, puts `mark: { key, per }` on the modifier for the engine to
lift. `needsMoment(rule)` sorts the rules into the two halves the callers ask for: the sheet's
Defense pass (`staticOnly`) takes the rules that need none of the scene, the Threat or the round,
and a Defense roll or a Threshold read in the attack flow (`momentOnly`) takes the rest, so no
rule is counted twice. One static rule is answered under `momentOnly` as well (0.21.0, ruling
222): a bonus to a MANEUVER, on a check rolled with a Defense Constellation from that Maneuver's
Item, which the Defense pass could never have folded in (Humanity's +1 on an Aid made with
Awareness, lost through 0.20.1). It is matched by the Item alone: the roll's kind is `check`, the
roll carries an Item of type `action`, the rule's `to.type` is `"action"` (or null, a rule parsed
without a resolver) and its `to.slug` is the slug of that Item's plain name; an untyped target
whose slug is also the roll's own Constellation was the pass's and is left out. Nothing is offered
on that branch, and a bonus to every check and a bonus to the Defense itself stay out of it as
before; the wider question, whether a bonus to every check reaches a Defense rolled as a check
(Wind, Recovery, a Search), is untouched and is an open decision. Then the target: a scope applies
by the roll's kind; a Constellation on its slug; a Maneuver when the roll carries its Item, and is
**offered** unticked on a check made without one (ruling 122), never on an attack, a Defense or an
Initiative. The label is the carrier's plain name, with the owner's name in parentheses when it is
another token's Talent
("Torchbearer Human (Tess)"); one Talent's lines on one target share `source: rule:<item>:<target>`.

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
- An effect kind reads `context.effect` (the effect reader's `{ tag, value, type, descriptors,
  ops }`, every component already read and refused where malformed) and calls
  `refuseComponents(ops, TAG, allowed)` for the components it has no use for; a feature kind reads
  `context.block.data` as it likes. `splitArgs(text)` and `keyValues(parts)` in `syntax.mjs`
  remain for a kind with a different shape; `splitOperands` is the parenthesis-aware split.
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
are six: `modifiers` (0.10.0, calculated), `prevent` (0.13.0, triggered), `use` and `card` (0.15.0,
both triggered), `substitutions` (0.21.0, calculated) and `gives` (0.22.0, calculated; the give it
feeds is a triggered moment of its own, with its three answers in that section).

### Calculated and triggered

Two categories of hook point, told apart by whether a hook may change anything (the
automation-framework review, 2026-11-04). Every hook point declares which it is in its section
below, and a kind's hook keeps to it.

- **Calculated.** The engine asks a question and the hook answers with data: modifiers, an
  adjustment, a list of what applies. The hook writes no document, posts no card, and may be
  called on any client and any number of times with the same answer. `modifiers` is one,
  `substitutions` (0.21.0) another and `gives` (0.22.0) the third. A failure is isolated to the kind that failed: the
  dispatcher reports it once and takes nothing from that kind, and the roll or the sheet goes on
  with the rest. Stacking and ordering are the caller's, through the rule the caller already has
  (`SW.resolveModifiers` for a roll: since PHB v4.21 every bonus adds and a circumstance is counted
  once, by the modifier's `source`), never the dispatcher's.
- **Triggered.** Something happened (a Critical Hit landed, a Wound was taken, a round ended) and
  a rule asks for an operation in answer: a condition set, Vigor restored, a card posted. Every
  client sees the event, so a triggered hook point must say, when it is defined, **which one
  client executes** (the pattern the system already has: the attack coordinator and the loot
  relay run on the active GM's client, the asker read from the server's stamp), **what names the
  event** so an operation already done is recognised and not done twice (the Combat round and
  turn, the message id, the attack id), and **what a failure does** to the operation it was part
  of (abort it whole, or record the rule and go on), since a half-applied state change is worse
  than none. `prevent`, `use` and `card` are triggered, and so is the give that the `gives` point
  feeds (0.22.0), which states the three answers in its section; a kind that needs a new triggered
  moment defines it with these three answers in its section here, and not before.

A kind may speak at both: an aura is calculated while it adjusts a Defense and triggered if it
ever restores Vigor. The two are two hook points, not one with a flag.

### `prevent` (0.13.0)

Triggered. `hooks.prevent(entries, context, actor) -> Preventer[]`, dispatched by
`rulePreventers(actor, context)` in `engine.mjs`, `context` `{ effect, threat?, scene?, encounter? }`
(`effect` a condition id or `"expose"`), each answer `{ item, owner, ownerToken, reaction, mark }`.
The hook answers with data and writes nothing; the three answers a triggered point owes:

- **Which client executes.** The client that would have written the effect. For a Condition that
  is `SwActor#setCondition` on whichever client called it (the owner's for a Drop Flat's Prone at
  the reveal, the GM's for a final Legs Wound applied from a damage card) and, for a status toggled
  from the token palette or the Effects tab, the `preCreateActiveEffect` hook on the creating
  client (`starwrought.mjs`), which answers synchronously from the index and returns `false`.
  For an Expose it is the owner of the Reaction Talent, pressing the widget's button
  (`preventExposeFromCard`), or the GM for them.
- **What names the event.** The write itself: a Condition is prevented once because the write that
  would have made it happens once (a create that `setCondition` already checked carries
  `swChecked`, so the hook does not ask twice); an Expose is the card's, flagged `prevented` on the
  message so the widget draws no second button.
- **What a failure does.** `conditionPrevented` is inside a try/catch in `setCondition`: a rule that
  cannot be read lets the Condition land (the system prevents nothing it cannot read); a card or a
  mark that fails to write is logged and the prevention stands.

`module/rules/prevent.mjs` is the Foundry side: `preventersFor(actor, effect)` (automatic ones and
Reactions apart), `conditionPrevented(actor, id)` (the card and the mark), `exposePreventers(actor,
token)` for the Expose widget, `sayPrevented`. Only an automatic preventer (a Talent without ↺)
acts on a Condition write; a ↺ one would be a Reaction the owner chooses, which no Condition write
offers yet because no Talent asks for it.

### `use` (0.15.0)

Triggered. `hooks.use(entries, context, actor) -> RuleUse[]`, dispatched by `ruleUses(actor, item,
context)` in `engine.mjs` with the rules ON THE USED ITEM alone, `context` `{ item, target: {
actor, uuid, tokenUuid, name, relation } | null, encounter }`, each answer `{ item, write?, say?,
refuse? }`. Defined with the `mark` kind (ruling 176). The three answers a triggered point owes:

- **Which client executes.** The owner's, in `SwItem#use` (documents/item.mjs, `#useTalent`): it
  asks the kinds first, stops on a refusal with a notice and pays nothing, else pays the cost in
  the Talent's name in an encounter, applies the writes to the owner and posts the Talent's card
  with the kinds' lines under it. A Talent is used from its row's Use control, which the sheet shows
  for a Talent with a cost or with a rule of a use-kind (`usableByRule`).
- **What names the event.** The use itself: one press, one card, one write; a second press is a
  second use (a mark remade is the same creature named again).
- **What a failure does.** A refusal stops the whole use before anything is paid; a hook that
  throws is logged by the dispatcher and contributes nothing, so the Talent is still paid and
  posted; a write that fails is logged and the card still goes out.

### `card` (0.15.0)

Triggered. `hooks.card(entries, context, actor) -> RuleCardOffer[]`, dispatched by
`ruleCardOffers(actor, flags, extra)` in `engine.mjs`, `context` the posted card's
`flags.starwrought` (`kind`, `slug`, `degree`, `itemUuid`, `threshold`, ...) plus `encounter`, each
answer `{ item, label, action }`. Defined with the `reroll` kind (ruling 177).

- **Which client executes.** The hook only names buttons; the chat render pass
  (documents/chat.mjs) draws them on every client for the roller's owner and the GM, from the flags,
  so a reload draws the same. The presser's client acts (`rerollByRule` in
  documents/cards/reroll.mjs): it pays the cost in an encounter, throws the die, posts the new card
  and marks the first superseded when it may.
- **What names the event.** The message id: a superseded card draws no button, and the new card
  names the one it replaced.
- **What a failure does.** A hook that throws is logged and offers nothing; a press that cannot
  reroll (the Talent gone, no die on the card) is a notice and the first card stands; a press by a
  client that cannot mark the first card superseded still posts the new one and says so.

### `modifiers` (0.10.0)

Calculated. `hooks.modifiers(entries, context, actor) -> Modifier[]`, dispatched by
`ruleModifiers(actor, context)` in `engine.mjs`, which returns `{ applied, offered, marks }`. Since
0.15.0 the context also carries `other` (the roll's other party: the attacker a Defense answers or
a Threshold is read against, the defender a Strike's pairing resolves against, the roller whose
check reads a Threshold; `MARKED`), `pairingOnly` (a Strike's pairing: only the rules about the
other party) and `read` (a Threshold read with no dialog: a claim applies only when armed), and an
offer may come back `ticked` with a `mark` the dialog files when the box stays ticked. Since
0.21.0 the `rank` it carries is the rank ROLLED: the borrowed Constellation's when a substitution
stands (ruling 217; the `substitutions` point below), so a `RANK(roll ...)` on any other kind's
line reads the swap.

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
- **What it is handed.** `entries`: this kind's rules on this actor, `[{ rule, item, owner,
  ownerToken }]`, from `rulesOfKind` (never the whole index), and since 0.13.0, when the caller
  gave a `scene`, the rules of every other eligible token on it whose `rule.for.who` is not `self`
  (the operator's shape is the engine's to know; the relation and the range are the kind's to
  check), each with its `owner` and `ownerToken`. `context`: `{ kind: "check" | "attack" |
  "defense" | "initiative", slug, item, rank, threat, scene, encounter, staticOnly, momentOnly }`
  (the typedef in engine.mjs): the roll's kind, the Constellation slug supplying the Proficiency
  Bonus (`""` when none), the Item behind the roll or null, the rank the roll is made at (the
  borrowed Constellation's when a swap stands, 0.21.0, ruling 217), the Threat it
  answers or null (`{ threat, melee, traits }`, the traits the attack's for `IF(Trait=...)`), the
  scene (`{ token, tokens: [{ actor, token }], relation(a, b), gap(a, b), sees(a, b) }`
  from `scene.mjs`, a fake in a test, null when unknown), the Combat and round, and which half of
  the rules is wanted. `actor`: the recipient, whose `system.proficiency(slug).rank` and
  `flags.starwrought.rules` a kind may read.
- **What it may return.** An array of `{ label, value, type?, source?, offer?, key?, hint?,
  mark? }`. A modifier without `offer` is **applied** to the roll as the sheet's own terms are.
  One with `offer: true` is **offered** unticked in the roll dialog (the Load Strain Climb-or-Swim
  precedent, PHB v4.11, ruling R2), `key` the checkbox's name, unique per offer, `hint` its
  tooltip; `previewTotal` ignores offers, and the Defense pass does too. `mark: { key, per }` on
  an applied modifier is a FIRST or ONCE the recipient should remember: the dispatcher lifts it
  into the third list it returns, `marks`, and the caller writes them once the roll resolves
  (`writeRuleMarks` in scene.mjs: `SwCheck.roll` for the roller's own, the attack coordinator for
  a Threshold read), never from a preview. An offer carries its marks as `marks` (and the first as
  `mark`), since a ticked claim on a one-roll custom effect spends the claim and the row alike
  (0.18.1); the dialog files them with the roll. Since 0.21.0 `prompt` returns the marks of the
  boxes left ticked and `SwCheck.roll` adds them to the roll's own after any rebuild; through
  0.20.1 they were written onto the config, and a rebuild, which assembles the roll again and sets
  its marks afresh, dropped them (an armed claim was not spent, a one-roll custom effect not
  removed).
- **Who calls it with what** (0.13.0). `baseModifiers`' non-Defense branch asks for everything
  with the scene, the Threat (`cfg.threat`, set by `rollDefense` from the attack flow's Maneuver)
  and the encounter; its Defense branch and `SwActor#defenseThresholdFor` (the Combat Prompt's
  preview, the coordinator's reveal and resolution) ask `momentOnly`, since `prepareDefenses`
  folded the static rules into the Defense's own modifiers with `staticOnly`. The sheet's
  Threshold is therefore the position-blind number, and its tooltip says so. One static rule is
  still answered under `momentOnly` (0.21.0, ruling 222; the `bonus` section above): a bonus to a
  Maneuver, on a check rolled with a Defense Constellation from that Maneuver's Item.
- **What the dispatcher does.** Walks `KINDS`; skips a kind without the hook and a kind with no
  entries on this actor; calls the hook inside try/catch, a throw reported once as
  `STARWROUGHT | the "<id>" kind's modifiers hook failed:` and contributing nothing, so a roll never
  dies over a rule; drops a modifier whose `value` is not a non-zero number (a numeric string is
  read as a number); gives a keyless offer a key of its own (`<kind>-<n>`) and suffixes a key two
  offers share. Stacking is not its job: the caller's `SW.resolveModifiers` treats what comes back
  as it treats every other term (PHB v4.21: everything adds; entries sharing a `source` are one
  circumstance, counted once, which is how the `bonus` kind keeps one Talent's lines on one target
  from adding: `source: "rule:<item>:<target>"`).

### `substitutions` (0.21.0)

Calculated. `hooks.substitutions(entries, context, actor) -> [{ key, item, label, attribute,
proficiency, certain, mark? }]`, dispatched by `ruleSubstitutions(actor, context)` in `engine.mjs`,
which returns `{ candidates, marks }`. Defined with the `substitute` kind (ruling 221), the fifth
hook point and the second calculated one: "this check is about to be assembled; which of the
owner's rules would swap its base terms?" A substitution replaces the roll's two base terms, the
Attribute Bonus and the Proficiency Bonus (one of them when the line says `same`), and nothing else
(ruling 216): the roll stays a check in its own Constellation, so the Flare preselection, Load
Strain on Stealth, Constellation-targeted bonuses, rerolls and the road-roll memory are untouched.

- **When the engine calls it.** Once per assembly of a character's check, before the base terms
  are built: `assemble` in `module/dice/check/modifiers.mjs`. Checks only, characters only (ruling
  220): never a Strike, a Cast, a Defense roll, a Threshold read or an Initiative, and an adversary
  rolls flat; a check rolled with a Defense Constellation (an Aid made with Awareness) is asked
  only when a Maneuver's Item is behind it. When a candidate comes back, `assemble` builds the roll
  once with no swap and once with each candidate, every one in full, because another rule may read
  the rank the roll is made at (Jack of All Trades' +1 on an Untrained roll is lost under a Trained
  Origin), leaves the variants on `cfg.substituteVariants` for the roll dialog, and chooses with
  `chooseVariant` (`module/dice/check/substitute.mjs`): `cfg.substitute` undefined is the default
  rule, the swap whose assembled total is strictly the highest, else none (ruling 218; a tie or a
  loss leaves the check as it was, and a roll with no dialog takes the default); `null` is no swap
  (the player unticked the box); a key is that swap. One swap stands on a roll. What stands is
  written back as the roll's own: `cfg.rank` the rank rolled, `cfg.substituted` the record the card
  keeps, `cfg.attribute` the check's own Attribute throughout. Each assembly asks `ruleModifiers`
  again at that variant's rank, which a calculated point allows. A roll no rule offers a swap on
  is assembled as it was before 0.21.0.
- **What it is handed.** `entries`: this kind's rules on the roller, `[{ rule, item, owner }]`,
  from `rulesOfKind` (an Off line never arrives). OWN RULES ONLY: no other token's rules are added,
  whatever the scene, since a swap is the owner's own roll and the kind refuses `FOR`. `context`:
  `{ kind, slug, item, rank, encounter }`: the roll's kind, the check's own Constellation slug, the
  Item behind the roll or null, the Combat and round for a `LIMIT`, and `rank`, the check's OWN
  rank, before any swap, which a `RANK(roll ...)` on a `USE` line reads. Every other rule's
  `RANK(roll ...)` reads the rank rolled, through `ruleModifiers`' context (ruling 217). `actor`:
  the roller.
- **What it may return.** An array of candidates that mirror the rule: `key`, stable per rule line
  (the dialog's checkbox and the card's record name it; `use-<carrier>-<line>` from `substitute`);
  `item`, the carrier; `label`, its plain name; `attribute`, a key of `SW.ATTRIBUTES`, or null when
  the check keeps its own; `proficiency`, `{ constellation, name }`, or null likewise; `certain`,
  true when the roll is known to be the check the rule names (always, in 0.21.0: a swap is offered
  only from the Maneuver's own Item, ruling 219; an uncertain candidate is never the default); and
  `mark: { key, per }`, the rule's `LIMIT`, when an encounter is running. The hook prices nothing,
  chooses nothing and writes nothing.
- **What the dispatcher does.** Answers empty for no actor; walks `KINDS`; skips a kind without
  the hook and a kind with no rules on this actor; calls the hook inside try/catch, a throw
  reported once as `STARWROUGHT | the "<id>" kind's substitutions hook failed:` and contributing
  nothing; drops a candidate that is not an object, names no `item`, names an Attribute the system
  does not have, or swaps nothing (no Attribute and no `proficiency.constellation`); reads
  `certain` as true unless it is `false`; gives a keyless candidate a key of its own
  (`<kind>-<n>`) and suffixes a key two candidates share, so the dialog's checkboxes never collide;
  drops a mark without both its `key` and its `per`.
- **Where the marks go.** They ride on the candidate, as an offered modifier's do: each candidate
  comes back with `marks`, its own `LIMIT` mark and, on a one-roll custom effect, the row's removal
  (`per: "effect"`), and the check engine files them only for the swap the die is thrown with
  (`mergeMarks` onto the standing variant's `cfg.ruleMarks`, written by `SwCheck.roll` through
  `writeRuleMarks`), never for a candidate left unticked and never from a preview. The top-level
  `marks` is what the roll owes whichever way it goes: a Skip line that would have offered a swap
  is dropped and its state cleared (`per: "state"`); a Skip line that would not have matched is
  not spent.
- **The name.** The hook must NOT be named `use`, though the tag is `USE`: `hooks.use` is the
  triggered point above, which draws a Use control on the Talent's row (`usableByRule`) and runs
  when the Talent is used, and a substitution is never used. The self-test asserts the kind's one
  hook is `substitutions`.

### `gives` (0.22.0)

Calculated. `hooks.gives(entries, context, actor) -> [{ line } | { alteration }]`, dispatched by
`ruleGives(actor, context)` in `engine.mjs`, which returns `{ table, notes, marks }`. Defined with
the `give` kind (ruling 229), the sixth hook point and the third calculated one: "this check was
made from a Maneuver's Item; what would each degree of it give another character?" Aid's +1 to +4
for the ally and its -1 on a Critical Failure are the first answer, and two Talents that change
them (Patient Assistance, Sure Assistance) the second.

- **When the engine calls it.** Once per check a character makes from an action Item, after the
  die and before the card: `SwCheck.roll` in `module/dice/check.mjs`. Checks only, characters only,
  action Items only. The answer goes into the card's flags as `flags.starwrought.given` (`{ table,
  notes, maneuver: { slug, name }, ally: { uuid, name } | null, combat }`) when the Maneuver gives
  anything on any degree, and the marks join the roll's own. A reroll copies the first card's
  `given` across, since the table holds every degree.
- **What it is handed.** `entries`: TWO sets of the kind's rules, each entry marked with where it
  came from. `from: "item"`: the rules on the Item behind the roll, owned or not (a basic Maneuver
  is used straight from the compendium, so the roller's index does not hold them); a state applies
  only when the roller owns the Item. `from: "own"`: the roller's own rules, from `rulesOfKind` (an
  Off line never arrives). The `give` kind reads the first and the `alter` kind the second, so an
  owned copy of a Maneuver is read once. `context`: `{ kind, slug, item, maneuver, rank, degree,
  encounter }`: `maneuver` the slug of the Item's plain name, `rank` the rank ROLLED (ruling 217),
  `degree` the degree rolled or null. `actor`: the roller. The hook is asked ONCE PER ENTRY, so the
  dispatcher knows which entry said what.
- **What it may return.** `{ line: { degree, value, type, to, until } }` for a result one degree
  gives, and `{ alteration: { property, nothing?, until?, label } }` for a change to the table
  (`given.mjs`, `GiveLine` and `GiveAlteration`). `buildTable` takes the first line for a degree
  and applies each alteration to its own property: the results set to nothing first, then
  `duration`, then `beneficial-duration`, so the more particular property stands whatever the
  order of the lines, and of two changes to one property the later stands. The hook gives nothing
  and writes nothing.
- **What the dispatcher does.** Answers a null table for no actor, no Item, an Item that is not an
  action or a Maneuver with no line; walks `KINDS`; calls each hook inside try/catch, a throw
  reported once as `STARWROUGHT | the "<id>" kind's gives hook failed:` and contributing nothing;
  drops an answer that is neither a line of a known degree nor an alteration.
- **Where the marks go.** A Skip line's answer is left out of the table and its state clears; a
  one-roll custom effect's row is removed. Each ONLY when the line CHANGES what the degree rolled
  gives, which the dispatcher learns by building the table with and without that one entry
  (`sameGiven`): Sure Assistance on Skip is not spent by a Success, a Skip on a line an earlier
  line shadows is not spent at all, an alteration of a result another Talent had already emptied
  is not spent, and nothing is spent by a check made against no Threshold. The table on the card
  is whole all the same, because a reroll reads it for its own degree; so what the die did not
  spend comes back as `traces` (`{ degrees, marks }` each), the card keeps them as
  `given.unspent`, and `rerollCheck` files the marks of the ones whose degree the new die lands on.

**The give itself is triggered** (`module/documents/cards/give.mjs`), and these are its three
answers. **Who writes:** ONE client for a recipient (`writerFor`): the active GM's when one is
connected, else the client of the recipient's first active owner. The presser's own client writes
only when it is that one; otherwise it asks over the system socket, `give:apply`, answered
`give:done` or `give:refused` to the asker alone (`onChatSocket` routes `give:*`). One writer, and
one give of a card at a time on it, because the check for a give card and the writes that follow
are not one step: two presses of one card are served in turn and the second is told "already". The
executing client trusts the request for two things, who and which Constellation, reads everything
else from the check card, and takes the asker from the server's stamp, who must own the card's
roller. **The event:** the check card's message id. The give card names it
(`flags.starwrought.from`, `kind: "given"`), and a give card naming a check card means that result
was given, so the button gives way to the record on every client and after a reload, with no write
to a card only its author could update; a card that was thrown again gives nothing, by its own
`superseded` flag or by a later card that names it (`wasRerolled`). **Failure:** a give that cannot
be written writes nothing, posts nothing, tells the presser why and leaves the button.

**The pending result** is `flags.starwrought.rules.given.<maneuver>` on the recipient (`given.mjs`,
`pendingEntry`), not a row of `system.effects`: the sheet's form rewrites those rows on every
change and would drop what a row does not declare. `collectRules` indexes each as a carrier with a
one-roll duration and one resolved `give` rule, and the `give` kind's `hooks.modifiers` answers for
it on a roll whose slug is the result's, and nothing under `staticOnly` (the sheet's Defense pass),
`read` (a Threshold read), `pairingOnly` (a Strike's pairing) or `leavePending` (a total that is
itself the roll and writes nothing after: the tracker's own Initiative die and a kept road roll,
which would carry the result and leave it to be used again). The dispatcher's existing trace
asks for the carrier's removal with the roll, and `markUpdates` deletes the flag. One result of a
Maneuver per recipient: the key is the Maneuver's slug, so a new one overwrites the old.

**The window is settled with no counter.** Nothing in the system counts Opportunities, so the
count rides on the entry (`until: { who, combatant, n, begun }`). `onTurnChange` in
`module/documents/combat.mjs` calls `settleGivenResults(combat, { ended })` as an Opportunity ends
and `{ began }` as one begins, on every client, each writing the Actors it is responsible for;
`given.mjs`'s `settle` says keep, expire, or the new count. The turn step a completed circuit of
Passes takes before `nextRound()` is nobody's Opportunity: the elected client remembers it
(`roundEndSteps`) and does not report it as one that ended. A lone fighter's step to itself
(`SwCombat#nextTurn` when nobody else can take an Opportunity, the common step late in a round)
writes no Combat update, so no other client hears it: `settleLoneStep` settles this client's own
Actors and tells every other client over the socket (`rules:step`, served by `onStepSocket` after
checking the asker, the Combat and that the step was a lone one). `deleteCombat` clears every
result of that Combat. `holdersOf` finds the holders among the Combat's fighters, the tokens on
its scene (an unlinked token's Actor) and the world's Actors.

## Adding a rule kind

One at a time, with Mike (ruling 119). The first was `bonus`; the next is the aura, for
Torchbearer, and its syntax is his to settle. Each kind lands as one change with all of these in it:

1. **The file.** `kinds/<id>.mjs`, exporting the definition above. Its `parse` reads one syntax
   for every Talent that will ever use the word: the aura that serves Torchbearer must serve
   every aura in the book without a second kind, as `bonus` serves every typed bonus.
2. **The registration.** Two lines at the foot of `kinds/index.mjs`: the import and
   `registerKind(<id>)`. An effect kind is named in two lists besides (0.21.0; `substitute` showed
   both are needed and the second is easy to miss): its tag in `EFFECT_TAGS` in `effects.mjs`,
   which is what makes the tag read and names the kind that parses it, and its id in
   `EFFECT_KINDS` in `module/helpers/effects.mjs`, the kinds whose lines the Effects tab lists and
   switches On / Skip / Off and the tracker's badge counts. The self-test fails unless
   `EFFECT_KINDS` is exactly the kinds `EFFECT_TAGS` names.
3. **The test.** In `assets/test_rules.mjs`: add the id to `SHIPPED_KINDS` (the self-test asserts
   the registry holds exactly that list, so a kind cannot ship unannounced; the unknown-kind
   checks use the reserved word `not-a-real-kind`, so no real kind's name is assumed unknown
   anywhere in the file), then checks of its own: the forms its `parse` accepts, the data it returns, the message of each thing it refuses,
   its `summary`, and its hooks through the dispatcher with a fake actor (`rulesActor` in the
   `bonus` section is the model). A new effect tag also joins the two tag-list strings the
   self-test matches whole, since both messages print every tag of `EFFECT_TAGS` in order (`"FOO"
   is not an effect tag: write CHECK, ATK, ...` and `EFFECT wraps an effect line, ...`; 0.21.0 added
   `, USE` to each and 0.22.0 `, GIVE, ALTER`), and its lines join `EFFECT_LINES`, each read bare
   and in its block alike (a tag that reads on one carrier alone, as `GIVE` reads on a Maneuver's
   row, keeps its lines in its own section instead).
   `node assets/test_rules.mjs` must pass; `build_all.mjs` runs it in every mode as the step
   `test_rules`, right before `build_foundry`.
4. **The grammar document.** `AUTOMATION_GRAMMAR.md` in the project root: the kind's section under
   "4. The kinds, by their stored names" (the blocks that make it, the components it takes), its
   row in section 0's table, its block's row in section 2 or its tag's row in section 3 (its shape,
   its descriptors, its examples), any new component, condition or vocabulary in the tables of
   section 3, what it does in play in section 7, its messages in section 8, and a line in section
   10's history, in the same commit (Mike, 2026-11-05; the build fails without the section).
   `data/README.txt` points at the document and repeats no syntax.
5. **The hook.** A kind names the hook point(s) it speaks at in `hooks`, and the engine's call
   sites exist once per hook point, so a kind that wants a moment the engine already asks about
   (`modifiers`) adds no engine code: `bonus` is wired by its `hooks.modifiers` alone. A kind that
   needs a NEW moment (an aura's, in `canvas/auras.mjs` beside the Aura column's rings, say)
   defines the hook point with it and not before: its dispatcher in `engine.mjs` in the shape of
   `ruleModifiers` (walk `KINDS`, skip the silent, try/catch the hook, validate what comes back),
   its call site(s) where the effect lives, and its section under "Hook points" above (its name,
   when the engine calls it, what it is handed, what it may return), as `substitute` did with
   `substitutions` in 0.21.0. Every hook asks `rulesOfKind` for the rules in play and never walks
   `actor.items`.
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

**Not built with `substitute`** (0.21.0). A Constellation as the check a `USE` names: the parse
refuses it and the hook passes over one stored by hand, since a Constellation's own checks bring
the Initiative question of ruling 111 with the first Talent that wants them. Offers on plain
checks: a check made without the Maneuver's Item is offered nothing (ruling 219), where a `bonus`
to a Maneuver is offered unticked. `IF: UNSUBSTITUTED` as a condition. A flat Proficiency Bonus
(Working Knowledge's "+3 instead of +0"), refused by name today; it would be a new member under
the stored rule's `proficiency`, with no migration of the rules stored now. `FOR` and auras, and
`CLAIM`, all three refused by name. Aid's own outcome is read since 0.22.0.

**Not built with `give` and `alter`** (0.22.0). Two uses of one pending result (Carry the Plan) and
a second character using it (Pay It Forward): the entry is one result, used once, by its holder. A
Condition given by a result. A result given by a Maneuver that rolls no check: the `gives` point is
asked by a check. An adversary as the recipient: adversaries roll flat. The `ALTER` properties
beyond the six (a Maneuver's movement, range, limit, uses, slots): each is refused as not read yet
and comes with the Talent that wants it, as a new member of `given.mjs`'s property tables and a
new clause of `buildTable`, or as another hook point's reading altogether. A Threshold a
Maneuver's check opens on (Aid's "typically 15"). Known limits: with no GM connected a player's
client cannot know a circuit of Passes completed and counts the step as an Opportunity, and two
presses of one card for recipients owned by different players are served by two clients; a GM
stepping the turn back and forward counts an Opportunity twice, so a window of two or more can
close one early; the tracker's own Initiative die does not read a pending result (it still
carries, and never removes, a one-roll custom effect, as before).
