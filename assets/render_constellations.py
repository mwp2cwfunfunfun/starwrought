# SPARKS constellation plates for the PHB: print-light mirror of the app layout
import json, os, math, io, sys, hashlib
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe

HERE = os.path.dirname(os.path.abspath(__file__))
# explicit encoding: talent names carry ◆ ↺ ◇ ★, and a Windows cp1252 read turns them into mojibake
TREES = json.load(io.open(os.path.join(HERE, "trees.json"), encoding="utf-8"))
OUT = os.path.join(HERE, "constellations"); os.makedirs(OUT, exist_ok=True)

# print-weight hues, one per v3.0 constellation (a shade darker than the app's screen palette)
HUES = {"Awareness":"#C4A62E","Evade":"#6FA85E","Guard":"#5E7A9E","Endure":"#BE7E3E",
"Acrobatics":"#4E9EBE","Athletics":"#D98E4A","Diplomacy":"#4E96A8","Guile":"#8A6EBE","Intimidation":"#C05656","Stealth":"#7A9BD0","Lore":"#A8925E",
"Ambusher":"#B86A8A","Berserker":"#C64836","Bravo":"#B886B8","Hunter":"#6FA85E","Weaponmaster":"#A86E52",
"Human":"#B0996A","Serrovane":"#8A6EBE","Kestrel Reach":"#9E7E52",
"Melee":"#A86E52","Ranged":"#3EA396","Two-Weapon Fighting":"#CE5E46","Shield Fighting":"#7A93B8","Brawling":"#BE7E3E","Dueling":"#B886B8",
"Great Weapon Fighting":"#96603E","Archery":"#3EA396","Crossbow Fighting":"#5E86A0","Missile Skirmishing":"#6E9E96",
"Spear & Polearm Fighting":"#86A85E","Armored Fighting":"#7A8894"}
INK = "#1D2A32"; GREY = "#8AA0A8"
TIERY = {"T":.80,"E":.58,"M":.36,"L":.15}; W,Hh = 1000,620
R = {"T":6,"E":8,"M":10,"L":13}

def darken(hex_, f=0.72):
    r,g,b = (int(hex_[i:i+2],16) for i in (1,3,5))
    return "#%02x%02x%02x" % (int(r*f), int(g*f), int(b*f))

def djb2(s):
    h = 5381
    for ch in s: h = (h*33 + ord(ch)) & 0xFFFFFFFF
    return h

def mulberry32(a):
    st = {"a": a & 0xFFFFFFFF}
    def rnd():
        st["a"] = (st["a"] + 0x6D2B79F5) & 0xFFFFFFFF
        a_ = st["a"]
        t = ((a_ ^ (a_ >> 15)) * (a_ | 1)) & 0xFFFFFFFF
        m = ((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF
        m_signed = m - 0x100000000 if m >= 0x80000000 else m
        t = ((t + m_signed) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd

import re
# Requires are written glyph-free while talent names carry the v4.10 cost glyphs (⓿ ❶ ❷ ❸ ..., ↺ beside
# a cost, the v3 ◆ ◇ and the capstone ★), a bracketed cost tail like "(⓿↺)", or a trailing "to"/"or"
# joiner from a range ("Strike ❶ to ❸"). Strip all of it before comparing, as the converter's norm does.
_GLYPHS = "◆◇↺★⓿❶❷❸❹❺❻"
def _nrmN(s):
    s = re.sub(r"\(\s*[" + _GLYPHS + r"\s]*\)", "", s or "")
    s = re.sub(r"[" + _GLYPHS + r"]", "", s)
    return re.sub(r"\s+(?:to|or)$", "", s.strip()).strip()
def _req_of(n):
    tg = n.get("requires")
    if not tg:
        m = re.search(r"Requires ([^.]+)\.", re.sub(r"<[^>]+>", "", n.get("effect","")))
        tg = [s.strip() for s in m.group(1).split(" or ")] if m else None
    return tg or []

RINGF = {"T":.34,"E":.56,"M":.78,"L":1.0}
TAU = math.pi*2; RLANG = math.pi*1.28
def norm_a(a):
    a %= TAU
    return a+TAU if a < 0 else a
def circ_mean(l):
    sx = sum(math.cos(a) for a in l); sy = sum(math.sin(a) for a in l)
    return math.atan2(sy, sx) if (sx or sy) else None
class Geo:
    def __init__(self, W2, H2, scale=1.0, cx=None, halfW=None):
        self.cx = cx if cx is not None else W2/2
        self.cy = H2/2-4
        self.Rm = (H2/2-48)*scale
        hw = halfW if halfW is not None else (W2/2-100)
        self.XR = min(2.05, max(1, hw/self.Rm))
    def rx(self, t): return RINGF[t]*self.Rm*self.XR
    def ry(self, t): return RINGF[t]*self.Rm

def radial_clear(pts, edges):
    for p in pts: p["_a0"] = p.get("_ang")
    def diff_a(a,b):
        d = norm_a(a-b)
        return d-TAU if d > math.pi else d
    for _ in range(5):
        moved = 0
        for a,b,kind in edges:
            if kind != "req": continue
            for p in pts:
                if p is a or p is b or p.get("root") or p.get("_pin") or "_geo" not in p: continue
                dx,dy = b["x"]-a["x"], b["y"]-a["y"]; L2 = dx*dx+dy*dy
                if not L2: continue
                t2 = ((p["x"]-a["x"])*dx + (p["y"]-a["y"])*dy)/L2
                if t2 < .06 or t2 > .94: continue
                qx,qy = a["x"]+t2*dx, a["y"]+t2*dy
                d = math.hypot(p["x"]-qx, p["y"]-qy)
                if d >= 24: continue
                g = p["_geo"]; rx = p.get("_rx") or g.rx(p["tier"]); ry = p.get("_ry") or g.ry(p["tier"])
                cur = math.atan2((p["y"]-g.cy)/ry, (p["x"]-g.cx)/rx)
                side = 1 if (dx*(p["y"]-a["y"])-dy*(p["x"]-a["x"])) >= 0 else -1
                A2 = cur + side*(30/max(60,ry))
                if p.get("_a0") is not None and abs(diff_a(A2, p["_a0"])) > 0.42:
                    A2 = p["_a0"] + 0.42*(1 if diff_a(A2, p["_a0"]) > 0 else -1)
                nx2, ny2 = g.cx+rx*math.cos(A2), g.cy+ry*math.sin(A2)
                crowded = lambda xx,yy: any(q is not p and math.hypot(q["x"]-xx, q["y"]-yy) < 32 for q in pts)
                if crowded(nx2, ny2):
                    A3 = cur - side*(30/max(60,ry))
                    nx2, ny2 = g.cx+rx*math.cos(A3), g.cy+ry*math.sin(A3)
                    if crowded(nx2, ny2): continue
                    A2 = A3
                p["x"] = nx2; p["y"] = ny2; p["_ang"] = norm_a(A2); moved += 1
        if not moved: break

def layout(tname):
    t = TREES[tname]
    by = {"T":[], "E":[], "M":[], "L":[]}
    for n in t["nodes"]:
        if not n.get("root"): by[n["tier"]].append(n)
    G = Geo(W, Hh)
    pts, ang_of = [], {}
    rn = next((n for n in t["nodes"] if n.get("root")), None)
    MIDF = {"T":(RINGF["T"]+RINGF["E"])/2, "E":(RINGF["E"]+RINGF["M"])/2, "M":(RINGF["M"]+RINGF["L"])/2, "L":RINGF["L"]*1.06}
    def same_tier_depth(n):
        d, cur, seen = 0, n, set()
        while d < 3:
            rq = [_nrmN(q) for q in _req_of(cur)]
            par = next((x for x in t["nodes"] if x is not cur and not x.get("root") and x["tier"]==cur["tier"] and _nrmN(x["name"]) in rq), None)
            if not par or _nrmN(par["name"]) in seen: break
            seen.add(_nrmN(par["name"])); d += 1; cur = par
        return d
    NEXTF = {"T":RINGF["E"], "E":RINGF["M"], "M":RINGF["L"], "L":RINGF["L"]*1.12}
    def sub_mul(tier, A, d):
        stretch = math.hypot(G.XR*math.cos(A), math.sin(A))*G.Rm
        df = min((NEXTF[tier]-RINGF[tier])*0.68, max(0.10*RINGF[tier], 36/max(1,stretch))) + 0.07*(d-1)
        return 1 + df/RINGF[tier]
    def put(n, tier, A, rmul):
        rr = mulberry32(djb2(tname+"|rj|"+n["name"])); rj = (1+(rr()-.5)*.05)*rmul
        rx, ry = G.rx(tier)*rj, G.ry(tier)*rj
        pts.append(dict(n, x=G.cx+rx*math.cos(A), y=G.cy+ry*math.sin(A), _ang=A, _rx=rx, _ry=ry, _pin=1 if n.get("hroot") else 0, _geo=G))
    # partitioned wheel: pinned heritage families own wedges; strangers live in the arcs between
    vis_hr = [n for n in t["nodes"] if n.get("hroot")]
    for i,n in enumerate(vis_hr):
        ang_of[_nrmN(n["name"])] = norm_a((1 if i%2 else -1)*math.ceil(i/2)*1.1)
    fam_guard = 0.55
    fam_of = {}
    def fam_walk(n):
        k = _nrmN(n["name"])
        if k in fam_of: return fam_of[k]
        if n.get("hroot"):
            fam_of[k] = k; return k
        fam_of[k] = None
        for q in _req_of(n):
            par = next((x for x in t["nodes"] if _nrmN(x["name"])==_nrmN(q) and not x.get("root")), None)
            if par:
                f = fam_walk(par)
                if f:
                    fam_of[k] = f; break
        return fam_of[k]
    zones = [{"ang":norm_a(RLANG), "guard":0.30}]
    for n in vis_hr: zones.append({"ang":ang_of[_nrmN(n["name"])], "guard":fam_guard})
    SLN = 720; occ_sl = [0]*SLN
    for z in zones:
        st = int(norm_a(z["ang"]-z["guard"])/TAU*SLN); ln = math.ceil(z["guard"]*2/TAU*SLN)
        for k2 in range(ln+1): occ_sl[(st+k2)%SLN] = 1
    free_sl = [k2 for k2 in range(SLN) if not occ_sl[k2]]
    def hash_spot(r):
        if not free_sl: return norm_a(r()*TAU)
        return norm_a((free_sl[int(r()*len(free_sl))%len(free_sl)]+0.5)/SLN*TAU)
    for tier in ("T","E","M","L"):
        arr = by[tier]
        if not arr: continue
        famN = [n for n in arr if fam_walk(n)]; strayN = [n for n in arr if not fam_walk(n)]
        f_idx = {}
        for n in famN:
            if n.get("hroot"):
                put(n, tier, ang_of[_nrmN(n["name"])], 1); continue
            ps = [ang_of[_nrmN(q)] for q in _req_of(n) if _nrmN(q) in ang_of]
            base = circ_mean(ps) if ps else ang_of[fam_walk(n)]
            key = tier+"|"+",".join(sorted(_nrmN(q) for q in _req_of(n)))
            k = f_idx[key] = f_idx.get(key,0)+1
            off = (1 if k%2 else -1)*(0.14+0.20*(k//2))
            A = norm_a(base+off)
            fa = ang_of[fam_walk(n)]; dev = norm_a(A-fa)
            if fam_guard < dev < TAU-fam_guard:
                A = norm_a(fa + (fam_guard*0.92 if dev < math.pi else -fam_guard*0.92))
            ang_of[_nrmN(n["name"])] = A
            d = same_tier_depth(n)
            put(n, tier, A, sub_mul(tier, A, d) if d > 0 else 1)
        if not strayN:
            continue
        sib_idx = {}
        init = []
        for n in strayN:
            ps = [ang_of[_nrmN(q)] for q in _req_of(n) if _nrmN(q) in ang_of]
            cm = circ_mean(ps) if ps else None
            r = mulberry32(djb2(tname+"|"+n["name"]))
            if cm is None:
                init.append({"n":n, "a":hash_spot(r)}); continue
            key = ",".join(sorted(_nrmN(q) for q in _req_of(n)))
            k = sib_idx[key] = sib_idx.get(key,0)+1
            off = 0 if k == 1 else (1 if k%2 else -1)*(0.11+0.13*((k-1)//2))
            init.append({"n":n, "a":norm_a(cm+off)})
        # free arcs read straight off the slot map: immune to overlapping zones and the 0-degree seam
        arcs = []
        a0 = next((k2 for k2 in range(SLN) if occ_sl[k2]), -1)
        if a0 < 0: arcs = [{"s":0,"e":TAU}]
        else:
            run = None; raw = []
            for c2 in range(SLN):
                idx = (a0+1+c2) % SLN
                if not occ_sl[idx]:
                    if run is None: run = {"st":idx, "len":0}
                    run["len"] += 1
                elif run is not None:
                    raw.append(run); run = None
            if run is not None: raw.append(run)
            arcs = [{"s":r2["st"]/SLN*TAU, "e":(r2["st"]+r2["len"])/SLN*TAU} for r2 in raw if r2["len"] >= 8]
        buckets = [[] for _ in arcs]
        for o in init:
            bi = -1
            for i,x in enumerate(arcs):
                a2 = o["a"] if o["a"] >= x["s"] else o["a"]+TAU
                if bi < 0 and x["s"] <= a2 <= x["e"]: bi = i
            if bi < 0:
                bd = 1e9
                for i,x in enumerate(arcs):
                    mid = (x["s"]+x["e"])/2
                    d = abs(norm_a(o["a"]-mid+math.pi)-math.pi)
                    if d < bd: bd, bi = d, i
            buckets[bi].append(o)
        for i,x in enumerate(arcs):
            if not buckets[i]: continue
            span = x["e"]-x["s"]; ry = G.ry(tier)
            bs = sorted(({"o":o, "v":(o["a"]+TAU if o["a"] < x["s"] else o["a"])} for o in buckets[i]),
                        key=lambda e: (e["v"], e["o"]["n"]["name"]))
            m = len(bs)
            D = min(2*math.asin(min(.9, 39/max(44,ry))), span/m)
            a = [min(x["e"], max(x["s"], e["v"])) for e in bs]
            for k in range(1, m): a[k] = max(a[k], a[k-1]+D)
            a[m-1] = min(a[m-1], x["e"]-D*0.4)
            for k in range(m-2, -1, -1): a[k] = min(a[k], a[k+1]-D)
            for k in range(m): a[k] = max(x["s"]+D*0.4, a[k])
            for j,e in enumerate(bs):
                rr = mulberry32(djb2(tname+"|jit|"+e["o"]["n"]["name"]))
                ang_of[_nrmN(e["o"]["n"]["name"])] = norm_a(a[j]+(rr()-.5)*min(.05, D*.25))
        for n in strayN:
            d = same_tier_depth(n)
            put(n, tier, ang_of[_nrmN(n["name"])], sub_mul(tier, ang_of[_nrmN(n["name"])], d) if d > 0 else 1)
    if rn: pts.append(dict(rn, x=G.cx, y=G.cy, _geo=G))
    edges = []
    def of(t2): return sorted([p2 for p2 in pts if p2["tier"]==t2 and not p2.get("root")], key=lambda p2: p2["x"])
    root = next((p2 for p2 in pts if p2.get("root")), None)
    hard = []
    for p2 in pts:
        for tgt in _req_of(p2):
            par = next((q for q in pts if q is not p2 and _nrmN(q["name"])==_nrmN(tgt)), None)
            if par:
                hard.append((par,p2))
                # root->deeper requires stay undrawn: root-first is the law even unwritten
                if not (par.get("root") and p2["tier"] != "T" and not p2.get("hroot")):
                    edges.append((par,p2,"req"))
    has_req = {p2["name"] for _,p2 in hard}
    if root:
        for p2 in of("T"):
            if p2["name"] not in has_req: edges.append((root,p2,"req"))
    ms = of("M")
    if ms:
        for p2 in pts:
            if not p2.get("root") and "★" in p2["name"]:
                for q in ms: edges.append((q,p2,"cap"))
    radial_clear(pts, edges)
    return pts, edges, G

NRP = {"T":6,"E":8,"M":10,"L":13}
def place_labels(pts):
    # port of the app's greedy solver: radial-outward first (pinned roots inward), then below/above/beside;
    # obstacles are every star disc and every label already placed; worst case takes the least-colliding spot
    boxes = []; out = {}
    discs = []
    for q in pts:
        qr = (18 if q.get("root") else NRP[q["tier"]])+4
        discs.append((q, q["x"]-qr, q["x"]+qr, q["y"]-qr, q["y"]+qr))
    def hit_n(b, skip):
        n2 = 0
        for q,x0,x1,y0,y1 in discs:
            if q is skip: continue
            if b[0]<x1 and x0<b[1] and b[2]<y1 and y0<b[3]: n2 += 1
        for d in boxes:
            if b[0]<d[1]-2 and d[0]<b[1]-2 and b[2]<d[3]-2 and d[2]<b[3]-2: n2 += 1
        return n2
    for p2 in pts:
        r = 12 if p2.get("root") else NRP[p2["tier"]]
        hw = (len(p2["name"].replace(" ★",""))+(2 if p2.get("root") or p2.get("hroot") else 0))*3.2+4
        if p2.get("root"):
            cands = [("middle", p2["x"], p2["y"]+r+18)]
        else:
            cands = [("middle",p2["x"],p2["y"]+r+16),("middle",p2["x"],p2["y"]-r-10),
                     ("start",p2["x"]+r+9,p2["y"]+4),("end",p2["x"]-r-9,p2["y"]+4)]
            if p2.get("_ang") is not None:
                c = math.cos(p2["_ang"]); s2 = math.sin(p2["_ang"])
                outw = ("start",p2["x"]+r+9,p2["y"]+4) if c>.38 else (("end",p2["x"]-r-9,p2["y"]+4) if c<-.38 else                        (("middle",p2["x"],p2["y"]+r+16) if s2>0 else ("middle",p2["x"],p2["y"]-r-10)))
                inw  = ("end",p2["x"]-r-9,p2["y"]+4) if c>.38 else (("start",p2["x"]+r+9,p2["y"]+4) if c<-.38 else                        (("middle",p2["x"],p2["y"]-r-10) if s2>0 else ("middle",p2["x"],p2["y"]+r+16)))
                cands.insert(0, inw if p2.get("_pin") else outw)
                cands.append(outw if p2.get("_pin") else inw)
        placed = None; best = None; best_n = 1e9
        for la,lx,ly in cands:
            x0 = lx-hw if la=="middle" else (lx if la=="start" else lx-2*hw)
            b = (x0, x0+2*hw, ly-11, ly+3, la, lx, ly)
            n2 = hit_n(b, p2)
            if n2 == 0:
                placed = b; break
            if n2 < best_n: best_n, best = n2, b
        placed = placed or best
        boxes.append(placed); out[id(p2)] = placed
    return out

# PHB v4.10 rank gates: Expert at level 5, Master at 10, Legendary at 15.
RINGLAB = [("T","TRAINED · 1 pt · L1+"),("E","EXPERT · 4 pts · L5+"),("M","MASTER · 9 pts · L10+"),("L","LEGENDARY · 16 pts · L15+")]

# The plate font (DejaVu Sans) carries the v4.10 cost glyphs ❶ to ❻ and ↺ but not ⓿ (U+24FF), so a
# free Maneuver's name would render as a box. Swap any glyph the font lacks for its nearest kin.
try:
    from matplotlib import font_manager as _fm
    from matplotlib.ft2font import FT2Font as _FT2Font
    _PLATE_CHARMAP = set(_FT2Font(_fm.findfont("DejaVu Sans")).get_charmap().keys())
except Exception:  # pragma: no cover - a matplotlib without ft2font simply keeps the text as is
    _PLATE_CHARMAP = None
_GLYPH_KIN = {"⓿": ("⓪", "(0)")}
def plate_text(s):
    if _PLATE_CHARMAP is None: return s
    out = []
    for ch in s:
        if ord(ch) in _PLATE_CHARMAP: out.append(ch); continue
        kin = _GLYPH_KIN.get(ch, ())
        out.append(next((k for k in kin if all(ord(c) in _PLATE_CHARMAP for c in k)), ch))
    return "".join(out)

# --changed (0.8.0, the content loop): render only the plates whose Constellation changed or is new.
# The sidecar .plates.json beside the plates maps each plate file to the SHA-1 of its tree's
# canonical JSON (the whole entry from trees.json, keys sorted), and is rewritten on every run, flag
# or no flag. With the flag a plate is redrawn when its hash differs from the sidecar's, when the
# sidecar does not know it, or when the PNG is missing; every other plate is kept as it is. The hash
# covers the tree alone, so a change to this script or to HUES wants an unflagged run, which is what
# the full pipeline does. build_foundry.mjs copies *.png only, so the sidecar never reaches the system.
CHANGED = "--changed" in sys.argv
SIDECAR = os.path.join(OUT, ".plates.json")

def tree_hash(tree):
    canon = json.dumps(tree, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(canon.encode("utf-8")).hexdigest()

def read_sidecar():
    try:
        with io.open(SIDECAR, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):  # no sidecar yet, or not JSON: every plate counts as changed
        return {}

def plate_slug(name):
    slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    while "--" in slug: slug = slug.replace("--","-")
    return slug

previous = read_sidecar() if CHANGED else {}
hashes = {}
plates = set(); unchanged = 0
for name, t in TREES.items():
    png = plate_slug(name) + ".png"
    hashes[png] = tree_hash(t)
    if CHANGED and previous.get(png) == hashes[png] and os.path.exists(os.path.join(OUT, png)):
        plates.add(png); unchanged += 1
        continue
    hue = HUES.get(name, "#8FA8C8"); hued = darken(hue)
    pts, edges, G = layout(name)
    fig, ax = plt.subplots(figsize=(7.0,3.9), dpi=200)
    ax.set_xlim(0,W); ax.set_ylim(0,Hh); ax.axis("off")
    fig.patch.set_facecolor("#FBF8F2")
    # orbits: root at the heart, Trained innermost, Legendary at the rim (v0.36)
    th = [i/240*TAU for i in range(241)]
    for tier, lab in RINGLAB:
        rx, ry = G.rx(tier), G.ry(tier)
        ax.plot([G.cx+rx*math.cos(a) for a in th], [Hh-(G.cy+ry*math.sin(a)) for a in th],
                color="#C9BFAE", lw=.8, ls=(0,(2,5)), zorder=1)
        lx = G.cx+(rx+10)*math.cos(RLANG); ly2 = Hh-(G.cy+(ry+10)*math.sin(RLANG))
        ax.text(lx, ly2, lab, fontsize=4.8, color=GREY, weight="bold", ha="right", va="center", zorder=3,
                path_effects=[pe.withStroke(linewidth=1.6, foreground="#FBF8F2")])
    for a,b,kind in edges:
        x1,y1,x2,y2 = a["x"],Hh-a["y"],b["x"],Hh-b["y"]
        if kind=="cap":
            ax.plot([x1,x2],[y1,y2], color="#B8860B", lw=.9, alpha=.4, ls=(0,(1,5)), zorder=2)
        else:
            ax.annotate("", xy=(x2,y2), xytext=(x1,y1), zorder=2,
                arrowprops=dict(arrowstyle="-|>", color=hued, lw=1.3, shrinkA=10, shrinkB=10, alpha=.85,
                                linestyle=(0,(4,3))))
    LBL = place_labels(pts)
    for p in pts:
        is_root = p.get("root")
        x, y, r = p["x"], Hh-p["y"], (12 if is_root else R[p["tier"]])
        if "★" in p["name"] and not is_root:
            for i in range(8):
                ang = math.pi/4*i
                ax.plot([x+math.cos(ang)*(r+3), x+math.cos(ang)*(r+12)],
                        [y+math.sin(ang)*(r+3), y+math.sin(ang)*(r+12)],
                        color=hued, lw=1.2, alpha=.9, zorder=3)
        ax.scatter([x],[y], s=(r*2.6)**2*1.15, color=hue, alpha=.15, zorder=3, edgecolors="none")
        ax.scatter([x],[y], s=(r*1.4)**2*1.15, color=hue, alpha=.32, zorder=3, edgecolors="none")
        ax.scatter([x],[y], s=(r*.85)**2*1.15, color=hued, zorder=4, edgecolors=INK, linewidths=.6)
        ax.scatter([x],[y], s=(r*.30)**2*1.15, color="#FFFFFF", zorder=5, edgecolors="none")
        if is_root:
            ax.scatter([x],[y], s=(r*2.1)**2*1.15, marker="D", facecolors="none", edgecolors="#B8860B", linewidths=1.5, zorder=4)
        if p.get("hroot"):
            ax.scatter([x],[y], s=(r*1.9)**2*1.15, marker="D", facecolors="none", edgecolors="#9AA6B2", linewidths=1.2, zorder=4)
        label = plate_text(("◈ " if is_root else ("✧ " if p.get("hroot") else "")) + p["name"].replace(" ★",""))
        la, lx, ly = LBL[id(p)][4], LBL[id(p)][5], LBL[id(p)][6]
        ax.annotate(label, (lx, Hh-(ly-4)),
                    ha={"middle":"center","start":"left","end":"right"}[la], va="center",
                    fontsize=6.4 if is_root else 5.8, color=("#8a6508" if is_root else INK),
                    weight="bold" if is_root else "normal",
                    path_effects=[pe.withStroke(linewidth=1.8, foreground="#FBF8F2")], zorder=6)
    ax.annotate("⇢ requires      ◈ root: every constellation starts here      no line in = needs only the root      rays = capstone (needs any Master talent)",
                (W/2, 2), ha="center", fontsize=5.2, color=GREY, zorder=6)
    ax.text(W-12, Hh-16, name, fontsize=8, color=hued, weight="bold", ha="right", zorder=3,
            family="DejaVu Serif")
    plt.subplots_adjust(left=0,right=1,top=1,bottom=0)
    plt.savefig(os.path.join(OUT, png), facecolor="#FBF8F2", bbox_inches="tight", pad_inches=0.04)
    plt.close()
    plates.add(png)
# A plate whose tree is gone (Weapons, after the Melee/Ranged split) is pruned, so the count is honest
# and build_foundry.mjs does not keep copying a retired Constellation into the system. The sidecar is
# rebuilt from the trees alone, so a gone tree drops out of it with its plate.
for f in os.listdir(OUT):
    if f.endswith(".png") and f not in plates:
        os.remove(os.path.join(OUT, f))
with io.open(SIDECAR, "w", encoding="utf-8", newline="\n") as f:
    f.write(json.dumps(hashes, sort_keys=True, indent=2, ensure_ascii=False) + "\n")
print("rendered: %d plates (%d unchanged)" % (len(plates) - unchanged, unchanged))
