# STARWROUGHT for Foundry VTT: changelog

Every entry names the Player's Handbook version its content was built from. A handbook change is
not finished until the spreadsheets, the web app, this system, its `FEATURES.md` and this file have
all caught up; `node assets/build_all.mjs` checks that mechanically and refuses to pass while the
handbook on the shelf is newer than `data/SYNC.json`.

---

## 0.6.3 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, which is v4.14's text, character for character, under a
formatting pass (see Notes). Mike accepted the Attended redline and streamlined the Roll
Playing Conventions paragraph and the two Result tables in tracked changes of his own; the
integrator accepted those through Word and wrote the edition under the same file name, mending two
slips on the way (see Notes). No rule moved in the book: the player still rolls, a Threshold is
still ten plus the modifier it stands in for, and the Attack results say what they said in fewer
words. The release is Mike's patch list after 0.6.2: the Flare lists show the Constellations a
character has Opened and nothing else until asked, a Flare from the sheet is said in chat as a Flare
from a card always was, and the composite bow in the Strike Attribute rule is read from a Trait. A
patch release of the rules, so a patch bump, and no world migration. The rulings are 84 to 90 in
`v4.14-sync-report.md`, continuing the v4.13 report's numbering.

### Changed

- **Flare lists show Opened Constellations by default** (ruling 85; Mike: "the drop-down list
  should only show Opened Constellations. There should be a toggle, though, to instead show
  non-Opened Constellations to Flare"). A Constellation is *Opened* for a character when they hold
  its Constellation Item or any Talent in it; a Constellation drawn only because it is Flared counts
  as listed too. The Flare dialog a critical's chat card opens lists those alone, with the rolled
  Constellation preselected, and carries a checkbox, **Show Constellations you have not opened**,
  that rebuilds the list with every shipping Constellation (Enabled, ruling 61) added and each
  unopened one marked "(not opened)"; when the rolled Constellation is itself unopened the checkbox
  starts ticked, so the preselection is in view. The sheet's Constellations tab lists the Opened and
  Flared Constellations as it did, and its toolbar gains a toggle, **Show every Constellation**,
  that adds every shipping Constellation the character has not opened as a slim, dimmed row in its
  own category, trailing the opened ones (name, Key Attribute glyph, Untrained, a "not opened"
  mark, the Flare control and the roll link; no Talent list, no caret; the Lore template is left
  out, since a Lore a character opens is always Lore (X)), so an unopened Constellation can be
  rolled or Flared from the sheet as well as from a card; the button reads **Opened only** while
  the rows are shown. The toggle is the client setting `showUnopenedConstellations` (default off,
  no entry in Configure Settings; the button is the switch), so it holds across sheets and sessions
  for that user, and every character sheet the client has open redraws when it changes. Through
  0.6.2 the dialog listed the character's Constellations and every shipping one together, in one
  list.
- **A Flare goes to chat from every entry point** (ruling 86; Mike: "Flaring a Constellation by
  clicking on the Flare button on the charsheet in Foundry doesn't send that to chat, like changing
  other things does"). `SwActor#toggleFlare` posts the Flare card itself after the update, spoken
  by the actor and public, on the client that made the change: the existing card ("{name} is
  Flared. A Milestone Talent Point may be spent there, and it stays Flared until you do.") when a
  Constellation is lit, and a one-line card ("{name} is no longer Flared") when it is put out.
  `flareFromCard` calls it and posts nothing of its own, so a Flare from a card is said once;
  putting out a Flare that was never lit writes nothing and says nothing. The audit of hand edits
  is left alone: Flares are an object, not a watched field, and the card is the announcement.
- **The composite bow** (ruling 87). PHB v4.14, The Attack: "Your Strike Attribute is the higher of
  two numbers: the weapon's natural Attribute (Might; or Agility for a weapon with the Finesse
  trait, and for any ranged weapon other than a composite bow or a thrown weapon), or the Key
  Attribute of a Combat Style whose root you have and whose weapons you are wielding." The weapon
  trait parser reads a **Composite** Trait (`flags.composite`), and the natural Attribute is now
  Agility for a Finesse weapon and for a ranged weapon that is not Composite, Might otherwise; a
  thrown weapon already read as Might, since a weapon thrown from the hand is not a ranged weapon
  in the model's terms. Through 0.6.2 every ranged weapon read Agility. The item sheet's hint
  states the rule. No composite bow exists in `data/equipment.xlsx` yet, so nothing in the data
  moves until Mike authors one, with "Composite" in its Traits.
- **The siblings moved with the book** (ruling 84). The web app's Checks wiki carries the book's
  results wording, loses its "Meaning for Attacks" column and says where Attacks are read; its
  Combat section's Attack results take the book's new sentences ("Critical Hit. Double damage, or
  the effect's critical result, plus critical effects. For a Blow, the attacker chooses the Zone
  that is struck.", "Graze. Stopped, but partial damage ...", "Miss. Stopped, no damage. For a
  Blow, the attacker is Exposed in a Zone of the defender's choice."), the "Natural 20 / Natural 1"
  row and the Weighted paragraph as the book now places it; and the roster's hand-kept `armorTraits`
  Comfort row takes the book's sentence, "You can sleep in it without increasing your Fatigued value
  by 1.", which the Rules Reference journal's trait table, the Constellation Compendium and the web
  app's armor table all print. No system rule moved: `weighted` was already on the Committed Strike
  alone and `exposeOnMiss` on every Strike. `FEATURES.md`, the READMEs and `CLAUDE.md` name v4.14
  and 0.6.3.

### Notes

- **Mike's streamlined text, and what it did not change.** The Roll Playing Conventions paragraph
  (Chapter 2, Game Conventions) is one paragraph now: "The Player always rolls to determine
  Success. Instead of the GM rolling dice secretly behind a screen, the player always rolls the dice
  to determine if something succeeded or failed. This means that monsters typically have Thresholds
  for most of their stats, for example, Initiative Threshold, Claws Strike Threshold, Guard
  Threshold, Evade Threshold, etc. A Threshold is always ten plus the modifier of the check it
  stands in for: 10 + Attribute Bonus + Proficiency Bonus, plus any bonuses and penalties that
  apply. A creature (including a character) whose Guard is +7 therefore has a Guard Threshold of
  17. If two players are opposed (e.g., one player attacks another player), the player initiating
  the maneuver rolls." The four short paragraphs that followed it are gone. The Degrees of Success
  table has lost its "Meaning for Attacks" column and its lead-in reads "(for Attacks, see the next
  section)"; the Result table's rows are the sentences quoted above and its row heading reads
  "Natural 20 / Natural 1". The paragraph beginning "Only a Committed Strike has the Weighted
  trait" now sits under Strikes, in The Attack, and ends "because a committed blade is there to be
  bound". Nothing the system does moved: the player rolls, the attacker rolls against the
  defender's Threshold, a Threshold is ten plus the modifier, the Committed Strike alone is Weighted
  and every Miss Exposes. The sync report asks Mike to confirm that "the player initiating the
  maneuver rolls" is the attack flow's rule (the attacker rolls, the defender's committed Threshold
  answers), and notes that the table's Hit sentence, "For a Blow, lands on the Torso", has no
  subject.
- **Two slips mended in the edition** (ruling 90). "characyer" to "character", and the Comfort
  row's "without waking increasing your Fatigued value by 1" to "without increasing your Fatigued
  value by 1". Flagged to Mike in the report.
- **The Strike Attribute is implemented as the book says** (ruling 88; Mike: "Do we have this
  implemented in Foundry?"). `strikeAttributeFor` in `module/data/actor.mjs` takes the higher of
  the weapon's natural Attribute (`attackAttribute` in `module/data/item.mjs`) and the Key Attribute
  of a Combat Style whose Root the character owns and in whose Style the weapon is wielded; the
  weapon's Combat Style field (`system.style`) is where "write it on your sheet" lives, and the
  sheet's weapon row shows the Attribute that won with a tooltip naming the Style. The one gap was
  the composite bow, closed above (ruling 87). `FEATURES.md` says so plainly.
- **A party sheet is planned, not built** (ruling 89; Mike: "Is there a built-in 'party sheet' in
  Foundry to do things like award Milestones, see various party-wide things like everyone's Skills,
  add Loot for party members to grab, allow players to choose and roll Exploration Mode activities,
  etc.?"). Foundry core (v13 and v14) has none: the party is a core idea only as the players'
  assigned characters (the Players list, each user's `character`), and the party features Mike
  names come from systems that build their own (pf2e's Party actor, dnd5e's Group actor). The plan,
  recorded in `CLAUDE.md` under Known outstanding work: a `party` Actor type in this system with a
  members list of linked character Actors; a Milestone award button that writes one Milestone to
  every member with a chat card; a Skills grid of every member's rank and bonus for each Skill
  Constellation and Defense, read live; a Loot panel of Items on the party Actor, where a member's
  owner clicks Take and the Item moves to their character with a card; and an Exploration Mode
  panel where each member picks an Activity from the actions compendium's Exploration group and
  rolls its check from the party sheet. Not in 0.6.3.
- **Attended is the book's now.** Mike accepted the v4.13 redline into v4.14: the trait row ("It
  fastens behind the shoulder, beyond your own reach: alone, putting it on takes twice as long.
  Taking it off does not."), the Breastplate's "Plate, Noisy, Attended" cell and the donning
  sentence are in the handbook, so the data and the system no longer run a step ahead of it on that
  item, and the documents stop saying they do. Nothing in the system changed.
- **The formatting pass is v4.15.** Mike asked for one over the handbook (how Traits,
  Constellations, Talents, Defined Terms, Conditions and cross-references are set, and tables banded
  by Word rather than by hand). `assets/phb_format.py` applied the conventions written down in
  `handbook-style.md` to v4.14 and `assets/phb_edit.py` stamped the result v4.15 (cover and, for
  the first time, the page footers, which had read v4.10 since that edition). The visible text is
  byte for byte v4.14's, checked paragraph by paragraph; the script refuses to write otherwise and
  running it on its own output changes nothing. Fifteen SW character and table styles now carry the
  look: one table style with a teal header row and automatic banding on all 74 data tables (the
  hand-painted shading and the black grids are gone), Traits in a pale sage tint in place of the
  green highlighter, Constellations and Talents italic, Talent names bold in their own rows, Key
  Terms leads bold, section references underlined, action glyphs in one font at one size. An
  adversarial verifier compared 35 pages before and after and found one visible inconsistency,
  fixed before the stamp (the Callings table's Free Training column now italic in every cell).
  What the pass left to Mike is listed in `handbook-style.md` under "Open choices" and in the
  v4.14 sync report.
- The version stamps read 0.6.3 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: nothing stored changes
  shape.
- The handbook's v4.10 loose ends stand in v4.14: Key Terms still says ÷ 3, four Trained Defenses
  and Varisians, Drilled still says "Weapons Proficiency Bonus", Table 9's Quick row still says
  "Nothing" (and Key Terms' Weighted entry still says a Quick Strike is never Exposed, against
  Chapter 2's "A Miss Exposes you regardless of commitment"), Melee Training still grants Counter,
  Aid is still "Aid ❶ (⓿↺)" against the sheet's single action, the Example of Play still sums at
  d20+6, and Armored Fighting's heading and table still disagree. `CLAUDE.md` carries the list.

---

## 0.6.2 (2026-10-02): Player's Handbook v4.13

Built from Player's Handbook v4.13. Mike rewrote the Wind bullet in the v4.12 file on the shelf and
dictated the clause; the numbered edition was written with `assets/phb_edit.py` (EDITIONS "4.13"),
and from this release the pipeline also fingerprints the edition it synced to (see Notes). The book
moved in one place, twice over: the "Load Strain 1 or more" gate is back in the Wind sentence, and
the third-round delay is gone, so the Wind check comes at the end of every round from round 1.
Three of Mike's answers to the v4.12 report's questions move the system as well: Fatigued ends
with ten minutes' rest and never with the Combat; the armor-help design is in ("Yes to all"), as
the Attended trait on the Breastplate; and Awareness Training is enabled in `data/defenses.xlsx`,
so every Defense ships. A point release of the rules, so a patch bump, and no world migration. The
rulings are 79 to 83 in `v4.13-sync-report.md`, continuing the v4.12 report's numbering.

### Changed

- **The Wind check comes at the end of every round** (ruling 79). The book: "Wind. If your Load
  Strain is at least 1 and your Endure Threshold is less than 10 + your Load Strain, then at the
  end of every round while in an encounter, you must roll Endure against 10 + Load Strain. On a
  failure your Fatigued rises by 1." `WIND_ROUND` is 1: the first card posts at the end of round 1,
  for a fighter with Load Strain 1 or more whose Endure Threshold is below 10 + Load Strain and who
  is not yet Fatigued 3, unconscious or Dying; the exemption, its live reading and the Load Strain
  tooltip are as 0.6.1 left them. Every string, comment and document that said "the third round"
  now says the end of every round: the sheet's Wind hint and tooltip, the Wind card, the Combat's
  comments, `FEATURES.md`, the READMEs and `CLAUDE.md`. The delay had stood since 0.6.0 and in the
  book through v4.12; the sync report asks Mike whether dropping it was meant.
- **The Strain clause is the book's** (ruling 80). "If your Load Strain is at least 1" is back in
  the sentence, as the v4.12 report asked. The system had kept the gate as its own guess since the
  clause fell out of v4.12, so nothing moves in code; the question is closed.
- **Fatigued ends with ten minutes' rest, and the table says when** (ruling 81; Mike: "it should
  only go away with a 10 minutes' rest"). The Combat's deletion no longer clears it: `onCombatEnds`
  keeps only its own housekeeping, and a fighter who leaves one fight Fatigued carries it into the
  next scene until someone rests. Two things clear it. A night's rest (`restForTheNight`) clears
  Fatigued, since ten minutes is less than a night, and the Rest card says so when it did. And the
  Fatigued card a failed Wind check posts carries a **Ten minutes' rest** button for the actor's
  owner or the GM: it sets Fatigued off and posts a one-line card ("{name} has caught their breath:
  Fatigued ends."); clicked on a fighter who is no longer Fatigued, it says so quietly and does
  nothing else. The judgement (did ten minutes pass?) sits with the table and not in a formula. The
  token palette toggle still works, and the Fatigued hint says the condition ends after ten minutes
  of rest, through the rest card or the card's button. The v4.11 report's ruling 70 is superseded.
- **Attended, on the Breastplate** (ruling 82; Mike: "Yes to all"). A new armor trait, display
  only. Its definition, first in the roster's hand-kept `armorTraits` block (alphabetical: Attended,
  Comfort, Noisy, Quiet): "It fastens behind the shoulder, beyond your own reach: alone, putting it
  on takes twice as long. Taking it off does not." The Breastplate's Traits cell on the Armor sheet
  of `data/equipment.xlsx` reads "Plate, Noisy, Attended" (Material first, so the converter stays
  quiet), and `equipment.json`, the roster's `armorPieces` block, the Equipment compendium, the
  Rules Reference journal's trait table, the web app and the Constellation Compendium follow. The
  armor Item derives `attended` and `donTimeAlone` (twice `donTime` when the traits include
  Attended, else equal to it); the Equipment tab's time tag reads "4 min, 8 alone" on an Attended
  piece, and its hint says why. Nothing else acts on it: no Load, Protection or check reads the
  trait. The handbook does not carry it yet. The wording goes to Mike as tracked changes
  (`Starwrought_Players_Handbook_v4.13_attended_proposal.docx`, the `attended` proposal of
  `assets/phb_propose.py`: the trait row, the Breastplate's cell and a sentence in the donning
  paragraph), so on this one item the data runs a step ahead of the book, at his word.
- **The Awareness Constellation ships** (ruling 83). Mike set Awareness Training's `Enabled?` to
  Yes on the Awareness sheet of `data/defenses.xlsx`; the other four rows stay blank. So Awareness
  ships with its Root alone, every Defense is now one the wizard's Defenses step can Train, and the
  enabled counts are 13 of 31 Constellations and 39 of 177 Talents (the integrator's build stamps
  them into `content/sync.json`).
- **The siblings moved with the book.** The web app's sheet says "Wind each round: Endure vs M"
  (the exempt wording as before), its wiki carries the Strain clause and says every round, and its
  Equipment section prints Attended in the traits table and in the donning sentence; the printed
  sheet's Defense ladder line says "each round"; the Constellation Compendium's armor paragraph says
  every round with the Strain clause and gains the Attended sentence, and its traits table prints
  the roster block. `FEATURES.md`, the READMEs and `CLAUDE.md` name v4.13 and 0.6.2.

### Notes

- **Mike edited v4.12 in place and dictated the clause.** The Wind rewrite was made in the v4.12
  file on the shelf rather than in a new one, so the drift check, which compared version numbers,
  saw nothing move. The edition `Starwrought_Players_Handbook_v4.13.docx` carries his dictated
  sentence through `phb_edit.py` (EDITIONS "4.13"). From this release `build_all.mjs` also records a
  content hash (SHA-256) of the handbook in `data/SYNC.json` at `--accept-phb`, so an in-place edit
  of the synced edition is reported as drift, not only a higher number.
- **Was dropping the third-round delay intended?** The system follows the sentence. If the delay
  was meant to stay, `WIND_ROUND` is one number and the strings say "every round" in a handful of
  places; the sync report asks.
- **The Comfort row still says "waking fatigued"**, lowercase, the old boolean's word, while the
  donning paragraph says "waking Fatigued 1" and the Conditions table defines Fatigued N. Mike's
  cell; the report asks.
- **Sleeping in armor without Comfort still sets nothing.** Unchanged from 0.6.0; the rule is the
  table's.
- The version stamps read 0.6.2 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: nothing stored changes
  shape.
- The handbook's v4.10 loose ends stand in v4.13: Key Terms still says ÷ 3, four Trained Defenses
  and Varisians, Drilled still says "Weapons Proficiency Bonus", Table 9's Quick row still says
  "Nothing", Melee Training still grants Counter, Aid is still "Aid ❶ (⓿↺)" against the sheet's
  single action, and Armored Fighting's heading and table still disagree. `CLAUDE.md` carries the
  list.

---

## 0.6.1 (2026-10-02): Player's Handbook v4.12

Built from Player's Handbook v4.12. Mike accepted the wind-exemption proposal from
`assets/phb_propose.py` into his working copy, made edits of his own, and saved; the numbered
edition was written from that file with `assets/phb_edit.py`, correcting one clause that had been
saved inverted (see Notes). The book moved in three places: a fighter whose Endure Threshold
already meets the Wind Threshold never rolls for Wind; the Fatigued row of the Conditions table is
the one definition of the condition and no longer ties its end to the fight being over; and Rage's
aftermath is written in the Wind condition's terms. Mike also enabled Endure Training in
`data/defenses.xlsx`, so the Endure Constellation ships. A point release of the rules, so a patch
bump, and no world migration. The rulings are 74 to 78 in `v4.12-sync-report.md`, continuing the
v4.11 report's numbering.

### Changed

- **No Wind check for a fighter whose Endure Threshold meets 10 + Load Strain** (ruling 74). The
  book: "Wind. If your Endure Threshold is less than 10 + your Load Strain, then at the end of the
  third round of an encounter and every round after, you must roll Endure against 10 + Load Strain.
  On a failure your Fatigued rises by 1." The data model derives `wind` (`threshold` = 10 + Load
  Strain, `endureThreshold`, and `exempt` when the Endure Threshold is at least the Wind Threshold)
  once Load Strain and the Defenses are both known; the round-end code posts no Wind card for an
  exempt fighter and otherwise behaves as 0.6.0 did: from the end of the third round, every round,
  a failure raising Fatigued by 1 to the ceiling of 3, and a card already posted still rolls. The
  sheet's Load Strain field carries a tooltip for every viewer, GM or player, giving the Wind
  Threshold and saying whether the character is exempt, with the numbers. The old "Load Strain 1
  or more" clause is gone from the book, and the system keeps it as a gate: an unpenalised fighter
  at Strain 0 is exempt anyway (Wind Threshold 10, Endure Threshold 10 or more), but Frightened N
  can pull an Endure Threshold under 10, and nothing is winding a fighter who carries no Load, so
  no Load Strain means no check (the sync report asks for the clause). The Endure Threshold is the one the Defense
  grid shows, 10 + Might bonus + Endure Proficiency with whatever the Defense path folds in
  (Frightened reaches it; Fatigued does not), so the exemption is read live and a Frightened
  fighter can lose it for a round.
- **The Fatigued row** (ruling 75). The book: "−N Condition (maximum of 3) penalty to Evade, Guard,
  and Attack rolls; can't use Exploration Mode Activities. Ends after ten minutes of rest." The
  roster's `conditions` row, the system's Fatigued hint and the Wind card texts carry the new
  wording; nothing says "once the fight is over" any more. The condition's mechanics are unchanged
  from 0.6.0 (Fatigued N, −N Condition to Evade, Guard and attack rolls, raised one step at a time
  by a failed Wind check, to 3), and the Combat's deletion still clears it (see Notes).
- **Rage's aftermath, in the data** (ruling 76). The Rage Talent's Effect on the Berserker sheet of
  `data/callings.xlsx` takes the book's two sentences verbatim: "Afterward, increase your Fatigued
  by 1 until you spend three actions to catch your breath." and "You may end your Rage as a free
  action, increasing your Fatigued by 1 as though it had run its course." Deaf to Pain is
  unchanged. Rage is not automated, so no code moved; the Constellation Compendium and the web app
  pick the text up from `trees.json`, and the v4.11 report's ruling 73 is closed.
- **The Endure Constellation ships** (ruling 77). Mike set Endure Training's `Enabled?` to Yes on
  the Endure sheet of `data/defenses.xlsx`; the other four Endure Talents stay blank. So the
  Constellation ships with its Root alone, Endure joins Evade and Guard as a Defense the wizard
  can Train (Awareness still waits on its Root), Endure relief and the Endure Bonus to Vigor are
  reachable in play, and the enabled counts are 12 of 31 Constellations and 38 of 177 Talents.
- **The siblings moved with the book.** The web app's sheet says "no Wind check (Endure Threshold N
  meets M)" when the character is exempt and "Wind from round 3: Endure vs M" when not, its wiki
  states the v4.12 rule, and its roster Fatigued row is the book's; the printed sheet's Defense
  ladder line notes the exemption in the words that fit. `FEATURES.md`, the READMEs and `CLAUDE.md`
  name v4.12 and 0.6.1.

### Notes

- **The edition corrects an inverted clause** (ruling 74). Mike's saved sentence read "If 10 +
  your Load Strain is less than your Endure Threshold, then ... you must roll", which would make the
  fit fighter roll and spare the winded one. The accepted proposal carried the intended reading, so
  the `phb_edit.py` entry that writes v4.12 turns the comparison round, and the correction is
  flagged to Mike in the sync report.
- **"Ends after ten minutes of rest" is still approximated by the end of the Combat** (ruling 75).
  Ruling 70 cleared Fatigued when the Combat document is deleted as the nearest thing to "ten
  minutes of rest once the fight is over"; the book no longer says "once the fight is over", so the
  clear is now an approximation of the ten minutes rather than the rule's letter. The report asks
  whether a clear from the rest card should replace it or join it.
- **What Mike trimmed** (ruling 78). Sight and hearing and Speed at the margin each lost their last
  sentence; the first sentence of each still carries the rule, so nothing downstream changes beyond
  no longer quoting them. The Fatigued definition that stood in the Wind bullet is gone (the
  Conditions table's job), and so are that bullet's two flavour sentences. The plate example is now
  two paragraphs, and the Trained-versus-Expert Wind sentence the proposal added was not kept.
- **Sleeping in armor without Comfort still sets nothing.** Unchanged from 0.6.0; the rule is the
  table's.
- The version stamps read 0.6.1 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: nothing stored changes
  shape.
- The handbook's v4.10 loose ends stand in v4.12: Key Terms still says ÷ 3, four Trained Defenses
  and Varisians, Drilled still says "Weapons Proficiency Bonus", Table 9's Quick row still says
  "Nothing", Melee Training still grants Counter, and Armored Fighting's heading and table still
  disagree. `CLAUDE.md` carries the list.

---

## 0.6.0 (2026-10-02): Player's Handbook v4.11

Built from Player's Handbook v4.11. Mike accepted two proposals from `assets/phb_propose.py` (the
vigor proposal and the armor-balance proposal) with tweaks of his own, and the book moved in two
places: Vigor is an Opening sum from the first Calling plus a per-level share that grows with
Endure, and Load Strain comes off the margins of a fight rather than off Evade. A rules sync is a
minor bump, as 0.4.0 was for v4.10. The rulings are 67 to 73 in `v4.11-sync-report.md`, each
carrying the sync brief's R label as well, so the brief, this entry and the report name the same
thing the same way.

### Changed

- **Vigor is 10 + Opening Vigor + (Ancestry Vigor + Endure Bonus) × level** (ruling 67, R1). The
  book: "At 1st level: Your Ancestry's Vigor + Endure Bonus + your first Calling's Opening Vigor +
  10", and "At every level thereafter: Your Ancestry's Vigor + Endure Bonus." The Calling's number
  is **Opening Vigor** now, paid once by the first Calling: Berserker 12, Ambusher 8, Hunter 10,
  Bravo 10, Weaponmaster 10 (it was 4 / 2 / 3 / 3 / 3 per level). The Ancestry's stays per level
  (Human 8). The **Endure Bonus** is the conditioning clause of Endure Training, 0 at Untrained
  and Trained, 1 at Expert, 2 at Master, 3 at Legendary, read live from the Endure rank, so it is
  0 at 1st level and lifts every level's share once earned. `#prepareVigor` exposes
  `vigor.perLevel` and `vigor.opening`; the chargen review, the sheet's locked-field tooltips and
  the chassis sheet's label say "Opening Vigor" for a Calling and "Vigor per level" for an
  Ancestry. A night's rest is unchanged: level × Presence bonus when that bonus is positive, else
  level.
- **Load Strain never touches Evade** (ruling 68, R2). The book: "It never comes off your Evade",
  and "Armor does not make you easier to hit, and it costs a fighter nothing on the roll, Guard or
  Evade." The untyped Strain modifier is gone from the Evade modifiers and the Evade Threshold.
  Rush and Leap keep their Strain in feet.
- **Climb, Swim and Stealth take Load Strain; nothing else does** (ruling 68, R2). The book:
  "Climb, Swim, and Stealth checks take your Load Strain as a penalty. Nothing else does: a
  grapple, a tumble, and a single Move at full Speed are yours at full strength." A Stealth check
  carries the untyped penalty automatically, labelled Load Strain. The system cannot tell a Climb
  or a Swim from any other Athletics check, so the Athletics roll dialog offers an unticked **Load
  Strain (Climb or Swim)** modifier whenever the actor's Strain is 1 or more; the player ticks it
  when the check is one of those. The old blanket penalty on Might and Agility Skill checks is
  gone.
- **Fatigued is Fatigued N, and the Wind check deepens it** (ruling 69, R3). The book: "On a
  failure they are Fatigued 1, or their Fatigued rises by 1, to a maximum of 3. Fatigued N is a −N
  Condition penalty to Evade, Guard, and attack rolls." Fatigued is a value-carrying condition
  like Frightened N (the sheet's Effects tab and the token palette read "Fatigued N"), applied as
  −N Condition to Evade, Guard and to attack rolls, melee and ranged, in place of the boolean −1
  to Evade and Guard. The Wind reminder posts from the end of the third round for anyone with
  Load Strain 1 or more who is not yet Fatigued 3, unconscious or Dying (it used to stop once
  Fatigued at all); a failed check sets Fatigued 1 or raises it by 1, to 3, and the card says the
  new value. The Wind texts carry the v4.11 wording.
- **Fatigued clears when the encounter ends** (ruling 70, R4). The book: "it lasts until ten
  minutes of rest once the fight is over." The system has no clock for ten minutes of rest, so
  the deletion of the Combat document is what clears it, beside the end-of-combat hooks that
  already clear remembered targets and Intercept charges. No clear existed before: a boolean
  Fatigued stayed until someone toggled it off.
- **Endure relieves Load Strain from Trained** (ruling 71, R5). The book: "Training in Endure
  reduces Load Strain as your Proficiency Rank in it rises: by 1 at Trained, 2 at Expert, 3 at
  Master, and 4 at Legendary." `LOAD_RELIEF` reads Untrained 0, Trained 1, Expert 2, Master 3,
  Legendary 4; it had read Expert 1, Master 2, Legendary 3 since 0.2.0. The Endure Training Talent
  on the Endure sheet of `data/defenses.xlsx` carries the new tail (relief from Trained, and the
  Vigor clause above).
- **The data and the siblings moved with the book.** The roster's `callings` block carries Opening
  Vigor in its third column (every consumer still indexes `[2]`); its `conditions` block reads
  "Fatigued N" with the v4.11 text; the chargen step says a Calling grants "Opening Vigor if it is
  your first Calling". The Constellation Compendium's Callings table is headed "Opening Vigor" and
  its Vigor paragraph prints the new formula (the Ancestry table keeps "Vigor/lvl"). The web app
  derives Vigor by the same formula, shows no Load Strain on Evade, and prints the book's relief
  ladder (Trained 1 to Legendary 4, the very table 0.4.0 "corrected" away to match the old Talent)
  and the v4.11 Wind note; its Mira sample and the smoke test expect 26 (10 + Human 8 + Ambusher
  8 at 1st, up from 20). The character sheets' Mira is 26 as well, and the printed sheet's spec
  (`assets/sheet_spec.json`) drops Load Strain from its Evade formula and prints the new Vigor
  line. The Calling chassis description in the compendium reads "Grants Training in {training},
  and {n} Opening Vigor, added once if it is your first Calling."

### Migration

- **0.6.0 world migration** (ruling 72, R6), run once by the first GM to open the world and
  recorded in `systemVersion`, as the 0.4.0 Speed conversion and the 0.5.1 aura step were.
  `system.details.calling.vigor` held the old per-level number. When the stored value equals the
  old table value for the character's named Calling (Berserker 4, Ambusher 2, Hunter 3, Bravo 3,
  Weaponmaster 3), it is set to that Calling's Opening Vigor, read from `content/chassis.json`
  (`system.vigor` of the Calling) or from the old-to-new table; a value the GM typed is left
  alone. `prepareDerivedData` then clamps `vigor.value` to the new maximum on the next render. A
  chat line says how many characters it touched, as the 0.5.1 step does. A 1st-level Human
  Weaponmaster goes from 21 (10 + (8 + 3) × 1) to 28 (10 + 10 + 8 × 1).
- The version stamps read 0.6.0 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet.

### Notes

- **The Athletics toggle is a judgement left at the edge** (ruling 68, R2). "Climb or Swim" is a
  fact about the fiction, not about the Constellation rolled, so the system asks rather than
  guesses: the modifier is offered unticked and labelled, and the card shows it when it was taken.
  If Climb and Swim ever become Maneuvers of their own in `data/maneuvers.xlsx`, the toggle can go
  and the penalty can ride on them.
- **"Ten minutes of rest once the fight is over" is approximated by the end of the Combat**
  (ruling 70, R4). A fight that ends and a chase that begins inside the same Combat keeps the
  Fatigued; a GM who deletes the Combat and wants the Fatigued to linger sets it again from the
  palette. "Can't use Exploration Mode Activities" is the table's to hold.
- **Rage's "fatigued" stays as the sheet has it** (ruling 73, R7). The Rage Talent in
  `callings.xlsx` says "Afterward, you're fatigued until you spend three actions to catch your
  breath", in its own sense; nothing in the system acts on it, and the cell is Mike's. The
  system's Fatigued N is the Wind condition.
- **Sleeping in armor without Comfort does not set Fatigued 1.** The rest card never did, and
  nothing was added (R3): the rule is the table's.
- **Mike's open question** (2026-10-02, recorded in the sync report): a fighter past some
  threshold should not have to roll to be Winded at all, and an Armored Fighting Constellation to
  come may carry Talents for it. Nothing is built; the round-end check in `combat.mjs` is the one
  place a gate would go.
- The handbook's v4.10 loose ends stand in v4.11: Key Terms still says ÷ 3 and four Trained
  Defenses and names Varisians, Drilled still says "Weapons Proficiency Bonus", Table 9's Quick row
  still says "Nothing", and Melee Training still grants Counter. `CLAUDE.md` carries the list.

---

## 0.5.3 (2026-10-01): damage lands on the target, one Move per Opportunity, rerolls, rings that read

Built from Player's Handbook v4.10, unchanged. Seven notes from Mike at the table, in one evening.

### Added

- **Reroll, on every Attack and Defense card** (Mike, 2026-10-01: "Players (and the GM) should have
  a 'reroll' option on the Attack, for special cases", "and for Defense rolls, too"). The roller's
  owner and the GM see the button. A small dialog takes the reason, for the record, and offers to
  spend a Hero Point when the roller is a character holding one. The d20 is thrown again with the
  first die's formula and everything else stays as it was: the weapon or attack row, the Strike,
  the defender's Defense, Reaction and Posture, the Proficiency rolled, the modifiers and the
  Threshold where it was shown. Nothing is paid again. The new card says it is a reroll and why;
  the old card stays in the record, dimmed, struck through and with every control disabled. When
  the card hid its Threshold (an adversary's, inside the attack flow) the die is thrown on the
  roller's client and read on the active GM's client over the socket, which checks the die is a
  Roll of the first card's formula and that the asker owns the roller, reads the Threshold again
  from actor data, and answers with the outcome. Inside the flow a player attacker's one die
  resolved against every defender, so rerolling any of those cards rerolls them all with the one
  new die. The attack card that carried the pairings' outcomes follows the new cards, with a line
  in its log. The reroll is of the die, not of what the
  table did with it: damage applied, a Zone Exposed, a Bind formed or a Flare lit from the first
  result stand, and the new card offers its Position again. The Hero Point is spent only once the
  reroll has gone through. The check card's flags gain `modifiers`, `attackId`, `rerollOf` and
  `rerollReason`; the sixteen keys of the 0.5.0 contract are untouched. Two designs of this were
  drawn up independently and judged against the code before it shipped; the plan is in the
  session's workflow transcript, and its risk list shaped the three sentences above.

### Changed

- **The Standing stance is Evade or Guard** (Mike, 2026-10-01: "Standing Stance should only include
  Evade or Guard. Parry and Void will be in Maneuvers, when I Enable them in the xlsx file"). The
  header's chips and the Token HUD's button offer the two basic Defenses; a Reaction is chosen blow
  by blow in the Combat Prompt, and the Reactions appear on the Maneuvers tab once their rows in
  `data/maneuvers.xlsx` are enabled. A stance set to a Reaction before 0.5.3 reads as the Defense
  it stood on, Counter as the better of the two.
- **Wounds can be changed by hand, by a player or the GM, and every change is said in chat** (Mike,
  2026-10-01: "player and GM should be able to change Wounds, and log to chat"). The plus and minus
  beside each Zone's Wound pips were the GM's alone and the minus was silent. Both now show for
  anyone who may edit the sheet: plus takes the Wound through the same path a blow does, so its
  card says it was marked by hand and a Prepared Maneuver, a Torso bleed or Dying follow as they
  would; minus posts a "Wound removed" card naming who pressed it and leaves Dying or Prone from
  that Wound for the table to tidy. One actor method, `adjustWounds`, serves both sheets.
- **The Combat Prompt offers Give Ground and Set Your Feet** (Mike, 2026-10-01: "Where can I choose
  my Posture, like Give Ground or Set Your Feet?"). The two Postures the Defense Training roots grant
  in their own text are no Talents of their own, so the prompt never offered them; it offers them
  now, on the root Talent's id, once Evade Training or Guard Training is owned, with the Reaction
  table's wording as the hint, and the cards name them as the table does. Posture Talents in the
  Defense's Constellation (Slip the Line, Catch the Blade) are offered as before once enabled.
- **Short arrows keep their shaft** (Mike, 2026-10-01: "short distances have non-ideal targeting
  and bind arrows, in terms of readability"). When a targeting arrow is shorter than its distance
  pill, the pill steps off the line to the upper side instead of covering the arrow it describes;
  the Bind chain's label and its Control pill take the lower and upper sides by the same rule, so
  the labels never trade places as the tokens move.

- **One Maneuver per Opportunity, on the map** (Mike, 2026-10-01: "since we can only do one
  Maneuver per opportunity now, we should not be able to Move more than our Speed at one time, in
  combat"). At a combatant's own Opportunity a drag may be one Step, one Move, one Crawl or one
  straight Rush; a drag that would take a second Move (or a second Crawl) is refused before the
  token lands, with a notice saying how far one Move carries you and that a straight Rush is the
  way to go further. The drag ruler paints those squares red on the way and labels them "past one
  Move", so the refusal is never a surprise. This is the system's one block; everything else still
  reports. New world setting **One Maneuver per Opportunity on the map**, on by default; off, the
  move lands and its card counts the Moves for the table, as 0.5.2 did. The ruler and the charge
  now ask one function whose Opportunity it is.
- **Range rings read on a pale map** (Mike, 2026-10-01: "sometimes the Ranges are hard to see,
  depending on the colour of the battlemap tiles"). Every reach and aura ring now sits on a dark
  halo under its coloured outline, the way the targeting arrows and the Bind chain carry an
  underlay, so a gold or mint line still shows on a sand floor. New client setting **Range ring
  contrast**: Normal, or Strong, which thickens the lines and deepens the fills for a bright or
  busy battlemap. The level is part of the ring signature, so changing it redraws at once.
- **The move trail clears when your Opportunity comes round** (Mike, 2026-10-01: "My past Move
  trails should disappear when it is my opportunity to go again"). Core clears every combatant's
  movement history when a turn starts, but only on the active GM's client and only when the Combat
  document changed, so a table with no GM connected, and a lone combatant whose next Opportunity
  writes no update, kept their trails. The client responsible for a combatant now clears its token's
  history as its Opportunity begins, whatever core did. The drag ruler's label also puts the units
  before the glyphs ("12 ft ❶×2", not "12 ❶×2 ft").
- **The Combat Tracker's actions readout can be read** (Mike, 2026-10-01: "# actions remaining in
  combat tracker are very small/hard to read"). The one small circled glyph under each name is now
  a large gold number over the round's count ("5/6"), red at zero, with a pip per action lit while
  unspent, the same pips the sheet shows. Reserved actions and Preparing print beside it as before.
- **A player sees only their own targeting arrows** (Mike, 2026-10-01). The arrows were drawn for
  everyone who could see both tokens; now the GM sees every arrow and a player sees the arrows
  their own user set, so who the adversaries, and the other players, are going for is the GM's to
  reveal. The Combat Tracker's target line under each combatant is unchanged (a question for Mike
  in the report).

### Fixed

- **A player's damage card damaged the player** (Mike, 2026-10-01: "when I roll damage on my
  target as a user, it damages me instead"). The Apply row read the user's selected tokens before
  the creature the card was rolled against, and a player who has just Struck has their own token
  selected. Apply now lands on the creature the card names. When that creature is one the clicker
  cannot write (an adversary, for a player), the active GM's client applies it, asked over the
  system socket with the card's id, the Zone and the multiplier; it reads who was hit and how hard
  from the card itself and who is asking from the server's stamp on the event, allows only the
  card's author or the attacker's owner, holds a Quick Strike to the Torso, and answers the asker
  with "Applied to {name}" or the reason it refused. With no GM connected the player is told so.
  Shift-click spends the card on the selected tokens instead (the GM's redirect, or a player
  taking an adversary's blow on themselves), and a card rolled with no target falls back to the
  selection, then the user's targets. The card's Apply tooltip says all of this.
- The render hook meant to hide the Apply row from players looked for a class the card has not
  carried for several releases, so it did nothing; it is gone, since the row is now for everyone.
- **A declared Strike now pays when it declares** (Mike, 2026-10-01: "I used a deliberate strike,
  but I don't think it reduced my actions by 2"). A character's Strike paid at the roll step, so a
  Blow waiting for its defenders showed no spend, while an adversary's paid at declaration. Both
  pay when they declare; the flow's roll step pays nothing; a Blow cancelled before any die was
  thrown returns the actions with an "Actions returned" card. Prepared and free Strikes paid
  elsewhere and are untouched.
- **One Blow at a time** (Mike, 2026-10-01: "my partner clicked attack twice, and it popped up two
  defense boxes", and a stale Defend task from an earlier attack lingering in the prompt). A
  second declaration by the same attacker now replaces a Blow nobody has answered yet (the
  replaced card says so, its actions come back, and the new Blow pays), and is refused once a
  defender has committed or a die is in flight, with a notice naming the Blow in play. The
  defender's prompt therefore shows one task per attacker.
- **A player could not Expose the Zone the card gave them** (Mike, 2026-10-01: "when my partner
  attacked me with a committed strike, it gave an error saying he could not expose my zone because
  my character is not owned by him"). The Position block offers the Expose to the right side, but
  the Zone lands on the other side's body, which a player cannot write. The choice now goes to the
  GM's client over the system socket, as Apply does: it checks the asker owns the choosing side,
  that both sides are the card's, marks the Zone and posts the Exposed card, and answers the asker.
  The Zone a Controller opens on a Bound partner takes the same path. With no GM connected the
  player is told whose owner must mark it.
- **The out-of-reach warning never reached the attack flow's cards** (Mike, 2026-10-01: "he was
  within my range, but I wasn't within his range. It should have put the warning into chat, while
  still allowing it"). The immediate card worked the note out before the die; the card the flow
  resolves per pairing had the note written as empty. One reading now serves both
  (`SwCheck.rangeNoteFor`), taken from the two tokens as they stand when the Blow resolves, for a
  character's weapon and for an adversary's attack row alike. Said, never refused, as before.
- **0.5.2 shipped with its version stamps still reading 0.5.1** (`SYSTEM_VERSION` in config.mjs
  and `--sw-css-version` in the stylesheet), so every client on 0.5.2 saw the stale-copy warning
  that those stamps exist to raise. Both read 0.5.3 now, and `build_all.mjs` refuses to pass while
  the two stamps and system.json disagree, the check the packaging script already made.

---

## 0.5.2 (2026-10-01): the Bind under the arrow, and locked fields that explain themselves

Built from Player's Handbook v4.10, unchanged. Two pieces of feedback on 0.5.1, both from Mike.

### Changed

- **The Bind chain is drawn lighter, and beneath the targeting arrows** (Mike, 2026-10-01: "The
  Bind line is overpowering the Target Distance arrow"). The rails are a fraction of their old
  width (1.5 to 3.5 pixels at the scene's scale), the underlay, rungs and arrowhead are dimmer, the
  label is smaller with a more transparent pill, and the binds layer now sits under the targets
  layer, so the arrow and its distance pill read over the chain rather than vanishing under it.
  The label stands off the midpoint far enough to clear the distance pill at any zoom, since both
  used to want the same spot.
- **A locked field on the character sheet says what it means** (Mike, 2026-10-01: "any uneditable
  field should have a tooltip with more info"). For a player, Ancestry, Bloodline, Culture,
  Background and Calling are text (0.5.1); hovering one now shows the chassis's description
  followed by its effect: Human gives the ancestry's line and then Humanity's description and
  effect, Soldier gives the story and then what it trains. When the character owns the Root
  Talent, its description and effect stand in for the chassis's summary of it (they said the same
  thing twice), and the Root is named only when its name differs from the chassis's (a Bloodline's
  Root carries the Bloodline's name). Ancestry Vigor, Calling Vigor and Ancestry Speed say where
  the number comes from and what it feeds. The lock line, "Set at character creation. The GM
  changes it.", stays as the footer.

### Added

- **`content/chassis.json`**: every authored chassis, enabled or not, written by `build_foundry.mjs`
  beside the Constellation index. The sheet reads a chassis from the compendium first and from
  this index behind it, so a Background or Calling the Enabled? column has switched off (Soldier
  and Berserker today) still explains itself on a character that chose it, and a name the GM typed
  that matches nothing in the book says so ("Not a chassis the compendium knows"). A world chassis
  Item of the same name wins over both, as a world Basic Action does.

### Fixed

- The world's `systemVersion` stamp now follows a release that carries no migration step. It stayed
  at the last release that had one (0.5.1 after this upgrade), although the comment above
  `migrateWorld` promised it was written on every check.

### Notes

- The text in those tooltips is the spreadsheets' as authored. The three Roots a Human character
  sees still name the pre-v3.3 bonus types ("+1 status bonus", "+1 circumstance bonus"), which the
  style check already counts as an advisory, and Rage's effect in `callings.xlsx` still reads
  "Temp HP", "◆" and "Duration 10 rounds". Mike's cells; the tooltips will follow them.

---

## 0.5.1 (2026-10-01): auras on the map, and the player-facing sheet

### Added

- **Auras: every range a creature carries can be drawn on the map** (Mike, 2026-10-01; ruling 66
  in `v4.10-sync-report.md`). Natural Reach, Total Reach, an Unwieldy dead zone, every Talent or
  Maneuver with a "within N feet" and any ring drawn by hand are one list on the actor, drawn by
  one renderer: whole grid cells measured from the edge of the space with exact diagonals, the way
  the book measures. Each range carries a **Visible** mark, set from the Token HUD's new ring
  button and its palette (one row per range, a Custom row, right-click to switch all off) or from
  the ring icon on the sheet's Talent, Maneuver and Ranges rows. While an encounter runs a
  combatant's Visible ranges are pinned on everyone's map; everything else shows only as the local
  hover, select or drag preview, which is how Reach always worked. Marks live on the actor; the
  data sets the defaults through a new **Aura** column in the spreadsheets (Torchbearer Human
  `15 ft allies visible`, Rally `30 ft allies`, Mark Prey `60 ft`, Battle Cry `15 ft enemies`,
  Rebounding Toss `none`), and the converter warns when an Effect says "within N feet" and the cell
  disagrees. Colour by audience: allies green, enemies red, everyone violet. Hidden tokens show
  nothing to players and a dashed ring to the GM; GM-only custom rings never reach players. Two GM
  controls on the Token layer, **Suppress auras** and **Clear aura marks**, and a client setting
  **Show pinned auras**. Foundry 14's token-attached Regions were considered and rejected because
  their exact-diagonal circle is an octagon that leaves out cells the rules put inside. Owned
  Talents from before the column receive their compendium copy's aura in the migration.
- **The Bind on the map.** A chain between the two bound tokens for everyone who can see both,
  labelled with the implements; a Controlled Bind points from the Controller with a Control pill.
  The Bound, Controlling and Controlled effects say what they are, carry the partner as origin and
  the particulars in their description, and there is one per Bind: condition effects now sit under
  the static ids the token palette uses, so a rules-set status shows lit there and a click toggles
  it instead of laying a twin beside it. A Bind formed from a card against a partner the player
  does not own is completed by the partner's owning client.
- **Exposed on the token**: four statuses (Exposed: Head, Torso, Arms, Legs) mirror the Zones both
  ways, from the sheet, the cards, the Posture reveal, Recenter, the round's end and the palette.
- **Rules pages for the Bind and for Exposed** in the STARWROUGHT Reference journal, opened from
  the Bind and Exposed card titles, the sheet's Bind line and EXPOSED badge, and the Bound row on
  the Effects tab.
- **Adjusted cards.** Whatever a player changes by hand on their character is said in everyone's
  chat, once: actions left, Temporary Vigor, Dying, Hero Points, Size, Senses, Languages,
  Familiarity, the Adjustments fields, Resistances, Weaknesses, Immunities, coin, a Zone Exposed by
  hand, and gear added, dropped, drawn or stowed. The system's own spends and cards are not said
  twice; the GM's edits are silent.
- **Spend Hero Point.** A player's Hero Points show a count and a Spend button that posts to chat;
  only the GM adds them.
- **`data/maneuvers.xlsx`**, the second actions workbook, generated from the roster's 39 Maneuvers
  (Aid stays in `actions.xlsx`) with `Enabled?` blank on every row, so no Basic Maneuver ships
  until Mike enables it (Mike, 2026-10-01: "get rid of all of these"). The converter reads every
  actions workbook in `data/`, errors on a name defined twice, and carries over the actions of a
  workbook that is absent this run (the untracked `actions.xlsx` on a fresh clone).

### Changed

- **The weapon-row Strike buttons print the cost glyph large and gold**, as the Maneuvers tab does
  (Mike: "very hard to see the number of actions").
- **Names print plain beside one gold glyph**: "Bull Rush" and ❷, not "Bull Rush ❷ ❷". The data
  and the compendium keep the glyph in the name, since document ids hash it.
- **The sheet for a player**: Ancestry, Bloodline, Culture, Background, Calling, Ancestry Vigor,
  Calling Vigor and Ancestry Speed are read-only text; Level is a badge with three Milestone star
  pips; Refuse Death is disabled unless Dying with a Hero Point; a Talent, Constellation or
  Chassis opens read-only; a Talent's image opens it rather than sending it to chat. The GM keeps
  every field.
- **The stance chips are labelled "Standing stance"**, with a hint saying the Combat Prompt
  pre-selects it; they stay because the prompt, the GM's standing-stances control, Reaction
  Strikes and the flow-off path all read them.
- **The Biography and Notes editors lay out and save.** The sheet's stylesheet had collapsed the
  editor to nothing and hidden its edit button; an open editor now survives a re-render.

### Fixed

- **A night's rest no longer hands out a Hero Point** at 0.
- **A Defense roll inside a Bind records the adversary attack's name** as the implement rather
  than "weapon".
- **From the adversarial review** (2026-10-01, fifteen agents over the change set): a GM-only
  custom ring is filtered where the range list is read, so it never reaches a player's preview,
  palette or HUD badge; forming a Bind over a Bind with someone else ends the old one first, on
  both sides; every Bind carries an id, kept in the emptied record, so the pair-keeper can tell a
  Bind one side ended while nobody could write the mirror from a mirror never written, and clears
  it instead of re-forming it on every scene load; the rules' condition writes and the migration
  touch only an effect under the condition's static id or carrying that one status, so an
  authored effect with several statuses (a net that is Prone and Restrained) is never deleted as a
  twin; a player who declined a Talent's build-time question has a Choose control on the
  read-only Talent sheet that asks again; a Maneuver from `data/maneuvers.xlsx` is stamped with
  that workbook as its Source, and keeps the book's group (its sheet) as its folder and category
  rather than collapsing into one "Basic Action" heap; a player-owned adversary's reset arrow is
  said in chat like its pips; a custom ring of 0 feet (the adjacent squares) is listed, as the
  renderer always drew it; ring labels print through the same plain-name rule as the sheets;
  switching the reach or aura client setting redraws both layers; an open Biography editor's
  draft is written to the character when the sheet redraws under it (the change the editor fires
  is dropped while a sheet renders), on the adversary sheet too; a canvas layer drawn between the
  canvas turning ready and its hook is destroyed rather than left as a ghost; the empty Maneuvers
  panel now says to enable a row rather than to rebuild; FEATURES.md no longer says a rest leaves
  a Hero Point; `data/README.txt` documents the Aura column.

### Not built

- Mike asked whether each Defense after the first in a round should take a cumulative -1. PHB
  v4.10 has no such rule, so nothing was built; it is recorded under "Questions for the author" in
  the sync report.

---

## 0.5.0 (2026-10-01): Player's Handbook v4.10, the attack flow

### Added

- **The Exchange is played as declare, commit, reveal, roll, resolve** (Mike, 2026-10-01; ruling
  65 in `v4.10-sync-report.md`). A Strike at one or more targets no longer rolls at once: the
  attacker declares the Maneuver and it locks; every defender commits, in private, a Defense
  (Evade or Guard) and an answer (nothing, a Reaction they own, or a ⓿↺ Posture Talent with the
  Zone it Exposes); when all have committed the choices reveal together; then the players roll. A
  player-controlled attacker rolls Attack once and that roll is read against every defender's
  Threshold; a player-controlled defender of an adversary's Blow rolls Defense against the
  adversary's Attack Threshold; player against player is not an opposed roll. Each pairing then
  gets today's full resolution card (Position, damage, the Reaction's charge).
- **The Combat Prompt**, a small non-modal window that opens for whoever has to act: the defend
  prompt (Defense, the answers legal for it, a Zone for a Posture, your Threshold if you are a
  character, Commit; your standing stance pre-selected), the locked state ("2 of 3 defenders
  ready"), Roll Attack and Roll Defense, and a GM row per adversary target. It closes itself when
  you have nothing left to do and reopens from the attack card.
- **One evolving attack card** per attack in chat: attacker, Maneuver, each target's status
  (Waiting, Committed, the revealed answer, the outcome), the roll, who is awaited, and one button
  for the viewer's own next step. GM controls on the card: Cancel, Reset defenses (everyone chooses
  again), Resend prompts, and Answer with standing stances, which commits every defender who has
  not answered with their current stance so an absent player never holds the table.
- **Adversary attacks start from the adversary sheet**: each attack row has the three Strike
  buttons, declaring against the GM's targets; player-controlled targets get the defend prompt and
  then Roll Defense against the attack's Threshold, which players never see. Adversary against
  adversary is the GM rolling the attacker flat against the defender's Threshold.
- **Privacy and authority.** Commitments live only with the coordinator (the GM's client when one is
  connected, else the attacker's) until the reveal; nothing about them is written to a message,
  flag or document before then. Every change goes through the coordinator over the system's new
  socket channel, with a revision number so a stale prompt cannot alter a newer state, and with
  ownership checked on the coordinator, never from a button being visible. Thresholds are computed
  from actor data on the coordinator; a client sends only choices. An adversary's Thresholds are
  never shown to players; a character's Threshold is shown to the attacker only with the new
  world setting `attackShowPcThresholds`. The world setting `attackFlow` switches the whole flow
  off, restoring the 0.4.2 behaviour (the stance read at the die).
- **What the two-client tests settled** (2026-10-01). A request is stale only against a revision
  older than the start of the current phase or than a reset, so one defender's commit never
  refuses another's. Cancel keeps the attacker's spent actions, since the declaration is the
  Maneuver. With no GM connected the attacker's client coordinates, holds the GM controls, and
  answers adversary targets with their standing stances at once; a GM-authored card then waits
  for a GM to return and adopt it, and an adoption before the reveal resets the defense phase. A
  player's reload reopens the prompt from the card; the coordinator's reload restores its private
  commitments from its own browser. The card prints "vs N" only beside a defender the attacker
  rolls against: where the defender rolls, their die meets the adversary's withheld Attack
  Threshold, and the Defense dialog now says so in place of its Threshold box. No enabled ⓿↺
  Posture Talent ships in the current data, so the prompt offers none yet.
- **What the adversarial review settled** (2026-10-01, ten agents over the change set). The
  coordinator reads who is asking from the server's own stamp on each socket message, never from
  the payload, so a forged `userId` cannot act as the GM or another player; requests and replies
  are addressed to one user and the server delivers them to that client alone, so a commitment
  never crosses another player's browser; a state broadcast is a wake-up only, and every client
  takes the state from the card's flags (authored by the coordinator or a GM, which the server
  guarantees), so a forged broadcast cannot replace a record, Expose a Zone or plant a roll; a
  reload believes only cards their coordinator could have authored. Two rolls landing within one
  card write no longer resolve every pairing twice. A roll carries the revision it was built
  against from before its dialog opened, so a Reset and re-reveal while the dialog was up refuses
  the late die instead of reading it against the new answer. A Blow persisted at the reveal
  itself (the coordinator lost between the reveal's two writes) now moves on to the dice when a
  coordinator picks it up. Reset defenses is offered only while defenders are choosing, since a
  die already paid for cannot be unpaid, and a reset closes any Zone a revealed Posture Exposed.
  When the last GM leaves mid-defense the coordinating client answers adversary targets with their
  standing stances rather than stalling. At a table with no GM the coordinating attacker now sees
  and may use the GM controls, as the docs said. The "no coordinator" message no longer tells a
  player to cancel what they cannot, and a slow coordinator is reported as a timeout, not as
  gone. The resolution cards use Foundry 14's `applyMode` and no deprecated roll-mode constant.
  Four unused language keys are gone. The docs now say plainly that the "never shown" rule for
  adversary Thresholds holds inside the flow: a Reaction Strike and the flow-off path print the
  number on their card as 0.4.2 did, and `attackFlow` governs characters' Strikes while an
  adversary's attack row always declares.
- **Every spend is said in public chat** (Mike, 2026-10-01). When a player-controlled actor spends
  actions in an encounter, a card names what it was (in the book's glyph), how many actions it
  took, and how many are left this round, with the reserved count while Preparing. Moves, Raise a
  Shield, Recenter, Prepared and Abandon carry the same line on the card they already post, so
  nothing is said twice; the overspend card now ends with the count too. The GM's adversaries stay
  quiet unless they overspend. Drawing or stowing a weapon is labelled "Interact: <weapon>".
- **Out of reach is said on the attack card** (Mike, 2026-10-01). A melee Strike at a target
  farther than Natural Reach plus the weapon's reach, or a ranged or thrown Strike beyond the
  weapon's range, still rolls; the card notes the distance and the reach for the GM to rule on.

### Changed

- **The cost glyphs on the Maneuvers tab are large and bright** (Mike, 2026-10-01): the ❶ ❷ ❸
  beside each Maneuver and Basic Action went from small text to a 1.45rem gold glyph with a dark
  halo, since the count is what a player reads off that list in a fight. The spend cards use the
  same size.
- **The pre-roll dialog counts actions in figures**: "3 of 6 actions left this round", matching the
  spend cards, where it read "3 of six".
- **The Pronouns row is gone from the User Configuration window** (Mike, 2026-10-01). A
  `renderUserConfig` hook removes the field from Foundry's own sheet on render; the stored value is
  untouched and the row returns if the hook is removed.

---

## 0.4.2 (2026-10-01): Player's Handbook v4.10, equipment authored in a spreadsheet

### Added

- **Weapons, armor and shields are authored in `data/equipment.xlsx`** (Mike, 2026-10-01), built
  from the handbook's Chapter 5 tables and authoritative for them from now on (ruling 64 in
  `v4.10-sync-report.md`). Three tabs: Weapons (Kind Melee or Ranged, Handling, Group, Damage,
  Reach or Range, Traits, Price, Notes), Armor (Zone, Protection, Load, Price, Traits, Material)
  and Shields (Bonus, Hardness, Load, Price, Note), each with the `Enabled?` column; shields have
  a tab of their own because the book keeps them apart from armor and their columns differ. The
  converter writes `assets/equipment.json` with an `enabled` flag on every row and regenerates the
  roster's four equipment blocks from the sheet (every row, since the web app and the Constellation
  Compendium are the authoring views), so hand edits to those blocks are now pointless, as they
  are for the ancestries block. The Foundry build reads `equipment.json`, ships only the enabled
  rows under the same document ids as before (an owned sword keeps its UUID), stamps them with the
  source `data/equipment.xlsx` as it does the sheet's actions, carries a weapon's Notes column into
  its description, falls back to the roster when the file is absent, and stamps the equipment
  counts into `content/sync.json`. The workbook was written with every row enabled; Mike curated it the same day, so Foundry ships 4
  of 29 weapons (Unarmed Strike, Dagger, Shortsword, Spear), 9 of 20 armor pieces (the padded and
  plate pieces) and no shield. Items already on a character sheet are untouched.

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
