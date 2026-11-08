STARWROUGHT talent authoring
============================
Any number of .xlsx files in this folder: split them however you like (e.g. one per
category). RULE: each spreadsheet needs its own "_Tree Index" sheet listing the trees
inside THAT file. The converter merges every file; the same tree in two files is an error;
sheets missing from their file's index are ignored with a warning. A workbook open in Excel
(~$lock file present) is converted from its last saved version, with a warning saying so.
  THE INDEX TOOL (0.20.0; Mike, 2026-11-08: "generate/re-generate/update the _Tree Index tabs
  in all of them"): python assets/index_sheets.py brings every workbook's _Tree Index up to the
  sheets it holds. A tree sheet with no row gets one with its Category (ancestries.xlsx ->
  Ancestry, skills.xlsx -> Skill, and so on) and its other cells blank and named in the report
  (Primary Attribute and Parent are hand-kept, so the tool never guesses them); an actions
  workbook's index gets one row per action with the row's Type and the sheet's Category or name;
  an index row whose sheet or row is gone is REPORTED with the nearest name, never dropped;
  filled cells are never touched; a workbook is saved only when a cell changed, after a copy to
  backup/index-<date>/. --dry-run reports only. A workbook open in Excel is skipped.

ADDING CONTENT: the loop (Mike, 2026-10-03; system 0.8.0)
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
  magic.xlsx). The v1.8 spellings Save and Heritage still convert, as aliases
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
  pointless. The _Tree Index of cultures.xlsx may carry Languages (comma separated, "Serrovine,
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
              [EFFECT CHECK: 2 situation, diplomacy; IF: CLAIM(when trading)]   the player's checkbox
        Blank lines are nothing, a line beginning with "#" is a comment, case never matters, one
        trailing period inside a block is tolerated. The converter copies the cell through as text
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

ACTIONS WORKBOOKS (maneuvers.xlsx, activities.xlsx, endeavors.xlsx; PHB v4.24's three kinds)
  Recognised by a _Tree Index carrying a Name column and no Tree column:  Name | Type | Category
  (activities.xlsx, endeavors.xlsx) or Mike's  Name | Action Type | Category/Type  (maneuvers.xlsx)
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
    as Full); Check and Initiative (activities.xlsx) name the Constellation or Defense an Activity
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
    bonus. An action whose Effect says "Relevant Check" and names no check opens the Relevant
    Check picker when it is used, carrying the action, so Aid's roll is Aid's (0.10.0).
  Aura (0.5.1): the range the action draws around its user, in the same grammar as on a talent
    sheet: "30 ft", "15 ft allies", "15 ft enemies", "visible" appended to show the ring by
    default, "none" when the Effect's "within N feet" is centred elsewhere, blank for no aura.
  Writes assets/actions.json, every action stamped with the `sheet` and `workbook` it came from.
    THE SHEET WINS: any action it names retires the roster.json row of the same name from the
    compendium, the app and the compendium docx, under the same document id. Roster rows no sheet
    carries yet stay (none today: the roster's Exploration and Downtime blocks went with 0.20.0,
    replaced by activities.xlsx and endeavors.xlsx, and every Encounter row is named by a sheet).
    Basic rows (above) appear on every character's Actions tab in Foundry, read from the
    compendium rather than copied.
  Enabled? works as on a tree sheet: "Yes" ships the action to Foundry, anything else keeps it
    out, and a sheet without the column ships every row. Every action is still written to
    actions.json with its flag. A disabled action STILL retires the roster row of the same name
    (the sheet is authoritative for any action it names), so a blank Maneuver row ships nowhere in
    Foundry and keeps the roster's row out too. Aid reads Yes (Mike, 2026-10-03) and ships.
  maneuvers.xlsx (Mike, 2026-10-01, T17; restructured 2026-11-07 for PHB v4.24) holds the
    Maneuvers: a Basic Actions sheet whose Category column carries the book's Chapter 8 groups
    (Movement, Attack, Defense & Recovery, Other Basic Maneuvers), an Ancestry Actions and a
    Culture Actions sheet for the Talent-granted Maneuvers, and one "<Skill> Actions" sheet per
    Skill Constellation for the book's Skill action tables, each row naming its Constellation.
    activities.xlsx holds the eight Exploration Activities and endeavors.xlsx the two Endeavors
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
  Authoritative for weapons, armor and shields (Mike, 2026-10-01; v4.10 sync report ruling 64),
  built from the handbook's Chapter 5 tables. It has NO _Tree Index: the converter recognises it
  by its Weapons, Armor and Shields sheets, and ignores any other sheet in it (About). Shields are
  their own sheet because the book keeps them apart from armor and their columns differ. One
  piece per row. Columns (first word wins, order free):
    Weapons: Weapon | Kind | Handling | Group | Damage | Reach | Range | Traits | Price | Notes | Enabled?
    Armor:   Piece | Zone | Protection | Load | Price | Traits | Type | Description | Enabled?
             (Type was headed Material through v4.15; both headers read)
    Shields: Shield | Bonus | Hardness | Load | Price | Note | Enabled?
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
    is the piece's one line of prose from the v4.21 table, carried to the Item and the tables.
    Zone is Head, Torso, Arms or Legs. The Visored and Fitted traits are what the system acts on
    since 0.11.0 (a lowered visor, an adjusted harness); Comfort, Noisy, Quiet and Attended read as
    before.
  Protection, Load, Bonus and Hardness must be whole numbers (ERRORS). Bonus is the shield's Gear
    bonus to Guard when Raised, 0 for the Tower Shield, whose footnote is its Note. Notes
    (Weapons) is free prose: Unarmed Strike carries the book's "Varies; typically" remark there,
    with the typical values in the data columns. Price is "5 gp" or blank.
  Duplicate names on a sheet, and the same piece in two workbooks, are ERRORS.
  Writes assets/equipment.json (weapons, armor, shields; every row with its enabled flag) AND
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
