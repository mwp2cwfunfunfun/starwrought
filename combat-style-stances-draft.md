# Combat Style root stances

Draft v0.1. One stance per style, each hooked into a different mechanic so no two feel alike.
Text is written for the Effect cell in `combat_styles.xlsx`, appended to each existing root.

**Shared preamble**, appended to every Combat Style root after the existing proficiency clause:

> You also learn this style's stance. Entering it takes 1 action, and you can hold only one stance at
> a time.

---

## The four

### Two-Weapon Fighting (Agility)

> **Twin Openings ◆** *(stance)*
> You must have a weapon in each hand. While you are in this stance, the first time each turn that you
> hit the same creature with **both** of your weapons, you may make one of its zones **Exposed**. At
> Master rank, a critical hit with either weapon Exposes a zone on its own.

**Hooks into:** Exposed. This is the only way in the game to create an opening with single actions,
which makes the two-weapon fighter the party's opener: they crack a guard and everyone else drives
through it.

**Why it's balanced:** it needs two hits in one turn, so the multiple attack penalty is already paid
in full, and it grants no damage of its own.

---

### Shield Fighting (Might)

> **Shield Wall ◆** *(stance)*
> You must be wielding a shield. While you are in this stance your shield counts as **Raised at all
> times**, without spending an action for it, but you cannot Stride; you may only Step. At Master
> rank you may Stride up to half your Speed while the stance holds.

**Hooks into:** the action economy. Raising a shield every round is the single most repetitive tax in
the game, and this removes it in exchange for your feet.

**Why it's balanced:** it buys back one action per round, which is enormous, and pays for it with
mobility. A shield-waller who wants to chase someone has to leave the stance and spend the action
again. It also turns them into an objective the enemy can simply walk around, which is the honest
weakness of a phalanx of one.

---

### Brawling (Might)

> **Clinch ◆** *(stance)*
> While you are in this stance, an enemy that Grazes one of your attacks **cannot Yield away from
> you**; if it would Yield, it must take an Exposed zone instead. At Master rank, a creature you have
> Grabbed cannot Recenter.

**Hooks into:** the Graze cost. Nothing else in the game touches the Yield, and denying it is exactly
what a grappler does: you are not getting out of this.

**Why it's balanced:** it removes a choice rather than adding a number, and only on Grazes. The Master
clause is nastier, but Grabbing someone first is a real investment.

---

### Dueling (Agility)

> **The Measure ◆** *(stance)*
> You must wield a single one-handed weapon with your other hand free. Name one creature as you enter
> the stance. That creature must answer your Strikes with the **same Defense it used against your
> previous Strike**, until you leave the stance or name another. At Master rank you may name a new
> creature as a free action.

**Hooks into:** the Evade-or-Guard choice, which is the heart of the whole subsystem. The duelist is
the one fighter who takes that choice away, and the fiction is exactly right: they have your measure.

**Why it's balanced:** it adds nothing to any roll. It just means an opponent who dodged you last time
must dodge you again, so the duelist learns which defense they are up against and their allies can
aim at the other one. Against a foe whose Evade and Guard are close, it barely matters; against a
lopsided build it is devastating, which is a good reason not to be lopsided.

---

## Notes

**Each stance owns one lever**, deliberately: Exposed, action economy, the Graze cost, and the defense
choice. That is what keeps them from collapsing into four different numbers.

**No stance grants a bonus to a roll**, so none of them collide with the standing rule that gear and
talents give traits and effects rather than plusses. Three of the four change what the *opponent* is
allowed to do, which is a good shape for a martial identity and leaves room for the tier talents above
them to do the damage.

**Root Rule compliance is unaffected.** Each root keeps its existing clause about adding the
constellation's proficiency to the checks its talents call for, which is what satisfies both halves of
the rule. The stance is additive, and three of the four scale again at Master anyway.

**Two things to check.**

Shield Wall is the strongest of the four in raw action value and the easiest to misjudge. If it plays
too well, the dial is to make it hold only while you have not moved at all this turn, rather than
allowing a Step.

Dueling already has **En Garde** at Trained, which grants +1 circumstance to Guard with a free hand.
The Measure requires the same grip, so a duelist will run both, which is fine, but it means the free
hand is doing a lot of work in that constellation and you may want a talent later that uses it.

**Where this goes.** These are Effect-cell edits in `combat_styles.xlsx` for the four root talents, and
then the same text in the Chapter 6 tables once the pipeline runs. The Chapter 2 *stance* trait already
covers the "one at a time" rule, so nothing new is needed there.
