# Three new constellations, and what the sim says about your four changes

---

# Part 1: The constellations

Root plus four Trained talents each, written for the Effect cells. Combat Style tables now use
**Requires** rather than Cost.

## Deception  ·  Skill  ·  **Wits**

Feeding Wits rather than Presence is deliberate. It makes Feint a Wits attack answered by an
Awareness defense, cunning against cunning, and it gives Wits the combat job the playtest showed it
completely lacked.

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Deception Training** | T | | You are Trained in Deception: add this constellation's rank to its checks, to lie, disguise, and Feint. Every talent here requires this. |
| **Practiced Liar** | T | Deception Training | +2 circumstance bonus when the lie is plausible and you had time to prepare it. Improvising still costs you nothing; it just gains nothing. |
| **Feinting Step ◆** | T | Deception Training | Feint, then Step. |
| **Sell It** | T | Deception Training | When you critically succeed at a Feint, the target is off-guard to **everyone**, not just you, until the end of your next turn. |
| **Second Face** | T | Deception Training | Assume a disguise in 1 minute rather than 10, and gain +2 circumstance to pass as an unremarkable member of any crowd you are dressed for. |

## Intimidation  ·  Skill  ·  **Presence**

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Intimidation Training** | T | | You are Trained in Intimidation: add this constellation's rank to its checks, to Demoralize and to Coerce. Every talent here requires this. |
| **Battle Cry ◆** | T | Intimidation Training | Demoralize every enemy within 15 feet with a single roll, compared separately against each one's Guard. |
| **No Quarter** | T | Intimidation Training | When you drop a creature, you may Demoralize one enemy who saw it fall as a free action. |
| **Unnerving** | T | Intimidation Training | A creature you have Demoralized this encounter takes a −1 circumstance penalty to attacks against you for the rest of it. |
| **Iron Word** | T | Intimidation Training | You can Demoralize a creature that shares no language with you, and gain +2 circumstance to Coerce someone who has already seen you fight. |

## Great Weapons  ·  Combat Style  ·  **Might**

*Fights with: anything that takes both hands and a wide arc.*

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Great Weapons Training** | T | | You are Trained in this fighting style: its exploits are open to you, and checks its talents call for use this constellation's proficiency. Attack rolls themselves use your Weapons proficiency. You gain the Overreach action. **Overreach ◆ (stance)** You must be wielding a two-handed melee weapon. While you are in this stance your Hits and Criticals deal +2 damage and your Evade drops by 2, rising to +3 damage at Expert rank, +4 at Master, and +5 at Legendary. Every talent here requires this. |
| **Sweeping Blow ◆◆** | T | Great Weapons Training | One attack roll against two creatures within your reach, resolved separately against each one's chosen Defense. Both count as a single attack for your multiple attack penalty. |
| **Follow Through** | T | Great Weapons Training | When your Strike drops a creature, your next Strike this turn ignores your multiple attack penalty. |
| **Long Haft** | T | Great Weapons Training | Your two-handed melee weapons gain the *reach* trait. |
| **Set Against the Charge ↺** | T | Great Weapons Training | **Trigger** A creature moves into your reach. **Effect** Strike it. If it entered from outside your reach, your weapon deals +2 damage per weapon die. |

**On the stance.** Overreach is the only one of the five that trades a defense away for damage, which
suits a weapon you cannot hide behind. It also pushes a great-weapon fighter onto Guard, which is a
nice bit of interlock: commit to the swing and you stop being able to dodge.

---

# Part 2: What the sim says about your four changes

Same six characters, tactical AI, maneuvers live, roughly 2,500 duels per pairing.

## Putting the attribute back in damage: yes. Finesse giving Agility to damage: **no**

| | Spread |
|---|---:|
| v1.9, dice only | 30.5 |
| **Might added to damage, finesse stays attack-only** | **19.1** |
| Might added, and finesse also gives Agility to damage | 32.6 |

Adding Might is the best single change I have tested and it nearly halves the spread. Extending
finesse to damage undoes all of it and then some, because it hands one attribute the whole package.

An Agility build already buys the attack roll, Evade, Acrobatics, and two of the five Combat Styles.
Add damage and there is nothing left for it to want. **Sable goes from 60% to 72% and Bear drops from
59% to 39%** on that one clause. Finesse giving accuracy but not damage is the trade that keeps Might
worth having: Might buys damage, Endure, Athletics, and the Load you need to wear real armor.

## The Evade perk: it does not do what you want

I tested two versions, and re-tested with a defender AI that reasons about expected damage rather
than picking the bigger number, so this is not an artifact of a dumb bot.

| | Spread | Evade picked |
|---|---:|---:|
| no Evade bonus | **18.4** | 39.7% |
| Evade takes nothing on a 5-point margin | 27.3 | 37.2% |
| Evade success means no damage at all | 32.8 | 33.8% |

Both versions made balance worse and **neither made anyone choose Evade more often.** Sable went 60
to 68 and Quill 45 to 64, while Tover fell 52 to 41 and Ward 42 to 35.

The reason is worth sitting with: **Guard's advantage is not that it is bigger, it is that it has
sources.** A shield buys +2, En Garde +1, Off-Hand Guard +1, and Shield Wall makes the shield free.
Evade is the raw number and nothing else. A universal perk bolted onto Evade does not give a Presence
build any reason to dodge; it just makes Agility builds better at what they already did.

Three ways to actually fix it, in the order I would try them:

1. **Lean on availability instead of numbers.** You already have the right idea in the rules:
   Grabbed removes Evade, being unaware removes Guard. Those made the choice real in play far more
   than any bonus did. Widen that list rather than balancing the digits.
2. **Give Evade purchasable sources** to match the shield: a light-armor talent, a mobility talent,
   something you spend a point on. Symmetry of *sources*, not of *size*.
3. Leave it. At level 1 with four Defenses free, Guard being the usual answer is survivable.

## The two-action Strike: right mechanic, currently starved

The design prices out well. A placed Strike against a target with an armor gap is worth about 3
damage, and a second Strike at −5 is worth about 2.5, so it is a genuinely close call, which is
exactly where you want it.

But my AI **never once took it in 1.8 million attacks**, because there was nothing to find:

| Target | Torso Protection | Softest zone | Worth |
|---|:-:|:-:|:-:|
| Bear | 3 | 0 | **3** |
| Marrow | 3 | 0 | **3** |
| Ward, Tover, Quill, Sable | 0 | 0 | 0 |

Four of six characters have **zero Protection on every zone**, because the −2 material weakness
floors leather and padded at nothing. So the placed Strike has no gap to aim at, and neither does the
whole zone system.

**This is the same root cause as the dormant-zones finding.** Fix the Protection floor, whether by
making the weakness −1 or by halving and rounding up, and the two-action Strike, the Exposed
condition, and the four-zone armor table all switch on at the same moment. Adding the action without
fixing the floor will just be a rule nobody uses.

**One tidy-up while you are in there.** The action-investment table already says 2 actions can Expose
on a critical and 3 actions can Expose on a hit. That now overlaps the Strike entry. I would fold
them into one place:

> **Strike ◆ to ◆◆◆** *(attack)*
> **◆** As written. A Hit lands on the torso, or on an Exposed zone.
> **◆◆** As above, and on a **Hit** you choose which zone it lands on.
> **◆◆◆** As above, and on a **Hit** you may also leave that zone **Exposed**.
