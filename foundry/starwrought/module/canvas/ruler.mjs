/**
 * The drag ruler, coloured by Moves.
 *
 * PHB v4.10: Speed is how far a single Move ❶ carries you, in feet; a Step ❶ is half your Speed and
 * never provokes; a Rush ❸ is five times your Speed in a straight line, less your Load Strain. Six
 * actions a round, one Maneuver per Opportunity. So a drag across the map is not one decision but
 * up to six, and Foundry already measures the path and highlights the squares it crosses; this
 * colours those squares by which Move pays for them, so a player can see where an action runs out
 * and stop there rather than discover it after the token has landed.
 *
 * Pale mint is a Step. Then one colour per Move, gold first, six in all. Orange is a Rush: the
 * whole straight line for three actions. Red is past what you have left to spend.
 *
 * The count is taken **from where the drag began**, against the actions you have **remaining** at
 * your own Opportunity, not from the start of the round against a full six. Movement already made
 * has already been charged (see `documents/actions.mjs`), so counting it twice would be wrong.
 * Outside an encounter, or at someone else's Opportunity, the full six is assumed.
 *
 * Nothing here prevents anything, in keeping with the rest of the system: the red squares are a
 * warning, the drop still lands, and the overspend is announced in chat.
 */

import * as SW from "../config.mjs";
import { movementNumbers, classifyMove } from "../documents/actions.mjs";
import { setting } from "../documents/combat.mjs";

/** One colour per Move, first to sixth. Gold first. */
const MOVE_COLORS = [0xE3B23C, 0x4FA45C, 0x5B9BD5, 0x9B6BD6, 0x2FA39A, 0xC94C8A];

/** Within a Step. */
const STEP_COLOR = 0xBFE3DA;

/** A straight line paid for as one Rush. */
const RUSH_COLOR = 0xE0662F;

/** Past what you have left to spend. */
const OVER_BUDGET = 0xB4453F;

/**
 * Install the system's ruler.
 *
 * It extends whatever is configured rather than a fixed class, so it composes with a module that
 * has already replaced the ruler instead of quietly discarding that module's work.
 */
export function registerMoveRuler() {
  const Base = CONFIG.Token.rulerClass;

  class SwTokenRuler extends Base {

    /** Colour each highlighted square by the Move that pays for it. */
    _getGridHighlightStyle(waypoint, offset) {
      const base = super._getGridHighlightStyle(waypoint, offset);
      const color = this.#colorAt(waypoint);
      // An alpha of zero is core's way of saying "do not draw this square at all".
      if ((color === null) || !base || (base.alpha === 0)) return base;
      return { ...base, color };
    }

    /** And the ruler line along with them, so the two never disagree. */
    _getSegmentStyle(waypoint) {
      const base = super._getSegmentStyle(waypoint);
      const color = this.#colorAt(waypoint);
      if ((color === null) || !base || !base.width) return base;
      return { ...base, color };
    }

    /** Say what the move costs in actions, next to what it costs in feet. */
    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context?.cost) return context;
      const move = this.#moveAt(waypoint);
      if (!move) return context;
      context.cost.total = `${context.cost.total} ${labelFor(move)}`;
      return context;
    }

    /* -------------------------------------------- */

    /**
     * How this drag pays for reaching a waypoint: a Step, the nth Move, a Rush, or the nth Crawl
     * when the token is Prone and cannot Stand. Null when the bands are switched off, nothing has
     * been travelled yet, or the token has nothing to measure against.
     */
    #moveAt(waypoint) {
      if (!setting("showMoveBands", true)) return null;
      const actor = this.token?.actor;
      if (!actor?.system) return null;
      const measurement = waypoint.measurement;
      if (!measurement) return null;

      const cost = Number.isFinite(measurement.cost) ? measurement.cost : measurement.distance;
      if (!Number.isFinite(cost)) return null;

      // Foundry builds one path per movement, history first, and the waypoints carry their
      // cumulative cost from the very start. Count from where this drag began instead.
      const start = dragStart(waypoint);
      const startCost = Number.isFinite(start.measurement?.cost) ? start.measurement.cost : (start.measurement?.distance ?? 0);
      const travelled = cost - startCost;
      if (travelled <= 0) return null;
      const distance = measurement.distance - (start.measurement?.distance ?? 0);

      // Difficult terrain costs more than its length, and a Step cannot enter it.
      const terrain = travelled > distance + 0.01;
      const straight = isStraight(start, waypoint, distance);
      return { ...classifyMove(travelled, movementNumbers(actor), { terrain, straight }), feet: travelled };
    }

    /** The colour a waypoint's squares should take, or null to leave core's alone. */
    #colorAt(waypoint) {
      const move = this.#moveAt(waypoint);
      if (!move) return null;
      if (move.actions > actionsLeft(this.token)) return OVER_BUDGET;
      if (move.kind === "step") return STEP_COLOR;
      if (move.kind === "rush") return RUSH_COLOR;
      return MOVE_COLORS[Math.min(move.moves, MOVE_COLORS.length) - 1];
    }
  }

  CONFIG.Token.rulerClass = SwTokenRuler;
}

/** The name `starwrought.mjs` imports this under; the ruler colours Moves now, not Strides. */
export { registerMoveRuler as registerStrideRuler };

/* -------------------------------------------- */

/**
 * Where this drag began: the last waypoint of the movement already made, or the first waypoint of
 * the path when there is no history. Its measurement is what to count from.
 */
function dragStart(waypoint) {
  let w = waypoint;
  while (w.previous) {
    if (w.previous.stage === "passed") return w.previous;
    w = w.previous;
  }
  return w;
}

/** Is the path from the drag's start to this waypoint one straight line? Exact diagonals are straight. */
function isStraight(start, waypoint, distance) {
  if (!start?.center || !waypoint?.center) return false;
  try {
    const direct = canvas.grid.measurePath([start.center, waypoint.center]).distance;
    return distance <= direct + 0.05;
  } catch {
    return false;
  }
}

/**
 * The label's action glyphs: "❶ Step", "❶", "❶×2", "❸ Rush", "❶×2 Crawl", and a hint when a Rush
 * would be cheaper.
 */
function labelFor(move) {
  const g = SW.ACTION_GLYPHS;
  if (move.kind === "step") return `${g[1]} ${game.i18n.localize("STARWROUGHT.Actions.stepTitle")}`;
  if (move.kind === "rush") return `${g[3]} ${game.i18n.localize("STARWROUGHT.Actions.rushTitle")}`;
  const glyph = move.moves > 1 ? `${g[1]}×${move.moves}` : g[1];
  if (move.kind === "crawl") return `${glyph} ${game.i18n.localize("STARWROUGHT.Actions.crawlTitle")}`;
  if (!move.rushInstead) return glyph;
  return `${glyph} (${g[3]} ${game.i18n.localize("STARWROUGHT.Actions.rushTitle")}?)`;
}

/**
 * How many actions the mover still has to spend on this.
 * The full six (or the creature's own count) whenever the question does not apply: no encounter,
 * not this token's Opportunity, or tracking switched off. The ruler is then showing what a round's
 * worth of movement would look like.
 */
function actionsLeft(token) {
  const actor = token?.actor;
  const full = Number(actor?.system?.actionsPerRound) || SW.ACTIONS_PER_ROUND;
  if (!actor?.system?.actions) return full;
  if (!setting("trackActions", true)) return full;
  const combat = game.combat;
  if (!combat?.started) return full;
  const current = combat.combatant;
  const mine = current && ((current.tokenId === token.id) || (!current.tokenId && (current.actor?.id === actor.id)));
  if (!mine) return full;
  return Math.max(0, Number(actor.system.actions.value) || 0);
}
