# STARWROUGHT for Foundry Virtual Tabletop

A game system implementing the STARWROUGHT Playtest rules (Player's Handbook v4.15; see
`FEATURES.md` for what it does and `CHANGELOG.md` for what changed). Classless, Constellation-built,
and written for a virtual tabletop from the ground up: the arithmetic is the software's job so the
table can spend its attention on decisions. Six actions a round spent across Opportunities, the
Exchange with its three Strikes and its Reactions, the Bind, Vigor and Wounds per Zone: all of it is
tracked, announced, and never enforced against the table.

- **System id:** `starwrought`
- **Foundry:** developed against **v14**; the manifest declares a v13 minimum, which is untested.
- **Grid:** 1 foot per square, exact diagonals. A Medium creature is a 3x3 token. Speed is feet per
  Move; a Human's is 6.
- **Actor types:** `character`, `npc` (the adversary, written Threshold-first) and, since 0.7.0,
  `party`: the Party Sheet, GM-owned and open to every player as an Observer, which stores only
  its own bookkeeping and reads its members live.

## What it does for you

**Character mechanics.** Attributes are derived from the Talents you own (points ÷ 4, rounded
down, max +5, with no minimum +1). Proficiency Rank is derived from your spend in a Constellation
and your level: Trained +3, Expert +6, Master +9, Legendary +12, gated at 1/4/9/16 points and
levels 1/5/10/15. There is no level term in any check: d20 + Attribute + Proficiency, against a
Threshold of 10 + the same. Vigor is `10 + Opening Vigor + (Ancestry Vigor + Endure Bonus) x level`,
the Opening Vigor paid once by your first Calling and the Endure Bonus read from your Endure rank. The Origin
Constellation's three Roots (Ancestry, Bloodline, Culture) pool into one rank, and Melee and Ranged
are parents whose Combat Styles' points count toward their rank once their Root is owned.

**The four Defenses.** Awareness, Evade, Guard, Endure are Constellations like any other, so each
is `Attribute + Proficiency`, with a Threshold of ten plus that. Size, Off-Guard, Frightened N,
Fatigued N, Wounds, a Parry weapon, a raised shield and a helm are folded in automatically, and
bonuses of the same type do not stack. Load Strain never touches Evade: it is a clock (the Wind
check at the end of every round for a fighter with Load Strain 1 or more, Fatigued 1 to 3, which a
fighter whose Endure Threshold already meets 10 + Load Strain never rolls, and which only ten
minutes' rest ends: a button on the Fatigued card, or a night's rest) and a penalty to Climb, Swim
and Stealth. A character begins Trained in two, and since 0.6.2 all four Defenses ship.

**The six-action round.** Six actions at the start of each round, one Maneuver per Opportunity or
Pass, a full circuit of Passes ending the round, Reactions paid from the same six, and Prepared
Maneuvers holding a reserve until your next Opportunity. The system spends what it can see (Strikes,
Reactions, Raise a Shield, Recenter, drawing and stowing, movement in Steps, Moves and Rushes) and
announces an overspend rather than refusing it.

**The Exchange.** Three Strikes on every weapon: Quick ❶, Deliberate ❷ and Committed ❸ (Prepared).
The defender's stance answers, read at the moment of the roll: Evade or Guard, or a Reaction built
on one of them (Void, Parry, Counter) that costs an action when the blow lands. The card then
settles Position: Expose a Zone, form a Bind or take Control, give ground or Step, riposte or
Counter. Intercept is offered when a foe Moves into your reach. Support and the Controlled penalty
are computed. There is no Multiple Attack Penalty. A Relevant Check lets the actor choose the
Constellation, says why on the card, and leaves the approval to the GM.

**Zones, Protection and damage.** Each Zone carries its own armor. Damage follows the printed order
of operations: Immunity, total, Weakness, Resistance, the critical doubling, a Deadly die,
Protection, Temporary Vigor, Vigor. Protection can never take a blow below 1; Resistance can. The
material step is automatic, so mail turns piercing poorly without anyone remembering it. A Quick
Strike and a Graze roll one die; an Exposed Zone's Protection is 0 only against a Deliberate or
Committed Strike.

**Vigor, Spent, Wounds and Dying.** At 0 Vigor you are Spent, not down: every Hit then Wounds the
Zone it strikes. Wounds are counted per Zone against a capacity set by Size, with the book's first
and final effects applied to the numbers where they are numbers. Dying begins when the Torso or the
Head takes its final Wound, Recovery is checked at the start of each round from a card, Wounds are
treated from the Zone, and Refusing Death is a button that cannot fail.

**Flares.** Any critical offers a Flare button on the chat card. It asks which Constellation the
roll belonged to, because the die knows it was a critical and only the table knows what it was
related to. The list shows the Constellations you have Opened (an Item or a Talent in them), with
a checkbox for the rest, and the sheet's Constellations tab has the same toggle, so a Constellation
you have never opened can be Flared from either; it then shows on your sheet at 0 points so the
Milestone point has somewhere to go. A Flare is said in chat whether it came from a card or from
the sheet, and the GM can light one from the party sheet with a reason that the card prints.

**The party.** A `party` Actor with one sheet (0.7.0, phase 1 of `party-sheet-plan.md`): the
roster as a status board of every member's level, Milestones, Hero Points, Vigor, Wounds, Dying,
Fatigued, Load Strain, Speed and Flares, read live and never copied; Begin session (every Hero
Point to 1) and Hero Point awards with a reason; the party's night; the Milestone award with its
preview, the book's Deferred Talent Point counted on the character when no Constellation is
Flared, and Take back; and a Skills grid of every member's Defenses, Initiative, Skills, Melee,
Ranged and Lores, each cell rolling as that member. Every rule effect runs through the member's
own methods and cards; the party is never a combatant. Loot, the road and Downtime are later
phases and are not built.

**Melee, Ranged and Weapon Handling.** A weapon in hand rolls your Melee Proficiency; one that
leaves it rolls Ranged. Intuitive weapons use the full rank, Practiced drops a rank without
Familiarity, and Technical drops you to Untrained. Familiarity is derived from what your Talents
recorded plus a list on the sheet.

## Compendia

| Pack | Contents |
|---|---|
| Constellations | The Constellations whose Root is enabled in the spreadsheets (13 of the 31 authored today, Endure among them since 0.6.1 and Awareness since 0.6.2, so every Defense), with their Key Attribute, category, parent and plate art |
| Talents | The enabled Talents (39 of the 177 authored today), foldered by Constellation. `Enabled? = Yes` in `data/*.xlsx` is what ships a row; the content index still names every Constellation so owned Talents of a disabled one resolve |
| Ancestries, Bloodlines, Cultures, Backgrounds & Callings | The enabled chassis Items (5 of the 13 authored today: the Human Ancestry, the Torchbearer Human Bloodline, the Serrovane Culture, the Acrobat Background and the Weaponmaster Calling). The five folders always ship |
| Equipment | The enabled rows of `data/equipment.xlsx` (today 4 of the 29 weapons, 9 of the 20 armor pieces and none of the 3 shields authored), under the same document ids the roster gave them. The four folders always ship |
| Maneuvers & Activities | 52 Maneuvers, Activities and Reactions today, foldered as the book groups them (Motion; Attack; Defense & Recovery; Watching, Deceiving & Helping; Handling Things; Special; Exploration Mode; Downtime Mode; Reactions). Those authored in `data/actions.xlsx` replace the roster's row of the same name, and only an enabled sheet row ships, so an action authored there but not enabled (Aid today) appears nowhere until its row reads Yes |
| Rules Reference | 20 pages of reference tables |
| Macros | Recenter, Recovery Check, A Night's Rest, Relevant Check, Roll Initiative by Activity |

Every one of these is generated from `data/*.xlsx` by way of `assets/trees.json`,
`assets/actions.json`, `assets/equipment.json` and `assets/roster.json`. Nothing in `packs/` is authored by hand. The Basic
Maneuvers in the Maneuvers pack are what every character's Maneuvers tab shows, read from the pack
rather than copied.

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
module/data/             Actor (character, adversary, party) and Item data models, and all the derived arithmetic
module/documents/        Actor, Item, Combat (the round and the Opportunities), action tracking, and the chat card behaviour
module/dice/             the check engine and the damage pipeline
module/canvas/           reach bands, the drag ruler, targeting arrows, and the grid geometry
module/apps/             the four sheets (character, adversary, party, Item), the creation wizard, the shared Flare picker and the Token HUD stance button
module/helpers/          the content registry, chargen data and rules, the stance model, the party operations, Handlebars helpers
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
- "Expose a plausible Zone" is a picker the attacker may use, never a rule the engine resolves.
- Bind writes on a partner you do not own, and Reaction charges on a defender you do not own, need
  that owner's click on the card.
- A Rush-length drag is charged its three actions at once; the telegraphing is the table's.
- Persistent Damage is an end-of-round reminder card; the amount is applied on the sheet by hand.
- A treated Wound is removed from the Zone rather than kept as a bound Wound for a week.
- Cover, Concealment and detection states are reference material, not automation.
- A Deferred Talent Point is a count on the character, not a lock: nothing stops a Talent drag and
  the count does not fall when one lands. The party sheet's Milestone award and Take back write
  numbers the GM could type by hand, and enforce nothing.
- The party's Notes tab is GM-only in the template and readable by any Observer from the console;
  nothing secret belongs on the party.
- Magic is not in the playtest, so it is not here.
