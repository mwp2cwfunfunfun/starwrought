# The 1-foot grid, done properly

**Supersedes sections 1 and 4 of `phb-movement-and-space.md`.** Sections 2, 3, and 5 through 10 of
that document stand as written, with the amendments noted at the end.

My case against the fine grid was priced entirely in human counting: 25 cells per Stride, 1,200 cells
per room. Foundry measures distance, drags with a ruler, and highlights reachable squares. That cost
goes to nearly zero, and once it does, the fine grid is simply better. It also unlocks a diagonal rule
I could not have recommended before.

---

# 1. The grid

> **Squares are 1 foot.** Distances in this book are given in feet and measured as written, with no
> rounding to a coarser step.
>
> **Diagonals are measured exactly.** The true distance between two points is what counts. Moving
> diagonally across a square costs about 1.4 feet, and your table or your software works it out.

**Use "Exact" diagonals in Foundry**, under the scene's grid configuration. This is the single biggest
realism win available to you and it now costs nothing. The alternatives are 29% wrong (equidistant,
the fifth edition rule) or 6% wrong (approximate, the 5-10-5 rule), and both of them teach players to
move in diagonals because diagonals are underpriced. Exact measurement kills that permanently.

## Token sizes

Set these once in the actor's prototype token. All values are in grid units, which are now feet.

| Size | Space | Foundry token size | Notes |
|---|---|---|---|
| **Tiny** | 2 ft | 2 × 2 | Can share another creature's space |
| **Small** | 3 ft | 3 × 3 | Two can stand abreast in a 6-foot corridor |
| **Medium** | 5 ft | 5 × 5 | The default |
| **Large** | 10 ft | 10 × 10 | |
| **Huge** | 15 ft | 15 × 15 | |

## What "adjacent" means now

This is the one rule the fine grid genuinely breaks, and a lot of talents depend on it.

> **Adjacent** means your space and theirs are **touching, with no gap at all: 0 feet between them.**
> On the old 5-foot grid this was "the next square over." It now means what it says.

**Zero, not one.** "Within 1 foot" was sloppy of me and you were right to catch it, because on a
1-foot grid it reads as "a 1-foot gap is allowed," which is not what adjacency should ever mean.

**The corner case, which you will hit constantly in Foundry.** Two Medium tokens offset diagonally
touch at a single corner and share no edge. I would **count that as adjacent**, because this one
definition now carries more weight than any other distance in the game: it is what the shortest
weapons require, what Grabbed and squeezing depend on, and what every "adjacent ally" talent points
at. The edge-to-edge distance between diagonal neighbours is genuinely 0 feet, so calling them
non-adjacent would mean two tokens that are touching cannot reach each other.

So: **adjacent means the distance between your spaces is 0 feet, and a shared corner counts as
touching.** If you would rather require a shared edge, that is defensible, and the cost is that a
dagger cannot be used on a diagonal neighbour until someone shifts a foot.

Every talent that reads "an adjacent ally" (*Close Ranks*, *Cover the Angle*, the Recovery check
assist, the Persistent Damage assist) works unchanged once that sentence exists.

---

# 2. Weapon reach

Now that positions are continuous, reach numbers discriminate, and the numbers below are derived
rather than invented.

> **Reach is how far beyond your own space you can strike.** It is measured from the edge of your
> space to the edge of your target's.
>
> Reach is smaller than the weapon is long, because your own space already contains your arm. A
> Medium creature's space is 5 feet across, so 2½ feet of your reach is spent getting to your own
> edge before the blade leaves your square.

**Reach *Adjacent*** means your spaces must be touching, with no gap. It is the same thing as reach 0
feet, and it is worth a word rather than a number so that nobody has to wonder whether 0 means "no
reach at all."

| Weapon | Reach | Real striking distance from the shoulder |
|---|:-:|---|
| Unarmed, dagger | **Adjacent** | About 2½ to 3 ft |
| Shortsword, hatchet | **2 ft** | About 4 ft |
| Mace, club, battleaxe, warhammer | **2 ft** | About 4½ ft |
| Longsword, quarterstaff | **3 ft** | About 5½ ft |
| Rapier | **4 ft** | About 6 ft |
| Greatsword, greataxe, maul | **4 ft** | About 6½ to 7 ft |
| Spear | **6 ft** | About 8½ ft |
| Polearm, halberd | **7 ft** | About 9½ ft |
| Pike, longspear | **12 ft** | About 15 ft |

The third column is there on purpose. A player who reads "longsword, reach 3 feet" will think it is
wrong, and the answer is that the other 2½ feet are inside their own token.

## Two rules that make the numbers matter

You are right that these want to be Traits. Two additions to the **Weapon Traits** table:

> | Trait | Effects |
> |---|---|
> | **Close** | You may attack with it while you are Grabbed, while squeezing, and against a creature you have Grabbed, with no penalty. |
> | **Unwieldy** | You take a −2 circumstance penalty to attack rolls with it against an **adjacent** target, and you cannot attack with it at all while you are Grabbed. |

And the weapons that carry them:

| Weapon | Add the Trait |
|---|---|
| Unarmed Strike | **Close** |
| Dagger | **Close** |
| Spear | **Unwieldy** |
| Polearm, halberd | **Unwieldy** |
| Pike, longspear | **Unwieldy** |

**Traits are the better home for exactly the reason your book already gives**: a Trait plugs a weapon
into a rule written elsewhere. Deriving the rule from the reach number instead would weld the two
together, so every weapon at 6 feet would be clumsy and every weapon at Adjacent would work in a
clinch, with no way to make an exception. As Traits, you can hand out a spear that a particular
culture fights with comfortably, or a rapier balanced for the press, without touching the reach
formula. It also means Foundry can key off the trait, which is how the rest of your traits already
work.

That is the trade the dagger makes: it gives up every inch of standoff, and in exchange it is the only
thing that still works when someone has hold of you. The shortsword is deliberately not **Close**, at
reach 2, so the dagger keeps an identity of its own.

**Unwieldy is severe on purpose.** A grabbed pikeman cannot fight at all, and the answers are the ones
a real pikeman used: keep your distance, break the grab, or carry a knife. That is the whole argument
for a sidearm, and it is the first time this game has made one.

Those two rules are what turn a reach number into a decision. Closing from 6 feet to 1 foot against a
pikeman is now a real tactical goal, worth spending movement on, and the pikeman genuinely wants to
back up. That interaction did not exist on a 5-foot grid and could not have.

**In Foundry**, put the reach value on the weapon item and let it drive the target-range check. A
pikeman's threatened area is a genuine ring rather than a square, which is exactly right and which
the software will draw for you.

## Reach and size

Yes, reach must scale with size, and your fourth row is right: at the bottom of the scale a creature
runs out of reach entirely and has to be inside your space to hurt you.

**But not by a flat −1 per step.** I derived the whole grid from body proportion (a Small creature has
about 65% of a Medium's arm and holds a weapon sized to match; a Tiny one about 30%) and subtracted
each size's own half-space. Subtracting 1 tracks well for short weapons and badly for long ones,
because long weapons lose more in absolute terms when they shrink. A halfling's pike would come out at
11 feet under a flat −1, where the proportions say 8.

**Multiply instead.** Reach scales by size: **Tiny ⅓, Small ⅔, Medium ×1, Large ×1½, Huge ×2.** Round
to the nearest foot, and this matches the derived numbers within a foot almost everywhere. The
multiplication is free because **reach is a build-time number, not a table-time one**: you work it out
once when you make the creature and it sits on the sheet forever. This is the same filter as before,
just pointed the other way. Accuracy is cheap when nobody has to compute it during play.

| Weapon | Tiny | Small | **Medium** | Large | Huge |
|---|:-:|:-:|:-:|:-:|:-:|
| Unarmed, dagger | Adjacent | Adjacent | **Adjacent** | 1 ft | 2 ft |
| Shortsword, hatchet | Adjacent | 1 ft | **2 ft** | 3 ft | 4 ft |
| Mace, club, battleaxe, warhammer | Adjacent | 1 ft | **2 ft** | 3 ft | 4 ft |
| Longsword, quarterstaff | 1 ft | 2 ft | **3 ft** | 4 ft | 6 ft |
| Rapier | 1 ft | 2 ft | **4 ft** | 6 ft | 8 ft |
| Greatsword, greataxe, maul | 1 ft | 2 ft | **4 ft** | 6 ft | 8 ft |
| Spear | 2 ft | 4 ft | **6 ft** | 9 ft | 12 ft |
| Polearm, halberd | 2 ft | 4 ft | **7 ft** | 10 ft | 14 ft |
| Pike, longspear | 4 ft | 8 ft | **12 ft** | 18 ft | 24 ft |

**Only the Medium column belongs in the book.** Equipment prints one reach per weapon and every other
size is worked out from it, so there is no per-size table that can drift away from the formula. The
grid above is generated from the rule rather than authoritative, and is here only so you can
sanity-check the shape of it.

### Why the big sizes look stingy, and why they are not

You are reading a real thing, but it is a presentation problem rather than a maths problem. **The
bigger the creature, the more of its reach is hidden inside its own token.**

| Size | Footprint half-width | Actual body half-width | Reach swallowed by the token |
|---|:-:|:-:|:-:|
| Medium | 2.5 ft | about 1 ft | 1.5 ft |
| Large | 5 ft | about 1.7 ft | **3.3 ft** |
| Huge | 7.5 ft | about 2.5 ft | **5 ft** |

A ten-foot ogre does not physically occupy ten feet of floor. It occupies maybe three and *controls*
ten. So when you measure from the edge of its space, five feet of its reach has already been spent
getting out of its own square, and the printed number is what is left over.

Check it from the centre instead and the progression is enormous:

| | Medium | Large | Huge |
|---|:-:|:-:|:-:|
| **Fists**, total threatened radius from centre | 2.5 ft | **6 ft** | **9.5 ft** |
| **Greatsword**, same | 6.5 ft | **11 ft** | **15.5 ft** |
| **Spear**, same | 8.5 ft | **14 ft** | **19.5 ft** |

Large fists cover 2.4 times the radius of Medium fists, which is nearly six times the area. Against
body proportion, Large unarmed is already **slightly generous** (6 ft where proportion predicts 4.6),
so bumping it would make the model less accurate rather than more.

### The question actually hiding underneath this

What you probably want to know is: **can a big creature reach past the front line to hit the archer?**
A Medium defender's footprint is 5 feet, so the answer is whether the creature's reach is 5 or more.

| Large creature wielding | Reach | Reaches past a front-liner? |
|---|:-:|---|
| Fists | 1 ft | No |
| Shortsword | 3 ft | No |
| Longsword | 4 ft | No |
| **Greatsword** | 6 ft | **Yes** |
| **Spear** | 9 ft | **Yes** |
| **Polearm** | 10 ft | **Yes** |

That is a good outcome and worth keeping: an ogre has to pick up something big before it can swat the
people behind your shield wall, which makes "the ogre grabs a tree" a genuine escalation rather than
scenery.

### If you still want a dial

Do it per creature rather than per size, and do it as a Trait, which is where you wanted these rules
anyway:

> | Trait | Effects |
> |---|---|
> | **Long Limbs** | Add 2 feet to the reach of its unarmed attacks and any weapon it wields. |

Hang that on the specific monsters that should feel reachy, apes and trolls and anything built around
arms, and leave the ordinary giant alone. It is one number on one creature instead of a change to the
whole scale, and it will not drift.

## The Tiny rule dissolves entirely

The traditional "a Tiny creature must enter your square to attack" was a **5-foot-grid artifact**, in
exactly the way the reach trait was. It existed because a Tiny creature shared your square, so
adjacency was meaningless for it. On a 1-foot grid a rat can stand beside your boot and bite your
ankle without being inside you, and the rules should say so.

Under the rounding rule, anything that would scale down past zero simply becomes **Adjacent**, so
**nothing in the game requires entering a target's space any more.** Your fourth row is retired along
with the artifact that produced it, which is cleaner than the "unarmed only" carve-out I first
proposed.

Worth knowing rather than fixing: that also means a swarm or an ooze cannot be given "must be in your
space" as a property later without writing a new rule for it.

**This also replaces the "natural reach by size" line** in the conversion table further down, which
gave Small and Medium creatures 5 feet and Large 10. That row can go: a creature's reach is now
whatever it is holding, scaled to its size, and nothing else.

---

# 3. What the fine grid changes elsewhere

Everything below is currently written in 5-foot steps because the old grid forced it. Most of it wants
a new number.

| Rule | Currently | Suggested |
|---|---|---|
| **Step ◆** | Move 5 feet | **Move 3 feet.** A Step is one adjustment of the feet, not a stride, and 5 feet was always the grid talking |
| **Leap ◆** | 10 ft horizontal, 3 ft vertical | Unchanged. These were already real measurements |
| **Crawl ◆** | 5 feet | **3 feet** |
| **Shove** | 5 ft, 10 ft on a critical | Unchanged |
| **Reposition** | 5 ft, 10 ft on a critical | Unchanged |
| **Difficult terrain** | Each square costs 2 | **Each foot costs 2 feet of movement.** Same rule, finer unit |
| **Greater difficult** | Each square costs 3 | **Each foot costs 3** |
| **Hazardous** | 1 damage per square | **1 damage per 5 feet entered**, or it becomes punishing at this resolution |
| **Take Cover, Seek, Point Out** | 30 ft ranges | Unchanged |
| **Panache** | Speed +5 ft | Unchanged |
| **Natural reach by size** | Small and Medium 5 ft, Large 10 ft | **Delete the row.** Superseded by the reach-and-size table above: a creature's reach is whatever it holds, scaled to its size |
| **The reach trait** | "Threatens at 10 feet rather than 5" | **Delete it.** Every weapon now has a reach number, so the trait has nothing left to say |

**The hazardous-terrain change is the one that would have bitten you.** At 1 damage per square, a
1-foot grid turns a 10-foot patch of caltrops into 10 damage, which is half a first-level character.
Per 5 feet keeps it at the intended sting.

---

# 4. The one cost Foundry does not remove

**This makes STARWROUGHT a virtual-tabletop game.** Not partly, entirely. A 1-foot grid with exact
diagonals and 1-foot reach bands cannot be run on a battlemat with miniatures, and cannot be run in
the theatre of the mind at all, because no player can eyeball whether a 4-foot rapier reaches a target
7 feet away.

That may be exactly what you want, and if the campaign lives in Foundry it costs you nothing. But it
is worth deciding on purpose rather than discovering later, because it closes two doors: playing a
session at a kitchen table, and ever publishing this for people who do not use a VTT.

**If you want to keep those doors open**, the cheap insurance is a sidebar rather than a compromise:

> **Playing without a virtual tabletop.** Round every distance to the nearest 5 feet and treat all
> weapons as reach 2, except spears, polearms and pikes, which are reach 7. Diagonals cost 1½ squares.
> You will lose the fine tactics of closing inside a long weapon, and nothing else.

One paragraph, and the game survives away from the screen.
