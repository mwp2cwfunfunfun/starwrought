# PHB v1.2 audit

Full pass over all 6 chapters, 198 paragraphs and 40 tables. Deliberate playtest trims (Expert and
above talents, one ancestry, two cultures, two callings, no magic) are **not** flagged.

Ordered by severity. **[C]** contradiction, **[M]** missing, **[X]** cut it.

---

## Fix these first

1. **The attribute divisor is wrong, and the cause is in your design doc.** The PHB says ÷5 in three
   places. Core design v0.34 changed it to **÷3** ("THE L1 FEEL FIX"). The reason the wrong number
   got in: `starwrought-core-design.md` §3 still contains the old line *"Attribute bonus = attribute
   points ÷ 5"*, because v0.34 updated the changelog and §12 but never the body. The PHB copied a
   stale line faithfully. **Fix the design doc too or this will keep coming back.**

   The replacement breakpoint table for ÷3, minimum +1, cap +5:

   | Attribute points | Bonus |
   |---|---|
   | 1 to 5 | +1 |
   | 6 to 8 | +2 |
   | 9 to 11 | +3 |
   | 12 to 14 | +4 |
   | 15+ | +5 |

2. **Saves are still in the book**, in eight places, despite being merged into the Defenses. Most
   damaging: Chapter 3 opens with *"every character begins Trained in Fortitude, Reflex, Will,
   Awareness, and Weapons"*, which undoes the merge in the one sentence a new player reads first, and
   names three constellations that do not appear anywhere in Chapter 6.

3. **AC is still in the book**, in seven places, including the whole armor section.

4. **Chapter 4's Arms & Armor is the entire old armor system** and needs deleting, not editing. It
   still has the "two stats that sum to 3" budget, the four-category table, AC contributions, and
   *"armor proficiency only applies while wearing that armor type"*. Meanwhile **Endure Training
   references "Load strain" and "your armor's check penalty", and neither term is defined anywhere in
   the book.**

5. **Nobody can calculate their hit points.** Three partial formulas, no complete one: ancestry gives
   "HP per level" (step 1), Callings give HP/lvl (4 and 2), Finishing Up says add 10 at first level,
   and the Level-Up Checklist says *"+HP equal to 6 + Might"*, which is stale twice over (v0.34 made
   it 8 + Might, and the new model replaced that entirely).

---

## Contradictions

**[C] Defense training is stated three incompatible ways.**
- Ch2: "your character begins play Trained in all four."
- Ch3 step table, row 6: "Your defensive posture (Evade or Guard)", 1 Defense point.
- Ch3 Defenses section: "you must choose between Awareness, Evade, and Guard." **Endure is missing
  from the list of choices.**

If all four are free at Trained, then the 1 point is a deepening point and should say so.

**[C] Culture roots lost their v0.38 scaling clause.** Both read "You learn the [X] and Common
languages" and nothing else. That is exactly the Root Rule violation we fixed: nothing rolled,
nothing that improves by rank. Worse, Ch3 codifies it as a rule: *"Choosing a culture grants its root
free, which always consists of just a language."* Restore the clause: their two named Skills gain +1
in situations the upbringing prepared you for, rising to +2 at Expert, +3 at Master, +4 at Legendary.

**[C] Versatile Human lost its clause too**, reading only "You gain 1 Opening Talent Point." Same
violation. Note the Human ancestry root on the same page **did** keep its ladder (+1/+2/+3/+4 on Aid),
so the page contradicts itself about whether roots scale.

**[C] Weapons is simple-only in Ch6 but universal in Ch4.** Ch6 has "Simple Weapons Training… your
attack rolls with any **simple** weapon." Ch4 says "your attack bonus comes from the Weapons
constellation with **any** of them." The weapon table is mostly martial weapons (greatsword, longbow,
battleaxe), so as written a starting character has no proficiency with most of the list.

**[C] The Comet exception is missing from the Flare restriction.** Ch2 says a Comet may be spent
"anywhere, Flared or not, opened or not." Four paragraphs later: "With the exception of during
character creation, you may not spend a Talent Point in a Constellation that is not Flared." The
second forbids what the first allows. Add Comets to the exception.

**[C] "Monsters, hazards, and DCs from Pathfinder 2E work as printed"** is no longer true. You now
need the AC-to-defenses conversion, the monster attack number, Protection from equipment lines, and
the save-to-Defense mapping. None of it is in the book.

**[C] Player-facing rolls are absent, and the book states the opposite.** The "Who rolls?" rule still
says *"A creature is aiming something at you. **They** roll a check. Your Defense is the number they
have to beat, and it sits there without a die."* That is the version we replaced. Also missing: the
monster attack number (**printed bonus + 12**, meet or beat) and the `Jaws 24, Claw 21` stat block
format.

**[C] "It is a Save when the world acts against you… since a DC simply uses 10"** in Attacking &
Defending uses both retired terms in one sentence.

**[C] Size typo.** "Large: −1 Evade, **+6** Guard" should be +1.

**[C] Four action entries point at retired numbers.** Grapple/Shove/Trip "vs. Fortitude or Reflex DC"
should be Endure. Demoralize "vs. Will DC" should be Guard. Feint "vs. **Perception** DC" should be
Awareness, and Perception is not a term this game uses at all. Seek "vs. Stealth DC" is fine except
Stealth does not exist in this playtest (below).

**[C] Three table headers are copy-paste errors.** Cultures-At-A-Glance is headed "Ancestry".
Defenses-At-A-Glance is headed "Calling". The Ambusher section's table is headed "Calling" and Rage's
is headed "Talent", though both contain the same content.

**[C] Callings have no talent trees.** Ch6's Ambusher and Rage sections each just reprint the
At-A-Glance table with both callings in it. So the two Calling entries are identical to each other
and to Ch3's table. No Calling talents are listed anywhere.

**[C] Dangling references to constellations not in this playtest.** Stealth (Ambusher grants Training
in it; Seek rolls against it), Intimidation (Demoralize), Deception (Feint), Diplomacy and Society
(Bazaar Bargainer, culture roots), and **"Great Weapons"**, named in the Combat Styles introduction
but absent from the five styles listed. Either add a line saying these arrive in a later packet, or
reword the references.

**[C] ✧ means two things.** The symbol key says "✧ Constellation root talent", but the design has
used ✧ for **heritage** roots specifically since v0.23. If it now marks every root, heritage roots
need a different mark, and Ch6's heritage rows currently carry no mark at all.

**[C] Orphaned fragment in Ch2**, mid-sentence: *"On the flip side, any time the world affects you (a
creature attacking you,"*.

**[C] Human's root switched to a status bonus** while essentially every other talent in the book
grants circumstance bonuses. Status bonuses do not stack with other status bonuses, so this quietly
changes how it interacts. Probably worth making it circumstance for consistency. It also dropped the
"you can Aid without having prepared to" clause, which was the distinctive half.

**[C] Aid's flat DC 15** never scales, so it is trivial by mid levels. Every other number in the game
includes level.

---

## Missing

**[M] The four Defenses are never described to the player.** "Attacking & Defending" is two sentences
with no table. Missing entirely: the four names and attributes, what each one answers, the
Evade-or-Guard choice and what it costs you, and the availability limits. Drop-in copy is in
`phb-v1.2-build-manifest.md` §3.

**[M] The whole combat subsystem.** Ch4's "Striking & Defending" contains only the Size line. Absent:
Graze consequences (Yield and Follow, or hold and become Pressed), the four zones, Protection, Load,
Exposed, Recenter, and action investment buying precision. **Graze appears in the degrees table with
no rules attached anywhere in the book.**

**[M] Graze's "no riders" clause.** Without it, precision damage applies on a Graze and every failed
attack becomes a sneak attack delivery vehicle.

**[M] Exposed and Pressed are not in the conditions list**, yet three talents already reference them:
Unshaken and Cover the Angle (Pressed) and Read the Tell (Exposed).

**[M] Recenter is not in the actions table.**

**[M] No derived stats table in Ch2.** Finishing Up tells the reader to get "derived stats… from
Chapter 2", and Chapter 2 has none. Needs the HP formula plus Evade, Guard, Awareness, and Endure,
each `10 + level + attribute + proficiency`.

**[M] The Comets section is an empty heading.**

**[M] Endure has three talents where the others have four.** Turn the Point and Quick Buckle are the
two that were cut, both of which depend on zones existing, so this resolves itself once §4 lands.

**[M] Finishing Up's gear line still says "armor matching your armor constellation."** Those retired.

---

## Cut

**[X] "The Four Attributes" (H3) duplicates "Character Mechanics" almost verbatim.** Both list the
four attributes and both state the divisor formula. Keep the H3 with the table, delete the duplicate
prose above it, or vice versa.

**[X] Two of the three Callings At-A-Glance tables.** The same table appears in Ch3 and twice in Ch6.

**[X] The entire armor block in Ch4** (prose, the four-category table, and the shields sentence).
Superseded by zones and Protection.

**[X] Three separate pf2e-compatibility statements**, in Ch1 twice and Ch2 once. Consolidate to one.

**[X] "Choose an ancestry: its root talent is granted as part of this choice"** duplicates row 1 of
the step table on the previous page.

**[X] "Do you cast might arcane spells?"** in the Callings intro. Typo for "mighty", and magic is
explicitly out of this playtest, so the question sets up an option that does not exist.

**[X] Hunter's Eye's "(feeds Agility)" override** in Archery, which already feeds Agility.

**[X] One of the two things called "Playing the Game."** It is an H2 in Chapter 2 and the title of
Chapter 4.

---

## Consistent, worth noting

These all checked out and need no work: the proficiency ladder (+4/+7/+10/+13 at 1/4/9/16 points and
levels 1/5/13/19) matches the core design exactly; the degrees table's Graze mapping is right; the
Flares section is fully current; ancestry HP 8 and Calling HP 4 and 2 match the agreed model; the
Ancestries-At-A-Glance table correctly has no Senses column, reflecting the removal of innate vision;
the four Defense root talents are almost verbatim correct and all four satisfy the Root Rule; and the
background skill assignments only reference skills that exist in this playtest.
