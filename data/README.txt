STARWROUGHT talent authoring
============================
Any number of .xlsx files in this folder: split them however you like (e.g. one per
category). RULE: each spreadsheet needs its own "_Tree Index" sheet listing the trees
inside THAT file. The converter merges every file; the same tree in two files is an error;
sheets missing from their file's index are ignored with a warning. A workbook open in Excel
(~$lock file present) is converted from its last saved version, with a warning saying so.
  THE INDEX TOOL (0.20.0; Mike, 2026-11-08: "generate/re-generate/update the _Tree Index tabs
  in all of them"): python assets/index_sheets.py brings every workbook's _Tree Index up to the
  sheets it holds. A tree sheet with no row gets one with its Category (talents_ancestries.xlsx ->
  Ancestry, talents_skills.xlsx -> Skill, and so on) and its other cells blank and named in the report
  (Primary Attribute and Parent are hand-kept, so the tool never guesses them); an actions
  workbook's index gets one row per action with the row's Type and the sheet's Category or name;
  an index row whose sheet or row is gone is REPORTED with the nearest name, never dropped;
  filled cells are never touched; a workbook is saved only when a cell changed, after a copy to
  backup/index-<date>/. --dry-run reports only. A workbook open in Excel is skipped.

THE WORKBOOKS' NAMES (Mike, 2026-11-15; system 0.30.0)
  A talent workbook is talents_<what>.xlsx and an actions workbook actions_<what>.xlsx:
    talents_ancestries, talents_cultures, talents_callings, talents_skills, talents_defenses,
    talents_combat_styles, talents_magic, talents_martial (weapons.xlsx until the rename);
    actions_maneuvers, actions_activities, actions_endeavors.
  backgrounds.xlsx, languages.xlsx and equipment.xlsx kept their names. The converter tells a
  workbook by what is in it, never by its name, so a rename breaks nothing; the index tool reads
  the Category from the name with its prefix removed. Older notes in this file and in the
  changelog name the files as they were then.

THESE WORKBOOKS ARE THE ONLY SOURCE FOR TALENTS AND MANEUVERS (Mike, 2026-11-15; PHB v4.25)
  "I removed ALL Talent details in Chapter 6 as well as ALL of the Maneuver details from Chapter 8
  from the PHB; it is a lot of work to keep it consistent with the talent spreadsheets in the data
  folder. Once all of the spreadsheets are finalized, I will use them to build that part of the
  PHB." So what a Talent, a Maneuver, an Activity or an Endeavor says is whatever its row here
  says: there is no handbook text for it to disagree with, a change to a row is the content loop's
  and never a handbook sync, and no handbook redline is proposed for one. The handbook is still
  the word for the general rules and for the tables it still prints (the Traits tables, Chapter
  3's creation tables): where a sheet restates one of those and the two disagree, the handbook
  wins and the sheet needs a pass. (The Conditions table is no longer one of them: since
  2026-11-18 conditions.xlsx is the only source for a Condition, THE CONDITIONS WORKBOOK below.) SINCE 2026-11-15 THE SAME HOLDS FOR
  EQUIPMENT: Mike took the Armor, Shield, Melee Weapon and Ranged Weapon tables out of Chapter 5
  ("This section will be populated from the Spreadsheets in the StarWrought data folder"), so
  equipment.xlsx is the only source for a weapon, a piece of armor, a shield and ammunition. The
  Weapon Traits and Armor Traits tables are still the book's. A new Maneuver that a
  rule in the book names (Roll Over, for Supine) is a row here, not a paragraph there.

THE CONDITIONS WORKBOOK (Mike, 2026-11-18; system 0.33.0)
  "can we build a conditions.xlsx that includes every condition, and the automation effects (if
  any) of it?" conditions.xlsx is the ONLY source for what a Condition says and does. The system,
  the web app, the compendium and the Rules Reference journal all read it. It was first filled
  from the handbook's Conditions table (22 rows, Supine among them) plus the four Conditions the
  system has and the table does not (Concealed, Hidden, Undetected, Dead); from here on the sheet
  is the word, and the handbook's table is Mike's to keep or to take out of the book.
  One sheet, Conditions, one row for each Condition (an About sheet is ignored). Columns, first
  word of the header:
    Condition    its name ("Frightened"). The table's suffix reads too ("Frightened N", "Exposed
                 [Zone]", "Bound [X]") and is put back from Takes wherever a table is printed.
    Takes        blank, N (a value: Frightened 2), Zone (the system's own only), or X (a creature).
    Description  one line of flavor, as on a talent sheet (0.35.0). Shown in italics above the
                 Effect in the Rules Reference journal and in the Condition's tooltip on a sheet.
                 May be blank.
    Effect       the rules text players read: the tooltip on the Condition's row of a sheet and on
                 the token's hover card, and the reference tables. REQUIRED under this name since
                 0.35.0 (through 0.34.0 this column was headed Description): a sheet with no Effect
                 column stops the build, which will not guess which text a lone Description holds.
                 [X] (0.35.1): on a row whose Takes is X, write [X] where the name of the creature
                 the Condition is about should appear ("[X] Controls your weapon"). The sheet's
                 tooltip and the token's hover card print the name (the Bind partner for Bound,
                 Controlled and Controlling; whoever applied it for any other row; "that creature"
                 when nobody is named). The reference tables print [X] as typed. A bare X is only
                 a letter. The Description cell reads [X] the same way.
    Includes     other Conditions this one also counts as, comma separated. Prone: Off-Guard. A
                 creature is Off-Guard once, however many ways it got there. "Off-Guard against X"
                 means only against the creature that put this Condition on, and needs Takes = X.
    Automation   lines in the grammar, as on a Talent. A Condition's row reads CHECK, ATK, DEF and
                 INIT, which act for whoever has the Condition (a character or an adversary), and
                 after IFT: may ask about the attack answered (RANGED, MELEE, BLOW, BLAST, BLIGHT,
                 BEGUILEMENT, TRAIT(...)). -N is the Condition's own value: [EFFECT DEF: -N
                 condition] on Frightened is -2 at Frightened 2. N/A is a row that needs none.
                 IMMUNITY TO A TRAIT (0.35.0): [EFFECT IMMUNE: TRAIT(Visual)] on Blinded,
                 [EFFECT IMMUNE: TRAIT(Auditory)] on Deafened. Whoever has the Condition is immune
                 to anything with that trait: a Maneuver used on it puts nothing on it, an attack
                 or a spell deals it no damage, and Foundry says so and goes on. One trait to a
                 line, nothing after it, and on a Condition's row alone for now. Separate traits
                 on a Maneuver are each enough (Calm Animal: Auditory, Visual); one trait written
                 "Auditory or Visual" (Captivate) needs both.
    System       Yes for the Conditions the system itself puts on and takes off (Dying, Wounded,
                 Spent, Preparing, the Bind's three, Exposed, Dead): the row holds their text.
    Listed?      Yes prints the row in the reference tables. A sheet without the column lists all.
    Icon, Notes  optional. Notes is yours (what the code still does for the row); never read.
  A NEW ROW MAKES A NEW CONDITION: its own status on the token palette, and a name every cell can
  write ([EFFECT APPLY: Supine], [REQUIRES supine]). The build prints NEW CONDITION: "<Name>" for
  each, every time, so a slip in a name is seen at once. A row deleted from the sheet is gone at
  the next build, except the Conditions the system itself has: the build refuses to go without
  one of those. THE ROW IS THE WORD: a row whose Automation cell is N/A (or blank) means the
  Condition changes no number, Off-Guard, Frightened and Fatigued included; the numbers the
  system had for those three come back only when this workbook cannot be read at all.
  BUILD IT ALONE: double-click sync_conditions.cmd, or run
    node assets/build_all.mjs --conditions
  It converts conditions.xlsx ALONE, reads its cells, and writes assets/conditions.json and the
  roster's conditions block together, only when every row reads; then the web app, the Foundry
  system's content and the style check on that one workbook. No other workbook is opened. Then
  Sync content in the open world, which reads the Conditions again on every connected client.
  The workbook was scaffolded once by assets/make_conditions_xlsx.py, which refuses to run over it.
  The grammar's own account of a Condition's row is AUTOMATION_GRAMMAR.md, section 11.

ADDING CONTENT: the loop (Mike, 2026-10-03; system 0.8.0)
  EQUIPMENT ALONE (0.30.0; Mike, 2026-11-15, with the talent and action workbooks still being
  authored and unable to pass the loop below): double-click sync_equipment.cmd, or run
    node assets/build_all.mjs --equipment
  It converts equipment.xlsx ALONE (equipment.json and the roster's four equipment blocks),
  rebuilds the web app, writes the Foundry pack sources and runs the style check on that one
  workbook. No other workbook is converted, and no tree, action, background or language file is
  written. (The build report at the end still reads every workbook, read-only.) Then Sync
  content in the open world, as below. AFTER A SYSTEM UPDATE RESTART FOUNDRY FIRST: content is
  written through the code the world is running, and older code drops the fields it does not
  know. From 0.30.0 the sync refuses sources built for a newer release than the world runs; a
  world still on 0.29.0 or earlier does not, which is why the build's last line says it too.
  Add rows to a sheet, a sheet to a workbook, or a whole new workbook in this folder. A new
  workbook needs its own "_Tree Index" sheet naming the trees inside it, as the first paragraph
  says; an actions workbook carries a  Name | Type | Category  index instead (ACTIONS WORKBOOKS,
  below; python assets/index_sheets.py fills it); weapons, armor and shields live in equipment.xlsx and nowhere else (EQUIPMENT WORKBOOK,
  below). Set Enabled? to Yes on anything that should ship to Foundry; the web app shows everything
  regardless. Save the workbook (leaving it open in Excel is fine: the last saved version converts).
  Then double-click sync_content.cmd in the project root, or from the project root run
    node assets/build_all.mjs --content
  It converts every workbook, rebuilds the web app Starwrought_App.html and the constellation
  viewer (reload the browser tab), renders the plate of a new or changed Constellation and prunes
  a gone one's, writes the Foundry pack sources with their content index, and runs the style
  check. It never compiles the LevelDB compendia (a running Foundry holds them open) and never
  stops for a newer handbook on the shelf: that is printed as a warning, because adding content is
  not a handbook sync.
  Then in Foundry, as the GM, in the open world: take the Sync content offer at load, or open
  Settings > STARWROUGHT > Sync content at any time. Read the plan (created / updated / deleted, by
  name), tick or untick "refresh the characters' copies" (an owned Talent or weapon takes the new
  text while keeping its quantity, carry state, raised shield and chosen option), and press Sync.
  Nothing restarts, and nothing already on a sheet changes its UUID.
  THE BUILD REPORT (0.20.1; Mike, 2026-11-08): every build_all.mjs run, this loop included, ends
  by writing build-report.xlsx in the project root: Summary (mode, outcome, what to do first),
  Issues (every finding with Severity, Where, the step's words and Claude's recommendation; filter
  by Severity: Error stopped the build, Fix is a cell or file to mend, Decision is yours, Note is
  accepted and said each run), Decisions (the standing questions, from assets/open_decisions.json
  plus the machine's), Red cells (every Automation line the grammar cannot read, with the cause).
  Open it after a build; close it before the next, or the report is written beside it with a
  date in its name.
  What the loop does NOT do: the handbook, the Constellation Compendium docx, the PDFs and the
  compiled packs on disk. Those belong to a release: close Foundry and run the full pipeline,
  node assets/build_all.mjs (the two paths are set out at the bottom of this file). Since 0.9.0
  the loop also reads the Automation column (Tree columns, below): a line the framework does not
  know STOPS the build, naming the Constellation, the Talent and the line, before the sources are
  written. The grammar is AUTOMATION_GRAMMAR.md in the project root (0.13.0: bonus, grant, aura
  and prevent, with the operators IF, FOR, WHILE, AGAINST, FIRST, ONCE, DIFFERENT, VISIBLE; 0.14.0:
  SEEN and IF(Trait=<Trait>)).

Index columns:  Tree | Category | Primary Attribute (Might/Agility/Wits/Presence; "Feeds" still reads) |
                Flare Triggers | Meta note | Parent | Traits
  An unknown header on any sheet is WARNED about by name (0.13.0), so a renamed column is never
  silently dropped. Flare Triggers and Meta note are optional (Flares are one universal rule, and
  the meta line is derived from the chassis columns when blank); Mike deleted both from the
  ancestries index on 2026-11-05.
  Traits (0.14.0; Mike's column): the creature traits the tree's chassis confers ("Human"), comma
  separated. They print on the web app's Ancestry card and the compendium docx's Ancestry table,
  and in Foundry on the Ancestry chassis (system.traits) and the character sheet's header, read off
  the Ancestry, Bloodline and Culture by name at render and never stored on the character.
  Parent (v4.10; a GROUP since PHB v4.21): names the Constellation this tree is a group of Talents
  within. A Combat Style names Melee or Ranged; a magical specialty (Flamecraft, Stormcraft, ...)
  names its discipline (Elementalism, ...). A tree with a Parent has NO rank of its own: every
  Talent bought in it counts once toward the parent's rank and feeds its Attribute once, its row
  in Foundry wears the parent's badge, and a Flare lit on it records the particular training. The
  parent's own Talents must still be bought. The converter writes group: true on such a tree and
  ERRORS on a Parent that names no tree, or one that has a parent of its own.
  Category must be one of: Skill, Defense, Weapon, Combat Style, Armor, Calling, Ancestry,
  Culture, Bloodline, Background, Magic (v4.21: the five disciplines and their specialties, in
  talents_magic.xlsx). The v1.8 spellings Save and Heritage still convert, as aliases
  for Defense and Bloodline (CATALIAS in xlsx_to_trees.py), and are normalised on the way in.
  Skill / Defense / Weapon / Combat Style / Armor / Magic trees REQUIRE a tree-level Feeds (untrained fallback).
  Ancestry rows may also carry: Vigor (or HP) | Size | Speed | Senses; those generate the
  "ancestries" block of roster.json, so the chassis is authored once, here. Speed is feet per
  Move (a Human's is 6). The one-line blurb the app card, the compendium docx and the Ancestry
  chassis print is the Lore sheet's Summary row (0.14.0; the index's Summary column was a copy
  of it and is gone; a sheet that still has one is read where the Lore sheet has no Summary row).
  Calling rows may carry Skills: the Training the Calling grants at creation. A Calling's Vigor is
  NOT authored here: it is the third column of the hand-kept callings block of assets/roster.json,
  and since PHB v4.11 that column is the Calling's Opening Vigor (paid once, at 1st level, by your
  first Calling: Berserker 12, Ambusher 8, Hunter, Bravo and Weaponmaster 10; the v4.21 casters
  Spellshaper 6, Blood Mage 8, Necromancer 6, Summoner 6, Spellblade 8, per their root texts), not
  Vigor per level. The Ancestry's Vigor stays per level; the two meet in Vigor = 10 + Opening
  Vigor + Ancestry Vigor × level (v4.21; the Endure Bonus to Vigor of v4.11 to v4.15 is gone).
  Culture rows may carry Skills, but v1.8 cultures grant no skill points, so it stays empty.
  Culture rows (0.15.0) generate the "cultures" block of assets/roster.json, as Ancestry rows
  generate the ancestries block: one record per Culture tree, every row with its enabled flag
  (name, attribute, languages, blurb, lore, traits, tree), so hand edits to that block are
  pointless. The _Tree Index of talents_cultures.xlsx may carry Languages (comma separated, "Serrovine,
  Common"; " • " also reads) and Traits (the creature traits the Culture confers, as on an
  Ancestry). While it has no Languages column the converter carries each Culture's languages from
  the previous roster row and WARNS once naming the column to add; with no row to carry from the
  languages are blank and it says so. The blurb the app card, the compendium docx and the Culture
  chassis print is the "<Tree> Lore" sheet's Summary row, and the Culture chassis's Special
  Ability in Foundry is its Root Talent's Effect; nothing parses the Effect prose for languages.
  A sheet named "<Tree> Lore" beside a tree's sheet (0.13.0) is the tree's player-facing text:
  label | text rows, no header row, in the order you want them read (Summary, About, If you
  want..., You Might..., Others Probably..., Physical Description, Society, Beliefs, Popular
  Edicts, Popular Anathemas, Names, as the Human Lore sheet has them). Rich text carries as the
  Effect column's does. An Ancestry's Lore shows on its compendium window's Description tab and
  under the highlighted card in Character Creation. A Lore sheet for a name not in the index WARNS.

Tree columns:   Talent | Tier (T/E/M/L) | Root | Requires | Prerequisites | Description | Effect |
                Attribute (or Feeds) | Choice | Free Talent | Enabled? | Automation | Traits
                and, on the magic sheets only, the SPELL columns:
                Threat | Delivery | Range | Die | Damage | Targets | Quick | Focused | Committed | Defenses
                Retired (0.13.0), still read where a sheet has them: Aura (write "aura: 15ft,
                allies" in Automation instead; both on one row is an ERROR) and Grants (write
                "grant: 1, Calling"; the converter WARNS on a filled Grants cell, and a cell that
                disagrees with the line fails the build).
  Column ORDER does not matter; the first word of the header does.
  Traits (0.14.0, optional): the Talent's traits, comma separated as the action sheets' column is,
        written as system.traits on the Talent. Its one use so far: a spell Talent carrying a trait
        a defender's Automation rule names ("Fear" for the Torchbearer Human's Rally Aura,
        IF(Trait=Fear)). Nothing in the data carries Fear yet; the build WARNS, and the rule fires
        when the first Fear spell or adversary attack is authored.
  Attribute (0.13.0; "Feeds" through 0.12.0): the Attribute this Talent's point feeds. On a sheet
        headed "Attribute" a BLANK cell is an ERROR ("no Attribute cell should ever be blank",
        Mike, 2026-11-05); on a sheet still headed "Feeds" a blank inherits the tree's Primary
        Attribute, until that sheet is renamed too. "TBD" WARNS on either.
  Spell columns (PHB v4.21, Spellwork): a row with a Threat is a spell, and the Foundry system
        gives its Talent the Cast ❷ / ❸ / ❹ buttons; a row without one is an ordinary Talent
        whatever else the sheet says. Threat is Blow, Blast, Blight or Beguilement (ERROR
        otherwise). Delivery is Zoned or Pervasive (ERROR otherwise; blank with damage WARNS, and
        Zoned is assumed). Range is "N ft" or "adjacent" (ERROR otherwise; blank WARNS). Die is
        "dN" (the spell rolls one such die per rank of the discipline, Trained 1 to Legendary 4; a
        Quick Cast one). Damage is the damage types, comma-separated ("fire", "force, cold"); a
        Die with no type WARNS. Targets is prose ("one creature", "every creature in a 3 ft
        line"). Quick, Focused and Committed are the three Cast texts, what the sheet and the card
        print for each; a spell with none of them WARNS. Defenses overrides the Threat's pair
        ("Evade or Endure"); blank, the Threat decides; a word that is no Defense is an ERROR.
        Nothing else is validated: an area, a push, a condition on a Hit, a summons or a healing
        line stays prose the card prints, as a Talent's Effect does.
  Automation (0.9.0; Fantasy Grounds' shape since 0.16.0, every line in brackets since 0.17.0):
        what the Foundry system should DO with the talent, in the grammar the system owns. THE
        REFERENCE IS AUTOMATION_GRAMMAR.md IN THE PROJECT ROOT (and, in Foundry, the Automation
        Grammar journal in the Rules compendium, built from it): every block and tag with an
        example, the components and conditions, the vocabularies, the book written out, what a
        rule does and does not do in play, and the build's messages. It is kept current with every
        change to the code, and the build fails when a kind, a tag, a component or a keyword it
        knows is not named there. In short, a line is blocks in square brackets:
              [TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]                the chassis, on the Root
              [REACH 2]   [REACH +1]                                      Natural Reach in feet (0.30.0):
                                                                          set on an Ancestry's Root, adjusted
                                                                          on any Talent; with no block it is
                                                                          the Size's (Medium 2)
              [LANGUAGE Common, Serrovine]  [SENSES Low-light vision]
              [Acrobatics trained]  [POINT Calling]  [POINT 2 Skill different]   points at creation
              [MANEUVER Steady the Line]  [TALENT Weapon Familiarity]  [CHOICE Weapon Group]
              [AURA 15 allies]                                            the ring on the map (preview-only until shown)
              [EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]   a typed bonus to a roll
              [EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0]
              [EFFECT IMMUNE: prone; LIMIT: encounter]                    an effect does not land
              [EFFECT MARK: enemies]                                      name one creature on use
              [EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]    throw a check's die again
              [EFFECT IGNORE: terrain, mud, shallow water]                difficult terrain costs nothing
              [EFFECT USE: Presence, Origin, aid]                         a check made with other terms
              [EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]     on a MANEUVER'S row: what a result gives an ally
              [EFFECT ALTER: Aid.critical-failure; VALUE: nothing]        a talent changes what a Maneuver gives
              [EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]          on a MANEUVER'S row: it lets an ally Move now
              [EFFECT CHECK: 2 situation, diplomacy; IF: CLAIM(when trading)]   the player's checkbox
        Blank lines are nothing, a line beginning with "#" is a comment, case never matters, one
        trailing period inside a block is tolerated.
        N/A MEANS NO AUTOMATION (Mike, 2026-11-15; system 0.26.1): type N/A alone in the cell of a
        row you have looked at and decided needs none. It is no rule and no error: the cell is an
        empty one to the pipeline (nothing reaches the Foundry Item), highlight_automation.py never
        paints it and counts it apart ("12 marked N/A"), and a blank cell stays what it was, a row
        not reached yet. n/a, NA, N.A., None and a lone dash read the same, bracketed or not
        ([N/A]). It is the whole line: N/A inside a block ([EFFECT N/A]) is still a mistyped
        effect. A cell that says N/A and also carries rules WARNS, and the rules are used.
        The converter copies the cell through as text
        and parses nothing; parse_rules.mjs parses it (below), and a line it does not know is an
        ERROR that stops the release build (node assets/build_all.mjs) naming the Constellation,
        the Talent and the line, before the sources are written. The content loop
        (sync_content.cmd, build_all --content) is LENIENT since 2026-11-07: the same line is
        listed under an AUTOMATION ERRORS banner and stored on its Item as an error, red on the
        Item sheet and skipped in play, so a half-authored sheet still builds. The same line typed
        into a world Item's textarea in Foundry saves and is marked the same way. The action
        sheets take the same column. A bare effect line ("IMMUNE: prone; LIMIT: encounter" with no
        [EFFECT ...]) is refused in a cell since 0.18.0 (it is the sheet's custom effects field's
        form alone); the 0.13.0 operator form ("bonus: +1, Condition, Aid, IF(Origin=Trained)") and
        the 0.10.0 prose form are refused, the message naming the document's map to the new shape.
        An AURA block may carry its effect after a semicolon (0.18.0), the ring as the effect's FOR:
              [AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]
        USE (0.21.0; rulings 215 to 222) lets a check made from a Maneuver's own row be rolled with
        another Attribute and another Constellation's Proficiency Bonus. Exactly three descriptors,
        [EFFECT USE: <Attribute>, <Constellation>, <Maneuver>]:
              [EFFECT USE: Presence, Origin, aid]     Presence and the Origin's Proficiency Bonus
              [EFFECT USE: same, Origin, aid]         the Proficiency Bonus alone
              [EFFECT USE: Presence, same, aid]       the Attribute alone
        The Attribute is might, agility, wits or presence; the Constellation is Origin, a Skill or a
        Defense (a Maneuver, a Lore and a group are refused); "same" in either place is the term
        this check would use without this line, and "same, same" is refused. The third names a
        MANEUVER by its row's name, never a Constellation, a Defense or a scope word, since a USE
        never means every check. It takes IF: RANK(...) and LIMIT: alone. In Foundry the swap is
        offered in the roll dialog only when the roll is made from that Maneuver's Item, ticked
        when its total is strictly higher, one to a roll; checks only, characters only; the line
        has On / Skip / Off on the sheet's Effects tab.
        ALTER (0.22.0; rulings 223 to 230) is a talent's change to one property of what a Maneuver
        GIVES another character (the GIVE lines on the Maneuver's own row; see the action sheets,
        below): [EFFECT ALTER: <Maneuver>.<property>; VALUE: <value>].
              [EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]   Patient Assistance
              [EFFECT ALTER: Aid.critical-failure; VALUE: nothing]                      Sure Assistance
        The properties read are duration and beneficial-duration (VALUE a window: giver opportunity,
        recipient opportunity <N>, encounter) and the four results, critical-success, success,
        failure and critical-failure (VALUE nothing). Any other property is refused as not read yet.
        There is no PRESERVE: an ALTER changes one property and leaves the rest. A GIVE line in a
        talent's cell is refused: it belongs on the Maneuver's row.
        ALTER also reads the property movement (0.24.0; rulings 239 to 244), with the one value
        step, for a Maneuver whose row carries a PERMIT line (the action sheets, below):
              [EFFECT ALTER: Move Together.movement; VALUE: step]                       Coordinated Footwork
        A drag within half Speed made as part of that Maneuver is then a Step for both movers.
        There is no APPLY: and no choose(...): the one line covers both.
        ALTER also reads the property limit (0.25.0; rulings 245 to 251), with the value round or
        encounter, for a Maneuver whose row carries a LIMIT: (the action sheets, below):
              [EFFECT ALTER: Pay It Forward.limit; VALUE: round]                        Reciprocal Effort
        It REPLACES the row's own limit and never adds a use; a row with no LIMIT: stays unlimited.
        Write the word alone: "owner round" is refused, since a limit is always its owner's.
        RED CELLS (2026-11-08; Mike: "highlight those cells in red"): python assets/highlight_automation.py
        paints every Automation cell the grammar cannot read, and every Effect cell whose
        @Maneuver[Name] names no row, solid red (FF9999) with a cell comment giving the grammar's
        message for each bad line and WHY: mis-typed (with the nearest name when one is close), no
        kind yet (the grammar has no word for what the line asks), or not yet readable (the cell is
        right but the sheet it names is not in its _Tree Index, or the workbook it names is one the
        converter does not read). It writes automation-cells-report.md in the project root with the
        same list, the kinds the cells ask for, and the data-shape notes. Fix the cell and run it
        again: its own red and comment go, and a yellow of yours underneath is put back. It reads
        the workbooks directly through assets/lib/parse_cells.mjs (the system's parser and the
        build's resolver), so it works while the converter is refusing to write; --dry-run reports
        without writing; a workbook open in Excel is reported, not written. Not a pipeline step.
        THE ONE PARSE (0.16.0): node assets/parse_rules.mjs runs right after the converter, in
        every pipeline mode, and parses every Automation cell once (tree sheets, action sheets,
        the Backgrounds sheet) with the system's grammar, writing the parsed `rules` beside
        `automation` in trees.json, actions.json and backgrounds.json for every consumer; a line
        it does not know is the ERROR described above, raised there (an error entry on the Item
        under --lenient), and a line the grammar warns about is a WARNING naming the cell. The
        converter, likewise, lets a build through a restructure in progress (2026-11-07): the same
        Maneuver on two sheets of one workbook is a WARNING and one row stands (an enabled row
        over a disabled one, else the earlier sheet), and a tree indexed in two workbooks is a
        WARNING with the first workbook's standing; an action in two WORKBOOKS stays an ERROR. The
        same step reads the Root Talent's feature lines
        ([VIGOR 8], [SIZE Medium], [SPEED 6], [SENSES Low-light vision], [TRAIT Human],
        [LANGUAGE Common, Serrovine]; a Calling's [VIGOR opening 12]) onto the roster's ancestry,
        culture and callings records, where they WIN: the _Tree Index columns Vigor (or HP), Size,
        Speed, Senses, Traits, Languages and Skills, and the tree sheets' Choice and Free Talent
        columns, are RETIRED, read this release with one warning per workbook or sheet, and a
        column that disagrees with the Root's line is an ERROR naming the column (the Grants
        column's precedent; a column reading the converter's own default, Medium, 6 ft or no
        Senses, is taken as saying nothing). It also expands @Maneuver[Name] in any Talent's or
        Background's Effect into the named Maneuver's block (name and cost glyphs, Trigger and
        Requirements when the row has them, then its Effect) from the matching row of the actions
        workbook, keeping the text as written as `effectSource`; a name that is no row is an ERROR.
        Its last line counts what it did: "rules: N rules on M cells (K kinds in use), L legacy
        cells warned; chassis: facts from X roots; markers: Y expanded".
  Enabled? (Mike, 2026-10-01): "Yes" (any case) means the talent ships to Foundry; blank, "No" or
        anything else means it does not. A sheet WITHOUT the column is wholly enabled: a missing
        column means the sheet has not been curated yet, not that it is all off. A constellation
        is enabled when its root (the "x" row) is, since a constellation exists in play when its
        Root does. The converter keeps EVERY row and writes enabled: true|false on each; Foundry
        (the play surface) ships only the enabled rows, while the web app, the compendium docx and
        the plates still show the whole book. It WARNS on an enabled talent under a disabled root,
        and on an enabled talent whose Requires or Free Talent names a disabled talent.
  Choice: a build-time pick the talent demands, written as WHAT is chosen ("Weapon Group",
        "Weapon Group or Technical Weapon"). The Foundry system turns it into a picker when the
        talent is taken and remembers the answer, which is what gives the talent its effect.
        Only for picks made ONCE when the talent is bought; per-use picks (a Zone, a target,
        a Defense) need nothing here. Two talents in the book qualify.
  Free Talent: a talent this one hands over outright, no point spent. May name a talent in
        another constellation (Drilled hands over Weapon Familiarity, which is authored in
        Melee). The converter ERRORS if it names no talent anywhere in the book.
  Root: "x" marks the constellation root, "h" marks a bloodline root (Ancestry trees only).
        EVERY tree needs exactly one "x", identity trees included, even though their roots are
        granted by the chargen choice rather than bought.
  Requires: comma- or "or"-separated talent names, which must exist in the SAME sheet.
  Prerequisites: free prose for narrative gates ("Raised in Serrovane"), not validated; and, on
        a sheet with NO Requires column or an EMPTY one (the Human sheet since 0.13.0; Mike: "the
        Prerequisites column is the one that should have been used in the first place"), the
        requirement too: each comma- or "or"-separated piece that names a Talent of the same
        sheet becomes a Requires, and the rest stays prose that still prints.
  Grants (retired 0.13.0): write "grant: <N>, <Scope>" in Automation (AUTOMATION_GRAMMAR.md). A
        filled cell still reads this release, WARNS, and must agree with the line.
  Action glyphs go in the Talent NAME, not the Effect, in the v4.10 symbols: ❶ ❷ ❸ (one to three
  actions, up to ❻), ⓿ (free), ↺ beside a cost for a Reaction: "Second Wind ❶", "Battle Cry ⓿↺",
  "Parry ❶↺", "Double Slice ❷". A range is "Strike ❶ to ❸" or "Disarm ❶ or ❸". The v3 glyphs
  ◆ (one action per diamond) and ◇ (free) still convert. Requires-matching strips trailing
  glyphs, so Requires "Kip Up" matches the talent "Kip Up ❶".

BACKGROUNDS (backgrounds.xlsx)
  The "Backgrounds" sheet holds one Background per row. Columns (first word wins, order free):
    Background | Description | Effect | Enabled? | Automation | Rarity | Skills | Lore
  Automation (0.16.0) is the tree sheets' column: the Background's Training is its
  "[Athletics trained][Acrobatics trained][Lore trained]" lines, which the Foundry chassis reads as
  its grants. Skills (comma-separated constellations) and Lore are the retired way of saying the
  same and still read where a sheet has them. Enabled? works as on a tree sheet: "Yes" ships the Background to Foundry, anything
  else keeps it out, and a sheet without the column ships every row. Every row is still written
  to assets/backgrounds.json with its flag. The converter WARNS when an enabled Background grants
  a Skill whose constellation root is disabled, since that Training point has nowhere to land.

ACTIONS WORKBOOKS (actions_maneuvers.xlsx, actions_activities.xlsx, actions_endeavors.xlsx; PHB v4.24's three kinds)
  Recognised by a _Tree Index carrying a Name column and no Tree column:  Name | Type | Category
  (actions_activities.xlsx, actions_endeavors.xlsx) or Mike's  Name | Action Type | Category/Type
  (actions_maneuvers.xlsx)
  both read, the Type column being any header containing "type" and OPTIONAL since 0.20.0 (the
  index is a fallback for a row with no Type cell, and python assets/index_sheets.py keeps it
  filled). Any number of them are read; the same action in two of them is an ERROR, a duplicate on
  two sheets of ONE workbook is a WARNING (an enabled row beats a disabled one, else the earlier
  sheet stands), and a sheet named "About" is skipped as notes for the author (as in the equipment
  workbook). Every other sheet holds one action per row. Columns (first word wins, order free):
    Action (or Activity, or Endeavor) | Cost | Traits | Type | Constellation | Prerequisites |
    Requirements | Trigger | Frequency | Range | Target | Duration | Movement Speed | Category |
    Check | Initiative | Description | Effect | Automation | Aura | Enabled?
  Type is the row's own Type cell (Maneuver, Talent Maneuver, Activity, Endeavor), else the
    _Tree Index row of that name, else the sheet's name (with a warning only when the row has no
    Type cell either). An ACTIVITY is an Exploration Mode Item in Foundry (the party sheet's road;
    category "Exploration Mode", its old `exploration:` document id), an ENDEAVOR a Downtime Mode
    one (the Downtime panel; `downtime:`), whichever sheet the row sits on (Treat Wounds on the
    Medicine sheet is one as Search is); neither spends actions, so neither needs a Cost. Every
    other row is a Maneuver, grouped in the pack, the app and the docx by its Category cell (the
    Basic Actions sheet's Movement Maneuvers, Attack Maneuvers, ...) else its sheet.
  BASIC (Mike, 2026-11-08): a Maneuver, Activity or Endeavor is on every character's Actions tab
    in Foundry unless a Talent grants it: its Type is "Talent Maneuver", or a Talent's
    [MANEUVER X] block or @Maneuver[X] marker names it (Rally, Battle Cry, Kip Up, the Ancestry and
    Culture Maneuvers). The build names the rows it read as granted though typed "Maneuver".
  Constellation (0.20.0): the Constellation the row rolls, read rather than inferred from the
    sheet. When it names exactly one Constellation or Defense and the Effect attempts or rolls a
    check, the Foundry Item's check is enabled on it (Climb rolls Athletics from its row, Hide
    Stealth); the Defense it is measured against is read from the Effect when it names one after
    "vs." or "against" (Demoralize vs. Guard). "N/A", a blank, a list ("Melee or Ranged") or an
    Effect that rolls nothing leaves the check off. An Effect saying "Relevant Check" opens the
    picker (Aid, Recall Knowledge).
  Frequency, Range, Target, Duration (0.20.0): strings carried to the Item and printed on its
    sheet, its card, the app and the docx. Duration is an Endeavor's clock on the Downtime panel
    ("7 days"); Movement Speed is an Activity's Travel Speed word (Full, Half, Double; blank reads
    as Full); Check and Initiative (actions_activities.xlsx) name the Constellation or Defense an Activity
    rolls now and for Initiative, "choice" for the member's own pick (Investigate), blank for
    nothing now and Awareness for Initiative. Scout's bonus and Defend's shield are effects set by
    the row's name.
  The "(LORE_NAME)" placeholder is stripped from an action's name and its Constellation cell
    (Well-Read on the Lore Actions sheet), as it is from the Lore template's Talent names.
  Cost takes glyphs or words: ❶, ❷, ❸ (up to ❻), ⓿ (free), ↺ beside a cost for a Reaction
    ("❶↺", "⓿↺"), "❶ to ❸", "❶ or ❸", "❶ (⓿↺)" for a Maneuver whose Reaction half has a cost of
    its own (the book's Aid; the sheet's Aid costs ❶), "1 or 3", "reaction", "free". The v3 forms
    ◆, ◆◆◆, ◇ and "◆ to ◆◆◆" still
    read. Without a Cost column the glyphs in the Action name are read, as for talents; with
    neither, the action costs one action ❶ and the converter names the ones it defaulted. Effect
    is required; a cell reading "None" counts as blank.
  Description is the flavour line; Effect is the rules, rich text welcome. Automation (0.9.0) is
    the same column as on a tree sheet, no longer prose: one bracketed block per line in the
    grammar of AUTOMATION_GRAMMAR.md (feature blocks and [EFFECT ...] blocks, 0.16.0 and 0.17.0),
    parsed by assets/parse_rules.mjs and build_foundry.mjs, which stop on a line they do not know
    (the content loop stores it as a red error line instead). An action's name is also what a
    talent's CHECK line names as its target, so a roll made from the action's row carries the
    bonus, and what a talent's USE line names third (0.21.0), so the swap of Attribute and
    Proficiency Bonus is offered on a roll made from the action's row and on no other. An action
    whose Effect says "Relevant Check" and names no check opens the Relevant Check picker when it
    is used, carrying the action, so Aid's roll is Aid's (0.10.0).
    GIVE (0.22.0; rulings 223 to 230) is written HERE, on the action's own row, and nowhere else:
    what a result of the action's check gives ANOTHER character, one line for each degree that
    gives something. Aid's row, whole:
          [EFFECT GIVE: 2 situation, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]
          [EFFECT GIVE: 3 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = master)]
          [EFFECT GIVE: 4 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = legendary)]
          [EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]
          [EFFECT GIVE: -1 situation, chosen; IF: RESULT(critical failure)]
    A signed value and a bonus type, then "chosen" (the Constellation is named when the result is
    given) or a Constellation by name; exactly one IF: RESULT(<degree>); IF: RANK(roll ...) is the
    rank rolled, and the first line that holds for a degree is its result; UNTIL: <window> sets
    how long it may be used (giver opportunity when left out). In Foundry the check's card carries
    a Give button for the roller and the GM; the recipient's next roll with the Constellation
    uses the result. A talent changes it with ALTER (the tree sheets' Automation, above).
    PERMIT (0.24.0; rulings 239 to 244) is written HERE too, on the action's own row: using the
    action lets the creature you target make one Move now, outside its Opportunity. Move
    Together's row:
          [EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]
    One descriptor, what is permitted (move, the one word so far). FOR: is required and says who
    and how near (allies 0 is an adjacent ally; self is refused). LIMIT: round or encounter is the
    row's Frequency. IF: RANK(...) reads the owner's rank. In Foundry the user pays the row's cost
    at the click and their own next drag is that Move, already paid; the target then drags with no
    request to the GM and pays its own action; each is a Move however short, unless a talent's
    ALTER makes a short one a Step. Nobody targeted, yourself, the wrong kind of creature and a
    second use within the LIMIT are refused; the other requirements are warned about on the card.
    SUBORDINATE (0.25.0; rulings 245 to 251) is written HERE too, on the action's own row: using
    the action performs another Maneuver as part of it. THE SUBORDINATE MANEUVER RULE (Mike,
    2026-11-15): the Maneuver performed is done at THIS row's listed cost and its own cost is never
    charged, unless the row says otherwise (no row does yet). Pay It Forward's row:
          [EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter]
    One descriptor, the Maneuver performed, by name. IF: EFFECT(<Maneuver>, used) is the trigger,
    when the row has one: a roll of yours at your own Opportunity has just used up a bonus another
    creature's Maneuver of that name gave you (a USED EFFECT; the plain EFFECT(<name>) is another
    condition, below, and a SUBORDINATE line does not take it). LIMIT: round or encounter is the row's Frequency, which
    a talent's ALTER of its limit replaces. IF: RANK(...) reads the owner's rank. In Foundry the
    row and a button on the card of the roll that used the bonus up both open the subordinate
    Maneuver's own roll, named for this row; nothing is spent until that roll is made. With no
    trigger, or within the LIMIT, the use is refused. For this to work Aid's own row must carry
    its GIVE lines, or no Aid gives a result to use up.
  EFFECTS BY NAME (0.31.0; Mike, 2026-11-17: "REQUIRES should just look for a string in that
    Effects list"). A creature's Effects are its Conditions (prone, off-guard, and the Bind's
    bound, controlling and controlled among them) and every other active effect on it, by its
    name: a NAMED EFFECT, put on by a Maneuver's APPLY line (below) or by hand in Foundry (the
    plus beside Active Effects on a sheet's Effects tab). Three ways to read one:
          [REQUIRES effect Taking Cover]             on an action's row: listed only with that Effect
          [REQUIRES bind, neutral]                   ... only in a neutral Bind (controlling, controlled)
          [REQUIRES creature adjacent with dying]    ... only beside a creature that has it
          [EFFECT DEF: 1 situation; IF: EFFECT(Taking Cover)]     a bonus while YOU have it
          [EFFECT ATK: 1 situation; IFT: EFFECT(prone)]           a bonus while the OTHER PARTY has it
    IF: is the creature rolling and IFT: the roll's other party; only CHECK, ATK, DEF, INIT and
    SPEED lines read EFFECT(<name>). A bare word in [REQUIRES ...] is still a Condition or a known
    word, so a named Effect there always has the word "effect" in front, and a typo is an error.
    A Condition's name is reserved: EFFECT(prone) is always the Condition.
  PUTTING EFFECTS ON (0.32.0; Mike, 2026-11-17: the tags are APPLY and REMOVE). On an action's
    own row, what using it puts on a creature or takes off, one block to a line:
          [EFFECT APPLY: prone, target; IF: RESULT(success)]            Trip: the target is Prone
          [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]
          [EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]
          [EFFECT APPLY: Taking Cover]                                  Take Cover: a named Effect
          [EFFECT REMOVE: prone]                                        Stand
    The Effect is a Condition (a number after one that carries a value) or a name of your own.
    After it, "self" (the default: whoever uses the action) or "target" (the one creature it is
    used on). IF: RESULT(<degree>) is the result of the action's check; with none the line stands
    whenever the action is used. IF: COST(<n>) is the number of actions it was paid with, for a
    row that prints a table for each cost. UNTIL: says how long: giver opportunity (until the
    user's next Opportunity begins), giver opportunity end, recipient opportunity (through the
    end of the next Opportunity of the creature the Effect is on), recipient opportunity start,
    encounter; with none, until something takes it off. In Foundry an Effect on the user lands
    at once and one on a target is a button on the check's card. A target line needs
    IF: RESULT(...). A line that reads what you put on a creature: IFT: EFFECT(wrong-footed, mine).
    Not for the rows the system runs itself (Strike, Cast, Recenter, Reload, Move, Step, Rush).
  THE CHECK IT ROLLS (0.34.0; Mike, 2026-11-19: "wouldn't it make sense if the check was also
    using automation grammar, as well as the success/failure effects?"). On an action's own row,
    one block that says what it rolls and what the roll is read against:
          [CHECK Athletics]                           roll Athletics; the Threshold is typed
          [CHECK Athletics vs Guard]                  against the target's Guard
          [CHECK Athletics or Acrobatics vs Guard]    whoever USES it picks which is rolled
          [CHECK Athletics vs Evade or Guard]         the TARGET picks which Defense answers
          [CHECK relevant]                            any Constellation, picked when rolled (Aid)
          [CHECK Crafting vs 15]                      a Threshold of 15, which the roll may change
    Left of "vs": relevant, or Constellations by the names the trees print (a Skill, a Defense,
    Melee, Ranged, a Combat Style; never a Lore, never a Maneuver). Right of "vs": Defenses, or a
    whole number. "or" is a choice, made by whoever it affects: left of "vs" the one using it,
    right of "vs" the target. One CHECK block to a row. In Foundry the target's pick is a card
    with a button for each Defense, pressed by the target's player (the GM for an adversary); and
    when an adversary uses the action on a player's character, the player rolls the Defense they
    pick against the adversary's number for that Constellation (typed on the adversary's sheet).
    A row with NO block keeps the old guess from its prose (the Constellation column, "attempt
    ... check" in the Effect, the word after "vs."), and the build lists those rows by name.
    CHECK with no colon is this block. CHECK: with a colon, inside [EFFECT ...], is still a bonus
    to checks. Not for an Activity (its Check column, else its Constellation column, is the
    source) or an Endeavor, and nothing reads it on the rows the system runs itself (Strike,
    Gain Control, Recenter, Reload, Pass, Raise a Shield).
  Aura (0.5.1): the range the action draws around its user, in the same grammar as on a talent
    sheet: "30 ft", "15 ft allies", "15 ft enemies", "visible" appended to show the ring by
    default, "none" when the Effect's "within N feet" is centred elsewhere, blank for no aura.
  Writes assets/actions.json, every action stamped with the `sheet` and `workbook` it came from.
    THE SHEET WINS: any action it names retires the roster.json row of the same name from the
    compendium, the app and the compendium docx, under the same document id. Roster rows no sheet
    carries yet stay (none today: the roster's Exploration and Downtime blocks went with 0.20.0,
    replaced by actions_activities.xlsx and actions_endeavors.xlsx, and every Encounter row is named by a sheet).
    Basic rows (above) appear on every character's Actions tab in Foundry, read from the
    compendium rather than copied.
  Enabled? works as on a tree sheet: "Yes" ships the action to Foundry, anything else keeps it
    out, and a sheet without the column ships every row. Every action is still written to
    actions.json with its flag. A disabled action STILL retires the roster row of the same name
    (the sheet is authoritative for any action it names), so a blank Maneuver row ships nowhere in
    Foundry and keeps the roster's row out too. Aid reads Yes (Mike, 2026-10-03) and ships.
  actions_maneuvers.xlsx (maneuvers.xlsx until 2026-11-15; Mike, 2026-10-01, T17; restructured
  2026-11-07 for PHB v4.24) holds the
    Maneuvers: a Basic Actions sheet whose Category column carries the book's Chapter 8 groups
    (Movement, Attack, Defense & Recovery, Other Basic Maneuvers), an Ancestry Actions and a
    Culture Actions sheet for the Talent-granted Maneuvers, and one "<Skill> Actions" sheet per
    Skill Constellation for the book's Skill action tables, each row naming its Constellation.
    actions_activities.xlsx holds the eight Exploration Activities and actions_endeavors.xlsx the
    two Endeavors
    (Retrain, Train; Provision left the book in v4.24). It was scaffolded ONCE from the roster's Maneuver tables by
    assets/make_maneuvers_xlsx.py: names written plain with the glyphs moved to Cost, the
    "Requirements" and "Trigger" lines lifted out of the Effect into their columns, Type "Basic
    Action", Aura filled where the text earns it (Seek, 30 ft), and Enabled? BLANK on every row.
    Blank is the point: naming a roster row retires it, so the roster's Maneuvers ship nowhere in
    Foundry until a row reads Yes, one at a time as Mike curates them. The file is a SOURCE now:
    edit it, never regenerate it (the script refuses to overwrite it; --force does, and loses every
    edit made since). Aid was left out of the scaffold because actions.xlsx, Mike's untracked
    working file, then defined it; on 2026-10-03 he moved Aid onto the "Watching, Deceiving &
    Helping" sheet (row 9) with Enabled? = Yes and deleted actions.xlsx, so maneuvers.xlsx is the
    one actions workbook and Aid ships for the first time, under the roster row's old document id.
    Since 0.20.0 the index is filled by python assets/index_sheets.py and a row typed by its own
    Type cell is not warned about; Parry, Void, Counter, Intercept and Avert Gaze are index names
    with no row on any sheet (the Reactions are Talents since PHB v4.21), reported each run, and
    an index name with no row RETIRES a roster row of the name exactly as a blank sheet row did
    (actions.json carries them as `retired`), so deleting a blank row and keeping its name in the
    index keeps the action off the table.
  A workbook that goes missing keeps what it last wrote: the converter carries over, as found, the
    actions of any workbook actions.json names that is missing from data/, and WARNS, so a checkout
    without that workbook still retires the roster rows it retired. An action a present workbook
    now defines is that workbook's, and the run says the two will collide when the absent one is
    back (which is how Aid's move was reported: "'Aid' was actions.xlsx's and is now defined in
    maneuvers.xlsx, which wins"). With one workbook in data/ and nothing absent, the rule has
    nothing to carry today.

EQUIPMENT WORKBOOK (equipment.xlsx)
  The ONLY source for weapons, armor, shields and ammunition (Mike, 2026-10-01, v4.10 sync
  report ruling 64; the only source since 2026-11-15, when the handbook's Chapter 5 tables it
  was built from left the book). It has NO _Tree Index: the converter recognises it by its
  Weapons, Armor, Shields and Ammunition sheets, and ignores any other sheet in it (About).
  Shields are their own sheet because their columns differ from armor's. One piece per row.
  Columns (first word wins, order free):
    Weapons: Weapon | Kind | Handling | Group | Damage | Reach | Range | Traits | Price | Notes | Enabled?
    Armor:   Piece | Zone | Protection | Load | Price | Traits | Type | Description | Enabled?
             (Type was headed Material through v4.15; both headers read)
    Shields: Shield | Bonus | Hardness | Load | Price | Note | Enabled?
    Ammunition: Ammunition | Group | Price | Description | Enabled?   (0.30.0; the name column
             may also be headed Item or Weapon)
  AMMUNITION (0.30.0; Mike added the sheet on 2026-11-15, the system counting what a Reload
    uses). One kind per row. A trailing "(10)" in the name is the stack: "Arrows (10)" is the
    item Arrows, ten to a stack, and Price is the stack's ("1 gp" ships as "1 gp per 10"). Group
    is the WEAPON GROUP it feeds, spelled as the Weapons sheet spells it (Bows, Crossbows,
    Slings): that is how a Reload finds it, one piece for each shot it loads, from whatever the
    character carries for that Group, a stack In hand first and then by name. With none left the
    weapon is loaded anyway and the Reload's card says so. A Group is required (ERROR); the
    converter WARNS on a Group no weapon carries, on a weapon with the Reload trait whose Group
    has no ammunition, and on ammunition that ships while no weapon that takes it is enabled.
    Written as the `ammunition` list of equipment.json and as gear Items in an Ammunition folder
    of the Equipment pack; the web app and the compendium docx do not list it.
  Kind is Melee or Ranged, and decides which roster table the weapon lands in. Handling is
    Intuitive, Practiced or Technical. Damage is dice, a space and a type letter ("1d8 S"; B, P
    or S). Group is the weapon group the Combat Styles name ("Swords", "Crossbows").
  Reach is the MELEE column ("Adjacent" or "N ft") and Range the RANGED one ("N ft"). A Melee row
    needs a Reach and a Ranged row needs a Range (ERRORS); the other column stays blank. A thrown
    melee weapon's range is a trait ("Thrown 10 ft"), as the book prints it. The converter WARNS
    on a distance it cannot read as feet and on a value in the wrong column (the roster's melee
    table has no Range and its ranged table no Reach, so such a value reaches equipment.json only).
  Traits are comma-separated as the book prints them. equipment.json carries them as a list; the
    roster blocks get them joined back with ", ". "---", the v4.21 armor table's marker for a piece
    with no Traits, reads as blank (so do "-", "—", "none" and "n/a").
  Type (Armor; PHB v4.21's armor types, the Material column until v4.15) is Padded, Leather,
    Mail, Lamellar, Brigandine, Splint or Plate (Scale still reads, for an old sheet; Foundry
    migrates a stored scale piece to lamellar). Blank, it is derived from the first Trait, which is
    how the older books printed a piece ("Padded, Comfort" is Padded); a first Trait that is no
    type is then an ERROR, and a Type that disagrees with the first Trait is a WARNING. Description
    is the piece's one line of prose, carried to the armor Item's description (since 0.30.0;
    through 0.29.0 the converter read it and the Foundry build dropped it).
    Zone is Head, Torso, Arms or Legs. The Visored and Fitted traits are what the system acts on
    since 0.11.0 (a lowered visor, an adjusted harness); Comfort, Noisy, Quiet and Attended read as
    before.
  Protection, Load, Bonus and Hardness must be whole numbers (ERRORS). Bonus is the shield's Gear
    bonus to Guard when Raised, 0 for the Tower Shield, whose footnote is its Note. Notes
    (Weapons) is free prose: Unarmed Strike carries the book's "Varies; typically" remark there,
    with the typical values in the data columns. Price is "5 gp" or blank.
  Duplicate names on a sheet, and the same piece in two workbooks, are ERRORS.
  Writes assets/equipment.json (weapons, armor, shields, ammunition; every row with its enabled
    flag) AND
    regenerates the roster.json blocks weaponsMelee, weaponsRanged, armorPieces and shields from
    EVERY row, enabled or not, in the positional shapes the web app, the Constellation Compendium
    docx and the Foundry build already read. Those four blocks are generated the way the
    ancestries block is: hand edits to them are pointless, the next run overwrites them, and the
    run says so. The armor types list, handling and the weapon and armor trait tables stay
    hand-kept in roster.json; nothing asked for them. A checkout without the workbook keeps equipment.json and
    the roster as found, with a warning saying so.

TERRAIN KINDS (0.18.0): terrainKinds is a hand-kept block of assets/roster.json, rows of
  [name, description, difficulty, colour]. Each row is a kind of difficult terrain the map's
  Difficult terrain region behavior can be: named in its Kind select, in a Talent's
  [EFFECT IGNORE: terrain, <kind>] descriptors (checked against the block by parse_rules.mjs and
  build_foundry.mjs, so an unknown kind's message lists these names), on the ruler's label and in
  the player's overlay (the colour, #rrggbb). The slug is slugify(name) ("Shallow Water" is
  shallow-water), so renaming a row changes the slug a region stores. difficulty is the kind's
  usual multiplier, 1 to 5, printed in the Constellation Compendium docx's Difficult terrain table
  (the region's own Cost field is what Foundry charges). Keep an Other row: it is the behavior's
  initial kind. The build writes the block to foundry/starwrought/content/terrain.json and refuses
  a missing block, a repeated name, a bad colour or difficulty, or no Other. Adding a kind is a row
  here and a content loop; no code changes.
  Enabled? works as on a tree sheet: "Yes" ships the row to Foundry, anything else keeps it out,
    and a sheet without the column ships every row. Every row is still written to equipment.json
    with its flag, and every row still goes into the roster blocks, because the web app and the
    compendium docx are the authoring views of the whole book. Foundry (build_foundry.mjs) reads
    equipment.json and ships only the enabled rows, under the same document ids as before, so an
    Item already on a character sheet keeps its UUID when its row is disabled and re-enabled.

RICH TEXT: bold / italic / underline / strikethrough / font color applied INSIDE the
Effect or Description cell mirrors into the app, the tree explorer, and the Player's Handbook.
Newlines in a cell become <br>.

Rules the converter enforces as ERRORS: exactly one root per tree; capstones (★) must be tier L;
Requires must name real talents in the same tree; tier must be T/E/M/L; Effect can't be empty;
Ancestry Vigor (or HP) must be a whole number; a blank Attribute cell on a sheet headed Attribute;
an Aura cell beside an "aura:" Automation line. Every talent costs 1.

It WARNS (does not block) on the Root Rule: every root should hang on something that gets ROLLED
and should IMPROVE at Expert/Master/Legendary. The culture roots pass (their Diplomacy bonus
scales); the two Human bloodline roots still break it on purpose, and since v4.21 so do the five
caster Callings' roots and the magical Training roots, whose texts name no higher tiers yet. See
v3.0-sync-report.md section 4 and the v4.21 report.
It also WARNS on Enabled? gaps: an enabled talent whose constellation root is disabled, an enabled
talent whose Requires or Free Talent names a disabled talent, and an enabled Background granting a
Skill whose root is disabled. The run ends its counts with one line of what Foundry will ship
("enabled for Foundry: N of 31 constellations, N of 177 talents, ...").

To sync after editing, from the project root, one of two paths:

  THE CONTENT LOOP (Foundry may stay open; ADDING CONTENT at the top of this file):
  sync_content.cmd   or   node assets/build_all.mjs --content
    -> assets/trees.json + backgrounds.json + languages.json + actions.json + equipment.json, and
       the generated blocks of roster.json                       (xlsx_to_trees.py)
    -> the same JSON with every Automation cell parsed once into `rules`, the Roots' feature lines
       on the roster records, the @Maneuver markers expanded    (parse_rules.mjs, 0.16.0)
    -> Starwrought_App.html + the constellation viewer           (inject.py)
    -> assets/constellations/*.png, only the plates whose Constellation changed or is new; the
       sidecar .plates.json beside them remembers the rest        (render_constellations.py --changed)
    -> the automation framework's self-test, no output of its own (test_rules.mjs, 0.9.0)
    -> foundry/starwrought/packs/_source/**, with index.json; an Automation line the framework
       does not know stops here, naming the cell                 (build_foundry.mjs --no-compile)
    -> foundry/starwrought/content/{constellations,chassis,sync}.json, the runtime indexes the
       in-game Sync re-reads, and foundry/starwrought/assets/constellations/*.png, copied from
       assets/ and pruned to match                                 (build_foundry.mjs, the same run)
    -> the style check, the version stamps, and handbook drift as a warning
  then, in the open Foundry world, as the GM: Settings > STARWROUGHT > Sync content.

  THE FULL PIPELINE (Foundry CLOSED: a release, or a handbook sync):
  node assets/build_all.mjs
    everything above, every plate, plus the fillable and Mira character sheets (sheet_gen.py), the
    Constellation Compendium docx (build_phb.js), the compiled LevelDB compendia (build_foundry.mjs
    compiles them, which fails while Foundry holds them open) and the features docx; then the
    version stamps and the handbook drift check, which exits 1 while the handbook on the shelf is
    newer than data/SYNC.json says.

  The steps one at a time, if you want one of them alone:
  python assets/xlsx_to_trees.py             -> assets/trees.json + backgrounds.json + languages.json
                                                + actions.json + equipment.json, and the ancestries,
                                                cultures, weaponsMelee, weaponsRanged, armorPieces and
                                                shields blocks of roster.json
  node   assets/parse_rules.mjs              -> the same files with `rules` beside every Automation cell,
                                                the chassis facts and the @Maneuver markers (0.16.0)
  python assets/inject.py                    -> Starwrought_App.html + the constellation viewer
  python assets/render_constellations.py     -> assets/constellations/*.png (--changed: only what moved)
  python assets/sheet_gen.py                 -> the fillable and Mira character sheets
  node   assets/build_phb.js                 -> Starwrought_Constellation_Compendium.docx
  node   assets/build_foundry.mjs            -> the pack sources and index.json, the runtime indexes under
                                                foundry/starwrought/content/ (constellations.json,
                                                chassis.json, sync.json), the plates copied into
                                                foundry/starwrought/assets/constellations/, and the
                                                compiled packs (--no-compile: everything but the
                                                LevelDB compile)

Then check it still runs, and still reads right:
  python -c "import re,io; h=io.open('Starwrought_App.html',encoding='utf-8').read(); io.open('app.js','w',encoding='utf-8',newline='\n').write(max(re.findall(r'<script>(.*?)</script>',h,re.S),key=len))"
  node assets/smoke_test.js app.js           -> expects SMOKE CLEAN
  python assets/check_style.py               -> no em-dashes in game prose, no borrowed setting names

No PYTHONUTF8 needed: the scripts declare their encodings. Needs openpyxl, matplotlib, reportlab,
python-docx and the docx npm package. build_all.mjs (and so sync_content.cmd) finds a Python that
has the four modules on its own: it tries STARWROUGHT_PYTHON if set, then the project's own .venv,
then python on PATH, then the py launcher, then every install the launcher lists, and names the
one it chose in its header. A double-click can resolve a different python than a shell does, and
a `pip install --user` lands in one Windows account's profile where another account's python
cannot see it (this PC has two accounts), which is why it probes rather than trusts. When nothing
on the machine has them it makes .venv in the project root (gitignored) and installs the four
modules into it, a minute or two the first time, and uses that from then on; .venv belongs to the
folder, so every account that can read the folder shares it. The individual steps above run with
whichever python you type; to use the project's, type .venv\Scripts\python instead of python.
