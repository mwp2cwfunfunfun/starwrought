#!/usr/bin/env python3
"""highlight_automation.py: paint red every Automation cell the grammar cannot read.

Mike, 2026-11-08: "Any automation fields that I may have mis-typed, or for which there are not yet
Kinds, highlight those cells in red in the data/ spreadsheets."

    python assets/highlight_automation.py            # paint, clear, and write the report
    python assets/highlight_automation.py --dry-run  # the verdicts and the report, no workbook written
    python assets/highlight_automation.py --report <path>   # the report somewhere else

What it does, workbook by workbook (data/*.xlsx, the equipment and languages workbooks aside):

  * Finds every Automation cell the converter would read (tree sheets, action sheets, the
    Backgrounds sheet) and every Effect cell carrying an `@Maneuver[Name]` marker, by the same
    header rules xlsx_to_trees.py uses (its helpers are imported, so the two never disagree about
    which column is which).
  * Hands the cells to assets/lib/parse_cells.mjs, which parses each with the system's own grammar
    and the build's own resolver over the trees and the Maneuver rows read from these very
    workbooks (ruling 120: Python holds no parser). A cell is red here exactly when
    assets/parse_rules.mjs would refuse it: a line the grammar cannot read, a name nothing in the
    data answers to, a `[MANEUVER X]` whose row is not enabled on an enabled Talent, a marker that
    names no row.
  * Paints each failing cell with a solid red fill and a cell comment giving the grammar's own
    message for each bad line and a one-line reading of WHY (mis-typed, with the nearest name when
    one is close; no kind yet, when the grammar has no word for what the line asks; not yet
    readable, when the cell is right but the sheet it names is not indexed or the workbook it
    names is not read by the pipeline).
  * Clears its own red (fill and comment) from a cell that reads again, so the run is a status, not
    a stain: fix the cell, run it again, the red goes. A fill or comment that is not the tool's is
    left alone.
  * Writes automation-cells-report.md in the project root: every red cell by workbook, sheet, cell
    address and Talent, the cause, and the grammar's message; then the kinds the cells ask for that
    the grammar does not have yet; then the data-shape notes that stop the pipeline reading a cell
    at all (an unindexed sheet, an actions index without its Type column).

Workbooks are loaded with rich_text=True and saved only when a cell's state changed, so the Effect
cells' bold and italics (which the converter mirrors into the app) survive the round trip. A
workbook open in Excel (a ~$ lock file beside it) is read and reported but not written.
"""

import datetime as _dt
import difflib
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

from openpyxl import load_workbook
from openpyxl.cell.rich_text import CellRichText
from openpyxl.comments import Comment
from openpyxl.styles import PatternFill
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
sys.path.insert(0, HERE)
import xlsx_to_trees as xt  # noqa: E402  (plain, header_map, enabled_flag, action_bare, blank_none, CATEGORIES)

NODE_HELPER = os.path.join(HERE, "lib", "parse_cells.mjs")
REPORT_DEFAULT = os.path.join(ROOT, "automation-cells-report.md")

# The tool's own mark: this fill and this comment author, and nothing else, are what it clears.
MARK_RGB = "FFFF9999"
MARK_FILL = PatternFill(fill_type="solid", fgColor=MARK_RGB, bgColor=MARK_RGB)
CLEAR_FILL = PatternFill(fill_type=None)
AUTHOR = "STARWROUGHT automation check"
MARKER = re.compile(r"@Maneuver\[([^\]]+)\]")

EQUIPMENT_SHEETS = ("Weapons", "Armor", "Shields")


def text_of(value):
    """A cell's text as the converter reads it: rich text flattened, None blank."""
    if value is None:
        return ""
    if isinstance(value, CellRichText):
        return str(value)
    return str(value)


# ------------------------------------------------------------------------------------------------
#  Reading the workbooks
# ------------------------------------------------------------------------------------------------

class Cell:
    """One cell the grammar judges: where it is, what it carries, and what the pipeline would call it."""

    def __init__(self, wb_name, ws, row, col, text, item_name, constellation, item_type, source, enabled, kind):
        self.wb_name, self.ws, self.row, self.col = wb_name, ws, row, col
        self.text, self.item_name, self.constellation = text, item_name, constellation
        self.item_type, self.source, self.enabled, self.kind = item_type, source, enabled, kind  # kind: "automation" | "effect"
        self.id = f"{wb_name}!{ws.title}!{get_column_letter(col)}{row}"
        self.failures = []   # [(line, text, message)]
        self.rules = []
        self.root = False

    @property
    def address(self):
        return f"{get_column_letter(self.col)}{self.row}"


def read_workbooks():
    """Every workbook the converter reads, in its order, with the facts the resolver needs."""
    files = [f for f in sorted(glob.glob(os.path.join(DATA, "*.xlsx"))) if not os.path.basename(f).startswith("~$")]
    books = {}            # fname -> workbook (kept open for painting)
    locked = set()
    trees = {}            # tree name -> {parent, category, workbook, sheet}
    unindexed = {}        # fname -> [sheet titles a tree workbook has that its index does not name]
    index_without_sheet = []  # (fname, tree name)
    actions = {}          # key -> {name, enabled, workbook, sheet}
    other_rows = {}       # key -> (fname, sheet) for rows on sheets the converter ignores (Activity columns)
    notes = []            # data-shape notes for the report
    cells = []
    index_rows = {}       # fname -> [(tree, {column: value})] for the chassis notes
    for path in files:
        fname = os.path.basename(path)
        if os.path.exists(os.path.join(DATA, "~$" + fname)):
            locked.add(fname)
        wb = load_workbook(path, rich_text=True)
        books[fname] = wb
        if "_Tree Index" in wb.sheetnames:
            idx = wb["_Tree Index"]
            probe = xt.header_map(idx, {"tree": "tree", "name": "name"})
            if "tree" not in probe and "name" in probe:
                # The converter's own rule since 0.20.0: the Type column is any header containing
                # "type" and is optional (the row's own Type cell types it). Named here only so the
                # report says what the index lacks; nothing is refused.
                if xt.header_containing(idx, "type", exclude=("categ",)) is None:
                    notes.append(f"**{fname}**: its `_Tree Index` has no Type column (the header reads "
                                 f"`{' | '.join(xt.plain(idx.cell(1, j)) for j in range(1, idx.max_column + 1))}`); the "
                                 f"converter types every row by its own Type cell or its sheet, and "
                                 f"`python assets/index_sheets.py` fills the index.")
                read_actions_workbook(wb, fname, actions, other_rows, cells, notes)
                continue
        if "_Tree Index" not in wb.sheetnames:
            if "Backgrounds" in wb.sheetnames:
                read_backgrounds(wb, fname, cells)
            continue
        read_tree_workbook(wb, fname, trees, unindexed, index_without_sheet, cells, index_rows)
    return dict(books=books, locked=locked, trees=trees, unindexed=unindexed, index_without_sheet=index_without_sheet,
                actions=actions, other_rows=other_rows, cells=cells, notes=notes, index_rows=index_rows)


def read_tree_workbook(wb, fname, trees, unindexed, index_without_sheet, cells, index_rows):
    idx = wb["_Tree Index"]
    im = xt.header_map(idx, {"tree": "tree", "cat": "categ", "parent": "parent", "vigor": "vigor", "hp": "hp",
                             "size": "size", "speed": "speed", "senses": "senses", "traits": "trait",
                             "languages": "language", "skills": "skills"})
    if "tree" not in im or "cat" not in im:
        return
    named = set()
    index_rows[fname] = []
    for row in idx.iter_rows(min_row=2):
        g = lambda k: xt.plain(row[im[k]]) if k in im and len(row) > im[k] else ""
        name = g("tree")
        if not name:
            continue
        named.add(name)
        category = xt.CATALIAS.get(g("cat"), g("cat"))
        if g("cat") not in xt.CATEGORIES:
            continue
        index_rows[fname].append((name, {k: g(k) for k in ("vigor", "hp", "size", "speed", "senses", "traits", "languages", "skills")}))
        if name not in wb.sheetnames:
            if not (category == "Background" and "Backgrounds" in wb.sheetnames):
                index_without_sheet.append((fname, name))
            continue
        if name in trees:  # the first workbook read stands (the converter's rule since 2026-11-07)
            continue
        trees[name] = {"parent": g("parent"), "category": category, "workbook": fname, "sheet": name}
        ws = wb[name]
        cm = xt.header_map(ws, {"name": "talent", "tier": "tier", "root": "root", "effect": "effect",
                                "automation": "automation", "enabled": "enabled"})
        if "name" not in cm or "effect" not in cm:
            continue
        for r in ws.iter_rows(min_row=2):
            cv = lambda k: (r[cm[k]] if k in cm and len(r) > cm[k] else None)
            talent = xt.plain(cv("name"))
            if not talent:
                continue
            enabled = xt.enabled_flag(cv("enabled"), "enabled" in cm)
            is_root = xt.plain(cv("root")).lower() in ("x", "h")
            source = f"{name} / {talent}"
            if "automation" in cm:
                c = cv("automation")
                text = text_of(c.value) if c is not None else ""
                if text.strip():
                    cell = Cell(fname, ws, c.row, c.column, text, talent, name, "talent", source, enabled, "automation")
                    cell.root = is_root
                    cells.append(cell)
            e = cv("effect")
            if e is not None and MARKER.search(text_of(e.value)):
                cells.append(Cell(fname, ws, e.row, e.column, text_of(e.value), talent, name, "talent", source, enabled, "effect"))
    extra = [t for t in wb.sheetnames if t != "_Tree Index" and not t.endswith(" Lore") and t not in named]
    if extra:
        unindexed[fname] = extra


def read_backgrounds(wb, fname, cells):
    ws = wb["Backgrounds"]
    bm = xt.header_map(ws, {"name": "background", "effect": "effect", "enabled": "enabled", "automation": "automation"})
    if "name" not in bm or "effect" not in bm:
        return
    for r in ws.iter_rows(min_row=2):
        cv = lambda k: (r[bm[k]] if k in bm and len(r) > bm[k] else None)
        bname = xt.plain(cv("name"))
        if not bname:
            continue
        enabled = xt.enabled_flag(cv("enabled"), "enabled" in bm)
        source = f"Backgrounds / {bname}"
        if "automation" in bm:
            c = cv("automation")
            text = text_of(c.value) if c is not None else ""
            if text.strip():
                cells.append(Cell(fname, ws, c.row, c.column, text, bname, "Backgrounds", "background", source, enabled, "automation"))
        e = cv("effect")
        if e is not None and MARKER.search(text_of(e.value)):
            cells.append(Cell(fname, ws, e.row, e.column, text_of(e.value), bname, "Backgrounds", "background", source, enabled, "effect"))


def read_actions_workbook(wb, fname, actions, other_rows, cells, notes):
    """The rows as the converter keeps them: one per bare name per workbook, an enabled row over a
    disabled one, else the earlier sheet; a sheet with no Action column (an Activity column, say) is
    not read, and its rows are remembered only so a cell naming one can be told why it fails."""
    for ws in wb.worksheets:
        if ws.title in ("_Tree Index", "About"):
            continue
        cm = xt.header_map(ws, {"name": "action", "effect": "effect", "automation": "automation", "enabled": "enabled"})
        if "name" not in cm:
            om = xt.header_map(ws, {"name": ("activity", "endeavor"), "automation": "automation"})
            if "name" in om:
                for r in ws.iter_rows(min_row=2):
                    raw = xt.plain(r[om["name"]]) if len(r) > om["name"] else ""
                    if raw:
                        other_rows.setdefault(xt.action_key(raw), (fname, ws.title))
                    if "automation" in om and len(r) > om["automation"]:
                        c = r[om["automation"]]
                        if text_of(c.value).strip():
                            cells.append(Cell(fname, ws, c.row, c.column, text_of(c.value), xt.action_bare(raw), ws.title, "action",
                                              f"data/{fname} / {ws.title} / {xt.action_bare(raw)}", True, "automation"))
                notes.append(f"**{fname} / {ws.title}**: no `Action` column (the rows are under `{xt.plain(ws.cell(1, om['name'] + 1))}`), "
                             f"so the converter ignores the sheet; its rows are not Maneuvers the grammar can name.")
            continue
        if "effect" not in cm:
            continue
        for r in ws.iter_rows(min_row=2):
            cv = lambda k: (r[cm[k]] if k in cm and len(r) > cm[k] else None)
            raw = xt.plain(cv("name"))
            if not raw:
                continue
            name = xt.action_bare(raw)
            key = name.lower()
            enabled = xt.enabled_flag(cv("enabled"), "enabled" in cm)
            if key in actions:
                if enabled and not actions[key]["enabled"]:
                    actions[key] = {"name": name, "enabled": enabled, "workbook": fname, "sheet": ws.title}
            else:
                actions[key] = {"name": name, "enabled": enabled, "workbook": fname, "sheet": ws.title}
            if "automation" in cm:
                c = cv("automation")
                text = text_of(c.value) if c is not None else ""
                if text.strip():
                    cells.append(Cell(fname, ws, c.row, c.column, text, name, ws.title, "action",
                                      f"data/{fname} / {ws.title} / {name}", enabled, "automation"))


# ------------------------------------------------------------------------------------------------
#  The grammar's verdict
# ------------------------------------------------------------------------------------------------

def parse_cells(data):
    automation = [c for c in data["cells"] if c.kind == "automation"]
    request = {
        "trees": {name: {"parent": t["parent"], "category": t["category"]} for name, t in data["trees"].items()},
        "sheetActions": [{"name": a["name"], "enabled": a["enabled"]} for a in data["actions"].values()],
        "cells": [{"id": c.id, "text": c.text, "itemName": c.item_name, "constellation": c.constellation,
                   "itemType": c.item_type, "source": c.source} for c in automation]
    }
    tmp = tempfile.mkdtemp(prefix="sw-cells-")
    req, rep = os.path.join(tmp, "request.json"), os.path.join(tmp, "reply.json")
    with open(req, "w", encoding="utf-8") as f:
        json.dump(request, f, ensure_ascii=False)
    run = subprocess.run(["node", NODE_HELPER, req, rep], capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if run.returncode != 0:
        sys.exit(f"parse_cells.mjs failed:\n{run.stdout}\n{run.stderr}")
    with open(rep, encoding="utf-8") as f:
        reply = json.load(f)
    by_id = {r["id"]: r for r in reply["results"]}
    for c in automation:
        r = by_id[c.id]
        c.rules = r["rules"]
        c.failures = [(e["line"], e["text"], e["message"]) for e in r["errors"]]
        # parse_rules.mjs: a [MANEUVER X] naming a row that is not enabled is an error on an enabled carrier.
        for rule in r["rules"]:
            if rule.get("kind") == "maneuver" and rule.get("enabled") is False and c.enabled:
                c.failures.append((rule.get("line", 0), rule.get("text", ""),
                                   f"[MANEUVER {rule.get('name')}] names a Maneuver whose row is not enabled (Enabled? in "
                                   f"data/maneuvers.xlsx); Foundry cannot grant it"))
    # The markers: a name that is no Maneuver row is an error naming the cell (parse_rules.mjs).
    for c in data["cells"]:
        if c.kind != "effect":
            continue
        for m in MARKER.finditer(c.text):
            key = xt.action_key(m.group(1))
            if key not in data["actions"]:
                c.failures.append((0, m.group(0), f"@Maneuver[{m.group(1).strip()}] names no row of the actions workbook (data/maneuvers.xlsx)"))
    return reply["vocabulary"]


# ------------------------------------------------------------------------------------------------
#  Why a line fails: the one-line reading beside the grammar's message
# ------------------------------------------------------------------------------------------------

NAME_PATTERNS = [
    (re.compile(r'"([^"]+)" names no Constellation or Maneuver'), "name"),
    (re.compile(r'"([^"]+)" names no Constellation'), "constellation"),
    (re.compile(r'"([^"]+)" is not a Constellation'), "constellation"),
    (re.compile(r'"([^"]+)" is not a Maneuver'), "maneuver"),
    (re.compile(r'@Maneuver\[([^\]]+)\] names no row'), "maneuver"),
    (re.compile(r'\[MANEUVER ([^\]]+)\] names a Maneuver whose row is not enabled'), "disabled"),
    (re.compile(r'"([^"]+)" is not a Defense'), "defense"),
    (re.compile(r'"([^"]+)" is not a terrain kind'), "terrain"),
    (re.compile(r'"([^"]+)" is not a Condition or Expose'), "condition"),
    (re.compile(r'"([^"]+)" is not a grant scope'), "scope"),
    (re.compile(r'"([^"]+)" is not a Size'), "size"),
    (re.compile(r'"([^"]+)" is not a bonus type'), "type"),
    (re.compile(r'unknown rule kind "([^"]+)"'), "kind"),
    (re.compile(r'"([^"]+)" is not a condition'), "cond-word"),
    (re.compile(r'"([^"]+)" is not a component'), "component"),
]


def close(word, options, cutoff=0.75):
    opts = {o.lower(): o for o in options if o}
    hits = difflib.get_close_matches(word.lower(), list(opts), n=1, cutoff=cutoff)
    return opts[hits[0]] if hits else None


def why(message, text, data, vocab, item_name=""):
    """(category, hint). Categories: mis-typed | no kind yet | names nothing | not yet readable | wrong shape."""
    tree_names = list(data["trees"])
    action_names = [a["name"] for a in data["actions"].values()]
    # `[EFFECT: ...]`, `[SPEED: ...]`: a keyword with a colon after it. The colon is the slip; what is
    # inside decides whether anything would read once it is gone.
    m = re.search(r'"([^"]+)" is not a feature keyword', message)
    if m:
        word = m.group(1).strip()
        bare = word.rstrip(":").strip()
        keywords = vocab.get("keywords", [])
        key = next((k for k in keywords if k.lower() == bare.lower()), None)
        inner = re.sub(r"^\[\s*" + re.escape(word) + r"\s*", "", text.strip(), flags=re.I).rstrip("]").strip()
        if key == "EFFECT":
            head = re.split(r"[;\]]", inner, maxsplit=1)[0]
            tag_word = re.split(r"[\s:,]+", head.strip(), maxsplit=1)[0] if head.strip() else ""
            if tag_word.upper() in vocab.get("tags", []):
                return "mis-typed", f"no colon after EFFECT: write `[EFFECT {inner}]`"
            near = close(tag_word, vocab.get("tags", [])) if tag_word else None
            if near:
                return "mis-typed", f"no colon after EFFECT, and did you mean the {near} tag?"
            return "no kind yet", f"no colon after EFFECT; and \"{head.strip()}\" begins with no tag the grammar knows, so a kind would have to be written for it"
        if key:
            return "no kind yet", f"no colon after {key}; and `[{key} {inner}]` is not a shape {key} reads, so a kind would have to be written for it"
        near = close(bare, keywords)
        if near:
            return "mis-typed", f"did you mean \"{near}\"?"
        return "no kind yet", f"the grammar has no keyword \"{bare}\""
    for pattern, what in NAME_PATTERNS:
        m = pattern.search(message)
        if not m:
            continue
        name = m.group(1).strip()
        if what == "disabled":
            return "not yet readable", f"the Maneuver row \"{name}\" exists but its Enabled? cell is not Yes; set it to Yes or disable this Talent"
        # The name is right but the pipeline cannot see it yet: an exact match on a sheet the index
        # does not name, a row of a workbook the converter does not read, an index row with no sheet.
        if what in ("name", "constellation", "maneuver"):
            for fname, sheets in data["unindexed"].items():
                hit = next((s for s in sheets if s.lower() == name.lower()), None)
                if hit:
                    return "not yet readable", f"\"{hit}\" is a sheet of {fname} but not a row of its _Tree Index; add the row and this reads"
            other = data["other_rows"].get(xt.action_key(name))
            if other:
                return "not yet readable", f"\"{name}\" is a row of {other[0]} / {other[1]}, a sheet the pipeline does not read (no Action column)"
            for fname, tree in data["index_without_sheet"]:
                if tree.lower() == name.lower():
                    return "not yet readable", f"\"{tree}\" is in {fname}'s _Tree Index but has no sheet yet"
            # A [MANEUVER X] or @Maneuver[X] on a Talent whose own name IS a row: the row was renamed, or the cell was.
            if what == "maneuver" and item_name and xt.action_key(item_name) in data["actions"] and xt.action_key(item_name) != xt.action_key(name):
                return "mis-typed", f"did you mean \"{data['actions'][xt.action_key(item_name)]['name']}\", this Talent's own name, which is a row?"
        pool = {"name": tree_names + action_names + ["Origin"], "constellation": tree_names + ["Origin"], "maneuver": action_names,
                "defense": vocab.get("defenses", []), "terrain": vocab.get("terrainKinds", []), "scope": vocab.get("grantScopes", []),
                "size": vocab.get("sizes", []), "type": ["Situation", "Condition", "Gear"], "kind": vocab.get("tags", []) + vocab.get("keywords", []),
                "cond-word": vocab.get("conditions", []), "component": vocab.get("components", []), "condition": []}.get(what, [])
        near = close(name, pool)
        if near and near.lower() != name.lower():
            return "mis-typed", f"did you mean \"{near}\"?"
        if what in ("name", "constellation", "maneuver"):
            return "names nothing", f"nothing in the data is called \"{name}\" (no Constellation" + (", Maneuver" if what != "constellation" else "") + ")"
        if what == "terrain":
            return "no kind yet", f"\"{name}\" is not a row of the roster's terrainKinds block (assets/roster.json); a row there, no code, adds it"
        if what == "kind":
            return "no kind yet", f"the grammar has no tag or keyword \"{name}\""
        if what == "cond-word":
            return "no kind yet", f"the grammar has no condition \"{name}\" (known: {', '.join(vocab.get('conditions', []))})"
        return "mis-typed", f"\"{name}\" is not one of the words the grammar knows here"
    low = message.lower()
    if "0.13.0 form" in low or "retired" in low:
        return "wrong shape", "the retired operator form; AUTOMATION_GRAMMAR.md section 9 maps it"
    if "no tag" in low or "wraps an effect line" in low or "after the ring" in low:
        inner = re.sub(r"^\[EFFECT\s*:?\s*", "", text.strip(), flags=re.I).rstrip("]")
        word = re.split(r"[\s:;,]+", inner.strip(), maxsplit=1)[0] if inner.strip() else ""
        near = close(word, vocab.get("tags", []) + vocab.get("keywords", [])) if word else None
        if near:
            return "mis-typed", f"did you mean \"{near}\"?"
        return "no kind yet", "this asks for something no tag or keyword of the grammar does; a kind would have to be written for it"
    if "is not a trait word" in low:
        return "mis-typed", "a trait is letters, digits, spaces, apostrophes and hyphens"
    if "is written" in low or "takes" in low or "needs" in low or "does nothing" in low or "drop the" in low or "write " in low:
        return "wrong shape", "the grammar's message gives the shape"
    return "wrong shape", "the grammar's message says what is wrong"


# ------------------------------------------------------------------------------------------------
#  Painting
# ------------------------------------------------------------------------------------------------

def is_marked(cell):
    fill = cell.fill
    try:
        rgb = fill.fgColor.rgb if fill is not None and fill.fill_type == "solid" else None
    except AttributeError:
        rgb = None
    return isinstance(rgb, str) and rgb.upper() == MARK_RGB


def has_other_fill(cell):
    fill = cell.fill
    if fill is None or fill.fill_type in (None, "none"):
        return False
    return not is_marked(cell)


PREVIOUS_FILL = re.compile(r"^Previous fill: ([0-9A-Fa-f]{8})$", re.M)


def previous_fill_of(cell):
    """The fill the tool painted over, as its comment recorded it; None when there was none."""
    if cell.comment is None or cell.comment.author != AUTHOR:
        return None
    m = PREVIOUS_FILL.search(cell.comment.text or "")
    return m.group(1).upper() if m else None


def comment_text(cell, data, vocab, today, previous):
    lines = [f"Automation check ({today}): this cell does not read; the pipeline skips it (red on the Item sheet, a release build fails)."]
    for line, text, message in cell.failures:
        where = f"line {line}" if line else "marker"
        category, hint = why(message, text, data, vocab, cell.item_name)
        lines.append(f"{where} \"{text}\": {message}")
        lines.append(f"  Why: {category}. {hint}")
    if previous:
        # Mike marks his own unsure cells yellow; the mark covers it and the clear puts it back.
        lines.append(f"Previous fill: {previous}")
    return "\n".join(lines)


def paint(data, vocab, dry_run):
    today = _dt.date.today().isoformat()
    changed = {}   # fname -> [events]
    for c in data["cells"]:
        xl = c.ws.cell(c.row, c.col)
        events = changed.setdefault(c.wb_name, [])
        if c.failures:
            previous = previous_fill_of(xl)
            if previous is None and has_other_fill(xl):
                rgb = xl.fill.fgColor.rgb
                previous = rgb.upper() if isinstance(rgb, str) else None
                events.append(f"NOTE {c.ws.title}!{c.address} had a fill of its own ({previous or 'theme colour'}); the mark covers it and a clear restores it")
            text = comment_text(c, data, vocab, today, previous)
            already = is_marked(xl) and xl.comment is not None and xl.comment.author == AUTHOR \
                and re.sub(r"^Automation check \(\d{4}-\d{2}-\d{2}\)", "", xl.comment.text or "") == re.sub(r"^Automation check \(\d{4}-\d{2}-\d{2}\)", "", text)
            if already:
                continue
            if not dry_run:
                xl.fill = MARK_FILL
                comment = Comment(text, AUTHOR)
                comment.width, comment.height = 520, 160 + 60 * len(c.failures)
                xl.comment = comment
            events.append(f"RED  {c.ws.title}!{c.address} ({c.item_name})")
        elif is_marked(xl):
            previous = previous_fill_of(xl)
            if not dry_run:
                xl.fill = PatternFill(fill_type="solid", fgColor=previous, bgColor=previous) if previous else CLEAR_FILL
                if xl.comment is not None and xl.comment.author == AUTHOR:
                    xl.comment = None
            events.append(f"CLEAR {c.ws.title}!{c.address} ({c.item_name}) reads again" + (f"; its {previous} fill restored" if previous else ""))
    return changed


# ------------------------------------------------------------------------------------------------
#  The report
# ------------------------------------------------------------------------------------------------

def chassis_notes(data):
    """The _Tree Index columns parse_rules.mjs will compare with the Root's blocks (the 0.16.0 one-release rule)."""
    out = []
    roots = {}
    for c in data["cells"]:   # the first Root of a tree in row order, as parse_rules.mjs's rootOf reads it
        if c.kind == "automation" and c.root and c.constellation not in roots:
            roots[c.constellation] = c
    for fname, rows in data["index_rows"].items():
        for tree, cols in rows:
            root = roots.get(tree)
            if not root or not root.rules:
                continue
            rules = root.rules
            vig = next((r for r in rules if r.get("kind") == "vigor" and r.get("scope") == "level"), None)
            col_v = cols.get("vigor") or cols.get("hp")
            if vig and col_v and str(vig.get("value")) != str(col_v).strip():
                out.append(f"{fname} / {tree}: the index's Vigor column reads {col_v} but the Root's [VIGOR] says {vig.get('value')}")
            size = next((r for r in rules if r.get("kind") == "size"), None)
            if size and cols.get("size") and str(size.get("size", "")).lower() != cols["size"].strip().lower():
                out.append(f"{fname} / {tree}: the index's Size column reads {cols['size']} but the Root's [SIZE] says {size.get('size')}")
            speed = next((r for r in rules if r.get("kind") == "speed" and r.get("mode") == "set"), None)
            if speed and cols.get("speed"):
                m = re.match(r"\s*(\d+)", cols["speed"])
                if m and int(m.group(1)) != int(speed.get("feet", -1)):
                    out.append(f"{fname} / {tree}: the index's Speed column reads {cols['speed']} but the Root's [SPEED] says {speed.get('feet')}")
            senses = [r.get("name", "").lower() for r in rules if r.get("kind") == "sense"]
            col_s = [s.strip().lower() for s in re.split(r",|•", cols.get("senses", "")) if s.strip() and s.strip() not in ("—", "-", "none")]
            if senses and col_s and sorted(senses) != sorted(col_s):
                out.append(f"{fname} / {tree}: the index's Senses column reads \"{cols['senses']}\" but the Root's [SENSES] says \"{', '.join(senses)}\"")
            langs = [l.lower() for r in rules if r.get("kind") == "language" for l in r.get("languages", [])]
            col_l = [s.strip().lower() for s in re.split(r",|•", cols.get("languages", "")) if s.strip()]
            if langs and col_l and sorted(langs) != sorted(col_l):
                out.append(f"{fname} / {tree}: the index's Languages column reads \"{cols['languages']}\" but the Root's [LANGUAGE] says \"{', '.join(langs)}\"")
    return out


def write_report(path, data, vocab, changed, dry_run):
    today = _dt.date.today().isoformat()
    red = [c for c in data["cells"] if c.failures]
    by_book = {}
    for c in red:
        by_book.setdefault(c.wb_name, []).append(c)
    lines = [f"# Automation cells: the grammar's verdict ({today})", ""]
    lines.append(f"`python assets/highlight_automation.py`{' --dry-run' if dry_run else ''}. "
                 f"{len([c for c in data['cells'] if c.kind == 'automation'])} Automation cells and "
                 f"{len([c for c in data['cells'] if c.kind == 'effect'])} Effect cells with `@Maneuver[...]` markers were read across "
                 f"{len(data['books'])} workbooks; **{len(red)} cells do not read** and are painted red "
                 f"({MARK_RGB[2:]}) with a comment giving the grammar's message and the reason. A cell that reads again on a later "
                 f"run is cleared. The kinds the grammar has: {', '.join(vocab.get('kinds', []))}.")
    lines.append("")
    counts = {}
    for c in red:
        for _, text, message in c.failures:
            category = why(message, text, data, vocab, c.item_name)[0]
            counts[category] = counts.get(category, 0) + 1
    if counts:
        lines.append("| why | lines |")
        lines.append("|---|---|")
        for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
            lines.append(f"| {k} | {v} |")
        lines.append("")
    for fname, cs in by_book.items():
        lines.append(f"## {fname}" + (" (open in Excel: not written)" if fname in data["locked"] else ""))
        lines.append("")
        lines.append("| sheet!cell | Talent / row | line | the grammar says | why |")
        lines.append("|---|---|---|---|---|")
        for c in cs:
            for line, text, message in c.failures:
                category, hint = why(message, text, data, vocab, c.item_name)
                esc = lambda s: str(s).replace("|", "\\|").replace("\n", " ")
                lines.append(f"| `{c.ws.title}!{c.address}` | {esc(c.item_name)} | `{esc(text)}` | {esc(message)} | **{category}**: {esc(hint)} |")
        lines.append("")
    wanted = {}
    for c in red:
        for _, text, message in c.failures:
            category, hint = why(message, text, data, vocab, c.item_name)
            if category == "no kind yet":
                wanted.setdefault(text, []).append(f"{c.constellation} / {c.item_name}")
    lines.append("## What the cells ask for that the grammar does not have")
    lines.append("")
    if wanted:
        lines.append("Each is a kind, a condition or a vocabulary row to add, one at a time (ruling 119), by the recipe in "
                     "`foundry/starwrought/module/rules/README.md`; the line is quoted as written.")
        lines.append("")
        for text, who in wanted.items():
            lines.append(f"- `{text}` ({'; '.join(who)})")
    else:
        lines.append("Nothing: every failing line is a slip or a name, not a missing kind.")
    lines.append("")
    lines.append("## Data-shape notes (what stops the pipeline reading a cell at all)")
    lines.append("")
    notes = list(data["notes"])
    for fname, sheets in data["unindexed"].items():
        notes.append(f"**{fname}**: sheets not in its `_Tree Index`, so the converter ignores them and no cell names them: "
                     + ", ".join(f"`{s}`" for s in sheets))
    for fname, tree in data["index_without_sheet"]:
        notes.append(f"**{fname}**: `{tree}` is in the `_Tree Index` but has no sheet")
    notes.extend(f"**chassis**: {n}" for n in chassis_notes(data))
    if notes:
        lines.extend(f"- {n}" for n in notes)
    else:
        lines.append("None.")
    lines.append("")
    if changed:
        lines.append("## This run")
        lines.append("")
        for fname, events in changed.items():
            if events:
                lines.append(f"- **{fname}**: " + "; ".join(events))
        lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ------------------------------------------------------------------------------------------------

def main():
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    report = REPORT_DEFAULT
    if "--report" in args:
        report = os.path.abspath(args[args.index("--report") + 1])
    data = read_workbooks()
    vocab = parse_cells(data)
    changed = paint(data, vocab, dry_run)
    written = []
    if not dry_run:
        for fname, events in changed.items():
            if not events:
                continue
            if fname in data["locked"]:
                print(f"  {fname}: open in Excel, not written ({len(events)} changes pending)")
                continue
            data["books"][fname].save(os.path.join(DATA, fname))
            written.append(fname)
    write_report(report, data, vocab, changed, dry_run)
    red = [c for c in data["cells"] if c.failures]
    for fname, events in changed.items():
        for e in events:
            print(f"  {fname}: {e}")
    print(f"automation cells: {len(red)} of {len(data['cells'])} do not read"
          + (f"; {len(written)} workbook{'s' if len(written) != 1 else ''} written" if written else "; nothing written")
          + f"; report at {os.path.relpath(report, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
