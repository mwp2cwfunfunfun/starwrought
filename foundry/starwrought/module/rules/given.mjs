/**
 * What a Maneuver GIVES (0.22.0; rulings 223 to 230): the pure half of the `give` and `alter`
 * kinds. From Aid (PHB v4.24): on a Success the ally gets a +1 Situation bonus, on a Critical
 * Success +2 (+3 at Master, +4 at Legendary), on a Critical Failure a -1 penalty; and from two
 * Human Talents that change it (Mike, 2026-11-14): Patient Assistance ("the Situation bonus
 * provided by your Aid lasts until the end of the recipient's second upcoming Opportunity") and
 * Sure Assistance ("A critical failure on your Aid check grants no penalty to your ally").
 *
 * Three things live here, all plain data in and plain data out, so `assets/test_rules.mjs` drives
 * them from Node and the card, the engine and the turn change read one account of each:
 *
 *   THE TABLE. `buildTable(lines, alterations)`: the results a Maneuver's check gives, by degree,
 *   at the rank rolled. A line is one GIVE rule whose rank conditions held; the first line for a
 *   degree is that degree's result. An alteration is one ALTER rule on the roller; it changes one
 *   property of the table and leaves the rest. The table is written into the check card's flags,
 *   so a reroll to another degree, and a reload, read the same answer with no Item to consult.
 *
 *   THE PENDING RESULT. `pendingEntry(...)`: what the recipient holds once the result is given, at
 *   `flags.starwrought.rules.given.<maneuver>` on the recipient. One per Maneuver per recipient: a
 *   new Aid result replaces the one pending (Mike's Carry the Plan: "only one Aid result can be
 *   pending per recipient"), which a key overwrite is. `givenCarrier(entry)` is the carrier the
 *   engine indexes it through (../engine.mjs, `collectRules`), a one-roll effect whose single rule
 *   is `pendingRule(entry)`, so the `give` kind's `modifiers` hook reads it as any rule.
 *
 *   THE WINDOW. `settle(entry, { combat, ended, began })`: what one turn change does to a pending
 *   result. Nothing counts Opportunities anywhere in the system, so the count rides on the entry:
 *   a giver's window ends when the giver's Nth Opportunity after the give BEGINS; a recipient's
 *   window counts that fighter's Opportunities as they begin and ends when the Nth one ENDS. Every
 *   window also ends with the encounter (../effects-state.mjs clears the entries of a deleted
 *   Combat), and a result given outside an encounter lasts until used, replaced or removed.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS. It imports ./operators.mjs (pure) and nothing else.
 */

import { untilWords, untilEdge, titled, DEGREE_NAMES } from "./operators.mjs";

/** The four degrees, in the Result table's order. */
export const GIVE_DEGREES = Object.freeze(["critSuccess", "success", "fail", "critFail"]);

/** The properties of a Maneuver's results an ALTER may name a degree by, to the degree's key. */
export const DEGREE_PROPERTIES = Object.freeze({
  "critical-success": "critSuccess",
  success: "success",
  failure: "fail",
  "critical-failure": "critFail"
});

/** The two duration properties: every result's window, and the window of the results that give a bonus. */
export const DURATION_PROPERTIES = Object.freeze(["duration", "beneficial-duration"]);

/**
 * The one property that is not about what a Maneuver GIVES (0.24.0): how the Move made as part of
 * the Maneuver is read on the map. `VALUE: step` lets a drag within half Speed be a Step
 * (Coordinated Footwork, of Move Together). `buildTable` below never looks at it: it is read when
 * the Maneuver is used, by the `permit` kind (./kinds/permit.mjs), through the engine's `ruleUses`.
 */
export const MOVEMENT_PROPERTY = "movement";

/** The values the movement property may be given. One word so far. */
export const MOVEMENT_VALUES = Object.freeze(["step"]);

/**
 * The Maneuver's own LIMIT (0.25.0; ruling 250): how often it may be used. `VALUE: round` makes a
 * once-an-encounter Maneuver once a round (Reciprocal Effort, of Pay It Forward: "You may use Pay
 * It Forward once per round instead of once per encounter"). Like `movement` it is not about what
 * the Maneuver gives, so `buildTable` never looks at it: the kinds that act when a Maneuver is used
 * read it through `limitOf` below.
 */
export const LIMIT_PROPERTY = "limit";

/** The values the limit property may be given: the words `LIMIT:` itself reads. */
export const LIMIT_VALUES = Object.freeze(["round", "encounter"]);

/** Every property an ALTER reads in this version, as a message lists them. */
export const ALTER_PROPERTIES = Object.freeze([...DURATION_PROPERTIES, ...Object.keys(DEGREE_PROPERTIES), MOVEMENT_PROPERTY, LIMIT_PROPERTY]);

/** The window a GIVE line has when it names none: until the giver's next Opportunity begins. */
export const DEFAULT_UNTIL = Object.freeze({ who: "giver", n: 1 });

/** The carrier id, and the flag key, of a pending result: one per Maneuver per recipient. */
export const GIVEN_PREFIX = "given:";

/** A property word as an ALTER wrote it, to the form the tables above are keyed by. */
export function propertyKey(word) {
  return String(word ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

/* -------------------------------------------- */
/*  The table                                   */
/* -------------------------------------------- */

/**
 * @typedef {object} GiveLine      One GIVE rule whose rank conditions held on this roll.
 * @property {string} degree       A key of GIVE_DEGREES.
 * @property {number} value        Signed, never 0.
 * @property {string} type         situation | condition | gear.
 * @property {{name: string, slug: string, type: string|null}} to   `type: "chosen"`: named when the result is
 *                                 given; any other type (null from a parse with no resolver) is a named Constellation.
 * @property {{who: string, n: number}|null} until             Null: the default window.
 *
 * @typedef {object} GiveAlteration   One ALTER rule on the roller that names this Maneuver.
 * @property {string} property        A member of ALTER_PROPERTIES.
 * @property {boolean} [nothing]      On a degree property: that degree gives nothing.
 * @property {{who: string, n: number}|null} [until]   On a duration property: the new window.
 * @property {string} label           The Talent's plain name, for the card's note.
 *
 * @typedef {object} GiveResult    What one degree gives.
 * @property {number} value
 * @property {string} type
 * @property {{name: string, slug: string, type: string|null}} to   `type: "chosen"`, else a named Constellation.
 * @property {{who: string, n: number}} until
 * @property {string[]} altered    The label of the alteration whose window this result wears, if one does.
 */

/**
 * The results by degree, from the lines that held and the roller's alterations.
 *
 * The first line for a degree is its result; a degree no line names gives nothing. The
 * alterations then apply by property, the same whatever order they arrive in between properties:
 * first the results set to nothing (a degree emptied, with a note saying which Talent did, so a
 * card can tell "this Maneuver gives nothing on a Failure" from "Sure Assistance: a Critical
 * Failure gives nothing"), then `duration` (every remaining result's window), then
 * `beneficial-duration` (the window of the results whose value is above 0), so the more particular
 * property stands over the general one. Of two changes to ONE property the later line stands. A
 * result names the one alteration whose window it wears (`altered`), never one that was written
 * over; an alteration that changes nothing (a longer bonus on a table with no bonus) leaves no
 * trace.
 * @param {GiveLine[]} lines
 * @param {GiveAlteration[]} [alterations]
 * @returns {{table: Object<string, GiveResult|null>, notes: Object<string, Array<{label: string, nothing: boolean}>>}}
 */
export function buildTable(lines, alterations = []) {
  const table = {};
  for (const degree of GIVE_DEGREES) table[degree] = null;
  for (const line of lines ?? []) {
    if (!line || !GIVE_DEGREES.includes(line.degree) || table[line.degree]) continue;
    const value = Number(line.value);
    if (!Number.isFinite(value) || (value === 0)) continue;
    // A Constellation named in a cell read without a resolver has a null type and is still a
    // named Constellation; only a line with no `to` at all, or the word itself, is `chosen`.
    const to = (line.to && (typeof line.to === "object")) ? line.to : { name: "chosen", slug: "", type: "chosen" };
    table[line.degree] = {
      value,
      type: String(line.type ?? "situation"),
      to: { name: String(to.name ?? ""), slug: String(to.slug ?? ""), type: (to.type === undefined || to.type === null) ? null : String(to.type) },
      until: normalUntil(line.until),
      altered: []
    };
  }

  const notes = {};
  const changes = (alterations ?? []).filter(a => a && (typeof a === "object")).map(a => ({ ...a, property: propertyKey(a.property), label: String(a.label ?? "") }));
  for (const change of changes) {
    if (!Object.hasOwn(DEGREE_PROPERTIES, change.property)) continue;
    const degree = DEGREE_PROPERTIES[change.property];
    if ((change.nothing !== true) || !table[degree]) continue;
    table[degree] = null;
    (notes[degree] ??= []).push({ label: change.label, nothing: true });
  }
  for (const property of DURATION_PROPERTIES) {
    for (const change of changes) {
      if ((change.property !== property) || !change.until) continue;
      for (const degree of GIVE_DEGREES) {
        const result = table[degree];
        if (!result) continue;
        if ((property === "beneficial-duration") && !(result.value > 0)) continue;
        result.until = normalUntil(change.until);
        result.altered = change.label ? [change.label] : [];
      }
    }
  }
  return { table, notes };
}

/**
 * Do two tables give the same thing on a degree: the same result (its value, type, Constellation,
 * window and the Talent it names) and the same notes? The engine asks it to learn whether one
 * rule changed what a degree gives, which is when a Skip or a one-roll custom effect is spent.
 * @param {{table: object, notes: object}} a
 * @param {{table: object, notes: object}} b
 * @param {string} degree
 * @returns {boolean}
 */
export function sameGiven(a, b, degree) {
  return (JSON.stringify(a?.table?.[degree] ?? null) === JSON.stringify(b?.table?.[degree] ?? null))
    && (JSON.stringify(a?.notes?.[degree] ?? []) === JSON.stringify(b?.notes?.[degree] ?? []));
}

/** A window as stored: `{ who, n }`, the default when none or a broken one was given. */
function normalUntil(until) {
  const who = until?.who;
  if (who === "encounter") return { who: "encounter", n: 0 };
  if ((who !== "giver") && (who !== "recipient")) return { ...DEFAULT_UNTIL };
  const n = Number(until?.n);
  return { who, n: (Number.isInteger(n) && (n >= 1)) ? n : 1 };
}

/* -------------------------------------------- */
/*  The pending result                          */
/* -------------------------------------------- */

/**
 * The pending result one give writes on its recipient.
 *
 * The window is counted against a Combatant, so it needs one: a giver's window with no Combatant
 * for the giver in this Combat, or a recipient's with none for the recipient, cannot be counted and
 * lasts the encounter instead. Outside an encounter there is no window at all (`until: null`): the
 * result lasts until it is used, replaced or removed.
 * @param {object} options
 * @param {GiveResult} options.result                 The table's result for the degree rolled.
 * @param {{slug: string, name: string}} options.to   The Constellation the bonus is to (chosen or fixed).
 * @param {{slug: string, name: string}} options.maneuver
 * @param {{uuid: string, name: string}} options.giver
 * @param {string|null} [options.combat]              The Combat's id, or null outside an encounter.
 * @param {string|null} [options.giverCombatant]      The giver's Combatant id in that Combat.
 * @param {string|null} [options.recipientCombatant]  The recipient's Combatant id in that Combat.
 * @param {string|null} [options.message]             The check card's id, the event the give answers.
 * @returns {object}
 */
export function pendingEntry({ result, to, maneuver, giver, combat = null, giverCombatant = null, recipientCombatant = null, message = null }) {
  const slug = String(maneuver?.slug ?? "");
  const maneuverName = String(maneuver?.name ?? titled(slug));
  const byName = String(giver?.name ?? "");
  let until = null;
  if (combat) {
    const window = normalUntil(result?.until);
    const combatant = window.who === "giver" ? giverCombatant : window.who === "recipient" ? recipientCombatant : null;
    until = ((window.who === "encounter") || !combatant)
      ? { who: "encounter", combatant: null, n: 0, begun: 0 }
      : { who: window.who, combatant: String(combatant), n: window.n, begun: 0 };
  }
  return {
    id: `${GIVEN_PREFIX}${slug}`,
    label: byName ? `${maneuverName} from ${byName}` : maneuverName,
    value: Number(result?.value) || 0,
    type: String(result?.type ?? "situation"),
    to: { slug: String(to?.slug ?? ""), name: String(to?.name ?? "") },
    by: String(giver?.uuid ?? ""),
    byName,
    maneuver: slug,
    maneuverName,
    combat: combat ? String(combat) : null,
    until,
    message: message ? String(message) : null
  };
}

/** The one rule a pending result carries: a resolved `give`, read by that kind's `modifiers` hook. */
export function pendingRule(entry) {
  return {
    kind: "give",
    pending: true,
    line: 1,
    text: String(entry?.label ?? ""),
    value: Number(entry?.value) || 0,
    type: String(entry?.type ?? "situation"),
    to: { name: String(entry?.to?.name ?? ""), slug: String(entry?.to?.slug ?? ""), type: "constellation" }
  };
}

/**
 * The carrier the engine indexes a pending result through: the shape of a custom effect's carrier
 * (`effectCarrier` in ../engine.mjs) with a one-roll duration, so the dispatcher traces it and the
 * roll that uses it asks for its removal through the `per: "effect"` mark every one-roll effect
 * uses. Its id is the entry's (`given:<maneuver>`), which no Item id and no effect row id can be.
 * @param {object} entry  A pending result.
 * @returns {object}
 */
export function givenCarrier(entry) {
  const id = String(entry?.id ?? "");
  return {
    id,
    name: String(entry?.label ?? "").trim() || "Given result",
    type: "effect",
    effect: { id, label: String(entry?.label ?? ""), text: "", duration: "roll" },
    given: entry,
    system: { rules: [pendingRule(entry)], automation: "", reaction: false, glyph: "", cost: "passive" }
  };
}

/** Is this carrier id, or mark key, a pending result's? */
export function isGivenKey(key) {
  return String(key ?? "").startsWith(GIVEN_PREFIX);
}

/**
 * The flag key of a pending result under `flags.starwrought.rules.given`: the Maneuver's slug,
 * from the slug itself or from the entry's id. A slug holds no dot; one is replaced all the same
 * (as `flagKey` in the config does), since a dot would open a level in the path.
 */
export function givenFlagKey(key) {
  return String(key ?? "").slice(isGivenKey(key) ? GIVEN_PREFIX.length : 0).replace(/\./g, "-");
}

/**
 * Does a pending result apply to a roll made now? One given in a Combat applies only while that
 * Combat is the encounter the roll is made in; one given outside any applies anywhere.
 * @param {object} entry
 * @param {{combat: string|null}|null|undefined} encounter
 * @returns {boolean}
 */
export function appliesNow(entry, encounter) {
  if (!entry) return false;
  if (!entry.combat) return true;
  return entry.combat === (encounter?.combat ?? null);
}

/* -------------------------------------------- */
/*  The used Effect (0.25.0)                    */
/* -------------------------------------------- */

/**
 * NAMED EFFECTS, STEP ONE (0.25.0; ruling 247; Mike, 2026-11-15, after Fantasy Grounds: "using a
 * Maneuver can grant a custom Effect on a target ... and other modifiers/effects can be applied IF
 * that custom Effect field is on the target", built in two steps by his choice). The first named
 * Effect is one the SYSTEM leaves: when a roll uses up a bonus that another creature's Maneuver
 * gave the roller, at the roller's own Opportunity, the roller holds the Effect "<that result>
 * (used)" until that Opportunity ends, at `flags.starwrought.rules.used.<maneuver>`. The condition
 * `IF: EFFECT(<Maneuver>, used)` reads it (./effects.mjs), and Pay It Forward is the first
 * Maneuver it triggers (./kinds/subordinate.mjs). A Maneuver that grants a named Effect to a
 * target, and `EFFECT(<name>)` on a bonus line, are step two.
 */

/** The id prefix, and the mark key prefix, of a used Effect: one per Maneuver per holder. */
export const USED_PREFIX = "used:";

/** Is this id, or mark key, a used Effect's? */
export function isUsedKey(key) {
  return String(key ?? "").startsWith(USED_PREFIX);
}

/** The flag key of a used Effect under `flags.starwrought.rules.used`: the Maneuver's slug. */
export function usedFlagKey(key) {
  return String(key ?? "").slice(isUsedKey(key) ? USED_PREFIX.length : 0).replace(/\./g, "-");
}

/**
 * The used Effect a roll leaves when it uses up a pending result, or null when it leaves none.
 *
 * It leaves one only when every part of Pay It Forward's Requirements holds ("You are acting at
 * your own Opportunity and have just finished a check that consumed a beneficial Aid result from
 * another creature"): in an encounter, with an Opportunity running, that Opportunity the roller's
 * own (`moment.own`), the result a bonus, and its giver somebody else. A penalty a roll swallowed,
 * a roll made on another fighter's Opportunity, an Initiative rolled before the first Opportunity
 * and a roll outside an encounter leave nothing.
 * @param {object} entry   The pending result being used up (`pendingEntry`).
 * @param {{combat: string|null, round?: number, combatant?: string|null, own?: boolean}|null} moment
 *        The encounter as the roll resolves, and whether the Opportunity running is the roller's.
 * @param {string} [holder]  The roller's uuid: a result one gave oneself leaves nothing.
 * @returns {object|null}
 */
export function usedEntry(entry, moment, holder = "") {
  if (!entry || (typeof entry !== "object")) return null;
  if (!moment?.combat || !moment.combatant || (moment.own !== true)) return null;
  if (!(Number(entry.value) > 0)) return null;
  const by = String(entry.by ?? "");
  if (!by || (by === String(holder ?? ""))) return null;
  const slug = String(entry.maneuver ?? "");
  if (!slug) return null;
  const maneuverName = String(entry.maneuverName ?? titled(slug));
  return {
    id: `${USED_PREFIX}${slug}`,
    label: `${String(entry.label ?? "").trim() || maneuverName} (used)`,
    maneuver: slug,
    maneuverName,
    by,
    byName: String(entry.byName ?? ""),
    value: Number(entry.value) || 0,
    type: String(entry.type ?? "situation"),
    to: { slug: String(entry.to?.slug ?? ""), name: String(entry.to?.name ?? "") },
    // Which result it was: the card of the check that gave it (`pendingEntry`'s `message`). The
    // roll's own card carries the same id on the modifier (`givenFrom`), which is how a button is
    // drawn on the card of the roll that used THIS result and on no other.
    from: entry.message ? String(entry.message) : null,
    combat: String(moment.combat),
    round: Number(moment.round) || 0,
    during: String(moment.combatant)
  };
}

/**
 * Is a used Effect still held? Only during the Opportunity it was left in: the same Combat, the
 * same round, the same fighter's Opportunity running. (The record is also taken off as that
 * Opportunity ends, ../effects-state.mjs; this is the reading in between, and the one that holds
 * when the client that should have swept it was away.)
 * @param {object|null} record
 * @param {{combat: string|null, round?: number, combatant?: string|null}|null} encounter
 * @returns {boolean}
 */
export function usedLive(record, encounter) {
  if (!record || (typeof record !== "object") || !record.during) return false;
  if (!encounter?.combat || !encounter.combatant) return false;
  return (record.combat === encounter.combat)
    && ((Number(record.round) || 0) === (Number(encounter.round) || 0))
    && (record.during === encounter.combatant);
}

/**
 * The used Effects on an actor, as stored under `flags.starwrought.rules.used`, in key order. A
 * plain object in a test.
 * @param {object} actor
 * @returns {object[]}
 */
export function usedEffects(actor) {
  const used = actor?.flags?.starwrought?.rules?.used;
  if (!used || (typeof used !== "object")) return [];
  return Object.keys(used).sort().map(key => used[key]).filter(e => e && (typeof e === "object") && e.id);
}

/** The used Effect of one Maneuver on an actor, or null. */
export function usedOf(actor, slug) {
  const key = usedFlagKey(slug);
  if (!key) return null;
  const record = actor?.flags?.starwrought?.rules?.used?.[key] ?? null;
  return (record && (typeof record === "object")) ? record : null;
}

/* -------------------------------------------- */
/*  The limit (0.25.0)                          */
/* -------------------------------------------- */

/**
 * The LIMIT that stands for one use of a Maneuver's rule: the rule's own, unless one of the
 * owner's alterations names the Maneuver's `limit` (`ALTER: Pay It Forward.limit; VALUE: round`,
 * Reciprocal Effort). It REPLACES the limit and never adds a use ("This replaces the original
 * frequency; it does not provide a separate extra use"), so a rule with no LIMIT of its own stays
 * unlimited. Of two alterations the later stands. A line on Skip is left out this once; its
 * marks, and a one-roll custom effect's, are handed back for the use that counted to file.
 * @param {object} rule  The Maneuver's rule (`rule.limit` is `{ per }` or null).
 * @param {Array<{property: string, per?: string|null, skipped?: boolean, marks?: object[]}>} [alterations]
 *        The owner's alterations of the Maneuver (../engine.mjs, `alterationsOf`).
 * @returns {{per: string|null, marks: Array<{key: string, per: string}>}}
 */
export function limitOf(rule, alterations = []) {
  const own = LIMIT_VALUES.includes(rule?.limit?.per) ? rule.limit.per : null;
  if (!own) return { per: null, marks: [] };
  let per = own;
  const marks = [];
  for (const change of alterations ?? []) {
    if (!change || (propertyKey(change.property) !== LIMIT_PROPERTY) || !LIMIT_VALUES.includes(change.per)) continue;
    if (Array.isArray(change.marks)) marks.push(...change.marks);
    if (change.skipped === true) continue;
    per = change.per;
  }
  return { per, marks };
}

/* -------------------------------------------- */
/*  The window                                  */
/* -------------------------------------------- */

/**
 * What one turn change does to a pending result: `"keep"`, `"expire"`, or `{ begun }`, the new
 * count to write.
 *
 * `ended` is the Combatant whose Opportunity just ended and `began` the one whose Opportunity just
 * began (either may be null, and with a lone fighter they are the same Combatant). A giver's
 * window counts the giver's Opportunities as they begin and ends with the Nth, so the default
 * window closes as the giver's next Opportunity opens. A recipient's window ends as the Nth
 * Opportunity it has counted ENDS, so `recipient opportunity 2` covers two whole Opportunities of
 * the recipient's; the end is read before the beginning, so a lone fighter's turn change ends one
 * Opportunity before it counts the next. An Opportunity already running when the result is given
 * is never counted: the window is of UPCOMING Opportunities.
 * @param {object} entry
 * @param {{combat?: string|null, ended?: string|null, began?: string|null}} change
 * @returns {"keep"|"expire"|{begun: number}}
 */
export function settle(entry, { combat = null, ended = null, began = null } = {}) {
  const until = entry?.until;
  if (!until || !entry.combat || (entry.combat !== combat)) return "keep";
  if ((until.who !== "giver") && (until.who !== "recipient")) return "keep";
  if (!until.combatant) return "keep";
  const begun = Math.max(0, Number(until.begun) || 0);
  const n = Math.max(1, Number(until.n) || 1);
  // Which edge of the Nth Opportunity closes the window (0.32.0; `untilEdge` in ./operators.mjs):
  // a giver's as it begins and a recipient's as it ends, unless the window names the other, which
  // only an APPLY line's may. A window stored before 0.32.0 names none and settles as it did.
  if (untilEdge(until) === "begin") {
    if (began !== until.combatant) return "keep";
    return (begun + 1 >= n) ? "expire" : { begun: begun + 1 };
  }
  if ((ended === until.combatant) && (begun >= n)) return "expire";
  if (began === until.combatant) return { begun: begun + 1 };
  return "keep";
}

/* -------------------------------------------- */
/*  Words                                       */
/* -------------------------------------------- */

/** "+1" or "-1": a signed whole number with a plain hyphen-minus, as every card prints one. */
export function signedValue(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : String(n);
}

/**
 * A result in words: "+1 Situation to Crafting", or "+1 Situation" while the Constellation is
 * still to be chosen.
 * @param {{value: number, type: string, to?: {name?: string, type?: string}}} result
 * @param {string} [constellation]  The chosen Constellation's name, once it is known.
 * @returns {string}
 */
export function resultWords(result, constellation = "") {
  const name = constellation || ((result?.to?.type === "chosen") ? "" : (result?.to?.name ?? ""));
  return `${signedValue(result?.value)} ${titled(result?.type ?? "situation")}${name ? ` to ${name}` : ""}`;
}

/**
 * A result's window in words, for the card's button and the give card, before anything is
 * written: "until Tess's next Opportunity", "through Wren's second upcoming Opportunity", "until
 * the encounter ends", and outside an encounter "until it is used".
 * @param {{who: string, n: number}|null} until
 * @param {{giver?: string, recipient?: string, encounter?: boolean}} [names]
 * @returns {string}
 */
export function windowWords(until, { giver, recipient, encounter = true } = {}) {
  if (!encounter) return "until it is used";
  return untilWords(until, { ...(giver ? { giver } : {}), ...(recipient ? { recipient } : {}) });
}

/**
 * A PENDING result's window in words, from what is left of it: the count on the entry moves as
 * Opportunities begin, so "through Wren's second upcoming Opportunity" becomes "through Wren's
 * next Opportunity" and then "through Wren's Opportunity".
 * @param {object} entry
 * @param {{giver?: string, recipient?: string}} [names]
 * @returns {string}
 */
export function pendingWindowWords(entry, { giver, recipient } = {}) {
  const until = entry?.until;
  if (!until) return "until it is used";
  if ((until.who !== "giver") && (until.who !== "recipient")) return "until the encounter ends";
  const left = Math.max(0, (Number(until.n) || 1) - (Number(until.begun) || 0));
  if ((until.who === "recipient") && (left === 0)) return `through ${recipient ?? "the recipient"}'s Opportunity`;
  return untilWords({ who: until.who, n: Math.max(1, left) }, { ...(giver ? { giver } : {}), ...(recipient ? { recipient } : {}) });
}

/** The degree's name as the Result table prints it. */
export function degreeName(degree) {
  return DEGREE_NAMES[degree] ?? titled(degree ?? "");
}
