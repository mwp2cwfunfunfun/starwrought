# Postures: choosing *how* you answer a blow

Draft v0.2. Drop-in copy for Answering an Attack, plus two talent additions each to the Evade and
Guard constellations, and a simplification to the Graze costs.

---

# The rules

## Answering a blow

> When something attacks you, you choose **Evade** or **Guard**. You may also take a **posture**: a
> way of throwing yourself into the answer that buys a better result and costs you something whether
> or not it works.
>
> You know one posture for each Defense you are Trained in, free. Others are talents.

## The Graze cost, simplified

> **A Graze always costs the defender, and the cost is not a choice.**
>
> **Evade Graze:** you Yield 5 feet directly away. The attacker may Follow without spending an action.
> **Guard Graze:** you become **Pressed**.

This replaces the old "Yield, or take an Exposed zone" branch. Roughly **43% of all attacks land in
the Graze band**, so removing a decision from that step is worth real table time, and every decision
it removes is one the posture system now makes better.

## The free postures

Granted by the Training root of each Defense, so every character has the choice from level one.
**One posture per round**, whichever Defense you use.

| Posture | Defense | Bonus | Cost |
|---|---|:-:|---|
| **Give Ground** | Evade | +2 | You Yield 5 feet immediately, win or lose. The attacker may Follow without spending an action. |
| **Set Your Feet** | Guard | +2 | You become **Pressed**, win or lose. |

These are simply the Graze cost **paid in advance for a bonus**. A player who understands what a
Graze costs already understands what a posture costs, which means this adds a decision without
adding a rule to learn.

## The talent postures

Bought in the Evade and Guard constellations. **Each costs your reaction**, which rations them
without a new rule and puts them in honest competition with Shield Block and the rest.

### Evade

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Slip the Line ↺** | T | Evade Training | +2 to your Evade against one attack. If the blow does not Hit, you end in any square adjacent to the attacker, your choice. |
| **Drop Flat ↺** | T | Evade Training | +4 to your Evade against **every attack until the start of your next turn**. You end prone. |

### Guard

| Talent | Tier | Requires | Effect |
|---|:-:|---|---|
| **Kneel Behind the Shield ↺** | T | Guard Training | You must have a shield Raised. +4 to your Guard against **every attack until the start of your next turn**. You become Pressed, and your Speed is 0 until you spend an action to rise. |

**Three Evade postures against two Guard postures is deliberate.** See the data below.

---

# Why it is built this way

## Once per round, and free versus bought

I built postures unrestricted and universal first, the obvious way, and measured it.

| | Spread | Evade picked |
|---|---:|---:|
| No postures | **18.7** | 36.0% |
| Postures, unlimited and free to all | **39.7** | 38.2% |
| Once per round | 22.8 | 35.0% |
| Once per round, **Evade only** | 26.2 | **51.6%** |

**Unlimited free postures doubled the spread.** They are not a choice when everyone has them and can
always take one: the cheap ones were taken on **93%** of all postures, so a universal +2 is an
inflation of every defense number in the game, and the strongest build compounds it fastest. Sable
went from 60% to 76%.

That is the case for making the interesting ones **cost talent points**. A universal free bonus is a
tax; a bought one is an investment, which is the shape the rest of the game already has. It also
means two Agility characters with identical point spends can now defend differently, one a
ground-giver and one a diver, which is hard differentiation to buy in a classless game.

**Once per round cost only 4 points of spread** against 19 for unlimited, and turns "always +2" into
"which of these three blows is it worth spending on."

## Why the reaction, and only for the bought ones

Your reaction is the most contested resource on the defensive side: Shield Block, Reactive Shield,
Deflecting Palms, Cover the Angle, Opportune Parry and Steady the Line all want it. Pricing the
**basic** posture in reactions would make it dead text for exactly the players who invested in
defending, which is backwards. Pricing the **big** ones in reactions puts a +4 where a +4 belongs,
next to Shield Block, and rations them for free.

Useful side effect: nearly every reaction talent in the game is Guard-side, so charging reactions
costs Guard builds more than Evade builds, which pushes gently toward the even split measured below.

## Why the +4 postures last a round

As single-blow effects they were **dead text**. Drop Flat was chosen **0%** of the time and Kneel
6.6%. Trading prone, which is −2 Evade, −2 Guard, −2 to your attacks and an action to stand, for +4 on
one roll is never worth it. Applying for the whole round turns them from a bad trade into a
deliberate turtle, which is what somebody about to die should be reaching for. **That version is
untested**; the duration is the dial if it plays too strong.

## Why Evade gets more postures than Guard

This is the useful surprise of the whole exercise. Nothing else I tested this session moved the Evade
pick rate off roughly 36%: not a wider miss band, not damage negation on a success, not symmetric
postures. **Evade-only postures moved it to 51.6%**, the first genuine coin flip that choice has ever
shown.

The reason is structural. **Guard has sources and Evade does not.** Shields give +2, En Garde +1,
Off-Hand Guard +1, Parry +1, and Shield Wall makes the shield free. Evade is the raw number and
subtracts Load Strain on top. Postures are the equipment-free source Evade has been missing, so
weighting them toward Evade is not favouritism; it restores parity of *sources* rather than parity of
size. Guard keeps its equipment, Evade gets its technique.

---

# Housekeeping

## This supersedes three rows of the talent audit

The postures are better replacements than the talents I invented in
`callings-and-combat-talent-audit.md`, because they are about the thing their constellation does:

| Constellation | Dead talent | Audit said | Use instead |
|---|---|---|---|
| Evade | Light Feet | Sidestep | **Slip the Line ↺** |
| Evade | Duck and Cover | Roll With It | **Drop Flat ↺** |
| Guard | Resolute | Set Stance | **Kneel Behind the Shield ↺** |

"Set Stance" is also now redundant, since **Set Your Feet** does the same job free with the root.

## Two notes for the table

**Give Ground must say the attacker may Follow.** Without that clause it is not a cost at all: in a
duel, ceding 5 feet forces the attacker to spend an action closing, which is a third of their turn.
In an early build I left Follow out and Give Ground became the strongest option in the game.

**The free posture and the talent posture do not stack**, and taking either uses your one posture for
the round. A talent posture also costs your reaction on top.

## Dials, in the order I would reach for them

1. Duration of the +4 postures, if turtling proves too strong.
2. Whether the free postures should be +2 or +1.
3. Whether Guard should get a second free posture, if the 50/50 split overshoots toward Evade.
