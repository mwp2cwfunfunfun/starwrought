# STARWROUGHT: working agreement

Classless d20 TTRPG, pf2e-inspired, data-first, built for Foundry VTT.
Full system rules live in `starwrought-core-design.md`. Read it before designing anything.

## Scope

**Application code is in scope (Mike, 2026-08-27).** The old standing rule ("Claude does not update
application code") is retired, not suspended. Claude edits the spreadsheets, the templates, the
pipeline scripts, and the generators, and runs the pipeline. No permission round-trip per file.

What replaces it is not a shorter fence but an ordinary engineering obligation: **know which files
are sources and which are output, and leave the repo building.**

### Sources, and what they generate

| Edit this | Never hand-edit this |
|---|---|
| `data/*.xlsx` | `assets/trees.json`, `backgrounds.json`, `languages.json`, `actions.json` (the converter writes them; `assets/parse_rules.mjs` then writes `rules` into them, 0.16.0) |
| `assets/roster.json` (hand-kept blocks) and `sheet_spec.json` | the `ancestries` block of `roster.json` (the converter overwrites it from `ancestries.xlsx`), and its `weaponsMelee`, `weaponsRanged`, `armorPieces` and `shields` blocks (overwritten from `equipment.xlsx`); `assets/equipment.json` |
| `assets/app_template.html`, `constellation_template.html` | `Starwrought_App.html`, `Starwrought_Talent_Constellations.html` |
| `assets/*.py`, `assets/build_phb.js` | `assets/constellations/*.png` and the `.plates.json` sidecar beside them, the PDFs, the compendium |
| `foundry/starwrought/FEATURES.md` | `Starwrought_Foundry_Features.docx` (`assets/build_features_docx.py` lays the Markdown out as a Word document for printing or a PDF) |
| `foundry/starwrought/` **except** `packs/`, `content/`, `assets/constellations/` | those three, which `assets/build_foundry.mjs` regenerates |
| `data/SYNC.json` (via `build_all.mjs --accept-phb`) | `foundry/starwrought/content/sync.json` |
| `data/conditions.xlsx` (0.33.0) | `assets/conditions.json`, the `conditions` block of `roster.json`, `foundry/starwrought/content/conditions.json` |

**The web app and the Foundry system are siblings, not a chain.** Both read `assets/trees.json`,
`assets/actions.json` and `assets/roster.json` (the Foundry build also reads `assets/equipment.json`,
whose rows the converter mirrors into the roster's equipment blocks for the app); neither reads the
other. Asked whether the app should read the Foundry
compendia instead (Mike, 2026-08-27): no. It would make one consumer depend on another consumer's
output, swap two JSON files for 364, and give the app a shape built for Foundry rather than the
tree structure it actually wants. The thing that keeps them in step is `build_all.mjs` and the
handbook rule, not a shared data path.

Hand-editing a generated file is not forbidden, it is simply pointless: the next pipeline run
destroys it. Fix the source.

### The pipeline

One command runs all of it, then checks for handbook drift and that the system's three version
stamps agree (`system.json`, `SYSTEM_VERSION` in `module/config/system.mjs`, and `--sw-css-version-<name>`
in each of the eleven stylesheets `system.json` lists, one per window since 0.10.1 with the map in
`foundry/starwrought/styles/README.md`; a release bumps them all, or every client sees the
stale-copy warning naming the file). The same check fails when a `.css` in `styles/` is not listed
in `system.json`, and when one selector list is declared twice anywhere in `styles/`, since two
declarations would make the load order decide which reads:

```
node assets/build_all.mjs              # every step below, in order, then the drift check
node assets/build_all.mjs --check      # only the drift check
node assets/build_all.mjs --skip-slow  # skip the plates, the sheets, and the compendium docx
node assets/build_all.mjs --accept-phb # record the current handbook as synced, once the work is done
node assets/build_all.mjs --content    # the content loop (0.8.0): spreadsheets to the web app and the pack sources, no compile, drift a warning
node assets/build_all.mjs --equipment  # the equipment workbook ALONE (0.30.0): equipment.json, the roster's four blocks, the web app, the pack sources
node assets/build_all.mjs --conditions # the Conditions workbook ALONE (0.33.0): conditions.json, the roster's conditions block, the web app, the system's content
```

**THE HANDBOOK RULE (Mike, 2026-08-27, standing).** When the PHB moves, everything downstream moves
with it: `data/*.xlsx`, the web app, the Foundry system, the system's `FEATURES.md`, and its
`CHANGELOG.md`, which gets an entry every time even if only to say what moved. `data/SYNC.json`
records the version the repository is synced to; `build_all.mjs` exits 1 while the handbook on the
shelf is newer, and refuses to stamp a new version until the changelog and the features file both
name it. The Foundry system carries the stamp into the game as `game.starwrought.rules.phb`.

**Since PHB v4.25 the rule has two halves (Mike, 2026-11-15; ruling 264).** "I removed ALL Talent
details in Chapter 6 as well as ALL of the Maneuver details from Chapter 8 from the PHB; it is a
lot of work to keep it consistent with the talent spreadsheets in the data folder. Once all of the
spreadsheets are finalized, I will use them to build that part of the PHB." So: **the handbook is
authoritative for the general rules and for the tables it still prints** (Chapters 1 to 5, 7 and
8's general rules, the Conditions and Traits tables, Chapter 5's equipment), and a change there
moves everything downstream as above; **`data/*.xlsx` is the ONLY source for what a Talent, a
Maneuver, an Activity or an Endeavor says**, a change there is the content loop's and never a
handbook sync, and no handbook redline is proposed for one.

**And a third part since 2026-11-15 (Mike; ruling 297): the equipment tables left the book.** "I
removed the armor and put in a placeholder ... Same for Shields ... And weapons": Chapter 5's
Armor Pieces, Shields, Melee Weapons and Ranged Weapons tables now read "This section will be
populated from the Spreadsheets in the StarWrought data folder". So **`data/equipment.xlsx` is
the ONLY source for a weapon, a piece of armor, a shield and a kind of ammunition**; the Weapon
Traits and Armor Traits tables and Chapter 5's prose are still the handbook's. Where this file
says above that the handbook is authoritative for "Chapter 5's equipment", read: for its trait
tables and its prose.

**And a fourth part since 2026-11-18 (Mike; ruling 322): the Conditions.** "can we build a
conditions.xlsx that includes every condition, and the automation effects (if any) of it?",
then, by question: the workbook is the source the system reads and **the only authority for
what a Condition says and does**. `data/conditions.xlsx` was filled once from the handbook's
v4.25 Conditions table; from then on the sheet is the word, a change to a row is the Conditions
build's (`build_all.mjs --conditions`) and never a handbook sync, and no handbook redline is
proposed for one. The table is still printed in the book (Mike takes it out when he chooses), so
the two may differ: the sheet wins, and nothing checks the book against it. Where this file
says above that the handbook is authoritative for "the Conditions and Traits tables", read: for
the Traits tables.

The individual steps, from the project root, in this order. They need `openpyxl`, `matplotlib`,
`reportlab`, `python-docx`, and the `docx` npm package; all are installed.

```
python assets/xlsx_to_trees.py        # data/*.xlsx -> trees/backgrounds/languages/actions/equipment JSON and the roster's generated blocks. Refuses to write on errors.
node   assets/parse_rules.mjs         # (0.16.0) every Automation cell parsed once with the system's grammar: `rules` into the JSON, the Root's chassis blocks into the roster records, `@Maneuver[...]` expanded. Exit 1 on a line it cannot read.
python assets/inject.py               # templates + JSON -> the two root HTML files
python assets/render_constellations.py # -> assets/constellations/*.png
python assets/sheet_gen.py            # -> the fillable and Mira character sheets
node   assets/build_phb.js            # -> Starwrought_Constellation_Compendium.docx
node   assets/test_rules.mjs          # the automation framework's self-test (0.9.0): exit 1 on a failing check, else "rules framework: N checks passed"
node   assets/build_foundry.mjs       # -> foundry/starwrought/{packs,content,assets/constellations}
python assets/build_features_docx.py  # FEATURES.md -> Starwrought_Foundry_Features.docx (print or PDF)
python assets/check_style.py          # the two absolute rules below, enforced. Exit 1 on a violation.
```

**Not a step, a status: `python assets/highlight_automation.py`** (2026-11-08; Mike: "Any automation
fields that I may have mis-typed, or for which there are not yet Kinds, highlight those cells in
red"). It reads every workbook directly, hands the Automation cells and the `@Maneuver[...]`
markers to `assets/lib/parse_cells.mjs` (the system's grammar and the build's resolver over the
trees and Maneuver rows read from the same workbooks, so it works while the converter is refusing
to write), paints a cell that does not read solid red with a comment giving the grammar's message
and why (mis-typed, no kind yet, not yet readable), clears its own red when the cell reads again
(a yellow of Mike's underneath is recorded and restored), and writes `automation-cells-report.md`
in the project root. `--dry-run` reports only. The workbooks are loaded with `rich_text=True`, so
the Effect cells' formatting survives the save; a workbook open in Excel is not written.

**The last line of every build is the report (0.20.1; Mike, 2026-11-08: "create an excel sheet
every build, with build issues/errors that I can fix/need to decide something/inconsistencies/
rulesdecisions. include your recommended solution as well").** `build_all.mjs` pipes every step's
output and, on every path out (clean, a failed step, stamps, drift, the stamp, `--check`), writes
`build/build-log.json` and runs `assets/build_report.py`, which writes `build-report.xlsx` in the
project root: Summary, Issues (Severity Error / Fix / Decision / Note, Where, the step's words,
the recommendation, first seen), Decisions, Red cells. It adds its own red-cell and index
analyses (importing `highlight_automation.py` and `index_sheets.py`, writing nothing) so a build
the converter refused still gets a full report. `assets/open_decisions.json` is HAND-KEPT: the
standing questions only Mike can close, one object each with its recommendation; add a row when
a sync or a build leaves one, mark it decided with the ruling number for one build, then delete
it. A new warning the pipeline learns to print gets its row in `RULES` in `build_report.py`, with
the recommendation, in the same commit. The report's exit code never fails a build.

**Also not a step: `python assets/index_sheets.py`** (0.20.0; Mike, 2026-11-08: "I need you to
generate/re-generate/update the _Tree Index tabs in all of them"). It brings every workbook's
`_Tree Index` up to the sheets it holds: a tree sheet with no row gets one with its Category
inferred from the workbook and its other cells blank and named in the report (Primary Attribute
and Parent are hand-kept, never guessed); an actions workbook's index gets one row per action with
the row's Type and the sheet's Category or name; an index row whose sheet or row is gone is
reported with the nearest name, never dropped; filled cells are never touched; `rich_text=True`;
saved only when a cell changed, after a copy to `backup/index-<date>/`; `--dry-run` reports only;
a workbook open in Excel is skipped. A sheet named `Lore (…)` is the index's `Lore` row.

`build_foundry.mjs` sits next to `build_phb.js` for the same reason: both read `trees.json`,
`actions.json` and `roster.json` (and `build_foundry.mjs` reads `equipment.json`), so both must
re-run whenever any of those change. It writes `packs/_source/*.json` and then
compiles the LevelDB compendia with `@foundryvtt/foundryvtt-cli` (a devDependency); `--no-compile`
stops after the sources. Document ids hash the pack plus the document name, so they survive a
rebuild, which matters because an id becomes a compendium UUID the moment a Talent lands on a
character sheet. `check_style.py` scans the system's `lang/en.json`, its templates, and
`packs/_source/`, so the Foundry content is held to the same two rules as everything else.
Since 0.9.0 `build_foundry.mjs` also imports the system's own grammar module,
`foundry/starwrought/module/rules/grammar.mjs` (pure, as `config.mjs` is), and parses every
Talent's and action's **Automation** cell through it: a line that does not parse fails the build
with `automation: <Constellation> / <Talent>, line <n>: <message> ("<text>")`, the Aura column's
precedent, and a clean cell is written onto the document as `system.automation` (the text) and
`system.rules` (the parsed rules). The converter copies the cell through as text and knows nothing
of the grammar, so Python and JavaScript never hold two parsers. `node assets/test_rules.mjs` is
the framework's self-test, run by `build_all.mjs` in every step-running mode (`--check` runs none) as the step `test_rules`, right
before `build_foundry`. One kind is defined since 0.10.0, `bonus` (the automation framework,
below), so a cell may hold blank lines, `#` comments and `bonus` lines; the summary line reads
`automation: N rules on M documents (K kinds in use)`, its plurals counted, or `automation: no
rules (1 kind defined, none in use)` while no cell uses the kind, which is today.

**THE CONTENT LOOP (Mike, 2026-10-03; system 0.8.0; rulings 115 to 117).** "I want the ability to
add to any of the data spreadsheets and run a command or a script to incorporate those into the
Foundry VTT module... (and add them into the local web app)." `node assets/build_all.mjs --content`,
or a double-click on `sync_content.cmd` in the project root, runs `xlsx_to_trees`, `inject`,
`render_constellations --changed` (a sidecar `assets/constellations/.plates.json` of tree hashes;
only a changed or new Constellation's plate is drawn, gone ones pruned), `build_foundry
--no-compile` and `check_style --quiet`, skips the sheets, the compendium docx and the features
docx, never compiles the LevelDB packs, and reports handbook drift under a "HANDBOOK DRIFT (a
warning in content mode)" banner and exits 0, because adding a Talent to a sheet is not a handbook
sync (ruling 115); **since 2026-11-07 it also runs `parse_rules --lenient`** (Mike, with new
sheets half-authored: "there are some duplicates and other missing items in terms of the
spreadsheets, but let's make a new build anyway"): an Automation line the grammar cannot read is
stored on its Item as an error entry (red on the sheet, skipped in play, the shape the client
gives a GM's bad textarea line) and listed under an "AUTOMATION ERRORS (a warning in content
mode)" banner, while the release pipeline still fails on the first such line; and the converter
resolves a Maneuver on two sheets of one workbook (an enabled row over a disabled one, else the
earlier sheet) and a tree indexed in two workbooks (the first read stands) with a warning each,
never an error, so a restructure in progress builds; a failing step and the stamp check still exit 1, and `--content` with
`--skip-slow`, `--check` or `--accept-phb` is an error (a handbook sync is never stamped from the
mode whose point is that it is not one). `build_all.mjs` resolves the Python its steps run with by
probing for the four modules they import (`STARWROUGHT_PYTHON`, the project's `.venv`, `python`,
`py -3`, then every install `py -0p` lists), makes `.venv` in the project root and installs the
modules into it when nothing on the machine has them, and prints the one it chose: Mike's first
double-click of `sync_content.cmd` ran as the PC's other account and found C:\Python313 without the
user-site modules Dad's account had (2026-10-03). `.venv/` is gitignored. `build_foundry.mjs` stamps every document with
`flags.starwrought.contentHash` (a short SHA-1 of its canonical content, keys sorted) and writes
`packs/_source/index.json` (`stamp`; a `build` hash over every document hash in id order, which
changes only when content does; `system`; and per pack every document and folder with `_id`,
`name`, `type`, `file`, `hash`), which Foundry serves as a static file. In the open world the GM
runs **Sync content** (`module/apps/content-sync.mjs`; Settings > STARWROUGHT > Sync content,
`game.starwrought.syncContent()`, and offered at load when the index's `build` differs from the
world setting `contentBuild`, recorded silently when the plan is empty): a diff of the index
against the compendia by id and hash, shown as a plan (create, update, delete, by name, folders
too; a pre-0.8.0 pack has no hashes, so its first plan is every document as an update) before it
is applied with each pack unlocked for the write and re-locked in a finally, `keepId` on creates,
`recursive: false, diff: false` on updates, stale system documents deleted by name (a GM's own
content belongs in the world; ruling 116), then `contentBuild` and `contentStamp` recorded,
`reloadContentIndexes()` (`helpers/content.mjs`) refreshing the registry, the chassis index, the
Basic Maneuvers and the party's Activities, every open sheet re-rendered and one GM-whispered card
as the record. Ticked by default, the sync also refreshes the characters' owned copies of changed
Items (found by their recorded compendium source, else by type and name), keeping `quantity`,
`state`, `raised`, `choice.value` and the copy's `_id`, written with `swAnnounced` (ruling 117).
The full `build_all.mjs` with Foundry closed is still what compiles the packs, for a release or a
fresh install. Since 0.9.0 the loop also runs `test_rules` (the automation framework's self-test)
before `build_foundry`, and `build_foundry` parses every Automation cell: a line the grammar does
not know fails the step naming the Constellation, the Talent and the line, before the sources are
written, so the open world never syncs a half-built set (the automation framework, below).

**The compiled packs are not in git, and since 0.8.0 they are a release artifact.**
`foundry/install.mjs` links the repo folder into Foundry's data directory, so a running Foundry
rewrites the LevelDB log and manifest files under `packs/<pack>/` every time a world opens;
committed, they dirtied the tree on every session. `packs/_source/*.json` is committed and is the
source of truth, with `index.json` beside it since 0.8.0; `build_foundry.mjs` compiles it locally,
with Foundry closed, and `.github/workflows/release.yml` compiles it again on a fresh checkout
before packaging. An open world is brought up to the sources by Sync content in game, never by a
recompile under it: the compile fails while Foundry holds the packs open, which is the restart the
content loop removes.

### What is expected of a change, not asked permission for

- **Back up before a destructive pass.** `backup/pre-<version>/` is the convention; two exist.
- **Leave it building.** `xlsx_to_trees.py` must report zero validation errors,
  `node assets/smoke_test.js <extracted app script>` must come back SMOKE CLEAN (extract the script
  with the one-liner in `data/README.txt`), and `python assets/check_style.py` must exit 0.
- **Look at it.** The app is HTML: serve it and drive it. Several real bugs in the v1.8 and v3.0
  syncs (mojibake on every plate, a migration that silently dropped a character's Calling, rows
  overflowing the sheet) were invisible to the test suites and obvious in a browser. The Foundry
  system is the same rule: `node foundry/install.mjs`, launch a world on it, and drive a character.
  Its first build had four bugs no unit test would have caught (a module namespace written to at
  init, `getRollData` mutating the live system object, Flares that would not turn off, and raw
  i18n keys on the adversary sheet), and every one of them was obvious on screen in a minute.
- **Say what you changed and what you left.** Version syncs get a `v<version>-sync-report.md` in the
  project root, listing the rulings made on ambiguous PHB text. Those reports are how the handbook
  gets corrected: v3.1 adopted most of the v3.0 report's rulings verbatim.

Still worth a question rather than a guess: **a rules ambiguity with two defensible readings**
(they go in the sync report), and **deleting authored game content**, which is Mike's call every time.

## Standing design rules

**The Root Rule (v0.38).** Every constellation root and every bloodline root must carry (1)
something that gets *rolled*, so the constellation can Flare from the one talent every member owns,
and (2) something that *improves at Expert/Master/Legendary*. The `X Training` roots are the model:
"add the constellation's proficiency to its checks" satisfies both in one clause. Scaling shape is
chosen for flavor, not uniformity (Rage graduates damage, halfling luck graduates uses per session,
Stonewise graduates reach). Keep ancestry and bloodline bonuses narrow and circumstantial, because
every character gets both roots free.

**VTT assumption (Mike's ruling, v0.40, standing).** STARWROUGHT assumes a virtual tabletop. Not
"supports one," assumes one. The grid is 1 foot, diagonals are measured exactly, and every weapon has
a reach in feet. There is no battlemat fallback and no theatre-of-the-mind mode, and Claude should
stop offering them.

What this licenses, and Claude should design accordingly: **arithmetic and tracked state are now
cheap, and decisions are the only real cost.** Per-zone Protection, the material-weakness step, the
damage order of operations, Exposed zones, Wounded, Dying, Persistent Damage, MAP, Load Strain,
attribute derivation and rank thresholds are all things software does for free. Do not simplify a
rule to spare a player arithmetic. Do simplify a rule that asks a player to hold more than one
decision in their head at once.

The standing risk to flag, not to solve: **a rule that needs GM judgement inside a formula cannot be
automated.** "Expose a plausible zone" is the current example. Prefer rules a machine can resolve, and
put the judgement at the edges rather than the middle.

**Style rule (standing, absolute).** No em-dashes in game prose, anywhere, ever. Use periods,
semicolons, colons, commas, or parentheses. Table null-markers and minus signs are fine.

**IP hygiene.** Mechanics may echo pf2e (ORC-licensed); names and prose must be original. No
Golarion proper nouns in anything shipping.

Both of the above are enforced by **`python assets/check_style.py`**, which exits 1 on a violation.
It reads the spreadsheets, the injected JSON, the templates, and the built HTML. Naming the games
themselves (pf2e, D&D) is a note, not a failure: the rule above permits echoing them, and an ORC
notice has to name pf2e. The handbook is scanned as advisory only, since it is Mike's to write.
A line marked `style-ok` is skipped; the only honest use is the migration rename maps, which have to
name the retired terms in order to rename them away.

**Flare triggers** are one universal rule (v0.11): a constellation Flares on a critical success or
critical failure on any roll with consequences, directly related to a talent in that constellation.
Per-tree trigger lists are flavor illustrations, never rules, and should all read as the universal
wording.

**Flares (0.6.3; sync report rulings 85 and 86).** A Constellation is *Opened* for a character when
they hold its Constellation Item or any Talent in it (the entries the data model's
`prepareConstellations` in `module/data/character/constellations.mjs` builds from Items; one drawn only because it is Flared is listed too). The
Flare dialog on a critical's card lists Opened Constellations only, the rolled one preselected, with
a checkbox "Show Constellations you have not opened" that adds every shipping Constellation
(`enabledConstellations()`, ruling 61) marked "(not opened)"; the sheet's Constellations tab has a
toolbar toggle "Show every Constellation" ("Opened only" while on) that adds the unopened ones as
slim, dimmed rows in their own category with a Flare control and the roll link, kept in the client
setting `showUnopenedConstellations` (scope client, no config entry; the button is the switch). The
Lore template is left out of both lists, as the Relevant Check picker leaves it out.
`SwActor#toggleFlare` posts the Flare card itself, lit or put out, spoken by the actor and public,
and `flareFromCard` posts nothing of its own, so a Flare is said once from either entry point;
putting out a Flare that was never lit writes and says nothing; the audit does not watch Flares,
the card is the announcement.

**Bonus types (Mike, 2026-09-26).** Three, named for where the number comes from: **Situation**
(where you stand and what is happening around you: cover, high ground, an ally's help, a foe
Off-Guard), **Condition** (something on you: Frightened, a stance), **Gear** (what you hold or wear:
a raised shield). **Stacking is PHB v4.21's (system 0.11.0; ruling 125): every bonus and penalty
adds, whatever its type, and one circumstance is counted once.** `resolveModifiers` in
`config/modifiers.mjs` sums, and collapses entries that share a `source` to the strongest positive
and strongest negative (Off-Guard and the first Torso Wound are one source; one Talent's `bonus`
lines on one target are one), so the types are labels for where a number comes from and no longer
a stacking rule. Through 0.10.1 it was highest bonus and worst penalty of each type, added across
types. They were circumstance, status and item until PHB v3.3; the engine still maps the old
names (`LEGACY_BONUS_TYPES` in `config.mjs`) for macros that pass typed modifiers, and
`check_style.py` counts the old words left in shipping content as an advisory note (both the
"+2 circumstance bonus" and the elided "+2 circumstance to Evade" forms), because the spreadsheets
are being brought across by hand during the automation pass. Untyped is for the base terms of a
check and the system's own flat adjustments (Load Strain, the Multiple Attack Penalty, the sheet's
adjustment fields); no Talent bonus is untyped. **Weapon traits are Situation** (Mike's ruling,
2026-09-26): Parry, Sweep and Unwieldy describe what the weapon lets you do or stops you doing in
the moment, not what the weapon is. Gear is reserved for something intrinsic to the piece itself,
such as its quality or, later, a magical property. A raised shield's bonus to Guard is Gear.

**Rank math (PHB v4.10, groups and dice PHB v4.21).** Trained 1 pt, Expert 4, Master 9, Legendary
16, gated at L1/L5/L10/L15. The Proficiency Bonus is +3 / +6 / +9 / +12 (Untrained +0), and **level
never touches the die**: a check is d20 + Attribute Bonus + Proficiency Bonus + bonuses and
penalties, and a Threshold is 10 + the same. Every talent costs 1. Capstones (★) are tier L and need
a Master talent in the same constellation. Attribute bonus = points ÷ 4, rounded down (0-3 = +0,
4-7 = +1), **no maximum** since v4.21 (the +5 cap was the old Key Terms sentence; ruling 158;
`ATTRIBUTE_MAX` is Infinity). **There is no min +1.** A single point in a constellation buys
proficiency, not an attribute bonus. **A tree with a `Parent` is a group** (v4.21: a Combat Style
within Melee or Ranged, a magical specialty within its discipline): it keeps its Item, plate, Flare
and row but has no rank of its own; its row wears the parent's rank, bonus and pool
(`isGroupSlug`, `group` on the Constellation Item and the content index), its Talents count toward
the parent once the parent's Root is owned and cannot be bought before it (ruling 127; `canBuy`),
and an Automation `if` may not name one. **The Origin is a Constellation the engine can name**
(`SW.ORIGIN_SLUG`, `system.origin`, `proficiency("origin")`): the pooled Ancestry, Bloodline and
Culture rank, so `if Origin is Expert` reads. **Weapon dice are the rank's** (ruling 153): one at
Trained, two at Expert, three at Master, four at Legendary in the Melee or Ranged rank the Strike
rolled (`WEAPON_DICE_BY_RANK`), one on a Quick Strike or a Graze, and no specialization damage; the
level table (2 at L4 to 5 at L16) is gone.

**The Strike Attribute (PHB v4.21, The Attack; ruling 129).** "Melee: Might, or Agility if the
weapon has the Finesse trait. Ranged: Agility, or Might if the weapon has the Thrown trait." And:
"A Strike made as part of another Maneuver ... If that Maneuver's Key Attribute has a higher bonus
than the Strike's normal Attribute, you may use it instead." Implemented: `attackAttribute` in
`module/data/items/weapon.mjs` is Agility for Finesse and for a ranged weapon, Might otherwise;
`strikeAttributeFor(weapon, { thrown, maneuver })` in `module/data/actor.mjs` reads Might for a
throw (a Finesse dagger thrown included, the book's words taken literally) and the Maneuver's Key
Attribute when one is passed and higher; `maneuverChoicesFor` lists the owned Talents and Maneuvers
whose Key Attribute beats the weapon's, which the roll dialog offers as "As part of a Maneuver",
none by default, and the card says "via <Maneuver>". The v4.14 Combat Style substitution, the
weapon's `system.style` field and the Composite trait are gone (a group has no Attribute of its own
to lend; `migrateData` deletes the field).

**The attack flow (Mike, 2026-10-01; system 0.5.0, sync report ruling 65; not optional and the
only path since 0.12.0, rulings 159 to 163).** Every attack at a target declares first and locks:
a Strike from the weapon row, an adversary's attack row, a spell's Cast ❷ ❸ ❹, a Reaction Strike
(Intercept, the Riposte); every defender commits one of the two Defenses the Threat permits (Evade
or Guard for a Blow; a Blast Evade or Endure, a Blight Endure or Awareness, a Beguilement Awareness
or Guard, or the sheet's `Defenses` column) and an answer (nothing, an owned Reaction, or a ⓿↺
Posture Talent with the Zone it Exposes; against a Reaction Strike the basic Defense alone) in
private; all reveal at once; then the players roll: a player-controlled attacker rolls Attack once
FOR EACH defender, each die against that defender's Threshold alone (0.26.0, ruling 252; PHB
v4.25; one die against them all through 0.25.0), a player-controlled defender of an adversary's
Blow rolls Defense against the Attack Threshold, and player against player is never an opposed
roll. **No
Defense is ever chosen by the system** (Mike, 2026-11-05: "no applying a default, ever"; ruling
159): there is no standing stance (0.12.0 removed `system.stance`, the chips, the HUD button and
every reader; the migration deletes the field), the prompt opens with nothing selected and Commit
disabled, the coordinator refuses to reveal or resolve a pairing with no commitment, and with no
GM connected an adversary's Blow waits for one (ruling 162; the card says who waits). The GM answers
for an absent player from explicit rows in their own prompt (`gmDefendAbsent`), never by a default.
**The flow is not optional** (Mike: "critical to the functioning of the system"; ruling 160): the
`attackFlow` setting is gone; a Strike or Cast with no target rolls against a typed Threshold
because there is no defender. The coordinator (the GM's client when one is connected, else the
attacker's) is the only writer of the attack card and the only holder of commitments before the
reveal; every change is a socket request with a revision number and an ownership check, with the
asking user read from the server's stamp on the socket message and the state taken from the card's
flags, never from a broadcast. Since 0.12.0 the coordinator is three files: `attack-socket.mjs`
(the wire: delivery to one user, the reply's correlation, the timeout, the dispatch with the
server's sender; it reads no revision, ownership or election), `attack-source.mjs` (what the attack
is: `resolveSource` reads a weapon, an attack row or a spell Talent off the attacker's own Items,
so the Threat, the permitted Defenses and the cost are never the declaring client's; `maneuverFrom`,
`costOf`, `describe`, `castOutcomes`, `resolveArgs`, `rollBlind`) and `attack-coordinator.mjs`
(how the table agrees). The record (`attack-workflow.mjs`, pure) carries `maneuver.source`,
`reaction`, `basicOnly`, `threat`, `defenses` and `spell`, with `AttackWorkflow.profileFor` the one
reading of what a defender may answer with and `waitingForGm` the no-GM rule; `legalAnswers`,
`isLegalAnswer` and `defenseThresholdFor` take the permitted pair, basic-only and melee. Decisions
are made in the Combat Prompt window, chat is the record and the recovery, the sheet is the
reference. Inside the flow adversary Thresholds are never shown to players, a Reaction Strike's
and a Cast's included. Since 0.5.3 the same system socket
also carries `damage:*` and `reroll:*` requests to the active GM's client (`chat.mjs`,
`onChatSocket`, since 0.10.1 a router over the card families in `documents/cards/`): a player's
Apply on a creature they cannot write, and a die thrown again on the roller's client but read
against a hidden Threshold on the GM's. Both read everything that matters
from the chat message itself and the asker from the server's stamp, as the coordinator does. Since
0.7.1 it also carries `party:*` (`documents/party-socket.mjs`, `onPartySocket`): a player's Take
from or Give to the party's loot, run on the active GM's client in arrival order, the destination
written before the source, the asker from the server's stamp and the payload trusted for nothing
but ids and a count. The router in `starwrought.mjs` is one line per listener:
`/^(damage|reroll|expose):/` to `onChatSocket`, `/^party:/` to `onPartySocket`, everything else to
the attack coordinator. **A Cast is in the flow since 0.12.0** (ruling 163; PHB v4.21's spells,
rulings 135 and 136): `SwActor#castSpell` (`documents/actor/cast.mjs`) Prepares a Focused or
Committed Cast in an encounter (every target remembered in `preparing.targetUuids`), declares a
Cast with targets through `AttackCoordinator.declare({ talentId, cast, targets })`, pays the Cast's
actions as the declaration stands, and rolls the discipline's Proficiency and Key Attribute blind
at the roll step; `SwCheck.resolveAgainst` with `source: "spell"` resolves each pairing with no
Strike, the spell's three Cast texts as the outcome rows and its damage buttons, and `rerollCard`
keeps a spell card a spell card. An adversary casts nothing through the system (`Cast.npc`). The
0.11.0 reading of the higher of the two Thresholds, the last Defense the system chose, is gone.

**Six actions a round (PHB v4.10).** Every combatant gets six actions at the start of each round,
spent across Opportunities (one Maneuver per Opportunity, or Pass; a full circuit of Passes ends the
round). Reactions ↺ are paid from the same six. Costs are printed ⓿ ❶ ❷ ❸ (up to ❻); a Maneuver of
three or more actions is Prepared (one now, the rest reserved, resolved at the next Opportunity;
a Focused ❸ or Committed ❹ Cast too). There is no Multiple Attack Penalty. **Reactions are Talents
(PHB v4.21; rulings 130 to 133):** `SW.REACTIONS` in `config/exchange.mjs`, keyed by
`slugify(plainName(name))` (give-ground, set-your-feet, sidestep, slip-the-line, drop-flat, parry,
riposte, kneel-behind-the-shield, deflecting-palms, cover-the-angle, intercept), each with its
kind, cost, Defense, bonus, melee-only and rigid flags, `onStop`, `exposes` and `drawback`; a
character owns one by owning the Talent or the Training root that grants it (`ROOT_REACTIONS`:
Evade Training Give Ground, Guard Training Set Your Feet, Melee Training Intercept), an adversary
owns them all; `ownedReactions` and `legalAnswers` in `helpers/answers.mjs` are the one reading.
One answer per attack, a ❶↺ Reaction or a ⓿↺ Posture; Void and Counter are gone from the book, and
no stance exists since 0.12.0 (the Defense is committed per attack, ruling 159). Movement: Rush ❷ for
three Speeds (`RUSH_COST`, `RUSH_MULTIPLIER`), Leap ❶ to ❸ at ½, 1 and 1½ Speed less Strain
(`LEAP_STEPS`), Crawl at half the Speed you had before the final Legs Wound (`CRAWL_DIVISOR`;
ruling 138); Support to +4 (`SUPPORT_MAX`); a Quick Strike's Miss Exposes nothing
(`STRIKE_KINDS.quick.exposeOnMiss`, Table 9); Sizes are penalties only (ruling 139). Vigor replaces Hit Points; at 0 Vigor you are Spent and every
Hit Wounds a Zone; Wounds are per Zone (capacity 2 for Medium or smaller) and the Torso's or Head's
final Wound is Dying.

**Vigor (PHB v4.21).** Vigor max = 10 + your first Calling's Opening Vigor + Ancestry Vigor ×
level, plus any `bonuses.vigor` adjustment (`data/character/vigor.mjs`). Opening Vigor is paid
once: Berserker 12, Ambusher 8, Hunter 10, Bravo 10, Weaponmaster 10, and the casters per their root
texts, Spellshaper 6, Blood Mage 8, Necromancer 6, Summoner 6, Spellblade 8 (Mike's ruling 152; the
Chapter 3 table disagrees and is redlined in
`Starwrought_Players_Handbook_v4.21_callings-vigor_proposal.docx`); the roster's `callings` block,
third column. Ancestry Vigor is per level (Human 8). The Endure Bonus of v4.11 to v4.15 is gone
(ruling 151, Mike's by silence): Endure Training grants Load Strain relief and nothing to Vigor.
**Two rests** (ruling 144): a night's rest restores all Vigor and clears Fatigued; ten minutes' rest
(`restTenMinutes`, the Overview's second button and the Fatigued card's) restores level × Presence
when Presence is positive, else nothing, and ends Fatigued. **Comets** replace the Deferred Talent
Point (`system.comets`, migrated from `deferred`; ruling 145): one with every level, and a
Milestone point becomes one when no Flare can take it; counted, never enforced. Endure Training
ships since 0.6.1 (ruling 77) and Awareness Training since 0.6.2 (ruling 83), so every Defense can
be Trained in Foundry.

**Load Strain (PHB v4.21).** Load Strain = the Load of the armor worn and a shield carried, less 1
for a **Fitted Harness** (three worn pieces with the Fitted trait, each ticked `adjusted` on its
Item, the player's word; `FITTED_ZONES`, `FITTED_RELIEF`), less Endure relief (Trained 1, Expert 2,
Master 3, Legendary 4; `LOAD_RELIEF` in `config.mjs`), to a minimum of 0. The matched harness and
its +1 Torso Protection are gone with the material tables. It never touches Evade and is no blanket
penalty on Might or Agility: it shortens Rush and Leap by its value in feet, and it is a Condition
penalty on Stealth and Acrobatics automatically and on Climb and Swim by the Athletics dialog's
unticked "Load Strain (Climb or Swim)" toggle (`STRAIN_CHECKS`, `STRAIN_TYPE`), since the system
cannot tell a Climb from a grapple. **Wind (v4.21):** at the end of every round in an encounter,
from round 1, a fighter with Load Strain 1 or more rolls Endure against 10 + Load Strain; a failure
raises Fatigued by 1, a critical failure by 2 (`WIND_FAIL_RISE`, `WIND_CRIT_FAIL_RISE`), to Fatigued
3 (−N Condition to all four Defenses and attack rolls). The Endure Threshold exemption of v4.12 to
v4.15 (ruling 74) is gone from the book and the system (ruling 150); the data model's `wind` keeps
`threshold`, `endureThreshold` and `due`, and the field's tooltip gives both numbers. Fatigued ends
with ten minutes' rest and with nothing else (Mike, 2026-10-02): the Combat's end does not clear
it; a night's rest does, and the Fatigued card's button runs `restTenMinutes`. **Armor types, not
materials** (ruling 149): the Armor sheet's `Type` column (padded, leather, mail, lamellar,
brigandine, splint, plate; `ARMOR_TYPES`, Scale migrating to Lamellar) names what a piece is and
turns no damage type poorly; the material-weakness step and the adversary Zone's `material` are
gone. Clatter counts mail, lamellar, brigandine, splint and plate, a Muffled piece never (ruling
142). **Visored** (ruling 140): a Head piece with the trait stores `lowered`; lowered it is −1 Gear
on Awareness checks, the Awareness Threshold and Initiative (`VISOR_PENALTY`), raised it Protects 1
less (`VISOR_RAISED_PROTECTION`); `SwItem#toggleVisor` and the Lower the Visor and Raise the Visor
rows in `documents/maneuvers.mjs` pay the action. The helm penalties by name are gone. **Attended**
(ruling 82) stays display only: `attended` and `donTimeAlone` on the armor Item and the Equipment
tab's time tag. The twelve armor traits are the roster's hand-kept `armorTraits` block. Rulings 68
to 71, 74, 75, 79 to 84, 140 to 144, 149, 150.

**The party (0.7.0; `party-sheet-plan.md`, phase 1; rulings 91 to 95).** A `party` Actor type
(`SW.PARTY_TYPE` in `config.mjs`) whose data model `SwPartyData` extends `TypeDataModel` directly,
never `SwActorData`, so it has no Zones, Wounds, Vigor, stance or actions, and whose `_preCreate`
makes it linked and Observer by default: the GM writes it, every player opens it, and nothing
secret goes on it (the Notes tab is a convenience, not a vault). Rule state stays on the characters
(level, Milestones, Hero Points, Flares, the `deferred` count) and the sheet reads it live at
render, computing nothing member-dependent in the party's own `prepareDerivedData` and
re-rendering on the member hooks (`updateActor`, Items and Active Effects on a member) debounced
on a timer, never a requestAnimationFrame latch. Every rule effect runs through the member's
existing method (`toggleFlare`, `restForTheNight`, `rollCheck`, `rollDefense`, the Combat's
Initiative roll) and every direct write is `actor.update(..., { swAnnounced: true })`, so the party
adds buttons and a handful of cards, never a second rules engine or a doubled Adjusted card. A
party is never a combatant: Support's ally count (`supportFor` in `documents/actor/attack.mjs`),
`actorsIn` and `canAct` (`combat.mjs`), the tracker readout and `SwCheck.roll` skip or refuse
`SW.PARTY_TYPE` explicitly, and nothing draws or counts its token. The
rulings: 91 a Milestone award goes to every member by default, with a checkbox per member to
withhold it; 92 a level from the fourth Milestone raises current Vigor by the maximum's rise; 93
Begin session sets every member's Hero Points to exactly 1; 94 Deferred Talent Points are counted
on the character (`system.deferred`; `system.comets` since 0.11.0, PHB v4.21's name) and nothing
is enforced; 95 players see every member's
Thresholds on the Skills grid. `MILESTONES_PER_LEVEL` lives in `config.mjs` beside
`HERO_POINTS_MAX`; the Flare dialog is the shared `pickFlare` in `module/apps/flare-picker.mjs`,
which `flareFromCard` and the roster both call, and `toggleFlare(slug, state, { reason })` prints
the reason on the lit card and the Deferred reminder while the count is above 0. Since 0.7.1
(phase 2; rulings 96 to 100) the party also holds the loot (embedded Items of `SW.PHYSICAL_TYPES`
only; `SwItem._preCreate` refuses the rest) and a purse (`system.currency`, the character's
shape), and both are a convenience with no rule authority: the book has no shared loot and no
party purse, so they move Items and coin and value nothing (a row prints the Item's price string
and nothing computes with it; ruling 96). A player's Take or Give is two writes an Observer cannot
make, so it runs on the active GM's client over the system socket as `party:take` or `party:give`
(`documents/party-socket.mjs`; ruling 97: the asker from the server's stamp, the destination
written before the source, arrival order, and with no GM connected the controls say so and write
nothing), while the GM's own moves run the same code locally; a party Item dropped on a character
sheet moves the whole stack (ruling 98), Split divides copper equally and leaves the remainder in
the purse (ruling 99), and Ask everyone posts one party card with a Roll button per member that
only the owner or the GM can press, the Threshold hidden from players unless the GM shows it
(ruling 100). Since 0.7.2 (phase 3; rulings 101 to 107) the party has the **On the road** tab
(`templates/actor/party-road.hbs`; the helpers in `module/helpers/party.mjs`). Each member's
Exploration Activity is `system.exploration { activity, constellation }` on the character (the
compendium `_id` of the Activity Item in the Actions pack's Exploration Mode folder, "" meaning
Travel; Investigate's chosen slug), written directly by the owner or the GM with `swAnnounced`
and said in one line by the member (`setActivity`; ruling 106: the pick is the character's, and
an owner may write their own Actor, so no relay and no GM connected). The Activity data is the
rows of `data/activities.xlsx` since 0.20.0 (PHB v4.24's Activities table; two positional columns
on the roster's hand-kept `explorationActions` rows through 0.19.0, ruling 103): the Movement
Speed, Check and Initiative columns (Check and Initiative "", a Constellation or Defense name as
the trees print it, or `choice` for the member's own pick), which `build_foundry.mjs` writes onto
the Activity Item under the id the roster row had as
`system.exploration { travel, check, initiative, effect }` and, for a named check-now
Constellation, `system.check`; the `effect` tags scout and defend are set by the row's name, since
the Scout's bonus and Step and the Defender's shield are not Constellations (ruling 104;
`SW.ACTIVITY_SPEEDS`, `SW.TERRAIN`, `SW.EXPLORATION_EFFECTS`, `SW.SCOUT_INITIATIVE_BONUS` and
`SW.ACTIVITY_CHOICE` in `config.mjs`; the web app slices the rows to three columns, and
`build_phb.js` and `phb_format.py` read by position). The party's Travel Speed (`partyTravel`) is
the slowest member's `moveSpeed` × their Activity's multiplier, × the terrain in
`system.travel.terrain` on the party, through `SW.TRAVEL`, named for the pacesetter and display
only (ruling 102). A Fatigued member is locked to Travel with the reason and the stored pick
untouched (`activityOf`; ruling 101). An Activity's own Roll goes through the member's check with
no Threshold, Investigate opens the Relevant Check picker on the chosen slug
(`rollRelevantCheck({ dialog: true, slug })`), and Look Harmless's Requirements are a warning from
live data (`activityWarnings`; ruling 107). `sayThePlan` posts the record. `beginEncounter` (GM
only) puts every member's tokens on the viewed scene into a Combat (an unstarted one reused) and
writes `flags.starwrought.initiativeConstellation` and `initiativeModifiers` (one +1 Situation
entry per Scout present, for every other member present; a member with no token on the scene
neither gives nor gets one) on their Combatants, raises a Defender's held shield with
no action spent, leaves a Combatant that has rolled alone, and posts one card; nothing rolls
there. `SwCombatant._getInitiativeFormula` (the modifiers one per type at most),
`rollInitiativeWithCheck` (slug and modifiers defaulting to the flags), the character sheet's Roll
Initiative and the grid's cell all read the flags (ruling 105; plan risk 10 closed). The system
runs ahead of PHB v4.15 on four sentences and a strike, carried as tracked changes in
`Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx` (`assets/phb_propose.py`,
`PROPOSALS["on-the-road"]`); `data/SYNC.json` is untouched. Since 0.7.3 (phase 3's second cut;
rulings 108 to 110) the Activity's roll is remembered on the character: `system.exploration.roll
{ slug, total, natural, time }` on `SwCharacterData`, written on the roller's own client from the
`starwrought.check` hook (`rememberActivityRoll` and `registerRoadHooks` in
`module/helpers/party.mjs`, registered at ready in `starwrought.mjs` beside the Activities-cache
invalidation) when the roller is a character the user owns, the result's kind is "check" and its
Constellation is the one the Activity rolls now (`activityCheckSlug`: the Item's `check` slug, or
`memberPick` for Investigate) and its card was public (a blind or whispered roll is not written,
since the chip is public), with `swAnnounced` and no card of its own, since the roll's card is
the record of the die (ruling 110); never an Initiative or Attack roll nor a Defense rolled in
answer to an Attack (a Defense rolled for its own sake, a Search's Awareness, arrives as a check
and is), never another Constellation, and cleared by `setActivity` in the same update when the
pick changes (ruling 108). The record carries the check's typed extras (`roll.modifiers`, from
`result.extras`, which `SwCheck.roll` now puts on every result). The road row shows it as a chip (`roadRoll`: name, total, die, a relative time, `usable`
when the slug is `initiativeFor`'s; a roll whose slug is no longer the check-now Constellation is
stale and shown as nothing), Say the plan prints it, and `beginEncounter(party, { keep })` keeps
a ticked member's roll as Initiative: the sheet's `beginEncounter` action asks first through a
`DialogV2` with one checkbox per member `keepableRolls` finds (present on the viewed scene,
`usable`, Combatant unrolled), ticked by default, and a kept member's unrolled Combatants get
`combat.setInitiative(id, value)` where `value` is the natural die plus
`SwCheck.previewTotal(actor, { kind: "initiative", slug, modifiers: [...scouts, ...roll.modifiers] })`,
the same die re-counted as an Initiative in one typed-stacking pass (the helm where the check
lacked it, the sheet's Initiative adjustment, the Scouts' +1 stacking with a check's own Situation
entry by the rule), and the card says so with the difference signed when it is not zero (ruling
109). **Ruling 111 (Mike, 2026-10-02, 0.7.4): an Initiative rolled with a Constellation carries
every modifier that Constellation's check does** ("ALL active modifiers for any roll should be
applied even if that roll is used for initiative"): `SwCheck`'s Initiative assembly is the check
assembly for the slug (the check adjustment, Load Strain on Stealth) plus Initiative's own terms
(the helm, the Initiative adjustment, the Combatant's modifiers); through 0.7.3 a Stealth Initiative
took neither Load Strain nor the check adjustment. Nothing computes with the record but that,
nothing is enforced (the GM unticks a box), and the remembered roll stays afterwards. **Since 0.7.5
(phase 4, the plan's last; rulings 112 to 114) the On the road tab ends in a Downtime panel**
(`party-road.hbs`, below the member rows, its own heading). `system.downtime.days` on the party
(`SwPartyData`; an integer, min 0, initial 0) is the GM's "you have ten days" (PHB P348): typed by
the GM in the party form's own field, shown to players as a number, and nothing counts it down,
spends it or refuses anything for want of it; nothing is derived from it (ruling 112). The three
Downtime Activities print from the Actions pack's "Downtime Mode" folder with their Duration
(`system.requirements`) and Effect (`downtimeActivities` in `module/helpers/party.mjs`, the
category read off the Item since the model does not flag it, cached per session exactly as
`explorationActivities` is, a world action Item of the same name and category replacing the
printed one, and `invalidateExplorationActivities` clearing both caches, so no new hook), data
first: a row Mike adds to the roster's hand-kept `downtimeActions` block appears with no code
change. Per member a Train control (the owner's or the GM's; `train` in `helpers/party.mjs`,
Owner permission checked first) opens `pickFlare(actor, { askReason: false })`, the dialog the
critical card and the roster's Flare award use, and lights the pick through
`toggleFlare(slug, true, { trained: true })`, whose card says "Flared by seven days' training."
(`STARWROUGHT.Flare.trained`) in place of the GM's reason line, so the Flare is said once as every
Flare is; then the character records `flags.starwrought.trainedAt { level, milestone, time }` (a
flag, not schema, as the plan says; `trainedAt` reads it, `trainUsed` compares it). While that
equals the member's current level and Milestone count exactly the control is amber
(`sw-train-used`) with "Train already used since the last Milestone" as its tooltip, and the card
says so too, and it refuses nothing (decision 14: the system prevents nothing anywhere else, and a
GM may rule an exception); the next Milestone award makes the record stale by comparison and
nothing clears it; a Constellation already lit is not lit again (`toggleFlare` skips the write),
but the training line is still said, with "was already Flared; nothing on the sheet changes"
beneath it, a line every caller lighting a lit Constellation now gets (ruling 113). Retrain and
Provision print their rows and one line each saying they are done
by hand: Retrain's Talent Point is moved by dragging as today and the restrictions are the player's
and the GM's to honour; Provision's buying and selling, the half price and the uncommon-goods
check are the table's; the system adds no control for either (ruling 114). A Train is a write to
the member's own Actor (the Flare and the flag), so no relay and no GM connected; the Days field is
the GM's own write. The system runs ahead of PHB v4.15 on one clause, Table 96's Train row counted
for each character (the plan's handbook item 11: "only once between one Milestone and the next,
counted for each character"), carried as a tracked change in
`Starwrought_Players_Handbook_v4.15_downtime_proposal.docx` (`assets/phb_propose.py`,
`PROPOSALS["downtime"]`); `data/SYNC.json` is untouched. The plan is built; what remains of it is
Mike's (Known outstanding work, below).

**The automation framework (0.9.0; `automation-plan.md`; rulings 118 to 120).** Mike, 2026-10-03:
"I'd like an Automation field in the data .xlsx files. And based on what is in there, when I run
sync_content.cmd (or when you run it as part of a build), it will create the Foundry VTT automation
code. However, I want to make sure the Foundry VTT automation code is well-built. For example, if I
create an automation syntax for the Torchbearer 15' aura, we should create the syntax that will
work for OTHER auras, too, without additional coding." Then: "Important - do NOT survey the talents
yet or build ANY of the automation hooks. just build the framework. we will build automation syntax
hooks one at a time." So 0.9.0 is the skeleton, and **it does nothing in play**. The pieces: an
`Automation` column on every tree sheet (the action sheets had one), copied through by the
converter as `automation` on the node with no parsing, so Python never holds a second grammar; one
grammar module, `foundry/starwrought/module/rules/grammar.mjs`, pure (no Foundry global at module
scope, no i18n inside; the sheet localizes around it and the build prints its plain English),
imported by `build_foundry.mjs` at build time and by the client at runtime so both parse a cell
identically (`parseAutomation(text, context) -> { rules, errors }`, `summarize(rule)`,
`RuleSyntaxError` with `line` and `text`, `splitArgs`, `keyValues`, `KIND_WORD`); the cell one
rule per line, `kind: arguments`, the colon optional without arguments, blank lines ignored, a `#`
line a comment, the kind word everything up to the first `:` or whitespace, lower-cased; a
registry of rule kinds in `module/rules/kinds/index.mjs` (`KINDS`, `registerKind`, `kindOf`,
`knownKinds`) that registered nothing in 0.9.0 and registers `bonus` since 0.10.0, a kind being
one file in `module/rules/kinds/` exporting
`{ id, aliases, parse(args, context), summary(rule), hooks }` with `registerKind` refusing a
definition missing `id`, `parse` or `summary` or whose id or alias is taken, and the context for
messages `{ itemName, constellation, itemType, line }`; the build failing on a line that does not
parse with `automation: <Constellation> / <Talent>, line <n>: <message> ("<text>")`, the Aura
column's precedent, so `sync_content.cmd` stops before the sources are written (ruling 118), and
with the registry empty the message `unknown rule kind "<word>" (no rule kinds are defined yet)`,
else `known kinds: a, b, c`; `system.automation` and `system.rules` on the Talent, action and
Constellation Items (`{ kind, line, text, ...data }` per rule, `data` whatever the kind's `parse`
returned; `{ error, line, text }` for a line a GM's edit of the textarea left unparsed, written by
`SwItem._preUpdate` so the text always saves and the sheet shows what is wrong, never by the
build, which fails instead, and never refused), with `ruleLines` derived for the sheet;
`collectRules(actor)` in `module/rules/engine.mjs` indexing them on the character and the
adversary at prepare as `system.rules { all, byKind, unknown }` (an error entry or an unknown kind
into `unknown` with its reason), first thing in `prepareDerivedData` before the Constellations,
with `SwActor#rulesOfKind(kind)` reading `byKind`, so a kind's engine hook can later ask without
walking the Items; the Item sheet's Automation panel on Talents and Constellations as well as
Maneuvers, with its **As read** list (the kind word in a tag, the summary, a red row for an error
or an unknown kind, and "No rules." for an empty list; `STARWROUGHT.Rules.*`); and
`assets/test_rules.mjs`, the self-test, as
the `test_rules` step of every `build_all.mjs` mode before `build_foundry`. **The rule: kinds are
added one at a time, with Mike** (ruling 119), each with its file, its hook (defined with the kind
that needs it and wired nowhere before: a hook point chosen before its first kind is a guess), its
checks in `test_rules.mjs`, its line in `data/README.txt` naming its syntax, and its CHANGELOG and
FEATURES prose, by the recipe in `module/rules/README.md`; the first was `bonus` (0.10.0, below),
the next is the aura, for Torchbearer, and a kind serves every Talent that uses its word. Nothing
generates JavaScript from a cell: the cell is data and the engine is the only code, which is what
makes "work for OTHER auras, too, without additional coding" true by construction. The content
loop carries a cell's rules to an open world as any field, and the copies refresh (0.8.0)
overwrites an owned copy's `system.automation` and `system.rules` from the source, since the cell
is the author (ruling 120). In 0.9.0 nothing in `module/rules/` was called by a roll, the attack
flow, the damage pipeline, a condition, movement or the auras on the map, and no Talent's Effect
was read to find out which kinds the book wants: both by instruction; since 0.10.0 the check
engine and the Defense pass call the `modifiers` hook point (below), and nothing else does. Mike's
decisions, recorded in the plan: the first kind's syntax (settled, ruling 121); whether the web app
and the compendium docx should print the cell (neither does); whether an edited copy's Automation
should survive a refresh.

**The first kind, `bonus` (0.10.0; rulings 121 to 124).** Mike, 2026-10-03: "okay, first
automation kind we will create is the Human Ancestry one. The Effect is: 'You gain a +1 Condition
bonus on checks to Aid. If you are Expert in Human, this becomes a +2 Condition bonus. If you are
Master, +3. If you are Legendary, +4.' So we need Automation for something like ... IF
(Constellation Proficiency = VALUE) where VALUE = Untrained, Trained, Expert, Master, Legendary,
Grant [X Value (+1, +2, -1, -2, etc.)]; [Y type (Condition, Situation, Gear, etc.)]; [Z Check
(Constellation or Maneuver Roll)]. In this case, it would use a Maneuver called Aid." The kind
(`module/rules/kinds/bonus.mjs`, no aliases): `bonus: <value> <Type> to <Target> [if
<Constellation> is <Rank>]`; the value a signed integer, a bare `1` reading `+1`, `0` refused ("a
bonus of 0 does nothing"); the Type `Situation`, `Condition` or `Gear`, case blind, the retired
`circumstance`, `status` and `item` refused naming the current word and `untyped` refused ("no
Talent bonus is untyped"); `to` required, a Constellation or a Maneuver by the name the trees and
the action sheets print, the slug form reading too and a Maneuver's glyphs ignored
(`slugify(plainName(name))`); the `if` clause optional, `is` not `=`, the five rank words (keys of
`SW.RANKS`), and EQUALITY, as Mike wrote it, so a Talent that scales by rank writes one line per
rank and Humanity is four, one per sentence (ruling 121); anything else refused printing the shape
`bonus: +1 Condition to Aid if Human is Expert`. Stored on the Item: `{ kind: "bonus", line, text,
value, type, to: { name, slug, type: "constellation" | "action" | null }, when: { constellation,
name, rank } | null }`. `to.type` and the names come from `context.resolve(name) -> { type, slug,
name } | null`, an optional function the two callers of the grammar put on the parse context
(`build_foundry.mjs`, one resolver over every key of `trees.json`, every sheet action and every
roster `actions` row, enabled or not, a Constellation winning over an action of the same name,
passed to both `automationOf` calls; `resolveRuleTarget(name)` in `module/helpers/content.mjs`,
over `SW.constellations`, the Actions pack's index and world action Items, null while `game` is
not ready, for `SwItem._preUpdate`); with a resolver an unknown target, an `if` Constellation that
resolves to a Maneuver or nothing, and a Lore target (`SW.isLoreSlug`) are RuleSyntaxErrors;
without one `to.type` is null and the hook matches on slug alone. Summary: `+1 Condition bonus to
Aid while Human is Expert`, `penalty` when negative, no `while` without an `if`. **The `modifiers`
hook point** (ruling 124): a kind that affects a roll declares `hooks.modifiers(entries, context,
actor) -> Modifier[]`, `entries` its own rules on the actor (`[{ rule, item }]` from `rulesOfKind`),
`context` `{ kind: "check" | "attack" | "defense" | "initiative", slug, item }`, a Modifier
`{ label, value, type, offer?, key?, hint? }`; `ruleModifiers(actor, context) -> { applied,
offered }` in `module/rules/engine.mjs` walks `KINDS`, skips a kind without the hook or without
rules on this actor, calls each inside try/catch (`console.error("STARWROUGHT | the \"<id>\" kind's
modifiers hook failed:", error)` and nothing contributed; a roll never dies over a rule), drops a
non-numeric or zero value, files `offer === true` under `offered` with `key` defaulted to
`<kind>-<n>` when the kind gave none (the kind sets its own), the rest under `applied`;
`previewTotal` ignores offers. Two
call sites, both existing passes and no third: `baseModifiers` in `module/dice/check/modifiers.mjs`, the non-Defense branch,
at its end (`parts.push(...applied); cfg.ruleOffers = offered;`), with the dialog (`prompt` in `module/dice/check/dialog.mjs`) listing
`cfg.ruleOffers` as unticked checkboxes after the Load Strain offer and the existing `extra-<key>`
loop carrying a ticked one into the roll and `result.extras` (so a kept road roll re-counts it,
0.7.3); and `prepareDefenses` in `module/data/character/defenses.mjs` (the character's Defense pass), inside the per-Defense loop before
`SW.resolveModifiers`, applied only, the index and the ranks both final by then, so a Defense roll
(which rolls the Defense's own `modifiers`), an Initiative rolled with Awareness and a Defense
rolled as a check carry a bonus once and never twice. The npc early return stands: adversaries roll
flat and rules do not reach them in 0.10.0. The `bonus` hook: a conditioned rule fires only while
`actor.system.proficiency(when.constellation).rank` (`"untrained"` when absent) equals `when.rank`,
so never on an adversary; a Constellation target applies when `context.slug === to.slug`; a
Maneuver target applies when `context.item.type === "action"` and `slugify(plainName(name))` is
`to.slug`, and on a `check` without it is OFFERED (`key: "bonus-<item.id ?? item.name>-<line>"`,
label `<Talent>: <Target>`, hint "<Talent>: this bonus applies to checks to <Target>. Tick it if
this roll is one."), never on an attack, a Defense or an Initiative (ruling 122); a `to.type` of
null tries both and offers only when the slug matched no Constellation; an applied modifier is
`{ label: plainName(item.name), value, type }`, so the card reads "Humanity +1"; typed stacking is
`SW.resolveModifiers`'s, so two Humanity lines never both fire and overlapping lines of one type
give the highest. **A Relevant Check Maneuver** (ruling 123): `check.enabled` with a blank
`constellation` means a Relevant Check; `SwItem#use` then calls `actor.rollRelevantCheck({ item:
this, label: plainName(this.name), subtitle: "<glyph> <category>", outcomes })` (an npc gets the
existing warning and null), `rollRelevantCheck` lets a caller's `label` stand, `build_foundry.mjs`
sets `check: { enabled: true, constellation: "", defense: "" }` on a sheet action whose Effect
says "relevant check" (case blind) and names no check (Aid, which Mike enabled in
`data/maneuvers.xlsx` on 2026-10-03, so `packs/_source/actions/aid_30d830c3ca03647e.json` ships
with it set and Aid's roll opens the picker carrying the Maneuver), and `templates/item/details.hbs`
says so under the check panel
(`STARWROUGHT.Hint.relevantCheck`); no new schema field. `STARWROUGHT.Rules.none` reads "No
rules." and the build's summary counts its plurals. **Humanity's cell is written since 0.11.0**
(the `Automation` column added to the Human sheet of `data/ancestries.xlsx`, four lines `bonus: +N
Condition to Aid if Origin is <Rank>`, against the Origin since PHB v4.21 names the shared Origin
Proficiency), so the build's summary reads `automation: 4 rules on 1 document (1 kind in use)`; a
`bonus` rule carries its Talent as its `source`, so its lines are one circumstance under v4.21's
stacking, and an `if` that names a group is refused. The
rule stands: one kind at a time, with Mike; the hook point generic, so a later kind that wants the
same moment adds no engine code, and a new moment is defined with the first kind that needs it
(ruling 124; ruling 119 stands).

**The operator grammar and the four kinds (0.13.0; rulings 164 to 169).** Mike, 2026-11-05, on
the second draft of a grammar for every automation a level-1 Human needs: "I am OK using logical
operands like IF(Origin=Trained) and grammatical shortcuts like Bonus: +1, Condition, Aid ... create
Human-readable Automation Grammar/Syntax document; make sure to update it with any automation code
changes." So: **`AUTOMATION_GRAMMAR.md` in the project root is the grammar's reference, written for
the person typing in the cell, and every change to a rule kind, an operator or a vocabulary updates
it in the same commit** (standing rule); `build_all.mjs` fails when a registered kind has no
`### \`<kind>\`` section there or an operator in `module/rules/operators.mjs` is not in its table.
A line is `<kind>: <arg>, <arg>, ... [, <OPERATOR>(...)]`: positional arguments, then operators in
capitals, the same in every kind (`IF`, `FOR`, `WHILE`, `AGAINST`, `FIRST`, `ONCE`, `DIFFERENT`,
`VISIBLE`; `operators.mjs`, pure, `readLine`), and a kind refuses one it has no use for by name.
The 0.10.0 prose form is retired and refused with the new shape. Four kinds: `bonus: <±N>, <Type>,
<Target>` (the Target also `Defenses`, `Checks`, `Attacks`, `Initiative`; `IF(Rank=Untrained)` the
roll's own rank), `grant: <N>, <Scope> [, DIFFERENT]` (the Grants column retired; `toGrantField`
is the wizard's field), `aura: <N>ft, <Who> [, VISIBLE]` (the Aura column retired; `toAuraField`
is `system.aura`, re-derived by the Talent and action models at prepare), `prevent: <Effect>` (a
Condition or `Expose`; the first triggered kind and the second hook point, `prevent`: `setCondition`
and the token palette's `preCreateActiveEffect` ask before a Condition goes on and post one card; a
↺ carrier is offered as a Reaction in the Expose widget, `preventExposeFromCard`, "It Exposes
nothing"). **The sheet's Defense Threshold is position-blind** (ruling 167): a rule that needs the
map (`FOR` reaching others, `WHILE`), the Threat (`AGAINST`) or the round (`FIRST`, `ONCE`) is
answered with `momentOnly` by the Defense roll and `defenseThresholdFor` (the prompt's preview, the
coordinator's reveal and resolution), which pass `module/rules/scene.mjs`'s scene, encounter and
Threat; `prepareDefenses` asks `staticOnly`; `ruleModifiers` also hands a kind the other tokens'
`FOR` rules and returns the FIRST/ONCE marks, which `SwCheck.roll` and the coordinator write on the
recipient (`flags.starwrought.rules.round` / `.encounter`; `writeRuleMarks`), never a preview.
The level-1 Human's nine Talents are written in the grammar in `data/ancestries.xlsx` (13 rules on
9 documents). Next kinds come one at a time, from the Talent that wants each (ruling 119 stands).

**0.14.0 (Mike, 2026-11-05; rulings 170 to 173): the Rally Aura, Traits, the Lore panel.** Mike
rewrote the Torchbearer Human ("The first time each round an ally within 15 feet who can see you
defends against an Attack with the Fear trait, they gain a +1 Situation bonus to that Defense
check") and the grammar grew two readings rather than a kind: **`SEEN`** (a flag operator for
`bonus` and `prevent`: the recipient can see the owner; line of sight between token centres against
sight-blocking walls, the seer not Blinded, the seen not hidden, Hidden or Undetected; nothing
finer, ruling 170; `canSeeToken` in `module/rules/scene.mjs`, `scene.sees`) and
**`IF(Trait=<Trait>)`** (the attack answered carries the trait, matched on its first word; the
attack record carries `traits` from the weapon, the adversary attack Item or the spell Talent, and
`threatContext` hands them on; no closed list, the build WARNS on a trait nothing shipping carries,
ruling 171). Tree sheets have an optional **`Traits`** column (`system.traits` on the Talent) and
the `_Tree Index` a **`Traits`** column (the chassis's creature traits, "Human": on the Ancestry
chassis, the app card, the docx table, and the character header's read-only Traits field, read off
the Ancestry, Bloodline and Culture by name at render, never stored; ruling 173). A `prevent` of
`Expose` pressed after the Zone pick closes the Zone the card recorded Exposing (ruling 172;
`flags.starwrought.exposed` on the card, the GM's client over the `expose:*` socket for another
player's body). The ancestry blurb is the Lore sheet's Summary row (the index's Summary column
gone, with Flare Triggers and Meta note, all optional). **Fear is carried by nothing in the data
yet**, so the Rally Aura fires once a Fear spell or attack is authored.

**0.15.0 (Mike, 2026-11-05; rulings 174 to 181): the Cultures, their Talents' automation, and
difficult terrain on the map.** Mike restructured `data/cultures.xlsx` as he had the ancestries,
wrote a Lore sheet per Culture and rewrote the eight Culture Talents, asking how a roleplay-only
bonus should be automated; his answers: **both** a checkbox in the roll dialog and an arm button
on the Talent row, Iron Etiquette's Intimidation fully automated and the rest by the roleplay path,
and "build Difficult terrain INTO the maps ... players can toggle layers to see what is difficult".
The grammar grew **three operators** (`CLAIM(<text>)`: the bonus is a checkbox in the roll dialog
with the Talent's hint, and the pin on the Talent's row arms it for the next roll or Threshold read,
spent by whichever resolves, `flags.starwrought.rules.armed`, `module/rules/claims.mjs`, ruling 174;
`MARKED`: the roll's other party is the creature this Talent's mark named; `IF(Outcome=<Degree>)`,
read by `reroll` alone), **a new reading of `AGAINST`** (a Constellation: only when the check read
against this Defense rolls it; the check-against-a-target's-Threshold path exists since 0.15.0,
ruling 179: a Maneuver with a Defense named, used with one target, reads it live through
`defenseThresholdFor`, withheld for an adversary), **`Speed` as a `bonus` scope** (feet on a Move,
`kind: "move"`, ruling 181), and **three kinds**: `mark` (names the targeted token on use, holds
while its Combat is the viewed one, never cleared; the **`use` hook point** defined with it,
`ruleUses`, run by `SwItem#use` on a Talent with a cost or a use-kind rule, the Use control on the
row; ruling 176), `reroll` (a button on the matching check card of the owner's roll, the **`card`
hook point**, `ruleCardOffers`, drawn by the chat render pass and run by `rerollByRule` in
`documents/cards/reroll.mjs`, paying the cost in an encounter; every check card carries its
modifiers in its flags now; ruling 177), `ignore` (`ignore: Terrain [, <Kind>, ...]`, no hook
point: the Difficult terrain region behavior asks `ignoresTerrain` at Foundry's own moment). **The
engine knows the other party** (`other` on the roll context, set by `rollDefense`,
`defenseThresholdFor`'s new `attacker` option, the Combat Prompt's previews, and the coordinator's
`#pairingModifiers`, which reads a Strike's defender-dependent rules per pairing with `pairingOnly`
and hands them to `resolveAgainst` as `pairingModifiers`, added to the total and kept in the flags;
ruling 175). **Terrain on the map** (ruling 178): a `difficultTerrain` Region behavior
(`system.json`, `module/data/region-behaviors/difficult-terrain.mjs`; `kind` from
`SW.TERRAIN_KINDS` in `config/terrain.mjs`, `difficulty` 2 by default) whose `_getTerrainEffects`
answers nothing for a token whose actor ignores the kind; `SwTerrainData`
(`CONFIG.Token.movement.TerrainData`) keeping the kinds crossed for the ruler's "difficult: mud";
the player's overlay (`canvas/terrain.mjs`, the `swShowTerrain` token-control toggle, the client
setting `showTerrain`); a hidden region carries no terrain for anyone. **The Cultures as the
Ancestries** (ruling 180): `roster.cultures` generated from `cultures.xlsx` (objects; the index's
optional `Languages` column, written this release; the Lore Summary the blurb), the Culture chassis
with `lore`, `languages`, `traits` and the root's Effect as Special Ability, the app and the docx
printing a per-Culture section, the wizard's Culture step with the Lore panel and every Root-based
card printing the Talent's Description above its Effect. The eight cells are written in
`data/cultures.xlsx` and in `AUTOMATION_GRAMMAR.md` section 5.

**0.16.0 (Mike, 2026-11-05; rulings 182 to 188): the grammar in Fantasy Grounds' shape, Talent
Maneuvers, the chassis as automation, Character Effects.** Mike: "I REALLY, REALLY like the
FantasyGrounds effects automation ... can we use syntax substantially similar to this"; shouldn't
ALL of a Talent's effects (the Human's trait, Size, Speed, Vigor; the Cultures' languages) be
Automation; Steady the Line's prevention belongs on the Maneuver, the Talent only adding it. **The
grammar has two layers** (`AUTOMATION_GRAMMAR.md`, rewritten; ruling 182): **feature lines**, blocks
in brackets for what owning the Talent does (`[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]`,
`[LANGUAGE Common, Serrovine]`, `[Acrobatics trained]`, `[POINT Skill]`, `[MANEUVER Steady the
Line]`, `[TALENT Weapon Familiarity]`, `[CHOICE Weapon Group]`, `[AURA 15 allies visible]`, `[VIGOR
opening 12]`, `[SENSES ...]`; `module/rules/features.mjs`), and **effect lines**, a tag then
components after semicolons (`CHECK: 1 condition, aid; IF: RANK(Origin >= trained)`, `DEF: 1
situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)`, `IMMUNE: prone; LIMIT:
encounter`, `MARK: enemies`, `REROLL: diplomacy; IF: RESULT(critical failure)`, `IGNORE: terrain,
mud`; `module/rules/effects.mjs`; `IF:` the owner or the roll, `IFT:` the other party or the
attack, both prefixes reading every condition). **The stored rule shapes and the four hook points
did not change**: the readers fill the same `ops` record, so `bonus`, `prevent`, `mark`, `reroll`
and `ignore` keep their hooks; nine feature kinds (`module/rules/kinds/features.mjs`: `trait`,
`size`, `speed`, `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`) have none. The
0.13.0 form read one more release and **is refused since 0.17.0** (below).
**The chassis is written on the Root** (ruling 183): the index columns Vigor/HP, Size, Speed,
Senses, Traits, Languages, the Callings' Skills, the tree sheets' Choice and Free Talent, and the
roster's Opening Vigor column are retired, read this release with one warning per workbook, a
disagreement with the Root's block an error; **`assets/parse_rules.mjs`** (between the converter
and `inject`, every mode) parses every cell once, writes `rules` into the JSON, carries the Root's
blocks into the roster's `ancestries`, `cultures` and `callings` records and expands
`@Maneuver[Name]` in an Effect into the Maneuver's block (ruling 185); `build_foundry.mjs` reads
the `rules` rather than parsing again, fills `choice` and `freeTalent` from them, the Background's
and the Calling's `grants` from `[X trained]` rules; the character reads any owned Talent's
feature lines at prepare (`system.features`, `_prepareRules` in `data/actor.mjs`: a `[SPEED +1]`
into the Move, `[TRAIT]` into the header chips, `[LANGUAGE]`, `[SENSES]`). **Talent Maneuvers**
(ruling 184): `[MANEUVER X]` names a row of the new "Talent Maneuvers" sheet of
`data/maneuvers.xlsx` (Type `Talent Maneuver`, never basic; its Cost and Automation the
Maneuver's); `SwItem.grantManeuvers(actor, talent)` copies it from the Actions pack onto the
character flagged `grantedBy` when the Talent lands (the `createItem` hook, the wizard's
`#addTalent`, `grantMissingManeuvers` on the GM's client at ready), `removeGrantedManeuvers` on
`deleteItem`, the Actions tab's "From your Talents" panel, and `SwItem#use` on an action with
use-kind rules pays and runs them (`#useWithRules`). Steady the Line ❶↺, Oathbound ❶ and Quick
Tongue ❶↺ are the first rows. **A Trained Root** (ruling 186): `[Acrobatics trained]` stores a
`grant` with `constellation`, `toGrantField` carries it, the Talent schema has it, and `grantSlot`
in `chargen.mjs` makes the directed slot the Background grants always had; `GRANT_SCOPES.Skill`
includes Lore. **Character Effects** (ruling 187): the Overview tab's Effects panel with On / Skip /
Off per line, custom effect lines in the grammar on the actor (`system.effects`, parsed on write,
indexed as a carrier, durations until removed / the next roll / the end of the encounter), and the
tracker's badge. Every cell of the Human, the Cultures, the Backgrounds, the Callings and the
three Maneuver rows is written in the new shape (`AUTOMATION_GRAMMAR.md` section 5); Excel had
released `ancestries.xlsx`, so Torchbearer's Rally Aura cell is finally in the sheet.

**0.17.0 (Mike, 2026-11-05; rulings 189 to 194): every line in brackets, the Grammar journal, the
sheets' UI pass.** Mike, with five screenshots: "shouldn't ALL of those be enclosed in Brackets?";
a button to a Compendium entry with the grammar; Edicts, Anathema and a Notes tab; the Effects
panel onto the empty Effects tab with an "apply to next roll" button for a line the system cannot
apply by itself; "ALL auras should be preview-only by default"; the Talent name as the click and
the hover; the Talent window reordered with the empty Active Effects tab gone. **Every cell line
is a bracketed block** (ruling 189): the feature blocks and FG's own `[EFFECT <tag>: ...; ...]`
(`features.mjs` returns the block with `effect: true`, `grammar.mjs` hands its inside to the effect
reader; the stored rules unchanged); a bare effect line in a cell reads this release flagged
`bare` with a warning (`parseAutomation` returns `{ rules, errors, warnings }`, a kind warns with
`context.warn`), 0.18.0 refuses it, and the custom effects field (`itemType: "effect"`) keeps the
bare string as FG's does; **the 0.13.0 operator form is refused** with `LEGACY_REFUSAL`
(`readLine` and the kinds' legacy branches gone). **The document is the journal** (ruling 190):
`assets/lib/markdown.mjs` turns `AUTOMATION_GRAMMAR.md` into the "STARWROUGHT Automation Grammar"
journal of the Rules pack at build time (`docId("rules", "journal:grammar")`, a page per `##`
section, "0. At a glance" first), `openRulesPage(title, { journal })` opens either journal, the
**Grammar** button (`rulesJournal` action) sits on every Item's Automation panel and the Effects
tab's custom heading, and the document gate wants every tag, component, condition and keyword to
head a table row. **Every aura is preview-only until shown** (ruling 191): `rangesOf` falls back to
`false` for every ring, `system.auras.visible.<key>` (the Auras window's toggle) is the one way a
ring shows, `system.aura.visible` is gone from the Item (`migrateAuraVisible` in the models), the
`visible` word warned this release and refused next. **A claim line is armed, never switched**
(ruling 192): on the Effects tab a line with `IF: CLAIM(...)` shows **Apply to next roll**
(`armClaimLine` in `helpers/effects.mjs`, the 0.15.0 flag). **Edicts, Anathema, Notes** (ruling
193): `details.edicts` and `details.anathema` on the character; Notes the seventh tab
(`Tab.characterNotes`). **The Effects tab holds the panel** (ruling 194). UI, no ruling: the
Constellations tab's Talent name is the `itemEdit` click with a rich tooltip of the Effect
(`talentTip`); `SwItemSheet.NO_EFFECTS_TAB` drops the Active Effects part and tab for `talent`,
`constellation` and `action`; the Description tab reads Traits, Description, Effect, Source and
`.starwrought.item prose-mirror { min-height: 0 }`. The cells of `cultures.xlsx`,
`backgrounds.xlsx`, `callings.xlsx` and the Talent Maneuvers rows are wrapped (backups in
`backup/pre-0.17.0/`); Excel held `ancestries.xlsx` at the tag, and the Human's five lines were
wrapped in the follow-up commit once Mike closed it.

**0.18.0 (Mike, 2026-11-05; rulings 195 to 198): the aura carries its effect, terrain kinds as
data, a Lore named when it is Trained.** Mike: the Rally Aura's two lines said "15 feet, allies"
twice ("the Effects should be within the AURA's brackets"); how difficult terrain works and whether
to start a list of kinds; "immediately when getting Trained in Lore... I should be forced to create
the Lore". **An AURA block carries its effect** (ruling 195): `[AURA 15 allies; DEF: 1 situation;
IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]`; `grammar.mjs` splits the block on its semicolons
(`splitComponents`), parses the ring with the `aura` kind, then the rest as an effect line whose
`ops.for` is the ring (`parseEffect(text, blockText, extra, ring)`), both rules under the block's
text; a `FOR:` inside is refused ("the ring is the FOR"), `[AURA 15 allies]` alone still draws, one
effect per block, the first `aura` rule of a Talent is the ring drawn. **The bare effect line in a
cell and `visible` are refused** (ruling 196; `hasBare` and the `bare` flag gone; `BARE_CARRIER`
keeps the custom effects field bare). **The terrain kinds are the roster's** (ruling 197): the
hand-kept `terrainKinds` block of `assets/roster.json` (name, description, default difficulty,
colour; slug by `slugify`), written by the build to `content/terrain.json`, registered at startup
(`registerTerrainKinds` in `module/config/terrain.mjs`, `TERRAIN_KINDS` a live view over the
registry) and by `parse_rules.mjs` and `build_foundry.mjs` before parsing; the behavior's `kind`
choices are a function; `Terrain.kind.*` i18n keys retired; the self-test seeds the ten. **A Lore
is named when it is Trained** (ruling 198): `SwActor#nameLore(field)` (`documents/actor/lore.mjs`;
`loreSlug`/`loreName` in `config/names.mjs`; `promptForLoreField` in `apps/lore-name.mjs`;
`SwItem.ensureConstellation(actor, slug, { name })`), the wizard's `#autoSpend` prompting instead of
spending into the template and holding Next until named, `onCreateItem` prompting for a Lore
Talent or the template Constellation and deleting it on Cancel, **Name this Lore** on a template's
Constellations row and "Lore (unnamed)" there and on the party's Skills grid.

**0.34.0 (Mike, 2026-11-19; rulings 337 to 349): a Maneuver's check is declared.** Mike: "when
I add new talents I don't want to hard-code what the check is. So wouldn't it make sense if the
check was also using automation grammar, as well as the success/failure effects?", then "make
sure there is room for the Checker to choose (eg Athletics or Acrobatics) or for the Checked to
choose". Planned first (`dazzling-floating-simon.md`; his decisions by question: the word is
CHECK; "'or' should always mean the actor being affected by the choice chooses", left of `vs`
the user and right of it the target; the target chooses by buttons on a chat card; "players
ALWAYS roll vs. NPCs"; an adversary has a typed number for each Skill). **The `check` kind, the
twenty-fifth, is a feature block on a MANEUVER'S OWN ROW with NO HOOK and no hook point**
(`module/rules/kinds/check.mjs`, a wrapper; `check` in `FEATURE_KEYWORDS`, `CHECK` before
`EFFECT` in `FEATURE_KEYWORD_LIST`; never in `EFFECT_TAGS` or `EFFECT_KINDS`): `[CHECK
<Constellation> or <Constellation> vs <Defense> or <Defense>]`, `relevant` on the left for any
Constellation, one number on the right for a fixed Threshold; stored `{ kind: "check", rolls:
"relevant" | [{ slug, name }], against: null | { defenses: [keys] } | { threshold: n } }`. **The
pure half is `module/rules/check.mjs`**: `readCheck` (split on the word `vs`; a Maneuver, a
Lore, the Origin and a duplicate refused, with `against`, `versus`, a comma and `and` told what
to write), `checkWords`, `checkSummary`, and **`planOf(rules, stored)`, the ONE reading of what
a Maneuver rolls** (`{ enabled, declared, relevant, rolls, defenses, threshold, extra }`: the
row's rule, else the three stored fields `system.check`, which stay for a row with no block),
`storedCheck(plan)`, `userPicks`, `targetPicks`. The action model derives `system.checkPlan`.
**A new reader of "what does this Maneuver roll" asks the plan, never `system.check`**
(`#useManeuver`, `maneuverAttributeOf`, the Item window's `declaredCheck`, the build's
`checkOf`). `splitAlternatives` in `module/rules/syntax.mjs` is the one reading of `a or b`,
shared with `requires.mjs`. **A bonus to checks stays `[EFFECT CHECK: 1 condition, aid]`**, and
each form written the other way is told the right one (`effects.mjs`; `readBlock` in
`features.mjs` for a first word ending in a colon). **The use** (`module/documents/item.mjs`):
the two old forks of `#useManeuver` are `#startCheck(actor, { check, config, subtitle, note,
applies, cost, label, prepared, paid, partOf, gate })`: the user's pick
(`SwActor#pickConstellation({ only, item, threshold, askThreshold, dialog })` in
`documents/actor/checks.mjs`, split out of `rollRelevantCheck`), then the target's
(`usableDefenses`: one Defense named is read as it stands, ruling 345; exactly one usable is
read, ruling 344; else a request), then `#rollPlanned`, the one roll function
(`readTargetThreshold({ ..., permitted })` in `helpers/threshold-read.mjs` is told the Defenses
the row names, never all four, and answers `targetNote` when the one read is unavailable).
**The request** (rulings 346, 347): `module/rules/check-request.mjs` (pure: `usableDefenses`,
`validAnswer`, `standingAnswer`, `requestState` open / answered / rolled / withdrawn / lapsed,
`userDegree`, `adversaryCheck`) and `module/documents/cards/check-request.mjs`
(`postCheckRequest`, `answerOf`, `resultOf`, `resultCardOf`, `stateOf`, the handlers
`answerFromCard`, `withdrawFromCard`, `rollFromCard`, `defendFromCard`, `postResultFromCard`,
`postManeuverResult`, `drawCheckRequest`, `registerCheckRequestCards`), modelled on the Gain
Control request. **NOTHING IS WRITTEN TO A REQUEST AFTER IT IS POSTED**: its state is the cards
that name it (`flags.starwrought.kind` `checkRequest` with the record `checkRequest`;
`checkAnswer { from, defense }` or `{ from, withdrawn }`; a check card's `flags.check { from }`),
the first valid one in log order, the author checked every time. `SwItem#resumeCheck(request,
{ requestId, defense })` makes the roll from what the request stored and never re-enters `use`;
its `beforeRoll` asks `resultOf` again (one request, one roll), that a Prepared Maneuver still
stands, `mayActNow` only for `gate: "permit"`, and pays `request.cost`; a Prepared Maneuver's
Finish returns early on `{ pending: true }` and `SwActor#settlePreparation()`
(`documents/actor/actions.mjs`) settles it after the roll. **Adversaries** (rulings 340, 341,
348): the npc model has `checks` (an `ObjectField`, written `system.checks.<slug>`),
`checkBase(slug)` and `checkNumber(slug) -> { base, threshold, shift, conditions }` (blank 10; a
Defense slug reads the typed Defense Threshold; `conditionModifiers` moves it); the sheet's
Checks block (every enabled Skill, Melee, Ranged) and a Use control on its own Maneuvers
(`itemUse`); `#startAdversaryCheck`: against a player's character with a Defense named the
adversary pays and a `mode: "roll"` request goes out, the player's Defense is rolled as `kind:
"check"`, withheld, against `checkRequestThreshold`, with `flags.check { from, inverted: true,
defense, userUuid, itemUuid, slug }`, and **the active GM's client posts the adversary's own
result card** (`postManeuverResult`: the same die, `userDegree`, `ruleApplies(user, { item,
rank: "untrained" })`, `flags.check { from, resultOf }`, `rerollOf` the result it replaces; the
`checkResult` button is the GM's when none was connected); else the GM rolls flat (`flatBonus:
checkBase - 10`, `flatLabel`), the Constellation and the target's Defense asked in one window
(`module/apps/check-picker.mjs`, `pickAdversaryCheck`; the Defense opens on nothing), with
`withholdThreshold` when the target is an adversary. `SwCheck.roll` reads APPLY lines for an
npc too; `rerollCheck` re-reads an inverted card through `checkRequestThreshold`. **The build**
(`assets/build_foundry.mjs`): `checkOf(a)` reads the block first (`declaredChecks`; two blocks
fail the build), else `guessedCheck(a)`, the old prose guess; warns when block and prose
disagree; refuses a block on an Activity or Endeavor row; prints `checks: N rows declare ...;
M still read from the Effect's prose (names)`; `effectCensus` takes `takesUse` (a kind with a
`use` hook) and warns on a CHECK block nothing reads; each message has its row in `RULES`. **A
kind that takes the whole use (a `use` hook: MARK, PERMIT, SUBORDINATE) and a `CHECK` block on
one row do not combine.** **What the review of 0.34.0 added (two readers, nineteen findings, one
high), and a later change must keep**: **a REQUEST'S OWN AUTHOR is checked** (`validRequest` in
`rules/check-request.mjs`, read by `recordOf`: the GM, or an owner of the creature using the
Maneuver; a `roll` request never names a character as its user), because this is the first card
chain that acts UNASKED on the GM's client (a player's roll card makes it post the adversary's
result), so a card with a request's flags from anybody else is no request and `validRoll`
answers false with no request behind it; `postManeuverResult` posts only for such a request in
`mode: "roll"`, not withdrawn, and only for its ONE roll or that roll thrown again
(`countsForRequest`, which walks `rerollOf`; a second roll's card says it does not count);
`requestStillWaits(requestId, { mode, defense })` is asked AGAIN as the die is thrown, by
`defendFromCard` and `resumeCheck` (rolled, withdrawn or lapsed while the window stood open);
`#startCheck` refuses anyone who does not own the actor; **a Prepared Maneuver's request is
tied to its preparation** (`finishPrepared` writes the request card's id as
`preparing.request`, refuses a second Finish while `requestWaiting(id)`, and `resumeCheck`
wants `preparing.request === requestId`), and an adversary's Prepared Maneuver is settled as
its `roll` request goes out; **the GM's one window answers only for a creature no player owns**
(`needDefense = twoWays && game.user.isGM && !target.hasPlayerOwner`; otherwise `#askTarget`,
the one place a request for an answer is posted, for a character and an adversary alike), a
player-owned adversary passes `mayActNow` as it pays, and **an adversary's flat bonus is built
in `#rollPlanned`** for every road to its own roll; the request's `combat` is the Combat its
user is a fighter in (`fightOf`, by membership, never `game.combat`); an answered Defense is
read with `permitted: [defense], answered: true`; `rerollCheck` refuses a card with
`check.resultOf` and the chat pass offers no rule button on one; the adversary sheet's Checks
block adds any Constellation its own Maneuvers roll. In the grammar: **`isBonusShape`
(`rules/check.mjs`) is asked FIRST wherever a `CHECK` is read** (the kind before its carrier
refusal, `grammar.mjs`'s two branches), so a bonus with its colon lost is told the effect form
on any carrier; `readBlock` tells only a word that IS an effect tag and no feature keyword to
wrap itself in EFFECT (`[EFFECT: ...]`, `[SPEED: 6]`, `[TRAIT: Human]` keep "is not a feature
keyword", which `highlight_automation.py` keys on); `and` is a word of some names, so with a
resolver the names decide; `effectCensus` takes `runsItself` (a built-in alone is told its
CHECK block is unread: a row another act pays for, Leap, is still used from its row and rolls)
and reads a declared row as rolling whatever `rolls` it is handed; the build compares a block
with its guess only where both speak; **a build line with no WARNING in front needs its
substring in `is_finding` in `build_report.py`, or its `RULES` row is never reached.** **The
release carries the kind alone**: the cells for 32 rows are in
the 0.34.0 changelog entry and `AUTOMATION_GRAMMAR.md` section 5 for Mike to paste; his four
workbooks were not converted, built, staged or written. **Next, by his word: Gain Control in
the grammar (one new word for Bind results), then the words for what a Condition forbids and
how it fades.**

**0.33.0 (Mike, 2026-11-18; rulings 322 to 336): the Conditions workbook.** Mike: "can we build
a conditions.xlsx that includes every condition, and the automation effects (if any) of it?",
then "Yes, the source". Planned first (`dazzling-floating-simon.md`; his decisions by question:
the workbook is the only authority, adversaries too, Conditions only for now, a new row makes a
new Condition, Drop Flat's +4 alone, commit 0.32.1 first). **No kind and no hook point is new.**
**The registry** (`module/config/conditions.mjs`): `CONDITIONS` is LIVE, emptied and refilled in
place as `TERRAIN_KINDS` is; the built-ins stay in code (private `BUILT_INS`, each with `system:
true` when the system runs it, `aliases` for `blinded`/`deafened`) and `registerConditions(rows)`
REBUILDS from them plus the workbook's rows (`{ created, matched, missing }`; throws, changing
nothing, on a row it cannot take). A row that names no built-in MAKES A CONDITION (Supine the
first): id from its name (`newConditionId`), a static status id hashed from the id alone
(`newStatusId`). A built-in keeps its id, i18n `name`, status id and `numeric`; a row gives it
`label`, `description`, `includes`, `rules`, `listed`, and an icon when the cell is filled. The
one "Exposed" row describes the four Zone statuses. `conditionIdOf` reads a live word index (id,
key word, label, aliases; spaces and hyphens out); `conditionLabel`, `conditionNameKey` (what a
screen localizes: the row's label, else the built-in's i18n key), `conditionDescription`,
`conditionHasRules`, `conditionHasRow`, `conditionsRegistered`, `conditionNameFree` (a new name
may not be a word, or begin with one, that a `[REQUIRES ...]` block reads as something else),
and a new name that differs from another Condition's only by a mark its id drops ("Off'Guard")
is refused, since it would take that Condition's word. **Two exports are
named `CONDITIONS`**: the registry (config) and the list of condition WORDS in
`module/rules/effects.mjs`; a tool that needs both aliases one. **The grammar**: a Condition's
row is `itemType: "condition"` (`CONDITION_ROW`, `CONDITION_ROW_TAGS` in `module/rules/syntax.mjs`)
and reads CHECK, ATK, DEF, INIT alone, with only the Threat conditions after `IFT:`; `N` as a
value (`-N`; `module/rules/effects.mjs`) is stored `value: ±1, scale: "N"`, read on a Condition's
row whose Takes is N and refused everywhere else (`context.takes`). **What a creature HAS** is
`module/rules/condition-set.mjs` (pure): `closeConditions({ direct, torso })` closes the
statuses over each Condition's `includes` and adds Off-Guard for a Torso Wound or the Torso's
Critical Hit effect (the STORED `zones.torso.wounds` / `.critical`: `_prepareRules` runs before
`_prepareWounds`); an inclusion written `against X` is kept apart by the uuid of whoever applied
the including Condition (`flags.starwrought.applied.by`), and a hand-toggled one names nobody
(`unknown`); the answer does not depend on the order of the statuses, and an included Condition
is every applier's (`bys`). `effectList` reads the same closure (`conditions`, `against`, `by`,
`bys`, `via`, `direct`), `listHas(list, ref, { by, viewer })` and `effectHolds` pass the VIEWER (the roller
for `IFT:`, the other party for `IF:`), `situationOf` and `unavailableEvade(heldConditions(actor))`
read it too; `APPLY` and `REMOVE` stay on the raw statuses. **The carrier**: `collectRules` adds
`conditionCarriers(actor)`, one `{ id: "condition:<id>", type: "condition", condition: { id,
value, against, via, direct } }` for each Condition held that carries lines, named for what it
comes through ("Off-Guard (Prone)", "Off-Guard (Torso)"), so the `bonus` kind's `modifiers` hook
applies a Condition's lines, multiplies an `N` rule by the carrier's value, and reads an
"against X" carrier only where `context.other` is one of its creatures (it passes `pairingOnly`).
A Condition's line has no On / Skip / Off (`rulesOfKind` reads no state for it; `effectGroups`
leaves it out; `conditionInfo` lists it read-only). **`conditionModifiers(actor, context)`** is
`ruleModifiers` held to the Condition carriers with no scene. **THE OLD NUMBERS ARE GUARDS, NOT
GONE**: the Off-Guard, Frightened and Fatigued blocks of `data/character/defenses.mjs`,
`dice/check/modifiers.mjs` and `data/character/offense.mjs` stand only while
`SW.conditionHasRow(id)` is false, that is while NO ROW of the workbook describes the Condition
(the file could not be read): such a world keeps the numbers the system always had and nothing
counts twice. **THE ROW IS THE WORD (ruling 329): a row whose cell is blank or `N/A` means the
Condition changes no number, Off-Guard, Frightened and Fatigued included.** (The guard was keyed
on the row's LINES until the review: `N/A` on Off-Guard then put the old -2 back for the status
and not for a Prone creature or an adversary.) `weaponNumbers` (`helpers/actor-context.mjs`)
adds the carriers' standing attack lines. **Adversaries** (ruling
324): the npc model's `defenses[key]` carries `base` (typed; the sheet's input is bound to it and
never to `threshold`), `threshold` (in effect), `shift`, `conditions`; `attackModifiers`,
`attackShift`, `attacks[].inEffect`; `defenseThresholdFor`'s npc branch asks `conditionModifiers`
whole (static and moment) and adds the answer's bonus; `attackThreshold(attacker, maneuver,
{ controlled, conditions })`; the npc branch of `baseModifiers` adds them for every kind but
`defense`; `npcInitiative` in `documents/combat.mjs` reads an adversary's Initiative as a
character's default one is (the lines that reach Awareness, and the INIT lines; never a CHECK
line); an adversary's Gain Control takes the lines a CHECK takes (`checkShift` in
`documents/cards/gain-control.mjs`), never its attack lines; the Intercept button prints
`attacks[].inEffect`. An adversary's own Talents stay unread.
**A reroll meets the first die's number** (ruling 335): `resolveAgainst` takes `threat` and
`conditionShift`, the card keeps both (`dice/check/card.mjs`), `thresholdForCard` and
`rerollCard` hand them back; `defenseThresholdFor({ conditionShift })` sets the Conditions'
lines as they stand aside and adds the stored total, FOR A CHARACTER DEFENDER TOO (its
Condition lines are the modifiers whose `source` begins `rule:condition:`; `isConditionLine`);
a card from before 0.33.0 carries neither and is read live. **And
`rerollCard` hands the die's modifiers and the pairing's back APART** (a defect since 0.31.0,
found by the live drive: a rerolled Strike listed its `IFT: EFFECT` or `MARKED` bonus twice and
lost it from the total). **Drop Flat** (ruling 330): Prone goes on once the pairing has
RESOLVED (`#applyReveal` reads `target.outcome`, keys `…:zone` and `…:prone`; `rollDefense` puts
it on after the die outside the flow), never at the reveal. **Supine** (ruling 333) is a
Condition: a reference stored while it was a named Effect means the Condition (`conditionOfRef`
in `module/rules/effect-list.mjs`: `listHas`, `applyEffectTo`, `removeEffectFrom`, the `apply`
kind's lines, `bare()`'s `supine` and `effect` cases), and `migrateWorld`'s 0.33.0 step turns a
status-less effect named for a row-made Condition into the Condition's own (the elected GM
client, only once the rows are registered; else the stamp stops at 0.32.1; never one that is
switched off or carries changes of its own). **The client**
(`helpers/content.mjs`): `loadConditions()` fetches `content/conditions.json` ALWAYS past the
cache, at init (Foundry does not await the hook), `ready` awaits `conditionsReady()` and calls
`applyConditions()` (`CONFIG.statusEffects = statusEffectList()`, then every Actor that has a
status or a Wounded or struck Torso is `reset()`: the world's, every scene's unlinked tokens,
every Combat's fighters); one read at a time (`conditionsLoading`); a failed read leaves the
registry as it was and is said once, in a notice that stays, to the GM and to a player whose
client could not read it. **Sync content** reads them again and calls `announceConditions(build)`
(`helpers/content-sync.mjs`), which emits `content:conditions` (every other client answers by
reading the file itself) and records the world setting `conditionsBuild`, the build the world
last ANNOUNCED. The index carries `conditions` (the hash, also in `index.build`);
`plan.conditions.changed` is asked of that setting and of this client's own copy, never of this
client alone (the review: a GM who had just reloaded held the new file, read "unchanged", and
left connected players on the old lines); and `offerContentSync` announces by itself, with no
question, when no pack has work and the Conditions moved. **The
pipeline**: `assets/make_conditions_xlsx.py` scaffolded the workbook ONCE from the handbook's
table (it refuses to run over it; `cell_text` reads nested tables); `xlsx_to_trees.py` knows the
workbook by its `Conditions` sheet (`parse_conditions_workbook`, `--conditions`) and only STAGES
the rows (`build/conditions.staged.json`); `assets/lib/conditions_build.mjs` (`buildConditions`,
`registryRows`) parses the cells, registers, refuses a sheet that leaves a built-in without a
row or carries a name a cell cannot write, and builds `assets/conditions.json` and the roster's
`conditions` block (`[name with its Takes suffix, description]`, Listed rows only), which
`parse_rules.mjs` writes TOGETHER and only when the sheet reads (the roster first, then
conditions.json, the staged rows used up last, so a write that fails part way is done again) (first thing, before any tree
cell, so the trees are parsed against the Conditions; `--conditions` does nothing else;
`--lenient` leaves conditions.json as it was and says so); `build_foundry.mjs` registers them
before parsing and writes `content/conditions.json`; `build_all.mjs --conditions`
(`sync_conditions.cmd`) is the one-workbook loop, generalised with `--equipment` as `single`;
`check_style.py --conditions`, `highlight_automation.py`, `lib/parse_cells.mjs` and
`build_report.py` (`RULES` rows for every new message) know the workbook. **`data/conditions.xlsx`
is a built, committed workbook, as `data/equipment.xlsx` is: before committing it, run
`python assets/xlsx_to_trees.py --conditions` and `node assets/parse_rules.mjs --conditions`
and see whether `assets/conditions.json` moves; if it does, run `build_all.mjs --conditions`.**
Mike's four workbooks in progress were not converted, built, staged or written.

**0.32.1 (Mike, 2026-11-18; no ruling): Stand's two lines, and Supine as a named Effect.** Mike,
of Stand's cell: "should it say instead `[EFFECT REMOVE: prone]` `[EFFECT REMOVE: supine]`?",
then "yes, mend both", and "I split Drop Prone into Drop Prone, and Drop Supine. The alternative
was some sort of option box to choose Prone or Supine when dropping." **A `REMOVE` that finds
nothing says nothing beside a line that did something** (`wordsToSay(done)` in
`module/rules/applied.mjs`, pure; used by `#applyOnUse` in `documents/item.mjs` and `applySide`
in `documents/cards/apply.mjs`; when nothing at all was taken off every line is said, so a use or
a press is never silent). **Supine is a NAMED EFFECT until it is a Condition** (it is in the
handbook and not in the system, ruling 266): `[EFFECT APPLY: Supine]` and `[EFFECT REMOVE:
Supine]` read it as one, named "Supine" whatever the casing typed (`kinds/apply.mjs`), and the
bare word `supine` in `[REQUIRES ...]` is true while the creature has that Effect (`bare()` in
`module/rules/requires.mjs`: `has(s?.effects, "supine") === true`, so with no list of Effects it
is the known "no" it always was). It is a label: Supine's own rules are the table's. **When
Supine is built as a Condition, `readEffectName` reads the Condition first, so the same cells
keep working; `bare()`'s one line then reads the Condition.** The cells: Stand `[REQUIRES prone
or supine][EFFECT REMOVE: prone][EFFECT REMOVE: Supine]`; Drop Prone `[REQUIRES not
prone][EFFECT APPLY: prone][EFFECT REMOVE: Supine]`; Drop Supine `[REQUIRES not supine][EFFECT
APPLY: Supine][EFFECT REMOVE: prone]` (each Drop takes the other state off). Printed in the
0.32.1 changelog entry and `AUTOMATION_GRAMMAR.md` section 5 for him to paste.

**0.32.0 (Mike, 2026-11-17; rulings 311 to 321): a Maneuver puts Effects on, and takes them off.**
Mike: "Build 0.32.0", the writing half of named Effects, planned with 0.31.0
(`dazzling-floating-simon.md`; his decisions by question: the tags are APPLY and REMOVE, an Effect
on yourself lands at once, one on another creature is a button on the card). **The `apply` kind,
the twenty-fourth** (`module/rules/kinds/apply.mjs`), two tags for one kind, on a MANEUVER'S OWN
ROW and nowhere else: `[EFFECT APPLY: <Effect>[, self | target]; UNTIL: <window>; IF:
RESULT(<degree>); IF: COST(<n>)]` and `[EFFECT REMOVE: <Effect>[, self | target]; IF: ...]`; the
Effect a Condition (`frightened 2` for one with a value, 1 with none) or a named Effect; stored
`{ kind: "apply", op: "apply" | "remove", effect: { name, slug, condition, value? }, who, when,
until, cost }`. Refused: the Conditions the system runs (`SYSTEM_CONDITIONS` in
`module/rules/applied.mjs`: the Bind's three, wounded, dying, dead, spent, preparing; an Exposed
Zone by `readEffectName`), `UNTIL` beside a numeric Condition and after `REMOVE`, a `target` line
with no `IF: RESULT` (ruling 321), a number after a Condition with no value or after `REMOVE`,
an APPLY inside `[AURA ...]`. **It has ONE hook, `applies`, the seventh hook point, calculated**
(`ruleApplies(actor, { item, rank })` in `module/rules/engine.mjs` -> `{ lines, skipped }`: the
rules on the Item behind the use, as `ruleGives`; every line whose rank conditions hold, WHATEVER
its degree and cost; Off dropped, a Skip under `skipped` with its mark). **NO `use` AND NO `card`
HOOK, on purpose**: `usableByRule` would send the row down `#useWithRules`, which never rolls its
check, and `paidElsewhere` would call it paid from its card. **The pure half is
`module/rules/applied.mjs`**: a LINE (`{ op, effect, who, until, degree, cost }`), `linesFor(lines,
{ degree, cost })` (lines of no degree always stand; a cost line only when the cost paid is
known and equal), `needsCost`, `appliedWindow`, `appliedRecord` (every key always: `slug`, `name`,
`condition`, `by`, `byName`, `maneuver`, `maneuverName`, `combat`, `until`, `from`),
`settleApplied`, `appliedBy`, `effectCensus`, the words. **An applied Effect is an ActiveEffect
with `flags.starwrought.applied`**: that record is how the system knows what is ITS to refresh
and to end. **A Condition already on by other means is left alone** (ruling 313):
`setCondition(id, value, data, { force, applied })` in `documents/actor/conditions.mjs`, where
`applied: true` returns an effect with no record untouched, decided inside the write queue.
**The writes** (`module/rules/effects-state.mjs`): `applyEffectTo(actor, line, record, { force })`
-> `{ ok, refreshed }` or `{ skipped: "window" | "prevented" | "already" | "stronger" }` (a
numeric Condition only when it raises the value, the record only on one put on fresh),
`removeEffectFrom` (`absent`, `held` for an Off-Guard a Critical Hit or a Gain Control holds),
`removeAppliedFrom(actor, from)`, `settleAppliedEffects(combat, change, { over })`, called by
`settleGivenResults` after `settleBindWindows` and by `endEncounterEffects`: **expiry was built
before anything could apply**. **Windows** (rulings 314, 316): `readUntil(text, { edges })` in
`operators.mjs` reads `end`, `start`, `begin` only for `apply` (`COMPONENT_TAG.UNTIL` is `["give",
"apply"]`); `untilEdge(until)` is the explicit edge, else a giver's `begin` and a recipient's
`end`; `settle` in `given.mjs` reads it, so a pending result's window (no `edge` key) settles as
it did; the applied window is `{ who, edge, combatant, n, begun }` on the record. **"In an
encounter" for a window is a started Combat the user or the recipient is a combatant in**
(`runningCombat(giver, recipient, preferred)` in `documents/cards/apply.mjs`: the Combat the
check card recorded, then the one viewed, then every other in `game.combats`), BY MEMBERSHIP
and never by what a client views (found live with Mike's own Combat on screen, and by the review
for a GM viewing another Combat); outside one a line with `UNTIL` is `skipped: "window"`.
**Three options of `setCondition` are decided INSIDE its write queue**: `applied` (above; an
effect that is switched off is not on, so it is switched on and becomes the line's), `raise`
(a numeric value is only ever raised, and one already on keeps whose it was) and `only` (a
Condition goes off only while its effect still carries THAT application: `sameApplication` in
`applied.mjs`, which `endApplied` and the `begun` write ask, so a later APPLY's refresh is never
taken off by the earlier window). **Any write that puts a Condition on now switches a
switched-off effect on again** (older than 0.32.0: `setCondition` merged onto it and left it
off). **The use** (`documents/item.mjs`): `applying` is `!elsewhere` and an apply
rule (a built-in returns before it), so a row the system runs another way applies nothing
(ruling 321); `#applyCost(plan, paid)` (Finish's `paid`, else `plan.n`, `#chargePlan` now
answering `picked`, else the row's one cost, else `pickCost` when a line waits on the cost,
undefined for a closed pick; ruling 318); `#applyTarget` (the one targeted token, never the
user's own body); `#applyOnUse(actor, { cost })`, the no-check path and `#useWithRules`, lines of
no degree about the user, `force: true` (ruling 315), said on the Maneuver's own card;
`finishPrepared` passes `paid: prep.cost`. **The roll** (`dice/check.mjs`): asked only when the
use handed over `cfg.applies { cost, target }`; `cfg.applied` becomes `flags.starwrought.applies
{ lines, maneuver, target, cost, combat }` (`check/card.mjs`); `#applyOwnLines` after
`toMessage` and after `postResult`; `rerollCheck` copies the flags. **The card**
(`documents/cards/apply.mjs`, modelled on `give.mjs`, whose `sameBody`, `wasRerolled` and
`writerFor` it imports): `applyLinesTo` (the one write every path shares, plain-text words),
`applyOwnFromCard` (the roller's lines at once, never when `message.blind`; a reroll's card
first takes back what `rerollOf` put on the roller), `drawApplyWidget` (class `sw-card-effects`:
`sw-card-apply` was the damage and Expose widgets' already; **the roller's own side has a button
on a blind roll's card alone**, since the roller's client is that side's one writer everywhere
else), `applyFromCard`, `applyLines` (one side of one card at a time, `applying`; **a card that
names its target is held to it**, and a `self` request is served for a blind roll alone),
`effect:apply` / `effect:done` / `effect:refused` routed in `chat.mjs` and `starwrought.mjs`,
the record card `{ kind: "applied", from, who, words }` read by `appliedRecords(messageId)`
and whispered to whoever saw the check PLUS the check's author (`recordWhisper`; the give card
too since 0.32.0), `registerApplyCards`. **`COST(<n>)`** is a
condition (`ops.cost`, 0 to 12), read by `apply` alone; `bonus` refuses it in a line of its own.
**`mine`** (ruling 319): `EFFECT(<name>, mine)` stores `mine: true` on the `has` entry;
`listHas(list, ref, { by })` and `effectHolds(rule, { self, other, by })`; `effectList` keeps a
Condition's own record under `applied`. **Screens**: `effectAppliedTag` in `helpers/effects.mjs`
(the Applied tag on both sheets' Effects rows), the glance's `full || e.applied` (ruling 320),
`apply` in `EFFECT_KINDS`. **The parse refuses a forgotten comma** (`APPLY: prone target`, which
read as a named Effect "prone target" on the user) and WARNS through `context.warn` on a name
that begins with a Condition's (`frightened two`). **The build**: `effectCensus` in
`assets/build_foundry.mjs` (a named Effect read and never applied; an APPLY on a built-in or
paid-elsewhere row; an `IF: RESULT` line on a row that rolls no check, known from `rolls` on the
carrier), each with its row in `RULES` in `build_report.py`. A subordinate reads its parent's
cost and a Reaction its Reaction half's (`#applyCost`); a row with a `SUBORDINATE` line applies
none of its own APPLY lines. **A new card widget class must not reuse `sw-card-apply`**, and
**a pinned die in the test world is `CONFIG.Dice.randomUniform = () => 0.001` for a natural 20
and `0.999` for a natural 1.** The release carries the kind alone: the cells for Stand, Drop
Prone, Take Cover, Trip, Shove, Disarm, Grapple, Demoralize, Feint and Escape are printed in the
0.32.0 changelog entry and `AUTOMATION_GRAMMAR.md` section 5 for Mike to paste, and his four
workbooks were not converted, built, staged or written.

**0.31.0 (Mike, 2026-11-17; rulings 305 to 310): Effects are read by name.** Mike, writing
`[REQUIRES ...]` cells down the Basic Actions list: "even the [REQUIRES] grammar should be
effects-based ... assuming each Actor has an Effects list of whatever effects they have,
conditions, etc., REQUIRES should just look for a string in that Effects list", then "Plan both
together" with named Effects, step two. Planned first (`dazzling-floating-simon.md`; his decisions
by question: the writing tags will be APPLY and REMOVE, an Effect on yourself lands at once and
one on another creature by a button on the card, a named Effect in REQUIRES has the word `effect`
in front). **Built as two releases; 0.31.0 is the READING half and adds no kind, tag or hook
point. 0.32.0, the `apply` kind (`APPLY` and `REMOVE` on a Maneuver's own row, the `applies` hook
point, windows, the `effect:*` relay), was planned in the same file and is built (above).**
**The Effects list** (ruling 305; `module/rules/effect-list.mjs`, pure): a creature's Conditions
(its statuses, each with its value) and its NAMED EFFECTS, every other active effect on it by
`slugify(plainName(name))`, plus a character's custom effect rows by their label. Nothing new is
stored; a named Effect is an ActiveEffect with a name (the sheets' "new effect" control), carries
NO status id, and a disabled or suppressed one counts for nothing. `effectsOn(actor)` gathers it
(`statuses`, `appliedEffects` else `effects`, `system.effects`); `readEffectName(written)` reads a
name a cell writes (**a Condition's name is reserved**: `EFFECT(prone)` is the Condition; an
Exposed Zone is refused; a name is letters, digits, spaces, hyphens and apostrophes, never a word
of the grammar); `listHas`, `namedEffects`. **Bind states were already Conditions** (`bound` is a
neutral Bind, `controlling`, `controlled`), which Claude had told Mike were missing and corrected.
**REQUIRES** (ruling 306; `module/rules/requires.mjs`): `effect <Name>` (`{ test: "effect", slug,
name }`; a bare word stays a Condition or a known word, so a typo is still an error and fails
open), `bind, <state>` (`{ test: "bind", state }`; the comma is taken out in `readRequires`, the
one comma a block reads) and `<who> <distance> with <Condition | effect Name>` (`with` on the
`near` term; a creature whose Effects were not given is "cannot tell"). `situationOf`
(`module/helpers/situation.mjs`) gives `effects` and each `near` entry its `conditions` and
`effects`. **`EFFECT(<name>)`** (ruling 307; `readCondition` in `module/rules/effects.mjs`) is
stored under its own ops key, `has = [{ name, slug, condition, on }]`, apart from step one's
`used`: **the prefix decides whose, `IF:` the creature rolling (`on: "self"`) and `IFT:` the
roll's other party (`on: "other"`), the one condition of which that is true.** `operators.mjs`:
`effectConditions`, `readsOtherEffects`, `effectHolds`; `needsMoment` is true for an other-party
rule, so a self rule is in the sheet's Threshold while the Effect is on and an other-party rule
is read at the Threshold read, the Defense roll, a Strike's pairing (`pairingOnly` lets it
through beside `MARKED`; the blind die knows nobody) and a check against a target. Read by the
`bonus` kind alone (`parse` copies `has` only when set, so a rule that asks for none is stored
as before; **`bonus`'s `parse` returns a fixed list of fields, so a new ops key not copied there
is dropped in silence**); refused beside a `FOR` that reaches others (an aura's ring included)
and by every other kind through `refuseComponents`. **A check read against one creature's
Threshold has that creature as its other party** (ruling 308; `otherOf` in
`module/dice/check/modifiers.mjs` falls back to `cfg.targetActor`). **A rule reads a named Effect
off any creature; the glance shows a hand-made one to its owner and the GM alone** (ruling 309,
narrowed by the review from the plan's "as public as Conditions": a GM may keep a private note
as an effect on an adversary; one a Maneuver applies in 0.32.0, with `applied` on it, shows to
everyone; `module/canvas/glance.mjs`, which now also redraws on the three ActiveEffect hooks),
and `with` may still show a player that an adversary carries one. **One function decides what
is a named Effect, `namedEffectOf(name)`** (glyphs out, then `readEffectName`'s shape): the
list, the sheets' tag and the glance share it, so an effect called "Blessed!" is on no list.
`readEffectName` refuses `not` in front, a Condition with a number (`Fatigued 2`) and an Exposed
Zone however spaced; `bonus` refuses `IFT: EFFECT` on INIT and SPEED lines and beside `CLAIM`.
**Three older defects the review found were mended**: an `INIT` line never reached an Initiative
rolled with a Defense Constellation, the default one (the `momentOnly` skip in `bonus.mjs`, since
0.13.0); an apostrophe after a letter opened a quote in `splitOperands` and `splitComponents`
(`WORD_CHAR` in `operators.mjs`); and `SwCheck.resolveAgainst` resolved the pairing's modifiers
apart from the die's, so one Talent's lines on both counted twice (it adds the difference now).
**A player's hand change to a named Effect is an Adjusted card** (ruling 310;
`module/documents/audit.mjs`: created, deleted, renamed, switched; never a Condition's own
effect, the GM, or a write passing `swAnnounced` or `swChecked`). The Effects tab's Active
Effects rows of both sheets carry a tag saying how a line reads each (`effectReadAs` in
`module/helpers/effects.mjs`: `prone`, `EFFECT(Blessed)`, or "not read" with why). **An option
of a pure function is never named `valueOf`** (destructuring finds Object's own; the self-test
caught it). His four workbooks in progress were not converted, built, staged or written. **The
equipment sheet was rebuilt at the commit** (2026-11-17): `data/equipment.xlsx` had been saved
after 0.30.0's last equipment build with EVERY row enabled (29 weapons, 8 ranged; 27 armor; 3
shields; 3 ammunition), so `build_all.mjs --equipment` was run before it was committed, and the
pack sources hold all 62 rows. **Before committing `data/equipment.xlsx`, run the equipment-only
converter and see whether `assets/equipment.json` moves; if it does, run the equipment build.**

**0.30.0 (Mike, 2026-11-15; rulings 297 to 304): ammunition, `[REACH N]`, the equipment build, and
the workbooks' new names.** Mike, after 0.29.0: he took the armor, shield and weapon tables out of
the handbook (the third part of the HANDBOOK RULE, above), renamed eleven workbooks (the table
under Where the source of truth lives), added an Ammunition tab to `data/equipment.xlsx`, and
asked for "a [REACH N] Automation Grammar, where N is the natural reach for the ancestry".
Planned first (`dazzling-floating-simon.md`; his decisions by question: an equipment-only build,
out of ammunition warn and go on, `[REACH N]` set and adjust, recovery left to the table).
**The equipment build** (ruling 302): `python assets/xlsx_to_trees.py --equipment`
(`equipment_only`; the equipment workbook is told from the others by the sheet names in its
package, `sheet_names` and `is_equipment_workbook`, so no other workbook is loaded; it shares
`write_equipment` with the full run) and `node assets/build_all.mjs --equipment`
(`sync_equipment.cmd`): that step, `inject`, `test_rules`, `build_foundry --no-compile` and
`check_style --quiet --equipment` (of the spreadsheets, the equipment workbook alone); a step
names its `equipment` shape in `STEPS` or is skipped; drift is a warning; it takes no other flag.
The build report at the end of every build still reads every workbook, read-only. **Use it while
Mike's talent and action workbooks cannot pass the content loop; it is the one build allowed on
his data today, and `data/equipment.xlsx` is therefore a built, committed workbook.**
**Ammunition** (rulings 298 to 300): the converter reads the Ammunition sheet (`AMMUNITION_SHEET`,
`BUNDLE`: "Arrows (10)" is Arrows, ten to a stack) into `equipment.json`'s `ammunition`, with
`check_ammunition`'s three warnings (each has its row in `RULES` in `build_report.py`);
`build_foundry.mjs` ships a `gear` Item for each enabled row (`system.ammunition` the Weapon
Group, `quantity` the stack, the price said "per 10"). In play the gear model has `ammunition`
and `isAmmunition` (`module/data/items/gear.mjs`); `ammunitionFor` (the character's stacks for a
weapon's Group: one In hand first, then by name) and `takeAmmunition` (`takes`, `used`, `short`,
`left`, `kind`, `kinds`) are pure, in `module/data/items/weapon-traits.mjs`; **`loadWeapon` in
`documents/actor/carrying.mjs`, the one place a weapon is loaded, is the one place ammunition is
taken**: one piece for each shot it adds, the quantities written with `swAnnounced`, and the
weapon LOADED FULL whatever was found (Mike: warn and go on); `reloadWeapon` prints a line for
each kind used and, when short, the `Ammunition.short*` line and a notice. Never taken by a
Strike, the chip or a refund; a weapon with no Weapon Group counts nothing. The Equipment tab's
ammunition row has a count and `adjustQuantity` minus and plus (a player's change is the audit's
existing `quantity` line); the Loaded chip's tooltip says what is carried.
**`[REACH N]`** (ruling 301; the `reach` kind, the twenty-third, a feature block with no hook):
`[REACH 2]` sets Natural Reach in feet (0 allowed), `[REACH +1]` adjusts it (0 refused);
`naturalReach(size, { set, add })` in `module/config/sizes.mjs` (in the barrel) is the one
computation; `_prepareRules` collects `features.reach` (the highest set among the owned Talents,
the sum of the adds) and `data/character/offense.mjs` sets `system.reach` from it, which every
reader of Natural Reach already goes through. **Read live off the Talents owned, never stored at
creation** (unlike Speed), so a character follows its Root's block once Sync content refreshes
its copy; an adversary's reach is its Size's. For display only, `ancestryFacts` in
`assets/parse_rules.mjs` writes a Root's set as the roster record's `reach`, and the chassis
model (`reach`, nullable), `CHASSIS_FIELDS`, the wizard's card, the chassis sheet, the web app
and `build_phb.js` print it.
**Sync content refuses sources newer than the running code** (ruling 304): `planContentSync`
throws (`swVersionMismatch`) when `index.system` is newer than `SW.SYSTEM_VERSION`, since an
older client would write the new documents through a data model that drops their new fields and
record them level. **A release that adds a field to an Item needs Foundry restarted before the
sync, and a live drive of one must restart Foundry first.** The guard protects from 0.30.0 on: a
world still running older code has none, so both loops end by saying to restart Foundry after a
system update (`RESTART_FIRST` in `build_all.mjs`). **The equipment build runs no `parse_rules`**:
`build_foundry` reads the `rules` the last full or content build left in `trees.json`, so never
run the strict `parse_rules` on Mike's sheets in progress before it (a strict failure strips
them). The sheet as 0.30.0 built it enabled ammunition
and no weapon that takes it, with Dagger, Shortsword and Spear switched off (Mike enabled every
row afterwards; built with 0.31.0); 27 armor pieces gained their descriptions. What takes ammunition is one rule in two
languages: `takes_ammunition` in the converter and `ammunitionOf` in the system (ranged, and a
Reload or a Capacity above 0).

**0.29.0 (Mike, 2026-11-15; rulings 290 to 296): Strike from the Maneuvers tab, loaded weapons, an
Unarmed Strike for everyone, and "in sight".** Mike, on writing Strike's `[REQUIRES ...]` cell: "I
can foresee many situations in the future where we need some sort of 'if you can see an ally' or
'if you can see an enemy' ... For a ranged weapon, it must also be loaded. There should be 1/2/3
action buttons on the Strike row on the Maneuvers tab... when you click on it, you can choose what
you want to Strike with". Planned first (`dazzling-floating-simon.md`; his decisions by question:
loading tracked fully, an empty weapon warns and goes on, ammunition counted too as ITS OWN NEXT
STEP, every character given an Unarmed Strike now). **Loaded** (rulings 290, 291, 293): a ranged
weapon with the Reload trait takes ammunition; the pure half is in
`module/data/items/weapon-traits.mjs` (`ammunitionOf`, `shotPlan`, `nextLoaded`), the weapon model
stores `system.loaded` (null is "never set" and reads as FULL, so nothing was migrated) and derives
`takesAmmunition`, `magazine` (its Capacity, else 1), `shots`, `isLoaded`, `isFull`, `reloadCost`;
`PRESERVED_PATHS` in `helpers/content-sync.mjs` keeps `loaded`. A Strike uses a shot ONLY IN AN
ENCOUNTER and only where it is certain, never on the blind per-defender dice and never for a
throw; an empty weapon is a notice and one "Not loaded" card (`#announceUnloaded`) and the Strike
goes on. **A declared Strike's shot has ONE WRITER, the coordinator** (the review's mend): the
record carries `maneuver.shot` and `maneuver.unloaded` (`resolveSource`, `maneuverFrom`,
`AttackWorkflow.create`), the shot is taken in `#handleDeclare` as the record is registered and
given back by `#refundStrike`, both through `#queueShot` in `combat/attack-coordinator.mjs` (a
chain for each weapon, each write reading the count when its turn comes; a new declaration waits
for a write in flight before `resolveSource` reads the count), and the attacker's client only
posts the card the record asks for. A Strike with no target has no record, so its shot is taken
on the attacker's client in `beforeRoll` (`settleShot` in `documents/actor/attack.mjs`). **"In an
encounter" for a shot is membership of a running Combat** (`#combatOf`, the record's `combatId`;
`AttackCoordinator.encounterOf(actor)` for a caller outside), never `actor.inEncounter`, which
reads the Combat a client VIEWS; the refund of actions asks the record the same way since 0.29.0.
`rollAttack` holds a weapon to one Strike at a time (`STRIKING`; never the flow's blind dice or a
Reaction's Strike). **A full weapon is stored as null** (`SwItem#_preUpdate` writes a count at or
above the magazine as "never set"), so read `system.shots` and never `_source.system.loaded`.
**Every write of `system.loaded` the system makes passes `{ swAnnounced: true }`**; a player's
hand change is an Adjusted line (`STARWROUGHT.Audit.loaded` in `documents/audit.mjs`). The chip on
the Equipment row is `toggleLoaded`. **Reload** (ruling 292): `BUILT_IN_MANEUVERS.reload` is
`SwActor#reloadWeapon({ item, weaponId, prepared })` in `documents/actor/carrying.mjs`: the weapon
in hand that takes ammunition and is not full (`reloadOptions`; `pickReloadWeapon` when two), the
gate, THAT WEAPON'S Reload N as the cost (never a pick), Prepared at three with the weapon
remembered in `preparing.weaponId`, and **`loadWeapon(weapon)`, the one place a weapon is loaded,
which is where ammunition will be taken**; free outside an encounter or with `trackActions` off;
`ENGINE_REQUIRES.reload` is `weapon unloaded`; `CHARACTER_BUILT_INS` in `documents/maneuvers.mjs`
passes an adversary by (it has no weapon Items, so its Reload row stays a plain Maneuver). **The fist** (ruling 294): every character has the
Equipment compendium's Unarmed Strike (`unarmedStrikeData` in `helpers/content.mjs`, a world
weapon of the name standing over the pack's), given once by `migrateWorld`'s 0.29.0 step (the
first step that CREATES documents, so the elected GM client alone gives, `isElected`; the
stamp stops at 0.28.0 when the pack cannot be read or the client was not the elected one, so the
step runs again, and nothing else ever gives a missing fist) and at creation by
`SwActor._preCreate` (`updateSource({ items: [one new Item] })`), never to a character that
`hasNaturalWeapon`. **A natural weapon is always in hand** (the weapon model sets `held` at
prepare whatever the stored state), takes no hand, is refused by `setCarryState` at no cost, is
never loot (`isLoot`), is left out of the glance, and **never stands in front of a real weapon**:
`longestMelee` (the longest reach, a real weapon before a natural one on a tie), `strikeOptions`
and `reloadOptions` in `weapon-traits.mjs` are the one place the
order of weapons in hand is decided, read by `reachWeapon` (`data/character/offense.mjs`),
`interceptWeapon` (`documents/movement.mjs`) and the Riposte (`documents/cards/position.mjs`).
**A new reader of "which weapon is in hand" goes through those helpers.** A character holding
only a bow now has its Natural Reach (2 ft), counts for Support and is offered an Intercept as an
unarmed Quick Strike. **Strike** (ruling 295): `BUILT_IN_MANEUVERS.strike` is
`SwActor#strikeWith({ strike, weaponId, dialog })` for a character (an adversary still gets the
card), the chooser is `module/apps/strike-picker.mjs` (`pickStrikeWeapon`, one button for each
weapon in hand, one choice asking nothing; `strikeOptionLabel` over `weaponNumbers` in
`helpers/actor-context.mjs`), and then the weapon row's own `rollAttack`; Strike left
`PAID_ELSEWHERE` (eight rows now) and `Cost.paidByWeapon` is retired; the row's three buttons are
`strikeWith` in the sheet, which uses the row's own Item. **The words** (ruling 296; no new kind):
`foe|ally|creature in sight` (`range: "sight"`: any token the nearness reading already counts),
`weapon loaded`, `ranged weapon loaded`, `weapon unloaded` (states read before a trait;
`WEAPON_STATES`), and `weapon` with no trait named is never a natural weapon. **The handbook was
not touched**: the Reload [N] cell that the plan called empty nests a one-cell table ("After
firing, you must spend N Interact actions before the weapon can fire again"), which python-docx's
`cell.text` does not read; **look in the raw XML before calling a handbook cell empty.** Mended on
the way: the Strike pills on a weapon's row were dim until hovered (a child's opacity cannot
exceed its parent's; `styles/character.css` undims the controls group that holds them with
`:has`). The release carries no new content: Strike's cell is printed in the 0.29.0 changelog
entry and `AUTOMATION_GRAMMAR.md` section 5 for Mike to paste, the Reload block printed with
0.28.0 is withdrawn, and his workbooks were not converted, built, staged or written.

**0.28.0 (Mike, 2026-11-15; rulings 281 to 289): the Maneuvers tab: even pips, only what applies,
Favorites.** Mike, with a screenshot of the tab: "Some of the action pips are different sizes";
"Many actions that should unavailable based on the situation are there. I would like to only show
Maneuvers that the system detects are applicable, but still allow the player to click a button to
see all Maneuvers ... if you are not Prone or Supine, you cannot Stand. If you have no Spells, you
cannot Cast. If nobody is within your reach, you cannot Grapple"; and "I also want players to be
able to 'Favorite' maneuvers; these are always at the top of the list and are always visible."
Planned first (`dazzling-floating-simon.md`; his decisions by question: the conditions written in
the sheets, also hidden for the wrong mode, a cost that cannot be paid and not your Opportunity,
Favorites on the character). **Every cost on a sheet is a drawn pip** (no ruling): `costParts` and
`costPipsHtml` in `module/config/actions.mjs` (pure, in the barrel), the `swCostPips` Handlebars
helper, `.sw-cost-pip` (a disc sized in `em`, the numeral cut dark with `-webkit-text-fill-color`
so `color` stays the disc's), `.sw-cost-join` and `.sw-cost-react` in `styles/sheet.css`; used at
every `.sw-action-glyph` site, in `action-pips.hbs` and on the Pass, Recenter and Item-window Cast
buttons; `system.glyph` is unchanged and every tooltip, dialog and spend line still reads it as
text, as do the small captions (the Overview's movement labels and Strike kinds), which were
never uneven. **A cost on a sheet goes through `{{swCostPips <glyph text>}}`.** **The `requires` kind, the twenty-second**
(ruling 282): a feature block on a MANEUVER'S OWN ROW and nowhere else, `[REQUIRES <condition> or
<condition>]`, every block on the row to hold, `or` for alternatives, `not` for a word turned
round; the words are a Condition's name (`conditionIdOf` in `module/config/conditions.mjs`, shared
with `prevent`), `supine` (accepted, known false until built), `bind`, `spell`, `shield`, `shield
raised`, `rigid`, `free hand`, `holding`, `weapon` with `melee`, `ranged` or a trait, `foe`,
`ally` or `creature` with `adjacent`, `in reach` or `within <feet>`, and `encounter`; stored `{
kind: "requires", any: [{ test, not?, ... }] }`; `REQUIRES` sits before `EFFECT` in
`FEATURE_KEYWORD_LIST`; **no hook and no hook point**, never in `EFFECT_TAGS` or `EFFECT_KINDS`.
**Everything the tab decides is one pure module, `module/rules/requires.mjs`** (`readRequires`,
`requireWords`, `checkCondition`, `availability`, `requiresFor`, `maneuverStatus`, `freeHands`,
`arrangeManeuvers`), driven by the self-test. **Three answers, not two** (ruling 283): a word is
true, false or null ("cannot tell"); a block fails only when every alternative is known false;
`not` of null is null; so a row is left out only when the system knows. **The four reasons**
(rulings 284 to 286; `maneuverStatus`, `STATUS_REASONS`): `requires`; `mode` (in an encounter, an
Exploration Activity or a Downtime Endeavor, by `isExploration` / `isDowntime` or the trait);
`opportunity` (in an encounter, not the turn, no permit, anything but a Reaction, which for the
tab is the flag, the trait or a Trigger); `cost` (in an encounter with `trackActions` on, the
cheapest of `actionCostOptions` and a Reaction's own cost above the actions left). **The engine's
five** carry their conditions as the same words in code: `ENGINE_REQUIRES` in
`module/documents/maneuvers.mjs` (cast `spell`; close `controlling`; gain-control `bind`, `not
controlling`; raise-a-shield `shield`; pass `encounter`); a block in the cell replaces them.
**The situation is read in one place**, `module/helpers/situation.mjs` (`situationOf`,
`maneuverRow`, `statusOf`; ruling 287): `actor.statuses`, `system.bind.state`, spell Talents, held
shields, weapons and gear, `freeHands`, and who is near (every other token on the viewed scene the
CHARACTER's token can see by `canSeeToken`, never a `hidden` token, a party token or a dead body,
null with no token on the scene or while Blinded; `gapBetween`; "in reach" the longer of
`reachesOf(actor).total` and `.natural`, since `totalReach` is 0 with only a ranged weapon in
hand; a lazy getter, worked out only when a row asks and once for the tab), the
encounter, the actions left, `isTurn` and `hasPermit`, never `canActNow()`, which is true for any
GM: **the GM sees what the player sees**. **The tab** (`module/apps/actor-sheet.mjs`):
`#maneuverRows` builds every row once (the Talents' Maneuvers, the character's own, then the
Basic ones, so an owned copy stands over the Basic row of its name), `#prepareManeuvers` arranges
them (`context.maneuvers`; the old `basicActions`, `talentActions` and `actionItems` are gone),
`templates/actor/maneuver-row.hbs` is the one row partial, the toolbar's button is
`toggleAllManeuvers` over the client setting `showAllManeuvers` (no config entry, the
Constellations toggle's pattern; ruling 281), and the bookmark is `toggleFavorite` over
`flags.starwrought.favoriteManeuvers` on the character, slugs in the order marked, written with
`swAnnounced` (ruling 288). **It watches** while open (`#watchManeuvers`, released in `_onClose`;
`MANEUVER_WATCH_HOOKS`): the Combat and Combatant hooks, `createToken`, `deleteToken`,
`controlToken`, `canvasReady`, the three ActiveEffect hooks (another creature's Conditions), the
three Wall hooks, `createSetting` and `updateSetting`, and `updateToken` for x, y, size, hidden,
disposition; a 150 ms `setTimeout`, then a fresh signature of the rows against the one last drawn
(kept in `_onRender` only when the `actions` part was among the parts rendered, since every
render prepares the whole context), and a render of the `actions` part only when they differ,
never on a LIMITED user's sheet, which is the glance alone. **Nothing is refused** (ruling 289): a
dimmed row is used as any row. **Only a Basic row gives way to a row of its name**
(`arrangeManeuvers`, `isBasic`): two Items of one name on a sheet are both listed. The release carries the kind alone: the
twenty-eight blocks are printed in the 0.28.0 changelog entry and in `AUTOMATION_GRAMMAR.md`
section 5 for Mike to paste, and his workbooks were not converted, built, staged or written.

**0.27.0 (Mike, 2026-11-15; rulings 269 to 280): the Bind, automated.** Mike asked "what
automation do we have around creating, closing, controlling, and/or breaking a bind?", then "Plan
it" (`dazzling-floating-simon.md`; his decisions by question: only a fighter's own movement ends
a Bind, the shield exception, Parry follows its Talent, the Quick Strike rule kept, a Cast is an
attack, Gain Control's Failure makes the Bind neutral, and three extras built: Form a Bind by
hand, an adversary's Gain Control, momentary Control by Size). **Every Bind decision is one pure
module, `module/combat/bind-rules.mjs`** (`usesBoundImplement`, `attackBindPlan`,
`movementBindPlan`, `bindOffer`, `gainControlOutcome`, `sizeGap`, `isLarger`, `momentaryFor`,
`momentaryStep`, `BIND_END_REASONS`, `MOMENTARY_FLAG`, `PRESSED_FLAG`), driven by the self-test;
the callers only write. **Attacks** (rulings 270, 273, 276): with every die in and before the
first result card, `AttackCoordinator.#planBinds` builds the plan ONCE for the whole attack and
`#endPlannedBinds` writes it after the card holds it
(`workflow.bind`, in `AttackWorkflow.create`, `projectFor` and `PUBLIC_KEYS`: the attacker's Bind
ends for the bound implement, another weapon or a Cast; a defender Controlling someone else loses
the line; the shield exception reads the shield-bearer's Strike at the Controlled partner as one
with the bound implement), ends every Bind it may write by identity (`endBind({ id, reason })`)
and names the rest in the attack card's log; what outlives the Bind rides on each card's flags,
`controlZone` (the Zone the attacker's Control held open: `SwDamage.roll` offers it,
`SwDamage.apply` and `zoneProtection({ exposed })` read it as Exposed, for the card's own target,
through the GM's relay too) and `controlledAttack` (an adversary's Threshold:
`attackThreshold(attacker, maneuver, { controlled })`, `thresholdForCard`); a reroll copies both.
A Strike or a Cast with no target runs the same plan in `rollAttack` and `castSpell`. Through
0.26.1 the three rules lived in a character's weapon Strike alone, at the blind die, so the Zone
closed before the Controller's own damage. **Movement** (rulings 269, 277, 278):
`settleBindOnMove` in `documents/movement.mjs`, from `chargeMovement` and outside the
`trackActions` block, for every drag the system counts as the fighter's own (never `swNoCost`,
an undo, a GM's off-turn drag, a token outside the encounter); a **Close** is the Controller's
Step that ends nearer the partner, centre to centre, with no click (`close` is in
`PAID_ELSEWHERE`, which ended a double charge); the larger of two fighters two or more Sizes
apart keeps the Bind. **Gain Control** (rulings 274, 275, 280): `SwActor#gainControl({ item,
free, note, from, dialog })` in `documents/actor/bind.mjs`, `BUILT_IN_MANEUVERS["gain-control"]`
and a Bind-line button; a character's Melee check against the partner's Guard
(`helpers/threshold-read.mjs`, `readTargetThreshold`, which `SwItem` shares), gate and ❶ at the
roll; an adversary posts a request card (`GAIN_CONTROL_REQUEST`) and its partner rolls Guard
(`kind: "check"`, slug guard) against `attackThreshold(..., { controlled: false })`, read through
`gainControlOutcome(..., { inverted })`; the card's flags carry `gainControl { bindId, userUuid,
partnerUuid, state, inverted, from }` and `documents/cards/gain-control.mjs` draws the result and
the one button from them and the live Bind (`drawGainControlWidget`, `applyGainControl`,
`rollGuardFromCard`, `answerTo`, `registerGainControlCards`). **A result is written once** (the
review): the Bind card the write posts carries `flags.starwrought.gainControlApplied` (the check
card's id; `appliedRecord`, the `applies` option of `takeControl`, `releaseControl` and
`formBind`), and the button is offered only while none exists, the result changes something and
the Bind is still in the state the roll began from (`gc.state`; `gainControlForReroll` sets it to
the live state for a reroll's card); `GAINING` holds a fighter to one Gain Control at a time; the
adversary's Attack Threshold is withheld whoever rolls; a blind roll is not auto-applied. **The
Bind record gained
`pressed`** (a one-shot token: the Controlled side's `#writeBind` puts a flagged Off-Guard on
itself, `flags.starwrought.pressed` on the effect, only in an encounter, taken off by
`settleBindWindows` in `rules/effects-state.mjs` as that fighter's Opportunity begins and at the
encounter's end, which also reaches a body that left the tracker: the first condition with an
expiry of its own), and the Controller of a momentary Control carries
`flags.starwrought.momentaryControl`, counted in the same sweep and ended with
`releaseControl()` (also the Bind line's Make neutral). **`pickUpMirror` is strict on a live
update** (id, Zone and `pressed` too) and lenient in the load sweep. **Parry** (ruling 271,
replacing 131): `bindOffer` in `dice/check/position.mjs`; a Parry's neutral Bind adds the
`gainControlFree` button (`gainControlFromCard`: forms the Bind if absent, then
`gainControl({ free: true })`, once for a card). **Form a Bind by hand** (ruling 279):
`formBindByHand` and `apps/bind-picker.mjs`, on both sheets' header while in an encounter and in
no Bind. **The handbook**: `PROPOSALS["bind"]`, four tracked changes in v4.25 itself (backup in
`backup/pre-0.27.0/`). Not driven live: a Cast (no spell ships enabled) and a table with no GM.

**0.26.1 (Mike, 2026-11-15; no ruling): N/A in an Automation cell means "no automation".** Mike:
"For Maneuvers, Talents, etc. that do not require automation, I am going to put N/A in the
Automation field. Make sure the engine doesn't confuse that with automation grammar." Planned
first (`dazzling-floating-simon.md`). **A line that says only "no automation" is skipped by the
grammar as a blank line and a `#` comment are** (`isNotApplicable` in
`module/rules/syntax.mjs`, pure; called first thing in `parseAutomation`'s line loop): `N/A` in
any case, `NA`, `N.A.`, `None`, a lone dash, with or without a full stop or square brackets. It
is the whole LINE: `[EFFECT N/A]`, `CHECK: N/A` and `N/A for now` are still mistyped lines.
`N/A` beside rules is one warning (`NOT_APPLICABLE_WITH_RULES`, with its row in `RULES` in
`build_report.py`) and the rules stand. A cell that says nothing else is an empty cell to the
build (`isNotApplicableCell`; `parse_rules.mjs` and `automationOf` in `build_foundry.mjs`), so
the Item's Automation box is empty. `highlight_automation.py` never paints such a cell, clears
an old red, and counts them ("N marked N/A"; `notApplicable` in `lib/parse_cells.mjs`'s reply):
**a blank cell is a row Mike has not reached, an N/A cell one he has**. The converter needed no
change (`blank_none` already blanks an exact `N/A`, `None` or dash in every column of every
sheet; the gaps were the red-cell tool, the other spellings, and a world Item's textarea). **A
new kind must not take `na`, `none` or a dash as its word, tag or keyword.**

**0.26.0 (Mike, 2026-11-15; rulings 252 to 268): the PHB v4.25 sync.** The first handbook sync
since v4.24 (`v4.25-sync-report.md`; planned in `dazzling-floating-simon.md`, Mike's decisions by
question, three before the plan and four on its first draft). v4.25 removed every Talent's and
every Maneuver's details from the book (the HANDBOOK RULE's two halves, above; ruling 264) and
changed seven sentences. **One die for each defender** (ruling 252; Area Attacks, and Mike: "ANY
attack ... with multiple targets should be treated in this same way"): every pairing the attacker
rolls keeps its own whole roll on `target.roll` (`AttackWorkflow.rollDataFor`; `workflow.attackRoll`
is never written again and is read only for a card 0.25.0 left mid-attack); `outstandingFor` lists
one `rollAttack` per waiting pairing; `#submitRoll` fills the named pairing alone; a die is stale
only against its own reveal (`AttackWorkflow.rollCurrent`, `#rollCurrent` in the coordinator), not
the phase line; `AttackCoordinator.rollFor(workflowId, targetId, { dialog })` QUEUES one roller's
dice on the roller's client (`#rolling` by pairing, `#rollQueues` by roller, `#rollNow` the die),
so a once-only bonus is used by the first die before the second is built (ruling 254), and a
second click on a pairing joins the first; the card has a Roll Attack button on each row whose
`ownerUuid` is the ATTACKER (the one attacker button and the header roll line are gone), the
Combat Prompt one task per die; `rollBlind(attacker, maneuver, target, link, { dialog, first })`
names the defender in the dialog (`targetName`, `cfg.dialogTitle`); a Shift-click rolls with no
dialog. **A reroll is one pairing's** (ruling 253; `siblingResolutions` is gone; reverses ruling
155 and 0.5.3). **A Prepared Committed Strike keeps every target** (ruling 267;
`preparing.targetUuids`, `rollAttack`'s `targetUuids`). **Multipliers and Divisors combine where
two effects meet on one value, and nowhere else** (rulings 255 to 257; `combineFactors`,
`applyFactors`, `combineDifficulties`, `speedAfterLegs` in `module/config/movement.mjs`, pure):
overlapping Difficult terrain (`SwTerrainData.resolveTerrainEffects`: two at ×2 are ×3), the
party's Travel Speed (`partyTravel`: `ACTIVITY_SPEEDS` and `TERRAIN` carry an `effect`, each
member's figure combined first, the three printed figures rounded down), and the Legs; a Step, a
Crawl, a Leap, a Rush, a second Legs Wound and the damage order are left as the book words them.
**The Critical Hit effects are tracked until a Recenter** (rulings 258 to 260):
`system.zones.<zone>.critical` on the shared actor model, set by the damage pipeline through
`SwActor#setCriticalEffect` (`documents/actor/position.mjs`), cleared by `recenter()`, switched
by hand from the burst on each Zone of both sheets (`toggleCritical`); Arms −2 Situation
(`SW.ARMS_CRITICAL_PENALTY`: a character's `attackModifiers`, an adversary's `attackThreshold` and
flat roll; −4 beside an Arms Wound, Mike's answer), Legs the Speed (a third with a Wound), Head
`reactions.blocked`, Torso Off-Guard (the condition, and read off the Zone in `prepareDefenses`;
the Off-Guard is the Critical Hit's OWN, put on only when none is there, flagged
`flags.starwrought.criticalHit` on the effect, and taken off by `_endCriticalOffGuard` only when
flagged, so the GM's palette Off-Guard outlives a Recenter; ruling 259). A switch by hand goes
through the audit (`CRITICAL` in `documents/audit.mjs`).
**Persistent Damage**: two effects of one type are two (ruling 261; `persistentDamageOf` no
longer hides the Torso Wound's bleed beside another). **One Reaction at a time** is left to the
table (ruling 262, Mike's choice). **Target what is inside a template** (ruling 263;
`module/canvas/area-targets.mjs`): Foundry v14's templates are Regions drawn in template mode; the
system flags one as it is created (`flags.starwrought.template`, `preCreateRegion`), and when its
maker draws, moves or reshapes it their targets become the tokens inside (`tokensInside`,
`TokenDocument#testInsideRegion`; client setting `templateTargets`), with a Regions-controls
button and `game.starwrought.targetInside()` for the same by hand; a Region with a behavior is
never a template; a player never targets what they cannot see (`token.hidden`, or
`!token.object.visible`), and the GM's automatic step leaves a hidden token out while the button
takes it (`hidden` option). **The redline is in the edition itself** (ruling 265; `phb_propose.py
--in-place`, `PROPOSALS["v4.25-redline"]`, backup in `backup/pre-0.26.0/`): fourteen paragraphs,
the Subordinate Maneuver rule in Chapter 8 among them and **Mike's Supine rules** in the
Conditions table (ruling 266: redlined, NOT built; the system has Prone alone and no Roll Over).

**0.25.0 (Mike, 2026-11-15; rulings 245 to 251): Pay It Forward, the Subordinate Maneuver rule,
and the first named Effect.** Planned first (`dazzling-floating-simon.md`; Mike's decisions by
question: a general Subordinate Maneuver rule with the tag word SUBORDINATE, named Effects in two
steps, the recipient anyone but you, no trigger refused) and built as one rule kind, one condition
and one `ALTER` property; no data and no handbook moved, and the rulings are system decisions in
the 0.25.0 changelog entry. Mike asked what to type in Reciprocal Effort's cell ("You may use Pay
It Forward once per round instead of once per encounter"); nothing could be typed until Pay It
Forward itself was automated, and its text was in no file of the repository (it is in his draft
workbook, `C:\Users\Dad\Downloads\StarWrought_Human_Talents.xlsx`, Talent Maneuvers sheet: ⓿, once
per encounter, "have just finished a check that consumed a beneficial Aid result from another
creature ... Aid one other willing ally as a ⓿ Maneuver"). **THE SUBORDINATE MANEUVER RULE (Mike,
standing): "any time a maneuver says to perform another maneuver as part of it, it is at the
original maneuver's listed cost (i.e. costs 0 additional actions) unless otherwise specified."**
**`SUBORDINATE`** (ruling 245; kind `subordinate`, the twenty-first,
`module/rules/kinds/subordinate.mjs`), on the MANEUVER'S OWN ROW and nowhere else: `SUBORDINATE:
<Maneuver>; IF: EFFECT(<name>, used); LIMIT: round | encounter; IF: RANK(...)`, one descriptor (a
Maneuver; a Constellation and the row itself refused), stored `{ kind: "subordinate", to: { name,
slug, type }, used: { name, slug } | null, limit, when }`; two hooks on existing points, `use`
(a refusal, or `{ item, perform: { slug, name }, marks }`) and `card` (a `ruleUse` button).
**`EFFECT(<name>, used)`** (ruling 247; `readCondition` in `module/rules/effects.mjs`, `CONDITIONS`,
`EFFECT_STATES`): NAMED EFFECTS, STEP ONE of two (Mike's Fantasy Grounds idea: "using a Maneuver
can grant a custom Effect on a target (with a specific duration), and other modifiers/effects can
be applied IF that custom Effect field is on the target"). Stored under its OWN ops key, `ops.used
= { name, slug }` (`emptyOps`, `refuseComponents` in `module/rules/operators.mjs`), never in
`when`, where a condition with no rank holds for an Untrained owner; read by `subordinate` alone,
refused by every other kind (`bonus` in one line of its own), the plain `EFFECT(<name>)` and `IFT:
EFFECT(...)` refused as step two. **The used Effect** (`module/rules/given.mjs`, pure: `usedEntry`,
`usedLive`, `usedOf`, `usedEffects`, `isUsedKey`, `usedFlagKey`): `flags.starwrought.rules.used
.<maneuver> = { id: "used:<maneuver>", label, maneuver, maneuverName, by, byName, value, type, to,
from, combat, round, during }` (`from` the card of the check that gave the result), written by `markUpdates(actor, marks, moment)` in
`module/rules/effects-state.mjs` in the same update that deletes a pending result a roll used,
only when the moment qualifies (an encounter, an Opportunity running, the roller's OWN, a bonus,
given by another); the moment is `momentFor` in `module/rules/scene.mjs` (`actor.isTurn`), handed
in because `markUpdates` is driven from Node. Every roll passes through that one place (a check, a
blind Strike, a Defense roll, relayed marks). Held only for its Opportunity; taken off by
`endManeuverMoves` (the 0.24.0 sweep: every turn change, a lone fighter's step, the Combat's end)
and by the Maneuver it triggers (a `per: "effect"` mark `used:<maneuver>`); `removeUsed` is the
GM's bin; the Combat's end also takes every used Effect of that Combat from a holder who left the
fight. **A card knows its roll used a result, and which**: the `give` kind's modifier carries
`given: <maneuver>` and `givenFrom: <the give's card id>`, `cardFlags`
(`module/dice/check/card.mjs`) keeps both, and the button is offered only where `givenFrom` and
the used Effect's `from` agree. **`ALTER`'s eighth property,
`limit`** (ruling 250; `LIMIT_PROPERTY`, `LIMIT_VALUES` in `given.mjs`), `VALUE: round | encounter`,
stored FLAT as `per` (a `limit` key would read as the ALTER's own to `summarizeOperators`),
replaces the row's `LIMIT:` and never adds a use; `limitOf(rule, alterations)` is the limit that
stands, `limitKey` and `limitSpent` are in `operators.mjs` since this release, shared by `permit`
and `subordinate`, so Move Together's limit is alterable too. **Performing** (ruling 246;
`module/documents/item.mjs`): on an answer with `perform`, `#useWithRules` posts no card and pays
nothing; `#performSubordinate` finds the Maneuver (`#findManeuver`: the actor's own, the Basic
Maneuvers, the world, the pack) and uses it with `partOf: { label, cost, marks, gated, note }`;
`#useManeuver` takes `partOf` out beside `prepared`: the PARENT's cost replaces the Maneuver's
own, the gate and the spend carry the parent's name, and the marks are filed where the cost is
paid (the roll's `beforeRoll`, or at once with no roll), so a closed dialog spends nothing;
`paidElsewhere` no longer answers for a kind that also has a `use` hook; `rollRelevantCheck` takes
a `note`. **The card** (ruling 251; `module/documents/chat.mjs`): the kinds' offers are drawn on
Attack and Defense cards as well as check cards (`RULE_OFFER_CARDS`), an offer may name its
`icon`, `ruleUse` uses the offering Item (`useByRule`), and `registerRuleOfferCards` redraws a
roller's recent cards that carry a given result when `flags.starwrought.rules.used` changes (and
at no other time: a redraw resets what a card holds unsaved), so a button goes when the Maneuver
is used or the Opportunity ends. **Refused** (ruling 249): in a fight, no used Effect held, a
second use within the limit, and a rank the line asks for that the owner has not reached (with no
answer the use fell through to a plain one). **A use the rules refuse no longer asks the GM
first** (mended on the way): off-turn, `#useManeuver` and the Talent path leave the request card
to `#useWithRules`, after the refusals, so Move Together with nobody targeted is refused and
asks for nothing. **"Immediately after that check"**
is the rest of that Opportunity (ruling 248). **Not built**: named Effects, step two (a Maneuver
granting one to a target; bonus lines reading `IF:` or `IFT: EFFECT(<name>)`); a built-in, a
Strike, a Cast or a movement row as the subordinate; a Prepared parent; two `SUBORDINATE` lines on
a row; a subordinate chosen at use; one Aid for several allies. **The client's resolver wants the
Maneuver in the pack or the world**: an `ALTER` naming a Maneuver that exists only as a
character's own Item is "names no Maneuver" (seen live; the test world has a world fixture).
**The release carries the kind alone**: Pay It Forward has no row, Aid's row has no `GIVE` lines
and Reciprocal Effort's cell is a draft, all on Mike's sheets in progress, and
`data/ancestries.xlsx` and `data/maneuvers.xlsx` were not converted, built, staged or written.

**0.24.0 (Mike, 2026-11-14; rulings 239 to 244): Move Together, and the Talent that changes it.**
Planned first (`dazzling-floating-simon.md`; Mike's decisions by question: pay at the click, a Move
however short unless the Talent, warn and go on, the tag word PERMIT) and built as one rule kind
and one `ALTER` property; no data and no handbook moved, and the rulings are system decisions in
the 0.24.0 changelog entry. Mike asked whether Coordinated Footwork's Effect should change or the
grammar should grow; neither could be answered until Move Together itself was automated, where the
one thing that bit in play was the ally's off-turn drag waiting for the GM (0.19.0). **`PERMIT`**
(ruling 239; kind `permit`, the twentieth, `module/rules/kinds/permit.mjs`), on the MANEUVER'S OWN
ROW and nowhere else (`context.itemType === "action"`), on the existing `use` hook point:
`PERMIT: move; FOR: allies 0; LIMIT: round`, one descriptor (`move`, `PERMIT_WHAT`), `FOR`
required and never `self` (`PERMIT_WHO`), `LIMIT` the row's Frequency, `IF: RANK(...)` the owner's
rank (never `roll`), refused inside an `[AURA ...]` block; stored `{ kind: "permit", what, for:
{ who, range }, limit, when }`. **`ALTER` reads a seventh property, `movement`**, value `step`
(`MOVEMENT_PROPERTY`, `MOVEMENT_VALUES` in `module/rules/given.mjs`; its own parse branch in
`kinds/alter.mjs`, stored `movement: "step"`, left out of `buildTable` and of the `gives` hook).
**The `use` hook point grew** (`ruleUses` in `module/rules/engine.mjs`): the context carries
`scene`, the target's `token` and `tokenId`, `encounter.combatant` (`encounterContext()` in
`module/rules/scene.mjs`), a `nonce` and `alterations` (`alterationsOf(actor, item)`: the owner's
`alter` rules naming the used Maneuver, Off dropped, a line on Skip handed over `skipped` and a
one-roll custom effect to be used up, each with the `marks` the kind hands back when the use
counted; the used Item's own lines still read a Skip as On), and an answer may carry
`refuse`, `warn` and `marks`. **`SwItem#useWithRules`** (`documents/item.mjs`) refuses before it
gates (a refused use spends no GM permit), pays with `announce: false` and the spend line on the
Item's own card with the warnings (`warns` in `templates/chat/item-card.hbs`), honours
`trackActions`, applies the answer's `write` and files its `marks` (`writeRuleMarks`); this holds
for every Item with a use rule. **The record is pure and lives on the USER alone** (ruling 244;
`module/rules/maneuver-move.mjs`): `flags.starwrought.maneuverMove = { nonce, combat, round,
during, from, userTokenId, allyTokenId, allyName, range, step, moved }`, live only while its
Combat, round and `during` (the combatant whose Opportunity was running at the use) are current
(`recordLive`); the ally's client writes `flags.starwrought.maneuverMoved = { nonces: [...] }` on
its own actor (the uses it has moved for, the last six kept, `usedNonces` and `withUsed`: two
fighters may permit one ally in an Opportunity) and the user's drag sets `moved`; no relay. `moveRoleFor` reads the role of a token under
the live records and `asManeuverMove(move, held)` re-reads a classified drag (`kind`, `moves`,
`prepaid`, `charge`, `forced`). **The drag** (rulings 240 to 242; `documents/movement.mjs`):
`maneuverMoveOf(token)` is the one answer for the charge and the ruler; a live record skips the GM
request and `mayActNow`, counts for the GM's drag of the ally's token, forces a Move however short
(never a Rush; a Step within half Speed only with `step`; a Speed 0 crawl stays a crawl), takes
one Move off the user's charge, marks the use with a synchronous guard (`begun`) outside the
tracking block, and notes it on the move's card (`maneuverNotes`: paid for at the use, made
outside the fighter's own Opportunity, and the ally's end gap when it is above the row's range,
said and never enforced). `canvas/ruler.mjs` prices through the same helper (the label's "paid",
the colour, the cap); a token that is not a fighter in the encounter has no role. **A record ends
with the Opportunity it was used in**: `endManeuverMoves(combat, { current, round, ended })` in
`module/rules/effects-state.mjs` takes off every record that is not of the Opportunity now
running, on each Actor's responsible client, from `onTurnChange` (any change: a step, a new
round, a rewind; a record written for the Opportunity that has just begun is left), from a lone
fighter's step (`settleLoneStep` locally and `onStepSocket` on every other client, `current`
null), and from `endEncounterEffects`, which takes the marks too; the ally's mark is never
cleared before the Combat ends, since it is compared by nonce. **The owner must be in the fight**:
`inFight` in the hook is a started Combat AND `actor.inEncounter`, else the card only.
**Refused** (ruling 243): nobody
targeted, yourself, a creature the `FOR` does not name, a second use within the `LIMIT`.
**Warned, and it still happens**: a gap above the range, no action left, not conscious, not in the
encounter. **Mended on the way, no ruling**: in `onTokenMoves` the "already charged" test for a
path split by waypoints ran after the Opportunity gate, so the second piece of a GM-approved
off-turn drag asked the GM again and the token stopped at its first waypoint already charged for
the whole path (since 0.19.0); the test runs first; and the GM's approval of an off-turn drag was
spent before the drag was measured, so a drop the cap refused or a twitch used it up (the review's
find; `permit` in `onTokenMoves`, spent beside `charged.add`). **Not built**: the order and the declared
routes, "can perceive your cue", willingness, a use taken back, a permitted Strike or Step as the
descriptor. **The release carries the kind alone**: Move Together's row and Coordinated Footwork
are on Mike's sheets in progress, the two cells are in the changelog for him to paste, and
`data/ancestries.xlsx` and `data/maneuvers.xlsx` were not converted, built, staged or written.

**0.23.0 (Mike, 2026-11-14; rulings 231 to 238): a Maneuver pays its own cost, and the Combat
window forgets old attacks.** Planned first (`dazzling-floating-simon.md`; Mike's decisions by
question: an unfinished attack ends with its Combat or its card and the GM gets a Cancel in the
window, a range of costs asks each time, three or more is Prepared by the book, the name pays and
the speech bubble only shows); no data and no handbook moved, and the rulings are system decisions
in the 0.23.0 changelog entry. **A. A Maneuver used from the sheet in an encounter pays its printed
cost** (ruling 231; Mike: "Aid's ❶ is not spent by the system ... why not?"; through 0.22.0 only a
Reaction, a built-in and one with a use rule paid). `SwItem#use`, case "action", in this order: the
built-in table; `#chargePlan` (nothing outside an encounter, with `trackActions` off (ruling 236),
for a Reaction, a passive row or a row paid elsewhere; a range of costs opens `pickCost` in
`module/apps/cost-picker.mjs`, one button per number of `SW.actionCostOptions`, pure, in
`module/config/actions.mjs`, and a closed pick ends the use before the gate, so it never spends the
GM's permit; ruling 233); the Opportunity gate, its label carrying the number chosen; a use-rule
Maneuver (`#useWithRules`, unchanged); the Reaction branch (unchanged: paid at once); **three or
more is Prepared** (ruling 234: `actor.prepare({ kind: "maneuver", itemUuid })`, and
`finishPrepared` uses the Item again with `prepared: true` BEFORE it settles the preparation, so a
roll dialog closed at Finish loses nothing); one or two with a check are paid in the roll's
`beforeRoll`, after a caller's own, so a closed dialog charges nothing (ruling 232); one or two with
no check are paid at once with `announce: false` and the Item's card carries the spend line.
`prepared` is `use`'s own word and is stripped before the roll config, whose dialog reads a
`prepared` of its own. **Rows paid elsewhere** (ruling 235): `PAID_ELSEWHERE` in
`module/documents/maneuvers.mjs` (strike, cast, move, step, crawl, rush, leap, squeeze, each with
the i18n line its card says; the module still imports nothing) and `paidElsewhere(item)` in
`documents/item.mjs`, which also answers for an Item with `system.attack.enabled` and for one whose
rules carry a kind with a `card` hook (Quick Tongue's `reroll`) or a `prevent` hook on a carrier
with the Reaction trait, asked of the registry (the row would otherwise pay and the card's button
pay again). A new Maneuver the system pays for another way is a row in that table. A row that only
shows its card skips the Opportunity gate. **The gate is passed where the cost is paid**: a
Maneuver that rolls asks `canActNow()` up front (and `mayActNow` only to send the request card
when the answer is no) and passes `mayActNow` inside `beforeRoll`, so a closed dialog spends
neither the actions nor the GM's permit. **One use at a time**: `use` holds a Maneuver in `USING`
(actor uuid and Item uuid) around `#useManeuver`, so a double-click is one Maneuver and a second
Finish under an open dialog is refused; `finishPrepared` hands the Item a `beforeRoll` that stops
the roll when the preparation is no longer standing. **B. An unfinished attack ends
with its Combat or its card** (rulings 237 and 238; Mike: "it is always there. like if i load my
world now, they will still be there"). The attack record carries `combatId` (`#combatOf`: the started
Combat the attacker is a fighter in, by membership and not by `inEncounter`, which reads the viewed
Combat alone; `AttackWorkflow.create`, `projectFor`, and `PUBLIC_KEYS` in `attack-card.mjs`: a new
field on the record reaches the card only when it is in all three).
`AttackWorkflow.expired(record, { combatExists, heldElsewhere })`, pure, is the one reading: never
a finished attack; a Combat gone; no Combat unless another connected user is the stored
coordinator. `AttackCoordinator.rebuild()` never loads an expired card, and the client the
election names (`coordinatorFor(flags) === game.user.id`) writes it cancelled with `#expireCard`
(flags read again first; no refund); `register()` hears `deleteChatMessage` (`#onCardDeleted`: the
record marked cancelled in memory, the pending catch-up dropped, `#drop`) and `deleteCombat`
(`#onCombatDeleted`: the coordinator's `#cancel(..., { refund: false })`, else `#drop` when nobody
connected may write the card); `#persist` never re-creates a card a workflow has had; `live()` and
`outstanding()` go through `#inPlay`. A cancelled card's status is the plain "Cancelled"
(`Attack.cancelledStatus`), the reason in its log. The Combat Prompt's **Attacks in progress**
(`#watchList`, `mayControl`, the `cancelAttack` action asking the coordinator directly, since
`documents/cards/attack.mjs` imports the prompt) never opens the window and keeps an open one
open; `#dropSpentDrafts` forgets a draft once its target shows committed, so Reset defenses comes
back with nothing selected. **Three older defects mended beside it** (found by the review):
`migrateAuraVisible` was called and never imported in `data/items/talent.mjs` and `action.mjs`, so
every Talent's and Maneuver's `migrateData` threw (swallowed by Foundry, logged) from 0.17.0 to
0.22.0; the Combat Prompt's Commit waited for a Zone from every Posture, so it did nothing for
Drop Flat and Kneel Behind the Shield (it asks `postureNeedsZone` now); two i18n keys were written
twice. **0.23.1 (Mike, 2026-11-14: "plan it"; no ruling): the Pass row Passes.**
`BUILT_IN_MANEUVERS.pass` in `documents/maneuvers.mjs` is `actor.pass()`, so the row is a third
door to the one Pass beside the sheet's button and the tracker's; when a Pass is not possible
(not the actor's Opportunity, no encounter, Preparing) the method says why and does nothing, and
so does the row, by Mike's choice, the speech bubble being the door that shows the card. **Not
built**: Gain Control and Interact paid in two places, a Leap's
own cost, a row printed with a cost and a Reaction half of its own (it pays the half), and
`trackActions` over Strikes, Casts and Reactions (it has only ever gated movement in code; the
hint and FEATURES now say so).

**0.22.0 (Mike, 2026-11-14; rulings 223 to 230): what a Maneuver gives, and the Talents that
change it.** Planned first (`dazzling-floating-simon.md`; Mike's decisions by question: the ally's
Constellation named separately, a button on the card, Patient Assistance on a Success and a
Critical Success, the penalty's window a bonus's) and built as two rule kinds; no data and no
handbook moved, and the rulings are system decisions in the 0.22.0 changelog entry. Mike showed
Patient Assistance ("the Situation bonus provided by your Aid lasts until the end of the
recipient's second upcoming Opportunity") and Sure Assistance ("A critical failure on your Aid
check grants no penalty to your ally") and asked whether the grammar could say them. It could not,
because **Aid's own result was prose on the card**; so Aid's result is written first, and the
Talents change it. **`GIVE`** (ruling 223; kind `give`, `module/rules/kinds/give.mjs`), on the
MANEUVER'S OWN ROW and nowhere else (`context.itemType === "action"`): `GIVE: <value> <type>,
chosen | <Constellation>; IF: RESULT(<degree>)`, a modifier tag, one descriptor (`chosen`: the
Constellation is named when the result is given), exactly one `IF: RESULT(...)`, `IF: RANK(roll
...)` the rank ROLLED (ruling 217), the first line that holds for a degree its result; stored `{
kind: "give", value, type, to: { name, slug, type }, when, until }`. **`UNTIL:`** (ruling 224), a
component read after `GIVE` alone: `giver opportunity [N]` (the default; until the giver's Nth next
Opportunity BEGINS), `recipient opportunity <N>` (through the END of the recipient's Nth upcoming
Opportunity), `encounter`; `readUntil` and `untilWords` in `module/rules/operators.mjs`.
**`ALTER`** (ruling 225; kind `alter`, `kinds/alter.mjs`), on a Talent (or a custom effect row), in
the shape Mike drafted: `ALTER: <Maneuver>.<property>; VALUE: <value>`, **`VALUE:`** read after
`ALTER` alone and stored as `ops.set`; properties read: `duration`, `beneficial-duration` (a
window) and `critical-success`, `success`, `failure`, `critical-failure` (`VALUE: nothing`); any
other is refused as not read yet BEFORE the Maneuver is looked up; his `PRESERVE:` is no component
(an ALTER changes one property and never the roll, so a Critical Failure that gives nothing still
Flares). Both components are refused by name after every other tag in `readComponent`
(`effects.mjs`), since `bonus` reads its ops with no refusal list. **The pure half is
`module/rules/given.mjs`**: `buildTable(lines, alterations)` (the first line for a degree; then
the alterations by property, results set to nothing, `duration`, `beneficial-duration`, so the
more particular stands whatever the order, and of two changes to one property the later),
`sameGiven`, `pendingEntry`, `pendingRule`, `givenCarrier`, `settle`, `appliesNow`, the words.
**The `gives` hook point** (ruling 229; the sixth, calculated): `ruleGives(actor, context) -> {
table, notes, marks, traces }` in `module/rules/engine.mjs` hands each kind its rules on the Item
behind the roll (`from: "item"`, owned or not, since a basic Maneuver is used straight from the
compendium) and the roller's own (`from: "own"`); `give` reads the first, `alter` the second;
asked once per entry, and the table built with and without each traced entry, so a Skip or a
one-roll custom effect is spent only by a degree it CHANGES (never a shadowed line, never an
alteration of a result already gone); what the die did not spend is `traces`, kept on the card as
`given.unspent`, and `rerollCheck` files the marks of the ones the new die lands on. **The roll**:
`SwCheck.roll` asks for a character's check from an action Item after the die and `cardFlags`
writes `flags.starwrought.given { table, notes, maneuver, ally, combat, unspent }` (every degree at
the rank rolled, so a reroll copies it); `SwItem#use` passes the one targeted character as `ally`
(`#allyFor`), never `targetUuid`. **The give is triggered** (ruling 226;
`module/documents/cards/give.mjs`): `drawGiveWidget` in the chat render pass (Give Wren +1 to
Crafting / Other... / Give the result..., the notes, "Given to Wren: ..."; nothing on a card its
viewer may not read, nor on one that was thrown again, `wasRerolled`), `giveFromCard` with its
dialog, `applyGive` on the recipient's ONE writer (`writerFor`: the active GM's client, else the
recipient's first active owner's; one card at a time there, `giving`; it re-reads the card, the
asker must own its roller, who and which Constellation the only things taken from the request),
`give:apply` / `give:done` / `give:refused` over the system socket through `onChatSocket`, and the
give card (`flags.starwrought.kind: "given"`, `from` the check card's id), which IS the record that
the result was given (`givenRecord`; `registerGiveCards` re-renders the check card when one is
created or deleted). A token's Actor and the world Actor it is drawn from are one body (`sameBody`).
**The pending result** (ruling 227) is `flags.starwrought.rules.given.<maneuver slug>` on the
recipient, one per Maneuver, never a `system.effects` row (the sheet's form rewrites those);
`collectRules` indexes it as a one-roll carrier with one resolved `give` rule (`pending: true`),
the `give` kind's `modifiers` hook answers for it on the roll's slug and never under `staticOnly`,
`read`, `pairingOnly` or `leavePending` (so it is never in the sheet's Threshold, a Threshold read
never spends it, and a total that is itself the roll and writes nothing after, the tracker's own
Initiative die in `SwCombatant#_getInitiativeFormula` and a kept road roll, never carries it), and
`markUpdates` deletes the flag with the roll that used it. **The window** (ruling 228) is
counted on the entry (`until { who, combatant, n, begun }`) from the press, in the encounter
viewed: `onTurnChange` in `documents/combat.mjs` calls `settleGivenResults` (`rules/effects-state.mjs`)
as an Opportunity ends and as one begins, each Actor's responsible client writing; the elected
client remembers the turn step a completed circuit of Passes takes (`roundEndSteps`) and does not
count it; a lone fighter's step to itself writes no Combat update, so `settleLoneStep` settles
this client's Actors and tells the others (`rules:step`, `onStepSocket`, routed by
`onRulesSocket`); `deleteCombat` clears the Combat's results (`holdersOf`: the fighters, the
scene's tokens, the world's Actors); outside an encounter a result lasts until used, replaced or
removed. **The Effects tab** (ruling 230): `givenContext` in `helpers/effects.mjs` lists the
pending results read-only with a GM-only bin (`removeGiven`), one held over from another
encounter dimmed and uncounted; `EFFECT_KINDS` gains `give` and `alter`. **Three defects fixed on
the way, no ruling**: `rerollCheck` read the check's Item with `fromUuidSync`, which answers a
pack's index entry for a compendium Maneuver, so a reroll's card had no Item text (now awaited);
`onTurnChange` read `previous` and `current` after its awaits, which core rewrites on the next
turn change; and a `reroll` rule's button was drawn for a roller on their own blind roll, saying
the degree the card hid (the kinds' offers and the Give button are left off a card whose content
the viewer may not see). **Not built**: Carry the Plan's two
uses, Pay It Forward, a Condition given by a result, a give from a Maneuver with no check, an
adversary as the recipient, the other ALTER properties, and a Threshold Aid opens on. **The
release carries the kinds alone**: Aid's row and the two Talents are on Mike's sheets in progress,
the three cells are in the changelog for him to paste, and `data/ancestries.xlsx` and
`data/maneuvers.xlsx` were not converted, built, staged or written; the pack content did not move.

**0.21.0 (Mike, 2026-11-10; rulings 215 to 222): the USE tag and the substitute kind.** Planned
first (`dazzling-floating-simon.md`; Mike's decisions by question: offered and ticked when better,
only from Aid, the kind alone) and built as one rule kind; no data and no handbook moved, and the
rulings are system decisions in the 0.21.0 changelog entry. Mike asked whether the grammar could
say the Human's Cooperative Instinct ("When you Aid, you may use Presence + Origin proficiency in
place of the Attribute and proficiency normally used for that Aid check"; his generalisation:
"Replacing the Constellation AND the Attribute bonus for a check with something else"); his cell,
`[EFFECT USE: Presence, Origin, aid]`, was written before the kind, so the tag is his word. **The
shape** (ruling 215): `USE: <Attribute>, <Constellation>, <Maneuver>`, exactly three descriptors,
`use` the last entry of `EFFECT_TAGS` in `module/rules/effects.mjs`, naming the kind `substitute`
(`module/rules/kinds/substitute.mjs`; descriptors only, no value). The first is an Attribute or
`same`; the second the Constellation whose Proficiency Bonus is borrowed (Origin, a Skill, a
Defense) or `same` (a Maneuver, a Lore and a group refused, a rank word or a number as "a flat
Proficiency Bonus is not read yet"); `same` is "the term this check would use without this line"
and `same, same` is refused; the third is a Maneuver by name (a Constellation, a Defense, a scope
word, a Lore and `same` refused). Components: `IF: RANK(...)` and `LIMIT:` alone; `[AURA ...; USE:
...]` is refused in its own sentence. Stored: `{ kind: "substitute", line, text, attribute: <key>
| null, proficiency: { constellation, name } | null, to: { name, slug, type }, when, limit }`
(`to`, `when`, `limit` under `bonus`'s names, so `summarizeOperators` reads them; a flat-bonus
form would grow under `proficiency`); As read "may use Presence + Origin proficiency on checks to
Aid". **What a swap is** (rulings 216, 217, 219, 220): it replaces the roll's two base terms, the
Attribute Bonus and the Proficiency Bonus, and nothing else; the roll stays a check in its own
Constellation (the Flare preselection, Load Strain on Stealth, Constellation-targeted bonuses,
rerolls and the road-roll memory untouched). The rank a roll records, and every other rule's `IF:
RANK(roll ...)` reads, is the rank rolled, so the borrowed Constellation's when a swap stands
(Mike's Jack of All Trades prose: its +1 "does not apply to ... a check receiving a substituted
proficiency bonus"); on the USE line itself `RANK(roll ...)` is the check's own rank, before any
swap; Aid's "master with the check you attempted" is read at the rank rolled, which the card
prints. Kind `check` only, characters only, and only when the roll carries the named Maneuver's
Item (`item.type === "action"`, `slugify(plainName(item.name)) === to.slug`; Mike: "Only from
Aid"): never a Strike, a Cast, a Defense roll, a Threshold read or an Initiative, an adversary
rolls flat, and a check made without the Item is offered nothing. **The `substitutions` hook
point** (ruling 221; the fifth, calculated in category, defined with the kind):
`hooks.substitutions(entries, context, actor)` answers candidates that mirror the rule (`{ key,
item, label, attribute, proficiency, certain: true, mark? }`), pricing, choosing and writing
nothing, and is NOT named `use` (that hook point draws a Use control, `usableByRule`);
`ruleSubstitutions(actor, context) -> { candidates, marks }` in `module/rules/engine.mjs` is
`ruleModifiers`' twin over the roller's own rules (`context.rank` the check's own rank), a
candidate keeping its `marks` (its LIMIT, a one-roll custom effect's removal), which are filed
only when that swap is the one rolled, the top-level `marks` clearing a Skip line that would have
matched. **The check engine** (ruling 218; Mike: "I like you recommendation of offering it,
ticking it by default when it is a better pair"): `module/dice/check/substitute.mjs` is the pure
half (`swapTerms`, `substitutionRecord`, `chooseVariant`, `mergeMarks`; it imports nothing and the
self-test drives it from Node); `assemble` in `module/dice/check/modifiers.mjs` builds the
variants once (the check with its own terms, then one per candidate) onto
`cfg.substituteVariants`, and `chooseVariant` says which stands: `cfg.substitute` undefined is the
default rule (the swap whose whole assembled total is STRICTLY the highest, else none; "better" is
never the two base numbers, since another rule may read the rank), null none, a key that
candidate; `cfg.substituted` is the record, `cfg.attribute` stays the roll's own and `cfg.rank` is
the rank rolled; the dialog, `previewTotal` and a Shift-click read the one list, only the rolled
variant's marks are written, and one swap stands per roll. A Defense's two base entries carry
`base: "attribute"` and `base: "proficiency"` from `prepareDefenses`, so a check rolled with a
Defense Constellation from a Maneuver's Item finds and replaces them; a Defense roll and a
Threshold read never swap. **The screens**: the roll dialog's row above the other offers
("Cooperative Instinct: Presence and Origin (Trained) in place of Wits and Crafting (Untrained)",
the signed difference in the total beside it, a checkbox ticked by default when the swapped total
is strictly higher; the other offers follow the box too, the dialog drawing the union of the
variants' `ruleOffers`, each row remembering the variants that offer it, so a claim that reads the
roll's rank is shown under the terms it is offered on and a ticked row counts only when the
variant rolled offers it); the card's note in the same words and its flags
`flags.starwrought.substituted` (`key`, `itemName`, `attribute`, `proficiency { constellation,
name, rank }`, `from { attribute, slug, name, rank }`), `attribute` (the Attribute rolled) and
`rank` (the rank rolled); the Relevant Check picker's asterisk on a row whose number includes a
swap, with one hint line under the list naming the Talent (`SwCheck.preview(actor, config)`
returns `{ total, substituted }`; `previewTotal` stays its number); the Effects tab's On / Skip /
Off on a USE line (`substitute` in `EFFECT_KINDS`, which the self-test holds equal to the kinds
`EFFECT_TAGS` names), Skip or Off being how to decline a roll made with no dialog. **A bonus to a
Maneuver reaches a check rolled with a Defense Constellation from that Maneuver's Item** (ruling
222; the one exception to the `momentOnly` skip in `module/rules/kinds/bonus.mjs`; Humanity's +1
on an Aid made with Awareness, lost through 0.20.1); whether a bonus to every check reaches a
Defense rolled as a check is an open decision. **Three defects fixed on the way, no ruling**: a roll
dialog rebuild dropped the marks of the boxes the player left ticked (an armed claim not spent, a
one-roll custom effect not removed; `prompt()` now returns them and `SwCheck.roll` appends them
after the rebuild, each once); a kind's own name typed as a line (`substitute: ...`) is told
its tag rather than "is a feature" (a tag with no colon is told the colon); and, older than the
release and found by the adversarial review beside ruling 222, `callHook`'s second look under
`momentOnly` (`module/rules/engine.mjs`) counts APPLIED answers only, so a one-roll custom effect
or a Skip on a bonus to a Maneuver is no longer spent by a Defense rolled as a check with no Item
(a Wind roll), where the bonus was neither applied nor offered. `readTargetName` in
`module/rules/operators.mjs` is the one reading of a target's name for `bonus`, `reroll` and
`substitute`. **Not built**: a Constellation as the check a USE names (the Initiative question of
ruling 111, with the first Talent that wants it), offers on plain checks, `IF: UNSUBSTITUTED`, a
flat Proficiency Bonus (Working Knowledge's "+3 instead of +0"), `FOR` and auras, `CLAIM`, and
Aid's own outcome bonus, which stayed the card's text until 0.22.0. **The release carries the kind alone**:
Cooperative Instinct is a Talent on Mike's in-progress Human sheet, not a shipped one, and
`data/ancestries.xlsx` and `data/maneuvers.xlsx`, which he is editing by hand, were not converted,
built or staged; the pack content did not move.

**0.20.0 (Mike, 2026-11-08; rulings 205 to 214): the PHB v4.24 sync.** The first handbook sync
since v4.21 (`v4.24-sync-report.md`; planned in `lucky-kindling-walrus.md`, Mike's four decisions
by question). **Preparing spends two actions now** (ruling 205; `SW.PREPARE_SPEND`; Chapter 2 and
the Prepared trait say two, Chapter 4 and the Preparing condition still say one and are redlined
in `Starwrought_Players_Handbook_v4.24_preparing_proposal.docx`). **Three kinds of action**
(ruling 209): a row typed Activity is an Exploration Mode Item and one typed Endeavor a Downtime
Mode Item wherever it sits, from `data/activities.xlsx`, `data/endeavors.xlsx` and the Skill
sheets, under the ids the roster rows had; the roster blocks are gone; Hustle rolls Endure;
Provision is gone (ruling 211). **The row's Type wins and `assets/index_sheets.py` keeps every
`_Tree Index` current** (ruling 206). **Every ungranted Maneuver is basic** (ruling 207). **The
Lore template is skills.xlsx's sheet** (ruling 208). **The Constellation column is the check a
row rolls** (ruling 210). The Necromancer's Opening Vigor is 8 (ruling 212), Supine waits for a
definition (213), Look Harmless's Reach limit is 1 (214). The book's new Ancestries, Cultures and
Skills, which Mike authored in the sheets between the 5th and the 8th, reach the pack sources for
the first time with this release.

**0.19.0 (Mike, 2026-11-08; rulings 199 to 204): the playtest's eight.** Planned first
(`playtest-plan-0.19.0.md`; Mike's four decisions by question) and built in one release; no data
moved and the rulings are system decisions in the 0.19.0 changelog entry. **A fighter with no action
left and nothing reserved is passed over** (ruling 199; `SwCombat#canTakeOpportunity`, the one
reading behind `nextTurn`, `opportunityHolders` and the tracker's dimmed row; a Preparing fighter
keeps its Opportunity; when nobody can act the round ends; the Pass and spend stamps on a Combatant
are forgotten as its Opportunity begins, a 0.4.0 bug). **Finish waits for the next Opportunity**
(ruling 200; `preparing.ready`, written by `beginOpportunity`; Abandon any time; the GM's sheet
click forces). **The Wind card and roll are public** for a player's fighter (ruling 201;
`lockRollMode` on `SwCheck.roll`). **A Maneuver outside your Opportunity waits for the GM**
(ruling 202; `SwActor#canActNow` / `mayActNow` in `documents/actor/actions.mjs` is the one gate,
called before the effect by every spend site and `preMoveToken`; the request card in
`documents/cards/opportunity.mjs` with GM-only Approve and Refuse; a one-shot permit flag; never a
Reaction, a Posture, a Defense roll, a reroll, Finish, Abandon, Pass, the pips or the GM's own
creatures; "nothing is ever prevented" now reads "an overspend is never prevented"). **Take Control
by hand and the Control's Zone on the Bind** (ruling 203; `SwActor#takeControl`, `system.bind.zone`
on both sides, opened and closed by the Controlled side's own `#writeBind`, so the Expose relay is
not needed for a Control; `SwActor#sayExposed` is the one Exposed card; `attackThreshold` reads the
−2 for an adversary; `apps/zone-picker.mjs` is the shared dialog). **The glance** (ruling 204;
`module/canvas/glance.mjs`, `glanceData` read by the hover card and by both sheets'
`_configureRenderParts` for a LIMITED user; client setting `showGlance`). The Constellations tab's
filter box (`#filter`, `_onRender`, the sheet's one listener outside `actions`) and the Token HUD's
zoom counter-scale (`--sw-hud-scale`) are UI with no ruling.

## Where the source of truth lives

**THE WORKBOOKS WERE RENAMED ON 2026-11-15 (Mike; system 0.30.0, ruling 303).** A talent workbook
is `data/talents_<what>.xlsx` and an actions workbook `data/actions_<what>.xlsx`:

| Was | Is |
|---|---|
| `maneuvers.xlsx`, `activities.xlsx`, `endeavors.xlsx` | `actions_maneuvers.xlsx`, `actions_activities.xlsx`, `actions_endeavors.xlsx` |
| `ancestries.xlsx`, `cultures.xlsx`, `callings.xlsx`, `skills.xlsx` | `talents_ancestries.xlsx`, `talents_cultures.xlsx`, `talents_callings.xlsx`, `talents_skills.xlsx` |
| `defenses.xlsx`, `combat_styles.xlsx`, `magic.xlsx` | `talents_defenses.xlsx`, `talents_combat_styles.xlsx`, `talents_magic.xlsx` |
| `weapons.xlsx` | `talents_martial.xlsx` |
| `backgrounds.xlsx`, `languages.xlsx`, `equipment.xlsx` | unchanged |

The converter tells a workbook by what is in it, never by its name, so the names decide
nothing; `assets/index_sheets.py` reads the Category from the name with its prefix removed
(`workbook_key`), and `carry_over_absent` knows the three actions workbooks by either name
(`RENAMED_WORKBOOKS`). This section and Known outstanding work name the files as they are NOW.
**The dated release paragraphs under Standing design rules and the Cleared paragraphs name them
as they were then**: read `data/maneuvers.xlsx` there as `data/actions_maneuvers.xlsx`, and so on.
`actions.json` and the action documents keep the old names inside them until the next full
content build writes them again.

- **The highest-numbered `Starwrought_Players_Handbook_v*.docx` is authoritative for the general
  rules and for the tables it still prints; since v4.25 it no longer says what a Talent or a
  Maneuver does, and `data/*.xlsx` is their only source** (the HANDBOOK RULE, above; ruling 264).
  It is hand-authored in Word. `assets/phb_edit.py` exists for the cases where Claude is asked to
  change it: it appends a sentence to a named paragraph in that paragraph's own run formatting,
  substitutes a literal inside one paragraph, or renames a word wherever it qualifies a bonus or
  penalty (the v3.4 type rename), and copies every other byte of the package through untouched.
  Its edits are the `EDITIONS` table, one entry per version it has produced, run as
  `python assets/phb_edit.py <in> <out> --to <version>`. It writes a NEW numbered file rather than
  editing one in place, so the version Mike authored stays the version Mike authored. Verify with a
  diff of the two documents: entry count, paragraph count, and the exact list of changed lines,
  each explained by the intended edit. The edition line is the first cell of the cover table, so
  `doc.paragraphs` never shows it; read it as `doc.tables[0].rows[0].cells[0]`. **`assets/phb_propose.py`
  is the other tool** (2026-10-02): the same surgical edits, but left as Word tracked changes (author
  "Claude") in a `<name>_proposal.docx` for Mike to accept or reject, its `PROPOSALS` table one entry
  per proposal made; a proposal is not an edition, the drift check ignores the name, and the sync
  follows only once Mike accepts into a numbered handbook. **Since the v4.25 sync a redline goes
  into the edition itself** (Mike, 2026-11-15: "please redline the actual Word doc with
  recommended changes"; the separate v4.24 Preparing proposal was never merged; ruling 265):
  `python assets/phb_propose.py <edition.docx> --in-place --backup backup/pre-<version> --proposal
  <name>` copies the untouched edition to the backup folder first (never overwriting a backup that
  differs), refuses while Word holds the file open, parses the result as XML before it replaces
  the edition, and leaves every change a tracked change by the author Claude for Mike to accept
  or reject where he works. The sync then reads the file with those changes as accepted (each
  must be wording or something the system already does) and stamps the redlined file; when Mike
  accepts or rejects and saves, the drift check reports the same-numbered file changed and
  `build_all.mjs --check --accept-phb` records it again. Its edits also include `insert` (a few
  lost words or one letter, nothing struck) and an empty table cell filled in the run formatting
  of the cell above. Mike also edits the current edition in
  place as well as accepting redlines (v4.13's Wind bullet was rewritten in the v4.12 file on the
  shelf), so `build_all.mjs` records the edition's SHA-256 in `data/SYNC.json` at `--accept-phb`
  and reports drift when the same-numbered file changes, not only when a higher number appears.
  He also hands over tracked changes of his own in a numbered file (v4.14: the Attended redline
  accepted and the Roll Playing Conventions paragraph streamlined); the integrator accepts those
  through Word and writes the edition under the same file name, mending any slip and flagging it
  in the sync report (ruling 90). **`assets/phb_format.py` is the formatting tool** (v4.15,
  2026-10-02): it applies the conventions in `handbook-style.md` (the SW character and table
  styles: Traits tinted, Constellations and Talents italic, one table style with automatic banding,
  the heading look in the heading styles) to the newest edition and writes a new file whose visible
  text it refuses to let differ by one character; rerun it on each new edition, then stamp the
  result with `phb_edit.py`, which also carries the version into the page footers. A formatting
  change is a change to `handbook-style.md` and the conventions table at the top of the script,
  never a hand edit of runs.
  Check for a newer one before starting a sync; v3.1 landed while the
  v3.0 sync was still being written. `data/*.xlsx` is authoritative for the app; where the book
  still prints the same thing (a general rule, a Chapter 3 or Chapter 5 table) and the two
  disagree, the handbook wins and the sheets need a pass; for a Talent's or a Maneuver's own text
  there is nothing in the book to disagree with since v4.25, and the sheet is the word.
- **`assets/build_phb.js` deliberately does not regenerate the handbook.** That would put rules prose
  in two places and guarantee drift. It builds `Starwrought_Constellation_Compendium.docx`: the
  creation menus, all 30 constellations, and the reference appendices, every table read from
  `trees.json` and `roster.json`. That is content that must track the data exactly.
- `data/*.xlsx` holds all game content. One `_Tree Index` sheet per workbook.
- Ancestry rows in `data/talents_ancestries.xlsx` `_Tree Index` also carry Vigor (the header may still read
  HP), Size, Speed (feet per Move; a Human's is 6), Senses and, since 0.14.0, Traits (the creature
  traits the chassis confers). The pipeline reads those and
  generates the `ancestries` block of `roster.json` (keys `vigor`, and `hp` for one release), so
  ancestry chassis is authored once, in the sheet. The blurb is the `<Tree> Lore` sheet's Summary
  row (the index's Summary, Flare Triggers and Meta note columns are optional; Mike deleted all
  three on 2026-11-05). A Calling's Vigor is not in a sheet: it is the
  third column of the hand-kept `callings` block of `roster.json`, and since PHB v4.11 that column
  is the Calling's **Opening Vigor** (paid once, at 1st level, by the first Calling), not Vigor per
  level; every consumer indexes `[2]`. The Ancestry's Vigor stays per level.
- Culture rows in `data/talents_cultures.xlsx` `_Tree Index` generate the `cultures` block of `roster.json`
  since 0.15.0 (objects: name, enabled, attribute, languages, blurb, lore, traits, tree; ruling
  180): the optional **`Languages`** column (comma separated; written 2026-11-05) and `Traits`, the
  Lore sheet's Summary row as the blurb; while a workbook has no `Languages` column the converter
  carries the languages from the previous roster row with a warning. The root Talent's Effect is
  the Culture chassis's Special Ability.
- `<Tree> Lore` sheets are the tree's player-facing text, read by the converter for every tree
  (`lore` on the tree) and carried to the Ancestry and Culture chassis, the wizard's Lore panel and
  the chassis Item's Description tab; the web app and the docx do not print them (Mike's call).
- Tree sheet columns: Talent, Tier, Root, Requires, Prerequisites, Description, Effect,
  **Attribute** (0.13.0; `Feeds` through 0.12.0: on a sheet headed `Attribute` a blank cell is an
  error, Mike's "no Attribute cell should ever be blank"; a sheet still headed `Feeds` inherits the
  tree's), **Enabled?**, **Automation** (0.9.0; since 0.16.0 the two layers of
  `AUTOMATION_GRAMMAR.md`: feature lines in brackets and effect lines of a tag and components, one
  line per rule, copied through as text by the converter and parsed by `assets/parse_rules.mjs` and
  `build_foundry.mjs`, which fail on a line they do not know; **`N/A` alone in the cell is Mike's
  mark that the row needs no automation** (0.26.1: skipped by the grammar, an empty cell to the
  build, never red, counted apart by the red-cell tool; a blank cell is a row not reached yet); **on a Maneuver's row the
  cell also declares the check it rolls, `[CHECK Athletics vs Evade or Guard]`** (0.34.0;
  a row with no block rolls what the build guesses from its Constellation column and Effect);
  an Effect cell may carry
  `@Maneuver[Name]`, expanded by the step), **Traits** (0.14.0, optional, comma separated:
  `system.traits` on the Talent, so a spell can carry the trait a defender's `IFT: TRAIT(...)`
  names). **Retired, still read where a sheet has them:** `Aura` (0.13.0; an `[AURA ...]` block is
  the authoring; both on a row is an error), `Grants` (0.13.0; a `[POINT ...]` block), `Choice` and
  `Free Talent` (0.16.0; `[CHOICE ...]` and `[TALENT ...]` blocks; a filled cell warns and must
  agree with the block). A
  sheet with no `Requires` column, or an empty one, reads `Prerequisites` as the requirement (the
  pieces naming a Talent of the same sheet; ruling 166). An unknown header is warned about by name.
  A `<Tree> Lore` sheet (label | text rows) is the tree's player-facing text, `lore` on the tree
  and the ancestry record (ruling 169). Column order does
  not matter; the first word of the header does. `Root` = `x` for a constellation root, `h` for a bloodline root. The `_Tree Index` may carry
  a **Parent** column (v4.10; any tree since v4.21): a tree that names one is a **group** within it
  (a Combat Style within Melee or Ranged, a magical specialty within its discipline), written as
  `group: true`, and the converter errors on a Parent that names no tree or has a parent of its
  own. The index's `Feeds` column is **`Primary Attribute`** since 0.13.0 (both read). **The spell
  columns** (v4.21; `data/talents_magic.xlsx`): `Threat`, `Delivery`, `Range`, `Die`,
  `Damage`, `Targets`, `Quick`, `Focused`, `Committed`, `Defenses`; a row with a Threat is a spell,
  validated against the vocabulary in `data/README.txt` and written as `node.spell`, which
  `build_foundry.mjs` puts on the Talent as `system.spell`. Action glyphs ride in the Talent name in the
  v4.10 symbols (❶ ❷ ❸, ⓿, ↺ beside a cost); the v3 ◆ and ◇ still convert.
- **`Choice`** is a build-time pick the talent's effect demands, written as what is being chosen
  ("Weapon Group", "Weapon Group or Technical Weapon"). **`Free Talent`** names a talent handed
  over outright with no point spent, and may live in another constellation; the converter checks it
  exists. Both were added 2026-08-27 because Drilled's "you gain Weapon Familiarity for free,
  choose one Weapon Group" was prose only, so no implementation could act on it and Weapon
  Familiarity had no mechanical effect anywhere. If an effect asks the player to pick something
  **once, at build time**, it needs a Choice cell. Per-use picks (a Zone, a target, a Defense) do
  not; only two talents in the book qualify.
- **`Enabled?` decides what ships to Foundry** (Mike, 2026-10-01; sync report rulings 60 to 62).
  On every talent sheet but Lore's, the Backgrounds sheet and the action sheets: Yes ships,
  anything else is authored but not visible in Foundry, and a sheet without the column is wholly
  enabled (it has not been curated yet; Lore and Languages today). A Constellation ships when its Root does. The
  converter keeps every row, with `enabled` on each talent, tree, background and action, and warns
  on an enabled row that leans on a disabled one; `build_foundry.mjs` writes only the enabled
  documents, keeps every Constellation in the content index with its flag, and stamps the enabled
  counts into `content/sync.json`. The web app and the compendium docx show the whole book. A
  disabled sheet action still retires the roster row of its name (the 39 blank Maneuver rows today;
  Aid was one until Mike set its row to Yes on 2026-10-03, and it ships since).
- **`data/equipment.xlsx` is the equipment workbook** (Mike, 2026-10-01; ruling 64). Index-less,
  recognised by its Weapons, Armor and Shields sheets (an About sheet is ignored). Weapons: Weapon,
  Kind (Melee or Ranged), Handling, Group, Damage, Reach (melee) or Range (ranged), Traits, Price,
  Notes, Enabled?. Armor: Piece, Zone, Protection, Load, Price, Traits, Type (the v4.21 armor
  type; a `Material` header still reads), Description, Enabled?; `---` is a blank.
  Shields: Shield, Bonus, Hardness, Load, Price, Note, Enabled?. The converter writes
  `assets/equipment.json` and regenerates the roster's four equipment blocks from it (every row),
  so the app and the compendium docx keep reading the roster unchanged; `build_foundry.mjs` reads
  `equipment.json` and ships only the enabled rows under the same document ids. It was built from the
  handbook's Chapter 5 tables, which left the book on 2026-11-15: **the sheet is the only source
  now** (ruling 297), and there is nothing in the handbook for it to disagree with. Since 0.30.0
  it has a fourth sheet, **Ammunition**: Ammunition (or Item, or Weapon) | Group | Price |
  Description | Enabled?, one kind per row, a trailing "(10)" in the name the stack, Group the
  Weapon Group it feeds; written as `equipment.json`'s `ammunition` list (never a roster block:
  the web app and the docx do not list it) and shipped as `gear` Items (`gear:<slug>`) in an
  Ammunition folder of the Equipment pack. The Armor sheet's Description reaches the armor Item
  since 0.30.0. **`node assets/build_all.mjs --equipment` (`sync_equipment.cmd`) builds this
  workbook alone**, for a build made while the talent and action workbooks cannot pass the
  content loop.
- **`data/conditions.xlsx` is the Conditions workbook** (Mike, 2026-11-18; system 0.33.0; rulings
  322 and 323), the ONLY source for what a Condition says and does. Index-less, recognised by its
  `Conditions` sheet (an About sheet is ignored): Condition | Takes (blank, N, Zone, X) |
  Description | Includes | Automation | System | Listed? | Icon | Notes, one row for each
  Condition; the suffix the handbook's table prints ("Frightened N", "Bound [X]") reads off the
  name and is put back from Takes wherever a table is printed. The converter STAGES the rows
  (`build/conditions.staged.json`) and `assets/parse_rules.mjs` writes `assets/conditions.json`
  (every row, with its parsed `rules`, and a new Condition's static status id) and the roster's
  `conditions` block (the Listed rows, `[name, description]`) together, only when the whole sheet
  reads; `build_foundry.mjs` writes `content/conditions.json` for the client. A row that names no
  Condition the system has MAKES one (the build prints `NEW CONDITION`); a row the system needs
  may not be deleted (the build refuses). A Condition's row reads `CHECK`, `ATK`, `DEF` and
  `INIT`, with `-N` for its own value; Includes is how one Condition counts as another, with
  `against X` (`AUTOMATION_GRAMMAR.md`, section 11). **`node assets/build_all.mjs --conditions`
  (`sync_conditions.cmd`) builds this workbook alone.** The handbook still prints its Conditions
  table; the sheet wins, and nothing checks the book against it.
- The pipeline warns on any root that breaks the Root Rule, so violations surface on the next sync.
- **The three actions workbooks since 0.20.0 (PHB v4.24, Chapter 8; Mike's restructure of
  2026-11-07, read as written, rulings 206 to 210):** `data/actions_maneuvers.xlsx` (a Basic Actions sheet
  whose Category column carries the book groups, Ancestry and Culture Actions sheets, one
  `<Skill> Actions` sheet per Skill, every row naming its Constellation), `data/actions_activities.xlsx`
  (the eight Exploration Activities: Activity, Movement Speed, Check, Initiative) and
  `data/actions_endeavors.xlsx` (Retrain and Train, with a Duration). An actions workbook is a `_Tree
  Index` with a Name column and no Tree column; its Type column is any header containing "type"
  (`Type`, `Action Type`; `Category/Type` is the Category) and optional: the row's own Type cell
  types it (Maneuver, Talent Maneuver, Activity, Endeavor), the index is the fallback, the sheet
  the last; a row's group is its own Category cell else its sheet, never the index's Category
  column; an index name with no row on any sheet retires a roster row of the name as a blank sheet
  row did (`actions.json` `retired`). `python assets/index_sheets.py` regenerates every workbook's
  index from its sheets (tree workbooks too), never dropping a row and never touching a filled
  cell. The name column is
  Action, Activity or Endeavor; Constellation, Frequency, Range, Target, Duration, Movement Speed,
  Category, Check and Initiative are carried to `actions.json` and the Item (`frequency`, `range`,
  `target`, `duration`). An Activity is an Exploration Mode Item under its old `exploration:` id
  and an Endeavor a Downtime Mode one under `downtime:`, whichever sheet it sits on; the roster's
  `explorationActions` and `downtimeActions` blocks are gone. Basic (ruling 207): every Maneuver,
  Activity or Endeavor a Talent does not grant (`[MANEUVER X]`, `@Maneuver[X]`, or Type `Talent
  Maneuver`). The Constellation column is the check the row rolls when the Effect attempts or
  rolls one, the Defense read from "vs." or "against" in the Effect (ruling 210); **since
  0.34.0 that is only the guess for a row with no `[CHECK ...]` block in its Automation
  cell, and the block is the word** (ruling 342). The "(LORE_NAME)"
  placeholder is stripped from names and Constellation cells, and the index's `Lore` row reads
  talents_skills.xlsx's `Lore (LORE_NAME)` sheet (ruling 208; `lore.xlsx` deleted by Mike). What follows
  is the history of the one workbook through 0.19.0.
- **`data/actions_maneuvers.xlsx` was the one actions workbook** (the format Mike's, 2026-09-26, as
  `data/actions.xlsx`; the file his since 2026-10-01, 0.5.1, T17; the only one 2026-10-03 to
  2026-11-07). The converter recognised an actions workbook by its `_Tree Index` carrying
  `Name | Type | Meta note` instead of `Tree | Category`; every other sheet in it holds one action
  per row. Columns (first word wins): Action, Cost, Traits, Type,
  Prerequisites, Requirements, Trigger, Description, Effect, Automation. Cost takes glyphs or
  words (`◆`, `◆ to ◆◆◆`, `↺`, `◇`, `1 or 3`, `reaction`); without a Cost column the glyphs in the
  name are read, and with neither the action costs one action and the converter says which ones.
  It writes `assets/actions.json`, which `build_foundry.mjs`, `inject.py` and `build_phb.js` all
  read. **The sheet is authoritative for any action it names:** a `roster.json` row of the same
  name is retired from the compendium, the app and the compendium docx, under the same document
  id, so an action already on a character sheet keeps working. Roster rows the sheet does not
  carry yet stay until it does. Actions typed `Basic Action`, and the roster's Encounter Mode
  rows, are flagged `basic` and appear on every character's Actions tab straight from the
  compendium, never copied. The Automation column is stored on the Item (`system.automation`) and
  shown on its sheet; since 0.9.0 it is the same column as on a tree sheet, one rule per line in
  the framework's grammar and parsed by the build into `system.rules`, no longer prose, and since
  0.10.0 a `bonus` line in it acts; a Maneuver's name is also what a Talent's `bonus ... to
  <Maneuver>` is matched against, and a Maneuver whose Effect says "Relevant Check" and names no
  check opens the picker carrying the Maneuver when used (the automation framework, above).
  The workbook holds the Encounter Mode Maneuvers, one sheet per Chapter 2 group, scaffolded once
  from the roster's `actions` block by `assets/make_maneuvers_xlsx.py` (names plain, glyphs in
  Cost, Requirements and Trigger lifted into their columns, Type `Basic Action`, the 0.5.1 `Aura`
  column with Seek at `30 ft`, `Enabled?` blank on every row, and Aid left to `actions.xlsx`,
  which then held it alone) and Mike's to edit since; the script refuses to overwrite it. Blank is
  the point: a roster Maneuver named by a row is retired under its old document id and ships
  nowhere until its row reads Yes. **Aid moved here on 2026-10-03**, during the 0.10.0 build: Mike
  authored it on the sheet "Watching, Deceiving & Helping" (row 9) with `Enabled? = Yes` and
  deleted `data/actions.xlsx`, which had never been committed. The converter handled the move
  ("'Aid' was actions.xlsx's and is now defined in actions_maneuvers.xlsx, which wins"), `assets/actions.json`
  lists 40 actions from this workbook alone, Aid the one enabled, and Aid ships for the first time,
  under the document id the roster's row had (`packs/_source/actions/aid_30d830c3ca03647e.json`,
  with `check` set from its Effect). Aid is not yet in the `_Tree Index`, so the converter types
  it from its Type cell with a warning; that is Mike's to tidy. The converter still reads every
  actions workbook in `data/`, errors on an action defined in two, skips an `About` sheet, stamps
  each action with its `workbook` and `sheet`, and carries over as found the actions of a
  workbook the last `actions.json` names that is missing from `data/`, with a warning: the rule
  that kept Aid retired on a fresh clone while it lived in the untracked file, now with nothing to
  carry, and kept for the next workbook that goes missing.
- A workbook open in Excel is converted from its last saved version (Excel saves atomically). It
  used to be skipped, which silently wrote a `trees.json` without its trees.

## Known outstanding work

- Open rules question: halfling luck converts a critical failure into a failure, which removes the
  crit that would have Flared the Origin. Undecided whether a Flare triggers on the die or on the
  final result. (Halflings are not in the current data, so this is dormant until they return.)
- Two roots break the Root Rule on purpose, both Human bloodlines: **Versatile Human** ("You gain 1
  Opening Talent Point") and **Torchbearer Human** (allies' first Defense roll). Neither rolls, and
  neither scales. The pipeline warns on both every sync. Either they get a scaling clause or the
  Root Rule gets an exemption for bloodlines.
- The Expert, Master and Legendary tiers are thinly written: through v4.15 three Melee Talents
  (*Reactive Strike*, *Winding*, *Master Cut*) were the only non-Trained ones, and v4.21 adds one
  tier-E child per caster Calling. Everything else is Trained.
- **Armored Fighting's Key Attribute is contradictory and was still open in v4.14** (not rechecked
  cell by cell in v4.21; its Layered Guard still names Scale, which v4.21's armor table dropped). Its section heading
  says *Combat Style • Presence*; the Combat Styles summary table says **Might**. The data uses
  Presence, following the heading, as Shield Fighting was resolved. One cell in `talents_combat_styles.xlsx`
  either way. **This is the tree-level `Feeds` only.** Armored Fighting's per-talent `Feeds`
  overrides are deliberate and mixed (Mike, 2026-08-27): six Might including the root, three
  Presence, two Wits, two Agility. Resolving the heading-vs-table question must not flatten them.
- **Drilled's Effect in the book still says "Weapons Proficiency Bonus"** (through v4.14; not
  rechecked in v4.21). There is no Weapons Constellation; the data reads it as Melee. One sentence
  in the handbook.
- **Key Terms lags the rules in v4.21.** It still calls the Combat Styles children with ranks of
  their own ("parents"), says Attribute Bonus is points divided by 3, and defines Persistent
  Damage as "one die or one round"; Character Mechanics, Chapter 3 and the data say groups, ÷ 4
  and the Damage Resolution text. The v4.21 sync report lists these with the other handbook
  defects (the Chapter 3 Calling table, "our four Defenses", "Reashspeak", Master Cut and the
  Example of Play still naming Counter and Void, Staggered, Bleeding, Clatter and Sustain
  undefined, "Varisian" in a Culture row, the Cast heading splitting the Attack table). The two
  text-only ones are proposed as tracked changes in
  `Starwrought_Players_Handbook_v4.21_v4.21-consistency_proposal.docx`; the rest are Mike's.
- **The Example of Play** was rewritten in v4.21 around Set Your Feet, Gain Control and Protection
  before doubling, and still names Counter and Void in one exchange. Its sums were not re-audited.
- **The action sheets since 0.20.0 (Mike's restructure of 2026-11-07, read as written):** 82 of
  83 rows ship (Drop Prone's row is blank); Parry, Void, Counter, Intercept and Avert Gaze are
  `_Tree Index` names with no row on any sheet, reported each run (the Reactions are Talents since
  v4.21). Seventeen rows typed "Maneuver" are granted by a Talent and the build reads them as not
  basic, naming them each run, until Mike retypes them "Talent Maneuver" (Steady the Line, Quench
  the Ember, Glimmer, Quick Tongue, Oathbound, Tumbling Retreat, Kip Up, Sure Seat, Bull Rush,
  Reliable Anchor, Rally, Talk Them Down, Command the Field, Feinting Step, Battle Cry, No Quarter,
  Lost in the Dark). Rescue Haul is granted by no Talent's block or marker, so it is basic until
  the Cairnward Talent names it. Brace an Object sits on the Crafting and the Guile sheets (the
  first stands).
  Lower the Visor and Raise the Visor have system behaviour behind them (`documents/maneuvers.mjs`)
  and no row yet. Murovian is indexed in `talents_cultures.xlsx` with no sheet and the book has no
  Murovian Culture: Mike's to write or to delete.
- **Two `Enabled?` loose ends for Mike:** Drilled is enabled while the Weapon Familiarity it hands
  over free is not (the converter warns), and the Lore template sheet in `talents_skills.xlsx` has no
  column, so Lore ships whole.
- **Sleeping in armor without Comfort is not implemented.** v4.21: Fatigued equal to your Load
  Strain, to a maximum of 3, on waking. The rest card restores Vigor and clears Fatigued and
  nothing else; the party's rest confirm names who slept in such a piece; the rule is the table's.
- **Attended** stays display only (donning time alone); the v4.13 report's suggestion to rename
  the Breastplate to Cuirass still floats, Mike's call.
- **The v4.15 party-sheet proposals were written against v4.15** (`on-the-road`, `downtime` in
  `assets/phb_propose.py`); whether v4.21 carried any of their sentences was not checked, and a
  proposal wanted now must be regenerated against the v4.21 edition.
- **The Party Sheet plan is built; what remains of it is Mike's** (`party-sheet-plan.md` in the
  project root; phase 1 shipped as system 0.7.0, rulings 91 to 95; phase 2, loot and the purse
  over the `party:*` relay and Ask everyone, as 0.7.1, rulings 96 to 100; phase 3, the road, as
  0.7.2, rulings 101 to 107, and its second cut, the road roll remembered on the character and kept
  as Initiative when the GM ticks it, as 0.7.3, rulings 108 to 110, with the Initiative assembly
  carrying every modifier of the Constellation's check as 0.7.4, ruling 111; phase 4, Downtime, as
  0.7.5, rulings 112 to 114: the Days field, the three Downtime Activities from the pack's Downtime
  Mode folder, Train through the shared Flare picker with its once-between-Milestones warning, and
  the Retrain and Provision lines). **The decisions.** Each of the plan's sixteen was built to the
  panel's recommendation by the phase that met it (14, warn and never refuse a second Train, by
  phase 4), and every one stays Mike's to overrule: 1 to 5 (the Observer Actor and the relay, the
  party's Milestone, Vigor rising with a level, Hero Points to exactly 1, the Deferred count, now
  the Comets count), 6 to
  9 and 11 (the Fatigued gate, the slowest member's pace, the Avoid Notice row, the Earning a Living
  strike, the roster columns), 10 (the card prints 5, 10, 15; P567 is the book's), 12 and 13
  (players see Thresholds; characters only may join), 14, 15 and 16 (Loot before Exploration; no
  sentence on shared loot). **The handbook sentences.** None of the plan's twelve is in an edition.
  Phase 3 runs ahead of the book on four and a strike: the party's Travel Speed after P344 (item
  4), the Fatigued row's "can Travel but take no other Exploration Mode Activity" (item 5, decision
  6), Initiative when Activities differ, appended to P323 (item 6), the Avoid Notice row in Table
  95 (item 9, decision 8), and "Earning a Living" struck from P354 for "Provisioning" (decision 9),
  all five Word tracked changes under the author Claude in
  `Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx` (`assets/phb_propose.py`,
  `PROPOSALS["on-the-road"]`; gitignored as every `*_proposal.docx` is). Phase 4 runs ahead on one
  clause: Table 96's Train row, "only once between Milestones." to "only once between one Milestone
  and the next, counted for each character." (item 11, which the `trainedAt` flag embodies), in
  `Starwrought_Players_Handbook_v4.15_downtime_proposal.docx` (`PROPOSALS["downtime"]`). Both are
  for Mike to accept or reject; a proposal is not an edition: `data/SYNC.json` is untouched, the
  drift check ignores the names, and the sync follows once Mike accepts into a numbered handbook.
  Until then the system's Travel Speed, Fatigued gate, Initiative by Activity, Avoid Notice row and
  per-character Train count have no sentence in the book behind them. The remaining sentences are
  wanted, not needed: items 1, 2, 3, 7, 8 and 12 bear on phase 1, and item 10, shared loot and a
  common purse, is optional for phase 2 (decision 16). **Nothing in the four phases is enforced:**
  the Comets count is a reminder with a number on it, a Talent drag is as unpoliced as before,
  the loot values nothing (no selling, no price computed, no party token; a player's Take needs a
  GM connected), the Travel Speed moves no token, the Fatigued gate locks a select and refuses a
  pick and nothing else, Look Harmless's Requirements warn, Begin the encounter rolls nothing, a
  road roll is kept as Initiative only while the GM leaves its box ticked (0.7.3; the record itself
  is a convenience the GM reads), the Downtime days are a number nothing counts down, Train warns
  and never refuses, and Retrain and Provision have no control (0.7.5).
- **The Result table's Hit row lacks the Quick qualifier** (v4.14; not rechecked in v4.21). The
  system holds a Quick Hit to the Torso. Two words in one cell, Mike's.
- **A spell's effects beyond the die are the table's** (0.11.0; the Cast is in the flow since
  0.12.0). Areas on the map, pushes, conditions on a Hit, summons, Temporary Vigor pools, healing
  and a second damage type stay the Talent's text until a rule kind reads them; a spell's range
  prints no note on the card. **An adversary casts nothing through the system** (`Cast.npc`; its
  attack rows are Blows): an adversary's spell is the GM's narration and a character's Defense
  answers it from the sheet, until adversaries get spell rows or Talents. The damage, reroll and
  party relays stay on their own emits (`documents/cards/shared.mjs`, `party-socket.mjs`);
  `reroll:*` is the first to move onto `attack-socket.mjs` when one wants a correlated reply.
- **Reactions the engine leaves to the table** (0.11.0; ruling 130): Cover the Angle (an adjacent
  ally's melee Blow against your Guard) is offered nowhere; Kneel Behind the Shield's rooted Speed,
  the "no more than one size larger" clauses of Parry and Deflecting Palms, and Deflecting Palms'
  damage reduction are notes on the card; a ⓿↺ or ❶↺ Reaction Talent under a name `SW.REACTIONS`
  does not know is offered only as a generic Posture; an adversary is offered no Riposte (0.12.0),
  having no weapon Item to strike back with. A new Reaction in the book is one row in the table
  (`config/exchange.mjs`) and its i18n strings.
- **The next rule kind comes from the next Talent** (`automation-plan.md`, `AUTOMATION_GRAMMAR.md`).
  (0.31.0 added no kind: it gave the grammar a condition, `EFFECT(<name>)`, and `requires` three
  words.) Twenty-five kinds ship (sixteen since 0.16.0, `substitute` since 0.21.0, `give` and `alter` since
  0.22.0, `permit` since 0.24.0, `subordinate` since 0.25.0, `requires` since 0.28.0, `reach` since 0.30.0,
  `apply` since 0.32.0, `check` since 0.34.0): the effect
  kinds `bonus`, `prevent`, `mark`, `reroll`, `ignore`, `substitute`, `give`, `alter`, `permit`,
  `subordinate`, `apply`, the creation kinds `grant` and `aura`,
  the feature kinds `trait`, `size`, `speed`, `reach`, `vigor`, `sense`, `language`, `maneuver`,
  `talent`, `choice`, and `requires` and `check`, the blocks on a Maneuver's own row that the
  Maneuvers tab and the use read; the
  level-1 Human, the two Cultures, the
  three Backgrounds, the Calling Roots and the three Talent Maneuvers are written whole in the
  Fantasy Grounds shape. What the grammar does not yet read: a `prevent` of a Condition on an ally
  as a Reaction (no Talent asks for it; the Expose Reaction is built); adversaries' rolls (flat);
  hearing, light and sight range (`SEEN` is line of sight and three statuses); a `reroll` on an
  Attack or Defense card (those keep the 0.5.3 button); durations in rounds and dice values on a
  modifier (FG has them; no Talent wants them yet); and, for `substitute` (0.21.0), a Constellation
  as the check a USE names (it brings the Initiative question of ruling 111 with the first Talent
  that wants it; an open decision), offers on plain checks (a swap is offered only from the
  Maneuver's own Item), `IF: UNSUBSTITUTED`, a flat Proficiency Bonus (Working Knowledge's "+3
  instead of +0"), `FOR` and auras, `CLAIM`; and, for `give` and `alter` (0.22.0), two uses of one
  pending result (Carry the Plan), a Condition given
  by a result, a result from a Maneuver that rolls no check, an adversary as the recipient, the
  `ALTER` properties beyond the eight (each refused as not read yet; eleven of Mike's drafted
  cells named one at 0.22.0; Coordinated Footwork's and Reciprocal Effort's are now told what to
  write), and
  a Threshold a Maneuver's check opens on (Aid's "typically 15", offered to Mike as
  the next small step); and, for `permit` (0.24.0), anything permitted but a Move (a Strike, a
  Step as the descriptor), the order and the declared routes of Move Together, "can perceive your
  cue", willingness, and a use taken back; and, for `subordinate` (0.25.0), a built-in, a Strike,
  a Cast or a movement row as the subordinate, a Prepared parent, two `SUBORDINATE` lines on one
  row, a subordinate chosen when the Maneuver is used (Shared Demonstration), one Aid check for
  several allies (Common Purpose, United Effort), Aid before an ally's roll (Timely Aid), Back on
  Track, a row that charges extra for its subordinate ("unless otherwise specified" has no word
  yet). NAMED EFFECTS, STEP TWO, is built whole: its reading half (0.31.0: the plain
  `EFFECT(<name>)` after `IF:` and `IFT:` on the bonus lines, and `[REQUIRES effect <Name>]`)
  and its writing half (0.32.0: the `apply` kind, `APPLY` and `REMOVE` on a Maneuver's own row,
  `COST(<n>)` and `mine`). Not planned, and what the next rows will ask for: an Effect that
  carries its own lines (a Basic Maneuver's row cannot carry a reading line for everyone: Talk
  Them Down, Anticipate, Bolster), the Wrong-Footed Condition's own effect and "Wrong-Footed TO a
  creature" on yourself, a window that ends with another creature's Opportunity on an Effect
  that is on you, ends that are events, a result for each of several creatures, a target who
  chooses between two Defenses, a Condition's value compared, an Effect read inside an aura.
  **The 0.13.0 form is refused since 0.17.0**
  (a GM's world Item still in it shows the refusal on its sheet and its lines are skipped). **A
  bare effect line in a cell and the `visible` word of `[AURA ...]` are refused since 0.18.0**
  (both warned in 0.17.0); the custom effects field keeps the bare form. **A terrain kind is a
  roster row** (0.18.0): adding one is a row in `terrainKinds`, no code; picking a kind on a region
  brings the row's cost (0.18.1). **A Lore left unnamed from before 0.18.0** reads "Lore
  (unnamed)" (the 0.18.1 migration renamed the Item once) and shows Name this Lore on its row;
  nothing names it for the player. **The rules' flag keys go through `SW.flagKey` and
  `SW.ruleCarrierKey`, a Constellation Item's slug through `SW.constellationSlugOf`, and the
  armed flag's one writer is `armClaim`** (0.18.1, the code review); a mark a client cannot write
  is relayed as `rules:marks` to the GM's client or an active owner's (`onRulesSocket`,
  `module/rules/scene.mjs`), and `preventersFor` is a read whose `marks` the acting caller spends
  (`spendSkips`), never a render.
  **The retired columns** (the index's Vigor/HP, Size, Speed, Senses,
  Traits, Languages, the Callings' Skills, the tree sheets' Choice and Free Talent, the roster's
  Opening Vigor) are read this release with a warning and refused next; `talents_martial.xlsx`'s Melee
  sheet still carries Weapon Familiarity's Choice "Weapon Group or Technical Weapon" in the column
  and no Automation column, Mike's to move into `[CHOICE Weapon Group or Technical Weapon]`. **Fear
  is carried by nothing in the data** (no weapon, attack or spell Talent has the trait), so the
  Rally Aura reads and fires on nothing until one is authored; the build warns. **Iron Etiquette's
  Intimidation line fires on nothing shipped** until the Demoralize row (or Feint, Talk Them Down)
  is enabled in `data/actions_maneuvers.xlsx`; a world Item with a Defense named reads it today. **Rally ❶
  and Battle Cry ⓿↺** are Talents that grant Maneuvers; Mike enabled their Constellations
  (Diplomacy, Intimidation, with Guile and Stealth) in `data/talents_skills.xlsx` on 2026-11-05, so the
  Talents ship, but their rows on the Talent Maneuvers sheet and their `[MANEUVER X]` cells are
  still to be written, as the Steady the Line, Oathbound and Quick Tongue rows were. The Jack of All
  Trades rename gives the Talent a new document id; a character who owned "Jack of Trades" keeps
  the stale copy beside the new one after Sync content. Each new kind, by the recipe in
  `module/rules/README.md`: its file, its hook point (`modifiers`, `prevent`, `use`, `card`,
  `substitutions` or `gives` if one serves it, else a new one defined with it; ruling 119), its checks in
  `assets/test_rules.mjs`, its
  section in `AUTOMATION_GRAMMAR.md`, its CHANGELOG and FEATURES prose. No survey of the Talents
  until Mike asks for one. Also his: whether the web app and the compendium docx should print the
  cell or the Lore (neither does), and whether an edited copy's Automation should survive the
  copies refresh (today it does not; the cell is the author, ruling 120). A Talent's Effect stays
  prose the sheet displays (`FEATURES.md`, section 9) until a kind reads it. The spell rows'
  structured columns are data the engine reads directly (the Aura precedent), not a kind; a
  spell's text effects are candidates for kinds later.
- **Mike's Human sheet is in progress (2026-11-10), reported and not changed by 0.21.0.**
  `data/talents_ancestries.xlsx` and `data/actions_maneuvers.xlsx` are his, mid-edit by hand and uncommitted, and
  were not converted, built or staged; Cooperative Instinct, the `substitute` kind's example, is a
  Talent on that sheet and not a shipped one. Five things wait there for him: Dwarf Lore B13 holds
  an em-dash, which fails the style check (`check_style.py` exits 1 on that one cell); Impossible
  Improvisation's Prerequisites cell uses a semicolon where the converter splits on commas, so it
  reads as no requirement; 17 Human Talents name Maneuvers with no row yet, which stops the
  content loop until the rows exist; Torchbearer Human's cell no longer carries the Rally Aura,
  and Jack of All Trades and Quick Study wait as `# PROPOSED` comments (16 cells hold only such
  notes, naming tags the grammar does not have: ALTER, PREPARE, CONDITION and extra IF
  conditions), so they automate nothing once the sheet builds; and the Glimmerblood Gnome
  Bloodline card prints a raw `@Maneuver[Glimmer]` marker today, because the Bloodline chassis
  text is copied before markers are expanded (a fix belongs with the next content build). The pack
  content did not move in 0.21.0, so Halfling Fortune, Unclouded Mind and Hold Your Ground, whose
  stored error text lists the effect tags, show the longer list (with USE, and since 0.22.0 GIVE
  and ALTER) the next time the content loop runs. **0.22.0 (2026-11-14) did not touch the two
  workbooks either.** Three cells wait for him to paste, printed in the 0.22.0 changelog entry and
  in `AUTOMATION_GRAMMAR.md` section 5: Aid's five `GIVE` lines (Basic Actions row of
  `data/actions_maneuvers.xlsx`, whose Automation cell is empty), and Patient Assistance's and Sure
  Assistance's `ALTER` lines (the Human sheet), whose `# PROPOSED` drafts do not read as written
  (`Aid.duration` with `recipient-opportunity-end(1)`, and `VALUE: no-effect; PRESERVE:
  original-degree`): each is told the word that does. Until Aid's row carries its lines the two
  Talents change nothing, and Aid's card offers no Give button. **0.24.0 (2026-11-14) did not
  touch them either, and two more cells wait**, printed in the 0.24.0 changelog entry and in
  `AUTOMATION_GRAMMAR.md` section 5: `[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]` on Move
  Together's row (Ancestry Actions sheet of `data/actions_maneuvers.xlsx`) and `[EFFECT ALTER: Move
  Together.movement; VALUE: step]` on Coordinated Footwork (the Human sheet), whose `# PROPOSED`
  draft (`VALUE: choose(Move, Step); APPLY: both-participants`) is told what to write. Until Move
  Together's row carries its line the ally's drag asks the GM as before. **By 2026-11-15 his saved
  workbooks carry four of those five** (read, never written): Move Together's `PERMIT` line, and
  Patient Assistance's, Sure Assistance's and Coordinated Footwork's `ALTER` lines. **Aid's row
  still has an empty Automation cell**, so no Aid gives a result on shipped content. **0.25.0
  (2026-11-15) did not touch the workbooks either, and three things wait**, printed in the 0.25.0
  changelog entry and in `AUTOMATION_GRAMMAR.md` section 5: Aid's five `GIVE` lines; Pay It
  Forward's ROW, which is on no sheet of `data/actions_maneuvers.xlsx` yet (its text is in his draft
  workbook: Cost 0, Frequency "Once per encounter"), with `[EFFECT SUBORDINATE: Aid; IF:
  EFFECT(Aid, used); LIMIT: encounter]`; and `[EFFECT ALTER: Pay It Forward.limit; VALUE: round]`
  on Reciprocal Effort (the Human sheet), whose `# PROPOSED` draft (`VALUE: owner round`) is told
  to write `round`. **Mike's draft workbook** (`C:\Users\Dad\Downloads\StarWrought_Human_Talents
  .xlsx`, outside the repository) holds all twenty draft Human Maneuvers on its Talent Maneuvers
  sheet, each with a `# PROPOSED H1` cell in a grammar of his own drafting (`TRIGGER`, `SELECT`,
  `AID`, `ACTION`, `CONDITION`, `TEMPVIGOR`, `PREPARE`, `BORROW`; the spec is its Grammar
  Extensions sheet): read it for what a Maneuver says and what he wants of it, and write each in
  the shipped grammar's shape, one kind at a time, as Pay It Forward was.
- **PHB v4.25 is synced (0.26.0, 2026-11-15), and Mike has accepted the redline** (recorded with
  0.26.1; `v4.25-sync-report.md`; the file as he first saved it is in `backup/pre-0.26.0/`). The
  sync left fourteen tracked changes of Claude's in the edition itself: the Subordinate Maneuver
  rule in Chapter 8 (his ask), the cover to v4.25, Preparing to two actions in three places, the
  Modifiers paragraph's lost opening, "an Endeavor", "Attack Threshold", "Train Endeavor", the
  Exploration trait, "Serrovanians" for a Golarion people, the Counter sentence struck, Prone's
  −2 typed, and his Supine rules in the Conditions table. He accepted all fourteen in Word the
  same day and edited three places: the Subordinate rule now sits under its own "Subordinate
  Maneuvers" heading (its words unchanged); the Supine cell is in his final wording WITHOUT
  Claude's "Supine is not Prone ..." sentence, so whether a rule that names Prone also means
  Supine is unsaid; and the Prone row gained "Stand ❶ to clear, or Roll Over ❶ to become Prone.",
  whose last word reads like a slip for Supine (his to mend). The file was recorded again with
  `build_all.mjs --check --accept-phb`, which is the routine whenever he saves the edition:
  compare it with the committed file first (accepted or not, what else changed), follow anything
  that moves a rule, then stamp. **Supine is not built** (ruling 266): the system has
  Prone alone; building it is a condition (Off-Guard, −2 to Attacks except melee against an
  adjacent creature, +2 Evade against ranged, no movement but forced) and two rows of his,
  **Roll Over ❶** (Motion: "Change from Prone to Supine, or from Supine to Prone") and Drop
  Prone's choice, on `data/actions_maneuvers.xlsx`, where a Maneuver now lives. Still in the book and
  his: a `### Kestrel Reach` heading twice was not rechecked; "One activity per day" beside
  "Endeavor". Building Chapter 6 and the Maneuver reference from the sheets is a later task he
  named; `assets/build_phb.js` is the nearest generator.
- **0.34.0 leaves to the table or to Mike** (a Maneuver's check, declared): **the cells wait
  for him to paste** into `data/actions_maneuvers.xlsx` (the 0.34.0 changelog entry and
  `AUTOMATION_GRAMMAR.md` section 5, "Declaring a check": 32 rows; ten change what is read
  today: Trip, Shove, Disarm, Grapple and Reposition, whose target then picks Evade or Guard;
  Calm Animal and Direct Animal, which then read the animal's Guard; Rescue Haul, guessed as a
  Cairnward check; Hide and Sneak, guessed against one target's Awareness); until a row has its
  block it rolls the build's guess. Gain Control's cell stays `N/A`. Rulings 342 to 349 and the
  additions to 341 are Claude's readings and his to overrule (`assets/open_decisions.json`); the
  two to know are 345 (a Grabbed target is read against Evade when the row says only Evade,
  with a note, where it was read against Awareness in silence) and 346 (a request stands after
  the user's Opportunity has ended). Not built: an `ALTER` of a check, several targets from one
  use, a Constellation that is no Defense on the right of `vs` (Seek, Anticipate, Stabilize,
  Hide and Sneak keep a typed Threshold; an open decision), a pick kept secret, a subordinate
  whose check asks the target, a Talent carrying `CHECK`, an adversary's own Talents and
  bonuses on its number. An adversary uses only Maneuvers it owns, and nothing fills its
  numbers. Stated by the review and not changed: the degree on a player's own roll card is
  taken as the card says it; a Reaction pays at the click, before its request, and a Withdraw
  returns nothing; a request made outside an encounter never lapses. Not driven live: a table
  with no GM, a player-owned adversary or companion (mended by reading), a rule's reroll button
  on a requested roll, two real windows of one player rolling at once. **The test world keeps
  fixtures from the 0.34.0 drive on purpose**: the world Trip (`[CHECK Athletics vs Evade or
  Guard]` above its 0.32.0 APPLY lines), the world Demoralize (`[CHECK Intimidation vs
  Guard]`), a world Disarm (flagged `testFixture: "0.34.0"`, `[CHECK Athletics vs Evade or
  Guard]`, cost 2 to 3), the Bandit's own copy of Trip and its typed Athletics 14. To try
  0.34.0 there: target the Bandit and use Trip from Tess's Maneuvers tab (the request card,
  the GM's answer, then Roll); open the Bandit's sheet, target Tess and press Use on its Trip
  (Tess's player gets the Roll buttons, and the Bandit's result card follows). The drive
  deleted its Combats, its probe Items and token and every card it posted (434 messages), then
  ran Sync content for the Grammar journal, which left one "Content synced" card (435); it left
  Mike's Combat with testpc8 the active one at round 4 and the tokens where they were, and
  Foundry running on 0.34.0 with the GM joined.
- **0.33.0 leaves to the table or to Mike** (the Conditions workbook). **What a Condition
  FORBIDS and how it FADES have no word yet** (planned as 0.34.0, which became the `[CHECK
  ...]` block; now after Gain Control's grammar, one word at a time with him, with the
  named Effects sheet he set aside): Supine does not stop movement and its -2 has no exception
  for melee Attacks against adjacent creatures; "cannot Move or Step" and "no action other than
  Escape" are by hand; Frightened and Slowed do not drop by 1 at a round's end; Stunned,
  Heedless and Deafened do nothing; Evade unavailable while Grabbed is still code
  (`unavailableEvade`), as are Slowed's lost actions, Blind's sight, Hidden and Undetected, and
  Fatigued's maximum, Wind check and rests. **Five things wait in `assets/open_decisions.json`**:
  Claude's readings (rulings 325, 327 to 329, 331, 332, 334, 335), of which 329 is the one to
  know (the row is the word: emptying the Off-Guard, Frightened or Fatigued row's Automation
  cell switches that Condition's numbers off for everyone); Supine's attack line; a creature
  both Prone and Supine taking the lines of both, and `IFT: RANGED` being a ranged Blow (no +2
  Evade against a Blast from range); the Prone row's "Roll Over to become Prone", copied from the
  handbook as written; and the handbook's Conditions table, still printed. Stated by the review
  and not changed: "against X" matches the applier by its own uuid (a Feint rolled from an
  adversary's sidebar sheet and not its token names another body); "Blind" and "Deaf" are names
  of Blinded and Deafened now, so a hand-made effect merely called either is read by nothing; a
  reroll of an adversary's Gain Control reads its Conditions live; a slip in `conditions.xlsx`
  stops the full converter, as a slip in any workbook does; with no `assets/conditions.json` the
  build leaves an old `content/conditions.json` where it is. Roll Over has no row. A rule that names Prone still means
  Prone and not Supine. Wrong-Footed is to one creature at a time, and one toggled from the
  token names nobody. An adversary's own Talents stay unread. **Not built**: a Condition's row
  reading anything but CHECK, ATK, DEF, INIT; a value compared (`EFFECT(frightened 2)`); `N` in
  a Talent's line; a Condition's lines on an unlinked token of a scene nobody is viewing until
  it is next prepared. **The test world** was driven on 0.33.0 and left as found (434 messages:
  the 433 and one "Content synced" card; Mike's Combat with testpc8 active at round 4; the
  Bandit Prone, as found; its content level with these sources); its world Maneuvers Stand, Drop
  Prone and Drop Supine still carry the 0.32.1 cells, which now mean the Condition. To try
  0.33.0 there: toggle Supine or Prone on Wren from the token and watch Evade and Guard on her
  sheet; open the Bandit's sheet (it is Prone) and read "11 in effect" beside Evade and the
  lines under Prone on its Effects tab; change a cell in `data/conditions.xlsx`, double-click
  `sync_conditions.cmd`, then Sync content.
- **0.32.0 leaves to the table or to Mike** (a Maneuver puts Effects on): **the cells wait for
  him to paste** into `data/actions_maneuvers.xlsx` (the 0.32.0 changelog entry and
  `AUTOMATION_GRAMMAR.md` section 5: Stand, Drop Prone, Take Cover, Trip, Shove, Disarm, Grapple,
  Demoralize, Feint, Escape); until a row has its lines it applies nothing. Three things about
  his rows as saved: Grapple's Cost cell reads 0 (its `COST` lines wait for "1 to 2"), Drop Prone
  is not enabled, and Trip, Shove, Disarm and Grapple say "vs. Evade or Guard", of which the
  build reads Evade until the row carries `[CHECK Athletics vs Evade or Guard]` (0.34.0). Rulings 313 to 318, 320 and 321 are Claude's readings and his to overrule
  (a Condition by other means left alone; the later window stands; a voluntary act never
  prevented; no window outside an encounter; the higher value kept; COST; an applied Effect
  public; a target line needs a check). Not built: an Effect that carries its own lines, the
  Wrong-Footed Condition's own effect, ends that are events, several targets from one card,
  damage, pushes and movement, an adversary's row applying by degree, a reroll taking back what
  the first die put on ANOTHER creature. Rush's Off-Guard is still by hand (the drag is not a
  use of the row). Not driven live: a table with no GM (the owner's client as the one writer), a
  Skip or an Off on an owned copy's line, a REMOVE by degree. **The test world keeps fixtures
  from the 0.32.0 drive on purpose** (flagged `testFixture: "0.32.0"`): world Maneuvers Trip,
  Demoralize, Take Cover and Drop Prone with the cells above, the APPLY and REMOVE lines added
  to the world Feint and Stand of 0.28.0, and the Talent "Applied Reader (0.32.0 fixture)" on
  Tess (`ATK: 1 situation; IFT: EFFECT(wrong-footed, mine)` and `DEF: 1 situation, guard; IF:
  EFFECT(Taking Cover)`). They shadow the pack's rows in that world until deleted. To try
  0.32.0 there: start a Combat with Tess and the Bandit, target the Bandit, use Demoralize from
  Tess's Maneuvers tab and press "Apply to Bandit" on the card when it is a Success; use Take
  Cover and watch Tess's Guard and her Effects tab; use Drop Prone and then Stand. The drive
  deleted its Combats and the 49 cards it posted over two passes (431 messages), then ran Sync
  content, which brought the Grammar journal and the 31 Equipment Items that world was behind on
  (the weapons and shields built with 0.31.0: its Equipment compendium holds all 62 now) and
  left one "Content synced" card (432 messages); it took off everything it had put
  on Tess, Wren and the Bandit (the Bandit's Prone left as found), and left Mike's Combat with
  testpc8 the active one at round 4 and the tokens where they were.
- **0.31.0 leaves to the table or to Mike** (Effects read by name): a hand made the only named
  Effects until 0.32.0; a Condition's value is not compared; no kind but `bonus` reads `EFFECT(<name>)`; an adversary's own rolls are
  flat, though its Effects are read by `IFT` and `with`. Rulings 305 (a custom effect row counts
  as a named Effect by its label; a Condition's name is reserved), 309 (named Effects are public)
  and 310 (a player's hand change is an Adjusted card, a Condition toggle is not) are Claude's
  readings and his to overrule. **0.30.0 and 0.31.0 went in as one commit on 2026-11-17, tagged
  `v0.31.0` alone** (no `v0.30.0` tag: the release workflow would package 0.31.0's files under
  it); the four workbooks in progress are in it as renames with their last committed content,
  his edits unstaged. Not driven live: a full Strike clicked through
  the Combat window against a Prone defender (the pairing was read through the function the
  coordinator calls, with the real actors), the hover card on screen, a LIMITED user's sheet.
  **The test world keeps one fixture from the 0.31.0 drive on purpose**: the Talent "Effects
  Reader (0.31.0 fixture)" on Tess (flagged `testFixture: "0.31.0"`), four lines: +1 to attacks
  and +1 Evade against a Prone creature, +2 Guard while Tess has an effect named Blessed, +1
  Intimidation against a Frightened one. To try 0.31.0 there: open Tess's Effects tab, press the
  plus beside Active Effects, name the effect Blessed, and watch Guard go from 16 to 18; write
  `[REQUIRES effect Blessed]` in the Automation box of any Maneuver she owns and watch it leave
  the Maneuvers tab when the effect is switched off. The drive deleted its probe rows, its
  effects and the five Adjusted cards it posted, ran Sync content for the Grammar journal (one
  "Content synced" card: 431 messages), left Mike's Combat with testpc8 the active one at round
  4 and the tokens where they were, and Foundry running on 0.31.0 with the GM joined. **Foundry
  was found closed at the commit**, after the equipment sheet was rebuilt, so that world's
  Equipment compendium is one build behind (it holds Arrows, Bolts and Bullets and one weapon):
  the 0.32.0 drive ran that sync (the 28 other weapons and the 3 shields are there now). The
  shipped ranged weapons were not driven live.
- **0.30.0 leaves to the table or to Mike** (ammunition, `[REACH N]`, the equipment build):
  (when 0.30.0 was built his saved sheet enabled only the Unarmed Strike among weapons, so
  Dagger, Shortsword and Spear left the pack; **he has since enabled every row, built and
  committed with 0.31.0 on 2026-11-17**, so all 29 weapons, the 3 shields and the ammunition
  ship and the converter's three ammunition warnings are quiet). Rulings 298
  (a stack In hand first, then by name; ammunition taken at the Reload and never at the Strike)
  and 304 are Claude's readings and his to overrule. The About sheet of `data/equipment.xlsx`
  still says it follows the handbook's Chapter 5 and ignores sheets other than Weapons, Armor
  and Shields: his to reword. Not built: recovery after a fight or any count of shots spent
  (his choice), merging two stacks, ammunition and ranged prices in the web app and the docx
  (the roster's ranged block has no price column), a `[REACH N]` that follows a Size changed by
  hand, reach rules on an adversary. **`[REACH N]` ships as the kind alone**: no built workbook
  holds one, so its display code runs for the first time at his next full content build. The
  four workbooks he is still editing (`actions_maneuvers`, `talents_ancestries`,
  `talents_callings`, `talents_skills`) are NOT to be converted, built, staged or written; the
  equipment build is the one that may run.
- **0.29.0 leaves to the table or to Mike** (Strike, loading, the fist; ammunition was the next
  step and is built, 0.30.0). **Strike's cell waits for
  him to paste** (the 0.29.0 changelog entry and `AUTOMATION_GRAMMAR.md` section 5: `[REQUIRES foe
  in reach or ranged weapon loaded or weapon thrown]`, `[REQUIRES foe in sight]`, `[REQUIRES not
  restrained]`, `[REQUIRES not unconscious]`); until then the tab always lists Strike. Rulings
  292, 293 and 294 are Claude's readings and his to overrule (Reload at the weapon's own cost and
  free outside an encounter; the chip's free correction; an archer with a fist threatening at 2
  ft, and the Finesse fist always rolling Agility). The eight ranged weapons ship since the
  equipment sheet built with 0.31.0 (none did through 0.30.0), so loading acts on shipped
  content; it was driven live only with test weapons of the same traits. Not built: the Crossbow Fighting
  Talents that bend reloading (Practiced Loader, Crank and Move, Snap Shot, Covered Reload), a
  Cast chooser, ammunition on an adversary's attack rows, a weapon reloading itself when an
  encounter ends. The Reload [N] trait says "N Interact actions" where the sheet has a Reload
  Maneuver (Mike, 2026-11-15, confirmed the trait's words stand): a wording pass in Word, by
  hand, if he wants one (the cell nests a table the redline tool refuses).
- **0.28.0 leaves to the table or to Mike** (the Maneuvers tab; since 0.29.0 the Reload block of
  the list below is WITHDRAWN, Reload's condition being in code, so twenty-seven remain): **the twenty-eight
  `[REQUIRES ...]` blocks wait for him to paste** into `data/actions_maneuvers.xlsx` (the 0.28.0 changelog
  entry and `AUTOMATION_GRAMMAR.md` section 5 print them; Reload, Crawl, Drop Prone, Stand, Steady
  the Line, Move Together, Rescue Haul, Escape, Tumble Through, Kip Up, Calm Animal, Direct Animal,
  Disarm, Grapple, Reposition, Shove, Trip, Reliable Anchor, Rally, Talk Them Down, Command the
  Field, Feint, Feinting Step, Anticipate, Stabilize, Treat Persistent Damage, Bolster, Captivate;
  and three that are a judgement, Release, Sneak and Battle Cry); until a row has its block the
  tab always lists it. Rulings 283, 287 and 289 are Claude's readings and his to overrule (a row
  left out only when the system knows; what counts as near and as a free hand; nothing refused and
  a Maneuver listed once). Not read: Size limits, cover and concealment, tools and supplies,
  mounts and animals, "can hear you", "willing", a Reaction's Trigger, anything about the creature
  targeted rather than who is near, a hand lost to an Arms Wound, and Supine as a Condition
  (since 0.32.1 the word reads the named Effect Supine, which Drop Supine's APPLY puts on; when
  Supine is built `bare()` in `module/rules/requires.mjs` is its one line).
  A row with a Trigger and no ↺ in its Cost cell is a Reaction to the tab and a plain Maneuver to
  the engine (the 0.23.0 open point; a ↺ in the cell settles both). Grapple's row reads Cost 0
  with the Reaction trait, so the tab lists it off-turn as a free Reaction. The Reaction Talents
  (Parry, Sidestep, Kneel Behind the Shield, Deflecting Palms) are Talents offered in the Combat
  window and not rows of the tab, so their Requirements have no block; the adversary sheet's
  abilities are not filtered. A Move that Move Together permits is not known to the tab (the
  record is on the user; the ally's Move row still says "Not your Opportunity" while the drag is
  allowed). Chat lines that say what was spent keep the font glyphs, so ⓿ can still look larger
  there, and the small captions on the Overview keep theirs. A button's pip is smaller than a
  row's, as its glyph was. Not driven live: a LIMITED user's sheet, the bookmark's hover, a door.
- **0.27.0 leaves to the table or to Mike** (the Bind): the four tracked changes of
  `PROPOSALS["bind"]` wait in `Starwrought_Players_Handbook_v4.25.docx` for him to accept or
  reject (compare with the committed file and re-stamp when he saves, as for every redline);
  rulings 276 and 280 are Claude's readings and his to overrule (the Zone kept on the card,
  no -2 on Gain Control) and 277 is his (2026-11-19, "Keep as is": Close is the Controller's Step alone); giving ground, a Shove and a GM's
  repositioning end no Bind; a fighter holds ONE Bind, where the book allows one for each
  implement ("Track no more than one Bind per implement"); a held shield is always the implement
  a card's Bind names (`rigidImplement`), so a shield-bearer's neutral Bind ends on a sword
  Strike and a foe Controlling the shield puts no -2 on the sword (Form a Bind lets the player
  name the sword); a Disarm, "after its first benefit is used" and two adversaries contesting a
  Bind are by hand; Off-Guard on an adversary moves no Threshold and an adversary's Strike has no
  damage card, so the Zone it may still use is a line for the GM; with no GM connected an end on
  a body nobody present owns waits; an undo of a move does not bring a Bind back. The Talents
  that bend these rules are not enabled and not built: **Winding** ("your Strikes against that
  foe do not end the Bind"), **Feeling** (a Critical Failure on Gain Control leaves a neutral
  Bind), **Catch the Blade**, **Clinch**. Whether an Attack-trait check (Gain Control, Disarm,
  Grapple, Trip) should take the attacker's attack penalties (an Arms Wound, Fatigued) is unsaid:
  none does today.
- **0.26.0 leaves to the table or to Mike:** a Talent that "specifies otherwise" and asks for one
  roll for all its targets (no column says so; none exists); a spell's own area (its shape and
  size as data, the Cast placing the template and removing it: columns for `data/talents_magic.xlsx`,
  planned on its own); telling an area Attack from another, so its Critical Hit effect is the
  GM's to switch off on the Zone; one Reaction at a time beyond the attack's one answer (his
  choice, ruling 262); the order of the dice when a Controlled weapon is swept at the Bind
  partner and another; two overlapping regions of the SAME kind, which count as two effects (×3;
  ruling 256, Claude's reading, his to overrule); a Persistent Damage
  effect other than a Torso Wound's bleed, which still has no sheet field or control; an
  adversary's Off-Guard, which has never moved its typed Thresholds.
- **Whether a bonus reaches a Defense rolled as a check is open** (ruling 222's wider question; a
  row in `assets/open_decisions.json`). Ruling 222 is narrow: a bonus to a Maneuver applies to a
  check rolled with a Defense Constellation from that Maneuver's Item (Humanity's +1 on an Aid
  made with Awareness). A bonus to every check, and a bonus to a Maneuver made without its Item,
  still stay out of a Defense rolled as a check (Wind's Endure, a Recovery, a Search with
  Awareness): nothing is applied and nothing is offered there. Recommended: yes, as its own
  ruling, with a Wind roll driven live, because it changes numbers outside Aid.
- **The five caster Callings are disabled in `data/talents_callings.xlsx`** as Mike saved it on 2026-11-05
  (their `Enabled?` cells blank), so Spellshaper, Blood Mage, Necromancer, Summoner and Spellblade
  and their Talents left the pack sources in 0.13.0; setting the rows to Yes restores them under
  the same ids. Whether that was meant is his to say.
- **PHB v4.24 is synced (0.20.0, 2026-11-08); its defects are Mike's** (`v4.24-sync-report.md`):
  the cover reads v4.23, Chapter 3's Culture section has two `### Kestrel Reach` headings, Supine is
  in the Conditions table with no definition (not implemented, ruling 213), the Necromancer's root
  text says 6 Opening Vigor against the table's and the data's 8 (ruling 212), Chapter 4's Downtime
  Mode still says "Downtime Activities" and names Provision, the Exploration trait says half Speed
  while Travel is Full, and Blade Brake's "forced movemt" and the Lore template's "side by sid" are
  typos the proposal tool could not place. Two redlines wait:
  `Starwrought_Players_Handbook_v4.24_preparing_proposal.docx` and
  `Starwrought_Players_Handbook_v4.24_consistency_proposal.docx`. **The release pipeline with no
  flag exits 1 at `parse_rules`** until the eight red Automation cells read (release mode stops on
  the first unreadable line, Halfling Fortune's; `automation-cells-report.md`): the stamp was made
  with `--check --accept-phb` and `--check` passes.
- **The test world carries 0.15.0's fixtures**: a "Test Mud" region with the Difficult terrain
  behavior east of Tess, a world "Demoralize ❶" action Item on Wren with its check against Guard,
  Tess as a Serrovanian with the four Serrovane Talents and Wren as a Reacher with the four Kestrel
  Reach ones (their `details.culture.name` set), and a mark on Tess naming the Bandit. The GM's
  Combat was deleted (again after the 0.19.0 live drive, which also left its probe cards in the
  chat log and put testpc6's ownership back to default; the 0.20.0 drive left its Prepared and
  Abandon cards too, and deleted its probe party and probe character). The world has no party
  Actor. The 0.21.0 drive (2026-11-10) found the viewed scene, Stonecutters' Quarter, with no
  tokens, used an empty Combat for the encounter limit and deleted it, removed its probe copy of
  Cooperative Instinct from Tess and the sixteen Aid cards it rolled, and left one "Content synced"
  card (the Grammar journal). Tess's old "Jack of Trades" copy still carries its 0.13.0 cell and
  its stored rule, which fires. **The 0.22.0 drive (2026-11-14) left three fixtures on purpose**,
  so that Aid's Give button can be tried there before Mike's workbooks build: a WORLD action Item
  named "Aid" (basic, flagged `testFixture`, carrying the five `GIVE` lines; a world basic Maneuver
  of the same name replaces the printed one on every Actions tab, so it shadows the pack's Aid in
  that world until it is deleted, and should be deleted once the shipped row carries the lines),
  the Talents "Patient Assistance" and "Sure Assistance" on Tess with their `ALTER` cells, and
  tokens for Tess, Wren and a Bandit on Stonecutters' Quarter. It deleted its Combats, its
  testpc1 token and the 57 cards it posted, cleared every pending result and put the two Talents'
  switches back to On. Nothing in the repository depends on them. The 0.23.0 drive (2026-11-14)
  left those fixtures as they were, deleted its Combats and the cards it posted, and closed the
  three attacks it had left unfinished on purpose. **The 0.24.0 drive (2026-11-14) left three
  more fixtures on purpose**, so Move Together can be tried there before Mike's workbooks build:
  a WORLD action Item "Move Together" (flagged `testFixture`, with the `PERMIT` cell), Tess's own
  copy of it (the one her "From your Talents" panel uses) and the Talent "Coordinated Footwork" on
  Tess with its `ALTER` cell (delete it, or switch its line Off, to see plain Moves). It deleted
  its Combats and the 40 cards it posted (416 messages again), cleared the records, marks, request
  and permit flags it left on Tess and Wren, and put the tokens back (Tess 1200,1200; Wren
  1320,1200). Mike, the player user, owns Tess and Wren. **The 0.25.0 drive (2026-11-15) left
  three more fixtures on purpose** (flagged `testFixture: "0.25.0"`), so Pay It Forward can be
  tried there before Mike's row exists: a WORLD action Item "Pay It Forward" (cost 0, with the
  `SUBORDINATE` cell; the client's resolver needs the Maneuver in the world or the pack for an
  `ALTER` to name it), Tess's own copy of it (listed under "Maneuvers and Activities", since no
  Talent granted it) and the Talent "Reciprocal Effort" on Tess with its `ALTER` cell (delete it,
  or switch its line Off, for once an encounter). To try it: with the world "Aid" fixture, Wren
  Aids Tess and presses Give; at Tess's Opportunity she rolls a check with that Constellation;
  the button is on that card. It deleted its two Combats and the 36 cards it posted (417
  messages, the one above 416 being a "Content synced" card from the 0.24.0 session), its probe
  Items, and the marks and the request flag it left on Tess; the tokens were never moved. The
  server was restarted for the 0.25.0 manifest and left running, the GM joined. **The 0.26.0
  drive (2026-11-15) left nothing**: the world was launched on the 0.26.0 manifest (Foundry asked
  to migrate and made its own backup of the world first), and the drive's probe token (a second
  Bandit), its regions, its temporary party Actor, its Combats and the cards it posted were all
  deleted (417 messages again); the Bandit's Prone is older than the drive and was left. To try
  0.26.0 there: target two or three tokens and Strike (one Roll row each in the Combat window);
  in the Regions controls draw a circle over tokens as a player and watch the targets follow it;
  press the burst beside a Zone's shield for a Critical Hit effect and Recenter to end it. **The
  0.27.0 drive (2026-11-15) left nothing**: Foundry was found stopped and was started for the
  0.27.0 manifest (no migration was asked), and the drive's Combat, its probe shield, the Size and
  Protection it lent the Bandit and the 163 cards it posted were all removed (417 messages again,
  the three tokens back at 1200, 1320 and 1440; the Bandit's Prone left as found). To try 0.27.0
  there: start a Combat, target the Bandit and press Form a Bind on Tess's sheet; drag Tess a
  Step away (the Bind ends on the move's card); Form it again, press Gain Control on the Bind
  line, and Step toward the Bandit for a Close. **The 0.28.0 drive (2026-11-15) found the world
  used by Mike since** (a character testpc8 with its token, a started Combat holding it alone, and
  two Cast cards; 420 messages) and left all of that as found: its own Combat was deleted and his
  made the active one again, the Bandit put back at 1440,1200, the two cards it posted deleted
  (420 messages again), Tess's Favorites flag removed. **It left three fixtures on purpose**
  (flagged `testFixture: "0.28.0"`), so the filter can be tried there before the workbook carries
  the blocks: WORLD action Items "Stand" (`[REQUIRES prone or supine]`), "Grapple" (`[REQUIRES
  free hand or weapon grapple][REQUIRES creature in reach]`) and "Feint" (`[REQUIRES foe in
  reach]`), each a copy of the pack's row with the block added; a world basic Maneuver of the same
  name replaces the printed one on every Maneuvers tab, so they shadow the pack's rows in that
  world until deleted, and should be deleted once the shipped rows carry the blocks. Foundry was
  restarted for the 0.28.0 manifest and left running, the GM joined; the pane's own client setting
  `showAllManeuvers` was left off. To try 0.28.0 there: open Wren's Maneuvers tab, toggle Prone on
  her token and watch Stand appear; drag the Bandit beside Tess and watch Feint appear on hers;
  press the bookmark on a row; press Show every Maneuver. Tess cannot be made Prone outside an
  encounter (Stubborn Footing prevents it every time there). **The 0.29.0 drive (2026-11-15)
  found Foundry stopped** and the world one "Content synced" card further on (421 messages, Mike's
  Combat with testpc8 still the active one), started it for the 0.29.0 manifest, and the one-time
  step gave all eleven characters the Unarmed Strike, which stays: it is the feature. Its own
  Combats, its probe characters, the test weapons it lent Tess (a bow, three crossbows, Bolas)
  and the 41 cards it posted over two passes were removed (421 messages again, the tokens where
  they were, Tess's Shortsword back in hand, Mike's Combat the active one), and Sync content was
  then run for the Grammar journal, which left one "Content synced" card (422). Foundry was left
  running on 0.29.0, the GM joined. **It left one fixture on purpose**
  (flagged `testFixture: "0.29.0"`): a WORLD action Item "Strike", a copy of the pack's row with
  the four `[REQUIRES ...]` blocks of the 0.29.0 changelog entry, so the cell can be tried before
  the workbook carries it; it shadows the pack's Strike in that world until deleted, and should be
  deleted once the shipped row carries the blocks. No ranged weapon ships enabled, so to try
  loading there make a world weapon with the traits `Ranged 120` and `Reload 1`, put it in Tess's
  hand in an encounter and Strike: the chip on its Equipment row goes Empty, the Maneuvers tab
  lists Reload, and the next Strike posts the "Not loaded" card. To try the rest: open WREN's
  Maneuvers tab (the Bandit is in Wren's reach; with the fixture's cell Tess, a sword in hand and
  no foe in reach, does not list Strike, which is the cell working) and press ❶ on the Strike row:
  the chooser lists the Shortsword and the Unarmed Strike; hide the Bandit, or drag it away, and
  watch Strike leave the tab. **The 0.30.0 drive (2026-11-15) found the world used by Mike since**
  (his Combat with testpc8 at round 4; 428 messages) and left that as found. Foundry was restarted
  for the 0.30.0 manifest, and Sync content was run: the Equipment compendium there now holds
  Arrows, Bolts and Bullets and no longer Dagger, Shortsword or Spear (Tess and Wren keep the
  Shortswords they hold), and the armor pieces carry their descriptions. The drive's Combat, its
  test weapons, ammunition and Talents on Tess and its ten cards were removed (429 messages: the
  one "Content synced" card stays). **Foundry was found closed again before the drive's last
  step**, so the Grammar journal in that world is one build behind: the GM is offered the sync at
  the next load. Left on purpose, as before: the world Items Strike (0.29.0), Stand, Grapple and
  Feint (0.28.0), Aid, Move Together and Pay It Forward. To try 0.30.0 there: drag Arrows from
  the Equipment compendium onto Tess, make a world weapon with the group Bows and the traits
  `Ranged 120` and `Reload 1`, put it in her hand in an encounter, Strike and Reload, and watch
  the Arrows row count down; write `[REACH 3]` in the Automation box of any Talent she owns and
  watch Natural Reach on the Overview.
- **0.25.0 leaves to the table or to Mike:** that the ally Aided by Pay It Forward is willing and
  that Aid's own requirements are met; "immediately after that check", read as the rest of that
  Opportunity (ruling 248), so a Move or another Maneuver between the check and the Aid is not
  seen; a used Effect whose holder has no responsible client connected when its Opportunity ends,
  which stays listed, dimmed and held for nothing, until the encounter ends; a parent row that
  costs one or two, which posts its spend card beside the subordinate's card (two cards, as any
  rolled Maneuver since 0.23.0; Pay It Forward at ⓿ posts one); the button on an Attack card,
  which appears once for each defender of one roll, the limit refusing the rest; and the Threshold
  the free Aid opens on, typed in the picker as for every Aid.
- **0.24.0 leaves to the table or to Mike:** Move Together's declared routes, its order (you,
  then the ally), "can perceive your cue" and the ally's willingness; a mistaken use, which cannot
  be taken back (the once-a-round mark stays for the round); a short Move forced by the Maneuver
  using up a once-a-round Speed bonus; the `PERMIT` line switched Off on the Effects tab, where
  the click still pays and nothing is permitted; a GM who repositions the ally in that
  Opportunity, which uses the permission and charges the ally; arrow-key nudges, each its own
  movement, so the first is the Maneuver's Move; a record whose holder has no responsible client
  connected when its Opportunity ends, which stays until the encounter does. **The ruler's label and colours
  for a Maneuver's Move were not seen on screen** (core's ruler needs real pointer waypoints,
  which the hidden pane cannot give): they were checked through `maneuverMoveOf` and
  `asManeuverMove`, the helper the ruler and the charge share.
- **0.23.0 leaves to the table or to Mike:** Interact's row pays ❶ while a draw or a stow from
  the Equipment tab pays its own, so it is two doors with one price (Gain Control's row was the
  other such pair until 0.27.0 made it roll); the Pass row Passes since 0.23.1, and its "Once per
  round" is counted by nothing, on the row or on the other two Pass controls; a Leap and a Squeeze
  are charged by the drag as the Move it measures; Grapple prints ⓿ with an Athletics check against
  Evade, which reads like a slip in the sheet; "Track the six-action round" gates movement and the
  sheet's Maneuvers and nothing else, and whether it should gate Strikes, Casts and Reactions is
  his; a defender whose token is deleted in the middle of an attack leaves a row nobody can answer
  (the GM's Cancel clears it); a roll dialog left open over a cancelled attack still charges a
  Reaction if it is then rolled; Clear Chat Log was not pressed in the live drive (card deletion,
  alone and in a batch, was); one user in two tabs can close and reopen an attack made outside an
  encounter (whether another client holds it is asked by user, not by session). **Rows with a
  Trigger and no Reaction trait are charged as plain Maneuvers since 0.23.0**: Battle Cry, Lost in
  the Dark, Reliable Anchor, Steady the Line and Sure Seat ship at a cost of one with no ↺ in the
  sheet (Quick Tongue too, spared by its card button; No Quarter and Grab an Edge at ⓿), so each
  pays ❶ from its row and is gated off-turn; a ↺ in the row's Cost cell is Mike's to write, and
  the same holds for any row whose empty Cost cell reads as one action. A row printed with a cost
  and a Reaction half ("❶ (⓿↺)") pays the half and never the cost: an open decision.
- **0.19.0 leaves to the table or to Mike:** (a Form Bind control and Close ❶ as a Maneuver,
  both declined then, are built since 0.27.0); the out-of-turn permit is
  one Maneuver this round and a player with no GM connected waits; the glance shows an adversary's
  gear by name and never its numbers, which the GM may want a setting for; the Token HUD's
  counter-scale is capped at 4×, and the pane's smallest zoom (0.57 on the test scene) was the only
  one driven.

Cleared 2026-11-19 (a Maneuver's check is declared, system 0.34.0; rulings 337 to 349 in the
0.34.0 changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions by question:
the word is CHECK, `or` is whoever it affects, buttons on a chat card, players always roll
against adversaries, a typed number for each Skill): the check a Maneuver rolls, guessed by the
build from the row's Constellation column and its Effect's prose, now declared on the row as
`[CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>]` (the `check` kind, the
twenty-fifth, with no hook), with the guess kept for a row that has no block; "vs. Evade or
Guard" read as Evade alone, now the target's pick by buttons on a request card; a row naming two
Constellations rolling nothing, now the user's pick in a short window; a fixed Threshold, now
`vs 15`; "vs Evade" against a target that cannot use Evade read against Awareness in silence,
the last place the system chose a Defense, now read against Evade and said; an adversary's
Maneuver that could only be shown, now used from its sheet, rolled by the player against the
adversary's typed number when it is used on a character, and by the GM otherwise; an
adversary's row applying nothing by degree, now applying from its result card. Also recorded:
ruling 277 is Mike's ("Keep as is": Close is the Controller's Step alone). Checked by 245
self-test checks, `node --check` on every module, `build_all.mjs --check`, the style check (one
failure, the em-dash in Dwarf Lore B13), the smoke test, `build_foundry.mjs --no-compile` (the
Grammar journal alone moves; the 120 action documents byte for byte as they were), an
independent review by two readers (nineteen findings, one high: a request's author was never
checked, so a player could have the GM's client post an adversary's result; all mended but
three stated) and live in the test world with a GM tab and a player tab, before the review and
again for its mends (the 0.34.0 changelog entry lists what, and what was not driven). Not
built, and next by his word: Gain Control in the grammar, with one word for Bind results; then
the words for what a Condition forbids and how it fades. The release carries the kind alone:
the 32 cells are his to paste, and his four workbooks were not converted, built, staged or
written. No handbook moved and `data/SYNC.json` is untouched. Committed on 2026-11-19 at his
word and tagged `v0.34.0`, his edits to the four workbooks and the v4.24 draft left out; not
pushed until he says.

Cleared 2026-11-18 (the Conditions workbook, system 0.33.0; rulings 322 to 336 in the 0.33.0
changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions by question: the
workbook is the only authority, adversaries too, Conditions only for now, a new row makes a new
Condition, Drop Flat's +4 alone, commit 0.32.1 first): the Conditions as a fixed table in code
with their effects written by hand in four files, now `data/conditions.xlsx`, a live registry
over the built-ins, and a carrier for each Condition a creature has, read by the `bonus` kind's
existing hook; a Condition's text kept twice and disagreeing, now the row's Description
everywhere; Prone changing no number, Grabbed, Restrained, Blind and Unconscious not making a
creature Off-Guard, now each counting as what its row includes; Supine as a label, now a
Condition a row made; Wrong-Footed doing nothing, now Off-Guard against the creature that
applied it; an adversary's numbers untouched by any Condition, now moved, with the typed number
kept in the field and the one in effect beside it; a new Condition as a code change, now a row;
Drop Flat's Prone at the reveal, now after the pairing resolves; a reroll reading a hidden
Threshold as the creature stood at the reroll and with no Threat, now meeting the number the
first die met. Mended on the way, older than the release and found by the live drive: a
rerolled Strike listed its bonus against that defender twice and left it out of the total
(since 0.31.0). Checked by 235 self-test checks, `node --check` on 178 modules, `build_all.mjs
--check`, the style check (one failure, the em-dash in Dwarf Lore B13), the smoke test on the
rebuilt app, the Conditions build run for real with no other workbook opened, the full
pipeline's path through the Conditions step run in a scratch copy of the generated files, an
independent review of the finished change (no crash and no double count; twelve findings of
medium to low severity, all mended but the few stated under Known outstanding work), and live in
the test world with a GM tab and a player tab after a restart of Foundry, before the review and
again for its mends (the 0.33.0 changelog entry lists what, number for number, and what was not
driven). Not built, and said so: the words for
what a Condition forbids and how it fades, and the named Effects sheet (0.34.0). His four
workbooks were not converted, built, staged or written. No handbook moved and `data/SYNC.json`
is untouched. Committed on 2026-11-18 at his word and tagged `v0.33.0`, his edits to the four
workbooks and the v4.24 draft left out; not pushed until he says.

Cleared 2026-11-18 (Stand's two lines and Supine as a named Effect, system 0.32.1; no ruling):
"had no supine to take off" said on every Stand beside "is no longer Prone", now left out
whenever another line of the card did something; `supine` after APPLY and REMOVE in whatever
casing was typed, now the named Effect "Supine"; the bare word `supine` in REQUIRES always "no",
now true while the creature has that Effect, so Stand is listed for a creature Drop Supine laid
on its back. Checked by 227 self-test checks, `node --check`, `build_all.mjs --check` and live
in the test world as the GM (the 0.32.1 changelog entry: the five card cases and the Maneuvers
tab standing, Prone and Supine). The test world keeps a world Maneuver Drop Supine (flagged
`testFixture: "0.32.1"`) beside 0.32.0's fixtures, its Stand and Drop Prone carry the three
cells, its content is level with these sources (433 messages), and Foundry was restarted for
the 0.32.1 manifest and left running with the GM joined. His four workbooks were not converted,
built, staged or written; the three cells are his to paste. Committed on 2026-11-18 at his word
(his answer when the Conditions workbook was planned: "Yes, commit 0.32.1 first") and tagged
`v0.32.1`; not pushed until he says.

Cleared 2026-11-17 (a Maneuver puts Effects on, and takes them off, system 0.32.0; rulings 311 to
321 in the 0.32.0 changelog entry; planned with 0.31.0 in `dazzling-floating-simon.md`, Mike's
decisions by question: APPLY and REMOVE, at once on yourself and a button for another creature;
then "Build 0.32.0"): Trip's Prone, Demoralize's Frightened and a Grapple's Grabbed, prose on the
card and put on by hand, now `[EFFECT APPLY: prone, target; IF: RESULT(success)]` on the
Maneuver's own row (the `apply` kind, the twenty-fourth, on the `applies` hook point, the
seventh) and a button on the check's card, written once by the creature's one writer with a
record card behind it; an overcommit's Off-Guard, by hand twice, now landing on the roller as
the card is posted and going as its window closes; Stand and Drop Prone, cards only, now taking
Prone off and putting it on; a named Effect, made by hand, now applied by a row and tagged on
the Effects tab with who, what and until when; a result that depends on the actions paid, now
`IF: COST(<n>)`; "Wrong-Footed to you", now `IFT: EFFECT(wrong-footed, mine)`; a window's edge,
now written out after APPLY while a GIVE window reads as it did. Found by the live drive and
mended: a Combat on screen that the creature was no part of counted a window. Mended beside it,
older than the release and found by the review: `setCondition` merged onto a switched-off
Condition and left it off; the give card of a private roll was hidden from its roller. Checked
by 227 self-test checks, `node --check` on 177 modules, `build_all.mjs --check`, the style check
(one failure, the em-dash in Dwarf Lore B13), `build_foundry.mjs --no-compile` (the Grammar
journal alone moves), an independent review of the finished change (no crash, no double
application, GIVE's windows unchanged; eleven smaller findings, all mended but two parts that are
stated: a `SUBORDINATE` row's own APPLY lines, and a line on a row with an attack of its own) and
live in the test world with a GM tab and a player tab, before the review and again for its mends
(the 0.32.0 changelog entry lists what, and what was not driven: a table with no GM, a Skip or
an Off on an owned copy's line, a REMOVE by degree). Not built, and said so: an Effect that
carries its own lines, the Wrong-Footed Condition's own effect, ends that are events, several
targets from one card. The release carries the kind alone: the cells for ten rows are Mike's to
paste, his four workbooks were not converted, built, staged or written, and one pack document
moved. No handbook moved and `data/SYNC.json` is untouched. Committed on 2026-11-18 at his word
and tagged `v0.32.0`, his edits to the four workbooks and the v4.24 draft left out; not pushed
until he says.

Cleared 2026-11-17 (Effects read by name, system 0.31.0; rulings 305 to 310 in the 0.31.0
changelog entry; planned in `dazzling-floating-simon.md` with 0.32.0, Mike's decisions by
question: APPLY and REMOVE, at once on yourself and a button for another creature, the word
`effect` in front): a state that is no Condition, which nothing could name, now a named Effect,
any active effect on a creature by its name; `[REQUIRES ...]` asking only for Conditions and
fixed words, now also `effect <Name>`, `bind, <state>` and what a nearby creature has (`with`);
a bonus that waits on a Condition or an Effect, refused as "not read yet" since 0.25.0, now
`IF: EFFECT(<name>)` for the roller and `IFT: EFFECT(<name>)` for the other party; a check read
against one creature's Threshold knowing only its token, now the creature; the hover card stale
when a Condition changed under it, now following it and listing named Effects for the owner and
the GM; a player's hand-made effect silent, now an Adjusted card; Claude's wrong word to Mike
that the Bind's states had no REQUIRES words, corrected. Mended beside it, older than the
release and found by the review: an `INIT` line never reaching the default Initiative (since
0.13.0), an apostrophe inside parentheses opening a quote, and one Talent's lines on the attack
die and at the pairing both counting. Checked by 219 self-test checks, `node --check` on 174
modules, `build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13),
`build_foundry.mjs --no-compile` (the Grammar journal alone moves), a second reader on the design
before the plan was shown (nine corrections), an independent review of the finished change (no
crash and no double count; eleven smaller findings, eight mended and the rest stated) and live
in the test world with a GM tab and a player tab, before the review and again for its mends
(the 0.31.0 changelog entry lists what, and what was not driven: a full Strike clicked through
the Combat window, the hover card on screen, a LIMITED sheet). Not built, and next: 0.32.0, the
`apply` kind. Mike's four workbooks in progress were not converted, built, staged or written;
the equipment sheet, which he had saved with every row enabled after 0.30.0 was built, was
rebuilt with the equipment build at the commit (62 of 62 rows ship). No handbook moved and
`data/SYNC.json` is untouched. Committed with 0.30.0 in one commit, tagged `v0.31.0`.

Cleared 2026-11-15 (ammunition, `[REACH N]`, the equipment build and the workbooks' new names,
system 0.30.0; rulings 297 to 304 in the 0.30.0 changelog entry; planned in
`dazzling-floating-simon.md`, Mike's decisions by question: an equipment-only build, out of
ammunition warn and go on, `[REACH N]` set and adjust, recovery left to the table): ammunition
that did not exist, so a Reload never ran out, now Arrows, Bolts and Bullets from the Ammunition
tab of `data/equipment.xlsx`, a Reload taking one piece for each shot it loads and saying what is
left, loading anyway and saying so with none; Natural Reach as the Size's alone, now the
`[REACH N]` block (the `reach` kind, the twenty-third) read live off the Talents a character
owns; no way to build while the talent and action sheets cannot pass the content loop, now
`build_all.mjs --equipment` and `sync_equipment.cmd`, which built `data/equipment.xlsx` (3
ammunition Items in, Dagger, Shortsword and Spear out as his sheet says, 27 armor pieces given
their descriptions); tools and messages naming workbooks that were renamed, now the names of
today, the index tool reading the Category through the prefix and the converter knowing the
three actions workbooks by either name; the handbook's equipment tables, now gone from the book
and the sheet the only source (the HANDBOOK RULE's third part), the saved file compared (four
places, the four tables) and stamped with `--check --accept-phb`; Sync content writing new
content through older code, now refused. Mike's note that the Reload trait has words in the
book: agreed, nothing changed. Checked by 215 self-test checks, `node --check` on every module,
`build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of
`data/talents_ancestries.xlsx`), the equipment build run for real three times with no workbook
written, a second reader on the design (sixteen points: the guard, "per 10", the armor
descriptions, the stack order, the report's mode and the "not opened" claim corrected), an
independent review of the diff (no blocking defect; seven findings, five mended and two stated:
the guard cannot protect the release that introduces it, and a renamed duplicate of the pack's
Arrows is renamed back by a copies refresh) and live in the test world with a GM tab and a
player tab after a restart of Foundry (the 0.30.0 changelog entry lists what, and what was not
driven: a `[REACH N]` on a real Root, a world on 0.29.0 syncing 0.30.0's content). Not built,
and said so: recovery or any count of shots spent, merging stacks, ammunition and ranged prices
in the web app and the docx, reach rules on an adversary. The four workbooks Mike is still
editing were not converted, built, staged or written.

Cleared 2026-11-15 (Strike from the Maneuvers tab, loaded weapons, an Unarmed Strike for everyone
and "in sight", system 0.29.0; rulings 290 to 296 in the 0.29.0 changelog entry; planned in
`dazzling-floating-simon.md`, Mike's decisions by question: loading tracked fully, warn and go on,
count ammunition too as its own next step, give every character an Unarmed Strike now): the Strike
row that only showed its card, now three buttons, a chooser of what is in hand and the weapon
row's own Strike; a character with empty hands having nothing to Strike with, now the Unarmed
Strike every character has, always in hand and never in front of a real weapon; the Reload and
Capacity traits read into numbers nothing used, now a count on the weapon that a Strike in an
encounter uses and a cancelled attack returns; an empty weapon, now said and never refused; a
Reload row that asked how many actions and touched no weapon, now loading the weapon in hand at
that weapon's own cost, Prepared at three; "a foe you can see" written as `foe within 1000`, now
`foe in sight`, with `weapon loaded` and `weapon unloaded` beside it; the Strike pills dim until
hovered, now at full strength. Also recorded: Mike's saved v4.25 with the four Bind redlines
accepted and nothing else changed, compared with the committed file and stamped again. The plan's
one handbook redline was NOT made: the Reload [N] cell it called empty nests a table that already
says what the system does. Checked by 213 self-test checks, `node --check` on every module, the
style check (one failure, the em-dash in Dwarf Lore B13 of Mike's uncommitted workbook),
`build_all.mjs --check`, `build_foundry.mjs --no-compile` (one document moves, the Grammar
journal), a second reader on the design before the build (four guards adopted: stowing a fist
costs nothing, the fist is no loot, the glance leaves it out, Strike is the Maneuver's own
behaviour), an independent review of the diff (no blocking defect; two faults in how a shot was
counted and five smaller things, all mended but one stated: the shot's writer is now the
coordinator alone and "in an encounter" is membership, a weapon is held to one Strike at a time,
Reload is a character's built-in alone, the elected GM alone gives the fist, a full weapon is
stored as never set, the longest weapon is the reach weapon) and live in the test world with a GM
tab and a player tab, before the review and again for its mends (the 0.29.0 changelog entry lists
what, and what was not driven: a Riposte with the fist, a Committed ranged Strike, two GM clients
together, a player-created character). Mended beside it, older than the release: a Blow the GM
cancelled while viewing another Combat returned no actions. Not built, and said so: ammunition
(the next step), the Crossbow Fighting Talents, a Cast chooser. The release carries no content:
Strike's cell is Mike's to paste, his three workbooks were not converted, built, staged or
written, and one pack document moved.

Cleared 2026-11-15 (the Maneuvers tab, system 0.28.0; rulings 281 to 289 in the 0.28.0 changelog
entry; planned in `dazzling-floating-simon.md`, Mike's decisions by question: the conditions
written in the sheets, also hidden for the wrong mode, a cost that cannot be paid and not your
Opportunity, Favorites on the character): the cost glyphs of different sizes (⓿ from another font
than ❶ to ❻, and the "to" of a range drawn as large as the glyphs), now a drawn disc for each
number wherever a sheet marks a cost; the Maneuvers tab listing every Basic Maneuver whatever the
character could do, now the ones that apply, with a button for the rest dimmed and saying why; a
Maneuver's Requirements as prose nothing could check, now `[REQUIRES ...]` blocks on the
Maneuver's own row (the `requires` kind, the twenty-second, with no hook) and the engine's five in
code; Activities and Endeavors listed in an encounter, a Maneuver listed that could not be paid
for or was not the character's to perform, now left out; no way to keep a Maneuver to hand, now
Favorites on the character, first and never left out; the tab stale until the character's own
document changed, now watching the Combat, the scene's tokens, other creatures' Conditions and
the walls, and redrawing only when the list changed. Mended on the way: a feature keyword wrapped
in `[EFFECT ...]` told the list of tags; the Constellations toggle asking a LIMITED user's glance
sheet for a part it does not have (since 0.19.0). Checked by 206 self-test checks, `node --check`,
`build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of Mike's
uncommitted workbook), `build_foundry.mjs --no-compile` (one document moves, the Grammar journal),
an independent review of the diff (nine findings, none severe: eight mended, one of them in part,
and one stated; two more found and mended on a second read before it reported) and live in the test world with a GM
tab and a player tab, before the review and again for its mends (the 0.28.0 changelog entry lists
what). Not built, and said so: Size limits, cover, tools, mounts, hearing, a Reaction's Trigger,
Supine, a block on a Reaction Talent, the adversary sheet. The release carries the kind alone:
Mike's three workbooks were not converted, built, staged or written, the twenty-eight blocks are
his to paste, and one pack document moved. No handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-15 (the Bind, automated, system 0.27.0; rulings 269 to 280 in the 0.27.0
changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions by question: their own
movement, the shield exception, a free Gain Control roll after a Parry, the Quick Strike rule
kept, a Cast is an attack, a Failure makes the Bind neutral, and Form a Bind, an adversary's Gain
Control and momentary Control all built): no movement ending a Bind, now a fighter's own Move,
Step, Rush or Crawl ending it, with a Close and the larger of two far apart keeping it; the three
attack rules living in a character's weapon Strike alone, now one plan for every attack of every
source, decided once before the first result card; the Controller's own Strike losing the Zone it
opened, now the Zone kept on that card for its damage; Gain Control's row paying ❶ and showing
its text, now rolled and applied from the card, for a character and for an adversary; Close
charged twice, now the Step itself; a Parry's Stop taking Control outright (ruling 131), now the
Talent's free Gain Control where the Bind is neutral; no way to form a Bind but a card, now Form a
Bind on both sheets; Size and Binds unbuilt, now a momentary Control counted and the larger
fighter's movement kept; a new Zone on a standing Control never reaching a partner the writer
did not own; an adversary's flat roll never taking the Controlled -2; FEATURES saying a partner
needs its owner's click. Four tracked changes in v4.25 itself (`PROPOSALS["bind"]`, the file
before them in `backup/pre-0.27.0/`), stamped with `--check --accept-phb`. Checked by 195
self-test checks, `node --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of
Mike's uncommitted workbook), `build_all.mjs --check`, a second reader on the design before the
plan was shown (the plan once per attack, the id-guarded end, the strict mirror, the windows in
the sweep), an independent review of the diff (seven findings, none in the attack or movement
rules, all mended: an old Gain Control card offering its result again, the adversary's Threshold
printed for a GM roller, a double-click rolling twice, a blind roll acted on, an adversary's move
ending a Bind unsaid to players, the Off-Guard with nothing to end it outside an encounter, the
plan written after the ends) and live in the test world with a GM tab and a player tab, before
the review and again for its mends (the 0.27.0 changelog entry lists what). Not driven: a Cast, a
blind Gain Control roll, a reroll of a Gain Control card, a table with no GM. Mike's three
workbooks were not converted, built, staged or written, and no pack document moved.

Cleared 2026-11-15 (N/A in an Automation cell, system 0.26.1; no ruling; planned in
`dazzling-floating-simon.md`): an `N/A` cell painted red by the red-cell tool and listed in the
build report as an unknown rule kind, `NA`, `N.A.` or `[N/A]` stopping the release build, and
`N/A` typed into a world Item's Automation box stored as an error, now a line the grammar skips
as it skips a comment, a cell the build reads as empty, and a count of its own in the red-cell
tool's report; `N/A` beside rules, now a warning with the rules standing. Also recorded: Mike's
saved v4.25 with all fourteen tracked changes accepted and three edits of his own, compared with
the committed file and stamped again. Checked by 186 self-test checks, a dry run of the red-cell
tool on the saved workbooks (152 cells, one already marked N/A, none of them called unreadable,
nothing written), `node --check`, the style check (one failure, the em-dash in Dwarf Lore B13),
`build_all.mjs --check`, and live in the test world. Mike's three workbooks were not converted,
built, staged or written.

Cleared 2026-11-15 (the PHB v4.25 sync, system 0.26.0; rulings 252 to 268 in
`v4.25-sync-report.md`; planned in `dazzling-floating-simon.md`, Mike's decisions by question:
every multi-target attack rolls once per target, multipliers where two effects meet, the
Subordinate rule in Chapter 8; then on the plan's first draft: redline the Word file itself,
templates in this sync, one Reaction at a time left to the table, the Critical Hit effects
tracked with the Arms' −2 stacking; and his Supine rules sent while it was being built): the
handbook drift every build had reported since v4.25 landed, now synced and stamped; "the
handbook wins" for a Talent's or a Maneuver's own text, now the spreadsheets as their only
source, the HANDBOOK RULE in two halves; a player attacker's one die read against every
defender, now one die for each, queued one at a time on the roller's client, stale only against
its own reveal, with a Roll button on each row of the card and a task for each in the Combat
window, a reroll one pairing's, and a Prepared Committed Strike keeping every target;
multipliers applied in sequence (overlapping Difficult terrain ×4, a half-pace Activity over
Difficult Terrain a quarter), now combined where two effects meet; the Arms, Legs and Head
Critical Hit effects "for the table to hold" and a Torso Off-Guard nothing ended, now a mark on
each Zone the system computes from and Recenter ends, with a switch on both sheets; a Torso
Wound's bleed hidden beside another bleed, now listed; no use of Foundry's templates, now the
tokens inside one becoming its maker's targets; the Subordinate Maneuver rule with no sentence
in the book, the v4.24 Preparing redline never merged, the cover's v4.23, the Modifiers
fragment, "a Endeavor", a Golarion people in Chapter 3 and Supine's empty cell, now fourteen
tracked changes in v4.25 itself (`phb_propose.py --in-place`, the untouched file in
`backup/pre-0.26.0/`); `check_style.py` reading a proposal file as the edition. Checked by 184
self-test checks, `node --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of
Mike's uncommitted workbook), the smoke test on the rebuilt app, the redline diffed against its
backup, a second reader on the attack-flow design before the plan was shown (eleven
corrections), an independent review of the diff (no defect in the attack flow; six findings
elsewhere, none blocking, all mended: a player's template naming tokens they cannot see, a silent
manual switch, the Torso's Off-Guard taking the GM's own with it, a Head Critical Hit called a
Head Wound, a backup folder that was the edition's own, impassable and free terrain in an
overlap) and live in the test world with a GM tab and a player tab, before the review and again
for its mends (the 0.26.0 changelog entry lists what). Not built, and said so: a Talent that
"specifies otherwise", a spell's own area, telling an area Attack from another, Supine and Roll
Over, Chapter 6 from the sheets. Mike's three workbooks in progress were not converted, built,
staged or written; the stamp was made with `--check --accept-phb`.

Cleared 2026-11-15 (Pay It Forward, the Subordinate Maneuver rule and the first named Effect,
system 0.25.0; rulings 245 to 251 in the 0.25.0 changelog entry; planned in
`dazzling-floating-simon.md`, Mike's decisions by question: a general Subordinate Maneuver rule
with the tag word SUBORDINATE, named Effects in two steps, the recipient anyone but you, no
trigger refused, and Pay It Forward before the v4.25 sync): Pay It Forward, of which nothing was
automated and whose text was in no file of the repository, now `[EFFECT SUBORDINATE: Aid; IF:
EFFECT(Aid, used); LIMIT: encounter]` on its own row (the `subordinate` kind, the twenty-first, on
the `use` and `card` hook points): a roll at your own Opportunity that uses up another creature's
Aid leaves the Effect "Aid from Wren (used)" for that Opportunity, the card of that roll and the
row both open Aid's own roll at the row's cost, and nothing is spent until that roll is made;
Reciprocal Effort's `# PROPOSED` cell, which the grammar could not say, now `[EFFECT ALTER: Pay It
Forward.limit; VALUE: round]`, `ALTER`'s eighth property, which `permit` honours too. Mended on
the way: a use the rules refuse asked the GM for leave first when made off-turn; a card's rule
button outlived its offer. Checked by 176 self-test checks, `node --check`, the style check (one
failure, the em-dash in Dwarf Lore B13 of Mike's uncommitted workbook), `build_foundry.mjs
--no-compile` (one document moves, the Grammar journal), `build_all.mjs --check` (exit 1 on
handbook drift alone, v4.25 unsynced; the stamps, the barrel and the grammar gate pass), an
independent review of the diff (seven findings, none blocking, all mended) and live in the test
world with a GM tab and a player tab, before the review and again after its mends, the cards and
the Effects tab seen on screen (the 0.25.0 changelog entry lists what). Not built, and said so in
the changelog: named Effects, step two; a built-in, a Strike, a Cast or a movement row as the
subordinate; a Prepared parent; two subordinates on a row; a subordinate chosen at use; one Aid
for several allies. The release carries the kind alone: Mike's two workbooks in progress were not
converted, built, staged or written, three things are his to add (Aid's `GIVE` lines, Pay It
Forward's row, Reciprocal Effort's cell), and the pack content did not move. No handbook was
synced: v4.25 is on the shelf and `data/SYNC.json` is untouched.

Cleared 2026-11-14 (Move Together, and the Talent that changes it, system 0.24.0; rulings 239 to
244 in the 0.24.0 changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions by
question: pay at the click, a Move however short unless the Talent, warn and go on, the tag word
PERMIT): Move Together, of which nothing was automated and whose ally waited for the GM to
approve an off-turn drag, now `[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]` on its own row
(the `permit` kind, the twentieth, on the `use` hook point): ❶ at the click on the Maneuver's own
card, the user's next drag that Move already paid, the ally's drag with no request and ❶ of its
own, each a Move however short, the refusals and the warnings, one record on the user that ends
with its Opportunity; Coordinated Footwork's `# PROPOSED` cell, which the grammar could not say,
now `[EFFECT ALTER: Move Together.movement; VALUE: step]`, `ALTER`'s seventh property; the ruler
pricing through the helper the charge uses. Mended on the way: a bent off-turn drag stopped at
its first waypoint already charged for the whole path (since 0.19.0); the GM's approval used up
by a drop the cap refused; a use rule's Item gating before its refusal, announcing its spend on a
second card and ignoring `trackActions`. Checked by 168 self-test checks, `node --check`,
`build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of Mike's
uncommitted workbook), `build_foundry.mjs --no-compile` (one document moves, the Grammar journal),
an independent review of the diff (eight findings, none high, all mended) and live in the test
world with a GM tab and a player tab, before the review and again after its mends (the 0.24.0
changelog entry lists what). Not seen: the ruler's label and colours on screen. Not built, and
said so in the changelog: the declared routes and their order, "can perceive your cue",
willingness, a use taken back, anything permitted but a Move. The release carries the kind
alone: Mike's two workbooks in progress were not converted, built, staged or written, the two
cells are his to paste, and the pack content did not move. No handbook moved and
`data/SYNC.json` is untouched.

Cleared 2026-11-14 (the Pass row Passes, system 0.23.1; no ruling; planned in
`dazzling-floating-simon.md`, Mike's decision by question: say why and do nothing when a Pass is
not possible): the Pass ⓿ row of the Basic Maneuvers, which only put its card in chat and so read
as a Pass that was not one, now the actor's own Pass through the built-in table. Checked by 158
self-test checks, the gates, and live from the row as the GM and as a player (outside an
encounter, off-turn, at the Opportunity with a double-click, a full circuit ending the round,
while Preparing, the speech bubble, and the sheet's and the tracker's Pass still working). No
handbook and no data moved.

Cleared 2026-11-14 (a Maneuver pays its own cost, and the Combat window forgets old attacks, system
0.23.0; rulings 231 to 238 in the 0.23.0 changelog entry; planned in `dazzling-floating-simon.md`,
Mike's decisions by question: Combat end or card deleted, ask each time, Prepared by the book, the
name pays): "Using a Basic Maneuver from the Maneuvers tab spends nothing by itself", the system's
rule since the tab existed, now a Maneuver used in an encounter paying the cost its row prints
(when the roll is made; at once with the line on its own card when it has no roll; after a pick
when the row prints a range; as a Prepared Maneuver finished from its own Item when it costs three
or more), with the rows the system pays another way saying so and paying nothing; every unfinished
attack card revived at every reload and opened in the Combat window, however old, now resumed only
in the Combat it was declared in (`combatId` on the record, `AttackWorkflow.expired`), the rest
closed on the elected client at load, which also closed the cards earlier versions left; an attack
that outlived its Combat or its chat card, now cancelled with the one and dropped with the other,
the card never written back; no way for the GM to end an attack stuck where the GM had no task,
now Attacks in progress with Cancel under the tasks; the Defense picked before a Reset defenses
coming back ticked, now forgotten once committed; the refund after a Combat's end decided by which
Combat was viewed, now never given there. Fixed on the way: the Opportunity card's raw "{name}",
"1 spent" and "the action spent is lost" on the Prepared cards, FEATURES saying Cancel keeps the
spent actions and naming system 0.21.0, the `trackActions` hint claiming more than the code does,
and three older defects the review found beside the change (every Talent's and Maneuver's
`migrateData` throwing since 0.17.0 for want of an import; Commit doing nothing for Drop Flat and
Kneel Behind the Shield; two language keys written twice). Checked by 157 self-test checks, `node
--check`, `build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of
Mike's uncommitted workbook), `build_foundry.mjs --no-compile`, an independent review of the diff
(nine findings, none high, seven mended and two stated) and live in the test world with a GM tab
and a player tab, before the review and again after its mends, the bug first reproduced there on
0.22.0 with three attacks left unfinished (the 0.23.0 changelog entry lists what). Not driven: Clear Chat Log itself. No handbook moved and `data/SYNC.json` is
untouched; Mike's two workbooks in progress were not converted, built, staged or written, and the
pack content did not move.

Cleared 2026-11-14 (what a Maneuver gives, and the Talents that change it, system 0.22.0; rulings
223 to 230 in the 0.22.0 changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions
by question: the ally's Constellation named separately, a button on the card, Patient Assistance on
a Success and a Critical Success, the penalty's window a bonus's): Aid's +1 to +4 for the ally and
its -1 on a Critical Failure, prose on the card and applied by hand, now five `GIVE` lines on Aid's
own row (the `give` kind) read through the `gives` hook point, the sixth (`ruleGives`), into a
table of results by degree on the check card's flags; Patient Assistance's and Sure Assistance's
`# PROPOSED` cells, which the grammar could not say, now `[EFFECT ALTER: Aid.beneficial-duration;
VALUE: recipient opportunity 2]` and `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]` (the
`alter` kind), with `UNTIL:` and `VALUE:` each read after its own tag alone; the result given by a
button on the card for the aider's owner and the GM (`module/documents/cards/give.mjs`), in one
click to the character targeted or through a dialog, written by one client for a recipient (the
GM's, else the recipient's player's) and asked of it as `give:apply` from any other; one result of
a Maneuver pending on a character
(`flags.starwrought.rules.given`), used by its next roll with the Constellation and never part of
a Threshold; its window counted on the entry and settled on the turn change, with the turn step a
circuit of Passes takes left out; the Effects tab's Pending results, read-only, the bin the GM's.
Fixed on the way: a reroll of a check made from a compendium Maneuver read the pack's index entry
in place of the Item; `onTurnChange` read core's `previous` and `current` after its awaits; a
`reroll` rule's button drawn for a roller on their own blind roll; the rules README's "None exists
yet" of triggered hook points. Checked by 153 self-test checks, `node --check`, `build_all.mjs
--check`, the style check (one failure, the em-dash in Dwarf Lore B13 of Mike's uncommitted
workbook), `build_foundry.mjs --no-compile` (one document moves, the Grammar journal), an
adversarial review by two agents (fourteen findings, none high, twelve mended and two stated as
limits) and live in the test world with a GM tab and a player tab (the 0.22.0 changelog entry
lists what). Not built, and said so in the changelog: Carry
the Plan's two uses, Pay It Forward, a Condition given by a result, a give from a Maneuver with no
check, an adversary as the recipient, the other ALTER properties, a Threshold Aid opens on. The
release carries the kinds alone: Mike's two workbooks in progress were not converted, built,
staged or written, the three cells are his to paste, and the pack content did not move. No
handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-10 (the USE tag and the substitute kind, system 0.21.0; rulings 215 to 222 in the
0.21.0 changelog entry; planned in `dazzling-floating-simon.md`, Mike's decisions by question:
offered and ticked when better, only from Aid, the kind alone): Cooperative Instinct's "Presence +
Origin proficiency in place of the Attribute and proficiency normally used for that Aid check",
which the grammar could not say, now `[EFFECT USE: Presence, Origin, aid]`, the `substitute` kind
(`module/rules/kinds/substitute.mjs`; three descriptors, `same` for a term the check keeps, every
slip refused with what to write) on the `substitutions` hook point, the fifth (`ruleSubstitutions`
in `module/rules/engine.mjs`); a check rolled with its own two base terms and no others, now
assembled once with them and once with each candidate, the strictly highest total standing by
default (`module/dice/check/substitute.mjs`, `chooseVariant`; `cfg.substitute`,
`cfg.substituteVariants`, `cfg.substituted`), the swap offered in the roll dialog from the
Maneuver's own Item alone, said on the card and kept in its flags (`substituted`, `attribute`,
`rank`), marked in the Relevant Check picker and switched On / Skip / Off on the Effects tab; a
bonus to a Maneuver lost on a check rolled with a Defense Constellation from that Maneuver's Item
(Humanity's +1 on an Aid made with Awareness), now applied (ruling 222); the marks of the boxes
left ticked dropped when the roll dialog rebuilt the roll (an armed claim not spent, a one-roll
custom effect not removed), now kept and written once; a kind's own name typed as a line told "is
a feature", now told its tag; `bonus`'s and `reroll`'s two copies of the reading of a target's
name, now `readTargetName` in `module/rules/operators.mjs`; a one-roll custom effect or a Skip on
a bonus to a Maneuver spent by a Wind roll that neither applied nor offered it, now left alone
(`callHook` counts applied answers only); the roll dialog's other offers drawn for the variant it
opened on alone, now following the swap box. Checked by 133 self-test checks, `node --check`,
`build_all.mjs --check`, the style check (one failure, the em-dash in Dwarf Lore B13 of Mike's
uncommitted workbook), the red-cell tool run dry (Cooperative Instinct's cell reads),
`build_foundry.mjs --no-compile` (one document moves, the Grammar journal), an adversarial review
by sixteen agents (ten findings, none high, all mended) and live in the test world with a GM tab
and a player tab (the 0.21.0 changelog entry lists what). Not
built, and said so in the changelog: a Constellation as the check a USE names, offers on plain
checks, `IF: UNSUBSTITUTED`, a flat Proficiency Bonus, `FOR` and auras, `CLAIM`, Aid's own outcome
bonus. The release carries the kind alone: Mike's two workbooks in progress
(`data/ancestries.xlsx`, `data/maneuvers.xlsx`) were not converted, built or staged, and the pack
content did not move. No handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-08 (the PHB v4.24 sync, system 0.20.0; rulings 205 to 214 in `v4.24-sync-report.md`;
planned in `lucky-kindling-walrus.md`, Mike's four decisions by question: two actions now with a
redline, the row's Type with an index tool, every ungranted Maneuver basic, skills.xlsx's Lore
sheet): the converter refusing `data/maneuvers.xlsx` over its renamed index and ignoring
`activities.xlsx` and `endeavors.xlsx`, now reading all three as Mike wrote them (the Type column
optional, nine new columns carried, the name column Action, Activity or Endeavor); the
`_Tree Index` tabs, now regenerated by `assets/index_sheets.py` (52 rows added across four
workbooks, the seven Skills with their attributes from the book); the roster's `explorationActions`
and `downtimeActions` blocks, now the two workbooks' rows under the same document ids;
Preparing's one action, now two; the `basic` flag reading a Type that no row carries, now every
ungranted Maneuver; the Lore template in a deleted workbook, now skills.xlsx's sheet with the
placeholder stripped; the five Backgrounds training "Investigation", the Stealth row misnamed
"Lost in the Noise", the Necromancer's 6, the Merchant's em-dash, all brought to the book; and the
pack sources, last written 2026-11-05, now carrying the Dwarf, Elf, Gnome, Halfling, Cairnward,
Lethra and seven Skill Constellations Mike authored since. Checked by 112 self-test checks, the
content loop (8 red cells of 137, the genuine slips), the smoke test, the style check, the slow
release steps run one by one and the test world (the 0.20.0 changelog entry and the report say
what). `data/SYNC.json` is stamped v4.24 with `--check --accept-phb`; the release pipeline with
no flag stops at `parse_rules` on the first red cell until Mike mends them.

Cleared 2026-11-05 (the code review of 0.15.0 to 0.18.0, system 0.18.1; Mike: "do a thorough code
review for mistakes, duplications, AND for performance improvements", then "Fix all 21"; the 0.18.1
changelog entry lists every finding and its fix): a Skip spent by a chat render, now spent at the
event; a ticked claim on a one-roll custom effect leaving the row, now spending it; another
owner's mark dropped when unwritable, now relayed over the system socket; a removed row's armed
flag, now cleared; a `]` inside CLAIM text, now read; the legacy test's two stray words; the
terrain row's cost, now applied on pick; the terrain file's cache key; the tracker's burst
rendering and the flag-write re-renders; the startup fetches, the Maneuver grant's index, the
effects re-parse and the journal lookup; the three duplications under one helper each; the four
simplifications; the unnamed Lore's migration. Checked by 112 self-test checks (three new), the
content loop, the smoke test, the style check and live (the 0.18.1 changelog entry says what). No
handbook moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-05 (the aura carries its effect, terrain kinds as data, a Lore named when it is
Trained, system 0.18.0; rulings 195 to 198 in the 0.18.0 changelog entry; planned in
`eager-wobbling-possum.md`, the sixth plan, Mike's decisions by question: the effect inside the AURA
block, the terrain kinds a roster block): the Rally Aura's duplicated "15 feet, allies", now one
block with the ring as the effect's FOR; the bare effect line and `visible`, refused as promised;
the ten terrain kinds in code, now the roster's `terrainKinds` block through a registry the
behavior, the grammar, the ruler and the overlay read; a Lore point spent into the unnamed
template, now a name asked in the wizard, on a drop and from the Constellations row, with Next
held until it is given. Checked by 109 self-test checks, the content loop, the smoke test, the
style check and live (the 0.18.0 changelog entry lists what; a second GM session on the old code
is the one thing seen that was not a defect). No handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-05 (every line in brackets, the Grammar journal, the sheets' UI pass, system
0.17.0; rulings 189 to 194 in the 0.17.0 changelog entry; planned in `eager-wobbling-possum.md`, the
fifth plan, Mike's decisions by question: `[EFFECT ...]` as FG's own form, the Active Effects tab
off the data Items only, `visible` retired): Mike's seven points after the 0.16.0 push, each
built: `[EFFECT ...]` blocks with the bare line's one release of grace and the 0.13.0 form refused;
the grammar document as a journal in the Rules pack with a Grammar button where a line is typed;
Edicts, Anathema and a Notes tab; the Effects panel on the Effects tab with Apply to next roll on
claim lines; every aura preview-only until shown; the Talent name as the click and the hover; the
Item window reordered, fitted and without its empty tab. Checked by the self-test, the content
loop, the smoke test, the style check and live (the 0.17.0 changelog entry lists what). The Human's
five cells in `ancestries.xlsx`, bare at the tag because Excel held the file, were wrapped in the
follow-up commit. No handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-05 (the grammar in Fantasy Grounds' shape, system 0.16.0; rulings 182 to 188 in
the 0.16.0 changelog entry; planned in `eager-wobbling-possum.md`, the fourth plan, Mike's decisions
by question: both FG layers in FG's shape, the chassis as feature lines with the columns retired,
Talent Maneuvers as rows with an Effect marker that reproduces the Maneuver, FG's Character Effects
field): the 0.13.0 operator grammar, now feature lines in brackets and effect lines of a tag and
components (`features.mjs`, `effects.mjs`; the stored shapes and the four hook points unchanged;
the old form read one release with a warning); the chassis columns and the Choice and Free Talent
columns, now the Root's blocks, parsed once by `assets/parse_rules.mjs` for every consumer; the
Steady the Line, Oathbound and Quick Tongue Talents, now `[MANEUVER X]` over rows of the new Talent
Maneuvers sheet, granted and removed with the Talent, used from the Actions tab's From your Talents
panel with the row's cost, and printed into the Talent's Effect by `@Maneuver[X]`; `[X trained]` as
the wizard's directed point; the Overview tab's Effects panel with On / Skip / Off, custom effect
lines with three durations, and the tracker's badge; the grammar-document gate over every tag,
component, condition and keyword. Four defects found live and fixed before the tag: the client's
category key unread by `grant` (a Sync content re-parse had made every Trained Root an Opening
point), the copies refresh blind to a name whose glyphs left (now `nameKey`, glyph-free), the
Weaponmaster step's doubled free Training, and a duplicate `Chargen.trainedIn` i18n key. Checked by
103 self-test checks, the content loop (`rules: 63 rules on 33 cells (15 kinds in use)`;
`automation: 36 rules on 21 documents`), the smoke test, the style check and live (the 0.16.0
changelog entry lists what). Foundry was restarted for the manifest; the test world keeps its
0.15.0 fixtures and now has the three Maneuvers on Tess and Wren. No handbook moved and
`data/SYNC.json` is untouched.

Cleared 2026-11-05 (the two Cultures, system 0.15.0; rulings 174 to 181 in the 0.15.0 changelog
entry; planned in `eager-wobbling-possum.md`, the third plan, Mike's decisions by question: both the
checkbox and the arm button, Intimidation automated and the rest claimed, difficult terrain built
into the maps as regions): the Bloodline card and every Root-based card printing the Talent's
Description; the Cultures given the Ancestry's treatment (the generated `cultures` block with the
index's `Languages` column, the chassis's Lore, the app's and docx's per-Culture sections, the
wizard's Culture Lore panel); the eight cells written in `data/cultures.xlsx`; `CLAIM` with the pin,
`MARKED` with `mark` and the `use` hook point, `reroll` with `IF(Outcome=...)` and the `card` hook
point, `AGAINST(<Constellation>)` with the check that reads a target's Threshold live, `Speed`, and
`ignore: Terrain` with the Difficult terrain region behavior, the terrain data, the ruler's label
and the player's overlay; the engine's `other` party per Defense roll, Threshold read and Strike
pairing; the Defense tooltip listing the rules the sheet's number leaves out. Checked by 100
self-test checks, the content loop (`automation: 23 rules on 17 documents (7 kinds in use)`), the
smoke test, the style check and live (the 0.15.0 changelog entry lists what). No handbook moved and
`data/SYNC.json` is untouched.

Cleared 2026-11-05 (the level-1 Human, whole, system 0.13.0; rulings 164 to 169 in the 0.13.0
changelog entry; planned in `eager-wobbling-possum.md`, Mike's decisions by question: one grammar
shown as a plan first, logical operands and comma shortcuts, prevent and protect one kind, grants
into Automation, one release): Mike's renamed columns read (`Primary Attribute`, `Attribute` with a
blank cell an error, Prerequisites as the requirement when Requires is empty, unknown headers
warned); the `Human Lore` sheet read and shown on the Ancestry's Description tab and under the
highlighted card in Character Creation, Special Ability off an Ancestry, Languages only on a
Culture; `AUTOMATION_GRAMMAR.md` written first and the build holding the code to it; the operator
grammar (`operators.mjs`) with `bonus` rewritten to it, `grant` and `aura` replacing the retired
columns, and `prevent` as the first triggered kind with the `prevent` hook point (`setCondition`,
the token palette's `preCreateActiveEffect`, the Expose widget's Reaction button); the engine
reading other tokens' `FOR` rules through `scene.mjs` and remembering `FIRST`/`ONCE` marks; the
sheet's Threshold position-blind and the prompt, the card and every roll reading the map, the
Threat and the round; the nine Human Talents' cells written (13 rules on 9 documents); the Key
Terms Threshold sentence proposed in `Starwrought_Players_Handbook_v4.21_thresholds_proposal.docx`.
No handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-11-05 (no Defense is ever chosen by the system, system 0.12.0; rulings 159 to 163 in
the 0.12.0 changelog entry; planned first in `eager-wobbling-possum.md`, Mike: "Plan it... BUT no
applying a default, ever: The Attack Flow should not be an option to turn off... it is critical to
the functioning of the system", and by question: with no GM an adversary's Blow waits, and spells
come into the flow in the same change): the standing stance (0.4.2 to 0.11.0: `system.stance`, the
header chips, the HUD button, the whispered card, `helpers/stance.mjs`, `setStance`,
`answeringDefense`, `SwCheck.#readDefender`, `LEGACY_STANCES`, the GM's "Answer with standing
stances", the no-GM auto-commit, the silent Evade fallbacks) gone with a migration step deleting
the field; the `attackFlow` setting gone; the prompt opening with nothing selected and the GM's
explicit rows for absent players; Intercept (a character's and an adversary's) and the Riposte
declaring as Reaction Strikes answered by a basic Defense alone, the Intercept answer card and the
dead Counter button gone; a Cast declaring with the Threat's two Defenses offered, resolved with
no Strike and rerolled as a spell card, a Prepared Cast keeping every target; and the coordinator
split into `attack-socket.mjs`, `attack-source.mjs` and the coordinator, with `profileFor`,
`waitingForGm` and the record's `source`, `reaction`, `basicOnly`, `threat`, `defenses`, `spell`.
Checked by ten new self-test checks (74 pass), the content loop, and live (the GM tab and a
player tab: the migration notice and no `stance` left on any actor; no chips and no HUD button;
a Strike's prompt with nothing selected and Commit disabled until a pick; the GM's absent-player
row; the no-GM wait and the prompt on the GM's return; a character's and an adversary's Intercept
and a Riposte as Reaction Blows with two Defenses and no answers; a Quick Cast's prompt offering
Evade and Endure, a Focused Cast Prepared and Finished against two targets with one die and two
cards, the spell's damage buttons and a reroll). No handbook moved and `data/SYNC.json` is
untouched; the rulings are system decisions, recorded in the changelog as the 0.10.x entries'
were not, because these change what a player is asked.

Cleared 2026-11-04 (the v4.21 handbook sync, system 0.11.0; `v4.21-sync-report.md`, rulings 125 to
158; Mike: "going forward --- let's plan before making changes", so the plan went through plan
mode first): the edition formatted from `StarWrought_v4.21_Reorganized_Redline.docx` as
`Starwrought_Players_Handbook_v4.21.docx` with the Calling table and the text defects left as
tracked-change proposals; the five caster Callings, the five magical Constellations with their ten
specialties (`data/magic.xlsx`, structured spell columns), the Reactions as Talents, the new armor
table, the Comets, the roster's new blocks; the converter's groups, spell columns and armor Type;
the web app and the compendium docx; and the system: same-type stacking replaced by v4.21's sum with
a `source` collapse (125), groups wearing the parent's rank with the Origin nameable (127, 128), the
Strike Attribute as the weapon's with a Maneuver's Key Attribute offered (129), Reactions from an
owned-Talent table with one answer per attack and Void and Counter gone (130 to 133), weapon dice by
rank and no specialization (153), the damage order Immunity, Resistance, Weakness, Protection once
for Zoned, doubling, Deadly, with Pervasive and Persistent damage through the pipeline and the
material step gone (137, 149), spells as `system.spell` cast at once outside the attack flow (134
to 136), Visored and Fitted (140 to 142), two rests (144), Comets (145), Wind without exemption and
a critical failure at +2 (150), the Endure Bonus dropped (151), the casters' Opening Vigor per the
root texts (152), the reviewer's five margin comments answered (154 to 158, the Attribute cap
among them). Not done, and recorded above: spells inside the attack flow, Cover the Angle and the
size clauses, sleeping in armor, the handbook defects Mike's to fix. `data/SYNC.json` is stamped
v4.21 by `--accept-phb` at the end of this sync.

Cleared 2026-11-04 (the action counter on the Token HUD, system 0.10.1; the fifteenth
recommendation, Mike's own: "show a small action counter in the Token HUD, such as 4/6, rather
than a full token bar"): nothing on the token showed actions; now `actionsCounter` in
`module/apps/token-hud.mjs`, first in the HUD's right column in an encounter only, the free count
over the round's count with the shared three-state pips (`actionPips`) and the legend tooltip, a
readout re-rendered on the shown actor's `system.actions` changes; and a defect found on the way,
token bars left on `hp` by the 0.6.0 rename, fixed by the 0.10.1 step of `migrateWorld`
(`STARWROUGHT.Migration.tokenBars`; a world already stamped 0.10.1 by a pre-release build runs it
by setting `systemVersion` to `0.10.0` once). Checked live: four bars retargeted, the counter
absent outside an encounter and moving from 6/6 to 4/6 to 1/6 with the reserve shown. No handbook
moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (more than six actions a round, system 0.10.1; the fourteenth recommendation,
Mike's own: "Ensure the system supports situations where more than 6 actions are allowed (e.g.,
maybe some NPCs, or a haste spell)"): an adversary already had `actionsPerRound` (its field, 1 to
12) and a character was six in two places with nothing to raise it; now `bonuses.actions` on the
character (the Overview's "Actions a round" adjustment, an Active Effect's target for a haste-like
effect, negative allowed) and `prepareActions` in `module/data/character/actions.mjs` deriving
`system.actionsPerRound` as six plus it, clamped to 0 and `SW.ACTIONS_MAX` (12, the system's
ceiling, now read by the schema maxima, the adversary's input, the tracker's slice and the clamp);
`SwActor#actionsPerRound` the one getter over the field on both types, read by the reset, the
pips, the tracker, the ruler and the refund; glyphs ❼ to ⓬ and six more ruler colours. No
Quickened condition (Mike's choice; it comes with the first spell that needs it, as a proposal).
Checked live at +2 (8 of 8, eight pips), +9 (12), −8 (0) and Slowed 1 (7 of 8). No handbook moved
and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (reserved actions on the pips, system 0.10.1; the thirteenth of the
recommendations, Mike's own: "Use a more illustrative display in Combat Tracker and Character
Sheet to take Reserved actions into account"): the tracker lit a pip only while free, from its own
arithmetic, so a reserved action looked spent there; now `actionPips(actor)` in
`module/helpers/actor-context.mjs` is the one computation of the three states, the counts and the
legend ("2 available, 2 reserved, 2 spent.", `STARWROUGHT.Actions.legend`) behind the sheet's
`actionsContext` and the tracker's `actionsReadout`; the token `--sw-reserved` (violet) replaces
the borrowed Agility colour on the sheet and fills the tracker's `sw-reserved` pip (`sw-free`,
`sw-reserved`, `sw-spent` in place of `sw-lit`); the legend ends both tooltips; the tracker's big
number stays the free count by Mike's choice, the mock's "4/6" having counted the reserve in.
Checked live with a Maneuver Prepared and abandoned. No handbook moved and `data/SYNC.json` is
untouched; no ruling.

Cleared 2026-11-04 (the four Actor-side documents, system 0.10.1; the twelfth of the architecture
recommendations, all four parts by Mike's "Do all four"): `documents/actions.mjs`, which charged
a token drag and offered the Intercept and nothing else, is `documents/movement.mjs`
(`registerMovementTracking`); `documents/combat.mjs` (1,192 lines) keeps `SwCombatant`, `SwCombat`
and the round's hooks (612), with the card idiom in `helpers/cards.mjs` (`cardHtml`, `postCard`,
`ownersOf`, `tableFor`, `requireOwner`, `actorFromUuid`, `cardActions`, `registerCardButtons`),
the election in `helpers/authority.mjs` (`isElected`, `responsibleFor`), the safe read in
`helpers/settings.mjs` (`setting`), the round's cards and their buttons in
`documents/cards/round.mjs` and the tracker's readout in `apps/combat-tracker.mjs`
(`registerTrackerReadout`, called by `starwrought.mjs` so the module may import `SwCombat` without
a circle); `documents/chat.mjs` (899) keeps the render pass, the `onCardButton` dispatch and
`onChatSocket`, now a router by prefix (195), over `documents/cards/{shared,damage,reroll,flare,
position,attack}.mjs`, each family answering its own socket messages through `shared.mjs`'s
`replyTo`, the never-imported `onDamageSocket` alias dropped; and `documents/actor.mjs` (2,471,
the most-changed file) is the composition, the lookups and the lifecycle (160) over thirteen
mixins in `documents/actor/` (`conditions`, `wounds`, `checks`, `defense`, `attack`, `points`,
`actions`, `carrying`, `position`, `auras`, `bind`, `flares`, `rest`), bodies verbatim, each
`#private` asserted to be called only from its own section, the conditions' static write queue a
module Map, the Bind's `SwActor.resolveActor` calls the pair-keeper's resolver, and `sameName` now
`SW.sameName` in `config/names.mjs`. Checked by a free-identifier check on all 28 files, a clean
load, one button of each card kind driven in a short encounter, the Actor's method surface (59
names, three statics) and 785 read-only answers on four actors identical before and after, and
every write path once (the 0.10.1 changelog entry lists them). **"`documents/actor.mjs`" in this
file names the class; a method's body is in the section file named for it.** No handbook moved and
`data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the check engine's parts, system 0.10.1; the eleventh of the architecture
recommendations): `module/dice/check.mjs` (1,206 lines) split along its own groups into
`module/dice/check/` (`modifiers`, `dialog`, `card`, `position`, `strike`), `SwCheck` the facade
with `roll`, `resolveAgainst` and every public static, so no caller moved; `check.mjs` 642 lines.
Checked with the die pinned (`CONFIG.Dice.randomUniform` constant): preview totals, three
dialogs' HTML and eight cards with their flags diffed before and after. No handbook moved and
`data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the character model's passes, system 0.10.1; the tenth of the architecture
recommendations, whose Item half was the second): `SwCharacterData`'s nine derived-data passes,
now exported functions over the model in `module/data/character/` (`constellations`,
`attributes`, `armor`, `defenses` with the stance, `wind`, `vigor`, `offense`, and `shared` for
the Arms Wound penalty and the Evade availability the adversary uses too), each headed with what
it reads and writes; `prepareDerivedData` the one place the order lives; the class keeping its
schema, base data and public methods; `actor.mjs` 833 lines from 1,384; the shared base
`SwActorData` untouched, since it already was the shared layer. Checked by diffing every Actor's
full derived data and public-method answers before and after in the running world. No handbook
moved and `data/SYNC.json` is untouched; no ruling. **The next handbook sync lands in the pass
named for the rule** (Wind in `wind.mjs`, Vigor in `vigor.mjs`).

Cleared 2026-11-04 (a Maneuver the system implements is an Action first, system 0.10.1; the
eighth of the architecture recommendations, Mike's own: "Actions like Recenter should be an
Action first, and a Macro second"): `module/documents/maneuvers.mjs`, the table of Maneuvers the
system implements keyed by the slug of the plain name (`recenter` runs `SwActor#recenter`;
`raise-a-shield` raises the held shield through its own method, warning with
`STARWROUGHT.Actions.noShieldHeld` when none is held), asked first by `SwItem#use` for an action
Item; the Recenter Macro now uses the Recenter Item from the Actions pack for each selected token
and runs the method directly while the row is not enabled; the sheet and card buttons unchanged.
Through 0.10.0 the Recenter and Raise a Shield Maneuver Items, used, posted a card and did
nothing. Checked live with temporary world Items named as the rows are (Zones closed, Bind ended
both sides, shield raised and lowered, the no-shield warning, a near-miss name falling back to
the card, the Macro's fallback). Enabling the two rows in `data/maneuvers.xlsx` stays Mike's. No
handbook moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the automation framework's review, system 0.10.1; the seventh of the
architecture recommendations, an outside review written against 0.9.0): its largest finding, an
unspecified hook contract, had closed in 0.10.0; four confirmed findings fixed: the self-test's
unknown-kind word is `not-a-real-kind` (a constant, with a check that no kind takes it), never a
real kind's name; `module/rules/syntax.mjs` holds `RuleSyntaxError`, `splitArgs` and `keyValues`
and imports nothing (`errors.mjs` renamed and grown), so a kind file imports from it and the
config and never from the grammar or the registry, and the self-test imports the `bonus` file
first to prove no circle; the grammar's `plainData` refuses a kind's data that is not JSON-plain
(NaN, a function, a Date, a cycle) as the kind's bug with the path, and drops undefined as JSON
does; and `module/rules/README.md` states the two hook-point categories (calculated, answering
with data on any client; triggered, defined with the first such kind with its one executing
client, event identity and failure rule) and the stale-parse policy (no version on a rule, the
text is the version). The rest of the review waits for the first triggered kind (ruling 119).
No handbook moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the Bind's pair-keeper, system 0.10.1; the sixth of the architecture
recommendations): the half of `canvas/bind.mjs` that wrote documents (the mirror pickup when the
writer owns one side, the elected writer, the sweep at ready), now `module/documents/bind.mjs`
with `registerBindSync` beside `registerBind` in `starwrought.mjs`; `canvas/bind.mjs` only draws;
the mirror table and the uuid resolver defined once there and imported by `documents/actor.mjs` (since the actor split, `documents/actor/bind.mjs` and `actor.mjs`)
(whose `formBind` carried a copy of the table and whose static `resolveActor` now delegates) and
by the canvas. Checked live by forcing the pickup both ways with pairing off, a sweep over a
half-emptied pair, and the chain counted on the map. No handbook moved and `data/SYNC.json` is
untouched; no ruling.

Cleared 2026-11-04 (three of the apps, system 0.10.1; the fifth of the architecture
recommendations, which reviewed six): the seven context builders the character, adversary and
party sheets share, exports of `apps/actor-sheet.mjs` that two other sheets imported, now
`module/helpers/actor-context.mjs` beside `stance.mjs`; the synchronisation of
`apps/content-sync.mjs` (fetch, plan, apply, the copies, the card) now
`module/helpers/content-sync.mjs`, the window importing it and re-exporting the three entry
points so the 0.8.0 import path holds; the party sheet's five per-tab context builders, now plain
functions over the party in `module/apps/party/{roster,skills,road,loot}.mjs`, the 27 handlers
and the member hooks staying with the sheet (the feature behaviour was always
`helpers/party.mjs`). Not split, by the same review: `chargen.mjs` (the step logic is already
small methods; the point-slot engine is the complexity and is bound to the wizard's state),
`combat-prompt.mjs` and `item-sheet.mjs`. Checked by diffing every tab's rendered HTML of the
three sheets and the Sync content window before and after. No handbook moved and `data/SYNC.json`
is untouched; no ruling.

Cleared 2026-11-04 (the Item details tab split, system 0.10.1; the fourth of the architecture
recommendations): the 386-line `templates/item/details.hbs` branching eight ways, now a 7-line
dispatcher including `templates/item/details/<type>.hbs` by name through Foundry's `concat`, one
partial per Item type and three shared panels beside them (`aura`, written out twice through
0.10.0; `automation`, whose include sites are now the list of types that show it, so
`SwItemSheet.RULE_TYPES` and `hasRulesPanel` are gone; `physical`), all twelve registered in
`preloadTemplates`, which a new type must be added to; and the physical panel's "Worn or
wielded" checkbox on the derived `system.equipped`, which worked only by tripping the 0.4
`migrateCarryState` on every write, now a select on `system.state` (In hand, Worn, Packed;
`STARWROUGHT.Field.carryState`). Checked by diffing each type's rendered details HTML before and
after (identical but for that control) and exercising the select live. No handbook moved and
`data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the rules constants split, system 0.10.1; the third of the architecture
recommendations): the one 1,166-line `module/config.mjs`, the most-changed file in the system,
now an 83-line barrel of explicit named re-exports over `module/config/`, twenty files, one
concept each (`system`, `attributes`, `proficiency`, `constellations` with the runtime registry,
`exchange`, `degrees`, `zones`, `sizes`, `weapons`, `load`, `recovery`, `advancement`, `party`,
`actions`, `movement`, `auras`, `items`, `conditions`, `modifiers`, `names`), every one pure at
module scope and headed to say so; the split refiled by concept rather than by the drifted
banners (the Exchange and the version stamp out of "Constellations", Load Strain and the Endure
Vigor bonus out of "Weapons", Wind, Fatigued and the helms out of "Movement", the Item types out
of "Auras"), renamed nothing and changed no value; `SYSTEM_VERSION` is in
`module/config/system.mjs` and the stamp checks read it there; `build_all.mjs` imports the barrel
and every file in plain Node and fails on a name a file exports that the barrel does not, or the
reverse, or a file that will not import; no file imports the barrel, so no cycle. Checked by a
node dump of all 108 exports (names, constants, function source, a call table) before and after,
identical but for the old file's line endings, and the live world's Item schemas, 38 Items' and
four Actors' derived data and the status effects, identical. **In this file, "`X` in
`config.mjs`" still means the barrel; the constant's own file is the concept's under
`module/config/`.** No handbook moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the Item data models split, system 0.10.1; the second of the architecture
recommendations): the one 873-line `module/data/item.mjs`, now a 27-line barrel over
`module/data/items/`, one file per Item type (`constellation`, `talent`, `chassis`, `weapon`,
`armor`, `shield`, `gear`, `action`, each with a header naming the shared pieces it uses, no type
file importing another) and the shared pieces one concern per file (`base`, `cost`, `aura`,
`rules`, `physical`, `weapon-traits`), the review's single `shared-fields.mjs` declined because
each concern is a trio of fields, migration and prepare that belongs together and apart;
`weapon-traits.mjs` pure, so `assets/build_foundry.mjs` imports `splitTraits` from the system and
drops the copy it carried (pack sources byte-identical), and a build-time check of the Traits
column can use `parseWeaponTraits` without a second parser; the one-time Speed migration out of
the Item models into `module/data/legacy.mjs`; `helmPenaltyFor` with armor, where `actor.mjs`
imports it. Checked by recording every Item type's schema and 38 sample Items' full derived data
in the running world before and after and diffing (identical), `node --check`, `test_rules`, the
build, and a clean world load. No handbook moved and `data/SYNC.json` is untouched; no ruling.

Cleared 2026-11-04 (the stylesheet split, system 0.10.1; the first of Mike's architecture
recommendations from an outside review, each to be validated before any code moves): the one
2,947-line `styles/starwrought.css`, now eleven files, one per window, in the order `system.json`
lists them, each opening with what it owns, what it serves and what it builds on, with the map and
the rules in `foundry/starwrought/styles/README.md` (a file relies only on the files before it; no
selector list declared twice, `:root` excepted; every `.css` in the folder listed in the manifest);
the one stale-copy stamp, now one per file (`--sw-css-version-<name>`), read off
`game.system.styles` by `checkForStaleAssets` so the warning names the stale file; the stamp check
in `build_all.mjs` and `package_system.mjs` reading the manifest's list and `build_all.mjs` failing
on an unlisted stylesheet or a repeated selector list; and the four places where the old file's
order silently decided a rule, fixed: the Strike pills' 0.5.1 padding, dead behind the base rule,
now the one rule; `sw-choice` shared by the check dialog's options and the wizard's cards, the
options now `sw-dialog-option` in their own authored look and the cards keeping the size the
collision gave them, written down; `.sw-defense` once; the stance, wound and bind cards' accents,
dead behind the base card's `border` shorthand, now showing. The split was done by a script slicing
the old file by line range with a coverage assertion, the rule sets compared, and the computed
styles of 2,313 elements across nine open windows diffed before and after on the live system
(identical but for the pills and the pinned wizard size). Not done, Mike's call: whether the
wizard's card names should return to 14px (two lines in `chargen.css`), and whether to adopt
Foundry's cascade layers (the scrollbar block would have to stay out). No handbook moved and
`data/SYNC.json` is untouched; no ruling, the count stands at 124.

Cleared 2026-10-03 (the first rule kind, system 0.10.0): the empty registry, now one kind, `bonus`
(`module/rules/kinds/bonus.mjs`; `bonus: <value> <Type> to <Target> [if <Constellation> is
<Rank>]`, Mike's sketch made concrete, the rank test equality as he wrote it, the three type words
only with the retired words refused by name, the target a Constellation or a Maneuver by the
book's name; ruling 121); the framework reading nothing in play, now the `modifiers` hook point
(`ruleModifiers` in `module/rules/engine.mjs`), generic dispatch over every registered kind from
two existing passes, the check assembly and the Defense pass, so a later kind that wants the same
moment adds no engine code (ruling 124); a Maneuver-targeted bonus applied to a roll made from the
Maneuver's Item and offered unticked on any other check, never on an attack, a Defense or an
Initiative (ruling 122); a Maneuver whose check is enabled with no Constellation named, now a
Relevant Check that opens the picker carrying the Maneuver, set by the build from an Effect that
says "Relevant Check" (ruling 123; Aid ships with it set, the first shipped Maneuver document); the
grammar's parse context carrying a `resolve` from both its callers; `STARWROUGHT.Rules.none` and
the build summary's plurals; the self-test's bonus section; the recipe's step 5 rewritten for
generic dispatch. Also cleared the same day, by Mike's hand during the build: the never-committed
`data/actions.xlsx` and its one row. Mike moved Aid into the tracked `data/maneuvers.xlsx`
("Watching, Deceiving & Helping", row 9) with `Enabled? = Yes` and deleted `actions.xlsx`; the
converter said "'Aid' was actions.xlsx's and is now defined in maneuvers.xlsx, which wins",
`assets/actions.json` lists 40 actions from one workbook, and Aid ships for the first time under
the roster row's old document id, so a fresh clone now regenerates every action and the carry-over
rule has nothing to carry. Not done: Humanity's cell (Excel held `data/ancestries.xlsx` open; the
four lines are Mike's to paste, Known outstanding work, above), Aid's `_Tree Index` row (the
converter warns), any survey, any second kind, and adversaries, which roll flat. No handbook moved
and `data/SYNC.json` is untouched;
`Starwrought_Players_Handbook_v4.16.docx` stays on the shelf unsynced; the rulings (121 to 124)
are recorded in the 0.10.0 changelog entry. The next kind is the aura (Known outstanding work,
above).

Cleared 2026-10-03 (the automation framework, system 0.9.0): the Automation column with no grammar
behind it, now one grammar in one place (`foundry/starwrought/module/rules/grammar.mjs`, pure, so
`build_foundry.mjs` and the client parse a cell identically and the converter carries text only;
ruling 120) over an `Automation` column on every tree sheet as well as the action sheets; the cell
as data, one rule per line, `kind: arguments`, `#` a comment, parsed by the build into
`system.rules` on the Talent, action and Constellation Items, a line the grammar does not know
stopping the build naming the Constellation, the Talent and the line, and the same line typed into
a world Item saved and marked on the sheet, never thrown on (ruling 118); rule kinds as plug-ins
with one contract (`{ id, aliases, parse, summary, hooks }`, enforced by `registerKind` in
`module/rules/kinds/index.mjs`), the registry empty, each kind to be added one at a time with Mike
with its hook defined with it (ruling 119); the rules indexed on the character and the adversary at
prepare (`collectRules` in `module/rules/engine.mjs`; `system.rules { all, byKind, unknown }`;
`SwActor#rulesOfKind`), read by nothing yet; the Item sheet's Automation panel with its As read
list; `assets/test_rules.mjs` as the `test_rules` step of every `build_all.mjs` mode; the recipe in
`module/rules/README.md`; and `automation-plan.md` in the project root. Not done, by Mike's
instruction: the survey of the Talents, any rule kind, any engine hook. No handbook moved and
`data/SYNC.json` is untouched; `Starwrought_Players_Handbook_v4.16.docx` stays on the shelf
unsynced; the rulings (118 to 120) are recorded in the 0.9.0 changelog entry. The first kind is
the aura (Known outstanding work, above).

Cleared 2026-10-03 (the content loop, system 0.8.0): the stop, build, start and relaunch round
trip a content change needed through 0.7.5, because the LevelDB compile fails while Foundry holds
the packs open; now `node assets/build_all.mjs --content` (and `sync_content.cmd` for a
double-click): the spreadsheets converted, the web app and the viewer rebuilt, only the changed or
new plates rendered against the `.plates.json` sidecar, the pack sources written with
`flags.starwrought.contentHash` on every document and `packs/_source/index.json` over them, the
style check run, no compile, and handbook drift printed as a warning (ruling 115); and in the open
world **Sync content** (`module/apps/content-sync.mjs`; Settings > STARWROUGHT > Sync content,
`game.starwrought.syncContent()`, offered to the GM at load when the index's `build` differs from
`contentBuild`), a diff by id and hash shown as a plan before it is applied, stale system documents
deleted by name (ruling 116), and the characters' owned copies refreshed with `quantity`, `state`,
`raised` and `choice.value` kept (ruling 117). No handbook moved and `data/SYNC.json` is
untouched; `Starwrought_Players_Handbook_v4.16.docx` stays on the shelf unsynced; the rulings (115
to 117) are recorded in the 0.8.0 changelog entry. The automation framework is the next part.

Cleared 2026-10-02 (the Party Sheet, phase 4, system 0.7.5): the Downtime the plan's part 10
described, the last phase, now a panel at the foot of the On the road tab (Mike: "go ahead with
phase 4 too"): the days the GM gives as `system.downtime.days` on the party, an integer nothing
counts down (ruling 112); the three Downtime Activities printed from the Actions pack's Downtime
Mode folder with their Duration and Effect (`downtimeActivities` in `module/helpers/party.mjs`,
cached and cleared beside the Exploration ones), so a row added to the roster's `downtimeActions`
needs no code; Train per member through the shared `pickFlare` with no reason field, lighting the
pick through `toggleFlare(slug, true, { trained: true })`, whose card says "Flared by seven days'
training.", and recording `flags.starwrought.trainedAt { level, milestone, time }` on the
character, the control amber with "Train already used since the last Milestone" while the record
equals the member's count and refusing nothing (ruling 113; decision 14); Retrain and Provision
printing one line each saying they are done by hand (ruling 114). The book's "only once between
Milestones" counted for each character is one tracked cell in
`Starwrought_Players_Handbook_v4.15_downtime_proposal.docx` (the plan's handbook item 11), for Mike
to accept or reject. No handbook moved and `data/SYNC.json` is untouched; no data moved, so the
pipeline's outputs stand as 0.7.2 left them; the rulings (112 to 114) are recorded in the 0.7.5
changelog entry. The plan is built.

Cleared 2026-10-02 (system 0.7.4): the 0.7.3 question whether an Initiative rolled with Stealth
takes Load Strain, answered by Mike ("ALL active modifiers for any roll should be applied even if
that roll is used for initiative"): `SwCheck`'s Initiative assembly now carries everything the
Constellation's check does (the check adjustment, Load Strain on Stealth) before Initiative's own
terms, so a fresh Avoid Notice Initiative, the tracker's formula, the grid's cell and a kept road
roll all agree with the Stealth check (ruling 111, recorded in the 0.7.4 changelog entry). No
handbook moved and `data/SYNC.json` is untouched.

Cleared 2026-10-02 (the Party Sheet, phase 3's second cut, system 0.7.3): Mike's two sentences on
the On the road tab after 0.7.2 (the result of the rolls shown on the tab; a box to use that roll
when the GM Begins the Encounter), now the Activity's roll remembered on the character from the
`starwrought.check` hook (`system.exploration.roll`; `rememberActivityRoll` in
`module/helpers/party.mjs`), for a check in the Constellation the Activity rolls now and nothing
else, cleared by `setActivity` when the pick changes (ruling 108); the chip on the member's row
with the die and the time on hover, and Say the plan printing it; Begin the encounter asking the GM
first, one ticked checkbox per present member whose roll is in their Initiative Constellation and
whose Combatant has not rolled (`keepableRolls`), and keeping a ticked roll as Initiative as the
same die re-counted by the check engine's Initiative assembly with the Scouts' bonus and the
check's own typed extras in one pass (`SwCheck.previewTotal`), written with `setInitiative` and
named on the card (ruling 109); the record the roller's own write and public, the roll's card the record of the
die (ruling 110). No handbook moved and `data/SYNC.json` is untouched; no data moved, so the
pipeline's outputs stand as 0.7.2 left them; the rulings (108 to 110) are recorded in the 0.7.3
changelog entry.

Cleared 2026-10-02 (the Party Sheet, phase 3, system 0.7.2): the road the plan's parts 8 and 9
described, now the On the road tab: each member's Exploration Activity on the character
(`system.exploration`, written by its owner or the GM and said in one line, ruling 106); the
Activity data as two positional columns on the roster's `explorationActions` rows and the Avoid
Notice row, written by `build_foundry.mjs` onto the Activity Items under their old ids (rulings
103 and 104); the party's Travel Speed off the slowest member and the terrain, display only
(ruling 102); the Fatigued gate holding a member to Travel with the stored pick untouched (ruling
101); an Activity's own Roll through the member's check and Look Harmless's Requirements as a
warning (ruling 107); Say the plan; and Begin the encounter writing Initiative by Activity and the
Scouts' +1 Situation onto the Combatants and raising a Defender's shield, with every Initiative
roll in the system reading the flags, the character sheet's Roll Initiative among them (ruling
105; plan risk 10 closed). The checkbox dress (the Ask everyone dialog's tall pill) mended in the
stylesheet. No handbook moved and `data/SYNC.json` is untouched; the system runs ahead of the book
on four sentences and a strike, carried in `Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx`
for Mike to accept or reject; the rulings (101 to 107) are recorded in the 0.7.2 changelog entry.

Cleared 2026-10-02 (the Party Sheet, phase 2, system 0.7.1): the loot and the purse the plan's
part 6 described, now the Loot tab (embedded Items of the four physical types, `SwItem._preCreate`
refusing the rest) with the GM's Give to and Delete, a player's Take, and Give to the party, the
player's moves relayed to the active GM's client as `party:take` and `party:give` over the system
socket (`documents/party-socket.mjs`; destination first, source second, arrival order, the asker
from the server's stamp) and the character sheet's drop of a party Item moving the whole stack;
`system.currency` on the party with Split in copper; and Ask everyone on the Skills grid, one party
card with a Roll button per member and the Threshold hidden unless shown. No handbook moved and
`data/SYNC.json` is untouched; the rulings (96 to 100) are recorded in the 0.7.1 changelog entry.

Cleared 2026-10-02 (the Party Sheet, phase 1, system 0.7.0): the party sheet, planned in the v4.14
sync (ruling 89), now built as a `party` Actor type and sheet with the roster as a status board,
Begin session, Hero Point awards with a reason, the party's night, the Milestone award with its
preview and Take back, and the Skills grid; the Deferred Talent Point the book names in Table 4 and
the system lacked, now `system.deferred` on the character with a Spent control and a reminder on
the Flare card (ruling 94); the Flare dialog bound to the chat card, now the shared `pickFlare`
with the GM's reason on the lit card; `MILESTONES_PER_LEVEL` in the sheet, now in `config.mjs`;
and the three places a third Actor type would have met code written for two (Support's ally count,
`actorsIn`, the tracker readout), fenced. No handbook moved and `data/SYNC.json` is untouched; the
rulings (91 to 95) are recorded in the 0.7.0 changelog entry.

Cleared 2026-10-02 (the v4.14 sync, system 0.6.3): the Flare dialog listing every shipping
Constellation at once, now the Opened ones with a checkbox for the rest, and the sheet's
Constellations tab with no way to Flare an unopened Constellation, now its toolbar toggle (ruling
85); a Flare from the sheet going unannounced, now said in chat from either entry point (ruling 86);
every ranged weapon reading Agility, now the Composite trait (ruling 87); the Strike Attribute
question, verified as implemented (ruling 88); the party sheet question, answered and planned
(ruling 89); the Attended redline, accepted into v4.14, so the "data ahead of the book" bullet
closes; the Comfort row's lowercase "fatigued", now "You can sleep in it without increasing your
Fatigued value by 1." in the book and the roster (ruling 84); two slips mended in the edition
(ruling 90). The sync report records the rulings (84 to 90).

Cleared 2026-10-02 (the v4.13 sync, system 0.6.2): the third-round delay on the Wind check, now the
end of every round from round 1 (ruling 79, flagged to Mike in case the delay was meant to stay);
the v4.12 report's question on the Strain 1 or more clause, now the book's own words (ruling 80);
Fatigued clearing when the Combat is deleted, now ending only with ten minutes' rest, by the
Fatigued card's button or a night's rest (ruling 81, superseding 70); the armor-help question, now
the Attended trait on the Breastplate, display only (ruling 82); the Awareness Constellation
disabled, now shipping with its Root alone so every Defense ships (ruling 83). The sync report
records the rulings (79 to 83).

Cleared 2026-10-02 (the v4.12 sync, system 0.6.1): Mike's open question on the Wind check, answered
in the book (no Wind check when the Endure Threshold meets 10 + Load Strain, read live; the
inverted clause in his saved file corrected by the edition, ruling 74); the Wind bullet's own
Fatigued definition and the "once the fight is over" clause (ruling 75); Rage's "fatigued" in its
own sense, now the Wind condition's Fatigued raised by 1 in the Berserker cell (ruling 76, closing
73); the Endure Constellation disabled, now shipping with its Root alone (ruling 77). The sync
report records the rulings (74 to 78).

Cleared 2026-10-02 (the v4.11 sync, system 0.6.0): Load Strain on Evade and on every Might or
Agility Skill check; the boolean Fatigued and its −1; Endure relief starting at Expert; the
Calling's Vigor per level, now Opening Vigor; the web app's relief table, back to the book's
Trained 1 to Legendary 4. The sync report records the rulings (67 to 73).

Cleared 2026-09-28 (the v4.10 sync): the check formula's level term, the ÷ 3 divisor and the
1/5/13/19 rank gates everywhere downstream; the Multiple Attack Penalty and its `trackMap` setting;
Hit Points, Stride, the three-action turn and the reaction slot; the Weapons Constellation, now
Melee and Ranged with the Combat Styles as their children; the four-Defenses grant at creation; the
numeric Wounded value; the web app's Endure relief table (wrong since v3.2); the converter's glyph
normaliser and the plate renderer's missing ⓿; the Task-level Threshold table; and the roster's
Postures table, now the Reaction table. Loose and Move moved from Archery to Ranged.

Cleared 2026-10-01 (the v4.10 review, 40 findings): a Reaction Strike reading the target's stance;
Counter answering ranged attacks; the Bind offered for unbindable attacks and keyed on the wrong
weapon; the Speed ÷ 4 heuristic running on every load; the Zone-bonus double count in
`zoneProtection`; movement reading the stored Speed instead of `moveSpeed` and Speed 0 as 6 (now
Crawl); the lone combatant's round reset; Intercept offers coupled to `trackActions`; the app's
ungated parent pool and its silent drop of Loose and Move; the sheets' clipped and dropped text;
the plates' glyph-blind Requires matching, bare "0" and stale Weapons plate; the Activities printed
as ⓿; and the `data/README.txt` categories and Golarion example. The sync report records the
rulings (51 to 59).

Cleared 2026-08-27: the de-Paizo pass (cultures are now Serrovane and Kestrel Reach); the stale
`build_phb.js`, now a data-driven compendium builder; the missing and orphaned constellation plates;
the `Save`/`Heritage` category names; the converter's cp1252 crash and the matching mojibake in the
plate renderer; the character sheet's three-Defense layout. The 8-vs-10 Combat Styles table and the
three `TBD$$$$$` background descriptions were fixed by v3.1.
