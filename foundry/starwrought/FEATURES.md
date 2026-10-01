# STARWROUGHT for Foundry VTT: what it actually does

Rules content built from **Player's Handbook v4.10**. System version **0.4.2**. Developed against
**Foundry VTT v14**, which is the manifest's verified version.

This file is about behaviour, not content. What is *in* the compendia is listed in
[README.md](README.md); what changed and when is in [CHANGELOG.md](CHANGELOG.md).

> **Standing rule.** When the handbook moves, this file moves with it. `node assets/build_all.mjs`
> refuses to pass while the handbook on the shelf is newer than `data/SYNC.json`, and refuses to
> stamp a new version until this file and the changelog both name it.

---

## 1. Character creation

**A step-by-step wizard** (the wand icon on a character sheet, or the banner on an unbuilt one).

Creation in STARWROUGHT is a sequence rather than a form: your Ancestry decides which Bloodlines
exist, your Background decides which Skills its points are allowed to buy, and a Talent you take on
one step can hand you another point to spend on that same step. So the wizard walks it in order and
will not let you past a step that still has a choice unmade or a point unspent.

| Step | What it does |
|---|---|
| Weapon Training | Melee Training or Ranged Training, your choice, granted free. Each card names its Key Attribute, its Root, and the Combat Styles whose points will count toward it. Only a Training whose Root is enabled in the spreadsheets is offered |
| Ancestry | Sets Vigor per level, Size, Speed (feet per Move) and Senses; grants the Ancestry Root |
| Bloodline | Offers only the Bloodlines inside your Ancestry's Constellation; grants that Root. A step with nothing enabled says so and lets you continue |
| Culture | Grants the Culture Root and adds its languages |
| Background | Three directed points: Trained in two named Skills, and in a Lore of its own |
| Calling | Sets Vigor per level; one Calling point buys the signature technique, one free Training goes to the Calling's Skill |
| Defenses | Two points, on two different Defenses, with the threat-coverage panel open beside them |
| Comets | Three points, anywhere you qualify for |
| Review | Name it and finish. The review prints the Vigor formula with your numbers in it, the Attribute rule (points ÷ 4), the rank rule (Trained +3), and your Talent count against the 14-point floor, or against the floor reachable with what is enabled when that is lower |

What the wizard enforces, all of it read from the compendium rather than hard-coded:

- **Root first.** Nothing in a Constellation can be bought before its Root Talent.
- **Requires is an OR.** A Talent listing two prerequisites needs either one.
- **Tier gates** measured against the rank you will have *after* the point lands.
- **Capstones** need a Master Talent in the same Constellation.
- **Identity Roots are never bought.** Ancestry, Bloodline and Culture Roots come from the choice.
  A Comet cannot buy one.
- **Two Defenses, not one, and not the same one twice.** The two Defense Talent Points must open
  two different Defenses. A Defense your Calling already Trained is still a legal home for one of
  them: the point buys a deeper Talent there instead of being wasted.
- **The threat-coverage panel.** Each of the four threats (Blow, Blast, Blight, Beguilement) is
  answered by two Defenses. The Defenses step lists all four threats, marks which of their two
  Defenses you have Trained so far, and names the gap. Two Trained Defenses cover three threats, so
  the choice is which threat you can live without an answer to. Every Defense chip's tooltip says
  which threats it answers.
- **Combat Style chips say which parent they count toward.** A point in Dueling counts toward
  Melee's rank as well, and the chip says so.
- **Become Trained in X.** If X is not open the point buys its Root, and that purchase is what
  makes you Trained. If X is already open (your Calling and your Background both wanting Athletics,
  say) the point buys a deeper Talent there instead of being wasted.
- **A point with one legal home is spent for you.** Choosing a Background settles all three of its
  Trainings at once; choosing a Calling buys its signature technique. Automatic spends are marked
  and locked, because there is nothing to take them back to. Where a real choice exists the wizard
  still asks, which is exactly the already-open case above.
- **Granted points.** A Talent with a Grants clause pushes its point onto the step where you took
  the Talent, and blocks Next until it is spent. Opening points offer only Roots of Constellations
  you have not started; `one` and `different` grant modes are honoured.
- **Free Talents.** A Talent with a Free Talent clause hands that Talent over outright, with no
  point spent, wherever in the book it lives. Weaponmaster's Drilled gives you Weapon Familiarity
  this way, and the free Talent then asks its own question.
- **Build-time choices.** A Talent with a Choice clause asks as it lands and records the answer on
  the Talent. Weapon Familiarity offers every Weapon Group plus every Technical weapon; Drilled
  offers the Groups. This is load-bearing rather than flavour: your Familiarity is derived from
  these answers, so a Practiced battleaxe rolls at your full Melee Proficiency once you are
  Familiar with Axes and at Untrained until you are. When a Talent grants another that asks the
  same question, you are asked once and the answer carries across: Drilled's group must be one you
  are Familiar with, and the Familiarity it hands you is the only one you have.
- **Every Lore is its own Constellation.** Taking Lore (Warfare) creates a Lore (Warfare)
  Constellation with its own rank, copied from the one authored Lore template. A Comet spent on
  Lore asks which field.

**Choices are written to the character as you make them**, so the sheet fills in behind you and the
wizard's side rail shows Attributes, Vigor and Defenses updating live. The rail also shows, for a
parent Constellation, how many of its points its Combat Styles are holding for it.

**A blocked step says what is blocking it.** The footer names the unspent point beside the disabled
Next button, and clicking that name jumps to it and flashes it, so a requirement below the fold is
never something you have to go looking for.

**Every option is shown, and nothing is pre-chosen.** Where a point could go to several
Constellations, they are all chips, grouped by category, each carrying its Attribute glyph and how
many Talents it has open to you. Nothing is selected until you click, so a Defense point reads as
four Defenses rather than as Awareness already decided. Clicking a chip swaps the Talent list
beneath it without redrawing the step.

**Back unwinds.** Every write is recorded against the step that made it. Back deletes the Talents
that step added, restores the fields it set, and forgets the points it spent. Clicking an earlier
step in the trail unwinds every step between. Changing a choice inside a step does the same before
applying the new one, so the character never keeps the residue of a decision you walked away from.
Picking the other Weapon Training card takes the first Root off again the same way. State lives on
the Actor, so closing the wizard or reloading Foundry does not lose your place.

Two things the first playtest taught the wizard. **The whole Talent card is the button**: anywhere
on it buys, it lights gold on hover like the Constellation chips, and Enter or Space buys from the
keyboard; a target one line high was being missed. And **it says when the thing blocking Next is
below the fold**: a bobbing "A point is still to spend below" badge sticks to the bottom edge of the
pane while an unspent point is out of sight (click it to jump there), the footer reads "Next needs:
Trained in Acrobatics" with an arrow that appears when that is below, and Next's own tooltip names
it. A greyed button on its own was being read as a broken one.

A finished 1st-level character comes out at the handbook's stated floor of **14 Talents**: one
granted Training, the three Origin Roots that come with the identity choices, and ten placed
points (3 Skill, 1 Lore, 1 Calling, 2 Defense, 3 Comets). Talents that grant points push the total
higher; the review step counts what you have against the floor and says if you are short.

**Not included:** equipment. Buy that on the sheet.

---

### What ships, and what waits

The spreadsheets decide what is visible in Foundry. Every talent sheet but Lore's, the Backgrounds
sheet and the action sheets carry an **`Enabled?`** column; a row reading Yes ships, anything else
is authored but not visible, and a sheet without the column is wholly enabled because its absence
means the sheet has not been curated yet (Lore, Languages today). A Constellation ships when its Root does. Disabled rows get no
compendium document, no chargen card, no picker entry and no Basic Action, while the web app and
the Constellation Compendium keep showing the whole book. Document ids never change, so enabling a
row later restores the same UUID, and a character who already owns a Talent of a now-disabled
Constellation keeps it: `content/constellations.json` carries every Constellation with its flag so
names, categories, attributes and parents still resolve. `game.starwrought.rules` reports the
enabled counts beside the authored ones. Aid, the one row of `data/actions.xlsx`, is not enabled,
and because the sheet is authoritative for any action it names, the roster's Aid row stays retired
as well; nothing ships for Aid until the row is enabled. Weapons, armor and shields follow the same
rule from `data/equipment.xlsx` (Weapons, Armor and Shields tabs, built from the handbook's Chapter 5
tables): the Equipment compendium holds the enabled rows under the same document ids as before, and
the web app and the Constellation Compendium keep the whole tables.

## 2. What the system works out for you

Nothing in this section is typed by a player. It is all derived, and it all recomputes the moment
anything it depends on changes.

### Character mechanics

- **One formula for every check.** d20 + Attribute Bonus + Proficiency Bonus + Situation, Condition
  and Gear bonuses and penalties. A Threshold is 10 + the same modifier. **There is no level term
  anywhere.** Level opens the door to higher ranks and pays out Talent Points; it never touches the
  die. Every check, Defense Threshold, Attack Threshold and Initiative roll in the system dropped
  its level term in 0.4.0. An adversary's Thresholds are typed by the GM and were never derived.
- **Attribute Points** counted per Talent owned, each flowing to that Talent's own feed and falling
  back to its Constellation's Key Attribute. Talents that override their feed are honoured, which
  is how Armored Fighting spreads across four Attributes.
- **Attribute Bonus** = points ÷ 4, rounded down, maximum +5, with no minimum +1: 0 to 3 points is
  +0, 4 to 7 is +1, 8 to 11 is +2. The sheet shows how many points to the next step.
- **Proficiency Rank** from points in the Constellation and character level: Trained +3 (1 point,
  level 1), Expert +6 (4 points, level 5), Master +9 (9 points, level 10), Legendary +12 (16
  points, level 15). Untrained is +0. The next rank's remaining cost, in points and in levels, is
  shown beside each Constellation.
- **The Origin is pooled.** Ancestry, Bloodline and Culture are authored as separate skies but
  progress as one Constellation, so their points share a rank.
- **Melee and Ranged are parents.** Every Combat Style names one of them as its parent (Two-Weapon,
  Shield, Brawling, Dueling, Great Weapon, Spear & Polearm and Armored Fighting under Melee;
  Archery, Crossbow Fighting and Missile Skirmishing under Ranged). A child's Talents count toward
  the parent's rank as well as the child's, **once the parent's own Root is owned**: without Melee
  Training the Melee rank is Untrained whatever the Combat Styles hold, and with it every child
  point counts. Only rank is inherited. The parent's own Talents must still be bought for their
  effects, and an Attribute Point is counted once, at the Talent's own feed. The sheet shows a
  parent's pool and how much of it is inherited, and a Combat Style carries a "child of" line.
- **Vigor** = 10 + (Ancestry Vigor + Calling Vigor) × level. Only the first Calling counts.
- **A night's rest** restores level × Presence Vigor, or level if Presence is 1 or less. It clears
  Temporary Vigor, leaves you with at least one Hero Point, and touches no Wound.
- **Weapon dice by level**: one, then two at 4th, three at 8th, four at 12th, five at 16th.
  **Specialization** by Melee or Ranged rank: +2 Expert, +3 Master, +4 Legendary.

### The four Defenses

Each is a Constellation, so each is Attribute Bonus + Proficiency Bonus, with a Threshold of ten
plus that (plus Size, for Evade and Guard). Folded in automatically:

- creature Size on Evade and Guard, outside the typed stack;
- Off-Guard (−2 Situation to Evade and Guard), Frightened N (Condition), Fatigued (−1 Condition to
  Evade and Guard), and Load Strain on Evade (untyped);
- the first Torso Wound as Off-Guard, and the first Arms Wound as −2 Situation to Guard;
- a Parry weapon in hand (+1 Gear to Guard) and a raised shield (its Gear bonus to Guard), which
  share a type and so do not stack: the better one stands. A tower shield gives Cover instead of a
  number and is left out of the sum;
- a Closed helm (−2 Situation) or an Open helm (−1) on Awareness and on Initiative, matched by the
  Head piece's name because the book has no trait for it.

Bonuses and penalties of the same type do not stack, and a bonus and a penalty of the same type add
together first. An Untrained Defense is +0 Proficiency and is marked Untrained on the grid.

**Two Defenses at creation**, not four. **The four threats**: a Blow is answered by Evade or Guard,
a Blast by Evade or Endure, a Blight by Endure or Awareness, a Beguilement by Awareness or Guard.
A Strike is a Blow, so the stance (below) is a choice between Evade and Guard; Awareness and Endure
are rolled from the Defense grid, or when a rule names one. The rule that Guard answers a ranged
Blow only with a shield Raised is in the Threat hint and is the table's to apply.

**Unavailability is shown, not enforced.** Evade is unavailable while Grabbed or Restrained: the
chip goes dashed with a warning mark, an Attack on you is answered with Guard, and the card says
why. Guard's own exceptions (unaware of the attack, or nothing to ward with) are not things the
sheet can see, so they stay with the table.

### Attacks and Defense rolls: the Exchange

- **Player-facing.** An attack reads the target's stance off the targeted token at the moment of
  the roll and is measured against that Defense's Threshold. A Defense roll runs the same
  comparison from the other side, so beating an Attack Threshold by 10 is a Miss and missing it by
  10 is a Critical Hit.
- **Melee or Ranged.** A weapon in hand rolls your Melee Proficiency; a weapon that leaves it rolls
  Ranged. A Thrown weapon is thrown when its target is beyond your Total Reach with it (or when the
  caller says so), and then rolls Ranged. **Weapon Handling** still applies on top: Intuitive uses
  the full rank, Practiced drops a rank without Familiarity, Technical drops you to Untrained.
  Familiarity is derived from what your Talents recorded plus the sheet's own list.
- **The Strike Attribute** is the higher of the weapon's natural Attribute (Might; Agility for
  Finesse, and for a ranged weapon that is not thrown) and the Key Attribute of a Combat Style
  whose Root you own and in whose Style you are wielding the weapon (the weapon's Style field). The
  weapon row shows the glyph of the one that won and says why.
- **The three Strikes.** Every weapon row has three buttons, ❶ Quick, ❷ Deliberate, ❸ Committed,
  and the roll dialog shows the kind and lets it be changed (it is locked when the Strike is already
  paid for: a finished preparation, a riposte, a Counter, an Intercept).
  - **Quick ❶**: one weapon die plus precision, nothing else. It cannot Critically Hit unless the
    weapon is Agile: a natural 20 that would have been a critical is a Hit, the card says so, and
    the Flare button is still offered because the die was a 20. It lands on the Torso and meets
    that Zone's Protection in full, Exposed or not. Stopped, it costs nothing beyond the action and
    can be Bound but never Controlled.
  - **Deliberate ❷**: the default. All your dice, specialization and Might. It may be placed on an
    Exposed Zone, and a Critical Hit lets you Expose a plausible Zone. A Miss Exposes you in a
    Zone of the defender's choice; a Parry that Stops it takes Control.
  - **Committed ❸**: **Prepared**. In an encounter, choosing it spends one action, reserves two,
    marks you Preparing and posts a card; nothing is rolled until you Finish at your next
    Opportunity (or Abandon: the reserve returns, the action is lost). Outside an encounter it
    rolls at once. All your dice; on any Hit you may Expose a plausible Zone. **Weighted**: Stopped
    at all, Graze or Miss, you are Exposed.
- **The Result bands**, from the attacker's side: Critical Hit (beat the Threshold by 10 or more),
  Hit, Graze (miss it by less than 10), Miss (by 10 or more). A natural 20 steps the result up one
  band and a natural 1 steps it down. **Stopped** means Graze or Miss. The card offers Critical /
  Hit / Graze damage buttons, minus Critical for a Quick Strike that cannot crit.
- **Out of reach is said, not refused.** A melee Strike at a target farther away than Natural Reach
  plus the weapon's reach, or a ranged or thrown Strike beyond the weapon's range, still rolls, and
  the card carries a note with the distance and the reach so the GM can adjudicate (Mike,
  2026-10-01). No target, no note.
- **Position, on the card.** Once the Result is read, the attack card grows a Position block. Every
  button is an offer to the side the rule favours, shown only to that actor's owner (the GM sees
  them all), never an automatic write, because "a plausible Zone" and "if they Guarded with a
  rigid weapon" are the table's to confirm.
  - **Expose the attacker**: a Zone picker for the defender on any Miss, and on a Graze when the
    Strike was Committed.
  - **Form Bind / Take Control**: when the defender Guarded with a rigid implement in hand (a
    shield, or a weapon that is neither Flexible nor a bare hand) and the attack itself can be
    bound: a melee weapon or natural attack that is neither Flexible nor Unparryable, and not an
    arrow or a throw. When it cannot, the card says what offered nothing to bind. A Miss against a
    Deliberate or Committed Strike, or a Parry that Stopped one, takes Control; anything else forms
    a neutral Bind. Taking Control also asks which Zone of the partner's to Expose, and after a
    Parry the **riposte** button appears: a Quick Strike ⓿ back. The card records both weapons,
    the defender's implement and the weapon that was Stopped, so the Bind knows which weapon is
    Controlled.
  - **Give ground 3 ft / Step**: when the defender Evaded. A Graze gives 3 feet directly away from
    the attacker (the token is moved along that line, rounded to whole squares, and not charged as
    a Move). A Miss, or a Void that Stopped the attack, offers a Step instead: the card says so, and
    the player moves the token.
  - **Expose the defender**: a Zone picker for the attacker on a Committed Hit, or a Deliberate
    Critical Hit.
  - **Counter**: the defender's Quick Strike back, offered whatever the Result was.
- **Reactions, carried by the defender's stance.** Each actor carries one of five stances: Evade,
  Guard, or a Reaction stance built on one of them.
  - **Void ❶↺** (Evade Training): Evade at +2 Situation. Stopped, you may Step.
  - **Parry ❶↺** (Guard Training and a rigid implement in hand): Guard at +2 Situation. Stopping a
    Deliberate or Committed Strike takes Control and offers the riposte.
  - **Counter ❶↺** (Expert rank in Melee; Melee Training alone grants Intercept, not Counter): the
    better of your two usable basic Defenses, no bonus, and a
    Quick Strike back whatever the Result. It answers only a melee Blow from a foe within your
    Reach: an arrow, or a spear from beyond your Reach, meets the basic Defense, charges nothing,
    leaves the stance standing, and the card says so.
  - **A Reaction never triggers a Reaction.** A Strike made as a Reaction (Counter, Intercept, the
    riposte) meets the target's basic Defense only: their stance is not read, nothing is charged to
    them, and no Counter is offered back. The same holds when a player answers an adversary's
    Intercept: the Defense dialog offers no Reaction, and the card says why.
  - The attack reads the stance at the roll. The +2 is folded into the Threshold inside the same
    Situation stack, so it does not add to another Situation bonus the Defense already carries. The
    ❶ is charged to the defender when the roll resolves, from the same six actions, and their
    stance falls back to the basic Defense it was built on. When the attacker's client does not own
    the defender, the card carries a **Charge** button for whoever does.
  - A Reaction stance the actor has no Talent for is drawn disabled. A Head Wound blocks every
    Reaction (the basic Defense still rolls, and the card says why); a chip or the token HUD
    disabled by the Wound says "You cannot use Reactions." rather than naming a Training the
    character may well own. Parry with nothing rigid in hand is noted, not blocked.
  - **A Defense rolled against an Attack Threshold** (a player answering an adversary's attack)
    offers the Reactions the roller owns in the dialog (an adversary is offered all three), adds
    the +2, swaps the Defense where the Reaction says so (Void is an Evade, Parry is a Guard) and
    charges the ❶.
- **Intercept ❶↺** (Melee Training, the one Reaction the Root grants) is offered by a card when a
  foe Moves into your Total Reach.
  See the six-action round.
- **Support.** +1 Situation to a melee attack for each other conscious ally whose Total Reach
  includes the target, to a maximum of +2. Allies are tokens of the attacker's disposition on the
  scene; a hidden, Dying, unconscious or dead one grants nothing. Support shares a type with the
  Controlled penalty, so the two resolve against each other rather than adding.
- **Controlled.** An attack with a weapon a foe Controls takes −2 Situation. Attacking with a weapon
  other than the one in the Bind ends the Bind before the roll; a Strike between the two partners
  ends it after; a Controller struck by a third party loses the line.
- **There is no Multiple Attack Penalty.** Nothing counts attacks per turn. Tempo is paid in
  actions.
- **The Unwieldy penalty is applied, not just drawn.** A Strike with an Unwieldy N weapon against a
  target within N feet takes the −2 Situation penalty automatically, measured edge to edge with the
  same arithmetic as the reach band, and the modifier line on the card says why. The Grabbed clause,
  which forbids the attack outright, is announced rather than enforced: a warning to the attacker,
  a card in chat, and the roll posts.
- **Relevant Check.** The handbook's term for a roll whose Constellation is the actor's to choose,
  subject to their justification and the GM's approval. The Constellations tab has a button for it
  (and the Macros pack a macro): a picker lists every Constellation at this character's rank,
  Trained first by modifier and Untrained after, with a line for why it applies and an optional
  Threshold. The roll is an ordinary check in that Constellation, so it can Flare, and the card is
  labelled "Relevant Check" with the Constellation and the reason as its subtitle. Adversaries do
  not roll them; they carry Thresholds.

### Damage

**Per-Strike formulas.** A Deliberate or Committed Hit rolls all your weapon dice, plus Might
(unless the weapon is Mechanical), plus specialization in Melee or Ranged by the weapon, plus flat
bonuses, plus precision. A Quick Hit rolls one weapon die plus precision. A Graze rolls one weapon
die and nothing else. A Critical Hit doubles the total; a Deadly die is a critical effect of the
weapon and lands after the doubling, not inside it.

**The order of operations**, followed literally: Immunity, the total, Weakness, Resistance, the
critical doubling, the Deadly die, Protection, Temporary Vigor, Vigor. Damage beyond what it took to
empty your Vigor is lost; nothing goes below 0.

- **Protection can never take a blow below 1.** Resistance can take it to 0. Immunity overrides both.
- **Per-Zone Protection** worked down the handbook's list: an Exposed Zone is 0 **against a
  Deliberate or Committed Strike only**, and stops there. A Quick Strike meets the Zone's Protection
  in full, and so does damage that is not a Strike at all (a Blast, a fall). Otherwise the piece
  worn there, plus Zone bonuses and the matched-harness +1 on the Torso, minus 1 if the material
  turns that damage type poorly, minus anything the attacker ignores (Armor-Piercing, on piercing).
- **Materials are automatic.** Padded and leather turn slashing poorly, mail turns piercing poorly,
  plate turns bludgeoning poorly, scale turns nothing.
- **Where it lands.** A Quick Strike lands on the Torso and the picker is locked. A Deliberate or
  Committed Hit lands on the Torso or on an Exposed Zone of the attacker's choice. A Graze goes
  where the defender says. A Critical Hit goes where the attacker chooses, and the picker opens on
  an Exposed Zone when the Strike was Deliberate or Committed, because that is where it Wounds.
- **Zone critical effects.** A Critical Hit on the Torso sets Off-Guard. The Arms, Legs and Head
  effects (−2 to attacks, Speed halved, no Reactions, until Recenter) are printed on the applied
  card for the table to hold.
- **Wounds and Spent**, after the Vigor is spent: the blow that empties your Vigor makes you
  **Spent** (a token status), not Dying. Then, each trigger firing on its own: any Hit that lands
  while you were already Spent Wounds the Zone struck (two Wounds from a Critical Hit); a Critical
  Hit with a Deliberate or Committed Strike on an Exposed Zone Wounds it; an attack with the
  Massive trait Wounds on any Critical Hit. A Graze never Wounds. Nonlethal damage that would Wound
  a Spent creature knocks it unconscious instead. Damage while Dying raises Dying by 1 (2 from a
  Critical Hit) and never Wounds.
- **Healing** restores Vigor, clears Spent the moment there is Vigor again, and ends Dying at once
  if any was restored: conscious, with that Vigor, Wounds untouched.

### Vigor, Spent, Wounds and Dying

**Vigor** is the header bar: current over maximum, with Temporary Vigor drawn on top as a second
pool that is spent first. At 0 Vigor you are **Spent**: still on your feet, badge on the bar, status
on the token, and every Hit now Wounds.

**Wounds are per Zone.** Each of the four Zones carries a count against a **capacity by Size**:
Medium or smaller 2, Large 3, Huge 4, Gargantuan 5, plus whatever an adversary's template adds
(`woundBonus`). The Zone's first Wound has the first effect, every Wound short of the last repeats
it, and the Wound that fills the capacity has the final effect. The effects that are numbers are
applied to the numbers; the rest are printed on the Zone and on the Wound card.

| Zone | First Wound | Final Wound |
|---|---|---|
| Arms | −2 Situation to attacks and to Guard | The arm is useless (announced) |
| Legs | Speed halved; a second Wound halves what is left | Prone (set) and Speed 0 |
| Torso | Off-Guard, and 1d4 persistent bleed per Wound, reminded at the end of every round | Dying |
| Head | No Reactions (the basic Defense still rolls) | Dying, and unconscious |

A further Wound to a useless Arm or Leg goes to the Torso. A Torso or Head already at capacity that
takes another Wound while the creature is not Dying begins Dying again. Taking any Wound abandons a
Prepared Maneuver. One `wounded` token status marks that a Wound exists; the counts are on the sheet.

**Dying** begins when the Torso or the Head takes its final Wound: Dying 1, or 2 if the blow was a
Critical Hit, unconscious either way. Damage while Dying adds 1, or 2 from a Critical Hit. Dying 5
is dead. **Recovery** is checked at the start of each round while Dying: a card goes to the owner
and the GM with the Threshold (10 + Dying + Wounds carried) and a roll button, and the check costs no
action. Critical success ends Dying, conscious with 1 Vigor; success drops Dying by 1, and 0 is
stable and still unconscious; failure raises it by 1; critical failure by 2. An adjacent ally's ❶ of
help is the +2 Situation typed into the dialog. Any Vigor restored ends Dying at once. World setting
`autoRecovery` turns the cards off; the Recovery button on the sheet and the macro remain.

**Treating a Wound** is the Treat link beside a Wounded Zone: ten minutes and an Endure check by the
healer (a selected token you own that is not the patient, otherwise the patient) against 10 + the
Wounds the patient carries. On a success the Wound comes off the Zone and the card says its effect
has ended. The GM has plus and minus adjusters on every Zone; on an adversary the plus runs the
whole Wound rule (redirection, bleed, Dying), while the minus is plain bookkeeping.

**Refusing Death** is a button that spends every Hero Point and cannot fail: Dying 0, unconscious
and stable at 0 Vigor (so Spent), Wounds intact.

### The six-action round

Every combatant receives **six actions at the start of each round** (an adversary receives its own
number, `actionsPerRound`; Slowed N loses N of them), and unspent actions expire at the end of the
round. The sheet shows them as six pips: gold while free, marked while reserved for a Prepared
Maneuver, dim once spent. The pips appear only while an encounter is running, because outside
Encounter Mode nothing is counted, and they can always be clicked to correct the count by hand.

**Opportunities.** Initiative order is fixed and play cycles through it; each visit is an
Opportunity for one Maneuver you can afford, or a Pass. In Foundry a turn is an Opportunity, so the
turn order **wraps within the round** instead of ending it: only a full circuit of Passes, or the
GM's own Next Round, begins a new round. **Pass** is a button on the pips and on the combatant's
tracker row, live only at your own Opportunity; it posts a card and moves play on. **End
Opportunity** moves play on after a Maneuver without Passing. The tracker header counts the pass
streak ("2 of 5"); only an explicit Pass counts, or a combatant who cannot act at all (Defeated,
Unconscious, Dying) and so Passes by necessity. A GM who clicks Next Turn for a monster that swung
has not Passed for it, and any Maneuver paid at your own Opportunity resets the streak. A lone
combatant's Pass is a whole circuit and ends the round; its Next Turn or End Opportunity after a
Maneuver is simply its next Opportunity in the same round, so its six actions and any Prepared
Maneuver survive. With no GM connected the streak is kept in memory by one elected client. Under each tracker row: actions left as a glyph, the reserved count,
and an hourglass while Preparing.

**Prepared Maneuvers.** A Maneuver of three or more actions is Prepared: one action now, the rest
reserved, and you are Preparing (a token status) until your next Opportunity. The Committed Strike
is the one the system runs end to end: a card with **Finish** and **Abandon** posts at once and
again when your next Opportunity begins (publicly, since preparation is telegraphed by design).
Finish spends the reserve and rolls the Strike, already paid; Abandon returns the reserve and the
action spent is lost. Taking a Wound abandons it, so does going down, and a new preparation replaces
an old one. You cannot Pass while Preparing; the Pass button says so and refuses. A preparation that
never reaches its Opportunity expires with the round, with a card.

**Reactions are paid from the same six.** There is no reaction slot. Void, Parry and Counter are
charged when the attack they answer resolves; Intercept is charged when its Quick Strike is made;
the riposte after a Parry is ⓿. Using a Maneuver Item that carries the Reaction trait from the
sheet spends its cost (its own Reaction cost when the sheet gives the Reaction half one, otherwise
the cost printed; no shipped Maneuver carries a separate Reaction cost yet).

**What is spent automatically**: a Strike by its kind, a Reaction, Raise a Shield, Recenter, drawing
or stowing a weapon, movement, and the first action of a preparation. Using a Basic Maneuver from
the Maneuvers tab spends nothing by itself; the pips are the table's to click for anything the
system cannot see being spent.

**Every spend is said in public chat.** When a player-controlled actor (a character, or any actor a
player owns) spends actions in an encounter, a card names what it was in the book's glyph, how many
actions it took, and how many are left this round (and how many are reserved while Preparing):
"❷ Deliberate Strike: Battleaxe. Hrolda spends 2 actions. 4 of 6 actions left this round." A Move,
Raise a Shield, Recenter, a Prepared Maneuver and an Abandon carry the same line on the card they
already post, so nothing is said twice. The GM's adversaries stay quiet unless they overspend.

**Nothing is ever prevented.** If a Strike happens with no actions left it still happens, and a card
goes to chat saying it went over the budget, by how much, and that none are left. Putting armor on mid-fight, which the
handbook prices in minutes, gets the same treatment: the system says how long it would take and gets
out of the way. World setting `trackActions` turns the automatic spending off entirely; the
Intercept offer below is a rules prompt, not a spend, and does not depend on it.

**Movement is charged from the drag**, on the client that made it, before the token lands, and only
at your own Opportunity on the combat's scene (a GM repositioning a token, forced movement, undo and
paste cost nothing). Speed is feet per Move, and the one-foot grid makes the arithmetic mean
something:

- a drag within half your Speed that crosses no difficult terrain is a **Step ❶**, which never
  provokes;
- a straight drag longer than three Moves and within your Rush distance is a **Rush ❸**, charged
  as three at once (a drag is a move already made, so its Prepared telegraphing is left to the
  table);
- anything else is one **Move ❶** per Speed's worth of feet, rounded up. Two Moves is two
  Opportunities' worth, and the card says so; a bent path a straight Rush would have paid three for
  gets a hint;
- at **Speed 0** (the final Legs Wound: Prone, and cannot Stand) every drag is a **Crawl ❶** per 3
  feet, which never provokes. The Speed read is what the Legs allow (`moveSpeed`), so an adversary's
  Legs Wounds reach the charge and the ruler while its stored Speed stays the creature's own.

A straight line is a path whose grid cost equals its direct measure, so exact diagonals are straight.
Every charge posts a card saying which it was and why, public for a player's character and the GM's
for an adversary, because terrain and forced movement are the GM's to adjust.

**Intercept cards.** When a Move or a Rush (never a Step) carries a token from outside a hostile
token's Total Reach to inside it, sampled along the whole path so a line that crosses a reach and
leaves it again still counts, a card goes to that foe's owners and the GM: "Intercept ❶↺: a Quick
Strike at the moment they enter". It is offered only to a foe whose Talents grant Intercept (Melee
Training; an adversary always has it unless a Head Wound forbids) and who is not unconscious, Dying
or dead, and once per foe per move. A character's button makes the Quick Strike with the weapon that
sets their reach and pays the ❶↺. An adversary's button pays its ❶ and posts a second card to the
mover with a Defense roll against the attack's Threshold, because the players roll everything; that
roll names the interceptor as the attacker, so its Position offers act on the right foe whatever the
player has targeted. A Rush is Off-Guard to the Intercept and the card says so. The move is never
blocked or delayed.

**Raised shields lower** at the start of the owner's next Opportunity, quietly.

**At the end of a round**: a Zone Exposed by a Posture closes; every actor with Persistent Damage
(from the Torso bleed, or a `persistentDamage` value on the actor or in its flags) gets a reminder
card with a roll button; and from the end of the third round on, every actor with Load Strain 1 or
more who is not already Fatigued, unconscious or Dying gets a **Wind** card: Endure against 10 +
Load Strain, or Fatigued (−1 Evade and Guard) until after the fight. **At the start of a round**:
every actor's actions reset, the pass streak clears, and every Dying actor's Recovery card posts.

### Where your equipment is

Everything you carry is **held**, **worn**, or **packed**. Held is in your hands: a weapon you can
Strike with, a shield you can Raise. Worn is on your body: armor covering a Zone, or a sheathed
blade. Packed is in a bag, which is where armor goes when it comes off.

The Equipment tab is laid out that way rather than by item type: what is in hand, then armor by
Zone (with each Zone's Wounds beside its Protection), then everything else together. A Zone with
nothing on it offers whatever you have packed for it, so putting a helm back on is one click.
Drawing or stowing costs an Interact, and armor names its own donning time, which is a minute for
each point of Protection. Putting away an implement that is in a Bind ends the Bind.

### Armor and load

Matched harness (+1 Torso Protection, −1 Load Strain), Clatter, and Load Strain relieved by your
Endure rank from Expert (1 at Expert, 2 at Master, 3 at Legendary). Load Strain comes off Evade, off
Might and Agility Skill checks, and off your Rush and Leap distances in feet. From the end of the
third round a fighter with Load Strain 1 or more makes the Wind check above. A Closed helm is −2
Situation to Awareness checks, the Awareness Threshold and Initiative; an Open helm −1.

**Shields.** Raise a Shield ❶ flips the shield's raised flag and pays the action; its Gear bonus to
Guard is derived from the flag, and the tracker lowers it when your next Opportunity begins. A held
shield, raised or not, is a rigid implement: it satisfies Parry's requirement and can form a Bind.

### Flares

Any critical, in either direction, puts a Flare button on the chat card. It asks which Constellation
the roll belonged to, because the die knows it was a critical and only the table knows what it was
related to. A Quick Strike's natural 20 that was denied its Critical Hit was still a critical on the
die, so it offers the button too. A Constellation you have never opened can be Flared, and it then
shows on the sheet at 0 points so the Milestone point has somewhere to go.

### Initiative

Awareness by default, with no level term and the helm's penalty inside it, or whatever you were
actually doing: the "Roll Initiative by Activity" macro lets a player nominate the Constellation,
and the roll swaps Awareness's two terms for the chosen Constellation's and keeps the rest.
Adversaries do not roll; they carry an Initiative Threshold and the GM writes the order down.

### The grid, and Total Reach

One foot per square with **exact diagonals**, both set by the system manifest, so a diagonal step
costs about 1.4 feet rather than the same as a straight one. Token footprints follow creature Size,
so a Medium creature is 3x3 and a Large one is 5x5. **Speed is feet per Move**: a Human's is 6, so a
Step is 3 feet and a Rush is 30 feet less Load Strain. The sheet prints Speed, Step, Rush and Leap.
Every distance the system charges is measured with Foundry's own grid, so the number on a Move card
is the number the ruler shows.

**Measure is edge to edge.** Reach is measured from the edge of your space to the edge of your
target's, so adjacent is a gap of zero feet and one intervening square is one foot. That makes reach
a question about squares rather than a radius, and the drawing follows: whole cells are lit and
every outline runs along a grid line. Diagonals are exact, so the shape comes out as a stepped
octagon rather than a stepped square. It shows on the token you control or hover over.

Three bands, from the inside out:

| Band | Colour | What it is |
|---|---|---|
| Unwieldy | red | The inner dead zone of a long weapon. Unwieldy N is a −2 Situation penalty against a target within N feet, so it is drawn as a warning rather than as reach. Absent unless the weapon in hand has the trait |
| Natural Reach | faint blue | What your body reaches, set by your Size |
| Total Reach | gold | Natural Reach plus the longest melee weapon in hand. The one that matters |

A cell is filled in the innermost band it belongs to, so the colours do not stack into mud, but
every band outlines its own edge whether or not anything was filled inside it. A longspear is
Unwieldy 7 against a Natural Reach of 2, so without that the faint ring would vanish at exactly
the moment the map is busiest.

A Medium character with a battleaxe shows 4 feet; the same character with a longspear shows 16,
with the red band at 7. Stow the weapon and it falls back to Natural Reach. A ranged weapon
contributes nothing, since its reach is not a melee one. Client setting `showReach`.

**"Within N feet" is read as a gap of N or less**, the same way reach itself is read: a target at
exactly your reach is in reach, so a target at exactly N feet is within N. The handbook does not
define the word, so this is a ruling, recorded in the changelog. It has a visible consequence on a
one-foot grid with exact diagonals: for a small N the band comes out square rather than round. A
Spear is Unwieldy 3, and the corner cell two squares across and two up sits at 2.83 feet, which is
within 3; only the cells at three across and one up (3.16 feet) fall outside. Larger values cut
their corners the way you would expect: a Halberd's 4 and a Longspear's 7 both read as stepped
octagons. The shape is the arithmetic, not a drawing choice.

The same edge-to-edge arithmetic decides the Unwieldy penalty, the Support count, and whether a
Move entered a foe's Total Reach, so the reach band, the modifier line and the Intercept card can
never disagree about a distance.

### Targeting, made visible

Foundry's own targeting indicator is four small corner brackets that only the targeting player can
see, and a pip for everyone else. At a table where the players roll everything, "who is that thing
going for" comes up every round, and a pip does not answer it.

- **Arrows on the map.** From the token doing the targeting to whatever it targets, in the targeting
  player's colour, drawn for everyone who can see both tokens. They start at the edge of one space
  and end at the edge of the other with an arrowhead, over a dark underlay so they read on a light
  map as well as a dark one. **Each carries the distance**, measured the way the handbook measures
  everything: edge to edge, in whole squares, diagonals exact, so adjacent reads 0 ft and a square
  two across and one up reads 2.2 ft. The number is gold when the target is within the source's
  Total Reach and plain when it is not. Client setting `showTargetArrows`.
- **In the Combat Tracker.** A line under each combatant names its targets, and the rows of whoever
  the active combatant has in its sights are tinted red down the left edge.
- **Remembered on the token.** Foundry targets belong to a *user* and vanish on reload. Here, as a
  user acquires targets, they are written onto the token they are acting through, as
  `flags.starwrought.targets`. That is the token they have selected; failing that, a player's own
  character on the scene (or the one token they own there, if there is exactly one), and for a GM
  with nothing selected, the combatant whose Opportunity it is, provided no player owns it. So
  targets belong to the creature, the way they do at a physical table, survive a refresh, and are
  readable by every client.
- **What clears them.** Clearing your Foundry targets clears the record on any token you have
  selected, or that you wrote yourself. A player who retargets with no token to carry it drops
  their old record. A GM's records are not swept that way, because a GM with nothing selected is
  usually inspecting a Threshold, and the monsters they set up one by one must keep theirs. Ending
  the combat clears every remembered target on the scene. Nothing else does: a target set mid-fight
  stays until one of those happens, which is what you want of a monster that has picked its prey.
- **What reads them.** The arrows and the tracker. A Strike uses your live Foundry target first,
  and falls back to the one remembered target on your token when you have none, so a reload costs
  you neither the arrow nor the Threshold.
- A hidden token's arrows and tracker line are the GM's alone.

While a token is being dragged, its arrows and their distances follow the drag rather than the
token left behind, whichever end of the arrow is moving, on the screen of the user doing the
dragging. The number is the one the move would produce, so a player can stop exactly where a
target comes into reach, or exactly where they leave it, before the move is paid for. Everyone
else's arrows stay on the token's last committed square and catch up when the drop lands, because
the drag clone exists only on the dragging client; they see Foundry's own drag ruler meanwhile.

### Stance: the defender answers

"The defender chooses one of the two Defenses that answer it, and decides whether to spend an
action on a Reaction." Each actor, character or adversary, carries a **stance**: how the next
physical Attack is met. There are five: **Evade** and **Guard**, the two basic Defenses, which cost
nothing; and **Void**, **Parry** and **Counter**, the Reactions built on them, which cost ❶ from the
six when an attack lands on you and are only yours to hold when the Talent or rank that grants them
is there (Evade Training, Guard Training with a rigid implement in hand, Expert rank in Melee for
Counter). Awareness
and Endure are not stances; the handbook calls for them by name.

- **On the sheet**, five chips in the header, each showing the Threshold an attacker would meet
  (the Reaction's +2 included), one click to switch, and the chosen Defense marked in the grid. A
  Reaction chip the actor has not earned is drawn disabled, so the sheet still teaches what the
  Talent would buy. Adversaries have the same chips, all five live, since their Reactions are the
  GM's to declare.
- **On the Token HUD**, one button showing the current answer, cycling to the next stance this
  actor can actually take: the fastest way to change your mind when an arrow has just been pointed
  at you.
- **In the attack dialog, the answer is hidden.** The attacker sees only that the defender's stance
  meets the roll and a note that it is revealed on the card: no dropdown, because the choice is not
  theirs, and no Defense or Threshold, because knowing which would be playing the character sheet
  rather than the character. The answer is **read when the die is rolled**, not when the dialog
  opened, so a defender who switches while the dialog is up is answered with the stance they
  switched to, and the Threshold is read live at the same moment since conditions move it too. The
  card then names the Defense, the Reaction behind it and the Threshold, and says why if the
  defender was answered with something other than their stance. Code can still force a Defense
  (`rollAttack(id, { defense: "awareness" })`) for a Talent that calls for one specifically; the
  dialog then shows the forced Defense by name, since the attacker chose it, and the stance is not
  consulted.
- **A Reaction stance is spent when it is used.** The ❶ comes off the defender's six as the attack
  resolves and the stance falls back to Evade or Guard, so standing ready to Parry is a decision
  renewed every blow.
- **Not announced to the table.** A player's change of stance mid-encounter is whispered to the
  GM, who is running the thing about to swing; a GM's change goes nowhere. Everyone else learns
  what a defender answered with when the roll's card posts, and not before.
- **Unavailable Defenses are shown, not enforced.** "Evade is unavailable while you are Grabbed or
  Restrained." A Grabbed defender's Evade chip goes dashed with a warning mark and the HUD button
  gets a red ring; an Attack on them is answered with Guard (and a Void, being an Evade, falls away
  with it), and the card says "Evade is unavailable while Grabbed; answered with Guard". Choosing
  Evade anyway on the sheet posts a note saying so, to the owner. Guard's own exceptions are not
  things the sheet can see, so they stay with the table.

Why not stop the attack and prompt the defender? Because the prompt would land on a player who may
be away from the keyboard, block the attacker until they answer, and do nothing for adversaries,
who are all the GM's. A stance set in advance and changeable in one click covers the same ground
without a round trip, and it matches how the handbook phrases the choice: something the defender
*has decided*, not something they are asked. Postures, the Talent-granted ⓿↺ Reactions that Expose
a Zone until the end of the round, are in the compendium as Maneuvers; the Exposed toggle on the
sheet marks a Posture's Zone so Recenter leaves it alone and the round's end clears it.

### The drag ruler, coloured by Moves

A Move carries you up to your Speed for one action, so dragging a token across the map is not one
decision but up to six. Foundry measures the path and highlights the squares it crosses; the system
colours those squares by which action pays for them, so you can see where an action runs out and
stop on that square instead of finding out after the token has landed.

| Colour | Meaning |
|---|---|
| Pale mint | Within a Step: half your Speed, one action, and nothing provoked |
| Gold, then green, blue, purple, teal, magenta | Your first Move, then your second, up to your sixth |
| Orange | A straight line paid for as one Rush ❸ |
| Red | Past what you have left to spend |

The ruler line matches the squares, and the waypoint label prints the cost in actions beside the
cost in feet: `3 ft ❶ Step`, `12 ft ❶×2`, `30 ft ❸ Rush`, or `18 ft ❶×3 (❸ Rush?)` when a straight
Rush would have been cheaper than the Moves.

The count runs **from where the drag began, against the actions you have left at your own
Opportunity**, not from the start of the round against a full six. Movement already made has already
been charged, so counting it twice would be wrong: walk 6 feet, then start a fresh drag, and the
next 6 are gold again. Outside an encounter, at someone else's Opportunity, or with action tracking
off, the full six (or the creature's own count) is assumed and the bands simply show what a round of
movement looks like.

Nothing is prevented, in keeping with the rest of the system. The red squares are a warning, the
drop still lands, and the overspend is announced in chat. Client setting `showMoveBands`; a client
that still carries the old `showStrideBands` value has it read once, at registration, to seed the
new setting's default. A Crawl is labelled as such; its squares are the Move colours by count.

The ruler extends whatever ruler class is configured rather than a fixed one, so it composes with a
module that has already replaced it instead of quietly discarding that module's work.

### Reach while dragging

**The reach bands follow a token while it is being dragged**, before the move is committed, so you can
see what you would threaten from a square and stop on it rather than spend a second action fixing
the position afterwards. They snap back if the drag is cancelled.

That is affordable because the shape does not depend on where the token is: it is built once in the
token's own cell coordinates and cached, and a drag only moves the container. A drag frame at the
longest reach in the book (a longspear, 1516 drawing commands) costs 0.037 ms, against 4.16 ms to
rebuild the shape, so following the drag is about a fifth of one percent of a 60fps frame budget.
The shape is rebuilt only when something that determines it actually changes: the reach numbers,
the token's footprint, or the scene grid.

---

## 3. Sheets

**Character sheet.** Six tabs. The header carries the **Vigor bar** (current, maximum and
Temporary, with a Spent badge at 0), the **five stance chips**, the **six action pips** with the
reserved marker, the Pass, End Opportunity and reset controls and, while Preparing, a line naming the
Maneuver with Finish and Abandon buttons (the pips only show in an encounter), then Hero Points, the
Wounds carried and Dying, and, when you are in one, the **Bind line**: neutral, Controlling or
Controlled, both implements named, with an End Bind button.

Overview carries the four Attributes with their point counts and how far to the next bonus, the
four Defenses (click to roll; Untrained ones marked), the four Zones with their Protection, material
weakness, an Exposed toggle (a Posture's Exposure is labelled), and each Zone's **Wound pips**
against its capacity with the effect in force, a **Treat** link, and plus and minus adjusters for
the GM. A **Strikes panel** shows Melee and Ranged with rank and Proficiency, your weapon dice, your
specialization in each, and the three Strike kinds with their glyphs. The body block has Ancestry
and Calling Vigor per level, Speed with Step, Rush and Leap beside it, Natural and Total Reach,
Space, Load Strain, Initiative and Familiarity. A row of table buttons: Recovery check, Refuse
Death, a night's rest (showing what it would restore). Constellations groups your skies by category,
shows rank, Proficiency, points and what the next rank is waiting on, and folds open to the Talents
you own with a Flare toggle on each Constellation; a parent shows its pool and how much is inherited,
and a Combat Style says which parent it is a child of. Equipment lays armor out by Zone with the
Zone's Wounds beside its Protection. Also Maneuvers, Effects and Biography.

**Weapon rows.** Each held weapon shows the Strike Attribute that won (glyph and attack modifier,
with the standing attack modifiers such as an Arms Wound's −2 folded in so it agrees with the roll
dialog, and a tooltip saying whether it came from the weapon or a Combat Style), Melee or Ranged and the
rank that applies after Handling, its damage (the Quick Strike's in the tooltip) and its reach, and
three Strike buttons: ❶ Quick, ❷ Deliberate, ❸ Committed. Clicking the name uses the default Strike.
Shift-click skips the dialog.

**The Maneuvers tab** (the tab keeps its id `actions` in code). It opens with the **Basic
Maneuvers**: what every character can do, grouped by category in the book's order and foldable,
read straight from the Maneuvers compendium rather than copied onto the sheet, so a rewrite in
`data/actions.xlsx` reaches every character on the next build. Clicking a name uses it as that
character: the card goes to chat with the character speaking, or, for a Maneuver that rolls a check,
the roll dialog opens. Shift-click skips the dialog. Each row can also be sent to chat, opened, or
copied down onto the sheet to become the character's own to edit. Below that is the list the
character has picked up: dragged from the compendium, made on the tab, or copied down. Parry, Void,
Counter and Intercept appear here as the book's Defense & Recovery Maneuvers do; using one without
its Training Talent is announced, not prevented. Using a Basic Maneuver spends nothing by itself
unless it carries the Reaction trait, in which case its cost comes off the six.

A Maneuver Item carries a **Description** (the flavour line), an **Effect** (the rules),
Prerequisites, Requirements, a Trigger, its cost range, the Reaction trait with its own cost, and
**Automation** notes, which are the author's instructions from the spreadsheet's Automation column.
Nothing acts on those notes yet. They are shown on the Item sheet so the intent travels with the
Maneuver until it is implemented.

**Adversary sheet.** Written Threshold-first, because the players roll everything. The header has
Vigor (current, maximum and Temporary, typed directly), Spent, actions per round, Speed in feet per
Move, the Initiative Threshold, the five stance chips, the pips in an encounter, Wounds and Dying,
and the Bind line. The stat block has the four Defense Thresholds, **one Attack Threshold per
attack** (there is no penalty ladder any more), the four Zones with Protection typed directly,
material, Wound pips with Treat and adjusters, and an Exposed toggle, and a **Reactions** panel
listing the creature's own abilities that carry the Reaction trait, skipped entirely when it has
none. Parry, Void, Counter and Intercept are the GM's to declare for any adversary, so they live on
the stance chips and the Intercept card rather than in the profile.

**Item sheet.** One sheet for all eight Item types, branching on type. Talents and Maneuvers carry a
cost from passive and ⓿ to ❻, an optional upper end with "to" or "or" between, so Strike reads
"❶ to ❸" and Disarm "❶ or ❸", a **Reaction ↺** checkbox, and the Reaction's own cost when it
differs, printed as "❶ (⓿↺)" for a ❶ Maneuver whose Reaction half is free; no shipped Maneuver
carries one yet. A Constellation names its parent (Melee or Ranged; anything but
itself is allowed, so a third parent needs no code change). A chassis carries Vigor per level, Size
and Speed in feet per Move. A weapon carries its Style, which is load-bearing for the Strike
Attribute, and the sheet calls out the traits that decide what it can do in a Bind.

---

**User Configuration.** Foundry's own window (the player's name, avatar, colour and character) is
left as core draws it except for one row: the Pronouns field is removed on render, since the table
does not use it (Mike, 2026-10-01). The stored value is untouched.

## 4. Chat

**Check cards** show the roll, every modifier by name, the Threshold and where it came from, and
the outcome band. An attack card names the Strike kind in its subtitle, the Defense and Reaction the
defender answered with (and a Charge button when the attacker's client could not spend the
defender's ❶), a note when a Quick Strike's 20 was denied its Critical Hit, the Critical / Hit /
Graze damage buttons, and the **Position block**: Expose the attacker or the defender (a Zone
picker), Form Bind or Take Control, the riposte, Give ground 3 ft or Step, and the Counter's Quick
Strike back, each shown only to the side it belongs to.

**Damage cards** show the formula broken into its parts, the Deadly die, a Zone selector (locked to
the Torso for a Quick Strike, offering the Exposed Zones for a Deliberate or Committed Hit, open for
a Graze or a Critical Hit) with a note saying whose choice it is, and Apply / half / heal.

**Applied cards** show the whole pipeline: what was rolled, what Weakness and Resistance did, the
doubling, the Protection, the Vigor before and after, then what the body did about it: the Zone's
critical effect, "Spent" when the blow emptied the Vigor or "already Spent" when it was, knocked out
by nonlethal damage, the Wounds that landed with their counts, Dying raised, or Dying ended by
healing.

**Wound cards** say why a Wound landed (Spent, an Exposed Zone, Massive), which Zone took it and how
full that Zone now is, the effect in force, the bleed a Torso Wound adds, a redirection from a
useless limb to the Torso, the total carried, and the Dying value if the Wound was the last the
Torso or Head could hold.

**Prepared cards**: when a preparation begins (Finish / Abandon), again at the owner's next
Opportunity (public), and when it is finished, abandoned, replaced or expires with the round.

**Round cards**, whispered to the actor's owners and the GM: the Recovery check at the start of a
round while Dying, with a roll button; the Wind check at the end of the third round and after, with
an Endure button and a Fatigued card on a failure; and Persistent Damage at the end of every round,
with a roll button, and after the roll an Endure button to end it (except the Torso bleed, which
only treating the Wound closes) and a note that the amount is applied on the sheet.

**Intercept cards**, whispered to the foe's owners and the GM, with a Quick Strike button for a
character or an attack button for an adversary; the adversary's answer card goes to the mover with
a Defense roll button against the attack's Threshold.

Also: Move, Step and Rush cards saying what a drag cost and why; the Pass card; Bind formed, Control
taken and Bind ended; Exposed; Give ground; Step; Recenter; Treat Wound; a night's rest; Refuse
Death; and the overspend card, whenever something happened without the actions to pay for it.

---

## 5. Conditions

All 24 registered as toggleable token statuses: Off-Guard, Wrong-Footed, Frightened N, Prone,
Grabbed, Restrained, Heedless, Stunned N, Slowed N, Fatigued, Blinded, Deafened, Concealed, Hidden,
Undetected, Unconscious, Dying N, Wounded, Spent, Bound, Controlled, Controlling, Preparing, Dead.

Off-Guard, Frightened N and Fatigued feed straight into the derived numbers; Grabbed and Restrained
make Evade unavailable; Slowed N takes its actions at the start of the round. The system keeps
Dying, Wounded, Spent, Bound, Controlled, Controlling and Preparing in step between the sheet and the
token, sets Prone from a final Legs Wound, Unconscious from Dying and Dead at Dying 5, and clears
Spent when Vigor returns. Exposed is per Zone on the sheet rather than a token status; Persistent
Damage is an end-of-round card rather than a status. The rest are markers for the table.

---

## 6. Settings

| Setting | Default | What it does |
|---|---|---|
| Open Constellations automatically | on | When a Talent arrives on a character with no Constellation Item for it, fetch it so the sky is drawn |
| Offer a Flare on a critical | on | Put the Flare button on critical chat cards |
| Track the six-action round | on | Spend actions automatically for Strikes, Reactions, Raise a Shield, Recenter, drawing or stowing a weapon, and movement (a Step, one action per Move, or a Rush). Encounters only; the pips can always be corrected by hand |
| Remind about Recovery checks | on | Post a Recovery card to the owner at the start of each round while a character is Dying, which is when the check is made |
| Show Total Reach on the map | on | Draw the reach bands around the token you control or hover over. Per client |
| Colour the drag ruler by Moves | on | Colour the squares a drag crosses by which action pays for them: a Step, each Move, a Rush, or past what you have left. Per client |
| Draw targeting arrows on the map | on | An arrow from each token to what it targets, in the targeting player's colour. Per client |

The `trackMap` setting is gone with the Multiple Attack Penalty; a world that still stores a value
for it is ignored.

**A stale-copy warning.** At load the system compares the server's version with a stamp carried in
its own code and another in its stylesheet. If either disagrees, the browser is running a cached
copy of an older release (a caching proxy such as Cloudflare in its default configuration will do
this after every update), and a persistent warning names what is stale and says to hard-reload.
Without it, a stale stylesheet looks exactly like a bug in the new one.

---

## 7. What it deliberately does not do

- **Prerequisites outside the wizard are not enforced.** Drag a Talent onto a sheet by hand and
  nothing stops you. The wizard enforces them; the sheet trusts you.
- **Talent Point types are not a budget after creation.** Milestone, Comet, Deferred and the rest are
  documented in the Rules compendium, and the no-banking rule is not policed.
- **"Expose a plausible Zone" is a picker, not a rule the engine resolves.** GM judgement inside a
  formula cannot be automated, so the card offers the attacker a Zone picker on the Results the
  book names and the GM can veto on the card.
- **Bind writes on a partner you do not own need the owner's click.** Form Bind, Take Control and
  the Zone a Controller opens on the partner are written on both actors only when one client owns
  both; otherwise the card says the other side is for its owner to set.
- **A Prepared Rush is charged at once.** A drag is a move already made, so a Rush-length drag pays
  its three actions on the drop and the telegraphing the Prepared trait implies is left to the
  table.
- **Persistent Damage is a reminder.** The end-of-round card rolls it, but the amount is applied on
  the sheet by hand: the damage pipeline is built around a Zone and its Protection, and Persistent
  Damage has neither.
- **A treated Wound is removed rather than bound.** The book keeps a bound Wound on the count for a
  week; the system takes it off the Zone on a successful Treat and says so on the card.
- **Zone critical effects other than the Torso's are announced, not tracked.** A Critical Hit on the
  Torso sets Off-Guard; the Arms, Legs and Head effects until Recenter are printed for the table.
  The Wound versions of the same effects are applied to the numbers.
- **Guard's unavailability, and the shield rule for ranged Blows, are the table's.** The sheet
  cannot see whether you were aware of the attack or had a hand free.
- **Support counts tokens, not fiction.** An ally is a token of your disposition within its Total
  Reach of the target; whether it is actually threatening is the GM's to say.
- **The Intercept card fires when the drag lands**, not before the movement, and never blocks it.
  Whether the Quick Strike lands before the last step is the table's call.
- **Cover, Concealment and detection are reference, not automation.** They need a judgement about a
  line between two tokens, which is the standing risk the working agreement names.
- **Levelling is manual.** Change the level field; everything recomputes. There is no level-up
  wizard yet.
- **Talent effects are prose the sheet displays**, not rules the system acts on. That is the next
  piece of work, and it will be authored in the spreadsheets rather than in code.
- **No equipment shopping**, in the wizard or out of it.
- **No magic**, because the playtest has none.
