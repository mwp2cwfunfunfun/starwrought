/**
 * The drag ruler, coloured by Strides.
 *
 * A Stride carries you up to your Speed for one action, so a drag across the map is not one
 * decision but up to three. Foundry already measures the path and highlights the squares it crosses;
 * this colours those squares by which action pays for them, so a player can see where their first
 * action runs out and stop there rather than discover it after the token has landed.
 *
 * Green is your first Stride, gold your second, orange your third. Red is past what you have left.
 *
 * The count is taken **from where the drag began**, against the actions you have **remaining**, not
 * from the start of the turn against a full three. Movement already made this turn has already been
 * charged (see `documents/actions.mjs`), so counting it twice would be wrong. Outside an encounter,
 * or on someone else's turn, a full three is assumed.
 *
 * Nothing here prevents anything, in keeping with the rest of the system: the red squares are a
 * warning, the drop still lands, and the overspend is announced in chat.
 */

import * as SW from "../config.mjs";

/** First, second and third Stride. */
const STRIDE_COLORS = [0x4FA45C, 0xE3B23C, 0xD1762F];

/** Past what you have left to spend. */
const OVER_BUDGET = 0xB4453F;

/**
 * Install the system's ruler.
 *
 * It extends whatever is configured rather than a fixed class, so it composes with a module that
 * has already replaced the ruler instead of quietly discarding that module's work.
 */
export function registerStrideRuler() {
  const Base = CONFIG.Token.rulerClass;

  class SwTokenRuler extends Base {

    /** Colour each highlighted square by the action that pays for it. */
    _getGridHighlightStyle(waypoint, offset) {
      const base = super._getGridHighlightStyle(waypoint, offset);
      const style = this.#strideStyle(waypoint);
      // An alpha of zero is core's way of saying "do not draw this square at all".
      if (!style || !base || (base.alpha === 0)) return base;
      return { ...base, color: style };
    }

    /** And the ruler line along with them, so the two never disagree. */
    _getSegmentStyle(waypoint) {
      const base = super._getSegmentStyle(waypoint);
      const style = this.#strideStyle(waypoint);
      if (!style || !base || !base.width) return base;
      return { ...base, color: style };
    }

    /** Say what the move costs in actions, next to what it costs in feet. */
    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context?.cost) return context;
      const stride = this.#strideOf(waypoint);
      if (!stride) return context;
      context.cost.total = `${context.cost.total} ${"◆".repeat(Math.min(stride, 3))}${
        stride > 3 ? `+${stride - 3}` : ""}`;
      return context;
    }

    /* -------------------------------------------- */

    /**
     * Which Stride of this drag reaches a waypoint: 1 for the first, 2 for the second, and so on.
     * Null when the bands are switched off or the token has nothing to measure against.
     */
    #strideOf(waypoint) {
      if (!game.settings.get(SW.SYSTEM_ID, "showStrideBands")) return null;
      const actor = this.token?.actor;
      if (!actor?.system) return null;
      const speed = Math.max(1, actor.system.speed ?? 0);

      const cost = waypoint.measurement?.cost ?? waypoint.measurement?.distance;
      if (!Number.isFinite(cost)) return null;
      const travelled = cost - historyCost(waypoint);
      if (travelled <= 0) return 0;

      // A Stride is up to your Speed, so the boundary foot belongs to the Stride that reached it.
      return Math.max(1, Math.ceil((travelled / speed) - 1e-6));
    }

    /** The colour a waypoint's squares should take, or null to leave core's alone. */
    #strideStyle(waypoint) {
      const stride = this.#strideOf(waypoint);
      if (!stride) return null;
      if (stride > actionsLeft(this.token.actor)) return OVER_BUDGET;
      return STRIDE_COLORS[Math.min(stride, STRIDE_COLORS.length) - 1];
    }
  }

  CONFIG.Token.rulerClass = SwTokenRuler;
}

/* -------------------------------------------- */

/**
 * What the path had already cost before this drag began.
 *
 * Foundry builds one path per movement, history first, and hands the highlighter everything after
 * the history. The waypoints still carry their cumulative cost from the very start, so the movement
 * already made has to be taken back off to count Strides from where the token is standing now.
 */
function historyCost(waypoint) {
  for (let w = waypoint; w; w = w.previous) {
    if (w.stage === "passed") return w.measurement?.cost ?? 0;
  }
  return 0;
}

/**
 * How many actions the mover still has to spend on this.
 * Three whenever the question does not apply: no encounter, not their turn, or tracking switched
 * off. The ruler is then just showing what a full turn of movement would look like.
 */
function actionsLeft(actor) {
  if (!actor?.system?.actions) return 3;
  if (!game.settings.get(SW.SYSTEM_ID, "trackActions")) return 3;
  if (!actor.inEncounter || !actor.isTurn) return 3;
  return actor.system.actions.value ?? 0;
}
