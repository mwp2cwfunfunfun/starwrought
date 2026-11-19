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
| `[REACH 2]`, `[REACH +1]` | Natural Reach in feet, or an adjustment to it | 2 |
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
| `[REQUIRES prone or supine]` | on a Maneuver's own row: what the Maneuver needs before it can be used; the Maneuvers tab lists the row only while it holds | 2 |
| `[REQUIRES effect Taking Cover]` | ... you have a named Effect, anything on you that is no Condition (0.31.0) | 2 |
| `[REQUIRES bind, neutral]` | ... you are in a Bind in that state: `neutral`, `controlling`, `controlled` (0.31.0) | 2 |
| `[REQUIRES creature adjacent with dying]` | ... a creature that near has a Condition, or `with effect <Name>` a named Effect (0.31.0) | 2 |
| `[CHECK Athletics vs Guard]` | on a Maneuver's own row: the check the Maneuver rolls, and the Defense it is read against (0.34.0) | 2 |
| `[CHECK Athletics or Acrobatics vs Evade or Guard]` | ... `or` is a choice, made by whoever it affects: left of `vs` the one using the Maneuver, right of it the target | 2 |
| `[CHECK relevant]`, `[CHECK Crafting vs 15]` | ... any Constellation, picked when it is rolled; a Threshold the row names | 2 |
| `[EFFECT CHECK: 1 condition, aid]` | a bonus to checks of a Constellation or Maneuver (none named: every check) | 3 |
| `[EFFECT ATK: 1 condition]` | a bonus to every Strike and Cast | 3 |
| `[EFFECT DEF: 1 situation, guard]` | a bonus to a Defense (none named: all four) | 3 |
| `[EFFECT INIT: 1 situation]` | a bonus to Initiative | 3 |
| `[EFFECT SPEED: 1 situation]` | feet on a Move | 3 |
| `[EFFECT IMMUNE: prone]`, `[EFFECT IMMUNE: expose]` | a Condition, or an Expose, does not land | 3 |
| `[EFFECT IMMUNE: TRAIT(Visual)]` | on a Condition's row: whoever has the Condition is immune to anything with the trait (0.35.0) | 4, 11 |
| `[EFFECT MARK: enemies]` | using it names one creature | 3 |
| `[EFFECT REROLL: diplomacy]` | the card of a matching roll offers the die again | 3 |
| `[EFFECT IGNORE: terrain, mud]` | difficult terrain of those kinds costs nothing | 3 |
| `[EFFECT USE: Presence, Origin, aid]` | a check made from that Maneuver may be rolled with that Attribute and that Constellation's Proficiency Bonus in place of its own (`same` keeps a term) | 3 |
| `[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]` | on a Maneuver's own row: that result of its check gives another character a bonus (or a penalty) on its next roll with a Constellation, named when it is given (`chosen`) or by the line | 3 |
| `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]` | on a Talent: one property of that Maneuver is changed (a result to nothing, a window with `Aid.beneficial-duration`, its movement to a Step with `Move Together.movement; VALUE: step`, or how often it may be used with `Pay It Forward.limit; VALUE: round`) | 3 |
| `[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]` | on a Maneuver's own row: using it lets the adjacent ally you target make one Move now, outside its Opportunity, once a round | 3 |
| `[EFFECT SUBORDINATE: Aid; LIMIT: encounter]` | on a Maneuver's own row: using it performs that Maneuver as part of it, at this row's own cost and never the other's (the Subordinate Maneuver rule) | 3 |
| `[EFFECT APPLY: prone, target; IF: RESULT(success)]` | on a Maneuver's own row: that result of its check puts a Condition or a named Effect on the creature it was used on, by a button on the card (0.32.0) | 3 |
| `[EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]` | ... or on yourself, at once, for a time | 3 |
| `[EFFECT APPLY: Taking Cover]` | ... or whenever the Maneuver is used, when no result is named | 3 |
| `[EFFECT REMOVE: prone]` | on a Maneuver's own row: using it takes the Condition or the named Effect off (0.32.0) | 3 |
| `[EFFECT DEF: -N condition]` | on a **Condition's own row** of `data/conditions.xlsx`: what the Condition does to whoever has it, with `N` for its own value (Frightened 2 is -2). A Condition's row reads `CHECK`, `ATK`, `DEF` and `INIT` (0.33.0) | 11 |
| `; UNTIL: recipient opportunity 2` | ... a GIVE's window: `giver opportunity` (the default), `recipient opportunity <N>`, `encounter`. After APPLY, how long the Effect lasts, with `end` or `start` for the edge | 3 |
| `; VALUE: nothing` | ... what an ALTER's property becomes | 3 |
| `; IF: RANK(Origin >= trained)` | ... while the owner's rank is at least that | 3 |
| `; IF: RANK(roll = untrained)` | ... while the rank the roll is made at is that (the borrowed Constellation's when a `USE` stands; on a `USE` line itself, the check's own rank before the swap) | 3 |
| `; IF: SEEN` | ... for a recipient who can see the owner | 3 |
| `; IF: ALLIES(>=1, 0)` | ... while that many allies stand within the range (`ENEMIES`, `ALL`) | 3 |
| `; IF: CLAIM(when trading)` | ... when the player says so (a checkbox in the roll dialog, or Apply to next roll) | 3 |
| `; IF: RESULT(critical failure)` | ... on that degree (REROLL, GIVE, APPLY and REMOVE only) | 3 |
| `; IF: COST(2)` | ... when the Maneuver was paid for with that many actions (APPLY and REMOVE only; 0.32.0) | 3 |
| `; IF: EFFECT(Aid, used)` | ... once a roll of yours at your own Opportunity has used up a bonus another creature's Aid gave you (SUBORDINATE only) | 3 |
| `; IF: EFFECT(Taking Cover)` | ... while YOU have that Condition or named Effect (CHECK, ATK, DEF, INIT and SPEED lines; 0.31.0) | 3 |
| `; IFT: EFFECT(prone)` | ... while the roll's OTHER PARTY has that Condition or named Effect (the same lines; 0.31.0) | 3 |
| `; IFT: EFFECT(wrong-footed, mine)` | ... and only when YOU put it there with a Maneuver's APPLY (0.32.0) | 3 |
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
- **`N/A` means the row needs no automation** (0.26.1). Type it alone in the cell of a Talent or a
  Maneuver you have looked at and decided needs none. It is no rule and no error: the pipeline
  treats the cell as empty, the Foundry Item's Automation box stays empty, and the red-cell tool
  never paints it and counts it apart, so a blank cell is one you have not reached yet and an
  `N/A` cell is one you have. `n/a`, `NA`, `N.A.`, `None` and a lone dash read the same, with or
  without brackets (`[N/A]`). It is the whole line: `N/A` inside a block (`[EFFECT N/A]`) is a
  mistyped effect and is still refused. A cell that says `N/A` and also carries rules is warned
  about, and the rules are what the build uses.
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
| `[REACH 2]` | Natural Reach in feet, an Ancestry's own, written on its Root (0.30.0); `[REACH +1]` or `[REACH -1]` on any Talent adjusts it. With no block, Natural Reach comes from Size | `reach` |
| `[VIGOR 8]` | Vigor per level (the Ancestry's); `[VIGOR opening 12]` a Calling's Opening Vigor | `vigor` |
| `[SENSES Low-light vision]` | a sense, added to the list | `sense` |
| `[LANGUAGE Common, Serrovine]` | languages known, comma separated | `language` |
| `[Acrobatics trained]` | a Trained Root in that Constellation at creation, FG's own form for a proficiency: one directed Talent Point that buys the Root (a Background's, a Calling's). `[Lore trained]` lets the player name the Lore. Only `trained` reads: nothing grants a higher rank at creation | `grant` |
| `[POINT Skill]` | a Talent Point at creation, by scope: `Opening` (a Root of a Constellation not yet opened), `Calling`, `Skill` (a Lore included), `Lore`, `Defense`, `Combat Style`, `Comet` (anywhere you qualify); `[POINT 2 Skill different]` is two points in different Constellations | `grant` |
| `[MANEUVER Steady the Line]` | the Maneuver of that name, a row of `data/actions_maneuvers.xlsx`, is the character's: copied onto the sheet when the Talent lands, listed under "From your Talents", used from there, gone with the Talent. The row's own Cost and Automation are the Maneuver's | `maneuver` |
| `[TALENT Weapon Familiarity]` | a Talent handed over free, no point spent (the Free Talent column's successor) | `talent` |
| `[CHOICE Weapon Group]` | a build-time pick the Talent demands (the Choice column's successor) | `choice` |
| `[AURA 15 allies]` | the ring on the map: range in feet, whom it is about (`allies`, `enemies`, `all`). Every ring is preview-only until its owner shows it from the Auras window (0.17.0; the old `visible` word is refused) | `aura` |
| `[AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]` | the ring **carrying its effect** (0.18.0): after the semicolon, one effect line (section 3) whose `FOR` is the ring, so "15 feet, allies" is said once; a `FOR:` inside the block is refused. Stored as two rules, the ring and the effect. A second effect on the same ring is a second block with the same range and audience, drawn once; two rings on one Talent draw the first | `aura`, and the effect's kind |
| `[REQUIRES prone or supine]` | on a **Maneuver's own row**: what the Maneuver needs before it can be used (0.28.0). The Maneuvers tab lists the row only while every block on it holds; `or` inside a block gives alternatives, `not` turns a word round, and a second block is a condition that must also hold. The words are in section 4 | `requires` |
| `[CHECK Athletics vs Evade or Guard]` | on a **Maneuver's own row**: the check the Maneuver rolls (0.34.0). Left of `vs`, what is rolled: a Constellation, several joined by `or` (the user's own pick), or `relevant`. Right of it, what the roll is read against: a Defense, several joined by `or` (the target's pick), or a number. With no `vs` the Threshold is typed when it is rolled. The forms are in section 4. `CHECK:` with a colon, inside `[EFFECT ...]`, is a different thing: a bonus to checks (section 3) | `check` |
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
other tags (`IMMUNE`, `MARK`, `REROLL`, `IGNORE`, `USE`, `ALTER`, `PERMIT`, `SUBORDINATE`, `APPLY`,
`REMOVE`) take descriptors alone; `USE` takes exactly three, `ALTER`, `PERMIT` and `SUBORDINATE`
exactly one, `APPLY` and `REMOVE` one or two, and never a value or a type. No bonus is untyped.

| tag | modifies | descriptor | stored kind |
|---|---|---|---|
| `CHECK: 2 condition, diplomacy` | checks of a Constellation or made from a Maneuver (`CHECK: 1 condition, aid`); with no descriptor every check (an Initiative rolled with a Constellation is a check in it, ruling 111) | a Constellation or a Maneuver by name; a Lore is refused | `bonus` |
| `ATK: 1 condition` | every Strike and Cast | none | `bonus` |
| `DEF: 1 situation, guard` | a Defense's roll and Threshold; with no descriptor all four | `evade`, `guard`, `endure`, `awareness` | `bonus` |
| `INIT: 1 situation` | Initiative | none | `bonus` |
| `SPEED: 1 situation` | feet on a Move (not a Step, a Rush or a Leap) | none | `bonus` |
| `IMMUNE: prone` | the Condition does not land; `IMMUNE: expose` a Zone a Stop would Expose stays closed (FG's own `IMMUNE: [condition]`) | a Condition by name, or `expose`; on a Condition's row, `TRAIT(<Trait>)` (0.35.0, section 4) | `prevent` |
| `MARK: enemies` | using the Talent or Maneuver names one creature, the player's target, until the encounter ends; `enemies` or `all` | who may be named | `mark` |
| `REROLL: diplomacy` | the card of a matching roll offers to throw the die again; no descriptor means any check | a Constellation | `reroll` |
| `IGNORE: terrain, mud, decking` | difficult terrain of those kinds costs nothing; `IGNORE: terrain` alone every kind | `terrain`, then kinds | `ignore` |
| `USE: Presence, Origin, aid` | the two base terms of a check made from a Maneuver's own Item, written `USE: <Attribute>, <Constellation>, <Maneuver>`: the Attribute Bonus and the Proficiency Bonus are the named Attribute's and the named Constellation's in place of the check's own, offered in the roll dialog; nothing else on the roll changes (0.21.0) | exactly three: an Attribute or `same`, a Constellation or `same`, then a Maneuver by name | `substitute` |
| `GIVE: 1 situation, chosen` | what a result of this Maneuver's check gives ANOTHER character: a bonus or penalty on that character's next roll with a Constellation. Written on the Maneuver's own row, one line for each degree that gives something, each with `IF: RESULT(<degree>)` (0.22.0) | exactly one: `chosen` (the Constellation is named when the result is given) or a Constellation by name | `give` |
| `ALTER: Aid.critical-failure` | one property of a Maneuver, changed by a Talent: `ALTER: <Maneuver>.<property>; VALUE: <value>`. The properties read are in the Property vocabulary below (0.22.0; `movement` since 0.24.0, `limit` since 0.25.0) | exactly one: the Maneuver by name, a dot, the property | `alter` |
| `PERMIT: move` | using this Maneuver lets the creature you target make one Move now, outside its Opportunity, paying for it itself; your own next drag is the Maneuver's Move, already paid. Written on the Maneuver's own row, with `FOR:` saying who may be permitted and how near (`FOR: allies 0` is an adjacent ally) and `LIMIT:` its Frequency (0.24.0) | exactly one: what is permitted (`move`) | `permit` |
| `SUBORDINATE: Aid` | using this Maneuver performs the named Maneuver as part of it. The named Maneuver keeps its own check, results and requirements; its own cost is never charged, and the cost printed on THIS row is the only one paid (the Subordinate Maneuver rule, below). Written on the Maneuver's own row, with `IF: EFFECT(<name>, used)` its trigger when it has one and `LIMIT:` its Frequency (0.25.0) | exactly one: the Maneuver performed, by name | `subordinate` |
| `APPLY: prone, target` | using this Maneuver puts a Condition or a named Effect on a creature: `APPLY: <Effect>[, self \| target]`. With `IF: RESULT(<degree>)` on that result of its check, with none whenever it is used; `UNTIL:` says how long. On yourself it lands at once; on a target by a button on the card. Written on the Maneuver's own row (0.32.0) | the Effect (a Condition, `frightened 2` for one with a value, or a name of your own), then `self` (the default) or `target` | `apply` |
| `REMOVE: prone` | using this Maneuver takes a Condition or a named Effect off a creature: `REMOVE: <Effect>[, self \| target]`, with the same `IF:` components and no `UNTIL:`. Written on the Maneuver's own row (0.32.0) | the Effect, then `self` (the default) or `target` | `apply` |

**The Subordinate Maneuver rule** (Mike, 2026-11-15; ruling 245). When a Maneuver says to perform
another Maneuver as part of it, the other is done at the first Maneuver's listed cost: it costs no
additional actions, unless the row says otherwise. So an Aid made as part of Pay It Forward ⓿ costs
nothing, whatever Aid's own row prints. Everything else about the subordinate Maneuver stands: its
check, its results, its requirements. No row says otherwise yet, so the grammar has no word for an
extra cost; one comes with the first row that charges it.

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
| `UNTIL: recipient opportunity 2` | after `GIVE`: the window in which the result may be used (the Window vocabulary below); with none, `giver opportunity`. After `APPLY` (0.32.0): how long the Effect stays, where the window may also name its edge (`giver opportunity end`, `recipient opportunity start`); with none the Effect stays until something takes it off. Every other tag refuses it by name, `REMOVE` included |
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
| `RESULT(critical failure)` | the roll's degree: `critical success`, `success`, `failure`, `critical failure`. Only `REROLL` (the degree that offers the die again), `GIVE` (the degree that gives the result) and `APPLY` and `REMOVE` (the degree that puts the Effect on, or takes it off) read it | `IF:` |
| `COST(2)` | the number of actions the Maneuver was paid with (0.32.0; ruling 318), for a row that prints a table of results for each cost (Trip, Grapple, Demoralize). 0 to 12. Only `APPLY` and `REMOVE` read it. Where nothing is paid (outside an encounter, or with action tracking off) a row with one cost reads that cost, and a row with a range asks which version this use is | `IF:` |
| `EFFECT(Aid, used)` | a used Effect (0.25.0): a roll of yours, made at your own Opportunity that is still running, has used up the Effect of that name, and it was a bonus another creature gave you. The name is the Maneuver whose result it was. Only `SUBORDINATE` reads it, and only after `IF:` | `IF:` |
| `EFFECT(Taking Cover)`, `EFFECT(prone)` | a creature HAS it now (0.31.0): a Condition by its name, or a named Effect, anything on the creature that is no Condition (the Effects list, below). **The prefix says whose: `IF:` is the creature rolling, `IFT:` the roll's other party.** A line may hold one of each. Only the `bonus` lines read it (CHECK, ATK, DEF, INIT, SPEED), and not beside a `FOR` that reaches others, an aura's ring included. After `IFT:` it is refused on an INIT or a SPEED line (neither has another party) and beside `IF: CLAIM(...)` (a claim is asked before the other party is known) | `IF:` or `IFT:` |
| `EFFECT(wrong-footed, mine)` | the same, narrowed to an Effect that the creature rolling put there with a Maneuver's `APPLY` (0.32.0; ruling 319): "Wrong-Footed to you". An Effect put on by any other means (a GM's hand, a Critical Hit, another creature's Maneuver) is not yours. Read after either prefix, by the same lines | `IFT:` |
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

After `UNTIL:` on an `APPLY` line (0.32.0) the same words say how long the Effect stays on the
creature, and the window may name its edge, which a `GIVE` window never does:

| window | the Effect stays |
|---|---|
| `giver opportunity` | until the next Opportunity of the creature that used the Maneuver BEGINS ("until your next Opportunity") |
| `giver opportunity end` | through the END of that creature's next Opportunity ("until the end of your next Opportunity") |
| `recipient opportunity` | through the END of the next Opportunity of the creature the Effect is on |
| `recipient opportunity start` | until that creature's next Opportunity BEGINS |
| `giver opportunity 2`, `recipient opportunity 2 start` | the same, counting to the second |
| `encounter` | until the encounter ends |
| no `UNTIL:` | until something takes it off: a `REMOVE` line, or a hand |

An Opportunity already running when the Effect is applied is never the one counted. A window is
counted in an encounter, so a line with `UNTIL:` is not applied outside one, and its card says so
(ruling 316). `start` may also be written `begin`.

**Property** (0.22.0). What an `ALTER` may change of the results a Maneuver gives, after the dot:
`duration` (every result's window), `beneficial-duration` (the window of the results that give a
bonus, so a penalty keeps its own), and the four results by degree, `critical-success`, `success`,
`failure`, `critical-failure`, each of which is changed to `nothing`. Since 0.24.0 one more, which
is not about what the Maneuver gives: `movement`, changed to `step`, so that a drag within half
Speed made as part of the Maneuver is a Step for everyone who moves in it (Coordinated Footwork, of
Move Together). Since 0.25.0 another: `limit`, changed to `round` or `encounter`, which replaces the
`LIMIT:` on the Maneuver's own row (Reciprocal Effort, of Pay It Forward: once a round in place of
once an encounter); it never adds a use, and a row with no `LIMIT:` stays unlimited. Any other
property is refused as not read yet. Where two lines change one Maneuver, `beneficial-duration`
stands over `duration` in either order, and of two changes to one property the later stands.

**The Effects list** (0.31.0; rulings 305 to 310). Mike, 2026-11-17: "assuming each Actor has an
Effects list of whatever effects they have, conditions, etc., REQUIRES should just look for a
string in that Effects list." A creature's Effects are two things, and nothing new is stored for
either:

- **Its Conditions.** Every Condition is an effect on the creature, and so are the Bind's three
  states (`bound` for a neutral Bind, `controlling`, `controlled`), Preparing, Spent, Wounded and
  Dying. A line names one by the book's name; spaces, hyphens and case do not matter.
- **Its named Effects:** every other active effect on it, by its name. The GM (or the player, on
  their own sheet) adds one on the Effects tab with the plus beside "Active Effects" and names it
  ("Blessed"); the tag beside it says how a line reads it, `EFFECT(Blessed)`. A character's custom
  effect rows count too, by their label. An effect that is switched off counts for nothing. A
  name is letters, digits, spaces, hyphens and apostrophes, and case and spacing do not matter
  when it is read. An effect named with anything else ("Blessed!", "Cover, Greater") is on no
  list, since no line could write its name, and its tag says "not read".

A Condition's name is reserved: `EFFECT(prone)` is always the Condition, so an effect that is only
CALLED "Prone" is read by nothing, and its tag says so. An Exposed Zone is the Zone's own and is
not read as an Effect.

Three lines read the list: `[REQUIRES ...]` on a Maneuver's row (section 4), and `IF: EFFECT(...)`
and `IFT: EFFECT(...)` on a bonus line (the table above). A rule reads a named Effect off any
creature. The hover card shows one made by hand to the creature's owner and the GM alone (a GM
may keep a private note as an effect on an adversary); one a Maneuver applies (0.32.0) shows to
everyone, as a Condition does (rulings 309 and 320).

What the name may not be: `not` in front (it turns a whole condition round: `[REQUIRES not effect
Blessed]`; a bonus line has no `not` yet); a Condition with a number (`Fatigued 2`: a value is
not compared, so write `fatigued`); `or` or `and` as a word. The Off-Guard a first Torso Wound
makes lasting is a number on the Defenses and not the Condition, so `EFFECT(off-guard)` does not
see it.

**Three things are called an effect, and a line reads only the first by `EFFECT(<name>)`:**

| what | where it shows | read by |
|---|---|---|
| a Condition or a named Effect ON a creature, put there by a hand, by the system or by a Maneuver's `APPLY` | the token, the hover card, the Effects tab's Active Effects (an applied one wears an Applied tag) | `EFFECT(<name>)`, `[REQUIRES <condition>]`, `[REQUIRES effect <Name>]` |
| a pending result ("Aid from Wren") and a used Effect ("Aid from Wren (used)") | the Effects tab's Pending results | the next roll with its Constellation; `EFFECT(Aid, used)` on a `SUBORDINATE` line |
| a line of Automation (an `[EFFECT ...]` block on a Talent, or a custom effect row's lines) | the Effects tab's rule lines, with On, Skip, Off | nothing reads a line; a line reads the roll |

So `EFFECT(Aid)` does not see a pending "Aid from Wren"; a custom effect row LABELLED "Rage" is the
named Effect Rage, whatever its lines say.

**Named Effect** (0.25.0, step one; 0.31.0, the reading half of step two; 0.32.0, the writing half). Mike, 2026-11-15, after
Fantasy Grounds: "using a Maneuver can grant a custom Effect on a target (with a specific
duration), and other modifiers/effects can be applied IF that custom Effect field is on the
target." Step one is an Effect the SYSTEM leaves: when a roll of yours uses up a bonus another
creature's Maneuver gave you, at your own Opportunity, you hold an Effect named for that result
with "(used)" after it (**Aid from Wren (used)**) until that Opportunity ends, listed on the
Effects tab under Pending results. `IF: EFFECT(<Maneuver>, used)` reads it. A penalty a roll
swallowed, a roll on another fighter's Opportunity, an Initiative, and a result the GM binned or
whose window closed leave nothing. Since 0.31.0 a bonus line reads an Effect a creature has
(`IF: EFFECT(<name>)`, `IFT: EFFECT(<name>)`). Since 0.32.0 a Maneuver puts one on (`APPLY`) and
takes one off (`REMOVE`), with a window, and `EFFECT(<name>, mine)` asks whether you were the one
who put it there (section 4, `apply`).

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

**Immunity to a trait (0.35.0; rulings 350 to 360).** Mike, of the Blinded Condition: "We already
have [IMMUNE] in automation grammar, so should we extend it to allow for adding of Traits in
there?" On a Condition's row of `data/conditions.xlsx`:

```
[EFFECT IMMUNE: TRAIT(Visual)]        Blinded
[EFFECT IMMUNE: TRAIT(Auditory)]      Deafened
```

Whoever has the Condition is immune to anything that carries the trait. A trait is always written
`TRAIT(...)`, as after `IFT:`; a Condition after `IMMUNE:` stays a bare word, so the two can never
be confused.

- **One trait to a line, named by one word.** Two immunities are two lines. The word is the
  trait's first word, without its value: `TRAIT(Reach)`, never `TRAIT(Reach 5)`.
- **Nothing after it.** No `IF:`, `FOR:` or `LIMIT:`: the line acts for whoever has the Condition,
  as a row's other lines do, so it asks nothing about an owner and every client answers the same.
- **Read on a Condition's row alone, for now.** On a Talent, a Maneuver or a custom effect it is
  refused and says so. A Talent's immunity to a trait comes with the first Talent that asks for it.
- **A Condition's name is not read there yet.** `[EFFECT IMMUNE: frightened]` on a row is refused:
  a Condition that another one counts as would still count, which is half a rule.

**How a thing's traits are read** (ruling 357). Only the first word of a trait is compared
(`Reach 5` is `reach`), as everywhere.

- **Separate traits** are each a way the thing works. Calm Animal is Auditory and Visual: a
  creature immune to either one is immune to it.
- **One trait written with `or`** is alternatives. Captivate's is "Auditory or Visual": it works
  through either sense, so a creature is immune only when it is immune to both. A Blinded creature
  that can hear is still Captivated.
- **A Maneuver performed as part of another** carries its parent's traits too: No Quarter is
  Visual, and performs Demoralize.

**What it does in play.** The system says it and goes on (Mike): nothing is refused, the use is
made and paid for, and nothing lands on the immune creature.

- **A Maneuver with the trait, used on the creature.** The roll window says so before the roll
  ("Bandit is immune to Visual effects (Blinded). Nothing this does lands on Bandit."), and so do
  the check card and a request card. The roll is made as always, and what it puts on the roller
  still lands. Pressing "Apply to Bandit" applies nothing: a small card says why, and the button
  gives way. A result that would be given to an immune ally is refused, with the reason.
- **An attack or a spell with the trait.** The defender commits a Defense and the dice are rolled
  as for any attack. The result card says the defender is immune and offers no damage to roll.
  Everything else stands as rolled, the attacker's own side included (a Zone Exposed on a Miss, a
  Bind).
- **Judged when a thing would land** (ruling 358): each card asks as it is posted, a reroll's
  card among them, and the write asks again. A creature Blinded after the roll and before the
  button is immune; one cured in between is not.
- **There is no override.** While the creature has the Condition, Apply applies nothing however
  often it is pressed. If the table rules that it is affected after all, take the Condition off,
  press Apply, and put it back. If it was cured after the small "immune" card was posted, delete
  that card and the Apply button comes back.
- **A Condition held against one creature alone** (an `against X` inclusion) makes its holder
  immune to that creature's things and nobody else's.

**Not read:** a Maneuver whose whole use is a `MARK`, a `PERMIT` or a `SUBORDINATE` line (Command
the Field still lets a Deafened ally Move); another creature's aura or bonus whose carrier has the
trait; damage applied by hand from a damage card; a defender marked immune before it commits a
Defense (it still pays for a Parry); and what a Blinded or Deafened creature itself cannot do.

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
[EFFECT ALTER: Pay It Forward.limit; VALUE: round]                          Reciprocal Effort
```

- **One descriptor**: the Maneuver by the name the action sheets print, a dot, the property
  (section 3, Property). Case, spaces and a Maneuver's cost glyphs do not matter.
- **`VALUE:`** says what the property becomes: a window for `duration` and `beneficial-duration`,
  the word `nothing` for a result, the word `step` for `movement`, `round` or `encounter` for
  `limit`. It is read after `ALTER` alone.
- **`limit`** (0.25.0; ruling 250) is how often the Maneuver may be used, from Reciprocal Effort
  (Mike's draft: "You may use Pay It Forward once per round instead of once per encounter"). It
  REPLACES the `LIMIT:` on the Maneuver's own row and never adds a use, so a use is counted by the
  round in place of the encounter, and a row with no `LIMIT:` stays unlimited. Like `movement` it
  is read when the Maneuver is USED, by `subordinate` and `permit` alike, so Move Together's
  `LIMIT: round` can be altered the same way. Mike's drafted value, `owner round`, is told to
  write `round`: a limit is always its owner's.
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
  A `limit` line is read the same way: on Skip the row's own limit stands that once.

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
- **`LIMIT: round`** (or `encounter`) is the Maneuver's Frequency. A Talent's `ALTER:
  <Maneuver>.limit` replaces it (0.25.0; see `alter`).
- **`IF: RANK(...)`** reads the owner's rank. `RANK(roll ...)` is refused: there is no roll.

Written on a Maneuver's own row and nowhere else, as `GIVE` is. Refused by name: `UNTIL`,
`VALUE`, `IF: CLAIM(...)`, `IF: RESULT(...)`, `IF: EFFECT(...)`, every condition about the other
party, and a `PERMIT` after the ring of an `[AURA ...]` block.

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

### `subordinate`
Using this Maneuver performs another Maneuver as part of it (0.25.0; rulings 245 to 251). Made by
`[EFFECT SUBORDINATE: ...]` on a Maneuver's own row. The rule behind it is Mike's (2026-11-15):
"any time a maneuver says to perform another maneuver as part of it, it is at the original
maneuver's listed cost (i.e. costs 0 additional actions) unless otherwise specified" (section 3,
the Subordinate Maneuver rule). The first row is the Human's Pay It Forward ⓿ (his draft):
"Requirements You are acting at your own Opportunity and have just finished a check that consumed
a beneficial Aid result from another creature. Effect Immediately after that check resolves, Aid
one other willing ally as a ⓿ Maneuver. Make the normal Aid check and meet its normal requirements.
You cannot target yourself."

```
[EFFECT SUBORDINATE: <Maneuver>; IF: EFFECT(<name>, used); LIMIT: round | encounter; IF: RANK(...)]

[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter]          Pay It Forward ⓿
```

- **One descriptor**, the Maneuver performed, by the name the action sheets print. A Constellation
  and the row's own Maneuver are refused.
- **`IF: EFFECT(<name>, used)`** is the trigger, when the row has one (section 3, Named Effect): a
  roll of yours at your own Opportunity, still running, has used up a bonus another creature's
  Maneuver of that name gave you. A row with no trigger is performed whenever it is used.
- **`LIMIT: encounter`** (or `round`) is the Maneuver's Frequency, which a Talent's `ALTER:
  <Maneuver>.limit` replaces (Reciprocal Effort).
- **`IF: RANK(...)`** reads the owner's rank. `RANK(roll ...)` is refused: the row has no roll of
  its own.

Written on a Maneuver's own row and nowhere else, as `GIVE` and `PERMIT` are. Refused by name:
`FOR`, `UNTIL`, `VALUE`, `IF: CLAIM(...)`, `IF: RESULT(...)`, every condition about the other
party, and a `SUBORDINATE` after the ring of an `[AURA ...]` block.

**As read:** `performs Aid as part of this Maneuver, at this Maneuver's own cost, once a roll of
yours at this Opportunity has used up Aid, once an encounter`.

In play, in an encounter:

- **Two doors, one path** (ruling 251). The Maneuver's row shows the Use control, and the card of
  the roll that used the bonus up shows a button for the roller's owner and the GM ("Pay It Forward
  ⓿: Aid"), on a check's card, a Strike's or a Cast's, or a Defense roll's. Only the card of the
  roll that used THAT bonus up shows it: an older card that used another Aid does not. The button
  does what the row does, and it goes when the Maneuver is used or the Opportunity ends. A Strike
  at three defenders posts three cards and three buttons; the limit refuses the rest.
- **What is performed is the subordinate Maneuver's own use** (ruling 246): for Aid, the Relevant
  Check picker, the roll dialog with whatever your Talents put on an Aid (Cooperative Instinct's
  swap, Humanity's bonus), and Aid's card with its Give button. The card says "As part of Pay It
  Forward ⓿". Pay It Forward posts no card of its own.
- **The cost is this row's and never the subordinate's** (ruling 245): Aid's ❶ is not charged.
  A row that printed ❷ would pay ❷, once, when the subordinate's roll is made.
- **Nothing is spent until that roll is made.** A roll dialog that is closed has paid nothing, has
  not used the limit and has left the used Effect where it was. Once rolled, the limit is filed
  and the used Effect is spent: one bonus used, one Pay It Forward.
- **Refused, with a notice** (Mike: "Refuse"): the trigger does not hold (no roll of yours at this
  Opportunity used up another creature's bonus; a result you still carry does not count), a
  second use within the limit, and a rank the line asks for that you have not reached. Off-turn
  the refusal comes first: the GM is not asked for leave the Maneuver could not use.
- **"Immediately after that check"** is read as the rest of that Opportunity (ruling 248): the
  system cannot tell what else was done in between.
- **Who is Aided** is chosen on Aid's own card, as for any Aid. You cannot pick yourself; you may
  pick the creature whose Aid you used (Mike: "Anyone but you").
- **Outside an encounter**, and in a Combat you are no part of, the Maneuver is performed and
  nothing is asked or counted. No button is offered there.
- **On / Skip / Off** on the Effects tab: Off, the click only shows the Maneuver's card; Skip on
  the `SUBORDINATE` line itself is read as On, as for every line that acts on use.

What this version does not perform, each told so with nothing spent: a subordinate that is a
built-in (Recenter, Raise a Shield, the visor, Pass), one the system pays another way (a Strike, a
Cast, a Move, a Step, a Leap), a parent row whose own cost is three or more (it would be Prepared),
a second `SUBORDINATE` line on one row, and a subordinate that names a subordinate of its own.

### `apply`
Using this Maneuver puts a Condition or a named Effect on a creature, or takes one off (0.32.0;
rulings 311 to 321). Made by `[EFFECT APPLY: ...]` and `[EFFECT REMOVE: ...]` on a Maneuver's own
row: two tags, one kind. This is the writing half of named Effects (Mike, 2026-11-15: "using a
Maneuver can grant a custom Effect on a target (with a specific duration)"; and 2026-11-17, by
question: the tags are APPLY and REMOVE, and an Effect on yourself lands at once while one on
another creature is a button on the card).

```
[EFFECT APPLY: <Effect>[, self | target]; UNTIL: <window>; IF: RESULT(<degree>); IF: COST(<n>)]
[EFFECT REMOVE: <Effect>[, self | target]; IF: RESULT(<degree>); IF: COST(<n>)]

[EFFECT APPLY: prone, target; IF: RESULT(success)]                                  Trip
[EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]   an overcommit
[EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]     Demoralize ❶
[EFFECT APPLY: Taking Cover]                                                        Take Cover
[EFFECT REMOVE: prone]                                                              Stand
```

- **The Effect** is a Condition by its name, or any other name, which is a named Effect (section 3,
  the Effects list). A Condition that carries a value takes a number, `frightened 2`, and is 1
  with none. A named Effect's name is letters, digits, spaces, hyphens and apostrophes, in the
  casing you want it shown in.
- **Who** is `self` (the default: the creature using the Maneuver) or `target` (the one creature
  it is used on).
- **`IF: RESULT(<degree>)`**: on that result of the Maneuver's check, one line for each degree. A
  row may hold several lines for one degree. With none, the line stands whenever the Maneuver is
  used.
- **`IF: COST(<n>)`**: only when the Maneuver was paid for with that many actions.
- **`UNTIL:`** on an APPLY line: how long (section 3, Window). With none, until something takes
  it off.
- **`IF: RANK(...)`** reads the owner's rank, and `RANK(roll ...)` the rank rolled.

Written on a Maneuver's own row and nowhere else, as `GIVE` is. Refused, each by its message:

- **The Conditions the system itself runs**: `bound`, `controlling`, `controlled`, `wounded`,
  `dying`, `dead`, `spent`, `preparing`, and an Exposed Zone. They follow what happens to the
  creature.
- **`UNTIL:` beside a Condition with a value** (ruling 317): Frightened and the like move by
  their own rule. And `UNTIL:` after `REMOVE`.
- **A `target` line with no `IF: RESULT(...)`** (ruling 321): a target's Effect lands from the
  card of the Maneuver's check, and a Maneuver with no check has no such card.
- **A number after a Condition with no value** (`prone 2`), and a number after `REMOVE`.
- `FOR`, `LIMIT`, `VALUE`, `IF: CLAIM(...)`, `IF: EFFECT(...)`, `IF: SEEN`, every condition about
  the other party, and an APPLY after the ring of an `[AURA ...]` block.

**As read:** `puts Prone on the target, on a Success`; `puts Off-Guard on you until your next
Opportunity, on a Critical Failure`; `puts Frightened 2 on the target, on a Critical Success, when
1 action is paid`; `takes Prone off you`.

In play:

- **On yourself it lands at once** (ruling 312). A Maneuver with no check applies its lines as it
  is used, once its cost is paid, and says so on its own card ("Tess is no longer Prone."). A
  Maneuver with a check applies your own lines for the degree rolled as its card is posted, and a
  small card under it says what landed.
- **On another creature it is a button on the card**, for the roller's owner and the GM: "Apply
  to Bandit: Prone". The creature is the one token you had targeted when you used the Maneuver;
  with none, the button reads "Apply to your target" and takes the one token the presser has
  targeted then. One client writes for a creature, the GM's when a GM is connected, else its
  owner's; a player's press is carried to it. A small card records what was applied, and the
  button gives way to its words on every screen, so a result is applied once.
- **Never from a blind roll.** The roller may not know the degree, so nothing lands by itself;
  the GM's card has the button for the roller's own lines too. That is the only card with a
  button for the roller's own side: on every other the roller's client has already landed it.
- **A card that names its target is held to it.** The button puts the result on the creature
  that was targeted at the roll and on no other; only a card with nobody targeted takes the
  presser's target.
- **A private roll's record is seen by whoever saw the roll**, the roller included.
- **A Condition that is already on by other means is left alone** (ruling 313). The GM's hand, a
  Critical Hit and a Bind put Conditions on too: an APPLY adds nothing to such a Condition, its
  window takes nothing off, and the card says "already ... by other means". A Condition whose
  effect is SWITCHED OFF on the Effects tab is not on: an APPLY switches it on again and it
  becomes the line's.
- **Of two APPLYs of one Effect, the later one's window stands** (ruling 314).
- **An `IMMUNE` line still stops it.** Stubborn Footing refuses the Prone from a Trip, with its own
  card, as it refuses one from the token palette. The exception is your own act with no check
  (ruling 315): Dropping Prone by choice is not stopped by an `IMMUNE` line and does not use it up.
- **A window is counted in an encounter** (ruling 316): a started Combat that the creature using
  the Maneuver, or the one the Effect goes on, is a fighter in, whatever Combat or scene the
  writing client has on screen. A line with `UNTIL:` is not applied outside one, and the card
  says so. Every window ends with the encounter.
- **A Condition's value** (ruling 317): `frightened 2` on a creature already Frightened 3 changes
  nothing; on one Frightened 1 it raises it to 2.
- **`REMOVE`** takes a Condition off whoever put it on, since it is the Maneuver's own act (Stand
  ends Prone). The exceptions, each said on the card as "something else holds it there": an
  Off-Guard that a Critical Hit or a Gain Control holds, which has an end of its own, and a
  Condition that comes from an effect of the GM's carrying several (a net that is Prone and
  Restrained). A named Effect of that name goes, applied or made by hand.
- **A `REMOVE` that finds nothing says nothing** beside a line that did something (0.32.1). Stand
  carries one for Prone and one for Supine, and Escape one for Grabbed and one for Restrained:
  the creature has one of the two, so the card says "Tess is no longer Prone." and not also
  "Tess had no Supine to take off." When nothing at all was taken off, the card says so.
- **Supine is a Condition since 0.33.0**, made by its row of the Conditions workbook (section
  11). `[EFFECT APPLY: Supine]`, `[EFFECT REMOVE: Supine]` and `[REQUIRES prone or supine]` mean
  the Condition, with no rewrite: a cell parsed while Supine was only a named Effect (0.32.1) is
  read as the Condition wherever the system finds it, and an effect left on a creature from
  those days is turned into the Condition's own the first time the world loads.
- **A reroll** is a new card. What the first die put on YOU is taken back before the new result
  lands; what it put on another creature stays, for the GM to take off.
- **A check with no Threshold has no result**, so its lines that wait on one apply nothing, and
  the card says so.
- **The cost** (ruling 318) is what the use was paid at. Where nothing is paid (outside an
  encounter, or with action tracking off) a row with one cost reads that cost, and a row with a
  range of costs whose lines wait on the cost asks which version this use is. A Prepared Maneuver
  applies at Finish, with the cost it was Prepared at. A Reaction reads the cost of its Reaction
  half where the row prints one, and a Maneuver performed as part of another reads its parent's
  cost, as it is paid at.
- **Applied Effects are public** (ruling 320): the hover card lists one for everyone, as it lists
  a Condition. On the Effects tab an applied Effect wears an **Applied** tag whose tooltip says
  who put it there, with which Maneuver, and until when.
- **"Applied by me"** (ruling 319): `IFT: EFFECT(wrong-footed, mine)` on a bonus line holds only
  against a creature YOU put the Effect on. That is how "Wrong-Footed to you" is written.
- **On / Skip / Off** on the Effects tab, for a copy of the Maneuver the character owns: Off, the
  line applies nothing; Skip, it is passed over once, by the use it would have stood for.

What this version does not do:

- **A row the system runs another way applies nothing** (ruling 321): a built-in (Strike,
  Recenter, Raise a Shield, Reload, Pass, Gain Control) and a row another act pays for (Cast, Move,
  Step, Crawl, Rush, Leap, Squeeze, Close). A Rush is the drag, not a use of its row, so Rush's
  Off-Guard is by hand. The build warns about such a line.
- **A row with a use rule** (`MARK`, `PERMIT`) does not roll its own check, so only its lines with
  no `IF: RESULT` apply. **A row with a `SUBORDINATE` line applies none of its own**: its use IS
  the other Maneuver's, so the lines belong on that Maneuver's row.
- **A row that rolls no check** never meets an `IF: RESULT`. The build warns about such a line.
- **Ends that are events** are by hand: "until you Move, Step or Attack" (Take Cover), "until they
  Interact" (Disarm), Sustained, minutes. Write no `UNTIL:` and the Effect stays until removed.
- **An adversary's row applies nothing by degree**: an adversary rolls flat. An APPLY can put
  Effects ON an adversary, and `IFT:` and `with` read them.
- **Trip and Grapple know their result only when a Threshold is given.** Their rows say "vs. Evade
  or Guard", and the system reads a target's Threshold by itself only when a row names one Defense
  (Demoralize against Guard); otherwise type the Threshold in the roll dialog.
- **A Basic Maneuver's row cannot carry a reading line for everyone.** "It takes -2 to its next
  Attack against you" needs a line on the creature that reads the Effect; such a line lives on a
  Talent or on a Maneuver a character owns. An Effect that carries its own lines is not built.
- **A value is applied, never compared**: `EFFECT(frightened)` reads any value.

The build warns, and does not fail, in four cases (section 8 has the words): a line reads a named
Effect that no Maneuver applies (a typo of the name, or an Effect meant to be added by hand); an
APPLY sits on a row the system runs another way; a line waits on a result on a row that rolls no
check; a name begins with a Condition's name and so reads as a named Effect of its own.

### `requires`

What a Maneuver needs before it can be used (0.28.0; rulings 281 to 289). Mike, of the Maneuvers
tab: "I would like to only show Maneuvers that the system detects are applicable ... if you are not
Prone or Supine, you cannot Stand. If you have no Spells, you cannot Cast. If nobody is within your
reach, you cannot Grapple." A Maneuver's Requirements column is prose, which nothing can check; a
`[REQUIRES ...]` block says the part of it a machine can.

- **Where.** On a Maneuver's own row (an action sheet's Automation cell), and nowhere else: on a
  Talent or a custom effect it is refused. A Maneuver a Talent grants is a copy of its row, so it
  carries the block too. It sits beside the row's other blocks, on the same line or its own.
- **Every block must hold.** `[REQUIRES free hand or weapon grapple][REQUIRES creature in reach]` is "a
  free hand or a Grapple weapon, AND somebody in reach".
- **`or` gives alternatives** inside one block. There is no `and` and no comma: a condition that
  must also hold is a second block.
- **`not` turns one word round:** `not prone`, `not controlling`, `not foe adjacent`.

The words:

| word | true when |
|---|---|
| a Condition's name: `prone`, `grabbed`, `restrained`, `hidden`, `undetected`, `off-guard`, `controlling`, `controlled`, `bound`, ... | the character has that Condition. Spaces, hyphens and case do not matter |
| `supine` | the character is Supine: the Condition its row of the Conditions workbook makes (0.33.0; section 11), which a row puts on with `[EFFECT APPLY: Supine]` (Drop Supine) and the token palette toggles. Through 0.32.1 the word read a named Effect called Supine, and it still reads one beside the Condition, for a world where the workbook could not be read |
| `bind` | the character is in a Bind, of any kind (`bound` is the neutral Bind alone) |
| `bind, neutral`, `bind, controlling`, `bind, controlled` | the character is in a Bind in that state (0.31.0). The comma may be left out, and it is the one comma a block reads. The same as the Conditions `bound`, `controlling` and `controlled`, read off the Bind's own record |
| `effect <Name>` | the character has a named Effect (0.31.0): anything on it that is no Condition, by its name (`effect Taking Cover`; section 3, the Effects list). The word in front keeps a bare word a Condition or one of these words, so a mistyped word is still an error. `effect prone` is the Condition |
| `spell` | the character owns a spell |
| `shield`, `shield raised` | a shield is in hand; it is in hand and Raised |
| `rigid` | a rigid implement is in hand: a weapon that is neither Flexible nor a natural weapon, or a shield |
| `free hand` | a hand is free. An estimate: a weapon or a shield in hand is a hand (two for a weapon held in two, none for a natural weapon), and gear marked In hand is probably one. When the system cannot tell, the row is shown |
| `holding` | anything is in hand |
| `weapon`, `melee weapon`, `ranged weapon` | a weapon is in hand, of that kind. A held object: the Unarmed Strike every character has (0.29.0) is never one |
| `weapon <trait>`, `melee weapon <trait>` | a weapon in hand carries the trait, matched on the trait's first word: `weapon reload`, `weapon thrown`, `weapon grapple`, `weapon trip`, `weapon disarm`, `weapon shove`. The Unarmed Strike counts here, for a trait it carries |
| `weapon loaded`, `ranged weapon loaded` | such a weapon in hand is ready to shoot (0.29.0): it has a shot in it, or it needs no loading (Bolas). A melee weapon needs none either, so `ranged weapon loaded` is the usual word |
| `weapon unloaded` | a weapon in hand takes ammunition and is not full (0.29.0): something the Reload Maneuver could load. Not the opposite of `loaded`: a Repeating Crossbow at 3 of 5 is both |
| `foe adjacent`, `ally adjacent`, `creature adjacent` | such a token touches the character's on the map |
| `foe in reach` (`ally`, `creature`) | such a token is within the character's reach |
| `foe within 30` (`ally`, `creature`; any number of feet) | such a token is within that many feet, edge to edge |
| `foe in sight` (`ally`, `creature`) | the character can see such a token, at any distance (0.29.0). Sight is the reading every nearness word already uses: a clear line between the two tokens past the walls, and the other not Hidden or Undetected. For a Blinded character the system does not guess, and the row stays listed |
| `... with <Condition>`, `... with effect <Name>` | after any of the four nearness words (0.31.0): such a token is that near AND has the Condition or the named Effect. `creature adjacent with dying` is Stabilize's; `foe in reach with effect Marked` |
| `encounter` | the character is a fighter in a running encounter |

`foe` is a token of the opposite disposition, `ally` one of the same, `creature` any other token.
`enemy`, `enemies`, `foes`, `allies` and `creatures` read the same.

**The system hides a row only when it knows.** Each word is true, false, or cannot be told: the
character's token is not on the map, a hand the system is unsure of. A block fails only when every
alternative in it is known false; anything it cannot tell leaves the row listed. A token the
character cannot see is not counted (a wall between the two tokens, or the Hidden or Undetected
Condition on the other), and neither is a token hidden from the players, a dead body or a party
token; so a hidden foe never makes Grapple appear. Nothing asks who is looking at the sheet: the
GM's copy lists what the player's does. "In reach" is the longer of the character's own reach and
the reach of what is in hand.

**It decides what is listed, and refuses nothing.** The block is read by the Maneuvers tab alone
(section 7). A player who shows every Maneuver may still use one whose block fails; no roll, cost or
card reads it. The sheet's As read list says `needs: Prone or Supine`.

**The Maneuvers the system itself runs need no block:** Cast (`spell`), Close (`controlling`), Gain
Control (`bind`, and `not controlling`), Raise a Shield (`shield`), Pass (`encounter`) and, since
0.29.0, Reload (`weapon unloaded`) carry theirs in code. A `[REQUIRES ...]` block in such a row's
cell replaces the built-in one. Strike is run by the system too (0.29.0: its row has the three
Strike buttons and asks what to Strike with), and its conditions are a cell, printed in section 5.

**Not read, and the table's:** Size limits ("no more than one Size larger"), cover and concealment,
tools and supplies, mounts and animals, "can hear you", "willing", what a Reaction's Trigger needs,
and anything about the creature TARGETED rather than who is near. Since 0.31.0 a block may ask
what a creature that is near HAS (`with`), which is as close as it comes: Stabilize's row is
listed beside any Dying creature, whichever one is then targeted. A Condition's value is not
compared (`frightened` is any value).

### `check`

The check a Maneuver rolls, declared (0.34.0; rulings 337 to 349). Mike, of Gain Control and of the
Talents still to be written: "when I add new talents I don't want to hard-code what the check is.
So wouldn't it make sense if the check was also using automation grammar, as well as the
success/failure effects?", and: "make sure there is room for the Checker to choose (eg Athletics or
Acrobatics) or for the Checked to choose". Through 0.33.0 the build GUESSED a row's check from its
prose (the Constellation column, the words "attempt ... check" in the Effect and the word after
"vs."), and the guess read "vs. Evade or Guard" as Evade alone, rolled nothing for a cell that
names two Constellations, and could not say a Threshold.

```
[CHECK Athletics]                           roll Athletics; the Threshold is typed when it is rolled
[CHECK Athletics vs Guard]                  against the target's Guard
[CHECK Athletics or Acrobatics vs Guard]    the one using the Maneuver picks which is rolled
[CHECK Athletics vs Evade or Guard]         the target picks which Defense answers
[CHECK relevant]                            any Constellation, picked when it is rolled (Aid)
[CHECK relevant vs Guard]                   the same, against the target's Guard
[CHECK Crafting vs 15]                      a Threshold of 15, which the roll window may still change
```

- **Where.** On a Maneuver's own row, beside its `REQUIRES` and `EFFECT` blocks, and nowhere
  else: on a Talent or a custom effect it is refused. A Maneuver a Talent grants is a copy of its
  row, so a Talent that needs a roll grants one (`[MANEUVER <Name>]`) and the row carries the check.
- **Left of `vs`: what is rolled.** `relevant`, or a Constellation by the name the trees print: a
  Skill, a Defense, Melee, Ranged, a Combat Style. Never a Maneuver, never Origin, and never a
  Lore, which is each character's own (write `relevant`, and the Lore is picked when it is rolled).
- **Right of `vs`: what the roll is read against.** One of the four Defenses, or a whole number
  from 1 to 60. With no `vs` the Threshold is typed in the roll window, as it always was.
- **`or` is a choice, and whoever it affects makes it** (ruling 338; Mike: "on the left side of
  the 'vs' the actor chooses. On the right side of the 'vs' the target chooses"). No word hands a
  choice to the other side. There is no `and` and no comma.
- **One block a row.** A Maneuver rolls one check; a second block stops the build.
- **`CHECK` and `CHECK:` are two things.** `[CHECK Athletics vs Guard]` declares the check;
  `[EFFECT CHECK: 1 condition, aid]` is a bonus to checks, as it has been since 0.16.0. Mike chose
  the word because it does not say who rolls (ruling 337). Each written the other way is told the
  form that was meant.

**In play, for a character.** One Constellation and one Defense roll exactly as before. A choice
on the left opens a short window listing those Constellations, each with its total, before the
roll. A choice on the right, with one creature targeted, posts a request card: "Tess uses Trip
(Athletics) on the Bandit. The Bandit answers with:", and a button for each Defense, which only
the target's player can press (the GM for an adversary, or for a player who is away). The answer
is its own card, with a Roll button for the user's player; the roll and its result are the normal
check card, with its APPLY buttons. Nothing is paid until that roll is made.

- **No Defense is ever chosen by the system.** A request has buttons and no default, and the
  first answer from the target's side stands. Only when the target can use exactly ONE of the
  Defenses named (Evade is unavailable while Grabbed) is nobody asked, and that one is read.
- **One Defense named is the one read**, even when the target cannot use it, and the card says
  so. Through 0.33.0 such a check moved by itself to another Defense.
- **The user picks first, the target answers second**, knowing the pick: declare, then defend.
- **A request** can be withdrawn before it is answered, lapses with the encounter it was made
  in, and gives one roll. One made at the user's own Opportunity stands though that Opportunity
  has since ended.
- **With no token targeted** nothing is asked and the Threshold is typed. One target at a time.

**In play, for an adversary** (ruling 340; Mike: "players ALWAYS roll vs. NPCs"). Used on a
player's character, where the row names a Defense: the adversary pays at once, and the request
card has a Roll button for each Defense. The character's player presses one and rolls that
Defense, against the adversary's number for the Constellation the Maneuver rolls (a typed number
for each Skill, and for Melee and Ranged, on the adversary sheet's Checks block; blank is 10; its
Conditions move it; ruling 341), which stays hidden. A second card follows, spoken by the
adversary: the Maneuver's result, read from the other side (the player's Failure is its Success),
with its result row and its APPLY buttons for the GM. Used on another adversary, or with nobody's
Defense to read, the GM rolls for it: the die's bonus is the typed number less 10, and one window
asks whatever the row leaves to choose.

**A row with no block works as it did.** The build still guesses its check from the row's
Constellation column and its Effect, lists those rows once, and warns when a block names a
Constellation or a Defense other than the one that guess reads (the block is the one read; a
block that names no Defense where the Effect names one is taken as meant). The
Item carries the plan every reader asks (`system.checkPlan`): the block when there is one, else
the three fields the build has always written. The Maneuver's own window shows a declared check
in its check panel.

**The build says so** when a block is on a row the system runs itself (Strike, Gain Control,
Recenter, Reload, Pass, Raise a Shield: nothing reads it) or beside a line that takes the whole
use (`MARK`, `PERMIT`, `SUBORDINATE`: the check is never rolled), and it refuses one on an
Activity (its check is its Check column where the sheet has one, else its Constellation column)
and on an Endeavor. A row the system only PAYS for another way (Leap, whose cost is the drag's)
is still used from its row, and does roll a declared check.

**Not read, and the table's:** the Threshold of a Constellation that is no Defense (Seek against
Stealth, Anticipate against Guile); a Threshold worked out from the target (Stabilize's 10 + Dying
+ Wounds); a check compared against each of several creatures (Hide, Sneak, Captivate); a choice
kept secret from the other side; an `ALTER` of a Maneuver's check; a Maneuver performed as part
of another whose check asks its target to choose, which is refused with the reason.

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

### `reach`
`[REACH N]` or `[REACH +N]` (0.30.0; ruling 301). Mike: "for Automation, I want to have a
`[REACH N]` Automation Grammar, where N is the natural reach for the ancestry."

```
[TRAIT Human][SIZE Medium][REACH 2][SPEED 6][VIGOR 8]     the Human's Root
[REACH 1]                                                  a short-armed Ancestry, whatever its Size
[REACH +1]                                                 a Talent that lengthens the reach
```

- **`[REACH N]` sets Natural Reach**, in feet: the distance a creature reaches with nothing in
  hand, to which a weapon's own Reach is added for Total Reach. It belongs on the Ancestry's Root.
  `[REACH 0]` is allowed (a Tiny creature's). `ft` may be written.
- **`[REACH +N]` and `[REACH -N]` adjust it**, on any Talent. An adjustment of 0 is refused.
- **With no block, Natural Reach comes from Size**, as it always did: Tiny 0, Small 1, Medium 2,
  Large 4, Huge 8, Gargantuan 12. A block stands over that, so an Ancestry's reach no longer has
  to follow its Size.
- **A character reads it off the Talents it owns**, live: the Root's `[REACH N]` (the highest,
  should two Talents set one) plus every adjustment, never below 0. So an existing character
  follows the block as soon as its copy of the Root carries it (Sync content refreshes the copy);
  nothing is stored at creation. Everything that uses Natural Reach follows: Total Reach, the reach
  ring, "in reach" in a `[REQUIRES ...]` block, Support, Intercept.
- **For the cards.** The build carries a Root's `[REACH N]` to the Ancestry's record, and the
  Ancestry's card in Character Creation, its Item sheet, the web app and the compendium document
  print it. An Ancestry with no block prints nothing, since its reach is its Size's.
- **A set stands over Size.** `[REACH 2]` on a Medium Ancestry's Root is still 2 when that
  character's Size is changed by hand to Large. Write the block where an Ancestry's reach is not
  its Size's, or accept that the block, not the Size, is the word.
- An adversary's reach is its Size's: rules do not reach adversaries.

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

### The Talent Maneuvers (the "Talent Maneuvers" sheet of `data/actions_maneuvers.xlsx`)

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

The five lines are Aid's row on the Basic Actions sheet of `data/actions_maneuvers.xlsx`; the two Talents
are the Human's. These cells are Mike's to paste: the 0.22.0 release carries the kinds, and both
workbooks were in his hands when it was cut. What the system does not read of Aid, and the table
does: its Threshold ("typically 15") and whether the help makes sense. (Its ❶ is paid when the roll
is made since 0.23.0.)

### Move Together, and the Talent that changes it (0.24.0)

```
Move Together  ❶      [EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]
Coordinated Footwork  [EFFECT ALTER: Move Together.movement; VALUE: step]
```

The first line is Move Together's row on the Ancestry Actions sheet of `data/actions_maneuvers.xlsx`; the
second is the Human Talent's cell. Both are Mike's to paste: the 0.24.0 release carries the kind,
and both workbooks were in his hands when it was cut. What the system does not read of Move
Together, and the table does: that both routes are declared before either moves, that you move
first, that the ally can perceive your cue, and that the ally is willing.

### Pay It Forward, and the Talent that changes it (0.25.0)

```
Pay It Forward  ⓿     [EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter]
Reciprocal Effort     [EFFECT ALTER: Pay It Forward.limit; VALUE: round]
```

The first line is Pay It Forward's row, which is not yet on the Ancestry Actions sheet of
`data/actions_maneuvers.xlsx` (its text is in Mike's draft workbook); the second is the Human Talent's
cell. Both are Mike's to add: the 0.25.0 release carries the kind, and both workbooks were in his
hands when it was cut. Pay It Forward needs Aid's own five `GIVE` lines above to be on Aid's row,
since without them no Aid gives a result to use up. What the system does not read of Pay It
Forward, and the table does: that the ally is willing, and that Aid's own requirements are met.

What the system does not read, and the table does: whom Oathbound may name ("a creature that has
either formally challenged you, or that has broken a bargain or a truce with you"; the mark takes
the targeted enemy); Quick Tongue's Requirements (a settlement, and not used there within a
month); Broker's Eye's "always know an item's fair price"; and which agreement, trade or social
manipulation is in front of the player, which is what `CLAIM` asks them. Iron Etiquette's two
lines are one Talent, so an Intimidation match and a ticked claim together are +1, not +2 (PHB
v4.21's stacking collapses one source).

### What each Maneuver needs (0.28.0)

The `[REQUIRES ...]` block for every row of `data/actions_maneuvers.xlsx` whose Requirements, Target or
Effect names something the system can check. They are Mike's to paste: the 0.28.0 release carries
the kind, and the workbook was in his hands when it was cut. Each goes in the row's Automation
cell, in place of an `N/A` or an empty cell, or on a line of its own beside the row's other blocks.
Until a row has its block the Maneuvers tab always lists it.

### Reading Effects (0.31.0)

And on a Talent or a Maneuver a character owns, a bonus that waits on an Effect:
```
  [EFFECT ATK: 1 situation; IFT: EFFECT(prone)]              +1 to attacks against a Prone creature
  [EFFECT DEF: 1 situation; IF: EFFECT(Taking Cover)]        +1 to Defenses while you have Taking Cover
  [EFFECT CHECK: 1 situation, intimidation; IFT: EFFECT(frightened)]   +1 to Intimidation against the Frightened
```

An Effect that is no Condition is put on by a Maneuver's `APPLY` line (below), or by hand: the plus
beside "Active Effects" on the Effects tab of either sheet, then its name.

### Putting Effects on (0.32.0)

What the rows of `data/actions_maneuvers.xlsx` say today, written with `APPLY` and `REMOVE`. They
are for Mike to paste: no workbook was written. Each block goes on a line of its own in the row's
Automation cell, beside any `[REQUIRES ...]` block the row has.

```
  Stand ❶          [REQUIRES prone or supine]
                   [EFFECT REMOVE: prone]
                   [EFFECT REMOVE: Supine]

  Drop Prone ⓿     [REQUIRES not prone]
                   [EFFECT APPLY: prone]
                   [EFFECT REMOVE: Supine]

  Drop Supine ⓿    [REQUIRES not supine]
                   [EFFECT APPLY: Supine]
                   [EFFECT REMOVE: prone]
                   (0.32.1; Mike split Drop Prone in two rather than have a box ask which. Each row
                   takes the other state off, so a creature is never both, and Dropping Prone while
                   Supine turns it over)

  Take Cover ❶     [EFFECT APPLY: Taking Cover]
                   (its end, "until you Move, Step or Attack", is an event: take it off by hand)

  Trip ❶ to ❷      [EFFECT APPLY: prone, target; IF: RESULT(critical success)]
                   [EFFECT APPLY: prone, target; IF: RESULT(success)]
                   [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]
                   [EFFECT APPLY: wrong-footed; UNTIL: giver opportunity; IF: RESULT(failure); IF: COST(2)]

  Shove ❶ to ❷     [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]
                   [EFFECT APPLY: wrong-footed; UNTIL: giver opportunity; IF: RESULT(failure); IF: COST(2)]

  Disarm ❷ to ❸    [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]
                   [EFFECT APPLY: wrong-footed; UNTIL: giver opportunity; IF: RESULT(failure); IF: COST(3)]

  Grapple          [EFFECT APPLY: restrained, target; UNTIL: giver opportunity; IF: RESULT(critical success)]
                   [EFFECT APPLY: grabbed, target; UNTIL: giver opportunity; IF: RESULT(success)]
                   [EFFECT APPLY: prone, target; IF: RESULT(critical success); IF: COST(2)]
                   [EFFECT APPLY: prone, target; IF: RESULT(success); IF: COST(2)]
                   [EFFECT APPLY: prone; IF: RESULT(success); IF: COST(2)]
                   [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure); IF: COST(1)]
                   [EFFECT APPLY: prone; IF: RESULT(critical failure); IF: COST(2)]
                   (its Cost cell reads 0 today; the COST lines wait for it to read "1 to 2")

  Demoralize       [EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]
  ❶ to ❸           [EFFECT APPLY: frightened 1, target; IF: RESULT(success); IF: COST(1)]
                   [EFFECT APPLY: frightened 3, target; IF: RESULT(critical success); IF: COST(3)]
                   [EFFECT APPLY: heedless, target; UNTIL: giver opportunity; IF: RESULT(critical success); IF: COST(3)]
                   [EFFECT APPLY: frightened 2, target; IF: RESULT(success); IF: COST(3)]
                   (❷ Break Them, many creatures at once, is by hand: a card has one target)

  Feint ❶          [EFFECT APPLY: wrong-footed, target; UNTIL: giver opportunity end; IF: RESULT(critical success)]
                   [EFFECT APPLY: wrong-footed, target; UNTIL: giver opportunity; IF: RESULT(success)]
                   [EFFECT APPLY: wrong-footed; UNTIL: giver opportunity; IF: RESULT(critical failure)]

  Escape ❶ to ❷    [EFFECT REMOVE: grabbed; IF: RESULT(critical success)]
                   [EFFECT REMOVE: restrained; IF: RESULT(critical success)]
                   [EFFECT REMOVE: grabbed; IF: RESULT(success)]
                   [EFFECT REMOVE: restrained; IF: RESULT(success)]
```

And on a Talent, a line that reads what a Maneuver of yours put on a creature:

```
  [EFFECT ATK: 1 situation; IFT: EFFECT(wrong-footed, mine)]      +1 to attacks against a creature you Wrong-Footed
  [EFFECT DEF: 1 situation; IF: EFFECT(Taking Cover)]             +1 to Defenses while you have Taking Cover
```

What these rows say that a line cannot yet: "Wrong-Footed TO a creature" on yourself (the
Condition goes on you; whom it is to is the table's), a window that ends with ANOTHER creature's
Opportunity on an Effect that is on you (Tumble Through's Critical Failure), damage, pushes and
movement, a result applied to each of several creatures (Hide, Sneak, Captivate), "its next Attack
against you" (Talk Them Down, Anticipate, Bolster: a Basic row cannot carry the line that reads
it), and a degree raised by an Exposed Zone (Trip's Special).

### The Conditions (0.33.0)

The rows of `data/conditions.xlsx` that carry lines or count as another Condition, as the
workbook was first filled (section 11 says how a row is read). Every other row is `N/A`.

```
  Condition      Takes  Includes               Automation
  Off-Guard                                    [EFFECT DEF: -2 situation, evade]
                                               [EFFECT DEF: -2 situation, guard]
  Frightened     N                             [EFFECT DEF: -N condition]
                                               [EFFECT CHECK: -N condition]
                                               [EFFECT ATK: -N condition]
  Fatigued       N                             [EFFECT DEF: -N condition]
                                               [EFFECT ATK: -N condition]
  Prone                 Off-Guard              [EFFECT ATK: -2 situation]
                                               [EFFECT DEF: 2 situation, evade; IFT: RANGED]
  Supine                Off-Guard              (the same two lines)
  Grabbed               Off-Guard              N/A
  Restrained            Grabbed                N/A
  Blinded               Off-Guard              [EFFECT IMMUNE: TRAIT(Visual)]      (0.35.0)
  Deafened                                     [EFFECT IMMUNE: TRAIT(Auditory)]    (0.35.0; to type)
  Unconscious           Prone                  N/A
  Wrong-Footed   X      Off-Guard against X    N/A
```

What these rows say that a line cannot yet: Supine's "except melee Attacks against adjacent
creatures" (its -2 reaches those too), "cannot Move or Step", Evade being unavailable while
Grabbed (the system marks that itself), a value that drops by 1 each round (Frightened, Slowed),
Stunned's and Slowed's lost actions, Heedless's extra action, what Blinded and Deafened cannot
perceive (their immunity to Visual and Auditory effects is a line since 0.35.0), and Fatigued's
maximum, Wind check and rests, which stay the system's.

### Declaring a check (0.34.0)

The rows of `data/actions_maneuvers.xlsx` whose check the build still guesses, each with the block
that says it. Paste the block into the row's Automation cell, beside what is there.

```
  Aid                                         [CHECK relevant vs 15]
  Recall Knowledge                            [CHECK relevant]
  Seek                                        [CHECK Awareness]
  Balance                                     [CHECK Acrobatics]
  Tumble Through                              [CHECK Acrobatics vs Awareness]
  Calm Animal, Direct Animal                  [CHECK Animal Handling vs Guard]
  Climb, Swim                                 [CHECK Athletics]
  Disarm, Grapple, Reposition, Shove, Trip    [CHECK Athletics vs Evade or Guard]
  Reliable Anchor, Rescue Haul                [CHECK Athletics vs 15]
  Brace an Object, Field Patch                [CHECK Crafting]
  Rally, Command the Field                    [CHECK Diplomacy vs 15]
  Talk Them Down                              [CHECK Diplomacy vs Guard]
  Feint                                       [CHECK Guile vs Awareness]
  Anticipate                                  [CHECK Insight]
  Demoralize                                  [CHECK Intimidation vs Guard]
  Stabilize                                   [CHECK Medicine]
  Bolster                                     [CHECK Performance vs 15]
  Captivate                                   [CHECK Performance vs Awareness]
  Hide, Sneak                                 [CHECK Stealth]
  Find Footing                                [CHECK Survival]
  Disable Device, Pick Lock                   [CHECK Thievery]
```

Ten of these change what the build reads today. Trip, Shove, Disarm, Grapple and Reposition say
"Evade or Guard" and are guessed as Evade alone; with the block the target picks. Calm Animal and
Direct Animal say "against the animal's Guard", which the guess does not catch, so today no
Defense is read; with the block a targeted animal's Guard is. Rescue Haul says "an Athletics
check" and its Constellation column says Cairnward, so it is guessed as a Cairnward check; the
block says Athletics. Hide and Sneak are guessed as against one target's Awareness; `[CHECK
Stealth]` stops that. Aid, Rally, Command the Field, Bolster and Reliable Anchor name a
Threshold ("typically 15"), which the roll window then opens on. Seek (against Stealth),
Anticipate (against Guile), Stabilize (10 + Dying + Wounds) and Hide and Sneak (each watcher's
Awareness) are read against something the block cannot say yet, so their blocks name what is
rolled and the Threshold is typed.

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
  writes the LIMIT mark); a player attacking a player rolls against the defender's Threshold (one
  die for each defender since 0.26.0), and the Threshold the coordinator reads carries it. A rule that needs the attack (`IFT:` Threats,
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
  the attacker; a Strike's blind die knows nobody (it is thrown before any Threshold is read; one
  for each defender since 0.26.0, where through 0.25.0 one die was read against them all), so a
  rule about the defender (`IFT: MARKED`) is read as each pairing resolves and added to that
  pairing's total, listed on its card and kept for a reroll of it. **Each of those dice is its own
  roll**: the attacker's own `LIMIT:` line, a pending result an ally gave and an armed claim are
  used by the first die and are gone for the next, and the dice are thrown one at a time so that
  holds. Outside an encounter a `LIMIT: round` line has no round to count and every die carries it. A Strike with no target rolls against a typed Threshold and has no other party.
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
  a Condition given by a result; a result given by a Maneuver that rolls no check; an adversary as
  the recipient; the `ALTER` properties beyond the eight (a Maneuver's range, uses, slots); and a
  Threshold a
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
- **A subordinate Maneuver is its own use under its parent's name** (0.25.0; rulings 245 and 246;
  section 4, `subordinate`). The parent row posts no card and pays nothing of its own: the cost,
  the limit and the used Effect are all settled when the subordinate's roll is made, so a closed
  dialog has spent nothing. The parent's cost is the only one paid.
- **A used Effect is left by the roll that used a bonus up, and lasts that Opportunity** (ruling
  247; section 3, Named Effect). It is written with the roll's own bookkeeping, by the roller's
  client or the one that writes for it, for a check, a Strike, a Cast and a Defense roll alike. It
  is taken off when its Opportunity ends (the turn moves on, forwards or back; a lone fighter steps
  to itself; the encounter ends) and when the Maneuver it triggers is used. The GM may bin it.
- **What a subordinate does not read** (0.25.0). Not performed, and told so: a built-in, a Strike,
  a Cast or a movement row as the subordinate; a Prepared parent; two subordinates on one row; a
  subordinate chosen when the Maneuver is used (Shared Demonstration); one Aid check for several
  allies (Common Purpose, United Effort); Aid before an ally's roll (Timely Aid). Not read, and the
  table's: that the ally is willing, and that the subordinate's own requirements are met. A used
  Effect whose holder has no client connected to take it off when its Opportunity ends stays
  listed, dimmed, until the encounter ends; it is held for nothing by then. A roll made by the GM
  for a player's character leaves the Effect as that player's own roll would.
- **A `[REQUIRES ...]` block decides what the Maneuvers tab lists, and nothing else** (0.28.0;
  section 4). By default the tab shows only the Maneuvers that apply now; **Show every Maneuver**
  at its top shows the rest dimmed, each with why on hover ("Needs: Prone or Supine"). A row is
  left out for four reasons: a block of its own that fails; in an encounter, an Exploration
  Activity or a Downtime Endeavor; in an encounter with the six-action round tracked, a cheapest
  cost above the actions left; and in an encounter outside the character's Opportunity with no
  approval of the GM's standing, anything but a Reaction. A Favorite (the bookmark on a row) is
  listed first and never left out. The list is worked out again when the character's Conditions,
  gear, Bind or actions change, when the Opportunity moves, when a token on the scene moves, when
  another creature's Conditions change, and when a wall or a door changes.
  Nothing is refused by it: a Maneuver shown with the button can be used. It is the character
  sheet's alone; an adversary's abilities are not filtered, and a Reaction Talent offered in the
  Combat window is not a row of the tab.
- **Sight is read, hearing is not.** `SEEN` is line of sight between token centres against
  sight-blocking walls plus three statuses; light, sight range and hearing are the table's.
  `[REQUIRES foe in sight]` (0.29.0) is the same reading, asked by the Maneuvers tab of every
  other token on the scene.
- **A loaded weapon is the weapon's own count, and nothing refuses an empty one** (0.29.0). The
  `loaded` and `unloaded` words read the count on the weapon in hand: a Strike with it in an
  encounter uses a shot, the Reload Maneuver fills it for that weapon's Reload cost, and the chip
  on its Equipment row corrects it by hand. A Strike with an empty weapon still happens and its
  card says so. Outside an encounter nothing is counted. Ammunition itself (arrows, bolts) is not
  counted yet.
- **An Effect is read where it stands** (0.31.0; rulings 305 to 310). `IF: EFFECT(<name>)` asks
  the creature rolling, and a bonus that waits on it is in the sheet's Threshold for as long as
  the Effect is on: put Taking Cover on and Guard moves on the sheet. `IFT: EFFECT(<name>)` asks
  the roll's other party, so it is read only where there is one: the Combat window's preview, the
  card, a Strike's pairing with each defender (never the blind attack die), a Defense roll, and a
  check read against one creature's Threshold. An adversary's Effects are read as a character's
  are. A `[REQUIRES effect ...]` block and a `with` are read by the Maneuvers tab, which looks
  again whenever an effect on any creature changes (a custom effect row on ANOTHER character is
  the one change it does not hear until something else moves). A named Effect is put on by a
  Maneuver's `APPLY` (below) or by a hand: the Effects tab's Active Effects, where a player's
  change is said in chat (a custom effect row's label is not: the row is the player's own, as its
  lines are). The hover card lists a creature's hand-made Effects for its owner and the GM, and
  an applied one for everyone. Where one Talent has a line on the
  attack die and another line that waits on the defender (`ATK: 1` and `ATK: 2; IFT:
  EFFECT(prone)`), the two are one circumstance, counted once: +2 against a Prone defender, not
  +3.
- **A Maneuver puts Effects on, and takes them off** (0.32.0; rulings 311 to 321; section 4,
  `apply`). An `APPLY` or `REMOVE` line on a Maneuver's own row acts when the Maneuver is used
  from its row: with no `IF: RESULT`, as the cost is paid, on the Maneuver's own card; with one,
  after the check, on the creature using it at once and on the creature targeted by the button on
  the card ("Apply to Bandit: Prone"), which the roller's owner or the GM presses once. The
  client that writes a target is the GM's, or its owner's with no GM; with neither connected the
  presser is told and nothing lands. An `IMMUNE` line stops a Condition as it stops one from the
  token palette. A Condition already on by other means is left alone. A window (`UNTIL:`) is
  counted in the encounter the Effect was applied in and closes on the turn change it names; the
  Effect goes then with no card, and every window ends with the encounter. Outside an encounter a
  line with a window is not applied. `EFFECT(<name>, mine)` on a bonus line holds only for an
  Effect the creature rolling applied. Nothing is applied by a Maneuver the system runs another
  way (a Strike, a Rush's drag), by an adversary's roll, from a blind roll by itself, or by a
  check that had no Threshold.
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
| `"<word>" is not a feature keyword: write TRAIT, SIZE, SPEED, REACH, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, REQUIRES, CHECK, EFFECT, or [<Constellation> trained]` | the block's first word |
| `REQUIRES is a block of its own, not an effect: write \`[REQUIRES prone]\`` | a feature keyword wrapped in `[EFFECT ...]` (0.28.0); every keyword is told the same in its own word |
| `REQUIRES is written on the Maneuver's own row: it says when that Maneuver can be used, and the Maneuvers tab lists the row only then` | a `[REQUIRES ...]` block on a Talent or a custom effect |
| `CHECK is written on the Maneuver's own row: it says what that Maneuver rolls. A Talent that needs a roll grants a Maneuver, ...` | a `[CHECK ...]` block on a Talent or a custom effect (0.34.0) |
| `CHECK is written \`[CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>]\`, as in \`[CHECK Athletics vs Evade or Guard]\`` | an empty block; with `: an \`or\` has nothing beside it`, a dangling `or` |
| `"<name>" names no Constellation: CHECK rolls a Skill, a Defense, Melee, Ranged or a Combat Style by the name the trees print, or \`relevant\`` | a name left of `vs` that is no Constellation |
| `"<name>" is a Maneuver: CHECK names the Constellation that is rolled` / `a Lore is each character's own ...` / `Origin is a rank a rule may ask about ...` | a Maneuver, a Lore or Origin left of `vs` |
| `"<name>" is not a Defense: after \`vs\` CHECK names Awareness, Evade, Guard, Endure, or a number; the Threshold of another Constellation is not read yet` | a Constellation that is no Defense right of `vs` |
| `CHECK has one \`vs\`` / `"against": CHECK writes it \`vs\`` / `CHECK names what is rolled before \`vs\`` / `CHECK names a Defense or a number after \`vs\`` | two `vs`; `against` or `versus`; nothing on one side of it |
| `CHECK joins alternatives with \`or\` ... with no comma` / `CHECK has no \`and\`` / `"<name>" is named twice` / `\`relevant\` already means any Constellation ...` | a comma or an `and`; a name given twice; `relevant` beside another name |
| `a Threshold is a whole number from 1 to 60, not <n>` / `a Threshold is a whole number from 1 to 60, with no sign, ..., not <n>` / `after \`vs\` a number stands alone` | a number out of range; a signed or fractional number; a number as one of a choice |
| `a bonus to checks is an effect: write \`[EFFECT CHECK: 1 condition, aid]\`. The check a Maneuver rolls is \`[CHECK Athletics vs Guard]\`, with no colon and no number first` | `[CHECK 1 condition, aid]`: the bonus written as the block, on a Maneuver, a Talent or a custom effect alike |
| `CHECK is an effect tag and takes a colon: write \`[EFFECT CHECK: 1 condition, aid]\`` | `[EFFECT CHECK 1 condition, aid]`, or `check 1 condition, aid` typed as a line: the bonus with its colon lost |
| `"CHECK:" begins an effect line, and an effect goes in an EFFECT block: write \`[EFFECT CHECK: ...]\`; the check a Maneuver rolls has no colon, as in \`[CHECK Athletics vs Guard]\`` | `[CHECK: 1 condition, aid]`: a tag that lost its EFFECT (any effect tag is told to wrap itself; a word that is no tag, such as `[TRAIT: Human]`, or is a feature keyword first, such as `[SPEED: 6]`, is told the keywords) |
| `CHECK is written \`CHECK: <value> <type>, <descriptor>\` ... The check a Maneuver rolls is a block of its own, with no EFFECT and no colon: \`[CHECK Athletics vs Evade]\`` | `[EFFECT CHECK: Athletics vs Evade]`: the block written as the tag |
| `<row>: the row has 2 CHECK blocks; a Maneuver rolls one check, and a choice is written with \`or\` inside the one block` | two `[CHECK ...]` blocks on one row; the build stops |
| `<row>: a CHECK block is written on a Maneuver's row. An Activity's check is its Check column where the sheet has one, else its Constellation column ...` / `An Endeavor rolls no check through the system ...` | a `[CHECK ...]` block on an Activity or an Endeavor; the build stops |
| WARNING: `<row>: the CHECK block says "<check>" and the row's Constellation column and Effect read as "<check>"; the block is the one read, so mend whichever is wrong` | a block names a Constellation or a Defense other than the one the row's column and Effect read as |
| WARNING: `<row>: the system runs this Maneuver itself (its own button or method), so its CHECK block is read by nothing` | a block on Strike, Gain Control, Recenter, Reload, Pass or Raise a Shield |
| WARNING: `<row>: a PERMIT line takes the whole use of this Maneuver, so the check its CHECK block declares is never rolled` | a block beside a `MARK`, `PERMIT` or `SUBORDINATE` line |
| `checks: <n> rows declare the check with a CHECK block; <m> still read from the Effect's prose (<names>)` | not an error: which rows are left to declare |
| `"<word>" is not something REQUIRES can check: write a Condition (...), supine, bind, spell, shield, shield raised, rigid, free hand, holding, weapon, ...` | a word section 4's table does not list |
| `"<words>": say how near, as in \`foe adjacent\`, \`foe in reach\`, \`foe in sight\` or \`ally within 30\`` | `foe`, `ally` or `creature` with no distance, or one that is none |
| `REQUIRES joins alternatives with \`or\`, and a condition that must ALSO hold is a second block` / `REQUIRES has no \`and\`` | a comma, a semicolon or an `and` inside the block |
| `"<words>": one \`not\` is enough` / `an \`or\` has nothing beside it` | a doubled `not`; a dangling `or` |
| `"<words>": a Bind's state is neutral, controlling, controlled, as in \`bind, neutral\`` | a word after `bind` that is no state (0.31.0) |
| `"<words>": name the Effect, as in \`effect Taking Cover\`` | the word `effect` with nothing after it (0.31.0) |
| `"<words>": after \`with\` write a Condition (\`creature adjacent with dying\`) or a named Effect (\`foe in reach with effect Marked\`)` | what follows `with` is neither (0.31.0); a bare name is not read as an Effect there either |
| `"<name>" cannot be an Effect's name: ...` | a name that is a word of the grammar (`or`, `not`, `self`, `target`, `none`, a dash), that holds `or` or `and` as a word, or that has a character other than letters, digits, spaces, hyphens and apostrophes (0.31.0) |
| `"<words>": an Exposed Zone is read off the Zone, not as an Effect; no line reads it yet` | `effect exposed head`, `EFFECT(exposed)` (0.31.0) |
| `"<words>": \`not\` goes in front of the whole condition, as in \`[REQUIRES not effect Blessed]\`; a bonus line has no \`not\` yet` | `effect not Blessed`, `EFFECT(not prone)`: `not` is never part of a name (0.31.0) |
| `"<words>": a Condition's value is not compared yet; write \`fatigued\`, which is any value` | a Condition's name with a number after it, `EFFECT(Fatigued 2)` (0.31.0) |
| `<TAG> has no other party, so IFT: EFFECT(<name>) could never hold; for an Effect of your own write \`IF: EFFECT(<name>)\`` | `IFT: EFFECT(...)` on an INIT or a SPEED line (0.31.0) |
| `<TAG> does not read IFT: EFFECT(<name>) beside IF: CLAIM(...): a claim is asked at the die, before the other party is known` | the two on one line (0.31.0) |
| `EFFECT is written \`EFFECT(<name>)\`, \`EFFECT(<name>, mine)\` or \`EFFECT(<name>, used)\`, as in ...` | an `EFFECT` with no name, an empty part, or three parts |
| `"<word>": the second word is \`used\` (a roll of yours has just used the Effect up) or \`mine\` (you put it there); an Effect a creature has now is written \`EFFECT(<name>)\`` | a second word that is neither |
| `APPLY is written on the Maneuver's own row: it says what using that Maneuver puts on a creature or takes off. A line that READS an Effect goes on a Talent, as in ...` | an `APPLY` or a `REMOVE` on a Talent or a custom effect row (0.32.0) |
| `APPLY names the Effect: a Condition (\`prone\`, \`frightened 2\`) or a name of your own (\`Taking Cover\`), as in ...` | an `APPLY` or `REMOVE` with nothing after the colon |
| `"<word>": after the Effect comes \`self\` (you, and the default) or \`target\` (the creature the Maneuver is used on)` | a second descriptor that is neither; also what `APPLY: 1 situation, prone` is told, since APPLY takes no value |
| `"prone target": a comma goes before \`target\`, as in \`APPLY: prone, target\`` | the comma left out before `self` or `target`; without this the line would read as a named Effect called "prone target" on yourself |
| WARNING: `"frightened two" is read as a named Effect of its own, not the Condition Frightened; for the Condition write \`frightened\`, with a whole number for its value` | a name that BEGINS with a Condition's name: the line reads, as a named Effect, and the build says so in case the Condition was meant |
| WARNING: `<row>: this Maneuver rolls no check, so its APPLY and REMOVE lines that wait on a result (IF: RESULT) never stand; declare the check with a [CHECK ...] block on the row, or drop the IF: RESULT` | an `IF: RESULT` line on a row that declares no check and whose prose names none |
| WARNING: `<row>: this Maneuver is run by the system another way ..., so its APPLY and REMOVE lines apply nothing` | a line on a built-in or on a row another act pays for |
| WARNING: `EFFECT(<Name>): no Maneuver applies an Effect of that name (read by ...); ...` | a named Effect that a line reads and no row's `APPLY` puts on |
| `APPLY on a target lands from the card of the Maneuver's check, so it names the result: add \`IF: RESULT(<degree>)\`, as in ...` | `APPLY: ..., target` with no degree (ruling 321) |
| `APPLY takes one \`IF: RESULT(...)\` (2 given): write one line for each degree` | two degrees on one line |
| `APPLY cannot put on Bound: the system runs that Condition itself (the Bind, Wounds, Dying, Spent and Preparing follow what happens to the creature)` | `bound`, `controlling`, `controlled`, `wounded`, `dying`, `dead`, `spent`, `preparing` after APPLY or REMOVE |
| `"prone 2": Prone carries no value; write \`prone\`` | a number after a Condition that has none |
| `REMOVE takes a Condition off whole: write \`REMOVE: frightened\`` | a number after `REMOVE` |
| `APPLY takes no UNTIL beside a Condition with a value: Frightened 2 moves by its own rule` | `UNTIL:` on a numeric Condition (ruling 317) |
| `REMOVE does not take UNTIL` | a window on a `REMOVE` |
| `APPLY is what using a Maneuver does and cannot ride an [AURA ...] block; write it on the Maneuver's row as ...` | an `APPLY` after an aura's ring |
| `COST is written \`COST(<n>)\`, the number of actions the Maneuver was paid with, as in \`IF: COST(2)\`` / `COST is given twice` | the contents of `COST`: a whole number from 0 to 12, once |
| `<TAG> does not take IF: COST(<n>)` | `COST` on any line but an `APPLY` or a `REMOVE`; a bonus line adds "the cost a Maneuver was paid with is read by APPLY and REMOVE" |
| `"end": a window's edge is written after APPLY alone; here a giver's window ends as that Opportunity begins and a recipient's as it ends` | `end`, `start` or `begin` in a `GIVE` window or an `ALTER` of a duration |
| `"APPLY" is a tag and begins its own line; one effect per line, ...` | `APPLY:` written as a component of another line (a draft of Coordinated Footwork's did) |
| `IFT: EFFECT(<name>, used) is not read: a used Effect is your own roll's, so it is written \`IF: EFFECT(<name>, used)\`` | the used form after `IFT:` |
| `<TAG> does not take EFFECT(<name>)` | the plain form on a line that is no bonus (IMMUNE, USE, REROLL, MARK, IGNORE, GIVE, ALTER, PERMIT, SUBORDINATE) |
| `<TAG> does not take IF: EFFECT(<name>, used): a used Effect is what a SUBORDINATE line waits for. For an Effect you have now, write \`IF: EFFECT(<name>)\`` | the used form on a bonus line |
| `<TAG> does not read EFFECT(...) beside a FOR that reaches others (an aura's ring is one): ...` | `EFFECT(...)` with `FOR: allies ...`, or inside an `[AURA ...]` block (0.31.0) |
| `IF: EFFECT(<name>) is given twice` | the same name twice after the same prefix; one after `IF:` and one after `IFT:` is fine |
| `TRAIT is a feature and is written in brackets: \`[TRAIT Human]\`` | a feature keyword typed as a line, without its brackets |
| `"substitute" is the kind's name, and its tag is USE: write \`[EFFECT USE: Presence, Origin, aid]\`` | a kind's stored name typed as a line (`substitute: Presence, Origin, aid`; 0.21.0): an effect is written with its tag. On a custom effect row the message offers the bare `USE: Presence, Origin, aid` |
| `USE is an effect tag and takes a colon: write \`[EFFECT USE: Presence, Origin, aid]\`` | a tag typed without its colon (`use Presence, Origin, aid`; 0.21.0); any tag is told the same in its own word (`CHECK is an effect tag and takes a colon: ...` when what follows reads like a bonus; `check Athletics vs Guard` is told its brackets), but `SPEED`, which is a feature keyword first |
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
| `` `IMMUNE: TRAIT(...)` is read on a Condition's row for now (the Conditions sheet, as Blinded's `[EFFECT IMMUNE: TRAIT(Visual)]`); a Talent's immunity to a trait is not read yet `` | `IMMUNE: TRAIT(...)` on a Talent, a Maneuver or a custom effect (0.35.0) |
| `IMMUNE names one trait to a line: write \`[EFFECT IMMUNE: TRAIT(Visual)]\` and a second line for a second trait` / `TRAIT(...) names a trait` / `"<name>" is not a trait's name: one word ...` | two traits in one `TRAIT(...)`, or two `TRAIT(...)` on one line; an empty one, or the bare word `trait`; a name of two words (`Reach 5`, `visual effects`) or with a mark in it |
| `on a Condition's row IMMUNE names a trait, as \`[EFFECT IMMUNE: TRAIT(Visual)]\`; immunity to a Condition or an Expose is not read on a Condition's row yet` | `[EFFECT IMMUNE: prone]` or `expose` on a Condition's row |
| `` `IMMUNE: TRAIT(...)` takes nothing after it on a Condition's row yet (no IF:, IFT:, FOR: or LIMIT:): the line acts for whoever has the Condition, so it is written alone `` | `LIMIT:`, `FOR:`, `IF:` or `IFT:` after `IMMUNE: TRAIT(...)` |
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
| `"<name>" is not a Maneuver: a [MANEUVER ...] names a row of data/actions_maneuvers.xlsx` | the Maneuver's row is missing, or (the build) not enabled |
| `"<name>" is not a Constellation` | `[<name> trained]` names no Constellation; the same words answer a `RANK(...)` or the second descriptor of a `USE` that names none |
| `[<name> expert]: a Root is Trained; nothing grants Expert at creation` | only `trained` reads |
| `POINT is written \`[POINT <N> <Scope> [different]]\`` / `"<word>" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet` | the point block |
| `SPEED is written \`[SPEED 6]\` ... or \`[SPEED +1]\`` / `VIGOR is written \`[VIGOR 8]\` ... or \`[VIGOR opening 12]\`` | the chassis blocks |
| `REACH is written \`[REACH 2]\` (the Natural Reach in feet) or \`[REACH +1]\` (an adjustment), not "<text>"` / `an adjustment of 0 does nothing` | a `[REACH ...]` block that is no number, or `[REACH +0]` (0.30.0) |
| `"<word>" is not a Size: write Tiny, Small, Medium, Large, Huge or Gargantuan` | the Size block |
| `AURA is written \`[AURA <N> <who>]\`` | the ring block |
| `[AURA ... visible]: every ring is preview-only and the Auras window shows one; drop the word` | drop `visible` |
| `"N" is a Condition's own value and is written on that Condition's row of the Conditions workbook, as in \`DEF: -N condition\` on Frightened; here write a whole number` | `-N` on a Talent, a Maneuver or a custom effect (0.33.0) |
| `\`-N\` is the Condition's own value, and this Condition takes none: put N in the row's Takes cell, or write a whole number` | `-N` on a row of the Conditions workbook whose Takes is not N |
| `<TAG> is not read on a Condition's row yet: a Condition's lines are CHECK, ATK, DEF, INIT, IMMUNE` / `a Condition's row takes \`[EFFECT ...]\` lines (CHECK, ATK, DEF, INIT, IMMUNE); this block is not read on a Condition's row yet` | another tag, or a feature block, on a Condition's row |
| `... / Conditions: sheet needs Condition and Effect columns. Since 0.35.0 Effect is the rules text ... and Description is its one line of flavor: head the rules column Effect` | the Conditions sheet has no Effect column: the build stops, and does not guess which text a lone Description holds |
| `WARNING: ... / Conditions / <Name>: no Effect; players will read nothing for this Condition` | not a failure: a row with an empty Effect cell (an empty Description, the flavor line, is never said) |
| `WARNING: the roster's conditions block and assets/conditions.json disagree; run the Conditions build ...` | the two are written together, and one is from an older build: run `node assets/build_all.mjs --conditions` |
| `<TAG> on a Condition's row does not take <component> yet: the line acts for whoever has the Condition, and may ask only about the attack it answers (IFT: RANGED, MELEE, BLOW, BLAST, BLIGHT, BEGUILEMENT, TRAIT(...))` | `IF: RANK(...)`, `FOR:`, `IF: ALLIES(...)`, `IF: SEEN`, `LIMIT:`, `IF: CLAIM(...)`, `IFT: MARKED` or `EFFECT(...)` on a Condition's row |
| `NEW CONDITION: "<Name>" is made by its row (the system has no Condition of that name). If it is a slip for another row's name, mend the row.` | not a failure: a row of the Conditions workbook that names no Condition the system has makes one. Printed every build, so a typo in a name is seen at once |
| `... / Conditions: no row for <names>. Every Condition the system has needs its row: the workbook is the only source for what a Condition says` | a row the system needs was deleted or renamed; put it back |
| `... / Conditions / <Name>: Includes says "against X", and this Condition's Takes is not X: there is no creature for X to be` | set Takes to X, or drop `against X` |
| `"<Name>" would be read as the Condition "<Other>" wherever a cell names it: the two names differ only by a mark; rename the row` | a row whose name is another Condition's but for an apostrophe or the like |
| `"<Name>" includes "<Other>", which is no Condition` / `"<Name>" includes itself` / `two rows describe the Condition "<Name>"` / `"<Name>" cannot name a Condition: the word already means something else where a Condition is read` / `"<Name>" is marked System, and the system knows no Condition of that name` | a row the registry cannot take; nothing is written |
| `WARNING: ... / Conditions / <Name>: a CHECK line and an INIT line: an Initiative is a check, so it takes both` / `... a DEF line for every Defense and a DEF line for one of them: that Defense takes both` | not a failure: two lines of one row both reach one roll, and both count |
| `CONDITION ERRORS (nothing written)` / `CONDITION ERRORS (a warning in content mode)` | the Conditions workbook did not read: `assets/conditions.json` and the roster's `conditions` block are left as they were |
| `WARNING: TRAIT(<Trait>): no shipping weapon, Maneuver, attack or Talent carries the trait "<trait>" yet (asked by ...); the rule holds once one is authored` | not a failure: a trait named after `IFT:` or in `IMMUNE: TRAIT(...)` that nothing carries. Often a slip of the pen (`TRAIT(Visaul)`); else the rule waits for something authored with that trait |
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
- **0.25.0** (2026-11-15): the `SUBORDINATE` tag and the `subordinate` kind, the `EFFECT(<name>,
  used)` condition, and `ALTER`'s eighth property, `limit`, from Mike's question about Reciprocal
  Effort's cell. Nothing could be typed there until Pay It Forward itself was automated, so it is
  written first, on its own row. The Subordinate Maneuver rule is his ("any time a maneuver says
  to perform another maneuver as part of it, it is at the original maneuver's listed cost"), and
  so is the tag word (ruling 245); the subordinate's own use is the Maneuver, under the parent's
  name, and nothing is spent until its roll is made (246); named Effects, his Fantasy Grounds
  idea, in two steps by his choice, step one being the Effect a roll leaves when it uses up a
  bonus another creature gave (247); "immediately after that check" read as the rest of that
  Opportunity (248); no trigger and a second use refuse, and the recipient is anyone but you
  (249, both his); `ALTER: <Maneuver>.limit` replaces a limit and never adds a use, for
  `SUBORDINATE` and `PERMIT` alike (250); the row and a button on the card of the roll that used
  the bonus up are two doors to one path (251). No new hook point: `subordinate` answers `use`
  and `card`, whose offers are now drawn on Attack and Defense cards too. The release carries the
  kind alone: Pay It Forward's row, Aid's `GIVE` lines and Reciprocal Effort's cell are Mike's to
  add.
- **0.28.0** (2026-11-15): the `[REQUIRES ...]` block and the `requires` kind, from Mike's
  screenshot of the Maneuvers tab ("Many actions that should unavailable based on the situation
  are there ... if you are not Prone or Supine, you cannot Stand"). The tab lists only what applies
  and a button shows the rest (ruling 281); the conditions are written in the sheets, on the
  Maneuver's own row, his choice, with the five Maneuvers the system runs carrying theirs in code
  (282); a word is true, false or cannot be told, and a row is left out only when the system knows
  (283); also left out, by his choice: the wrong mode (284), a cost that cannot be paid (285) and
  anything but a Reaction outside the Opportunity (286); what the system can see of hands and of
  who is near (287); Favorites on the character, first and never left out (288); nothing is
  refused, the list is a view (289). A feature block, not an effect: no tag, no hook point, no
  switch on the Effects tab. Fixed on the way: a feature keyword wrapped in `[EFFECT ...]` is told
  its own block. The release carries the kind alone: the blocks in section 5 are Mike's to paste.
- **0.29.0** (2026-11-15): three new words for `[REQUIRES ...]`, from Mike's question of how to
  write Strike's cell ("I can foresee many situations in the future where we need some sort of 'if
  you can see an ally' or 'if you can see an enemy'", and "For a ranged weapon, it must also be
  loaded"): `foe in sight` with `ally` and `creature` (ruling 296), `weapon loaded` with `ranged
  weapon loaded`, and `weapon unloaded` (rulings 290 to 293: loading is tracked on the weapon, a
  Strike in an encounter uses a shot, an empty weapon warns and goes on, Reload loads for the
  weapon's own cost). `weapon` with no trait named is a held object and never the Unarmed Strike
  every character now has (294). Reload joins the Maneuvers the system runs, so its block is in
  code and the one printed with 0.28.0 is withdrawn; Strike's cell is printed in section 5 (295).
  No new kind, tag or hook point.
- **0.30.0** (2026-11-15): the `[REACH N]` block and the `reach` kind, the twenty-third, at Mike's
  asking ("where N is the natural reach for the ancestry"): `[REACH 2]` sets Natural Reach on an
  Ancestry's Root and `[REACH +1]` adjusts it on any Talent, his choice of the two forms (ruling
  301); with no block Natural Reach is still the Size's. A feature block with no hook: the
  character reads it off the Talents it owns. Also in this release, and no part of the grammar:
  the workbooks were renamed (`data/actions_maneuvers.xlsx`, `data/talents_ancestries.xlsx` and
  the rest), so the examples here name them as they are now.
- **0.31.0** (2026-11-17): Effects are read by name, from Mike's thought while writing REQUIRES
  cells ("REQUIRES should just look for a string in that Effects list") and his "Plan both
  together" with named Effects, step two. The Effects list (ruling 305): a creature's Conditions,
  and every other active effect on it by its name, with nothing new stored. `[REQUIRES ...]` gains
  `effect <Name>` (the word in front is his choice, so a mistyped bare word is still an error),
  `bind, <state>` (his example) and `with` after a nearness word (306). `EFFECT(<name>)` is read
  after `IF:` for the creature rolling and after `IFT:` for the roll's other party, by the bonus
  lines alone; it is the first condition whose prefix decides its meaning (307). A check read
  against a target's Threshold now has that creature as its other party (308). No new kind, tag
  or hook point. Three older things mended beside it, found by the review: an `INIT` line never
  reached an Initiative rolled with Awareness, which is the default one (since 0.13.0); a straight
  apostrophe inside parentheses opened a quote that never closed, so `CLAIM(when it's raining)`
  and `EFFECT(Hunter's Mark)` were errors; and one Talent's lines split between the attack die
  and the pairing with a defender both counted, where one circumstance counts once. The writing
  half, `APPLY` and `REMOVE` on a Maneuver's own row, is the next release.
- **0.32.0** (2026-11-17): a Maneuver puts Effects on and takes them off, the writing half of
  named Effects, by Mike's three answers when both halves were planned: the tags are `APPLY` and
  `REMOVE`, an Effect on yourself lands at once, and one on another creature is a button on the
  card. The `apply` kind, the twenty-fourth (rulings 311 to 321), on a Maneuver's own row:
  `APPLY: <Effect>[, self | target]` with `UNTIL:` for how long and `IF: RESULT(<degree>)` for
  which result, `REMOVE:` the same with no window. Two additions to the vocabulary beside it:
  the condition `COST(<n>)`, the number of actions the Maneuver was paid with, for rows that
  print a table for each cost (318); and `mine` as the second word of `EFFECT(<name>, mine)`, an
  Effect the creature rolling applied (319). A window after `APPLY` may name its edge (`giver
  opportunity end`, `recipient opportunity start`); a `GIVE` window may not, and reads as it did.
  The seventh hook point, `applies`, calculated, defined with the kind. The build warns when a
  line reads a named Effect no Maneuver applies, and when an `APPLY` sits on a row the system
  runs another way.
- **0.32.1** (2026-11-18): two mends from Mike's question about Stand's cell ("should it say
  `REMOVE: prone` and `REMOVE: supine`?"), with his word that Drop Prone is now two rows, Drop
  Prone and Drop Supine. A `REMOVE` that finds nothing says nothing beside a line that did
  something. And `supine`, which is in the handbook and not yet a Condition of the system, is a
  named Effect until it is: `[EFFECT APPLY: Supine]` puts it on, `[EFFECT REMOVE: Supine]` takes
  it off, and the bare word in `[REQUIRES prone or supine]` reads it (through 0.32.0 that word
  was always "no"). No kind, tag or word is new.
- **0.33.0** (2026-11-18): the Conditions workbook, from Mike's question ("can we build a
  conditions.xlsx that includes every condition, and the automation effects (if any) of it?")
  and his answers: the workbook is the source the system reads and the only authority for a
  Condition's text, a new row makes a new Condition, and a Condition's lines move adversaries'
  numbers too. No kind is new: a Condition's row reads the `bonus` tags (`CHECK`, `ATK`, `DEF`,
  `INIT`) with the attack's own conditions after `IFT:`, and two things were added for it. `N`
  as a value is the Condition's own value, written `-N` (ruling 326), read on a Condition's row
  alone. And a row's **Includes** cell says which Conditions it also counts as (ruling 325), with
  `against X` for one that holds only against the creature that put it on (328). Supine is the
  first Condition a row makes (333). Section 11 is the workbook.

- **0.34.0** (2026-11-19): a Maneuver's check is declared, from Mike's question about Gain
  Control ("wouldn't it make sense if the check was also using automation grammar, as well as the
  success/failure effects?") and his answers: the word is `CHECK` (ruling 337), `or` is the
  choice of whoever it affects (338), the target chooses by buttons on a chat card (339), players
  always roll against adversaries (340), and an adversary has a typed number for each Skill (341).
  One kind, the twenty-fifth: `check`, a feature block on a Maneuver's own row, with no hook.
  The build's guess from prose stays for a row with no block. Gain Control itself stays in code
  until a word says what a result does to a Bind.
- **0.35.0** (2026-11-19): immunity to a trait, and the Conditions sheet's two texts, from
  Mike's revision of `data/conditions.xlsx` ("should we extend it to allow for adding of Traits
  in there?"). No kind is new: `IMMUNE`'s one descriptor has a second form, `TRAIT(<Trait>)`, on a
  Condition's row alone, with no component (rulings 352 and 356), and a Condition after `IMMUNE:`
  stays a bare word. A thing's separate traits are each enough for immunity, and one trait written
  "Auditory or Visual" needs both (357). The system says it and goes on (354). On the sheet, the
  rules text is the **Effect** column and **Description** is one line of flavor, as on every
  other sheet (350).
- **0.35.1** (2026-11-19): `[X]` in a Condition's Effect or Description is the creature the
  Condition is about (rulings 361 to 365; Mike: "since we use brackets for automation, how about
  [X]"). It is text, not grammar: no kind, tag or word is new, and the Automation cell is
  untouched. Section 11 says where it is filled in.

## 11. The Conditions workbook

`data/conditions.xlsx` is the only source for what a Condition says and does (0.33.0; Mike,
2026-11-18). The system, the web app, the compendium and the Rules Reference journal read it; the
handbook's Conditions table is where it was first filled from, and is no longer what the system
follows. One sheet, `Conditions`, one row for each Condition:

| column | what it is |
|---|---|
| Condition | its name: `Frightened`. The suffix the handbook's table prints (`Frightened N`, `Exposed [Zone]`, `Bound [X]`) reads too, and is put back from Takes wherever a table is printed |
| Takes | blank, `N` (a value: Frightened 2), `Zone` (the system's own only), or `X` (a creature: Wrong-Footed to X) |
| Description | one line of flavor, as on a Talent's sheet (0.35.0). It shows in italics above the Effect in the Rules Reference journal and in the Condition's tooltip on a sheet; it may be blank |
| Effect | the rules text players read: the tooltip on the Condition's row of a sheet and on the token's hover card, and the reference tables. Through 0.34.0 this column was headed Description; the build now requires it under this name. On a row whose Takes is `X`, write `[X]` where the creature's name should appear (0.35.1, below) |
| Includes | other Conditions this one also counts as, comma separated |
| Automation | lines in this grammar, one to a line; `N/A` for a row that needs none |
| System | `Yes` for the Conditions the system itself puts on and takes off (Dying, Wounded, Spent, Preparing, the Bind's three, Exposed, Dead). Their rows hold the text; the system runs them |
| Listed? | `Yes` prints the row in the reference tables; anything else keeps it in the system and out of the tables |
| Icon | optional, a path to an image; blank keeps the system's icon |
| Notes | yours: what the code still does for the row, or does not do yet. The system never reads it |

**A row's lines act for whoever has the Condition**, a character or an adversary. So a row reads
the four modifier tags, and `IMMUNE: TRAIT(...)` (0.35.0), and nothing that asks about an owner:

```
[EFFECT DEF: -2 situation, evade]              Off-Guard
[EFFECT DEF: -N condition]                     Frightened: all four Defenses, at its value
[EFFECT CHECK: -N condition]                   ... every check, and an Initiative rolled as one
[EFFECT ATK: -N condition]                     ... every Strike and Cast
[EFFECT DEF: 2 situation, evade; IFT: RANGED]  Prone: +2 Evade against a ranged Attack
[EFFECT IMMUNE: TRAIT(Visual)]                 Blinded: immune to anything with the Visual trait
```

- **`N` is the Condition's own value.** `-N` on Frightened is -2 at Frightened 2 and -3 at
  Frightened 3. It is read only on a row whose Takes is `N`; on a Talent or a Maneuver, or on a
  row that takes no value, it is refused and a whole number is asked for. `N` with no sign is a
  bonus of the value.
- **After `IFT:` a row may ask about the attack it answers**: `BLOW`, `BLAST`, `BLIGHT`,
  `BEGUILEMENT`, `MELEE`, `RANGED`, `TRAIT(<Trait>)`. Such a line is read where the attack is
  known (the Defense roll, the Threshold an attack is read against) and is not in the number on
  the sheet.
- **Nothing else is read on a row yet**: `IF: RANK(...)`, `FOR:`, `IF: ALLIES(...)`, `IF: SEEN`,
  `LIMIT:`, `IF: CLAIM(...)`, `IFT: MARKED`, `EFFECT(...)`, any other tag (`SPEED`, `APPLY`)
  and every feature block are refused by name. `IMMUNE` is read in its `TRAIT(...)` form alone,
  with nothing after it (section 4, `prevent`); `IMMUNE: <Condition>` is not read on a row yet.
  What a Condition forbids (movement, Reactions, a Defense) and how it fades have no word yet.
- **One Condition is one circumstance.** A creature that is Off-Guard three ways (the status,
  Prone, a Torso Wound) takes Off-Guard's -2 once.
- **A Condition's lines have no On / Skip / Off.** The Condition is the switch: take it off and
  its lines go. The Effects tab lists them under the Condition's row, read-only.

**Includes** is how "Prone: Off-Guard, ..." is written. Prone's Includes cell says `Off-Guard`, so
a Prone creature IS Off-Guard to every rule: Off-Guard's own lines reach it, `[REQUIRES
off-guard]` holds for it, and `IFT: EFFECT(off-guard)` holds against it. It goes down the chain
(Restrained includes Grabbed, which includes Off-Guard; Unconscious includes Prone). `REMOVE:
off-guard` does not stand a Prone creature up: Prone is what holds the Off-Guard, and the
Off-Guard goes when Prone does.

- **`<Condition> against X`** in Includes (Wrong-Footed: `Off-Guard against X`) means the
  creature counts as that Condition only against the creature that put the including Condition
  on, and to nobody else. X is whoever applied it with a Maneuver's `APPLY` (a Feint); a
  Wrong-Footed toggled from the token palette names nobody, and counts as nothing more. The row
  needs Takes = `X`. An "against X" Condition is read only where the roll's other party is
  known: the Threshold an attack of X's is read against, and never the number on the sheet.
- **A first Torso Wound, and the Torso's Critical Hit effect, are Off-Guard** through the same
  row (ruling 327), as they were in code: the creature has Off-Guard while either stands.
- **Whose it is.** An included Condition is whose its includer is: an Off-Guard that comes from a
  Prone you applied is yours for `EFFECT(off-guard, mine)` (ruling 331).

**`[X]` in a row's text is the creature the Condition is about** (0.35.1; rulings 361 to 365).
On a row whose Takes is `X`, write `[X]` in the Effect (or the Description) wherever the
creature's name should appear:

```
Controlled    [X] Controls your weapon. You have an Exposed Zone of [X]’s choice ...
Wrong-Footed  Off-Guard against [X] only.
```

- **On a sheet's Effects tab and on the token's hover card** it is filled in: "Tess Controls
  your weapon." For Bound, Controlled and Controlling the creature is the Bind partner; for any
  other row it is whoever put the Condition on with a Maneuver (a Feint's Wrong-Footed).
- **When nobody is named** (the Condition was toggled from the token by hand) it reads "that
  creature", with a capital where it begins a sentence.
- **In the reference tables** (the journal, the web app, the compendium document) there is no
  creature in mind, and `[X]` prints as typed, under the row's printed name: "Controlled [X]".
- **A bare X is a letter**, and is never filled in. The build says so once for a row that takes
  a creature and still writes a bare X with no `[X]` anywhere, the form every such row had
  through 0.35.0, and says so for `[X]` on a row whose Takes is not X, where nothing can fill it.
  Neither stops the build.
- This is text, not grammar: the Automation cell does not read `[X]`, and `against X` in
  Includes is written as it was.

**A new row makes a new Condition** (ruling 323): a status on the token palette, a name every
cell can write (`[EFFECT APPLY: Supine]`, `[REQUIRES supine]`, `IFT: EFFECT(supine)`), the lines
and the Includes of its row. Supine is the first. The build prints `NEW CONDITION: "<Name>"` for
each, every time, so a slip in a name is seen at once. A name may not be a word that already
means something where a Condition is read (`shield`, `weapon ...`, `foe ...`, `effect ...`,
`bind`, `not ...`, `exposed ...`, and since 0.35.0 `trait` and `expose`, the two words `IMMUNE:`
reads that are no Condition). A row deleted from the sheet is gone from the system at the
next build, except the Conditions the system itself has, which the build refuses to go without.

**The row is the word** (ruling 329). A row whose Automation cell is blank or `N/A` means the
Condition changes no number, even Off-Guard, Frightened and Fatigued, whose numbers were in the
system's code before the workbook. Those old numbers stand only in a world where the Conditions
could not be read at all: the GM is told, and nothing changes from 0.32.1.

**Two Conditions are two circumstances.** A creature that is both Prone and Supine takes the
lines of both (-2 to attacks twice); Drop Prone and Drop Supine each take the other off, so a
Maneuver never leaves both.

**Adversaries.** A Condition's lines move an adversary's numbers as they move a character's
(ruling 324): its Defense Thresholds, its Attack Thresholds, its own attack die, its Initiative.
Its sheet shows the number the GM typed, which is what the field edits, and the number in effect
beside it while a Condition moves it. An adversary's own Talents are still unread.

**Building it.** `sync_conditions.cmd` (`node assets/build_all.mjs --conditions`) builds this
workbook alone, as `sync_equipment.cmd` builds the equipment one: no other workbook is opened,
so it runs while the talent and action sheets are still being authored. A row that does not
read stops it with nothing written. Then **Sync content** in the open world reads the
Conditions again on the GM's client and on every connected player's.
