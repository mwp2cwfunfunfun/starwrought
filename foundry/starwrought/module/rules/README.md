# The automation framework (system 0.9.0; the first kind, `bonus`, 0.10.0; Fantasy Grounds' shape, 0.16.0; every line in brackets, 0.17.0)

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
| `effects.mjs` | The effect line (0.16.0; section 3): `effectTagOf`, `readEffectLine(text, { context })` reading `TAG: value type, descriptors` and the components `IF:`, `IFT:`, `FOR:`, `LIMIT:` with their conditions (`RANK`, `SEEN`, `ALLIES`, `CLAIM`, `RESULT`, `TRAIT`, `MARKED`, the Threat words, `CHECK`) into the same `ops` record the 0.13.0 reader filled (`EFFECT_TAGS`, `MODIFIER_TAGS`, `COMPONENTS`, `CONDITIONS`). Pure. |
| `operators.mjs` | The shared vocabularies and readings (the 0.13.0 reader `readLine` is gone with the form, 0.17.0): `emptyOps`, `splitOperands`, `readRank`, `readRange`, `readWho`, `readDegree`, `readIf`, `readFor`, `readWhile`, `readAgainst`, `splitComparison`; `refuseComponents` and `refuseOutcome` for a kind's refusals; and for the hooks `rankMeets`, `whoMatches`, `compare`, `hasTrait`, `traitKey`, `againstHolds`, `markedHolds`, `needsMoment`, `summarizeOperators`. `OPERATORS` stays for the document gate on section 9. Pure. |
| `scene.mjs` | The one Foundry-aware file here (0.13.0): `sceneContextFor(actor, token?)` (the tokens on the scene with `relation`, `gap` and, since 0.14.0, `sees`, line of sight by `canSeeToken`), `encounterContext()`, `threatContext(maneuver)` (the Threat, its reach and the attack's `traits`), `writeRuleMarks(actor, marks)`. The callers put what it builds on the roll context; the engine and the kinds read it and never import this file. |
| `kinds/index.mjs` | The registry: `KINDS`, `registerKind`, `kindOf`, `knownKinds`, `KIND_WORD`. Registers the sixteen kinds. |
| `kinds/bonus.mjs` | The `bonus` kind: a typed bonus or penalty to a Constellation's or a Maneuver's roll, or to a scope of rolls (Defenses, Checks, Attacks, Initiative, Speed), made by the tags `CHECK`, `ATK`, `DEF`, `INIT`, `SPEED` in an `[EFFECT ...]` block. |
| `kinds/grant.mjs` | The `grant` kind (0.13.0): Talent Points at creation, `[POINT ...]` and `[<Constellation> trained]` (0.16.0, a directed point carrying `constellation`); `toGrantField` is the wizard's field. No hook. |
| `kinds/aura.mjs` | The `aura` kind (0.13.0): the ring on the map, `[AURA ...]`; `toAuraField` is `system.aura`. No hook. |
| `kinds/features.mjs` | The feature kinds (0.16.0): `trait`, `size`, `speed`, `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`, each read from its block; no hooks. The build and the pipeline step carry the chassis facts, the wizard the choice and the free Talent, `SwItem.grantManeuvers` the Maneuver, and the character's `_prepareRules` the Talents' additions (`system.features`). |
| `kinds/prevent.mjs` | The `prevent` kind (0.13.0): a Condition or an Expose does not land; the `prevent` hook. |
| `kinds/mark.mjs` | The `mark` kind (0.15.0): using the Talent names one creature; the `use` hook. Read back by `MARKED` (`markedHolds` in operators.mjs). |
| `kinds/reroll.mjs` | The `reroll` kind (0.15.0): a button on the matching check card throws the die again; the `card` hook. |
| `kinds/ignore.mjs` | The `ignore` kind (0.15.0): difficult terrain of named kinds costs nothing; no hook point. `ignoresTerrain(actor, kind)` is asked by the Difficult terrain region behavior (data/region-behaviors/difficult-terrain.mjs). |
| `claims.mjs` | The arm pin for `CLAIM` (0.15.0): `claimsOf`, `isArmed`, `armClaim`. The sheet's; the roll reads the flag through the `bonus` hook. |
| `prevent.mjs` | The Foundry side of the `prevent` hook point: `preventersFor`, `conditionPrevented`, `exposePreventers`, `sayPrevented`. |
| `kinds/<kind>.mjs` | One file per kind, each exporting the definition below. |
| `engine.mjs` | `collectRules(actor)` and `rulesOfKind(actor, kind)`: the index the Actor keeps so a hook never walks the Items. `ruleModifiers(actor, context)`: the `modifiers` hook point's dispatcher, which since 0.13.0 also hands a kind the other tokens' rules whose `FOR` reaches the actor and lifts the `FIRST`/`ONCE` marks for the caller to write. |

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
rule is counted twice. Then the target: a scope applies by the roll's kind; a Constellation on its
slug; a Maneuver when the roll carries its Item, and is **offered** unticked on a check made
without one (ruling 122), never on an attack, a Defense or an Initiative. The label is the
carrier's plain name, with the owner's name in parentheses when it is another token's Talent
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
are four: `modifiers` (0.10.0, calculated), `prevent` (0.13.0, triggered), `use` and `card` (0.15.0,
both triggered).

### Calculated and triggered

Two categories of hook point, told apart by whether a hook may change anything (the
automation-framework review, 2026-11-04). Every hook point declares which it is in its section
below, and a kind's hook keeps to it.

- **Calculated.** The engine asks a question and the hook answers with data: modifiers, an
  adjustment, a list of what applies. The hook writes no document, posts no card, and may be
  called on any client and any number of times with the same answer. `modifiers` is one. A
  failure is isolated to the kind that failed: the dispatcher reports it once and takes nothing
  from that kind, and the roll or the sheet goes on with the rest. Stacking and ordering are the
  caller's, through the rule the caller already has (`SW.resolveModifiers` for a roll: since PHB
  v4.21 every bonus adds and a circumstance is counted once, by the modifier's `source`), never
  the dispatcher's.
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
offer may come back `ticked` with a `mark` the dialog files when the box stays ticked.

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
  Bonus (`""` when none), the Item behind the roll or null, the roll's own rank, the Threat it
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
  a Threshold read), never from a preview.
- **Who calls it with what** (0.13.0). `baseModifiers`' non-Defense branch asks for everything
  with the scene, the Threat (`cfg.threat`, set by `rollDefense` from the attack flow's Maneuver)
  and the encounter; its Defense branch and `SwActor#defenseThresholdFor` (the Combat Prompt's
  preview, the coordinator's reveal and resolution) ask `momentOnly`, since `prepareDefenses`
  folded the static rules into the Defense's own modifiers with `staticOnly`. The sheet's
  Threshold is therefore the position-blind number, and its tooltip says so.
- **What the dispatcher does.** Walks `KINDS`; skips a kind without the hook and a kind with no
  entries on this actor; calls the hook inside try/catch, a throw reported once as
  `STARWROUGHT | the "<id>" kind's modifiers hook failed:` and contributing nothing, so a roll never
  dies over a rule; drops a modifier whose `value` is not a non-zero number (a numeric string is
  read as a number); gives a keyless offer a key of its own (`<kind>-<n>`) and suffixes a key two
  offers share. Stacking is not its job: the caller's `SW.resolveModifiers` treats what comes back
  as it treats every other term (PHB v4.21: everything adds; entries sharing a `source` are one
  circumstance, counted once, which is how the `bonus` kind keeps one Talent's lines on one target
  from adding: `source: "rule:<item>:<target>"`).

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
4. **The grammar document.** `AUTOMATION_GRAMMAR.md` in the project root: the kind's section under
   "3. The kinds" (its shape, its arguments table, its examples, the operators it takes), any new
   operator in the table of section 4, any new vocabulary, its messages in section 7, and a line
   in section 8's history, in the same commit (Mike, 2026-11-05; the build fails without the
   section). `data/README.txt` points at the document and repeats no syntax.
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
