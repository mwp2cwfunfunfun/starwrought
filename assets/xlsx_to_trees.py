# STARWROUGHT data pipeline: data/*.xlsx -> assets/trees.json
# Header-driven: column ORDER doesn't matter; column NAMES do (first word wins).
# Recognized tree-sheet columns: Talent | Tier | Root | Requires | Prerequisites | Description | Effect | Feeds
#                                Grants | Choice | Free Talent
# Recognized index columns:      Tree | Category | Feeds | Flare (triggers) | Meta | Skills
#   Ancestry rows may also carry: HP | Size | Speed | Senses | Summary
#   -> those generate the "ancestries" block of roster.json, so the sheet owns the chassis.
# Rich text in Description/Effect cells (b/i/u/strike/color) becomes HTML and mirrors everywhere.
import json, os, re, sys, glob
from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(HERE, "trees.json")
BGOUT = os.path.join(HERE, "backgrounds.json")
ROSTER = os.path.join(HERE, "roster.json")

def parse_bg_sheet(bws, bgs, warnings, fname):
    bm = header_map(bws, {"name": "background", "rarity": "rarity", "desc": "desc", "effect": "effect", "skills": "skills", "lore": "lore"})
    if "name" not in bm or "effect" not in bm:
        warnings.append(f"{fname}: Backgrounds sheet needs Background and Effect columns"); return
    for r in bws.iter_rows(min_row=2):
        gv = lambda k: (r[bm[k]] if k in bm and len(r) > bm[k] else None)
        bname = plain(gv("name"))
        if not bname: continue
        eff = cell_html(gv("effect"))
        skills = [x.strip() for x in re.split(r",|•", plain(gv("skills"))) if x.strip()]
        entry = {"name": bname, "rarity": plain(gv("rarity")) or "Common",
                 "desc": cell_html(gv("desc")), "effect": eff}
        if skills: entry["skills"] = skills
        lore = plain(gv("lore"))
        if lore: entry["lore"] = lore
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
CATEGORIES = ("Skill", "Defense", "Save", "Weapon", "Combat Style", "Armor", "Calling",
              "Ancestry", "Culture", "Bloodline", "Heritage", "Background")
CATALIAS = {"Save": "Defense", "Heritage": "Bloodline"}
IDENTITY = ("Ancestry", "Culture", "Bloodline", "Heritage", "Background")  # roots granted by the chargen choice itself
FALLBACK_NEEDED = ("Skill", "Defense", "Weapon", "Combat Style", "Armor")         # tree-level feed required (untrained fallback)
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

def header_map(ws, wanted):
    """wanted: {key: first-word-of-header (lowercase)} -> {key: col_index0} using row 1."""
    m = {}
    for j in range(1, ws.max_column + 1):
        h = plain(ws.cell(1, j)).lower()
        for key, word in wanted.items():
            if key not in m and h.startswith(word):
                m[key] = j - 1
    return m

norm = lambda s: re.sub(r"[◆↺★\s]+$", "", s or "").strip()

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
    files = [f for f in sorted(glob.glob(os.path.join(DATA, "*.xlsx"))) if not os.path.basename(f).startswith("~$")]
    if not files: sys.exit(f"no .xlsx files found in {DATA}")
    out, errors, warnings, sources, bgs, langs, chassis = {}, [], [], {}, [], [], []
    for path in files:
        fname = os.path.basename(path)
        if os.path.exists(os.path.join(DATA, "~$" + fname)):
            warnings.append(f"{fname}: open in Excel (lock file present) — skipped this sync"); continue
        wb = load_workbook(path, rich_text=True)
        if "_Tree Index" not in wb.sheetnames:
            if "Backgrounds" in wb.sheetnames:
                parse_bg_sheet(wb["Backgrounds"], bgs, warnings, fname)
            if "Languages" in wb.sheetnames:
                parse_lang_sheet(wb["Languages"], langs, warnings, fname)
            if "Backgrounds" not in wb.sheetnames and "Languages" not in wb.sheetnames:
                warnings.append(f"{fname}: no '_Tree Index' sheet — file skipped")
            continue
        idx = wb["_Tree Index"]
        im = header_map(idx, {"tree": "tree", "cat": "categ", "feeds": "feeds", "sparks": "flare",
                              "meta": "meta", "skills": "skills", "hp": "hp", "size": "size",
                              "speed": "speed", "senses": "senses", "summary": "summary"})
        if "tree" not in im or "cat" not in im:
            warnings.append(f"{fname}: _Tree Index needs at least 'Tree' and 'Category' columns — file skipped"); continue
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
                    warnings.append(f"{fname} / {name}: in _Tree Index but no worksheet yet — skipped")
                continue
            indexed.add(name); sources[name] = fname
            ws = wb[name]
            cm = header_map(ws, {"name": "talent", "tier": "tier", "root": "root", "req": "requires",
                                 "prereq": "prereq", "desc": "desc", "effect": "effect", "feeds": "feeds", "grants": "grants",
                                 "choice": "choice", "freetalent": "free"})
            if "name" not in cm or "tier" not in cm or "effect" not in cm:
                errors.append(f"{fname} / {name}: sheet needs Talent, Tier and Effect columns"); continue
            nodes, root_count, root_name = [], 0, None
            for r in ws.iter_rows(min_row=2):
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
                node = {"name": nname, "tier": tier, "cost": 1, "effect": effect}
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
                if requires: node["requires"] = requires
                if desc and desc.upper() != "TBD": node["desc"] = desc
                if prereqs and norm(prereqs) != norm(nname): node["prereqs"] = prereqs
                if feeds_o and feeds_o.upper() != "TBD":
                    if feeds_o not in ATTRS: errors.append(f"{name} / {nname}: bad Feeds '{feeds_o}'")
                    elif feeds_o != feeds: node["feeds"] = feeds_o
                elif feeds_o.upper() == "TBD":
                    warnings.append(f"{name} / {nname}: Feeds 'TBD' — point feeds no attribute until set")
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
                              + (" — identity-tree roots are granted by the chargen choice, but still mark one" if category in IDENTITY else ""))
            names = {norm(n["name"]) for n in nodes}
            for n in nodes:
                for rq in n.get("requires", []):
                    if norm(rq) not in names: errors.append(f"{name} / {n['name']}: requires unknown '{rq}'")
            label = category + (" constellation" if category in ("Skill", "Defense", "Armor", "Ancestry", "Culture", "Bloodline", "Background") else "")
            meta_extra = g("meta")
            cskills = [x.strip() for x in re.split(r",|•", g("skills")) if x.strip()]
            if category == "Ancestry" and ("hp" in im or "size" in im):
                hp = g("hp")
                hers = [[n["name"], n["effect"]] for n in nodes if n.get("hroot")]
                if not hp.isdigit():
                    errors.append(f"{fname} / {name}: Ancestry HP must be a whole number (got '{hp}')")
                elif not hers:
                    errors.append(f"{fname} / {name}: Ancestry has chassis columns but no bloodline roots ('h')")
                else:
                    chassis.append({"name": name, "hp": int(hp), "size": g("size") or "Medium",
                                    "speed": g("speed") or "25 ft", "senses": g("senses") or "—",
                                    "tree": name, "blurb": g("summary"), "bloodlines": hers})
                    if not meta_extra:  # derive the display line when the sheet leaves it blank
                        bits = [g("size"), f"{hp} HP", g("speed")] + ([g("senses").lower()] if g("senses") not in ("", "—") else [])
                        meta_extra = " • ".join(b for b in bits if b)
            out[name] = {"category": category, "feeds": feeds, **({"skills": cskills} if cskills else {}),
                         "meta": f"{label} • {feeds or '—'}" + (f" ({meta_extra})" if meta_extra else ""),
                         "sparks": g("sparks"), "nodes": nodes}
        if "Backgrounds" in wb.sheetnames:
            parse_bg_sheet(wb["Backgrounds"], bgs, warnings, fname); indexed.add("Backgrounds")
        if "Languages" in wb.sheetnames:
            parse_lang_sheet(wb["Languages"], langs, warnings, fname); indexed.add("Languages")
        extra = [sn for sn in wb.sheetnames if sn != "_Tree Index" and sn not in indexed]
        if extra: warnings.append(f"{fname}: sheets not in its _Tree Index (ignored): {', '.join(extra)}")
        print(f"  {fname}: {len(out) - n_before} trees")
    # A Free Talent may live in another constellation (Drilled hands over Weapon Familiarity, which
    # is authored in Weapons), so it can only be checked once every sheet has been read.
    everywhere = {norm(n["name"]): t for t, tr in out.items() for n in tr["nodes"]}
    for tname, tree in out.items():
        for n in tree["nodes"]:
            ft = n.get("freeTalent")
            if ft and norm(ft) not in everywhere:
                errors.append(f"{tname} / {n['name']}: Free Talent names no talent in the book: '{ft}'")
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
    # Patch ONLY the ancestries block of roster.json; cultures/weapons/conditions/etc. stay hand-kept.
    # Guarded: an empty parse (workbook locked by Excel, chassis columns removed) leaves the file alone
    # rather than blanking chargen.
    if chassis and os.path.exists(ROSTER):
        roster = json.load(open(ROSTER, encoding="utf-8"))
        before = len(roster.get("ancestries", []))
        if len(chassis) < before:
            print(f"WARNING: roster.json had {before} ancestries, the sheets define {len(chassis)}; "
                  f"the sheets win, so confirm nothing was dropped by accident")
        roster["ancestries"] = chassis   # key keeps its original position in the file
        json.dump(roster, open(ROSTER, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"wrote {ROSTER}: {len(chassis)} ancestry chassis from the sheet")

if __name__ == "__main__":
    main()
