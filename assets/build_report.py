#!/usr/bin/env python3
"""build_report.py: one workbook per build with everything that needs a hand or a decision.

Mike, 2026-11-08: "now that we are doing content additions and automations, please also create an
excel sheet every build, with build issues/errors that I can fix/need to decide something/
inconsistencies/rulesdecisions. include your recommended solution as well."

    python assets/build_report.py build/build-log.json     # what build_all.mjs runs, last, every mode
    python assets/build_report.py                          # no log: the workbook analyses alone

build_all.mjs captures what every step printed (build/build-log.json: the mode, each step's
output and exit, the drift check, the version stamps) and runs this last, on success and on
failure. This reads that log and adds two analyses of its own, so the workbook is complete even
when the converter refused to write:

  * the red cells: every Automation line the grammar cannot read, judged exactly as
    highlight_automation.py judges them (its functions are imported; nothing is painted, no
    markdown written), with the cause and the hint;
  * the indexes: what assets/index_sheets.py would add or report, on workbooks loaded and never
    saved;

and one hand-kept list, assets/open_decisions.json: the standing questions only a person can
close (a rule the book leaves open, a row to retype, a redline to accept), each with the
recommendation. A decided row keeps its ruling number for one build, then goes.

Every finding is one row: Severity (Error: the build stopped on it; Fix: a cell or a file to
mend; Decision: Mike's call; Note: the pipeline accepts it and says so), Category, Where, Item,
Finding (the step's own words), Recommendation, Step, First seen, Status. build/report-seen.json
remembers when each finding was first seen, so a new one reads "new" and an old one its date.

Written to build-report.xlsx in the project root (Summary, Issues, Decisions, Red cells); when
Excel holds that file open, to build-report.<date-time>.xlsx instead, and the console says so.
The exit code is 0 unless the workbook could not be written at all; build_all.mjs ignores it
either way, since a report must never fail the build it reports on.
"""
import datetime as _dt
import glob
import json
import os
import re
import sys
import traceback

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "build-report.xlsx")
SEEN = os.path.join(BUILD, "report-seen.json")
DECISIONS = os.path.join(HERE, "open_decisions.json")
sys.path.insert(0, HERE)

SEVERITIES = ("Error", "Fix", "Decision", "Note")
SEV_FILL = {"Error": "FFF4CCCC", "Fix": "FFFCE4D6", "Decision": "FFFFF2CC", "Note": "FFEDEDED"}
TODAY = _dt.date.today().isoformat()


class Finding:
    def __init__(self, severity, category, where, item, finding, recommendation, step):
        self.severity, self.category, self.where, self.item = severity, category, where, item
        self.finding, self.recommendation, self.step = finding, recommendation, step

    @property
    def key(self):
        return f"{self.category}|{self.where}|{self.item}|{re.sub(r'\\s+', ' ', self.finding).strip()[:200]}"


# ------------------------------------------------------------------------------------------------
#  What a step's line means: (pattern over the line, severity, category, recommendation)
#  The recommendation may use the match's groups with {1}, {2}.
# ------------------------------------------------------------------------------------------------

RULES = [
    (r"root never improves at Expert/Master/Legendary", "Note", "Data",
     "The Root Rule, part 2: give the Root a clause that improves at Expert, Master and Legendary ('add the Constellation's "
     "proficiency to its checks' is the model), or accept it: the Human bloodline roots and the Culture roots break it on purpose."),
    (r"root has nothing that gets rolled", "Note", "Data",
     "The Root Rule, part 1: give the Root something that is rolled so the Constellation can Flare from it, or accept it for a "
     "Defense or discipline Training root whose Talents roll."),
    (r"in _Tree Index but no worksheet yet; skipped", "Decision", "Index",
     "Write the sheet (the index row is waiting for it) or delete the row. index_sheets.py reports it every run and never drops it."),
    (r"is in _Tree Index but has no row on any sheet", "Note", "Index",
     "Intended for Parry, Void, Counter and Intercept (Reactions are Talents since v4.21) and Avert Gaze (not in v4.24's "
     "Maneuvers): the name keeps the roster row retired. Add a row if the book gains the action, else leave or delete the index row."),
    (r"also on sheet '([^']+)', which stands", "Fix", "Data",
     "Delete the duplicate row; the row on '{1}' is the one that ships."),
    (r"also on sheet '([^']+)', whose row is not enabled", "Fix", "Data",
     "Two rows for one action: delete the disabled one on '{1}', or decide which should ship."),
    (r"Effect says 'within (\d+) feet' but no ring is set", "Fix", "Automation cell",
     "Write [AURA {1} all] (or allies, enemies) in the row's Automation cell so the ring draws on the map, or 'none' in an Aura "
     "cell if the circle is centred somewhere other than the carrier."),
    (r"no Range; the book names none, so the table decides", "Note", "Data",
     "A spell with no Range: fill the Range column when the book names one; until then the table decides at the Cast."),
    (r"the _Tree Index columns? (.+?) (?:is|are) retired", "Fix", "Index",
     "Delete the {1} column from the index once the Root's Automation block carries the value ([LANGUAGE ...], [VIGOR ...])."),
    (r"the (.+?) column(?:s)? (?:is|are) retired \(0\.16\.0\)", "Fix", "Data",
     "Move the cell into the Talent's Automation ([CHOICE Weapon Group or Technical Weapon], [TALENT Weapon Familiarity]) and delete the column."),
    (r"unknown column '([^']+)' \(ignored\)", "Fix", "Data",
     "Rename the column '{1}' to a header the converter knows, or ask Claude to read it (the sheet columns are listed in data/README.txt)."),
    (r"no Type cell and not in _Tree Index; typed by its sheet name", "Fix", "Data",
     "Fill the row's Type cell (Maneuver, Talent Maneuver, Activity, Endeavor) or run python assets/index_sheets.py."),
    (r"the actions _Tree Index has no Type column", "Fix", "Index",
     "Run python assets/index_sheets.py, or add a Type column; rows with their own Type cell are fine as they are."),
    (r"open in Excel; converting the last saved version", "Note", "Build",
     "Save the workbook in Excel before the build if the latest edits should be in it."),
    (r"enabled, but Requires '([^']+)', which is not", "Fix", "Data",
     "Enable '{1}' too, or disable this Talent: a Talent whose requirement never ships can never be bought in Foundry."),
    (r"enabled, but the constellation's root is not", "Fix", "Data",
     "Enable the Root (Enabled? = Yes) or disable the Talent: Foundry has no Root to reach it from."),
    (r"Weapon Familiarity|hands over free", "Fix", "Data",
     "Enable the Talent handed over free, or disable the one that hands it over."),
    (r"\[MANEUVER ([^\]]+)\] names a Maneuver whose row is not enabled", "Fix", "Data",
     "Set Enabled? = Yes on the '{1}' row of the actions workbook, or disable the Talent that grants it."),
    (r"IF\(Trait=([^)]+)\): no shipping weapon, attack or Talent carries the trait", "Note", "Data",
     "The rule reads and waits: author a weapon, adversary attack or spell Talent carrying the {1} trait, or leave it until one exists."),
    (r"granted by a Talent, so not basic though typed \"Maneuver\"", "Fix", "Data",
     "Retype the row 'Talent Maneuver' in data/maneuvers.xlsx; the build reads it as granted meanwhile, so nothing ships wrong."),
    (r"retired by a disabled sheet row or an index name with no row", "Note", "Data",
     "These actions ship nowhere until their row reads Enabled? = Yes (Drop Prone) or has a row at all; intended for the retired Reactions."),
    (r"was actions\.xlsx's and is now defined|also defined in ([\w.]+xlsx), which stands", "Note", "Data",
     "The same name in two workbooks: the first read stands. Delete the other once the move is done."),
    (r"also defined in ([\w.]+xlsx)$|also defined in ([\w.]+xlsx)\b(?!, which)", "Error", "Data",
     "The same action in two workbooks is an error: keep one row."),
    (r"no Cost column on (.+?); an action with no glyph", "Fix", "Data",
     "Add a Cost column to {1} (or glyphs in the names); until then every costless row is ❶."),
    (r"a Lore sheet for '([^']+)', which is not a tree", "Fix", "Index",
     "Rename the sheet to '<Tree> Lore' for a tree the index names, or add the tree's index row."),
    (r"sheets not in its _Tree Index \(ignored\)", "Fix", "Index",
     "Run python assets/index_sheets.py to add the rows (then fill Primary Attribute for a Skill)."),
    (r"the Lore sheet is empty", "Note", "Data", "Fill the Lore sheet (label | text rows) or leave it; the chassis ships with no blurb."),
    (r"Attribute 'TBD'", "Fix", "Data", "Set the Attribute cell (Might, Agility, Wits, Presence)."),
    (r"blank Attribute cell", "Error", "Data", "Fill the Attribute cell: no Attribute cell may be blank (Might, Agility, Wits, Presence)."),
    (r"tier must be T/E/M/L", "Error", "Data", "Set the Tier cell to T, E, M or L."),
    (r"empty Effect", "Error", "Data", "Write the Effect, or delete the row."),
    (r"needs exactly 1 root", "Error", "Data", "Mark exactly one row 'x' in the Root column (an Ancestry's bloodlines 'h')."),
    (r"bad category '([^']+)'", "Error", "Index", "Set the index row's Category to one the converter knows (Skill, Defense, Weapon, Combat Style, Calling, Ancestry, Culture, Magic)."),
    (r"need a tree-level Feeds", "Error", "Index", "Fill the Primary Attribute cell of the index row."),
    (r"Cost '([^']+)' not understood", "Error", "Data", "Write the Cost as ❶, ❷ to ❸, ⓿↺, '1 or 3', reaction or free."),
    (r"requires unknown '([^']+)'", "Error", "Data", "The Requires/Prerequisites cell names '{1}', which is no Talent of the sheet: fix the spelling or move the text to Prerequisites prose."),
    (r"the roster's callings row reads (\d+) Opening Vigor but the Root's \[VIGOR opening\] says (\d+)", "Fix", "Data",
     "Make the roster's callings row and the Root's [VIGOR opening {2}] agree (the Root's block is the authoring)."),
    (r"names no row of the actions workbook", "Fix", "Automation cell",
     "The @Maneuver[...] marker names no row of data/maneuvers.xlsx: fix the name or add the row."),
    (r"did not read\.|AUTOMATION ERRORS", None, None, None),      # banners, skipped
    (r"HANDBOOK DRIFT", "Decision", "Handbook", "A newer handbook is on the shelf: plan and run the sync, then node assets/build_all.mjs --accept-phb."),
    (r"VERSION STAMPS DISAGREE", "Fix", "Build", "Bump the stamp named to the system.json version."),
    (r"re-export|not re-export", "Fix", "Build", "Add the export to module/config.mjs's barrel line for that file."),
    (r"exported by the barrel|will not import", "Fix", "Build", "Fix the module named; node assets/build_all.mjs --check runs the barrel check alone."),
    (r"AUTOMATION_GRAMMAR\.md", "Fix", "Build", "Document the kind or operator in AUTOMATION_GRAMMAR.md (standing rule)."),
    (r"em-dash", "Fix", "Style", "Replace the em-dash with a comma, semicolon, colon or period (the absolute style rule)."),
    (r"golarion|proper noun", "Fix", "Style", "Rename the borrowed proper noun (IP hygiene: names and prose original)."),
    (r"(circumstance|status|item) bonus", "Note", "Style", "The retired bonus-type word: write Situation, Condition or Gear."),
    (r"exited (\d+)$", "Error", "Build", "The step stopped; the first Error above it in this sheet is the cause."),
    (r"could not run", "Error", "Build", "The interpreter or node could not start; see the console."),
]
COMPILED = [(re.compile(p, re.I), sev, cat, rec) for p, sev, cat, rec in RULES]

SKIP = re.compile(r"^\s*(PASS|wrote |written |rendered|compiled |sheets written|=== |STARWROUGHT|  system:|  python:|  handbook on|  repository synced|"
                  r"  \w+\s+\d+ documents|  index\.json|  \d+ documents written|  enabled for Foundry|  equipment:|  automation:|  grammar journal|"
                  r"  \d+ of \d+ action|  retired by|rules framework|rules: |Sources and index|\(the GM is also|the compendia on disk|Done\.|"
                  r"Content rebuilt|sync the open world|All steps clean|style clean|automation cells:|  \w+\.xlsx: \d+ actions|"
                  r"Each is stored|in play; the full|=+$|Pipeline stopped|Bump SYSTEM_VERSION|CLAUDE\.md:|STYLE VIOLATIONS|NOTES \(advisory)")

WHERE_RE = re.compile(r"^(?:WARNING:\s*)?(?P<where>[^:]+?(?: / [^:/]+?)*?):\s(?P<msg>.+)$")


def classify(line):
    """(severity, category, recommendation) for a finding line, or (None, None, None) to skip."""
    for rx, sev, cat, rec in COMPILED:
        m = rx.search(line)
        if m:
            if sev is None:
                return None, None, None
            text = rec
            for i, g in enumerate(m.groups(), 1):
                text = text.replace("{%d}" % i, g or "")
            return sev, cat, text
    return "Fix", "Build", "No recommendation yet for this message: read it against the cell or file it names, and tell Claude if it should carry one."


def split_where(line):
    """('maneuvers.xlsx / Guile Actions', 'Brace an Object', 'also on sheet ...') from a converter line."""
    text = re.sub(r"^\s*(WARNING:|ERROR:|-\s)\s*", "", line.strip())
    m = WHERE_RE.match(text)
    if not m:
        return "", "", text
    where, msg = m.group("where").strip(), m.group("msg").strip()
    parts = [p.strip() for p in where.split(" / ")]
    if len(parts) >= 2:
        return " / ".join(parts[:-1]), parts[-1], msg
    return where, "", msg


def findings_from_step(step):
    """Every finding line of one step's output, classified."""
    out = []
    banner = None
    lines = (step.get("output") or "").splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i].rstrip()
        i += 1
        s = raw.strip()
        if not s:
            continue
        if "RULE ERRORS" in s:
            banner = "rule"; continue
        if "AUTOMATION ERRORS" in s:
            banner = "automation"; continue
        if s.startswith("STYLE VIOLATIONS"):
            banner = "style"; continue
        if s.startswith("NOTES (advisory"):
            banner = "notes"; continue
        if banner in ("style", "notes") and re.match(r"^\s{2}\S", raw) and not raw.startswith("    "):
            m = re.match(r"^\s{2}(\S+)\s{2,}(.+)$", raw)
            if m:
                kind, where = m.group(1), m.group(2).strip()
                text = lines[i].strip() if i < len(lines) else ""
                i += 1
                sev, cat, rec = classify(kind + " " + text)
                out.append(Finding("Fix" if banner == "style" else "Note", "Style", where, "", f"{kind}: {text}", rec, step["name"]))
                continue
        if SKIP.match(raw) or SKIP.match(s):
            continue
        is_finding = (s.startswith("WARNING") or s.startswith("- ") or "exited" in s or banner in ("rule", "automation")
                      or s.startswith("granted by a Talent") or "error" in s.lower())
        if not is_finding:
            continue
        if s.startswith("granted by a Talent"):
            names = [n.strip() for n in s.split(":", 1)[1].split(",") if n.strip()]
            sev, cat, rec = classify(s)
            for n in names:
                out.append(Finding(sev, cat, "data/maneuvers.xlsx", n, "typed \"Maneuver\" though a Talent grants it (read as a Talent Maneuver)", rec, step["name"]))
            continue
        if s.startswith("- automation:") or s.startswith("automation:"):
            # "automation: <source>, line n: <message> ("text")" from parse_rules or build_foundry.
            m = re.match(r"^-?\s*automation:\s*(.+?), line (\d+):\s*(.+?)\s*\(\"(.*)\"\)\s*$", s)
            if m:
                src, line_no, message, text = m.groups()
                parts = [p.strip() for p in src.split(" / ")]
                where, item = (" / ".join(parts[:-1]), parts[-1]) if len(parts) > 1 else (src, "")
                sev = "Error" if banner == "rule" else "Fix"
                out.append(Finding(sev, "Automation cell", where, item, f"line {line_no}: {message} [{text}]",
                                   "Mend the line (the Red cells sheet gives the cause and the hint); in release mode this stops the build.", step["name"]))
                continue
        where, item, msg = split_where(s)
        sev, cat, rec = classify(s)
        if sev is None:
            continue
        if banner == "rule":
            sev = "Error"
        out.append(Finding(sev, cat, where, item, msg, rec, step["name"]))
    return out


# ------------------------------------------------------------------------------------------------
#  The two analyses of the workbooks themselves
# ------------------------------------------------------------------------------------------------

def red_cells():
    """[(Finding, row)] for every Automation line the grammar cannot read, as highlight_automation judges it."""
    import highlight_automation as ha
    data = ha.read_workbooks()
    vocab = ha.parse_cells(data)
    findings, rows = [], []
    for c in data["cells"]:
        for line_no, text, message in c.failures:
            cause, hint = ha.why(message, text, data, vocab, c.item_name)
            if cause == "no kind yet":
                sev, rec = "Decision", ("No kind of the grammar reads this. Author a kind with Claude (ruling 119: one at a time, with "
                                        "you, from the Talent that wants it), or rewrite the cell as prose until then. " + hint)
            elif cause == "not yet readable":
                sev, rec = "Fix", "The cell is right but the pipeline does not read what it names yet. " + hint
            elif cause == "names nothing":
                sev, rec = "Fix", "Nothing in the data has this name: fix the name, or add the row or sheet. " + hint
            else:
                sev, rec = "Fix", "A slip in the cell: " + hint
            where = f"{c.wb_name} / {c.ws.title} / {c.address}"
            findings.append(Finding(sev, "Automation cell", where, c.item_name, f"{message} [{text}]", rec, "red cells"))
            rows.append([c.wb_name, c.ws.title, c.address, c.item_name, c.constellation, text, message, cause, hint,
                         "yes" if c.enabled else "no"])
    for fname, sheets in data.get("unindexed", {}).items():
        findings.append(Finding("Fix", "Index", fname, ", ".join(sheets), "sheets not in the _Tree Index (ignored by the converter)",
                                "Run python assets/index_sheets.py, then fill Primary Attribute for a Skill row.", "red cells"))
    return findings, rows, len(data["cells"])


def index_findings():
    """What index_sheets.py would add or report, on workbooks loaded and never saved."""
    import index_sheets as ix
    out = []
    files = [f for f in sorted(glob.glob(os.path.join(DATA, "*.xlsx"))) if not os.path.basename(f).startswith("~$")]
    for path in files:
        fname = os.path.basename(path)
        wb = load_workbook(path, rich_text=True)
        if "_Tree Index" not in wb.sheetnames:
            continue
        report = []
        hdrs = ix.headers(wb["_Tree Index"])
        if ix.find_col(hdrs, starts=("tree",)):
            changes = ix.index_tree_workbook(wb, fname, report)
        elif ix.find_col(hdrs, starts=("name",)):
            changes = ix.index_actions_workbook(wb, fname, report)
        else:
            continue
        if changes:
            out.append(Finding("Fix", "Index", fname, "", f"the _Tree Index is behind the sheets by {len(changes)} cell(s)",
                               "Run python assets/index_sheets.py (backs up first, fills only blank cells).", "index"))
        for line in report:
            if "row added" in line:
                continue   # a dry change, counted above
            sev = "Decision" if "has no sheet" in line else "Note" if "no sheet has a row" in line else "Fix"
            rec = ("Write the sheet or delete the row." if sev == "Decision"
                   else "Intended for the retired Reactions; add a row if the book gains the action." if sev == "Note"
                   else "Rename or add the row the message names.")
            out.append(Finding(sev, "Index", fname, "", line.split(": ", 1)[-1], rec, "index"))
    return out


def decisions():
    if not os.path.exists(DECISIONS):
        return []
    with open(DECISIONS, encoding="utf-8") as f:
        return json.load(f)


# ------------------------------------------------------------------------------------------------
#  The workbook
# ------------------------------------------------------------------------------------------------

HEAD_FILL = PatternFill("solid", fgColor="FF2F3E5C")
HEAD_FONT = Font(bold=True, color="FFFFFFFF")
WRAP = Alignment(wrap_text=True, vertical="top")


def sheet(wb, title, headers, rows, widths, fills=None, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(headers)
    for c in ws[1]:
        c.fill, c.font, c.alignment = HEAD_FILL, HEAD_FONT, WRAP
    for r in rows:
        ws.append([("" if v is None else v) for v in r])
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = WRAP
    if fills:
        for idx, row in enumerate(ws.iter_rows(min_row=2), start=0):
            colour = fills(rows[idx]) if idx < len(rows) else None
            if colour:
                row[0].fill = PatternFill("solid", fgColor=colour)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    if rows:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    return ws


def main():
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    log_path = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
    log = {}
    if log_path and os.path.exists(log_path):
        with open(log_path, encoding="utf-8") as f:
            log = json.load(f)
    findings = []
    notes = []

    # 1. The build's own findings.
    failed = log.get("failedStep")
    if failed:
        findings.append(Finding("Error", "Build", failed, "", f"the build stopped at {failed}",
                                "The first Error row below is what stopped it; mend it and run the build again.", "build_all"))
    for step in log.get("steps", []):
        findings.extend(findings_from_step(step))
    drift = log.get("drift") or {}
    if drift and not drift.get("ok", True):
        book = (drift.get("book") or {}).get("file", "")
        findings.append(Finding("Decision", "Handbook", book, "",
                                f"the repository is synced to v{drift.get('recorded')} and {book} is on the shelf"
                                + (" (same number, different bytes)" if drift.get("changed") else ""),
                                "Plan and run the handbook sync (data, app, system, FEATURES, CHANGELOG, a sync report), then "
                                "node assets/build_all.mjs --accept-phb.", "build_all"))
    for line in log.get("stamps") or []:
        findings.append(Finding("Fix", "Build", "", "", line, "Bring the stamp or the barrel named into agreement; --check runs this alone.", "build_all"))

    # 2. The workbook analyses.
    red_rows, cells_read = [], 0
    try:
        red, red_rows, cells_read = red_cells()
        # The parse_rules lines say the same thing with less; keep the judged rows.
        findings = [f for f in findings if not (f.category == "Automation cell" and f.step in ("parse_rules", "build_foundry") and f.severity != "Error")]
        findings.extend(red)
    except Exception as e:  # the report never dies over an analysis
        notes.append(f"red cells not analysed: {e}")
        traceback.print_exc()
    try:
        converter_ran = any(s.get("name") == "xlsx_to_trees" and s.get("status") == 0 for s in log.get("steps", []))
        for f in index_findings():
            # When the converter ran it already said which index rows have no sheet or no row, in
            # its own words; the analysis adds only what the converter does not say.
            if converter_ran and ("has no sheet" in f.finding or "no sheet has a row" in f.finding):
                continue
            findings.append(f)
    except Exception as e:
        notes.append(f"indexes not analysed: {e}")
        traceback.print_exc()

    # 3. Dedupe, first-seen, sort.
    seen = {}
    if os.path.exists(SEEN):
        with open(SEEN, encoding="utf-8") as f:
            seen = json.load(f)
    unique, keys = [], set()
    for f in findings:
        if f.key in keys:
            continue
        keys.add(f.key)
        unique.append(f)
    for f in unique:
        seen.setdefault(f.key, TODAY)
    order = {s: i for i, s in enumerate(SEVERITIES)}
    unique.sort(key=lambda f: (order.get(f.severity, 9), f.category, f.where, f.item))
    os.makedirs(BUILD, exist_ok=True)
    live = {k: v for k, v in seen.items() if k in keys}
    with open(SEEN, "w", encoding="utf-8") as f:
        json.dump(live, f, indent=1, ensure_ascii=False, sort_keys=True)

    open_dec = decisions()
    counts = {s: sum(1 for f in unique if f.severity == s) for s in SEVERITIES}
    by_cat = {}
    for f in unique:
        by_cat[f.category] = by_cat.get(f.category, 0) + 1

    # 4. Write.
    wb = Workbook()
    first_todo = next((f for f in unique if f.severity in ("Error", "Fix")), None)
    summary = [
        ["Build", log.get("startedAt", TODAY)],
        ["Mode", log.get("mode", "report only")],
        ["Outcome", log.get("outcome", "n/a") + (f" (stopped at {failed})" if failed else "")],
        ["Python", log.get("python", "")],
        ["Handbook on the shelf", (drift.get("book") or {}).get("file", "") if drift else ""],
        ["Repository synced to", f"v{drift.get('recorded')}" if drift else ""],
        ["Automation cells read", cells_read],
        ["Red cells (lines that do not read)", len(red_rows)],
        ["", ""],
        ["Errors (the build stopped on these)", counts["Error"]],
        ["Fixes (a cell or a file to mend)", counts["Fix"]],
        ["Decisions (your call)", counts["Decision"] + sum(1 for d in open_dec if d.get("status", "open") == "open")],
        ["Notes (accepted, said each run)", counts["Note"]],
        ["", ""],
        ["Do this first", f"{first_todo.where} {first_todo.item}: {first_todo.recommendation}" if first_todo else "Nothing to fix: only decisions and notes."],
        ["", ""],
        ["By category", ""],
    ] + [[k, v] for k, v in sorted(by_cat.items())] + [["", ""]] + [["Report notes", n] for n in notes] + [
        ["", ""],
        ["How to read it", "Issues: every finding of this build, filterable; Decisions: the open questions only you can close, "
                           "with Claude's recommendation; Red cells: every Automation line the grammar cannot read. "
                           "A row's First seen is the date it first appeared in a report; 'new' means this build."],
    ]
    sheet(wb, "Summary", ["", ""], summary, [38, 120], first=True)
    sheet(wb, "Issues",
          ["Severity", "Category", "Where", "Item", "Finding", "Recommendation", "Step", "First seen", "Status"],
          [[f.severity, f.category, f.where, f.item, f.finding, f.recommendation, f.step, seen.get(f.key, TODAY),
            "new" if seen.get(f.key, TODAY) == TODAY else "open since " + seen.get(f.key, TODAY)] for f in unique],
          [10, 15, 34, 24, 60, 70, 14, 12, 18], fills=lambda r: SEV_FILL.get(r[0]))
    dec_rows = [[d.get("status", "open"), d.get("id", ""), d.get("category", ""), d.get("where", ""), d.get("question", ""),
                 d.get("recommendation", ""), d.get("since", ""), d.get("decidedBy", "")] for d in open_dec]
    dec_rows += [["open", "", f.category, f"{f.where} {f.item}".strip(), f.finding, f.recommendation, seen.get(f.key, TODAY), ""]
                 for f in unique if f.severity == "Decision"]
    sheet(wb, "Decisions", ["Status", "Id", "Category", "Where", "Question", "Recommendation", "Since", "Decided by"],
          dec_rows, [10, 16, 16, 30, 70, 70, 12, 14], fills=lambda r: "FFFFF2CC" if r[0] == "open" else "FFE2EFDA")
    sheet(wb, "Red cells", ["Workbook", "Sheet", "Cell", "Talent / row", "Constellation", "Line", "The grammar says", "Why", "Hint", "Enabled"],
          red_rows, [16, 18, 8, 22, 16, 50, 60, 14, 60, 8])

    out = OUT
    try:
        wb.save(out)
    except PermissionError:
        out = os.path.join(ROOT, f"build-report.{_dt.datetime.now().strftime('%Y%m%d-%H%M')}.xlsx")
        wb.save(out)
        print(f"  build-report.xlsx is open in Excel; written to {os.path.basename(out)} instead")
    print(f"build report: {counts['Error']} error(s), {counts['Fix']} fix(es), "
          f"{counts['Decision'] + sum(1 for d in open_dec if d.get('status', 'open') == 'open')} decision(s), {counts['Note']} note(s) -> {os.path.relpath(out, ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        print("build report: NOT written (the report never fails the build; see the traceback)")
        sys.exit(1)
