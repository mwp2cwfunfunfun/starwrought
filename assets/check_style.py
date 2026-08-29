# STARWROUGHT style guard: the two absolute rules in CLAUDE.md, checked mechanically.
#
#   1. No em-dashes in game prose, anywhere, ever.
#      Table null-markers and minus signs are fine, and so are code comments.
#   2. IP hygiene: mechanics may echo pf2e (ORC-licensed), but names and prose must be original.
#      No Golarion proper nouns in anything that ships.
#
#   run:  python assets/check_style.py            exit 0 clean, exit 1 on a violation
#         python assets/check_style.py --quiet    only print violations
#
# Scope is SHIPPING content: the spreadsheets, the injected JSON, the templates, and the two built
# HTML files. Deliberately not scanned: backup/, node_modules/, the sync reports and design notes
# (they discuss retired names on purpose), and assets/phb_v1.1_baseline.md (an archive).
# The handbook itself is scanned too, but only ever as an advisory note: it is Mike's to write.
import io, json, os, re, sys, glob, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
QUIET = "--quiet" in sys.argv
EM = "—"

errors, notes = [], []


def rel(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


# ── rule 1: em-dashes in prose ──────────────────────────────────────────────────────────────────
def em_in_prose(s):
    """True if the em-dash sits inside a sentence rather than standing in for an empty value."""
    if EM not in s:
        return False
    if s.strip() == EM:                                    # a bare null-marker cell
        return False
    t = re.sub(r'["\'`]\s*' + EM + r'\s*["\'`]', "", s)    # a quoted fallback: "—"
    t = re.sub(r">\s*" + EM + r"\s*<", "><", t)            # an empty table cell: <td>—</td>
    return EM in t


# ── rule 2: Golarion proper nouns ───────────────────────────────────────────────────────────────
# Word-boundary matched and case-insensitive. "Coldharrow" is Mike's own name and does not match
# \bharrow\b, which is the point of the boundaries.
GOLARION = [
    "Golarion", "Absalom", "Varisia", "Varisian", "Cheliax", "Chelaxian",
    "Kelesh", "Keleshite", "Kelish", "Taldor", "Taldan", "Ustalav", "Andoran", "Osirion", "Qadira",
    "Katapesh", "Numeria", "Thassilon", "Thassilonian", "Sandpoint", "Magnimar", "Korvosa",
    "Riddleport", "Padishah", "Harrow", "Desna", "Sarenrae", "Iomedae", "Asmodeus", "Nethys",
    "Gorum", "Erastil", "Abadar", "Pharasma", "Shelyn", "Torag", "Urgathoa", "Zon-Kuthon",
    "Lamashtu", "Rovagug", "Calistria", "Irori", "Gozreh", "Diabolic",
]
GOL_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in GOLARION) + r")\b", re.I)

# Publisher and game names are a different thing from setting IP. CLAUDE.md permits mechanics that
# echo pf2e, and an ORC notice has to name it, so these are reported as notes and never fail a run.
TRADEMARKS = ["Pathfinder", "Paizo", "Dungeons & Dragons", "Forgotten Realms", "Wizards of the Coast"]
TM_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in TRADEMARKS) + r")\b", re.I)


def check(where, text, sink=None):
    sink = errors if sink is None else sink
    s = str(text)
    if em_in_prose(s):
        sink.append(("em-dash", where, s.strip()[:150]))
    for m in set(GOL_RE.findall(s)):
        sink.append(("golarion:" + m, where, s.strip()[:150]))
    for m in set(TM_RE.findall(s)):
        notes.append(("trademark:" + m, where, s.strip()[:150]))


def walk_json(path):
    def walk(o, where):
        if isinstance(o, str):
            check("%s %s" % (rel(path), where), o)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, "%s[%d]" % (where, i))
        elif isinstance(o, dict):
            for k, v in o.items():
                walk(v, "%s.%s" % (where, k))
    walk(json.load(io.open(path, encoding="utf-8")), "")


# ── the spreadsheets ────────────────────────────────────────────────────────────────────────────
try:
    import openpyxl
    for p in sorted(glob.glob(os.path.join(ROOT, "data", "*.xlsx"))):
        if os.path.basename(p).startswith("~$"):
            continue
        wb = openpyxl.load_workbook(p, data_only=True)
        for ws in wb.worksheets:
            for row in ws.iter_rows():
                for c in row:
                    if isinstance(c.value, str):
                        check("%s!%s %s" % (rel(p), ws.title, c.coordinate), c.value)
except ImportError:
    notes.append(("skipped", "data/*.xlsx", "openpyxl not installed"))

# ── the injected JSON ───────────────────────────────────────────────────────────────────────────
for name in ("roster.json", "trees.json", "backgrounds.json", "languages.json", "sheet_spec.json"):
    p = os.path.join(HERE, name)
    if os.path.exists(p):
        walk_json(p)

# ── the templates and the built HTML: skip comment lines ────────────────────────────────────────
# A line carrying the marker `style-ok` is exempt. That exists for exactly one honest case: the
# migration rename maps have to name the retired terms in order to rename them away. Every use
# should be greppable and should say why on the same line.
for p in [os.path.join(HERE, "app_template.html"), os.path.join(HERE, "constellation_template.html"),
          os.path.join(ROOT, "Starwrought_App.html"),
          os.path.join(ROOT, "Starwrought_Talent_Constellations.html")]:
    if not os.path.exists(p):
        continue
    for i, line in enumerate(io.open(p, encoding="utf-8").read().splitlines(), 1):
        if line.strip().startswith(("//", "*", "#")) or "style-ok" in line:
            continue
        check("%s line %d" % (rel(p), i), re.sub(r"//.*$", "", line))

# ── the Foundry system: its language file, its templates, and its compendium sources ────────────
# The system ships game prose too, so it is held to the same two rules. Only the parts a player
# reads are scanned: module/*.mjs is code, and its comments are exempt like any other comment.
FOUNDRY = os.path.join(ROOT, "foundry", "starwrought")
if os.path.isdir(FOUNDRY):
    lang = os.path.join(FOUNDRY, "lang", "en.json")
    if os.path.exists(lang):
        walk_json(lang)
    for p in sorted(glob.glob(os.path.join(FOUNDRY, "templates", "**", "*.hbs"), recursive=True)):
        for i, line in enumerate(io.open(p, encoding="utf-8").read().splitlines(), 1):
            if line.strip().startswith(("//", "*", "#", "{{!")) or "style-ok" in line:
                continue
            check("%s line %d" % (rel(p), i), line)
    for p in sorted(glob.glob(os.path.join(FOUNDRY, "packs", "_source", "**", "*.json"), recursive=True)):
        walk_json(p)

# ── the handbook, advisory only ─────────────────────────────────────────────────────────────────
books = sorted(glob.glob(os.path.join(ROOT, "Starwrought_Players_Handbook_v*.docx")))
if books:
    book = books[-1]
    try:
        xml = zipfile.ZipFile(book).read("word/document.xml").decode("utf-8", "replace")
        text = re.sub(r"<[^>]+>", " ", xml)
        for m in sorted(set(GOL_RE.findall(text))):
            notes.append(("golarion:" + m, rel(book), "still present in the handbook"))
        for m in sorted(set(TM_RE.findall(text))):
            notes.append(("trademark:" + m, rel(book), "named in the handbook; fine if comparative, check the ORC notice"))
    except Exception as e:
        notes.append(("unreadable", rel(book), str(e)))

# ── report ──────────────────────────────────────────────────────────────────────────────────────
if notes and not QUIET:
    print("NOTES (advisory, not failures):")
    for kind, where, txt in notes:
        print("  %-18s %s\n      %s" % (kind, where, txt))
    print()

if errors:
    print("STYLE VIOLATIONS: %d" % len(errors))
    for kind, where, txt in errors:
        print("  %-18s %s\n      %s" % (kind, where, txt))
    print("\nCLAUDE.md: no em-dashes in game prose, ever (null markers and minus signs are fine).")
    print("CLAUDE.md: names and prose must be original. No Golarion proper nouns in anything shipping.")
    sys.exit(1)

if not QUIET:
    print("style clean: no em-dashes in game prose, no Golarion proper nouns in shipping content")
