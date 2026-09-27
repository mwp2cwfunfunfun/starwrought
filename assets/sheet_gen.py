# STARWROUGHT character sheet generator — blank fillable + Torva example (Playtest v1.0)
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "sheet_spec.json")))
META = SPEC["meta"]

INK = HexColor("#1D2A32"); TEAL = HexColor("#0E5F6B"); EMBER = HexColor("#E2703A")
GOLD = HexColor("#D9A441"); PAPER = HexColor("#F4EFE6"); GREY = HexColor("#8AA0A8"); ROW = HexColor("#F2F0EA")
W, H = letter  # 612 x 792
M = 30

def hdr_txt(c, x, y, t, size=8, col=TEAL, bold=True):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size); c.setFillColor(col); c.drawString(x, y, t)

def micro(c, x, y, t, col=GREY, size=5.4):
    c.setFont("Helvetica", size); c.setFillColor(col); c.drawString(x, y, t)

def micro_wrap(c, x, y, t, w, col=GREY, size=5.4, lead=6.2, maxlines=3):
    """Same as micro(), but broken to fit width w. Long footnotes used to run off the page."""
    c.setFont("Helvetica", size); c.setFillColor(col)
    words, line, out = t.split(), "", []
    for wd in words:
        trial = (line + " " + wd).strip()
        if c.stringWidth(trial, "Helvetica", size) <= w:
            line = trial
        else:
            out.append(line); line = wd
            if len(out) == maxlines: break
    if line and len(out) < maxlines: out.append(line)
    for i, ln in enumerate(out): c.drawString(x, y - i * lead, ln)
    return y - (len(out) - 1) * lead

def box(c, x, y, w, h, fill=None, stroke=GREY, lw=0.8):
    c.setLineWidth(lw); c.setStrokeColor(stroke)
    if fill: c.setFillColor(fill); c.rect(x, y, w, h, fill=1, stroke=1)
    else: c.rect(x, y, w, h, fill=0, stroke=1)

def val(c, x, y, t, size=9, col=INK, bold=True, center_w=None):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size); c.setFillColor(col)
    if center_w: c.drawCentredString(x + center_w / 2, y, t)
    else: c.drawString(x, y, t)

def field(c, name, x, y, w, h, size=9, tooltip=""):
    c.acroForm.textfield(name=name, x=x, y=y, width=w, height=h, fontSize=size,
                         borderWidth=0, fillColor=None, textColor=INK, tooltip=tooltip or name,
                         fieldFlags="doNotScroll")

def checkbox(c, name, x, y, s=9):
    c.acroForm.checkbox(name=name, x=x, y=y, size=s, borderWidth=1, borderColor=TEAL,
                        fillColor=white, textColor=EMBER, buttonStyle="cross")

def spark_star(c, x, y, r=3.2, col=GOLD):
    c.setFillColor(col); c.setStrokeColor(col); c.setLineWidth(1)
    for dx, dy in ((r,0),(-r,0),(0,r),(0,-r)): c.line(x, y, x+dx, y+dy)
    for dx, dy in ((r*.55,r*.55),(-r*.55,r*.55),(r*.55,-r*.55),(-r*.55,-r*.55)): c.line(x, y, x+dx, y+dy)

def page1(c, d=None, fillable=False):
    F = bool(fillable)
    # header band
    c.setFillColor(INK); c.rect(0, H-52, W, 52, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 24); c.setFillColor(GOLD); c.drawString(M, H-38, META["title"])
    c.setFont("Helvetica-Bold", 11); c.setFillColor(white); c.drawString(M+206, H-36, META["subtitle"])
    c.setFont("Helvetica", 7.5); c.setFillColor(GREY); c.drawRightString(W-M, H-36, META["version"] + "  •  " + META["tagline"])
    spark_star(c, M+192, H-32, 4.5)

    # identity row
    y = H-86
    geo = [(M,170),(M+178,128),(M+314,92),(M+414,92)]
    ids = [(SPEC["identity"][i]["label"], geo[i][0], geo[i][1], SPEC["identity"][i]["key"]) for i in range(4)]
    for label, x, w, key in ids:
        box(c, x, y, w, 20); hdr_txt(c, x, y+23, label, 6.2)
        if F: field(c, key, x+2, y+2, w-4, 16)
        elif d: val(c, x+4, y+6, d[key], 8.6)
    # level + milestones
    bx = M+514
    box(c, bx, y, 34, 20); hdr_txt(c, bx, y+23, SPEC["level_label"], 6.2)
    if F: field(c, "level", bx+2, y+2, 30, 16, 11)
    elif d: val(c, bx, y+5, d["level"], 11, center_w=34)
    hdr_txt(c, M, y-16, SPEC["milestones"]["label"], 6.2)
    for i in range(4):
        mx = M+96+i*30
        if F: checkbox(c, f"milestone{i+1}", mx, y-21, 10)
        else:
            box(c, mx, y-21, 10, 10)
            if d and d["milestones"] > i: val(c, mx+2, y-19, "X", 8, EMBER)
        micro(c, mx+12, y-18, SPEC["milestones"]["slots"][i], TEAL if i < 3 else EMBER, 5.6)
    micro(c, M+230, y-18, SPEC["milestones"]["micro"], GREY)

    LX, LW = M, 178          # left column
    RX, RW = M+192, W-2*M-192  # right column
    # ---------- ATTRIBUTES ----------
    y0 = y-40
    c.setFillColor(TEAL); c.rect(LX, y0, LW, 13, fill=1, stroke=0)
    val(c, LX+4, y0+3.5, SPEC["attributes"]["label"], 8, white); micro(c, LX+62, y0+4, SPEC["attributes"]["micro"], white, 5)
    labels = list(zip(SPEC["attributes"]["rows"], ["might","agility","wits","presence"]))
    ay = y0-26
    for name, key in labels:
        box(c, LX, ay, 92, 22, ROW); val(c, LX+4, ay+7.5, name, 8.4, TEAL)
        box(c, LX+96, ay, 36, 22)          # score
        box(c, LX+136, ay, 42, 22)         # tag pts
        micro(c, LX+98, ay+24, SPEC["attributes"]["cols"][0], GREY, 4.8); micro(c, LX+138, ay+24, SPEC["attributes"]["cols"][1], GREY, 4.8)
        if F: field(c, key, LX+98, ay+2, 32, 18, 11); field(c, key+"_pts", LX+138, ay+2, 38, 18, 9)
        elif d: val(c, LX+96, ay+6, d[key], 11, center_w=36); val(c, LX+136, ay+6, d[key+"_pts"], 9, GREY, center_w=42)
        ay -= 27
    # ---------- DEFENSES ----------
    # v3.0: four Defenses, each a check you roll and a Threshold others are measured against.
    # Armor sits below them and never touches them; it subtracts Protection from damage, per Zone.
    dy = ay-8
    c.setFillColor(TEAL); c.rect(LX, dy, LW, 13, fill=1, stroke=0); val(c, LX+4, dy+3.5, SPEC["defense"]["label"], 8, white)
    micro(c, LX, dy-8, SPEC["defense"]["ac_micro"], GREY, 4.6)
    DKEYS = ["awareness", "evade", "guard", "endure"]
    defs = SPEC["defense"].get("defenses") or SPEC["defense"]["saves"]
    micro(c, LX+104, dy-16, "CHECK", GREY, 4.8); micro(c, LX+146, dy-16, "THRESH", GREY, 4.8)
    sy = dy-14
    for i, row in enumerate(defs):
        nm, form = row[0], row[1]
        gloss = row[2] if len(row) > 2 else ""
        key = DKEYS[i] if i < len(DKEYS) else "def%d" % i
        box(c, LX, sy-19, 100, 17, ROW); val(c, LX+3, sy-10.5, nm, 6.8, TEAL)
        micro(c, LX+3, sy-17, gloss or form, GREY, 4.3)
        box(c, LX+104, sy-19, 36, 17); box(c, LX+144, sy-19, 34, 17)
        if F:
            field(c, key, LX+106, sy-17, 32, 13, 9)
            field(c, key+"_th", LX+146, sy-17, 30, 13, 9)
        elif d:
            val(c, LX+104, sy-14.5, d.get(key, ""), 9, center_w=36)
            val(c, LX+144, sy-14.5, d.get(key+"_th", ""), 9, EMBER, center_w=34)
        sy -= 21
    # ---------- ARMOR BY ZONE ----------
    zy = sy-16   # clear of the last Defense row's box and its gloss line
    c.setFillColor(TEAL); c.rect(LX, zy, LW, 11, fill=1, stroke=0)
    val(c, LX+4, zy+2.8, SPEC["defense"].get("armor_label", "ARMOR BY ZONE"), 6.6, white)
    micro(c, LX+120, zy-8, "PROT", GREY, 4.6); micro(c, LX+152, zy-8, "EXPOSED", GREY, 4.6)
    ZKEYS = SPEC["defense"].get("zones", ["HEAD", "TORSO", "ARMS", "LEGS"])
    ry2 = zy-8
    for zi, zname in enumerate(ZKEYS):
        zk = zname.lower()
        ry2 -= 15
        box(c, LX, ry2, 32, 14, ROW); val(c, LX+3, ry2+4.5, zname, 5.8, TEAL)
        box(c, LX+34, ry2, 82, 14); box(c, LX+118, ry2, 26, 14)
        if F:
            field(c, "armor_"+zk, LX+36, ry2+1.5, 78, 11, 7)
            field(c, "prot_"+zk, LX+120, ry2+1.5, 22, 11, 8)
            checkbox(c, "exposed_"+zk, LX+154, ry2+2, 10)
        else:
            box(c, LX+154, ry2+2, 10, 10, white, TEAL, 0.9)
            if d:
                val(c, LX+37, ry2+4, d.get("armor_"+zk, ""), 6.4, INK, bold=False)
                val(c, LX+118, ry2+4, d.get("prot_"+zk, ""), 8, center_w=26)
                if d.get("exposed_"+zk): val(c, LX+156, ry2+4, "X", 8, EMBER)
    micro_wrap(c, LX, ry2-7, SPEC["defense"].get("zone_micro", ""), LW, GREY, 4.3, 5.2, 3)
    # ---------- LOAD / STRAIN, DYING / WOUNDED ----------
    ly3 = ry2-30   # below the wrapped zone note
    box(c, LX, ly3, 100, 15, ROW); val(c, LX+3, ly3+4.5, "LOAD / LOAD STRAIN", 6.2, TEAL)
    box(c, LX+104, ly3, 36, 15); box(c, LX+144, ly3, 34, 15)
    if F: field(c, "load", LX+106, ly3+1.5, 32, 12, 8); field(c, "strain", LX+146, ly3+1.5, 30, 12, 8)
    elif d: val(c, LX+104, ly3+4, d.get("load", ""), 8, center_w=36); val(c, LX+144, ly3+4, d.get("strain", ""), 8, EMBER, center_w=34)
    ly3 -= 18
    box(c, LX, ly3, 100, 15, ROW); val(c, LX+3, ly3+4.5, "DYING / WOUNDED", 6.2, TEAL)
    box(c, LX+104, ly3, 36, 15); box(c, LX+144, ly3, 34, 15)
    if F: field(c, "dying", LX+106, ly3+1.5, 32, 12, 8); field(c, "wounded", LX+146, ly3+1.5, 30, 12, 8)
    elif d: val(c, LX+104, ly3+4, d.get("dying", ""), 8, EMBER, center_w=36); val(c, LX+144, ly3+4, d.get("wounded", ""), 8, EMBER, center_w=34)
    yb = micro_wrap(c, LX, ly3-7, "Recovery: Endure vs 10 + level + Dying, at the start of each of your turns. Dying 5 is death.", LW, GREY, 4.3, 5.2, 2)
    yb = micro_wrap(c, LX, yb-6, SPEC["defense"].get("ladder_micro", ""), LW, GREY, 4.3, 5.2, 3)
    # ---------- HP / SPEED / INIT ----------
    hy = yb-16
    c.setFillColor(TEAL); c.rect(LX, hy, LW, 13, fill=1, stroke=0)
    val(c, LX+4, hy+3.5, SPEC["hp"]["label"], 8, white); micro(c, LX+58, hy+4, SPEC["hp"]["micro"], white, 5)
    for i,(lab,key,wd) in enumerate(zip(SPEC["hp"]["boxes"], ["hp_max","hp_cur","hp_tmp"], [52,64,52])):
        x0 = LX + [0,58,126][i]
        box(c, x0, hy-40, wd, 36); hdr_txt(c, x0+2, hy-9, lab, 5.6)
        if F: field(c, key, x0+3, hy-37, wd-6, 24, 13)
        elif d and d.get(key): val(c, x0, hy-30, d[key], 15, INK if key!="hp_max" else EMBER, center_w=wd)
    yy = hy-66
    box(c, LX, yy, 84, 20, ROW); val(c, LX+4, yy+6.5, SPEC["speed_init"]["speed_label"], 7.6, TEAL); box(c, LX+52, yy+1, 30, 18)
    box(c, LX+94, yy, 84, 20, ROW); val(c, LX+98, yy+6.5, SPEC["speed_init"]["init_label"], 7.6, TEAL); box(c, LX+146, yy+1, 30, 18)
    micro(c, LX+94, yy-6, SPEC["speed_init"]["init_micro"], GREY, 4.6)
    if F: field(c, "speed", LX+53, yy+2, 28, 15, 9); field(c, "init", LX+147, yy+2, 28, 15, 9)
    elif d: val(c, LX+52, yy+6, d["speed"], 9, center_w=30); val(c, LX+146, yy+6, d["init"], 9, center_w=30)

    # ---------- TALENT TREES (right) ----------
    ty = y0
    c.setFillColor(TEAL); c.rect(RX, ty, RW, 13, fill=1, stroke=0)
    val(c, RX+4, ty+3.5, SPEC["trees"]["label"], 8, white)
    micro(c, RX+106, ty+4, SPEC["trees"]["micro"], white, 5)
    cols = list(zip(SPEC["trees"]["cols"], [22,118,56,30,64,40]))
    cx = RX
    for nm,wd in cols: hdr_txt(c, cx+2, ty-10, nm, 5.8, GREY); cx += wd
    rows = SPEC["trees"]["rows"]; rh = 16.5; ry = ty-14
    for r in range(rows):
        cx = RX; ry -= rh
        c.setFillColor(ROW if r%2 else white); c.rect(RX, ry, RW, rh, fill=1, stroke=0)
        for i,(nm,wd) in enumerate(cols):
            box(c, cx, ry, wd, rh, None, HexColor("#D5DCE0"), 0.5)
            key = f"t{r}_{nm.lower()}"
            if i == 0:
                if F: checkbox(c, key, cx+5.5, ry+3.5, 9.5)
                else:
                    box(c, cx+5.5, ry+3.5, 9.5, 9.5, white, TEAL, 0.9)
                    if d and r < len(d["trees"]) and d["trees"][r][0]: spark_star(c, cx+10.2, ry+8.2, 3.4)
            else:
                if F: field(c, key, cx+2, ry+1.5, wd-4, rh-3, 7.5)
                elif d and r < len(d["trees"]):
                    v = d["trees"][r][i]
                    val(c, cx+3, ry+5, v, 7 if i==1 else 6.8, INK if i<5 else EMBER, bold=(i in (1,5)))
            cx += wd
    fy = micro_wrap(c, RX, ry-7, SPEC["trees"]["foot1"], RW, GREY, 5.4, 6.2, 2)
    fy = micro_wrap(c, RX, fy-7, SPEC["trees"]["foot2"], RW, GREY, 5.4, 6.2, 2)

    # ---------- ATTACKS ----------
    ky = fy-20
    c.setFillColor(TEAL); c.rect(RX, ky, RW, 13, fill=1, stroke=0)
    val(c, RX+4, ky+3.5, SPEC["attacks"]["label"], 8, white)
    micro(c, RX+56, ky+4, SPEC["attacks"]["micro"], white, 5)
    acols = list(zip(SPEC["attacks"]["cols"], [92,96,34,64,44]))
    ay2 = ky-14
    for r in range(3):
        cx = RX; ay2 -= 17
        for i,(nm,wd) in enumerate(acols):
            if r == 0: hdr_txt(c, cx+2, ky-10, nm, 5.8, GREY)
            box(c, cx, ay2, wd, 17, ROW if r%2 else white, HexColor("#D5DCE0"), 0.5)
            key = f"a{r}_{i}"
            if F: field(c, key, cx+2, ay2+2, wd-4, 13, 7.5)
            elif d and r < len(d["attacks"]): val(c, cx+3, ay2+5.5, d["attacks"][r][i], 6.8, INK, bold=(i==0))
            cx += wd
    # ---------- TALENTS ----------
    vy = ay2-12
    c.setFillColor(TEAL); c.rect(RX, vy, RW, 13, fill=1, stroke=0)
    val(c, RX+4, vy+3.5, SPEC["talents"]["label"], 8, white); micro(c, RX+50, vy+4, SPEC["talents"]["micro"], white, 5)
    ly = vy-4
    for i in range(SPEC["talents"]["rows"]):
        ly -= 15.5
        c.setStrokeColor(HexColor("#D5DCE0")); c.setLineWidth(0.5); c.line(RX, ly, RX+RW, ly)
        if F: field(c, f"talent{i}", RX+1, ly+2, RW-2, 12, 7.5)
        elif d and i < len(d["talents"]): val(c, RX+2, ly+4.5, d["talents"][i], 6.9, INK, bold=False)
    # banked points
    by = ly-24
    box(c, RX, by, 118, 18, PAPER, GOLD, 1); val(c, RX+4, by+5.5, SPEC["banked"]["label"], 7, TEAL)
    if F: field(c, "banked", RX+78, by+2, 36, 14, 9)
    elif d: val(c, RX+78, by+5, d["banked"], 9, EMBER, center_w=36)
    micro(c, RX+124, by+9, SPEC["banked"]["micro1"], GREY)
    micro(c, RX+124, by+3, SPEC["banked"]["micro2"], GREY)

    # footer strip
    c.setFillColor(PAPER); c.rect(0, 0, W, 26, fill=1, stroke=0)
    _fl = SPEC["footer"]
    for _fi, _ft in enumerate(_fl):
        micro(c, M, 8 + (len(_fl)-1-_fi)*8, _ft, TEAL, 5.6)
    c.setFont("Helvetica", 5.4); c.setFillColor(GREY); c.drawRightString(W-M, 10, "STARWROUGHT " + META["version"] + " - page 1")

def page2(c, d=None, fillable=False):
    F = bool(fillable)
    c.setFillColor(INK); c.rect(0, H-36, W, 36, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 12); c.setFillColor(GOLD); c.drawString(M, H-25, "STARWROUGHT")
    c.setFont("Helvetica-Bold", 9); c.setFillColor(white); c.drawString(M+64, H-24, "TALENT DETAILS,  GEAR  &  FLARE LOG")
    y = H-58
    c.setFillColor(TEAL); c.rect(M, y, W-2*M, 13, fill=1, stroke=0); val(c, M+4, y+3.5, "TALENT DETAILS", 8, white)
    ly = y-4
    for i in range(16):
        ly -= 16.5
        c.setStrokeColor(HexColor("#D5DCE0")); c.setLineWidth(0.5); c.line(M, ly, W-M, ly)
        if F: field(c, f"detail{i}", M+1, ly+1, W-2*M-2, 14, 8)
        elif d and i < len(d["details"]): val(c, M+2, ly+4, d["details"][i], 7.4, INK, bold=False)
    gy = ly-22
    c.setFillColor(TEAL); c.rect(M, gy, 260, 13, fill=1, stroke=0); val(c, M+4, gy+3.5, "GEAR (no math - stories and properties)", 7.6, white)
    c.setFillColor(TEAL); c.rect(M+276, gy, W-2*M-276, 13, fill=1, stroke=0); val(c, M+280, gy+3.5, "LANGUAGES & NOTES", 7.6, white)
    ly2 = gy-4
    for i in range(6):
        ly2 -= 16
        c.setStrokeColor(HexColor("#D5DCE0")); c.line(M, ly2, M+260, ly2); c.line(M+276, ly2, W-M, ly2)
        if F:
            field(c, f"gear{i}", M+1, ly2+1, 258, 13, 8); field(c, f"note{i}", M+277, ly2+1, W-2*M-278, 13, 8)
        elif d:
            if i < len(d["gear"]): val(c, M+2, ly2+4, d["gear"][i], 7.4, INK, bold=False)
            if i < len(d["notes"]): val(c, M+278, ly2+4, d["notes"][i], 7.4, INK, bold=False)
    sy = ly2-24
    c.setFillColor(TEAL); c.rect(M, sy, W-2*M, 13, fill=1, stroke=0)
    val(c, M+4, sy+3.5, "FLARE LOG", 8, white); micro(c, M+62, sy+4, "what ignited each constellation - the story of your build, one crit at a time", white, 5)
    scols = [("SESSION",56),("TREE",110),("WHAT IGNITED IT",300),("SPENT?",86)]
    ry = sy-14
    for r in range(8):
        cx = M; ry -= 16
        for i,(nm,wd) in enumerate(scols):
            if r == 0: hdr_txt(c, cx+2, sy-10, nm, 5.8, GREY)
            box(c, cx, ry, wd, 16, ROW if r%2 else white, HexColor("#D5DCE0"), 0.5)
            if F: field(c, f"log{r}_{i}", cx+2, ry+1.5, wd-4, 13, 7.5)
            elif d and r < len(d["log"]): val(c, cx+3, ry+5, d["log"][r][i], 6.9, INK, bold=False)
            cx += wd
    c.setFillColor(PAPER); c.rect(0, 0, W, 26, fill=1, stroke=0)
    micro(c, M, 12, SPEC["page2"]["footer"], TEAL, 5.6)
    c.setFont("Helvetica", 5.4); c.setFillColor(GREY); c.drawRightString(W-M, 10, "STARWROUGHT " + META["version"] + " - page 2")

def build(path, d=None, fillable=False):
    c = canvas.Canvas(path, pagesize=letter)
    c.setTitle("STARWROUGHT Character Sheet" + ("" if fillable else " - " + (d or {}).get("name","")))
    page1(c, d, fillable); c.showPage(); page2(c, d, fillable); c.save()

TORVA = dict(
    name="Mira of the Long Road", ancestry="Human / Versatile Human", culture="Kestrel Reach",
    background="Acrobat / Ambusher",
    level="1", milestones=0,
    might="+1", might_pts="3", agility="+2", agility_pts="8", wits="+1", wits_pts="4", presence="+1", presence_pts="3",
    awareness="+6", awareness_th="16", evade="+7", evade_th="17",
    guard="+6", guard_th="16", endure="+6", endure_th="16",
    armor_head="Leather cap", prot_head="2",
    armor_torso="Leather cuirass", prot_torso="3",
    armor_arms="Leather bracers", prot_arms="2",
    armor_legs="Leather leggings", prot_legs="2",
    load="0", strain="0", dying="0", wounded="0",
    hp_max="20", hp_cur="20", hp_tmp="", speed="25", init="+6",
    trees=[
        (False, "Origin (Human, Versatile, Reacher)", "-", "4", "Trained", "+4"),
        (False, "Ambusher (Calling)", "Agility", "2", "Trained", "+6"),
        (False, "Acrobatics", "Agility", "2", "Trained", "+6"),
        (False, "Athletics", "Might", "1", "Trained", "+5"),
        (False, "Stealth", "Agility", "1", "Trained", "+6"),
        (False, "Dueling (Combat Style)", "Agility", "1", "Trained", "+6"),
        (False, "Lore (Circus)", "Wits", "1", "Trained", "+5"),
        (False, "Awareness (Defense)", "Wits", "1", "Trained", "+5"),
        (False, "Evade (Defense)", "Agility", "2", "Trained", "+6"),
        (False, "Guard (Defense)", "Presence", "1", "Trained", "+5"),
        (False, "Endure (Defense)", "Might", "1", "Trained", "+5"),
        (False, "Weapons", "Might", "1", "Trained", "+5 atk"),
    ],
    attacks=[
        ("Rapier", "Dueling", "+7", "1d8+1 P", "deadly d8, parry, Reach 4 ft"),
        ("Dagger", "Dueling / thrown 10 ft", "+7", "1d4+1 P", "agile, close, finesse"),
        ("Unarmed", "Brawling (style unlearned)", "+6", "1d4+1 B", "agile, close, finesse, nonlethal"),
    ],
    talents=[
        "GRANTED FREE: Weapons Training + Awareness, Evade, Guard and Endure Training (5 points)",
        "ORIGIN ROOTS (free with the choices): Humanity, Versatile Human, Reacher",
        "Humanity - +1 Condition bonus on checks to Aid, rising with your rank in Human",
        "Versatile Human - 1 Opening Talent Point (spent on Dueling Training)",
        "Driven (Comet) - granted a Calling point, which bought Surprise Attacker",
        "Sneak Attack (Calling point) - +1d6 precision vs Off-Guard foes; brought Stealth Training",
        "Surprise Attacker - round 1, foes that have not acted are Wrong-Footed to you",
        "Skirmisher's Step (Defense point) - your Steps ignore difficult terrain",
        "Kip Up (Comet) - stand without triggering reactions",
        "Background: Trained in Athletics, Acrobatics, and Lore (Circus)",
        "17 points minimum, 18 spent: Driven handed one back.",
    ],
    banked="1 / 3",
    details=[
        "Chargen v3.0: 5 roots granted free, 3 Origin roots granted by the choices, then 12 points: 3 Origin, 3 Skill, 1 Lore, 1 Calling, 1 Defense, 3 Comets.",
        "Humanity (Human T): +1 Condition bonus on checks to Aid. +2 at Expert, +3 at Master, +4 at Legendary.",
        "Versatile Human (Bloodline): 1 Opening Talent Point, which opened Dueling.",
        "Reacher (Kestrel Reach T): Reachspeak and Common, and +1 Condition to Diplomacy toward Reach folk, scaling with the Origin Constellation.",
        "Sneak Attack (Ambusher T): +1d6 precision damage against Off-Guard foes, and Training in Stealth.",
        "Surprise Attacker (Ambusher T): in the first round, foes that have not acted yet are Wrong-Footed to you.",
        "MATCHED HARNESS: four leather pieces, same material and same Protection, so the Torso gets +1 Protection and Load Strain drops to 0.",
        "POSTURES: Give Ground (Evade) and Set Your Feet (Guard), both known from Training. +2 to the roll, and a Zone of your choice becomes Exposed win or lose.",
        "GOALS: Flare Dueling with a critical Feint. Grow Ambusher with milestone points.",
    ],
    gear=["Full leather harness, cap to leggings (9 gp)", "Rapier and juggling knives",
          "Chalk, sash, climbing kit", "Circus poster of her old troupe"],
    notes=["Common, Reachspeak", "Agility +2; Might, Wits and Presence +1 - an acrobat through and through",
           "Leather turns slashing poorly: -1 Protection against it on every Zone"],
    log=[("1", "-", "Created via chargen v3.0 - five roots free, three Origin roots, eighteen talents", "-")],
)

build("Starwrought_Character_Sheet_Fillable.pdf", None, fillable=True)
build("Mira_Character_Sheet.pdf", TORVA, fillable=False)
print("sheets written")
