# STARWROUGHT data pipeline: data/*.xlsx -> assets/trees.json
# Header-driven: column ORDER doesn't matter; column NAMES do (first word wins).
# Recognized tree-sheet columns: Talent | Tier | Root | Requires | Prerequisites | Description | Effect |
#                                Attribute (or Feeds) | Enabled? | Automation |
#                                Choice | Free Talent (retired 0.16.0; [CHOICE ...] and [TALENT ...] in Automation; read one release, warned) |
#                                Aura (optional since 0.13.0; "aura:" in Automation is the authoring) |
#                                Grants (retired 0.13.0; "grant:" in Automation; read one release, warned)
# Recognized index columns:      Tree | Category | Primary Attribute (or Feeds) | Flare (triggers) | Meta | Parent
#   RETIRED (0.16.0), read one release with one warning per workbook: Skills | Traits | Languages |
#   Vigor (or HP) | Size | Speed | Senses | Summary. The Root Talent's feature lines in Automation
#   ([VIGOR 8], [SIZE Medium], [SPEED 6], [SENSES ...], [TRAIT Human], [LANGUAGE ...], [VIGOR opening 12],
#   [<Skill> trained]) are the authoring; assets/parse_rules.mjs reads them onto the roster's records
#   after this converter has written the columns' values, and fails when the two disagree.
#   Ancestry rows generate the "ancestries" block of roster.json, so the sheet owns the chassis
#   (the blurb is the Lore sheet's Summary row).
#   Every Culture tree generates a record of the "cultures" block of roster.json (0.15.0), so the
#   sheet owns that chassis too.
#   The Automation cell itself is copied through as TEXT on every talent, action and Background:
#   Python holds no parser of the grammar (ruling 120); assets/parse_rules.mjs parses it once.
#   A "<Tree> Lore" sheet (label | text rows) is the tree's player-facing text: lore on the tree
#   and on its ancestry or culture record (0.13.0). An unknown header is warned about by name.
# A talent sheet with no Requires column (or an empty one) reads Prerequisites as the requirement:
#   the pieces naming a Talent of the same sheet become `requires`, the rest stays prose (0.13.0).
# Rich text in Description/Effect cells (b/i/u/strike/color) becomes HTML and mirrors everywhere.
# Enabled? (Mike, 2026-10-01, ruling 60): "Yes" ships the row to Foundry; see enabled_flag below.
# The converter keeps every row and only flags it; build_foundry.mjs does the filtering.
#
# An ACTIONS workbook (the format Mike's, 2026-09-26, as data/actions.xlsx; data/maneuvers.xlsx the
# one such workbook since 2026-10-03) is recognised by its _Tree Index carrying Name | Type | Meta
# note instead of Tree | Category. Its other sheets hold one action per row and write
# assets/actions.json; see parse_actions_workbook below for the columns. Any number of them are
# read (maneuvers.xlsx joined actions.xlsx in 0.5.1, T17: the Encounter Mode Maneuvers, scaffolded
# once by make_maneuvers_xlsx.py and Mike's since; on 2026-10-03 he moved Aid, actions.xlsx's one
# row, into it and deleted actions.xlsx); the same action in two of them is an error, an About
# sheet is skipped, and a workbook the last actions.json names that is missing from data/ has its
# actions carried over as found, so a checkout without that workbook still retires every roster
# row the absent workbook retired (the rule that kept Aid retired on a fresh clone while it lived
# in the untracked actions.xlsx; with one workbook in data/ there is nothing to carry today).
#
# An EQUIPMENT workbook (data/equipment.xlsx, Mike, 2026-10-01, ruling 64) has no _Tree Index and
# is recognised by its Weapons, Armor and Shields sheets, one piece per row. It writes
# assets/equipment.json and regenerates the roster's weaponsMelee, weaponsRanged, armorPieces and
# shields blocks from every row, the way the ancestries block is regenerated; see
# parse_equipment_workbook below for the columns.
import json, os, re, sys, glob
from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(HERE, "trees.json")
BGOUT = os.path.join(HERE, "backgrounds.json")
ROSTER = os.path.join(HERE, "roster.json")
AOUT = os.path.join(HERE, "actions.json")
EOUT = os.path.join(HERE, "equipment.json")

def parse_bg_sheet(bws, bgs, warnings, fname):
    # Automation (0.16.0): the same column as on a tree sheet, copied through as text and parsed
    # by assets/parse_rules.mjs (Python holds no parser, ruling 120); a Background's Training is
    # its `[<Skill> trained]` lines, which build_foundry.mjs reads from the rules. The retired
    # Skills, Rarity and Lore columns still read where a sheet has them.
    bm = header_map(bws, {"name": "background", "rarity": "rarity", "desc": "desc", "effect": "effect", "skills": "skills", "lore": "lore",
                          "enabled": "enabled", "automation": "automation"},
                    unknown=warnings, where=f"{fname} / Backgrounds")
    if "name" not in bm or "effect" not in bm:
        warnings.append(f"{fname}: Backgrounds sheet needs Background and Effect columns"); return
    for r in bws.iter_rows(min_row=2):
        gv = lambda k: (r[bm[k]] if k in bm and len(r) > bm[k] else None)
        bname = plain(gv("name"))
        if not bname: continue
        eff = cell_html(gv("effect"))
        skills = [x.strip() for x in re.split(r",|•", plain(gv("skills"))) if x.strip()]
        entry = {"name": bname, "rarity": plain(gv("rarity")) or "Common",
                 "enabled": enabled_flag(gv("enabled"), "enabled" in bm),
                 "desc": cell_html(gv("desc")), "effect": eff}
        if skills: entry["skills"] = skills
        lore = plain(gv("lore"))
        if lore: entry["lore"] = lore
        auto = blank_none(plain(gv("automation")))
        if auto: entry["automation"] = auto
        if not skills:  # legacy fallback: parse grants from effect text
            entry["grants"] = parse_grants(re.sub(r"<[^>]+>", "", eff))
        bgs.append(entry)

def parse_lang_sheet(lws, langs, warnings, fname):
    lm = header_map(lws, {"name": "language", "rarity": "rarity", "desc": "desc"})
    if "name" not in lm:
        warnings.append(f"{fname}: Languages sheet needs a Language column"); return
    for r in lws.iter_rows(min_row=2):
        gv = lambda k: (r[lm[k]] if k in lm and len(r) > lm[k] else None)
        lname = plain(gv("name"))
        if not lname: continue
        langs.append({"name": lname, "rarity": plain(gv("rarity")) or "Common", "desc": cell_html(gv("desc"))})

def parse_grants(plain_effect):
    """'trained in either A or B, and you gain 1 Talent Point...' -> [{options:[A,B], extra:1}, ...]"""
    groups = []
    for sent in re.split(r"[.;]", plain_effect):
        pending = None
        for cl in re.split(r",? and you ", sent):
            m = re.search(r"[Tt]rained in (?:either )?(.+)", cl)
            if m:
                clean = []
                for o in re.split(r", or |, | or ", m.group(1)):
                    o = re.sub(r"^(the|a|an) ", "", o.strip()).strip()
                    if not o: continue
                    lm = re.match(r"(.+?) Lore$", o)
                    clean.append(f"Lore ({lm.group(1)})" if lm else o)
                if clean:
                    pending = {"options": clean, "extra": 0}
                    groups.append(pending)
            else:
                em = re.search(r"gain (\d+) [Tt]alent [Pp]oint", cl)
                if em and pending: pending["extra"] += int(em.group(1))
    return groups

# "Save" and "Heritage" are the retired v1.8 spellings of Defense and Bloodline. They stay in the
# tuple so older sheets still convert, and are normalised to the current word on the way in.
# "Magic" (PHB v4.21) is both the five disciplines (Elementalism, Forceweaving, Vitalism, Mindweaving,
# Spiritcraft) and their specialties, which name their discipline in the Parent column as the Combat
# Styles name Melee or Ranged.
CATEGORIES = ("Skill", "Defense", "Save", "Weapon", "Combat Style", "Armor", "Calling",
              "Ancestry", "Culture", "Bloodline", "Heritage", "Background", "Magic")
CATALIAS = {"Save": "Defense", "Heritage": "Bloodline"}
IDENTITY = ("Ancestry", "Culture", "Bloodline", "Heritage", "Background")  # roots granted by the chargen choice itself
FALLBACK_NEEDED = ("Skill", "Defense", "Weapon", "Combat Style", "Armor", "Magic")  # tree-level feed required (untrained fallback)
ATTRS = ("Might", "Agility", "Wits", "Presence")

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def run_to_html(text, font):
    h = esc(text)
    if font is not None:
        color = getattr(font, "color", None)
        if color is not None and getattr(color, "rgb", None) and isinstance(color.rgb, str) and len(color.rgb) == 8 and color.rgb != "FF000000":
            h = f'<span style="color:#{color.rgb[2:]}">{h}</span>'
        if getattr(font, "strike", None): h = f"<s>{h}</s>"
        if getattr(font, "u", None): h = f"<u>{h}</u>"
        if getattr(font, "i", None): h = f"<i>{h}</i>"
        if getattr(font, "b", None): h = f"<b>{h}</b>"
    return h

def cell_html(cell):
    if cell is None: return ""
    v = cell.value
    if v is None: return ""
    try:
        from openpyxl.cell.rich_text import CellRichText, TextBlock
        if isinstance(v, CellRichText):
            parts = []
            for block in v:
                parts.append(run_to_html(str(block.text), block.font) if isinstance(block, TextBlock) else esc(str(block)))
            return "".join(parts).strip().replace("\n", "<br>")
    except ImportError:
        pass
    h = esc(str(v).strip())
    f = cell.font
    if f is not None:
        if f.strike: h = f"<s>{h}</s>"
        if f.u: h = f"<u>{h}</u>"
        if f.i: h = f"<i>{h}</i>"
        if f.b: h = f"<b>{h}</b>"
    return h.replace("\n", "<br>")

def plain(cell):
    if cell is None: return ""
    v = cell.value
    if v is None: return ""
    return re.sub(r"<[^>]+>", "", str(v)).strip()

def header_map(ws, wanted, unknown=None, where=""):
    """wanted: {key: first-word-of-header (lowercase), or a tuple of such words} -> {key: col_index0}
    using row 1. With `unknown` (a list) every non-empty header that matches no word is appended
    to it as "<where>: unknown column '<header>' (ignored)", so a renamed column is said rather
    than silently dropped (0.13.0: 'Feeds' to 'Primary Attribute' went unnoticed for a build)."""
    m = {}
    for j in range(1, ws.max_column + 1):
        full = plain(ws.cell(1, j))
        h = full.lower()
        hit = False
        for key, words in wanted.items():
            if any(h.startswith(w) for w in ((words,) if isinstance(words, str) else words)):
                hit = True
                if key not in m: m[key] = j - 1
        if full and not hit and unknown is not None:
            unknown.append(f"{where}: unknown column '{full}' (ignored)")
    return m

def header_word(ws, key_col, *words):
    """Which of `words` the header of column key_col (0-based) starts with, lower-cased; None if
    none. How a sheet headed 'Attribute' (strict) is told from one still headed 'Feeds'."""
    h = plain(ws.cell(1, key_col + 1)).lower()
    return next((w for w in words if h.startswith(w)), None)

# ---- The Enabled? column (Mike, 2026-10-01; ruling 60) ---------------------------------------
# Recognised by its first word like every other header. A cell reading "Yes" (any case, trimmed)
# enables the row; anything else (blank, "No", "TBD") disables it. A sheet WITHOUT the column is
# wholly enabled: its absence means the sheet has not been curated yet, not that it is all off
# (Lore and Languages today). The converter DROPS NOTHING: every talent, background and action
# is written with `enabled`, and a tree carries its Root's flag, because a constellation exists in
# play when its Root does. Foundry is the play surface and ships only the enabled rows (ruling 61);
# the web app, the compendium docx and the plates are the authoring views of the whole book.
def enabled_flag(cell, has_column):
    return plain(cell).lower() == "yes" if has_column else True

# ---- The Aura column (system 0.5.1) -----------------------------------------------------------
# "Within N feet" of the carrier, drawn on the map by the Foundry system as a ring the carrier can
# show or hide. Recognised by its first word like every other header, on the talent sheets and the
# action sheets alike. Accepted values, case blind and whitespace tolerant:
#   "15 ft" or "15 feet"      fifteen feet around the carrier, concerning everyone
#   "15 ft allies"            concerning allies only; "15 ft enemies" likewise
#   "15 ft allies visible"    Visible by default: Pinned for every combatant once an encounter
#                             starts (Mike's rule); without the word it shows only as a preview
#   "none"                    the Effect says "within N feet" but the circle is centred somewhere
#                             else (Rebounding Toss rebounds from the target), so stay quiet
#   blank                     no aura
# Anything else is an error. The row carries {"range": 15, "affects": "allies", "visible": true}
# only when the cell is set. "Within reach" and "adjacent" get no cell: the reach bands draw those.
# The converter warns when a tag-stripped Effect says "within N feet" and the cell is blank or
# names a different N, so a new tier surfaces on its sync instead of shipping without its ring.
AURA_VALUE = re.compile(r"^(\d+)\s*(?:ft\.?|feet|foot)(?:\s+(all|allies|enemies))?(?:\s+(visible))?$", re.I)
AURA_IN_EFFECT = re.compile(r"\bwithin\s+(\d+)\s*(?:feet|ft)\b", re.I)

def parse_aura(text):
    """None for a blank cell, "none" for an explicit none, False for a value that does not parse,
    else the aura dict. "all" is accepted as the spelled-out form of the default audience."""
    s = re.sub(r"\s+", " ", text or "").strip().lower()
    if not s: return None
    if s == "none": return "none"
    m = AURA_VALUE.match(s)
    if not m: return False
    return {"range": int(m.group(1)), "affects": m.group(2) or "all", "visible": bool(m.group(3))}

# Since 0.13.0 the Aura column is OPTIONAL: an aura block in the Automation cell is the authoring
# ("[AURA 15 allies]" since 0.16.0, AUTOMATION_GRAMMAR.md), parsed by parse_rules.mjs like every
# rule, and the column survives for the sheets that still carry it. A row with both is an ERROR, so
# a ring is never said twice. The converter does not parse the line (Python holds no second
# grammar); it only looks for the kind word at the start of a line, which is all the drift check
# needs. The same goes for "grant:" and the retired Grants column, below.
def automation_has(auto, kind):
    """True when a line of the Automation cell starts with `<kind>:` or is the bare word, or (0.16.0)
    a feature line carries a `[<KIND> ...]` block ("[AURA 15 allies visible]"). A keyword scan, not
    a parse: the drift check needs to know the ring is authored, not what it says."""
    return any(re.match(rf"^\s*{kind}\s*(:|$)", ln, re.I) or re.search(rf"\[\s*{kind}\b", ln, re.I)
               for ln in (auto or "").splitlines())

def aura_for(cell, has_column, effect, where, warnings, errors, in_automation=False):
    """A row's Aura cell, read against its Effect. Returns the aura to store or None, appending the
    error for a value that does not parse and the drift warnings described above. `in_automation`
    says the Automation cell carries an "aura:" line, which then owns the ring."""
    aura = parse_aura(plain(cell)) if has_column else None
    said = AURA_IN_EFFECT.search(re.sub(r"<[^>]+>", " ", effect or ""))
    if aura is False:
        errors.append(f"{where}: Aura '{plain(cell)}' not understood ('15 ft', '15 feet', '15 ft allies', "
                      f"'15 ft enemies', or 'none'; every ring is preview-only until shown, 0.17.0)")
        return None
    if in_automation:
        if aura is not None:
            errors.append(f"{where}: the Aura cell and an [AURA ...] block in Automation both set the ring; "
                          f"keep the Automation block and clear the cell (AUTOMATION_GRAMMAR.md)")
        return None
    if aura == "none": return None
    if said and aura is None:
        warnings.append(f"{where}: Effect says 'within {said.group(1)} feet' but no ring is set: write "
                        f"'[AURA {said.group(1)} all]' (or allies, enemies) in Automation"
                        + (", or fill the Aura cell" if has_column else "")
                        + ", or 'none' in the Aura cell if the circle is centred somewhere other than the carrier")
    elif said and aura and int(said.group(1)) != aura["range"]:
        warnings.append(f"{where}: Effect says 'within {said.group(1)} feet' but the Aura cell says {aura['range']} ft")
    return aura or None

# ---- The Lore sheets (0.13.0) -----------------------------------------------------------------
# "<Tree> Lore" beside a tree's own sheet holds the player-facing text of an Ancestry (or any tree)
# as label | text rows, no header row ("Summary", "About", "You Might...", "Names" and so on, in the
# author's order). Through 0.12.0 the converter ignored them by design (they were authoring notes);
# since Mike rewrote the Human Lore sheet for the character-creation wizard and the compendium
# window they are read: lore: [{label, text}] on the tree and on the ancestry's chassis record,
# rich text carried as the Effect column's is. A first row headed "Label"/"Field" is skipped.
LORE_SHEET = re.compile(r"^(.+?)\s+Lore$")

def parse_lore_sheet(ws):
    out = []
    for r in ws.iter_rows(min_row=1, max_col=2):
        label = plain(r[0]) if len(r) > 0 else ""
        text = cell_html(r[1]) if len(r) > 1 else ""
        if not label and not text: continue
        if not out and label.lower() in ("label", "field", "heading") and plain(r[1]).lower() in ("text", "value", "body"):
            continue
        out.append({"label": label, "text": text})
    return out

# ---- The Cultures' languages (0.15.0) ----------------------------------------------------------
# The roster's cultures block is generated from cultures.xlsx as the ancestries block is from
# ancestries.xlsx. Its languages come from an optional Languages column on the _Tree Index, comma
# or " • " separated, written as ", "-joined text. While the workbook has no such column, the
# previous roster row of the same name lends its languages: the hand-kept block of 0.14.0 and
# before was positional ([name, "Serrovine • Common", attribute, blurb]), the generated one is an
# object with `languages`. Both read, so the first run after the change loses nothing.
def normalise_languages(text):
    return ", ".join(t for t in (blank_none(x) for x in re.split(r",|•", text or "")) if t)

def prior_languages(roster, name):
    for row in roster.get("cultures", []) or []:
        if isinstance(row, dict):
            if row.get("name") == name or row.get("tree") == name:
                return normalise_languages(row.get("languages", ""))
        elif isinstance(row, (list, tuple)) and len(row) > 1 and row[0] == name:
            return normalise_languages(row[1])
    return ""

# Requires-matching strips the cost glyphs off a name: the v4.10 ⓿❶❷❸❹❺❻ and ↺ (with a bracketed
# Reaction cost such as "Aid ❶ (⓿↺)"), the v3 ◆ and ◇, and the capstone star.
GLYPH_CLASS = "◆◇↺★⓿❶❷❸❹❺❻"
def norm(s):
    s = re.sub(r"\(\s*[" + GLYPH_CLASS + r"\s]*\)", "", s or "")
    return re.sub(r"(?:[" + GLYPH_CLASS + r"]|\s+(?:to|or)\s*(?=[" + GLYPH_CLASS + r"])|\s)+$", "", s).strip()

# ---- Actions ---------------------------------------------------------------------------------
# Recognised action-sheet columns (first word wins, order free):
#   Action | Cost | Traits | Type | Prerequisites | Requirements | Trigger | Description | Effect |
#   Automation | Aura
# Cost accepts the handbook's glyphs or words: "◆", "◆◆", "◆ to ◆◆◆", "◆ or ◆◆◆", "↺", "◇",
# "1", "1 to 3", "reaction", "free". With no Cost column the glyphs in the Action name are read,
# the way talent names are; with neither, the action costs one action and the converter says so.
# A cell reading "None" is blank: the sheet's own way of saying an action has no prerequisite.
COST_WORDS = {"reaction": "reaction", "free": "0", "passive": "passive", "0": "0",
              "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
              "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6"}
ACTION_GLYPHS = re.compile(r"[◆◇↺★⓿❶❷❸❹❺❻]")

def action_bare(s):
    """Glyphs out (a bracketed Reaction cost such as "(⓿↺)" with them), the trailing cost joiner
    (to/or) out, any run of whitespace to one space. The same normalisation build_foundry.mjs
    applies (actionName), so the two agree on every name."""
    s = re.sub(r"\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)", "", s or "")
    s = re.sub(r"\s+(to|or)\s*$", "", ACTION_GLYPHS.sub("", s))
    return re.sub(r"\s+", " ", s).strip()

action_key = lambda s: action_bare(s).lower()

def blank_none(s):
    """'None', a dash, or nothing at all is an empty cell. Anything else is kept as written."""
    s = (s or "").strip()
    # "---" is how PHB v4.21's armor table prints a piece with no Traits.
    return "" if s.lower() in ("", "none", "n/a", "-", "—", "---") else s

COST_TOKEN = re.compile(r"[⓿❶❷❸❹❺❻]|◆+|◇")
def _token_value(tok):
    if tok in ("⓿", "◇"): return 0
    if tok[0] == "◆": return min(6, len(tok))
    return "❶❷❸❹❺❻".index(tok) + 1

def parse_cost(text):
    """'❶ to ❸', '❶ or ❸', '⓿↺', '❶ (⓿↺)', '1 or 3', 'reaction' -> {cost, costMax, costMode,
    reaction, reactionCost}; None when it does not parse. Costs are 0..6 as strings, "passive" for
    a Talent with no cost at all; ↺ is the Reaction trait riding beside a cost (a bare ↺, the v3
    form, is a free Reaction). The v3 ◆ (one action per diamond) and ◇ (free) still read."""
    t = (text or "").strip()
    if not t: return None
    reaction = "↺" in t
    reaction_cost = ""
    m = re.search(r"\(([^)]*)\)", t)
    if m and COST_TOKEN.search(m.group(1)):
        inner = COST_TOKEN.findall(m.group(1))
        if inner: reaction_cost = str(_token_value(inner[0]))
        t = t.replace(m.group(0), " ")
    tokens = COST_TOKEN.findall(t)
    if tokens:
        lo, hi = str(_token_value(tokens[0])), str(_token_value(tokens[-1]))
        # Only an "or" between two glyphs is a cost joiner; one in the name ("Hold or Release
        # ❶ to ❸") is not.
        mode = "or" if re.search(r"(?:[⓿❶❷❸❹❺❻◇]|◆+)\s*or\s*(?:[⓿❶❷❸❹❺❻◇]|◆+)", t, re.I) else "to"
        return {"cost": lo, "costMax": hi if (len(tokens) > 1 and hi != lo) else "", "costMode": mode,
                "reaction": reaction, "reactionCost": reaction_cost}
    words = re.sub(r"\s*\bactions?\b", "", t.lower()).replace("↺", "").strip()
    if not words and reaction:
        return {"cost": "0", "costMax": "", "costMode": "to", "reaction": True, "reactionCost": ""}
    parts = re.split(r"\s+(to|or)\s+", words)
    if len(parts) == 1:
        c = COST_WORDS.get(parts[0])
        if c == "reaction": return {"cost": "0", "costMax": "", "costMode": "to", "reaction": True, "reactionCost": ""}
        return {"cost": c, "costMax": "", "costMode": "to", "reaction": reaction, "reactionCost": ""} if c else None
    if len(parts) == 3:
        lo, join, hi = COST_WORDS.get(parts[0]), parts[1], COST_WORDS.get(parts[2])
        if lo is None or hi is None or "reaction" in (lo, hi): return None
        return {"cost": lo, "costMax": hi if hi != lo else "", "costMode": join, "reaction": reaction, "reactionCost": ""}
    return None

def parse_actions_workbook(wb, fname, actions, warnings, errors, defined):
    """One action per row, typed by the row's own Type cell, else its _Tree Index row
    (Name | Type | Meta note), else the sheet the row sits on. Appends to `actions`; errors block
    the write like any other. `defined` is shared across workbooks (bare lower-case name -> file),
    so the same action in two files is an error, as the same tree in two files is."""
    idx = wb["_Tree Index"]
    im = header_map(idx, {"name": "name", "type": "type", "meta": "meta"})
    typed = {}
    for row in idx.iter_rows(min_row=2):
        g = lambda k: blank_none(plain(row[im[k]])) if k in im and len(row) > im[k] else ""
        if g("name"): typed[action_key(g("name"))] = {"type": g("type"), "meta": g("meta")}
    seen, no_cost = {}, []
    for ws in wb.worksheets:
        # An About sheet is notes for the author, as in the equipment workbook, not a sheet of actions.
        if ws.title in ("_Tree Index", "About"): continue
        cm = header_map(ws, {"name": "action", "cost": "cost", "traits": "trait", "type": "type",
                             "prereq": "prereq", "req": "requirement", "trigger": "trigger",
                             "desc": "desc", "effect": "effect", "automation": "automation",
                             "aura": "aura", "enabled": "enabled"})
        if "name" not in cm:
            warnings.append(f"{fname} / {ws.title}: no Action column, sheet ignored"); continue
        if "effect" not in cm:
            errors.append(f"{fname} / {ws.title}: an action sheet needs Action and Effect columns"); continue
        if "cost" not in cm: no_cost.append(ws.title)
        for r in ws.iter_rows(min_row=2):
            cellv = lambda k: (r[cm[k]] if k in cm and len(r) > cm[k] else None)
            # Every plain read blanks "None", so the rule holds in every column, not just four.
            pv = lambda k: blank_none(plain(cellv(k)))
            raw = plain(cellv("name"))
            if not raw: continue
            # Glyphs may ride in the name, as they do in talent names; the name itself is bare.
            name = action_bare(raw)
            key = name.lower()
            if key in seen:
                errors.append(f"{fname} / {ws.title} / {name}: also defined on sheet '{seen[key]}'"); continue
            if key in defined:
                errors.append(f"{fname} / {ws.title} / {name}: also defined in {defined[key]}"); continue
            seen[key] = ws.title; defined[key] = fname
            cost_text = pv("cost") if "cost" in cm else ""
            if cost_text:
                cost = parse_cost(cost_text)
                if cost is None:
                    errors.append(f"{fname} / {ws.title} / {name}: Cost '{cost_text}' not understood "
                                  f"(❶, ❷, ❸, ⓿, ↺, '❶ to ❸', '1 or 3', reaction, free; the v3 ◆ and ◇ also read)"); continue
            else:
                cost = parse_cost(raw) if ACTION_GLYPHS.search(raw) else None
            defaulted = cost is None
            if defaulted: cost = {"cost": "1", "costMax": "", "costMode": "to", "reaction": False, "reactionCost": ""}
            # The rich-text cells are read through their plain text first, so an Effect of "None"
            # is an empty Effect and a Description of "None" ships blank.
            effect = cell_html(cellv("effect")) if pv("effect") else ""
            if not effect:
                errors.append(f"{fname} / {ws.title} / {name}: empty Effect"); continue
            meta = typed.get(key)
            atype = pv("type") or (meta or {}).get("type") or ws.title
            if meta is None:
                warnings.append(f"{fname} / {ws.title} / {name}: not in _Tree Index, typed by "
                                f"{'its Type cell' if pv('type') else 'its sheet name'}")
            traits = [t for t in (blank_none(x) for x in re.split(r",(?![^(]*\))", pv("traits"))) if t]
            # `workbook` says which file wrote the row, so a later run can tell whose actions are
            # missing when that file is (carry_over_absent below), and so the Foundry build can
            # label the Item's source. `sheet` keeps the group the row sits in.
            actions.append({"name": name, "type": atype, **cost,
                            "enabled": enabled_flag(cellv("enabled"), "enabled" in cm),
                            "traits": traits,
                            "prerequisites": pv("prereq"), "requirements": pv("req"),
                            "trigger": pv("trigger"), "description": cell_html(cellv("desc")) if pv("desc") else "",
                            "effect": effect, "automation": pv("automation"),
                            "meta": (meta or {}).get("meta", ""), "costDefaulted": defaulted,
                            "sheet": ws.title, "workbook": fname})
            # The aura (0.5.1), carried only when the cell is set, as on the talent sheets.
            aura = aura_for(cellv("aura"), "aura" in cm, effect, f"{fname} / {ws.title} / {name}", warnings, errors,
                            in_automation=automation_has(pv("automation"), "aura"))
            if aura: actions[-1]["aura"] = aura
    for k in typed:
        if k not in seen: warnings.append(f"{fname}: '{k}' is in _Tree Index but has no row on any sheet")
    if no_cost:
        warnings.append(f"{fname}: no Cost column on {', '.join(no_cost)}; an action with no glyph in its "
                        f"name costs one action ❶ until the column exists")

def carry_over_absent(actions, action_files, present, defined, warnings):
    """The actions of a workbook the last actions.json names that is not in data/ this run, carried
    over as found. Through 2026-10-03 data/actions.xlsx was Mike's untracked working file, so a
    fresh clone had maneuvers.xlsx and not it; regenerating from the workbooks present alone would
    have dropped Aid and let the roster's Aid ship again, which no edit asked for. Mike then moved
    Aid into maneuvers.xlsx and deleted actions.xlsx (this function reported the move), so nothing
    is absent today and nothing is carried; the rule stays for the next workbook that goes missing.
    This is the per-workbook form of the "left as found" rule the whole file follows when no
    actions workbook is present at all. A name a present workbook now defines is that workbook's:
    the carried copy is dropped, and the run says the two will collide when the absent workbook
    returns. Returns the carried actions."""
    if not os.path.exists(AOUT): return []
    try:
        old = json.load(open(AOUT, encoding="utf-8"))
    except (OSError, ValueError) as e:
        warnings.append(f"{AOUT} could not be read ({e}); nothing carried over from it"); return []
    sources = old.get("source", [])
    # A file written before actions carried `workbook` can still attribute them when it had one source.
    sole = sources[0] if len(sources) == 1 else None
    carried, dropped, unattributed = [], [], 0
    for a in old.get("actions", []):
        src = a.get("workbook") or sole
        if not src:
            unattributed += 1; continue
        if src in action_files or src in present: continue
        if a["name"].lower() in defined:
            dropped.append((a["name"], src, defined[a["name"].lower()])); continue
        a["workbook"] = src
        carried.append(a)
    if unattributed:
        warnings.append(f"{os.path.basename(AOUT)} names {len(sources)} sources but {unattributed} of its actions do not say "
                        f"which wrote them; they are not carried over")
    for name, src, now in dropped:
        warnings.append(f"'{name}' was {src}'s and is now defined in {now}, which wins; when {src} is back in data/ "
                        f"the two will collide and the run will stop")
    for src in sorted({a["workbook"] for a in carried}):
        names = [a["name"] for a in carried if a["workbook"] == src]
        warnings.append(f"{src} is not in data/; the {len(names)} action(s) it last wrote to {os.path.basename(AOUT)} are "
                        f"carried over as found ({', '.join(names)}) and regenerate only when it is back"
                        ". An untracked or a deleted workbook is the usual cause; if it is gone for good, author "
                        "its actions in a present workbook, as Aid moved into maneuvers.xlsx on 2026-10-03")
    return carried

# ---- Equipment (Mike, 2026-10-01; ruling 64) -------------------------------------------------
# data/equipment.xlsx is authoritative for weapons, armor and shields. It has no _Tree Index, so it
# is recognised the way the backgrounds and languages workbooks are, by its sheet names; any other
# sheet in it (About) is ignored. Columns (first word wins, order free):
#   Weapons: Weapon | Kind | Handling | Group | Damage | Reach | Range | Traits | Price | Notes | Enabled?
#   Armor:   Piece | Zone | Protection | Load | Price | Traits | Material | Enabled?
#   Shields: Shield | Bonus | Hardness | Load | Price | Note | Enabled?
# Reach is the melee column ("Adjacent" or "N ft") and Range the ranged one ("N ft"): a Melee row
# needs the first and a Ranged row the second, and a thrown melee weapon's range is a trait
# ("Thrown 10 ft"), as the book prints it. Material is one of the five the roster's materials table
# names; blank, it is the first Trait, which is how the book prints a piece ("Padded, Comfort" is
# Padded). Every row is written with its Enabled? flag (ruling 60) and every row goes into the
# roster blocks, because the web app and the compendium docx are the authoring views (ruling 61);
# build_foundry.mjs does the filtering from equipment.json.
EQUIPMENT_SHEETS = ("Weapons", "Armor", "Shields")
KINDS = ("Melee", "Ranged")
HANDLING = ("Intuitive", "Practiced", "Technical")
ZONES = ("Head", "Torso", "Arms", "Legs")
# The armor Types of PHB v4.21's table (Scale left the book there; it still reads, for an old sheet).
MATERIALS = ("Padded", "Leather", "Mail", "Lamellar", "Brigandine", "Splint", "Plate", "Scale")
DAMAGE = re.compile(r"\d+d\d+ [BPS]")      # "1d8 S": dice, a space, B, P or S
DISTANCE = re.compile(r"\d+ ft")           # the grid is 1 foot (v0.40), so a distance is feet

def whole(cell):
    """A whole number (0 or more) from a cell Excel may hold as an int, a float or text; None
    otherwise. Protection, Load, Bonus and Hardness are all read through this."""
    v = None if cell is None else cell.value
    if isinstance(v, bool): return None
    if isinstance(v, int): return v if v >= 0 else None
    if isinstance(v, float): return int(v) if v.is_integer() and v >= 0 else None
    s = blank_none(plain(cell))
    return int(s) if re.fullmatch(r"\d+", s) else None

def split_traits(text):
    """'Agile, Close, Thrown 10 ft' -> ['Agile', 'Close', 'Thrown 10 ft']. A comma inside brackets
    does not split, as in the actions parser; a blank cell, or 'None', is no traits at all."""
    return [t for t in (blank_none(x) for x in re.split(r",(?![^(]*\))", text or "")) if t]

# The sheets, the columns each is read by, and the columns a sheet cannot do without. The rest
# (Reach, Range, Traits, Price, Notes, Material, Enabled?) are optional at the header level; a row
# that needs one of them says so.
EQUIPMENT_COLUMNS = {
    "weapons": ({"name": "weapon", "kind": "kind", "handling": "handling", "group": "group", "damage": "damage",
                 "reach": "reach", "range": "range", "traits": "trait", "price": "price", "notes": "note",
                 "enabled": "enabled"},
                ("name", "kind", "handling", "group", "damage"), "Weapon, Kind, Handling, Group and Damage"),
    # The v4.21 Armor sheet says Type where the older one said Material, and adds a Description.
    "armor":   ({"name": "piece", "zone": "zone", "protection": "protection", "load": "load", "price": "price",
                 "traits": "trait", "material": "material", "type": "type", "description": "desc", "enabled": "enabled"},
                ("name", "zone", "protection", "load"), "Piece, Zone, Protection and Load"),
    "shields": ({"name": "shield", "bonus": "bonus", "hardness": "hardness", "load": "load", "price": "price",
                 "note": "note", "enabled": "enabled"},
                ("name", "bonus", "hardness", "load"), "Shield, Bonus, Hardness and Load"),
}

def parse_equipment_workbook(wb, fname, equipment, warnings, errors, defined):
    """One piece per row on the Weapons, Armor and Shields sheets, appended to equipment["weapons"],
    ["armor"] and ["shields"] with the sheet's fields in camelCase and the Enabled? flag. Errors
    block the write like any other. `defined` is shared across workbooks ((sheet, bare lower-case
    name) -> file), so the same piece in two files is an error, as the same tree in two files is.
    Returns this workbook's counts per sheet, for the per-file line."""
    counts = {"weapons": 0, "armor": 0, "shields": 0}
    for title, kind in zip(EQUIPMENT_SHEETS, ("weapons", "armor", "shields")):
        if title not in wb.sheetnames: continue
        ws = wb[title]
        wanted, required, label = EQUIPMENT_COLUMNS[kind]
        cm = header_map(ws, wanted)
        if any(k not in cm for k in required):
            errors.append(f"{fname} / {title}: sheet needs {label} columns"); continue
        for r in ws.iter_rows(min_row=2):
            cellv = lambda k: (r[cm[k]] if k in cm and len(r) > cm[k] else None)
            # Every plain read blanks "None" and the dash, as in the actions parser.
            pv = lambda k: blank_none(plain(cellv(k)))
            name = plain(cellv("name"))
            if not name: continue
            where = f"{fname} / {title} / {name}"
            key = (kind, name.lower())
            if key in defined:
                errors.append(f"{where}: also defined {'on this sheet' if defined[key] == fname else 'in ' + defined[key]}"); continue
            defined[key] = fname
            row = {"name": name}
            if kind == "weapons":
                wkind, handling, damage = pv("kind"), pv("handling"), pv("damage")
                reach, rng = pv("reach"), pv("range")
                if wkind not in KINDS:
                    errors.append(f"{where}: Kind must be Melee or Ranged (got '{wkind}')"); continue
                if handling not in HANDLING:
                    errors.append(f"{where}: Handling must be {', '.join(HANDLING[:-1])} or {HANDLING[-1]} (got '{handling}')"); continue
                if not DAMAGE.fullmatch(damage):
                    errors.append(f"{where}: Damage '{damage}' is not of the form '1d8 S' (dice, a space, B, P or S)"); continue
                if wkind == "Melee" and not reach:
                    errors.append(f"{where}: a Melee weapon needs a Reach ('Adjacent' or 'N ft')"); continue
                if wkind == "Ranged" and not rng:
                    errors.append(f"{where}: a Ranged weapon needs a Range ('N ft')"); continue
                # The roster's melee table has no Range and its ranged table no Reach, so a value in
                # the wrong column reaches equipment.json and nothing else. Said, not dropped silently.
                if wkind == "Melee" and rng:
                    warnings.append(f"{where}: a Melee weapon with a Range '{rng}'; a thrown weapon's range is a trait ('Thrown 10 ft')")
                if wkind == "Ranged" and reach:
                    warnings.append(f"{where}: a Ranged weapon with a Reach '{reach}'; the ranged table has no Reach column")
                if reach and reach != "Adjacent" and not DISTANCE.fullmatch(reach):
                    warnings.append(f"{where}: Reach '{reach}' is neither 'Adjacent' nor 'N ft'")
                if rng and not DISTANCE.fullmatch(rng):
                    warnings.append(f"{where}: Range '{rng}' is not 'N ft'")
                row.update({"kind": wkind, "handling": handling, "group": pv("group"), "damage": damage,
                            "reach": reach, "range": rng, "traits": split_traits(pv("traits")),
                            "price": pv("price"), "notes": pv("notes")})
            elif kind == "armor":
                zone, traits, material = pv("zone"), split_traits(pv("traits")), (pv("material") or pv("type"))
                protection, load = whole(cellv("protection")), whole(cellv("load"))
                if zone not in ZONES:
                    errors.append(f"{where}: Zone must be {', '.join(ZONES[:-1])} or {ZONES[-1]} (got '{zone}')"); continue
                if protection is None:
                    errors.append(f"{where}: Protection must be a whole number (got '{pv('protection')}')"); continue
                if load is None:
                    errors.append(f"{where}: Load must be a whole number (got '{pv('load')}')"); continue
                # Material: the cell when it has one, else the first Trait (how the book prints a piece).
                if not material:
                    material = traits[0] if traits else ""
                    if material not in MATERIALS:
                        errors.append(f"{where}: no Material, and the first Trait '{material}' is not one "
                                      f"({', '.join(MATERIALS)})"); continue
                elif material not in MATERIALS:
                    errors.append(f"{where}: Material must be one of {', '.join(MATERIALS)} (got '{material}')"); continue
                elif traits and traits[0] in MATERIALS and traits[0] != material:
                    warnings.append(f"{where}: Material '{material}' but the first Trait is '{traits[0]}'; the book prints the material first")
                row.update({"zone": zone, "protection": protection, "load": load, "price": pv("price"),
                            "traits": traits, "material": material})
                description = pv("description")
                if description: row["description"] = description
            else:
                bonus, hardness, load = whole(cellv("bonus")), whole(cellv("hardness")), whole(cellv("load"))
                if bonus is None:
                    errors.append(f"{where}: Bonus must be a whole number, 0 for no Gear bonus (got '{pv('bonus')}')"); continue
                if hardness is None:
                    errors.append(f"{where}: Hardness must be a whole number (got '{pv('hardness')}')"); continue
                if load is None:
                    errors.append(f"{where}: Load must be a whole number (got '{pv('load')}')"); continue
                row.update({"bonus": bonus, "hardness": hardness, "load": load, "price": pv("price"), "note": pv("note")})
            row["enabled"] = enabled_flag(cellv("enabled"), "enabled" in cm)
            equipment[kind].append(row); counts[kind] += 1
    return counts

# ---- The spell columns (PHB v4.21; the magic workbook) -----------------------------------------
# A spell is authored as structure beside its Effect prose, the Aura column's precedent, so the Cast
# Maneuver in Foundry, the web app and the compendium docx all read one shape and no consumer parses
# prose. Columns (first word wins, order free): Threat (Blow | Blast | Blight | Beguilement; a row
# with one is a spell), Delivery (Zoned | Pervasive; blank for an Attack that deals no damage), Range
# ("adjacent" or "N ft"; blank where the book names none), Die ("d6"), Damage (the types, comma
# separated; blank for no damage), Targets ("one", "area", or the book's words), Quick / Focused /
# Committed (what each cast does, blank where the spell has no such cast), Defenses (an override of
# the Threat's two, "Awareness or Guard"). The vocabulary is checked; the prose is not.
SPELL_HEADERS = {"threat": "threat", "delivery": "delivery", "range": "range", "die": "die", "dmg": "damage",
                 "targets": "target", "quick": "quick", "focused": "focused", "committed": "committed",
                 "defenses": "defense"}
SPELL_THREATS = ("Blow", "Blast", "Blight", "Beguilement")
SPELL_DELIVERIES = ("Zoned", "Pervasive")
SPELL_DEFENSES = ("Evade", "Guard", "Endure", "Awareness")
SPELL_DIE = re.compile(r"^d(\d+)$")

def spell_for(cellv, cm, where, warnings, errors):
    """The row's spell block, or None when the sheet has no Threat column or the cell is blank."""
    if "threat" not in cm: return None
    pv = lambda k: blank_none(plain(cellv(k))) if k in cm else ""
    threat = pv("threat")
    if not threat: return None
    if threat not in SPELL_THREATS:
        errors.append(f"{where}: Threat must be {', '.join(SPELL_THREATS[:-1])} or {SPELL_THREATS[-1]} (got '{threat}')"); return None
    delivery = pv("delivery")
    if delivery and delivery not in SPELL_DELIVERIES:
        errors.append(f"{where}: Delivery must be Zoned or Pervasive (got '{delivery}')"); return None
    rng = pv("range")
    if rng and rng.lower() != "adjacent" and not DISTANCE.fullmatch(rng):
        errors.append(f"{where}: Range must be 'adjacent' or 'N ft' (got '{rng}')"); return None
    die_text = pv("die")
    die = None
    if die_text:
        m = SPELL_DIE.match(die_text.lower())
        if not m:
            errors.append(f"{where}: Die must be 'dN' (got '{die_text}')"); return None
        die = int(m.group(1))
    types = [t.strip().lower() for t in pv("dmg").split(",") if t.strip()]
    if die and not types:
        warnings.append(f"{where}: a Die with no Damage type; the roll will be untyped")
    if types and not delivery:
        warnings.append(f"{where}: damage with no Delivery; Zoned is assumed by the reader")
    if not rng:
        warnings.append(f"{where}: no Range; the book names none, so the table decides")
    defenses = [d.strip() for d in re.split(r",| or ", pv("defenses")) if d.strip()]
    for d in defenses:
        if d not in SPELL_DEFENSES:
            errors.append(f"{where}: Defenses must name {', '.join(SPELL_DEFENSES)} (got '{d}')"); return None
    effects = {k: pv(k) for k in ("quick", "focused", "committed")}
    if not any(effects.values()):
        warnings.append(f"{where}: a spell with no Quick, Focused or Committed text")
    spell = {"threat": threat.lower(), "delivery": delivery.lower(), "range": rng, "die": die, "types": types,
             "targets": pv("targets"), "effects": effects, "defenses": [d.lower() for d in defenses]}
    return spell

# ---- Mike's root rule (v0.38) ----------------------------------------------------------------
# Every root (constellation root and heritage root alike) must (1) hang on something that gets
# ROLLED, so the constellation can Flare from the one talent every member owns, and (2) IMPROVE at
# Expert/Master/Legendary. Warnings, not errors: authoring in progress shouldn't block a sync.
ROLLY = re.compile(r"\b(checks?|saves?|attack rolls?|Strikes?|damage|criticals?|crit|hits?|"
                   r"Aid|Escape|Recall Knowledge|Awareness|Seek|Seeking|AC)\b", re.I)
# Naming a rank is the explicit way to scale; adding "the constellation's proficiency/rank" to
# something is the implicit way, and it scales T->E->M->L by definition. Both count.
SCALES = re.compile(r"\b(Expert|Master|Legendary)\b|"
                    r"(constellation'?s?|this)\s+(proficiency|rank)|(proficiency|rank)\s+to\b", re.I)

# A heading welded to the label that should follow it on its own line: a lowercase letter, a cost
# glyph or a closing bracket running straight into a capitalised rules label.
WELD = re.compile(r"[a-z⓿❶❷❸❹❺❻↺)](Requirements|Trigger|Duration|Frequency|Auditory|Stance)\b")

def root_rule_gripes(tree, nname, effect):
    """Both halves of the root rule, checked against the Effect prose."""
    txt = re.sub(r"<[^>]+>", "", effect)
    out = []
    if not ROLLY.search(txt):
        out.append(f"{tree} / {nname}: root has nothing that gets rolled, so the constellation "
                   f"cannot Flare from its root (root rule, part 1)")
    if not SCALES.search(txt):
        out.append(f"{tree} / {nname}: root never improves at Expert/Master/Legendary "
                   f"(root rule, part 2)")
    return out

def main():
    # The diagnostics carry the action glyphs, and a piped stdout on Windows is cp1252, which cannot
    # encode them: the run would die on its first warning. Reconfigure the streams before printing.
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"): s.reconfigure(encoding="utf-8", errors="replace")
    files = [f for f in sorted(glob.glob(os.path.join(DATA, "*.xlsx"))) if not os.path.basename(f).startswith("~$")]
    if not files: sys.exit(f"no .xlsx files found in {DATA}")
    out, errors, warnings, sources, bgs, langs, chassis, cultures = {}, [], [], {}, [], [], [], []
    actions, action_files, defined_actions = [], [], {}
    # The roster as it stands, read once: the cultures block (0.15.0) carries a Culture's languages
    # from the previous row while cultures.xlsx has no Languages column of its own (see prior_languages).
    prior_roster = json.load(open(ROSTER, encoding="utf-8")) if os.path.exists(ROSTER) else {}
    equipment, equipment_files, defined_equipment = {"weapons": [], "armor": [], "shields": []}, [], {}
    for path in files:
        fname = os.path.basename(path)
        # A workbook open in Excel used to be skipped, which silently wrote a trees.json without
        # its trees. Excel saves atomically, so the file on disk is always the last saved version:
        # read it, and say so.
        if os.path.exists(os.path.join(DATA, "~$" + fname)):
            warnings.append(f"{fname}: open in Excel; converting the last saved version")
        wb = load_workbook(path, rich_text=True)
        if "_Tree Index" in wb.sheetnames:
            probe = header_map(wb["_Tree Index"], {"tree": "tree", "name": "name", "type": "type"})
            if "tree" not in probe and "name" in probe:
                # A Tree-less index with a Name column is an actions workbook. Without a Type column
                # it is an error rather than a fall-through, so a stale actions.json can never ship.
                if "type" not in probe:
                    errors.append(f"{fname}: an actions _Tree Index needs Name and Type columns (Name | Type | Meta note)"); continue
                n_before = len(actions)
                parse_actions_workbook(wb, fname, actions, warnings, errors, defined_actions)
                action_files.append(fname)
                print(f"  {fname}: {len(actions) - n_before} actions")
                continue
        if "_Tree Index" not in wb.sheetnames:
            if "Backgrounds" in wb.sheetnames:
                parse_bg_sheet(wb["Backgrounds"], bgs, warnings, fname)
            if "Languages" in wb.sheetnames:
                parse_lang_sheet(wb["Languages"], langs, warnings, fname)
            # An index-less workbook with a Weapons, Armor or Shields sheet is the equipment
            # workbook (ruling 64). Its per-file line counts what this file defined.
            if any(s in wb.sheetnames for s in EQUIPMENT_SHEETS):
                counts = parse_equipment_workbook(wb, fname, equipment, warnings, errors, defined_equipment)
                equipment_files.append(fname)
                print(f"  {fname}: {counts['weapons']} weapons, {counts['armor']} armor, {counts['shields']} shields")
            if not any(s in wb.sheetnames for s in ("Backgrounds", "Languages") + EQUIPMENT_SHEETS):
                warnings.append(f"{fname}: no '_Tree Index' sheet; file skipped")
            continue
        idx = wb["_Tree Index"]
        # "Vigor" is the v4.10 name for the per-level chassis number; "HP" still reads. "Primary
        # Attribute" is the 0.13.0 name of the tree-level Feeds (Mike renamed it on the ancestries
        # index); both read, and an unknown header is warned about by name.
        # Traits (0.14.0; Mike added the column to the ancestries index): the creature traits the
        # tree's chassis carries ("Human"), comma separated, shown on the character sheet's header.
        # Flare Triggers, Meta note and Summary are optional, and Mike deleted them from the
        # ancestries index on 2026-11-05: the meta line is derived when blank, and the blurb now
        # comes from the Lore sheet's Summary row (below).
        # Languages (0.15.0): a Culture's languages, comma separated, on the cultures index. While the
        # column is absent the languages are carried from the roster's previous row (one warning
        # naming the column to add), so the generated block never loses what the hand-kept one had.
        im = header_map(idx, {"tree": "tree", "cat": "categ", "feeds": ("feeds", "primary"), "sparks": "flare",
                              "meta": "meta", "skills": "skills", "hp": "hp", "vigor": "vigor", "size": "size",
                              "speed": "speed", "senses": "senses", "summary": "summary", "parent": "parent",
                              "traits": "trait", "languages": "language"},
                        unknown=warnings, where=f"{fname} / _Tree Index")
        carried_langs, blank_langs = [], []
        # The chassis columns are RETIRED (0.16.0): the Root's feature lines in Automation are the
        # authoring ([VIGOR 8], [SIZE Medium], [SPEED 6], [SENSES Low-light vision], [TRAIT Human],
        # [LANGUAGE Common, Serrovine], a Calling's [VIGOR opening 12] and [<Skill> trained]), read by
        # assets/parse_rules.mjs onto the roster's records. The columns are read one more release,
        # with one warning per workbook naming them; a column that disagrees with the Root's line
        # fails that step, as the Grants column's disagreement did.
        retired = sorted({im[k] for k in ("hp", "vigor", "size", "speed", "senses", "traits", "languages", "skills") if k in im})
        if retired:
            names = ", ".join(plain(idx.cell(1, j + 1)) for j in retired)
            warnings.append(f"{fname}: the _Tree Index columns {names} are retired (0.16.0); the Root's feature lines "
                            f"([VIGOR 8], [SIZE Medium], [SPEED 6], [SENSES ...], [TRAIT Human], [LANGUAGE ...], "
                            f"[VIGOR opening 12], [<Skill> trained]) are the authoring now (AUTOMATION_GRAMMAR.md). "
                            f"The columns are read this release and must agree with the lines")
        if "vigor" in im and "hp" not in im: im["hp"] = im["vigor"]
        if "tree" not in im or "cat" not in im:
            warnings.append(f"{fname}: _Tree Index needs at least 'Tree' and 'Category' columns; file skipped"); continue
        indexed, n_before = set(), len(out)
        for row in idx.iter_rows(min_row=2):
            g = lambda k: plain(row[im[k]]) if k in im and len(row) > im[k] else ""
            name = g("tree")
            if not name: continue
            category = g("cat")
            if category not in CATEGORIES:
                errors.append(f"{fname} / {name}: bad category '{category}' (allowed: {', '.join(CATEGORIES)})"); continue
            category = CATALIAS.get(category, category)   # Save -> Defense, Heritage -> Bloodline
            feeds = g("feeds")
            if feeds and feeds not in ATTRS:
                warnings.append(f"{fname} / {name}: tree Feeds '{feeds}' ignored (not an attribute)"); feeds = ""
            if not feeds and category in FALLBACK_NEEDED:
                errors.append(f"{fname} / {name}: {category} trees need a tree-level Feeds (untrained fallback)"); continue
            if name in out:
                errors.append(f"{name}: defined in both {sources[name]} and {fname}"); continue
            if name not in wb.sheetnames:
                if category == "Background" and "Backgrounds" in wb.sheetnames:
                    indexed.add(name)  # lives in the Backgrounds table, handled below
                else:
                    warnings.append(f"{fname} / {name}: in _Tree Index but no worksheet yet; skipped")
                continue
            indexed.add(name); sources[name] = fname
            ws = wb[name]
            # "Attribute" (0.13.0) is the talent-level Feeds under its current name: on a sheet headed
            # so, a blank cell is an ERROR (Mike: "no Attribute cell should ever be blank"); a sheet
            # still headed "Feeds" keeps the inherit-from-the-tree rule until it is renamed too.
            # Traits (0.14.0): an optional column on a tree sheet, comma separated as the action
            # sheets' is, so a spell Talent can carry a trait an Automation rule names
            # (`IF(Trait=Fear)`); written as `traits` on the node and `system.traits` on the Talent.
            cm = header_map(ws, {"name": "talent", "tier": "tier", "root": "root", "req": "requires",
                                 "prereq": "prereq", "desc": "desc", "effect": "effect", "feeds": ("feeds", "attribute"),
                                 "grants": "grants", "choice": "choice", "freetalent": "free", "aura": "aura",
                                 "automation": "automation", "enabled": "enabled", "traits": "trait", **SPELL_HEADERS},
                            unknown=warnings, where=f"{fname} / {name}")
            if "name" not in cm or "tier" not in cm or "effect" not in cm:
                errors.append(f"{fname} / {name}: sheet needs Talent, Tier and Effect columns"); continue
            strict_attr = "feeds" in cm and header_word(ws, cm["feeds"], "attribute") is not None
            rows = list(ws.iter_rows(min_row=2))
            # Requires (0.13.0): a sheet with no Requires column, or one whose cells are all blank
            # (Mike emptied the Human sheet's: "the Prerequisites column is the one that should have
            # been used in the first place"), reads Prerequisites as the requirement. Each comma- or
            # "or"-separated piece that names a Talent of the same sheet becomes `requires`; the rest
            # stays `prereqs` prose, so "Expert in Melee" on another sheet still prints. Resolved
            # after the rows are read, when the sheet's names are known.
            req_from_prereqs = "req" not in cm or not any(plain(r[cm["req"]]) for r in rows if len(r) > cm["req"])
            if "grants" in cm and any(plain(r[cm["grants"]]) for r in rows if len(r) > cm["grants"]):
                warnings.append(f"{fname} / {name}: the Grants column is retired (0.13.0); write the point as an "
                                f"Automation line instead ('grant: 1, Calling'; 'grant: 2, Skill, DIFFERENT'; "
                                f"AUTOMATION_GRAMMAR.md). Its cells are read this release and must agree with the line")
            # Choice and Free Talent are retired the same way (0.16.0): [CHOICE Weapon Group] and
            # [TALENT Weapon Familiarity] in Automation are the authoring; a filled cell is read this
            # release, warned once per sheet, and must agree with the line (build_foundry.mjs checks).
            retired_cols = [plain(ws.cell(1, cm[k] + 1)) for k in ("choice", "freetalent")
                            if k in cm and any(plain(r[cm[k]]) for r in rows if len(r) > cm[k])]
            if retired_cols:
                warnings.append(f"{fname} / {name}: the {' and '.join(retired_cols)} column{'s are' if len(retired_cols) > 1 else ' is'} "
                                f"retired (0.16.0); write [CHOICE Weapon Group] and [TALENT Weapon Familiarity] in Automation "
                                f"(AUTOMATION_GRAMMAR.md). The cells are read this release and must agree with the line")
            nodes, root_count, root_name = [], 0, None
            for r in rows:
                cellv = lambda k: (r[cm[k]] if k in cm and len(r) > cm[k] else None)
                pv = lambda k: plain(cellv(k))
                nname = pv("name")
                if not nname: continue
                tier = pv("tier").upper()[:1]
                if tier not in "TEML":
                    errors.append(f"{name} / {nname}: tier must be T/E/M/L"); continue
                rootcell = pv("root").lower()
                is_root = rootcell in ("x", "root", "yes", "true", "1")
                is_hroot = rootcell in ("h", "heritage")
                requires = [s.strip() for s in re.split(r",| or ", pv("req")) if s.strip()]
                prereqs = pv("prereq")
                desc = cell_html(cellv("desc"))
                effect = cell_html(cellv("effect"))
                feeds_o = pv("feeds")
                if not effect:
                    errors.append(f"{name} / {nname}: empty Effect"); continue
                # Excel drops a rich-text run whose whole text is a line break when the file that
                # wrote it did not mark the run xml:space="preserve", and the bold heading before it
                # is welded to the label after it ("PressRequirements"). Caught here so the sheet is
                # mended rather than the weld shipped (review 0.4.1).
                weld = WELD.search(re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", "\n", effect)))
                if weld:
                    warnings.append(f"{name} / {nname}: Effect reads '{weld.group(0)}'; the line break before "
                                    f"'{weld.group(1)}' was lost when the workbook was saved. Mend the cell.")
                # Enabled? (ruling 60): the row's own flag, always written; a sheet without the
                # column is wholly enabled. The tree's flag is its Root's, set once the rows are read.
                node = {"name": nname, "tier": tier, "cost": 1,
                        "enabled": enabled_flag(cellv("enabled"), "enabled" in cm), "effect": effect}
                gr = pv("grants")
                if gr:
                    m2 = re.match(r"^(\d+) in (one|any|different) (Skill|Calling|Combat Style|Armor|Save|Weapon|opened|anywhere)$", gr)
                    m3 = re.match(r"^(\d+) open (non-Skill|anywhere)$", gr)
                    if m2: node["grant"] = {"n": int(m2.group(1)), "mode": m2.group(2), "scope": m2.group(3)}
                    elif m3: node["grant"] = {"n": int(m3.group(1)), "mode": "open", "scope": m3.group(2)}
                    else: warnings.append(f"{name} / {nname}: unparsed Grants '{gr}'")
                # A build-time choice the talent's effect demands ("Choose a Weapon Group"). The
                # cell holds what is being chosen; consumers turn that into a list of options.
                ch = pv("choice")
                if ch: node["choice"] = ch
                # A talent handed over free by this one, with no talent point spent. Drilled is
                # the only one in the book so far: it gives you Weapon Familiarity outright.
                ft = pv("freetalent")
                if ft: node["freeTalent"] = ft
                node_traits = split_traits(pv("traits"))
                if node_traits: node["traits"] = node_traits
                # The Automation cell (0.9.0; rulings 118 and 120): one rule per line in the grammar
                # the Foundry system owns (module/rules/grammar.mjs; AUTOMATION_GRAMMAR.md for the
                # author). It is copied through as text, exactly as the action sheets' column is, and
                # never parsed here: build_foundry.mjs parses it with that grammar and stops on a line
                # it does not know, naming the cell, and the client parses it again with the same
                # module. Python holds no second parser, so the two can never disagree. Line breaks
                # inside the cell are the rule boundaries, and plain() keeps them. A cell reading
                # "None" or a dash is an empty cell, as the action parser reads it.
                auto = blank_none(plain(cellv("automation")))
                if auto: node["automation"] = auto
                # "Within N feet" of the carrier, drawn on the map (0.5.1). Since 0.13.0 the ring is
                # authored as an "aura:" line in Automation; the cell still reads where a sheet has
                # it, both is an error, and the Effect is checked against whichever is set, so a new
                # tier cannot ship without its ring; see aura_for.
                aura = aura_for(cellv("aura"), "aura" in cm, effect, f"{name} / {nname}", warnings, errors,
                                in_automation=automation_has(auto, "aura"))
                if aura: node["aura"] = aura
                # The spell columns (PHB v4.21, the magic workbook): a row with a Threat is a spell,
                # and the structure the Cast Maneuver needs rides beside the Effect prose; see spell_for.
                spell = spell_for(cellv, cm, f"{name} / {nname}", warnings, errors)
                if spell: node["spell"] = spell
                if requires: node["requires"] = requires
                if desc and desc.upper() != "TBD": node["desc"] = desc
                if prereqs and norm(prereqs) != norm(nname): node["prereqs"] = prereqs
                attr_word = "Attribute" if strict_attr else "Feeds"
                if feeds_o and feeds_o.upper() != "TBD":
                    if feeds_o not in ATTRS: errors.append(f"{name} / {nname}: bad {attr_word} '{feeds_o}'")
                    elif feeds_o != feeds: node["feeds"] = feeds_o
                elif feeds_o.upper() == "TBD":
                    warnings.append(f"{name} / {nname}: {attr_word} 'TBD'; the point feeds no attribute until set")
                elif strict_attr:
                    errors.append(f"{name} / {nname}: blank Attribute cell (no Attribute cell should ever be blank; "
                                  f"one of {', '.join(ATTRS)})")
                if is_root:
                    node["root"] = True; root_count += 1; root_name = nname
                elif is_hroot:
                    node["hroot"] = True
                    if category != "Ancestry":
                        warnings.append(f"{name} / {nname}: bloodline root ('h') outside an Ancestry tree")
                if is_root or is_hroot:
                    warnings.extend(root_rule_gripes(name, nname, effect))
                if "★" in nname and tier != "L":
                    errors.append(f"{name} / {nname}: capstones (★) must be tier L")
                nodes.append(node)
            # requires naming the root are KEPT (they drive the star-map's root edges);
            # the engine enforces root-first regardless of whether a talent lists it.
            if root_count != 1:
                errors.append(f"{name}: needs exactly 1 root (has {root_count})"
                              + (" (identity-tree roots are granted by the chargen choice, but still mark one)" if category in IDENTITY else ""))
            # A constellation exists in play when its Root does (ruling 60), so the tree's flag is
            # the root's. An enabled talent under a disabled root is still written, and warned
            # about: Foundry would ship a Talent with no Root to reach it from.
            tree_enabled = any(n["enabled"] for n in nodes if n.get("root"))
            if not tree_enabled:
                warnings.extend(f"{name} / {n['name']}: enabled, but the constellation's root is not; "
                                f"Foundry has no Root to reach it from" for n in nodes if n["enabled"])
            by_norm = {norm(n["name"]): n for n in nodes}
            if req_from_prereqs:
                for n in nodes:
                    pieces = [s.strip() for s in re.split(r",| or ", n.get("prereqs", "")) if s.strip()]
                    named = [p for p in pieces if norm(p) in by_norm]
                    if named:
                        n["requires"] = named
                        # Every piece a Talent of the sheet: the prose said nothing else, so it is
                        # not kept as prose; otherwise the whole text still prints as written.
                        if len(named) == len(pieces): n.pop("prereqs", None)
            for n in nodes:
                for rq in n.get("requires", []):
                    if norm(rq) not in by_norm: errors.append(f"{name} / {n['name']}: requires unknown '{rq}'")
                    # An enabled talent that Requires a disabled one can never be bought in Foundry (ruling 60).
                    elif n["enabled"] and not by_norm[norm(rq)]["enabled"]:
                        warnings.append(f"{name} / {n['name']}: enabled, but Requires '{rq}', which is not")
            label = category + (" constellation" if category in ("Skill", "Defense", "Armor", "Ancestry", "Culture", "Bloodline", "Background") else "")
            meta_extra = g("meta")
            cskills = [x.strip() for x in re.split(r",|•", g("skills")) if x.strip()]
            # The tree's Lore sheet (0.13.0), "<Tree> Lore", read when it exists; see parse_lore_sheet.
            lore = parse_lore_sheet(wb[f"{name} Lore"]) if f"{name} Lore" in wb.sheetnames else []
            if f"{name} Lore" in wb.sheetnames:
                indexed.add(f"{name} Lore")
                if not lore: warnings.append(f"{fname} / {name} Lore: the Lore sheet is empty")
            # The blurb (0.14.0): the Lore sheet's Summary row, plain. The index's Summary column was
            # only a copy of it (Mike, 2026-11-05: "all the Summary column was, was a copy of Summary
            # row in the Ancestry's Lore tab. So just use that instead"); a sheet that still has the
            # column is read where the Lore sheet has no Summary row.
            lore_summary = next((re.sub(r"<[^>]+>", " ", s["text"].replace("<br>", " ")).strip()
                                 for s in lore if s["label"].strip().lower() == "summary"), "")
            blurb = re.sub(r"\s+", " ", lore_summary) or g("summary")
            tree_traits = split_traits(g("traits"))
            if category == "Ancestry" and ("hp" in im or "size" in im):
                hp = g("hp")
                hers = [[n["name"], n["effect"]] for n in nodes if n.get("hroot")]
                if not hp.isdigit():
                    errors.append(f"{fname} / {name}: Ancestry Vigor must be a whole number (got '{hp}')")
                elif not hers:
                    errors.append(f"{fname} / {name}: Ancestry has chassis columns but no bloodline roots ('h')")
                else:
                    # `vigor` is the v4.10 key; `hp` is kept one release for readers not yet moved.
                    # `enabled` is the tree's (ruling 60), so chargen can offer only the shipped ancestries.
                    chassis.append({"name": name, "enabled": tree_enabled, "vigor": int(hp), "hp": int(hp), "size": g("size") or "Medium",
                                    "speed": g("speed") or "6 ft", "senses": g("senses") or "—",
                                    "tree": name, "blurb": blurb, "bloodlines": hers, "traits": tree_traits,
                                    **({"lore": lore} if lore else {})})
                    if not meta_extra:  # derive the display line when the sheet leaves it blank
                        bits = [g("size"), f"Vigor {hp}", g("speed")] + ([g("senses").lower()] if g("senses") not in ("", "—") else [])
                        meta_extra = " • ".join(b for b in bits if b)
            # A Culture's record (0.15.0): the roster's cultures block is generated from here, as the
            # ancestries block is, every row with its flag. Nothing parses the Effect prose: the
            # languages come from the index's Languages column, or from the previous roster row while
            # the column is missing (prior_languages), or are blank, each said once.
            if category == "Culture":
                if "languages" in im:
                    languages = normalise_languages(g("languages"))
                else:
                    languages = prior_languages(prior_roster, name)
                    (carried_langs if languages else blank_langs).append(name)
                cultures.append({"name": name, "enabled": tree_enabled, "attribute": feeds, "languages": languages,
                                 "blurb": blurb, "lore": lore, "traits": tree_traits, "tree": name})
            # A parent Constellation (v4.10): every Talent bought here also counts toward the
            # parent's rank. Melee and Ranged are the parents; the Combat Styles name one of them.
            # Since PHB v4.21 a tree with a Parent is a GROUP of that parent's Talents (a fighting style
            # within Melee or Ranged, a specialty within a magical discipline): it has no rank of its
            # own, and every Talent in it counts once toward the parent's. `group` says so to every
            # reader; `parent` names the Constellation it belongs to.
            parent = g("parent")
            out[name] = {"category": category, "enabled": tree_enabled, "feeds": feeds, **({"skills": cskills} if cskills else {}),
                         **({"parent": parent, "group": True} if parent else {}),
                         **({"lore": lore} if lore else {}),
                         **({"traits": tree_traits} if tree_traits else {}),
                         "meta": f"{label} • {feeds or '—'}" + (f" ({meta_extra})" if meta_extra else ""),
                         "sparks": g("sparks"), "nodes": nodes}
        if "Backgrounds" in wb.sheetnames:
            parse_bg_sheet(wb["Backgrounds"], bgs, warnings, fname); indexed.add("Backgrounds")
        if "Languages" in wb.sheetnames:
            parse_lang_sheet(wb["Languages"], langs, warnings, fname); indexed.add("Languages")
        extra = [sn for sn in wb.sheetnames if sn != "_Tree Index" and sn not in indexed]
        for sn in extra:
            m_lore = LORE_SHEET.match(sn)
            if m_lore:
                warnings.append(f"{fname} / {sn}: a Lore sheet for '{m_lore.group(1)}', which is not a tree in this "
                                f"workbook's _Tree Index (ignored)")
        extra = [sn for sn in extra if not LORE_SHEET.match(sn)]
        if extra: warnings.append(f"{fname}: sheets not in its _Tree Index (ignored): {', '.join(extra)}")
        if carried_langs:
            warnings.append(f"{fname}: no 'Languages' column on _Tree Index; "
                            + ", ".join(f"{n}'s" for n in carried_langs) + " languages carried from the roster "
                            "(add the column, comma separated: 'Serrovine, Common')")
        for n in blank_langs:
            warnings.append(f"{fname} / {n}: no 'Languages' column on _Tree Index and no roster row to carry from; "
                            "languages left blank")
        print(f"  {fname}: {len(out) - n_before} trees")
    # A Free Talent may live in another constellation (Drilled hands over Weapon Familiarity, which
    # is authored in Weapons), so it can only be checked once every sheet has been read.
    everywhere = {norm(n["name"]): n for tr in out.values() for n in tr["nodes"]}
    for tname, tree in out.items():
        for n in tree["nodes"]:
            ft = n.get("freeTalent")
            if ft and norm(ft) not in everywhere:
                errors.append(f"{tname} / {n['name']}: Free Talent names no talent in the book: '{ft}'")
            # A disabled Free Talent is one Foundry cannot hand over (ruling 60).
            elif ft and n["enabled"] and not everywhere[norm(ft)]["enabled"]:
                warnings.append(f"{tname} / {n['name']}: enabled, but its Free Talent '{ft}' is not; Foundry cannot hand it over")
        # A Parent must be a tree in the book, and a parent has no parent of its own.
        par = tree.get("parent")
        if par:
            if par not in out:
                errors.append(f"{tname}: Parent names no Constellation in the book: '{par}'")
            elif out[par].get("parent"):
                errors.append(f"{tname}: Parent '{par}' has a parent of its own; only one level of inheritance")
            elif par == tname:
                errors.append(f"{tname}: a Constellation cannot be its own Parent")
    # An enabled Background whose Skills name a constellation with no enabled Root hands out a
    # Training point with nowhere to land in Foundry (ruling 60). A Skill that is not a
    # constellation in the book (a Lore) is not checked, as before.
    for bg in bgs:
        for s in (bg.get("skills", []) if bg["enabled"] else []):
            if s in out and not out[s]["enabled"]:
                warnings.append(f"Backgrounds / {bg['name']}: enabled, but its Skill '{s}' is a constellation whose root is not")
    # The actions of an absent workbook, carried over as found (carry_over_absent), counted with the
    # rest because they go into the file Foundry builds from.
    carried = carry_over_absent(actions, action_files, {os.path.basename(f) for f in files}, defined_actions, warnings) if action_files else []
    all_actions = actions + carried
    # What Foundry will ship (ruling 61), on one line beside the per-file counts. Every row is
    # still written; this counts the rows flagged Yes.
    print("enabled for Foundry: "
          f"{sum(1 for t in out.values() if t['enabled'])} of {len(out)} constellations, "
          f"{sum(1 for t in out.values() for n in t['nodes'] if n['enabled'])} of {sum(len(t['nodes']) for t in out.values())} talents, "
          f"{sum(1 for b in bgs if b['enabled'])} of {len(bgs)} backgrounds, "
          f"{sum(1 for a in all_actions if a['enabled'])} of {len(all_actions)} actions, "
          + ", ".join(f"{sum(1 for e in equipment[k] if e['enabled'])} of {len(equipment[k])} {k}" for k in equipment))
    for w in warnings: print("WARNING:", w)
    if errors:
        print("VALIDATION ERRORS:"); [print("  -", e) for e in errors]; sys.exit(1)
    if not out: sys.exit("no trees found")
    # encoding is explicit everywhere: talent names carry ◆ ↺ ◇ ★, and a Windows default of cp1252
    # would crash the write half way through and leave a truncated trees.json behind.
    json.dump(out, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"wrote {OUT}: {len(out)} trees, {sum(len(t['nodes']) for t in out.values())} talents")
    if bgs:
        json.dump(bgs, open(BGOUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"wrote {BGOUT}: {len(bgs)} backgrounds")
    if langs:
        json.dump(langs, open(os.path.join(HERE, "languages.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"wrote languages.json: {len(langs)} languages")
    # Written only when an actions workbook was read, so a checkout without one keeps the file it has.
    # `source` names every workbook with actions in the file, the ones read this run first and the
    # absent ones whose actions were carried over after them.
    if action_files:
        sources = action_files + sorted({a["workbook"] for a in carried} - set(action_files))
        json.dump({"source": sources, "actions": all_actions}, open(AOUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        defaulted = [a["name"] for a in all_actions if a.get("costDefaulted")]
        print(f"wrote {AOUT}: {len(all_actions)} actions from {', '.join(sources)}"
              + (f" ({len(carried)} carried over from a workbook not in data/)" if carried else "")
              + (f" ({len(defaulted)} with no Cost given, costed at one action: {', '.join(defaulted)})" if defaulted else ""))
    elif os.path.exists(AOUT):
        # Printed directly: the warnings list was flushed above, so appending to it here would say nothing.
        print(f"WARNING: no actions workbook in data/; {AOUT} left as found. It is generated from the actions "
              f"workbooks (data/maneuvers.xlsx today), not hand-kept.")
    # Written only when an equipment workbook was read, for the same reason (ruling 64).
    if equipment_files:
        json.dump({"source": equipment_files, **equipment}, open(EOUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"wrote {EOUT}: {len(equipment['weapons'])} weapons "
              f"({sum(1 for w in equipment['weapons'] if w['kind'] == 'Melee')} melee, "
              f"{sum(1 for w in equipment['weapons'] if w['kind'] == 'Ranged')} ranged), "
              f"{len(equipment['armor'])} armor, {len(equipment['shields'])} shields from {', '.join(equipment_files)}")
    elif os.path.exists(EOUT):
        print(f"WARNING: no equipment workbook in data/; {EOUT} left as found. It is generated from data/equipment.xlsx, not hand-kept.")
    # Patch ONLY the generated blocks of roster.json: ancestries and cultures (0.15.0) here, the four
    # equipment blocks below. Conditions, materials, handling, callings and the trait tables stay
    # hand-kept. Guarded: an empty parse (chassis columns removed from ancestries.xlsx, no Culture
    # tree read, or no such workbook in data/ at all) leaves that block alone rather than blanking
    # chargen. A workbook open in Excel is no longer a case here: it is read from its last saved copy
    # above.
    if (chassis or cultures) and os.path.exists(ROSTER):
        roster = json.load(open(ROSTER, encoding="utf-8"))
        for key, block, label in (("ancestries", chassis, "ancestry chassis"), ("cultures", cultures, "culture records")):
            if not block: continue
            before = len(roster.get(key, []))
            if len(block) < before:
                print(f"WARNING: roster.json had {before} {key}, the sheets define {len(block)}; "
                      f"the sheets win, so confirm nothing was dropped by accident")
            roster[key] = block   # key keeps its original position in the file
            print(f"wrote {ROSTER}: {len(block)} {label} from the sheet")
        json.dump(roster, open(ROSTER, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    # The roster's weaponsMelee, weaponsRanged, armorPieces and shields blocks are generated from the
    # equipment workbook (ruling 64), as the ancestries block is from ancestries.xlsx: EVERY row,
    # enabled or not, in the positional shapes the web app, the compendium docx and build_foundry.mjs
    # already read, so those consumers are unchanged and Foundry does its Enabled? filtering from
    # equipment.json (ruling 61). Hand edits to these blocks are pointless: the next run overwrites
    # them. Same guard as the ancestries block: only when an equipment workbook was read, so a
    # checkout without one keeps the roster it has.
    if equipment_files and os.path.exists(ROSTER):
        melee = [w for w in equipment["weapons"] if w["kind"] == "Melee"]
        ranged = [w for w in equipment["weapons"] if w["kind"] == "Ranged"]
        # Shapes: melee [name, handling, group, damage, reach, traits, price] with the table's null
        # marker for a blank price (Unarmed Strike); ranged [name, handling, group, damage, range,
        # traits]; armor [name, zone, protection, load, price, traits, material]; shields [name,
        # bonus, hardness, load, price, note].
        blocks = {
            "weaponsMelee": [[w["name"], w["handling"], w["group"], w["damage"], w["reach"], ", ".join(w["traits"]), w["price"] or "—"] for w in melee],
            "weaponsRanged": [[w["name"], w["handling"], w["group"], w["damage"], w["range"], ", ".join(w["traits"])] for w in ranged],
            "armorPieces": [[a["name"], a["zone"], a["protection"], a["load"], a["price"], ", ".join(a["traits"]), a["material"]] for a in equipment["armor"]],
            "shields": [[s["name"], s["bonus"], s["hardness"], s["load"], s["price"], s["note"]] for s in equipment["shields"]],
        }
        roster = json.load(open(ROSTER, encoding="utf-8"))
        for key, rows in blocks.items():
            before = len(roster.get(key, []))
            if len(rows) < before:
                print(f"WARNING: roster.json had {before} {key} rows, the sheet defines {len(rows)}; "
                      f"the sheet wins, so confirm nothing was dropped by accident")
            roster[key] = rows   # an existing key keeps its position in the file
        json.dump(roster, open(ROSTER, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"wrote {ROSTER}: " + ", ".join(f"{k} ({len(v)})" for k, v in blocks.items())
              + f" regenerated from {', '.join(equipment_files)}; those blocks are generated, so hand edits to them are overwritten")

if __name__ == "__main__":
    main()
