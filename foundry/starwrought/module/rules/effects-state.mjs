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
// 0.25.0: the used Effect a roll leaves when it uses one up (named Effects, step one).
import { settle, isGivenKey, givenFlagKey, usedEntry, usedLive, usedEffects, isUsedKey, usedFlagKey, resultWords } from "./given.mjs";
// 0.24.0: the record of a Move made as part of a Maneuver, which ends with its Opportunity.
import { MOVE_RECORD_FLAG, MOVE_USED_FLAG, recordLive } from "./maneuver-move.mjs";
// The Bind's two windows (0.27.0), counted on the same change of Opportunity; pure.
import { momentaryStep, MOMENTARY_FLAG, PRESSED_FLAG } from "../combat/bind-rules.mjs";
// 0.32.0: the Effects an APPLY line put on a creature, and their windows (./applied.mjs is the
// pure half; ./effect-list.mjs says what a named Effect is).
import { settleApplied, isAppliedRecord, sameApplication, APPLIED_ICON } from "./applied.mjs";
import { namedEffectOf, conditionOfRef } from "./effect-list.mjs";
import { CONDITIONS, conditionIdOf, plainName, statusEffectId, conditionNameKey, PARTY_TYPE } from "../config.mjs";
// 0.39.0: rounds counted from a moment (./clock.mjs, pure): a window in rounds, and a
// Condition's own value dropping as rounds pass.
import { CLOCK_FLAG, clockOf, clockRuns, fadeOf, tickFade, isRoundWindow } from "./clock.mjs";
// What a creature still counts as once an effect is gone (Off-Guard through Prone, a Torso Wound).
import { conditionSetOf } from "./condition-set.mjs";

/** The three states, in the order the switch cycles them. */
export const RULE_STATES = Object.freeze(["on", "skip", "off"]);

/** The flag path under which a line's state lives on its owner. */
const STATE_PATH = "flags.starwrought.rules.state";

/** The flag path of an armed claim (module/rules/claims.mjs writes it; a row's is cleared with the row). */
const ARMED_PATH = "flags.starwrought.rules.armed";

/** The flag path of the results pending on an actor, one per Maneuver (0.22.0). */
export const GIVEN_PATH = "flags.starwrought.rules.given";

/**
 * The flag path of the used Effects on an actor, one per Maneuver (0.25.0; ./given.mjs, the used
 * Effect): what a roll left when it used up a bonus another creature's Maneuver gave, held until
 * the Opportunity it was left in ends.
 */
export const USED_PATH = "flags.starwrought.rules.used";

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
 *
 * Since 0.25.0 a pending result that a roll uses up may LEAVE a used Effect behind
 * (`flags.starwrought.rules.used.<maneuver>`; ./given.mjs, `usedEntry`), which is what `IF:
 * EFFECT(<Maneuver>, used)` reads. Whether it does is the moment's to say (an encounter, an
 * Opportunity running, the roller's own), so the caller hands the moment in: this function is
 * driven from Node and names no Combat. Every roll that uses a result up passes through here (a
 * check, a blind Strike, a Defense roll, marks relayed to another client), which is why the record
 * is written here and nowhere else. A used Effect is spent in turn by the Maneuver it triggers,
 * through a `per: "effect"` mark of its own (`used:<maneuver>`).
 * @param {object} actor
 * @param {Array<{key: string, per: string}>} marks
 * @param {{combat: string|null, round?: number, combatant?: string|null, own?: boolean}|null} [moment]
 *        The encounter as the marks are written, and whether the Opportunity running is this
 *        actor's own; null (or no Combat) leaves no used Effect.
 * @returns {object}  Entries for `actor.update`.
 */
export function markUpdates(actor, marks, moment = null) {
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
      const entry = actor?.flags?.starwrought?.rules?.given?.[key];
      if (entry !== undefined) {
        update[`${GIVEN_PATH}.-=${key}`] = null;
        // And it may leave the used Effect (0.25.0). Every key is written every time, so Foundry's
        // merge of the flag leaves nothing of an older record of the same Maneuver.
        const used = usedEntry(entry, moment, actor?.uuid ?? "");
        if (used) update[`${USED_PATH}.${usedFlagKey(used.id)}`] = used;
      }
    }
    else if ((mark.per === "effect") && isUsedKey(mark.key)) {
      // A used Effect spent by the Maneuver it triggered (0.25.0; Pay It Forward).
      const key = usedFlagKey(mark.key);
      if (actor?.flags?.starwrought?.rules?.used?.[key] !== undefined) update[`${USED_PATH}.-=${key}`] = null;
    }
    else if (mark.per === "effect") spent.add(String(mark.key));
  }
  // One batch that both leaves a used Effect and spends the one of the same Maneuver would ask
  // Foundry to set and delete one key. No caller builds that batch (the spend is filed before the
  // roll, the roll's own marks after it), and if one ever does, the Effect just left is the newer
  // fact and stands (the review of 2026-11-15).
  for (const path of Object.keys(update)) {
    if (!path.startsWith(`${USED_PATH}.`) || path.startsWith(`${USED_PATH}.-=`)) continue;
    delete update[`${USED_PATH}.-=${path.slice(USED_PATH.length + 1)}`];
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
 * Remove a used Effect by hand (0.25.0). The GM's alone, as a pending result's bin is: it is the
 * record that lets a Maneuver be used, and a player has no reason to strike their own.
 * @param {object} actor
 * @param {string} key  The record's id (`used:<maneuver>`) or its flag key.
 * @returns {Promise<boolean>}
 */
export async function removeUsed(actor, key) {
  if (!actor || !key) return false;
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("STARWROUGHT.Given.removeGm"));
    return false;
  }
  const safe = usedFlagKey(key);
  if (actor.flags?.starwrought?.rules?.used?.[safe] === undefined) return false;
  await actor.update({ [`${USED_PATH}.-=${safe}`]: null }, { swAnnounced: true });
  return true;
}

/* -------------------------------------------- */
/*  What the clock changed, for chat (0.39.0)   */
/* -------------------------------------------- */

/**
 * WHAT THE CLOCK CHANGED (0.39.0; ruling 396). Mike, 2026-11-19: "any time a condition or effect
 * changes, it should show in chat, just like when other things change." Through 0.38.0 every
 * sweep below was silent ("a window closing is not an event"). Now each puts a LINE here for
 * what it ended or lowered, and the caller posts them: one card for each creature and audience
 * (documents/cards/timed.mjs), from the client that made the change, which is one client for
 * each creature (`responsibleFor`), so nothing is said twice.
 *
 * A line is `{ actor, text, from, open }`: `text` is PLAIN (the poster escapes it); `from` is
 * the card that put the thing on, whose audience the line inherits, so a blind roll gives
 * nothing away; `open` says the thing shows on the token for everyone (a Condition, an Effect a
 * Maneuver applied), so the line is the table's unless the token is hidden (ruling 401).
 *
 * The sink is a plain object, so this module still loads in Node, where the self-test imports
 * it: the poster, which needs Foundry, is imported only when there is something to say.
 * @returns {{lines: object[]}}
 */
export function timedLines() {
  return { lines: [] };
}

/** Put one line in a sink. A missing sink, actor or text says nothing. */
export function sayLine(sink, actor, text, { from = null, open = false } = {}) {
  if (!sink || !actor || !text) return;
  sink.lines.push({ actor, text: String(text), from: from ? String(from) : null, open: open === true });
}

/**
 * Post what a sink holds, and empty it. Never throws: a card that cannot be posted is logged,
 * and the change it would have said has already been made.
 * @param {{lines: object[]}} sink
 * @param {{encounter?: boolean}} [options]  The lines are of an encounter's end.
 */
export async function postTimedLines(sink, { encounter = false } = {}) {
  if (!sink?.lines?.length) return;
  const lines = sink.lines.splice(0);
  try {
    const { postTimedChanges } = await import("../documents/cards/timed.mjs");
    await postTimedChanges(lines, { encounter });
  } catch (error) {
    console.error("STARWROUGHT | what the clock changed could not be said in chat:", error);
  }
}

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * WHO SEES A LINE (ruling 401): whoever saw the thing go on. Pure, so the self-test pins it; the
 * poster (documents/cards/timed.mjs) reads the card, the token and the users and asks here.
 *
 *  - `card` is the card that put the thing on: `undefined` when the line names none, `null`
 *    when it names one that is gone, else `{ blind, whisper, author }`. A blind card's line is
 *    the GM's alone; a whispered one's goes to its recipients and its author.
 *  - A hidden token's changes are the GM's alone.
 *  - A thing that shows on the token for everyone (`open`) is the table's.
 *  - A line whose card is GONE, about something that does not show on the token (a result that
 *    was given), goes to the creature's owners and the GM: the card may have been a blind or a
 *    whispered roll, and its degree is not the table's to learn from its ending (the review of
 *    0.39.0). The owners see that result on their own Effects tab already.
 *  - Anything else goes where the creature's other cards go (`table`).
 * @param {{card?: object|null, hidden?: boolean, open?: boolean, gms?: string[], owners?: string[], table?: string[]}} line
 * @returns {string[]}  The users whispered to; an empty list is the table.
 */
export function audienceFor({ card = undefined, hidden = false, open = false, gms = [], owners = [], table = [] } = {}) {
  if (card) {
    if (card.blind) return [...gms];
    const whisper = Array.isArray(card.whisper) ? [...card.whisper] : [];
    if (whisper.length) {
      if (card.author && !whisper.includes(card.author)) whisper.push(card.author);
      return whisper;
    }
  }
  if (hidden) return [...gms];
  if (open) return [];
  if (card === null) return [...owners];
  return [...table];
}

/**
 * Run a sweep with a sink of its own when the caller handed none in, and post what it collected
 * WHATEVER HAPPENS: a throw between two parts of a sweep must not lose the lines of the changes
 * already made (the review of 0.39.0).
 */
async function withSink(sink, options, body) {
  const own = sink ?? timedLines();
  try {
    return await body(own);
  } finally {
    if (!sink) await postTimedLines(own, options);
  }
}

/** Why a thing ended, in words: its rounds, its Opportunity, a value dropped away, the encounter. */
function whyWords(why) {
  return L({ rounds: "STARWROUGHT.Timed.whyRounds", drop: "STARWROUGHT.Timed.whyDrop", dropped: "STARWROUGHT.Timed.whyDropped", encounter: "STARWROUGHT.Timed.whyEncounter" }[why] ?? "STARWROUGHT.Timed.whyWindow");
}

/**
 * Does the creature still count as having a Condition, now that one effect carrying it is gone?
 * Off-Guard stays through Prone's Includes or a Torso Wound, and through an authored effect of
 * several statuses; "is no longer Off-Guard" would then be false (the review of 0.39.0).
 */
function stillCounts(actor, id) {
  try {
    return !!actor?.statuses?.has?.(id) || conditionSetOf(actor).held.has(id);
  } catch {
    return false;
  }
}

/** A Condition as a card names it: "Frightened 2", "Off-Guard". */
function conditionWordsOf(id, value = null) {
  const name = L(conditionNameKey(id));
  return (CONDITIONS[id]?.numeric && value) ? `${name} ${value}` : name;
}

/**
 * What is said when a Condition or a named Effect ends on the clock, asked AFTER it has gone:
 * "Tess is no longer Off-Guard: its time is up." for a Condition; the same with "still counts
 * as" when she is Off-Guard by other means; "Tess loses Taking Cover: its rounds are up." for a
 * named Effect, as the system's own `Applied.offEffect` says it.
 * @param {Actor} actor
 * @param {{id?: string|null, name?: string, why: string}} what  A Condition's id, or an Effect's name.
 */
function goneWords(actor, { id = null, name = "", why }) {
  const who = actor?.name ?? "";
  if (!id) return F("STARWROUGHT.Timed.lost", { name: who, effect: name, why: whyWords(why) });
  return F(stillCounts(actor, id) ? "STARWROUGHT.Timed.goneStill" : "STARWROUGHT.Timed.gone", { name: who, effect: conditionWordsOf(id), why: whyWords(why) });
}

/** "Aid from Wren (+1 Situation to Crafting) was not used: its time is up." */
function resultOverWords(entry, why) {
  return F("STARWROUGHT.Timed.resultOver", {
    label: String(entry?.label ?? ""),
    amount: resultWords({ value: entry?.value, type: entry?.type }, entry?.to?.name ?? ""),
    why: whyWords(why)
  });
}

/**
 * The turn order now, for who stands in for a fighter who has left the fight (./clock.mjs,
 * `standIn`). `out` is "passed over for good": the defeated when the tracker skips them, and a
 * party, which never acts. Never "has no action left": that fighter acts again next round.
 */
function orderOf(combat) {
  const skipDefeated = !!combat?.settings?.skipDefeated;
  return [...(combat?.turns ?? [])].map(c => ({
    id: c.id,
    initiative: ((c.initiative === null) || (c.initiative === undefined)) ? null : Number(c.initiative),
    out: (skipDefeated && !!c.isDefeated) || (c.actor?.type === PARTY_TYPE)
  }));
}

/**
 * One change of the clock, as every sweep reads it: the Combat, whose Opportunity ended and
 * whose began (Combatant ids), the round that event is of, the round that ended (a round's end
 * alone), and the order. A change that is already one is passed through.
 */
function turnOf(combat, change = {}) {
  if (change && Array.isArray(change.order) && (change.combat === combat?.id)) return change;
  const roundEnded = ((change?.roundEnded === null) || (change?.roundEnded === undefined)) ? null : Number(change.roundEnded);
  const round = ((change?.round === null) || (change?.round === undefined)) ? (Number(combat?.round) || 0) : Number(change.round);
  return { combat: combat?.id ?? null, ended: change?.ended ?? null, began: change?.began ?? null, round, roundEnded, order: orderOf(combat) };
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
 * `settleLoneStep` below.
 *
 * Since 0.39.0 this is THE CLOCK'S ONE ENTRY: a change of Opportunity (`ended`, `began`, with
 * the `round` the event is of) or a round's end (`roundEnded`), which a window counted in rounds
 * and a Condition's own clock also read. And it SAYS what it ended (ruling 396; through 0.38.0
 * "a window closing is not an event"): into `sink` when the caller will post for a whole turn
 * change, else in a card of its own.
 * @param {Combat} combat
 * @param {{ended?: string|null, began?: string|null, round?: number|null, roundEnded?: number|null}} change
 *        Combatant ids, the round of the event, or the round that ended.
 * @param {{sink?: {lines: object[]}|null}} [options]
 */
export async function settleGivenResults(combat, change = {}, { sink = null } = {}) {
  const roundOver = (change?.roundEnded !== null) && (change?.roundEnded !== undefined);
  if (!combat || (!change?.ended && !change?.began && !roundOver)) return;
  return withSink(sink, {}, own => sweepClock(combat, change, own));
}

/** The body of `settleGivenResults`: every sweep of the clock, its lines into `own`. */
async function sweepClock(combat, change, own) {
  const turn = turnOf(combat, change);
  // The Bind's two windows are counted on the same change of Opportunity (0.27.0), from here so
  // that every path that settles the pending results settles them too: the turn change, a lone
  // fighter's step and its socket echo.
  if (turn.ended || turn.began) await settleBindWindows(combat, change, { sink: own });
  // 0.32.0: and the windows of the Effects an APPLY line put on, for the same reason.
  await settleAppliedEffects(combat, turn, { sink: own });
  // 0.39.0: and a Condition's own value, dropping as rounds pass.
  await settleConditionClocks(combat, turn, { sink: own });
  for (const actor of holdersOf(combat)) {
    try {
      if (!responsibleFor(actor)) continue;
      const update = {};
      const over = [];
      for (const entry of givenResults(actor)) {
        const verdict = settle(entry, turn);
        if (verdict === "keep") continue;
        const key = givenFlagKey(entry.id);
        if (verdict === "expire") {
          update[`${GIVEN_PATH}.-=${key}`] = null;
          over.push(entry);
        } else update[`${GIVEN_PATH}.${key}.until.begun`] = verdict.begun;
      }
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
      // A result that was given and never used, as its time runs out: said to whoever saw the
      // card that gave it.
      for (const entry of over) sayLine(own, actor, resultOverWords(entry, isRoundWindow(entry.until) ? "rounds" : "window"), { from: entry.message });
    } catch (error) {
      console.error(`STARWROUGHT | the pending results on ${actor?.name ?? "an actor"} could not be settled:`, error);
    }
  }
}

/**
 * The Bind's two windows, counted on a change of Opportunity (0.27.0; combat/bind-rules.mjs):
 *
 *  - "Off-Guard until its next Opportunity", which a Critical Success on Gain Control puts on its
 *    target: the flagged Off-Guard (`flags.starwrought.pressed` on the effect) is taken off as that
 *    fighter's Opportunity begins, and no other Off-Guard is touched;
 *  - a momentary Control (ruling 278: two or more Sizes apart, the smaller fighter Controlling),
 *    which "ends ... at the end of the controller's next Opportunity": the Controller's
 *    `flags.starwrought.momentaryControl` is marked as that Opportunity begins, and when it ends the
 *    Control falls back to a neutral Bind (`releaseControl`), with a card.
 *
 * Both end with the encounter (`over`). Each fighter's responsible client writes it, as for the
 * pending results. The first condition in the system with an expiry of its own, which is why it
 * is counted here and not in `beginOpportunity`: that runs on one client, and a lone fighter's
 * step runs it on the clicking client alone.
 * @param {Combat} combat
 * @param {{ended?: string|null, began?: string|null}} [change]  Combatant ids.
 * @param {{over?: boolean, sink?: {lines: object[]}|null}} [options]  The encounter itself has
 *        ended; where to put what is said (0.39.0), a card of its own with none.
 */
export async function settleBindWindows(combat, change = {}, { over = false, sink = null } = {}) {
  if (!combat) return;
  return withSink(sink, { encounter: over }, own => sweepBindWindows(combat, change, over, own));
}

/** The body of `settleBindWindows`, its lines into `own`. */
async function sweepBindWindows(combat, change, over, own) {
  const pressedOn = actor => actor.effects?.find?.(e => e.statuses?.has("offGuard") && e.getFlag?.(SYSTEM_ID, PRESSED_FLAG)) ?? null;
  const seen = new Set();
  const actors = [];
  const add = (actor, mustBeOfThisCombat = false) => {
    if (!actor || seen.has(actor.uuid)) return;
    if (mustBeOfThisCombat) {
      // A fighter who left the tracker while it held a window: only what THIS Combat left on it.
      const mine = (pressedOn(actor)?.getFlag?.(SYSTEM_ID, PRESSED_FLAG)?.combat === combat.id)
        || (actor.flags?.[SYSTEM_ID]?.[MOMENTARY_FLAG]?.combat === combat.id);
      if (!mine) return;
    }
    seen.add(actor.uuid);
    actors.push(actor);
  };
  for (const combatant of combat.combatants ?? []) add(combatant?.actor);
  // The encounter's end also reaches a body that is no longer in the tracker (its Combatant or
  // its token removed before its next Opportunity), as the pending results' sweep does: its
  // window would otherwise never close (the review of 2026-11-15).
  if (over) {
    for (const token of (combat.scene ?? globalThis.canvas?.scene)?.tokens ?? []) add(token?.actor, true);
    for (const actor of globalThis.game?.actors ?? []) add(actor, true);
  }
  for (const actor of actors) {
    try {
      const pressed = pressedOn(actor);
      const record = actor.flags?.[SYSTEM_ID]?.[MOMENTARY_FLAG] ?? null;
      if (!pressed && !record) continue;
      if (!responsibleFor(actor)) continue;
      // Every Combatant of this body: a linked Actor may stand in the fight more than once.
      const ids = (combat.combatants ?? []).filter(c => c.actor?.uuid === actor.uuid).map(c => c.id);
      const began = ids.includes(change?.began) ? change.began : null;
      const ended = ids.includes(change?.ended) ? change.ended : null;

      if (pressed && (over || began)) {
        await actor.setCondition("offGuard", false);
        // Said since 0.39.0; the words know whether the creature is still Off-Guard another way.
        sayLine(own, actor, goneWords(actor, { id: "offGuard", why: over ? "encounter" : "window" }), { open: true });
      }

      if (record) {
        const bind = actor.system?.bind;
        // Any Combatant of this body is the Controller's, so the record is counted against "this
        // fighter" rather than against the one id it was written with.
        const SELF = "self";
        const step = momentaryStep({ ...record, combatant: SELF }, {
          combat: combat.id,
          began: began ? SELF : null,
          ended: ended ? SELF : null,
          bindId: bind?.id ?? "",
          controlling: bind?.state === "controlling",
          over
        });
        if (step === "begin") {
          await actor.update({ [`flags.${SYSTEM_ID}.${MOMENTARY_FLAG}.begun`]: true }, { swAnnounced: true });
        } else if (step === "drop") {
          await actor.update({ [`flags.${SYSTEM_ID}.-=${MOMENTARY_FLAG}`]: null }, { swAnnounced: true });
        } else if (step === "release") {
          // The Controller's own write forgets the record as it stops Controlling.
          await actor.releaseControl?.({ id: record.bindId ?? "", note: game.i18n.localize("STARWROUGHT.Bind.momentaryOver") });
        }
      }
    } catch (error) {
      console.error(`STARWROUGHT | the Bind's windows on ${actor?.name ?? "an actor"} could not be settled:`, error);
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
 *
 * Since 0.25.0 the same sweep takes off a USED EFFECT (./given.mjs; `flags.starwrought.rules.used`),
 * which is tied to an Opportunity in the same way and for the same reason: "Aid from Wren (used)"
 * lasts the Opportunity it was left in, and a record whose Combat, round and fighter happen to
 * match again must not wake.
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
      // 0.25.0: a used Effect that is not of the Opportunity now running goes too.
      for (const record of usedEffects(actor)) {
        if (!usedLive(record, encounter)) update[`${USED_PATH}.-=${usedFlagKey(record.id)}`] = null;
      }
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
  await settleGivenResults(combat, { ended: combatantId, began: combatantId, round: combat.round });
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
  await settleGivenResults(combat, { ended: combatant.id, began: combatant.id, round: combat.round });
  await endManeuverMoves(combat, { current: null });
}

/* -------------------------------------------- */
/*  Applied Effects (0.32.0)                    */
/* -------------------------------------------- */

/** An effect's applied record, or null: `flags.starwrought.applied` (./applied.mjs). */
export function appliedOf(effect) {
  const record = effect?.flags?.[SYSTEM_ID]?.applied ?? null;
  return isAppliedRecord(record) ? record : null;
}

/** The effects on an actor that an APPLY line put there. */
export function appliedEffectsOn(actor) {
  return [...(actor?.effects ?? [])].filter(e => !!appliedOf(e));
}

/** The one Condition an effect is the own effect of, or null (the Effects list's test). */
function conditionOf(effect) {
  const statuses = [...(effect?.statuses ?? [])];
  return ((statuses.length === 1) && Object.hasOwn(CONDITIONS, statuses[0])) ? statuses[0] : null;
}

/**
 * Put one line's Effect on a creature (the `apply` kind; rulings 313 to 317). Run on a client
 * that may write the creature: its owner's for a line about the user, the recipient's one writer
 * for a line about a target (documents/cards/apply.mjs).
 *
 *  - A CONDITION goes through `setCondition`, so an `IMMUNE` line is asked and says so on its own
 *    card (unless `force`: a voluntary act is not prevented, ruling 315). It goes on only when it
 *    is absent, or refreshes the one an APPLY put there; one that anything else put on is left
 *    alone and answers `already`. A Condition with a VALUE is set only when that raises it.
 *  - A NAMED EFFECT is one ActiveEffect of that name with the record on it; an applied one already
 *    there is given the new record (the later window stands, ruling 314); a hand-made one of the
 *    name that is switched on is left alone.
 *  - A line with a window, outside an encounter, is not applied (`window`).
 *
 * @param {Actor} actor
 * @param {object} line     `{ op: "apply", effect: { name, slug, condition, value }, until }`.
 * @param {object} record   `appliedRecord(...)`: who, which Maneuver, the Combat, the window, the card.
 * @param {{force?: boolean}} [options]
 * @returns {Promise<{ok?: true, refreshed?: boolean, skipped?: "window"|"prevented"|"already"|"stronger"}>}
 */
export async function applyEffectTo(actor, line, record, { force = false, moment = null } = {}) {
  if (!actor || !line?.effect || !isAppliedRecord(record)) return { skipped: "already" };
  if (line.until && !record.combat) return { skipped: "window" };
  // What the line's Effect means NOW (0.33.0, ruling 333): a line parsed while Supine was a named
  // Effect puts the Condition on, once a row has made Supine one.
  const id = conditionOfRef(line.effect);
  if (id && CONDITIONS[id]) {
    if (CONDITIONS[id].numeric) {
      const want = Math.max(1, Number(line.effect.value) || 1);
      const have = actor.statuses?.has(id) ? (Number(actor.conditionValue?.(id)) || 1) : 0;
      if (have >= want) return { skipped: "stronger" };
      // The record rides on a Condition this line put on fresh, so `mine` reads it and a reroll can
      // take it back; one that was already there is raised and keeps whose it was. Both are
      // decided inside the Condition's write queue (`raise`), so of two writes in one moment the
      // higher value stands, whichever lands last.
      // `moment` (0.39.0, ruling 400): a Condition whose own value drops as rounds pass is
      // counted from the Maneuver's use, as its card kept it, not from a button pressed late.
      const effect = await actor.setCondition(id, want, { flags: { [SYSTEM_ID]: { applied: record } } }, { force, raise: true, moment });
      if (!effect) return { skipped: "prevented" };
      if ((Number(effect.getFlag?.(SYSTEM_ID, "value")) || 1) > want) return { skipped: "stronger" };
      // Raised or put on: either way the value is new, so the card says "is Frightened 3".
      return { ok: true, refreshed: false };
    }
    const before = !!actor.statuses?.has(id);
    const effect = await actor.setCondition(id, true, { flags: { [SYSTEM_ID]: { applied: record } } }, { force, applied: true });
    if (!effect) return { skipped: "prevented" };
    // The writer returned the effect it found untouched when something else had put it on.
    const landed = appliedOf(effect);
    if (!landed || (landed.from !== record.from) || (landed.by !== record.by)) return { skipped: "already" };
    return { ok: true, refreshed: before };
  }
  const slug = String(line.effect.slug ?? "");
  if (!slug) return { skipped: "already" };
  const same = [...actor.effects].filter(e => !conditionOf(e) && (namedEffectOf(e.name)?.slug === slug));
  const applied = same.find(e => !!appliedOf(e));
  if (applied) {
    await applied.update({ disabled: false, [`flags.${SYSTEM_ID}.applied`]: record }, { swAnnounced: true });
    return { ok: true, refreshed: true };
  }
  if (same.some(e => !e.disabled)) return { skipped: "already" };
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: String(line.effect.name ?? slug), img: APPLIED_ICON, flags: { [SYSTEM_ID]: { applied: record } }
  }], { swAnnounced: true });
  return { ok: true, refreshed: false };
}

/**
 * Take one line's Effect off a creature (`REMOVE`). A Condition goes off whoever put it on, since
 * a REMOVE is the Maneuver's own act (Stand ends Prone); the one exception is an Off-Guard that a
 * Critical Hit or a Gain Control holds there, which has an end of its own. A named Effect of that
 * name goes, applied or hand-made.
 * @param {Actor} actor
 * @param {object} line  `{ op: "remove", effect: { name, slug, condition } }`.
 * @returns {Promise<{ok?: true, skipped?: "absent"|"held"}>}
 */
export async function removeEffectFrom(actor, line) {
  if (!actor || !line?.effect) return { skipped: "absent" };
  const id = conditionOfRef(line.effect);
  if (id && CONDITIONS[id]) {
    // A LEFTOVER of the days before the Condition existed (0.32.1's named Effect "Supine"): an
    // effect that is merely called by the name of a Condition a row made, and carries no status.
    // Nothing reads it any more; it goes with the Condition, or alone when that is all there is.
    const leftovers = CONDITIONS[id].builtIn ? []
      : [...actor.effects].filter(e => !e.statuses?.size && !e.changes?.length && (conditionIdOf(plainName(String(e.name ?? ""))) === id));
    if (leftovers.length) await actor.deleteEmbeddedDocuments("ActiveEffect", leftovers.map(e => e.id), { swAnnounced: true });
    if (!actor.statuses?.has(id)) return leftovers.length ? { ok: true } : { skipped: "absent" };
    const held = [...actor.effects].some(e => e.statuses?.has(id)
      && (e.getFlag?.(SYSTEM_ID, "criticalHit") || e.getFlag?.(SYSTEM_ID, PRESSED_FLAG)));
    if (held) return { skipped: "held" };
    await actor.setCondition(id, CONDITIONS[id].numeric ? 0 : false);
    // Still there: the status comes from an effect that is not the Condition's own (an authored
    // effect carrying several statuses, a net that is Prone and Restrained), which is the GM's.
    if (actor.statuses?.has(id)) return { skipped: "held" };
    return { ok: true };
  }
  const slug = String(line.effect.slug ?? "");
  const same = [...actor.effects].filter(e => !conditionOf(e) && (namedEffectOf(e.name)?.slug === slug));
  if (!slug || !same.length) return { skipped: "absent" };
  await actor.deleteEmbeddedDocuments("ActiveEffect", same.map(e => e.id), { swAnnounced: true });
  return { ok: true };
}

/**
 * Take off what one card put on a creature (a reroll replaces a card: what the first die applied
 * to the roller goes before the second die's result lands). Only an Effect whose record names that
 * card, so a later APPLY that refreshed it keeps it.
 * @param {Actor} actor
 * @param {string} from  The card's id.
 * @returns {Promise<number>}  How many went.
 */
export async function removeAppliedFrom(actor, from) {
  if (!actor || !from) return 0;
  let count = 0;
  for (const effect of appliedEffectsOn(actor)) {
    const record = appliedOf(effect);
    if (record?.from !== from) continue;
    if (await endApplied(actor, effect, record)) count += 1;
  }
  return count;
}

/**
 * End one applied Effect, if it still carries the application the caller decided on (`record`,
 * read when the verdict was made): a later APPLY may have given it a new record, and a new
 * window, a moment ago (ruling 314). A Condition is asked again INSIDE its write queue (`only`),
 * where a refresh queued ahead of this has already landed; a named Effect just before it goes.
 * @param {Actor} actor
 * @param {ActiveEffect} effect
 * @param {object} record  The applied record the caller's verdict was made on.
 * @returns {Promise<boolean>}  It went.
 */
async function endApplied(actor, effect, record) {
  const live = actor.effects.get(effect.id);
  if (!record || !live || !sameApplication(appliedOf(live), record)) return false;
  const id = conditionOf(live);
  if (id) {
    await actor.setCondition(id, false, {}, { only: record });
    return !actor.effects.get(effect.id);
  }
  await live.delete({ swAnnounced: true });
  return true;
}

/**
 * A turn changed, or the encounter ended: settle the windows of the Effects APPLY lines put on in
 * this Combat (./applied.mjs, `settleApplied`). The count rides on the record and this is its one
 * writer, on each creature's responsible client, as for the pending results above. The holders are
 * looked for beyond the tracker, since a target need not be a fighter: the Combat's fighters, the
 * scene's tokens and the world's Actors. Since 0.39.0 a window may be counted in ROUNDS, and an
 * Effect that ends is SAID (ruling 396): to whoever saw the card that put it on, else to the
 * table, since an Effect a Maneuver applied shows on the token for everyone.
 * @param {Combat} combat
 * @param {object} [change]  A change of the clock (`turnOf`), or `{ ended, began }` Combatant ids.
 * @param {{over?: boolean, sink?: {lines: object[]}|null}} [options]  The encounter itself has
 *        ended: every window closes. Where to put what is said, a card of its own with none.
 */
export async function settleAppliedEffects(combat, change = {}, { over = false, sink = null } = {}) {
  if (!combat) return;
  return withSink(sink, { encounter: over }, own => sweepAppliedEffects(combat, change, over, own));
}

/** The body of `settleAppliedEffects`, its lines into `own`. */
async function sweepAppliedEffects(combat, change, over, own) {
  const turn = turnOf(combat, change);
  const seen = new Set();
  const holders = [];
  const consider = actor => {
    if (!actor || seen.has(actor.uuid)) return;
    seen.add(actor.uuid);
    if (appliedEffectsOn(actor).some(e => { const r = appliedOf(e); return (r.combat === combat.id) && !!r.until; })) holders.push(actor);
  };
  for (const combatant of combat.combatants ?? []) consider(combatant?.actor);
  for (const token of (combat.scene ?? globalThis.canvas?.scene)?.tokens ?? []) consider(token?.actor);
  for (const actor of globalThis.game?.actors ?? []) consider(actor);
  for (const actor of holders) {
    try {
      if (!responsibleFor(actor)) continue;
      for (const effect of appliedEffectsOn(actor)) {
        const record = appliedOf(effect);
        if ((record.combat !== combat.id) || !record.until) continue;
        const verdict = over ? "expire" : settleApplied(record, turn);
        if (verdict === "keep") continue;
        if (verdict === "expire") {
          const id = conditionOf(effect);
          const name = String(effect.name ?? record.name ?? "");
          if (await endApplied(actor, effect, record)) {
            sayLine(own, actor, goneWords(actor, { id, name, why: over ? "encounter" : (isRoundWindow(record.until) ? "rounds" : "window") }), { from: record.from, open: true });
          }
        } else if (sameApplication(appliedOf(actor.effects.get(effect.id)), record)) {
          // The count goes on the window it was made for, never on one a later APPLY just set.
          await effect.update({ [`flags.${SYSTEM_ID}.applied.until.begun`]: verdict.begun }, { swAnnounced: true });
        }
      }
    } catch (error) {
      console.error(`STARWROUGHT | the applied Effects on ${actor?.name ?? "an actor"} could not be settled:`, error);
    }
  }
}

/* -------------------------------------------- */
/*  A Condition's own clock (0.39.0)            */
/* -------------------------------------------- */

/**
 * The effect that IS a Condition on a creature and is switched on: the one under the
 * Condition's static id, else a single-status effect (the test `#writeCondition` makes). An
 * authored effect of several statuses is the GM's and has no value of its own; one switched
 * off is not on the creature.
 */
function ownConditionEffect(actor, id) {
  const staticId = statusEffectId(id);
  const mine = [...(actor?.effects ?? [])].filter(e => !e.disabled && e.statuses?.has(id) && ((e.id === staticId) || (e.statuses.size === 1)));
  return mine.find(e => e.id === staticId) ?? mine[0] ?? null;
}

/**
 * A CONDITION'S OWN VALUE, DROPPING AS ROUNDS PASS (0.39.0; rulings 393 to 399). A row of the
 * Conditions workbook may say `UNTIL: each round -1` on one of its lines (Frightened): for every
 * round that passes since the Condition went on, its value falls, and at 0 it is gone.
 *
 * The count rides on the Condition's own effect (`flags.starwrought.clock`; ./clock.mjs). It is
 * stamped as the Condition goes on (SwActor#setCondition, and the token palette's create), and
 * HERE for one that has none or another Combat's: with the fighter whose Opportunity just ended,
 * which is the one that was running when it went on. A stamp is never made on a round's end
 * alone, where nobody's Opportunity is known.
 *
 * Fighters of this Combat only (ruling 399), each on its responsible client. A clock counts only
 * while its HOLDER is one of the creature's Combatants here: a creature that left the tracker
 * and came back does so as a new Combatant, so its clock starts again and the rounds it spent
 * out of the fight are not counted in one drop (the review of 0.39.0). The dead are not
 * counted, and lose their clock, so a creature brought back starts again too. A creature
 * fighting in two started Combats keeps the clock of the one that stamped it.
 * The lowering is `setCondition`'s `drop`, decided inside its write queue on the clock the tick
 * was worked out from.
 * @param {Combat} combat
 * @param {object} turn  A change of the clock (`turnOf`).
 * @param {{sink?: {lines: object[]}|null}} [options]
 */
async function settleConditionClocks(combat, turn, { sink = null } = {}) {
  const seen = new Set();
  const roundOver = turn.roundEnded !== null;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor?.system || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    try {
      if (actor.type === PARTY_TYPE) continue;
      const fading = [...(actor.statuses ?? [])].filter(id => CONDITIONS[id]?.numeric && fadeOf(CONDITIONS[id].rules));
      if (!fading.length || !responsibleFor(actor)) continue;
      // Every Combatant of this body: a linked Actor may stand in the fight more than once.
      const holders = [...(combat.combatants ?? [])].filter(c => c.actor?.uuid === actor.uuid).map(c => c.id);
      const dead = !!actor.statuses?.has("dead");
      for (const id of fading) {
        const effect = ownConditionEffect(actor, id);
        if (!effect) continue;
        const fade = fadeOf(CONDITIONS[id].rules);
        const clock = effect.getFlag?.(SYSTEM_ID, CLOCK_FLAG) ?? null;
        if (dead) {
          if (clock) await effect.update({ [`flags.${SYSTEM_ID}.${CLOCK_FLAG}`]: null }, { swAnnounced: true });
          continue;
        }
        if (!clockRuns(clock, combat.id, holders)) {
          // Another started Combat this creature also fights in is counting it: left to that one.
          const other = (clock?.combat && (clock.combat !== combat.id)) ? globalThis.game?.combats?.get?.(clock.combat) : null;
          if (other?.started && (other.getCombatantsByActor?.(actor) ?? []).some(c => c.id === clock.holder)) continue;
          if (roundOver && !turn.ended && !turn.began) continue;
          const anchor = turn.ended ?? turn.began ?? null;
          const init = anchor ? (combat.combatants.get(anchor)?.initiative ?? null) : null;
          await effect.update({ [`flags.${SYSTEM_ID}.${CLOCK_FLAG}`]: clockOf({ combat: combat.id, anchor, init, round: turn.round }, holders[0] ?? null) }, { swAnnounced: true });
          continue;
        }
        const change = roundOver ? { combat: combat.id, roundEnded: turn.roundEnded } : { combat: combat.id, began: turn.began, round: turn.round };
        const { drop, clock: next } = tickFade(clock, fade, change, turn.order);
        if (!next) continue;
        if (!drop) {
          // A round counted that lowers nothing yet (`each 2 rounds -1`): the count alone moves.
          await effect.update({ [`flags.${SYSTEM_ID}.${CLOCK_FLAG}`]: next }, { swAnnounced: true });
          continue;
        }
        const before = Number(effect.getFlag?.(SYSTEM_ID, "value")) || 1;
        // The card that put it on, when one did: a Condition a whispered card applied is said
        // to those who saw that card, and to the table otherwise, since the token shows it.
        const from = appliedOf(effect)?.from ?? null;
        const left = await actor.setCondition(id, null, { flags: { [SYSTEM_ID]: { [CLOCK_FLAG]: next } } }, { drop, from: clock });
        const after = left ? (Number(left.getFlag?.(SYSTEM_ID, "value")) || 1) : 0;
        if (after >= before) continue;
        sayLine(sink, actor, after > 0
          ? F("STARWROUGHT.Timed.dropped", { name: actor.name, to: conditionWordsOf(id, after), from: conditionWordsOf(id, before), why: whyWords("drop") })
          : goneWords(actor, { id, why: "dropped" }), { from, open: true });
      }
    } catch (error) {
      console.error(`STARWROUGHT | the Conditions' clocks on ${actor?.name ?? "an actor"} could not be settled:`, error);
    }
  }
}

/* -------------------------------------------- */
/*  The encounter's end                         */
/* -------------------------------------------- */

/**
 * The Combat is gone: every character who fought in it loses the custom effects that lasted the
 * encounter. Every client hears `deleteCombat`; the one that writes to each character is its
 * responsible client (the active GM, else its first active owner; helpers/authority.mjs), the
 * pattern the round's hooks use, so a table with no GM still clears them and nothing is written
 * twice. Since 0.39.0 everything that ends with the encounter is SAID (ruling 396), in one card
 * for each creature: through 0.38.0 "the effect was the player's note to the system, not an
 * event".
 * @param {Combat} combat
 */
export async function endEncounterEffects(combat) {
  return withSink(null, { encounter: true }, sink => sweepEncounterEnd(combat, sink));
}

/** The body of `endEncounterEffects`, its lines into `sink`. */
async function sweepEncounterEnd(combat, sink) {
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
      const gone = rows.filter(e => e.duration === "encounter");
      const update = { "system.effects": kept, ...rowFlagDeletions(actor, gone) };
      await actor.update(update, { swAnnounced: true });
      // A row with no label is named by its text, in quotes, so the card does not run the line
      // into the sentence.
      for (const row of gone) {
        sayLine(sink, actor, row.label
          ? F("STARWROUGHT.Timed.rowOver", { name: actor.name, label: String(row.label) })
          : F("STARWROUGHT.Timed.rowOverText", { name: actor.name, text: String(row.text ?? "") }));
      }
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
      const over = [];
      for (const entry of givenResults(actor)) {
        if (!entry.combat || (entry.combat !== combat.id)) continue;
        update[`${GIVEN_PATH}.-=${givenFlagKey(entry.id)}`] = null;
        over.push(entry);
      }
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
      for (const entry of over) sayLine(sink, actor, resultOverWords(entry, "encounter"), { from: entry.message });
    } catch (error) {
      console.error(`STARWROUGHT | the pending results on ${actor?.name ?? "an actor"} could not be cleared:`, error);
    }
  }
  // 0.24.0: a Move made as part of a Maneuver ends with its encounter, and so do the marks that
  // say who has moved for one.
  await endManeuverMoves(combat, { ended: true });
  // 0.27.0: the Bind's two windows close with the encounter: a Gain Control's Off-Guard goes, and
  // a momentary Control falls back to a neutral Bind.
  await settleBindWindows(combat, {}, { over: true, sink });
  // 0.32.0: every window ends with the encounter, an applied Effect's too. One with no window
  // (Prone from a Trip) lasts until something takes it off, and stays.
  await settleAppliedEffects(combat, {}, { over: true, sink });
  // 0.39.0: and all of it is said, one card for each creature, as this function returns.
  // 0.25.0: a used Effect of this Combat goes with it wherever its holder is by now. The sweep
  // above walks the fighters; one whose Combatant or token was removed while it held the Effect
  // is no fighter any more, and its record would otherwise stay listed for good (the review of
  // 2026-11-15).
  const seen = new Set();
  const holders = [];
  const consider = actor => {
    if (!actor || seen.has(actor.uuid)) return;
    seen.add(actor.uuid);
    if (usedEffects(actor).some(record => record.combat === combat.id)) holders.push(actor);
  };
  for (const token of (combat?.scene ?? globalThis.canvas?.scene)?.tokens ?? []) consider(token?.actor);
  for (const actor of globalThis.game?.actors ?? []) consider(actor);
  for (const actor of holders) {
    try {
      if (!responsibleFor(actor)) continue;
      const update = {};
      for (const record of usedEffects(actor)) {
        if (record.combat === combat.id) update[`${USED_PATH}.-=${usedFlagKey(record.id)}`] = null;
      }
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
    } catch (error) {
      console.error(`STARWROUGHT | the used Effects on ${actor?.name ?? "an actor"} could not be cleared:`, error);
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
