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
import { collectRules, rulesOfKind, ruleModifiers, RULE_ITEM_TYPES } from "../foundry/starwrought/module/rules/engine.mjs";
import { slugify, plainName } from "../foundry/starwrought/module/config.mjs";

/**
 * The kinds the registry ships with, by id, sorted. Empty in 0.9.0 (Mike, 2026-10-03: "do NOT
 * survey the talents yet or build ANY of the automation hooks. just build the framework"); `bonus`
 * since 0.10.0, Mike's first (Humanity's "+1 Condition bonus on checks to Aid"), with its own
 * checks below. Each kind that lands adds its id here and its section of checks.
 */
const SHIPPED_KINDS = ["bonus"];

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
  same(entries[1], { error: `unknown rule kind "${UNKNOWN_KIND}" (known kinds: bonus, misbehaving, quiet, sly, test-only)`, line: 2, text: `${UNKNOWN_KIND}: 15 ft` }, "an unknown-kind entry");
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
  const { rules, errors } = parseAutomation("bonus: +1 Condition to Aid if Human is Trained");
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

check("bonus: every accepted form, without a resolver", () => {
  const full = bonusRule("bonus: +1 Condition to Aid if Human is Trained");
  same(full, {
    value: 1, type: "condition",
    to: { name: "Aid", slug: "aid", type: null },
    when: { constellation: "human", name: "Human", rank: "trained" },
    kind: "bonus", line: 1, text: "bonus: +1 Condition to Aid if Human is Trained"
  }, "the full form");

  const bare = bonusRule("bonus: 1 condition to aid");
  must(bare.value === 1, "a bare 1 reads as +1");
  must(bare.type === "condition", "the type word is case blind");
  same(bare.to, { name: "aid", slug: "aid", type: null }, "the target as written, slug made, type unknown");
  must(bare.when === null, "no clause is null");

  must(bonusRule("bonus: -2 GEAR to Stealth").value === -2, "a negative value");
  must(bonusRule("bonus: -2 GEAR to Stealth").type === "gear", "GEAR");
  must(bonusRule("bonus: +3 situation to Armored Fighting").type === "situation", "situation");
  same(bonusRule("bonus: +3 Situation to armored-fighting").to, { name: "armored-fighting", slug: "armored-fighting", type: null }, "the slug form of a target");
  same(bonusRule("bonus: +3 Situation to Armored Fighting").to.slug, "armored-fighting", "a two-word name slugs the same");

  const glyphed = bonusRule("bonus: +1 Condition to Aid ❶ (⓿↺)");
  must(glyphed.to.slug === "aid", `a Maneuver's glyphs never reach the slug, got "${glyphed.to.slug}"`);

  const mixed = bonusRule("Bonus: +1 CONDITION To Aid IF Human IS Expert");
  same(mixed.when, { constellation: "human", name: "Human", rank: "expert" }, "if, is and to are case blind");
  must(mixed.kind === "bonus", "the kind word is case blind");

  for (const rank of ["Untrained", "Trained", "Expert", "Master", "Legendary", "legendary"]) {
    must(bonusRule(`bonus: +1 Condition to Aid if Human is ${rank}`).when.rank === rank.toLowerCase(), `rank ${rank}`);
  }
  must(bonusRule("bonus +1 Condition to Aid").value === 1, "the colon is optional, as the grammar says");
});

check("bonus: Humanity's four lines parse to four rules, one rank each", () => {
  const cell = [
    "bonus: +1 Condition to Aid if Human is Trained",
    "bonus: +2 Condition to Aid if Human is Expert",
    "bonus: +3 Condition to Aid if Human is Master",
    "bonus: +4 Condition to Aid if Human is Legendary"
  ].join("\n");
  const { rules, errors } = parseAutomation(cell, { resolve, itemName: "Humanity", constellation: "Human", itemType: "talent" });
  same(errors, [], "errors");
  same(rules.map(r => [r.value, r.when.rank, r.to.type, r.line]), [[1, "trained", "action", 1], [2, "expert", "action", 2], [3, "master", "action", 3], [4, "legendary", "action", 4]], "the rules");
});

check("bonus: with a resolver the target and the clause carry the resolved type, slug and name", () => {
  const rule = bonusRule("bonus: +1 Condition to aid ❶ if human is Expert", { resolve });
  same(rule.to, { name: "Aid", slug: "aid", type: "action" }, "a Maneuver target");
  same(rule.when, { constellation: "human", name: "Human", rank: "expert" }, "the clause's Constellation");
  same(bonusRule("bonus: +2 Situation to STEALTH", { resolve }).to, { name: "Stealth", slug: "stealth", type: "constellation" }, "a Constellation target");
  same(bonusRule("bonus: +1 Gear to armored-fighting", { resolve }).to, { name: "Armored Fighting", slug: "armored-fighting", type: "constellation" }, "a Constellation by slug");
});

check("bonus: the refusals, each with a message the designer can act on", () => {
  must(/a bonus of 0 does nothing/.test(bonusError("bonus: 0 Condition to Aid")), "zero");
  must(/a bonus of 0 does nothing/.test(bonusError("bonus: +0 Condition to Aid")), "plus zero");
  must(/write Condition, not status: the book renamed the types in v3\.3/.test(bonusError("bonus: +1 status to Aid")), "status");
  must(/write Situation, not circumstance/.test(bonusError("bonus: +1 Circumstance to Aid")), "circumstance");
  must(/write Gear, not item/.test(bonusError("bonus: +1 item to Aid")), "item");
  must(/no Talent bonus is untyped; name Situation, Condition or Gear/.test(bonusError("bonus: +1 untyped to Aid")), "untyped");
  must(/"Fancy" is not a bonus type: write Situation, Condition or Gear/.test(bonusError("bonus: +1 Fancy to Aid")), "an unknown type word");
  const shape = bonusError("bonus: +1 Condition Aid");
  must(/to <Target>/.test(shape) && /bonus: \+1 Condition to Aid if Human is Expert/.test(shape), `a missing \`to\` prints the shape: "${shape}"`);
  must(/to <Target>/.test(bonusError("bonus:")), "an empty line prints the shape");
  must(/to <Target>/.test(bonusError("bonus: Condition to Aid")), "a missing value prints the shape");
  must(/"Grand" is not a rank: write Untrained, Trained, Expert, Master or Legendary/.test(bonusError("bonus: +1 Condition to Aid if Human is Grand")), "a bad rank word");
  must(/write `if Human is Expert`/.test(bonusError("bonus: +1 Condition to Aid if Human = Expert")), "= instead of is");
  must(/write `if Human is Expert`/.test(bonusError("bonus: +1 Condition to Aid if Human Expert")), "a clause with no is");
  must(/write `if Human is Expert`/.test(bonusError("bonus: +1 Condition to Aid if Human is Expert and more")), "a clause with a tail");
});

check("bonus: the refusals a resolver makes possible", () => {
  must(bonusError("bonus: +1 Condition to Aidd", { resolve }) === '"Aidd" names no Constellation or Maneuver', "an unknown target");
  must(bonusError("bonus: +1 Condition to Guard if Aid is Expert", { resolve }) === '"Aid" is not a Constellation', "a Maneuver in the clause");
  must(bonusError("bonus: +1 Condition to Guard if Nobody is Expert", { resolve }) === '"Nobody" is not a Constellation', "nothing in the clause");
  must(bonusError("bonus: +1 Condition to Lore", { resolve }) === "a Lore is the character's own; a bonus cannot name it", "the Lore template");
  must(bonusError("bonus: +1 Condition to Lore") === "a Lore is the character's own; a bonus cannot name it", "the Lore template, without a resolver");
  must(bonusError("bonus: +1 Condition to Lore (Serrovane)") === "a Lore is the character's own; a bonus cannot name it", "a Lore instance");
});

check("bonus: the summary", () => {
  must(summarize(bonusRule("bonus: +1 Condition to Aid if Human is Expert", { resolve })) === "+1 Condition bonus to Aid while Human is Expert", "the full form");
  must(summarize(bonusRule("bonus: -2 condition to Stealth")) === "-2 Condition penalty to Stealth", "a penalty, no clause");
  must(summarize(bonusRule("bonus: 3 gear to Guard", { resolve })) === "+3 Gear bonus to Guard", "a bare value prints signed");
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
  "bonus: +1 Condition to Aid if Human is Trained",
  "bonus: +2 Condition to Aid if Human is Expert",
  "bonus: +3 Condition to Aid if Human is Master",
  "bonus: +4 Condition to Aid if Human is Legendary"
].join("\n"));
const sneaky = talentWith("Sneaky ❶", "bonus: +2 Situation to Stealth");
const braced = talentWith("Braced", "bonus: +1 Gear to Guard if Human is Expert");
const aidItem = { type: "action", name: "Aid ❶ (⓿↺)", id: "aid0001" };
const searchItem = { type: "action", name: "Search ❶", id: "srch0001" };

check("ruleModifiers: a Constellation target applies on its slug and nowhere else", () => {
  const actor = rulesActor([sneaky, humanity]);
  const onStealth = ruleModifiers(actor, { kind: "check", slug: "stealth", item: null });
  same(onStealth.applied, [{ label: "Sneaky", value: 2, type: "situation" }], "applied on Stealth, the label the carrier's plain name");
  const onAthletics = ruleModifiers(actor, { kind: "check", slug: "athletics", item: null });
  must(!onAthletics.applied.some(m => m.label === "Sneaky"), "absent on Athletics");
  const asInitiative = ruleModifiers(actor, { kind: "initiative", slug: "stealth", item: null });
  same(asInitiative.applied, [{ label: "Sneaky", value: 2, type: "situation" }], "an Initiative rolled with Stealth is a Stealth check (ruling 111)");
});

check("ruleModifiers: the rank condition is equality, read from the actor's proficiency", () => {
  const roll = { kind: "check", slug: "diplomacy", item: aidItem };
  same(ruleModifiers(rulesActor([humanity], { human: "untrained" }), roll).applied, [], "Untrained: none of the four");
  same(ruleModifiers(rulesActor([humanity], { human: "trained" }), roll).applied, [{ label: "Humanity", value: 1, type: "condition" }], "Trained: the +1 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "expert" }), roll).applied, [{ label: "Humanity", value: 2, type: "condition" }], "Expert: the +2 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "legendary" }), roll).applied, [{ label: "Humanity", value: 4, type: "condition" }], "Legendary: the +4 alone");
  same(ruleModifiers(rulesActor([humanity], {}), roll).applied, [], "a Constellation the actor has no entry for reads as Untrained");
});

check("ruleModifiers: a conditioned rule never fires for an actor without proficiency; an unconditioned one does", () => {
  const actor = rulesActor([humanity, sneaky], null);
  must(!("proficiency" in actor.system), "the fake adversary has no proficiency");
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: aidItem }).applied, [{ label: "Sneaky", value: 2, type: "situation" }], "only the unconditioned rule");
});

check("ruleModifiers: a Maneuver target applies when the roll carries that Maneuver, glyphs ignored", () => {
  const actor = rulesActor([humanity], { human: "trained" });
  const withAid = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: aidItem });
  same(withAid.applied, [{ label: "Humanity", value: 1, type: "condition" }], "applied from the Aid Item");
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
    label: "Humanity: Aid", value: 2, type: "condition", offer: true,
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
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), roll).applied, [{ label: "Braced", value: 1, type: "gear" }], "Guard at Expert");
  same(ruleModifiers(rulesActor([braced], { human: "trained" }), roll).applied, [], "not at Trained");
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), { kind: "defense", slug: "evade", item: null }).applied, [], "not on Evade");
});

check("ruleModifiers: no rules, no kinds with the hook, or nothing at all is two empty lists", () => {
  same(ruleModifiers(rulesActor([]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [] }, "no rules");
  same(ruleModifiers(rulesActor([talentA]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [] }, "a kind without the hook is skipped");
  same(ruleModifiers(null, { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [] }, "null actor");
  same(ruleModifiers({ items: [sneaky] }, { kind: "check", slug: "stealth", item: null }).applied, [{ label: "Sneaky", value: 2, type: "situation" }], "an actor with no prepared index is collected on the spot");
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
  same(result.applied, [{ label: "Sneaky", value: 2, type: "situation" }], "the other kind's modifiers still arrive");
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

console.log("");
if (failures.length) {
  console.error(`rules framework: ${failures.length} of ${passed + failures.length} checks FAILED:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
console.log(`rules framework: ${passed} checks passed`);
