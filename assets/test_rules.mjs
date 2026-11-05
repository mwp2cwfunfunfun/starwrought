#!/usr/bin/env node
/**
 * test_rules.mjs: the self-test of the automation framework (0.9.0; rulings 118 to 120) and of
 * its kinds (`bonus` since 0.10.0; rulings 121 to 124).
 *
 * `build_all.mjs` runs this in every step-running mode (the full pipeline and the content loop alike; `--check` runs no step), as the step `test_rules` right
 * before `build_foundry`, because the next step parses every Automation cell in the book with
 * exactly this grammar: a grammar that broke would fail every cell at once with a message about
 * the cells. This is a unit test of the modules under foundry/starwrought/module/rules/, imported
 * from plain Node as the build imports them (which is itself the first check: a Foundry global at
 * module scope fails the import). It is not the pipeline and touches no file.
 *
 * It registers throwaway kinds IN PROCESS (`test-only`, `misbehaving`, and a few for the hook
 * dispatcher), which ship nowhere: the registry is a Map in this process and the system never
 * imports this file. SHIPPED_KINDS below is the list the registry must hold before any of that,
 * so a kind registered in kinds/index.mjs without being named here fails the pipeline, which is
 * the point of naming it.
 *
 *   node assets/test_rules.mjs      exit 0 and "rules framework: N checks passed", or exit 1
 *                                   with every failing check named
 */

import {
  parseAutomation, summarize, ruleEntries, splitArgs, keyValues, RuleSyntaxError, RESERVED_WORDS,
  KIND_WORD, kindOf, knownKinds
} from "../foundry/starwrought/module/rules/grammar.mjs";
import { KINDS, registerKind } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { collectRules, rulesOfKind, ruleModifiers, rulePreventers, RULE_ITEM_TYPES } from "../foundry/starwrought/module/rules/engine.mjs";
import { splitOperands, readLine, rankMeets, whoMatches, compare, needsMoment, hasTrait, traitKey } from "../foundry/starwrought/module/rules/operators.mjs";
import { toGrantField } from "../foundry/starwrought/module/rules/kinds/grant.mjs";
import { toAuraField } from "../foundry/starwrought/module/rules/kinds/aura.mjs";
import { slugify, plainName, resolveModifiers, ACTION_GLYPHS } from "../foundry/starwrought/module/config.mjs";
// The attack flow's pure parts (0.12.0): the record's shape and the legal answers, both free of
// Foundry globals at module scope, so the rule "no Defense is ever chosen by the system" has
// checks the build runs.
import { AttackWorkflow, ACTIONS, OUTSTANDING_KINDS } from "../foundry/starwrought/module/combat/attack-workflow.mjs";
import { legalAnswers, isLegalAnswer } from "../foundry/starwrought/module/helpers/answers.mjs";

// Foundry's prototype extension, which resolveModifiers uses inside its body (config.mjs says
// so); plain Node has no such thing, and the stacking section below calls the function directly.
Number.isNumeric ??= n => (typeof n === "number") && !Number.isNaN(n);

/**
 * The kinds the registry ships with, by id, sorted. Empty in 0.9.0 (Mike, 2026-10-03: "do NOT
 * survey the talents yet or build ANY of the automation hooks. just build the framework"); `bonus`
 * since 0.10.0, Mike's first (Humanity's "+1 Condition bonus on checks to Aid"), with its own
 * checks below. Each kind that lands adds its id here and its section of checks.
 */
const SHIPPED_KINDS = ["aura", "bonus", "grant", "prevent"];

/**
 * The word every "unknown kind" check uses. Reserved: no kind may ever register it, and the check
 * at the foot of the registry section holds it to that. Through 0.10.0 these checks used "aura",
 * which the next kind to ship is named, so shipping it would have failed a dozen checks that were
 * not about it (the automation-framework review, 2026-11-04).
 */
const UNKNOWN_KIND = "not-a-real-kind";

/* -------------------------------------------- */
/*  A small harness                             */
/* -------------------------------------------- */

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures.push({ name, message: error?.message ?? String(error) });
    console.log(`  FAIL  ${name} :: ${error?.message ?? error}`);
  }
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

/** `fn` must throw, and the message must match `pattern` when one is given. */
function throws(fn, pattern, what) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  must(thrown, `${what}: nothing was thrown`);
  if (pattern) must(pattern.test(thrown.message), `${what}: threw "${thrown.message}", which does not match ${pattern}`);
  return thrown;
}

/* -------------------------------------------- */
/*  The registry as shipped                     */
/* -------------------------------------------- */

console.log("rules framework self-test");

check("the registry ships with exactly the kinds SHIPPED_KINDS names", () => {
  same(knownKinds(), SHIPPED_KINDS, "knownKinds()");
  must(KINDS.size === SHIPPED_KINDS.length, `KINDS holds ${KINDS.size} kinds, SHIPPED_KINDS names ${SHIPPED_KINDS.length}`);
});

check("KIND_WORD is lower-case letters and hyphens, starting with a letter", () => {
  for (const good of ["aura", "test-only", "a"]) must(KIND_WORD.test(good), `${good} should be a kind word`);
  for (const bad of ["Aura", "15ft", "-aura", "aura_x", "aura x", ""]) must(!KIND_WORD.test(bad), `"${bad}" should not be a kind word`);
});

check("RESERVED_WORDS are kind, line, text and error", () => {
  same([...RESERVED_WORDS].sort(), ["error", "kind", "line", "text"], "RESERVED_WORDS");
});

/* -------------------------------------------- */
/*  The grammar with an empty registry          */
/* -------------------------------------------- */

// These run before any throwaway kind registers, so the "known kinds:" tail is what the build
// would print today on a cell that names an unknown one (the "no rule kinds are defined yet" tail
// was 0.9.0's, and the branch stays so the check reads either registry).
const registryWasEmpty = knownKinds().length === 0;

check("blank and comment lines parse to nothing", () => {
  const parsed = parseAutomation("\n   \n# a comment\n\t# another, indented\n\n");
  same(parsed.rules, [], "rules");
  same(parsed.errors, [], "errors");
});

check("an empty, null or undefined cell parses to nothing", () => {
  for (const text of ["", null, undefined]) {
    const parsed = parseAutomation(text);
    same(parsed, { rules: [], errors: [] }, `parseAutomation(${String(text)})`);
  }
});

check("an unknown kind is one error naming the word and the line", () => {
  const parsed = parseAutomation(`# the cell\n\n${UNKNOWN_KIND}: 15 ft allies`);
  same(parsed.rules, [], "rules");
  must(parsed.errors.length === 1, `expected one error, got ${parsed.errors.length}`);
  const [error] = parsed.errors;
  must(error.line === 3, `the error should be on line 3 (blanks and comments count), got ${error.line}`);
  must(error.text === `${UNKNOWN_KIND}: 15 ft allies`, `the error should carry the trimmed line, got "${error.text}"`);
  if (registryWasEmpty) {
    must(error.message === `unknown rule kind "${UNKNOWN_KIND}" (no rule kinds are defined yet)`, `message: "${error.message}"`);
  } else {
    must(new RegExp(`^unknown rule kind "${UNKNOWN_KIND}" \\(known kinds: `).test(error.message), `message: "${error.message}"`);
  }
});

check("a word that is not shaped like a kind word says so", () => {
  const { errors } = parseAutomation("15 ft allies");
  must(errors.length === 1, "one error");
  must(/unknown rule kind "15"/.test(errors[0].message), `names the word: "${errors[0].message}"`);
  must(/lower-case letters and hyphens/.test(errors[0].message), `gives the shape: "${errors[0].message}"`);
});

check("a line with nothing before its colon has no kind word", () => {
  const { errors } = parseAutomation(": 15 ft");
  must(errors.length === 1, "one error");
  must(/no kind word/.test(errors[0].message), `message: "${errors[0].message}"`);
});

check("the kind word is lower-cased before the lookup", () => {
  const { errors } = parseAutomation(`${UNKNOWN_KIND.toUpperCase()}: 15 ft`);
  must(errors.length === 1 && errors[0].message.includes(`unknown rule kind "${UNKNOWN_KIND}"`), `message: "${errors[0]?.message}"`);
});

/* -------------------------------------------- */
/*  The registry's contract                     */
/* -------------------------------------------- */

check("registerKind refuses a definition without parse", () => {
  throws(() => registerKind({ id: "no-parse", summary: () => "" }), /no parse/, "no parse");
  must(!kindOf("no-parse"), "the refused kind must not be registered");
});

check("registerKind refuses a definition without summary", () => {
  throws(() => registerKind({ id: "no-summary", parse: () => ({}) }), /no summary/, "no summary");
  must(!kindOf("no-summary"), "the refused kind must not be registered");
});

check("registerKind refuses an id that is not a kind word", () => {
  for (const id of ["Aura", "15ft", "aura x", "", undefined]) {
    throws(() => registerKind({ id, parse: () => ({}), summary: () => "" }), /lower-case letters and hyphens/, `id ${JSON.stringify(id)}`);
  }
});

check("registerKind refuses a hook that is not a function", () => {
  throws(() => registerKind({ id: "bad-hook", parse: () => ({}), summary: () => "", hooks: { onRoll: "yes" } }), /hook "onRoll" is not a function/, "bad hook");
  throws(() => registerKind({ id: "bad-hooks", parse: () => ({}), summary: () => "", hooks: [] }), /hooks must be an object/, "hooks as array");
  must(!kindOf("bad-hook") && !kindOf("bad-hooks"), "neither refused kind may be registered");
});

check("registerKind refuses an alias that is not a kind word, or the id itself", () => {
  throws(() => registerKind({ id: "with-alias", aliases: ["Bad Alias"], parse: () => ({}), summary: () => "" }), /aliases must be/, "bad alias");
  throws(() => registerKind({ id: "with-alias", aliases: ["with-alias"], parse: () => ({}), summary: () => "" }), /its own id as an alias/, "self alias");
  throws(() => registerKind({ id: "with-alias", aliases: ["a", "a"], parse: () => ({}), summary: () => "" }), /repeats an alias/, "repeated alias");
  must(!kindOf("with-alias"), "the refused kind must not be registered");
});

/* -------------------------------------------- */
/*  A throwaway kind, in process                */
/* -------------------------------------------- */

/** The context the last parse received, for the check that the grammar passes it through. */
let lastContext = null;

const testOnly = {
  id: "test-only",
  aliases: ["probe"],
  parse(args, context) {
    lastContext = context;
    const { pairs, rest } = keyValues(splitArgs(args));
    if (!rest.length) throw new RuleSyntaxError("say what is being tested, before any key=value");
    if ((pairs.times !== undefined) && !/^\d+$/.test(pairs.times)) {
      throw new RuleSyntaxError(`times must be a whole number, not "${pairs.times}"`);
    }
    return { subject: rest.join(" "), times: (pairs.times === undefined) ? 1 : Number(pairs.times) };
  },
  summary(rule) {
    return `test ${rule.subject}, ${rule.times} time${rule.times === 1 ? "" : "s"}`;
  }
};

/** A kind that misbehaves on purpose: the grammar must survive every way a kind can be wrong. */
const misbehaving = {
  id: "misbehaving",
  parse(args) {
    if (args === "throw") throw new TypeError("boom");
    if (args === "string") return "not an object";
    if (args === "array") return [1, 2];
    return {};
  },
  summary() {
    throw new Error("the summary is broken too");
  }
};

check("registerKind accepts the throwaway kinds and fills in aliases and hooks", () => {
  const registered = registerKind(testOnly);
  same(registered.aliases, ["probe"], "aliases");
  same(registered.hooks, {}, "hooks default");
  must(registered.id === "test-only", "id");
  registerKind(misbehaving);
  same(knownKinds(), [...SHIPPED_KINDS, "misbehaving", "test-only"].sort(), "knownKinds() after registering");
  must(kindOf("test-only") && kindOf("TEST-ONLY") && kindOf(" probe ") , "kindOf resolves id, case and alias");
  must(kindOf("probe").id === "test-only", "an alias resolves to the kind");
  must(kindOf(UNKNOWN_KIND) === undefined && kindOf(null) === undefined && kindOf("") === undefined, "nothing else resolves");
});

check("the reserved test word is a well-formed kind word that no kind registers", () => {
  must(KIND_WORD.test(UNKNOWN_KIND), "shaped like a kind word, so the checks test the lookup and not the shape");
  must(kindOf(UNKNOWN_KIND) === undefined, `"${UNKNOWN_KIND}" must never resolve; a kind that took it breaks every unknown-kind check`);
});

check("registerKind refuses a duplicate id", () => {
  throws(() => registerKind({ ...testOnly }), /"test-only" is already taken by the "test-only" kind/, "duplicate id");
});

check("registerKind refuses an id or alias that is another kind's alias or id", () => {
  throws(() => registerKind({ id: "probe", parse: () => ({}), summary: () => "" }), /"probe" is already taken by the "test-only" kind/, "id equal to an alias");
  throws(() => registerKind({ id: "fresh", aliases: ["misbehaving"], parse: () => ({}), summary: () => "" }), /"misbehaving" is already taken/, "alias equal to an id");
  must(!kindOf("fresh"), "the refused kind must not be registered");
});

check("a known kind parses its arguments into rule data", () => {
  const { rules, errors } = parseAutomation("test-only: the grammar, times=3");
  same(errors, [], "errors");
  must(rules.length === 1, "one rule");
  same(rules[0], { subject: "the grammar", times: 3, kind: "test-only", line: 1, text: "test-only: the grammar, times=3" }, "the rule");
});

check("the colon is optional, the word is case blind and an alias resolves to the id", () => {
  const { rules, errors } = parseAutomation("test-only the grammar\nTEST-ONLY: the grammar\nprobe: the grammar\nProbe the grammar");
  same(errors, [], "errors");
  must(rules.length === 4, `four rules, got ${rules.length}`);
  for (const rule of rules) {
    must(rule.kind === "test-only", `kind should be the canonical id, got ${rule.kind}`);
    must(rule.subject === "the grammar", `arguments should be the rest of the line, got "${rule.subject}"`);
  }
  same(rules.map(r => r.line), [1, 2, 3, 4], "line numbers");
});

check("CRLF line endings, indentation and interleaved comments are read the same", () => {
  const { rules, errors } = parseAutomation("  # head\r\n\r\n   test-only: a   \r\n# mid\r\ntest-only: b\r\n");
  same(errors, [], "errors");
  same(rules.map(r => [r.line, r.subject, r.text]), [[3, "a", "test-only: a"], [5, "b", "test-only: b"]], "rules");
});

check("the reserved words win over a kind's data, and a kind cannot mark its own rule as an error", () => {
  const sly = { id: "sly", parse: () => ({ kind: UNKNOWN_KIND, line: 99, text: "nope", error: "nope", payload: 1 }), summary: () => "sly" };
  registerKind(sly);
  const { rules, errors } = parseAutomation("sly: anything");
  same(errors, [], "errors");
  same(rules[0], { payload: 1, kind: "sly", line: 1, text: "sly: anything" }, "the rule");
  must(!("error" in rules[0]), "a kind's `error` is dropped");
  must(summarize(rules[0]) === "sly", "and the rule summarizes as a rule, not as an error");
  must(collectRules({ items: [{ type: "talent", system: { rules } }] }).all.length === 1, "and the engine files it as usable");
});

check("the grammar hands the kind its context plus line, text and kind", () => {
  lastContext = null;
  parseAutomation("test-only: ctx", { itemName: "Torchbearer Human", constellation: "Humanity", itemType: "talent", source: "Humanity / Torchbearer Human" });
  must(lastContext, "parse received a context");
  same(lastContext, {
    itemName: "Torchbearer Human", constellation: "Humanity", itemType: "talent", source: "Humanity / Torchbearer Human",
    line: 1, text: "test-only: ctx", kind: "test-only"
  }, "context");
});

check("summarize prints the kind's summary", () => {
  const { rules } = parseAutomation("test-only: the grammar, times=3\nprobe: once");
  must(summarize(rules[0]) === "test the grammar, 3 times", `got "${summarize(rules[0])}"`);
  must(summarize(rules[1]) === "test once, 1 time", `got "${summarize(rules[1])}"`);
});

check("a kind that throws RuleSyntaxError yields an error line with its message and no crash", () => {
  const { rules, errors } = parseAutomation("test-only: times=2\ntest-only: ok\ntest-only: it, times=many");
  must(rules.length === 1 && rules[0].subject === "ok", "the good line still parses");
  same(errors.map(e => [e.line, e.message]), [
    [1, "say what is being tested, before any key=value"],
    [3, 'times must be a whole number, not "many"']
  ], "errors");
  must(errors[0].text === "test-only: times=2", "the error carries the line's text");
});

check("a kind that throws anything else is reported as the kind's failure, never a crash", () => {
  const { rules, errors } = parseAutomation("misbehaving: throw");
  same(rules, [], "rules");
  must(errors.length === 1, "one error");
  must(/^the "misbehaving" kind could not read this line: boom \(a bug in the kind, not in the cell\)$/.test(errors[0].message), `message: "${errors[0].message}"`);
});

check("a kind whose parse returns something that is not an object is an error line", () => {
  const { rules, errors } = parseAutomation("misbehaving: string\nmisbehaving: array\nmisbehaving: fine");
  must(rules.length === 1 && rules[0].line === 3, "only the well-behaved line parses");
  must(errors.length === 2, `two errors, got ${errors.length}`);
  must(/returned a string for this line, not an object/.test(errors[0].message), `message 1: "${errors[0].message}"`);
  must(/returned an array for this line, not an object/.test(errors[1].message), `message 2: "${errors[1].message}"`);
});

check("a kind's parse may return nothing; the rule is then its reserved words alone", () => {
  const quiet = { id: "quiet", parse: () => undefined, summary: () => "quiet" };
  registerKind(quiet);
  const { rules, errors } = parseAutomation("quiet");
  same(errors, [], "errors");
  same(rules, [{ kind: "quiet", line: 1, text: "quiet" }], "rules");
});

check("summarize falls back for error entries, unknown kinds and a broken summary", () => {
  must(summarize({ error: `unknown rule kind "${UNKNOWN_KIND}"`, line: 1, text: `${UNKNOWN_KIND}: 15 ft` }) === `unknown rule kind "${UNKNOWN_KIND}"`, "an error entry prints its error");
  must(summarize({ kind: UNKNOWN_KIND, line: 1, text: `${UNKNOWN_KIND}: 15 ft` }) === `unknown rule kind "${UNKNOWN_KIND}"`, "an unregistered kind prints unknown rule kind with the word");
  must(summarize({ line: 1, text: "x" }) === "unknown rule kind", "no kind at all prints unknown rule kind");
  must(summarize({ kind: "misbehaving", line: 1, text: "misbehaving: fine" }) === "misbehaving: fine", "a broken summary falls back to the text");
  must(summarize(null) === "" && summarize("x") === "", "nothing to summarize is an empty string");
});

check("RuleSyntaxError carries line and text when given them", () => {
  const bare = new RuleSyntaxError("bad");
  must(bare.name === "RuleSyntaxError" && bare.message === "bad" && bare.line === null && bare.text === "", "bare");
  const placed = new RuleSyntaxError("bad", { line: 4, text: "bonus: x" });
  must(placed.line === 4 && placed.text === "bonus: x", "placed");
  must(placed instanceof Error, "is an Error");
});

/* -------------------------------------------- */
/*  ruleEntries                                 */
/* -------------------------------------------- */

check("ruleEntries merges rules and errors in line order with errors as { error, line, text }", () => {
  const parsed = parseAutomation(`test-only: a\n${UNKNOWN_KIND}: 15 ft\ntest-only: times=x\ntest-only: b`);
  const entries = ruleEntries(parsed);
  same(entries.map(e => e.line), [1, 2, 3, 4], "line order");
  same(entries[1], { error: `unknown rule kind "${UNKNOWN_KIND}" (known kinds: ${[...SHIPPED_KINDS, "misbehaving", "quiet", "sly", "test-only"].sort().join(", ")})`, line: 2, text: `${UNKNOWN_KIND}: 15 ft` }, "an unknown-kind entry");
  must(entries[2].error === "say what is being tested, before any key=value", "a kind's refusal becomes an error entry");
  must(entries[0].kind === "test-only" && entries[3].kind === "test-only", "parsed rules pass through unchanged");
  same(ruleEntries(null), [], "nothing in, nothing out");
});

/* -------------------------------------------- */
/*  Plain data (0.10.1)                         */
/* -------------------------------------------- */

check("a kind whose parse returns data that is not plain is an error line naming the path", () => {
  const cycle = { self: null };
  cycle.self = cycle;
  const shapes = {
    nan: { n: NaN }, infinite: { n: -Infinity }, fn: { f() {} }, date: { when: new Date(0) },
    map: { m: new Map() }, nested: { a: { b: [1, { c: Symbol("x") }] } }, cycle,
    undef: { keep: 1, drop: undefined, deep: { also: undefined, kept: null }, list: [1, undefined, "two"] }
  };
  registerKind({ id: "unstorable", parse: args => shapes[args], summary: () => "unstorable" });
  const { rules, errors } = parseAutomation(["nan", "infinite", "fn", "date", "map", "nested", "cycle", "undef"].map(s => `unstorable: ${s}`).join("\n"));
  same(errors.map(e => e.message.match(/\((.*)\) \(a bug/)?.[1]), [
    "n is NaN", "n is -Infinity", "f is a function", "when is a Date, not a plain object",
    "m is a Map, not a plain object", "a.b[1].c is a symbol", "self refers back to itself"
  ], "the problems, each with its path");
  must(errors.every(e => /^the "unstorable" kind returned data that cannot be stored/.test(e.message)), "named as the kind's bug, not the cell's");
  same(rules, [{ keep: 1, deep: { kept: null }, list: [1, null, "two"], kind: "unstorable", line: 8, text: "unstorable: undef" }],
    "an undefined property is left out and an undefined element becomes null, as JSON has them; the rest is stored");
  same(JSON.parse(JSON.stringify(rules[0])), rules[0], "the stored rule equals its own JSON image");
});

check("the bonus kind's data is plain data (its rules travel through the pack sources and Sync content)", () => {
  const { rules, errors } = parseAutomation("bonus: +1, Condition, Aid, IF(Human=Trained), FOR(allies, 15ft), WHILE(allies>=1, 0ft), AGAINST(Blow), FIRST(round)");
  same(errors, [], "errors");
  same(JSON.parse(JSON.stringify(rules[0])), rules[0], "equals its JSON image");
});

/* -------------------------------------------- */
/*  The helpers                                 */
/* -------------------------------------------- */

check("splitArgs splits on commas outside quotes, trims, unquotes and drops empties", () => {
  same(splitArgs("15 ft, allies , 'Torchbearer, the Bright',\"a, b\",,"), ["15 ft", "allies", "Torchbearer, the Bright", "a, b"], "parts");
  same(splitArgs(""), [], "empty");
  same(splitArgs(null), [], "null");
  same(splitArgs("one"), ["one"], "one part");
  same(splitArgs("say \"hi, there\" now"), ["say \"hi, there\" now"], "quotes inside a part are kept");
});

check("splitArgs throws RuleSyntaxError on an unclosed quote", () => {
  const error = throws(() => splitArgs("a, 'b, c"), /an opening ' has no closing '/, "unclosed quote");
  must(error instanceof RuleSyntaxError, "the throw is a RuleSyntaxError, so the grammar prints it as the designer's");
});

check("keyValues sorts key=value pairs from the rest, keys lower-cased, values unquoted", () => {
  const { pairs, rest } = keyValues(["15 ft", "Range = 30", "to='the allies'", "allies", "x="]);
  same(pairs, { range: "30", to: "the allies", x: "" }, "pairs");
  same(rest, ["15 ft", "allies"], "rest");
  same(keyValues([]), { pairs: {}, rest: [] }, "empty");
  same(keyValues(undefined), { pairs: {}, rest: [] }, "undefined");
});

check("keyValues throws RuleSyntaxError on a key given twice", () => {
  const error = throws(() => keyValues(["range=15", "RANGE=30"]), /"range" is given twice/, "duplicate key");
  must(error instanceof RuleSyntaxError, "a RuleSyntaxError");
  // A key that happens to be an Object.prototype name is an ordinary key, not a false duplicate.
  same(keyValues(["constructor=1"]).pairs, { constructor: "1" }, "prototype names are ordinary keys");
});

/* -------------------------------------------- */
/*  The engine                                  */
/* -------------------------------------------- */

check("RULE_ITEM_TYPES are talent, action and constellation", () => {
  same([...RULE_ITEM_TYPES].sort(), ["action", "constellation", "talent"], "RULE_ITEM_TYPES");
});

/** A plain actor-like object, as a test may build one: the engine reads nothing but items. */
function fakeActor(items) {
  return { items };
}

const talentA = { type: "talent", name: "Torchbearer Human", system: { rules: [
  { kind: "test-only", line: 1, text: "test-only: a", subject: "a", times: 1 },
  { error: `unknown rule kind "${UNKNOWN_KIND}" (known kinds: bonus)`, line: 2, text: `${UNKNOWN_KIND}: 15 ft allies` }
] } };
const actionB = { type: "action", name: "Seek", system: { rules: [
  { kind: "probe", line: 1, text: "probe: b", subject: "b", times: 2 },
  { kind: UNKNOWN_KIND, line: 2, text: `${UNKNOWN_KIND}: 30 ft` }
] } };
const constellationC = { type: "constellation", name: "Humanity", system: { rules: [
  { kind: "quiet", line: 1, text: "quiet" }
] } };
const weaponD = { type: "weapon", name: "Sword", system: { rules: [{ kind: "test-only", line: 1, text: "test-only: ignored", subject: "ignored", times: 1 }] } };
const talentE = { type: "talent", name: "No rules yet", system: {} };
const talentF = { type: "talent", name: "Odd rules", system: { rules: "not an array" } };
const talentG = { type: "talent", name: "Junk entries", system: { rules: [null, 7, "x", { kind: "test-only", line: 1, text: "test-only: g", subject: "g", times: 1 }] } };

check("collectRules indexes by canonical kind and sorts errors and unknowns", () => {
  const index = collectRules(fakeActor([talentA, actionB, constellationC, weaponD, talentE, talentF, talentG]));
  same(Object.keys(index.byKind).sort(), ["quiet", "test-only"], "kinds in use");
  must(index.all.length === 4, `four usable rules, got ${index.all.length}`);
  same(index.byKind["test-only"].map(e => [e.item.name, e.rule.subject]), [["Torchbearer Human", "a"], ["Seek", "b"], ["Junk entries", "g"]], "test-only, alias resolved to the id");
  same(index.byKind.quiet.map(e => e.item.name), ["Humanity"], "a Constellation Item's rule is collected");
  must(index.byKind["test-only"][0].item === talentA && index.byKind["test-only"][0].rule === talentA.system.rules[0], "entries hold the documents themselves");
  same(index.unknown.map(e => [e.item.name, e.reason]), [
    ["Torchbearer Human", `unknown rule kind "${UNKNOWN_KIND}" (known kinds: bonus)`],
    ["Seek", `unknown rule kind "${UNKNOWN_KIND}"`]
  ], "unknown: an error entry with its reason, and a rule of an unregistered kind");
  must(!index.all.some(e => e.item === weaponD), "a weapon's rules are not collected");
});

check("collectRules over nothing is an empty index", () => {
  same(collectRules(fakeActor([])), { all: [], byKind: {}, unknown: [] }, "no items");
  same(collectRules({}), { all: [], byKind: {}, unknown: [] }, "no items field");
  same(collectRules(null), { all: [], byKind: {}, unknown: [] }, "null");
});

check("collectRules accepts any iterable of Items, as Foundry's Collection is", () => {
  const iterable = { *[Symbol.iterator]() { yield talentA; yield constellationC; } };
  const index = collectRules({ items: iterable });
  must(index.all.length === 2 && index.unknown.length === 1, "collected from a generator");
});

check("rulesOfKind reads a prepared index when there is one and collects otherwise", () => {
  const plain = fakeActor([talentA, actionB]);
  same(rulesOfKind(plain, "test-only").map(e => e.rule.subject), ["a", "b"], "collected on the spot");
  same(rulesOfKind(plain, "probe").map(e => e.rule.subject), ["a", "b"], "by alias");
  same(rulesOfKind(plain, UNKNOWN_KIND), [], "an unregistered kind is an empty array");
  same(rulesOfKind(plain, ""), [], "no kind is an empty array");
  same(rulesOfKind(plain, undefined), [], "undefined is an empty array");

  const prepared = { items: [talentA, actionB], system: { rules: collectRules(fakeActor([constellationC])) } };
  same(rulesOfKind(prepared, "test-only"), [], "the prepared index wins over the items");
  same(rulesOfKind(prepared, "quiet").map(e => e.item.name), ["Humanity"], "and answers from it");
  same(rulesOfKind({ system: { rules: [] } }, "quiet"), [], "an Item-shaped system.rules (an array) is not an index");
  same(rulesOfKind(null, "quiet"), [], "nothing at all is an empty array");
});

/* -------------------------------------------- */
/*  The bonus kind (0.10.0; rulings 121 to 124) */
/* -------------------------------------------- */

/** Parse one bonus line and return the rule, failing on any error. */
function bonusRule(line, context) {
  const { rules, errors } = parseAutomation(line, context);
  must(errors.length === 0, `"${line}" should parse, got: ${errors.map(e => e.message).join("; ")}`);
  must(rules.length === 1, `"${line}" should be one rule, got ${rules.length}`);
  return rules[0];
}

/** Parse one bonus line and return the error message, failing when it parses. */
function bonusError(line, context) {
  const { rules, errors } = parseAutomation(line, context);
  must(rules.length === 0 && errors.length === 1, `"${line}" should be one error, got ${rules.length} rules and ${errors.length} errors`);
  return errors[0].message;
}

/**
 * A resolver as the build and the client give the grammar one: Constellations by name or slug,
 * Maneuvers by plain name, a Lore for the refusal, nothing else.
 */
const KNOWN = {
  human: { type: "constellation", slug: "human", name: "Human" },
  guard: { type: "constellation", slug: "guard", name: "Guard" },
  stealth: { type: "constellation", slug: "stealth", name: "Stealth" },
  "armored-fighting": { type: "constellation", slug: "armored-fighting", name: "Armored Fighting" },
  lore: { type: "constellation", slug: "lore", name: "Lore" },
  aid: { type: "action", slug: "aid", name: "Aid" },
  search: { type: "action", slug: "search", name: "Search" }
};
const resolve = name => KNOWN[slugify(plainName(name))] ?? null;

check("the bonus kind is registered with its modifiers hook and no aliases", () => {
  const kind = kindOf("bonus");
  must(kind && kind.id === "bonus", "kindOf('bonus')");
  same(kind.aliases, [], "no aliases");
  must(typeof kind.hooks.modifiers === "function", "hooks.modifiers is a function");
  must(kindOf("BONUS") === kind, "the word is case blind through the grammar's lookup");
});

/* The operator grammar (0.13.0; AUTOMATION_GRAMMAR.md): the shared operator reader every kind uses. */

check("operators: splitOperands splits on the commas outside parentheses and quotes", () => {
  same(splitOperands("+1, Situation, Guard, FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)"), ["+1", "Situation", "Guard", "FOR(self+allies, 0ft)", "WHILE(allies>=1, 0ft)"], "operator commas stay inside");
  same(splitOperands(" a ,, 'b, c' "), ["a", "'b, c'"], "empties dropped, quotes kept whole");
  throws(() => splitOperands("FOR(allies"), /has no closing \)/, "unclosed paren");
  throws(() => splitOperands("a) b"), /has no \( before it/, "stray close");
});

check("operators: readLine sorts arguments from operators and refuses what a kind does not take", () => {
  const read = readLine("+1, Situation, Guard, against(Blow), FOR(self+allies, 0ft), WHILE(allies >= 1, 0 ft), FIRST(round)", { allow: ["IF", "FOR", "WHILE", "AGAINST", "FIRST", "ONCE"], kind: "bonus" });
  same(read.args, ["+1", "Situation", "Guard"], "the arguments");
  same(read.ops.for, { who: "self+allies", range: 0 }, "FOR");
  same(read.ops.while, { who: "allies", op: ">=", count: 1, range: 0 }, "WHILE, spaces free");
  same(read.ops.against, { threat: "blow", reach: null }, "AGAINST, case blind");
  same(read.ops.limit, { per: "round" }, "FIRST");
  same(readLine("Prone, ONCE(encounter)", { allow: ["ONCE"], kind: "prevent" }).ops.limit, { per: "encounter" }, "ONCE");
  same(readLine("15ft, allies, VISIBLE", { allow: ["VISIBLE"], kind: "aura" }).ops.visible, true, "a bare flag");
  same(readLine("2, Skill, DIFFERENT()", { allow: ["DIFFERENT"], kind: "grant" }).ops.different, true, "a flag with empty parentheses");
  same(readLine("Melee", { allow: ["AGAINST"], kind: "x" }).ops.against ?? null, null, "no operator, nothing set");
  same(readLine("x, AGAINST(Melee)", { allow: ["AGAINST"], kind: "x" }).ops.against, { threat: "blow", reach: "melee" }, "a reach word is a Blow by reach");
  must(readLine("x, IF(Origin>=Expert)", { allow: ["IF"], kind: "x" }).ops.when[0].op === ">=", ">= reads");
  same(readLine("x, IF(Rank=Untrained)", { allow: ["IF"], kind: "x" }).ops.when, [{ roll: true, op: "=", rank: "untrained" }], "Rank is the roll's own");
  must(readLine("x, IF(Human=Trained), IF(Origin<=Expert)", { allow: ["IF"], kind: "x" }).ops.when.length === 2, "two IFs");
  throws(() => readLine("Prone, AGAINST(Blow)", { allow: ["IF"], kind: "prevent" }), /^prevent does not take AGAINST$/, "an operator the kind lacks");
  throws(() => readLine("a, FOR(allies), b", { allow: ["FOR"], kind: "x" }), /comes after an operator/, "an argument after an operator");
  throws(() => readLine("a, FOR(allies), FOR(enemies)", { allow: ["FOR"], kind: "x" }), /FOR is given twice/, "FOR twice");
  throws(() => readLine("a, FIRST(round), ONCE(encounter)", { allow: ["FIRST", "ONCE"], kind: "x" }), /one limit/, "FIRST and ONCE together");
  throws(() => readLine("a, FOR", { allow: ["FOR"], kind: "x" }), /FOR is written `FOR\(<Who>\[, <N>ft\]\)`/, "a bare call operator prints its shape");
  throws(() => readLine("a, FOR(self, 5ft)", { allow: ["FOR"], kind: "x" }), /FOR\(self\) takes no range/, "self with a range");
  throws(() => readLine("a, FOR(friends)", { allow: ["FOR"], kind: "x" }), /a who is written self, allies, enemies, all or self\+allies/, "a bad who");
  throws(() => readLine("a, FOR(allies, near)", { allow: ["FOR"], kind: "x" }), /a range is written <N>ft, as in 15ft/, "a bad range");
  throws(() => readLine("a, WHILE(allies, 0ft)", { allow: ["WHILE"], kind: "x" }), /WHILE is written/, "WHILE without a comparison");
  throws(() => readLine("a, AGAINST(Arrows)", { allow: ["AGAINST"], kind: "x" }), /"Arrows" is not a Threat: write Blow, Blast, Blight, Beguilement, Melee or Ranged/, "a bad Threat");
  throws(() => readLine("a, FIRST(encounter)", { allow: ["FIRST"], kind: "x" }), /FIRST is written `FIRST\(round\)`/, "FIRST's word");
  throws(() => readLine("a, IF(Human is Expert)", { allow: ["IF"], kind: "x" }), /IF is written `IF\(<Constellation>=<Rank>\)`/, "IF without =");
  throws(() => readLine("a, IF(Human=Grand)", { allow: ["IF"], kind: "x" }), /"Grand" is not a rank: write Untrained, Trained, Expert, Master or Legendary/, "a bad rank");
  throws(() => readLine("a, IF(Lore=Expert)", { allow: ["IF"], kind: "x" }), /a Lore is the character's own/, "a Lore in IF");
  throws(() => readLine("a, VISIBLE(yes)", { allow: ["VISIBLE"], kind: "x" }), /VISIBLE takes nothing/, "a flag with contents");
});

check("operators: rankMeets, whoMatches, compare and needsMoment", () => {
  must(rankMeets("expert", "=", "expert") && !rankMeets("master", "=", "expert"), "equality");
  must(rankMeets("master", ">=", "expert") && !rankMeets("trained", ">=", "expert"), ">=");
  must(rankMeets("trained", "<=", "expert") && !rankMeets("master", "<=", "expert"), "<=");
  must(rankMeets("nonsense", "=", "untrained"), "an unknown rank is Untrained");
  must(whoMatches("allies", "ally") && !whoMatches("allies", "enemy") && whoMatches("all", "enemy") && !whoMatches("all", "self") && whoMatches("self+allies", "self") && whoMatches("self+allies", "ally"), "who words");
  must(compare(2, ">=", 1) && compare(1, "=", 1) && !compare(0, ">", 0) && compare(0, "<", 1) && compare(1, "<=", 1), "comparisons");
  must(!needsMoment({ for: { who: "self", range: null } }) && needsMoment({ for: { who: "allies", range: 15 } }) && needsMoment({ while: {} }) && needsMoment({ against: {} }) && needsMoment({ limit: {} }) && !needsMoment({ when: [{}] }), "what needs the moment");
});

check("bonus: every accepted form, without a resolver", () => {
  const full = bonusRule("bonus: +1, Condition, Aid, IF(Human=Trained)");
  same(full, {
    value: 1, type: "condition",
    to: { name: "Aid", slug: "aid", type: null },
    when: [{ constellation: "human", name: "Human", op: "=", rank: "trained" }],
    for: null, while: null, against: null, seen: false, limit: null,
    kind: "bonus", line: 1, text: "bonus: +1, Condition, Aid, IF(Human=Trained)"
  }, "the full form");

  const bare = bonusRule("bonus: 1, condition, aid");
  must(bare.value === 1, "a bare 1 reads as +1");
  must(bare.type === "condition", "the type word is case blind");
  same(bare.to, { name: "aid", slug: "aid", type: null }, "the target as written, slug made, type unknown");
  must(bare.when === null, "no IF is null");

  must(bonusRule("bonus: -2, GEAR, Stealth").value === -2, "a negative value");
  must(bonusRule("bonus: -2, GEAR, Stealth").type === "gear", "GEAR");
  must(bonusRule("bonus: +3, situation, Armored Fighting").type === "situation", "situation");
  same(bonusRule("bonus: +3, Situation, armored-fighting").to, { name: "armored-fighting", slug: "armored-fighting", type: null }, "the slug form of a target");
  same(bonusRule("bonus: +3, Situation, Armored Fighting").to.slug, "armored-fighting", "a two-word name slugs the same");
  same(bonusRule("bonus: +1, Situation, Defenses").to, { name: "Defenses", slug: "defenses", type: "scope" }, "a scope word");
  same(bonusRule("bonus: +1, Situation, checks").to, { name: "Checks", slug: "checks", type: "scope" }, "a scope word, case blind");
  same(bonusRule("bonus: +1, Situation, Attacks").to.slug, "attacks", "Attacks");
  same(bonusRule("bonus: +1, Situation, Initiative").to.slug, "initiative", "Initiative");

  const glyphed = bonusRule("bonus: +1, Condition, Aid ❶ (⓿↺)");
  must(glyphed.to.slug === "aid", `a Maneuver's glyphs never reach the slug, got "${glyphed.to.slug}"`);

  const mixed = bonusRule("Bonus: +1,CONDITION,Aid,if(Human=Expert).");
  same(mixed.when, [{ constellation: "human", name: "Human", op: "=", rank: "expert" }], "spaces free, operator case blind, a trailing period tolerated");
  must(mixed.kind === "bonus", "the kind word is case blind");

  for (const rank of ["Untrained", "Trained", "Expert", "Master", "Legendary", "legendary"]) {
    must(bonusRule(`bonus: +1, Condition, Aid, IF(Human=${rank})`).when[0].rank === rank.toLowerCase(), `rank ${rank}`);
  }
  must(bonusRule("bonus +1, Condition, Aid").value === 1, "the colon is optional, as the grammar says");

  const closeRanks = bonusRule("bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)");
  same([closeRanks.for, closeRanks.while, closeRanks.against], [{ who: "self+allies", range: 0 }, { who: "allies", op: ">=", count: 1, range: 0 }, { threat: "blow", reach: null }], "Close Ranks' operators");
  const torch = bonusRule("bonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)");
  same([torch.for, torch.seen, torch.when, torch.limit], [{ who: "allies", range: 15 }, true, [{ trait: "fear", name: "Fear" }], { per: "round" }], "Torchbearer's operators (the Rally Aura, 0.14.0)");
  same(bonusRule("bonus: +1, Situation, Checks, IF(Rank=Untrained)").when, [{ roll: true, op: "=", rank: "untrained" }], "Jack of All Trades' condition");
  must(bonusRule("bonus: +1, Situation, Guard").seen === false, "no SEEN is false");
});

check("operators: SEEN and IF(Trait=...) (0.14.0)", () => {
  same(readLine("x, seen", { allow: ["SEEN"], kind: "x" }).ops.seen, true, "SEEN, case blind");
  same(readLine("x, SEEN()", { allow: ["SEEN"], kind: "x" }).ops.seen, true, "SEEN with empty parentheses");
  throws(() => readLine("x, SEEN(allies)", { allow: ["SEEN"], kind: "x" }), /SEEN takes nothing in parentheses/, "SEEN with contents");
  throws(() => readLine("x, SEEN", { allow: ["FOR"], kind: "aura" }), /^aura does not take SEEN$/, "a kind without SEEN");
  same(readLine("x, IF(Trait=Fear)", { allow: ["IF"], kind: "x" }).ops.when, [{ trait: "fear", name: "Fear" }], "a trait condition");
  same(readLine("x, IF(trait = Thrown 20 ft)", { allow: ["IF"], kind: "x" }).ops.when, [{ trait: "thrown", name: "Thrown 20 ft" }], "the key is the first word");
  throws(() => readLine("x, IF(Trait>=Fear)", { allow: ["IF"], kind: "x" }), /IF\(Trait=<Trait>\) names the trait with = only/, "a trait with >=");
  throws(() => readLine("x, IF(Trait=)", { allow: ["IF"], kind: "x" }), /IF is written/, "an empty trait");
  must(hasTrait(["Finesse", "Thrown 20 ft"], "thrown") && !hasTrait(["Finesse"], "fear") && !hasTrait(null, "fear") && !hasTrait(["Fear"], ""), "hasTrait by first word");
  must(traitKey("Thrown 20 ft") === "thrown" && traitKey(" Fear ") === "fear" && traitKey("Deadly d8") === "deadly" && traitKey("Unwieldy [2]") === "unwieldy", "traitKey");
  must(needsMoment({ seen: true }) && needsMoment({ when: [{ trait: "fear" }] }) && !needsMoment({ when: [{ constellation: "human", rank: "expert" }] }), "SEEN and a trait condition need the moment");
  // The rule as the parser stores it reads back in the summary.
  must(summarize(bonusRule("bonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)"))
    === "+1 Situation bonus to Defenses, against an attack with the Fear trait, for allies within 15 ft who can see you, the first time each round", "the Rally Aura's summary");
  must(summarize(bonusRule("bonus: +1, Situation, Guard, SEEN")) === "+1 Situation bonus to Guard, who can see you", "SEEN alone");
});

check("bonus: Humanity's four lines parse to four rules, one rank each", () => {
  const cell = [
    "bonus: +1, Condition, Aid, IF(Human=Trained)",
    "bonus: +2, Condition, Aid, IF(Human=Expert)",
    "bonus: +3, Condition, Aid, IF(Human=Master)",
    "bonus: +4, Condition, Aid, IF(Human=Legendary)"
  ].join("\n");
  const { rules, errors } = parseAutomation(cell, { resolve, itemName: "Humanity", constellation: "Human", itemType: "talent" });
  same(errors, [], "errors");
  same(rules.map(r => [r.value, r.when[0].rank, r.to.type, r.line]), [[1, "trained", "action", 1], [2, "expert", "action", 2], [3, "master", "action", 3], [4, "legendary", "action", 4]], "the rules");
});

check("bonus: with a resolver the target and the condition carry the resolved type, slug and name", () => {
  const rule = bonusRule("bonus: +1, Condition, aid ❶, IF(human=Expert)", { resolve });
  same(rule.to, { name: "Aid", slug: "aid", type: "action" }, "a Maneuver target");
  same(rule.when, [{ constellation: "human", name: "Human", op: "=", rank: "expert" }], "the condition's Constellation");
  same(bonusRule("bonus: +2, Situation, STEALTH", { resolve }).to, { name: "Stealth", slug: "stealth", type: "constellation" }, "a Constellation target");
  same(bonusRule("bonus: +1, Gear, armored-fighting", { resolve }).to, { name: "Armored Fighting", slug: "armored-fighting", type: "constellation" }, "a Constellation by slug");
});

check("bonus: the refusals, each with a message the designer can act on", () => {
  must(/a bonus of 0 does nothing/.test(bonusError("bonus: 0, Condition, Aid")), "zero");
  must(/a bonus of 0 does nothing/.test(bonusError("bonus: +0, Condition, Aid")), "plus zero");
  must(/write Condition, not status: the book renamed the types in v3\.3/.test(bonusError("bonus: +1, status, Aid")), "status");
  must(/write Situation, not circumstance/.test(bonusError("bonus: +1, Circumstance, Aid")), "circumstance");
  must(/write Gear, not item/.test(bonusError("bonus: +1, item, Aid")), "item");
  must(/no Talent bonus is untyped; name Situation, Condition or Gear/.test(bonusError("bonus: +1, untyped, Aid")), "untyped");
  must(/"Fancy" is not a bonus type: write Situation, Condition or Gear/.test(bonusError("bonus: +1, Fancy, Aid")), "an unknown type word");
  const shape = bonusError("bonus: +1, Condition");
  must(/<±N>, <Type>, <Target>/.test(shape) && /2 arguments given, 3 wanted/.test(shape), `two arguments print the shape: "${shape}"`);
  must(/<±N>, <Type>, <Target>/.test(bonusError("bonus:")), "an empty line prints the shape");
  must(/4 arguments given/.test(bonusError("bonus: +1, Condition, Aid, extra")), "a fourth argument");
  must(/a bonus is a whole number such as \+1 or -2, not "one"/.test(bonusError("bonus: one, Condition, Aid")), "a non-number");
  must(/the 0\.10\.0 form .* is retired; write `bonus: \+1, Condition, Aid, IF\(Origin=Trained\)`/.test(bonusError("bonus: +1 Condition to Aid if Human is Expert")), "the prose form is refused with the new shape");
  must(/"Grand" is not a rank/.test(bonusError("bonus: +1, Condition, Aid, IF(Human=Grand)")), "a bad rank word");
  must(/^bonus does not take VISIBLE$/.test(bonusError("bonus: +1, Condition, Aid, VISIBLE")), "an operator bonus lacks");
  must(/^bonus does not take DIFFERENT$/.test(bonusError("bonus: +1, Condition, Aid, DIFFERENT")), "DIFFERENT too");
});

check("bonus: the refusals a resolver makes possible", () => {
  must(bonusError("bonus: +1, Condition, Aidd", { resolve }) === '"Aidd" names no Constellation or Maneuver', "an unknown target");
  must(bonusError("bonus: +1, Condition, Guard, IF(Aid=Expert)", { resolve }) === '"Aid" is not a Constellation', "a Maneuver in the condition");
  must(bonusError("bonus: +1, Condition, Guard, IF(Nobody=Expert)", { resolve }) === '"Nobody" is not a Constellation', "nothing in the condition");
  must(bonusError("bonus: +1, Condition, Lore", { resolve }) === "a Lore is the character's own; a bonus cannot name it", "the Lore template");
  must(bonusError("bonus: +1, Condition, Lore") === "a Lore is the character's own; a bonus cannot name it", "the Lore template, without a resolver");
  must(bonusError("bonus: +1, Condition, Lore (Serrovane)") === "a Lore is the character's own; a bonus cannot name it", "a Lore instance");
});

check("bonus: the summary", () => {
  must(summarize(bonusRule("bonus: +1, Condition, Aid, IF(Human=Expert)", { resolve })) === "+1 Condition bonus to Aid, while Human is Expert", "the full form");
  must(summarize(bonusRule("bonus: -2, condition, Stealth")) === "-2 Condition penalty to Stealth", "a penalty, no operators");
  must(summarize(bonusRule("bonus: 3, gear, Guard", { resolve })) === "+3 Gear bonus to Guard", "a bare value prints signed");
  must(summarize(bonusRule("bonus: +1, Situation, Checks, IF(Rank=Untrained)")) === "+1 Situation bonus to Checks, while the roll's rank is Untrained", "the roll's rank");
  must(summarize(bonusRule("bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)")) === "+1 Situation bonus to Defenses, for allies within 15 ft, the first time each round", "FOR and FIRST");
  must(summarize(bonusRule("bonus: +1, Situation, Guard, AGAINST(Melee), IF(Origin>=Expert)")) === "+1 Situation bonus to Guard, while Origin is at least Expert, against a melee Blow", ">= and a reach");
});

/* The hook, through the dispatcher. */

/** An actor-like object with a rule index and the ranks a test names; no `proficiency` when ranks is null. */
function rulesActor(items, ranks = {}) {
  const actor = { items, system: {} };
  if (ranks !== null) actor.system.proficiency = slug => ({ rank: ranks[slug] ?? "untrained" });
  actor.system.rules = collectRules(actor);
  return actor;
}

/** A Talent carrying the rules its Automation cell parses to, with the resolver. */
function talentWith(name, cell, context = { resolve }) {
  const parsed = parseAutomation(cell, { ...context, itemName: name, itemType: "talent" });
  must(parsed.errors.length === 0, `${name}'s cell should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
  return { type: "talent", name, system: { rules: parsed.rules } };
}

const humanity = talentWith("Humanity", [
  "bonus: +1, Condition, Aid, IF(Human=Trained)",
  "bonus: +2, Condition, Aid, IF(Human=Expert)",
  "bonus: +3, Condition, Aid, IF(Human=Master)",
  "bonus: +4, Condition, Aid, IF(Human=Legendary)"
].join("\n"));
const sneaky = talentWith("Sneaky ❶", "bonus: +2, Situation, Stealth");
const braced = talentWith("Braced", "bonus: +1, Gear, Guard, IF(Human=Expert)");
const aidItem = { type: "action", name: "Aid ❶ (⓿↺)", id: "aid0001" };
const searchItem = { type: "action", name: "Search ❶", id: "srch0001" };

check("ruleModifiers: a Constellation target applies on its slug and nowhere else", () => {
  const actor = rulesActor([sneaky, humanity]);
  const onStealth = ruleModifiers(actor, { kind: "check", slug: "stealth", item: null });
  same(onStealth.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶:stealth" }], "applied on Stealth, the label the carrier's plain name");
  const onAthletics = ruleModifiers(actor, { kind: "check", slug: "athletics", item: null });
  must(!onAthletics.applied.some(m => m.label === "Sneaky"), "absent on Athletics");
  const asInitiative = ruleModifiers(actor, { kind: "initiative", slug: "stealth", item: null });
  same(asInitiative.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶:stealth" }], "an Initiative rolled with Stealth is a Stealth check (ruling 111)");
});

check("ruleModifiers: the rank condition is equality, read from the actor's proficiency", () => {
  const roll = { kind: "check", slug: "diplomacy", item: aidItem };
  same(ruleModifiers(rulesActor([humanity], { human: "untrained" }), roll).applied, [], "Untrained: none of the four");
  same(ruleModifiers(rulesActor([humanity], { human: "trained" }), roll).applied, [{ label: "Humanity", value: 1, type: "condition", source: "rule:Humanity:aid" }], "Trained: the +1 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "expert" }), roll).applied, [{ label: "Humanity", value: 2, type: "condition", source: "rule:Humanity:aid" }], "Expert: the +2 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "legendary" }), roll).applied, [{ label: "Humanity", value: 4, type: "condition", source: "rule:Humanity:aid" }], "Legendary: the +4 alone");
  same(ruleModifiers(rulesActor([humanity], {}), roll).applied, [], "a Constellation the actor has no entry for reads as Untrained");
});

check("ruleModifiers: a conditioned rule never fires for an actor without proficiency; an unconditioned one does", () => {
  const actor = rulesActor([humanity, sneaky], null);
  must(!("proficiency" in actor.system), "the fake adversary has no proficiency");
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: aidItem }).applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶:stealth" }], "only the unconditioned rule");
});

check("ruleModifiers: a Maneuver target applies when the roll carries that Maneuver, glyphs ignored", () => {
  const actor = rulesActor([humanity], { human: "trained" });
  const withAid = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: aidItem });
  same(withAid.applied, [{ label: "Humanity", value: 1, type: "condition", source: "rule:Humanity:aid" }], "applied from the Aid Item");
  same(withAid.offered, [], "and not offered as well");
  const withSearch = ruleModifiers(actor, { kind: "check", slug: "awareness", item: searchItem });
  same(withSearch.applied, [], "a Search is not an Aid");
  same(withSearch.offered, [], "and is not asked whether it is one");
  const withWeapon = ruleModifiers(actor, { kind: "check", slug: "melee", item: { type: "weapon", name: "Aid" } });
  must(withWeapon.applied.length === 0, "a weapon named Aid is not the Maneuver");
});

check("ruleModifiers: a Maneuver target is offered unticked on a check made without one, with a stable key", () => {
  const actor = rulesActor([humanity], { human: "expert" });
  const first = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null });
  same(first.applied, [], "nothing applied");
  must(first.offered.length === 1, `one offer, got ${first.offered.length}`);
  const [offer] = first.offered;
  same(offer, {
    label: "Humanity: Aid", value: 2, type: "condition", source: "rule:Humanity:aid", offer: true,
    key: "bonus-Humanity-2",
    hint: "Humanity: this bonus applies to checks to Aid. Tick it if this roll is one."
  }, "the offer");
  const second = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null });
  must(second.offered[0].key === offer.key, "the key is the same on the next roll");
  const withId = rulesActor([{ ...humanity, id: "hum00001" }], { human: "expert" });
  must(ruleModifiers(withId, { kind: "check", slug: "diplomacy", item: null }).offered[0].key === "bonus-hum00001-2", "an Item with an id keys on it");
  const asTalentRoll = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: { type: "talent", name: "Some Talent" } });
  must(asTalentRoll.offered.length === 1, "a check made from a Talent carries no Maneuver and is offered");
});

check("ruleModifiers: never offered on an attack, a Defense or an Initiative", () => {
  const actor = rulesActor([humanity], { human: "trained" });
  for (const kind of ["attack", "defense", "initiative"]) {
    const result = ruleModifiers(actor, { kind, slug: kind === "attack" ? "melee" : "evade", item: null });
    same(result.offered, [], `no offer on ${kind}`);
    same(result.applied, [], `nothing applied on ${kind}`);
  }
});

check("ruleModifiers: a Defense is a Constellation target, so the Defense pass can fold it in", () => {
  const roll = { kind: "defense", slug: "guard", item: null };
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), roll).applied, [{ label: "Braced", value: 1, type: "gear", source: "rule:Braced:guard" }], "Guard at Expert");
  same(ruleModifiers(rulesActor([braced], { human: "trained" }), roll).applied, [], "not at Trained");
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), { kind: "defense", slug: "evade", item: null }).applied, [], "not on Evade");
});

check("ruleModifiers: no rules, no kinds with the hook, or nothing at all is three empty lists", () => {
  same(ruleModifiers(rulesActor([]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "no rules");
  same(ruleModifiers(rulesActor([talentA]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "a kind without the hook is skipped");
  same(ruleModifiers(null, { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "null actor");
  same(ruleModifiers({ items: [sneaky] }, { kind: "check", slug: "stealth", item: null }).applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶:stealth" }], "an actor with no prepared index is collected on the spot");
});

check("ruleModifiers: a hook that throws contributes nothing and does not throw", () => {
  const explosive = {
    id: "explosive", parse: () => ({}), summary: () => "explosive",
    hooks: { modifiers() { throw new Error("kaboom"); } }
  };
  registerKind(explosive);
  const carrier = { type: "talent", name: "Volatile", system: { rules: [{ kind: "explosive", line: 1, text: "explosive" }] } };
  const actor = rulesActor([carrier, sneaky]);
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  let result;
  try {
    result = ruleModifiers(actor, { kind: "check", slug: "stealth", item: null });
  } finally {
    console.error = original;
  }
  same(result.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶:stealth" }], "the other kind's modifiers still arrive");
  must(errors.length === 1 && /the "explosive" kind's modifiers hook failed/.test(String(errors[0][0])), `the failure is reported once: ${JSON.stringify(errors.map(e => String(e[0])))}`);
});

check("ruleModifiers: zero, non-numeric and malformed modifiers are dropped; a keyless offer gets a key", () => {
  const sloppy = {
    id: "sloppy", parse: () => ({}), summary: () => "sloppy",
    hooks: {
      modifiers: () => [
        { label: "zero", value: 0 },
        { label: "words", value: "many" },
        { label: "blank", value: "" },
        null, "x", { label: "no value" },
        { label: "ok", value: 1, type: "situation" },
        { label: "as text", value: "-2", type: "condition" },
        { label: "offer one", value: 1, offer: true },
        { label: "offer two", value: 1, offer: true },
        { label: "offer three", value: 1, offer: true, key: "sloppy-0" },
        { label: "not an offer", value: 1, offer: "yes" }
      ]
    }
  };
  registerKind(sloppy);
  const carrier = { type: "talent", name: "Loose", system: { rules: [{ kind: "sloppy", line: 1, text: "sloppy" }] } };
  const { applied, offered } = ruleModifiers(rulesActor([carrier]), { kind: "check", slug: "stealth", item: null });
  same(applied, [
    { label: "ok", value: 1, type: "situation" },
    { label: "as text", value: -2, type: "condition" },
    { label: "not an offer", value: 1 }
  ], "applied: the numeric non-zero ones, a numeric string read as a number, `offer` only when exactly true (and dropped otherwise)");
  same(offered.map(o => [o.label, o.key, o.hint]), [
    ["offer one", "sloppy-0", ""],
    ["offer two", "sloppy-1", ""],
    ["offer three", "sloppy-0-2", ""]
  ], "offered: keys defaulted per kind and a shared key suffixed");
  must(offered.every(o => o.offer === true), "every offer is marked");
});

/* -------------------------------------------- */
/*  The grant kind (0.13.0)                     */
/* -------------------------------------------- */

check("grant: the forms, the field the wizard reads, the summary", () => {
  const driven = bonusRule("grant: 1, Calling");
  same(driven, { n: 1, scope: "Calling", different: false, when: null, kind: "grant", line: 1, text: "grant: 1, Calling" }, "Driven");
  same(toGrantField(driven), { n: 1, mode: "any", scope: "Calling" }, "the wizard's field");
  same(toGrantField(bonusRule("grant: 1, Opening")), { n: 1, mode: "open", scope: "anywhere" }, "Opening is a Root anywhere");
  same(toGrantField(bonusRule("grant: 1, Comet")), { n: 1, mode: "any", scope: "anywhere" }, "a Comet goes anywhere");
  same(toGrantField(bonusRule("grant: 2, Skills, DIFFERENT")), { n: 2, mode: "different", scope: "Skill" }, "DIFFERENT, and a plural reads");
  same(bonusRule("grant: 1, combat style").scope, "Combat Style", "a two-word scope, case blind");
  same(bonusRule("grant: 1, Skill, IF(Origin=Expert)").when, [{ constellation: "origin", name: "Origin", op: "=", rank: "expert" }], "IF is stored");
  must(summarize(bonusRule("grant: 1, Calling")) === "1 Calling Talent Point", "the summary");
  must(summarize(bonusRule("grant: 2, Skill, DIFFERENT")) === "2 Skill Talent Points, each in a different Constellation", "the plural and DIFFERENT");
  must(kindOf("grant").hooks && Object.keys(kindOf("grant").hooks).length === 0, "no hook: the wizard consumes it");
});

check("grant: the refusals", () => {
  must(/2 wanted/.test(bonusError("grant: 1")), "one argument");
  must(/a grant is a whole number of points, 1 or more, not "0"/.test(bonusError("grant: 0, Skill")), "zero");
  must(/not "one"/.test(bonusError("grant: one, Skill")), "a word");
  must(/"Weapon" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet/.test(bonusError("grant: 1, Weapon")), "a bad scope");
  must(/DIFFERENT needs 2 or more points/.test(bonusError("grant: 1, Skill, DIFFERENT")), "DIFFERENT on one point");
  must(/^grant does not take FOR$/.test(bonusError("grant: 1, Skill, FOR(allies)")), "an operator it lacks");
});

/* -------------------------------------------- */
/*  The aura kind (0.13.0)                      */
/* -------------------------------------------- */

check("aura: the forms, the field the canvas reads, the summary", () => {
  const torch = bonusRule("aura: 15ft, allies, VISIBLE");
  same(torch, { range: 15, affects: "allies", visible: true, kind: "aura", line: 1, text: "aura: 15ft, allies, VISIBLE" }, "Torchbearer");
  same(toAuraField(torch), { range: 15, affects: "allies", visible: true }, "system.aura");
  same(toAuraField(bonusRule("aura: 30 feet, ALL")), { range: 30, affects: "all", visible: false }, "feet spelled out, case blind, not pinned");
  same(bonusRule("aura: 6 ft, enemies").affects, "enemies", "enemies");
  must(summarize(torch) === "a 15 ft ring about allies, pinned by default", "the summary");
  must(summarize(bonusRule("aura: 30ft, all")) === "a 30 ft ring about all", "unpinned");
  must(Object.keys(kindOf("aura").hooks).length === 0, "no hook: the ring is a drawing");
});

check("aura: the refusals", () => {
  must(/2 wanted/.test(bonusError("aura: 15ft")), "one argument");
  must(/a range is written <N>ft, as in 15ft/.test(bonusError("aura: far, allies")), "a bad range");
  must(/1 ft or more/.test(bonusError("aura: 0ft, allies")), "zero feet");
  must(/a ring is about allies, enemies or all, not "friends"/.test(bonusError("aura: 15ft, friends")), "a bad who");
  must(/^aura does not take FOR$/.test(bonusError("aura: 15ft, allies, FOR(allies)")), "an operator it lacks");
  must(/^aura does not take IF$/.test(bonusError("aura: 15ft, allies, IF(Origin=Expert)")), "IF too");
});

/* -------------------------------------------- */
/*  The prevent kind (0.13.0)                   */
/* -------------------------------------------- */

check("prevent: the forms and the summary", () => {
  const stubborn = bonusRule("prevent: Prone, ONCE(encounter)");
  same(stubborn, { effect: "prone", when: null, for: null, while: null, against: null, seen: false, limit: { per: "encounter" }, kind: "prevent", line: 1, text: "prevent: Prone, ONCE(encounter)" }, "Stubborn Footing");
  const steady = bonusRule("prevent: Expose, FOR(allies, 0ft)");
  same([steady.effect, steady.for], ["expose", { who: "allies", range: 0 }], "Steady the Line");
  same(bonusRule("prevent: off-guard").effect, "offGuard", "a two-word Condition, hyphen and case blind");
  same(bonusRule("prevent: OffGuard").effect, "offGuard", "by its id");
  same(bonusRule("prevent: Exposed").effect, "expose", "Exposed reads as Expose");
  same(bonusRule("prevent: Frightened, IF(Origin>=Expert), AGAINST(Beguilement)").against, { threat: "beguilement", reach: null }, "AGAINST");
  must(summarize(stubborn) === "Prone does not land, once each encounter", "the summary");
  must(summarize(steady) === "Expose does not land, for allies within 0 ft", "FOR in the summary");
  must(typeof kindOf("prevent").hooks.prevent === "function", "the prevent hook");
});

check("prevent: the refusals", () => {
  must(/"Sleepy" is not a Condition or Expose/.test(bonusError("prevent: Sleepy")), "a word that is no Condition");
  must(/1 wanted/.test(bonusError("prevent: Prone, Grabbed")), "two arguments");
  must(/a prevent is written/.test(bonusError("prevent:")), "nothing");
  must(/"Exposed Head" is not a Condition or Expose/.test(bonusError("prevent: Exposed Head")), "a Zone's mirror status is not an effect");
  must(/^prevent does not take VISIBLE$/.test(bonusError("prevent: Prone, VISIBLE")), "an operator it lacks");
});

check("rulePreventers: Stubborn Footing stops Prone once an encounter on its owner, and nothing else", () => {
  const stubborn = talentWith("Stubborn Footing", "prevent: Prone, ONCE(encounter)");
  const tess = rulesActor([stubborn]);
  const encounter = { combat: "c1", round: 1 };
  const first = rulePreventers(tess, { effect: "prone", encounter });
  same(first.map(p => [p.item.name, p.reaction, p.mark]), [["Stubborn Footing", false, { key: "Stubborn Footing:1", per: "encounter" }]], "the first time");
  tess.flags = { starwrought: { rules: { encounter: { "Stubborn Footing:1": { combat: "c1" } } } } };
  same(rulePreventers(tess, { effect: "prone", encounter }), [], "spent for the encounter");
  same(rulePreventers(tess, { effect: "prone", encounter: { combat: "c2", round: 1 } }).length, 1, "the next encounter");
  same(rulePreventers(tess, { effect: "grabbed", encounter }), [], "not Grabbed");
  const other = rulesActor([]);
  same(rulePreventers(other, { effect: "prone", encounter, scene: fakeScene("o", [{ id: "t", x: 0, d: 1, actor: tess }, { id: "o", x: 1, d: 1, actor: other }]) }), [], "nobody else's Prone: no FOR");
  same(rulePreventers(tess, { effect: "prone", encounter: { combat: null, round: 0 } }).map(p => p.mark), [null], "outside an encounter, every time and no mark");
});

check("rulePreventers: Steady the Line is an adjacent ally's Reaction against an Expose, never the owner's own", () => {
  const steady = { ...talentWith("Steady the Line ❶↺", "prevent: Expose, FOR(allies, 0ft)"), id: "stl00001" };
  steady.system.reaction = true;
  const wren = rulesActor([steady]);
  wren.name = "Wren";
  const tess = rulesActor([]);
  const bandit = rulesActor([]);
  const place = (wrenX) => [{ id: "t", x: 0, d: 1, actor: tess }, { id: "w", x: wrenX, d: 1, actor: wren }, { id: "b", x: 1, d: -1, actor: bandit }];
  const near = rulePreventers(tess, { effect: "expose", scene: fakeScene("t", place(1)) });
  same(near.map(p => [p.item.id, p.owner.name, p.reaction, p.mark]), [["stl00001", "Wren", true, null]], "adjacent: offered as Wren's Reaction");
  same(rulePreventers(tess, { effect: "expose", scene: fakeScene("t", place(4)) }), [], "three squares off: out of 0 ft");
  same(rulePreventers(bandit, { effect: "expose", scene: fakeScene("b", place(1)) }), [], "an enemy adjacent to Wren gets nothing");
  same(rulePreventers(wren, { effect: "expose", scene: fakeScene("w", place(1)) }), [], "not Wren's own Expose: allies only");
  same(rulePreventers(tess, { effect: "expose" }), [], "no scene: a positional rule cannot be read");
  same(rulePreventers(tess, { effect: "prone", scene: fakeScene("t", place(1)) }), [], "Expose, not Prone");
});

/* -------------------------------------------- */
/*  Stacking (PHB v4.21; 0.11.0)                */
/* -------------------------------------------- */

/*
 * SW.resolveModifiers is what every caller sums a kind's answers with, so the contract the kinds
 * write to is checked here: everything adds, and entries sharing a `source` are one circumstance,
 * counted once each way (the strongest bonus and the strongest penalty among them).
 */

check("resolveModifiers: every bonus and penalty adds, whatever its type (PHB v4.21)", () => {
  const { total, applied, suppressed } = resolveModifiers([
    { label: "Frightened", value: -1, type: "condition" },
    { label: "Fatigued", value: -1, type: "condition" },
    { label: "Parry weapon", value: 1, type: "gear" },
    { label: "Raised shield", value: 2, type: "gear" },
    { label: "Support", value: 2, type: "situation" },
    { label: "adjustment", value: 1 }
  ]);
  must(total === 4, `−1 −1 +1 +2 +2 +1 is 4, got ${total}`);
  must(applied.length === 6 && suppressed.length === 0, "all six count and nothing is set aside");
});

check("resolveModifiers: entries sharing a source are one circumstance, the strongest each way", () => {
  const { total, applied, suppressed } = resolveModifiers([
    { label: "Off-Guard", value: -2, type: "situation", source: "off-guard" },
    { label: "Wounded Torso", value: -2, type: "situation", source: "off-guard" },
    { label: "line +1", value: 1, type: "condition", source: "rule:Humanity:aid" },
    { label: "line +3", value: 3, type: "condition", source: "rule:Humanity:aid" },
    { label: "line −1", value: -1, type: "condition", source: "rule:Humanity:aid" },
    { label: "another Talent", value: 1, type: "condition", source: "rule:Other:aid" }
  ]);
  must(total === 1, `−2 +3 −1 +1 is 1, got ${total}`);
  same(applied.map(m => m.label).sort(), ["Off-Guard", "another Talent", "line +3", "line −1"], "what counts");
  same(suppressed.map(m => m.label).sort(), ["Wounded Torso", "line +1"], "what a shared source set aside");
});

check("resolveModifiers: disabled, zero and non-numeric entries are dropped; the legacy type names still read", () => {
  const { total, applied } = resolveModifiers([
    { label: "off", value: 5, enabled: false },
    { label: "zero", value: 0 },
    { label: "words", value: "two" },
    null,
    { label: "old name", value: 1, type: "circumstance" }
  ]);
  must(total === 1 && applied.length === 1, `one survives, got total ${total} of ${applied.length}`);
  same(resolveModifiers([]), { total: 0, applied: [], suppressed: [] }, "nothing in, nothing out");
});

check("bonus: `IF(Origin=<Rank>)` reads the shared Origin rank, and a group is refused naming its parent (PHB v4.21)", () => {
  const resolver = name => {
    const lower = String(name).trim().toLowerCase();
    if (lower === "origin") return { type: "constellation", slug: "origin", name: "Origin", group: false, parent: "" };
    if (lower === "archery") return { type: "constellation", slug: "archery", name: "Archery", group: true, parent: "Ranged" };
    if (lower === "ranged") return { type: "constellation", slug: "ranged", name: "Ranged", group: false, parent: "" };
    if (lower === "aid") return { type: "action", slug: "aid", name: "Aid" };
    if (lower === "guard") return { type: "constellation", slug: "guard", name: "Guard", group: false, parent: "" };
    return null;
  };
  const rule = bonusRule("bonus: +2, Condition, Aid, IF(Origin=Expert)", { resolve: resolver });
  same(rule.when, [{ constellation: "origin", name: "Origin", op: "=", rank: "expert" }], "the Origin condition");
  throws(() => bonusRule("bonus: +1, Situation, Aid, IF(Archery=Expert)", { resolve: resolver }), /is a group and has no rank of its own; test Ranged instead/, "a group is refused");
  must(bonusRule("bonus: +1, Situation, Archery", { resolve: resolver }).to.slug === "archery", "a group is still a fine target for a bonus");
  // The hook reads the rank through `proficiency("origin")`, which the character model answers
  // from the virtual Origin; the fake actor answers it like any slug.
  const humanityOrigin = talentWith("Humanity", "bonus: +2, Condition, Aid, IF(Origin=Expert)", { resolve: resolver });
  const roll = { kind: "check", slug: "diplomacy", item: aidItem };
  same(ruleModifiers(rulesActor([humanityOrigin], { origin: "expert" }), roll).applied.map(m => m.value), [2], "fires at Origin Expert");
  same(ruleModifiers(rulesActor([humanityOrigin], { origin: "trained", human: "expert" }), roll).applied, [], "and not from the Human sky's own rank");
  const atLeast = talentWith("Steady", "bonus: +1, Situation, Guard, IF(Origin>=Expert)", { resolve: resolver });
  const guard = { kind: "defense", slug: "guard", item: null };
  same(ruleModifiers(rulesActor([atLeast], { origin: "legendary" }), guard).applied.map(m => m.value), [1], ">= fires above the rank");
  same(ruleModifiers(rulesActor([atLeast], { origin: "trained" }), guard).applied, [], "and not below it");
});

check("bonus hook: one Talent's lines on one target share a source, two Talents do not", () => {
  const twice = talentWith("Twice", "bonus: +1, Condition, Aid\nbonus: +3, Condition, Aid");
  const other = talentWith("Other", "bonus: +1, Condition, Aid");
  const { applied } = ruleModifiers(rulesActor([twice, other]), { kind: "check", slug: "diplomacy", item: aidItem });
  same(applied.map(m => m.source), ["rule:Twice:aid", "rule:Twice:aid", "rule:Other:aid"], "the sources");
  must(resolveModifiers(applied).total === 4, "+3 (the higher of Twice's) +1 (Other's) is 4");
});

check("bonus hook: a 0.10.0 rule stored on an owned copy (when as one object) still reads", () => {
  const old = { type: "talent", name: "Humanity", system: { rules: [{ kind: "bonus", line: 1, text: "old", value: 1, type: "condition", to: { name: "Aid", slug: "aid", type: "action" }, when: { constellation: "human", name: "Human", rank: "trained" } }] } };
  same(ruleModifiers(rulesActor([old], { human: "trained" }), { kind: "check", slug: "diplomacy", item: aidItem }).applied.map(m => m.value), [1], "equality assumed");
});

/* The operators in play (0.13.0): scope targets, the roll's rank, the scene, the Threat, the marks. */

const jack = talentWith("Jack of Trades", "bonus: +1, Situation, Checks, IF(Rank=Untrained)");
const closeRanks = talentWith("Close Ranks", "bonus: +1, Situation, Guard, AGAINST(Blow), FOR(self+allies, 0ft), WHILE(allies>=1, 0ft)", { resolve });
const torchbearer = talentWith("Torchbearer Human", "bonus: +1, Situation, Defenses, FOR(allies, 15ft), FIRST(round)");
const allDefenses = talentWith("Stout", "bonus: +1, Gear, Defenses");

check("bonus hook: a scope target applies by the roll's kind, and IF(Rank=...) reads the roll's own rank", () => {
  const actor = rulesActor([jack, allDefenses]);
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: null, rank: "untrained" }).applied.map(m => m.label), ["Jack of Trades"], "an Untrained check");
  same(ruleModifiers(actor, { kind: "initiative", slug: "stealth", item: null, rank: "untrained" }).applied.map(m => m.label), ["Jack of Trades"], "Checks includes an Initiative rolled as a check");
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: null, rank: "trained" }).applied, [], "not a Trained check");
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: null }).applied, [], "no rank known, no answer");
  same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, rank: "untrained" }).applied, [], "Checks is not Attacks");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, rank: "untrained" }).applied.map(m => m.label), ["Stout"], "Defenses on a Defense");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, staticOnly: true }).applied.map(m => m.label), ["Stout"], "a plain Defenses bonus is static: the sheet folds it");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, momentOnly: true }).applied, [], "and the roll does not count it again");
});

/** A fake scene: tokens by id with a disposition and a position on a one-foot line, so the gap is the distance less one. */
function fakeScene(selfId, tokens, { blind = [] } = {}) {
  const byId = Object.fromEntries(tokens.map(t => [t.id, t]));
  const gap = (a, b) => Math.max(0, Math.abs(byId[a.id].x - byId[b.id].x) - 1);
  const relation = (a, b) => (a.id === b.id) ? "self" : (byId[a.id].d === byId[b.id].d) ? "ally" : "enemy";
  // Sight (0.14.0): a token sees itself; `blind` names the tokens that see nobody; a token marked
  // `unseen` is seen by nobody; the rest see each other.
  const sees = (a, b) => (a.id === b.id) || (!blind.includes(a.id) && !byId[b.id].unseen);
  return { token: byId[selfId], tokens: tokens.map(t => ({ actor: t.actor, token: t })), relation, gap, sees };
}

check("bonus hook: FOR(self+allies) with WHILE(allies>=1, 0ft) and AGAINST(Blow): Close Ranks on both tokens", () => {
  const tess = rulesActor([closeRanks]);
  tess.name = "Tess";
  const wren = rulesActor([]);
  const bandit = rulesActor([]);
  const place = (tessX, wrenX) => [
    { id: "t", x: tessX, d: 1, actor: tess }, { id: "w", x: wrenX, d: 1, actor: wren }, { id: "b", x: 10, d: -1, actor: bandit }
  ];
  const blow = { threat: "blow", melee: true };
  // Adjacent: Tess's own roll, and Wren's through Tess's rule.
  let tokens = place(0, 1);
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("t", tokens), momentOnly: true }).applied.map(m => m.label), ["Close Ranks"], "Tess, an ally adjacent");
  same(ruleModifiers(wren, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("w", tokens), momentOnly: true }).applied.map(m => m.label), ["Close Ranks (Tess)"], "Wren, from Tess's Talent");
  // Apart: neither.
  tokens = place(0, 5);
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("t", tokens), momentOnly: true }).applied, [], "Tess alone");
  same(ruleModifiers(wren, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("w", tokens), momentOnly: true }).applied, [], "Wren out of reach");
  // The bandit adjacent is not an ally.
  tokens = [{ id: "t", x: 0, d: 1, actor: tess }, { id: "w", x: 5, d: 1, actor: wren }, { id: "b", x: 1, d: -1, actor: bandit }];
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("t", tokens), momentOnly: true }).applied, [], "an enemy adjacent counts for nothing");
  // Not a Blow, not on Evade, no scene, no Threat.
  tokens = place(0, 1);
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: { threat: "blast", melee: false }, scene: fakeScene("t", tokens) }).applied, [], "a Blast is not a Blow");
  same(ruleModifiers(tess, { kind: "defense", slug: "evade", item: null, threat: blow, scene: fakeScene("t", tokens) }).applied, [], "Guard only");
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: blow }).applied, [], "no scene: a positional rule cannot be read");
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, scene: fakeScene("t", tokens) }).applied, [], "no Threat: AGAINST cannot be read");
  same(ruleModifiers(tess, { kind: "defense", slug: "guard", item: null, threat: blow, scene: fakeScene("t", tokens), staticOnly: true }).applied, [], "the sheet's pass leaves it out");
});

check("bonus hook: FOR(allies, 15ft) with FIRST(round): Torchbearer's +1 on an ally's first Defense each round, marked", () => {
  const torch = rulesActor([torchbearer]);
  torch.name = "Tess";
  const ally = rulesActor([]);
  const far = rulesActor([]);
  const tokens = [{ id: "t", x: 0, d: 1, actor: torch }, { id: "a", x: 10, d: 1, actor: ally }, { id: "f", x: 30, d: 1, actor: far }];
  const encounter = { combat: "c1", round: 2 };
  const first = ruleModifiers(ally, { kind: "defense", slug: "evade", item: null, scene: fakeScene("a", tokens), encounter, momentOnly: true });
  same(first.applied.map(m => [m.label, m.value, m.type]), [["Torchbearer Human (Tess)", 1, "situation"]], "the ally's first Defense of the round");
  same(first.marks, [{ key: "Torchbearer Human:1", per: "round" }], "and the mark to write");
  must(!("mark" in first.applied[0]), "the mark is lifted off the modifier");
  // Marked for this round: not again; a new round: again; a different Combat: again.
  ally.flags = { starwrought: { rules: { round: { "Torchbearer Human:1": { combat: "c1", round: 2 } } } } };
  same(ruleModifiers(ally, { kind: "defense", slug: "evade", item: null, scene: fakeScene("a", tokens), encounter, momentOnly: true }).applied, [], "not twice in a round");
  same(ruleModifiers(ally, { kind: "defense", slug: "evade", item: null, scene: fakeScene("a", tokens), encounter: { combat: "c1", round: 3 }, momentOnly: true }).applied.length, 1, "the next round");
  same(ruleModifiers(ally, { kind: "defense", slug: "evade", item: null, scene: fakeScene("a", tokens), encounter: { combat: "c2", round: 2 }, momentOnly: true }).applied.length, 1, "another Combat");
  // Outside an encounter it applies every time and asks for no mark.
  const outside = ruleModifiers(ally, { kind: "defense", slug: "evade", item: null, scene: fakeScene("a", tokens), encounter: { combat: null, round: 0 }, momentOnly: true });
  same([outside.applied.length, outside.marks], [1, []], "no encounter, no mark");
  // Out of range, the owner's own roll, a check rather than a Defense.
  same(ruleModifiers(far, { kind: "defense", slug: "evade", item: null, scene: fakeScene("f", tokens), encounter, momentOnly: true }).applied, [], "30 ft away is out of 15 ft");
  same(ruleModifiers(torch, { kind: "defense", slug: "evade", item: null, scene: fakeScene("t", tokens), encounter, momentOnly: true }).applied, [], "allies only, not the Torchbearer");
  same(ruleModifiers(ally, { kind: "check", slug: "stealth", item: null, scene: fakeScene("a", tokens), encounter, momentOnly: true }).applied, [], "Defenses only");
});

check("bonus hook: the Rally Aura (0.14.0): SEEN and IF(Trait=Fear) on an ally's Defense against a Fear attack, once a round", () => {
  const rally = talentWith("Torchbearer Human", "aura: 15ft, allies, VISIBLE\nbonus: +1, Situation, Defenses, FOR(allies, 15ft), SEEN, IF(Trait=Fear), FIRST(round)");
  const wren = rulesActor([rally]);
  wren.name = "Wren";
  const tess = rulesActor([]);
  const tokens = [{ id: "w", x: 0, d: 1, actor: wren }, { id: "t", x: 10, d: 1, actor: tess }];
  const encounter = { combat: "c1", round: 1 };
  const fear = { threat: "beguilement", melee: false, traits: ["Fear", "Mental"] };
  const roll = (threat, scene) => ruleModifiers(tess, { kind: "defense", slug: "awareness", item: null, threat, scene, encounter, momentOnly: true });
  const lit = roll(fear, fakeScene("t", tokens));
  same(lit.applied.map(m => [m.label, m.value, m.type]), [["Torchbearer Human (Wren)", 1, "situation"]], "a Fear attack, Wren in sight and in range");
  same(lit.marks, [{ key: "Torchbearer Human:2", per: "round" }], "marked on the second line");
  same(roll({ threat: "blow", melee: true, traits: ["Finesse"] }, fakeScene("t", tokens)).applied, [], "a sword is not Fear");
  same(roll({ threat: "blow", melee: true }, fakeScene("t", tokens)).applied, [], "an attack with no traits recorded");
  same(roll(null, fakeScene("t", tokens)).applied, [], "no attack known: a Defense rolled for its own sake");
  same(roll(fear, fakeScene("t", tokens, { blind: ["t"] })).applied, [], "Tess Blinded: she does not see Wren");
  same(roll(fear, fakeScene("t", [{ id: "w", x: 0, d: 1, actor: wren, unseen: true }, { id: "t", x: 10, d: 1, actor: tess }])).applied, [], "Wren hidden: nobody sees her");
  same(roll(fear, fakeScene("t", [{ id: "w", x: 0, d: 1, actor: wren }, { id: "t", x: 30, d: 1, actor: tess }])).applied, [], "30 ft: out of the ring");
  same(ruleModifiers(wren, { kind: "defense", slug: "awareness", item: null, threat: fear, scene: fakeScene("w", tokens), encounter, momentOnly: true }).applied, [], "allies only: not Wren's own Defense");
  same(ruleModifiers(tess, { kind: "defense", slug: "awareness", item: null, threat: fear, scene: fakeScene("t", tokens), encounter, staticOnly: true }).applied, [], "the sheet's pass leaves it out");
  // A scene without a sight test (an older fake) reads as unseen: the operator is never assumed.
  const blindScene = fakeScene("t", tokens);
  delete blindScene.sees;
  same(roll(fear, blindScene).applied, [], "no sight test on the scene: SEEN cannot be read");
});

check("prevent hook: SEEN and IF(Trait=...) read on a prevent too (0.14.0)", () => {
  const ward = { ...talentWith("Steadying Word ❶↺", "prevent: Expose, FOR(allies, 15ft), SEEN, IF(Trait=Fear)"), id: "word0001" };
  ward.system.reaction = true;
  const wren = rulesActor([ward]);
  wren.name = "Wren";
  const tess = rulesActor([]);
  const tokens = [{ id: "w", x: 0, d: 1, actor: wren }, { id: "t", x: 5, d: 1, actor: tess }];
  const fear = { threat: "blow", melee: true, traits: ["Fear"] };
  same(rulePreventers(tess, { effect: "expose", threat: fear, scene: fakeScene("t", tokens) }).map(p => p.item.id), ["word0001"], "offered: Fear, seen, in range");
  same(rulePreventers(tess, { effect: "expose", threat: { threat: "blow", melee: true, traits: [] }, scene: fakeScene("t", tokens) }), [], "not Fear");
  same(rulePreventers(tess, { effect: "expose", threat: fear, scene: fakeScene("t", tokens, { blind: ["t"] }) }), [], "Tess does not see Wren");
  same(rulePreventers(tess, { effect: "expose", scene: fakeScene("t", tokens) }), [], "no attack known");
});

check("bonus hook: ONCE(encounter) is remembered by Combat alone", () => {
  const once = talentWith("Second Wind", "bonus: +2, Situation, Checks, ONCE(encounter)");
  const actor = rulesActor([once]);
  const encounter = { combat: "c1", round: 4 };
  const first = ruleModifiers(actor, { kind: "check", slug: "athletics", item: null, encounter });
  same(first.marks, [{ key: "Second Wind:1", per: "encounter" }], "the mark");
  actor.flags = { starwrought: { rules: { encounter: { "Second Wind:1": { combat: "c1" } } } } };
  same(ruleModifiers(actor, { kind: "check", slug: "athletics", item: null, encounter: { combat: "c1", round: 9 } }).applied, [], "spent for the encounter");
  same(ruleModifiers(actor, { kind: "check", slug: "athletics", item: null, encounter: { combat: "c2", round: 1 } }).applied.length, 1, "the next encounter");
});

/* -------------------------------------------- */
/*  The attack flow's pure parts (0.12.0)       */
/* -------------------------------------------- */

const flowSpec = (maneuver, targets) => ({
  id: "wf1", coordinatorUserId: "gm", initiatingUserId: "p1",
  attacker: { actorUuid: "Actor.a", tokenUuid: "", name: "Hrolda", isPlayer: true, controllerUserIds: ["p1"] },
  maneuver,
  targets: targets ?? [{ actorUuid: "Actor.b", tokenUuid: "", name: "Bandit", isPlayer: false, controllerUserIds: [] }]
});

check("AttackWorkflow.create: a weapon Blow reads as a Blow (source, threat, the two Defenses, no Reaction, no spell)", () => {
  const wf = AttackWorkflow.create(flowSpec({ weaponId: "w1", weaponName: "Longsword", strike: "deliberate", ranged: false }));
  same([wf.maneuver.source, wf.maneuver.threat, wf.maneuver.defenses, wf.maneuver.reaction, wf.maneuver.basicOnly, wf.maneuver.spell, wf.maneuver.strike],
    ["weapon", "blow", ["evade", "guard"], null, false, null, "deliberate"], "the Blow's record");
  const old = AttackWorkflow.create(flowSpec({ attackId: "row1", weaponName: "Bite", strike: "quick" }));
  same([old.maneuver.source, old.maneuver.defenses], ["attack", ["evade", "guard"]], "a 0.11.0-shaped attack-row record reads as a Blow");
});

check("AttackWorkflow.create: a spell has no Strike, the Cast's glyph, its Threat's two Defenses, and is never melee", () => {
  const wf = AttackWorkflow.create(flowSpec({
    source: "spell", weaponName: "Flame Seed", strike: "deliberate", threat: "blast", defenses: ["evade", "endure"],
    spell: { talentId: "t1", cast: "focused", threat: "blast", delivery: "pervasive", die: 6, name: "Flame Seed" }
  }));
  same([wf.maneuver.strike, wf.maneuver.glyph, wf.maneuver.defenses, wf.maneuver.ranged, wf.maneuver.spell.cast],
    [null, ACTION_GLYPHS[3], ["evade", "endure"], true, "focused"], "the spell's record");
  const profile = AttackWorkflow.profileFor(wf.maneuver);
  same([profile.defenses, profile.basicOnly, profile.melee, profile.canPosition, profile.source],
    [["evade", "endure"], false, false, false, "spell"], "its profile");
});

check("AttackWorkflow.create: a Reaction Strike is a Quick Strike answered by a basic Defense alone; a Riposte is free", () => {
  const intercept = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "deliberate", reaction: "intercept" }));
  same([intercept.maneuver.reaction, intercept.maneuver.basicOnly, intercept.maneuver.free], ["intercept", true, false], "Intercept");
  const riposte = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick", reaction: "riposte" }));
  same([riposte.maneuver.reaction, riposte.maneuver.basicOnly, riposte.maneuver.free], ["riposte", true, true], "Riposte");
  must(AttackWorkflow.profileFor(intercept.maneuver).basicOnly === true, "the profile says basic only");
  const bogus = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick", reaction: "counter" }));
  same([bogus.maneuver.reaction, bogus.maneuver.basicOnly], [null, false], "an unknown Reaction word is no Reaction");
});

check("AttackWorkflow.profileFor: a record from before 0.12.0 (no defenses, no source) reads as a Blow", () => {
  const profile = AttackWorkflow.profileFor({ weaponId: "w1", strike: "quick", ranged: true });
  same([profile.defenses, profile.basicOnly, profile.melee, profile.canPosition], [["evade", "guard"], false, false, true], "the Blow profile");
  same(AttackWorkflow.profileFor(undefined).defenses, ["evade", "guard"], "and nothing at all");
});

check("no `useStances` action, and `gmDefendAbsent` is an outstanding kind (ruling 159)", () => {
  must(!("useStances" in ACTIONS), "useStances is gone from the actions");
  must(OUTSTANDING_KINDS.includes("gmDefendAbsent"), "gmDefendAbsent is listed");
});

check("outstandingFor: the GM gets an explicit row for an absent player's defender and for an adversary; the player gets their own", () => {
  const wf = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick" }, [
    { actorUuid: "Actor.c", tokenUuid: "", name: "Wren", isPlayer: true, controllerUserIds: ["p2"] },
    { actorUuid: "Actor.b", tokenUuid: "", name: "Bandit", isPlayer: false, controllerUserIds: [] }
  ]));
  AttackWorkflow.transition(wf, "defending");
  same(AttackWorkflow.outstandingFor(wf, { id: "gm", isGM: true }).map(o => o.kind), ["gmDefendAbsent", "gmDefend"], "the GM's rows");
  same(AttackWorkflow.outstandingFor(wf, { id: "p2", isGM: false }).map(o => o.kind), ["defend"], "Wren's player's row");
  same(AttackWorkflow.outstandingFor(wf, { id: "p1", isGM: false }), [], "the attacker's player has nothing to answer");
  wf.targets[0].committed = true;
  same(AttackWorkflow.outstandingFor(wf, { id: "gm", isGM: true }).map(o => o.kind), ["gmDefend"], "a committed defender drops off the GM's list");
});

check("waitingForGm: with no GM connected an uncommitted adversary waits; with one, or past defending, nothing does (ruling 162)", () => {
  const wf = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick" }, [
    { actorUuid: "Actor.c", tokenUuid: "", name: "Wren", isPlayer: true, controllerUserIds: ["p2"] },
    { actorUuid: "Actor.b", tokenUuid: "", name: "Bandit", isPlayer: false, controllerUserIds: [] }
  ]));
  AttackWorkflow.transition(wf, "defending");
  same(AttackWorkflow.waitingForGm(wf, { gmActive: false }).map(t => t.name), ["Bandit"], "the adversary waits");
  same(AttackWorkflow.waitingForGm(wf, { gmActive: true }), [], "a GM is there");
  wf.targets[1].committed = true;
  same(AttackWorkflow.waitingForGm(wf, { gmActive: false }), [], "committed, nothing waits");
});

check("rollerFor is unchanged: a player attacker rolls once; a player defender of an adversary's Blow rolls Defense", () => {
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: true }, defender: { isPlayer: false } }).roller, "attacker", "player attacker");
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: false }, defender: { isPlayer: true } }).rollType, "defense", "player defender");
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: false }, defender: { isPlayer: false } }).isolated, true, "adversary against adversary");
});

const answerer = () => ({
  type: "character",
  items: [],
  system: { reactions: { owned: { parry: "i1", sidestep: "i2", "give-ground": "r1" }, blocked: false } }
});

check("legalAnswers: the permitted Defenses, the melee-only Reactions and a basic-only answer are the Maneuver's to say", () => {
  same(legalAnswers(answerer(), "guard").reactions, ["parry"], "Parry on Guard against a melee Blow");
  same(legalAnswers(answerer(), "guard", { melee: false }).reactions, [], "and not against an arrow or a spell");
  same(legalAnswers(answerer(), "evade", { melee: false }).reactions, ["sidestep"], "Sidestep answers anything met with Evade");
  same(legalAnswers(answerer(), "evade").postures.map(p => p.key), ["give-ground"], "the root Posture on Evade");
  same(legalAnswers(answerer(), "evade", { basicOnly: true }), { none: true, reactions: [], postures: [] }, "a Reaction Strike: the basic Defense alone");
  same(legalAnswers(answerer(), "endure").none && legalAnswers(answerer(), "endure").reactions.length, 0, "Endure answers no Blow");
  same(legalAnswers(answerer(), "endure", { permitted: ["evade", "endure"] }).none, true, "but a Blast");
});

check("isLegalAnswer: a Defense outside the permitted pair, an answer under basicOnly, and a melee Reaction against an arrow are all refused", () => {
  must(isLegalAnswer(answerer(), "guard", { reaction: "parry" }), "Parry on Guard, a melee Blow");
  must(!isLegalAnswer(answerer(), "endure", {}), "Endure does not answer a Blow");
  must(isLegalAnswer(answerer(), "endure", {}, { permitted: ["evade", "endure"] }), "Endure answers a Blast");
  must(!isLegalAnswer(answerer(), "guard", { reaction: "parry" }, { basicOnly: true }), "nothing but the basic Defense answers a Reaction Strike");
  must(isLegalAnswer(answerer(), "guard", {}, { basicOnly: true }), "the basic Defense does");
  must(!isLegalAnswer(answerer(), "guard", { reaction: "parry" }, { melee: false }), "Parry never answers an arrow");
  must(!isLegalAnswer(answerer(), "evade", { reaction: "sidestep", posture: { talentId: "r1", zone: "arms" } }), "never both");
});

/* -------------------------------------------- */

console.log("");
if (failures.length) {
  console.error(`rules framework: ${failures.length} of ${passed + failures.length} checks FAILED:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
console.log(`rules framework: ${passed} checks passed`);
