# STARWROUGHT for Foundry VTT: changelog

Every entry names the Player's Handbook version its content was built from. A handbook change is
not finished until the spreadsheets, the web app, this system, its `FEATURES.md` and this file have
all caught up; `node assets/build_all.mjs` checks that mechanically and refuses to pass while the
handbook on the shelf is newer than `data/SYNC.json`.

---

## 0.2.0 (2026-08-27) — Player's Handbook v3.3

### Added

- **The three-action turn, tracked.** Three actions and a reaction, shown as pips on the sheet
  while an encounter is running, reset at the start of each turn. Spent automatically for Strikes,
  Raise a Shield, Recenter, drawing or stowing a weapon, and moving. Movement is charged by
  distance, which a one-foot grid makes meaningful: 30 feet on a Speed of 25 is two Strides.
  **Nothing is prevented.** Going over the budget posts a card in chat naming what was done and by
  how much it went over, and the action still resolves. Armor is the same: it takes a minute per
  point of Protection, the system says so, and then gets out of the way. World setting
  `trackActions`.
- **Held, worn and packed.** Equipment now has a place rather than a boolean. Held is in your
  hands, worn is on your body, packed is in a bag. The Equipment tab is laid out that way: what is
  in hand, armor by Zone, and everything else together. Taking armor off puts it in your gear, and
  a bare Zone offers whatever you have packed for it. Shields and weapons can be stowed and drawn,
  which was not possible before. Existing characters migrate: worn armor stays worn, a wielded
  weapon stays in hand.
- **Reach, drawn on the map, in grid squares.** Reach is measured edge to edge, so adjacent is a
  gap of zero feet and one intervening square is one foot: it is a question about squares, not a
  radius. Whole cells are lit and every outline runs along a grid line, and because diagonals are
  exact the shape comes out a stepped octagon. Three bands, innermost first: **Unwieldy** in red,
  the dead zone where a long weapon takes its −2; **Natural Reach** in faint blue, what your body
  reaches; **Total Reach** in gold, Natural Reach plus the longest melee weapon in hand. A cell is
  filled in the innermost band it belongs to so the colours do not stack, but each band outlines
  its own edge regardless, because a longspear is Unwieldy 7 against a Natural Reach of 2 and the
  faint ring would otherwise disappear inside the red one. A battleaxe shows 4 feet, a longspear 16
  with red at 7, empty hands your Natural Reach. Client setting `showReach`.
  - **The bands follow a token as it is dragged**, before the move is committed, so a player can see
    what they would threaten from a square and stop there rather than spend a second action fixing
    it. They snap back if the drag is cancelled. The shape does not depend on where the token is, so
    it is built once in the token's own cell coordinates and cached, and a drag only moves the
    container: 0.037 ms per frame at the longest reach in the book, against 4.16 ms to rebuild, or
    about a fifth of one percent of a 60fps frame. The shape is regenerated only when the reach
    numbers, the token's footprint or the scene grid change.
- **The drag ruler, coloured by Strides.** A Stride carries you up to your Speed for one action, so
  a drag across the map is up to three decisions. The squares Foundry highlights are now coloured by
  which action pays for them: green for the first Stride, gold for the second, orange for the third,
  red for anything past what you have left. The ruler line matches, and the waypoint label prints
  the cost in actions beside the cost in feet ("60 ft ◆◆◆", or "90 ft ◆◆◆+1" past a full turn).
  The count runs from where the drag began against the actions remaining, not from the start of the
  turn against a full three, because movement already made has already been charged: walk 30 feet,
  start a fresh drag, and the next 25 are green again. Outside an encounter a full three is assumed.
  Nothing is prevented; the red squares are a warning and the overspend still goes to chat. Client
  setting `showStrideBands`. The ruler extends whatever class is configured rather than a fixed one,
  so it composes with a module that has already replaced it.
- **Distribution to a server that is not this machine.** `assets/package_system.mjs` builds
  `dist/starwrought.zip` with `system.json` at its root, plus a standalone `dist/system.json` for a
  manifest URL. LevelDB's per-process `LOCK` and `LOG` files and the `packs/_source` build inputs
  are left out. Given `--repo owner/name` (or `GITHUB_REPOSITORY`, as inside a GitHub Action) it
  rewrites the manifest and download URLs in both copies, which have to agree because Foundry reads
  `manifest` from the installed system when it checks for updates. `.github/workflows/release.yml`
  runs it on a `v*` tag and attaches both files to a GitHub Release, refusing to publish if the tag
  and the manifest version disagree. The archive name carries no version on purpose: a
  `releases/latest/download/<asset>` URL only resolves if every release names the asset the same.
- **A character-creation wizard.** Nine steps in the handbook's order, forced forward: you cannot
  pass a step with a choice unmade or a Talent Point unspent. Choices are written to the character
  as you make them, and **Back unwinds them**: the Talents that step added are deleted, the fields
  it set are restored, and the points it spent are forgotten. Clicking an earlier step in the trail
  unwinds everything between. State lives on the Actor, so a reload does not lose your place.
  A finished 1st-level character comes out at the handbook's stated 17 Talents.
  - Enforces root-first, Requires as an OR, tier gates measured after the point lands, capstone
    prerequisites, and the rule that identity Roots are never bought.
  - Handles the Become Trained in X keyword properly: it buys the Root when the Constellation is
    closed and a deeper Talent when it is already open, so a Calling and a Background that both
    want Athletics do not waste a point.
  - Handles granted points: a Talent with a Grants clause pushes its point onto the step where you
    took it and blocks Next until it is spent. Opening points offer only Roots.
  - Every Lore is its own Constellation, copied from the one authored template, with its own rank.
- **`FEATURES.md`**, describing what the system does rather than what it contains.
- **`assets/build_all.mjs`**, one command for the whole pipeline plus the handbook drift check.
- **`data/SYNC.json`**, recording the handbook version the repository is synced to. The build
  carries it into the system as `content/sync.json`, readable in game as
  `game.starwrought.rules.phb`.
- A cost range on Actions and Talents (`costMax`, `costMode`), so the sheets print what the book
  prints: "◆ to ◆◆◆" for Strike, "◆ or ◆◆◆" for Disarm.
- The Multiple Attack Penalty dialog now opens on the step the character has reached this turn,
  counted from the start of its turn and reset when the turn comes round. World setting `trackMap`.

### Changed

- **Load Strain relief starts at Expert**, following the v3.2 reword of Endure Training: 1 at
  Expert, 2 at Master, 3 at Legendary, and nothing at Trained. A 1st-level character in mail now
  carries one more point of Strain than before.
- `slugify` and the action-cost parser live once, in `module/config.mjs`, and the content build
  imports them rather than keeping a second copy that could disagree.

### Fixed

- **Diagonals were not being measured exactly.** The handbook is explicit that they are, and the
  manifest was leaving Foundry on its default of equidistant, so a diagonal step cost the same as
  a straight one and every diagonal distance read short. The grid block now declares exact
  diagonals. This is a system-level rule rather than a per-scene one: the Scene document has no
  such field, so it takes effect for every scene, and it needs a Foundry restart to load.
- **Scrollbars are bright everywhere**, not only inside the system's own windows.
- **A dropdown made a choice look like it had already been made.** Picking where a point goes was a
  `<select>` that opened already showing the first entry, so a Defense point read as "Awareness,
  settled" rather than "four Defenses, pick one". Every Constellation a point may go to is now a
  chip, grouped by category the way the sheet groups them, and **nothing is selected until you
  click it**: until then the panel says "Choose where this point goes, then choose a Talent" and no
  Talent list shows. Clicking a chip swaps the list beneath it. A slot with only one Constellation
  in scope still just names it, because there is nothing to choose.
- **Lore appeared in two places at once.** An opened Lore (X) carried the Lore template's authored
  category, which is Skill, while an unopened one filed under Lore. Every Lore now files under
  Lore, on the sheet and in the pickers. That also fixes a Lore Talent Point being unable to reach
  a Lore you had already opened.
- **A blocked step did not say what was blocking it.** If the unspent point was below the fold, the
  only signal was a greyed-out Next and a scrollbar too dim to notice. Scrollbars across the system
  now use the gold-on-black theme with a full-width thumb, and a blocked step names what is
  outstanding in the footer, next to the disabled button. Clicking that name jumps to the slot and
  flashes it.
- **The wizard made you click choices that were not choices.** A point with exactly one legal home
  is now spent for you. "Become Trained in X" against a Constellation you have not opened can only
  buy X's Root, and that purchase is what makes you Trained, so there was nothing to decide and the
  wizard now just does it. The same goes for the Calling point at creation, which can only buy the
  signature technique at its Root. Automatic spends are marked and locked, since there is nothing
  to take them back to; Back still unwinds the choice that granted them. Nothing changes where a
  real choice exists: a Training into a Constellation that is already open still asks, because the
  point buys something deeper there instead of being wasted.
- **Weaponmaster did not hand over Weapon Familiarity, and nothing ever asked which Weapon Group.**
  Drilled says "You gain the Weapon Familiarity Talent for free. Choose one Weapon Group in which
  you are Familiar", and neither half was machine-readable: the effect was prose, so no
  implementation could act on it. Two things were wrong underneath, and both are fixed at the
  source rather than special-cased in the system.
  - The spreadsheets gained a **`Choice`** column (a build-time pick a Talent demands) and a
    **`Free Talent`** column (a Talent handed over with no point spent). Three cells filled: Weapon
    Familiarity asks for a "Weapon Group or Technical Weapon", Drilled asks for a "Weapon Group"
    and hands over Weapon Familiarity. The converter validates that a Free Talent names a real
    Talent somewhere in the book.
  - **Familiarity is now derived from what the Talents recorded**, not only from the free-text
    field on the sheet. Before this, Weapon Familiarity had no mechanical effect at all: nothing
    knew which Group you were Familiar with, so a Practiced weapon still dropped a rank. A
    first-level Weaponmaster with a battleaxe was rolling at +0 Weapons Proficiency instead of +4.
  - The wizard asks the question as the Talent lands, and so does the `createItem` hook, so a
    Talent dragged straight onto a sheet is asked too. The Item sheet shows an unanswered choice
    and lets you fill it in later.
  - **Asked once, not twice.** Drilled's group has to be one you are Familiar with, and the
    Familiarity it hands over is the only one you have, so the two are the same answer. A granting
    Talent's answer now carries across to the Talent it grants whenever it is a legal answer there,
    and the single prompt says so. Weapon Familiarity taken on its own still asks its own, wider
    question, which includes the Technical weapons.
- **The wizard's Constellation picker would not stay open, and showed the wrong Talents.** The
  `<select>` was wired as an ApplicationV2 action, and actions fire on *click*: opening the dropdown
  fired the handler with the value it already had and re-rendered the wizard, which closed the
  dropdown before a choice could land. Picking an option then changed the select without changing
  the list beneath it, so it read "Berserker" over Armored Fighting's Talents. Every Constellation's
  Talent list is now rendered up front with only the selected one shown, and the picker is an
  ordinary `change` listener that toggles between them. Nothing re-renders, so the dropdown behaves
  like a dropdown, and the selection survives the re-render that follows a purchase.
- **Ten Actions had the wrong cost.** The parser counted every diamond in the name, so
  "Strike ◆ to ◆◆◆" became a flat three-action activity, and so did Grapple, Shove, Trip, Disarm,
  Reposition, Ready, Sneak, Demoralize and Recall Knowledge.
- An Action was literally named "Disarm  or": the glyph stripper knew about "to" but not "or".
- Familiarity, Resistances, Weaknesses and Immunities rendered blank on the sheet, because the
  join helper did not know a `SetField` hands it a Set rather than an Array.
- The adversary sheet printed raw i18n keys (`STARWROUGHT.ZONE.HEAD`) in the Zones table.

### Handbook

Written into `Starwrought_Players_Handbook_v3.3.docx` from Mike's v3.2, by `assets/phb_edit.py`:

- *Deadly dX* now says it is a critical effect of the weapon rather than one of the dice rolled for
  damage, so it is added after the doubling and is not itself doubled. Repeated as a note on the
  order of operations.
- Roll Playing Conventions now states the conversion the book had never printed: a Threshold is ten
  plus the modifier of the check it stands in for. Repeated in the Key Terms entry.

---

## 0.1.0 (2026-08-27) — Player's Handbook v3.1

First release. A complete system rather than a module on another one.

### Added

- Actor data models for characters and adversaries, and Item data models for Constellations,
  Talents, chassis, weapons, armor, shields, gear and actions.
- Derived data: Attributes from Talents, Proficiency Rank from spend and level with the Origin
  pooled, Hit Points from Ancestry and Calling, the four Defenses and their Thresholds, per-Zone
  Protection with the material step, Load Strain, weapon dice and specialization.
- A check engine with player-facing rolls, target Threshold reading, the Graze band, and the
  Multiple Attack Penalty including the Agile ladder.
- A damage pipeline following the printed order of operations, with per-Zone Protection, the Graze
  Cost, Dying, Wounded, Recovery checks and Refusing Death.
- Flares offered on any critical, including for Constellations the character has never opened.
- Three sheets, chat cards, 19 conditions as token statuses, and initiative by activity.
- Seven compendium packs generated from `data/*.xlsx` by `assets/build_foundry.mjs`.
- A 1-foot grid with Size-driven token footprints.
