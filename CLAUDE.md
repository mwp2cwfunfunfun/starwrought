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
| `data/*.xlsx` | `assets/trees.json`, `backgrounds.json`, `languages.json`, `actions.json` |
| `assets/roster.json` (hand-kept blocks) and `sheet_spec.json` | the `ancestries` block of `roster.json` (the converter overwrites it from `ancestries.xlsx`) |
| `assets/app_template.html`, `constellation_template.html` | `Starwrought_App.html`, `Starwrought_Talent_Constellations.html` |
| `assets/*.py`, `assets/build_phb.js` | `assets/constellations/*.png`, the PDFs, the compendium |
| `foundry/starwrought/` **except** `packs/`, `content/`, `assets/constellations/` | those three, which `assets/build_foundry.mjs` regenerates |
| `data/SYNC.json` (via `build_all.mjs --accept-phb`) | `foundry/starwrought/content/sync.json` |

**The web app and the Foundry system are siblings, not a chain.** Both read `assets/trees.json`,
`assets/actions.json` and `assets/roster.json`; neither reads the other. Asked whether the app should read the Foundry
compendia instead (Mike, 2026-08-27): no. It would make one consumer depend on another consumer's
output, swap two JSON files for 364, and give the app a shape built for Foundry rather than the
tree structure it actually wants. The thing that keeps them in step is `build_all.mjs` and the
handbook rule, not a shared data path.

Hand-editing a generated file is not forbidden, it is simply pointless: the next pipeline run
destroys it. Fix the source.

### The pipeline

One command runs all of it and then checks for handbook drift:

```
node assets/build_all.mjs              # every step below, in order, then the drift check
node assets/build_all.mjs --check      # only the drift check
node assets/build_all.mjs --skip-slow  # skip the plates, the sheets, and the compendium docx
node assets/build_all.mjs --accept-phb # record the current handbook as synced, once the work is done
```

**THE HANDBOOK RULE (Mike, 2026-08-27, standing).** When the PHB moves, everything downstream moves
with it: `data/*.xlsx`, the web app, the Foundry system, the system's `FEATURES.md`, and its
`CHANGELOG.md`, which gets an entry every time even if only to say what moved. `data/SYNC.json`
records the version the repository is synced to; `build_all.mjs` exits 1 while the handbook on the
shelf is newer, and refuses to stamp a new version until the changelog and the features file both
name it. The Foundry system carries the stamp into the game as `game.starwrought.rules.phb`.

The individual steps, from the project root, in this order. They need `openpyxl`, `matplotlib`,
`reportlab`, `python-docx`, and the `docx` npm package; all are installed.

```
python assets/xlsx_to_trees.py        # data/*.xlsx -> trees/backgrounds/languages/actions JSON. Refuses to write on errors.
python assets/inject.py               # templates + JSON -> the two root HTML files
python assets/render_constellations.py # -> assets/constellations/*.png
python assets/sheet_gen.py            # -> the fillable and Mira character sheets
node   assets/build_phb.js            # -> Starwrought_Constellation_Compendium.docx
node   assets/build_foundry.mjs       # -> foundry/starwrought/{packs,content,assets/constellations}
python assets/check_style.py          # the two absolute rules below, enforced. Exit 1 on a violation.
```

`build_foundry.mjs` sits next to `build_phb.js` for the same reason: both read `trees.json`,
`actions.json` and `roster.json`, so both must re-run whenever any of those change. It writes `packs/_source/*.json` and then
compiles the LevelDB compendia with `@foundryvtt/foundryvtt-cli` (a devDependency); `--no-compile`
stops after the sources. Document ids hash the pack plus the document name, so they survive a
rebuild, which matters because an id becomes a compendium UUID the moment a Talent lands on a
character sheet. `check_style.py` scans the system's `lang/en.json`, its templates, and
`packs/_source/`, so the Foundry content is held to the same two rules as everything else.

**The compiled packs are not in git.** `foundry/install.mjs` links the repo folder into Foundry's
data directory, so a running Foundry rewrites the LevelDB log and manifest files under `packs/<pack>/`
every time a world opens; committed, they dirtied the tree on every session. `packs/_source/*.json`
is committed and is the source of truth; `build_foundry.mjs` compiles it locally, and
`.github/workflows/release.yml` compiles it again on a fresh checkout before packaging.

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

**Bonus types (Mike, 2026-09-26).** Three, named for where the number comes from: **Situation**
(where you stand and what is happening around you: cover, high ground, an ally's help, a foe
Off-Guard), **Condition** (something on you: Frightened, a stance), **Gear** (what you hold or wear:
a raised shield). Same type does not stack: highest bonus and worst penalty of each type, added
across types. They were circumstance, status and item until PHB v3.3; the engine still maps the old
names (`LEGACY_BONUS_TYPES` in `config.mjs`) for macros that pass typed modifiers, and
`check_style.py` counts the old words left in shipping content as an advisory note (both the
"+2 circumstance bonus" and the elided "+2 circumstance to Evade" forms), because the spreadsheets
are being brought across by hand during the automation pass. Untyped is for the base terms of a
check and the system's own flat adjustments (Load Strain, the Multiple Attack Penalty, the sheet's
adjustment fields); no Talent bonus is untyped. **Weapon traits are Situation** (Mike's ruling,
2026-09-26): Parry, Sweep and Unwieldy describe what the weapon lets you do or stops you doing in
the moment, not what the weapon is. Gear is reserved for something intrinsic to the piece itself,
such as its quality or, later, a magical property. A raised shield's bonus to Guard is Gear.

**Rank math (PHB v4.10).** Trained 1 pt, Expert 4, Master 9, Legendary 16, gated at L1/L5/L10/L15.
The Proficiency Bonus is +3 / +6 / +9 / +12 (Untrained +0), and **level never touches the die**: a
check is d20 + Attribute Bonus + Proficiency Bonus + bonuses and penalties, and a Threshold is 10 +
the same. Every talent costs 1. Capstones (★) are tier L and need a Master talent in the same
constellation. Attribute bonus = points ÷ 4, rounded down (0-3 = +0, 4-7 = +1), max +5 (the cap is
the Key Terms sentence; v4.10 sync report ruling 1). **There is no min +1.** A single point in a
constellation buys proficiency, not an attribute bonus. **Melee and Ranged are parent
Constellations**: a Combat Style's `Parent` column names one, and every Talent bought in the child
counts toward the parent's rank once the parent's Root is owned (rank only; Attribute Points are
never counted twice). Weapon dice: 2 at L4, 3 at L8, 4 at L12, 5 at L16.

**Six actions a round (PHB v4.10).** Every combatant gets six actions at the start of each round,
spent across Opportunities (one Maneuver per Opportunity, or Pass; a full circuit of Passes ends the
round). Reactions ↺ are paid from the same six. Costs are printed ⓿ ❶ ❷ ❸ (up to ❻); a Maneuver of
three or more actions is Prepared (one now, the rest reserved, resolved at the next Opportunity).
There is no Multiple Attack Penalty. Vigor replaces Hit Points; at 0 Vigor you are Spent and every
Hit Wounds a Zone; Wounds are per Zone (capacity 2 for Medium or smaller) and the Torso's or Head's
final Wound is Dying.

## Where the source of truth lives

- **The highest-numbered `Starwrought_Players_Handbook_v*.docx` is authoritative for the rules.**
  It is hand-authored in Word. `assets/phb_edit.py` exists for the cases where Claude is asked to
  change it: it appends a sentence to a named paragraph in that paragraph's own run formatting,
  substitutes a literal inside one paragraph, or renames a word wherever it qualifies a bonus or
  penalty (the v3.4 type rename), and copies every other byte of the package through untouched.
  Its edits are the `EDITIONS` table, one entry per version it has produced, run as
  `python assets/phb_edit.py <in> <out> --to <version>`. It writes a NEW numbered file rather than
  editing one in place, so the version Mike authored stays the version Mike authored. Verify with a
  diff of the two documents: entry count, paragraph count, and the exact list of changed lines,
  each explained by the intended edit. The edition line is the first cell of the cover table, so
  `doc.paragraphs` never shows it; read it as `doc.tables[0].rows[0].cells[0]`. Check for a newer one before starting a sync; v3.1 landed while the
  v3.0 sync was still being written. `data/*.xlsx` derives from it and is authoritative for the app;
  when the two disagree, the handbook wins and the sheets need a pass.
- **`assets/build_phb.js` deliberately does not regenerate the handbook.** That would put rules prose
  in two places and guarantee drift. It builds `Starwrought_Constellation_Compendium.docx`: the
  creation menus, all 30 constellations, and the reference appendices, every table read from
  `trees.json` and `roster.json`. That is content that must track the data exactly.
- `data/*.xlsx` holds all game content. One `_Tree Index` sheet per workbook.
- Ancestry rows in `data/ancestries.xlsx` `_Tree Index` also carry Vigor (the header may still read
  HP), Size, Speed (feet per Move; a Human's is 6), Senses, Summary. The pipeline reads those and
  generates the `ancestries` block of `roster.json` (keys `vigor`, and `hp` for one release), so
  ancestry chassis is authored once, in the sheet.
- `* Lore` sheets in `ancestries.xlsx` are authoring notes for player-facing text. The converter
  ignores them by design.
- Tree sheet columns: Talent, Tier, Root, Requires, Prerequisites, Description, Effect, Feeds,
  Grants, **Choice**, **Free Talent**, **Enabled?**. Column order does not matter; the first word of
  the header does. `Root` = `x` for a constellation root, `h` for a bloodline root. The `_Tree Index` may carry
  a **Parent** column (v4.10): a Combat Style names Melee or Ranged, and the converter errors on a
  Parent that names no tree or has a parent of its own. Action glyphs ride in the Talent name in the
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
  disabled sheet action still retires the roster row of its name (Aid ships nowhere until enabled).
- The pipeline warns on any root that breaks the Root Rule, so violations surface on the next sync.
- **`data/actions.xlsx` is the actions workbook** (Mike, 2026-09-26). The converter recognises it by
  its `_Tree Index` carrying `Name | Type | Meta note` instead of `Tree | Category`; every other
  sheet in it holds one action per row. Columns (first word wins): Action, Cost, Traits, Type,
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
  shown on its sheet; nothing acts on it yet. That column is where the talent-automation grammar
  will land, once it has one.
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
- The PHB prints three non-Trained talents in the whole book, all tier E and all in Melee
  (*Reactive Strike*, *Winding*, *Master Cut*); 174 of the 177 talents are Trained. The Expert,
  Master, and Legendary tiers are otherwise unwritten across all 31 constellations.
- **Armored Fighting's Key Attribute is contradictory and still open in v4.10.** Its section heading
  says *Combat Style • Presence*; the Combat Styles summary table says **Might**. The data uses
  Presence, following the heading, as Shield Fighting was resolved. One cell in `combat_styles.xlsx`
  either way. **This is the tree-level `Feeds` only.** Armored Fighting's per-talent `Feeds`
  overrides are deliberate and mixed (Mike, 2026-08-27): six Might including the root, three
  Presence, two Wits, two Agility. Resolving the heading-vs-table question must not flatten them.
- **Aid differs between the sheet and the book.** `data/actions.xlsx` has Aid as a single action
  with a Relevant Check; PHB v4.10 has Prepare ❶ plus a ⓿↺ Reaction against Threshold 15. The sheet
  wins by the standing rule (2026-09-26): its Aid is what the web app and the compendium docx
  show, and it is what Foundry will carry once the row reads Enabled? = Yes; today the row is
  blank, so Aid ships nowhere in Foundry (ruling 61). The book is Mike's to bring across, or the
  sheet is (v4.10 sync report, ruling 10).
- **Drilled's Effect in the book still says "Weapons Proficiency Bonus".** There is no Weapons
  Constellation in v4.10; the data reads it as Melee. One sentence in the handbook.
- **Key Terms carries v3.4 sentences.** It still says Attribute Bonus is points divided by 3, that
  every character begins Trained in all four Defenses, and that only a Committed Strike is
  Weighted; the Cultures introduction still names Varisians. Character Mechanics, Chapter 3 and the
  data all say ÷ 4, two Defenses, and Serrovane and Kestrel Reach.
- **The Example of Play does its sums at Trained +4** ("2 + 4, so d20+6") against the book's +3
  ladder, and has Recenter clear a Zone Exposed by a Posture, which the rules forbid. The rules
  text governs; the example needs a pass.
- **Table 9's Quick row says a Miss costs "Nothing"; the Result rules say any Miss Exposes.** The
  system follows the Result rules (v4.10 sync report, ruling 51) and keeps the switch in one place
  (`STRIKE_KINDS.exposeOnMiss`). One cell in the handbook either way.
- **`data/actions.xlsx` has never been committed.** It is the authoritative source of
  `assets/actions.json`, which is tracked and marked never-hand-edit, so a fresh clone cannot
  regenerate the actions. It is Mike's working file and adding it to git is his call; the
  converter now says so when the workbook is absent. Its one row, Aid, is not enabled, so Aid
  ships nowhere (ruling 61).
- **Two `Enabled?` loose ends for Mike:** Drilled is enabled while the Weapon Familiarity it hands
  over free is not (the converter warns), and `lore.xlsx` has no column, so Lore ships whole.
- **The handbook grants Counter with Melee Training; the system grants it at Expert rank in Melee**
  (Mike's ruling 63, 2026-10-01: Melee Training gives one Reaction, Intercept). Two sentences in the
  book (Answering an Attack, the Reaction table).

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
