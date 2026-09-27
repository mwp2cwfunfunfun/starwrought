# STARWROUGHT for Foundry Virtual Tabletop

A game system implementing the STARWROUGHT Playtest rules (Player's Handbook v3.4; see
`FEATURES.md` for what it does and `CHANGELOG.md` for what changed). Classless, Constellation-built,
and written for a virtual tabletop from the ground up: the arithmetic is the software's job so the
table can spend its attention on decisions.

- **System id:** `starwrought`
- **Foundry:** developed and verified against **v14.367**; the manifest declares a v13 minimum,
  which is untested.
- **Grid:** 1 foot per square, exact diagonals. A Medium creature is a 3x3 token.

## What it does for you

**Character mechanics.** Attributes are derived from the Talents you own (points ÷ 3, rounded
down, max +5, with no minimum +1). Proficiency Rank is derived from your spend in a Constellation
and your level, gated at 1/4/9/16 points and levels 1/5/13/19. Hit Points are
`10 + (Ancestry HP + Calling HP) x level`. The Origin Constellation's three Roots (Ancestry,
Bloodline, Culture) pool into one rank, as the handbook says they do.

**The four Defenses.** Awareness, Evade, Guard, Endure are Constellations like any other, so each
is `level + Attribute + Proficiency`, with a Threshold of ten plus that. Size, Off-Guard,
Frightened and Load Strain are folded in automatically, and bonuses of the same type do not stack.

**Player-facing rolls.** Attack rolls are answered by the defender's stance, Evade or Guard, set on
the defender's sheet or Token HUD and read at the moment of the roll; the card reveals which, and
the Threshold, only once the die is thrown. Defense rolls run the same comparison from the other
side, so beating an Attack Threshold by 10 is a Miss and missing it by 10 is a Critical Hit. The
Multiple Attack Penalty knows about Agile. A Relevant Check lets the actor choose the Constellation,
says why on the card, and leaves the approval to the GM.

**Zones, Protection and the Graze.** Each Zone carries its own armor. Damage follows the printed
order of operations: Immunity, total, Weakness, Resistance, the critical doubling, Protection,
Temporary Hit Points, Hit Points. Protection can never take a blow below 1; Resistance can. The
material step is automatic, so mail turns piercing poorly without anyone remembering it. A Graze
rolls one weapon die and nothing else, and opens the Zone it landed on.

**Going down.** Dropping to 0 sets Dying from the blow that did it plus your Wounded value. Damage
while Dying raises it, healing ends it and makes you Wounded, Recovery checks resolve themselves,
and Refusing Death is a button that cannot fail.

**Flares.** Any critical offers a Flare button on the chat card. It asks which Constellation the
roll belonged to, because the die knows it was a critical and only the table knows what it was
related to. A Constellation you have never opened can be Flared, and it shows on your sheet at 0
points so the Milestone point has somewhere to go.

**Weapon Handling.** Intuitive weapons use your full Weapons Proficiency, Practiced drops a rank
without Familiarity, and Technical drops you to Untrained. Familiarity is a list of Weapon Groups
on the sheet.

## Compendia

| Pack | Contents |
|---|---|
| Constellations | 30 Constellations with their Key Attribute, category, and plate art |
| Talents | 170 Talents, foldered by Constellation |
| Ancestries, Bloodlines, Cultures, Backgrounds & Callings | 13 chassis Items |
| Equipment | 29 weapons, 20 armor pieces, 3 shields |
| Actions & Activities | 46 Actions, Postures, and Exploration and Downtime activities |
| Rules Reference | 20 pages of reference tables |
| Macros | Recenter, Recovery, a night's rest, Relevant Check, Initiative by activity |

Every one of these is generated from `data/*.xlsx` by way of `assets/trees.json` and
`assets/roster.json`. Nothing in `packs/` is authored by hand.

## Building the content

From the project root:

```bash
node assets/build_foundry.mjs
```

That writes `packs/_source/**.json`, `content/constellations.json`, and copies the constellation
plates, then compiles the LevelDB packs with `@foundryvtt/foundryvtt-cli` if it is installed.
Pass `--no-compile` to stop after the sources. Document ids are a hash of the pack and the
document's name, so they stay stable across rebuilds: an id becomes a compendium UUID the moment
somebody drags a Talent onto a sheet.

## Installing

The system folder is `foundry/starwrought/` in this repository. Link it into your Foundry data
directory rather than copying it, so a rebuild is live:

```bash
node foundry/install.mjs
```

Or by hand on Windows:

```bash
mklink /J "%LOCALAPPDATA%\FoundryVTT\Data\systems\starwrought" "C:\path\to\StarWrought\foundry\starwrought"
```

## Layout

```
system.json              the manifest
starwrought.mjs          entry point: CONFIG wiring, hooks, settings
module/config.mjs        every rule constant, in one place
module/data/             Actor and Item data models, and all the derived arithmetic
module/documents/        Actor, Item, Combat, and the chat card behaviour
module/dice/             the check engine and the damage pipeline
module/apps/             the three sheets
templates/               Handlebars for sheets, chat cards, and the roll dialog
content/                 the Constellation index, read at init before compendia exist
packs/                   compiled compendia (generated)
packs/_source/           compendium sources (generated)
```

## Known gaps

The full list is section 7 of `FEATURES.md`. The short version:

- Talent prerequisites and point budgets are enforced by the character-creation wizard and nowhere
  else. Drag a Talent onto a sheet by hand and nothing stops you.
- Talent effects are prose the sheet displays, not rules the system acts on. That is the next
  piece of work, and it will be authored in the spreadsheets rather than in code.
- Cover, Concealment and detection states are reference material, not automation.
- Magic is not in the playtest, so it is not here.
