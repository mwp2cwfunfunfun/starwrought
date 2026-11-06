/**
 * CHARACTER EFFECTS (0.16.0): the writes behind the sheet's Effects panel, in the spirit of Fantasy
 * Grounds' Character Effects (Mike's ask): the state switch on every rule line a character
 * carries, and the custom effects a player or the GM types in the grammar.
 *
 * The engine (./engine.mjs) reads both and writes nothing: `rulesOfKind` applies the state, the
 * dispatchers drop a Skip line's answer once and ask for its state to clear, `collectRules`
 * indexes a custom effect's lines through `effectCarrier`. This module is the one writer of
 *
 *   flags.starwrought.rules.state.<carrier id>:<line> = "skip" | "off"    (absent: on)
 *   system.effects[] = { id, label, text, duration, rules }               (the character's rows)
 *
 * and the marks `writeRuleMarks` (./scene.mjs) hands it: `per: "state"` clears a Skip once the roll
 * it was skipped on resolves, `per: "effect"` removes a one-roll effect. An encounter effect goes
 * with the Combat (`registerEffectsHooks`, the `deleteCombat` hook, on each character's responsible
 * client). Parsing on write is `prepareEffectsUpdate`, called from `SwActor#_preUpdate` as
 * `SwItem#_preUpdate` parses a Talent's textarea: the text always saves, a line that does not parse
 * is stored as an error entry the panel shows in red, and nothing is refused (ruling 118).
 *
 * Like ./claims.mjs, a small flag-writing module. Foundry globals only inside functions.
 */

import { parseAutomation, ruleEntries } from "./grammar.mjs";
import { resolveRuleTarget } from "../helpers/content.mjs";
import { responsibleFor } from "../helpers/authority.mjs";
import { EFFECT_DURATIONS, ruleStates } from "./engine.mjs";
import { flagKey } from "../config.mjs";

/** The three states, in the order the switch cycles them. */
export const RULE_STATES = Object.freeze(["on", "skip", "off"]);

/** The flag path under which a line's state lives on its owner. */
const STATE_PATH = "flags.starwrought.rules.state";

/** The flag path of an armed claim (module/rules/claims.mjs writes it; a row's is cleared with the row). */
const ARMED_PATH = "flags.starwrought.rules.armed";

/* -------------------------------------------- */
/*  The state switch                            */
/* -------------------------------------------- */

/**
 * The state of one line on an actor, by its state key (`ruleStateKey` in ./engine.mjs).
 * @param {object} actor
 * @param {string} key
 * @returns {"on"|"skip"|"off"}
 */
export function stateOf(actor, key) {
  const state = ruleStates(actor)[flagKey(key)];
  return RULE_STATES.includes(state) ? state : "on";
}

/**
 * Set a line's state. The owner or a GM writes; anyone else is told. Says nothing in chat: a
 * state is a private intention, the roll's card is the record of what applied.
 * @param {object} actor
 * @param {string} key
 * @param {"on"|"skip"|"off"} state
 * @returns {Promise<string|null>}  The state written, or null when refused.
 */
export async function setRuleState(actor, key, state) {
  if (!actor || !key || !RULE_STATES.includes(state)) return null;
  if (!(actor.isOwner || game.user.isGM)) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const safe = flagKey(key);
  if (stateOf(actor, safe) === state) return state;
  const update = (state === "on")
    ? { [`${STATE_PATH}.-=${safe}`]: null }
    : { [`${STATE_PATH}.${safe}`]: state };
  await actor.update(update, { swAnnounced: true });
  return state;
}

/** On to Skip to Off to On: the panel's one control per line. */
export async function cycleRuleState(actor, key) {
  const now = stateOf(actor, key);
  const next = RULE_STATES[(RULE_STATES.indexOf(now) + 1) % RULE_STATES.length];
  return setRuleState(actor, key, next);
}

/* -------------------------------------------- */
/*  The marks                                   */
/* -------------------------------------------- */

/**
 * The update entries for the marks of this module's two kinds on one actor: a `state` mark deletes
 * the line's state (a Skip spent), an `effect` mark removes the one-roll effect's row. Every other
 * mark is `writeRuleMarks`' own and is left alone. Pure over the actor; the caller writes.
 * @param {object} actor
 * @param {Array<{key: string, per: string}>} marks
 * @returns {object}  Entries for `actor.update`.
 */
export function markUpdates(actor, marks) {
  const update = {};
  const states = ruleStates(actor);
  const spent = new Set();
  for (const mark of marks ?? []) {
    if (!mark?.key) continue;
    const safe = flagKey(mark.key);
    if ((mark.per === "state") && (states[safe] !== undefined)) update[`${STATE_PATH}.-=${safe}`] = null;
    else if (mark.per === "effect") spent.add(String(mark.key));
  }
  if (spent.size) {
    const rows = effectsOf(actor);
    const kept = rows.filter(e => !spent.has(String(e.id)));
    if (kept.length !== rows.length) {
      update["system.effects"] = kept;
      Object.assign(update, rowFlagDeletions(actor, rows.filter(e => spent.has(String(e.id)))));
    }
  }
  return update;
}

/**
 * The flag entries that go with custom effect rows when the rows go (0.18.1): each line's state
 * and the carrier's armed claim, which through 0.18.0 outlived a removed or spent row.
 * @param {object} actor
 * @param {Array<{id: string}>} rows  The rows leaving.
 * @returns {object}  Entries for `actor.update`.
 */
function rowFlagDeletions(actor, rows) {
  const update = {};
  if (!rows.length) return update;
  const prefixes = rows.map(e => `effect:${e.id}:`);
  for (const key of Object.keys(ruleStates(actor))) {
    if (prefixes.some(prefix => key.startsWith(prefix))) update[`${STATE_PATH}.-=${key}`] = null;
  }
  const armed = actor?.flags?.starwrought?.rules?.armed ?? {};
  for (const row of rows) {
    const key = flagKey(`effect:${row.id}`);
    if (armed[key] !== undefined) update[`${ARMED_PATH}.-=${key}`] = null;
  }
  return update;
}

/* -------------------------------------------- */
/*  Custom effects                              */
/* -------------------------------------------- */

/**
 * The stored rows of a character's custom effects, as plain data (the source, never the prepared
 * copy, so a write round-trips byte for byte). Empty for an actor with no such field.
 * @param {object} actor
 * @returns {Array<{id: string, label: string, text: string, duration: string, rules: object[]}>}
 */
export function effectsOf(actor) {
  const source = actor?.system?._source?.effects ?? actor?._source?.system?.effects ?? actor?.system?.effects;
  if (!Array.isArray(source)) return [];
  return source.map(e => foundry.utils.deepClone(e));
}

/**
 * A new row, parsed. The id is Foundry's random one; the duration defaults to `always`.
 * @param {{label?: string, text?: string, duration?: string}} [data]
 */
export function newEffect(data = {}) {
  const row = {
    id: foundry.utils.randomID(),
    label: String(data.label ?? ""),
    text: String(data.text ?? ""),
    duration: EFFECT_DURATIONS.includes(data.duration) ? data.duration : "always",
    rules: []
  };
  row.rules = parseEffectText(row);
  return row;
}

/** The row's `rules` from its `text`, through the grammar with the client's resolver (ruling 120). */
export function parseEffectText(row) {
  const parsed = parseAutomation(String(row?.text ?? ""), {
    itemName: String(row?.label ?? "").trim() || "Custom effect",
    constellation: "",
    itemType: "effect",
    source: "effect",
    resolve: resolveRuleTarget
  });
  return ruleEntries(parsed);
}

/**
 * Add a custom effect to a character. The owner or a GM writes.
 * @param {object} actor
 * @param {{label?: string, text?: string, duration?: string}} [data]
 * @returns {Promise<object|null>}  The row added, or null when refused.
 */
export async function addEffect(actor, data = {}) {
  if (!actor || !Array.isArray(actor.system?.effects)) return null;
  if (!(actor.isOwner || game.user.isGM)) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const row = newEffect(data);
  await actor.update({ "system.effects": [...effectsOf(actor), row] }, { swAnnounced: true });
  return row;
}

/**
 * Remove a custom effect by its row id, with any state its lines held. The owner or a GM writes.
 * @param {object} actor
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function removeEffect(actor, id) {
  if (!actor || !id) return false;
  if (!(actor.isOwner || game.user.isGM)) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    return false;
  }
  const rows = effectsOf(actor);
  const kept = rows.filter(e => String(e.id) !== String(id));
  if (kept.length === rows.length) return false;
  const update = { "system.effects": kept, ...rowFlagDeletions(actor, rows.filter(e => String(e.id) === String(id))) };
  await actor.update(update, { swAnnounced: true });
  return true;
}

/**
 * Parse on write (`SwActor#_preUpdate`): when an update touches `system.effects`, every row's
 * `rules` is rewritten from its `text` through the grammar, as `SwItem#_preUpdate` does for a
 * Talent's textarea. The rows may arrive as the sheet's form sends them, an object with numeric
 * keys that Foundry's ArrayField has already cast to an array by the time the diff reaches here,
 * or as an array a macro passed; either way a row missing its id (a hand-typed update) gets one,
 * a row missing a field keeps the stored row's by id, and the text always saves. A row whose text
 * is the stored row's keeps the stored rules rather than parsing again (0.18.1): a one-roll spend
 * or a Remove touches `system.effects` without changing any surviving row's text.
 * @param {object} actor
 * @param {object} changes  The update's differential, which is edited in place.
 */
export function prepareEffectsUpdate(actor, changes) {
  const flat = Object.hasOwn(changes ?? {}, "system.effects");
  let rows = flat ? changes["system.effects"] : foundry.utils.getProperty(changes, "system.effects");
  if (rows === undefined || rows === null) return;
  if (!Array.isArray(rows)) {
    if (typeof rows !== "object") return;
    rows = Object.entries(rows).filter(([k]) => Number.isInteger(Number(k))).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v);
  }
  const current = new Map(effectsOf(actor).map(e => [String(e.id), e]));
  const seen = new Set();
  const next = [];
  for (const given of rows) {
    if (!given || (typeof given !== "object")) continue;
    const base = given.id ? (current.get(String(given.id)) ?? {}) : {};
    const row = {
      id: String(given.id ?? base.id ?? "") || foundry.utils.randomID(),
      label: String(given.label ?? base.label ?? ""),
      text: String(given.text ?? base.text ?? ""),
      duration: EFFECT_DURATIONS.includes(given.duration ?? base.duration) ? (given.duration ?? base.duration) : "always"
    };
    if (seen.has(row.id)) row.id = foundry.utils.randomID();
    seen.add(row.id);
    const unchanged = (row.id === String(base.id ?? "")) && (row.text === String(base.text ?? "")) && (row.label === String(base.label ?? "")) && Array.isArray(base.rules);
    row.rules = unchanged ? base.rules : parseEffectText(row);
    next.push(row);
  }
  if (flat) changes["system.effects"] = next;
  else foundry.utils.setProperty(changes, "system.effects", next);
}

/* -------------------------------------------- */
/*  The encounter's end                         */
/* -------------------------------------------- */

/**
 * The Combat is gone: every character who fought in it loses the custom effects that lasted the
 * encounter. Every client hears `deleteCombat`; the one that writes to each character is its
 * responsible client (the active GM, else its first active owner; helpers/authority.mjs), the
 * pattern the round's hooks use, so a table with no GM still clears them and nothing is written
 * twice. Nothing is said in chat: the effect was the player's note to the system, not an event.
 * @param {Combat} combat
 */
export async function endEncounterEffects(combat) {
  const actors = new Set();
  for (const combatant of combat?.combatants ?? []) {
    if (combatant?.actor) actors.add(combatant.actor);
  }
  for (const actor of actors) {
    try {
      if (!Array.isArray(actor.system?.effects) || !responsibleFor(actor)) continue;
      const rows = effectsOf(actor);
      const kept = rows.filter(e => e.duration !== "encounter");
      if (kept.length === rows.length) continue;
      const update = { "system.effects": kept, ...rowFlagDeletions(actor, rows.filter(e => e.duration === "encounter")) };
      await actor.update(update, { swAnnounced: true });
    } catch (error) {
      console.error(`STARWROUGHT | the encounter effects on ${actor?.name ?? "an actor"} could not be cleared:`, error);
    }
  }
}

let registered = false;

/** Register the one hook: an encounter effect ends with its Combat. Idempotent; called once at ready. */
export function registerEffectsHooks() {
  if (registered) return;
  registered = true;
  Hooks.on("deleteCombat", combat => { endEncounterEffects(combat); });
}
