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
| `assets/roster.json` (hand-kept blocks) and `sheet_spec.json` | the `ancestries` block of `roster.json` (the converter overwrites it from `ancestries.xlsx`), and its `weaponsMelee`, `weaponsRanged`, `armorPieces` and `shields` blocks (overwritten from `equipment.xlsx`); `assets/equipment.json` |
| `assets/app_template.html`, `constellation_template.html` | `Starwrought_App.html`, `Starwrought_Talent_Constellations.html` |
| `assets/*.py`, `assets/build_phb.js` | `assets/constellations/*.png` and the `.plates.json` sidecar beside them, the PDFs, the compendium |
| `foundry/starwrought/FEATURES.md` | `Starwrought_Foundry_Features.docx` (`assets/build_features_docx.py` lays the Markdown out as a Word document for printing or a PDF) |
| `foundry/starwrought/` **except** `packs/`, `content/`, `assets/constellations/` | those three, which `assets/build_foundry.mjs` regenerates |
| `data/SYNC.json` (via `build_all.mjs --accept-phb`) | `foundry/starwrought/content/sync.json` |

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
python assets/xlsx_to_trees.py        # data/*.xlsx -> trees/backgrounds/languages/actions/equipment JSON and the roster's generated blocks. Refuses to write on errors.
python assets/inject.py               # templates + JSON -> the two root HTML files
python assets/render_constellations.py # -> assets/constellations/*.png
python assets/sheet_gen.py            # -> the fillable and Mira character sheets
node   assets/build_phb.js            # -> Starwrought_Constellation_Compendium.docx
node   assets/test_rules.mjs          # the automation framework's self-test (0.9.0): exit 1 on a failing check, else "rules framework: N checks passed"
node   assets/build_foundry.mjs       # -> foundry/starwrought/{packs,content,assets/constellations}
python assets/build_features_docx.py  # FEATURES.md -> Starwrought_Foundry_Features.docx (print or PDF)
python assets/check_style.py          # the two absolute rules below, enforced. Exit 1 on a violation.
```

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
sync (ruling 115); a failing step and the stamp check still exit 1, and `--content` with
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
against every defender's Threshold, a player-controlled defender of an adversary's Blow rolls
Defense against the Attack Threshold, and player against player is never an opposed roll. **No
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
an owner may write their own Actor, so no relay and no GM connected). The Activity data is two
positional columns on the roster's hand-kept `explorationActions` rows (column 4 what the Activity
rolls now, column 5 what it rolls for Initiative: "", a Constellation name as the trees print it,
or `choice` for the member's own pick; the Avoid Notice row added as the eighth, ruling 103),
which `build_foundry.mjs` writes onto the Activity Item under its existing id as
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
  `doc.paragraphs` never shows it; read it as `doc.tables[0].rows[0].cells[0]`. **`assets/phb_propose.py`
  is the other tool** (2026-10-02): the same surgical edits, but left as Word tracked changes (author
  "Claude") in a `<name>_proposal.docx` for Mike to accept or reject, its `PROPOSALS` table one entry
  per proposal made; a proposal is not an edition, the drift check ignores the name, and the sync
  follows only once Mike accepts into a numbered handbook. Mike also edits the current edition in
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
  ancestry chassis is authored once, in the sheet. A Calling's Vigor is not in a sheet: it is the
  third column of the hand-kept `callings` block of `roster.json`, and since PHB v4.11 that column
  is the Calling's **Opening Vigor** (paid once, at 1st level, by the first Calling), not Vigor per
  level; every consumer indexes `[2]`. The Ancestry's Vigor stays per level.
- `* Lore` sheets in `ancestries.xlsx` are authoring notes for player-facing text. The converter
  ignores them by design.
- Tree sheet columns: Talent, Tier, Root, Requires, Prerequisites, Description, Effect,
  **Attribute** (0.13.0; `Feeds` through 0.12.0: on a sheet headed `Attribute` a blank cell is an
  error, Mike's "no Attribute cell should ever be blank"; a sheet still headed `Feeds` inherits the
  tree's), **Choice**, **Free Talent**, **Enabled?**, **Automation** (0.9.0; the operator grammar
  since 0.13.0, `AUTOMATION_GRAMMAR.md`: one rule per line, copied through as text by the converter
  and parsed by `build_foundry.mjs`, which fails on a line it does not know). **Retired in 0.13.0,
  still read where a sheet has them:** `Aura` (an `aura:` line is the authoring; both on a row is
  an error) and `Grants` (a `grant:` line; a filled cell warns and must agree with the line). A
  sheet with no `Requires` column, or an empty one, reads `Prerequisites` as the requirement (the
  pieces naming a Talent of the same sheet; ruling 166). An unknown header is warned about by name.
  A `<Tree> Lore` sheet (label | text rows) is the tree's player-facing text, `lore` on the tree
  and the ancestry record (ruling 169). Column order does
  not matter; the first word of the header does. `Root` = `x` for a constellation root, `h` for a bloodline root. The `_Tree Index` may carry
  a **Parent** column (v4.10; any tree since v4.21): a tree that names one is a **group** within it
  (a Combat Style within Melee or Ranged, a magical specialty within its discipline), written as
  `group: true`, and the converter errors on a Parent that names no tree or has a parent of its
  own. The index's `Feeds` column is **`Primary Attribute`** since 0.13.0 (both read). **The spell
  columns** (v4.21; `data/magic.xlsx`): `Threat`, `Delivery`, `Range`, `Die`,
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
  `equipment.json` and ships only the enabled rows under the same document ids. Built from the
  handbook's Chapter 5 tables; the handbook wins when they disagree, and the sheet needs a pass.
- The pipeline warns on any root that breaks the Root Rule, so violations surface on the next sync.
- **`data/maneuvers.xlsx` is the actions workbook** (the format Mike's, 2026-09-26, as
  `data/actions.xlsx`; the file his since 2026-10-01, 0.5.1, T17; the only one since 2026-10-03).
  The converter recognises an actions workbook by its `_Tree Index` carrying `Name | Type | Meta
  note` instead of `Tree | Category`; every other sheet in it holds one action per row. Columns
  (first word wins): Action, Cost, Traits, Type,
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
  ("'Aid' was actions.xlsx's and is now defined in maneuvers.xlsx, which wins"), `assets/actions.json`
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
  Presence, following the heading, as Shield Fighting was resolved. One cell in `combat_styles.xlsx`
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
- **Aid ships and 39 Basic Maneuvers wait on Mike enabling their rows in `data/maneuvers.xlsx`**
  (0.5.1, at his request: "get rid of all of these"; Aid's row set to Yes on 2026-10-03). v4.21's
  Aid matches the sheet's single-action form, so the v4.10 difference (ruling 10) is closed. The
  Parry, Void, Counter and Intercept rows are retired: Reactions are Talents since v4.21, and
  Intercept rides on Melee Training's text. The compendium docx and the web app print every
  Maneuver under one "Basic Action" heading; in Foundry the book groups survive, since the builder
  takes an action's group from the sheet it sits on. Aid is not in the workbook's `_Tree Index`,
  so the converter types it from its Type cell and warns every run until Mike adds the row.
  Recenter, Raise a Shield, Lower the Visor and Raise the Visor have system behaviour behind them
  (`documents/maneuvers.mjs`) and need their rows enabled to appear as Items.
- **Two `Enabled?` loose ends for Mike:** Drilled is enabled while the Weapon Familiarity it hands
  over free is not (the converter warns), and `lore.xlsx` has no column, so Lore ships whole.
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
  Four kinds ship (0.13.0): `bonus`, `grant`, `aura`, `prevent`, and the level-1 Human is written
  whole. What the grammar does not yet read: Torchbearer's "while they can see or hear you" (no
  operator reads sight); a `prevent` of a Condition on an ally as a Reaction (no Talent asks for
  it; the Expose Reaction is built); adversaries' rolls (flat). Each new kind, by the recipe in
  `module/rules/README.md`: its file, its hook point (`modifiers` or `prevent` if either serves
  it, else a new one defined with it; ruling 119), its checks in `assets/test_rules.mjs`, its
  section in `AUTOMATION_GRAMMAR.md`, its CHANGELOG and FEATURES prose. No survey of the Talents
  until Mike asks for one. Also his: whether the web app and the compendium docx should print the
  cell or the Lore (neither does), and whether an edited copy's Automation should survive the
  copies refresh (today it does not; the cell is the author, ruling 120). A Talent's Effect stays
  prose the sheet displays (`FEATURES.md`, section 9) until a kind reads it. The spell rows'
  structured columns are data the engine reads directly (the Aura precedent), not a kind; a
  spell's text effects are candidates for kinds later.
- **The five caster Callings are disabled in `data/callings.xlsx`** as Mike saved it on 2026-11-05
  (their `Enabled?` cells blank), so Spellshaper, Blood Mage, Necromancer, Summoner and Spellblade
  and their Talents left the pack sources in 0.13.0; setting the rows to Yes restores them under
  the same ids. Whether that was meant is his to say.
- **PHB v4.22 is on the shelf, unsynced** (Mike's edit in progress, 2026-11-05): the full pipeline
  exits 1 at the drift gate and the content loop warns, until the sync.

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
