/**
 * The effect line (0.16.0; AUTOMATION_GRAMMAR.md section 3): what a Talent does to a roll, in the
 * shape of Fantasy Grounds' PF2 effects, which Mike asked for by name (2026-11-05: "I REALLY,
 * REALLY like the FantasyGrounds effects automation ... can we use syntax substantially similar
 * to this"). One effect per line; its components separated by semicolons; the first component a
 * tag, the rest conditions and limits:
 *
 *   CHECK: 2 condition, diplomacy; IF: CLAIM(when trading)
 *   DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)
 *   IMMUNE: prone; LIMIT: encounter
 *   REROLL: diplomacy; IF: RESULT(critical failure)
 *
 * A MODIFIER tag (CHECK, ATK, DEF, INIT, SPEED) is `TAG: <value> <type>, <descriptor>`: a signed
 * whole number, the bonus type (situation, condition or gear; FG's `[bonus]`), then descriptors
 * by commas. The other tags (IMMUNE, MARK, REROLL, IGNORE) take descriptors alone. The components:
 * `IF: <condition>` (the owner, or the roll) and `IFT: <condition>` (the other party, or the
 * attack), `FOR: <who> [<N>]` (the recipients), `LIMIT: round | encounter`. The conditions:
 * `RANK(<Constellation> <op> <rank>)`, `RANK(roll = untrained)`, `SEEN`, `ALLIES(<op><N>[, <N>])`
 * (also ENEMIES, ALL), `CLAIM(<text>)`, `RESULT(<degree>)`, `TRAIT(<trait>)`, `MARKED`, a Threat
 * word (BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED), `CHECK(<Constellation>)`. IF and IFT are
 * both accepted for every condition, as FG's own users mix them; the document says which is
 * idiomatic. The reader fills the same `ops` record the 0.13.0 reader filled, so every kind's hook
 * reads what it always read.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node). It
 * imports syntax.mjs, operators.mjs (the shared vocabularies) and the config; never the grammar or
 * the registry.
 */

import { RuleSyntaxError } from "./syntax.mjs";
import {
  emptyOps, splitOperands, readRank, readRange, readWho, readDegree, readAgainst, splitComparison, traitKey,
  WHO_FOR, WHO_WHILE, titled
} from "./operators.mjs";
import { THREATS, isLoreSlug } from "../config.mjs";

/** The tags an effect line may begin with, each to the kind that reads it. Upper case in the document; case blind here. */
export const EFFECT_TAGS = Object.freeze({
  check: "bonus", atk: "bonus", def: "bonus", init: "bonus", speed: "bonus",
  immune: "prevent", mark: "mark", reroll: "reroll", ignore: "ignore"
});

/** The modifier tags: a value and a bonus type come first. */
export const MODIFIER_TAGS = Object.freeze(["check", "atk", "def", "init", "speed"]);

/** The component words after the tag. */
export const COMPONENTS = Object.freeze(["IF", "IFT", "FOR", "LIMIT"]);

/** The condition words inside IF and IFT. */
export const CONDITIONS = Object.freeze(["RANK", "SEEN", "ALLIES", "ENEMIES", "ALL", "CLAIM", "RESULT", "TRAIT", "MARKED", "BLOW", "BLAST", "BLIGHT", "BEGUILEMENT", "MELEE", "RANGED", "CHECK"]);

const CALL = /^([A-Za-z]+)\s*\(([\s\S]*)\)$/;

/** Is this trimmed line an effect line: a known tag before its first colon? */
export function effectTagOf(line) {
  const match = String(line ?? "").trim().match(/^([A-Za-z]+)\s*:/);
  const tag = match?.[1]?.toLowerCase() ?? "";
  return Object.hasOwn(EFFECT_TAGS, tag) ? tag : null;
}

/**
 * Read one effect line.
 * @param {string} text        The trimmed line.
 * @param {object} [options]
 * @param {object} [options.context]  The grammar's context (`resolve` is read from it).
 * @returns {{tag: string, kind: string, value: number|null, type: string|null, descriptors: string[], ops: object, components: string[]}}
 */
export function readEffectLine(text, { context = {} } = {}) {
  const line = String(text ?? "").trim().replace(/\.$/, "");
  const components = splitComponents(line);
  if (!components.length) throw new RuleSyntaxError("an effect line is written `TAG: value type, descriptors; IF: ...`");
  const head = components[0];
  const headMatch = head.match(/^([A-Za-z]+)\s*:\s*([\s\S]*)$/);
  const tag = headMatch?.[1]?.toLowerCase() ?? "";
  if (!Object.hasOwn(EFFECT_TAGS, tag)) {
    throw new RuleSyntaxError(`"${head.split(":")[0].trim()}" is not an effect tag: write ${Object.keys(EFFECT_TAGS).map(t => t.toUpperCase()).join(", ")}`);
  }
  const rest = headMatch[2].trim();
  let value = null;
  let type = null;
  let descriptors;
  if (MODIFIER_TAGS.includes(tag)) {
    const parts = splitOperands(rest);
    const first = parts.shift() ?? "";
    const words = first.split(/\s+/).filter(Boolean);
    if (!words.length || !/^[+-]?\d+$/.test(words[0])) {
      throw new RuleSyntaxError(`${tag.toUpperCase()} is written \`${tag.toUpperCase()}: <value> <type>, <descriptor>\`, as in \`${tag.toUpperCase()}: 1 condition${tag === "check" ? ", aid" : tag === "def" ? ", guard" : ""}\`: a signed whole number first, not "${first}"`);
    }
    value = Number(words[0]);
    if (value === 0) throw new RuleSyntaxError("a bonus of 0 does nothing");
    if (words.length > 2) throw new RuleSyntaxError(`"${first}": the value and its type, then a comma before any descriptor`);
    type = words[1] ?? null;
    descriptors = parts.map(p => p.trim()).filter(Boolean);
  } else {
    descriptors = splitOperands(rest).map(p => p.trim()).filter(Boolean);
  }

  const ops = emptyOps();
  for (const component of components.slice(1)) readComponent(component, ops, context);
  return { tag, kind: EFFECT_TAGS[tag], value, type, descriptors, ops, components };
}

/** Split a line on the semicolons outside parentheses and quotes, trimmed, empties dropped. */
export function splitComponents(line) {
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = null;
  for (const ch of line) {
    if (quote) { current += ch; if (ch === quote) quote = null; continue; }
    if ((ch === '"') || (ch === "'")) { quote = ch; current += ch; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") { depth -= 1; if (depth < 0) throw new RuleSyntaxError("a ) has no ( before it"); }
    if ((ch === ";") && (depth === 0)) { parts.push(current); current = ""; continue; }
    current += ch;
  }
  if (quote) throw new RuleSyntaxError(`an opening ${quote} has no closing ${quote}`);
  if (depth > 0) throw new RuleSyntaxError("a ( has no closing )");
  parts.push(current);
  return parts.map(p => p.trim()).filter(p => p !== "");
}

/** One component after the tag into `ops`: `IF: ...`, `IFT: ...`, `FOR: ...`, `LIMIT: ...`. */
function readComponent(component, ops, context) {
  const match = component.match(/^([A-Za-z]+)\s*:\s*([\s\S]*)$/);
  const word = match?.[1]?.toUpperCase() ?? "";
  const inside = match?.[2]?.trim() ?? "";
  switch (word) {
    case "IF":
    case "IFT":
      if (!inside) throw new RuleSyntaxError(`${word}: names a condition, as in \`IF: RANK(Origin >= trained)\` or \`IFT: BLOW\``);
      readCondition(inside, ops, context, word);
      return;
    case "FOR": {
      if (ops.for) throw new RuleSyntaxError("FOR is given twice");
      const tokens = inside.split(/[\s,]+/).filter(Boolean);
      if (!tokens.length || (tokens.length > 2)) throw new RuleSyntaxError("FOR is written `FOR: <who> [<N>]`, as in `FOR: allies 15`");
      const who = readWho(tokens[0], WHO_FOR);
      const range = (tokens.length === 2) ? readRange(tokens[1]) : null;
      if ((who === "self") && (range !== null)) throw new RuleSyntaxError("FOR: self takes no range");
      ops.for = { who, range };
      return;
    }
    case "LIMIT": {
      if (ops.limit) throw new RuleSyntaxError("LIMIT is given twice");
      const per = inside.toLowerCase();
      if (!["round", "encounter"].includes(per)) throw new RuleSyntaxError("LIMIT is written `LIMIT: round` or `LIMIT: encounter`");
      ops.limit = { per };
      return;
    }
    default:
      if (Object.hasOwn(EFFECT_TAGS, word.toLowerCase())) {
        throw new RuleSyntaxError(`"${word}" is a tag and begins its own line; one effect per line, its conditions after it as IF:, IFT:, FOR: and LIMIT:`);
      }
      throw new RuleSyntaxError(`"${component}" is not a component: after the tag come IF:, IFT:, FOR: and LIMIT:`);
  }
}

/**
 * A condition inside IF or IFT. The condition decides what it is about, not the prefix: RANK, SEEN,
 * the counts and CLAIM are the owner's or the roll's, TRAIT, MARKED, a Threat word and CHECK are
 * the other party's; FG's own effects mix the two, so both prefixes read.
 */
function readCondition(inside, ops, context, prefix) {
  const call = inside.match(CALL);
  const word = (call ? call[1] : inside).trim().toUpperCase();
  const arg = call ? call[2].trim() : null;
  switch (word) {
    case "RANK": {
      if (arg == null) throw new RuleSyntaxError("RANK is written `RANK(<Constellation> <op> <rank>)`, as in `RANK(Origin >= trained)`, or `RANK(roll = untrained)`");
      const cmp = splitComparison(arg.replace(/\s+/g, " "));
      if (!cmp || !cmp.left || !cmp.right || !["=", ">=", "<="].includes(cmp.op)) throw new RuleSyntaxError("RANK is written `RANK(<Constellation> <op> <rank>)` with =, >= or <=, as in `RANK(Origin >= trained)`");
      const rank = readRank(cmp.right);
      const left = cmp.left.trim();
      if (left.toLowerCase() === "roll") { (ops.when ??= []).push({ roll: true, op: cmp.op, rank }); return; }
      const resolve = context?.resolve;
      if (typeof resolve === "function") {
        const found = resolve(left);
        if (!found || (found.type !== "constellation") || !found.slug) throw new RuleSyntaxError(`"${left}" is not a Constellation`);
        if (found.group) throw new RuleSyntaxError(`"${found.name ?? left}" is a group and has no rank of its own;${found.parent ? ` test ${found.parent} instead` : " test its parent instead"}`);
        if (isLoreSlug(String(found.slug))) throw new RuleSyntaxError("a Lore is the character's own; a rank condition cannot name it");
        (ops.when ??= []).push({ constellation: String(found.slug), name: String(found.name ?? left), op: cmp.op, rank });
      } else {
        const slug = left.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (isLoreSlug(slug)) throw new RuleSyntaxError("a Lore is the character's own; a rank condition cannot name it");
        (ops.when ??= []).push({ constellation: slug, name: left, op: cmp.op, rank });
      }
      return;
    }
    case "SEEN":
      if (arg) throw new RuleSyntaxError("SEEN takes nothing in parentheses; who must see you is who FOR names");
      ops.seen = true;
      return;
    case "ALLIES":
    case "ENEMIES":
    case "ALL": {
      if (ops.while) throw new RuleSyntaxError("a count condition is given twice");
      if (arg == null) throw new RuleSyntaxError(`${word} is written \`${word}(<op><N>[, <N>])\`, as in \`ALLIES(>=1, 0)\``);
      const parts = splitOperands(arg);
      // `>=1` has no left side, so the comparison is read here rather than by splitComparison.
      const m = String(parts[0] ?? "").trim().match(/^(>=|<=|==|=|>|<)\s*(\d+)$/);
      if (!m || (parts.length > 2)) throw new RuleSyntaxError(`${word} is written \`${word}(<op><N>[, <N>])\`, as in \`ALLIES(>=1, 0)\``);
      const range = (parts.length === 2) ? readRange(parts[1]) : null;
      ops.while = { who: readWho(word, WHO_WHILE), op: m[1] === "==" ? "=" : m[1], count: Number(m[2]), range };
      return;
    }
    case "CLAIM": {
      if (ops.claim) throw new RuleSyntaxError("CLAIM is given twice");
      const words = String(arg ?? "").trim().replace(/^["']|["']$/g, "").trim();
      if (!words) throw new RuleSyntaxError("CLAIM is written `CLAIM(<text>)`, the words the player is asked, as in `CLAIM(when trading)`");
      ops.claim = { text: words };
      return;
    }
    case "RESULT": {
      if (arg == null) throw new RuleSyntaxError("RESULT is written `RESULT(<degree>)`, as in `RESULT(critical failure)`");
      const outcome = readDegree(arg);
      (ops.when ??= []).push({ outcome, name: titledDegree(outcome) });
      return;
    }
    case "TRAIT": {
      if (arg == null) throw new RuleSyntaxError("TRAIT is written `TRAIT(<trait>)`, as in `TRAIT(Fear)`");
      const name = arg.replace(/\s+/g, " ").trim();
      if (!/^[A-Za-z][A-Za-z0-9 '-]*$/.test(name)) throw new RuleSyntaxError(`"${arg}" is not a trait word (letters, as the Traits columns print it)`);
      (ops.when ??= []).push({ trait: traitKey(name), name });
      return;
    }
    case "MARKED":
      if (arg) throw new RuleSyntaxError("MARKED takes nothing in parentheses; who may be marked is the MARK line's business");
      ops.marked = true;
      return;
    case "BLOW": case "BLAST": case "BLIGHT": case "BEGUILEMENT": case "MELEE": case "RANGED":
      if (ops.against) throw new RuleSyntaxError("a Threat condition is given twice");
      if (arg) throw new RuleSyntaxError(`${word} takes nothing in parentheses`);
      ops.against = readAgainst(word, context);
      return;
    case "CHECK": {
      if (ops.against) throw new RuleSyntaxError("a Threat condition is given twice");
      if (arg == null) throw new RuleSyntaxError("CHECK is written `CHECK(<Constellation>)`, as in `IFT: CHECK(intimidation)`");
      if (Object.hasOwn(THREATS, arg.toLowerCase())) throw new RuleSyntaxError(`a Threat is written bare: \`IFT: ${arg.toUpperCase()}\``);
      ops.against = readAgainst(arg, context);
      return;
    }
    default:
      throw new RuleSyntaxError(`"${inside}" is not a condition: ${prefix}: takes ${CONDITIONS.join(", ")}`);
  }
}

function titledDegree(outcome) {
  return { critSuccess: "Critical Success", success: "Success", fail: "Failure", critFail: "Critical Failure" }[outcome] ?? titled(outcome);
}
