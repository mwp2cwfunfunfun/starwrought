# PHB v1.6 audit

Full pass: 287 blocks, 58 tables, all six chapters. Playtest trims are not flagged.

**Fixed since v1.5 and confirmed good:** maneuver requirements now name their own traits; the maneuver
Graze band restored "the defender still pays the Graze cost"; the unseen ladder and Seek's rung rule
are in; "a creature that cannot see you is off-guard to you" is in; Escape dropped the *attack* trait,
which cleanly resolves the Endure conflict; both Graze tables now agree.

---

## 1. Balance: Might fell out of damage

Chapter 4 reads: *"Damage on a Hit is your weapon's dice plus your weapon specialization."*

**This is almost certainly an editing slip, and the Graze rule proves it.** The Graze rule says *"Add
no attribute, no specialization, no extra dice from your level."* You can only exclude an attribute
from Graze damage if attributes are normally part of Hit damage. Two other places still assume it:
Trip's critical deals *"damage equal to your Might"*, and *thrown* weapons use *"Might for the attack
roll"*.

**What it does to the game if left in.** A d8 weapon at first level averages 4.5 damage. A breastplate
is Protection 4.

| Level | Hit without Might | After Protection 4 | Reduction |
|---|---|---|---|
| 1 | 4.5 | **0.5** | 89% |
| 4 | 9.0 | 5.0 | 44% |
| 12 | 16.5 | 12.5 | 24% |
| 19 | 22.0 | 18.0 | 18% |

At first level an armored torso is nearly immune. With 20 or so hit points, dropping a breastplated
character takes about forty landed hits. **Fix: restore "plus your Might".**

It also leaves **Might with almost no offensive job**: it would be an attack attribute for non-finesse
weapons and nothing else, while Agility characters lose nothing at all by taking *finesse*.

If the removal was deliberate, following the "attributes don't add to damage" principle, then the
**Protection table has to come down by roughly half**, because every value in it was calibrated
against damage that included Might. Do one or the other, not neither.

---

## 2. Ranged weapons do not exist

There is a Simple Melee table and a Martial Melee table, and nothing else. No bow, crossbow, sling,
or javelin appears anywhere in the book.

Meanwhile **Archery is a full Combat Style** in Chapter 6 with Point-Blank Stance and Hunter's Eye,
and **Weapon Focus** offers "bows" as a weapon group. An archer currently has no weapon.

Missing alongside them: the **range X**, **reload X**, and **volley X** traits.

---

## 3. Every weapon costs 1 gp

Dagger, quarterstaff, greatsword, polearm, and maul are all priced at 1 gp. That erases weapon
choice as an economic decision and contradicts the starting equipment text, which promises *"a
leather kit with a good sword and money left over."*

Either restore a spread (2 sp for a dagger up to 3 gp for a maul), or make the flatness explicit:
*"Weapons are cheap. Armor is the investment, and armor is where your gold goes."* The second is a
perfectly good playtest simplification, it just needs saying.

---

## 4. Contradictions and errors

| Where | Problem |
|---|---|
| Load bullet | Garbled: *"Load. It applies to Acrobatics, Athletics, Stealth, and Thievery."* The words "Your check penalty equals your" are missing. |
| Matched harness | Requires *"all four of your pieces the same material"*, but **the armor table has no material column**. Only Protection numbers are given, so the rule cannot be applied as printed. |
| Matched harness | Now grants +1 Protection **and** −1 Load, making a full plate harness Load 3. Generous; check that's intended. |
| Tower shield | Listed as **+2\*** with no footnote defined anywhere. |
| Tower shield | *"+4 Evade instead of the usual +2 Guard."* Take Cover gives +2 **Evade**, not Guard. |
| Comfort | *"unless everything you are wearing has comfort"*, but only the padded coif and gambeson have it, and they cover Head and Torso. Sleeping in armor therefore requires bare arms and legs, which makes the trait nearly dead. |
| Grapple trait | Referenced by the Grapple action, but the trait table defines only *trip, disarm, shove*. |
| Battleaxe | Trait reads **"Sweet"**. |
| Attack table header | Still **"Defense Theshold"**. |
| Trait casing | Inconsistent across tables: *comfort/Comfort*, *quiet/Quiet*, *noisy/Noisy*. |
| Leap | Still 5 feet horizontally, which is a Step's distance while carrying the *move* trait, so it provokes and is strictly worse than Step. |
| Delay | Still costs ◆. Giving up your turn and paying an action for it is a strange trade. |
| Disarm critical | The weapon *"lands in their square"*, so they simply pick it up. Ten feet away is the usual. |
| Shove and Disarm | Both carry Grapple's *"no more than one size larger than you"* restriction. You can shove a giant; you just don't move it far. |
| Chapter 6 | Two **"Perception"** references remain in talent text. Spreadsheet fix. |

---

## 5. Structure and flow

### The one that matters most

**Every internal heading in Chapter 4 is body text.** "Armor", "Shields", "Weapons", "Weapon Traits",
"Armor Traits", "Starting equipment", "Load, strain, and the check penalty", and the rest are all
styled Normal. They do not appear in the Contents, they do not scan on the page, and the chapter
reads as one undifferentiated wall. This is the single highest-value fix in the document.

### Chapter 2 is doing too much

It currently contains the attribute system, the check formula, degrees of success, the Defenses, the
proficiency ladder, Hero Points, all 29 actions, the whole of Striking and Defending, the unseen
rules, the conditions list, and the traits glossary. That is roughly 40% of the book and the entire
rules engine in one chapter.

**Recommended split:**

> **Chapter 2, The Core Rules.** Attributes. Checks and degrees of success. Proficiency,
> constellations, and talents. Hero Points. The three modes of play.
>
> **Chapter 3, Encounters.** Traits. Conditions. Actions and Activities. Attacking and Defending.
> Striking and Defending. Concealed, Hidden, and Undetected.

Everything after renumbers by one, which is cheap to do now and expensive later.

### Three ordering problems inside the current Chapter 2

**Traits comes last, after everything that uses it.** Actions and Activities lists traits in every
single row, and the reader cannot look up what *move* or *concentrate* means until several pages
later. Traits should come first in any chapter that uses them.

**Attacking and Defending is separated from Striking and Defending** by Proficiencies, Hero Points,
and all five subsections of Actions. One of those introduces the four Defenses and the other spends
the whole section using them. They belong adjacent.

**Conditions in Brief sits after Striking and Defending**, which references Exposed, Pressed,
off-guard, and prone throughout. Either move Conditions ahead of it or accept a lot of forward
references.

### Suggested order within the new Encounters chapter

1. Traits
2. Conditions in Brief
3. The Three-Action Round, then Actions and Activities
4. Attacking and Defending (the four Defenses)
5. Striking and Defending (the resolution rules)
6. Concealed, Hidden, and Undetected

That runs vocabulary first, then the menu of things you can do, then how a blow resolves, which is
also roughly the order a new player needs them at the table.

### Smaller structural notes

- **Chapter 4 has no lead paragraph** before "What gear does, and what it doesn't"; it opens directly
  on a subheading that is not formatted as one.
- **The Skill Constellations overview table** sits before the individual skill entries, which is
  right. Consider doing the same for Defenses and Martial constellations so every group in Chapter 6
  opens the same way.
- **Ancestries-At-A-Glance has one row.** Fine for a playtest, but it may read better as a sentence
  until there are three or more ancestries.
