/**
 * What a Maneuver puts on a creature, and takes off (0.32.0; rulings 311 to 321): the pure half
 * of the `apply` kind (./kinds/apply.mjs). Named Effects, step two, the writing half; 0.31.0 was
 * the reading half (./effect-list.mjs).
 *
 * Mike, 2026-11-15, after Fantasy Grounds: "using a Maneuver can grant a custom Effect on a
 * target (with a specific duration), and other modifiers/effects can be applied IF that custom
 * Effect field is on the target." And 2026-11-17, by question: the tags are APPLY and REMOVE; an
 * Effect on yourself lands at once, one on another creature by a button on the card.
 *
 *   [EFFECT APPLY: prone, target; IF: RESULT(success)]                              Trip
 *   [EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]
 *   [EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]  Demoralize
 *   [EFFECT APPLY: Taking Cover]                                                    Take Cover
 *   [EFFECT REMOVE: prone]                                                          Stand
 *
 * A LINE is one such rule as the roll carries it: `{ op, effect: { name, slug, condition, value },
 * who, until, degree, cost }`. `degree` null is a line with no `IF: RESULT`: it stands whenever
 * the Maneuver is used. `cost` null is a line with no `IF: COST`.
 *
 * AN APPLIED EFFECT is an ActiveEffect that carries a RECORD, `flags.starwrought.applied`: who put
 * it there, with which Maneuver, in which Combat, from which card, and its window. A Condition's
 * own effect carries it when an APPLY line put the Condition on; a named Effect is created with
 * it. The record is how the system knows what is ITS to refresh and to end: a Condition anything
 * else put on (the GM's hand, a Critical Hit, a Bind) has none, and is left alone (ruling 313).
 * Every key is always written, so a refresh never leaves a stale one behind.
 *
 * THE WINDOW is the pending result's (./given.mjs, `settle`), with an edge: counted on the record
 * from the turn changes of the encounter it was applied in. No `UNTIL` is no window: the Effect
 * lasts until something takes it off. A window needs an encounter to count in, so a line with one
 * is not applied outside an encounter (ruling 316).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build and the self-test import it
 * from Node). It imports ./operators.mjs and ./given.mjs.
 */

import { untilWords, untilEdge, DEGREE_NAMES } from "./operators.mjs";
import { settle } from "./given.mjs";

/** The two things a line does, by its tag. */
export const APPLY_OPS = Object.freeze(["apply", "remove"]);

/** Whom a line is about: the creature using the Maneuver, or the one creature it targets. */
export const APPLY_WHO = Object.freeze(["self", "target"]);

/**
 * The Conditions the system itself runs, which no line may put on or take off: the Bind's three
 * mirror `system.bind`, Wounded and Dying mirror the Zones and `system.dying`, Dead and Spent
 * follow Vigor, Preparing follows a Prepared Maneuver. (An Exposed Zone is refused where a name is
 * read, ./effect-list.mjs.)
 */
export const SYSTEM_CONDITIONS = Object.freeze(["bound", "controlling", "controlled", "wounded", "dying", "dead", "spent", "preparing"]);

/** The icon a named Effect is created with. */
export const APPLIED_ICON = "icons/svg/aura.svg";

/**
 * The lines that stand for one use: every line of no degree, and the lines of the degree rolled;
 * each only when the cost it names, if it names one, is the VERSION of the Maneuver that was used
 * (its listed cost; never a price a Condition raised, 0.37.0, ruling 380). With no degree
 * (a check against no Threshold, a Maneuver with no check) only the lines of no degree stand.
 * @param {object[]} lines
 * @param {{degree?: string|null, cost?: number|null}} [use]
 * @returns {object[]}
 */
export function linesFor(lines, { degree = null, cost = null } = {}) {
  return (lines ?? []).filter(line => {
    if (!line || (typeof line !== "object") || !line.effect) return false;
    if (line.degree && (line.degree !== degree)) return false;
    if ((line.cost !== null) && (line.cost !== undefined)) {
      if ((cost === null) || (cost === undefined) || (Number(line.cost) !== Number(cost))) return false;
    }
    return true;
  });
}

/** Does any line wait on the version used (`IF: COST(<n>)`)? Then a use with a range of costs must know which. */
export function needsCost(lines) {
  return (lines ?? []).some(line => (line?.cost !== null) && (line?.cost !== undefined));
}

/**
 * The window a line's `UNTIL` becomes on the Effect, as it is applied in an encounter. Null for a
 * line with none (the Effect lasts until removed). A window whose Opportunities cannot be counted
 * (its owner is no fighter in this Combat) lasts the encounter instead, as a pending result's does.
 * @param {{who: string, n: number, edge?: string}|null} until
 * @param {{giverCombatant?: string|null, recipientCombatant?: string|null}} [who]
 * @returns {{who: string, edge: string|null, combatant: string|null, n: number, begun: number}|null}
 */
export function appliedWindow(until, { giverCombatant = null, recipientCombatant = null } = {}) {
  if (!until) return null;
  const whole = { who: "encounter", edge: null, combatant: null, n: 0, begun: 0 };
  if ((until.who !== "giver") && (until.who !== "recipient")) return whole;
  const combatant = (until.who === "giver") ? giverCombatant : recipientCombatant;
  if (!combatant) return whole;
  const n = Number(until.n);
  return { who: until.who, edge: untilEdge(until), combatant: String(combatant), n: (Number.isInteger(n) && (n >= 1)) ? n : 1, begun: 0 };
}

/**
 * The record an applied Effect carries. Every key, always.
 * @param {object} options
 * @param {{name: string, slug: string, condition?: string|null, value?: number|null}} options.effect
 * @param {{slug: string, name: string}} options.maneuver
 * @param {{uuid: string, name: string}} options.giver   Who used the Maneuver.
 * @param {string|null} [options.combat]   The Combat's id, or null outside an encounter.
 * @param {object|null} [options.until]    `appliedWindow`'s answer.
 * @param {string|null} [options.from]     The card the Effect came from.
 * @returns {object}
 */
export function appliedRecord({ effect, maneuver, giver, combat = null, until = null, from = null }) {
  return {
    slug: String(effect?.slug ?? ""),
    name: String(effect?.name ?? ""),
    condition: effect?.condition ? String(effect.condition) : null,
    by: String(giver?.uuid ?? ""),
    byName: String(giver?.name ?? ""),
    maneuver: String(maneuver?.slug ?? ""),
    maneuverName: String(maneuver?.name ?? ""),
    combat: combat ? String(combat) : null,
    until: until ?? null,
    from: from ? String(from) : null
  };
}

/** Is this value an applied record? */
export function isAppliedRecord(record) {
  return !!record && (typeof record === "object") && (typeof record.slug === "string") && !!record.slug;
}

/**
 * Are these two the same application: the same card, the same giver, the same window? What a
 * window's end asks before it takes an Effect off, since a later APPLY may have given the Effect
 * a new record a moment ago (ruling 314: the later window stands). The count (`begun`) is left out:
 * it moves while the window is the same one.
 * @param {object|null} a
 * @param {object|null} b
 * @returns {boolean}
 */
export function sameApplication(a, b) {
  if (!isAppliedRecord(a) || !isAppliedRecord(b)) return false;
  if ((a.slug !== b.slug) || ((a.from ?? null) !== (b.from ?? null)) || ((a.by ?? "") !== (b.by ?? ""))) return false;
  const shape = u => (u ? [u.who ?? null, u.edge ?? null, u.combatant ?? null, Number(u.n) || 0] : null);
  return JSON.stringify(shape(a.until)) === JSON.stringify(shape(b.until));
}

/**
 * What one turn change does to an applied Effect's window: `"keep"`, `"expire"` or `{ begun }`,
 * as `settle` answers for a pending result (./given.mjs).
 * @param {object} record
 * @param {{combat?: string|null, ended?: string|null, began?: string|null}} change
 */
export function settleApplied(record, change = {}) {
  if (!isAppliedRecord(record)) return "keep";
  return settle({ combat: record.combat, until: record.until }, change);
}

/**
 * Was this Effect put on by that creature? The `mine` word (`IFT: EFFECT(Wrong-Footed, mine)`):
 * "Wrong-Footed to you" is a Condition you put there.
 * @param {object|null} record  The Effect's applied record, or null for one put on by other means.
 * @param {string} uuid         The creature asking.
 * @returns {boolean}
 */
export function appliedBy(record, uuid) {
  return isAppliedRecord(record) && !!uuid && (record.by === uuid);
}

/* -------------------------------------------- */
/*  The build's census                          */
/* -------------------------------------------- */

/**
 * What the build says after reading every cell (0.32.0): two things an author would otherwise
 * find out at the table.
 *
 *  - A NAMED EFFECT THAT IS READ AND NEVER APPLIED: a line asks `EFFECT(Taking Cover)`, or a
 *    Maneuver `[REQUIRES effect Taking Cover]`, and no row's APPLY puts that Effect on. It may be a
 *    typo of the name, or an Effect the GM is meant to add by hand; the line reads, and holds for
 *    nobody until something puts the Effect on.
 *  - AN APPLY OR REMOVE ON A ROW THE SYSTEM RUNS ANOTHER WAY (ruling 321): a built-in (Strike,
 *    Recenter, Reload) or a row whose cost another act pays (Rush is the drag, Cast the spell).
 *    Using such a row never reaches its lines, so they apply nothing.
 *
 *  - A LINE THAT WAITS ON A RESULT, ON A MANEUVER THAT ROLLS NO CHECK (the review of 0.32.0): with
 *    no check there is no degree and no card, so an `IF: RESULT(...)` line never stands. Said only
 *    when the build knows whether the Maneuver rolls (`rolls` on the carrier).
 *
 * A Condition is never counted: the system and the token palette put those on.
 *
 * @param {Array<{source: string, name: string, type: string, rules: object[], rolls?: boolean}>} carriers
 *        Every Item the build read, with the rules its cell parsed to; `rolls` on a Maneuver says
 *        whether it rolls a check of its own, when the build knows.
 * @param {{runsElsewhere?: (slug: string) => boolean, runsItself?: (slug: string) => boolean, takesUse?: (kind: string) => boolean, slugOf?: (name: string) => string}} [options]
 *        `runsElsewhere` answers for a Maneuver's slug (a built-in, or a row another act pays
 *        for); `runsItself` for a built-in alone; `takesUse` for a kind whose line takes the whole
 *        use; `slugOf` makes that slug from its name.
 * @returns {string[]}  The warnings, in the order found.
 */
export function effectCensus(carriers, { runsElsewhere = () => false, runsItself = null, takesUse = () => false, slugOf = name => String(name ?? "") } = {}) {
  // A row the system runs ITSELF (a built-in: Strike, Recenter, Gain Control) never reaches its
  // check. A row whose cost another act pays (Leap is the drag, Cast the spell) is still used from
  // its row and does roll a declared check, so only the first is told its CHECK block is unread
  // (the review of 0.34.0). A caller that knows only `runsElsewhere` gets the wider answer.
  const builtIn = (typeof runsItself === "function") ? runsItself : runsElsewhere;
  const applied = new Set();
  const read = new Map();
  const warnings = [];
  const ask = (slug, name, source) => {
    if (!slug) return;
    const entry = read.get(slug) ?? read.set(slug, { name: String(name ?? slug), askers: [] }).get(slug);
    if (!entry.askers.includes(source)) entry.askers.push(source);
  };
  for (const carrier of carriers ?? []) {
    const source = String(carrier?.source ?? carrier?.name ?? "");
    let said = false;
    let saidNoCheck = false;
    // A CHECK BLOCK THAT IS NEVER ROLLED (0.34.0): on a row the system runs itself, or beside a
    // line whose kind takes the whole use (MARK, PERMIT, SUBORDINATE: `takesUse`).
    const rules = (carrier?.rules ?? []).filter(rule => rule && (typeof rule === "object") && !rule.error);
    const declares = (carrier?.type === "action") && rules.some(rule => rule.kind === "check");
    // A row that declares its check rolls one, whatever the build made of its prose.
    const rollsNone = (carrier?.rolls === false) && !declares;
    if (declares) {
      if (builtIn(slugOf(carrier.name))) {
        warnings.push(`${source}: the system runs this Maneuver itself (its own button or method), so its CHECK block is read by nothing`);
      } else {
        const taker = rules.find(rule => (rule.kind !== "check") && takesUse(rule.kind));
        if (taker) warnings.push(`${source}: a ${String(taker.kind).toUpperCase()} line takes the whole use of this Maneuver, so the check its CHECK block declares is never rolled`);
      }
    }
    for (const rule of carrier?.rules ?? []) {
      if (!rule || (typeof rule !== "object") || rule.error) continue;
      if (rule.kind === "apply") {
        if ((rule.op === "apply") && !rule.effect?.condition && rule.effect?.slug) applied.add(rule.effect.slug);
        const elsewhere = (carrier.type === "action") && runsElsewhere(slugOf(carrier.name));
        if (!said && elsewhere) {
          said = true;
          warnings.push(`${source}: this Maneuver is run by the system another way (its own button, the drag or the spell), so its APPLY and REMOVE lines apply nothing`);
        }
        const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
        if (!saidNoCheck && !elsewhere && (carrier.type === "action") && rollsNone && whens.some(w => w?.outcome)) {
          saidNoCheck = true;
          warnings.push(`${source}: this Maneuver rolls no check, so its APPLY and REMOVE lines that wait on a result (IF: RESULT) never stand; declare the check with a [CHECK ...] block on the row, or drop the IF: RESULT`);
        }
        continue;
      }
      for (const h of Array.isArray(rule.has) ? rule.has : []) if (h && !h.condition) ask(h.slug, h.name, source);
      if (rule.kind === "requires") {
        for (const term of Array.isArray(rule.any) ? rule.any : []) {
          if (term?.test === "effect") ask(term.slug, term.name, source);
          if ((term?.test === "near") && term.with && !term.with.condition) ask(term.with.slug, term.with.name, source);
        }
      }
    }
  }
  for (const [slug, entry] of read) {
    if (applied.has(slug)) continue;
    warnings.push(`EFFECT(${entry.name}): no Maneuver applies an Effect of that name (read by ${entry.askers.join(", ")}); the line holds once something puts it on, by a GM's hand until then`);
  }
  return warnings;
}

/* -------------------------------------------- */
/*  Words                                       */
/* -------------------------------------------- */

/** An Effect as a card names it: "Prone", "Frightened 2", "Taking Cover". */
export function effectWords(effect) {
  const name = String(effect?.name ?? effect?.slug ?? "");
  const value = Number(effect?.value);
  return (Number.isFinite(value) && (value > 0)) ? `${name} ${value}` : name;
}

/**
 * A line in a few words, for a card: "Prone", "Off-Guard until your next Opportunity", "no longer
 * Grabbed". `giver` and `recipient` are the names the window is said with ("you" reads "your").
 * @param {object} line
 * @param {{giver?: string, recipient?: string}} [names]
 * @returns {string}
 */
export function lineWords(line, names = {}) {
  const what = effectWords(line?.effect);
  if (line?.op === "remove") return `no longer ${what}`;
  return line?.until ? `${what} ${untilWords(line.until, names)}` : what;
}

/**
 * What a card says of the lines it applied (0.32.1): every line's sentence, less a REMOVE that
 * found nothing to take off when another line of the same card did or said something. Stand's row
 * carries `REMOVE: prone` and `REMOVE: Supine`, and Escape's one for Grabbed and one for
 * Restrained: the creature has one of the two, and "had no Supine to take off" beside "is no
 * longer Prone" is noise on every use (Mike, 2026-11-18, of Stand's cell). When NOTHING was taken
 * off the sentences stay, so a use or a press is never silent.
 * @param {Array<{line: object, result: object, words: string}>} done  `applyLinesTo`'s answer.
 * @returns {string[]}
 */
export function wordsToSay(done) {
  const entries = (done ?? []).filter(d => d && d.words);
  const idle = d => (d.line?.op === "remove") && (d.result?.skipped === "absent");
  const said = entries.some(d => !idle(d)) ? entries.filter(d => !idle(d)) : entries;
  return said.map(d => d.words);
}

/**
 * A rule in a sentence, for the sheet's As read list: "puts Prone on the target, on a Success",
 * "puts Off-Guard on you until your next Opportunity, on a Critical Failure, when the 2-action
 * version is used", "takes Prone off you". The cost is the VERSION of the Maneuver, its listed
 * cost: through 0.36.0 the words were "when 2 actions are paid", which a Condition that raises
 * the price (0.37.0) would have made untrue.
 * @param {object} rule  The stored rule.
 * @returns {string}
 */
export function ruleWords(rule) {
  const what = effectWords(rule?.effect);
  const whom = (rule?.who === "target") ? "the target" : "you";
  const bits = [(rule?.op === "remove") ? `takes ${what} off ${whom}` : `puts ${what} on ${whom}`];
  if ((rule?.op !== "remove") && rule?.until) {
    bits[0] += ` ${untilWords(rule.until, { giver: "you", recipient: (rule.who === "target") ? "the target" : "you" })}`;
  }
  const whens = Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
  const outcome = whens.find(w => w?.outcome);
  if (outcome) bits.push(`on a ${outcome.name ?? DEGREE_NAMES[outcome.outcome] ?? outcome.outcome}`);
  if ((rule?.cost !== null) && (rule?.cost !== undefined)) {
    bits.push(Number(rule.cost) === 0 ? "when the free version is used" : `when the ${rule.cost}-action version is used`);
  }
  return bits.join(", ");
}
