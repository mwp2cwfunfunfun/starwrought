# Playtest report: v1.9 level-1 duels

Six level-1 characters, 19 attribute points and 15 gp of gear each, fought a round robin of
**4,000 duels per pairing** on a close-quarters map (10 feet apart, in contact on round one). The
simulator implements v1.9 as written: player-facing rolls, four degrees with nat-20 stepping, Graze
as one weapon die and nothing else, Protection by zone with the material weakness, Graze costs,
Exposed, stances, Rage, Sneak Attack, and MAP at −5 and −10 (−4 and −8 for agile).

Caveat before anything else: this is a simulation with a simple tactical AI. It plays the odds well
and plays cleverly badly. Treat it as a stress test of the **math**, not of the fun.

---

## The roster

| | Calling | Style | HP | Awa | Evade | Guard | Endure | Attack | Weapon | Armor |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| **Bear** | Rage | Brawling | 22 | 16 | 16 | 16 | 18 | +8 | fists 1d6 B agile | mail torso, leather limbs |
| **Ward** | Rage | Shield Fighting | 22 | 16 | 16 | 17 | 17 | +7 | mace 1d6 B | leather, + shield |
| **Tover** | Rage | Dueling | 22 | 16 | 17 | 18 | 16 | +7 | longsword 1d8 S | leather |
| **Quill** | Ambusher | Two-Weapon | 20 | 16 | 18 | 17 | 16 | +8 | shortsword 1d6 P agile | leather |
| **Sable** | Ambusher | Dueling | 20 | 16 | 18 | 17 | 16 | +8 | rapier 1d8 P deadly | leather |
| **Marrow** | Rage | Shield Fighting | 22 | 16 | 16 | 17 | 17 | +7 | mace 1d6 B | mail torso only, limbs bare |

## Result

| | Bear | Ward | Tover | Quill | Sable | Marrow | **Overall** |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Tover** | 52% | 85% | – | 97% | 80% | 88% | **73%** |
| **Sable** | 62% | 58% | 20% | 75% | – | 77% | **58%** |
| **Bear** | – | 67% | 48% | 70% | 38% | 83% | **54%** |
| **Marrow** | 17% | 23% | 12% | 40% | 23% | – | **45%** |
| **Ward** | 33% | – | 15% | 71% | 42% | 77% | **40%** |
| **Quill** | 30% | 29% | 3% | – | 25% | 60% | **29%** |

**A 43-point spread**, and one pairing at 97/3. Fights resolve in a median of **4 rounds**, which is
healthy and matches pf2e pacing.

The dice themselves behave well: **19% Miss, 43% Graze, 33% Hit, 5% Critical.** Graze is the most
common outcome, so attacks rarely whiff, which is exactly what you wanted.

---

## 1. The biggest problem: taking Might out of damage broke the weapon table

Damage is now weapon dice alone, and Protection is subtracted from that. Because there is no flat
additive, **Protection amplifies every difference between weapons**:

| | bare | Prot 2 | Prot 3 | Prot 4 |
|---|---:|---:|---:|---:|
| d6, no Might | 3.5 | 1.5 | 0.5 | **0.0** |
| d8, no Might | 4.5 | 2.5 | 1.5 | 0.5 |
| d6 + Might 3 | 6.5 | 4.5 | 3.5 | 2.5 |
| d8 + Might 3 | 7.5 | 5.5 | 4.5 | 3.5 |

A d8 is nominally 29% better than a d6. In practice, with no Might in the line, it is **1.3x better
bare, 3.0x better against mail, and infinitely better against plate.** Add Might back and the same
comparison flattens to 1.15x, 1.29x, 1.40x.

Your reasoning was sound about the attack roll: a higher modifier does convert Grazes into Hits. But
that argument governs *how often* you land, not *how much gets through*, and Protection only touches
the second. Restoring Might to Hit and Critical damage was the single most effective change I tested,
**cutting the spread from 43 points to 36**.

Evidence that this is the driver: when I gave every character the identical d8, the standings
completely inverted. Marrow and Bear went to 81% and 79%, and Tover and Sable fell to 33% and 29%.
The current table is not balanced, it just happens to have two large errors pointing in opposite
directions.

## 2. Light armor is binary, not weak

The weakness rule subtracts 2, and light Protection values are 1 and 2, so they floor at zero.

- **Leather against a sword: 0.** Not reduced, gone.
- **Padded against a sword: 0.**
- **Shortsword against plate: 0 damage.**

There is no gradient at the bottom of the armor table, only on and off. Making the weakness **−1**
instead of −2, or halving Protection and rounding up, keeps the fiction and restores a slope. On its
own it moved the spread only from 43 to 53 in one direction and 43 to 36 in the other depending on
what else changed, so treat it as a supporting fix rather than the main one.

## 3. Guard is not a choice, it is the right answer

Defenders picked Guard **65%** of the time. Forcing the policy shows how large the gap is:

| Pairing | picks higher | always Evade | always Guard |
|---|---:|---:|---:|
| Ward vs Sable | 40.7% | **27.9%** | **54.1%** |
| Bear vs Quill | 72.4% | 70.4% | 75.8% |

A 26-point swing in one pairing. The cause is structural: **Guard collects bonuses and Evade
collects none.** Shields give +2, En Garde +1, Off-Hand Guard +1, Parry +1, and Shield Wall makes the
shield free. Evade receives nothing and *subtracts* Load Strain. Stripping the Guard stack cut the
overall spread by 6 points.

Evade needs a structural source of its own, or the central choice in your combat system is
decorative at level 1.

## 4. Graze defeats the multiple attack penalty

| Attack | Miss | Graze | Hit | Crit | **Deals damage** |
|---|---:|---:|---:|---:|---:|
| 1st (+0) | 5% | 41% | 47% | 6% | **95%** |
| 2nd (−5) | 22% | 45% | 28% | 5% | **78%** |
| 3rd (−10) | 44% | 44% | 9% | 4% | **56%** |

Even at −10 you deal damage **more than half the time**, because a Graze still delivers a full weapon
die regardless of how badly you rolled. So swinging three times is almost always correct, and MAP has
stopped doing its real job, which is making the third action a genuine decision. Nobody in the
simulation ever wanted to Recenter, Raise a Shield, or reposition instead.

The cheap fix is to make Graze damage scale with the penalty, or simplest of all: **a Graze only
deals damage on your first attack each turn.** Later Grazes still impose their cost on the defender,
which keeps the shield-press fiction intact.

## 5. Rage beats Ambusher on identical builds

Same ancestry, same style, same gear, only the Calling swapped: **Rage wins 63%.** Rage gives 2 more
HP per level, temporary HP, and +2 damage on every hit, for one action that lasts the whole fight.
Ambusher gives Sneak Attack, which needs an off-guard target, and in a duel almost nothing creates
off-guard. Surprise Attacker only works in round one.

Equalising the callings cut the spread by 8.5 points. Ambusher needs a reliable way to make someone
off-guard at level 1, or a compensating increase.

## 6. Three of your four zones barely exist

Ordinary Hits land on the torso, Criticals are 5% of attacks, and Exposed almost never happened:
Clinch created it 23,000 times and Twin Openings 18,000 times across roughly 600,000 attacks.
**Over 90% of all damage landed on the torso.** Players are tracking four Protection values and
using one.

That is not necessarily wrong, since the zones do real work at the armorer's, but if you want them
live at the table, Exposed has to be much easier to create than "hit with both weapons in one turn"
or "they Grazed you while you were in Clinch."

## 7. Awareness is a dead stat in a fight

Every build has Awareness 16, because nobody has a reason to buy Wits. Its only combat job is
initiative, and giving one side +5 Awareness moved its win rate by just **4 points**. It is a
perfectly good exploration Defense; it just is not in the combat economy at all.

---

## Ranked recommendations

1. **Put a flat additive back in damage**, whether that is Might or something else. This is the one
   that fixes the weapon table, the armor table, and a third of the spread at once.
2. **Raise the weakness floor** to −1, or halve-and-round-up, so light armor is never literally zero.
3. **Give Evade a structural bonus source** to match the shield and parry bonuses that Guard enjoys.
   Otherwise the Evade-or-Guard decision is a lookup, not a choice.
4. **Stop Graze paying out on every attack in the turn**, so the third swing is a real decision again.
5. **Give Ambusher a level-1 way to create off-guard**, or raise its numbers.
6. Decide whether **zones** are a table system or a shopping system. They are currently the latter.

## One gap, unrelated to balance

**Greatswords, greataxes, mauls, and polearms have no Combat Style.** The four styles are Brawling,
Dueling, Shield Fighting, and Two-Weapon, all of which are one-handed or unarmed. Since the Strike
rule says "your combat style sets which attribute you add," a two-handed weapon user currently has no
attribute for their attack roll. Great Weapons appears to have been removed alongside Archery.

---
---

# Addendum: the same roster, playing tactically

The run above had a hole in it. The AI entered a stance, Raged, and then swung. It never Tripped,
Grappled, Shoved, Disarmed, or Recentered, and it never gave up an action to set anything up. That
matters more than I expected, and it **corrects two of the conclusions above.**

Re-run with a full maneuver layer: Trip, Grapple, Shove, Disarm and Escape resolved against the
defender's chosen Defense; prone and grabbed conditions; Grabbed removing Evade entirely; Recenter;
and four tactical policies.

## Tactics compress the spread by a third

| Policy | Spread | Median | Standings |
|---|---:|---:|---|
| Everyone just swings (the first run) | **47** | 4r | Tover 73 · Sable 57 · Bear 57 · Marrow 46 · Ward 41 · Quill 26 |
| Open with Trip, then swing | 28 | 5r | Tover 68 · Bear 55 · Quill 47 · Marrow 47 · Ward 44 · Sable 40 |
| Open with Grapple, then swing | **21** | 5r | Tover 66 · Bear 50 · Quill 48 · Sable 47 · Ward 45 · Marrow 45 |
| Situational setup | 31 | 5r | Sable 65 · Tover 60 · Quill 51 · Bear 49 · Marrow 40 · Ward 35 |

**The game is meaningfully better balanced than the first report claimed.** A 47-point spread was
partly an artifact of characters refusing to use half their rules.

## Correction 1: Ambusher is not short of off-guard

I said Sneak Attack had no reliable trigger at level 1. Wrong. **Trip and Grapple both apply
off-guard**, and both are available to anyone. Quill, the worst build in the static test, gains the
most from tactics of anyone on the roster:

| | just swings | plays tactically | |
|---|---:|---:|---:|
| **Quill** | 26.2% | **50.6%** | **+24.4** |
| Sable | 57.0% | 65.4% | +8.3 |
| Marrow | 45.5% | 40.0% | −5.5 |
| Ward | 41.1% | 34.7% | −6.4 |
| Bear | 56.9% | 49.3% | −7.6 |
| Tover | 73.3% | 60.1% | −13.2 |

Quill against Tover goes from **3% to 17%** once he opens with a maneuver. Still losing, but a 97/3
blowout becomes a fight.

Note the shape of that table: **setup helps the builds that need it and actively hurts the ones that
don't.** Tover and Bear are both worse off spending an action on a maneuver, because their damage is
already good. That is a catch-up mechanic behaving exactly as one should, and it is the strongest
thing the maneuver system has going for it.

## Correction 2: the real Rage-versus-Ambusher problem is Athletics

Not the damage, the **enabler**. Maneuvers roll Athletics, and **Rage grants Athletics Training as
part of the Calling** while Ambusher grants Stealth, which has no combat use in this playtest.

| Quill | Overall |
|---|---:|
| with Athletics Training | 50.1% |
| without | 42.4% |

A 7.7-point swing on a single Training. So a Rager gets the key to the maneuver game bundled free
with their Calling, and an Ambusher has to spend a background or a Comet on it. That is a much
narrower and more fixable problem than "Ambusher is weaker than Rage."

## What survived unchanged

**The Might fix is still the single best change, and tactical play makes it look better:**

| | Spread |
|---|---:|
| v1.9 as written, tactical play | 32.0 |
| with Might back in damage, tactical play | **20.4** |

**Guard is still the default**, chosen 61% of the time when the defender is free. But the interlock
you designed does fire: **when a defender is grabbed, Evade is unavailable and they take 100% of
attacks on Guard.** It is simply rare, because grabs only accounted for **5.3%** of all resolved
attacks. Escape is one action and usually works.

## Two new findings

**Maneuvers have a 43% dead band.** Across 428,000 Trips and 340,000 Grapples: 10.6% miss, **43.2%
Graze**, 46.2% land. The Graze band does nothing but impose the Graze cost, so nearly half of all
maneuver attempts are close to a wasted action. That is a lot of dead air on an action type you want
players reaching for.

**Fights get a round longer** when people set up, 4 to 5 rounds median. That is fine, arguably
better, but worth knowing it is the cost of the tactical layer.

## A content gap this exposed

The only maneuvers available in the playtest are the Athletics ones. **Feint needs Deception and
Demoralize needs Intimidation, and neither constellation exists yet.** Stealth is granted by Ambusher
but has no constellation either. Those were on the list from earlier (Stealth, Intimidation,
Deception, Diplomacy, Society, Great Weapons, Thrown Weapons) and are still unwritten, which means
the Awareness Defense currently has almost nothing pointed at it.
