# PHB v2.1: deep audit

Every finding has a permanent ID. IDs are never reused, so **SW-041** means the same thing forever,
in this file and in every later version. Severity: **Blocker** stops a playtest table cold,
**Major** produces a wrong or unfair outcome, **Minor** is polish.

I have separated out the things you already told me are mid-edit, at the very end, so they do not
clutter the real findings.

Counts: 9 Blockers, 34 Major, 31 Minor, 74 total.

---

# A. Blockers

Things a table will hit in session one and be unable to resolve.

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-001** | Ch. 6 Weapons, Ch. 4 | **No character can legally use a martial weapon.** *Simple Weapons Training* grants proficiency with "any simple weapon (and unarmed strikes)" only, and *Weapon Focus* is the only path to more. But the Callings, the Combat Styles, and the starting-equipment advice all assume martial weapons: **Great Weapon Fighting requires a two-handed weapon and every one of them is martial**, Dueling wants a rapier, and the gear text tells you to buy "a good sword." A Great Weapon character must spend a talent on *Weapon Focus* or swing at +0 instead of +4. | Either make the Weapons root cover all weapons in the playtest, or state the untrained-weapon penalty and add *Weapon Focus* to the recommended level-1 buys |
| **SW-002** | p347 vs p258/p936 | **Protection has two contradictory floors.** The Protection section says "Protection cannot reduce the damage to 0." The Graze rule says subtract Protection "(which may leave nothing at all)." These produce different games: with a floor, armor can never fully stop a Graze and light armor is much closer to heavy | Pick one. A minimum of 1 is the more interesting rule and I would keep it, but then delete the parenthetical |
| **SW-003** | p273 vs p282 | **Who picks the Zone on a Graze is stated two ways.** The Defense Rolls table says "You choose the Zone where it lands." The *Guarding with a Zone* table says "Which zone follows from how you are guarding, **not from what would be convenient**." Both cannot be true, and the second is currently dead text | Decide. See SW-010 for the consequences either way |
| **SW-004** | Ch. 3, Ch. 6 | **Only one Ancestry exists.** *Ancestries-At-A-Glance* lists Human alone, and Ch. 6 has only *Human Ancestry & Bloodlines*. Yet the opening fiction stars a dwarf, the Example of Play uses a dwarf and an elf, and the Key Terms entry names five | Add the other four, or scope the playtest to Humans and say so on page one |
| **SW-005** | p1580-1600 | **Stealth's three non-root talents have no names and no effects.** Only the Tier and Requires cells are filled | Author three Stealth talents |
| **SW-006** | p1128, p1161 | **Both Culture root talents have empty Effect cells.** *Raised in Cheliax* and *Raised in the Kelesh empire* do nothing that is written down | Author both. See SW-023 |
| **SW-007** | TOC vs body | **Chapters 4 and 5 are swapped.** The TOC says 4. Equipment / 5. Gaining a Level. The body says 4. Gaining a Level / 5. Equipment. Every cross-reference to a chapter number is therefore suspect | Renumber the body and refresh the TOC field |
| **SW-008** | p343 | **Set Your Feet adds its bonus to the wrong Defense.** It reads "a circumstance bonus equal to your Presence to **Evade**." It is the Guard posture | "to Guard" |
| **SW-009** | p736 vs p608 | **The Defense step contradicts itself.** p608 says every character "begins Trained in Weapons, and the four Defenses." p736 says "You must choose between Awareness, Evade, Guard, and Endure," which reads as choosing which one you are Trained in | Reword p736 to "spend this point on a second talent in any one Defense" |

---

# B. Rules contradictions

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-010** | p1336, p1406, p1700 | **Three talents assume the guard-zone rule that SW-003 contradicts.** *Sixth Sense* ("the zone you were guarding with"), *Kneel Behind the Shield* ("your guard zone becomes Exposed"), and *Clinch* (which grants you the choice, implying the defender normally has it) cannot all be right at once. *Sixth Sense* is currently dead text: if the defender freely chooses, there is nothing to redirect | Resolve SW-003 first, then reword whichever talents fall on the wrong side |
| **SW-011** | p147 vs p489 | **Hero Points have two different rules.** Ch. 2 says reroll "a check you are Trained or better in." Key Terms says "reroll a check," full stop. The Trained restriction is the deliberate wedge between Untrained and Trained | Restore the restriction in Key Terms |
| **SW-012** | p468 vs p769 | **Retraining is a month in Key Terms and a week in Ch. 5** | Pick one. A week matches the Flare cadence better |
| **SW-013** | p195/p265 vs p237 | **Postures are declared at two different times.** Both roll sequences put the posture decision *before* adjudication. The Graze resolution then says "The defender may use a reaction to choose a Posture. This may impact the Zone or even the degree of success" | Delete the posture line from the Graze steps; the sequence already covers it |
| **SW-014** | p574 vs p339/p343 | **The Example of Play still describes postures as a flat +2**, but the postures now scale with an attribute | Update the box to match |
| **SW-015** | p721 vs Example of Play | **Ambusher HP/lvl is 2 in the Callings table** but the Example of Play computes Wren at 21 HP, which requires 3. The v2.0 decision raised Ambusher to 3 | Set it to 3, or fix the example |
| **SW-016** | p1621 vs p1895 | **"A polearm sweep trips with Great Weapons, not Athletics"** is asserted in the Combat Styles intro, but the *Trip* action says Athletics and no Great Weapon talent overrides it | Either add the override talent or delete the parenthetical |
| **SW-017** | p364 vs p509 | **Initiative is described two ways.** Ch. 2 says "Awareness is the default roll for Initiative." The Example of Play box says "There is no separate initiative statistic; you roll the check that matches the activity" | Reconcile: Awareness by default, activity-based when the GM says so |
| **SW-018** | p605, p626 vs p683 | **Background is promised a branch of the Origin Constellation twice and given none.** The Origin paragraph says its points can go "inward into the Origin itself"; the chargen table says it "adds a branch to your Origin Constellation"; the Backgrounds section grants only 1 Lore and 2 Skill | Either honor it or delete both promises. This is stale from v0.13 and was contradicted by v0.29 |
| **SW-019** | p1465 vs p1541 | **Guile's Key Attribute is Presence in the skills table and Wits on its own constellation header** | Pick one. Presence fits Guard-adjacent social pressure; Wits fits misdirection |
| **SW-020** | p666 vs the Root Rule | **"Choosing a Culture grants its root free, which always consists of just a language."** A language-only root carries nothing rolled and nothing that scales, which breaks the standing Root Rule and regresses the fix made in v0.38 | Restore a rolled, scaling clause to culture roots |
| **SW-021** | p662, p664 | **Both Human Bloodline roots break the Root Rule.** *Torchbearer Human* has a rolled element but no Expert/Master/Legendary scaling. *Versatile Human* ("You gain 1 Opening Talent Point") has neither | Add scaling to Torchbearer; rebuild Versatile around something rolled |
| **SW-022** | p1078 | ***Driven* grants a Calling Talent Point at level 1**, which lets a Human open a second Calling at 1st level. The standing rule is one Calling at 1st level and at most one new Calling per level | Restrict it, or confirm the exception is intended |

---

# C. IP and legal hygiene

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-023** | p671-678, p1120-1185 | **Both Cultures are Golarion:** Chelaxian and Keleshite. "Varisian" also appears in the Culture intro prose, and "the proud Padishah Empire" in the Keleshite blurb | De-Paizo pass. These are trademark and Product Identity territory, not the copyright-exempt mechanics category |
| **SW-024** | p1136 | ***Devil's Advocate* is close to Paizo's prose**, not merely its mechanic: it reproduces the structure, names "Make an Impression," and carries the 1-minute conversation clause. Expression is exactly what copyright protects | Clean-room rewrite |
| **SW-025** | p1136 | Same talent also uses **"saving throws,"** a term this system retired when saves merged into the four Defenses | "Endure checks" |
| **SW-026** | p1136, p1164, p1181 | **Diplomacy is rolled by three talents and is not a Constellation** in this game. The skill list is Acrobatics, Athletics, Awareness, Guile, Intimidation, Lore, Stealth | Guile in all three |
| **SW-027** | p1136 | Same talent references **"Make an Impression,"** an action that does not exist here | Remove or define |

---

# D. Missing or dangling rules

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-028** | p1786 | **"Reactive Strike" is referenced and never defined.** The *Move* trait says leaving a foe's reach "can provoke a Reactive Strike from anyone who has one," and nothing in the book grants or explains one | Define it, or reword to a generic reaction |
| **SW-029** | p305-315 vs p1808 | **Sickened, Dazzled, and Dazed appear only in the Zone critical-effects table and are absent from Conditions in Brief** | Add all three |
| **SW-030** | p1200, p1232, p1265 | **"Precision damage" is never defined.** Three talents deal it. Does it double on a crit? Is anything immune? Does it apply to a Graze? | Define it, ideally next to the Graze rule |
| **SW-031** | p1305 | **"Temp HP" is never defined.** Rage grants it | Define it in Key Terms |
| **SW-032** | p1791, p1795 | **The *Flourish* and *Open* traits are defined and used by nothing.** Zero talents carry either | Either tag the talents that should have them or cut both definitions |
| **SW-033** | p1454-1467 | **Medicine is listed as a Skill Constellation and has no table.** Meanwhile **Intimidation has a full table and is missing from the list**, and **Awareness is a Defense but also functions as a skill** without appearing here | Reconcile the list against what exists |
| **SW-034** | Ch. 2 | **Nothing says how a creature's multiple attack penalty works.** With player-facing rolls the penalty cannot come off a die roll, so it has to come off the Threshold. The Example of Play uses −5, but no rule states it | One sentence in Ch. 7 |
| **SW-035** | Ch. 2 | **Nothing gives the pf2e monster conversion formula.** Every GM running this playtest will be converting creatures, and the attack Threshold conversion exists only in your design notes | Add a short sidebar |
| **SW-036** | Ch. 7 | **Nothing defines what happens on a natural 20 or 1 for a Defense roll** in player-facing terms. The degrees table covers checks and Strikes | Clarify that it steps the defender's result |
| **SW-037** | p1616 | ***Quick Draw*: "Use a reaction to draw or stow a weapon."** Interact already does this for one action. Is the reaction once per round like all reactions? Is the trigger anything at all? | Give it a trigger |
| **SW-038** | p421, p745, p748 | **The availability limits on Evade and Guard are stated three separate times**, in three slightly different wordings | State once, cross-reference twice |

---

# E. Balance

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-039** | p339, p343 vs p1381, p1386 | **The free postures now scale with an attribute and the bought ones do not.** *Give Ground* gives +Agility; *Slip the Line*, a talent you paid for, gives a flat +2. At Agility +3 or higher the free posture is strictly better, so two Evade talents become dead purchases the moment you invest in Agility | Either flatten the free postures back to +2 or scale the bought ones |
| **SW-040** | p339, p343 | **The free postures are a trap at low attributes.** Everyone is Trained in all four Defenses, so a Might-focused character has Agility +1: *Give Ground* costs an Exposed Zone to buy **+1**. The posture is weakest for the characters most likely to need it, and strongest for those already winning | This is the compounding problem. A flat +2 does not have it |
| **SW-041** | p273 | **The Graze cost is close to free for a level-1 character.** The defender picks the Zone that takes the damage *and* becomes Exposed, so the dominant play is to pick your least-armored Zone, which for most starting characters has Protection 0 anyway. What keeps this honest is the Zone critical-effects table, so that table is now load-bearing | Make sure SW-046 is filled in, and consider the guard-method version from SW-003 |
| **SW-042** | p721 | **Ambusher has 2 talents and Berserker has 2, while Bravo and Hunter have 5 each.** Two of the four Callings are half-built, which will read as those Callings being weaker rather than less finished | Author three more for each |
| **SW-043** | p1608-1619 | **Weapons has 3 talents, so Expert rank (4 points) is unreachable.** Nobody can ever gain the +7 attack proficiency or any weapon specialization damage. It is the one Constellation that touches every attack roll in the game | Author at least one more, ideally to 5 for parity with the Defenses |
| **SW-044** | p1029 | ***Sweep* is dead in a single-target fight**, which is most fights: "+1 to attack a target you have not yet attacked this turn" does nothing against your only enemy. The battleaxe, greataxe and polearm all carry it | "+1 on your first attack against each target" reads the same in a crowd and pays out in a duel |
| **SW-045** | p1685 | ***Shield Block* reduces damage by a flat 5** with no reference to the shield's Hardness, but Ch. 4 says "Hardness matters only if you have the Shield Block talent: it is how much damage the shield swallows" | Make Shield Block use Hardness, which also makes the Hardness column mean something |
| **SW-046** | p309 | **Arms / Critical Hit & Exposed is "???"**, and per SW-041 that table is now carrying the weight of the whole Graze economy | Fill it in. Suggest: the target drops one held item |
| **SW-047** | p1571 | ***Battle Cry* Demoralizes every enemy within 15 feet with one roll** for one action, where *Demoralize* handles one target for one action. In any fight with three or more enemies this is strictly better than the base action by a wide margin, at Trained tier | Cap the number of targets, or move it to Expert |
| **SW-048** | p1444 | ***Second Wind* is once per day** in a game whose other resources run per encounter or per session. A once-per-day button in a playtest that will mostly run single encounters is either free healing or never used | Per encounter, or per session |
| **SW-049** | p1219 | ***Panache* triggers on "critically succeed on a roll with consequences,"** which is the same trigger as a Flare, so a Bravo generates Panache from any crit anywhere, including out of combat | Narrow to combat rolls, or to rolls the Bravo makes |
| **SW-050** | p924 | **Tower Shield gives +4 Evade via Take Cover while also giving +2 Guard**, for Load 2 and 10 gp. Compare the plain Shield at +2 Guard for Load 1 and 5 gp. The tower shield is the only shield that improves both Defenses | Intended? If so it is fine; if not, make Take Cover with a tower shield cost the Guard bonus |

---

# F. Math and numbers

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-051** | p1055 | **"Fifteen gold buys a breastplate and greaves" is wrong: that is 25 gp.** | Rewrite the example |
| **SW-052** | p1055 | **"or a full mail harness with a shield" is 30 gp**, double the budget | Rewrite |
| **SW-053** | p890 | **"A complete harness of plate is four pieces, Load 4, and about 25 gp." It is 45 gp.** 25 gp is the price of the all-**mail** harness | Correct the number, or change "plate" to "mail" |
| **SW-054** | p1054 vs p1055 | The only accurate example in the paragraph is the third, the leather kit with a sword at 13 gp. Given SW-051 to SW-053, **starting gold may simply be too low for the picture the text paints** | Consider 25 gp starting, which makes all three examples nearly true |
| **SW-055** | p893 | ***Matched harness* is reachable only at Protection 3 or 4**, because the Head zone has no Protection-2 option (coif 1, open helm 3, closed helm 4). So the bonus is unavailable to anyone in leather, which is the opposite of where a "kit that sits well" bonus belongs | Add a Protection-2 head piece, or relax the rule to "no piece differs by more than 1" |
| **SW-056** | p371-373 | **Travel Speed formulas produce odd results.** Miles per Day = Speed means a Speed 25 character walks 25 miles a day, while Miles per Hour = Speed/10 gives 2.5 mph, which is 20 miles in an 8-hour day | Reconcile the two |
| **SW-057** | p378 | **"Greater Difficult Terrain cuts it by a third"** is ambiguous: to one third, or by one third leaving two thirds? | "to one third" |
| **SW-058** | p154 | **"two effects that each would triple something, would instead multiply it by 5"** is correct pf2e math but stated without explanation, and the halving example is cut off mid-sentence | Finish the sentence and give both examples |

---

# G. Clarity and copy

| ID | Where | Finding | Fix |
|---|---|---|---|
| **SW-059** | p1333, p1348 | ***Sixth Sense* and *Second Sense* are two talents in the same Constellation with near-identical names** | Rename one |
| **SW-060** | p1510-1517 | ***Kip Away* requires *Kip Up*, and *Kip Up* is printed below it** | Reorder |
| **SW-061** | p1439 | ***Shrug It Off*: "Reduce all persistent damage you take by your Might, minimum 1."** Minimum 1 damage taken, or minimum 1 reduction? | Disambiguate |
| **SW-062** | p934 | **"your weapon's dice, plus your Might, bonus plus your weapon specialization"** is garbled | "plus your Might bonus, plus" |
| **SW-063** | p555 | **"double damage, and the attacker what Zone was struck"** is missing a verb. Also calls it a Critical Success where the Strike table says Critical Hit | Rewrite |
| **SW-064** | p587 | **"I braced high, so my legs"** contradicts itself. Bracing high does not open the legs | "braced low" |
| **SW-065** | p93 | **"Attribute = Attribute Points ÷ 3, rounded down, maximum +5)"** has an unmatched closing parenthesis | Delete it |
| **SW-066** | p1650, p1675, p1700, p1725, p1751 | **The five stance talents have no Tier or Requires cells**, unlike every other talent in the book. Their whole entry is crammed into one cell | Normalize the rows |
| **SW-067** | p1416, p1444 | ***Deflecting Palms* and *Second Wind* put the action symbol inside the Effect cell** as "↺ |" and "◆ |", where every other talent puts it in the name | Move to the name |
| **SW-068** | p1298, p1067 | **The Berserker root talent is named "Berserker" and the Human root is named "Human,"** but the Callings table calls the Berserker's special ability "Rage." A talent named the same as its Constellation reads oddly in a sentence like "you gain Human" | Consider *Bloodrage* and *Adaptable* |
| **SW-069** | p87 vs p68 | **The four Attributes are listed alphabetically in Ch. 2 and in Might/Agility/Wits/Presence order elsewhere** | Pick one order and use it everywhere |
| **SW-070** | p298 vs p502 | **Zones are listed as "Torso, Arms, Legs, Head" in one place and "Head, Torso, Arms, Legs" in another** | Pick one, ideally head-down |
| **SW-071** | p562 vs p266 | **"Strike Threshold" and "Attack Threshold" are used for the same number** | Pick one |
| **SW-072** | p425, p601, p1136 | **Three en-dashes in prose.** Your style rule bans em-dashes; en-dashes used as sentence punctuation are the same offence in a different font | Replace with commas, colons, or periods |
| **SW-073** | p483 | **The Key Terms entry for Exposed drops "That Zone's Protection counts as 0,"** which is the clause that gives Exposed its teeth. It also reads "An successful Strike" | Restore the clause and fix the article |
| **SW-074** | p491 | **The Key Terms entry for Load describes the wrong mechanic.** It says Load "may negatively impact certain Checks and Thresholds (e.g., Swimming or Climbing)"; the actual rule is Load Strain against Evade and Might/Agility skill checks. **Load Strain has no Key Terms entry at all** | Rewrite Load, add Load Strain |

---

# Known mid-edit, listed only so nothing gets lost

| Where | What |
|---|---|
| p144, p145 | "Comets are $$$$$" and "Milestone Talent Points are $$$$$" |
| p280 | "Evading requires" ends mid-sentence |
| p309 | Arms / Critical Hit & Exposed is "???" (also SW-046, because it now matters mechanically) |
| p688-698 | Three Backgrounds, and the **Soldier** row still carries the **Artisan's** description about apprenticing at a forge |
| p1620-1636 | The Combat Styles summary table lists four styles; **Great Weapon Fighting is missing** though it has a full constellation |

---

# What I would fix first

If you only have an hour before the playtest, these six are the ones that will actually stop play or
produce a wrong result at the table:

**SW-001** (martial weapons are unusable), **SW-002** (which Protection floor), **SW-003** plus
**SW-010** (who picks the Graze zone, and the three talents that depend on the answer), **SW-007**
(chapter numbers), **SW-008** (Set Your Feet buffs the wrong Defense), and **SW-043** (nobody can
reach Expert in Weapons).

Everything in section E is worth reading before you set the table, because those are the findings
that will make a playtester conclude something is unbalanced when it is actually just unfinished.
