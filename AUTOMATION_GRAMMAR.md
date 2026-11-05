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
| `<Target>` | what the bonus applies to: a **Constellation** by name (every check, Defense roll, Initiative and Threshold of that Constellation), a **Maneuver** by name (the roll made from that Maneuver's Item; on any other check it is offered unticked in the roll dialog for the player to claim), or one of the words `Defenses` (all four, their Thresholds and rolls), `Checks` (every check that is not an attack or a Defense; an Initiative rolled with a Constellation is a check in it, ruling 111, so it counts), `Attacks` (every Strike and Cast), `Initiative`, `Speed` (0.15.0: feet added to a Move, the one Maneuver; Step, Rush and Leap stay on the base Speed). A Lore is refused: it is the character's own |

A bonus to a Constellation moves that Constellation's **Threshold as well as its roll** (section 6).

```
bonus: +1, Condition, Aid, IF(Origin=Trained)                           Humanity
bonus: +1, Situation, Checks, IF(Rank=Untrained)                        Jack of Trades
bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)   Close Ranks
bonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)   Torchbearer Human
bonus: +1, Condition, Diplomacy, CLAIM(toward someone who shares your Culture)   Serrovanian
bonus: +1, Condition, Attacks, MARKED                                   Oathbound
bonus: +1, Condition, Defenses, AGAINST(Intimidation)                   Iron Etiquette
bonus: +1, Situation, Speed, ONCE(encounter)                            Riverfoot
bonus: -2, Situation, Stealth                                           a penalty
```

Operators `bonus` takes: `IF`, `FOR`, `WHILE`, `AGAINST`, `SEEN`, `FIRST`, `ONCE`, `CLAIM`, `MARKED`.

### `mark`: name one creature

```
mark: [<Who>] [, <Until>]
```

| argument | values |
|---|---|
| `<Who>` | who may be named: `enemies` or `all` (the default) |
| `<Until>` | how long the mark holds: `encounter` (the only word so far, and the default) |

A Talent with a `mark` is **used** (the Use button on its row, Part 2 of 0.15.0; it pays the cost
in the Talent's name, ❶ for Oathbound, in an encounter): the player's one targeted token becomes
the creature this Talent marks, said on a card ("Wren marks the Bandit: Oathbound"). The mark
holds while the encounter it was made in runs; made outside one, until the next encounter starts
or the Talent is used again. Nothing clears it, as FIRST and ONCE marks are compared and never
cleared. Other lines on the same Talent read it with `MARKED`.

```
mark: enemies, encounter          Oathbound ❶
bonus: +1, Condition, Attacks, MARKED
bonus: +1, Condition, Defenses, MARKED
```

Operators `mark` takes: `IF`.

### `reroll`: throw the die again

```
reroll: <Target> [, operators]
```

| argument | values |
|---|---|
| `<Target>` | a **Constellation** by name, or `Checks` (every check that is not an attack or a Defense) |

The card of a matching roll by the owner carries a button named for the Talent ("Quick Tongue ❶↺:
reroll"); pressed by the owner or the GM it pays the Talent's cost in an encounter (nothing outside
one), throws the same die again with the same modifiers, marks the first card superseded and posts
the new one saying what rerolled it. `IF(Outcome=...)` narrows it to a degree; a roll made against
no Threshold has no degree and is never offered. Attack and Defense cards keep their own Reroll
button (0.5.3) and a `reroll` rule does not reach them yet.

```
reroll: Diplomacy, IF(Outcome=Critical Failure)     Quick Tongue ❶↺
```

Operators `reroll` takes: `IF` (`IF(Outcome=...)` and the rank forms).

### `ignore`: difficult terrain costs nothing

```
ignore: Terrain [, <Kind>, <Kind>, ...]
```

| argument | values |
|---|---|
| `Terrain` | the one word so far: the Difficult terrain regions on the map (0.15.0, Terrain on the map) |
| `<Kind>` | which kinds cost nothing: `Mud`, `Shallow Water`, `Decking`, `Loose Stone`, `Rubble`, `Undergrowth`, `Snow`, `Ice`, `Sand`, `Other`. No kind named means every kind |

The owner's token crosses a Difficult terrain region of a named kind as if it were open ground: not
charged, not slowed, not labelled, and a Step into it is a Step. The GM draws the regions and names
their kind (FEATURES.md, Terrain on the map).

```
ignore: Terrain, Mud, Decking, Loose Stone, Shallow Water     Riverfoot
ignore: Terrain                                               every kind
```

Operators `ignore` takes: `IF`.

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

Operators `prevent` takes: `IF`, `FOR`, `WHILE`, `AGAINST`, `SEEN`, `FIRST`, `ONCE`, `MARKED`.

## 4. The operators

| operator | means | takes it |
|---|---|---|
| `IF(<Constellation>=<Rank>)` | the owner's rank in that Constellation is that rank. `=` is equality (a Talent that scales by rank writes one line per rank); `>=` and `<=` read too. `Origin` is the pooled Ancestry, Bloodline and Culture rank. A group (a Combat Style, a magical specialty) has no rank of its own and is refused naming its parent | every kind |
| `IF(Rank=<Rank>)` | the roll being made is at that rank, Handling included (`Rank` is the reserved word for the roll's own rank) | bonus |
| `IF(Trait=<Trait>)` | the attack being answered carries that trait (`Trait` is the reserved word for the attack's traits): a weapon's, an adversary attack's or a spell Talent's, matched on the trait's first word, case blind (`Thrown 20 ft` carries Thrown). Only read where an attack is known: a Defense roll in the attack flow and the Threshold it is read against; a Defense rolled from the sheet for its own sake answers no attack, so the rule stays out of it. No closed list of traits exists; the build warns when nothing shipping carries the one named (0.14.0) | bonus, prevent |
| `FOR(<Who>[, <N>ft])` | who receives it: `self` (the default when there is no FOR), `allies`, `enemies`, `all`, or `self+allies`, within that range of the owner. `FOR(self)` needs no range | bonus, prevent |
| `WHILE(<Who><op><N>[, <N>ft])` | the owner's own condition: how many of `allies`, `enemies` or `all` stand within the range. `<op>` is `>=`, `<=`, `=`, `>` or `<`. `WHILE(allies>=1, 0ft)` is "while an ally is adjacent" | bonus, prevent |
| `AGAINST(<Threat>)` | only when answering that Threat: `Blow`, `Blast`, `Blight`, `Beguilement`; or `Melee` / `Ranged`, a Blow by how it reached; or (0.15.0) a **Constellation** by name, `AGAINST(Intimidation)`: only when the check read against this Defense rolls that Constellation (a character's Demoralize against your Guard reads your live Threshold since 0.15.0). A group is named by its parent, as `IF` wants | bonus, prevent |
| `CLAIM(<text>)` | the bonus is not decided by the system: it is **offered** in the roll dialog as an unticked checkbox whose hint is the Talent's name, the bonus and the text ("Serrovanian: +1 Condition bonus toward someone who shares your Culture. Tick it if this roll is one."), on any roll that shows a dialog (a check, a Strike, a Defense roll in the attack flow). A Threshold read has no dialog, so a claim never moves one unless **armed**: the pin on the Talent's row ("Apply to my next roll") arms every claim on it; an armed claim comes to the next roll's dialog ticked and to the next Threshold read applied, and is spent by whichever of those resolves first. Shift-click skips the dialog and takes only an armed claim with it (0.15.0, ruling 174) | bonus |
| `MARKED` | only when the other party of the roll (the attacker whose Blow you answer, the defender your Strike resolves against) is the creature this Talent's `mark` named. Read where the other party is known: a Defense roll and the Threshold read in the attack flow, and each pairing of a Strike as it resolves (the one blind die is unchanged; the bonus is added on the pairing's card, ruling 175) | bonus, prevent |
| `IF(Outcome=<Degree>)` | the roll's degree is that one: `Critical Success`, `Success`, `Failure`, `Critical Failure` (`Outcome` is the reserved word). Only a kind that acts after the die has a use for it | reroll |
| `SEEN` | only for a recipient who can see you: a straight line from their token's centre to yours crosses no sight-blocking wall, they are not Blinded, and your token is not hidden nor you Hidden or Undetected. Nothing finer is read (no light, no sight range, no hearing; ruling 170). Read where the map is known, as `FOR` is; the owner always sees themself | bonus, prevent |
| `FIRST(round)` | the first time it would apply to each recipient in a round, and not again until the next round. Outside an encounter there are no rounds, so it applies every time, and the card says so | bonus, prevent |
| `ONCE(encounter)` | the first time it would apply in an encounter, and not again until the next encounter. Outside an encounter it applies every time, said on the card | bonus, prevent |
| `DIFFERENT` | the points go to different Constellations | grant |
| `VISIBLE` | the ring is pinned by default | aura |

**Who.** Allies are tokens of the same disposition as the owner on the scene, as the Support rule
counts them: never a party token, a hidden token, or a Dying, unconscious or dead body. Enemies are
tokens of the opposite disposition. `all` is everyone but the owner. Ranges are measured edge to
edge in feet; `0ft` is adjacency.

**Rank.** `Untrained`, `Trained`, `Expert`, `Master`, `Legendary`.

**Trait.** Any word; the attack's traits are the weapon's Traits column, the adversary attack
Item's Traits, or the spell Talent's `Traits` column on its tree sheet (0.14.0). `Fear` is carried
by nothing in the data yet, so a rule naming it reads correctly and fires when the first Fear
attack is authored.

**Degree.** `Critical Success`, `Success`, `Failure`, `Critical Failure`, as the Result table
prints them (spaces free, case blind).

**Terrain kind.** `Mud`, `Shallow Water`, `Decking`, `Loose Stone`, `Rubble`, `Undergrowth`,
`Snow`, `Ice`, `Sand`, `Other`: the Difficult terrain behavior's own list, which a region's GM
picks from, so the words in a cell and on the map are one vocabulary.

## 5. The level-1 Human, written in the grammar

```
Humanity            bonus: +1, Condition, Aid, IF(Origin=Trained)
Driven              grant: 1, Calling
Quick Study         grant: 1, Skill
Stubborn Footing    prevent: Prone, ONCE(encounter)
Close Ranks         bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)
Versatile Human     grant: 1, Opening
Jack of All Trades  bonus: +1, Situation, Checks, IF(Rank=Untrained)
Torchbearer Human   aura: 15ft, allies, VISIBLE
                    bonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)
Steady the Line ❶↺  prevent: Expose, FOR(allies, 0ft)
```

Close Ranks in words: `FOR(self+allies, 0ft)` is who gets the bonus; `WHILE(allies>=1, 0ft)` is the
owner's condition. An ally receives it only while within 0ft of the owner, which is the same
adjacency, so one line serves both halves of "both of you".

Torchbearer Human in words (the Rally Aura, Mike's text of 2026-11-05: "The first time each round
an ally within 15 feet who can see you defends against an Attack with the Fear trait, they gain a
+1 Situation bonus to that Defense check"): the first line draws the ring; the second gives every
Defense (`Defenses`) of an ally within 15 ft (`FOR`) who can see the owner (`SEEN`) a +1 against an
attack carrying Fear (`IF(Trait=Fear)`), once a round per ally (`FIRST(round)`). Humanity is one
line since Mike flattened its Effect to a +1 (2026-11-05); a Talent that scales by rank still
writes one line per rank.

### The two Cultures (0.15.0)

```
Serrovanian        bonus: +1, Condition, Diplomacy, CLAIM(toward someone who shares your Culture)
Oathbound ❶        mark: enemies, encounter
                   bonus: +1, Condition, Attacks, MARKED
                   bonus: +1, Condition, Defenses, MARKED
Contract Literate  bonus: +2, Condition, Checks, CLAIM(noticing hidden clauses, traps or altered terms in an agreement)
Iron Etiquette     bonus: +1, Condition, Defenses, AGAINST(Intimidation)
                   bonus: +1, Condition, Defenses, CLAIM(against a social manipulation other than Intimidation)
Reacher            bonus: +1, Condition, Diplomacy, CLAIM(toward someone who shares your Culture)
Quick Tongue ❶↺    reroll: Diplomacy, IF(Outcome=Critical Failure)
Riverfoot          ignore: Terrain, Mud, Decking, Loose Stone, Shallow Water
                   bonus: +1, Situation, Speed, ONCE(encounter)
Broker's Eye       bonus: +2, Situation, Diplomacy, CLAIM(when trading)
                   bonus: +2, Situation, Guile, CLAIM(when trading)
```

What the system does not read, and the table does: whom Oathbound may name ("a creature that has
either formally challenged you, or that has broken a bargain or a truce with you"; the mark takes
the targeted enemy); Quick Tongue's Requirements (a settlement, and not used there within a
month); Broker's Eye's "always know an item's fair price"; and which agreement, trade or social
manipulation is in front of the player, which is what `CLAIM` asks them. Iron Etiquette's two
lines are one Talent, so an Intimidation match and a ticked claim together are +1, not +2 (PHB
v4.21's stacking collapses one source).

## 6. What a rule does in play, and what it does not

- **A bonus to a Constellation moves its Threshold.** A Defense's Threshold is 10 plus the same
  modifiers its roll uses, so `bonus: +1, Situation, Guard` raises the Guard Threshold on the sheet,
  in the Combat Prompt's preview and on the attack card, and the Guard roll alike. A Skill's
  Threshold, wherever one is shown (the party's Skills grid, the Relevant Check picker), is 10 plus
  the check's own modifier, so it moves too. **Both of the player's paths are covered:** a player
  defending against an adversary's attack rolls their Defense, and the roll carries the bonus (and
  writes the FIRST/ONCE mark); a player attacking a player rolls once against the defender's
  Threshold, and the Threshold the coordinator reads carries it. A rule that needs the attack
  (`AGAINST`, `IF(Trait=...)`), the map (`FOR` reaching others, `WHILE`, `SEEN`) or the round
  (`FIRST`, `ONCE`) is read at both of those moments and nowhere the attack is unknown.
- **Position is read where a token is known.** A rule with `FOR(..., Nft)` or `WHILE(...)` needs
  to know where the tokens stand. The sheet's Defense Threshold is computed without the map, so it
  does **not** include such bonuses (its tooltip says so); the Combat Prompt's preview, the attack
  card's Threshold and every roll made with a token on the scene do include them.
- **`FIRST(round)` and `ONCE(encounter)` are remembered on the recipient** (a flag on the Actor,
  `flags.starwrought.rules.round` or `.encounter`, keyed by the Talent and the line, naming the
  Combat and the round). The client that resolves the roll writes the mark: the coordinator's
  client (the GM's when one is connected) for an attack read against a Threshold, the roller's for
  a Defense roll or a check; a preview writes nothing. At a table with no GM connected the mark
  may not be written for an adversary, and the bonus may apply again. The Item sheet's **As read**
  line prints the limit ("the first time each round").
- **The Item sheet's As read line** is the rule in words: `+1 Situation bonus to Guard, for you and
  your allies within 0 ft, while >= 1 allies within 0 ft, against a Blow`. Read it after typing a
  line to see what the system made of it.
- **A `prevent` of a Condition** refuses the write wherever the system sets the Condition
  (Drop Flat at the reveal, the final Legs Wound, the token palette, the Effects tab) and posts one
  card saying which Talent prevented it. **A `prevent` of `Expose`** is answered on the resolution
  card: the Expose widget shows the Reaction's button for each ally whose Talent reaches the
  attacker; pressed, the ally's cost is paid, the card says "It Exposes nothing", and the Expose
  widget is gone. **Pressed after the Zone was picked** (the order at most tables: the GM says "you
  are Exposed", then the ally answers; Mike, 2026-11-05) it closes the Zone this card Exposed, and
  the card says so ("The Arms Zone is closed again"; ruling 172, 0.14.0). The card remembers the Zone it Exposed (a flag written by
  the GM's client, or the card's author); a player who owns both sides at a table with no GM
  connected cannot write it, and the Reaction pressed afterwards then undoes nothing, said in a
  notice. A Zone Exposed by anything but this card is never touched.
- **Sight is read, hearing is not.** `SEEN` is line of sight between token centres against
  sight-blocking walls plus three statuses (Blinded on the seer, hidden or Hidden or Undetected on
  the seen); light, sight range and hearing are the table's (ruling 170).
- **A claim is the player's decision, at the roll** (0.15.0, ruling 174). A `CLAIM` bonus is a
  checkbox in the roll dialog, unticked, hint and all; ticked, it joins the roll as the dialog's
  other extras do and prints on the card by the Talent's name. The pin on the Talent's row arms it
  for the next roll (the box comes ticked) or the next Threshold read (applied, since no dialog
  shows); the pin goes out when either resolves. Nothing is applied unasked, and nothing is
  remembered past that one roll.
- **The other party is read per pairing** (0.15.0, ruling 175). A Defense roll and a Threshold
  read know the attacker; a Strike's one blind die knows nobody, so a rule about the defender
  (`MARKED`) is read as each pairing resolves and added to that pairing's total, listed on its card
  and kept for a reroll of it. A Strike with no target rolls against a typed Threshold and has no
  other party.
- **A mark names one creature** (0.15.0, ruling 176). `flags.starwrought.rules.marks.<talent>`
  on the owner: the targeted token, its name and the Combat it was made in. It holds while that
  Combat is the viewed one; made outside an encounter it holds until the next encounter starts or
  the Talent is used again. Using the Talent asks for exactly one target of the kind `<Who>` names.
- **A reroll pays once, in an encounter** (0.15.0, ruling 177). The button on the card pays the
  Talent's cost through the owner's actions when a Combat is running and charges nothing outside
  one; the new card names the Talent and says its Requirements are the table's.
- **A check against a Threshold reads it live** (0.15.0, ruling 179). A Maneuver whose check names
  a Defense (Demoralize against Guard), used with one target, reads that target's Threshold
  through the same fold the attack flow uses (the Threat `check` and the attacker known, so
  `AGAINST(Intimidation)` and `MARKED` apply), prints the number for a character target or a GM
  roller, and withholds an adversary's as the flow does.
- **Terrain is on the map** (0.15.0, ruling 178). A Difficult terrain region behavior carries a
  kind and a multiplier; `ignore: Terrain, <Kind>` makes the owner's token cross that kind as open
  ground. A region the GM hides carries no terrain for anyone (Foundry's rule), so a terrain
  region is never hidden to keep it secret; players toggle their own overlay instead.
- **Nothing reads a Talent's Effect text.** What the cell does not say, the system does not do:
  every clause with no operator for it is the table's.
- **Adversaries.** A rule on an adversary's Item is indexed but no adversary roll asks for
  modifiers (adversaries roll flat), and no adversary casts. A `prevent` on an adversary works,
  since Conditions are set on adversaries as on characters.

## 7. The messages the build prints

| message | what to do |
|---|---|
| `unknown rule kind "<word>" (known kinds: aura, bonus, grant, prevent)` | the word before the colon is not a kind; check the spelling, or the line is prose that belongs in the Effect column |
| `a bonus is written \`bonus: <±N>, <Type>, <Target> [, operators]\` (N arguments given, 3 wanted)` | the arguments are not three; count the commas, and check that every operator is `NAME(...)` |
| `the 0.10.0 form "bonus: +1 Condition to Aid if Human is Expert" is retired; write ...` | a cell in the prose form of 0.10.0 to 0.12.0: commas between the arguments, `IF(...)` for the condition |
| `"<part>" comes after an operator; the arguments go first, then the operators` | an argument was written after `IF(...)` or another operator |
| `<OPERATOR> is given twice` / `FIRST and ONCE are one limit; write one of them` | one line, one of each |
| `FOR(self) takes no range` | the owner is always within reach of themself |
| `"<word>" is not a bonus type: write Situation, Condition or Gear` | the second argument |
| `"<name>" names no Constellation or Maneuver` | the target is misspelt, or the Maneuver's row is not on an action sheet yet (a disabled row still resolves) |
| `"<name>" is a group and has no rank of its own; test <parent> instead` | `IF(Dueling=Expert)`: write the parent, `IF(Melee=Expert)` |
| `"<word>" is not a rank: write Untrained, Trained, Expert, Master or Legendary` | the rank in `IF` |
| `IF(Trait=<Trait>) names the trait with = only` | `IF(Trait>=Fear)` makes no sense; write `IF(Trait=Fear)` |
| `SEEN takes nothing in parentheses` | `SEEN()` or `SEEN(allies)`: it is a bare word; who must see you is who `FOR` names |
| `WARNING: ... IF(Trait=<Trait>): no shipping weapon, attack or Talent carries the trait "<Trait>"` | not a failure: the rule reads and fires when something is authored with that trait. Check the spelling against the Traits columns |
| `<kind> does not take <OPERATOR>` | the operator is one that kind has no use for; see section 4's last column |
| `<OPERATOR> is written \`<shape>\`` | the contents of the parentheses did not read; the shape is printed |
| `a who is written self, allies, enemies, all or self+allies` | the `FOR` or `WHILE` subject |
| `a range is written <N>ft, as in 15ft` | the feet in `FOR`, `WHILE` or `aura` |
| `"<word>" is not a Condition or Expose` | the `prevent` argument |
| `"<word>" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet` | the `grant` argument |
| `this Aura cell and the Talent's aura rule disagree` | the retired Aura column and an `aura:` line on one row; drop the column's cell |
| `CLAIM is written \`CLAIM(<text>)\`, the words the player is asked` | a bare `CLAIM`, or empty parentheses |
| `MARKED takes nothing in parentheses` | `MARKED(enemies)`: who may be marked is the `mark` line's business |
| `"<word>" is not a Degree: write Critical Success, Success, Failure or Critical Failure` | the degree in `IF(Outcome=...)` |
| `IF(Outcome=...) is only read by a kind that acts after the die (reroll)` | an `IF(Outcome=...)` on a bonus or a prevent |
| `a mark is written \`mark: [<Who>] [, <Until>]\`` | the arguments of `mark`; `Who` is `enemies` or `all`, `Until` is `encounter` |
| `a reroll is written \`reroll: <Target>\`` | the target of `reroll` is a Constellation or `Checks` |
| `an ignore is written \`ignore: Terrain [, <Kind>, ...]\`` | the first word is `Terrain` |
| `"<word>" is not a terrain kind: write Mud, Shallow Water, ...` | a kind not in the Difficult terrain behavior's list |

## 8. The grammar's own history

- **0.9.0** (2026-10-03): the framework; one rule per line, `kind: arguments`, no kinds.
- **0.10.0**: `bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]`, prose connectives.
- **0.13.0** (2026-11-05): the operator grammar in this document, Mike's direction ("logical operands
  and grammatical shortcuts"); `bonus` rewritten to it and the 0.10.0 prose form retired (a cell in
  the old form is refused with the new shape printed); `grant` (the `Grants` column retired),
  `aura` (the `Aura` column retired), `prevent`; the operators `IF`, `FOR`, `WHILE`, `AGAINST`,
  `FIRST`, `ONCE`, `DIFFERENT`, `VISIBLE`.
- **0.14.0** (2026-11-05): `SEEN` (the recipient can see you) and `IF(Trait=<Trait>)` (the attack
  answered carries the trait), for the Torchbearer Human's Rally Aura; a `Traits` column on tree
  sheets, so a spell Talent can carry one; a `prevent` of `Expose` pressed after the Zone pick
  closes the Zone the card Exposed.
- **0.15.0** (2026-11-05): the two Cultures' eight Talents. `CLAIM(<text>)` (the player's checkbox,
  and the pin that arms it; Mike: "both"), `MARKED` with the `mark` kind (Oathbound), `reroll`
  with `IF(Outcome=...)` (Quick Tongue), `AGAINST(<Constellation>)` and the check that reads a
  target's Threshold (Iron Etiquette), `Speed` as a bonus target and `ignore: Terrain` with the
  Difficult terrain region behavior (Riverfoot; Mike: "build difficult terrain INTO the maps").
