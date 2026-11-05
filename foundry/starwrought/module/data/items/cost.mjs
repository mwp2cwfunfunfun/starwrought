/**
 * The action cost of a Talent or an action: its fields, the v3.x migration, and the glyph and
 * label derived from it. Used by talent.mjs and action.mjs.
 */

import * as SW from "../../config.mjs";

const fields = foundry.data.fields;

/**
 * The action cost of a Talent or an Action (PHB v4.10, Symbols). Costs run ⓿ to ❻ and are stored
 * as the strings "0" to "6"; "passive" is a Talent that is not something you do. Several cost a
 * range rather than a number, and the two ends are not always continuous: Strike is one action to
 * three, Disarm is one or three. The Reaction trait ↺ is a flag of its own, because a Reaction
 * still has a cost (Parry is ❶↺, a Posture ⓿↺), and a Maneuver whose Reaction half costs
 * something different carries that in `reactionCost` (Aid is ❶, or ⓿↺).
 */
export function costFields(initial = "1") {
  return {
    cost: new fields.StringField({
      required: true, choices: Object.keys(SW.ACTION_COSTS), initial
    }),
    /** The upper end, when there is one. Blank means the cost is fixed. */
    costMax: new fields.StringField({
      required: false, blank: true, choices: [...Object.keys(SW.ACTION_COSTS), ""], initial: ""
    }),
    /** "to" for a continuous range, "or" when only the two ends are legal. */
    costMode: new fields.StringField({
      required: true, choices: ["to", "or"], initial: "to"
    }),
    /** The Reaction trait: performed outside your Opportunity, paid from the same six actions. */
    reaction: new fields.BooleanField({ initial: false }),
    /** The Reaction half's own cost, when it differs from `cost`. Blank means the same. */
    reactionCost: new fields.StringField({
      required: false, blank: true, choices: [...Object.keys(SW.ACTION_COSTS), ""], initial: ""
    })
  };
}

/**
 * v3.x cost keys to v4.10. "free" was ⓿; "reaction" was a free reaction slot, so it is ⓿ with the
 * Reaction trait; and a Talent's "0" meant passive (an Action's "0" is a free Maneuver and stays,
 * except for the Exploration Mode and Downtime Mode Activities, which 0.3.7 built with "0" to mean
 * "no glyph": a ten-minute Search or a week's Retraining is not a free Maneuver).
 * A v3.x source never carried the `reaction` flag, which is how one is told from new data: a
 * Talent built by v4.10 with cost "0" is a free Maneuver and arrives with `reaction` set.
 * @param {object} source
 * @param {"talent"|"action"} type
 */
export function migrateCost(source, type) {
  if (source.reaction !== undefined) return source;
  let reaction = false;
  if (source.cost !== undefined) {
    const original = String(source.cost);
    const legacy = SW.LEGACY_ACTION_COSTS[original];
    const activity = /^(Exploration|Downtime) Mode$/.test(source.category ?? "");
    if (legacy) {
      source.cost = legacy.cost;
      reaction = legacy.reaction;
    } else if ((original === "0") && ((type === "talent") || activity)) {
      source.cost = "passive";
    }
  }
  if (source.costMax !== undefined && source.costMax !== "") {
    const legacy = SW.LEGACY_ACTION_COSTS[String(source.costMax)];
    if (legacy) {
      source.costMax = legacy.cost;
      reaction ||= legacy.reaction;
    }
  }
  source.reaction = reaction;
  source.reactionCost ??= "";
  return source;
}

/**
 * Glyph and label for a cost, as the handbook prints it: "❶", "❶ to ❸", "❶ or ❸", "❶↺", "⓿↺",
 * "❶ (⓿↺)"; and in words for a tooltip.
 * @param {object} system  Anything carrying cost, costMax, costMode, reaction and reactionCost.
 */
export function prepareCost(system) {
  system.glyph = SW.costGlyphs(system);
  const words = key => game.i18n.localize(SW.ACTION_COSTS[key]?.label ?? "");
  let label = words(system.cost);
  if (system.costMax && (system.costMax !== system.cost)) {
    const joiner = game.i18n.localize(system.costMode === "or"
      ? "STARWROUGHT.Action.joinOr"
      : "STARWROUGHT.Action.joinTo");
    label = `${label} ${joiner} ${words(system.costMax)}`;
  }
  if (system.reaction) {
    label = (system.reactionCost !== "" && system.reactionCost !== system.cost)
      ? game.i18n.format("STARWROUGHT.Action.withReactionCost", { cost: label, reaction: words(system.reactionCost) })
      : game.i18n.format("STARWROUGHT.Action.withReaction", { cost: label });
  }
  system.costLabel = label;
  system.costValue = SW.actionCostValue(system.cost);
}
