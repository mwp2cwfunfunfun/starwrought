# The Four Defenses: roots and Trained tier

**Draft v0.1, for pasting into `data/defenses.xlsx`.**

Awareness, Evade, Guard, and Harness. Each entry below is one root plus four Trained talents,
written in the tree-sheet column order so it can go straight into a sheet.

Every root satisfies the Root Rule (v0.38): something that gets rolled, and something that improves
at Expert, Master, and Legendary.

---

## `_Tree Index` rows

| Tree | Category | Feeds | Flare Triggers | Meta note |
|---|---|---|---|---|
| Awareness | Defense | Wits | Crit succeed or crit fail on any roll directly related to a talent in this constellation. | free at creation |
| Evade | Defense | Agility | Crit succeed or crit fail on any roll directly related to a talent in this constellation. | |
| Guard | Defense | Presence | Crit succeed or crit fail on any roll directly related to a talent in this constellation. | |
| Harness | Defense | Might | Crit succeed or crit fail on any roll directly related to a talent in this constellation. | |

> `Defense` is a new category. `xlsx_to_trees.py` will reject these sheets until it's added to the
> `CATEGORIES` tuple, and to `FALLBACK_NEEDED` if you want the tree-level Feeds enforced.

---

## Awareness (Wits)

*See it coming.*

| Talent | Tier | Root | Requires | Description | Effect |
|---|:-:|:-:|---|---|---|
| **Awareness Training** | T | x | | Nothing reaches you that you have not already half noticed. | You are Trained in Awareness: add this constellation's proficiency to your Awareness checks and to your Awareness DC, the number attack rolls and Sneak, Feint, and Lie attempts are measured against. Initiative is an Awareness check. Everyone gains this at creation, free. Every talent here requires this. |
| **Sweep the Room** ◆ | T | | Awareness Training | You do not look at one thing. You look at everything. | When you Seek, you cover everything within 30 feet at once rather than one direction. |
| **Second Sense** | T | | Awareness Training | Something at the back of your neck answers before you do. | The first time each encounter that a hidden or unnoticed creature attacks you, you may use Guard against that attack even though you were unaware of it. |
| **Read the Tell** | T | | Awareness Training | Everyone has one. You have made a study of finding it. | When a creature critically fails to Feint against you, Lie to you, or Sneak past you, it becomes Exposed (Head) until it Recenters. |
| **First Word** | T | | Awareness Training | You saw it first, so you get to decide who moves. | When you roll initiative and are not surprised, you may swap your place in the order with one willing ally. |

---

## Evade (Agility)

*Do not be there.*

| Talent | Tier | Root | Requires | Description | Effect |
|---|:-:|:-:|---|---|---|
| **Evade Training** | T | x | | The blow arrives where you were standing a moment ago. | You are Trained in Evade: add this constellation's proficiency to your Evasion, the DC attack rolls are measured against when you choose to slip a blow rather than meet it. Evasion is unavailable while you are grabbed, restrained, immobilized, or otherwise have nowhere to go. Every talent here requires this. |
| **Fluid Motion** | T | | Evade Training | Nothing on you creaks, catches, or hangs. | Your Speed increases by 5 feet while your total Load is 1 or less. |
| **Skirmisher's Step** | T | | Evade Training | Rubble, roots, and bodies are just more floor. | Your Steps ignore difficult terrain. |
| **Give Ground** | T | | Evade Training | Yielding is a technique, not a defeat. | When you Yield after an Evasion Graze, you move 10 feet instead of 5, and the attacker cannot Follow. |
| **Falling Leaf** | T | | Evade Training | Down is just another direction to move well in. | You take no damage from falls of 20 feet or less, and halve the damage from longer ones. |

---

## Guard (Presence)

*Do not let it through.*

| Talent | Tier | Root | Requires | Description | Effect |
|---|:-:|:-:|---|---|---|
| **Guard Training** | T | x | | You occupy the space, and you mean it. | You are Trained in Guard: add this constellation's proficiency to your Guard, the DC attack rolls are measured against when you meet a blow with weapon, shield, or braced arm. Guard is unavailable while you are unaware of the attack or have nothing in hand and no hand free. Every talent here requires this. |
| **Unshaken** | T | | Guard Training | The first thing that breaks a guard is the person holding it. | The first time in each encounter that you would become Pressed, you do not. |
| **Deflecting Palms** ↺ | T | | Guard Training | Meet it, turn it, let it go past. | **Trigger** You are hit by an attack and have a hand free. **Effect** Reduce that attack's damage by 2 plus your Presence. |
| **Braced Frame** | T | | Guard Training | You have been pushed by better. | You gain a +2 circumstance bonus to your defenses against Shove, Trip, and Reposition. |
| **Cover the Angle** ↺ | T | | Guard Training | Their guard was open. Yours was not. | **Trigger** An adjacent ally is attacked and you are not Pressed. **Effect** The attack is measured against your Guard instead of their chosen defense. You become Pressed. |

---

## Harness (Might)

*Survive what does get through.*

Harness sells **relief from armor's costs**, not Protection. Protection is bought with coin, in the
pieces you own. Keeping that line means a character in light kit can skip this constellation
entirely without falling behind, which is what stops it becoming a tax everyone must pay.

| Talent | Tier | Root | Requires | Description | Effect |
|---|:-:|:-:|---|---|---|
| **Harness Training** | T | x | | You were not issued this armor. You were built into it. | You are Trained in Harness: reduce your Load strain and your armor's check penalty by 1 each, to a minimum of 0. Both reductions rise to 2 at Expert rank, 3 at Master, and 4 at Legendary. Every talent here requires this. |
| **Soldier's Fit** | T | | Harness Training | Thirty miles a day, and the buckles never once complained. | Ignore your armor's Speed penalty. |
| **Second Skin** | T | | Harness Training | You have slept in worse. Most nights, in fact. | You can sleep in armor without becoming fatigued, and you don or remove your kit in half the usual time. |
| **Turn the Point** ↺ | T | | Harness Training | You cannot stop it. You can decide where it lands. | **Trigger** A Hit against you is placed on an Exposed zone. **Effect** Twist into it: the Hit lands on your Torso instead, and uses that zone's Protection. |
| **Quick Buckle** | T | | Harness Training | Everything you wear comes off in the order you need it to. | Attach or remove one armor piece as a single action rather than a minute, and you never suffer the Clatter penalty for mismatched pieces. |

---

## Notes

**Alternates**, if you want to swap any of the above: *Weathered Steel* (+2 circumstance against
environmental hazards and exposure; your armor never rusts or fails you) for Harness, and
*Clanking Menace* (+2 circumstance to Intimidation while your Load is 3 or more) for Harness or
Guard.

**On the two roots that grant defenses**, note the wording deliberately contains the phrase "attack
rolls" so the pipeline's root-rule check recognises them as rolled. If you rephrase, keep a rolled
noun in the sentence or the converter will warn.

**Harness Training uses a 1/2/3/4 ladder rather than the proficiency bonus** on purpose. Applying
the full +4 to +13 proficiency to a check penalty would erase every armor drawback with a single
point, which would defeat the reason the drawbacks exist.

**Six talents fold in from the retired armor constellations**: Fluid Motion, Skirmisher's Step, and
Falling Leaf into Evade; Deflecting Palms and Braced Frame into Guard; Soldier's Fit and Second
Skin into Harness. Fluid Motion and Clanking Menace were rewritten to key off Load rather than
armor category, since categories no longer exist under piecemeal.

**Deflecting Palms changed attribute**, from Agility to Presence, to match Guard's feed.
