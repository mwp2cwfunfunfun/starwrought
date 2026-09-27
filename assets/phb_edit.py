# -*- coding: utf-8 -*-
"""
phb_edit.py: surgical edits to a Player's Handbook .docx, written to a NEW numbered file.

The handbook is hand-authored in Word and `build_phb.js` deliberately does not regenerate it.
This is the other thing you sometimes need: a change to text that already exists, without
touching a single byte of anything else in the file. Every other zip entry is copied through
byte for byte, and the source file is never written.

Three kinds of edit, all confined to one paragraph at a time and all checked before writing:

  append      one more run at the end of the paragraph holding an anchor, in that paragraph's own
              formatting (copied from its last run)
  replace     a literal substitution inside the paragraph holding an anchor, which must occur
              exactly once there
  rename      a whole-word substitution applied wherever the word is followed by "bonus",
              "bonuses", "penalty" or "penalties", even when Word has split the phrase across
              runs; the word itself must sit inside one run, or the script refuses

  run:  python assets/phb_edit.py <in.docx> <out.docx> --to 3.4

The edits are the EDITIONS table below, one entry per handbook version this script has produced,
so a reviewer can read what changed without running anything.
"""
import io
import os
import re
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

EDITIONS = {
    # v3.2 -> v3.3 (Mike, 2026-08-27): two rulings written into the text.
    "3.3": {
        "from": "3.2",
        "append": [
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
        ],
        "replace": [],
        "rename": {},
    },
    # v3.3 -> v3.4 (Mike, 2026-09-26): the three bonus types are named for where the number comes
    # from. circumstance -> Situation, status -> Condition, item -> Gear. The stacking rule does not
    # change, and the paragraph that states it gains a sentence saying what the three are.
    "3.4": {
        "from": "3.3",
        "replace": [
            (
                "Status, item, and circumstance bonuses and penalties apply last.",
                "Status, item, and circumstance bonuses and penalties apply last.",
                "Situation, Condition, and Gear bonuses and penalties apply last."
            ),
            # The three types, named in the stacking paragraph. Inserted ahead of the lead-in to the
            # worked examples rather than appended after it, so the colon still introduces them.
            (
                "Bonuses and Penalties rely on the type to determine how they interact with one another.",
                "Here are a couple of examples:",
                "There are three types. A Situation bonus or penalty comes from where you stand and what is"
                " happening around you: cover, high ground, an ally’s help, a foe Off-Guard. A Condition"
                " bonus or penalty comes from something on you: Frightened, or a stance you have taken. A Gear"
                " bonus or penalty comes from what you hold or wear: a raised shield."
                " Here are a couple of examples:"
            ),
        ],
        "append": [],
        "rename": {"circumstance": "Situation", "status": "Condition", "item": "Gear"},
    },
}

PARA_RE = re.compile(r"<w:p\b[^>]*/>|<w:p\b[^>]*>.*?</w:p>", re.S)
RUN_RE = re.compile(r"<w:r\b[^>]*>.*?</w:r>", re.S)
RPR_RE = re.compile(r"<w:rPr\b.*?</w:rPr>", re.S)
TEXT_RE = re.compile(r"(<w:t\b[^>]*>)(.*?)(</w:t>)", re.S)


def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def unescape(text):
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


def visible(paragraph):
    """The text a reader sees, with the markup stripped."""
    return unescape(re.sub(r"<[^>]+>", "", paragraph))


def one_paragraph(xml, anchor):
    hits = [m for m in PARA_RE.finditer(xml) if anchor in visible(m.group(0))]
    if len(hits) != 1:
        raise SystemExit("anchor matched %d paragraphs, wanted exactly 1: %r" % (len(hits), anchor[:60]))
    return hits[0]


def append_to_paragraph(xml, anchor, addition):
    """Add one run carrying `addition` to the end of the paragraph holding `anchor`."""
    match = one_paragraph(xml, anchor)
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
    """Substitute inside one paragraph only; `old` must occur exactly once in its XML."""
    match = one_paragraph(xml, anchor)
    paragraph = match.group(0)
    if paragraph.count(old) != 1:
        raise SystemExit("%r appears %d times in that paragraph, wanted 1" % (old[:60], paragraph.count(old)))
    return xml[: match.start()] + paragraph.replace(old, new) + xml[match.end():]


def rename_types(xml, renames):
    """
    Rename bonus-type words wherever they qualify a bonus or penalty, and nowhere else. "an item,
    a spell" stays; "the item bonus to Guard" becomes "the Gear bonus to Guard". Word splits a
    paragraph into runs wherever formatting changes, so the phrase is matched against the
    paragraph's whole visible text and the word is then swapped inside whichever run holds it.
    """
    # Two shapes of the phrase. The full one, "a +2 circumstance bonus to Evade", and the elided one
    # the handbook also uses, "+2 circumstance to Evade" or "-1 status Physical Guard", where the
    # signed number in front is what marks the word as a type. The word itself is group "t".
    words = "|".join(re.escape(w) for w in renames)
    word_re = re.compile(
        r"\b(?P<t>" + words + r")\b(?=\s+(?:bonus|bonuses|penalty|penalties)\b)"
        r"|(?<=[+\-−]\d\s)(?P<t2>" + words + r")\b"
        r"|(?<=[+\-−]\d\d\s)(?P<t3>" + words + r")\b",
        re.I,
    )
    total = 0
    out = []
    last = 0
    for pm in PARA_RE.finditer(xml):
        paragraph = pm.group(0)
        tokens = list(TEXT_RE.finditer(paragraph))
        if not tokens:
            continue
        # The visible text, with each run's span recorded so a match can be sent back to its run.
        text, spans = "", []
        for t in tokens:
            s = unescape(t.group(2))
            spans.append((len(text), len(text) + len(s)))
            text += s
        matches = list(word_re.finditer(text))
        if not matches:
            continue
        # Each match is one word; find the run it sits in, and rewrite that run's text with every
        # match it holds, later ones first so earlier offsets stay valid.
        def word_of(m):
            return next(g for g in ("t", "t2", "t3") if m.group(g) is not None)

        by_run = {}
        for m in matches:
            g = word_of(m)
            idx = next(i for i, (a, b) in enumerate(spans) if a <= m.start(g) < b)
            if m.end(g) > spans[idx][1]:
                raise SystemExit("a type word is split across runs, near: %r" % text[max(0, m.start(g) - 40): m.end(g) + 40])
            by_run.setdefault(idx, []).append((m, g))
        new_texts = {}
        for idx, hits in by_run.items():
            a, b = spans[idx]
            local = unescape(tokens[idx].group(2))
            for m, g in sorted(hits, key=lambda h: -h[0].start(h[1])):
                s, e = m.start(g) - a, m.end(g) - a
                local = local[:s] + renames[m.group(g).lower()] + local[e:]
                total += 1
            new_texts[idx] = local
        # Splice the changed runs back, right to left.
        edited = paragraph
        for idx in sorted(new_texts, key=lambda i: -tokens[i].start()):
            t = tokens[idx]
            edited = edited[: t.start()] + t.group(1) + escape(new_texts[idx]) + t.group(3) + edited[t.end():]
        out.append(xml[last: pm.start()])
        out.append(edited)
        last = pm.end()
    out.append(xml[last:])
    return "".join(out), total


def main():
    argv = sys.argv[1:]
    to = None
    if "--to" in argv:
        i = argv.index("--to")
        if i + 1 >= len(argv):
            raise SystemExit(__doc__ + "\n--to needs a version")
        to = argv[i + 1]
        del argv[i: i + 2]
    for a in argv:
        if a.startswith("--to="):
            to = a.split("=", 1)[1]
    force = "--force" in argv
    args = [a for a in argv if not a.startswith("--")]
    src = args[0] if len(args) > 0 else None
    dest = args[1] if len(args) > 1 else None
    if not src or not dest or not to or to not in EDITIONS:
        raise SystemExit(__doc__ + "\nknown editions: " + ", ".join(sorted(EDITIONS)))
    edition = EDITIONS[to]

    # This script produces a NEW numbered file. It never writes its source, and it will not quietly
    # replace a handbook that already exists, since one of those may be the hand-authored one.
    if os.path.abspath(src) == os.path.abspath(dest):
        raise SystemExit("source and destination are the same file; write to a new numbered file")
    if os.path.exists(dest) and not force:
        raise SystemExit("%s already exists; pass --force to replace it" % dest)

    with zipfile.ZipFile(src) as z:
        entries = [(i, z.read(i.filename)) for i in z.infolist()]
    xml = next((data.decode("utf-8") for info, data in entries if info.filename == "word/document.xml"), None)
    if xml is None:
        raise SystemExit("no word/document.xml in %s" % src)
    before = len(xml)

    edition_line = "PLAYTEST EDITION v%s" % edition["from"]
    if not any(edition_line in visible(m.group(0)) for m in PARA_RE.finditer(xml)):
        raise SystemExit("this is not a v%s handbook: no %r line" % (edition["from"], edition_line))

    for anchor, old, new in edition["replace"]:
        xml = replace_in_paragraph(xml, anchor, old, new)
        print("  replaced in:  %s..." % anchor.strip()[:58])
    for anchor, addition in edition["append"]:
        xml = append_to_paragraph(xml, anchor, addition)
        print("  appended to:  %s..." % anchor.strip()[:58])
    if edition["rename"]:
        xml, n = rename_types(xml, edition["rename"])
        print("  renamed %d bonus-type words: %s" % (n, ", ".join("%s -> %s" % kv for kv in edition["rename"].items())))

    # The edition line, done last so the anchors above still match the file they were written for.
    # Word keeps it in four runs: "PLAYTEST EDITION ", "v", "3.", "<minor>". Only the minor moves.
    old_minor, new_minor = edition["from"].split(".")[1], to.split(".")[1]
    xml = replace_in_paragraph(xml, edition_line, "<w:t>%s</w:t>" % old_minor, "<w:t>%s</w:t>" % new_minor)
    print("  edition line: v%s -> v%s" % (edition["from"], to))
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
