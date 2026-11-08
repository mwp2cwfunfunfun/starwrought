# Automation cells: the grammar's verdict (2026-11-08)

`python assets/highlight_automation.py`. 120 Automation cells and 17 Effect cells with `@Maneuver[...]` markers were read across 15 workbooks; **47 cells do not read** and are painted red (FF9999) with a comment giving the grammar's message and the reason. A cell that reads again on a later run is cleared. The kinds the grammar has: aura, bonus, choice, grant, ignore, language, maneuver, mark, prevent, reroll, sense, size, speed, talent, trait, vigor.

| why | lines |
|---|---|
| not yet readable | 42 |
| no kind yet | 6 |
| names nothing | 6 |
| mis-typed | 3 |

## ancestries.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Dwarf!I5` | Hold Your Ground | `[EFFECT Reduce forced movement by up to 3 feet; IF: CLAIM(would forcibly move); LIMIT: encounter]` | EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE | **no kind yet**: this asks for something no tag or keyword of the grammar does; a kind would have to be written for it |
| `Elf!I9` | Unclouded Mind | `NEED AUTOMATION GRAMMAR FOR REDUCING DEGREE OF SUCCESS FROM CRITICAL SUCCESS TO SUCCESS.` | unknown rule kind "need" (an effect begins with a tag: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE, in brackets as [EFFECT ...]; a feature is a bracketed block: TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or [<Constellation> trained]) | **no kind yet**: the grammar has no tag or keyword "need" |
| `Elf!I10` | Greenblood Elf | `[EFFECT IGNORE: terrain, undergrowth, roots, low branches]` | "roots" is not a terrain kind: write Mud, Shallow Water, Decking, Loose Stone, Rubble, Undergrowth, Snow, Ice, Sand or Other | **no kind yet**: "roots" is not a row of the roster's terrainKinds block (assets/roster.json); a row there, no code, adds it |
| `Gnome!I5` | Small Ingenuity | `[EFFECT CHECK: 1 condition, repair; IF: CLAIM(hand-held objects or small mechanical components)]` | "repair" names no Constellation or Maneuver | **names nothing**: nothing in the data is called "repair" (no Constellation, Maneuver) |
| `Halfling!I2` | Halfling Fortune | `[EFFECT Reroll Failed or Critically Failed Skill Check; IF: CLAIM(hidden objects, concealed mechanisms, or small physical alterations)]` | EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE | **mis-typed**: did you mean "REROLL"? |
| `Halfling!I3` | Small Opening | `[EFFECT CHECK: 1 condition, escape; IFT: SIZE: Larger]` | "SIZE: Larger" is not a condition: IFT: takes RANK, SEEN, ALLIES, ENEMIES, ALL, CLAIM, RESULT, TRAIT, MARKED, BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED, CHECK | **no kind yet**: the grammar has no condition "SIZE: Larger" (known: RANK, SEEN, ALLIES, ENEMIES, ALL, CLAIM, RESULT, TRAIT, MARKED, BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED, CHECK) |
| `Halfling!I4` | Light Fingers | `[EFFECT CHECK: 1 condition, thievery; IF: CLAIM(palming, concealing, or discreetly transferring a hand-held object)]` | "thievery" names no Constellation or Maneuver | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Halfling!I10` | Riverkin Halfling | `[SPEED: Swim [HALF]]` | "SPEED:" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or `[<Constellation> trained]`; an effect goes in `[EFFECT <tag>: ...]` | **no kind yet**: no colon after SPEED; and `[SPEED Swim [HALF]` is not a shape SPEED reads, so a kind would have to be written for it |

## backgrounds.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Backgrounds!E2` | Acolyte | `[Society trained]` | "Society" is not a Constellation | **not yet readable**: "Society" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E4` | Animal Healer | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E5` | Apothecary | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E5` | Apothecary | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E6` | Artisan | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E7` | Beast Trainer | `[Performance trained]` | "Performance" is not a Constellation | **not yet readable**: "Performance" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E8` | Burglar | `[Thievery trained]` | "Thievery" is not a Constellation | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E10` | Charlatan | `[Performance trained]` | "Performance" is not a Constellation | **not yet readable**: "Performance" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E12` | Courtier | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E13` | Criminal | `[Thievery trained]` | "Thievery" is not a Constellation | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E14` | Dancer | `[Performance trained]` | "Performance" is not a Constellation | **not yet readable**: "Performance" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E16` | Engineer | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E16` | Engineer | `[Investigation trained]` | "Investigation" is not a Constellation | **names nothing**: nothing in the data is called "Investigation" (no Constellation) |
| `Backgrounds!E17` | Entertainer | `[Performance trained]` | "Performance" is not a Constellation | **not yet readable**: "Performance" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E18` | Escape Artist | `[Thievery trained]` | "Thievery" is not a Constellation | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E20` | Falconer | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E21` | Farmer | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E22` | Field Medic | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E23` | Former Prisoner | `[Thievery trained]` | "Thievery" is not a Constellation | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E24` | Gambler | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E25` | Healer | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E25` | Healer | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E26` | Herder | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E27` | Hermit | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E27` | Hermit | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E28` | Innkeeper | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E29` | Investigator | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E29` | Investigator | `[Investigation trained]` | "Investigation" is not a Constellation | **names nothing**: nothing in the data is called "Investigation" (no Constellation) |
| `Backgrounds!E30` | Locksmith | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E30` | Locksmith | `[Thievery trained]` | "Thievery" is not a Constellation | **not yet readable**: "Thievery" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E31` | Magistrate | `[Society trained]` | "Society" is not a Constellation | **not yet readable**: "Society" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E32` | Merchant | `[Society trained]` | "Society" is not a Constellation | **not yet readable**: "Society" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E33` | Miner | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E34` | Naturalist | `[Medicine trained]` | "Medicine" is not a Constellation | **not yet readable**: "Medicine" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E34` | Naturalist | `[Investigation trained]` | "Investigation" is not a Constellation | **names nothing**: nothing in the data is called "Investigation" (no Constellation) |
| `Backgrounds!E35` | Noble | `[Society trained]` | "Society" is not a Constellation | **not yet readable**: "Society" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E37` | Puppeteer | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E37` | Puppeteer | `[Performance trained]` | "Performance" is not a Constellation | **not yet readable**: "Performance" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E38` | Sailor | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E39` | Scholar | `[Investigation trained]` | "Investigation" is not a Constellation | **names nothing**: nothing in the data is called "Investigation" (no Constellation) |
| `Backgrounds!E39` | Scholar | `[Society trained]` | "Society" is not a Constellation | **not yet readable**: "Society" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E40` | Scribe | `[Crafting trained]` | "Crafting" is not a Constellation | **not yet readable**: "Crafting" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E40` | Scribe | `[Investigation trained]` | "Investigation" is not a Constellation | **names nothing**: nothing in the data is called "Investigation" (no Constellation) |
| `Backgrounds!E41` | Servant | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E44` | Trapper | `[Survival trained]` | "Survival" is not a Constellation | **not yet readable**: "Survival" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |
| `Backgrounds!E45` | Watch Officer | `[Insight trained]` | "Insight" is not a Constellation | **not yet readable**: "Insight" is a sheet of skills.xlsx but not a row of its _Tree Index; add the row and this reads |

## maneuvers.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Ancestry Actions!O3` | Quench the Ember | `[EFFECT: End Persistent Fire Damage; LIMIT: encounter]` | "EFFECT:" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or `[<Constellation> trained]`; an effect goes in `[EFFECT <tag>: ...]` | **no kind yet**: no colon after EFFECT; and "End Persistent Fire Damage" begins with no tag the grammar knows, so a kind would have to be written for it |

## skills.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Stealth!I4` | Lost in the Noise | `[MANEUVER Lost in the Dark]` | "Lost in the Dark" is not a Maneuver: a [MANEUVER ...] names a row of data/maneuvers.xlsx | **mis-typed**: did you mean "Lost in the Noise", this Talent's own name, which is a row? |
| `Stealth!F4` | Lost in the Noise | `@Maneuver[Lost in the Dark]` | @Maneuver[Lost in the Dark] names no row of the actions workbook (data/maneuvers.xlsx) | **mis-typed**: did you mean "Lost in the Noise", this Talent's own name, which is a row? |

## What the cells ask for that the grammar does not have

Each is a kind, a condition or a vocabulary row to add, one at a time (ruling 119), by the recipe in `foundry/starwrought/module/rules/README.md`; the line is quoted as written.

- `[EFFECT Reduce forced movement by up to 3 feet; IF: CLAIM(would forcibly move); LIMIT: encounter]` (Dwarf / Hold Your Ground)
- `NEED AUTOMATION GRAMMAR FOR REDUCING DEGREE OF SUCCESS FROM CRITICAL SUCCESS TO SUCCESS.` (Elf / Unclouded Mind)
- `[EFFECT IGNORE: terrain, undergrowth, roots, low branches]` (Elf / Greenblood Elf)
- `[EFFECT CHECK: 1 condition, escape; IFT: SIZE: Larger]` (Halfling / Small Opening)
- `[SPEED: Swim [HALF]]` (Halfling / Riverkin Halfling)
- `[EFFECT: End Persistent Fire Damage; LIMIT: encounter]` (Ancestry Actions / Quench the Ember)

## Data-shape notes (what stops the pipeline reading a cell at all)

- **activities.xlsx / Basic Exploration Actions**: no `Action` column (the rows are under `Activity`), so the converter ignores the sheet; its rows are not Maneuvers the grammar can name.
- **endeavors.xlsx / Basic Downtime Endeavors**: no `Action` column (the rows are under `Activity`), so the converter ignores the sheet; its rows are not Maneuvers the grammar can name.
- **maneuvers.xlsx**: its `_Tree Index` has no `Type` column (the header reads `Name | Action Type | Category/Type`); the converter refuses the whole workbook ("an actions _Tree Index needs Name and Type columns"), so no Maneuver of it reaches the pipeline until the column is named `Type` again. The cells below were judged as if it read.
- **skills.xlsx**: sheets not in its `_Tree Index`, so the converter ignores them and no cell names them: `Crafting`, `Insight`, `Lore (LORE_NAME)`, `Medicine`, `Performance`, `Society`, `Survival`, `Thievery`
- **cultures.xlsx**: `Murovian` is in the `_Tree Index` but has no sheet
- **skills.xlsx**: `Lore` is in the `_Tree Index` but has no sheet

## This run

- **ancestries.xlsx**: RED  Dwarf!I5 (Hold Your Ground); RED  Elf!I9 (Unclouded Mind); RED  Elf!I10 (Greenblood Elf); RED  Gnome!I5 (Small Ingenuity); NOTE Halfling!I2 had a fill of its own (FFFFFF00); the mark covers it and a clear restores it; RED  Halfling!I2 (Halfling Fortune); NOTE Halfling!I3 had a fill of its own (FFFFFF00); the mark covers it and a clear restores it; RED  Halfling!I3 (Small Opening); RED  Halfling!I4 (Light Fingers); NOTE Halfling!I10 had a fill of its own (FFFFFF00); the mark covers it and a clear restores it; RED  Halfling!I10 (Riverkin Halfling)
- **backgrounds.xlsx**: RED  Backgrounds!E2 (Acolyte); RED  Backgrounds!E4 (Animal Healer); RED  Backgrounds!E5 (Apothecary); RED  Backgrounds!E6 (Artisan); RED  Backgrounds!E7 (Beast Trainer); RED  Backgrounds!E8 (Burglar); RED  Backgrounds!E10 (Charlatan); RED  Backgrounds!E12 (Courtier); RED  Backgrounds!E13 (Criminal); RED  Backgrounds!E14 (Dancer); RED  Backgrounds!E16 (Engineer); RED  Backgrounds!E17 (Entertainer); RED  Backgrounds!E18 (Escape Artist); RED  Backgrounds!E20 (Falconer); RED  Backgrounds!E21 (Farmer); RED  Backgrounds!E22 (Field Medic); RED  Backgrounds!E23 (Former Prisoner); RED  Backgrounds!E24 (Gambler); RED  Backgrounds!E25 (Healer); RED  Backgrounds!E26 (Herder); RED  Backgrounds!E27 (Hermit); RED  Backgrounds!E28 (Innkeeper); RED  Backgrounds!E29 (Investigator); RED  Backgrounds!E30 (Locksmith); RED  Backgrounds!E31 (Magistrate); RED  Backgrounds!E32 (Merchant); RED  Backgrounds!E33 (Miner); RED  Backgrounds!E34 (Naturalist); RED  Backgrounds!E35 (Noble); RED  Backgrounds!E37 (Puppeteer); RED  Backgrounds!E38 (Sailor); RED  Backgrounds!E39 (Scholar); RED  Backgrounds!E40 (Scribe); RED  Backgrounds!E41 (Servant); RED  Backgrounds!E44 (Trapper); RED  Backgrounds!E45 (Watch Officer)
- **maneuvers.xlsx**: RED  Ancestry Actions!O3 (Quench the Ember)
- **skills.xlsx**: RED  Stealth!I4 (Lost in the Noise); RED  Stealth!F4 (Lost in the Noise)
