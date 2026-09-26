# STARWROUGHT for Foundry VTT: changelog

Every entry names the Player's Handbook version its content was built from. A handbook change is
not finished until the spreadsheets, the web app, this system, its `FEATURES.md` and this file have
all caught up; `node assets/build_all.mjs` checks that mechanically and refuses to pass while the
handbook on the shelf is newer than `data/SYNC.json`.

---

## 0.3.2 (2026-09-26): Player's Handbook v3.3

### Changed

- **The attack dialog no longer reveals the defender's answer.** It showed "Evade (10) · stance",
  which told the attacker both the Defense and the number to beat before the die was thrown.
  Now it says only that the defender's stance meets the roll, and the card reveals which Defense
  and what Threshold once the roll is made. A Defense forced from code is still named, since the
  attacker chose it. If the defender was answered with something other than their stance (Evade
  while Grabbed), the card says why, in place of the dialog.
- **A change of stance is no longer announced to the table.** It told everyone, the GM's monsters
  included, which Defense a character had just switched to, and told the players the same about a
  monster. A player's change is now whispered to the GM only; a GM's change goes nowhere. The
  roll's card is where an answer is revealed.

### Fixed

- **Scrollbars that some browsers would not draw.** The bright bar was applied through the
  standard `scrollbar-color` property, which in Chromium means "use the native scrollbar, in these
  colours". Browsers that draw native scrollbars as overlays, Edge among them, then hide the bar
  until the pane is actually scrolling, so a clipped tab looked like one that did not scroll at
  all. Chromium only honours `::-webkit-scrollbar` styling when the standard properties are left at
  `auto`, and that styling forces a classic bar that is always drawn; the system now sets the
  standard properties back to `auto` and carries the design in the `::-webkit-scrollbar` rules,
  keeping `scrollbar-color` only for engines without them.

---

## 0.3.1 (2026-09-26): Player's Handbook v3.3

What the second look at 0.3.0 found.

### Changed

- **The attack dialog no longer offers the attacker a choice of the defender's Defense.** It states
  the defender's answer, "Evade (10) · stance", and that is that: the defender decides, and to be
  answered differently the defender changes their stance on their sheet or Token HUD. The answer is
  still read again at the moment of the roll. A caller can still force a Defense in code, for a
  Talent that targets Awareness or Endure specifically; the dialog then shows the forced one.

### Fixed

- **The character sheet's tabs could not be scrolled.** Not a scrollbar problem: Foundry keeps a
  window's content at `overflow: hidden` on purpose and expects the tab to claim the remaining
  height and scroll it, and ours never did, so everything below the fold was simply clipped with
  no bar at all. The active tab now flexes to fill the window and scrolls, on every sheet.
- **The roll dialog's labels and hint were unreadable on the light UI theme.** Two causes. DialogV2
  wraps its content in its own `<form>`, so the template's nested `<form class="check-dialog-form">`
  was dropped by the parser and every rule on that class, the label colour included, had been dead
  since the dialog was written; the wrapper is a `<div>` now. And Foundry colours form labels and
  hints from theme variables that, under the light UI theme, are dark ink meant for parchment, on
  our night background. The dialog now sets those variables to its own ink.
- **Dropdown lists in the system's windows washed out.** The browser draws a select's list from the
  element's colour scheme rather than its CSS, so it painted our light ink on its own white list.
  The system's selects now declare a dark colour scheme.

---

## 0.3.0 (2026-09-26): Player's Handbook v3.3

The first playtest's findings.

### Added

- **Targeting, made visible.** An arrow on the map from each token to whatever it is targeting, in
  the targeting player's colour, for everyone who can see both tokens; a line under each combatant
  in the Combat Tracker naming its targets; and a red tint on the rows of whoever the active
  combatant has in its sights. Foundry's own indicator is four small brackets only the targeting
  player sees. Targets are written onto the token as they are acquired (`flags.starwrought.targets`),
  so they belong to the creature rather than the user, survive a reload, and are readable by every
  client. A Strike falls back to the one remembered target when you have no live one. Ending the
  combat clears every remembered target on the scene. Client setting `showTargetArrows`.
- **Stance: the defender chooses.** "The defender decides whether to Evade or Guard", and the attack
  dialog had been asking the attacker. Every actor now carries a stance, Evade or Guard, shown as
  two chips in the sheet header and as a button on the Token HUD, one click to flip. The attacker's
  roll reads it: the dialog preselects the defender's stance and marks it, keeps all four Defenses
  for the table that rules otherwise, and the card names whichever was used. The stance and the
  Threshold are read again at the moment of the roll, so a defender who flips while the attacker's
  dialog is open is answered with the Defense they flipped to. A change of stance during an
  encounter is announced in chat. "Evade is unavailable while you are Grabbed or Restrained": a
  Grabbed defender's Evade is marked unavailable on the chips, the HUD and in the dialog, which
  preselects Guard instead; choosing it anyway is allowed and says so.
- **The Unwieldy penalty is applied.** A Strike with an Unwieldy N weapon against a target within N
  feet takes its −2 circumstance penalty automatically, measured edge to edge on the grid with the
  same arithmetic as the reach band, and the card's modifier line says so. Ranged weapons with the
  trait are handled the same way. The Grabbed clause is announced rather than enforced: a warning
  to the attacker and a card in chat, and the roll posts.

### Changed

- **The compiled packs leave git.** They are LevelDB, and a Foundry running against the linked repo
  folder rewrites their log and manifest files every time a world opens, which dirtied the tree on
  every session and invited committing a half-written database. `packs/_source` is committed
  instead, and the release workflow runs `build_foundry.mjs` to compile it before packaging.

### Rulings

Readings the handbook does not settle, taken so the code could be written, and flagged here so
they can be overruled in the text.

- **"Within N feet" is a gap of N or less.** The handbook measures reach edge to edge and treats a
  target at exactly your reach as in reach, so the same inclusive reading is applied to Unwieldy's
  "within N feet". The alternative, strictly less than N, made a Spear's Unwieldy 3 band a square
  ring three cells deep on every side (9-by-9 around a Medium token), which is what the playtest
  saw and read as a bug. It was not a bug under either reading: on a one-foot grid with exact
  diagonals the corner cell two across and two up sits at 2.83 feet, inside 3 either way. The
  inclusive reading adds the cells at exactly 3 feet along each axis, which at least makes the shape
  read as the arithmetic it is.

### Fixed

- **A blank Threshold in the roll dialog was read as zero.** Foundry hands a blank number box back
  as null, the guard let null through, and `Number(null)` is 0, so every untargeted roll of 10 or
  more was a Critical Success with no Threshold line on the card to explain it. A blank box now
  means no Threshold is known. Pre-existing, found while the dialog was being reworked.
- **A check's caller-supplied modifiers were silently dropped.** `SwCheckConfig.modifiers` was
  documented and defaulted and never read: `SwCheck.roll` built its parts from the sheet and the
  dialog alone. Anything a caller worked out for itself, which is now how the Unwieldy penalty
  arrives, went nowhere. Fixed; the parts now include them.
- **Scrollbars on the character sheet were still thin and dim on some elements.** The bright bar
  was applied by a list of tag names, and Foundry sets its own thin dim bar on every element from
  inside a cascade layer, so any element the list missed kept Foundry's. The rule is now `*` as
  well; unlayered styles win over layered ones regardless of specificity, so it takes everything.
  The one bar core hides on purpose, on the collapsed-sidebar chat overlay, stays hidden.

---

## 0.2.0 (2026-08-27): Player's Handbook v3.3

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

## 0.1.0 (2026-08-27): Player's Handbook v3.1

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
