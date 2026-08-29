# -*- coding: utf-8 -*-
"""
phb_edit.py: append sentences to specific paragraphs of a Player's Handbook .docx.

The handbook is hand-authored in Word and `build_phb.js` deliberately does not regenerate it.
This is the other thing you sometimes need: a surgical edit that adds a sentence to a paragraph
that already exists, without touching a single byte of anything else in the file.

It works by locating the paragraph whose visible text contains an anchor string, copying the run
properties of that paragraph's last run so the new text matches, and inserting one more run just
before the paragraph closes. Every other zip entry is copied through byte for byte.

  run:  python assets/phb_edit.py <in.docx> <out.docx>

The edits themselves are the EDITS list below, so a reviewer can read what changed without
running anything. Each is (anchor, text to append), and every anchor must match exactly one
paragraph or the script refuses to write.
"""
import io
import os
import re
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Word splits a paragraph into runs wherever formatting changes, so an anchor must be a stretch of
# text that sits inside a single run. These were each checked before they were written down.
EDITS = [
    # Ruling: Deadly dX is a critical effect of the weapon, not one of the dice rolled at step 2,
    # so it is added after the doubling and is not itself doubled. (Mike, 2026-08-27)
    (
        "On a critical hit, add one die of the listed size to the damage.",
        " It is a critical effect of the weapon rather than one of the dice rolled for damage, so"
        " it is added after the damage has been doubled, and is not itself doubled."
    ),
    (
        "simply takes normal fire damage rather than one cancelling the other out early.",
        " A weapon's Deadly die lands at the same seam: it is a critical effect of the weapon, so"
        " it is added after the doubling in step 5 and before Protection is subtracted in step 6."
    ),
    # Ruling: the conversion between a Defense check and a Defense Threshold was never printed.
    # It is ten plus the modifier. (Mike, 2026-08-27)
    (
        " This means that monsters typically have Thresholds for most of their stats, for example,"
        " Initiative Threshold, Claws Strike Threshold, Guard Threshold, Evade Threshold, etc.",
        " A Threshold is always ten plus the modifier of the check it stands in for: 10 + level +"
        " Attribute Bonus + Proficiency Bonus, and any bonuses and penalties that apply. A character"
        " whose Guard is +7 therefore has a Guard Threshold of 17, and an adversary's Thresholds are"
        " built the same way."
    ),
    (
        " Other games use terms like Armor Class or Difficulty Class in a similar manner.",
        " A Threshold is ten plus the modifier of the roll it stands in for, so a Guard of +7 is a"
        " Guard Threshold of 17."
    ),
    # The edition line.
    ("PLAYTEST EDITION v3.2", None),
]

PARA_RE = re.compile(r"<w:p\b[^>]*/>|<w:p\b[^>]*>.*?</w:p>", re.S)
RUN_RE = re.compile(r"<w:r\b[^>]*>.*?</w:r>", re.S)
RPR_RE = re.compile(r"<w:rPr\b.*?</w:rPr>", re.S)


def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def visible(paragraph):
    """The text a reader sees, with the markup stripped."""
    return re.sub(r"<[^>]+>", "", paragraph)


def append_to_paragraph(xml, anchor, addition):
    """Add one run carrying `addition` to the end of the paragraph holding `anchor`."""
    hits = [m for m in PARA_RE.finditer(xml) if anchor in visible(m.group(0))]
    if len(hits) != 1:
        raise SystemExit("anchor matched %d paragraphs, wanted exactly 1: %r" % (len(hits), anchor[:60]))
    match = hits[0]
    paragraph = match.group(0)

    runs = RUN_RE.findall(paragraph)
    if not runs:
        raise SystemExit("no runs in the paragraph for anchor %r" % anchor[:60])

    # Match the last run's formatting, so a table cell's smaller type stays smaller.
    rpr = RPR_RE.search(runs[-1])
    rpr = rpr.group(0) if rpr else ""
    run = '<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (rpr, escape(addition))

    edited = paragraph[: paragraph.rfind("</w:p>")] + run + "</w:p>"
    return xml[: match.start()] + edited + xml[match.end():]


def replace_in_paragraph(xml, anchor, old, new):
    """
    Substitute inside one paragraph only. The edition line is split across runs ("PLAYTEST
    EDITION ", "v", "3.2"), and "3.2" on its own is far too common to replace globally.
    """
    hits = [m for m in PARA_RE.finditer(xml) if anchor in visible(m.group(0))]
    if len(hits) != 1:
        raise SystemExit("anchor matched %d paragraphs, wanted exactly 1: %r" % (len(hits), anchor))
    match = hits[0]
    paragraph = match.group(0)
    if paragraph.count(old) != 1:
        raise SystemExit("%r appears %d times in that paragraph, wanted 1" % (old, paragraph.count(old)))
    return xml[: match.start()] + paragraph.replace(old, new) + xml[match.end():]


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    dest = sys.argv[2] if len(sys.argv) > 2 else None
    if not src or not dest:
        raise SystemExit(__doc__)

    with zipfile.ZipFile(src) as z:
        entries = [(i, z.read(i.filename)) for i in z.infolist()]

    xml = None
    for info, data in entries:
        if info.filename == "word/document.xml":
            xml = data.decode("utf-8")
    if xml is None:
        raise SystemExit("no word/document.xml in %s" % src)

    before = len(xml)
    for anchor, addition in EDITS:
        if addition is None:
            continue
        xml = append_to_paragraph(xml, anchor, addition)
        print("  appended to: %s..." % anchor.strip()[:58])

    # The edition line, done last so the anchors above still match the file they were written for.
    edition = next((a for a, add in EDITS if add is None), None)
    if edition:
        # Word has this line in four runs: "PLAYTEST EDITION ", "v", "3.", "2". Only the minor
        # number moves, and the assertion inside replace_in_paragraph keeps that honest.
        xml = replace_in_paragraph(xml, edition, "<w:t>2</w:t>", "<w:t>3</w:t>")
        print("  edition line: %s -> v3.3" % edition)

    print("  document.xml %d -> %d bytes" % (before, len(xml)))

    tmp = dest + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for info, data in entries:
            if info.filename == "word/document.xml":
                data = xml.encode("utf-8")
            # Keep the original entry metadata so Word sees the same package it wrote.
            new_info = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            new_info.compress_type = info.compress_type
            new_info.external_attr = info.external_attr
            new_info.internal_attr = info.internal_attr
            new_info.create_system = info.create_system
            out.writestr(new_info, data)
    shutil.move(tmp, dest)
    print("wrote %s" % os.path.relpath(dest, ROOT))


if __name__ == "__main__":
    main()
