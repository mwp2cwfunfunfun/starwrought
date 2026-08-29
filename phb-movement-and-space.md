# Encounter movement, space, and terrain

Drop-in rules for the eight areas you listed, written against one filter.

> **Pay for realism where the decision is, not where the counting is.**
>
> A realistic rule that changes *what a player chooses* is nearly free: they were going to think for
> a moment anyway. A realistic rule that changes *what a player counts* is expensive, because it taxes
> every turn of every fight forever. Every call below is made on that basis.

---

# 1. The grid, and the honest answer about 1 foot

You asked for two things that are really the same thing, and they stand or fall together: a 1-foot
grid, and weapons with a reach in feet. Here is what each costs.

## What a 1-foot grid costs

| | 5-foot grid | 1-foot grid |
|---|---:|---:|
| Cells a Speed 25 character counts per Stride | 5 | **25** |
| Cells in an ordinary 30 by 40 foot room | 48 | **1,200** |

That is a 25-fold increase in counting, on the single most frequent action in the game, paid on every
turn by every player forever. It is the most expensive thing you could buy with cognitive load, and
what it buys is precision in a place where nobody is making a decision.

## What weapon reach in feet buys on a 5-foot grid

Nothing, and this is the part worth seeing plainly. Two Medium creatures in adjacent squares have
**zero feet** between their spaces. So:

| Reach | Squares it threatens |
|---|---|
| 3 ft | 1 |
| 5 ft | 1 |
| 6 ft | 2 |
| 7 ft | 2 |
| 8 ft | 2 |
| 10 ft | 2 |

A dagger at 3 feet and a longsword at 5 feet behave identically. A greatsword at 6 feet behaves like
a pike. **Reach numbers in feet only mean anything on a fine grid or with no grid at all**, which is
precisely why the fine grid was tempting.

## What I recommend instead

**Keep the 5-foot grid for movement. Use feet for everything that is not counted.**

> Squares are 5 feet. Count movement in squares, as you always have. **Feet are used for reach, for
> the space a creature occupies, for cover, and for how tight a gap is**, because those are questions
> you ask occasionally and answer once, not things you count every turn.
>
> If your battlemat has 1-foot subdivisions, use them for exactly those questions. If it does not,
> nothing is lost.

And then get the realism you actually wanted from weapon reach a different way, described in section
4: **not how far a weapon reaches, but how badly it works when the enemy is inside its reach.** That
is the thing D&D has always missed, it is more realistic than a reach number, and it costs zero
counting.

---

# 2. Speed and movement

> **Speed** is how far you move with a single **Stride ◆**, in feet. A creature with Speed 25 covers
> five squares.
>
> | Size | Typical Speed |
> |---|---|
> | Small | 20 ft |
> | Medium | 25 ft |
> | Large | 30 ft |
>
> Speed is set by your Ancestry, not your size, and several Ancestries break the pattern.
>
> **Diagonals.** Moving diagonally costs **1.5 squares**, so two diagonal squares cost three. Track
> the half and drop any leftover fraction at the end of the move.

**Why 1.5 rather than 1.** A true diagonal is 1.414 squares. Counting it as 1, the way fifth edition
does, is **29% wrong**, and it is wrong in a direction players learn to exploit: everyone moves in
diagonals because they are free. Counting it as 1.5 is **6% wrong** and removes the exploit. It is the
one place a fraction earns its keep, because Speeds are all multiples of 5 and the arithmetic
resolves on whole squares almost every time.

---

# 3. Size, space, and reach

> | Size | Space it occupies | Squares | Natural reach |
> |---|---|---|---|
> | **Tiny** | 2½ ft | Shares a square | 0 ft (must enter your space) |
> | **Small** | 3 ft | 1 | 5 ft |
> | **Medium** | 5 ft | 1 | 5 ft |
> | **Large** | 10 ft | 4 (2 by 2) | 10 ft |
> | **Huge** | 15 ft | 9 (3 by 3) | 15 ft |
>
> **A Small creature occupies a 5-foot square but only fills 3 feet of it.** That is why two Small
> creatures can share a square, why a Small creature can slip through a 3-foot gap without squeezing,
> and why it is a harder target: it is not standing where the square says it is.
>
> **Tiny creatures do not hold a square at all.** They share yours, and they must be in your space to
> reach you.

That one line about Small creatures is where your 3-by-3 idea pays off. It costs nothing to count and
it explains the +1 Evade you already give them.

---

# 4. Weapon length, and the clinch

This is the realism you were reaching for with reach-in-feet, delivered without the grid cost. A
weapon's length stops being about how far it reaches and starts being about **whether you can bring
it to bear**.

> Every melee weapon has one of three lengths. Most weapons are **Hand**, and say nothing.
>
> | Length | Examples | Rule |
> |---|---|---|
> | **Close** | dagger, unarmed, shortsword | You may attack with it while **Grabbed**, while squeezing, or against a creature you have Grabbed, with no penalty. |
> | **Hand** | longsword, mace, battleaxe, greatsword | The default. No modifier. |
> | **Long** | spear, polearm, pike | Threatens at **10 feet**. You take a **−2 circumstance penalty** to attack rolls against an adjacent creature, and you cannot use it at all while Grabbed. |
>
> A pike is a wall of points at ten feet and a length of firewood at two. Getting inside a long
> weapon is a real tactic, and closing the distance is worth an action.

**Why this is the better trade.** It creates three decisions (do I close? do I carry a backup? do I
hold the line?) where a reach number in feet created none, and it does not add a single thing to
count. It also gives *Turn the Weapon* and the carrying of a sidearm a second reason to exist.

The existing **reach** trait becomes the **Long** length. The **grapple**, **trip**, **shove** and
**disarm** traits are unaffected.

---

# 5. Moving through spaces

> - **An ally's space is difficult terrain** for you. You can get past each other; it just costs.
> - **You cannot move through an enemy's space** unless you **Tumble ◆**, or unless the two of you
>   differ by two or more sizes, in which case their space is difficult terrain.
> - **Squeezing.** To pass through a gap narrower than your space but at least half of it, move at
>   half Speed and be **Off-Guard** until you are clear. A gap smaller than half your space stops you.
> - **Objects.** A low wall, a table, or a rail is difficult terrain to cross. Anything higher than
>   your waist requires a **Leap** or an **Athletics** check.

---

# 6. Forced movement

> **Forced movement** is any movement someone else causes: Shove, Reposition, a blast, a collapsing
> floor.
>
> - Forced movement **never provokes reactions**. You did not choose to go.
> - It **does not cost you actions** and is not limited by your Speed.
> - **Difficult terrain does not slow forced movement.** You are not picking your way; you are being
>   put there.
> - If the movement would take you into a solid obstacle, **you stop there and take 2 damage for
>   every 5 feet of movement that did not happen.** Being driven into a wall hurts, and it is why
>   fighting with your back to one is a decision.
> - If it would take you into another creature's space, you stop in the last space you could occupy.
> - **It can take you off a ledge.** Nothing stops it. This is what makes a Shove terrifying in the
>   right room, and it is worth the GM saying out loud where the drops are.

The wall-slam rule is the one worth keeping. It is realistic, it is one line, and it turns every
battlemap's geometry into something the players read before they act.

---

# 7. Terrain

> | Terrain | Cost | Looks like |
> |---|---|---|
> | **Difficult** | Each square costs 2 | Rubble, undergrowth, shallow water, a crowd, an ally's space |
> | **Greater difficult** | Each square costs 3 | Deep snow, thick mud, a steep scree slope, waist-deep water |
> | **Hazardous** | Difficult, and 1 damage per square entered | Broken glass, embers, caltrops, brambles |
>
> **You cannot Step into difficult terrain of any kind.** A Step is a careful adjustment of your
> footing, and difficult ground is exactly where you cannot make one.
>
> Terrain does not slow forced movement, a Leap that clears it, or anything that does not touch the
> ground.

**Hazardous is the new one and it is worth having.** It gives a GM a way to make a floor matter
without inventing a trap, and 1 damage per square is small enough that players will still cross it
when they need to, which is the point.

---

# 8. Cover and concealment

These are two different things and the book should say so once, plainly, because players confuse them
constantly.

> **Cover is about something solid between you.** **Concealment is about not being clearly seen.**
> One stops the blow; the other spoils the aim. They are different bonuses and they stack, because
> they are different problems.
>
> **Finding cover.** Draw a line from the centre of the attacker's space to the centre of yours. If
> it passes through an obstacle, you have cover.
>
> | | Bonus | When |
> |---|---|---|
> | **Cover** | +2 circumstance to your Defense | A low wall, a pillar, a table, a creature between you |
> | **Greater cover** | +4 circumstance to your Defense | An arrow slit, a doorway you are edged behind, a wall with only your head out |
> | **Concealed** | +2 circumstance to your Defense | Fog, dim light, smoke, a blur |
>
> **Take Cover ◆** turns Cover into Greater cover, and lasts until you move or attack. A **tower
> shield** lets you Take Cover with no wall at all.
>
> Cover applies to **whichever Defense you roll**, because a pillar between you does not care whether
> you were dodging or blocking. But cover, a raised shield, and Concealed are all **circumstance**
> bonuses, so only the largest of them applies. That is the rule that keeps this from stacking into
> nonsense, and it means a shield wall behind an arrow slit is not four separate bonuses.

**One correction to what is in v2.4.** *Take Cover* currently gives its bonus to **Evade** only, which
means a Guard-focused character gains nothing from standing behind a pillar. That reads as an
oversight rather than a design, since Guard is already the Defense that a shield improves.

---

# 9. Flanking

> **You flank a creature when you and an ally are on opposite sides of it, both within reach and both
> able to act.** Draw a line from the centre of your space to the centre of your ally's; if it passes
> through opposite sides of the target's space, it is a flank.
>
> **A flanked creature is Off-Guard**, which is a −2 circumstance penalty to its Evade and Guard, and
> is the condition Sneak Attack cares about.
>
> A creature is not flanked if it cannot be caught out: if it is immune to Off-Guard, or if it has no
> back to speak of.

**I would not add a second flanking rule.** Off-Guard is already worth a great deal in your system
(it is a −2 to both Defenses, it powers Sneak Attack, and it is what *Knife in the Dark* keys off),
and stacking a Zone effect on top would make flanking mandatory rather than tactical. This is the
place where the cheapest realism is the realism you leave out.

---

# 10. Falling

> **Falling damage equals the distance fallen in feet, minus 5**, to a maximum of 150. A drop of five
> feet or less does nothing.
>
> - An **Evade** check against a Threshold of **15** halves the damage. You saw the ground coming and
>   went with it.
> - You land **prone**.
> - Landing in deep water, on a body, or on anything genuinely soft counts the fall as 20 feet
>   shorter.
> - If you fall onto a creature, it takes half of what you take, and you both land prone.
> - **Falling is not gentle in STARWROUGHT.** A three-storey drop will kill a first-level character
>   who fails the check. Rooftops are a real risk and should be described as one.

**The numbers, so you can price it:**

| Fall | Damage | 1st-level Ambusher (20 HP) | 5th-level Berserker (70 HP) |
|---|---:|---|---|
| 10 ft | 5 | 15 left | fine |
| 20 ft | 15 | 5 left | fine |
| 30 ft | 25 | **dead** | 45 left |
| 50 ft | 45 | dead | 25 left |
| 100 ft | 95 | dead | dead |

That 30-foot line is roughly where real falls turn fatal, which is the point. The Evade check is the
dial: it turns a lethal 30-foot fall into a survivable 12. If it plays too harshly, halve the base
before the check rather than raising the Threshold.

---

# What this costs a player, all in

The whole package adds **one** thing to count that was not there before: the 1.5-square diagonal. That
is it. Everything else is a question asked when it comes up and answered once.

| Rule | Counted every turn? |
|---|---|
| Diagonals cost 1.5 | **Yes.** The only one |
| Weapon length | No. Read off your sheet once |
| Size and space | No. Set when the creature appears |
| Squeezing, moving through spaces | No. Only at the gap |
| Forced movement, wall slams | No. Only when shoved |
| Terrain | No. The GM says so when you enter it |
| Cover, concealment, flanking | No. Asked at the moment of the attack |
| Falling | No |

Compared to a 1-foot grid, which would have added twenty-five things to count per Stride and given
you weapon reach numbers that mostly duplicate each other.
