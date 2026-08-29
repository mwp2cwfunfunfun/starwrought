# PHB v2.5: full pass

IDs continue from the v2.1 audit and are permanent. **SW-076** means the same thing forever.

**Verdict up front: this is close.** The structural work has landed, the placeholders are gone, there
are no em-dashes or en-dashes anywhere, and the systems that were bolted together in v2.1 now
reference each other properly. What's left is mostly arithmetic and half-applied edits, plus one
section that was written to prevent a problem and currently contains it.

**Counts: 6 Blockers, 19 Major, 17 Minor.**

## What's fixed since v2.1

Worth recording so nobody re-audits it: every `$$$$` and `???` placeholder, the Talent Point types
table (now both axes, all seven types), the Zone critical-effect table, `Reactive Strike` defined,
precision and persistent damage, temporary Hit Points, Heedless, Wrong-Footed, the Close and Unwieldy
traits, per-weapon reach, the 1-foot grid, cover by Zone count, Take Cover's requirement, shields as
**item** bonuses so they stack with cover, the Weapons Constellation grown to nine talents so Expert is
reachable, Stealth's three blank talents, the Weaponmaster Calling, the exploration activities, and the
"once per target per Skill" limit on Recall Knowledge. The maneuver **Special** clauses tying Exposed
Zones to degrees of success are your own addition and are the best new idea in the document.

---

# A. Blockers

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-076** | p335-346 | **The order of operations omits Protection and Temporary Hit Points.** The table lists only Immunity, Weakness, Resistance. The one section written specifically to stop damage arguments does not say when armour applies, nor when the buffer is spent. It also says to apply everything "before doubling," so **Weakness is doubled on a critical hit** while Protection's position is undefined | State all five steps: roll, double for a crit, subtract Protection (min 1), Immunity, Weakness, Resistance, then Temporary Hit Points, then Hit Points |
| **SW-077** | p572 + p1377 | **Reach is multiplied twice.** *Weapon Reach = base × **Weapon** Size Factor*, then *Total Reach = Weapon Reach × **Creature** Size Factor*. A Huge creature with a Huge longspear reaches **48 feet**; a Gargantuan one reaches 108 | Apply one factor. Use the weapon's size for the multiply and the creature's size only for the Minimum Reach floor |
| **SW-078** | p1095 vs p1235 | **Load Strain lost its Might subtraction and plate doubled in Load.** Plate pieces are now Load 2 each, so a full harness is **Load 8**, and Load Strain is now the raw total. That is **−7 Evade** after Endure training. The text beside it still reads "Load 4" | Decide whether Might still reduces Strain. If not, plate needs its Load back at 1 per piece. Either way the "Load 4" line is wrong |
| **SW-079** | p512 vs p524 | **Wounded has two different clearing rules on the same page.** p512: a night's rest, or ten minutes of treatment and an Endure check. p524: "only goes away once you reach full Hit Points" | Pick one |
| **SW-080** | p523 | **A night's rest restores level × Presence Hit Points**, which is 1 per night for a 1st-level character with Presence +1, so **22 nights to heal from 0**. It also contradicts p461, which says Hit Points "come back with a night's sleep," and combines with SW-079 to leave Wounded on you for weeks | Full restoration on a night's rest, or level × Might if you want attrition |
| **SW-081** | p2480 | **Escape has the Attack trait**, so it suffers and contributes to the multiple attack penalty. A grabbed character who Strikes first Escapes at −5, and at −10 after two Strikes. Escape is the counterplay to a Calling-defining maneuver and cannot be MAP-taxed | Remove the trait. Its results should also read Success / Failure rather than Graze / Miss |

---

# B. Contradictions and half-applied edits

| ID | Where | Finding |
|---|---|---|
| **SW-082** | p2434 | **Heave is now "Stride, then Shove," which is exactly Bull Rush**, at double the distance, free, with no talent point. This is the specific outcome you asked me to avoid. The version that protected Bull Rush's lane had **no movement at all** and bought *direction* instead: push in any direction rather than straight away |
| **SW-083** | p517 | **Refusing Death reads "Your Wounded value does not increase by 1."** The stray "by 1" says this was meant to be "does increase." As written, the most powerful effect in the game is also free |
| **SW-084** | p449-456 vs p1831-1836 | **Postures still scale the free ones and not the bought ones.** Give Ground and Set Your Feet grant your Agility or Presence; *Slip the Line* is a flat +2 and *Drop Flat* a flat +4. At Agility +3 or higher the free posture beats the talent you paid for |
| **SW-085** | p867 | **The Example of Play still describes a Posture as "+2"**, which stopped being true two versions ago |
| **SW-086** | p678 vs p654-668 | **Take Cover was not updated for the fourth grade.** It says "no cover becomes Cover, Cover becomes Greater Cover" and never says what **Lesser Cover** becomes. p2520 says "improves by one grade," which is right; the Ch. 2 copy is stale |
| **SW-087** | p633, p635, p2544 vs p612 | **"Seen" and "Observed" are the same state under two names.** The table says Observed; the prose and Seek's success line say Seen |
| **SW-088** | p2609 vs p2615 | **The two-action Recall Knowledge does nothing extra.** Study's critical success and success are identical to the one-action version. The only difference is that a critical failure becomes harmless, so two actions buy the removal of a downside rather than a benefit. The "name your topic before you roll" upgrade did not land |
| **SW-089** | p1044-1053 | **"Proficiency Bonus Bonus"** appears in all four Defense entries |
| **SW-090** | p2145 | **Reactive Strike is missing the three rulings it needs**: that the multiple attack penalty neither applies nor accrues, that you cannot use it against a creature Hidden or Undetected to you, and that the Strike resolves before the triggering action completes. Also "begins to use Manipulate action or Stride" wants "a Manipulate action" |
| **SW-091** | p2126 | ***Advanced Weapons Training* says "add your Proficiency Bonus to your attack rolls with any martial weapon,"** which is a copy-paste of the previous row. It should be that specific weapon. Separately, **no Advanced Weapons exist** in the equipment tables, so the talent is unbuyable-into |
| **SW-092** | p2111-2118 | **Martial Weapons Training requires Weapon Focus, which requires Simple Weapons Training.** Since Martial Weapons Training grants every martial weapon, Weapon Focus becomes dead the moment you take it. A tax rather than a choice |
| **SW-093** | p919 | **The Background chargen row still says it "adds a branch to your Origin Constellation"** while granting 1 Lore and 2 Skill and no Origin points. This is the last surviving piece of SW-018 |
| **SW-094** | p148-163 | **Restricted Talent Points gained after character creation require a Flare, with no fallback.** The Milestone row has the elegant "if there are no Flared Constellations available, it becomes a Comet." The other six rows do not, so *Driven*'s Calling Talent Point can strand |
| **SW-095** | p2586 vs p2589 | ***Break Them* has no downside.** Its Failure gives Frightened 1 and its Critical Failure gives "no effect," where the one-action version's critical failure emboldens the target. The two-action version is therefore **safer** as well as stronger |
| **SW-096** | p2350 | **Stunned N as written is a death spiral.** "Lose N actions immediately **and at the start of each of your turns**, reduce by 1 at end of each turn" means Stunned 3 costs **nine actions across three turns**. Slowed is written the same way and should be, but Stunned is normally one-time |
| **SW-097** | p1069 | **Downtime training still has no cap**, so a month of downtime Flares four Constellations of your choice and the third Axiom stops mattering. The Ch. 7 Train entry has the once-per-Milestone limit; Ch. 4 does not |
| **SW-098** | p2691 | **Look Harmless's critical failure lasts "until the start of your first turn."** Compare Feint and Seek, which use "start of your next turn." Here it should be the **end** of your first turn, or it expires without ever biting |
| **SW-099** | Ch. 7 maneuvers | **The maneuver result tables mix both vocabularies**: Critical Success, Success, **Graze**, **Miss**. Strikes use Critical Hit / Hit / Graze / Miss; non-attacks use the Success ladder. The maneuvers use half of each |
| **SW-100** | p2575 | ***Point Out* still requires an ally who can "hear **and** see you,"** and still requires the target to be Observed by you. In darkness, which is when creatures are Undetected, neither condition holds. Your own opening fiction has Hrolda doing this by voice, in the dark, having only heard the thing |

---

# C. Undefined terms still referenced

| ID | Term | Referenced by |
|---|---|---|
| **SW-101** | **Blinded** | The *Visual* trait: "It fails on the blinded." Not in Conditions |
| **SW-102** | **Deafened** | The *Auditory* trait: "It fails on the deafened." Not in Conditions |
| **SW-103** | **Squeezing** | The *Close* weapon trait: "while Squeezing." No squeezing rule exists |
| **SW-104** | **Balance** | p601: "may require you to make Balance or other checks." Balance is not a Skill Constellation |
| **SW-105** | **Immobilized** | Gone from the Defense-availability text, which now correctly says Grabbed or Restrained. **Resolved**; recorded so it is not re-flagged |

---

# D. Balance

| ID | Where | Finding |
|---|---|---|
| **SW-106** | Armor table | **Scale is strictly worse than mail and nobody will buy it.** Same Protection 3, but **50 gp against 25** and **Load 8 against 4**, in exchange for having no material weakness. I priced it as a gold cost only, for exactly this reason. Halve its Load or halve its price, not neither |
| **SW-107** | Downtime | **Nothing generates income.** *Earn a Living* and *Research* were dropped, leaving Retrain, Train and Provision. Characters start with 15 gp, a mail harness costs 25 and plate 45, and Provision is a way to spend money that does not exist |
| **SW-108** | p1015-1035 | **Only four Callings are in the Callings-At-A-Glance table**, but **Weaponmaster** has a full Constellation in Ch. 6. It has no HP per level, no Skill, and no row |
| **SW-109** | p965-980 | **Both Cultures have identical roots**, granting the same scaling Diplomacy bonus. Structurally correct as a template, but they are mechanically the same choice |
| **SW-110** | p1727 | ***Hold Fast* costs 1 damage per level.** At 1st level that is 1 Hit Point to refuse a Graze cost, which is close to free, and Grazes are roughly two attacks in five. Worth watching before it is worth changing |

---

# E. IP and copy

| ID | Where | Finding |
|---|---|---|
| **SW-111** | p959, p965, p973 | **Keleshite, Chelaxian and Varisian are still the only Cultures.** Replacements drafted in `phb-v2.1-audit-content.md`: **Serrovane** and **Kestrel Reach**, neither ethnically coded |
| **SW-112** | p997 | **The Soldier background still carries the Artisan's description** about apprenticing at a forge. Flagged in the v2.1 audit |
| **SW-113** | TOC | **Key Terms is missing from the Contents.** It exists at p715, inside Chapter 2, between Modes of Play and the Example of Play |
| **SW-114** | p2715 | **Appendix A says Key Terms is in "Chapter 3."** It is in Chapter 2 |
| **SW-115** | p1112 | **"Leader cap"** wants **Leather cap** |
| **SW-116** | p797 | **"Arms, Legs, Torso, Head.."** double full stop |
| **SW-117** | p1056 | **The "Comets" heading under character creation is still empty**, while the Level-Up Checklist tells players to "spend your Comet" |
| **SW-118** | p2687 | **"each enemy has Observed you"** wants "each enemy that has Observed you" |
| **SW-119** | p815, p848 | Example of Play: **"1d6 Precision"** should name Sneak Attack, and **"Critical Success"** should be **Critical Hit** for a Strike |
| **SW-120** | p645 | **Darkness makes creatures "Hidden or Undetected to you."** Which one? Everything else in the section is a single state |
| **SW-121** | p486 | **"Attacks against you succeed without a roll"** while Dying does not say whether that is a Hit or a Critical Hit, which matters because a Critical Hit adds 2 to your Dying value rather than 1 |

---

# What I would fix before the table

Six things will actually stop or distort play. Everything else can be discovered in session and
patched after.

**SW-076** (the damage order is missing Protection), **SW-077** (reach multiplied twice),
**SW-078** (plate is −7 Evade and the text says otherwise), **SW-080** with **SW-079** (healing at
1 Hit Point a night, and two rules for Wounded), **SW-081** (Escape is MAP-taxed), and **SW-083**
(Refusing Death costs nothing).

After those, the highest-value single edit is **SW-084**, because postures are a choice players make
on almost every enemy turn, and right now the free option beats the purchased one for anybody who
invested in the relevant attribute.

**And one non-finding worth saying plainly.** The maneuver **Special** clauses, where an Exposed Zone
raises the degree of success by one, are the best thing added in this version. They give Trip, Disarm
and the rest a reason to care about the Zone system, they reward setting up rather than repeating, and
they cost one line each. If you want a pattern to extend, that is the one.
