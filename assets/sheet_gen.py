# STARWROUGHT character sheet generator: blank fillable + Mira example (Playtest v4.10)
#
# Every label, formula and footnote on the sheet is read from assets/sheet_spec.json, which the web
# app also reads; the geometry lives here. Run from the project root:
#     python assets/sheet_gen.py   ->  Starwrought_Character_Sheet_Fillable.pdf, Mira_Character_Sheet.pdf
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "sheet_spec.json"), encoding="utf-8"))
META = SPEC["meta"]

INK = HexColor("#1D2A32"); TEAL = HexColor("#0E5F6B"); EMBER = HexColor("#E2703A")
GOLD = HexColor("#D9A441"); PAPER = HexColor("#F4EFE6"); GREY = HexColor("#8AA0A8"); ROW = HexColor("#F2F0EA")
RULE = HexColor("#D5DCE0")
W, H = letter  # 612 x 792
M = 30

# ---------- glyphs ----------
# The handbook's action glyphs (⓿ ❶ ❷ ❸ ... and the Reaction ↺) are not in the PDF base-14 fonts, so
# text is drawn in runs: ordinary characters in Helvetica, glyphs in a TrueType font that has them.
# Segoe UI Symbol (Windows) carries every glyph including ⓿; DejaVu Sans (shipped with matplotlib,
# or a system copy) lacks ⓿. A glyph the chosen font cannot draw falls back to "(1)" style text, and
# with no TrueType font at all every glyph does, so the sheet always renders something readable.
GLYPHS = set("⓿❶❷❸❹❺❻↺◆◇★")
ASCII_FALLBACK = {"⓿": "(0)", "❶": "(1)", "❷": "(2)", "❸": "(3)", "❹": "(4)", "❺": "(5)", "❻": "(6)",
                  "↺": "(R)", "◆": "(1)", "◇": "(0)", "★": "*"}


def _glyph_font_candidates():
    yield "SegoeUISymbol", r"C:\Windows\Fonts\seguisym.ttf"
    try:
        import matplotlib
        yield "DejaVuSans", os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSans.ttf")
    except Exception:
        pass
    yield "DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    yield "DejaVuSans", "/usr/share/fonts/TTF/DejaVuSans.ttf"


def _register_glyph_font():
    for name, path in _glyph_font_candidates():
        if not os.path.exists(path):
            continue
        try:
            f = TTFont(name, path)
            pdfmetrics.registerFont(f)
        except Exception:
            continue
        cmap = f.face.charToGlyph
        have = {ch for ch in GLYPHS if cmap.get(ord(ch))}
        return name, have
    return None, set()


GLYPH_FONT, GLYPH_HAVE = _register_glyph_font()


def _runs(t):
    """Split text into (is_glyph, chunk) runs. Glyphs the font lacks are replaced by ASCII."""
    out, buf, mode = [], "", False
    for ch in str(t):
        if ch in GLYPHS and ch in GLYPH_HAVE:
            want = True
        else:
            want = False
            if ch in GLYPHS:
                ch = ASCII_FALLBACK.get(ch, ch)
        if want != mode and buf:
            out.append((mode, buf)); buf = ""
        mode = want; buf += ch
    if buf:
        out.append((mode, buf))
    return out


def swidth(t, font, size):
    return sum(pdfmetrics.stringWidth(chunk, GLYPH_FONT if g else font, size) for g, chunk in _runs(t))


def dstr(c, x, y, t, font, size):
    """drawString with glyph runs; returns the x after the text."""
    for g, chunk in _runs(t):
        fn = GLYPH_FONT if g else font
        c.setFont(fn, size); c.drawString(x, y, chunk)
        x += pdfmetrics.stringWidth(chunk, fn, size)
    return x


def wrap_lines(t, w, font, size, maxlines=99):
    """Break text to fit width w. Text that needs more than maxlines fails the build rather than
    losing its tail silently: a rule clause that falls off the sheet is a wrong rule, not a layout nit."""
    words, line, out = str(t).split(), "", []
    for i, wd in enumerate(words):
        trial = (line + " " + wd).strip()
        if swidth(trial, font, size) <= w:
            line = trial
        else:
            out.append(line); line = wd
            if len(out) == maxlines:
                raise SystemExit("sheet_gen: text needs more than %d lines at %.1fpt across %.0fpt; dropped %r"
                                 % (maxlines, size, w, " ".join(words[i:])))
    if line:
        out.append(line)
    return out


def hdr_txt(c, x, y, t, size=8, col=TEAL, bold=True):
    c.setFillColor(col); dstr(c, x, y, t, "Helvetica-Bold" if bold else "Helvetica", size)


def micro(c, x, y, t, col=GREY, size=5.4):
    c.setFillColor(col); dstr(c, x, y, t, "Helvetica", size)


def micro_wrap(c, x, y, t, w, col=GREY, size=5.4, lead=6.2, maxlines=3):
    """micro(), broken to fit width w. Returns the baseline of the last line drawn."""
    c.setFillColor(col)
    out = wrap_lines(t, w, "Helvetica", size, maxlines)
    for i, ln in enumerate(out):
        dstr(c, x, y - i * lead, ln, "Helvetica", size)
    return y - (max(len(out), 1) - 1) * lead


def box(c, x, y, w, h, fill=None, stroke=GREY, lw=0.8):
    c.setLineWidth(lw); c.setStrokeColor(stroke)
    if fill: c.setFillColor(fill); c.rect(x, y, w, h, fill=1, stroke=1)
    else: c.rect(x, y, w, h, fill=0, stroke=1)


def val(c, x, y, t, size=9, col=INK, bold=True, center_w=None):
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFillColor(col)
    if center_w: dstr(c, x + (center_w - swidth(t, font, size)) / 2, y, t, font, size)
    else: dstr(c, x, y, t, font, size)


def field(c, name, x, y, w, h, size=9, tooltip=""):
    c.acroForm.textfield(name=name, x=x, y=y, width=w, height=h, fontSize=size,
                         borderWidth=0, fillColor=None, textColor=INK, tooltip=tooltip or name,
                         fieldFlags="doNotScroll")


def checkbox(c, name, x, y, s=9):
    c.acroForm.checkbox(name=name, x=x, y=y, size=s, borderWidth=1, borderColor=TEAL,
                        fillColor=white, textColor=EMBER, buttonStyle="cross")


def tick(c, name, x, y, s, F, on):
    """A checkbox on the fillable sheet; a drawn box, crossed when on, on the example sheet."""
    if F: checkbox(c, name, x, y, s)
    else:
        box(c, x, y, s, s, white, TEAL, 0.9)
        if on: val(c, x, y + 2, "X", s - 1, EMBER, center_w=s)


def spark_star(c, x, y, r=3.2, col=GOLD):
    c.setFillColor(col); c.setStrokeColor(col); c.setLineWidth(1)
    for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)): c.line(x, y, x + dx, y + dy)
    for dx, dy in ((r * .55, r * .55), (-r * .55, r * .55), (r * .55, -r * .55), (-r * .55, -r * .55)): c.line(x, y, x + dx, y + dy)


def section(c, x, y, w, label, micro_t=None, h=13, size=8, micro_x=None):
    """A teal section bar with its label, and an optional white micro line inside it."""
    c.setFillColor(TEAL); c.rect(x, y, w, h, fill=1, stroke=0)
    val(c, x + 4, y + (h - size) / 2 + 1, label, size, white)
    if micro_t:
        mx = micro_x if micro_x is not None else x + 6 + swidth(label, "Helvetica-Bold", size)
        # The caption is white on teal: anything past the bar is white on paper, or under the next
        # column's bar, and invisible either way. Shrink to fit (never below 4.2pt) and say so.
        avail = x + w - 3 - mx
        need = swidth(micro_t, "Helvetica", 5)
        msize = 5 if need <= avail else max(4.2, 5 * avail / need)
        if swidth(micro_t, "Helvetica", msize) > avail:
            print(f"sheet_gen: caption on {label} overruns its bar by {swidth(micro_t, 'Helvetica', msize) - avail:.0f}pt", file=sys.stderr)
        micro(c, mx, y + (h - 5) / 2 + 1, micro_t, white, msize)


# ---------- the reference strip (page 1 footer) ----------
FOOT_SIZE, FOOT_LEAD = 4.9, 5.7


def footer_lines():
    return [ln for t in SPEC["footer"] for ln in wrap_lines(t, W - 2 * M, "Helvetica", FOOT_SIZE, 2)]


def footer_height():
    return 7 + len(footer_lines()) * FOOT_LEAD + 5


def draw_footer(c):
    fh = footer_height()
    c.setFillColor(PAPER); c.rect(0, 0, W, fh, fill=1, stroke=0)
    lines = footer_lines()
    for i, ln in enumerate(lines):
        micro(c, M, fh - 7 - i * FOOT_LEAD, ln, TEAL, FOOT_SIZE)
    micro(c, W - M - swidth("STARWROUGHT " + META["version"] + " - page 1", "Helvetica", 5.4), 4,
          "STARWROUGHT " + META["version"] + " - page 1", GREY, 5.4)
    return fh


def page1(c, d=None, fillable=False):
    F = bool(fillable)
    d = d or {}
    # header band
    c.setFillColor(INK); c.rect(0, H - 52, W, 52, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 24); c.setFillColor(GOLD); c.drawString(M, H - 38, META["title"])
    c.setFont("Helvetica-Bold", 11); c.setFillColor(white); c.drawString(M + 206, H - 36, META["subtitle"])
    c.setFont("Helvetica", 7.5); c.setFillColor(GREY); c.drawRightString(W - M, H - 36, META["version"] + "  •  " + META["tagline"])
    spark_star(c, M + 192, H - 32, 4.5)

    # identity row
    y = H - 86
    geo = [(M, 170), (M + 178, 128), (M + 314, 92), (M + 414, 92)]
    ids = [(SPEC["identity"][i]["label"], geo[i][0], geo[i][1], SPEC["identity"][i]["key"]) for i in range(4)]
    for label, x, w, key in ids:
        box(c, x, y, w, 20); hdr_txt(c, x, y + 23, label, 6.2)
        if F: field(c, key, x + 2, y + 2, w - 4, 16)
        elif d: val(c, x + 4, y + 6, d[key], 8.6)
    # level + milestones
    bx = M + 514
    box(c, bx, y, 34, 20); hdr_txt(c, bx, y + 23, SPEC["level_label"], 6.2)
    if F: field(c, "level", bx + 2, y + 2, 30, 16, 11)
    elif d: val(c, bx, y + 5, d["level"], 11, center_w=34)
    hdr_txt(c, M, y - 16, SPEC["milestones"]["label"], 6.2)
    for i in range(4):
        mx = M + 96 + i * 30
        tick(c, f"milestone{i+1}", mx, y - 21, 10, F, d.get("milestones", 0) > i)
        micro(c, mx + 12, y - 18, SPEC["milestones"]["slots"][i], TEAL if i < 3 else EMBER, 5.6)
    micro(c, M + 230, y - 18, SPEC["milestones"]["micro"], GREY)

    LX, LW = M, 178             # left column
    RX, RW = M + 192, W - 2 * M - 192  # right column
    FOOT_TOP = footer_height()

    # ================= LEFT COLUMN =================
    # ---------- ATTRIBUTES ----------
    y0 = y - 40
    section(c, LX, y0, LW, SPEC["attributes"]["label"], SPEC["attributes"]["micro"])
    labels = list(zip(SPEC["attributes"]["rows"], ["might", "agility", "wits", "presence"]))
    ay = y0 - 26
    for name, key in labels:
        box(c, LX, ay, 92, 22, ROW); val(c, LX + 4, ay + 7.5, name, 8.4, TEAL)
        box(c, LX + 96, ay, 36, 22)          # bonus
        box(c, LX + 136, ay, 42, 22)         # points
        micro(c, LX + 98, ay + 24, SPEC["attributes"]["cols"][0], GREY, 4.8); micro(c, LX + 138, ay + 24, SPEC["attributes"]["cols"][1], GREY, 4.8)
        if F: field(c, key, LX + 98, ay + 2, 32, 18, 11); field(c, key + "_pts", LX + 138, ay + 2, 38, 18, 9)
        elif d: val(c, LX + 96, ay + 6, d[key], 11, center_w=36); val(c, LX + 136, ay + 6, d[key + "_pts"], 9, GREY, center_w=42)
        ay -= 26
    cur = ay + 26  # bottom of the last row

    # ---------- DEFENSES ----------
    # v4.10: four Defenses, two Trained at creation. Each is a check you roll and a Threshold others
    # are measured against, with no level term. Armor sits below them and never touches them.
    dy = cur - 21
    section(c, LX, dy, LW, SPEC["defense"]["label"])
    yb = micro_wrap(c, LX, dy - 7, SPEC["defense"]["ac_micro"], LW, GREY, 4.4, 5.0, 2)
    DKEYS = ["awareness", "evade", "guard", "endure"]
    defs = SPEC["defense"].get("defenses") or SPEC["defense"]["saves"]
    micro(c, LX + 104, yb - 7, "CHECK", GREY, 4.8); micro(c, LX + 146, yb - 7, "THRESH", GREY, 4.8)
    top = yb - 9
    RH = 20
    for i, row in enumerate(defs):
        nm, form = row[0], row[1]
        gloss = row[2] if len(row) > 2 else ""
        key = DKEYS[i] if i < len(DKEYS) else "def%d" % i
        rb = top - RH
        box(c, LX, rb, 100, RH, ROW); val(c, LX + 3, rb + RH - 8, nm, 6.8, TEAL)
        micro(c, LX + 3, rb + 7.2, form, GREY, 4.2)
        micro(c, LX + 3, rb + 2.2, gloss, TEAL, 4.2)
        box(c, LX + 104, rb, 36, RH); box(c, LX + 144, rb, 34, RH)
        if F:
            field(c, key, LX + 106, rb + 3, 32, 14, 9)
            field(c, key + "_th", LX + 146, rb + 3, 30, 14, 9)
        elif d:
            val(c, LX + 104, rb + 7, d.get(key, ""), 9, center_w=36)
            val(c, LX + 144, rb + 7, d.get(key + "_th", ""), 9, EMBER, center_w=34)
        top = rb - 2
    cur = top + 2

    # ---------- ARMOR & WOUNDS BY ZONE ----------
    # Per Zone: the piece worn, its Protection, an Exposed tick, and the Zone's Wound boxes (capacity
    # two for a Medium creature) with the first and final Wound effects from the book's table.
    zy = cur - 15
    section(c, LX, zy, LW, SPEC["defense"].get("armor_label", "ARMOR & WOUNDS BY ZONE"), h=11, size=6.6)
    micro(c, LX + 95, zy - 7, "PROT", GREY, 4.4); micro(c, LX + 119, zy - 7, "EXP", GREY, 4.4)
    micro(c, LX + 141, zy - 7, "WOUNDS", GREY, 4.4)
    ZKEYS = SPEC["defense"].get("zones", ["HEAD", "TORSO", "ARMS", "LEGS"])
    WSPEC = SPEC.get("wounds", {})
    hints = WSPEC.get("hints", {})
    top = zy - 9
    ZH, ZROW = 14, 20
    for zi, zname in enumerate(ZKEYS):
        zk = zname.lower()
        rb = top - ZH
        box(c, LX, rb, 30, ZH, ROW); val(c, LX + 3, rb + 4.5, zname, 5.6, TEAL)
        box(c, LX + 32, rb, 60, ZH); box(c, LX + 94, rb, 22, ZH)
        tick(c, "exposed_" + zk, LX + 121, rb + 2, 10, F, d.get("exposed_" + zk))
        wounds = int(d.get("wounds_" + zk, 0) or 0)
        for wi in range(2):
            tick(c, f"wound_{zk}_{wi+1}", LX + 141 + wi * 14, rb + 2, 10, F, wounds > wi)
        if F:
            field(c, "armor_" + zk, LX + 34, rb + 1.5, 56, 11, 6.5)
            field(c, "prot_" + zk, LX + 96, rb + 1.5, 18, 11, 8)
        elif d:
            val(c, LX + 35, rb + 4, d.get("armor_" + zk, ""), 6.2, INK, bold=False)
            val(c, LX + 94, rb + 4, d.get("prot_" + zk, ""), 8, center_w=22)
        micro(c, LX + 32, rb - 5, hints.get(zname, ""), GREY, 4.1)
        top = rb - (ZROW - ZH)
    cur = top
    yb = micro_wrap(c, LX, cur - 4, SPEC["defense"].get("zone_micro", ""), LW, GREY, 4.2, 5.0, 3)
    yb = micro_wrap(c, LX, yb - 6, WSPEC.get("micro", ""), LW, GREY, 4.2, 5.0, 4)
    cur = yb - 4

    # ---------- LOAD / STRAIN, DYING ----------
    ly3 = cur - 15
    box(c, LX, ly3, 100, 15, ROW); val(c, LX + 3, ly3 + 4.5, "LOAD / LOAD STRAIN", 6.2, TEAL)
    box(c, LX + 104, ly3, 36, 15); box(c, LX + 144, ly3, 34, 15)
    if F: field(c, "load", LX + 106, ly3 + 1.5, 32, 12, 8); field(c, "strain", LX + 146, ly3 + 1.5, 30, 12, 8)
    elif d: val(c, LX + 104, ly3 + 4, d.get("load", ""), 8, center_w=36); val(c, LX + 144, ly3 + 4, d.get("strain", ""), 8, EMBER, center_w=34)
    yb = micro_wrap(c, LX, ly3 - 6, SPEC["defense"].get("ladder_micro", ""), LW, GREY, 4.2, 5.0, 2)
    DSPEC = SPEC.get("dying", {"label": "DYING (1 to 5)", "micro": ""})
    ly3 = yb - 19
    box(c, LX, ly3, 100, 15, ROW); val(c, LX + 3, ly3 + 4.5, DSPEC["label"], 6.2, TEAL)
    box(c, LX + 104, ly3, 74, 15)
    if F: field(c, "dying", LX + 106, ly3 + 1.5, 70, 12, 8)
    elif d: val(c, LX + 104, ly3 + 4, d.get("dying", ""), 8, EMBER, center_w=74)
    yb = micro_wrap(c, LX, ly3 - 6, DSPEC.get("micro", ""), LW, GREY, 4.2, 5.0, 2)
    cur = yb - 4

    # ---------- VIGOR + SPENT ----------
    hy = cur - 14
    section(c, LX, hy, LW, SPEC["hp"]["label"], SPEC["hp"]["micro"], micro_x=LX + 34)
    keys = ["vigor_max", "vigor_cur", "vigor_tmp"]
    xs, wds = [0, 48, 108], [44, 56, 40]
    BH = 24
    for i, (lab, key) in enumerate(zip(SPEC["hp"]["boxes"], keys)):
        x0 = LX + xs[i]
        box(c, x0, hy - 4 - BH, wds[i], BH); hdr_txt(c, x0 + 2, hy - 10, lab, 5.4)
        if F: field(c, key, x0 + 3, hy - 4 - BH + 2, wds[i] - 6, 18, 12)
        elif d and d.get(key): val(c, x0, hy - 4 - BH + 7, d[key], 14, EMBER if key == "vigor_max" else INK, center_w=wds[i])
    sx = LX + 152
    hdr_txt(c, sx, hy - 10, SPEC["hp"].get("spent_label", "SPENT"), 5.4, EMBER)
    tick(c, "spent", sx + 6, hy - 4 - BH + 5, 12, F, d.get("spent"))
    yb = micro_wrap(c, LX, hy - 4 - BH - 7, SPEC["hp"].get("spent_micro", ""), LW, GREY, 4.2, 5.0, 2)
    cur = yb - 4

    # ---------- MOVEMENT: SPEED / STEP / RUSH / LEAP ----------
    SI = SPEC["speed_init"]
    my = cur - 20
    mv = [(SI["speed_label"], "speed"), (SI.get("step_label", "STEP"), "step"), (SI.get("rush_label", "RUSH"), "rush"), (SI.get("leap_label", "LEAP"), "leap")]
    cw = (LW - 6) / 4.0
    for i, (lab, key) in enumerate(mv):
        x0 = LX + i * (cw + 2)
        box(c, x0, my, cw, 20, ROW); val(c, x0 + 3, my + 13.5, lab, 5.6, TEAL)
        box(c, x0 + 3, my + 2, cw - 6, 10, white, GREY, 0.6)
        if F: field(c, key, x0 + 4, my + 2.5, cw - 8, 9, 7)
        elif d: val(c, x0 + 3, my + 4, str(d.get(key, "")), 7.2, center_w=cw - 6)
    yb = micro_wrap(c, LX, my - 6, SI.get("move_micro", ""), LW, GREY, 4.2, 5.0, 3)
    cur = yb - 4

    # ---------- ACTIONS: six a round, a reserved mark, and Pass ----------
    ASP = SPEC.get("actions", {"label": "ACTIONS", "micro": "", "reserved_label": "RESERVED", "pass_micro": ""})
    ay2 = cur - 16
    box(c, LX, ay2, 40, 16, ROW); val(c, LX + 3, ay2 + 5, ASP["label"], 6.2, TEAL)
    for i in range(6):
        tick(c, f"act{i+1}", LX + 44 + i * 13, ay2 + 3, 10, F, d.get("actions_spent", 0) > i)
    box(c, LX + 124, ay2, 54, 16, ROW); micro(c, LX + 127, ay2 + 10.5, ASP.get("reserved_label", "RESERVED"), TEAL, 4.6)
    box(c, LX + 152, ay2 + 2, 24, 12, white, GREY, 0.6)
    if F: field(c, "reserved", LX + 153, ay2 + 2.5, 22, 11, 7.5)
    elif d: val(c, LX + 152, ay2 + 5, str(d.get("reserved", "")), 7.5, center_w=24)
    yb = micro_wrap(c, LX, ay2 - 6, ASP.get("micro", ""), LW, TEAL, 4.2, 5.0, 1)
    yb = micro_wrap(c, LX, yb - 5.4, ASP.get("pass_micro", ""), LW, GREY, 4.2, 5.0, 3)
    cur = yb - 4

    # ---------- INITIATIVE ----------
    iy = cur - 16
    box(c, LX, iy, 84, 16, ROW); val(c, LX + 4, iy + 5, SI["init_label"], 7.2, TEAL); box(c, LX + 50, iy + 1, 32, 14)
    if F: field(c, "init", LX + 51, iy + 2, 30, 12, 9)
    elif d: val(c, LX + 50, iy + 5, d["init"], 9, center_w=32)
    yb = micro_wrap(c, LX + 88, iy + 10, SI["init_micro"], LW - 88, GREY, 4.2, 5.0, 3)
    left_bottom = min(iy, yb) - 2

    # ================= RIGHT COLUMN =================
    # ---------- TALENT CONSTELLATIONS ----------
    ty = y0
    section(c, RX, ty, RW, SPEC["trees"]["label"], SPEC["trees"]["micro"])
    cols = list(zip(SPEC["trees"]["cols"], [22, 130, 52, 30, 64, 90]))
    cx = RX
    for nm, wd in cols: hdr_txt(c, cx + 2, ty - 10, nm, 5.8, GREY); cx += wd
    rows = SPEC["trees"]["rows"]; rh = 13.5; ry = ty - 14
    for r in range(rows):
        cx = RX; ry -= rh
        c.setFillColor(ROW if r % 2 else white); c.rect(RX, ry, RW, rh, fill=1, stroke=0)
        for i, (nm, wd) in enumerate(cols):
            box(c, cx, ry, wd, rh, None, RULE, 0.5)
            key = f"t{r}_{nm.lower()}"
            if i == 0:
                if F: checkbox(c, key, cx + 6, ry + 2.5, 9.5)
                else:
                    box(c, cx + 6, ry + 2.5, 9.5, 9.5, white, TEAL, 0.9)
                    if d and r < len(d["trees"]) and d["trees"][r][0]: spark_star(c, cx + 10.7, ry + 6.8, 3.4)
            else:
                if F: field(c, key, cx + 2, ry + 1.5, wd - 4, rh - 3, 7)
                elif d and r < len(d["trees"]):
                    v = d["trees"][r][i]
                    val(c, cx + 3, ry + 4, v, 6.8 if i == 1 else 6.5, INK if i < 5 else EMBER, bold=(i in (1, 5)))
            cx += wd
    fy = micro_wrap(c, RX, ry - 7, SPEC["trees"]["foot1"], RW, GREY, 5.0, 5.8, 2)
    fy = micro_wrap(c, RX, fy - 6.5, SPEC["trees"]["foot2"], RW, GREY, 5.0, 5.8, 2)

    # ---------- MELEE / RANGED ----------
    MR = SPEC.get("melee_ranged", {"melee_label": "MELEE", "ranged_label": "RANGED", "cols": ["RANK", "PROF", "SPEC"], "micro": ""})
    mry = fy - 24
    for gi, (lab, gkey) in enumerate([(MR["melee_label"], "melee"), (MR["ranged_label"], "ranged")]):
        gx = RX + gi * 196
        box(c, gx, mry, 46, 15, ROW); val(c, gx + 3, mry + 4.5, lab, 6.6, TEAL)
        cws = [58, 34, 34]
        xx = gx + 48
        for ci, (cl, cwd) in enumerate(zip(MR["cols"], cws)):
            micro(c, xx + 2, mry + 17, cl, GREY, 4.4)
            box(c, xx, mry, cwd, 15)
            fkey = f"{gkey}_{cl.lower()}"
            if F: field(c, fkey, xx + 2, mry + 1.5, cwd - 4, 12, 7.5)
            elif d: val(c, xx, mry + 4.5, str(d.get(fkey, "")), 7.2, INK if ci else TEAL, center_w=cwd)
            xx += cwd + 2
    yb = micro_wrap(c, RX, mry - 6, MR.get("micro", ""), RW, GREY, 4.4, 5.2, 2)

    # ---------- STRIKES ----------
    AT = SPEC["attacks"]
    ky = yb - 18
    section(c, RX, ky, RW, AT["label"])
    yb = micro_wrap(c, RX, ky - 7, AT["micro"], RW, GREY, 4.4, 5.2, 2)
    names = list(AT["cols"])
    names.insert(2, AT.get("strike_attr_label", "STRIKE ATTR"))  # the per-weapon Strike Attribute
    acols = list(zip(names, [66, 58, 54, 32, 58, 120]))
    hy2 = yb - 8
    cx = RX
    for nm, wd in acols: hdr_txt(c, cx + 2, hy2, nm, 5.4, GREY); cx += wd
    ay3 = hy2 - 2
    for r in range(AT["rows"]):
        cx = RX; ay3 -= 16
        for i, (nm, wd) in enumerate(acols):
            box(c, cx, ay3, wd, 16, ROW if r % 2 else white, RULE, 0.5)
            key = f"a{r}_{i}"
            if F: field(c, key, cx + 2, ay3 + 2, wd - 4, 12, 7)
            elif d and r < len(d["attacks"]): val(c, cx + 3, ay3 + 5, d["attacks"][r][i], 5.6 if i == 5 else 6.2, INK, bold=(i == 0))
            cx += wd

    # ---------- REACTIONS ----------
    RS = SPEC.get("reactions", {"label": "REACTIONS", "micro": "", "items": []})
    rky = ay3 - 18
    section(c, RX, rky, RW, RS["label"], RS.get("micro", ""), h=11, size=6.6)
    ry2 = rky
    avail = d.get("reactions", {})
    for name, desc in RS["items"]:
        ry2 -= 10.5
        rk = name.split()[0].lower()
        tick(c, "react_" + rk, RX + 2, ry2 + 1, 8.5, F, avail.get(rk))
        val(c, RX + 14, ry2 + 2.5, name, 6.2, TEAL)
        micro(c, RX + 60, ry2 + 2.5, desc, GREY, 4.2)

    # ---------- BIND ----------
    BS = SPEC.get("bind", {"label": "BIND", "states": ["neutral", "controlling", "controlled"], "mine_label": "mine", "theirs_label": "theirs", "micro": ""})
    by2 = ry2 - 20
    box(c, RX, by2, 34, 15, ROW); val(c, RX + 3, by2 + 4.5, BS["label"], 6.6, TEAL)
    xx = RX + 38
    for st in BS["states"]:
        tick(c, "bind_" + st, xx, by2 + 3, 9, F, d.get("bind") == st)
        micro(c, xx + 11, by2 + 5, st, INK, 5.6); xx += 15 + swidth(st, "Helvetica", 5.6) + 8
    for lab, key, wd in [(BS.get("mine_label", "mine"), "bind_mine", 92), (BS.get("theirs_label", "theirs"), "bind_theirs", 70)]:
        micro(c, xx, by2 + 17, lab, GREY, 4.4)
        box(c, xx, by2, wd, 15)
        if F: field(c, key, xx + 2, by2 + 1.5, wd - 4, 12, 7)
        elif d: val(c, xx + 3, by2 + 4.5, d.get(key, ""), 6.5, INK, bold=False)
        xx += wd + 6
    yb = micro_wrap(c, RX, by2 - 6, BS.get("micro", ""), RW, GREY, 4.2, 5.0, 2)

    # ---------- TALENTS ----------
    vy = yb - 16
    section(c, RX, vy, RW, SPEC["talents"]["label"], SPEC["talents"]["micro"])
    ly = vy - 3
    for i in range(SPEC["talents"]["rows"]):
        ly -= 13
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(RX, ly, RX + RW, ly)
        if F: field(c, f"talent{i}", RX + 1, ly + 1.5, RW - 2, 11, 7)
        elif d and i < len(d["talents"]): val(c, RX + 2, ly + 3.5, d["talents"][i], 6.5, INK, bold=False)
    # hero points
    by = ly - 22
    box(c, RX, by, 118, 18, PAPER, GOLD, 1); val(c, RX + 4, by + 5.5, SPEC["banked"]["label"], 7, TEAL)
    if F: field(c, "banked", RX + 78, by + 2, 36, 14, 9)
    elif d: val(c, RX + 78, by + 5, d["banked"], 9, EMBER, center_w=36)
    micro(c, RX + 124, by + 9, SPEC["banked"]["micro1"], GREY, 5)
    micro(c, RX + 124, by + 3, SPEC["banked"]["micro2"], GREY, 5)
    right_bottom = by - 2

    # ---------- reference strip ----------
    fh = draw_footer(c)
    low = min(left_bottom, right_bottom)
    if low < fh + 2:
        raise SystemExit("sheet_gen: page 1 overruns the reference strip by %.1f pt (left %.1f, right %.1f, strip top %.1f)"
                         % (fh + 2 - low, left_bottom, right_bottom, fh))
    return left_bottom, right_bottom, fh


def page2(c, d=None, fillable=False):
    F = bool(fillable)
    P2 = SPEC["page2"]
    c.setFillColor(INK); c.rect(0, H - 36, W, 36, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 12); c.setFillColor(GOLD); c.drawString(M, H - 25, "STARWROUGHT")
    c.setFont("Helvetica-Bold", 9); c.setFillColor(white); c.drawString(M + 108, H - 24, P2["header"])
    y = H - 58
    section(c, M, y, W - 2 * M, P2["details_label"])
    ly = y - 4
    # The example sheet's details are wrapped to the row and the block grows to hold them; the
    # fillable sheet keeps its 16 fields. The footer guard below catches a list that outgrows the page.
    lines = []
    if d:
        for t in d["details"]:
            lines += wrap_lines(t, W - 2 * M - 4, "Helvetica", 7.2)
    rows = 16 if F else max(16, len(lines))
    for i in range(rows):
        ly -= 16.5
        c.setStrokeColor(RULE); c.setLineWidth(0.5); c.line(M, ly, W - M, ly)
        if F: field(c, f"detail{i}", M + 1, ly + 1, W - 2 * M - 2, 14, 8)
        elif d and i < len(lines): val(c, M + 2, ly + 4, lines[i], 7.2, INK, bold=False)
    gy = ly - 22
    section(c, M, gy, 260, P2["gear_label"], size=7.6)
    section(c, M + 276, gy, W - 2 * M - 276, P2["notes_label"], size=7.6)
    ly2 = gy - 4
    for i in range(6):
        ly2 -= 16
        c.setStrokeColor(RULE); c.line(M, ly2, M + 260, ly2); c.line(M + 276, ly2, W - M, ly2)
        if F:
            field(c, f"gear{i}", M + 1, ly2 + 1, 258, 13, 8); field(c, f"note{i}", M + 277, ly2 + 1, W - 2 * M - 278, 13, 8)
        elif d:
            if i < len(d["gear"]): val(c, M + 2, ly2 + 4, d["gear"][i], 7.4, INK, bold=False)
            if i < len(d["notes"]): val(c, M + 278, ly2 + 4, d["notes"][i], 7.4, INK, bold=False)
    sy = ly2 - 24
    section(c, M, sy, W - 2 * M, P2["log_label"], P2["log_micro"])
    scols = list(zip(P2["log_cols"], [56, 110, 300, 86]))
    ry = sy - 14
    for r in range(8):
        cx = M; ry -= 16
        for i, (nm, wd) in enumerate(scols):
            if r == 0: hdr_txt(c, cx + 2, sy - 10, nm, 5.8, GREY)
            box(c, cx, ry, wd, 16, ROW if r % 2 else white, RULE, 0.5)
            if F: field(c, f"log{r}_{i}", cx + 2, ry + 1.5, wd - 4, 13, 7.5)
            elif d and r < len(d["log"]): val(c, cx + 3, ry + 5, d["log"][r][i], 6.9, INK, bold=False)
            cx += wd
    if ry < 28:
        raise SystemExit("sheet_gen: page 2 overruns the footer by %.1f pt (%d detail rows)" % (28 - ry, rows))
    c.setFillColor(PAPER); c.rect(0, 0, W, 26, fill=1, stroke=0)
    micro(c, M, 12, P2["footer"], TEAL, 5.6)
    c.setFont("Helvetica", 5.4); c.setFillColor(GREY); c.drawRightString(W - M, 10, "STARWROUGHT " + META["version"] + " - page 2")


def build(path, d=None, fillable=False):
    c = canvas.Canvas(path, pagesize=letter)
    c.setTitle("STARWROUGHT Character Sheet" + ("" if fillable else " - " + (d or {}).get("name", "")))
    geometry = page1(c, d, fillable); c.showPage(); page2(c, d, fillable); c.save()
    return geometry


# Mira of the Long Road: a 1st-level Human ambusher, built under the v4.10 rules with v4.11's Vigor.
#   Granted: Melee Training. Origin roots: Humanity, Versatile Human, Reacher. Versatile Human's Opening
#   point opened Dueling. Background (Acrobat): Athletics, Acrobatics, Lore (Circus). Calling: Sneak
#   Attack, which brought Stealth Training. Defenses: Evade and Awareness. Comets: Driven (a Calling
#   point, spent on Surprise Attacker), Kip Up, Skirmisher's Step. 16 Talents.
#   Attribute points: Agility 8 (+2), Wits 4 (+1), Might 2 (+0), Presence 2 (+0); points / 4.
#   Checks: d20 + Attribute + Proficiency (Trained +3), no level. Vigor 10 + Ambusher Opening 8 + Human 8 = 26
#   (v4.11: the Opening Vigor once, the Ancestry's Vigor plus the Endure Bonus every level; hers is 0, Untrained).
MIRA = dict(
    name="Mira of the Long Road", ancestry="Human / Versatile Human", culture="Kestrel Reach",
    background="Acrobat / Ambusher",
    level="1", milestones=0,
    might="+0", might_pts="2", agility="+2", agility_pts="8", wits="+1", wits_pts="4", presence="+0", presence_pts="2",
    awareness="+4", awareness_th="14", evade="+5", evade_th="15",
    guard="+0", guard_th="10", endure="+0", endure_th="10",
    armor_head="Leather cap", prot_head="2",
    armor_torso="Leather cuirass", prot_torso="3",
    armor_arms="Leather bracers", prot_arms="2",
    armor_legs="Leather leggings", prot_legs="2",
    wounds_head=0, wounds_torso=0, wounds_arms=0, wounds_legs=0,
    load="0", strain="0", dying="0", spent=False,
    vigor_max="26", vigor_cur="26", vigor_tmp="",
    speed="6 ft", step="3 ft", rush="30 ft", leap="10 ft", init="+4",
    actions_spent=0, reserved="",
    melee_rank="Trained", melee_prof="+3", melee_spec="-",
    ranged_rank="Untrained", ranged_prof="+0", ranged_spec="-",
    # Counter ❶↺ is granted at Expert rank in Melee (ruling 63); Mira is Trained, so only Intercept.
    reactions={"parry": False, "void": True, "counter": False, "intercept": True},
    bind="", bind_mine="", bind_theirs="",
    trees=[
        (False, "Origin (Human, Versatile, Reacher)", "-", "4", "Trained", "+3 prof"),
        (False, "Ambusher (Calling)", "Agility", "2", "Trained", "+5"),
        (False, "Melee (parent)", "Might", "1 (+1)", "Trained", "+3 atk"),
        (False, "Dueling (Combat Style, Melee)", "Agility", "1", "Trained", "+5"),
        (False, "Acrobatics", "Agility", "2", "Trained", "+5"),
        (False, "Athletics", "Might", "1", "Trained", "+3"),
        (False, "Stealth", "Agility", "1", "Trained", "+5"),
        (False, "Lore (Circus)", "Wits", "1", "Trained", "+4"),
        (False, "Awareness (Defense)", "Wits", "1", "Trained", "+4"),
        (False, "Evade (Defense)", "Agility", "2", "Trained", "+5"),
        (False, "Guard (Defense)", "Presence", "0", "Untrained", "+0"),
        (False, "Endure (Defense)", "Might", "0", "Untrained", "+0"),
    ],
    attacks=[
        ("Rapier", "Dueling", "Agility +2", "+5", "1d8 P", "Finesse, Deadly d8, Parry; Reach 4 ft"),
        ("Dagger", "Dueling / thrown", "Agility +2", "+5 / +0", "1d4 P", "Agile (❶ may crit), Close, Finesse, Thrown 10"),
        ("Unarmed", "no style", "Agility +2", "+5", "1d4 B", "Agile, Close, Finesse, Nonlethal; Adjacent"),
    ],
    talents=[
        "GRANTED FREE: Melee Training (brings the Intercept ❶↺ Reaction; Counter ❶↺ arrives at Expert)",
        "ORIGIN (3 Origin points, one per choice): Humanity, Versatile Human, Reacher",
        "Versatile Human - 1 Opening Talent Point (spent on Dueling Training)",
        "Driven (Comet) - a Calling Talent Point, which bought Surprise Attacker",
        "Sneak Attack (Calling point) - +1d6 precision vs Off-Guard foes; brought Stealth Training",
        "Surprise Attacker - round 1, foes that have not acted are Wrong-Footed to you",
        "Evade Training and Awareness Training (2 Defense points) - Void ❶↺ and the Give Ground ⓿↺ Posture",
        "Skirmisher's Step (Comet) - your Steps ignore difficult terrain",
        "Kip Up (Comet) - Stand ❶ without triggering Reactions",
        "Background: Trained in Athletics, Acrobatics, and Lore (Circus). 14 minimum, 16 spent.",
    ],
    banked="1 / 3",
    details=[
        "Chargen v4.10: Melee Training granted, then 13 points: 3 Origin (the three roots), 3 Skill (one is the Calling's), 1 Lore, 1 Calling, 2 Defense, 3 Comets.",
        "Versatile Human's Opening point bought Dueling Training and Driven's Calling point bought Surprise Attacker: 14 minimum, 16 Talents.",
        "Attributes are points / 4: Agility 8 = +2, Wits 4 = +1, Might 2 and Presence 2 = +0. No level on any die: Trained is +3, and a check is d20 + Attribute + Proficiency. Thresholds are 10 + the same.",
        "Humanity (Human T): +1 Condition bonus on checks to Aid. +2 at Expert, +3 at Master, +4 at Legendary.",
        "Versatile Human (Bloodline, Wits): 1 Opening Talent Point, which opened Dueling.",
        "Reacher (Kestrel Reach T, Wits): Reachspeak and Common, and +1 Condition to Diplomacy toward Reach folk, scaling with the Origin Constellation.",
        "Sneak Attack (Ambusher T): +1d6 precision damage against Off-Guard foes, and Training in Stealth. Precision rides on a Quick Strike ❶ too, and never on a Graze.",
        "Surprise Attacker (Ambusher T): in the first round, foes that have not acted yet are Wrong-Footed to you.",
        "DEFENSES: Evade and Awareness Trained; between them they answer Blows, Blasts, Blights and Beguilement. Guard and Endure Untrained: Attribute only (+0), Threshold 10. With the rapier in hand, Guard is +1 / Threshold 11 against melee Attacks: the Parry trait is a +1 Gear bonus.",
        "REACTIONS: Void ❶↺ (Evade +2; Stopped: Step) and Intercept ❶↺ from Melee Training; Counter ❶↺ waits for Expert in Melee. No Parry Reaction without Guard Training; the rapier's Parry trait still adds its +1 Gear to Guard. Posture: Give Ground ⓿↺ (Evade +2, a Zone Exposed until the end of the round).",
        "STRIKE ATTRIBUTE: rapier and dagger are Finesse and Dueling's Key Attribute is Agility, so Agility +2 either way. A thrown dagger rolls Ranged (Untrained, +0) with Might (+0).",
        "STRIKES: ❶ Quick 1d8 (+1d6 Sneak Attack if the foe is Off-Guard), Torso, no crit. ❷ Deliberate 1d8 + 0 Might, may take an Exposed Zone; a Miss Exposes her. ❸ Committed: Prepared and Weighted.",
        "MATCHED HARNESS: four leather pieces, same material and Protection, so the Torso gets +1 Protection and Load Strain drops to 0. Leather turns slashing poorly: -1 Protection against it.",
        "MOVEMENT: Speed 6 ft per Move ❶; Step ❶ 3 ft; Rush ❸ 30 ft in a straight line; Leap ❶ 10 ft. Skirmisher's Step: her Steps ignore difficult terrain.",
        "VIGOR 26 = 10 + Ambusher Opening 8 (once) + Human 8; +8 per level (Human 8 + Endure Bonus 0 while Endure is Untrained). A night's rest restores level x Presence, minimum the level (1). At 0 she is Spent: every Hit Wounds.",
        "GOALS: Flare Dueling with a critical Feint. Grow Ambusher with Milestone points.",
    ],
    gear=["Full leather harness, cap to leggings (9 gp)", "Rapier and juggling knives",
          "Chalk, sash, climbing kit", "Circus poster of her old troupe"],
    notes=["Common, Reachspeak", "Agility +2, Wits +1; Might and Presence +0: an acrobat through and through",
           "Leather turns slashing poorly: -1 Protection against it on every Zone"],
    log=[("1", "-", "Created via chargen v4.10: Melee Training free, three Origin roots, sixteen Talents", "-")],
)

if __name__ == "__main__":
    g1 = build("Starwrought_Character_Sheet_Fillable.pdf", None, fillable=True)
    g2 = build("Mira_Character_Sheet.pdf", MIRA, fillable=False)
    print("sheets written (glyph font: %s; page 1 columns end at %.0f / %.0f pt, reference strip %.0f pt tall)"
          % (GLYPH_FONT or "none, ASCII fallback", g2[0], g2[1], g2[2]))
