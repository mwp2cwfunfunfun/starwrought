# STARWROUGHT Automation: the grammar

This is the reference for the **Automation** column of the data workbooks (`data/*.xlsx`), written
for the person typing in the cell. The Foundry system reads the cell with one parser
(`foundry/starwrought/module/rules/`) at build time and in play, so what is written here is what
the system does. Every change to a rule kind, a tag, a keyword or a vocabulary updates this document
in the same commit (CLAUDE.md, standing rule, 2026-11-05), and the build fails when a kind the
system knows is not named here.

Since 0.16.0 the grammar has the shape of Fantasy Grounds' Pathfinder 2 effects, which Mike asked
for by name (2026-11-05: "I REALLY, REALLY like the FantasyGrounds effects automation ... can we use
syntax substantially similar to this"). FG has two layers, and so do we:

- **Feature lines**, in square brackets: what owning the Talent does to the character.
  `[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]`, `[Acrobatics trained]`, `[MANEUVER Steady the Line]`.
- **Effect lines**: what the Talent does to a roll, a tag then components separated by semicolons.
  `CHECK: 1 condition, aid; IF: RANK(Origin >= trained)`, `IMMUNE: prone; LIMIT: encounter`.

```
[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
CHECK: 1 condition, aid; IF: RANK(Origin >= trained)
DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)
[MANEUVER Oathbound]
```

## 1. The cell

- One line is one feature line or one effect line. A cell may hold any number of lines.
- A blank line is nothing. A line beginning with `#` is a comment.
- Case does not matter anywhere: `check: 1 Condition, Aid`, `[trait human]` and `IF: rank(ORIGIN >= Trained)` all read.
- Spaces are free around commas, colons and semicolons. One trailing period is tolerated.
- Names are the book's: Constellations (`Guard`, `Stealth`, `Elementalism`), Maneuvers (`Aid`, `Steady the Line`),
  Conditions (`prone`), Threats (`BLOW`), ranks (`trained`). A Maneuver's cost glyphs are ignored
  (`Aid` and `Aid ❶` are one name). The slug form (`armored-fighting`) reads too.
- Feet are a number with `ft` attached or not: `15`, `15ft`, `15 ft`. `0` means adjacent.

A line the parser cannot read **fails the build** (`sync_content.cmd`, `node assets/build_all.mjs`)
with the Constellation, the Talent, the line number and what is wrong, before anything is written
to the pack sources. In an open world, a GM who edits a Talent's Automation textarea and gets a
line wrong sees it in red on the Item sheet's Automation panel and the engine skips that line;
nothing is ever thrown at the table over a cell.

**The 0.13.0 form still reads, for one release.** A line in the old shape (`bonus: +1, Condition,
Aid, IF(Origin=Trained)`, `grant: 1, Calling`, `aura: 15ft, allies, VISIBLE`, `prevent: Prone,
ONCE(encounter)`, or a `mark:`, `reroll:` or `ignore:` line carrying `IF(...)`-style operators) is
read as it was and the build WARNS once per cell, naming the line to rewrite; 0.17.0 refuses it.
The 0.10.0 prose form (`bonus: +1 Condition to Aid if Human is Expert`) stays refused. Section 9
has the old operators for reading an old cell.

## 2. Feature lines: what owning the Talent does

A feature line is one or more **blocks** in square brackets, `[KEYWORD data]`, any number on a line.
Each block is one rule.

| block | means | stored kind |
|---|---|---|
| `[TRAIT Human]` | the character has the trait (the Ancestry's on its Root; any Talent may add one) | `trait` |
| `[SIZE Medium]` | the body's Size: Tiny, Small, Medium, Large, Huge, Gargantuan | `size` |
| `[SPEED 6]` | Speed in feet per Move; `[SPEED +1]` or `[SPEED -1]` adjusts it | `speed` |
| `[VIGOR 8]` | Vigor per level (the Ancestry's); `[VIGOR opening 12]` a Calling's Opening Vigor | `vigor` |
| `[SENSES Low-light vision]` | a sense, added to the list | `sense` |
| `[LANGUAGE Common, Serrovine]` | languages known, comma separated | `language` |
| `[Acrobatics trained]` | a Trained Root in that Constellation at creation, FG's own form for a proficiency: one directed Talent Point that buys the Root (a Background's, a Calling's). `[Lore trained]` lets the player name the Lore. Only `trained` reads: nothing grants a higher rank at creation | `grant` |
| `[POINT Skill]` | a Talent Point at creation, by scope: `Opening` (a Root of a Constellation not yet opened), `Calling`, `Skill` (a Lore included), `Lore`, `Defense`, `Combat Style`, `Comet` (anywhere you qualify); `[POINT 2 Skill different]` is two points in different Constellations | `grant` |
| `[MANEUVER Steady the Line]` | the Maneuver of that name, a row of `data/maneuvers.xlsx`, is the character's: copied onto the sheet when the Talent lands, listed under "From your Talents", used from there, gone with the Talent. The row's own Cost and Automation are the Maneuver's | `maneuver` |
| `[TALENT Weapon Familiarity]` | a Talent handed over free, no point spent (the Free Talent column's successor) | `talent` |
| `[CHOICE Weapon Group]` | a build-time pick the Talent demands (the Choice column's successor) | `choice` |
| `[AURA 15 allies visible]` | the ring on the map: range in feet, whom it is about (`allies`, `enemies`, `all`), `visible` to pin it by default once an encounter starts | `aura` |

**The chassis is written on the Root.** The Human's `[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]`
and the Serrovanian's `[LANGUAGE Common, Serrovine]` are the authoring of the Ancestry's and the
Culture's facts since 0.16.0; the `_Tree Index` columns Vigor, Size, Speed, Senses, Traits and
Languages, the Callings' Skills column and the roster's Opening Vigor column are retired, read one
release with a warning, and a disagreement between a column and the Root's block fails the build.
The pipeline (`assets/parse_rules.mjs`) carries the Root's blocks into the roster records the web
app, the compendium docx and the Foundry build read, so every consumer sees one source.

**`@Maneuver[Name]` in an Effect cell.** A Talent that grants a Maneuver need not repeat the
Maneuver's text: `@Maneuver[Oathbound]` in its Effect is replaced, wherever the Effect prints (the
web app, the docx, the Talent Item, the wizard's card), by the Maneuver's block: its name and cost,
Trigger, Requirements and Effect from the row. A name that is no row fails the build.

## 3. Effect lines: what the Talent does to a roll

```
TAG: <value> <type>, <descriptor>; <component>; <component> ...
```

The **tag** names what is modified. A **modifier tag** takes a signed whole number and a bonus type
(`situation`, `condition` or `gear`, the book's three; FG's `[bonus]`), then at most one descriptor
after a comma. The other tags take descriptors alone. No bonus is untyped.

| tag | modifies | descriptor | stored kind |
|---|---|---|---|
| `CHECK: 2 condition, diplomacy` | checks of a Constellation or made from a Maneuver (`CHECK: 1 condition, aid`); with no descriptor every check (an Initiative rolled with a Constellation is a check in it, ruling 111) | a Constellation or a Maneuver by name; a Lore is refused | `bonus` |
| `ATK: 1 condition` | every Strike and Cast | none | `bonus` |
| `DEF: 1 situation, guard` | a Defense's roll and Threshold; with no descriptor all four | `evade`, `guard`, `endure`, `awareness` | `bonus` |
| `INIT: 1 situation` | Initiative | none | `bonus` |
| `SPEED: 1 situation` | feet on a Move (not a Step, a Rush or a Leap) | none | `bonus` |
| `IMMUNE: prone` | the Condition does not land; `IMMUNE: expose` a Zone a Stop would Expose stays closed (FG's own `IMMUNE: [condition]`) | a Condition by name, or `expose` | `prevent` |
| `MARK: enemies` | using the Talent or Maneuver names one creature, the player's target, until the encounter ends; `enemies` or `all` | who may be named | `mark` |
| `REROLL: diplomacy` | the card of a matching roll offers to throw the die again; no descriptor means any check | a Constellation | `reroll` |
| `IGNORE: terrain, mud, decking` | difficult terrain of those kinds costs nothing; `IGNORE: terrain` alone every kind | `terrain`, then kinds | `ignore` |

A bonus to a Constellation moves its **Threshold as well as its roll** (section 7). A bonus to a
Maneuver is applied when the roll is made from that Maneuver's Item and otherwise **offered**
unticked in the roll dialog ("Humanity: Aid"; ruling 122).

**Components** follow the tag, each after a semicolon:

| component | means |
|---|---|
| `IF: <condition>` | about the owner, or the roll itself |
| `IFT: <condition>` | about the other party: the attacker you answer, the defender your Strike meets, the attack itself |
| `FOR: allies 15` | who receives it: `self` (the default), `allies`, `enemies`, `all`, `self+allies`, within that range of the owner; `FOR: self` takes no range |
| `LIMIT: round` | the first time it would apply to each recipient in a round, and not again until the next round |
| `LIMIT: encounter` | the first time in an encounter, and not again until the next. Outside an encounter either applies every time, said on the card |

Both `IF:` and `IFT:` accept every condition (FG's own users mix them); the idiomatic prefix is the
one in the table. Several `IF:`/`IFT:` components on one line must all hold.

| condition | means | idiom |
|---|---|---|
| `RANK(Origin >= trained)` | the owner's rank in that Constellation: `=`, `>=` or `<=`; `Origin` is the pooled Ancestry, Bloodline and Culture rank; a group (a Combat Style, a magical specialty) is refused naming its parent | `IF:` |
| `RANK(roll = untrained)` | the roll's own rank, Handling included (`roll` is the reserved word) | `IF:` |
| `SEEN` | the recipient can see you: a straight line from their token's centre to yours crosses no sight-blocking wall, they are not Blinded, your token is not hidden nor you Hidden or Undetected (ruling 170) | `IF:` |
| `ALLIES(>=1, 0)` | how many allies stand within the range of the owner; `>=`, `<=`, `=`, `>`, `<` | `IF:` |
| `ENEMIES(>=2, 15)` | how many enemies stand within the range | `IF:` |
| `ALL(>=3, 5)` | how many creatures of either side stand within the range | `IF:` |
| `CLAIM(when trading)` | the player decides: the bonus is a checkbox in the roll dialog with these words as its hint, unticked; the pin on the Talent's row arms it for the next roll (ruling 174) | `IF:` |
| `RESULT(critical failure)` | the roll's degree: `critical success`, `success`, `failure`, `critical failure`. Only `REROLL` reads it | `IF:` |
| `TRAIT(Fear)` | the attack answered carries the trait (a weapon's, an adversary attack's or a spell Talent's), matched on its first word; the build warns when nothing shipping carries it (ruling 171) | `IFT:` |
| `MARKED` | the other party is the creature this Talent's or Maneuver's `MARK` named (FG's `IFT: CUSTOM(Hunt Prey)`) | `IFT:` |
| `BLOW` | the Threat answered is a Blow (a weapon's Strike, an adversary's attack row) | `IFT:` |
| `BLAST` | the Threat answered is a Blast | `IFT:` |
| `BLIGHT` | the Threat answered is a Blight | `IFT:` |
| `BEGUILEMENT` | the Threat answered is a Beguilement | `IFT:` |
| `MELEE` | a Blow that reached by hand | `IFT:` |
| `RANGED` | a Blow that reached by a missile or a throw | `IFT:` |
| `CHECK(intimidation)` | the check read against this Defense rolls that Constellation (a character's Demoralize against your Guard reads your live Threshold, ruling 179) | `IFT:` |

**Who.** Allies are tokens of the same disposition as the owner on the scene, as the Support rule
counts them: never a party token, a hidden token, or a Dying, unconscious or dead body. Enemies are
tokens of the opposite disposition. `all` is everyone but the owner. Ranges are measured edge to
edge in feet; `0` is adjacency.

**Rank.** `untrained`, `trained`, `expert`, `master`, `legendary`.

**Trait.** Any word; the attack's traits are the weapon's Traits column, the adversary attack Item's
Traits, or the spell Talent's `Traits` column on its tree sheet.

**Terrain kind.** `mud`, `shallow water`, `decking`, `loose stone`, `rubble`, `undergrowth`, `snow`,
`ice`, `sand`, `other`: the Difficult terrain region behavior's own list, which a region's GM picks
from, so the words in a cell and on the map are one vocabulary.

## 4. The kinds, by their stored names

The sheet's **As read** list and the build's messages name a rule by its kind. These are the words,
each with the lines that make it.

### `bonus`
A typed bonus or penalty to a roll, and to the Threshold that roll's Constellation presents. Made by
`CHECK`, `ATK`, `DEF`, `INIT` and `SPEED`. Every component applies.

### `prevent`
An effect does not land: a Condition, or an Expose. Made by `IMMUNE`. Takes every component but
`CLAIM`. With `FOR` the prevention reaches others; when the carrier is a Reaction (↺ in its cost) it
is offered as that Reaction where the effect would land, and the owner pays its cost.

### `mark`
Using the Talent or Maneuver names one creature. Made by `MARK`. Takes `IF: RANK(...)` alone.

### `reroll`
The card of a matching roll offers to throw the die again, at the cost in the carrier's name. Made
by `REROLL`. Takes `IF: RANK(...)` and `IF: RESULT(...)`.

### `ignore`
Difficult terrain of named kinds costs nothing. Made by `IGNORE`. Takes `IF: RANK(...)` alone.

### `grant`
Talent Points at creation: `[POINT ...]` by scope, `[<Constellation> trained]` directed at one Root.

### `aura`
The ring on the map, `[AURA ...]`. A drawing: what happens inside it is the Talent's other lines.

### `trait`
`[TRAIT X]`.

### `size`
`[SIZE X]`.

### `speed`
`[SPEED N]` or `[SPEED +N]`.

### `vigor`
`[VIGOR N]` or `[VIGOR opening N]`.

### `sense`
`[SENSES X]`.

### `language`
`[LANGUAGE X, Y]`.

### `maneuver`
`[MANEUVER X]`.

### `talent`
`[TALENT X]`.

### `choice`
`[CHOICE X]`.

## 5. The book, written in the grammar

### The level-1 Human

```
Humanity            [TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
                    CHECK: 1 condition, aid; IF: RANK(Origin >= trained)
Driven              [POINT Calling]
Quick Study         [POINT Skill]
Stubborn Footing    IMMUNE: prone; LIMIT: encounter
Close Ranks         DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)
Versatile Human     [POINT Opening]
Jack of All Trades  CHECK: 1 situation; IF: RANK(roll = untrained)
Torchbearer Human   [AURA 15 allies visible]
                    DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round
Steady the Line     [MANEUVER Steady the Line]          Effect: @Maneuver[Steady the Line]
```

Close Ranks in words: `FOR: self+allies 0` is who gets the bonus; `IF: ALLIES(>=1, 0)` is the
owner's condition. An ally receives it only while within 0 ft of the owner, which is the same
adjacency, so one line serves both halves of "both of you". Torchbearer Human is the Rally Aura
(Mike's text of 2026-11-05: "The first time each round an ally within 15 feet who can see you
defends against an Attack with the Fear trait, they gain a +1 Situation bonus to that Defense
check"): the first line draws the ring; the second gives every Defense of an ally within 15 ft who
can see the owner a +1 against an attack carrying Fear, once a round per ally.

### The two Cultures

```
Serrovanian         [LANGUAGE Common, Serrovine]
                    CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)
Oathbound           [MANEUVER Oathbound]                 Effect: @Maneuver[Oathbound]
Contract Literate   CHECK: 2 condition; IF: CLAIM(noticing hidden clauses, traps or altered terms in an agreement)
Iron Etiquette      DEF: 1 condition; IFT: CHECK(intimidation)
                    DEF: 1 condition; IF: CLAIM(against a social manipulation other than Intimidation)
Reacher             [LANGUAGE Common, Reachspeak]
                    CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)
Quick Tongue        [MANEUVER Quick Tongue]              Effect: @Maneuver[Quick Tongue]
Riverfoot           IGNORE: terrain, mud, decking, loose stone, shallow water
                    SPEED: 1 situation; LIMIT: encounter
Broker's Eye        CHECK: 2 situation, diplomacy; IF: CLAIM(when trading)
                    CHECK: 2 situation, guile; IF: CLAIM(when trading)
```

### The Backgrounds and the Callings

```
Acrobat             [Acrobatics trained][Athletics trained][Lore trained]
Soldier             [Athletics trained][Intimidation trained][Lore trained]
Criminal            [Guile trained][Stealth trained][Lore trained]
Weaponmaster Calling   [Athletics trained][CHOICE Weapon Group][TALENT Weapon Familiarity][VIGOR opening 10]
Berserker Calling      [Athletics trained][VIGOR opening 12]
(every other Calling Root: its Trained Skill and its Opening Vigor the same way)
```

### The Talent Maneuvers (the "Talent Maneuvers" sheet of `data/maneuvers.xlsx`)

```
Steady the Line  ❶↺   IMMUNE: expose; FOR: allies 0
Oathbound        ❶    MARK: enemies
                      ATK: 1 condition; IFT: MARKED
                      DEF: 1 condition; IFT: MARKED
Quick Tongue     ❶↺   REROLL: diplomacy; IF: RESULT(critical failure)
```

What the system does not read, and the table does: whom Oathbound may name ("a creature that has
either formally challenged you, or that has broken a bargain or a truce with you"; the mark takes
the targeted enemy); Quick Tongue's Requirements (a settlement, and not used there within a
month); Broker's Eye's "always know an item's fair price"; and which agreement, trade or social
manipulation is in front of the player, which is what `CLAIM` asks them. Iron Etiquette's two
lines are one Talent, so an Intimidation match and a ticked claim together are +1, not +2 (PHB
v4.21's stacking collapses one source).

## 6. Character Effects

The character sheet's Overview tab has an **Effects** panel (0.16.0; Mike: FG's "Character Effects
field ... automated and shown on the Tracker, or on the Character sheet"): every effect line the
character carries, from Talents, Maneuvers and the custom effects below, each with its As read line
and FG's three-state switch **On / Skip / Off**. Skip lets the next application pass and returns to
On; Off silences the line until it is turned back on. **Custom effects** are lines the owner or the
GM types in this grammar on the sheet (`ATK: 2 situation; LIMIT: round`, `DEF: 1 situation, guard;
IF: CLAIM(behind the cart)`), with a duration: until removed, the next roll, or the end of the
encounter. They act exactly as a Talent's lines do. The combat tracker shows a badge with the count
of a combatant's active effects and their summaries on hover.

## 7. What a rule does in play, and what it does not

- **A bonus to a Constellation moves its Threshold.** A Defense's Threshold is 10 plus the same
  modifiers its roll uses, so `DEF: 1 situation, guard` raises the Guard Threshold on the sheet, in
  the Combat Prompt's preview and on the attack card, and the Guard roll alike. A Skill's Threshold,
  wherever one is shown (the party's Skills grid, the Relevant Check picker), is 10 plus the check's
  own modifier, so it moves too. **Both of the player's paths are covered:** a player defending
  against an adversary's attack rolls their Defense, and the roll carries the bonus (and writes the
  LIMIT mark); a player attacking a player rolls once against the defender's Threshold, and the
  Threshold the coordinator reads carries it. A rule that needs the attack (`IFT:` Threats, `IFT:
  TRAIT`, `IFT: CHECK`), the map (`FOR` reaching others, `ALLIES(...)`, `SEEN`), the other party
  (`IFT: MARKED`) or the round (`LIMIT`) is read at those moments and nowhere they are unknown.
- **Position is read where a token is known.** The sheet's Defense Threshold is computed without
  the map, so it does **not** include such bonuses; its tooltip lists the rules it leaves out; the
  Combat Prompt's preview, the attack card's Threshold and every roll made with a token on the
  scene do include them.
- **`LIMIT: round` and `LIMIT: encounter` are remembered on the recipient** (a flag on the Actor,
  `flags.starwrought.rules.round` or `.encounter`, keyed by the Talent and the line, naming the
  Combat and the round). The client that resolves the roll writes the mark: the coordinator's
  client for an attack read against a Threshold, the roller's for a Defense roll or a check; a
  preview writes nothing.
- **A claim is the player's decision, at the roll** (ruling 174). A `CLAIM` bonus is a checkbox in
  the roll dialog, unticked, hint and all; ticked, it joins the roll and prints on the card by the
  Talent's name. The pin on the Talent's row arms it for the next roll (the box comes ticked) or
  the next Threshold read (applied, since no dialog shows); the pin goes out when either resolves.
  Nothing is applied unasked, and nothing is remembered past that one roll.
- **The other party is read per pairing** (ruling 175). A Defense roll and a Threshold read know
  the attacker; a Strike's one blind die knows nobody, so a rule about the defender (`IFT: MARKED`)
  is read as each pairing resolves and added to that pairing's total, listed on its card and kept
  for a reroll of it. A Strike with no target rolls against a typed Threshold and has no other party.
- **A mark names one creature** (ruling 176). `flags.starwrought.rules.marks.<carrier>` on the owner:
  the targeted token, its name and the Combat it was made in. It holds while that Combat is the
  viewed one; made outside an encounter it holds until the next encounter starts or the Maneuver is
  used again. Using the Maneuver asks for exactly one target of the kind `MARK` names.
- **A reroll pays once, in an encounter** (ruling 177). The button on the card pays the carrier's
  cost through the owner's actions when a Combat is running and charges nothing outside one; the new
  card names the Talent and says its Requirements are the table's.
- **A check against a Threshold reads it live** (ruling 179). A Maneuver whose check names a Defense
  (Demoralize against Guard), used with one target, reads that target's Threshold through the same
  fold the attack flow uses (the Threat `check` and the attacker known, so `IFT: CHECK(...)` and
  `IFT: MARKED` apply), prints the number for a character target or a GM roller, and withholds an
  adversary's as the flow does.
- **Terrain is on the map** (ruling 178). A Difficult terrain region behavior carries a kind and a
  multiplier; `IGNORE: terrain, <kind>` makes the owner's token cross that kind as open ground. A
  region the GM hides carries no terrain for anyone (Foundry's rule), so a terrain region is never
  hidden to keep it secret; players toggle their own overlay instead.
- **A `prevent` of a Condition** refuses the write wherever the system sets the Condition (Drop
  Flat at the reveal, the final Legs Wound, the token palette, the Effects tab) and posts one card
  saying which Talent prevented it. **A `prevent` of `expose`** is answered on the resolution card:
  the Expose widget shows the Reaction's button for each ally whose Maneuver reaches the attacker;
  pressed, the ally's cost is paid, the card says "It Exposes nothing", and the Expose widget is
  gone. **Pressed after the Zone was picked** it closes the Zone this card Exposed, and the card
  says so (ruling 172). A Zone Exposed by anything but this card is never touched.
- **A Talent Maneuver** (`[MANEUVER X]`) is an owned action Item copied from the Actions pack when
  the Talent lands (a drag onto the sheet, the wizard, or the GM's ready pass after Sync content),
  flagged with the Talent that granted it, listed under "From your Talents", and deleted with the
  Talent. Its cost is the row's Cost column; its rules are the row's Automation, indexed on the
  character as any owned Item's are.
- **Sight is read, hearing is not.** `SEEN` is line of sight between token centres against
  sight-blocking walls plus three statuses; light, sight range and hearing are the table's.
- **Nothing reads a Talent's Effect text.** What the cell does not say, the system does not do:
  every clause with no line for it is the table's.
- **Adversaries.** A rule on an adversary's Item is indexed but no adversary roll asks for
  modifiers (adversaries roll flat), and no adversary casts. A `prevent` on an adversary works,
  since Conditions are set on adversaries as on characters.

## 8. The messages the build prints

| message | what to do |
|---|---|
| `unknown rule kind "<word>" (an effect begins with a tag: CHECK, ATK, ...; a feature is a bracketed block: TRAIT, SIZE, ...)` | the word before the colon is neither a tag nor a kind word; check the spelling, or the line is prose that belongs in the Effect column |
| `"<word>" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, or [<Constellation> trained]` | the block's first word |
| `a [ has no closing ]` | a bracket left open |
| `CHECK is written \`CHECK: <value> <type>, <descriptor>\` ... a signed whole number first` | the value is missing or not a number |
| `no Talent bonus is untyped; name situation, condition or gear after the value` | the bonus type is missing |
| `write condition, not status: the book renamed the types in v3.3` | the retired type words (circumstance, status, item) |
| `CHECK takes one descriptor, a Constellation or a Maneuver, not N` | two descriptors after the comma |
| `"<word>" is not a Defense: DEF takes evade, guard, endure or awareness, or none for all four` | the descriptor of DEF |
| `ATK takes no descriptor` | ATK, INIT and SPEED name nothing |
| `"<name>" names no Constellation or Maneuver` | the target is misspelt, or the Maneuver's row is not on an action sheet yet (a disabled row still resolves) |
| `"<word>" is not a condition: IF: takes RANK, SEEN, ALLIES, ...` | the word inside IF or IFT |
| `RANK is written \`RANK(<Constellation> <op> <rank>)\`` | the contents of RANK |
| `"<word>" is not a rank: write Untrained, Trained, Expert, Master or Legendary` | the rank word |
| `"<name>" is a group and has no rank of its own; test <parent> instead` | `RANK(Dueling = expert)`: write the parent |
| `"<word>" is not a Degree: write Critical Success, Success, Failure or Critical Failure` | the degree in RESULT |
| `IF(Outcome=...) is only read by a kind that acts after the die (reroll)` | a RESULT condition on anything but REROLL |
| `"<word>" is not a Threat (...) or a Constellation` | the word after IFT: that is neither |
| `a Threat is written bare: \`IFT: BLOW\`` | `IFT: CHECK(blow)` |
| `<TAG> does not take <component>` | a component the tag has no use for (`IMMUNE does not take IF: CLAIM(...)`) |
| `"<TAG>" is a tag and begins its own line; one effect per line` | two tags on one line |
| `FOR is written \`FOR: <who> [<N>]\`` / `FOR: self takes no range` | the recipients |
| `LIMIT is written \`LIMIT: round\` or \`LIMIT: encounter\`` | the limit |
| `a who is written self, allies, enemies, all or self+allies` | the FOR subject |
| `a range is written <N>ft, as in 15ft` | the feet |
| `"<word>" is not a Condition or Expose` | the IMMUNE descriptor |
| `"<word>" is not a terrain kind: write Mud, Shallow Water, ...` | a kind not in the Difficult terrain behavior's list |
| `"<name>" is not a Maneuver: a [MANEUVER ...] names a row of data/maneuvers.xlsx` | the Maneuver's row is missing, or (the build) not enabled |
| `"<name>" is not a Constellation` | `[<name> trained]` names no Constellation |
| `[<name> expert]: a Root is Trained; nothing grants Expert at creation` | only `trained` reads |
| `POINT is written \`[POINT <N> <Scope> [different]]\`` / `"<word>" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet` | the point block |
| `SPEED is written \`[SPEED 6]\` ... or \`[SPEED +1]\`` / `VIGOR is written \`[VIGOR 8]\` ... or \`[VIGOR opening 12]\`` | the chassis blocks |
| `"<word>" is not a Size: write Tiny, Small, Medium, Large, Huge or Gargantuan` | the Size block |
| `AURA is written \`[AURA <N> <who> [visible]]\`` | the ring block |
| `the 0.13.0 form is retired; rewrite "<line>" in the 0.16.0 shape` (a WARNING) | an old cell; rewrite it by section 9 |
| `WARNING: ... TRAIT(<Trait>): no shipping weapon, attack or Talent carries the trait "<Trait>"` | not a failure: the rule reads and fires when something is authored with that trait |
| `WARNING: <workbook>: the _Tree Index columns <list> are retired; the Root's feature lines are the authoring now` | move the facts into the Root's cell as section 2 says, then drop the columns |
| `ERROR: <tree>: the _Tree Index <column> reads <a> but the Root's [<KEYWORD>] says <b>; drop the column` | a retired column and the Root's block disagree |

## 9. Reading an old cell: the 0.13.0 operators

A line in the 0.13.0 shape, `kind: <arg>, <arg>, ... [, <OPERATOR>(...)]`, still reads this release.
Its operators, and the component each became:

| operator | component since 0.16.0 |
|---|---|
| `IF(<Constellation>=<Rank>)`, `IF(Rank=<Rank>)`, `IF(Trait=<Trait>)`, `IF(Outcome=<Degree>)` | `IF: RANK(...)`, `IF: RANK(roll ...)`, `IFT: TRAIT(...)`, `IF: RESULT(...)` |
| `FOR(<Who>[, <N>ft])` | `FOR: <who> [<N>]` |
| `WHILE(<Who><op><N>[, <N>ft])` | `IF: ALLIES(<op><N>[, <N>])` (ENEMIES, ALL) |
| `AGAINST(<Threat>)`, `AGAINST(<Constellation>)` | `IFT: BLOW` (BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED), `IFT: CHECK(...)` |
| `SEEN` | `IF: SEEN` |
| `FIRST(round)` | `LIMIT: round` |
| `ONCE(encounter)` | `LIMIT: encounter` |
| `CLAIM(<text>)` | `IF: CLAIM(<text>)` |
| `MARKED` | `IFT: MARKED` |
| `DIFFERENT` | `[POINT N <Scope> different]` |
| `VISIBLE` | `[AURA <N> <who> visible]` |

And the old kind lines: `bonus: +1, Condition, Aid` is `CHECK: 1 condition, aid`; `bonus: +1,
Situation, Defenses` is `DEF: 1 situation`; `bonus: +1, Situation, Attacks` is `ATK: 1 situation`;
`prevent: Prone` is `IMMUNE: prone`; `grant: 1, Skill` is `[POINT Skill]`; `aura: 15ft, allies,
VISIBLE` is `[AURA 15 allies visible]`.

## 10. The grammar's own history

- **0.9.0** (2026-10-03): the framework; one rule per line, `kind: arguments`, no kinds.
- **0.10.0**: `bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]`, prose connectives.
- **0.13.0** (2026-11-05): the operator grammar, Mike's direction ("logical operands and
  grammatical shortcuts"); `bonus` rewritten to it and the 0.10.0 prose form retired; `grant`,
  `aura`, `prevent`; the operators `IF`, `FOR`, `WHILE`, `AGAINST`, `FIRST`, `ONCE`, `DIFFERENT`,
  `VISIBLE`.
- **0.14.0** (2026-11-05): `SEEN` and `IF(Trait=<Trait>)`, for the Torchbearer Human's Rally Aura;
  a `Traits` column on tree sheets.
- **0.15.0** (2026-11-05): the two Cultures' eight Talents. `CLAIM(<text>)` and the arm pin, `MARKED`
  with the `mark` kind, `reroll` with `IF(Outcome=...)`, `AGAINST(<Constellation>)` and the check
  that reads a target's Threshold, `Speed` as a bonus target, `ignore: Terrain` with the Difficult
  terrain region behavior.
- **0.16.0** (2026-11-05): the grammar in Fantasy Grounds' shape, Mike's direction: feature lines in
  brackets and effect lines of tags and components; the chassis facts as feature lines on the Root
  and the index columns retired; Talent Maneuvers as rows granted by `[MANEUVER X]` with
  `@Maneuver[X]` in the Effect; Trained Roots as `[X trained]`; Character Effects with the On / Skip
  / Off switch and custom effect lines. The 0.13.0 form reads one more release with a warning.
