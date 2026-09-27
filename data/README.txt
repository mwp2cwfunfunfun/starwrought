STARWROUGHT talent authoring
============================
Any number of .xlsx files in this folder — split them however you like (e.g. one per
category). RULE: each spreadsheet needs its own "_Tree Index" sheet listing the trees
inside THAT file. The converter merges every file; the same tree in two files is an error;
sheets missing from their file's index are ignored with a warning. A workbook open in Excel
(~$lock file present) is converted from its last saved version, with a warning saying so.

Index columns:  Tree | Category | Feeds (Might/Agility/Wits/Presence) | Flare Triggers | Meta note
  Category must be one of: Skill, Save, Weapon, Combat Style, Armor, Calling, Ancestry,
  Culture, Heritage, Background.
  NOTE: the four Defenses (Awareness, Evade, Guard, Endure) live in defenses.xlsx and declare
  Category = Save, because "Defense" is not yet in the converter's vocabulary. The app and the
  handbook both call them Defenses; see v3.0-sync-report.md §6.2 for the one-line fix.
  Skill / Save / Weapon / Combat Style / Armor trees REQUIRE a tree-level Feeds (untrained fallback).
  Ancestry rows may also carry: HP | Size | Speed | Senses | Summary — those generate the
  "ancestries" block of roster.json, so the chassis is authored once, here.
  Calling rows may carry Skills — the Training the Calling grants at creation.
  Culture rows may carry Skills — but v1.8 cultures grant no skill points, so it stays empty.

Tree columns:   Talent | Tier (T/E/M/L) | Root | Requires | Prerequisites | Description | Effect |
                Feeds (blank = tree default) | Grants | Choice | Free Talent
  Column ORDER does not matter; the first word of the header does.
  Choice: a build-time pick the talent demands, written as WHAT is chosen ("Weapon Group",
        "Weapon Group or Technical Weapon"). The Foundry system turns it into a picker when the
        talent is taken and remembers the answer, which is what gives the talent its effect.
        Only for picks made ONCE when the talent is bought; per-use picks (a Zone, a target,
        a Defense) need nothing here. Two talents in the book qualify.
  Free Talent: a talent this one hands over outright, no point spent. May name a talent in
        another constellation (Drilled hands over Weapon Familiarity, which is authored in
        Weapons). The converter ERRORS if it names no talent anywhere in the book.
  Root: "x" marks the constellation root, "h" marks a heritage root (Ancestry trees only).
        EVERY tree needs exactly one "x", identity trees included, even though their roots are
        granted by the chargen choice rather than bought.
  Requires: comma- or "or"-separated talent names, which must exist in the SAME sheet.
  Prerequisites: free prose for narrative gates ("Raised in Cheliax"). Not validated.
  Grants: restricted talent points this talent hands out. Parsed forms only:
        "<n> in one|any|different <Skill|Calling|Combat Style|Armor|Save|Weapon|opened|anywhere>"
        "<n> open <non-Skill|anywhere>"
  Action glyphs go in the Talent NAME, not the Effect: "Second Wind ◆", "Duck and Cover ↺",
  "Well Read ◇", "Double Slice ◆◆". Requires-matching strips trailing glyphs, so
  Requires "Kip Up" matches the talent "Kip Up ◆".

ACTIONS WORKBOOK (actions.xlsx)
  Recognised by its _Tree Index carrying  Name | Type | Meta note  instead of Tree | Category.
  Every other sheet holds one action per row. Columns (first word wins, order free):
    Action | Cost | Traits | Type | Prerequisites | Requirements | Trigger | Description | Effect |
    Automation
  Type comes from the row's own Type cell if there is one, else the _Tree Index row of that name,
    else the sheet's name (with a warning that the action is not in the index).
  Cost takes glyphs or words: ◆, ◆◆, ◆◆◆, ◇ (free), ↺ (reaction), "◆ to ◆◆◆", "1 or 3",
    "reaction", "free". Without a Cost column the glyphs in the Action name are read, as for
    talents; with neither, the action costs one action ◆ and the converter names the ones it
    defaulted. Effect is required; a cell reading "None" counts as blank.
  Description is the flavour line; Effect is the rules, rich text welcome. Automation is prose for
    now: it travels onto the Foundry Item and its sheet, and nothing acts on it yet.
  Writes assets/actions.json. THE SHEET WINS: any action it names retires the roster.json row of
    the same name from the compendium, the app and the compendium docx, under the same document
    id. Roster rows the sheet does not carry yet stay. Actions typed "Basic Action" appear on
    every character's Actions tab in Foundry, read from the compendium rather than copied.

RICH TEXT: bold / italic / underline / strikethrough / font color applied INSIDE the
Effect or Description cell mirrors into the app, the tree explorer, and the Player's Handbook.
Newlines in a cell become <br>.

Rules the converter enforces as ERRORS: exactly one root per tree; capstones (★) must be tier L;
Requires must name real talents in the same tree; tier must be T/E/M/L; Effect can't be empty;
Ancestry HP must be a whole number. Every talent costs 1.

It WARNS (does not block) on the Root Rule: every root should hang on something that gets ROLLED
and should IMPROVE at Expert/Master/Legendary. The culture roots pass (their Diplomacy bonus
scales); the two Human bloodline roots still break it on purpose. See v3.0-sync-report.md section 4.

To sync after editing, from the project root:
  python assets/xlsx_to_trees.py             -> assets/trees.json + backgrounds.json + languages.json
                                                + actions.json, and the ancestries block of roster.json
  python assets/inject.py                    -> Starwrought_App.html + the constellation viewer
  python assets/render_constellations.py     -> assets/constellations/*.png
  python assets/sheet_gen.py                 -> the fillable and Mira character sheets
  node   assets/build_phb.js                 -> Starwrought_Constellation_Compendium.docx

Then check it still runs, and still reads right:
  python -c "import re,io; h=io.open('Starwrought_App.html',encoding='utf-8').read(); io.open('app.js','w',encoding='utf-8',newline='\n').write(max(re.findall(r'<script>(.*?)</script>',h,re.S),key=len))"
  node assets/smoke_test.js app.js           -> expects SMOKE CLEAN
  python assets/check_style.py               -> no em-dashes in game prose, no Golarion names

No PYTHONUTF8 needed: the scripts declare their encodings. Needs openpyxl, matplotlib, reportlab,
and the docx npm package.
