# Handbook style

How the Starwrought Player's Handbook is formatted, and what `assets/phb_format.py` does about it.
The handbook is Mike's Word document and he writes its text; this file is about how that text
prints. The script reads the newest handbook, applies the conventions below as Word styles, and
writes a new file. It never changes a character of text, never writes the source, and never
touches the cover, the contents, the opening fiction or the callout boxes.

## Palette and type

Teal 0E5F6B (chapter titles, table headers, callout bars, formula lines, the Expert rank), orange
E2703A (section titles, the tagline), slate 1D2A32 (body text and subsection titles), warm grey
F2F0EA (table bands), border grey CBD5DB, rank green 4A7C59 (Trained), rust C05621 (Master), gold
B8860B (Legendary and the cover), sage DBE5DE (the Trait tint, a 20 percent tint of the rank
green), callout EAF1F2, cover F4EFE6. Heading 4 keeps Word's blue 2E74B5 for now; see Open
choices.

Body text is Calibri 10.5pt in slate. Inside a data table it is 9.5pt; inside a callout box 10pt.
Action glyphs (⓿ ❶ ❷ ❸ ❹ ❺ ❻ ↺) print in Segoe UI Symbol, never bold or italic, through the
character style SW Action Glyph.

## Headings

Heading 1 is bold teal 20pt with the chapter number in the text ("2. The Core Rules"). Heading 2
is bold orange 14pt. Heading 3 is bold slate 11.5pt. Heading 4 is italic blue 10.5pt. These live
in the Word styles now, not on the heading text, so a heading is restyled by modifying the style.
A heading that deliberately mixes weights (the Human heading's "Vigor 8" and "Speed 6 ft") carries
an explicit regular on those spans. Under each Constellation heading, the meta line ("Skill
Constellation • Agility", "Combat Style • Presence") is the paragraph style SW Constellation Meta:
italic teal 10pt.

## The kinds of thing, and how each prints

Every kind below has a character style whose name begins "SW", so the author can change how every
Trait or every Talent prints by modifying one style in Word's style pane.

**Traits** print bold with a pale sage tint behind the word (SW Trait). This replaces the green
highlighter, which was a draft marker. The tint appears wherever a rule invokes the Trait:
"a weapon with the Finesse trait", "Unwieldy weapons", "While in this Stance". It does not appear
in the Traits column of the weapon, armor and Maneuver tables, where the column header already says
what the words are, nor in the key column of the three Trait glossary tables, which stays plain.
Trait names are Title Case.

**Constellations and Talents** print in italic (SW Constellation, SW Talent), as the book's old
style appendix said before this file replaced it:
"Roll *Athletics* against Evade or Guard", "*Two-Weapon Fighting* is a child of Melee", "requires
*Shield Fighting Training*". The Requires column of every Talent table is italic because it names
Talents. Defense names, Skill names and Combat Style names are Constellations. The glyph after a
Talent name is not italic.

**A Talent in its own table row** prints bold (SW Talent Name) in the first column, because the
row is its definition; the Tier letter beside it prints bold in its rank's color (T green, E teal,
M rust, L gold) through the rank styles below.

**Conditions** print plain Title Case with their parameter as written: Off-Guard, Frightened 2,
Exposed [Legs], Wrong-Footed [X]. They are bold only where they are introduced. The character
style SW Condition is attached to them but has no visible properties; it exists so Conditions can be
given a mark later in one place.

**Defined Terms** are bold where they are defined (the Key Terms entries, SW Key Term, with the
period inside the bold: "Attribute Bonus.") and bold where the rules first explain them outside
Key Terms (SW First Use: "a Round is about six seconds"). Everywhere else they print plain Title
Case. The script never adds bold on its own; the author decides which mention introduces a concept.

**References to other sections** print underlined, in the body color (SW Section Reference):
"see Chapter 7: Rules Elements", "see The Exchange", "under Load and Load Strain". The underline
covers the chapter or heading name only. A reference is underlined when it names an actual heading.

**Maneuvers and Activities** print plain Title Case followed by their action cost glyph: Strike ❶,
Raise a Shield ❶, Seek ❶, Hustle. They carry no italic and no bold; the glyph is the marker. Their
names are ordinary words too often for the script to tag them, so a Maneuver written without its
glyph is the author's to fix.

**Rank words** (Untrained, Trained, Expert, Master, Legendary) print plain in running text. They
are colored only in the rank table of Chapter 2 (SW Rank Trained, SW Rank Expert, SW Rank Master,
SW Rank Legendary), and those four styles also color the Tier letters.

## Tables

Every data table uses the table style SW Table: a teal header row with bold white 9.5pt text, body
text at 9.5pt, 0.5pt grey borders, and rows that band automatically, white first and warm grey
second, down the table. Banding is Word's, not hand-painted cell by cell, so adding or deleting a
row never breaks the pattern. The only hand-painted cells left are deliberate: the blue
"Bloodlines" sub-header and the two grey Bloodline root rows in the Human table, and the cover.
Callout boxes (the one-column tinted boxes with a teal left bar, including the Example of Play) are
not data tables and keep their own look.

## What the script decides and what it does not

The script formats a word only where it cannot be wrong. It converts every mark the author already
made (every highlight, every italic Constellation or Talent name, every underlined reference, every
bold Key Terms lead) into the matching style, and it applies the styles by dictionary only to names
that are never ordinary words: the multiword Talent and Constellation names, the Skill names, the
Combat Style names, and the Trait words that are Traits every time they are capitalised. It tags a
Trait word that is also an ordinary word (Attack, Close, Press, Move, Trip) only where the author
highlighted it or wrote "the X trait". It italicises Guard, Evade, Endure, Awareness, Melee, Ranged
and Lore only where the author already did or where "Defense" or "Constellation" follows, because
"Guard Threshold", "can Guard" and "Melee Proficiency" are not the Constellation. It never formats
inside a heading, the contents, the cover, a field, a hyperlink, a table header row, or the first
cell of any table row, and it never formats a name that is split across two runs of text; it
reports those instead. The dictionaries come from the repository: `assets/trees.json` for
Constellation and Talent names, `assets/roster.json` for Conditions and Traits, `assets/actions.json`
for action Traits and Maneuver names, and the Key Terms entries and headings of the handbook itself.

## Changing a convention

To change how a kind prints, modify its SW style in Word (Home, Styles pane, right-click, Modify)
and every instance follows; or change that style's properties in the conventions table at the top
of `assets/phb_format.py` and rerun the script on the newest handbook, which is how the next
edition is formatted. Run it as
`python assets/phb_format.py Starwrought_Players_Handbook_v<N>.docx <out>.docx`; it refuses to
overwrite without `--force`, prints what it applied and what it skipped, and running it on its own
output changes nothing.

## Open choices for the author

Heading 4 is Word's blue because a teal italic Heading 4 would look like the teal italic meta line
under it. The key columns of the Conditions, Maneuver and Trait tables are plain while Talent names
are bold. The Skill Constellations table has a bold key column and the Combat Styles table a plain
one. Expert, Master and Legendary tier colors are taken from the rank table; no E, M or L had a
color before. Three highlighted "Move" runs became Trait-tagged because they were highlighted,
though Move is a Maneuver and Motion is the Trait. Updating the contents field in Word will print
every entry regular unless the TOC 1 style is made bold, since the headings' bold now lives in the
styles. The book's Appendix A (This Book's Style) was removed by the author in v4.15 once this file
took over its job; the edition tool stamps the footers now.

## Style rule

No em-dashes anywhere in this document, in the script, or in the handbook's game prose. Use a
period, a semicolon, a colon, a comma or parentheses.
