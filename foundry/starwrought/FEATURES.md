# STARWROUGHT for Foundry VTT: what it actually does

Rules content built from **Player's Handbook v4.15** (v4.14's text under a formatting pass; no
rule differs). System version **0.9.0**. Developed against
**Foundry VTT v14**, which is the manifest's verified version.

This file is about behaviour, not content. What is *in* the compendia is listed in
[README.md](README.md); what changed and when is in [CHANGELOG.md](CHANGELOG.md).

> **Standing rule.** When the handbook moves, this file moves with it. `node assets/build_all.mjs`
> refuses to pass while the handbook on the shelf is newer than `data/SYNC.json`, and refuses to
> stamp a new version until this file and the changelog both name it. Since 0.8.0 the content
> loop, `node assets/build_all.mjs --content`, reports that drift as a warning and goes on, because
> adding a Talent to a sheet is not a handbook sync (ruling 115; section 8).

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
| Calling | Sets your Opening Vigor, paid once at 1st level if it is your first Calling (Berserker 12, Ambusher 8, Hunter, Bravo and Weaponmaster 10); one Calling point buys the signature technique, one free Training goes to the Calling's Skill |
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
as well; nothing ships for Aid until the row is enabled. Since 0.6.1 the **Endure Constellation
ships with its Root alone** (Mike enabled Endure Training on the Endure sheet of
`data/defenses.xlsx`; the other four Endure Talents stay blank; sync report ruling 77), so Endure
relief and the Endure Bonus to Vigor are reachable in play, and since 0.6.2 **Awareness ships the
same way** (Mike enabled Awareness Training on the Awareness sheet; its other four rows stay blank;
ruling 83), so every one of the four Defenses is one the wizard's Defenses step can Train; the
enabled counts are 13 of 31 Constellations and 39 of 177 Talents. Weapons, armor and shields follow the same
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
- **Vigor** = 10 + your first Calling's Opening Vigor + (Ancestry Vigor + Endure Bonus) × level
  (PHB v4.11; sync report ruling 67). The Opening Vigor is paid once, at 1st level, and only by
  the first Calling. The Ancestry's number is paid again at every level, and so is the **Endure
  Bonus**: the conditioning clause of Endure Training, read live from your Endure rank, 0 at
  Untrained and Trained, 1 at Expert, 2 at Master, 3 at Legendary. It is always 0 at 1st level,
  since Expert needs 5th, and because it is read rather than recorded, reaching Expert lifts every
  level's share at once, the levels already behind you included. A 1st-level Human Weaponmaster
  has 28 (10 + 10 + 8 × 1); the same character at 5th with Expert Endure has 65 (10 + 10 +
  (8 + 1) × 5). The sheet carries the per-level figure and the Opening figure separately, each
  tooltip says where its number comes from, and the Adjustments field still adds on top.
- **A night's rest** restores level × Presence Vigor, or level if Presence is 1 or less. It clears
  Temporary Vigor and, since 0.6.2, Fatigued (ten minutes of rest is less than a night; the Rest
  card says so when it did; PHB v4.13, sync report ruling 81), gives no Hero Point (the GM awards
  those), and touches no Wound.
- **Weapon dice by level**: one, then two at 4th, three at 8th, four at 12th, five at 16th.
  **Specialization** by Melee or Ranged rank: +2 Expert, +3 Master, +4 Legendary.

### The four Defenses

Each is a Constellation, so each is Attribute Bonus + Proficiency Bonus, with a Threshold of ten
plus that (plus Size, for Evade and Guard). Folded in automatically:

- creature Size on Evade and Guard, outside the typed stack;
- Off-Guard (−2 Situation to Evade and Guard), Frightened N and Fatigued N (each a −N Condition
  penalty to Evade and Guard, so the worse of the two stands; Fatigued N reaches attack rolls as
  well). Load Strain is not in the list: since PHB v4.11 armor never makes you easier to hit, and
  Strain comes off nothing on the Defense grid;
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

- **Player-facing.** A Strike at a target is played as declare, commit, reveal, roll and resolve
  (see **The attack flow** below): the defender commits how the Blow is met before the die is
  thrown, and a player always rolls. With the world setting `attackFlow` off, or with no target,
  an attack instead reads the target's stance off the targeted token at the moment of the roll, as
  0.4.2 did. Either way the roll is measured against that Defense's Threshold, and a Defense roll
  runs the same comparison from the other side, so beating an Attack Threshold by 10 is a Miss and
  missing it by 10 is a Critical Hit.
- **Melee or Ranged.** A weapon in hand rolls your Melee Proficiency; a weapon that leaves it rolls
  Ranged. A Thrown weapon is thrown when its target is beyond your Total Reach with it (or when the
  caller says so), and then rolls Ranged. **Weapon Handling** still applies on top: Intuitive uses
  the full rank, Practiced drops a rank without Familiarity, Technical drops you to Untrained.
  Familiarity is derived from what your Talents recorded plus the sheet's own list.
- **The Strike Attribute** is the higher of the weapon's natural Attribute and the Key Attribute of
  a Combat Style whose Root you own and in whose Style you are wielding the weapon (PHB v4.14, The
  Attack: "Your Strike Attribute is the higher of two numbers: the weapon's natural Attribute
  (Might; or Agility for a weapon with the Finesse trait, and for any ranged weapon other than a
  composite bow or a thrown weapon), or the Key Attribute of a Combat Style whose root you have and
  whose weapons you are wielding. Work it out once per weapon and write it on your sheet. Damage
  still adds Might where the Strike allows it."; sync report rulings 87 and 88). The natural
  Attribute is Might, or Agility for a Finesse weapon and for a ranged weapon that does not carry
  the **Composite** trait; a thrown weapon is Might, since a weapon thrown from the hand is not a
  ranged weapon in its own right (0.6.3; through 0.6.2 every ranged weapon read Agility, and no
  weapon in the data carries Composite yet). "Write it on your sheet" is the weapon's **Combat
  Style** field: name the Style you wield it in and the sheet makes the comparison. The weapon row
  shows the glyph of the Attribute that won and its tooltip says whether it came from the weapon or
  the Style. Damage still adds Might where the Strike allows it.
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
Prepared Maneuver. One `wounded` token status marks that a Wound exists; the counts are on the sheet,
each Zone with a plus and a minus that a player or the GM may press (0.5.3; Mike: "player and GM
should be able to change Wounds, and log to chat"): plus takes the Wound through the same path a
blow does, so its card says it was marked by hand and everything a Wound does still happens; minus
is bookkeeping with no check behind it, said in its own card, and leaves Dying or Prone from that
Wound for the table to tidy.

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
Maneuver survive. With no GM connected the streak is kept in memory by one elected client. Under
each tracker row: the actions left as a large gold number over the round's count ("5/6", red at
zero) with a pip per action lit while unspent, the same pips the sheet shows (0.5.3; it was one
small circled glyph), then the reserved count and an hourglass while Preparing.

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
  Opportunities' worth, so a drag that would take a second Move is refused before the token lands
  (0.5.3; Mike: "we should not be able to Move more than our Speed at one time, in combat"), with a
  notice saying how far one Move carries you and that a straight Rush is the way to go further. The
  same holds for a second Crawl. The world setting **One Maneuver per Opportunity on the map**
  switches the refusal off, and the move's card then counts the Moves for the table, as 0.5.2 did.
  A bent path a straight Rush would have paid three for gets a hint;
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
card with a roll button; and every actor with Load Strain 1 or more whose Endure Threshold is
below the **Wind Threshold** (10 + Load Strain), and who is not yet Fatigued 3, unconscious or
Dying, gets a **Wind** card: Endure against that Threshold, at the end of round 1 and of every
round after (PHB v4.13, Wind: "If your Load Strain is at least 1 and your Endure Threshold is less
than 10 + your Load Strain, then at the end of every round while in an encounter, you must roll
Endure against 10 + Load Strain"; sync report rulings 79 and 80; through v4.12 and system 0.6.1
the first check came at the end of the third round). A fighter whose Endure Threshold meets the
Wind Threshold is exempt and gets no card (ruling 74), and so is anyone carrying no Load Strain,
whatever Frightened has done to their Endure Threshold; both halves of the gate are the book's
sentence now. The exemption is read live from the Threshold the Defense grid shows, so Frightened
can take it away for a round; the Load Strain field's tooltip gives both numbers. A failure raises
Fatigued by 1 (Fatigued 1 the first time), to a maximum of 3, and the card names the new value;
Fatigued N is −N Condition to Evade, Guard and attack rolls. The book ends Fatigued "after ten
minutes of rest", and the system has no clock for that rest, so the Fatigued card carries a **Ten
minutes' rest** button for the actor's owner or the GM: it sets Fatigued off and posts a one-line
card saying the fighter has caught their breath (clicked once Fatigued is already gone, it says so
quietly and does nothing else). A night's rest clears it too. Nothing clears it at the Combat's
end: a fighter who leaves one fight Fatigued carries it into the next scene until someone rests
(ruling 81; through 0.6.1 the Combat's deletion cleared it).
**At the start of a round**:
every actor's actions reset, the pass streak clears, and every Dying actor's Recovery card posts.

### Where your equipment is

Everything you carry is **held**, **worn**, or **packed**. Held is in your hands: a weapon you can
Strike with, a shield you can Raise. Worn is on your body: armor covering a Zone, or a sheathed
blade. Packed is in a bag, which is where armor goes when it comes off.

The Equipment tab is laid out that way rather than by item type: what is in hand, then armor by
Zone (with each Zone's Wounds beside its Protection), then everything else together. A Zone with
nothing on it offers whatever you have packed for it, so putting a helm back on is one click.
Drawing or stowing costs an Interact, and armor names its own donning time, which is a minute for
each point of Protection; an **Attended** piece (the Breastplate, since 0.6.2) names two, "4 min,
8 alone", because it fastens behind the shoulder and alone takes twice as long to put on, though it
comes off in the usual time (see Armor and load). Putting away an implement that is in a Bind ends
the Bind.

### Armor and load

Load Strain is the Load of every piece worn and a shield carried, less 1 for a matched harness
(which also gives +1 Torso Protection), less your Endure relief, to a minimum of 0. Endure relieves
it from Trained (1 at Trained, 2 at Expert, 3 at Master, 4 at Legendary; Untrained relieves
nothing), so a fighter Trained in Endure in full plate with a closed helm carries Strain 6 and a
Master carries 4, as the book's own worked example has it. Clatter is as before.

**Load Strain never touches Evade** (PHB v4.13, as v4.12: "Heavy armor does not make you easier to hit"), and
it is no blanket penalty on Might or Agility. What it costs is breath, senses and the margins of
movement: it comes off your Rush and Leap distances in feet; a Stealth check takes it as an untyped
penalty automatically, labelled Load Strain on the card; and because the system cannot tell a Climb
or a Swim from a grapple, the roll dialog for an Athletics check offers an unticked **Load Strain
(Climb or Swim)** modifier whenever your Strain is 1 or more, for the player to tick when the check
is one of those. No other check takes it. The Wind check above is the clock: at the end of every
round, from the first, a fighter with Load Strain 1 or more whose Endure Threshold is below 10 +
Load Strain rolls Endure against that number, each failure deepening Fatigued by one, to Fatigued
3; a fighter whose Endure Threshold meets it never rolls, and neither does one carrying no Strain
(PHB v4.13: "If your Load Strain is at least 1 and your Endure Threshold is less than 10 + your
Load Strain, then at the end of every round while in an encounter, you must roll Endure against
10 + Load Strain"; the third-round delay of v4.11 and v4.12 is gone from the book and the system
follows it). The Load Strain field's tooltip gives both numbers and says which side of the line
you stand on, to the GM and the player alike. Endure Training ships since 0.6.1, so the relief and
the exemption are both reachable. Fatigued, once it has set in, outlasts the fight: ten minutes'
rest ends it, by the button on the Fatigued card or by a night's rest, never by the Combat's end.
A Closed helm is −2 Situation to Awareness checks, the Awareness Threshold and Initiative; an Open
helm −1.

**Attended** (0.6.2; sync report ruling 82; Mike: "Yes to all") is an armor trait on the
Breastplate alone, and it is display only: "It fastens behind the shoulder, beyond your own reach:
alone, putting it on takes twice as long. Taking it off does not." The armor Item derives
`attended` from its traits and `donTimeAlone` (twice the donning time when Attended, else the
same), the Equipment tab's time tag reads "4 min, 8 alone" on the piece and its hint says why, and
the Rules Reference journal's armor traits table defines it. No Load, Protection, Strain or check
reads it. Mike accepted the wording into PHB v4.14 (the trait row, the Breastplate's "Plate,
Noisy, Attended" cell and the donning sentence), so the book, the data and the system agree, and
the Constellation Compendium and the web app print the same row. The Comfort row beside it reads,
since v4.14, "You can sleep in it without increasing your Fatigued value by 1."; the roster's
hand-kept `armorTraits` block carries that sentence, and nothing in the system acts on it (see
section 9).

**Shields.** Raise a Shield ❶ flips the shield's raised flag and pays the action; its Gear bonus to
Guard is derived from the flag, and the tracker lowers it when your next Opportunity begins. A held
shield, raised or not, is a rigid implement: it satisfies Parry's requirement and can form a Bind.

### Flares

Any critical, in either direction, puts a Flare button on the chat card. It asks which Constellation
the roll belonged to, because the die knows it was a critical and only the table knows what it was
related to. A Quick Strike's natural 20 that was denied its Critical Hit was still a critical on the
die, so it offers the button too.

**The list shows what you have Opened** (0.6.3; Mike: "the drop-down list should only show Opened
Constellations. There should be a toggle, though, to instead show non-Opened Constellations to
Flare"; sync report ruling 85). A Constellation is Opened for a character when they hold its
Constellation Item or any Talent in it; one drawn only because it is already Flared is listed too.
The dialog lists those alone, with the Constellation that was rolled preselected, and a checkbox,
**Show Constellations you have not opened**, rebuilds the list with every shipping Constellation
added and each unopened one marked "(not opened)"; when the rolled Constellation is one you have not
opened, the checkbox starts ticked so the preselection is in view. A Constellation you have never
opened can still be Flared, then, and it shows on the sheet at 0 points so the Milestone point has
somewhere to go.

**The sheet's Constellations tab** lists your Opened and Flared Constellations as before, and its
toolbar carries **Show every Constellation**, a toggle that adds every shipping Constellation you
have not opened as a slim, dimmed row in its own category, trailing the opened ones: name, Key
Attribute glyph, Untrained, a "not opened" mark, the Flare control and the roll link, with no Talent
list and no caret (the Lore template is left out, since a Lore you open is always Lore (X)). So an
unopened Constellation can be rolled or Flared from the sheet as well as from a card; the button
reads **Opened only** while the rows are shown. The toggle is a client setting
(`showUnopenedConstellations`, off by default, with no entry in Configure Settings; the button is
the switch), so it holds across sheets and sessions for that user, and every character sheet the
client has open redraws when it changes.

**A Flare is said in chat from every entry point** (0.6.3; Mike: "Flaring a Constellation by
clicking on the Flare button on the charsheet in Foundry doesn't send that to chat, like changing
other things does"; ruling 86). Lighting a Constellation, from a card or from the sheet, posts the
Flare card ("{name} is Flared. A Milestone Talent Point may be spent there, and it stays Flared
until you do."), spoken by the actor and public; putting one out posts a one-line card saying it is
no longer Flared. `toggleFlare` posts the card itself, so a Flare from a card is said once and no
entry point is left silent; putting out a Flare that was never lit writes nothing and says nothing.
The Adjusted card for hand edits has never covered Flares, and the Flare card is the announcement.

**The picker is shared, and the GM can award a Flare with a reason** (0.7.0). The dialog the
critical's card opens lives in `module/apps/flare-picker.mjs` as `pickFlare` (the Opened list, the
"Show Constellations you have not opened" checkbox, the preselection), and `flareFromCard` calls it
and then `toggleFlare` as before, so nothing on the chat path changed. The party sheet's roster
opens the same picker from its GM-only Flare plus, with an optional one-line reason, and
`toggleFlare(slug, state, { reason })` prints the reason on the lit card as its own line ("awarded
by the GM: <reason>"), so a Flare the GM grants for something the dice never saw is said with its
cause. While the character holds a Deferred Talent Point the lit card also carries "You hold a
Deferred Talent Point: spend it here now." (ruling 94; see The party, under Sheets). The put-out
card, and the silence on a Flare that was never lit, are unchanged. Since 0.7.5 the party sheet's
Train opens the same picker with no reason field and lights the pick with
`toggleFlare(slug, true, { trained: true })`, whose card says "Flared by seven days' training." in
place of the award line (a reason and the training line both print when both are given; see The
party, Downtime, under Sheets).

### Initiative

Awareness by default, with no level term and the helm's penalty inside it, or whatever you were
actually doing: the "Roll Initiative by Activity" macro lets a player nominate the Constellation,
and the roll swaps Awareness's two terms for the chosen Constellation's and keeps the rest. Since
0.7.2 the party sheet's Begin the encounter writes the same thing for the whole party at once (see
The party, under Sheets; ruling 105): every member Combatant carries two flags,
`initiativeConstellation`, the Constellation the member's Exploration Activity names (Awareness
when it names none; Stealth for Avoid Notice, Athletics for Hustle, Guile for Look Harmless,
Investigate's own pick), and `initiativeModifiers`, a list of typed modifiers with one +1
Situation entry per Scout among the other members with a token on the scene ("Scout (Hrolda)"; a
member the card names as having no token neither gives nor gets one), and every roll in the system
reads both: the tracker's roll through `SwCombatant._getInitiativeFormula`, which since 0.7.2 asks
the check engine for the very total the dialog would show (the flagged Constellation's terms, the
sheet's Initiative adjustment, the helm, and the modifiers one per type at most, so two Scouts are
+1 and not +2); the "Roll Initiative by Activity" macro, which replaces the Constellation with the
one the player nominates and writes it back to the flag, the Scouts' modifiers still applying since
it passes none of its own; `rollInitiativeWithCheck`, whose
Constellation and modifiers default to the flags and whose card names the Constellation in its
subtitle; the character sheet's Roll Initiative, which passed Awareness through 0.7.1 and would
have overridden the flag; and the Skills grid's Initiative cell. A Combatant that has already
rolled is never rewritten by a second Begin. Since 0.7.3 a roll the member already made on the
road may be kept as the Initiative roll instead of rolled again (see The party, Keeping a road
roll as Initiative; ruling 109): the kept Initiative is the roll's total plus the Initiative-only
terms a check does not carry, which the check engine computes as the difference between its
Initiative assembly for that Constellation (`SwCheck.previewTotal` with `kind: "initiative"`,
static and pure, so nothing is rolled and nothing is written to work it out) added to the natural
die the check threw, with the Combatant's modifiers and the typed extras the check itself carried
(the dialog's situational entry, kept on the record) resolved in one pass, so a +2 Situation for
cover and a Scout's +1 Situation stack as every check does, highest only. Since 0.7.4 an
Initiative rolled with a Constellation carries every modifier that Constellation's check does
(ruling 111; Mike: "ALL active modifiers for any roll should be applied even if that roll is used
for initiative"): the check adjustment, and Load Strain on a Stealth roll, which through 0.7.3 an
Initiative never took. So against the check's own total the only difference is Initiative's own
terms: the helm's penalty where the check did not already carry it (an Awareness check does, so a
Search's Awareness never carries the helm twice), the sheet's Initiative adjustment, and the
Scouts' +1. A Stealth 17 rolled by an Open-helm wearer at −1 with a Scout present is kept as 17 + 0,
whatever their Load Strain; the card names the terms whenever the difference is not zero ("..., +1
for Initiative's own terms (the helm, the Scouts' bonus, the sheet's Initiative adjustment): 18.").
The value is written with
`combat.setInitiative` onto every unrolled Combatant of the member, so the tracker, the party row
and the grid's cell read it as any rolled Initiative, and the Combatant has rolled as far as a
second Begin is concerned. Adversaries do not roll; they carry an Initiative Threshold and the GM
writes the order down.

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
  player's colour. The GM sees every arrow; a player sees only the arrows their own user set
  (0.5.3; Mike: "players should not be able to see any targeting arrows other than their own"), so
  who the adversaries are going for stays the GM's to reveal. They start at the edge of one space
  and end at the edge of the other with an arrowhead, over a dark underlay so they read on a light
  map as well as a dark one. At short range, where the distance pill would cover the shaft it
  describes, the pill steps off the line to the upper side and the arrow stays in view (0.5.3;
  Mike: "short distances have non-ideal targeting and bind arrows"); the Bind chain's label keeps
  the lower side, so the two never trade places. **Each carries the distance**, measured the way the handbook measures
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
action on a Reaction." Each actor, character or adversary, carries a **stance**: the basic Defense
the next physical Attack is met with, **Evade** or **Guard** (0.5.3; Mike: "Standing Stance should
only include Evade or Guard"). The Reactions built on them, **Void**, **Parry** and **Counter**,
cost ❶ from the six when an attack lands on you, are only yours when the Talent or rank that
grants them is there (Evade Training, Guard Training with a rigid implement in hand, Expert rank
in Melee for Counter), and are chosen blow by blow in the Combat Prompt rather than held as a
stance; as Maneuvers they appear on the sheet's Maneuvers tab once their rows are enabled in
`data/maneuvers.xlsx`. A stance a character set to a Reaction before 0.5.3 reads as the Defense it
stood on. Awareness and Endure are not stances; the handbook calls for them by name.

- **On the sheet**, two chips in the header, each showing the Threshold an attacker would meet,
  one click to switch, and the chosen Defense marked in the grid. Adversaries have the same chips.
- **On the Token HUD**, one button showing the current answer, flipping to the other Defense: the
  fastest way to change your mind when an arrow has just been pointed at you.
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

The stance is what you *have decided*; since 0.5.0 the attack flow below asks you to confirm it,
blow by blow, in a prompt that arrives with the attack. The stance is the prompt's pre-selection,
so a present player commits with one click, and the GM can answer for an absent player with their
standing stance in one click too, which is what kept the 0.4.0 design from prompting at all. With
the attack flow switched off the stance is read at the die exactly as before. Postures, the ⓿↺
answers that Expose a Zone until the end of the round, are offered by the prompt in two forms: the
Posture each Defense's Training root grants in its own text, **Give Ground ⓿↺** with Evade Training
and **Set Your Feet ⓿↺** with Guard Training (0.5.3; Mike: "Where can I choose my Posture, like
Give Ground or Set Your Feet?"; they ride on the root Talent, since they are no Talent of their
own, and the card names them as the Reaction table does), and any Posture Talent you own in the
Defense's Constellation (Slip the Line ⓿↺, Catch the Blade ⓿↺, once enabled). The Exposed toggle on
the sheet marks a Posture's Zone so Recenter leaves it alone and the round's end clears it. Since
0.5.1 the chips are
labelled **Standing stance**, which is what they are: the default the prompt pre-selects, not the
answer itself.

### The attack flow

**Declare → commit → reveal → roll → resolve.** A Strike at one or more targeted tokens, from the
weapon row's ❶ ❷ ❸ or from an adversary's attack row, does not roll at once. It declares: the
Maneuver (weapon or attack, Strike kind) and the targets lock, and one **attack card** appears in
chat. A Committed Strike in an encounter still Prepares first and declares when it is Finished.
Counter, Intercept and the riposte are already answers to a declared Blow and roll at once, as
before. With no target the Strike rolls at once too. **The declaration is the Maneuver** (0.5.3;
Mike: "I used a deliberate strike, but I don't think it reduced my actions by 2"): a character's
Strike pays its actions when it declares, as an adversary's always did, and the roll step pays
nothing; a Blow the GM cancels before any die was thrown returns them, with a card. **One Blow at
a time** (Mike: "my partner clicked attack twice, and it popped up two defense boxes"): a second
declaration by the same attacker replaces a Blow nobody has answered yet, so a double click is one
attack and one prompt, and is refused once a defender has committed or a die is in flight, with a
notice naming the Blow in play.

**Commit.** Every defender's controller gets the **Combat Prompt**: a small window, bottom-right,
that never blocks Foundry. For a defender it offers the Defense (Evade or Guard) with the standing
stance pre-selected, then the answers legal for that Defense right now (nothing; Void on Evade,
Parry on Guard with a rigid implement, Counter on either at Melee Expert; any ⓿↺ Posture Talent
owned in that Defense's Constellation, with the Zone it will Expose, though none ships enabled in
the current data, so that choice waits on one), a preview of the resulting Threshold for a
character, and Commit. Changing the Defense re-lists the answers, and an answer the new Defense
does not allow falls back to nothing. The choice is
sent as choices, never as a number, and the coordinator revalidates it against the rules. An
adversary's answer is the GM's to declare: the GM gets one prompt row per adversary target. Until
every defender has committed, the card shows only "Committed" or "Waiting" per target; no one,
the attacker included, sees a choice. The commitments live only with the coordinator.

**Reveal.** When the last defender commits, every choice reveals at once on the card, a Posture's
Zone is Exposed, and the roll step begins.

**Roll.** The player rolls. A player-controlled attacker (a character, or anyone a player owns)
rolls Attack once, in the usual roll dialog with the Strike locked, and that one roll is read
against each defender's Threshold. A player-controlled defender of an adversary's Blow rolls
Defense against the adversary's Attack Threshold, which the player never sees. Player against
player is not an opposed roll: the attacking player rolls, the defending player's committed
Threshold answers. Adversary against adversary is the GM rolling the attacker flat against the
defender's Threshold. The prompt carries the Roll button; the card carries it too, for recovery.

**Resolve.** Each pairing gets the same resolution card an attack produces today: the Defense and
answer, the outcome, Position offers (Expose, Bind, give ground, Step, Counter, riposte), the
damage buttons for the attacker, and the Reaction's ❶ charged or offered. The attack card records
every outcome and completes. Follow-up choices stay on the resolution cards; the prompt framework
can carry such choices later. One resolution card serves every viewer, so it prints a character's
Threshold only when `attackShowPcThresholds` is on; the attack card is where that player and the
GM read it.

**Who may do what.** The coordinator is the GM's client when a GM is connected, otherwise the
attacker's. Every request (declare, commit, roll, GM controls) goes to it over the system's socket
with the workflow's revision. A request made against a revision older than the start of the
current phase, or than a reset, is refused and the prompt says the attack has moved on; a sibling
defender's commit or roll in the meantime does not make yours stale, since your choice still
applies. Only an actor's owner may commit for it or roll for it, and the prompt and the card each
show a viewer only their own buttons (the GM sees them all); only the GM (or, with no GM
connected, the coordinating attacker) may Cancel, Reset defenses (everyone chooses again, nothing
is revealed), Resend prompts or Answer with standing stances. Reset is offered only while the
defenders are choosing: once a die has been paid for (a Strike's actions, a Reaction's ❶ charged
before a Defense roll) only Cancel remains, and a reset closes again any Zone a revealed Posture
had Exposed. Cancel keeps the attacker's spent actions: the declaration is the Maneuver. A closed
prompt loses nothing: the card's button reopens it, and a reload rebuilds live attacks from the
cards, the coordinator's private commitments from its own browser. Requests and replies travel the
system's socket addressed to one user, so the server delivers them to that client alone, and the
coordinator reads who is asking from the server's own stamp on the message, never from the
payload; a state broadcast is only a wake-up, and every client takes the state itself from the
card's flags, which only their author or a GM can write. The same socket carries, since 0.5.3, a
player's damage Apply on a creature they cannot write, a die read again against a hidden Threshold
and an Expose on a body the chooser cannot write (`damage:*`, `reroll:*` and `expose:*`, handled
in `chat.mjs` by `onChatSocket`; see Chat) and, since 0.7.1, a party Take or Give (`party:*`,
`onPartySocket` in `party-socket.mjs`; see The party, under Sheets), each addressed to the active
GM's client, which reads the asker from the server's stamp and answers the asker alone; the router
in `starwrought.mjs` sorts the three by the prefix of the message type. With no GM connected the
attacker's client coordinates and holds the GM controls, and an adversary target answers with its standing
stance at once, since nobody can declare for it, as it does if the last GM leaves mid-defense. At
such a table the attacker's own client is the one holding the defenders' commitments until the
reveal, which asks the players to trust one another; the GM is the arbiter the design assumes. A
card the GM authored cannot be written by a player, so such an attack waits, refusing requests,
until a GM returns and adopts it; an adoption before the reveal resets the defense phase, because
the private commitments went with the lost coordinator.

**What players see.** Inside the flow an adversary's Thresholds are never printed for players, on
the card or in its data; the card shows the outcome. A character's Threshold is shown to that
player and the GM, and to the attacker only when the world setting `attackShowPcThresholds` is on.
The card prints "vs 14" only beside a defender the attacker rolls against; where the defender
rolls, the number their die meets is the adversary's Attack Threshold, withheld, and the Defense
dialog says so in place of its Threshold box. Two Strikes still roll at once and print the
Threshold on their card as 0.4.2 did: a Reaction Strike (Counter, Intercept, the riposte), which
answers a Blow already declared, and every character's Strike while the world setting
`attackFlow` is off. That setting governs characters' Strikes; an adversary's attack row always
declares, since adversaries do not roll.

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
Rush would have been cheaper than the Moves. The trail of an earlier Opportunity's Moves (core's
movement history, drawn behind a new drag) is cleared as a combatant's Opportunity begins, by the
client responsible for it (0.5.3; Mike: "My past Move trails should disappear when it is my
opportunity to go again"), which covers the two cases core leaves: a table with no GM connected,
and a lone combatant whose next Opportunity writes no Combat update.

The count runs **from where the drag began, against the actions you have left at your own
Opportunity**, not from the start of the round against a full six. Movement already made has already
been charged, so counting it twice would be wrong: walk 6 feet, then start a fresh drag, and the
next 6 are gold again. Outside an encounter, at someone else's Opportunity, or with action tracking
off, the full six (or the creature's own count) is assumed and the bands simply show what a round of
movement looks like.

One thing is prevented (0.5.3): at your own Opportunity, a drag that would take a second Move or a
second Crawl is refused when the token is dropped, since an Opportunity holds one Maneuver; those
squares are red on the way and the label reads "❶×2 · past one Move", so the refusal is never a
surprise. Everything else stays a warning: the red squares past your remaining actions, the drop
still lands, and the overspend is announced in chat. Client setting `showMoveBands`; a client
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

### Auras: every range on the map

**Every range a creature carries is one kind of thing** (Mike, 2026-10-01; sync report ruling 66):
Natural Reach, Total Reach, an Unwieldy weapon's dead zone, a Torchbearer's fifteen feet of allies,
a Hunter's sixty feet of prey, and any ring the table draws by hand. They live in one list on the
actor, and one renderer draws them all: whole grid cells, outlined along grid lines, measured from
the edge of the token's space with exact diagonals, exactly as the book measures "within N feet".
Foundry 14's own token-attached Regions were considered and rejected: on an exact-diagonal grid
Foundry's circle is an eight-point octagon, which leaves out cells the rules put inside (48 of
them at 15 feet), so a Region would show an ally standing outside a bonus the book gives them.

**Two ways a ring shows.** A *preview* appears on your own screen while you hover, select or drag
a token: every range the token has, labelled, following the drag clone. Reach always worked this
way, and still does. A *pinned* ring stands on everyone's map: while an encounter is running, each
combatant's **Visible** ranges are drawn for the whole table, follow the token and survive a
reload; a combatant added mid-fight lights its Visible rings as it joins; when the encounter ends
they go. Out of an encounter nothing is pinned.

**The Visible mark** is the one decision, and it belongs to whoever owns the creature. Toggle it
from the **Token HUD** (a ring button under the stance button, badged with the count of Visible
ranges, opening a palette with one row per range and a Custom row for a ring of your own: feet, who
it concerns, a label, a colour, and for the GM a GM-only switch; right-click the ring button to
switch every mark off) or from the **sheet** (a ring icon on every Talent and Maneuver row that
carries a range, and on the Overview's Ranges line for Natural Reach, Total Reach and Unwieldy).
Marks are stored on the actor, so new tokens inherit them. Defaults come from the data: Torchbearer
Human is Visible by default, Rally, Mark Prey and Battle Cry are not, and Reach is not, so a fight
looks as it did until someone marks their reach. Colour follows who the effect concerns: allies
green, enemies red, everyone violet; a custom ring takes the colour you pick. Fills are faint up to
30 feet and outline-only beyond; several rings on one token stack as bands, largest first.

**Who sees what.** Everyone sees every pinned ring on a token they can see. A hidden token shows
nothing to players and a dashed ring to the GM; a GM-only custom ring never reaches a player. The
GM has two Token-layer controls: **Suppress auras** (a scene flag; players see no pinned ring until
it is released, the GM's dim, no mark is touched, so an encounter can be set up and revealed on
round one) and **Clear aura marks** (every combatant back to the data defaults, after a confirm). A
client setting mutes the pinned drawing locally.

**Where the ranges come from.** A new **Aura** column on the talent and Maneuver sheets
(`15 ft allies visible`, `30 ft allies`, `60 ft`, `15 ft enemies`, or `none` when the circle is
centred somewhere other than the carrier, as a thrown weapon's rebound is). The converter errors on
anything else and warns when an Effect says "within N feet" and the cell is blank or disagrees, so
the unwritten tiers surface on their sync. "Within reach" and "adjacent" get no cell: the reach
bands are those. The Item carries the range, who it concerns and the default mark, editable by the
GM on its Details tab. An owned Talent from before the column received its compendium copy's aura
in the 0.5.1 migration. The same geometry that draws a ring answers who is inside it
(`aurasOver`), which is the hook for automating the effects later without Regions.

### The Bind on the map

A Bind is drawn between the two bound tokens for everyone who can see both (Mike, 2026-10-01): two
gold rails with rungs for a neutral Bind, labelled at the midpoint with both implements ("Spear /
Shortsword"); a Controlled Bind runs from the Controller with an arrowhead at the Controlled end and
a small Control pill. It follows a drag clone, is dashed while either token is hidden (GM only),
and goes when the Bind ends. The chain is drawn light and beneath the targeting arrows (0.5.2;
Mike: the line was overpowering the distance arrow): thin rails, dim rungs, a small label that
stands off the midpoint far enough to clear the arrow's distance pill at any zoom, so a Bind and a
target between the same two tokens read as an arrow with a chain under it, not the other way
round. The Bound, Controlling and Controlled effects now say what they are
("Bound: Neutral Bind with Evader"), carry the partner as their origin and the implements in their
description, and there is exactly one of them per Bind: condition effects are created under the
static ids the token palette uses, so a rules-set Bound shows lit in the palette and a click there
toggles it rather than laying a twin beside it. A Bind formed from a card by a player whose partner
they do not own is picked up by the partner's owning client (the GM when connected), so both sides
are written.

### Exposed on the token

Exposed is a token status per Zone: Exposed: Head, Torso, Arms, Legs, kept in step with the Zones
by the sheet toggle, the card buttons, the Posture reveal, Recenter and the end of the round, and
toggleable from the token's palette in the other direction. The Bind and Exposed chat cards, the
sheet's Bind line and EXPOSED badge, and the Bound row on the Effects tab open the rules page for
the Bind or for Exposed in the STARWROUGHT Reference journal.

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
specialization in each, and the three Strike kinds with their glyphs. The body block has the Ancestry's
Vigor per level and the Calling's Opening Vigor, Speed with Step, Rush and Leap beside it, Natural
and Total Reach, Space, Load Strain (its tooltip, for the GM and the player alike, gives the Wind
Threshold and says whether your Endure Threshold meets it), Initiative and Familiarity. A row of
table buttons: Recovery check, Refuse Death, a night's rest (showing what it would restore).
Constellations groups your skies by category,
shows rank, Proficiency, points and what the next rank is waiting on, and folds open to the Talents
you own with a Flare toggle on each Constellation; a parent shows its pool and how much is inherited,
and a Combat Style says which parent it is a child of. Its toolbar's **Show every Constellation**
toggle (0.6.3) adds the shipping Constellations you have not opened as dimmed rows with a Flare
control and nothing else, and remembers the choice per client (see Flares). Equipment lays armor out by Zone with the
Zone's Wounds beside its Protection; a party's Item dragged onto the sheet moves from the party's
loot rather than copying, the whole stack (0.7.1; ruling 98; see The party): the player's drag is
a Take over the relay to the GM's client, the GM's the same move made locally. Also Maneuvers,
Effects and Biography.

**Weapon rows.** Each held weapon shows the Strike Attribute that won (glyph and attack modifier,
with the standing attack modifiers such as an Arms Wound's −2 folded in so it agrees with the roll
dialog, and a tooltip saying whether it came from the weapon or a Combat Style; the weapon's Combat
Style field is where the book's "write it on your sheet" lives), Melee or Ranged and the
rank that applies after Handling, its damage (the Quick Strike's in the tooltip) and its reach, and
three Strike buttons: ❶ Quick, ❷ Deliberate, ❸ Committed. Clicking the name uses the default Strike.
Shift-click skips the dialog.

**The Maneuvers tab** (the tab keeps its id `actions` in code). It opens with the **Basic
Maneuvers**: what every character can do, grouped by category in the book's order and foldable,
read straight from the Maneuvers compendium rather than copied onto the sheet, so a rewrite in
`data/maneuvers.xlsx` (the workbook that now authors them, with its own `Enabled?` column; nothing
ships until Mike enables a row, so the panel says so and stands empty today) reaches every
character on the next build. Clicking a name uses it as that
character: the card goes to chat with the character speaking, or, for a Maneuver that rolls a check,
the roll dialog opens. Shift-click skips the dialog. Each row can also be sent to chat, opened, or
copied down onto the sheet to become the character's own to edit. Below that is the list the
character has picked up: dragged from the compendium, made on the tab, or copied down. Parry, Void,
Counter and Intercept appear here as the book's Defense & Recovery Maneuvers do; using one without
its Training Talent is announced, not prevented. Using a Basic Maneuver spends nothing by itself
unless it carries the Reaction trait, in which case its cost comes off the six.

A Maneuver Item carries a **Description** (the flavour line), an **Effect** (the rules),
Prerequisites, Requirements, a Trigger, its cost range, the Reaction trait with its own cost, and
its **Automation** cell, which since 0.9.0 is one rule per line in the framework's grammar rather
than notes (section 7): the Item sheet shows the text and, under it, what the system read from
each line, and nothing acts on a rule yet, since no rule kind exists. The intent still travels with
the Maneuver; the framework is what will read it, one kind at a time.

**Adversary sheet.** Written Threshold-first, because the players roll everything. The header has
Vigor (current, maximum and Temporary, typed directly), Spent, actions per round, Speed in feet per
Move, the Initiative Threshold, the two stance chips, the pips in an encounter, Wounds and Dying,
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
itself is allowed, so a third parent needs no code change). A chassis carries its Vigor (per level
for an Ancestry, Opening Vigor for a Calling, and the sheet labels it so), Size and Speed in feet
per Move. A weapon carries its Style, which is load-bearing for the Strike
Attribute (the field's hint states the rule, the composite bow included), and the sheet calls out
the traits that decide what it can do in a Bind. A Talent or
Maneuver carries its **Aura** (range in feet, who it concerns, Visible by default), editable by the
GM on the Details tab. A Talent, Maneuver or Constellation carries its **Automation** panel
(0.9.0; section 7): the cell's text, editable by the GM, and an As read list of what the framework
made of each line, which with no rule kinds defined says so and lists nothing.

**What a player may change** (Mike, 2026-10-01). The sheet is the character's record, and some of
it is the GM's to write. For a player, Ancestry, Bloodline, Culture, Background, Calling, Ancestry
Vigor, the Calling's Opening Vigor and Ancestry Speed are text, not fields, and each explains itself on hover
(0.5.2): a name shows the chassis's description followed by its effect, with its Root Talent's
description and effect in place of the summary when the character owns that Talent (Human: the
ancestry's line, then Humanity; Soldier: the story, then what it trains), and a number says where
it comes from and what it feeds. The sheet reads the chassis from the compendium, and behind it
from `content/chassis.json`, which `build_foundry.mjs` writes for every authored chassis whether
or not Enabled? let it into the pack, so a Background or Calling switched off after a character
chose it still has its text. Level is a badge with three star pips
beneath it for the Milestones reached (the fourth is the level) and, since 0.7.0, a **Deferred**
badge beside them while the character holds a Deferred Talent Point, with a **Spent** control for
the owner or the GM that lowers the count by one and posts a one-line card (ruling 94; see The
party, below); Hero Points show a count and a
**Spend** button that posts "Hrolda spends a Hero Point (2 left)" to everyone, with no way to add
one (the GM awards them from the party sheet); Refuse Death is disabled unless the character is
Dying and holds a Hero Point; and a Talent,
Constellation or Chassis opens read-only (a lock badge in the header, the plain name, no Effect
controls), while a weapon or a piece of gear stays theirs to rename. The GM keeps every field. A
night's rest no longer hands out a Hero Point. Names print plain beside their one gold cost glyph
(the data keeps "Bull Rush ❷", the sheet shows "Bull Rush" and ❷ once), and a Talent's image opens
it rather than sending it to chat, which the chat control already does. The header's stance chips
are the **Standing stance**: the Combat Prompt pre-selects it, the GM's "Answer with standing
stances" commits it for an absent player, a Reaction Strike reads it, and with the attack flow off
it is the whole answer. The Biography and Notes editors lay out and save again (their edit button
was hidden and their box collapsed to nothing).

**Adjustments are said aloud.** Whatever a player changes by hand on their character goes to
everyone's chat as one "Adjusted" card per edit: actions left, Temporary Vigor, Dying, Hero Points,
Size, Senses, Languages, Familiarity, every Adjustments field, Resistances, Weaknesses and
Immunities, coin, a Zone Exposed or closed by hand, and gear added, dropped, drawn or stowed. What
the system does for them (a Strike's spend, a Reaction charged, Recenter, damage applied, a
Recovery roll, the round's reset) already posts its own card and is not said twice; the GM's edits
are silent.

### The party

**A `party` Actor type with one sheet** (0.7.0; `party-sheet-plan.md`, phase 1; rulings 91 to
95), GM-owned and Observer by default so every player can open it. The sheet is the GM's console
and the players' window at once: one template set that branches on who is looking and on which
members they own, as the character sheet's header does. The party stores only its own bookkeeping
(the members, the session, the last Milestone award for Take back, the GM's notes, since 0.7.1
the purse and the loot Items, and since 0.7.2 the terrain the party is crossing) and reads
everything about its members live at render, never copying a number off a character. It never does
a member's arithmetic: every rule effect it offers (a Flare, a Hero Point, a rest, a Milestone, a
check, an Initiative) runs on the member's own Actor through a method that already exists and
already posts its card, so the party adds buttons and a handful of cards, not a second rules
engine. Its data model extends `TypeDataModel` directly, never `SwActorData`, so it has no Zones,
Wounds, Vigor, stance or actions; a party is never a combatant, and nothing draws or counts its
token (section 9). Phase 1 (0.7.0) is the party, the session, the awards and the Skills grid;
phase 2 (0.7.1; rulings 96 to 100) is the loot, the purse and Ask everyone; phase 3 (0.7.2;
rulings 101 to 107) is the road: each member's Exploration Activity, the party's Travel Speed, the
Fatigued gate, Say the plan, and Begin the encounter with Initiative by Activity, and its second
cut (0.7.3; rulings 108 to 110) remembers each member's road roll on their row and lets Begin the
encounter keep it as the Initiative roll; phase 4 (0.7.5; rulings 112 to 114) is Downtime, the
plan's last: the days the GM gives, the three Downtime Activities printed from the pack, Train
through the shared Flare picker, and the Retrain and Provision lines. The plan is built.

**The roster and status board.** Always open above the tabs, one row per member, every number on
it the member's own derived data, read and never recomputed: portrait (click opens the sheet),
name, the level badge with the three Milestone pips and the Deferred badge while the character
holds a Deferred Talent Point, Hero Points with the GM's award controls, the Vigor bar with
Temporary Vigor and the Spent badge, Wounds with the Zones on hover, Dying N, Fatigued N, Load
Strain with the Wind tooltip the character sheet builds, Speed, the owning players' colour dots
(dim when not connected), the Flared Constellations as chips, a GM-only Flare plus, and Remove
with a confirm. Members join by drag (a linked token resolves to its Actor; an unlinked token, an
adversary, a party or a compendium Actor is refused with a notice) or by the toolbar button that
adds every player's assigned character once, in insertion order, which is the order. A member
whose Actor has been deleted prints as a missing row with Remove alone, and the roster is the GM's
list rather than the user list, so a character reassigned to another player stays until removed.
Membership posts nothing: the roster is the record.

**Session start and Hero Points.** Begin session, after a confirm, raises the session number and
sets every member's Hero Points to exactly 1 (ruling 93): PHB P73 and P434 say each session starts
with 1 and the GM awards more, and Refusing Death's "until the next session" reads the same way, so
a GM who wants a player to keep a point adds it back in public. On each row the GM has a plus that
asks for an optional one-line reason and writes +1, refused with a notice at the maximum of 3
before anything is written, and a minus as a correction. **The party rests** runs
`restForTheNight()` on every member in turn, each posting its own rest card exactly as the sheet's
Rest button does, then one party line; the confirm names the members whose worn Torso piece lacks
Comfort, and the armor rule itself stays the table's (section 9).

**The Milestone award, the Deferred point and Take back.** Award a Milestone opens a dialog
listing every member ticked, with a preview line each: who reaches Milestone 2 of 3 and may spend
a Milestone Talent Point now in a Flared Constellation (named); who reaches it with no
Constellation Flared, so the point is Deferred; who reaches the 4th and so the level, with Vigor
before and after and a Comet. A Milestone belongs to the table (ruling 91): untick a character who
has left or sat the arc out. Confirm disables the button while it runs and writes each ticked
member: `milestone + 1`, or for a member at 3 `level + 1` and `milestone 0`, then reads the
recomputed maximum and raises current Vigor by the same rise (ruling 92; P62 says "Vigor rises",
and a character would otherwise come out of a level at 20 of 36), and `deferred + 1` for a member
with no Flare receiving a point (ruling 94). The before-state of every member written is kept on
the party; **Take back** reverses exactly those numbers on exactly those members, refuses with a
notice when any of them has since been edited by hand, posts a card and forgets the award. No other
undo: a Talent already spent is the player's to move. Rank unlocks need no write; the card says
when 5th, 10th or 15th opens one. The system still does not police the spend: this part announces
and remembers.

**Deferred Talent Points** (ruling 94) are the book's own exception to "never banked": Table 4
says a Milestone Talent Point with no Flared Constellation to receive it "becomes a Deferred Talent
Point", spent "the instant a Constellation is Flared". The character carries a count,
`system.deferred`, raised by an award that finds no Flare and lowered by **Spent**, a control on
the Deferred badge (beside the Milestone pips on the character sheet, and on the roster) for the
owner or the GM, which posts a one-line card spoken by the character ("{name} spends a Deferred
Talent Point."). The lit Flare card carries a reminder line while the count is above 0. It is a
reminder with a number on it, not a budget: nothing stops a Talent drag, and the count is not
decremented when one lands.

**The Skills grid.** A tab with Constellations as rows and members as columns, because the
question at the table is "who has Stealth". The four Defenses first, each cell showing the
Threshold (what a Sneak, a Feint or a Lie is measured against) with the modifier and rank on hover;
then Initiative, live only while a Combat holds the member; the seven Skill Constellations; Melee
and Ranged, rank and Proficiency with the inherited pool on hover; and one row per Lore any member
has opened, blank for the rest. A Skill cell shows the rank letter and the signed modifier from the
same preview the roll dialog uses (`SwCheck.previewTotal`), so Stealth carries Load Strain, a
closed helm reaches Awareness and Initiative, and a Frightened member's whole column moves within
the debounce; Untrained is dimmed at +0, the Threshold is in the tooltip, and the best in each row
is marked gold, ties all marked. Clicking a cell rolls that check as that member, through the
member's own `rollCheck`, `rollDefense` or the Combat's Initiative roll, so the card speaks as the
member and can Flare; Shift-click skips the dialog as the sheet does.

**Ask everyone** (0.7.1; plan, part 7; ruling 100). Each row header of the grid carries, for the
GM, an Ask everyone control: a small dialog with an optional Threshold and a checkbox, "players see
the Threshold", then one public card spoken by the party ("Everyone roll Awareness.") with a row
per member and a Roll button on each. The button is live for that member's owner and for the GM,
and for nobody else (the same render pass that hides other owners' buttons on every card hides
these); it calls the member's own `rollCheck` for a Skill or a Lore and `rollDefense` for a
Defense, so the card speaks as the member and can Flare, with the Threshold prefilled only when
the card carries one. A Threshold the GM kept hidden is never in the DOM and never in a flag a
player can read. Search and Investigate say the GM applies the roll to the Thresholds, so a blank
Threshold is the normal case and the GM reads the totals off the cards.

**The loot** (0.7.1; plan, part 6; rulings 96 to 98). A party holds embedded Items of the four
physical types alone, weapon, armor, shield and gear; a Talent, a Constellation, a chassis or a
Maneuver dropped on it is refused at creation with a notice. The Loot tab lists them one to a row:
image, name, quantity, the price string the Item carries, a type tag, and the controls that belong
to whoever is looking. Items arrive by drop from the Equipment compendium, the Items sidebar or a
character sheet (the GM's drop from a character copies, as Foundry does). For the GM the quantity
is an input, **Give to** opens a member picker and moves the Item onto that member, and **Delete**
removes it; the GM's own drops, edits and deletes post nothing. A player who owns a member sees
the same rows with **Take** on each, which asks which member when they own two and how many when
the stack is above one; an empty tab says so. Carry state means nothing on a party, so it is
ignored there, and an Item that reaches a character through Take or Give arrives carried, so
drawing it is an Interact as the book prices it. The row prints the price the Item carries and
nothing computes with it (section 9): the book has no shared loot and no party purse, so the tab
moves Items and values nothing.

**Take and Give, over the relay** (ruling 97; the plan's risks 5 and 6). A Take is two writes a
player cannot make alone, a create on their character and a decrement on a party they only
Observe, so the whole move runs on the active GM's client, asked over the system socket as a
player's damage Apply, a reroll against a hidden Threshold and an Expose on another's body are
(see The attack flow, Who may do what). The asking client emits `party:take` or `party:give` with
the party's uuid, the Item's id, the character's uuid and the count, addressed to the active GM
alone, and says it was sent; the GM's own Take or Give runs the same code locally with no socket.
The GM's client ignores a message not addressed to it, acts only for a sender the server stamped,
re-reads the party, the Item and the character from their ids and trusts the payload for nothing
but those ids and the count; checks that the asker owns the destination character for a Take or
the source character for a Give, that the character is a member of that party, that the Item is
physical and the count is in stock; creates on the destination first and decrements or deletes the
source second, so a failure between the two leaves a duplicate and never a loss; posts the card;
and answers done or refused (gone, not enough, not yours, no member, not physical) to the asker
alone, as a notice. Requests are served in arrival order on the GM's client, so two players taking
the last potion resolve as one Take and one refusal. With no GM connected the controls say so and
write nothing (section 9). The drops go the same way (ruling 98): a party Item dragged onto a
character sheet is a Take of the whole stack rather than Foundry's silent copy, whoever drags it,
one of a player's own Items dragged onto the party sheet is a Give of the whole stack, and the Loot
tab's Take button is where a count is asked; a player's drop from the compendium or the sidebar
onto the party is the GM's alone and is refused with a notice.

**The purse** (ruling 99). `system.currency` on the party, gp, sp and cp in the character's own
shape: inputs for the GM, read-only numbers for a player. **Split among the party** opens a dialog
listing every member ticked, then turns the coin to copper, divides it equally among the ticked
members in one batch write (announced, so no Adjusted card doubles it), writes the remainder back
to the purse and posts one card spoken by the party listing each share and what stayed. There is
no Contribute: the GM types coin in, and who gets what beyond an equal share is the table's.

**On the road** (0.7.2; plan, part 8; rulings 101, 102, 106 and 107). A third tab, after Skills
and before Loot, open to players. Each member has an Exploration Activity, and the pick is the
character's (ruling 106): `system.exploration { activity, constellation }` on the character, the
compendium id of an Activity in the Actions pack's Exploration Mode folder ("" is Travel, the
default) and, for Investigate, the slug of the Lore or Skill chosen. It is written directly by the
member's owner or the GM (an owner may write their own Actor, so unlike a Take it needs no relay
and no GM connected), announced with `swAnnounced` so the Adjusted card never doubles it, and said
in one line spoken by the member ("Wren's Activity is now Search (Half)."; "Toric Investigates
with Lore (Warfare)."). The Activity Items themselves carry what each Activity does, written by the
pipeline from two positional columns on the roster's `explorationActions` rows (rulings 103 and
104): `system.exploration { travel, check, initiative, effect }`, the Travel word, the
Constellation the Activity rolls now (Search: Awareness; Look Harmless: Guile; Avoid Notice:
Stealth; Investigate: the member's own pick), the Constellation it rolls for Initiative (Awareness
unless the row says otherwise: Hustle Athletics, Look Harmless Guile, Avoid Notice Stealth,
Investigate the pick), and an effect tag for the two Activities that do something at the start of
an encounter rather than roll (scout, defend), so the panel reads the Item and holds no table of its
own, and a row Mike adds needs no code unless it does something new. Avoid Notice, which P342 names
and the Example of Play rolls while Table 95 has no row for it, is the eighth row and ships in the
pack, the web app and the compendium docx ahead of the book (ruling 103; the proposal adds the row
to Table 95). One row per member: portrait, name, the Activity select (the folder's Items in folder
order, cached per session as the Basic Maneuvers are; a world action Item of the same name and
category replaces the printed one), the Travel word, the Initiative Constellation the pick implies,
the Constellation select for Investigate (the member's opened Constellations plus their Lores), the
warnings in small amber type, the Roll button when the Activity rolls now, since 0.7.3 the
member's remembered road roll as a chip ("Stealth 17"; below), and the member's
Combatant state while a Combat holds them (the number once rolled; "ready: Stealth" when flagged
and not yet rolled). **The warnings** are read from live data and never enforced (ruling 107):
Look Harmless with a held weapon whose reach is above 0, named, or worn armor whose Load totals
more than 1, with the total (the Activity's Requirements); Investigate with no Constellation chosen;
a Constellation left to the member's pick for Initiative with no pick made, which falls back to
Awareness. **The Roll button** (the member's owner or the GM) rolls the check-now Constellation as
the member with no Threshold through the path Ask everyone uses, a Defense as the Defense check and
a Skill as a check, so Search posts the ordinary card and the GM applies the total; Investigate
opens the Relevant Check picker on the chosen Constellation (`rollRelevantCheck` takes a `slug` to
preselect since 0.7.2). A player's own rows are live and the others read-only; every control a
player may use is an anchor rather than a form element, since DocumentSheetV2 disables form
elements for an Observer. The GM gets working selects on every member.

**The remembered roll** (0.7.3; rulings 108 and 110). When a member rolls the Constellation their
Activity rolls now, from the row's Roll, an Ask everyone card, a Skills grid cell or their own
sheet, the result is remembered on the character as `system.exploration.roll { slug, total,
natural, time }` and shown on their row as a chip after the Initiative tag: a die, the
Constellation and the total ("Stealth 17"), with the natural die and when it was rolled on hover
("Wren rolled Stealth 17 (d20 12) 3 minutes ago; it stands as the Initiative roll when the
encounter begins, unless the GM unticks it"; the time is "just now" under a minute, then "a minute
ago" or "{n} minutes ago", "an hour ago" or "{n} hours ago", and "a day ago" or "{n} days ago").
The record is made on the roller's own client from the `starwrought.check` hook
(`rememberActivityRoll` in `helpers/party.mjs`, registered once at ready by `registerRoadHooks`),
and only for a public check: the result's kind must be "check", its Constellation the one the
Activity rolls now (`activityCheckSlug`: the Activity Item's check slug, or the member's own pick
for Investigate), the roller a character the user owns, the total a number, and the card public (a
blind or whispered roll is not remembered, since the chip is). An Initiative or an Attack roll is
never remembered, nor a Defense rolled in answer to an Attack (the engine's kind "defense"), nor a
check in another Constellation (Stealth while Searching gets no chip, because Search rolls
Awareness); a Defense rolled for its own sake arrives as a check from every entry point, which is
how a Search's Awareness is remembered from the sheet's Defenses block or the grid as well as from
the row; and the attack flow's blind roller never reaches the hook. The write
is announced, so no Adjusted card, and posts nothing of its own: the card the roll posted is the
record of the die and the chip is a pointer to it (ruling 110), read by every client that can read
the character, as the pick is. It stands until a newer roll in the same Constellation replaces it
or the pick changes: `setActivity` clears it in the same update, because a Search is not an Avoid
Notice, and a roll whose Constellation is no longer the Activity's is stale and shown as nothing.
The chip takes the Initiative tag's colour while the roll's Constellation is the one the Activity
rolls for Initiative, which is when Begin the encounter can keep it (Keeping a road roll as
Initiative, below), and is dimmed otherwise, with "Initiative rolls Awareness instead" on hover;
with the eight shipping rows every Activity that rolls now rolls the same Constellation for
Initiative, so the dim chip waits on a row whose two columns differ. Say the plan prints the roll
at the end of the member's line (" Rolled Stealth 17 on the road."). Nothing computes with the
record except a kept Initiative.

**The party's Travel Speed** (ruling 102), the tab's top line, display only: each member's Speed
(`system.moveSpeed`, so a Speed adjustment counts) times their Activity's multiplier (Full 1, Half
½, Double 2), the lowest of those times the terrain (normal 1, Difficult ½, Greater Difficult ⅓;
PHB P343 to P344), through the book's three formulae (`SW.TRAVEL`: feet a minute × 40, rounded;
miles an hour ÷ 2, floored as the character's own figure is; miles a day × 4, rounded). "120 feet
a minute · 1 mile an hour · 12 miles a day", then "Wren sets the pace (Search, Half)" naming the
pacesetter (the lowest effective Speed; the first on ties), the ten-minutes-per-location note while
anyone Searches (P346), and the terrain, a select for the GM (`system.travel.terrain`, the party's
one field for this phase) and a word for a player. Nothing moves a token at any pace (section 9),
and a party with no members prints blanks and zeros.

**The Fatigued gate** (ruling 101). The book's Fatigued row says "can't use Exploration Mode
Activities", which read literally stops the party once a fighter in plate is winded, so a Fatigued
member Travels and does nothing else: while their Fatigued is above 0 their select is locked to
Travel with the reason as its tooltip ("Hrolda is Fatigued 2 and can only Travel"), the speed line
and the cards read them as Travelling, a pick of anything else is refused with a notice before it
is written, and the stored pick is left as it was, so it comes back the moment the Fatigue ends
(ten minutes' rest by the Fatigued card's button, or a night's rest; ruling 81). The proposal's
sentence says so in the book.

**Say the plan** (GM only; the plan's risk 12). One public card spoken by the party: a line per
member ("Wren: Search (Half); Initiative: Awareness"; "Toric: Investigate (Half), with Lore
(Warfare); Initiative: Lore (Warfare)") with that member's warnings dim beneath, then the speed
line ("The party moves at 120 feet a minute, 1 mile an hour, 12 miles a day over Difficult
terrain: Wren sets the pace (Search, Half).") and the ten-minutes line while anyone Searches. Since
0.7.3 a member's line ends " Rolled Stealth 17 on the road." while a roll is remembered, and says
nothing more when that roll is usable for Initiative, since the Begin dialog is where that is
asked. No confirm. A pick posts one line and Say the plan is the record; should the one line prove
too many, the pick goes quiet and this card stands alone.

**Begin the encounter** (0.7.2; plan, part 9; ruling 105). GM only, with a scene viewed (the button
is dimmed with a tooltip otherwise). It finds an unstarted Combat on that scene or creates an
active one, adds every member's tokens on the scene as Combatants (one per token, as the tracker
does; a Combatant already there is reused; a member with no token is named in the card and
skipped), and writes two flags on each member Combatant: `initiativeConstellation`, the
Constellation the member's Activity names for Initiative (Awareness when it names none;
Investigate's pick, or Awareness with a note when none is chosen), and `initiativeModifiers`, one
+1 Situation entry per Scout among the other members present ("Scout (Hrolda)"; two Scouts give
each other one and everyone else two of the same type, of which one applies, as the book's stacking
rule says; a member with no token on the scene neither gives nor gets one, and an absent Defender's
shield stays as it was). A Combatant that has already rolled is left alone, its flags not rewritten, and named. A
Defender's held shield begins Raised: written with no action spent and no card of its own (the
Raise a Shield card would print a cost), and lowered at the Defender's next Opportunity as any
raised shield is. Then one public card spoken by the party: "The encounter begins.", a line per
member ("Wren (Avoid Notice) rolls Stealth for Initiative, +1 Situation from Hrolda."), "Hrolda
may Step ⓿ on rolling Initiative." for a Scout, for Look Harmless the GM's comparison line with the
Activity's four degrees printed from the Item, to be applied by hand against each enemy's Awareness
Threshold (adversary Thresholds never reach a player), and, in the card's notes, for an
Investigator "Toric rolls for Investigate only if the encounter is related to it: the GM's call,
before the die." Nothing rolls here: players roll their own Initiative from
the tracker or the sheet, the GM rolls for the absent, and every roll reads the flags (see
Initiative, under What the system works out for you); since 0.7.3 a roll already made on the road
may be kept instead (next).

**Keeping a road roll as Initiative** (0.7.3; ruling 109). The book says that when an encounter
begins a character "can roll" their Activity's Constellation; a roll already made in that
Constellation on the road is that roll, so Begin the encounter offers to keep it rather than have
the die thrown twice. Before anything is written it gathers the present members (a token on the
viewed scene) whose remembered roll is in the Constellation their Activity rolls for Initiative and
whose Combatant on the scene's unstarted Combat, if there is one, has not rolled (`keepableRolls`;
no Combat or no Combatant counts as not rolled); with none, Begin runs with no dialog, as before.
Otherwise a dialog with an intro line and one checkbox per such member, ticked by default ("Keep
Wren's Stealth 17 as Initiative"), and Begin and Cancel; Cancel writes nothing. The Combat, the
Combatants and the two flags are then written exactly as before, and each kept member's unrolled
Combatants have their Initiative set (`combat.setInitiative`) to the roll's total plus Initiative's
own terms, the arithmetic under Initiative (section 2); the card's line for them replaces "rolls
Stealth for Initiative" with "Wren keeps the Stealth 17 rolled on the road as Initiative." or,
when the terms move it, "Wren keeps the Stealth 17 rolled on the road as Initiative, +1 for
Initiative's own terms (the helm, the Scouts' bonus, the sheet's Initiative adjustment): 18.",
the Scout's Step and
the Defender's shield lines following as they do. An unticked member rolls fresh from the tracker
or the sheet as before; a kept member has rolled, so a second Begin names them and leaves them
alone; the remembered roll stays on the character and its chip on the row. The GM decides per
member, every time: the record is a convenience, and the box is the whole of the enforcement.

**Downtime** (0.7.5; plan, part 10; rulings 112 to 114). The foot of the On the road tab, under
its own heading, open to players as the rest of the tab is. Downtime is a panel, not a mode: the
book's Downtime is days the GM gives ("you have ten days", P348) and three Activities, and the
panel prints both and runs nothing. **The days** are `system.downtime.days` on the party, an
integer the GM types in the party form's own field and a player reads as a number, with the P348
hint beside it (the GM typically tells you how many you have before the world begins to move
quickly again); nothing counts them down, spends them or refuses anything for want of them
(section 9), and nothing is derived from them. **The Activities** print from the Actions pack's
Downtime Mode folder (`downtimeActivities` in `helpers/party.mjs`, the category read off the Item;
cached per session as the Exploration Activities are and forgotten with them when a world action
Item changes; a world Item of the same name and category replaces the printed one), one row each
with the Duration tag from the Item's Requirements and the Effect: Retrain (1 month), Train (7
days), Provision (1 day). The panel holds no table of its own, so a row Mike adds to the roster's
`downtimeActions` block appears with no code change, and an empty folder says so. **Train** is the
one control: under the Activities, one entry per member (portrait, name, Train), live for the
member's owner and for the GM and offered to nobody else. It opens the shared Flare picker with no
reason field (the reason is the training), and a pick lights that Constellation through the
member's own `toggleFlare`, so the Flare card is posted as every Flare is, spoken by the member and
public, its second line "Flared by seven days' training." in place of the GM's award line, the
Deferred reminder following while the member holds a Deferred point; Cancel writes nothing. The
character then records `flags.starwrought.trainedAt { level, milestone, time }`, and while that
equals the member's level and Milestone count exactly the Train control is amber with "Train
already used since the last Milestone" on hover, and the card says so too when a second Train is
taken anyway; it refuses nothing (decision 14: the system prevents nothing anywhere else, and a GM
may rule an exception). The next Milestone award makes the record stale by comparison and nothing
clears it; a flag never written reads as never trained. A Constellation already lit is not lit
again (the write is skipped), but the training line is still said, with "<name> was already Flared;
nothing on the sheet changes." beneath it, so a Train is never silent; that line reaches the
critical card's Flare button and the roster's GM award too when they pick a Flared Constellation,
where 0.7.4 posted a plain Flared card. The flag write is an
`updateActor` on the member and the road part redraws on it, so the amber mark appears as the card
lands. **Retrain and Provision** carry one line each saying they are done by hand: Retrain's
Talent Point is moved by dragging as today, with the restrictions the player's and the GM's to
honour; Provision's buying and selling, the half price and the uncommon-goods check are the
table's. The system adds no control for either (ruling 114). The book says Train may be used "only
once between Milestones"; the system counts that for each character, which is what the downtime
proposal asks the book to say (the plan's handbook item 11; see the 0.7.5 changelog entry).

**What the player sees, and what the GM sees.** The GM sees everything and holds every party
write: membership, Begin session, the awards and corrections, the night, the Milestone and Take
back, the Flare plus, Remove, the Notes tab, the loot's quantities, Give to and Delete, the purse
and Split, Ask everyone, since 0.7.2 the terrain, any member's Activity, Say the plan and Begin
the encounter, and since 0.7.5 the Downtime days and Train on any member. A player sees the same
roster, the same grid, the same loot and the same road,
Thresholds included (ruling 95; a world setting is one line if the table objects, and adversaries'
Thresholds never appear on the party sheet), read-only but for a few live things: portrait clicks
on any member, the Flare chips on a character they own (a click puts one out through
`toggleFlare`, which posts its card), the Spent control on their own Deferred badge, Take on a
loot row when they own a member, a drag of their own gear onto the party, the Roll button
with their member's name on an Ask everyone card, and on the On the road tab the Activity and
Investigate Constellation of a member they own and that member's Activity Roll (ruling 106; the
remembered-roll chip on every row is read by all and pressed by nobody, since 0.7.3), and since
0.7.5 Train on a member they own, the Downtime days a number to them; grid
cells roll only for members they own, and a click on another member's cell does nothing. A player
who owns no member sees the board and an empty-state line. Every action handler re-checks
permission before writing (the GM for party writes; the actor's owner for a put-out Flare, a
Spent, an Activity pick or a Train; and the relay checks a Take or Give again on the GM's client), since ApplicationV2 actions
fire regardless of editability, and every write to a character
goes through the same `swAnnounced` path the rest card uses, so the Adjusted card never doubles a
party card. Observer ownership means every player can read the document, the Notes tab, the loot
and the purse included,
from the console: it is a convenience, not a vault, and nothing secret belongs on the party.

**The cards.** Spoken by the party: Begin session ("Session 12 begins. Every character starts with
1 Hero Point.", with a line per member whose count changed, "Wren: 3 to 1"); the Milestone award,
one line per member ("Hrolda reaches Milestone 2 of 3: a Milestone Talent Point, to be spent now
in a Flared Constellation: Melee, Athletics."; "Wren reaches Milestone 3 of 3: no Constellation is
Flared, so the point is Deferred: spend it the instant one Flares (Deferred held: 1)."; "Kessa
reaches the 4th Milestone: level 3. Vigor 36 to 45. A Comet: a Talent Point for any Constellation,
Flared or not."); Take back; the party's line after the night; the Split card listing the shares
and the remainder (0.7.1); the Ask everyone card ("Everyone roll Awareness.") with its Roll
buttons; and, since 0.7.2, Say the plan (a line per member, with the remembered road roll since
0.7.3, the warnings, the speed line) and
Begin the encounter ("The encounter begins.", who rolls what for Initiative and from whom the +1
comes, since 0.7.3 who keeps a road roll instead ("Wren keeps the Stealth 17 rolled on the road
as Initiative.", with Initiative's own terms named when they move it), the Scout's Step, Look
Harmless's degrees for the GM, Investigate's "if related", and who
had no token or had already rolled). Spoken by the member: a Hero
Point awarded ("The GM awards Hrolda a Hero Point: carrying Toric out of the fire (2 of 3).") or
corrected ("Hrolda's Hero Points corrected to 1."); a Deferred point Spent; each member's own rest
card; the Flare card `toggleFlare` already posts, with "awarded by the GM" and the reason when
the GM lit it from the roster, or, since 0.7.5, "Flared by seven days' training." when Train lit
it, with the warning line when Train was already used since the last Milestone; since 0.7.1,
under a title naming the direction ("From the
party's loot", "To the party's loot"), a Take ("Hrolda takes Longsword."; "Wren takes 6 × Arrows
(14 left)."), a Give ("Hrolda gives 3 × Torch.", the Item's name as it is) and the GM's Give to
("Toric is given a Dagger."); and, since 0.7.2, an Activity pick ("Wren's Activity is now Search
(Half)."; "Toric Investigates with Lore (Warfare).") and the ordinary check card an Activity's
Roll posts, with no Threshold. Membership, a Remove, the GM's notes, the terrain, a Defender's
shield raised by Begin the encounter, the remembered road roll (since 0.7.3; the check's own card
is its record), and the GM's
own drops, edits and deletes on the loot post nothing.

**What re-renders it.** The sheet registers the member hooks once when it opens and lets them go
when it closes: `updateActor`; an Item created, changed or deleted on a member (a Talent, a
Constellation, a helm donned); an Active Effect created, changed or deleted on a member (Fatigued
and Frightened are effects). It re-renders on a timer of about 150 ms, never a
requestAnimationFrame latch, and only when the changed document is a member or belongs to one, so
six members and the attack flow running do not redraw the board on every pip. Since 0.7.1 the
party's own Item hooks and its own `updateActor` (a Take served on the GM's client, a Give, the
purse edited or Split) redraw the loot part on the same timer, and since 0.7.2 the road part
redraws on the member hooks (a pick is an `updateActor` on the member; Fatigued is an effect), on
the party's own update (the terrain) and on the Combat hooks (a Combat or a Combatant created,
changed or deleted), so a member's Initiative appears on their row as it is rolled (since 0.7.3
the remembered roll is one such `updateActor` on the member, so the chip appears as the roll's
card lands, and since 0.7.5 a Train's `trainedAt` flag is another, so the amber mark appears as the
Flare card lands). Nothing
member-dependent is computed in the party's own `prepareDerivedData`; it is all computed at render
from the resolved members, because one Actor's derived data must not depend on another's prepare
order.

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
Strike back, each shown only to the side it belongs to. An Expose is one side's choice on the other
side's body, so when the chooser cannot write that actor (a player's Committed Hit on another
player, or on an adversary) the GM's client marks the Zone, asked over the system socket with the
card's id, the Zone and the two sides; it checks that the asker owns the choosing side and that
both sides are the card's, and answers with the Zone (0.5.3; Mike: "he could not expose my zone
because my character is not owned by him"). The Zone a Controller opens on a Bound partner goes the
same way. A Strike at a target the weapon cannot
reach says so on the card and is never refused; since 0.5.3 the cards the attack flow resolves say
it too (they had the note switched off, so a partner Striking from outside his own reach went
unremarked).

**Reroll** (0.5.3; Mike: "Players (and the GM) should have a 'reroll' option on the Attack, for
special cases", "and for Defense rolls, too"). Every Attack and Defense card offers Reroll to the
roller's owner and to the GM. A small dialog takes the reason, for the record, and offers to spend
a Hero Point when the roller is a character holding one. The d20 is thrown again with the first
die's formula; everything else stays as it was (the weapon or attack row, the Strike, the
defender's Defense, Reaction and Posture, the Proficiency rolled, the modifiers, the Threshold
where it was shown), and nothing is paid again: the Reaction was charged when the first die
landed and the Strike's actions were spent before it. The new card says it is a reroll and why;
the old card stays in the record, dimmed, with its total struck through and every control
disabled. When the card hid its Threshold (an adversary's, inside the attack flow) the die is
thrown on the roller's client and read on the active GM's client over the socket, which checks
that the die is a Roll of the first card's own formula and that the asker owns the roller, reads
the Threshold again from actor data, and answers with the outcome; with no GM connected the player
is told so. Inside the flow a player attacker's one die resolved against every defender, so
rerolling any of those cards rerolls them all with the one new die, each against its own
Threshold. The attack card that carried the pairings' outcomes follows the new cards, with a line
in its log. Rerolling a card that was itself rerolled rerolls the newest; a superseded card refuses.
The reroll is of the die, not of what the table did with it: damage already applied, a Zone
Exposed, a Bind formed or a Constellation Flared from the first result all stand, and the GM
unwinds them by hand; the new card offers its Position again. An adversary's Threshold is read
from its sheet as it stands when the die is read again, and a Reaction the first card never
charged is charged now. The Hero Point is spent only once the reroll has gone through, so a
refused or stale request costs nothing.

**Damage cards** show the formula broken into its parts, the Deadly die, a Zone selector (locked to
the Torso for a Quick Strike, offering the Exposed Zones for a Deliberate or Committed Hit, open for
a Graze or a Critical Hit) with a note saying whose choice it is, and Apply / half / heal. Apply
lands on the creature the card was rolled against (0.5.3). Your own client spends it when you may
write that actor; otherwise the active GM's client does, asked over the system socket with the
card's id, the Zone and the multiplier. It reads who was hit and how hard from the card itself and
who is asking from the server's stamp on the event, allows only the card's author or the
attacker's owner, holds a Quick Strike to the Torso, and answers you with "Applied to {name}" or
the reason it refused; the applied card still goes to the GM alone for an adversary, and with no
GM connected you are told so. Shift-click spends the card on your selected tokens instead (the
GM's redirect, or a player taking an adversary's blow on themselves), and a card rolled with no
target falls back to the selection, then your targets. Until 0.5.3 the selection came first, so a
player's own Strike landed on their own selected token.

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
round while Dying, with a roll button; the Wind check at the end of every round, for a fighter
with Load Strain 1 or more whose Endure Threshold is below 10 + Load Strain (one whose Threshold
meets it is exempt and gets no card), with an Endure button and, on a failure, a card naming the
new Fatigued value (1 the first time, one more each time after, to 3) and carrying the **Ten
minutes' rest** button that ends the condition, for the owner or the GM, with a one-line card when
it does; and Persistent Damage at the end of every round,
with a roll button, and after the roll an Endure button to end it (except the Torso bleed, which
only treating the Wound closes) and a note that the amount is applied on the sheet.

**Intercept cards**, whispered to the foe's owners and the GM, with a Quick Strike button for a
character or an attack button for an adversary; the adversary's answer card goes to the mover with
a Defense roll button against the attack's Threshold.

Also: Move, Step and Rush cards saying what a drag cost and why; the Pass card; Bind formed, Control
taken and Bind ended; Exposed; Give ground; Step; Recenter; Treat Wound; a night's rest; Refuse
Death; a Hero Point spent; the **Flare** card, lit or put out, from a critical's card or from the
sheet (0.6.3), with the GM's reason when it was awarded from the party sheet (0.7.0) or "Flared by
seven days' training." when the party sheet's Train lit it (0.7.5); the
**party's cards** (0.7.0: Begin session, a Hero Point awarded or corrected, the Milestone award
and Take back, the party's night, a Deferred Talent Point Spent; 0.7.1: a Take from the loot, a
Give to the party, the GM's Give to, the Split, and Ask everyone with a Roll button per member;
see The party, under Sheets); the
**Adjusted** card for a player's hand edits (0.5.1); and the overspend card,
whenever something happened without the actions to pay for it. The Bind and Exposed card titles
open their rules pages.

---

## 5. Conditions

All 28 registered as toggleable token statuses: Off-Guard, Wrong-Footed, Frightened N, Prone,
Grabbed, Restrained, Heedless, Stunned N, Slowed N, Fatigued N, Blinded, Deafened, Concealed, Hidden,
Undetected, Unconscious, Dying N, Wounded, Spent, Bound, Controlled, Controlling, Preparing, Dead,
and Exposed: Head, Torso, Arms and Legs.

Off-Guard, Frightened N and Fatigued N feed straight into the derived numbers (Fatigued N into attack
rolls as well as Evade and Guard; a failed Wind check raises it one step at a time to its maximum
of 3; the book ends it "after ten minutes of rest", and the table says when those have passed: the
Fatigued card's Ten minutes' rest button or a night's rest clears it, and the Combat's end does
not); Grabbed and Restrained make Evade unavailable; Slowed N takes
its actions at the start of the round. The system keeps
Dying, Wounded, Spent, Bound, Controlled, Controlling, Preparing and the four Exposed in step
between the sheet and the token, sets Prone from a final Legs Wound, Unconscious from Dying and
Dead at Dying 5, and clears Spent when Vigor returns. Every condition effect sits under a static
id, the one the token palette looks for, so a status the rules set shows lit there and a click
toggles it instead of laying a twin beside it (0.5.1, with a migration that brought old worlds'
effects under those ids). Persistent Damage is an end-of-round card rather than a status. The rest
are markers for the table.

---

## 6. Settings

| Setting | Default | What it does |
|---|---|---|
| Open Constellations automatically | on | When a Talent arrives on a character with no Constellation Item for it, fetch it so the sky is drawn |
| Offer a Flare on a critical | on | Put the Flare button on critical chat cards |
| One Maneuver per Opportunity on the map | on | At a combatant's own Opportunity a drag may be one Step, one Move, one Crawl or one straight Rush; a second Move's worth is refused before the token lands. Off, the move lands and its card counts the Moves |
| Track the six-action round | on | Spend actions automatically for Strikes, Reactions, Raise a Shield, Recenter, drawing or stowing a weapon, and movement (a Step, one action per Move, or a Rush). Encounters only; the pips can always be corrected by hand |
| Remind about Recovery checks | on | Post a Recovery card to the owner at the start of each round while a character is Dying, which is when the check is made |
| Show Total Reach on the map | on | Draw the reach bands around the token you control or hover over. Per client |
| Colour the drag ruler by Moves | on | Colour the squares a drag crosses by which action pays for them: a Step, each Move, a Rush, or past what you have left. Per client |
| Draw targeting arrows on the map | on | An arrow from each token to what it targets, in the targeting player's colour: every arrow for the GM, only their own for a player. Per client |
| The attack flow | on | A character's Strike at a target declares first; defenders commit a Defense and an answer in private, all reveal at once, then the player rolls. Off, a character's Strike rolls at once against the standing stance, as 0.4.2 did; an adversary's attack row always declares |
| Show a character's Threshold to the attacker | off | After the reveal, print the defending character's Threshold on the attack card and the resolution card for the attacking player. Inside the flow an adversary's Thresholds are never printed for players |
| Show pinned auras | on | Draw every combatant's Visible ranges on the map while an encounter runs. Off, only the hover preview draws. Per client |
| Range ring contrast | Normal | How boldly the reach and aura rings are drawn. Every ring has a dark halo under its outline so it reads on a pale floor; Strong thickens the lines and deepens the fills. Per client |
| Show every Constellation | off | On the sheet's Constellations tab, list every shipping Constellation the character has not opened as a dimmed row with a Flare control, so one can be Flared from the sheet. Per client; the tab's toolbar button is the switch, and the setting has no entry in Configure Settings |

The `trackMap` setting is gone with the Multiple Attack Penalty; a world that still stores a value
for it is ignored.

**Sync content** (0.8.0) is a menu under the system's settings rather than a setting: GM only, it
opens the tool section 8 describes. Behind it two hidden world settings, `contentBuild` and
`contentStamp`, hold the build hash and the build time the world last synced to; they have no
entry in Configure Settings, and the offer at load compares the first with the index on disk.

**A stale-copy warning.** At load the system compares the server's version with a stamp carried in
its own code and another in its stylesheet. If either disagrees, the browser is running a cached
copy of an older release (a caching proxy such as Cloudflare in its default configuration will do
this after every update), and a persistent warning names what is stale and says to hard-reload.
Without it, a stale stylesheet looks exactly like a bug in the new one.

---

## 7. Automation: the framework

**What it is, and what it is not** (0.9.0; rulings 118 to 120). Since 0.9.0 every Talent sheet in
`data/*.xlsx` may carry an **Automation** column, as the action sheets already did, and the system
has a framework for reading it. **The framework does nothing in play yet.** It parses the column,
stores what it read on the Item, indexes it on the Actor and shows it on the Item sheet, and that
is the whole of it: no roll, no Strike, no damage, no condition, no movement and no aura reads a
rule, because no rule kind exists. Mike's instruction (2026-10-03): "do NOT survey the talents yet
or build ANY of the automation hooks. just build the framework. we will build automation syntax
hooks one at a time." Kinds are added one at a time with Mike, each with its engine hook, its
test, its line in `data/README.txt` and its docs; the first will be an aura, for Torchbearer
Human's 15 feet, and it will serve every aura in the book without more code. Until then a Talent's
Effect is prose the sheet displays (section 9), and the design record is `automation-plan.md` in
the project root.

**The cell.** One rule per line, `kind: arguments` (the colon optional when there are no
arguments), blank lines ignored, a line beginning with `#` a comment. The kind word is the word
before the colon, and the arguments are the kind's own to define and check. With no kinds defined,
the only cell that builds is a blank one or one of comments; any other line is "unknown rule
kind", and the build says so by name.

**The build** (ruling 118). `build_foundry.mjs` parses every Talent's and every Maneuver's cell with
the system's own grammar module (`module/rules/grammar.mjs`, pure enough for Node to import, so
the build and the client read a cell identically; ruling 120). A line it does not know fails the
build with `automation: <Constellation> / <Talent>, line <n>: <message> ("<text>")`, so
`sync_content.cmd` stops naming the cell before the sources are written, exactly as a bad Aura
cell stops the converter. A clean cell writes `system.automation` (the text) and `system.rules`
(the parsed rules) on the document; the run's summary counts them, and today reads "automation: no
rules (no rule kinds are defined yet)". The content hash covers the rules, so a changed cell
reaches an open world through Sync content as any field does, and the copies refresh overwrites an
owned copy's rules from the source, since the cell is the author (ruling 120).

**The Item sheet.** The Automation panel on a Talent, a Maneuver and a Constellation shows the
textarea and, under it, **As read**: one row per rule with its kind word in a tag and the kind's
one-line summary, or a red row with the message for a line that did not parse or a kind the system
does not know. With nothing stored it says "No rules (the framework has no rule kinds yet; they are
added one at a time)". A GM who edits the textarea on a world Item or an owned copy sees the text
save and the list mark each line: the Item parses on update and stores the error entries beside
the rules, and never refuses the edit (ruling 118). The text is the GM's to type; what the system
makes of it is shown, not enforced.

**The Actor.** At prepare, a character or adversary collects every owned Talent's, Maneuver's and
Constellation's rules into `system.rules { all, byKind, unknown }`, and `actor.rulesOfKind("aura")`
answers from the index without walking the Items. Today every list is empty, a line of an unknown
kind lands in `unknown`, and the call returns `[]`; this is where a kind's engine hook will look
when there is one.

**Kinds are plug-ins** (ruling 119). A kind is one file in `module/rules/kinds/` with one contract:
its word, its aliases, `parse` (its argument syntax and validation, with a message a game designer
can act on), `summary` (its line for the sheet) and `hooks` (the engine points it speaks at,
defined with the kind and not before), registered in `module/rules/kinds/index.mjs`, which today
registers nothing and says in a comment which kind comes first. `module/rules/README.md` is the
recipe for adding one, and `assets/test_rules.mjs` is the framework's self-test, run by every step-running mode (`--check` builds nothing)
of `build_all.mjs` before the Foundry build.

---

## 8. Keeping the content in step: the content loop

**One command, two outputs, no restart** (0.8.0; rulings 115 to 117). The spreadsheets in
`data/*.xlsx` are the content, and the web app and the Foundry compendia are two readers of it.
Through 0.7.5 getting a new row into Foundry meant stopping the server, running the pipeline,
starting it again and relaunching the world, because the LevelDB compile fails while Foundry holds
the packs open. Since 0.8.0 the loop is: edit a sheet, run one command, reload the web app, and in
the open world take the sync.

**The command.** `node assets/build_all.mjs --content` from the project root, or a double-click on
`sync_content.cmd` beside it (the same command in a window that pauses so it can be read). It
converts the spreadsheets, rebuilds the web app and the Constellation viewer, renders only the
plates whose Constellation changed or is new (a sidecar of tree hashes beside the plates says
which), writes the Foundry pack sources under `packs/_source/` with a content hash on every
document and an index of them all, and runs the style check. It skips the character sheets, the
Constellation Compendium docx and the features docx, which are release outputs, and it never
compiles the compendia. The handbook drift check still runs, as a warning: adding a Talent to a
sheet is not a handbook sync, so the run says the handbook on the shelf is newer and exits 0 all
the same, where the full pipeline exits 1 (ruling 115). A failing step still fails the run.

**The hash and the index.** Every document the build writes carries
`flags.starwrought.contentHash`, a short SHA-1 of its canonical content (name, type, image, system
data, folder and sort for an Item; name, type, parent, sorting, sort and colour for a Folder; keys
sorted, so the hash is the same however the build assembled the fields). `packs/_source/index.json`
lists every pack's documents and folders with their id, name, type, source file and hash, carries
the time of the build as `stamp`, and carries a `build` hash over every document hash in id order,
which changes only when content does. Document ids are what they always were, a hash of the pack
and the key, so a document keeps its UUID on every sheet across every rebuild. Foundry serves the
index and the sources as static files under `systems/starwrought/`.

**Sync content.** In the open world the GM opens it from Settings > STARWROUGHT > Sync content (or
`game.starwrought.syncContent()` in a macro), and is offered it at load whenever the index on disk
was built from a different `build` than the one the world last synced: "The content on disk was
rebuilt {when} and differs from this world's compendia: {n} to create, {m} to update, {k} to
delete. Open Sync content?" No does nothing and asks again next time; a world whose compendia
already match the sources (a fresh install, say) is recorded silently and never asked. The tool
reads the index, diffs it against the compendia by document id and content hash, and shows **the
plan** before it touches anything (ruling 116): per pack, what would be created (an id the pack
lacks), updated (an id whose stored hash differs from the index's, or has none: a pack compiled
before 0.8.0 carries no hashes, so the first plan after upgrading lists every document as an
update, and applying it writes the current source over each and stamps the hash) and deleted (an
id the sources no longer carry), every
entry by name, in three collapsible lists, with folders handled the same way and a pack the world
lacks listed as skipped. The header gives the build's time, the time the world last synced and the
build's short hash; an empty plan says "Nothing to sync: the compendia match the sources built
{when}." Sync applies it: each pack is unlocked for the moment of the write and locked again
(inside a try/finally, so a pack is never left open), folders are created and updated first and
deleted last, created documents keep the ids the sources chose, updates replace the stored
document rather than merging into it so a key the source dropped does not linger, the world
records the build and stamp it synced, the Constellation registry, the chassis index, the Basic
Maneuvers and the party's Activity lists are reloaded without a reload of the page, every open
sheet re-renders, and one GM-whispered card carries the counts so there is a record. A document
the GM wrote into one of the system's packs by hand is stale by this rule and will be listed for
deletion; a GM's own content belongs in the world, and the plan says so.

**Refreshing the characters' copies** (ruling 117). A Talent on a sheet is a copy of its
compendium document, made when it was dragged, and a sync of the pack does not reach it. The plan
offers to, with a checkbox ("N copies on M characters would be refreshed"; ticked by default once
the world has synced before, unticked on its very first sync, when no copy carries a hash and every
one counts; disabled when there are none): for every world Actor, character, adversary and party
alike, every owned Item whose source resolves (by the compendium source the copy recorded when it
was dragged, else by type and name in the index) and whose stored content hash is not the index's,
or has none, takes the source's name, image and system data, except what is the character's own:
`quantity`, the carry `state`, a shield's `raised`, a Talent's `choice.value`, a weapon's Combat
Style (`style`), `twoHands` and `versatileActive`, an action's adversary `attack` block, a
consumable's `uses`, and a Lore instance's placement (the Constellation a Lore Talent was cloned
into, the slug and name of a Lore (X) Constellation Item). Anything else edited by hand on the copy
is lost to the refresh, which is why the box is the GM's. The copies line can stand on an otherwise
empty plan, since level compendia say nothing about the copies. The copy keeps its `_id`, so
nothing on the sheet re-links, the write raises no Adjusted card, unlinked token actors are
skipped, and the result counts per Actor and names them. A copy whose source cannot be found, or
whose recorded source is another compendium's, is left alone.

**What the compiled packs are now.** The LevelDB databases under `packs/<pack>/` are a release
artifact (ruling 115): what a fresh install reads before its first sync, compiled from
`packs/_source/` by the full `node assets/build_all.mjs` with Foundry closed and by the release
workflow on a fresh checkout. The content loop never compiles them; Sync content brings the running
world's compendia up to the sources instead, through Foundry's own document API, so what is on
disk after a sync is what Foundry wrote, as it is after any session. They are not in git, as
before; the sources and the index are.

---

## 9. What it deliberately does not do

- **Prerequisites outside the wizard are not enforced.** Drag a Talent onto a sheet by hand and
  nothing stops you. The wizard enforces them; the sheet trusts you.
- **Talent Point types are not a budget after creation.** Milestone, Comet, Deferred and the rest are
  documented in the Rules compendium, and the no-banking rule is not policed. Since 0.7.0 the
  Milestone award writes the Milestone and says where the point may go, and that is all it does.
- **Deferred Talent Points are counted, not enforced** (0.7.0; ruling 94). `system.deferred` on
  the character is a reminder with a number on it: a Milestone award that finds no Flared
  Constellation raises it, the Spent control on the badge lowers it, and the Flare card reminds
  you while it is above 0. Nothing stops a Talent drag, the count does not fall when one lands,
  and whether the point was spent where the book says is the table's to see.
- **A party is never a combatant** (0.7.0; the plan's risk 1). The `party` Actor has no Zones,
  Wounds, Vigor, stance or actions, and Support's ally count (`supportFor`), `actorsIn`, `canAct`,
  the Combat Tracker's readout and the check engine skip or refuse it by type. A party token
  dropped into a Combat survives a round with no card
  addressed to it, no readout under its row and no Support line for it on a member's Strike;
  nothing draws or counts its token, and no party token is meant to stand on any map.
- **Loot values nothing** (0.7.1; ruling 96). The party's Loot tab and purse move Items and coin
  and claim no rule authority: the book has no shared loot and no party purse (coin is per
  character, and the only price rule is Provision's half price). A row prints the price string the
  Item carries and nothing computes with it; there is no selling, no shop and no Contribute, and
  Split divides copper equally and leaves the remainder in the purse. Who may take what, beyond
  owning a member and the stock being there, is the table's.
- **A party Take needs a GM connected** (0.7.1; ruling 97). A player's Take from the loot and Give
  to the party run on the active GM's client, as damage, rerolls and Expose do, because an Observer
  cannot write the party; with no GM connected the controls say so and nothing is written, and a
  party Item dragged onto a player's sheet is refused rather than copied. The GM's own moves never
  touch the socket. An Activity pick (0.7.2) needs none: it is a write to the member's own Actor.
- **The road is a line and a card, not movement** (0.7.2; rulings 101, 102, 105 and 107). The
  party's Travel Speed is display only and the terrain is a select and a word; nothing moves a
  token at any pace. The Fatigued gate locks a member's Activity to Travel and refuses a pick of
  anything else, and that is the whole of what the book's Fatigued row does here. Look Harmless's
  Requirements (a held weapon with Reach, worn Load above 1) are a warning, never a refusal, and
  its degrees are printed for the GM to compare by hand against each enemy's Awareness Threshold,
  since "each enemy you are Observed to" is a judgement about a line between two tokens; whether an
  Investigation was related to the encounter is the GM's call, made before the die; the Scout's
  Step ⓿ is announced, not taken. Begin the encounter rolls nothing: players roll their own
  Initiative, the GM rolls for the absent, and no adversary Threshold reaches a player. The book's
  sentences for all of this (the party's Travel Speed, the Fatigued row, Initiative when Activities
  differ, the Avoid Notice row) are a proposal for Mike to accept, not yet an edition.
- **Downtime is a panel, not a mode** (0.7.5; rulings 112 to 114). The party's days are an integer
  the GM types, and nothing counts them down, spends them or refuses anything for want of them: no
  clock, no calendar, no per-member day counters. The three Activities are printed from the pack
  with their Duration and Effect. Train lights a Flare through the shared picker and warns, in
  amber, in the tooltip and on the card, when it was already used since the last Milestone, and
  refuses nothing (decision 14: a GM may rule an exception); there is no "already Flared this
  session" warning, which would need a history the system does not keep. Retrain moves no Talent
  (the drag is the move, and the restrictions are the player's and the GM's) and Provision buys and
  sells nothing (the loot values nothing, and the uncommon-goods Threshold is the GM's); each says so
  in a line. The book's "only once between Milestones" is counted for each character, which the
  downtime proposal asks the book to say and no edition yet does.
- **The content loop compiles nothing and polices nothing** (0.8.0; rulings 115 to 117).
  `--content` writes the pack sources and the index and leaves the LevelDB packs on disk as the
  last full pipeline run left them; Sync content writes the open world's system compendia from the
  sources and nothing else: it never touches a world compendium of the GM's own, a stale system
  document is deleted by name only after the plan has shown it, and a GM's content belongs in the
  world. The copies refresh is a checkbox, and a copy whose source cannot be found is left alone.
  Since 0.9.0 the loop parses the Automation column and stops on a line it does not know; nothing
  acts on a Talent's Effect or on a parsed rule, because no rule kind exists yet (section 7).
- **The automation framework does nothing in play** (0.9.0; rulings 118 to 120). It parses the
  Automation column, stores the rules on the Item, indexes them on the Actor and shows them on the
  Item sheet, and no roll, Strike, damage step, condition, movement or aura reads one, because the
  registry of rule kinds is empty by Mike's instruction ("do NOT survey the talents yet or build
  ANY of the automation hooks. just build the framework. we will build automation syntax hooks one
  at a time"). Every rule line in a cell is "unknown rule kind" today and stops the build by name;
  the same line on a world Item saves and is marked, never refused. Kinds are added one at a time
  with Mike, each with its hook, its test, its README line and its docs; the first is the aura, for
  Torchbearer. Nothing generates code from a cell: the cell is data, and the engine is the only
  code.
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
- **Ten minutes of rest is a button, not a clock.** The book's Fatigued N "ends after ten minutes
  of rest". The system has no clock for the rest and no longer guesses at one (through 0.6.1 it
  cleared Fatigued when the Combat was deleted), so the Fatigued card offers the owner or the GM a
  Ten minutes' rest button, a night's rest clears it, and whether ten minutes passed between one
  scene and the next is the table's to say.
- **Sleeping in armor without Comfort does not set Fatigued 1.** The book's Comfort row (PHB
  v4.14): "You can sleep in it without increasing your Fatigued value by 1." The rest card restores
  Vigor, clears Fatigued and does nothing else; that rule is the table's to apply.
- **"Climb or Swim" is asked, not detected.** Load Strain lands on an Athletics check only when the
  player ticks the dialog's toggle, because the system cannot tell a Climb from a grapple.
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
- **Talent effects are prose the sheet displays**, not rules the system acts on. The framework
  that will read them shipped in 0.9.0 (section 7) with no rule kinds, so it changes nothing in
  play; the rules will be authored in the spreadsheets' Automation column, one kind at a time with
  Mike, never as code written per Talent.
- **No equipment shopping**, in the wizard or out of it.
- **No magic**, because the playtest has none.
