# The automation framework (system 0.9.0; the first kind, `bonus`, 0.10.0; Fantasy Grounds' shape, 0.16.0; every line in brackets, 0.17.0; the `substitute` kind, 0.21.0; the `give` and `alter` kinds, 0.22.0; the `permit` kind, 0.24.0; the `subordinate` kind, 0.25.0; the `requires` kind, 0.28.0; Effects read by name, 0.31.0; the `apply` kind, 0.32.0; the Conditions workbook, 0.33.0; the `check` kind, 0.34.0; immunity to a trait, 0.35.0; a bare CHECK is every roll, 0.36.0; the `cost` kind, 0.37.0; the `cannot` kind, 0.38.0)

**0.38.0 (2026-11-19).** ONE NEW KIND, `cannot`, WITH NO HOOK POINT (rulings 385 to 392). Mike:
"Grabbed currently is hard-coded to 'cannot Evade' ... I would like to make that an automation
grammar to prevent the use of a Defense." `[EFFECT CANNOT: evade]` on a CONDITION'S ROW (and
nowhere else this release, as `IMMUNE: TRAIT(...)` and `COST` began): whoever has the Condition
cannot answer an attack, or a Maneuver's check, with that Defense.

- **The kind** (`kinds/cannot.mjs`): tag `CANNOT` in `EFFECT_TAGS`, `CONDITION_ROW_TAGS` and
  `EFFECT_KINDS`; one Defense by name (`defenseKeyOf` in `check.mjs`), no component; stored
  FLAT, `{ kind: "cannot", defense, name }`. WHAT WAS WRITTEN DECIDES THE MESSAGE, never the
  number of commas: the words after the tag are read one by one (`wordsOf`), so `move, step`
  is "not read yet" and `evade guard` is "one Defense to a line". The file imports nothing
  that reaches the registry.
- **The reader is `cannot.mjs`** (this folder): `unusableDefenses(actor)` answers, for each of
  the four Defenses, the id of the Condition that takes it away, or null. Condition carriers
  alone through `rulesOfKind`; an "against X" carrier passed over; `reasonOf(item, held)`
  walks the creature's own set up to the Condition it has itself. IT RUNS INSIDE BOTH DEFENSE
  PASSES, SO IT NEVER THROWS: an entry of a shape it does not know is passed over. **The old
  rule is a guard here** (`EVADE_BY_HAND`): Evade while Grabbed or Restrained, for each only
  while that Condition has no row. THE ROW IS THE WORD: with a row and no line, nothing.
- **The two Defense passes** (`data/character/defenses.mjs`, the npc model in `data/actor.mjs`)
  write the answer onto `system.defenses[key].unavailable` for all four Defenses, where every
  reader of an unusable Defense already looked; each of those is generic over the key.
  `unavailableEvade` and `heldConditions` left `data/character/shared.mjs`.
- **IT IS ABOUT ANSWERING** (ruling 389): nothing outside an answer reads `unavailable`. The
  Wind check, the default Initiative, a Search and a Defense rolled from the sheet never ask.
- **One rule for "may this Defense answer"**, in `helpers/answers.mjs`: `unusableReason`,
  `usableAnswers` (with none usable every one permitted stands, ruling 390) and
  `refusedDefense`. `legalAnswers` offers no Reaction and no Posture on an unusable Defense;
  `isLegalAnswer` refuses a refused one. The Combat window draws from them and the
  coordinator's `#commitDefense` refuses by them (`unusableDefense`), so the two cannot
  disagree, though each reads its own copy of the actor.
- **AN ANSWER IS JUDGED ONCE, AT THE REVEAL** (ruling 391). `defenseThresholdFor({ ..., frozen
  })`: frozen, the Defense, the Reaction and the Posture stand as given (no "cannot be used"
  move, no Head Wound drop, no "Talent since removed" drop) and only the numbers are read as
  they are now. `#reveal` reads UNFROZEN and stores what the read kept; `#resolvePairing` and
  `thresholdForCard` (a reroll) read FROZEN, with the one Defense permitted. **A new caller
  that reads a Threshold for an answer already revealed passes `frozen: true`.**
- **The Combat window reads the draft BEFORE it renders** (`#onCommit`): a render prepares its
  context at once, and that clears a draft whose Defense has become refused. It redraws on
  the three ActiveEffect hooks, by a timer.
- **The build** (`assets/lib/conditions_build.mjs`) warns when no `CANNOT: evade` line reaches
  Grabbed or Restrained (the rule the code used to hold), and when a `CANNOT` line sits on a
  Condition that takes X (it reaches everyone).

**0.37.0 (2026-11-19).** ONE NEW KIND, `cost`, WITH NO HOOK POINT (rulings 375 to 384). Mike, of
the Heedless row ("Maneuvers with Concentrate take 1 extra action"): "how should we automate
Heedless?" `[EFFECT COST: 1; IF: TRAIT(Concentrate)]` on a CONDITION'S ROW (and nowhere else this
release, his choice, as `IMMUNE: TRAIT(...)` began): while a creature has the Condition, a thing
that carries the trait outright costs that many more actions.

- **The kind** (`kinds/cost.mjs`): tag `COST` in `EFFECT_TAGS`, `CONDITION_ROW_TAGS` and
  `EFFECT_KINDS`; one descriptor (a whole number, 1 to 6) and exactly one `TRAIT(...)` condition,
  one word; stored FLAT, `{ kind: "cost", value, trait, name }`. On a COST line `TRAIT(...)` is
  the thing being USED (the effect reader stores a trait the same after `IF:` and `IFT:`; the
  kind decides what it is about). **No hook, as `ignore` has none**: `costRaise(actor, traits)`
  (in `cost.mjs`, below) reads `rulesOfKind(actor, "cost")`, Condition carriers alone, one
  carrier once (its largest matching line), carriers added, an "against X" carrier passed over,
  a stored value above the ceiling read as the ceiling; `carriesTrait` wants the trait written
  alone (`traitGroups`: "A or B" is neither). **THE KIND'S FILE IMPORTS NOTHING THAT REACHES THE
  REGISTRY** (`syntax.mjs` and `operators.mjs` alone): the reader needs the engine, the engine
  imports the registry and the registry imports the kind, so with the reader in the kind's file
  an import of it before the registry threw "Cannot access 'cost' before initialization" (the
  review of 0.37.0). `cost.mjs` imports the registry first and may be imported first; the
  self-test imports each of the two first, in a process of its own. (`kinds/ignore.mjs` has had
  the shape the kind's file had since 0.15.0 and loads only because the engine is reached before
  it: stated, not changed.)
- **What a raise reaches is `cost.mjs`** (this folder), ONE ANSWER FOR THE CHARGE, THE SHEETS
  AND THE BUILD: `costRoad(item, { actorType, owned })` names the road a Maneuver's cost takes,
  in the order `SwItem##useManeuver` takes them (`builtin`, `recenter`, `use`, `elsewhere`,
  `reaction`, `passive`, `row`), and `rowRaise` raises only on `row` and `recenter`.
  `paidElsewhere` lives there too (it moved from `documents/item.mjs`), with `raiseWords` and
  `raiseReason`. **A new road through `##useManeuver` needs its line in `costRoad`**, or the tab
  and the charge disagree. What a SHEET shows is `shownRaise` (`helpers/situation.mjs`):
  `rowRaise`, and nothing for a row while the `trackActions` setting is off, since the charge
  then never asks (Recenter's stands: it pays whatever the setting says).
- **The raise is added in `##chargePlan` alone**, at its two `picked: true` answers. The plan
  carries `n` (what is paid), `listed` (the row's own cost for this use, the VERSION) and
  `raise`. `##applyCost` answers `listed`: **`IF: COST(<n>)` is the version used, never a raised
  price** (ruling 380). A Prepared Maneuver stores `listed` beside `cost` in
  `system.actions.preparing` (free-form), and `finishPrepared` hands `listed` back as `paid`
  and `cost` as `charged`, which only the Finish card's glyph reads.
  `##useWithRules`, the Reaction branch and `partOf` are NOT raised. **The reason is said where
  the spend is not**: an adversary's spend card is never posted, so its Maneuver's own card
  carries the reason line and its check card's subtitle carries "(Heedless +1)".
- **Recenter** pays in its own code: `SwActor#recenterCost({ item })` reads the row's traits (the
  row handed in by the built-in, else `findManeuver` in `helpers/content.mjs`), and only when no
  row can be read do `BUILT_IN_TRAITS` (`documents/maneuvers.mjs`) stand in; the build holds that
  list to the shipped row (`builtInTraitNotes`). `RAISED_BUILT_INS` names the built-ins that ask.
- **The build** (`costCensus`): a `COST` line's trait that no shipping Maneuver carries outright
  (or that only rows costing no actions carry), and one carried by something the raise does not
  reach (a road above, a Talent, a weapon). A basic row is read as used from the compendium
  (`owned: false`), a granted one as owned.

**0.36.0 (2026-11-19).** No new kind and no new hook point: ONE NEW TAG, `SKILL`, AND TWO RULES
OF THE `bonus` KIND CHANGED (rulings 366 to 371). Mike: "Can't CHECK include ALL rolls/thresholds,
but ATK and DEF just mean attack checks and defense checks respectively?"

- **Two scopes** (`SCOPES` in `kinds/bonus.mjs`; `scopeReaches(slug, kind)` is the one test). The
  new scope `rolls` reaches `check`, `initiative`, `attack` and `defense`, and is what a bare
  `CHECK:` is read as. The scope `checks` is UNCHANGED (`check`, `initiative`) and is what the
  new bare tag `SKILL:` is read as. So **a stored rule keeps the meaning it was read with**: a
  rule stored before 0.36.0 with `to.slug: "checks"` behaves as it did, and becomes `rolls` only
  when its cell is parsed again: by the build, by `SwItem#_preUpdate` when a world Item's
  `system.automation` TEXT is in the change, or by `prepareEffectsUpdate` (`rules/effects-state.mjs`) when a custom effect row's
  text or label changed. **Sync content does not parse**: it passes `swBuilt: true` with the
  source's whole `system`, and `_preUpdate` then leaves the build's `system.rules` as they are
  (through 0.35.1 it parsed the text again for every Item the sync wrote, so a client newer than
  the pack sources changed the meaning of whichever copies it happened to write). `summary()`
  names a scope as it is known now, so such a rule reads "to Skill checks".
- **One carrier is one circumstance.** The hook's `source` is `rule:<carrierKey>` (it was
  `rule:<carrierKey>:<target slug>`), so `resolveModifiers` keeps the strongest bonus and the
  strongest penalty of ALL of one carrier's lines that reach a roll. Every consumer resolves the
  union of what the Defense pass stored and what the moment adds, so this holds on every path:
  the second reader of the design ran ten kinds of roll and seven adversary numbers. A kept road
  roll keeps `source` on its record AND hands it back (`roadRoll` in `helpers/party.mjs`), and an
  attack's pairing card lists what counted (`listed` on the result of `SwCheck.resolveAgainst`;
  `modifiers` stays the die's lines and then the pairing's, which a reroll splits by position).
  A line that is set aside still files its `LIMIT` mark, and a ticked claim weaker than a
  standing line of the same carrier is spent for nothing: both stated, neither built.
- **An every-roll line is counted once because the Defense pass folds it in.** `prepareDefenses`
  asks `kind: "defense"`, which `rolls` reaches, so the line is in each Defense's stored
  modifiers; a roll that rolls those modifiers (a Defense roll, a Defense rolled as a check, an
  Initiative with Awareness) asks `momentOnly`, which drops a static line. A NEW SCOPE THAT
  REACHES `defense` IS COUNTED THIS WAY AND NEEDS NO EXCEPTION; one that does not reach
  `defense` is not in the stored modifiers and stays out of those rolls (the `SKILL` quirk).
- **`callHook`'s second look asks what the Defense pass asked** (`kind: "defense"`, no Item, NO
  RANK, `staticOnly`): a one-roll custom effect, or a Skip, is spent only by a roll whose Defense
  number really held the line. Through 0.35.1 a static line to Skill checks was spent by a Wind
  roll that never applied it.
- **A kind's own name for a tag list is derived**: `SKILL` is in `EFFECT_TAGS` (after `check`,
  which stays the `bonus` kind's first tag), `MODIFIER_TAGS` and `CONDITION_ROW_TAGS`; the
  scope words `rolls` and `checks` are refused as targets by `bonus`, `give` and `substitute`.
- **Not built:** `prepareDefenses` passes no `rank`, so a static line with `IF: RANK(roll ...)`
  never holds on a Defense, an every-roll one included: such a line reaches checks, attacks and
  an Initiative rolled with a Skill, and no Defense roll, Defense rolled as a check or default
  Initiative. The kind WARNS at parse (`context.warn`) for a bare `CHECK` and for `DEF`.
- **Three slips are told what to write** (the review): a tag in a block of its own (`[SKILL 1
  situation]`, `readBlock` in `features.mjs`), a tag inside EFFECT with its colon lost (any tag
  now, `grammar.mjs`), and a comma with nothing after it (`effects.mjs`: refused, since the line
  would otherwise read as every roll). A message that says what to write prints the value AS
  WRITTEN (`-N`, never the sign it is stored as).

**0.35.0 (2026-11-19).** No new kind and no new hook point: THE `prevent` KIND READS A THIRD
FORM, AND ITS HOOK POINT IS ASKED A SECOND QUESTION (rulings 350 to 360). Mike: "I want to add
an automation to make the person immune to attacks/spells/effects/etc. with the Visual trait.
We already have [IMMUNE] in automation grammar, so should we extend it to allow for adding of
Traits in there?" `[EFFECT IMMUNE: TRAIT(Visual)]` on a CONDITION'S ROW (and nowhere else this
release; nothing after it) is stored as the kind's own rule with two more fields, `{ kind:
"prevent", effect: "trait", trait: "visual", name: "Visual" }`, so every rule stored before is
unchanged. `IMMUNE` joined `CONDITION_ROW_TAGS` (`syntax.mjs`) in that form alone: a Condition
or `expose` after it is refused on a Condition's row.

- **The question.** `ruleTraitImmunity(actor, traits, { other })` in `engine.mjs` asks
  `rulePreventers` with `effect: "trait"` and the thing's trait keys in `threat.traits`, where
  the hook already looks for `IFT: TRAIT(...)`. It passes NO scene and NO encounter, so every
  client answers the same and the answer spends nothing: a triggered point asked as a
  calculation. `immunity.mjs` is the pure half (`traitGroups`: a thing's traits as groups of
  alternatives, "Auditory or Visual" one group of two; `coveredGroup`: immune when any ONE
  group is wholly covered; `immunityWords`). `prevent.mjs` has the Foundry side
  (`traitImmunity`, `immunityNote`, `immunityRecord(target, name, traits, { other, key })`).
- **Against one creature.** The hook passes over a carrier that is a Condition held only
  "against X" (`carrier.condition.against`) unless `context.other` is one of those creatures.
  A caller that knows who is acting passes `other`.
- **Where it is asked.** Wherever a thing would land, and each place asks for itself: the roll
  window (`#rollPlanned` in `documents/item.mjs`, `defendFromCard`), the card as it is posted
  (`immunityOf` in `dice/check/card.mjs`, which keeps `flags.immune`, and the traits as
  `flags.itemTraits` for the write to ask with), a request card as it is drawn (and it is drawn
  again when a Condition comes to its target or goes), the write (`applyOnce` hands `applySide`
  no lines and one note; `giveOnce` refuses), and the attack (`AttackCoordinator.#resolvePairing`
  hands `SwCheck.resolveAgainst` the record: the note, no damage buttons, no Expose of the
  defender). A reroll asks again, of either kind of card: `rerollCheck` through the card it
  posts, `rerollCard` with the attack's traits as the first card kept them (`flags.threat.traits`).
  Nothing is refused: the system says it and goes on (ruling 354).
- **A caller that lands something new on a creature asks `immunityRecord` first.** A Maneuver
  whose whole use is a `MARK`, a `PERMIT` or a `SUBORDINATE` line does not ask yet.

Beside it, A CONDITION HAS TWO TEXTS: a registry record holds `effect` (the rules text) and
`flavor`, read through `conditionEffect(id)` and `conditionFlavor(id)`. `conditionDescription`
is gone, so a reader that was missed fails at import.

**0.34.0 (2026-11-19).** The twenty-fifth kind, `check` (rulings 337 to 349), and no new hook
point. Mike: "when I add new talents I don't want to hard-code what the check is. So wouldn't it
make sense if the check was also using automation grammar, as well as the success/failure
effects?" Through 0.33.0 the check a Maneuver rolls was GUESSED by the build from the row's
Constellation column and the Effect's prose ("vs. Evade or Guard" read as Evade alone). It is now
DECLARED on the Maneuver's own row as a feature block, `[CHECK Athletics or Acrobatics vs Evade
or Guard]`:

- **The pure half is `check.mjs`**: `readCheck(data, context)` (left of the word `vs`: `relevant`
  or Constellations joined by `or`; right: Defenses joined by `or`, or one number), the words,
  and **`planOf(rules, stored)`**, the one reading of what a Maneuver rolls: the row's `check`
  rule when it has one, else the three stored fields (`system.check`), which stay for a row with
  no block. The action model derives it as `system.checkPlan`, and every reader of a
  Maneuver's check asks the plan (`SwItem#useManeuver`, `maneuverAttributeOf`, the Item
  window, the build's `checkOf`). The road's `explorationOf` in `helpers/party.mjs` still reads
  `system.check`: an Activity cannot carry a block.
- **`kinds/check.mjs` is a wrapper with NO HOOK, on purpose**, as `requires` is: a `use` hook
  would send the row down `#useWithRules`, which never rolls. Nothing asks the kind at a roll;
  `SwItem` reads the plan. So `check` is in `FEATURE_KEYWORDS` (before `EFFECT`) and never in
  `EFFECT_TAGS` or `EFFECT_KINDS`, and it has no On / Skip / Off.
- **`or` is whoever it affects** (Mike): left of `vs` the one using the Maneuver picks
  (`pickConstellation({ only })` in `documents/actor/checks.mjs`); right of `vs` the target
  picks, by buttons on a chat card. The request's rules are pure, `check-request.mjs`
  (`validRequest`, `usableDefenses`, `validAnswer`, `standingAnswer`, `requestState`,
  `userDegree`, `adversaryCheck`); the cards are `documents/cards/check-request.mjs`, modelled
  on the Gain Control request. This is a triggered moment with no hook point of its own: the
  event is the request card's id, an answer is a card (the first valid one in log order stands,
  and its author must own the target or be the GM), and one request gives one roll (`resultOf`,
  `countsForRequest`, `requestStillWaits`). **A REQUEST'S OWN AUTHOR IS CHECKED TOO**
  (`validRequest`, read by `recordOf`: the GM, or an owner of the creature using the Maneuver),
  because this is the first card chain that acts unasked on the GM's client: a player's roll
  card makes it post the adversary's result. The review of 0.34.0 found the hole; a card with a
  request's flags from anybody else is no request.
- **`splitAlternatives` in `syntax.mjs`** is the one reading of `a or b or c`, shared with
  `requires.mjs`, which used to keep it.
- **An adversary rolls nothing against a player's character** (Mike: "players ALWAYS roll vs.
  NPCs"): the player rolls the Defense against the adversary's typed number
  (`system.checks.<slug>`, `checkNumber(slug)` on the npc model, blank 10, moved by its
  Conditions through `conditionModifiers`), and the GM's client posts the Maneuver's own result
  card with the degree read from the other side (`userDegree`). `ruleApplies` is asked for the
  adversary there, so the APPLY buttons need no change.
- **The forms written the other way are each told the right one.** `[EFFECT CHECK Athletics vs
  Guard]` is told the block (`grammar.mjs`'s keyword lookup; with a colon, `effects.mjs`'s
  modifier-tag message), `[CHECK: ...]` the effect block (`features.mjs`: only a word that IS an
  effect tag and no feature keyword is told to wrap itself, so `[TRAIT: Human]` and `[SPEED: 6]`
  keep the keywords message the red-cell tool reads). A bonus to checks stays `[EFFECT CHECK: 1
  condition, aid]`, and **`isBonusShape` (`check.mjs`) is asked FIRST wherever a `CHECK` is
  read** (the kind before its carrier refusal, and both of `grammar.mjs`'s branches), so a bonus
  with its colon lost is told the effect form on a Talent as on a Maneuver.
- **The census** (`effectCensus` in `applied.mjs`) reads the rule, so a declared row is never
  told it "rolls no check" whatever `rolls` the caller handed over, and warns on a CHECK block
  beside a line that takes the whole use (`takesUse`: MARK, PERMIT, SUBORDINATE) or on a
  built-in (`runsItself`). A row another act pays for (`runsElsewhere` and not `runsItself`:
  Leap, Cast) is still used from its row and rolls its declared check, so it is not warned.

**0.33.0 (2026-11-18).** No new kind and no new hook point: THE CONDITIONS ARE DATA (rulings 322
to 336). `data/conditions.xlsx` is the only source for what a Condition says and does, and its
rows fill a live registry (`../config/conditions.mjs`: `registerConditions(rows)` rebuilds from the
built-ins plus the rows; a row that names none makes a Condition, Supine the first). Four things
in this folder carry it:

- **A Condition's row is an item type** (`CONDITION_ROW` in `syntax.mjs`, `itemType: "condition"`).
  It reads the `bonus` tags alone (`CONDITION_ROW_TAGS`: CHECK, ATK, DEF, INIT; `grammar.mjs`
  refuses the rest and every feature block), and `kinds/bonus.mjs` refuses on it every component
  that asks about an owner (RANK, FOR, ALLIES, SEEN, LIMIT, CLAIM, MARKED, EFFECT).
- **`N` is a value** (`effects.mjs`), read on such a row alone: stored `value: -1, scale: "N"`,
  copied by `bonus`'s `parse` (which returns a fixed list of fields) and multiplied in its hook by
  the carrier's value. `summarize` says `-N`.
- **What a creature HAS** is `condition-set.mjs` (pure): `closeConditions({ direct, torso })`
  closes its statuses over each Condition's `includes`, adds Off-Guard for a Wounded or struck
  Torso (the STORED `zones.torso.wounds` and `.critical`, since the rules are collected before the
  Wounds are derived), and keeps an inclusion written "against X" apart, keyed by the uuid of the
  creature that applied the including Condition (`flags.starwrought.applied.by`). `effectList`
  reads the same closure, so `EFFECT(...)`, `[REQUIRES ...]` and the numbers agree; `listHas`
  takes a `viewer` for "against X". `APPLY` and `REMOVE` stay on the raw statuses.
- **The carrier.** `collectRules` adds one for each Condition in that set that carries lines
  (`conditionCarriers` in `engine.mjs`: `{ id: "condition:<id>", type: "condition", condition:
  { id, value, against, via, direct } }`), so the `modifiers` hook point reads a Condition's
  lines as it reads a Talent's. One Condition is one `source`. The `bonus` hook treats an
  "against X" carrier as a rule read only where the roll's other party is known, and lets it
  through `pairingOnly`. A Condition's line has no state: `rulesOfKind` never reads one for it
  and `helpers/effects.mjs` lists the lines read-only (`conditionInfo`). **Do not add
  "condition" to `RULE_ITEM_TYPES`**: it is no Item.

`conditionModifiers(actor, context)` is `ruleModifiers` held to the Condition carriers, with no
scene: what an adversary's numbers read (its own Talents stay unread) and what a character's
weapon rows add. **The old hard-coded numbers are guards now, not gone**: the Off-Guard,
Frightened and Fatigued blocks in `data/character/defenses.mjs`, `dice/check/modifiers.mjs` and
`data/character/offense.mjs` stand only while `conditionHasRow(id)` is false (no row of the
workbook describes the Condition; a row whose cell is `N/A` IS the word), so a world whose
Conditions file could not be read keeps the numbers it had and nothing counts twice. **A stored
reference parsed before a row made a Condition of its name means the Condition** (`conditionOfRef`
in `effect-list.mjs`: `listHas`, `applyEffectTo`, `removeEffectFrom`, the `apply` kind's lines,
`bare()` in `requires.mjs`). The build's half is `assets/lib/conditions_build.mjs`.

**0.32.0 (2026-11-17).** The twenty-fourth kind, `apply` (rulings 311 to 321), and the seventh
hook point, `applies`: named Effects, step two, the writing half. Two tags name the one kind,
`APPLY` and `REMOVE` (`effects.mjs`, `EFFECT_TAGS`), on a Maneuver's own row. The pure half is
`applied.mjs` (a LINE as a roll carries it, `{ op, effect, who, until, degree, cost }`; the RECORD
an applied Effect carries, `flags.starwrought.applied`; `linesFor`, `appliedWindow`,
`settleApplied`, `effectCensus`). **`applies` is calculated**: `ruleApplies(actor, { item, rank })`
in `engine.mjs` hands each kind its rules ON THE ITEM behind the use (as `ruleGives` does: a
Basic Maneuver is in nobody's index), honours Off and Skip on an owned copy (a Skip comes back
under `skipped` with its mark, for the caller to file when the line would have stood), and
answers every line whatever its degree and cost, so the caller chooses with `linesFor` and a
reroll reads the card with no Item to ask. **The kind has no `use` hook and no `card` hook, on
purpose**: `usableByRule` would send the row down `#useWithRules`, which never rolls its check,
and `paidElsewhere` would call the row paid from its card. The callers: `SwItem#applyOnUse` (a
row with no check; `force`, ruling 315), `SwCheck.roll` (the card's `flags.starwrought.applies`)
and `documents/cards/apply.mjs`, which is the TRIGGERED half: the roller's own lines land on the
roller's client as the card is posted, a target's by the card's button on the creature's one
writer (`writerFor`, as a give), over `effect:apply` / `effect:done` / `effect:refused`; the event
is the check card's id and the side, and a record card (`kind: "applied"`, `from`, `who`) is what
makes it once. The writes are `applyEffectTo` and `removeEffectFrom` in `effects-state.mjs`;
`setCondition` took an `applied` option, decided inside its write queue, so a Condition put on
by other means is returned untouched. **Expiry was built before anything could apply**:
`settleAppliedEffects` runs where `settleBindWindows` does and at the encounter's end, and
`settle` in `given.mjs` reads a window's edge through `untilEdge`, with the old meanings as the
defaults, so a pending result's window settles as it did. Two words beside the kind: the
condition `COST(<n>)` (`ops.cost`, read by `apply` alone, refused by name elsewhere; `bonus`
refuses it in a line of its own, since its parse reads its ops with no refusal list) and `mine`
on `EFFECT(<name>, mine)` (a flag on the `has` entry; `listHas(list, ref, { by })`). **"In an
encounter" for a window is a started Combat the user or the recipient is a fighter in**, found
by membership among `game.combats` and never by what a client views (found live: Mike's own
Combat was on screen; and by the review: the writing client is the GM's, which may be viewing
another). **The roller's own side has one writer, the roller's client**: the card offers a
button for it on a blind roll alone, and a relayed request for it is served for a blind roll
alone; a card that names its target is held to it.

**0.31.0 (2026-11-17).** No new kind and no new hook point: the Effects list, and three readers
of it (rulings 305 to 310). Mike: "assuming each Actor has an Effects list of whatever effects
they have, conditions, etc., REQUIRES should just look for a string in that Effects list." Most of
the list existed: a Condition is an ActiveEffect with a status id, and the Bind, Preparing, Spent,
Wounded and Dying are Conditions. `effect-list.mjs` (pure) adds the other half, a NAMED EFFECT:
any other active effect on the creature, by the slug of its name, and a character's custom effect
rows by their label. Nothing new is stored, and a named Effect carries no status id. The readers:
`requires.mjs` (`effect <Name>`, `bind, <state>`, and `with` after a nearness word, which
`helpers/situation.mjs` feeds with each nearby creature's Conditions and names); and the condition
`EFFECT(<name>)` in `effects.mjs`, stored under its own ops key, `has = [{ name, slug, condition,
on }]`, where **the prefix decides whose** (`IF:` the roller, `on: "self"`; `IFT:` the roll's other
party, `on: "other"`), the first condition of which that is true. `operators.mjs` has
`effectConditions`, `readsOtherEffects` and `effectHolds`; `needsMoment` is true for an
other-party rule, so the sheet's Defense pass leaves it out and folds a self rule in. Only `bonus`
reads it: its `parse` returns a FIXED LIST of fields, so a new ops key must be copied there or it
is dropped in silence and the bonus applies always (every other kind refuses an unknown key
through `refuseComponents`). `otherOf` in `module/dice/check/modifiers.mjs` falls back to
`cfg.targetActor`, so a check read against one creature's Threshold has that creature as its other
party. **A name for an option of a pure function is never `valueOf`**: destructuring finds
`Object.prototype`'s and the default is never used (found by the self-test).

**0.28.0 (2026-11-15).** The twenty-second kind, `requires` (rulings 281 to 289), and the first
whose reader is a sheet and not a roll. Mike showed the Maneuvers tab listing Stand to a standing
character and Cast to one with no spell. A Maneuver's Requirements are prose, so the part a machine
can check is written on the Maneuver's own row as a feature block, `[REQUIRES prone or supine]`
(`kinds/requires.mjs`, a wrapper; the words, the three answers and the row's status are plain data
in `requires.mjs`). **No hook point and no hook**: nothing asks the kind at a roll and nothing is
refused. The character sheet reads the rule off each row (`maneuverStatus`) with the character's
situation (`module/helpers/situation.mjs`, the one Foundry-aware reader) and lists the row only
while it applies. The Maneuvers the system itself runs carry their conditions as the same words in
code (`ENGINE_REQUIRES` in `module/documents/maneuvers.mjs`). A feature kind is named in
`FEATURE_KEYWORDS` and `FEATURE_KEYWORD_LIST` in `features.mjs` (before `EFFECT`, which the
self-test holds last), never in `EFFECT_TAGS` or `EFFECT_KINDS`.

**0.25.0 (2026-11-15).** The twenty-first kind, `subordinate`, the condition `EFFECT(<name>, used)`
and `alter`'s eighth property, `limit` (rulings 245 to 251). No new hook point: `subordinate` is
the third kind to answer `use` and the second to answer `card`, and each grew a little (the
sections under "Hook points" below). Mike asked what to type in Reciprocal Effort's cell; nothing
could be typed until Pay It Forward itself was automated. So a Maneuver's row may now say that
using it performs another Maneuver as part of it, at the row's own cost (`[EFFECT SUBORDINATE: Aid;
IF: EFFECT(Aid, used); LIMIT: encounter]`, `kinds/subordinate.mjs`; Mike's Subordinate Maneuver
rule), and a Talent may replace the row's limit (`[EFFECT ALTER: Pay It Forward.limit; VALUE:
round]`). The trigger is the first NAMED EFFECT, in two steps by Mike's choice: step one is an
Effect the system leaves when a roll uses up a bonus another creature gave (`given.mjs`, the used
Effect; written by `markUpdates` in `effects-state.mjs` with the moment `scene.mjs` hands it), and
step two (a Maneuver granting one to a target, bonus lines reading it) is not built. Performing
the subordinate is `SwItem`'s (`documents/item.mjs`, `#performSubordinate`): the parent posts no
card, and its cost and marks ride on the subordinate's use as `partOf`.

**0.24.0 (2026-11-14).** The twentieth kind, `permit`, and `alter`'s seventh property, `movement`
(rulings 239 to 244). No new hook point: `permit` is the second kind to answer `use`, whose
context and answer grew (the section under "Hook points" below). Mike asked whether Coordinated
Footwork wanted a new Effect or new grammar; neither, until Move Together itself was automated. So
a Maneuver's row may now say that using it lets the creature targeted make one Move outside its
Opportunity (`[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]`, `kinds/permit.mjs`), and a
Talent may change how that Move is read (`[EFFECT ALTER: Move Together.movement; VALUE: step]`).
The use leaves one record on the owner; what a live record does to a drag is plain data in
`maneuver-move.mjs`, read by `module/documents/movement.mjs` (the charge) and
`module/canvas/ruler.mjs` (the label) through one helper, so the two cannot disagree.

**0.22.0 (2026-11-14).** The eighteenth and nineteenth kinds, `give` and `alter`, and the sixth
hook point, `gives` (rulings 223 to 230). Mike asked whether the grammar could say two Human
Talents that change Aid (Patient Assistance, Sure Assistance); it could not, because Aid's own
result was prose on the card. So a Maneuver's row now says what each degree of its check GIVES
another character (`[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]`, `kinds/give.mjs`), a
Talent changes one property of that (`[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]`,
`kinds/alter.mjs`), and `ruleGives` in `engine.mjs` turns both into the results by degree, which
the check writes into its card's flags. The table, the pending result and its window are plain
data in `given.mjs`. Giving is a triggered moment with its three answers
(`module/documents/cards/give.mjs`); the pending result is a one-roll carrier the `give` kind
answers `modifiers` for; its window is settled on the turn change
(`effects-state.mjs`, `settleGivenResults`). The hook point's section is under "Hook points" below.

**0.21.0 (2026-11-10).** The seventeenth kind, `substitute`, and the fifth hook point,
`substitutions` (rulings 215 to 222). `[EFFECT USE: Presence, Origin, aid]`, the line of Cooperative
Instinct on the Human sheet Mike is still writing, offers to make a check with another Attribute and
another Constellation's Proficiency Bonus when the roll is made from the named Maneuver's own Item.
The kind is `kinds/substitute.mjs` and the dispatcher `ruleSubstitutions` in `engine.mjs`; the check
engine prices the swaps and chooses (`assemble` in `module/dice/check/modifiers.mjs`, its pure half
in `module/dice/check/substitute.mjs`). The hook point's section is under "Hook points" below.

**0.16.0 and 0.17.0 (2026-11-05).** The grammar has two layers in the shape of Fantasy Grounds' PF2
automation, at Mike's direction, and since 0.17.0 every line of a cell is blocks in square brackets
(Mike: "shouldn't ALL of those be enclosed in Brackets?"): feature blocks (what owning the Talent
does to the character: `[TRAIT Human][SPEED 6]`, `[Acrobatics trained]`, `[MANEUVER Steady the
Line]`) and effect blocks, FG's own wrapper, `[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >=
trained)]`. `grammar.mjs` splits the blocks (`features.mjs`) and hands an `EFFECT` block's inside
to the effect reader (`effects.mjs`), whose tag names the kind; an `AURA` block may carry its
effect after a semicolon (0.18.0), the ring parsed first and the rest read as an effect whose FOR
is the ring; a bare effect line in a cell is refused since 0.18.0 (it is the custom effects field's
own form, `itemType: "effect"`), and the 0.13.0 operator form is refused with `LEGACY_REFUSAL`. The kinds keep
their ids and stored shapes, so every hook reads what it always read. `parseAutomation` returns
`{ rules, errors, warnings }`; a kind warns through `context.warn(message)`. `AUTOMATION_GRAMMAR.md`
is the reference, and the build turns it into the Automation Grammar journal of the Rules pack.

Mike, 2026-10-03: "I'd like an Automation field in the data .xlsx files. And based on what is in
there, when I run sync_content.cmd (or when you run it as part of a build), it will create the
Foundry VTT automation code. However, I want to make sure the Foundry VTT automation code is
well-built. For example, if I create an automation syntax for the Torchbearer 15' aura, we should
create the syntax that will work for OTHER auras, too, without additional coding." And then:
"Important - do NOT survey the talents yet or build ANY of the automation hooks. just build the
framework. we will build automation syntax hooks one at a time."

This folder is that framework and its kinds. 0.9.0 shipped it with **no rule kinds and no engine
hooks**, by that instruction (rulings 118 to 120). 0.10.0 adds the first kind, **`bonus`**, from
Mike's own next sentence ("first automation kind we will create is the Human Ancestry one"), and
with it the first and only hook point, **`modifiers`**, which the check engine and the Defense pass
call (rulings 121 to 124). Every other Automation cell in the book is still empty; the kinds come
one at a time, with Mike, and the aura for Torchbearer is next. `automation-plan.md` in the project
root is the design record; the rulings are in the 0.9.0 and 0.10.0 changelog entries.

## The files

| File | What it is |
|---|---|
| `grammar.mjs` | The line structure of a cell and nothing else: `parseAutomation`, `summarize`, `ruleEntries`, and the plain-data check on what a kind returns. Re-exports the registry's words and `syntax.mjs`. |
| `syntax.mjs` | What a kind file imports: `RuleSyntaxError`, `splitArgs`, `keyValues`, and since 0.34.0 `splitAlternatives` (the one reading of `a or b`, for `requires` and `check`). Imports nothing, so a kind never imports the grammar and no circle exists (0.10.1; the class alone as `errors.mjs` in 0.10.0). |
| `features.mjs` | The bracketed line (0.16.0; AUTOMATION_GRAMMAR.md section 2): `isFeatureLine`, `readFeatureLine(text)` splitting `[KEYWORD data]` blocks and naming each block's kind (`FEATURE_KEYWORDS`; `[<Constellation> trained]` to `grant`; `[EFFECT ...]` (0.17.0) back with `effect: true` for the grammar to hand to the effect reader). Pure. |
| `effects.mjs` | The effect line (0.16.0; section 3): `effectTagOf`, `readEffectLine(text, { context })` reading `TAG: value type, descriptors` and the components `IF:`, `IFT:`, `FOR:`, `LIMIT:` with their conditions (`RANK`, `SEEN`, `ALLIES`, `CLAIM`, `RESULT`, `TRAIT`, `MARKED`, the Threat words, `CHECK`) into the same `ops` record the 0.13.0 reader filled (`EFFECT_TAGS`, `MODIFIER_TAGS`, `COMPONENTS`, `CONDITIONS`). `EFFECT_TAGS` ends with `use: "substitute"` since 0.21.0: a tag that is not a modifier tag hands its kind descriptors alone. Pure. |
| `operators.mjs` | The shared vocabularies and readings (the 0.13.0 reader `readLine` is gone with the form, 0.17.0): `emptyOps`, `splitOperands`, `readRank`, `readRange`, `readWho`, `readDegree`, `readIf`, `readFor`, `readWhile`, `readAgainst`, `splitComparison`; `readTargetName(written, resolve)` (0.21.0), the one reading of a target's name that `bonus`, `reroll` and `substitute` share (through 0.20.1 `bonus` and `reroll` each kept a copy): with the caller's resolver the canonical name, the slug and the type, the resolver's own record under `found` (its `group` and `parent` a kind's to read, never to store), or null when the resolver knows nothing by the name; without one the name as written, the slug made here (a Maneuver's glyphs never reach it) and a null type; the refusals stay each kind's own; `refuseComponents` and `refuseOutcome` for a kind's refusals; and for the hooks `rankMeets`, `whoMatches`, `compare`, `hasTrait`, `traitKey`, `againstHolds`, `markedHolds`, `needsMoment`, `summarizeOperators`. `OPERATORS` stays for the document gate on section 9. Pure. |
| `scene.mjs` | The one Foundry-aware file here (0.13.0): `sceneContextFor(actor, token?)` (the tokens on the scene with `relation`, `gap` and, since 0.14.0, `sees`, line of sight by `canSeeToken`), `encounterContext()`, `threatContext(maneuver)` (the Threat, its reach and the attack's `traits`), `writeRuleMarks(actor, marks)` (written here when this client may, else relayed as `rules:marks` over the system socket to the GM's client or an active owner's; `onRulesSocket` serves it, 0.18.1). The callers put what it builds on the roll context; the engine and the kinds read it and never import this file. |
| `kinds/index.mjs` | The registry: `KINDS`, `registerKind`, `kindOf`, `knownKinds`, `KIND_WORD`. Registers the twenty-seven kinds. |
| `kinds/bonus.mjs` | The `bonus` kind: a typed bonus or penalty to a Constellation's or a Maneuver's roll, or to a scope of rolls (Defenses, Checks, Attacks, Initiative, Speed), made by the tags `CHECK`, `ATK`, `DEF`, `INIT`, `SPEED` in an `[EFFECT ...]` block. |
| `kinds/grant.mjs` | The `grant` kind (0.13.0): Talent Points at creation, `[POINT ...]` and `[<Constellation> trained]` (0.16.0, a directed point carrying `constellation`); `toGrantField` is the wizard's field. No hook. |
| `kinds/aura.mjs` | The `aura` kind (0.13.0): the ring on the map, `[AURA ...]`; `toAuraField` is `system.aura`. No hook. |
| `kinds/features.mjs` | The feature kinds (0.16.0): `trait`, `size`, `speed`, `reach` (0.30.0), `vigor`, `sense`, `language`, `maneuver`, `talent`, `choice`, each read from its block; no hooks. The build and the pipeline step carry the chassis facts, the wizard the choice and the free Talent, `SwItem.grantManeuvers` the Maneuver, and the character's `_prepareRules` the Talents' additions (`system.features`). |
| `kinds/prevent.mjs` | The `prevent` kind (0.13.0): a Condition or an Expose does not land; since 0.35.0 also `IMMUNE: TRAIT(<Trait>)` on a Condition's row (`effect: "trait"`, with `trait` and `name`): whoever has the Condition is immune to anything with the trait. The `prevent` hook. |
| `kinds/mark.mjs` | The `mark` kind (0.15.0): using the Talent names one creature; the `use` hook. Read back by `MARKED` (`markedHolds` in operators.mjs). |
| `kinds/reroll.mjs` | The `reroll` kind (0.15.0): a button on the matching check card throws the die again; the `card` hook. |
| `kinds/ignore.mjs` | The `ignore` kind (0.15.0): difficult terrain of named kinds costs nothing; no hook point. `ignoresTerrain(actor, kind)` is asked by the Difficult terrain region behavior (data/region-behaviors/difficult-terrain.mjs). |
| `kinds/substitute.mjs` | The `substitute` kind (0.21.0): a check made with another Attribute and another Constellation's Proficiency Bonus, by the tag `USE` (`[EFFECT USE: <Attribute>, <Constellation>, <Maneuver>]`, exactly three descriptors, `same` keeping a term); the `substitutions` hook. |
| `kinds/give.mjs` | The `give` kind (0.22.0): what a degree of a Maneuver's check gives another character, by the tag `GIVE` on the Maneuver's own row (`[EFFECT GIVE: <value> <type>, chosen \| <Constellation>; IF: RESULT(<degree>); UNTIL: <window>]`). Two hooks: `gives` (the Maneuver's lines, as `{ line }`) and `modifiers` (a result pending on its recipient, on the next roll with its Constellation). |
| `kinds/alter.mjs` | The `alter` kind (0.22.0): a Talent's change to one property of what a Maneuver gives, by the tag `ALTER` (`[EFFECT ALTER: <Maneuver>.<property>; VALUE: <value>]`; eight properties read, any other refused as not read yet). The `gives` hook, answering `{ alteration }`; its `movement` (0.24.0) and `limit` (0.25.0, stored flat as `per`) properties are passed over by that hook and read at use, through `ruleUses` and `ruleCardOffers`. |
| `kinds/permit.mjs` | The `permit` kind (0.24.0): using a Maneuver lets the creature targeted make one Move outside its Opportunity, by the tag `PERMIT` on the Maneuver's own row (`[EFFECT PERMIT: move; FOR: <who> [<N>]; LIMIT: round]`). The `use` hook: refusals, warnings, the record on the owner, the LIMIT's mark. |
| `kinds/subordinate.mjs` | The `subordinate` kind (0.25.0): using a Maneuver performs another as part of it, at the row's own cost, by the tag `SUBORDINATE` on the Maneuver's own row (`[EFFECT SUBORDINATE: <Maneuver>; IF: EFFECT(<name>, used); LIMIT: encounter]`). Two hooks: `use` (a refusal, or `perform` with the marks to file) and `card` (a `ruleUse` button on the card of the roll that used the Effect up). |
| `kinds/requires.mjs` | The `requires` kind (0.28.0): what a Maneuver needs before it can be used, by the block `[REQUIRES <condition> or <condition>]` on the Maneuver's own row. No hook: the Maneuvers tab reads the rule. |
| `requires.mjs` | The pure half of it (0.28.0), and of the tab: `readRequires` (the words), `requireWords` and `termWords` (the same in English), `checkCondition` (true, false, or null for "cannot tell"), `availability` (a block fails only when every alternative is known false), `requiresFor(rules, engine)` (the row's own blocks, else the engine's), `maneuverStatus(row, situation)` (the four reasons a row is left out), `freeHands` and `arrangeManeuvers` (Favorites first, no row twice). Imports `syntax.mjs` and the config. |
| `kinds/cost.mjs` | The `cost` kind (0.37.0): what a creature uses costs more actions while it has a Condition, by the tag `COST` on a Condition's row (`[EFFECT COST: 1; IF: TRAIT(Concentrate)]`). No hook, and no import that reaches the registry: its parse, its summary and `COST_RAISE_MAX`. |
| `kinds/cannot.mjs` | The `cannot` kind (0.38.0): a creature that has a Condition cannot answer with a Defense, by the tag `CANNOT` on a Condition's row (`[EFFECT CANNOT: evade]`). No hook, and no import that reaches the registry: its parse and its summary. |
| `clock.mjs` | Rounds counted from a moment (0.39.0), pure and importing nothing: `stampOf` and `momentIn` (the Combat, the fighter whose Opportunity is running, that fighter's Initiative, the round), `standIn(stamp, order)` (who counts for an anchor that is out of the fight: the next after its place, ties by id, the unrolled last), `roundsPassed(stamp, change, order)`, and for a window `isRoundWindow`, `roundWindowOver`, `endsInRound`; for a Condition's own value `fadeOf`, `fadesOf`, `fadesDisagree` (what its row says: `UNTIL: each round -1`), `clockOf(moment, holder)`, `clockRuns(clock, combat, holders)`, `sameClock`, `tickFade`. `given.mjs`, `applied.mjs`, `effects-state.mjs`, `scene.mjs`, `documents/actor/conditions.mjs` and the Conditions build import it. |
| `cannot.mjs` | The reader of it (0.38.0): `unusableDefenses(actor)` (each Defense's Condition, or null), `reasonOf(item, held)`, and `EVADE_BY_HAND`, the old rule as a guard for a Condition with no row. Imports the registry first, then the engine, `condition-set.mjs` and the config. The two Defense passes and the Conditions build import it. |
| `cost.mjs` | The reader and the reach of it (0.37.0): `costRaise(actor, traits)` with `carriesTrait`, `raiseWords` and `raiseReason`; `costRoad(item, { actorType, owned })` (the road a Maneuver's cost takes) and `rowRaise` (the one answer the charge and the sheets share); `raisedCosts`; the build's `costCensus` and `builtInTraitNotes`; `paidElsewhere`. Imports the registry first, then the engine, `immunity.mjs`, the config and `documents/maneuvers.mjs` (which imports nothing). |
| `kinds/check.mjs` | The `check` kind (0.34.0): the check a Maneuver rolls, by the block `[CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>]` on the Maneuver's own row (`relevant` on the left for any Constellation, a number on the right for a fixed Threshold). No hook: `SwItem` reads the plan. |
| `check.mjs` | The pure half of it (0.34.0): `readCheck`, `checkWords` and `checkSummary`, `defenseKeyOf`, `planOf(rules, stored)` (the row's rule, else the three stored fields), `storedCheck(plan)` (what the build writes back into those fields), `userPicks(plan)` and `targetPicks(plan)` (who is asked). Imports `syntax.mjs` and the config. |
| `check-request.mjs` | The pure half of the two card flows (0.34.0): `usableDefenses(named, unavailable)`, `validAnswer(request, answer, { ownsTarget, ownsUser, isGM })`, `standingAnswer(request, answers)` (the first valid one), `requestState` (open, answered, rolled, withdrawn, lapsed), `userDegree(degree)` (a player's roll read from the adversary's side) and `adversaryCheck(typed, shift)` (an adversary's number: blank 10, plus what its Conditions move). Imports the config alone; `documents/cards/check-request.mjs` and the npc model import it. |
| `effect-list.mjs` | The Effects list (0.31.0), pure: `effectList({ statuses, conditionValue, effects, rows })` (a creature's Conditions with their values, and its named Effects by slug), `effectsOn(actor)` (the same, gathered from an Actor: `statuses`, `appliedEffects` else `effects`, the custom effect rows), `readEffectName(written)` (a Condition first, else a named Effect; the name's shape, the reserved words, an Exposed Zone refused), `listHas(list, ref)` (true, false, or null with no list), `namedEffects(list)`, `effectSlug`, `conditionTitle`. Imports `syntax.mjs` and the config; `requires.mjs`, `effects.mjs`, `operators.mjs` and `kinds/bonus.mjs` import it. |
| `condition-set.mjs` | What a creature HAS (0.33.0), pure: `closeConditions({ direct, torso }, registry)` (its Conditions closed over what each includes; `held`, `against` by uuid, `unknown`), `conditionSetOf(actor)`, `holdsCondition(set, id, viewer)`, `heldIds`, `heldIdsFor`. Imports the config alone; `effect-list.mjs`, `engine.mjs`, `cannot.mjs` and `helpers/effects.mjs` import it. |
| `maneuver-move.mjs` | The pure half of it (0.24.0): `moveRecord`, `recordLive(record, encounter)`, `moveRoleFor(tokenId, { records, used, encounter })` (the user's own Move, the permitted one, or neither) and `asManeuverMove(move, held)` (a Move however short, never a Rush, a Step only with the alteration, the user's prepaid), `usedNonces` and `withUsed` (the ally's mark, a short list of the uses it has moved for). Imports nothing. The record is taken off its holder when its Opportunity ends by `endManeuverMoves` in `effects-state.mjs` (every turn change, a lone fighter's step, the Combat's end). |
| `given.mjs` | The pure half of both (0.22.0): `buildTable(lines, alterations)` (the results by degree), `alterationTouches`, `pendingEntry` (what the recipient holds), `pendingRule` and `givenCarrier` (the one-roll carrier the engine indexes it through), `settle(entry, { combat, ended, began })` (what a turn change does to its window), `appliesNow`, and the words (`resultWords`, `windowWords`, `pendingWindowWords`). Since 0.25.0 also the used Effect (`usedEntry(entry, moment, holder)`, what a roll leaves when it uses a result up, or null; `usedLive(record, encounter)`; `usedOf`, `usedEffects`, `isUsedKey`, `usedFlagKey`) and `limitOf(rule, alterations)` (the LIMIT that stands once the owner's `ALTER: <Maneuver>.limit` is read, with the marks a Skip owes). Imports `operators.mjs` alone. |
| `claims.mjs` | The arm pin for `CLAIM` (0.15.0): `claimsOf`, `isArmed`, `armClaim`. The sheet's; the roll reads the flag through the `bonus` hook. |
| `effects-state.mjs` | The writes behind the Effects tab (0.16.0): a line's state, the custom effect rows, the marks `writeRuleMarks` hands it. Since 0.22.0 also the pending results: `writeGiven`, `removeGiven` (the GM's), `settleGivenResults(combat, { ended, began })` on the turn change, the clearing of a deleted Combat's results, and the `per: "effect"` mark that removes a result a roll used. Since 0.25.0 `markUpdates(actor, marks, moment)` also WRITES the used Effect that roll leaves (`flags.starwrought.rules.used.<maneuver>`), removes one the Maneuver it triggered spent (`used:<maneuver>`), `removeUsed` is the GM's bin, and `endManeuverMoves` sweeps a used Effect with the Move records, since both end with an Opportunity. Foundry globals only inside functions. |
| `prevent.mjs` | The Foundry side of the `prevent` hook point: `preventersFor` (a read, writing nothing; its `marks` are the Skips the reading would spend), `spendSkips`, `conditionPrevented`, `exposePreventers`, `sayPrevented`. Since 0.35.0 also `traitImmunity(actor, traits, { other })`, `immunityNote` and `immunityRecord(target, name, traits, { other, key })`, the record a card keeps (`{ targetUuid, target, traits, by, note }`, or null). |
| `immunity.mjs` | Immunity to a trait (0.35.0), pure: `traitGroups(traits)` (a thing's traits as groups of alternatives), `traitKeysOf(traits)`, `coveredGroup(traits, immune)` (the first group wholly covered, or null), `joinNames`, `immunityWords(covered)`. Imports `operators.mjs` alone (`traitKey`); `engine.mjs` and the build's trait census import it. |
| `kinds/<kind>.mjs` | One file per kind, each exporting the definition below. |
| `engine.mjs` | `collectRules(actor)` and `rulesOfKind(actor, kind)`: the index the Actor keeps so a hook never walks the Items. `ruleModifiers(actor, context)`: the `modifiers` hook point's dispatcher, which since 0.13.0 also hands a kind the other tokens' rules whose `FOR` reaches the actor and lifts the `FIRST`/`ONCE` marks for the caller to write. `ruleSubstitutions(actor, context)` (0.21.0): the `substitutions` hook point's dispatcher, over the roller's own rules alone, answering `{ candidates, marks }`. `ruleGives(actor, context)` (0.22.0): the `gives` hook point's dispatcher, over the rules on the Item behind the roll and the roller's own, answering `{ table, notes, marks }`. `givenResults(actor)`: the results pending on an actor, which `collectRules` indexes as carriers. |
| `../dice/check/substitute.mjs` | Outside this folder (`module/dice/check/`): the pure half of the `substitutions` hook point's caller (0.21.0). `swapTerms` (the two terms a swap rolls), `substitutionRecord` (what the card's flags keep of it), `chooseVariant` (which variant of the roll stands) and `mergeMarks` (the roll's marks, each once). It imports nothing, so the self-test checks it from Node; `modifiers.mjs` beside it, which reads the actor and localizes labels, cannot be imported there. |

Every one of them stays free of Foundry globals at module scope, because `assets/build_foundry.mjs`
and `assets/test_rules.mjs` import them from plain Node. The build and the client parse a cell with
the same function (ruling 120); the converter, `assets/xlsx_to_trees.py`, copies the cell's text
through as `automation` and knows no grammar, so Python and JavaScript never hold two parsers.

## The grammar

**The reference for the person typing in the cell is `AUTOMATION_GRAMMAR.md` in the project
root** (0.13.0), kept current with every change to a kind, an operator or a vocabulary in the
same commit; `build_all.mjs` fails when a registered kind has no section there or an operator in
`operators.mjs` is not in its table. This file is the engineering side: how the modules fit.

A line is blocks in square brackets (0.17.0). A feature block is `[KEYWORD data]`, its keyword
naming the kind that reads the data; an effect block is `[EFFECT <tag>: <value> <type>,
<descriptor>; <component>; ...]`, its tag naming the kind.

```
# a line beginning with # is a comment; a blank line is nothing
# a line that says only N/A (or None, or a dash) is the author's "no automation": skipped (0.26.1)
[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]
[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]
[EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]
```

**"No automation" is not a kind** (0.26.1; `isNotApplicable` and `isNotApplicableCell` in
`syntax.mjs`). Mike marks a row that needs none with `N/A` in its cell; the grammar skips such a
line before anything reads it as a kind word, a tag or a block, so it can never be "unknown rule
kind", and the build tools treat a cell that says nothing else as an empty one. A new kind must not
take `na`, `none` or a dash as its word, tag or keyword. `N/A` beside rules is a warning
(`NOT_APPLICABLE_WITH_RULES`) and the rules stand.

A keyword or tag nobody answers to is an error naming the tags and the keywords. A kind's `parse`
receives `context.form` (`"feature"` with `context.block`, or `"effect"` with `context.effect`, the
reader's `{ tag, value, type, descriptors, ops }`) and refuses the other form by name. A bare effect
line in a cell (no `[EFFECT ...]`) reads one more release flagged `bare: true` with a warning in the
parse's `warnings`; with `itemType: "effect"` (a custom effect row) the bare line is the form. The
0.13.0 operator form and the 0.10.0 prose form are refused. At build time any error **fails
the build**, naming the Constellation, the Talent and the line, as a bad Aura cell stops the
converter's write; at runtime, when a GM edits a world Item's textarea, the same error is saved as
an entry the Item sheet shows in red and the engine skips. Nothing is ever thrown for a cell's sake
(ruling 118).

## The data

On a Talent, an action and a Constellation Item:

- `system.automation`: the cell's text, as written.
- `system.rules`: one entry per line that is a rule. A parsed rule is `{ ...data, kind, line, text }`
  (the kind's data, then the reserved words, which win); a line that did not parse is
  `{ error, line, text }`. The build writes only parsed rules; the client (`SwItem#_preUpdate`)
  writes both, through `ruleEntries(parseAutomation(text))`. The line number counts every line of the
  cell from 1, blanks and comments included, so it is the line the designer sees.

On a character and an npc, prepared first thing in `prepareDerivedData` by `collectRules`:

```js
actor.system.rules = {
  all:     [{ rule, item }],                 // every usable rule
  byKind:  { "<kind id>": [{ rule, item }] }, // the same, filed; a kind not in use has no key
  unknown: [{ rule, item, reason }]          // error entries and rules of an unregistered kind
};
actor.rulesOfKind("bonus");                  // always an array; an alias resolves to its id
```

The content loop carries a cell's rules to an open world as it carries any field: `system` is in
the content hash, so a changed cell changes the hash and Sync content updates the compendium Item;
the copies refresh overwrites an owned copy's `automation` and `rules` from the source, since the
cell is the author (ruling 120).

**A rule is plain data.** What a kind's `parse` returns is stored on the Item, hashed, written to
the pack sources, carried by Sync content and saved by the database, all as JSON, so the grammar
checks it before storing it (0.10.1): null, booleans, finite numbers, strings, arrays and plain
objects of the same, and nothing else. NaN, Infinity, a function, a symbol, a Date, a Map, a class
instance or a cycle is reported as the kind's bug with the path to it (`the "aura" kind returned
data that cannot be stored (range is NaN)`), and the stored copy drops undefined properties as JSON
would, so a stored rule always equals its own JSON image.

**When a kind changes what it stores.** There is no version number on a rule; the cell's text is
the version, and a parse is re-derived from it wherever it is stale: the build rewrites every
compendium rule on every run, Sync content's copies refresh rewrites an owned copy's `rules` from
the source (ticked by default), and a world Item re-parses on its next edit of the textarea. The
one residue is an owned copy whose GM unticked the refresh, or a world Item nobody edits again. So
a kind that changes the shape of its data does one of two things in the release that changes it:
its hooks read the old shape as well as the new for that release, or the release's world
migration re-parses `system.automation` on every Item of `RULE_ITEM_TYPES` that carries a rule of
that kind (the migration block in `starwrought.mjs`, which already walks the world's documents
once per version). Which, is decided with the change; neither has been needed.

## The `bonus` kind (0.10.0; rulings 121 to 124; the operator grammar since 0.13.0, ruling 164)

Mike's ask, for Humanity, the Root of the Human Ancestry: "You gain a +1 Condition bonus on checks
to Aid. If you are Expert in Human, this becomes a +2 Condition bonus. If you are Master, +3. If you
are Legendary, +4." His sketch, "IF (Constellation Proficiency = VALUE) ... Grant [X Value]; [Y
type]; [Z Check (Constellation or Maneuver Roll)]", first made concrete as prose (0.10.0), then,
on his second-draft direction ("logical operands like IF(Origin=Trained) and grammatical shortcuts
like Bonus: +1, Condition, Aid"), as the operator grammar:

```
bonus: <±N>, <Type>, <Target> [, operators]

bonus: +1, Condition, Aid, IF(Origin=Trained)                                              Humanity
bonus: +1, Situation, Checks, IF(Rank=Untrained)                                           Jack of Trades
bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)   Close Ranks
bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)                            Torchbearer Human
bonus: -2, Situation, Stealth
```

The arguments and the operators are AUTOMATION_GRAMMAR.md's; the stored rule:

```js
{ kind: "bonus", line, text,
  value: 1, type: "condition",
  to:   { name: "Aid", slug: "aid", type: "action" },    // "constellation" | "action" | "scope" | null
  when: [{ constellation: "origin", name: "Origin", op: "=", rank: "trained" }] | null,   // or { roll: true, op, rank }
  for: { who, range } | null, while: { who, op, count, range } | null,
  against: { threat, reach } | null, limit: { per: "round" | "encounter" } | null }
```

A scope target (`Defenses`, `Attacks`, `Initiative`, and since 0.36.0 `rolls` for a bare `CHECK`
and `checks` for `SKILL`) is `type: "scope"` with the word's
slug; a Constellation's or a Maneuver's `type` comes from `context.resolve` as before, null with no
resolver. A 0.10.0 rule stored on an owned copy (`when` as one object, no `op`) still reads as
equality, so a copy a GM did not refresh keeps working.

The summary: `+1 Condition bonus to Aid, while Origin is Trained`; `penalty` when negative; the
operators after a comma in words (`for allies within 15 ft, the first time each round`).

**The hook** (`hooks.modifiers`), for each rule that reaches the recipient: every `IF` holds for
the OWNER of the Talent (`rankMeets` over SW.RANKS' order; `Rank` reads `context.rank`, the roll's
own rank Handling included, and never fires when the caller gave none; `Trait` reads
`context.threat.traits` through `hasTrait`, the attack's traits by first word, and never fires
when no attack is known); `FOR` reaches the
recipient (no FOR or `self`: the owner's own roll only; `allies`, `enemies`, `all`: another token's
roll, by `scene.relation(ownerToken, recipientToken)` and `scene.gap` against the range;
`self+allies`: either), and `SEEN` then asks `scene.sees(recipientToken, ownerToken)` (0.14.0; a
scene without `sees` reads as unseen, so the operator is never assumed); `WHILE` counts the
scene's tokens around the owner's token within the
range; `AGAINST` needs `context.threat` and matches its Threat word or its reach; `FIRST`/`ONCE`
reads the recipient's `flags.starwrought.rules.<per>[<item>:<line>]` against `context.encounter`
and, when it applies in an encounter, puts `mark: { key, per }` on the modifier for the engine to
lift. `needsMoment(rule)` sorts the rules into the two halves the callers ask for: the sheet's
Defense pass (`staticOnly`) takes the rules that need none of the scene, the Threat or the round,
and a Defense roll or a Threshold read in the attack flow (`momentOnly`) takes the rest, so no
rule is counted twice. One static rule is answered under `momentOnly` as well (0.21.0, ruling
222): a bonus to a MANEUVER, on a check rolled with a Defense Constellation from that Maneuver's
Item, which the Defense pass could never have folded in (Humanity's +1 on an Aid made with
Awareness, lost through 0.20.1). It is matched by the Item alone: the roll's kind is `check`, the
roll carries an Item of type `action`, the rule's `to.type` is `"action"` (or null, a rule parsed
without a resolver) and its `to.slug` is the slug of that Item's plain name; an untyped target
whose slug is also the roll's own Constellation was the pass's and is left out. Nothing is offered
on that branch, and a bonus to Skill checks (`SKILL`) and a bonus to the Defense itself stay out of
it as before; since 0.36.0 a bonus to every roll (a bare `CHECK`) reaches a Defense rolled as a
check through the Defense's own stored modifiers, once. Then the target: a scope applies
by the roll's kind; a Constellation on its slug; a Maneuver when the roll carries its Item, and is
**offered** unticked on a check made without one (ruling 122), never on an attack, a Defense or an
Initiative. The label is the carrier's plain name, with the owner's name in parentheses when it is
another token's Talent
("Torchbearer Human (Tess)"); ALL of one Talent's or one Condition's lines share `source: rule:<carrier>`
(0.36.0; the carrier and its target through 0.35.1).

## The contract of a kind

```js
import { RuleSyntaxError, splitArgs, keyValues } from "../syntax.mjs";   // never from the grammar

export default {
  id: "bonus",                      // lower-case letters and hyphens; the word before the colon
  aliases: [],                      // other words accepted before the colon
  parse(args, context) { ... },     // the text after the colon, trimmed; returns the rule's data
                                    // (a plain object) or throws RuleSyntaxError(message) with a
                                    // message a game designer can act on; context = { itemName,
                                    // constellation, itemType, source, resolve?, line, text, kind }
  summary(rule) { ... },            // one short string for the sheet, from the parsed data
  hooks: {                          // the engine hook points this kind speaks at, by name; the
    modifiers(entries, context, actor) { ... }   // engine calls each where that moment comes
  }
};
```

`registerKind` enforces it: a definition missing `id`, `parse` or `summary`, an id or alias that
is not a kind word or is already taken (as an id or an alias), or a hook that is not a function, is
refused with a plain Error at load. A broken kind should stop the system, not parse every cell that
names it into silence.

What a kind may rely on:

- `parse` gets the arguments trimmed, never the kind word or the colon. It may return nothing for
  a kind with no arguments; the grammar stores `{}`. It may not use the reserved words `kind`,
  `line`, `text` or `error` in its data: the grammar drops them from what `parse` returned and
  writes its own, so a kind cannot have a parsed rule filed as one that did not parse.
- `context.resolve`, when the caller gives one: `resolve(name) -> { type: "constellation" |
  "action", slug, name } | null`, the names a cell may point at. The build builds one over every
  Constellation in `trees.json` and every Maneuver on the action sheets and in the roster's
  `actions` block, enabled or not (a disabled Maneuver still resolves: the cell is right, the row
  is simply off); the client's is `resolveRuleTarget` in `module/helpers/content.mjs`, over the
  Constellation registry, the Actions pack's index and the world's Maneuvers. A Constellation wins
  over a Maneuver of the same name. The grammar passes the caller's context through to `parse` as
  `{ ...context, line, text, kind }`, so `resolve` rides in it with no grammar change. A kind must
  work without one (the self-test gives none) and should then store what it can make itself.
- `throw new RuleSyntaxError("...")` is the designer's error and is printed as written. Any other
  throw is reported as the kind's failure ("a bug in the kind, not in the cell") so the build log
  points at the file. Either way the grammar never crashes.
- An effect kind reads `context.effect` (the effect reader's `{ tag, value, type, descriptors,
  ops }`, every component already read and refused where malformed) and calls
  `refuseComponents(ops, TAG, allowed)` for the components it has no use for; a feature kind reads
  `context.block.data` as it likes. `splitArgs(text)` and `keyValues(parts)` in `syntax.mjs`
  remain for a kind with a different shape; `splitOperands` is the parenthesis-aware split.
- `summary(rule)` gets the stored entry. A summary that throws falls back to the rule's text.
- **A kind file imports from `../syntax.mjs` and `../../config/*` and never from `../grammar.mjs`
  or `./index.mjs`.** The grammar imports the registry and the registry imports every kind, so a
  kind that imported either would close a circle, and a circle breaks whenever the kind file
  happens to be the first module evaluated (0.10.0 met this: `registerKind(bonus)` ran before
  `bonus` existed). `syntax.mjs` imports nothing, so there is no circle and nothing to be careful
  about at module scope. A kind file is still never an entry point: the system, the build and the
  self-test enter through the grammar, the registry or the engine.
- What `parse` returns must be plain data (the "A rule is plain data" paragraph above); the
  grammar refuses anything else as the kind's bug and names the path.
- `slugify`, `plainName`, `RANKS`, `LEGACY_BONUS_TYPES`, `isLoreSlug` and the rest of
  `module/config.mjs` are pure and may be imported from a kind; the build imports that module from
  Node already.

## Hook points

A hook point is a moment in the engine where every registered kind is asked one question about
its own rules on an Actor. The engine's call sites exist once per hook point; a kind takes part by
naming the point in its `hooks`, and a new kind that wants an existing moment adds no engine code
(ruling 124). A new moment is still defined with the first kind that needs it (ruling 119). There
are seven: `modifiers` (0.10.0, calculated), `prevent` (0.13.0, triggered), `use` and `card` (0.15.0,
both triggered), `substitutions` (0.21.0, calculated), `gives` (0.22.0, calculated; the give it
feeds is a triggered moment of its own, with its three answers in that section) and `applies`
(0.32.0, calculated; the application it feeds is triggered too, in its section).

### Calculated and triggered

Two categories of hook point, told apart by whether a hook may change anything (the
automation-framework review, 2026-11-04). Every hook point declares which it is in its section
below, and a kind's hook keeps to it.

- **Calculated.** The engine asks a question and the hook answers with data: modifiers, an
  adjustment, a list of what applies. The hook writes no document, posts no card, and may be
  called on any client and any number of times with the same answer. `modifiers` is one,
  `substitutions` (0.21.0) another, `gives` (0.22.0) the third and `applies` (0.32.0) the fourth. A failure is isolated to the kind that failed: the
  dispatcher reports it once and takes nothing from that kind, and the roll or the sheet goes on
  with the rest. Stacking and ordering are the caller's, through the rule the caller already has
  (`SW.resolveModifiers` for a roll: since PHB v4.21 every bonus adds and a circumstance is counted
  once, by the modifier's `source`), never the dispatcher's.
- **Triggered.** Something happened (a Critical Hit landed, a Wound was taken, a round ended) and
  a rule asks for an operation in answer: a condition set, Vigor restored, a card posted. Every
  client sees the event, so a triggered hook point must say, when it is defined, **which one
  client executes** (the pattern the system already has: the attack coordinator and the loot
  relay run on the active GM's client, the asker read from the server's stamp), **what names the
  event** so an operation already done is recognised and not done twice (the Combat round and
  turn, the message id, the attack id), and **what a failure does** to the operation it was part
  of (abort it whole, or record the rule and go on), since a half-applied state change is worse
  than none. `prevent`, `use` and `card` are triggered, and so is the give that the `gives` point
  feeds (0.22.0), which states the three answers in its section; a kind that needs a new triggered
  moment defines it with these three answers in its section here, and not before.

A kind may speak at both: an aura is calculated while it adjusts a Defense and triggered if it
ever restores Vigor. The two are two hook points, not one with a flag.

### `prevent` (0.13.0)

Triggered. `hooks.prevent(entries, context, actor) -> Preventer[]`, dispatched by
`rulePreventers(actor, context)` in `engine.mjs`, `context` `{ effect, threat?, scene?, encounter? }`
(`effect` a condition id or `"expose"`), each answer `{ item, owner, ownerToken, reaction, mark }`.
The hook answers with data and writes nothing; the three answers a triggered point owes:

- **Which client executes.** The client that would have written the effect. For a Condition that
  is `SwActor#setCondition` on whichever client called it (the owner's for a Drop Flat's Prone at
  the reveal, the GM's for a final Legs Wound applied from a damage card) and, for a status toggled
  from the token palette or the Effects tab, the `preCreateActiveEffect` hook on the creating
  client (`starwrought.mjs`), which answers synchronously from the index and returns `false`.
  For an Expose it is the owner of the Reaction Talent, pressing the widget's button
  (`preventExposeFromCard`), or the GM for them.
- **What names the event.** The write itself: a Condition is prevented once because the write that
  would have made it happens once (a create that `setCondition` already checked carries
  `swChecked`, so the hook does not ask twice); an Expose is the card's, flagged `prevented` on the
  message so the widget draws no second button.
- **What a failure does.** `conditionPrevented` is inside a try/catch in `setCondition`: a rule that
  cannot be read lets the Condition land (the system prevents nothing it cannot read); a card or a
  mark that fails to write is logged and the prevention stands.

`module/rules/prevent.mjs` is the Foundry side: `preventersFor(actor, effect)` (automatic ones and
Reactions apart), `conditionPrevented(actor, id)` (the card and the mark), `exposePreventers(actor,
token)` for the Expose widget, `sayPrevented`. Only an automatic preventer (a Talent without ↺)
acts on a Condition write; a ↺ one would be a Reaction the owner chooses, which no Condition write
offers yet because no Talent asks for it.

**Since 0.35.0 the point is also asked about a trait** (`context.effect === "trait"`, the trait
keys of the thing in `context.threat.traits`, the acting creature in `context.other`), through
`ruleTraitImmunity`. That question is a calculation: no scene, no encounter, no marks, nothing
written, and the same answer on every client. The answer carries `trait` and `name` beside the
usual fields. What executes is each caller's own: a card keeps the answer in its flags, and the
write that would land something (`applyOnce`, `giveOnce`) asks again on the one client that
writes.

### `use` (0.15.0)

Triggered. `hooks.use(entries, context, actor) -> RuleUse[]`, dispatched by `ruleUses(actor, item,
context)` in `engine.mjs` with the rules ON THE USED ITEM alone, `context` `{ item, target: {
actor, uuid, tokenUuid, tokenId, token, name, relation, inEncounter } | null, encounter: { combat,
round, combatant }, scene, alterations, nonce }`, each answer `{ item, write?, say?, refuse?,
warn?, marks?, perform? }`. Defined with the `mark` kind (ruling 176); the second kind to answer
it is `permit` (0.24.0), for which the context and the answer grew, and the third is `subordinate`
(0.25.0), which added `perform`:

- `perform` is `{ slug, name }`, the Maneuver this use performs as part of itself (Mike's
  Subordinate Maneuver rule). An answer that carries it changes what the executing client does:
  the used Item posts no card and pays nothing; `#performSubordinate` finds the Maneuver and uses
  it with `partOf: { label, cost, marks, gated, note }`, so the subordinate's own roll is paid at
  the parent's listed cost, named for the parent, and files the marks of EVERY answer of the use
  where it stands (its roll's `beforeRoll`, or at once with no roll). A `write` on another answer
  of the same use is still applied at once. One `perform` to a use; a built-in, a row paid
  elsewhere, a Prepared parent and a nested `perform` are refused with a notice and nothing spent.

The earlier growth, for `permit`:

- `scene` is `sceneContextFor(actor)` (the owner's token and `gap`), and the target carries its
  TokenDocument, so a kind measures a distance without touching the canvas and stays pure.
- `encounter.combatant` is the combatant whose Opportunity is running, and `nonce` names this use.
- `alterations` is the owner's `alter` rules that name the used Maneuver (`alterationsOf`: Off
  dropped, a rank condition checked against the owner), so a kind reads an `ALTER` of its Maneuver
  without reading another kind's rules or importing the engine. A line on Skip comes `skipped`,
  for the kind to leave out this once, and a one-roll custom effect comes to be used up; each
  carries the `marks` that say so, which the kind hands back with a use that counted. (The used
  Item's OWN lines still read a Skip as On: a use is deliberate.)
- `warn` is lines the Item's card prints as warnings (the use still happens); `marks` is what to
  file, `[{ key, per }]`, written with `writeRuleMarks`: a LIMIT as FIRST and ONCE are, a Skip
  spent (`per: "state"`), a one-roll effect removed (`per: "effect"`).

All of an answer's writes still land on the OWNER. `permit` needs another fighter to be able to
act, and does it by a record on the owner that the other client reads (`maneuver-move.mjs`): no
write to another actor, so no relay and no second executing client.

The three answers a triggered point owes:

- **Which client executes.** The owner's, in `SwItem#use` (documents/item.mjs, `#useWithRules`): it
  asks the kinds first, stops on a refusal with a notice and pays nothing, passes the Opportunity
  gate (after the refusals since 0.24.0, so a refused use spends no permit; and since 0.25.0 the
  request card for an off-turn use goes out from there too, never before the refusals), else pays the cost in
  the Item's name in an encounter (honouring `trackActions` since 0.24.0), applies the writes and
  the marks to the owner and posts the Item's card with the spend, the kinds' lines and their
  warnings under it. A Talent is used from its row's Use control, which the sheet shows for a
  Talent with a cost or with a rule of a use-kind (`usableByRule`).
- **What names the event.** The use itself: one press, one card, one write; a second press is a
  second use (a mark remade is the same creature named again).
- **What a failure does.** A refusal stops the whole use before anything is paid; a hook that
  throws is logged by the dispatcher and contributes nothing, so the Talent is still paid and
  posted; a write that fails is logged and the card still goes out.

### `card` (0.15.0)

Triggered. `hooks.card(entries, context, actor) -> RuleCardOffer[]`, dispatched by
`ruleCardOffers(actor, flags, extra)` in `engine.mjs`, `context` the posted card's
`flags.starwrought` (`kind`, `slug`, `degree`, `itemUuid`, `threshold`, `modifiers`, ...) plus
`encounter`, each answer `{ item, label, action, icon? }`. Defined with the `reroll` kind (ruling
177); the second kind to answer it is `subordinate` (0.25.0), for which it grew: the render pass
asks for Attack and Defense cards as well as check cards (`reroll` still answers a check alone);
an entry on a Maneuver carries the owner's `alterations` of it, as a `use` hook is handed them; an
offer may name its `icon`; and the action `ruleUse` uses the offering Item (`useByRule` in
documents/chat.mjs), which is the row's own path through the `use` hook, so the button decides
nothing and a stale one can do nothing the row would refuse. A card knows its roll used a result
up by a modifier's `given: <maneuver>` and which result by `givenFrom: <the give's card id>`,
which the `give` kind sets and the card's flags keep; the used Effect remembers the same id as
`from`, and the offer is drawn only where the two agree. Because offers are computed at render,
`registerRuleOfferCards` (documents/chat.mjs) draws a roller's recent cards that carry a given
result again whenever its used Effects change.

- **Which client executes.** The hook only names buttons; the chat render pass
  (documents/chat.mjs) draws them on every client for the roller's owner and the GM, from the flags,
  so a reload draws the same. The presser's client acts (`rerollByRule` in
  documents/cards/reroll.mjs): it pays the cost in an encounter, throws the die, posts the new card
  and marks the first superseded when it may.
- **What names the event.** The message id: a superseded card draws no button, and the new card
  names the one it replaced.
- **What a failure does.** A hook that throws is logged and offers nothing; a press that cannot
  reroll (the Talent gone, no die on the card) is a notice and the first card stands; a press by a
  client that cannot mark the first card superseded still posts the new one and says so.

### `modifiers` (0.10.0)

Calculated. `hooks.modifiers(entries, context, actor) -> Modifier[]`, dispatched by
`ruleModifiers(actor, context)` in `engine.mjs`, which returns `{ applied, offered, marks }`. Since
0.15.0 the context also carries `other` (the roll's other party: the attacker a Defense answers or
a Threshold is read against, the defender a Strike's pairing resolves against, the roller whose
check reads a Threshold; `MARKED`), `pairingOnly` (a Strike's pairing: only the rules about the
other party) and `read` (a Threshold read with no dialog: a claim applies only when armed), and an
offer may come back `ticked` with a `mark` the dialog files when the box stays ticked. Since
0.21.0 the `rank` it carries is the rank ROLLED: the borrowed Constellation's when a substitution
stands (ruling 217; the `substitutions` point below), so a `RANK(roll ...)` on any other kind's
line reads the swap.

- **When the engine calls it.** Twice in the system, once per roll each: in `baseModifiers`
  (`module/dice/check/modifiers.mjs`, the check engine's)
  (`module/dice/check.mjs`), the non-Defense branch, after the sheet's own terms and before the
  caller's; and in `prepareDefenses` (`module/data/character/defenses.mjs`, the character's
  Defense pass, called from `SwCharacterData#prepareDerivedData`), per Defense,
  before `SW.resolveModifiers`, so a bonus to Guard moves the Threshold on the sheet, the Skills
  grid and the Guard roll alike. The Defense branch of `baseModifiers` rolls the Defense's own
  folded modifiers and does not ask again, so a Defense roll, an Initiative rolled with Awareness
  and a Defense rolled as a check all carry a bonus once and never twice. The npc early return
  stands: adversaries roll flat, and rules do not reach them in 0.10.0.
- **What it is handed.** `entries`: this kind's rules on this actor, `[{ rule, item, owner,
  ownerToken }]`, from `rulesOfKind` (never the whole index), and since 0.13.0, when the caller
  gave a `scene`, the rules of every other eligible token on it whose `rule.for.who` is not `self`
  (the operator's shape is the engine's to know; the relation and the range are the kind's to
  check), each with its `owner` and `ownerToken`. `context`: `{ kind: "check" | "attack" |
  "defense" | "initiative", slug, item, rank, threat, scene, encounter, staticOnly, momentOnly }`
  (the typedef in engine.mjs): the roll's kind, the Constellation slug supplying the Proficiency
  Bonus (`""` when none), the Item behind the roll or null, the rank the roll is made at (the
  borrowed Constellation's when a swap stands, 0.21.0, ruling 217), the Threat it
  answers or null (`{ threat, melee, traits }`, the traits the attack's for `IF(Trait=...)`), the
  scene (`{ token, tokens: [{ actor, token }], relation(a, b), gap(a, b), sees(a, b) }`
  from `scene.mjs`, a fake in a test, null when unknown), the Combat and round, and which half of
  the rules is wanted. `actor`: the recipient, whose `system.proficiency(slug).rank` and
  `flags.starwrought.rules` a kind may read.
- **What it may return.** An array of `{ label, value, type?, source?, offer?, key?, hint?,
  mark? }`. A modifier without `offer` is **applied** to the roll as the sheet's own terms are.
  One with `offer: true` is **offered** unticked in the roll dialog (the Load Strain Climb-or-Swim
  precedent, PHB v4.11, ruling R2), `key` the checkbox's name, unique per offer, `hint` its
  tooltip; `previewTotal` ignores offers, and the Defense pass does too. `mark: { key, per }` on
  an applied modifier is a FIRST or ONCE the recipient should remember: the dispatcher lifts it
  into the third list it returns, `marks`, and the caller writes them once the roll resolves
  (`writeRuleMarks` in scene.mjs: `SwCheck.roll` for the roller's own, the attack coordinator for
  a Threshold read), never from a preview. An offer carries its marks as `marks` (and the first as
  `mark`), since a ticked claim on a one-roll custom effect spends the claim and the row alike
  (0.18.1); the dialog files them with the roll. Since 0.21.0 `prompt` returns the marks of the
  boxes left ticked and `SwCheck.roll` adds them to the roll's own after any rebuild; through
  0.20.1 they were written onto the config, and a rebuild, which assembles the roll again and sets
  its marks afresh, dropped them (an armed claim was not spent, a one-roll custom effect not
  removed).
- **Who calls it with what** (0.13.0). `baseModifiers`' non-Defense branch asks for everything
  with the scene, the Threat (`cfg.threat`, set by `rollDefense` from the attack flow's Maneuver)
  and the encounter; its Defense branch and `SwActor#defenseThresholdFor` (the Combat Prompt's
  preview, the coordinator's reveal and resolution) ask `momentOnly`, since `prepareDefenses`
  folded the static rules into the Defense's own modifiers with `staticOnly`. The sheet's
  Threshold is therefore the position-blind number, and its tooltip says so. One static rule is
  still answered under `momentOnly` (0.21.0, ruling 222; the `bonus` section above): a bonus to a
  Maneuver, on a check rolled with a Defense Constellation from that Maneuver's Item.
- **What the dispatcher does.** Walks `KINDS`; skips a kind without the hook and a kind with no
  entries on this actor; calls the hook inside try/catch, a throw reported once as
  `STARWROUGHT | the "<id>" kind's modifiers hook failed:` and contributing nothing, so a roll never
  dies over a rule; drops a modifier whose `value` is not a non-zero number (a numeric string is
  read as a number); gives a keyless offer a key of its own (`<kind>-<n>`) and suffixes a key two
  offers share. Stacking is not its job: the caller's `SW.resolveModifiers` treats what comes back
  as it treats every other term (PHB v4.21: everything adds; entries sharing a `source` are one
  circumstance, counted once, which is how the `bonus` kind keeps one Talent's lines from adding:
  `source: "rule:<carrier>"` since 0.36.0, the carrier and its target through 0.35.1).

### `substitutions` (0.21.0)

Calculated. `hooks.substitutions(entries, context, actor) -> [{ key, item, label, attribute,
proficiency, certain, mark? }]`, dispatched by `ruleSubstitutions(actor, context)` in `engine.mjs`,
which returns `{ candidates, marks }`. Defined with the `substitute` kind (ruling 221), the fifth
hook point and the second calculated one: "this check is about to be assembled; which of the
owner's rules would swap its base terms?" A substitution replaces the roll's two base terms, the
Attribute Bonus and the Proficiency Bonus (one of them when the line says `same`), and nothing else
(ruling 216): the roll stays a check in its own Constellation, so the Flare preselection, Load
Strain on Stealth, Constellation-targeted bonuses, rerolls and the road-roll memory are untouched.

- **When the engine calls it.** Once per assembly of a character's check, before the base terms
  are built: `assemble` in `module/dice/check/modifiers.mjs`. Checks only, characters only (ruling
  220): never a Strike, a Cast, a Defense roll, a Threshold read or an Initiative, and an adversary
  rolls flat; a check rolled with a Defense Constellation (an Aid made with Awareness) is asked
  only when a Maneuver's Item is behind it. When a candidate comes back, `assemble` builds the roll
  once with no swap and once with each candidate, every one in full, because another rule may read
  the rank the roll is made at (Jack of All Trades' +1 on an Untrained roll is lost under a Trained
  Origin), leaves the variants on `cfg.substituteVariants` for the roll dialog, and chooses with
  `chooseVariant` (`module/dice/check/substitute.mjs`): `cfg.substitute` undefined is the default
  rule, the swap whose assembled total is strictly the highest, else none (ruling 218; a tie or a
  loss leaves the check as it was, and a roll with no dialog takes the default); `null` is no swap
  (the player unticked the box); a key is that swap. One swap stands on a roll. What stands is
  written back as the roll's own: `cfg.rank` the rank rolled, `cfg.substituted` the record the card
  keeps, `cfg.attribute` the check's own Attribute throughout. Each assembly asks `ruleModifiers`
  again at that variant's rank, which a calculated point allows. A roll no rule offers a swap on
  is assembled as it was before 0.21.0.
- **What it is handed.** `entries`: this kind's rules on the roller, `[{ rule, item, owner }]`,
  from `rulesOfKind` (an Off line never arrives). OWN RULES ONLY: no other token's rules are added,
  whatever the scene, since a swap is the owner's own roll and the kind refuses `FOR`. `context`:
  `{ kind, slug, item, rank, encounter }`: the roll's kind, the check's own Constellation slug, the
  Item behind the roll or null, the Combat and round for a `LIMIT`, and `rank`, the check's OWN
  rank, before any swap, which a `RANK(roll ...)` on a `USE` line reads. Every other rule's
  `RANK(roll ...)` reads the rank rolled, through `ruleModifiers`' context (ruling 217). `actor`:
  the roller.
- **What it may return.** An array of candidates that mirror the rule: `key`, stable per rule line
  (the dialog's checkbox and the card's record name it; `use-<carrier>-<line>` from `substitute`);
  `item`, the carrier; `label`, its plain name; `attribute`, a key of `SW.ATTRIBUTES`, or null when
  the check keeps its own; `proficiency`, `{ constellation, name }`, or null likewise; `certain`,
  true when the roll is known to be the check the rule names (always, in 0.21.0: a swap is offered
  only from the Maneuver's own Item, ruling 219; an uncertain candidate is never the default); and
  `mark: { key, per }`, the rule's `LIMIT`, when an encounter is running. The hook prices nothing,
  chooses nothing and writes nothing.
- **What the dispatcher does.** Answers empty for no actor; walks `KINDS`; skips a kind without
  the hook and a kind with no rules on this actor; calls the hook inside try/catch, a throw
  reported once as `STARWROUGHT | the "<id>" kind's substitutions hook failed:` and contributing
  nothing; drops a candidate that is not an object, names no `item`, names an Attribute the system
  does not have, or swaps nothing (no Attribute and no `proficiency.constellation`); reads
  `certain` as true unless it is `false`; gives a keyless candidate a key of its own
  (`<kind>-<n>`) and suffixes a key two candidates share, so the dialog's checkboxes never collide;
  drops a mark without both its `key` and its `per`.
- **Where the marks go.** They ride on the candidate, as an offered modifier's do: each candidate
  comes back with `marks`, its own `LIMIT` mark and, on a one-roll custom effect, the row's removal
  (`per: "effect"`), and the check engine files them only for the swap the die is thrown with
  (`mergeMarks` onto the standing variant's `cfg.ruleMarks`, written by `SwCheck.roll` through
  `writeRuleMarks`), never for a candidate left unticked and never from a preview. The top-level
  `marks` is what the roll owes whichever way it goes: a Skip line that would have offered a swap
  is dropped and its state cleared (`per: "state"`); a Skip line that would not have matched is
  not spent.
- **The name.** The hook must NOT be named `use`, though the tag is `USE`: `hooks.use` is the
  triggered point above, which draws a Use control on the Talent's row (`usableByRule`) and runs
  when the Talent is used, and a substitution is never used. The self-test asserts the kind's one
  hook is `substitutions`.

### `gives` (0.22.0)

Calculated. `hooks.gives(entries, context, actor) -> [{ line } | { alteration }]`, dispatched by
`ruleGives(actor, context)` in `engine.mjs`, which returns `{ table, notes, marks }`. Defined with
the `give` kind (ruling 229), the sixth hook point and the third calculated one: "this check was
made from a Maneuver's Item; what would each degree of it give another character?" Aid's +1 to +4
for the ally and its -1 on a Critical Failure are the first answer, and two Talents that change
them (Patient Assistance, Sure Assistance) the second.

- **When the engine calls it.** Once per check a character makes from an action Item, after the
  die and before the card: `SwCheck.roll` in `module/dice/check.mjs`. Checks only, characters only,
  action Items only. The answer goes into the card's flags as `flags.starwrought.given` (`{ table,
  notes, maneuver: { slug, name }, ally: { uuid, name } | null, combat }`) when the Maneuver gives
  anything on any degree, and the marks join the roll's own. A reroll copies the first card's
  `given` across, since the table holds every degree.
- **What it is handed.** `entries`: TWO sets of the kind's rules, each entry marked with where it
  came from. `from: "item"`: the rules on the Item behind the roll, owned or not (a basic Maneuver
  is used straight from the compendium, so the roller's index does not hold them); a state applies
  only when the roller owns the Item. `from: "own"`: the roller's own rules, from `rulesOfKind` (an
  Off line never arrives). The `give` kind reads the first and the `alter` kind the second, so an
  owned copy of a Maneuver is read once. `context`: `{ kind, slug, item, maneuver, rank, degree,
  encounter }`: `maneuver` the slug of the Item's plain name, `rank` the rank ROLLED (ruling 217),
  `degree` the degree rolled or null. `actor`: the roller. The hook is asked ONCE PER ENTRY, so the
  dispatcher knows which entry said what.
- **What it may return.** `{ line: { degree, value, type, to, until } }` for a result one degree
  gives, and `{ alteration: { property, nothing?, until?, label } }` for a change to the table
  (`given.mjs`, `GiveLine` and `GiveAlteration`). `buildTable` takes the first line for a degree
  and applies each alteration to its own property: the results set to nothing first, then
  `duration`, then `beneficial-duration`, so the more particular property stands whatever the
  order of the lines, and of two changes to one property the later stands. The hook gives nothing
  and writes nothing.
- **What the dispatcher does.** Answers a null table for no actor, no Item, an Item that is not an
  action or a Maneuver with no line; walks `KINDS`; calls each hook inside try/catch, a throw
  reported once as `STARWROUGHT | the "<id>" kind's gives hook failed:` and contributing nothing;
  drops an answer that is neither a line of a known degree nor an alteration.
- **Where the marks go.** A Skip line's answer is left out of the table and its state clears; a
  one-roll custom effect's row is removed. Each ONLY when the line CHANGES what the degree rolled
  gives, which the dispatcher learns by building the table with and without that one entry
  (`sameGiven`): Sure Assistance on Skip is not spent by a Success, a Skip on a line an earlier
  line shadows is not spent at all, an alteration of a result another Talent had already emptied
  is not spent, and nothing is spent by a check made against no Threshold. The table on the card
  is whole all the same, because a reroll reads it for its own degree; so what the die did not
  spend comes back as `traces` (`{ degrees, marks }` each), the card keeps them as
  `given.unspent`, and `rerollCheck` files the marks of the ones whose degree the new die lands on.

**The give itself is triggered** (`module/documents/cards/give.mjs`), and these are its three
answers. **Who writes:** ONE client for a recipient (`writerFor`): the active GM's when one is
connected, else the client of the recipient's first active owner. The presser's own client writes
only when it is that one; otherwise it asks over the system socket, `give:apply`, answered
`give:done` or `give:refused` to the asker alone (`onChatSocket` routes `give:*`). One writer, and
one give of a card at a time on it, because the check for a give card and the writes that follow
are not one step: two presses of one card are served in turn and the second is told "already". The
executing client trusts the request for two things, who and which Constellation, reads everything
else from the check card, and takes the asker from the server's stamp, who must own the card's
roller. **The event:** the check card's message id. The give card names it
(`flags.starwrought.from`, `kind: "given"`), and a give card naming a check card means that result
was given, so the button gives way to the record on every client and after a reload, with no write
to a card only its author could update; a card that was thrown again gives nothing, by its own
`superseded` flag or by a later card that names it (`wasRerolled`). **Failure:** a give that cannot
be written writes nothing, posts nothing, tells the presser why and leaves the button.

**The pending result** is `flags.starwrought.rules.given.<maneuver>` on the recipient (`given.mjs`,
`pendingEntry`), not a row of `system.effects`: the sheet's form rewrites those rows on every
change and would drop what a row does not declare. `collectRules` indexes each as a carrier with a
one-roll duration and one resolved `give` rule, and the `give` kind's `hooks.modifiers` answers for
it on a roll whose slug is the result's, and nothing under `staticOnly` (the sheet's Defense pass),
`read` (a Threshold read), `pairingOnly` (a Strike's pairing) or `leavePending` (a total that is
itself the roll and writes nothing after: the tracker's own Initiative die and a kept road roll,
which would carry the result and leave it to be used again). The dispatcher's existing trace
asks for the carrier's removal with the roll, and `markUpdates` deletes the flag. One result of a
Maneuver per recipient: the key is the Maneuver's slug, so a new one overwrites the old.

**The window is settled with no counter.** Nothing in the system counts Opportunities, so the
count rides on the entry (`until: { who, combatant, n, begun }`). `onTurnChange` in
`module/documents/combat.mjs` calls `settleGivenResults(combat, { ended })` as an Opportunity ends
and `{ began }` as one begins, on every client, each writing the Actors it is responsible for;
`given.mjs`'s `settle` says keep, expire, or the new count. The turn step a completed circuit of
Passes takes before `nextRound()` is nobody's Opportunity: the elected client remembers it
(`roundEndSteps`) and does not report it as one that ended. A lone fighter's step to itself
(`SwCombat#nextTurn` when nobody else can take an Opportunity, the common step late in a round)
writes no Combat update, so no other client hears it: `settleLoneStep` settles this client's own
Actors and tells every other client over the socket (`rules:step`, served by `onStepSocket` after
checking the asker, the Combat and that the step was a lone one). `deleteCombat` clears every
result of that Combat. `holdersOf` finds the holders among the Combat's fighters, the tokens on
its scene (an unlinked token's Actor) and the world's Actors.

### `applies` (0.32.0)

Calculated. `hooks.applies(entries, context, actor) -> [{ line }]`, dispatched by
`ruleApplies(actor, context)` in `engine.mjs`, which returns `{ lines, skipped }`. Defined with the
`apply` kind (rulings 311 to 321), the seventh hook point and the fourth calculated one: "this
Maneuver was used; what does each line of its row put on a creature, or take off?"

- **When the engine calls it.** Twice, by two callers, never both for one use. `SwItem#applyOnUse`
  (`module/documents/item.mjs`): a Maneuver with no check, once its cost is paid, and a Maneuver
  with a use rule, once the use has stood; `rank` is null. `SwCheck.roll`
  (`module/dice/check.mjs`): a check a character makes from an action Item whose use handed over
  `cfg.applies` (the cost paid and the creature targeted), after the die and before the card;
  `rank` is the rank ROLLED. A row the system runs another way (a built-in, `paidElsewhere`) hands
  nothing over and is never asked (ruling 321).
- **What it is handed.** `entries`: the kind's rules ON THE ITEM behind the use, owned or not, one
  entry a call, each `{ rule, item, owner, from: "item", skip? }`. A line switched Off on an owned
  copy never arrives. `context`: `{ item, maneuver, rank }`. `actor`: the creature using it.
- **What it may return.** `{ line: { op: "apply" | "remove", effect: { name, slug, condition,
  value? }, who: "self" | "target", until, degree, cost, line } }` for every line whose RANK
  conditions hold, WHATEVER its degree and cost: the answer is whole, as the `gives` table is,
  because the card keeps it and a reroll reads it with no Item to ask. The caller chooses with
  `linesFor(lines, { degree, cost })` (`applied.mjs`). The hook writes nothing.
- **What the dispatcher does.** Answers nothing for no actor, no Item or an Item that is not an
  action; walks `KINDS`; calls each hook inside try/catch (`STARWROUGHT | the "<id>" kind's
  applies hook failed:`); drops an answer that is no line, has no Effect, or names a degree that
  is none. A Skip entry's lines come back under `skipped`, each with the mark that clears the
  state (`traceMarks`), and the caller files it when that line would have stood for this use.

**The application itself is triggered** (`module/documents/cards/apply.mjs`), and these are its
three answers. **Who writes:** the roller's own client for the roller's own lines, at once, as
the card is posted (never from a blind roll); for a target, ONE client (`writerFor`, the give's),
asked over the system socket as `effect:apply` and answered `effect:done` or `effect:refused` to
the asker alone, with one application of a card's side at a time on it. The request is trusted for
which side and which creature; the lines, the degree, the cost and the Maneuver are read again
from the check card, and the asker, from the server's stamp, must own the card's roller. **The
event:** the check card's id and the side, `self` or `target`. A record card names both (`kind:
"applied"`, `from`, `who`), which is what makes a result applied once on every client and after a
reload; each applied Effect's own record names the card too (`from`), so a reroll takes back what
the first die put on the roller (`removeAppliedFrom`). **Failure:** a line that cannot be written
is said on the record card with why (prevented, already there by other means, a window with no
encounter to count in); a request that cannot be served writes nothing, posts nothing and tells
the presser.

**An applied Effect** is an ActiveEffect with `flags.starwrought.applied` (`appliedRecord`: `slug`,
`name`, `condition`, `by`, `byName`, `maneuver`, `maneuverName`, `combat`, `until`, `from`, every
key always). A Condition's own effect carries it when an APPLY put the Condition on; a named
Effect is created with it. The record is how the system knows what is ITS to refresh and to end:
`setCondition(..., { applied: true })` returns a Condition put on by other means untouched, so a
window never takes off the GM's own Off-Guard (ruling 313). Two more options are decided in the
same write queue: `raise` (a value is only ever raised, and a Condition already on keeps whose
it was) and `only` (a Condition goes off only while its effect still carries that application,
`sameApplication` in `applied.mjs`), so of two APPLYs in one moment the later window stands and
the earlier one's end takes nothing off. An effect that is switched off is not ON the creature:
any write that puts the Condition on switches it on again. **The window** is the pending result's
(`settle`), with an edge: `until: { who, edge, combatant, n, begun }`, counted by
`settleAppliedEffects` on each creature's responsible client at every turn change and closed for
all at the encounter's end.

## Time: rounds, and what the clock says (0.39.0; rulings 393 to 402)

No kind and no hook point: a window gained a unit, and a Condition's row a way to say its value
drops. Mike: "durations like opportunities and rounds are always counted when it was applied."

- **The stamp** (`clock.mjs`): `{ combat, anchor, init, since }`, where a thing went on. A round
  has passed when the anchor begins its FIRST Opportunity of a later round; an anchor out of
  the fight is stood in for by the next fighter in the order; with nobody, the round's end
  counts. There is no round's start or end to count to, and the reader refuses both by name.
- **A window in rounds** is `{ who: "round", n, anchor, init, since }` on a pending result or an
  applied Effect, under keys of its own. It is NEVER WRITTEN while it runs (`settle` answers
  "keep" or "expire" alone). The two older shapes are stored and settled as they were.
- **The moment** a Maneuver was used rides on its check card (`given.moment`,
  `applies.moment`) and on a check request (`moment`), so a button pressed late, or a roll made
  after the target answered, counts from the use (ruling 400). `momentIn(combat, stored)`.
- **A Condition's own clock** is `flags.starwrought.clock` on its effect: the stamp, a `count`
  and the `holder` (the Combatant the creature fights as). Stamped as the Condition goes on, is
  raised or is switched back on (`#writeCondition`, and two hooks for the paths that bypass
  it); counted by `settleConditionClocks`; lowered by `setCondition(id, null, data, { drop,
  from })`, which lands only on the clock the tick was worked out from. A clock whose holder is
  no longer one of the creature's Combatants is not running, and is stamped anew.
- **The one entry** is `settleGivenResults(combat, change, { sink })`: `{ ended, round }`,
  `{ began, round }` or `{ roundEnded }`. A new thing that counts time joins that sweep.
- **What it says** (ruling 396): a sweep puts a plain line in a sink (`timedLines`, `sayLine`)
  and the caller posts (`postTimedLines`, which loads `documents/cards/timed.mjs` only when
  there is something to say, so this folder still loads in Node). Who sees a line is
  `audienceFor`, pure. **A new timed change says its line; it is never silent.**

## Adding a rule kind

One at a time, with Mike (ruling 119). The first was `bonus`; the next is the aura, for
Torchbearer, and its syntax is his to settle. Each kind lands as one change with all of these in it:

1. **The file.** `kinds/<id>.mjs`, exporting the definition above. Its `parse` reads one syntax
   for every Talent that will ever use the word: the aura that serves Torchbearer must serve
   every aura in the book without a second kind, as `bonus` serves every typed bonus.
2. **The registration.** Two lines at the foot of `kinds/index.mjs`: the import and
   `registerKind(<id>)`. An effect kind is named in two lists besides (0.21.0; `substitute` showed
   both are needed and the second is easy to miss): its tag in `EFFECT_TAGS` in `effects.mjs`,
   which is what makes the tag read and names the kind that parses it, and its id in
   `EFFECT_KINDS` in `module/helpers/effects.mjs`, the kinds whose lines the Effects tab lists and
   switches On / Skip / Off and the tracker's badge counts. The self-test fails unless
   `EFFECT_KINDS` is exactly the kinds `EFFECT_TAGS` names.
3. **The test.** In `assets/test_rules.mjs`: add the id to `SHIPPED_KINDS` (the self-test asserts
   the registry holds exactly that list, so a kind cannot ship unannounced; the unknown-kind
   checks use the reserved word `not-a-real-kind`, so no real kind's name is assumed unknown
   anywhere in the file), then checks of its own: the forms its `parse` accepts, the data it returns, the message of each thing it refuses,
   its `summary`, and its hooks through the dispatcher with a fake actor (`rulesActor` in the
   `bonus` section is the model). A new effect tag also joins the two tag-list strings the
   self-test matches whole, since both messages print every tag of `EFFECT_TAGS` in order (`"FOO"
   is not an effect tag: write CHECK, ATK, ...` and `EFFECT wraps an effect line, ...`; 0.21.0 added
   `, USE` to each and 0.22.0 `, GIVE, ALTER`), and its lines join `EFFECT_LINES`, each read bare
   and in its block alike (a tag that reads on one carrier alone, as `GIVE` reads on a Maneuver's
   row, keeps its lines in its own section instead).
   `node assets/test_rules.mjs` must pass; `build_all.mjs` runs it in every mode as the step
   `test_rules`, right before `build_foundry`.
4. **The grammar document.** `AUTOMATION_GRAMMAR.md` in the project root: the kind's section under
   "4. The kinds, by their stored names" (the blocks that make it, the components it takes), its
   row in section 0's table, its block's row in section 2 or its tag's row in section 3 (its shape,
   its descriptors, its examples), any new component, condition or vocabulary in the tables of
   section 3, what it does in play in section 7, its messages in section 8, and a line in section
   10's history, in the same commit (Mike, 2026-11-05; the build fails without the section).
   `data/README.txt` points at the document and repeats no syntax.
5. **The hook.** A kind names the hook point(s) it speaks at in `hooks`, and the engine's call
   sites exist once per hook point, so a kind that wants a moment the engine already asks about
   (`modifiers`) adds no engine code: `bonus` is wired by its `hooks.modifiers` alone. A kind that
   needs a NEW moment (an aura's, in `canvas/auras.mjs` beside the Aura column's rings, say)
   defines the hook point with it and not before: its dispatcher in `engine.mjs` in the shape of
   `ruleModifiers` (walk `KINDS`, skip the silent, try/catch the hook, validate what comes back),
   its call site(s) where the effect lives, and its section under "Hook points" above (its name,
   when the engine calls it, what it is handed, what it may return), as `substitute` did with
   `substitutions` in 0.21.0. Every hook asks `rulesOfKind` for the rules in play and never walks
   `actor.items`.
6. **The docs.** A `CHANGELOG.md` entry under the system version it ships in, with the ruling that
   settled the syntax; a paragraph in `FEATURES.md`'s "Automation" section saying what the kind
   does on screen; `CLAUDE.md`'s standing paragraph on the framework names the kind.
7. **The content loop that carries it.** A kind's code ships with the system (a release, with the
   three version stamps bumped). A cell that uses the kind reaches an open world through the
   content loop: save the workbook, run `sync_content.cmd` (or `node assets/build_all.mjs
   --content`), take Sync content in Foundry. The cell's rules travel as any field does, and a
   cell the grammar refuses stops the loop before the sources are written, naming the cell.

## What is deliberately not here

No survey of the Talents' Effects for what they would need; no kind but `bonus`, and no hook point
but `modifiers`; no engine code in the attack flow's resolution, damage, conditions, movement or
the auras on the map. All of it by Mike's instruction, quoted at the top: the kinds come one at a
time, from the Talent that wants each. The framework's job is to make each of those a small, local
addition when its turn comes, and `bonus` was the first proof: one file, two lines in the
registry, one dispatcher and two call sites, and nothing else in the system learned what a bonus
is.

**Not built with `substitute`** (0.21.0). A Constellation as the check a `USE` names: the parse
refuses it and the hook passes over one stored by hand, since a Constellation's own checks bring
the Initiative question of ruling 111 with the first Talent that wants them. Offers on plain
checks: a check made without the Maneuver's Item is offered nothing (ruling 219), where a `bonus`
to a Maneuver is offered unticked. `IF: UNSUBSTITUTED` as a condition. A flat Proficiency Bonus
(Working Knowledge's "+3 instead of +0"), refused by name today; it would be a new member under
the stored rule's `proficiency`, with no migration of the rules stored now. `FOR` and auras, and
`CLAIM`, all three refused by name. Aid's own outcome is read since 0.22.0.

**Not built with `give` and `alter`** (0.22.0). Two uses of one pending result (Carry the Plan):
the entry is one result, used once, by its holder. (Pay It Forward, listed here through 0.24.0,
turned out to be a free Aid once a result is used up, and is the `subordinate` kind of 0.25.0.) A
Condition given by a result. A result given by a Maneuver that rolls no check: the `gives` point is
asked by a check. An adversary as the recipient: adversaries roll flat. The `ALTER` properties
beyond the eight (a Maneuver's range, uses, slots; `movement` is read since 0.24.0 and `limit`
since 0.25.0): each is refused as not read yet
and comes with the Talent that wants it, as a new member of `given.mjs`'s property tables and a
new clause of `buildTable`, or as another hook point's reading altogether. A Threshold a
Maneuver's check opens on (Aid's "typically 15"). Known limits: with no GM connected a player's
client cannot know a circuit of Passes completed and counts the step as an Opportunity, and two
presses of one card for recipients owned by different players are served by two clients; a GM
stepping the turn back and forward counts an Opportunity twice, so a window of two or more can
close one early; the tracker's own Initiative die does not read a pending result (it still
carries, and never removes, a one-roll custom effect, as before).
