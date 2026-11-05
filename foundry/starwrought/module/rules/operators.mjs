/**
 * The operators of the Automation grammar (0.13.0; AUTOMATION_GRAMMAR.md, section 4).
 *
 * A rule line is `<kind>: <arg>, <arg>, ... [, <OPERATOR>(...)] ...`: the kind's positional
 * arguments first, then any operators, each `NAME(...)` in capitals with its own comma-separated
 * contents, or a bare flag word (`VISIBLE`, `DIFFERENT`). The same operator means the same thing
 * in every kind, so this module reads them once and every kind file asks it: `readLine(args,
 * { allow, context })` splits the argument string on the commas outside parentheses and quotes,
 * takes the leading parts that are not operators as the arguments, reads each operator by name
 * against the shared vocabulary, and refuses an operator the kind did not allow by name
 * ("prevent does not take AGAINST"). Mike's direction (2026-11-05): logical operands and
 * grammatical shortcuts, no prose connectives, so nothing here reads "to", "if" or "while" as a
 * word.
 *
 * The operators, and what each stores on the rule:
 *
 *   IF(<Constellation><op><Rank>)   when: [{ constellation, name, op, rank }]; `Origin` is the pooled
 *                                   Origin rank; `IF(Rank=<Rank>)` is the roll's own rank:
 *                                   { roll: true, op, rank }. <op> is =, >= or <=. Several IFs on one
 *                                   line must all hold.
 *   FOR(<Who>[, <N>ft])             for: { who, range }   who: self | allies | enemies | all | self+allies
 *   WHILE(<Who><op><N>[, <N>ft])    while: { who, op, count, range }   who: allies | enemies | all
 *   AGAINST(<Threat>)               against: { threat, reach }   threat: blow | blast | blight | beguilement
 *                                   | null; reach: melee | ranged | null
 *   FIRST(round)                    limit: { per: "round" }
 *   ONCE(encounter)                 limit: { per: "encounter" }
 *   DIFFERENT                       different: true
 *   VISIBLE                         visible: true
 *
 * Also here, for the hooks: `rankMeets(actual, op, wanted)` over SW.RANKS' order, `whoMatches(who,
 * relation)` over the scene's relation words, and `needsMoment(rule)`, true when a rule can only be
 * read where the map, the Threat or the round is known (a FOR that reaches others, a WHILE, an
 * AGAINST, a FIRST or ONCE), which is how the Defense pass on the sheet and the roll tell their
 * halves apart.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. The build imports the kinds from
 * plain Node, and a kind imports this. It imports `syntax.mjs` (which imports nothing) and
 * `config.mjs` (pure), never the grammar or the registry, so no circle exists.
 */

import { RuleSyntaxError } from "./syntax.mjs";
import { RANKS, THREATS, isLoreSlug } from "../config.mjs";

/** The operator names, in the order the grammar document lists them. The build checks each is named there. */
export const OPERATORS = Object.freeze(["IF", "FOR", "WHILE", "AGAINST", "FIRST", "ONCE", "DIFFERENT", "VISIBLE"]);

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
const FLAG = /^([A-Za-z]+)$/;

/** The word in Title Case for a message: "expert" to "Expert". */
export function titled(word) {
  const w = String(word ?? "");
  return w ? w[0].toUpperCase() + w.slice(1) : w;
}

/* -------------------------------------------- */
/*  Splitting                                   */
/* -------------------------------------------- */

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
  for (const ch of String(text ?? "")) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"') || (ch === "'")) {
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

/** Is this part an operator call or a bare flag word the grammar knows? Returns its name in capitals, or null. */
function operatorName(part) {
  const call = part.match(CALL);
  const word = (call ? call[1] : (part.match(FLAG)?.[1] ?? "")).toUpperCase();
  return OPERATORS.includes(word) ? word : null;
}

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

/**
 * Read a kind's argument string into its positional arguments and its operators.
 *
 * The leading parts up to the first operator are the arguments; everything after must be an
 * operator, so a stray word after an operator is refused ("after the operators, only operators").
 * An operator the kind did not list in `allow` is refused by name. A flag operator written with
 * parentheses (`VISIBLE()`) reads as the flag; a call operator written bare (`FOR`) is refused with
 * its shape.
 *
 * @param {string} text                      The text after the kind word and colon, trimmed.
 * @param {object} options
 * @param {string[]} options.allow           The operator names this kind takes.
 * @param {string} options.kind              The kind's id, for messages.
 * @param {object} [options.context]         The grammar's context; `resolve` is read from it for IF.
 * @returns {{args: string[], ops: {when: object[]|null, for: object|null, while: object|null, against: object|null, limit: object|null, different: boolean, visible: boolean}}}
 */
export function readLine(text, { allow = [], kind = "rule", context = {} } = {}) {
  const parts = splitOperands(String(text ?? "").trim().replace(/\.$/, ""));
  const args = [];
  const ops = { when: null, for: null, while: null, against: null, limit: null, different: false, visible: false };
  let seenOperator = false;

  for (const part of parts) {
    const name = operatorName(part);
    if (!name) {
      if (seenOperator) {
        throw new RuleSyntaxError(`"${part}" comes after an operator; the arguments go first, then the operators (${OPERATORS.join(", ")})`);
      }
      args.push(part);
      continue;
    }
    seenOperator = true;
    if (!allow.includes(name)) throw new RuleSyntaxError(`${kind} does not take ${name}`);
    const call = part.match(CALL);
    const inside = call ? call[2].trim() : null;
    readOperator(name, inside, ops, context);
  }
  return { args, ops };
}

/** One operator's contents into `ops`, each refusal naming the shape. */
function readOperator(name, inside, ops, context) {
  switch (name) {
    case "IF": {
      if (inside == null) throw new RuleSyntaxError("IF is written `IF(<Constellation>=<Rank>)`, as in `IF(Origin=Trained)`");
      (ops.when ??= []).push(readIf(inside, context));
      return;
    }
    case "FOR": {
      if (ops.for) throw new RuleSyntaxError("FOR is given twice");
      if (inside == null) throw new RuleSyntaxError("FOR is written `FOR(<Who>[, <N>ft])`, as in `FOR(allies, 15ft)`");
      ops.for = readFor(inside);
      return;
    }
    case "WHILE": {
      if (ops.while) throw new RuleSyntaxError("WHILE is given twice");
      if (inside == null) throw new RuleSyntaxError("WHILE is written `WHILE(<Who><op><N>[, <N>ft])`, as in `WHILE(allies>=1, 0ft)`");
      ops.while = readWhile(inside);
      return;
    }
    case "AGAINST": {
      if (ops.against) throw new RuleSyntaxError("AGAINST is given twice");
      if (inside == null) throw new RuleSyntaxError("AGAINST is written `AGAINST(<Threat>)`, as in `AGAINST(Blow)`");
      ops.against = readAgainst(inside);
      return;
    }
    case "FIRST": {
      if (ops.limit) throw new RuleSyntaxError("FIRST and ONCE are one limit; write one of them");
      if ((inside == null) || (inside.toLowerCase() !== "round")) throw new RuleSyntaxError("FIRST is written `FIRST(round)`");
      ops.limit = { per: "round" };
      return;
    }
    case "ONCE": {
      if (ops.limit) throw new RuleSyntaxError("FIRST and ONCE are one limit; write one of them");
      if ((inside == null) || (inside.toLowerCase() !== "encounter")) throw new RuleSyntaxError("ONCE is written `ONCE(encounter)`");
      ops.limit = { per: "encounter" };
      return;
    }
    case "DIFFERENT": {
      if (inside) throw new RuleSyntaxError("DIFFERENT takes nothing in parentheses");
      ops.different = true;
      return;
    }
    case "VISIBLE": {
      if (inside) throw new RuleSyntaxError("VISIBLE takes nothing in parentheses");
      ops.visible = true;
      return;
    }
    default:
      throw new RuleSyntaxError(`unknown operator ${name}`);
  }
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
function readWho(word, allowed) {
  const lower = String(word ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (allowed.includes(lower)) return lower;
  throw new RuleSyntaxError(`a who is written ${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}, not "${String(word ?? "").trim()}"`);
}

/** `<left><op><right>` with the comparison words, longest first. Null when no comparison is in it. */
function splitComparison(text) {
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
 * of Trades). With a resolver the name must resolve to a Constellation that is not a group (a group
 * wears its parent's rank, so the parent is named); a Lore is refused with or without one.
 */
function readIf(inside, context) {
  const cmp = splitComparison(inside);
  if (!cmp || !cmp.left || !cmp.right || ![ "=", ">=", "<=" ].includes(cmp.op)) {
    throw new RuleSyntaxError("IF is written `IF(<Constellation>=<Rank>)` (also >= and <=), as in `IF(Origin=Trained)`");
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
function readFor(inside) {
  const parts = splitOperands(inside);
  if (!parts.length || (parts.length > 2)) throw new RuleSyntaxError("FOR is written `FOR(<Who>[, <N>ft])`, as in `FOR(allies, 15ft)`");
  const who = readWho(parts[0], WHO_FOR);
  const range = (parts.length === 2) ? readRange(parts[1]) : null;
  if ((who === "self") && (range !== null)) throw new RuleSyntaxError("FOR(self) takes no range");
  return { who, range };
}

/** `WHILE(<Who><op><N>[, <N>ft])`: a count of tokens around the owner. No range means anywhere on the scene. */
function readWhile(inside) {
  const parts = splitOperands(inside);
  if (!parts.length || (parts.length > 2)) throw new RuleSyntaxError("WHILE is written `WHILE(<Who><op><N>[, <N>ft])`, as in `WHILE(allies>=1, 0ft)`");
  const cmp = splitComparison(parts[0]);
  if (!cmp || !/^\d+$/.test(cmp.right)) throw new RuleSyntaxError("WHILE is written `WHILE(<Who><op><N>[, <N>ft])`, as in `WHILE(allies>=1, 0ft)`");
  const who = readWho(cmp.left, WHO_WHILE);
  const range = (parts.length === 2) ? readRange(parts[1]) : null;
  return { who, op: cmp.op, count: Number(cmp.right), range };
}

/** `AGAINST(<Threat>)`: a Threat word, or `Melee` / `Ranged` for a Blow by how it reached. */
function readAgainst(inside) {
  const word = String(inside ?? "").trim().toLowerCase();
  if (Object.hasOwn(THREATS, word)) return { threat: word, reach: null };
  if (REACH_WORDS.includes(word)) return { threat: "blow", reach: word };
  const names = [...Object.keys(THREATS).map(titled), ...REACH_WORDS.map(titled)];
  throw new RuleSyntaxError(`"${String(inside ?? "").trim()}" is not a Threat: write ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);
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
 * reaches anyone but the owner, a WHILE, an AGAINST, a FIRST or an ONCE. The character's Defense
 * pass on the sheet asks for the rest (`staticOnly`); a roll and a Threshold read in the attack
 * flow ask for these (`momentOnly`) on top of what the sheet folded in.
 * @param {object} rule
 * @returns {boolean}
 */
export function needsMoment(rule) {
  if (!rule) return false;
  if (rule.for && (rule.for.who !== "self")) return true;
  return !!(rule.while || rule.against || rule.limit);
}

/** The operators' part of a summary: "while Origin is Expert, for allies within 15 ft, against a Blow, first each round". */
export function summarizeOperators(rule) {
  const bits = [];
  const whens = Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
  for (const w of whens) {
    const op = w.op === ">=" ? "at least" : w.op === "<=" ? "at most" : "";
    const subject = w.roll ? "the roll's rank" : (w.name ?? w.constellation ?? "");
    bits.push(`while ${subject} is ${op ? `${op} ` : ""}${titled(w.rank)}`);
  }
  if (rule?.for && (rule.for.who !== "self")) {
    const who = rule.for.who === "self+allies" ? "you and your allies" : rule.for.who;
    bits.push(`for ${who}${rule.for.range !== null && rule.for.range !== undefined ? ` within ${rule.for.range} ft` : ""}`);
  }
  if (rule?.while) {
    const w = rule.while;
    bits.push(`while ${w.op === "=" ? "" : `${w.op} `}${w.count} ${w.who} ${w.range !== null && w.range !== undefined ? `within ${w.range} ft` : "on the scene"}`.replace(/\s+/g, " "));
  }
  if (rule?.against) {
    bits.push(rule.against.reach ? `against a ${rule.against.reach} Blow` : `against a ${titled(rule.against.threat)}`);
  }
  if (rule?.limit) bits.push(rule.limit.per === "round" ? "the first time each round" : "once each encounter");
  return bits.join(", ");
}
