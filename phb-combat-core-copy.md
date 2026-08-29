# Combat core: drop-in copy for PHB v1.4

Covers asks #11 (player-facing rolls) and #17 (Striking & Defending, Graze, Exposed, Pressed,
Recenter). Written to slot into Chapter 2. Equipment (Chapter 4) will supply the armor pieces that
these rules reference.

---

## A. Replaces the "Who rolls?" list in *Checks vs. Defenses*

> **You roll. Always.** The GM sets numbers; the players roll dice. Whether you are swinging an axe
> or answering one, whether the danger is a bandit or a burning rafter, the die is in your hand.
>
> - **You act.** You climb, lie, pick a lock, swing an axe. Roll the relevant check against the
>   number the GM gives you.
> - **Something comes at you.** A blade, a spell, a collapsing floor, a slow poison. Roll the Defense
>   you are answering it with, against that threat's number.
>
> The four degrees always read from the point of view of whoever is holding the die. **The better you
> roll, the better it goes for you.** That one sentence covers both halves of every fight.

---

## B. Replaces *Attacking & Defending*

> There are a multitude of ways you can attack your foes, and they have just as many for you. There
> are four ways to answer them.
>
> Your four **Defenses** are constellations like any other, and your character begins play Trained in
> all four. Each one works two ways. When a foe comes at you, you roll it to keep them out. When a
> trap, a poison, or a spell tests you, you roll it to endure them. One number, one formula, either
> direction.

| Defense | Attribute | In a word | Answers an attack when you… | Also the check against |
|---|---|---|---|---|
| **Awareness** | Wits | Don't be surprised. | (never; trickery is its business, not blows) | Sneak, Feint, Lie, illusions, initiative |
| **Evade** | Agility | Don't be there. | slip aside from it | blasts, traps, collapsing floors |
| **Guard** | Presence | Don't let it through. | meet it with weapon, shield, or braced arm | fear, charm, confusion |
| **Endure** | Might | Survive what does. | (never; it answers what a defense cannot stop) | poison, disease, exhaustion, dying |

> Three kinds of threat, three answers. **Physical attacks**, whether a sword or a shove, are answered
> by Evade or Guard. **Trickery** is answered by Awareness. **The slow and the invisible**, poison and
> plague and exhaustion, are answered by Endure.
>
> When a physical attack comes at you, **you choose Evade or Guard.** That choice is not about which
> number is higher. It is about what you are willing to lose if the defense proves imperfect: Evade
> gives up ground, Guard gives up posture. Awareness and Endure are never chosen. They answer when the
> moment calls for them.
>
> Neither Evade nor Guard is always there. You cannot slip a blow while you are grabbed, restrained,
> or immobilized, and you cannot meet one you never saw coming, or with nothing in your hands and no
> hand free. **Those limits apply to attacks only.** Against poison, fear, blasts, and everything that
> is not aimed at you by a creature, all four Defenses are always available.

---

## C. New: *Striking & Defending*

### Making an attack

> Choose your weapon and Strike. Roll **Weapons** against the target's Defense. Your multiple attack
> penalty applies as normal on your second and third Strikes in a turn.

| Your roll vs their Defense | Result |
|---|---|
| Beat it by 10+ | **Critical hit.** Double damage, plus critical effects. You choose where it lands. |
| Meet or beat it | **Hit.** Full damage, to the torso unless a zone is Exposed. |
| Miss it | **Graze.** Half damage, and they pay a Graze cost. They choose where it lands. |
| Miss it by 10+ | **Miss.** Nothing. |

### Answering an attack

> Every attack a creature can make has a **number**. When it comes at you, choose Evade or Guard and
> roll. You are rolling to get out of the way, and how well you roll decides how little of it reaches
> you.

| Your Defense roll vs the attack's number | Result |
|---|---|
| Beat it by 10+ | **Miss.** Nothing touches you. |
| Meet or beat it | **Graze.** Half damage, and you pay the Graze cost below. |
| Miss it | **Hit.** Full damage, to your torso unless one of your zones is Exposed. |
| Miss it by 10+ | **Critical hit.** Double damage, and the attacker chooses the zone. |

> **A Graze carries no riders.** Precision damage, deadly, critical specialization, and persistent
> damage never apply on a Graze. Halve the weapon's base damage, apply Protection, and move on.

### Maneuvers are attacks

> Grapple, Shove, Trip, and Disarm are attacks like any other. The attacker rolls Athletics (or the
> relevant skill); the defender chooses **Evade or Guard** and answers it exactly as they would a
> sword. Dodge the grab, or meet it and hold your ground.

| Your Defense roll vs the maneuver's number | Result |
|---|---|
| Beat it by 10+ | **Miss.** It fails badly. The attacker overcommits and is off-guard until their next turn. |
| Meet or beat it | **Graze.** The maneuver has no effect, **but you still pay the Graze cost below.** |
| Miss it | **Hit.** The maneuver works: grabbed, shoved 5 feet, tripped prone, or disarmed. |
| Miss it by 10+ | **Critical hit.** It works and then some: restrained instead of grabbed, shoved 10 feet, prone and off-guard, or the weapon flies out of reach. |

> That middle band is where a shield press is won. A Shove that Grazes moves you nowhere, and still
> drives your guard out of line, which is why grinding at a defender works even when nothing visibly
> happens.

### The cost of a Graze

> A Graze means the defense mostly worked. Mostly is not entirely, and each defense pays in its own
> coin.

> **Evade: yield or open yourself.** Move 5 feet directly away from the attacker. The attacker may
> Follow into the space you left without spending an action; yielding is never a free disengage. If
> you cannot or will not Yield, the attacker makes one of your zones **Exposed**.
>
> **Guard: hold and be Pressed.** You keep your ground and your guard is driven out of line. You are
> **Pressed** until the end of your next turn. Pressed does not stack with itself.

### Where the blow lands

> The body has four zones: **Head, Torso, Arms, and Legs.** Attack quality decides who controls where
> a blow lands, and the better the attack, the more say the attacker has.

| Result | Who chooses the zone |
|---|---|
| Critical hit | The attacker, freely |
| Hit | Nobody. The torso, unless a zone is Exposed, in which case the attacker may use it |
| Graze | The defender |
| Miss | Nobody |

### Protection

> Armor does not make you harder to hit. It decides how much of a blow your body actually feels.
> **Each zone has its own Protection**, from whatever you are wearing there, and Protection subtracts
> from the damage of every instance that lands on it, a Graze included.
>
> Most rounds you will use one number, because ordinary Hits go to the torso. The other three zones
> matter when somebody has earned an opening.
>
> **Bludgeoning damage ignores 2 points of Protection.** That is the whole of the anti-armor rule:
> the mace is the answer to plate.

### Openings: Exposed and Recenter

> **Exposed [zone].** That part of you has been opened by posture, position, or a maneuver. An
> ordinary Hit may be placed there instead of the torso. Exposure is binary per zone, does not stack,
> and persists until it is cleared.
>
> **Recenter ◆.** Gather yourself: clear every Exposed zone and end Pressed.

> **There is no called shot.** You never take a penalty to aim at a body part. Precision is bought
> with time.

| Actions spent attacking | What it buys |
|---|---|
| 1 action | A quick attack. Cannot create Exposed. |
| 2 actions | A deliberate attack. On a **critical hit**, you may Expose a plausible zone. |
| 3 actions | A committed attack. On a **hit or a critical hit**, you may Expose a plausible zone. |

> Maneuvers open people up too. A Trip Exposes the Legs, a bind or Disarm the Arms, a Feint the Head.
> Use Exposed for all of them rather than inventing a new condition each time.
>
> When a Hit lands on an Exposed zone, the attacker chooses **full damage**, or **half damage and the
> zone's effect**:

| Zone | Effect |
|---|---|
| Head | Dazzled until they Recenter, or Dazed 1 on a critical hit |
| Arms | −2 circumstance to their attack rolls until they Recenter, or one free Disarm attempt |
| Legs | Speed halved until they Recenter; knocked prone on a critical hit |
| Torso | One extra weapon damage die |

### Size

> **Small creatures gain +1 Evade and −1 Guard. Large creatures gain −1 Evade and +1 Guard.** A small
> fighter is a harder target and a worse wall: they can slip a shove far more easily than they can
> brace against one. A large one is the reverse, and hard to move at all.

---

## D. Add to the actions table

| Action | Effect |
|---|---|
| **Recenter ◆** | Clear all Exposed zones on yourself and end Pressed. |

And these corrections to rows already there:

| Row | Change to |
|---|---|
| Grapple / Shove / Trip ◆ | Athletics check vs. the target's **Evade or Guard**, their choice |
| Demoralize ◆ | Intimidation vs. the target's **Guard**: frightened 1 (2 on a crit) |
| Feint ◆ | Deception vs. the target's **Awareness**: off-guard to your next melee attack |
| Escape ◆ | Break a grab: your best of Athletics or Acrobatics vs. the grabber's **Evade or Guard** |
| Aid ↺ | Beat **the GM's number** on a relevant check you prepared for: ally gets +1 (+2 on a crit) |

---

## E. Add to the conditions table

| Condition | In one line |
|---|---|
| **Exposed [zone]** | That zone is open: ordinary Hits can land there instead of your torso. Recenter ◆ to clear. |
| **Pressed** | −2 circumstance to Guard until the end of your next turn. Does not stack. |

---

## F. New sidebar: running printed monsters

> **Pathfinder 2E stat blocks work with two small conversions.**
>
> **A monster's Defense is its printed AC.** Roll your Strike against that number. Monsters do not
> choose between Evade and Guard; that decision belongs to the players.
>
> **A monster's attack number is its printed attack bonus plus 12.** An orc with a greataxe at +9
> attacks with **Greataxe 21**. You roll Evade or Guard against 21. Its multiple attack penalty
> lowers that number as normal, so its second swing is 16 and its third is 11.
>
> Everything else runs as printed: hit points, damage, DCs, saves (a Fortitude save is an Endure
> check, Reflex is Evade, Will is Guard), and the level-based DC tables. Monsters have Protection only
> if their gear line says they wear armor; most creatures have none.

**Design note, not for the book.** I checked the +12 offset across low, mid, and high level and
against all four degree bands. Every band lands within 2.5 percentage points of the printed odds, and
expected incoming damage runs between +0% and +6%, averaging about +3%. The obvious guess of +10
would have handed players a 10 point safety margin at every level.

---

## G. Knock-ons from maneuvers moving to Evade and Guard

**Endure Training's root text must lose a clause.** It currently claims to be "the number that
Grapple, Shove, Trip, and Disarm attempts are measured against." Delete that. The root becomes:

> You are Trained in Endure: add this constellation's proficiency to your Endure checks against
> poison, disease, exhaustion, and anything else trying to break your body from the inside. You also
> reduce your Load strain and your armor's check penalty by 1 each, rising to 2 at Expert rank, 3 at
> Master, and 4 at Legendary.

**Braced Frame moves from Endure to Guard**, and rewords to *"+2 circumstance bonus to Guard against
Shove, Trip, and Reposition."* Bracing against force is what Guard is for.

**Endure now has no frequent job, and that needs watching.** Evade and Guard answer every attack in
the game. Awareness answers every Sneak and Feint and rolls initiative. Endure answers poison and
disease, which in most campaigns is a handful of rolls per level. It is the insurance defense.

The cheapest fix, and a thematically perfect one: **make recovery checks Endure checks.** At 0 hit
points you are dying, and rather than a flat check you roll Endure against the usual DC. That hands
the constellation the most dramatic roll in the game, it is exactly what "survive what does get
through" means, and it rewards the character who invested in not dying. It does make tough characters
harder to kill, which is the point.

## Two things this raises

**The GM still rolls damage.** If you want a table where the GM never touches a die, monster damage
has to use the printed average instead of rolling. That is a one-line change and the single biggest
lever on combat speed. It also removes damage spikes, which cuts both ways.

**The degrees table in Chapter 2 now needs both readings.** Section C gives you two four-row tables,
one for attacking and one for defending. Either print both, or print the attacking one and add the
line *"when you are the one being attacked, read it upside down: your critical success is their
miss."* I would print both, since this is the part new players will get wrong.
