"""FEATURES.md -> Starwrought_Foundry_Features.docx: the system's feature document as a formatted
Word file, for printing or saving as a PDF.

The Markdown is the source (foundry/starwrought/FEATURES.md, kept by the handbook rule); this
script only lays it out. It reads the constructs that file uses: the three heading levels,
hard-wrapped paragraphs, bullet lists (nested by indentation), pipe tables, block quotes,
horizontal rules, and the inline marks **bold**, *italic*, `code` and [text](link). Each top-level
section starts on a new page; a table of contents field at the front updates when Word opens the
document (it asks once).

Usage: python assets/build_features_docx.py [--in foundry/starwrought/FEATURES.md]
                                            [--out Starwrought_Foundry_Features.docx]
"""
import argparse
import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent

# Print palette: dark ink on white, headings in the night-sky blue, accents in the sheet's gold.
INK = RGBColor(0x1E, 0x1E, 0x24)
HEADING = RGBColor(0x1F, 0x2A, 0x4A)
ACCENT = RGBColor(0x8A, 0x6A, 0x12)
MUTED = RGBColor(0x5A, 0x5A, 0x66)
CODE_BG = "EEF0F5"
TABLE_HEAD_BG = "1F2A4A"
TABLE_STRIPE_BG = "F5F6FA"
QUOTE_BG = "F7F3E6"

BODY_FONT = "Calibri"
HEADING_FONT = "Georgia"
CODE_FONT = "Consolas"
# The action glyphs (❶ ❷ ❸ ⓿ ↺ ✧ ★) are not in Calibri; Segoe UI Symbol has them all.
GLYPH_FONT = "Segoe UI Symbol"
GLYPHS = re.compile(r"[①-⓿❶-➓↺✧★◆◇→]+")

INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?<![\w*])\*[^*\n]+?\*(?![\w*]))")


# ---- Low-level helpers -----------------------------------------------------------------------

def shade(cell_or_par, fill):
    """Background shading on a table cell or a paragraph."""
    pr = cell_or_par._tc.get_or_add_tcPr() if hasattr(cell_or_par, "_tc") else cell_or_par._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pr.append(shd)


def left_border(paragraph, color="C9A227", size=24):
    pPr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), str(size))
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), color)
    borders.append(left)
    pPr.append(borders)


def set_run_font(run, name, size=None, color=None, bold=None, italic=None):
    run.font.name = name
    rpr = run._r.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic


def add_text(paragraph, text, bold=False, italic=False, code=False, size=None, color=None):
    """Append text to a paragraph, switching to the glyph font wherever a glyph appears."""
    pos = 0
    for m in GLYPHS.finditer(text):
        if m.start() > pos:
            _run(paragraph, text[pos:m.start()], bold, italic, code, size, color)
        _run(paragraph, m.group(0), bold, italic, False, size, color, glyph=True)
        pos = m.end()
    if pos < len(text):
        _run(paragraph, text[pos:], bold, italic, code, size, color)


def _run(paragraph, text, bold, italic, code, size, color, glyph=False):
    run = paragraph.add_run(text)
    if code:
        set_run_font(run, CODE_FONT, size=(size or 10) - 0.5, color=HEADING, bold=bold, italic=italic)
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), CODE_BG)
        run._r.get_or_add_rPr().append(shd)
    elif glyph:
        set_run_font(run, GLYPH_FONT, size=size, color=color or ACCENT, bold=False, italic=italic)
    else:
        set_run_font(run, BODY_FONT, size=size, color=color, bold=bold, italic=italic)
    return run


def add_inline(paragraph, text, size=None, color=None, base_italic=False):
    """Render a line of Markdown inline marks into runs."""
    pos = 0
    for m in INLINE.finditer(text):
        if m.start() > pos:
            add_text(paragraph, text[pos:m.start()], italic=base_italic, size=size, color=color)
        tok = m.group(0)
        if tok.startswith("**"):
            add_text(paragraph, tok[2:-2], bold=True, italic=base_italic, size=size, color=color)
        elif tok.startswith("`"):
            add_text(paragraph, tok[1:-1], code=True, size=size)
        elif tok.startswith("["):
            label = re.match(r"\[([^\]]+)\]", tok).group(1)
            add_text(paragraph, label, italic=True, size=size, color=HEADING)
        else:
            add_text(paragraph, tok[1:-1], italic=True, size=size, color=color)
        pos = m.end()
    if pos < len(text):
        add_text(paragraph, text[pos:], italic=base_italic, size=size, color=color)


def add_toc(document):
    """A table of contents field (levels 1 to 3); Word fills it in when the document opens."""
    paragraph = document.add_paragraph()
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    fld_begin.set(qn("w:dirty"), "true")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "2-3" \\h \\z \\u'
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Table of contents: press F9 (or accept Word's prompt) to fill it in."
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    for el in (fld_begin, instr, fld_sep, placeholder, fld_end):
        run._r.append(el)
    set_run_font(run, BODY_FONT, size=10, color=MUTED, italic=True)


def update_fields_on_open(document):
    settings = document.settings.element
    upd = OxmlElement("w:updateFields")
    upd.set(qn("w:val"), "true")
    settings.append(upd)


def add_page_number_footer(section):
    footer = section.footer
    paragraph = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("STARWROUGHT for Foundry VTT  ·  ")
    set_run_font(run, BODY_FONT, size=8.5, color=MUTED)
    run = paragraph.add_run()
    for kind, text in (("begin", None), (None, "PAGE"), ("end", None)):
        if kind:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        run._r.append(el)
    set_run_font(run, BODY_FONT, size=8.5, color=MUTED)


# ---- Styles ----------------------------------------------------------------------------------

def style_document(document):
    styles = document.styles
    normal = styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.08
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)

    for name, size, before, after in (("Heading 1", 22, 0, 10), ("Heading 2", 16, 18, 6), ("Heading 3", 12.5, 14, 4)):
        st = styles[name]
        st.font.name = HEADING_FONT
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = HEADING
        st.element.rPr.rFonts.set(qn("w:eastAsia"), HEADING_FONT)
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True

    for name in ("List Bullet", "List Bullet 2"):
        st = styles[name]
        st.font.name = BODY_FONT
        st.font.size = Pt(10.5)
        st.paragraph_format.space_after = Pt(3)

    # The table of contents Word fills in uses these; compact, so the whole list fits one page.
    from docx.enum.style import WD_STYLE_TYPE
    for name, indent in (("TOC 1", 0), ("TOC 2", 0.25), ("TOC 3", 0.5)):
        st = styles[name] if name in [s.name for s in styles] else styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        st.font.name = BODY_FONT
        st.font.size = Pt(10)
        st.font.color.rgb = INK
        st.paragraph_format.space_after = Pt(1.5)
        st.paragraph_format.space_before = Pt(0)
        st.paragraph_format.left_indent = Inches(indent)

    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    for side in ("left_margin", "right_margin"):
        setattr(section, side, Inches(1))
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)


# ---- The Markdown walk -----------------------------------------------------------------------

def parse_table(lines):
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)
    # The second row is the alignment rule.
    if len(rows) >= 2 and all(re.fullmatch(r":?-{3,}:?", c) for c in rows[1] if c):
        del rows[1]
    return rows


def render_table(document, rows):
    if not rows:
        return
    cols = max(len(r) for r in rows)
    table = document.add_table(rows=len(rows), cols=cols)
    table.style = document.styles["Table Grid"]
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    # Column widths follow the text: a column of short labels stays narrow and the prose column
    # takes the rest of the 6.5 inches between the margins. Each column keeps at least an inch.
    weights = []
    for c in range(cols):
        texts = [(row[c] if c < len(row) else "") for row in rows[1:]] or [rows[0][c] if c < len(rows[0]) else ""]
        avg = sum(len(t) for t in texts) / max(1, len(texts))
        weights.append(max(26.0, min(avg, 120.0)))
    total = sum(weights)
    widths = [max(1.0, 6.5 * w / total) for w in weights]
    scale = 6.5 / sum(widths)
    widths = [w * scale for w in widths]
    for c, width in enumerate(widths):
        for cell in table.columns[c].cells:
            cell.width = Inches(width)
    for r, row in enumerate(rows):
        for c in range(cols):
            text = row[c] if c < len(row) else ""
            cell = table.cell(r, c)
            cell.text = ""
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(2)
            if r == 0:
                shade(cell, TABLE_HEAD_BG)
                add_inline(paragraph, text, size=9.5, color=RGBColor(0xFF, 0xFF, 0xFF))
                for run in paragraph.runs:
                    run.font.bold = True
            else:
                if r % 2 == 0:
                    shade(cell, TABLE_STRIPE_BG)
                add_inline(paragraph, text, size=9.5)
    # Repeat the header row on a page break.
    tr_pr = table.rows[0]._tr.get_or_add_trPr()
    hdr = OxmlElement("w:tblHeader")
    hdr.set(qn("w:val"), "true")
    tr_pr.append(hdr)
    document.add_paragraph().paragraph_format.space_after = Pt(2)


def render_quote(document, lines):
    text = " ".join(l.lstrip("> ").strip() for l in lines)
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.left_indent = Inches(0.25)
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(8)
    shade(paragraph, QUOTE_BG)
    left_border(paragraph)
    add_inline(paragraph, text, size=10, base_italic=False)


def render_bullets(document, items):
    for indent, text in items:
        style = "List Bullet 2" if indent else "List Bullet"
        paragraph = document.add_paragraph(style=style)
        add_inline(paragraph, text)


def convert(src_path, out_path):
    lines = src_path.read_text(encoding="utf-8").splitlines()
    document = Document()
    style_document(document)
    update_fields_on_open(document)
    add_page_number_footer(document.sections[0])

    i = 0
    first_h2 = True
    paragraph_buf = []
    bullet_buf = []

    def flush_paragraph():
        nonlocal paragraph_buf
        if paragraph_buf:
            text = " ".join(l.strip() for l in paragraph_buf)
            add_inline(document.add_paragraph(), text)
            paragraph_buf = []

    def flush_bullets():
        nonlocal bullet_buf
        if bullet_buf:
            render_bullets(document, bullet_buf)
            bullet_buf = []

    def flush():
        flush_paragraph()
        flush_bullets()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush()
            i += 1
            continue

        if stripped.startswith("# "):
            flush()
            title = stripped[2:].strip()
            heading = document.add_heading(level=1)
            add_text(heading, title, size=22, color=HEADING, bold=True)
            for run in heading.runs:
                set_run_font(run, HEADING_FONT, size=22, color=HEADING, bold=True) if not GLYPHS.fullmatch(run.text or "") else None
            i += 1
            continue

        if stripped.startswith("## "):
            flush()
            if first_h2:
                # The table of contents sits between the front matter and the first section, which
                # follows it directly; every later section starts on a page of its own.
                toc_heading = document.add_paragraph()
                r = toc_heading.add_run("Contents")
                set_run_font(r, HEADING_FONT, size=14, color=HEADING, bold=True)
                toc_heading.paragraph_format.space_before = Pt(14)
                add_toc(document)
                first_h2 = False
            else:
                document.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
            heading = document.add_heading(level=2)
            add_text(heading, stripped[3:].strip(), size=16, color=HEADING, bold=True)
            for run in heading.runs:
                if not GLYPHS.fullmatch(run.text or ""):
                    set_run_font(run, HEADING_FONT, size=16, color=HEADING, bold=True)
            i += 1
            continue

        if stripped.startswith("### "):
            flush()
            heading = document.add_heading(level=3)
            add_text(heading, stripped[4:].strip(), size=12.5, color=HEADING, bold=True)
            for run in heading.runs:
                if not GLYPHS.fullmatch(run.text or ""):
                    set_run_font(run, HEADING_FONT, size=12.5, color=HEADING, bold=True)
            i += 1
            continue

        if re.fullmatch(r"-{3,}", stripped):
            flush()
            i += 1
            continue

        if stripped.startswith("|"):
            flush()
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            render_table(document, parse_table(block))
            continue

        if stripped.startswith(">"):
            flush()
            block = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                block.append(lines[i])
                i += 1
            render_quote(document, block)
            continue

        m = re.match(r"^(\s*)- (.*)$", line)
        if m:
            flush_paragraph()
            indent = len(m.group(1)) >= 2
            bullet_buf.append([indent, m.group(2).strip()])
            i += 1
            # A wrapped continuation of a bullet is indented and not itself a bullet.
            while i < len(lines) and lines[i].strip() and not re.match(r"^\s*- ", lines[i]) \
                    and lines[i].startswith(" ") and not lines[i].strip().startswith(("|", ">", "#")):
                bullet_buf[-1][1] += " " + lines[i].strip()
                i += 1
            continue

        # Plain text: part of a paragraph.
        flush_bullets()
        paragraph_buf.append(line)
        i += 1

    flush()
    document.save(out_path)
    return document


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--in", dest="src", default=str(ROOT / "foundry" / "starwrought" / "FEATURES.md"))
    ap.add_argument("--out", dest="out", default=str(ROOT / "Starwrought_Foundry_Features.docx"))
    args = ap.parse_args()
    src = Path(args.src)
    out = Path(args.out)
    doc = convert(src, out)
    paragraphs = len(doc.paragraphs)
    tables = len(doc.tables)
    print(f"written {out} ({out.stat().st_size:,} bytes): {paragraphs} paragraphs, {tables} tables, from {src}")


if __name__ == "__main__":
    main()
