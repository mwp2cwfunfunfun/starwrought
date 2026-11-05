# STARWROUGHT for Foundry VTT: changelog

Every entry names the Player's Handbook version its content was built from. A handbook change is
not finished until the spreadsheets, the web app, this system, its `FEATURES.md` and this file have
all caught up; `node assets/build_all.mjs` checks that mechanically and refuses to pass while the
handbook on the shelf is newer than `data/SYNC.json`.

---

## 0.16.0 (2026-11-05): the grammar in Fantasy Grounds' shape, Talent Maneuvers, the chassis as automation, Character Effects

Built from **Player's Handbook v4.21**, unchanged (`data/SYNC.json` untouched; v4.22 and v4.23 on
the shelf unsynced). Mike, 2026-11-05, after the 0.15.0 push: his workbook edits (`skills.xlsx`'s
and `callings.xlsx`'s indexes stripped to `Tree | Category | Primary Attribute`, the Callings' tabs
to `Attribute` with Requires, Grants and Aura gone and an `Automation` column; `backgrounds.xlsx`'s
Skills column renamed `Automation` and filled with `grant: 1, Skill, Acrobatics` lines) and five
questions: Steady the Line's prevention belongs on the Maneuver, the Talent only adding it;
shouldn't ALL of a Talent's effects, the Human's trait, Size, Speed and Vigor and the Cultures'
languages included, come from Automation instead of the converter parsing columns; should Stubborn
Footing be a Maneuver; should Close Ranks be an Aura; and "I REALLY, REALLY like the FantasyGrounds
effects automation ... can we use syntax substantially similar to this, instead of syntax we are
currently using?" His decisions by question: both of FG's layers, in FG's shape; the chassis facts
as feature lines on the Root with the index columns retired; Talent Maneuvers as rows in
`maneuvers.xlsx` that I add, granted by a feature line, with a marker in the Effect that reproduces
the Maneuver's text; Stubborn Footing and Close Ranks unchanged, and FG's "Character Effects field
... automated and shown on the Tracker, or on the Character sheet". Planned in
`eager-wobbling-possum.md` (the plans folder, the fourth plan in it). `AUTOMATION_GRAMMAR.md` is
rewritten whole; its section 9 maps every 0.13.0 operator to its component. The rulings:

- **182. Two layers, one stored shape, one release of grace.** A cell holds **feature lines**, blocks
  in square brackets for what owning the Talent does (`[TRAIT Human][SIZE Medium][SPEED 6][VIGOR
  8]`, `[LANGUAGE Common, Serrovine]`, `[Acrobatics trained]`, `[POINT Skill]`, `[MANEUVER Steady
  the Line]`, `[TALENT Weapon Familiarity]`, `[CHOICE Weapon Group]`, `[AURA 15 allies visible]`,
  `[VIGOR opening 12]`, `[SENSES ...]`), and **effect lines** for what it does to a roll, a tag then
  components separated by semicolons (`CHECK: 1 condition, aid; IF: RANK(Origin >= trained)`,
  `DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)`, `IMMUNE: prone;
  LIMIT: encounter`, `MARK: enemies`, `REROLL: diplomacy; IF: RESULT(critical failure)`, `IGNORE:
  terrain, mud`). `IF:` is the owner or the roll, `IFT:` the other party or the attack, as in FG;
  both prefixes read every condition. The readers (`module/rules/features.mjs`, `effects.mjs`) fill
  the stored rule shapes the kinds have had since 0.13.0 (`when`, `for`, `while`, `against`, `seen`,
  `limit`, `claim`, `marked`), so the `modifiers`, `prevent`, `use` and `card` hook points, the
  engine, the sheet's As read and the claim pin are untouched, and the self-test asserts each new
  line parses to the rule its 0.13.0 twin gave. The 0.13.0 form reads one more release, flagged
  `legacy` on the rule and WARNED about once per cell by the build and the pipeline step; 0.17.0
  refuses it. The 0.10.0 prose form stays refused.
- **183. The chassis is written on the Root, and the columns retire.** Nine feature kinds (`trait`,
  `size`, `speed`, `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`) join `grant` and
  `aura` as what a block makes. The Human's `[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]` and the
  Serrovanian's `[LANGUAGE Common, Serrovine]` are the authoring of the Ancestry's and the Culture's
  facts; a Calling's `[VIGOR opening N]` its Opening Vigor; `[<Skill> trained]` its free Training.
  The `_Tree Index` columns Vigor (and HP), Size, Speed, Senses, Traits and Languages, the Callings'
  Skills column, the tree sheets' Choice and Free Talent columns and the roster's Opening Vigor
  column are retired: read this release with one warning per workbook, and a disagreement with the
  Root's block fails the build as the Grants column's did. A new pipeline step,
  `assets/parse_rules.mjs` (between the converter and `inject`, every mode), parses every cell once
  with the system's grammar, writes `rules` into `trees.json`, `actions.json` and
  `backgrounds.json`, carries the Root's blocks into the roster's `ancestries`, `cultures` and
  `callings` records, and fails on a line it cannot read; the converter still holds no grammar
  (ruling 120), and the web app, the docx and the Foundry build read the records as before. On the
  character the feature lines of ANY owned Talent are read at prepare (`system.features`: a `[SPEED
  +1]` into the Move, `[TRAIT]` into the header's chips, `[LANGUAGE]` and `[SENSES]` into derived
  lists), so a Talent that adds a trait or a language works without the wizard.
- **184. A Talent Maneuver is a row, granted by the Talent.** `[MANEUVER X]` names a row of
  `data/maneuvers.xlsx` (a new "Talent Maneuvers" sheet, Type `Talent Maneuver`, so never basic);
  the row's Cost and Automation are the Maneuver's. When the Talent lands (a drag onto the sheet,
  the wizard's pick, or the GM's ready pass for Talents that gained the rule through Sync content,
  which fires no createItem) the Maneuver is copied from the Actions pack onto the character as an
  owned action Item flagged `grantedBy` the Talent's id, listed on the Actions tab under "From your
  Talents", used from there (a Maneuver whose rules act on use pays its cost and runs them, as a
  Talent did in 0.15.0), its rules indexed on the character as any owned Item's, and deleted with
  the Talent. Steady the Line ❶↺ (`IMMUNE: expose; FOR: allies 0`), Oathbound ❶ (`MARK: enemies` and
  its two `IFT: MARKED` lines) and Quick Tongue ❶↺ (`REROLL: diplomacy; IF: RESULT(critical failure)`)
  are the first three rows, which also ends 0.15.0's missing-glyph problem: the cost is the row's.
  Rally ❶ and Battle Cry ⓿↺ follow when their Constellations are enabled.
- **185. `@Maneuver[Name]` in an Effect prints the Maneuver.** Mike: the Talent's box "should
  reproduce the contents of the Maneuver, so I don't have to manually reproduce the Maneuver's
  details". The pipeline step replaces the marker, wherever the Effect prints (the web app, the
  compendium docx, the Talent Item, the wizard's card), with the Maneuver's block: its name and
  cost, Trigger, Requirements and Effect from the row. A name that is no row fails the build.
- **186. A Trained Root is a directed point.** `[Acrobatics trained]`, FG's own form for a
  proficiency, stores a `grant` with `constellation`, and the wizard makes of it the slot the
  Background grants have always had (`scope: "constellation"`, one slug), which auto-buys the Root
  when the Constellation is unopened and offers a deeper Talent when it is open; `[Lore trained]`
  is a Lore slot the player names. The Talent's `grant` field gains `constellation`; a Skill point
  may buy a Lore, as the slot engine's own case intended. Mike's `grant: 1, Skill, Acrobatics` lines
  read the same way under the legacy branch.
- **187. Character Effects, with FG's three states.** The Overview tab's Effects panel lists every
  effect line the character carries (Talents, Maneuvers, custom), each with its As read summary and
  the switch On / Skip / Off; Skip lets one application pass and returns to On, Off silences the
  line. Custom effects are lines the owner or the GM type in the grammar on the sheet, parsed on
  write (errors shown, never refused) and indexed as a carrier of their own, with a duration: until
  removed, the next roll, or the end of the encounter. The combat tracker shows a badge with the
  count of a combatant's active effects and their summaries on hover.
- **188. Stubborn Footing and Close Ranks stay as they are.** Neither is a Maneuver: the one is
  automatic (no action, no decision), the other adjacency; Close Ranks draws no ring.

Checked by the self-test (103 checks: the new readers, every planned cell against its 0.13.0 twin,
the feature blocks, the refusals, the system's category keys as scopes), the content loop with the
new step (`rules: 63 rules on 33 cells (15 kinds in use), 0 legacy cells warned; chassis: facts from
13 roots; markers: 3 expanded`; `automation: 36 rules on 21 documents (15 kinds in use)`), the
grammar-document gate widened to every tag, component, condition and feature keyword, the smoke
test and the style check, and live in `starwrought-test` (Foundry 14, restarted for the manifest;
the GM tab): Sync content refreshing 57 owned copies and the GM's ready pass granting Oathbound to
Tess and Quick Tongue and Steady the Line to Wren, each on the Actions tab under From your Talents
with the row's cost (❶, ❶↺, ❶↺) and category; Tess's `system.features` reading Common and Serrovine
and the Human trait from Humanity's and the Serrovanian's cells; Oathbound used from the Actions
tab in an encounter paying ❶ (6 to 5) and marking the Bandit; Wren adjacent, the Expose widget's
`preventersFor` offering Steady the Line as a Reaction for Tess (and nothing at four feet); Wren's
Diplomacy pinned to a natural 1 against 15 drawing the "Quick Tongue ❶↺: reroll" button, which paid
❶ and threw again; the Weaponmaster Calling Talent's `grant` reading Skill, Athletics with the
choice (Weapon Group) and the free Talent from the cell; the Human chassis reading Vigor 8, Medium,
6, Human from the Root; the Acrobat Background's chassis grants from `[Acrobatics
trained][Athletics trained][Lore trained]` and the wizard auto-buying the three Roots; the
Weaponmaster step asking the Weapon Group and granting one Athletics point; the Effects panel at
"11 active", Serrovanian's line Off dropping its claim from the Diplomacy offers, a custom "Behind
the cart" `DEF: 1 situation, guard` on Tess moving Guard 15 to 16 and the tracker badge to 12,
cleared with the Combat's deletion (`registerEffectsHooks`). **Four defects found live and fixed
before the tag:** the client's `resolveRuleTarget` hands the system's category key ("skill"), which
the `grant` kind did not read, so the first Sync content's `_preUpdate` re-parse turned every
Trained Root into an Opening point (the kind reads both forms; the self-test holds it); the copies
refresh matched a copy by its exact name, so a Talent whose glyphs left its name (Steady the Line,
its cost now the Maneuver row's) kept a stale copy, as the Jack of All Trades rename had (the match
is glyph-blind now, `nameKey`); the Weaponmaster step offered its free Training twice, once from the
chassis `grants` and once from the Root's directed `grant` (one point: the Talent's duplicate of a
slot the step holds is skipped); and a second `STARWROUGHT.Chargen.trainedIn` key in `en.json` made
the Background slots read "Trained in undefined" (`trainedInFrom`). **Not done, said so:** Rally ❶
and Battle Cry ⓿↺ rows; durations in rounds on a custom effect; dice values on a modifier;
adversaries' rolls; a Skip on a `prevent` line is cleared by the asking (`preventersFor` writes the
mark); the `weapons.xlsx` Melee sheet's retired Choice column (Weapon Familiarity's "Weapon Group
or Technical Weapon"), warned and read, Mike's to move into a `[CHOICE ...]` block.

---

## 0.15.0 (2026-11-05): the Cultures, their Talents' automation, and difficult terrain on the map

Built from **Player's Handbook v4.21**, unchanged (`data/SYNC.json` untouched; v4.22 and v4.23 on
the shelf unsynced). Mike, 2026-11-05, after the 0.14.0 push, three points: the Bloodline card
should carry the Talent's Description as the Ancestry card carries the Human blurb; he restructured
`data/cultures.xlsx` as he had the ancestries and wrote a `Serrovane Lore` and a `Kestrel Reach
Lore` sheet, wanting the Cultures given the Ancestry's treatment in the compendium and the wizard;
and he rewrote the eight Culture Talents and asked for their Automation, asking how a roleplay-only
bonus ("+2 to notice hidden clauses") should be automated ("should we have some sort of 'apply'
button on the Maneuver that applies the bonus to the next roll, similar to FantasyGrounds PF2e
effect automation?"). His decisions by question: **both** a checkbox in the roll dialog and an arm
button on the Talent row; Iron Etiquette's Intimidation fully automated and its "other social
manipulations" by the roleplay path; and for Riverfoot's difficult terrain, "Let's build Difficult
terrain INTO the maps! using a region or some sort of method! so this can be automated. and players
can toggle layers to see what is difficult etc." Planned in `eager-wobbling-possum.md` (the plans
folder, the third plan in it). The grammar grew three operators, three kinds and two hook points,
one Talent at a time as ruling 119 says; `AUTOMATION_GRAMMAR.md` carries all of it. The rulings:

- **174. A claim is the player's decision, at the roll.** `CLAIM(<text>)` on a `bonus` line: the
  bonus is offered in the roll dialog as an unticked checkbox whose hint is the Talent, the bonus
  and the text ("Serrovanian: +1 Condition bonus toward someone who shares your Culture. Tick it if
  this roll is one."), on any roll that shows a dialog; ticked, it joins the roll and prints on the
  card by the Talent's name. The Talent's row on the Constellations tab carries a pin: armed, the
  claim comes to the next roll's dialog ticked and to the next Threshold read (which has no dialog)
  applied, and the pin goes out when either resolves (`flags.starwrought.rules.armed`;
  `module/rules/claims.mjs`). Nothing is applied unasked and nothing is remembered past that one
  roll. Serrovanian, Reacher, Contract Literate, Broker's Eye and Iron Etiquette's second line are
  claims; the sheet's Threshold tooltip lists them with every other rule the position-blind number
  leaves out.
- **175. The other party is read per pairing.** The rules now know who is on the other side of a
  roll (`other` on the roll context): the attacker a Defense roll answers and a Threshold read is
  made against, the roller whose check reads a Threshold, and, for a Strike, each defender as the
  pairing resolves, since the one blind die knows nobody. A rule about the defender (`MARKED`) is
  therefore read by the coordinator per pairing with `pairingOnly` and added to that pairing's total,
  listed on its card and kept in its flags (`pairingModifiers`) so a reroll adds it again; the die
  itself is unchanged. The Combat Prompt's previews pass the attacker too.
- **176. A mark names one creature.** The `mark` kind (`mark: [<Who>] [, <Until>]`, `enemies` or
  `all`, `encounter`): using the Talent names the player's one targeted token as the creature it
  marks (`flags.starwrought.rules.marks.<talent>`: the token, its name, the Combat), refused with a
  notice when nothing or the wrong relation is targeted, said on the Talent's card. The mark holds
  while that Combat is the viewed one; made outside an encounter, while none runs. Nothing clears
  it, as FIRST and ONCE marks are compared and never cleared. The **`use` hook point** is defined
  with it (triggered: the owner's client executes, the Item's use names the event, a refusal stops
  everything and a failed write is logged): `SwItem#use` on a Talent with a cost in its name, or
  with a rule of a kind that acts on use, pays the cost in an encounter, applies the kinds' writes
  and posts the card; the Talent row has the Use control for it. Oathbound's three lines are the
  mark and two `bonus ... MARKED` lines, Attacks and Defenses.
- **177. A reroll pays once, in an encounter.** The `reroll` kind (`reroll: <Target> [,
  IF(Outcome=<Degree>)]`, the Target a Constellation or `Checks`) puts a button on the matching
  check card of the owner's roll ("Quick Tongue: reroll"), drawn from the card's flags for the owner
  and the GM by the **`card` hook point**, defined with it (triggered: the presser's client
  executes, the message id names the event, a failed reroll leaves the first card standing). Pressed,
  it pays the Talent's cost through the owner's actions when a Combat runs and nothing outside one,
  throws the same die again with the first card's modifiers (every check card now carries them in
  its flags), marks the first card superseded and posts the new one naming the Talent and saying its
  Requirements are the table's. A roll against no Threshold has no degree and is never offered;
  Attack and Defense cards keep the 0.5.3 Reroll button. `IF(Outcome=...)` is read by this kind alone
  and refused by the rest by name.
- **178. Difficult terrain is a region behavior with a kind.** A `difficultTerrain` Region behavior
  (`system.json`, `module/data/region-behaviors/difficult-terrain.mjs`) carries a kind (`Mud`,
  `Shallow Water`, `Decking`, `Loose Stone`, `Rubble`, `Undergrowth`, `Snow`, `Ice`, `Sand`, `Other`;
  `SW.TERRAIN_KINDS` in `module/config/terrain.mjs`) and a cost multiplier (2 by default, the book's
  difficult terrain); Foundry charges the cost along every token's path, splits the ruler at the
  edge and slows the animation, and the movement tracker reads the cost as it always has. The
  system's terrain data (`SwTerrainData`, `CONFIG.Token.movement.TerrainData`) keeps the kinds
  crossed, so the ruler's label says "difficult: mud". A token whose actor ignores the kind (the
  `ignore` kind, `ignore: Terrain [, <Kind>, ...]`, no kind meaning all) gets no effect from the
  behavior at all and is never split, charged, slowed or labelled: the decision sits in the
  behavior's `_getTerrainEffects`, the one place Foundry hands it the token (Foundry's own
  `resolveTerrainEffects` never sees it). Overlapping difficulties multiply as core multiplies them.
  A hidden region carries no terrain for anyone (Foundry skips hidden regions), so a terrain region
  is never hidden to keep it secret; instead every client has its own overlay (`canvas/terrain.mjs`,
  a fill in the kind's colour with the kind and the cost named, drawn as the auras are) and a toggle
  in the token controls backed by the client setting `showTerrain`. Riverfoot's two lines are the
  `ignore` and `bonus: +1, Situation, Speed, ONCE(encounter)`.
- **179. A check against a target's Threshold reads it live.** A Maneuver whose check names a
  Defense (Demoralize against Guard), used with exactly one target, reads that target's Threshold
  through `defenseThresholdFor` with the check's Constellation as the Threat (`check` on the Threat
  context) and the roller as the other party, so `AGAINST(<Constellation>)` (the operator's new
  reading, beside the Threat words: only when the check read against this Defense rolls that
  Constellation) and `MARKED` apply; the number prints for a character target or a GM roller and is
  withheld for an adversary as the attack flow withholds it, the degree read all the same, and the
  read's FIRST/ONCE marks are written on the target when the client may. Through 0.14.0 the player
  typed the Threshold. Iron Etiquette's first line is `AGAINST(Intimidation)`; the Maneuvers that
  would read it (Demoralize, Feint, Talk Them Down) are rows Mike has not enabled yet, so it fires
  on a world Item until then.
- **180. A Culture's languages come from the index.** `roster.cultures` is generated from
  `data/cultures.xlsx` as `roster.ancestries` is from `ancestries.xlsx` (`{ name, enabled,
  attribute, languages, blurb, lore, traits, tree }`; the Lore sheet's Summary row the blurb), the
  `_Tree Index` carrying an optional `Languages` column (written this release: "Serrovine, Common",
  "Reachspeak, Common"); while a workbook has none the converter carries the languages from the
  previous roster row with a warning naming the column. The Culture chassis Item gets the blurb, the
  Lore rows, the languages, the traits and the root Talent's Effect as its Special Ability; the web
  app and the compendium docx print a per-Culture section as the ancestries have.
- **181. A Speed bonus moves the Move and nothing else.** `Speed` is a `bonus` scope word: feet
  added to a Move, read by the movement tracker and the ruler with `kind: "move"`; Step, Rush, Leap
  and Crawl stay on the Speed itself, since the book's word is "Move". A FIRST or ONCE on it is
  marked when a Move is charged, so a Step or a Rush first leaves Riverfoot's foot unspent. The
  move's card says where the extra foot came from.

Also in 0.15.0: the wizard's cards print the root Talent's **Description** in italics above its
Effect on every step that stands on a Root (Bloodline, Culture, Calling, Combat Training), and the
Culture step has the Lore panel the Ancestry step got in 0.13.0, from the `Serrovane Lore` and
`Kestrel Reach Lore` sheets; the Culture card's chips are its languages and Key Attribute, and a
root Description that is the blurb word for word (both Culture roots today) is not printed twice.
Every check card carries its modifiers in its flags. `system.json` declares the `RegionBehavior`
type. Checked by 24 new self-test checks (100 pass), the content loop (`automation: 23 rules on 17
documents (7 kinds in use)`), the smoke test and the style check, and live in `starwrought-test`
(Foundry 14 restarted; the GM tab): the Diplomacy dialog's claim unticked, ticked and armed, the pin
spent after the roll; Oathbound used with the Bandit targeted, the mark written and said, Tess's
Guard read 16 bare, 17 against Wren and 18 against the Bandit, and a Deliberate Strike through the
attack flow resolving with "Oathbound +1" on the pairing's card; a Demoralize world Item against
Tess reading her Guard at 17 (15 on the sheet, Wren's Torchbearer and Iron Etiquette) with the
Threshold tooltip naming both; Quick Tongue's button on a Diplomacy critical failure and the new
card superseding the first; a Mud region costing Tess 12 for 8 ft and Wren 8, the ruler's path
split for Tess alone, the overlay toggling off and on; Wren's first Move of 7 ft charged as one Move
with the mark written; the Culture chassis with twelve Lore rows; the wizard's Bloodline leads and
Culture step. **Not done:** the two Talents whose names carry no cost glyph (Oathbound, Quick
Tongue: the sheet's Talent column reads "Oathbound" and the ❶ is in the Effect) pay nothing when
used or rerolled, since the cost is read from the name; Torchbearer's Rally Aura cell waits for
Excel to release `data/ancestries.xlsx`; the player-tab paths (an adversary's Threshold withheld
from a player's Demoralize) were exercised in code only; and the token's landing after a charged
Move was not re-verified in the pane (Foundry's movement animation does not complete there).

---

## 0.14.0 (2026-11-05): the Rally Aura, Traits, and the Lore panel

Built from **Player's Handbook v4.21**, unchanged (`data/SYNC.json` untouched; v4.22 still on the
shelf unsynced). Mike, 2026-11-05, after the 0.13.0 push, with nine points on `data/ancestries.xlsx`
and the wizard: the `Requires` column deleted (Prerequisites is the requirement since ruling 166),
the `_Tree Index`'s `Flare Triggers`, `Meta note` and `Summary` deleted and a `Traits` column added
("we will need to find a good place on the Character Sheet for Traits"), Humanity's Effect
flattened to a +1 to Aid, Jack of Trades renamed **Jack of All Trades**, the Torchbearer Human
rewritten as the **Rally Aura** ("The first time each round an ally within 15 feet who can see you
defends against an Attack with the Fear trait, they gain a +1 Situation bonus to that Defense
check"; "the automation should make sure that it only applies to allies that can SEE the token"),
the Ancestry step's Lore panel to use the window's height, and the question what Steady the Line's
automation does when the Reaction is announced after the GM says "you are Exposed". Planned in
`eager-wobbling-possum.md` (the plans folder, the second plan in it). The rulings:

- **170. `SEEN` is line of sight, nothing finer.** A new flag operator for `bonus` and `prevent`:
  the rule applies only to a recipient who can see the owner. Sight is a straight line between the
  two tokens' centres meeting no sight-blocking wall (Foundry's sight polygon backend), the seer not
  Blinded, and the seen token not hidden nor its actor Hidden or Undetected (`canSeeToken` in
  `module/rules/scene.mjs`, handed to the kinds as `scene.sees`). Light, sight range and hearing
  are not read; the owner always sees themself; a scene with no sight test reads as unseen, so the
  operator is never assumed. The book's v4.15 "see or hear" clause is gone from Mike's text, and
  so is the grammar document's line that said sight was the table's.
- **171. `IF(Trait=<Trait>)` reads the attack, and an unknown trait is a warning.** `Trait` joins
  `Rank` as a reserved word in `IF`: the attack being answered carries that trait. The attack
  record (`maneuverFrom`, `AttackWorkflow.create`) now carries `traits` (the weapon Item's, the
  adversary attack Item's or the spell Talent's `system.traits`), `threatContext` hands them to the
  kinds, and the match is on the trait's first word, case blind (`Thrown 20 ft` carries Thrown).
  Only a Defense in the attack flow knows the attack, so a Defense rolled from the sheet for its own
  sake stays out. There is no closed list of traits: the build collects every trait a shipping
  weapon, action or Talent carries and **warns** on one nothing carries, since the rule reads and
  fires when the first such attack is authored. Today that is Fear: nothing in the data carries it.
  Tree sheets gain an optional `Traits` column, written as `system.traits` on the Talent, so a spell
  Talent can carry one. The Rally Aura's line is `bonus: +1, Situation, Defenses, FOR(allies, 15ft),
  SEEN, IF(Trait=Fear), FIRST(round)`, and it moves the ally's Defense roll against an adversary
  and the Threshold a player attacker rolls against alike, as 0.13.0's position rules did.
- **172. A `prevent` of `Expose` answered after the Zone pick closes the Zone.** Steady the Line's
  button sat in the Expose widget to be pressed before the Zone was picked; pressed after, it paid
  and said "It Exposes nothing" and the Exposed stood. Now the card remembers which Zone it Exposed
  on whom (`flags.starwrought.exposed`, written by the GM's client on the relay path or the card's
  author), its widget shows "Exposed in the Arms" in place of the select with the Reaction buttons
  still there, and the Reaction pressed then closes exactly that Zone (the body's owner locally,
  another player through the GM's client over the `expose:*` socket with the same live reading of
  the Talent's reach, and with no GM connected the Exposed stands, said in a notice) and the card
  says "The Arms Zone is closed again". A Zone Exposed by anything but that card is never touched.
- **173. A character's traits are its chassis's, read live.** The `_Tree Index`'s new `Traits`
  column ("Human") goes onto the Ancestry record, the Ancestry chassis Item (`system.traits`,
  carried by `content/chassis.json`), the web app's Ancestry card and the compendium docx's
  Ancestry table, and the character sheet's header gets a read-only **Traits** field beside the
  five chassis names: the chips of the Ancestry's, Bloodline's and Culture's traits, found by the
  names the sheet stores (`traitChips` in `helpers/actor-context.mjs`), never written on the
  character, so a change to the sheet reaches every character through Sync content and the GM
  edits the chassis, not the sheet.

Also: the ancestry blurb (the app card, the docx's italic line, the chassis description) is the
Lore sheet's Summary row (Mike: the deleted column "was a copy of Summary row in the Ancestry's
Lore tab. So just use that instead"); the Ancestry step's Lore panel fills the height the window
leaves below the cards and scrolls inside itself (`chargen.css`; it stopped at 260px with the rest
of the window empty); Humanity's cell is one line, as its Effect is; the grammar document names
`SEEN`, `IF(Trait=...)`, the Traits column and the Expose undo, with a 0.14.0 history line; the
self-test has 93 checks. **Not done:** Torchbearer's new cell could not be written while Excel
held `data/ancestries.xlsx` open (the line is in `AUTOMATION_GRAMMAR.md`, section 5, for Mike to
paste, or for the next run once the file is closed); the Jack of All Trades rename gives the
Talent a new document id, so a character who owned "Jack of Trades" keeps that copy beside the
new one after Sync content (the test world's Tess).

## 0.13.0 (2026-11-05): the level-1 Human, whole; the operator grammar

Built from **Player's Handbook v4.21**, unchanged (`data/SYNC.json` untouched; no handbook moved;
a v4.22 Mike is editing sits on the shelf unsynced, so the full pipeline reports drift and the
content loop warns). Mike, 2026-11-05, after the 0.12.0 push: his renamed columns in
`data/ancestries.xlsx` (`Feeds` to `Primary Attribute` on the index, `Attribute` on the Human sheet,
"no Attribute cell should ever be blank"; the `Requires` column emptied, "the Prerequisites column
is the one that should have been used in the first place"; `Grants` and `Aura` removed; every Human
Talent enabled), the rewritten `Human Lore` sheet to show in Character Creation and on the
Ancestry's compendium window, Languages off an Ancestry, the question whether a check's bonus moves
its Threshold, and the list of automations a level-1 Human needs. His decisions by question: **one
comprehensive, intuitive grammar**, shown as a plan first and then as a human-readable document
(`AUTOMATION_GRAMMAR.md`, the first commit, "make sure to update it with any automation code
changes"); **logical operands and comma shortcuts, no prose connectives** ("IF(Origin=Trained)",
"Bonus: +1, Condition, Aid"); **prevent and protect one kind**, the recipient `self` by default;
**Talent Point grants move into Automation**; **one release**, a commit per kind. Planned in
`eager-wobbling-possum.md` (the plans folder) and built in nine commits. The rulings:

- **164. The operator grammar.** A rule is `<kind>: <arg>, <arg>, ... [, <OPERATOR>(...)]`: the
  kind's positional arguments, comma-separated, then any operators in capitals with their contents
  in parentheses, the same operator meaning the same thing in every kind and refused by name where
  a kind has no use for it. `IF(<Constellation>=<Rank>)` (also `>=` and `<=`; `Origin` the pooled
  rank; `IF(Rank=Untrained)` the roll's own rank, Handling included), `FOR(<Who>[, <N>ft])`,
  `WHILE(<Who><op><N>[, <N>ft])`, `AGAINST(<Threat>)` (a Threat word, or `Melee` / `Ranged` for a
  Blow by its reach), `FIRST(round)`, `ONCE(encounter)`, `DIFFERENT`, `VISIBLE`
  (`module/rules/operators.mjs`, pure, read once for every kind). Four kinds: `bonus` rewritten to
  it (`bonus: <±N>, <Type>, <Target>`; the Target a Constellation, a Maneuver, or `Defenses`,
  `Checks`, `Attacks`, `Initiative`; the 0.10.0 prose form refused with the new shape printed, and
  a 0.10.0 rule stored on an owned copy still read), `grant: <N>, <Scope> [, DIFFERENT]` (the
  Grants column's successor; `toGrantField` is the wizard's `{ n, mode, scope }`), `aura: <N>ft,
  <Who> [, VISIBLE]` (the Aura column's successor; `toAuraField` is `system.aura`), `prevent:
  <Effect>` (below). `AUTOMATION_GRAMMAR.md` is the reference, kept current in the same commit as
  any change to a kind, an operator or a vocabulary, and `build_all.mjs` fails when a registered
  kind has no section there or an operator is not in its table. The level-1 Human's nine Talents are
  written in it in `data/ancestries.xlsx` (13 rules on 9 documents): Humanity's four lines against
  the Origin, Driven, Quick Study and Versatile Human's grants, Stubborn Footing, Close Ranks, Jack
  of Trades, Torchbearer Human's ring and its first-Defense bonus, Steady the Line.
- **165. `prevent`, the first triggered kind.** A Condition by name, or `Expose`, does not land:
  on the owner by default, on others within range with `FOR`. A carrier without ↺ acts by itself:
  `SwActor#setCondition` asks the `prevent` hook point before a Condition goes on (never off, never a
  Zone's Exposed mirror), skips the write, posts one card naming the Talent ("Stubborn Footing: Tess
  is not Prone") and writes the FIRST/ONCE mark, and the token palette's path asks the same in
  `preCreateActiveEffect`; the client that would have written the Condition is the one that acts,
  the write names the event, and a rule that cannot be read lets the Condition land. A carrier with
  ↺ is offered as that Reaction where the effect would land: the Expose widget on the Exchange card
  lists every Reaction Talent on the scene that reaches the body a Stop would Expose ("Steady the
  Line ❶↺ (Wren)"), its owner presses it, pays the Talent's cost, the card is flagged `prevented`,
  the widget goes and the card says "It Exposes nothing"; a Zone already chosen is not undone, the
  Reaction being answered before the Zone is picked. Outside an encounter a `FIRST(round)` or
  `ONCE(encounter)` applies every time, and the card says so.
- **166. Prerequisites is the requirement when Requires is empty.** A talent sheet with no
  `Requires` column, or an empty one, reads `Prerequisites` as the requirement: each comma- or
  "or"-separated piece that names a Talent of the same sheet becomes `requires`, and the rest stays
  prose that still prints, so "Expert in Melee" on another sheet is untouched. The Human sheet's
  seven dependent Talents require Humanity, Versatile Human or Torchbearer Human through it.
- **167. The sheet's Threshold is position-blind; the roll and the attack flow read the map.** A
  rule that needs the map (`FOR` reaching others, `WHILE`), the Threat (`AGAINST`) or the round
  (`FIRST`, `ONCE`) cannot be read by the character's Defense pass, which has no token and answers
  no Threat; `prepareDefenses` asks for the static rules alone (`staticOnly`) and the Defense roll,
  the Combat Prompt's preview and the coordinator's reveal and resolution ask for the rest
  (`momentOnly`, with the scene, the Threat from the attack's record and the encounter), so Close
  Ranks and Torchbearer land on the card and the preview and nothing is counted twice; the field's
  tooltip says what it leaves out. The marks a `FIRST` or `ONCE` leaves on the recipient
  (`flags.starwrought.rules.round` / `.encounter`, keyed by Talent and line) are written by the
  client that resolved the roll (the roller's own in `SwCheck.roll`, the coordinator's for a
  Threshold read), never by a preview; at a table with no GM an adversary's mark may not be written.
  Another token's rule that reaches this actor is labelled with the owner's name ("Torchbearer Human
  (Tess)"). Allies and enemies are by token disposition, as Support counts them (never a party
  token, a hidden token or a Dying, unconscious or dead body); ranges are edge to edge in feet.
- **168. The `Grants` and `Aura` columns are retired.** An `aura:` line and a `grant:` line in
  Automation are the authoring; a sheet that still has an `Aura` column keeps working, a row with
  both is a converter error, a filled `Grants` cell is read this release with a warning and must
  agree with the line or the build fails. `Primary Attribute` reads as the index's tree-level
  attribute and `Attribute` as the talent-level one, a blank cell on a sheet headed `Attribute` an
  error, a sheet still headed `Feeds` keeping the inherit rule; an unknown header on any sheet is
  warned about by name, so a renamed column is never silently dropped again (the renamed index
  column read as `""` for a build).
- **169. The Lore sheet.** A `<Tree> Lore` sheet beside a tree's sheet (`label | text` rows, no
  header, the author's order) is read as `lore` on the tree and on the Ancestry's chassis record,
  written as `system.lore` on the chassis Item, shown on the Ancestry's Description tab under the
  Description and, in Character Creation, under the card grid for the highlighted card (hover or
  focus; the chosen card otherwise; no re-render). An Ancestry shows no Special Ability panel (its
  effects are its Talents'); Languages show only on a Culture (Mike: "Ancestry doesn't grant a
  language"). The web app and the compendium docx are unchanged.

**The Threshold question** (Mike's item 7): the system has always applied a check's bonuses to its
Threshold (a Defense's is 10 + the same stack its roll uses; every Skill Threshold shown is 10 + the
check's modifier), and the book says so once, in Checks and Thresholds ("including any bonuses and
penalties that apply"). Its Key Terms entry does not repeat the clause, so one sentence is proposed
there as a tracked change in `Starwrought_Players_Handbook_v4.21_thresholds_proposal.docx`
(`assets/phb_propose.py`, `PROPOSALS["thresholds"]`), Mike's to accept; FEATURES.md says the same.

**Also**: the five caster Callings (Spellshaper, Blood Mage, Necromancer, Summoner, Spellblade) left
the pack sources with this release because `data/callings.xlsx` as Mike saved it has their
`Enabled?` cells blank; setting the rows to Yes restores them under the same ids.

**Not done, recorded in CLAUDE.md:** a `prevent` of a Condition on an ally as a Reaction (no Talent
asks for it); Torchbearer's "while they can see or hear you" (no operator reads sight); an
adversary's rolls (flat, as before); the web app and the compendium docx printing the Lore or the
cell.

Checked by the self-test (90 checks: the operator reader, every kind's forms, refusals and summary,
the hooks on fake actors and a fake scene), the converter (zero errors on the renamed workbook), the
content loop, and live (below).

---

## 0.12.0 (2026-11-05): no Defense is ever chosen by the system

Built from **Player's Handbook v4.21**, unchanged (`data/SYNC.json` untouched; no handbook moved).
Mike, 2026-11-05, on the sheet's Standing stance chips: "do we still need this ... since every
Exchange asks what Defense they want to use?" and then "no applying a default, ever: The Attack
Flow should not be an option to turn off... it is critical to the functioning of the system."
Planned first (`eager-wobbling-possum.md` in the plans folder) and built in six steps, one commit
each. The rulings, continuing the v4.21 sync report's numbering:

- **159. No Defense is ever chosen by the system.** "The defender chooses one of the two Defenses
  that answer it" is a choice made per attack in the Combat Prompt, by the defender's controller
  or, explicitly and per defender, by the GM. The standing stance (`system.stance`, the header's
  two chips, the Token HUD's stance button, the whispered stance card, `helpers/stance.mjs`,
  `SwActor#setStance` and `answeringDefense`, `SwCheck.#readDefender`, `SW.LEGACY_STANCES`) is
  gone; the prompt opens with **no Defense selected and Commit disabled** until one is picked, and
  the answers it allows appear once it is; the coordinator's silent `{ defense: "evade" }`
  fallbacks at the reveal, the resolution and the roll are errors now; `rollAttack`'s forced
  `defense` option went with them. The 0.12.0 world migration deletes the field from every actor
  (`Migration.stanceRemoved`), and the model drops it on read.
- **160. The attack flow is not optional.** The `attackFlow` world setting (0.5.0) and its
  roll-at-once path are gone; a stored value is ignored. Every attack at a target declares; with
  no target there is no defender, and a Strike or a Cast rolls against the Threshold typed in the
  dialog.
- **161. A Reaction Strike declares and is answered by a basic Defense alone.** Intercept (a
  character's with the weapon that reached, an adversary's with its longest attack row, both from
  the Intercept card) and the Riposte declare into the flow with `reaction` on the record and
  `basicOnly` on its profile: the prompt offers the two Defenses and no Reaction or Posture (a
  Reaction never triggers a Reaction), the coordinator refuses any answer under it, Intercept's
  ❶↺ is paid at the declaration and returned if the Blow is cancelled before the die, the Riposte
  is free, and a Reaction Blow is never counted by "one Blow at a time" in either direction. The
  adversary's Intercept answer card (the mover's Defense roll outside the flow) and the dead
  Counter button on the check card are gone; an adversary is offered no Riposte, having no weapon
  Item to strike back with.
- **162. With no GM connected an adversary's Defense waits for one** (Mike's choice over the
  attacker answering for the foe). Nothing auto-commits: the Blow stays at "Waiting for defenses"
  with the card naming who waits for a GM, and the coordinator re-sends the prompt when one
  connects. The GM's "Answer with standing stances" control is replaced by **explicit rows for
  absent players**: the GM's prompt lists every uncommitted player character whose player has not
  answered, last, under an "Absent players" heading, with the same controls and the Threshold
  shown (`gmDefendAbsent` in `outstandingFor`); a later commit from the player is refused as
  stale, as before.
- **163. A Cast declares, and the prompt offers the Threat's two Defenses.** A spell Talent's
  Cast with targets declares with the Talent, the Cast kind, the Threat, the Delivery and the two
  permitted Defenses on the record (`maneuver.source: "spell"`, `maneuver.spell`,
  `maneuver.defenses`); the prompt offers those two (Evade / Endure for a Blast, with a line naming
  the Threat) and the Reactions and Postures legal on each (ruling 132; the melee-only ones never);
  the caster's one die is read against every target's Threshold (ruling 155); `SwCheck.resolveAgainst`
  takes a spell source (`source`, `talent`, `cast`, `outcomes`) and resolves with no Strike, the
  spell's three Cast texts as the outcome rows, its subtitle and its damage buttons, and `rerollCard`
  keeps a spell card a spell card; a Focused or Committed Cast in an encounter Prepares with every
  target remembered (`preparing.targetUuids`) and declares against them all when Finished; a Cast
  with no target rolls against a typed Threshold. An adversary still casts nothing (`Cast.npc`).
  0.11.0's higher-Threshold reading, the last Defense the system chose, is gone.

**The coordinator split** promised in CLAUDE.md at the first non-Blow Threat: `attack-socket.mjs`
(the transport: delivery to one user with `recipients`, the reply's correlation, the timeout, the
dispatch of an incoming message with the server's sender stamp; it reads none of the revision,
ownership or election, which stay in the coordinator; the damage, reroll and party relays stay on
their own emits for now, `reroll:*` the first candidate) and `attack-source.mjs` (what the attack
is: `resolveSource` reads a weapon, an attack row or a spell Talent off the attacker's own Items,
so the Threat, the Defenses and the cost are never the declaring client's to say; `maneuverFrom`,
`costOf` for the refund, `attackThreshold`, `meleeAnswers`, `describe` for the card and the
prompt, `castOutcomes`, `resolveArgs` for the resolver, `rollBlind` for the roller's die), with
`attack-coordinator.mjs` keeping how the table agrees. `AttackWorkflow` gains `profileFor`
(the permitted Defenses, basic-only, melee, whether Position applies), `waitingForGm`, the
`gmDefendAbsent` outstanding kind and the record's `source`, `reaction`, `basicOnly`, `threat`,
`defenses` and `spell`, a pre-0.12.0 card reading as the Blow it was; `legalAnswers` and
`isLegalAnswer` take `{ permitted, basicOnly, melee }` (the melee refusal moved in from the
coordinator, so the prompt, the check and the coordinator share one reading); `defenseThresholdFor`
takes `permitted`, so an unavailable Defense falls to the other the Threat allows.

**Checked** by `node assets/test_rules.mjs` (74 checks: ten new over the pure parts, the record's
defaults for a Blow, a spell and a Reaction Strike, `profileFor` on an old record, the GM's absent
rows, `waitingForGm`, `isLegalAnswer` refusing a Defense outside the pair, an answer under
`basicOnly` and a melee Reaction against an arrow), `node assets/build_all.mjs --content`, and
live in the test world (the 0.12.0 changelog's live list is in `CLAUDE.md`'s cleared entry).

**Not done.** Cover the Angle and the size clauses stay the table's; an adversary casts nothing;
a spell's range prints no note; sleeping in armor is unapplied (section 9 of `FEATURES.md`).

---

## 0.11.0 (2026-11-04): Player's Handbook v4.21

Built from **Player's Handbook v4.21** (`Starwrought_Players_Handbook_v4.21.docx`, Mike's
`StarWrought_v4.21_Reorganized_Redline.docx` under `assets/phb_format.py`'s formatting pass, the
visible text unchanged by a character; the cover and footers already read v4.21). The repository
was synced to v4.15; v4.16, v4.17 and the v4.20 draft came and went on the shelf unsynced, and v4.21
reorganises the book into eight chapters and moves the rules below. By the handbook rule every
consumer moved with it (`data/*.xlsx` and the new `data/magic.xlsx`, `assets/roster.json`, the
converter and the builders, the web app, this system, `FEATURES.md`, this file, both READMEs,
`CLAUDE.md`), then `data/SYNC.json` was stamped. The rulings are in `v4.21-sync-report.md` in the
project root (125 to 158, continuing the v4.14 report's numbering), with the handbook's own defects
for Mike and the reviewer's five margin comments answered as the system behaves. Two redlines wait
for Mike's acceptance: `Starwrought_Players_Handbook_v4.21_callings-vigor_proposal.docx` (the
Chapter 3 Calling table's Vigor column brought to the five casters' root texts, Mike's decision) and
`Starwrought_Players_Handbook_v4.21_consistency_proposal.docx` (the typos and the two Reaction card
titles a machine can fix). Planned first (`eager-wobbling-possum.md` in the plans folder; Mike,
2026-11-04: "going forward, let's plan before making changes"), then built in the order the plan
set: data, then the engine's stacking, the constants, the Constellation groups and the Origin, the
Strike Attribute, the Reactions as Talents, the damage pipeline, the spells. A minor bump: the
stored data changes shape in four small ways and the world migration writes them once.

### What the book moved, and what the system does about it

- **Stacking** (Chapter 4, Bonuses and Penalties: "Independent bonuses and penalties stack,
  regardless of type. Count each underlying circumstance only once"). `SW.resolveModifiers`
  (`module/config/modifiers.mjs`) is a sum now, with an optional `source` on a modifier naming the
  circumstance: entries that share one collapse to the strongest bonus and the strongest penalty
  among them, and `suppressed` carries what was set aside. The three types stay on every modifier
  as the book's labels for where the number comes from. Two sources are tagged: `off-guard` on the
  Off-Guard condition and the first Torso Wound (Off-Guard made lasting, so a Wounded fighter who is
  also Off-Guard is −2, not −4), and `rule:<item>:<target>` on the `bonus` kind's applied
  modifiers, so one Talent's rank lines on one target give the higher while two Talents' bonuses
  add. Frightened and Fatigued add; a Parry weapon and a raised shield both add to Guard (ruling
  125); two Scouts give +2 Initiative (ruling 126). Through 0.10.1 the highest bonus and the worst
  penalty of each type were taken. The self-test checks the contract (four new checks).
- **Constellation groups and the Origin** (Chapter 3, Constellations and shared ranks). A tree with
  a Parent is a **group** (a Combat Style within Melee or Ranged, a magical specialty within its
  discipline): `prepareConstellations` (`module/data/character/constellations.mjs`) gives it no
  rank of its own but its parent's rank, bonus and pool in a second pass (`rankFrom`), the sheet's
  row wears the parent's badge dimmed with a hint, and an unopened group shows the parent's rank
  too. Root first stands (ruling 127): a group's points count toward the parent once the parent's
  Root is owned, and the creation wizard refuses a group Talent before it
  (`STARWROUGHT.Chargen.whyNeedsParentRoot`), measuring the tier gate against the parent's pool.
  `SW.ORIGIN_SLUG` (`origin`) is a virtual Constellation: the model derives `system.origin` from
  the Ancestry, Culture and Bloodline skies and `proficiency("origin")` answers from it, so the
  `bonus` kind's `if Origin is Expert` reads the shared rank; the resolvers (the build's and
  `resolveRuleTarget`) answer "Origin" as a Constellation and say whether a name is a group, and the
  kind refuses `if <group> is <Rank>` naming the parent to test instead. The registry carries
  `group` and `parent` (`SwConstellationData` has a `group` field; `isGroupSlug` in the config).
  The Magic category (`magic`) is between the Combat Styles and the Skills.
- **The creation wizard** (Chapter 3, Creating Your Character: thirteen points; "If this is your
  first Calling, you also gain N Vigor and Training in Melee or Ranged", or in one of the five
  disciplines for a caster). The combat training is the first Calling's grant: the **Combat
  Training** step follows the Calling and offers what the chosen Calling's root names
  (`trainingChoicesOf` reads the root's Effect: Melee or Ranged for the five martial Callings, the
  five disciplines for the five casters; the martial pair when nothing readable). The floor stays
  14: the book's thirteen plus the Skill Training every Calling's root text still grants, which
  Chapter 3's count leaves out (the report names it for Mike).
- **The Strike Attribute** (Chapter 4, The Attack: "Melee: Might, or Agility if the weapon has the
  Finesse trait. Ranged: Agility, or Might if the weapon has the Thrown trait"; "A Strike made as
  part of another Maneuver ... If that Maneuver's Key Attribute has a higher bonus than the Strike's
  normal Attribute, you may use it instead"). `attackAttribute` on the weapon is Might, or Agility
  for Finesse or a ranged weapon; `strikeAttributeFor(weapon, { thrown, maneuver })` reads a throw
  as Might (a Finesse dagger thrown is Might, the book's words taken literally; ruling 129) and
  lends a Maneuver's Key Attribute when higher. The roll dialog offers **As part of a Maneuver**: the
  owned Talents and Maneuvers whose Key Attribute beats the weapon's (`maneuverChoicesFor`), none by
  default, the Requirements the table's; the chosen one rebuilds the base terms and the card says
  "via <Maneuver>". The Combat Style substitution of v4.14 and the weapon's `style` field are gone
  (`migrateData` drops the field; a Style is a group with no Attribute of its own to lend), and so
  is the Composite trait (read as nothing now).
- **Reactions are Talents** (Chapter 4, Answering an Attack; the Defense Constellations). The
  table of the ones the system implements is `SW.REACTIONS`, keyed by the slug of the Talent's
  plain name: Give Ground ⓿↺ (Evade Training's own text) and Set Your Feet ⓿↺ (Guard Training's),
  Sidestep ❶↺ (Evade +2, a Step on a Stop), Slip the Line ❶↺ (Evade +2 against melee, a Move to a
  space adjacent to the attacker on a Stop), Drop Flat ⓿↺ (Evade +4, you drop Prone, no Zone
  Exposed), Parry ❶↺ (Guard +2 against melee, a rigid implement, Control on a Stop), Riposte (the
  Quick Strike back instead of Control, when owned), Kneel Behind the Shield ⓿↺ (Guard +4 with the
  shield Raised, the Arms Exposed, rooted), Deflecting Palms ❶↺ (Guard +2 against melee, a hand
  free; the damage reduction is the table's), Cover the Angle ❶↺ (an ally's Blow against your Guard;
  the table's: the prompt offers no answer for another's Blow yet), Intercept ❶↺ (Melee Training's).
  Void and Counter are gone from the book and the system. A character owns a Reaction by owning the
  Talent of that name, or the Training root that grants it (`ownedReactions` in
  `module/helpers/answers.mjs`; `system.reactions.owned` on the actor, the flat booleans by key
  beside it); an adversary owns them all, the GM's to declare. `legalAnswers` offers the owned
  rows on the Defense being rolled (a Reaction of kind "reaction", a Posture of kind "posture"; a
  ⓿↺ Talent in Evade or Guard the table does not know is still a Posture by the general rule, +2
  and a Zone), a Posture's bonus is the table's (`postureBonus`: Drop Flat and Kneel +4), a Zone is
  asked only of a Posture that Exposes one of the defender's choice (`postureNeedsZone`; Kneel
  names its Arms, Drop Flat none), and the reveal applies the drawback (Prone) where it applied the
  Zone. A melee-only Reaction is refused against an arrow (`STARWROUGHT.Prompt.meleeOnly`); the
  card's Stop offers follow the row (`onStop`: step, adjacent with its own card line, control, and
  the Riposte when owned). The standing stance is Evade or Guard alone (`helpers/stance.mjs`,
  `SW.LEGACY_STANCES`: a stance stored as void, parry or counter reads as the Defense it stood on,
  and the migration writes it). One answer per attack (ruling 133).
- **Damage** (Chapter 4, Damage Resolution; Weapon Damage Dice; Damage Delivery). **Weapon dice
  are the rank's**: one at Trained, two at Expert, three at Master, four at Legendary, in the Melee
  or Ranged rank the Strike rolled (Handling's lowered rank included, carried on the card as
  `rank`), a Quick Strike and a Graze one; the level table (two at 4th ... five at 16th) and the
  specialization damage are gone ("do not add them a second time as weapon specialization"; ruling
  153). `SW.weaponDice(rank)`, `system.melee.dice` and `system.ranged.dice`, the Overview's weapon
  dice field reads "1 / 1". **The order**: Immunity, the total, Resistance (a sum since v4.21),
  Weakness (a sum, only if damage remains), the Zone's Protection once for a Zoned Attack (never
  below 1; never for a Pervasive one), the critical doubling, the Deadly die, Temporary Vigor,
  Vigor; through 0.10.1 Weakness came before Resistance and the doubling before Protection.
  `SwDamage.apply` takes `delivery` ("zoned" | "pervasive"), the damage card carries it, and
  Persistent Damage now goes through the pipeline Pervasive (`onPersistentRoll`), where through
  0.10.1 the card named the amount and left the applying to the sheet. The material-weakness step
  and the matched harness's Torso +1 are gone with their tables (ruling 149); `SW.ARMOR_TYPES`
  replaces `MATERIALS` (padded, leather, mail, lamellar, brigandine, splint, plate; `scale` reads
  as lamellar, ruling 141) and the adversary Zone's `material` field is dropped. `force` and
  `psychic` join the damage types (ruling 134). A Quick Strike's Miss costs nothing
  (`STRIKE_KINDS.quick.exposeOnMiss` false; Table 9).
- **Spells, first cut** (Chapter 6, the Magical Constellations; Spellwork: "Cast ❷ to ❹"). The
  magic sheets carry structured spell columns (Threat, Delivery, Range, Die, Damage, Targets,
  Quick, Focused, Committed, Defenses; `data/README.txt`), the converter validates them, and the
  build writes them onto the Talent as `system.spell` (`SwTalentData`; `isSpell`, `spellDefenses`,
  `spellDelivery`, `spellType` derived). A spell Talent's row on the Constellations tab and its
  Item sheet carry the **Cast ❷ ❸ ❹** (`SW.CAST_KINDS`: Quick, Focused, Committed; `SwItem#use` on
  a spell casts it). `SwActor#castSpell` (`module/documents/actor/cast.mjs`) rolls the discipline's
  Proficiency (the Talent's Constellation, or its parent when it is a specialty's) with the
  discipline's Key Attribute as an attack with `source: "spell"` and no Strike, against the higher
  of the two Defenses the Threat permits on the target (the defender's choice read as the choice a
  defender makes, named on the card), pays the actions (a Focused or Committed Cast in an encounter
  is Prepared under the three-action rule, `prepare({ kind: "cast" })`, and resolves at the next
  Opportunity), and prints the three Cast texts as the card's outcome rows. The card's damage
  buttons roll `SwDamage.rollSpell`: the discipline's rank in dice (`SW.spellDice`: one at Trained
  to four at Legendary; one for a Quick Cast; a Quick Cast's Graze deals nothing), the spell's die
  and first type, no Might and no sheet damage bonus (ruling 136), delivered as the spell says; a
  Quick Cast may Critically Hit (ruling 135). Position and Bind offers stay away from a spell. The
  Cast rolls at once, outside the attack flow's declare, commit and reveal: the coordinator still
  declares weapon Blows and adversary attack rows only, and the first non-Blow Threat in the flow
  (the split `CLAUDE.md` names) is not in this release (section 9 of `FEATURES.md`). Areas, pushes,
  conditions on a Hit, summons, Temporary Vigor pools and healing are the Talent's text.
- **The constants.** Support to a maximum of +4 (`SUPPORT_MAX`). Rush ❷ for three times Speed
  (`RUSH_MULTIPLIER` 3, `RUSH_COST` 2; `classifyMove` makes a straight line longer than two Moves a
  Rush), Off-Guard until the next Opportunity in the card's words. Leap ❶ ❷ ❸ at half, one and one
  and a half times Speed less Strain (`LEAP_STEPS`; `system.leap` is the three numbers, the
  Overview prints them). Crawl ❶ half Speed, the Speed the final Legs Wound took (`CRAWL_DIVISOR`;
  ruling 138). Sizes penalise only (Tiny −2 and Small −1 Guard; Large −1, Huge and Gargantuan −2
  Evade; ruling 139). Wind with no exemption (ruling 150 supersedes 74): everyone carrying Load
  Strain rolls at the end of every round, a failure Fatigued +1 and a critical failure +2
  (`WIND_FAIL_RISE`, `WIND_CRIT_FAIL_RISE`); `system.wind.exempt` is always false. Fatigued N on all
  four Defenses. Load Strain a Condition penalty on Stealth, Acrobatics, and the offered Climb or
  Swim (`STRAIN_CHECKS`, `STRAIN_TYPE`). The Attribute Bonus has no +5 cap (`ATTRIBUTE_MAX`
  Infinity; ruling 158: v4.21's Key Terms names none).
- **Armor** (Chapter 5, the armor table and its traits). **Visored** replaces the helm penalties
  by name: the armor Item stores `lowered`, derives `visored`, `visorPenalty` (−1 Gear to Awareness
  and Initiative while lowered) and `effectiveProtection` (one less while raised); the Equipment
  tab's control and `SwItem#toggleVisor` flip it for an action and say so, and the two Maneuvers
  Lower the Visor and Raise the Visor run the same method once Mike authors their rows
  (`documents/maneuvers.mjs`). **Fitted** replaces the matched harness: the Item stores `adjusted`
  (the player's tick on the Item sheet or the Equipment tab), and three adjusted Fitted pieces worn
  are the Fitted Harness that takes 1 off Load Strain (`FITTED_ZONES`, `FITTED_RELIEF`). Clatter
  counts mail, lamellar, brigandine, splint and plate, a Muffled piece never (ruling 142). The
  armor sheet's Material select is the Type.
- **Vigor and rest** (Chapter 4, Vigor). The Endure Bonus to Vigor is gone (ruling 151, Mike's):
  Vigor is 10 + Opening Vigor + Ancestry Vigor × level. **A night's rest restores all of it**;
  **ten minutes' rest** (`SwActor#restTenMinutes`, the Overview's second rest button and the
  Fatigued card's "Ten minutes' rest") restores level × Presence when Presence is positive (ruling
  144) and ends Fatigued, one card. The five casters' Opening Vigor is their root texts' (6 / 8 / 6
  / 6 / 8; ruling 152, Mike's), in the roster and the chassis pack.
- **Comets** (Chapter 7). The Deferred Talent Point is the **Comet** (ruling 145): `system.comets`
  (migrated from `deferred`), the badge and its Spent control on the sheet and the party roster
  (`spendComet`), the Flare card's reminder, and the Milestone award counting one at the fourth
  Milestone ("You also gain a Comet") as well as one for a Milestone point no Flare can take.

### The pipeline and the data

- `data/magic.xlsx`, new: the five disciplines and their ten specialties (Category `Magic`, the
  specialties' `Parent` naming their discipline), every Talent from the book, the spell columns
  filled where the book gives a spell. `data/callings.xlsx`: the five roots renamed "<Calling>
  Calling", the first-Calling clause, the five caster sheets. `data/defenses.xlsx`: the Reaction
  Talents (Sidestep, Slip the Line ❶↺, Drop Flat, Parry, Riposte, Kneel, Deflecting Palms, Cover
  the Angle), the Training roots granting one Posture each, Endure Training without the Vigor
  clause. `data/equipment.xlsx`: the Armor sheet is the book's 27 pieces with `Type` and
  `Description`. `data/ancestries.xlsx`: the Human sheet gained its `Automation` column and
  Humanity's four lines, written against `Origin` (the 0.10.0 item closed:
  `automation: 4 rules on 1 document`). The converter: Category `Magic`, `group: true` on a tree
  with a Parent, the spell columns validated into `node.spell`, Armor `Type` and `Description`,
  `---` as blank. The builders: `spellOf` onto the Talent, `group` on the Constellation and the
  index, the Origin in the rule resolver, the new journal pages (Damage Delivery, Spellwork, Weapon
  Size), the compendium docx's new sections. The web app, by the fork that did its pass: groups,
  the Magic category and the spell block, the Calling's combat training in the wizard, the derive
  pass to v4.21 (the fitted harness, the visor, dice by rank, Rush ❷, the Leap tiers, the rests),
  the Reactions from the roster's `postures` block, the Comet conversion, the migration of old
  Calling roots and armor names, every prose section; smoke test SMOKE CLEAN.
- **The world migration** (0.11.0 step of `migrateWorld`): a stance stored as a Reaction to its
  Defense, `deferred` to `comets`, Scale armor to Lamellar, a weapon's `style` and an adversary
  Zone's `material` dropped; counted and said once (`STARWROUGHT.Migration.v421`). The data models'
  `migrateData` read every one of these across on load already, so a world that opened once under
  0.11.0 before the step was present behaves the same.
- **Checked live** in the test world: Frightened 1 + Fatigued 1 = −2 on Evade and Awareness alike;
  Off-Guard + Torso Wound = −2 once; Shield Fighting, Armored Fighting and Great Weapon Fighting
  wearing Melee's rank; `proficiency("origin")` Trained and Humanity +1 Condition on Hrolda's Aid
  from the refreshed copy, offered unticked on a plain Diplomacy; a Battleaxe thrown reading Might;
  Give Ground and Set Your Feet owned from the roots, Parry, Riposte and Drop Flat owned from
  Talents of those names, Drop Flat folding +4 with no Zone, an unowned Sidestep falling back with
  the note; `migrateData` turning `{stance: "void", deferred: 2}` into `{stance: "evade", comets:
  2}`, Scale into Lamellar, dropping `style`; 15 feet at Speed 6 a Rush ❷ and 18 feet (past the
  Strain-shortened 16) three Moves; the Seamfinder taking 8 slashing on Resistance 2 and Protection
  2 as a Critical Hit for 8 (8 − 2 − 2, doubled), 6 Pervasive with no Protection line, and 11 fire
  through its Weakness 5; a night's rest filling test 1's Vigor and ten minutes' rest healing
  Hrolda 1 (level 1 × Presence 1) and test 1 nothing (Presence 0); Elementalism Training owned by
  test 1 casting Quick ❷ ("Quick Cast ❷ · Blow · Zoned · Elementalism", Elementalism (Trained) +3,
  flags `source: "spell"`, `strike: null`) and its Focused damage card 1d6 fire Zoned; the wizard's
  Combat Training step listing the five disciplines for a Spellshaper and Melee for a Weaponmaster;
  the character, adversary, Talent, armor and weapon sheets rendering with no console error, the
  Overview printing "❷ Rush 16 ft", "❶ 1 / ❷ 4 / ❸ 7 ft" and the two rest buttons.

### Known gaps in this release

The Cast outside the attack flow (above); Cover the Angle, Kneel's rooted Speed and the "no more
than one size larger" clauses as the table's; a Reaction Talent under a name the table does not
have offered only as a ⓿↺ Posture by the general rule; the magic sheets' areas, pushes and
conditions as text; sleeping in armor (Fatigued equal to Load Strain, maximum 3) still not applied.
All in section 9 of `FEATURES.md`.

---

## 0.10.1 (2026-11-04): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, `data/SYNC.json` is untouched, and
no data moved, so the pipeline's outputs stand as 0.10.0 left them. The release is **the first
four architecture recommendations** from an outside review of the system, which Mike is bringing
one at a time on the condition that each is validated as warranted before any code moves and that
a change serve maintainability and keep a reader, human or AI, from changing the wrong code
(Mike, 2026-11-04). All four are splits of a file that had grown by accretion, all four were
done mechanically (every line sliced out by range with a coverage assertion, then the old and the
new compared), and none changes what a player does, save one control on the Item sheet that
now does what it says; the sections below carry the recommendations that followed in the same
release, the twelfth last: **the stylesheet**, `styles/starwrought.css`,
one file of 2,947 lines through 0.10.0, is eleven files, one per window, and the split fixed the
three places where the one file's order, not its authors, decided how a rule read; **the Item
data models**, `module/data/item.mjs`, 873 lines, are one file per type under
`module/data/items/` with the shared pieces beside them one concern per file, which also put the
weapon Trait parser where the build can import it; and **the rules constants**,
`module/config.mjs`, 1,166 lines and the most-changed file in the system, are one file per
concept under `module/config/` with the old path a barrel, which refiled the constants that sat
under the wrong heading and put the version stamp in a file named for it; and **the Item sheet's
details tab**, `templates/item/details.hbs`, 386 lines branching eight ways, is one partial per
type under `templates/item/details/` with the three shared panels beside them, which removed a
panel written out twice. A patch bump; two pills and three card accents now look as they were
written, a carry-state select stands where a checkbox on a derived value stood, and nothing else
on screen or in the data moves.
`Starwrought_Players_Handbook_v4.16.docx` is still on the shelf, untracked and unsynced, as 0.9.0
and 0.10.0 said.

### Added: the action counter on the Token HUD, and a token-bar sweep

The fifteenth recommendation (Mike, 2026-11-04: "When a player selects their token during combat,
you could show a small action counter in the Token HUD, such as 4/6, rather than a full token
bar"). Validated: nothing on the token showed actions; the HUD carried the stance and ring
buttons, the token bars Vigor only, and `actions.value` was offered as a trackable value nobody
had put a bar on. An addition, then, not a replacement.

- **The counter** (`actionsCounter` in `module/apps/token-hud.mjs`): first in the HUD's right
  column, above the stance button, the actions free to spend now over the round's count ("4/6")
  with the sheet's three-state pips beneath (`actionPips`, the one computation the sheet and the
  tracker share), the legend as its tooltip, red at zero as the tracker is. A readout, not a
  button. Shown only while the actor is in an encounter, to owners and the GM, on characters and
  adversaries alike. The HUD re-renders when the actor it shows changes `system.actions`
  (`updateActor`, as the tracker row does), so the number moves as the player spends with the HUD
  open. Styles in `hud.css`.
- **A defect found on the way, fixed by a migration step.** Hrolda's token still pointed its
  first bar at `hp`, which 0.6.0 renamed to Vigor on the actors and not on the tokens, so the bar
  drew nothing. The 0.10.1 step of `migrateWorld` points every prototype and scene token bar on
  `hp` at `vigor`, once, reported as the other steps are (`STARWROUGHT.Migration.tokenBars`). A
  world that already opened under a pre-release 0.10.1 build has its stamp past the step; setting
  the world setting `systemVersion` to `0.10.0` once and reloading runs it.
- **Checked** live: with the stamp set back, the reload retargeted four bars (two prototype, two
  scene) and left none on `hp`; outside an encounter the HUD had the stance button and no
  counter; in one it read "6/6" first in the column, "4/6" after two actions spent without
  reopening it, and "1/6" with free, reserved, reserved, spent, spent, spent after a three-action
  Maneuver was Prepared, the tooltip ending in the legend each time.

### Added: more than six actions a round, for a character too

The fourteenth recommendation (Mike, 2026-11-04: "Ensure the system supports situations where
more than 6 actions are allowed (e.g., maybe some NPCs, or a haste spell)"). Validated: the book
allows it ("some creatures have more or fewer"), an adversary already carried its own number
(`actionsPerRound`, 1 to 12) and every reader honoured it, but a character was six in the actor's
getter and six again in `resetActions`, with no field or condition that could raise it; and above
six the sheet's pips printed ❻ for every later pip, the glyph table ending there.

- **`bonuses.actions`** on the character, an **Actions a round** field on the Overview's
  Adjustments panel beside the Vigor bonus, with a hint. `prepareActions` in
  `module/data/character/actions.mjs` (a new pass, after Vigor) derives `system.actionsPerRound`
  as six plus it, clamped to 0 and the ceiling, so the field reads on both Actor types and an
  Active Effect targeting `system.bonuses.actions` is how a haste spell lands later, with no
  spell system today. Negative for the reverse. Slowed still comes off at the start of each round.
- **One getter.** `SwActor#actionsPerRound` reads `system.actionsPerRound` on both types; the
  reset, the sheet's pips (`actionPips`), the tracker, the ruler's budget, the spend cards and
  the Prepared refund all go through it. The duplicate six in `resetActions` is gone.
- **`ACTIONS_MAX`**, twelve, in `config/actions.mjs` and the barrel: the schema maxima of
  `actions.value`, `actions.reserved` and the adversary's field (12 by literal through 0.10.0),
  the adversary sheet's input, the tracker's slice and the derived clamp all read it.
- **Glyphs ❼ to ⓬** for the seventh to twelfth pip, and six more ruler colours for the seventh
  to twelfth Move, none repeating an earlier hue.
- **No Quickened condition** (Mike's choice): the book has no such word, and it can come with the
  first spell that needs it, as a handbook proposal.
- **Checked** live: the field at +2 derived 8 and the getter agreed; +9 clamped to 12 and −8 to
  0; a round started with "8 of 8", the sheet drew eight numerals to ❽ in three states, the
  tracker "4/8" with eight pips and the legend; Slowed 1 started the next round at "7 of 8"; the
  adversary's own field held at 9 with its input capped at 12. The self-test and the barrel check
  pass; everything restored afterwards.

### Changed: reserved actions read as reserved, on the sheet and in the tracker

The thirteenth recommendation (Mike, 2026-11-04: "Use a more illustrative display in Combat
Tracker and Character Sheet to take Reserved actions into account", with a mock of three pip
states, available, reserved and spent). Validated: the sheet already drew the three states, but
in the Attribute colour for Agility and with the states named only in a tooltip; the combat
tracker lit a pip only while free, built from its own arithmetic, so an action reserved for a
Prepared Maneuver looked spent there and existed only as the text "+2 reserved".

- **One computation.** `actionPips(actor)` in `module/helpers/actor-context.mjs` derives the
  state of every slot (free, reserved, spent), the three counts and a legend ("2 available, 2
  reserved, 2 spent."; `STARWROUGHT.Actions.legend`). The sheet's `actionsContext` and the
  tracker's `actionsReadout` both read it, so the two displays cannot disagree about a Prepared
  Maneuver again.
- **One colour.** A new token, `--sw-reserved` (violet, `#9b6bd6`), on `.starwrought` in
  `starwrought.css`; the sheet's reserved pip and its caption use it in place of `--sw-agility`
  (`character.css`); the tracker's pips carry `sw-free`, `sw-reserved` or `sw-spent` in place of
  the one `sw-lit`, a reserved pip filled in the token's colour (`hud.css`, with the token's value
  as the fallback, since the tracker is core's element outside `.starwrought`).
- **The legend** is appended to both tooltips: the sheet's block and the tracker's line.
- **The big number** in the tracker stays the free count, what a player can act on now; the
  mock's "4/6" counted the reserve in. Mike chose the free count ("Do it" on that reading). The
  pips and the legend carry the reserve, and the "+N reserved" text stays beside the number.
- **Checked** live: in an encounter, one action spent and a three-action Maneuver Prepared,
  the tracker read "2/6" with pips free, free, reserved, reserved, spent, spent in gold, violet
  and hollow, and the sheet's six numerals the same states in the same colours, both tooltips
  ending in the legend; abandoning the Maneuver returned the two pips to free on both.

### Changed: the Actor's verbs, the round's cards and the chat cards, one file each

The twelfth recommendation, the four files of `module/documents/` the review named, all four done
(Mike: "Do all four"). Nothing a player does changes; no method moved off `actor.<name>()`, no
card reads differently, and no socket message changed shape.

- **`documents/actions.mjs` is `documents/movement.mjs`.** The file charged a token drag against
  the six actions and offered the Intercept, and nothing else; its name read as the actions
  workbook or the Actions pack. `registerActionTracking` is `registerMovementTracking`, and
  `starwrought.mjs` and `canvas/ruler.mjs` import the new path.
- **`documents/combat.mjs`** (1,192 lines) keeps the two documents, `SwCombatant` and `SwCombat`,
  and the hooks that move the round (612 lines). Out of it: **`helpers/cards.mjs`** (`cardHtml`,
  `postCard`, `ownersOf`, `tableFor`, `requireOwner`, `actorFromUuid`, the `cardActions` map and
  `registerCardButtons`, which binds every `data-sw-combat` button on render; the card idiom six
  modules import, which imported it from the Combat's file through 0.10.0);
  **`helpers/authority.mjs`** (`isElected`, `responsibleFor`: who counts and who writes when
  every client hears a hook); **`helpers/settings.mjs`** (`setting`, the read that may run before
  the settings are registered; the attack coordinator keeps its private copy, left whole by
  Mike's ruling); **`documents/cards/round.mjs`** (the Recovery, Wind, Persistent Damage and
  Prepared cards, the Pass-while-Preparing note, `persistentDamageOf`, and the seven button
  handlers, registered by `registerRoundCards`, which `registerCombatTracking` calls); and
  **`apps/combat-tracker.mjs`** (the actions readout, the Pass button and the pass streak on
  core's rows, `registerTrackerReadout`, registered by `starwrought.mjs` itself, since the module
  imports `SwCombat` and a registration from `combat.mjs` would close a circle).
  `movement.mjs`, `party-socket.mjs`, `helpers/party.mjs`, `helpers/content-sync.mjs` and
  `canvas/ruler.mjs` import from the new homes; `styles/README.md` names the tracker module.
- **`documents/chat.mjs`** (899 lines) keeps the three entry points: `onRenderChatMessage`, the
  `onCardButton` dispatch, and `onChatSocket`, now a router that validates the address and the
  server's stamp once and hands `damage:*`, `reroll:*` and `expose:*` to the family that answers
  it (195 lines; the three resolvers re-exported under their old names). The handlers live by card
  family in **`documents/cards/`**: `shared.mjs` (`resolveActor`, `resolveTokenDoc`, `ownedActor`,
  `zoneFrom`, `resolveTargets`, the socket name and `replyTo`, the one emit the three families
  answer with; imports only the config, so no family closes a circle through it), `damage.mjs`
  (roll, Apply, the relay and `onDamageSocket`, the applied card), `reroll.mjs` (the dialog, the
  sibling set, the Hero Point, `onRerollSocket`), `flare.mjs`, `position.mjs` (Expose with its
  relay and `onExposeSocket`, the Bind, Give ground, Step, Counter and riposte, charging a
  Reaction, Recenter) and `attack.mjs` (the Threshold prune and the attack card's buttons). The
  `onDamageSocket` alias of `onChatSocket`, kept since 0.5.3's first cut for an importer that
  never existed in the repository, is gone; the name is the damage family's handler now.
- **`documents/actor.mjs`** (2,471 lines, 24 commits, the most-changed file) is the composition,
  the lookups (`resolveActor`, `rulesOfKind`, `tokenOnScene`) and the lifecycle hooks (160
  lines), over thirteen mixins in **`documents/actor/`**, one section each, in the original's
  order: `conditions` (105), `wounds` (the body, Wounds, Dying, Recovery, refusing death,
  treating a Wound; 353), `checks` (the roll data, a check, the Relevant Check picker; 157),
  `defense` (the Defense roll, the stance, the Threshold an answer presents, with the stance words
  and the Posture bonus; 348), `attack` (the Strike, a Maneuver's attack, the declared targets,
  Support, the Grab line, the weapon rank, damage, with `attackFlowOn`; 489), `points` (a Hero
  Point, a Deferred Talent Point; 62), `actions` (six a round; 335), `carrying` (49), `position`
  (Recenter, Expose, Give ground, Step; 125), `auras` (78), `bind` (this actor's side of it; 155;
  the pair-keeper stays `documents/bind.mjs`), `flares` (112) and `rest` (41). Every method body
  is verbatim. A `#private` member is scoped to the class that declares it, so the generator
  asserted that each is called only from its own section, which held for all nine; the one
  static private, the conditions' write queue, is a module-level Map, and the Bind's two calls of
  the static `SwActor.resolveActor` read the pair-keeper's resolver directly, which is what the
  static does. `sameName`, used by the attack and the carry state, is `SW.sameName` in
  `config/names.mjs` and the barrel. `SECTIONS` in `actor.mjs` is the order of layering and
  carries no meaning: no section overrides another's method, and `super` reaches Actor.
- **Checked:** `node --check` and a free-identifier check (every name a file uses that any of
  the split files declares must be declared or imported in that file) on all 28 files; the
  self-test (59 checks) and the style check; a clean world load with no console error. The
  Combat and chat halves by driving one button of each kind in a short encounter before and after
  the split: the tracker's readout, Pass button and streak; the Persistent Damage, Recovery,
  Prepared and ten minutes' rest cards and their buttons; Expose and Recenter through the
  dispatch; a damage card applied to the named target; a Defense card rerolled by the GM with the
  old card superseded; a critical's Flare button opening the picker; a declared Strike's card
  cancelled from its GM control. The Actor by the method surface (the same 59 names and three
  statics on the prototype chain, now fourteen deep) and 785 read-only answers on the world's four
  actors, identical before and after, then every write path once: a condition set and cleared, a
  carry state moved and back, a Hero Point spent, a custom aura added and removed, a Zone Exposed
  and Recentered, a Posture's Zone surviving Recenter and clearing at the round's end, a Bind
  formed with its mirror picked up and ended on both sides, the stance, an encounter joined, two
  actions spent, a Maneuver Prepared and abandoned with its reservation, a Pass stamped, a Flare
  lit and put out, a Hit at 0 Vigor opening a Wound and `adjustWounds` closing it, Dying begun,
  raised and ended, and a night's rest. The test actors, tokens, Combat and messages were
  restored afterwards.

### Changed: the check engine's parts, one module each

The eleventh recommendation: `module/dice/check.mjs`, 1,206 lines and the second most-changed
module, split along the review's own groups, which were the file's. `SwCheck` stays the facade,
so every caller still says `SwCheck.roll`, `resolveAgainst`, `previewTotal`, `strikeCanCrit`,
`chargeReaction`, `rangeNoteFor`, `rerollCard` and the target helpers; about 30 call sites in
nine files are untouched.

- **`module/dice/check/`** (new): `modifiers.mjs` (`assemble`, `baseModifiers`: the base terms,
  the Automation rules' `modifiers` hook call, the caller's own; 152 lines), `dialog.mjs`
  (`prompt`: the pre-roll dialog; 156), `card.mjs` (`toMessage`, `cardContext`, `cardFlags`,
  `canFlare`: the one renderer every result ends in; 194), `position.mjs` (`position`: Settle
  Position; 100) and `strike.mjs` (`strikeCanCrit`, the one rule the engine, the dialog, the card
  and the damage roll all ask; 22). `check.mjs` keeps `roll` and `resolveAgainst`, the order of a
  roll, and the public statics, and is 642 lines. The private methods shared no state and passed
  `cfg`, `parts` and `result` to each other, so each is the same code as a function.
- The docs that named `SwCheck.#baseModifiers` as the `modifiers` hook's first call site (the
  rules README, `engine.mjs`, `FEATURES.md`, `CLAUDE.md`) name `baseModifiers` in
  `dice/check/modifiers.mjs`.
- **Checked** with the die pinned (`CONFIG.Dice.randomUniform` held constant) so every roll is
  deterministic: before and after, `previewTotal` for every Constellation, Defense and
  Initiative on Hrolda; the rendered HTML of the check, Defense and Relevant Check dialogs; and
  the cards and flags of a check, a Defense roll, a check with typed modifiers against a
  Threshold, a resolved attack pairing with a Parry, a resolved Defense pairing with a Posture, a
  Quick Strike's denied critical, a reroll and the card it superseded, normalised and diffed,
  with the test messages deleted after each run. Plus `node --check`, the rules self-test and a
  clean load.

### Changed: the character model's passes, one module each

The tenth recommendation asked for `module/data/item.mjs` split by type (done above as the
second) and `module/data/actor.mjs` split into character-specific and shared calculations. The
shared layer already existed (`SwActorData`, 208 lines); the character's derived data did not.

- **`module/data/character/`** (new) holds `SwCharacterData`'s derived-data passes as exported
  functions over the model, one module each and in the order the pipeline runs them:
  `constellations.mjs` (134 lines), `attributes.mjs` (36), `armor.mjs` (73), `defenses.mjs` (163,
  the Defenses and the stance), `wind.mjs` (38), `vigor.mjs` (34), `offense.mjs` (133: Familiarity,
  Melee and Ranged, weapon dice, Initiative, reach, the attack modifiers, movement, the Reactions),
  and `shared.mjs` for the first Arms Wound's penalty and the Evade availability, which the
  adversary's model uses too. Each module opens with what it reads and what it writes, so the
  implicit contract between passes is written down; `SwCharacterData#prepareDerivedData` is the
  one place the order lives, and the class keeps its schema, `prepareBaseData` and its public
  methods (`armorOnZone`, `strikeAttributeFor`, `proficiency`). `actor.mjs` is 833 lines from
  1,384. Every handbook sync since 0.6.0 landed in one or two of these passes (Vigor and Load
  Strain in v4.11, Wind in v4.12 and v4.13, Counter at Expert, the rules index), which is the
  case for the split: the next one lands in a file named for the rule.
- The passes were private methods sharing no private state, so each is the same code with `data`
  for `this`; nothing was reordered and no value changed. The docs that named
  `SwCharacterData.#prepareDefenses` as the `modifiers` hook's second call site (the rules README,
  `engine.mjs`, `check.mjs`, `FEATURES.md`, `CLAUDE.md`) name `prepareDefenses` in
  `data/character/defenses.mjs`.
- **Checked** by recording, in the running world before and after, the full derived data of every
  Actor and of the scene's synthetic token actor, the getters, and the answers of the public
  methods (`zoneProtection`, `armorOnZone`, `woundCapacity`, `proficiency`, `strikeAttributeFor`,
  the resistances) for every Actor, then diffing; a write and its re-prepare run clean; the rules
  self-test and the style check pass.

### Changed: a Maneuver the system implements is an Action first

The eighth recommendation (Mike, 2026-11-04): "Actions like Recenter should be an Action first,
and a Macro second." Recenter's behaviour, `SwActor#recenter`, was reachable from the Overview's
button, the adversary sheet's, a chat card's and the compendium Macro, while the Recenter Maneuver
Item, the face a player will meet on the Maneuvers tab once its row is enabled, posted its card
and did nothing. Raise a Shield had the same shape: the shield's own `raise()`, and a Maneuver
Item that only talked.

- **`module/documents/maneuvers.mjs`** (new) is the table of Maneuvers the system implements,
  keyed by the slug of the plain name as the `bonus` kind matches a Maneuver ("to Aid"):
  `recenter` runs the actor's method; `raise-a-shield` raises the shield in hand through the
  shield's method, the first of two if two are held, and warns when none is
  (`STARWROUGHT.Actions.noShieldHeld`, new). `SwItem#use` asks the table first for an action
  Item and hands over the actor, the Item and the options; the behaviour pays its own action and
  posts its own card, as it always did. A row renamed in the workbook stops matching and falls
  back to the card, visibly, rather than running the wrong thing. The module imports nothing of
  the system's, so it closes no circle with `documents/item.mjs`.
- **The Recenter Macro is a wrapper.** It finds the Recenter Item in the Actions pack and uses it
  for each selected token's actor; while the row is not enabled in `data/maneuvers.xlsx` (it is
  not, today) the actor's method runs directly, the same behaviour. `assets/build_foundry.mjs`
  carries the new command and the macros pack source changed with it.
- The sheet buttons and the card button stay: they are other doors to the same method. Nothing
  else learned what Recenter is. Enabling the Recenter and Raise a Shield rows is Mike's, as every
  `Enabled?` cell is; the dispatch is what makes enabling them safe.
- **Checked live** with temporary world Items named as the rows are: Recenter used from the Item
  on Hrolda with two Zones Exposed and a Bind formed closed both Zones, ended the Bind on both
  sides and posted one card; Raise a Shield used from the Item raised her held shield, used again
  lowered it, and with the shield stowed warned and did nothing; a near-miss name ("Recentre")
  posted its card as before; the Macro's rebuilt command, run on her token with the row absent
  from the pack, took the fallback and recentered her. The test Items were deleted and her shield
  and actions restored.

### Changed: the automation framework, four fixes from its review

The seventh recommendation was an outside review of the framework. It was written against 0.9.0,
so its largest finding, an unspecified hook contract, had closed in 0.10.0 (`modifiers`, ruling
124), and most of the rest are design notes for the first state-changing kind, which ruling 119
defers to that kind. Four findings were confirmed and cheap, and they land here.

- **The self-test's unknown-kind word is reserved.** `assets/test_rules.mjs` used `aura` as its
  example of a word no kind answers to, in a dozen checks, and the aura is the next kind to ship:
  registering it would have failed every one of them for nothing. The checks use
  `not-a-real-kind` now, a constant with a check of its own that no kind ever registers it, and
  the README's recipe says so.
- **The import circle is gone, not managed.** 0.10.0 moved `RuleSyntaxError` out of the grammar
  so the `bonus` kind would not import it, but `splitArgs` and `keyValues` stayed behind and the
  README's contract still imported all three from the grammar, so the next kind to use a helper
  would have closed the circle again. The three are `module/rules/syntax.mjs` now (`errors.mjs`
  renamed and grown), which imports nothing; the grammar re-exports them, so `test_rules.mjs`
  and any other reader keep their import; the rule for a kind file is one line, import from
  `syntax.mjs` and the config, never the grammar or the registry; and the self-test proves it by
  importing the `bonus` file first and the grammar after.
- **A rule is checked as plain data before it is stored.** The grammar accepted any object from a
  kind's `parse`, so NaN, a function, a Date or a cycle would have gone onto the Item and failed
  later in a write, a hash or a Sync. `plainData` in `grammar.mjs` walks the result: null,
  booleans, finite numbers, strings, arrays and plain objects pass; anything else is the kind's
  bug, reported on the line with the path (`the "aura" kind returned data that cannot be stored
  (range is NaN)`); an undefined property is left out as JSON leaves it, so a stored rule always
  equals its own JSON image. Seven shapes are refused and the undefined idiom accepted in the
  self-test, and the `bonus` kind's data is checked to round-trip.
- **Two policies written into `module/rules/README.md`.** "Calculated and triggered": the two
  categories of hook point, calculated ones answering with data on any client with failures
  isolated to the kind, triggered ones defined, when the first comes, with the one executing
  client, the event's identity for deduplication and what a failure does to the operation,
  on the pattern the attack coordinator and the loot relay already use. And "When a kind changes
  what it stores": no version number on a rule, the text is the version, the build, the copies
  refresh and the next edit re-derive a stale parse, and a kind that changes its shape either
  reads both shapes for a release or re-parses in the world migration.
- Not done, by the same review's own ordering and ruling 119: the triggered contract itself,
  multiplayer deduplication, a general applicability context and ordering between operations
  other than modifiers all wait for the first kind that needs them. The "overlapping lists of
  Item types" point stands as a convention (a schema cannot be composed from a list) until a
  fourth type carries rules.

### Changed: the Bind's pair-keeper

The sixth recommendation read `canvas/bind.mjs`, which drew the chains and kept the two-sided
record whole, and suggested the second half might belong under `documents/` if it grew. It
belonged there already: it was the one module under `canvas/` that writes documents, and two of
its pieces existed twice.

- **`module/documents/bind.mjs`** (new) is the protocol: the mirror table (`MIRROR`), the uuid
  resolver (`resolveActor`), the pickup that writes or clears the partner's side when the writer
  could not (`pickUpMirror`), the elected-writer rule (the active GM, else the connected owner
  with the lowest id), the sweep at ready and at each canvas (`keepPaired`), and
  `registerBindSync`, called from `starwrought.mjs` beside `registerBind`. The code is the
  0.5.1 code, moved whole; the header explains the `swBind` option and the id tombstone where the
  writer and the reader of them now sit together.
- **`canvas/bind.mjs`** draws and nothing else (298 lines from 393): its `updateActor` hook
  redraws, and it imports the mirror table and the resolver from the protocol.
- **Two duplications gone.** `SwActor#formBind` carried its own copy of the mirror table and
  `SwActor.resolveActor` its own copy of the resolver (without the `try` the canvas copy had);
  both now come from `documents/bind.mjs`, the static resolver delegating so its 48 callers are
  unchanged. No import cycle: `documents/bind.mjs` imports nothing of the system's.
- **Checked live** with Hrolda and the adversary on the GM's client, where the pickup never fires
  on its own because the GM owns both sides, so the writes a player's client would make were
  made by hand: Hrolda's side written and stamped unpaired (`swBind.paired` false) was mirrored
  onto the adversary by the hook with the same id, the states crossed (controlling to controlled)
  and the Controlled status set; her side emptied and stamped unpaired with the partner named
  cleared the adversary's side and status; a side written while nobody could mirror it (stamped
  paired, so the hook stayed quiet) was mirrored by the sweep; a partner's side emptied behind
  the sweep's back made the other half a tombstone the sweep cleared; the ordinary two-sided
  form and end left nothing behind; the chain on the map was counted at each step; the resolver
  answers the same by either name. (A first attempt used `pair: false`, which marks a write as
  already paired by design and so proves nothing about the pickup; the changelog says so in case
  someone tries the same.)

### Changed: three of the apps

The fifth recommendation reviewed six app modules. Three are split here; `chargen.mjs` is not (its
step logic is already small named methods and the complexity is the point-slot engine, bound to
the wizard's state, which is a redesign and not a split); `combat-prompt.mjs` and `item-sheet.mjs`
are left, as the review said. Each move is verbatim code with its imports repointed.

- **The actor sheets' shared context is `module/helpers/actor-context.mjs`.** The seven builders
  for the header's live state and the tooltips (`actionsContext`, `bindContext`, `rulesPageOf`,
  `vigorContext`, `zoneWounds`, `lockedTips`, `windTip`; 260 lines) were exports of
  `apps/actor-sheet.mjs`, and the adversary sheet and the party sheet imported the character
  sheet's module to render. They sit beside `helpers/stance.mjs` now, which already plays that
  role for the stance chips; the three sheets import them from there, and `actor-sheet.mjs` is
  1,061 lines of the character sheet alone. The 45 action handlers stay: each is a few lines
  delegating to an actor method.
- **The synchronisation is `module/helpers/content-sync.mjs`; the window stays
  `apps/content-sync.mjs`.** Fetching the index, planning the diff, applying it, refreshing the
  copies and posting the card (`fetchContentIndex`, `planContentSync`, `applyContentSync` and
  their helpers; 650 lines) move whole; the window (338 lines) imports what it calls, `shortHash`
  and the two setting keys exported for it, and re-exports the three entry points and
  `formatWhen`, so a macro's 0.8.0 import path still works. `starwrought.mjs` imports the window
  from the app and the plan functions from the helper.
- **The party sheet's per-tab context is `module/apps/party/`.** The five private methods that
  built each tab's context (the roster row, the Skills grid, the road with Downtime and the
  Investigate options, the loot; 540 lines) are plain exported functions over the party and its
  members, one module per tab (`roster.mjs`, `skills.mjs`, `road.mjs`, `loot.mjs`), with no
  `this`: `prepareRoad`, `prepareDowntime` and `prepareLoot` take the party, the rest took what
  they take. `_prepareContext` calls them, the pick-activity handler imports
  `constellationOptions` from `road.mjs`, and the 27 handlers stay with the sheet, which is 1,251
  lines. Each module imports only what its code uses (`signed` went with the grid; eleven
  `helpers/party.mjs` names left the sheet's import with the context). The feature behaviour was
  never here: it is `helpers/party.mjs`, as 0.7.0 built it.
- **Checked** by rendering the character, the adversary and a party sheet with loot, and the Sync
  content window, before and after, capturing every tab's HTML with whitespace collapsed, and
  diffing: identical. The world loads with no error; the three sync entry points are the same
  functions by either import path.

### Changed: the Item sheet's details tab

- **`templates/item/details.hbs` is a dispatcher** (7 lines): the tab's section, and one include
  of the partial named for the Item's type, `templates/item/details/<type>.hbs`, through Foundry's
  `concat` helper. The eight type partials hold what the eight `{{#if isType}}` branches held, in
  the same order (`constellation` 27 lines, `talent` 92, `chassis` 29, `weapon` 32, `armor` 20,
  `shield` 17, `gear` 3, `action` 80), each opening with a comment naming the shared panels it
  includes. The three shared panels are partials of their own: `details/aura.hbs` (the Talent's
  and the action's, which were two verbatim copies of twenty lines through 0.10.0),
  `details/automation.hbs` (the three types whose models carry rules; the include sites are the
  list now, so `SwItemSheet.RULE_TYPES` and the `hasRulesPanel` flag are gone and the partial's
  comment says where it may be included) and `details/physical.hbs` (the four types you can
  carry; its `isPhysical` guard is gone for the same reason). All twelve are registered in
  `preloadTemplates`, which the dispatcher's comment says a new type must be added to. The
  `isType` flags stay in the context for the two places that still read them (the physical
  panel's Load field; `module/apps/item-sheet.mjs` elsewhere).
- **The carry state is a select.** The physical panel had a checkbox "Worn or wielded" bound to
  `system.equipped`, which is not a schema field but a value `prepareCarry` derives from `state`.
  It was not inert, as the review of it guessed: writing `equipped` tripped the 0.4-era
  `migrateCarryState` on every update, which read the old boolean and wrote `state` from it, so
  the box worked by accident, through a migration, and could only say held-or-not. The control is
  now a select on `system.state` itself (In hand, Worn, Packed; `choices.states` from
  `SW.CARRY_STATES`, label `STARWROUGHT.Field.carryState`, "Where it is"; `Field.equipped` is
  gone from `lang/en.json`), the same three states the character sheet's draw, stow, wear and
  take-off links write. Exercised live: the select changes the Item's state through the form and
  the sheet's derived `equipped` follows.
- **Checked** by rendering one Item of each of the eight types before and after and diffing the
  details tab's HTML with whitespace collapsed: identical for the four types without the physical
  panel, and for the four with it the one difference is the select in place of the checkbox. The
  world loads with no error and `check_style` passes.

### Changed: the rules constants

- **`module/config.mjs` is a barrel** (83 lines) over `module/config/`, twenty files, one concept
  each: `system` (the id, the version stamp, the content paths), `attributes`, `proficiency`,
  `constellations` (the categories, the Defenses, the parent slugs, the moved Talents, and the
  runtime registry with `getConstellation`, `slugify`'s companion `isLoreSlug` among them),
  `exchange` (Threats, Strikes, Reactions, root Postures, and the flat attack and Bind numbers,
  Off-Guard and Unwieldy included), `degrees`, `zones` (Zones, Wounds, damage types, materials),
  `sizes` (sizes, cover, detection), `weapons`, `load` (Load Strain relief, the Endure Vigor
  bonus, where Strain lands, the Wind round, the Fatigued cap, the helm penalties), `recovery`,
  `advancement`, `party` (the party type, the road, the travel figures), `actions` (six a round,
  the glyphs, the costs, the cost parser and renderer), `movement`, `auras`, `items` (type icons,
  feature and physical types, carry states), `conditions`, `modifiers` and `names` (`slugify`,
  `plainName`). Every file opens with a header that says what it holds, that it is pure at module
  scope and why, and which Foundry prototype extension its functions use inside a body
  (`Math.clamp`, `String#titleCase`, `Number.isNumeric`). The barrel re-exports all 108 names
  explicitly, grouped by file, so it reads as the index of where each constant lives and
  `import * as SW from "./config.mjs"` names the whole vocabulary as before: the 38 namespace
  importers, the party model, the build and the self-test are untouched.
- **The refiling.** The split followed concepts, not the old banners, because the banners had
  drifted: the Exchange vocabulary and the version stamp sat under "Constellations", Load Strain
  relief and the Endure Vigor bonus under "Weapons", the Wind round, the Fatigued cap and the helm
  penalties under "Movement", the Item type icons and carry states under "Auras", the Off-Guard
  and Unwieldy penalties under "Conditions", and the travel figures under "Movement". Each now
  sits in the file a reader of the rule would open. Nothing was renamed and no value changed.
- **No import cycle.** Two concept files import another concept file (`exchange` reads
  `MELEE_SLUG` from `constellations`; `conditions` reads `SYSTEM_ID` from `system`); none imports
  the barrel, and the barrel imports nothing but them.
- **The version stamp is in `module/config/system.mjs`**, and the stamp check in `build_all.mjs`
  and `package_system.mjs`, the message that names it, `CLAUDE.md` and `styles/README.md` say so.
- **`build_all.mjs` holds the barrel exact**, in every mode: it imports the barrel and every file
  under `module/config/` in plain Node (which also proves each stays pure) and fails on a name a
  file exports that the barrel does not re-export, a name the barrel re-exports that no file
  provides, a name two files export, or a file that will not import. Tested negative by hand.
- **Four rules constants nothing reads yet** stay where the rule puts them, with a note: `COVER`
  and `DETECTION` in `sizes`, `PHYSICAL_DAMAGE` in `zones`, `CATEGORY_ALIASES` in
  `constellations`. They are the book's tables awaiting a feature, not dead code.
- **Checked** in plain Node by dumping every export of the old module and of the new barrel (the
  108 names, 89 constants as JSON, 19 functions as source, and a table of calls on the pure
  functions with Foundry's three prototype extensions shimmed) and diffing: the names and the
  constants are identical, the calls are identical, and the function sources differ only in the
  line endings the old file carried. Then in the running world: every Item type's schema, the
  derived data of 38 sample Items and of the four Actors, and the registered status effects,
  recorded before and after and diffed; the world loads with no error.

### Changed: the Item data models

- **`module/data/item.mjs` is a barrel** (27 lines): it re-exports the eight models, the two
  Trait functions and the helm penalty from `module/data/items/`, so `starwrought.mjs`'s
  registration import names the same things from the same path. The models are one file per type,
  `constellation.mjs`, `talent.mjs`, `chassis.mjs`, `weapon.mjs`, `armor.mjs`, `shield.mjs`,
  `gear.mjs` and `action.mjs` (31 to 114 lines each), every one opening with a header that names
  the shared pieces it uses; no type file imports another. The shared pieces are one concern per
  file rather than the review's one `shared-fields.mjs`, since each comes as a trio of fields,
  migration and prepare that belongs together and apart from the others, in the idiom of the rule
  kinds: `base.mjs` (`SwItemData` and `describedFields`), `cost.mjs` (`costFields`, `migrateCost`,
  `prepareCost`), `aura.mjs`, `rules.mjs` (the automation framework's two fields and the sheet's
  "As read" view, with the grammar imports), `physical.mjs` (quantity, price, load and the carry
  state) and `weapon-traits.mjs`. The helper functions are exported now, since other files import
  them; nothing else in them changed.
- **`weapon-traits.mjs` is pure**, no Foundry global at module scope or inside, only `config.mjs`,
  so the build imports it as it imports the automation grammar: `assets/build_foundry.mjs` now
  takes `splitTraits` from the system and drops the copy of it that it carried through 0.10.0
  (the same function, so the pack sources are byte-identical). The client never called
  `splitTraits`; it exists for the build, and the file's header says to keep it pure so a
  build-time check of the Traits column, the Aura column's equivalent, can use `parseWeaponTraits`
  without a second parser.
- **The Speed migration moved out of the Item models.** `migrateSpeed` and `LEGACY_SPEED_FLOOR`
  are the one-time world migration's conversions, called from the migration block in
  `starwrought.mjs` alone and nothing an Item reads; they are `module/data/legacy.mjs` now, and
  `starwrought.mjs` imports them from there.
- **`helmPenaltyFor` lives with armor** (`items/armor.mjs`), which derives a Head piece's penalty
  from it; `module/data/actor.mjs` imports it from there instead of from the barrel.
- The comments in `module/apps/item-sheet.mjs` and the paragraph in `CLAUDE.md` that named
  `module/data/item.mjs` for `rulesFields`, `prepareRules` and `attackAttribute` name the new
  files. The sync reports and older changelog entries keep the old path, as records of their time.
- **Checked** by recording, in the running world before and after, every Item type's schema (field
  classes and options, nested) and the full derived data of 38 sample Items across the world and
  the five Item packs (the source, every prepared value, `chatDescription`, and three
  `damageFormula` calls per weapon), then diffing: identical. `node --check` on every module,
  `test_rules` (56 checks), `build_foundry --no-compile` rebuilding the pack sources without a
  byte's difference, and the world loaded with no error.

### Changed: the stylesheet

- **One stylesheet is eleven** (`foundry/starwrought/styles/`, the map in `styles/README.md`),
  loaded in the order `system.json` lists them: `starwrought.css` (the foundation: the stamp, the
  scrollbars, the `--sw-*` tokens, form controls, the two generic buttons, the rules-link idiom,
  `sw-hidden`), `sheet.css` (the chrome every Actor and Item sheet shares), `item.css` (the Item
  sheet's own pieces and the Automation panel), `character.css` (the character and adversary
  sheets), `chargen.css` (the wizard), `hud.css` (the combat tracker, targeting marks and the
  token HUD's stance button, core's elements), `auras.css` (the ring button, the palette, the ring
  toggles, the Ranges line), `chat.css` (the cards and the roll dialogs), `attack.css` (the Combat
  Prompt and the attack card), `party.css` (the party sheet, its dialogs and cards) and
  `content-sync.css` (the Sync content window and its card). Each file opens with a header that
  says what it owns, which templates it serves, which files it builds on and the rules of the
  road, so a reader who opens one cold has them. The rules: a file may rely on the files listed
  before it and never on one after; no selector list is declared twice anywhere in `styles/`
  (`:root` excepted, where the stamps live), so the order never decides; every `.css` in the
  folder is listed in `system.json`. The cross-cutting 0.5.1 block (the player-facing sheet, T1
  to T16) is distributed to its owners with a note on each piece. Foundry's manifest `styles`
  array takes any number of files, loaded as separate links in order; no bundling, no cascade
  layer (the scrollbars' unlayered `*` rule depends on staying unlayered).
- **The stale-copy stamp is per file.** Each stylesheet sets `--sw-css-version-<file name>` on
  `:root` (`--sw-css-version-chat`, and so on; `--sw-css-version-starwrought` where
  `--sw-css-version` was), and `checkForStaleAssets` (`starwrought.mjs`) reads the list off
  `game.system.styles` and compares every stamp with the server's version, so a proxy holding one
  old file among eleven fresh ones is caught and the warning names the file
  (`styles/chat.css 0.10.0`). One stamp in one file would have certified that file alone.
  `STARWROUGHT.Notify.staleStyles` is gone from `lang/en.json`; the path says it.
- **`assets/build_all.mjs` holds the split together.** Its stamp check reads the stylesheet list
  from `system.json` rather than naming one file, and does two more things in every mode,
  `--check` included: it fails on a `.css` in `styles/` that `system.json` does not list (such a
  file loads nowhere and its rules silently never apply), and on a selector list declared twice,
  in one file or across two, naming both (`".starwrought .sw-panel" is declared in both
  styles/sheet.css and styles/content-sync.css; merge them, or make the later one more specific,
  so the load order never decides`). `assets/package_system.mjs` reads the same list for its
  stamp check. Both checks were tested negative by hand in this build.
- **The defects the split exposed, fixed.** Through 0.10.0 six selector lists were declared twice
  in the one file, and in four of them the later declaration silently won:
  - **The Strike pills.** 0.5.1's padding and gap for the pill (T1, sized to the enlarged glyph)
    were in a rule declared before the pill's base rule, which overrode both; the glyph sizing,
    more specific, survived. One rule now (`character.css`), with 0.5.1's values: a pill is a hair
    wider and flatter than it rendered through 0.10.0 (padding 0 0.5rem 0 0.3rem for 0.05rem
    0.4rem, gap 0.25rem for 0.2rem).
  - **`sw-choice` named two components.** The check dialog's options (the three Strikes, the
    Reactions, an offered modifier) and the wizard's choice cards shared the class, so the
    wizard's later rule dressed the dialog's options (edge border, 0.5rem padding, gradient) and
    the dialog's earlier rule sized the wizard's cards (0.78rem, line height 1.3). The options are
    `sw-dialog-option` now (`templates/dice/check-dialog.hbs`, `chat.css`) and wear the look their
    rule always said, the one the Combat Prompt's options copied in 0.5.0: a thin white border, a
    flat background, 0.35rem by 0.5rem padding. The wizard's cards keep the 0.78rem size they have
    shown since 0.4.0, now written in `chargen.css` on purpose with a note saying so; drop two
    lines and the card's name reads at the sheet's 14px.
  - **`.sw-defense` twice**: the base, and `position: relative` for the stance tag, declared with
    the stance; one rule.
  - **Three card accents were dead.** The stance card's gold left border, the wound card's blood
    one and the bind card's dim gold were declared before the base card rule, whose `border`
    shorthand overrode them; the cards rendered with a plain edge border. In `chat.css` the
    accents follow the base and show, as the Exposed, hero, audit and party cards' always did (one
    class more specific, or declared after). The stance card keeps its italic.
  - **`.sw-free-mark`**, used by no template or module, dropped.
- **`FEATURES.md`** section 6's stale-copy paragraph names the eleven files and the per-file
  warning; **`CLAUDE.md`**'s pipeline paragraph names the stamps, the two new checks and the
  README; `module/config.mjs`'s comment on `SYSTEM_VERSION` names the stamps.
- The version stamps read 0.10.1 in `system.json`, `SYSTEM_VERSION` in `config.mjs` and every
  stylesheet. No migration step: nothing stored changes.

### Notes

- **How it was checked.** The split is a script's work: every original line placed by range,
  with an assertion that each non-blank line landed once or was named as replaced or dropped. The
  rule sets of the old file and the eleven new ones were compared (928 rules against 935; the
  only differences are the eleven stamp blocks and the edits above). Then the live test: nine
  windows open on the old file (the character, the adversary, a party, two Items, the wizard, the
  check dialog, the aura palette, Sync content), the computed style of 2,313 elements recorded,
  the system reloaded on the eleven files with the same windows reopened, and the two recordings
  diffed. Nothing was added or lost; the differences were the Strike pills and the table cells
  around them, and the wizard's card size, which is why that size is now written down. The card
  accents were probed directly (`.sw-stance-card` reads a 3px gold left border, `.sw-wound-card`
  blood, `.sw-bind-card` dim gold). No stale-copy warning on load; eleven stylesheets served.
- **Still Mike's.** Whether the wizard's card name should return to the inherited 14px (the size
  it had before 0.4.0's shared rule shrank it), two lines in `chargen.css`. Whether the system
  should put its styles in a Foundry cascade layer (v13 allows it per file); not done, and the
  scrollbar block says why it would have to be partial.
- No ruling: nothing here touches a rule of the game. The count stands at 124.

---

## 0.10.0 (2026-10-03): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.9.0 left them. The release is **the first rule kind**, and
with it the first thing the automation framework does in play (Mike, 2026-10-03: "okay, first
automation kind we will create is the Human Ancestry one. The Effect is: 'You gain a +1 Condition
bonus on checks to Aid. If you are Expert in Human, this becomes a +2 Condition bonus. If you are
Master, +3. If you are Legendary, +4.' So we need Automation for something like ... IF
(Constellation Proficiency = VALUE) where VALUE = Untrained, Trained, Expert, Master, Legendary,
Grant [X Value (+1, +2, -1, -2, etc.)]; [Y type (Condition, Situation, Gear, etc.)]; [Z Check
(Constellation or Maneuver Roll)]. In this case, it would use a Maneuver called Aid."). The kind is
`bonus`, Mike's sketch made concrete as one line, `bonus: <value> <Type> to <Target> [if
<Constellation> is <Rank>]`, and Humanity's Effect is four of them, one per sentence. With it comes
the one engine seam a bonus needs, the `modifiers` hook point: the check engine and the Defense
pass each ask every registered kind once for the modifiers its rules put on this roll, so a
Constellation-targeted bonus lands on the roll, the roll dialog's list, the card, the sheet's
Defense Threshold and the Skills grid alike, and a Maneuver-targeted bonus lands on the Maneuver's
own roll and is offered unticked on any other check. Still the standing rule (ruling 119): one kind
in this release, one hook point, no survey of the other Talents, and the aura for Torchbearer is
still the next kind. A minor bump, because a rule now changes a number in play. The decisions are
rulings 121 to 124, continuing the 0.9.0 entry's 120 (see Notes). Humanity's own cell was not
written in this release (Excel held `data/ancestries.xlsx` open; the four lines are in Notes for
Mike to paste), so no cell in the book uses the kind yet. `Starwrought_Players_Handbook_v4.16.docx`
is still on the shelf, untracked and unsynced, as 0.9.0 said; `build_all.mjs` reports the drift
until that sync, which is a later release's, and in content mode goes on (ruling 115).

### Added

- **The `bonus` kind** (`module/rules/kinds/bonus.mjs`, new; ruling 121). The word `bonus`, no
  aliases. One rule: `bonus: <value> <Type> to <Target> [if <Constellation> is <Rank>]`. The value
  is a signed integer (`+1`, `-2`; a bare `1` reads as `+1`; `0` is refused, "a bonus of 0 does
  nothing"). The Type is `Situation`, `Condition` or `Gear`, case blind, the book's three since
  v3.3; the retired words `circumstance`, `status` and `item` are refused by name ("write
  Condition, not status: the book renamed the types in v3.3"), and `untyped` is refused too ("no
  Talent bonus is untyped; name Situation, Condition or Gear"). `to` is required and names the
  Constellation or the Maneuver the bonus applies to, as the trees and the action sheets print it,
  case blind; the slug form (`armored-fighting`) also reads, and the glyphs in a Maneuver's name
  are ignored. `if <Constellation> is <Rank>` is optional: the five rank words (`Untrained`,
  `Trained`, `Expert`, `Master`, `Legendary`, case blind), a bad one refused with the list, `=` in
  place of `is` refused with the shape ("write `if Human is Expert`"), and the test is equality,
  as Mike wrote it. Anything else prints the shape: `bonus: +1 Condition to Aid if Human is
  Expert`. The stored rule is `{ kind: "bonus", line, text, value, type, to: { name, slug, type },
  when: { constellation, name, rank } | null }`, with `to.type` "constellation" or "action" when
  the caller gave the grammar a resolver and `null` when none did (the self-test; the hook then
  matches on slug alone). With a resolver a target that names nothing is refused (`"Aidd" names no
  Constellation or Maneuver`), an `if` Constellation that is a Maneuver or nothing is refused
  (`"Aid" is not a Constellation`), and the Lore template is refused as a target ("a Lore is the
  character's own; a bonus cannot name it"). The summary line reads `+1 Condition bonus to Aid
  while Human is Expert`, `penalty` for a negative value, no `while` without an `if`.
- **The `modifiers` hook point** (`module/rules/engine.mjs`, `ruleModifiers(actor, context)`;
  ruling 124). A kind that affects a roll declares `hooks.modifiers(entries, context, actor)`,
  where `entries` are its own rules on this actor from the index (`rulesOfKind`), `context` is
  `{ kind: "check" | "attack" | "defense" | "initiative", slug, item }` (the roll's kind, the
  Constellation supplying the Proficiency Bonus, and the Maneuver, weapon or Talent behind the roll
  when there is one), and each answer is `{ label, value, type, offer?, key?, hint? }`. The
  dispatcher walks the registry, skips a kind without the hook or with no rules on this actor,
  calls the hook inside a try/catch (a kind's throw is logged as that kind's failure and
  contributes nothing; a roll never dies over a rule), drops a modifier whose value is not a
  non-zero number, and returns `{ applied, offered }`: a modifier without `offer` is applied to
  the roll, one with `offer: true` is offered unticked in the roll dialog, its `key` defaulted to
  `<kind>-<n>` (counting that kind's offers on the roll) when the kind gave none, and a key two
  offers share suffixed so the dialog's checkboxes never collide. That is the whole of what the engine
  knows: a second kind that wants the same moment names `modifiers` in its `hooks` and adds no
  engine code. Pure over the documents, so the self-test drives it from Node with a fake actor.
- **The `bonus` kind's hook.** For each of its rules on the actor: a rule with an `if` clause
  reads `actor.system.proficiency(<constellation>).rank` and fires only when it equals the rank
  named (an adversary has no `proficiency`, so a conditioned rule never fires for one). A
  Constellation target applies when the roll's slug is the target's. A Maneuver target applies
  when the roll's Item is an action of that name (glyphs ignored); when it is not and the roll is a
  check, it is offered instead, with the key `bonus-<item id>-<line>` and the hint "<Talent>: this
  bonus applies to checks to <Target>. Tick it if this roll is one." (ruling 122); it is never
  offered on an attack, a Defense or an Initiative. An applied modifier is labelled with the
  Talent's plain name, so the card's line reads "Humanity +1"; an offered one reads "<Talent>:
  <Target>". Typed stacking is the engine's: two Humanity lines never both fire (one rank at a
  time), and overlapping lines of one type give the highest, by the book's rule.
- **The check engine asks** (`module/dice/check.mjs`). `SwCheck.#baseModifiers`, in its
  non-Defense branch, ends by calling `ruleModifiers` with the roll's kind, slug and Item, pushes
  the applied modifiers onto the base terms and keeps the offered ones on the config; `#prompt`
  lists each offer under the Load Strain offer as an unticked checkbox with its hint, and a ticked
  offer joins the roll through the same loop that carries the Climb-or-Swim toggle, so
  `result.extras` records it and a kept road roll re-counts it (0.7.3). An Initiative rolled with a
  Constellation comes through the same branch, so a Constellation-targeted bonus reaches an Avoid
  Notice Initiative as every modifier of the Constellation's check does (ruling 111). The Defense
  branch is untouched, because the Defense pass (next) has already folded the rules into the
  Defense's own modifiers; a Defense roll, an Initiative rolled with Awareness and a Defense rolled
  as a check all carry a bonus once and never twice. Adversaries still roll flat: the npc early
  return stands, and the rules do not reach them in 0.10.0.
- **The Defense pass asks** (`module/data/actor.mjs`, `SwCharacterData.#prepareDefenses`). Inside
  the per-Defense loop, before `SW.resolveModifiers`, the applied modifiers of
  `ruleModifiers(actor, { kind: "defense", slug })` join the Defense's list. The rule index and the
  Constellation ranks are both final by then, so `bonus: +1 Gear to Guard if Human is Expert` moves
  the Guard Threshold on the sheet, the Guard roll and the Skills grid cell alike, as Frightened
  does. Offers are ignored here; a Threshold is not a dialog.
- **A Relevant Check Maneuver** (`module/documents/item.mjs`, `SwItem#use`; ruling 123). A
  Maneuver whose check is enabled with no Constellation named is a Relevant Check: `use()` opens
  the Relevant Check picker through `actor.rollRelevantCheck` with the Maneuver as the roll's
  `item`, the Maneuver's plain name as the label and its glyph and category as the subtitle, so
  Aid's roll is Aid's and a `bonus ... to Aid` is applied to it rather than offered. A Maneuver
  with a named check (Search's Awareness) already passed itself to `SwCheck.roll` and is matched as
  it stands. `SwActor#rollRelevantCheck` lets a caller's `label` stand (`module/documents/actor.mjs`).
  The build (`assets/build_foundry.mjs`) sets `check: { enabled: true, constellation: "", defense:
  "" }` on a sheet action whose Effect says "relevant check" (case blind) and names no check; Aid's
  row reads Yes since Mike moved it into `data/maneuvers.xlsx` during this build (see Changed), so
  `packs/_source/actions/aid_30d830c3ca03647e.json` ships with it set, the first Maneuver document
  to ship. The Item sheet's "Rolls a check" panel gains a note (`templates/item/details.hbs`;
  `STARWROUGHT.Hint.relevantCheck`): "With no Constellation chosen, the check is a Relevant Check:
  the roller picks the Constellation and says why." No new schema field.
- **The resolvers.** The grammar's parse context now carries an optional `resolve(name)`, which
  the kind uses to settle a target's kind and spelling; the grammar itself is unchanged, since it
  passes the caller's context through to `parse`. The build (`assets/build_foundry.mjs`) builds one
  resolver before the trees loop and hands it to both `automationOf` calls: every Constellation in
  `trees.json` by name or slug, case blind, then every sheet action and every roster `actions` row,
  enabled or not (a disabled action still resolves: the cell is right, the row is simply off; Aid
  was one until Mike enabled it during this build), by plain name; a Constellation wins over an
  action of the same name (none today). The client
  (`module/helpers/content.mjs`, `resolveRuleTarget(name)`, new) answers the same question for
  `SwItem._preUpdate` when a GM edits a world Item's textarea: `SW.constellations` first, then the
  Actions pack's index, then world Items of type action; synchronous, and null while `game` is
  not ready.
- **The self-test's "The bonus kind" section** (`assets/test_rules.mjs`; `SHIPPED_KINDS` is
  `["bonus"]`). Every accepted form (signed and bare values, each type word in mixed case, with
  and without `if`, a slug target, a glyphed Maneuver name), every refusal with its message (0, the
  retired type words, `untyped`, a missing `to`, a bad rank, `=` for `is`, a target the resolver
  does not know, an `if` Constellation that is a Maneuver, a Lore target), the stored shape with
  and without a resolver, the summaries, and `ruleModifiers` over a fake actor: a Constellation
  target applied on its slug and absent on another, the rank gate (the Trained line at Trained, the
  Expert line at Expert, neither at Untrained), a Maneuver target applied when the roll's Item is
  that action and offered with a stable key on a check without it, never offered on an attack, a
  Defense or an Initiative, a throwing hook contributing nothing and not throwing, and zero-value
  modifiers dropped. The two checks that assumed an empty registry now expect `known kinds: bonus`.

### Changed

- **Aid is authored in `data/maneuvers.xlsx` and enabled, and `data/actions.xlsx` is deleted**
  (Mike, 2026-10-03, during this build; data that moved with the release). Aid had been the one
  row of `actions.xlsx`, Mike's untracked working file, not enabled, so it shipped nowhere (ruling
  61) and a fresh clone kept it only through the converter's carry-over of the last
  `actions.json`. He moved it onto the "Watching, Deceiving & Helping" sheet (row 9) with
  `Enabled? = Yes` and deleted the old workbook. The converter reported the move ("'Aid' was
  actions.xlsx's and is now defined in maneuvers.xlsx, which wins"); `assets/actions.json` lists
  40 actions from one workbook, Aid the one enabled; and the build writes
  `packs/_source/actions/aid_30d830c3ca03647e.json`, so **Aid ships for the first time**, the
  roster's Aid row retired under the same document id as before, with `check: { enabled: true,
  constellation: "", defense: "" }` set from its Effect ("Attempt a Relevant Check"): using it
  opens the Relevant Check picker carrying the Maneuver and a `bonus ... to Aid` is applied to
  that roll. The Maneuvers tab's Basic panel carries Aid under Watching, Deceiving & Helping, its
  first row. Aid is not in the workbook's `_Tree Index`, so the converter types it from its Type
  cell with a warning, Mike's to tidy. The sheet's Aid is still the single action ❶ with a
  Relevant Check against Threshold 15, against the book's Prepare plus Reaction; the sheet wins
  (`CLAUDE.md`, Known outstanding work). The carry-over rule stays, with nothing to carry.
- **The registry registers one kind** (`module/rules/kinds/index.mjs`): the import and
  `registerKind(bonus)` at the foot, in place of the "None" block; the header comment says one
  kind ships and the aura for Torchbearer is still next, one at a time.
- **The engine's header** (`module/rules/engine.mjs`) no longer says nothing reads the index: the
  `modifiers` hook point reads it, called from the check engine and the Defense pass.
- **`STARWROUGHT.Rules.none`** reads "No rules." (`lang/en.json`); the "no rule kinds yet" clause
  was true for one release.
- **The build's summary line** (`assets/build_foundry.mjs`) counts its plurals (`1 rule on 1
  document (1 kind in use)`), and reads `automation: no rules (1 kind defined, none in use)` while
  no cell uses the kind, which is today.
- **`module/rules/README.md`** gains the `bonus` kind (syntax, stored shape, summary), a "Hook
  points" section with `modifiers` (when the engine calls it, from where, what it is handed, what
  it may return, applied against offered, the try/catch), the `resolve` context entry under what a
  kind may rely on, and step 5 of "Adding a rule kind" rewritten for generic dispatch: a kind names
  the hook point in its `hooks`; the engine's call sites exist once per hook point and a new kind
  adds none; a new hook point is still defined with the first kind that needs it.
- **`data/README.txt`** names the kind and its syntax under the Automation column's entry, in the
  Aura entry's voice, with Humanity as the example; the action sheets' note and the ADDING CONTENT
  note lose their "no rule kinds yet" clauses.
- **`FEATURES.md`** section 7 is "Automation: the framework and the `bonus` kind", with what the
  kind does on screen and the hook point; `CLAUDE.md`'s standing paragraph names the kind, the hook
  point and its two call sites; `automation-plan.md` gains a 0.10.0 section with decision 1
  resolved and the backlog moved on.
- The version stamps read 0.10.0 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: the stored rule shape
  is new data on a field that already existed, and a cell written before 0.10.0 holds no rule.

### Notes

- **The rulings, 121 to 124**, numbered on from the 0.9.0 entry's 120.
  - **121. The `bonus` kind's syntax.** Mike's sketch made concrete as `bonus: <value> <Type> to
    <Target> [if <Constellation> is <Rank>]`: the value signed, never 0; the three type words only,
    the retired words refused by name so a cell cannot quietly carry a v3.3 type; the target a
    Constellation or a Maneuver by the name the book prints; the rank condition equality, as he
    wrote it ("Constellation Proficiency = VALUE"), so a Talent that scales by rank writes one line
    per rank, and Humanity's Effect is four lines, one per sentence. Nothing in the syntax says
    "or higher"; a Talent that wants that form says so when it comes.
  - **122. A Maneuver roll is a roll made from the Maneuver's Item.** Where a check is made without
    one, a Maneuver-targeted bonus is offered unticked in the roll dialog and never applied unasked,
    so the judgement "is this roll an Aid?" sits with the player at the edge, as the Load Strain
    Climb-or-Swim toggle does (PHB v4.11, ruling R2); it is never offered on an attack, a Defense
    or an Initiative, which are not checks to anything.
  - **123. A Maneuver whose check is enabled with no Constellation named is a Relevant Check**, and
    opens the picker carrying the Maneuver, so Aid's roll is Aid's and its bonus is applied, not
    offered. The build sets it from an Effect that says "Relevant Check"; Aid, enabled by Mike
    during this build, ships with it set (verified live: the card reads "Aid", "Humanity +1
    condition").
  - **124. The hook point `modifiers` is generic.** The engine asks every registered kind at two
    moments (the check assembly, the Defense pass) and a kind answers for its own rules; a later
    kind that wants the same moment adds no engine code, and a new moment is still defined with the
    first kind that needs it (ruling 119 stands). Mike's question of the day, whether the
    automations are modular enough to tinker with one without touching the rest, is answered by
    construction: a kind is one file, and the dispatch knows no kind's name.
- **Humanity's cell was not written; the four lines are Mike's to paste.** Excel held
  `data/ancestries.xlsx` open, and the Human sheet has no Automation column yet. Add a column
  headed `Automation` (order free; the first word of the header wins) and paste into Humanity's
  cell, one line each:
  `bonus: +1 Condition to Aid if Human is Trained`,
  `bonus: +2 Condition to Aid if Human is Expert`,
  `bonus: +3 Condition to Aid if Human is Master`,
  `bonus: +4 Condition to Aid if Human is Legendary`.
  Then `sync_content.cmd` and Sync content in the open world. Until then no cell in the book uses
  the kind, every `system.rules` is still `[]`, and the build's summary says so (`automation: no
  rules (1 kind defined, none in use)`). "Expert in Human" is the Origin's rank: the three
  Ancestry Roots pool one rank, which `proficiency("human").rank` already returns.
- **What a cell may hold now.** Blank, `#` comments, and `bonus` lines. Any other kind word fails
  the build with `unknown rule kind "<word>" (known kinds: bonus)`, naming the Constellation, the
  Talent and the line, and the loop stops before the sources are written; a `bonus` line the kind
  refuses fails it with the kind's own message. The same lines typed into a world Item's textarea
  save, show their summary or their red row, and reach the actor's index on the next prepare.
- **Adversaries are untouched.** The npc branch of the check engine returns the GM's flat bonus
  as before, and `SwNpcData`'s Defenses are the Thresholds the GM typed, with no modifier pass to
  fold a rule into; a `bonus` rule on an adversary's action is indexed and read by nothing. The
  players own the dice in STARWROUGHT, and an adversary Threshold is the GM's to type.
- **Thresholds move with the Defense pass.** A bonus to a Defense is folded into the Defense's
  own modifiers at prepare, so the number on the sheet, the Skills grid's cell, a Defense roll and
  an Initiative rolled with Awareness all read it once. A bonus to a Skill Constellation reaches
  the roll, the roll dialog's list, the card, the Skills grid cell and the Relevant Check picker's
  numbers through `SwCheck.previewTotal`, and an Initiative rolled with that Constellation (ruling
  111). A Maneuver-targeted bonus reaches the Maneuver's own roll, and the dialog of any other
  check as an offer; it has no Threshold to move.
- **Verified**, in the open test world on the GM's client after `build_all.mjs --content` and Sync
  content: the self-test's 56 checks; a throwaway workbook's `bonus: +2 Situation to Stealth if
  Sync Test is Trained` built onto its Talent (`automation: 1 rule on 1 document (1 kind in use)`),
  carried by Sync content, indexed on Hrolda under `bonus`, her Stealth preview up by 2 and the roll
  dialog listing "Measured Step +2" beside Load Strain; the four Humanity lines typed into her
  copy's textarea parsed through the client resolver to `to.type "action"` with no error, the sheet
  panel reading them back, `rulesOfKind("bonus")` five entries; a plain Stealth check offering
  "Humanity: Aid +1" unticked with its hint and applying nothing; Aid from the pack opening the
  Relevant Check picker with Athletics at +5 (Humanity in it), rolling as "Aid" with "Humanity +1
  condition" among the card's modifiers and nothing offered, the card's flags carrying no offers;
  `bonus: +1 Condition to Guard if Human is Trained` moving Guard from 14 to 15 on the sheet and in
  `previewTotal` for a Defense roll and a Defense-as-check alike, the Expert line silent at Trained,
  and Frightened 1 bringing it back to 14 with both Condition entries listed; `-1 Gear to Athletics`
  taking the Athletics preview from 4 to 3; the error path printing every message as written
  (`write Condition, not status`, `a bonus of 0 does nothing`, `"Aidd" names no Constellation or
  Maneuver`, `"Aid" is not a Constellation`, the `if ... is` shape, the Lore refusal) while `-2 gear
  to stealth` and `+1 Condition to Spear & Polearm Fighting if Melee is Trained` parsed beside
  them; clearing the cell clearing everything; then the throwaway content removed, the loop rerun
  clean, the world resynced (the test Constellation and its Talents gone, Aid in the pack), and the
  web app's smoke test SMOKE CLEAN.
- **What the release touched, and what it left.** New: `module/rules/kinds/bonus.mjs`, and
  `packs/_source/actions/aid_30d830c3ca03647e.json`, Aid's first shipped source, there because
  Mike enabled the row and not because a cell uses the kind. Changed:
  `module/rules/kinds/index.mjs`, `module/rules/engine.mjs`, `module/rules/README.md`,
  `module/dice/check.mjs`, `module/data/actor.mjs`, `module/documents/item.mjs`,
  `module/documents/actor.mjs`, `module/helpers/content.mjs`, `templates/item/details.hbs`,
  `lang/en.json`, `assets/build_foundry.mjs`, `assets/test_rules.mjs`, the three stamps, this
  file, `FEATURES.md`, `CLAUDE.md`, `data/README.txt` and `automation-plan.md`; by Mike's hand,
  `data/maneuvers.xlsx` (Aid's row) and `assets/actions.json` with it, and `data/actions.xlsx`
  deleted. Untouched: the grammar module, the converter's logic (its comments now describe one
  actions workbook), every spreadsheet cell but Aid's row (Humanity's included), the web app's
  code (its Aid text is unchanged, since the sheet's Aid moved as it was), the Constellation
  Compendium docx, the roster, the attack flow, the damage pipeline, conditions, movement, the
  auras on the map, the handbook and `data/SYNC.json`. No document id moves; the shipped pack
  sources that change are Aid's, new, and the four Encounter Mode folders' `sort` (Watching,
  Deceiving & Helping now ships a row, so the sheet folders are numbered from it), and nothing
  else changes until a cell uses the kind.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list. `Starwrought_Players_Handbook_v4.16.docx` is on the shelf, untracked and unsynced, as the
  0.7.2 entry says, and `build_all.mjs` reports the drift until that sync, which is a later
  release's; in content mode it is a warning and the run goes on.

---

## 0.9.0 (2026-10-03): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.8.0 left them. The release is **the automation framework**,
the second half of what Mike asked for after the content loop (Mike, 2026-10-03: "I'd like an
Automation field in the data .xlsx files. And based on what is in there, when I run
sync_content.cmd (or when you run it as part of a build), it will create the Foundry VTT automation
code. However, I want to make sure the Foundry VTT automation code is well-built. For example, if I
create an automation syntax for the Torchbearer 15' aura, we should create the syntax that will
work for OTHER auras, too, without additional coding."), built to his second instruction and no
further: "Important - do NOT survey the talents yet or build ANY of the automation hooks. just
build the framework. we will build automation syntax hooks one at a time." So this is the skeleton
only, and **it does nothing in play yet.** An Automation column on every Talent sheet (the action
sheets had one) holds one rule per line, `kind: arguments`, in a small grammar that lives in the
system (`module/rules/grammar.mjs`) and is pure enough for Node to import, so `build_foundry.mjs`
parses every cell at build time into rule data on the Item (`system.rules`) and the client parses
the same text identically for the Item sheet; rule kinds are plug-ins with one contract in a
registry that is empty (`module/rules/kinds/index.mjs`); and the Actor indexes every owned Item's
rules (`system.rules { all, byKind, unknown }`, `actor.rulesOfKind(kind)`) for engine hooks that
do not exist yet. No kind is implemented, no hook is wired into a roll, the attack flow, damage, a
condition, movement or an aura, and no Talent's text was read: every non-comment line in a cell is
"unknown rule kind" today, which the build refuses and the sheet marks. Kinds come one at a time
with Mike, each with its hook, its test, its line in `data/README.txt` and its docs; the first is
the aura, for Torchbearer, and it will serve every aura in the book. The design record is
`automation-plan.md` in the project root. A minor bump for a framework: three new modules, a
self-test, a new `automation` field on the Talent and the Constellation and a `rules` array on three Item types, all
with defaults and no migration. The decisions are rulings 118 to 120,
continuing the 0.8.0 entry's 117 (see Notes). `Starwrought_Players_Handbook_v4.16.docx` is still
on the shelf, untracked and unsynced, as 0.8.0 said; `build_all.mjs` reports the drift until that
sync, which is a later release's, and in content mode goes on (ruling 115).

### Added

- **The Automation column on the tree sheets** (`xlsx_to_trees.py`). Every Talent sheet may carry
  an `Automation` column beside `Aura` and `Enabled?` (column order free; the first word of the
  header wins, as for every column). The converter copies a non-empty cell's text through as
  `automation` on the Talent node, exactly as the action sheets' column already travelled, and
  parses nothing: the grammar lives in the system, and Python never holds a second copy of it
  (ruling 120).
- **The grammar** (`module/rules/grammar.mjs`, new; ruling 120). One rule per line: the kind word
  (everything up to the first `:` or whitespace, lower-cased), then its arguments, trimmed; the
  colon optional when there are none; blank lines ignored; a line beginning with `#` a comment.
  `parseAutomation(text, context)` returns `{ rules, errors }`: each rule `{ kind, line, text,
  ...data }` with `data` whatever the kind's `parse` returned, each error `{ line, text, message }`
  with a message a game designer can act on (`unknown rule kind "aura" (no rule kinds are defined
  yet)` while the registry is empty, `known kinds: a, b, c` once it is not; a kind's own
  `RuleSyntaxError` with its line; any other throw caught into an error line, never a crash).
  `summarize(rule)` gives the kind's one-line summary, or the error text, or `unknown rule kind`.
  The shared helpers a kind may use are `splitArgs(text)` (commas outside quotes) and
  `keyValues(parts)` (`key=value` pairs), and nothing more until a kind needs it. No Foundry global
  at module scope and no i18n inside: Node imports it as `build_foundry.mjs` imports `config.mjs`,
  and the sheet localizes around it.
- **The kind registry, empty** (`module/rules/kinds/index.mjs`, new; ruling 119). `KINDS`,
  `registerKind(def)`, `kindOf(word)`, `knownKinds()`. A kind is one file in `module/rules/kinds/`
  exporting `{ id, aliases, parse(args, context), summary(rule), hooks }`: its word (lower-case,
  letters and hyphens), the other words accepted before the colon, its argument syntax and
  validation (a plain object returned, or `RuleSyntaxError` thrown, with `{ itemName,
  constellation, itemType, line }` to hand for the message), its summary line for the sheet, and
  the engine hook points it speaks at, empty in 0.9.0 and defined one at a time with the kind that
  needs them. `registerKind` refuses a definition missing `id`, `parse` or `summary`, or whose id
  or alias is already taken. The index registers nothing; a comment names the first kind to come,
  an aura for Torchbearer, and says it is not here. `module/rules/README.md` (new) is "Adding a
  rule kind", step by step: the file, the contract, the registration, the checks in
  `assets/test_rules.mjs`, the line in `data/README.txt` naming the kind's syntax, the engine hook
  (where it would be wired, and that it is defined with the kind), the docs (CHANGELOG, FEATURES),
  and the content loop that carries it (a kind's code ships with the system; a cell that uses it
  reaches an open world through Sync content).
- **The rule index on the Actor** (`module/rules/engine.mjs`, new). `collectRules(actor)` walks the
  owned Talent, action and Constellation Items (a Constellation Item may carry rules one day),
  reads each one's `system.rules`, and returns `{ all, byKind, unknown }` of `{ rule, item }`
  pairs, with an error entry, or a rule whose kind the registry lacks, sorted into `unknown` with
  its reason; pure over the documents, no side effects; `rulesOfKind(actor, kind)` beside it.
  `SwCharacterData` and `SwNpcData` set `this.rules` from it first thing in `prepareDerivedData`,
  before the Constellations, and `SwActor#rulesOfKind(kind)` is the engine's `rulesOfKind` with
  `this`: the word is trimmed and lower-cased and an alias resolves to its kind's id, as in a cell;
  the answer comes from `system.rules.byKind` when the data model prepared an index, else from the
  Items on the spot (a party has no `SwActorData` and holds loot only, so it answers `[]`); and the
  result is always an array, so a kind's engine hook can later iterate it without a guard and
  without walking the Items. Nothing reads them yet, and the code says so.
- **The parse at build time** (`build_foundry.mjs`; ruling 118). For every Talent node and every
  action with Automation text, the build parses the cell with the system's own grammar, passing
  `{ itemName, constellation, itemType, source }` for its messages (the action's sheet standing in
  for the Constellation). Any error fails the build with one line per error, `automation:
  <Constellation> / <Talent>, line <n>: <message> ("<text>")`, so `sync_content.cmd` stops naming
  the cell before the sources are written, as a bad Aura cell stops the converter; otherwise the
  document carries `system.automation` (the text) and `system.rules` (the parsed rules). The run's
  summary gains `automation: N rules on M documents (K kinds in use)`, which today reads
  `automation: no rules (no rule kinds are defined yet)`. The content hash covers `system`, so a
  changed cell changes the hash and the open world syncs it like any field (ruling 120).
- **The data.** `SwTalentData` and `SwConstellationData` gain `automation` (a string; the action
  model has had it since the column arrived) and `SwTalentData`, `SwActionData` and `SwConstellationData` gain `rules` (an
  array of objects, initial `[]`). Each derives `ruleLines` for the sheet in `prepareDerivedData`,
  through the grammar: one entry per stored rule with the kind word, the line, the text, the kind's
  summary and an error, which is the stored error, or "unknown rule kind" when the registry does
  not know the word. Every Talent, action and Constellation source carries `rules: []` after a
  clean build.
- **The Item sheet's Automation panel** (`templates/item/details.hbs`) shows for Talents and
  Constellations as well as Maneuvers: the textarea, editable where the sheet is, then an **As
  read** list, one row per rule with the kind word in a tag and the summary, and a red row with the
  message for an error or an unknown kind. An empty list says "No rules (the framework has no rule
  kinds yet; they are added one at a time)". The rows' strings are under `STARWROUGHT.Rules.*`,
  and the panel's title and hint (`STARWROUGHT.Section.automation`, `STARWROUGHT.Hint.automation`)
  are reworded to the framework: one rule per line, `kind: arguments`; a `#` line is a comment.
- **A GM's edit saves and is marked, never refused** (`SwItem._preUpdate`; ruling 118). When
  `system.automation` changes on a world Item or an owned copy, the Item parses the new text and
  writes `system.rules` as the parsed rules plus an `{ error, line, text }` entry per line that did
  not parse, so the text always saves, the sheet shows what is wrong, and an engine can skip the
  line. The build never writes an error entry, because the build fails instead.
- **`assets/test_rules.mjs`**, a self-test of the framework, run by `build_all.mjs` in every step-running mode (`--check` runs none)
  (content mode included) as the step `test_rules`, right before `build_foundry`. It registers a
  throwaway kind in process (`test-only`; never shipped) and checks that blank and comment lines
  parse to nothing, an unknown kind is one error naming the word and the line, the throwaway kind
  parses its arguments and `summarize` prints its summary, a kind that throws `RuleSyntaxError`
  yields an error line and no crash, `registerKind` refuses a duplicate id and a definition without
  `parse`, and `collectRules` over a fake actor-like object (a plain `{ items: [...] }` with
  `system.rules`) indexes by kind and sorts errors and unknowns. Exit 1 names the failing check;
  success prints "rules framework: N checks passed".
- **`automation-plan.md`** in the project root: the framework's design record in
  `party-sheet-plan.md`'s voice, with Mike's words, the design, the data, the contract, how a kind
  is added, what was deliberately not done and why, the backlog as Mike framed it, and the
  decisions that are his.

### Changed

- **`data/README.txt`** names the Automation column on the tree sheets (one rule per line, `kind:
  arguments`, `#` comments, no kinds yet so any other line stops the build naming the cell, kinds
  added one at a time and each named there with its syntax when it lands), and the action sheets'
  Automation is the same column now, no longer prose. Its ADDING CONTENT section says what a bad
  cell does to the loop: it stops before the sources are written.
- **`FEATURES.md`** gains section 7, "Automation: the framework", before the content loop (now
  section 8; "What it deliberately does not do" is 9), and `CLAUDE.md` a standing paragraph of the
  same name with the rule that kinds are added one at a time with Mike, each with its hook, its
  test, its README line and its docs.
- **Every `ArrayField` in the system's data models now takes its initial value from a function**
  (`initial: () => []`), never a literal array. Foundry hands one literal to every document whose
  source lacks the field and, since v13, updates an `ArrayField` in place to keep its identity, so
  the literal `[]` on the new `rules` field made seven of Hrolda's Talents share one array: an
  unknown kind typed into one Talent's textarea appeared on all seven until the page reloaded (the
  0.9.0 live test). `traits`, the party's `members` and the road roll's `modifiers` carried the same
  latent hazard and take the function now; nothing stored changes.
- **`build_all.mjs`** runs `test_rules` as a step in every step-running mode (`--check` runs none), before `build_foundry`, so a
  framework that cannot pass its own checks never builds the packs.
- The stylesheet gains the As read list in the sheet's idiom.
- The version stamps read 0.9.0 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: `automation` and
  `rules` have defaults, so a Talent written before 0.9.0 reads as a blank cell with no rules.

### Notes

- **The rulings, 118 to 120**, the brief's three for the framework, numbered on from the 0.8.0
  entry's 117.
  - **118. The cell is data, not code.** An Automation cell is one rule per line in a small grammar
    that the build parses into rule data on the Item and the client reads with one engine; nothing
    generates JavaScript from a cell. A line the grammar does not know stops the build naming the
    Constellation, the Talent and the line, as a bad Aura cell does; the same line on a world Item
    edited in Foundry saves and is marked on the sheet, never thrown on.
  - **119. Rule kinds are plug-ins with one contract, added one at a time.** A kind is one file:
    its word, its argument syntax and validation, its summary for the sheet, and the engine hooks it
    speaks at, defined with it and not before. The framework ships with none (Mike, 2026-10-03: "do
    NOT survey the talents yet or build ANY of the automation hooks. just build the framework. we
    will build automation syntax hooks one at a time"). A kind serves every Talent that uses its
    word: the aura that will serve Torchbearer serves every aura in the book.
  - **120. One grammar in one place.** The grammar module is the system's, pure enough for Node to
    import, so the build and the client parse a cell identically and the converter carries text
    only. The content loop carries a cell's rules to an open world as it carries any field, and the
    copies refresh overwrites an owned copy's rules from the source, since the cell is the author.
- **No kinds, no survey, by instruction; the first kind is the aura.** Nothing in this release
  reads a Talent's Effect, and no cell in `data/*.xlsx` was filled in: the survey of which Talents
  want which kinds was not made, because Mike said not to make it yet, and the first kind was not
  built, because he said the kinds are built one at a time. Mike's own example sets the order: the
  aura, for Torchbearer Human's 15 feet, written so that it serves every aura in the book without
  more code (ruling 119); the `Aura` column (0.5.1) already draws the ring on the map, and what the
  aura kind adds is the effect inside it. Each kind that follows is one file, its hook defined with
  it and wired nowhere before, its checks in `test_rules.mjs`, its line in `data/README.txt` and its
  prose here and in `FEATURES.md`; `module/rules/README.md` is the recipe.
- **"Create the Foundry VTT automation code" is read as rule data, not generated code** (ruling
  118). A cell that produced JavaScript would put the rules in two places and make every Talent a
  program to review; a cell that is data is parsed once, by one grammar, into one shape the engine
  reads, and the engine is the only code. That is also what makes Mike's "work for OTHER auras,
  too, without additional coding" true by construction: the kind owns the word, and every cell
  that uses the word is served by it.
- **What a cell may hold today.** Blank, or lines beginning with `#`. Any other line fails the
  build with `unknown rule kind "<word>" (no rule kinds are defined yet)`, which is the framework
  working as designed, not a bug: the error names the Constellation, the Talent and the line, and
  the loop stops before the sources are written, so the open world never sees a half-built set.
  The same line typed into a world Item's textarea saves, shows a red "unknown rule kind" row, and
  lands in the actor's `system.rules.unknown`; `rulesOfKind("aura")` returns `[]`; nothing else
  changes.
- **The copies refresh overwrites an owned copy's Automation and rules from the source** (ruling
  120). A Talent on a sheet whose textarea a GM edited diverges from its compendium source; the
  next Sync content with the copies box ticked writes the source's `system.automation` and
  `system.rules` over it, as it writes every field but the character's own, because the cell is
  the author. Whether an edited copy's Automation should instead survive a refresh is Mike's call,
  and is recorded in `automation-plan.md` with the other two decisions that are his: the first
  kind's syntax, and whether the web app and the Constellation Compendium docx should print the
  cell, which neither does today.
- **What the framework touched, and what it left.** New: `module/rules/grammar.mjs`,
  `module/rules/kinds/index.mjs`, `module/rules/engine.mjs`, `module/rules/README.md`,
  `assets/test_rules.mjs`, `automation-plan.md`. Changed: the converter's header map and node, the
  Foundry build's Talent and action builders and its summary, `build_all.mjs`'s steps, the Talent,
  action and Constellation data models, the Item document's `_preUpdate`, the character and
  adversary data models' prepare and the Actor document, the Item sheet and its template, the
  language file, the stylesheet and the three stamps. Untouched: every roll, the attack flow, the
  damage pipeline, conditions, movement, the auras on the map, every spreadsheet cell, the web app,
  the Constellation Compendium docx, the roster, the handbook and `data/SYNC.json`. No document id
  moves; every pack source gains `rules: []`, and every Constellation source `automation: ""`
  beside it, so the next Sync content lists every Talent, action and Constellation as an update,
  which is the fields being written and nothing more.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list. `Starwrought_Players_Handbook_v4.16.docx` is on the shelf, untracked and unsynced, as the
  0.7.2 entry says, and `build_all.mjs` reports the drift until that sync, which is a later
  release's; in content mode it is a warning and the run goes on.

---

## 0.8.0 (2026-10-03): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.7.5 left them. The release is **the content loop** (Mike,
2026-10-03: "for the next part of the build, I want the ability to add to any of the data
spreadsheets and run a command or a script to incorporate those into the Foundry VTT module. They
don't need automation... we will work on an automation framework after this part. (and add them
into the local web app)"). One command, `node assets/build_all.mjs --content`, or a double-click on
`sync_content.cmd` in the project root, converts the spreadsheets, rebuilds the web app and the
Constellation viewer, renders only the plates whose Constellation changed or is new, writes the
Foundry pack sources with a content hash on every document and an index of them all, and runs the
style check; it never compiles the LevelDB packs and never stops for handbook drift. Then, in the
open Foundry world, a **Sync content** tool (Settings > STARWROUGHT > Sync content, offered to the
GM at load when the index on disk is newer than what the world last synced) diffs the index
against the compendia by document id and content hash, shows what would be created, updated and
deleted, by name, and applies it with the packs unlocked for the moment of the write, no restart.
Through 0.7.5 a content change meant stopping Foundry, building, starting Foundry and relaunching
the world, because the compile fails while Foundry holds the packs open; that is the part removed.
A minor bump for a new tool, two hidden world settings with a settings menu, and a pipeline mode;
no data model moves and no migration, since the hash is a flag and the settings have defaults. The
decisions are rulings 115 to 117, continuing the 0.7.5 entry's 114 (see Notes). The content loop
is the first half of what Mike asked for; the automation framework is next.
`Starwrought_Players_Handbook_v4.16.docx` is still on the shelf as this ships, untracked and
unsynced; `build_all.mjs` reports the drift until that sync, which is a later release's, and in
content mode reports it as a warning and goes on (ruling 115).

### Added

- **`node assets/build_all.mjs --content`**, the content loop's one command (ruling 115). It runs
  `xlsx_to_trees`, `inject`, `render_constellations --changed`, `build_foundry --no-compile` and
  `check_style --quiet`, in that order, and skips `sheet_gen`, `build_phb` and
  `build_features_docx`, saying so: the character sheets, the Constellation Compendium and the
  features docx are release outputs, not content. The version-stamp check runs as it always has (a
  repository invariant, not a handbook matter). The drift check runs too, but in content mode its
  report prints under a "HANDBOOK DRIFT (a warning in content mode)" banner and the run exits 0,
  because adding a Talent to a sheet is not a handbook sync; a failing step still exits 1. The
  closing line: "Content rebuilt: the web app and the viewer are current (reload the browser tab);
  in Foundry, sync the open world from Settings > STARWROUGHT > Sync content." `--content` with
  `--skip-slow` or `--check` is refused ("--content is its own mode"). **`sync_content.cmd`** in the
  project root is the same command for a double-click: it changes to its own folder, runs the
  build and pauses so the window stays open to be read.
- **A content hash on every pack document, and an index of them** (`build_foundry.mjs`; ruling
  116). Every Item and Folder the build writes carries `flags.starwrought.contentHash`: the first
  16 hex characters of the SHA-1 of `JSON.stringify` over a canonical object (keys sorted
  recursively, so the hash is stable across runs and across the order the code assembles fields),
  `{ name, type, img, system, folder, sort }` for an Item and `{ name, type, folder, sorting, sort,
  color }` for a Folder, set once the document is complete. `writeSources()` then writes
  `packs/_source/index.json`: `stamp` (the ISO time of the build, different every run), `build`
  (a SHA-1 over every pack's document hashes in id order, so it changes only when content does;
  the Foundry side compares `build`, and a rerun with nothing changed syncs nothing), `system`
  (the manifest version) and, per pack, its documents and folders, each with `_id`, `name`, `type`,
  `file` (the path relative to `packs/_source/<pack>/`) and `hash`. Foundry serves it as a static
  file under `systems/starwrought/`. Every id and key is what it was: document ids still hash the
  pack and the key, so a document keeps its UUID on every sheet across the change. With
  `--no-compile` the run closes with "Sources and index written. In an open Foundry world:
  Settings > STARWROUGHT > Sync content (the GM is also offered it at load). The compendia on disk
  are compiled when the full pipeline runs with Foundry closed."; the lock-detection message on a
  compile that finds Foundry holding the packs stays.
- **Plates rendered only when their Constellation changed** (`render_constellations.py
  --changed`). A sidecar, `assets/constellations/.plates.json`, maps each plate file to the SHA-1
  of its tree's canonical JSON (the whole tree entry from `trees.json`, keys sorted). With the
  flag the renderer draws only the plates whose hash differs or whose PNG is missing, prunes the
  plates of trees that are gone as before, rewrites the sidecar and prints "rendered: N plates (M
  unchanged)"; without it everything renders as before and the sidecar is still written, so the
  first `--content` run after a full build has hashes to compare.
- **Sync content** (`module/apps/content-sync.mjs`, `templates/apps/content-sync.hbs`; ruling
  116). A GM-only application, one instance, under Settings > STARWROUGHT > Sync content
  (`game.settings.registerMenu`, restricted, the `fa-solid fa-rotate` icon) and as
  `game.starwrought.syncContent()` for a macro. It fetches the index (cache-busted with the clock;
  a notice and nothing more when the file is absent, as on an install that never ran the 0.8.0
  pipeline) and builds **the plan**: for every pack the index names that
  `game.packs.get("starwrought.<pack>")` resolves, the pack's own index with the content hash, the
  folder and the type, and its folders; **create** is every index id the pack lacks, **update**
  every id whose stored hash differs from the index's or is absent (a pack compiled before 0.8.0
  carries none, so the first plan after upgrading lists every document as an update, which is
  the hashes being written and nothing more), **delete** every pack id the index no longer names,
  and the same three for folders; a name on every entry so the plan reads; a pack the index names
  that the world lacks is listed as skipped; `plan.empty` when there is nothing to do, with
  `plan.build` and `plan.stamp` from the index. **The window**: the index's `stamp` as a date and
  time, the stamp the world last synced, the `build` as a short hash; a table per pack with the
  three counts and three collapsible lists of names; the copies line with its checkbox; Refresh
  plan, Sync and Close; the buttons disabled and a progress line while it applies, and the result
  in place of the plan after. An empty plan says "Nothing to sync: the compendia match the sources
  built {when}." Every string is under `STARWROUGHT.Content.*`.
- **Applying the plan.** Per pack, inside one try/finally so a pack is never left unlocked: the
  lock state remembered, `pack.configure({ locked: false })`; folders first, each needed one's
  JSON fetched from `systems/starwrought/packs/_source/<pack>/<file>` with `_key` stripped,
  `Folder.implementation.createDocuments(..., { pack, keepId: true })` and `updateDocuments` for
  the changed; then the Items the same way, `createDocuments` with `keepId` so the UUID the
  sources chose is the UUID the world gets, `updateDocuments` with `recursive: false, diff: false`
  so a key the source dropped leaves the stored document rather than lingering, and
  `deleteDocuments` for the stale; folders deleted last; the lock restored. Everything is counted.
  Then the world settings `contentBuild` and `contentStamp` take the plan's `build` and `stamp`,
  `reloadContentIndexes()` refreshes what the system read at init, every open sheet
  (`foundry.applications.instances` with a `document`) re-renders so lists catch up, and one
  GM-whispered card with the counts (`cardHtml`, the system's idiom, speaker none, whispered to
  `ChatMessage.getWhisperRecipients("GM")`) is posted so there is a record.
- **Refresh the characters' copies** (ruling 117), a checkbox on the plan, ticked by default once
  the world has synced before (unticked on a world's very first sync, when no copy carries a hash
  and every one would be rewritten) and disabled when there is nothing to refresh. For every world
  Actor (character, adversary and party alike; an unlinked token's synthetic actor is skipped),
  for every embedded Item of a type the packs carry, the source is found by
  `_stats.compendiumSource` or `flags.core.sourceId` naming
  `Compendium.starwrought.<pack>.Item.<id>`, else by type and name (case-insensitive) in the
  index. If the copy's own `flags.starwrought.contentHash` differs from the index's or is absent,
  the copy takes the source's `name`, `img` and `system` with the fields that are the character's
  own written back from the copy where the type has them (`system.quantity`, the carry
  `system.state`, a shield's `system.raised`, a Talent's `system.choice.value`, a weapon's
  `system.style`, `twoHands` and `versatileActive`, an action's adversary `attack` block, a
  consumable's `uses`, and a Lore instance's placement: the Constellation a Lore Talent was cloned
  into, the slug and name of a Lore (X) Constellation Item); anything else edited by hand on the
  copy is lost; and the hash; applied per Actor with
  `actor.updateEmbeddedDocuments("Item", updates, { recursive: false, diff: false, swAnnounced: true })`,
  so the copy keeps its `_id` and the Adjusted card says nothing. The plan shows "N copies on M
  characters would be refreshed" before the GM ticks; the result counts per Actor and names them.
- **The offer at load.** On the GM's client, in the ready hook after the migration: the index is
  fetched and its `build` compared with the world's `contentBuild`. When they differ the plan is
  computed; an empty plan records the build and stamp silently, so a fresh world whose compiled
  packs already match the sources is never nagged; otherwise a `DialogV2.confirm`: "The content
  on disk was rebuilt {when} and differs from this world's compendia: {n} to create, {m} to update,
  {k} to delete. Open Sync content?" Yes opens the tool; No does nothing, and the question returns
  at the next load. Any error logs and moves on, and the world loads regardless.
- **`reloadContentIndexes()`** in `module/helpers/content.mjs`: empties the Constellation registry
  (a register call adds or overrides and never removes, so a Constellation the sources dropped
  would otherwise stay on offer in every picker until a page reload), refetches
  `content/constellations.json` and `content/sync.json` (cache-busted), re-registers the
  Constellations and calls `refreshConstellationRegistry()`, then `invalidateBasicActions()`,
  `invalidateChassisIndex()` with `loadChassisIndex()`, and `invalidateExplorationActivities()`
  from `helpers/party.mjs`, so the Basic Maneuvers panel, the wizard's cards and the party's
  Activity lists read the synced content without a reload of the page.

### Changed

- **`build_all.mjs`** gains the `--content` mode, and its usage block names it beside `--check`,
  `--skip-slow` and `--accept-phb`; the full run is what it was, LevelDB compile and drift gate
  included. It also stops trusting `python` on PATH: Mike's first double-click of
  `sync_content.cmd` resolved an interpreter without openpyxl and fell over at the first import, so
  the script now probes for the four modules the steps need (`STARWROUGHT_PYTHON` if set, then
  the project's `.venv`, then `python`, `py -3`, then every install the py launcher lists by
  path), runs every Python step with the first that has them, prints which in its header, and
  when nothing on the machine has them makes `.venv` in the project root and installs them there
  (the modules had been installed into one Windows account's user site, invisible to the PC's
  other account; a venv in the folder is shared by both). `.venv/` is gitignored.
- **`build_foundry.mjs`** keeps `_stats.systemId` on every document, writes `index.json` beside
  the sources from `writeSources()` and stamps the hash in `push()`, the one place every builder
  (`item()`, `folder()`, the rules journal and the macros) passes through once its document is
  complete, so the index lists every pack and every document (the journal's Languages, Exposed and
  Bind pages are built from the sheets and the roster, and must reach an open world too); nothing
  else in the build changes, and no id or key moves. `assets/package_system.mjs` now carries
  `packs/_source` into the release zip, so a system installed from a release has the index and
  the sources the in-game sync reads.
- **`config.mjs`** gains `CONTENT_INDEX_PATH` and `CONTENT_SOURCE_PATH` (where the index and the
  per-pack sources are fetched from), beside `SYSTEM_VERSION`.
- **Two hidden world settings**, `contentBuild` and `contentStamp` (strings), hold the build the
  world last synced to and when it was built, and the `contentSync` menu opens the tool; the
  Handlebars preloader lists the new template, and the stylesheet gains the `sw-content-sync`
  block, compact and in the system's idiom.
- **`data/README.txt`** opens with a new section, "ADDING CONTENT: the loop", before "Index
  columns" (add rows, sheets or a workbook; set `Enabled?` to Yes on what should ship; save;
  double-click `sync_content.cmd`; reload the web app; in Foundry take the Sync content offer or
  open it from Settings, read the plan, Sync), and its closing "To sync after editing" block names
  the two paths: the content loop above, and the full pipeline with Foundry closed for a release.
- The version stamps read 0.8.0 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: the hash is a flag the
  first sync writes, and a setting never set reads as an empty string, which no `build` equals.

### Notes

- **The rulings, 115 to 117**, the brief's three for the content loop, numbered on from the 0.7.5
  entry's 114.
  - **115. The sources are the content; the compiled packs are a release artifact.** A content
    change is finished when the spreadsheets, the web app and the pack sources agree and the open
    world has synced; the LevelDB compile is for a release or a fresh install, done with Foundry
    closed. `build_all.mjs --content` reports handbook drift as a warning and never stops for it,
    because adding a Talent to a sheet is not a handbook sync.
  - **116. The in-game sync is a diff by id and hash, shown before it is applied, and it deletes
    stale system documents by name.** Document ids hash the pack and the key, so a document keeps its
    id across builds and its UUID on every sheet; a content hash on every document
    (`flags.starwrought.contentHash`) says whether it changed. A document in a system pack that the
    sources no longer carry is stale and is deleted, listed by name in the plan first; a GM's own
    content belongs in the world, not in the system's packs, and the plan says so.
  - **117. Refreshing a character's copy keeps the character's state.** An owned Item whose source
    changed takes the source's name, image and system data, except the fields that are the
    character's own: `quantity`, the carry `state`, a shield's `raised`, a Talent's `choice.value`.
    The copy is found by its recorded compendium source, else by type and name in the index.
    Opt in, ticked by default, counted and named in the plan.
- **What the loop does not do.** The handbook, the Constellation Compendium docx, the PDFs and the
  compiled packs on disk are not touched by `--content`: those are the full
  `node assets/build_all.mjs`, run with Foundry closed, for a release. A fresh install reads the
  compiled packs it was shipped with before its first sync, and the release workflow still compiles
  them on a fresh checkout. Nothing in the loop acts on a Talent's Effect: the Automation column
  travels onto the Item as before and nothing reads it, and the automation framework is the next
  part of the build (Mike: "we will work on an automation framework after this part").
- **The first sync after upgrading writes hashes into the packs and, with the copies box ticked,
  rewrites every owned copy.** A world whose packs were compiled by 0.7.5 or earlier holds
  documents with no `contentHash`, so its first plan lists every document as an update with
  nothing to create or delete; applying it stamps the hash on each, the setting takes the build,
  and the second plan is empty. The characters' copies carry no hash either, so the same plan
  counts every owned Item on every world Actor that resolves to a source, and the box starts
  unticked for that reason: ticked, each copy is rewritten from the current source, keeping the
  character's own fields and losing any hand edit to the rest. A fresh world whose compiled packs
  came from the same build as the sources is recorded silently at load and never asked.
- **A GM's own content belongs in the world.** The plan deletes a stale system document by name
  and shows it before anything is applied (ruling 116); a Talent or weapon the GM wrote into one of
  the system's packs would be listed for deletion, since the sources do not carry it. The diff
  reads and writes the system's own packs alone: a world compendium of the GM's own is never
  touched, and world Actors are read only for the copies refresh, which the GM ticks.
- **The copies refresh is opt in and keeps the character's state** (ruling 117), and the copy
  keeps its `_id`, so nothing on the sheet re-links. The fields it preserves are the four named; a
  key the sources dropped leaves the copy as it leaves a pack document (`recursive: false, diff:
  false`), and a copy whose source cannot be found by its recorded source or by type and name is
  left alone and counted nowhere.
- **What the pipeline touched.** The pipeline itself: `build_all.mjs` (the mode),
  `build_foundry.mjs` (the hash, the index, the closing lines) and `render_constellations.py` (the
  sidecar and `--changed`), with `sync_content.cmd` new in the project root. No roster row,
  compendium page or web app table moves, and no document id changes; every pack source gains the
  hash flag, so the next full pipeline run with Foundry closed recompiles the packs on disk with
  it, and until then the in-game sync writes it into the open world's packs.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list. `Starwrought_Players_Handbook_v4.16.docx` is on the shelf, untracked and unsynced, as the
  0.7.2 entry says, and `build_all.mjs` reports the drift until that sync, which is a later
  release's; in content mode it is a warning and the run goes on.

---

## 0.7.5 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.7.4 left them. The release is phase 4 of the Party Sheet,
the last the plan has, built from part 10 of `party-sheet-plan.md` (Mike, 2026-10-02, after 0.7.4:
"go ahead with phase 4 too"): a **Downtime** panel at the foot of the On the road tab, with the
days the GM gives the party, the three Downtime Activities printed from the Actions pack's Downtime
Mode folder, a Train control per member that Flares a Constellation through the shared picker and
says on the card that it was training, and one line each saying Retrain and Provision are done by
hand. One new field (`system.downtime.days` on the party) with a default and one flag on the
character (`flags.starwrought.trainedAt`), so no world migration; no data moves, so a patch bump to
0.7.5. The decisions are rulings 112 to 114, continuing the 0.7.4 entry's 111 (see Notes). The
system runs ahead of the book on one clause of Table 96, carried as a tracked change in
`Starwrought_Players_Handbook_v4.15_downtime_proposal.docx` for Mike to accept or reject.
`Starwrought_Players_Handbook_v4.16.docx` is still on the shelf as this ships, untracked and
unsynced; `build_all.mjs` reports the drift until that sync, which is a later release's.

### Added

- **The Downtime panel** (plan, part 10; ruling 112). Below the member rows of the On the road
  tab, under its own heading, open to players as the rest of the tab is. Downtime is a panel, not
  a mode: the book's Downtime is days the GM gives and three Activities, and the panel prints both
  and runs nothing. **The days** are `system.downtime.days` on the party (`SwPartyData`; an
  integer, 0 or more, default 0), the GM's "you have ten days" (PHB P348: the GM typically tells
  you how many you have before the world begins to move quickly again), an input for the GM through
  the party form's own submit and a number for a player, with the P348 hint beside it. Nothing
  counts them down, spends them or refuses anything for want of them, and nothing is derived from
  them. **The Activities** are printed from the Actions pack's "Downtime Mode" folder
  (`downtimeActivities` in `module/helpers/party.mjs`: the category read off the Item, since the
  model does not flag it; folder order, then the Items' own sort, then by name; cached once per
  session exactly as `explorationActivities` is, a world action Item of the same name and category
  replacing the printed one, and `invalidateExplorationActivities`, which `starwrought.mjs`
  already calls on any unowned action change, clearing both caches, so no new hook), one row each
  with the name, the Duration from `system.requirements` as a tag (Retrain 1 month, Train 7 days,
  Provision 1 day) and the Effect from `system.description`. The panel holds no table of its own: a
  row Mike adds to the roster's hand-kept `downtimeActions` block ships through
  `build_foundry.mjs` and appears here with no code change, and an empty folder says so.
- **Train** (ruling 113; decision 14). Under the Activities, one entry per member (portrait, name,
  the Train anchor), live for the member's owner and for the GM and offered to nobody else (`train`
  in `helpers/party.mjs`, Owner permission checked first, a notice otherwise). It opens the shared
  Flare picker (`pickFlare(actor, { askReason: false })`: the Opened list, the "Show
  Constellations you have not opened" checkbox, and no reason field, since the reason is the
  training), and Cancel writes nothing. A pick lights that Constellation through the member's own
  `toggleFlare(slug, true, { trained: true })`, so the Flare card is posted as every Flare is,
  spoken by the member and public, with "Flared by seven days' training."
  (`STARWROUGHT.Flare.trained`) as its second line in place of the "Awarded by the GM" line; the
  Deferred reminder follows while the member holds a Deferred Talent Point, as it does on any lit
  Flare. Then the character records `flags.starwrought.trainedAt { level, milestone, time }`, the
  member's level and Milestone count as they stand and the clock (a flag, not schema, as the plan
  says; `trainedAt` reads it and `trainUsed` compares it; the write carries no card concern, since
  the Adjusted card has never watched flags). **The warning.** While the record equals the member's
  current level and Milestone count exactly, the Train control turns amber (`sw-train-used`) with
  "Train already used since the last Milestone" as its tooltip, and the card says so too when a
  second Train is taken anyway. It refuses nothing: the system prevents nothing anywhere else, and a
  GM may rule an exception. The next Milestone award (`awardMilestone`) makes the record stale by
  comparison, since the member's count has moved; nothing clears it, and a flag never written reads
  as never trained. A pick of a Constellation already lit lights nothing again and writes no Flare
  (`toggleFlare` now skips the empty update it used to issue), but the training line is still
  said, with "<name> was already Flared; nothing on the sheet changes." beneath it, so a Train is
  never silent. The road part already redraws on the member hooks, and a flag
  write is an `updateActor` on the member, so the amber mark appears as the card lands.
- **Retrain and Provision, by hand** (ruling 114). Each prints its row with one line under its
  Effect: Retrain's Talent Point is moved by dragging as today, and the restrictions (not out
  of the Origin Constellation, not a Root, not a Talent another Talent you own requires, not one
  that would lower a Proficiency Rank) are the player's and the GM's to honour; Provision's buying
  and selling, the half price and the uncommon-goods check are the table's. The system adds no
  control for either.

### Changed

- **`toggleFlare(slug, state, { reason = "", trained = false } = {})`** passes `trained` to the
  card, which prints "Flared by seven days' training." as its second line when it is set, the
  reason line staying for a GM's reason (both print if both are given), and a "Train already used
  since the last Milestone" note when the member's previous training still stands against their
  current count. One more change reaches every caller that passes `state` true: lighting a
  Constellation that is already lit now writes nothing (0.7.4 ran an empty update) and the lit card
  carries "<name> was already Flared; nothing on the sheet changes." (`STARWROUGHT.Flare.alreadyLit`),
  where 0.7.4 posted a plain Flared card. Train, the critical card's Flare button and the roster's
  GM award can all meet that case, since the picker lists a Flared Constellation; the sheet's Flare
  toggle (no `state`, so it always flips) and the chips that put a Flare out (`state` false) see no
  change.
- **`invalidateExplorationActivities`** clears the Downtime Activities cache beside the Exploration
  one, and its comment says so; the name stays, since the one call site in `starwrought.mjs` fires
  on any unowned action change and that is what both caches wait on.
- **The party sheet's road context** gains `downtime` (the days; the Activities shaped for the
  template with name, duration, description, slug and, on Retrain's and Provision's rows, the
  `byHand` line; one entry per member with `used` and its hints), and the sheet's actions gain `train` (owner or GM, the member
  resolved through `#memberFor`, permission re-checked before writing as the rest do). The Days
  input is the party form's own field, GM only; a player sees the number.
- **The stylesheet** gains the Downtime panel and the amber mark.
- The version stamps read 0.7.5 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: `system.downtime.days`
  on a party defaults to 0, and a character with no `trainedAt` flag has never Trained.

### Notes

- **The rulings, 112 to 114**, the brief's three for the plan's part 10 and its decision 14,
  numbered on from the 0.7.4 entry's 111.
  - **112. Downtime is a panel, not a mode.** `system.downtime.days` on the party is the GM's "you
    have ten days" (PHB P348): an integer the GM types, shown to players, and nothing in the system
    counts it down, spends it or refuses anything for want of it. The three Downtime Activities print
    from the pack's Downtime Mode folder with their Duration and Effect, data first, so a row Mike
    adds to the roster's `downtimeActions` appears on the panel with no code change.
  - **113. Train lights a Flare through the shared picker, and the system remembers when.** A
    member's Train (the owner's or the GM's) opens `pickFlare` (the dialog the critical card and the
    roster's Flare award use) and lights the chosen Constellation through `toggleFlare`, whose card
    says "Flared by seven days' training" in place of the GM's reason line, so the Flare is said once
    as every Flare is. The character records `flags.starwrought.trainedAt { level, milestone, time }`
    (a flag, not schema, as the plan says). While that equals the member's current level and
    Milestone count the Train control warns "Train already used since the last Milestone" (an amber
    mark and the tooltip; the card too) and refuses nothing (decision 14: the system prevents nothing
    anywhere else, and a GM may rule an exception). The next Milestone award makes the record stale by
    comparison; nothing clears it.
  - **114. Retrain and Provision are done by hand.** Each prints its row and one line: Retrain's
    Talent Point is moved by dragging as today and the restrictions are the player's and the GM's to
    honour; Provision's buying and selling, the half price and the uncommon-goods check are the
    table's. The system adds no control for either.
- **The plan is complete.** The four phases of `party-sheet-plan.md` have shipped: phase 1 (0.7.0;
  rulings 91 to 95), phase 2 (0.7.1; 96 to 100), phase 3 and its second cut (0.7.2 and 0.7.3; 101
  to 110, with 111 in 0.7.4 from the road roll's question) and phase 4 (this release; 112 to 114).
  Each of the plan's sixteen decisions was built to the panel's recommendation by the phase that
  met it, decision 14 (warn, never refuse) by this one, and every one stays Mike's to overrule;
  `CLAUDE.md` lists them. Of its twelve handbook sentences, none is in an edition: items 4, 5, 6 and
  9 and decision 9's strike are in the on-the-road proposal, item 11 is in this release's downtime
  proposal, items 1, 2, 3, 7, 8 and 12 bear on phase 1 and are wanted, not needed, and item 10
  (shared loot and a common purse) is optional for phase 2 (decision 16). Nothing in the four phases
  is enforced: the Deferred count is a reminder with a number on it, a Talent drag is as unpoliced
  as before, the loot values nothing, the Travel Speed moves no token, the Fatigued gate locks a
  select and refuses a pick and nothing else, Begin the encounter rolls nothing, a road roll is kept
  as Initiative only while the GM leaves its box ticked, the days are a number, and Train warns.
- **The system runs ahead of the book on one clause, and says so here.** Table 96's Train row
  reads "You may benefit from Train only once between Milestones."; the system counts that for each
  character (the record is the member's, compared with the member's own level and Milestone count),
  which is what the plan's handbook item 11 asks the book to say.
  `Starwrought_Players_Handbook_v4.15_downtime_proposal.docx`, written by `assets/phb_propose.py`
  (`PROPOSALS["downtime"]`, from 4.15) as a Word tracked change under the author Claude, changes
  that cell alone: "only once between Milestones." to "only once between one Milestone and the
  next, counted for each character." A proposal is not an edition: the drift check ignores the name,
  `data/SYNC.json` is untouched because no edition changed, and the sync follows once Mike accepts
  into a numbered handbook. `Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx` stands
  beside it as 0.7.2 left it.
- **What phase 4 does not do.** Nothing counts the days: no clock, no calendar, no per-member day
  counters (the judge struck them), and nothing refuses an Activity for want of days. Train refuses
  nothing, a second time or a tenth: the warning is amber, a tooltip and a line on the card, and the
  GM's exception needs no override. There is no "already Flared this session" warning, which would
  need a history the system does not keep (struck). Retrain moves no Talent, since the drag is the
  move and the restrictions are a judgement about the character's sky; Provision buys and sells
  nothing, since the loot values nothing (ruling 96) and the uncommon-goods Threshold is the GM's.
  Nothing is enforced that the book leaves to the table.
- **No GM connected is needed for a Train.** The Flare and the flag are writes to the member's own
  Actor, which its owner may make, so a Train travels no socket, as an Activity pick does; the Days
  field is the GM's own write. Take and Give to the party still go to the active GM's client as
  0.7.1 left them.
- **What the pipeline touched.** Nothing: no roster row, pack document, compendium page or web app
  table moves. The three Downtime Activities already ship in the pack's Downtime Mode folder from
  the roster's `downtimeActions` block and are read as they are; `build_all.mjs` is run for the
  drift check and the version stamps alone.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list. `Starwrought_Players_Handbook_v4.16.docx` is on the shelf, untracked and unsynced, as the
  0.7.2 entry says, and `build_all.mjs` reports the drift until that sync, which is a later
  release's.

---

## 0.7.4 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved in the book, so `data/SYNC.json` is
untouched. One rule moved in the system, on Mike's word. The 0.7.3 entry asked whether an
Initiative rolled with Stealth should take Load Strain as a Stealth check does; the answer (Mike,
2026-10-02): "Yes - ALL active modifiers for any roll should be applied even if that roll is used
for initiative." A patch bump; nothing stored changes, so no migration.

### Changed

- **An Initiative rolled with a Constellation carries every modifier that Constellation's check
  does** (ruling 111). `SwCheck`'s Initiative assembly for a Skill or Combat Style slug is now the
  check assembly for that slug (Attribute, Proficiency, the sheet's check adjustment, Frightened,
  and Load Strain where the check takes it: Stealth) with Initiative's own terms on top (the
  sheet's Initiative adjustment, the helm's penalty, the Combatant's typed modifiers). Through
  0.7.3 a Stealth Initiative took neither the check adjustment nor Load Strain, so a fighter in
  plate Avoiding Notice rolled a worse Stealth check than Stealth Initiative. The default Awareness
  Initiative is unchanged: it was already the Awareness check (the Defense's own modifiers, the
  helm among them) plus the Initiative adjustment. Every Initiative reader follows, since all of
  them ask the engine: the tracker's formula (`_getInitiativeFormula`), the check dialog
  (`rollInitiativeWithCheck`, the sheet's Roll Initiative, the grid's cell) and a kept road roll
  (`beginEncounter`, whose re-count of the die now lands where a fresh die with the same face
  would, Load Strain included).
- **The kept-roll card and the Begin dialog** no longer say that Load Strain comes off: the terms
  Initiative adds to a check are the helm where the check lacked it, the Scouts' bonus and the
  sheet's Initiative adjustment, and the strings name those three.
- The version stamps read 0.7.4 in all three places.

### Notes

- **Ruling 111** (Mike, 2026-10-02): "ALL active modifiers for any roll should be applied even if
  that roll is used for initiative." An Initiative rolled with a Constellation is a check in that
  Constellation and carries everything the check carries; Initiative's own terms go on top. The
  0.7.3 Notes' question is closed by it.
- Phase 4 of the Party Sheet (Downtime) takes the next number, 0.7.5. `Starwrought_Players_Handbook_v4.16.docx`
  is still on the shelf, untracked and unsynced; `build_all.mjs` reports the drift until that
  sync.

---

## 0.7.3 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.7.2 left them. The release is the second cut of phase 3 of
the Party Sheet, built from what Mike saw on the On the road tab after 0.7.2 (with a screenshot:
"in On the Road, the result of the rolls should be displayed. For example, I rolled Stealth for
Avoid Notice. Also, when the GM Begins the Encounter, they should be able to check a box or
something to use that roll."): a member's Activity roll, once made, is remembered on the character
and shown on their row as a chip, Say the plan prints it, and Begin the encounter asks the GM, one
checkbox per member whose remembered roll is in the Constellation their Activity rolls for
Initiative, whether to keep it as the Initiative roll, writing the total plus Initiative's own terms
onto the Combatant rather than having the die thrown twice. One new field
(`system.exploration.roll` on the character) with a default, so no world migration; no data moves,
so a patch bump to 0.7.3. The decisions are rulings 108 to 110, continuing the 0.7.2 entry's
numbering (see Notes). `Starwrought_Players_Handbook_v4.16.docx` is still on the shelf as this
ships, untracked and not synced here, as the 0.7.2 entry says; `build_all.mjs` reports the drift
until it is, and that sync is a later release's.

### Added

- **The remembered road roll** (ruling 108). `system.exploration.roll { slug, total, natural, time }`
  on `SwCharacterData`, defaults "" / null / null / null: the member's most recent check in the
  Constellation their Activity rolls now, wherever it was rolled (the road row's Roll, an Ask
  everyone card, a Skills grid cell, the character sheet's own Skill roll). It is recorded on the
  roller's own client from the `starwrought.check` hook (`rememberActivityRoll` in
  `module/helpers/party.mjs`, registered once at ready by `registerRoadHooks`, beside the
  Activities-cache invalidation), and only when the roller is a character the current user owns,
  the result's kind is "check", its Constellation is the one the Activity rolls now
  (`activityCheckSlug`: the Item's `check` slug, or the member's own pick for Investigate) and the
  result has a numeric total and its card was public (a blind or whispered roll is not written,
  since the chip is public, ruling 110). An Initiative or Attack roll is never recorded, nor a
  Defense rolled in answer to an Attack (the engine's kind "defense"), nor a check in another
  Constellation; a Defense rolled for its own sake arrives as a check from every entry point, which
  is how a Search's Awareness is remembered; and the attack flow's blind roller (`postCard: false`)
  never reaches the hook, which keeps its meaning of "a card was posted". The write carries
  `swAnnounced`, so no Adjusted card, and posts nothing of its own: the roll's card is the record
  of the die, and the field is a pointer to it with the total and the natural die on it (ruling
  110). `setActivity` clears it in the same update whenever the Activity or the Constellation
  changes, because a Search is not an Avoid Notice; otherwise it stands until a newer roll in the
  same Constellation replaces it, and Begin the encounter leaves it in place.
- **The chip on the row.** After the Initiative tag and before the Combatant chip, when a roll is
  remembered and its Constellation is still the one the Activity rolls now (`roadRoll`; a roll in a
  Constellation the Activity no longer rolls is stale and shown as nothing): a die, the
  Constellation and the total ("Stealth 17"), with the die and the time on hover ("Wren rolled
  Stealth 17 (d20 12) 3 minutes ago; it stands as the Initiative roll when the encounter begins,
  unless the GM unticks it", or, when the Activity rolls another Constellation for Initiative,
  "...; Initiative rolls Awareness instead"). The chip takes the Initiative tag's colour while the
  roll is usable for Initiative (its Constellation is the one `initiativeFor` names) and is dimmed
  when it is not; the time is "just now" under a minute, then "a minute ago" or "{n} minutes ago",
  "an hour ago" or "{n} hours ago", and "a day ago" or "{n} days ago". With the eight shipping rows every
  Activity that rolls now rolls the same Constellation for Initiative (Search Awareness, Look
  Harmless Guile, Avoid Notice Stealth, Investigate the pick), so the dim chip waits on a row whose
  two columns differ. Every client that can read the character sees it, as it sees the pick
  (ruling 110). The row's order is otherwise unchanged.
- **Say the plan prints it.** A member's line ends " Rolled Stealth 17 on the road." while a roll
  is remembered, and says nothing more when the roll is usable for Initiative: the Begin dialog is
  where that is asked.
- **Begin the encounter can keep a road roll as Initiative** (ruling 109). Before anything is
  written, Begin gathers the present members (a token on the viewed scene) whose remembered roll is
  in the Constellation their Activity rolls for Initiative and whose Combatant on the scene's
  unstarted Combat, if there is one, has not rolled (`keepableRolls`; no Combat or no Combatant
  counts as not rolled). When there are none, Begin runs as 0.7.2 built it, with no dialog.
  Otherwise a dialog (`DialogV2` under the party's dialog classes, so the 0.7.2 checkbox fix draws
  its boxes as glyphs) with an intro line and one checkbox per such member, ticked by default
  ("Keep Wren's Stealth 17 as Initiative"), and Begin and Cancel; Cancel writes nothing. Then
  `beginEncounter(party, { keep })`, `keep` the ticked members' uuids. The Combat, the Combatants
  and the two flags are written exactly as before; then, for each kept member whose roll is still
  usable and whose Combatants have no Initiative, the Initiative is the same die re-counted as an
  Initiative: the natural die plus the check engine's Initiative assembly for that Constellation
  (`SwCheck.previewTotal` with `kind: "initiative"`, static and pure) with the Combatant's
  modifiers and the typed extras the check itself carried (the dialog's situational entry, kept on
  the record as `exploration.roll.modifiers`) resolved in one typed-stacking pass, so a +2
  Situation entered for the Stealth check and a Scout's +1 Situation stack as the rule says,
  highest only. Against the check's own total that means the helm's penalty where the check did
  not carry it (an Awareness check does), the sheet's Initiative adjustment in place of its check
  adjustment, the Scouts' +1, and Load Strain coming off a Stealth check, since the engine's
  Initiative never takes it (the fresh die would not either; whether it should is a question for
  the book, see Notes). That number is written onto each of the member's unrolled Combatants with
  `combat.setInitiative`, so the tracker, the row's Combatant chip and the grid's Initiative cell
  read it as they read any rolled Initiative. The card's line for a kept member replaces "rolls
  Stealth for Initiative": "Wren keeps the Stealth 17 rolled on the road as Initiative." or, when
  the terms move it, "Wren keeps the Stealth 17 rolled on the road as Initiative, +1 for
  Initiative's own terms in place of the check's (the helm, the Scouts' bonus, the sheet's
  adjustment; Load Strain comes off, since Initiative never takes it): 18.", the delta signed;
  the Scout's Step line and the Defender's shield line follow as they do. An unticked member rolls
  fresh as before, a kept member has rolled as far as a second Begin is concerned and is left alone
  and named, and the remembered roll stays on the character afterwards. Nothing else about Begin
  changes.

### Changed

- **`setActivity` clears the remembered roll** in the same update when the Activity or the
  Constellation changes, so a chip never outlives the pick it was rolled for.
- **`beginEncounter(party, { keep = [] } = {})`** takes the uuids of the members whose road roll
  is kept; called with none it does what 0.7.2's did. `sayThePlan` appends the remembered roll to a
  member's line. The party sheet's `beginEncounter` action opens the keep dialog first when
  `keepableRolls` finds anyone, and calls straight through when it does not.
- **The party sheet's road rows** carry the member's remembered roll, shaped for the template with
  the name, the total, the die, the relative time, whether it is usable and the hover text; the
  road part redraws on the member's `updateActor` as it has since 0.7.2, so the chip appears as the
  roll's card lands.
- **`registerRoadHooks`** in `module/helpers/party.mjs` is called once from `starwrought.mjs` at
  ready and registers the one `starwrought.check` listener; nothing else listens for the record.
- The version stamps read 0.7.3 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: `system.exploration.roll`
  on a character defaults to nothing remembered.

### Notes

- **The rulings, 108 to 110**, Mike's two sentences on the On the road tab after 0.7.2, numbered
  on from the 0.7.2 entry's 107.
  - **108. The Activity's roll is remembered on the character.** `system.exploration.roll
    { slug, total, natural, time }` on `SwCharacterData` (defaults "" / null / null / null; no
    migration): the member's most recent check in the Constellation their Activity rolls now,
    wherever it was rolled (the road row's Roll, an Ask everyone card, the Skills grid, the
    character sheet), recorded on the roller's own client from the `starwrought.check` hook when the
    result's kind is "check" and its Constellation is the Activity's check-now Constellation (or
    the member's own pick for Investigate) and its card was public. An Initiative or Attack roll is
    never recorded, nor a Defense rolled in answer to an Attack, nor a check in another
    Constellation; a Defense rolled for its own sake, as a Search's Awareness is, arrives as a check
    and is. `setActivity` clears it when the Activity or the pick
    changes, because a Search is not an Avoid Notice. The row shows it as a chip ("Stealth 17", the
    die and when it was rolled on hover), Say the plan prints it, and it stands until the pick
    changes or a newer roll replaces it. The record is a convenience the GM reads; nothing computes
    with it except ruling 109.
  - **109. Begin the encounter can keep a road roll as the Initiative roll.** The book says a
    character "can roll" their Activity's Constellation when the encounter begins; a roll already
    made in that Constellation on the road is that roll. When a present member's remembered roll is
    in the Constellation their Activity rolls for Initiative and their Combatant has not rolled,
    Begin the encounter asks the GM, one checkbox per such member, ticked by default: "Keep Mike's
    Stealth 17 as Initiative". A kept roll's Initiative is the same die re-counted as an Initiative
    by the check engine: the natural die plus the Initiative assembly for that Constellation
    (`SwCheck.previewTotal`, `kind: "initiative"`) with the Combatant's modifiers and the typed
    extras the check carried, resolved together so same-type bonuses stack as the rule says. Against
    the check's total that is the helm's penalty where the check lacked it, the sheet's Initiative
    adjustment in place of its check adjustment, the Scouts' +1, and Load Strain coming off a
    Stealth check, since the engine's Initiative never takes it. The Combatant's flags are written
    as for anyone, its Initiative is set with `setInitiative`, and the card says so: "Mike keeps the
    Stealth 17 rolled on the road as Initiative." or, when the terms move it, "... as Initiative, +1
    for Initiative's own terms in place of the check's (the helm, the Scouts' bonus, the sheet's
    adjustment; Load Strain comes off, since Initiative never takes it): 18." An unticked member
    rolls fresh as before. No dialog when nobody has a roll to keep. The remembered roll is left in
    place afterwards.
  - **110. The remembered roll is the character's and public.** It is written by the roller (an
    owner writes their own Actor; the GM may roll for anyone) and read by every client that can read
    the character, as the pick is; the card the roll posted is the record of the die, and the chip
    is a pointer to it.
- **What this does not do.** The record is a convenience the GM reads: nothing computes with it
  but a kept Initiative, and that only while the GM leaves the member's box ticked. Begin still
  rolls nothing: a kept total is a number already rolled in public, carried over with Initiative's
  own terms, and the card names both. Nothing is enforced: an unticked member rolls fresh, a roll
  in a Constellation the Activity does not roll now is never remembered (Stealth while Searching
  gets no chip, because Search rolls Awareness), and the GM may still roll any Initiative from the
  tracker over a chip. No adversary Threshold is shown anywhere in it, no token moves, and no card
  is posted for the record itself: the chip points at the card the roll already posted (ruling 110).
- **Where the book stands.** The Avoid Notice row (data since 0.7.2, ruling 103) and P342 say that
  when an encounter begins the character "can roll" the Activity's Constellation; ruling 109 reads
  a roll already made on the road in that Constellation as that roll rather than a second die. No
  new sentence is proposed: `Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx` stands
  as 0.7.2 left it, so the system runs ahead of PHB v4.15 on the same four sentences and a strike
  and no more.
- **No GM connected is needed for the record.** The roll is written to the roller's own Actor by
  the roller's client (an owner may write their own Actor; the GM may roll for anyone and writes
  the same way), so it travels no socket; the keep dialog and the kept Initiative are the GM's own
  writes, as Begin's always were.
- **Phase 4** (Downtime: the days, Train through the shared Flare picker with its
  once-between-Milestones warning, the Retrain and Provision reminder lines) stands as the plan
  wrote it and takes the next number, 0.7.4, since this release took 0.7.3; `CLAUDE.md` names it
  under Known outstanding work.
- **A question for the book: does an Initiative rolled with Stealth take Load Strain?** The
  engine's Initiative assembly has never carried Load Strain, whichever Constellation is rolled,
  while a Stealth check always does (PHB v4.13, Load Strain: "Climb, Swim, and Stealth checks take
  it as a penalty"). A kept Avoid Notice roll follows the engine, so a Stealth 15 rolled at Load
  Strain 2 is kept as Initiative 17, and the card says Load Strain came off. If an Initiative
  rolled with Stealth is a Stealth check in the book's sense, the fix is one branch in `SwCheck`'s
  Initiative assembly and the kept roll follows it for free; until Mike says, the fresh die and
  the kept die agree with each other.
- **What the pipeline touched.** No data moves: no roster row, pack document, compendium page or
  web app table, so the spreadsheets, `assets/roster.json`, `packs/_source/` and the built HTML
  stand as 0.7.2 left them; `build_all.mjs` is run for the drift check and the version stamps
  alone.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list. `Starwrought_Players_Handbook_v4.16.docx` is on the shelf, untracked and unsynced, as the
  0.7.2 entry says, and `build_all.mjs` reports the drift until that sync, which is a later
  release's.

---

## 0.7.2 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.7.1 left them. The release is phase 3 of the Party Sheet,
built from parts 8 and 9 of `party-sheet-plan.md` (Mike, on phase 2: "Mostly good! The checkbox
here looks odd. Fix that, and go to phase 3!"): the On the road tab, where each member picks an
Exploration Activity and the party reads its Travel Speed off the slowest of them; the Fatigued
gate; Say the plan; and Begin the encounter, which puts the members into a Combat on the viewed
scene with Initiative by Activity written on their Combatants, so every Initiative roll in the
system rolls what the Activity names. The Actor type exists since 0.7.0 and this adds a tab, a
handful of fields and a pipeline change, so a patch bump to 0.7.2; every new field
(`system.exploration` on the character, `system.travel.terrain` on the party, `system.exploration`
on an action Item) has a default, so no world migration. Unlike the two releases before it, this one
touches the data: two positional columns on the roster's hand-kept `explorationActions` rows and an
eighth row, Avoid Notice, so `assets/roster.json`, `packs/_source/` and the compendium docx move
(the web app's Exploration table keeps its three columns and gains the Avoid Notice row). The
system runs ahead of the book
on four sentences and a strike, carried as tracked changes in
`Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx` for Mike to accept or reject (see
Notes). The decisions are rulings 101 to 107, continuing the 0.7.1 entry's numbering.
`Starwrought_Players_Handbook_v4.16.docx` is on the shelf as this ships, untracked, open in Word
with its cover still reading v4.15 and a Persistent Damage rewrite half-written; it is not synced
here, `build_all.mjs` reports the drift until it is, and that sync is the next release's.

### Added

- **The Exploration Activity, on the character** (plan, part 8; ruling 106). `system.exploration
  { activity, constellation }` on `SwCharacterData`: `activity` is the compendium `_id` of the
  Activity Item in the Actions pack's Exploration Mode folder, with "" meaning Travel, the default;
  `constellation` is a slug, Investigate's chosen Lore or Skill, and "" otherwise. The pick is the
  character's: it is written directly by the owner or the GM (`setActivity` in
  `module/helpers/party.mjs`, which checks Owner permission first; an owner may write their own
  Actor, so unlike a Take it needs no relay and no GM connected), with `swAnnounced` so the Adjusted
  card never doubles it, and announced as one line spoken by the member: "Wren's Activity is now
  Search (Half)." or, when only the Constellation changed, "Toric Investigates with Lore
  (Warfare)." A Fatigued member's pick of anything but Travel is refused with a notice before
  anything is written (ruling 101).
- **The Activity data, through the pipeline** (plan, part 8 and decision 11; rulings 103 and 104).
  Every row of the roster's hand-kept `explorationActions` block gains two positional columns, the
  description column untouched: column 4 is the Constellation the Activity rolls now ("" for none,
  a Constellation name as the trees print it, or `choice` for the member's own pick), column 5 the
  Constellation it rolls for Initiative ("" for Awareness, the default; a name; or `choice`).
  Travel "", ""; Hustle "", "Athletics"; Search "Awareness", ""; Scout "", ""; Defend "", "";
  Investigate "choice", "choice"; Look Harmless "Guile", "Guile"; and a new eighth row, **Avoid
  Notice** (Half; "You move quietly and keep to cover. Roll Stealth; the GM applies it to the
  Awareness Threshold of anyone who might notice you. When an encounter begins, you can roll
  Stealth."; "Stealth", "Stealth"), which P342 names and the Example of Play rolls while Table 95
  has no row for it (ruling 103). `build_foundry.mjs` writes the columns onto the Activity Item as
  `system.exploration { travel, check, initiative, effect }`: `travel` is the Speed word lowercased
  ("full", "half" or "double", an error on anything else); `check` and `initiative` are the slug of
  the named Constellation, resolved against the trees and the four Defenses with an error on a
  name that is neither, `choice` and "" carried as they are; `effect` is "scout" or "defend" by
  the row's name and "" for the rest, because the Scout's bonus and Step and the Defender's shield
  are not Constellations but things Begin the encounter does, so a row Mike adds later needs no
  code unless it does something new. A row that names a check-now Constellation also gets
  `system.check { enabled: true, constellation }`, so Search's Roll rolls Awareness. The document
  key stays `exploration:<slug>`, so the seven existing ids do not move and Avoid Notice is the one
  new document (the pack's `source: "STARWROUGHT Playtest v4.10"` on these rows is left as it
  prints). `SwActionData` carries the matching schema, blank on every other action, and derives
  `exploration.multiplier` and `isExploration`; the web app's two `tbl(...)` calls slice the rows
  to three columns, so its Exploration table changes by the Avoid Notice row alone; `build_phb.js` and `phb_format.py`
  read the rows by position and needed no change, so the compendium docx changes by the new row
  alone.
- **The On the road tab** (plan, part 8; rulings 101, 102, 106 and 107). A third tab on the party
  sheet, after Skills and before Loot, visible to players. The top line is the party's **Travel
  Speed** (`partyTravel` in `helpers/party.mjs`): each member's Speed (`system.moveSpeed`, so a
  Speed adjustment counts) times their Activity's multiplier (Full 1, Half ½, Double 2;
  `SW.ACTIVITY_SPEEDS`), the lowest of those times the terrain (`SW.TERRAIN`: normal 1, Difficult
  ½, Greater Difficult ⅓; PHB P343 to P344), through the book's three formulae in `SW.TRAVEL` (feet
  a minute × 40, rounded; miles an hour ÷ 2, floored as the character's own figure is; miles a day
  × 4, rounded): "120 feet a minute · 1 mile an hour · 12 miles a day", with "Wren sets the pace
  (Search, Half)" naming the pacesetter (the lowest effective Speed; the first on ties), the
  ten-minutes-per-location note while anyone Searches (P346), and the terrain as a select for the
  GM (`system.travel.terrain`, the party's one new field) and a word for a player. Display only
  (ruling 102): nothing moves a token, and a party with no members prints blanks and zeros. Below
  it, for the GM, **Say the plan** and **Begin the encounter**, neither asking a confirm; Begin is
  dimmed with a tooltip while no scene is viewed. Then one row per member: portrait, name, the
  Activity select (the Actions pack's Exploration Mode folder through `explorationActivities`,
  folder order then name, cached per session as the Basic Maneuvers are; a world action Item of the
  same name and category replaces the printed one), the Travel word, the Initiative Constellation
  the pick implies (Awareness, Stealth, Athletics, or Investigate's pick), the Constellation select
  for Investigate (the member's opened Constellations plus their Lores), the warnings in small
  amber type, the Roll button when the Activity rolls now, and the member's Combatant state while
  a Combat holds them (the number once rolled; "ready: Stealth" when flagged and not yet rolled).
  **The warnings** (`activityWarnings`) are read from live data and never enforced (ruling 107):
  Look Harmless with a held weapon whose reach is above 0, named, or worn armor whose Load totals
  more than 1, with the total (the Activity's Requirements); Investigate with no Constellation
  chosen; a `choice` Initiative with no pick, which falls back to Awareness. **The Roll button**
  (owner or GM) rolls the check-now Constellation as the member with no Threshold through the path
  Ask everyone uses, a Defense slug as the Defense check and a Skill as a check, so Search posts
  the ordinary card for the GM to apply; Investigate opens the Relevant Check picker
  (`rollRelevantCheck({ dialog: true, slug })`) on the chosen Constellation. **The Fatigued gate**
  (ruling 101): while a member's Fatigued is above 0 their select is locked to Travel with the
  reason as its tooltip ("Hrolda is Fatigued 2 and can only Travel"), `activityOf` resolves them
  to Travel for the speed line and the cards, and the stored pick is left as it was, so it comes
  back the moment the Fatigue ends (ten minutes' rest, ruling 81). A player's own rows are live and
  the others read-only (ruling 106); every control a player may use is an anchor with a
  `data-action`, since DocumentSheetV2 disables form elements for an Observer, so a player's row
  carries the Activity and the Constellation as anchors that open a small picker dialog (the
  Activity select, and the Constellation select shown only while the chosen Activity asks for
  one), and Set writes the pick. The GM gets working selects on every member.
- **Say the plan** (GM only; the plan's risk 12). One public card spoken by the party: a line per
  member, "Wren: Search (Half); Initiative: Awareness" or "Toric: Investigate (Half), with Lore
  (Warfare); Initiative: Lore (Warfare)", with that member's warnings in a dim line beneath, then
  the speed line, "The party moves at 120 feet a minute, 1 mile an hour, 12 miles a day over
  Difficult terrain: Wren sets the pace (Search, Half).", and the ten-minutes line while anyone
  Searches. A pick posts one line and Say the plan is the record; if the one line proves too many
  at the table, the pick goes quiet and this card stands alone.
- **Begin the encounter** (plan, part 9; ruling 105). GM only. The viewed scene must exist (a
  notice otherwise). The Combat is an unstarted one on that scene, reused, or a new active one
  created on it. For each member, every token of theirs on the scene (matched by Actor id, linked
  or not) becomes a Combatant, one per token as the tracker does, an existing Combatant reused; a
  member with no token there is named in the card's "no token" line and skipped. Then on every
  member Combatant two flags: `flags.starwrought.initiativeConstellation`, the Activity's
  Initiative Constellation ("" reads Awareness; `choice` reads the member's
  `system.exploration.constellation`, or Awareness with a note when none is chosen), and
  `flags.starwrought.initiativeModifiers`, one entry per other member present whose Activity has
  the effect scout, `{ label: "Scout (Hrolda)", value: 1, type: "situation" }`
  (`SW.SCOUT_INITIATIVE_BONUS`; two Scouts give each other one and everyone else two of the same
  type, of which one applies, as the book's stacking rule says; a member with no Scout gets an
  empty list). Present means with a token on the scene: a Scout the card names in its "no token"
  line gives no bonus, and an absent Defender's shield is not raised, since whoever is not in the
  encounter was not travelling with it. A Combatant that already carries an Initiative value is left alone, its flags not
  rewritten, and named in the card. For every member whose Activity has the effect defend, the
  held shield (`actor.system.shield`, else the held shield Item) is written `system.raised` true
  with `swAnnounced`, no action spent and no card of its own, since the Raise a Shield card would
  print a cost; `combat.mjs` lowers it at the Defender's next Opportunity as it lowers any raised
  shield, which is the book's "begins Raised". Then one public card spoken by the party: "The
  encounter begins.", a line per member ("Wren (Avoid Notice) rolls Stealth for Initiative, +1
  Situation from Hrolda."), "Hrolda may Step ⓿ on rolling Initiative." for a Scout, for Look
  Harmless the GM's comparison line with the Activity's four degrees printed from the Item's
  description, to be applied by hand against each enemy's Awareness Threshold (adversary Thresholds
  never reach a player), and, in the card's notes, for an Investigator "Toric rolls for Investigate
  only if the encounter is related to it: the GM's call, before the die." Nothing rolls here:
  players roll their own from the tracker or the sheet, the GM rolls for the absent, and both read
  the flags.
- **Initiative by Activity, everywhere a die is rolled** (ruling 105; the plan's risk 10 closed).
  `SwCombatant._getInitiativeFormula` adds the sum of the Combatant's `initiativeModifiers` to the
  formula, one per type at most (the highest bonus and the worst penalty of each type, as `SwCheck`
  assembles them; with every Scout entry +1 Situation that is +1), and a new `initiativeModifiers`
  getter returns the flag or an empty list. `SwCombat.rollInitiativeWithCheck(combatantId, slug =
  null, { modifiers = null } = {})` defaults the slug to `combatant.initiativeConstellation` and
  the modifiers to the Combatant's flag, passes the modifiers to `SwCheck.roll` as typed
  modifiers, and names the Constellation in the card's subtitle. The character sheet's Roll
  Initiative passed `system.initiative.slug` (Awareness) through 0.7.1 and would have overridden
  the flag; it passes the Combatant's `initiativeConstellation` now, and the Skills grid's
  Initiative cell does the same. The tracker's own roll reads both flags through
  `_getInitiativeFormula`, which since this release asks the check engine for the very total the
  dialog would show (the flagged Constellation's terms, the sheet's Initiative adjustment, the helm
  and the modifiers one per type), where it used to swap two Constellation terms by hand and carry
  the Awareness adjustment into a Stealth roll. The "Roll Initiative by Activity" macro goes
  through `rollInitiativeWithCheck` with the Constellation the player nominates, which replaces the
  flagged one and is written back to the flag after the roll, as the tracker's "roll with" always
  has; the Scouts' modifiers still apply to it, since the macro passes none of its own. A flag
  naming a Constellation nobody can roll (a Lore deleted since it was picked) reads as Awareness
  rather than a made-up name at Might +0.
- **The config.** `ACTIVITY_SPEEDS` (full 1, half ½, double 2), `TERRAIN` (normal 1, difficult ½,
  greater ⅓), `EXPLORATION_EFFECTS` (scout, defend), `SCOUT_INITIATIVE_BONUS` (1) and
  `ACTIVITY_CHOICE` ("choice", the token both roster columns use for the member's own pick) join
  `TRAVEL` in `config.mjs`, each label an i18n key.

### Changed

- **`rollRelevantCheck(options)` accepts `options.slug`**, preselecting that Constellation in the
  Relevant Check picker (set on the select when the dialog renders, the template untouched, and
  taken out of the options passed on to the roll so the player's final pick is what rolls);
  Investigate's Roll is the first caller, and the picker is otherwise unchanged.
- **An Initiative roll through the check dialog carries the sheet's Initiative adjustment when it
  rolls Awareness.** `SwCheck`'s Defense branch returned before the Initiative terms were added, so
  the sheet's, the grid's and the party's Awareness Initiative dropped `system.bonuses.initiative`
  while the tracker's formula kept it; the adjustment is added in that branch now (the helm is
  already among Awareness's own modifiers and is not doubled).
- **The Skills grid's Initiative cell shows the number it will roll.** In an encounter it is
  assembled for the Combatant's flagged Constellation with the Scouts' bonus, through the same path
  the roll uses, so a member flagged Stealth at +0 no longer reads the Awareness +2; out of one it
  is the default modifier as before.
- **"1 mile an hour" and "1 mile a day"** on the speed line and the plan card, the plural otherwise.
- **`SwActionData` gains `system.exploration`** `{ travel, check, initiative, effect }`, written by
  `build_foundry.mjs` on the eight Exploration Mode Activities and blank on every other action,
  with `exploration.multiplier` and `isExploration` (category "Exploration Mode") derived.
- **The party sheet redraws its road part** on the member hooks already wired, on the party's own
  update (the terrain), and on the Combat hooks (`createCombat`, `updateCombat`, `deleteCombat`,
  `createCombatant`, `updateCombatant`, `deleteCombatant`), on the same timer of about 150 ms,
  registered in `_onRender` and released in `_onClose` as the member hooks are, so a member's
  Initiative appears on their row as it is rolled.
- **The party sheet's actions** gain `pickActivity`, `pickConstellation`, `activityRoll`,
  `sayThePlan` and `beginEncounter`, each re-checking permission before writing, as the rest do;
  the GM's row selects and the terrain select are handled in `_onChangeForm` and by the party form's
  own submit.
- **Checkboxes draw as Foundry's square glyph** (Mike, on 0.7.1: "The checkbox here looks odd").
  The stylesheet's text-input dress (background, border, radius, shadow, a form label's line
  height) reached `input[type="checkbox"]` and `input[type="radio"]`, which Foundry draws with
  `appearance: none` and a Font Awesome square, so the Ask everyone dialog's "Players see the
  Threshold" stretched into a tall outlined pill; both types are now exempted from it, which also
  straightens the Milestone preview's and the Split dialog's checkboxes.
- The version stamps read 0.7.2 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: `system.exploration` on
  a character defaults to Travel with no Constellation, `system.travel.terrain` on a party to
  normal, and an action Item's `system.exploration` to blank.

### Notes

- **The rulings, 101 to 107**, Mike's answers to the plan's parts 8 and 9 and its decisions 6 to
  11, numbered on from the 0.7.1 entry's 100.
  - 101. **A Fatigued character Travels and does nothing else** (decision 6). The book's Fatigued
    row says "can't use Exploration Mode Activities"; read literally the party cannot move once a
    fighter in plate is winded. The Activity select locks to Travel with the reason while Fatigued
    is above 0; the stored pick is left as it was and comes back when the Fatigue ends (ten
    minutes' rest, ruling 81). The proposal's sentence says so in the book.
  - 102. **The party's Travel Speed is the slowest member's, display only** (decision 7). Each
    member's Speed × their Activity's multiplier (Full 1, Half ½, Double 2); the lowest, × the
    terrain (normal 1, Difficult ½, Greater Difficult ⅓, from P343 and P344), through the book's
    three formulae (feet a minute × 40, miles an hour ÷ 2 floored as the character's own figures
    are, miles a day × 4). Named for the pacesetter. Nothing moves a token; the terrain is a select
    on the party and a word on the card.
  - 103. **Avoid Notice lands as data ahead of the book** (decision 8). P342 names it and the
    Example of Play rolls it, and Table 95 has no row; the roster gains the row ("Half; roll
    Stealth, the GM applies it to the Awareness Threshold of anyone who might notice you; Stealth
    for Initiative"), so it ships in the pack, the web app and the compendium docx now, and the
    proposal adds the row to Table 95 for Mike to accept or strike. Decision 9 rides in the same
    proposal: "Earning a Living" struck from P354 for "Provisioning", a Table 96 Activity, until
    there is an income rule.
  - 104. **The Activity data lives in two positional columns on the roster rows** (decision 11):
    what the Activity rolls now and what it rolls for Initiative, as Constellation names, blank,
    or `choice` for the member's own pick (Investigate). `build_foundry.mjs` writes them as
    `system.exploration { travel, check, initiative, effect }` and `system.check` on the Activity
    Item under its existing id; the compendium docx and the formatter read the rows by position
    and change nothing but the new row; the web app prints three columns. The Scout's bonus and
    Step and the Defender's shield are not Constellations: they are `effect` tags the builder sets
    by the row's name (scout, defend) and the system reads from the Item, so a row Mike adds needs
    no code unless it does something new.
  - 105. **Begin the encounter writes Initiative by Activity onto the Combatants, and every roll
    reads it.** A Combat on the viewed scene (an unstarted one reused), every member's token
    added, `initiativeConstellation` set from the Activity (Awareness when it names none;
    Investigate's pick, or Awareness with a note), `initiativeModifiers` carrying one +1 Situation
    per Scout present for every other member present (two Scouts give each other one and everyone
    else two of the same type, of which one applies, as the book's stacking rule says; a member
    with no token on the scene neither gives nor gets one), a Defender's held shield
    Raised with no action spent, and one card. A Combatant that has already rolled is left alone
    and named. The tracker's roll, `rollInitiativeWithCheck`, the sheet's Roll Initiative (which
    passed Awareness through 0.7.1, plan risk 10) and the grid's cell honour the flags. The
    Scout's Step is announced, not moved; Look Harmless's degrees are printed for the GM to compare
    by hand against each enemy's Awareness Threshold (adversary Thresholds never reach a player);
    whether an Investigation was related is the GM's call before the die (judgement at the edge,
    never in a formula).
  - 106. **The pick is the character's.** `system.exploration` on the character, written by its
    owner or the GM directly (an owner may write their own Actor, so no relay), announced as one
    line spoken by the member; "Say the plan" is the record (risk 12).
  - 107. **An Activity's own roll goes through the member's check.** The row's Roll rolls the
    check-now Constellation as the member with no Threshold (Search and Investigate say the GM
    applies the roll, as Ask everyone's blank Threshold does); Investigate opens the Relevant Check
    picker on the chosen Constellation; Look Harmless's Requirements are a warning read from live
    data (a held weapon with Reach, worn Load above 1), never a refusal.
- **The system runs ahead of the book, and says so here.** Four handbook sentences (the party's
  Travel Speed after P344; the Fatigued row; Initiative when Activities differ, appended to P323;
  the Avoid Notice row in Table 95) and the P354 strike of "Earning a Living" for "Provisioning"
  (decision 9) are in
  `Starwrought_Players_Handbook_v4.15_on-the-road_proposal.docx`, written by `assets/phb_propose.py`
  (`PROPOSALS["on-the-road"]`, from 4.15) as Word tracked changes under the author Claude, for Mike
  to accept or reject. A proposal is not an edition: the drift check ignores the name,
  `data/SYNC.json` is untouched because no edition changed, and the system runs ahead of the book
  on all five until Mike accepts into a numbered handbook, at which point the sync follows as the
  handbook rule says.
- **What phase 3 does not do.** Nothing moves a token: the Travel Speed is a line, the terrain a
  word, and the Scout's Step is announced and not taken. Nothing is enforced that the book leaves
  to the table: the Fatigued gate locks a select and refuses a pick, and that is the whole of it;
  Look Harmless's Requirements warn and never refuse; Look Harmless is compared by the GM by hand
  against each enemy's Awareness Threshold, and whether an Investigation was related is the GM's
  call before the die, because a judgement inside a formula cannot be automated. Begin the
  encounter rolls nothing and shows no adversary Threshold. No party token on any map. Phase 4
  (Downtime: the days, Train through the shared Flare picker with its once-between-Milestones
  warning, the Retrain and Provision reminder lines; 0.7.3) stands as the plan wrote it;
  `CLAUDE.md` names it under Known outstanding work.
- **No GM connected is needed for a pick.** A member's Activity is a write to the member's own
  Actor, which its owner may make, so the pick travels no socket; Say the plan and Begin the
  encounter are the GM's own writes. Take and Give to the party still go to the active GM's client
  as 0.7.1 left them.
- **What the pipeline touched.** `assets/roster.json` (the two columns and the Avoid Notice row);
  `packs/_source/actions/`, where the seven Exploration Mode documents gain `system.exploration`
  under their old ids, Search and Look Harmless gain `system.check` as well, and Avoid Notice is
  new with both; the compendium docx (the Avoid Notice row); and the built web app, whose
  Exploration table gains the Avoid Notice row and nothing else, the slice holding it to three
  columns. The spreadsheets are untouched: the
  Exploration Activities are a hand-kept roster block (decision 11), and move to a
  `data/maneuvers.xlsx` sheet whenever the Maneuver rows are being enabled anyway.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list.

---

## 0.7.1 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.7.0 left them. The release is phase 2 of the Party Sheet,
built from parts 6 and 7 of `party-sheet-plan.md` (Mike, on phase 1: "looks good! let's go for the
next phase"): the Loot tab, where the GM stashes what the party found and a player takes it onto
their own character, or gives their own gear to the party, over a relay to the active GM's client;
the party's purse, with Split among the party; and Ask everyone on the Skills grid, one card with a
Roll button per member. The Actor type exists since 0.7.0 and this adds a tab and a relay, so a
patch bump to 0.7.1; the one new field (`system.currency` on the party) has a default, so no world
migration. The decisions are rulings 96 to 100, continuing the 0.7.0 entry's numbering (see Notes).

### Added

- **The Loot tab** (plan, part 6; ruling 96). A party now holds embedded Items, of the four
  physical types alone (weapon, armor, shield and gear, `SW.PHYSICAL_TYPES`; anything else is
  refused at creation, see Changed), and the Loot tab lists them one to a row: image, name,
  quantity, the price string the Item carries, a type tag, and the controls that belong to whoever
  is looking. Items arrive by drop from the Equipment compendium, the Items sidebar or a character
  sheet; the GM's drop from a character copies, as Foundry does, and a drop of a Talent or a
  Maneuver is refused with a notice. For the GM the quantity is an input, **Give to** opens a
  member picker and moves the Item onto that member (it arrives carried and leaves the party), and
  **Delete** removes it; the GM's own drops, edits and deletes post nothing. A player who owns a
  member sees the same rows with **Take** on each, which asks which member when they own two and
  how many when the stack is above one. An empty tab says so. Carry state means nothing on a party
  (nothing is held or worn by one), so it is ignored there, and every Item that reaches a character
  through Take or Give arrives with `system.state` "carried": drawing it is an Interact, as the book
  prices it. The row prints the price the Item carries and nothing computes with it: the book has
  no shared loot and no party purse (coin is per character; the only price rule is Provision's half
  price), so the tab is a convenience that moves Items and coin and values nothing.
- **Take and Give, over the relay** (ruling 97; the plan's risks 5 and 6). A Take is two writes a
  player cannot make alone, a create on their character and a decrement on a party they only
  Observe, so the whole move runs on the active GM's client, asked over the system socket exactly
  as a player's damage Apply, a reroll against a hidden Threshold and an Expose on another's body
  have travelled since 0.5.3. The asking client (`requestTake` and `requestGive` in
  `module/documents/party-socket.mjs`) emits `party:take` or `party:give` with the party's uuid,
  the Item's id, the character's uuid and the count, addressed to `game.users.activeGM` alone, and
  says it was sent; the GM's own Take or Give runs the same code locally, with no socket. The GM's
  client (`onPartySocket`) ignores a message not addressed to it, acts only for a sender the server
  stamped, re-reads the party, the Item and the character from their ids, and trusts the payload
  for nothing but those ids and the count. It checks that the asker owns the destination character
  for a Take or the source character for a Give, that the character is a member of that party, that
  the Item is physical and that the count is in stock; creates on the destination first (a copy of
  the Item's source data with `system.quantity` set to the moved count, and `system.state`
  "carried" when the destination is a character) and decrements or deletes the source second, so a
  failure between the two leaves a duplicate and never a loss; posts the card; and answers
  `party:done` or `party:refused` (gone, not enough, not yours, no member, not physical) to the
  asker alone, shown as a notice. Requests are served in arrival order on the GM's client (a
  promise chain, as `SwActor`'s condition writes are), so two players taking the last potion within
  a second resolve as one Take and one refusal. With no GM connected the Take and Give controls say
  so and write nothing. The drops go the same way (ruling 98): a party Item dragged onto a
  character sheet is a Take of the whole stack rather than Foundry's silent copy, whoever drags it,
  and a player's drag of one of their own Items onto the party sheet is a Give of the whole stack;
  the Loot tab's Take button is where a count is asked. A player's drop from the compendium or the
  sidebar onto the party is the GM's alone and is refused with a notice. Public cards spoken by the
  member, under a title that names the direction ("From the party's loot", "To the party's loot"):
  "Hrolda takes Longsword."; "Wren takes 6 × Arrows (14 left)."; "Hrolda gives 3 × Torch." (the
  Item's name as it is, since the system cannot pluralise one); and for the GM's Give to, "Toric is
  given a Dagger."
- **The purse and Split** (ruling 99). `system.currency { gp, sp, cp }` on the party, the same
  shape as a character's coin so the template idiom carries over: inputs for the GM, read-only
  numbers for a player. **Split among the party** opens a dialog listing every member ticked, then
  `splitPurse`: the coin goes to copper, is divided equally among the ticked members in one
  `Actor.updateDocuments` batch written with `swAnnounced` (so the Adjusted card never doubles it),
  and the remainder is written back to the purse; one card spoken by the party lists each share and
  what stayed.
- **Ask everyone** (plan, part 7; ruling 100). On each row header of the Skills grid the GM has an
  Ask everyone control: a small dialog with an optional Threshold and a checkbox, "players see the
  Threshold", then `askEveryone` posts one public card spoken by the party ("Everyone roll
  Awareness.") with a row per member and a Roll button on each, live only for that member's owner
  and the GM (the render pass that already hides other owners' buttons by `data-owner-uuid` hides
  these too). The button (`rollAskedCheck` in `helpers/party.mjs`) calls the member's own
  `rollCheck` for a Skill or a Lore and `rollDefense` for a Defense, so the card speaks as the
  member and can Flare, with the Threshold prefilled only when the card carries one; a Threshold
  the GM kept hidden is never in the DOM and never in a flag a player can read. Search and
  Investigate say the GM applies the roll to the Thresholds, so a blank Threshold is the normal
  case and the GM reads the totals off the cards.

### Changed

- **The system socket carries `party:*`.** The router in `starwrought.mjs` sends `damage:*`,
  `reroll:*` and `expose:*` to `onChatSocket` as before, `party:*` to `onPartySocket` in the new
  `module/documents/party-socket.mjs`, and everything else to the attack coordinator. Both
  listeners read the asker from the server's stamp on the message and never from the payload.
- **A party Item dropped on a character sheet moves.** The character sheet's `_onDropItem`
  detects an Item whose parent is a party and routes through `requestTake` for the whole stack
  (ruling 98) without letting Foundry copy it; every other drop onto the sheet is as it was.
- **Non-physical Items are refused on a party.** `SwItem._preCreate` returns false with a notice
  when the type is not weapon, armor, shield or gear and the parent is a party, so a Talent, a
  Constellation, a chassis or a Maneuver dropped on the Loot tab never lands.
- **The party sheet redraws its loot** on the party's own Item hooks and its own `updateActor`
  (the purse), on the same timer of about 150 ms the roster and the grid use for the members'
  changes.
- **The chat dispatcher** gains `partyAsk`, the Ask everyone card's button, which hands the click
  to `rollAskedCheck`.
- The version stamps read 0.7.1 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. No migration step: `system.currency`
  defaults to 0 of each coin, and a party made under 0.7.0 holds no Items.

### Notes

- **The rulings, 96 to 100**, Mike's answers to the plan's parts 6 and 7, numbered on from the
  0.7.0 entry's 95. 96: the loot and the purse are a convenience with no rule authority; they move
  Items and coin and value nothing, and a row prints a price with nothing computing from it. 97: a
  player's Take or Give runs on the active GM's client over the system socket, the asker read from
  the server's stamp, the destination written before the source, requests served in arrival order,
  and with no GM connected the controls say so and write nothing. 98: dragging a party Item onto a
  character sheet moves the whole stack; the Loot tab's Take button is what asks a count for a
  stack. 99: Split divides the purse in copper equally among the ticked members and the remainder
  stays in the purse. 100: Ask everyone posts one card spoken by the party with a Roll button per
  member that only the member's owner (or the GM) can press, the Threshold optional and hidden from
  players unless the GM shows it.
- **A party Take needs a GM connected.** Phase 1 needed none: every write was the GM's own or a
  player's on a character they own. Take and Give to the party are the first party writes a player
  cannot make alone, and they go to `game.users.activeGM` exactly as damage, rerolls and Expose do;
  with no GM connected the controls say so and nothing is written, and a party Item dragged onto a
  player's sheet is refused rather than copied. The GM's own moves (Give to, Split, drops, deletes,
  edits) never touch the socket. With two GMs every request is addressed to the active GM alone and
  the other GM's client ignores a message not addressed to it (the plan's risk 6).
- **Observer ownership exposes the document**, loot and purse included. Every player can open the
  party and read every row and every coin, which is the point of a shared stash, and the console
  shows the same to anyone with Observer ownership whether the template shows it or not. Nothing
  secret belongs on the party, a hidden Threshold least of all: Ask everyone keeps a Threshold the
  GM did not show out of the DOM and out of any flag a player can read.
- **What phase 2 does not do.** No selling and no shop: Sell at half price was struck by the plan's
  judge because it parses a price to compute a number the GM reads off the row, and Provision's
  half price stays the table's. No price is computed anywhere: the row prints the string the Item
  carries. No Contribute to the purse (struck for the same reason; the GM types the coin in). No
  party token on any map. The Loot tab polices nothing beyond ownership, membership and stock: a
  player may Take anything the party holds, and the table hears it. Phase 3 (the road: the
  Exploration panel, the party's Travel Speed and terrain, the Fatigued gate, Begin the encounter
  with Initiative by Activity; 0.7.2, leaning on four handbook sentences and a pipeline change) and
  phase 4 (Downtime; 0.7.3) stand as the plan wrote them; `CLAUDE.md` names them under Known
  outstanding work.
- **The handbook sentence phase 2 could use** is the plan's item 10 under "What the handbook would
  need" (shared loot and a common purse), marked optional there and not needed for the system to
  behave as described (decision 16). The spreadsheets, `assets/roster.json`, the web app, the
  Constellation Compendium and `packs/_source/` are untouched by this release.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list.

---

## 0.7.0 (2026-10-02): Player's Handbook v4.15

Built from Player's Handbook v4.15, unchanged: no rule moved, so `data/SYNC.json` is untouched and
the handbook's loose ends stand where 0.6.3 left them. The release is phase 1 of the Party Sheet,
built from `party-sheet-plan.md` in the project root (2026-10-02, a three-lens design panel and a
judge, written after Mike's question in the v4.14 report, ruling 89; Mike's "Go!" on its
recommendations). A `party` Actor type and one sheet: the GM's console and the players' window at
once, with the roster as a status board, Begin session and Hero Point awards, the party's night,
the Milestone award with the Deferred Talent Point the book names and the system lacked, Take back,
and a Skills grid of every member. A document type is new, so a minor bump to 0.7.0; nothing stored
changes shape (every new field has a default), so no world migration. The decisions Mike took on
the plan are rulings 91 to 95, continuing the v4.14 report's numbering (see Notes).

### Added

- **The party Actor type and its sheet.** Create Actor, type Party. `SwPartyData` extends
  `TypeDataModel` directly, never `SwActorData`, so a party has no Zones, Wounds, Vigor, stance or
  actions and the combat machinery never sees one. It stores only party bookkeeping (`members`, a
  list of uuids in insertion order; `session`, its number and when it last began; `lastAward`, for
  Take back; the GM's `notes`) and reads everything about its members live at render, never copying
  a number off a character; nothing member-dependent is computed in the party's own prepare, so one
  Actor's derived data never depends on another's prepare order. A new party is linked and Observer
  by default (`_preCreate`), so every player can open it and the GM writes it. The sheet
  (`SwPartySheet`, ApplicationV2) is one template set branching on who is looking and on which
  members they own, as the character sheet's header does: a header with the portrait, the name,
  the session number and the GM's three buttons; the roster always open above the tabs; a Skills
  tab and a GM Notes tab. It re-renders itself, debounced on a timer of about 150 ms (never a
  requestAnimationFrame latch), on the member hooks (`updateActor`; an Item created, changed or
  deleted on a member; an Active Effect created, changed or deleted on a member, since Fatigued is
  an effect), and only when the changed document is a member or belongs to one.
- **The roster as a status board.** One row per member: portrait (click opens the sheet), name, the
  level badge with the three Milestone pips and the Deferred badge while above 0, Hero Points with
  the GM's award controls, the Vigor bar with Temporary Vigor and the Spent badge, Wounds with the
  Zones on hover, Dying N, Fatigued N, Load Strain with the same Wind tooltip the character sheet
  builds, Speed, the owning players' colour dots (dim when not connected), the Flared
  Constellations as chips, a GM-only Flare plus, and Remove with a confirm. Members join by drag
  (a linked token resolves to its Actor; an unlinked token, an adversary, a party or a compendium
  Actor is refused with a notice) or by a toolbar button that adds every player's assigned
  character once, in order. A member whose Actor has been deleted prints as a missing row with
  Remove alone, and no console error. Membership posts nothing: the roster is the record. A player
  sees the same board, read-only, with three live things: portrait clicks, the Flare chips on a
  character they own (a click puts one out through `toggleFlare`, which posts its card), and the
  Spent control on their own Deferred badge; a player who owns no member sees the board and an
  empty-state line. Every action handler re-checks permission before writing (the GM for a party
  write; the actor's owner for a put-out Flare or a Spent), since ApplicationV2 actions fire
  regardless of editability.
- **Begin session** (ruling 93). A confirm, then `session.number + 1` and every member's Hero
  Points set to exactly 1, with one card spoken by the party ("Session 12 begins. Every character
  starts with 1 Hero Point.") and a line per member whose count changed ("Wren: 3 to 1"). PHB P73
  and P434 (each session starts with 1; the GM awards more) and Refusing Death's "until the next
  session" all read as a reset; a GM who wants a player to keep a point adds it back in public.
- **Hero Point awards.** On each roster row the GM has a plus that asks for an optional one-line
  reason and writes +1, refused with a notice at the maximum of 3 before anything is written (the
  schema's `max` would otherwise throw mid-batch), and a minus as a correction. Spoken by the
  member: "The GM awards Hrolda a Hero Point: carrying Toric out of the fire (2 of 3)."; "Hrolda's
  Hero Points corrected to 1." The character sheet's Spend button is unchanged, and still has no
  way to add one.
- **The party's night.** A confirm, then `restForTheNight()` on every member in turn, each posting
  its own rest card exactly as the sheet's Rest button does (Vigor restored, Temporary Vigor
  cleared, Fatigued ended and said when it was, Spent cleared once there is Vigor again), then one
  party line. The confirm names the members whose worn Torso piece lacks Comfort; sleeping in armor
  itself stays unimplemented (`FEATURES.md`, section 8).
- **The Milestone award, the Deferred count and Take back** (rulings 91, 92 and 94). Award a
  Milestone opens a dialog listing every member ticked, with a preview line each: "Hrolda:
  Milestone 2 of 3, a Milestone Talent Point (Flared: Melee, Athletics)"; "Wren: Milestone 3 of 3,
  no Constellation Flared, so a Deferred point"; "Kessa: the 4th Milestone, level 3, Vigor 36 to
  45, a Comet". Untick a character who has left or sat the arc out (ruling 91: a Milestone belongs
  to the table). Confirm disables the button while it runs and writes each ticked member:
  `milestone + 1`, or for a member at 3 `level + 1` and `milestone 0`, then reads the recomputed
  maximum and raises current Vigor by the same rise in a second update (ruling 92; P62 says "Vigor
  rises", and a character would otherwise come out of a level at 20 of 36), and `deferred + 1` for
  a member with no Flared Constellation receiving a Milestone point (ruling 94; Table 4: a
  Milestone Talent Point with no Flared Constellation "becomes a Deferred Talent Point", spent "the
  instant a Constellation is Flared"). One public card spoken by the party, one line per member
  ("Hrolda reaches Milestone 2 of 3: a Milestone Talent Point, to be spent now in a Flared
  Constellation: Melee, Athletics."; "Wren reaches Milestone 3 of 3: no Constellation is Flared, so
  the point is Deferred: spend it the instant one Flares (Deferred held: 1)."; "Kessa reaches the
  4th Milestone: level 3. Vigor 36 to 45. A Comet: a Talent Point for any Constellation, Flared or
  not."), and at 5th, 10th and 15th the line says which rank opens (5, 10, 15; the Level-Up
  Checklist's 5, 13, 19 is the book's to fix, plan decision 10). The before-state of every member
  written goes to `lastAward`; **Take back** reverses exactly those numbers on exactly those
  members, refuses with a notice when any of them has since been edited by hand, posts a card and
  clears `lastAward`. No other undo: a Talent spent is the player's to move, as today. Every write
  to a character goes through `actor.update(..., { swAnnounced: true })`, so the Adjusted card
  never doubles any of it.
- **Deferred Talent Points, counted on the character** (ruling 94). A new field,
  `system.deferred` on `SwCharacterData` (an integer, 0 by default, no migration), +1 by a
  Milestone award that finds no Flare and −1 by Spent. The character sheet's header shows a
  Deferred badge beside the Milestone pips while it is above 0, with a **Spent** control for the
  owner or the GM that writes `deferred - 1` and posts a one-line card spoken by the character
  ("{name} spends a Deferred Talent Point."); the roster shows the same badge with the same
  control; and the Flare card carries one more line while the character holds one ("You hold a
  Deferred Talent Point: spend it here now."). It is a reminder with a number on it, not a budget:
  nothing stops a Talent drag and the count is not decremented when one lands (`FEATURES.md`,
  section 8).
- **The Skills grid.** A tab: Constellations as rows, members as columns, because the question at
  the table is "who has Stealth". Rows for the four Defenses (the cell shows the Threshold, since
  that is what a Sneak, a Feint or a Lie is measured against; modifier and rank on hover), an
  Initiative row (live only while a Combat holds the member), the seven Skill Constellations from
  the registry (the Lore template left out), Melee and Ranged (rank and Proficiency, the inherited
  pool on hover), and one row per Lore any member has opened, blank for the others. A Skill cell
  shows the rank letter and the signed modifier from `SwCheck.previewTotal`, so Stealth carries
  Load Strain and a Frightened member's cells carry the penalty; Untrained is dimmed at +0, the
  Threshold is in the tooltip, and the best in each row is marked gold (ties all marked). Clicking
  a cell rolls that check as that member through the member's own `rollCheck`, `rollDefense` or
  the Combat's Initiative roll (Shift-click skips the dialog), so the card speaks as the member and
  can Flare. Players see the same grid, Thresholds included (ruling 95); cells are live only on
  members they own, and a click on another member's cell does nothing.
- **The Flare picker, shared** (`module/apps/flare-picker.mjs`, `pickFlare`). The dialog a
  critical's card opened (the Opened list, the "Show Constellations you have not opened" checkbox,
  the preselection; 0.6.3, ruling 85) is extracted from `flareFromCard`, which calls it and then
  `toggleFlare(slug, true)` as before, so the chat path is unchanged. The roster's GM-only Flare
  plus opens the same picker with an optional one-line reason, and `toggleFlare(slug, state,
  { reason })` prints the reason on the lit card as its own line ("awarded by the GM: <reason>").
  The put-out card, and the silence on a Flare that was never lit, are unchanged.

### Changed

- **Fences, so a third Actor type meets code written for two** (the plan's risk 1). Most reads
  of `system.zones`, `system.actions`, `system.ranges` and `system.stance` already guard on
  presence; five places get an explicit skip of `SW.PARTY_TYPE`: Support's ally count
  (`supportFor` in `documents/actor.mjs`; a friendly party token in reach would otherwise hand
  out +1), `actorsIn` in `combat.mjs` (so no Wind, Recovery, Persistent Damage or reset card is
  ever addressed to a party), the Combat Tracker's actions readout and Pass button, `canAct` (a
  party combatant Passes by necessity and never resets the pass streak), and the check engine
  (`SwCheck.roll` refuses a party roller; a party defender's Threshold stays unknown). A party
  token added to a Combat by mistake survives a round with no card, no readout and no bonus
  (checked live).
- **`MILESTONES_PER_LEVEL` lives in `config.mjs`**, moved from the character sheet, so both sheets
  read one constant; `PARTY_TYPE` (`"party"`) sits beside it, and `HERO_POINTS_MAX` was already
  there.
- The version stamps read 0.7.0 in all three places: `system.json`, `SYSTEM_VERSION` in
  `config.mjs` and `--sw-css-version` in the stylesheet. The manifest's `documentTypes.Actor` gains
  `party`. No migration step: every new field has a default and nothing stored changes shape.

### Notes

- **The rulings, 91 to 95**, Mike's answers to the plan's first five recommendations, numbered on
  from the v4.14 report's 90. 91: a Milestone award goes to every member by default, with a
  checkbox per member to withhold it from one who has left or sat the arc out. 92: when the fourth
  Milestone raises a level, current Vigor rises by the same amount as the maximum, and the card
  prints both numbers. 93: Begin session sets every member's Hero Points to exactly 1, the card
  printing each previous count. 94: Deferred Talent Points are counted on the character and nothing
  is enforced. 95: players see every member's Thresholds on the Skills grid (a world setting is one
  line if the table objects; adversaries' Thresholds never appear on the party sheet in any phase).
- **What phase 1 does not do.** No loot and no purse (phase 2, over a `party:take` relay to the
  active GM's client); no Exploration panel, Travel Speed or Initiative by Activity (phase 3, which
  leans on four handbook sentences the plan drafts and a pipeline change); no Downtime (phase 4);
  no party token on any map; and nothing a party does is enforced: the Deferred count is a
  reminder, the Milestone award writes numbers the GM could type by hand, and the pips, the Flares
  and the Hero Points are the characters' own fields as before. The plan's phases 2 to 4 stand as
  written; `CLAUDE.md` names them under Known outstanding work.
- **Observer ownership exposes the document.** Every player can open the party, which is the
  point; it also means the GM Notes tab, GM-only in the template, is a convenience and not a vault,
  since an Observer can read the document's data from the console. Nothing secret belongs on the
  party.
- **No active GM is needed in phase 1.** Every write the sheet makes is either the GM's own
  (membership, the session, the awards, the night) or a player's on a character they own (a Flare
  put out, a Deferred point Spent), so no request travels the system socket and the no-GM notice
  that `damage:apply` gives does not arise. Take and Give, in phase 2, are the first party writes a
  player cannot make alone, and will go to the active GM's client as damage, rerolls and Expose do.
- **The handbook sentences phase 1 would like** are drafted in the plan under "What the handbook
  would need" (items 1, 2, 3, 7, 8 and 12: the party as a unit, who reaches a Milestone, the
  Deferred point against "never banked", level-up and current Vigor, Hero Points at session start,
  the Level-Up Checklist's gates). None is needed for the system to behave as described; each is
  Mike's to take or redraft. The spreadsheets, `assets/roster.json`, the web app, the Constellation
  Compendium and `packs/_source/` are untouched by this release.
- The handbook's v4.10 loose ends stand in v4.15 as 0.6.3 listed them; `CLAUDE.md` carries the
  list.

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
  v4.14 sync report. Mike then refreshed the contents field and removed Appendix A (This Book's
  Style), whose conventions `handbook-style.md` now carries; `data/SYNC.json` records the hash of
  the edition as he saved it. No rule moved.
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
