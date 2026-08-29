# Exposed as the single Graze cost, and the Guard zone

Draft v0.1. Your change, tested three ways, with one adjustment that matters a lot.

**Methodology caveat first:** these runs use a stripped simulator without the maneuver layer, so the
absolute spreads (37 to 55) are not comparable to the 19 to 20 figures from the full playtest. Only
the comparisons **within** this run are meaningful.

---

# The rules

## Guarding with a zone

> **When you Guard, you guard with something, and that something is a part of you.** Which zone you
> guard with is not a free choice; it follows from how you are guarding.

| You are guarding with | Zone |
|---|---|
| A shield, or a weapon with *parry* | **Arms** |
| A braced two-handed weapon | **Legs** |
| Nothing in hand, turning the blow aside | **Torso** |
| A ducked head and shoulder | **Head** |

## The Graze cost

> **A Graze always opens you up. One of your zones becomes Exposed.**
>
> **Guarding:** the zone you were guarding with. Your guard was driven out of line there.
> **Evading:** a zone of your choice. You twisted away, and you decide what you left open.

## Exposed, expanded

> **Exposed [zone].** That part of you is open: the armor there is displaced or your guard no longer
> covers it.
>
> - **That zone's Protection counts as 0.**
> - An ordinary **Hit** may be placed there instead of the torso.
> - It stays Exposed until you **Recenter ◆**.

**Pressed is retired.** Exposed does its job and does it better, because it interacts with armor and
with zones. See the housekeeping section for the talents that need rewording.

---

# What the numbers said

## Adopt the change: it fixes the two things I complained about

The original playtest found that **over 90% of damage landed on the torso**, three of four zones were
decorative, and **nobody ever wanted to Recenter**. Making Exposed the Graze cost fixes both at once.
Recenter went from never being used to **0.16 to 0.5 times per round**, and zones became live because
they open constantly.

It also does not cost balance. With the weakness floor fixed and Might back in damage:

| | Spread |
|---|---:|
| No Exposed change (control) | 46.6 |
| **Exposed as the Graze cost** | **38.6** |

It **improved** the spread by 8 points, because opening zones hurts the heavily armored more than the
lightly armored, which pushes against the armor advantage rather than with it.

## Exposed must zero the zone's Protection

That clause is what gives it teeth:

| | Spread |
|---|---:|
| Exposed zeroes that zone's Protection | **38.6** |
| Exposed only lets Hits land there | 46.5 |

Without it, Exposed does nothing to a character whose torso is the only thing worth hitting anyway.

## The Guard zone: how you read it is worth 17 points of spread

Three readings, measured:

| Reading | Spread | Evade picked | Verdict |
|---|---:|---:|---|
| Declaration **steers Hits** onto that zone | **54.5** | 31.0% | Too expensive |
| **Free choice** of zone | 39.5 | 33.2% | Loophole |
| **Your method dictates** the zone | **37.0** | **33.1%** | Best of all three |
| (no declaration at all, for reference) | 38.3 | 31.5% | |

**Steering Hits onto your guarded zone costs 17 points of spread.** It reads well ("I take it on the
breastplate") but it is a benefit that scales with how good your armor is, so it amplifies the gap
between the armored and the unarmored. Tover and Bear went to 73% and 70%; Quill fell to 18%.

**Free choice has a loophole.** You declare the zone you care least about, the Graze opens a zone
with no armor on it, and the cost is nearly free. The tell in the data is that Recenter usage
collapsed to 0.16 per round, because nothing worth protecting ever opened.

**Letting your method dictate the zone closes both problems** and came out slightly better than
having no declaration at all, while nudging Evade's share up. It also cannot be gamed, because you do
not choose it, your shield does.

## Saturation is not a problem

I expected Exposed to pile up and become meaningless, since 43% of attacks Graze. It does not.
Average zones open sat at **0.77 to 0.84** across every version, because a Guard user re-opens the
**same** dictated zone rather than accumulating new ones, and fights end around round three anyway.
Even with Recenter switched off entirely it only reached 3.2 open zones by round five, well past when
most fights finish.

## The best payoff is a build one

Because your guard method dictates your zone, **the zone you need armor on follows from how you
fight.** A shield fighter's Arms open every time their guard is driven out of line, so vambraces
matter to them specifically. A braced great-weapon fighter wants greaves. That gives all four zones
distinct build relevance, which is precisely what the dormant-zone finding was missing.

---

# Housekeeping

## Talents that need rewording now that Pressed is gone

| Talent | Was | Becomes |
|---|---|---|
| **Unshaken** (Guard) | The first time you would become Pressed, you do not. | The first time each encounter a Graze would Expose a zone on you, it does not. |
| **Cover the Angle ↺** (Guard) | ...You become Pressed. | ...The Graze cost falls on you instead of them, opening your guard zone. |
| **Set Your Feet** (free Guard posture) | +2, you become Pressed. | +2, your guard zone becomes Exposed immediately, win or lose. |
| **Give Ground** (free Evade posture) | +2, you Yield 5 feet. | +2, a zone of your choice becomes Exposed immediately, win or lose. |
| **Clinch** (Brawling stance) | An enemy that Grazes you cannot Yield away. | An enemy that Grazes one of your attacks cannot choose which zone opens; you choose it. |
| **Opportune Parry ↺** (Bravado) | You do not pay the Graze cost. | Unchanged, and now clearer: no zone opens. |

## Two things this also removes

**Yield and Follow disappear** from the Graze rules. That also removes the trap I flagged with Give
Ground, where ceding 5 feet cost the attacker an action and made the posture the strongest option in
the game.

**The Evade Graze branch is gone.** It used to be "Yield, or take an Exposed zone." Now it is simply
"choose a zone," which is one decision rather than two on 43% of all attacks.

## Untested, and worth watching

Whether **Recenter should clear all Exposed zones or only one**. Clearing all is generous now that
zones open constantly; clearing one makes a shield fighter with an open arm spend an action a round
just keeping up. I would start with all and tighten if turtling never happens.

Whether the **Head** should be dictated by anything. As written, nothing routinely opens it, which
makes helmets the least valuable purchase. A ducking posture, or Awareness-based guarding, could give
it a home.
