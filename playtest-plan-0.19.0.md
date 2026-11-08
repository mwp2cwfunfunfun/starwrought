# Playtest fixes and enhancements (Foundry system 0.19.0)

## Context

Mike, 2026-11-08, after playtesting the current Foundry system, listed eight bugs and enhancements
(numbered 1, 2, 4, 5, 6, 7, 9, 10 in his message). He chose to do them in this session. The rules
behind them are read from **PHB v4.24 with every tracked change accepted** (his instruction); no
handbook sync is part of this work (v4.22 to v4.24 stay unsynced on the shelf, `data/SYNC.json` is
untouched, and the release pipeline keeps exiting 1 at the drift gate; the content loop builds).
No data moves, so the rulings are system decisions recorded in the 0.19.0 changelog entry, as the
0.12.0 ones were.

The eight items, as he wrote them, with the book's words that bear on each:

1. **See certain things about other actors**: what weapons and armor are Equipped, what Zones are
   Exposed or Wounded, "etc." No rule in the book; Exposed and Wounds are public conditions
   ("Record this condition as Exposed [Zone]"; the Bind is drawn for everyone who can see both
   tokens since 0.5.1, ruling 95 shows every member's Thresholds on the party grid).
2. **An actor with 0 actions remaining is skipped automatically in Combat.** PHB v4.24 Rounds and
   Opportunities: "Each time the order reaches you, you have an Opportunity: perform one Maneuver
   you can afford, begin or finish a Prepared Maneuver, or Pass ⓿ ... When nobody has any actions
   left, or when a full circuit goes by in which everyone Passes, the round ends." A Preparing
   combatant with reserved actions must still get the Opportunity to Finish ("At your next
   Opportunity you must finish it ... or abandon it; you cannot Pass while Preparing").
4. **The Wind roll is public.** Load and Load Strain: "If your Load Strain is at least 1, then at the
   end of every round while in an encounter, you must roll Endure against 10 + Load Strain". Today
   the Wind card is whispered to the actor's owners and the GM (FEATURES.md, Round cards).
5. **Out-of-turn actions need the GM's approval in chat.** Rounds and Opportunities: one Maneuver per
   Opportunity; "A Maneuver with the Reaction ↺ trait may be performed outside your Opportunity, the
   moment its Trigger occurs, on anyone's Opportunity"; "At 0 actions you still roll your basic
   Defense, and you may still use ⓿ Reactions such as Postures." So Reactions, Postures and Defense
   rolls are legitimately out of turn and are never gated; everything else is.
6. **A Prepared Maneuver cannot be Finished (or Abandoned) in the chat window right away.** Prepared
   Maneuvers: "Spend one now and set the rest aside as reserved ... Nothing happens yet. At your next
   Opportunity you must finish it, spending the reserved actions, or abandon it ... You may abandon at
   any time, losing the action already spent and returning the reserved actions to your pool." So
   Finish belongs to the next Opportunity and nowhere earlier; Abandon is the book's "at any time".
   (Chapter 2's "spending two actions and reserving the rest" disagrees with Chapter 4's one; the
   system spends one, as it has since 0.5.0; a sync-report note, not this work's.)
7. **Take Control of a Bind by hand on the character sheet, as End Bind is; is Controlled
   automated?** Binds: "Miss. The defender gains Control of the attacking implement"; "Use Gain
   Control ❶ to contest an existing Bind"; Controlled: "Attacks with the Controlled implement take a
   −2 Situation penalty, and its wielder has an Exposed Zone chosen by the controller for as long as
   the Bind lasts"; "Exposure caused specifically by Control ends when that Control ends". The −2 is
   applied today (FEATURES.md, Attacks); the controller's Exposed Zone is to be checked.
9. **A search box on the Constellations tab that filters as you type.** UI only.
10. **The Token HUD's controls are tiny when zoomed out; size them dynamically.** UI only.

## What exists (from the code map)

**Item 1.** One sheet per Actor type (`starwrought.mjs:173-186`); no limited view, no
`_configureRenderParts`, no permission check in the context builders (`helpers/actor-context.mjs`:
`zoneWounds` 171-200, `bindContext` 102, `vigorContext` 149). An Observer sees all seven tabs
read-only; LIMITED the same; NONE cannot open. The Token HUD adds nothing for a non-owner
(`token-hud.mjs:32`). On the map everyone already sees the four per-Zone Exposed statuses and one
generic `wounded` status (`config/conditions.mjs:48, 66-69`). Equipped state is `system.state`
(held / worn / carried, `data/items/physical.mjs:18-48`), a shield's `raised`. The party roster row
(`apps/party/roster.mjs:21-79`) shows Vigor, Wound count with a per-Zone tooltip, Dying, Fatigued,
Load Strain, Speed, Flares; no gear, no Exposed. `#prepareInventory` (`actor-sheet.mjs:634-686`)
and `#carryRow` (689-718) already build the held list and the armor-by-Zone rows.

**Item 9.** `templates/actor/constellations.hbs`: toolbar 5-23 (Show every Constellation,
Relevant Check), `.sw-constellation[data-slug]` rows, `.sw-talent[data-item-id]` rows, and a
collapsed or unopened Constellation renders NO Talent list (`{{#unless con.collapsed}}` 106-107).
`#prepareConstellations` 494-609, collapse state the private `#collapsed` Set (197), toggled by
`#onToggleCollapse` (1235-1241) re-rendering the part. The sheet has no `_onRender`; every control is
an `actions` entry. No live filter anywhere in the system; Foundry offers
`foundry.applications.ux.SearchFilter`. `styles/character.css` owns the tab (327-373),
`styles/sheet.css:388` the toolbar base rule; no selector may be declared twice.

**Item 10.** The "options" are core's Token HUD (right-click opens it). The system adds two controls
through the `renderTokenHUD` hook (`token-hud.mjs:26-125`: `actionsCounter`, `auraButton`), never
subclasses `TokenHUD`, never touches `setPosition`. Core's `HeadsUpDisplayContainer.align()` scales
the whole `#hud` layer by `canvas.stage.scale` on pan and zoom, so every HUD control shrinks with the
zoom. No CSS touches `#token-hud`'s size. Foundry compatibility: minimum 13, verified 14.

**Item 2.** `system.actions` is `{ value (free), reserved, preparing }` (`data/actor.mjs:68-82`); the
round reset is `resetActions` (`actor/actions.mjs:158-178`) from `startRound` (`combat.mjs:539-547`).
`SwCombat.nextTurn()` (219-250) wraps within the round and skips only `skipDefeated && isDefeated`;
a lone combatant calls `beginOpportunity` locally. `onTurnChange` (389-413) runs `endRound` /
`startRound` on a round change, else `settleOpportunity(previous)` on the elected client, then
`beginOpportunity` (555-581: trail, shields, the Prepared card). The pass streak is a Combat flag
with a GM connected, else in-memory (`passStreak` 198-201, `setPassStreak` 326-336); `registerPass`
268-285, `registerAction` 295-303 stamp `flags.starwrought.passed` / `acted` as `{ round, turn }`;
`didPass` 452-461 reads them, then `!canAct()` (464-471: defeated, party, unconscious, dying);
`opportunityHolders` 208-210 is the streak's denominator. **A latent bug:** the stamps are never
cleared and `{ round, turn }` repeats every circuit, so a combatant who acted on circuit 1 and
Passes on circuit 2 reads as having acted (458) and resets the streak. The tracker's readout is
`actionsReadout` (`apps/combat-tracker.mjs:113-153`; `sw-none` at 0).

**Item 5.** Nothing that pays checks whose turn it is in order to block; `isTurn` only decides
whether `registerAction` runs (`spendActions`, `actor/actions.mjs:45-70`, line 68). The spend
sites: `SwItem#use` (`documents/item.mjs:72-142`: weapon → `rollAttack`; built-in Maneuvers
(`documents/maneuvers.mjs:34-64`); `#useWithRules` 154-180 pays at 169; a Reaction item pays at 92;
a spell Talent → `castSpell`), `raise` (230-249), `toggleVisor` (262-286), `recenter`
(`actor/position.mjs:14-16`), `setCarryState` (`actor/carrying.mjs:20-41`), `rollAttack`
(`actor/attack.mjs:52-315`: `declareStrike` 121-140 pays after `AttackCoordinator.declare`; no
target → `beforeRoll` pays at 290 or `prepare`s at 278-288), `castSpell` (`actor/cast.mjs:55-147`),
movement (`documents/movement.mjs`: `onTokenMoves` 155-196 charges only at your own Opportunity
(`opportunityOf` 205-214), an off-turn drag is free and allowed; `chargeMovement` 227-248). The
coordinator's `#handleDeclare` (`combat/attack-coordinator.mjs:723-787`) checks OWNER and one live
Blow, never the turn. Reactions pay through `SwCheck.chargeReaction` (`dice/check.mjs:512-520`),
`chargeReactionFromCard`, `onIntercept`, `preventExposeFromCard`, `rerollByRule`; a Riposte is free.
Reusable: the GM-only card controls (`[data-gm-only]`, `chat.mjs:160-162`), `postCard` /
`cardActions` / `requireOwner` (`helpers/cards.mjs`), `responsibleFor` / `isElected`
(`helpers/authority.mjs`), the socket router by prefix (`starwrought.mjs:256-262`).

**Item 6.** `prepare()` (`actor/actions.mjs:198-247`) writes `preparing { kind, label, weaponId,
targetTokenId, targetUuid, cost, strike, talentId, cast, targetUuids }`, `value -= cost`,
`reserved = cost - 1`, the `preparing` condition, and posts the card with **Finish and Abandon at
once** (230-245; `data-owner-uuid` buttons dispatched in `chat.mjs:198-199` with no turn check).
`beginOpportunity` posts it again through `postPreparedCard` (`cards/round.mjs:113-133`, handlers
349-365). The sheet's pips (`templates/actor/action-pips.hbs:32-45`) show both while Preparing.
`finishPrepared` (254-289) has no turn check; `abandonPrepared` (296-317) takes a reason (choice,
wound, replaced). Nothing records which Opportunity the preparation began on.

**Item 4.** `endRound` (`combat.mjs:494-520`) posts `postWindReminder` (`cards/round.mjs:68-89`)
with `whisper: ownersOf(actor)` (GMs plus owners; `helpers/cards.mjs:71-73`; `tableFor` 79-82 is the
public-for-a-PC alternative). `onWindCheck` (218-250) rolls `SwCheck.roll({ kind: "check", slug:
endure, threshold })` with no `rollMode`, so the core roll mode and the dialog's select
(`dice/check/dialog.mjs:123-124, 157`) decide; `applyRollMode` in `dice/check/card.mjs:37-46`. The
Fatigued card after a failure already goes to `tableFor` (public for a PC).

**Item 7.** `system.bind = { state: "" | neutral | controlling | controlled, partnerUuid, mine,
theirs, id }` (`data/actor.mjs:89-104`). `formBind(partner, { state, mine, theirs, announce, pair,
id })` (`actor/bind.mjs:31-81`) writes this side and the mirror when owned, posts `Bind.controlTaken`
or `Bind.formed`, and can re-form an existing Bind with a new state; `endBind` 92-114; the pair
keeper `documents/bind.mjs`. Control is offered only on a check card (`dice/check/position.mjs:
90-105`; `formBindFromCard` in `cards/position.mjs:112-150` forms it, then a Zone picker Exposes the
partner's Zone once, directly or over `relayExpose`). The sheet's `templates/actor/bind-line.hbs`
has End Bind alone (`actor-sheet.mjs:124, 1043-1045`; `npc-sheet.mjs:37, 237`; `bindContext`
`helpers/actor-context.mjs:102-124`). Controlled automation today: the −2 Situation on a
character's weapon attack with the Controlled implement (`actor/attack.mjs:205-214`,
`SW.CONTROLLED_PENALTY`); not on an adversary's attack rows (`combat/attack-source.mjs:211-217`);
the Exposed Zone is not stored on the Bind and `endBind` does not close it. i18n:
`STARWROUGHT.Bind.*` (`lang/en.json:326-350`) already has `takeControl`, `takeControlHint`,
`close`, `closeHint` (unused).

## Design

Version **0.19.0**. No data moves. Every change below is in `foundry/starwrought/`; the eleven
stylesheet stamps, `system.json` and `SYSTEM_VERSION` move together.

### 2. A combatant with no Opportunity to take is skipped

- `SwCombat#canTakeOpportunity(combatant)` (new, `documents/combat.mjs`): false for the defeated
  (as today) and for an actor whose `actions.value === 0 && actions.reserved === 0 && !preparing`
  (a Preparing fighter with a reserve keeps its Opportunity: the book makes it Finish or Abandon
  there). Party actors excluded as everywhere.
- `nextTurn()` walks past combatants it returns false for; when nobody is left with an Opportunity
  it calls `nextRound()` ("When nobody has any actions left ... the round ends"). The lone-combatant
  branch does the same.
- `opportunityHolders` becomes the combatants that can take an Opportunity now, so "a full circuit
  of Passes" counts only them and the tracker header's "2 of 5" reads right.
- The tracker row of a skipped combatant is dimmed with a "no actions: skipped" tooltip
  (`apps/combat-tracker.mjs`, `styles/tracker.css`).
- **The stale-stamp bug** is fixed on the way: `beginOpportunity` clears the current combatant's
  `passed` / `acted` stamps (written by the client that runs it, which owns the combatant or is
  the GM), so `didPass` reads this circuit's answer only.
- Consequence recorded in the changelog: a fighter at 0 actions loses the chance to Drop Prone ⓿
  or Release ⓿ on their own Opportunity (0-cost Maneuvers); the GM's Previous Turn gives it back.

### 6. Finish waits for the next Opportunity

- `prepare()` writes `preparing.ready = false`; `beginOpportunity` (the Opportunity's start, on
  the responsible client) sets `ready = true` on a Preparing combatant with `swAnnounced`. No
  counter, no circuit arithmetic: the next time this combatant's Opportunity begins IS the next
  Opportunity.
- The card posted by `prepare()` carries **Abandon only** (decision 1 below may hide that too);
  `postPreparedCard` at the next Opportunity carries both, as today. The sheet's Finish button is
  disabled with the tooltip "Finish at your next Opportunity" until `ready`. `finishPrepared()`
  refuses while `!ready` with a notice (a GM may still force it from the sheet: `{ force: true }`
  from the GM's client), so a stale card cannot Finish early either.
- The round-end expiry, the Wound abandon and the replace path are unchanged.

### 5. Off-turn Maneuvers wait for the GM

- One reading, `SwActor#mayActNow({ reaction })` (new, `documents/actor/actions.mjs`): true outside
  an encounter, for a GM's own client, for a Reaction, Posture, Defense roll, reroll, Intercept,
  Riposte, Finish or Abandon, and for the actor whose Opportunity it is; otherwise it looks for a
  **permit** (`flags.starwrought.permit = { round, by }`, one shot) and returns false without one.
- Every spend site above calls it **before the effect**: `SwItem#use` (non-Reaction), `rollAttack`
  (a Strike that is not Intercept or a Riposte; before `declare`), `castSpell`, `recenter`,
  `raise`, `toggleVisor`, `setCarryState`, and `onTokenMoves` (an off-turn drag of a
  player-controlled token in the combat is refused in `preMoveToken` instead of being free).
- A refused attempt posts **one request card** to the GM (`cards/opportunity.mjs`, new: "Wren wants
  ❷ Deliberate Strike (Battleaxe) outside their Opportunity" with GM-only **Approve** / **Refuse**;
  while one is pending for the actor, further attempts only get the notice). Approve writes the
  permit on the actor (the GM can write any actor) and says so publicly; the player then performs
  the action, which spends the permit (`spendActions` clears it). Refuse says so. With no GM
  connected the card waits, as an adversary's Blow does (ruling 162).
- The GM's adversaries are never gated. FEATURES.md's "Nothing is ever prevented" paragraph is
  rewritten: off-turn Maneuvers now are, by Mike's playtest ruling.

### 4. The Wind roll is public

- `postWindReminder` posts with `tableFor(actor)` (public for a player's fighter, GM-only for an
  adversary) instead of `ownersOf`; `onWindCheck` passes `rollMode: "publicroll"` and the dialog
  shows the mode locked (a `lockRollMode` option on `SwCheck.roll`, read by the dialog; also used
  by nothing else yet). The failure card stays as it is (already public).

### 7. Take Control on the sheet; Controlled carried by the Bind

- `bind-line.hbs` gains **Take Control** beside End Bind while the state is neutral or controlled
  (the partner's weapon), for the owner or the GM; `actor-sheet.mjs` / `npc-sheet.mjs` action
  `takeControl` → `SwActor#takeControl()` (new, `actor/bind.mjs`): `formBind(partner, { state:
  "controlling", id })` then the Zone picker, extracted from `formBindFromCard` into a shared
  `pickControlZone(actor, partner)` (`cards/position.mjs`) that both paths call.
- The Zone chosen is stored on both sides' `system.bind.zone` (new field) and mirrored by the pair
  keeper; **when the Control ends** (End Bind, a change of Control, the automatic endings in
  `attack.mjs`, `position.mjs`, `carrying.mjs`, all through `#writeBind`) that Zone is closed on
  the Controlled partner if it is still Exposed and not by a Posture ("Exposure caused specifically
  by Control ends when that Control ends"). Formed from the card it was Exposed once and left open
  before.
- The −2 Situation reaches **an adversary's attack rows**: `attack-source.mjs` lowers the Attack
  Threshold by `CONTROLLED_PENALTY` when the adversary's `bind.state === "controlled"` and the row's
  name matches `bind.mine` (case blind), else when the adversary has one attack row; the card says
  "Controlled weapon −2".
- Not built: a Form Bind control with no Bind (the card forms them); Close ❶ as a Maneuver.

### 1. What others can see: a token glance card

- `module/canvas/glance.mjs` (new) + `styles/hud.css`: on `hoverToken` over a token whose actor is
  a character or an adversary, a small card beside the token for **every user who can see the
  token**: the actor's name; held implements (a raised shield marked); worn armor per Zone by piece
  name; the four Zones with Exposed and Wounded marks (Wound count per Zone); the conditions the
  token shows. **Numbers that are the sheet's stay off it for non-owners**: Protection, Vigor,
  Thresholds, Load Strain (an owner or the GM sees Protection too). Client setting `showGlance`
  (default on) and a 250 ms hover delay so a pass of the mouse shows nothing.
- The same panel is the **LIMITED sheet**: `_configureRenderParts` on both sheets renders only a
  `glance` part for a user below OBSERVER (today LIMITED sees every tab read-only, which is more
  than the GM meant by LIMITED); an Observer keeps the full read-only sheet.
- Per-Zone Wounded statuses on the token are not added (four more icons on every wounded token);
  the glance carries the count.

### 9. A search box on the Constellations tab

- `templates/actor/constellations.hbs` toolbar gains `<input type="search" class="sw-filter">`
  (placeholder "Filter Constellations and Talents"); `SwCharacterSheet` keeps `#filter` beside
  `#collapsed`, wires `input` and `Escape` in `_onRender` (the sheet's first), and
  `#prepareConstellations` honours it: with a filter every Constellation is rendered **expanded
  with its Talents** (the collapsed state is not written, only ignored) and a row or Talent whose
  name does not contain the text (case blind, glyphs ignored, the category label too) gets
  `hidden`. Keystrokes filter the DOM; the first keystroke and the clearing re-render the part
  (to bring Talents in and to restore the collapse state), with focus and caret put back on the
  input. Unopened rows take part when the toggle is on. `styles/character.css` styles the input.

### 10. The Token HUD keeps its apparent size when zoomed out

- `apps/token-hud.mjs`: on `renderTokenHUD` and `canvasPan`, set `--sw-hud-scale` on `#token-hud`
  to `clamp(1, 1 / canvas.stage.scale.x, 4)`; `styles/hud.css`: `#token-hud .col.left { transform:
  scale(var(--sw-hud-scale)); transform-origin: right center }`, `.col.right` from `left center`,
  and the attribute bars from the bottom, so the controls grow **outward from the token** and
  never shrink below their size at 100% zoom (capped at 4× so a far zoom-out does not fill the
  screen). Core's layer scaling is untouched. Checked on v13 (installed) and noted for v14.

### Records

- `CHANGELOG.md` 0.19.0 entry (the rulings, numbered on from 198), `FEATURES.md` (the six-action
  round, Chat's Prepared and Round cards, Sheets, Conditions, section 9's "Nothing is ever
  prevented"), `lang/en.json`, the eleven CSS stamps, `system.json`, `SYSTEM_VERSION`; `CLAUDE.md`
  gets a short 0.19.0 paragraph and the memory a note.

## Mike's decisions (2026-11-08, by question)

1. **Abandon stays on the first card** (item 6); Finish alone waits for the next Opportunity. The
   book's "at any time" stands.
2. **Off-turn drags are gated too** (item 5): a player's off-turn drag of a token in the combat is
   refused and asks the GM like any other Maneuver; Reactions, Postures, Defense rolls, rerolls,
   Finish and Abandon are never gated.
3. **The hover card plus the LIMITED sheet** (item 1): every user who can see a token gets the
   glance on hover; a LIMITED sheet shows the glance alone; no Protection, Vigor, Thresholds or
   Load Strain for a non-owner, an adversary's gear by name only.
4. **Take Control only** (item 7): on an existing neutral or partner-controlled Bind; the Control
   Zone tied to the Bind; the −2 on an adversary's Controlled attack row. No Form Bind control.

## Mechanics confirmed in the code before implementing

- `beginOpportunity` (`combat.mjs:555-581`) already runs on `responsibleFor(actor)`'s client, which
  may write the actor and the combatant: the `preparing.ready` write and the stamp clearing go there.
- A Zone carries `exposed` and `postureExposed` (`data/actor.mjs:57-61`; `setExposed` in
  `actor/position.mjs:45-60`): the Control Zone is recorded on `system.bind.zone` and closed by
  `#writeBind` when the Control ends, only while `exposed && !postureExposed`.
- `SwCheck.roll` merges `rollMode` from `core.rollMode` (`dice/check.mjs:95`); a `lockRollMode`
  option read by `prompt` (`dice/check/dialog.mjs`) hides the select and keeps the caller's mode.
- `nextTurn` (`combat.mjs:219-250`) is the one path for Next Turn, End Opportunity and Pass, and
  `movedForward` (419-427) reads `opportunityHolders` for the wrap, so narrowing the holders to
  the combatants that can take an Opportunity keeps the wrap detection right.

## Order of work

Items 2 and 6 together (`combat.mjs`, `actor/actions.mjs`, `cards/round.mjs`, `action-pips.hbs`),
then 4 (`cards/round.mjs`, `dice/check*.mjs`), then 7 (`actor/bind.mjs`, `data/actor.mjs`,
`bind-line.hbs`, the two sheets, `attack-source.mjs`, `cards/position.mjs`), then 5 (the gate and
its card, every spend site, `movement.mjs`), then 9, 10 and 1 (UI), then the records and the
twelve stamps, then the live drive. All in this session: every step shares `lang/en.json`,
`CHANGELOG.md` and `FEATURES.md`, so no step runs apart.

## Verification

- `node assets/test_rules.mjs` (nothing in `module/rules/` changes; it must still pass), `node
  assets/build_all.mjs --content` (the stamp check over the twelve stamps, the CSS double-declare
  check, the grammar-document gate), `node --check` on every touched module, `python
  assets/check_style.py` (new en.json strings).
- Live, in the test world with a GM tab and a player tab (the hidden-pane route in memory):
  (2) a fighter spends to 0 and Next Turn passes over them; a Preparing fighter at 0 free is not
  skipped; everyone at 0 ends the round; the streak header; the stamp bug (act on circuit 1, Pass
  on circuit 2, the streak counts). (6) Prepare a Committed Strike: the first card has Abandon
  alone, the sheet's Finish is disabled, the next Opportunity's card Finishes. (5) a player's
  off-turn Strike, Recenter and drag are refused with one request card; Approve lets exactly one
  through; Refuse says so; a Reaction and a Defense roll are untouched; the GM's adversary is
  untouched. (4) the Wind card and its roll appear in the player tab's chat. (7) Take Control from
  the sheet on a neutral Bind, the Zone picked, the chain's arrowhead; End Bind closes that Zone
  and leaves one Exposed by a Posture; an adversary's attack row reads −2 while Controlled. (1) the
  glance card on hover for the player over Tess, Wren and the Bandit with the right lines and no
  numbers; a LIMITED user's sheet shows the glance alone. (9) typing filters, Escape clears, the
  collapse state survives. (10) zoom out to 0.3 and the HUD controls keep their size, capped.
