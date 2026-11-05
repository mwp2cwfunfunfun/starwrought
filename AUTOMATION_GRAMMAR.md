# STARWROUGHT Automation: the grammar

This is the reference for the **Automation** column of the data workbooks (`data/*.xlsx`), written
for the person typing in the cell. The Foundry system reads the cell with one parser
(`foundry/starwrought/module/rules/`) at build time and in play, so what is written here is what
the system does. Every change to a rule kind, an operator or a vocabulary updates this document in
the same commit (CLAUDE.md, standing rule, 2026-11-05), and the build fails when a kind or an
operator the system knows is not named here.

The grammar in one sentence: **one rule per line, a kind word and a colon, the kind's arguments
separated by commas, then any operators in capitals with their contents in parentheses.**

```
bonus: +1, Condition, Aid, IF(Origin=Trained)
grant: 1, Calling
aura: 15ft, allies, VISIBLE
prevent: Prone, ONCE(encounter)
```

## 1. The cell

- One rule per line. A cell may hold any number of lines.
- A blank line is nothing. A line beginning with `#` is a comment.
- Case does not matter anywhere: `Bonus:`, `IF(origin=trained)` and `aura: 15FT, Allies` all read.
- Spaces are free: `+1,Condition,Aid` and `+1 , Condition , Aid` are the same line.
- One trailing period is tolerated, since people end sentences with them.
- Names are the book's: Constellations (`Guard`, `Stealth`, `Elementalism`), Maneuvers (`Aid`),
  Conditions (`Prone`), Threats (`Blow`), Ranks (`Expert`). A Maneuver's cost glyphs are ignored
  (`Aid` and `Aid ❶` are one name). The slug form (`armored-fighting`) reads too.
- Feet are a number with `ft` attached or not: `15ft`, `15 ft`. `0ft` means adjacent.

A line the parser cannot read **fails the build** (`sync_content.cmd`, `node assets/build_all.mjs`)
with the Constellation, the Talent, the line number and what is wrong, before anything is written
to the pack sources. In an open world, a GM who edits a Talent's Automation textarea and gets a
line wrong sees it in red on the Item sheet's Automation panel and the engine skips that line;
nothing is ever thrown at the table over a cell.

## 2. The shape of a line

```
<kind>: <argument>, <argument>, ... [, <OPERATOR>(...)] ...
```

- The **arguments** are positional and comma-separated. Each kind says how many it takes and what
  each one is (section 3).
- The **operators** come after the arguments, in any order, each written as its `NAME` in capitals
  with its contents in parentheses (section 4). Commas inside the parentheses belong to the
  operator. An operator with no contents is written bare (`VISIBLE`).
- The same operator means the same thing in every kind. A kind refuses an operator it has no use
  for, by name: `prevent does not take AGAINST`.

## 3. The kinds

### `bonus`: a typed bonus or penalty to a roll

```
bonus: <±N>, <Type>, <Target> [, operators]
```

| argument | values |
|---|---|
| `<±N>` | a whole number with its sign: `+1`, `-2`. A bare `1` reads as `+1`; `0` is refused ("a bonus of 0 does nothing") |
| `<Type>` | `Situation`, `Condition` or `Gear`, the book's three (PHB v3.3). The retired words `circumstance`, `status` and `item` are refused naming the current word; `untyped` is refused, since no Talent bonus is untyped |
| `<Target>` | what the bonus applies to: a **Constellation** by name (every check, Defense roll, Initiative and Threshold of that Constellation), a **Maneuver** by name (the roll made from that Maneuver's Item; on any other check it is offered unticked in the roll dialog for the player to claim), or one of the words `Defenses` (all four), `Checks` (every check that is not an attack), `Attacks` (every Strike and Cast), `Initiative`. A Lore is refused: it is the character's own |

A bonus to a Constellation moves that Constellation's **Threshold as well as its roll** (section 6).

```
bonus: +1, Condition, Aid, IF(Origin=Trained)                           Humanity
bonus: +1, Situation, Checks, IF(Rank=Untrained)                        Jack of Trades
bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)   Close Ranks
bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)         Torchbearer Human
bonus: -2, Situation, Stealth                                           a penalty
```

Operators `bonus` takes: `IF`, `FOR`, `WHILE`, `AGAINST`, `FIRST`, `ONCE`.

### `grant`: Talent Points at creation

```
grant: <N>, <Scope> [, DIFFERENT] [, operators]
```

| argument | values |
|---|---|
| `<N>` | how many points, a whole number of 1 or more |
| `<Scope>` | where they may be spent: `Opening` (a Root of a Constellation not yet opened, the book's Opening Talent Point), `Calling`, `Skill`, `Lore`, `Defense`, `Combat Style`, `Comet` (anywhere you qualify) |
| `DIFFERENT` | with `<N>` above 1: each point in a different Constellation of that scope |

The creation wizard adds one slot per point on the step where the Talent was taken. After creation
nothing counts the points: a Talent drag is as unpoliced as every other.

```
grant: 1, Calling          Driven
grant: 1, Skill            Quick Study
grant: 1, Opening          Versatile Human
grant: 2, Skill, DIFFERENT
```

Operators `grant` takes: `IF`.

### `aura`: a ring on the map

```
aura: <N>ft, <Who> [, VISIBLE]
```

| argument | values |
|---|---|
| `<N>ft` | the range in feet, measured edge to edge from the carrier's token |
| `<Who>` | whom the ring is about, for its colour: `allies`, `enemies`, `all` |
| `VISIBLE` | pinned for everyone by default once an encounter starts; otherwise drawn on hover and when the carrier's owner pins it |

The ring is a drawing. What happens inside it is said by other rules on the same Talent (Torchbearer
Human's `bonus ... FOR(allies, 15ft)`), so a Talent that only draws a ring is one line and a Talent
that acts inside it is two. The `Aura` column of 0.5.1 to 0.12.0 is retired; a sheet that still has
one keeps working, and a row with both is an error.

```
aura: 15ft, allies, VISIBLE     Torchbearer Human
aura: 30ft, all                 Seek
```

Operators `aura` takes: `VISIBLE` only.

### `prevent`: an effect does not land

```
prevent: <Effect> [, operators]
```

| argument | values |
|---|---|
| `<Effect>` | a **Condition** by name (`Prone`, `Frightened`, `Off-Guard`, `Grabbed`, ...: the Condition is not set), or `Expose` (a Zone that a Stop would Expose is not Exposed) |

By default the effect is prevented **on the owner**. With `FOR(allies, ...)` it is prevented on
others within range, and when the Talent carries the Reaction glyph ↺ it is offered as that
Reaction at the moment the effect would land: a button on the card for the owner, who pays the
Talent's cost (the ❶↺ in its name) and the effect does not happen. Without ↺ a `FOR` prevent is
automatic.

```
prevent: Prone, ONCE(encounter)       Stubborn Footing
prevent: Expose, FOR(allies, 0ft)     Steady the Line ❶↺
```

Operators `prevent` takes: `IF`, `FOR`, `WHILE`, `AGAINST`, `FIRST`, `ONCE`.

## 4. The operators

| operator | means | takes it |
|---|---|---|
| `IF(<Constellation>=<Rank>)` | the owner's rank in that Constellation is that rank. `=` is equality (a Talent that scales by rank writes one line per rank); `>=` and `<=` read too. `Origin` is the pooled Ancestry, Bloodline and Culture rank. A group (a Combat Style, a magical specialty) has no rank of its own and is refused naming its parent | every kind |
| `IF(Rank=<Rank>)` | the roll being made is at that rank, Handling included (`Rank` is the reserved word for the roll's own rank) | bonus |
| `FOR(<Who>[, <N>ft])` | who receives it: `self` (the default when there is no FOR), `allies`, `enemies`, `all`, or `self+allies`, within that range of the owner. `FOR(self)` needs no range | bonus, prevent |
| `WHILE(<Who><op><N>[, <N>ft])` | the owner's own condition: how many of `allies`, `enemies` or `all` stand within the range. `<op>` is `>=`, `<=`, `=`, `>` or `<`. `WHILE(allies>=1, 0ft)` is "while an ally is adjacent" | bonus, prevent |
| `AGAINST(<Threat>)` | only when answering that Threat: `Blow`, `Blast`, `Blight`, `Beguilement`; or `Melee` / `Ranged`, a Blow by how it reached | bonus, prevent |
| `FIRST(round)` | the first time it would apply to each recipient in a round, and not again until the next round. Outside an encounter there are no rounds, so it applies every time, and the card says so | bonus, prevent |
| `ONCE(encounter)` | the first time it would apply in an encounter, and not again until the next encounter. Outside an encounter it applies every time, said on the card | bonus, prevent |
| `DIFFERENT` | the points go to different Constellations | grant |
| `VISIBLE` | the ring is pinned by default | aura |

**Who.** Allies are tokens of the same disposition as the owner on the scene, as the Support rule
counts them: never a party token, a hidden token, or a Dying, unconscious or dead body. Enemies are
tokens of the opposite disposition. `all` is everyone but the owner. Ranges are measured edge to
edge in feet; `0ft` is adjacency.

**Rank.** `Untrained`, `Trained`, `Expert`, `Master`, `Legendary`.

## 5. The level-1 Human, written in the grammar

```
Humanity            bonus: +1, Condition, Aid, IF(Origin=Trained)
                    bonus: +2, Condition, Aid, IF(Origin=Expert)
                    bonus: +3, Condition, Aid, IF(Origin=Master)
                    bonus: +4, Condition, Aid, IF(Origin=Legendary)
Driven              grant: 1, Calling
Quick Study         grant: 1, Skill
Stubborn Footing    prevent: Prone, ONCE(encounter)
Close Ranks         bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)
Versatile Human     grant: 1, Opening
Jack of Trades      bonus: +1, Situation, Checks, IF(Rank=Untrained)
Torchbearer Human   aura: 15ft, allies, VISIBLE
                    bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)
Steady the Line ❶↺  prevent: Expose, FOR(allies, 0ft)
```

Close Ranks in words: `FOR(self+allies, 0ft)` is who gets the bonus; `WHILE(allies>=1, 0ft)` is the
owner's condition. An ally receives it only while within 0ft of the owner, which is the same
adjacency, so one line serves both halves of "both of you".

## 6. What a rule does in play, and what it does not

- **A bonus to a Constellation moves its Threshold.** A Defense's Threshold is 10 plus the same
  modifiers its roll uses, so `bonus: +1, Situation, Guard` raises the Guard Threshold on the sheet,
  in the Combat Prompt's preview and on the attack card, and the Guard roll alike. A Skill's
  Threshold, wherever one is shown (the party's Skills grid, the Relevant Check picker), is 10 plus
  the check's own modifier, so it moves too.
- **Position is read where a token is known.** A rule with `FOR(..., Nft)` or `WHILE(...)` needs
  to know where the tokens stand. The sheet's Defense Threshold is computed without the map, so it
  does **not** include such bonuses (its tooltip says so); the Combat Prompt's preview, the attack
  card's Threshold and every roll made with a token on the scene do include them.
- **`FIRST(round)` and `ONCE(encounter)` are remembered on the recipient** (a flag on the Actor
  naming the Combat and the round). The client that resolves the roll writes the mark: the GM's
  client for an attack read against a Threshold, the roller's for a Defense roll. At a table with
  no GM connected the mark may not be written for an adversary, and the bonus may apply again.
- **A `prevent` of a Condition** refuses the write wherever the system sets the Condition
  (Drop Flat at the reveal, the final Legs Wound, the token palette, the Effects tab) and posts one
  card saying which Talent prevented it. **A `prevent` of `Expose`** is answered on the resolution
  card: the Expose widget shows the Reaction's button for each ally whose Talent reaches the
  attacker; pressed, the ally's cost is paid, the card says "It Exposes nothing", and the Expose
  widget is gone. A Zone already chosen is not undone.
- **Nothing reads a Talent's Effect text.** What the cell does not say, the system does not do:
  "while they can see or hear you" (Torchbearer) is the table's, as is every clause with no
  operator for it.
- **Adversaries.** A rule on an adversary's Item is indexed but no adversary roll asks for
  modifiers (adversaries roll flat), and no adversary casts. A `prevent` on an adversary works,
  since Conditions are set on adversaries as on characters.

## 7. The messages the build prints

| message | what to do |
|---|---|
| `unknown rule kind "<word>" (known kinds: aura, bonus, grant, prevent)` | the word before the colon is not a kind; check the spelling, or the line is prose that belongs in the Effect column |
| `a bonus is written \`bonus: <±N>, <Type>, <Target> [, operators]\`` | the arguments are not three; count the commas, and check that every operator is `NAME(...)` |
| `"<word>" is not a bonus type: write Situation, Condition or Gear` | the second argument |
| `"<name>" names no Constellation or Maneuver` | the target is misspelt, or the Maneuver's row is not on an action sheet yet (a disabled row still resolves) |
| `"<name>" is a group and has no rank of its own; test <parent> instead` | `IF(Dueling=Expert)`: write the parent, `IF(Melee=Expert)` |
| `"<word>" is not a rank: write Untrained, Trained, Expert, Master or Legendary` | the rank in `IF` |
| `<kind> does not take <OPERATOR>` | the operator is one that kind has no use for; see section 4's last column |
| `<OPERATOR> is written \`<shape>\`` | the contents of the parentheses did not read; the shape is printed |
| `a who is written self, allies, enemies, all or self+allies` | the `FOR` or `WHILE` subject |
| `a range is written <N>ft, as in 15ft` | the feet in `FOR`, `WHILE` or `aura` |
| `"<word>" is not a Condition or Expose` | the `prevent` argument |
| `"<word>" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet` | the `grant` argument |
| `this Aura cell and the Talent's aura rule disagree` | the retired Aura column and an `aura:` line on one row; drop the column's cell |

## 8. The grammar's own history

- **0.9.0** (2026-10-03): the framework; one rule per line, `kind: arguments`, no kinds.
- **0.10.0**: `bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]`, prose connectives.
- **0.13.0** (2026-11-05): the operator grammar in this document, Mike's direction ("logical operands
  and grammatical shortcuts"); `bonus` rewritten to it and the 0.10.0 prose form retired (a cell in
  the old form is refused with the new shape printed); `grant` (the `Grants` column retired),
  `aura` (the `Aura` column retired), `prevent`; the operators `IF`, `FOR`, `WHILE`, `AGAINST`,
  `FIRST`, `ONCE`, `DIFFERENT`, `VISIBLE`.
