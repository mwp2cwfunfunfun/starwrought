/**
 * STARWROUGHT: rounds counted from a moment (0.39.0; rulings 393, 394 and 397).
 *
 * Mike, 2026-11-19: "durations like opportunities and rounds are always counted when it was
 * applied. So if someone was 3rd in initiative, and the effect lasts for 1 round, it will last
 * until their first turn in the next round." So a round is never counted to the round's start or
 * end. It is counted from a STAMP, the place in the fight where a thing went on:
 *
 *   { combat, anchor, init, since }
 *
 * `anchor` is the fighter whose Opportunity was running (a Combatant id, or null when nobody's
 * was), `init` that fighter's Initiative, which is its place in the order should it leave the
 * tracker, and `since` the round. A ROUND HAS PASSED when the anchor begins its FIRST Opportunity
 * of a later round. A round here holds several circuits of Opportunities, so the later ones of
 * that round count nothing.
 *
 * WHO STANDS IN (ruling 397). An anchor who is out of the fight (dead and passed over, or gone
 * from the tracker) never begins an Opportunity, so the next fighter in the order holds its
 * place: the first one after it who is still in the fight, wrapping to the top. With nobody, and
 * for a stamp with no anchor at all, the count falls when the round ends.
 *
 * Two users (./given.mjs for a window on a result or an applied Effect; ./effects-state.mjs for a
 * Condition's own value): a plain window stores its stamp and `n` and is never written while it
 * runs, since `since` and the round now say how many have passed; a Condition's clock moves
 * `since` on as it counts, because its value may be lowered more than once.
 *
 * Pure: no Foundry global, no import. The self-test drives it from Node.
 */

/** The flag a Condition's own clock is kept under, on the Condition's effect. */
export const CLOCK_FLAG = "clock";

/**
 * A stamp, every key always.
 * @param {{combat?: string|null, anchor?: string|null, init?: number|null, round?: number|null}} moment
 * @returns {{combat: string, anchor: string|null, init: number|null, since: number}}
 */
export function stampOf({ combat = null, anchor = null, init = null, round = 0 } = {}) {
  const place = ((init === null) || (init === undefined) || (init === "")) ? NaN : Number(init);
  return {
    combat: String(combat ?? ""),
    anchor: anchor ? String(anchor) : null,
    init: Number.isFinite(place) ? place : null,
    since: Math.max(0, Math.trunc(Number(round) || 0))
  };
}

/**
 * Who counts the rounds for a stamp NOW: its anchor while that fighter is in the order and in the
 * fight; else the next fighter in the order after its place, wrapping to the first; null with
 * nobody, and for a stamp that has no anchor.
 * @param {{anchor?: string|null, init?: number|null}} stamp
 * @param {Array<{id: string, initiative?: number|null, out?: boolean}>} order
 *        The turn order now, first to act first. `out`: passed over for good (defeated, with the
 *        tracker set to skip the defeated), never "has no action left this round".
 * @returns {string|null}  A Combatant id.
 */
export function standIn(stamp, order) {
  if (!stamp?.anchor) return null;
  const turns = Array.isArray(order) ? order.filter(f => f && f.id) : [];
  const index = turns.findIndex(f => f.id === stamp.anchor);
  if (index >= 0) {
    if (!turns[index].out) return stamp.anchor;
    // Still in the tracker and passed over: the next one after it who is not.
    for (let i = 1; i < turns.length; i++) {
      const next = turns[(index + i) % turns.length];
      if (!next.out) return next.id;
    }
    return null;
  }
  // Gone from the tracker: its Initiative is its place. The order runs from the highest down,
  // ties by ascending id and the unrolled last (Foundry's own sort), so the first fighter who
  // sorts AFTER that place stood after it: a lower number, or the same number and a later id
  // (the review of 0.39.0: `<=` took a tied fighter who had stood BEFORE the anchor, and an
  // unrolled one was passed over for the top of the order).
  const live = turns.filter(f => !f.out);
  if (!live.length) return null;
  if ((stamp.init === null) || (stamp.init === undefined) || !Number.isFinite(Number(stamp.init))) return live[0].id;
  const place = Number(stamp.init);
  const after = live.find(f => {
    const theirs = ((f.initiative === null) || (f.initiative === undefined) || !Number.isFinite(Number(f.initiative))) ? -Infinity : Number(f.initiative);
    return (theirs < place) || ((theirs === place) && (String(f.id) > String(stamp.anchor)));
  });
  return (after ?? live[0]).id;
}

/**
 * How many rounds have passed for a stamp at this change: 0 for none.
 *
 *   { combat, began, round }   an Opportunity begins, in round `round`
 *   { combat, roundEnded }     a round ends
 *
 * An Opportunity counts only when it is the anchor's (or its stand-in's) and its round is later
 * than `since`: the difference is the answer, so a GM who jumps two rounds forward counts two. A
 * round's end is the last resort, for a stamp nobody counted in that round. A rewind counts
 * nothing: a round at or before `since` never does.
 * @param {{combat: string, anchor?: string|null, init?: number|null, since: number}} stamp
 * @param {{combat?: string|null, began?: string|null, round?: number|null, roundEnded?: number|null}} change
 * @param {Array<{id: string, initiative?: number|null, out?: boolean}>} [order]
 * @returns {number}
 */
export function roundsPassed(stamp, change, order = []) {
  if (!stamp || !change || !stamp.combat || (stamp.combat !== String(change.combat ?? ""))) return 0;
  const since = Math.max(0, Number(stamp.since) || 0);
  if ((change.roundEnded !== null) && (change.roundEnded !== undefined)) {
    const ended = Number(change.roundEnded);
    return (Number.isFinite(ended) && (ended > since)) ? Math.trunc(ended - since) : 0;
  }
  if (!change.began) return 0;
  const round = Number(change.round);
  if (!Number.isFinite(round) || !(round > since)) return 0;
  return (standIn(stamp, order) === String(change.began)) ? Math.trunc(round - since) : 0;
}

/**
 * WHERE IN THE FIGHT WE ARE (rulings 393, 394 and 400): the moment a duration in rounds is
 * counted from. The Combat, the fighter whose Opportunity is running (null when nobody's is),
 * that fighter's Initiative, and the round. Null when the Combat has not started: no rounds
 * pass outside one.
 *
 * `stored` is a moment kept earlier (a check card keeps the one its Maneuver was used at): it
 * stands when it is of the same Combat, so a button pressed late does not move the count.
 * @param {{started?: boolean, id?: string, round?: number, combatant?: {id?: string, initiative?: number|null}|null}|null} combat
 * @param {{combat?: string|null, anchor?: string|null, init?: number|null, round?: number}|null} [stored]
 * @returns {{combat: string, anchor: string|null, init: number|null, round: number}|null}
 */
export function momentIn(combat, stored = null) {
  if (!combat?.started) return null;
  if (stored && (typeof stored === "object") && (stored.combat === combat.id)) {
    return { combat: combat.id, anchor: stored.anchor ?? null, init: stored.init ?? null, round: Number(stored.round) || 0 };
  }
  const now = combat.combatant ?? null;
  const init = now?.initiative;
  return { combat: combat.id, anchor: now?.id ?? null, init: ((init === null) || (init === undefined)) ? null : Number(init), round: Number(combat.round) || 0 };
}

/* -------------------------------------------- */
/*  A window counted in rounds                  */
/* -------------------------------------------- */

/** Is this stored window one counted in rounds? */
export function isRoundWindow(until) {
  return !!until && (typeof until === "object") && (until.who === "round");
}

/**
 * The stamp of a stored window counted in rounds, for `roundsPassed`.
 * @param {object} until    `{ who: "round", n, anchor, init, since }`.
 * @param {string|null} combat  The Combat the thing that carries the window was given in.
 */
export function stampOfWindow(until, combat) {
  return stampOf({ combat, anchor: until?.anchor ?? null, init: until?.init ?? null, round: until?.since ?? 0 });
}

/**
 * Is a window counted in rounds over at this change? It is never written while it runs: the
 * stamp and the round now say how many have passed.
 * @param {object} until    `{ who: "round", n, anchor, init, since }`.
 * @param {string|null} combat
 * @param {object} change   As `roundsPassed` takes it.
 * @param {object[]} [order]
 * @returns {boolean}
 */
export function roundWindowOver(until, combat, change, order = []) {
  if (!isRoundWindow(until)) return false;
  const n = Math.max(1, Math.trunc(Number(until.n) || 1));
  return roundsPassed(stampOfWindow(until, combat), change, order) >= n;
}

/**
 * The round a window counted in rounds ends in, for a screen: the round it went on plus `n`. It
 * ends partway through that round, as its anchor's first Opportunity there begins, so "how many
 * rounds are left" has no whole answer and the round's number is what is said.
 * @param {object} until  `{ who: "round", n, since }`.
 * @returns {number}
 */
export function endsInRound(until) {
  const n = Math.max(1, Math.trunc(Number(until?.n) || 1));
  return Math.max(0, Math.trunc(Number(until?.since) || 0)) + n;
}

/* -------------------------------------------- */
/*  A Condition's own value, dropping           */
/* -------------------------------------------- */

/**
 * What a Condition's row says of its own value (`UNTIL: each round -1` on one of its lines): the
 * drops, one for each line that carries one, as `{ every, step }`.
 * @param {object[]} rules  The row's parsed rules.
 * @returns {Array<{every: number, step: number}>}
 */
export function fadesOf(rules) {
  const out = [];
  for (const rule of rules ?? []) {
    const until = rule?.until;
    if (!until || (until.who !== "round") || (until.each !== true)) continue;
    out.push({ every: Math.max(1, Math.trunc(Number(until.n) || 1)), step: Math.max(1, Math.trunc(Number(until.step) || 1)) });
  }
  return out;
}

/**
 * The one drop a Condition has, or null. A value is one number (ruling 398), so the first line
 * that says so is the word; the build refuses a row whose lines disagree.
 * @param {object[]} rules
 * @returns {{every: number, step: number}|null}
 */
export function fadeOf(rules) {
  return fadesOf(rules)[0] ?? null;
}

/** Do a row's lines say two different things of its value? For the build. */
export function fadesDisagree(rules) {
  const all = fadesOf(rules);
  return all.some(f => (f.every !== all[0].every) || (f.step !== all[0].step));
}

/**
 * A Condition's clock as it goes on: the stamp, a count of rounds and the HOLDER, every key
 * always. The holder is the Combatant the creature is fighting as (the review of 0.39.0): a
 * creature that leaves the tracker and comes back does so as a new Combatant, and the rounds it
 * spent out of the fight must not be counted (ruling 399), so a clock is its Combat's only
 * while its holder is still one of the creature's Combatants there.
 * @param {object} moment  As `stampOf` takes it.
 * @param {string|null} [holder]  The Combatant id of the creature that has the Condition.
 * @returns {{combat: string, anchor: string|null, init: number|null, since: number, count: number, holder: string|null}}
 */
export function clockOf(moment, holder = null) {
  return { ...stampOf(moment), count: 0, holder: holder ? String(holder) : null };
}

/**
 * Is this a clock of that Combat, still counting for this creature? `holders` are the ids of
 * the creature's Combatants in the Combat now; with none given, the Combat alone is asked.
 * @param {object|null} clock
 * @param {string|null} combat
 * @param {string[]|null} [holders]
 */
export function clockRuns(clock, combat, holders = null) {
  if (!clock || (typeof clock !== "object") || !clock.combat || (clock.combat !== String(combat ?? ""))) return false;
  return !Array.isArray(holders) || (!!clock.holder && holders.includes(clock.holder));
}

/**
 * Are these the same clock at the same count? What a drop asks before it lands (the review of
 * 0.39.0): the tick is worked out before the write is queued, and a raise or another drop may
 * land in between, so the write goes ahead only on the clock the tick was worked out from.
 */
export function sameClock(a, b) {
  if (!a || !b || (typeof a !== "object") || (typeof b !== "object")) return false;
  return (a.combat === b.combat) && ((a.anchor ?? null) === (b.anchor ?? null))
    && ((Number(a.since) || 0) === (Number(b.since) || 0)) && ((Number(a.count) || 0) === (Number(b.count) || 0));
}

/**
 * One change on a Condition's clock: how far its value drops, and the clock to keep. `clock` is
 * null when nothing moved (no write is owed).
 * @param {object} clock   `clockOf(...)`.
 * @param {{every: number, step: number}} fade
 * @param {object} change  As `roundsPassed` takes it.
 * @param {object[]} [order]
 * @returns {{drop: number, clock: object|null}}
 */
export function tickFade(clock, fade, change, order = []) {
  const passed = (clock && fade) ? roundsPassed(clock, change, order) : 0;
  if (!passed) return { drop: 0, clock: null };
  const every = Math.max(1, Math.trunc(Number(fade.every) || 1));
  const step = Math.max(1, Math.trunc(Number(fade.step) || 1));
  const before = Math.max(0, Math.trunc(Number(clock.count) || 0));
  const count = before + passed;
  const drop = (Math.floor(count / every) - Math.floor(before / every)) * step;
  return { drop, clock: { ...stampOf({ combat: clock.combat, anchor: clock.anchor, init: clock.init, round: (Number(clock.since) || 0) + passed }), count, holder: clock.holder ?? null } };
}
