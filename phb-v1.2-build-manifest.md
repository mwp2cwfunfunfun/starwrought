# PHB v1.2: build manifest

Everything settled in the design session, organized by where it lands in the book. Status markers:
**[DONE]** already in the data, **[TODO]** decided but not yet written, **[OPEN]** needs your call.

Companion drafts in this folder: `starwrought-defenses-v0.1.md`,
`starwrought-combat-subsystem-v0.1.md`, `phb-opening-fiction.md`.
`defenses-trained-tier-draft.md` is superseded.

---

## 1. Terminology purge (do this first, it touches every chapter)

| Retire | Replace with |
|---|---|
| AC, Armor Class | Evade and Guard |
| DC | the Defense's own name ("beat my Guard"), or a number the GM sets |
| Saving throw, save | a check with the relevant Defense |
| Fortitude / Reflex / Will | Endure / Evade / Guard |
| Armor proficiency, armor categories (light, medium, heavy) | Load, and Protection by zone |
| Combat Style **as a category name** | Martial |

**[OPEN] Four name collisions** to resolve before print:

- **Evasion** is both a Reflex talent and the name of a core mechanic.
- **Unshakable** (Will capstone) versus **Unshaken** (new Guard talent).
- **Center Yourself** (Will) versus **Recenter** (the action).
- **Brace** is a Medium Armor talent and also the spear trait in *Measure of Steel*. Suggest keeping
  Brace for the talent and calling the weapon trait **set**.

---

## 2. The resolution chapter

### [TODO] Attributes, reworded

Drop-in copy. The change that matters is "nerve" replacing "charm", which stops Presence reading as
a purely social attribute and makes Guard keying off it feel inevitable:

> STARWROUGHT has four attributes: Might, Agility, Wits, and Presence. **Might** is muscle,
> endurance, and raw force; it carries the weight of armor and absorbs what gets through.
> **Agility** is speed, balance, and precision; it puts you where the blow isn't. **Wits** is
> perception, memory, and fast thinking; it sees what's coming. **Presence** is willpower, nerve,
> and weight of personality; it holds the line when something tests you.

Each attribute now foreshadows its Defense, so the defenses chapter reads as a callback.

### [TODO] Checks and Defenses (replaces "Checks vs. Saves")

> Any time your character attempts something with a consequence for failure, they roll a **check**.
> A check is a d20 roll modified by a handful of variables.
>
> **d20 + level + attribute + proficiency (if any) + bonuses & penalties**
>
> **One formula for everything.** Adding your **level** is what makes the game heroic: a tenth-level
> character clears bars the most gifted commoner alive never will, in every field at once. Adding
> your **attribute** means raw talent always shows up, and no one is ever reduced to a bare d20.
> **Proficiency** is your rank bonus in the most closely related constellation (usually obvious, but
> when it isn't, pitch the constellation you think fits and the GM has the final say). Status, item,
> and circumstance bonuses or penalties then apply.
>
> **You roll everything.** When you act, you roll. When a creature comes at you, you roll the
> Defense you chose to answer it with. When a blast goes off or poison moves through your blood, you
> roll the Defense that fits. The GM sets numbers; the players roll dice.
>
> **The number that isn't rolling.** Every Defense uses that same formula with **10** standing where
> the d20 would go. Your Guard is 10 + level + Presence + proficiency. Roll it as a check and the die
> takes the 10's place. It is one number seen from either side, and the 10 is simply the die you
> aren't rolling.

### [DONE] Degrees of success

Your table is correct as built. Graze is not a fifth degree, it is the old plain failure renamed on
the attack-roll side. Crit success / success / failure / crit failure maps to Critical / Hit /
Graze / Miss.

**[TODO]** Add: **Graze carries no riders.** Precision damage, deadly, critical specialization, and
persistent damage do not apply on a Graze. Only base weapon damage is halved. Without this clause
every failed attack becomes a sneak-attack delivery vehicle.

### [TODO] Derived stats

- Hit Points: see §4 below. The current `6 + Might` line is stale twice over.
- Armor Class: **delete the row.**
- Add: Evade, Guard, Awareness, Endure, each `10 + level + attribute + proficiency`.

---

## 3. [TODO] The four Defenses

Full detail in `starwrought-defenses-v0.1.md`. The player-facing section copy:

> **Attacking & Defending**
>
> There are a multitude of ways you can attack your foes, and they have just as many for you. There
> are four ways to answer them.
>
> Your four **Defenses** are constellations like any other, and you are Trained in all four at
> creation, free. Each one works two ways. When a foe comes at you, you roll it to keep them out.
> When a trap, a poison, or a spell tests you, you roll it to endure them. One number, one formula,
> either direction.

| Defense | Attribute | In a word | Answers | Also the check against |
|---|---|---|---|---|
| **Awareness** | Wits | Don't be surprised. | Sneak, Feint, Lie | initiative, illusions |
| **Evade** | Agility | Don't be there. | a blow you slip aside from | blasts, traps, collapsing floors |
| **Guard** | Presence | Don't let it through. | a blow you meet with steel | fear, charm, confusion |
| **Endure** | Might | Survive what does. | Grapple, Shove, Trip, Disarm | poison, disease, exhaustion |

> When a weapon swings at you, **you choose Evade or Guard.** That choice is not about which number
> is higher. It is about what you are willing to lose if the defense proves imperfect: Evade gives up
> ground, Guard gives up posture. Awareness and Endure are never chosen. They answer when the moment
> calls for them.
>
> Neither Evade nor Guard is always there. You cannot slip a blow while you are grabbed or pinned,
> and you cannot meet one you never saw coming, or with nothing in your hands. Against everything
> that is not a swung weapon, all four Defenses are always available.

**Rulings inside this:**

- Saves are gone. Reflex became Evade, Will became Guard, Fortitude became Endure.
- Availability limits apply to **physical attacks only**.
- **Trained in all four, free at creation.** Retires the old "1 free point in any Armor
  constellation" grant.
- The four armor constellations retire. Their talents fold into Evade, Guard, and Endure.
- **[OPEN]** What replaces **Bulwark**, which died with the Evade/Endure split.
- **[OPEN]** Whether Awareness wants a specialization layer beneath it (a Vigilance or Scouting
  constellation). It is the only Defense with nothing under it.

---

## 4. [TODO] Hit points

**HP per level = Ancestry + first Calling + Might + Other**, on a flat base at level 1.

| Ancestry | per level | | Calling | per level |
|---|:-:|---|---|:-:|
| Elf, Halfling | 6 | | Magic | 1 |
| Human, Gnome | 8 | | Sneak Attack | 2 |
| Dwarf, Orc | 10 | | Hunter's Edge | 3 |
| | | | Rage | 4 |

- Every character chooses **one Calling at first level**, and **only the first Calling counts** for
  HP. At most one new Calling per level thereafter.
- **[OPEN] Flat base: 10 or 12?** Base 10 compresses the level-1 spread to 1.6:1 against pf2e's
  2.1:1, which is the point. But the floor lands at 18 and a d12 two-hander crit averages 19, so the
  squishiest build can still be dropped from full. Base 12 puts the floor at 20 and closes that.
- **[OPEN] Cap the "Other" term.** A fourth additive per-level source widens the spread past pf2e,
  and any Vigor constellation granting HP per level becomes a tax nobody can skip. Recommend a flat
  lump or +1 per level maximum.
- The old `ancestry base + (6 + Might)` line goes. Note the five ancestry values in
  `ancestries.xlsx` already match this table, so the HP column keeps its numbers and changes meaning
  from a one-time base to a per-level rate.

---

## 5. Ancestries

**[DONE]** Five authored (Human, Dwarf, Elf, Gnome, Halfling), 130 talents, root plus 14 core plus a
capstone plus two five-node heritage chains each. Chassis lives in `_Tree Index`. Roots comply with
the Root Rule.

**[TODO] Strip all innate vision.** No darkvision, no low-light. This is a clean deletion, not a
redesign: the v0.38 scaling clauses are what carry those three roots now, and all three still comply
without the sense. Senses becomes empty for all five. Two knock-ons to mention in the book: printed
adventures assume somebody has darkvision, so dungeons get uniformly harder and the lantern becomes
a real decision; and the closed helm's sight penalty now bites everyone equally.

**[TODO] Size affects defenses.** Small gains +1 Evade and −1 Guard; Large the reverse. Note this
reinforces builds rather than balancing them, since a defender usually leans on their better number.

**[OPEN]** No Large ancestry exists. All five current ones are Medium or Small, so half the Size
rule is dormant.

---

## 6. [TODO] Equipment: armor, zones, weapons

Full detail in `starwrought-combat-subsystem-v0.1.md`. Note **§2 and §7 of that draft are stale**,
written before Evade and Guard became constellations and before the saves merged; the Defenses draft
supersedes them.

- Armor leaves the to-hit line entirely and becomes **Protection by zone**.
- Four zones: **Head, Torso, Arms, Legs.** One piece each, each giving that zone's Protection,
  contributing Load, and carrying at most one rider. The torso piece anchors the kit and is the
  default location for an ordinary Hit.
- Protection: nothing 0, padded 1, leather 2, mail 3, plate 4. **Bludgeoning ignores 2.**
- **Load strain = total Load minus Might**, minimum 0. It reduces Evade.
- Pieces never grant a defense number or an attack bonus, consistent with the standing rule that
  equipment quality never grants item bonuses.
- Protection needs **no rank scaling**: flat 4 is a 53% damage cut at level 1 and 19% at level 19, so
  it fades on its own.
- **[OPEN]** Whether Shield Block applies before or after Protection. Recommend after, so the shield
  is the last line.

---

## 7. [TODO] Combat chapter

- **Graze consequences.** Evade Graze: Yield 5 feet, and the attacker may Follow without spending an
  action; refuse and one zone of the attacker's choice becomes **Exposed**. Guard Graze: hold ground
  and become **Pressed** (−2 to Guard until the end of your next turn, no stacking).
- **Exposed** is binary per zone, lets an ordinary Hit land there instead of the torso, and persists
  until cleared. **Recenter** (1 action) clears all Exposed and ends Pressed.
- **Action investment buys precision**, and there is no called-shot penalty anywhere. 1 action cannot
  Expose; 2 actions can on a Critical; 3 actions can on a Hit or Critical.
- **MAP stays as it is** (−5 / −10). The overextension alternative was modelled and set aside:
  deleting MAP is worth about +53% damage per turn at every level, and a defensive cost is free at
  range and free against a dying target.
- **[OPEN]** Pressed at −2 or −4. Whether Exposed times out or persists. Whether Graze is half damage
  or a flat die.

### Player-facing rolls

> The GM sets numbers. The players roll dice.

Monster attacks are listed as **numbers, not bonuses**: `Jaws 24, Claw 21`. The player chooses Evade
or Guard and rolls against it.

**Conversion: monster's number = printed attack bonus + 12**, meet or beat. I checked the four
candidate offsets at low, mid, and high level; +12 reproduces printed hit rates exactly and keeps
"meet or beat" consistent with the rest of the game, at the cost of monster crits running about 2.5
points hot. Since a crit against you Flares your Defense constellation, that drift feeds the growth
engine. (The alternative, +11 and you must *exceed* the number, is exact on both hits and crits but
breaks meet-or-beat in one place.)

**Do not use +10.** The obvious guess hands players a 10 point safety margin at every level.

Multiple attack penalty simply lowers the number: a second Jaws is 19, a third is 14. MAP becomes
visible good news for the defender rather than an invisible penalty on the GM's sheet.

**[OPEN] Flat monster damage?** The GM still rolls damage under the above. If the goal is a GM who
never touches dice, monster damage needs to use printed averages. That is the bigger lever for table
speed.

---

## 8. [TODO] Constellation organization

**Categorize by what the number does**, not by theme:

| Category | Members |
|---|---|
| **Defense** | Awareness, Evade, Guard, Endure |
| **Martial** | Weapons, and the fighting styles beneath it |
| **Skill** | the skill list, Lore |
| **Origin** | ancestry, heritage, culture |
| **Background** | backgrounds |
| **Calling** | Rage, Ambusher, Hunter's Edge, and so on |

`Save` retires. `Armor` and `Combat Style` retire.

**Weapons is a substrate, not a peer.** Every attack roll rides on Weapons proficiency and the styles
never touch accuracy. Same relationship Evade and Guard have to shields. Awareness is the only
Defense with no specialization layer.

**Acquisition is a separate axis from category.** Do not try to make one taxonomy do both jobs. Put a
one-line flag at the top of each entry instead: *granted free at creation*, *granted by your
ancestry*, or *opened by spending a point*.

**Structure the book so nothing prints twice:**

- Order the chapters by the chargen sequence (Ancestry, Heritage, Culture, Background, Defenses,
  Calling, Comets) so the book reads front to back as you build a character.
- In the chargen chapters, show **option cards only**: name, attribute, one line of concept, and the
  root. Enough to choose.
- Put the **full talent tables once, in a catalogue at the back**, in a fixed template: name,
  category and attribute, one-line concept, the root called out separately, then the tier bands with
  the capstone last.
- Add a **master index spread** listing every constellation with its attribute and category. The
  paper version of the app's Firmament.
- The Origin is **one** constellation, not three. Heritages are branches inside their ancestry's
  table, marked ✧, and cultures belong in the same chapter as the other half of the same sky.

---

## 9. Also outstanding, from before this session

- `cultures.xlsx` still uses Golarion names (Varisian, Keleshite, Chelaxian) and needs a de-Paizo
  pass. Mira's backstory references them too.
- `build_phb.js` hardcodes a stale ancestry list and still names retired Paizo talents ("Cooperative
  Nature", "Natural Ambition") in Mira's sample build.
- Mira's sample build needs rebuilding against all of the above: new HP formula, four Defenses, no
  armor constellations, no saves.
- Open rules question from v0.38: halfling luck turns a critical failure into a failure, which
  removes the crit that would have Flared the Origin. Does a Flare trigger on the die or on the final
  result?
- `xlsx_to_trees.py` needs its `CATEGORIES` and `FALLBACK_NEEDED` tuples updated for the new category
  names. App code, so yours to change.
