# Two new Callings, and a combat-relevance audit of every talent

---

# Part 1: Two more Callings

With these you get a tidy property: **four Callings, four attributes, one each.**

| Calling | pf2e cousin | Skill | HP/lvl | Key Attribute |
|---|---|---|:-:|---|
| Rage | Barbarian | Athletics | 4 | Might |
| Ambusher | Rogue | Stealth | 2 | Agility |
| **Hunter's Edge** | Ranger | **Awareness** | **3** | **Wits** |
| **Bravado** | Swashbuckler | **Acrobatics** | **3** | **Presence** |

Hunter's Edge feeding Wits is deliberate: the playtest found Wits was the only attribute with no
combat job at all, and a hunter who tracks and reads their quarry is the natural owner of it.

## Hunter's Edge  ·  Awareness  ·  3 HP/level  ·  Wits

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Mark Prey ◆** | T | | *(concentrate)* Choose one creature you can see. It is your prey until you Mark another or the encounter ends. **The first time each round that you Hit your prey, add 1d8 damage.** You also always know roughly where your prey is while it is within 60 feet, even while it is Hidden or Undetected. The extra damage rises to 2d8 at Expert rank, 3d8 at Master, and 4d8 at Legendary. Every talent here requires this. |
| **Running Mark** | T | Mark Prey | You may Mark Prey as part of a Stride rather than spending an action. |
| **Read the Quarry** | T | Mark Prey | The first time each encounter your prey attacks you, you learn which Defense it favours, and you gain a +2 circumstance bonus to your Defense against that attack. |
| **Hobbling Strike** | T | Mark Prey | When you Hit your prey with the first Strike of your turn, its Speed is reduced by 10 feet until the end of its next turn. |
| **No Escape ↺** | T | Mark Prey | **Trigger** Your prey Strides away from you. **Effect** Stride up to your Speed toward it. This does not provoke. |

**Why once per round rather than once per hit.** It keeps the Hunter from being a flat damage
upgrade and stops it aggravating the multiple attack penalty problem the playtest turned up, where
the third swing is already too attractive. The Hunter wants their *first* attack to land, which is
the opposite pressure and a useful one.

## Bravado  ·  Acrobatics  ·  3 HP/level  ·  Presence

Panache keys off the **critical success**, which is already the trigger that Flares a constellation.
The swashbuckler is the Calling that turns the game's central loop into a combat resource.

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Panache** | T | | You gain **Panache** whenever you critically succeed on a roll with consequences, or when you successfully Feint or Demoralize. You can hold one Panache at a time and you keep it until you spend it or the encounter ends. **While you have Panache you gain a +1 circumstance bonus to Evade and your Speed increases by 5 feet.** Both rise to +2 and 10 feet at Expert rank, +3 and 15 at Master, +4 and 20 at Legendary. Every talent here requires this. |
| **Finisher ◆** | T | Panache | Spend your Panache and Strike. On a **Hit** add 2d6 damage. On a **Graze** you still deal your weapon die plus 1d6. You lose the Panache either way. |
| **Opportune Parry ↺** | T | Panache | **Trigger** A creature Grazes or Misses you while you have Panache. **Effect** You do not pay the Graze cost, and you gain a +2 circumstance bonus to Guard against that creature until the end of your next turn. |
| **Nimble Recovery** | T | Panache | While you have Panache, you may Recenter as a free action once per turn. |
| **Bravo's Entrance** | T | Panache | You begin every encounter with Panache if you are not surprised. |

**On the Finisher paying out on a Graze.** Spending your whole resource and getting nothing is the
classic swashbuckler feel-bad. The Graze clause means a Finisher always does *something*, which suits
a Calling built on flourish.

## Three things these expose

**Ambusher is now clearly the weakest on HP** at 2 against everyone else's 3 and 4, on top of the
playtest finding that its Sneak Attack has no reliable trigger. I would raise it to 3 and let Rage
keep 4 alone.

**Rage still uniquely bundles the maneuver enabler.** Maneuvers roll Athletics, Rage grants Athletics,
and the playtest measured that Training as worth 7.7 points of win rate. Neither new Calling fixes
that. The clean solution uses a principle you already like: **let Grapple, Shove, and Trip roll
Athletics or Acrobatics, your choice** (overpower it, or use leverage). Bravado then enables the
maneuver game too, and Rage stops owning it outright.

**Both new Callings want a Combat Style that does not exist for them.** Hunter's Edge is a ranged
concept with Archery cut, so it plays as a melee skirmisher here. Worth saying so in the playtest
document rather than leaving players hunting for a bow.

---

# Part 2: Talent audit for a combat playtest

Every talent in v1.9, marked for whether it does anything in a fight. **Cut** means remove from the
playtest document; **Replace** means the slot matters but the effect does not.

## Cut these four constellations entirely

**Lore, Crafting, Religion, and Occultism** are twelve talents with essentially no combat use, and
bolting combat effects onto them would destroy what they are. A Crafting constellation whose talents
are all about hitting people is not a Crafting constellation. For a combat playtest, drop them from
the document and say they return in the full book.

That also removes the awkwardness of Backgrounds granting Training in skills the playtest does not
contain.

## Cultures: cut or reskin

All eight Chelaxian and Keleshite talents are social, linguistic, or exploration. If you want cultures
present at all, the honest move is **one combat-relevant talent each** and drop the rest:

| Culture | Replacement talent | Effect |
|---|---|---|
| Chelaxian | **Iron Etiquette** *(rewritten)* | +1 circumstance bonus to Guard against Demoralize and any effect that would make you frightened. |
| Keleshite | **Desert Stride** *(rewritten)* | You ignore difficult terrain caused by sand, rubble, or loose footing, and your first Stride each encounter is 5 feet longer. |

## Replace these, constellation by constellation

| Constellation | Dead talent | Why | Suggested replacement |
|---|---|---|---|
| **Human** | Unbowed | No mind-control effects exist in the playtest | **Stubborn Footing**: the first time each encounter you would be knocked prone, you are not. |
| **Human** | Common Tongue | Languages | **Close Ranks**: while an ally is adjacent to you, both of you gain +1 circumstance to Guard. |
| **Human** | Torchbearer Human *(bloodline)* | Rally and fear, both nearly absent | Keep the name, change the effect: **allies within 15 feet gain a +1 circumstance bonus to their first Defense roll each round while they can see or hear you.** |
| **Human** | Steady the Line ↺ | Frightened is rare | **Steady the Line ↺**: **Trigger** An adjacent ally is Grazed. **Effect** They do not pay the Graze cost. Once per round. |
| **Awareness** | Sweep the Room | Seek is an exploration action | **Call the Opening ◆**: name one Exposed zone on a creature you can see; until the end of your turn, allies may place Hits there too. |
| **Evade** | Light Feet | Traps and hazards | **Sidestep**: when you Yield after an Evade Graze, you move 10 feet instead of 5 and the attacker cannot Follow. |
| **Evade** | Duck and Cover ↺ | Area effects are rare in a duel | **Roll With It ↺**: **Trigger** You are Hit. **Effect** Reduce the damage by your Agility, and you must Yield 5 feet. |
| **Guard** | Resolute | Fear is nearly absent | **Set Stance**: while you have not moved this turn, +1 circumstance bonus to Guard. |
| **Endure** | Stalwart Constitution | Poison and disease are absent | **Shrug It Off**: reduce all persistent damage you take by your Might, minimum 1. |
| **Acrobatics** | Cat Fall | Falling | **Tumbling Retreat ◆**: Step 10 feet instead of 5. |
| **Acrobatics** | Steady Balance | Balancing | **Slip the Grasp**: +2 circumstance bonus to Escape, and Escaping never costs you your Yield. |
| **Acrobatics** | Nimble Crawl | Prone movement | **Kip Away**: when you Stand, you may Step as part of the same action. |
| **Athletics** | Powerful Leap | Jumping | **Bull Rush ◆◆**: Stride, then Shove. |
| **Athletics** | Combat Climber | Climbing | **Wrestler's Grip**: a creature you have Grabbed takes a −2 circumstance penalty to Escape. |

## Keep, unchanged

Everything in the four Combat Styles, both existing Callings, Weapons, and the rest of the four
Defenses. Also keep **Jack of Trades**, which quietly matters now that untrained maneuvers are a real
option, and **Driven**, **Quick Study**, and **Versatile Human**, which are build-time grants rather
than combat effects but shape the character you bring to the table.

## Net effect

Removing four constellations and twelve talents, and rewriting fourteen more, leaves a playtest
document where **every talent a player can take does something in the fight you are testing.** That
is worth more than breadth here: a tester who spends a point on Funerary Rites has spent a point on
nothing and learned you nothing.
