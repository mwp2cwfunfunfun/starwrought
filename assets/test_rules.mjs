#!/usr/bin/env node
/**
 * test_rules.mjs: the self-test of the automation framework (0.9.0; rulings 118 to 120).
 *
 * `build_all.mjs` runs this in every step-running mode (the full pipeline and the content loop alike; `--check` runs no step), as the step `test_rules` right
 * before `build_foundry`, because the next step parses every Automation cell in the book with
 * exactly this grammar: a grammar that broke would fail every cell at once with a message about
 * the cells. This is a unit test of the modules under foundry/starwrought/module/rules/, imported
 * from plain Node as the build imports them (which is itself the first check: a Foundry global at
 * module scope fails the import). It is not the pipeline and touches no file.
 *
 * It registers throwaway kinds IN PROCESS (`test-only`, `misbehaving`), which ship nowhere: the
 * registry is a Map in this process and the system never imports this file. SHIPPED_KINDS below
 * is the list the registry must hold before any of that, so a kind registered in kinds/index.mjs
 * without being named here fails the pipeline, which is the point of naming it.
 *
 *   node assets/test_rules.mjs      exit 0 and "rules framework: N checks passed", or exit 1
 *                                   with every failing check named
 */

import {
  parseAutomation, summarize, ruleEntries, splitArgs, keyValues, RuleSyntaxError, RESERVED_WORDS,
  KIND_WORD, kindOf, knownKinds
} from "../foundry/starwrought/module/rules/grammar.mjs";
import { KINDS, registerKind } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { collectRules, rulesOfKind, RULE_ITEM_TYPES } from "../foundry/starwrought/module/rules/engine.mjs";

/**
 * The kinds the registry ships with, by id, sorted. EMPTY in 0.9.0 (Mike, 2026-10-03: "do NOT
 * survey the talents yet or build ANY of the automation hooks. just build the framework"). When
 * the first kind lands (the aura, for Torchbearer) its id goes here with its own checks below.
 */
const SHIPPED_KINDS = [];

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

// These run before any throwaway kind registers, so the "no rule kinds are defined yet" tail is
// what the build would print today on a cell that names one.
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
  const parsed = parseAutomation("# the cell\n\naura: 15 ft allies");
  same(parsed.rules, [], "rules");
  must(parsed.errors.length === 1, `expected one error, got ${parsed.errors.length}`);
  const [error] = parsed.errors;
  must(error.line === 3, `the error should be on line 3 (blanks and comments count), got ${error.line}`);
  must(error.text === "aura: 15 ft allies", `the error should carry the trimmed line, got "${error.text}"`);
  if (registryWasEmpty) {
    must(error.message === 'unknown rule kind "aura" (no rule kinds are defined yet)', `message: "${error.message}"`);
  } else {
    must(/^unknown rule kind "aura" \(known kinds: /.test(error.message), `message: "${error.message}"`);
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
  const { errors } = parseAutomation("AURA: 15 ft");
  must(errors.length === 1 && /unknown rule kind "aura"/.test(errors[0].message), `message: "${errors[0]?.message}"`);
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
  must(kindOf("aura") === undefined && kindOf(null) === undefined && kindOf("") === undefined, "nothing else resolves");
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
  const sly = { id: "sly", parse: () => ({ kind: "aura", line: 99, text: "nope", error: "nope", payload: 1 }), summary: () => "sly" };
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
  must(summarize({ error: "unknown rule kind \"aura\"", line: 1, text: "aura: 15 ft" }) === 'unknown rule kind "aura"', "an error entry prints its error");
  must(summarize({ kind: "aura", line: 1, text: "aura: 15 ft" }) === 'unknown rule kind "aura"', "an unregistered kind prints unknown rule kind with the word");
  must(summarize({ line: 1, text: "x" }) === "unknown rule kind", "no kind at all prints unknown rule kind");
  must(summarize({ kind: "misbehaving", line: 1, text: "misbehaving: fine" }) === "misbehaving: fine", "a broken summary falls back to the text");
  must(summarize(null) === "" && summarize("x") === "", "nothing to summarize is an empty string");
});

check("RuleSyntaxError carries line and text when given them", () => {
  const bare = new RuleSyntaxError("bad");
  must(bare.name === "RuleSyntaxError" && bare.message === "bad" && bare.line === null && bare.text === "", "bare");
  const placed = new RuleSyntaxError("bad", { line: 4, text: "aura: x" });
  must(placed.line === 4 && placed.text === "aura: x", "placed");
  must(placed instanceof Error, "is an Error");
});

/* -------------------------------------------- */
/*  ruleEntries                                 */
/* -------------------------------------------- */

check("ruleEntries merges rules and errors in line order with errors as { error, line, text }", () => {
  const parsed = parseAutomation("test-only: a\naura: 15 ft\ntest-only: times=x\ntest-only: b");
  const entries = ruleEntries(parsed);
  same(entries.map(e => e.line), [1, 2, 3, 4], "line order");
  same(entries[1], { error: 'unknown rule kind "aura" (known kinds: misbehaving, quiet, sly, test-only)', line: 2, text: "aura: 15 ft" }, "an unknown-kind entry");
  must(entries[2].error === "say what is being tested, before any key=value", "a kind's refusal becomes an error entry");
  must(entries[0].kind === "test-only" && entries[3].kind === "test-only", "parsed rules pass through unchanged");
  same(ruleEntries(null), [], "nothing in, nothing out");
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
  { error: 'unknown rule kind "aura" (no rule kinds are defined yet)', line: 2, text: "aura: 15 ft allies" }
] } };
const actionB = { type: "action", name: "Seek", system: { rules: [
  { kind: "probe", line: 1, text: "probe: b", subject: "b", times: 2 },
  { kind: "aura", line: 2, text: "aura: 30 ft" }
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
    ["Torchbearer Human", 'unknown rule kind "aura" (no rule kinds are defined yet)'],
    ["Seek", 'unknown rule kind "aura"']
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
  same(rulesOfKind(plain, "aura"), [], "an unregistered kind is an empty array");
  same(rulesOfKind(plain, ""), [], "no kind is an empty array");
  same(rulesOfKind(plain, undefined), [], "undefined is an empty array");

  const prepared = { items: [talentA, actionB], system: { rules: collectRules(fakeActor([constellationC])) } };
  same(rulesOfKind(prepared, "test-only"), [], "the prepared index wins over the items");
  same(rulesOfKind(prepared, "quiet").map(e => e.item.name), ["Humanity"], "and answers from it");
  same(rulesOfKind({ system: { rules: [] } }, "quiet"), [], "an Item-shaped system.rules (an array) is not an index");
  same(rulesOfKind(null, "quiet"), [], "nothing at all is an empty array");
});

/* -------------------------------------------- */

console.log("");
if (failures.length) {
  console.error(`rules framework: ${failures.length} of ${passed + failures.length} checks FAILED:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
console.log(`rules framework: ${passed} checks passed`);
