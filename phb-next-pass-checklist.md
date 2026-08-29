# Next PHB pass: standing checklist

Read this before reviewing the next version of the Player's Handbook. Everything here was settled or
flagged in conversation and has not yet landed in the book. Status column is the whole point: do not
re-litigate the **Decided** rows, and do not silently implement the **Awaiting Mike** rows.

---

## Movement, space and the grid (settled, v2.4 to v2.5)

Full text in `phb-movement-and-space.md` and `phb-movement-foundry-grid.md`, the latter superseding
sections 1 and 4 of the former.

| # | Item | Status |
|---|---|---|
| M1 | **STARWROUGHT assumes a VTT.** 1-foot grid, exact diagonals, per-weapon reach in feet. No battlemat fallback, no theatre of the mind. Recorded as a standing rule in `CLAUDE.md`. | Decided |
| M2 | **Adjacent = 0 feet between spaces.** Touching at a corner counts. This is the most load-bearing distance in the game: the shortest weapons need it, Grabbed and squeezing depend on it, and every "adjacent ally" talent points at it. | Decided |
| M3 | **Reach is measured beyond your own space**, edge to edge, and is smaller than the weapon is long because your footprint already contains your arm. Medium: dagger Adjacent, shortsword 2, longsword 3, rapier 4, greatsword 4, spear 6, polearm 7, pike 12. | Decided |
| M4 | **The size multiplier sizes the weapon, it does not scale the wielder: Tiny ⅓, Small ⅔, Medium ×1, Large ×1½, Huge ×2**, multiply then round down, below 1 is Adjacent. | Decided |
| M4a | **One formula: Reach = the weapon's Reach × your size Factor, rounded down, but never less than your size's Minimum Reach.** Factors: Tiny ⅓, Small ⅔, Medium ×1, Large ×1½, Huge ×2. Minimums: Adjacent, Adjacent, Adjacent, 1 ft, 3 ft. Mismatched weapon: use the **weapon's** size for the Factor and **your** size for the Minimum. | Decided |
| M4b | **The Minimum is a floor, not an addition.** This absorbs both existing footnotes: "round down to zero means Adjacent" is just the Minimum for Medium and smaller, and "the next increment up from Adjacent is 1 ft" is the Minimum for Large. Supersedes the earlier additive Natural Reach, and also supersedes the "reach follows the weapon, wielder size is irrelevant" ruling before it, which cancelled arm length against *footprint* half-width and so erased an effect that is real against the body. | Decided |
| M4c | **Mismatched weapons.** Oversized by one size: two hands required, unusable if already two-handed, −2 circumstance to attacks, gains **unwieldy**. Undersized by one size: damage die drops one step, loses **unwieldy**. Two or more sizes off: oversized is unusable, undersized is improvised at 1d4. | Decided |
| M4d | **Sizing a weapon changes Reach only.** Damage die and Price stay put, because Might already scales with the creature and scaling both would double-dip. | Decided |
| M5 | **Chapter 5 prints the Medium reach only; every other size is calculated at build time from M4.** There is no per-size table in the book to drift out of sync. The multi-size table in `phb-movement-foundry-grid.md` is illustrative only and has been regenerated to match the formula. | Decided |
| M6 | **"Must enter the target's space" is retired.** Nothing in the game requires it now. It was a 5-foot-grid artifact. A swarm or ooze cannot be given that property later without a new rule. | Decided |
| M7 | **Two new weapon Traits.** **Close**: usable while Grabbed, squeezing, or against a creature you have Grabbed, no penalty. On Unarmed Strike and Dagger. **Unwieldy**: −2 circumstance against an adjacent target, unusable while Grabbed. On Spear, Polearm, Pike. Traits rather than reach thresholds, so exceptions stay possible. | Decided |
| M8 | **Delete the reach trait.** Every weapon now carries a number, so it has nothing left to say. Also delete the "natural reach by size" row. | Decided |
| M9 | **Long Limbs** is the per-creature dial if a monster should feel reachy: add 2 ft to its unarmed and wielded reach. Use on apes and trolls, not on every giant. | Offered |
| M10 | **Exact diagonals** in the Foundry scene config, not Equidistant or Approximate. The 5e rule is 29% wrong and teaches players to move diagonally because it is underpriced. | Decided |
| M11 | Numbers that changed with the fine grid: **Step 3 ft** (was 5), **Crawl 3 ft**, **hazardous terrain 1 damage per 5 feet** (per-square would be 10 damage for a 10-foot patch). | Decided |
| M12 | **Falling** = feet fallen − 5, max 150, Evade vs 15 halves it, land prone. A 30-foot fall kills a 1st-level character who fails. | Decided |
| M13 | **Forced movement** never provokes, ignores difficult terrain, and stops at obstacles for **2 damage per 5 feet prevented**. It can take you off a ledge. | Decided |
| M14 | **Cover** applies to whichever Defense you roll, not Evade only. Cover, a raised shield and Concealed are all circumstance bonuses, so only the largest applies. v2.4's *Take Cover* gives Evade only, which reads as an oversight. | Awaiting Mike |

## Hit Points, Dying and Wounded (settled, v2.3 era)

All Decided. Full text in `phb-hit-points-and-dying.md`, amended by the rulings below.

| # | Item | Status |
|---|---|---|
| H1 | **Going Down is a roll.** At 0 Hit Points, roll **Endure vs Threshold 15**. Critical success: unconscious but stable, not Dying. Success: Dying 1. Failure: Dying 2. Critical failure: Dying 3. **Add 1** if a Critical Hit dropped you, then **add your Wounded value**. This puts the die in the player's hand at the one dramatic moment where they previously did nothing. | Decided |
| H2 | **Death moves from Dying 4 to Dying 5.** This is the single dial that makes H3 survivable. At death 4, Wounded 3 meant a 90% chance of dying the instant you dropped; at death 5 it is 40%, and a healthy character returns to the 4.6% baseline. | Decided |
| H3 | **An Exposed Critical Hit inflicts Wounded**: 1 for Arms or Legs, 2 for Torso, 3 for Head. It applies whether or not the character has ever been Dying. This is Mike's design and it is the fix for SW-041, because the defender chooses which Zone opens on a Graze and now has a real reason to care which. | Decided |
| H4 | **H3 replaces the four-row Exposed-crit escalation table** (Stunned 1, Slowed 1, drop a held item, knocked prone). An Exposed Critical Hit now deals the ordinary Zone effect **plus** Wounded. Four rules become one. | Decided |
| H5 | **Wounded caps at 4.** Past that it is arithmetic with no meaning. | Decided |
| H6 | **Recovery check** is an Endure check against **10 + your Dying value**, at the start of each of your turns, no action. Critical success ends Dying at 1 HP; success reduces Dying by 1; failure raises it by 1; critical failure by 2. An adjacent ally may spend ◆ for +2 on your next one. | Decided |
| H7 | **Refusing death**: spend **all** your Hero Points, minimum 1, whenever you would die. Not a roll, cannot fail. Dying drops to 0, you are stable at 0 HP, Wounded +1. This backstop is what makes H1's higher lethality affordable. | Decided |
| H8 | **No bracket notation for Dying.** `Exposed [Legs]` needs its bracket because the Zone varies; Dying is always Endure. Revisit only if different killers ever recover on different Defenses. | Decided |
| H9 | Known and accepted: **Dying is a level 1 to 4 mechanic.** The Recovery Threshold tops out while Endure grows with level and rank, so by 5th level with Expert Endure it cannot be failed. Pathfinder has the same property. The lever is the Threshold, not the check. | Won't fix |
| H10 | **Second Wind still reads "once per day"** in the Endure Constellation though SW-048 changed the amount healed. The cadence change never landed. | Bug |

## Sections delivered and awaiting merge

| File | Contents |
|---|---|
| `phb-key-terms.md` | 40 terms, grouped and cross-referenced |
| `phb-example-of-play.md` | One full round, three characters, all math audited |
| `phb-talent-point-types.md` | The two missing bullets, plus Origin/Calling/Defense types the book uses and never defines |
| `phb-damage-modifiers.md` | Protection consolidated, plus Resistance, Weakness, Immunity and one order of operations |
| `phb-hit-points-and-dying.md` | The whole HP section, as amended by H1 through H8 above |
| `phb-v2.1-audit-content.md` | Content for the 15 open audit items |

---

## Postures and reactions

| # | Item | Status |
|---|---|---|
| 1 | **Free postures cost no reaction. Bought postures do.** A posture already has a cost, the Exposed zone. Charging a reaction on top is double-pricing, and double-pricing is what made them dead text (Drop Flat was chosen 0% of the time, Kneel 6.6%). v2.1 currently charges a reaction for all of them, including the free ones. | Decided |
| 2 | **Reactive Shield converts to a posture; delete it as a reaction.** It fires "when attacked," before the roll, and buys a Defense bonus, so it was always a posture in a reaction's clothes. | Decided |
| 3 | It needs a duration or it is Set Your Feet with a prerequisite. Draft: **Raise the Guard** (posture, Shield Fighting). You Raise your Shield without spending an action. Its bonus applies to this blow and lasts until the start of your next turn. Your **Arms** become Exposed, win or lose. Only posture that pays off across multiple blows. Does not step on Shield Wall, which buys the same thing with mobility. | Decided |
| 4 | **Shield Block, Cover the Angle, Opportune Parry, Deflecting Palms, and Steady the Line stay reactions.** The sorting test: fires **before** the Defense roll = gamble = posture; fires **after** = insurance = reaction. Shield Block in particular must stay post-roll, both because pre-declaring it is strictly worse and because **Hardness** (Ch. 4) exists only to support it. | Decided |
| 5 | Set Against the Charge is a Strike, not a defense. Not a posture candidate. | Decided |

## The Graze cost and Exposed

| # | Item | Status |
|---|---|---|
| 6 | **Guard's Graze cost should be the zone your guard method dictates, not a free choice.** Evade keeps the free choice, because you did twist away. Free choice for both is the loophole version: you name the zone you care least about and the Graze costs nothing. Measured 37.0 spread for dictated vs 39.5 for free, and the tell was Recenter collapsing to 0.16 uses per round because nothing worth protecting ever opened. v2.1 currently says free choice for both. | Awaiting Mike |
| 7 | **Set Your Feet should Expose your guard zone**, not "a zone of your choice." As written it is Give Ground renamed. | Awaiting Mike |
| 8 | The **Conditions in Brief** entry for Exposed omits "that zone's Protection counts as 0." That clause is what gives Exposed teeth; dropping it cost 8 points of spread in testing. | Bug |
| 9 | Ch. 7 reads "or you guard no longer covers it." Wants "your guard." | Bug |
| 10 | Untested and worth watching: whether **Recenter** should clear every Exposed zone or only one. Start generous, tighten if turtling never happens. | Open question |
| 11 | Nothing routinely opens the **Head** zone, which makes helmets the weakest purchase in the game. Needs a source. | Open question |

## Terminology, all settled

| # | Item | Status |
|---|---|---|
| 12 | **Heritage is Bloodline.** Done in the design doc, CLAUDE.md, the data, and the tracked PHB. App code is Mike's (`app_template.html` 37, `build_phb.js` 20, `xlsx_to_trees.py` 8, and the regenerated files). Keep `h` as the Root-column marker. **After accepting, refresh the TOC**, two entries are stale field results. | Decided |
| 13 | **Attribute stays.** No synonym collision, so no defect to fix, only a genre mismatch with a one-sentence half-life. Say "emergent" once, as the design doc §3 already does. | Decided |
| 14 | Reconcile **Key Attribute** (PHB, 22 instances) with **Feeds** (every spreadsheet). Same concept, two names. "Feeds" is the more accurate of the two because it names the direction. | Awaiting Mike |
| 15 | **Flare stays.** The participle is load-bearing ("a Constellation that is not Flared"), and a stellar flare is correctly calibrated as frequent, recurrent, and non-destructive. **Save Nova** for a summit event; Legendary rank is the obvious home. | Decided |
| 16 | "Star" appears **zero** times in the PHB despite being half the core metaphor ("milestones forge Flares into stars"). The permanent end of the ladder never made it into the book. | Gap |
| 17 | **Proficiency** stays for the number. **Drop the compound "Proficiency Rank" to just "Rank."** The book already does this 22 times out of 26, nothing else in the game has ranks, and the qualifier was inherited from pf2e where it disambiguates spell ranks. Pairs with Tier: Tier is what a talent demands, Rank is what you have. | Decided |
| 18 | **Trained / Expert / Master / Legendary stays.** Mike's call after reviewing intrinsic ladders (Trained/Proven/Instinctive/Effortless, the forging ladder, the craft ladder). Reason: conversion compatibility for GMs running printed pf2e content, and mechanics are not copyrightable in any case. Do not reopen. | Decided |
| 19 | Calling's parenthetical in the "Characters are built from their" list: **"(what they do about it: e.g., berserker, ambusher, hunter, bravo)"**. Also make the five bullets consistent about whether they use "e.g."; ancestry and bloodline do, culture and background do not. | Decided |
| 20 | **Key Terms section** is drafted in `phb-key-terms.md`: 40 terms, grouped, cross-referenced. Panache, Prey, and Rage deliberately excluded as constellation-local. Includes suggested additions to the Assumptions list. | Delivered |

## Background

| # | Item | Status |
|---|---|---|
| 21 | **No fourth Origin branch.** Every character gets identity roots free, so a background root is baseline inflation, not differentiation, and under the Root Rule it would owe something rolled plus something scaling for every background ever written. It also cuts against the axiom: what happened to you leaves you knowing things; techniques come from what you chose. | Recommended |
| 22 | Instead, change background's 3 points from **2 Skill + 1 Lore** to **1 named signature talent + 1 Skill + 1 Lore**, the talent living in a Skill constellation the background already points at. No new constellation, no new root, no power change, and Acrobat stops being a skill pair with a name on it. Drafts offered: Acrobat (Tumble Through opener), Soldier (adjacent Raise a Shield), Criminal (Strike from Hidden Exposes Torso). | Awaiting Mike |
| 23 | The chargen table says background "adds a branch to your Origin Constellation" and the Origin paragraph says its points can go "inward into the Origin itself." The Backgrounds section delivers neither. Both are stale from v0.13 and were contradicted by v0.29. Either honor them or delete them. | Bug |

## IP and data bugs

| # | Item | Status |
|---|---|---|
| 24 | **`Devil's Advocate` (Chelaxian) is close to Paizo's prose**, not merely its mechanic: it reproduces the phrasing, names "Make an Impression," and carries the 1-minute conversation clause. Expression is the part copyright actually protects. Needs a clean-room replacement. | Bug, offered |
| 25 | **Golarion proper nouns still shipping:** Varisian, Keleshite, Chelaxian, and "the proud Padishah Empire." Trademark and Product Identity territory, and against the standing IP hygiene rule. De-Paizo pass on `cultures.xlsx` is queued. | Bug, offered |
| 26 | `data/backgrounds.xlsx` has only 3 rows (Acolyte, Acrobat, Artisan) and grants Religion, Occultism, and Crafting, none of which exist in the playtest skill list. The PHB has a different set entirely (Acrobat, Soldier, Criminal). Sheet and book have diverged. | Bug |
| 27 | The PHB's **Soldier** row is carrying the **Artisan's** description, the one about apprenticing at a forge. | Bug |
| 28 | **Diplomacy is not a constellation.** Three talents still roll it: Courteous Comeback twice and Bazaar Bargainer. Fixed as tracked edits 10 to 12 in `Starwrought_Players_Handbook_v2.1_tracked.docx`, pending accept. | Fixed, pending |

## Older open items

| # | Item | Status |
|---|---|---|
| 29 | **Guard does two jobs**: a physical zone you guard with, and mental composure against fear, charm, and confusion. Scoping fix proposed so the guard zone and Graze cost apply to physical attacks only, which is also what makes Iron Etiquette coherent. | Awaiting Mike |
| 30 | **Sixth Sense** replaces Call the Opening in Awareness: when a Graze would Expose the zone you guarded with, choose a different zone instead. Once per encounter. | Awaiting Mike |
| 31 | `assets/build_phb.js` hardcodes a stale ancestry list and names retired Paizo talents ("Cooperative Nature," "Natural Ambition") in Mira's sample build. Out of scope to fix; supply replacement copy. Mira's build also needs rebuilding against the new combat rules. | Mike's |
| 32 | Halfling luck converts a critical failure into a failure, removing the crit that would have Flared the Origin. Undecided whether a Flare triggers on the die or on the final result. | Open question |
