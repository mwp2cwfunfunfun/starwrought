#!/usr/bin/env python3
"""
index_sheets.py: regenerate or update the `_Tree Index` tab of every workbook in data/ from the
sheets each workbook actually holds (Mike, 2026-11-08: "I need you to generate/re-generate/update
the _Tree Index tabs in all of them").

    python assets/index_sheets.py            # update every index that needs it, backups first
    python assets/index_sheets.py --dry-run  # report only, write nothing
    python assets/index_sheets.py --no-backup

What it does, per workbook with a `_Tree Index` sheet:

  TREE WORKBOOKS (index headed Tree | Category | ...): every sheet that is not the index, an
    About sheet, a Backgrounds or Languages table, or a `<Tree> Lore` sheet is a tree and gets an
    index row if none names it: Tree = the sheet's name, Category inferred from the workbook
    (ancestries.xlsx -> Ancestry, cultures -> Culture, callings -> Calling, skills -> Skill,
    defenses -> Defense, weapons -> Weapon, combat_styles -> Combat Style, magic -> Magic), every
    other cell left blank and NAMED in the report, because Primary Attribute, Parent and the rest
    are hand-kept and the tool never guesses them. A sheet named `Lore (anything)` is the Lore
    template and belongs to the index's `Lore` row (skills.xlsx, 0.20.0), not to a row of its own.
    An index row whose sheet is missing is REPORTED with the nearest sheet name, never dropped
    (Mike's rows are his); so is a `<X> Lore` sheet whose X is no tree of the workbook
    (`Halfline Lore`: "did you mean Halfling?").

  ACTIONS WORKBOOKS (index headed Name | Type | ... or Name | Action Type | Category/Type): one
    row per action across the workbook's sheets (a sheet's Action, Activity or Endeavor column
    names them). A new name gets Name, the row's own Type cell and, for the category column, the
    sheet's Category cell when it has one, else the sheet's name. An existing row keeps every
    filled cell and has its blank Type and Category filled the same way. An index name that no
    sheet carries any more is REPORTED (Parry, Void, Counter, Intercept today), never dropped.

  Existing cells are never overwritten. A workbook is saved only when a cell changed, loaded with
  rich_text=True so the Effect cells' formatting survives, and copied to backup/index-<date>/
  first unless --no-backup. A workbook open in Excel (a ~$ lock file beside it) is reported and
  skipped, since Excel would lose the write.

The converter (xlsx_to_trees.py) reads the result; this tool knows nothing of the trees' content.
"""
import argparse, datetime, difflib, glob, os, re, shutil, sys
from copy import copy
from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
BACKUP = os.path.join(ROOT, "backup")

# The Category a tree sheet gets from the workbook it sits in (the converter's CATEGORIES).
CATEGORY_BY_WORKBOOK = {
    "ancestries": "Ancestry", "cultures": "Culture", "callings": "Calling", "skills": "Skill",
    "defenses": "Defense", "weapons": "Weapon", "combat_styles": "Combat Style", "magic": "Magic",
}
SKIP_SHEETS = ("_Tree Index", "About", "Backgrounds", "Languages")
LORE_SHEET = re.compile(r"^(.+?)\s+Lore$")
LORE_TEMPLATE = re.compile(r"^Lore\s*\(.*\)\s*$", re.I)
GLYPHS = re.compile(r"[◆◇↺★⓿❶❷❸❹❺❻]")


def plain(v):
    """A cell's text, rich text flattened, tags out, trimmed."""
    if v is None: return ""
    if hasattr(v, "__iter__") and not isinstance(v, str):      # CellRichText
        v = "".join(str(getattr(p, "text", p)) for p in v)
    return re.sub(r"<[^>]+>", "", str(v)).strip()


def bare_action(s):
    """The converter's action_bare: glyphs and a trailing cost joiner out."""
    s = re.sub(r"\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)", "", s or "")
    s = re.sub(r"\s+(to|or)\s*$", "", GLYPHS.sub("", s))
    return re.sub(r"\s+", " ", s).strip()


def txt(ws, r, c):
    """The plain text of the cell at (row r, column c), 1-based."""
    return plain(ws.cell(r, c).value)


def headers(ws):
    """[(col_index1, lowercased header text)] for row 1."""
    return [(j, txt(ws, 1, j).lower()) for j in range(1, ws.max_column + 1) if txt(ws, 1, j)]


def find_col(hdrs, *, starts=(), contains=(), excludes=()):
    for j, h in hdrs:
        if any(h.startswith(w) for w in starts) or any(w in h for w in contains):
            if not any(w in h for w in excludes): return j
    return None


def first_blank_row(ws, name_col):
    r = 2
    while txt(ws, r, name_col): r += 1
    return r


def set_cell(ws, r, c, value, changes, style_from=None):
    cell = ws.cell(r, c)
    if plain(cell.value): return          # never overwrite a filled cell
    cell.value = value
    if style_from is not None and style_from.has_style:
        cell._style = copy(style_from._style)
    changes.append((cell.coordinate, value))


def nearest(name, candidates):
    m = difflib.get_close_matches(name, list(candidates), n=1, cutoff=0.6)
    return m[0] if m else None


def index_tree_workbook(wb, fname, report):
    idx = wb["_Tree Index"]
    hdrs = headers(idx)
    tree_col = find_col(hdrs, starts=("tree",))
    cat_col = find_col(hdrs, starts=("categ",))
    feeds_col = find_col(hdrs, starts=("feeds", "primary"))
    if not tree_col or not cat_col:
        report.append(f"{fname}: _Tree Index needs Tree and Category columns; skipped"); return []
    category = CATEGORY_BY_WORKBOOK.get(os.path.splitext(fname)[0].lower())
    indexed = {}
    for r in range(2, idx.max_row + 1):
        n = txt(idx, r, tree_col)
        if n: indexed[n] = r
    sheets = [s for s in wb.sheetnames if s not in SKIP_SHEETS]
    lore_sheets = [s for s in sheets if LORE_SHEET.match(s)]
    trees = [s for s in sheets if s not in lore_sheets]
    changes = []
    # Rows for sheets the index does not name.
    for sheet in trees:
        key = "Lore" if LORE_TEMPLATE.match(sheet) else sheet
        if key in indexed: continue
        if not category:
            report.append(f"{fname} / {sheet}: not in _Tree Index and this workbook's Category is unknown; add the row by hand")
            continue
        r = first_blank_row(idx, tree_col)
        above = idx.cell(r - 1, tree_col) if r > 2 else None
        set_cell(idx, r, tree_col, key, changes, above)
        set_cell(idx, r, cat_col, category, changes, idx.cell(r - 1, cat_col) if r > 2 else None)
        indexed[key] = r
        need = f"; needs {txt(idx, 1, feeds_col)}" if feeds_col else ""
        report.append(f"{fname}: row added for '{key}' ({category}{need})")
    # Index rows with no sheet.
    for name, r in indexed.items():
        has = name in wb.sheetnames or (name == "Lore" and any(LORE_TEMPLATE.match(s) for s in wb.sheetnames))
        if has: continue
        if txt(idx, r, cat_col) == "Background" and "Backgrounds" in wb.sheetnames: continue
        hint = nearest(name, trees)
        report.append(f"{fname}: '{name}' (row {r}) is in _Tree Index but has no sheet"
                      + (f"; did you mean '{hint}'?" if hint else "; the row stays until its sheet exists"))
    # Lore sheets whose tree is not indexed.
    for sheet in lore_sheets:
        tree = LORE_SHEET.match(sheet).group(1)
        if tree in indexed: continue
        hint = nearest(tree, indexed)
        report.append(f"{fname} / {sheet}: a Lore sheet for '{tree}', which is no tree of this workbook"
                      + (f"; did you mean '{hint} Lore'?" if hint else ""))
    return changes


def index_actions_workbook(wb, fname, report):
    idx = wb["_Tree Index"]
    hdrs = headers(idx)
    name_col = find_col(hdrs, starts=("name",))
    type_col = find_col(hdrs, contains=("type",), excludes=("categ",))
    cat_col = find_col(hdrs, contains=("categ",))
    if not name_col:
        report.append(f"{fname}: _Tree Index needs a Name column; skipped"); return []
    indexed = {}
    for r in range(2, idx.max_row + 1):
        n = txt(idx, r, name_col)
        if n: indexed[bare_action(n).lower()] = r
    rows = {}      # bare lower name -> (display name, type, category)
    for ws in wb.worksheets:
        if ws.title in ("_Tree Index", "About"): continue
        sh = headers(ws)
        ncol = find_col(sh, starts=("action", "activity", "endeavor"))
        if not ncol: continue
        tcol = find_col(sh, starts=("type",))
        ccol = find_col(sh, starts=("categ",))
        for r in range(2, ws.max_row + 1):
            raw = txt(ws, r, ncol)
            if not raw: continue
            name = bare_action(raw)
            key = name.lower()
            if key in rows: continue       # the converter resolves duplicates; the index lists a name once
            rows[key] = (name, txt(ws, r, tcol) if tcol else "",
                         (txt(ws, r, ccol) if ccol else "") or ws.title)
    changes = []
    for key, (name, atype, cat) in rows.items():
        if key in indexed:
            r = indexed[key]
            if type_col and atype: set_cell(idx, r, type_col, atype, changes)
            if cat_col and cat: set_cell(idx, r, cat_col, cat, changes)
            continue
        r = first_blank_row(idx, name_col)
        above = r - 1 if r > 2 else None
        set_cell(idx, r, name_col, name, changes, idx.cell(above, name_col) if above else None)
        if type_col and atype: set_cell(idx, r, type_col, atype, changes, idx.cell(above, type_col) if above else None)
        if cat_col and cat: set_cell(idx, r, cat_col, cat, changes, idx.cell(above, cat_col) if above else None)
        indexed[key] = r
        report.append(f"{fname}: row added for '{name}' ({atype or 'untyped'}, {cat})")
    for key, r in indexed.items():
        if key not in rows:
            report.append(f"{fname}: '{txt(idx, r, name_col)}' (row {r}) is in _Tree Index but no sheet has a row for it")
    return changes


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="report only; write nothing")
    ap.add_argument("--no-backup", action="store_true", help="write without copying the workbooks to backup/ first")
    args = ap.parse_args()
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"): s.reconfigure(encoding="utf-8", errors="replace")
    backup_dir = os.path.join(BACKUP, f"index-{datetime.date.today().isoformat()}")
    files = [f for f in sorted(glob.glob(os.path.join(DATA, "*.xlsx"))) if not os.path.basename(f).startswith("~$")]
    written = 0
    for path in files:
        fname = os.path.basename(path)
        report = []
        if os.path.exists(os.path.join(DATA, "~$" + fname)):
            print(f"{fname}: open in Excel; skipped (close it and rerun)"); continue
        wb = load_workbook(path, rich_text=True)
        if "_Tree Index" not in wb.sheetnames:
            continue      # equipment, backgrounds, languages: no index by design
        hdrs = headers(wb["_Tree Index"])
        if find_col(hdrs, starts=("tree",)):
            changes = index_tree_workbook(wb, fname, report)
        elif find_col(hdrs, starts=("name",)):
            changes = index_actions_workbook(wb, fname, report)
        else:
            report.append(f"{fname}: _Tree Index headed neither Tree nor Name; skipped"); changes = []
        for line in report: print("  " + line)
        if not changes:
            print(f"{fname}: index up to date")
            continue
        print(f"{fname}: {len(changes)} cell(s) {'would be ' if args.dry_run else ''}written"
              + ("" if len(changes) > 12 else ": " + ", ".join(f"{c}={v!r}" for c, v in changes)))
        if args.dry_run: continue
        if not args.no_backup:
            os.makedirs(backup_dir, exist_ok=True)
            shutil.copy2(path, os.path.join(backup_dir, fname))
        wb.save(path)
        written += 1
    print(f"{'dry run, nothing written' if args.dry_run else f'{written} workbook(s) written'}"
          + ("" if args.dry_run or args.no_backup or not written else f"; originals in {os.path.relpath(backup_dir, ROOT)}"))


if __name__ == "__main__":
    main()
