STARWROUGHT talent authoring
============================
Any number of .xlsx files in this folder: split them however you like (e.g. one per
category). RULE: each spreadsheet needs its own "_Tree Index" sheet listing the trees
inside THAT file. The converter merges every file; the same tree in two files is an error;
sheets missing from their file's index are ignored with a warning. A workbook open in Excel
(~$lock file present) is converted from its last saved version, with a warning saying so.

ADDING CONTENT: the loop (Mike, 2026-10-03; system 0.8.0)
  Add rows to a sheet, a sheet to a workbook, or a whole new workbook in this folder. A new
  workbook needs its own "_Tree Index" sheet naming the trees inside it, as the first paragraph
  says; an actions workbook carries a  Name | Type | Meta note  index instead (ACTIONS WORKBOOKS,
  below); weapons, armor and shields live in equipment.xlsx and nowhere else (EQUIPMENT WORKBOOK,
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
  Automation (0.9.0; the operator grammar since 0.13.0): what the Foundry system should DO with
        the talent, one rule per line, in the grammar the system owns. THE REFERENCE IS
        AUTOMATION_GRAMMAR.md IN THE PROJECT ROOT: the shape of a line, every kind with its
        arguments, every operator, the vocabularies, the level-1 Human written out, what a rule
        does and does not do in play, and the build's messages. It is kept current with every
        change to the code, and the build fails when a kind or an operator it knows is not named
        there. In short:
              <kind>: <argument>, <argument>, ... [, <OPERATOR>(...)] ...
              bonus: +1, Condition, Aid, IF(Origin=Trained)             a typed bonus to a roll
              grant: 1, Calling                                          a Talent Point at creation
              aura: 15ft, allies, VISIBLE                                the ring on the map
              prevent: Prone, ONCE(encounter)                            an effect does not land
        Blank lines are nothing, a line beginning with "#" is a comment, case never matters, one
        trailing period is tolerated. The converter copies the cell through as text and parses
        nothing; build_foundry.mjs parses it, and a line it does not know is an ERROR that stops
        the build (and so sync_content.cmd) naming the Constellation, the Talent and the line,
        before the sources are written. The same line typed into a world Item's textarea in
        Foundry saves and is marked on the Item sheet rather than refused. The action sheets take
        the same column. The 0.10.0 prose form ("bonus: +1 Condition to Aid if Human is Expert")
        is retired and refused with the new shape printed.
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
    Background | Rarity | Description | Effect | Skills | Lore | Enabled?
  Skills names the constellations the Background grants Training in, comma-separated; Lore names
  its Lore. Enabled? works as on a tree sheet: "Yes" ships the Background to Foundry, anything
  else keeps it out, and a sheet without the column ships every row. Every row is still written
  to assets/backgrounds.json with its flag. The converter WARNS when an enabled Background grants
  a Skill whose constellation root is disabled, since that Training point has nowhere to land.

ACTIONS WORKBOOKS (maneuvers.xlsx; the only one since 2026-10-03)
  Recognised by a _Tree Index carrying  Name | Type | Meta note  instead of Tree | Category. Any
  number of them are read; the same action in two of them is an ERROR, and a sheet named "About"
  is skipped as notes for the author (as in the equipment workbook). Every other sheet holds one
  action per row. Columns (first word wins, order free):
    Action | Cost | Traits | Type | Prerequisites | Requirements | Trigger | Description | Effect |
    Automation | Aura | Enabled?
  Type comes from the row's own Type cell if there is one, else the _Tree Index row of that name,
    else the sheet's name (with a warning that the action is not in the index). A Type beginning
    with "Basic" puts the action on every character's Maneuvers tab in Foundry.
  Cost takes glyphs or words: ❶, ❷, ❸ (up to ❻), ⓿ (free), ↺ beside a cost for a Reaction
    ("❶↺", "⓿↺"), "❶ to ❸", "❶ or ❸", "❶ (⓿↺)" for a Maneuver whose Reaction half has a cost of
    its own (the book's Aid; the sheet's Aid costs ❶), "1 or 3", "reaction", "free". The v3 forms
    ◆, ◆◆◆, ◇ and "◆ to ◆◆◆" still
    read. Without a Cost column the glyphs in the Action name are read, as for talents; with
    neither, the action costs one action ❶ and the converter names the ones it defaulted. Effect
    is required; a cell reading "None" counts as blank.
  Description is the flavour line; Effect is the rules, rich text welcome. Automation (0.9.0) is
    the same column as on a tree sheet, no longer prose: one rule per line, "kind: arguments", a
    "#" line a comment, parsed by build_foundry.mjs, which stops on a line it does not know; the
    kinds and their syntax are under Tree columns, above (one today, "bonus"). An action's name is
    also what a talent's "bonus ... to <Maneuver>" line is matched against, so a roll made from the
    action's row carries the bonus. An action whose Effect says "Relevant Check" and names no
    check opens the Relevant Check picker when it is used, carrying the action, so Aid's roll is
    Aid's (0.10.0).
  Aura (0.5.1): the range the action draws around its user, in the same grammar as on a talent
    sheet: "30 ft", "15 ft allies", "15 ft enemies", "visible" appended to show the ring by
    default, "none" when the Effect's "within N feet" is centred elsewhere, blank for no aura.
  Writes assets/actions.json, every action stamped with the `sheet` and `workbook` it came from.
    THE SHEET WINS: any action it names retires the roster.json row of the same name from the
    compendium, the app and the compendium docx, under the same document id. Roster rows no sheet
    carries yet stay. Actions typed "Basic Action" appear on every character's Maneuvers tab in
    Foundry, read from the compendium rather than copied.
  Enabled? works as on a tree sheet: "Yes" ships the action to Foundry, anything else keeps it
    out, and a sheet without the column ships every row. Every action is still written to
    actions.json with its flag. A disabled action STILL retires the roster row of the same name
    (the sheet is authoritative for any action it names), so a blank Maneuver row ships nowhere in
    Foundry and keeps the roster's row out too. Aid reads Yes (Mike, 2026-10-03) and ships.
  maneuvers.xlsx (Mike, 2026-10-01, T17) holds the Encounter Mode Maneuvers: one sheet per group
    of the handbook's Chapter 2 tables (Motion; Attack; Defense & Recovery; Watching, Deceiving &
    Helping; Handling Things; Special). It was scaffolded ONCE from the roster's Maneuver tables by
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
    Aid is not in the _Tree Index yet, so the converter types it from its Type cell and WARNS every
    run until the row is added.
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
                                                weaponsMelee, weaponsRanged, armorPieces and shields
                                                blocks of roster.json
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
