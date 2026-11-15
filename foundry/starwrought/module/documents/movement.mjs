/**
 * Movement on the grid, charged against the six actions, and the Intercept it invites.
 *
 * PHB v4.10: every combatant receives six actions at the start of each round and they expire at its
 * end. The system spends actions where it can see them being spent (`SwActor#spendActions`: a
 * Strike, a Cast, Raise a Shield, Recenter, drawing or stowing a weapon, and since 0.23.0 a
 * Maneuver used from the sheet, documents/item.mjs) and anything else the table pays by hand, with
 * the pips on the sheet and the readout in the tracker. This module is the one spend the system
 * sees on the map: a token drag, which is also what pays for the Move, Step, Crawl, Rush, Leap and
 * Squeeze rows (`PAID_ELSEWHERE` in documents/maneuvers.mjs). (Recenter and Raise a Shield are also Maneuver Items;
 * which ones run the system's behaviour when used is documents/maneuvers.mjs, 0.10.1.)
 *
 * The grid is one foot and Speed is feet per Move ❶, so dragging a token is not "one square" but up
 * to your Speed per action. A drag within half your Speed is a Step ❶, which never provokes and
 * cannot enter difficult terrain. A straight drag longer than three Moves and within five times
 * your Speed (less Load Strain) is a Rush ❸, which always provokes. Anything else is one Move ❶ per
 * Speed's worth of feet, and since you cannot chain two Maneuvers in one Opportunity, two Moves is
 * two Opportunities: the card says so. Every charge is announced rather than silent, because
 * terrain and forced movement are the GM's to adjust. A Speed of 0 is the final Legs Wound, Prone
 * and unable to Stand, and the only motion left is a Crawl ❶ of three feet per action.
 *
 * Entering Measure is dangerous: a Move (never a Step or a Crawl; a Rush always) from outside a
 * foe's Total Reach to inside it lets that foe Intercept ❶↺ with a Quick Strike. The system offers
 * the card; it never blocks or delays the move. Taken, the Intercept declares into the attack flow
 * like any Blow (0.12.0, ruling 161): the mover commits a basic Defense in the Combat Prompt (a
 * Reaction never triggers a Reaction), and nothing is read for them.
 *
 * Named documents/actions.mjs through 0.10.0, which read as the actions workbook or the Actions
 * pack; canvas/ruler.mjs reads the numbers and the classifier from here to colour a drag.
 */

import * as SW from "../config.mjs";
import { registerCombatTracking } from "./combat.mjs";
import { cardActions, cardHtml, postCard, ownersOf, tableFor, requireOwner } from "../helpers/cards.mjs";
import { setting } from "../helpers/settings.mjs";
import { footprint, cellGap, minGapAlongPath } from "../canvas/geometry.mjs";
import { reachesOf } from "../canvas/reach.mjs";
import { AttackCoordinator } from "../combat/attack-coordinator.mjs";
// A bonus to Speed (0.15.0, ruling 181): the Automation rules' `Speed` target, feet on a Move.
import { ruleModifiers } from "../rules/engine.mjs";
import { sceneContextFor, encounterContext, writeRuleMarks } from "../rules/scene.mjs";
// A Move made as part of a Maneuver (0.24.0): the record a `PERMIT` leaves, read here and by the ruler.
import { MOVE_RECORD_FLAG, MOVE_USED_FLAG, moveRoleFor, asManeuverMove, withUsed } from "../rules/maneuver-move.mjs";

const { escapeHTML } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** Movement ids already charged, so a path split by a region checkpoint is paid for once. */
const charged = new Set();

/**
 * The Maneuver's Moves this client has already begun, as "<nonce>:<token id>" (0.24.0): the flag
 * that says so is written after the drag is let go, so a second quick drag would otherwise read
 * the record as unused and be free as well.
 */
const begun = new Set();

/** Register the hooks that charge a drag and offer the Intercept; the round's own hooks first. */
export function registerMovementTracking() {
  registerCombatTracking();
  Hooks.on("preMoveToken", onTokenMoves);
  Hooks.on("deleteCombat", () => { charged.clear(); begun.clear(); });
  cardActions.set("intercept", onIntercept);
}

/**
 * Is a drag of this token a Move made as part of a Maneuver (0.24.0; rulings 240 to 242)? The
 * records are on the users of such Maneuvers (`flags.starwrought.maneuverMove`, written when a
 * `PERMIT` line's Maneuver is used); every fighter of the encounter is asked, since the ally's
 * client reads the user's record and holds none of its own. Null outside a started encounter on
 * the token's scene, for a token that is not a fighter in it (its drags are never charged, so the
 * ruler must not price one as the Maneuver's Move either), when no record is live in the running
 * Opportunity, or when this token has already made its Move for it. One reading, for the charge
 * below and for the ruler.
 * @param {TokenDocument} token
 * @returns {{role: "user"|"ally", record: object, holder: Actor}|null}
 */
export function maneuverMoveOf(token) {
  const actor = token?.actor;
  const combat = game.combat;
  if (!actor || !combat?.started) return null;
  if (combat.scene && (combat.scene.id !== token.parent?.id)) return null;
  if (!combatantOf(token)) return null;
  const records = [];
  const holders = [];
  for (const combatant of combat.combatants) {
    const record = combatant.actor?.getFlag?.(SW.SYSTEM_ID, MOVE_RECORD_FLAG);
    if (!record || records.includes(record)) continue;
    records.push(record);
    holders.push(combatant.actor);
  }
  if (!records.length) return null;
  const used = actor.getFlag?.(SW.SYSTEM_ID, MOVE_USED_FLAG) ?? null;
  const held = moveRoleFor(token.id, { records, used, encounter: encounterContext() });
  if (!held || begun.has(`${held.record.nonce}:${token.id}`)) return null;
  return { ...held, holder: holders[records.indexOf(held.record)] };
}

/** The token's combatant in the started encounter on its scene, whoever's Opportunity it is. */
function combatantOf(token) {
  const actor = token?.actor;
  const combat = game.combat;
  if (!actor || !combat?.started) return null;
  if (combat.scene && (combat.scene.id !== token.parent?.id)) return null;
  return combat.getCombatantsByToken(token.id)[0] ?? combat.getCombatantsByActor(actor)[0] ?? null;
}

/* -------------------------------------------- */
/*  The numbers                                 */
/* -------------------------------------------- */

/**
 * The actor's movement numbers in feet (PHB v4.21, Motion): Speed per Move, Step = half Speed,
 * Rush = three times Speed less Load Strain, Crawl = half the Speed the legs had. The data model
 * derives `step`, `rush` and `crawl`; if a build lacks them the constants say the same thing.
 * Since 0.15.0 (ruling 181) `move` is the Move's own reach: the Speed plus whatever the Automation
 * rules' `Speed` target adds (Riverfoot's first Move a foot longer), read with `kind: "move"`; a
 * Step, a Rush and a Crawl stay on the Speed itself, since the book's words are "Move". The marks
 * a FIRST or ONCE rule asks for ride on `moveMarks`, and `chargeMovement` writes them when the
 * charged Maneuver is a Move.
 * @param {Actor} actor
 * @returns {{speed: number, move: number, step: number, rush: number, crawl: number, loadStrain: number, moveMarks: Array}}
 */
export function movementNumbers(actor) {
  const sys = actor?.system ?? {};
  // What the Legs allow, not the stored Speed: an adversary keeps `speed` as its own value for
  // the sheet's input and derives `moveSpeed` after Wounds; a character sets both the same. A
  // Speed of 0 is the final Legs Wound (Prone, cannot Stand), a real number and not a missing one,
  // so only a value that is not a number at all falls back to the default.
  const raw = Number(sys.moveSpeed ?? sys.speed ?? NaN);
  const speed = Number.isFinite(raw) ? Math.max(0, raw) : SW.DEFAULT_SPEED;
  const loadStrain = Math.max(0, Number(sys.loadStrain) || 0);
  const step = Number.isFinite(sys.step) ? sys.step : Math.floor(speed / SW.STEP_DIVISOR);
  const rush = Number.isFinite(sys.rush) ? sys.rush : (speed * SW.RUSH_MULTIPLIER) - loadStrain;
  // A fighter at Speed 0 crawls on the Speed the final Legs Wound took (ruling 138); a build
  // without the derived number halves the stored Speed.
  const fallbackCrawl = Math.floor(Math.max(speed, Number(sys.speed) || 0) / SW.CRAWL_DIVISOR);
  const crawl = Number.isFinite(sys.crawl) ? sys.crawl : fallbackCrawl;
  const { bonus, marks } = speedBonus(actor);
  return {
    speed, move: Math.max(0, speed + ((speed > 0) ? bonus : 0)),
    step: Math.max(0, step), rush: Math.max(0, rush), crawl: Math.max(1, crawl), loadStrain, moveMarks: marks
  };
}

/** The `Speed` bonuses the rules put on a Move (0.15.0), as feet, with the marks they ask for. */
function speedBonus(actor) {
  if (!actor?.system?.rules || (actor.type === "npc")) return { bonus: 0, marks: [] };
  try {
    const { applied, marks } = ruleModifiers(actor, {
      kind: "move", slug: "", item: null, rank: "untrained", threat: null, other: null,
      scene: sceneContextFor(actor), encounter: encounterContext()
    });
    const total = applied.length ? SW.resolveModifiers(applied).total : 0;
    return { bonus: Number.isFinite(total) ? total : 0, marks: marks ?? [] };
  } catch (err) {
    console.error("STARWROUGHT | the Speed rules could not be read", err);
    return { bonus: 0, marks: [] };
  }
}

/**
 * What a distance costs (PHB v4.21):
 *  - at Speed 0 (the final Legs Wound: Prone, cannot Stand): a Crawl ❶ per half Speed, rounded up;
 *  - within Step and across no difficult terrain: a Step ❶ (never provokes);
 *  - a straight line longer than two Moves and within Rush: a Rush ❷ (always provokes; three
 *    times Speed for two actions, so cheaper than the three Moves it replaces);
 *  - otherwise one Move ❶ per Speed's worth, rounded up.
 * `rushInstead` flags a bent path that a straight Rush would have paid two for.
 * @param {number} feet
 * @param {{speed: number, step: number, rush: number, crawl?: number}} numbers
 * @param {object} [options]
 * @param {boolean} [options.terrain=false]   Did the path cross difficult terrain (cost above distance)?
 * @param {boolean} [options.straight=true]   Is the path a single straight line?
 * @returns {{kind: "crawl"|"step"|"move"|"rush", actions: number, moves: number, rushInstead: boolean}}
 */
export function classifyMove(feet, { speed, move = null, step, rush, crawl = 3 }, { terrain = false, straight = true } = {}) {
  const eps = 1e-6;
  // Prone and unable to Stand, you cannot Step, Move or Rush; Crawl ❶ is "while prone, Move up
  // to half your Speed", one action per that many feet of the path's cost. Checked first so a
  // stale `step` cannot turn a crawl into a Step.
  if (speed <= 0) {
    const per = Math.max(1, Number(crawl) || 1);
    const crawls = Math.max(1, Math.ceil((feet / per) - eps));
    return { kind: "crawl", actions: crawls, moves: crawls, rushInstead: false };
  }
  if ((feet <= step + eps) && !terrain) return { kind: "step", actions: 1, moves: 1, rushInstead: false };
  // A Move reaches `move` feet (the Speed plus a rule's bonus, 0.15.0); a Rush stays on the Speed.
  const perMove = (Number.isFinite(move) && (move > 0)) ? move : speed;
  const moves = Math.max(1, Math.ceil((feet / perMove) - eps));
  const rushable = (feet > (SW.RUSH_COST * speed) + eps) && (feet <= rush + eps);
  if (rushable && straight) return { kind: "rush", actions: SW.RUSH_COST, moves, rushInstead: false };
  return { kind: "move", actions: moves, moves, rushInstead: rushable && !straight };
}

/* -------------------------------------------- */
/*  Charging a move                             */
/* -------------------------------------------- */

/**
 * `preMoveToken` runs on the client that started the move, before it lands, so the pips are right
 * by the time the token stops. It may return false to block a move, and since 0.5.3 it does, in
 * one case: a drag at your own Opportunity that is more than one Maneuver's worth of movement
 * (PHB v4.10, one Maneuver per Opportunity; Mike, 2026-10-01: "we should not be able to Move more
 * than our Speed at one time, in combat"). Everything else here reports rather than rules.
 */
function onTokenMoves(token, movement, options) {
  if (options?.swNoCost) return;
  if (["undo", "paste"].includes(movement.method)) return;

  const actor = token.actor;
  if (!actor?.system) return;

  // A path a region or a waypoint splits into pieces arrives as several updates under one movement
  // id or chain; the first carries the pending remainder, so it paid for the whole and passed
  // the gate for the whole. Asked BEFORE the gate since 0.24.0: through 0.23.1 the later piece of
  // an off-turn drag the GM had approved found the permit spent, asked the GM again and was
  // refused, leaving the token at its first waypoint, already charged for the whole path.
  if (charged.has(movement.id) || movement.chain?.some(id => charged.has(id))) return;

  // A Move made as part of a Maneuver (0.24.0; ../rules/maneuver-move.mjs): the user's own, paid
  // for when Move Together was used, or the ally's, permitted by it.
  const held = maneuverMoveOf(token);

  // Only a Move at your own Opportunity is a Maneuver. Anything else (the GM repositioning a
  // token, a Step handed out by a Defense result, forced movement) costs nothing here. Since
  // 0.19.0 a player's drag of their combatant outside its Opportunity is refused and asks the GM
  // (the gate in documents/actor/actions.mjs; Mike, playtest); a drag the GM approved goes
  // through once, charged as a Move at the Opportunity would be.
  let combatant = opportunityOf(token);
  let permit = false;
  if (!combatant && held) {
    // The Maneuver's Move asks nobody: its Maneuver was the asking. The gate is not touched, so
    // an approval the GM gave this fighter for something else is not spent on it; and the GM's own
    // drag of the token counts as the Move too, where any other drag of the GM's is free.
    combatant = combatantOf(token);
    if (!combatant) return;
  } else if (!combatant) {
    const waiting = combatantOutOfTurn(token);
    if (!waiting) return;
    if (!actor.canActNow()) {
      actor.mayActNow({ label: localize("STARWROUGHT.Opportunity.aMove") })
        .catch(err => console.error("STARWROUGHT | the move's request could not be posted", err));
      return false;
    }
    // The GM's approval is spent below, once the drag is known to stand (0.24.0): through 0.23.1
    // it was spent here, so a drop the cap then refused, or a twitch under half a foot, used it up.
    combatant = waiting;
    permit = true;
  }

  const feet = pathFeet(movement);
  if (feet.cost < 0.5) return;

  const numbers = movementNumbers(actor);
  const straight = isStraight(token, movement, feet.distance);
  const terrain = feet.cost > feet.distance + 0.01;
  // As the Maneuver's Move it is a Move however short (never a Rush; a Step only with the
  // alteration), and the user's is one Move's worth cheaper.
  const classified = classifyMove(feet.cost, numbers, { terrain, straight });
  const move = held ? asManeuverMove(classified, held) : classified;

  // One Maneuver per Opportunity: a drag is one Step, one Move, one Crawl or one straight Rush.
  // A second Move's worth is refused before the token lands (the ruler painted those squares red
  // on the way), and the mover is told how far one Move carries them. The world setting `capMoves`
  // switches the refusal off and restores the 0.5.2 card that counted the Moves for the table.
  if (moveCapped(move) && setting("capMoves", true)) {
    const key = (move.kind === "crawl") ? "STARWROUGHT.Actions.crawlCapped" : "STARWROUGHT.Actions.moveCapped";
    ui.notifications.warn(format(key, {
      name: actor.name, feet: Math.round(feet.cost), speed: numbers.speed, crawl: numbers.crawl, rush: numbers.rush
    }));
    return false;
  }

  charged.add(movement.id);
  if (charged.size > 500) charged.clear();
  if (permit) {
    actor.mayActNow({ label: localize("STARWROUGHT.Opportunity.aMove") })
      .catch(err => console.error("STARWROUGHT | the move's permit could not be spent", err));
  }
  if (held) {
    begun.add(`${held.record.nonce}:${token.id}`);
    if (begun.size > 500) begun.clear();
  }
  chargeMovement({ token, movement, actor, combatant, move, feet, numbers, held }).catch(err => {
    console.error("STARWROUGHT | could not charge a move", err);
  });
}

/**
 * The combatant whose Opportunity it is, when that is this token's: a started encounter on the
 * token's scene, with the token (or its actor) the current combatant. Null at any other time. The
 * ruler asks the same question, so it is asked here once.
 * @param {TokenDocument} token
 * @returns {Combatant|null}
 */
export function opportunityOf(token) {
  const actor = token?.actor;
  if (!actor) return null;
  const combat = game.combat;
  if (!combat?.started) return null;
  if (combat.scene && (combat.scene.id !== token.parent?.id)) return null;
  const combatant = combat.getCombatantsByToken(token.id)[0] ?? combat.getCombatantsByActor(actor)[0] ?? null;
  if (!combatant || (combat.combatant?.id !== combatant.id)) return null;
  return combatant;
}

/**
 * This token's combatant in the started encounter on its scene when it is NOT its Opportunity and
 * the mover is a player (0.19.0): the drag the Opportunity gate asks the GM about. Null for the
 * GM's own drags, a token outside the encounter, or the current combatant (`opportunityOf`).
 * @param {TokenDocument} token
 * @returns {Combatant|null}
 */
function combatantOutOfTurn(token) {
  if (game.user.isGM) return null;
  const actor = token?.actor;
  const combat = game.combat;
  if (!actor || !combat?.started) return null;
  if (combat.scene && (combat.scene.id !== token.parent?.id)) return null;
  const combatant = combat.getCombatantsByToken(token.id)[0] ?? combat.getCombatantsByActor(actor)[0] ?? null;
  if (!combatant || (combat.combatant?.id === combatant.id)) return null;
  return combatant;
}

/** More than one Maneuver carries: a second Move, or a second Crawl. A straight Rush is one Maneuver. */
export function moveCapped(move) {
  return ((move?.kind === "move") || (move?.kind === "crawl")) && (move.moves > 1);
}

/**
 * Does the one-Maneuver cap bind this token right now: the setting on, and its own Opportunity, or
 * (0.24.0) a Move it is making as part of a Maneuver, which is one Move wherever it is made.
 */
export function moveCapApplies(token) {
  return setting("capMoves", true) && (!!opportunityOf(token) || !!maneuverMoveOf(token));
}

/** Spend the actions a move costs, say so, and offer the Intercepts it provokes. */
async function chargeMovement({ token, movement, actor, combatant, move, feet, numbers, held = null }) {
  // The move has been allowed to happen. spendActions announces an overspend in chat rather than
  // refusing: the token is where the player put it, and the arithmetic reports rather than rules.
  // The `trackActions` world setting switches off the spending and its card, nothing else.
  if (setting("trackActions", true)) {
    // The move's own card carries the actions-left line, so the spend posts no card of its own;
    // it is awaited so the card reads the count after the spend. The user's Move as part of a
    // Maneuver was paid for at the click (0.24.0), so only what lies beyond it is spent here.
    const cost = held ? move.charge : move.actions;
    if (cost > 0) await actor.spendActions?.(cost, { label: moveLabel(move, feet.cost), announce: false });
    game.combat?.registerAction?.(combatant);
    await announceMove(actor, move, feet.cost, numbers, maneuverNotes(token, movement, held));
  }

  // The Maneuver's Move has been made (0.24.0): said on the record, whatever the tracking setting,
  // or a table that counts by hand would be given the same Move again.
  if (held) {
    await markManeuverMove(actor, held).catch(err => console.error("STARWROUGHT | the Maneuver's Move could not be marked as made", err));
  }

  // A FIRST or ONCE `Speed` rule that lengthened this Move is remembered now (0.15.0, ruling 181):
  // a Step or a Rush first leaves the foot unspent, since the book's word is "Move".
  if ((move.kind === "move") && numbers.moveMarks?.length) {
    await writeRuleMarks(actor, numbers.moveMarks).catch(err => console.error("STARWROUGHT | the Speed rule marks could not be written", err));
  }

  // A Step never provokes an Intercept, and neither does a Crawl. A Move may; a Rush always does.
  // The offer is a rules prompt, not a spend, so it does not depend on the tracking setting.
  if ((move.kind === "move") || (move.kind === "rush")) offerIntercepts(token, movement, actor, move);
}

/**
 * Say that the Maneuver's Move has been made (0.24.0, ruling 244): the user's on the record itself
 * (`moved`, with every other key written again, since a flag update merges), the ally's on the
 * ally's own actor (`maneuverMoved: { nonces }`, the uses it has moved for: two fighters may permit
 * the same ally in one Opportunity, and a mark of one nonce would forget the first on the second),
 * which is the one thing the ally's client may write. The mover's client writes when it may: the
 * mover's owner, or the GM who dragged the token.
 */
async function markManeuverMove(actor, held) {
  if (held.role === "user") {
    const holder = held.holder ?? actor;
    if (!(holder.isOwner || game.user.isGM)) return;
    await holder.setFlag(SW.SYSTEM_ID, MOVE_RECORD_FLAG, { ...held.record, moved: true });
    return;
  }
  if (!(actor.isOwner || game.user.isGM)) return;
  await actor.setFlag(SW.SYSTEM_ID, MOVE_USED_FLAG, withUsed(actor.getFlag(SW.SYSTEM_ID, MOVE_USED_FLAG), held.record.nonce));
}

/**
 * What the move's card says of the Maneuver it is part of (0.24.0): whose Maneuver, that the
 * user's Move was paid for when it was used, and, for the one permitted, how far from the user it
 * ends when that is farther than the Maneuver's `FOR` range (Move Together: "It must finish
 * adjacent to you"). Said, not enforced. The end is measured from the drag's destination, since
 * the document still holds the origin while this hook runs.
 * @returns {{notes: string[], paid: boolean}|null}
 */
function maneuverNotes(token, movement, held) {
  if (!held) return null;
  const from = escapeHTML(held.record.from || localize("STARWROUGHT.Opportunity.aManeuver"));
  const user = escapeHTML(held.holder?.name ?? "");
  const notes = [];
  if (held.role === "user") {
    notes.push(format("STARWROUGHT.Actions.maneuverMoveUser", { from }));
  } else {
    notes.push(format("STARWROUGHT.Actions.maneuverMoveAlly", { from, user }));
    const range = held.record.range;
    const other = token.parent?.tokens?.get(held.record.userTokenId) ?? null;
    if (Number.isFinite(range) && other) {
      try {
        const end = movement.pending?.waypoints?.at(-1) ?? movement.destination;
        const here = footprint({ x: end.x, y: end.y, width: token.width, height: token.height });
        const gap = cellGap(here, footprint(other)) * (token.parent.grid?.distance ?? 1);
        if (gap > range + 1e-6) {
          notes.push(format("STARWROUGHT.Actions.maneuverMoveApart", { feet: Math.round(gap), user, from }));
        }
      } catch (err) {
        console.warn("STARWROUGHT | the end of the Maneuver's Move could not be measured", err);
      }
    }
  }
  return { notes, paid: held.role === "user" };
}

/** Feet, as cost (terrain counted) and as plain distance, for the whole path this move begins. */
function pathFeet(movement) {
  const part = segment => {
    if (!segment) return { cost: 0, distance: 0 };
    const distance = Number(segment.distance) || 0;
    const cost = Number.isFinite(segment.cost) ? segment.cost : distance;
    return { cost, distance };
  };
  const passed = part(movement.passed);
  const pending = part(movement.pending);
  return { cost: passed.cost + pending.cost, distance: passed.distance + pending.distance };
}

/** Is the path one straight line? Measured the grid's way, so exact diagonals count as straight. */
function isStraight(token, movement, distance) {
  try {
    const end = movement.pending?.waypoints?.at(-1) ?? movement.destination;
    const from = token.getCenterPoint(movement.origin);
    const to = token.getCenterPoint(end);
    const direct = canvas.grid.measurePath([from, to]).distance;
    return distance <= direct + 0.05;
  } catch {
    return false;
  }
}

/** What the spend is called on an overspend card. */
function moveLabel(move, feet) {
  const key = {
    crawl: "STARWROUGHT.Actions.crawlSpend",
    step: "STARWROUGHT.Actions.stepSpend",
    rush: "STARWROUGHT.Actions.rushSpend",
    move: "STARWROUGHT.Actions.moveSpend"
  }[move.kind];
  return format(key, { feet: Math.round(feet), moves: move.moves });
}

/**
 * The card that says what the move cost, and why. Public for a player's character, the GM's for an adversary.
 * @param {{notes: string[], paid: boolean}|null} [maneuver]  What `maneuverNotes` says when the move
 *        is part of a Maneuver (0.24.0): its lines, and whether the first Move was paid at the click.
 */
function announceMove(actor, move, feet, numbers, maneuver = null) {
  const name = escapeHTML(actor.name);
  const rounded = Math.round(feet);
  const g = SW.ACTION_GLYPHS;
  let glyph;
  let title;
  let text;
  const notes = [];
  // What the mover pays here: everything, or what lies beyond the Move the Maneuver's click paid.
  const paid = maneuver?.paid === true;
  const cost = paid ? (move.charge ?? move.actions) : move.actions;
  switch (move.kind) {
    case "crawl":
      // The final Legs Wound: Prone, cannot Stand, half the Speed the legs had an action (PHB
      // v4.21, Crawl ❶; ruling 138).
      glyph = g[1];
      title = move.moves > 1
        ? format("STARWROUGHT.Actions.crawlTitleMany", { n: move.moves })
        : localize("STARWROUGHT.Actions.crawlTitle");
      text = format("STARWROUGHT.Actions.crawlText", { name, feet: rounded, crawl: numbers.crawl, cost });
      notes.push(localize("STARWROUGHT.Actions.crawlNote"));
      if (move.moves > 1) notes.push(localize("STARWROUGHT.Actions.moveChainNote"));
      break;
    case "step":
      glyph = g[1];
      title = localize("STARWROUGHT.Actions.stepTitle");
      text = format(paid ? "STARWROUGHT.Actions.stepTextPaid" : "STARWROUGHT.Actions.stepText", { name, feet: rounded, step: numbers.step });
      notes.push(localize("STARWROUGHT.Actions.stepNote"));
      break;
    case "rush":
      glyph = g[SW.RUSH_COST];
      title = localize("STARWROUGHT.Actions.rushTitle");
      text = format("STARWROUGHT.Actions.rushText", { name, feet: rounded, rush: numbers.rush, speed: numbers.speed });
      notes.push(localize("STARWROUGHT.Actions.rushNote"));
      break;
    default:
      glyph = g[1];
      title = move.moves > 1
        ? format("STARWROUGHT.Actions.moveTitleMany", { n: move.moves })
        : localize("STARWROUGHT.Actions.moveTitle");
      text = format("STARWROUGHT.Actions.moveText", { name, feet: rounded, speed: numbers.speed, moves: move.moves, cost });
      // A Move longer than the Speed (0.15.0, a `Speed` rule such as Riverfoot's): say where the feet came from.
      if (Number.isFinite(numbers.move) && (numbers.move !== numbers.speed)) {
        notes.push(format("STARWROUGHT.Actions.moveReachNote", { move: numbers.move, speed: numbers.speed, bonus: numbers.move - numbers.speed > 0 ? `+${numbers.move - numbers.speed}` : String(numbers.move - numbers.speed) }));
      }
      if (move.moves > 1) notes.push(localize("STARWROUGHT.Actions.moveChainNote"));
      if (move.rushInstead) notes.push(format("STARWROUGHT.Actions.rushInsteadNote", { rush: numbers.rush }));
      break;
  }
  // The Maneuver this move is part of comes first among the notes (0.24.0).
  if (maneuver?.notes?.length) notes.unshift(...maneuver.notes);
  // What the move cost and what is left this round, on the same card (Mike, 2026-10-01).
  const left = actor.actionsLeftLine?.() ?? "";
  return postCard(actor, cardHtml({
    root: "sw-move-card",
    actorUuid: actor.uuid,
    glyph,
    title,
    lines: left ? [text, `<strong class="sw-actions-left">${left}</strong>`] : [text],
    notes
  }), { whisper: tableFor(actor) });
}

/* -------------------------------------------- */
/*  Intercept                                   */
/* -------------------------------------------- */

/** FRIENDLY and HOSTILE are foes to each other; NEUTRAL and SECRET tokens are nobody's business here. */
function hostileTo(a, b) {
  const D = CONST.TOKEN_DISPOSITIONS;
  return ((a === D.FRIENDLY) && (b === D.HOSTILE)) || ((a === D.HOSTILE) && (b === D.FRIENDLY));
}

/**
 * Offer an Intercept to every hostile token whose Total Reach this move enters from outside
 * (PHB v4.10, Intercept ❶↺: "When a foe Moves from outside your Total Reach to inside it ... make a
 * Quick Strike at the moment they enter. Once per foe per Move."). Only a foe whose Talents grant
 * the Reaction is asked, and only once per foe per move. Withdrawing provokes nothing.
 */
function offerIntercepts(token, movement, actor, move) {
  const scene = token.parent;
  if (!scene || !canvas?.ready || (canvas.scene?.id !== scene.id)) return;
  const distance = scene.grid.distance;
  const mover = { width: token.width, height: token.height };
  const origin = { x: movement.origin.x, y: movement.origin.y, width: token.width, height: token.height };
  const path = [movement.origin, ...(movement.passed?.waypoints ?? []), ...(movement.pending?.waypoints ?? [])]
    .map(p => ({ x: p.x, y: p.y }));

  for (const foe of scene.tokens) {
    if ((foe.id === token.id) || !foe.actor?.system) continue;
    if (!hostileTo(token.disposition, foe.disposition)) continue;
    if (foe.actor.system.reactions?.intercept !== true) continue;
    const statuses = foe.actor.statuses ?? new Set();
    if (statuses.has("unconscious") || statuses.has("dying") || statuses.has("dead")) continue;

    const reach = Number(foe.actor.system.totalReach ?? reachesOf(foe.actor).total) || 0;
    const before = cellGap(footprint(origin), footprint(foe)) * distance;
    if (before <= reach) continue;
    if (minGapAlongPath(mover, path, foe) > reach) continue;

    postInterceptCard({ foe, mover: token, actor, move, reach });
  }
}

/** The foe's longest melee weapon in hand, which is what sets its Total Reach. */
function interceptWeapon(actor) {
  const derived = actor.system.reachWeapon;
  if (derived?.id && actor.items.has(derived.id)) return derived;
  return actor.items
    .filter(i => (i.type === "weapon") && i.system.held && !i.system.isRanged)
    .sort((a, b) => (b.system.reach ?? 0) - (a.system.reach ?? 0))[0] ?? null;
}

/** An adversary's longest-reaching attack, with the Threshold the mover's Defense roll meets. */
function interceptAttack(actor) {
  const attack = [...(actor.system.attacks ?? [])]
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0] ?? null;
  if (!attack) return null;
  const threshold = Number(attack.threshold ?? attack.thresholds?.[0]);
  return { id: attack.id, name: attack.name, threshold: Number.isFinite(threshold) ? threshold : null };
}

function postInterceptCard({ foe, mover, actor, move, reach }) {
  const foeActor = foe.actor;
  const names = { foe: escapeHTML(foe.name), mover: escapeHTML(mover.name) };
  const g = SW.ACTION_GLYPHS;
  const cost = `${g[1]}${SW.REACTION_GLYPH}`;
  const lines = [format(move.kind === "rush" ? "STARWROUGHT.Intercept.rushText" : "STARWROUGHT.Intercept.moveText", { ...names, reach })];
  const notes = [localize("STARWROUGHT.Intercept.note")];
  if (move.kind === "rush") notes.push(format("STARWROUGHT.Intercept.rushNote", names));
  const buttons = [];

  if (foeActor.type === "npc") {
    const attack = interceptAttack(foeActor);
    if (attack && (attack.threshold !== null)) {
      buttons.push({
        action: "intercept", icon: "fa-solid fa-bolt",
        label: format("STARWROUGHT.Intercept.buttonAttack", { cost, attack: escapeHTML(attack.name), threshold: attack.threshold }),
        data: { "attack-id": attack.id, target: mover.id, threshold: attack.threshold }
      });
    } else notes.push(localize("STARWROUGHT.Intercept.noAttack"));
  } else {
    const weapon = interceptWeapon(foeActor);
    if (weapon) {
      buttons.push({
        action: "intercept", icon: "fa-solid fa-bolt",
        label: format("STARWROUGHT.Intercept.buttonStrike", { cost, weapon: escapeHTML(weapon.name) }),
        data: { "weapon-id": weapon.id, target: mover.id }
      });
    } else notes.push(localize("STARWROUGHT.Intercept.noWeapon"));
  }

  return postCard(foeActor, cardHtml({
    root: "sw-intercept-card",
    actorUuid: foe.uuid,
    glyph: cost,
    title: localize("STARWROUGHT.Reaction.intercept"),
    lines,
    notes,
    buttons,
    data: { "mover-token": mover.id, kind: move.kind }
  }), { whisper: ownersOf(foeActor) });
}

/**
 * The foe takes the Intercept: a Quick Strike declared into the attack flow (0.12.0, ruling 161),
 * answered by the mover's basic Defense alone, committed in the Combat Prompt. A character
 * declares with the weapon that reached (rollAttack pays Intercept's ❶↺ as the Blow is declared);
 * an adversary declares its longest attack row and pays its action, and the mover, if a player's,
 * rolls Defense against the row's Threshold once the answer is revealed, as for every adversary
 * attack in STARWROUGHT. Nothing is read for the mover, and no card asks them for a roll outside
 * the flow.
 */
async function onIntercept({ actor: foe, button }) {
  if (!requireOwner(foe)) return;
  const targetTokenId = button.dataset.target;
  const moverToken = canvas.tokens?.get(targetTokenId) ?? null;

  if (button.dataset.weaponId) {
    if (typeof foe.rollAttack !== "function") return;
    return foe.rollAttack(button.dataset.weaponId, { strike: "quick", targetTokenId, reaction: "intercept" });
  }

  if (button.dataset.attackId) {
    if (!moverToken?.actor) return ui.notifications.warn(localize("STARWROUGHT.Notify.noTarget"));
    const pub = await AttackCoordinator.declare({
      attacker: foe, attackId: button.dataset.attackId, strike: "quick", targets: [moverToken], reaction: "intercept"
    });
    if (!pub) return null;
    await foe.spendActions?.(SW.REACTIONS.intercept.cost, { label: localize("STARWROUGHT.Reaction.intercept") });
    return pub;
  }
}
