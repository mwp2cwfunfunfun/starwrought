# STARWROUGHT: Attack, Defense & Armor Subsystem

**Draft v0.1.** Integrates *Attack, Defense & Armor* (Evasion/Guard, Graze, zones, Exposed) and
*The Measure of Steel* (piecemeal panoply, weapon identity) into STARWROUGHT's existing math.

Decisions taken from Mike: keep Evasion/Guard, hit zones, zonal armor, Graze, and the piecemeal
panoply; zones are **Head / Torso / Arms / Legs**; printed pf2e monsters stay usable via a
conversion formula; existing talents get reworked into the new vocabulary as we go.

This draft resolves the nine values the source document left open. Every number here is a first
pass meant to be shot at, not a finished tuning.

---

## 0. The one-paragraph version

Armor comes off the to-hit line entirely and becomes damage reduction by body zone. In its place
the defender chooses how to answer each attack: **Evasion** (get out of the way, fed by Agility and
your armor constellation) or **Guard** (meet it with steel, fed by your combat style and shield).
Attack quality decides *where* the blow lands: a Critical lets the attacker choose the zone, a Hit
goes to the torso, and a **Graze** (formerly a plain failure) lets the defender choose. Openings are
earned with action investment rather than called-shot penalties, and they persist as **Exposed**
until someone spends an action to **Recenter**.

**What you actually track in play is one number.** You have four Protection values on your sheet,
but Hits go to the torso, so torso Protection is the only one you use most rounds. The other three
matter when someone has earned an opening.

---

## 1. Graze is not a fifth degree

STARWROUGHT already has four degrees. The subsystem renames them; it does not add to them.

| Roll vs the chosen defense | Degree | Damage | Who controls location |
|---|---|---|---|
| Beat by 10+ | **Critical** | Double, plus critical effects | Attacker chooses the zone |
| Meet or beat | **Hit** | Full | Torso, unless a zone is Exposed |
| Miss | **Graze** | **Half, rounded down**, then Protection | Defender chooses the zone |
| Miss by 10+ | **Miss** | None | Nobody |

Natural 20 and natural 1 still step one degree up or down. The Flare loop is untouched and still
fires at both ends: a Critical Flares the attacker's constellation, a Miss Flares the defender's.

**Graze carries no riders.** Precision damage (Sneak Attack), critical specialization, deadly, and
persistent damage do not apply on a Graze. Only the weapon's base damage is halved and applied.
Without this clause every failed attack becomes a sneak attack delivery vehicle.

**Every Graze has a consequence** chosen by the defense used, below.

---

## 2. The two defenses

Both are DCs the attacker rolls against, and both are built on the game's existing spine so printed
attack bonuses still land at the right rate.

> **Evasion = 10 + level + Agility + your armor constellation's proficiency − Load strain**
>
> **Guard = 10 + level + Might or Agility (the weapon chooses) + your combat style's proficiency**

**Load strain = your armor's total Load minus your Might, minimum 0.** A strong character carries
steel better than a weak one, which is the historically correct answer and it gives Might a second
job.

Why proficiency comes from where it does:

- **Evasion keeps the Armor constellations employed.** Unarmored, Light, Medium, and Heavy Armor
  Training now read "add this constellation's proficiency to your Evasion while wearing it." The
  point economy is unchanged, including "1 point in an armor constellation is the best buy in the
  game."
- **Guard gives the Combat Styles a defensive number they never had.** Dueling, Two-Weapon,
  Shield Fighting, Brawling, and Archery each become a defense as well as an offense, which is a
  real gap closed.

### Availability is the balance lever

Neither defense is always on, and this is what stops the defender simply always picking the higher
number.

**Guard is unavailable** when you are unaware of the attack, have no weapon or shield in hand, or
are otherwise unable to interpose. **Evasion is unavailable** when you are immobilized, restrained,
grabbed, squeezing, or otherwise have nowhere to go.

A shield adds **+2 circumstance to Guard, and only while you have Raised it** (one action, exactly
as today). Base Guard and base Evasion therefore sit at the same number for most builds; the
choice is about consequences, and the shield tax is an action per round.

### Graze consequences

> **Evasion Graze: Yield or open yourself.** Move 5 feet directly away from the attacker. The
> attacker may Follow 5 feet without spending an action; yielding is not a free disengage. If you
> cannot or will not Yield, the attacker makes one zone of their choice **Exposed**.

> **Guard Graze: hold and become Pressed.** You keep your ground, and your guard is driven out of
> line: you are **Pressed** (−2 circumstance to Guard) until the end of your next turn. Pressed does
> not stack with itself.

That is the whole tactical dilemma. Evasion trades position; Guard trades posture.

---

## 3. Armor: Protection by zone

Armor no longer touches any defense number. It reduces damage after the blow arrives.

**Protection applies per instance of damage**, including each Graze. Resistance from any other
source does not stack with Protection; take the higher.

| Armor on that zone | Protection |
|---|---|
| Nothing | 0 |
| Padded, quilted, gambeson | 1 |
| Leather, hide | 2 |
| Mail, scale, composite | 3 |
| Plate | 4 |

**Bludgeoning ignores 2 points of Protection** (minimum 0). That is the whole anti-armor rule; it
replaces the source document's damage-type matrix with one line and still delivers the history:
swords rule the unarmored field, spears and arrows trouble mail, and the mace is the answer to
plate.

### The load-bearing interaction

**A Graze is half damage, and then Protection applies.** At low levels that means a well-armored
torso simply eats grazes: half of 7.5 is 3, and plate stops 4. Armored characters stop feeling
glancing blows entirely, which is exactly the fantasy, and it is also what pays for Graze existing
at all. Unarmored characters feel every one.

### Load

| Kit | Load |
|---|---|
| Cloth or nothing | 0 |
| Leather | 1 |
| Mail | 3 |
| Plate | 4 |

Load is the sum across worn pieces, and only Might offsets it. Speed penalties work as they do
today.

---

## 4. The four zones and the piecemeal panoply

Four zones: **Head, Torso, Arms, Legs.** Each holds one piece; each piece gives that zone its
Protection, contributes Load, and may carry **one** rider. Pieces never grant bonuses to Evasion,
Guard, or attack rolls. This is consistent with the standing rule that equipment quality never
grants item bonuses (v0.34).

**The torso piece anchors the kit.** It sets your armor's overall category name, and it is the
default location for every ordinary Hit, so it is the piece worth buying first.

| Zone | Example pieces | Rider examples |
|---|---|---|
| Head | Open helm, closed helm, coif | Closed helm: −1 circumstance to sight-based Awareness; reduce Critical damage by 2 |
| Torso | Gambeson, mail shirt, cuirass | Cuirass: the armor's name and category; no rider by default |
| Arms | Sleeves, vambraces, gauntlets | Mail sleeves: your armor's penalties never apply to Athletics |
| Legs | Chausses, greaves, padded hose | Greaves: +2 circumstance to your defenses against Shove, Trip, and Reposition |

**The clatter rule.** If two or more of your pieces are mail or plate and your torso piece is not,
your kit is noisy: −1 circumstance to Stealth.

**Matched harness.** If all four zones are the same material, gain +1 Protection on the torso only.
This rewards commitment without stacking four riders into a wall.

Design bar when adding pieces: **one rider each**, and it must be one of these three shapes. Waive
an armor penalty for a single skill; grant +2 circumstance to one defense against one or two named
maneuvers; or grant a small damage reduction paired with a real drawback. Never a defense number,
never an attack roll.

---

## 5. Exposed, Recenter, and earning openings

> **Exposed [zone].** That zone has been opened by posture, position, or a maneuver. An ordinary Hit
> may be placed there instead of the torso. Exposure is binary per zone and does not stack. It
> persists until cleared.

> **Recenter (1 action).** Clear all Exposed zones on yourself and end Pressed.

**Precision is bought with actions, never with an attack penalty.** There is no called-shot rule.

| Actions spent attacking | What it buys |
|---|---|
| 1 action | Quick attack. Cannot create Exposed. |
| 2 actions | Deliberate attack. On a **Critical**, may create Exposed in a plausible zone. |
| 3 actions | Committed attack. On a **Hit or Critical**, may create Exposed in a plausible zone. |

Maneuvers also Expose: a Trip exposes Legs, a bind or Disarm exposes Arms, a Feint exposes Head or
Torso. Use the Exposed condition for all of them rather than inventing bespoke debuffs.

**Hitting an Exposed zone** lets the attacker choose full damage **or** reduced damage plus the zone
effect. That choice is the balance lever that stops openings from stacking damage and control at
once.

| Zone | Effect (on the reduced-damage option) |
|---|---|
| Head | Dazzled, or Dazed 1 on a Critical |
| Arms | −2 circumstance to the target's attack rolls until it Recenters, or a free Disarm attempt |
| Legs | Speed halved until it Recenters; prone on a Critical |
| Torso | One extra weapon damage die |

---

## 6. Running printed pf2e monsters

The promise on the cover survives. One line, applied to any stat block:

> **Evasion and Guard both equal the printed AC.** Then shift by 1: a creature in armor or with a
> shield has **Guard +1, Evasion −1**; a fast or unarmored creature has **Evasion +1, Guard −1**.
> **Protection comes only from a creature's equipment line**, read off the table in §3. Most
> monsters wear nothing and get 0.

Because both defenses sit within 1 of the printed AC, printed attack bonuses hit at the right rate
and the ±10 critical bands are unchanged. Natural armor is deliberately ignored: it is already
priced into the monster's AC, and giving dragons Protection on top would double-count it.

**Dial for gritty games:** give creatures with a natural-armor descriptor Protection 1 at levels
1 to 8, 2 above that.

Monsters use Graze, Exposed, and Recenter symmetrically. They should; a boss who Recenters is
communicating something true about the fight.

---

## 7. What this does to existing talents

Reworked as we go, per Mike's decision. The affected list, with intent:

**Must change (wording breaks outright)**

| Talent | Now reads | Should read |
|---|---|---|
| Unarmored / Light / Medium / Heavy Armor Training | "add the constellation's proficiency to your AC" | "...to your Evasion while wearing it" |
| Glancing Plates (Light, E) | Resistance 1 to physical | +1 Protection to one zone of your choice |
| Deflecting Angles (Medium, E) | Resistance 1 (2 vs slashing) | +1 Protection to all zones |
| Armor Specialist (Heavy, E) | Resistance 2/3/4 by rank | +1 Protection all zones, +2 at Master, +3 at Legendary |
| En Garde (Dueling, T) | +1 circumstance AC vs melee | +1 circumstance **Guard** vs melee |
| Off-Hand Guard (TWF, T) | +1 circumstance AC | +1 circumstance **Guard** |
| Twin Parry (TWF, E) | +1/+2 circumstance AC | +1/+2 circumstance **Guard** |
| Covering Shield (Shield, E) | allies +1 AC vs ranged | allies +1 **Evasion** vs ranged |
| Unbending Line ★ (Medium, L) | +1 circumstance AC in an aura | +1 circumstance **Guard** in an aura |
| Body Like Water ★ (Unarmored, L) | attacks against you take −2 | unchanged in effect; confirm it reads against both defenses |

**Should change (collides with new vocabulary)**

- **Perfect Form ★ (Dueling, L)**, "turn a hit against you into a graze (half damage)": Graze is now
  a defined degree, so this becomes "reduce a Hit against you to a Graze," and it now also triggers
  the Evasion or Guard Graze consequence. Cleaner than before, and it needs the word aligned.
- **Brace ◆ (Medium Armor, E)** collides with *Measure of Steel*'s spear-bracing trait. One of the
  two needs renaming before either sees print. Suggest keeping Brace for the armor talent and
  calling the weapon trait **set**.
- **Shield Block ↺ (Shield, T)**, "reduce damage by 5": now stacks with torso Protection. Decide
  whether it applies before or after Protection; recommend after, so the shield is the last line.

**Unaffected but worth re-reading**: Untouchable, Blade-Turning Weave, Duelist's Riposte, and
Deflecting Palms all key off "misses" or "critically misses," which now mean the Miss degree
specifically. Their intent survives; the words are already correct.

---

## 8. Playtest values and the numbers behind them

Damage modelling used a d8 weapon with a +3 modifier, STARWROUGHT's baked striking dice
(2 at L4, 3 at L12, 4 at L19), and HP of ancestry 8 plus 11 per level.

| Level | Avg hit | Protection 4 reduces by | Hits to drop, unarmored | ...in plate |
|---|---|---|---|---|
| 1 | 7.5 | 53% | 2.5 | 5.4 |
| 4 | 12.0 | 33% | 4.3 | 6.5 |
| 12 | 16.5 | 24% | 8.5 | 11.2 |
| 19 | 21.0 | 19% | 10.3 | 12.8 |

**Protection needs no rank scaling.** Flat values fade on their own as striking dice accumulate,
which is why the table in §3 stops at 4 and why armor talents add only +1 to +3 on top.

**The one number to watch is level 1.** Plate more than doubles survivability at first level, which
is the gritty low-level lethality the source document warns about, pointed the other way. If it
plays too safe, the dial is to cap Protection at 3 until level 5.

**Still genuinely open:**

- Whether Graze should be half damage or a flat weapon die. Half is simpler and scales itself.
- Whether Pressed at −2 is enough to make the Guard/Evasion choice live, or wants to be −4.
- Whether Exposed should time out on its own rather than persisting until Recenter. Persisting is
  more tactical and more bookkeeping.
- Whether a 1-action attack should ever Expose, given how much the 2-and-3-action tiers depend on
  being the only route to it.
- Whether Might offsetting Load is too generous for plate builds, who want Might anyway.

---

## 9. Adoption order for playtest

1. **Graze alone.** One session. It changes damage feel and nothing else, and it needs no new
   numbers on any sheet.
2. **Evasion and Guard.** Add the two defenses and their Graze consequences. Still no zones.
3. **Zonal Protection.** Add the four zones and the Protection table. This is the step that touches
   every armored NPC.
4. **Exposed, Recenter, and action investment.** The tactical layer, once the vocabulary is fluent.
5. **The piecemeal panoply.** Shopping-time complexity; fold it in during downtime.
