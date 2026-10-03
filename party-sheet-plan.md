# The Party Sheet: a plan

Written 2026-10-02 from a three-lens design panel (the GM at the table, Foundry architecture, the
rules) and a judge, against system 0.6.3 and Player's Handbook v4.15. Nothing here is built. Mike's
question: "Is there a built-in party sheet in Foundry to do things like award Milestones, see
various party-wide things like everyone's Skills, add Loot for party members to grab, allow
players to choose and roll Exploration Mode activities, etc.?" Foundry core has none; pf2e's Party
actor and dnd5e's Group actor are what other systems built. This is ours.

## The shape, in one paragraph

A `party` Actor type with one ApplicationV2 sheet, GM-owned, default ownership Observer so every
player can open it. The sheet is the GM's console and the players' window at once: one template
set that branches on `isGM` and on per-member ownership, as the character sheet's header already
does. It stores only what is party bookkeeping (members, the session, the last award, a purse, the
loot Items, notes, terrain, downtime days) and reads everything about the members live at render,
never copying a number off a character. It never does a member's arithmetic: every rule effect (a
Flare, a Hero Point, a rest, a Milestone, a check, an Initiative) runs on the member's own Actor
through a method that already exists and already posts its card, so the party adds buttons and a
handful of cards, not a second rules engine. Its data model extends `TypeDataModel` directly,
never `SwActorData`, so it has no Zones, Wounds, Vigor, stance or actions, and the combat
machinery never sees one. A party is never a combatant and nothing draws or counts its token.

Why an Actor and not a GM window: an Actor is the only document that owns embedded Items (the loot
has nowhere else to live), membership and the purse must survive a reload and reach every client,
the party needs to speak in chat and a speaker is an Actor, and the permission model comes free:
Observer to open, the GM to write, and the two player writes that touch the party (Take and Give to
the party, phase 2) relayed to the active GM's client exactly as `damage:apply`, `reroll:apply`
and `expose:apply` are today.

Where state lives, the one real disagreement among the lenses, is settled by who the book says
owns the fact. Rule state stays on the character: level, Milestones, Hero Points, Flares, coin,
plus two new character fields with defaults and no migration (the Deferred Talent Point count the
book names in Table 4 and the system lacks; the Exploration Activity pick, which belongs to the
character because Initiative by Activity is the character's and which its owner therefore writes
directly). Everything party-wide (the status board, the Skills grid, the Lore union, the Travel
Speed, the Fatigued list) is derived in the sheet at render and never stored, because one Actor's
derived data must not depend on another's prepare order. The sheet re-renders itself, debounced on
a timer (never a rAF latch) and part by part, on the member hooks: `updateActor`, item and
Active Effect changes on a member (Fatigued is an effect), and from phase 3 the Combat hooks.

## The data

**Party document** (`SwPartyData`, Actor type `party`; `system.json` documentTypes, dataModels,
typeLabels, an empty trackableAttributes entry, a registered sheet for `["party"]`; `_preCreate`
sets `prototypeToken.actorLink` and default ownership Observer).

| Field | Phase | Shape | Notes |
|---|---|---|---|
| `members` | 1 | array of `{ uuid }` | World character Actors, insertion order. A linked token drop resolves to its Actor; an unlinked token, an npc, a party or a compendium Actor is refused with a notice. A uuid that resolves to nothing prints as a missing row with Remove only. |
| `session` | 1 | `{ number, began }` | Names the session card; `began` is the moment of the last Begin session. |
| `lastAward` | 1 | object or null | The before-state of every member the last Milestone award wrote, for Take back. |
| `notes` | 1 | HTML | GM-only in the template; not a vault (an Observer can read the document from the console) and FEATURES says so. |
| `currency` | 2 | `{ gp, sp, cp }` | The character's shape, so the template idiom carries over. |
| `travel.terrain` | 3 | normal, difficult, greater | Display only: scales the Travel Speed line. |
| `downtime.days` | 4 | integer | The GM's "you have ten days"; nothing acts on it. |
| embedded Items | 2 | weapon, armor, shield, gear | The loot. Any other type is refused on a party. Carry state is meaningless here; a taken Item lands on the character as carried. |

**Character additions** (`SwCharacterData`, defaults, no world migration): `deferred` (phase 1; an
integer, +1 by a Milestone award that finds no Flare, −1 by the player's Spent control or the GM;
shown in the header, on the roster and on the Flare card while above 0; a reminder with a number on
it, not a budget) and `exploration` (phase 3; `{ activity, constellation }`, the Activity's
compendium id and Investigate's chosen Lore or Skill; written by the owner or the GM directly).
Two flags rather than schema: `trainedAt { level, milestone }` on a character (phase 4) and
`initiativeModifiers` on a Combatant (phase 3).

**Action Item additions** (phase 3, through the pipeline, ids unchanged): two positional columns on
the roster's hand-kept `explorationActions` rows, the Constellation the Activity rolls now and the
one it rolls for Initiative, written by `build_foundry.mjs` into the existing `system.check` and a
new `system.exploration { travel, initiative }`. The panel reads the pack's Exploration Mode
folder, so a row Mike adds (Avoid Notice) appears with no code change. `build_phb.js` and
`phb_format.py` read those rows by position and come out byte-identical.

**Read live from each member, never stored:** level, Milestones, Deferred, Hero Points, Vigor and
Temporary Vigor, Spent, Wounds per Zone, Dying, Fatigued N, Load Strain and the Wind tooltip the
character sheet already builds, Speed, the Travel figures `SW.TRAVEL` already derives, Flares and
their names, every Constellation's rank and bonus, every Defense's Threshold and modifiers,
Initiative, `SwCheck.previewTotal` per Skill cell (so Stealth carries Load Strain and a Frightened
member's cells carry the penalty), ownership for gating controls, and from phase 3 the member's
Combatant. `MILESTONES_PER_LEVEL` moves from the character sheet into `config.mjs` so both sheets
read one constant.

## The phases

| Phase | Contents | Cuts | Release |
|---|---|---|---|
| 1. The party | The Actor type and sheet; the roster as a status board with Flare chips and the GM's Flare award; Begin session, Hero Point awards with a reason, the party's night; Award a Milestone with the Deferred count, the Flare card's reminder line and Take back; the Skills grid; the type fences, the stamps, FEATURES and CHANGELOG | 5.75 | 0.7.0 (a document type is new) |
| 2. Loot and the purse | The Loot tab with Take, Give to the party and Give to, over `party:take` and `party:give` to the GM's client; the purse with Split; the character sheet's drop route for a party Item; Ask everyone on the Skills grid | 3 | 0.7.1 |
| 3. On the road | The two roster columns and `system.exploration`; the Exploration panel with the party's Travel Speed, terrain, the Fatigued gate and the pick card; Begin the encounter with Initiative by Activity, the Scout's bonus and the Defender's shield; the `exploration` field on the character | 3.5 | 0.7.2, ideally the same release as the four handbook sentences it leans on |
| 4. Downtime | The days, Train through the shared Flare picker with its once-between-Milestones warning, the Retrain and Provision reminder lines | 1 | 0.7.3 |

A cut is roughly one of the 0.5.3 cuts: a day's focused work with a live check. Phase 1 needs no
socket, no handbook change and no world migration.

## The parts

### 1. The party and its roster (phase 1, 2 cuts)

GM: Create Actor, type Party. The header carries the portrait, the name, the session number, the
Begin session, Award a Milestone and The party rests buttons, and a drop zone ("Drag characters
here"); a toolbar button adds every player's assigned character at once. Always open above the
tabs, the roster: one row per member with portrait (click opens the sheet), name, level badge with
the three Milestone pips and the Deferred badge when above 0, Hero Points with the award controls,
the Vigor bar with Temporary Vigor and the Spent badge, Wounds with the Zones on hover, Dying N,
Fatigued N, Load Strain with the Wind tooltip, Speed, the owning players' colour dots (dim when not
connected), the Flared Constellations as chips, a GM-only Flare plus that opens the picker the
critical card uses (extracted from `flareFromCard` into a shared `pickFlare`) and lights the choice
through `toggleFlare`, and Remove with a confirm. A GM Notes editor on its own tab.

Player: the same roster, read-only, with three live things: portrait clicks, the Flare chips on a
character they own (click puts one out, through `toggleFlare`, which posts its card), and the
Deferred badge's Spent control on their own character. A player who owns no member sees the board
and an empty-state line.

Chat: membership posts nothing (the roster is the record). A Flare lit or put out posts the card
`toggleFlare` already posts; a GM-lit Flare adds "awarded by the GM" with the reason asked for.

Rules: the book never defines a party; this part imposes no rule. Every number on a row is the
member's derived data, read, never recomputed.

Acceptance: in the two-tab pane route, create a Party (default Observer; the player opens it); drag
a character and Add every player character (each once, in order); drop an npc and an unlinked token
(two notices, no change); change a member's Vigor, add a Wound, set Fatigued 2 from the palette and
don a closed helm (the row updates within two seconds, tooltips matching the character sheet);
delete a member Actor (a missing row, Remove only, no console error); as the player, a Flare chip
on the owned character posts the put-out card and one on another member does nothing; as the GM,
Flare plus with a reason posts the card with the awarded line.

### 2. Session start, Hero Point awards, the party's night (phase 1, 0.75 cuts)

GM: Begin session (confirm): `session.number + 1`, and every member's Hero Points set to exactly 1
(decision 4). On each row a plus that asks for an optional one-line reason and writes +1, refused at
the maximum of 3 with a notice before any write (the schema's `max` would otherwise throw), and a
minus as a correction. The party rests (confirm): `restForTheNight()` on every member in turn, each
posting its own rest card as the sheet's Rest button does, then one party line.

Chat: "Session 12 begins. Every character starts with 1 Hero Point." with a line per member whose
count changed ("Wren: 3 to 1"); "The GM awards Hrolda a Hero Point: carrying Toric out of the fire
(2 of 3)."; "Hrolda's Hero Points corrected to 1."; "The party rests for the night."

Rules: P73 and P434 (start each session with 1, the GM awards more); P241 (no Hero Points until the
GM awards more or the next session). The rest is the existing rule; sleeping in armor without
Comfort stays unimplemented, and the rest preview names the members whose worn Torso lacks Comfort.

Acceptance: members at 0, 2 and 3; Begin session puts all at 1 with one card listing the changes;
plus at 2 posts "3 of 3", plus again is refused with no write; minus posts the correction; no
Adjusted card doubles any of it; the party's night with one member Fatigued 2 and one at 0 Vigor
posts each rest card (the Fatigued line on the first, Spent cleared on the second), then the party
line.

### 3. Milestone award, the Deferred point, Take back (phase 1, 1.5 cuts)

GM: Award a Milestone opens a dialog listing every member ticked, with a preview line each
("Hrolda: Milestone 2 of 3, a Milestone Talent Point (Flared: Melee, Athletics)"; "Wren: Milestone
3 of 3, no Constellation Flared, so a Deferred point"; "Kessa: the 4th Milestone, level 3, Vigor 36
to 45, a Comet"). Untick a character who has left or sat the arc out (decision 2). Confirm disables
the button while it runs and writes each ticked member: `milestone + 1`, or for a member at 3
`level + 1` and `milestone 0`, then reads the recomputed maximum and raises current Vigor by the
same rise (decision 3), and `deferred + 1` for a member with no Flare receiving a point. The
before-state goes to `lastAward`. Take back reverses exactly those numbers on exactly those
members, refuses with a notice if any number has since been edited by hand, posts a card, clears
`lastAward`. No other undo: a Talent spent is the player's to move, as today.

Player: no button. The pips move on the roster and the sheet; the Deferred badge appears with one
control, Spent (−1, a card). Spending is what it is today, a Talent dragged or bought, unpoliced.

Chat: one public card spoken by the party, one line per member: "Hrolda reaches Milestone 2 of 3:
a Milestone Talent Point, to be spent now in a Flared Constellation: Melee, Athletics." "Wren
reaches Milestone 3 of 3: no Constellation is Flared, so the point is Deferred: spend it the instant
one Flares (Deferred held: 1)." "Kessa reaches the 4th Milestone: level 3. Vigor 36 to 45. A Comet:
a Talent Point for any Constellation, Flared or not." At 5th, 10th and 15th the line adds that the
next rank opens (decision 10). The Flare card gains one line while the character holds a Deferred
point: "You hold a Deferred Talent Point: spend it here now."

Rules: P62 and P395 (three Milestone Talent Points spent immediately in a Flared Constellation, the
4th is the level with Vigor and a Comet); Table 4 supplies the exception P62 omits: no Flared
Constellation, the point "becomes a Deferred Talent Point", spent "the instant a Constellation is
Flared". Rank unlocks need no write. The system still does not police the spend (FEATURES
section 7); this part announces and remembers.

Acceptance: members at milestone 1 (Flared Melee and Athletics), 2 (no Flare), 3 (level 1 Human
Weaponmaster at 28 of 28, no Flare); award with the third unticked (two lines, the Deferred badge
on the second); award again with all ticked (the third goes to level 2, 36 of 36, the Comet line);
at level 4 with Endure at Expert-eligible points and Vigor 20, award to level 5 (current rises by 9,
not 8, and the card says Expert opens); Take back returns the numbers; edit a level by hand then
Take back (refused); Spent on the badge (1 to 0, card); a Flare lit with Deferred 1 carries the
reminder line and with 0 does not; no Adjusted card anywhere.

### 4. Skills grid (phase 1, 1 cut)

A tab. Constellations as rows, members as columns, because the question is "who has Stealth": the
four Defenses (the cell shows the Threshold, since that is what a Sneak, Feint or Lie is measured
against), an Initiative row, the seven Skill Constellations, Melee and Ranged (rank and
Proficiency, the inherited pool on hover), and one row per Lore any member has opened. A Skill cell
shows the rank letter and the signed modifier from `SwCheck.previewTotal`, Untrained dimmed at +0,
the Threshold in the tooltip, a gold mark on the best in each row (ties all marked). Clicking a
cell rolls that check as that member (Shift-click skips the dialog); the Initiative cell is live
only while a Combat holds the member. Players see the same grid, Thresholds included (decision 12);
cells are live only on members they own.

Acceptance: two members with different Lores (two Lore rows, blanks elsewhere); a mail shirt and
closed helm drop Stealth by the Strain and Awareness and Initiative by 2 with both named in the
tooltip, the Stealth number equal to the Relevant Check picker's; Frightened 1 drops a whole
column within two seconds; the best mark lands right, ties both marked; the GM's click opens the
dialog and the card speaks as the member; the player's click on another member does nothing.

### 5. The release: fences, stamps, prose (phase 1, 0.5 cuts)

The twenty `actor.type` comparisons and the reads of `system.zones`, `system.actions`,
`system.ranges` and `system.stance` across the module are walked; most guard on presence already.
Three get an explicit `type === "party"` skip: Support's ally count in `check.mjs` (a friendly
party token in reach would hand out +1), `actorsIn` in `combat.mjs` (so no Wind, Recovery or reset
card is ever addressed to a party), and the Combat Tracker's readout. Stamps to 0.7.0 in all three
places; no world migration. FEATURES gains "The party" and one line in section 7 ("Deferred Talent
Points are counted, not enforced"); CHANGELOG 0.7.0 with the rulings numbered on from the v4.15
report; README names the type. `data/SYNC.json` untouched: no handbook moved.

Acceptance: a party token added to a Combat survives a round with no console error, no card
addressed to it, no readout under its row, no stance or ring button on its HUD, and no Support line
for it on a member's Strike; `check_style.py` and `build_all.mjs --check` exit 0; the three stamps
agree and the stale-copy warning stays quiet; a fresh world shows Party in the Create Actor list.

### 6. Loot panel and the party's purse (phase 2, 2.5 cuts)

GM: a Loot tab. Items arrive by drop from the Equipment compendium, the sidebar or a character
sheet (a drop from a character copies, as Foundry does; a non-physical type is refused). Each row:
image, name, quantity (editable), the price the Item carries, type tag, Give to (a member picker;
the Item lands on that member as carried and leaves here), Delete. A purse block with Split among
the party: coin to copper, divided equally among the ticked members in one batch write, the
remainder staying in the purse.

Player: the same list with Take on each row for a player who owns a member (a picker when they own
two; a count dialog for a stack). Dragging a party Item onto their own sheet, or one of their Items
onto the party (Give to the party), goes through the same relay; the character sheet's drop handler
detects a party parent and routes through Take instead of Foundry's silent copy. Items taken arrive
carried, so drawing one is an Interact as the book prices it.

Chat: "Hrolda takes Longsword from the party's loot."; "Wren takes 6 arrows (14 left)."; "Hrolda
gives 3 Torches to the party."; "Toric is given a Dagger."; one Split card listing the shares and
the remainder. The GM's own drops, deletes and edits post nothing.

Rules: the book has no shared loot and no party purse (coin is per character; the only price rule
is Provision's half price), so the panel is a convenience that claims no rule authority: it moves
Items and coin and values nothing.

Permissions: a Take is two writes a player cannot make alone, so the whole move runs on the active
GM's client as `party:take { partyUuid, itemId, actorUuid, quantity }`: the GM's client reads the
asker from the server's stamp, re-reads the Item from the document, checks the asker owns the
destination and that it is a member, creates on the destination first and decrements or deletes
the source second (a failure between the two leaves a duplicate, never a loss), posts the card and
answers done or refused (gone, not enough, not yours, no member, no GM) to the asker alone;
requests resolve in arrival order so the last potion goes to one taker. `party:give` is the same
with the sides swapped. With no GM connected the player is told so, as damage says.

Acceptance: drop a longsword, 20 arrows and a Talent (two rows, one notice); the player takes 6
arrows (6 carried on the character, 14 left, one card, no Adjusted card); drags the longsword onto
their sheet (moves, not copies); two tabs take the last longsword within a second (one gets it, one
refusal, one card); a torch dragged onto the party (the Give card); GM logged out (the no-GM
notice, nothing written); 121 gp split four ways (the shares in one batch, one card).

### 7. Ask everyone: a group check card (phase 2, 0.5 cuts)

On each Skills grid row header, Ask everyone: an optional Threshold and whether players see it,
then one public card spoken by the party ("Everyone roll Awareness.") with a Roll button per member,
live for that member's owner, which calls `rollCheck` with the Threshold prefilled when shown.
Search and Investigate say the GM applies the roll to the Thresholds, so a blank Threshold is the
normal case and the GM reads the totals.

### 8. Exploration panel, Travel Speed, the Fatigued gate (phase 3, 2.5 cuts)

GM: a tab. The top line is the party's Travel Speed: the minimum over members of Speed times the
Activity's multiplier (Full 1, Half 0.5, Double 2) times the terrain (decision 7), printed as feet
per minute, miles per hour and miles per day through `SW.TRAVEL`, named for the member who sets
the pace, with the ten-minutes-per-location note when anyone Searches; a terrain select writes the
party. One row per member: an Activity select built from the actions pack's Exploration Mode
folder, the Travel word from `system.exploration.travel`, a second select of the member's own
Constellations for Investigate, a requirement warning drawn from live data and never enforced
(Look Harmless: a held weapon with reach above 0 or worn Load above 1, named), and a Roll button
when the Activity rolls now (Search: Awareness; Investigate: the Relevant Check picker prefilled;
Look Harmless: Guile). A Fatigued member's select is locked to Travel with the reason (decision 6).
The GM may set any member's Activity. Say the plan posts the summary on demand.

Player: their own rows live, others read-only.

Chat: a pick posts one line spoken by the member ("Wren is now Searching (Half)."); Say the plan
posts every member's Activity and the speed line; Activity checks post the ordinary card with no
Threshold.

Rules: Table 95 and P336 to P346; Fatigued N "can't use Exploration Mode Activities", read with
Travel left open on a sentence Mike has not written yet (handbook need 5); the slowest-member rule
and the terrain words need sentences too (need 4). The Activity to Constellation map ships in data,
never as a table in the panel.

Acceptance: after the pipeline rebuild the Search entry carries `check` and `exploration` under its
old id and the compendium docx and app output are byte-identical for that table; four members with
Speeds 6, 6, 6 and 5, the slow one Hustling and another Searching (the Searcher sets 120 feet a
minute, 1 mile an hour, 12 miles a day, named); Difficult terrain halves it; Fatigued 2 locks a
select to Travel and the card's Ten minutes' rest unlocks it; Look Harmless on a longspear warns and
does not refuse; Investigate with Lore (Warfare) opens the picker on it; the player's own row is
live and others are not.

### 9. Begin the encounter: Initiative by Activity (phase 3, 1 cut)

GM: Begin the encounter creates a Combat on the viewed scene when none exists, adds each member's
token there (a member with no token is skipped and named), writes on each Combatant the
Constellation its Activity names for Initiative and a `+1 Situation: Scout (Hrolda)` modifier on
every member other than the Scouts when any member Scouts (one entry per Scout; same type, so one
applies), and sets a Defender's held shield raised with no action spent. The tracker's roll, the
sheet's Roll Initiative (which passes Awareness today and must read the flag) and the grid's
Initiative cell all honour the flag; players roll their own, the GM rolls for the absent.

Chat: "The encounter begins. Hrolda was Scouting: every ally has +1 Situation to Initiative, and
Hrolda may Step ⓿ on rolling it. Wren rolls Stealth (Avoid Notice). Toric Looks Harmless: Guile
for Initiative, compared by the GM against each enemy's Awareness Threshold." with Look Harmless's
degrees printed for the GM to apply.

Rules: P323 (Awareness is the default, another Constellation by Activity); Scout's bonus and Step
(the Step is announced, not moved); Defend's shield; Investigate's "if related" and Look Harmless's
"each enemy you are Observed to" are judgements left at the edge: the pick the GM may overrule,
and a comparison made by hand. Adversaries' Thresholds never reach a player.

### 10. Downtime: Train, the days, the reminder lines (phase 4, 1 cut)

A Downtime panel under the Exploration tab: a Days field the GM sets, the three Downtime
Activities printed from the pack's Downtime Mode folder, and per member a Train button opening the
shared Flare picker; Train lights the Flare with the reason "by seven days' training" and writes
`trainedAt { level, milestone }`; while that equals the member's current count the button warns
"Train already used since the last Milestone" and is not refused (decision 14). Retrain and
Provision carry one line each saying they are done by hand.

## Decisions that are Mike's

Each with the panel's recommendation.

1. **Actor type with Observer players and a GM relay, or every player an Owner of the party?**
   The Actor with Observers and the relay. Owner for all means any player can delete loot, edit the
   purse or remove a member with no record; the relay is the pattern the system already trusts, and
   phase 1 needs no socket either way.
2. **Is a Milestone the party's or a character's?** Every member by default, a checkbox to withhold
   it from one who left or sat the arc out, and one sentence in the book saying Milestones belong
   to the table.
3. **When the fourth Milestone raises a level, does current Vigor rise with the maximum?** Yes, by
   the same amount, and the card prints both numbers. P62 says "Vigor rises", and a character
   would otherwise come out of a level at 20 of 36.
4. **Session start: Hero Points set to exactly 1, or raised to at least 1?** Exactly 1, the card
   printing each previous count. P73, P434 and Refusing Death's "until the next session" all read
   as a reset; a GM who wants a player to keep a point adds it back in public.
5. **Count Deferred Talent Points on the character?** Yes, in phase 1, as a reminder with a number
   on it and nothing enforced. Without it the award cannot follow Table 4, and "did Wren ever spend
   that Deferred point" is the failure mode at every table.
6. **May a Fatigued character Travel?** Travel only: keeps up with the party, takes no other
   Activity. Read literally the party cannot move once a fighter in plate is winded; one sentence
   in the book before phase 3.
7. **Does the party move at the slowest member's Travel Speed, with a terrain toggle?** Yes,
   display only, with one sentence for the slowest-member rule; confirm P343 to P344 carry the
   terrain multipliers (Difficult halves, Greater Difficult to a third) or add them.
8. **Avoid Notice is named in P342 and rolled in the Example of Play but has no row in Table 95.**
   Add the row (wording below); the panel reads the table, so the row lands as data.
9. **Earning a Living is named in P354 and absent from Table 96.** Strike the name until there is an
   income rule.
10. **The Level-Up Checklist (P567) prints tier gates of 5, 13, 19; everything else says 5, 10,
    15.** The card prints 5, 10, 15; fix P567.
11. **Where does the Exploration Activity data live?** Two columns on the roster's `explorationActions`
    block now (ids unchanged, no new workbook); a `data/maneuvers.xlsx` sheet whenever the Maneuver
    rows are being enabled anyway. A workbook with a blank Enabled? column would empty the panel on
    day one, as the Basic Maneuvers panel stands empty today.
12. **Do players see every member's Thresholds on the Skills grid?** Yes; a world setting is one line
    if the table objects. Adversaries' Thresholds never appear on the party sheet in any phase.
13. **Who may join?** Characters only, in every phase planned here. A companion row type can come
    later without touching the data model.
14. **Train twice before the next Milestone: refuse or warn?** Warn. The system prevents nothing
    anywhere else, and a GM may rule an exception.
15. **Loot before Exploration, as listed?** Yes, unless the table is on the road more than in the
    dungeon: Loot needs the relay and no handbook sentence; Exploration needs four sentences and a
    pipeline change.
16. **Does the book get a sentence on shared loot and a party purse?** Not needed; the panel moves
    Items and coin and values nothing. One is offered below if the stash should be a rules object.

## What the handbook would need

Suggested wording, Mike's to take or redraft, with the place in brackets and the phase that leans
on it.

1. The party as a unit [Chapter 3 or Key Terms; phase 1]: "A party is the characters who travel
   together. Milestones, the Hero Points you begin a session with, and the pace of travel are
   reckoned for the party as a whole."
2. Who reaches a Milestone [Character Mechanics, after "The 4th Milestone is the level-up";
   phase 1]: "A Milestone is reached by the party together. A character whose player missed the
   session still reaches it; the GM may withhold it from a character who has left the party."
3. Deferred points against "never banked" [P62, appended; phase 1]: "The one point that waits is
   the Deferred Talent Point, and it waits only because nothing was Flared to receive it. The
   moment a Constellation of yours Flares, it is spent there."
4. Party Travel Speed [Exploration Mode, after the three formulae; phase 3]: "A party that travels
   together moves at the Travel Speed of its slowest member, after that member's Activity has
   halved or doubled it. One companion Searching holds the whole party to Half." And confirm the
   terrain multipliers are stated.
5. Fatigued and Travel [Conditions or Exploration Mode; phase 3]: "A Fatigued character can still
   Travel, and can only Travel: every other Exploration Mode Activity is closed until the Fatigue
   ends."
6. Initiative when Activities differ [before Table 95; phase 3]: "When an encounter begins, each
   character rolls Initiative once, with Awareness or with the Constellation their own Activity
   names, so a party doing different things rolls different checks. A Scout's +1 Situation bonus
   reaches every ally travelling with them, and two Scouts give no more than one. Whether an
   Investigation was related to the encounter is the GM's call, made before the die is thrown."
7. Level-up and current Vigor [the Milestones paragraph or Your Vigor; phase 1]: "When you gain a
   level, your current Vigor rises by the same amount as your maximum."
8. Hero Points at session start [P73 and P434; phase 1]: "At the start of each session your Hero
   Points are set to 1, whatever you carried out of the last; the GM awards more during play, in the
   open."
9. Avoid Notice [Table 95, a new row; phase 3]: "Avoid Notice | Exploration | Half | You move quietly
   and keep to cover. Roll Stealth; the GM applies it to the Awareness Threshold of anyone who might
   notice you. When an encounter begins, you can roll Stealth." And Earning a Living [P354]: a Table
   96 row with an income rule, or strike the name.
10. Shared loot and a common purse [Chapter 5; phase 2, optional]: "Gear and coin the party has not
    divided travel with the party. Any member may take a piece of it while the party is not in an
    encounter, and the table hears it when they do; what is taken is carried, not in hand, until an
    Interact draws it. Coin held in common is split by agreement, and any remainder stays in the
    purse."
11. Train "once between Milestones" [Table 96; phase 4]: "between one Milestone and the next,
    counted for each character".
12. The Level-Up Checklist [P567; phase 1]: "Check tier gates (Expert at 5th level, Master at 10th,
    Legendary at 15th) and spend your Comet."

Noticed in passing: Armor P609 says sleeping in armor without Comfort means "waking Fatigued 1"
while the Comfort row says "without increasing your Fatigued value by 1" (set to 1 against raise by
1); the party's night names the members concerned and implements neither until the book picks one.

## Risks

1. **A third Actor type meets code written for two.** Most reads guard on presence already; three
   places need an explicit skip (Support's ally count, `actorsIn`, the tracker readout).
   `SwPartyData` must never extend `SwActorData`. The acceptance check that runs a Combat round
   with a party token in it is the test.
2. **Cross-document derived data.** Nothing member-dependent is computed in the party's own
   prepare; the sheet computes at render and re-renders on member hooks, debounced on a timer and
   part by part. Test with six members and the attack flow running: an undebounced sheet would
   redraw on every pip.
3. **A double Milestone award is a level.** The preview dialog, the disabled interval, the card and
   Take back are the guards; two GMs clicking at once is the residual case.
4. **The Deferred count is a reminder, not a lock.** Nothing stops a Talent drag and the count is not
   decremented when one lands. FEATURES must say so in the same release.
5. **Player writes need an active GM.** Take and Give degrade to read-only with a notice when none is
   connected; the GM's client trusts the payload for nothing but ids and counts; destination first,
   source second; arrival order.
6. **Two GMs.** Every request is addressed to `game.users.activeGM`; the other GM's client ignores
   a request not addressed to it, as `onChatSocket` already does.
7. **Deleted, unlinked and reassigned members.** A missing row, a refused drop, and the roster as the
   GM's list rather than the user list.
8. **Observer ownership exposes the document.** Nothing secret goes on the party; the notes field is
   a convenience, not a vault.
9. **The Exploration data path.** The pack's Exploration entries carry prose and no `check` block
   today, so the temptation in phase 3 is a seven-row table in the panel; that breaks data-first and
   is wrong the moment Avoid Notice lands. The roster columns and `system.exploration` land first.
10. **The sheet's Roll Initiative passes Awareness today** and would override the Activity flag; one
    line in phase 3 and an acceptance check.
11. **Hidden Thresholds.** Characters' numbers only; Look Harmless is compared by hand; any later
    automation of "Observed to" puts a judgement inside a formula and is struck.
12. **Chat noise.** A pick posts one line; if that is too many, the pick goes quiet and Say the plan
    is the record.
13. **Schema edges.** `heroPoints.value` and `milestone` carry `max: 3`, so refuse before writing or
    Foundry throws mid-batch; the level-up writes the level first and raises current Vigor in a
    second update after reading the new maximum.
14. **Release mechanics.** A new document type is a minor bump to 0.7.0 in all three stamps; no
    world migration; phase 3's handbook sentences should land in the same sync or be recorded as
    rulings.
15. **Scope.** A party token on a travel map, encounter difficulty arithmetic, a shopping interface,
    a level-up wizard and kingdom features are what every party sheet in other systems grows. None
    is asked for; each builds a mode the system does not have or puts judgement inside a formula.

## Struck by the judge

From the GM lens: the Look Harmless comparison whispered to the GM (a judgement about who sees
whom); a per-party Activity field and its socket (the pick is the character's); a three-counter
Talent Point badge (a budget by another name; only the Deferred count survives); drag-to-reorder
(insertion order is the order); a modifier/Threshold toggle on grid cells (the Threshold is in the
tooltip). From the architecture lens: the party token as a feature; a Milestone spend picker (the
level-up wizard FEATURES says does not exist); join and leave cards; Contribute to the purse; Sell
at half price (it parses prices to compute a number the GM reads off the row); automatic pruning of
deleted members; a description field. From the rules lens: a `trainedSinceMilestone` field the
award would have to clear (the flag compares itself to the current count); per-member Downtime day
counters; refusing a second Train; an "already Flared this session" warning (it needs a history the
system does not keep); one row per member on the grid. Where all three agreed and the judge did
not: a Hero Point stepper (one plus with a reason and one minus is the whole control) and a
whispered per-member Initiative card (the tracker already rolls for anyone and reads the flag).

## Files, phase 1

Creates `module/data/party.mjs` (`SwPartyData`), `module/apps/party-sheet.mjs` (`SwPartySheet`),
`module/apps/flare-picker.mjs` (`pickFlare`, extracted from `flareFromCard`), and
`templates/actor/party-header.hbs`, `party-roster.hbs`, `party-skills.hbs`, `party-notes.hbs`.

Touches `system.json` (the type; 0.7.0), `starwrought.mjs` (dataModels, typeLabels,
trackableAttributes, the sheet, preloaded templates), `module/config.mjs` (`SYSTEM_VERSION`;
`MILESTONES_PER_LEVEL` moved here), `module/data/actor.mjs` (`deferred`),
`module/documents/actor.mjs` (`_preCreate` for a party; the Flare card's Deferred line; a reason on
`toggleFlare`), `module/documents/chat.mjs` (uses `pickFlare`), `module/dice/check.mjs` (Support
skips a party), `module/documents/combat.mjs` (`actorsIn` and the readout skip a party),
`module/apps/actor-sheet.mjs` and `templates/actor/header.hbs` (the Deferred badge and Spent),
`styles/starwrought.css` (the stamp; the party's styles), `lang/en.json`, `FEATURES.md`,
`CHANGELOG.md`, `README.md`. Untouched in phase 1: every spreadsheet, `assets/roster.json`,
`assets/build_foundry.mjs`, `data/SYNC.json`, the handbook, `packs/_source/`.
