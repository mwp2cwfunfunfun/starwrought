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
 * the point of naming it. Since 0.17.0 the grammar names a kind only through its fixed tables (a
 * block's keyword, an effect's tag; a `kind:` line is the retired form), so a throwaway kind can
 * no longer be reached from a cell: the checks on how the grammar treats a kind's answer borrow a
 * shipped kind's block for one call (`withParse`, below) and give its `parse` back in a finally.
 *
 *   node assets/test_rules.mjs      exit 0 and "rules framework: N checks passed", or exit 1
 *                                   with every failing check named
 */

import {
  parseAutomation, summarize, ruleEntries, splitArgs, keyValues, RuleSyntaxError, RESERVED_WORDS, LEGACY_REFUSAL,
  KIND_WORD, kindOf, knownKinds
} from "../foundry/starwrought/module/rules/grammar.mjs";
import { KINDS, registerKind } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { collectRules, rulesOfKind, ruleModifiers, rulePreventers, ruleUses, ruleCardOffers, RULE_ITEM_TYPES } from "../foundry/starwrought/module/rules/engine.mjs";
import { splitOperands, rankMeets, whoMatches, compare, needsMoment, hasTrait, traitKey, againstHolds, markedHolds } from "../foundry/starwrought/module/rules/operators.mjs";
// 0.17.0: the effect reader behind every tag (the operator reader's successor) and the feature
// keyword list, each checked on its own as readLine was.
import { readEffectLine } from "../foundry/starwrought/module/rules/effects.mjs";
import { FEATURE_KEYWORD_LIST } from "../foundry/starwrought/module/rules/features.mjs";
import { ignoresTerrain } from "../foundry/starwrought/module/rules/kinds/ignore.mjs";
import { terrainKindOf, terrainKindName, registerTerrainKinds } from "../foundry/starwrought/module/config.mjs";

// The terrain kinds are the roster's `terrainKinds` block since 0.18.0, registered before any parse
// by the pipeline step and the build; the suite seeds the ten shipped rows the same way, so an
// `[EFFECT IGNORE: terrain, mud]` reads here as it does there (an unseeded registry knows nothing).
registerTerrainKinds([["Mud", "", 2, "#6b4a2b"], ["Shallow Water", "", 2, "#2f7fb8"], ["Decking", "", 2, "#9a7a4a"], ["Loose Stone", "", 2, "#7d7d7d"], ["Rubble", "", 2, "#5c5c5c"], ["Undergrowth", "", 2, "#3f7a3a"], ["Snow", "", 2, "#cfe3f2"], ["Ice", "", 2, "#9fd3e8"], ["Sand", "", 2, "#d8b56a"], ["Other", "", 2, "#8a6fb0"]]);
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
const SHIPPED_KINDS = ["aura", "bonus", "choice", "grant", "ignore", "language", "maneuver", "mark", "prevent", "reroll", "sense", "size", "speed", "talent", "trait", "vigor"];

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

/**
 * Run `fn` with a shipped kind's `parse` swapped for `parse`, and give it back whatever happens
 * (0.17.0). The grammar reaches a kind only through a block's keyword or an effect's tag, both
 * fixed tables, so a kind registered by this file is never called by a parse; the checks on what
 * the grammar does with a kind's answer (a throw, a non-object, data that is not plain, a reserved
 * word) borrow the `trait` block or the CHECK tag for one call. The registered object is the one
 * `kindOf` hands out, so the swap is seen by the grammar and undone before the next check.
 */
function withParse(kindId, parse, fn) {
  const kind = kindOf(kindId);
  must(kind, `withParse: no "${kindId}" kind to borrow`);
  const original = kind.parse;
  kind.parse = parse;
  try {
    return fn();
  } finally {
    kind.parse = original;
  }
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
    same(parsed, { rules: [], errors: [], warnings: [] }, `parseAutomation(${String(text)})`);
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
    must(new RegExp(`^unknown rule kind "${UNKNOWN_KIND}" \\(an effect begins with a tag: `).test(error.message), `message: "${error.message}"`);
  }
});

check("a word that is not shaped like a kind word says so", () => {
  const { errors } = parseAutomation("15 ft allies");
  must(errors.length === 1, "one error");
  must(/unknown rule kind "15"/.test(errors[0].message), `names the word: "${errors[0].message}"`);
  must(/letters only, then a colon/.test(errors[0].message), `gives the shape: "${errors[0].message}"`);
});

check("a line with nothing before its colon has no kind word", () => {
  const { errors } = parseAutomation(": 15 ft");
  must(errors.length === 1, "one error");
  must(/no tag/.test(errors[0].message), `message: "${errors[0].message}"`);
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

check("a known kind parses a block's data into rule data, stored under the block's text", () => {
  const { rules, errors } = withParse("trait", testOnly.parse, () => parseAutomation("[TRAIT the grammar, times=3]"));
  same(errors, [], "errors");
  must(rules.length === 1, "one rule");
  same(rules[0], { subject: "the grammar", times: 3, kind: "trait", line: 1, text: "[TRAIT the grammar, times=3]" }, "the rule, through the borrowed block");
  same(parseAutomation("[TRAIT Human]").rules, [{ name: "Human", kind: "trait", line: 1, text: "[TRAIT Human]" }], "and the shipped kind's own answer");
});

check("a block's keyword is case blind, and a keyword alias resolves to the kind's id", () => {
  const { rules, errors } = parseAutomation("[TRAIT Human]\n[trait Human]\n[Senses Keen nose]\n[SENSE Keen nose]\n[LANGUAGES Common]\n[POINTS 2 Skill]");
  same(errors, [], "errors");
  same(rules.map(r => [r.line, r.kind]), [[1, "trait"], [2, "trait"], [3, "sense"], [4, "sense"], [5, "language"], [6, "grant"]], "the kinds, by canonical id");
  must(rules[0].name === "Human" && rules[1].name === "Human", "the data is the rest of the block");
  // A kind's own alias (`probe` for `test-only`) resolves through kindOf alone: since 0.17.0 the
  // grammar reads no kind word off a line, so a `probe:` line is told to bracket itself (a kind
  // word that was never a 0.13.0 line is not the retired form).
  must(kindOf("probe") === kindOf("test-only"), "an alias resolves to the kind");
  must(/^PROBE is a feature and is written in brackets/.test(parseAutomation("probe: the grammar").errors[0]?.message ?? ""), "a `kind:` line is refused, alias or not");
});

check("CRLF line endings, indentation and interleaved comments are read the same", () => {
  const { rules, errors } = parseAutomation("  # head\r\n\r\n   [TRAIT a]   \r\n# mid\r\n[TRAIT b]\r\n");
  same(errors, [], "errors");
  same(rules.map(r => [r.line, r.name, r.text]), [[3, "a", "[TRAIT a]"], [5, "b", "[TRAIT b]"]], "rules");
});

check("the reserved words win over a kind's data, and a kind cannot mark its own rule as an error", () => {
  const sly = () => ({ kind: UNKNOWN_KIND, line: 99, text: "nope", error: "nope", payload: 1 });
  const { rules, errors } = withParse("trait", sly, () => parseAutomation("[TRAIT anything]"));
  same(errors, [], "errors");
  same(rules[0], { payload: 1, kind: "trait", line: 1, text: "[TRAIT anything]" }, "the rule");
  must(!("error" in rules[0]), "a kind's `error` is dropped");
  must(summarize(rules[0]) === kindOf("trait").summary(rules[0]), "and the rule summarizes through its kind, not as an error");
  must(collectRules({ items: [{ type: "talent", system: { rules } }] }).all.length === 1, "and the engine files it as usable");
});

check("the grammar hands the kind its context plus line, text, kind, form, warn and the block or the effect", () => {
  const context = { itemName: "Torchbearer Human", constellation: "Humanity", itemType: "talent", source: "Humanity / Torchbearer Human" };
  lastContext = null;
  withParse("trait", testOnly.parse, () => parseAutomation("[TRAIT ctx]", context));
  must(lastContext, "parse received a context");
  must(typeof lastContext.warn === "function", "with a warn function");
  const { warn, ...given } = lastContext;
  same(given, {
    ...context, line: 1, text: "[TRAIT ctx]", kind: "trait", form: "feature",
    block: { keyword: "trait", kind: "trait", data: "ctx", text: "[TRAIT ctx]" }
  }, "a feature block's context");
  lastContext = null;
  withParse("bonus", testOnly.parse, () => parseAutomation("[EFFECT CHECK: 1 condition, aid]", context));
  must((lastContext?.form === "effect") && (lastContext.kind === "bonus") && (lastContext.line === 1) && (lastContext.text === "[EFFECT CHECK: 1 condition, aid]"), `an effect block's context: ${JSON.stringify(lastContext)}`);
  same([lastContext.effect.tag, lastContext.effect.value, lastContext.effect.type, lastContext.effect.descriptors], ["check", 1, "condition", ["aid"]], "with the effect as read");
  lastContext = null;
  withParse("bonus", testOnly.parse, () => parseAutomation("CHECK: 1 condition, aid", { ...context, itemType: "effect" }));
  must((lastContext?.form === "effect") && (lastContext.text === "CHECK: 1 condition, aid"), "a bare effect line's context on a custom effect row, its text the line");
});

check("summarize prints the kind's summary, by id or by alias", () => {
  must(summarize({ kind: "test-only", line: 1, text: "x", subject: "the grammar", times: 3 }) === "test the grammar, 3 times", "by id");
  must(summarize({ kind: "probe", line: 1, text: "x", subject: "once", times: 1 }) === "test once, 1 time", "by alias");
});

check("a kind that throws RuleSyntaxError yields an error line with its message and no crash", () => {
  const { rules, errors } = withParse("trait", testOnly.parse, () => parseAutomation("[TRAIT times=2]\n[TRAIT ok]\n[TRAIT it, times=many]"));
  must(rules.length === 1 && rules[0].subject === "ok", "the good line still parses");
  same(errors.map(e => [e.line, e.message]), [
    [1, "say what is being tested, before any key=value"],
    [3, 'times must be a whole number, not "many"']
  ], "errors");
  must(errors[0].text === "[TRAIT times=2]", "the error carries the block's text");
});

check("a kind that throws anything else is reported as the kind's failure, never a crash", () => {
  const { rules, errors } = withParse("trait", misbehaving.parse, () => parseAutomation("[TRAIT throw]"));
  same(rules, [], "rules");
  must(errors.length === 1, "one error");
  must(/^the "trait" kind could not read this line: boom \(a bug in the kind, not in the cell\)$/.test(errors[0].message), `message: "${errors[0].message}"`);
  // The same through a tag: the effect path labels the failure as the tag's kind's.
  const viaTag = withParse("bonus", misbehaving.parse, () => parseAutomation("[EFFECT CHECK: 1 condition, throw]"));
  must(viaTag.errors.length === 0, "the effect reader hands the kind the effect, not the raw text, so `throw` is a descriptor here");
  const broken = withParse("bonus", () => { throw new TypeError("boom"); }, () => parseAutomation("[EFFECT CHECK: 1 condition, aid]"));
  must(/^the "bonus" kind could not read this line: boom/.test(broken.errors[0]?.message), `through a tag: "${broken.errors[0]?.message}"`);
});

check("a kind whose parse returns something that is not an object is an error line", () => {
  const { rules, errors } = withParse("trait", misbehaving.parse, () => parseAutomation("[TRAIT string]\n[TRAIT array]\n[TRAIT fine]"));
  must(rules.length === 1 && rules[0].line === 3, "only the well-behaved line parses");
  must(errors.length === 2, `two errors, got ${errors.length}`);
  must(/returned a string for this line, not an object/.test(errors[0].message), `message 1: "${errors[0].message}"`);
  must(/returned an array for this line, not an object/.test(errors[1].message), `message 2: "${errors[1].message}"`);
});

check("a kind's parse may return nothing; the rule is then its reserved words alone", () => {
  // `quiet` stays registered: the engine section below builds rules of it by hand.
  const quiet = { id: "quiet", parse: () => undefined, summary: () => "quiet" };
  registerKind(quiet);
  const { rules, errors } = withParse("trait", quiet.parse, () => parseAutomation("[TRAIT quiet]"));
  same(errors, [], "errors");
  same(rules, [{ kind: "trait", line: 1, text: "[TRAIT quiet]" }], "rules");
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
  const parsed = withParse("trait", testOnly.parse, () => parseAutomation(`[TRAIT a]\n${UNKNOWN_KIND}: 15 ft\n[TRAIT times=x]\n[TRAIT b]`));
  const entries = ruleEntries(parsed);
  same(entries.map(e => e.line), [1, 2, 3, 4], "line order");
  must(entries[1].error?.startsWith(`unknown rule kind "${UNKNOWN_KIND}" (`) && (entries[1].line === 2) && (entries[1].text === `${UNKNOWN_KIND}: 15 ft`), `an unknown-kind entry: ${JSON.stringify(entries[1])}`);
  must(entries[2].error === "say what is being tested, before any key=value", "a kind's refusal becomes an error entry");
  must(entries[0].kind === "trait" && entries[3].kind === "trait", "parsed rules pass through unchanged");
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
  const { rules, errors } = withParse("trait", args => shapes[args], () => parseAutomation(["nan", "infinite", "fn", "date", "map", "nested", "cycle", "undef"].map(s => `[TRAIT ${s}]`).join("\n")));
  same(errors.map(e => e.message.match(/\((.*)\) \(a bug/)?.[1]), [
    "n is NaN", "n is -Infinity", "f is a function", "when is a Date, not a plain object",
    "m is a Map, not a plain object", "a.b[1].c is a symbol", "self refers back to itself"
  ], "the problems, each with its path");
  must(errors.every(e => /^the "trait" kind returned data that cannot be stored/.test(e.message)), "named as the kind's bug, not the cell's");
  same(rules, [{ keep: 1, deep: { kept: null }, list: [1, null, "two"], kind: "trait", line: 8, text: "[TRAIT undef]" }],
    "an undefined property is left out and an undefined element becomes null, as JSON has them; the rest is stored");
  same(JSON.parse(JSON.stringify(rules[0])), rules[0], "the stored rule equals its own JSON image");
});

check("the bonus kind's data is plain data (its rules travel through the pack sources and Sync content)", () => {
  const { rules, errors } = parseAutomation("[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = trained); FOR: allies 15; IF: ALLIES(>=1, 0); IFT: BLOW; LIMIT: round]");
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
  human: { type: "constellation", slug: "human", name: "Human", category: "Ancestry" },
  guard: { type: "constellation", slug: "guard", name: "Guard", category: "Defense" },
  stealth: { type: "constellation", slug: "stealth", name: "Stealth", category: "Skill" },
  "armored-fighting": { type: "constellation", slug: "armored-fighting", name: "Armored Fighting", category: "Combat Style" },
  lore: { type: "constellation", slug: "lore", name: "Lore", category: "Lore" },
  // 0.15.0: the Cultures' targets.
  diplomacy: { type: "constellation", slug: "diplomacy", name: "Diplomacy", category: "Skill" },
  guile: { type: "constellation", slug: "guile", name: "Guile", category: "Skill" },
  intimidation: { type: "constellation", slug: "intimidation", name: "Intimidation", category: "Skill" },
  origin: { type: "constellation", slug: "origin", name: "Origin" },
  // 0.16.0: the Trained Roots and the Talent Maneuvers.
  acrobatics: { type: "constellation", slug: "acrobatics", name: "Acrobatics", category: "Skill" },
  athletics: { type: "constellation", slug: "athletics", name: "Athletics", category: "Skill" },
  aid: { type: "action", slug: "aid", name: "Aid" },
  search: { type: "action", slug: "search", name: "Search" },
  "steady-the-line": { type: "action", slug: "steady-the-line", name: "Steady the Line", enabled: true },
  oathbound: { type: "action", slug: "oathbound", name: "Oathbound", enabled: true },
  "quick-tongue": { type: "action", slug: "quick-tongue", name: "Quick Tongue", enabled: true }
};
const resolve = name => KNOWN[slugify(plainName(name))] ?? null;

/** A parsed rule without the words that differ between a block and a bare line: the text and the `bare` flag. */
const bare = rule => { const { text, bare: flagged, ...rest } = rule; return rest; };
/** Parse a cell with the resolver and return its rules, failing on any error (a warning is not one). */
const cellRules = (cell) => {
  const parsed = parseAutomation(cell, { resolve, itemName: "test", itemType: "talent" });
  must(parsed.errors.length === 0, `"${cell}" should parse, got: ${parsed.errors.map(e => e.message).join("; ")}`);
  return parsed.rules;
};

check("the bonus kind is registered with its modifiers hook and no aliases", () => {
  const kind = kindOf("bonus");
  must(kind && kind.id === "bonus", "kindOf('bonus')");
  same(kind.aliases, [], "no aliases");
  must(typeof kind.hooks.modifiers === "function", "hooks.modifiers is a function");
  must(kindOf("BONUS") === kind, "the word is case blind through the grammar's lookup");
});

/* The effect line (0.16.0, in a block since 0.17.0; AUTOMATION_GRAMMAR.md section 3): the shared reader every tag's kind uses. */

check("operators: splitOperands splits on the commas outside parentheses and quotes", () => {
  same(splitOperands("1 situation, guard, CLAIM(when trading, or bartering)"), ["1 situation", "guard", "CLAIM(when trading, or bartering)"], "commas inside parentheses stay inside");
  same(splitOperands(" a ,, 'b, c' "), ["a", "'b, c'"], "empties dropped, quotes kept whole");
  throws(() => splitOperands("FOR(allies"), /has no closing \)/, "unclosed paren");
  throws(() => splitOperands("a) b"), /has no \( before it/, "stray close");
});

check("effects: readEffectLine sorts the tag, the value and type, the descriptors and the components, and refuses what a line cannot say", () => {
  const read = readEffectLine("DEF: 1 situation, guard; IFT: blow; FOR: self+allies 0; IF: ALLIES(>= 1, 0); LIMIT: round");
  same([read.tag, read.kind, read.value, read.type, read.descriptors], ["def", "bonus", 1, "situation", ["guard"]], "the head");
  same(read.ops.for, { who: "self+allies", range: 0 }, "FOR");
  same(read.ops.while, { who: "allies", op: ">=", count: 1, range: 0 }, "ALLIES(...), spaces free");
  same(read.ops.against, { threat: "blow", reach: null, check: null, name: null }, "a Threat word, case blind");
  same(read.ops.limit, { per: "round" }, "LIMIT: round");
  same(readEffectLine("IMMUNE: prone; LIMIT: encounter").ops.limit, { per: "encounter" }, "LIMIT: encounter");
  same([readEffectLine("IMMUNE: prone").value, readEffectLine("IMMUNE: prone").descriptors], [null, ["prone"]], "a tag without a value: descriptors alone");
  same(readEffectLine("MARK: enemies, encounter").descriptors, ["enemies", "encounter"], "descriptors by commas");
  same(readEffectLine("DEF: 1 situation, guard").ops.against ?? null, null, "no component, nothing set");
  same(readEffectLine("DEF: 1 situation; IFT: Melee").ops.against, { threat: "blow", reach: "melee", check: null, name: null }, "a reach word is a Blow by reach");
  must(readEffectLine("CHECK: 1 situation; IF: RANK(Origin >= Expert)").ops.when[0].op === ">=", ">= reads");
  same(readEffectLine("CHECK: 1 situation; IF: RANK(roll = untrained)").ops.when, [{ roll: true, op: "=", rank: "untrained" }], "roll is the roll's own rank");
  must(readEffectLine("CHECK: 1 situation; IF: RANK(Human = Trained); IF: RANK(Origin <= Expert)").ops.when.length === 2, "two IFs");
  same(readEffectLine("CHECK: -2 gear, stealth").value, -2, "a negative value");
  same(readEffectLine("CHECK: +2 gear, stealth").value, 2, "a signed positive value");
  throws(() => readEffectLine("CHECK: 1 condition, aid; VISIBLE"), /"VISIBLE" is not a component: after the tag come IF:, IFT:, FOR: and LIMIT:/, "a word that is no component");
  throws(() => readEffectLine("CHECK: 1 condition; IF: SEEN, aid"), /"SEEN, aid" is not a condition/, "a descriptor after a component belongs to the component, and is refused there");
  throws(() => readEffectLine("DEF: 1 situation; FOR: allies; FOR: enemies"), /FOR is given twice/, "FOR twice");
  throws(() => readEffectLine("DEF: 1 situation; LIMIT: round; LIMIT: encounter"), /LIMIT is given twice/, "two limits");
  throws(() => readEffectLine("DEF: 1 situation; FOR:"), /FOR is written `FOR: <who> \[<N>\]`/, "an empty FOR prints its shape");
  throws(() => readEffectLine("DEF: 1 situation; FOR: self 5"), /FOR: self takes no range/, "self with a range");
  throws(() => readEffectLine("DEF: 1 situation; FOR: friends"), /a who is written self, allies, enemies, all or self\+allies/, "a bad who");
  throws(() => readEffectLine("DEF: 1 situation; FOR: allies near"), /a range is written <N>ft, as in 15ft/, "a bad range");
  throws(() => readEffectLine("DEF: 1 situation; IF: ALLIES(1, 0)"), /ALLIES is written `ALLIES\(<op><N>\[, <N>\]\)`/, "a count without a comparison");
  throws(() => readEffectLine("DEF: 1 situation; IF: ALLIES(>=1); IF: ENEMIES(>=1)"), /a count condition is given twice/, "two counts");
  // Since 0.15.0 a word that is no Threat may be a Constellation, so only a resolver can refuse it.
  throws(() => readEffectLine("DEF: 1 situation; IFT: CHECK(Arrows)", { context: { resolve } }), /"Arrows" is not a Threat \(Blow, Blast, Blight, Beguilement, Melee, Ranged\) or a Constellation/, "a bad Threat");
  throws(() => readEffectLine("DEF: 1 situation; IFT: CHECK(Blow)"), /a Threat is written bare: `IFT: BLOW`/, "a Threat inside CHECK(...)");
  throws(() => readEffectLine("DEF: 1 situation; IFT: BLOW; IFT: BLAST"), /a Threat condition is given twice/, "two Threats");
  throws(() => readEffectLine("DEF: 1 situation; IFT: BLOW(melee)"), /BLOW takes nothing in parentheses/, "a Threat with contents");
  throws(() => readEffectLine("DEF: 1 situation; LIMIT: always"), /LIMIT is written `LIMIT: round` or `LIMIT: encounter`/, "LIMIT's words");
  throws(() => readEffectLine("CHECK: 1 situation; IF: RANK(Human is Expert)"), /RANK is written `RANK\(<Constellation> <op> <rank>\)` with =, >= or <=/, "RANK without a comparison");
  throws(() => readEffectLine("CHECK: 1 situation; IF: RANK(Human = Grand)"), /"Grand" is not a rank: write Untrained, Trained, Expert, Master or Legendary/, "a bad rank");
  throws(() => readEffectLine("CHECK: 1 situation; IF: RANK(Lore = Expert)"), /a Lore is the character's own/, "a Lore in RANK");
  throws(() => readEffectLine("CHECK: 1 situation; IF: SEEN(yes)"), /SEEN takes nothing in parentheses/, "a flag with contents");
  throws(() => readEffectLine("CHECK: 1 situation; IF:"), /IF: names a condition/, "an empty IF");
  throws(() => readEffectLine("CHECK: 1 situation; DEF: 1 situation"), /"DEF" is a tag and begins its own line/, "a second tag on the line");
  throws(() => readEffectLine("FOO: 1 situation"), /"FOO" is not an effect tag: write CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE/, "a bad tag");
  throws(() => readEffectLine("CHECK: 1 condition aid"), /the value and its type, then a comma before any descriptor/, "three words before the comma");
  throws(() => readEffectLine("CHECK: 1 condition, (aid"), /a \( has no closing \)/, "an unclosed parenthesis");
});

check("effects: a kind refuses the components its tag has no use for, by the document's names", () => {
  must(bonusError("[EFFECT IMMUNE: prone; IF: CLAIM(when wet)]") === "IMMUNE does not take IF: CLAIM(...)", "a claim on a prevention");
  must(bonusError("[EFFECT MARK: enemies; FOR: allies]") === "MARK does not take FOR", "FOR on a mark");
  must(bonusError("[EFFECT MARK: enemies; IF: SEEN]") === "MARK does not take IF: SEEN", "SEEN on a mark");
  must(bonusError("[EFFECT REROLL: diplomacy; LIMIT: round]") === "REROLL does not take LIMIT", "LIMIT on a reroll");
  must(bonusError("[EFFECT IGNORE: terrain; IFT: MARKED]") === "IGNORE does not take IFT: MARKED", "MARKED on an ignore");
  must(bonusError("[EFFECT IGNORE: terrain; IFT: BLOW]") === "IGNORE does not take IFT: <Threat>", "a Threat on an ignore");
  must(bonusError("[EFFECT IGNORE: terrain; IF: ALLIES(>=1)]") === "IGNORE does not take IF: ALLIES(...)", "a count on an ignore");
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
  const full = bonusRule("[EFFECT CHECK: 1 condition, Aid; IF: RANK(Human = trained)]");
  same(full, {
    value: 1, type: "condition",
    to: { name: "Aid", slug: "aid", type: null },
    when: [{ constellation: "human", name: "Human", op: "=", rank: "trained" }],
    for: null, while: null, against: null, seen: false, limit: null, claim: null, marked: false,
    kind: "bonus", line: 1, text: "[EFFECT CHECK: 1 condition, Aid; IF: RANK(Human = trained)]"
  }, "the full form");

  const plain = bonusRule("[EFFECT CHECK: +1 condition, aid]");
  must(plain.value === 1, "a signed +1 reads as 1");
  must(bonusRule("[EFFECT CHECK: 1 CONDITION, aid]").type === "condition", "the type word is case blind");
  same(plain.to, { name: "aid", slug: "aid", type: null }, "the target as written, slug made, type unknown");
  must(plain.when === null, "no IF is null");

  must(bonusRule("[EFFECT CHECK: -2 GEAR, Stealth]").value === -2, "a negative value");
  must(bonusRule("[EFFECT CHECK: -2 GEAR, Stealth]").type === "gear", "GEAR");
  must(bonusRule("[EFFECT CHECK: 3 situation, Armored Fighting]").type === "situation", "situation");
  same(bonusRule("[EFFECT CHECK: 3 Situation, armored-fighting]").to, { name: "armored-fighting", slug: "armored-fighting", type: null }, "the slug form of a target");
  same(bonusRule("[EFFECT CHECK: 3 Situation, Armored Fighting]").to.slug, "armored-fighting", "a two-word name slugs the same");
  same(bonusRule("[EFFECT DEF: 1 situation]").to, { name: "Defenses", slug: "defenses", type: "scope" }, "DEF with no descriptor is every Defense");
  same(bonusRule("[EFFECT check: 1 situation]").to, { name: "Checks", slug: "checks", type: "scope" }, "CHECK with none is every check, the tag case blind");
  same(bonusRule("[EFFECT ATK: 1 situation]").to.slug, "attacks", "ATK");
  same(bonusRule("[EFFECT INIT: 1 situation]").to.slug, "initiative", "INIT");
  same(bonusRule("[EFFECT DEF: 1 situation, guard]").to, { name: "Guard", slug: "guard", type: "constellation" }, "DEF with a Defense names it, no resolver needed");

  const glyphed = bonusRule("[EFFECT CHECK: 1 condition, Aid ❶ (⓿↺)]");
  must(glyphed.to.slug === "aid", `a Maneuver's glyphs never reach the slug, got "${glyphed.to.slug}"`);

  const mixed = bonusRule("[EFFECT Check: 1 CONDITION,Aid;if: rank(Human=Expert).]");
  same(mixed.when, [{ constellation: "human", name: "Human", op: "=", rank: "expert" }], "spaces free, the component and the condition case blind, a trailing period tolerated");
  must(mixed.kind === "bonus", "the tag names the kind");

  for (const rank of ["Untrained", "Trained", "Expert", "Master", "Legendary", "legendary"]) {
    must(bonusRule(`[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = ${rank})]`).when[0].rank === rank.toLowerCase(), `rank ${rank}`);
  }
  // The 0.13.0 "colon optional" reading went with the form: a tag is always followed by its colon.

  const closeRanks = bonusRule("[EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]");
  same([closeRanks.for, closeRanks.while, closeRanks.against], [{ who: "self+allies", range: 0 }, { who: "allies", op: ">=", count: 1, range: 0 }, { threat: "blow", reach: null, check: null, name: null }], "Close Ranks' components");
  const torch = bonusRule("[EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]");
  same([torch.for, torch.seen, torch.when, torch.limit], [{ who: "allies", range: 15 }, true, [{ trait: "fear", name: "Fear" }], { per: "round" }], "Torchbearer's components (the Rally Aura, 0.14.0)");
  same(bonusRule("[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]").when, [{ roll: true, op: "=", rank: "untrained" }], "Jack of All Trades' condition");
  must(bonusRule("[EFFECT DEF: 1 situation, guard]").seen === false, "no SEEN is false");
});

check("effects: SEEN and TRAIT(...) (0.14.0)", () => {
  same(readEffectLine("DEF: 1 situation; IF: seen").ops.seen, true, "SEEN, case blind");
  same(readEffectLine("DEF: 1 situation; IF: SEEN()").ops.seen, true, "SEEN with empty parentheses");
  throws(() => readEffectLine("DEF: 1 situation; IF: SEEN(allies)"), /SEEN takes nothing in parentheses/, "SEEN with contents");
  must(bonusError("[EFFECT MARK: enemies; IF: SEEN]") === "MARK does not take IF: SEEN", "a kind without SEEN");
  same(readEffectLine("DEF: 1 situation; IFT: TRAIT(Fear)").ops.when, [{ trait: "fear", name: "Fear" }], "a trait condition");
  same(readEffectLine("DEF: 1 situation; IFT: trait(Thrown 20 ft)").ops.when, [{ trait: "thrown", name: "Thrown 20 ft" }], "the key is the first word");
  throws(() => readEffectLine("DEF: 1 situation; IFT: TRAIT"), /TRAIT is written `TRAIT\(<trait>\)`/, "TRAIT without a trait");
  throws(() => readEffectLine("DEF: 1 situation; IFT: TRAIT()"), /is not a trait word/, "an empty trait");
  // The 0.13.0 "IF(Trait>=Fear)" refusal has no twin: TRAIT(...) takes the trait alone, no comparison.
  must(hasTrait(["Finesse", "Thrown 20 ft"], "thrown") && !hasTrait(["Finesse"], "fear") && !hasTrait(null, "fear") && !hasTrait(["Fear"], ""), "hasTrait by first word");
  must(traitKey("Thrown 20 ft") === "thrown" && traitKey(" Fear ") === "fear" && traitKey("Deadly d8") === "deadly" && traitKey("Unwieldy [2]") === "unwieldy", "traitKey");
  must(needsMoment({ seen: true }) && needsMoment({ when: [{ trait: "fear" }] }) && !needsMoment({ when: [{ constellation: "human", rank: "expert" }] }), "SEEN and a trait condition need the moment");
  // The rule as the parser stores it reads back in the summary.
  must(summarize(bonusRule("[EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]"))
    === "+1 Situation bonus to Defenses, against an attack with the Fear trait, for allies within 15 ft who can see you, the first time each round", "the Rally Aura's summary");
  must(summarize(bonusRule("[EFFECT DEF: 1 situation, guard; IF: SEEN]")) === "+1 Situation bonus to Guard, who can see you", "SEEN alone");
});

check("bonus: Humanity's four blocks parse to four rules, one rank each", () => {
  const cell = [
    "[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = trained)]",
    "[EFFECT CHECK: 2 condition, aid; IF: RANK(Human = expert)]",
    "[EFFECT CHECK: 3 condition, aid; IF: RANK(Human = master)]",
    "[EFFECT CHECK: 4 condition, aid; IF: RANK(Human = legendary)]"
  ].join("\n");
  const { rules, errors, warnings } = parseAutomation(cell, { resolve, itemName: "Humanity", constellation: "Human", itemType: "talent" });
  same(errors, [], "errors");
  same(warnings, [], "no warning: the blocks are the form");
  same(rules.map(r => [r.value, r.when[0].rank, r.to.type, r.line]), [[1, "trained", "action", 1], [2, "expert", "action", 2], [3, "master", "action", 3], [4, "legendary", "action", 4]], "the rules");
});

check("bonus: with a resolver the target and the condition carry the resolved type, slug and name", () => {
  const rule = bonusRule("[EFFECT CHECK: 1 condition, aid ❶; IF: RANK(human = Expert)]", { resolve });
  same(rule.to, { name: "Aid", slug: "aid", type: "action" }, "a Maneuver target");
  same(rule.when, [{ constellation: "human", name: "Human", op: "=", rank: "expert" }], "the condition's Constellation");
  same(bonusRule("[EFFECT CHECK: 2 situation, STEALTH]", { resolve }).to, { name: "Stealth", slug: "stealth", type: "constellation" }, "a Constellation target");
  same(bonusRule("[EFFECT CHECK: 1 gear, armored-fighting]", { resolve }).to, { name: "Armored Fighting", slug: "armored-fighting", type: "constellation" }, "a Constellation by slug");
  same(bonusRule("[EFFECT DEF: 1 gear, GUARD]", { resolve }).to, { name: "Guard", slug: "guard", type: "constellation" }, "a Defense, named by the resolver");
});

check("bonus: the refusals, each with a message the designer can act on", () => {
  must(/a bonus of 0 does nothing/.test(bonusError("[EFFECT CHECK: 0 condition, aid]")), "zero");
  must(/a bonus of 0 does nothing/.test(bonusError("[EFFECT CHECK: +0 condition, aid]")), "plus zero");
  must(/write Condition, not status: the book renamed the types in v3\.3/.test(bonusError("[EFFECT CHECK: 1 status, aid]")), "status");
  must(/write Situation, not circumstance/.test(bonusError("[EFFECT CHECK: 1 Circumstance, aid]")), "circumstance");
  must(/write Gear, not item/.test(bonusError("[EFFECT CHECK: 1 item, aid]")), "item");
  must(/no Talent bonus is untyped; name situation, condition or gear/.test(bonusError("[EFFECT CHECK: 1 untyped, aid]")), "untyped");
  must(/no Talent bonus is untyped/.test(bonusError("[EFFECT CHECK: 1, aid]")), "no type at all");
  must(/"Fancy" is not a bonus type: write situation, condition or gear/.test(bonusError("[EFFECT CHECK: 1 Fancy, aid]")), "an unknown type word");
  const shape = bonusError("[EFFECT CHECK: condition, aid]");
  must(/CHECK is written `CHECK: <value> <type>, <descriptor>`/.test(shape) && /a signed whole number first, not "condition"/.test(shape), `no value prints the shape: "${shape}"`);
  must(/CHECK is written/.test(bonusError("[EFFECT CHECK:]")), "an empty line prints the shape");
  must(/CHECK takes one descriptor, a Constellation or a Maneuver, not 2/.test(bonusError("[EFFECT CHECK: 1 condition, aid, extra]")), "a second descriptor (the 0.13.0 fourth argument)");
  must(/DEF takes one descriptor, a Defense, not 2/.test(bonusError("[EFFECT DEF: 1 condition, guard, evade]")), "two Defenses");
  must(/"checks" is a scope word; CHECK takes a Constellation or a Maneuver, or no descriptor for every check/.test(bonusError("[EFFECT CHECK: 1 condition, checks]")), "a scope word as a descriptor");
  must(/a signed whole number first, not "one condition"/.test(bonusError("[EFFECT CHECK: one condition, aid]")), "a non-number");
  must(/the value and its type, then a comma before any descriptor/.test(bonusError("[EFFECT CHECK: 1 condition aid]")), "no comma before the descriptor");
  must(bonusError("bonus: +1 Condition to Aid if Human is Expert") === LEGACY_REFUSAL, "the 0.10.0 prose form is refused as the retired `bonus:` line is");
  must(/"Grand" is not a rank/.test(bonusError("[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = Grand)]")), "a bad rank word");
  // The 0.13.0 "bonus does not take VISIBLE / DIFFERENT" have no twin: neither word is a component or a condition.
  must(/"VISIBLE" is not a component/.test(bonusError("[EFFECT CHECK: 1 condition, aid; VISIBLE]")), "a word that is no component");
  must(/"DIFFERENT" is not a condition/.test(bonusError("[EFFECT CHECK: 1 condition, aid; IF: DIFFERENT]")), "a word that is no condition");
});

check("bonus: the refusals a resolver makes possible", () => {
  must(bonusError("[EFFECT CHECK: 1 condition, Aidd]", { resolve }) === '"Aidd" names no Constellation or Maneuver', "an unknown target");
  must(bonusError("[EFFECT DEF: 1 condition, guard; IF: RANK(Aid = expert)]", { resolve }) === '"Aid" is not a Constellation', "a Maneuver in the condition");
  must(bonusError("[EFFECT DEF: 1 condition, guard; IF: RANK(Nobody = expert)]", { resolve }) === '"Nobody" is not a Constellation', "nothing in the condition");
  must(bonusError("[EFFECT CHECK: 1 condition, Lore]", { resolve }) === "a Lore is the character's own; a bonus cannot name it", "the Lore template");
  must(bonusError("[EFFECT CHECK: 1 condition, Lore]") === "a Lore is the character's own; a bonus cannot name it", "the Lore template, without a resolver");
  must(bonusError("[EFFECT CHECK: 1 condition, Lore (Serrovane)]") === "a Lore is the character's own; a bonus cannot name it", "a Lore instance");
  must(bonusError("[EFFECT DEF: 1 condition, diplomacy]", { resolve }) === '"diplomacy" is not a Defense: DEF takes evade, guard, endure or awareness, or none for all four', "a Skill on DEF");
});

check("bonus: the summary", () => {
  must(summarize(bonusRule("[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = expert)]", { resolve })) === "+1 Condition bonus to Aid, while Human is Expert", "the full form");
  must(summarize(bonusRule("[EFFECT CHECK: -2 condition, Stealth]")) === "-2 Condition penalty to Stealth", "a penalty, no components");
  must(summarize(bonusRule("[EFFECT DEF: 3 gear, guard]", { resolve })) === "+3 Gear bonus to Guard", "a bare value prints signed");
  must(summarize(bonusRule("[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]")) === "+1 Situation bonus to Checks, while the roll's rank is Untrained", "the roll's rank");
  must(summarize(bonusRule("[EFFECT DEF: 1 situation; FOR: allies 15; LIMIT: round]")) === "+1 Situation bonus to Defenses, for allies within 15 ft, the first time each round", "FOR and LIMIT: round");
  must(summarize(bonusRule("[EFFECT DEF: 1 situation, guard; IFT: MELEE; IF: RANK(Origin >= Expert)]")) === "+1 Situation bonus to Guard, while Origin is at least Expert, against a melee Blow", ">= and a reach");
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
  "[EFFECT CHECK: 1 condition, aid; IF: RANK(Human = trained)]",
  "[EFFECT CHECK: 2 condition, aid; IF: RANK(Human = expert)]",
  "[EFFECT CHECK: 3 condition, aid; IF: RANK(Human = master)]",
  "[EFFECT CHECK: 4 condition, aid; IF: RANK(Human = legendary)]"
].join("\n"));
const sneaky = talentWith("Sneaky ❶", "[EFFECT CHECK: 2 situation, stealth]");
const braced = talentWith("Braced", "[EFFECT DEF: 1 gear, guard; IF: RANK(Human = expert)]");
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
    hint: "Humanity: this bonus applies to checks to Aid. Tick it if this roll is one.",
    ticked: false
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
  const driven = bonusRule("[POINT Calling]");
  same(driven, { n: 1, scope: "Calling", different: false, when: null, kind: "grant", line: 1, text: "[POINT Calling]" }, "Driven");
  same(toGrantField(driven), { n: 1, mode: "any", scope: "Calling", constellation: "" }, "the wizard's field");
  same(toGrantField(bonusRule("[POINT Opening]")), { n: 1, mode: "open", scope: "anywhere", constellation: "" }, "Opening is a Root anywhere");
  same(toGrantField(bonusRule("[POINT Comet]")), { n: 1, mode: "any", scope: "anywhere", constellation: "" }, "a Comet goes anywhere");
  same(toGrantField(bonusRule("[POINT 2 Skills different]")), { n: 2, mode: "different", scope: "Skill", constellation: "" }, "different, and a plural reads");
  same(bonusRule("[POINT combat style]").scope, "Combat Style", "a two-word scope, case blind");
  same(bonusRule("[POINT 1 Skill]").n, 1, "an explicit 1");
  // The 0.13.0 `grant: 1, Skill, IF(Origin=Expert)` has no twin: a POINT block carries no condition, so `when` is null.
  same(bonusRule("[POINT Skill]").when, null, "no condition on a point");
  must(summarize(bonusRule("[POINT Calling]")) === "1 Calling Talent Point", "the summary");
  must(summarize(bonusRule("[POINT 2 Skill different]")) === "2 Skill Talent Points, each in a different Constellation", "the plural and different");
  must(kindOf("grant").hooks && Object.keys(kindOf("grant").hooks).length === 0, "no hook: the wizard consumes it");
});

check("grant: the refusals", () => {
  must(/POINT is written `\[POINT <N> <Scope> \[different\]\]`/.test(bonusError("[POINT]")), "nothing");
  must(/POINT is written/.test(bonusError("[POINT 2]")), "a number and no scope");
  must(/a grant is a whole number of points, 1 or more/.test(bonusError("[POINT 0 Skill]")), "zero");
  must(/"one Skill" is not a grant scope/.test(bonusError("[POINT one Skill]")), "a word for the number reads as a scope, and is none");
  must(/"Weapon" is not a grant scope: write Opening, Calling, Skill, Lore, Defense, Combat Style or Comet/.test(bonusError("[POINT Weapon]")), "a bad scope");
  must(/different needs 2 or more points/.test(bonusError("[POINT Skill different]")), "different on one point");
  // The 0.13.0 "grant does not take FOR" has no twin: a block carries no component; the whole line is the retired form.
  must(bonusError("grant: 1, Skill, FOR(allies)") === LEGACY_REFUSAL, "the retired line is refused whole");
});

/* -------------------------------------------- */
/*  The aura kind (0.13.0)                      */
/* -------------------------------------------- */

check("aura: the forms, the field the canvas reads, the summary", () => {
  const torch = bonusRule("[AURA 15 allies]");
  same(torch, { range: 15, affects: "allies", kind: "aura", line: 1, text: "[AURA 15 allies]" }, "Torchbearer");
  same(toAuraField(torch), { range: 15, affects: "allies" }, "system.aura");
  must(!("visible" in toAuraField(torch)), "no `visible`: every ring is preview-only since 0.17.0");
  same(toAuraField(bonusRule("[AURA 30 feet ALL]")), { range: 30, affects: "all" }, "feet spelled out, case blind");
  same(bonusRule("[AURA 6 ft, enemies]").affects, "enemies", "enemies, a comma tolerated");
  must(summarize(torch) === "a 15 ft ring about allies", "the summary");
  must(summarize(bonusRule("[AURA 30ft all]")) === "a 30 ft ring about all", "ft against the number");
  must(Object.keys(kindOf("aura").hooks).length === 0, "no hook: the ring is a drawing");
});

check("aura: the retired `visible` word is refused (warned in 0.17.0, refused since 0.18.0)", () => {
  const message = "[AURA ... visible]: every ring is preview-only and the Auras window shows one; drop the word";
  for (const word of ["visible", "VISIBLE", "pinned"]) {
    const parsed = parseAutomation(`[AURA 15 allies ${word}]`);
    same(parsed.rules, [], `${word}: no rule`);
    same(parsed.errors, [{ line: 1, text: `[AURA 15 allies ${word}]`, message }], `${word}: the one error, under the block's text`);
    same(parsed.warnings, [], `${word}: no warning beside it`);
  }
  same(parseAutomation("[AURA 15 allies]").errors, [], "no word, no error");
  same(parseAutomation("[TRAIT Human][AURA 15 allies visible]").errors.map(e => e.text), ["[AURA 15 allies visible]"], "the error names its block, not the line, and the trait beside it still parses");
  must(parseAutomation("[TRAIT Human][AURA 15 allies visible]").rules.length === 1, "the trait beside it parses");
});

check("aura: a ring carries its effect after a semicolon, the ring as the FOR (0.18.0)", () => {
  const nested = "[AURA 15 allies; DEF: 1 situation; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]";
  const rules = cellRules(nested);
  must(rules.length === 2, `two rules from one block, got ${rules.length}`);
  same(bare(rules[0]), { range: 15, affects: "allies", kind: "aura", line: 1 }, "the ring first");
  same(bare(rules[1]), bare(cellRules("[EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]")[0]), "the effect equals the two-block form's, FOR from the ring");
  must(rules.every(r => r.text === nested), "both rules stand under the block's text");
  same(bare(cellRules("[AURA 10 enemies; IMMUNE: prone]")[1]).for, { who: "enemies", range: 10 }, "an enemies ring reaches enemies within 10");
  same(bare(cellRules("[AURA 30 all; ATK: 1 situation]")[1]).for, { who: "all", range: 30 }, "an all ring reaches everyone within 30");
  must(cellRules("[AURA 15 allies; DEF: 1 situation][AURA 15 allies; ATK: 1 situation]").length === 4, "two blocks on one line, two rules each");
  must(cellRules("[AURA 15 allies]").length === 1, "a ring alone is one rule");
  {
    // The ring parses; the effect behind it is the error, so the block reads as a ring plus a red line.
    const parsed = parseAutomation("[AURA 15 allies; DEF: 1 situation; FOR: allies 15]", { resolve });
    must((parsed.rules.length === 1) && (parsed.rules[0].kind === "aura"), "the ring stands");
    must((parsed.errors.length === 1) && /the ring is the FOR/.test(parsed.errors[0].message), "an explicit FOR inside the block is refused");
  }
  must(/after the ring, an AURA block carries one effect/.test(parseAutomation("[AURA 15 allies; nonsense]", { resolve }).errors[0]?.message ?? ""), "what follows the ring must be an effect (the ring itself still parses)");
  must(/^MARK does not take FOR$/.test(parseAutomation("[AURA 15 allies; MARK: enemies]", { resolve }).errors[0]?.message ?? ""), "a tag that takes no FOR refuses the ring's (the ring itself parses)");
  must(/^AURA is written/.test(bonusError("[AURA 15; DEF: 1 situation]")), "the ring is still checked first, and a bad ring reads nothing behind it");
  must(summarize(rules[1]) === summarize(cellRules("[EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]")[0]), "the As read line is the same");
});

check("aura: the refusals", () => {
  must(/AURA is written `\[AURA <N> <who>\]`/.test(bonusError("[AURA 15]")), "one word");
  must(/AURA is written/.test(bonusError("[AURA]")), "nothing");
  must(/AURA is written/.test(bonusError("[AURA 15 allies wide]")), "a third word that is not the retired one");
  must(/a range is written <N>ft, as in 15ft/.test(bonusError("[AURA far allies]")), "a bad range");
  must(/1 ft or more/.test(bonusError("[AURA 0 allies]")), "zero feet");
  must(/a ring is about allies, enemies or all, not "friends"/.test(bonusError("[AURA 15 friends]")), "a bad who");
  // The 0.13.0 "aura does not take FOR / IF" have no twin: a block carries no component; the whole line is the retired form.
  must(bonusError("aura: 15ft, allies, FOR(allies)") === LEGACY_REFUSAL, "the retired line is refused whole");
});

/* -------------------------------------------- */
/*  The prevent kind (0.13.0)                   */
/* -------------------------------------------- */

check("prevent: the forms and the summary", () => {
  const stubborn = bonusRule("[EFFECT IMMUNE: prone; LIMIT: encounter]");
  same(stubborn, { effect: "prone", when: null, for: null, while: null, against: null, seen: false, limit: { per: "encounter" }, marked: false, kind: "prevent", line: 1, text: "[EFFECT IMMUNE: prone; LIMIT: encounter]" }, "Stubborn Footing");
  const steady = bonusRule("[EFFECT IMMUNE: expose; FOR: allies 0]");
  same([steady.effect, steady.for], ["expose", { who: "allies", range: 0 }], "Steady the Line");
  same(bonusRule("[EFFECT IMMUNE: off-guard]").effect, "offGuard", "a two-word Condition, hyphen and case blind");
  same(bonusRule("[EFFECT IMMUNE: OffGuard]").effect, "offGuard", "by its id");
  same(bonusRule("[EFFECT IMMUNE: Exposed]").effect, "expose", "Exposed reads as Expose");
  same(bonusRule("[EFFECT IMMUNE: frightened; IF: RANK(Origin >= expert); IFT: BEGUILEMENT]").against, { threat: "beguilement", reach: null, check: null, name: null }, "a Threat word");
  must(summarize(stubborn) === "Prone does not land, once each encounter", "the summary");
  must(summarize(steady) === "Expose does not land, for allies within 0 ft", "FOR in the summary");
  must(typeof kindOf("prevent").hooks.prevent === "function", "the prevent hook");
});

check("prevent: the refusals", () => {
  must(/"Sleepy" is not a Condition or Expose/.test(bonusError("[EFFECT IMMUNE: Sleepy]")), "a word that is no Condition");
  must(/IMMUNE is written `IMMUNE: <Condition or expose>`, as in `IMMUNE: prone` \(2 descriptors given, 1 wanted\)/.test(bonusError("[EFFECT IMMUNE: prone, grabbed]")), "two descriptors");
  must(/0 descriptors given, 1 wanted/.test(bonusError("[EFFECT IMMUNE:]")), "nothing");
  must(/"Exposed Head" is not a Condition or Expose/.test(bonusError("[EFFECT IMMUNE: Exposed Head]")), "a Zone's mirror status is not an effect");
  must(bonusError("[EFFECT IMMUNE: prone; IF: CLAIM(when wet)]") === "IMMUNE does not take IF: CLAIM(...)", "a component it lacks");
  // The 0.13.0 "prevent does not take VISIBLE" has no twin: VISIBLE is no component; the whole line is the retired form.
  must(bonusError("prevent: Prone, VISIBLE") === LEGACY_REFUSAL, "the retired line is refused whole");
});

check("rulePreventers: Stubborn Footing stops Prone once an encounter on its owner, and nothing else", () => {
  const stubborn = talentWith("Stubborn Footing", "[EFFECT IMMUNE: prone; LIMIT: encounter]");
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
  const steady = { ...talentWith("Steady the Line ❶↺", "[EFFECT IMMUNE: expose; FOR: allies 0]"), id: "stl00001" };
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
  const rule = bonusRule("[EFFECT CHECK: 2 condition, aid; IF: RANK(Origin = expert)]", { resolve: resolver });
  same(rule.when, [{ constellation: "origin", name: "Origin", op: "=", rank: "expert" }], "the Origin condition");
  throws(() => bonusRule("[EFFECT CHECK: 1 situation, aid; IF: RANK(Archery = expert)]", { resolve: resolver }), /is a group and has no rank of its own; test Ranged instead/, "a group is refused");
  must(bonusRule("[EFFECT CHECK: 1 situation, Archery]", { resolve: resolver }).to.slug === "archery", "a group is still a fine target for a bonus");
  // The hook reads the rank through `proficiency("origin")`, which the character model answers
  // from the virtual Origin; the fake actor answers it like any slug.
  const humanityOrigin = talentWith("Humanity", "[EFFECT CHECK: 2 condition, aid; IF: RANK(Origin = expert)]", { resolve: resolver });
  const roll = { kind: "check", slug: "diplomacy", item: aidItem };
  same(ruleModifiers(rulesActor([humanityOrigin], { origin: "expert" }), roll).applied.map(m => m.value), [2], "fires at Origin Expert");
  same(ruleModifiers(rulesActor([humanityOrigin], { origin: "trained", human: "expert" }), roll).applied, [], "and not from the Human sky's own rank");
  const atLeast = talentWith("Steady", "[EFFECT DEF: 1 situation, guard; IF: RANK(Origin >= expert)]", { resolve: resolver });
  const guard = { kind: "defense", slug: "guard", item: null };
  same(ruleModifiers(rulesActor([atLeast], { origin: "legendary" }), guard).applied.map(m => m.value), [1], ">= fires above the rank");
  same(ruleModifiers(rulesActor([atLeast], { origin: "trained" }), guard).applied, [], "and not below it");
});

check("bonus hook: one Talent's lines on one target share a source, two Talents do not", () => {
  // Two blocks on one line, as a cell may write them.
  const twice = talentWith("Twice", "[EFFECT CHECK: 1 condition, aid][EFFECT CHECK: 3 condition, aid]");
  const other = talentWith("Other", "[EFFECT CHECK: 1 condition, aid]");
  const { applied } = ruleModifiers(rulesActor([twice, other]), { kind: "check", slug: "diplomacy", item: aidItem });
  same(applied.map(m => m.source), ["rule:Twice:aid", "rule:Twice:aid", "rule:Other:aid"], "the sources");
  must(resolveModifiers(applied).total === 4, "+3 (the higher of Twice's) +1 (Other's) is 4");
});

check("bonus hook: a 0.10.0 rule stored on an owned copy (when as one object) still reads", () => {
  const old = { type: "talent", name: "Humanity", system: { rules: [{ kind: "bonus", line: 1, text: "old", value: 1, type: "condition", to: { name: "Aid", slug: "aid", type: "action" }, when: { constellation: "human", name: "Human", rank: "trained" } }] } };
  same(ruleModifiers(rulesActor([old], { human: "trained" }), { kind: "check", slug: "diplomacy", item: aidItem }).applied.map(m => m.value), [1], "equality assumed");
});

/* The operators in play (0.13.0): scope targets, the roll's rank, the scene, the Threat, the marks. */

const jack = talentWith("Jack of Trades", "[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]");
const closeRanks = talentWith("Close Ranks", "[EFFECT DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)]", { resolve });
const torchbearer = talentWith("Torchbearer Human", "[EFFECT DEF: 1 situation; FOR: allies 15; LIMIT: round]");
const allDefenses = talentWith("Stout", "[EFFECT DEF: 1 gear]");

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
  const rally = talentWith("Torchbearer Human", "[AURA 15 allies]\n[EFFECT DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round]");
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
  const ward = { ...talentWith("Steadying Word ❶↺", "[EFFECT IMMUNE: expose; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear)]"), id: "word0001" };
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
  const once = talentWith("Second Wind", "[EFFECT CHECK: 2 situation; LIMIT: encounter]");
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
/*  0.15.0: the Cultures' kinds and operators     */
/* -------------------------------------------- */

check("effects: CLAIM(...), MARKED, RESULT(...) and CHECK(<Constellation>) (0.15.0)", () => {
  same(readEffectLine("CHECK: 1 condition; IF: CLAIM(when trading)").ops.claim, { text: "when trading" }, "CLAIM's text");
  same(readEffectLine("CHECK: 1 condition; IF: claim(noticing hidden clauses, traps or altered terms in an agreement)").ops.claim, { text: "noticing hidden clauses, traps or altered terms in an agreement" }, "commas inside CLAIM belong to it");
  throws(() => readEffectLine("CHECK: 1 condition; IF: CLAIM"), /CLAIM is written/, "a bare CLAIM");
  throws(() => readEffectLine("CHECK: 1 condition; IF: CLAIM()"), /CLAIM is written/, "an empty CLAIM");
  throws(() => readEffectLine("CHECK: 1 condition; IF: CLAIM(a); IF: CLAIM(b)"), /CLAIM is given twice/, "two claims");
  must(bonusError("[EFFECT IMMUNE: prone; IF: CLAIM(a)]") === "IMMUNE does not take IF: CLAIM(...)", "a kind without CLAIM");
  same(readEffectLine("ATK: 1 condition; IFT: MARKED").ops.marked, true, "MARKED");
  throws(() => readEffectLine("ATK: 1 condition; IFT: MARKED(enemies)"), /MARKED takes nothing in parentheses/, "MARKED with contents");
  same(readEffectLine("REROLL: diplomacy; IF: RESULT(Critical Failure)").ops.when, [{ outcome: "critFail", name: "Critical Failure" }], "a degree condition");
  same(readEffectLine("REROLL:; IF: result(success)").ops.when, [{ outcome: "success", name: "Success" }], "case and spaces free");
  same(readEffectLine("REROLL:; IF: RESULT(CriticalSuccess)").ops.when[0].outcome, "critSuccess", "squeezed");
  throws(() => readEffectLine("REROLL:; IF: RESULT(Grand)"), /"Grand" is not a Degree: write Critical Success, Success, Failure or Critical Failure/, "a bad degree");
  throws(() => readEffectLine("REROLL:; IF: RESULT"), /RESULT is written `RESULT\(<degree>\)`/, "RESULT without a degree");
  // The 0.13.0 "IF(Outcome>=Success)" refusal has no twin: RESULT(...) takes the degree alone, no comparison.
  same(readEffectLine("DEF: 1 condition; IFT: CHECK(Intimidation)", { context: { resolve } }).ops.against, { threat: null, reach: null, check: "intimidation", name: "Intimidation" }, "a Constellation in CHECK(...), resolved");
  same(readEffectLine("DEF: 1 condition; IFT: CHECK(Intimidation)").ops.against, { threat: null, reach: null, check: "intimidation", name: "Intimidation" }, "a Constellation in CHECK(...), no resolver");
  same(readEffectLine("DEF: 1 condition; IFT: BLOW", { context: { resolve } }).ops.against, { threat: "blow", reach: null, check: null, name: null }, "a Threat still reads");
  throws(() => readEffectLine("DEF: 1 condition; IFT: CHECK(Aid)", { context: { resolve } }), /"Aid" is not a Threat .* or a Constellation/, "a Maneuver is neither");
  throws(() => readEffectLine("DEF: 1 condition; IFT: CHECK(Lore)", { context: { resolve } }), /a Lore is the character's own/, "a Lore");
  throws(() => readEffectLine("DEF: 1 condition; IFT: CHECK"), /CHECK is written `CHECK\(<Constellation>\)`/, "CHECK without a Constellation");
  must(againstHolds({ against: { check: "intimidation" } }, { threat: "check", melee: false, check: "intimidation" }) && !againstHolds({ against: { check: "intimidation" } }, { threat: "check", check: "guile" }) && !againstHolds({ against: { check: "intimidation" } }, { threat: "blow", melee: true }) && againstHolds({ against: null }, null) && againstHolds({ against: { threat: "blow", reach: "melee" } }, { threat: "blow", melee: true }), "againstHolds");
  must(needsMoment({ claim: { text: "x" } }) && needsMoment({ marked: true }) && needsMoment({ when: [{ outcome: "critFail" }] }), "a claim, a mark and a degree need the moment");
});

check("bonus: CLAIM is offered, armed comes ticked, and on a Threshold read applies only when armed", () => {
  const serro = talentWith("Serrovanian", "[EFFECT CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)]", { resolve });
  const actor = rulesActor([serro]);
  const check1 = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained" });
  same(check1.applied, [], "nothing applied unasked");
  same(check1.offered.map(o => [o.label, o.value, o.type, o.ticked, o.key, o.hint]), [["Serrovanian", 1, "condition", false, `claim-${serro.name}-1`, "Serrovanian: +1 Condition bonus toward someone who shares your Culture. Tick it if this roll is one."]], "offered unticked with the hint");
  must(!("mark" in check1.offered[0]), "an unarmed claim carries no mark");
  same(ruleModifiers(actor, { kind: "check", slug: "guile", item: null, rank: "trained" }).offered, [], "Diplomacy only");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, read: true, momentOnly: true }).applied, [], "a Threshold read, unarmed: nothing");
  // Armed: ticked in the dialog, applied on a read, and the mark that spends it rides along.
  actor.flags = { starwrought: { rules: { armed: { [serro.name]: { at: 1 } } } } };
  const armed = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained" });
  same(armed.offered.map(o => [o.ticked, o.mark]), [[true, { key: serro.name, per: "claim" }]], "armed: ticked, with the spend mark");
  same(armed.marks, [], "an offer's mark is the dialog's to file, not the engine's");
  const read = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained", read: true });
  same(read.applied.map(m => [m.label, m.value]), [["Serrovanian", 1]], "a read with the claim armed: applied");
  same(read.marks, [{ key: serro.name, per: "claim" }], "and spent once the read resolves");
  same(ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained", staticOnly: true }).offered, [], "the sheet's pass never offers");
  must(summarize(bonusRule("[EFFECT CHECK: 2 situation, Guile; IF: CLAIM(when trading)]")) === "+2 Situation bonus to Guile, when you claim it (when trading)", "the summary");
});

check("bonus: MARKED applies against the marked creature alone, on a Defense and on a pairing", () => {
  const oath = talentWith("Oathbound ❶", "[EFFECT MARK: enemies, encounter]\n[EFFECT ATK: 1 condition; IFT: MARKED]\n[EFFECT DEF: 1 condition; IFT: MARKED]", { resolve });
  const actor = rulesActor([oath]);
  const bandit = { uuid: "Actor.bandit", tokenUuid: "Scene.s.Token.b", name: "Bandit" };
  const wolf = { uuid: "Actor.wolf", tokenUuid: "Scene.s.Token.w", name: "Wolf" };
  const encounter = { combat: "c1", round: 1 };
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: bandit, encounter, momentOnly: true }).applied, [], "no mark yet");
  actor.flags = { starwrought: { rules: { marks: { [oath.name]: { uuid: "Actor.bandit", tokenUuid: "Scene.s.Token.b", name: "Bandit", combat: "c1" } } } } };
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: bandit, encounter, momentOnly: true }).applied.map(m => [m.label, m.value, m.type]), [["Oathbound", 1, "condition"]], "a Defense against the Bandit");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: wolf, encounter, momentOnly: true }).applied, [], "not against the Wolf");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: null, encounter, momentOnly: true }).applied, [], "nobody known: nothing");
  same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, other: null, encounter }).applied, [], "the blind die knows nobody");
  same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, other: bandit, encounter, pairingOnly: true }).applied.map(m => m.label), ["Oathbound"], "the pairing against the Bandit");
  same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, other: wolf, encounter, pairingOnly: true }).applied, [], "the pairing against the Wolf");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: bandit, encounter: { combat: "c2", round: 1 }, momentOnly: true }).applied, [], "another encounter: the mark is stale");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: { uuid: null, tokenUuid: "Scene.s.Token.b" }, encounter, momentOnly: true }).applied.length, 1, "the token alone matches");
  // A mark made outside an encounter holds while none runs, and no longer once one starts.
  actor.flags.starwrought.rules.marks[oath.name].combat = null;
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: bandit, encounter: { combat: null, round: 0 }, momentOnly: true }).applied.length, 1, "outside, still held");
  same(ruleModifiers(actor, { kind: "defense", slug: "guard", item: null, other: bandit, encounter, momentOnly: true }).applied, [], "an encounter began: gone");
  must(markedHolds({ marked: false }, {}, {}), "a rule without MARKED holds");
  must(summarize(bonusRule("[EFFECT ATK: 1 condition; IFT: MARKED]")) === "+1 Condition bonus to Attacks, against the creature you marked", "the summary");
  throws(() => bonusRule("[EFFECT CHECK: 1 condition, aid; IF: RESULT(success)]"), /IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die/, "a bonus refuses a degree");
  must(/IF\(Outcome=\.\.\.\) is only read/.test(bonusError("[EFFECT IMMUNE: prone; IF: RESULT(success)]")), "so does a prevent");
  must(/IF\(Outcome=\.\.\.\) is only read/.test(bonusError("[EFFECT MARK: enemies; IF: RESULT(success)]")), "and a mark");
});

check("bonus: Speed is a scope read with kind move, and Iron Etiquette's IFT: CHECK(intimidation)", () => {
  const river = talentWith("Riverfoot", "[EFFECT SPEED: 1 situation; LIMIT: encounter]", { resolve });
  const actor = rulesActor([river]);
  const encounter = { combat: "c1", round: 1 };
  same(bonusRule("[EFFECT SPEED: 1 situation]").to, { name: "Speed", slug: "speed", type: "scope" }, "the SPEED tag's scope");
  must(/SPEED takes no descriptor: `SPEED: 1 situation`/.test(bonusError("[EFFECT SPEED: 1 situation, athletics]")), "SPEED takes no descriptor");
  const move = ruleModifiers(actor, { kind: "move", slug: "", item: null, encounter });
  same(move.applied.map(m => [m.label, m.value]), [["Riverfoot", 1]], "a foot on the Move");
  same(move.marks, [{ key: "Riverfoot:1", per: "encounter" }], "once each encounter");
  same(ruleModifiers(actor, { kind: "check", slug: "athletics", item: null, encounter }).applied, [], "Speed is no check");
  actor.flags = { starwrought: { rules: { encounter: { "Riverfoot:1": { combat: "c1" } } } } };
  same(ruleModifiers(actor, { kind: "move", slug: "", item: null, encounter }).applied, [], "spent this encounter");
  const iron = talentWith("Iron Etiquette", "[EFFECT DEF: 1 condition; IFT: CHECK(intimidation)]", { resolve });
  const serro = rulesActor([iron]);
  const demoralize = { threat: "check", melee: false, traits: [], check: "intimidation" };
  same(ruleModifiers(serro, { kind: "defense", slug: "guard", item: null, threat: demoralize, momentOnly: true }).applied.map(m => m.label), ["Iron Etiquette"], "Guard read by an Intimidation check");
  same(ruleModifiers(serro, { kind: "defense", slug: "guard", item: null, threat: { ...demoralize, check: "guile" }, momentOnly: true }).applied, [], "not a Guile check");
  same(ruleModifiers(serro, { kind: "defense", slug: "guard", item: null, threat: { threat: "blow", melee: true, traits: [] }, momentOnly: true }).applied, [], "not a Blow");
  same(ruleModifiers(serro, { kind: "defense", slug: "guard", item: null, threat: demoralize, staticOnly: true }).applied, [], "the sheet's pass leaves it out");
  must(summarize(iron.system.rules[0]) === "+1 Condition bonus to Defenses, against an Intimidation check", "the summary");
});

check("mark: the forms, the refusals, the summary and the use hook", () => {
  same(bonusRule("[EFFECT MARK: enemies, encounter]"), { who: "enemies", until: "encounter", when: null, kind: "mark", line: 1, text: "[EFFECT MARK: enemies, encounter]" }, "Oathbound's block");
  same([bonusRule("[EFFECT MARK:]").who, bonusRule("[EFFECT MARK:]").until], ["all", "encounter"], "the defaults");
  same(bonusRule("[EFFECT MARK: encounter, all]").who, "all", "either order");
  same(bonusRule("[EFFECT MARK: enemies; IF: RANK(Origin = expert)]").when, [{ constellation: "origin", name: "Origin", op: "=", rank: "expert" }], "a rank condition");
  must(/a mark is written/.test(bonusError("[EFFECT MARK: friends]")), "a bad word");
  must(/at most 2/.test(bonusError("[EFFECT MARK: enemies, encounter, more]")), "too many");
  must(bonusError("[EFFECT MARK: enemies; FOR: allies]") === "MARK does not take FOR", "a component it lacks");
  must(bonusError("mark: enemies, FOR(allies)") === LEGACY_REFUSAL, "the retired operator form is refused whole");
  must(summarize(bonusRule("[EFFECT MARK: enemies]")) === "marks one enemy until the encounter ends", "the summary");
  must(summarize(bonusRule("[EFFECT MARK:]")) === "marks one creature until the encounter ends", "the summary, any creature");
  must(typeof kindOf("mark").hooks.use === "function", "the use hook");
  const oath = talentWith("Oathbound ❶", "[EFFECT MARK: enemies, encounter]");
  const actor = rulesActor([oath]);
  actor.name = "Tess";
  const bandit = { uuid: "Actor.bandit", tokenUuid: "Scene.s.Token.b", name: "Bandit", relation: "enemy" };
  const used = ruleUses(actor, oath, { target: bandit, encounter: { combat: "c1", round: 1 } });
  same(used.map(u => [u.refuse, u.say, u.write]), [["", "Tess marks Bandit: Oathbound.", { [`flags.starwrought.rules.marks.${oath.name}`]: { uuid: "Actor.bandit", tokenUuid: "Scene.s.Token.b", name: "Bandit", combat: "c1" } }]], "the write and the line");
  same(ruleUses(actor, oath, { target: null }).map(u => u.refuse), ["Oathbound: target exactly one creature first."], "no target");
  same(ruleUses(actor, oath, { target: { ...bandit, relation: "ally" } }).map(u => u.refuse), ["Oathbound names an enemy; Bandit is not one."], "an ally when enemies are named");
  same(ruleUses(actor, talentWith("Other", "[EFFECT DEF: 1 situation, guard]"), { target: bandit }), [], "a Talent with no use rules does nothing here");
});

check("reroll: the forms, the refusals, the summary and the card hook", () => {
  const quick = bonusRule("[EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]", { resolve });
  same(quick, { to: { name: "Diplomacy", slug: "diplomacy", type: "constellation" }, when: [{ outcome: "critFail", name: "Critical Failure" }], kind: "reroll", line: 1, text: "[EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]" }, "Quick Tongue's block");
  same(bonusRule("[EFFECT REROLL: Checks]").to, { name: "Checks", slug: "checks", type: "scope" }, "any check");
  same(bonusRule("[EFFECT REROLL:]").to.slug, "checks", "no descriptor is any check");
  must(/names no Constellation/.test(bonusError("[EFFECT REROLL: Aid]", { resolve })), "a Maneuver");
  must(/REROLL takes one descriptor, a Constellation, or none for any check \(2 given\)/.test(bonusError("[EFFECT REROLL: Diplomacy, Guile]")), "two targets");
  must(bonusError("[EFFECT REROLL: Diplomacy; FOR: allies]") === "REROLL does not take FOR", "a component it lacks");
  must(bonusError("reroll: Diplomacy, FOR(allies)") === LEGACY_REFUSAL, "the retired operator form is refused whole");
  must(summarize(quick) === "reroll a Diplomacy check, on a Critical Failure", "the summary");
  must(summarize(bonusRule("[EFFECT REROLL: Checks]")) === "reroll any check", "the summary, any check");
  must(typeof kindOf("reroll").hooks.card === "function", "the card hook");
  const talent = talentWith("Quick Tongue ❶↺", "[EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]", { resolve });
  talent.system.glyph = "❶↺";
  const actor = rulesActor([talent]);
  same(ruleCardOffers(actor, { kind: "check", slug: "diplomacy", degree: "critFail" }).map(o => [o.label, o.action, o.item === talent]), [["Quick Tongue ❶↺: reroll", "ruleReroll", true]], "offered on the critical failure");
  same(ruleCardOffers(actor, { kind: "check", slug: "diplomacy", degree: "fail" }), [], "not on a failure");
  same(ruleCardOffers(actor, { kind: "check", slug: "diplomacy", degree: null }), [], "no Threshold, no degree, no offer");
  same(ruleCardOffers(actor, { kind: "check", slug: "guile", degree: "critFail" }), [], "not a Guile check");
  same(ruleCardOffers(actor, { kind: "attack", slug: "melee", degree: "critFail" }), [], "never an attack card");
  same(ruleCardOffers(rulesActor([talentWith("Lucky", "[EFFECT REROLL: Checks]")]), { kind: "check", slug: "guile", degree: "success" }).length, 1, "Checks, any outcome");
});

check("ignore: the forms, the refusals, the summary and ignoresTerrain", () => {
  same(bonusRule("[EFFECT IGNORE: terrain, Mud, Decking, Loose Stone, Shallow Water]"), { what: "terrain", kinds: ["mud", "decking", "loose-stone", "shallow-water"], when: null, kind: "ignore", line: 1, text: "[EFFECT IGNORE: terrain, Mud, Decking, Loose Stone, Shallow Water]" }, "Riverfoot's block");
  same(bonusRule("[EFFECT IGNORE: terrain]").kinds, [], "every kind");
  same(bonusRule("[EFFECT IGNORE: Terrain, shallow-water, ShallowWater]").kinds, ["shallow-water"], "the slug and the squeezed form, once");
  must(/"Lava" is not a terrain kind: write Mud, Shallow Water, .* or Other/.test(bonusError("[EFFECT IGNORE: terrain, Lava]")), "a kind the map does not know");
  must(/an ignore is written/.test(bonusError("[EFFECT IGNORE: Walls]")), "not Terrain");
  must(/an ignore is written/.test(bonusError("[EFFECT IGNORE:]")), "nothing");
  must(bonusError("[EFFECT IGNORE: terrain; LIMIT: round]") === "IGNORE does not take LIMIT", "a component it lacks");
  must(bonusError("ignore: Terrain, IF(Origin=Expert)") === LEGACY_REFUSAL, "the retired operator form is refused whole");
  must(summarize(bonusRule("[EFFECT IGNORE: terrain, Mud, Ice]")) === "ignores difficult terrain (Mud, Ice)", "the summary");
  must(summarize(bonusRule("[EFFECT IGNORE: terrain]")) === "ignores all difficult terrain", "the summary, all");
  const river = rulesActor([talentWith("Riverfoot", "[EFFECT IGNORE: terrain, Mud, Decking, Loose Stone, Shallow Water]")]);
  must(ignoresTerrain(river, "mud") && ignoresTerrain(river, "shallow-water") && !ignoresTerrain(river, "snow") && !ignoresTerrain(null, "mud") && !ignoresTerrain(river, ""), "the kinds named");
  must(ignoresTerrain(rulesActor([talentWith("Sure", "[EFFECT IGNORE: terrain]")]), "snow"), "every kind");
  must(!ignoresTerrain(rulesActor([talentWith("Veteran", "[EFFECT IGNORE: terrain; IF: RANK(Origin = expert)]")]), "mud"), "an IF that does not hold");
  must(ignoresTerrain(rulesActor([talentWith("Veteran", "[EFFECT IGNORE: terrain; IF: RANK(Origin = expert)]")], { origin: "expert" }), "mud"), "an IF that holds");
  same(terrainKindOf("Shallow Water"), "shallow-water", "terrainKindOf");
  same(terrainKindName("loose-stone"), "Loose Stone", "terrainKindName");
});

/* -------------------------------------------- */
/*  0.17.0: the block, the bare line and the retired form */
/* -------------------------------------------- */

/** Every effect line the document's examples and the shipped cells write, each to be read bare and in its block alike. */
const EFFECT_LINES = [
  "CHECK: 1 condition, aid; IF: RANK(Origin >= trained)",
  "CHECK: 1 condition, aid; IF: RANK(Origin = trained)",
  "CHECK: 1 situation; IF: RANK(roll = untrained)",
  "DEF: 1 situation, guard; IFT: BLOW; FOR: self+allies 0; IF: ALLIES(>=1, 0)",
  "DEF: 1 situation; FOR: allies 15; IF: SEEN; IFT: TRAIT(Fear); LIMIT: round",
  "IMMUNE: prone; LIMIT: encounter",
  "IMMUNE: expose; FOR: allies 0",
  "MARK: enemies",
  "MARK: enemies, encounter",
  "ATK: 1 condition; IFT: MARKED",
  "DEF: 1 condition; IFT: MARKED",
  "DEF: 1 condition; IFT: CHECK(intimidation)",
  "REROLL: diplomacy; IF: RESULT(critical failure)",
  "REROLL:; IF: RESULT(failure)",
  "IGNORE: terrain, mud",
  "IGNORE: terrain, mud, decking",
  "SPEED: 1 situation; LIMIT: encounter",
  "INIT: 1 situation",
  "CHECK: 2 situation, guile; IF: CLAIM(when trading)",
  "CHECK: 1 condition, diplomacy; IF: CLAIM(toward someone who shares your Culture)",
  "CHECK: -2 gear, stealth"
];

/** The same line read as a custom effect row (the bare form's one home since 0.18.0). */
const rowRules = (line) => {
  const parsed = parseAutomation(line, { resolve, itemName: "row", itemType: "effect" });
  must(parsed.errors.length === 0, `"${line}" should parse on an effect row, got: ${parsed.errors.map(e => e.message).join("; ")}`);
  return parsed.rules;
};

check("0.17.0: an effect block parses to the rule its bare line gives on a custom effect row, pairwise", () => {
  for (const line of EFFECT_LINES) {
    const block = `[EFFECT ${line}]`;
    const a = cellRules(block), b = rowRules(line);
    must((a.length === 1) && (b.length === 1), `"${line}": one rule each way, got ${a.length} and ${b.length}`);
    same(a.map(bare), b.map(bare), `"${block}" vs "${line}"`);
    must(a[0].text === block, `"${block}": the block's text is the whole block, got "${a[0].text}"`);
    must(b[0].text === line, `"${line}": the row's text is the line, got "${b[0].text}"`);
    must(!("bare" in a[0]) && !("bare" in b[0]) && !("legacy" in a[0]) && !("legacy" in b[0]), `"${block}": nothing carries bare or legacy`);
  }
});

check("0.18.0: a bare effect line in a cell is refused (it warned in 0.17.0); on an effect row it is the form", () => {
  const inCell = parseAutomation("CHECK: 1 condition, aid", { resolve, itemName: "test", itemType: "talent" });
  same(inCell.rules, [], "no rule");
  same(inCell.errors, [{ line: 1, text: "CHECK: 1 condition, aid", message: 'an effect line in a cell is written in brackets: write "[EFFECT CHECK: 1 condition, aid]"' }], "the one error, with the block to write");
  same(inCell.warnings, [], "no warning beside it");
  const onRow = parseAutomation("CHECK: 1 condition, aid", { resolve, itemType: "effect" });
  same(onRow.errors, [], "no error on an effect row");
  same(onRow.warnings, [], "and no warning there");
  same(bare(onRow.rules[0]), bare(cellRules("[EFFECT CHECK: 1 condition, aid]")[0]), "the same rule as the block");
  const three = parseAutomation("CHECK: 1 condition, aid\n[EFFECT DEF: 1 gear]\nIMMUNE: prone", { resolve, itemType: "talent" });
  same(three.errors.map(e => e.line), [1, 3], "one error per bare line");
  same(three.rules.map(r => r.line), [2], "the block between them parses");
  const action = parseAutomation("IMMUNE: prone", { resolve, itemType: "action" });
  must((action.rules.length === 0) && (action.errors.length === 1), "a Maneuver's cell is a cell too: any itemType but effect");
  const rowBlock = parseAutomation("[EFFECT CHECK: 1 condition, aid]", { resolve, itemType: "effect" });
  must((rowBlock.errors.length === 0) && (rowBlock.rules.length === 1), "the block reads on a row too");
});

check("0.17.0: the 0.13.0 operator form is one error naming the retirement, whatever the kind", () => {
  for (const line of [
    "bonus: +1, Condition, Aid",
    "bonus: +1, Condition, Aid, IF(Human=Trained)",
    "Bonus: +1, Condition, Aid",
    "prevent: Prone",
    "prevent: Prone, ONCE(encounter)",
    "grant: 1, Skill",
    "grant: 1, Skill, Acrobatics",
    "aura: 15ft, allies",
    "aura: 15ft, allies, VISIBLE",
    "mark: enemies, IF(Origin=Expert)",
    "mark: enemies, MARKED",
    "reroll: Diplomacy, IF(Outcome=Failure)",
    "ignore: Terrain, IF(Origin=Expert)",
    "[EFFECT mark: enemies, IF(Origin=Expert)]",
    "[EFFECT CHECK: 1 condition, aid, IF(Human=Trained)]",
    "bonus: +1 Condition to Aid if Human is Expert"
  ]) {
    const parsed = parseAutomation(line, { resolve });
    must((parsed.rules.length === 0) && (parsed.errors.length === 1), `"${line}": one error and no rule, got ${parsed.rules.length} rules and ${parsed.errors.length} errors`);
    must(parsed.errors[0].message === LEGACY_REFUSAL, `"${line}": the message is LEGACY_REFUSAL, got "${parsed.errors[0].message}"`);
    same(parsed.warnings, [], `"${line}": no warning beside the error`);
  }
  must(/0\.13\.0 form/.test(LEGACY_REFUSAL) && /AUTOMATION_GRAMMAR\.md section 9/.test(LEGACY_REFUSAL), "the message names the form and the document's map");
  // A tag line with no operator call is not the retired form: it is a bare effect line, refused in a cell as one.
  for (const line of ["mark: enemies, encounter", "ignore: Terrain, Mud"]) {
    const message = parseAutomation(line, { resolve, itemType: "talent" }).errors[0]?.message ?? "";
    must(/written in brackets: write "\[EFFECT /.test(message) && (message !== LEGACY_REFUSAL), `"${line}" is a bare effect line, not the retired form`);
  }
  // A feature keyword typed as a line was never the 0.13.0 form: the grammar says to bracket it;
  // `aura:` was a 0.13.0 kind line, so it is the retirement message.
  must(parseAutomation("trait: Human").errors[0]?.message === "TRAIT is a feature and is written in brackets: `[TRAIT Human]`", "a feature keyword before a colon is told to bracket");
  must(parseAutomation("size: Medium").errors[0]?.message === "SIZE is a feature and is written in brackets: `[SIZE Medium]`", "and so is SIZE");
  must(parseAutomation("AURA: 15 allies").errors[0]?.message === LEGACY_REFUSAL, "aura: was a 0.13.0 line");
});

check("0.17.0: the EFFECT block's own refusals, the keyword list, and blocks of both layers on one line", () => {
  const err = cell => { const p = parseAutomation(cell, { resolve }); must((p.rules.length === 0) && (p.errors.length === 1), `"${cell}" should be one error`); return p.errors[0]; };
  const nonsense = err("[EFFECT nonsense: 1]");
  must(nonsense.message === "EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE", `a word that is no tag: "${nonsense.message}"`);
  must(nonsense.text === "[EFFECT nonsense: 1]", "under the block's text");
  must(err("[EFFECT]").message === "EFFECT is written `[EFFECT <tag>: ...]`, as in `[EFFECT IMMUNE: prone; LIMIT: encounter]`", "an empty EFFECT");
  must(err("[EFFECT CHECK]").message.startsWith("EFFECT wraps an effect line"), "a tag without its colon is no tag");
  must(err("[EFFECT CHECK: 1 condition, aid").message === "a [ has no closing ]", "an unclosed block");
  same(FEATURE_KEYWORD_LIST.at(-1), "EFFECT", "FEATURE_KEYWORD_LIST ends with EFFECT");
  must(/EFFECT/.test(err("[FLY 30]").message) && /an effect goes in `\[EFFECT <tag>: \.\.\.\]`/.test(err("[FLY 30]").message), "the keyword refusal names EFFECT");
  must(/in brackets as \[EFFECT \.\.\.\]/.test(err(`${UNKNOWN_KIND}: 1`).message), "the unknown-kind message names the block");
  const mixed = cellRules("[TRAIT Human][EFFECT CHECK: 1 condition, aid][AURA 15 allies][EFFECT IMMUNE: prone]");
  same(mixed.map(r => [r.kind, r.text, r.line]), [["trait", "[TRAIT Human]", 1], ["bonus", "[EFFECT CHECK: 1 condition, aid]", 1], ["aura", "[AURA 15 allies]", 1], ["prevent", "[EFFECT IMMUNE: prone]", 1]], "four blocks, four rules, each under its own text");
  const partly = parseAutomation("[TRAIT Human][EFFECT CHECK: 0 condition, aid][SIZE Medium]", { resolve });
  same([partly.rules.map(r => r.kind), partly.errors.map(e => [e.text, e.message])], [["trait", "size"], [["[EFFECT CHECK: 0 condition, aid]", "a bonus of 0 does nothing"]]], "a bad block fails alone; its neighbours still parse");
});

check("0.16.0: feature lines, one rule per block", () => {
  const human = cellRules("[TRAIT Human][SIZE Medium][SPEED 6][VIGOR 8]");
  same(human.map(bare), [
    { name: "Human", kind: "trait", line: 1 }, { size: "medium", kind: "size", line: 1 },
    { feet: 6, mode: "set", kind: "speed", line: 1 }, { value: 8, scope: "level", kind: "vigor", line: 1 }
  ], "Humanity's blocks");
  same(human.map(r => r.text), ["[TRAIT Human]", "[SIZE Medium]", "[SPEED 6]", "[VIGOR 8]"], "each block keeps its own text");
  same(bare(cellRules("[SPEED +1]")[0]), { feet: 1, mode: "add", kind: "speed", line: 1 }, "a Speed adjustment");
  same(bare(cellRules("[VIGOR opening 12]")[0]), { value: 12, scope: "opening", kind: "vigor", line: 1 }, "Opening Vigor");
  same(bare(cellRules("[LANGUAGE Common, Serrovine]")[0]), { languages: ["Common", "Serrovine"], kind: "language", line: 1 }, "languages");
  same(bare(cellRules("[SENSES Low-light vision]")[0]), { name: "Low-light vision", kind: "sense", line: 1 }, "a sense");
  same(bare(cellRules("[Acrobatics trained]")[0]), { n: 1, scope: "Skill", constellation: "acrobatics", constellationName: "Acrobatics", different: false, when: null, trained: true, kind: "grant", line: 1 }, "a Trained Root, FG's own form");
  same(bare(cellRules("[Lore trained]")[0]).scope, "Lore", "a Lore of the player's naming");
  same(bare(cellRules("[Guard trained]")[0]).scope, "Defense", "a Defense's category is its scope");
  {
    // The client's resolver hands the system's category key, not the index's word (the 0.16.0
    // live test: a Sync content re-parse had turned every Trained Root into an Opening point).
    const keyed = name => ({ skill: { ...KNOWN.athletics, category: "skill" }, "combat style": { ...KNOWN["armored-fighting"], category: "combatStyle" } })[name.toLowerCase()] ?? null;
    const rules = parseAutomation("[skill trained][combat style trained]", { resolve: keyed, itemName: "test", itemType: "talent" }).rules;
    same(rules.map(r => r.scope), ["Skill", "Combat Style"], "the system's category keys read as scopes too");
  }
  same(bare(cellRules("[POINT Calling]")[0]), { n: 1, scope: "Calling", different: false, when: null, kind: "grant", line: 1 }, "a point by scope");
  same(bare(cellRules("[POINT 2 Skill different]")[0]), { n: 2, scope: "Skill", different: true, when: null, kind: "grant", line: 1 }, "two points, different");
  same(bare(cellRules("[POINT Opening]")[0]).scope, "Opening", "an Opening point");
  same(bare(cellRules("[MANEUVER Steady the Line]")[0]), { name: "Steady the Line", slug: "steady-the-line", enabled: true, kind: "maneuver", line: 1 }, "a granted Maneuver");
  same(bare(cellRules("[TALENT Weapon Familiarity ❶]")[0]), { name: "Weapon Familiarity", kind: "talent", line: 1 }, "a free Talent, glyphs dropped");
  same(bare(cellRules("[CHOICE Weapon Group]")[0]), { prompt: "Weapon Group", kind: "choice", line: 1 }, "a choice");
  must(/drop the word/.test(bonusError("[AURA 15 allies visible]")), "an aura block with the retired word is refused (0.18.0)");
  same(bare(cellRules("[AURA 30 ft all]")[0]), { range: 30, affects: "all", kind: "aura", line: 1 }, "an aura with ft spelled");
  same(toGrantField(cellRules("[Athletics trained]")[0]), { n: 1, mode: "any", scope: "Skill", constellation: "athletics" }, "the wizard's field carries the Constellation");
  // Mike's three-argument `grant: 1, Skill, Acrobatics` is the retired form since 0.17.0 (refused above); `[Acrobatics trained]` is its block.
  must(summarize(cellRules("[Acrobatics trained]")[0]) === "Trained in Acrobatics", "the summary");
  must(summarize(cellRules("[VIGOR opening 12]")[0]) === "12 Opening Vigor" && summarize(cellRules("[SPEED +1]")[0]) === "Speed +1 ft", "more summaries");
});

check("0.16.0: the refusals of the two layers", () => {
  // Read as a custom effect row, where a bare tag line is the form, so each refusal is the line's own and not the missing brackets'.
  const err = cell => { const p = parseAutomation(cell, { resolve, itemType: "effect" }); must(p.errors.length >= 1, `"${cell}" should be refused`); return p.errors[0].message; };
  must(/no Talent bonus is untyped/.test(err("CHECK: 1, diplomacy")), "no type");
  must(/a signed whole number first/.test(err("CHECK: condition, diplomacy")), "no value");
  must(/is not an effect tag/.test(err("FOO: 1 condition")) || /unknown rule kind "foo"/.test(err("FOO: 1 condition")), "a bad tag");
  must(/is not a feature keyword/.test(err("[FLY 30]")), "a bad keyword");
  must(/IF\(Outcome=\.\.\.\) is only read/.test(err("CHECK: 1 condition; IF: RESULT(success)")), "a degree on a bonus");
  must(/IMMUNE does not take IF: CLAIM/.test(err("IMMUNE: prone; IF: CLAIM(when wet)")), "a claim on a prevention");
  must(/takes one descriptor/.test(err("CHECK: 1 condition, diplomacy, guile")), "two descriptors");
  must(/is not a Defense/.test(err("DEF: 1 condition, diplomacy")), "a Skill on DEF");
  must(/takes no descriptor/.test(err("ATK: 1 condition, melee")), "a descriptor on ATK");
  must(/is not a condition/.test(err("CHECK: 1 condition; IF: WET")), "an unknown condition");
  must(/is written `RANK\(/.test(err("CHECK: 1 condition; IF: RANK(Origin)")), "RANK without a rank");
  must(/is a tag and begins its own line/.test(err("CHECK: 1 condition; DEF: 1 condition")), "two tags on one line");
  must(/unknown rule kind "if"/.test(err("IF: SEEN")), "a component with no tag");
  must(/a \[ has no closing \]/.test(err("[TRAIT Human")), "an unclosed block");
  must(/a Root is Trained; nothing grants Expert/.test(err("[Acrobatics expert]")), "a higher rank");
  // Since 0.17.0 a `kind:` line is refused by the grammar before the kind sees it, so the feature
  // kinds' own "is a feature" messages are never printed from a cell; the grammar says to bracket a
  // feature keyword typed as a line, and gives the aura's old kind line the retirement message.
  must(/^TRAIT is a feature and is written in brackets/.test(err("trait: Human")), "a feature keyword as a line");
  must(/is not a feature keyword/.test(err("[MARK enemies]")), "an effect kind as a block");
  must(err("AURA: 15 allies") === LEGACY_REFUSAL, "an aura as a tag");
  must(/is not a Maneuver/.test(err("[MANEUVER Fly]")), "a Maneuver that is no row");
  must(/is not a Size/.test(err("[SIZE Vast]")), "a bad Size");
});

/* -------------------------------------------- */

console.log("");
if (failures.length) {
  console.error(`rules framework: ${failures.length} of ${passed + failures.length} checks FAILED:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
console.log(`rules framework: ${passed} checks passed`);
