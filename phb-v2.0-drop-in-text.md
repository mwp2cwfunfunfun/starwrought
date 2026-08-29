# PHB text for everything settled this session

Clean copy, organized by where it goes. Design reasoning lives in the other files; this is the book.

Supersedes the rules sections of `postures-draft.md`, `exposed-as-the-graze-cost.md`, and
`new-constellations-and-findings.md`.

---

# Chapter 4: Equipment

## Replace the damage line

> **Damage on a Hit** is your weapon's dice, plus your **Might**, plus your weapon specialization
> (+2 at Expert rank, +3 at Master, +4 at Legendary). You roll more dice as you level: two at 4th,
> three at 12th, four at 19th.
>
> **Damage on a Graze** is a single weapon die and nothing else. Roll one of your weapon's damage
> dice. Add no Might, no specialization, no extra dice from your level, no talent damage of any kind.
> Then subtract the Protection of the zone it landed on.

## Replace the finesse trait

> **Finesse.** You may use Agility instead of Might on **attack rolls** with this weapon. Damage still
> uses Might.

## Replace the armor of proof paragraph

> **Armor of proof.** Every piece is made of something, and every material has a blow it turns badly.
> **Against the damage type its material turns poorly, a piece's Protection is reduced by 1.** Padded
> and leather turn slashing poorly. Mail turns piercing poorly. Plate turns bludgeoning poorly.
>
> The sword rules the unarmored field, the spear point defeats mail, and the mace is the answer to
> plate. It is why a careful fighter carries more than one weapon, and why *versatile* is worth more
> than it looks: a longsword that can thrust is a longsword that can fight mail.

---

# Chapter 7: Encounters

## Replace Strike

> **Strike ◆ to ◆◆** *(attack)*
> Attack with a weapon or an unarmed blow. Roll **Weapons** against the target's chosen Defense. Your
> combat style sets which attribute you add; the proficiency is always Weapons.
>
> **◆** A Hit lands where the rules put it.
> **◆◆** On a **Hit**, you choose which zone it lands on. On a **Critical hit**, you may also leave
> that zone **Exposed**.

This replaces the separate action-investment table. Delete that table.

## Replace Answering an attack

> **Answering a blow.** When something attacks you, you choose **Evade** or **Guard**, and roll it
> against the attack's Threshold. You are rolling to keep the blow off you, and how well you roll
> decides how little of it arrives.

| Your Defense roll vs the attack's Threshold | Result |
|---|---|
| Beat it by 10+ | **Miss.** Nothing touches you. |
| Meet or beat it | **Graze.** One weapon die, then Protection, and you pay the Graze cost. |
| Miss it by less than 10 | **Hit.** Full damage. |
| Miss it by 10+ | **Critical hit.** Double damage, and the attacker chooses the zone. |

> **Guarding with a zone.** When you Guard you guard with something, and that something is a part of
> you. Which zone follows from how you are guarding, not from what would be convenient:

| You are guarding with | Zone |
|---|---|
| A shield, or a weapon with *parry* | **Arms** |
| A braced two-handed weapon | **Legs** |
| A ducked head and shoulder | **Head** |
| Nothing in hand, turning the blow aside with your body | **Torso** |

> **Neither Defense is always there.** You cannot slip a blow while you are grabbed, restrained, or
> immobilized, and you cannot meet one you never saw coming, or with nothing in your hands and no hand
> free. Those limits apply to attacks only. Against poison, fear, blasts, and everything not aimed at
> you by a creature, all four Defenses are always available.

## Replace The cost of a Graze

> **A Graze always opens you up. One of your zones becomes Exposed.**
>
> **Guarding:** the zone you were guarding with. Your guard has been driven out of line there.
> **Evading:** a zone of your choice. You twisted away, and you decide what you left open.

## New: Postures

> **Postures.** When you answer a blow you may also take a **posture**: a way of throwing yourself
> into it that buys a better result and costs you something whether or not it works.
>
> You know one posture for each Defense you are Trained in, free. Others are talents. **You may take
> only one posture per round**, however many blows come at you. Deciding which one is worth it is the
> whole point.

| Posture | Defense | Bonus | Cost |
|---|---|:-:|---|
| **Give Ground** | Evade | +2 | A zone of your choice becomes Exposed immediately, win or lose. |
| **Set Your Feet** | Guard | +2 | Your guard zone becomes Exposed immediately, win or lose. |

> These are simply the Graze cost paid in advance for a bonus. Posture talents cost your **reaction**
> on top, which is why you can only manage one of those in a round.

## Replace Openings: Exposed and Recenter

> **Exposed [zone].** That part of you is open: the armor there is displaced, or your guard no longer
> covers it.
>
> - **That zone's Protection counts as 0.**
> - An ordinary **Hit** may be placed there instead of the torso.
> - It stays Exposed until you Recenter.
>
> **Recenter ◆** *(concentrate)*. Gather yourself: clear every Exposed zone on you.
>
> **There is no called shot.** You never take a penalty to aim at a body part. Precision is bought
> with time, with a two-action Strike, or with an opening someone already made.

**Pressed is retired.** Delete it from the conditions table.

## Where the blow lands, revised

| Result | Zone |
|---|---|
| Critical hit | The attacker's choice, freely |
| Hit | The torso, or any Exposed zone at the attacker's choice. A two-action Strike lets the attacker choose freely |
| Graze | Same as a Hit, but the Graze also Exposes a zone as above |
| Miss | Nowhere |

## Maneuvers: change one line

> Grapple, Shove, Trip, and Disarm roll **Athletics or Acrobatics, your choice.** Overpower them, or
> use leverage.

---

# Chapter 3: Creating Your Character

## Replace the Callings table

| Calling | Skill | HP/lvl | Key Attribute |
|---|---|:-:|---|
| **Rage** | Athletics | 4 | Might |
| **Ambusher** | Stealth | **3** | Agility |
| **Hunter's Edge** | Awareness | 3 | Wits |
| **Bravado** | Acrobatics | 3 | Presence |

Ambusher rises from 2 to 3.

---

# Chapter 6: Talent Constellations

## New Calling: Hunter's Edge  ·  Wits

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Mark Prey ◆** | T | | *(concentrate)* Choose one creature you can see. It is your prey until you Mark another or the encounter ends. The first time each round that you Hit your prey, add 1d8 damage. You also always know roughly where your prey is while it is within 60 feet, even while Hidden or Undetected. The damage rises to 2d8 at Expert rank, 3d8 at Master, 4d8 at Legendary. Every talent here requires this. |
| **Running Mark** | T | Mark Prey | You may Mark Prey as part of a Stride rather than spending an action. |
| **Read the Quarry** | T | Mark Prey | The first time each encounter your prey attacks you, you learn which Defense it favours, and gain a +2 circumstance bonus to your Defense against that attack. |
| **Hobbling Strike** | T | Mark Prey | When you Hit your prey with the first Strike of your turn, its Speed is reduced by 10 feet until the end of its next turn. |
| **No Escape ↺** | T | Mark Prey | **Trigger** Your prey Strides away from you. **Effect** Stride up to your Speed toward it. This does not provoke. |

## New Calling: Bravado  ·  Presence

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Panache** | T | | You gain Panache whenever you critically succeed on a roll with consequences, or when you successfully Feint or Demoralize. You hold one at a time and keep it until you spend it or the encounter ends. While you have Panache you gain a +1 circumstance bonus to Evade and your Speed increases by 5 feet. Both rise to +2 and 10 feet at Expert rank, +3 and 15 at Master, +4 and 20 at Legendary. Every talent here requires this. |
| **Finisher ◆** | T | Panache | Spend your Panache and Strike. On a Hit add 2d6 damage. On a Graze you still deal your weapon die plus 1d6. You lose the Panache either way. |
| **Opportune Parry ↺** | T | Panache | **Trigger** A creature Grazes or Misses you while you have Panache. **Effect** No zone of yours becomes Exposed, and you gain a +2 circumstance bonus to Guard against that creature until the end of your next turn. |
| **Nimble Recovery** | T | Panache | While you have Panache, you may Recenter as a free action once per turn. |
| **Bravo's Entrance** | T | Panache | You begin every encounter with Panache if you are not surprised. |

## New Combat Style: Great Weapons  ·  Might

*Fights with: anything that takes both hands and a wide arc.*

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Great Weapons Training** | T | | You are Trained in this fighting style: its exploits are open to you, and checks its talents call for use this constellation's proficiency. Attack rolls use your Weapons proficiency. You gain the Overreach action. **Overreach ◆ (stance)** You must wield a two-handed melee weapon. Your Hits and Criticals deal +2 damage and your Evade drops by 2, rising to +3 damage at Expert rank, +4 at Master, +5 at Legendary. Every talent here requires this. |
| **Sweeping Blow ◆◆** | T | Great Weapons Training | One attack roll against two creatures within your reach, resolved separately against each one's chosen Defense. Both count as a single attack for your multiple attack penalty. |
| **Follow Through** | T | Great Weapons Training | When your Strike drops a creature, your next Strike this turn ignores your multiple attack penalty. |
| **Long Haft** | T | Great Weapons Training | Your two-handed melee weapons gain the *reach* trait. |
| **Set Against the Charge ↺** | T | Great Weapons Training | **Trigger** A creature moves into your reach from outside it. **Effect** Strike it, dealing +2 damage per weapon die. |

## New Skill: Guile  ·  Wits

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Guile Training** | T | | You are Trained in Guile: add this constellation's rank to its checks, to lie, to disguise, and to Feint. Every talent here requires this. |
| **Straight Face** | T | Guile Training | +2 circumstance bonus when the lie is plausible and you had time to prepare it. |
| **Feinting Step ◆** | T | Guile Training | Feint, then Step. |
| **Sell the Feint** | T | Guile Training | When you critically succeed at a Feint, the target is off-guard to everyone, not just you, until the end of your next turn. |
| **Second Face** | T | Guile Training | Assume a disguise in 1 minute rather than 10, and gain +2 circumstance to pass as an unremarkable member of any crowd you are dressed for. |

## New Skill: Intimidation  ·  Presence

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Intimidation Training** | T | | You are Trained in Intimidation: add this constellation's rank to its checks, to Demoralize and to Coerce. Every talent here requires this. |
| **Battle Cry ◆** | T | Intimidation Training | Demoralize every enemy within 15 feet with a single roll, compared separately against each one's Guard. |
| **No Quarter** | T | Intimidation Training | When you drop a creature, you may Demoralize one enemy who saw it fall as a free action. |
| **Unnerving** | T | Intimidation Training | A creature you have Demoralized this encounter takes a −1 circumstance penalty to attacks against you for the rest of it. |
| **Iron Word** | T | Intimidation Training | You can Demoralize a creature that shares no language with you, and gain +2 circumstance to Coerce someone who has already seen you fight. |

## Replacement talents

### Evade

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Slip the Line ↺** | T | Evade Training | *(posture)* +2 to your Evade against one attack. If the blow does not Hit, you end in any square adjacent to the attacker, your choice. |
| **Drop Flat ↺** | T | Evade Training | *(posture)* +4 to your Evade against every attack until the start of your next turn. You end prone. |

Replaces Light Feet and Duck and Cover.

### Guard

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Kneel Behind the Shield ↺** | T | Guard Training | *(posture)* You must have a shield Raised. +4 to your Guard against every attack until the start of your next turn. Your guard zone becomes Exposed, and your Speed is 0 until you spend an action to rise. |

Replaces Resolute.

### Rewordings, now that Pressed is gone

| Talent | New effect |
|---|---|
| **Unshaken** (Guard) | The first time each encounter that a Graze would Expose a zone on you, it does not. |
| **Cover the Angle ↺** (Guard) | **Trigger** An adjacent ally is attacked. **Effect** The attack is measured against your Guard instead of their chosen Defense, and any Graze cost falls on you. |
| **Clinch** (Brawling stance) | While you are in this stance, an enemy that Grazes one of your attacks does not choose which of their zones opens. You choose it. At Master rank, a creature you have Grabbed cannot Recenter. |

### Other replacements

| Constellation | Talent | Effect |
|---|---|---|
| **Human** | **Stubborn Footing** *(replaces Unbowed)* | The first time each encounter you would be knocked prone, you are not. |
| **Human** | **Close Ranks** *(replaces Common Tongue)* | While an ally is adjacent to you, both of you gain a +1 circumstance bonus to Guard. |
| **Human** | **Torchbearer Human** *(bloodline, rewritten)* | Allies within 15 feet gain a +1 circumstance bonus to their first Defense roll each round while they can see or hear you. |
| **Human** | **Steady the Line ↺** *(rewritten)* | **Trigger** An adjacent ally is Grazed. **Effect** No zone of theirs becomes Exposed. Once per round. |
| **Awareness** | **Call the Opening ◆** *(replaces Sweep the Room)* | Name one Exposed zone on a creature you can see. Until the end of your turn, your allies may place Hits there too. |
| **Endure** | **Shrug It Off** *(replaces Stalwart Constitution)* | Reduce all persistent damage you take by your Might, minimum 1. |
| **Acrobatics** | **Tumbling Retreat ◆** *(replaces Cat Fall)* | Step 10 feet instead of 5. |
| **Acrobatics** | **Slip the Grasp** *(replaces Steady Balance)* | +2 circumstance bonus to Escape. |
| **Acrobatics** | **Kip Away** *(replaces Nimble Crawl)* | When you Stand, you may Step as part of the same action. |
| **Athletics** | **Bull Rush ◆◆** *(replaces Powerful Leap)* | Stride, then Shove. |
| **Athletics** | **Wrestler's Grip** *(replaces Combat Climber)* | A creature you have Grabbed takes a −2 circumstance penalty to Escape. |
| **Chelaxian** | **Iron Etiquette** *(rewritten)* | +1 circumstance bonus to Guard against Demoralize and against any effect that would make you frightened. |
| **Keleshite** | **Desert Stride** *(rewritten)* | You ignore difficult terrain from sand, rubble, or loose footing, and your first Stride each encounter is 5 feet longer. |

## Cut from the playtest document

**Lore, Crafting, Religion, and Occultism.** Twelve talents with no combat use. Add a line saying
they return in the full book, and drop the Background skill grants that point at them.

---

# Small edits elsewhere

- **Combat Style tables** use **Requires** rather than Cost. Already done.
- **Conditions table:** delete **Pressed**. Rewrite **Exposed** per the Chapter 7 text above.
- **Deception** is renamed **Guile** everywhere.
- **Yield** and **Follow** disappear from the Graze rules; check for stragglers.
