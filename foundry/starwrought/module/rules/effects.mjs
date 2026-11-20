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
 *   USE: Presence, Origin, aid
 *   GIVE: 1 situation, chosen; IF: RESULT(success)
 *   ALTER: Aid.critical-failure; VALUE: nothing
 *   SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter
 *
 * A MODIFIER tag (CHECK, ATK, DEF, INIT, SPEED, GIVE) is `TAG: <value> <type>, <descriptor>`: a
 * signed whole number, the bonus type (situation, condition or gear; FG's `[bonus]`), then
 * descriptors by commas. The other tags (IMMUNE, MARK, REROLL, IGNORE, USE, ALTER, PERMIT,
 * SUBORDINATE, COST, CANNOT) take descriptors alone. The components:
 * `IF: <condition>` (the owner, or the roll) and `IFT: <condition>` (the other party, or the
 * attack), `FOR: <who> [<N>]` (the recipients), `LIMIT: round | encounter`, and (0.22.0) `UNTIL:
 * <window>` after GIVE and `VALUE: <value>` after ALTER. The conditions:
 * `RANK(<Constellation> <op> <rank>)`, `RANK(roll = untrained)`, `SEEN`, `ALLIES(<op><N>[, <N>])`
 * (also ENEMIES, ALL), `CLAIM(<text>)`, `RESULT(<degree>)`, `TRAIT(<trait>)`, `MARKED`, a Threat
 * word (BLOW, BLAST, BLIGHT, BEGUILEMENT, MELEE, RANGED), `CHECK(<Constellation>)`, and (0.25.0)
 * `EFFECT(<name>, used)`, stored under `ops.used` and read by SUBORDINATE alone. IF and IFT are
 * both accepted for every condition, as FG's own users mix them; the document says which is
 * idiomatic. The reader fills the same `ops` record the 0.13.0 reader filled, so every kind's hook
 * reads what it always read.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node). It
 * imports syntax.mjs, operators.mjs (the shared vocabularies) and the config; never the grammar or
 * the registry.
 */

import { RuleSyntaxError, CONDITION_ROW, CONDITION_ROW_TAGS } from "./syntax.mjs";
import {
  emptyOps, splitOperands, readRank, readRange, readWho, readDegree, readAgainst, splitComparison, traitKey,
  WHO_FOR, WHO_WHILE, titled, readUntil, readTargetName, WORD_CHAR
} from "./operators.mjs";
import { THREATS, isLoreSlug } from "../config.mjs";
import { readEffectName } from "./effect-list.mjs";

/** The tags an effect line may begin with, each to the kind that reads it. Upper case in the document; case blind here. */
export const EFFECT_TAGS = Object.freeze({
  // `skill` (0.36.0) sits after `check`, which stays the first tag of the `bonus` kind (the
  // grammar names a kind by its first tag).
  check: "bonus", skill: "bonus", atk: "bonus", def: "bonus", init: "bonus", speed: "bonus",
  immune: "prevent", mark: "mark", reroll: "reroll", ignore: "ignore",
  // 0.21.0: `USE: <Attribute>, <Constellation>, <Maneuver>`, the terms a check is made with.
  use: "substitute",
  // 0.22.0: `GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>)` on a Maneuver's
  // own row, what a degree of its check gives another character; and `ALTER: <Maneuver>.<property>;
  // VALUE: <value>` on a Talent, which changes one property of what that Maneuver gives.
  give: "give", alter: "alter",
  // 0.24.0: `PERMIT: move; FOR: allies 0` on a Maneuver's own row: using it lets the creature
  // targeted make one Move now, outside its Opportunity.
  permit: "permit",
  // 0.25.0: `SUBORDINATE: <Maneuver>` on a Maneuver's own row: using it performs the named
  // Maneuver as part of it, at this row's own cost (Mike's Subordinate Maneuver rule).
  subordinate: "subordinate",
  // 0.32.0: `APPLY: <Effect>[, self | target]; UNTIL: <window>; IF: RESULT(<degree>)` and
  // `REMOVE: <Effect>[, self | target]` on a Maneuver's own row: using it puts a Condition or a
  // named Effect on a creature, or takes one off. Two tags, one kind, as CHECK, ATK and DEF share
  // `bonus` (Mike's choice of words, 2026-11-17).
  apply: "apply", remove: "apply",
  // 0.37.0: `COST: <n>; IF: TRAIT(<Trait>)` on a Condition's row: what a creature uses costs more
  // actions while it has the Condition (Heedless). Not the CONDITION word `COST(<n>)`, which is
  // read inside IF: and asks which version of a Maneuver was used.
  cost: "cost",
  // 0.38.0: `CANNOT: <Defense>` on a Condition's row: a creature that has the Condition cannot
  // answer with that Defense (Grabbed: `CANNOT: evade`).
  cannot: "cannot"
});

/** The modifier tags: a value and a bonus type come first. */
export const MODIFIER_TAGS = Object.freeze(["check", "skill", "atk", "def", "init", "speed", "give"]);

/**
 * The tags whose line, ON A CONDITION'S ROW, may carry `UNTIL: each round -1` (0.39.0; ruling 395):
 * the modifier tags a Condition's row reads. The drop is the Condition's own value falling as
 * rounds pass, written on the line that reads that value.
 */
const CONDITION_DROP_TAGS = Object.freeze(["check", "skill", "atk", "def", "init"]);

/**
 * The component words after the tag. `UNTIL` is read after GIVE (0.22.0) and APPLY (0.32.0), and
 * on a Condition's own row after a modifier tag (0.39.0); `VALUE` after ALTER alone. Every other
 * tag refuses each by name.
 */
export const COMPONENTS = Object.freeze(["IF", "IFT", "FOR", "LIMIT", "UNTIL", "VALUE"]);

/**
 * What a COMPONENT is told when it is written as a line of its own, in a block or inside EFFECT
 * (`[UNTIL each round -1]`, `[EFFECT UNTIL: each round -1]`; the review of 0.39.0, where the
 * answers were the list of feature keywords and the list of tags). `UNTIL` is the one a
 * Condition's row with no modifier line reaches for (Slowed), so it is also told that such a row
 * cannot say its drop yet.
 * @param {string} word  The component, in capitals.
 * @returns {string}
 */
export function componentAsBlock(word) {
  if (word === "UNTIL") {
    return "UNTIL is a component, not a line of its own: it follows an effect after a semicolon, as in `[EFFECT APPLY: Taking Cover; UNTIL: 2 rounds]` or, on a Condition's row, `[EFFECT CHECK: -N condition; UNTIL: each round -1]`. A row with no such line to carry it cannot say how its value drops yet";
  }
  return `${word} is a component, not a line of its own: it follows an effect after a semicolon, as in \`[EFFECT CHECK: 1 condition, aid; IF: RANK(Origin >= trained)]\``;
}

/** The tags each of the two 0.22.0 components may follow (`UNTIL` after `APPLY` too since 0.32.0). */
const COMPONENT_TAG = Object.freeze({ UNTIL: ["give", "apply"], VALUE: ["alter"] });

/** The condition words inside IF and IFT. `COST` since 0.32.0. */
export const CONDITIONS = Object.freeze(["RANK", "SEEN", "ALLIES", "ENEMIES", "ALL", "CLAIM", "RESULT", "TRAIT", "MARKED", "BLOW", "BLAST", "BLIGHT", "BEGUILEMENT", "MELEE", "RANGED", "CHECK", "EFFECT", "COST"]);

/**
 * The second words `EFFECT(<name>, <word>)` reads: `used`, a roll has just used the Effect up
 * (0.25.0); `mine`, the creature has it and the one asking put it there (0.32.0).
 */
export const EFFECT_STATES = Object.freeze(["used", "mine"]);

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
  let scale = null;
  let descriptors;
  if (MODIFIER_TAGS.includes(tag)) {
    const parts = splitOperands(rest);
    const first = parts.shift() ?? "";
    // A comma with nothing after it (`CHECK: 1 situation, `): a target was deleted and its comma
    // left. Refused: with no target the line means something wider, and since 0.36.0 a bare CHECK
    // is every roll and Threshold (the review of 0.36.0; the empty descriptor was dropped).
    if (/,\s*(?:,|$)/.test(rest) || parts.some(p => !String(p ?? "").trim())) {
      throw new RuleSyntaxError(`${tag.toUpperCase()}: a comma with nothing after it; name the target after the comma, or take the comma out`);
    }
    const words = first.split(/\s+/).filter(Boolean);
    // `N` (0.33.0; ruling 326): the Condition's own value, on a Condition's row of the Conditions
    // workbook. `DEF: -N condition` on Frightened is -2 at Frightened 2. Stored as the sign with
    // `scale: "N"`, never as a string: a kind that found a value that is no number would drop the
    // rule in silence. Anywhere else there is no Condition whose value it could be.
    const scaled = words.length ? words[0].match(/^([+-]?)N$/i) : null;
    if (scaled && (tag !== "give")) {
      if (context?.itemType !== CONDITION_ROW) {
        throw new RuleSyntaxError(`"${words[0]}" is a Condition's own value and is written on that Condition's row of the Conditions workbook, as in \`DEF: -N condition\` on Frightened; here write a whole number`);
      }
      value = (scaled[1] === "-") ? -1 : 1;
      scale = "N";
      if (words.length > 2) throw new RuleSyntaxError(`"${first}": the value and its type, then a comma before any descriptor`);
      type = words[1] ?? null;
      descriptors = parts.map(p => p.trim()).filter(Boolean);
    } else if (!words.length || !/^[+-]?\d+$/.test(words[0])) {
      // An example is a line that reads: a GIVE needs its degree (the review of 2026-11-14).
      const example = tag === "give" ? "1 situation, chosen; IF: RESULT(success)" : `1 condition${tag === "check" ? ", aid" : tag === "def" ? ", guard" : ""}`;
      // `[EFFECT CHECK: Athletics vs Evade]` (0.34.0): the check a Maneuver rolls, written as the
      // bonus tag. Told its own block, beside the tag's shape.
      const block = (tag === "check") ? ". The check a Maneuver rolls is a block of its own, with no EFFECT and no colon: `[CHECK Athletics vs Evade]`" : "";
      // The shape of the tag itself: only CHECK, DEF and GIVE take a descriptor.
      const shape = ["check", "def", "give"].includes(tag) ? "<value> <type>, <descriptor>" : "<value> <type>";
      throw new RuleSyntaxError(`${tag.toUpperCase()} is written \`${tag.toUpperCase()}: ${shape}\`, as in \`${tag.toUpperCase()}: ${example}\`: a signed whole number first, not "${first}"${block}`);
    } else {
      value = Number(words[0]);
      if (value === 0) throw new RuleSyntaxError("a bonus of 0 does nothing");
      if (words.length > 2) throw new RuleSyntaxError(`"${first}": the value and its type, then a comma before any descriptor`);
      type = words[1] ?? null;
      descriptors = parts.map(p => p.trim()).filter(Boolean);
    }
  } else {
    descriptors = splitOperands(rest).map(p => p.trim()).filter(Boolean);
  }

  const ops = emptyOps();
  for (const component of components.slice(1)) readComponent(component, ops, context, tag);
  return { tag, kind: EFFECT_TAGS[tag], value, type, ...(scale ? { scale } : {}), descriptors, ops, components };
}

/** Split a line on the semicolons outside parentheses and quotes, trimmed, empties dropped. */
export function splitComponents(line) {
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = null;
  let before = "";
  for (const ch of line) {
    const prev = before;
    before = ch;
    if (quote) { current += ch; if (ch === quote) quote = null; continue; }
    // An apostrophe inside a word is no opening quote (0.31.0; `splitOperands` reads the same).
    if ((ch === '"') || ((ch === "'") && !WORD_CHAR.test(prev))) { quote = ch; current += ch; continue; }
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

/**
 * One component after the tag into `ops`: `IF: ...`, `IFT: ...`, `FOR: ...`, `LIMIT: ...`,
 * `UNTIL: ...` (after GIVE and APPLY, and on a Condition's row after a modifier tag) and
 * `VALUE: ...` (after ALTER), each refused by name after any other tag, here rather than in the
 * kinds because `bonus` reads its ops without a refusal list.
 */
function readComponent(component, ops, context, tag = "") {
  const match = component.match(/^([A-Za-z]+)\s*:\s*([\s\S]*)$/);
  const word = match?.[1]?.toUpperCase() ?? "";
  const inside = match?.[2]?.trim() ?? "";
  // 0.39.0: on a CONDITION'S ROW a modifier line may say how that Condition's own value drops as
  // rounds pass (`CHECK: -N condition; UNTIL: each round -1`). The kind decides the rest (bonus.mjs).
  const onRow = context?.itemType === CONDITION_ROW;
  // A tag that row does not read at all (SPEED, GIVE, APPLY) is refused by its name once the
  // line is read (./grammar.mjs). Its UNTIL is not judged first, or the author would be told
  // where a drop is written when the trouble is the tag (the review of 0.39.0).
  if ((word === "UNTIL") && onRow && !CONDITION_ROW_TAGS.includes(tag)) return;
  const dropsHere = (word === "UNTIL") && onRow && CONDITION_DROP_TAGS.includes(tag);
  if (Object.hasOwn(COMPONENT_TAG, word) && !COMPONENT_TAG[word].includes(tag) && !dropsHere) {
    // A bonus line off a Condition's row is told where a duration IS written, since "for 2
    // rounds" is the natural thing to try on one. A custom effect typed on the Effects tab has
    // a Duration of its own, and is sent neither to APPLY nor to the workbook.
    if ((word === "UNTIL") && MODIFIER_TAGS.includes(tag) && (tag !== "give") && (context?.itemType === "effect")) {
      throw new RuleSyntaxError(`${tag.toUpperCase()} does not take UNTIL: a custom effect lasts as its Duration says (until removed, the next roll, or the encounter), and a count of rounds is not read there yet`);
    }
    if ((word === "UNTIL") && MODIFIER_TAGS.includes(tag) && (tag !== "give")) {
      throw new RuleSyntaxError(`${tag.toUpperCase()} does not take UNTIL: a bonus lasts as long as the thing that carries it. How long an Effect lasts is written after APPLY (\`APPLY: Taking Cover; UNTIL: 2 rounds\`), and a Condition's own value drops by \`UNTIL: each round -1\` on its row of the Conditions workbook`);
    }
    throw new RuleSyntaxError(`${tag.toUpperCase()} does not take ${word}`);
  }
  switch (word) {
    case "UNTIL":
      if (ops.until) throw new RuleSyntaxError("UNTIL is given twice");
      // An APPLY line's window may name its edge (0.32.0); a GIVE's keeps the two it always had.
      ops.until = readUntil(inside, { edges: tag === "apply", drops: dropsHere });
      return;
    case "VALUE":
      if (ops.set !== null) throw new RuleSyntaxError("VALUE is given twice");
      if (!inside) throw new RuleSyntaxError("VALUE: says what the property becomes, as in `VALUE: nothing` or `VALUE: recipient opportunity 2`");
      ops.set = inside;
      return;
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
    default: {
      // A component word with its colon lost (`UNTIL each round -1`, the review of 0.39.0): told
      // the colon, where the message below called it "not a component" and listed others.
      const bare = component.trim().split(/\s+/)[0].toUpperCase();
      if (!component.includes(":") && COMPONENTS.includes(bare)) {
        throw new RuleSyntaxError(`${bare} is a component and takes a colon: write \`${bare}: ${component.trim().slice(bare.length).trim() || "..."}\``);
      }
      // `APPLY: prone; COST: 2` (0.37.0): since COST is also a tag, the general message below
      // would say it begins its own line, when the author meant the condition. Told only after
      // APPLY and REMOVE, the two tags that read `IF: COST(<n>)`: after any other the advice would
      // send the author to a condition that tag then refuses (the review of 0.37.0).
      if ((word === "COST") && ((tag === "apply") || (tag === "remove"))) {
        throw new RuleSyntaxError(`after a semicolon the cost is a condition: write \`IF: COST(${inside || "2"})\`, the version of the Maneuver that was used. \`COST:\` at the start of a line is another thing: it raises what a thing costs, on a Condition's row`);
      }
      if (Object.hasOwn(EFFECT_TAGS, word.toLowerCase())) {
        throw new RuleSyntaxError(`"${word}" is a tag and begins its own line; one effect per line, its conditions after it as IF:, IFT:, FOR: and LIMIT:`);
      }
      // A part with no colon is most often a descriptor that followed a semicolon (`USE: Presence;
      // Origin; aid`), so the message says which mark does what (0.21.0).
      // GIVE and ALTER (0.22.0) are told their own components, so a `PRESERVE:` after an ALTER is
      // not sent looking for a FOR.
      // A Condition's row is told its own two (0.39.0): FOR and LIMIT are refused there.
      const rowLine = (context?.itemType === CONDITION_ROW) && CONDITION_DROP_TAGS.includes(tag);
      throw new RuleSyntaxError(`"${component}" is not a component: after the tag come ${(tag === "give") || (tag === "apply") ? "IF: and UNTIL:" : tag === "remove" ? "IF:" : tag === "alter" ? "VALUE: and IF:" : rowLine ? "IFT: and UNTIL:" : "IF:, IFT:, FOR: and LIMIT:"}${component.includes(":") ? "" : " (descriptors are separated by commas; a semicolon begins a component)"}`);
    }
  }
}

/**
 * A condition inside IF or IFT. For every condition but one, the condition decides what it is
 * about, not the prefix: RANK, SEEN, the counts and CLAIM are the owner's or the roll's, TRAIT,
 * MARKED, a Threat word and CHECK are the other party's; FG's own effects mix the two, so both
 * prefixes read. THE ONE EXCEPTION IS `EFFECT(<name>)` (0.31.0; ruling 307), which can be asked of
 * either side, so there the prefix is the answer: `IF:` is the roller, `IFT:` the other party.
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
      // Two traits in one pair of parentheses (the review of 0.37.0): told so, where the general
      // message below would call the pair "not a trait word".
      if (name.includes(",")) throw new RuleSyntaxError(`TRAIT names one trait, as in \`TRAIT(Fear)\`, not "${name}": write a line for each trait`);
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
    case "EFFECT": {
      // Named Effects (Mike, 2026-11-15: "other modifiers/effects can be applied IF that custom
      // Effect field is on the target"; built in two steps by his choice).
      //
      //   EFFECT(<name>)        0.31.0 (ruling 307): the creature HAS it now, a Condition or a
      //                         named Effect (./effect-list.mjs). THE PREFIX DECIDES WHOSE: after
      //                         `IF:` the roller's own, after `IFT:` the roll's other party's.
      //                         Stored in `ops.has`, one entry for each, so a line may ask both.
      //   EFFECT(<name>, used)  0.25.0, step one: a roll of the owner's has just used up the
      //                         Effect of that name, which is the Maneuver that gave it (Aid).
      //                         Stored in `ops.used`, unchanged, and the owner's alone.
      const shape = "EFFECT is written `EFFECT(<name>)`, `EFFECT(<name>, mine)` or `EFFECT(<name>, used)`, as in `IF: EFFECT(Taking Cover)`, `IFT: EFFECT(prone)`, `IFT: EFFECT(wrong-footed, mine)` or `IF: EFFECT(Aid, used)`";
      // An empty part (`EFFECT(, used)`) is a slip in the shape, not a name: the splitter drops it,
      // which would read the state as the name.
      if ((arg == null) || !arg.trim() || /^\s*,|,\s*,|,\s*$/.test(arg)) throw new RuleSyntaxError(shape);
      const parts = splitOperands(arg).map(p => p.trim());
      const written = parts[0] ?? "";
      if (!written || (parts.length > 2)) throw new RuleSyntaxError(shape);
      // `mine` (0.32.0; ruling 319): the plain form, narrowed to an Effect the one asking put
      // there (its applied record names them). "Wrong-Footed to you" is `IFT: EFFECT(wrong-footed,
      // mine)`. It is a word on the plain form, so it reads after either prefix.
      let mine = false;
      if ((parts.length === 2) && (parts[1].toLowerCase() === "mine")) {
        mine = true;
        parts.pop();
      }
      if (parts.length === 2) {
        const state = parts[1].toLowerCase();
        if (state !== "used") {
          throw new RuleSyntaxError(`"${parts[1]}": the second word is \`used\` (a roll of yours has just used the Effect up) or \`mine\` (you put it there); an Effect a creature has now is written \`EFFECT(${written})\``);
        }
        if (prefix === "IFT") {
          throw new RuleSyntaxError(`IFT: EFFECT(${written}, used) is not read: a used Effect is your own roll's, so it is written \`IF: EFFECT(${written}, used)\``);
        }
        if (ops.used) throw new RuleSyntaxError("EFFECT(..., used) is given twice");
        const example = "`IF: EFFECT(Aid, used)`";
        const read = readTargetName(written, context?.resolve);
        if (!read || !read.slug) throw new RuleSyntaxError(`"${written}" names no Maneuver: a used Effect is named for the Maneuver that gave it, as in ${example}`);
        if (read.type === "constellation") {
          throw new RuleSyntaxError(`"${read.name}" is a Constellation: a used Effect is named for the Maneuver that gave it, as in ${example}`);
        }
        ops.used = { name: read.name, slug: read.slug };
        return;
      }
      const read = readEffectName(written);
      const on = (prefix === "IFT") ? "other" : "self";
      const has = (ops.has ??= []);
      if (has.some(h => (h.on === on) && (h.slug === read.slug) && ((h.condition ?? null) === read.condition))) {
        throw new RuleSyntaxError(`${prefix}: EFFECT(${read.name}) is given twice`);
      }
      has.push({ name: read.name, slug: read.slug, condition: read.condition, on, ...(mine ? { mine: true } : {}) });
      return;
    }
    case "COST": {
      // 0.32.0 (ruling 318): WHICH VERSION of the Maneuver was used, by its listed cost. Trip,
      // Grapple, Demoralize and others print a table of results for each cost, so a line may wait
      // on it. Never a raised price (0.37.0, ruling 380): a Heedless creature that pays one more
      // for a Concentrate Maneuver still gets the results of the version it chose.
      // Read by `apply` alone; every other kind refuses it by name.
      if ((ops.cost !== null) && (ops.cost !== undefined)) throw new RuleSyntaxError("COST is given twice");
      const written = String(arg ?? "").trim();
      if (!/^\d{1,2}$/.test(written) || (Number(written) > 12)) {
        throw new RuleSyntaxError("COST is written `COST(<n>)`, the version of the Maneuver used by its listed cost, as in `IF: COST(2)`");
      }
      ops.cost = Number(written);
      return;
    }
    default:
      throw new RuleSyntaxError(`"${inside}" is not a condition: ${prefix}: takes ${CONDITIONS.join(", ")}`);
  }
}

function titledDegree(outcome) {
  return { critSuccess: "Critical Success", success: "Success", fail: "Failure", critFail: "Critical Failure" }[outcome] ?? titled(outcome);
}
