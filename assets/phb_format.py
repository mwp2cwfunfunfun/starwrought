# -*- coding: utf-8 -*-
"""
phb_format.py: the formatting pass over a Player's Handbook .docx, written to a NEW file.

The handbook is Mike's Word document and he writes its text. This script never changes a character
of that text. It reads the newest handbook, turns the author's formatting conventions into Word
styles (character styles for the kinds of thing the rules name, one table style for every data
table, the heading look moved into the heading styles), applies them, and writes a new file.
word/document.xml and word/styles.xml are rewritten; every other zip entry is copied through byte
for byte, and the source is never written. `handbook-style.md` in the project root says the same
conventions in prose, for the author.

The passes, in order; each works on the output of the one before:

   1. tables      every table with two or more columns takes the table style SW Table (teal header
                  row with white bold text, automatic banding, 9.5pt body, light borders), and the
                  hand-painted shading, borders and sizes the style now supplies come off
   2. headings    Heading 1 to 3 carry bold, color and size in the style, not on every run
   3. meta lines  "Skill Constellation • Agility" and its siblings take SW Constellation Meta
   4. ranks       the rank table's Trained, Expert, Master and Legendary, and the Tier letter of
                  every Talent, take the four rank styles
   5. name cells  the Talent column of every Talent table takes SW Talent Name
   6. key terms   the bold lead of every Key Terms entry takes SW Key Term
   7. highlights  every highlighted run takes SW Trait (SW Talent, when it is a Talent name)
   8. as found    an italic run that is exactly a Constellation or Talent name, an underlined run,
                  and a bold run that is exactly a Defined Term take the matching style
   9. dictionary  multiword Talent names, the Skill and Combat Style names, the unambiguous Trait
                  words, Conditions and section references are found in prose and table body cells
                  and styled, the run split around the term
  10. glyphs      ⓿ ❶ ❷ ❸ ❹ ❺ ❻ ↺ take SW Action Glyph, split out of the run that holds them

  run:  python assets/phb_format.py Starwrought_Players_Handbook_v4.14.docx <out>.docx [--force] [--verbose]

It prints what it applied, what it skipped and what it leaves to the author, and running it on its
own output changes nothing (a run already carrying an SW style is never split or restyled). The
conventions are the CONVENTIONS table below; the dictionaries come from the repository
(assets/trees.json, roster.json, actions.json) and from the handbook itself (its headings and its
Key Terms leads), so the next edition is formatted by rerunning the script.
"""
import json
import os
import re
import shutil
import sys
import zipfile
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ----------------------------------------------------------------------------------------------
# The conventions, as data. "strip" is the direct run formatting the style now supplies, removed
# from a run when the style is applied; everything else on the run is kept.
# ----------------------------------------------------------------------------------------------

CONVENTIONS = [
    dict(n=2, kind="Data table", style="SwTable", look="teal 0E5F6B header row, bold white text; body 9.5pt; "
         "rows band white then warm grey F2F0EA; 0.5pt CBD5DB borders; cell margins 40/80 twips",
         where="every top-level table with two or more grid columns; never the cover table or a one-column callout box"),
    dict(n=3, kind="Heading 1", style="Heading1", look="bold teal 0E5F6B 20pt, in the style", where="pStyle Heading1"),
    dict(n=4, kind="Heading 2", style="Heading2", look="bold orange E2703A 14pt, in the style", where="pStyle Heading2"),
    dict(n=5, kind="Heading 3", style="Heading3", look="bold slate 1D2A32 11.5pt, in the style (and Heading 3 Char)", where="pStyle Heading3"),
    dict(n=6, kind="Heading 4", style="Heading4", look="unchanged: italic blue 2E74B5", where="nothing to do"),
    dict(n=7, kind="Constellation meta line", style="SwMeta", look="italic teal 0E5F6B 10pt, paragraph style",
         where="a prose paragraph whose every run is exactly italic teal 10pt"),
    dict(n=8, kind="Trait", style="SwTrait", look="bold, pale sage DBE5DE character shading (no highlight)",
         where="every highlighted run as found; a Trait word before the word trait; the unambiguous Trait words by dictionary"),
    dict(n=9, kind="Constellation", style="SwConstellation", look="italic",
         where="an italic run that is exactly a name; the Skill and Combat Style names by dictionary; 'Evade Defense', 'Lore Constellation' and the like by pattern"),
    dict(n=10, kind="Talent", style="SwTalent", look="italic",
         where="an italic run that is exactly a name; multiword names by dictionary; a single-word name as the whole text of a body cell"),
    dict(n=11, kind="Talent name in its own row", style="SwTalentName", look="bold", where="the first cell of every body row of a table headed Talent"),
    dict(n=12, kind="Condition", style="SwCondition", look="no visible properties: plain Title Case", where="by dictionary in prose and body cells"),
    dict(n=13, kind="Defined Term at its definition", style="SwKeyTerm", look="bold", where="the bold lead ending in a period of every Key Terms entry"),
    dict(n=14, kind="Defined Term at its first use", style="SwFirstUse", look="bold",
         where="a bold run in prose or a callout that is exactly a Defined Term, Condition, Maneuver or Activity name (plural allowed)"),
    dict(n=15, kind="Section reference", style="SwRef", look="single underline, body color",
         where="an underlined run as found; 'Chapter N' and 'Chapter N: <heading>'; 'see <heading>' and 'under <heading>'"),
    dict(n=16, kind="Rank word", style="SwRankTrained SwRankExpert SwRankMaster SwRankLegendary",
         look="bold green 4A7C59, teal 0E5F6B, rust C05621, gold B8860B", where="the first cell of the rank table's body rows only"),
    dict(n=17, kind="Tier letter", style="the four rank styles", look="T green, E teal, M rust, L gold, bold", where="the Tier column of every Talent table"),
    dict(n=18, kind="Action glyph", style="SwGlyph", look="Segoe UI Symbol, never bold or italic", where="every ⓿ ❶ ❷ ❸ ❹ ❺ ❻ ↺ in the body"),
    dict(n=19, kind="Maneuver or Activity in running text", style="", look="plain Title Case and its glyph", where="nothing to do; the glyph is the marker"),
    dict(n=20, kind="Cover, contents, opening fiction", style="", look="untouched", where="everything before Heading 1 '1. Welcome to STARWROUGHT', and the contents field"),
    dict(n=21, kind="Body prose and callout boxes", style="", look="untouched", where="Normal and List Paragraph stay; the 22 one-column callout boxes keep their look"),
]

# Character styles: id, name in Word's style pane, run properties.
CHARACTER_STYLES = [
    ("SwTrait", "SW Trait", '<w:b/><w:bCs/><w:shd w:val="clear" w:color="auto" w:fill="DBE5DE"/>'),
    ("SwConstellation", "SW Constellation", "<w:i/><w:iCs/>"),
    ("SwTalent", "SW Talent", "<w:i/><w:iCs/>"),
    ("SwTalentName", "SW Talent Name", "<w:b/><w:bCs/>"),
    ("SwCondition", "SW Condition", ""),
    ("SwKeyTerm", "SW Key Term", "<w:b/><w:bCs/>"),
    ("SwFirstUse", "SW First Use", "<w:b/><w:bCs/>"),
    ("SwRef", "SW Section Reference", '<w:u w:val="single"/>'),
    ("SwRankTrained", "SW Rank Trained", '<w:b/><w:bCs/><w:color w:val="4A7C59"/>'),
    ("SwRankExpert", "SW Rank Expert", '<w:b/><w:bCs/><w:color w:val="0E5F6B"/>'),
    ("SwRankMaster", "SW Rank Master", '<w:b/><w:bCs/><w:color w:val="C05621"/>'),
    ("SwRankLegendary", "SW Rank Legendary", '<w:b/><w:bCs/><w:color w:val="B8860B"/>'),
    ("SwGlyph", "SW Action Glyph",
     '<w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol" w:eastAsia="Segoe UI Symbol"/>'),
]

# The direct run properties each style supplies, stripped from a run when the style is applied.
STRIP = {
    "SwTrait": ("highlight", "b", "bCs", "shd"),
    "SwConstellation": ("i", "iCs", "highlight"),
    "SwTalent": ("i", "iCs", "highlight"),
    "SwTalentName": ("b", "bCs"),
    "SwCondition": (),
    "SwKeyTerm": ("b", "bCs"),
    "SwFirstUse": ("b", "bCs"),
    "SwRef": ("u",),
    "SwRankTrained": ("b", "bCs", "color"),
    "SwRankExpert": ("b", "bCs", "color"),
    "SwRankMaster": ("b", "bCs", "color"),
    "SwRankLegendary": ("b", "bCs", "color"),
    "SwGlyph": ("rFonts", "b", "bCs", "i", "iCs"),
}

RANK_STYLE = {"Trained": "SwRankTrained", "Expert": "SwRankExpert", "Master": "SwRankMaster", "Legendary": "SwRankLegendary"}
TIER_STYLE = {"T": "SwRankTrained", "E": "SwRankExpert", "M": "SwRankMaster", "L": "SwRankLegendary"}

META_STYLE = (
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="SwMeta"><w:name w:val="SW Constellation Meta"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="1"/><w:qFormat/>'
    '<w:rPr><w:i/><w:iCs/><w:color w:val="0E5F6B"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>'
)

# The table style. No band1Horz block: the first body row stays unshaded and the second takes the
# warm grey, which is the author's white-first pattern in 60 of his 74 tables.
TABLE_STYLE = (
    '<w:style w:type="table" w:customStyle="1" w:styleId="SwTable"><w:name w:val="SW Table"/>'
    '<w:basedOn w:val="TableNormal"/><w:uiPriority w:val="99"/>'
    '<w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr>'
    '<w:tblPr><w:tblStyleRowBandSize w:val="1"/><w:tblBorders>'
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5DB"/>'
    '</w:tblBorders><w:tblCellMar>'
    '<w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>'
    '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/>'
    '</w:tblCellMar></w:tblPr>'
    '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/></w:rPr>'
    '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0E5F6B"/><w:vAlign w:val="center"/></w:tcPr></w:tblStylePr>'
    '<w:tblStylePr w:type="band2Horz"><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F0EA"/></w:tcPr></w:tblStylePr>'
    '</w:style>'
)

# Heading styles: the run properties every heading run carried directly, moved into the style.
HEADING_RPR = {
    "Heading1": ("0E5F6B", "40"),
    "Heading2": ("E2703A", "28"),
    "Heading3": ("1D2A32", "23"),
}

# Manual table formatting the table style replaces.
TABLE_FILLS_REMOVED = ("F2F0EA", "FFFFFF", "0E5F6B")

# Trait words that are a Trait every time they are capitalised in the book, checked one by one
# against v4.14 ("Unwieldy weapon", "Deadly die", "Agile weapons", "Attended piece", "not
# Weighted"). The other Trait words (Attack, Reaction, Ranged, Close, Parry, Trip, Grapple, Shove,
# Disarm, Press, Prepared, Motion, Move, Sweep and the five materials) are also ordinary words or
# other kinds of thing somewhere in the book, and are styled only where the author highlighted
# them or wrote "the X trait".
TRAIT_WORDS_UNAMBIGUOUS = [
    "Finesse", "Flexible", "Unparryable", "Massive", "Weighted", "Flourish", "Concentrate", "Auditory",
    "Visual", "Mental", "Emotion", "Manipulate", "Stance", "Noisy", "Quiet", "Comfort", "Attended", "Agile",
    "Nonlethal", "Mechanical", "Two-Handed", "Two-Hand", "Unwieldy", "Armor-Piercing", "Versatile", "Deadly",
    "Capacity", "Reload", "Thrown",
]
# Trait words the book does not list in a Traits table but prints as Traits.
TRAIT_WORDS_EXTRA = ["Flourish"]

# Constellation names that are never ordinary words in the book: italic wherever they appear.
CONSTELLATIONS_UNAMBIGUOUS = [
    "Two-Weapon Fighting", "Shield Fighting", "Great Weapon Fighting", "Crossbow Fighting", "Missile Skirmishing",
    "Spear & Polearm Fighting", "Armored Fighting", "Acrobatics", "Athletics", "Diplomacy", "Guile", "Intimidation",
    "Stealth", "Brawling", "Dueling", "Archery",
]
# Constellation names that are also verbs, attributes or a people: italic only where the author
# italicised them, or where "Defense" or "Constellation" follows ("your Evade Defense").
CONSTELLATIONS_BY_PATTERN = ["Evade", "Guard", "Endure", "Awareness", "Melee", "Ranged", "Lore"]

# Defined Terms introduced outside Key Terms, bold where the author bolded them as a whole run.
FIRST_USE_EXTRA = [
    "Attack", "Defense", "Result", "Damage", "Position",
    "Encounter Mode", "Exploration Mode", "Downtime Mode",
    "Proficiency Bonus", "Load Strain", "Strike Attribute",
    "Hit", "Critical Hit", "Miss", "Critical Miss", "Stopped",
]

GLYPHS = "⓿❶❷❸❹❺❻↺"
GLYPH_RUN_RE = re.compile("[%s]+" % GLYPHS)
WELCOME_HEADING = "1. Welcome to STARWROUGHT"
APPENDIX_HEADING = "Appendix A"
KEY_TERMS_HEADING = "Key Terms"

# ----------------------------------------------------------------------------------------------
# XML plumbing
# ----------------------------------------------------------------------------------------------

PARA_RE = re.compile(r"<w:p\b[^>]*/>|<w:p\b[^>]*>.*?</w:p>", re.S)
RUN_RE = re.compile(r"<w:r\b[^>]*>.*?</w:r>", re.S)
TEXT_RE = re.compile(r"<w:t\b[^>]*>(.*?)</w:t>", re.S)
ROW_RE = re.compile(r"<w:tr\b[^>]*>.*?</w:tr>", re.S)
CELL_RE = re.compile(r"<w:tc\b[^>]*>.*?</w:tc>", re.S)
TCPR_RE = re.compile(r"<w:tcPr>.*?</w:tcPr>", re.S)
TBLPR_RE = re.compile(r"<w:tblPr>.*?</w:tblPr>", re.S)
HYPERLINK_RE = re.compile(r"<w:hyperlink\b.*?</w:hyperlink>", re.S)
BLOCK_TAG_RE = re.compile(r"<w:p\b[^>]*/>|<w:p\b[^>]*>|</w:p>|<w:tbl>|</w:tbl>|<w:sdt>|</w:sdt>")
RPR_CHILD_RE = re.compile(r"<([\w:]+)\b[^>]*/>|<([\w:]+)\b[^>]*>.*?</\2>", re.S)
DISPLAY_RE = re.compile(r"<w:t\b[^>]*>(?P<t>.*?)</w:t>|(?P<tab><w:tab\s*/>)|(?P<br><w:br\b[^>]*/>|<w:cr\s*/>)|<[^>]+>", re.S)

# The schema's order of run properties, so an element can be inserted where Word expects it.
RPR_ORDER = [
    "rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow",
    "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern",
    "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs",
    "em", "lang", "eastAsianLayout", "specVanish", "oMath",
]


def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def unescape(text):
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


def plain(fragment):
    """The visible text of a fragment of document XML: its w:t contents, unescaped."""
    return "".join(unescape(t) for t in TEXT_RE.findall(fragment))


RIGHT_QUOTE, LEFT_QUOTE, EM_DASH = chr(0x2019), chr(0x2018), chr(0x2014)
APOSTROPHE_CLASS = "['" + RIGHT_QUOTE + LEFT_QUOTE + "]"


def straight(text):
    """Apostrophes normalised for comparison only; the document's own text is never altered."""
    return text.replace(RIGHT_QUOTE, "'").replace(LEFT_QUOTE, "'")


def rpr_children(inner):
    """A run's properties as a list of (tag, xml) in document order; 'b' for w:b, 'w14:x' kept whole."""
    out = []
    for m in RPR_CHILD_RE.finditer(inner):
        tag = m.group(1) or m.group(2)
        if tag.startswith("w:"):
            tag = tag[2:]
        out.append((tag, m.group(0)))
    return out


def rpr_val(children, tag):
    for t, x in children:
        if t == tag:
            m = re.search(r'w:val="([^"]*)"', x)
            return m.group(1) if m else ""
    return None


def is_on(children, tag):
    """A toggle property (b, i, ...) is on when present without w:val 0 or false."""
    v = rpr_val(children, tag)
    return v is not None and v not in ("0", "false")


def rpr_insert(children, tag, xml):
    """Insert an element at its place in the schema order (an unknown tag goes at the end)."""
    rank = RPR_ORDER.index(tag) if tag in RPR_ORDER else len(RPR_ORDER)
    out = []
    done = False
    for t, x in children:
        r = RPR_ORDER.index(t) if t in RPR_ORDER else len(RPR_ORDER)
        if not done and r > rank:
            out.append((tag, xml))
            done = True
        out.append((t, x))
    if not done:
        out.append((tag, xml))
    return out


def build_rpr(children):
    if not children:
        return ""
    return "<w:rPr>%s</w:rPr>" % "".join(x for _, x in children)


def styled(children, style_id, extra_strip=()):
    """The run properties with `style_id` as the first child and what it supplies stripped."""
    drop = set(STRIP[style_id]) | set(extra_strip)
    kept = [(t, x) for t, x in children if t not in drop and t != "rStyle"]
    return [("rStyle", '<w:rStyle w:val="%s"/>' % style_id)] + kept


class Run:
    """One w:r: its opening tag, its properties, what follows them, and the text a reader sees."""

    def __init__(self, m, para_xml, hyperlinks, field_depth):
        self.start, self.end = m.start(), m.end()
        xml = m.group(0)
        open_m = re.match(r"<w:r\b[^>]*>", xml)
        self.open_tag = open_m.group(0)
        inner = xml[open_m.end(): -len("</w:r>")]
        rpr_m = re.match(r"<w:rPr>(.*?)</w:rPr>|<w:rPr/>", inner, re.S)
        if rpr_m:
            self.children = rpr_children(rpr_m.group(1) or "")
            self.body = inner[rpr_m.end():]
        else:
            self.children = []
            self.body = inner
        self.text = plain(self.body)
        # A run that holds anything but text (a tab, a break, a drawing, a field code, a comment
        # reference) is never split; the text runs are the ones a term can be cut out of.
        rest = TEXT_RE.sub("", self.body)
        self.text_only = re.sub(r"<w:lastRenderedPageBreak\s*/>", "", rest).strip() == "" and "<w:t" in self.body
        self.in_hyperlink = any(s <= self.start < e for s, e in hyperlinks)
        self.in_field = field_depth > 0 or "<w:fldChar" in self.body or "<w:instrText" in self.body
        self.rstyle = rpr_val(self.children, "rStyle")
        # For word boundaries across runs: what a reader sees, with tabs and breaks as whitespace.
        if self.text_only:
            self.display = self.text
        else:
            shown = []
            for dm in DISPLAY_RE.finditer(self.body):
                if dm.group("t") is not None:
                    shown.append(unescape(dm.group("t")))
                elif dm.group("tab"):
                    shown.append("\t")
                elif dm.group("br"):
                    shown.append("\n")
            self.display = "".join(shown)

    @property
    def bold(self):
        return is_on(self.children, "b")

    @property
    def italic(self):
        return is_on(self.children, "i")

    def has(self, tag):
        return rpr_val(self.children, tag) is not None

    def sw_styled(self):
        return bool(self.rstyle) and self.rstyle.startswith("Sw")

    def rebuild(self, children, body=None):
        return "%s%s%s</w:r>" % (self.open_tag, build_rpr(children), self.body if body is None else body)

    def restyled(self, style_id, extra_strip=()):
        return self.rebuild(styled(self.children, style_id, extra_strip))

    def split(self, segments):
        """
        The run cut into pieces: `segments` is a sorted list of (start, end, style_id) over
        self.text; the pieces between them keep the run's own properties, each named piece gets
        its style as the first property and loses what the style supplies.
        """
        pieces, pos = [], 0
        for s, e, sid in segments:
            if s > pos:
                pieces.append((self.text[pos:s], None))
            pieces.append((self.text[s:e], sid))
            pos = e
        if pos < len(self.text):
            pieces.append((self.text[pos:], None))
        out = []
        for text, sid in pieces:
            children = self.children if sid is None else styled(self.children, sid)
            out.append('%s%s<w:t xml:space="preserve">%s</w:t></w:r>' % (self.open_tag, build_rpr(children), escape(text)))
        return "".join(out)


class Para:
    """One paragraph and where it sits: top-level or in a table cell, and in which section."""

    def __init__(self, xml, start, end):
        self.start, self.end = start, end
        self.xml = xml[start:end]
        m = re.search(r'<w:pStyle w:val="([^"]+)"', self.xml)
        self.pstyle = m.group(1) if m else None
        self.heading = int(self.pstyle[7:]) if self.pstyle and re.match(r"Heading\d$", self.pstyle) else None
        self.table = None
        self.row = self.cell = None
        self.header_row = self.first_cell = self.traits_col = False
        self.cell_text_paras = 1
        self.section = "body"
        self.field_open = False
        self._runs = None
        self._text = None

    @property
    def text(self):
        if self._text is None:
            self._text = plain(self.xml)
        return self._text

    @property
    def runs(self):
        if self._runs is None:
            hyperlinks = [(m.start(), m.end()) for m in HYPERLINK_RE.finditer(self.xml)]
            depth = 1 if self.field_open else 0
            runs = []
            for m in RUN_RE.finditer(self.xml):
                run = Run(m, self.xml, hyperlinks, depth)
                depth += m.group(0).count('w:fldCharType="begin"') - m.group(0).count('w:fldCharType="end"')
                runs.append(run)
            self._runs = runs
        return self._runs

    @property
    def context(self):
        """PROSE, CALLOUT, BODY (a data table's body cell) or None, for the dictionary passes."""
        if self.section != "body" or self.heading is not None:
            return None
        if self.table is None:
            return "PROSE" if self.pstyle in (None, "ListParagraph") else None
        if self.table.cover:
            return None
        if self.table.callout:
            return "CALLOUT"
        if self.header_row or self.first_cell or self.traits_col:
            return None
        return "BODY"

    def rebuild(self, edits):
        """The paragraph with (start, end, replacement) edits applied, right to left."""
        out = self.xml
        for s, e, new in sorted(edits, key=lambda t: -t[0]):
            out = out[:s] + new + out[e:]
        return out


class Cell:
    def __init__(self, start, end, col, span, paras, tcpr):
        self.start, self.end, self.col, self.span, self.paras, self.tcpr = start, end, col, span, paras, tcpr
        self.text = "".join(p.text for p in paras)


class Table:
    """One top-level table, its rows and cells; a table nested in a cell is masked and never read."""

    def __init__(self, xml, start, end, index):
        self.start, self.end, self.index = start, end, index
        self.label = "T%02d" % index
        raw = xml[start:end]
        masked = raw
        depth = 0
        spans = []
        for m in re.finditer(r"<w:tbl>|</w:tbl>", raw):
            if m.group(0) == "<w:tbl>":
                depth += 1
                if depth == 2:
                    nest_start = m.start()
            else:
                if depth == 2:
                    spans.append((nest_start, m.end()))
                depth -= 1
        for s, e in spans:
            masked = masked[:s] + "\x00" * (e - s) + masked[e:]
        self.nested = len(spans)
        self.masked = masked
        tblpr = TBLPR_RE.search(masked)
        self.tblpr = (tblpr.start(), tblpr.end())
        grid = re.search(r"<w:tblGrid>.*?</w:tblGrid>", masked, re.S)
        self.grid = grid.group(0).count("<w:gridCol") if grid else 0
        self.rows = []
        for rm in ROW_RE.finditer(masked):
            cells, col = [], 0
            for cm in CELL_RE.finditer(rm.group(0)):
                cell_xml = cm.group(0)
                tcpr = TCPR_RE.match(cell_xml, re.match(r"<w:tc\b[^>]*>", cell_xml).end())
                span_m = re.search(r'<w:gridSpan w:val="(\d+)"', tcpr.group(0)) if tcpr else None
                span = int(span_m.group(1)) if span_m else 1
                base = start + rm.start() + cm.start()
                paras = [Para(xml, base + pm.start(), base + pm.end()) for pm in PARA_RE.finditer(cell_xml)]
                cells.append(Cell(base, base + len(cell_xml), col, span, paras, (base + tcpr.start(), base + tcpr.end()) if tcpr else None))
                col += span
            self.rows.append((start + rm.start(), start + rm.end(), cells))
        self.header = self.rows[0][2] if self.rows else []
        self.header_texts = [c.text.strip() for c in self.header]
        self.cover = index == 1
        self.callout = self.grid < 2 and not self.cover
        self.sw = self.grid >= 2
        for ri, (rs, re_, cells) in enumerate(self.rows):
            for ci, cell in enumerate(cells):
                header = self.header_cell_for(cell, cells)
                text_paras = sum(1 for p in cell.paras if p.text.strip())
                for p in cell.paras:
                    p.table, p.row, p.cell = self, ri, ci
                    p.header_row = ri == 0
                    p.first_cell = ci == 0 and self.sw
                    p.traits_col = ri > 0 and header is not None and header.text.strip() in ("Traits", "Trait")
                    p.cell_text_paras = text_paras

    def header_cell_for(self, cell, row_cells):
        """
        The header cell above a body cell: the same position when the row has the header's
        number of cells (a row's spans can differ from the header's, as T65's last row does), else
        the header cell its grid columns overlap most.
        """
        if len(row_cells) == len(self.header):
            return self.header[row_cells.index(cell)]
        best, best_overlap = None, 0
        for c in self.header:
            overlap = min(c.col + c.span, cell.col + cell.span) - max(c.col, cell.col)
            if overlap > best_overlap:
                best, best_overlap = c, overlap
        return best

    def column_cell(self, header_cell, row_cells):
        """The body cell under a header cell, by the same rule."""
        if len(row_cells) == len(self.header):
            return row_cells[self.header.index(header_cell)]
        return next((c for c in row_cells if self.header_cell_for(c, row_cells) is header_cell), None)

    def body_rows(self):
        return self.rows[1:]

    def paras(self):
        for _, _, cells in self.rows:
            for c in cells:
                for p in c.paras:
                    yield p


class Model:
    """The document as paragraphs and top-level tables, with sections, built fresh for each pass."""

    def __init__(self, xml):
        self.xml = xml
        self.paras = []
        self.tables = []
        body = re.search(r"<w:body>", xml)
        self.body_start, self.body_end = body.end(), xml.rfind("</w:body>")
        depth_tbl = depth_sdt = 0
        p_start = t_start = None
        for m in BLOCK_TAG_RE.finditer(xml, self.body_start, self.body_end):
            tag = m.group(0)
            if tag == "<w:tbl>":
                if depth_tbl == 0 and depth_sdt == 0:
                    t_start = m.start()
                depth_tbl += 1
            elif tag == "</w:tbl>":
                depth_tbl -= 1
                if depth_tbl == 0 and depth_sdt == 0:
                    self.tables.append(Table(xml, t_start, m.end(), len(self.tables) + 1))
            elif tag == "<w:sdt>":
                depth_sdt += 1
            elif tag == "</w:sdt>":
                depth_sdt -= 1
            elif depth_tbl == 0 and depth_sdt == 0:
                if tag == "</w:p>":
                    self.paras.append(Para(xml, p_start, m.end()))
                elif not tag.endswith("/>"):
                    p_start = m.start()
        for t in self.tables:
            self.paras.extend(t.paras())
        self.paras.sort(key=lambda p: p.start)
        # Fields can run across paragraphs (the contents field does): a paragraph that starts
        # inside one is left alone whole.
        depth = 0
        for p in self.paras:
            p.field_open = depth > 0
            depth += p.xml.count('w:fldCharType="begin"') - p.xml.count('w:fldCharType="end"')
        # Sections: before the Welcome heading nothing is touched. Appendix A was the book's own style
        # guide through v4.14 and is treated as its own section where it exists; Mike removed it in
        # v4.15 once handbook-style.md took over its job, so a handbook without it runs the body to
        # the end of the document.
        welcome = [p for p in self.paras if p.heading == 1 and p.text.strip().startswith(WELCOME_HEADING)]
        appendix = [p for p in self.paras if p.heading == 1 and p.text.strip().startswith(APPENDIX_HEADING)]
        if len(welcome) != 1 or len(appendix) > 1:
            raise SystemExit("this does not look like the handbook: Heading 1 %r found %d times, %r %d times"
                             % (WELCOME_HEADING, len(welcome), APPENDIX_HEADING, len(appendix)))
        self.welcome_start = welcome[0].start
        self.appendix_start = appendix[0].start if appendix else len(self.xml) + 1
        for p in self.paras:
            p.section = "pre" if p.start < self.welcome_start else ("appendix" if p.start >= self.appendix_start else "body")
        for t in self.tables:
            t.section = "pre" if t.start < self.welcome_start else ("appendix" if t.start >= self.appendix_start else "body")

    def top_paras(self):
        return [p for p in self.paras if p.table is None]

    def headings(self, level=None):
        return [p for p in self.top_paras() if p.heading is not None and (level is None or p.heading == level)]

    def apply(self, edits):
        """A new document XML with non-overlapping (start, end, replacement) edits applied."""
        edits = sorted(edits, key=lambda t: t[0])
        out, last = [], 0
        for s, e, new in edits:
            if s < last:
                raise SystemExit("internal error: overlapping edits at %d" % s)
            out.append(self.xml[last:s])
            out.append(new)
            last = e
        out.append(self.xml[last:])
        return "".join(out)


# ----------------------------------------------------------------------------------------------
# The dictionaries
# ----------------------------------------------------------------------------------------------

def strip_glyphs(name):
    return re.sub("[%s]" % GLYPHS, "", name).strip()


def condition_name(label):
    return re.sub(r"\s*(N|\[X\]|\[Zone\])$", "", label).strip()


class Dictionaries:
    def __init__(self, root):
        trees = json.load(open(os.path.join(root, "assets", "trees.json"), encoding="utf-8"))
        roster = json.load(open(os.path.join(root, "assets", "roster.json"), encoding="utf-8"))
        actions = json.load(open(os.path.join(root, "assets", "actions.json"), encoding="utf-8"))
        self.constellations = list(trees.keys())
        talents = []
        for tree in trees.values():
            for node in tree.get("nodes", []):
                talents.append(strip_glyphs(node["name"]))
        self.talents = sorted(set(talents), key=lambda s: (-len(s), s))
        self.talents_multi = [t for t in self.talents if " " in t]
        self.talents_single = [t for t in self.talents if " " not in t]
        self.conditions_raw = [row[0] for row in roster["conditions"]]
        self.conditions = sorted({condition_name(c) for c in self.conditions_raw}, key=lambda s: (-len(s), s))
        traits = set()
        for row in roster["weaponTraits"] + roster["armorTraits"] + roster["actionTraits"]:
            for part in row[0].split(","):
                traits.add(part.strip().split(" ")[0])
        for a in actions["actions"]:
            for t in a.get("traits") or []:
                traits.add(t.strip())
        traits.update(TRAIT_WORDS_EXTRA)
        traits.update(row[0] for row in roster["materials"])
        self.traits = sorted(traits, key=lambda s: (-len(s), s))
        maneuvers = set()
        for group in roster["actions"].values():
            for row in group:
                maneuvers.add(strip_glyphs(re.split("[%s]" % GLYPHS, row[0])[0]))
        for row in roster["explorationActions"] + roster["downtimeActions"]:
            maneuvers.add(row[0].strip())
        for a in actions["actions"]:
            maneuvers.add(a["name"].strip())
        self.maneuvers = sorted(maneuvers, key=lambda s: (-len(s), s))
        for w in TRAIT_WORDS_UNAMBIGUOUS:
            if w not in self.traits:
                raise SystemExit("TRAIT_WORDS_UNAMBIGUOUS names %r, which no Traits table or action lists" % w)
        for c in CONSTELLATIONS_UNAMBIGUOUS + CONSTELLATIONS_BY_PATTERN:
            if c not in self.constellations:
                raise SystemExit("%r is not a Constellation in trees.json" % c)
        self.key_terms = []
        self.headings = []

    def first_use(self):
        """Terms that print bold where the author introduced them outside Key Terms."""
        terms = set(self.key_terms) | set(FIRST_USE_EXTRA) | set(self.conditions) | set(self.conditions_raw) | set(self.maneuvers)
        return {straight(t) for t in terms}


def term_regex(term):
    """A literal term as a regex alternative, straight and curly apostrophes alike."""
    return re.escape(term).replace("'", APOSTROPHE_CLASS)


BEFORE = r"(?<![\w'" + RIGHT_QUOTE + LEFT_QUOTE + "-])"
AFTER = r"(?![\w-])"


class Matcher:
    """The combined dictionary matcher: longest match first, non-overlapping, left to right."""

    def __init__(self, dicts):
        self.kinds = {}
        literal = []
        for t in dicts.talents_multi:
            literal.append((t, "talent"))
        for t in CONSTELLATIONS_UNAMBIGUOUS:
            literal.append((t, "const"))
        for t in TRAIT_WORDS_UNAMBIGUOUS:
            literal.append((t, "trait3"))
        for t in dicts.conditions:
            literal.append((t, "cond"))
        # Multiword Maneuver names block a shorter match inside them ("Drop Prone" is not the
        # Condition); they take no style of their own (convention 19).
        for t in dicts.maneuvers:
            if " " in t:
                literal.append((t, "block"))
        seen = {}
        for term, kind in literal:
            key = straight(term)
            if key in seen and seen[key] != kind:
                # A name that is two kinds at once: the Talent reading wins, then Constellation.
                order = ["talent", "const", "trait3", "cond", "block"]
                kind = min(seen[key], kind, key=order.index)
            seen[key] = kind
        self.kinds = seen
        terms = sorted(seen, key=lambda s: (-len(s), s))
        self.literal_re = re.compile(BEFORE + "(?:" + "|".join(term_regex(t) for t in terms) + ")" + AFTER)
        traits = sorted(dicts.traits, key=lambda s: (-len(s), s))
        self.trait2_re = re.compile(BEFORE + "(?P<t>" + "|".join(term_regex(t) for t in traits) + r")s? (?:trait|Trait)" + AFTER)
        self.constpat_re = re.compile(BEFORE + "(?P<t>" + "|".join(CONSTELLATIONS_BY_PATTERN) + r") (?:Defense|Constellation)" + AFTER)
        headings = sorted(set(dicts.headings), key=lambda s: (-len(s), s))
        heads = "|".join(term_regex(h) for h in headings)
        self.chapter_re = re.compile(BEFORE + r"Chapter [1-7](?:: (?:" + heads + r"))?" + AFTER)
        self.see_re = re.compile(BEFORE + r"(?:see|See|under) (?P<t>" + heads + ")" + AFTER)

    def find(self, text):
        """Resolved matches over `text`: (styled start, styled end, kind, span start, span end)."""
        found = []
        for m in self.literal_re.finditer(text):
            kind = self.kinds[straight(m.group(0))]
            found.append((m.start(), m.end(), kind, m.start(), m.end()))
        for m in self.trait2_re.finditer(text):
            found.append((m.start("t"), m.end("t"), "trait2", m.start(), m.end()))
        for m in self.constpat_re.finditer(text):
            found.append((m.start("t"), m.end("t"), "constpat", m.start(), m.end()))
        for m in self.chapter_re.finditer(text):
            found.append((m.start(), m.end(), "chapter", m.start(), m.end()))
        for m in self.see_re.finditer(text):
            found.append((m.start("t"), m.end("t"), "see", m.start(), m.end()))
        found.sort(key=lambda f: (f[3], -(f[4] - f[3])))
        out, last = [], 0
        for f in found:
            if f[3] >= last:
                out.append(f)
                last = f[4]
        return out


KIND_STYLE = {"talent": "SwTalent", "const": "SwConstellation", "constpat": "SwConstellation", "trait2": "SwTrait",
              "trait3": "SwTrait", "cond": "SwCondition", "chapter": "SwRef", "see": "SwRef", "block": None,
              "talent1": "SwTalent", "const1": "SwConstellation"}


def kind_allowed(para, run, kind):
    """Where a dictionary kind may be applied (convention 1's contexts and exclusions)."""
    ctx = para.context
    if ctx is None or run.in_hyperlink or run.in_field or run.rstyle or kind == "block":
        return False
    if kind in ("talent", "talent1", "const", "const1", "constpat", "cond"):
        return ctx in ("PROSE", "BODY") and not run.bold
    if kind == "trait3":
        return not run.bold
    return True  # trait2, chapter, see: PROSE, CALLOUT and BODY, bold runs included


# ----------------------------------------------------------------------------------------------
# The report
# ----------------------------------------------------------------------------------------------

class Report:
    def __init__(self, verbose=False):
        self.counts = Counter()
        self.notes = OrderedDict()
        self.verbose = verbose

    def count(self, key, n=1):
        self.counts[key] += n

    def note(self, key, item):
        self.notes.setdefault(key, []).append(item)

    def print(self):
        print("\napplied (the number is the convention):")
        for key in sorted(self.counts, key=lambda k: (int(re.match(r"\d+", k).group(0)), k)):
            print("  %-60s %6d" % (key, self.counts[key]))
        for key, items in self.notes.items():
            print("\n%s (%d):" % (key, len(items)))
            c = Counter(items)
            for item, n in c.most_common():
                print("  %s%s" % (item if len(item) <= 200 else item[:197] + "...", " x%d" % n if n > 1 else ""))


# ----------------------------------------------------------------------------------------------
# Pass 1: tables
# ----------------------------------------------------------------------------------------------

def pass_tables(xml, report):
    model = Model(xml)
    edits = []
    for t in model.tables:
        if not t.sw:
            fills = Counter(re.findall(r'<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"', t.masked))
            for fill, n in fills.items():
                report.note("fills left alone (table: fill x cells)", "%s: %s x%d (%s)" % (t.label, fill, n, "cover" if t.cover else "callout"))
            continue
        raw = model.xml[t.start:t.end]
        new = raw
        # tblPr: the style first, any tblBorders gone, tblLook with the header row and banding on.
        tblpr = raw[t.tblpr[0]:t.tblpr[1]]
        new_tblpr = tblpr
        if "<w:tblBorders" in new_tblpr:
            new_tblpr = re.sub(r"<w:tblBorders>.*?</w:tblBorders>", "", new_tblpr, flags=re.S)
            report.note("tblBorders removed (unexpected, reported)", t.label)
        new_tblpr = re.sub(r'<w:tblStyle w:val="[^"]*"/>', "", new_tblpr)
        new_tblpr = new_tblpr.replace("<w:tblPr>", '<w:tblPr><w:tblStyle w:val="SwTable"/>', 1)

        def fix_look(m):
            look = m.group(0)
            look = re.sub(r'w:firstRow="[^"]*"', 'w:firstRow="1"', look)
            look = re.sub(r'w:noHBand="[^"]*"', 'w:noHBand="0"', look)
            if 'w:firstRow=' not in look:
                look = look.replace("/>", ' w:firstRow="1"/>')
            if 'w:noHBand=' not in look:
                look = look.replace("/>", ' w:noHBand="0"/>')
            return look
        new_tblpr = re.sub(r"<w:tblLook\b[^>]*/>", fix_look, new_tblpr)
        if new_tblpr != tblpr:
            report.count("2 tables restyled SwTable")
        # Cells and runs, row by row, right to left so offsets hold. The nested table is masked.
        row_edits = []
        for ri, (rs, re_, cells) in enumerate(t.rows):
            for cell in cells:
                if cell.tcpr:
                    s, e = cell.tcpr[0] - t.start, cell.tcpr[1] - t.start
                    tcpr = raw[s:e]
                    new_tcpr = tcpr
                    for m in re.finditer(r'<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"[^>]*/>', tcpr):
                        fill = m.group(1).upper()
                        if fill in TABLE_FILLS_REMOVED:
                            new_tcpr = new_tcpr.replace(m.group(0), "", 1)
                            report.count("2 cell shading removed, fill %s" % fill)
                        else:
                            report.note("fills left alone (table: fill x cells)", "%s: %s (row %d)" % (t.label, fill, ri))
                    n = len(re.findall(r"<w:tcBorders>.*?</w:tcBorders>", new_tcpr, flags=re.S))
                    if n:
                        new_tcpr = re.sub(r"<w:tcBorders>.*?</w:tcBorders>", "", new_tcpr, flags=re.S)
                        report.count("2 cell borders removed (tcBorders)", n)
                    if new_tcpr != tcpr:
                        row_edits.append((s, e, new_tcpr))
                for p in cell.paras:
                    for run in p.runs:
                        children = list(run.children)
                        before = children
                        children = [(tg, x) for tg, x in children if not (tg in ("sz", "szCs") and 'w:val="19"' in x)]
                        if len(children) != len(before):
                            report.count("2 run size 9.5pt removed (style supplies it)")
                        if ri == 0:
                            kept = []
                            for tg, x in children:
                                if tg in ("b", "bCs") and is_on([(tg, x)], tg):
                                    report.count("2 header run bold removed")
                                    continue
                                if tg == "color" and re.search(r'w:val="(FFFFFF|auto)"', x, re.I):
                                    report.count("2 header run color removed")
                                    continue
                                if tg == "highlight":
                                    report.count("2 header run highlight removed")
                                    continue
                                kept.append((tg, x))
                            children = kept
                        if children != run.children:
                            s = p.start - t.start + run.start
                            e = p.start - t.start + run.end
                            row_edits.append((s, e, run.rebuild(children)))
        row_edits.append((t.tblpr[0], t.tblpr[1], new_tblpr))
        for s, e, rep in sorted(row_edits, key=lambda x: -x[0]):
            new = new[:s] + rep + new[e:]
        if new != raw:
            edits.append((t.start, t.end, new))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 2: headings
# ----------------------------------------------------------------------------------------------

def pass_headings(xml, report):
    model = Model(xml)
    edits = []
    for p in model.paras:
        if p.pstyle not in HEADING_RPR:
            continue
        color, sz = HEADING_RPR[p.pstyle]
        text_runs = [r for r in p.runs if r.text.strip()]
        any_bold = any(r.bold for r in text_runs)
        all_bold = all(r.bold for r in text_runs)
        run_edits = []
        for run in p.runs:
            children = []
            for tg, x in run.children:
                if tg in ("b", "bCs") and x in ("<w:b/>", "<w:bCs/>"):
                    continue
                if tg == "color" and x == '<w:color w:val="%s"/>' % color:
                    continue
                if tg in ("sz", "szCs") and x == '<w:%s w:val="%s"/>' % (tg, sz):
                    continue
                children.append((tg, x))
            if any_bold and not all_bold and not run.bold and run.text.strip():
                children = rpr_insert(children, "b", '<w:b w:val="0"/>')
                children = rpr_insert(children, "bCs", '<w:bCs w:val="0"/>')
            if children != run.children:
                run_edits.append((run.start, run.end, run.rebuild(children)))
                report.count("3-5 heading runs stripped of direct formatting")
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
            # Reported on the pass that moves the look into the style, not on a rerun.
            if text_runs and not any_bold:
                report.note("heading paragraphs that were regular and take the style's bold", "%s: %s" % (p.pstyle, p.text.strip()[:60]))
            if any_bold and not all_bold:
                report.note("heading paragraphs with a deliberate mix of weights, kept", "%s: %s" % (p.pstyle, p.text.strip()[:60]))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 3: meta lines
# ----------------------------------------------------------------------------------------------

def pass_meta(xml, report):
    model = Model(xml)
    edits = []
    wanted = {("i", "<w:i/>"), ("iCs", "<w:iCs/>"), ("color", '<w:color w:val="0E5F6B"/>'),
              ("sz", '<w:sz w:val="20"/>'), ("szCs", '<w:szCs w:val="20"/>')}
    for p in model.top_paras():
        if p.section != "body" or p.pstyle is not None:
            continue
        text_runs = [r for r in p.runs if r.text.strip()]
        if not text_runs or not all(set(r.children) == wanted for r in text_runs):
            continue
        run_edits = [(r.start, r.end, r.rebuild([])) for r in p.runs if set(r.children) == wanted]
        new = p.rebuild(run_edits)
        if "<w:pPr>" in new:
            new = new.replace("<w:pPr>", '<w:pPr><w:pStyle w:val="SwMeta"/>', 1)
        else:
            new = re.sub(r"(<w:p\b[^>]*>)", r'\1<w:pPr><w:pStyle w:val="SwMeta"/></w:pPr>', new, count=1)
        edits.append((p.start, p.end, new))
        report.count("7 meta lines styled SwMeta")
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 4: rank cells and tier letters
# ----------------------------------------------------------------------------------------------

def style_cell_runs(cell, style_id, report, key):
    """Every text run of a cell takes `style_id` (glyph-only runs take SwGlyph instead)."""
    edits = []
    for p in cell.paras:
        run_edits = []
        for run in p.runs:
            if not run.text.strip() or run.sw_styled() or run.in_field or run.in_hyperlink:
                continue
            if GLYPH_RUN_RE.fullmatch(run.text.replace(" ", "")):
                run_edits.append((run.start, run.end, run.restyled("SwGlyph")))
                report.count("18 glyph runs styled SwGlyph (in a styled cell)")
            elif GLYPH_RUN_RE.search(run.text) and run.text_only:
                segments, pos = [], 0
                for m in GLYPH_RUN_RE.finditer(run.text):
                    if m.start() > pos:
                        segments.append((pos, m.start(), style_id))
                    segments.append((m.start(), m.end(), "SwGlyph"))
                    pos = m.end()
                if pos < len(run.text):
                    segments.append((pos, len(run.text), style_id))
                run_edits.append((run.start, run.end, run.split(segments)))
                report.count("18 glyph runs split out of a name (SwGlyph)")
            else:
                run_edits.append((run.start, run.end, run.restyled(style_id)))
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
    if edits:
        report.count(key)
    return edits


def pass_ranks(xml, report):
    model = Model(xml)
    edits = []
    for t in model.tables:
        if not t.sw:
            continue
        if t.header_texts and t.header_texts[0] == "Proficiency Rank":
            for rs, re_, cells in t.body_rows():
                word = cells[0].text.strip()
                if word in RANK_STYLE:
                    edits.extend(style_cell_runs(cells[0], RANK_STYLE[word], report, "16 rank table cells colored (%s)" % word))
        if "Tier" in t.header_texts:
            tier_header = t.header[t.header_texts.index("Tier")]
            for rs, re_, cells in t.body_rows():
                if len(cells) != len(t.header):
                    continue
                cell = t.column_cell(tier_header, cells)
                letter = cell.text.strip()
                if letter.rstrip("★") in TIER_STYLE and letter:
                    edits.extend(style_cell_runs(cell, TIER_STYLE[letter.rstrip("★")], report, "17 tier letters styled (%s)" % letter))
                else:
                    report.note("tier cells with a value other than T, E, M or L (left as found)", "%s: %r" % (t.label, letter))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 5: Talent-name cells
# ----------------------------------------------------------------------------------------------

def pass_name_cells(xml, report):
    model = Model(xml)
    edits = []
    for t in model.tables:
        if not t.sw or not t.header_texts or t.header_texts[0] != "Talent":
            continue
        report.count("11 Talent tables")
        for rs, re_, cells in t.body_rows():
            if len(cells) != len(t.header) or cells[0].span >= t.grid:
                report.note("rows spanning a Talent table, skipped", "%s: %s" % (t.label, cells[0].text.strip()[:40]))
                continue
            edits.extend(style_cell_runs(cells[0], "SwTalentName", report, "11 Talent-name cells styled SwTalentName"))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 6: Key Terms leads
# ----------------------------------------------------------------------------------------------

def pass_key_terms(xml, report, dicts):
    model = Model(xml)
    edits = []
    tops = model.top_paras()
    starts = [i for i, p in enumerate(tops) if p.heading == 2 and p.text.strip() == KEY_TERMS_HEADING]
    if len(starts) != 1:
        raise SystemExit("Heading 2 %r found %d times, wanted 1" % (KEY_TERMS_HEADING, len(starts)))
    i = starts[0] + 1
    leads = []
    while i < len(tops) and tops[i].heading != 2:
        p = tops[i]
        i += 1
        if p.pstyle is not None or not p.text.strip():
            continue
        first = next((r for r in p.runs if r.text.strip()), None)
        if first is None or first.sw_styled():
            if first is not None and first.rstyle == "SwKeyTerm":
                leads.append(first.text.strip().rstrip(".").strip())
            continue
        if first.bold and first.text.strip().endswith("."):
            edits.append((p.start, p.end, p.rebuild([(first.start, first.end, first.restyled("SwKeyTerm"))])))
            leads.append(first.text.strip().rstrip(".").strip())
            report.count("13 Key Terms leads styled SwKeyTerm")
    dicts.key_terms = leads
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 7: highlighted runs (tier 1 of the Trait convention)
# ----------------------------------------------------------------------------------------------

def pass_highlights(xml, report, dicts):
    model = Model(xml)
    edits = []
    talents = {straight(t) for t in dicts.talents}
    traits = {straight(t) for t in dicts.traits}
    for p in model.paras:
        if p.section == "pre" or p.heading is not None or p.field_open:
            continue
        run_edits = []
        for run in p.runs:
            if not run.has("highlight") or not run.text.strip() or run.sw_styled() or run.in_field or run.in_hyperlink:
                continue
            key = straight(run.text.strip(" .,;:()"))
            if key in talents:
                run_edits.append((run.start, run.end, run.restyled("SwTalent")))
                report.count("8 highlighted Talent name styled SwTalent")
                continue
            words = [w.strip() for w in key.split(",")]
            if not all(w in traits or (w.endswith("s") and w[:-1] in traits) for w in words):
                report.note("highlighted runs that match no Trait word, styled SwTrait anyway (for the author)",
                            "%r in: %s" % (run.text, p.text.strip()[:60]))
            run_edits.append((run.start, run.end, run.restyled("SwTrait")))
            report.count("8 highlighted runs styled SwTrait (tier 1)")
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 8: convert as found (italic names, underlines, bold Defined Terms)
# ----------------------------------------------------------------------------------------------

def pass_as_found(xml, report, dicts):
    model = Model(xml)
    dicts.headings = collect_headings(model)
    edits = []
    constellations = {straight(c) for c in dicts.constellations}
    talents = {straight(t) for t in dicts.talents}
    first_use = dicts.first_use()
    for p in model.paras:
        if p.section == "pre" or p.heading is not None or p.field_open or p.pstyle == "SwMeta":
            continue
        ctx = p.context
        in_sw_header = p.table is not None and p.table.sw and p.header_row and p.section == "body"
        run_edits = []
        text_runs = [r for r in p.runs if r.text.strip()]
        for run in p.runs:
            if not run.text.strip() or run.sw_styled() or run.in_field or run.in_hyperlink or run.rstyle:
                continue
            key = straight(run.text.strip(" .,;:()"))
            # A bold name followed by its action-cost glyph is a Maneuver label ("Gain Control ❶"),
            # not a Defined Term's first use; it stays direct bold whether the glyph sits in the run
            # or, after the glyph pass, in the run after it.
            i = text_runs.index(run)
            next_text = text_runs[i + 1].text if i + 1 < len(text_runs) else ""
            labelled = bool(GLYPH_RUN_RE.search(run.text)) or (next_text.strip() and GLYPH_RUN_RE.fullmatch(next_text.replace(" ", "")))
            # (9a, 10a) italic runs that are exactly a name
            if run.italic and p.section == "body":
                if key in constellations and (ctx is not None or in_sw_header):
                    run_edits.append((run.start, run.end, run.restyled("SwConstellation")))
                    report.count("9a italic Constellation names styled SwConstellation")
                    continue
                if key in talents and ctx is not None:
                    run_edits.append((run.start, run.end, run.restyled("SwTalent")))
                    report.count("10a italic Talent names styled SwTalent")
                    continue
                if ctx is not None or in_sw_header:
                    report.note("italic runs that are not a Constellation or Talent name, left italic", run.text.strip()[:70])
            # (15a) underlined runs
            if run.has("u") and p.section in ("body", "appendix"):
                if p.section == "appendix" and key == "underlined":
                    report.note("underline kept as the author's demonstration word", run.text.strip())
                else:
                    run_edits.append((run.start, run.end, run.restyled("SwRef")))
                    report.count("15a underlined runs styled SwRef")
                    if p.section == "appendix":
                        report.note("underlined references converted in Appendix A", run.text.strip())
                    heads = set(dicts.headings)
                    ref = re.sub(r"^Chapter \d: ", "", key)
                    if ref not in heads and ("The " + ref) not in heads and ref.replace("The ", "", 1) not in heads:
                        report.note("underlined references naming no current heading (for the author)", run.text.strip())
                    continue
            # (14) bold runs that are exactly a Defined Term
            if run.bold and not run.has("highlight") and not labelled and p.section == "body" and ctx in ("PROSE", "CALLOUT"):
                if key in first_use or (key.endswith("s") and key[:-1] in first_use):
                    run_edits.append((run.start, run.end, run.restyled("SwFirstUse")))
                    report.count("14 bold Defined Terms styled SwFirstUse")
                    report.note("bold runs styled SwFirstUse (texts)", run.text.strip())
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 9: the dictionary
# ----------------------------------------------------------------------------------------------

def collect_headings(model):
    heads = []
    for p in model.headings():
        text = p.text.strip().rstrip("\t").strip()
        if not text:
            continue
        if p.heading == 1:
            text = re.sub(r"^\d+\.\s+", "", text)
            heads.append(text)
        else:
            heads.append(text)
            if re.match(r"^\d+\.\s+", text):
                heads.append(re.sub(r"^\d+\.\s+", "", text))
    return heads


def pass_dictionary(xml, report, dicts):
    model = Model(xml)
    dicts.headings = collect_headings(model)
    matcher = Matcher(dicts)
    singles = {straight(t) for t in dicts.talents_single}
    consts_whole = {straight(c) for c in list(dicts.constellations) + CONSTELLATIONS_BY_PATTERN}
    edits = []
    for p in model.paras:
        ctx = p.context
        if ctx is None or p.field_open:
            continue
        runs = p.runs
        text, spans = "", []
        for r in runs:
            spans.append((len(text), len(text) + len(r.display)))
            text += r.display
        matches = matcher.find(text)
        # A single-word Talent name is italic only as the whole text of a body cell. A body cell
        # that is exactly a Constellation name takes the Constellation style too, the seven names
        # that are otherwise matched only by pattern (Awareness, Evade, Guard, Endure, Melee,
        # Ranged, Lore) included: the Free Training column of the Callings table names a Skill
        # Constellation in every cell, and one cell in five printing roman was the verifier's one
        # fix before shipping. Header rows and first cells are never BODY, so they stay plain.
        whole = p.text.strip()
        if ctx == "BODY" and p.cell_text_paras == 1 and straight(whole) in singles:
            s = text.find(whole)
            matches = [(s, s + len(whole), "talent1", s, s + len(whole))]
        elif ctx == "BODY" and p.cell_text_paras == 1 and straight(whole) in consts_whole:
            s = text.find(whole)
            matches = [(s, s + len(whole), "const1", s, s + len(whole))]
        if not matches:
            continue
        by_run = {}
        for s, e, kind, _, _ in matches:
            if kind == "block":
                continue
            idx = next((i for i, (a, b) in enumerate(spans) if a <= s < b), None)
            if idx is None:
                continue
            run = runs[idx]
            if e > spans[idx][1]:
                if kind_allowed(p, run, kind) or (idx + 1 < len(runs) and kind_allowed(p, runs[idx + 1], kind)):
                    report.note("terms split across two runs, reported not formatted", "%s %r in: %s" % (kind, text[s:e], p.text.strip()[:50]))
                continue
            if not kind_allowed(p, run, kind):
                continue
            if not run.text_only:
                report.note("terms in a run holding more than text, reported not formatted", "%s %r" % (kind, text[s:e]))
                continue
            by_run.setdefault(idx, []).append((s - spans[idx][0], e - spans[idx][0], KIND_STYLE[kind], kind))
        run_edits = []
        for idx, segs in by_run.items():
            run = runs[idx]
            segs.sort()
            for s, e, _, kind in segs:
                report.count("9 dictionary: %s" % kind)
                if kind in ("trait2", "trait3", "const", "constpat", "chapter", "see") or report.verbose:
                    a, b = spans[idx][0] + s, spans[idx][0] + e
                    report.note("dictionary matches: %s" % kind, "%r in: ...%s[%s]%s..." % (text[a:b], text[max(0, a - 30):a], text[a:b], text[b:b + 30]))
            if len(segs) == 1 and segs[0][0] == 0 and segs[0][1] == len(run.text):
                run_edits.append((run.start, run.end, run.restyled(segs[0][2])))
            else:
                run_edits.append((run.start, run.end, run.split([(s, e, sid) for s, e, sid, _ in segs])))
                report.count("9 runs split around a term")
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# Pass 10: glyphs
# ----------------------------------------------------------------------------------------------

def names_glyph_font(x):
    return "Segoe UI Symbol" in x or "Cambria Math" in x


def pass_glyphs(xml, report):
    model = Model(xml)
    edits = []
    for p in model.paras:
        if p.section == "pre" or p.heading is not None or p.field_open:
            continue
        run_edits = []
        for run in p.runs:
            if run.in_field or run.in_hyperlink or not run.text:
                continue
            compact = run.text.replace(" ", "")
            has_glyph = bool(GLYPH_RUN_RE.search(run.text))
            if compact and GLYPH_RUN_RE.fullmatch(compact):
                if run.rstyle == "SwGlyph" or (run.rstyle and not run.rstyle.startswith("Sw")):
                    continue
                run_edits.append((run.start, run.end, run.restyled("SwGlyph")))
                report.count("18 glyph-only runs styled SwGlyph")
            elif has_glyph:
                if not run.text_only:
                    report.note("glyphs in a run holding more than text, left as found", run.text.strip()[:60])
                    continue
                if run.rstyle and not run.rstyle.startswith("Sw"):
                    continue
                segments, pos = [], 0
                base = [(tg, x) for tg, x in run.children if not (tg == "rFonts" and names_glyph_font(x))]
                for m in GLYPH_RUN_RE.finditer(run.text):
                    if m.start() > pos:
                        segments.append((pos, m.start(), None))
                    segments.append((m.start(), m.end(), "SwGlyph"))
                    pos = m.end()
                if pos < len(run.text):
                    segments.append((pos, len(run.text), None))
                pieces = []
                for s, e, sid in segments:
                    children = base if sid is None else styled(run.children, sid)
                    pieces.append('%s%s<w:t xml:space="preserve">%s</w:t></w:r>' % (run.open_tag, build_rpr(children), escape(run.text[s:e])))
                run_edits.append((run.start, run.end, "".join(pieces)))
                report.count("18 mixed runs split, glyphs to SwGlyph")
            else:
                fonts = [x for tg, x in run.children if tg == "rFonts" and "Cambria Math" in x]
                if fonts and not run.rstyle:
                    children = [(tg, x) for tg, x in run.children if tg != "rFonts"]
                    run_edits.append((run.start, run.end, run.rebuild(children)))
                    report.count("18 Cambria Math removed from a run without a glyph")
                    report.note("Cambria Math words returned to the body font", repr(run.text))
        if run_edits:
            edits.append((p.start, p.end, p.rebuild(run_edits)))
    return model.apply(edits)


# ----------------------------------------------------------------------------------------------
# styles.xml
# ----------------------------------------------------------------------------------------------

def character_style(style_id, name, rpr):
    return ('<w:style w:type="character" w:customStyle="1" w:styleId="%s"><w:name w:val="%s"/>'
            '<w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="1"/><w:qFormat/>%s</w:style>'
            % (style_id, name, "<w:rPr>%s</w:rPr>" % rpr if rpr else "<w:rPr/>"))


def ensure_style(styles, style_xml):
    """Add a style definition, or replace the one of that id, so a second run changes nothing."""
    style_id = re.search(r'w:styleId="([^"]+)"', style_xml).group(1)
    existing = re.search(r'<w:style\b[^>]*w:styleId="%s"[^>]*>.*?</w:style>' % re.escape(style_id), styles, re.S)
    if existing:
        return styles[: existing.start()] + style_xml + styles[existing.end():]
    return styles[: styles.rfind("</w:styles>")] + style_xml + "</w:styles>"


def set_style_rpr(styles, style_id, rpr_inner, report):
    m = re.search(r'<w:style\b[^>]*w:styleId="%s"[^>]*>.*?</w:style>' % re.escape(style_id), styles, re.S)
    if not m:
        raise SystemExit("styles.xml has no style %s" % style_id)
    block = m.group(0)
    new_rpr = "<w:rPr>%s</w:rPr>" % rpr_inner
    if "<w:rPr>" in block:
        new_block = re.sub(r"<w:rPr>.*?</w:rPr>", new_rpr, block, count=1, flags=re.S)
    else:
        new_block = block.replace("</w:style>", new_rpr + "</w:style>")
    if new_block != block:
        report.count("3-5 heading styles rewritten (%s)" % style_id)
    return styles[: m.start()] + new_block + styles[m.end():]


def canonicalize_style_ids(xml, styles, report):
    """
    Word rewrites a custom style's id from its name when it saves ("SW Table" becomes SWTable,
    "SW Rank Trained" becomes SWRankTrained), so an edition the author has opened and saved no
    longer carries the ids this script looks for, and a rerun would define its styles a second
    time beside Word's and restyle every run. The style's name is the stable key: every style of
    ours is found by name in styles.xml and its id put back to ours, in both parts, wherever the id
    is referenced (rStyle, pStyle, tblStyle, basedOn, link, next), before any pass runs. An id is
    only an identifier, so the rename changes nothing a reader sees; Word will rename them again on
    its next save, and this puts them back again.
    """
    ours = {name: style_id for style_id, name, _ in CHARACTER_STYLES}
    ours["SW Constellation Meta"] = "SwMeta"
    ours["SW Table"] = "SwTable"
    renames = {}
    for m in re.finditer(r'<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>\s*<w:name w:val="([^"]+)"', styles):
        actual, name = m.group(1), m.group(2)
        wanted = ours.get(name)
        if wanted and actual != wanted:
            renames[actual] = wanted
    for old, new in renames.items():
        for attr in ("w:val", "w:styleId"):
            xml = xml.replace('%s="%s"' % (attr, old), '%s="%s"' % (attr, new))
            styles = styles.replace('%s="%s"' % (attr, old), '%s="%s"' % (attr, new))
    if renames:
        report.count("0 style ids put back after Word renamed them", len(renames))
        report.note("style ids put back", ", ".join("%s to %s" % kv for kv in sorted(renames.items())))
    return xml, styles


def update_styles(styles, report):
    for style_id, (color, sz) in HEADING_RPR.items():
        styles = set_style_rpr(styles, style_id, '<w:b/><w:bCs/><w:color w:val="%s"/><w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (color, sz, sz), report)
    color, sz = HEADING_RPR["Heading3"]
    styles = set_style_rpr(styles, "Heading3Char", '<w:b/><w:bCs/><w:color w:val="%s"/><w:sz w:val="%s"/><w:szCs w:val="%s"/>' % (color, sz, sz), report)
    styles = ensure_style(styles, TABLE_STYLE)
    styles = ensure_style(styles, META_STYLE)
    for style_id, name, rpr in CHARACTER_STYLES:
        styles = ensure_style(styles, character_style(style_id, name, rpr))
    return styles


# ----------------------------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------------------------

def format_document(xml, styles, dicts, report):
    xml = pass_tables(xml, report)
    xml = pass_headings(xml, report)
    xml = pass_meta(xml, report)
    xml = pass_ranks(xml, report)
    xml = pass_name_cells(xml, report)
    xml = pass_key_terms(xml, report, dicts)
    xml = pass_highlights(xml, report, dicts)
    xml = pass_as_found(xml, report, dicts)
    xml = pass_dictionary(xml, report, dicts)
    xml = pass_glyphs(xml, report)
    xml = pass_mark_highlights(xml, report)
    styles = update_styles(styles, report)
    return xml, styles


def pass_mark_highlights(xml, report):
    """
    The last highlighter in the file: a w:highlight inside a paragraph mark's run properties
    (w:pPr/w:rPr), which prints nothing but comes back the moment the paragraph is split or copied
    in Word. Six of them sat on Backgrounds rows and Combat Style effect cells after the first
    pass. Formatting only, text-neutral; the run-level highlights are convention 8's.
    """
    count = 0

    def strip_mark(m):
        nonlocal count
        block, n = re.subn(r"<w:highlight\b[^>]*/>", "", m.group(0))
        count += n
        return block

    xml = re.sub(r"<w:pPr>(?:(?!</w:pPr>).)*</w:pPr>", strip_mark, xml, flags=re.S)
    if count:
        report.count("11 paragraph-mark highlights removed", count)
    return xml


def main():
    argv = sys.argv[1:]
    force = "--force" in argv
    verbose = "--verbose" in argv
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 2:
        raise SystemExit(__doc__)
    src, dest = args
    if os.path.abspath(src) == os.path.abspath(dest):
        raise SystemExit("source and destination are the same file; the formatted handbook is a new file")
    if os.path.exists(dest) and not force:
        raise SystemExit("%s already exists; pass --force to replace it" % dest)

    with zipfile.ZipFile(src) as z:
        entries = [(i, z.read(i.filename)) for i in z.infolist()]
    parts = {info.filename: data for info, data in entries}
    if "word/document.xml" not in parts or "word/styles.xml" not in parts:
        raise SystemExit("%s has no word/document.xml or word/styles.xml" % src)
    xml = parts["word/document.xml"].decode("utf-8")
    styles = parts["word/styles.xml"].decode("utf-8")
    before_text = "".join(plain(m.group(0)) for m in PARA_RE.finditer(xml))

    dicts = Dictionaries(ROOT)
    report = Report(verbose)
    xml, styles = canonicalize_style_ids(xml, styles, report)
    print("formatting %s" % os.path.basename(src))
    print("  dictionaries: %d Constellations, %d Talents (%d multiword), %d Conditions, %d Trait words, %d Maneuvers and Activities"
          % (len(dicts.constellations), len(dicts.talents), len(dicts.talents_multi), len(dicts.conditions), len(dicts.traits), len(dicts.maneuvers)))
    new_xml, new_styles = format_document(xml, styles, dicts, report)

    after_text = "".join(plain(m.group(0)) for m in PARA_RE.finditer(new_xml))
    if after_text != before_text:
        raise SystemExit("REFUSING TO WRITE: the visible text changed")
    if new_xml.count(EM_DASH) != xml.count(EM_DASH) or EM_DASH in new_styles:
        raise SystemExit("REFUSING TO WRITE: an em-dash was introduced")
    report.note("Key Terms leads (the KEYTERMS dictionary)", ", ".join(dicts.key_terms))
    report.print()
    print("\n  document.xml %d -> %d bytes; styles.xml %d -> %d bytes" % (len(xml), len(new_xml), len(styles), len(new_styles)))

    tmp = dest + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for info, data in entries:
            if info.filename == "word/document.xml":
                data = new_xml.encode("utf-8")
            elif info.filename == "word/styles.xml":
                data = new_styles.encode("utf-8")
            new_info = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            new_info.compress_type = info.compress_type
            new_info.external_attr = info.external_attr
            new_info.internal_attr = info.internal_attr
            new_info.create_system = info.create_system
            out.writestr(new_info, data)
    shutil.move(tmp, dest)
    print("wrote %s" % dest)


if __name__ == "__main__":
    main()
