# Heritage to Bloodline: what is done, and what is yours

v0.39. The five identity layers are now **Ancestry, Bloodline, Culture, Background, Calling**.

## Done, in scope

| File | Change |
|---|---|
| `starwrought-core-design.md` | 13 body mentions renamed. Added the v0.39 changelog entry. |
| `CLAUDE.md` | 3 mentions renamed (Root Rule, the `h` marker note). |
| `data/ancestries.xlsx` | `Human Lore!A19` and `A20`: "Heritage:" to "Bloodline:". Authoring-notes sheet, so no pipeline effect. |
| `Starwrought_Players_Handbook_v2.1_tracked.docx` | 12 tracked edits. See below. |
| `Starwrought_Character_Sheet_v2.1_Fillable.pdf` | Field label is now "Ancestry & Bloodline". |
| `phb-v2.0-drop-in-text.md`, `callings-and-combat-talent-audit.md` | 1 mention each. |

**Left alone on purpose:** the 26 mentions inside historical changelog entries in the design doc
(`*v0.13`, `*v0.15`, `*v0.17`, `*v0.29` and the rest). Those record what was decided at the time.
Rewriting them would falsify the project's own history. Same reasoning for the old audit and sync
reports (`phb-v1.2-audit.md`, `v1.8-sync-report.md`, `assets/phb_v1.1_baseline.md`).

## The 12 tracked changes in the PHB

Nine are the rename:

1. Ch1 intro, "heritage (the lineage within it...)"
2. The Origin paragraph, "Ancestry, heritage, and culture merge into one sky"
3. Chargen step heading "2. Heritage"
4. Chargen point table, "your Heritage's root Talent"
5. Chapter heading "Ancestries & Heritages"
6. Ancestry entry label "Heritage (choose one; root granted free)"
7. Chapter heading "Ancestry & Heritage Constellations"
8. Section heading "Human Ancestry & Heritages"
9. The bare "Heritages" subheading

Three are a separate bug, flagged and fixed in the same pass so you can approve or deny them
independently: **Diplomacy is not a constellation in the playtest.** The skills are Acrobatics,
Athletics, Awareness, Guile, Intimidation, Lore, Stealth. Three talents still roll Diplomacy:

10. **Courteous Comeback** trigger, "critically fail a Diplomacy check" to "a Guile check"
11. **Courteous Comeback** effect, "triggering Diplomacy check" to "triggering Guile check"
12. **Bazaar Bargainer**, "+2 circumstance to Diplomacy and Guile checks" to "to Guile checks"

**Refresh the table of contents after accepting.** Two TOC entries still read "Heritage"; they are
field results, so a right-click and Update Field fixes both. I did not track-change them, because
tracked edits inside a TOC field survive the refresh and turn into garbage.

## Yours: the app code

The rename is one word, so this is short. The only real decision is the third row.

| File | Mentions | What to change |
|---|---:|---|
| `assets/app_template.html` | 37 | Player-facing labels. |
| `assets/build_phb.js` | 20 | Labels, and it writes the PHB headings I just tracked. |
| `assets/xlsx_to_trees.py` | 8 | The `CATEGORIES` and `IDENTITY` tuples, and the `heritages` key it writes into `roster.json`. |
| `assets/constellation_template.html` | 4 | Labels. |
| `assets/render_constellations.py`, `assets/sheet_spec.json` | 1 each | Labels. |
| `Starwrought_App.html`, `Starwrought_Talent_Constellations.html`, `assets/roster.json` | 48 | Regenerated. Rebuild, do not hand-edit. |

**Keep `h` as the Root-column marker.** Two rows use it. It is a one-character flag, the converter
is the only thing that reads it, and changing it means touching the sheet and the parser together to
buy nothing. Rename the *label* in `CATEGORIES` and leave the marker alone.

## Two things I found while sweeping, not fixed

**`Devil's Advocate` (Chelaxian culture) is close to Paizo's prose.** It rolls a Diplomacy check, it
calls "Make an Impression," it uses the 1-minute conversation clause, and Chelaxian is a Golarion
proper noun. All three of those are in a talent currently shipping in the playtest PHB. I did not
tracked-change it, because the fix is a rewrite of the whole talent and its source of truth is
`cultures.xlsx`, which is already queued for the de-Paizo pass. Say the word and I will draft the
replacement talent plus new culture names for Varisian, Keleshite and Chelaxian.

**"the proud Padishah Empire"** is in the Keleshite culture blurb, same problem, same fix.
