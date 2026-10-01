/**
 * Six actions a round, tracked where the system can see them spent.
 *
 * PHB v4.10: every combatant receives six actions at the start of each round and they expire at its
 * end. Play cycles through the initiative order; each visit is an Opportunity for one Maneuver you
 * can afford, or a Pass. The system spends actions where it can see them being spent: a Strike,
 * Raise a Shield, Recenter, drawing or stowing a weapon, and moving. Everything else the table pays
 * by hand, with the pips on the sheet and the readout in the tracker.
 *
 * Movement is the interesting one. The grid is one foot and Speed is feet per Move ❶, so dragging a
 * token is not "one square" but up to your Speed per action. A drag within half your Speed is a
 * Step ❶, which never provokes and cannot enter difficult terrain. A straight drag longer than
 * three Moves and within five times your Speed (less Load Strain) is a Rush ❸, which always
 * provokes. Anything else is one Move ❶ per Speed's worth of feet, and since you cannot chain two
 * Maneuvers in one Opportunity, two Moves is two Opportunities: the card says so. Every charge is
 * announced rather than silent, because terrain and forced movement are the GM's to adjust. A
 * Speed of 0 is the final Legs Wound, Prone and unable to Stand, and the only motion left is a
 * Crawl ❶ of three feet per action.
 *
 * Entering Measure is dangerous: a Move (never a Step or a Crawl; a Rush always) from outside a
 * foe's Total Reach to inside it lets that foe Intercept ❶↺ with a Quick Strike. The system offers
 * the card; it never blocks or delays the move.
 */

import * as SW from "../config.mjs";
import {
  registerCombatTracking, cardActions, cardHtml, postCard, ownersOf, tableFor, requireOwner, setting
} from "./combat.mjs";
import { footprint, cellGap, minGapAlongPath } from "../canvas/geometry.mjs";
import { reachesOf } from "../canvas/reach.mjs";

const { escapeHTML } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** Movement ids already charged, so a path split by a region checkpoint is paid for once. */
const charged = new Set();

/** Register the hooks that keep the action economy honest. */
export function registerActionTracking() {
  registerCombatTracking();
  Hooks.on("preMoveToken", onTokenMoves);
  Hooks.on("deleteCombat", () => charged.clear());
  cardActions.set("intercept", onIntercept);
  cardActions.set("interceptDefense", onInterceptDefense);
}

/* -------------------------------------------- */
/*  The numbers                                 */
/* -------------------------------------------- */

/**
 * The actor's movement numbers in feet (PHB v4.10): Speed per Move, Step = half Speed, Rush = five
 * times Speed less Load Strain. The data model derives `step` and `rush`; if a build lacks them the
 * constants say the same thing.
 * @param {Actor} actor
 * @returns {{speed: number, step: number, rush: number, loadStrain: number}}
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
  return { speed, step: Math.max(0, step), rush: Math.max(0, rush), loadStrain };
}

/**
 * What a distance costs (PHB v4.10):
 *  - at Speed 0 (the final Legs Wound: Prone, cannot Stand): a Crawl ❶ per three feet, rounded up;
 *  - within Step and across no difficult terrain: a Step ❶ (never provokes);
 *  - a straight line longer than three Moves and within Rush: a Rush ❸ (always provokes);
 *  - otherwise one Move ❶ per Speed's worth, rounded up.
 * `rushInstead` flags a bent path that a straight Rush would have paid three for.
 * @param {number} feet
 * @param {{speed: number, step: number, rush: number}} numbers
 * @param {object} [options]
 * @param {boolean} [options.terrain=false]   Did the path cross difficult terrain (cost above distance)?
 * @param {boolean} [options.straight=true]   Is the path a single straight line?
 * @returns {{kind: "crawl"|"step"|"move"|"rush", actions: number, moves: number, rushInstead: boolean}}
 */
export function classifyMove(feet, { speed, step, rush }, { terrain = false, straight = true } = {}) {
  const eps = 1e-6;
  // Prone and unable to Stand, you cannot Step, Move or Rush; Crawl ❶ is "while prone, move 3
  // feet", one action per three feet of the path's cost. Checked first so a stale `step` cannot
  // turn a crawl into a Step.
  if (speed <= 0) {
    const crawls = Math.max(1, Math.ceil((feet / SW.CRAWL_FEET) - eps));
    return { kind: "crawl", actions: crawls, moves: crawls, rushInstead: false };
  }
  if ((feet <= step + eps) && !terrain) return { kind: "step", actions: 1, moves: 1, rushInstead: false };
  const moves = Math.max(1, Math.ceil((feet / speed) - eps));
  const rushable = (feet > (3 * speed) + eps) && (feet <= rush + eps);
  if (rushable && straight) return { kind: "rush", actions: 3, moves, rushInstead: false };
  return { kind: "move", actions: moves, moves, rushInstead: rushable && !straight };
}

/* -------------------------------------------- */
/*  Charging a move                             */
/* -------------------------------------------- */

/**
 * `preMoveToken` runs on the client that started the move, before it lands, so the pips are right
 * by the time the token stops. It may return false to block a move; this never does.
 */
function onTokenMoves(token, movement, options) {
  try {
    chargeMovement(token, movement, options);
  } catch (err) {
    console.error("STARWROUGHT | could not charge a move", err);
  }
}

function chargeMovement(token, movement, options) {
  if (options?.swNoCost) return;
  if (["undo", "paste"].includes(movement.method)) return;

  const actor = token.actor;
  if (!actor?.system) return;

  // Only a Move at your own Opportunity is a Maneuver. Anything else (the GM repositioning a
  // token, a Step handed out by a Defense result, forced movement) costs nothing here.
  const combat = game.combat;
  if (!combat?.started) return;
  if (combat.scene && (combat.scene.id !== token.parent?.id)) return;
  const combatant = combat.getCombatantsByToken(token.id)[0] ?? combat.getCombatantsByActor(actor)[0] ?? null;
  if (!combatant || (combat.combatant?.id !== combatant.id)) return;

  // A path a region splits into pieces arrives as several updates under one movement id; the
  // first carries the pending remainder, so it pays for the whole.
  if (charged.has(movement.id) || movement.chain?.some(id => charged.has(id))) return;
  charged.add(movement.id);
  if (charged.size > 500) charged.clear();

  const feet = pathFeet(movement);
  if (feet.cost < 0.5) return;

  const numbers = movementNumbers(actor);
  const straight = isStraight(token, movement, feet.distance);
  const terrain = feet.cost > feet.distance + 0.01;
  const move = classifyMove(feet.cost, numbers, { terrain, straight });

  // The move always happens. spendActions announces an overspend in chat rather than refusing:
  // the token is where the player put it, and the arithmetic reports rather than rules. The
  // `trackActions` world setting switches off the spending and its card, nothing else.
  if (setting("trackActions", true)) {
    actor.spendActions?.(move.actions, { label: moveLabel(move, feet.cost) });
    combat.registerAction?.(combatant);
    announceMove(actor, move, feet.cost, numbers);
  }

  // A Step never provokes an Intercept, and neither does a Crawl. A Move may; a Rush always does.
  // The offer is a rules prompt, not a spend, so it does not depend on the tracking setting.
  if ((move.kind === "move") || (move.kind === "rush")) offerIntercepts(token, movement, actor, move);
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

/** The card that says what the move cost, and why. Public for a player's character, the GM's for an adversary. */
function announceMove(actor, move, feet, numbers) {
  const name = escapeHTML(actor.name);
  const rounded = Math.round(feet);
  const g = SW.ACTION_GLYPHS;
  let glyph;
  let title;
  let text;
  const notes = [];
  switch (move.kind) {
    case "crawl":
      // The final Legs Wound: Prone, cannot Stand, three feet an action (PHB v4.10, Crawl ❶).
      glyph = g[1];
      title = move.moves > 1
        ? format("STARWROUGHT.Actions.crawlTitleMany", { n: move.moves })
        : localize("STARWROUGHT.Actions.crawlTitle");
      text = format("STARWROUGHT.Actions.crawlText", { name, feet: rounded, crawl: SW.CRAWL_FEET, cost: move.actions });
      notes.push(localize("STARWROUGHT.Actions.crawlNote"));
      if (move.moves > 1) notes.push(localize("STARWROUGHT.Actions.moveChainNote"));
      break;
    case "step":
      glyph = g[1];
      title = localize("STARWROUGHT.Actions.stepTitle");
      text = format("STARWROUGHT.Actions.stepText", { name, feet: rounded, step: numbers.step });
      notes.push(localize("STARWROUGHT.Actions.stepNote"));
      break;
    case "rush":
      glyph = g[3];
      title = localize("STARWROUGHT.Actions.rushTitle");
      text = format("STARWROUGHT.Actions.rushText", { name, feet: rounded, rush: numbers.rush, speed: numbers.speed });
      notes.push(localize("STARWROUGHT.Actions.rushNote"));
      break;
    default:
      glyph = g[1];
      title = move.moves > 1
        ? format("STARWROUGHT.Actions.moveTitleMany", { n: move.moves })
        : localize("STARWROUGHT.Actions.moveTitle");
      text = format("STARWROUGHT.Actions.moveText", { name, feet: rounded, speed: numbers.speed, moves: move.moves, cost: move.actions });
      if (move.moves > 1) notes.push(localize("STARWROUGHT.Actions.moveChainNote"));
      if (move.rushInstead) notes.push(format("STARWROUGHT.Actions.rushInsteadNote", { rush: numbers.rush }));
      break;
  }
  return postCard(actor, cardHtml({
    root: "sw-move-card",
    actorUuid: actor.uuid,
    glyph,
    title,
    lines: [text],
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
 * The foe takes the Intercept. A character makes a Quick Strike with the weapon that reached; the
 * Strike's own cost ❶ is the Reaction's. An adversary's Intercept is answered the way every
 * adversary attack is in STARWROUGHT: the players roll, so the mover gets a card with a Defense
 * roll against the attack's Threshold, and the adversary pays its action.
 */
async function onIntercept({ actor: foe, button, root }) {
  if (!requireOwner(foe)) return;
  const targetTokenId = button.dataset.target;
  const moverToken = canvas.tokens?.get(targetTokenId) ?? null;

  if (button.dataset.weaponId) {
    if (typeof foe.rollAttack !== "function") return;
    return foe.rollAttack(button.dataset.weaponId, { strike: "quick", targetTokenId, reaction: "intercept" });
  }

  if (button.dataset.attackId) {
    const attack = (foe.system.attacks ?? []).find(a => a.id === button.dataset.attackId);
    const threshold = Number(button.dataset.threshold) || Number(attack?.threshold ?? attack?.thresholds?.[0]) || 10;
    await foe.spendActions?.(SW.REACTIONS.intercept.cost, { label: localize("STARWROUGHT.Reaction.intercept") });
    const mover = moverToken?.actor ?? null;
    const names = { foe: escapeHTML(foe.name), mover: escapeHTML(moverToken?.name ?? "?"), attack: escapeHTML(attack?.name ?? "") };
    const rushed = root?.dataset.kind === "rush";
    const notes = [localize("STARWROUGHT.Intercept.quickStrikeNote")];
    if (rushed) notes.push(format("STARWROUGHT.Intercept.rushNote", names));
    const content = cardHtml({
      root: "sw-intercept-card sw-intercept-answer",
      actorUuid: moverToken?.document.uuid ?? "",
      glyph: `${SW.ACTION_GLYPHS[1]}${SW.REACTION_GLYPH}`,
      title: localize("STARWROUGHT.Reaction.intercept"),
      lines: [format("STARWROUGHT.Intercept.answerText", { ...names, threshold })],
      notes,
      // The button carries who is attacking, so the Defense card names the interceptor and its
      // Position offers act on it, whatever the mover's player happens to have targeted.
      buttons: mover ? [{
        action: "interceptDefense", icon: "fa-solid fa-shield-halved",
        label: format("STARWROUGHT.Intercept.buttonDefense", { threshold }),
        data: { threshold, "attacker-token": foe.tokenOnScene?.()?.id ?? "", "attacker-uuid": foe.uuid }
      }] : []
    });
    return postCard(foe, content);
  }
}

/**
 * The mover answers an adversary's Intercept with the Defense its stance names (and the stance's
 * Reaction, which the engine charges), against the attack's Threshold, with the interceptor as the
 * attacker. rollDefense takes a Token placeable or an Actor; the token is preferred while it is on
 * the scene, the Actor stands in once it has left.
 */
async function onInterceptDefense({ actor: mover, button }) {
  if (!requireOwner(mover)) return;
  if (typeof mover.rollDefense !== "function") return;
  const threshold = Number(button.dataset.threshold) || 10;
  const attacker = interceptorFrom(button.dataset);
  // The mover answers an Intercept with the basic Defense alone: a Reaction never triggers a
  // Reaction (PHB v4.10, Answering an Attack), so no Parry, Void or Counter is offered and the
  // mover's stance is left standing. answeringDefense() names that basic Defense whatever stance
  // they hold (Parry is a Guard, Void an Evade, Counter the better of the two, Grabbed swap applied).
  const answering = typeof mover.answeringDefense === "function" ? mover.answeringDefense() : null;
  const key = answering?.key ?? ((mover.system.stance in SW.DEFENSES) ? mover.system.stance : "evade");
  return mover.rollDefense(key, {
    threshold,
    thresholdLabel: format("STARWROUGHT.Intercept.thresholdLabel", { threshold }),
    attacker,
    reaction: null,
    basicOnly: true,
    defenseNote: localize("STARWROUGHT.Reaction.basicOnly")
  });
}

/** The interceptor an answer card's button names: its Token on the canvas, else its Actor, else null. */
function interceptorFrom(dataset) {
  const token = dataset.attackerToken ? canvas.tokens?.get(dataset.attackerToken) : null;
  if (token) return token;
  if (!dataset.attackerUuid) return null;
  try {
    const doc = fromUuidSync(dataset.attackerUuid);
    return doc?.actor ?? doc ?? null;
  } catch {
    return null;
  }
}
