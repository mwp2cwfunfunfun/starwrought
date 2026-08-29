# STARWROUGHT; Core Design v0.23

*Formerly SPARKS. Crits make talent constellations Flare; milestones forge Flares into stars. Classless d20 TTRPG, pf2e-inspired, built data-first for Foundry VTT.*

*v0.2: rank bonuses rescaled so pf2e monsters/DCs run as printed; 4-milestone level cadence; retraining locked in; magic deferred — physical characters first.*
*v0.3: armor becomes four talent constellations (Unarmored/Light/Medium/Heavy) using the same trained-rank / untrained-attribute duality as checks; Dex caps, strength requirements, and armor quality steps all removed.*
*v0.4: Awareness becomes a full skill constellation (pf2e Perception reborn: Seek, sense motive, initiative, hazard-spotting) — without it, printed hazard DCs outrun the party at mid-levels. Initiative-by-exploration-activity is now a core rule, not a talent.*
*v0.5 (from Mike's playtest edits): Combat Styles are how you wield, not weapon lists; all talent costs are 1 (capstones gated by prerequisites, never price); HP drops to 6+Might/level; flat MAP −5/−10; backgrounds grant 1 package point + a free trade Lore; cultures must include a skill constellation; Shield & Blade renamed Shield Fighting; Athletics capstone de-magicked.*
*v0.6: attribute thresholds replaced by a formula — attribute bonus = points ÷ divisor (round down), minimum +1 once you've invested anything, maximum +5. "Score" → "bonus"; "tag points" retired — every constellation feeds one attribute, and points spent there are that attribute's points. Same-type bonuses don't stack (pf2e rule, now explicit).*
*v0.7: divisor tuned ÷4 → ÷5 after lever analysis (breakpoints on clean 5s; focused cap ~L9; secondary attributes properly lag — +4 at L16 vs L12 under ÷4). Cost accepted: +2 attributes at creation now require total all-in.*
*v0.8: every constellation opens with a root node — "X Training" for skills, styles, and armor (buying it IS becoming Trained); the spine feature for Callings (Rage, Sneak Attack — already true); ancestry roots come free with your blood. No talent may be bought before its constellation's root.*

## 1. Design Pillars

1. **You are what you do.** No classes. Talent constellations define characters; attributes emerge from where you invest; usage (Flares) drives where you grow.
2. **One currency.** Talent points are the only build resource. No separate stat boosts, skill increases, or feat slots.
3. **pf2e bones.** Three-action economy, four degrees of success, level added to rolls and DCs. Familiar to your table, and pf2e content converts on rails.
4. **Data-first.** Every rule expressed as structured data from day one so constellations import into Foundry as compendia.

## 2. Core Resolution

**Check = d20 + level + attribute + proficiency (if any) + other bonuses or penalties (status, item, circumstance) vs DC.**

- **Attribute:** whatever the constellation feeds; everyone adds it, always. Raw talent never turns off: the hulking farmhand kicks down doors without an Athletics constellation, adding Might and +0 proficiency.
- **Proficiency:** your rank bonus in the constellation. Untrained simply means +0 proficiency; one formula, no branch. Same-type bonuses never stack (pf2e rule): two +2 circumstance bonuses are just +2.
- **Hero Points:** start each session with 1 (max 3; GM awards more for heroism and beautiful failure). Spend 1 to **reroll a check you're Trained or better in**; Hero Points never rescue an Untrained roll; raw talent gets you a die, training gets you fate. Spending all your Hero Points to avoid death isn't a roll and is always allowed. This is the deliberate wedge between Untrained and Trained beyond the +4.
- **Attacks:** a Combat Style is *how you wield*, not a weapon list; a dagger and shield is Shield Fighting; that same dagger alone is Dueling; one in each hand is Two-Weapon Fighting; hurled, it's Thrown. Attack rolls add the style's attribute plus your Weapons constellation proficiency; the style itself is a school of exploits whose talents roll with the style's own proficiency. MAP is flat −5/−10 (no agile discount; agile/finesse are retired; weapon identity lives in dice and rules-bearing traits). Starter styles: Archery (Agi), Brawling (Might), Dueling (Agi), Great Weapons (Might), Shield Fighting (Might), Thrown (Agi), Two-Weapon Fighting (Agi).
- Degrees of success as pf2e: beat DC by 10 = crit success, miss by 10 = crit failure, nat 20/1 steps the result.

**Rank tiers** (per constellation, based on total points *spent in that constellation*). Proficiency uses **baked bonus progression**: each rank bakes in pf2e's proficiency-above-level + expected item bonus at the level that tier typically arrives; the attribute is now explicit and additive (v0.21). A focused character (attribute ≈ +1/+2/+3/+4 as T/E/M/L arrive) lands on the same totals as the old fused ladder; pf2e monsters, DCs, and hazards still run as printed (§11), with no magic-item math on our side.

| Rank | Proficiency | Points in constellation to unlock | Minimum level to unlock |
|---|---|---|---|
| Untrained | +0 (attribute still applies) | 0 | — |
| Trained | +4 | 1 | L1 |
| Expert | +7 | 4 | L5 |
| Master | +10 | 9 | L13 |
| Legendary | +13 | 16 | L19 |

One gate schedule for every constellation (Mike's ruling, v0.23): pf2e's martial pacing, with skill content designed to fit it rather than getting its own earlier track. Buying nodes *is* advancement: invest deep and rank rises as a side effect; no separate skill increases. Nodes are tier-gated (Expert nodes need Expert rank). **Every constellation's first point buys its root:** *Training* for skill, style, and armor constellations (that purchase is what makes you Trained), and the spine feature for Callings. **Identity constellations (Ancestry, Culture, Bloodline, Background) get their root free from the chargen choice itself**; being Varisian *is* the Varisian root; it arrives pre-spent (counts as a point in the constellation, typically granting a language or birthright). Nothing else in a constellation can be bought before its root.

**Become Trained in X** (keyword): gain a talent point that must be spent in constellation X. If X isn't open, it buys X's root; that purchase *is* becoming Trained. If X is already open, the point buys any talent there you qualify for: training always stacks into growth, never wasted. *(Deliberately different from pf2e's duplicate-training rules.)*

**DCs.** Use pf2e's tables **as printed**: Level-Based DCs (L1 = 15 … L20 = 40) and Simple DCs (Untrained 10 / Trained 15 / Expert 20 / Master 30 / Legendary 40). Your ability DC (a talent that forces a save) = **10 + level + attribute + proficiency**; your check with a 10 in place of the die *(provisional; physical characters rarely need it, since maneuvers are checks against the target's defense DCs).*

## 3. Emergent Attributes

Four attributes: **Might, Agility, Wits, Presence.** Never bought, never rolled at chargen. Every constellation has a **default feed** (Athletics→Might, Stealth→Agility, Two-Weapon Fighting→Agility, etc.); but **individual talents may override it**: Fearsome grows on the Orcblood constellation yet feeds Presence; a heavy warbow talent in Archery can feed Might. Attribute points are counted **per talent bought** (each point flows to its talent's feed, defaulting to the constellation's). The constellation's default feed still governs which attribute its checks add, armor's capped AC attribute, and ability DCs; that's the constellation's identity; the talents are your deeds.

**Attribute bonus = attribute points ÷ 5, rounded down. Minimum +1 once you've invested any point there; maximum +5.**

(So: 1–9 points → +1, 10 → +2, 15 → +3, 20 → +4, 25+ → +5. No table to memorize; divide by five.)

Attributes are used for:

- Every check, trained or not (§2)
- Derived stats: HP, AC, defenses, initiative (§4)
- Node prerequisites ("requires Might 2")

Attributes add to **every** check, trained or not (v0.21); proficiency was re-baked downward to make room, so the same points still raise rank and attribute together without inflating totals.

*Chargen note:* your Ancestry/Bloodline/Culture/Background point packages seed your starting attributes, so a soldier background genuinely makes you Mightier. Recompute attributes whenever points are spent.

## 4. Derived Stats

- **HP** = ancestry base (6/8/10) + per level: **8 + Might** (v0.34). Might 1–5 spans 9–13/level: Might 1 is pf2e wizard-with-Con, Might 5 is pf2e fighter exactly (L20: 268), the barbarian alone sits above the band. Recompute retroactively when Might changes.
- **AC** = **10 + level + attribute (up to the armor's cap) + proficiency (if any) + armor bonus**; the SAME proficiency ladder as every other roll (v0.22). Each armor carries a two-number stat block whose parts always sum to **the +3 budget**: lighter armor draws it from you, heavier from the steel. Once your attribute fills the cap, all four armors give identical AC; the choice is speed, story, and talents. The cap touches only AC; your full attribute still applies to checks and saves. Heavy needs no attribute at all (the farmhand in plate has great AC on day one). Shields stack a circumstance bonus on top (Shield constellation), as pf2e. *(This reintroduces a Dex-cap-shaped rule removed in v0.3; as armor stats, not character limits; future armor qualities modify quality-based ITEM bonuses, a separate thing from the built-in armor bonus.)*

| Armor | Attribute (cap) | Armor bonus | Speed |
|---|---|---|---|
| Unarmored | Agility, max +3 | +0 | — |
| Light | Agility, max +2 | +1 | — |
| Medium | Might, max +1 | +2 | −5 ft |
| Heavy | Might, max +0 — none needed | +3 | −10 ft |
- **Saves are checks (v0.23)**: Fortitude, Reflex, and Will are talent constellations of their own (feeds: Might, Agility, Presence). A save is the Checks formula rolled with that constellation: level + attribute + proficiency, if any. The old +4 pad is gone, and in its place every character receives all three save Trainings free at creation; deeper save talents are bought like any others. Static defense DC = 10 + level + attribute + proficiency.
- **Weapon damage** = weapon dice + Might + rank specialization (E +2 / M +3 / L +4). Baked striking: 2 dice at L4, 3 at L12, 4 at L19.
- **Initiative** = level + **Wits + Awareness proficiency (if any)**. Your exploration activity swaps the roll; Avoiding Notice rolls Stealth, and so on (pf2e's rule, promoted to core). Seek and Sense Motive are Awareness checks; printed hazard/ambush Stealth DCs assume scaling perception, which Awareness now provides.
- **Speed, senses** from Ancestry.

## 5. Action Economy

Unchanged from pf2e: 3 actions + 1 reaction, MAP on repeated attacks, activities cost 1–3 actions. Talent design space: nodes that reduce action costs, grant new reactions, or bundle activities (the Double Slice pattern).

## 6. Character Creation

**Ancestry → Bloodline → Culture → Background → Defenses → Calling → Comets.** Each step grants access to constellations and pre-spent points in them; chargen *is* your first constellation investment, which is what seeds your attributes.

| Step | Grants | Points |
|---|---|---|
| **Ancestry** | Body: base HP, size, speed, senses; root founds your Origin, free | 1, anywhere in your Origin |
| **Bloodline** | Sub-lineage: the Origin's left branch; root granted free | 1, anywhere in your Origin |
| **Culture** | Upbringing (decoupled from ancestry); root granted free | 2: its two Skills or your Origin, each point broad or deep |
| **Background** | Occupation; your trade's Lore root free | 2: its two Skills or your Origin, each broad or deep |
| **Defenses** | Armor and saves | 2: at least 1 buys an Armor constellation (Unarmored included); the other may deepen Fortitude/Reflex/Will |
| **Calling** | Your path's spine | 1: open any Calling or deepen one a grant opened |
| **Comets** | Anywhere (no Flare needed) | 3 |

**Total: 12 points.** Max 3 points per constellation at creation (Trained cap until level 5 anyway). A typical starting character: Trained in 7–9 constellations, one or two attributes at +1 (+2 only with heavy single-attribute focus). Armor is no longer optional-by-default: the Defenses step guarantees every character an Armor Training (Unarmored counts), and every character opens or deepens a Calling before Comets.

Culture being separate from Ancestry does real mechanical work here: an orc raised in a dwarven hold takes Orc ancestry points and Dwarven-hold culture points. No "ancestry = culture" conflation.

## 7. Progression: Three Tracks

**Milestones** (GM-awarded story beats, ~1 per session): every level is 4 milestones long. Milestones 1–3 each grant **1 talent point**, spent **immediately** in a **Flared** constellation (consuming the Flare); if nothing is Flared, no milestone point can be received; **opened or not**: the first point in a new constellation buys its root, so a Flare is how deeds open ground you never planned to walk. The **4th milestone is the level-up**, which also grants a **Comet**: a talent point that answers to no constellation, spendable anywhere, Flared or not, opened or not. (The 3 free points at creation are Comets too.)

**Level-up** (1–20): +1 to all level-based math, +HP, tier gates unlock (§2), and **1 Free talent point** (spend anywhere; the wildcard). Net income: 4 points per level, ~86 over a 1–20 campaign, a level roughly every 4 sessions.

**Retraining:** a week of downtime moves 1 spent point (respecting prereqs and tier gates).

**Flares** (usage); one universal trigger: **a constellation Flares on a Critical Success or Critical Failure on a roll with consequences, directly related to a talent in that constellation.** Unpacking the wording, which does real work:

- *"A roll"*; anyone's. An enemy critically missing against your plate is a roll directly related to Heavy Armor's talents; defensive constellations Flare off your foes' dice.
- *"A talent in a constellation"*; the constellation's contents define its territory, owned or not. A crit on an untrained unarmed swing still Flares Brawling; milestone points can always open new ground.
- Crit failures count equally; you learn from disasters, and luck never locks your growth.
- *"With consequences"*; the anti-farming clause. If nothing rides on the roll, it can't Flare (and per good GM practice, shouldn't be rolled at all). Picking your own lock in camp until a 20 comes up is practice, not peril; that's what downtime training is for.

Two other paths remain: a **GM Flare award** for a story feat no die captured, and **downtime training** (a week with a teacher, rival, or manual).

A constellation is either Flared or not (a flag, not a counter; trivial bookkeeping, natural anti-hoarding). Flares persist until consumed. Max 1 Flare gained per constellation per session. Talent points are NEVER banked: every point, at creation and in play, is spent the moment it is received (Mike's ruling, v0.30; kills deep-hoarding, forces breadth-in-the-moment).

Constellations may list **example flares** as flavor, but they're illustrations now, not rules; the universal trigger covers everything.

*Why this shape:* usage steers growth without hard-locking it (Free points every level), luck is smoothed (crit failures count, GM awards exist), and "grind stealth checks off-screen" doesn't work (Flares come from play, capped per session, and points still come only from milestones).

## 8. Talent Constellation Framework

**Anatomy of a tree:** name, attribute it feeds, category, Flare triggers, associated checks/actions, and a DAG of nodes.

**Node fields:** id, tier (Trained/Expert/Master/Legendary), cost (**always 1**; limits are expressed as prerequisites, never price; capstones require a Master talent from their constellation), root flag (the mandatory first purchase), prereq nodes, type (passive / action / reaction / free action / upgrade), action cost + traits (pf2e-style), effect text, automation hints.

**THE ROOT RULE (Mike's ruling, v0.38; applies to every constellation root and every bloodline root).** A root must always carry two things:

1. **Something that gets rolled**, so the constellation can Flare off the one talent every member of it owns. A root made only of passives (a language, a sense, a flat speed bump) leaves its constellation unable to ignite from the ground it stands on, which matters most for the Origin, where ancestry, bloodline, and culture points all land.
2. **Something that improves at Expert/Master/Legendary**, so the root keeps paying as the constellation deepens instead of becoming a receipt for a decision made at level 1.

The `X Training` roots satisfy both in a single clause, and are the model: *add the constellation's proficiency to its checks* is a roll and a rank-scaler at once. Naming the ranks explicitly ("+3 at Expert rank") is the other way to satisfy part 2. `xlsx_to_trees.py` warns on any root that fails either half, so the rule is enforced by the pipeline rather than remembered.

*Shape of the scaling is chosen for flavor, not uniformity:* Rage graduates its damage (+2/+3/+4/+6), Sneak Attack its dice, halfling luck its uses per session, Stonewise its reach in feet, and most circumstance bonuses walk +1/+2/+3/+4. Keep ancestry and bloodline bonuses **narrow and circumstantial**, since every character gets both roots free and a broad bonus there is a flat buff to the whole game.

**Categories & pf2e conversion map:**

| Constellation category | Converts from pf2e | Examples |
|---|---|---|
| **Ancestry** | Ancestry + bloodline feats | Dwarf, Orc, Elf |
| **Skill** | Skills + skill feats (feats become nodes; rank replaces increases) | Stealth, Athletics, Medicine |
| **Combat Style** | Fighter/martial class feats by theme — a style is how you wield, not a weapon list | Two-Weapon Fighting, Archery, Shield Fighting, Brawling |
| **Armor** | Armor proficiency + defensive features (Bulwark, Armor Specialization, monk stances) as AC-carrying constellations (§4) | Unarmored, Light, Medium, Heavy |
| **Calling** | Class *features* as the spine + class feats as branches | Rage, Ambusher (sneak attack), Oath (champion), Ki |
| **Magic** *(deferred)* | Spellcasting: one Casting constellation per tradition + theme constellations for repertoire — parked until the physical game is proven | Arcane Casting; Pyromancy |
| **General** | General feats | Toughness→Vigor constellation, Fleet→Mobility constellation |

Class identity survives as *constellations*: "Barbarian" ≈ Rage + Athletics + a weapon style. The Calling spine node (e.g., Rage as an action) sits at the constellation root so the signature feature arrives with the first point.

**Ancestry shape, and why the counts are what they are.** Legendary rank needs 16 points in the Origin. The ancestry root and the bloodline root both arrive free and pre-spent, so every character starts the climb 2 points in. Each authored ancestry therefore carries 14 core talents of tier Trained/Expert/Master, which is exactly enough to reach 16 without buying a single bloodline talent past the root: 5 Trained (the rank gate needs 2), then 4 Expert, then 5 Master land on 16, with the capstone (★, tier Legendary) waiting there. That is the guarantee worth protecting; a player who ignores their lineage entirely can still cap their ancestry. Each bloodline then carries one talent per tier chained off its bloodline root, so the lineage-focused character also has something of their blood to buy at every rank. `build_ancestries.py` asserts all of this, including a simulated climb against the gate rules, and refuses to write the workbook if an ancestry drifts.

**Where ancestry chassis lives.** `data/ancestries.xlsx` `_Tree Index` is the source of truth: alongside the usual Tree/Category/Feeds/Flare/Meta columns, ancestry rows carry **HP, Size, Speed, Senses, Summary**. `xlsx_to_trees.py` reads them, derives each bloodline from the `h`-marked rows of the tree sheet, and generates the `ancestries` block of `assets/roster.json` (patching that key only; cultures, weapons, conditions and the rest stay hand-kept). Nothing about a body is typed twice. The per-ancestry `* Lore` sheets remain authoring notes and the converter ignores them by design.

## 9. Sample Constellations

### Stealth (Skill; Agility)
*Flare triggers: crit succeed on a Stealth check; escape combat unseen; crit fail a Stealth check with consequences.*

| Tier | Node | Cost | Effect |
|---|---|---|---|
| T | Quiet Step | 1 | No check penalty for moving at full Speed while Avoiding Notice out of combat |
| T | Blend In | 1 | Use Stealth in crowds without cover; crowds count as concealment |
| T | Trackless | 1 | +2 circ. to cover tracks; do so at full travel speed |
| E | Swift Sneak | 1 | Sneak at full Speed in combat |
| E | Vanish ◆ | 1 | Hide even without cover if any observer is distracted (GM call); requires Blend In |
| E | Distracting Shadows | 1 | Use creatures one size larger as cover for Hide/Sneak |
| M | Foil Senses | 1 | Always treated as taking precautions vs. special senses |
| M | Shadow Strike | 1 | Being *observed* doesn't break Sneak until you act; requires Vanish |
| L | Legendary Sneak (capstone) | 2 | Hide/Sneak with no cover or concealment at all; always Avoiding Notice |

### Two-Weapon Fighting (Combat Style; Agility)
*Flare triggers: crit hit while wielding two weapons; drop a foe with your off-hand; crit fail and hit yourself/ally (dramatic).* 

| Tier | Node | Cost | Effect |
|---|---|---|---|
| T | Double Slice ◆◆ | 1 | Strike with each weapon at same MAP; combine damage vs. resistance |
| T | Off-Hand Guard | 1 | +1 circ. AC while wielding two weapons and not raising a shield |
| E | Twin Parry ◆ | 1 | Weapons defend: +1 AC (+2 w/ parry trait) until next turn; requires Off-Hand Guard |
| E | Dual Thrower | 1 | Draw as part of thrown Strikes; Double Slice works with thrown weapons |
| E | Flensing Cut | 1 | Double Slice that deals both weapons' crit specialization on a crit |
| M | Twin Riposte ↺ | 1 | Foe crit fails a Strike vs. you → Strike or Disarm it; requires Twin Parry |
| M | Two-Weapon Flurry ◆ | 1 | Strike with both weapons at MAP −8 as one action |
| L | Perfect Pair (capstone) | 2 | Once/round, when you crit with one weapon, the other Strike this turn auto-upgrades one degree |

### Ambusher (Calling; Agility); sketch
The rogue's chassis as a constellation. Root (spine): *Sneak Attack*; +1d6 precision vs. off-guard foes, +1d6 more at Expert/Master/Legendary rank. Branches: T *Surprise Attack* (foes that haven't acted are off-guard to you); E *Dread Striker* (frightened = off-guard), E *Poison Weapon* ◆; M *Opportune Backstab* ↺ (ally hits adjacent foe → you Strike it), M *Gang Up*; L capstone *Assassinate*. *Flare triggers: crit an off-guard foe; drop a foe who never saw you; crit fail and reveal your position (dramatic).*

### Heavy Armor (Armor; Might); sketch
Entry node requires Might 1. T *Armored Stride* (ignore armor speed penalty); E *Bulwark* (Reflex saves use Might), E *Armor Specialist* (resistance to physical damage 2/3/4, scaling with rank); M *Juggernaut* (successes on Fortitude saves become crit successes); L capstone *Unstoppable* (once per day, a critical hit against you becomes a normal hit). *Flare triggers: an enemy critically misses you in heavy armor; you survive a critical hit; you crit fail a Reflex save (dramatic).*

## 10. Foundry VTT Notes

- Build as a **custom system** (not a module on pf2e); the data model diverges too much. Prototype rules on paper first; system dev starts once v0.x stabilizes.
- **Author constellations as YAML/JSON now**, matching the node schema in §8. Design docs generate from data, not vice versa. Constellations → compendium packs; nodes → items; rank/attributes → derived data on the actor (`prepareDerivedData` recomputes attributes from spent points automatically; emergent attributes are nearly free in Foundry).
- Flares: boolean flags per constellation on the actor; a chat-card hook can auto-offer a Flare on any crit whose roll carries the constellation's tag. Usage-based progression is the most automatable part of this design.
- Keep node ids stable from day one; they become UUIDs/slugs in compendia.

## 11. pf2e Parity; Run Monsters As Printed

Additive attribute + re-baked proficiency (§2), the +4 save pad and the armor +3 budget (§4), baked striking dice, and pf2e's own tier-unlock levels are tuned so a STARWROUGHT specialist tracks a pf2e martial within ~±2 at every level (v0.21 totals match the old fused ladder for focused characters; at L20 a Legendary specialist now hits +38; one closer to pf2e's +38 than before). Use pf2e monsters, hazards, DC tables, and adventure stat blocks **unmodified**.

Verified benchmarks (STARWROUGHT specialist vs. typical pf2e martial):

| Level | Attack | pf2e | Best skill | pf2e | AC | pf2e | HP | pf2e band |
|---|---|---|---|---|---|---|---|---|
| 1 | +6 | +7 | +6 | +7 | 18 | 18 | 15 | 17–20 |
| 5 | +14 | +14 | +14 | +13 | 24 | 22 | 53 | 58–73 |
| 10 | +19 | +21 | +23 | +21 | 29 | 29 | 108 | 98–138 |
| 13 | +26 | +26 | +26 | +25 | 34 | 32 | 138 | 122–177 |
| 20 | +37 | +37 | +37 | +37 | 43 | 42 | 228 | 178–328 |

Known deltas (rechecked under ÷3, v0.34): L1 attacks +1 hot (1 + T4 + attr 3 = +8 vs pf2e +7; first fights skew slightly friendly now, the old '1 low' is gone); L3–13 runs ~+1–2 hot as the cap arrives early (one crit band vs printed DCs, accepted); L20 exact (+38). HP now tracks pf2e's class band (Might 1 = wizard, Might 5 = fighter; only the barbarian out-tanks us). Feat and ability *effects* convert verbatim; only node packaging changes.

## 12. Open Questions & Tuning Levers

- **Tier jumps are chunky** (+3/+4 per rank vs. pf2e's gradual attr/item drip). Tier-ups feel great, but characters sit ~1–2 behind curve just before a gate opens. Watch L4 and L11–12 at the table.
- **Rank thresholds** (1/4/9/16) at 4 points/level: skill gates cost 22–26% of the pool at unlock; combat gates are level-limited (points ready early; same feel as pf2e martial proficiency waits). Tighten to 1/5/10/18 if everyone hits Legendary too easily.
- **Snowball guard:** crit-driven Flares favor high-rank constellations. Counterweights in place: crit-fail Flares, 1/constellation/session cap, Free point per level, GM awards. If off-spec constellations still starve, add "first check in a new constellation each arc auto-Flares it."
- **Items carry no math; RESOLVED (Mike, v0.34): equipment quality NEVER grants item bonuses.** Options (a)/(b)/(c) from v0.21 are retired unchosen. The proficiency ladder (T+4/E+7/M+10/L+13) permanently owns pf2e's expected potency curve; nothing in the game stacks an item bonus on top, so high-level totals cannot drift. Armor's built-in +0–3 is an ARMOR bonus (category budget, load-bearing for AC parity), not equipment quality, and stays. Future weapon/armor/shield qualities are flavor with teeth: traits, properties, and activations, never plusses. Striking remains baked dice (2@L4/3@L12/4@L19).
- **AC is opt-in** (pf2e gives armor proficiency free; we charge points). Still deliberately strong per point; Trained +4 proficiency for 1 point, on top of the armor's +3 budget, is the best buy in the game. Watch whether deep armor investment (9–16 points for M/L) competes fairly with offense constellations, and whether any player skips armor entirely and suffers for it.
- **Ability DC** (14 + level + attribute) is provisional and nearly unused by physical characters; revisit when magic gets its pass.
- **Attribute pacing** (÷3, min 1, cap 5; v0.34, was ÷5): front-loaded on purpose. A focused creation build (9–12 of 12 points behind one feed) starts at +3 or +4, matching pf2e's +4 opening; the cap arrives by ~L3–5 for mono-feeders, so mid-levels run ~+1–2 hot against printed DCs (one crit band, accepted) and the curve flattens early into rank-ups doing the climbing. Secondary attributes now reach +2 by mid-game instead of never. **The +5 cap is load-bearing** (revisited again, kept): 20 + Legendary 13 + cap 5 = +38, pf2e's exact L20 martial ceiling; the divisor only changes arrival speed, never the ceiling. Cooling lever if playtests run hot: cap by level band (e.g. +3 until L5, +4 until L10, +5 after), not the divisor.
- **Might-god check (v0.34, Mike's question)**: Might is pf2e Str+Con fused (HP, Fort, Might-style attack/damage), but it is not a god stat: Agility styles key attack AND damage off Agility (no finesse tax), Agility owns light/unarmored AC and Reflex, heavy armor's cap 0 and medium's cap 1 mean the tank gets almost nothing from Might to AC, attributes are only reachable by spending talents in feeding constellations (real opportunity cost), min-1 gives everyone a 9 HP/level floor so Might-focus buys up from healthy rather than escaping a tax, and the cap pins the ceiling. Watch in play: Might-5 melee is durable twice over (HP + Fort) where pf2e charged two stats; if hot, tune the style/feed map, not the formula.

*v0.9: the game is STARWROUGHT (Spark/Nova taken as titles); the ignition mechanic is now the Flare (a constellation Flares on a dramatic crit). Rules unchanged — pure terminology.*
*v0.11: Flare triggers generalized to one universal rule — crit success or crit failure on any roll directly related to a talent in the constellation (enemy rolls against you included; untrained rolls included). Per-tree trigger lists demoted to optional flavor.*
*v0.39 (Mike): TERMINOLOGY. **Heritage is renamed BLOODLINE.** The old pair was two synonyms (your ancestry is your heritage), so nothing in either word told a reader which contained the other; "my ancestry is dwarven, my bloodline is Stonewise" parses on first read. The five identity layers are now **Ancestry, Bloodline, Culture, Background, Calling**: two about birth, two about life, and one teaching line that carries the first axiom, "your Background is what happened to you, your Calling is what you do about it." Species, Kind, Blood, Line, Trade and Past were all considered and set aside; Ancestry keeps its friction-free clarity for playtesters arriving from other d20 games, and Bloodline supplies the poetry. Data cost is one word: the `h` marker in the ancestries Root column, the Heritage entries in the converter's CATEGORIES and IDENTITY lists, and the `heritages` key the pipeline writes into roster.json.*
*v0.40 (Mike's ruling): VTT ASSUMED. STARWROUGHT no longer supports a physical tabletop; it assumes a virtual one. The grid is 1 foot, diagonals are measured exactly, and every weapon carries a reach in feet rather than a reach trait. The design consequence is a budget shift, and it is the important half: arithmetic and tracked state are now free (per-zone Protection, the material step, the damage order of operations, Exposed, Wounded, Dying, Persistent Damage, MAP, Load Strain, attribute derivation, rank thresholds), so complexity should be spent on decisions instead. Never simplify a rule to spare a player arithmetic; do simplify one that asks them to hold two decisions at once. Standing risk: a rule needing GM judgement inside a formula cannot be automated, so keep the judgement at the edges. Cost accepted knowingly: no battlemat play, no theatre of the mind, and no print market.*
*STYLE RULE (Mike, standing): avoid em-dashes in all game prose, everywhere, forever. Use periods, semicolons, colons, commas, or parentheses. Table null-markers and minus signs are fine.*
*v0.38 (Mike's ruling): THE ROOT RULE, see §8. Every root must hang on something rolled (so its constellation can Flare from the talent every member owns) and must improve at Expert/Master/Legendary. Audit found the identity constellations were the offenders, all written on the pf2e habit of "a language and a passive sense, feats do the work": 19 roots rewritten. Ancestries gained narrow scaling clauses picked for flavor (Human Aid, dwarven immovability, elven eye, gnomish first-encounter curiosity, halfling luck by uses per session); all 10 heritage roots gained a scaling clause; Rage graduates its melee damage +2/+3/+4/+6; the three culture roots gained a rank-scaling bonus on their two named Skills. The audit also caught Lore's root missing the "add the constellation's rank to its checks" clause its sibling skill roots all had. `xlsx_to_trees.py` now warns on any root failing either half, so this cannot silently regress. STILL PENDING: the culture names are Golarion (Varisian, Keleshite, Chelaxian) and need their own de-Paizo pass, as does Mira's backstory; `build_phb.js` still hardcodes a stale ancestry list.*
*v0.37 (Mike): FIVE ANCESTRIES AUTHORED, IP-free (Human, Dwarf, Elf, Gnome, Halfling; 130 talents, 26 each: root, 14 core T/E/M, a capstone, and two five-node heritage chains). Per-ancestry Flare trigger lists collapsed to the universal v0.11 wording, since bespoke lists were pretending to be rules. ONE INDEX SHEET PER WORKBOOK: the ancestries `_Guide` tab is retired and its data folded into `_Tree Index`, which now carries HP/Size/Speed/Senses/Summary on ancestry rows; `xlsx_to_trees.py` reads them, derives heritages from the `h` rows, and generates the `ancestries` block of `roster.json`, so chassis is authored once (guarded: an empty parse leaves roster.json alone rather than blanking chargen). The `_Guide` design note moved into §8 above. Also: Gnomish and Halfling added to languages.xlsx; a `size` field surfaced on ancestry cards and in the wiki; the wiki's stale ÷5 attribute divisor corrected to ÷3.*
*v0.36 (Mike's design: roots at the center, ranks as rings): RADIAL SKIES. Every constellation is now a true star map: the root at the heart, the four ranks as concentric elliptical orbits (Trained innermost, Legendary at the rim), and every line straight, as real constellation drawings are. Crossings die by construction: spokes from the root radiate; children inherit their parent's bearing (circular-mean, symmetric sibling fans); the wheel is PARTITIONED so each pinned heritage family owns a wedge on every orbit while strangers are swept apart in the free arcs between (seam-safe unwrapped sorting, pin-cluster eviction, drift-capped orbit-slide clearance); same-rank descendants step out to a sub-orbit midway to the next ring so their chains read radially. Root->deeper requires stay undrawn (root-first is the law; no line in = needs only the root). Rank gates render as dashed orbit rings with labels up-left plus verdict chips top-right; the Origin is two radial skies joined by the golden thread with the heritage wedge facing west. Same engine in all three renderers (app, viewer, plates); the greedy label solver gained radial-outward preference (pinned roots label inward). Harness verdict across 100 renders including the every-heritage worst case: 0 crossings, 0 edges through stars, 0 label collisions, 0 out-of-canvas, 0 nondeterminism. The v0.35 band layout and its floor-hugging curves are retired.*
*v0.35 (Mike: "hunt down and slay FOREVER: messy Constellations"): SKY LEGIBILITY ENGINE, in all three renderers (app, standalone viewer, PHB plates). Deterministic post-layout passes: per-tier minimum star gaps (105px target, pinned heritage roots respected), alternating label stagger for crowded rows, node-vs-edge clearance with a re-settle sweep. Labels are placed by a greedy deterministic solver (below, above, right, left) that treats every star disc and every already-placed label as an obstacle; root labels move BELOW the root, and the root's column is reserved (no star may park above its head). Edges leaving the root toward Trained stars render as floor-hugging curves that climb vertically into their target; root->deeper "requires" lines are no longer drawn at all, since root-first is the law even unwritten (legend: "no line in = needs only the root"). Verified by harness across 100 sky renders (every constellation, two widths, one-heritage and all-heritage scenarios), using the app's own placement code: zero label overlaps, zero label-over-star, zero edge-through-star (straight AND sampled curves), zero nondeterminism.*
*v0.34 (Mike, after a barbarian-vs-barbarian pf2e comparison): THE L1 FEEL FIX. Attribute divisor ÷5 → ÷3 (min 1, cap 5 unchanged): a focused starting character now opens at +3/+4 like a pf2e PC, and the +5 cap still anchors L20 parity exactly. HP chassis 6+Might → 8+Might per level: Might 1 = pf2e wizard+Con (188 @ L20), Might 5 = pf2e fighter exactly (268 @ L20); L1 barbarian-type 19–20 vs pf2e 22. ITEM BONUSES REMOVED FROM THE GAME: quality gear will never add numeric bonuses (§12 resolved); the ladder already bakes pf2e's item curve, which is why Trained is +4. Armor's +0–3 armor bonus stays (category budget, not quality). Mira 4.1: HP 17, AC 18, Ref +8, Agility +3, Wits +2, rapier +8 1d6+3. Also fixed: character sheet spec wrongly said Will = level + Wits (it is Presence, per v0.24).*
*v0.33 (Mike): DEFENSES + CALLING STEPS: Step 5 is now Defenses with 2 points (1 must buy an Armor constellation, Unarmored included; the other may go to Armor or into Fortitude/Reflex/Will), and a new Step 6 Calling grants 1 point for any Calling; Comets moves to Step 7, Review to 8. Creation budget: 12 spent points. Every character now starts with armor answered and a Calling underway.*
*v0.32: COMET RESTRICTION (Mike): identity is never bought; Comets (and all points) cannot purchase Ancestry or Culture roots, which come only from chargen choices. The engine blocks it and the Comets picker offers your Origin instead of foreign identity constellations. Attribute glyphs now accompany constellation names throughout the app (chips, rails, sheets, breadcrumbs, cards).*
*v0.31 (Mike): VERSATILE HUMAN redefined ('any already-opened' collapsed to nothing under spend-on-receipt): now grants 1 Talent Point to OPEN any non-Skill constellation (buys its root; a new discipline, not a deeper rut). Grants DSL gains an 'open' mode ('1 open non-Skill'). Mira's Versatile grant opens Dueling; her freed Comet buys Kip Up (21 talents).*
*v0.30 (Mike): NO BANKING, EVER: every talent point is spent the moment it is received, at creation, at milestones, at level-up (the app opens the spend dialog on the spot; declining forfeits). Chargen no longer allows skipping ahead: each step's points must be placed before Next. BACKGROUNDS grant 2 points (culture rules: their two Skills or your Origin, per point). Steps split: 5 Armor, 6 Comets; grant-talents ask their question on the step where you took them (Skilled Human asks during Heritage). Heritage branch now lays out fully on the Origin's left. Mira: 20 talents.*
*v0.29 (Mike's design): THE ORIGIN: ancestry, heritage, and culture merge into one constellation per character, the Origin (heritage branches LEFT, culture branches RIGHT, a golden thread joins the two roots). Ancestry and heritage points spend anywhere in it; culture and background points choose BROAD (their named Skills) or DEEP (anywhere in the Origin), per point. Origin progression is merged: rank counts all points across its sources. TALENT GRANTS ENGINE: a Grants column in the xlsx ("1 in one Skill", "2 in different Skill", "1 in any opened"...) gives grant-talents real pickers; Skilled Human finally asks which Skill. Comet step orders opened constellations first and the rail rows jump to their skies. Mira spends Natural Ambition's grant on Ambusher's spine (19 talents).*
*v0.28 (Mike, correcting v0.27's aim): BACKGROUNDS get the skill-pair treatment too, at 1 TP: each background names two Skills (new columns in backgrounds.xlsx), you spend 1 point in one of them, and the trade Lore root rides free. The Become-Trained grant parsing and its wizard radio machinery are retired for backgrounds (the keyword itself survives for talents). Cultures keep their pair at 2 TPs. Creation is now ~9 spent + 9 free roots + the Lore ≈ 18 talents. Mira loses Powerful Leap.*
*v0.27 (Mike): CULTURE REWORK: each culture names TWO Skills (new 'Skills' column in cultures.xlsx); the 2 culture points spend into one or both of them, and the culture constellation's own talents are bought with Comets instead. COMET coined: the talent point that answers to no constellation (the level-up point, and the 3 free creation points); spend it anywhere, Flared or not, opened or not. Milestone points remain Flare-bound.*
*v0.26 (Mike's design): WEAPONS CONSTELLATION: attack rolls use the Weapons constellation's proficiency (pf2e-shaped), granted Trained free at creation; specialization is content inside it (Group Focus, Signature Weapon, Group Mastery = pf2e crit spec as printed, The Named Blade ★). COMBAT STYLES become schools of exploits: how you wield still sets the ATTRIBUTE, style talents' checks use the style's own proficiency, and losing your off-hand blade changes your style, never your skill at hitting (the dropped-dagger problem dissolves). The free Style point is retired; free roots at creation: 4 identity + 3 saves + Awareness + Weapons = 9 (~19 talents, 10 spent). Damage spec follows Weapons rank.*
*v0.25 (Mike): wizard header simplified: the point tracker merged into the step chips, which carry up to three rows (name · choice / TPs x/y / what was picked), and a Step 0 'Starting Talents' opens the wizard. AWARENESS FREE FOR ALL: everyone starts Trained in Awareness alongside the three saves, so initiative works from level 1. Free roots at creation: 4 identity + 3 saves + Awareness = 8 (~19 talents). (An 'Unarmored free for all' variant was considered and reverted: the free Armor point already covers that choice.)*
*v0.24: SAVES FREE FOR ALL (Mike's ruling): every character gets Fortitude, Reflex, and Will Training at creation, no cost; Will feeds PRESENCE (Wits would be a god-stat). saves.xlsx authored (21 talents: Juggernaut/Evasion/Indomitable success-to-crit line, capstones). LORE TEMPLATE: one authored Lore constellation; every Lore (X) instance is a copy, so characters can grow several Lores side by side (lore.xlsx, 7 talents). CREATION GRANTS: 1 free point in any Armor constellation + 1 in any Combat Style; a fresh character now owns ~18 talents (11 spent + 7 free roots). App: heritage branches are invisible until chosen, then appear as a right-edge offshoot of the ancestry sky; wizard gains a build-so-far rail (opened constellations, points, attributes, derived).*
*v0.23 (Mike's PHB edit pass): ONE GATE SCHEDULE: every constellation unlocks Expert at L5, Master at L13, Legendary at L19; skill content will be designed to fit. SAVES ARE CHECKS: Fortitude/Reflex/Will become talent constellations (stubbed in the app, authorable in a future saves.xlsx); the +4 save pad is retired. Armor's built-in AC number is an ARMOR bonus, not an item bonus; item bonuses will come from quality gear. Derived-stats table slimmed to HP, AC, ability DC. Free action symbol ◇ adopted (pf2e); heritage roots re-marked as ✧. Hero Points text tightened; attribute definitions added; breakpoints get a table; assorted redundancies deleted per tracked changes. PHB is Playtest v1.1.*
*v0.22: ONE LADDER (Mike's ruling) — Trained/Expert/Master/Legendary grant the same proficiency (+4/+7/+10/+13) whether it's a skill, a weapon style, or armor; the separate armor ladder is gone. AC's counterweight is the **+3 budget**: every armor has an attribute cap + armor bonus summing to 3 (Unarmored 3/0 · Light 2/1 · Medium 1/2 · Heavy 0/3) — light draws the budget from you, heavy from the steel, and all armors converge once the cap is filled. Parity holds ±2 (heavy: L1 AC 18, L5 25, L13 36, L19 45 vs pf2e ~18/23-24/34-35/44-46). Caps touch only AC. Mira: AC 18 → 17.*
*v0.21: ADDITIVE MATH — check = d20 + level + attribute + proficiency (if any) + bonuses/penalties. Attribute always applies (raw talent never turns off); Untrained is just +0 proficiency. Proficiency re-baked to shed the attribute it used to hide: checks T+4/E+7/M+10/L+13, armor T+6/E+7/M+8/L+9 — focused characters land on the same totals as the old fused ladder, so pf2e still runs as printed. Ability DC = 10 + level + attribute + proficiency. Initiative = level + Wits + Awareness proficiency. NEW: Hero Points (1/session, max 3) — reroll only checks you're Trained or better in (never Untrained; the wedge between talent and training), spend all to refuse death. Mira's sheet numbers are unchanged to the digit.*
*v0.20: TERMINOLOGY — the official player-facing term is **constellation** ("tree" survives only in code identifiers and xlsx column headers, which stay stable for authoring). Wizard skies now auto-size so every step fits on one screen, Next button included. Tier bands show BOTH gate criteria per rank with ✓/✗ verdicts — points in the constellation and character level — whenever a character is in context. Culture and Free steps list every eligible constellation as a chip (no more buried Browse links — the "stuck on culture" trap is gone). Test data grew by 51 talents: Acrobatics/Crafting/Occultism/Religion filled out, all three Cultures extended, and both Human heritages gained gated branches (Practiced Pivot/Master of Many; Jack of Trades/Ready for Anything).*
*v0.19: pipeline fix — the converter was silently dropping the Requires column; requires now flow into the data with root-requires kept. Star-map edge language: every requirement is a dotted arrow that fills SOLID once you own both its stars — your constellation literally draws itself as you live it. The PHB prints only non-root Requires (root-first is implicit game-wide). The Observatory gains a three-level zoom: the Firmament (every kind of sky) → a category's constellations → one constellation, with breadcrumbs and animated descent. Color-coded attribute glyphs (▲ Might · ⚡ Agility · ◉ Wits · ✦ Presence) now mark constellation names, feeds lines, and hover cards. Layout is barycenter-ordered — each talent is placed above the talents it requires, untangling crossed lines; it's deterministic (seeded by talent names), so the same data always draws the same sky and no cache is needed. Firmament clusters and category patches show hover cards listing what's inside.*
*v0.18: RULING — unopened constellations can Flare (was already implied by "untrained rolls included"); a milestone point spent there buys the root and opens the constellation. This is the emergent-build engine: the level-up Free point is for plans, Flares are for deeds. App: chargen wizard now IS the constellation — click a star to spend the point, hover it for full details (the duplicate list below is gone); hover popups work in the Observatory too; the Constellation Explorer tab is now the **Observatory**. Star-map edges (app, viewer, PHB plates) now show ONLY true requirements — hard requires, root-first, and capstone★→any-Master; the old nearest-neighbor decoration lines implied fake prerequisites and are gone. Tier bands are shaded with their level gates ("EXPERT — 4 pts · L3+"), and in the wizard, bands above your level read as locked.*
*v0.17: heritage roots are never listed among buyable talents — they appear only at the heritage choice (wizard cards, PHB heritage tables, wiki) and as ◇ marks on star maps. Talent pickers and talent tables exclude them everywhere; the engine's "can't buy a heritage root" rule stays as the backstop.*
*v0.16: ancestry grants 1 bought talent (was 2); the creation cap of 3/constellation counts only bought talents — free identity roots are exempt (this also unblocks the heritage point). Creation ≈ 9 spent + 4 roots ≈ 13 talents.*
*v0.15 — CHARGEN 2.0 (Playtest v1.0): heritages live inside ancestry constellations as heritage roots ('h' in the Root column, ◇ in renders) — choosing one grants its root free and unlocks heritage-gated talents. All five wizard steps are data-driven; languages are a data table; grant points with no legal target bank. Creation: ~10 spent points + 4 free identity roots ≈ 14 talents.*
*v0.14: the Become Trained in X keyword — a talent point restricted to constellation X (buys the root if unopened; any talent there if opened; duplicates stack, unlike pf2e). Backgrounds are now a table of such grants, not constellations.*
*v0.13: identity-tree roots (Ancestry/Culture/Heritage/Background) are granted free by the chargen choice — the choice IS the root, pre-spent. Test data uses Golarion proper nouns (swap before any publication; mechanics are ORC-licensed, names are Paizo's).*
*v0.12: the rule gains its anti-farming clause — the roll must have consequences. No stakes, no Flare; consequence-free practice is downtime training's job.*
*v0.10: per-talent Feeds overrides — constellations keep a default attribute (untrained checks, armor fallback, ability DC), but any talent may feed a different one; attribute points now count per talent bought. Watch: easier attribute splash means more +1s across the board — if everyone homogenizes, tighten the min-+1 rule to per-tree instead of per-point.*
