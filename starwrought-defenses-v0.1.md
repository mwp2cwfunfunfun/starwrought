# The Four Defenses

**Draft v0.1.** Supersedes `defenses-trained-tier-draft.md`, which is now out of date (Harness is
renamed and the save trees are folded in).

Mike's ruling: the three saves collapse into the Defenses. Seven defensive numbers built out of
four attributes meant three of them were duplicates. There are now **four Defenses, one per
attribute**, and each one is both a DC and a check.

---

## 1. The four

| Defense | Attribute | It is a **DC** when... | It is a **check** when... |
|---|---|---|---|
| **Awareness** | Wits | someone Sneaks, Feints, or Lies to you | you Seek, roll initiative, or disbelieve an illusion |
| **Evade** | Agility | an attacker swings and you slip aside | an area effect, trap, or hazard goes off |
| **Guard** | Presence | an attacker swings and you meet it | fear, charm, confusion, or anything assaulting your composure |
| **Endure** | Might | someone tries to Grapple, Shove, Trip, or Disarm you | poison, disease, exhaustion, or anything trying to break your body |

Reflex becomes Evade, Will becomes Guard, Fortitude becomes Endure. Awareness had no save partner
and picks up illusions and anything that works by going unnoticed.

**Every Defense does both jobs**, which is what makes four numbers enough.

---

## 2. Why this needs no new math

Core design §2 already says an ability DC is "10 + level + attribute + proficiency; your check with
a 10 in place of the die." The game has always treated a DC and a check as the same number in two
modes. A Defense therefore does not need a save sitting next to it duplicating its attribute and
its proficiency. Evade **is** the number, whether an orc is rolling at it or you are rolling it at
a fireball.

Nothing about the parity math changes. The components are identical; only the count of tracked
numbers drops from seven to four.

---

## 3. Availability is scoped to attacks

Guard is unavailable when you are unaware or empty-handed. Evade is unavailable when you are
grabbed, restrained, or immobilized. **Those restrictions apply only to physical attacks.**

Against area effects, hazards, poisons, diseases, and mental assaults, your Defense is always
available. A disarmed character still resists fear. A grappled one still dives from the blast.

---

## 4. Creation

**You are Trained in all four Defenses at creation, free.** Deeper ranks cost points like anything
else.

This extends what the saves already did (v0.24, free Training in all three) to cover the two that
used to be opt-in. It also retires the old "1 free point in any Armor constellation" grant, which
has nothing left to point at.

---

## 5. Running printed pf2e effects

One line. A printed effect calling for a **Reflex** save is an **Evade** check, **Fortitude** is
**Endure**, **Will** is **Guard**. Monster saves stay exactly as printed, since you are targeting
their numbers rather than converting them.

---

## 6. The roots

All four satisfy the Root Rule: something rolled, something that improves by rank.

| Talent | Tier | Root | Effect |
|---|:-:|:-:|---|
| **Awareness Training** | T | x | You are Trained in Awareness: add this constellation's proficiency to your Awareness checks and to your Awareness DC, the number attack rolls and Sneak, Feint, and Lie attempts are measured against. Initiative is an Awareness check. Every talent here requires this. |
| **Evade Training** | T | x | You are Trained in Evade: add this constellation's proficiency to your Evade. It is the DC attack rolls are measured against when you slip a blow, and the check you roll against area effects, traps, and hazards. Against physical attacks it is unavailable while you are grabbed, restrained, or immobilized; against everything else it is always available. Every talent here requires this. |
| **Guard Training** | T | x | You are Trained in Guard: add this constellation's proficiency to your Guard. It is the DC attack rolls are measured against when you meet a blow with weapon, shield, or braced arm, and the check you roll against fear, charm, confusion, and other assaults on your composure. Against physical attacks it is unavailable while you are unaware of the attack or have nothing in hand and no hand free; against mental effects it is always available. Every talent here requires this. |
| **Endure Training** | T | x | You are Trained in Endure: add this constellation's proficiency to your Endure. It is the check you roll against poison, disease, exhaustion, and anything trying to break your body, and the DC that Grapple, Shove, Trip, and Disarm attempts are measured against. You also reduce your Load strain and your armor's check penalty by 1 each, rising to 2 at Expert rank, 3 at Master, and 4 at Legendary. Every talent here requires this. |

---

## 7. Trained tier, consolidated

Provenance marked: **(R)** folded from Reflex, **(W)** from Will, **(F)** from Fortitude,
**(A)** from a retired armor constellation, **(new)** written for this draft.

### Awareness (Wits)

| Talent | Effect | From |
|---|---|:-:|
| **Sweep the Room** ◆ | When you Seek, you cover everything within 30 feet at once rather than one direction. | new |
| **Second Sense** | The first time each encounter that a hidden or unnoticed creature attacks you, you may use Guard against that attack even though you were unaware of it. | new |
| **Read the Tell** | When a creature critically fails to Feint against you, Lie to you, or Sneak past you, it becomes Exposed (Head) until it Recenters. | new |
| **First Word** | When you roll initiative and are not surprised, you may swap your place in the order with one willing ally. | new |

### Evade (Agility)

| Talent | Effect | From |
|---|---|:-:|
| **Light Feet** | +2 circumstance bonus to Evade against traps and hazards. | R |
| **Duck and Cover** ↺ | When an area effect you can see includes you, gain +2 circumstance to your Evade check if there is cover to dive behind. | R |
| **Fluid Motion** | Your Speed increases by 5 feet while your total Load is 1 or less. | A |
| **Skirmisher's Step** | Your Steps ignore difficult terrain. | A |
| **Give Ground** | When you Yield after an Evade Graze, you move 10 feet instead of 5, and the attacker cannot Follow. | new |
| **Falling Leaf** | You take no damage from falls of 20 feet or less, and halve the damage from longer ones. | A |

### Guard (Presence)

| Talent | Effect | From |
|---|---|:-:|
| **Resolute** | +2 circumstance bonus to Guard against fear. | W |
| **Steady Breath** ◆ | End the frightened condition on yourself, or reduce its value by 2. | W |
| **Unshaken** | The first time in each encounter that you would become Pressed, you do not. | new |
| **Deflecting Palms** ↺ | **Trigger** You are hit and have a hand free. **Effect** Reduce that attack's damage by 2 plus your Presence. | A |
| **Cover the Angle** ↺ | **Trigger** An adjacent ally is attacked and you are not Pressed. **Effect** The attack is measured against your Guard instead of their chosen defense. You become Pressed. | new |

### Endure (Might)

Two branches: **the flesh** (poison, disease, exhaustion) and **the steel** (Load, penalties, zones).

| Talent | Effect | From |
|---|---|:-:|
| **Stalwart Constitution** | +2 circumstance bonus to Endure against poison and disease. | F |
| **Second Wind** ◆ | Once per day, dig deep: regain Hit Points equal to your level plus your Might. | F |
| **Braced Frame** | +2 circumstance bonus to your Endure DC against Shove, Trip, and Reposition. | A |
| **Soldier's Fit** | Ignore your armor's Speed penalty. | A |
| **Second Skin** | You can sleep in armor without becoming fatigued, and you don or remove your kit in half the usual time. | A |
| **Turn the Point** ↺ | **Trigger** A Hit against you is placed on an Exposed zone. **Effect** Twist into it: the Hit lands on your Torso instead and uses that zone's Protection. | new |
| **Quick Buckle** | Attach or remove one armor piece as a single action rather than a minute, and you never suffer the Clatter penalty for mismatched pieces. | new |

---

## 8. Where every existing talent goes

| Old talent | Old home | New home | Change needed |
|---|---|---|---|
| Light Feet, Duck and Cover | Reflex T | Evade T | "Reflex save" becomes "Evade" |
| Hair Trigger, Slip Aside | Reflex E | Evade E | same |
| Evasion | Reflex M | Evade M | **rename**, collides with the mechanic |
| Untouchable ★ | Reflex L | Evade L | keep; the Unarmored talent of the same name retires with its tree |
| Resolute, Center Yourself | Will T | Guard T | Center Yourself **renamed** to Steady Breath, collides with Recenter |
| Unclouded, Anchor of the Mind | Will E | Guard E | "Will save" becomes "Guard" |
| Indomitable | Will M | Guard M | same |
| Unshakable ★ | Will L | Guard L | **rename**, too close to the new Guard talent Unshaken |
| Stalwart Constitution, Second Wind | Fortitude T | Endure T | "Fortitude save" becomes "Endure" |
| Shrug It Off, Enduring | Fortitude E | Endure E | same |
| Juggernaut | Fortitude M | Endure M | same |
| Unbreakable ★ | Fortitude L | Endure L | same |
| Glancing Plates, Deflecting Angles, Armor Specialist | armor trees E | Endure E/M | become Protection bonuses |
| Bulwark | Heavy Armor E | retire | "Reflex saves use Might" is meaningless once Evade and Endure are separate constellations |
| all remaining armor talents | armor trees | Evade / Guard / Endure | per the fold-in map |

**The three "successes become critical successes" talents survive as each Defense's Master
signature**: Juggernaut for Endure, Evasion for Evade, Indomitable for Guard. Awareness should get
a fourth for symmetry.

---

## 9. Name collisions this surfaced

- **Evasion** is both a Reflex talent and the name of a core mechanic. The talent has to move.
- **Unshakable** (Will capstone) and **Unshaken** (new Guard talent) cannot both exist.
- **Center Yourself** (Will) and **Recenter** (the action) will be confused constantly.
- **Untouchable**, **Shrug It Off**, and **Juggernaut** were each duplicated across a save tree and
  an armor tree. The armor copies retire with their trees, so these resolve themselves.

---

## 10. Still open

- Whether Endure should be a DC for maneuvers at all, or whether Grapple and Shove should target
  Guard. Endure is the more physical read and it gives all four Defenses a DC role, which is why
  it is written that way here.
- Whether Awareness wants a specialization layer under it (a Vigilance or Scouting constellation),
  since it is the only Defense with nothing beneath it.
- What replaces Bulwark for the heavy-armor character, if anything.
- Whether "Endure" is the right word. It parallels Awareness, Evade, and Guard well, and it carries
  both the flesh and the steel, which "Harness" could not.
