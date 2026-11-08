# Automation cells: the grammar's verdict (2026-11-08)

`python assets/highlight_automation.py`. 120 Automation cells and 17 Effect cells with `@Maneuver[...]` markers were read across 14 workbooks; **8 cells do not read** and are painted red (FF9999) with a comment giving the grammar's message and the reason. A cell that reads again on a later run is cleared. The kinds the grammar has: aura, bonus, choice, grant, ignore, language, maneuver, mark, prevent, reroll, sense, size, speed, talent, trait, vigor.

| why | lines |
|---|---|
| no kind yet | 6 |
| names nothing | 1 |
| mis-typed | 1 |

## ancestries.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Dwarf!I5` | Hold Your Ground | `[EFFECT Reduce forced movement by up to 3 feet; IF: CLAIM(would forcibly move); LIMIT: encounter]` | EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE | **no kind yet**: this asks for something no tag or keyword of the grammar does; a kind would have to be written for it |
| `Elf!I9` | Unclouded Mind | `NEED AUTOMATION GRAMMAR FOR REDUCING DEGREE OF SUCCESS FROM CRITICAL SUCCESS TO SUCCESS.` | unknown rule kind "need" (an effect begins with a tag: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE, in brackets as [EFFECT ...]; a feature is a bracketed block: TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or [<Constellation> trained]) | **no kind yet**: the grammar has no tag or keyword "need" |
| `Elf!I10` | Greenblood Elf | `[EFFECT IGNORE: terrain, undergrowth, roots, low branches]` | "roots" is not a terrain kind: write Mud, Shallow Water, Decking, Loose Stone, Rubble, Undergrowth, Snow, Ice, Sand or Other | **no kind yet**: "roots" is not a row of the roster's terrainKinds block (assets/roster.json); a row there, no code, adds it |
| `Gnome!I5` | Small Ingenuity | `[EFFECT CHECK: 1 condition, repair; IF: CLAIM(hand-held objects or small mechanical components)]` | "repair" names no Constellation or Maneuver | **names nothing**: nothing in the data is called "repair" (no Constellation, Maneuver) |
| `Halfling!I2` | Halfling Fortune | `[EFFECT Reroll Failed or Critically Failed Skill Check; IF: CLAIM(hidden objects, concealed mechanisms, or small physical alterations)]` | EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE | **mis-typed**: did you mean "REROLL"? |
| `Halfling!I3` | Small Opening | `[EFFECT CHECK: 1 condition, escape; IFT: SIZE: Larger]` | "SIZE: Larger" is not a condition: IFT: takes RANK, SEEN, ALLIES, ENEMIES, ALL, CLAIM, RESULT, TRAIT, MARKED, BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED, CHECK | **no kind yet**: the grammar has no condition "SIZE: Larger" (known: RANK, SEEN, ALLIES, ENEMIES, ALL, CLAIM, RESULT, TRAIT, MARKED, BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED, CHECK) |
| `Halfling!I10` | Riverkin Halfling | `[SPEED: Swim [HALF]]` | "SPEED:" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or `[<Constellation> trained]`; an effect goes in `[EFFECT <tag>: ...]` | **no kind yet**: no colon after SPEED; and `[SPEED Swim [HALF]` is not a shape SPEED reads, so a kind would have to be written for it |

## maneuvers.xlsx

| sheet!cell | Talent / row | line | the grammar says | why |
|---|---|---|---|---|
| `Ancestry Actions!O3` | Quench the Ember | `[EFFECT: End Persistent Fire Damage; LIMIT: encounter]` | "EFFECT:" is not a feature keyword: write TRAIT, SIZE, SPEED, VIGOR, SENSES, LANGUAGE, POINT, MANEUVER, TALENT, CHOICE, AURA, EFFECT, or `[<Constellation> trained]`; an effect goes in `[EFFECT <tag>: ...]` | **no kind yet**: no colon after EFFECT; and "End Persistent Fire Damage" begins with no tag the grammar knows, so a kind would have to be written for it |

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
- **skills.xlsx**: sheets not in its `_Tree Index`, so the converter ignores them and no cell names them: `Lore (LORE_NAME)`
- **cultures.xlsx**: `Murovian` is in the `_Tree Index` but has no sheet
- **skills.xlsx**: `Lore` is in the `_Tree Index` but has no sheet

## This run

- **ancestries.xlsx**: CLEAR Halfling!I4 (Light Fingers) reads again
- **backgrounds.xlsx**: CLEAR Backgrounds!E2 (Acolyte) reads again; CLEAR Backgrounds!E4 (Animal Healer) reads again; CLEAR Backgrounds!E5 (Apothecary) reads again; CLEAR Backgrounds!E6 (Artisan) reads again; CLEAR Backgrounds!E7 (Beast Trainer) reads again; CLEAR Backgrounds!E8 (Burglar) reads again; CLEAR Backgrounds!E10 (Charlatan) reads again; CLEAR Backgrounds!E12 (Courtier) reads again; CLEAR Backgrounds!E13 (Criminal) reads again; CLEAR Backgrounds!E14 (Dancer) reads again; CLEAR Backgrounds!E16 (Engineer) reads again; CLEAR Backgrounds!E17 (Entertainer) reads again; CLEAR Backgrounds!E18 (Escape Artist) reads again; CLEAR Backgrounds!E20 (Falconer) reads again; CLEAR Backgrounds!E21 (Farmer) reads again; CLEAR Backgrounds!E22 (Field Medic) reads again; CLEAR Backgrounds!E23 (Former Prisoner) reads again; CLEAR Backgrounds!E24 (Gambler) reads again; CLEAR Backgrounds!E25 (Healer) reads again; CLEAR Backgrounds!E26 (Herder) reads again; CLEAR Backgrounds!E27 (Hermit) reads again; CLEAR Backgrounds!E28 (Innkeeper) reads again; CLEAR Backgrounds!E29 (Investigator) reads again; CLEAR Backgrounds!E30 (Locksmith) reads again; CLEAR Backgrounds!E31 (Magistrate) reads again; CLEAR Backgrounds!E32 (Merchant) reads again; CLEAR Backgrounds!E33 (Miner) reads again; CLEAR Backgrounds!E34 (Naturalist) reads again; CLEAR Backgrounds!E35 (Noble) reads again; CLEAR Backgrounds!E37 (Puppeteer) reads again; CLEAR Backgrounds!E38 (Sailor) reads again; CLEAR Backgrounds!E39 (Scholar) reads again; CLEAR Backgrounds!E40 (Scribe) reads again; CLEAR Backgrounds!E41 (Servant) reads again; CLEAR Backgrounds!E44 (Trapper) reads again; CLEAR Backgrounds!E45 (Watch Officer) reads again
- **skills.xlsx**: CLEAR Stealth!I4 (Lost in the Noise) reads again; CLEAR Stealth!F4 (Lost in the Noise) reads again
