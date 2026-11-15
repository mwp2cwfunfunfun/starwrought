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
import { EFFECT_DURATIONS, ruleStates, givenResults } from "./engine.mjs";
import { flagKey, SYSTEM_ID } from "../config.mjs";
// 0.22.0: a result a Maneuver gave, pending on its recipient (./given.mjs is the pure half).
import { settle, isGivenKey, givenFlagKey } from "./given.mjs";
// 0.24.0: the record of a Move made as part of a Maneuver, which ends with its Opportunity.
import { MOVE_RECORD_FLAG, MOVE_USED_FLAG, recordLive } from "./maneuver-move.mjs";

/** The three states, in the order the switch cycles them. */
export const RULE_STATES = Object.freeze(["on", "skip", "off"]);

/** The flag path under which a line's state lives on its owner. */
const STATE_PATH = "flags.starwrought.rules.state";

/** The flag path of an armed claim (module/rules/claims.mjs writes it; a row's is cleared with the row). */
const ARMED_PATH = "flags.starwrought.rules.armed";

/** The flag path of the results pending on an actor, one per Maneuver (0.22.0). */
export const GIVEN_PATH = "flags.starwrought.rules.given";

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
    else if ((mark.per === "effect") && isGivenKey(mark.key)) {
      // A pending result used by a roll (0.22.0): its flag goes, as a one-roll row goes.
      const key = givenFlagKey(mark.key);
      if (actor?.flags?.starwrought?.rules?.given?.[key] !== undefined) update[`${GIVEN_PATH}.-=${key}`] = null;
    }
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
/*  Pending results (0.22.0)                    */
/* -------------------------------------------- */

/**
 * Put a pending result on its recipient, replacing the one the same Maneuver left there (one Aid
 * result pending per recipient). The caller has checked that this client may write the actor
 * (documents/cards/give.mjs, the one caller). An entry always carries every key, `until` whole or
 * null, so Foundry's merge of the flag leaves nothing of the entry it replaces.
 * @param {object} actor
 * @param {object} entry  A pending result (./given.mjs, `pendingEntry`).
 */
export async function writeGiven(actor, entry) {
  if (!actor || !entry?.id) return;
  await actor.update({ [`${GIVEN_PATH}.${givenFlagKey(entry.id)}`]: entry }, { swAnnounced: true });
}

/**
 * Remove a pending result by hand. The GM's alone: a player who could strike a penalty an ally's
 * failed Aid left would, and a bonus is given up by not rolling.
 * @param {object} actor
 * @param {string} key  The entry's id (`given:<maneuver>`) or its flag key.
 * @returns {Promise<boolean>}
 */
export async function removeGiven(actor, key) {
  if (!actor || !key) return false;
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Given.removeGm"));
    return false;
  }
  const safe = givenFlagKey(key);
  if (actor.flags?.starwrought?.rules?.given?.[safe] === undefined) return false;
  await actor.update({ [`${GIVEN_PATH}.-=${safe}`]: null }, { swAnnounced: true });
  return true;
}

/**
 * Every Actor that may hold a pending result of this Combat: its combatants' Actors, the Actors of
 * the tokens on its scene (an unlinked token's Actor is in no collection but its token's), and the
 * world's Actors that carry any (a recipient need not be in the fight, or on the scene).
 */
function holdersOf(combat) {
  const seen = new Set();
  const out = [];
  const add = actor => {
    if (!actor || seen.has(actor.uuid)) return;
    seen.add(actor.uuid);
    if (givenResults(actor).length) out.push(actor);
  };
  for (const combatant of combat?.combatants ?? []) add(combatant?.actor);
  for (const token of (combat?.scene ?? globalThis.canvas?.scene)?.tokens ?? []) add(token?.actor);
  for (const actor of globalThis.game?.actors ?? []) add(actor);
  return out;
}

/**
 * A turn changed: settle the windows of the pending results of this Combat (./given.mjs,
 * `settle`). Nothing in the system counts Opportunities, so the count rides on each entry and this
 * is its one writer. Every client hears a turn change; each Actor's responsible client (the active
 * GM, else its first active owner) writes that Actor, as the round's own hooks do. The one turn
 * change no other client hears, a lone fighter's next Opportunity, is told to them by
 * `settleLoneStep` below. Says nothing in chat: a window closing is not an event, and the line
 * leaves the Effects tab.
 * @param {Combat} combat
 * @param {{ended?: string|null, began?: string|null}} change  Combatant ids.
 */
export async function settleGivenResults(combat, change = {}) {
  if (!combat || (!change?.ended && !change?.began)) return;
  for (const actor of holdersOf(combat)) {
    try {
      if (!responsibleFor(actor)) continue;
      const update = {};
      for (const entry of givenResults(actor)) {
        const verdict = settle(entry, { combat: combat.id, ended: change.ended ?? null, began: change.began ?? null });
        if (verdict === "keep") continue;
        const key = givenFlagKey(entry.id);
        if (verdict === "expire") update[`${GIVEN_PATH}.-=${key}`] = null;
        else update[`${GIVEN_PATH}.${key}.until.begun`] = verdict.begun;
      }
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
    } catch (error) {
      console.error(`STARWROUGHT | the pending results on ${actor?.name ?? "an actor"} could not be settled:`, error);
    }
  }
}

/**
 * A Move made as part of a Maneuver ends with the Opportunity its Maneuver was used in (0.24.0;
 * rulings 240 and 244; ./maneuver-move.mjs). The record says which Opportunity that was, but the
 * same combatant comes round again within a round, and a rewind steps back onto one, so the
 * liveness test alone would wake a record nobody used (a free Move for a user who never moved, a
 * second leave for the ally). So every record of the Combat that is NOT of the Opportunity now
 * running is taken off its holder: on every turn change (`current` the combatant whose Opportunity
 * begins, so a record written for it a moment ago is left alone), on a lone fighter's step to
 * itself (`current` null: its last Opportunity ended, whatever the ids say), and when the Combat
 * ends (`ended`, which also takes the "I have moved" marks, kept until then because they are
 * compared by nonce and an early clear would let the ally move twice). Each Actor's responsible
 * client writes, as for the pending results above. Says nothing in chat.
 * @param {Combat} combat
 * @param {{current?: string|null, round?: number|null, ended?: boolean}} [now]
 */
export async function endManeuverMoves(combat, { current = null, round = null, ended = false } = {}) {
  if (!combat) return;
  const encounter = ended ? null : { combat: combat.id, round: round ?? combat.round ?? 0, combatant: current };
  const seen = new Set();
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    try {
      const flags = actor.flags?.[SYSTEM_ID] ?? {};
      const update = {};
      if ((flags[MOVE_RECORD_FLAG] !== undefined) && !recordLive(flags[MOVE_RECORD_FLAG], encounter)) update[`flags.${SYSTEM_ID}.-=${MOVE_RECORD_FLAG}`] = null;
      if (ended && (flags[MOVE_USED_FLAG] !== undefined)) update[`flags.${SYSTEM_ID}.-=${MOVE_USED_FLAG}`] = null;
      if (!Object.keys(update).length || !responsibleFor(actor)) continue;
      await actor.update(update, { swAnnounced: true });
    } catch (error) {
      console.error(`STARWROUGHT | the Maneuver's Move on ${actor?.name ?? "an actor"} could not be cleared:`, error);
    }
  }
}

/** The system socket (starwrought.mjs routes `rules:*` to ./scene.mjs, which hands `rules:step` here). */
const SOCKET = `system.${SYSTEM_ID}`;

/**
 * A lone fighter's next Opportunity (`SwCombat#nextTurn`, when nobody else can take one): the
 * turn steps to the same Combatant and NO Combat update is written, so no other client hears a
 * turn change. One Opportunity of that fighter's ended and its next began all the same, and a
 * window watching it must be settled: this client settles the Actors it is responsible for and
 * tells every other client to do the same for theirs (`rules:step`). Late in a round this is the
 * common step, not a rare one: a fighter with no action left is passed over (0.19.0), so the last
 * one with actions cycles to itself.
 * @param {Combat} combat
 * @param {string} combatantId  The lone holder.
 */
export async function settleLoneStep(combat, combatantId) {
  if (!combat || !combatantId) return;
  await settleGivenResults(combat, { ended: combatantId, began: combatantId });
  // 0.24.0: the Opportunity a Maneuver's Move belonged to has ended, though the ids did not change.
  await endManeuverMoves(combat, { current: null });
  try {
    game.socket.emit(SOCKET, { type: "rules:step", combatId: combat.id, combatantId });
  } catch (error) {
    console.warn("STARWROUGHT | a lone fighter's step could not be told to the other clients:", error);
  }
}

/**
 * `rules:step`, on every other client: settle this client's own Actors for a lone fighter's step.
 * The asker is the server's stamp and must be a GM or own the fighter; the Combat must be running,
 * the fighter must be its current Combatant and nobody else may be able to take an Opportunity,
 * which is what made the step a step to itself. Nothing in the payload but the two ids is read.
 * @param {object} message
 * @param {string} [senderId]  The emitting user's id, supplied by the server.
 */
export async function onStepSocket(message, senderId) {
  const sender = (typeof senderId === "string") ? (game.users.get(senderId) ?? null) : null;
  const combat = game.combats?.get(String(message?.combatId ?? "")) ?? null;
  const combatant = combat?.combatants.get(String(message?.combatantId ?? "")) ?? null;
  if (!sender || !combat?.started || !combatant || (combat.combatant?.id !== combatant.id)) return;
  if (!(sender.isGM || combatant.actor?.testUserPermission(sender, "OWNER"))) return;
  if ((typeof combat.canTakeOpportunity === "function")
    && combat.turns.some(c => (c.id !== combatant.id) && combat.canTakeOpportunity(c))) return;
  await settleGivenResults(combat, { ended: combatant.id, began: combatant.id });
  await endManeuverMoves(combat, { current: null });
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
  // 0.22.0: every window ends with the encounter. A result given in this Combat goes with it,
  // wherever its recipient stands; one given outside any encounter is not this Combat's to end.
  for (const actor of holdersOf(combat)) {
    try {
      if (!responsibleFor(actor)) continue;
      const update = {};
      for (const entry of givenResults(actor)) {
        if (entry.combat && (entry.combat === combat.id)) update[`${GIVEN_PATH}.-=${givenFlagKey(entry.id)}`] = null;
      }
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
    } catch (error) {
      console.error(`STARWROUGHT | the pending results on ${actor?.name ?? "an actor"} could not be cleared:`, error);
    }
  }
  // 0.24.0: a Move made as part of a Maneuver ends with its encounter, and so do the marks that
  // say who has moved for one.
  await endManeuverMoves(combat, { ended: true });
}

let registered = false;

/** Register the one hook: an encounter effect ends with its Combat. Idempotent; called once at ready. */
export function registerEffectsHooks() {
  if (registered) return;
  registered = true;
  Hooks.on("deleteCombat", combat => { endEncounterEffects(combat); });
}
