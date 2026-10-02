STARWROUGHT talent authoring
============================
Any number of .xlsx files in this folder: split them however you like (e.g. one per
category). RULE: each spreadsheet needs its own "_Tree Index" sheet listing the trees
inside THAT file. The converter merges every file; the same tree in two files is an error;
sheets missing from their file's index are ignored with a warning. A workbook open in Excel
(~$lock file present) is converted from its last saved version, with a warning saying so.

Index columns:  Tree | Category | Feeds (Might/Agility/Wits/Presence) | Flare Triggers | Meta note | Parent
  Parent (v4.10): names the parent Constellation whose rank this tree's Talents also count toward.
  Melee and Ranged are the parents; every Combat Style names one of them. Rank only is inherited:
  the parent's own Talents must still be bought, and a Talent feeds its Attribute once. The
  converter ERRORS on a Parent that names no tree, or one that has a parent of its own.
  Category must be one of: Skill, Defense, Weapon, Combat Style, Armor, Calling, Ancestry,
  Culture, Bloodline, Background. The v1.8 spellings Save and Heritage still convert, as aliases
  for Defense and Bloodline (CATALIAS in xlsx_to_trees.py), and are normalised on the way in.
  Skill / Defense / Weapon / Combat Style / Armor trees REQUIRE a tree-level Feeds (untrained fallback).
  Ancestry rows may also carry: Vigor (or HP) | Size | Speed | Senses | Summary; those generate
  the "ancestries" block of roster.json, so the chassis is authored once, here. Speed is feet per
  Move (a Human's is 6).
  Calling rows may carry Skills: the Training the Calling grants at creation. A Calling's Vigor is
  NOT authored here: it is the third column of the hand-kept callings block of assets/roster.json,
  and since PHB v4.11 that column is the Calling's Opening Vigor (paid once, at 1st level, by your
  first Calling: Berserker 12, Ambusher 8, Hunter, Bravo and Weaponmaster 10), not Vigor per level.
  The Ancestry's Vigor stays per level; the two meet in Vigor = 10 + Opening Vigor + (Ancestry
  Vigor + Endure Bonus) × level, where the Endure Bonus is Endure Training's conditioning clause
  (0 until Expert, then 1 / 2 / 3).
  Culture rows may carry Skills, but v1.8 cultures grant no skill points, so it stays empty.

Tree columns:   Talent | Tier (T/E/M/L) | Root | Requires | Prerequisites | Description | Effect |
                Feeds (blank = tree default) | Grants | Choice | Free Talent | Enabled? | Aura
  Column ORDER does not matter; the first word of the header does.
  Aura (0.5.1): the Effect's "within N feet", drawn on the map around the carrier. Accepted:
        "N ft" or "N feet" (everyone), "N ft allies", "N ft enemies", "all" spelled out for
        everyone, "visible" appended to pin the ring by default once an encounter starts
        ("15 ft allies visible"), "none" when the circle is centred somewhere other than the
        carrier (Rebounding Toss), blank for no aura. Anything else is a VALIDATION ERROR and
        nothing is written. The converter WARNS when an Effect says "within N feet" and the cell
        is blank, the sheet has no Aura column, or the cell names a different N. "Within reach"
        and "adjacent" get no cell: the reach bands draw those. The action sheets take the same
        grammar.
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
  Prerequisites: free prose for narrative gates ("Raised in Serrovane"). Not validated.
  Grants: restricted talent points this talent hands out. Parsed forms only:
        "<n> in one|any|different <Skill|Calling|Combat Style|Armor|Save|Weapon|opened|anywhere>"
        "<n> open <non-Skill|anywhere>"
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

ACTIONS WORKBOOKS (actions.xlsx, maneuvers.xlsx)
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
    its own (Aid), "1 or 3", "reaction", "free". The v3 forms ◆, ◆◆◆, ◇ and "◆ to ◆◆◆" still
    read. Without a Cost column the glyphs in the Action name are read, as for talents; with
    neither, the action costs one action ❶ and the converter names the ones it defaulted. Effect
    is required; a cell reading "None" counts as blank.
  Description is the flavour line; Effect is the rules, rich text welcome. Automation is prose for
    now: it travels onto the Foundry Item and its sheet, and nothing acts on it yet.
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
    (the sheet is authoritative for any action it names), so until Aid reads Yes it ships nowhere
    in Foundry.
  maneuvers.xlsx (Mike, 2026-10-01, T17) holds the Encounter Mode Maneuvers: one sheet per group
    of the handbook's Chapter 2 tables (Motion; Attack; Defense & Recovery; Watching, Deceiving &
    Helping; Handling Things; Special). It was scaffolded ONCE from the roster's Maneuver tables by
    assets/make_maneuvers_xlsx.py: names written plain with the glyphs moved to Cost, the
    "Requirements" and "Trigger" lines lifted out of the Effect into their columns, Type "Basic
    Action", Aura filled where the text earns it (Seek, 30 ft), and Enabled? BLANK on every row.
    Blank is the point: naming a roster row retires it, so the roster's Maneuvers ship nowhere in
    Foundry until a row reads Yes, one at a time as Mike curates them. The file is a SOURCE now:
    edit it, never regenerate it (the script refuses to overwrite it; --force does, and loses every
    edit made since). Aid is not in it because actions.xlsx already defines Aid.
  actions.xlsx is Mike's untracked working file (Aid). A checkout without it keeps what it last
    wrote: the converter carries over, as found, the actions of any workbook actions.json names
    that is missing from data/, and WARNS, so a fresh clone (maneuvers.xlsx present, actions.xlsx
    not) still retires the roster rows the absent workbook retired. An action a present workbook
    now defines is that workbook's, and the run says the two will collide when the absent one is
    back.

EQUIPMENT WORKBOOK (equipment.xlsx)
  Authoritative for weapons, armor and shields (Mike, 2026-10-01; v4.10 sync report ruling 64),
  built from the handbook's Chapter 5 tables. It has NO _Tree Index: the converter recognises it
  by its Weapons, Armor and Shields sheets, and ignores any other sheet in it (About). Shields are
  their own sheet because the book keeps them apart from armor and their columns differ. One
  piece per row. Columns (first word wins, order free):
    Weapons: Weapon | Kind | Handling | Group | Damage | Reach | Range | Traits | Price | Notes | Enabled?
    Armor:   Piece | Zone | Protection | Load | Price | Traits | Material | Enabled?
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
    roster blocks get them joined back with ", ".
  Material (Armor) is Padded, Leather, Mail, Scale or Plate: the roster's materials table, which
    stays hand-kept. Blank, it is derived from the first Trait, which is how the book prints a
    piece ("Padded, Comfort" is Padded); a first Trait that is no material is then an ERROR, and a
    Material that disagrees with the first Trait is a WARNING. Zone is Head, Torso, Arms or Legs.
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
    run says so. Materials, handling and the weapon and armor trait tables stay hand-kept in
    roster.json; nothing asked for them. A checkout without the workbook keeps equipment.json and
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
Ancestry Vigor (or HP) must be a whole number. Every talent costs 1.

It WARNS (does not block) on the Root Rule: every root should hang on something that gets ROLLED
and should IMPROVE at Expert/Master/Legendary. The culture roots pass (their Diplomacy bonus
scales); the two Human bloodline roots still break it on purpose. See v3.0-sync-report.md section 4.
It also WARNS on Enabled? gaps: an enabled talent whose constellation root is disabled, an enabled
talent whose Requires or Free Talent names a disabled talent, and an enabled Background granting a
Skill whose root is disabled. The run ends its counts with one line of what Foundry will ship
("enabled for Foundry: N of 31 constellations, N of 177 talents, ...").

To sync after editing, from the project root:
  python assets/xlsx_to_trees.py             -> assets/trees.json + backgrounds.json + languages.json
                                                + actions.json + equipment.json, and the ancestries,
                                                weaponsMelee, weaponsRanged, armorPieces and shields
                                                blocks of roster.json
  python assets/inject.py                    -> Starwrought_App.html + the constellation viewer
  python assets/render_constellations.py     -> assets/constellations/*.png
  python assets/sheet_gen.py                 -> the fillable and Mira character sheets
  node   assets/build_phb.js                 -> Starwrought_Constellation_Compendium.docx

Then check it still runs, and still reads right:
  python -c "import re,io; h=io.open('Starwrought_App.html',encoding='utf-8').read(); io.open('app.js','w',encoding='utf-8',newline='\n').write(max(re.findall(r'<script>(.*?)</script>',h,re.S),key=len))"
  node assets/smoke_test.js app.js           -> expects SMOKE CLEAN
  python assets/check_style.py               -> no em-dashes in game prose, no borrowed setting names

No PYTHONUTF8 needed: the scripts declare their encodings. Needs openpyxl, matplotlib, reportlab,
and the docx npm package.
