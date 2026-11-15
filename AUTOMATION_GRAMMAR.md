# STARWROUGHT Automation: the grammar

This is the reference for the **Automation** column of the data workbooks (`data/*.xlsx`), written
for the person typing in the cell. The Foundry system reads the cell with one parser
(`foundry/starwrought/module/rules/`) at build time and in play, so what is written here is what
the system does. Every change to a rule kind, a tag, a keyword or a vocabulary updates this document
in the same commit (CLAUDE.md, standing rule, 2026-11-05), and the build fails when a kind, a tag, a
component or a keyword the system knows is not named here. In Foundry the same text is the
**STARWROUGHT Automation Grammar** journal in the Rules compendium, one page per section, opened by
the Grammar button beside any Automation panel and the sheet's custom effects.

The grammar has the shape of Fantasy Grounds' Pathfinder 2 automation, which Mike asked for by name
(2026-11-05: "I REALLY, REALLY like the FantasyGrounds effects automation ... can we use syntax
substantially similar to this"), and since 0.17.0 every line of a cell is **blocks in square
brackets**, as FG's PC feature automation is (Mike: "shouldn't ALL of those be enclosed in
Brackets?"):

- **Feature blocks**: what owning the Talent does to the character.
  `[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]`, `[Acrobatics trained]`, `[MANEUVER Steady the Line]`.
- **Effect blocks**, `[EFFECT ...]`: what the Talent does to a roll, a tag then components separated
  by semicolons, FG's own wrapper for an effect inside a feature.
  `[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]`, `[EFFECT IMMUNE: prone; LIMIT: encounter]`.

```
[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]
[EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]
[MANEUVER Oathbound]
```

## 0. At a glance

Every block the cell reads, one example each. Case never matters.

| write | it means | section |
|---|---|---|
| `[TRAIT Human]` | the character has the trait | 2 |
| `[SIZE Medium]` | the body's Size | 2 |
| `[SPEED 6]`, `[SPEED +1]` | Speed in feet per Move, or an adjustment to it | 2 |
| `[VIGOR 8]`, `[VIGOR opening 12]` | Vigor per level; a Calling's Opening Vigor | 2 |
| `[SENSES Low-light vision]` | a sense | 2 |
| `[LANGUAGE Common, Serrovine]` | languages known | 2 |
| `[Acrobatics trained]`, `[Lore trained]` | a Trained Root at creation, one directed Talent Point | 2 |
| `[POINT Skill]`, `[POINT 2 Skill different]` | Talent Points at creation, by scope | 2 |
| `[MANEUVER Steady the Line]` | the Maneuver of that name is the character's | 2 |
| `[TALENT Weapon Familiarity]` | a Talent handed over free | 2 |
| `[CHOICE Weapon Group]` | a pick the Talent demands at creation | 2 |
| `[AURA 15 allies]` | a ring on the map, preview-only until shown | 2 |
| `[AURA 15 allies; DEF: 1 situation; IF: SEEN]` | a ring that carries its effect: the ring is the effect's FOR | 2 |
| `[EFFECT CHECK: 1 condition, aid]` | a bonus to checks of a Constellation or Maneuver (none named: every check) | 3 |
| `[EFFECT ATK: 1 condition]` | a bonus to every Strike and Cast | 3 |
| `[EFFECT DEF: 1 situation, guard]` | a bonus to a Defense (none named: all four) | 3 |
| `[EFFECT INIT: 1 situation]` | a bonus to Initiative | 3 |
| `[EFFECT SPEED: 1 situation]` | feet on a Move | 3 |
| `[EFFECT IMMUNE: prone]`, `[EFFECT IMMUNE: expose]` | a Condition, or an Expose, does not land | 3 |
| `[EFFECT MARK: enemies]` | using it names one creature | 3 |
| `[EFFECT REROLL: diplomacy]` | the card of a matching roll offers the die again | 3 |
| `[EFFECT IGNORE: terrain, mud]` | difficult terrain of those kinds costs nothing | 3 |
| `[EFFECT USE: Presence, Origin, aid]` | a check made from that Maneuver may be rolled with that Attribute and that Constellation's Proficiency Bonus in place of its own (`same` keeps a term) | 3 |
| `[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]` | on a Maneuver's own row: that result of its check gives another character a bonus (or a penalty) on its next roll with a Constellation, named when it is given (`chosen`) or by the line | 3 |
| `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]` | on a Talent: one property of that Maneuver is changed (a result to nothing, a window with `Aid.beneficial-duration`, or its movement to a Step with `Move Together.movement; VALUE: step`) | 3 |
| `[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]` | on a Maneuver's own row: using it lets the adjacent ally you target make one Move now, outside its Opportunity, once a round | 3 |
| `; UNTIL: recipient opportunity 2` | ... a GIVE's window: `giver opportunity` (the default), `recipient opportunity <N>`, `encounter` | 3 |
| `; VALUE: nothing` | ... what an ALTER's property becomes | 3 |
| `; IF: RANK(Origin >= trained)` | ... while the owner's rank is at least that | 3 |
| `; IF: RANK(roll = untrained)` | ... while the rank the roll is made at is that (the borrowed Constellation's when a `USE` stands; on a `USE` line itself, the check's own rank before the swap) | 3 |
| `; IF: SEEN` | ... for a recipient who can see the owner | 3 |
| `; IF: ALLIES(>=1, 0)` | ... while that many allies stand within the range (`ENEMIES`, `ALL`) | 3 |
| `; IF: CLAIM(when trading)` | ... when the player says so (a checkbox in the roll dialog, or Apply to next roll) | 3 |
| `; IF: RESULT(critical failure)` | ... on that degree (REROLL and GIVE only) | 3 |
| `; IFT: TRAIT(Fear)` | ... against an attack carrying the trait | 3 |
| `; IFT: MARKED` | ... against the creature the MARK named | 3 |
| `; IFT: BLOW` (`BLAST`, `BLIGHT`, `BEGUILEMENT`, `MELEE`, `RANGED`) | ... against that Threat, or a Blow by its reach | 3 |
| `; IFT: CHECK(intimidation)` | ... against a check of that Constellation read on this Defense | 3 |
| `; FOR: allies 15` | ... given to allies within 15 ft (`self`, `enemies`, `all`, `self+allies`) | 3 |
| `; LIMIT: round`, `; LIMIT: encounter` | ... the first time each round, or each encounter | 3 |

## 1. The cell

- A line is one or more blocks in square brackets. A cell may hold any number of lines; a
  `[EFFECT ...]` block is best on a line of its own, for reading.
- A blank line is nothing. A line beginning with `#` is a comment.
- Case does not matter anywhere: `[effect check: 1 Condition, Aid]`, `[trait human]` and
  `IF: rank(ORIGIN >= Trained)` all read.
- Spaces are free around commas, colons and semicolons. One trailing period inside a block is tolerated.
- Names are the book's: Constellations (`Guard`, `Stealth`, `Elementalism`), Maneuvers (`Aid`, `Steady the Line`),
  Conditions (`prone`), Threats (`BLOW`), ranks (`trained`), Attributes (`presence`). A Maneuver's
  cost glyphs are ignored (`Aid` and `Aid ❶` are one name). The slug form (`armored-fighting`)
  reads too.
- Feet are a number with `ft` attached or not: `15`, `15ft`, `15 ft`. `0` means adjacent.
- A block ends at the first `]` outside parentheses (0.18.1): a `CLAIM(...)` text may say
  "[per the table]" and the block runs on to its own `]`. Outside a condition's parentheses
  nothing a block carries contains one.

A line the parser cannot read **fails the release build** (`node assets/build_all.mjs`) with the
Constellation, the Talent, the line number and what is wrong, before anything is written to the
pack sources. **The content loop is lenient** (`sync_content.cmd`, `node assets/build_all.mjs
--content`; since 2026-11-07): the same line is listed under an AUTOMATION ERRORS banner and
stored on its Item as an error, which the Item sheet's Automation panel shows in red and the
engine skips, exactly as a GM's wrongly edited textarea line is treated in an open world; the
lines that did read on the same cell are rules as usual. So a sheet half-authored (a `[Medicine
trained]` before the Medicine sheet exists) still builds, and the release stops until it is
mended. Nothing is ever thrown at the table over a cell.

**Red cells in the workbooks.** `python assets/highlight_automation.py` (2026-11-08) paints every cell
this parser cannot read solid red in `data/*.xlsx`, with a cell comment giving the message for each
line and why: mis-typed (the nearest name offered when one is close), no kind yet (nothing in this
document reads what the line asks), or not yet readable (the cell is right, but the sheet it names
is not in its `_Tree Index`, or the workbook it names is one the converter does not read). Fix the
cell and run it again and its red goes. `automation-cells-report.md` in the project root lists the
red cells and the kinds they ask for.

**A bare effect line in a cell is refused** (since 0.18.0; it read with a warning in 0.17.0).
`IMMUNE: prone; LIMIT: encounter` on a line of its own, without the `[EFFECT ...]` wrapper, is one
error quoting the block to write. The bare line is the form of the sheet's custom effects alone
(section 6), as FG's Character Effects field takes the bare string.

**The 0.13.0 form is refused since 0.17.0.** A line in the old operator shape (`bonus: +1,
Condition, Aid, IF(Origin=Trained)`, `grant: 1, Calling`, `aura: 15ft, allies, VISIBLE`, `prevent:
Prone, ONCE(encounter)`, or a `mark:`, `reroll:` or `ignore:` line carrying `IF(...)`-style
operators) is one error naming this document; section 9 maps each old operator to its component.
The 0.10.0 prose form (`bonus: +1 Condition to Aid if Human is Expert`) stays refused.

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
| `[AURA 15 allies]` | the ring on the map: range in feet, whom it is about (`allies`, `enemies`, `all`). Every ring is preview-only until its owner shows it from the Auras window (0.17.0; the old `visible` word is refused) | `aura` |
| `[AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]` | the ring **carrying its effect** (0.18.0): after the semicolon, one effect line (section 3) whose `FOR` is the ring, so "15 feet, allies" is said once; a `FOR:` inside the block is refused. Stored as two rules, the ring and the effect. A second effect on the same ring is a second block with the same range and audience, drawn once; two rings on one Talent draw the first | `aura`, and the effect's kind |
| `[EFFECT ...]` | an effect block: section 3 | the tag's kind |

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

## 3. Effect blocks: what the Talent does to a roll

```
[EFFECT TAG: <value> <type>, <descriptor>; <component>; <component> ...]
```

The **tag** names what is modified. A **modifier tag** (`CHECK`, `ATK`, `DEF`, `INIT`, `SPEED`,
`GIVE`) takes a signed whole number and a bonus type (`situation`, `condition` or `gear`, the
book's three; FG's `[bonus]`), then at most one descriptor after a comma (`GIVE` exactly one). The
other tags (`IMMUNE`, `MARK`, `REROLL`, `IGNORE`, `USE`, `ALTER`) take descriptors alone; `USE`
takes exactly three and `ALTER` exactly one, and never a value or a type. No bonus is untyped.

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
| `USE: Presence, Origin, aid` | the two base terms of a check made from a Maneuver's own Item, written `USE: <Attribute>, <Constellation>, <Maneuver>`: the Attribute Bonus and the Proficiency Bonus are the named Attribute's and the named Constellation's in place of the check's own, offered in the roll dialog; nothing else on the roll changes (0.21.0) | exactly three: an Attribute or `same`, a Constellation or `same`, then a Maneuver by name | `substitute` |
| `GIVE: 1 situation, chosen` | what a result of this Maneuver's check gives ANOTHER character: a bonus or penalty on that character's next roll with a Constellation. Written on the Maneuver's own row, one line for each degree that gives something, each with `IF: RESULT(<degree>)` (0.22.0) | exactly one: `chosen` (the Constellation is named when the result is given) or a Constellation by name | `give` |
| `ALTER: Aid.critical-failure` | one property of a Maneuver, changed by a Talent: `ALTER: <Maneuver>.<property>; VALUE: <value>`. The properties read are in the Property vocabulary below (0.22.0; `movement` since 0.24.0) | exactly one: the Maneuver by name, a dot, the property | `alter` |
| `PERMIT: move` | using this Maneuver lets the creature you target make one Move now, outside its Opportunity, paying for it itself; your own next drag is the Maneuver's Move, already paid. Written on the Maneuver's own row, with `FOR:` saying who may be permitted and how near (`FOR: allies 0` is an adjacent ally) and `LIMIT:` its Frequency (0.24.0) | exactly one: what is permitted (`move`) | `permit` |

A bonus to a Constellation moves its **Threshold as well as its roll** (section 7). A bonus to a
Maneuver is applied when the roll is made from that Maneuver's Item and otherwise **offered**
unticked in the roll dialog ("Humanity: Aid"; ruling 122). A `USE` is **offered** in the roll dialog
too, but only when the roll is made from the Maneuver's own Item and never on another check: a
checkbox naming the two pairs ("Cooperative Instinct: Presence and Origin (Trained) in place of
Wits and Crafting (Untrained)") with the signed difference in the total beside it, ticked by
default when the swapped total is strictly higher (rulings 218 and 219; section 4, `substitute`).

**Components** follow the tag, each after a semicolon:

| component | means |
|---|---|
| `IF: <condition>` | about the owner, or the roll itself |
| `IFT: <condition>` | about the other party: the attacker you answer, the defender your Strike meets, the attack itself |
| `FOR: allies 15` | who receives it: `self` (the default), `allies`, `enemies`, `all`, `self+allies`, within that range of the owner; `FOR: self` takes no range |
| `LIMIT: round` | the first time it would apply to each recipient in a round, and not again until the next round |
| `LIMIT: encounter` | the first time in an encounter, and not again until the next. Outside an encounter either applies every time, said on the card |
| `UNTIL: recipient opportunity 2` | after `GIVE` alone: the window in which the result may be used (the Window vocabulary below). With none, `giver opportunity`. Every other tag refuses it by name |
| `VALUE: nothing` | after `ALTER` alone: what the property becomes, `nothing` for a result and a window for a duration (`VALUE: recipient opportunity 2`). Every other tag refuses it by name |

Both `IF:` and `IFT:` accept every condition (FG's own users mix them); the idiomatic prefix is the
one in the table. Several `IF:`/`IFT:` components on one line must all hold.

| condition | means | idiom |
|---|---|---|
| `RANK(Origin >= trained)` | the owner's rank in that Constellation: `=`, `>=` or `<=`; `Origin` is the pooled Ancestry, Bloodline and Culture rank; a group (a Combat Style, a magical specialty) is refused naming its parent | `IF:` |
| `RANK(roll = untrained)` | the rank the roll is made at, Handling included (`roll` is the reserved word): the borrowed Constellation's when a `USE` stands (ruling 217); on a `USE` line itself, the check's own rank, before any swap | `IF:` |
| `SEEN` | the recipient can see you: a straight line from their token's centre to yours crosses no sight-blocking wall, they are not Blinded, your token is not hidden nor you Hidden or Undetected (ruling 170) | `IF:` |
| `ALLIES(>=1, 0)` | how many allies stand within the range of the owner; `>=`, `<=`, `=`, `>`, `<` | `IF:` |
| `ENEMIES(>=2, 15)` | how many enemies stand within the range | `IF:` |
| `ALL(>=3, 5)` | how many creatures of either side stand within the range | `IF:` |
| `CLAIM(when trading)` | the player decides: the bonus is a checkbox in the roll dialog with these words as its hint, unticked; the Effects tab's "Apply to next roll" and the pin on the Talent's row arm it for the next roll (ruling 174) | `IF:` |
| `RESULT(critical failure)` | the roll's degree: `critical success`, `success`, `failure`, `critical failure`. Only `REROLL` (the degree that offers the die again) and `GIVE` (the degree that gives the result) read it | `IF:` |
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

**Attribute.** `might`, `agility`, `wits`, `presence`: the first descriptor of `USE`. The word
`same` stands there, or in the second descriptor, for a term the check keeps: it means "the term
this check would use without this line".

**Window** (0.22.0). How long a result a Maneuver gave may be used, after `UNTIL:` on a `GIVE` line
and after `VALUE:` on an `ALTER` of a duration. `giver opportunity` is until the giver's next
Opportunity begins, and is what a `GIVE` has when it says nothing; `giver opportunity 2` waits for
the second. `recipient opportunity 2` runs through the END of the recipient's second upcoming
Opportunity (an Opportunity already running when the result is given is not counted). `encounter`
is until the encounter ends. Every window also ends with the encounter, and outside an encounter a
result lasts until it is used, replaced or removed.

**Property** (0.22.0). What an `ALTER` may change of the results a Maneuver gives, after the dot:
`duration` (every result's window), `beneficial-duration` (the window of the results that give a
bonus, so a penalty keeps its own), and the four results by degree, `critical-success`, `success`,
`failure`, `critical-failure`, each of which is changed to `nothing`. Since 0.24.0 one more, which
is not about what the Maneuver gives: `movement`, changed to `step`, so that a drag within half
Speed made as part of the Maneuver is a Step for everyone who moves in it (Coordinated Footwork, of
Move Together). Any other property is refused as not read yet. Where two lines change one
Maneuver, `beneficial-duration` stands over `duration` in either order, and of two changes to one
property the later stands.

**Trait.** Any word; the attack's traits are the weapon's Traits column, the adversary attack Item's
Traits, or the spell Talent's `Traits` column on its tree sheet.

**Terrain kind.** The names of the hand-kept `terrainKinds` block of `assets/roster.json` (0.18.0;
today `mud`, `shallow water`, `decking`, `loose stone`, `rubble`, `undergrowth`, `snow`, `ice`,
`sand`, `other`), which is also the Difficult terrain region behavior's dropdown, so the words in a
cell and on the map are one vocabulary; a row added to the block is a kind a cell may name.

## 4. The kinds, by their stored names

The sheet's **As read** list and the build's messages name a rule by its kind. These are the words,
each with the blocks that make it.

### `bonus`
A typed bonus or penalty to a roll, and to the Threshold that roll's Constellation presents. Made by
`[EFFECT CHECK: ...]`, `ATK`, `DEF`, `INIT` and `SPEED`. Every component applies.

### `prevent`
An effect does not land: a Condition, or an Expose. Made by `[EFFECT IMMUNE: ...]`. Takes every
component but `CLAIM`. With `FOR` the prevention reaches others; when the carrier is a Reaction (↺
in its cost) it is offered as that Reaction where the effect would land, and the owner pays its cost.

### `mark`
Using the Talent or Maneuver names one creature. Made by `[EFFECT MARK: ...]`. Takes `IF: RANK(...)` alone.

### `reroll`
The card of a matching roll offers to throw the die again, at the cost in the carrier's name. Made
by `[EFFECT REROLL: ...]`. Takes `IF: RANK(...)` and `IF: RESULT(...)`.

### `ignore`
Difficult terrain of named kinds costs nothing. Made by `[EFFECT IGNORE: ...]`. Takes `IF: RANK(...)` alone.

### `substitute`
A check made with another Attribute and another Constellation's Proficiency Bonus (0.21.0; rulings
215 to 222). Made by `[EFFECT USE: ...]`. It is for a Talent such as Cooperative Instinct (Mike,
2026-11-10: "When you Aid, you may use Presence + Origin proficiency in place of the Attribute and
proficiency normally used for that Aid check"; and his generalisation: "Replacing the Constellation
AND the Attribute bonus for a check with something else").

```
[EFFECT USE: <Attribute>, <Constellation>, <Maneuver>]

[EFFECT USE: Presence, Origin, aid]        Cooperative Instinct
[EFFECT USE: same, Origin, aid]            the Proficiency Bonus alone; the check keeps its Attribute
[EFFECT USE: Presence, same, aid]          the Attribute alone
[EFFECT USE: Presence, Origin, aid; IF: RANK(Origin >= expert); LIMIT: encounter]
```

Exactly three descriptors, in this order (ruling 215):

- **The Attribute** the check is made with: `might`, `agility`, `wits` or `presence`, or `same`.
- **The Constellation** whose Proficiency Bonus is borrowed, by the name the trees print: `Origin`,
  a Skill or a Defense, or `same`. A Maneuver and a Lore are refused, a group is refused naming its
  parent (as `RANK` does), and so is a rank word or a number: a flat Proficiency Bonus is not read
  yet.
- **The Maneuver** whose check is swapped, by the name the action sheets print (`aid`; its cost
  glyphs are ignored). A Constellation, a Defense, a scope word (`checks`), a Lore and `same` are
  refused: a `USE` never means every check (ruling 219).

`same` is "the term this check would use without this line". `same, same` swaps nothing and is
refused. The likely slips have messages of their own (section 8): a `+` between the two terms, as
the Talent's prose has it; a value and a type; two descriptors; four.

Takes `IF: RANK(...)` and `LIMIT:` alone. On a `USE` line `RANK(roll ...)` is the check's own rank,
before any swap. Every other component is refused by name (`FOR`, `IF: SEEN`, the counts,
`IF: CLAIM(...)`, `IF: RESULT(...)`, and every condition about the other party: `IFT: TRAIT(...)`,
`IFT: MARKED`, a Threat, `IFT: CHECK(...)`), and a `USE` after the ring of an `[AURA ...]` block is
refused in its own words: a substitution is the owner's own roll.

**As read:** `may use Presence + Origin proficiency on checks to Aid`; with one term kept, `may use
Origin proficiency on checks to Aid` or `may use Presence on checks to Aid`. The components follow
as on any line (`..., while Origin is at least Expert, once each encounter`), a `RANK(roll ...)` as
`while the check's own rank is Untrained`.

In play:

- **It replaces the two base terms and nothing else** (ruling 216): the Attribute Bonus and the
  Proficiency Bonus. The roll stays a check in its own Constellation, so the Flare preselection,
  Load Strain on Stealth, bonuses to that Constellation, rerolls and the road-roll memory are
  untouched.
- **The rank recorded is the rank rolled** (ruling 217): the borrowed Constellation's when a swap
  stands. Every other rule's `IF: RANK(roll ...)` reads that rank, and the card prints it; Aid's
  "master with the check you attempted" is read there.
- **Offered, and only from the Maneuver's own Item** (rulings 218 and 219; Mike: "Only from Aid").
  A check made from the Maneuver's Item shows a checkbox in the roll dialog, "Cooperative Instinct:
  Presence and Origin (Trained) in place of Wits and Crafting (Untrained)", with the signed
  difference in the total beside it. A check made without that Item is offered nothing.
- **Ticked when it is better** (ruling 218; Mike: "ticking it by default when it is a better
  pair"). Better is judged on the whole assembled total, not on the two base numbers, because
  another rule may read the rank: the box is ticked only when the swapped total is strictly
  higher, and a tie or a loss is offered unticked. One swap stands on a roll. With no dialog (a
  Shift-click) the default applies.
- **The card says so**: "Cooperative Instinct: Presence and Origin (Trained) in place of Wits and
  Crafting (Untrained)." The card keeps the record in its flags (`flags.starwrought.substituted`,
  beside the Attribute rolled, `flags.starwrought.attribute`, and the rank rolled,
  `flags.starwrought.rank`). In the Relevant Check picker a row whose number includes a swap is
  marked with an asterisk, and one hint line under the list names the Talent.
- **Checks only, characters only** (ruling 220): never a Strike, a Cast, a Defense roll, a
  Threshold read or an Initiative; an adversary rolls flat.
- **A limit is spent by the swap that is rolled** (ruling 221): a `LIMIT:` is never spent by a
  swap that was offered and left unticked.
- **On / Skip / Off** on the Effects tab switch the line like any effect line (section 6), and
  Skip or Off is how a swap is declined on a roll with no dialog.

### `give`
What a result of a Maneuver's check gives another character (0.22.0; rulings 223 to 230). Made by
`[EFFECT GIVE: ...]`, and written **on the Maneuver's own row**, because it is the Maneuver's own
result. It is for Aid (PHB v4.24): a Success gives the ally a +1 Situation bonus, a Critical Success
+2 (+3 "if you're a master with the check you attempted", +4 if legendary), a Critical Failure a -1
Situation penalty. Through 0.21.0 that was prose on the card, applied by hand.

```
[EFFECT GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>); IF: RANK(...); UNTIL: <window>]

[EFFECT GIVE: 2 situation, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]
[EFFECT GIVE: 3 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = master)]
[EFFECT GIVE: 4 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = legendary)]
[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]
[EFFECT GIVE: -1 situation, chosen; IF: RESULT(critical failure)]        Aid's row, whole
```

- **The value and the type**, as on any modifier tag: a signed whole number, then `situation`,
  `condition` or `gear`. A negative value is a penalty.
- **One descriptor**: `chosen`, or a Constellation by name. `chosen` means the Constellation is
  named when the result is given, opening on the one the giver rolled (Mike, 2026-11-14: "Named
  separately"); a named Constellation fixes it. A Maneuver, a Lore, a group and a scope word are
  refused (a Lore is reached through `chosen`).
- **Exactly one `IF: RESULT(<degree>)`** says which result gives it (ruling 223). One line for
  each degree that gives something; a degree with no line gives nothing.
- **`IF: RANK(...)`** chooses between lines for one degree: the owner's rank in a Constellation,
  or `RANK(roll ...)`, the rank ROLLED (ruling 217), which is how "a master with the check you
  attempted" is written. **The first line that holds for a degree is its result**, so order the
  lines for one degree from the narrowest condition to the widest.
- **`UNTIL: <window>`** (section 3, Window). With none the window is `giver opportunity`.

Refused by name: `FOR`, `IF: SEEN`, the counts, `IF: CLAIM(...)`, `LIMIT`, every condition about
the other party, and a `GIVE` after the ring of an `[AURA ...]` block. A `GIVE` in a Talent's cell
or on a custom effect row is refused in its own words: a Talent changes what a Maneuver gives with
`ALTER`.

**As read:** `gives a +1 Situation bonus to the next roll with the Constellation chosen, on a
Success, until the giver's next Opportunity`.

In play (rulings 226 to 229):

- **Nothing is given by the roll.** The check's card carries the result of its degree, and for
  the giver's owner and the GM a button: **Give Wren +1 to Crafting** when the giver had one
  character targeted (one click), with **Other...** beside it, or **Give the result...** when
  nobody was targeted. Other and Give the result open a dialog: who, and for a `chosen` result
  which of that character's Constellations. Never automatic (Mike: "A button on the card").
- **Pressing it puts one line on the recipient's Effects tab**, "Aid from Tess: +1 Situation bonus
  to the next Crafting roll, until Tess's next Opportunity", and posts a card that says the same.
  That card is the record: the button on the check card gives way to "Given to Wren: +1 Situation
  to Crafting" on every client.
- **One result of a Maneuver is pending on a character at a time.** A new Aid result replaces the
  one pending, whoever gave it, and the give card says so.
- **The recipient's next roll with that Constellation carries it, and it is gone**: a check, a
  Maneuver's check, an attack, a Defense roll, an Initiative. It prints on the card as "Aid from
  Tess +1". It is never part of a Threshold on the sheet, and reading a Threshold (an attack
  resolved against it) neither carries it nor uses it up.
- **Unused, it goes when its window closes**, or with the encounter. The window is counted from
  the press of the button, so press it when the Aid is made. Outside an encounter a result lasts
  until it is used, replaced or removed, and a result given in one encounter is never applied in
  another.
- **Recipients are characters, and never the giver.** An adversary rolls flat and holds no such
  line.
- **A check made against no Threshold has no degree**, and its card says there is nothing to give.
- **A reroll gives its own result.** The first card's table holds every degree, so the new card
  offers what its own degree gives, and the card that was thrown again gives nothing. A result
  already given from the first card stays with whoever got it.
- **One client writes it**: the GM's when a GM is connected, else the recipient's own player's,
  so two presses of one card are served in turn and the second is told it was already given. With
  neither connected nothing is given and the presser is told.
- **A roll its roller may not read** (a blind roll) shows that roller no button: the button's
  words would say the degree. The GM has it.
- **The tracker's own Initiative die does not read a pending result.** Roll Initiative from the
  sheet, or from the party's grid, to use one.

### `alter`
A Talent that changes one property of what a Maneuver gives (0.22.0; rulings 223 to 230). Made by
`[EFFECT ALTER: ...]`, in the shape Mike drafted in the cells of two Human Talents before the kind
existed (2026-11-14): Patient Assistance ("the Situation bonus provided by your Aid lasts until the
end of the recipient's second upcoming Opportunity") and Sure Assistance ("A critical failure on
your Aid check grants no penalty to your ally").

```
[EFFECT ALTER: <Maneuver>.<property>; VALUE: <value>; IF: RANK(...)]

[EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]     Patient Assistance
[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]                        Sure Assistance
[EFFECT ALTER: Aid.duration; VALUE: encounter]                              every result of Aid
[EFFECT ALTER: Move Together.movement; VALUE: step]                         Coordinated Footwork
```

- **One descriptor**: the Maneuver by the name the action sheets print, a dot, the property
  (section 3, Property). Case, spaces and a Maneuver's cost glyphs do not matter.
- **`VALUE:`** says what the property becomes: a window for `duration` and `beneficial-duration`,
  the word `nothing` for a result, the word `step` for `movement`. It is read after `ALTER` alone.
- **`movement`** (0.24.0; ruling 242) is the one property that is not about what the Maneuver
  gives. It is read when the Maneuver is USED, by the `permit` kind below: with it, a drag within
  half Speed made as part of that Maneuver is a Step (one action, nothing provoked, no difficult
  terrain), for the user and for the one permitted alike; a longer drag is still a Move. Mike's
  draft of the cell, `VALUE: choose(Move, Step); APPLY: both-participants`, is told the word and
  that `APPLY:` is no component: the Step is always for both, and it is a choice only in that a
  short drag is one.
- **`IF: RANK(...)`**: the owner's rank, or `RANK(roll ...)`, the rank rolled.

An `ALTER` changes one property and leaves the rest, so there is no `PRESERVE:`. It never touches
the roll: a Critical Failure that gives nothing is still a Critical Failure, and still offers a
Flare. A property not in the list is refused as **not read yet**, naming the ones that are, before
the Maneuver is looked up, so a cell drafted for a later version says what is missing rather than
what is misspelt. Refused by name: `FOR`, `LIMIT`, `IF: CLAIM(...)`, `IF: RESULT(...)` (the
property names the degree), every condition about the other party, `UNTIL`, and an `ALTER` after
the ring of an `[AURA ...]` block.

**As read:** `Aid's results that give a bonus last through the recipient's second upcoming
Opportunity`; `Aid's Critical Failure gives nothing`.

In play:

- **Read from everything the roller carries**: a Talent, an owned Maneuver, a custom effect. The
  card of the Maneuver's check shows the changed result, and under its button "Changed by Patient
  Assistance".
- **A result changed to nothing** shows no button and the note "Sure Assistance: a Critical
  Failure gives nothing", so the table can tell it from a degree that never gave anything.
- **`beneficial-duration` reaches the results that give a bonus** (Mike: a Success and a Critical
  Success). A penalty keeps its own window (Mike: "Same window as a bonus", the window a bonus has
  without the Talent).
- **Two changes to one Maneuver.** The more particular property stands over the general one,
  whichever line comes first: `beneficial-duration` over `duration`. Of two changes to ONE
  property the later line stands, and the card names only the Talent whose change it shows.
- **On / Skip / Off** on the Effects tab, as any effect line (section 6). A Skip, and a custom
  effect that lasts the next roll, is spent only by a roll whose degree the line CHANGES: Sure
  Assistance set to Skip is not used up by a Success, and a change that altered nothing (a result
  another Talent had already emptied) is not used up at all. A reroll reads the first card's
  results, so a line the first die did not spend is spent by the reroll that lands on its degree.
  A `movement` line is read when its Maneuver is used: on Skip it is left out that once (the drags
  are plain Moves) and the Skip is spent by a use that counted, never by a refused use or one
  outside an encounter; Off is Off; a custom effect that lasts the next roll is used up the same way.

### `permit`
Using this Maneuver lets the creature you target make one Move now, outside its Opportunity
(0.24.0; rulings 239 to 244). Made by `[EFFECT PERMIT: ...]` on a Maneuver's own row, from the
Human's Move Together (Mike, 2026-11-14): "You Move up to your Speed. The chosen ally may then
spend ❶ of its own actions to immediately Move up to its Speed as part of this same Maneuver. It
must finish adjacent to you." Through 0.23.1 the ally's drag on your Opportunity waited for the GM,
as any Maneuver outside an Opportunity does. The word is Mike's choice: a permit is what the GM's
Approve gives a player off-turn, and this is the same thing given by a Maneuver.

```
[EFFECT PERMIT: <what>; FOR: <who> [<N>]; LIMIT: round | encounter; IF: RANK(...)]

[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]                          Move Together ❶
```

- **One descriptor**, what is permitted: `move`, the one word in this version.
- **`FOR:`** is required and says who may be permitted and how near, in the words the grammar
  already has: `allies`, `enemies` or `all`, with a range in feet. `FOR: allies 0` is an adjacent
  ally, as Steady the Line writes it. `self` and `self+allies` are refused: nobody needs leave at
  their own Opportunity.
- **`LIMIT: round`** (or `encounter`) is the Maneuver's Frequency.
- **`IF: RANK(...)`** reads the owner's rank. `RANK(roll ...)` is refused: there is no roll.

Written on a Maneuver's own row and nowhere else, as `GIVE` is. Refused by name: `UNTIL`,
`VALUE`, `IF: CLAIM(...)`, `IF: RESULT(...)`, every condition about the other party, and a
`PERMIT` after the ring of an `[AURA ...]` block.

**As read:** `lets an adjacent ally you target make one Move now, outside its Opportunity, once a
round`.

In play, in an encounter:

- **Used with one creature targeted.** The Maneuver's row shows the Use control. **Refused, with
  nothing paid**: nobody targeted, yourself, a target who is not one the `FOR` names, and a second
  use within the `LIMIT`. **Warned on the card, and it still happens** (Mike: "Warn and go on"): a
  target farther than the `FOR` range, with no action left, unconscious or dying, or not in the
  encounter. Tokens that look adjacent are sometimes a foot apart.
- **You pay at the click** (Mike's choice), on the Maneuver's own card. Your own next drag in that
  Opportunity is the Maneuver's Move, already paid: one Move's worth, so a longer drag pays for
  the rest.
- **The one permitted** drags its token with no request to the GM, and pays for the Move from its
  own actions. The GM's own drag of that token counts as the Move too. One drag: any other
  Maneuver off-turn still asks the GM, and an approval the GM gave that fighter for something else
  is not used up.
- **A Move, however short** (ruling 242): a drag made as part of the Maneuver is never a Step and
  never a Rush, so it can provoke an Intercept, and the one-Maneuver cap holds it to one Move. A
  fighter at Speed 0 still crawls. An `ALTER` of the Maneuver's `movement` to `step` (above) lets a
  drag within half Speed be a Step for both.
- **Where it ends.** When the one permitted ends farther from you than the `FOR` range, its move's
  card says so (Move Together: "It must finish adjacent to you"). Said, not enforced.
- **It lasts the Opportunity it was used in.** One record on the user names both tokens; it is
  taken off when that Opportunity ends (the turn moves on, forwards or back; a lone fighter steps
  to itself; the encounter ends). If the one permitted never moves, it pays nothing. Two fighters
  may permit the same ally in one Opportunity: it moves once for each.
- **You must be in the fight.** With a Combat on screen that you are no part of, nothing is paid,
  recorded or limited, as outside an encounter. A permitted creature that is not a fighter in it
  is warned about on the card and its drag is free, as any drag of a token outside the tracker.
- **Outside an encounter** nothing is paid, recorded or limited: the card only. With "Track the
  six-action round" off nothing is spent, and the Moves are still marked as made.
- **On / Skip / Off** on the Effects tab: Off, the Maneuver permits nothing (the click still pays,
  and so does the drag); Skip on the `PERMIT` line itself is read as On, as for every line that
  acts on use (a Skip on a Talent's `ALTER` of its movement is honoured; see `alter`).

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
                    [EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]
Driven              [POINT Calling]
Quick Study         [POINT Skill]
Stubborn Footing    [EFFECT IMMUNE: prone; LIMIT: encounter]
Close Ranks         [EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]
Versatile Human     [POINT Opening]
Jack of All Trades  [EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]
Torchbearer Human   [AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]
Steady the Line     [MANEUVER Steady the Line]          Effect: @Maneuver[Steady the Line]
```

Close Ranks in words: `FOR: self+allies 0` is who gets the bonus; `IF: ALLIES(>=1, 0)` is the
owner's condition. An ally receives it only while within 0 ft of the owner, which is the same
adjacency, so one line serves both halves of "both of you". Torchbearer Human is the Rally Aura
(Mike's text of 2026-11-05: "The first time each round an ally within 15 feet who can see you
defends against an Attack with the Fear trait, they gain a +1 Situation bonus to that Defense
check"): one block draws the ring and gives every Defense of an ally within it who can see the
owner a +1 against an attack carrying Fear, once a round per ally.

### The two Cultures

```
Serrovanian         [LANGUAGE Common, Serrovine]
                    [EFFECT CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)]
Oathbound           [MANEUVER Oathbound]                 Effect: @Maneuver[Oathbound]
Contract Literate   [EFFECT CHECK: 2 condition; IF: CLAIM(noticing hidden clauses, traps or altered terms in an agreement)]
Iron Etiquette      [EFFECT DEF: 1 condition; IFT: CHECK(intimidation)]
                    [EFFECT DEF: 1 condition; IF: CLAIM(against a social manipulation other than Intimidation)]
Reacher             [LANGUAGE Common, Reachspeak]
                    [EFFECT CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)]
Quick Tongue        [MANEUVER Quick Tongue]              Effect: @Maneuver[Quick Tongue]
Riverfoot           [EFFECT IGNORE: terrain, mud, decking, loose stone, shallow water]
                    [EFFECT SPEED: 1 situation; LIMIT: encounter]
Broker's Eye        [EFFECT CHECK: 2 situation, diplomacy; IF: CLAIM(when trading)]
                    [EFFECT CHECK: 2 situation, guile; IF: CLAIM(when trading)]
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
Steady the Line  ❶↺   [EFFECT IMMUNE: expose; FOR: allies 0]
Oathbound        ❶    [EFFECT MARK: enemies]
                      [EFFECT ATK: 1 condition; IFT: MARKED]
                      [EFFECT DEF: 1 condition; IFT: MARKED]
Quick Tongue     ❶↺   [EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]
```

### Aid, and two Talents that change it (0.22.0)

```
Aid  ❶                [EFFECT GIVE: 2 situation, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]
                      [EFFECT GIVE: 3 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = master)]
                      [EFFECT GIVE: 4 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = legendary)]
                      [EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]
                      [EFFECT GIVE: -1 situation, chosen; IF: RESULT(critical failure)]
Patient Assistance    [EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]
Sure Assistance       [EFFECT ALTER: Aid.critical-failure; VALUE: nothing]
```

The five lines are Aid's row on the Basic Actions sheet of `data/maneuvers.xlsx`; the two Talents
are the Human's. These cells are Mike's to paste: the 0.22.0 release carries the kinds, and both
workbooks were in his hands when it was cut. What the system does not read of Aid, and the table
does: its Threshold ("typically 15") and whether the help makes sense. (Its ❶ is paid when the roll
is made since 0.23.0.)

### Move Together, and the Talent that changes it (0.24.0)

```
Move Together  ❶      [EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]
Coordinated Footwork  [EFFECT ALTER: Move Together.movement; VALUE: step]
```

The first line is Move Together's row on the Ancestry Actions sheet of `data/maneuvers.xlsx`; the
second is the Human Talent's cell. Both are Mike's to paste: the 0.24.0 release carries the kind,
and both workbooks were in his hands when it was cut. What the system does not read of Move
Together, and the table does: that both routes are declared before either moves, that you move
first, that the ally can perceive your cue, and that the ally is willing.

What the system does not read, and the table does: whom Oathbound may name ("a creature that has
either formally challenged you, or that has broken a bargain or a truce with you"; the mark takes
the targeted enemy); Quick Tongue's Requirements (a settlement, and not used there within a
month); Broker's Eye's "always know an item's fair price"; and which agreement, trade or social
manipulation is in front of the player, which is what `CLAIM` asks them. Iron Etiquette's two
lines are one Talent, so an Intimidation match and a ticked claim together are +1, not +2 (PHB
v4.21's stacking collapses one source).

## 6. Character Effects

The character sheet's **Effects** tab (0.16.0, the Overview's panel through 0.16.0; Mike: FG's
"Character Effects field ... automated and shown on the Tracker, or on the Character sheet") lists
every effect line the character carries, from Talents, Maneuvers and the custom effects below, each
with its As read line. A line the system applies by itself has FG's three-state switch **On / Skip
/ Off**: Skip lets the next application pass and returns to On; Off silences the line until it is
turned back on. A line the system cannot apply by itself, one with `IF: CLAIM(...)`, has instead
**Apply to next roll** (0.17.0): pressed, the bonus comes ticked in the next roll dialog or is
applied to the next Threshold read, and the button goes out; the pin on the Talent's row is the
same switch. **Custom effects** are lines the owner or the GM types on the sheet in the bare form,
as FG's field takes them (`ATK: 2 situation; LIMIT: round`, `DEF: 1 situation, guard; IF:
CLAIM(behind the cart)`; the `[EFFECT ...]` wrapper reads there too), with a duration: until
removed, the next roll, or the end of the encounter. They act exactly as a Talent's lines do. The
combat tracker shows a badge with the count of a combatant's active effects and their summaries on
hover. The Grammar button on the panel opens this document's journal.

A `USE` line (0.21.0) is a third case. The system neither applies it by itself nor waits for it to
be armed: it **offers** the swap in the roll dialog, and the line has **On / Skip / Off** like any
effect line. **On**: offered when the roll is made from the Maneuver the line names. **Skip**: left
out of the next such roll, then back On (a roll that is not that Maneuver's does not spend the
Skip). **Off**: never offered. On a roll with no dialog (a Shift-click) a swap that would come
ticked is applied, so Skip and Off are the ways to decline it there. A custom effect may be a `USE`
line too (`USE: Presence, Origin, aid`), with the same three durations; one that lasts the next
roll leaves only when its swap is the one rolled.

**Pending results** (0.22.0) are a list of their own on the tab, under the effect lines: what
another character's Maneuver has given this one and it has not yet used ("Aid from Tess: +1
Situation bonus to the next Crafting roll, until Tess's next Opportunity"). A pending result has no
switch. The next roll with its Constellation uses it, its window closes it, and the bin beside it
is the GM's alone: a player does not strike a penalty a failed Aid left. It counts in the tab's
total and in the tracker's badge. A `GIVE` line on a copy of a Maneuver the character owns, and an
`ALTER` line on a Talent, are effect lines like any other and have On / Skip / Off; an `ALTER` may
be a custom effect too (`ALTER: Aid.critical-failure; VALUE: nothing`). A `GIVE` may not: it is
written on the Maneuver's row.

## 7. What a rule does in play, and what it does not

- **A bonus to a Constellation moves its Threshold.** A Defense's Threshold is 10 plus the same
  modifiers its roll uses, so `[EFFECT DEF: 1 situation, guard]` raises the Guard Threshold on the
  sheet, in the Combat Prompt's preview and on the attack card, and the Guard roll alike. A Skill's
  Threshold, wherever one is shown (the party's Skills grid, the Relevant Check picker), is 10 plus
  the check's own modifier, so it moves too. **Both of the player's paths are covered:** a player
  defending against an adversary's attack rolls their Defense, and the roll carries the bonus (and
  writes the LIMIT mark); a player attacking a player rolls once against the defender's Threshold,
  and the Threshold the coordinator reads carries it. A rule that needs the attack (`IFT:` Threats,
  `IFT: TRAIT`, `IFT: CHECK`), the map (`FOR` reaching others, `ALLIES(...)`, `SEEN`), the other
  party (`IFT: MARKED`) or the round (`LIMIT`) is read at those moments and nowhere they are unknown.
- **Position is read where a token is known.** The sheet's Defense Threshold is computed without
  the map, so it does **not** include such bonuses; its tooltip lists the rules it leaves out; the
  Combat Prompt's preview, the attack card's Threshold and every roll made with a token on the
  scene do include them.
- **`LIMIT: round` and `LIMIT: encounter` are remembered on the recipient** (a flag on the Actor,
  `flags.starwrought.rules.round` or `.encounter`, keyed by the Talent and the line, naming the
  Combat and the round). The client that resolves the roll writes the mark: the coordinator's
  client for an attack read against a Threshold, the roller's for a Defense roll or a check; a
  preview writes nothing. A client that may not write the recipient (a player's Defense roll
  spending a Skip on another player's Torchbearer line; an attacker's roll reading a body it does
  not own) hands the mark over the system socket to the GM's client, else to an active owner's
  (0.18.1); only a table with neither sees the rule apply again.
- **A claim is the player's decision, at the roll** (ruling 174). A `CLAIM` bonus is a checkbox in
  the roll dialog, unticked, hint and all; ticked, it joins the roll and prints on the card by the
  Talent's name. Apply to next roll (the Effects tab) and the pin on the Talent's row arm it for
  the next roll (the box comes ticked) or the next Threshold read (applied, since no dialog shows);
  both go out when either resolves. Nothing is applied unasked, and nothing is remembered past that
  one roll.
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
  multiplier; `[EFFECT IGNORE: terrain, <kind>]` makes the owner's token cross that kind as open
  ground. A region the GM hides carries no terrain for anyone (Foundry's rule), so a terrain region
  is never hidden to keep it secret; players toggle their own overlay instead.
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
- **An aura is a preview until shown** (0.17.0). `[AURA ...]` draws on hover, on selection and
  while the token is dragged; the Auras window on the token's HUD shows a ring to everyone for the
  encounter, and that choice is the character's (`system.auras.visible`), not the cell's.
- **A substitution swaps two terms, at the roll, when the player lets it** (0.21.0; rulings 216 to
  220; section 4, `substitute`). A `USE` line is offered in the roll dialog of a check made from
  the Maneuver's own Item, ticked when the swapped total is strictly higher, one swap to a roll.
  It replaces the Attribute Bonus and the Proficiency Bonus and nothing else, the card names both
  pairs, and the rank the roll records is the rank rolled. Never a Strike, a Cast, a Defense roll,
  a Threshold read or an Initiative, and never an adversary's roll.
- **A rule about the roll's rank reads the rank rolled** (ruling 217). A line such as Jack of All
  Trades' `IF: RANK(roll = untrained)` does not hold on a roll whose swap borrows a Trained
  Proficiency Bonus (Mike's Talent text: the +1 "does not apply to ... a check receiving a
  substituted proficiency bonus"). That is why "better" is judged on the whole total: the swap is
  priced with the +1 gone, and the check as it was with the +1 in.
- **A bonus to a Maneuver follows the Maneuver onto a Defense's check** (ruling 222). A check
  rolled with a Defense Constellation from that Maneuver's Item (an Aid made with Awareness)
  carries a bonus to the Maneuver (Humanity's +1 to Aid), which it lost through 0.20.1. Whether a
  bonus to every check reaches a Defense rolled as a check (Wind, Recovery, a Search) is untouched
  and is an open decision.
- **What a substitution does not read yet** (0.21.0). Not built: a Constellation as the check a
  `USE` names (it brings the Initiative question of ruling 111 with the first Talent that wants
  it); offers on plain checks, made without the Maneuver's Item; `IF: UNSUBSTITUTED`; a flat
  Proficiency Bonus (Working Knowledge's "+3 instead of +0"); `FOR` and auras; `CLAIM`. Aid's own
  outcome is read since 0.22.0 (the next entries).
- **A Maneuver's result is given by a button, to one character, for one roll** (0.22.0; rulings
  226 and 227; section 4, `give`). The check's card carries the result of its degree; the giver's
  owner or the GM presses Give; the recipient holds one pending result of that Maneuver, which its
  next roll with the Constellation carries and removes. A check, a Maneuver's check, an attack, a
  Defense roll and an Initiative are rolls; the Threshold on the sheet and a Threshold read are
  not, so a pending bonus to Guard helps a Guard ROLL and never the number an attacker reads.
- **A window is counted on the result itself** (ruling 228). Nothing in the system counts
  Opportunities, so a pending result remembers the Combat, the Combatant its window watches and
  how many of that fighter's Opportunities have begun. `giver opportunity` closes as the giver's
  next Opportunity begins; `recipient opportunity 2` closes as the second of the recipient's
  upcoming Opportunities ends. The turn step a completed circuit of Passes takes on its way to the
  next round is nobody's Opportunity and is not counted. A lone fighter's step to itself, when
  nobody else has an action left, IS one: one Opportunity ended and the next began. Each
  character's window is settled by the GM's client, else by its own player's.
- **A change to what a Maneuver gives is read with the check** (ruling 225; section 4, `alter`).
  The roller's `ALTER` lines are applied to the Maneuver's results when the check is made, and the
  card keeps the whole table, every degree at the rank rolled, so a reroll and a reload read the
  same answer. An `ALTER` never changes the roll or its degree.
- **What a give does not read yet** (0.22.0). Not built: two uses of one result (Carry the Plan);
  a second character using a pending result (Pay It Forward); a Condition given by a result; a
  result given by a Maneuver that rolls no check; an adversary as the recipient; the `ALTER`
  properties beyond the seven (a Maneuver's range, limit, uses, slots); and a Threshold a
  Maneuver's check opens on (Aid's "typically 15"), which is still typed. With no GM connected the
  turn step that ends a round by Passes may be counted as an Opportunity by a player's client, and
  two presses of one card for two recipients owned by different players can both land. A GM
  stepping the turn backwards and forwards again counts an Opportunity twice, so a window of two
  Opportunities or more can close one early.
- **What a permit does not read** (0.24.0). It permits a Move and nothing else. Not read, and the
  table's: that routes are declared first, the order of the two Moves, whether the cue can be
  perceived, whether the ally is willing. A mistaken use cannot be taken back, since the
  once-a-round mark stays for the round. A short Move forced by the Maneuver uses up a
  once-a-round Speed bonus as any Move does. A GM who repositions the permitted token during that
  Opportunity uses the permission and charges it. Each arrow-key nudge is its own movement, so the
  first nudge is the Maneuver's Move.
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
| `unknown rule kind "<word>" (an effect begins with a tag: CHECK, ATK, ..., in brackets as [EFFECT ...]; a feature is a bracketed block: TRAIT, SIZE, ...)` | the word before the colon is neither a tag nor a keyword; check the spelling, or the line is prose that belongs in the Effect column |
| `the 0.13.0 form ("bonus: +1, Condition, Aid, IF(...)") is retired since 0.17.0; AUTOMATION_GRAMMAR.md section 9 maps each operator to its component` | an old cell; rewrite it by section 9 |
| `an effect line in a cell is written in brackets: write "[EFFECT <line>]"` | wrap the line (the bare form is the custom effects field's alone) |
| `the ring is the FOR: an effect inside [AURA ...] reaches whom the ring is about, within its range; drop the FOR` | a `FOR:` inside an AURA block |
| `after the ring, an AURA block carries one effect, \`[AURA <N> <who>; <tag>: ...]\`` | what follows the ring's semicolon is no effect line |
| `EFFECT wraps an effect line, \`[EFFECT <tag>: ...]\`: CHECK, ATK, ...` | the word after EFFECT is no tag |
| `EFFECT is written \`[EFFECT <tag>: ...]\`, as in \`[EFFECT IMMUNE: prone; LIMIT: encounter]\`` | an empty `[EFFECT]` |
| `"<word>" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or [<Constellation> trained]` | the block's first word |
| `TRAIT is a feature and is written in brackets: \`[TRAIT Human]\`` | a feature keyword typed as a line, without its brackets |
| `"substitute" is the kind's name, and its tag is USE: write \`[EFFECT USE: Presence, Origin, aid]\`` | a kind's stored name typed as a line (`substitute: Presence, Origin, aid`; 0.21.0): an effect is written with its tag. On a custom effect row the message offers the bare `USE: Presence, Origin, aid` |
| `USE is an effect tag and takes a colon: write \`[EFFECT USE: Presence, Origin, aid]\`` | a tag typed without its colon (`use Presence, Origin, aid`; 0.21.0); any tag is told the same in its own word (`CHECK is an effect tag and takes a colon: ...`), but `SPEED`, which is a feature keyword first |
| `a [ has no closing ]` | a bracket left open |
| `CHECK is written \`CHECK: <value> <type>, <descriptor>\` ... a signed whole number first` | the value is missing or not a number. `GIVE` is told the same with its own example, `GIVE: 1 situation, chosen; IF: RESULT(success)` |
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
| `IF(Outcome=...) is only read by a kind that acts after the die (reroll, give)` | a RESULT condition on anything but REROLL and GIVE |
| `"<word>" is not a Threat (...) or a Constellation` | the word after IFT: that is neither |
| `a Threat is written bare: \`IFT: BLOW\`` | `IFT: CHECK(blow)` |
| `<TAG> does not take <component>` | a component the tag has no use for (`IMMUNE does not take IF: CLAIM(...)`) |
| `"<TAG>" is a tag and begins its own line; one effect per line` | two tags in one block |
| `"<part>" is not a component: after the tag come IF:, IFT:, FOR: and LIMIT: (descriptors are separated by commas; a semicolon begins a component)` | what follows a semicolon is none of the four. The words in parentheses are added (0.21.0) when the part has no colon: most often a descriptor that followed a semicolon (`USE: Presence; Origin; aid`). After `GIVE` the list is `IF: and UNTIL:`, after `ALTER` it is `VALUE: and IF:` (0.22.0), so a `PRESERVE:` is not sent looking for a `FOR` |
| `<TAG> does not take UNTIL` / `<TAG> does not take VALUE` | `UNTIL:` after any tag but `GIVE`, or `VALUE:` after any tag but `ALTER` (0.22.0) |
| `UNTIL is given twice` / `VALUE is given twice` | one window, one value |
| `a window is written \`giver opportunity\`, \`recipient opportunity <N>\` or \`encounter\`, not "<text>"` | the words after `UNTIL:`, or after `VALUE:` on an `ALTER` of a duration |
| `"<word>" is not a count of Opportunities: write a whole number from 1 to 9, as in \`recipient opportunity 2\`` | the count in a window |
| `GIVE is written on the Maneuver's own row: it says what a result of that Maneuver's check gives. A Talent changes it with ALTER, as in \`[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]\`` | a `GIVE` in a Talent's cell or on a custom effect row |
| `GIVE says which result of the check gives it: add \`IF: RESULT(<degree>)\`, as in \`GIVE: 1 situation, chosen; IF: RESULT(success)\`` | a `GIVE` with no degree |
| `GIVE takes one \`IF: RESULT(...)\` (<N> given): write one line for each degree` | two degrees on one line |
| `GIVE names what the bonus is to after a comma: chosen (named when the result is given) or a Constellation, as in \`GIVE: 1 situation, chosen; IF: RESULT(success)\`` | a `GIVE` with no descriptor |
| `GIVE takes one descriptor, chosen or a Constellation, not <N>` | two descriptors or more |
| `"<name>" is not a Constellation: GIVE names one, or chosen for one named when the result is given` / `"<name>" is a Maneuver: GIVE names the Constellation the recipient rolls, or chosen ...` | the descriptor of `GIVE` |
| `"<word>" is a scope word; GIVE names one Constellation, or chosen for one named when the result is given` | `checks`, `defenses`, `attacks`, `initiative` or `speed` as the descriptor |
| `"<name>" is a group and its Talents roll the parent; write <parent> instead` | a group as the descriptor of `GIVE` |
| `a Lore is the character's own; write chosen, and the Lore is named when the result is given` | a Lore as the descriptor of `GIVE` |
| `GIVE does not take FOR` / `GIVE does not take LIMIT` / `GIVE does not take IF: SEEN` / `GIVE does not take IF: CLAIM(...)` / `GIVE does not take IFT: TRAIT(...)` | a component `GIVE` has no use for: it takes `IF: RESULT(...)`, `IF: RANK(...)` and `UNTIL:` alone |
| `a give is what a Maneuver's check gives and cannot ride an [AURA ...] block; write it on the Maneuver's row as \`[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]\`` | a `GIVE` after the ring's semicolon |
| `an alteration is written \`ALTER: <Maneuver>.<property>; VALUE: <value>\`, as in \`ALTER: Aid.critical-failure; VALUE: nothing\` (<N> descriptors given, 1 wanted: the Maneuver, a dot, the property)` | no descriptor, or a comma in it |
| `"<text>": an alteration names the Maneuver, a dot, and the property it changes, as in \`ALTER: Aid.critical-failure; VALUE: nothing\`` | no dot, or nothing on one side of it |
| `the property "<word>" is not read yet: ALTER reads duration, beneficial-duration, critical-success, success, failure, critical-failure and movement` | a property of a later version (`Aid.beneficial-uses`, `Working Knowledge.proficiency`): told before the Maneuver is looked up |
| `"<value>": a Maneuver's movement is changed to \`step\` in this version, as in \`ALTER: <Maneuver>.movement; VALUE: step\` (a drag within half Speed made as part of the Maneuver is then a Step, for everyone who moves in it)` | any value but `step` on `movement` (`VALUE: choose(Move, Step)`) |
| `"<name>" names no Maneuver` / `"<name>" is a Constellation: ALTER changes what a Maneuver gives, as in \`ALTER: Aid.critical-failure; VALUE: nothing\`` | the name before the dot |
| `ALTER says what the property becomes: add \`VALUE: ...\`, as in \`ALTER: Aid.critical-failure; VALUE: nothing\`` / `VALUE: says what the property becomes, as in \`VALUE: nothing\` or \`VALUE: recipient opportunity 2\`` | no `VALUE:`, or an empty one |
| `"<value>": a result is changed to nothing in this version, as in \`ALTER: <Maneuver>.<property>; VALUE: nothing\`` | any value but `nothing` on a result (`VALUE: no-effect`) |
| `ALTER does not take FOR` / `ALTER does not take LIMIT` / `ALTER does not take IF: CLAIM(...)` / `ALTER does not take IFT: TRAIT(...)` | a component `ALTER` has no use for: it takes `VALUE:` and `IF: RANK(...)` alone. An `IF: RESULT(...)` gets the message above: the property names the degree |
| `an alteration changes the owner's own Maneuver and cannot ride an [AURA ...] block; write it as its own \`[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]\`` | an `ALTER` after the ring's semicolon |
| `PERMIT is written on the Maneuver's own row: it is what using that Maneuver lets another creature do` | a `PERMIT` in a Talent's cell or on a custom effect row |
| `a permission is written \`PERMIT: <what>; FOR: <who> [<N>]\`, as in \`PERMIT: move; FOR: allies 0; LIMIT: round\` (<N> descriptors given, 1 wanted: what is permitted)` | no descriptor, or two (`PERMIT: move, ally`: the ally is said with `FOR`) |
| `"<word>": PERMIT permits a move in this version, as in \`PERMIT: move; FOR: allies 0; LIMIT: round\`` | anything but `move` |
| `PERMIT says who may be permitted: add \`FOR: allies 0\` (an adjacent ally), as in \`PERMIT: move; FOR: allies 0; LIMIT: round\`` | no `FOR:` |
| `PERMIT is for another creature (FOR: allies, enemies, all), not "<who>": nobody needs leave at their own Opportunity` | `FOR: self` or `FOR: self+allies` |
| `PERMIT acts when the Maneuver is used, before any roll: \`IF: RANK(roll ...)\` has no roll to read; name a Constellation, as in \`IF: RANK(Origin >= expert)\`` | the rank rolled on a `PERMIT` |
| `PERMIT does not take UNTIL` / `PERMIT does not take VALUE` / `PERMIT does not take IF: CLAIM(...)` / `PERMIT does not take IFT: TRAIT(...)` / `PERMIT does not take IFT: MARKED` | a component `PERMIT` has no use for: it takes `FOR:`, `LIMIT:` and `IF: RANK(...)` alone |
| `a permission is given when its Maneuver is used and cannot ride an [AURA ...] block; write it as its own \`[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]\`` | a `PERMIT` after the ring's semicolon |
| `FOR is written \`FOR: <who> [<N>]\`` / `FOR: self takes no range` | the recipients |
| `LIMIT is written \`LIMIT: round\` or \`LIMIT: encounter\`` | the limit |
| `a who is written self, allies, enemies, all or self+allies` | the FOR subject |
| `a range is written <N>ft, as in 15ft` | the feet |
| `"<word>" is not a Condition or Expose` | the IMMUNE descriptor |
| `"<word>" is not a terrain kind: write Mud, Shallow Water, ...` | a kind not in the Difficult terrain behavior's list |
| `a substitution is written \`USE: <Attribute>, <Constellation>, <Maneuver>\`, as in \`USE: Presence, Origin, aid\`` | a `USE` with no descriptor; with one alone the message ends `(1 descriptor given, 3 wanted)` |
| `USE takes three descriptors, the Attribute, the Constellation and the Maneuver, not <N>: \`USE: Presence, Origin, aid\`` | four descriptors or more |
| `the Attribute is missing: USE takes three descriptors, as in \`USE: same, <first>, <second>\` to keep the check's own Attribute (might, agility, wits or presence names another)` | two descriptors, the first of them no Attribute word |
| `the Constellation is missing: USE takes three descriptors, as in \`USE: <first>, same, <second>\` to keep the check's own Proficiency Bonus` | two descriptors, an Attribute and a Maneuver |
| `a term is missing: USE takes three descriptors, and same twice swaps nothing; name the Attribute, the Constellation, or both, as in \`USE: Presence, same, <Maneuver>\` or \`USE: same, Origin, <Maneuver>\`` | two descriptors, `same` and a Maneuver (`USE: same, aid`): a second `same` would swap nothing |
| `the Maneuver is missing: USE never means every check; name the Maneuver whose check is swapped third, as in \`USE: Presence, Origin, aid\` (write same for a term the check keeps)` | two descriptors, the Attribute and the Constellation: the check was left off; also two descriptors ending in `same`, which the third place never takes |
| `"<descriptor>": the Attribute and the Constellation are two descriptors with a comma between them, as in \`USE: Presence, Origin, aid\`` | a `+` between the two terms, as the Talent's prose has it (`USE: Presence + Origin, aid`) |
| `USE takes no value: it names the terms a check is made with, \`USE: <Attribute>, <Constellation>, <Maneuver>\`, as in \`USE: Presence, Origin, aid\`; a bonus is \`CHECK: 1 condition, aid\`` | a number first (`USE: 1 condition, aid`): `USE` is no modifier tag |
| `"<word>" is not an Attribute: write might, agility, wits or presence, or same to keep the check's own` | the first descriptor of `USE` |
| `\`roll\` is RANK's word; in a USE line write same for a term the check keeps` | `roll` as the first or the second descriptor of `USE` |
| `\`USE: same, same\` swaps nothing: name the Attribute, the Constellation, or both, as in \`USE: Presence, Origin, aid\`` | both terms kept |
| `"<word>": a flat Proficiency Bonus is not read yet; the second descriptor is the Constellation whose Proficiency Bonus is borrowed, or same` | a rank word or a number as the second descriptor (`trained`, `+3`): not built, section 7 |
| `"<word>" is an Attribute, and the first descriptor is where it goes; the second is the Constellation whose Proficiency Bonus is borrowed, or same` | an Attribute word as the second descriptor |
| `"<name>" is not a Constellation: a Maneuver has no Proficiency Bonus to borrow` | a Maneuver as the second descriptor |
| `"<name>" is a group and has no rank of its own; borrow <parent> instead` | a group as the second descriptor (`USE: Presence, Archery, aid`): write the parent |
| `a Lore is the character's own; a substitution cannot borrow it` / `a Lore is the character's own; a substitution cannot name it` | a Lore as the second or the third descriptor |
| `same keeps one of the first two terms; the third descriptor names the Maneuver whose check is swapped, as in \`USE: Presence, Origin, aid\`` | `same` as the third descriptor |
| `"<word>" is a scope word, and USE never means every check: name the Maneuver whose check is swapped, as in \`USE: Presence, Origin, aid\`` | `checks`, `defenses`, `attacks`, `initiative` or `speed` as the third descriptor |
| `"<word>" is a Defense: its Threshold and its roll against an attack are never substituted; name the Maneuver that rolls it` | a Defense as the third descriptor |
| `"<name>" is a Constellation: USE reads a Maneuver's check in this version, as in \`USE: Presence, Origin, aid\`; a Constellation's own checks are not read yet` | a Constellation as the third descriptor: not built, section 7 |
| `USE does not take FOR` / `USE does not take IF: SEEN` / `USE does not take IF: ALLIES(...)` / `USE does not take IFT: <Threat>` / `USE does not take IFT: MARKED` / `USE does not take IF: CLAIM(...)` / `USE does not take IFT: TRAIT(...)` | a component `USE` has no use for: it takes `IF: RANK(...)` and `LIMIT:` alone. `IFT: CHECK(...)` is told `IFT: <Threat>`, and an `IF: RESULT(...)` gets the reroll message above |
| `a substitution is the owner's own roll and cannot ride an [AURA ...] block; write it as its own \`[EFFECT USE: Presence, Origin, aid]\`` | a `USE` after the ring's semicolon in an `[AURA ...]` block |
| `"<name>" is not a Maneuver: a [MANEUVER ...] names a row of data/maneuvers.xlsx` | the Maneuver's row is missing, or (the build) not enabled |
| `"<name>" is not a Constellation` | `[<name> trained]` names no Constellation; the same words answer a `RANK(...)` or the second descriptor of a `USE` that names none |
| `[<name> expert]: a Root is Trained; nothing grants Expert at creation` | only `trained` reads |
| `POINT is written \`[POINT <N> <Scope> [different]]\`` / `"<word>" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet` | the point block |
| `SPEED is written \`[SPEED 6]\` ... or \`[SPEED +1]\`` / `VIGOR is written \`[VIGOR 8]\` ... or \`[VIGOR opening 12]\`` | the chassis blocks |
| `"<word>" is not a Size: write Tiny, Small, Medium, Large, Huge or Gargantuan` | the Size block |
| `AURA is written \`[AURA <N> <who>]\`` | the ring block |
| `[AURA ... visible]: every ring is preview-only and the Auras window shows one; drop the word` | drop `visible` |
| `WARNING: ... TRAIT(<Trait>): no shipping weapon, attack or Talent carries the trait "<Trait>"` | not a failure: the rule reads and fires when something is authored with that trait |
| `WARNING: <workbook>: the _Tree Index columns <list> are retired; the Root's feature lines are the authoring now` | move the facts into the Root's cell as section 2 says, then drop the columns |
| `ERROR: <tree>: the _Tree Index <column> reads <a> but the Root's [<KEYWORD>] says <b>; drop the column` | a retired column and the Root's block disagree |

## 9. Refused since 0.17.0: the 0.13.0 operators

A line in the 0.13.0 shape, `kind: <arg>, <arg>, ... [, <OPERATOR>(...)]`, is refused with one
error naming this section. Its operators, and the component each became:

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
| `VISIBLE` | nothing: every ring is preview-only since 0.17.0 |

And the old kind lines: `bonus: +1, Condition, Aid` is `[EFFECT CHECK: 1 condition, aid]`; `bonus:
+1, Situation, Defenses` is `[EFFECT DEF: 1 situation]`; `bonus: +1, Situation, Attacks` is
`[EFFECT ATK: 1 situation]`; `prevent: Prone` is `[EFFECT IMMUNE: prone]`; `grant: 1, Skill` is
`[POINT Skill]`; `aura: 15ft, allies, VISIBLE` is `[AURA 15 allies]`.

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
  / Off switch and custom effect lines. The 0.13.0 form read one more release with a warning.
- **0.17.0** (2026-11-05): every line in brackets, Mike's question answered in FG's own form: an
  effect line is `[EFFECT ...]`, a bare line in a cell reads one more release with a warning; the
  0.13.0 form refused; `visible` retired from `[AURA ...]`, every ring preview-only until shown;
  this document as the Automation Grammar journal in the Rules compendium with section 0 as its
  first page; claim lines on the Effects tab with Apply to next roll.
- **0.18.0** (2026-11-05): an AURA block carries its effect after a semicolon, the ring as the
  effect's FOR (Mike: the Rally Aura said "15 feet, allies" twice); the bare effect line in a cell
  and the `visible` word refused, as promised; the terrain kinds a roster block (section 3's
  vocabulary is the block's names); a Lore named the moment it is Trained.
- **0.18.1** (2026-11-05): the code review's fixes, no new word. A `]` inside a condition's
  parentheses no longer ends the block; the retired-form test looks for the 0.13.0 operators alone
  (`VISIBLE` and `DIFFERENT` were never a tag line's, and a descriptor ending in one was refused
  for the wrong reason); a mark the resolving client cannot write is relayed to one that can; a
  Skip is spent at the event, never by a render; a ticked claim on a one-roll custom effect spends
  the row too; a removed row takes its armed flag with it; a terrain kind picked on a region brings
  the roster row's cost.
- **0.21.0** (2026-11-10): the `USE` tag and the `substitute` kind, from Mike's Cooperative Instinct
  ("you may use Presence + Origin proficiency in place of the Attribute and proficiency normally
  used for that Aid check") and his own cell, written before the kind existed: `USE: <Attribute>,
  <Constellation>, <Maneuver>`, exactly three descriptors, `same` for a term the check keeps
  (ruling 215). It replaces a check's two base terms and nothing else (216); the rank recorded,
  which every other rule's `RANK(roll ...)` reads, is the rank rolled (217); it is offered in the
  roll dialog, ticked when the whole total is strictly higher, one to a roll (218), only from the
  Maneuver's own Item, and only a Maneuver may be named (219); checks only, characters only (220);
  the `substitutions` hook point, the fifth, defined with the kind (221). A bonus to a Maneuver
  reaches a check rolled with a Defense Constellation from that Maneuver's Item (222). A `USE`
  line has On / Skip / Off on the Effects tab. Fixed on the way, no new word: a roll dialog that
  rebuilt the roll dropped the marks of the boxes the player left ticked (an armed claim was not
  spent, a one-roll custom effect not removed); a kind's own name typed as a line (`substitute:
  ...`) is told its tag rather than "is a feature", a tag typed without its colon is told the
  colon, and a part after a semicolon that has no colon is told that commas separate descriptors.
  The release carries the kind alone: Cooperative Instinct is on Mike's Human sheet in progress,
  and no shipped cell uses `USE` yet.
- **0.22.0** (2026-11-14): the `GIVE` and `ALTER` tags, the `give` and `alter` kinds and the
  `UNTIL:` and `VALUE:` components, from Mike's question about Patient Assistance and Sure
  Assistance ("Do we have automation grammar that allows for this?"). It did not, because Aid's own
  result was prose on the card; so Aid's result is written first, on Aid's row, and the two Talents
  change it. `GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>)` on the
  Maneuver's own row, the first line that holds for a degree its result (ruling 223); the windows
  `giver opportunity`, `recipient opportunity <N>` and `encounter` (224); `ALTER:
  <Maneuver>.<property>; VALUE: <value>` in the shape Mike drafted, six properties read and every
  other refused as not read yet, his `PRESERVE:` dropped because an alteration leaves the rest
  alone (225); given by a button on the card, to a character the giver names, for a Constellation
  named then (226); one pending result of a Maneuver to a recipient, used by the next roll with
  the Constellation and never part of a Threshold (227); the window counted from the press, on the
  result itself (228); the `gives` hook point, the sixth, and the give's three answers as a
  triggered moment (229); the Effects tab's pending results, read-only, the bin the GM's (230).
  `RESULT(...)` is read by `GIVE` as well as `REROLL`. The release carries the kinds alone: Aid's
  row and the two Talents are on Mike's sheets in progress, and no shipped cell uses either tag yet.
- **0.24.0** (2026-11-14): the `PERMIT` tag and the `permit` kind, and `ALTER`'s seventh property,
  `movement`, from Mike's question about Coordinated Footwork ("would you recommend changing the
  effect of this Talent, or programming in the additional automation grammar?"). Neither, until
  Move Together itself was automated; so Move Together is written first, on its own row, and the
  Talent changes it. `PERMIT: move; FOR: allies 0; LIMIT: round` (ruling 239), the ally said with
  the grammar's existing `FOR`; a permitted Move is one drag, in the Opportunity the Maneuver was
  used in, paid by the mover (240); the user pays at the click and their own next drag is that
  Move (241); inside the Maneuver a drag is a Move however short, and `ALTER: <Maneuver>.movement;
  VALUE: step` lets a short one be a Step for both (242); nobody, yourself, a non-ally and a second
  use in the round refuse, the other requirements warn (243); one record on the user, read by the
  other client, no copy and no relay (244). No new hook point: `permit` answers `use`, whose
  answer may now carry warnings and a LIMIT to file. The release carries the kind alone: Move
  Together's row and the Talent are on Mike's sheets in progress.
