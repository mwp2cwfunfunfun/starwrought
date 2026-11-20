/**
 * The shared vocabularies and readings of the Automation grammar (0.13.0; AUTOMATION_GRAMMAR.md).
 *
 * Written for the 0.13.0 operator form (`<kind>: <arg>, ..., <OPERATOR>(...)`), which 0.17.0
 * refuses; what remains is what the effect reader (./effects.mjs) and the hooks still use: the
 * `ops` record every reader fills (`emptyOps`), the readers of one condition's contents (`readIf`,
 * `readFor`, `readWhile`, `readAgainst`, `readDegree`, `readRank`, `readRange`, `readWho`), the
 * one reading of a target's name (`readTargetName`, 0.21.0), the refusals (`refuseComponents`, `refuseOutcome`) and the hooks' tests (`rankMeets`, `whoMatches`,
 * `hasTrait`, `againstHolds`, `markedHolds`, `needsMoment`, `summarizeOperators`). The names below
 * are the old operators' because the stored rule shapes are theirs; the component each became is
 * section 9 of the document, and `OPERATORS` is kept for that table's gate.
 *
 * The record, and what each reading stores on the rule:
 *
 *   IF(<Constellation><op><Rank>)   when: [{ constellation, name, op, rank }]; `Origin` is the pooled
 *                                   Origin rank; `IF(Rank=<Rank>)` is the roll's own rank:
 *                                   { roll: true, op, rank }. <op> is =, >= or <=. Several IFs on one
 *                                   line must all hold. `IF(Trait=<Trait>)` (0.14.0) is the attack
 *                                   answered carrying the trait: { trait: "fear", name: "Fear" }.
 *   FOR(<Who>[, <N>ft])             for: { who, range }   who: self | allies | enemies | all | self+allies
 *   WHILE(<Who><op><N>[, <N>ft])    while: { who, op, count, range }   who: allies | enemies | all
 *   AGAINST(<Threat>)               against: { threat, reach, check, name }   threat: blow | blast | blight
 *                                   | beguilement | null; reach: melee | ranged | null; check (0.15.0): the
 *                                   slug of a Constellation whose check is read against this Defense
 *                                   (`AGAINST(Intimidation)`), else null
 *   FIRST(round)                    limit: { per: "round" }
 *   ONCE(encounter)                 limit: { per: "encounter" }
 *   DIFFERENT                       different: true
 *   VISIBLE                         visible: true
 *   SEEN                            seen: true  (0.14.0: only for a recipient who can see the owner)
 *   CLAIM(<text>)                   claim: { text }  (0.15.0: offered in the roll dialog, the player decides)
 *   MARKED                          marked: true  (0.15.0: the roll's other party is the creature this
 *                                   Talent's `mark` named)
 *   IF(Outcome=<Degree>)            when: [{ outcome: "critFail", name: "Critical Failure" }]  (0.15.0: the
 *                                   roll's degree; only a kind that acts after the die reads it, `reroll`)
 *
 * Also here, for the hooks: `rankMeets(actual, op, wanted)` over SW.RANKS' order, `whoMatches(who,
 * relation)` over the scene's relation words, `hasTrait(traits, word)` over an attack's traits,
 * `againstHolds(rule, threat)` and `markedHolds(rule, entry, context)` (0.15.0), the shared readings
 * of AGAINST and MARKED, and `needsMoment(rule)`, true when a rule can only be read where the map,
 * the Threat, the round or the other party is known (a FOR that reaches others, a WHILE, a SEEN, an
 * AGAINST, an IF on a Trait, a FIRST or ONCE, a CLAIM, a MARKED), which is how the Defense pass on
 * the sheet and the roll tell their halves apart.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. The build imports the kinds from
 * plain Node, and a kind imports this. It imports `syntax.mjs` (which imports nothing) and
 * `config.mjs` (pure), never the grammar or the registry, so no circle exists.
 */

import { RuleSyntaxError } from "./syntax.mjs";
import { RANKS, THREATS, DEGREES, isLoreSlug, flagKey, ruleCarrierKey, slugify, plainName, LEGACY_BONUS_TYPES } from "../config.mjs";
import { listHas } from "./effect-list.mjs";

/**
 * The operator names of the 0.13.0 form (`kind: arg, arg, OP(...)`), refused since 0.17.0. The
 * build checks each is still named in the grammar document's section 9, the map from the old
 * operator to its component, which is what a GM with an old world Item reads.
 */
export const OPERATORS = Object.freeze(["IF", "FOR", "WHILE", "AGAINST", "SEEN", "FIRST", "ONCE", "DIFFERENT", "VISIBLE", "CLAIM", "MARKED"]);

/** A fresh operator record, the shape every reader fills (the effect reader's components). */
export function emptyOps() {
  return {
    when: null, for: null, while: null, against: null, limit: null, different: false, visible: false, seen: false, claim: null, marked: false,
    // 0.22.0: `UNTIL:` (a GIVE line's window, `{ who, n }`) and `VALUE:` (what an ALTER line's
    // property becomes, the text as written). The effect reader lets each be written on its own
    // tag alone, so no other kind ever sees one filled.
    until: null, set: null,
    // 0.25.0: `IF: EFFECT(<name>, used)`, `{ name, slug }`: a roll of the owner's has just used up
    // the Effect of that name. Under its own key and never in `when`, where every kind reads rank
    // conditions: a kind with no use for it then refuses it by name (`refuseComponents`).
    used: null,
    // 0.31.0: `IF: EFFECT(<name>)` and `IFT: EFFECT(<name>)`, a list of `{ name, slug, condition,
    // on }`: a creature HAS the Condition or the named Effect now, `on` "self" for the roller (IF)
    // and "other" for the roll's other party (IFT). Under its own key for the same reason; null
    // when the line asks for none, so a stored rule that asks for none carries nothing new.
    // Since 0.32.0 an entry may carry `mine: true` (`EFFECT(<name>, mine)`): the one asking put it there.
    has: null,
    // 0.32.0: `IF: COST(<n>)`, the version of the Maneuver that was used, by its listed cost (never
    // a price a Condition raised; 0.37.0, ruling 380). Read by `apply` alone; null when the line
    // names none.
    cost: null
  };
}

/** The three type words of PHB v3.3, lower-cased: where a bonus or penalty comes from. */
export const BONUS_TYPES = Object.freeze(["situation", "condition", "gear"]);

/**
 * The bonus type word, checked; the retired words name the current one. One reading for `bonus`
 * and `give` (0.22.0; through 0.21.0 it was `bonus`'s own).
 * @param {string} word
 * @returns {string}  One of BONUS_TYPES.
 */
export function readBonusType(word) {
  const lower = String(word ?? "").toLowerCase();
  if (BONUS_TYPES.includes(lower)) return lower;
  if (Object.hasOwn(LEGACY_BONUS_TYPES, lower)) {
    throw new RuleSyntaxError(`write ${titled(LEGACY_BONUS_TYPES[lower])}, not ${lower}: the book renamed the types in v3.3`);
  }
  if (lower === "untyped") throw new RuleSyntaxError("no Talent bonus is untyped; name situation, condition or gear after the value");
  throw new RuleSyntaxError(`"${word}" is not a bonus type: write situation, condition or gear`);
}

/** The shapes a window is written in, for messages. */
const UNTIL_SHAPES = "`giver opportunity`, `recipient opportunity <N>`, `<N> rounds` or `encounter`";
/** The same where a last word may name the edge (an APPLY line's window, 0.32.0). */
const UNTIL_EDGE_SHAPES = "`giver opportunity`, `giver opportunity end`, `recipient opportunity`, `recipient opportunity start`, `<N> rounds` or `encounter`";
/** The last word of a window with edges, to the edge it names. */
const UNTIL_EDGES = Object.freeze({ end: "end", start: "begin", begin: "begin" });
/** The most rounds a duration may count, and the most a Condition's value may drop at once (0.39.0). */
export const UNTIL_ROUNDS_MAX = 99;
export const UNTIL_DROP_MAX = 9;
/** A minus as a cell may hold it: the hyphen, or the minus sign a word processor makes of it. */
const MINUS = new RegExp(`^[-${String.fromCharCode(0x2212)}]`);
/** What is told to a line that names a round's start or end (0.39.0; rulings 393 and 394). */
const ROUNDS_FROM_WHEN = "a round is counted from when the effect goes on, never from the round's start or end: write how many rounds it lasts, as in `1 round`";
/**
 * Where the drop is written, for a line that is no Condition's row. The tail is for the natural
 * next try after APPLY (the review of 0.39.0): `APPLY: frightened 2; UNTIL: 2 rounds` is refused
 * too, since a Condition with a value moves by its own row.
 */
const DROP_ELSEWHERE = "`each round -1` lowers a Condition's own value as rounds pass, and is written on that Condition's row of the Conditions workbook; here write how long it lasts, as in `2 rounds` (beside a Condition with a value APPLY takes no UNTIL at all: that Condition moves by its own row)";
/**
 * What a Condition's own row is told for anything but its one shape (the review of 0.39.0: the
 * general messages named four windows that row then refuses, and never the one it reads).
 */
const dropShape = written => `on a Condition's row UNTIL says how its value drops as rounds pass: write \`each round -1\` (or \`each 2 rounds -1\`), not "${written}"`;

/**
 * A window counted in ROUNDS (0.39.0; Mike, 2026-11-19: "durations like opportunities and rounds
 * are always counted when it was applied"). Two shapes, or null when the words are not about
 * rounds at all:
 *
 *   <N> round(s)                 it lasts N rounds from when it goes on        { who: "round", n }
 *   each [<N>] round(s) -<k>     a Condition's own value drops by k for every N rounds that pass
 *                                { who: "round", n, step: k, each: true }; read only with `drops`
 *
 * A leading `for` is let through (`for 2 rounds` is how the book says it). Every near miss is told
 * what to write, the retired idea of a round's end first.
 * @param {string[]} words  The window's words, lower-cased.
 * @param {{drops?: boolean}} options
 * @returns {object|null}
 */
function readRounds(words, { drops = false } = {}) {
  const isCount = w => /^\d+$/.test(w ?? "");
  const isRound = w => /^rounds?$/.test(w ?? "");
  if (!words.some(isRound)) return null;
  const written = words.join(" ");
  // The filler the book's own sentence carries is let through: "for 2 rounds", "for the next 2
  // rounds", "the next 2 rounds". Only before a count: "next round" names a round, not a length.
  let all = [...words];
  if (all[0] === "for") all = all.slice(1);
  if ((all[0] === "the") && (all[1] === "next") && isCount(all[2])) all = all.slice(2);
  else if ((all[0] === "next") && isCount(all[1])) all = all.slice(1);
  const drop = w => (MINUS.test(w ?? "") && /^\d+$/.test(w.slice(1))) ? Number(w.slice(1)) : null;
  const count = (w, example = "2 rounds") => {
    const n = Number(w);
    if (Number.isInteger(n) && (n >= 1) && (n <= UNTIL_ROUNDS_MAX)) return n;
    throw new RuleSyntaxError(`"${w}" is not a count of rounds: write a whole number from 1 to ${UNTIL_ROUNDS_MAX}, as in \`${example}\``);
  };
  // The retired idea first: a round's start or end is no moment a duration is counted to. On a
  // Condition's row the answer leads with the one shape that row reads.
  if (all.some(w => ["end", "ends", "start", "starts", "beginning", "begin", "begins", "next"].includes(w))) {
    throw new RuleSyntaxError(drops
      ? `"${written}": on a Condition's row write \`each round -1\`: its value drops for each round that passes since it went on, never at a round's start or end`
      : `"${written}": ${ROUNDS_FROM_WHEN}`);
  }
  // `each [<N>] round(s) -<k>`: a Condition's own value, dropping.
  if ((all[0] === "each") || (all[0] === "every")) {
    const rest = all.slice(1);
    const n = isCount(rest[0]) ? count(rest.shift(), "each 2 rounds -1") : 1;
    if (!isRound(rest[0])) throw new RuleSyntaxError(`"${written}": a value that drops is written \`each round -1\` or \`each 2 rounds -1\``);
    if (rest.length === 1) throw new RuleSyntaxError(`"${written}" does not say how much it drops: write \`each round -1\``);
    const k = (rest.length === 2) ? drop(rest[1]) : null;
    if ((k === null) || (k < 1) || (k > UNTIL_DROP_MAX)) {
      throw new RuleSyntaxError(`"${written}": the drop is a minus and a whole number from 1 to ${UNTIL_DROP_MAX}, as in \`each round -1\``);
    }
    if (!drops) throw new RuleSyntaxError(DROP_ELSEWHERE);
    return { who: "round", n, step: k, each: true };
  }
  // The drop written the other way round, or after a plain count: told the one shape.
  if (all.some(w => drop(w) !== null)) {
    throw new RuleSyntaxError(drops
      ? `"${written}": a value that drops is written \`each round -1\` (or \`each 2 rounds -1\`)`
      : DROP_ELSEWHERE);
  }
  if ((all.length === 2) && isRound(all[1]) && isCount(all[0])) return { who: "round", n: count(all[0]) };
  if (drops) throw new RuleSyntaxError(dropShape(written));
  if ((all.length === 1) && isRound(all[0])) throw new RuleSyntaxError(`"${written}" does not say how many: write \`1 round\` or \`2 rounds\``);
  throw new RuleSyntaxError(`a duration in rounds is written \`<N> rounds\`, as in \`2 rounds\`, not "${written}"`);
}

/**
 * A window (0.22.0): how long a result a Maneuver GIVES stays pending on its recipient. Written
 * after `UNTIL:` on a GIVE line and after `VALUE:` on an ALTER line that changes a duration.
 *
 *   giver opportunity [N]       until the giver's Nth next Opportunity BEGINS (N is 1 when left out)
 *   recipient opportunity [N]   through the END of the recipient's Nth upcoming Opportunity
 *   encounter                   until the encounter ends
 *
 * Every window also ends with the encounter; outside one, a result lasts until it is used,
 * replaced or removed.
 *
 * WITH `edges` (0.32.0; an `APPLY` line's window alone asks for them) a last word says which edge
 * of that Opportunity closes the window, so all four are writable:
 *
 *   giver opportunity            as above: it BEGINS            ("until your next Opportunity")
 *   giver opportunity end        it ENDS                        ("until the end of your next Opportunity")
 *   recipient opportunity        as above: it ENDS              ("through its next Opportunity")
 *   recipient opportunity start  it BEGINS                      ("until its next Opportunity")
 *
 * The edge is stored only when written (`edge: "begin" | "end"`), so a window with none reads as
 * it always did. Opt-in because GIVE and ALTER share this reader and what they store and settle
 * (./given.mjs) keeps no edge: read there, the word would be accepted and lost.
 *
 * A WINDOW IN ROUNDS (0.39.0) is read wherever a window is: `<N> rounds`, counted from when the
 * thing goes on (./clock.mjs says when a round has passed). WITH `drops` (a Condition's own row
 * alone asks for it) the words may instead say how that Condition's value falls: `each round -1`.
 * @param {string} text
 * @param {{edges?: boolean, drops?: boolean}} [options]
 * @returns {{who: "giver"|"recipient"|"encounter"|"round", n: number, edge?: "begin"|"end", step?: number, each?: true}}
 */
export function readUntil(text, { edges = false, drops = false } = {}) {
  const words = String(text ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if ((words.length === 1) && (words[0] === "encounter")) return { who: "encounter", n: 0 };
  const rounds = readRounds(words, { drops });
  if (rounds) return rounds;
  if (!drops) return readOpportunities(words, text, edges);
  // A CONDITION'S ROW: a window of Opportunities that reads is handed on, and the kind says such
  // a window is not read on a row yet (ruling 402). Anything that does not read is told the one
  // shape the row does read, never the four it refuses (the review of 0.39.0).
  try {
    return readOpportunities(words, text, false);
  } catch {
    throw new RuleSyntaxError(dropShape(String(text ?? "").trim()));
  }
}

/** A window of Opportunities, the reading `readUntil` has had since 0.22.0 (edges since 0.32.0). */
function readOpportunities(words, text, edges) {
  const shapes = edges ? UNTIL_EDGE_SHAPES : UNTIL_SHAPES;
  if (["giver", "recipient"].includes(words[0]) && (words[1] === "opportunity")) {
    const rest = words.slice(2);
    let edge = null;
    if (edges && rest.length && Object.hasOwn(UNTIL_EDGES, rest.at(-1))) edge = UNTIL_EDGES[rest.pop()];
    // An edge where none is read (GIVE, ALTER) is told so, rather than called a bad count.
    if (!edges && rest.length && Object.hasOwn(UNTIL_EDGES, rest.at(-1))) {
      throw new RuleSyntaxError(`"${rest.at(-1)}": a window's edge is written after APPLY alone; here a giver's window ends as that Opportunity begins and a recipient's as it ends`);
    }
    if (rest.length <= 1) {
      const n = rest.length ? Number(rest[0]) : 1;
      if (Number.isInteger(n) && (n >= 1) && (n <= 9)) return edge ? { who: words[0], n, edge } : { who: words[0], n };
      throw new RuleSyntaxError(`"${rest[0]}" is not a count of Opportunities: write a whole number from 1 to 9, as in \`recipient opportunity 2\``);
    }
  }
  throw new RuleSyntaxError(`a window is written ${shapes}, not "${String(text ?? "").trim()}"`);
}

/** The edge a window closes on when it names none: a giver's as it begins, a recipient's as it ends. */
export function untilEdge(until) {
  if (until?.edge === "begin" || until?.edge === "end") return until.edge;
  return (until?.who === "recipient") ? "end" : "begin";
}

/** "second", "third": the ordinal a window's words print; a plain number above ninth. */
function ordinal(n) {
  return ["", "next", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"][n] ?? `${n}th`;
}

/**
 * A window in words, for a summary: "until the giver's next Opportunity", "through the
 * recipient's second upcoming Opportunity", "until the encounter ends". `giver` and `recipient`
 * may be names, so a card can say "until Tess's next Opportunity".
 * @param {{who: string, n: number}|null} until
 * @param {{giver?: string, recipient?: string}} [names]
 * @returns {string}
 */
export function untilWords(until, { giver = "the giver", recipient = "the recipient" } = {}) {
  // "your" for a card that speaks to its reader, "their" for a creature the sentence has already
  // named (0.32.0); any other name takes 's.
  const possessive = name => ((name === "you") ? "your" : ((name === "they") ? "their" : `${name}'s`));
  // 0.39.0: a window in rounds, and a Condition's value dropping as rounds pass.
  if (until?.who === "round") {
    const n = Math.max(1, Number(until.n) || 1);
    // A sentence of its own, since a summary sets it after the line's conditions and it holds
    // whatever they say (the review of 0.39.0).
    if (until.each) {
      const step = Math.max(1, Number(until.step) || 1);
      return n === 1 ? `its value drops by ${step} each round` : `its value drops by ${step} every ${n} rounds`;
    }
    return n === 1 ? "for 1 round" : `for ${n} rounds`;
  }
  if (!until || (until.who === "giver") || (until.who === "recipient")) {
    const whose = possessive((until?.who === "recipient") ? recipient : giver);
    const n = Math.max(1, Number(until?.n) || 1);
    // The edge decides the word (0.32.0): "until" it begins, "through" its end.
    if (untilEdge(until) === "end") return n === 1 ? `through ${whose} next Opportunity` : `through ${whose} ${ordinal(n)} upcoming Opportunity`;
    return n === 1 ? `until ${whose} next Opportunity` : `until ${whose} ${ordinal(n)} Opportunity from now`;
  }
  return "until the encounter ends";
}

/** The degree words `IF(Outcome=...)` reads, squeezed of spaces and lower-cased, to the keys of SW.DEGREES. */
const DEGREE_WORDS = Object.freeze({
  criticalsuccess: "critSuccess", critsuccess: "critSuccess",
  success: "success",
  failure: "fail", fail: "fail",
  criticalfailure: "critFail", critfailure: "critFail", critfail: "critFail"
});
/** The degree names as the Result table prints them, for messages and summaries. */
export const DEGREE_NAMES = Object.freeze({ critSuccess: "Critical Success", success: "Success", fail: "Failure", critFail: "Critical Failure" });

/** The subjects a FOR may name. */
export const WHO_FOR = Object.freeze(["self", "allies", "enemies", "all", "self+allies"]);
/** The subjects a WHILE may count. */
export const WHO_WHILE = Object.freeze(["allies", "enemies", "all"]);
/** The Threat words, and the two reach words, AGAINST reads. */
export const REACH_WORDS = Object.freeze(["melee", "ranged"]);

/** `WHILE(allies>=1, 0ft)`: the comparison words, longest first so `>=` is read before `>`. */
const COMPARISONS = Object.freeze([">=", "<=", "==", "=", ">", "<"]);

/** A range in feet: `15ft`, `15 ft`, `15 feet`, `0ft`. */
const RANGE = /^(\d+)\s*(?:ft\.?|feet|foot)?$/i;
/** An operator call, `NAME(contents)`, or a bare flag word in capitals. */
const CALL = /^([A-Za-z]+)\s*\(([\s\S]*)\)$/;

/** The word in Title Case for a message: "expert" to "Expert". */
export function titled(word) {
  const w = String(word ?? "");
  return w ? w[0].toUpperCase() + w.slice(1) : w;
}

/* -------------------------------------------- */
/*  Splitting                                   */
/* -------------------------------------------- */

/** A letter or a digit: an apostrophe that follows one is inside a word (`Hunter's`), not a quote. */
export const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Split a line's arguments on the commas at parenthesis depth 0 and outside quotes, each part
 * trimmed, empty parts dropped. `splitArgs` in syntax.mjs knows quotes but not parentheses, and an
 * operator's contents hold commas (`FOR(allies, 15ft)`), so this is the split every operator-aware
 * kind uses. An unclosed parenthesis or quote is a RuleSyntaxError.
 * @param {string} text
 * @returns {string[]}
 */
export function splitOperands(text) {
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = null;
  let before = "";
  for (const ch of String(text ?? "")) {
    const prev = before;
    before = ch;
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    // An apostrophe inside a word is a letter of it, never an opening quote (0.31.0, the review):
    // `EFFECT(Hunter's Mark)` and `CLAIM(when it's raining)` read.
    if ((ch === '"') || ((ch === "'") && !WORD_CHAR.test(prev))) {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0) throw new RuleSyntaxError("a ) has no ( before it");
    }
    if ((ch === ",") && (depth === 0)) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (quote) throw new RuleSyntaxError(`an opening ${quote} has no closing ${quote}`);
  if (depth > 0) throw new RuleSyntaxError("a ( has no closing )");
  parts.push(current);
  return parts.map(p => p.trim()).filter(p => p !== "");
}

/* -------------------------------------------- */
/*  The vocabularies                            */
/* -------------------------------------------- */

/**
 * The rank word, checked against the keys of SW.RANKS. The message lists all five, since the
 * likeliest slip is a tier letter or a plural.
 * @param {string} word
 * @returns {string} A key of RANKS.
 */
export function readRank(word) {
  const lower = String(word ?? "").trim().toLowerCase();
  if (Object.hasOwn(RANKS, lower)) return lower;
  const names = Object.keys(RANKS).map(titled);
  throw new RuleSyntaxError(`"${String(word ?? "").trim()}" is not a rank: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
}

/**
 * A range, `15ft` or `15 ft` or `15 feet`, as a whole number of feet. `0ft` is adjacency.
 * @param {string} word
 * @returns {number}
 */
export function readRange(word) {
  const match = String(word ?? "").trim().match(RANGE);
  if (!match) throw new RuleSyntaxError(`a range is written <N>ft, as in 15ft, not "${String(word ?? "").trim()}"`);
  return Number(match[1]);
}

/** The subject word of a FOR or a WHILE, lower-cased and checked against the list given. */
export function readWho(word, allowed) {
  const lower = String(word ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (allowed.includes(lower)) return lower;
  throw new RuleSyntaxError(`a who is written ${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}, not "${String(word ?? "").trim()}"`);
}

/** `<left><op><right>` with the comparison words, longest first. Null when no comparison is in it. */
export function splitComparison(text) {
  for (const op of COMPARISONS) {
    const at = text.indexOf(op);
    if (at > 0) return { left: text.slice(0, at).trim(), op: op === "==" ? "=" : op, right: text.slice(at + op.length).trim() };
  }
  return null;
}

/**
 * `IF(<Constellation>=<Rank>)`: the owner's rank in a Constellation, `=` equality (a Talent that
 * scales by rank writes one line per rank), `>=` and `<=` also read. `Origin` is the pooled rank
 * of Ancestry, Bloodline and Culture (SW.ORIGIN_SLUG), which the resolver answers as a
 * Constellation. `Rank` is the reserved word for the roll's own rank (`IF(Rank=Untrained)`, Jack
 * of All Trades). `Trait` (0.14.0) is the reserved word for the attack's traits: `IF(Trait=Fear)`
 * holds when the attack a Defense answers carries Fear, read with `=` alone and matched on the
 * trait's first word (`hasTrait`); the build warns, never fails, on a trait nothing carries yet.
 * With a resolver the name must resolve to a Constellation that is not a group (a group wears its
 * parent's rank, so the parent is named); a Lore is refused with or without one.
 */
export function readIf(inside, context) {
  const cmp = splitComparison(inside);
  if (!cmp || !cmp.left || !cmp.right || ![ "=", ">=", "<=" ].includes(cmp.op)) {
    throw new RuleSyntaxError("IF is written `IF(<Constellation>=<Rank>)` (also >= and <=), as in `IF(Origin=Trained)`");
  }
  if (cmp.left.toLowerCase() === "trait") {
    if (cmp.op !== "=") throw new RuleSyntaxError("IF(Trait=<Trait>) names the trait with = only");
    const name = cmp.right.replace(/\s+/g, " ");
    if (!/^[A-Za-z][A-Za-z0-9 '-]*$/.test(name)) throw new RuleSyntaxError(`"${cmp.right}" is not a trait word (letters, as the Traits columns print it)`);
    return { trait: traitKey(name), name };
  }
  // `Outcome` (0.15.0): the roll's degree, for a kind that acts after the die (reroll).
  if (cmp.left.toLowerCase() === "outcome") {
    if (cmp.op !== "=") throw new RuleSyntaxError("IF(Outcome=<Degree>) names the degree with = only");
    const outcome = readDegree(cmp.right);
    return { outcome, name: DEGREE_NAMES[outcome] };
  }
  const rank = readRank(cmp.right);
  if (cmp.left.toLowerCase() === "rank") return { roll: true, op: cmp.op, rank };
  const resolve = context?.resolve;
  let out;
  if (typeof resolve === "function") {
    const found = resolve(cmp.left);
    if (!found || (found.type !== "constellation") || !found.slug) throw new RuleSyntaxError(`"${cmp.left}" is not a Constellation`);
    if (found.group) {
      const parent = found.parent ? ` test ${found.parent} instead` : " test its parent instead";
      throw new RuleSyntaxError(`"${found.name ?? cmp.left}" is a group and has no rank of its own;${parent}`);
    }
    out = { constellation: String(found.slug), name: String(found.name ?? cmp.left), op: cmp.op, rank };
  } else {
    out = { constellation: slugOf(cmp.left), name: cmp.left, op: cmp.op, rank };
  }
  if (isLoreSlug(out.constellation)) throw new RuleSyntaxError("a Lore is the character's own; a rank condition cannot name it");
  return out;
}

/** `FOR(<Who>[, <N>ft])`. `FOR(self)` takes no range: the owner is always within reach of themself. */
export function readFor(inside) {
  const parts = splitOperands(inside);
  if (!parts.length || (parts.length > 2)) throw new RuleSyntaxError("FOR is written `FOR(<Who>[, <N>ft])`, as in `FOR(allies, 15ft)`");
  const who = readWho(parts[0], WHO_FOR);
  const range = (parts.length === 2) ? readRange(parts[1]) : null;
  if ((who === "self") && (range !== null)) throw new RuleSyntaxError("FOR(self) takes no range");
  return { who, range };
}

/** `WHILE(<Who><op><N>[, <N>ft])`: a count of tokens around the owner. No range means anywhere on the scene. */
export function readWhile(inside) {
  const parts = splitOperands(inside);
  if (!parts.length || (parts.length > 2)) throw new RuleSyntaxError("WHILE is written `WHILE(<Who><op><N>[, <N>ft])`, as in `WHILE(allies>=1, 0ft)`");
  const cmp = splitComparison(parts[0]);
  if (!cmp || !/^\d+$/.test(cmp.right)) throw new RuleSyntaxError("WHILE is written `WHILE(<Who><op><N>[, <N>ft])`, as in `WHILE(allies>=1, 0ft)`");
  const who = readWho(cmp.left, WHO_WHILE);
  const range = (parts.length === 2) ? readRange(parts[1]) : null;
  return { who, op: cmp.op, count: Number(cmp.right), range };
}

/**
 * `AGAINST(<Threat>)`: a Threat word, or `Melee` / `Ranged` for a Blow by how it reached, or
 * (0.15.0) a Constellation by name: only when the check read against this Defense rolls it
 * (`AGAINST(Intimidation)`, Iron Etiquette). With a resolver the name must be a Constellation that
 * is not a group (a group's Talents roll the parent, so the parent is named); without one the slug
 * is made here. A Lore is refused: nothing rolls a Lore against a Defense.
 */
export function readAgainst(inside, context = {}) {
  const written = String(inside ?? "").trim();
  const word = written.toLowerCase();
  if (Object.hasOwn(THREATS, word)) return { threat: word, reach: null, check: null, name: null };
  if (REACH_WORDS.includes(word)) return { threat: "blow", reach: word, check: null, name: null };
  const resolve = context?.resolve;
  let check;
  let name;
  if (typeof resolve === "function") {
    const found = resolve(written);
    if (!found || (found.type !== "constellation") || !found.slug) {
      const names = [...Object.keys(THREATS).map(titled), ...REACH_WORDS.map(titled)];
      throw new RuleSyntaxError(`"${written}" is not a Threat (${names.join(", ")}) or a Constellation`);
    }
    if (found.group) {
      const parent = found.parent ? ` write ${found.parent} instead` : " write its parent instead";
      throw new RuleSyntaxError(`"${found.name ?? written}" is a group and its Talents roll the parent;${parent}`);
    }
    check = String(found.slug);
    name = String(found.name ?? written);
  } else {
    check = slugOf(written);
    name = written;
    if (!check) throw new RuleSyntaxError("AGAINST is written `AGAINST(<Threat>)` or `AGAINST(<Constellation>)`, as in `AGAINST(Blow)`");
  }
  if (isLoreSlug(check)) throw new RuleSyntaxError("a Lore is the character's own; nothing rolls it against a Defense");
  return { threat: null, reach: null, check, name };
}

/**
 * A Constellation or a Maneuver by the name a cell wrote (0.21.0): the one reading behind the
 * targets of `bonus`, `reroll` and `substitute`, which through 0.20.1 each kept a copy. With the
 * caller's resolver: the canonical name, the slug and the type, with the resolver's own record
 * under `found` (its `group` and `parent` are a kind's to read, never to store), or null when the
 * resolver knows nothing by the name. Without one: the name as written, the slug made here (a
 * Maneuver's glyphs never reach it, so `Aid ❶ (⓿↺)` and `Aid` are one target) and a null type.
 * The refusals are each kind's own: a scope word, a Lore, a wrong type.
 * @param {string} written
 * @param {Function|undefined} resolve  `context.resolve`, when the caller has one.
 * @returns {{name: string, slug: string, type: string|null, found: object|null}|null}
 */
export function readTargetName(written, resolve) {
  const text = String(written ?? "").trim();
  if (typeof resolve === "function") {
    const found = resolve(text);
    if (!found || !found.slug) return null;
    return { name: String(found.name ?? text), slug: String(found.slug), type: found.type ?? null, found };
  }
  return { name: text, slug: slugify(plainName(text)), type: null, found: null };
}

/** The degree word of `IF(Outcome=...)`, to a key of SW.DEGREES. */
export function readDegree(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (Object.hasOwn(DEGREE_WORDS, key) && Object.hasOwn(DEGREES, DEGREE_WORDS[key])) return DEGREE_WORDS[key];
  const names = Object.values(DEGREE_NAMES);
  throw new RuleSyntaxError(`"${String(word ?? "").trim()}" is not a Degree: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
}

/**
 * Refuse the components an effect line gave that a kind has no use for (0.16.0): every field of
 * the ops record outside `allowed` must be at its empty value. The names are the document's
 * (`IF:`, `IFT:`, `FOR:`, `LIMIT:`), not the record's keys.
 * @param {object} ops          The effect reader's ops.
 * @param {string} tag          The tag, for the message.
 * @param {string[]} allowed    The ops keys the kind reads: "when", "for", "while", "against", "seen", "limit", "claim", "marked".
 * @returns {object}            The same ops.
 */
export function refuseComponents(ops, tag, allowed) {
  const names = { when: "IF", for: "FOR", while: "IF: ALLIES(...)", against: "IFT: <Threat>", seen: "IF: SEEN", limit: "LIMIT", claim: "IF: CLAIM(...)", marked: "IFT: MARKED", until: "UNTIL", set: "VALUE", used: "IF: EFFECT(...)", has: "EFFECT(<name>)", cost: "IF: COST(<n>)" };
  const empty = emptyOps();
  for (const [key, value] of Object.entries(ops ?? {})) {
    if (allowed.includes(key)) continue;
    if (JSON.stringify(value) !== JSON.stringify(empty[key])) throw new RuleSyntaxError(`${tag} does not take ${names[key] ?? key}`);
  }
  return ops;
}

/**
 * A kind that acts before the die has no use for `IF(Outcome=...)`: refuse it by name. Called by
 * every kind's parse but `reroll`'s.
 * @param {object} ops  readLine's operators.
 */
export function refuseOutcome(ops) {
  if (Array.isArray(ops?.when) && ops.when.some(w => w?.outcome)) {
    throw new RuleSyntaxError("IF(Outcome=...) is only read by a kind that acts after the die (reroll, give)");
  }
}

/** A slug made here, for a parse with no resolver: lower-case, hyphens, glyphs out. */
function slugOf(name) {
  return String(name ?? "").replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "").trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* -------------------------------------------- */
/*  For the hooks                               */
/* -------------------------------------------- */

/**
 * Does a held rank meet a condition? `=` is equality, `>=` and `<=` compare SW.RANKS' order. An
 * unknown rank reads as Untrained.
 * @param {string} actual  The rank held.
 * @param {string} op      "=", ">=" or "<=" (an absent op is "=", the 0.10.0 shape).
 * @param {string} wanted  The rank named.
 * @returns {boolean}
 */
export function rankMeets(actual, op, wanted) {
  const a = RANKS[actual]?.order ?? 0;
  const w = RANKS[wanted]?.order ?? 0;
  if (op === ">=") return a >= w;
  if (op === "<=") return a <= w;
  return a === w;
}

/**
 * Does a scene relation satisfy a who word? The relation words are the scene context's:
 * "self", "ally", "enemy", "neutral".
 * @param {string} who       self | allies | enemies | all | self+allies
 * @param {string} relation  self | ally | enemy | neutral
 * @returns {boolean}
 */
export function whoMatches(who, relation) {
  switch (who) {
    case "self": return relation === "self";
    case "allies": return relation === "ally";
    case "enemies": return relation === "enemy";
    case "all": return relation !== "self";
    case "self+allies": return (relation === "self") || (relation === "ally");
    default: return false;
  }
}

/**
 * A trait's key: its first word, lower-cased, so `Thrown 20 ft`, `thrown` and `Thrown X` are one
 * trait, as the weapon trait parser reads them.
 * @param {string} trait
 * @returns {string}
 */
export function traitKey(trait) {
  return String(trait ?? "").trim().toLowerCase().split(/[\s[(]/)[0] ?? "";
}

/**
 * Does an attack's trait list carry a trait? `IF(Trait=Fear)` asks this of the attack record's
 * traits (a weapon's, an adversary attack Item's or a spell Talent's `system.traits`).
 * @param {string[]|null|undefined} traits
 * @param {string} word  The trait's key, from `traitKey`.
 * @returns {boolean}
 */
export function hasTrait(traits, word) {
  if (!Array.isArray(traits) || !word) return false;
  return traits.some(t => traitKey(t) === word);
}

/**
 * Does a rule's AGAINST hold for the Threat context of a roll or a Threshold read? A Threat word
 * on the Threat answered, a reach word on how the Blow reached, a Constellation (0.15.0) on the
 * `check` the context carries: the slug of the check read against this Defense, which a Demoralize
 * against Guard passes and an attack does not. A rule without AGAINST holds.
 * @param {object} rule
 * @param {{threat?: string, melee?: boolean, check?: string|null}|null} threat
 * @returns {boolean}
 */
export function againstHolds(rule, threat) {
  const against = rule?.against;
  if (!against) return true;
  if (against.check) return !!threat && (threat.check === against.check);
  if (!threat?.threat) return false;
  if (against.threat && (against.threat !== threat.threat)) return false;
  if (against.reach === "melee" && threat.melee !== true) return false;
  if (against.reach === "ranged" && threat.melee !== false) return false;
  return true;
}

/**
 * Does a rule's MARKED hold (0.15.0; ruling 176)? The owner's `mark` for this Talent
 * (`flags.starwrought.rules.marks.<itemId>`, `{ uuid, tokenUuid, name, combat }`) must name the
 * roll's other party (`context.other`, `{ uuid, tokenUuid }`), and must still hold: made in an
 * encounter, while that Combat is the viewed one; made outside, while none runs. A rule without
 * MARKED holds; one with it and no other party known does not.
 * @param {object} rule
 * @param {{item: object, owner?: object}} entry
 * @param {{other?: object|null, encounter?: {combat: string|null}|null}} context
 * @returns {boolean}
 */
export function markedHolds(rule, entry, context) {
  if (!rule?.marked) return true;
  const other = context?.other;
  if (!other || (!other.uuid && !other.tokenUuid)) return false;
  const carrier = entry?.item;
  const owner = entry?.owner;
  const key = flagKey(ruleCarrierKey(carrier));
  const mark = owner?.flags?.starwrought?.rules?.marks?.[key] ?? null;
  if (!mark) return false;
  if ((mark.combat ?? null) !== (context?.encounter?.combat ?? null)) return false;
  if (mark.uuid && other.uuid && (mark.uuid === other.uuid)) return true;
  if (mark.tokenUuid && other.tokenUuid && (mark.tokenUuid === other.tokenUuid)) return true;
  return false;
}

/**
 * A rule's `EFFECT(<name>)` conditions (0.31.0), as a list: empty when it asks for none, and null
 * when what is stored under `has` is not a list of well-formed entries. A rule in that state can
 * never be said to hold, so it is left out rather than applied always.
 * @param {object} rule
 * @returns {Array<{name: string, slug: string, condition: string|null, on: string}>|null}
 */
export function effectConditions(rule) {
  const has = rule?.has;
  if ((has === null) || (has === undefined)) return [];
  if (!Array.isArray(has)) return null;
  for (const h of has) {
    if (!h || (typeof h !== "object") || !h.slug || !["self", "other"].includes(h.on)) return null;
  }
  return has;
}

/** Does this rule ask about the roll's other party's Effects (`IFT: EFFECT(...)`)? */
export function readsOtherEffects(rule) {
  return (effectConditions(rule) ?? []).some(h => h.on === "other");
}

/**
 * Do a rule's `EFFECT(<name>)` conditions hold (0.31.0; ruling 307)? `IF:` asks the roller's list
 * and `IFT:` the other party's (./effect-list.mjs). A rule without one holds; one that asks about
 * a creature whose list is not known does not, as MARKED does not hold with no other party.
 * @param {object} rule
 * @param {{self?: object|null, other?: object|null}} lists  Each an `EffectList`, or null.
 * @returns {boolean}
 */
export function effectHolds(rule, lists) {
  const has = effectConditions(rule);
  if (has === null) return false;
  for (const h of has) {
    // `mine` (0.32.0) is asked of the creature whose roll this is: `lists.by` is its uuid.
    // The VIEWER (0.33.0) is the creature on the other side of the question, which a Condition
    // held "against X" needs: the roller when the other party's list is read, the other party
    // (`lists.otherBy`) when the roller's own is.
    const other = h.on === "other";
    const viewer = other ? (lists?.by ?? null) : (lists?.otherBy ?? null);
    if (listHas(other ? lists?.other : lists?.self, h, { by: lists?.by ?? null, viewer }) !== true) return false;
  }
  return true;
}

/**
 * The key a rule's LIMIT mark is filed under: the carrier and the line, as the `bonus` and
 * `substitute` kinds key theirs. One reading for the kinds that act when a Maneuver is used
 * (`permit`, `subordinate`; 0.25.0, through 0.24.0 it was `permit`'s own).
 * @param {object} carrier  The Item that carries the rule.
 * @param {object} rule
 * @returns {string}
 */
export function limitKey(carrier, rule) {
  return `${carrier?.id ?? carrier?.name ?? "rule"}:${rule?.line ?? 0}`;
}

/**
 * Has the owner spent a LIMIT in the encounter as it stands? `per` is the limit that stands for
 * this use, which an `ALTER: <Maneuver>.limit` may have changed (./given.mjs, `limitOf`), so it is
 * handed in and never read off the rule here. Outside an encounter nothing is limited.
 * @param {object} actor
 * @param {string} key      `limitKey(carrier, rule)`.
 * @param {string|null} per "round" | "encounter" | null (no limit).
 * @param {{combat: string|null, round?: number}|null} encounter
 * @returns {boolean}
 */
export function limitSpent(actor, key, per, encounter) {
  const combat = encounter?.combat ?? null;
  if (!per || !combat) return false;
  const held = actor?.flags?.starwrought?.rules?.[per]?.[flagKey(key)] ?? null;
  if (!held) return false;
  if (per === "round") return (held.combat === combat) && (held.round === (encounter.round ?? 0));
  return (held === combat) || (held.combat === combat);
}

/** Does a comparison hold? `=` equality; the rest as written. */
export function compare(left, op, right) {
  switch (op) {
    case ">=": return left >= right;
    case "<=": return left <= right;
    case ">": return left > right;
    case "<": return left < right;
    default: return left === right;
  }
}

/**
 * Can this rule only be read where the map, the Threat or the round is known? True for a FOR that
 * reaches anyone but the owner, a WHILE, a SEEN, an AGAINST, an IF on a Trait, a FIRST or an ONCE.
 * The character's Defense pass on the sheet asks for the rest (`staticOnly`); a roll and a
 * Threshold read in the attack flow ask for these (`momentOnly`) on top of what the sheet folded in.
 * @param {object} rule
 * @returns {boolean}
 */
export function needsMoment(rule) {
  if (!rule) return false;
  if (rule.for && (rule.for.who !== "self")) return true;
  const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
  if (whens.some(w => w?.trait || w?.outcome)) return true;
  // 0.31.0: an Effect on the roll's OTHER party is known only where there is one. An Effect on
  // the roller is the sheet's to read (its own effects are known when it is prepared), so a bonus
  // that waits on one shows in the sheet's Threshold while the Effect is on.
  if (readsOtherEffects(rule)) return true;
  return !!(rule.while || rule.against || rule.limit || rule.seen || rule.claim || rule.marked);
}

/** The operators' part of a summary: "while Origin is Expert, for allies within 15 ft, against a Blow, first each round". */
export function summarizeOperators(rule) {
  const bits = [];
  const whens = Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
  for (const w of whens) {
    if (w.trait) { bits.push(`against an attack with the ${w.name ?? titled(w.trait)} trait`); continue; }
    if (w.outcome) { bits.push(`on a ${w.name ?? DEGREE_NAMES[w.outcome] ?? w.outcome}`); continue; }
    const op = w.op === ">=" ? "at least" : w.op === "<=" ? "at most" : "";
    const subject = w.roll ? "the roll's rank" : (w.name ?? w.constellation ?? "");
    bits.push(`while ${subject} is ${op ? `${op} ` : ""}${titled(w.rank)}`);
  }
  if (rule?.for && (rule.for.who !== "self")) {
    const who = rule.for.who === "self+allies" ? "you and your allies" : rule.for.who;
    bits.push(`for ${who}${rule.for.range !== null && rule.for.range !== undefined ? ` within ${rule.for.range} ft` : ""}${rule.seen ? " who can see you" : ""}`);
  } else if (rule?.seen) {
    bits.push("who can see you");
  }
  if (rule?.while) {
    const w = rule.while;
    bits.push(`while ${w.op === "=" ? "" : `${w.op} `}${w.count} ${w.who} ${w.range !== null && w.range !== undefined ? `within ${w.range} ft` : "on the scene"}`.replace(/\s+/g, " "));
  }
  if (rule?.against) {
    if (rule.against.check) bits.push(`against ${/^[aeiou]/i.test(rule.against.name ?? "") ? "an" : "a"} ${rule.against.name ?? rule.against.check} check`);
    else bits.push(rule.against.reach ? `against a ${rule.against.reach} Blow` : `against a ${titled(rule.against.threat)}`);
  }
  if (rule?.marked) bits.push("against the creature you marked");
  // 0.31.0: `IF: EFFECT(<name>)` and `IFT: EFFECT(<name>)`. A Condition is something a creature
  // IS ("while you are Prone"); a named Effect something it HAS ("while you have Taking Cover").
  for (const h of effectConditions(rule) ?? []) {
    const name = h.name ?? h.slug;
    // `mine` (0.32.0): the one asking put it there.
    if (h.on === "other") bits.push(h.mine ? (h.condition ? `against a creature you made ${name}` : `against a creature with your ${name}`) : (h.condition ? `against a creature that is ${name}` : `against a creature with ${name}`));
    else bits.push(h.mine ? (h.condition ? `while you are ${name} by your own doing` : `while you have your own ${name}`) : (h.condition ? `while you are ${name}` : `while you have ${name}`));
  }
  // 0.25.0: `IF: EFFECT(<name>, used)`. An object alone: a hand-stored rule with any other value
  // under the key says nothing here.
  if (rule?.used && (typeof rule.used === "object")) {
    bits.push(`once a roll of yours at this Opportunity has used up ${rule.used.name ?? rule.used.slug ?? "the Effect"}`);
  }
  if (rule?.limit) bits.push(rule.limit.per === "round" ? "the first time each round" : "once each encounter");
  if (rule?.claim) bits.push(`when you claim it (${rule.claim.text})`);
  return bits.join(", ");
}
