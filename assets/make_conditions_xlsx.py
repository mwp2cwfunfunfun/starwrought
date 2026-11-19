# STARWROUGHT: scaffold data/conditions.xlsx (Mike, 2026-11-18: "can we build a conditions.xlsx
# that includes every condition, and the automation effects (if any) of it?", then, by question:
# the workbook is the source the system reads, and the ONLY authority for what a Condition says;
# "I fill it from the handbook's table" was the plan he approved).
#
# Built for him to edit rather than retype: one row for each Condition, its Effect copied
# VERBATIM from the Conditions table of the newest Players Handbook on the shelf (22 rows in v4.25,
# Supine among them), then the four Conditions the system has and the table does not (Concealed,
# Hidden and Undetected, worded from the roster's Detection table, and Dead), with the Includes and
# Automation cells of the approved plan filled in and N/A on every other row.
#
# ONE SHOT. Once the file exists it is a SOURCE, Mike's to edit, and this script refuses to touch it
# (--force overwrites, and loses every edit made since; back the file up first). Running it is not a
# pipeline step and build_all.mjs never calls it.
#
#   python assets/make_conditions_xlsx.py            -> data/conditions.xlsx, if there is none yet
#   python assets/make_conditions_xlsx.py --force    -> overwrite it
#   python assets/make_conditions_xlsx.py --out X    -> write somewhere else (a dry run into the scratchpad)
import argparse, glob, os, re, sys
from docx import Document
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "conditions.xlsx")

# The columns the converter reads (assets/xlsx_to_trees.py, CONDITION_COLUMNS), in the order a
# reader wants them. The first word of each header is what is matched.
# 0.35.0 (Mike, 2026-11-19: "to bring it in line with other spreadsheets"): Description is one
# line of flavor and Effect the rules text. Through 0.34.0 the one column, Description, was the rules.
COLUMNS = ["Condition", "Takes", "Description", "Effect", "Includes", "Automation", "System", "Listed?", "Icon", "Notes"]
WIDTHS = {"Condition": 16, "Takes": 8, "Description": 50, "Effect": 78, "Includes": 22, "Automation": 46, "System": 9,
          "Listed?": 9, "Icon": 14, "Notes": 70}
WRAPPED = ("Description", "Effect", "Includes", "Automation", "Notes")

SUFFIX = re.compile(r"\s*(?:\[\s*(Zone|X)\s*\]|\s(N))\s*$")

# The Conditions the system itself puts on and takes off from other data: their rows hold the
# text, the system runs them (config/conditions.mjs, `system: true`).
SYSTEM = {"Dying", "Wounded", "Spent", "Preparing", "Bound", "Controlled", "Controlling", "Exposed", "Dead"}

PRONE_LINES = "[EFFECT ATK: -2 situation]\n[EFFECT DEF: 2 situation, evade; IFT: RANGED]"

# name -> (Includes, Automation), from the plan Mike approved. Every other row is N/A.
SEED = {
    "Off-Guard": ("", "[EFFECT DEF: -2 situation, evade]\n[EFFECT DEF: -2 situation, guard]"),
    # One line since 0.36.0: a bare CHECK reaches every roll and Threshold.
    "Frightened": ("", "[EFFECT CHECK: -N condition]"),
    "Fatigued": ("", "[EFFECT DEF: -N condition]\n[EFFECT ATK: -N condition]"),
    "Prone": ("Off-Guard", PRONE_LINES),
    "Supine": ("Off-Guard", PRONE_LINES),
    "Grabbed": ("Off-Guard", "N/A"),
    "Restrained": ("Grabbed", "N/A"),
    "Blind": ("Off-Guard", "N/A"),
    "Unconscious": ("Prone", "N/A"),
    "Wrong-Footed": ("Off-Guard against X", "N/A"),
}

# The Icon cell of a row the system has no icon for: a Condition a row makes wears a plain one
# unless its row names another (one of Foundry's own, so nothing has to ship).
ICONS = {"Supine": "icons/svg/sleep.svg"}

# What the code still does for a row, or does not do yet: the author's own column, carried and
# never read by the system.
NOTES = {
    "Off-Guard": "The numbers are this row's lines. A first Torso Wound and a Torso Critical Hit effect count as Off-Guard through this row.",
    "Frightened": "The numbers are this row's lines. It does not yet drop by 1 at the end of each round: lower it by hand.",
    "Fatigued": "The numbers are this row's lines. The maximum of 3, the Wind check, the rests that lower it (ten minutes, by 1) and end it (a night), and the lock to Travel are the system's.",
    "Prone": "The numbers are this row's lines; Off-Guard comes through Includes. Stand takes it off. The second paragraph reads \"Roll Over to become Prone\", which looks like a slip for Supine.",
    "Supine": "A new Condition, made by this row. Its -2 has no exception for melee Attacks against adjacent creatures yet (the grammar has no word for it), and it does not stop movement yet.",
    "Grabbed": "Off-Guard comes through Includes. Evade is marked unavailable by the system; \"can't Move or Step\" is the table's.",
    "Restrained": "Counts as Grabbed (and so as Off-Guard) through Includes. \"No action other than Escape\" is the table's.",
    "Blind": "Off-Guard comes through Includes. The system reads it for sight (SEEN, who is near). Its id in the system is `blinded`; Blind and Blinded both read.",
    "Unconscious": "Counts as Prone (and so as Off-Guard) through Includes. The system reads it for who is conscious.",
    "Wrong-Footed": "Off-Guard against the creature that put it on, and nobody else. Toggled from the token it names nobody and does nothing; one a Maneuver applies (Feint) does.",
    "Heedless": "Nothing is automated yet.",
    "Stunned": "Nothing is automated yet.",
    "Slowed": "The system takes the actions at the start of each round. It does not yet drop by 1 at the end of each round.",
    "Deafened": "Nothing is automated yet.",
    "Dying": "The system's own: the Dying count, the Recovery check, death.",
    "Wounded": "The system's own: the Wounds are per Zone on the creature.",
    "Spent": "The system's own: put on at 0 Vigor.",
    "Preparing": "The system's own: put on when a Maneuver of three or more actions is begun.",
    "Bound": "The system's own: the Bind.",
    "Controlled": "The system's own: the Bind.",
    "Controlling": "The system's own: the Bind.",
    "Exposed": "The system's own: one status for each Zone, which mirror the Zones. This one row describes all four.",
    "Concealed": "Not in the handbook's Conditions table (it is in the Detection table), so not Listed. Relative to one observer: the table's.",
    "Hidden": "Not in the handbook's Conditions table (it is in the Detection table), so not Listed. The system reads it for sight (SEEN); the rest is the table's.",
    "Undetected": "Not in the handbook's Conditions table (it is in the Detection table), so not Listed. The system reads it for sight (SEEN); the rest is the table's.",
    "Dead": "The system's own, and not in the handbook's table, so not Listed.",
}

# The four the system has and the handbook's Conditions table does not. The three detection states
# are worded from the roster's Detection table ("What your foe knows" and "Effect").
EXTRA = [
    ("Concealed", "", "Your foe knows exactly what squares you are in, but something is preventing them from seeing or otherwise detecting all of you. You gain a +2 Situation bonus to Evade and Guard for physical Attacks."),
    ("Hidden", "", "Your foe knows that you are present, but not what squares you occupy. Your foe must successfully guess one of the squares you occupy in order to attack you. Even so, you gain a +4 Situation bonus to Evade and Guard for physical Attacks. Your foe is Wrong-Footed to you."),
    ("Undetected", "", "Your foe has no idea if you are even present. You cannot be targeted at all. Your foe is Wrong-Footed to you."),
    ("Dead", "", "You are dead."),
]

ABOUT = [
    "STARWROUGHT Conditions. This workbook is the only source for what a Condition says and does (Mike, 2026-11-18). "
    "The system, the web app, the compendium and the Rules Reference journal all read it.",
    "One row for each Condition, on the Conditions sheet. This sheet is ignored.",
    "Condition: its name. The suffix the handbook's table prints (Frightened N, Exposed [Zone], Bound [X]) is put back from Takes wherever a table is printed.",
    "Takes: blank, N (a value: Frightened 2), Zone (the system's own only), or X (a creature: Wrong-Footed to X).",
    "Description: one line of flavor, as on a Talent's sheet. It shows in italics above the Effect in the Rules Reference journal and in a Condition's tooltip on a sheet. It may be blank.",
    "Effect: the rules text players read: the tooltip on a Condition's row and on the token's hover card, and the reference tables. "
    "Write [X] where the name of the creature the Condition is about should appear (a row whose Takes is X).",
    "Includes: other Conditions this one also counts as, comma separated. Prone: Off-Guard. A creature is Off-Guard once, however many ways it got there. "
    "\"Off-Guard against X\" means only against the creature that put this Condition on (Wrong-Footed), and needs Takes = X.",
    "Automation: lines in the grammar, one to a line, as on a Talent (AUTOMATION_GRAMMAR.md). A Condition's row reads CHECK (with no target: every roll and Threshold), SKILL (checks that are no attack and no Defense), ATK, DEF and INIT, "
    "and may ask about the attack answered (IFT: RANGED, MELEE, BLOW, BLAST, BLIGHT, BEGUILEMENT, TRAIT(...)). "
    "It also reads [EFFECT IMMUNE: TRAIT(Visual)], written alone: whoever has the Condition is immune to anything with that trait. "
    "-N is the Condition's own value: [EFFECT DEF: -N condition] on Frightened is -2 at Frightened 2. N/A is a row that needs none.",
    "System: Yes for the Conditions the system itself puts on and takes off (Dying, Wounded, Spent, Preparing, the Bind's three, Exposed, Dead). Their rows hold the text; the system runs them.",
    "Listed?: Yes prints the row in the reference tables. Anything else keeps it in the system and out of the tables.",
    "Icon: optional, a path to an image. Blank keeps the system's icon (a new Condition gets a plain one).",
    "Notes: yours. It says what the code still does for the row, or does not do yet. The system never reads it.",
    "A NEW ROW MAKES A NEW CONDITION, with its own status on the token palette. The build prints every new Condition it makes, so a slip in a name is seen at once. "
    "A row deleted from here is gone from the system at the next build, except the Conditions the system itself needs, which the build refuses to go without.",
    "THE ROW IS THE WORD. A row whose Automation cell is N/A (or blank) means the Condition changes no number, even Off-Guard, Frightened and Fatigued, "
    "whose numbers were in the system's code before this workbook. Those old numbers come back only when this workbook cannot be read at all.",
    "A creature that has two Conditions takes the lines of both: one that is both Prone and Supine (an Unconscious creature laid on its back) takes -2 to attacks twice.",
    "Build it alone with sync_conditions.cmd (node assets/build_all.mjs --conditions), then run Sync content in the open world.",
]


def handbook():
    """The newest numbered Players Handbook on the shelf, proposals and drafts left out."""
    found = []
    for path in glob.glob(os.path.join(ROOT, "Starwrought_Players_Handbook_v*.docx")):
        m = re.search(r"_v(\d+)\.(\d+)\.docx$", os.path.basename(path))
        if m: found.append(((int(m.group(1)), int(m.group(2))), path))
    if not found: sys.exit("no Starwrought_Players_Handbook_v<N>.<N>.docx on the shelf to read the Conditions table from")
    return max(found)[1]


def cell_text(cell):
    """Every paragraph of a table cell, a nested table's included (python-docx's cell.text does not
    read a nested table; the v4.25 Reload cell taught that), one paragraph to a line."""
    parts = [p.text.strip() for p in cell.paragraphs]
    for nested in cell.tables:
        for row in nested.rows:
            for inner in row.cells:
                parts.append(cell_text(inner))
    return "\n".join(p for p in parts if p)


def conditions_table(path):
    """The (name, takes, description) rows of the handbook's Conditions table, as printed."""
    doc = Document(path)
    for table in doc.tables:
        head = [c.text.strip().lower() for c in table.rows[0].cells]
        if len(head) >= 2 and head[0].startswith("condition") and head[1].startswith("effect"):
            rows = []
            for row in table.rows[1:]:
                written = row.cells[0].text.strip()
                if not written: continue
                m = SUFFIX.search(written)
                name = SUFFIX.sub("", written).strip() if m else written
                takes = (m.group(1) or m.group(2)) if m else ""
                rows.append((name, takes, cell_text(row.cells[1])))
            return rows
    sys.exit(f"{os.path.basename(path)} has no Conditions table (a table headed Condition | Effects)")


def build(rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "Conditions"
    head_font, head_fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="2F3B52")
    for j, name in enumerate(COLUMNS, 1):
        c = ws.cell(1, j, name)
        c.font, c.fill = head_font, head_fill
        c.alignment = Alignment(vertical="center")
        ws.column_dimensions[get_column_letter(j)].width = WIDTHS[name]
    ws.freeze_panes = "B2"
    col = {name: j for j, name in enumerate(COLUMNS, 1)}
    for i, (name, takes, description, listed) in enumerate(rows, 2):
        includes, automation = SEED.get(name, ("", "N/A"))
        values = {
            # The handbook's table gives the rules text; the flavor line is the author's to write.
            "Condition": name, "Takes": takes, "Description": "", "Effect": description, "Includes": includes,
            "Automation": automation, "System": "Yes" if name in SYSTEM else "", "Listed?": "Yes" if listed else "No",
            "Icon": ICONS.get(name, ""), "Notes": NOTES.get(name, ""),
        }
        for key, value in values.items():
            c = ws.cell(i, col[key], value)
            c.alignment = Alignment(wrap_text=key in WRAPPED, vertical="top")
        ws.cell(i, col["Condition"]).font = Font(bold=True)
    last = len(rows) + 60
    for key, choices in (("Takes", '"N,Zone,X"'), ("System", '"Yes"'), ("Listed?", '"Yes,No"')):
        dv = DataValidation(type="list", formula1=choices, allow_blank=True)
        dv.error, dv.errorTitle = "Pick from the list, or leave the cell blank.", key
        ws.add_data_validation(dv)
        letter = get_column_letter(col[key])
        dv.add(f"{letter}2:{letter}{last}")
    about = wb.create_sheet("About")
    about.column_dimensions["A"].width = 150
    for r, text in enumerate(ABOUT, 1):
        c = about.cell(r, 1, text)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    about.cell(1, 1).font = Font(bold=True)
    return wb


def main():
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"): s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Scaffold data/conditions.xlsx from the handbook's Conditions table. One shot.")
    ap.add_argument("--force", action="store_true", help="overwrite an existing workbook (every edit in it is lost)")
    ap.add_argument("--out", default=OUT, help="write here instead of data/conditions.xlsx")
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    lock = os.path.join(os.path.dirname(out), "~$" + os.path.basename(out))
    if os.path.exists(lock):
        sys.exit(f"{os.path.basename(out)} is open in Excel ({os.path.basename(lock)} present); close it first")
    if os.path.exists(out) and not args.force:
        sys.exit(f"{os.path.relpath(out, ROOT)} exists and is a source now (Mike's to edit); not overwritten. "
                 f"--force replaces it and loses every edit made since.")
    book = handbook()
    printed = conditions_table(book)
    rows = [(name, takes, description, True) for name, takes, description in printed]
    have = {name.lower() for name, *_ in rows}
    rows += [(name, takes, description, False) for name, takes, description in EXTRA if name.lower() not in have]
    unseeded = sorted(set(SEED) - {name for name, *_ in rows})
    if unseeded:
        sys.exit(f"the handbook's table has no row for {', '.join(unseeded)}, which this script seeds; the table has changed, so read it before running this")
    wb = build(rows)
    wb.save(out)
    print(f"wrote {os.path.relpath(out, ROOT)}: {len(rows)} Conditions ({len(printed)} from {os.path.basename(book)}, "
          f"{len(rows) - len(printed)} the system has and the table does not)")
    print("  columns: " + " | ".join(COLUMNS))
    print("  lines seeded on: " + ", ".join(n for n, (_, a) in SEED.items() if a != "N/A"))
    print("  Includes seeded on: " + ", ".join(f"{n} ({i})" for n, (i, _) in SEED.items() if i))
    print("Next: node assets/build_all.mjs --conditions. Do not run this script again over an edited file.")


if __name__ == "__main__":
    main()
