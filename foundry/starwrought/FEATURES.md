# STARWROUGHT for Foundry VTT: what it actually does

Rules content built from **Player's Handbook v3.3**. System version **0.2.0**. Verified on
**Foundry VTT v14.367**.

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
| Starting Talents | Grants Weapons Training and all four Defense Trainings, free |
| Ancestry | Sets HP per level, Size, Speed and Senses; grants the Ancestry Root |
| Bloodline | Offers only the Bloodlines inside your Ancestry's Constellation; grants that Root |
| Culture | Grants the Culture Root and adds its languages |
| Background | Three directed points: Trained in two named Skills, and in a Lore of its own |
| Calling | Sets HP per level; one Calling point buys the signature technique, one free Training goes to the Calling's Skill |
| Defenses | One point, deeper into Awareness, Evade, Guard or Endure |
| Comets | Three points, anywhere you qualify for |
| Review | Name it and finish |

What the wizard enforces, all of it read from the compendium rather than hard-coded:

- **Root first.** Nothing in a Constellation can be bought before its Root Talent.
- **Requires is an OR.** A Talent listing two prerequisites needs either one.
- **Tier gates** measured against the rank you will have *after* the point lands.
- **Capstones** need a Master Talent in the same Constellation.
- **Identity Roots are never bought.** Ancestry, Bloodline and Culture Roots come from the choice.
  A Comet cannot buy one.
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
  these answers, so a Practiced battleaxe rolls at your full Weapons Proficiency once you are
  Familiar with Axes and at Untrained until you are. When a Talent grants another that asks the
  same question, you are asked once and the answer carries across: Drilled's group must be one you
  are Familiar with, and the Familiarity it hands you is the only one you have.
- **Every Lore is its own Constellation.** Taking Lore (Warfare) creates a Lore (Warfare)
  Constellation with its own rank, copied from the one authored Lore template. A Comet spent on
  Lore asks which field.

**Choices are written to the character as you make them**, so the sheet fills in behind you and the
wizard's side rail shows Attributes, Hit Points and Defenses updating live.

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
State lives on the Actor, so closing the wizard or reloading Foundry does not lose your place.

A finished 1st-level character comes out at the handbook's stated **17 Talents**: 5 granted free,
and 12 from creation.

**Not included:** equipment. Buy that on the sheet.

---

## 2. What the system works out for you

Nothing in this section is typed by a player. It is all derived, and it all recomputes the moment
anything it depends on changes.

### Character mechanics

- **Attribute Points** counted per Talent owned, each flowing to that Talent's own feed and falling
  back to its Constellation's Key Attribute. Talents that override their feed are honoured, which
  is how Armored Fighting spreads across four Attributes.
- **Attribute Bonus** = points ÷ 3, rounded down, maximum +5, with no minimum +1.
- **Proficiency Rank** from points in the Constellation and character level, gated at 1/4/9/16
  points and levels 1/5/13/19, with the next rank's remaining cost shown.
- **The Origin is pooled.** Ancestry, Bloodline and Culture are authored as separate skies but
  progress as one Constellation, so their points share a rank.
- **Hit Points** = 10 + (Ancestry HP + Calling HP) x level.
- **A night's rest** restores level x Presence Hit Points, or level if Presence is 1 or less.

### The four Defenses

Each is a Constellation, so each is level + Attribute + Proficiency, with a Threshold of ten plus
that. Folded in automatically: creature Size (Evade and Guard only), Off-Guard, Frightened N, and
Load Strain on Evade. Bonuses and penalties of the same type do not stack, and a bonus and a
penalty of the same type add together first.

### Attacks and Defense rolls

- **Player-facing.** An attack reads the target's four Defense Thresholds straight off the targeted
  token and lets you pick which one the defender answers with. A Defense roll runs the same
  comparison from the other side, so beating an Attack Threshold by 10 is a Miss and missing it by
  10 is a Critical Hit.
- **Weapon Handling.** Intuitive uses your full Weapons Proficiency, Practiced drops a rank without
  Familiarity, Technical drops you to Untrained. Familiarity is a list of Weapon Groups on the sheet.
- **The attack Attribute** comes off the weapon: Agility for Ranged and Finesse, Might otherwise.
- **Multiple Attack Penalty**, including the Agile ladder of −4/−8. The roll dialog *opens* on the
  step you have actually reached this turn, counted from the start of your turn and reset when it
  comes round again. It is a default, not a rule: a reaction neither suffers the penalty nor accrues
  it, so you can always move it. World setting `trackMap` turns the counting off.
- **The Graze band** is a first-class outcome, not a miss.

### Damage

The printed order of operations, in order: Immunity, the total, Weakness, Resistance, the critical
doubling, a Deadly die, Protection, Temporary Hit Points, Hit Points.

- **Protection can never take a blow below 1.** Resistance can take it to 0. Immunity overrides both.
- **Per-Zone Protection** worked down the handbook's list: an Exposed Zone is 0 and stops there,
  otherwise the piece worn there, plus Zone bonuses and the matched-harness +1 on the Torso, minus 1
  if the material turns that damage type poorly, minus anything the attacker ignores.
- **Materials are automatic.** Padded and leather turn slashing poorly, mail turns piercing poorly,
  plate turns bludgeoning poorly, scale turns nothing.
- **A Graze** rolls one weapon die and nothing else: no Might, no specialization, no extra dice from
  your level, no talent damage. Protection still applies (and still cannot take it below 1), and
  *then* the Zone it landed on becomes Exposed.
- **Deadly dX** is a critical effect of the weapon, so it lands after the doubling and is not itself
  doubled.
- **Weapon dice by level** (2 at 4th, 3 at 12th, 4 at 19th) and **specialization** by Weapons rank.

### The three-action turn

Every creature gets 3 actions and 1 reaction at the start of its turn, and the sheet shows them as
pips: gold for spent-able, dim for spent, with the reaction beside them. The pips only appear while
an encounter is running, because outside Encounter Mode nothing is counted.

The system spends them where it can see them being spent: a Strike, Raise a Shield, Recenter,
drawing or stowing a weapon, and moving. Movement is charged by distance rather than by squares,
which a one-foot grid makes meaningful: a 30-foot drag on a Speed of 25 is two Strides, and it is
charged as two, with a card in chat saying so.

**Nothing is ever prevented.** If a Strike happens with no actions left it still happens, and a card
goes to chat saying it went over the budget and by how much. The same is true of putting armor on
mid-fight, which the handbook prices in minutes rather than actions: the system says how long it
would take and then gets out of the way. The pips can always be clicked to correct the count by
hand, and the world setting `trackActions` turns the automatic spending off entirely.

### Where your equipment is

Everything you carry is **held**, **worn**, or **packed**. Held is in your hands: a weapon you can
Strike with, a shield you can Raise. Worn is on your body: armor covering a Zone, or a sheathed
blade. Packed is in a bag, which is where armor goes when it comes off.

The Equipment tab is laid out that way rather than by item type: what is in hand, then armor by
Zone, then everything else together. A Zone with nothing on it offers whatever you have packed for
it, so putting a helm back on is one click. Drawing or stowing costs an Interact, and armor names
its own donning time, which is a minute for each point of Protection.

### Armor and load

Matched harness (+1 Torso Protection, −1 Load Strain), Clatter, and Load Strain relieved by your
Endure rank from Expert. Load Strain comes off Evade and off Might and Agility Skill checks.

### Going down

Dropping to 0 sets Dying from the blow that did it plus your Wounded value, and knocks you
unconscious. Damage while Dying raises it, a Critical Hit raises it by 2, Dying 5 kills. Healing
ends Dying and makes you Wounded. Recovery checks roll Endure against 10 + level + Dying and apply
their own result. Refusing Death is a button that spends every Hero Point and cannot fail.

### Flares

Any critical, in either direction, puts a Flare button on the chat card. It asks which Constellation
the roll belonged to, because the die knows it was a critical and only the table knows what it was
related to. A Constellation you have never opened can be Flared, and it then shows on the sheet at
0 points so the Milestone point has somewhere to go.

### Initiative

Awareness by default, or whatever you were actually doing: the "Roll Initiative by Activity" macro
lets a player nominate the Constellation. Adversaries do not roll; they carry an Initiative
Threshold and the GM writes the order down.

### The grid, and Total Reach

One foot per square with **exact diagonals**, both set by the system manifest, so a diagonal step
costs about 1.4 feet rather than the same as a straight one. Token footprints follow creature Size,
so a Medium creature is 3x3 and a Large one is 5x5. Every distance the system charges is measured
with Foundry's own grid, so the number on a Stride card is the number the ruler shows.

**Reach is drawn on the map, in squares.** Reach is measured from the edge of your space to the
edge of your target's, so adjacent is a gap of zero feet and one intervening square is one foot.
That makes reach a question about squares rather than a radius, and the drawing follows: whole
cells are lit and every outline runs along a grid line. Diagonals are exact, so the shape comes out
as a stepped octagon rather than a stepped square. It shows on the token you control or hover over.

Three bands, from the inside out:

| Band | Colour | What it is |
|---|---|---|
| Unwieldy | red | The inner dead zone of a long weapon. Unwieldy N is a −2 circumstance penalty against a target within N feet, so it is drawn as a warning rather than as reach. Absent unless the weapon in hand has the trait |
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

**The Unwieldy penalty is applied, not just drawn.** A Strike with an Unwieldy N weapon against a
target within N feet takes the −2 circumstance penalty automatically, measured edge to edge with
the same arithmetic as the band, and the modifier line on the card says why. The penalty applies
to whichever weapon you actually Strike with, bows included (a Longbow is Unwieldy 20); the red
band on the map is drawn only for the melee weapon that sets your Total Reach, since a bow has no
reach to draw. The Grabbed clause, which forbids the attack outright, is announced rather than
enforced, in keeping with the rest of the system: a warning to the attacker and a card in chat
(public for a player's character, to the GM for an adversary), and the roll posts. The table
decides.

### Targeting, made visible

Foundry's own targeting indicator is four small corner brackets that only the targeting player can
see, and a pip for everyone else. At a table where the players roll everything, "who is that thing
going for" comes up every round, and a pip does not answer it.

- **Arrows on the map.** From the token doing the targeting to whatever it targets, in the targeting
  player's colour, drawn for everyone who can see both tokens. They start at the edge of one space
  and end at the edge of the other with an arrowhead, over a dark underlay so they read on a light
  map as well as a dark one. Client setting `showTargetArrows`.
- **In the Combat Tracker.** A line under each combatant names its targets, and the rows of whoever
  the active combatant has in its sights are tinted red down the left edge.
- **Remembered on the token.** Foundry targets belong to a *user* and vanish on reload. Here, as a
  user acquires targets, they are written onto the token they are acting through, as
  `flags.starwrought.targets`. That is the token they have selected; failing that, a player's own
  character on the scene (or the one token they own there, if there is exactly one), and for a GM
  with nothing selected, the combatant whose turn it is, provided no player owns it. So targets
  belong to the creature, the way they do at a physical table, survive a refresh, and are readable
  by every client.
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

### Stance: the defender answers

"The defender decides whether to Evade or Guard." Before this, the attacker's dialog asked the
*attacker* to pick the defender's Defense, which is the wrong person. Now each actor, character or
adversary, carries a **stance**: which of Evade or Guard meets the next physical Attack. Awareness
and Endure are not stances; the handbook says they are almost never chosen against an Attack.

- **On the sheet**, two chips in the header showing each Threshold, one click to flip, and the
  chosen Defense marked in the grid. Adversaries have the same chips.
- **On the Token HUD**, one button showing the current answer, flipping to the other: the fastest
  way to change your mind when an arrow has just been pointed at you.
- **In the attack dialog**, the defender's stance is preselected and marked "stance". The list of
  all four stays, for the table that rules otherwise, and the card names whichever was used. The
  stance is **read again when the die is rolled**, not only when the dialog opened: if the attacker
  accepted the stance as offered and the defender flipped it while the dialog was up, the roll
  honours the flip. The Threshold is read live at the same moment, since conditions move it too.
- **Announced** in chat during an encounter when it changes, since the attacker needs to know and
  the table should not have to ask.
- **Unavailable Defenses are shown, not enforced.** "Evade is unavailable while you are Grabbed or
  Restrained." A Grabbed defender's Evade chip goes dashed with a warning mark, the HUD button
  gets a red ring, the dialog lists it as unavailable and preselects Guard instead, and choosing it
  anyway posts a note saying so. Guard's own exceptions (unaware of the attack, or nothing in hand
  and no hand free) are not things the sheet can see, so they stay with the table.

Why not stop the attack and prompt the defender? Because the prompt would land on a player who may
be away from the keyboard, block the attacker until they answer, and do nothing for adversaries,
who are all the GM's. A stance set in advance and changeable in one click covers the same ground
without a round trip, and it matches how the handbook phrases the choice: something the defender
*has decided*, not something they are asked. Postures, the handbook's next layer on this choice,
are in the data and are the natural next step.

### The drag ruler, coloured by Strides

A Stride carries you up to your Speed for one action, so dragging a token across the map is not one
decision but up to three. Foundry measures the path and highlights the squares it crosses; the
system colours those squares by which action pays for them, so you can see where your first action
runs out and stop on that square instead of finding out after the token has landed.

| Colour | Meaning |
|---|---|
| Green | Your first Stride |
| Gold | Your second |
| Orange | Your third |
| Red | Past what you have left to spend |

The ruler line matches the squares, and the waypoint label prints the cost in actions beside the
cost in feet: `60 ft ◆◆◆`, or `90 ft ◆◆◆+1` when it runs past a full turn.

The count runs **from where the drag began, against the actions you have left**, not from the start
of the turn against a full three. Movement already made this turn has already been charged, so
counting it twice would be wrong: walk 30 feet, then start a fresh drag, and the next 25 feet are
green again. Outside an encounter, on someone else's turn, or with action tracking off, a full three
is assumed and the bands simply show what a whole turn of movement looks like.

Nothing is prevented, in keeping with the rest of the system. The red squares are a warning, the
drop still lands, and the overspend is announced in chat. Client setting `showStrideBands`.

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

**Character sheet.** Six tabs. Overview carries the four Attributes with their point counts and how
far to the next bonus, the four Defenses (click to roll), the four Zones with their Protection,
material weakness and an Exposed toggle, the body block, and a row of table buttons: Recenter,
Recovery check, Refuse Death, a night's rest. Constellations groups your skies by category, shows
rank, Proficiency, points and what the next rank is waiting on, and folds open to the Talents you
own with a Flare toggle on each Constellation. Equipment lays armor out by Zone. Also Actions,
Effects and Biography.

**Adversary sheet.** Written Threshold-first, because the players roll everything. Attack rows show
all three Multiple Attack Penalty steps, so a monster's second swing is visibly a worse swing.

**Item sheet.** One sheet for all eight Item types, branching on type. Actions and Talents carry a
cost range, so Strike reads "◆ to ◆◆◆" and Disarm reads "◆ or ◆◆◆".

---

## 4. Chat

Check cards show the roll, every modifier by name, the Threshold and where it came from, and the
outcome band. Attack cards carry Critical / Hit / Graze damage buttons. Damage cards show the
formula broken into its parts, a Zone selector, and Apply / half / heal. Applied cards show the
whole pipeline: what was rolled, what Weakness and Resistance did, the doubling, the Protection, and
the Hit Points before and after.

---

## 5. Conditions

All 19 registered as toggleable token statuses. Off-Guard, Frightened N and the Exposed Zones feed
straight into the derived numbers. Dying and Wounded are kept in step between the sheet and the
token.

---

## 6. Settings

| Setting | Default | What it does |
|---|---|---|
| Open Constellations automatically | on | When a Talent arrives on a character with no Constellation Item for it, fetch it so the sky is drawn |
| Offer a Flare on a critical | on | Put the Flare button on critical chat cards |
| Remember attacks made this turn | on | Open the roll dialog on the MAP step this character has reached |
| Remind about Recovery checks | on | Notify the owner at the start of a Dying character's turn |
| Track the three-action turn | on | Spend actions automatically for Strikes, Raise a Shield, Recenter, drawing or stowing a weapon, and moving |
| Show Total Reach on the map | on | Draw the reach bands around the token you control or hover over. Per client |
| Colour the drag ruler by Strides | on | Colour the squares a drag crosses by which action pays for them. Per client |
| Draw targeting arrows on the map | on | An arrow from each token to what it targets, in the targeting player's colour. Per client |

---

## 7. What it deliberately does not do

- **Prerequisites outside the wizard are not enforced.** Drag a Talent onto a sheet by hand and
  nothing stops you. The wizard enforces them; the sheet trusts you.
- **Talent Point types are not a budget after creation.** Milestone, Comet, Deferred and the rest are
  documented in the Rules compendium, and the no-banking rule is not policed.
- **Cover, Concealment and detection are reference, not automation.** They need a judgement about a
  line between two tokens, which is the standing risk the working agreement names: a rule that
  needs GM judgement inside a formula cannot be automated.
- **Levelling is manual.** Change the level field; everything recomputes. There is no level-up
  wizard yet.
- **No equipment shopping**, in the wizard or out of it.
- **No magic**, because the playtest has none.
