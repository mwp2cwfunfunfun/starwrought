# STARWROUGHT for Foundry VTT: changelog

Every entry names the Player's Handbook version its content was built from. A handbook change is
not finished until the spreadsheets, the web app, this system, its `FEATURES.md` and this file have
all caught up; `node assets/build_all.mjs` checks that mechanically and refuses to pass while the
handbook on the shelf is newer than `data/SYNC.json`.

---

## 0.4.1 (2026-10-01): Player's Handbook v4.10, the Enabled? gate and Counter at Expert

Two rulings from the author after 0.4.0 shipped, recorded as rulings 60 to 63 in
`v4.10-sync-report.md`. The handbook did not move.

### Added

- **The spreadsheets decide what ships.** Every talent sheet but Lore's, the Backgrounds sheet and
  the action sheets now carry an `Enabled?` column. A row reading Yes ships to Foundry; anything else (blank,
  No) is authored but not visible: no compendium document, no chargen card, no picker entry, no
  Basic Action. A sheet without the column is wholly enabled, since its absence means the sheet has
  not been curated yet (Lore, Languages). A Constellation ships when its Root does. The converter
  keeps every row in `trees.json`, `backgrounds.json` and `actions.json` with an `enabled` flag, so
  the web app and the Constellation Compendium still show the whole book; it warns when an enabled
  Talent sits under a disabled Root, requires a disabled Talent or hands over a disabled Talent
  free, and when an enabled Background grants a disabled Skill. `build_foundry.mjs` writes only the enabled
  documents (document ids are unchanged, so enabling a row later restores the same UUIDs), keeps
  every Constellation in `content/constellations.json` with its flag so a character who already
  owns a Talent of a now-disabled Constellation still resolves it, and stamps the enabled counts
  into `content/sync.json`. Today that is 11 of 31 Constellations and 37 of 177 Talents (Human,
  Serrovane, Evade, Guard, Acrobatics, Athletics, Melee, Lore, Weaponmaster, Dueling and Great
  Weapon Fighting; Lore ships whole because its sheet has no column yet), one Background (Acrobat),
  one Calling (Weaponmaster), one Bloodline (Torchbearer Human) and no Basic Action. The converter also warns that
  Drilled is enabled while the Weapon Familiarity it hands over is not.
- **Chargen with gaps.** Step 0 offers only the Weapon Training whose Root ships (Melee today). A
  card step with nothing enabled says so and lets you continue without a pick; a point slot whose
  named Constellation has no enabled Root, or nothing enabled left to buy (a Calling's free
  Training in a Skill the Background already Trained, with only its Root enabled), says so instead
  of opening an empty picker. The review keeps the book's floor of 14 Talents and also names the
  floor reachable with what is enabled, counting each directed point against the enabled Talents
  that could take it, and measures "short" against that.

### Changed

- **Melee Training grants one Reaction, not two.** Intercept ❶↺ comes with the Root as before.
  Counter ❶↺ now arrives at Expert rank in Melee (the derived rank, which counts a Combat Style's
  points once the Root is owned). The stance chip, its tooltip, the Reaction's hint, the roster's
  Reaction table, the Constellation Compendium, the character sheets, the web app's Reactions
  checklist and the Melee Training Talent's own Effect (reworded in `data/weapons.xlsx`) all say
  so, and a refused Counter stance names the Expert gate. A character saved holding a Counter
  stance at a Melee rank below Expert answers with the basic Defense: the roll sets the stance
  aside with a note, and a one-time world migration (stamped 0.4.1) moves the stored stance back
  to its basic Defense. Adversaries are unchanged: their Reactions are the GM's to declare. The
  handbook still prints Counter under Melee Training; the book is the author's to bring across.
- **Nine Effect cells mended.** Excel's re-save when the `Enabled?` column was added dropped the
  line-break runs that openpyxl had written without `xml:space="preserve"`, welding bold headings
  to the label after them ("PressRequirements"). The cells (Rage, Combat Grab, Missile
  Skirmishing Training, Spear & Polearm Training, Short Grip Strike, Quick Tongue, Rally, Talk
  Them Down, Command the Field) are restored with the line break folded into the heading's run,
  and the converter now warns on any Effect that reads that way.
- **Aid ships nowhere for now.** It is the one row of `data/actions.xlsx`, it is not enabled, and
  the sheet is authoritative for any action it names, so the roster's Aid row stays retired. Enable
  the row and it returns under the same document id.

---

## 0.4.0 (2026-09-28): Player's Handbook v4.10

Not a point release of the rules. Player's Handbook v4.10 rewrites the combat engine, and every
consumer moved with it: the spreadsheets, `roster.json`, the web app, the character sheets, the
Constellation Compendium and this system. The rulings taken where the book is ambiguous are in
`v4.10-sync-report.md` at the project root, numbered, with the questions left for the author.

### Added

- **Six actions a round, spent across Opportunities.** Every combatant receives six actions at the
  start of each round (an adversary its own `actionsPerRound`; Slowed N loses N), and unspent ones
  expire at the end. A Foundry turn is an Opportunity: one Maneuver, or Pass. The turn order wraps
  within the round; a full circuit of Passes ends it, counted as a pass streak on the Combat and
  shown in the tracker header. Pass is a button on the sheet's pips and on the tracker row, live
  only at your own Opportunity; End Opportunity moves play on without Passing. Only an explicit
  Pass counts, or a combatant who cannot act. A table with no GM keeps the streak in memory on one
  elected client. Tracker rows show actions left, the reserved count and an hourglass while
  Preparing.
- **Prepared Maneuvers.** A Committed Strike in an encounter spends one action, reserves two, marks
  the actor Preparing and posts a card; a second card with Finish and Abandon posts when the next
  Opportunity begins. Finish rolls the Strike already paid; Abandon returns the reserve and loses
  the action. A Wound or going down abandons it, a new preparation replaces it, and one that never
  reaches its Opportunity expires with the round. Pass is refused while Preparing.
- **The Exchange.** Three Strikes on every weapon row, ❶ Quick, ❷ Deliberate, ❸ Committed, each
  with its own damage, placement and critical rules; a Quick Strike cannot Critically Hit unless
  the weapon is Agile, and a denied 20 is a Hit that still offers a Flare. The attack card grows a
  Position block once the Result is read: Expose the attacker (any Miss; a Graze against a
  Committed Strike), Form Bind or Take Control when the defender Guarded with a rigid implement,
  the riposte after a Parry, Give ground 3 ft or Step when the defender Evaded, Expose the defender
  on a Committed Hit or a Deliberate Critical Hit, and the Counter's Quick Strike back. Every
  button is an offer to the side the rule favours and is shown only to that actor's owner.
- **Reactions from the same six.** The stance grew from two answers to five: Evade, Guard, Void
  (Evade +2 Situation, Evade Training), Parry (Guard +2 Situation, Guard Training and a rigid
  implement) and Counter (the better basic Defense and a Quick Strike back, Melee Training). The
  attack reads the stance at the roll, folds the +2 into the same Situation stack, charges the ❶ to
  the defender as the roll resolves and drops the stance back to its basic Defense; a Charge button
  covers the case where the attacker's client does not own the defender. A Defense roll against an
  Attack Threshold offers the roller's Reactions in the dialog. A Head Wound blocks Reactions. The
  Token HUD cycles through the stances the actor can actually take.
- **Intercept.** When a Move or Rush carries a token from outside a hostile token's Total Reach to
  inside it, sampled along the path, a card goes to that foe's owners: a Quick Strike button for a
  character (paying ❶↺), or an attack button for an adversary that pays its ❶ and hands the mover a
  Defense roll against the attack's Threshold. Offered only to a foe with Intercept, once per foe
  per move, and never blocks the move.
- **The Bind.** `system.bind` on every actor: neutral, Controlling or Controlled, with the partner
  and both implements named, mirrored onto the partner when one client owns both and otherwise
  left for its owner with a note. Three token statuses (Bound, Controlled, Controlling), a Bind line
  in the sheet header with End Bind, a −2 Situation penalty to attacks with a Controlled weapon, and
  the endings the book lists: a Strike between the two, Recenter, stowing the implement, a
  Controller struck by a third party, and attacking with a weapon other than the Bound one.
- **Support.** +1 Situation to a melee attack per other conscious ally whose Total Reach includes
  the target, to +2, computed from the tokens on the scene, sharing a type with Control's penalty.
- **Vigor, Spent, Wounds per Zone, and Dying from a final Wound.** Vigor is the header bar (10 +
  Ancestry + Calling Vigor at 1st, both again each level; Temporary Vigor drawn on top). At 0 you
  are Spent, a status, not down: every Hit then Wounds the Zone struck, two on a Critical Hit. A
  Critical Hit with a Deliberate or Committed Strike on an Exposed Zone Wounds it; Massive Wounds on
  any Critical Hit; a Graze never Wounds; nonlethal knocks a Spent creature out instead. Each Zone
  counts Wounds against a capacity by Size (2, Large 3, Huge 4, Gargantuan 5, plus an adversary's
  `woundBonus`), with the first effect repeated until the final one: Arms −2 Situation to attacks
  and Guard then useless; Legs Speed halved then Prone; Torso Off-Guard and 1d4 bleed then Dying;
  Head no Reactions then Dying and unconscious. A Wound to a useless limb goes to the Torso; a full
  Torso or Head Wounded again while not Dying begins Dying again. Dying starts at 1, or 2 from a
  Critical Hit, and damage while Dying raises it instead of Wounding. Recovery is Endure against
  10 + Dying + Wounds carried, at the start of each round, prompted by a card. Treat Wound is a
  link on the Zone: Endure against 10 + Wounds carried, ten minutes, one Wound off on a success.
  Refusing Death leaves you Spent and unconscious with your Wounds. A night's rest heals no Wound.
  Wound cards and the applied card say what the body did.
- **Movement in Moves, Steps and Rushes.** A drag within half your Speed and clear of difficult
  terrain is a Step ❶ and never provokes; a straight drag longer than three Moves and within your
  Rush distance is a Rush ❸, charged at once; anything else is one Move ❶ per Speed's worth,
  rounded up, with a note that two Moves is two Opportunities' worth. The card says which and why.
  The drag ruler colours squares pale mint for a Step, one colour per Move (gold first, six in all),
  orange for a Rush and red past what you have left, and the label prints `❶×2` or `❸ Rush`. The
  sheet prints Speed, Step, Rush and Leap; Load Strain comes off Rush and Leap.
- **Round cards.** Recovery at the start of a round while Dying (setting `autoRecovery`, moved from
  the actor's turn to the round); Wind at the end of the third round and after for anyone with Load
  Strain 1 or more, Endure against 10 + Load Strain or Fatigued (−1 Evade and Guard), with the
  status set on a failure; Persistent Damage at the end of every round, rolled fresh from the card,
  with an Endure button to end it and a note that the Torso bleed closes only with the Wound. A
  Zone Exposed by a Posture clears at the end of the round, and Recenter leaves it alone.
- **Melee and Ranged as parents.** Two Weapon Constellations replace Weapons. Every Combat Style
  names one as its parent (a `Parent` column in `combat_styles.xlsx`, `parent` in `trees.json`,
  `parentSlug` on the Constellation Item and `parent` in the content index); a child's points count
  toward the parent's rank once the parent's Root is owned, rank only, Attribute Points counted
  once. The sheet shows a parent's pool and inherited points and a Combat Style's "child of" line.
  `strikeAttributeFor(weapon)` picks the higher of the weapon's natural Attribute and a Combat
  Style's Key Attribute when the weapon's new Style field names a Style whose Root you own.
- **Helms and the Parry trait.** A Closed helm is −2 Situation, an Open helm −1, to Awareness
  checks, the Awareness Threshold and Initiative, matched by the Head piece's name. The Parry
  weapon trait is +1 Gear to Guard while the weapon is held, sharing its type with a raised shield's
  bonus. Flexible, Massive and Unparryable are parsed from trait lines; `rigid` is derived, and a
  bare hand (the Natural Weapons group) is not rigid.
- **Chargen for v4.10.** Step 0 chooses Melee Training or Ranged Training, granted free, each card
  naming the Combat Styles that count toward it. Two Defense Talent Points on two different Defenses
  beside a threat-coverage panel that names the gap. The review prints the Vigor formula, points ÷ 4,
  Trained +3 and the count against the 14-point floor.
- **The Maneuvers pack and the sheet's Maneuvers tab.** The Actions pack is "Maneuvers & Activities",
  regrouped as the book groups them (Motion; Attack; Defense & Recovery; Watching, Deceiving &
  Helping; Handling Things; Special), with Move, Rush, Gain Control, Close, Parry, Void, Counter,
  Intercept and Pass added and a Reactions folder for the Talent-granted Postures (Give Ground, Set
  Your Feet, Posture). Maneuvers and Talents carry the Reaction trait as a flag with its own cost, so
  Aid prints "❶ (⓿↺)". The Item sheet has the cost select over passive and ⓿ to ❻, a Reaction ↺
  checkbox and a Reaction cost. Using a Reaction Maneuver from the sheet spends its cost.
- **Adversaries** carry Vigor typed directly, `actionsPerRound`, `woundBonus`, Wounds per Zone with
  Treat and adjusters, the five stance chips, a Reactions panel, and one Threshold per attack.
- New templates: the stance chips, action pips, Bind line and Wound pips as shared partials, and the
  Wound card. New Handlebars helpers `swActionGlyph` and `swStrikeGlyph`. `minGapAlongPath` in the
  canvas geometry, so the Intercept trigger uses the same edge-to-edge arithmetic as reach.

### Changed

- **No level term in any check.** d20 + Attribute Bonus + Proficiency Bonus + typed bonuses; a
  Threshold is 10 + the same. Defenses, attacks, Initiative and the derived Thresholds all dropped
  it. Adversary Thresholds typed on a sheet are unchanged.
- **Ranks are +3 / +6 / +9 / +12**, gated at levels 1 / 5 / 10 / 15 and 1 / 4 / 9 / 16 points.
  The plates' ring labels say so.
- **Attribute Bonus is points ÷ 4**, rounded down, still capped at +5 (the Key Terms cap is kept
  until the book repeals it; ruling 1).
- **Weapon dice** step at 4th, 8th, 12th and 16th level (were 4th, 12th and 19th).
- **Speed is feet per Move on the one-foot grid.** A Human's is 6; Step is half, Rush five times
  less Load Strain, Leap 10 feet less Load Strain, Crawl 3. Every chassis Speed was re-read from the
  book.
- **Two Defenses at creation, not four.** Trained in all four is no longer granted; two Defense
  Talent Points buy two different Roots.
- **Raise a Shield lasts until your next Opportunity**, and the bonus is derived from the shield's
  raised flag rather than written into the Guard adjustment field. The tracker lowers the shield
  when the Opportunity begins.
- **Recenter** ends any Bind you are in and leaves a Posture's Exposed Zone alone.
- **Protection is 0 on an Exposed Zone only against a Deliberate or Committed Strike.** A Quick
  Strike, and damage that is not a Strike, meets it in full.
- **Zone placement follows the Strike.** A Quick Strike lands on the Torso; a Deliberate or
  Committed Hit may take an Exposed Zone; a Graze is the defender's choice; a Critical Hit the
  attacker's.
- **A raised shield's and a Parry weapon's Guard bonuses are Gear** and do not stack.
- **Conditions** now register 24 token statuses: Spent, Bound, Controlled, Controlling and Preparing
  join the list; Wounded is a single status backed by the per-Zone counts. `conditionValue("wounded")`
  returns the total carried.
- **Naming.** Hit Points are Vigor, Stride is Move, the turn is an Opportunity, Actions are
  Maneuvers (the Actions tab is labelled Maneuvers and keeps its id), "Actions & Activities" is
  "Maneuvers & Activities", the Weapons Constellation is Melee and Ranged, and the cost glyphs are
  ⓿ ❶ ❷ ❸ ❹ ❺ ❻ with ↺ for the Reaction trait. The v3 glyphs ◆ and ◇ still parse everywhere.
- **`showStrideBands` is `showMoveBands`**; the 0.3.x client value stored under the old key seeds
  the new setting's default once, at registration, so a player who had the bands off keeps them
  off. The `autoRecovery` hint now says the check is made at the start of each round.
- **Token resource bars** track `vigor`; `primaryTokenAttribute` is `vigor`; `actions.value` and an
  adversary's `actionsPerRound` are trackable.
- **The converter** (`xlsx_to_trees.py`) validates the `Parent` column (must name a tree, one level
  only, not itself), reads the ancestry index header as Vigor or HP, writes both `vigor` and `hp`
  into the roster's ancestries block for one release, parses ⓿ ❶ to ❻, ↺ and a bracketed Reaction
  cost such as "(⓿↺)" as well as the v3 glyphs, strips glyphs and the trailing cost joiner for
  Requires matching and slugs, and writes `reaction` and `reactionCost` into `actions.json`.
- **`build_foundry.mjs`** carries the parent onto the Constellation Item and the content index,
  writes the Reactions folder from the roster's `postures` block (skipping the four that are also
  Maneuvers so nothing ships twice), keeps a sheet action's document id when it takes a roster row
  over, and reads Vigor from either key.
- **The Constellation Compendium** gained "Rank Math, Attributes and Checks", a Reactions table, a
  "Vigor, Wounds and Dying" appendix, an introduction to the Maneuvers appendix, Shields and Weapons
  paragraphs, parents in the Combat Style headers, and glyph runs in Segoe UI Symbol so ⓿ prints.
- **The character sheets** (fillable and Mira) were rebuilt for v4.10: Vigor with Spent, Wounds per
  Zone with both effects, Speed / Step / Rush / Leap, six action ticks and a Reserved box, Melee and
  Ranged, a Strikes table with the Strike Attribute, a Reactions block, a Bind line, and a reference
  strip; Mira is a Melee Training, Evade and Awareness build at Vigor 20 and Speed 6.
- **The web app** moved with the rules: ÷ 4, no level, ranks +3 to +12 at 5 / 10 / 15, Vigor and
  Spent, Wounds per Zone applied to the derived numbers, Melee and Ranged as parents with the pool
  shown, the threat wheel, two different Defenses at creation, Melee or Ranged Training at step 0,
  Speed in feet, the Recovery Threshold, and a Maneuvers wiki section that an old "Actions" bookmark
  still lands on. The smoke test checks the new pools and that no v3 vocabulary survives in the wiki.
- **`data/README.txt`** documents the `Parent` column, the Vigor header and the v4.10 glyphs.

### Removed

- **The Multiple Attack Penalty**, its Agile ladder, the per-turn attack counter, the `trackMap`
  setting and its hooks, and the adversary sheet's three-step Threshold ladder. `resetAttackCount`
  is exported as a no-op until its callers are gone.
- **The reaction slot** (`system.actions.reaction`). Reactions are paid from the six.
- **The numeric Wounded value.** Wounds are per Zone; an old count had no Zone to go to and is
  dropped by the migration.
- **Stride, Delay and Ready** rows from the roster and the pack; Move, Rush and the Pass row take
  their place.
- **The Task-level Threshold table.** It dated from a baseline where a check carried a level term;
  the roster key stays as an empty list so its readers survive.
- **The Postures table as a table of its own.** The roster's `postures` block is the Reaction table
  now, and its rows ship as a Reactions folder.

### Migrations

The key renames run on first load, in `migrateData`. The Speed conversion is a one-time world
migration: the first GM to open the world runs it at `ready`, it is recorded in the `systemVersion`
world setting, and Speed is stored as typed from then on (a per-load heuristic would have quartered
any v4.10 Speed of 15 or more for ever).

- Actors: `hp` to `vigor` (value, max, temp); `wounded` dropped; `actions.reaction` dropped;
  `details.ancestry.hp` and `details.calling.hp` to `vigor`; `bonuses.hp` to `bonuses.vigor`. The
  world migration brings a stored Speed of 15 or more (a v3 value on the five-foot scale) to
  Speed ÷ 4, so 25 becomes 6, on world actors, world chassis Items and chassis in unlocked packs,
  and says how many it changed. A scene token whose own delta overrides Speed is not visited;
  correct it by hand.
- Items: cost keys `free` to ⓿ and `reaction` to ⓿ with the Reaction flag; a Talent's cost `0` to
  `passive`, and so an Exploration Mode or Downtime Mode Activity's; a Talent filed under the
  retired Weapons slug refiled under Melee (a character whose training was really Ranged moves it
  by hand); a chassis's `hp` to `vigor`; a Constellation's `parent` to `parentSlug`. A Constellation
  Item still carrying the Weapons slug on a character is ignored when the skies are drawn.
- Data: Loose and Move moved from Archery to Ranged, so its compendium id changed with its
  Constellation. A character holding the Archery copy keeps a working Item under the old id, and
  the system files it under Ranged when it prepares the Talent (`MOVED_TALENTS`), so its point
  counts where the book now says.

### Fixed

- **The web app's Endure relief table** read Trained 1 / Expert 2 / Master 3 / Legendary 4 since
  v3.2. Endure Training has relieved 1 at Expert, 2 at Master and 3 at Legendary since then; the
  table now agrees with the Talent and with the system.
- **The converter's name normaliser** dropped only the v3 glyphs, so a Requires cell naming
  "Kip Up" could not match a talent renamed "Kip Up ❶". It strips every cost glyph, a bracketed
  Reaction cost, and the trailing "to" or "or" of a range.
- **The plate renderer** printed a box for ⓿, which DejaVu Sans lacks; it substitutes the nearest
  glyph the font has.
- **The rank rings on the plates** still said Master at L13 and Legendary at L19.

The rest of this list is the adversarial review of the sync (2026-10-01; 44 findings, 40 confirmed,
all applied before the release was stamped; rulings 51 to 59 in `v4.10-sync-report.md`).

- **A Strike made as a Reaction** (Counter, Intercept, the riposte) read and charged the target's
  own Reaction stance, so a Countered fighter in Parry met the attack at +2, paid ❶ and was offered
  a Counter back. It meets the basic Defense only: a Reaction never triggers a Reaction. The
  mover answering an adversary's Intercept likewise rolls the basic Defense, with no Reaction
  offered in the dialog.
- **Counter answered arrows.** A Counter stance was honoured against any attack, charging ❶ and
  offering a Quick Strike back at a bowman thirty feet away. It answers only a melee Blow from a
  foe within Reach; anything else meets the better basic Defense, charges nothing, and the card
  says so.
- **The Bind was offered for whips, Unparryable attacks and arrows**, and never recorded the
  attacking weapon, so the Controlled −2 keyed on the attacker's first held weapon rather than the
  one that was Stopped. The offer requires a bindable attack, the card says when there is nothing
  to bind, and both weapons travel from the card into the Bind.
- **`STRIKE_KINDS.exposeOnMiss` was never read.** It is now the switch the Position block consults,
  and a Quick Strike's Miss Exposes the attacker as the Result table says (ruling 51).
- **Zone Protection double-counted the Zone bonus** on an unarmored Zone of a character, because the
  derived display number already carried it. The raw armor number and the bonus are now separate.
- **The Speed ÷ 4 conversion ran on every load and every update**, so a v4.10 Speed of 16 was
  stored as 4. It is a one-time world migration (see Migrations).
- **A world Constellation Item from 0.3.7 wiped its parent** out of the registry for the whole
  world, because its blank `parentSlug` overwrote the index. A blank world parent falls back to the
  registered one.
- **Movement read the stored Speed, not what the Legs allow**, so an adversary's Legs Wounds never
  reached the ruler or the charge, and a Speed of 0 (the final Legs Wound) was read as the default
  6. Movement reads `moveSpeed`, and a Speed of 0 is charged as **Crawl ❶ per 3 feet**, which never
  provokes; the ruler and the card say Crawl.
- **A lone combatant got six fresh actions on every Next Turn**, and lost its Prepared Maneuver
  with them. Only its Pass ends the round now; any other Next Turn is its next Opportunity.
- **Turning `trackActions` off also switched Intercept offers off.** The gate wraps only the spend;
  classification and the offer run regardless.
- **The Intercept answer card rolled the mover's Defense against whatever they had targeted**
  instead of the interceptor. The button carries the interceptor, so the Position offers name and
  act on the right foe.
- **The old `showStrideBands` value was never read**, although the docs said it was. It seeds the
  new setting's default at registration.
- **Exploration and Downtime Activities printed ⓿** ("Free action"), because they were built with
  the v3 cost key "0". They are passive, in the build and in a 0.3.7 world copy.
- **The adversary sheet listed Parry, Void, Counter and Intercept as "Reactions it has"** for every
  creature. The panel lists only the creature's own Reaction abilities; the four stay live on the
  stance chips for the GM to declare.
- **The weapon sheet's Bind-trait hint never rendered**: it read the trait flags from the wrong
  path.
- **A stance chip disabled by a Head Wound said "needs Evade Training"** to a character who owned
  it. The chip and the token HUD say "You cannot use Reactions." instead.
- **The Equipment tab's attack number omitted the Arms Wound's −2** that every roll applied.
- **The chargen footer called the Background's Lore a free Root.** It is a spent Lore Talent Point,
  as the book and the wizard's own slots say.
- **A ranged weapon in hand counted as a rigid implement on the sheet but not at the roll.** The
  Actor document now trusts the data model: a weapon without the Flexible trait, or a shield.
- **Travel speed in miles per hour** rounds down (Math Conventions), on the sheet and in the app.
- **The web app** counted a Combat Style's points toward Melee or Ranged without the parent's Root
  (ruling 13), dropped a v3.4 Archery "Loose and Move" silently, applied an Arms Wound to Guard but
  not to attacks, halved Speed once whatever the Legs held, printed "1.5 mph", and imported a JSON
  character without migrating it. All six are fixed and the smoke test covers them.
- **The character sheets** clipped Mira's page-2 details at the page edge, dropped the last clause
  of three reference-strip sentences without a word, painted two section captions past their bars,
  ignored her rapier's Parry trait (+1 Gear to Guard), and counted the three Origin points twice
  in the build note. A line that no longer fits fails the build.
- **The plates** matched Requires against glyph-free names with a v3 stripper, so Kip Away and
  Aggressive Block ⓿ hung off their roots; printed a bare "0" for ⓿ (DejaVu Sans has neither ⓿
  nor ⓪); and the retired Weapons plate was never pruned and shipped in the system. The renderer
  prunes what it did not render and `build_foundry.mjs` mirrors it.
- **`data/README.txt`** still said Category must be "Save", that "Defense" was not in the
  converter's vocabulary, and used a Golarion proper noun as its example; `check_style.py` scans it
  now. **The converter** says so when no actions workbook is present and `actions.json` is left as
  found.

---

## 0.3.7 (2026-09-26): Player's Handbook v3.4

### Added

- **Actions are authored in a spreadsheet** (Mike, 2026-09-26). `data/actions.xlsx` is the first
  workbook that is not a Constellation: its index lists actions by Name and Type, its sheets hold
  one action per row (Action, Cost, Traits, Prerequisites, Requirements, Trigger, Description,
  Effect, Automation), and the converter writes `assets/actions.json` from it. The sheet is
  authoritative for any action it names: the roster's row of the same name retires from the
  compendium, the web app and the Constellation Compendium, under the same document id, so an Aid
  already sitting on a character keeps its link. Roster rows the sheet has not reached stay put.
  Aid is the first, and its text now differs from Player's Handbook v3.4 (a single action with a
  Relevant Check, rather than a prepared reaction): the sheet ships as written, and the handbook
  is Mike's to bring across.
- **Basic Actions on the Actions tab.** Every character's Actions tab opens with the Basic Actions,
  grouped and foldable, read straight from the compendium rather than copied onto the sheet, so a
  rewrite in the spreadsheet reaches every character on the next build. Click a name to use it as
  that character (the card goes to chat, or the check it calls for is rolled), or copy it down to
  make it the character's own. The sheet's `Basic Action` type and the roster's Encounter Mode
  rows carry the flag; Exploration, Downtime and Postures do not.
- **Actions carry an Effect, Prerequisites and Automation notes.** Effect is the rules text,
  Description the flavour line above it, and the card prints both. The Automation column travels
  with the action onto its Item sheet as notes; nothing acts on it yet, and that column is where
  the talent-automation grammar will land once it has one.
- **Targeting arrows follow a drag** (Mike, 2026-09-26). While a token is being dragged, its
  arrows and their distances are drawn from the drag clone on the dragging user's own screen,
  whichever end of the arrow is moving, so the number shown is the one the move would produce and
  a player can stop where a target comes into reach, or leaves it, before the move is paid for.
  Everyone else's arrows stay on the committed square and catch up on the drop, because the drag
  clone exists only on the client doing the dragging. The reach bands already did this; the
  arrows now do the same.

### Changed

- **Weapon traits are Situation** (Mike's ruling, 2026-09-26). Gear is reserved for something
  intrinsic to the piece itself: a raised shield's bonus, a weapon's quality, later a magical
  property. Parry, Sweep and Unwieldy describe the moment, not the weapon. This closes the question
  the 0.3.6 rename left open.
- **The converter reads a workbook that is open in Excel** from its last saved version instead of
  skipping it. Skipping wrote a `trees.json` without the open workbook's trees, and nothing said so
  loudly enough.

### Fixed

- **The Constellation Compendium printed `<br>` as text**, 145 times, wherever a cell had a line
  break. The rich-text formatter now breaks the line.
- The web app's How to Play callout still named the retired bonus types.

---

## 0.3.6 (2026-09-26): Player's Handbook v3.4

### Added

- **Relevant Check** (Mike, 2026-09-26): a roll whose Constellation the actor chooses, subject to
  their justification and the GM's approval, which is how Aid is being written. A button on the
  Constellations tab and a macro open a picker of every Constellation at the character's rank,
  Trained first by modifier, Untrained after, with a line for the reason and an optional Threshold.
  The modifier beside each name is the check engine's own, so a Might Skill under Load Strain
  ranks where the roll will land rather than where the training alone would put it. The roll is
  an ordinary check in the chosen Constellation, so a critical can Flare it, and the card's
  subtitle names the Constellation and the reason, which is what the GM approves. Adversaries
  get a warning instead: they carry Thresholds.

### Changed

- **The bonus types are Situation, Condition and Gear** (Mike, 2026-09-26). They were circumstance,
  status and item, which echoed another game's words for the same three ideas. The stacking rule
  is unchanged: highest bonus and worst penalty of each type, added across types. Situation is
  where you stand and what is happening around you (cover, high ground, an ally's help, a foe
  Off-Guard); Condition is something on you (Frightened, a stance); Gear is what you hold or wear
  (a raised shield). The engine still understands the old names, so a macro that passes typed
  modifiers under them lands in the right bucket; Active Effects never carried a type, since they
  can only move the sheet's untyped adjustment fields. One thing the rename deliberately did not
  decide: every weapon trait the book prints (Parry, Sweep, Unwieldy) grants a Situation bonus or
  penalty, which under a source-based scheme reads as Gear. They stay Situation until Mike rules.
- **Player's Handbook v3.4**, written from Mike's v3.3 by `assets/phb_edit.py`, which gained a
  rename mode: it swaps a type word only where it qualifies a bonus or penalty, so "an item, a
  spell" is untouched while "the item bonus to Guard" becomes "the Gear bonus to Guard", and it
  refuses if Word has split the word itself across runs. It also catches the handbook's elided
  form, "+2 circumstance to Evade", which the condition table uses throughout. Nine paragraphs and
  sixty table cells change (82 words), the stacking paragraph gains a sentence naming the three
  types before its examples, and the edition line on the cover moves. Nothing else in the file is
  touched, and no old type word survives in either form.
- **The spreadsheets are being brought across by hand** during the automation pass, so
  `check_style.py` now reports, as an advisory count per file, how many old type words remain in
  shipping content. `data/SYNC.json` stays at v3.3 until that pass is done, so the drift check
  keeps saying so.

---

## 0.3.5 (2026-09-26): Player's Handbook v3.3

Two things the wizard made harder than they needed to be.

### Changed

- **The whole Talent card is the button.** Buying a Talent in the wizard meant clicking its name,
  and only its name: a target one line high, with nothing to say so. The card is now the button,
  lights up gold on hover the way the Constellation chips do, and works from the keyboard.
- **The wizard says when the thing blocking Next is below the fold.** A greyed Next and a small
  footer link were the only cues, and a step with its unspent point out of sight read as "Next is
  broken". Now a bobbing "A point is still to spend below" badge sticks to the bottom edge of the
  pane while that is true (click it to jump), the footer line reads "Next needs: Trained in
  Acrobatics" with an arrow that appears when it is below, and Next's own tooltip names it.

---

## 0.3.4 (2026-09-26): Player's Handbook v3.3

### Added

- **A stale-copy warning.** The "missing scrollbar in Edge" of the last three releases was never
  Edge and never the stylesheet: the server sits behind Cloudflare, which rewrites Foundry's
  `Cache-Control: no-cache` into a four-hour browser cache and caches the files at its own edge, so
  a browser that had visited recently kept the old stylesheet while a fresh one got the new. Every
  file is affected on every update, scripts and templates as much as styles, and the result is
  indistinguishable from a broken release. Foundry reads `system.json` on the server, so
  `game.system.version` is always current; the code and the stylesheet now each carry their own
  version stamp, and at load the system compares all three. A mismatch posts a persistent warning
  naming what is stale and telling the player to hard-reload. `assets/package_system.mjs` refuses
  to package unless the three stamps agree, so a release cannot ship warning about itself. The
  README says how to turn the caching off at Cloudflare, which is the actual fix.

---

## 0.3.3 (2026-09-26): Player's Handbook v3.3

### Added

- **Targeting arrows carry the distance.** Each arrow is labelled with the gap to its target,
  measured edge to edge in whole squares with exact diagonals, the same arithmetic as reach and
  the Unwieldy penalty. Gold when the target is within the source's Total Reach, plain otherwise.

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
