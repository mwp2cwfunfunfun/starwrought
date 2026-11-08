/**
 * Actions: six a round, the cost glyphs the handbook prints, the cost keys and their v3.x
 * migration, the parser that reads a cost out of a Maneuver's name, and the glyph renderer.
 * `parseActionCost` is the build's as much as the client's (assets/build_foundry.mjs).
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * PHB v4.10: every combatant receives six actions at the start of each round; they expire at the
 * end of it. Play cycles through the initiative order and each visit is an Opportunity: one
 * Maneuver you can afford, or Pass. A full circuit of Passes ends the round. Reactions are paid
 * from the same six. A Maneuver of three or more actions is Prepared: PREPARE_SPEND actions now,
 * the rest reserved, resolved at your next Opportunity.
 */
export const ACTIONS_PER_ROUND = 6;
/**
 * The most actions a round the system counts (0.10.1): the ceiling of the data model's fields, the
 * adversary's own number, a character's six plus the sheet's adjustment, and the pips. PHB v4.10:
 * "some creatures have more or fewer"; nothing in the book reaches twelve, and the glyph table
 * below ends there.
 */
export const ACTIONS_MAX = 12;
/** A Maneuver costing this many actions or more is Prepared. */
export const PREPARED_THRESHOLD = 3;
/**
 * The actions spent as a Prepared Maneuver begins; the rest of its cost is reserved until the next
 * Opportunity. PHB v4.24 (Chapter 2, Reactions and Preparation; the Prepared trait): "You begin it
 * at one Opportunity by spending two actions and reserving the rest." Through 0.19.0 it was one
 * (PHB v4.10 to v4.21); Mike's decision of 2026-11-08 (ruling 205) follows the two sentences the
 * v4.24 edition changed, and Chapter 4's "Spend one now" is redlined to match.
 */
export const PREPARE_SPEND = 2;

/**
 * The action glyphs the handbook prints (PHB v4.10, Symbols): ⓿ is free, ❶ to ❻ a cost; ↺ marks
 * the Reaction trait. ❼ to ⓬ are the system's own, for the seventh to twelfth pip of a combatant
 * with more than six actions (0.10.1); no cost in the book is above ❸.
 */
export const ACTION_GLYPHS = Object.freeze({
  0: "⓿", 1: "❶", 2: "❷", 3: "❸", 4: "❹", 5: "❺", 6: "❻",
  7: "❼", 8: "❽", 9: "❾", 10: "❿", 11: "⓫", 12: "⓬"
});
export const REACTION_GLYPH = "↺";

/**
 * Action costs. `passive` is a Talent that is not something you do (no glyph at all); `0` is a
 * free Maneuver ⓿, which never uses up your Opportunity. The Reaction trait is a separate flag on
 * the Item (`system.reaction`), since a Reaction has a cost of its own: Parry is ❶↺, a Posture ⓿↺.
 */
export const ACTION_COSTS = Object.freeze({
  passive: { label: "STARWROUGHT.Action.passive", glyph: "", value: 0 },
  0: { label: "STARWROUGHT.Action.free", glyph: "⓿", value: 0 },
  1: { label: "STARWROUGHT.Action.one", glyph: "❶", value: 1 },
  2: { label: "STARWROUGHT.Action.two", glyph: "❷", value: 2 },
  3: { label: "STARWROUGHT.Action.three", glyph: "❸", value: 3 },
  4: { label: "STARWROUGHT.Action.four", glyph: "❹", value: 4 },
  5: { label: "STARWROUGHT.Action.five", glyph: "❺", value: 5 },
  6: { label: "STARWROUGHT.Action.six", glyph: "❻", value: 6 }
});

/**
 * The v3.x cost keys, mapped onto v4.10's. "free" is ⓿; "reaction" was a free reaction slot, so it
 * is ⓿ with the Reaction trait; "0" on a Talent meant passive.
 */
export const LEGACY_ACTION_COSTS = Object.freeze({
  free: { cost: "0", reaction: false },
  reaction: { cost: "0", reaction: true }
});

/** The number of actions a cost key stands for. */
export function actionCostValue(key) {
  return ACTION_COSTS[key]?.value ?? 0;
}

const COST_TOKEN = /[⓿❶❷❸❹❺❻]|◆+|◇/g;
const tokenValue = token => {
  if (token === "⓿" || token === "◇") return 0;
  if (token[0] === "◆") return Math.min(6, token.length);
  return "❶❷❸❹❺❻".indexOf(token) + 1;
};

/**
 * Read a Maneuver's cost out of the glyphs the handbook prints in its name.
 *
 * Several Maneuvers cost a range rather than a number, and the handbook writes both ends into the
 * name: "Strike ❶ to ❸" is one action to three, and "Disarm ❶ or ❸" is one or three with nothing
 * in between. ↺ is the Reaction trait and rides beside a cost ("Parry ❶↺", "Battle Cry ⓿↺"). The
 * v3.x glyphs ◆ (one action per diamond) and ◇ (free) still parse, so older data converts.
 *
 * @param {string} name
 * @returns {{cost: string, costMax: string, costMode: "to"|"or", reaction: boolean}}
 */
export function parseActionCost(name) {
  let text = String(name ?? "");
  // "Aid ❶ (⓿↺)": the Maneuver costs ❶ and its Reaction half costs ⓿. The bracketed part is the
  // Reaction's own cost, not the far end of a range.
  let reactionCost = "";
  const bracketed = text.match(/\(([^)]*)\)/);
  if (bracketed && COST_TOKEN.test(bracketed[1])) {
    COST_TOKEN.lastIndex = 0;
    const inner = bracketed[1].match(COST_TOKEN) ?? [];
    if (inner.length) reactionCost = String(tokenValue(inner[0]));
    text = text.replace(bracketed[0], " ");
  }
  COST_TOKEN.lastIndex = 0;
  const reaction = String(name ?? "").includes(REACTION_GLYPH);
  const tokens = text.match(COST_TOKEN) ?? [];
  if (!tokens.length) {
    // A bare ↺ (v3.x "Aid ↺") was a free reaction; no glyph at all is a passive Talent.
    return { cost: reaction ? "0" : "passive", costMax: "", costMode: "to", reaction, reactionCost };
  }
  const min = String(tokenValue(tokens[0]));
  if (tokens.length === 1) return { cost: min, costMax: "", costMode: "to", reaction, reactionCost };
  const max = String(tokenValue(tokens[tokens.length - 1]));
  return {
    cost: min,
    costMax: max === min ? "" : max,
    // Only an "or" between two glyphs is a cost joiner; one in the name is not.
    costMode: /(?:[⓿❶❷❸❹❺❻◇]|◆+)\s*or\s*(?:[⓿❶❷❸❹❺❻◇]|◆+)/i.test(text) ? "or" : "to",
    reaction,
    reactionCost
  };
}

/** Render a cost the way the handbook prints it: "❶", "❶ to ❸", "❶ or ❸", "❶↺", "⓿↺", "❶ (⓿↺)". */
export function costGlyphs({ cost, costMax = "", costMode = "to", reaction = false, reactionCost = "" } = {}) {
  const min = ACTION_COSTS[cost]?.glyph ?? "";
  const max = costMax && costMax !== cost ? (ACTION_COSTS[costMax]?.glyph ?? "") : "";
  const range = max ? `${min} ${costMode === "or" ? "or" : "to"} ${max}` : min;
  if (!reaction) return range.trim();
  // A Maneuver whose Reaction half has a cost of its own prints both, as Aid does.
  if (reactionCost !== "" && reactionCost !== cost) {
    return `${range} (${ACTION_COSTS[reactionCost]?.glyph ?? ""}${REACTION_GLYPH})`.trim();
  }
  return `${range}${REACTION_GLYPH}`.trim();
}
