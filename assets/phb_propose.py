# -*- coding: utf-8 -*-
"""
phb_propose.py: a proposal for the Player's Handbook, written as Word tracked changes into a NEW file.

phb_edit.py writes an edition: the edits applied, a new version number, nothing left to review.
This writes a proposal: the same surgical edits, each left as a revision (w:ins / w:del, author
"Claude") for Mike to accept or reject in Word with Track Changes, in a file named so that
build_all.mjs's drift check never takes it for an edition (`<name>_<proposal>_proposal.docx` does
not match `Starwrought_Players_Handbook_v<n>.docx`). Every other zip entry is copied through byte
for byte, and the source is never written. Accepting the changes and saving as the next numbered
handbook is Mike's step; the sync of data, app and system follows that, by the handbook rule.

Edits, each confined to one paragraph (a table cell's paragraph counts), or, for `row`, to one new
table row:

  replace       (anchor, old, new): `old` must occur once in the visible text of the paragraph
                holding `anchor`, and sit inside one run. That run is split: the text before, the
                old text struck through, the new text inserted in the same formatting, the text
                after. `new` may be "" for a plain deletion. An anchor beginning with "=" must
                equal the paragraph's whole text (a one-word table cell).
  rewrite       (anchor, new): every run of the paragraph struck through and `new` inserted in the
                first run's formatting, for a line Word has split into many runs.
  cell          (row, col, old, new): replace inside one table cell: the row is named by the exact
                text of one of its cells ("=Berserker") or of several that must all sit in it
                (["Berserker", "Rage"]); the cell is the `col`th of that row. For a cell that says
                "3" like a dozen others. `old` None rewrites the cell.
  row           (row_anchor, position, cells): a new table row "before" or "after" the row named
                the way `cell` names one (["Comfort", "You can sleep in it without waking
                fatigued."]), cut from that row's own XML so it keeps the cell widths, borders,
                shading and margins, the row properties, and each cell's paragraph properties and
                first-run formatting; `cells` gives one text per cell, and each cell becomes one
                paragraph holding one run. The row mark (w:trPr/w:ins), each paragraph mark and
                each run are marked inserted, so Word shows the row as one insertion and Reject
                removes it whole.
  append        (anchor, addition): an inserted run at the end of the paragraph.
  insert_after  (anchor, text): a new paragraph after the anchor's, in the anchor's style and
                numbering, its paragraph mark and text both marked inserted.

  run:  python assets/phb_propose.py <in.docx> <out.docx> --proposal armor-balance
        python assets/phb_propose.py <in.docx> <out.docx> --proposal armor-balance --proposal vigor
        python assets/phb_propose.py <in.docx> <out.docx> --proposal attended
  Several proposals stack into one file, applied in the order given.

The proposals are the PROPOSALS table below, one entry per proposal this script has produced, so
a reviewer can read what is being proposed without opening Word.
"""
import datetime
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

AUTHOR = "Claude"
EDITION_PATTERN = re.compile(r"^Starwrought_Players_Handbook_v[\d.]+\.docx$", re.I)

PROPOSALS = {
    # Armor balance (Mike, 2026-10-02): "I don't want to make Plate the optimal choice for combat all
    # the time, but I also want some realism." Load Strain stops coming off Evade and off every
    # Might and Agility check, and becomes a clock: the Wind check stacks Fatigued, Endure relief
    # starts at Trained, and the true costs stay (helm, Rush, Leap, Climb, Swim, noise, donning).
    # Exposed already counts a Zone's Protection as 0 against a Deliberate or Committed Strike, so
    # the gap rule needed no change.
    "armor-balance": {
        "from": "4.10",
        "replace": [
            (
                "Load Strain = The Load of all armor you are wearing",
                "The Load of all armor you are wearing.",
                "the Load of all the armor you are wearing and of a shield you carry, less 1 for a matched"
                " harness and less your Endure relief (both below), to a minimum of 0."
            ),
            # Anchored on its own sentence: the first edit above has already changed the opening.
            (
                "Subtract your Load Strain from your Evade",
                "Subtract your Load Strain from your Evade, and from any Might and Agility-related Skill check.",
                "It never comes off your Evade, and it is no blanket penalty on Might or Agility: a fit"
                " fighter in a fitted harness runs, rolls, and wrestles like anyone else. What it costs is"
                " breath, senses, and the margins of movement, as the three points below say."
            ),
            (
                "What armor costs in a fight.",
                "and it costs a Guard fighter nothing on the roll.",
                "and it costs a fighter nothing on the roll, Guard or Evade."
            ),
            (
                "Wind. At the end of the third round",
                "On a failure they are Fatigued (−1 Evade and Guard) until they catch their breath after the fight.",
                "On a failure they are Fatigued 1, or their Fatigued rises by 1, to a maximum of 3. Fatigued N"
                " is a −N Condition penalty to Evade, Guard, and attack rolls, and it lasts until ten minutes"
                " of rest once the fight is over. A fighter in heavy harness wins the short fight and fades"
                " in the long one."
            ),
            (
                "Speed at the margin.",
                "and Climb and Swim are Athletics checks, so Load Strain already applies to them.",
                "and Climb, Swim, and Stealth checks take your Load Strain as a penalty. Nothing else does:"
                " a grapple, a tumble, and a single Move at full Speed are yours at full strength."
            ),
            (
                "Training in Endure reduces Load Strain",
                "as your Proficiency Rank in it rises.",
                "as your Proficiency Rank in it rises: by 1 at Trained, 2 at Expert, 3 at Master, and 4 at"
                " Legendary. Conditioning is what lets a knight wear his harness all day."
            ),
            (
                "A complete harness of plate with closed helm",
                "Load 7 (8, minus 1 for a matched harness),",
                "Load 8, Load Strain 7 (less 1 for the matched harness, and less your Endure relief: 6 on a"
                " fighter Trained in Endure, 4 at Master),"
            ),
            (
                "Load. An abstraction of the weight",
                "may negatively impact certain Checks and Thresholds (e.g., Swimming or Climbing).",
                "it never makes you easier to hit, but it shortens a Rush and a Leap, weighs on a Climb, a Swim,"
                " and a Stealth check, and it tires you as a fight runs long (see Wind, under Load and Load Strain)."
            ),
            # Word holds this sentence in seven runs; the one word is what sits in one of them.
            (
                "Putting on or taking off a single piece",
                "fatigued",
                "Fatigued 1"
            ),
            # The Endure Training root (its Constellation table): relief from Trained.
            (
                "You are Trained in Endure: add this Constellation",
                "once you reach Expert rank, 2 at Master, and 3 at Legendary.",
                "at Trained, 2 at Expert, 3 at Master, and 4 at Legendary."
            ),
            # The Conditions table's label cell, matched exactly (the word is everywhere else too).
            (
                "=Fatigued",
                "Fatigued",
                "Fatigued N"
            ),
        ],
        "rewrite": [
            # The Conditions table's one-line entry, which Word holds in five runs.
            (
                "-1 to Evade and Guard; can't use Exploration Mode Activities.",
                "−N Condition penalty to Evade, Guard, and attack rolls; can't use Exploration Mode"
                " Activities. Rises by 1 on each failed Wind check, to a maximum of 3; ends after ten"
                " minutes of rest once the fight is over."
            ),
        ],
        "append": [],
        "insert_after": [],
    },
}

PROPOSALS["vigor"] = {
    # Vigor, A plus B (Mike, 2026-10-02: "Go with A plus B"). The body sets the slope: your
    # Ancestry's Vigor every level. Your first Calling pays an Opening Vigor once, at creation
    # (Berserker 8, Hunter, Bravo and Weaponmaster 5, Ambusher 3), so a level-one dip into the
    # toughest Calling buys a few points once and nothing after. Conditioning is the only other
    # slope: 1 more Vigor a level at Expert rank in Endure, 2 at Master, 3 at Legendary, read live
    # from the rank you hold. Nothing to record from level to level, nothing to retcon.
    "from": "4.10",
    "replace": [
        (
            "At 1st level: 10 + your Ancestry",
            "10 + your Ancestry's Vigor + your Calling's Vigor.",
            "10 + your Ancestry's Vigor + your first Calling's Opening Vigor. The Opening Vigor is paid once,"
            " here: it is the Calling's share of what you start with, not of what you grow."
        ),
        (
            "Each Calling grants Training in 1 Skill",
            "adds a certain amount of Vigor per level,",
            "adds its Opening Vigor to what you start with (once, and only from your first Calling),"
        ),
        (
            "Vigor: Your Vigor at 1st level is",
            "10 + Ancestry Vigor + Calling Vigor",
            "10 + Ancestry Vigor + your first Calling's Opening Vigor"
        ),
        (
            "+Vigor equal to Ancestry Vigor + Calling Vigor",
            "+Vigor equal to Ancestry Vigor + Calling Vigor",
            "+Vigor equal to Ancestry Vigor, plus 1 at Expert rank in Endure, 2 at Master, 3 at Legendary"
        ),
    ],
    "rewrite": [
        (
            "At every level thereafter: add your Ancestry",
            "At every level thereafter: add your Ancestry's Vigor again, plus your conditioning: 1 at Expert"
            " rank in Endure, 2 at Master, 3 at Legendary. Your Calling adds nothing more. Its Opening Vigor"
            " was paid at 1st level, and no Calling you open later adds any."
        ),
    ],
    "cell": [
        # The Callings table: the column is what you start with, not what you grow. Each row is
        # found by the cell that names it, and the Vigor cell is two to the right.
        (["Free Training", "Calling"], 2, None, "Opening Vigor"),
        (["Berserker", "Rage"], 2, "4", "8"),
        (["Ambusher", "Sneak Attack"], 2, "2", "3"),
        (["Hunter", "Mark Prey"], 2, "3", "5"),
        (["Bravo", "Panache"], 2, "3", "5"),
        (["Weaponmaster", "Drilled"], 2, "3", "5"),
    ],
    "append": [
        (
            "You are Trained in Endure: add this Constellation",
            " Your Vigor grows with your conditioning as well: at Expert rank in Endure you gain 1 more Vigor"
            " at every level, 2 at Master, and 3 at Legendary."
        ),
    ],
    "insert_after": [
        (
            "At every level thereafter: add your Ancestry's Vigor again",
            "A Human Berserker therefore starts with 26 Vigor (10 + 8 + 8) and gains 8 a level, 9 a level once"
            " Expert in Endure; a Human Ambusher starts with 21 and grows the same way."
        ),
    ],
}

PROPOSALS["wind-exemption"] = {
    # The Wind exemption (Mike, 2026-10-02: "If the character passes a certain threshold something
    # related, I think they should not have to roll to be Winded"). A take-10 rule in the book's
    # own terms: a fighter whose Endure Threshold is at least the Wind Threshold (10 + Load Strain)
    # passes without rolling, so conditioning rather than luck decides who never tires. Endure
    # feeds Might, so the one number already carries both the training and the strength. In the
    # plate example a fighter Trained in Endure rolls against 16, and one at Expert rank (Load
    # Strain 5, Endure Threshold 16 or more) never rolls, nor does a Master. Fatigued never
    # touches Endure, so the test holds through a fight; Frightened does, so fear can take a
    # fighter's wind. Talents that buy the exemption outright, or cap Fatigued at 1, belong to the
    # Armored Fighting Constellation once it has Talents, not here.
    "from": "4.11",
    "replace": [
        (
            "Wind. At the end of the third round",
            "against 10 + Load Strain. ",
            "against 10 + Load Strain. A fighter whose Endure Threshold is at least that number passes"
            " without rolling: conditioning, not luck, decides who never tires. "
        ),
    ],
    "rewrite": [],
    "cell": [],
    "append": [
        (
            "A complete harness of plate with closed helm",
            " Trained in Endure, you roll for Wind against 16 from the third round unless your Might lifts"
            " your Endure Threshold to it; at Expert rank (Load Strain 5, Endure Threshold 16 or more) you"
            " never roll it at all."
        ),
    ],
    "insert_after": [],
}

PROPOSALS["attended"] = {
    # Attended (Mike, 2026-10-02: "Yes to all" on the armor-help design). A piece that fastens
    # behind the shoulder, beyond the wearer's own reach, takes twice as long to put on alone and
    # comes off in the usual time; the Breastplate alone carries it. The judge panel's design:
    # a trait rather than a column, named for what the piece needs rather than what it is, so the
    # armor table stays one word wider and a Cuirass could carry it tomorrow. Display only: the
    # trait is a time tag on the equipment tab and a sentence in the donning rules, and no check,
    # Threshold, Load or Protection reads it. The data and the system carry it from 0.6.2 at
    # Mike's word; the book follows once he accepts this redline (v4.13 sync report, ruling 82).
    "from": "4.13",
    "replace": [
        # The donning paragraph: Word holds the two middle sentences in one plain run.
        (
            "Putting on or taking off a single piece",
            "A full kit takes as long as its pieces. ",
            "A full kit takes as long as its pieces. An Attended piece takes that long only with a second"
            " pair of hands; alone, putting it on takes twice as long, though it comes off in the usual time. "
        ),
    ],
    "rewrite": [],
    "cell": [
        # The armor table: the Breastplate's Traits cell, five to the right of its name.
        (["Breastplate", "Torso"], 5, "Plate, Noisy", "Plate, Noisy, Attended"),
    ],
    "row": [
        # The armor traits table, alphabetical: Attended goes in above Comfort, in Comfort's dress.
        (
            ["Comfort", "You can sleep in it without waking fatigued."],
            "before",
            [
                "Attended",
                "It fastens behind the shoulder, beyond your own reach: alone, putting it on takes twice as"
                " long. Taking it off does not.",
            ],
        ),
    ],
    "append": [],
    "insert_after": [],
}

PARA_RE =re.compile(r"<w:p\b[^>]*/>|<w:p\b[^>]*>.*?</w:p>", re.S)
ROW_START_RE = re.compile(r"<w:tr\b[^>]*>")
CELL_RE = re.compile(r"<w:tc\b[^>]*>.*?</w:tc>", re.S)
# A row's and a cell's property blocks, and the rare table-property exceptions a row may open with.
TRPR_RE = re.compile(r"<w:trPr\b[^>]*/>|<w:trPr\b[^>]*>.*?</w:trPr>", re.S)
TCPR_RE = re.compile(r"<w:tcPr\b[^>]*/>|<w:tcPr\b[^>]*>.*?</w:tcPr>", re.S)
TBLPREX_RE = re.compile(r"<w:tblPrEx\b[^>]*/>|<w:tblPrEx\b[^>]*>.*?</w:tblPrEx>", re.S)
RUN_RE = re.compile(r"<w:r\b[^>]*>.*?</w:r>", re.S)
RPR_RE = re.compile(r"<w:rPr\b.*?</w:rPr>", re.S)
PPR_RE = re.compile(r"<w:pPr\b.*?</w:pPr>", re.S)
TEXT_RE = re.compile(r"(<w:t\b[^>]*>)(.*?)(</w:t>)", re.S)
# What a run may hold besides its formatting and its one text: the page-break marker Word leaves.
HARMLESS_RE = re.compile(r"<w:lastRenderedPageBreak\s*/>")


def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def unescape(text):
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


def visible(paragraph):
    """The text a reader sees, with the markup stripped (deleted text excluded)."""
    cleaned = re.sub(r"<w:del\b.*?</w:del>", "", paragraph, flags=re.S)
    return unescape(re.sub(r"<[^>]+>", "", re.sub(r"<w:delText\b.*?</w:delText>", "", cleaned, flags=re.S)))


def one_paragraph(xml, anchor):
    """
    The one paragraph whose visible text contains `anchor`. An anchor beginning with "=" must equal
    the whole visible text instead, for a table cell that says one word the book says everywhere.
    """
    if anchor.startswith("="):
        wanted = anchor[1:]
        hits = [m for m in PARA_RE.finditer(xml) if visible(m.group(0)).strip() == wanted]
    else:
        hits = [m for m in PARA_RE.finditer(xml) if anchor in visible(m.group(0))]
    if len(hits) != 1:
        raise SystemExit("anchor matched %d paragraphs, wanted exactly 1: %r" % (len(hits), anchor[:60]))
    return hits[0]


class Revisions:
    """Numbered, dated revision marks. Ids start high, clear of Word's own bookmarks and comments."""

    def __init__(self):
        self.next_id = 100000
        self.date = datetime.date.today().isoformat() + "T00:00:00Z"
        self.count = 0

    def attrs(self):
        self.next_id += 1
        self.count += 1
        return 'w:id="%d" w:author="%s" w:date="%s"' % (self.next_id, AUTHOR, self.date)

    def ins(self, inner):
        return "<w:ins %s>%s</w:ins>" % (self.attrs(), inner)

    def dele(self, inner):
        return "<w:del %s>%s</w:del>" % (self.attrs(), inner)

    def mark(self):
        return "<w:ins %s/>" % self.attrs()


def run_of(rpr, text, deleted=False):
    tag = "w:delText" if deleted else "w:t"
    return '<w:r>%s<%s xml:space="preserve">%s</%s></w:r>' % (rpr, tag, escape(text), tag)


def replace_tracked(xml, anchor, old, new, rev):
    """Strike `old` through and insert `new` after it, inside the one run that holds it."""
    match = one_paragraph(xml, anchor)
    return replace_at(xml, match.start(), match.end(), old, new, rev, anchor)


def replace_at(xml, start, end, old, new, rev, label=""):
    """replace_tracked's work on the paragraph that spans xml[start:end]."""
    paragraph = xml[start:end]
    anchor = label or visible(paragraph)[:40]
    if visible(paragraph).count(old) != 1:
        raise SystemExit("%r appears %d times in the paragraph for %r, wanted 1"
                         % (old[:50], visible(paragraph).count(old), anchor[:40]))
    for rm in RUN_RE.finditer(paragraph):
        run = rm.group(0)
        tokens = list(TEXT_RE.finditer(run))
        if len(tokens) != 1:
            continue
        text = unescape(tokens[0].group(2))
        if old not in text:
            continue
        rpr = RPR_RE.search(run)
        rpr = rpr.group(0) if rpr else ""
        # The run must be formatting plus that one text and nothing else, or splitting it would
        # drop a tab or a break on the floor.
        rest = run[run.find(">") + 1: run.rfind("</w:r>")]
        rest = rest.replace(rpr, "", 1)
        rest = rest[: tokens[0].start() - (run.find(">") + 1) - len(rpr)] + rest[tokens[0].end() - (run.find(">") + 1) - len(rpr):] \
            if False else HARMLESS_RE.sub("", TEXT_RE.sub("", rest))
        if rest.strip():
            raise SystemExit("the run holding %r carries more than text (%r); edit it by hand" % (old[:40], rest[:80]))
        pre, post = text.split(old, 1)
        pieces = []
        if pre:
            pieces.append(run_of(rpr, pre))
        pieces.append(rev.dele(run_of(rpr, old, deleted=True)))
        if new:
            pieces.append(rev.ins(run_of(rpr, new)))
        if post:
            pieces.append(run_of(rpr, post))
        edited = paragraph[: rm.start()] + "".join(pieces) + paragraph[rm.end():]
        return xml[:start] + edited + xml[end:]
    raise SystemExit("%r is split across runs in the paragraph for %r; shorten it to one run's worth"
                     % (old[:50], anchor[:40]))


def one_row(xml, row_anchor):
    """
    The one table row `row_anchor` names, as (names, start, row_xml). A row is named by one of its
    cells ("=Label", the row's own first cell, matched exactly), or by several exact cell texts
    that must all sit in it (["Berserker", "Rage"]) when the first alone is a cell somewhere else
    too. Tables are never numbered, so a table nested in a text box or a cell elsewhere in the
    book cannot shift the count; a row that nests a table of its own is refused.
    """
    names = list(row_anchor) if isinstance(row_anchor, (list, tuple)) else [row_anchor]
    first = names[0] if names[0].startswith("=") else "=" + names[0]
    candidates = []
    for pm in PARA_RE.finditer(xml):
        if visible(pm.group(0)).strip() != first[1:]:
            continue
        starts = [m.start() for m in ROW_START_RE.finditer(xml, 0, pm.start())]
        row_end = xml.find("</w:tr>", pm.end())
        if not starts or (row_end < 0):
            continue
        row_start = starts[-1]
        row = xml[row_start: row_end + len("</w:tr>")]
        cell_texts = [visible(c.group(0)).strip() for c in CELL_RE.finditer(row)]
        if all(n.lstrip("=") in cell_texts for n in names):
            candidates.append((row_start, row))
    if len(candidates) != 1:
        raise SystemExit("row %r matched %d table rows, wanted exactly 1" % (names, len(candidates)))
    row_start, row = candidates[0]
    if "<w:tbl>" in row:
        raise SystemExit("the row holding %r nests a table; edit it by hand" % names)
    return names, row_start, row


def cell_replace_tracked(xml, row_anchor, col, old, new, rev):
    """
    replace_tracked on the first paragraph of one table cell: the row is the one `row_anchor`
    names (see one_row), and the cell is the `col`th of that row. For a cell that says "3", which
    no anchor could tell from the other cells saying "3".
    """
    names, row_start, row = one_row(xml, row_anchor)
    cells = list(CELL_RE.finditer(row))
    if col >= len(cells):
        raise SystemExit("the row holding %r has %d cells, no cell %d" % (names, len(cells), col))
    cm = PARA_RE.search(cells[col].group(0))
    if not cm:
        raise SystemExit("cell %d of the row holding %r has no paragraph" % (col, names))
    start = row_start + cells[col].start() + cm.start()
    end = start + len(cm.group(0))
    label = "%s, cell %d" % ("/".join(n.lstrip("=") for n in names), col)
    # `old` None: the whole cell is rewritten, for a header Word has split into runs.
    if old is None:
        return rewrite_at(xml, start, end, new, rev, label)
    return replace_at(xml, start, end, old, new, rev, label)


def rewrite_tracked(xml, anchor, new, rev):
    """
    Strike every run of the paragraph through and insert `new` in the first run's formatting: for
    a line Word has split into many runs, where a one-run replace cannot land.
    """
    match = one_paragraph(xml, anchor)
    return rewrite_at(xml, match.start(), match.end(), new, rev, anchor)


def rewrite_at(xml, start, end, new, rev, label=""):
    """rewrite_tracked's work on the paragraph that spans xml[start:end]."""
    paragraph = xml[start:end]
    anchor = label or visible(paragraph)[:40]
    runs = list(RUN_RE.finditer(paragraph))
    if not runs:
        raise SystemExit("no runs in the paragraph for anchor %r" % anchor[:60])
    first_rpr = RPR_RE.search(runs[0].group(0))
    first_rpr = first_rpr.group(0) if first_rpr else ""
    edited = paragraph
    # Right to left, so earlier offsets stay valid; each run keeps its own formatting in the strike.
    for rm in reversed(runs):
        run = rm.group(0)
        tokens = list(TEXT_RE.finditer(run))
        rpr = RPR_RE.search(run)
        rpr = rpr.group(0) if rpr else ""
        text = "".join(unescape(t.group(2)) for t in tokens)
        struck = rev.dele(run_of(rpr, text, deleted=True)) if text else ""
        edited = edited[: rm.start()] + struck + edited[rm.end():]
    edited = edited[: edited.rfind("</w:p>")] + rev.ins(run_of(first_rpr, new)) + "</w:p>"
    return xml[:start] + edited + xml[end:]


def append_tracked(xml, anchor, addition, rev):
    match = one_paragraph(xml, anchor)
    paragraph = match.group(0)
    runs = RUN_RE.findall(paragraph)
    if not runs:
        raise SystemExit("no runs in the paragraph for anchor %r" % anchor[:60])
    rpr = RPR_RE.search(runs[-1])
    rpr = rpr.group(0) if rpr else ""
    edited = paragraph[: paragraph.rfind("</w:p>")] + rev.ins(run_of(rpr, addition)) + "</w:p>"
    return xml[: match.start()] + edited + xml[match.end():]


def inserted_ppr(ppr, rev):
    """
    A paragraph's properties with its paragraph mark recorded as inserted: the w:ins goes first
    inside w:pPr/w:rPr (the schema's order), which is created when the properties have none.
    """
    mark = rev.mark()
    opening = re.search(r"<w:rPr\b[^>]*/>|<w:rPr\b[^>]*>", ppr)
    if opening is None:
        return ppr[: ppr.rfind("</w:pPr>")] + "<w:rPr>%s</w:rPr></w:pPr>" % mark
    if opening.group(0).endswith("/>"):
        return ppr[: opening.start()] + "<w:rPr>%s</w:rPr>" % mark + ppr[opening.end():]
    return ppr[: opening.end()] + mark + ppr[opening.end():]


def insert_after_tracked(xml, anchor, text, rev):
    """A new paragraph after the anchor's, in its style, with its mark and its text both inserted."""
    match = one_paragraph(xml, anchor)
    paragraph = match.group(0)
    ppr = PPR_RE.search(paragraph)
    ppr = inserted_ppr(ppr.group(0) if ppr else "<w:pPr></w:pPr>", rev)
    runs = RUN_RE.findall(paragraph)
    rpr = RPR_RE.search(runs[0]) if runs else None
    rpr = rpr.group(0) if rpr else ""
    new_paragraph = "<w:p>%s%s</w:p>" % (ppr, rev.ins(run_of(rpr, text)))
    return xml[: match.end()] + new_paragraph + xml[match.end():]


def row_insert_tracked(xml, row_anchor, position, cells, rev):
    """
    A new table row "before" or "after" the one `row_anchor` names (see one_row), cut from that
    row's own XML: it keeps each cell's properties (width, borders, shading, margins), the row's
    properties (cantSplit, a fixed height), the paragraph properties of each cell's first
    paragraph and the run properties of its first run. Each cell becomes one paragraph holding
    one run of its text from `cells`, which gives one text per cell of the anchor row. Word sees
    an inserted row: the row mark (w:trPr/w:ins, created when the row has no w:trPr), each
    paragraph mark (w:pPr/w:rPr/w:ins) and each run (w:ins) are all revisions by AUTHOR, so the
    row shows as one insertion and Reject removes it whole. The copy carries none of the
    anchor's paragraph or revision ids, which Word wants unique.
    """
    if position not in ("before", "after"):
        raise SystemExit("row position must be 'before' or 'after', not %r" % (position,))
    names, row_start, row = one_row(xml, row_anchor)
    tcs = list(CELL_RE.finditer(row))
    if not tcs:
        raise SystemExit("the row holding %r has no cells" % (names,))
    if len(cells) != len(tcs):
        raise SystemExit("the row holding %r has %d cells; %d texts were given" % (names, len(tcs), len(cells)))
    # Row properties: the anchor's, gaining the insertion mark. In w:trPr the mark sits after the
    # row's own properties and before any w:del or w:trPrChange, as the schema orders them.
    head = row[: tcs[0].start()]
    mark = rev.mark()
    trpr = TRPR_RE.search(head)
    if trpr is None or trpr.group(0).endswith("/>"):
        trpr_xml = "<w:trPr>%s</w:trPr>" % mark
    else:
        block = trpr.group(0)
        later = re.search(r"<w:del\b|<w:trPrChange\b", block)
        at = later.start() if later else block.rfind("</w:trPr>")
        trpr_xml = block[:at] + mark + block[at:]
    tblprex = TBLPREX_RE.search(head)
    parts = ["<w:tr>", tblprex.group(0) if tblprex else "", trpr_xml]
    for tc, text in zip(tcs, cells):
        cell = tc.group(0)
        tcpr = TCPR_RE.search(cell)
        pm = PARA_RE.search(cell)
        if not pm:
            raise SystemExit("a cell of the row holding %r has no paragraph; edit it by hand" % (names,))
        paragraph = pm.group(0)
        ppr = PPR_RE.search(paragraph)
        ppr = inserted_ppr(ppr.group(0) if ppr else "<w:pPr></w:pPr>", rev)
        runs = RUN_RE.findall(paragraph)
        rpr = RPR_RE.search(runs[0]) if runs else None
        rpr = rpr.group(0) if rpr else ""
        parts.append("<w:tc>%s<w:p>%s%s</w:p></w:tc>" % (tcpr.group(0) if tcpr else "", ppr, rev.ins(run_of(rpr, text))))
    parts.append("</w:tr>")
    new_row = "".join(parts)
    at = row_start if position == "before" else row_start + len(row)
    return xml[:at] + new_row + xml[at:]


def main():
    argv = sys.argv[1:]
    # Several proposals may stack into one file (--proposal armor-balance --proposal vigor), applied
    # in the order given, so Mike reviews one document.
    names = []
    while "--proposal" in argv:
        i = argv.index("--proposal")
        if i + 1 >= len(argv):
            raise SystemExit(__doc__ + "\n--proposal needs a name")
        names.extend(n for n in argv[i + 1].split(",") if n)
        del argv[i: i + 2]
    for a in list(argv):
        if a.startswith("--proposal="):
            names.extend(n for n in a.split("=", 1)[1].split(",") if n)
            argv.remove(a)
    force = "--force" in argv
    args = [a for a in argv if not a.startswith("--")]
    src = args[0] if len(args) > 0 else None
    dest = args[1] if len(args) > 1 else None
    unknown = [n for n in names if n not in PROPOSALS]
    if not src or not dest or not names or unknown:
        raise SystemExit(__doc__ + "\nknown proposals: " + ", ".join(sorted(PROPOSALS)))

    if os.path.abspath(src) == os.path.abspath(dest):
        raise SystemExit("source and destination are the same file; a proposal is a new file")
    if EDITION_PATTERN.match(os.path.basename(dest)):
        raise SystemExit("%s would be taken for an edition by build_all.mjs; name a proposal <name>_proposal.docx" % dest)
    if os.path.exists(dest) and not force:
        raise SystemExit("%s already exists; pass --force to replace it" % dest)

    with zipfile.ZipFile(src) as z:
        entries = [(i, z.read(i.filename)) for i in z.infolist()]
    xml = next((data.decode("utf-8") for info, data in entries if info.filename == "word/document.xml"), None)
    if xml is None:
        raise SystemExit("no word/document.xml in %s" % src)
    before = len(xml)

    rev = Revisions()
    for name in names:
        proposal = PROPOSALS[name]
        edition_line = "PLAYTEST EDITION v%s" % proposal["from"]
        if not any(edition_line in visible(m.group(0)) for m in PARA_RE.finditer(xml)):
            raise SystemExit("this is not a v%s handbook: no %r line" % (proposal["from"], edition_line))
        print("proposal %s:" % name)
        for anchor, old, new in proposal.get("replace", []):
            xml = replace_tracked(xml, anchor, old, new, rev)
            print("  replaced in:    %s..." % anchor.strip()[:56])
        for anchor, new in proposal.get("rewrite", []):
            xml = rewrite_tracked(xml, anchor, new, rev)
            print("  rewrote:        %s..." % anchor.strip()[:56])
        for row_anchor, col, old, new in proposal.get("cell", []):
            xml = cell_replace_tracked(xml, row_anchor, col, old, new, rev)
            shown = "/".join(row_anchor) if isinstance(row_anchor, (list, tuple)) else row_anchor
            print("  cell:           row %s, cell %d: %r -> %r" % (shown, col, old, new))
        for row_anchor, position, cells in proposal.get("row", []):
            xml = row_insert_tracked(xml, row_anchor, position, cells, rev)
            shown = "/".join(row_anchor) if isinstance(row_anchor, (list, tuple)) else row_anchor
            print("  row:            %s row %s: %r" % (position, shown[:56], cells))
        for anchor, addition in proposal.get("append", []):
            xml = append_tracked(xml, anchor, addition, rev)
            print("  appended to:    %s..." % anchor.strip()[:56])
        for anchor, text in proposal.get("insert_after", []):
            xml = insert_after_tracked(xml, anchor, text, rev)
            print("  inserted after: %s..." % anchor.strip()[:56])
    print("  %d revision marks; document.xml %d -> %d bytes" % (rev.count, before, len(xml)))

    tmp = dest + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for info, data in entries:
            if info.filename == "word/document.xml":
                data = xml.encode("utf-8")
            out.writestr(info, data)
    os.replace(tmp, dest)
    print("wrote %s" % dest)


if __name__ == "__main__":
    main()
