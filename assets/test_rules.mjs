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
  KIND_WORD, kindOf, knownKinds,
  // "No automation" (0.26.1): the N/A mark, the whole-cell test and the one warning.
  isNotApplicable, isNotApplicableCell, NOT_APPLICABLE_WITH_RULES
} from "../foundry/starwrought/module/rules/grammar.mjs";
import { KINDS, registerKind } from "../foundry/starwrought/module/rules/kinds/index.mjs";
import { ruleTraitImmunity } from "../foundry/starwrought/module/rules/engine.mjs";
import { traitGroups, traitKeysOf, coveredGroup, joinNames, immunityWords } from "../foundry/starwrought/module/rules/immunity.mjs";
import { TRAIT as TRAIT_IMMUNITY } from "../foundry/starwrought/module/rules/kinds/prevent.mjs";
import { collectRules, rulesOfKind, ruleModifiers, rulePreventers, ruleUses, ruleCardOffers, ruleSubstitutions, ruleGives, ruleApplies, givenResults, ruleStateKey, usableByRule, alterationsOf, RULE_ITEM_TYPES } from "../foundry/starwrought/module/rules/engine.mjs";
// 0.32.0: what a Maneuver puts on a creature. The lines, the record, the window and the build's census are pure.
import { linesFor, needsCost, appliedWindow, appliedRecord, isAppliedRecord, sameApplication, settleApplied, appliedBy, effectWords, lineWords, wordsToSay, effectCensus } from "../foundry/starwrought/module/rules/applied.mjs";
// 0.24.0: the Move made as part of a Maneuver, pure, shared by the charge and the ruler.
import { MOVE_RECORD_FLAG, MOVE_USED_FLAG, MOVE_USED_KEPT, moveRecord, recordLive, moveRoleFor, asManeuverMove, usedNonces, withUsed } from "../foundry/starwrought/module/rules/maneuver-move.mjs";
import { splitOperands, rankMeets, whoMatches, compare, needsMoment, hasTrait, traitKey, againstHolds, markedHolds, readTargetName, readUntil, untilWords, readBonusType, limitKey, limitSpent, effectHolds, readsOtherEffects, effectConditions, emptyOps } from "../foundry/starwrought/module/rules/operators.mjs";
// 0.22.0: what a Maneuver gives. The table, the pending result and the window are pure data, and
// the mark that removes a used result is read off a plain actor.
import {
  buildTable, sameGiven, pendingEntry, pendingRule, givenCarrier, settle, appliesNow, isGivenKey, givenFlagKey,
  resultWords, windowWords, pendingWindowWords, ALTER_PROPERTIES,
  // 0.25.0: the used Effect a roll leaves, and the limit an alteration may replace.
  usedEntry, usedLive, usedOf, usedEffects, isUsedKey, usedFlagKey, limitOf, LIMIT_VALUES
} from "../foundry/starwrought/module/rules/given.mjs";
import { markUpdates } from "../foundry/starwrought/module/rules/effects-state.mjs";
// 0.17.0: the effect reader behind every tag (the operator reader's successor) and the feature
// keyword list, each checked on its own as readLine was.
import { readEffectLine, EFFECT_TAGS, CONDITIONS, EFFECT_STATES } from "../foundry/starwrought/module/rules/effects.mjs";
// 0.21.0: the pure half of a check made with other terms, and the list of kinds the Effects tab
// switches (the module's top level names no Foundry global, so it imports here).
import { swapTerms, substitutionRecord, chooseVariant, mergeMarks } from "../foundry/starwrought/module/dice/check/substitute.mjs";
import { EFFECT_KINDS } from "../foundry/starwrought/module/helpers/effects.mjs";
import { FEATURE_KEYWORD_LIST } from "../foundry/starwrought/module/rules/features.mjs";
import { ignoresTerrain } from "../foundry/starwrought/module/rules/kinds/ignore.mjs";
import { terrainKindOf, terrainKindName, registerTerrainKinds } from "../foundry/starwrought/module/config.mjs";

// The terrain kinds are the roster's `terrainKinds` block since 0.18.0, registered before any parse
// by the pipeline step and the build; the suite seeds the ten shipped rows the same way, so an
// `[EFFECT IGNORE: terrain, mud]` reads here as it does there (an unseeded registry knows nothing).
registerTerrainKinds([["Mud", "", 2, "#6b4a2b"], ["Shallow Water", "", 2, "#2f7fb8"], ["Decking", "", 2, "#9a7a4a"], ["Loose Stone", "", 2, "#7d7d7d"], ["Rubble", "", 2, "#5c5c5c"], ["Undergrowth", "", 2, "#3f7a3a"], ["Snow", "", 2, "#cfe3f2"], ["Ice", "", 2, "#9fd3e8"], ["Sand", "", 2, "#d8b56a"], ["Other", "", 2, "#8a6fb0"]]);
import { toGrantField } from "../foundry/starwrought/module/rules/kinds/grant.mjs";
import { toAuraField } from "../foundry/starwrought/module/rules/kinds/aura.mjs";
import { slugify, plainName, resolveModifiers, ACTION_GLYPHS, actionCostOptions, costGlyphs, costParts, costPipsHtml, naturalReach } from "../foundry/starwrought/module/config.mjs";
// Multipliers and Divisors, the Legs' Speed and the Arms' Critical Hit penalty (0.26.0; PHB v4.25).
import {
  combineFactors, applyFactors, combineDifficulties, speedAfterLegs, ARMS_CRITICAL_PENALTY, ACTIVITY_SPEEDS, TERRAIN
} from "../foundry/starwrought/module/config.mjs";
// The attack flow's pure parts (0.12.0): the record's shape and the legal answers, both free of
// Foundry globals at module scope, so the rule "no Defense is ever chosen by the system" has
// checks the build runs.
import { AttackWorkflow, ACTIONS, OUTSTANDING_KINDS } from "../foundry/starwrought/module/combat/attack-workflow.mjs";
import { legalAnswers, isLegalAnswer } from "../foundry/starwrought/module/helpers/answers.mjs";
// The Bind's rules (0.27.0): pure, so every decision the callers write is checked here.
import {
  usesBoundImplement, attackBindPlan, movementBindPlan, bindOffer, gainControlOutcome,
  sizeGap, isLarger, momentaryFor, momentaryStep, BIND_END_REASONS
} from "../foundry/starwrought/module/combat/bind-rules.mjs";
// The Maneuvers the system implements and the ones it pays for elsewhere (0.23.0): the module
// imports nothing, which this import is the check of.
import { BUILT_IN_MANEUVERS, CHARACTER_BUILT_INS, PAID_ELSEWHERE, ENGINE_REQUIRES } from "../foundry/starwrought/module/documents/maneuvers.mjs";
import { readRequires, requireWords, termWords, checkCondition, availability, requiresFor, maneuverStatus, freeHands, arrangeManeuvers, STATUS_REASONS, BIND_STATES } from "../foundry/starwrought/module/rules/requires.mjs";
import { effectList, effectsOn, readEffectName, listHas, namedEffects, namedEffectOf, effectSlug, conditionTitle } from "../foundry/starwrought/module/rules/effect-list.mjs";
// 0.29.0: what a ranged weapon holds to shoot, and what a Strike does to it.
import { parseWeaponTraits, splitTraits, ammunitionOf, shotPlan, nextLoaded, longestMelee, strikeOptions, reloadOptions, isNaturalGroup, hasNaturalWeapon, ammunitionFor, takeAmmunition } from "../foundry/starwrought/module/data/items/weapon-traits.mjs";

// 0.33.0: the Conditions workbook. The registry (the config's CONDITIONS, which is NOT the list of
// condition WORDS the effect reader exports under the same name above), the row's item type, what
// a creature has, and the carrier of a Condition's lines.
import {
  CONDITIONS as CONDITION_REGISTRY, registerConditions, conditionsRegistered, builtInConditionIds, conditionIdOf, conditionLabel,
  conditionWords, conditionHasRules, statusEffectId, newStatusId, newConditionId, conditionRowName, readInclude,
  RESERVED_CONDITION_NAMES, CONDITION_TAKES, DEFAULT_CONDITION_ICON, ZONE_CONDITIONS
} from "../foundry/starwrought/module/config.mjs";
import { CONDITION_ROW, CONDITION_ROW_TAGS, splitAlternatives } from "../foundry/starwrought/module/rules/syntax.mjs";
// 0.34.0: the check a Maneuver rolls, declared (the `check` kind and its plan).
import { readCheck, checkWords, checkSummary, planOf, storedCheck, userPicks, targetPicks, defenseKeyOf, defenseNames, RELEVANT, BONUS_FORM, isBonusShape } from "../foundry/starwrought/module/rules/check.mjs";
import { CHECK_REQUEST, CHECK_ANSWER, REQUEST_MODES, usableDefenses, validRequest, validAnswer, standingAnswer, requestState, userDegree, adversaryCheck } from "../foundry/starwrought/module/rules/check-request.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeConditions, conditionSetOf, holdsCondition, heldIds, heldIdsFor } from "../foundry/starwrought/module/rules/condition-set.mjs";
import { conditionCarriers, conditionModifiers, isConditionCarrier, CONDITION_CARRIER_TYPE } from "../foundry/starwrought/module/rules/engine.mjs";
import { conditionIdsFor, conditionOfRef } from "../foundry/starwrought/module/rules/effect-list.mjs";
// The build's reading of the Conditions workbook's staged rows (pure Node, no file is touched).
import { buildConditions, registryRows, listedName, listedRows, listedText, textsOf, pageRows, overlappingLines } from "./lib/conditions_build.mjs";
// The scopes of the `bonus` kind (0.36.0): what a bare CHECK and the SKILL tag each reach.
import { SCOPES, scopeReaches } from "../foundry/starwrought/module/rules/kinds/bonus.mjs";
import { conditionNameFree, conditionNameKey, conditionEffect, conditionFlavor, conditionHasRow, CONDITION_TEXT_X, conditionTakesCreature, hasConditionTextX, fillConditionText } from "../foundry/starwrought/module/config.mjs";
import { FATIGUED_MAX, FATIGUED_REST_STEP, fatiguedAfterRest } from "../foundry/starwrought/module/config.mjs";

// Foundry's prototype extension, which resolveModifiers uses inside its body (config.mjs says
// so); plain Node has no such thing, and the stacking section below calls the function directly.
Number.isNumeric ??= n => (typeof n === "number") && !Number.isNaN(n);

/**
 * The kinds the registry ships with, by id, sorted. Empty in 0.9.0 (Mike, 2026-10-03: "do NOT
 * survey the talents yet or build ANY of the automation hooks. just build the framework"); `bonus`
 * since 0.10.0, Mike's first (Humanity's "+1 Condition bonus on checks to Aid"), with its own
 * checks below. Each kind that lands adds its id here and its section of checks.
 */
const SHIPPED_KINDS = ["alter", "apply", "aura", "bonus", "check", "choice", "give", "grant", "ignore", "language", "maneuver", "mark", "permit", "prevent", "reach", "requires", "reroll", "sense", "size", "speed", "subordinate", "substitute", "talent", "trait", "vigor"];

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

check("N/A in a cell is no automation: no rule, no error, never an unknown kind (0.26.1)", () => {
  for (const text of ["N/A", "n/a", "N / A", "NA", "na", "N.A.", "N/A.", "None", "none", "-", "---", "\u2014", "\u2013", "[N/A]", "[ n/a ]", "[None]", "  N/A  ", "\r\nN/A\r\n", "# reviewed\nN/A\n\n"]) {
    same(parseAutomation(text, { itemType: "action" }), { rules: [], errors: [], warnings: [] }, `parseAutomation(${JSON.stringify(text)})`);
    must(isNotApplicableCell(text), `${JSON.stringify(text)} is a whole-cell mark`);
  }
  for (const line of ["N/A", "n/a", "NA", "N.A.", "None", "-", "[N/A]"]) must(isNotApplicable(line), `${line} is the mark`);
  // What is NOT the mark: a word that merely contains it, an effect or a block that carries it.
  for (const line of ["", "# N/A", "N/A for now", "nay", "nan", "n", "a", "banana", "[EFFECT N/A]", "[TRAIT None]", "CHECK: N/A", "none of the above", "[N/A][TRAIT Human]"]) {
    must(!isNotApplicable(line), `${JSON.stringify(line)} is not the mark`);
  }
  must(!isNotApplicableCell(""), "an empty cell is empty, not marked");
  must(!isNotApplicableCell("# only a comment"), "a cell of comments is not marked");
  must(!isNotApplicableCell("N/A\n[TRAIT Human]"), "a cell with a rule beside the mark is not a whole-cell mark");
  // The same in the custom effects field, whose lines are typed bare.
  same(parseAutomation("N/A", { itemType: "effect" }), { rules: [], errors: [], warnings: [] }, "the custom effects field");
});

check("N/A inside a block or an effect is still a mistyped line, and N/A beside rules is warned about with the rules standing", () => {
  must(parseAutomation("[EFFECT N/A]").errors.length === 1, "[EFFECT N/A] is an error");
  must(parseAutomation("[EFFECT CHECK: N/A]").errors.length === 1, "an effect whose value is N/A is an error");
  must(parseAutomation("N/A for now").errors.length === 1, "N/A with words after it is not the mark");
  const both = parseAutomation("N/A\n[TRAIT Human]");
  same(both.rules.map(r => [r.kind, r.line]), [["trait", 2]], "the rule stands, on its own line");
  same(both.errors, [], "no error");
  same(both.warnings, [{ line: 1, text: "N/A", message: NOT_APPLICABLE_WITH_RULES }], "one warning, naming the N/A line");
  const twice = parseAutomation("[TRAIT Human]\nNone\n-\n");
  same([twice.rules.length, twice.warnings.length, twice.warnings[0]?.line], [1, 1, 2], "two marks and a rule: one warning, at the first mark");
  // A mark beside a line that does not read: the error speaks, and nothing more is said.
  const broken = parseAutomation(`N/A\n${UNKNOWN_KIND}: 15 ft`);
  same([broken.rules.length, broken.errors.length, broken.warnings.length], [0, 1, 0], "the unreadable line is the error");
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
  "quick-tongue": { type: "action", slug: "quick-tongue", name: "Quick Tongue", enabled: true },
  // 0.24.0: the Maneuver a PERMIT is written on and Coordinated Footwork alters.
  "move-together": { type: "action", slug: "move-together", name: "Move Together", enabled: true },
  // 0.25.0: the Maneuver a SUBORDINATE is written on and Reciprocal Effort alters.
  "pay-it-forward": { type: "action", slug: "pay-it-forward", name: "Pay It Forward", enabled: true }
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
  throws(() => readEffectLine("FOO: 1 situation"), /"FOO" is not an effect tag: write CHECK, SKILL, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE, USE, GIVE, ALTER, PERMIT, SUBORDINATE, APPLY, REMOVE$/, "a bad tag");
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
  same(bonusRule("[EFFECT check: 1 situation]").to, { name: "every roll and Threshold", slug: "rolls", type: "scope" }, "CHECK with none is every roll and Threshold (0.36.0), the tag case blind");
  same(bonusRule("[EFFECT skill: 1 situation]").to, { name: "Skill checks", slug: "checks", type: "scope" }, "SKILL is the scope a bare CHECK was through 0.35.1");
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
  must(/"checks" is a scope word; CHECK takes a Constellation or a Maneuver, or no descriptor for every roll and Threshold/.test(bonusError("[EFFECT CHECK: 1 condition, checks]")), "a scope word as a descriptor");
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
  must(summarize(bonusRule("[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]")) === "+1 Situation bonus to every roll and Threshold, while the roll's rank is Untrained", "the roll's rank");
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
  same(onStealth.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶" }], "applied on Stealth, the label the carrier's plain name");
  const onAthletics = ruleModifiers(actor, { kind: "check", slug: "athletics", item: null });
  must(!onAthletics.applied.some(m => m.label === "Sneaky"), "absent on Athletics");
  const asInitiative = ruleModifiers(actor, { kind: "initiative", slug: "stealth", item: null });
  same(asInitiative.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶" }], "an Initiative rolled with Stealth is a Stealth check (ruling 111)");
});

check("ruleModifiers: the rank condition is equality, read from the actor's proficiency", () => {
  const roll = { kind: "check", slug: "diplomacy", item: aidItem };
  same(ruleModifiers(rulesActor([humanity], { human: "untrained" }), roll).applied, [], "Untrained: none of the four");
  same(ruleModifiers(rulesActor([humanity], { human: "trained" }), roll).applied, [{ label: "Humanity", value: 1, type: "condition", source: "rule:Humanity" }], "Trained: the +1 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "expert" }), roll).applied, [{ label: "Humanity", value: 2, type: "condition", source: "rule:Humanity" }], "Expert: the +2 alone");
  same(ruleModifiers(rulesActor([humanity], { human: "legendary" }), roll).applied, [{ label: "Humanity", value: 4, type: "condition", source: "rule:Humanity" }], "Legendary: the +4 alone");
  same(ruleModifiers(rulesActor([humanity], {}), roll).applied, [], "a Constellation the actor has no entry for reads as Untrained");
});

check("ruleModifiers: a conditioned rule never fires for an actor without proficiency; an unconditioned one does", () => {
  const actor = rulesActor([humanity, sneaky], null);
  must(!("proficiency" in actor.system), "the fake adversary has no proficiency");
  same(ruleModifiers(actor, { kind: "check", slug: "stealth", item: aidItem }).applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶" }], "only the unconditioned rule");
});

check("ruleModifiers: a Maneuver target applies when the roll carries that Maneuver, glyphs ignored", () => {
  const actor = rulesActor([humanity], { human: "trained" });
  const withAid = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: aidItem });
  same(withAid.applied, [{ label: "Humanity", value: 1, type: "condition", source: "rule:Humanity" }], "applied from the Aid Item");
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
    label: "Humanity: Aid", value: 2, type: "condition", source: "rule:Humanity", offer: true,
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
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), roll).applied, [{ label: "Braced", value: 1, type: "gear", source: "rule:Braced" }], "Guard at Expert");
  same(ruleModifiers(rulesActor([braced], { human: "trained" }), roll).applied, [], "not at Trained");
  same(ruleModifiers(rulesActor([braced], { human: "expert" }), { kind: "defense", slug: "evade", item: null }).applied, [], "not on Evade");
});

check("ruleModifiers: no rules, no kinds with the hook, or nothing at all is three empty lists", () => {
  same(ruleModifiers(rulesActor([]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "no rules");
  same(ruleModifiers(rulesActor([talentA]), { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "a kind without the hook is skipped");
  same(ruleModifiers(null, { kind: "check", slug: "stealth", item: null }), { applied: [], offered: [], marks: [] }, "null actor");
  same(ruleModifiers({ items: [sneaky] }, { kind: "check", slug: "stealth", item: null }).applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶" }], "an actor with no prepared index is collected on the spot");
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
  same(result.applied, [{ label: "Sneaky", value: 2, type: "situation", source: "rule:Sneaky ❶" }], "the other kind's modifiers still arrive");
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
  // Immunity to a trait (0.35.0) is read on a Condition's row alone: on a Talent, a Maneuver and a
  // custom effect it is refused, and told where it is read.
  for (const itemType of ["talent", "action", "effect"]) {
    must(/`IMMUNE: TRAIT\(\.\.\.\)` is read on a Condition's row for now .*a Talent's immunity to a trait is not read yet/.test(bonusError("[EFFECT IMMUNE: TRAIT(Visual)]", { resolve, itemType })), `IMMUNE: TRAIT(...) on a ${itemType}`);
  }
  same(bonusRule("[EFFECT IMMUNE: prone; LIMIT: encounter]", { resolve, itemType: "talent" }).trait, undefined, "and a Condition's line carries no trait field: its stored rule is what it was");
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
    { label: "line +1", value: 1, type: "condition", source: "rule:Humanity" },
    { label: "line +3", value: 3, type: "condition", source: "rule:Humanity" },
    { label: "line −1", value: -1, type: "condition", source: "rule:Humanity" },
    { label: "another Talent", value: 1, type: "condition", source: "rule:Other" }
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

check("bonus hook: one Talent's lines share a source, two Talents do not", () => {
  // Two blocks on one line, as a cell may write them.
  const twice = talentWith("Twice", "[EFFECT CHECK: 1 condition, aid][EFFECT CHECK: 3 condition, aid]");
  const other = talentWith("Other", "[EFFECT CHECK: 1 condition, aid]");
  const { applied } = ruleModifiers(rulesActor([twice, other]), { kind: "check", slug: "diplomacy", item: aidItem });
  same(applied.map(m => m.source), ["rule:Twice", "rule:Twice", "rule:Other"], "the sources");
  must(resolveModifiers(applied).total === 4, "+3 (the higher of Twice's) +1 (Other's) is 4");
});

check("bonus hook: a 0.10.0 rule stored on an owned copy (when as one object) still reads", () => {
  const old = { type: "talent", name: "Humanity", system: { rules: [{ kind: "bonus", line: 1, text: "old", value: 1, type: "condition", to: { name: "Aid", slug: "aid", type: "action" }, when: { constellation: "human", name: "Human", rank: "trained" } }] } };
  same(ruleModifiers(rulesActor([old], { human: "trained" }), { kind: "check", slug: "diplomacy", item: aidItem }).applied.map(m => m.value), [1], "equality assumed");
});

/* The operators in play (0.13.0): scope targets, the roll's rank, the scene, the Threat, the marks. */

const jack = talentWith("Jack of Trades", "[EFFECT SKILL: 1 situation; IF: RANK(roll = untrained)]");
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

check("rollerFor is unchanged: a player attacker rolls the Attack; a player defender of an adversary's Blow rolls Defense", () => {
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: true }, defender: { isPlayer: false } }).roller, "attacker", "player attacker");
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: false }, defender: { isPlayer: true } }).rollType, "defense", "player defender");
  same(AttackWorkflow.rollerFor({ attacker: { isPlayer: false }, defender: { isPlayer: false } }).isolated, true, "adversary against adversary");
});

/* -------------------------------------------- */
/*  One die for each defender (0.26.0)          */
/* -------------------------------------------- */

const THREE = [
  { actorUuid: "Actor.b1", tokenUuid: "", name: "Bandit", isPlayer: false, controllerUserIds: [] },
  { actorUuid: "Actor.b2", tokenUuid: "", name: "Cutpurse", isPlayer: false, controllerUserIds: [] },
  { actorUuid: "Actor.c", tokenUuid: "", name: "Wren", isPlayer: true, controllerUserIds: ["p2"] }
];
/** A whole submitted roll, as the roller's client hands it over. */
const die = (total, natural) => ({ roll: { class: "Roll", total, terms: [] }, total, natural, formula: "1d20 + 3", modifiers: [] });
/** A workflow in its rolling phase, every defender's answer revealed at the revision given. */
function rollingFlow(spec, revealedAt = 4) {
  const wf = AttackWorkflow.create(spec);
  for (const phase of ["defending", "revealed", "rolling"]) AttackWorkflow.transition(wf, phase);
  for (const t of wf.targets) {
    t.committed = true;
    t.revealed = { defense: "evade", reaction: null, posture: null, revision: revealedAt };
  }
  wf.revision = revealedAt + 1;
  return wf;
}

check("outstandingFor in rolling: a player attacker has one Roll for each defender, and each die takes one off (PHB v4.25, Area Attacks)", () => {
  const wf = rollingFlow(flowSpec({ weaponId: "w1", strike: "deliberate" }, THREE));
  const mine = () => AttackWorkflow.outstandingFor(wf, { id: "p1", isGM: false });
  same(mine().map(o => [o.kind, o.targetId]), [["rollAttack", "t1"], ["rollAttack", "t2"], ["rollAttack", "t3"]], "three dice, each named for its defender");
  same(AttackWorkflow.outstandingFor(wf, { id: "p2", isGM: false }), [], "a defender of a player's attack rolls nothing");
  same(AttackWorkflow.outstandingFor(wf, { id: "gm", isGM: true }), [], "and the GM gets no task for a player's attacker (the card's rows are the GM's way in)");
  wf.targets[1].roll = die(17, 14);
  same(mine().map(o => o.targetId), ["t1", "t3"], "a die thrown takes its own pairing off the list");
  must(!AttackWorkflow.allRolled(wf), "two of three is not every die");
  wf.targets[0].roll = die(9, 6);
  wf.targets[2].roll = die(21, 18);
  same(mine(), [], "nothing left to roll");
  must(AttackWorkflow.allRolled(wf), "and resolution may begin");
});

check("outstandingFor in rolling: an adversary's attack at a character and an adversary is one Defense roll for the player and one Attack roll for the GM", () => {
  const wf = rollingFlow({
    id: "wf2", coordinatorUserId: "gm", initiatingUserId: "gm",
    attacker: { actorUuid: "Actor.o", tokenUuid: "", name: "Ogre", isPlayer: false, controllerUserIds: [] },
    maneuver: { attackId: "row1", weaponName: "Club", strike: "deliberate" },
    targets: [THREE[2], THREE[0]]
  });
  same(wf.targets.map(t => t.roller), ["defender", "attacker"], "who rolls each pairing");
  same(AttackWorkflow.outstandingFor(wf, { id: "p2", isGM: false }).map(o => [o.kind, o.targetId]), [["rollDefense", "t1"]], "Wren's player");
  same(AttackWorkflow.outstandingFor(wf, { id: "gm", isGM: true }).map(o => [o.kind, o.targetId]), [["rollAttack", "t2"]], "the GM, for the adversary at the adversary");
});

check("rollDataFor: every pairing resolves with its own die; a card from before 0.26.0 still reads its one shared die", () => {
  const wf = rollingFlow(flowSpec({ weaponId: "w1", strike: "quick" }, THREE));
  wf.targets[0].roll = die(12, 9);
  wf.targets[1].roll = die(20, 17);
  same([AttackWorkflow.rollDataFor(wf, wf.targets[0]).total, AttackWorkflow.rollDataFor(wf, wf.targets[1]).total], [12, 20], "two pairings, two dice");
  same(AttackWorkflow.rollDataFor(wf, wf.targets[2]), null, "a pairing with no die yet resolves with nothing");
  same(wf.attackRoll, null, "and the record's shared die is never set");
  const pub = AttackWorkflow.projectFor(wf);
  same([pub.targets[0].roll.total, pub.targets[1].roll.total, pub.targets[2].roll, pub.attackRoll], [12, 20, null, null], "the card's projection carries each die on its own row");
  // The old shape: the die on the workflow, a summary on each row the attacker rolled.
  const old = rollingFlow(flowSpec({ weaponId: "w1", strike: "quick" }, THREE));
  old.attackRoll = die(15, 12);
  for (const t of old.targets) t.roll = { total: 15, natural: 12, formula: "1d20 + 3" };
  same(old.targets.map(t => AttackWorkflow.rollDataFor(old, t).roll.total), [15, 15, 15], "the shared die reads for every row");
  same(AttackWorkflow.outstandingFor(old, { id: "p1", isGM: false }), [], "and nothing is offered to be rolled again");
  same(AttackWorkflow.rollDataFor(null, wf.targets[0]), null, "no workflow, no die");
});

check("rollCurrent: a die is stale only when the answer it was thrown at is older than the reveal, never because a sibling's die landed first", () => {
  const wf = rollingFlow(flowSpec({ weaponId: "w1", strike: "quick" }, THREE), 4);
  const t = wf.targets[0];
  must(AttackWorkflow.rollCurrent(t, 5), "thrown at the revision the dice began at");
  wf.revision = 9; // two sibling dice and a re-adoption later
  must(AttackWorkflow.rollCurrent(t, 5), "the workflow moving on does not make it stale");
  must(AttackWorkflow.rollCurrent(t, 4), "the reveal's own revision is current");
  must(!AttackWorkflow.rollCurrent(t, 3), "a die from before the reveal is stale");
  t.revealed.revision = 12; // Reset defenses, and a second reveal
  must(!AttackWorkflow.rollCurrent(t, 5), "a new reveal makes the old die stale");
  must(!AttackWorkflow.rollCurrent({ revealed: null }, 5), "nothing revealed, nothing to roll against");
  must(!AttackWorkflow.rollCurrent(t, undefined), "a submission with no revision is refused");
});

/* -------------------------------------------- */
/*  Multipliers and Divisors (0.26.0; v4.25)    */
/* -------------------------------------------- */

check("combineFactors: effects add their increase above 1 (two doublings triple, two halvings are a third), and a multiplier meets a divisor in that order", () => {
  same(combineFactors([{ times: 2 }, { times: 2 }]), { multiplier: 3, divisor: 1 }, "two effects that each double");
  same(combineFactors([{ over: 2 }, { over: 2 }]), { multiplier: 1, divisor: 3 }, "two effects that each halve");
  same(combineFactors([{ over: 2 }, { over: 3 }]), { multiplier: 1, divisor: 4 }, "a half and a third");
  same(combineFactors([{ times: 2 }, { over: 2 }]), { multiplier: 2, divisor: 2 }, "a doubling and a halving");
  same(combineFactors([null, undefined, {}, { times: 1 }, { over: 0 }, { times: "x" }]), { multiplier: 1, divisor: 1 }, "what is no effect changes nothing");
  same(applyFactors(6, [{ over: 2 }, { over: 2 }]), 2, "Speed 6 under two halvings is 2, not 1.5");
  same(Math.floor(applyFactors(7, [{ times: 2 }, { over: 3 }])), 4, "7 doubled then cut to a third, rounded down at the end");
});

check("combineDifficulties: two overlapping regions at x2 cost x3; quicker ground divides; impassable stays so", () => {
  same(combineDifficulties([2, 2]), 3, "two Difficult regions");
  same(combineDifficulties([2, 3]), 4, "Difficult over Greater Difficult");
  same(combineDifficulties([2]), 2, "one region is its own cost");
  same(combineDifficulties([]), 1, "open ground");
  same(combineDifficulties([2, 0.5]), 1, "a road through the mud");
  same(combineDifficulties([2, Infinity]), Infinity, "impassable stays impassable (the terrain data stores it as null)");
  same(combineDifficulties([2, 0]), 0, "a region of 0 makes the ground free, as multiplying did");
  same(combineDifficulties([0, Infinity]), Infinity, "and impassable wins over free");
  same(combineDifficulties([1, NaN, -2, null, undefined, "", "2"]), 2, "only a real cost counts, a numeric string among them");
});

check("the Travel Speed's effects: an Activity's pace and the terrain's meet (a half pace over Difficult Terrain is a third)", () => {
  same([ACTIVITY_SPEEDS.full.effect, ACTIVITY_SPEEDS.half.effect, ACTIVITY_SPEEDS.double.effect], [null, { over: 2 }, { times: 2 }], "the three paces");
  same([TERRAIN.normal.effect, TERRAIN.difficult.effect, TERRAIN.greater.effect], [null, { over: 2 }, { over: 3 }], "the three terrains");
  const speed = (pace, ground) => applyFactors(6, [ACTIVITY_SPEEDS[pace].effect, TERRAIN[ground].effect]);
  same([speed("half", "difficult"), speed("half", "greater"), speed("double", "difficult"), speed("double", "greater"), speed("full", "greater")],
    [2, 1.5, 6, 4, 2], "Speed 6 under each pair");
  same(speed("full", "normal"), 6, "neither is the plain Speed");
});

check("speedAfterLegs: the Critical Hit's halving and a Wound's meet at a third; a further Wound halves what is left; the final Wound is 0", () => {
  same(speedAfterLegs(6, {}), { speed: 6, beforeFinal: 6 }, "sound Legs");
  same(speedAfterLegs(6, { critical: true }).speed, 3, "the Critical Hit effect alone");
  same(speedAfterLegs(6, { wounds: 1 }).speed, 3, "one Wound alone, as through 0.25.0");
  same(speedAfterLegs(6, { critical: true, wounds: 1 }).speed, 2, "both: a third, not a quarter");
  same(speedAfterLegs(7, { critical: true, wounds: 1 }).speed, 2, "rounded down");
  same(speedAfterLegs(12, { wounds: 2 }).speed, 3, "a Large creature's second Wound halves what was left, as through 0.25.0");
  same(speedAfterLegs(12, { critical: true, wounds: 2 }).speed, 2, "a third, then halved");
  same(speedAfterLegs(6, { wounds: 2, final: true }), { speed: 0, beforeFinal: 3 }, "the final Wound: Speed 0, and a Crawl measured from the Speed before it");
  same(speedAfterLegs(6, { wounds: 1, final: true }), { speed: 0, beforeFinal: 6 }, "a capacity of one: the first Wound is the final one");
  same(ARMS_CRITICAL_PENALTY, -2, "the Arms' Critical Hit effect");
});

/* -------------------------------------------- */
/*  An attack ends with its Combat (0.23.0)     */
/* -------------------------------------------- */

check("AttackWorkflow.create and projectFor carry the Combat the attack was declared in (ruling 237)", () => {
  const inFight = AttackWorkflow.create({ ...flowSpec({ weaponId: "w1", strike: "quick" }), combatId: "c1" });
  same(inFight.combatId, "c1", "the record names its Combat");
  same(AttackWorkflow.projectFor(inFight).combatId, "c1", "and the card's projection carries it, or every reload would expire the attack");
  const outside = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick" }));
  same([outside.combatId, AttackWorkflow.projectFor(outside).combatId], ["", ""], "an attack outside an encounter names none");
  same(AttackWorkflow.create({ ...flowSpec({ weaponId: "w1" }), combatId: null }).combatId, "", "a combatId that is no string is none");
  same(AttackWorkflow.projectFor({ id: "old", phase: "defending", targets: [] }).combatId, "", "a record from before 0.23.0 projects none");
});

check("AttackWorkflow.expired: an unfinished attack is over once its Combat is gone (rulings 237 and 238)", () => {
  const wf = AttackWorkflow.create({ ...flowSpec({ weaponId: "w1", strike: "quick" }), combatId: "c1" });
  AttackWorkflow.transition(wf, "defending");
  same(AttackWorkflow.expired(wf, { combatExists: true }), false, "its Combat is still there");
  same(AttackWorkflow.expired(wf, { combatExists: false }), true, "its Combat was deleted");
  same(AttackWorkflow.expired(wf, { combatExists: false, heldElsewhere: true }), true, "a coordinator elsewhere does not keep an attack whose Combat is gone");
  same(AttackWorkflow.expired(wf), true, "and with nothing said, the Combat is taken as gone");

  const loose = AttackWorkflow.create(flowSpec({ weaponId: "w1", strike: "quick" }));
  AttackWorkflow.transition(loose, "defending");
  same(AttackWorkflow.expired(loose, {}), true, "no Combat, and nobody else coordinating it: a reload does not resume it");
  same(AttackWorkflow.expired(loose, { heldElsewhere: true }), false, "no Combat, but another connected user coordinates it: kept");
  same(AttackWorkflow.expired(loose, { combatExists: true }), true, "a Combat existing somewhere is not this attack's");
  same(AttackWorkflow.expired({ id: "old", phase: "rolling", targets: [] }, {}), true, "a record from before 0.23.0 reads as one with no Combat");

  for (const phase of ["complete", "cancelled"]) {
    same(AttackWorkflow.expired({ ...wf, phase }, { combatExists: false }), false, `a ${phase} attack is done, not expired`);
  }
  same(AttackWorkflow.expired(null), true, "no record at all is nothing to keep");
});

/* -------------------------------------------- */
/*  The Bind's rules (0.27.0)                   */
/* -------------------------------------------- */

// Two fighters and a bystander, as the callers hand them over: uuids and each side's own record.
const FIGHTER = "Actor.tess", FOE = "Actor.bandit", OTHER = "Actor.wren";
const bindOf = (state, partnerUuid, extra = {}) => ({ state, partnerUuid, mine: "Longsword", theirs: "Claw", id: "b1", zone: "", ...extra });

check("AttackWorkflow: the attack's Bind plan is on the record and survives the card (0.27.0)", () => {
  const wf = AttackWorkflow.create({ ...flowSpec({ weaponId: "w1", strike: "deliberate" }), combatId: "c1" });
  same(wf.bind, null, "undecided until every die is in");
  same(AttackWorkflow.projectFor(wf).bind, null, "and projected as undecided");
  wf.bind = { ends: [{ uuid: FIGHTER, bindId: "b1", reason: "strike" }], controlledAttack: true, zones: { t1: "torso" } };
  const pub = AttackWorkflow.projectFor(wf);
  same(pub.bind, wf.bind, "the projection carries the plan, or a coordinator rebuilt mid-resolution would decide again from Binds already ended");
  must(pub.bind !== wf.bind && pub.bind.zones !== wf.bind.zones, "as a copy, not the record's own object");
  same(AttackWorkflow.projectFor({ id: "old", phase: "resolving", targets: [] }).bind, null, "a record from before 0.27.0 projects none");
});

check("usesBoundImplement: the weapon the Bind names, a spell never, an adversary's only row always (rulings 270 and 273)", () => {
  const bind = bindOf("neutral", FOE);
  same(usesBoundImplement(bind, { source: "weapon", name: "Longsword" }), true, "the weapon named as the Bind's own");
  same(usesBoundImplement(bind, { source: "weapon", name: " longsword " }), true, "names as a player types them");
  same(usesBoundImplement(bind, { source: "weapon", name: "Dagger" }), false, "another weapon is an unbound one");
  same(usesBoundImplement(bind, { source: "spell", name: "Longsword" }), false, "a Cast is never made with the bound implement");
  same(usesBoundImplement({ ...bind, mine: "" }, { source: "weapon", name: "Dagger" }), true, "a Bind that names no implement holds whatever attacks");
  same(usesBoundImplement({ ...bind, mine: "Claw" }, { source: "attack", name: "Bite", rowCount: 1 }), true, "an adversary with one row attacks with it");
  same(usesBoundImplement({ ...bind, mine: "Claw" }, { source: "attack", name: "Bite", rowCount: 2 }), false, "with two rows the names decide");
  same(usesBoundImplement({ ...bind, mine: "Claw" }, { source: "attack", name: "Claw", rowCount: 2 }), true, "the row the Bind names");
  same(usesBoundImplement({ state: "" }, { name: "Longsword" }), false, "no Bind, no bound implement");
  same(usesBoundImplement(null), false, "nor with nothing at all");
});

check("attackBindPlan: the attacker's Bind ends for any attack, and says why (PHB v4.25, Ending a Bind)", () => {
  const defenders = [{ id: "t1", uuid: FOE, bind: bindOf("neutral", FIGHTER) }];
  const withIt = attackBindPlan({ attacker: { uuid: FIGHTER, bind: bindOf("neutral", FOE) }, defenders, maneuver: { source: "weapon", name: "Longsword" } });
  same(withIt.ends, [{ uuid: FIGHTER, bindId: "b1", reason: "strike" }], "the bound implement: the Strike resolves, then the Bind ends");
  same([withIt.controlledAttack, withIt.zones], [false, {}], "a neutral Bind leaves nothing on the card");
  const other = attackBindPlan({ attacker: { uuid: FIGHTER, bind: bindOf("neutral", FOE) }, defenders, maneuver: { source: "weapon", name: "Dagger" } });
  same(other.ends[0].reason, "unbound", "another weapon: the Bind ends before the roll");
  const cast = attackBindPlan({ attacker: { uuid: FIGHTER, bind: bindOf("neutral", FOE) }, defenders, maneuver: { source: "spell", name: "Flame Seed" } });
  same(cast.ends[0].reason, "cast", "a Cast is an attack (ruling 273)");
  const away = attackBindPlan({ attacker: { uuid: FIGHTER, bind: bindOf("neutral", FOE) }, defenders: [{ id: "t1", uuid: OTHER, bind: null }], maneuver: { source: "weapon", name: "Longsword" } });
  same(away.ends, [{ uuid: FIGHTER, bindId: "b1", reason: "strike" }], "the bound implement at a third party ends the Bind too");
  same(attackBindPlan({ attacker: { uuid: FIGHTER, bind: null }, defenders, maneuver: { source: "weapon", name: "Longsword" } }).ends, [], "an attacker in no Bind ends none");
  for (const end of [...withIt.ends, ...other.ends, ...cast.ends]) must(BIND_END_REASONS.includes(end.reason), `"${end.reason}" is a reason the card can say`);
});

check("attackBindPlan: a Controller's Strike at the partner resolves first, and the shield exception (rulings 270 and 276)", () => {
  const partner = { id: "t1", uuid: FOE, bind: bindOf("controlled", FIGHTER, { mine: "Claw", theirs: "Longsword", zone: "torso" }) };
  const controlling = bindOf("controlling", FOE, { zone: "torso" });
  const own = attackBindPlan({ attacker: { uuid: FIGHTER, bind: controlling }, defenders: [partner], maneuver: { source: "weapon", name: "Longsword" } });
  same(own.zones, { t1: "torso" }, "the bound weapon at the Controlled partner: the Zone rides on that pairing's card");
  same(own.ends, [{ uuid: FIGHTER, bindId: "b1", reason: "strike" }], "and the Bind ends once, from the attacker's side");

  const dagger = attackBindPlan({ attacker: { uuid: FIGHTER, bind: controlling, shields: [] }, defenders: [partner], maneuver: { source: "weapon", name: "Dagger" } });
  same([dagger.zones, dagger.ends[0].reason], [{}, "unbound"], "another weapon: the Bind ends first and the Zone is gone");

  const byShield = bindOf("controlling", FOE, { mine: "Round Shield", zone: "legs" });
  const sword = attackBindPlan({ attacker: { uuid: FIGHTER, bind: byShield, shields: ["Round Shield"] }, defenders: [partner], maneuver: { source: "weapon", name: "Longsword" } });
  same([sword.zones, sword.ends[0].reason], [{ t1: "legs" }, "strike"], "a shield holds the Control: the sword in the other hand resolves first");
  const elsewhere = attackBindPlan({ attacker: { uuid: FIGHTER, bind: byShield, shields: ["Round Shield"] }, defenders: [{ id: "t1", uuid: OTHER, bind: null }], maneuver: { source: "weapon", name: "Longsword" } });
  same([elsewhere.zones, elsewhere.ends[0].reason], [{}, "unbound"], "the exception is for a Strike at that foe, not at someone else");
  const spell = attackBindPlan({ attacker: { uuid: FIGHTER, bind: byShield, shields: ["Round Shield"] }, defenders: [partner], maneuver: { source: "spell", name: "Flame Seed" } });
  same([spell.zones, spell.ends[0].reason], [{}, "cast"], "and for a Strike, not a Cast");
  const neutralShield = attackBindPlan({ attacker: { uuid: FIGHTER, bind: bindOf("neutral", FOE, { mine: "Round Shield" }), shields: ["Round Shield"] }, defenders: [partner], maneuver: { source: "weapon", name: "Longsword" } });
  same(neutralShield.ends[0].reason, "unbound", "a shield in a neutral Bind is no exception: nothing is Controlled");

  // A sweep at a third party and the partner: decided once, so the partner's Zone is still read.
  const sweep = attackBindPlan({
    attacker: { uuid: FIGHTER, bind: controlling },
    defenders: [{ id: "t1", uuid: OTHER, bind: null }, { ...partner, id: "t2" }],
    maneuver: { source: "weapon", name: "Longsword" }
  });
  same([sweep.zones, sweep.ends.length], [{ t2: "torso" }, 1], "a sweep: the Zone for the partner's pairing, one end for the attack");
});

check("attackBindPlan: a Controlled implement's -2 rides on the attack, and a third party breaks a Control (PHB v4.25)", () => {
  const controlled = bindOf("controlled", FOE, { zone: "arms" });
  const plan = attackBindPlan({
    attacker: { uuid: FIGHTER, bind: controlled },
    defenders: [{ id: "t1", uuid: OTHER, bind: null }, { id: "t2", uuid: FOE, bind: bindOf("controlling", FIGHTER, { mine: "Claw", zone: "arms" }) }],
    maneuver: { source: "weapon", name: "Longsword" }
  });
  same(plan.controlledAttack, true, "the Controlled implement takes the -2 against every defender of the attack");
  same(plan.zones, {}, "the Controlled side has no Zone to exploit");
  same(plan.ends, [{ uuid: FIGHTER, bindId: "b1", reason: "strike" }], "the partner is no third party: the one Bind ends from the attacker's side");
  same(attackBindPlan({ attacker: { uuid: FIGHTER, bind: controlled }, defenders: [], maneuver: { source: "weapon", name: "Dagger" } }).controlledAttack, false, "another weapon takes no -2");
  same(attackBindPlan({ attacker: { uuid: FOE, bind: bindOf("controlled", FIGHTER, { mine: "Claw" }) }, defenders: [], maneuver: { source: "attack", name: "Bite", rowCount: 1 } }).controlledAttack, true, "an adversary's only row is the Controlled one");

  const third = attackBindPlan({
    attacker: { uuid: OTHER, bind: null },
    defenders: [{ id: "t1", uuid: FIGHTER, bind: bindOf("controlling", FOE, { id: "b7" }) }],
    maneuver: { source: "weapon", name: "Dagger" }
  });
  same(third.ends, [{ uuid: FIGHTER, bindId: "b7", reason: "thirdParty" }], "a third party attacks the fighter who has Control");
  const ally = attackBindPlan({
    attacker: { uuid: OTHER, bind: null },
    defenders: [{ id: "t1", uuid: FOE, bind: bindOf("controlled", FIGHTER) }],
    maneuver: { source: "weapon", name: "Dagger" }
  });
  same(ally.ends, [], "an ally attacking the Controlled creature breaks nothing");
  const byCast = attackBindPlan({
    attacker: { uuid: OTHER, bind: null },
    defenders: [{ id: "t1", uuid: FIGHTER, bind: bindOf("controlling", FOE) }, { id: "t2", uuid: FIGHTER, bind: bindOf("controlling", FOE) }],
    maneuver: { source: "spell", name: "Flame Seed" }
  });
  same(byCast.ends, [{ uuid: FIGHTER, bindId: "b1", reason: "thirdParty" }], "a third party's Cast does too, and a body named twice ends once");
  same(attackBindPlan({ attacker: { uuid: OTHER, bind: null }, defenders: [{ id: "t1", uuid: FIGHTER, bind: bindOf("neutral", FOE) }], maneuver: {} }).ends, [], "a neutral Bind is not broken by a third party");
});

check("movementBindPlan: a fighter's own movement ends its Bind, but for a Close and the larger of two far apart (rulings 269, 277, 278)", () => {
  const neutral = bindOf("neutral", FOE), controlling = bindOf("controlling", FOE), controlled = bindOf("controlled", FOE);
  for (const kind of ["move", "step", "rush", "crawl"]) {
    same(movementBindPlan({ bind: neutral, kind }).ends, true, `a ${kind} ends a neutral Bind`);
    same(movementBindPlan({ bind: controlled, kind, towardPartner: true }).ends, true, `a Controlled fighter's ${kind} ends it, toward the foe or not`);
  }
  same(movementBindPlan({ bind: controlling, kind: "step", towardPartner: true }), { ends: false, close: true, larger: false }, "the Controller's Step toward the foe is a Close");
  same(movementBindPlan({ bind: controlling, kind: "step", towardPartner: false }).ends, true, "a Step away is no Close");
  same(movementBindPlan({ bind: controlling, kind: "move", towardPartner: true }).ends, true, "a Move toward the foe is no Close: Close is a Step");
  same(movementBindPlan({ bind: neutral, kind: "step", towardPartner: true }).ends, true, "nor is a Step with nothing Controlled");
  same(movementBindPlan({ bind: neutral, kind: "move", sizeGap: 2, moverIsLarger: true }), { ends: false, close: false, larger: true }, "two Sizes apart, the larger can Move without breaking the Bind");
  same(movementBindPlan({ bind: neutral, kind: "move", sizeGap: 2, moverIsLarger: false }).ends, true, "the smaller cannot");
  same(movementBindPlan({ bind: neutral, kind: "move", sizeGap: 1, moverIsLarger: true }).ends, true, "one Size apart binds normally");
  same(movementBindPlan({ bind: { state: "" }, kind: "move" }), { ends: false, close: false, larger: false }, "no Bind, nothing to end");
});

check("bindOffer: a Graze forms a neutral Bind, a Miss hands over Control, and Parry follows its Talent (rulings 271 and 272)", () => {
  const guard = { defense: "guard", rigid: true, bindable: true };
  same(bindOffer({ ...guard, outcome: "graze", controllable: true }), { mode: "neutral", gainControl: false, riposte: false }, "a Graze: a neutral Bind");
  same(bindOffer({ ...guard, outcome: "miss", controllable: true }), { mode: "control", gainControl: false, riposte: false }, "a Miss: the defender gains Control");
  same(bindOffer({ ...guard, outcome: "miss", controllable: false }).mode, "neutral", "a Quick Strike that is Stopped forms at most a neutral Bind");
  same(bindOffer({ ...guard, outcome: "graze", controllable: true, parried: true }), { mode: "neutral", gainControl: true, riposte: false }, "a Parry's Graze: the neutral Bind and a free Gain Control");
  same(bindOffer({ ...guard, outcome: "miss", controllable: false, parried: true }).gainControl, true, "and so does a Parried Quick Strike's Miss");
  same(bindOffer({ ...guard, outcome: "miss", controllable: true, parried: true }), { mode: "control", gainControl: false, riposte: false }, "a Parry's Miss takes Control outright: nothing to attempt");
  same(bindOffer({ ...guard, outcome: "graze", controllable: true, parried: true, ownsRiposte: true }).riposte, true, "Riposte stands beside a Parry's Stop");
  same(bindOffer({ ...guard, outcome: "miss", controllable: true, parried: false, ownsRiposte: true }).riposte, false, "but only after a Parry");
  same(bindOffer({ ...guard, outcome: "hit", controllable: true }), null, "a Hit is not Stopped");
  same(bindOffer({ ...guard, defense: "evade", outcome: "miss", controllable: true }), null, "an Evade binds nothing");
  same(bindOffer({ ...guard, rigid: false, outcome: "miss", controllable: true }), null, "nor a Guard with nothing rigid in hand");
  same(bindOffer({ ...guard, bindable: false, outcome: "miss", controllable: true }), null, "nor an attack that offers nothing to bind");
});

check("gainControlOutcome: the row's four results, and an adversary's read from the other side (rulings 274 and 275)", () => {
  same(gainControlOutcome("critSuccess", { state: "neutral" }), { degree: "critSuccess", state: "controlling", pressed: true, changed: true }, "a Critical Success: Control, and the target Off-Guard");
  same(gainControlOutcome("success", { state: "controlled" }), { degree: "success", state: "controlling", pressed: false, changed: true }, "a Success: Control");
  same(gainControlOutcome("fail", { state: "controlled" }), { degree: "fail", state: "neutral", pressed: false, changed: true }, "a Failure breaks the foe's Control (ruling 274)");
  same(gainControlOutcome("fail", { state: "neutral" }).changed, false, "a Failure on a neutral Bind changes nothing");
  same(gainControlOutcome("critFail", { state: "neutral" }).state, "controlled", "a Critical Failure: the target Controls your weapon");
  // The adversary used it; the player rolled Guard: a Guard that beats the Threshold by ten is the
  // adversary's Critical Failure.
  same(gainControlOutcome("critSuccess", { state: "neutral", inverted: true }).state, "controlled", "the player's Critical Success is the adversary's Critical Failure");
  same(gainControlOutcome("success", { state: "controlled", inverted: true }).state, "neutral", "the player's Success is the adversary's Failure");
  same(gainControlOutcome("fail", { state: "neutral", inverted: true }), { degree: "success", state: "controlling", pressed: false, changed: true }, "the player's Failure is the adversary's Success");
  same(gainControlOutcome("critFail", { state: "neutral", inverted: true }).pressed, true, "the player's Critical Failure leaves the player Off-Guard");
  same(gainControlOutcome("nonsense"), null, "a degree nobody rolled is no result");
});

check("Size and Binds: the Sizes between two, a momentary Control and its window (ruling 278)", () => {
  same([sizeGap("medium", "medium"), sizeGap("small", "large"), sizeGap("huge", "medium"), sizeGap("tiny", "gargantuan")], [0, 2, 2, 5], "counted on the table's order");
  same(sizeGap("medium", "colossal"), 0, "a Size the table does not know counts as Medium");
  same([isLarger("large", "small"), isLarger("small", "large"), isLarger("medium", "medium")], [true, false, false], "which is the larger");
  same(momentaryFor("small", "large"), true, "the smaller Controls a creature two Sizes larger: momentary");
  same(momentaryFor("medium", "large"), false, "one Size apart binds normally");
  same(momentaryFor("large", "small"), false, "the larger's Control is an ordinary one");

  const record = { bindId: "b1", combat: "c1", combatant: "tess", begun: false };
  const now = { combat: "c1", bindId: "b1", controlling: true };
  same(momentaryStep(record, { ...now, ended: "tess" }), null, "the Opportunity it was taken in ending is not the next one");
  same(momentaryStep(record, { ...now, began: "bandit" }), null, "nor is someone else's beginning");
  same(momentaryStep(record, { ...now, began: "tess" }), "begin", "the Controller's next Opportunity begins: the window runs");
  same(momentaryStep({ ...record, begun: true }, { ...now, ended: "bandit" }), null, "someone else's Opportunity ending is not the end");
  same(momentaryStep({ ...record, begun: true }, { ...now, ended: "tess" }), "release", "that Opportunity ends: the Control falls back to a neutral Bind");
  same(momentaryStep(record, { ...now, controlling: false }), "drop", "the Control is gone already: forget the record");
  same(momentaryStep(record, { ...now, bindId: "b2" }), "drop", "another Bind's record is no one's");
  same(momentaryStep(record, { ...now, over: true }), "release", "the encounter ended: a momentary Control does not outlive it");
  same(momentaryStep(record, { ...now, combat: "c2" }), "release", "nor does it follow the fighter into another");
  same(momentaryStep(null, now), null, "no record, nothing to count");
});

/* -------------------------------------------- */
/*  What a Maneuver may be paid at (0.23.0)     */
/* -------------------------------------------- */

check("actionCostOptions: one number for a single cost, every number of a range, the two ends of an \"or\", none for a passive row (ruling 233)", () => {
  same(actionCostOptions({ cost: "1", costMax: "", costMode: "to" }), [1], "Aid, Stand: one cost");
  same(actionCostOptions({ cost: "0", costMax: "", costMode: "to" }), [0], "Release, Pass: free is still one option");
  same(actionCostOptions({ cost: "4" }), [4], "Field Patch, with no range written");
  same(actionCostOptions({ cost: "1", costMax: "3", costMode: "to" }), [1, 2, 3], "Leap, Demoralize, Strike");
  same(actionCostOptions({ cost: "1", costMax: "2", costMode: "to" }), [1, 2], "Trip, Shove, Sneak");
  same(actionCostOptions({ cost: "2", costMax: "3", costMode: "to" }), [2, 3], "Disarm, Calm Animal");
  same(actionCostOptions({ cost: "2", costMax: "4", costMode: "to" }), [2, 3, 4], "Cast");
  same(actionCostOptions({ cost: "0", costMax: "6", costMode: "to" }), [0, 1, 2, 3, 4, 5, 6], "Reload");
  same(actionCostOptions({ cost: "1", costMax: "6", costMode: "to" }), [1, 2, 3, 4, 5, 6], "Treat Persistent Damage");
  same(actionCostOptions({ cost: "1", costMax: "3", costMode: "or" }), [1, 3], "\"one or three\" is the two ends alone");
  same(actionCostOptions({ cost: "passive" }), [], "an Activity, an Endeavor");
  same(actionCostOptions({ cost: "passive", costMax: "3" }), [], "a passive row has no range either");
  same(actionCostOptions({ cost: "3", costMax: "3" }), [3], "a range of one number is that number");
  same(actionCostOptions({ cost: "3", costMax: "1" }), [3], "a far end below the near end is ignored");
  same(actionCostOptions({ cost: 2, costMax: 3 }), [2, 3], "numbers read as their keys");
  same(actionCostOptions({ cost: "9" }), [], "a cost the table does not know is no option");
  same(actionCostOptions(), [], "and nothing at all");
});

check("PAID_ELSEWHERE: the rows the system pays for another way are named by slug, say who pays, and are no built-in (ruling 235)", () => {
  // Strike left the table in 0.29.0 (ruling 295): its row Strikes now, as a built-in.
  same(Object.keys(PAID_ELSEWHERE).sort(), ["cast", "close", "crawl", "leap", "move", "rush", "squeeze", "step"], "the eight rows");
  // Close (0.27.0, ruling 277): the Controller's Step toward the foe is the Close, so the drag pays.
  same(PAID_ELSEWHERE[slugify(plainName("Close ❶"))], "STARWROUGHT.Cost.paidByClosing", "the Close row, by the name the sheet prints");
  for (const [slug, key] of Object.entries(PAID_ELSEWHERE)) {
    same(slugify(plainName(slug)), slug, `"${slug}" is the slug a row's plain name gives`);
    must(/^STARWROUGHT\.Cost\.paidBy[A-Z][A-Za-z]+$/.test(key), `"${slug}" names the line its card says (${key})`);
    must(!(slug in BUILT_IN_MANEUVERS), `"${slug}" is not also a built-in: a built-in pays itself and never reaches the table`);
  }
  same(PAID_ELSEWHERE[slugify(plainName("Strike ❶ to ❸"))], undefined, "the Strike row pays from its own buttons since 0.29.0");
  same(PAID_ELSEWHERE[slugify(plainName("Leap ❶ to ❸"))], "STARWROUGHT.Cost.paidByMoving", "the Leap row");
  same(PAID_ELSEWHERE[slugify(plainName("Aid ❶"))], undefined, "Aid pays from its own row");
  must(Object.isFrozen(PAID_ELSEWHERE), "the table is frozen");
});

check("BUILT_IN_MANEUVERS: the Strike row Strikes for a character and shows its card for an adversary (0.29.0, ruling 295)", () => {
  const slug = slugify(plainName("Strike ❶ to ❸"));
  same(slug, "strike", "the row's slug");
  must(typeof BUILT_IN_MANEUVERS[slug] === "function", "Strike is a built-in: the row Strikes, it does not only show its card");
  const calls = [];
  const character = { type: "character", strikeWith: options => { calls.push(options); return "struck"; } };
  same(BUILT_IN_MANEUVERS.strike(character, {}, { strike: "quick", dialog: false }), "struck", "it answers with the actor's own Strike");
  same(calls, [{ strike: "quick", dialog: false }], "handing over the kind the button named and the dialog switch, and nothing else");
  calls.length = 0;
  BUILT_IN_MANEUVERS.strike(character, {}, {});
  same(calls, [{ strike: undefined }], "the row's name names no kind (the actor's method reads that as the default) and no dialog switch");
  // An adversary has attack rows and no weapons: the row is still its card.
  const shown = [];
  const item = { toMessage: options => { shown.push(options); return "card"; } };
  const npc = { type: "npc", strikeWith: () => { throw new Error("an adversary does not Strike from the row"); } };
  same(BUILT_IN_MANEUVERS.strike(npc, item, { strike: "quick" }), "card", "an adversary gets the card");
  same(shown, [{ actor: npc }], "posted as that adversary");
  must(!("strike" in PAID_ELSEWHERE), "Strike is not also a row paid elsewhere");
});

check("BUILT_IN_MANEUVERS: Reload is a character's alone, so an adversary's Reload row stays a plain Maneuver (0.29.0)", () => {
  must(typeof BUILT_IN_MANEUVERS.reload === "function", "Reload is a built-in");
  same([...CHARACTER_BUILT_INS], ["reload"], "the one built-in an adversary is passed by for: it loads a weapon Item, and an adversary has none");
  for (const slug of CHARACTER_BUILT_INS) must(slug in BUILT_IN_MANEUVERS, `"${slug}" names a built-in`);
  must(!CHARACTER_BUILT_INS.has("strike"), "Strike is not listed: for an adversary the built-in itself shows the card, since the plain path would charge for it");
  // The built-in hands the row and Finish's word to the actor's own method.
  const calls = [];
  const actor = { type: "character", reloadWeapon: options => { calls.push(options); return "loaded"; } };
  const row = { name: "Reload" };
  same(BUILT_IN_MANEUVERS.reload(actor, row, { prepared: true, dialog: false }), "loaded", "it answers with the actor's own Reload");
  same(BUILT_IN_MANEUVERS.reload(actor, row, {}), "loaded", "and again from the row");
  same(calls, [{ item: row, prepared: true }, { item: row, prepared: false }], "the row, and whether Finish is coming back; nothing else");
});

check("BUILT_IN_MANEUVERS: the Pass row is the actor's own Pass, under the slug its name gives (0.23.1)", () => {
  const slug = slugify(plainName("Pass ⓿"));
  same(slug, "pass", "the row's slug");
  must(typeof BUILT_IN_MANEUVERS[slug] === "function", "Pass is a built-in: the row Passes, it does not only show its card");
  must(typeof BUILT_IN_MANEUVERS[slugify(plainName("Pass"))] === "function", "and under the name the pack ships, with no glyph");
  // The row is another door to the one method: what the built-in returns is what `pass` returns.
  const calls = [];
  const actor = { pass: () => { calls.push("pass"); return "passed"; } };
  same(BUILT_IN_MANEUVERS.pass(actor, {}, {}), "passed", "it answers with the actor's own Pass");
  same(calls, ["pass"], "called once, with nothing else done beside it");
  must(!("pass" in PAID_ELSEWHERE), "Pass is not also a row paid elsewhere");
  for (const name of ["recenter", "raise-a-shield", "pass"]) must(name in BUILT_IN_MANEUVERS, `"${name}" is still a built-in`);
  // Gain Control (0.27.0): the row is the actor's own method, as Recenter's is, and pays itself.
  const gained = [];
  const fighter = { gainControl: options => { gained.push(options); return "rolled"; } };
  const row = { name: "Gain Control ❶" };
  same(BUILT_IN_MANEUVERS[slugify(plainName(row.name))](fighter, row, {}), "rolled", "the Gain Control row runs the actor's own Gain Control");
  same(gained, [{ item: row }], "handed the row, and no dialog word of its own");
  BUILT_IN_MANEUVERS["gain-control"](fighter, row, { dialog: false });
  same(gained[1], { item: row, dialog: false }, "a Shift-click's no-dialog rides through");
  must(!("gain-control" in PAID_ELSEWHERE), "Gain Control is not also a row paid elsewhere");
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

check("0.31.0: EFFECT(<name>) is read into its own key, the roller's after IF and the other party's after IFT (ruling 307)", () => {
  same(emptyOps().has, null, "the empty record asks for none");
  same(readEffectLine("ATK: 1 situation; IFT: EFFECT(prone)").ops.has, [{ name: "Prone", slug: "prone", condition: "prone", on: "other" }], "IFT: a Condition on the other party");
  same(readEffectLine("DEF: 1 situation; IF: EFFECT(Taking Cover)").ops.has, [{ name: "Taking Cover", slug: "taking-cover", condition: null, on: "self" }], "IF: a named Effect on the roller");
  same(readEffectLine("DEF: 1 situation; IF: EFFECT( off guard )").ops.has[0], { name: "Off-Guard", slug: "offguard", condition: "offGuard", on: "self" }, "a Condition however it is spaced");
  same(readEffectLine("ATK: 1 situation; IF: EFFECT(Blessed); IFT: EFFECT(prone)").ops.has.map(h => [h.slug, h.on]), [["blessed", "self"], ["prone", "other"]], "one of each on a line");
  same(readEffectLine("ATK: 1 situation; IF: EFFECT(prone); IFT: EFFECT(prone)").ops.has.length, 2, "the same name on both sides is two conditions");
  const both = readEffectLine("SUBORDINATE: Aid; IF: EFFECT(Aid, used); IF: EFFECT(Blessed)", { context: { resolve } }).ops;
  same([both.used, both.has.map(h => h.slug)], [{ name: "Aid", slug: "aid" }, ["blessed"]], "`used` and the plain form are apart, and one line may hold both");
  throws(() => readEffectLine("ATK: 1 situation; IF: EFFECT(prone); IF: EFFECT(Prone)"), /IF: EFFECT\(Prone\) is given twice/, "twice on one side");
  throws(() => readEffectLine("ATK: 1 situation; IFT: EFFECT(exposed head)"), /Exposed Zone/, "an Exposed Zone is no Effect");
  throws(() => readEffectLine("ATK: 1 situation; IFT: EFFECT(Rock or Roll)"), /joins conditions/, "a name that holds `or`");
  throws(() => readEffectLine("ATK: 1 situation; IFT: EFFECT(none)"), /cannot be an Effect's name/, "a word that means something else");
  throws(() => readEffectLine("ATK: 1 situation; IFT: EFFECT(prone, theirs)"), /the second word is `used` \(a roll of yours has just used the Effect up\) or `mine` \(you put it there\)/, "another second word");
  // The review of 0.31.0.
  throws(() => readEffectLine("ATK: 1 situation; IF: EFFECT(not prone)"), /`not` goes in front of the whole condition/, "`not` is no part of a name: a bonus line has none yet");
  throws(() => readEffectLine("ATK: 1 situation; IFT: EFFECT(Fatigued 2)"), /a Condition's value is not compared yet/, "a value is not compared");
  same(readEffectLine("ATK: 1 situation; IFT: EFFECT(Hunter's Mark)").ops.has[0], { name: "Hunter's Mark", slug: "hunter-s-mark", condition: null, on: "other" }, "a straight apostrophe inside a word is no opening quote");
  same([readEffectLine("CHECK: 1 situation, guile; IF: CLAIM(when it's raining)").ops.claim.text, readEffectLine("CHECK: 1 situation, guile; IF: CLAIM('when trading')").ops.claim.text], ["when it's raining", "when trading"], "nor in a claim's words, and a quoted claim still reads");
  throws(() => readEffectLine("CHECK: 1 situation, guile; IF: CLAIM('when trading)"), /an opening ' has no closing '/, "an opening quote that never closes is still told so");
  must(/INIT has no other party, so IFT: EFFECT\(Prone\) could never hold/.test(bonusError("[EFFECT INIT: 1 situation; IFT: EFFECT(prone)]")), "an Initiative has no other party");
  must(/SPEED has no other party/.test(bonusError("[EFFECT SPEED: 1 situation; IFT: EFFECT(prone)]")), "nor has a Move");
  same(bonusRule("[EFFECT INIT: 1 situation; IF: EFFECT(Blessed)]").has[0].on, "self", "an Effect of your own on an INIT line is fine");
  must(/does not read IFT: EFFECT\(Prone\) beside IF: CLAIM/.test(bonusError("[EFFECT ATK: 1 situation; IF: CLAIM(when flanking); IFT: EFFECT(prone)]")), "a claim is asked before the other party is known");
  same(bonusRule("[EFFECT ATK: 1 situation; IF: CLAIM(when flanking); IF: EFFECT(Blessed)]").has[0].on, "self", "a claim beside an Effect of your own is fine");

  // The stored rule: `has` rides only when the line asks for one.
  const prone = bonusRule("[EFFECT ATK: 1 situation; IFT: EFFECT(prone)]");
  const cover = bonusRule("[EFFECT DEF: 2 situation; IF: EFFECT(Taking Cover)]");
  same(prone.has, [{ name: "Prone", slug: "prone", condition: "prone", on: "other" }], "copied onto the bonus rule");
  must(!("has" in bonusRule("[EFFECT ATK: 1 situation]")), "a rule that asks for none is stored exactly as before");
  same([summarize(prone), summarize(cover), summarize(bonusRule("[EFFECT DEF: 1 situation; IF: EFFECT(prone)]")), summarize(bonusRule("[EFFECT ATK: 1 situation; IFT: EFFECT(Marked)]"))],
    ["+1 Situation bonus to Attacks, against a creature that is Prone", "+2 Situation bonus to Defenses, while you have Taking Cover", "+1 Situation bonus to Defenses, while you are Prone", "+1 Situation bonus to Attacks, against a creature with Marked"], "As read");
  same(bonusRule("[EFFECT DEF: 1 situation; FOR: self; IF: EFFECT(prone)]").has.length, 1, "a FOR that names the owner alone is fine");

  // Refused beside a FOR that reaches others, an aura's ring included, and by every other kind.
  must(/beside a FOR that reaches others/.test(bonusError("[EFFECT DEF: 1 situation; FOR: allies 15; IF: EFFECT(prone)]")), "a FOR that reaches others");
  const ring = parseAutomation("[AURA 15 allies; DEF: 1 situation; IFT: EFFECT(prone)]", { resolve, itemType: "talent" });
  must(ring.errors.length === 1 && /beside a FOR that reaches others/.test(ring.errors[0].message), "and so an `[AURA ...]` block");
  const onRow = cell => parseAutomation(cell, { resolve, itemType: "effect" }).errors[0]?.message ?? "";
  for (const [cell, tag] of [["IMMUNE: prone", "IMMUNE"], ["USE: Presence, Origin, aid", "USE"], ["REROLL: diplomacy; IF: RESULT(critical failure)", "REROLL"], ["MARK: enemies", "MARK"], ["IGNORE: terrain", "IGNORE"]]) {
    must(onRow(`${cell}; IF: EFFECT(Blessed)`) === `${tag} does not take EFFECT(<name>)`, `${tag} refuses it after IF`);
    must(onRow(`${cell}; IFT: EFFECT(prone)`) === `${tag} does not take EFFECT(<name>)`, `${tag} refuses it after IFT`);
  }
  // (GIVE, PERMIT, ALTER and SUBORDINATE are asserted beside their `used` refusals, further down.)

  // What the helpers say of a rule.
  same([needsMoment(cover), needsMoment(prone), readsOtherEffects(cover), readsOtherEffects(prone), readsOtherEffects({})], [false, true, false, true, false], "an Effect on the roller is the sheet's; one on the other party needs the moment");
  same([effectConditions({}), effectConditions({ has: null }), effectConditions({ has: "prone" }), effectConditions({ has: [{ slug: "prone" }] }), effectConditions({ has: [{ slug: "prone", on: "self" }] }).length], [[], [], null, null, 1], "none; and a hand-stored value that is no list of entries is not one");
  const lists = (self, other) => ({ self: self ? effectList(self) : null, other: other ? effectList(other) : null });
  same([effectHolds({}, lists(null, null)), effectHolds(cover, lists({ effects: [{ name: "Taking Cover" }] }, null)), effectHolds(cover, lists({ effects: [] }, null)), effectHolds(cover, lists(null, { effects: [{ name: "Taking Cover" }] }))],
    [true, true, false, false], "a rule that asks for none holds; the roller has it; has not; it is on the wrong side");
  same([effectHolds(prone, lists({}, { statuses: ["prone"] })), effectHolds(prone, lists({ statuses: ["prone"] }, { statuses: [] })), effectHolds(prone, lists({}, null)), effectHolds({ has: "prone" }, lists({ statuses: ["prone"] }, { statuses: ["prone"] }))],
    [true, false, false, false], "the other party is Prone; only the roller is; nobody known; a malformed rule never holds");
});

check("0.31.0: a bonus waits on an Effect: the sheet reads the roller's, the roll reads the other party's (rulings 307 and 308)", () => {
  const talent = talentWith("Opportunist", [
    "[EFFECT ATK: 1 situation; IFT: EFFECT(prone)]",
    "[EFFECT DEF: 2 situation, guard; IF: EFFECT(Taking Cover)]",
    "[EFFECT CHECK: 1 situation, intimidation; IFT: EFFECT(frightened)]",
    "[EFFECT ATK: 3 situation; IF: EFFECT(Blessed); IFT: EFFECT(Marked)]"
  ].join("\n"));
  const actor = rulesActor([talent]);
  actor.statuses = new Set();
  actor.effects = [];
  const creature = (statuses = [], effects = [], extra = {}) => ({ actor: { statuses: new Set(statuses), effects: effects.map(name => ({ name })) }, uuid: "Actor.bandit", tokenUuid: "Scene.s.Token.b", name: "Bandit", ...extra });
  const values = (context) => ruleModifiers(actor, context).applied.map(m => [m.label, m.value]);

  // IFT: the other party's list, where there is one.
  same(values({ kind: "attack", slug: "melee", item: null, other: creature(["prone"]) }), [["Opportunist", 1]], "an attack at a Prone creature");
  same(values({ kind: "attack", slug: "melee", item: null, other: creature([]) }), [], "not at a standing one");
  same(values({ kind: "attack", slug: "melee", item: null, other: null }), [], "the blind die knows nobody");
  same(values({ kind: "attack", slug: "melee", item: null, other: creature(["prone"]), pairingOnly: true }), [["Opportunist", 1]], "the pairing reads it, as it reads MARKED");
  same(values({ kind: "attack", slug: "melee", item: null, other: creature([]), pairingOnly: true }), [], "and not against a standing defender");
  same(values({ kind: "attack", slug: "melee", item: null, other: { actor: null, uuid: null, tokenUuid: "Scene.s.Token.b", name: "Bandit" } }), [], "a token with no Actor known has no list");
  // Ruling 308: a check read against a target's Threshold has that creature as its other party.
  same(values({ kind: "check", slug: "intimidation", item: null, other: creature(["frightened"]) }), [["Opportunist", 1]], "a check against a Frightened creature");
  same(values({ kind: "check", slug: "intimidation", item: null, other: creature(["prone"]) }), [], "not against one that is merely Prone");

  // IF: the roller's own list, which the sheet knows.
  const guard = { kind: "defense", slug: "guard", item: null };
  same(values({ ...guard, staticOnly: true }), [], "no Effect, no bonus in the sheet's Threshold");
  actor.effects = [{ name: "Taking Cover" }];
  same(values({ ...guard, staticOnly: true }), [["Opportunist", 2]], "the Effect is on: the sheet's Threshold has it");
  same(values({ ...guard, momentOnly: true, other: creature([]) }), [], "and the roll does not count it a second time");
  actor.effects = [{ name: "Taking Cover", disabled: true }];
  same(values({ ...guard, staticOnly: true }), [], "a disabled effect is not on");
  actor.effects = [];
  actor.system.effects = [{ label: "Taking Cover" }];
  same(values({ ...guard, staticOnly: true }), [["Opportunist", 2]], "a custom effect row of that label counts");
  actor.system.effects = [];
  same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, other: creature(["prone"]), staticOnly: true }).applied, [], "the sheet's pass never reads the other party");

  // Both on one line: each side must hold.
  actor.effects = [{ name: "Blessed" }];
  same(values({ kind: "attack", slug: "melee", item: null, other: creature([], ["Marked"]) }), [["Opportunist", 3]], "you are Blessed and it is Marked");
  same(values({ kind: "attack", slug: "melee", item: null, other: creature([], []) }), [], "it is not Marked");
  actor.effects = [];
  same(values({ kind: "attack", slug: "melee", item: null, other: creature([], ["Marked"]) }), [], "you are not Blessed");

  // A rule stored by hand with something that is no list under `has` is left out, never applied always.
  const broken = { type: "talent", name: "Broken", system: { rules: [{ kind: "bonus", line: 1, text: "", value: 5, type: "situation", to: { name: "Attacks", slug: "attacks", type: "scope" }, has: "prone" }] } };
  const other = rulesActor([broken]);
  same(ruleModifiers(other, { kind: "attack", slug: "melee", item: null, other: creature(["prone"]) }).applied, [], "a malformed `has` never holds");

  // The review of 0.31.0, a defect since 0.13.0: an `INIT` line on the DEFAULT Initiative, which
  // is rolled with a Defense Constellation (Awareness) and so asked with `momentOnly`. A bonus to
  // Initiative is to no Defense, so the sheet's Defense pass never folded it in either.
  const quick = talentWith("Quick", "[EFFECT INIT: 1 situation]\n[EFFECT INIT: 2 situation; IF: EFFECT(Blessed)]\n[EFFECT DEF: 1 situation, awareness]");
  const runner = rulesActor([quick]);
  runner.statuses = new Set();
  runner.effects = [];
  const got = context => ruleModifiers(runner, context).applied.map(m => m.value);
  same(got({ kind: "initiative", slug: "awareness", item: null, momentOnly: true }), [1], "an INIT line reaches an Initiative rolled with Awareness; the Defense's own bonus was the sheet's already");
  same(got({ kind: "initiative", slug: "stealth", item: null }), [1], "as it always reached one rolled with a Skill");
  runner.effects = [{ name: "Blessed" }];
  same(got({ kind: "initiative", slug: "awareness", item: null, momentOnly: true }), [1, 2], "and one that waits on an Effect of your own");
  same(got({ kind: "defense", slug: "awareness", item: null, momentOnly: true }), [], "never on the Defense itself: a Threshold read and a Defense roll are no Initiative");
  same(got({ kind: "defense", slug: "awareness", item: null, staticOnly: true }), [1], "where the sheet's pass has the Defense's own bonus and no INIT line");

  // The pairing is resolved with the die's own modifiers, as the one roll they are (the review;
  // ruling 125: one circumstance is counted once). `SwCheck.resolveAgainst` adds the difference.
  const die = [{ label: "Might", value: 2 }, { label: "Opportunist", value: 1, type: "situation", source: "rule:Opportunist" }];
  const pairing = [{ label: "Opportunist", value: 2, type: "situation", source: "rule:Opportunist" }];
  same([resolveModifiers(die).total, resolveModifiers([...die, ...pairing]).total - resolveModifiers(die).total, resolveModifiers(pairing).total], [3, 1, 2],
    "a Talent's +1 on the die and its +2 against a Prone defender are +2 in all, so the pairing adds 1 and not 2");
  const stranger = [{ label: "Oathbound", value: 1, type: "condition", source: "rule:Oathbound" }];
  same(resolveModifiers([...die, ...stranger]).total - resolveModifiers(die).total, 1, "another Talent's line at the pairing adds its whole worth");
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
  "CHECK: -2 gear, stealth",
  // 0.21.0: the substitution, whole and with one term kept.
  "USE: Presence, Origin, aid",
  "USE: same, Origin, aid; IF: RANK(Origin >= expert); LIMIT: encounter",
  "USE: Presence, same, aid; IF: RANK(roll = untrained)",
  // 0.22.0: a Talent's change to what a Maneuver gives. A GIVE line is not here: it reads on a
  // Maneuver's row alone, neither in a Talent's cell nor on a custom effect row (its own section).
  "ALTER: Aid.critical-failure; VALUE: nothing",
  "ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2; IF: RANK(Origin >= expert)",
  "ALTER: Aid.duration; VALUE: encounter"
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

check("0.18.1: a ] inside a CLAIM's parentheses does not end the block, and an unclosed block still says so", () => {
  const block = "[EFFECT CHECK: 2 situation, guile; IF: CLAIM(when trading [per the table])]";
  const parsed = parseAutomation(block, { resolve, itemType: "talent" });
  same(parsed.errors, [], "no error");
  same(parsed.rules.map(r => [r.kind, r.claim?.text, r.text]), [["bonus", "when trading [per the table]", block]], "the claim text keeps its brackets and the rule's text is the whole block");
  const two = parseAutomation(`${block}[TRAIT Human]`, { resolve, itemType: "talent" });
  same(two.rules.map(r => r.kind), ["bonus", "trait"], "the block after it still reads");
  must(/a \[ has no closing \]/.test(parseAutomation("[EFFECT CHECK: 1 condition; IF: CLAIM(open]", { resolve, itemType: "talent" }).errors[0]?.message ?? ""), "a ] inside an unclosed parenthesis closes nothing");
});

check("0.18.1: the legacy test looks for the retired operators alone, so a descriptor word is the kind's to refuse", () => {
  const onRow = cell => parseAutomation(cell, { resolve, itemType: "effect" }).errors[0]?.message ?? "";
  must(onRow("CHECK: 1 condition, diplomacy, DIFFERENT") !== LEGACY_REFUSAL, "a trailing DIFFERENT is not the 0.13.0 form");
  must(/takes one descriptor|is not a Constellation/.test(onRow("CHECK: 1 condition, diplomacy, DIFFERENT")), "and gets the bonus kind's own message");
  must(onRow("IGNORE: terrain, mud, Visible") !== LEGACY_REFUSAL, "a trailing Visible is not the 0.13.0 form");
  must(onRow("mark: enemies, MARKED") === LEGACY_REFUSAL && onRow("mark: enemies, IF(Origin=Expert)") === LEGACY_REFUSAL, "the retired operators still are");
});

check("0.18.1: a ticked claim on a one-roll custom effect carries the claim's spend AND the row's removal", () => {
  const parsed = parseAutomation("CHECK: 2 situation, diplomacy; IF: CLAIM(this once)", { resolve, itemName: "Once", itemType: "effect" });
  same(parsed.errors, [], "the row parses");
  const actor = { items: [], system: { effects: [{ id: "row00001", label: "Once", text: "CHECK: 2 situation, diplomacy; IF: CLAIM(this once)", duration: "roll", rules: parsed.rules }] } };
  actor.system.proficiency = () => ({ rank: "trained" });
  actor.system.rules = collectRules(actor);
  const unarmed = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained" });
  same(unarmed.offered.map(o => [o.ticked, o.marks]), [[false, [{ key: "row00001", per: "effect" }]]], "unarmed: the offer carries the row's removal for a ticked box");
  same(unarmed.marks, [], "nothing filed by the engine for an offer");
  actor.flags = { starwrought: { rules: { armed: { "effect:row00001": { at: 1 } } } } };
  const armed = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained" });
  same(armed.offered.map(o => [o.ticked, o.mark, o.marks]), [[true, { key: "effect:row00001", per: "claim" }, [{ key: "effect:row00001", per: "claim" }, { key: "row00001", per: "effect" }]]], "armed: both marks, the claim's first");
  const read = ruleModifiers(actor, { kind: "check", slug: "diplomacy", item: null, rank: "trained", read: true });
  same(read.marks.map(m => `${m.per}:${m.key}`).sort(), ["claim:effect:row00001", "effect:row00001"], "a Threshold read with the claim armed files both itself");
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
  must(nonsense.message === "EFFECT wraps an effect line, `[EFFECT <tag>: ...]`: CHECK, SKILL, ATK, DEF, INIT, SPEED, IMMUNE, MARK, REROLL, IGNORE, USE, GIVE, ALTER, PERMIT, SUBORDINATE, APPLY, REMOVE", `a word that is no tag: "${nonsense.message}"`);
  must(nonsense.text === "[EFFECT nonsense: 1]", "under the block's text");
  must(err("[EFFECT]").message === "EFFECT is written `[EFFECT <tag>: ...]`, as in `[EFFECT IMMUNE: prone; LIMIT: encounter]`", "an empty EFFECT");
  // A tag with its colon lost is told the colon (0.36.0, the review), not the list of tags.
  must(err("[EFFECT IMMUNE]").message === "IMMUNE is an effect tag and takes a colon: write `[EFFECT IMMUNE: ...]`", "a tag without its colon is told the colon");
  must(err("[EFFECT SKILL 1 situation]").message === "SKILL is an effect tag and takes a colon: write `[EFFECT SKILL: 1 situation]`", "and with what followed it");
  // CHECK is a block of its own since 0.34.0, as SPEED has been since 0.16.0: without its colon
  // inside EFFECT it is told its block.
  must(err("[EFFECT CHECK]").message.startsWith("CHECK is a block of its own, not an effect"), "CHECK without its colon is told its own block");
  must(err("[EFFECT CHECK: 1 condition, aid").message === "a [ has no closing ]", "an unclosed block");
  same(FEATURE_KEYWORD_LIST.at(-1), "EFFECT", "FEATURE_KEYWORD_LIST ends with EFFECT");
  must(/EFFECT/.test(err("[FLY 30]").message) && /an effect goes in `\[EFFECT <tag>: \.\.\.\]`/.test(err("[FLY 30]").message), "the keyword refusal names EFFECT");
  must(/in brackets as \[EFFECT \.\.\.\]/.test(err(`${UNKNOWN_KIND}: 1`).message), "the unknown-kind message names the block");
  const mixed = cellRules("[TRAIT Human][EFFECT CHECK: 1 condition, aid][AURA 15 allies][EFFECT IMMUNE: prone]");
  same(mixed.map(r => [r.kind, r.text, r.line]), [["trait", "[TRAIT Human]", 1], ["bonus", "[EFFECT CHECK: 1 condition, aid]", 1], ["aura", "[AURA 15 allies]", 1], ["prevent", "[EFFECT IMMUNE: prone]", 1]], "four blocks, four rules, each under its own text");
  const partly = parseAutomation("[TRAIT Human][EFFECT CHECK: 0 condition, aid][SIZE Medium]", { resolve });
  same([partly.rules.map(r => r.kind), partly.errors.map(e => [e.text, e.message])], [["trait", "size"], [["[EFFECT CHECK: 0 condition, aid]", "a bonus of 0 does nothing"]]], "a bad block fails alone; its neighbours still parse");
});

check("0.30.0: [REACH N] sets Natural Reach and [REACH +N] adjusts it (ruling 301)", () => {
  same(bare(cellRules("[REACH 2]")[0]), { feet: 2, mode: "set", kind: "reach", line: 1 }, "an Ancestry's Natural Reach");
  same(bare(cellRules("[REACH 0]")[0]), { feet: 0, mode: "set", kind: "reach", line: 1 }, "a Tiny creature's reach is 0, and a set of 0 says so");
  same(bare(cellRules("[REACH 3 ft]")[0]).feet, 3, "feet may be written");
  same([bare(cellRules("[REACH +1]")[0]), bare(cellRules("[REACH -1]")[0])].map(r => [r.feet, r.mode]), [[1, "add"], [-1, "add"]], "an adjustment, either way");
  same(cellRules("[TRAIT Human][SIZE Medium][REACH 2][SPEED 6]").map(r => r.kind), ["trait", "size", "reach", "speed"], "beside the other chassis blocks");
  const refused = text => parseAutomation(text, { resolve, itemName: "test", itemType: "talent" }).errors[0]?.message ?? "";
  must(/an adjustment of 0 does nothing/.test(refused("[REACH +0]")), "an adjustment of 0 is refused");
  must(/REACH is written `\[REACH 2\]`/.test(refused("[REACH long]")), "a word is told the shape");
  must(/REACH is written `\[REACH 2\] or \[REACH \+1\]`/.test(refused("[REACH]")), "an empty block is told the shape");
  must(/REACH is a block of its own, not an effect/.test(refused("[EFFECT REACH: 2]")), "wrapped in EFFECT it is told its own block");
  const summary = text => summarize(cellRules(text)[0]);
  same([summary("[REACH 2]"), summary("[REACH +1]"), summary("[REACH -1]")], ["Natural Reach 2 ft", "Natural Reach +1 ft", "Natural Reach -1 ft"], "As read");
  // The arithmetic the character's data model uses (config/sizes.mjs).
  same([naturalReach("medium"), naturalReach("small"), naturalReach("tiny"), naturalReach("large"), naturalReach("nonsense")], [2, 1, 0, 4, 2], "with no block, the Size's own");
  same([naturalReach("medium", { set: 3 }), naturalReach("small", { set: 2 }), naturalReach("large", { set: 0 })], [3, 2, 0], "a set stands over the Size, 0 included");
  same([naturalReach("medium", { add: 1 }), naturalReach("medium", { set: 3, add: 1 }), naturalReach("small", { set: null, add: -1 })], [3, 4, 0], "an adjustment adds to either");
  same(naturalReach("tiny", { add: -2 }), 0, "never below 0");
  same([naturalReach("medium", {}), naturalReach("medium", { set: undefined, add: undefined })], [2, 2], "nothing said is nothing changed");
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
  // An effect tag in a block of its own (0.36.0, the review): told the EFFECT block and the colon.
  must(err("[MARK enemies]") === "\"MARK\" is an effect tag, and an effect goes in an EFFECT block with a colon after the tag: write `[EFFECT MARK: enemies]`", "an effect kind as a block");
  must(err("[SKILL 1 situation]") === "\"SKILL\" is an effect tag, and an effect goes in an EFFECT block with a colon after the tag: write `[EFFECT SKILL: 1 situation]`", "SKILL as a block");
  must(/is not a feature keyword/.test(err("[NONSENSE 1]")), "a word that is no tag and no keyword is still no feature keyword");
  must(err("AURA: 15 allies") === LEGACY_REFUSAL, "an aura as a tag");
  must(/is not a Maneuver/.test(err("[MANEUVER Fly]")), "a Maneuver that is no row");
  must(/is not a Size/.test(err("[SIZE Vast]")), "a bad Size");
});

/* -------------------------------------------- */
/*  0.21.0: the substitute kind (USE) and the substitutions hook point */
/* -------------------------------------------- */

/** A resolver that knows a group, as the build's does: Archery is a group within Ranged. */
const groupResolve = name => {
  const lower = String(name).trim().toLowerCase();
  if (lower === "archery") return { type: "constellation", slug: "archery", name: "Archery", group: true, parent: "Ranged" };
  return resolve(name);
};

/** Parse one USE cell and return the one error's message. */
const useError = (cell, context = { resolve: groupResolve }) => bonusError(cell, context);

check("substitute: registered with its substitutions hook, no aliases, and no use hook", () => {
  const kind = kindOf("substitute");
  must(kind && kind.id === "substitute", "kindOf('substitute')");
  same(kind.aliases, [], "no aliases");
  same(Object.keys(kind.hooks), ["substitutions"], "one hook point");
  must(typeof kind.hooks.substitutions === "function", "hooks.substitutions is a function");
  must(EFFECT_TAGS.use === "substitute", "the USE tag names the kind");
  // A kind with `hooks.use` draws a Use control on the Talent's row and runs when it is used: a
  // substitution is never used, so its hook is not that one.
  must(!usableByRule({ system: { rules: cellRules("[EFFECT USE: Presence, Origin, aid]") } }), "a USE line draws no Use control");
});

check("substitute: every accepted form, without a resolver, stored whole", () => {
  const text = "[EFFECT USE: Presence, Origin, aid]";
  same(bonusRule(text), {
    attribute: "presence", proficiency: { constellation: "origin", name: "Origin" },
    to: { name: "aid", slug: "aid", type: null }, when: null, limit: null,
    kind: "substitute", line: 1, text
  }, "Cooperative Instinct's cell");
  const kept = bonusRule("[EFFECT USE: same, Origin, aid]");
  same([kept.attribute, kept.proficiency], [null, { constellation: "origin", name: "Origin" }], "same keeps the Attribute");
  const other = bonusRule("[EFFECT USE: Presence, same, aid]");
  same([other.attribute, other.proficiency], ["presence", null], "same keeps the Proficiency");
  for (const word of ["might", "Agility", "WITS", "presence"]) must(bonusRule(`[EFFECT USE: ${word}, same, aid]`).attribute === word.toLowerCase(), `${word} is an Attribute, case blind`);
  same(bonusRule("[EFFECT use:presence,origin,Aid ❶ (⓿↺).]").to, { name: "Aid ❶ (⓿↺)", slug: "aid", type: null }, "spaces free, the tag case blind, a Maneuver's glyphs out of the slug, a trailing period tolerated");
  same(bonusRule("[EFFECT USE: Presence, Armored Fighting, aid]").proficiency, { constellation: "armored-fighting", name: "Armored Fighting" }, "a two-word Constellation");
  const full = bonusRule("[EFFECT USE: Presence, Origin, aid; IF: RANK(Origin >= expert); IF: RANK(roll = untrained); LIMIT: encounter]");
  same(full.when, [{ constellation: "origin", name: "Origin", op: ">=", rank: "expert" }, { roll: true, op: "=", rank: "untrained" }], "the conditions");
  same(full.limit, { per: "encounter" }, "the limit");
  const row = parseAutomation("USE: Presence, Origin, aid", { itemType: "effect" });
  same([row.errors, row.rules.map(bare)], [[], [bare(bonusRule(text))]], "the bare line on a custom effect row is the same rule");
  same(JSON.parse(JSON.stringify(full)), full, "a stored rule equals its JSON image");
});

check("substitute: with a resolver the borrowed Constellation and the Maneuver carry the resolved names", () => {
  const rule = bonusRule("[EFFECT USE: presence, origin, aid ❶]", { resolve });
  same(rule.proficiency, { constellation: "origin", name: "Origin" }, "the Origin, by the resolver's name");
  same(rule.to, { name: "Aid", slug: "aid", type: "action" }, "the Maneuver, typed");
  same(bonusRule("[EFFECT USE: Presence, GUARD, aid]", { resolve }).proficiency, { constellation: "guard", name: "Guard" }, "a Defense's Proficiency Bonus may be borrowed");
  same(bonusRule("[EFFECT USE: same, athletics, Steady the Line]", { resolve }).to, { name: "Steady the Line", slug: "steady-the-line", type: "action" }, "a Maneuver of several words");
});

check("substitute: the refusals, each with a message the designer can act on", () => {
  const A = "might, agility, wits or presence";
  must(useError("[EFFECT USE: Luck, Origin, aid]") === `"Luck" is not an Attribute: write ${A}, or same to keep the check's own`, "an unknown Attribute");
  must(useError("[EFFECT USE: roll, Origin, aid]") === "`roll` is RANK's word; in a USE line write same for a term the check keeps", "roll as the Attribute");
  must(useError("[EFFECT USE: Presence, roll, aid]") === "`roll` is RANK's word; in a USE line write same for a term the check keeps", "roll as the Constellation");
  must(useError("[EFFECT USE: same, same, aid]") === "`USE: same, same` swaps nothing: name the Attribute, the Constellation, or both, as in `USE: Presence, Origin, aid`", "same twice");
  must(useError("[EFFECT USE: Presence, Nobody, aid]") === '"Nobody" is not a Constellation', "an unknown Constellation");
  must(useError("[EFFECT USE: Presence, Search, aid]") === '"Search" is not a Constellation: a Maneuver has no Proficiency Bonus to borrow', "a Maneuver as the Constellation");
  must(useError("[EFFECT USE: Presence, Archery, aid]") === '"Archery" is a group and has no rank of its own; borrow Ranged instead', "a group names its parent");
  must(useError("[EFFECT USE: Presence, Lore, aid]") === "a Lore is the character's own; a substitution cannot borrow it", "a Lore as the Constellation");
  const flat = "a flat Proficiency Bonus is not read yet; the second descriptor is the Constellation whose Proficiency Bonus is borrowed, or same";
  for (const word of ["trained", "Expert", "3", "+3"]) {
    must(useError(`[EFFECT USE: Presence, ${word}, aid]`) === `"${word}": ${flat}`, `${word} with a resolver`);
    must(useError(`[EFFECT USE: Presence, ${word}, aid]`, {}) === `"${word}": ${flat}`, `${word} without one: the same refusal`);
  }
  must(useError("[EFFECT USE: Presence, Wits, aid]", {}) === '"Wits" is an Attribute, and the first descriptor is where it goes; the second is the Constellation whose Proficiency Bonus is borrowed, or same', "an Attribute as the Constellation");
  must(useError("[EFFECT USE: Presence, Origin, same]") === "same keeps one of the first two terms; the third descriptor names the Maneuver whose check is swapped, as in `USE: Presence, Origin, aid`", "same as the check");
  must(useError("[EFFECT USE: Presence, Origin, checks]") === '"checks" is a scope word, and USE never means every check: name the Maneuver whose check is swapped, as in `USE: Presence, Origin, aid`', "a scope word");
  for (const word of ["guard", "Awareness", "evade", "Endure"]) {
    must(useError(`[EFFECT USE: Presence, Origin, ${word}]`, {}) === `"${word}" is a Defense: its Threshold and its roll against an attack are never substituted; name the Maneuver that rolls it`, `${word} as the check, with no resolver needed`);
  }
  must(useError("[EFFECT USE: Presence, Origin, Diplomacy]") === '"Diplomacy" is a Constellation: USE reads a Maneuver\'s check in this version, as in `USE: Presence, Origin, aid`; a Constellation\'s own checks are not read yet', "a Constellation as the check");
  must(useError("[EFFECT USE: Presence, Origin, Aidd]") === '"Aidd" names no Constellation or Maneuver', "an unknown check");
  must(useError("[EFFECT USE: Presence, Origin, Lore]") === "a Lore is the character's own; a substitution cannot name it", "a Lore as the check");
});

check("substitute: the slips a count alone would misname", () => {
  must(useError("[EFFECT USE: Presence + Origin, aid]") === '"Presence + Origin": the Attribute and the Constellation are two descriptors with a comma between them, as in `USE: Presence, Origin, aid`', "the Talent's own prose, with a plus");
  must(useError("[EFFECT USE: Presence + Origin proficiency, aid]").startsWith('"Presence + Origin proficiency": the Attribute and the Constellation are two descriptors'), "and with the word proficiency");
  must(useError("[EFFECT USE: 1 condition, aid]") === "USE takes no value: it names the terms a check is made with, `USE: <Attribute>, <Constellation>, <Maneuver>`, as in `USE: Presence, Origin, aid`; a bonus is `CHECK: 1 condition, aid`", "a value and a type");
  must(useError("[EFFECT USE: Presence, Origin]") === "the Maneuver is missing: USE never means every check; name the Maneuver whose check is swapped third, as in `USE: Presence, Origin, aid` (write same for a term the check keeps)", "the check left off");
  must(useError("[EFFECT USE: Presence, aid]") === "the Constellation is missing: USE takes three descriptors, as in `USE: Presence, same, aid` to keep the check's own Proficiency Bonus", "the Constellation left off");
  must(useError("[EFFECT USE: Presence, , aid]") === "the Constellation is missing: USE takes three descriptors, as in `USE: Presence, same, aid` to keep the check's own Proficiency Bonus", "an empty place is dropped by the reader, and reads the same");
  must(useError("[EFFECT USE: Origin, aid]") === `the Attribute is missing: USE takes three descriptors, as in \`USE: same, Origin, aid\` to keep the check's own Attribute (might, agility, wits or presence names another)`, "the Attribute left off");
  must(useError("[EFFECT USE: Presence, aid]", {}) === "the Maneuver is missing: USE never means every check; name the Maneuver whose check is swapped third, as in `USE: Presence, Origin, aid` (write same for a term the check keeps)", "two descriptors with no resolver to tell which");
  // An example is never a line the parser refuses in its turn: `same, aid` is not told `same, same, aid`
  // (which swaps nothing), and `Origin, same` is not told to end a line in `same`.
  const sameAid = useError("[EFFECT USE: same, aid]");
  must(sameAid === "a term is missing: USE takes three descriptors, and same twice swaps nothing; name the Attribute, the Constellation, or both, as in `USE: Presence, same, aid` or `USE: same, Origin, aid`", `same and a Maneuver: "${sameAid}"`);
  must(!/same, same/.test(sameAid) && !/same, same/i.test(useError("[EFFECT USE: SAME, Aid]")), "and never the line that swaps nothing, case blind");
  for (const advised of ["[EFFECT USE: Presence, same, aid]", "[EFFECT USE: same, Origin, aid]"]) must(cellRules(advised).length === 1, `${advised} is a line that reads`);
  must(useError("[EFFECT USE: Origin, same]") === "the Maneuver is missing: USE never means every check; name the Maneuver whose check is swapped third, as in `USE: Presence, Origin, aid` (write same for a term the check keeps)", "a Constellation and same: the Maneuver is what is missing");
  must(useError("[EFFECT USE: aid, same]").startsWith("the Maneuver is missing"), "a Maneuver and same: the same sentence, never an example ending in same");
  must(useError("[EFFECT USE: the stairs]") === "a substitution is written `USE: <Attribute>, <Constellation>, <Maneuver>`, as in `USE: Presence, Origin, aid` (1 descriptor given, 3 wanted)", "one descriptor, counted in the singular");
  must(useError("[EFFECT USE:]") === "a substitution is written `USE: <Attribute>, <Constellation>, <Maneuver>`, as in `USE: Presence, Origin, aid`", "none");
  must(useError("[EFFECT USE: Presence, Origin, aid, search]") === "USE takes three descriptors, the Attribute, the Constellation and the Maneuver, not 4: `USE: Presence, Origin, aid`", "four");
  must(useError("[EFFECT USE: Presence; Origin; aid]") === '"Origin" is not a component: after the tag come IF:, IFT:, FOR: and LIMIT: (descriptors are separated by commas; a semicolon begins a component)', "semicolons for commas, told which mark does what");
});

check("substitute: the components it has no use for are refused by name, and an AURA block in the author's own terms", () => {
  must(useError("[EFFECT USE: Presence, Origin, aid; FOR: allies 15]") === "USE does not take FOR", "FOR");
  must(useError("[EFFECT USE: Presence, Origin, aid; IF: SEEN]") === "USE does not take IF: SEEN", "SEEN");
  must(useError("[EFFECT USE: Presence, Origin, aid; IF: ALLIES(>=1, 0)]") === "USE does not take IF: ALLIES(...)", "a count");
  must(useError("[EFFECT USE: Presence, Origin, aid; IFT: BLOW]") === "USE does not take IFT: <Threat>", "a Threat");
  must(useError("[EFFECT USE: Presence, Origin, aid; IFT: CHECK(intimidation)]") === "USE does not take IFT: <Threat>", "a check read against a Defense");
  must(useError("[EFFECT USE: Presence, Origin, aid; IFT: MARKED]") === "USE does not take IFT: MARKED", "MARKED");
  must(useError("[EFFECT USE: Presence, Origin, aid; IF: CLAIM(when teaching)]") === "USE does not take IF: CLAIM(...)", "a claim");
  must(/IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die/.test(useError("[EFFECT USE: Presence, Origin, aid; IF: RESULT(failure)]")), "a degree");
  must(useError("[EFFECT USE: Presence, Origin, aid; IFT: TRAIT(Fear)]") === "USE does not take IFT: TRAIT(...)", "a trait");
  const ring = parseAutomation("[AURA 15 allies; USE: Presence, Origin, aid]", { resolve, itemType: "talent" });
  same(ring.errors.map(e => e.message), ["a substitution is the owner's own roll and cannot ride an [AURA ...] block; write it as its own `[EFFECT USE: Presence, Origin, aid]`"], "an AURA block: no FOR the author never wrote");
  same(ring.rules.map(r => r.kind), ["aura"], "the ring itself still reads, and nothing is stored for the effect");
});

check("substitute: a kind's own name typed as a line is told its tag, and a tag without its colon the colon", () => {
  const cell = parseAutomation("substitute: Presence, Origin, aid", { resolve, itemType: "talent" });
  same([cell.rules, cell.errors.map(e => e.message)], [[], ['"substitute" is the kind\'s name, and its tag is USE: write `[EFFECT USE: Presence, Origin, aid]`']], "in a cell");
  must(parseAutomation("Substitute Presence, Origin, aid", { resolve, itemType: "effect" }).errors[0]?.message === '"substitute" is the kind\'s name, and its tag is USE: write `USE: Presence, Origin, aid`', "on a custom effect row, the bare form");
  must(parseAutomation("use Presence, Origin, aid", { resolve, itemType: "talent" }).errors[0]?.message === "USE is an effect tag and takes a colon: write `[EFFECT USE: Presence, Origin, aid]`", "a tag with no colon");
  must(parseAutomation("[USE: Presence, Origin, aid]", { resolve }).errors.length === 1 && parseAutomation("[SUBSTITUTE Presence, Origin, aid]", { resolve }).errors.length === 1, "neither word is a feature keyword");
  // The words that never were tags or 0.13.0 lines keep their messages (the checks above).
  must(/^PROBE is a feature and is written in brackets/.test(parseAutomation("probe: the grammar").errors[0]?.message ?? ""), "an alias of a kind no tag names is still told to bracket");
  must(parseAutomation("trait: Human").errors[0]?.message === "TRAIT is a feature and is written in brackets: `[TRAIT Human]`", "and so is a feature keyword");
  must(parseAutomation("speed 6").errors[0]?.message === "SPEED is a feature and is written in brackets: `[SPEED 6]`", "SPEED is a feature keyword first, though it is a tag too");
});

check("substitute: the summary, in the Talent's own phrase", () => {
  must(summarize(bonusRule("[EFFECT USE: Presence, Origin, aid]", { resolve })) === "may use Presence + Origin proficiency on checks to Aid", "both terms");
  must(summarize(bonusRule("[EFFECT USE: same, Origin, aid]", { resolve })) === "may use Origin proficiency on checks to Aid", "the Proficiency alone");
  must(summarize(bonusRule("[EFFECT USE: Presence, same, aid]", { resolve })) === "may use Presence on checks to Aid", "the Attribute alone");
  must(summarize(bonusRule("[EFFECT USE: Presence, Athletics, aid; IF: RANK(Origin >= expert); LIMIT: encounter]", { resolve })) === "may use Presence + Athletics proficiency on checks to Aid, while Origin is at least Expert, once each encounter", "the components");
  must(summarize(bonusRule("[EFFECT USE: Presence, Origin, aid; IF: RANK(roll = untrained)]", { resolve })) === "may use Presence + Origin proficiency on checks to Aid, while the check's own rank is Untrained", "on a USE line the roll's rank is the check's own, and the summary says so");
});

check("operators: readTargetName is the one reading of a target's name", () => {
  same(readTargetName(" Aid ❶ (⓿↺) ", undefined), { name: "Aid ❶ (⓿↺)", slug: "aid", type: null, found: null }, "no resolver: the name as written, the slug made, no type");
  const read = readTargetName("aid ❶", resolve);
  same([read.name, read.slug, read.type, read.found === KNOWN.aid], ["Aid", "aid", "action", true], "a resolver: the canonical name, the type, and the resolver's own record");
  must(readTargetName("Nobody", resolve) === null, "a resolver that knows nothing answers null");
  must(readTargetName("x", () => ({ type: "constellation", name: "No Slug" })) === null, "and so does a record with no slug");
});

/* The hook, through the dispatcher. */

const cooperative = talentWith("Cooperative Instinct", "[EFFECT USE: Presence, Origin, aid]");
const COOP = {
  key: "use-Cooperative Instinct-1", item: cooperative, label: "Cooperative Instinct",
  attribute: "presence", proficiency: { constellation: "origin", name: "Origin" }, certain: true, marks: []
};
const aidRoll = { kind: "check", slug: "diplomacy", item: aidItem, rank: "untrained" };

check("ruleSubstitutions: a candidate only when the roll carries the Maneuver's own Item, and only on a check", () => {
  const actor = rulesActor([cooperative, humanity], { origin: "trained" });
  same(ruleSubstitutions(actor, aidRoll), { candidates: [COOP], marks: [] }, "Aid from its Item: one candidate, mirroring the rule");
  same(ruleSubstitutions(actor, { ...aidRoll, slug: "awareness" }).candidates.map(c => c.key), [COOP.key], "whatever Constellation the Aid is rolled with, a Defense included");
  same(ruleSubstitutions(actor, { ...aidRoll, item: searchItem }).candidates, [], "a Search is not an Aid");
  same(ruleSubstitutions(actor, { ...aidRoll, item: null }).candidates, [], "a check made without the Item is offered nothing");
  same(ruleSubstitutions(actor, { ...aidRoll, item: { type: "talent", name: "Aid" } }).candidates, [], "a Talent named Aid is not the Maneuver");
  for (const kind of ["attack", "defense", "initiative"]) same(ruleSubstitutions(actor, { ...aidRoll, kind }).candidates, [], `never on ${kind === "attack" ? "an" : "a"} ${kind}`);
  same(ruleSubstitutions(rulesActor([{ ...cooperative, id: "coop0001" }]), aidRoll).candidates.map(c => c.key), ["use-coop0001-1"], "an Item with an id keys on it");
  same(ruleSubstitutions(rulesActor([{ ...cooperative, name: "Cooperative Instinct ❶↺" }]), aidRoll).candidates.map(c => c.label), ["Cooperative Instinct"], "the label is the carrier's plain name, glyphs out");
  const noResolver = talentWith("Plain", "[EFFECT USE: Presence, Origin, aid]", {});
  same(ruleSubstitutions(rulesActor([noResolver]), aidRoll).candidates.map(c => c.label), ["Plain"], "a rule parsed without a resolver matches the Maneuver by its slug");
  const byHand = { type: "talent", name: "By hand", system: { rules: [{ kind: "substitute", line: 1, text: "x", attribute: "presence", proficiency: null, to: { name: "Diplomacy", slug: "aid", type: "constellation" }, when: null, limit: null }] } };
  same(ruleSubstitutions(rulesActor([byHand]), aidRoll).candidates, [], "a Constellation as the check is not read in this version, even stored by hand");
});

check("ruleSubstitutions: IF reads the owner's rank, and `roll` the check's own rank before any swap", () => {
  const expert = talentWith("Seasoned", "[EFFECT USE: Presence, Origin, aid; IF: RANK(Origin >= expert)]");
  same(ruleSubstitutions(rulesActor([expert], { origin: "trained" }), aidRoll).candidates, [], "Origin Trained: not yet");
  same(ruleSubstitutions(rulesActor([expert], { origin: "master" }), aidRoll).candidates.map(c => c.label), ["Seasoned"], "Origin Master: offered");
  same(ruleSubstitutions(rulesActor([expert], null), aidRoll).candidates, [], "an actor with no proficiency never meets a rank condition");
  same(ruleSubstitutions(rulesActor([cooperative], null), aidRoll).candidates.map(c => c.label), ["Cooperative Instinct"], "an unconditioned line needs none");
  const untrained = talentWith("Stopgap", "[EFFECT USE: Presence, Origin, aid; IF: RANK(roll = untrained)]");
  same(ruleSubstitutions(rulesActor([untrained]), { ...aidRoll, rank: "untrained" }).candidates.map(c => c.label), ["Stopgap"], "the check's own rank is Untrained");
  same(ruleSubstitutions(rulesActor([untrained]), { ...aidRoll, rank: "trained" }).candidates, [], "and not when the check is Trained by itself");
  same(ruleSubstitutions(rulesActor([untrained]), { ...aidRoll, rank: undefined }).candidates, [], "no rank known, no match");
  // The comparison words, on the check's own rank and on the owner's: `=` alone would pass both.
  const atMost = talentWith("AtMost", "[EFFECT USE: Presence, Origin, aid; IF: RANK(roll <= trained)]");
  const atLeast = talentWith("AtLeast", "[EFFECT USE: Presence, Origin, aid; IF: RANK(roll >= trained)]");
  const ranks = ["untrained", "trained", "expert"];
  same(ranks.map(rank => ruleSubstitutions(rulesActor([atMost]), { ...aidRoll, rank }).candidates.length), [1, 1, 0], "the check's own rank at most Trained");
  same(ranks.map(rank => ruleSubstitutions(rulesActor([atLeast]), { ...aidRoll, rank }).candidates.length), [0, 1, 1], "the check's own rank at least Trained");
  const capped = talentWith("Capped", "[EFFECT USE: Presence, Origin, aid; IF: RANK(Origin <= trained)]");
  same(ranks.map(origin => ruleSubstitutions(rulesActor([capped], { origin }), aidRoll).candidates.length), [1, 1, 0], "the owner's rank at most Trained");
  const later = { type: "talent", name: "Later", system: { rules: [{ ...cooperative.system.rules[0], when: [{ substituted: false }] }] } };
  same(ruleSubstitutions(rulesActor([later]), aidRoll).candidates, [], "a condition this version does not know does not hold");
});

check("ruleSubstitutions: a LIMIT's mark rides on the candidate, and a spent one offers nothing", () => {
  const once = talentWith("Once", "[EFFECT USE: Presence, Origin, aid; LIMIT: encounter]");
  const each = talentWith("Each", "[EFFECT USE: Presence, Origin, aid; LIMIT: round]");
  const inFight = { ...aidRoll, encounter: { combat: "c1", round: 2 } };
  const fresh = ruleSubstitutions(rulesActor([once, each]), inFight);
  same(fresh.candidates.map(c => [c.label, c.marks]), [["Once", [{ key: "Once:1", per: "encounter" }]], ["Each", [{ key: "Each:1", per: "round" }]]], "each candidate carries its own mark");
  same(fresh.marks, [], "and the dispatcher files none itself: only the swap the die is thrown with is spent");
  same(ruleSubstitutions(rulesActor([once]), aidRoll).candidates.map(c => c.marks), [[]], "outside an encounter there is nothing to remember");
  const spent = rulesActor([once, each]);
  spent.flags = { starwrought: { rules: { encounter: { "Once:1": "c1" }, round: { "Each:1": { combat: "c1", round: 2 } } } } };
  same(ruleSubstitutions(spent, inFight).candidates, [], "both spent");
  same(ruleSubstitutions(spent, { ...aidRoll, encounter: { combat: "c1", round: 3 } }).candidates.map(c => c.label), ["Each"], "a new round frees the round's; the encounter's stays spent");
  same(ruleSubstitutions(spent, { ...aidRoll, encounter: { combat: "c2", round: 1 } }).candidates.map(c => c.label), ["Once", "Each"], "another Combat frees both");
  // The shape the system itself stores for an encounter's mark is `{ combat }` (writeMarksOn in
  // module/rules/scene.mjs); the bare string above is the older reading, kept beside it.
  const stored = rulesActor([once]);
  stored.flags = { starwrought: { rules: { encounter: { "Once:1": { combat: "c1" } } } } };
  same(ruleSubstitutions(stored, { ...aidRoll, encounter: { combat: "c1", round: 5 } }).candidates, [], "{ combat } is spent for the rest of the Combat");
  same(ruleSubstitutions(stored, { ...aidRoll, encounter: { combat: "c2", round: 1 } }).candidates.map(c => c.label), ["Once"], "and another Combat frees it");
});

check("ruleSubstitutions: Off drops the line, Skip drops it once and asks for its state to clear, a one-roll effect's removal rides on its candidate", () => {
  const rule = cooperative.system.rules[0];
  const off = rulesActor([cooperative]);
  off.flags = { starwrought: { rules: { state: { [ruleStateKey(cooperative, rule)]: "off" } } } };
  same(ruleSubstitutions(off, aidRoll), { candidates: [], marks: [] }, "Off: nothing, and nothing to clear");
  const skip = rulesActor([cooperative]);
  skip.flags = { starwrought: { rules: { state: { [ruleStateKey(cooperative, rule)]: "skip" } } } };
  same(ruleSubstitutions(skip, aidRoll), { candidates: [], marks: [{ key: ruleStateKey(cooperative, rule), per: "state" }] }, "Skip: no candidate, and the state clears with this roll");
  same(ruleSubstitutions(skip, { ...aidRoll, item: searchItem }), { candidates: [], marks: [] }, "a Skip line that would not have matched is not spent");
  const parsed = parseAutomation("USE: Presence, Origin, aid", { resolve, itemName: "Borrowed", itemType: "effect" });
  const row = { items: [], system: { effects: [{ id: "row00002", label: "Borrowed", text: "USE: Presence, Origin, aid", duration: "roll", rules: parsed.rules }] } };
  row.system.rules = collectRules(row);
  const once = ruleSubstitutions(row, aidRoll);
  same(once.candidates.map(c => [c.key, c.label, c.marks]), [["use-effect:row00002-1", "Borrowed", [{ key: "row00002", per: "effect" }]]], "a one-roll custom effect: its removal is the candidate's to carry");
  same(once.marks, [], "and is not filed unless that swap is rolled");
});

check("ruleSubstitutions: no rules, no actor, a hook that throws and a hook that answers badly", () => {
  same(ruleSubstitutions(rulesActor([]), aidRoll), { candidates: [], marks: [] }, "no rules");
  same(ruleSubstitutions(rulesActor([humanity, sneaky]), aidRoll), { candidates: [], marks: [] }, "kinds without the hook are skipped");
  same(ruleSubstitutions(null, aidRoll), { candidates: [], marks: [] }, "null actor");
  same(ruleSubstitutions({ items: [cooperative] }, aidRoll).candidates.map(c => c.key), [COOP.key], "an actor with no prepared index is collected on the spot");

  registerKind({ id: "explosive-swap", parse: () => ({}), summary: () => "", hooks: { substitutions() { throw new Error("kaboom"); } } });
  const volatile = { type: "talent", name: "Volatile", system: { rules: [{ kind: "explosive-swap", line: 1, text: "x" }] } };
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  let result;
  try {
    result = ruleSubstitutions(rulesActor([volatile, cooperative]), aidRoll);
  } finally {
    console.error = original;
  }
  same(result.candidates.map(c => c.key), [COOP.key], "the other kind's candidate still arrives");
  must(errors.length === 1 && /the "explosive-swap" kind's substitutions hook failed/.test(String(errors[0][0])), `the failure is reported once: ${JSON.stringify(errors.map(e => String(e[0])))}`);

  const carrier = { type: "talent", name: "Loose", system: { rules: [{ kind: "sloppy-swap", line: 1, text: "x" }] } };
  registerKind({
    id: "sloppy-swap", parse: () => ({}), summary: () => "",
    hooks: {
      substitutions: () => [
        null, "x", { attribute: "presence" }, { item: carrier }, { item: carrier, attribute: "luck" },
        // An unknown Attribute WITH something borrowed: dropped whole, never read as `same, Origin`.
        { item: carrier, attribute: "luck", proficiency: { constellation: "origin" } },
        { item: carrier, attribute: null, proficiency: null }, { item: carrier, proficiency: {} },
        { item: carrier, attribute: "presence" },
        { item: carrier, attribute: "might", label: "Named" },
        { item: carrier, attribute: "wits", key: "dup", certain: false, mark: { key: "k", per: "round" } },
        { item: carrier, proficiency: { constellation: "origin" }, key: "dup", mark: { key: "half" } }
      ]
    }
  });
  same(ruleSubstitutions(rulesActor([carrier]), aidRoll).candidates, [
    { key: "sloppy-swap-0", item: carrier, label: "Loose", attribute: "presence", proficiency: null, certain: true, marks: [] },
    { key: "sloppy-swap-1", item: carrier, label: "Named", attribute: "might", proficiency: null, certain: true, marks: [] },
    { key: "dup", item: carrier, label: "Loose", attribute: "wits", proficiency: null, certain: false, marks: [{ key: "k", per: "round" }] },
    { key: "dup-2", item: carrier, label: "Loose", attribute: null, proficiency: { constellation: "origin", name: "origin" }, certain: true, marks: [] }
  ], "no carrier, an Attribute the system does not have (alone or with something borrowed) and a swap of nothing are dropped; a keyless candidate gets a key, a label given stands, a shared key is suffixed, a half mark is dropped");
});

/* The pure half of the check engine's side (module/dice/check/substitute.mjs). */

check("substitute: swapTerms prices the two terms a swap rolls, and `same` keeps the check's own", () => {
  // The check's own pair is NOT the functions' fallback (Untrained, +0), so a kept term is told
  // apart from a dropped one, and Master +9 is neither Origin's Trained +3 nor Guard's Expert +6.
  const own = { attribute: "wits", slug: "crafting", name: "Crafting", rank: "master", value: 9 };
  const read = {
    attributeBonus: key => ({ might: 0, agility: 1, wits: 1, presence: 2 })[key],
    proficiency: slug => ({ origin: { name: "Origin", rank: "trained", bonus: 3 }, guard: { name: "Guard", rank: "expert", bonus: 6 } })[slug] ?? null
  };
  same(swapTerms(COOP, own, read), { attribute: "presence", attributeValue: 2, slug: "origin", name: "Origin", rank: "trained", value: 3 }, "Presence and Origin");
  same(swapTerms({ attribute: null, proficiency: { constellation: "guard", name: "Guard" } }, own, read), { attribute: "wits", attributeValue: 1, slug: "guard", name: "Guard", rank: "expert", value: 6 }, "same, Guard: the check's own Attribute");
  same(swapTerms({ attribute: "presence", proficiency: null }, own, read), { attribute: "presence", attributeValue: 2, slug: "crafting", name: "Crafting", rank: "master", value: 9 }, "Presence, same: the check's own Proficiency, at its own rank");
  same(swapTerms({ attribute: null, proficiency: { constellation: "nowhere", name: "Nowhere" } }, { ...own, attribute: "" }, read), { attribute: null, attributeValue: 0, slug: "nowhere", name: "Nowhere", rank: "untrained", value: 0 }, "a Constellation the character has no entry for is Untrained, and a check with no Attribute keeps none");
  same(substitutionRecord(COOP, swapTerms(COOP, own, read), own), {
    key: COOP.key, itemName: "Cooperative Instinct", attribute: "presence",
    proficiency: { constellation: "origin", name: "Origin", rank: "trained" },
    from: { attribute: "wits", slug: "crafting", name: "Crafting", rank: "master" }
  }, "the card's record mirrors the rule and names what was replaced, at the rank it held");
  const half = { key: "k", label: "Half", attribute: "presence", proficiency: null };
  same(substitutionRecord(half, swapTerms(half, own, read), own).proficiency, null, "a Proficiency the check kept is null in the record");
  const kept = { key: "k2", label: "Kept", attribute: null, proficiency: { constellation: "origin", name: "Origin" } };
  same(substitutionRecord(kept, swapTerms(kept, own, read), own).attribute, null, "an Attribute the check kept is null in the record, though the terms rolled name it");
});

check("substitute: chooseVariant ticks a swap only when its total is strictly better", () => {
  const none = { key: null, total: 1 };
  const better = { key: "a", total: 5, certain: true };
  const best = { key: "b", total: 6, certain: true };
  const level = { key: "c", total: 6, certain: true };
  must(chooseVariant([none, better], undefined) === better, "better: the swap");
  must(chooseVariant([none, { key: "a", total: 1 }], undefined) === none, "a tie: the check as it was");
  must(chooseVariant([none, { key: "a", total: 0 }], undefined) === none, "worse: the check as it was");
  must(chooseVariant([none, better, best], undefined) === best, "the highest of two");
  must(chooseVariant([none, best, level], undefined) === best, "two level with each other: the earlier");
  must(chooseVariant([none, { key: "u", total: 9, certain: false }, better], undefined) === better, "an uncertain candidate is never the default");
  must(chooseVariant([none, better], null) === none, "an explicit none");
  must(chooseVariant([none, { key: "a", total: 0 }], "a").key === "a", "an explicit key stands though it is worse");
  must(chooseVariant([none, better], "gone") === none, "a key no variant has is no swap");
  must(chooseVariant([], undefined) === null && chooseVariant(null, "a") === null, "nothing in, nothing out");
});

check("substitute: mergeMarks keeps each mark once", () => {
  same(mergeMarks([{ key: "a", per: "round" }], undefined, [{ key: "a", per: "round" }, { key: "a", per: "encounter" }, { key: "b", per: "state", owner: "Actor.x" }, null, { key: "c" }]),
    [{ key: "a", per: "round" }, { key: "a", per: "encounter" }, { key: "b", per: "state", owner: "Actor.x" }], "by key, per and owner; a half mark dropped");
  same(mergeMarks([{ key: "s", per: "state", owner: "Actor.a" }], [{ key: "s", per: "state", owner: "Actor.b" }, { key: "s", per: "state" }, { key: "s", per: "state", owner: "Actor.a" }]),
    [{ key: "s", per: "state", owner: "Actor.a" }, { key: "s", per: "state", owner: "Actor.b" }, { key: "s", per: "state" }], "the same line on two owners and on the roller is three marks; the same owner twice is one");
});

check("0.21.0: a claim that reads the roll's rank is offered on the check's own terms and not under a swap that borrows a Trained rank", () => {
  // The fact the roll dialog must honour (the review of 2026-11-10): each variant of a swappable
  // roll has its own offers, so the dialog draws the union and counts a ticked row only when the
  // variant rolled offers it.
  const improviser = talentWith("Improviser", "[EFFECT CHECK: 2 situation, aid; IF: RANK(roll = untrained); IF: CLAIM(when improvising)]");
  const actor = rulesActor([{ ...improviser, id: "impr0001" }]);
  const own = ruleModifiers(actor, { kind: "check", slug: "crafting", item: aidItem, rank: "untrained" });
  same(own.offered.map(o => [o.key, o.value, o.ticked]), [["claim-impr0001-1", 2, false]], "on the check's own Untrained rank: offered");
  const swapped = ruleModifiers(actor, { kind: "check", slug: "crafting", item: aidItem, rank: "trained" });
  same([swapped.offered, swapped.applied], [[], []], "at a borrowed Trained rank: neither offered nor applied");
});

check("0.21.0: under momentOnly only an applied answer spends a one-roll effect or clears a Skip; an offer no box is drawn for does not", () => {
  const rowActor = (text) => {
    const parsed = parseAutomation(text, { resolve, itemName: "Row", itemType: "effect" });
    must(parsed.errors.length === 0, `"${text}" should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
    const actor = { items: [], system: { effects: [{ id: "fx1", label: "Row", text, duration: "roll", rules: parsed.rules }] } };
    actor.system.proficiency = () => ({ rank: "trained" });
    actor.system.rules = collectRules(actor);
    return actor;
  };
  const aidRow = rowActor("CHECK: 1 condition, aid");
  const wind = ruleModifiers(aidRow, { kind: "check", slug: "endure", item: null, rank: "trained", momentOnly: true });
  same([wind.applied, wind.offered, wind.marks], [[], [], []], "a Wind roll (a Defense rolled as a check, no Item): a one-roll bonus to Aid is neither applied, offered nor spent");
  const withAid = ruleModifiers(aidRow, { kind: "check", slug: "awareness", item: aidItem, rank: "trained", momentOnly: true });
  same([withAid.applied.map(m => m.value), withAid.marks], [[1], [{ key: "fx1", per: "effect" }]], "the Aid made with Awareness: applied, and spent");
  const plain = ruleModifiers(aidRow, { kind: "check", slug: "crafting", item: null, rank: "trained" });
  same([plain.offered.map(o => o.marks), plain.marks], [[[{ key: "fx1", per: "effect" }]], []], "a plain check still offers it, the removal riding on the box");
  const guardRow = rowActor("DEF: 1 situation, guard");
  same(ruleModifiers(guardRow, { kind: "defense", slug: "guard", item: null, rank: "trained", momentOnly: true }).marks, [{ key: "fx1", per: "effect" }], "a one-roll bonus to Guard the sheet's pass folded in is still spent by the Guard roll");
  const skipped = rulesActor([{ ...humanity, id: "hum1" }], { human: "trained" });
  skipped.flags = { starwrought: { rules: { state: { [ruleStateKey({ id: "hum1" }, { line: 1 })]: "skip" } } } };
  same(ruleModifiers(skipped, { kind: "check", slug: "endure", item: null, rank: "trained", momentOnly: true }).marks, [], "a Skip on a bonus to Aid is not cleared by a Wind roll");
  same(ruleModifiers(skipped, { kind: "check", slug: "awareness", item: aidItem, rank: "trained", momentOnly: true }).marks, [{ key: ruleStateKey({ id: "hum1" }, { line: 1 }), per: "state" }], "and is by the Aid it would have reached");
});

check("0.21.0: the Effects tab switches exactly the kinds the effect tags name", () => {
  same([...EFFECT_KINDS].sort(), [...new Set(Object.values(EFFECT_TAGS))].sort(), "EFFECT_KINDS against EFFECT_TAGS");
});

check("0.21.0: a bonus to a Maneuver reaches a check rolled with a Defense from that Maneuver's Item, and nothing else changes there (ruling 222)", () => {
  const plus = [{ label: "Humanity", value: 1, type: "condition", source: "rule:Humanity" }];
  const actor = rulesActor([humanity], { human: "trained" });
  const withAwareness = ruleModifiers(actor, { kind: "check", slug: "awareness", item: aidItem, rank: "trained", momentOnly: true });
  same([withAwareness.applied, withAwareness.offered], [plus, []], "Aid made with Awareness: Humanity's +1, applied");
  same(ruleModifiers(actor, { kind: "defense", slug: "awareness", item: null, staticOnly: true }).applied, [], "the sheet's Defense pass, asked as the data model asks it, never folded it in, so it is counted once");
  const plain = ruleModifiers(actor, { kind: "check", slug: "endure", item: null, rank: "trained", momentOnly: true });
  same([plain.applied, plain.offered], [[], []], "a Defense rolled as a check with no Item: nothing applied and nothing offered");
  same(ruleModifiers(actor, { kind: "check", slug: "awareness", item: searchItem, rank: "trained", momentOnly: true }).applied, [], "another Maneuver's Item");
  for (const kind of ["defense", "initiative"]) same(ruleModifiers(actor, { kind, slug: "awareness", item: aidItem, rank: "trained", momentOnly: true }).applied, [], `not on ${kind === "initiative" ? "an" : "a"} ${kind}`);
  const everyCheck = talentWith("Jack of All Trades", "[EFFECT SKILL: 1 situation; IF: RANK(roll = untrained)]");
  same(ruleModifiers(rulesActor([everyCheck]), { kind: "check", slug: "awareness", item: aidItem, rank: "untrained", momentOnly: true }).applied, [], "a bonus to Skill checks stays out of the Defense branch, as before");
  const toGuard = talentWith("Braced for it", "[EFFECT CHECK: 2 condition, guard]");
  same(ruleModifiers(rulesActor([toGuard]), { kind: "check", slug: "guard", item: aidItem, rank: "trained", momentOnly: true }).applied, [], "a bonus to the Defense itself was the sheet's pass's, and is not added again");
  const untyped = talentWith("Helpful", "[EFFECT CHECK: 1 condition, aid]", {});
  same(ruleModifiers(rulesActor([untyped]), { kind: "check", slug: "awareness", item: aidItem, rank: "trained", momentOnly: true }).applied.map(m => m.value), [1], "a rule parsed without a resolver matches the Maneuver by its slug too");
});

/* -------------------------------------------- */
/*  0.22.0: the give and alter kinds, the gives hook point, the pending result */
/* -------------------------------------------- */

/** Aid's own row, as the Maneuver sheet's Automation cell holds it. */
const AID_CELL = [
  "[EFFECT GIVE: 2 situation, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]",
  "[EFFECT GIVE: 3 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = master)]",
  "[EFFECT GIVE: 4 situation, chosen; IF: RESULT(critical success); IF: RANK(roll = legendary)]",
  "[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]",
  "[EFFECT GIVE: -1 situation, chosen; IF: RESULT(critical failure)]"
].join("\n");

/** A Maneuver's row: an action Item carrying the rules its cell parses to, with the resolver. */
function maneuverWith(name, cell, extra = {}) {
  const parsed = parseAutomation(cell, { resolve, itemName: name, itemType: "action" });
  must(parsed.errors.length === 0, `${name}'s cell should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
  return { type: "action", name, system: { rules: parsed.rules }, ...extra };
}

/** Parse one line on a Maneuver's row and return the rule, or the one error's message. */
const onRowOf = { resolve: groupResolve, itemType: "action" };
const giveRule = (cell, context = onRowOf) => bonusRule(cell, context);
const giveError = (cell, context = onRowOf) => bonusError(cell, context);
const alterError = (cell, context = { resolve: groupResolve, itemType: "talent" }) => bonusError(cell, context);

const CHOSEN_TO = { name: "chosen", slug: "", type: "chosen" };
const aidRow = maneuverWith("Aid ❶", AID_CELL);
const patient = talentWith("Patient Assistance", "[EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]");
const sure = talentWith("Sure Assistance", "[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]");

check("give and alter: registered with their hooks, their tags, and no Use control", () => {
  const give = kindOf("give");
  const alter = kindOf("alter");
  must(give && give.id === "give" && alter && alter.id === "alter", "both kinds are registered");
  same([give.aliases, alter.aliases], [[], []], "no aliases");
  same([Object.keys(give.hooks).sort(), Object.keys(alter.hooks)], [["gives", "modifiers"], ["gives"]], "give speaks at gives and modifiers, alter at gives");
  must(EFFECT_TAGS.give === "give" && EFFECT_TAGS.alter === "alter", "the GIVE and ALTER tags name the kinds");
  must(!usableByRule(aidRow) && !usableByRule(patient), "neither draws a Use control");
});

check("operators: readUntil reads the three windows, and untilWords says them", () => {
  same(readUntil("giver opportunity"), { who: "giver", n: 1 }, "the default, written out");
  same(readUntil("Giver  Opportunity 2"), { who: "giver", n: 2 }, "case and spaces free, a count");
  same(readUntil("recipient opportunity 2"), { who: "recipient", n: 2 }, "Patient Assistance's window");
  same(readUntil("recipient opportunity"), { who: "recipient", n: 1 }, "a count left out is 1");
  same(readUntil("ENCOUNTER"), { who: "encounter", n: 0 }, "the encounter");
  const shapes = "a window is written `giver opportunity`, `recipient opportunity <N>` or `encounter`, not";
  throws(() => readUntil("forever"), new RegExp(`^${shapes.replace(/[<>]/g, "\\$&")} "forever"$`), "an unknown window");
  throws(() => readUntil(""), /not ""$/, "nothing");
  throws(() => readUntil("recipient opportunity 2 3"), /not "recipient opportunity 2 3"$/, "a word too many");
  for (const bad of ["0", "two", "1.5", "12"]) throws(() => readUntil(`recipient opportunity ${bad}`), new RegExp(`^"${bad.replace(".", "\\.")}" is not a count of Opportunities: write a whole number from 1 to 9`), `a count of ${bad}`);
  must(untilWords(null) === "until the giver's next Opportunity", "no window is the default's words");
  must(untilWords({ who: "giver", n: 1 }, { giver: "Tess" }) === "until Tess's next Opportunity", "a name in place of the giver");
  must(untilWords({ who: "giver", n: 2 }) === "until the giver's second Opportunity from now", "a later one of the giver's");
  must(untilWords({ who: "recipient", n: 2 }, { recipient: "Wren" }) === "through Wren's second upcoming Opportunity", "the recipient's second");
  must(untilWords({ who: "recipient", n: 1 }) === "through the recipient's next Opportunity", "the recipient's next");
  must(untilWords({ who: "encounter", n: 0 }) === "until the encounter ends", "the encounter");
  must(readBonusType("Situation") === "situation", "the bonus type is one reading for bonus and give");
  throws(() => readBonusType("circumstance"), /^write Situation, not circumstance: the book renamed the types in v3\.3$/, "a retired type word");
});

check("give: every accepted form on a Maneuver's row, stored whole", () => {
  const text = "[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]";
  same(giveRule(text), {
    value: 1, type: "situation", to: CHOSEN_TO, when: [{ outcome: "success", name: "Success" }], until: null,
    kind: "give", line: 1, text
  }, "Aid's Success line");
  same(giveRule("[EFFECT give: -1 Situation, CHOSEN; if: result(critical failure).]").value, -1, "a penalty, the tag, the type and chosen case blind, a trailing period tolerated");
  same(giveRule("[EFFECT GIVE: +2 condition, chosen; IF: RESULT(critical success); IF: RANK(roll <= expert)]").when,
    [{ outcome: "critSuccess", name: "Critical Success" }, { roll: true, op: "<=", rank: "expert" }], "the degree and the rank rolled");
  same(giveRule("[EFFECT GIVE: 1 gear, chosen; IF: RANK(Origin >= expert); IF: RESULT(success)]").when,
    [{ constellation: "origin", name: "Origin", op: ">=", rank: "expert" }, { outcome: "success", name: "Success" }], "the owner's rank, in either order");
  same(giveRule("[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]").to, { name: "Stealth", slug: "stealth", type: "constellation" }, "a Constellation by name, resolved");
  same(giveRule("[EFFECT GIVE: 1 situation, Guard; IF: RESULT(success)]").to, { name: "Guard", slug: "guard", type: "constellation" }, "a Defense is a Constellation");
  same(giveRule("[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]", { itemType: "action" }).to, { name: "stealth", slug: "stealth", type: null }, "without a resolver: the name as written, no type");
  same(giveRule("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); UNTIL: recipient opportunity 2]").until, { who: "recipient", n: 2 }, "a window of the recipient's");
  same(giveRule("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); UNTIL: giver opportunity]").until, { who: "giver", n: 1 }, "the default window, written out");
  same(giveRule("[EFFECT GIVE: 1 situation, chosen; UNTIL: encounter; IF: RESULT(success)]").until, { who: "encounter", n: 0 }, "the encounter, before the condition");
  same(aidRow.system.rules.map(r => [r.kind, r.value, r.when[0].outcome]), [["give", 2, "critSuccess"], ["give", 3, "critSuccess"], ["give", 4, "critSuccess"], ["give", 1, "success"], ["give", -1, "critFail"]], "Aid's five lines are five rules");
  for (const rule of aidRow.system.rules) same(JSON.parse(JSON.stringify(rule)), rule, "a stored rule equals its JSON image");
});

check("give: it is written on the Maneuver's own row and nowhere else", () => {
  const where = "GIVE is written on the Maneuver's own row: it says what a result of that Maneuver's check gives. A Talent changes it with ALTER, as in `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]`";
  const line = "GIVE: 1 situation, chosen; IF: RESULT(success)";
  must(giveError(`[EFFECT ${line}]`, { resolve, itemType: "talent" }) === where, "in a Talent's cell");
  must(giveError(line, { resolve, itemType: "effect" }) === where, "on a custom effect row");
  must(giveError(`[EFFECT ${line}]`, { resolve }) === where, "and with no carrier named at all");
  const ring = parseAutomation(`[AURA 15 allies; ${line}]`, { resolve, itemType: "action" });
  same(ring.errors.map(e => e.message), ["a give is what a Maneuver's check gives and cannot ride an [AURA ...] block; write it on the Maneuver's row as `[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]`"], "an AURA block: no FOR the author never wrote");
  same(ring.rules.map(r => r.kind), ["aura"], "the ring itself still reads");
});

check("give: the refusals, each with a message the designer can act on", () => {
  const ok = "; IF: RESULT(success)]";
  must(giveError("[EFFECT GIVE: 1 situation, chosen]") === "GIVE says which result of the check gives it: add `IF: RESULT(<degree>)`, as in `GIVE: 1 situation, chosen; IF: RESULT(success)`", "no degree");
  must(giveError("[EFFECT GIVE: 1 situation, chosen; IF: RANK(roll = master)]").startsWith("GIVE says which result of the check gives it"), "a rank is not a degree");
  must(giveError("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); IF: RESULT(critical success)]") === "GIVE takes one `IF: RESULT(...)` (2 given): write one line for each degree", "two degrees on one line");
  must(giveError(`[EFFECT GIVE: 1 situation${ok}`) === "GIVE names what the bonus is to after a comma: chosen (named when the result is given) or a Constellation, as in `GIVE: 1 situation, chosen; IF: RESULT(success)`", "no descriptor");
  must(giveError(`[EFFECT GIVE: 1 situation, chosen, stealth${ok}`) === "GIVE takes one descriptor, chosen or a Constellation, not 2: `GIVE: <value> <type>, chosen | <Constellation>; IF: RESULT(<degree>)`", "two descriptors");
  must(giveError(`[EFFECT GIVE: 1, chosen${ok}`) === "no Talent bonus is untyped; name situation, condition or gear after the value", "no type");
  must(giveError(`[EFFECT GIVE: 1 circumstance, chosen${ok}`) === "write Situation, not circumstance: the book renamed the types in v3.3", "a retired type word");
  must(giveError(`[EFFECT GIVE: 0 situation, chosen${ok}`) === "a bonus of 0 does nothing", "zero");
  must(giveError(`[EFFECT GIVE: situation, chosen${ok}`) === 'GIVE is written `GIVE: <value> <type>, <descriptor>`, as in `GIVE: 1 situation, chosen; IF: RESULT(success)`: a signed whole number first, not "situation"', "no value, with GIVE's own example");
  must(giveRule("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)]").value === 1, "and that example is a line that reads");
  must(giveError(`[EFFECT GIVE: 1 situation, Search${ok}`) === '"Search" is a Maneuver: GIVE names the Constellation the recipient rolls, or chosen for one named when the result is given', "a Maneuver as the Constellation");
  must(giveError(`[EFFECT GIVE: 1 situation, Nobody${ok}`) === '"Nobody" is not a Constellation: GIVE names one, or chosen for one named when the result is given', "an unknown Constellation");
  must(giveError(`[EFFECT GIVE: 1 situation, Lore${ok}`) === "a Lore is the character's own; write chosen, and the Lore is named when the result is given", "a Lore");
  must(giveError(`[EFFECT GIVE: 1 situation, Archery${ok}`) === '"Archery" is a group and its Talents roll the parent; write Ranged instead', "a group names its parent");
  must(giveError(`[EFFECT GIVE: 1 situation, checks${ok}`) === '"checks" is a scope word; GIVE names one Constellation, or chosen for one named when the result is given', "a scope word");
});

check("give: the components it has no use for are refused by name, and UNTIL and VALUE each belong to one tag", () => {
  const line = "[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success)";
  must(giveError(`${line}; FOR: allies 15]`) === "GIVE does not take FOR", "FOR");
  must(giveError(`${line}; IF: SEEN]`) === "GIVE does not take IF: SEEN", "SEEN");
  must(giveError(`${line}; IF: ALLIES(>=1, 0)]`) === "GIVE does not take IF: ALLIES(...)", "a count");
  must(giveError(`${line}; IFT: BLOW]`) === "GIVE does not take IFT: <Threat>", "a Threat");
  must(giveError(`${line}; IFT: MARKED]`) === "GIVE does not take IFT: MARKED", "MARKED");
  must(giveError(`${line}; IF: CLAIM(when asked)]`) === "GIVE does not take IF: CLAIM(...)", "a claim");
  must(giveError(`${line}; LIMIT: encounter]`) === "GIVE does not take LIMIT", "LIMIT");
  must(giveError(`${line}; IFT: TRAIT(Fear)]`) === "GIVE does not take IFT: TRAIT(...)", "a trait");
  must(giveError(`${line}; UNTIL: encounter; UNTIL: encounter]`) === "UNTIL is given twice", "UNTIL twice");
  must(giveError(`${line}; UNTIL: forever]`) === 'a window is written `giver opportunity`, `recipient opportunity <N>` or `encounter`, not "forever"', "a window that is none");
  must(giveError(`${line}; VALUE: nothing]`) === "GIVE does not take VALUE", "VALUE is ALTER's");
  must(giveError(`${line}; PRESERVE: this]`) === '"PRESERVE: this" is not a component: after the tag come IF: and UNTIL:', "an unknown component is told GIVE's own");
  // The two new components after every other tag, by the tag's own name.
  const onRow = cell => parseAutomation(cell, { resolve, itemType: "effect" }).errors[0]?.message ?? "";
  for (const [cell, tag] of [["CHECK: 1 condition, aid", "CHECK"], ["DEF: 1 situation, guard", "DEF"], ["IMMUNE: prone", "IMMUNE"], ["USE: Presence, Origin, aid", "USE"], ["REROLL: diplomacy; IF: RESULT(critical failure)", "REROLL"]]) {
    must(onRow(`${cell}; UNTIL: encounter`) === `${tag} does not take UNTIL`, `${tag} with UNTIL`);
    must(onRow(`${cell}; VALUE: nothing`) === `${tag} does not take VALUE`, `${tag} with VALUE`);
  }
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; UNTIL: encounter]") === "ALTER does not take UNTIL", "UNTIL is GIVE's");
  must(/IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die \(reroll, give\)/.test(onRow("CHECK: 1 condition, aid; IF: RESULT(success)")), "and a degree is still refused where no kind acts after the die, naming the two that do");
});

check("alter: every accepted form, stored whole", () => {
  const text = "[EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]";
  same(patient.system.rules, [{
    to: { name: "Aid", slug: "aid", type: "action" }, property: "beneficial-duration", nothing: false, until: { who: "recipient", n: 2 }, when: null,
    kind: "alter", line: 1, text
  }], "Patient Assistance's cell");
  same(bare(sure.system.rules[0]), { to: { name: "Aid", slug: "aid", type: "action" }, property: "critical-failure", nothing: true, until: null, when: null, kind: "alter", line: 1 }, "Sure Assistance's cell");
  const all = cellRules("[EFFECT alter: aid ❶ . Duration; value: Encounter]")[0];
  same([all.to, all.property, all.until], [{ name: "Aid", slug: "aid", type: "action" }, "duration", { who: "encounter", n: 0 }], "every result's window; the tag, the property and the value case blind, glyphs and spaces free");
  for (const [word, key] of [["Critical Success", "critical-success"], ["success", "success"], ["FAILURE", "failure"], ["critical_failure", "critical-failure"]]) {
    must(cellRules(`[EFFECT ALTER: Aid.${word}; VALUE: Nothing]`)[0].property === key, `${word} is the ${key} property`);
  }
  same(cellRules("[EFFECT ALTER: Steady the Line.duration; VALUE: giver opportunity 2]")[0].to, { name: "Steady the Line", slug: "steady-the-line", type: "action" }, "a Maneuver of several words");
  same(cellRules("[EFFECT ALTER: Aid.critical-failure; VALUE: nothing; IF: RANK(Origin >= expert); IF: RANK(roll = trained)]")[0].when,
    [{ constellation: "origin", name: "Origin", op: ">=", rank: "expert" }, { roll: true, op: "=", rank: "trained" }], "the owner's rank and the rank rolled");
  same(bonusRule("[EFFECT ALTER: Aid.success; VALUE: nothing]", { itemType: "talent" }).to, { name: "Aid", slug: "aid", type: null }, "without a resolver: no type");
  const row = parseAutomation("ALTER: Aid.critical-failure; VALUE: nothing", { resolve, itemType: "effect" });
  same([row.errors, row.rules.map(bare)], [[], [bare(sure.system.rules[0])]], "the bare line on a custom effect row is the same rule");
  same(JSON.parse(JSON.stringify(patient.system.rules[0])), patient.system.rules[0], "a stored rule equals its JSON image");
});

check("alter: the refusals, and the cells drafted for later versions say what is not read yet", () => {
  const reads = "ALTER reads duration, beneficial-duration, critical-success, success, failure, critical-failure, movement and limit";
  same(ALTER_PROPERTIES, ["duration", "beneficial-duration", "critical-success", "success", "failure", "critical-failure", "movement", "limit"], "the properties read");
  // Mike's drafts (2026-11-14): the property is told first, whatever the Maneuver, so a cell for a
  // later version reads as "not yet" and never as a misspelt name. (`Move Together.movement` was
  // one of them until 0.24.0 read it, and `Pay It Forward.limit` until 0.25.0 did.)
  for (const [target, property] of [["Aid", "beneficial-uses"], ["Torchbearer", "range"], ["Working Knowledge", "proficiency"], ["Borrowed Technique", "slots"], ["Rallying Word", "options-per-recipient"]]) {
    must(alterError(`[EFFECT ALTER: ${target}.${property}; VALUE: 2]`) === `the property "${property}" is not read yet: ${reads}`, `${target}.${property}`);
  }
  must(alterError("[EFFECT ALTER: Aid.critical-failure; VALUE: no-effect; PRESERVE: original-degree]") === '"PRESERVE: original-degree" is not a component: after the tag come VALUE: and IF:', "his PRESERVE is no component, and the message names ALTER's own");
  must(alterError("[EFFECT ALTER: Aid.critical-failure; VALUE: no-effect]") === '"no-effect": a result is changed to nothing in this version, as in `ALTER: Aid.critical-failure; VALUE: nothing`', "his no-effect is told the word");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: recipient-opportunity-end(1)]") === 'a window is written `giver opportunity`, `recipient opportunity <N>` or `encounter`, not "recipient-opportunity-end(1)"', "his window is told the three that read");
  must(alterError("[EFFECT ALTER: Aid.critical-failure]") === "ALTER says what the property becomes: add `VALUE: ...`, as in `ALTER: Aid.critical-failure; VALUE: nothing`", "no VALUE");
  must(alterError("[EFFECT ALTER: Aid.critical-failure; VALUE:]") === "VALUE: says what the property becomes, as in `VALUE: nothing` or `VALUE: recipient opportunity 2`", "an empty VALUE");
  must(alterError("[EFFECT ALTER: Aid.critical-failure; VALUE: nothing; VALUE: nothing]") === "VALUE is given twice", "VALUE twice");
  must(alterError("[EFFECT ALTER: Aid; VALUE: nothing]") === '"Aid": an alteration names the Maneuver, a dot, and the property it changes, as in `ALTER: Aid.critical-failure; VALUE: nothing`', "no property");
  must(alterError("[EFFECT ALTER: .duration; VALUE: encounter]").startsWith('".duration": an alteration names the Maneuver'), "no Maneuver");
  must(alterError("[EFFECT ALTER: Aidd.duration; VALUE: encounter]") === '"Aidd" names no Maneuver', "an unknown Maneuver");
  must(alterError("[EFFECT ALTER: Stealth.duration; VALUE: encounter]") === '"Stealth" is a Constellation: ALTER changes what a Maneuver gives, as in `ALTER: Aid.critical-failure; VALUE: nothing`', "a Constellation");
  must(alterError("[EFFECT ALTER: Aid.duration, Aid.success; VALUE: encounter]") === "an alteration is written `ALTER: <Maneuver>.<property>; VALUE: <value>`, as in `ALTER: Aid.critical-failure; VALUE: nothing` (2 descriptors given, 1 wanted: the Maneuver, a dot, the property)", "two properties on one line");
  must(alterError("[EFFECT ALTER:; VALUE: nothing]").startsWith("an alteration is written `ALTER: <Maneuver>.<property>; VALUE: <value>`"), "none");
  must(/IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die/.test(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; IF: RESULT(success)]")), "a degree: the property names it");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; FOR: allies 15]") === "ALTER does not take FOR", "FOR");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; LIMIT: round]") === "ALTER does not take LIMIT", "LIMIT");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; IF: CLAIM(when asked)]") === "ALTER does not take IF: CLAIM(...)", "a claim");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; IFT: TRAIT(Fear)]") === "ALTER does not take IFT: TRAIT(...)", "a trait");
  const ring = parseAutomation("[AURA 15 allies; ALTER: Aid.duration; VALUE: encounter]", { resolve, itemType: "talent" });
  same(ring.errors.map(e => e.message), ["an alteration changes the owner's own Maneuver and cannot ride an [AURA ...] block; write it as its own `[EFFECT ALTER: Aid.critical-failure; VALUE: nothing]`"], "an AURA block");
});

check("give and alter: the summaries", () => {
  const until = ", until the giver's next Opportunity";
  must(summarize(aidRow.system.rules[3]) === `gives a +1 Situation bonus to the next roll with the Constellation chosen, on a Success${until}`, "Aid's Success");
  must(summarize(aidRow.system.rules[0]) === `gives a +2 Situation bonus to the next roll with the Constellation chosen, on a Critical Success, while the rank rolled is at most Expert${until}`, "the rank rolled, in those words");
  must(summarize(aidRow.system.rules[4]) === `gives a -1 Situation penalty to the next roll with the Constellation chosen, on a Critical Failure${until}`, "a penalty, with a plain minus");
  must(summarize(giveRule("[EFFECT GIVE: 1 gear, stealth; IF: RESULT(success); UNTIL: recipient opportunity 2]")) === "gives a +1 Gear bonus to the next roll with Stealth, on a Success, through the recipient's second upcoming Opportunity", "a named Constellation and a window");
  must(summarize(patient.system.rules[0]) === "Aid's results that give a bonus last through the recipient's second upcoming Opportunity", "Patient Assistance");
  must(summarize(sure.system.rules[0]) === "Aid's Critical Failure gives nothing", "Sure Assistance");
  must(summarize(cellRules("[EFFECT ALTER: Aid.duration; VALUE: encounter; IF: RANK(Origin >= expert)]")[0]) === "Aid's results last until the encounter ends, while Origin is at least Expert", "every result, with a condition");
  must(summarize(pendingRule({ label: "Aid from Tess", value: 1, type: "situation", to: { slug: "crafting", name: "Crafting" } })) === "+1 Situation bonus to the next Crafting roll", "a pending result");
  must(summarize(pendingRule({ label: "Aid from Tess", value: -1, type: "situation", to: { slug: "crafting", name: "Crafting" } })) === "-1 Situation penalty to the next Crafting roll", "a pending penalty");
});

/* The table (module/rules/given.mjs), then the same through the dispatcher. */

const DEFAULT_WINDOW = { who: "giver", n: 1 };
const result = (value, extra = {}) => ({ value, type: "situation", to: CHOSEN_TO, until: DEFAULT_WINDOW, altered: [], ...extra });
const line = (degree, value, extra = {}) => ({ degree, value, type: "situation", to: CHOSEN_TO, until: null, ...extra });

check("given: buildTable takes the first line for a degree and applies each alteration to its own property", () => {
  const lines = [line("critSuccess", 2), line("critSuccess", 3), line("success", 1), line("critFail", -1)];
  same(buildTable(lines), { table: { critSuccess: result(2), success: result(1), fail: null, critFail: result(-1) }, notes: {} }, "the first line for a degree stands; a degree no line names gives nothing");
  same(buildTable([line("success", 1, { until: { who: "encounter", n: 0 } })]).table.success.until, { who: "encounter", n: 0 }, "a line's own window");
  same(buildTable([line("success", 0), line("fail", NaN), { degree: "sideways", value: 1 }, null]).table, { critSuccess: null, success: null, fail: null, critFail: null }, "a line of nothing, or of no degree, is no line");
  const longer = { property: "beneficial-duration", until: { who: "recipient", n: 2 }, label: "Patient Assistance" };
  const patientTable = buildTable(lines, [longer]).table;
  same([patientTable.critSuccess, patientTable.success], [result(2, { until: { who: "recipient", n: 2 }, altered: ["Patient Assistance"] }), result(1, { until: { who: "recipient", n: 2 }, altered: ["Patient Assistance"] })], "a longer bonus: the results above 0");
  same(patientTable.critFail, result(-1), "and never the penalty (Mike: same window as a bonus has without it)");
  same(buildTable(lines, [{ property: "duration", until: { who: "encounter", n: 0 }, label: "Lasting" }]).table.critFail, result(-1, { until: { who: "encounter", n: 0 }, altered: ["Lasting"] }), "duration reaches every result");
  const nothing = { property: "critical-failure", nothing: true, label: "Sure Assistance" };
  same(buildTable(lines, [nothing]), { table: { critSuccess: result(2), success: result(1), fail: null, critFail: null }, notes: { critFail: [{ label: "Sure Assistance", nothing: true }] } }, "a degree set to nothing, with the Talent's name for the card");
  same(buildTable(lines, [{ property: "failure", nothing: true, label: "Idle" }]).notes, {}, "an alteration that changes nothing leaves no note");
  const both = buildTable(lines, [longer, nothing]);
  same([both.table.success.until, both.table.critFail, both.notes.critFail.length], [{ who: "recipient", n: 2 }, null, 1], "both Talents at once");
  same(buildTable(lines, [longer, longer]).table.success.altered, ["Patient Assistance"], "a Talent is named once");
  // The more particular property stands over the general one, whichever line comes first; of two
  // changes to one property the later stands; a result names only the change it wears.
  const every = { property: "duration", until: { who: "encounter", n: 0 }, label: "Lasting" };
  for (const order of [[longer, every], [every, longer]]) {
    const t = buildTable(lines, order).table;
    same([t.success.until, t.success.altered, t.critFail.until, t.critFail.altered], [{ who: "recipient", n: 2 }, ["Patient Assistance"], { who: "encounter", n: 0 }, ["Lasting"]], "beneficial-duration over duration, in either order");
  }
  const shorter = { property: "beneficial-duration", until: { who: "giver", n: 2 }, label: "Brisk" };
  same(buildTable(lines, [longer, shorter]).table.success, result(1, { until: { who: "giver", n: 2 }, altered: ["Brisk"] }), "two changes to one property: the later stands, and it alone is named");
  // A Constellation named in a cell read with no resolver has a null type, and is still named.
  const named = buildTable([line("success", 1, { to: { name: "stealth", slug: "stealth", type: null } })]).table.success;
  same([named.to, resultWords(named)], [{ name: "stealth", slug: "stealth", type: null }, "+1 Situation to stealth"], "a null type is a named Constellation, not chosen");
  same(buildTable([{ degree: "success", value: 1, type: "situation" }]).table.success.to, { name: "chosen", slug: "", type: "chosen" }, "a line with no `to` at all is chosen");
  // sameGiven: what the engine asks to learn whether one rule changed a degree.
  const plain = buildTable(lines), withSure = buildTable(lines, [nothing]), withPatient = buildTable(lines, [longer]);
  same(["critSuccess", "success", "fail", "critFail"].map(d => sameGiven(plain, withSure, d)), [true, true, true, false], "Sure Assistance changes a Critical Failure alone");
  same(["critSuccess", "success", "fail", "critFail"].map(d => sameGiven(plain, withPatient, d)), [false, false, true, true], "Patient Assistance changes the two results that give a bonus");
});

const aidGive = { kind: "check", slug: "crafting", item: aidRow, rank: "trained" };

check("ruleGives: Aid's table at the rank rolled, from an Item the roller does not own", () => {
  const actor = rulesActor([humanity], { human: "trained" });
  same(ruleGives(actor, aidGive), { table: { critSuccess: result(2), success: result(1), fail: null, critFail: result(-1) }, notes: {}, marks: [], traces: [] }, "Trained: +2 on a Critical Success, +1, nothing, -1");
  const crit = rank => ruleGives(actor, { ...aidGive, rank }).table.critSuccess.value;
  same(["untrained", "trained", "expert", "master", "legendary"].map(crit), [2, 2, 2, 3, 4], "a master with the check attempted gives +3, a legendary +4");
  same(ruleGives(actor, { ...aidGive, rank: undefined }).table.critSuccess, null, "no rank known: a line that reads the rank rolled does not hold, and the Success line still does");
  same(ruleGives(actor, { ...aidGive, item: searchItem }), { table: null, notes: {}, marks: [], traces: [] }, "a Maneuver with no GIVE line gives nothing");
  const unresolved = { type: "action", name: "Lend an Ear", system: { rules: parseAutomation("[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]", { itemType: "action" }).rules } };
  same(ruleGives(actor, { ...aidGive, item: unresolved }).table.success.to, { name: "stealth", slug: "stealth", type: null }, "a line parsed with no resolver keeps its named Constellation through the table");
  same(ruleGives(actor, { ...aidGive, item: null }).table, null, "a check with no Item");
  same(ruleGives(null, aidGive).table, null, "no roller");
  same(ruleGives(actor, { ...aidGive, item: { ...aidRow, type: "talent" } }).table, null, "only a Maneuver's Item gives");
  const owner = talentWith("Guild Hand", "[EFFECT CHECK: 1 condition, aid]");
  const gated = maneuverWith("Lend a Hand", "[EFFECT GIVE: 2 situation, stealth; IF: RESULT(success); IF: RANK(Origin >= expert)]\n[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]");
  same(["trained", "expert"].map(origin => ruleGives(rulesActor([owner], { origin }), { ...aidGive, item: gated }).table.success.value), [1, 2], "the owner's rank chooses between two lines for one degree, the first that holds");
  same(ruleGives(rulesActor([owner], null), { ...aidGive, item: gated }).table.success.value, 1, "an actor with no proficiency never meets a rank condition");
});

check("ruleGives: the roller's ALTER lines change the table, and only for the Maneuver they name", () => {
  const withPatient = ruleGives(rulesActor([patient]), aidGive);
  same([withPatient.table.critSuccess.until, withPatient.table.success, withPatient.table.critFail.until, withPatient.notes], [{ who: "recipient", n: 2 }, result(1, { until: { who: "recipient", n: 2 }, altered: ["Patient Assistance"] }), DEFAULT_WINDOW, {}], "Patient Assistance: the bonuses last longer, the penalty does not");
  const withSure = ruleGives(rulesActor([sure]), aidGive);
  same([withSure.table.critFail, withSure.notes, withSure.table.success], [null, { critFail: [{ label: "Sure Assistance", nothing: true }] }, result(1)], "Sure Assistance: a Critical Failure gives nothing, and says whose doing it is");
  const both = ruleGives(rulesActor([patient, sure]), aidGive);
  same([both.table.success.until, both.table.critFail], [{ who: "recipient", n: 2 }, null], "both");
  const other = maneuverWith("Lend a Hand", "[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]");
  same(ruleGives(rulesActor([patient, sure]), { ...aidGive, item: other }).table.success, result(1, { to: { name: "Stealth", slug: "stealth", type: "constellation" } }), "another Maneuver is not Aid");
  const seasoned = talentWith("Seasoned Hand", "[EFFECT ALTER: Aid.critical-failure; VALUE: nothing; IF: RANK(Origin >= expert)]");
  same(["trained", "master"].map(origin => ruleGives(rulesActor([seasoned], { origin }), aidGive).table.critFail), [result(-1), null], "an ALTER's own rank condition");
  const steady = talentWith("Steady Hand", "[EFFECT ALTER: Aid.critical-failure; VALUE: nothing; IF: RANK(roll >= expert)]");
  same(["trained", "expert"].map(rank => ruleGives(rulesActor([steady]), { ...aidGive, rank }).table.critFail), [result(-1), null], "and the rank rolled");
  // An ALTER on the roller never reaches a GIVE read as the roller's own: an owned copy of Aid is read once.
  const ownedAid = { ...aidRow, id: "aidcopy1" };
  same(ruleGives(rulesActor([ownedAid, sure]), { ...aidGive, item: ownedAid }).table, { critSuccess: result(2), success: result(1), fail: null, critFail: null }, "an owned copy of the Maneuver: its lines once, the Talent's change on top");
});

check("ruleGives: Off drops a line, Skip leaves it out once and clears only when the degree rolled would have read it, a one-roll effect is spent the same way", () => {
  const state = (item, rule, value) => ({ starwrought: { rules: { state: { [ruleStateKey(item, rule)]: value } } } });
  const sureId = { ...sure, id: "sure0001" };
  const off = rulesActor([sureId]);
  off.flags = state(sureId, sureId.system.rules[0], "off");
  same([ruleGives(off, { ...aidGive, degree: "critFail" }).table.critFail, ruleGives(off, { ...aidGive, degree: "critFail" }).marks], [result(-1), []], "Off: the Talent changes nothing and nothing clears");
  const skip = rulesActor([sureId]);
  skip.flags = state(sureId, sureId.system.rules[0], "skip");
  const key = ruleStateKey(sureId, sureId.system.rules[0]);
  same([ruleGives(skip, { ...aidGive, degree: "critFail" }).table.critFail, ruleGives(skip, { ...aidGive, degree: "critFail" }).marks], [result(-1), [{ key, per: "state" }]], "Skip on a Critical Failure: the penalty stands this once, and the state clears");
  same(ruleGives(skip, { ...aidGive, degree: "success" }).marks, [], "Skip on a Success: Sure Assistance would have read nothing, so it is not spent");
  same(ruleGives(skip, { ...aidGive, degree: null }).marks, [], "and not by a check made against no Threshold");
  // A one-roll custom effect carrying an ALTER.
  const parsed = parseAutomation("ALTER: Aid.beneficial-duration; VALUE: encounter", { resolve, itemName: "Lingering", itemType: "effect" });
  const row = { items: [], system: { effects: [{ id: "fx22", label: "Lingering", text: "ALTER: Aid.beneficial-duration; VALUE: encounter", duration: "roll", rules: parsed.rules }] } };
  row.system.rules = collectRules(row);
  const used = ruleGives(row, { ...aidGive, degree: "success" });
  same([used.table.success.until, used.table.success.altered, used.marks], [{ who: "encounter", n: 0 }, ["Lingering"], [{ key: "fx22", per: "effect" }]], "applied on a Success, and the row goes with the roll");
  same(ruleGives(row, { ...aidGive, degree: "critFail" }).marks, [], "a Critical Failure gives no bonus to lengthen: the row stays");
  // The Maneuver's own lines carry a state only on a copy the roller owns.
  const ownedAid = { ...aidRow, id: "aidcopy2" };
  const success = ownedAid.system.rules[3];
  const skipped = rulesActor([ownedAid]);
  skipped.flags = state(ownedAid, success, "skip");
  const once = ruleGives(skipped, { ...aidGive, item: ownedAid, degree: "success" });
  same([once.table.success, once.marks], [null, [{ key: ruleStateKey(ownedAid, success), per: "state" }]], "a Skip on the copy's Success line: nothing given this once");
  same(ruleGives(skipped, { ...aidGive, item: ownedAid, degree: "critSuccess" }).marks, [], "and not spent by another degree");
  const stranger = rulesActor([]);
  stranger.flags = state(ownedAid, success, "skip");
  same(ruleGives(stranger, { ...aidGive, item: ownedAid, degree: "success" }).table.success, result(1), "an Item the roller does not own is always on, whatever the roller's flags say");
});

check("ruleGives: a line is spent only by a degree it changes, and what a die did not spend is kept for a reroll", () => {
  const state = (item, rule, value) => ({ starwrought: { rules: { state: { [ruleStateKey(item, rule)]: value } } } });
  const oneRoll = (id, text) => {
    const parsed = parseAutomation(text, { resolve, itemName: id, itemType: "effect" });
    must(parsed.errors.length === 0, `"${text}" should parse`);
    return { id, label: id, text, duration: "roll", rules: parsed.rules };
  };
  const withRows = (items, rows) => { const a = { items, system: { effects: rows } }; a.system.rules = collectRules(a); return a; };
  // A Skip the die did not spend comes back as a trace naming the degree it changes.
  const sureId = { ...sure, id: "sure0002" };
  const skip = rulesActor([sureId]);
  skip.flags = state(sureId, sureId.system.rules[0], "skip");
  const key = ruleStateKey(sureId, sureId.system.rules[0]);
  const onSuccess = ruleGives(skip, { ...aidGive, degree: "success" });
  same([onSuccess.marks, onSuccess.traces], [[], [{ degrees: ["critFail"], marks: [{ key, per: "state" }] }]], "a Success leaves Sure Assistance's Skip owed to a Critical Failure, which is what a reroll would land on");
  same(ruleGives(skip, { ...aidGive, degree: "critFail" }).marks, [{ key, per: "state" }], "and a Critical Failure spends it");
  // An alteration that changed nothing is not spent: Sure Assistance had already emptied the degree.
  const lasting = withRows([sure], [oneRoll("fx31", "ALTER: Aid.duration; VALUE: encounter")]);
  const cf = ruleGives(lasting, { ...aidGive, degree: "critFail" });
  same([cf.table.critFail, cf.marks], [null, []], "a one-roll change to every window, on a Critical Failure that gives nothing: the row stays");
  same(ruleGives(lasting, { ...aidGive, degree: "success" }).marks, [{ key: "fx31", per: "effect" }], "and goes with a Success, whose window it changed");
  // Two one-roll rows that both empty one degree: the first did it, the second changed nothing.
  const twice = withRows([], [oneRoll("fx41", "ALTER: Aid.critical-failure; VALUE: nothing"), oneRoll("fx42", "ALTER: Aid.critical-failure; VALUE: nothing")]);
  const emptied = ruleGives(twice, { ...aidGive, degree: "critFail" });
  same([emptied.table.critFail, emptied.notes.critFail.length, emptied.marks], [null, 1, [{ key: "fx41", per: "effect" }]], "one note, and one row spent");
  // A Skip on a line an earlier line shadows: the line would not have been read, so it is not spent.
  const lend = maneuverWith("Lend a Hand", "[EFFECT GIVE: 2 situation, stealth; IF: RESULT(success); IF: RANK(Origin >= expert)]\n[EFFECT GIVE: 1 situation, stealth; IF: RESULT(success)]", { id: "lend0001" });
  const shadowed = rulesActor([lend], { origin: "expert" });
  shadowed.flags = state(lend, lend.system.rules[1], "skip");
  const stands = ruleGives(shadowed, { ...aidGive, item: lend, degree: "success" });
  same([stands.table.success.value, stands.marks, stands.traces], [2, [], []], "the first line stands, and the shadowed line's Skip is left alone");
  const reached = rulesActor([lend], { origin: "trained" });
  reached.flags = state(lend, lend.system.rules[1], "skip");
  const passed = ruleGives(reached, { ...aidGive, item: lend, degree: "success" });
  same([passed.table.success, passed.marks], [null, [{ key: ruleStateKey(lend, lend.system.rules[1]), per: "state" }]], "where the skipped line would have been the result, it is left out and spent");
});

check("ruleGives: a hook that throws and a hook that answers badly contribute nothing", () => {
  registerKind({ id: "explosive-give", parse: () => ({}), summary: () => "", hooks: { gives() { throw new Error("kaboom"); } } });
  registerKind({ id: "sloppy-give", parse: () => ({}), summary: () => "", hooks: { gives: () => [null, "x", {}, { line: null }, { line: { degree: "sideways", value: 9 } }, { alteration: "soon" }, 7] } });
  const volatile = { type: "talent", name: "Volatile", system: { rules: [{ kind: "explosive-give", line: 1, text: "x" }, { kind: "sloppy-give", line: 2, text: "y" }] } };
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  let answer;
  try {
    answer = ruleGives(rulesActor([volatile, sure]), aidGive);
  } finally {
    console.error = original;
  }
  same([answer.table.success, answer.table.critFail], [result(1), null], "the other kinds' answers still arrive");
  must(errors.length === 1 && /the "explosive-give" kind's gives hook failed/.test(String(errors[0][0])), `the failure is reported once: ${JSON.stringify(errors.map(e => String(e[0])))}`);
});

/* The pending result: the entry, its carrier, the modifier it puts on a roll, the mark that removes it. */

const TESS = { uuid: "Actor.tess", name: "Tess" };
const entryFor = (options = {}) => pendingEntry({
  result: result(1), to: { slug: "crafting", name: "Crafting" }, maneuver: { slug: "aid", name: "Aid" }, giver: TESS,
  combat: "c1", giverCombatant: "cTess", recipientCombatant: "cWren", message: "msg1", ...options
});

/** An actor holding pending results, indexed as the data model indexes one. */
function holding(...entries) {
  const given = {};
  for (const entry of entries) given[givenFlagKey(entry.id)] = entry;
  const actor = { items: [], system: {}, flags: { starwrought: { rules: { given } } } };
  actor.system.rules = collectRules(actor);
  return actor;
}

check("given: pendingEntry is one result per Maneuver, with the window it can count", () => {
  same(entryFor(), {
    id: "given:aid", label: "Aid from Tess", value: 1, type: "situation", to: { slug: "crafting", name: "Crafting" },
    by: "Actor.tess", byName: "Tess", maneuver: "aid", maneuverName: "Aid", combat: "c1",
    until: { who: "giver", combatant: "cTess", n: 1, begun: 0 }, message: "msg1"
  }, "the default window, counted against the giver's Combatant");
  same(entryFor({ result: result(1, { until: { who: "recipient", n: 2 } }) }).until, { who: "recipient", combatant: "cWren", n: 2, begun: 0 }, "the recipient's window, against the recipient's");
  same(entryFor({ result: result(1, { until: { who: "encounter", n: 0 } }) }).until, { who: "encounter", combatant: null, n: 0, begun: 0 }, "the encounter");
  same(entryFor({ giverCombatant: null }).until, { who: "encounter", combatant: null, n: 0, begun: 0 }, "a giver with no Combatant cannot be counted: the encounter");
  same(entryFor({ result: result(1, { until: { who: "recipient", n: 2 } }), recipientCombatant: null }).until.who, "encounter", "nor a recipient with none");
  same([entryFor({ combat: null }).until, entryFor({ combat: null }).combat], [null, null], "outside an encounter there is no window");
  same([isGivenKey("given:aid"), isGivenKey("fx1"), givenFlagKey("given:aid"), givenFlagKey("aid")], [true, false, "aid", "aid"], "the id and the flag key");
  same(JSON.parse(JSON.stringify(entryFor())), entryFor(), "an entry equals its JSON image");
  // Every entry carries every key, so a merge of the flag over an older entry leaves nothing of it.
  same(Object.keys(entryFor({ combat: null })), Object.keys(entryFor()), "the same keys in and out of an encounter");
});

check("given: settle closes a giver's window as an Opportunity begins and a recipient's as its last one ends", () => {
  const at = change => ({ combat: "c1", ...change });
  const giver = entryFor();
  same([settle(giver, at({ began: "cTess" })), settle(giver, at({ began: "cWren" })), settle(giver, at({ ended: "cTess" }))], ["expire", "keep", "keep"], "the default: until the giver's next Opportunity begins");
  same(settle(giver, { combat: "c2", began: "cTess" }), "keep", "another Combat's turns are not this entry's");
  const second = entryFor({ result: result(1, { until: { who: "giver", n: 2 } }) });
  same([settle(second, at({ began: "cTess" })), settle({ ...second, until: { ...second.until, begun: 1 } }, at({ began: "cTess" }))], [{ begun: 1 }, "expire"], "the giver's second: counted, then closed");
  // Patient Assistance: through the END of the recipient's second upcoming Opportunity.
  const wren = entryFor({ result: result(1, { until: { who: "recipient", n: 2 } }) });
  const counted = begun => ({ ...wren, until: { ...wren.until, begun } });
  same(settle(counted(0), at({ ended: "cWren" })), "keep", "an Opportunity already running when the result was given is not one of the two");
  same(settle(counted(0), at({ began: "cWren" })), { begun: 1 }, "the first begins");
  same(settle(counted(1), at({ ended: "cWren" })), "keep", "the first ends: one to go");
  same(settle(counted(1), at({ began: "cWren" })), { begun: 2 }, "the second begins");
  same(settle(counted(2), at({ began: "cTess" })), "keep", "someone else's Opportunity changes nothing");
  same(settle(counted(2), at({ ended: "cWren" })), "expire", "the second ends: the window closes");
  same([settle(counted(0), at({ ended: "cWren", began: "cWren" })), settle(counted(1), at({ ended: "cWren", began: "cWren" })), settle(counted(2), at({ ended: "cWren", began: "cWren" }))], [{ begun: 1 }, { begun: 2 }, "expire"], "a lone fighter's turn change ends one Opportunity before it counts the next");
  const one = entryFor({ result: result(1, { until: { who: "recipient", n: 1 } }) });
  same([settle(one, at({ began: "cWren" })), settle({ ...one, until: { ...one.until, begun: 1 } }, at({ ended: "cWren" }))], [{ begun: 1 }, "expire"], "one Opportunity of the recipient's");
  same(settle(entryFor({ result: result(1, { until: { who: "encounter", n: 0 } }) }), at({ began: "cTess", ended: "cWren" })), "keep", "the encounter's window closes with the Combat, not with a turn");
  same(settle(entryFor({ combat: null }), at({ began: "cTess" })), "keep", "a result given outside an encounter has no window");
  same([settle(null, at({ began: "cTess" })), settle({}, {})], ["keep", "keep"], "nothing in, nothing done");
  same([appliesNow(giver, { combat: "c1", round: 3 }), appliesNow(giver, { combat: "c2", round: 1 }), appliesNow(giver, null), appliesNow(entryFor({ combat: null }), { combat: "c9", round: 1 }), appliesNow(entryFor({ combat: null }), null), appliesNow(null, null)],
    [true, false, false, true, true, false], "a result of one Combat applies in that Combat alone; one given outside any applies anywhere");
});

check("given: the words for the button, the give card and the Effects tab", () => {
  same([resultWords(result(1)), resultWords(result(1), "Crafting"), resultWords(result(-1), "Crafting"), resultWords(result(2, { type: "gear", to: { name: "Stealth", slug: "stealth", type: "constellation" } }))],
    ["+1 Situation", "+1 Situation to Crafting", "-1 Situation to Crafting", "+2 Gear to Stealth"], "a result, before and after the Constellation is chosen");
  same([windowWords(DEFAULT_WINDOW, { giver: "Tess", recipient: "Wren" }), windowWords({ who: "recipient", n: 2 }, { giver: "Tess", recipient: "Wren" }), windowWords({ who: "encounter", n: 0 }), windowWords(DEFAULT_WINDOW, { giver: "Tess", encounter: false })],
    ["until Tess's next Opportunity", "through Wren's second upcoming Opportunity", "until the encounter ends", "until it is used"], "a window, by name, and none outside an encounter");
  const wren = entryFor({ result: result(1, { until: { who: "recipient", n: 2 } }) });
  const names = { giver: "Tess", recipient: "Wren" };
  same([0, 1, 2].map(begun => pendingWindowWords({ ...wren, until: { ...wren.until, begun } }, names)), ["through Wren's second upcoming Opportunity", "through Wren's next Opportunity", "through Wren's Opportunity"], "a pending window is said from what is left of it");
  same([pendingWindowWords(entryFor(), names), pendingWindowWords(entryFor({ combat: null }), names), pendingWindowWords(entryFor({ giverCombatant: null }), names)], ["until Tess's next Opportunity", "until it is used", "until the encounter ends"], "the giver's, none, and the encounter's");
});

check("collectRules indexes a pending result as a one-roll carrier, and the give kind puts it on the next roll with its Constellation", () => {
  const wren = holding(entryFor());
  same(givenResults(wren).map(e => e.id), ["given:aid"], "the entries, off the flags");
  const entries = rulesOfKind(wren, "give");
  same(entries.map(e => [e.item.id, e.item.name, e.item.type, e.item.effect.duration, e.rule]), [["given:aid", "Aid from Tess", "effect", "roll", pendingRule(entryFor())]], "one carrier, one resolved rule");
  must(givenCarrier(entryFor()).given.id === "given:aid", "the carrier keeps its entry");
  const inFight = { encounter: { combat: "c1", round: 2 } };
  // `given` (0.25.0) names the Maneuver whose result the modifier is, for the roll's card to keep.
  // `givenFrom` names which result: the card of the check that gave it (the entry's `message`).
  const applied = [{ label: "Aid from Tess", value: 1, type: "situation", source: "rule:given:aid:crafting", given: "aid", givenFrom: "msg1" }];
  const spent = [{ key: "given:aid", per: "effect" }];
  const roll = ruleModifiers(wren, { kind: "check", slug: "crafting", item: null, rank: "trained", ...inFight });
  same([roll.applied, roll.offered, roll.marks], [applied, [], spent], "a Crafting check: applied, never offered, and the result goes with the roll");
  for (const kind of ["attack", "initiative"]) same(ruleModifiers(wren, { kind, slug: "crafting", item: null, ...inFight }).applied, applied, `${kind === "attack" ? "an" : "a"} ${kind} rolled with the Constellation`);
  const guard = holding(entryFor({ to: { slug: "guard", name: "Guard" } }));
  const guardRoll = ruleModifiers(guard, { kind: "defense", slug: "guard", item: null, momentOnly: true, ...inFight });
  same([guardRoll.applied.map(m => m.value), guardRoll.marks], [[1], spent], "a Guard roll: applied and spent");
  same(ruleModifiers(guard, { kind: "defense", slug: "guard", item: null, staticOnly: true }), { applied: [], offered: [], marks: [] }, "the sheet's Defense pass never folds it into the Threshold");
  same(ruleModifiers(guard, { kind: "defense", slug: "guard", item: null, momentOnly: true, read: true, ...inFight }), { applied: [], offered: [], marks: [] }, "a Threshold read neither carries it nor spends it");
  same(ruleModifiers(guard, { kind: "attack", slug: "guard", item: null, pairingOnly: true, ...inFight }), { applied: [], offered: [], marks: [] }, "nor does a Strike's pairing");
  const awareness = holding(entryFor({ to: { slug: "awareness", name: "Awareness" } }));
  same(ruleModifiers(awareness, { kind: "initiative", slug: "awareness", item: null, momentOnly: true, leavePending: true, ...inFight }), { applied: [], offered: [], marks: [] }, "the tracker's own Initiative die, a total nothing is written after, leaves it where it is");
  same(ruleModifiers(awareness, { kind: "initiative", slug: "awareness", item: null, momentOnly: true, ...inFight }).marks, spent, "and an Initiative rolled from the sheet carries it and uses it up");
  const lore = holding(entryFor({ to: { slug: "lore-circus", name: "Lore (Circus)" } }));
  same(ruleModifiers(lore, { kind: "check", slug: "lore-circus", item: null, ...inFight }).applied.map(m => m.source), ["rule:given:aid:lore-circus"], "a Lore chosen when the result was given");
  same(ruleModifiers(wren, { kind: "check", slug: "stealth", item: null, ...inFight }), { applied: [], offered: [], marks: [] }, "another Constellation's roll is not it");
  same(ruleModifiers(wren, { kind: "move", slug: "", item: null, ...inFight }).applied, [], "nor a Move");
  same(ruleModifiers(wren, { kind: "check", slug: "crafting", item: null, encounter: { combat: "c2", round: 1 } }), { applied: [], offered: [], marks: [] }, "another Combat: neither applied nor spent");
  same(ruleModifiers(wren, { kind: "check", slug: "crafting", item: null, encounter: { combat: null, round: 0 } }).applied, [], "nor once its Combat is over");
  same(ruleModifiers(holding(entryFor({ combat: null })), { kind: "check", slug: "crafting", item: null, ...inFight }).applied.map(m => m.value), [1], "a result given outside an encounter applies inside one");
  const penalty = holding(entryFor({ result: result(-1) }));
  same(ruleModifiers(penalty, { kind: "check", slug: "crafting", item: null, ...inFight }).applied.map(m => [m.label, m.value]), [["Aid from Tess", -1]], "a penalty is carried as a bonus is");
  // The roller's own GIVE and ALTER lines are no modifiers: only a pending result is.
  same(ruleModifiers(rulesActor([{ ...aidRow, id: "aidcopy3" }, patient, sure]), { kind: "check", slug: "crafting", item: aidRow, rank: "trained" }), { applied: [], offered: [], marks: [] }, "a Maneuver's GIVE lines and a Talent's ALTER lines put nothing on a roll");
  same(ruleGives(wren, aidGive).table.success, result(1), "and a pending result is no line of the table when its holder Aids in turn");
});

check("markUpdates removes a used result's flag, and leaves a custom effect's row to its own id", () => {
  const wren = holding(entryFor());
  same(markUpdates(wren, [{ key: "given:aid", per: "effect" }]), { "flags.starwrought.rules.given.-=aid": null }, "the flag goes with the roll");
  same(markUpdates(wren, [{ key: "given:search", per: "effect" }]), {}, "a result that is not there deletes nothing");
  same(markUpdates(wren, [{ key: "given:aid", per: "state" }, { key: "given:aid", per: "round" }]), {}, "only the one-roll mark removes it");
  same(markUpdates({ items: [], system: {}, flags: {} }, [{ key: "given:aid", per: "effect" }]), {}, "an actor holding nothing");
});

/* -------------------------------------------- */
/*  0.24.0: the permit kind, ALTER's movement, and the Move made as part of a Maneuver */
/* -------------------------------------------- */

const MOVE_TOGETHER_CELL = "[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]";
const moveTogether = { ...maneuverWith("Move Together ❶", MOVE_TOGETHER_CELL), id: "mt1" };
const footwork = { ...talentWith("Coordinated Footwork", "[EFFECT ALTER: Move Together.movement; VALUE: step]"), id: "cf1" };
const permitError = (cell, context = onRowOf) => bonusError(cell, context);

/** The owner of Move Together, as the engine reads an actor. */
function mover(items = [moveTogether], flags = {}) {
  const actor = rulesActor(items, { origin: "trained" });
  actor.name = "Tess";
  actor.uuid = "Actor.tess";
  actor.flags = flags;
  return actor;
}

/** The context `SwItem#useWithRules` hands a `use` hook, with Wren targeted in round 2 of Combat c1. */
function useContext({ gap = 0, relation = "ally", actions = 2, statuses = [], inEncounter = true, encounter = { combat: "c1", round: 2, combatant: "cmb-tess" }, target = true } = {}) {
  return {
    target: target ? {
      actor: { statuses: new Set(statuses), system: { actions: { value: actions } } },
      uuid: relation === "self" ? "Actor.tess" : "Actor.wren", tokenUuid: "Scene.s.Token.w", tokenId: "w", token: { id: "w" },
      name: relation === "enemy" ? "Bandit" : "Wren", relation, inEncounter
    } : null,
    encounter,
    scene: { token: { id: "t" }, gap: () => gap },
    nonce: "n1"
  };
}

check("permit: registered at the use hook, with the PERMIT tag, and it draws a Use control", () => {
  const kind = kindOf("permit");
  must(kind && kind.id === "permit", "kindOf('permit')");
  same([kind.aliases, Object.keys(kind.hooks)], [[], ["use"]], "no aliases, one hook");
  must(EFFECT_TAGS.permit === "permit", "the PERMIT tag names the kind");
  must(usableByRule(moveTogether), "a Maneuver with a PERMIT line is used, so its row shows the Use control");
  must(!usableByRule(footwork), "an ALTER of a Maneuver's movement draws none: alter has no use hook");
  same(Object.keys(kindOf("alter").hooks), ["gives"], "alter still speaks at gives alone");
});

check("permit: every accepted form on a Maneuver's row, stored whole, and its summary", () => {
  same(moveTogether.system.rules, [{
    what: "move", for: { who: "allies", range: 0 }, limit: { per: "round" }, when: null,
    kind: "permit", line: 1, text: MOVE_TOGETHER_CELL
  }], "Move Together's cell");
  const loose = giveRule("[EFFECT permit: MOVE; for: All; limit: Encounter; IF: RANK(Origin >= expert)]");
  same([loose.what, loose.for, loose.limit, loose.when], ["move", { who: "all", range: null }, { per: "encounter" }, [{ constellation: "origin", name: "Origin", op: ">=", rank: "expert" }]], "case blind; any creature, no range; once an encounter; the owner's rank");
  same(giveRule("[EFFECT PERMIT: move; FOR: enemies 10]").limit, null, "no LIMIT is no limit");
  must(summarize(moveTogether.system.rules[0]) === "lets an adjacent ally you target make one Move now, outside its Opportunity, once a round", `the summary: "${summarize(moveTogether.system.rules[0])}"`);
  must(summarize(loose) === "lets a creature you target make one Move now, outside its Opportunity, once an encounter, while Origin is at least Expert", `with a rank: "${summarize(loose)}"`);
  must(summarize(giveRule("[EFFECT PERMIT: move; FOR: allies 10]")) === "lets an ally within 10 ft you target make one Move now, outside its Opportunity", "a range in feet");
  same(JSON.parse(JSON.stringify(moveTogether.system.rules[0])), moveTogether.system.rules[0], "a stored rule equals its JSON image");
});

check("permit: the refusals, each by its message", () => {
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0]", { resolve, itemType: "talent" }) === "PERMIT is written on the Maneuver's own row: it is what using that Maneuver lets another creature do", "in a Talent's cell");
  must(permitError("[EFFECT PERMIT: move]") === "PERMIT says who may be permitted: add `FOR: allies 0` (an adjacent ally), as in `PERMIT: move; FOR: allies 0; LIMIT: round`", "no FOR");
  must(permitError("[EFFECT PERMIT: move; FOR: self]") === 'PERMIT is for another creature (FOR: allies, enemies, all), not "self": nobody needs leave at their own Opportunity', "FOR: self");
  must(permitError("[EFFECT PERMIT: move; FOR: self+allies 0]").startsWith("PERMIT is for another creature"), "FOR: self+allies");
  must(permitError("[EFFECT PERMIT: strike; FOR: allies 0]") === '"strike": PERMIT permits a move in this version, as in `PERMIT: move; FOR: allies 0; LIMIT: round`', "another Maneuver is not read yet");
  must(permitError("[EFFECT PERMIT: move, ally; FOR: allies 0]") === "a permission is written `PERMIT: <what>; FOR: <who> [<N>]`, as in `PERMIT: move; FOR: allies 0; LIMIT: round` (2 descriptors given, 1 wanted: what is permitted)", "the ally is said with FOR, not as a descriptor");
  must(permitError("[EFFECT PERMIT:; FOR: allies 0]").startsWith("a permission is written `PERMIT: <what>; FOR: <who> [<N>]`"), "nothing permitted");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IF: RANK(roll = trained)]").startsWith("PERMIT acts when the Maneuver is used, before any roll"), "the rank rolled");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IFT: TRAIT(Fear)]") === "PERMIT does not take IFT: TRAIT(...)", "a trait");
  must(/IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die/.test(permitError("[EFFECT PERMIT: move; FOR: allies 0; IF: RESULT(success)]")), "a degree");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IF: CLAIM(when asked)]") === "PERMIT does not take IF: CLAIM(...)", "a claim");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IFT: MARKED]") === "PERMIT does not take IFT: MARKED", "a mark");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; UNTIL: encounter]") === "PERMIT does not take UNTIL", "UNTIL is GIVE's");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; VALUE: step]") === "PERMIT does not take VALUE", "VALUE is ALTER's");
  // An aura block keeps its ring and refuses the effect inside it.
  const ridden = parseAutomation("[AURA 15 allies; PERMIT: move]", onRowOf);
  must((ridden.errors.length === 1) && ridden.rules.every(r => r.kind !== "permit"), `it cannot ride an aura's ring: ${ridden.errors.map(e => e.message).join("; ")}`);
});

check("permit: used with an adjacent ally targeted, it writes one record on the owner and files the limit (rulings 240, 243, 244)", () => {
  const tess = mover();
  const uses = ruleUses(tess, moveTogether, useContext());
  same(uses.length, 1, "one answer");
  const [use] = uses;
  same([use.refuse, use.warn], ["", []], "no refusal, no warning");
  same(use.write, { "flags.starwrought.maneuverMove": {
    nonce: "n1", combat: "c1", round: 2, during: "cmb-tess", from: "Move Together",
    userTokenId: "t", allyTokenId: "w", allyName: "Wren", range: 0, step: false, moved: false
  } }, "the record: on the owner, naming both tokens, the Opportunity it was used in and how near the ally should end");
  same(use.marks, [{ key: "mt1:1", per: "round" }], "the LIMIT is filed as FIRST and ONCE are");
  must(use.say === "Tess's own Move is paid for: the next drag of Tess's token is it. Wren may then make one Move now, outside its Opportunity, paying for it itself. Each is a Move, however short.", `the card's line: "${use.say}"`);
});

check("permit: nobody, yourself, a non-ally and a second use in the round are refused, with nothing written (ruling 243)", () => {
  const refusal = (actor, context) => { const [u] = ruleUses(actor, moveTogether, context); return [u.refuse, u.write, u.marks]; };
  same(refusal(mover(), useContext({ target: false })), ["Move Together: target exactly one creature first, the one who moves with you.", null, []], "nobody targeted");
  same(refusal(mover(), useContext({ relation: "self" })), ["Move Together: target the creature who moves with you, not Tess.", null, []], "yourself");
  same(refusal(mover(), useContext({ relation: "enemy" })), ["Move Together is for an adjacent ally; Bandit is not one.", null, []], "an enemy");
  const spent = { starwrought: { rules: { round: { "mt1:1": { combat: "c1", round: 2 } } } } };
  same(refusal(mover([moveTogether], spent), useContext()), ["Move Together: already used this round.", null, []], "a second use in round 2");
  same(ruleUses(mover([moveTogether], spent), moveTogether, useContext({ encounter: { combat: "c1", round: 3, combatant: "cmb-tess" } }))[0].refuse, "", "the next round, it is used again");
  same(ruleUses(mover([moveTogether], spent), moveTogether, useContext({ encounter: { combat: "c2", round: 2, combatant: "cmb-tess" } }))[0].refuse, "", "and in another encounter");
});

check("permit: a requirement the machine can read is a warning, and the Maneuver still happens (Mike: \"Warn and go on\")", () => {
  const warned = context => { const [u] = ruleUses(mover(), moveTogether, context); return [u.warn, u.refuse, !!u.write]; };
  same(warned(useContext({ gap: 4 })), [["Wren is 4 ft from Tess: Move Together asks for an adjacent ally."], "", true], "a gap above the FOR range");
  same(warned(useContext({ actions: 0 })), [["Wren has no action left to Move with."], "", true], "no action left");
  same(warned(useContext({ statuses: ["unconscious"] })), [["Wren is not conscious."], "", true], "unconscious");
  same(warned(useContext({ inEncounter: false })), [["Wren is not in the encounter, so its Move is not counted."], "", true], "not a fighter in the encounter");
  same(warned(useContext({ gap: 4, actions: 0, statuses: ["dying"] }))[0].length, 3, "every warning that holds is said");
  const outside = ruleUses(mover(), moveTogether, useContext({ encounter: { combat: null, round: 0, combatant: null } }))[0];
  same([outside.refuse, outside.write, outside.marks, outside.say], ["", null, [], "Wren may Move with Tess. Outside an encounter nothing is counted."], "outside an encounter nothing is written or limited");
});

check("alter: the movement property is VALUE: step, read at use and never by what a Maneuver gives (ruling 242)", () => {
  const text = "[EFFECT ALTER: Move Together.movement; VALUE: step]";
  same(footwork.system.rules, [{
    to: { name: "Move Together", slug: "move-together", type: "action" }, property: "movement", nothing: false, until: null, movement: "step", when: null,
    kind: "alter", line: 1, text
  }], "Coordinated Footwork's cell");
  must(!("movement" in patient.system.rules[0]), "an alteration of any other property keeps the shape it had");
  must(summarize(footwork.system.rules[0]) === "a drag within half Speed made as part of Move Together is a Step", `the summary: "${summarize(footwork.system.rules[0])}"`);
  must(alterError("[EFFECT ALTER: Move Together.movement; VALUE: choose(Move, Step)]") === '"choose(Move, Step)": a Maneuver\'s movement is changed to `step` in this version, as in `ALTER: Move Together.movement; VALUE: step` (a drag within half Speed made as part of the Maneuver is then a Step, for everyone who moves in it)', "his drafted value is told the word");
  must(alterError("[EFFECT ALTER: Move Together.movement; VALUE: choose(Move, Step); APPLY: both-participants]") === '"APPLY" is a tag and begins its own line; one effect per line, its conditions after it as IF:, IFT:, FOR: and LIMIT:', "his APPLY is a tag of its own since 0.32.0, and no component");
  same(kindOf("alter").hooks.gives([{ rule: footwork.system.rules[0], item: footwork, from: "own" }], { maneuver: "move-together", rank: "trained" }, mover()), [], "the gives hook passes it over");

  same(alterationsOf(mover([moveTogether, footwork]), moveTogether), [{ property: "movement", movement: "step", per: null, nothing: false, until: null, label: "Coordinated Footwork", skipped: false, marks: [] }], "the owner's alteration of the used Maneuver");
  same(alterationsOf(mover([moveTogether, footwork]), aidRow), [], "another Maneuver's alterations are not this one's");
  same(alterationsOf(mover([moveTogether, patient]), moveTogether), [], "nor is an alteration of Aid Move Together's");

  const record = actor => ruleUses(actor, moveTogether, useContext())[0].write["flags.starwrought.maneuverMove"];
  same([record(mover()).step, record(mover([moveTogether, footwork])).step], [false, true], "with Coordinated Footwork the record says a short drag is a Step");
  must(ruleUses(mover([moveTogether, footwork]), moveTogether, useContext())[0].say.endsWith("A drag within half Speed is a Step for either of them."), "and the card says so");
  const stateKey = ruleStateKey(footwork, footwork.system.rules[0]);
  same(record(mover([moveTogether, footwork], { starwrought: { rules: { state: { [stateKey]: "off" } } } })).step, false, "switched Off on the Effects tab, it changes nothing");
  // Skip leaves the alteration out this once, and the use that counted clears it (the review's
  // finding: read as On, it made Steps anyway and stayed Skip for good).
  const skipping = () => mover([moveTogether, footwork], { starwrought: { rules: { state: { [stateKey]: "skip" } } } });
  same(record(skipping()).step, false, "on Skip the drags are plain Moves this once");
  same(ruleUses(skipping(), moveTogether, useContext())[0].marks, [{ key: "mt1:1", per: "round" }, { key: stateKey, per: "state" }], "and the Skip is spent with the use, beside the LIMIT");
  same(ruleUses(skipping(), moveTogether, useContext({ relation: "enemy" }))[0].marks, [], "a refused use spends no Skip");
  same(ruleUses(skipping(), moveTogether, useContext({ encounter: { combat: null, round: 0, combatant: null } }))[0].marks, [], "nor does a use outside an encounter");
  same(alterationsOf(skipping(), moveTogether).map(a => [a.skipped, a.marks]), [[true, [{ key: stateKey, per: "state" }]]], "the engine hands the Skip over with its mark");
  const ranked = { ...talentWith("Sure Feet", "[EFFECT ALTER: Move Together.movement; VALUE: step; IF: RANK(Origin >= expert)]"), id: "sf1" };
  same(record(mover([moveTogether, ranked])).step, false, "a rank the owner has not reached");
});

check("the Maneuver's Move: a record is live only in the Opportunity it was used in, for the two tokens it names (ruling 240)", () => {
  const record = moveRecord({ nonce: "n1", combat: "c1", round: 2, during: "cmb-tess", from: "Move Together", userTokenId: "t", allyTokenId: "w", allyName: "Wren" });
  same(Object.keys(record), ["nonce", "combat", "round", "during", "from", "userTokenId", "allyTokenId", "allyName", "range", "step", "moved"], "every key is written every time");
  same([record.range, moveRecord({ range: 0 }).range, moveRecord({ range: 10 }).range], [null, 0, 10], "no range, adjacent, a range in feet");
  must(MOVE_RECORD_FLAG === "maneuverMove" && MOVE_USED_FLAG === "maneuverMoved", "the two flags");
  const now = { combat: "c1", round: 2, combatant: "cmb-tess" };
  must(recordLive(record, now), "live in its Opportunity");
  for (const [other, why] of [[{ ...now, combatant: "cmb-wren" }, "the next fighter's Opportunity"], [{ ...now, round: 3 }, "the next round"], [{ ...now, combat: "c2" }, "another Combat"], [{ combat: null, round: 0, combatant: null }, "no encounter"]]) {
    must(!recordLive(record, other), `not live in ${why}`);
  }
  must(!recordLive(null, now) && !recordLive({ ...record, nonce: "" }, now) && !recordLive({ ...record, during: null }, now), "nothing, no nonce, no Opportunity: not live");

  const facts = { records: [record], used: null, encounter: now };
  same(moveRoleFor("t", facts)?.role, "user", "the user's own token");
  same(moveRoleFor("w", facts)?.role, "ally", "the ally's token");
  same(moveRoleFor("b", facts), null, "any other token");
  same(moveRoleFor("t", { ...facts, records: [{ ...record, moved: true }] }), null, "the user has made their Move");
  same(moveRoleFor("w", { ...facts, records: [{ ...record, moved: true }] })?.role, "ally", "which leaves the ally's standing");
  same(moveRoleFor("w", { ...facts, used: "n1" }), null, "the ally has moved for this use");
  same(moveRoleFor("w", { ...facts, used: "n0" })?.role, "ally", "an older use's mark does not spend this one");
  same(moveRoleFor("w", { ...facts, encounter: { ...now, combatant: "cmb-wren" } }), null, "a record that is not live permits nothing");
  same(moveRoleFor("", facts), null, "no token");

  // The ally's mark is a list of uses: two fighters may permit the same ally in one Opportunity,
  // and a mark of one nonce forgot the first on the second, so the ally could alternate for ever.
  const second = { ...record, nonce: "n2", userTokenId: "b" };
  const both = { records: [record, second], encounter: now };
  same(moveRoleFor("w", { ...both, used: withUsed(null, "n1") })?.record.nonce, "n2", "moved for the first, the second still stands");
  same(moveRoleFor("w", { ...both, used: withUsed(withUsed(null, "n1"), "n2") }), null, "moved for both, nothing stands");
  same([usedNonces(null), usedNonces("n1"), usedNonces(["n1", "", 3]), usedNonces({ nonce: "n0" }), usedNonces({ nonces: ["n1", "n2"] })], [[], ["n1"], ["n1"], ["n0"], ["n1", "n2"]], "a mark read in every shape it has had");
  same(withUsed({ nonces: ["n1", "n2"] }, "n1"), { nonces: ["n2", "n1"] }, "a use is on the list once");
  let long = null;
  for (let i = 0; i < MOVE_USED_KEPT + 3; i++) long = withUsed(long, `u${i}`);
  same([long.nonces.length, long.nonces.at(-1)], [MOVE_USED_KEPT, `u${MOVE_USED_KEPT + 2}`], "the last few are kept");
});

check("permit: a Combat on screen that the owner is no part of counts nothing, and no Opportunity running says so", () => {
  const bystander = mover();
  bystander.inEncounter = false;
  const [use] = ruleUses(bystander, moveTogether, useContext());
  same([use.refuse, use.write, use.marks, use.say], ["", null, [], "Wren may Move with Tess. Outside an encounter nothing is counted."], "the owner is not a fighter: nothing is paid, so nothing is written or limited");
  const spent = { starwrought: { rules: { round: { "mt1:1": { combat: "c1", round: 2 } } } } };
  const out = mover([moveTogether], spent);
  out.inEncounter = false;
  same(ruleUses(out, moveTogether, useContext())[0].refuse, "", "and an old mark of that Combat refuses nothing there");
  const [idle] = ruleUses(mover(), moveTogether, useContext({ encounter: { combat: "c1", round: 2, combatant: null } }));
  same([idle.write, idle.marks, idle.say], [null, [], "Wren may Move with Tess. Nobody's Opportunity is running, so the Moves are not counted."], "a started Combat with nobody's Opportunity running");
});

check("the Maneuver's Move: a Move however short, never a Rush, a Step only with the alteration, and the user's is paid (rulings 241, 242)", () => {
  const record = moveRecord({ nonce: "n1", combat: "c1", round: 2, during: "cmb-tess", userTokenId: "t", allyTokenId: "w" });
  const user = { role: "user", record };
  const ally = { role: "ally", record };
  const stepping = { role: "ally", record: { ...record, step: true } };
  const step = { kind: "step", actions: 1, moves: 1, rushInstead: false };
  const move = { kind: "move", actions: 1, moves: 1, rushInstead: false };
  const far = { kind: "move", actions: 2, moves: 2, rushInstead: false };
  const rush = { kind: "rush", actions: 2, moves: 3, rushInstead: false };
  const crawl = { kind: "crawl", actions: 2, moves: 2, rushInstead: false };
  const read = (m, held) => { const r = asManeuverMove(m, held); return [r.kind, r.actions, r.forced, r.prepaid, r.charge]; };
  same(read(step, ally), ["move", 1, true, 0, 1], "the ally's short drag is a Move, and the ally pays 1");
  same(read(step, user), ["move", 1, true, 1, 0], "the user's short drag is a Move, already paid");
  same(read(move, user), ["move", 1, false, 1, 0], "the user's Move within Speed costs nothing more");
  same(read(far, user), ["move", 2, false, 1, 1], "a longer drag pays for the second Move");
  same(read(rush, ally), ["move", 3, true, 0, 3], "a straight long drag is no Rush: as many Moves as it needs, for the cap to refuse");
  same(read(crawl, user), ["crawl", 2, false, 1, 1], "a Speed 0 crawl stays a crawl, one of them paid");
  same(read(step, stepping), ["step", 1, false, 0, 1], "with the alteration a short drag is a Step");
  same(read(step, { role: "user", record: { ...record, step: true } }), ["step", 1, false, 1, 0], "for the user too, and still paid");
  same(read(rush, stepping), ["move", 3, true, 0, 3], "the alteration frees a Step, never a Rush");
});

/* -------------------------------------------- */
/*  0.25.0: the subordinate kind, EFFECT(<name>, used), the used Effect, ALTER's limit */
/* -------------------------------------------- */

const PIF_CELL = "[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter]";
const PIF_EXAMPLE = "`SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter`";
const payItForward = maneuverWith("Pay It Forward ⓿", PIF_CELL, { id: "pif1" });
payItForward.system.glyph = "⓿";
const reciprocal = { ...talentWith("Reciprocal Effort", "[EFFECT ALTER: Pay It Forward.limit; VALUE: round]"), id: "re1" };
const subError = (cell, context = onRowOf) => bonusError(cell, context);

/** Tess's Opportunity in round 2 of Combat c1, and the bonus Wren's Aid gave her. */
const PIF_NOW = { combat: "c1", round: 2, combatant: "cmb-tess" };
const fromWren = pendingEntry({
  result: result(1), to: { slug: "crafting", name: "Crafting" }, maneuver: { slug: "aid", name: "Aid" }, giver: { uuid: "Actor.wren", name: "Wren" },
  combat: "c1", giverCombatant: "cWren", recipientCombatant: "cmb-tess", message: "msg1"
});
const usedByTess = usedEntry(fromWren, { ...PIF_NOW, own: true }, "Actor.tess");

/** Tess, holding the used Effect (and whatever else the test names under `flags.starwrought.rules`). */
function holdingUsed(items = [payItForward], rules = {}) {
  return mover(items, { starwrought: { rules: { used: { aid: usedByTess }, ...rules } } });
}

/** The context of a use with nobody targeted, at Tess's Opportunity. */
const pifContext = (encounter = PIF_NOW) => useContext({ target: false, encounter });

check("subordinate: registered at the use and card hooks, with the SUBORDINATE tag, and it draws a Use control", () => {
  const kind = kindOf("subordinate");
  must(kind && kind.id === "subordinate", "kindOf('subordinate')");
  same([kind.aliases, Object.keys(kind.hooks)], [[], ["use", "card"]], "no aliases, two hooks");
  must(EFFECT_TAGS.subordinate === "subordinate", "the SUBORDINATE tag names the kind");
  must(CONDITIONS.includes("EFFECT") && EFFECT_STATES.join() === "used,mine", "EFFECT is a condition word, and `used` and `mine` its second words");
  must(usableByRule(payItForward), "a Maneuver with a SUBORDINATE line is used, so its row shows the Use control");
  must(!usableByRule(reciprocal), "an ALTER of a Maneuver's limit draws none");
});

check("subordinate: every accepted form on a Maneuver's row, stored whole, and its summary", () => {
  same(payItForward.system.rules, [{
    to: { name: "Aid", slug: "aid", type: "action" }, used: { name: "Aid", slug: "aid" }, limit: { per: "encounter" }, when: null,
    kind: "subordinate", line: 1, text: PIF_CELL
  }], "Pay It Forward's cell");
  const loose = giveRule("[EFFECT subordinate: AID ❶; if: effect(aid, USED); limit: Round; IF: RANK(Origin >= expert)]");
  same([loose.to, loose.used, loose.limit, loose.when], [{ name: "Aid", slug: "aid", type: "action" }, { name: "Aid", slug: "aid" }, { per: "round" }, [{ constellation: "origin", name: "Origin", op: ">=", rank: "expert" }]], "case blind, glyphs free; once a round; the owner's rank");
  const plain = giveRule("[EFFECT SUBORDINATE: Search]");
  same([plain.to, plain.used, plain.limit, plain.when], [{ name: "Search", slug: "search", type: "action" }, null, null, null], "no trigger and no LIMIT: the Maneuver is simply performed");
  same(bonusRule("[EFFECT SUBORDINATE: Aid ❶; IF: EFFECT(Aid ❶, used)]", { itemType: "action" }).used, { name: "Aid ❶", slug: "aid" }, "without a resolver: the name as written, the slug glyph-free");
  must(summarize(payItForward.system.rules[0]) === "performs Aid as part of this Maneuver, at this Maneuver's own cost, once a roll of yours at this Opportunity has used up Aid, once an encounter", `the summary: "${summarize(payItForward.system.rules[0])}"`);
  must(summarize(loose) === "performs Aid as part of this Maneuver, at this Maneuver's own cost, while Origin is at least Expert, once a roll of yours at this Opportunity has used up Aid, once a round", `with a rank: "${summarize(loose)}"`);
  must(summarize(plain) === "performs Search as part of this Maneuver, at this Maneuver's own cost", `bare: "${summarize(plain)}"`);
  same(JSON.parse(JSON.stringify(payItForward.system.rules[0])), payItForward.system.rules[0], "a stored rule equals its JSON image");
});

check("subordinate: the refusals, each by its message", () => {
  must(subError("[EFFECT SUBORDINATE: Aid]", { resolve, itemType: "talent" }) === "SUBORDINATE is written on the Maneuver's own row: it is the Maneuver that using that row performs as part of itself", "in a Talent's cell");
  must(subError("[EFFECT SUBORDINATE:]").startsWith("a subordinate Maneuver is written `SUBORDINATE: <Maneuver>`"), "no Maneuver");
  must(subError("[EFFECT SUBORDINATE: Aid, Search]") === `a subordinate Maneuver is written \`SUBORDINATE: <Maneuver>\`, as in ${PIF_EXAMPLE} (2 descriptors given, 1 wanted: the Maneuver performed; a row that performs two writes two lines, which is not read yet)`, "two Maneuvers on one line");
  must(subError("[EFFECT SUBORDINATE: Aidd]") === `"Aidd" names no Maneuver: SUBORDINATE names the Maneuver performed, as in ${PIF_EXAMPLE}`, "an unknown Maneuver");
  must(subError("[EFFECT SUBORDINATE: Stealth]") === `"Stealth" is a Constellation: SUBORDINATE names the Maneuver performed, as in ${PIF_EXAMPLE}`, "a Constellation");
  must(subError("[EFFECT SUBORDINATE: Pay It Forward]", { ...onRowOf, itemName: "Pay It Forward ⓿" }) === "Pay It Forward cannot be its own subordinate: name the Maneuver it performs", "itself");
  must(subError("[EFFECT SUBORDINATE: Aid; IF: RANK(roll = trained)]").startsWith("SUBORDINATE acts when the Maneuver is used, before any roll of its own"), "the rank rolled");
  must(subError("[EFFECT SUBORDINATE: Aid; IFT: TRAIT(Fear)]") === "SUBORDINATE does not take IFT: TRAIT(...)", "a trait");
  must(/IF\(Outcome=\.\.\.\) is only read by a kind that acts after the die/.test(subError("[EFFECT SUBORDINATE: Aid; IF: RESULT(success)]")), "a degree");
  must(subError("[EFFECT SUBORDINATE: Aid; FOR: allies 0]") === "SUBORDINATE does not take FOR", "FOR");
  must(subError("[EFFECT SUBORDINATE: Aid; IF: CLAIM(when asked)]") === "SUBORDINATE does not take IF: CLAIM(...)", "a claim");
  must(subError("[EFFECT SUBORDINATE: Aid; IFT: MARKED]") === "SUBORDINATE does not take IFT: MARKED", "a mark");
  must(subError("[EFFECT SUBORDINATE: Aid; UNTIL: encounter]") === "SUBORDINATE does not take UNTIL", "UNTIL is GIVE's");
  must(subError("[EFFECT SUBORDINATE: Aid; VALUE: free]") === "SUBORDINATE does not take VALUE", "VALUE is ALTER's");
  const ridden = parseAutomation("[AURA 15 allies; SUBORDINATE: Aid]", onRowOf);
  must((ridden.errors.length === 1) && ridden.rules.every(r => r.kind !== "subordinate"), `it cannot ride an aura's ring: ${ridden.errors.map(e => e.message).join("; ")}`);
});

check("EFFECT(<name>, used) is read under its own key by SUBORDINATE alone, and every other kind says so", () => {
  const ops = readEffectLine("SUBORDINATE: Aid; IF: EFFECT(Aid, used)", { context: { resolve } }).ops;
  same([ops.used, ops.when, ops.has], [{ name: "Aid", slug: "aid" }, null, null], "its own key, never a rank condition, never the plain form's");
  // Since 0.31.0 the plain form reads (it is the Effect a creature HAS), so SUBORDINATE refuses
  // it as a component it has no use for, by name.
  must(subError("[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid)]") === "SUBORDINATE does not take EFFECT(<name>)", "the plain form is another condition, which SUBORDINATE does not take");
  must(subError("[EFFECT SUBORDINATE: Aid; IFT: EFFECT(Aid, used)]") === "IFT: EFFECT(Aid, used) is not read: a used Effect is your own roll's, so it is written `IF: EFFECT(Aid, used)`", "a used Effect is never the other party's");
  must(subError("[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, spent)]") === '"spent": the second word is `used` (a roll of yours has just used the Effect up) or `mine` (you put it there); an Effect a creature has now is written `EFFECT(Aid)`', "another state");
  const shape = "EFFECT is written `EFFECT(<name>)`, `EFFECT(<name>, mine)` or `EFFECT(<name>, used)`, as in `IF: EFFECT(Taking Cover)`, `IFT: EFFECT(prone)`, `IFT: EFFECT(wrong-footed, mine)` or `IF: EFFECT(Aid, used)`";
  for (const [inside, why] of [["EFFECT", "bare"], ["EFFECT()", "empty"], ["EFFECT(Aid, used, twice)", "three parts"], ["EFFECT(, used)", "no name"]]) {
    must(subError(`[EFFECT SUBORDINATE: Aid; IF: ${inside}]`) === shape, `${why}: "${inside}"`);
  }
  must(subError("[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aidd, used)]") === '"Aidd" names no Maneuver: a used Effect is named for the Maneuver that gave it, as in `IF: EFFECT(Aid, used)`', "an unknown name");
  must(subError("[EFFECT SUBORDINATE: Aid; IF: EFFECT(Stealth, used)]") === '"Stealth" is a Constellation: a used Effect is named for the Maneuver that gave it, as in `IF: EFFECT(Aid, used)`', "a Constellation");
  must(subError("[EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); IF: EFFECT(Search, used)]") === "EFFECT(..., used) is given twice", "twice");
  // Every other kind refuses it by name: under its own key it can never hold by accident as a
  // rank condition would for an Untrained owner.
  const onRow = cell => parseAutomation(cell, { resolve, itemType: "effect" }).errors[0]?.message ?? "";
  for (const [cell, tag] of [["CHECK: 1 condition, aid", "CHECK"], ["DEF: 1 situation, guard", "DEF"]]) {
    must(onRow(`${cell}; IF: EFFECT(Aid, used)`) === `${tag} does not take IF: EFFECT(Aid, used): a used Effect is what a SUBORDINATE line waits for. For an Effect you have now, write \`IF: EFFECT(Aid)\``, `${tag}: a bonus line is told the form it reads`);
  }
  for (const [cell, tag] of [["IMMUNE: prone", "IMMUNE"], ["USE: Presence, Origin, aid", "USE"], ["REROLL: diplomacy; IF: RESULT(critical failure)", "REROLL"], ["MARK: enemies", "MARK"], ["IGNORE: terrain", "IGNORE"]]) {
    must(onRow(`${cell}; IF: EFFECT(Aid, used)`) === `${tag} does not take IF: EFFECT(...)`, `${tag} refuses it`);
  }
  must(giveError("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); IF: EFFECT(Aid, used)]") === "GIVE does not take IF: EFFECT(...)", "GIVE");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IF: EFFECT(Aid, used)]") === "PERMIT does not take IF: EFFECT(...)", "PERMIT");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; IF: EFFECT(Aid, used)]") === "ALTER does not take IF: EFFECT(...)", "ALTER");
  // 0.31.0: and the plain form, which a bonus line alone reads.
  must(giveError("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); IF: EFFECT(Blessed)]") === "GIVE does not take EFFECT(<name>)", "GIVE refuses the plain form");
  must(permitError("[EFFECT PERMIT: move; FOR: allies 0; IFT: EFFECT(prone)]") === "PERMIT does not take EFFECT(<name>)", "PERMIT refuses it");
  must(alterError("[EFFECT ALTER: Aid.duration; VALUE: encounter; IF: EFFECT(Blessed)]") === "ALTER does not take EFFECT(<name>)", "ALTER refuses it");
});

check("the used Effect: what leaves one, and that it is held only for the Opportunity it was left in (ruling 247)", () => {
  same(usedByTess, {
    id: "used:aid", label: "Aid from Wren (used)", maneuver: "aid", maneuverName: "Aid", by: "Actor.wren", byName: "Wren",
    value: 1, type: "situation", to: { slug: "crafting", name: "Crafting" }, from: "msg1", combat: "c1", round: 2, during: "cmb-tess"
  }, "the record: named for the result it was, who gave it, which give it was, and the Opportunity it was left in");
  must(usedEntry({ ...fromWren, message: null }, { ...PIF_NOW, own: true }, "Actor.tess").from === null, "a result with no card behind it names none");
  const own = { ...PIF_NOW, own: true };
  for (const [entry, moment, holder, why] of [
    [fromWren, { ...PIF_NOW, own: false }, "Actor.tess", "a roll on another fighter's Opportunity"],
    [fromWren, { ...PIF_NOW, combatant: null, own: true }, "Actor.tess", "nobody's Opportunity running (an Initiative)"],
    [fromWren, { combat: null, round: 0, combatant: null, own: false }, "Actor.tess", "no encounter"],
    [fromWren, null, "Actor.tess", "no moment at all"],
    [{ ...fromWren, value: -1 }, own, "Actor.tess", "a penalty the roll swallowed"],
    [fromWren, own, "Actor.wren", "a result one gave oneself"],
    [{ ...fromWren, by: "" }, own, "Actor.tess", "a result with no giver"],
    [null, own, "Actor.tess", "no result"]
  ]) must(usedEntry(entry, moment, holder) === null, `${why} leaves nothing`);

  must(usedLive(usedByTess, PIF_NOW), "held in its Opportunity");
  for (const [other, why] of [[{ ...PIF_NOW, combatant: "cmb-wren" }, "the next fighter's Opportunity"], [{ ...PIF_NOW, round: 3 }, "the next round"], [{ ...PIF_NOW, combat: "c2" }, "another Combat"], [{ ...PIF_NOW, combatant: null }, "nobody's Opportunity"], [{ combat: null, round: 0, combatant: null }, "no encounter"], [null, "nothing"]]) {
    must(!usedLive(usedByTess, other), `not held in ${why}`);
  }
  must(!usedLive(null, PIF_NOW) && !usedLive({ ...usedByTess, during: "" }, PIF_NOW), "nothing, and a record with no Opportunity: not held");

  same([isUsedKey("used:aid"), isUsedKey("given:aid"), usedFlagKey("used:aid"), usedFlagKey("aid")], [true, false, "aid", "aid"], "the key, by id or by slug");
  const tess = holdingUsed();
  same([usedOf(tess, "aid"), usedOf(tess, "search"), usedEffects(tess).map(e => e.id), usedEffects(mover())], [usedByTess, null, ["used:aid"], []], "read off the flags");

  // The one writer: the mark that removes a pending result a roll used.
  const holder = holding(fromWren);
  holder.uuid = "Actor.tess";
  const spent = [{ key: "given:aid", per: "effect" }];
  same(markUpdates(holder, spent, own), { "flags.starwrought.rules.given.-=aid": null, "flags.starwrought.rules.used.aid": usedByTess }, "used at her own Opportunity: the result goes and the used Effect is left");
  same(markUpdates(holder, spent, { ...PIF_NOW, own: false }), { "flags.starwrought.rules.given.-=aid": null }, "used off-turn: the result goes and nothing is left");
  same(markUpdates(holder, spent), { "flags.starwrought.rules.given.-=aid": null }, "with no moment handed in, as before 0.25.0");
  const swallowed = holding({ ...fromWren, value: -1 });
  swallowed.uuid = "Actor.tess";
  same(markUpdates(swallowed, spent, own), { "flags.starwrought.rules.given.-=aid": null }, "a penalty leaves nothing");
  same(markUpdates(tess, [{ key: "used:aid", per: "effect" }]), { "flags.starwrought.rules.used.-=aid": null }, "the Maneuver it triggers spends it");
  same(markUpdates(mover(), [{ key: "used:aid", per: "effect" }]), {}, "one that is not held deletes nothing");
  // One batch that leaves an Effect and spends the old one of the same Maneuver: the newer stands,
  // and Foundry is never asked to set and delete one key.
  const both = holding(fromWren);
  both.uuid = "Actor.tess";
  both.flags.starwrought.rules.used = { aid: { ...usedByTess, from: "msg0" } };
  for (const batch of [[{ key: "used:aid", per: "effect" }, ...spent], [...spent, { key: "used:aid", per: "effect" }]]) {
    same(markUpdates(both, batch, own), { "flags.starwrought.rules.given.-=aid": null, "flags.starwrought.rules.used.aid": usedByTess }, "a batch with both marks, in either order, leaves the new Effect");
  }
});

check("subordinate: used with the trigger held, it answers the Maneuver to perform and the marks to file (rulings 245, 246, 249)", () => {
  const [use] = ruleUses(holdingUsed(), payItForward, pifContext());
  same([use.refuse, use.perform, use.write, use.say, use.warn], ["", { slug: "aid", name: "Aid" }, null, "", []], "it performs Aid, writes nothing and says nothing: the subordinate's roll is the Maneuver");
  same(use.marks, [{ key: "pif1:1", per: "encounter" }, { key: "used:aid", per: "effect" }], "the LIMIT, and the used Effect it spends, for the subordinate's roll to file");

  const refusal = (actor, context = pifContext()) => { const [u] = ruleUses(actor, payItForward, context); return [u.refuse, u.perform, u.marks]; };
  const noTrigger = "Pay It Forward: no roll of Tess's at this Opportunity has used up another creature's Aid.";
  same(refusal(mover([payItForward])), [noTrigger, null, []], "no used Effect: refused (Mike: \"Refuse\")");
  same(refusal(holdingUsed(), pifContext({ ...PIF_NOW, combatant: "cmb-wren" })), [noTrigger, null, []], "one left in an Opportunity that is over");
  same(refusal(holdingUsed(), pifContext({ ...PIF_NOW, round: 3 })), [noTrigger, null, []], "nor the same fighter's next Opportunity");
  same(refusal(holdingUsed([payItForward], { encounter: { "pif1:1": { combat: "c1" } } })), ["Pay It Forward: already used this encounter.", null, []], "a second use in the encounter");
  same(refusal(holdingUsed([payItForward], { encounter: { "pif1:1": { combat: "c0" } } }))[0], "", "another encounter's use refuses nothing");

  const outside = ruleUses(mover([payItForward]), payItForward, pifContext({ combat: null, round: 0, combatant: null }))[0];
  same([outside.refuse, outside.perform, outside.marks, outside.say], ["", { slug: "aid", name: "Aid" }, [], "Aid is made as part of Pay It Forward. Outside an encounter nothing is counted."], "outside an encounter it is performed, and nothing is asked or counted");
  const bystander = mover([payItForward]);
  bystander.inEncounter = false;
  same(ruleUses(bystander, payItForward, pifContext())[0].refuse, "", "nor in a Combat the owner is no part of");

  const ranked = maneuverWith("Seasoned Hand ⓿", "[EFFECT SUBORDINATE: Aid; IF: RANK(Origin >= expert)]", { id: "sh1" });
  same(ruleUses(mover([ranked]), ranked, pifContext()).map(u => [u.refuse, u.perform]), [["Seasoned Hand performs Aid only while Origin is at least Expert.", null]], "a rank the owner has not reached is refused, saying so, never a plain use that pays for nothing");
  same(ruleUses(rulesActor([ranked], { origin: "expert" }), ranked, pifContext()).map(u => [u.refuse, u.perform]), [["", { slug: "aid", name: "Aid" }]], "and at the rank it is performed");
  const drill = maneuverWith("Drill ❶", "[EFFECT SUBORDINATE: Search; LIMIT: round]", { id: "dr1" });
  const [drilled] = ruleUses(mover([drill]), drill, pifContext());
  same([drilled.refuse, drilled.perform, drilled.marks], ["", { slug: "search", name: "Search" }, [{ key: "dr1:1", per: "round" }]], "a row with no trigger is performed on its limit alone");
  const free = maneuverWith("Look Again ❶", "[EFFECT SUBORDINATE: Search]", { id: "la1" });
  same(ruleUses(mover([free]), free, pifContext())[0].marks, [], "and one with neither files nothing");
});

check("alter: the limit property replaces a Maneuver's LIMIT and never adds a use (ruling 250)", () => {
  const text = "[EFFECT ALTER: Pay It Forward.limit; VALUE: round]";
  same(reciprocal.system.rules, [{
    to: { name: "Pay It Forward", slug: "pay-it-forward", type: "action" }, property: "limit", nothing: false, until: null, per: "round", when: null,
    kind: "alter", line: 1, text
  }], "Reciprocal Effort's cell");
  must(!("per" in patient.system.rules[0]) && !("per" in footwork.system.rules[0]), "an alteration of any other property keeps the shape it had");
  must(summarize(reciprocal.system.rules[0]) === "Pay It Forward may be used once a round, in place of its own limit", `the summary: "${summarize(reciprocal.system.rules[0])}"`);
  must(summarize(bonusRule("[EFFECT ALTER: Move Together.limit; VALUE: Encounter]", { resolve, itemType: "talent" })) === "Move Together may be used once an encounter, in place of its own limit", "the other value, case blind");
  must(alterError("[EFFECT ALTER: Pay It Forward.limit; VALUE: owner round]") === '"owner round": a Maneuver\'s limit is changed to `round` or `encounter`, as in `ALTER: Pay It Forward.limit; VALUE: round`; write `VALUE: round` (a limit is always its owner\'s)', "his drafted value is told the word");
  must(alterError("[EFFECT ALTER: Pay It Forward.limit; VALUE: day]") === '"day": a Maneuver\'s limit is changed to `round` or `encounter`, as in `ALTER: Pay It Forward.limit; VALUE: round`', "a value that is neither");
  same(LIMIT_VALUES, ["round", "encounter"], "the two values, which are LIMIT's own words");
  same(kindOf("alter").hooks.gives([{ rule: reciprocal.system.rules[0], item: reciprocal, from: "own" }], { maneuver: "pay-it-forward", rank: "trained" }, mover()), [], "the gives hook passes it over");

  same(alterationsOf(holdingUsed([payItForward, reciprocal]), payItForward), [{ property: "limit", movement: null, per: "round", nothing: false, until: null, label: "Reciprocal Effort", skipped: false, marks: [] }], "the owner's alteration of the used Maneuver");
  const change = (per, extra = {}) => ({ property: "limit", per, ...extra });
  same(limitOf({ limit: { per: "encounter" } }), { per: "encounter", marks: [] }, "no alteration: the row's own");
  same(limitOf({ limit: { per: "encounter" } }, [change("round")]), { per: "round", marks: [] }, "replaced");
  same(limitOf({ limit: null }, [change("round")]), { per: null, marks: [] }, "a row with no LIMIT stays unlimited: an alteration replaces, it never adds");
  same(limitOf({ limit: { per: "encounter" } }, [change("round"), change("encounter")]), { per: "encounter", marks: [] }, "of two the later stands");
  same(limitOf({ limit: { per: "encounter" } }, [change("round", { skipped: true, marks: [{ key: "s", per: "state" }] })]), { per: "encounter", marks: [{ key: "s", per: "state" }] }, "a line on Skip is left out this once and its mark handed back");
  same(limitOf({ limit: { per: "round" } }, [{ property: "movement", movement: "step" }, change("week")]), { per: "round", marks: [] }, "another property, and a value that is no limit, change nothing");

  const tess = (rules = {}) => holdingUsed([payItForward, reciprocal], rules);
  same(ruleUses(tess(), payItForward, pifContext())[0].marks, [{ key: "pif1:1", per: "round" }, { key: "used:aid", per: "effect" }], "with Reciprocal Effort the use is filed by the round");
  same(ruleUses(tess({ round: { "pif1:1": { combat: "c1", round: 2 } } }), payItForward, pifContext())[0].refuse, "Pay It Forward: already used this round.", "a second use in the round is refused");
  same(ruleUses(tess({ round: { "pif1:1": { combat: "c1", round: 1 } } }), payItForward, pifContext())[0].refuse, "", "and the next round it is used again");
  same(ruleUses(tess({ encounter: { "pif1:1": { combat: "c1" } } }), payItForward, pifContext())[0].refuse, "", "the encounter's old mark no longer holds it: the limit was replaced");
  const stateKey = ruleStateKey(reciprocal, reciprocal.system.rules[0]);
  same(ruleUses(tess({ state: { [stateKey]: "off" } }), payItForward, pifContext())[0].marks[0], { key: "pif1:1", per: "encounter" }, "switched Off on the Effects tab, the row's own limit stands");
  same(ruleUses(tess({ state: { [stateKey]: "skip" } }), payItForward, pifContext())[0].marks, [{ key: "pif1:1", per: "encounter" }, { key: "used:aid", per: "effect" }, { key: stateKey, per: "state" }], "on Skip it is left out this once, and the use that counted clears the Skip");

  // The same property on Move Together: PERMIT reads the limit that stands.
  const paired = { ...talentWith("Tireless Pair", "[EFFECT ALTER: Move Together.limit; VALUE: encounter]"), id: "tp1" };
  same(ruleUses(mover([moveTogether, paired]), moveTogether, useContext())[0].marks, [{ key: "mt1:1", per: "encounter" }], "PERMIT files the altered limit");
  const spentRound = { starwrought: { rules: { round: { "mt1:1": { combat: "c1", round: 2 } } } } };
  same(ruleUses(mover([moveTogether, paired], spentRound), moveTogether, useContext())[0].refuse, "", "and tests the altered limit, not the row's");

  same([limitKey({ id: "x1" }, { line: 3 }), limitKey({ name: "Row" }, {})], ["x1:3", "Row:0"], "the key: the carrier and the line");
  const marked = { flags: { starwrought: { rules: { round: { "x1:3": { combat: "c1", round: 2 } }, encounter: { "x1:3": { combat: "c1" } } } } } };
  same([limitSpent(marked, "x1:3", "round", PIF_NOW), limitSpent(marked, "x1:3", "round", { ...PIF_NOW, round: 3 }), limitSpent(marked, "x1:3", "encounter", PIF_NOW), limitSpent(marked, "x1:3", "encounter", { ...PIF_NOW, combat: "c2" }), limitSpent(marked, "x1:3", null, PIF_NOW), limitSpent(marked, "x1:3", "round", { combat: null })],
    [true, false, true, false, false, false], "spent this round, not the next; this encounter, not another; no limit and no encounter are never spent");
});

check("subordinate: the card of the roll that used the result up offers the Maneuver, and no other card does (ruling 251)", () => {
  const aided = { label: "Aid from Wren", value: 1, type: "situation", source: "rule:given:aid:crafting", given: "aid", givenFrom: "msg1" };
  const card = (extra = {}) => ({ kind: "check", slug: "crafting", degree: "success", modifiers: [{ label: "Crafting", value: 3, type: null }, aided], ...extra });
  const offers = (actor, flags = card(), encounter = PIF_NOW) => ruleCardOffers(actor, flags, { encounter }).map(o => [o.item.id, o.label, o.action, o.icon]);
  const button = [["pif1", "Pay It Forward ⓿: Aid", "ruleUse", "fa-solid fa-people-arrows"]];
  same(offers(holdingUsed()), button, "the check that used the Aid up");
  same([offers(holdingUsed(), card({ kind: "attack" })), offers(holdingUsed(), card({ kind: "defense" }))], [button, button], "a Strike's card and a Defense roll's too");
  same(offers(holdingUsed(), card({ kind: "initiative" })), [], "no other kind of card");
  same(offers(holdingUsed(), card({ modifiers: [{ label: "Crafting", value: 3, type: null }] })), [], "a card whose roll used no result");
  same(offers(holdingUsed(), card({ modifiers: [{ ...aided, value: -1 }] })), [], "a penalty the roll swallowed");
  same(offers(holdingUsed(), card({ modifiers: [{ ...aided, given: "search" }] })), [], "another Maneuver's result");
  // The card of ANOTHER roll that used ANOTHER Aid (an earlier one, off-turn or in an Opportunity
  // gone by): the result it names is not the one the used Effect remembers.
  same(offers(holdingUsed(), card({ modifiers: [{ ...aided, givenFrom: "msg0" }] })), [], "an older card that used a different Aid offers nothing");
  const { givenFrom: _none, ...unnamed } = aided;
  same(offers(holdingUsed(), card({ modifiers: [unnamed] })), button, "a card that names no give is matched on the Maneuver alone");
  same(offers(mover([payItForward], { starwrought: { rules: { used: { aid: { ...usedByTess, from: null } } } } }), card()), button, "and so is a used Effect that names none");
  same(offers(mover([payItForward])), [], "the Effect is not held (used already, or never left)");
  same(offers(holdingUsed(), card(), { ...PIF_NOW, combatant: "cmb-wren" }), [], "the Opportunity is over: an old card offers nothing");
  same(offers(holdingUsed(), card(), { combat: null, round: 0, combatant: null }), [], "outside an encounter");
  const bystander = holdingUsed();
  bystander.inEncounter = false;
  same(offers(bystander), [], "a Combat the roller is no part of");
  same(offers(holdingUsed([payItForward], { encounter: { "pif1:1": { combat: "c1" } } })), [], "the limit is spent");
  same(offers(holdingUsed([payItForward, reciprocal], { encounter: { "pif1:1": { combat: "c1" } } })), button, "with Reciprocal Effort the encounter's mark no longer holds it");
  same(offers(holdingUsed([payItForward, reciprocal], { round: { "pif1:1": { combat: "c1", round: 2 } } })), [], "but this round's does");
  const drill = maneuverWith("Drill ❶", "[EFFECT SUBORDINATE: Search; LIMIT: round]", { id: "dr1" });
  same(offers(holdingUsed([drill])), [], "a row with no trigger is tied to no card");
  // An icon is a class list and nothing else: the render pass writes it into the button.
  const odd = registerKind({ id: "odd-offer", parse: () => ({}), summary: () => "", hooks: { card: () => [{ item: payItForward, label: "x", action: "ruleUse", icon: 'fa" onclick="x' }] } });
  try {
    const oddItem = { type: "action", id: "odd1", name: "Odd", system: { rules: [{ kind: "odd-offer", line: 1, text: "" }] } };
    same(ruleCardOffers(mover([oddItem]), card(), { encounter: PIF_NOW }).map(o => o.icon), [undefined], "an icon that is not a class list is dropped");
  } finally {
    KINDS.delete(odd.id);
  }
});

/* -------------------------------------------- */
/*  The Maneuvers tab (0.28.0)                  */
/* -------------------------------------------- */

console.log("\nThe Maneuvers tab (0.28.0)");

check("pips: a printed cost is taken apart into numbers, the Reaction mark and small words", () => {
  same(costParts("❶"), [{ pip: 1 }], "one action");
  same(costParts("⓿ to ❻"), [{ pip: 0 }, { join: "to" }, { pip: 6 }], "a range: the word is its own part");
  same(costParts("❶ or ❸"), [{ pip: 1 }, { join: "or" }, { pip: 3 }], "an either-or");
  same(costParts("❶↺"), [{ pip: 1 }, { react: true }], "a Reaction with its cost");
  same(costParts("⓿↺"), [{ pip: 0 }, { react: true }], "a Posture");
  same(costParts("❶ (⓿↺)"), [{ pip: 1 }, { join: "(" }, { pip: 0 }, { react: true }, { join: ")" }], "a cost with a Reaction half of its own");
  same(costParts("⓫⓬"), [{ pip: 11 }, { pip: 12 }], "the system's own glyphs above ten");
  same([costParts(""), costParts(null), costParts(undefined)], [[], [], []], "a passive Talent prints nothing");
  // Every shape `costGlyphs` can print comes back as the numbers it was given.
  for (const cost of ["0", "1", "2", "3", "6"]) {
    same(costParts(costGlyphs({ cost })), [{ pip: Number(cost) }], `cost ${cost}`);
    same(costParts(costGlyphs({ cost, reaction: true })), [{ pip: Number(cost) }, { react: true }], `cost ${cost} as a Reaction`);
  }
  same(costParts(costGlyphs({ cost: "1", costMax: "3", costMode: "or" })).map(p => p.pip ?? p.join), [1, "or", 3], "costGlyphs' own either-or");
  same(costParts(costGlyphs({ cost: "1", reaction: true, reactionCost: "0" })).length, 5, "costGlyphs' own Reaction half");
  for (const [n, glyph] of Object.entries(ACTION_GLYPHS)) same(costParts(glyph), [{ pip: Number(n) }], `the glyph for ${n}`);
});

check("pips: the markup is discs, an icon and small text, and nothing a cost says is trusted", () => {
  same(costPipsHtml("⓿ to ❻"), '<b class="sw-cost-pip">0</b><small class="sw-cost-join">to</small><b class="sw-cost-pip">6</b>', "a range");
  same(costPipsHtml("❶↺"), '<b class="sw-cost-pip">1</b><i class="fa-solid fa-rotate-left sw-cost-react"></i>', "a Reaction");
  same(costPipsHtml(""), "", "nothing for no cost");
  same(costPipsHtml('❶ <img src=x onerror="y">'), '<b class="sw-cost-pip">1</b><small class="sw-cost-join">&lt;img</small><small class="sw-cost-join">src=x</small><small class="sw-cost-join">onerror=&quot;y&quot;&gt;</small>', "text that is not a cost is escaped");
  must(!/[⓿❶❷❸❹❺❻↺]/.test(costPipsHtml("⓿ to ❻ (❶↺)")), "no font glyph is left for a font to size");
});

const requiresRule = (cell, context = onRowOf) => bonusRule(cell, context);
const requiresError = (cell, context = onRowOf) => bonusError(cell, context);
const anyOf = cell => requiresRule(cell).any;

check("requires: the kind is registered with no hook, read from its block on a Maneuver's own row", () => {
  const kind = kindOf("requires");
  must(kind, "the requires kind is registered");
  same(Object.keys(kind.hooks ?? {}), [], "it has no hook: the tab reads the rule off the row");
  must(!EFFECT_KINDS.includes("requires"), "it is no effect: the Effects tab has no switch for it");
  same([FEATURE_KEYWORD_LIST.includes("REQUIRES"), FEATURE_KEYWORD_LIST.at(-1)], [true, "EFFECT"], "the keyword is listed, and EFFECT stays last");
  const rule = requiresRule("[REQUIRES prone or supine]");
  same([rule.kind, rule.line, rule.text], ["requires", 1, "[REQUIRES prone or supine]"], "the stored rule");
  same(rule.any, [{ test: "condition", id: "prone" }, { test: "supine" }], "its alternatives");
  same(summarize(rule), "needs: Prone or Supine", "As read");
  same(requiresRule("[requires PRONE]").any, [{ test: "condition", id: "prone" }], "case never matters");
  must(/"REQUIRE" is not a feature keyword: write .*REQUIRES, CHECK, EFFECT/.test(requiresError("[REQUIRE prone]")), "one keyword, one spelling: the singular is told the list");
  const two = parseAutomation("[REQUIRES free hand or weapon grapple][REQUIRES foe in reach]", onRowOf);
  same([two.errors.length, two.rules.map(r => r.kind), two.rules.map(summarize)], [0, ["requires", "requires"], ["needs: a free hand or a weapon with the Grapple trait", "needs: a foe in reach"]], "two blocks on a line are two rules");
  must(/Maneuver's own row/.test(requiresError("[REQUIRES prone]", { resolve, itemType: "talent" })), "refused on a Talent");
  must(/Maneuver's own row/.test(requiresError("[REQUIRES prone]", { resolve, itemType: "effect" })), "and on a custom effect row");
  same(parseAutomation("[REQUIRES prone]", {}).errors.length, 0, "with no carrier named (the self-test, a bare parse) it reads");
  must(/is a feature and is written in brackets/.test(requiresError("requires: prone")), "typed as a line it is told the brackets");
});

check("requires: every word reads, and a word nobody knows is told the list", () => {
  same(anyOf("[REQUIRES grabbed or restrained]"), [{ test: "condition", id: "grabbed" }, { test: "condition", id: "restrained" }], "Conditions by the book's name");
  same([anyOf("[REQUIRES off-guard]"), anyOf("[REQUIRES Off Guard]"), anyOf("[REQUIRES offGuard]")].map(a => a[0].id), ["offGuard", "offGuard", "offGuard"], "a two-word Condition, however it is spaced");
  same(anyOf("[REQUIRES controlling]"), [{ test: "condition", id: "controlling" }], "the Bind's Conditions are Conditions");
  same(anyOf("[REQUIRES not prone]"), [{ test: "condition", id: "prone", not: true }], "not");
  same(anyOf("[REQUIRES bind]"), [{ test: "bind" }], "a Bind of any kind");
  same([anyOf("[REQUIRES spell]"), anyOf("[REQUIRES spells]")], [[{ test: "spell" }], [{ test: "spell" }]], "a spell");
  same([anyOf("[REQUIRES shield]"), anyOf("[REQUIRES shield raised]"), anyOf("[REQUIRES raised shield]")], [[{ test: "shield" }], [{ test: "shield", raised: true }], [{ test: "shield", raised: true }]], "a shield, and one Raised");
  same([anyOf("[REQUIRES rigid]"), anyOf("[REQUIRES free hand]"), anyOf("[REQUIRES holding]"), anyOf("[REQUIRES encounter]")].map(a => a[0].test), ["rigid", "freeHand", "holding", "encounter"], "the single words");
  same([anyOf("[REQUIRES weapon]"), anyOf("[REQUIRES melee weapon]"), anyOf("[REQUIRES ranged weapon]"), anyOf("[REQUIRES weapon reload]"), anyOf("[REQUIRES melee weapon trip]")],
    [[{ test: "weapon" }], [{ test: "weapon", reach: "melee" }], [{ test: "weapon", reach: "ranged" }], [{ test: "weapon", trait: "reload" }], [{ test: "weapon", reach: "melee", trait: "trip" }]], "a weapon in hand, by reach and by trait");
  same([anyOf("[REQUIRES foe adjacent]"), anyOf("[REQUIRES foe in reach]"), anyOf("[REQUIRES ally within 30]"), anyOf("[REQUIRES creature within 15 ft]"), anyOf("[REQUIRES enemies within 30ft]"), anyOf("[REQUIRES allies adjacent]")],
    [[{ test: "near", who: "enemy", range: 0 }], [{ test: "near", who: "enemy", range: "reach" }], [{ test: "near", who: "ally", range: 30 }], [{ test: "near", who: "any", range: 15 }], [{ test: "near", who: "enemy", range: 30 }], [{ test: "near", who: "ally", range: 0 }]], "who is near, and how near");
  same(anyOf("[REQUIRES not foe adjacent]"), [{ test: "near", who: "enemy", range: 0, not: true }], "nobody near");
  same(anyOf("[REQUIRES prone.]"), [{ test: "condition", id: "prone" }], "one trailing period is tolerated");

  must(/is not something REQUIRES can check: write a Condition \(.*prone.*\), supine, bind, spell, shield/.test(requiresError("[REQUIRES flying]")), "an unknown word is told the list");
  must(/say how near/.test(requiresError("[REQUIRES foe]")), "a creature with no distance");
  must(/say how near/.test(requiresError("[REQUIRES ally nearby]")), "or a distance that is none");
  must(/second block/.test(requiresError("[REQUIRES prone, supine]")), "a comma is told `or` and the second block");
  must(/no `and`/.test(requiresError("[REQUIRES free hand and foe in reach]")), "an `and` is told the second block");
  must(/one `not` is enough/.test(requiresError("[REQUIRES not not prone]")), "a doubled not");
  must(/has nothing beside it/.test(requiresError("[REQUIRES prone or ]")), "an `or` with nothing after it");
  must(/REQUIRES is written/.test(requiresError("[REQUIRES]")), "an empty block");
  same(bonusError("[EFFECT REQUIRES: prone]", onRowOf), "REQUIRES is a block of its own, not an effect: write `[REQUIRES prone]`", "wrapped in EFFECT it is told its own block");
  same(bonusError("[EFFECT TRAIT Human]", onRowOf), "TRAIT is a block of its own, not an effect: write `[TRAIT Human]`", "and so is every other feature keyword");
  // Exposed-by-Zone statuses are mirrors of a Zone and never a Condition a cell names.
  must(/is not something REQUIRES can check/.test(requiresError("[REQUIRES exposedHead]")), "a Zone's mirror status is no Condition here");
});

check("requires: the words in English, for the tab's tooltip and the sheet's As read list", () => {
  const words = cell => requireWords(requiresRule(cell));
  same([words("[REQUIRES prone or supine]"), words("[REQUIRES not prone]"), words("[REQUIRES off-guard]")], ["Prone or Supine", "not Prone", "Off-Guard"], "Conditions");
  same([words("[REQUIRES bind]"), words("[REQUIRES not bind]"), words("[REQUIRES spell]"), words("[REQUIRES not spell]")], ["in a Bind", "not in a Bind", "a spell", "no spell"], "a Bind and a spell");
  same([words("[REQUIRES shield]"), words("[REQUIRES shield raised]"), words("[REQUIRES rigid]"), words("[REQUIRES free hand]"), words("[REQUIRES holding]"), words("[REQUIRES not holding]")],
    ["a shield in hand", "a Raised shield", "a rigid implement in hand", "a free hand", "something in hand", "nothing in hand"], "what is in hand");
  same([words("[REQUIRES weapon]"), words("[REQUIRES ranged weapon]"), words("[REQUIRES weapon reload]")], ["a weapon in hand", "a ranged weapon in hand", "a weapon with the Reload trait"], "weapons");
  same([words("[REQUIRES foe adjacent]"), words("[REQUIRES ally in reach]"), words("[REQUIRES creature within 30]"), words("[REQUIRES not foe adjacent]"), words("[REQUIRES encounter]")],
    ["an adjacent foe", "an ally in reach", "a creature within 30 ft", "no adjacent foe", "an encounter"], "who is near");
  same(termWords({ test: "nonsense" }), "", "a term nobody knows says nothing");
});

check("requires: sight alone, and a weapon loaded or to reload (0.29.0)", () => {
  // In sight: the character can see such a token, at any distance.
  same([anyOf("[REQUIRES foe in sight]"), anyOf("[REQUIRES ally in sight]"), anyOf("[REQUIRES creature in sight]"), anyOf("[REQUIRES not foe in sight]")],
    [[{ test: "near", who: "enemy", range: "sight" }], [{ test: "near", who: "ally", range: "sight" }], [{ test: "near", who: "any", range: "sight" }], [{ test: "near", who: "enemy", range: "sight", not: true }]], "who is in sight");
  const words = cell => requireWords(requiresRule(cell));
  same([words("[REQUIRES foe in sight]"), words("[REQUIRES ally in sight]"), words("[REQUIRES not creature in sight]")], ["a foe in sight", "an ally in sight", "no creature in sight"], "said in English");
  must(/`foe in sight`/.test(requiresError("[REQUIRES foe]")), "the distance message names the word");
  const seen = (relation, gap) => ({ relation, gap, inReach: false });
  const at = (cell, near) => checkCondition(anyOf(cell)[0], { near });
  same([at("[REQUIRES foe in sight]", [seen("enemy", 400)]), at("[REQUIRES foe in sight]", [seen("ally", 2)]), at("[REQUIRES foe in sight]", []), at("[REQUIRES foe in sight]", null), at("[REQUIRES not foe in sight]", null)],
    [true, false, false, null, null], "a foe seen at any distance; an ally is no foe; nobody seen is known; no token on the map is not");
  same([at("[REQUIRES ally in sight]", [seen("ally", 90)]), at("[REQUIRES creature in sight]", [seen("neutral", 90)]), at("[REQUIRES ally in sight]", [seen("neutral", 90)])], [true, true, false], "an ally, and a creature of any kind");

  // Loaded and unloaded are states of the weapon in hand, read before the trait reading.
  same([anyOf("[REQUIRES weapon loaded]"), anyOf("[REQUIRES ranged weapon loaded]"), anyOf("[REQUIRES weapon unloaded]"), anyOf("[REQUIRES not ranged weapon loaded]")],
    [[{ test: "weapon", state: "loaded" }], [{ test: "weapon", reach: "ranged", state: "loaded" }], [{ test: "weapon", state: "unloaded" }], [{ test: "weapon", reach: "ranged", state: "loaded", not: true }]], "the two states, never a trait called loaded");
  same([words("[REQUIRES ranged weapon loaded]"), words("[REQUIRES weapon loaded]"), words("[REQUIRES weapon unloaded]"), words("[REQUIRES not ranged weapon loaded]")],
    ["a loaded ranged weapon in hand", "a loaded weapon in hand", "a weapon in hand to reload", "no loaded ranged weapon in hand"], "said in English");
  const bow = (extra = {}) => ({ reach: "ranged", traits: ["ranged", "reload"], takesAmmunition: true, loaded: true, full: true, ...extra });
  const bolas = { reach: "ranged", traits: ["ranged", "nonlethal", "trip"], takesAmmunition: false, loaded: true, full: true };
  const sword = { reach: "melee", traits: ["versatile"], takesAmmunition: false, loaded: true, full: true };
  const fist = { reach: "melee", traits: ["agile", "close", "finesse", "nonlethal"], natural: true, takesAmmunition: false, loaded: true, full: true };
  const with_ = (cell, weapons) => checkCondition(anyOf(cell)[0], { weapons });
  same([with_("[REQUIRES ranged weapon loaded]", [bow()]), with_("[REQUIRES ranged weapon loaded]", [bow({ loaded: false, full: false })]), with_("[REQUIRES ranged weapon loaded]", [bolas]), with_("[REQUIRES ranged weapon loaded]", [sword]), with_("[REQUIRES ranged weapon loaded]", []), with_("[REQUIRES ranged weapon loaded]", undefined)],
    [true, false, true, false, false, null], "a bow with a shot; an empty one; one that needs no loading; a sword is no ranged weapon; empty hands; not known");
  same([with_("[REQUIRES weapon unloaded]", [bow()]), with_("[REQUIRES weapon unloaded]", [bow({ loaded: false, full: false })]), with_("[REQUIRES weapon unloaded]", [bow({ loaded: true, full: false })]), with_("[REQUIRES weapon unloaded]", [bolas, sword])],
    [false, true, true, false], "to reload: empty, or a Capacity weapon part spent; never a full one, never one that takes no ammunition");
  // The bare fist is in every hand since 0.29.0: it is no "weapon in hand", and a trait still asks it.
  same([with_("[REQUIRES weapon]", [fist]), with_("[REQUIRES melee weapon]", [fist]), with_("[REQUIRES weapon loaded]", [fist]), with_("[REQUIRES weapon]", [fist, sword]), with_("[REQUIRES weapon finesse]", [fist])],
    [false, false, false, true, true], "the fist is no weapon in hand, loaded or otherwise; a trait is asked of it as of anything");
  // Strike's cell, as printed for the sheet.
  const strike = parseAutomation("[REQUIRES foe in reach or ranged weapon loaded or weapon thrown]\n[REQUIRES foe in sight]\n[REQUIRES not restrained]\n[REQUIRES not unconscious]", onRowOf);
  same([strike.errors.length, strike.rules.map(summarize)], [0, ["needs: a foe in reach or a loaded ranged weapon in hand or a weapon with the Thrown trait", "needs: a foe in sight", "needs: not Restrained", "needs: not Unconscious"]], "Strike's four blocks read");
  const strikes = extra => availability(strike.rules, { conditions: [], weapons: [fist], near: [], ...extra }).ok;
  same([strikes({ near: [{ relation: "enemy", gap: 1, inReach: true }] }), strikes({ near: [{ relation: "enemy", gap: 40, inReach: false }] }), strikes({ weapons: [fist, bow()], near: [{ relation: "enemy", gap: 40, inReach: false }] }), strikes({ weapons: [fist, bow({ loaded: false, full: false })], near: [{ relation: "enemy", gap: 40, inReach: false }] }), strikes({ weapons: [fist, bow()], near: [] }), strikes({ near: [{ relation: "enemy", gap: 1, inReach: true }], conditions: ["restrained"] })],
    [true, false, true, false, false, false], "a foe in reach; out of reach with only fists; out of reach with a loaded bow; with an empty bow; nobody in sight; Restrained");
});

check("0.31.0: the Effects list is a creature's Conditions and every other active effect by name (ruling 305)", () => {
  const list = effectList({
    statuses: ["prone", "fatigued", "bound"],
    conditionValue: id => (id === "fatigued" ? 2 : 1),
    effects: [
      { name: "Blessed" }, { name: "Taking  Cover" }, { name: "Cursed", disabled: true }, { name: "Dormant", suppressed: true },
      { name: "Fatigued 2", statuses: ["fatigued"] }, { name: "Bind: Bandit's sword", statuses: ["bound"] },
      { name: "Net", statuses: ["prone", "restrained"] }, { name: "Prone" }, { name: "" },
      { name: "Shaken", applied: { by: "Actor.a", slug: "shaken" } }
    ],
    rows: [{ label: "Rage" }, { label: "Blessed" }, { label: "" }]
  });
  same([...list.conditions], [["prone", 1], ["fatigued", 2], ["bound", 1]], "Conditions are the statuses, each with its value");
  same([...effectList({ statuses: ["prone"] }).conditions], [["prone", 1]], "with no reader of values every Condition counts 1 (an option named `valueOf` would have found Object's own)");
  same([...list.names.keys()], ["blessed", "taking-cover", "net", "shaken", "rage"], "names: every other active effect by its slug, then the custom rows; a disabled or suppressed one, a Condition's own effect and an effect merely called Prone give none");
  same([list.names.get("shaken").applied, list.names.get("blessed").applied, list.names.get("rage").row], [{ by: "Actor.a", slug: "shaken" }, null, true], "an applied Effect keeps its record; a row says it is one; the first of a name stands");
  same([effectSlug("Taking Cover"), effectSlug("  taking   cover "), effectSlug("Hunter's Mark"), effectSlug("")], ["taking-cover", "taking-cover", "hunter-s-mark", ""], "the slug a name is matched by");
  same([conditionTitle("prone"), conditionTitle("offGuard"), conditionTitle("wrongFooted")], ["Prone", "Off-Guard", "Wrong-Footed"], "a Condition's printed name");

  // A name as a cell writes it: a Condition first, else a named Effect.
  same(readEffectName("Prone"), { name: "Prone", slug: "prone", condition: "prone" }, "a Condition by its name");
  same([readEffectName("off guard").condition, readEffectName("Off-Guard").condition, readEffectName("offGuard").condition], ["offGuard", "offGuard", "offGuard"], "however it is spaced");
  same(readEffectName(" Taking  Cover "), { name: "Taking Cover", slug: "taking-cover", condition: null }, "anything else is a named Effect, in its own casing");
  const refused = name => { try { readEffectName(name); return ""; } catch (error) { return error.message; } };
  must(/Exposed Zone/.test(refused("exposed head")) && /Exposed Zone/.test(refused("Exposed")), "an Exposed Zone is the Zone's own");
  must(["or", "and", "self", "target", "mine", "used", "with", "NA", "n/a", "None", "-", "--"].every(w => /cannot be an Effect's name/.test(refused(w))), "a word that means something else is no name");
  // The review of 0.31.0: `not` is never part of a name, a Condition's value is not compared, and
  // an Exposed Zone is refused however it is spaced.
  must(["not", "not Blessed", "Not prone"].every(w => /`not` goes in front of the whole condition/.test(refused(w))), "`not` begins no name: it would read as an Effect nobody has");
  must(/a Condition's value is not compared yet; write `fatigued`/.test(refused("Fatigued 2")) && /write `frightened`/.test(refused("frightened 3")), "a Condition with a number is told the value is not compared");
  same(refused("Cover 2"), "", "a number after a name that is no Condition is part of the name");
  must(["exposedHead", "Exposed-Head", "exposed  torso"].every(w => /Exposed Zone/.test(refused(w))), "an Exposed Zone, however it is spaced");
  must(/joins conditions/.test(refused("Rock or Roll")) && /joins conditions/.test(refused("Salt and Pepper")), "nor is a name that holds `or` or `and` as a word");
  must(/letters, digits, spaces, hyphens and apostrophes/.test(refused("A, B")) && /letters, digits/.test(refused("Cover (Greater)")) && /letters, digits/.test(refused("-Cover")), "a name is letters, digits, spaces, hyphens and apostrophes");
  must(/has a name/.test(refused("")) && /has a name/.test(refused("   ")), "and it is never empty");
  same([refused("Hunter's Mark"), refused("Half-Cover 2")], ["", ""], "an apostrophe, a hyphen and a digit are fine");

  // Reading a list.
  same([listHas(list, readEffectName("blessed")), listHas(list, readEffectName("Cursed")), listHas(list, readEffectName("prone")), listHas(list, readEffectName("grabbed")), listHas(null, readEffectName("prone")), listHas(list, null)],
    [true, false, true, false, null, null], "a name on the list; one that is not; a Condition on it and off it; no list, and no name, cannot be told");
  same(namedEffects(list).map(e => e.name), ["Blessed", "Net", "Rage", "Shaken", "Taking Cover"], "for a screen: the names in order, their spacing tidied");
  same(namedEffects(null), [], "no list, no names");

  // One reading for the list and the sheet's tag (the review of 0.31.0): only a name a line could
  // write is on the list, so `EFFECT(Blessed)` never matches an effect its tag calls unreadable.
  same([namedEffectOf("Blessed"), namedEffectOf("Taking  Cover ❶"), namedEffectOf("Blessed!"), namedEffectOf("Cover, Greater"), namedEffectOf("Blessed (2 rounds)"), namedEffectOf("Prone"), namedEffectOf("not Blessed"), namedEffectOf("")],
    [{ name: "Blessed", slug: "blessed" }, { name: "Taking Cover", slug: "taking-cover" }, null, null, null, null, null, null], "a name a cell could write, glyphs out; punctuation, a Condition's name, `not` and nothing give none");
  const odd = effectList({ effects: [{ name: "Blessed!" }, { name: "Cover, Greater" }, { name: "Hunter's Mark" }], rows: [{ label: "Rage (1/day)" }] });
  same([...odd.names.keys()], ["hunter-s-mark"], "an effect named with punctuation is on no list");
  same([listHas(odd, readEffectName("Blessed")), listHas(odd, readEffectName("Hunter's Mark"))], [false, true], "so a rule does not match it, and matches the one it can write");

  // From an Actor: `appliedEffects` where it has one (an Item's transferred effect counts, a
  // disabled one is gone already), else `effects`; the applied record from the flag.
  const actor = {
    statuses: new Set(["dying"]),
    conditionValue: id => (id === "dying" ? 3 : 0),
    appliedEffects: [{ name: "Blessed", flags: { starwrought: { applied: { by: "Actor.b" } } } }, { name: "Dying 3", statuses: new Set(["dying"]) }],
    effects: [{ name: "Never read" }],
    system: { effects: [{ label: "Rage" }] }
  };
  const mine = effectsOn(actor);
  same([[...mine.conditions], [...mine.names.keys()], mine.names.get("blessed").applied], [[["dying", 3]], ["blessed", "rage"], { by: "Actor.b" }], "an Actor's list");
  same([...effectsOn({ statuses: [], effects: [{ name: "Hexed" }, { name: "Asleep", disabled: true }, { name: "Held", isSuppressed: true }] }).names.keys()], ["hexed"], "with no `appliedEffects` the effects are read, less the disabled and the suppressed");
  same(effectsOn(null), null, "no creature, no list");
  same([...effectsOn({}).conditions, ...effectsOn({}).names], [], "a creature with nothing on it has an empty list, which is known");
});

check("0.31.0: REQUIRES reads a named Effect, a Bind's state, and what a nearby creature has (ruling 306)", () => {
  const words = cell => requireWords(requiresRule(cell));
  // effect <Name>
  same(anyOf("[REQUIRES effect Taking Cover]"), [{ test: "effect", slug: "taking-cover", name: "Taking Cover" }], "a named Effect, in its own casing");
  same([anyOf("[REQUIRES EFFECT taking cover]")[0].slug, anyOf("[REQUIRES effects Taking Cover]")[0].slug], ["taking-cover", "taking-cover"], "the word in any case, and its plural");
  same(anyOf("[REQUIRES not effect Taking Cover]"), [{ test: "effect", slug: "taking-cover", name: "Taking Cover", not: true }], "not");
  same(anyOf("[REQUIRES effect prone]"), [{ test: "condition", id: "prone" }], "a Condition's name is reserved: `effect prone` is the Condition");
  same(anyOf("[REQUIRES effect Blessed or prone]"), [{ test: "effect", slug: "blessed", name: "Blessed" }, { test: "condition", id: "prone" }], "beside another alternative");
  same([words("[REQUIRES effect Taking Cover]"), words("[REQUIRES not effect Taking Cover]")], ["Taking Cover", "not Taking Cover"], "said in English");
  must(/name the Effect/.test(requiresError("[REQUIRES effect]")), "the word alone is told to name one");
  must(/Exposed Zone/.test(requiresError("[REQUIRES effect exposed head]")), "an Exposed Zone is no Effect");
  must(/is not something REQUIRES can check/.test(requiresError("[REQUIRES Taking Cover]")), "a bare name that is no Condition is still an error, so a typo shows");
  must(/is not something REQUIRES can check/.test(requiresError("[REQUIRES prnoe]")), "and so is a mistyped Condition");
  const having = (cell, effects) => checkCondition(anyOf(cell)[0], effects === undefined ? {} : { effects });
  same([having("[REQUIRES effect Blessed]", ["blessed"]), having("[REQUIRES effect Blessed]", new Set(["blessed"])), having("[REQUIRES effect Blessed]", []), having("[REQUIRES effect Blessed]", undefined), having("[REQUIRES not effect Blessed]", []), having("[REQUIRES not effect Blessed]", undefined)],
    [true, true, false, null, true, null], "held; not held; not known, and `not` of not known");

  // bind, <state>
  same(BIND_STATES, ["neutral", "controlling", "controlled"], "the three states");
  same([anyOf("[REQUIRES bind, neutral]"), anyOf("[REQUIRES bind neutral]"), anyOf("[REQUIRES Bind,controlling]"), anyOf("[REQUIRES not bind, controlled]")],
    [[{ test: "bind", state: "neutral" }], [{ test: "bind", state: "neutral" }], [{ test: "bind", state: "controlling" }], [{ test: "bind", state: "controlled", not: true }]], "Mike's `bind, neutral`, with the comma or without");
  same(anyOf("[REQUIRES bind, controlling or bind, neutral]"), [{ test: "bind", state: "controlling" }, { test: "bind", state: "neutral" }], "two states in one block");
  same(anyOf("[REQUIRES bind]"), [{ test: "bind" }], "`bind` alone is still any Bind");
  must(/a Bind's state is neutral, controlling, controlled/.test(requiresError("[REQUIRES bind, prone]")), "a state that is none");
  // The review of 0.31.0: the comma is read only where `bind` begins an alternative, and `not`
  // is never swallowed into an Effect's name.
  same(anyOf("[REQUIRES prone or not bind, controlled]"), [{ test: "condition", id: "prone" }, { test: "bind", state: "controlled", not: true }], "after `or` and after `not`");
  must(/second block/.test(requiresError("[REQUIRES effect Spirit Bind, prone]")) && /second block/.test(requiresError("[REQUIRES effect Hold-bind, neutral]")), "an Effect whose name ends in bind keeps its comma's refusal");
  must(/`not` goes in front of the whole condition/.test(requiresError("[REQUIRES effect not Blessed]")), "`effect not Blessed` is told where the `not` goes");
  same(anyOf("[REQUIRES effect Hunter's Mark]")[0].slug, "hunter-s-mark", "an apostrophe in a name");
  must(/a Condition's value is not compared yet/.test(requiresError("[REQUIRES effect Fatigued 2]")) && /a Condition's value is not compared yet/.test(requiresError("[REQUIRES creature adjacent with effect frightened 2]")), "a Condition's value is not compared, here either");
  must(/second block/.test(requiresError("[REQUIRES prone, supine]")) && /second block/.test(requiresError("[REQUIRES bind, neutral, prone]")), "every other comma keeps its message");
  same([words("[REQUIRES bind, neutral]"), words("[REQUIRES not bind, neutral]"), words("[REQUIRES bind, controlling]"), words("[REQUIRES bind, controlled]")],
    ["in a neutral Bind", "not in a neutral Bind", "Controlling a weapon in a Bind", "Controlled in a Bind"], "said in English");
  const bound = (cell, bind) => checkCondition(anyOf(cell)[0], bind === undefined ? {} : { bind });
  same([bound("[REQUIRES bind, neutral]", "neutral"), bound("[REQUIRES bind, neutral]", "controlling"), bound("[REQUIRES bind, neutral]", null), bound("[REQUIRES bind, neutral]", undefined), bound("[REQUIRES not bind, controlled]", "neutral"), bound("[REQUIRES bind]", "controlled")],
    [true, false, false, null, true, true], "the state asked for; another; no Bind; not known; not; any Bind");

  // ... with <Condition> | effect <Name>
  same(anyOf("[REQUIRES creature adjacent with dying]"), [{ test: "near", who: "any", range: 0, with: { condition: "dying" } }], "Stabilize: an adjacent creature that is Dying");
  same(anyOf("[REQUIRES foe in reach with effect Marked]"), [{ test: "near", who: "enemy", range: "reach", with: { slug: "marked", name: "Marked" } }], "a foe in reach with a named Effect");
  same([anyOf("[REQUIRES ally within 30 with off-guard]")[0], anyOf("[REQUIRES foe in sight with effect prone]")[0], anyOf("[REQUIRES foe within 30 ft with frightened]")[0]],
    [{ test: "near", who: "ally", range: 30, with: { condition: "offGuard" } }, { test: "near", who: "enemy", range: "sight", with: { condition: "prone" } }, { test: "near", who: "enemy", range: 30, with: { condition: "frightened" } }], "after any distance; `within` is never read as `with`");
  same(anyOf("[REQUIRES not foe adjacent with effect Dances with Wolves]"), [{ test: "near", who: "enemy", range: 0, with: { slug: "dances-with-wolves", name: "Dances with Wolves" }, not: true }], "a name that itself holds `with`");
  must(/after `with` write a Condition/.test(requiresError("[REQUIRES creature adjacent with nonsense]")), "what follows `with` is a Condition or `effect <Name>`");
  must(/say how near/.test(requiresError("[REQUIRES foe with prone]")), "and the distance is still asked for");
  same([words("[REQUIRES creature adjacent with dying]"), words("[REQUIRES foe in reach with effect Marked]"), words("[REQUIRES not ally within 30 with prone]")],
    ["an adjacent creature that is Dying", "a foe in reach with Marked", "no ally within 30 ft that is Prone"], "said in English");
  const seen = (relation, gap, extra = {}) => ({ relation, gap, inReach: gap <= 3, ...extra });
  const at = (cell, near) => checkCondition(anyOf(cell)[0], { near });
  const stabilize = "[REQUIRES creature adjacent with dying]";
  same([at(stabilize, [seen("ally", 0, { conditions: ["dying"], effects: [] })]), at(stabilize, [seen("ally", 0, { conditions: ["prone"], effects: [] })]), at(stabilize, [seen("ally", 20, { conditions: ["dying"], effects: [] })]), at(stabilize, []), at(stabilize, null)],
    [true, false, false, false, null], "the adjacent creature is Dying; it is not; the Dying one is too far; nobody near; no token on the map");
  same([at(stabilize, [seen("ally", 0)]), at(stabilize, [seen("ally", 0), seen("enemy", 0, { conditions: ["dying"], effects: [] })]), at("[REQUIRES not creature adjacent with dying]", [seen("ally", 0)])],
    [null, true, null], "a creature whose Effects were not given cannot be told, and is no `no`; one that is known Dying settles it");
  same([at("[REQUIRES foe in reach with effect Marked]", [seen("enemy", 2, { conditions: [], effects: ["marked"] })]), at("[REQUIRES foe in reach with effect Marked]", [seen("ally", 2, { conditions: [], effects: ["marked"] })]), at("[REQUIRES foe in reach with effect Marked]", [seen("enemy", 2, { conditions: [], effects: [] })])],
    [true, false, false], "a named Effect on a foe; on an ally it is no foe's; a foe without it");
  // A whole row: Stabilize's two blocks.
  const row = parseAutomation("[REQUIRES creature adjacent with dying]\n[REQUIRES not effect Shaken]", onRowOf);
  same([row.errors.length, row.rules.map(summarize)], [0, ["needs: an adjacent creature that is Dying", "needs: not Shaken"]], "the blocks read");
  same([availability(row.rules, { effects: [], near: [seen("ally", 0, { conditions: ["dying"], effects: [] })] }).ok, availability(row.rules, { effects: ["shaken"], near: [seen("ally", 0, { conditions: ["dying"], effects: [] })] }).ok],
    [true, false], "and hold or fail together");
});

check("loaded: what a ranged weapon holds, from its Reload and Capacity traits (rulings 290 to 292)", () => {
  const ammo = (traits, loaded) => ammunitionOf(parseWeaponTraits(splitTraits(traits)), loaded);
  // The book's ranged weapons, by their Trait lines.
  same(ammo("Ranged 120, Reload 1, Two-Handed, Unwieldy 10"), { takes: true, magazine: 1, shots: 1, loaded: true, full: true, reload: 1 }, "a Shortbow never written to reads as loaded");
  same(ammo("Ranged 120, Reload 1, Two-Handed, Unwieldy 10", 0), { takes: true, magazine: 1, shots: 0, loaded: false, full: false, reload: 1 }, "and empty once it has shot");
  same([ammo("Ranged 100, Mechanical, Reload 2, Two-Handed").reload, ammo("Ranged 140, Mechanical, Reload 3, Armor-Piercing 1, Two-Handed").reload, ammo("Ranged 60, Reload 1").reload], [2, 3, 1], "the Reload Maneuver's cost is the weapon's own Reload");
  same(ammo("Ranged 80, Mechanical, Capacity 5, Reload 3, Two-Handed"), { takes: true, magazine: 5, shots: 5, loaded: true, full: true, reload: 3 }, "a Repeating Crossbow holds five");
  same(ammo("Ranged 80, Mechanical, Capacity 5, Reload 3, Two-Handed", 3), { takes: true, magazine: 5, shots: 3, loaded: true, full: false, reload: 3 }, "three of five: loaded, and not full");
  same([ammo("Ranged 80, Capacity 5, Reload 3", 9).shots, ammo("Ranged 80, Capacity 5, Reload 3", -2).shots, ammo("Ranged 80, Capacity 5, Reload 3", 2.9).shots, ammo("Ranged 80, Capacity 5, Reload 3", "x").shots], [5, 0, 2, 5], "a count out of range is held to the magazine; nonsense reads as full");
  // What takes none.
  const none = { takes: false, magazine: 0, shots: 0, loaded: true, full: true, reload: 0 };
  same([ammo("Ranged 30, Nonlethal, Trip"), ammo("Agile, Close, Finesse, Thrown 10 ft"), ammo("Versatile P"), ammo("Reload 1"), ammunitionOf(null), ammunitionOf(undefined, 0)], [none, none, none, none, none, none], "Bolas, a thrown dagger, a sword, a Reload on a weapon that is not ranged, and no weapon at all take none and are always ready");
});

check("loaded: a Strike uses a shot in an encounter, warns when empty, and never refuses (rulings 290 and 291)", () => {
  const bow = shots => ({ takes: true, magazine: 1, shots, loaded: shots > 0, full: shots >= 1, reload: 1 });
  const repeater = shots => ({ takes: true, magazine: 5, shots, loaded: shots > 0, full: shots >= 5, reload: 3 });
  const sword = { takes: false, magazine: 0, shots: 0, loaded: true, full: true, reload: 0 };
  const fight = { inEncounter: true };
  same(shotPlan(bow(1), fight), { uses: true, left: 0, warn: false }, "a loaded bow in an encounter: the shot goes");
  same(shotPlan(bow(0), fight), { uses: false, left: 0, warn: true }, "an empty bow: the Strike still happens, and is warned about");
  same(shotPlan(bow(1), { inEncounter: false }), { uses: false, left: 1, warn: false }, "outside an encounter nothing is counted");
  same(shotPlan(bow(0), { inEncounter: false }), { uses: false, left: 0, warn: true }, "but an empty weapon is said to be empty anywhere");
  same([shotPlan(repeater(5), fight), shotPlan(repeater(1), fight)], [{ uses: true, left: 4, warn: false }, { uses: true, left: 0, warn: false }], "a Repeating Crossbow counts down");
  same([shotPlan(sword, fight), shotPlan(bow(0), { inEncounter: true, thrown: true }), shotPlan(null, fight), shotPlan(undefined)], [{ uses: false, left: 0, warn: false }, { uses: false, left: 0, warn: false }, { uses: false, left: 0, warn: false }, { uses: false, left: 0, warn: false }], "a sword, a throw and no weapon use nothing and warn of nothing");
  // The correction by hand on the Equipment row.
  same([nextLoaded(bow(1)), nextLoaded(bow(0)), nextLoaded(repeater(5)), nextLoaded(repeater(1)), nextLoaded(repeater(0)), nextLoaded(null)], [0, 1, 4, 0, 5, 1], "one click flips a bow; a Repeating Crossbow steps down and wraps to full");
});

check("in hand: the fist never stands in front of a weapon (ruling 294)", () => {
  const fist = { id: "f", name: "Unarmed Strike", natural: true, held: true, reach: 0 };
  const dagger = { id: "d", name: "Dagger", held: true, reach: 0 };
  const sword = { id: "s", name: "Shortsword", held: true, reach: 2 };
  const spear = { id: "p", name: "Spear", held: true, reach: 4 };
  const bow = { id: "b", name: "Shortbow", held: true, ranged: true, reach: 0, takesAmmunition: true, full: false };
  const packed = { id: "x", name: "Axe", held: false, reach: 2 };
  const id = w => w?.id ?? null;
  // The weapon that sets Total Reach, and so the one a Riposte and an Intercept Strike with.
  same([id(longestMelee([fist, dagger])), id(longestMelee([dagger, fist]))], ["d", "d"], "a dagger and a fist tie on reach: the dagger, whichever was added to the sheet first");
  same([id(longestMelee([fist, sword, spear])), id(longestMelee([spear, fist, sword]))], ["p", "p"], "the longer weapon");
  same([id(longestMelee([fist])), id(longestMelee([bow, fist])), id(longestMelee([bow])), id(longestMelee([])), id(longestMelee(null))], ["f", "f", null, null, null], "the fist when it is all there is in melee; nothing with only a bow, or nothing");
  // The weapon named is always the one whose reach Total Reach is: a natural weapon that reaches
  // further than the real one beside it (a claw, should one be authored) is the longest, and only
  // a tie goes to the real weapon.
  const claw = { id: "c", name: "Claws", natural: true, held: true, reach: 4 };
  same([id(longestMelee([dagger, claw])), id(longestMelee([claw, spear])), id(longestMelee([spear, claw]))], ["c", "p", "p"], "the longer reach first; a real weapon before a natural one where they tie");
  // The chooser behind the Strike row: what is in hand, real weapons first, the fist last.
  same(strikeOptions([fist, sword, packed, dagger, bow]).map(id), ["d", "b", "s", "f"], "by name, the fist last, a packed weapon not offered");
  same(strikeOptions([{ id: "f2", name: "Unarmed Strike", natural: true, held: false }]).map(id), ["f2"], "a natural weapon is offered whatever its carry state says");
  same([strikeOptions([]).length, strikeOptions(null).length], [0, 0], "nothing to Strike with");
  // What Reload may load.
  same(reloadOptions([sword, bow, { id: "c", name: "Crossbow", held: true, takesAmmunition: true, full: true }, { id: "w", name: "Arbalest", held: false, takesAmmunition: true, full: false }, { id: "a", name: "Arbalest", held: true, takesAmmunition: true, full: false }]).map(id), ["a", "b"], "in hand, takes ammunition, not full; by name");
  same(reloadOptions(null), [], "nothing");
});

check("ammunition: which stacks feed a weapon, and what a Reload takes (rulings 298 and 299)", () => {
  const arrows = { id: "a1", name: "Arrows", ammunition: "Bows", quantity: 3 };
  const more = { id: "a2", name: "Arrows", ammunition: "bows ", quantity: 10 };
  const silver = { id: "s1", name: "Silver Arrows", ammunition: "Bows", quantity: 2 };
  const bolts = { id: "b1", name: "Bolts", ammunition: "Crossbows", quantity: 10 };
  const spent = { id: "a0", name: "Arrows", ammunition: "Bows", quantity: 0 };
  const rope = { id: "r", name: "Rope", ammunition: "", quantity: 1 };
  const ids = list => list.map(s => s.id);
  // By Weapon Group, case and outer spaces aside, the empty stacks included; in the order they
  // are used: a stack In hand first, then by name, then as given.
  same(ids(ammunitionFor("Bows", [rope, silver, spent, arrows, bolts, more])), ["a0", "a1", "a2", "s1"], "a bow's stacks, by name, as the sheet lists them");
  same(ids(ammunitionFor("Bows", [arrows, { ...silver, held: true }, more])), ["s1", "a1", "a2"], "the kind taken In hand is used first: that is how a player chooses");
  same(ids(ammunitionFor("crossbows", [arrows, bolts])), ["b1"], "a crossbow's");
  same([ammunitionFor("Slings", [arrows, bolts]).length, ammunitionFor("", [arrows]).length, ammunitionFor("Bows", null).length], [0, 0, 0], "nothing feeds a Group nobody carries for, or a weapon with no Group");
  // One piece for each shot loaded, each stack emptied before the next.
  same(takeAmmunition([arrows, more], 1), {
    takes: [{ id: "a1", name: "Arrows", from: 3, to: 2 }], used: 1, short: 0, left: 12, kind: "Arrows",
    kinds: [{ name: "Arrows", used: 1, left: 12 }]
  }, "a bow takes one, and the card says how many Arrows are left in all");
  same(takeAmmunition([arrows, more], 5), {
    takes: [{ id: "a1", name: "Arrows", from: 3, to: 0 }, { id: "a2", name: "Arrows", from: 10, to: 8 }], used: 5, short: 0, left: 8, kind: "Arrows",
    kinds: [{ name: "Arrows", used: 5, left: 8 }]
  }, "a repeater takes five, across two stacks of one kind");
  same(takeAmmunition([arrows, silver], 4).kinds, [{ name: "Arrows", used: 3, left: 0 }, { name: "Silver Arrows", used: 1, left: 1 }], "a Reload that spans two kinds says each");
  same(takeAmmunition([spent, arrows], 1).takes, [{ id: "a1", name: "Arrows", from: 3, to: 2 }], "an empty stack is passed over");
  // Not enough: what there is is taken, and `short` is what the card says was missing.
  same(takeAmmunition([arrows], 5), {
    takes: [{ id: "a1", name: "Arrows", from: 3, to: 0 }], used: 3, short: 2, left: 0, kind: "Arrows",
    kinds: [{ name: "Arrows", used: 3, left: 0 }]
  }, "three of five");
  same(takeAmmunition([spent], 1), { takes: [], used: 0, short: 1, left: 0, kind: "Arrows", kinds: [] }, "none left: the empty stack still names what was wanted");
  same(takeAmmunition([], 1), { takes: [], used: 0, short: 1, left: 0, kind: "", kinds: [] }, "nothing carried at all");
  same(takeAmmunition([arrows], 0), { takes: [], used: 0, short: 0, left: 3, kind: "Arrows", kinds: [] }, "a full weapon takes nothing");
  same(takeAmmunition(null, 2).short, 2, "no list");
  same([arrows.quantity, more.quantity], [3, 10], "the stacks given are not written: the caller writes `takes`");
});

check("in hand: who already has a natural weapon, so nobody is given a second Unarmed Strike (ruling 294)", () => {
  same([isNaturalGroup("Natural Weapons"), isNaturalGroup("natural weapon"), isNaturalGroup("Natural  Weapons")], [true, true, true], "the group, however it is spaced or cased");
  same([isNaturalGroup("Knives"), isNaturalGroup(""), isNaturalGroup(null), isNaturalGroup(undefined)], [false, false, false, false], "any other group, or none");
  // Stored Item data, as a character's `_source.items` holds it before anything is prepared.
  const fist = { type: "weapon", name: "Unarmed Strike", system: { group: "Natural Weapons" } };
  const claws = { type: "weapon", name: "Claws", system: { group: "Natural Weapons" } };
  const dagger = { type: "weapon", name: "Dagger", system: { group: "Knives" } };
  const talent = { type: "talent", name: "Natural Weapons", system: { group: "Natural Weapons" } };
  must(hasNaturalWeapon([dagger, fist]), "the Unarmed Strike is one");
  must(hasNaturalWeapon([claws]), "so are claws: a character with any natural weapon is given no fist");
  must(!hasNaturalWeapon([dagger]), "a dagger is not");
  must(!hasNaturalWeapon([talent]), "nor an Item of another type that only names the group");
  must(!hasNaturalWeapon([]) && !hasNaturalWeapon(null) && !hasNaturalWeapon([null, {}]), "nothing, and holes in the list");
  must(hasNaturalWeapon(new Set([fist])), "any iterable is read: an Actor's Items as well as an array");
});

/** A character's situation, as module/helpers/situation.mjs builds it; every fact known. */
const situation = (extra = {}) => ({
  conditions: [], bind: null, spells: 0, shield: { held: false, raised: false }, rigid: false,
  hands: { free: true, holding: false }, weapons: [], near: [], encounter: false,
  tracking: true, actionsLeft: 6, isTurn: true, permit: false, ...extra
});
const holds = (cell, s) => checkCondition(anyOf(cell)[0], s);

check("requires: a word is true, false, or cannot be told, and `not` of unknown stays unknown", () => {
  same([holds("[REQUIRES prone]", situation({ conditions: ["prone"] })), holds("[REQUIRES prone]", situation()), holds("[REQUIRES prone]", {})], [true, false, null], "a Condition: held, not held, not known");
  same(holds("[REQUIRES prone]", situation({ conditions: new Set(["prone"]) })), true, "the Conditions as a Set read too");
  same([holds("[REQUIRES not prone]", situation({ conditions: ["prone"] })), holds("[REQUIRES not prone]", situation()), holds("[REQUIRES not prone]", {})], [false, true, null], "not: turned round, and unknown stays unknown");
  same([holds("[REQUIRES supine]", situation()), holds("[REQUIRES supine]", {}), holds("[REQUIRES not supine]", {})], [false, false, true], "Supine is known false until it is built");
  // 0.32.1: until the Condition is built the word reads the named Effect called Supine, which
  // Drop Supine's `[EFFECT APPLY: Supine]` puts on, so Stand is listed for a creature on its back.
  same([holds("[REQUIRES supine]", { effects: ["supine"] }), holds("[REQUIRES supine]", { effects: ["blessed"] }), holds("[REQUIRES supine]", { effects: [] }), holds("[REQUIRES not supine]", { effects: ["supine"] })],
    [true, false, false, false], "the named Effect Supine answers the word; any other does not; `not` turns it round");
  same([holds("[REQUIRES bind]", situation({ bind: "neutral" })), holds("[REQUIRES bind]", situation({ bind: "controlled" })), holds("[REQUIRES bind]", situation()), holds("[REQUIRES bind]", {})], [true, true, false, null], "a Bind of any kind");
  same([holds("[REQUIRES spell]", situation({ spells: 2 })), holds("[REQUIRES spell]", situation()), holds("[REQUIRES spell]", {})], [true, false, null], "a spell");
  same([holds("[REQUIRES shield]", situation({ shield: { held: true, raised: false } })), holds("[REQUIRES shield raised]", situation({ shield: { held: true, raised: false } })), holds("[REQUIRES shield raised]", situation({ shield: { held: true, raised: true } })), holds("[REQUIRES shield raised]", situation({ shield: { held: false, raised: true } })), holds("[REQUIRES shield]", {})],
    [true, false, true, false, null], "a shield in hand, and Raised only while in hand");
  same([holds("[REQUIRES rigid]", situation({ rigid: true })), holds("[REQUIRES rigid]", situation()), holds("[REQUIRES rigid]", {})], [true, false, null], "a rigid implement");
  same([holds("[REQUIRES free hand]", situation()), holds("[REQUIRES free hand]", situation({ hands: { free: false, holding: true } })), holds("[REQUIRES free hand]", situation({ hands: { free: null, holding: true } })), holds("[REQUIRES not free hand]", situation({ hands: { free: null, holding: true } }))],
    [true, false, null, null], "a free hand, and a hand count the system is unsure of");
  const bow = { reach: "ranged", traits: ["ranged", "reload", "two-handed"] };
  const dagger = { reach: "melee", traits: ["agile", "finesse", "thrown"] };
  same([holds("[REQUIRES weapon]", situation({ weapons: [dagger] })), holds("[REQUIRES weapon]", situation()), holds("[REQUIRES weapon]", {})], [true, false, null], "a weapon in hand");
  same([holds("[REQUIRES ranged weapon]", situation({ weapons: [dagger] })), holds("[REQUIRES ranged weapon]", situation({ weapons: [dagger, bow] })), holds("[REQUIRES weapon reload]", situation({ weapons: [bow] })), holds("[REQUIRES weapon reload]", situation({ weapons: [dagger] })), holds("[REQUIRES melee weapon thrown]", situation({ weapons: [dagger] })), holds("[REQUIRES melee weapon reload]", situation({ weapons: [dagger, bow] }))],
    [false, true, true, false, true, false], "by reach, by trait, and both on one weapon");
  const foe = (gap, inReach = false) => ({ relation: "enemy", gap, inReach });
  const friend = gap => ({ relation: "ally", gap, inReach: gap <= 2 });
  same([holds("[REQUIRES foe adjacent]", situation({ near: [foe(0)] })), holds("[REQUIRES foe adjacent]", situation({ near: [foe(1)] })), holds("[REQUIRES foe adjacent]", situation({ near: [friend(0)] })), holds("[REQUIRES foe adjacent]", situation()), holds("[REQUIRES foe adjacent]", situation({ near: null }))],
    [true, false, false, false, null], "an adjacent foe; nobody on the map is known; no token on the map is not");
  same([holds("[REQUIRES foe in reach]", situation({ near: [foe(4, true)] })), holds("[REQUIRES foe in reach]", situation({ near: [foe(4, false)] })), holds("[REQUIRES ally within 30]", situation({ near: [friend(30)] })), holds("[REQUIRES ally within 30]", situation({ near: [friend(31)] })), holds("[REQUIRES creature within 15]", situation({ near: [{ relation: "neutral", gap: 10, inReach: false }] })), holds("[REQUIRES ally within 15]", situation({ near: [{ relation: "neutral", gap: 10, inReach: false }] }))],
    [true, false, true, false, true, false], "reach is the caller's reading; feet are the gap; a creature is anyone, an ally is not a neutral");
  same([holds("[REQUIRES encounter]", situation({ encounter: true })), holds("[REQUIRES encounter]", situation()), holds("[REQUIRES encounter]", {})], [true, false, null], "an encounter");
  same(checkCondition({ test: "nonsense" }, situation()), null, "a term nobody knows cannot be told");
});

check("requires: a block fails only when every alternative is known false (ruling 283)", () => {
  const rules = cell => parseAutomation(cell, onRowOf).rules;
  const stand = rules("[REQUIRES prone or supine]");
  same(availability(stand, situation()).ok, false, "standing up while standing: known not to apply");
  same(availability(stand, situation({ conditions: ["prone"] })).ok, true, "Prone: it applies");
  // 0.32.1: on its back by the named Effect Supine (Drop Supine's APPLY), Stand applies too.
  same([availability(stand, { ...situation(), conditions: [], effects: ["supine"] }).ok, availability(stand, { ...situation(), conditions: [], effects: [] }).ok], [true, false], "Supine by its named Effect: it applies; neither: it does not");
  same(availability(stand, {}), { ok: true, failed: [], unknown: true }, "nothing known: shown, and said to be unknown");
  const grapple = rules("[REQUIRES free hand or weapon grapple][REQUIRES foe in reach]");
  same(availability(grapple, situation({ near: [{ relation: "enemy", gap: 0, inReach: true }] })).ok, true, "a free hand and a foe in reach");
  same(availability(grapple, situation()).failed.map(requireWords), ["a foe in reach"], "nobody in reach: the second block fails, and is named");
  same(availability(grapple, situation({ hands: { free: false, holding: true }, weapons: [{ reach: "melee", traits: [] }] })).failed.map(requireWords), ["a free hand or a weapon with the Grapple trait", "a foe in reach"], "both blocks can fail");
  same(availability(grapple, situation({ hands: { free: false, holding: true }, weapons: [{ reach: "melee", traits: ["grapple"] }], near: [{ relation: "enemy", gap: 0, inReach: true }] })).ok, true, "hands full, but the weapon has the trait");
  same(availability(grapple, situation({ hands: { free: null, holding: true }, weapons: [], near: [{ relation: "enemy", gap: 0, inReach: true }] })), { ok: true, failed: [], unknown: true }, "a hand the system is unsure of does not hide the row");
  same(availability(grapple, situation({ near: null })).ok, true, "no token on the map: nothing about the map hides a row");
  same([availability([], situation()).ok, availability(null, situation()).ok, availability([{ kind: "requires", any: [] }], situation()).ok], [true, true, true], "no block, or an empty one, always holds");
});

check("requires: the engine's own Maneuvers carry their conditions in code, and a cell replaces them", () => {
  for (const [slug, blocks] of Object.entries(ENGINE_REQUIRES)) {
    must(Object.hasOwn(BUILT_IN_MANEUVERS, slug) || Object.hasOwn(PAID_ELSEWHERE, slug), `${slug} is a Maneuver the system runs or pays for`);
    must(blocks.length > 0, `${slug} names a condition`);
    for (const data of blocks) readRequires(data);
  }
  same(Object.keys(ENGINE_REQUIRES).sort(), ["cast", "close", "gain-control", "pass", "raise-a-shield", "reload"], "the six (Reload since 0.29.0)");
  same(requiresFor([], ENGINE_REQUIRES.reload).map(requireWords), ["a weapon in hand to reload"], "Reload: something in hand to load");
  const reloadable = weapons => availability(requiresFor([], ENGINE_REQUIRES.reload), { weapons }).ok;
  same([reloadable([{ reach: "ranged", traits: [], takesAmmunition: true, loaded: false, full: false }]), reloadable([{ reach: "ranged", traits: [], takesAmmunition: true, loaded: true, full: true }]), reloadable([{ reach: "melee", traits: [], takesAmmunition: false, loaded: true, full: true }]), reloadable([])],
    [true, false, false, false], "listed with an empty bow in hand; not with a full one, a sword, or empty hands");
  const engine = slug => requiresFor([], ENGINE_REQUIRES[slug]);
  same(engine("gain-control").map(requireWords), ["in a Bind", "not Controlling a weapon"], "Gain Control: a Bind you do not Control");
  same(engine("close").map(requireWords), ["Controlling a weapon"], "Close: said in full, since \"Needs: Controlling\" reads oddly");
  same([availability(engine("cast"), situation()).ok, availability(engine("cast"), situation({ spells: 1 })).ok], [false, true], "Cast needs a spell");
  same([availability(engine("close"), situation()).ok, availability(engine("close"), situation({ conditions: ["controlling"], bind: "controlling" })).ok], [false, true], "Close needs a Control");
  same([availability(engine("gain-control"), situation()).ok, availability(engine("gain-control"), situation({ bind: "neutral", conditions: ["bound"] })).ok, availability(engine("gain-control"), situation({ bind: "controlled", conditions: ["controlled"] })).ok, availability(engine("gain-control"), situation({ bind: "controlling", conditions: ["controlling"] })).ok],
    [false, true, true, false], "Gain Control: no Bind, a neutral one, a Controlled one, one already Controlled");
  same([availability(engine("raise-a-shield"), situation()).ok, availability(engine("raise-a-shield"), situation({ shield: { held: true, raised: true } })).ok], [false, true], "Raise a Shield needs one in hand, and stays to lower it");
  same([availability(engine("pass"), situation()).ok, availability(engine("pass"), situation({ encounter: true })).ok], [false, true], "Pass needs an encounter");
  const own = parseAutomation("[REQUIRES prone]", onRowOf).rules;
  same(requiresFor(own, ENGINE_REQUIRES.cast).map(requireWords), ["Prone"], "a block in the cell replaces the engine's");
  same(requiresFor([{ kind: "bonus" }, { error: "x", kind: "requires" }], ENGINE_REQUIRES.cast).map(requireWords), ["a spell"], "other rules and error entries are not blocks");
  same([requiresFor(null).length, requiresFor(undefined, undefined).length], [0, 0], "a row with neither has none");
});

check("the tab: the four reasons a Maneuver is left out (rulings 284 to 286)", () => {
  same(STATUS_REASONS, ["requires", "mode", "opportunity", "cost"], "the reasons, in the order they are said");
  const stand = { requires: parseAutomation("[REQUIRES prone or supine]", onRowOf).rules, mode: "encounter", reaction: false, costs: [1], reactionCost: null };
  const plain = { requires: [], mode: "encounter", reaction: false, costs: [1], reactionCost: null };
  const fight = (extra = {}) => situation({ encounter: true, ...extra });
  same(maneuverStatus(plain, situation()), { applicable: true, reasons: [] }, "a row with no block, outside an encounter");
  same(maneuverStatus(stand, situation()), { applicable: false, reasons: [{ code: "requires", needs: "Prone or Supine" }] }, "its own conditions, with what it needs");
  same(maneuverStatus(stand, situation({ conditions: ["prone"] })).applicable, true, "met");
  // The wrong mode: only in an encounter.
  const search = { ...plain, mode: "exploration", costs: [] };
  const train = { ...plain, mode: "downtime", costs: [] };
  same([maneuverStatus(search, situation()).applicable, maneuverStatus(train, situation()).applicable], [true, true], "Activities and Endeavors are listed outside an encounter");
  same([maneuverStatus(search, fight()).reasons, maneuverStatus(train, fight()).reasons], [[{ code: "mode", mode: "exploration" }], [{ code: "mode", mode: "downtime" }]], "and left out in one");
  // Not your Opportunity.
  same(maneuverStatus(plain, fight({ isTurn: false })).reasons, [{ code: "opportunity" }], "outside the Opportunity");
  same(maneuverStatus(plain, fight({ isTurn: false, permit: true })).applicable, true, "the GM's approval standing");
  same(maneuverStatus({ ...plain, reaction: true }, fight({ isTurn: false })).applicable, true, "a Reaction is the book's out-of-turn Maneuver");
  same(maneuverStatus(plain, situation({ isTurn: false })).applicable, true, "outside an encounter there is no Opportunity to wait for");
  same(maneuverStatus(plain, fight({ isTurn: false, tracking: false })).reasons, [{ code: "opportunity" }], "the gate does not depend on the tracking setting");
  // Cannot afford it.
  same(maneuverStatus({ ...plain, costs: [2] }, fight({ actionsLeft: 1 })).reasons, [{ code: "cost", cost: 2, left: 1 }], "two actions with one left");
  same(maneuverStatus({ ...plain, costs: [1, 2, 3] }, fight({ actionsLeft: 1 })).applicable, true, "a range is judged by its cheapest");
  same(maneuverStatus({ ...plain, costs: [1, 3] }, fight({ actionsLeft: 0 })).reasons, [{ code: "cost", cost: 1, left: 0 }], "and named for it");
  same(maneuverStatus({ ...plain, costs: [0] }, fight({ actionsLeft: 0 })).applicable, true, "a free Maneuver is always affordable");
  same(maneuverStatus({ ...plain, reaction: true, costs: [1], reactionCost: 0 }, fight({ actionsLeft: 0, isTurn: false })).applicable, true, "a Reaction half with a cost of its own is a way to pay");
  same(maneuverStatus({ ...plain, reaction: true, costs: [1], reactionCost: null }, fight({ actionsLeft: 0, isTurn: false })).reasons, [{ code: "cost", cost: 1, left: 0 }], "a Reaction with no action left");
  same(maneuverStatus({ ...plain, costs: [2] }, fight({ actionsLeft: 1, tracking: false })).applicable, true, "with the six-action round not tracked nothing is counted");
  same(maneuverStatus({ ...plain, costs: [2] }, situation({ actionsLeft: 0 })).applicable, true, "nor outside an encounter");
  same(maneuverStatus({ ...plain, costs: [] }, fight({ actionsLeft: 0 })).applicable, true, "a row with no cost (a passive one) is never unaffordable");
  // Several at once, in order.
  same(maneuverStatus({ ...stand, costs: [2] }, fight({ isTurn: false, actionsLeft: 1 })).reasons.map(r => r.code), ["requires", "opportunity", "cost"], "every reason is said, in order");
  // Unknown never hides.
  same(maneuverStatus(stand, { encounter: true }).applicable, true, "a situation that knows nothing hides nothing");
  same(maneuverStatus(null, null), { applicable: true, reasons: [] }, "nor does no row at all");
});

check("the tab: a hand is free only when the system is sure (ruling 287)", () => {
  const sword = { type: "weapon" };
  const greatsword = { type: "weapon", twoHands: true };
  const fist = { type: "weapon", natural: true };
  const shield = { type: "shield" };
  const torch = { type: "gear" };
  const hands = held => { const h = freeHands(held); return [h.free, h.holding]; };
  same(hands([]), [true, false], "empty hands");
  same(hands([fist]), [true, false], "a natural weapon is no hand and nothing held");
  same(hands([sword]), [true, true], "one weapon");
  same(hands([sword, shield]), [false, true], "sword and shield");
  same(hands([greatsword]), [false, true], "a weapon in two hands");
  same(hands([sword, sword]), [false, true], "two weapons");
  same(hands([torch]), [true, true], "one piece of gear leaves a hand");
  same(hands([sword, torch]), [null, true], "a weapon and a piece of gear: cannot tell (a pack is marked the same way)");
  same(hands([torch, torch, torch]), [null, true], "gear alone never proves the hands full");
  same(hands([sword, shield, torch]), [false, true], "weapons and shields alone fill both");
  same(hands(null), [true, false], "nothing given");
  same(freeHands([sword], 1).free, false, "a one-handed body");
});

check("the tab: Favorites first, no Maneuver twice, and only what applies unless all are asked for (ruling 288)", () => {
  const row = (slug, applicable = true, extra = {}) => ({ slug, applicable, ...extra });
  const rows = [row("aid", true, { source: "own" }), row("stand", false), row("strike"), row("aid", true, { source: "basic", isBasic: true }), row("grapple", false), row("cast", false)];
  // Two Items on the sheet that share a name are both the character's: neither gives way.
  const twins = arrangeManeuvers([row("new-maneuver", true, { id: "a" }), row("new-maneuver", true, { id: "b" }), row("new-maneuver", true, { id: "c", isBasic: true })]);
  same(twins.rest.map(r => r.id), ["a", "b"], "only a Basic row gives way to a row of its name; two owned rows of one name are both listed");
  same(arrangeManeuvers([row("x", true, { id: "a" }), row("x", false, { id: "b" })], ["x"]).favorites.map(r => r.id), ["a", "b"], "and both are Favorites when the name is one");
  const plain = arrangeManeuvers(rows);
  same([plain.favorites, plain.rest.map(r => [r.slug, r.source ?? null, r.favorite]), plain.hidden], [[], [["aid", "own", false], ["strike", null, false]], 3], "what applies, the first row of a name standing, and how many are left out");
  const all = arrangeManeuvers(rows, [], { showAll: true });
  same([all.rest.map(r => r.slug), all.hidden], [["aid", "stand", "strike", "grapple", "cast"], 3], "every Maneuver, the count unchanged");
  const fav = arrangeManeuvers(rows, ["grapple", "aid", "gone"]);
  same([fav.favorites.map(r => [r.slug, r.applicable, r.favorite]), fav.rest.map(r => r.slug), fav.hidden], [[["grapple", false, true], ["aid", true, true]], ["strike"], 2], "Favorites in the order marked, never left out, not listed twice, and not counted as hidden; a Favorite that is no row is nothing");
  same([plain.left.map(r => r.slug), all.left.map(r => r.slug), fav.left.map(r => r.slug)], [["stand", "grapple", "cast"], ["stand", "grapple", "cast"], ["stand", "cast"]], "the rows left out, whichever way the list is shown");
  same(arrangeManeuvers(null), { favorites: [], rest: [], left: [], hidden: 0 }, "no rows");
});

/* -------------------------------------------- */
/*  Applying Effects (0.32.0)                   */
/* -------------------------------------------- */

console.log("\nApplying Effects (0.32.0)");

const applyRule = (cell, context = onRowOf) => bonusRule(cell, context);
const applyError = (cell, context = onRowOf) => bonusError(cell, context);
const TRIP_CELL = [
  "[EFFECT APPLY: prone, target; IF: RESULT(critical success)]",
  "[EFFECT APPLY: prone, target; IF: RESULT(success)]",
  "[EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]"
].join("\n");
const tripRow = maneuverWith("Trip ❶", TRIP_CELL);
const DEMORALIZE_CELL = [
  "[EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]",
  "[EFFECT APPLY: frightened 1, target; IF: RESULT(success); IF: COST(1)]",
  "[EFFECT APPLY: frightened 3, target; IF: RESULT(critical success); IF: COST(3)]",
  "[EFFECT APPLY: frightened 2, target; IF: RESULT(success); IF: COST(3)]"
].join("\n");
const demoralizeRow = maneuverWith("Demoralize ❶ or ❸", DEMORALIZE_CELL);
const standRow = maneuverWith("Stand ❶", "[EFFECT REMOVE: prone]");
const coverRow = maneuverWith("Take Cover ❶", "[EFFECT APPLY: Taking Cover]");

check("apply: registered at the applies hook alone, with the APPLY and REMOVE tags, and it draws no Use control (ruling 311)", () => {
  const kind = kindOf("apply");
  must(kind && kind.id === "apply", "kindOf('apply')");
  same([kind.aliases, Object.keys(kind.hooks)], [[], ["applies"]], "no aliases, and the one hook: a use hook would send the row down the use-rule path, a card hook would call it paid elsewhere");
  same([EFFECT_TAGS.apply, EFFECT_TAGS.remove], ["apply", "apply"], "two tags, one kind");
  must(CONDITIONS.includes("COST"), "COST is a condition word");
  must(!usableByRule(tripRow) && !usableByRule(standRow), "a row with APPLY or REMOVE lines is used as any row");
  must(EFFECT_KINDS.includes("apply"), "and its lines are switched on the Effects tab");
});

check("apply: every accepted form on a Maneuver's row, stored whole, and its summary", () => {
  const trip = applyRule("[EFFECT APPLY: prone, target; IF: RESULT(success)]");
  same([trip.kind, trip.op, trip.effect, trip.who, trip.until, trip.cost], ["apply", "apply", { name: "Prone", slug: "prone", condition: "prone" }, "target", null, null], "a Condition on the target, by degree");
  same(trip.when, [{ outcome: "success", name: "Success" }], "the degree is the line's one RESULT");
  must(summarize(trip) === "puts Prone on the target, on a Success", `the summary: "${summarize(trip)}"`);
  const over = applyRule("[EFFECT APPLY: off-guard; UNTIL: giver opportunity; IF: RESULT(critical failure)]");
  same([over.effect.condition, over.who, over.until], ["offGuard", "self", { who: "giver", n: 1 }], "yourself is the default, with a window");
  must(summarize(over) === "puts Off-Guard on you until your next Opportunity, on a Critical Failure", `the summary: "${summarize(over)}"`);
  const fright = applyRule("[EFFECT APPLY: frightened 2, target; IF: RESULT(critical success); IF: COST(1)]");
  same([fright.effect, fright.cost], [{ name: "Frightened", slug: "frightened", condition: "frightened", value: 2 }, 1], "a Condition with a value, and the cost it waits on");
  must(summarize(fright) === "puts Frightened 2 on the target, on a Critical Success, when 1 action is paid", `the summary: "${summarize(fright)}"`);
  same(applyRule("[EFFECT APPLY: frightened]").effect.value, 1, "a Condition that carries a value is 1 when none is written");
  const cover = applyRule("[EFFECT APPLY: Taking Cover]");
  same([cover.effect, cover.who, cover.when, cover.until], [{ name: "Taking Cover", slug: "taking-cover", condition: null }, "self", null, null], "a named Effect, on use, until removed");
  must(summarize(cover) === "puts Taking Cover on you", `the summary: "${summarize(cover)}"`);
  const stand = applyRule("[EFFECT REMOVE: prone]");
  same([stand.op, stand.effect.condition, stand.until], ["remove", "prone", null], "REMOVE takes a Condition off");
  must(summarize(stand) === "takes Prone off you", `the summary: "${summarize(stand)}"`);
  same(applyRule("[EFFECT REMOVE: grabbed; IF: RESULT(success)]").when, [{ outcome: "success", name: "Success" }], "a REMOVE by degree (Escape)");
  // The windows, with the edges only an APPLY line may write.
  const until = cell => applyRule(`[EFFECT APPLY: Marked, target; UNTIL: ${cell}; IF: RESULT(success)]`).until;
  same([until("giver opportunity"), until("giver opportunity end"), until("recipient opportunity"), until("recipient opportunity start"), until("recipient opportunity 2"), until("encounter")],
    [{ who: "giver", n: 1 }, { who: "giver", n: 1, edge: "end" }, { who: "recipient", n: 1 }, { who: "recipient", n: 1, edge: "begin" }, { who: "recipient", n: 2 }, { who: "encounter", n: 0 }], "the windows: a giver's ends as it begins and a recipient's as it ends, unless the edge is written");
  must(summarize(applyRule("[EFFECT APPLY: grabbed, target; UNTIL: giver opportunity end; IF: RESULT(success)]")) === "puts Grabbed on the target through your next Opportunity, on a Success", "an edge in words");
  // A rank condition rides beside the degree.
  same(applyRule("[EFFECT APPLY: prone, target; IF: RESULT(success); IF: RANK(roll >= expert)]").when.length, 2, "a rank beside the degree");
});

check("apply: the refusals, each by its message (rulings 317 and 321)", () => {
  must(/APPLY is written on the Maneuver's own row/.test(applyError("[EFFECT APPLY: prone]", { resolve, itemType: "talent" })), "never on a Talent");
  must(/REMOVE is written on the Maneuver's own row/.test(applyError("[EFFECT REMOVE: prone]", { resolve, itemType: "talent" })), "nor a REMOVE");
  // An aura block still reads its ring; the APPLY inside it is the one error.
  const inAura = parseAutomation("[AURA 15 allies; APPLY: prone]", onRowOf);
  must((inAura.errors.length === 1) && /cannot ride an \[AURA/.test(inAura.errors[0].message), "never inside an aura");
  must(/APPLY names the Effect/.test(applyError("[EFFECT APPLY:]")) || /names the Effect|is written/.test(applyError("[EFFECT APPLY: ]")), "an empty APPLY");
  must(/after the Effect comes `self`/.test(applyError("[EFFECT APPLY: prone, ally; IF: RESULT(success)]")), "the second descriptor is self or target");
  must(/not 3 descriptors/.test(applyError("[EFFECT APPLY: prone, target, self; IF: RESULT(success)]")), "two descriptors at most");
  must(/APPLY on a target lands from the card of the Maneuver's check/.test(applyError("[EFFECT APPLY: prone, target]")), "a target line names its result (ruling 321)");
  must(/takes one `IF: RESULT\(\.\.\.\)` \(2 given\)/.test(applyError("[EFFECT APPLY: prone, target; IF: RESULT(success); IF: RESULT(critical success)]")), "one degree to a line");
  for (const id of ["bound", "controlling", "controlled", "wounded", "dying", "dead", "spent", "preparing"]) {
    must(/the system runs that Condition itself/.test(applyError(`[EFFECT APPLY: ${id}]`)), `${id} is the system's own`);
  }
  must(/Exposed Zone/.test(applyError("[EFFECT APPLY: exposed head]")), "an Exposed Zone is the Zone's own");
  must(/Prone carries no value/.test(applyError("[EFFECT APPLY: prone 2]")), "a number after a Condition with no value");
  must(/REMOVE takes a Condition off whole/.test(applyError("[EFFECT REMOVE: frightened 2]")), "a REMOVE names no value");
  must(/APPLY takes no UNTIL beside a Condition with a value/.test(applyError("[EFFECT APPLY: frightened 2; UNTIL: encounter]")), "a Condition with a value moves by its own rule (ruling 317)");
  must(applyError("[EFFECT REMOVE: prone; UNTIL: encounter]") === "REMOVE does not take UNTIL", "a REMOVE has no window");
  must(/cannot be an Effect's name/.test(applyError("[EFFECT APPLY: target]")), "a reserved word is no name");
  // The review of 0.32.0: a forgotten comma read as a named Effect called "prone target" on the user.
  must(applyError("[EFFECT APPLY: prone target; IF: RESULT(success)]") === '"prone target": a comma goes before `target`, as in `APPLY: prone, target`', "a forgotten comma before target");
  must(/a comma goes before `self`, as in `APPLY: off-guard, self`/.test(applyError("[EFFECT APPLY: off-guard self]")) && /as in `REMOVE: grabbed, target`/.test(applyError("[EFFECT REMOVE: grabbed Target; IF: RESULT(success)]")) && /as in `APPLY: frightened 2, target`/.test(applyError("[EFFECT APPLY: frightened 2 target; IF: RESULT(success)]")), "and before self, after REMOVE, and after a value");
  // A name that begins with a Condition's name is a named Effect, and is said.
  const slip = parseAutomation("[EFFECT APPLY: frightened two]", onRowOf);
  must((slip.errors.length === 0) && (slip.rules[0].effect.condition === null) && (slip.warnings.length === 1) && /is read as a named Effect of its own, not the Condition Frightened; for the Condition write `frightened`, with a whole number for its value/.test(slip.warnings[0].message ?? slip.warnings[0]), `a name that begins with a Condition's: ${JSON.stringify(slip.warnings)}`);
  same([parseAutomation("[EFFECT APPLY: Taking Cover]", onRowOf).warnings.length, parseAutomation("[EFFECT APPLY: frightened 2, target; IF: RESULT(success)]", onRowOf).warnings.length], [0, 0], "a plain named Effect and a Condition with its value say nothing");
  for (const [cell, word] of [["FOR: allies 0", "FOR"], ["LIMIT: round", "LIMIT"], ["IF: CLAIM(when it suits)", "CLAIM"], ["IFT: MARKED", "MARKED"], ["IF: EFFECT(prone)", "EFFECT"]]) {
    must(new RegExp(`APPLY does not take .*${word}`).test(applyError(`[EFFECT APPLY: prone; ${cell}]`)), `APPLY refuses ${word} by name`);
  }
  must(/COST is written `COST\(<n>\)`/.test(applyError("[EFFECT APPLY: prone; IF: COST(two)]")) && /COST is given twice/.test(applyError("[EFFECT APPLY: prone; IF: COST(1); IF: COST(2)]")), "COST's own shape");
  // Every other kind refuses COST by name, and UNTIL's edges are an APPLY line's alone.
  must(giveError("[EFFECT GIVE: 1 situation, chosen; IF: RESULT(success); IF: COST(1)]") === "GIVE does not take IF: COST(<n>)", "GIVE refuses COST");
  must(/ATK does not take IF: COST\(<n>\)/.test(applyError("[EFFECT ATK: 1 situation; IF: COST(2)]", { resolve, itemType: "talent" })), "and a bonus line");
  must(/"end": a window's edge is written after APPLY alone/.test(giveError("[EFFECT GIVE: 1 situation, chosen; UNTIL: giver opportunity end; IF: RESULT(success)]")), "a GIVE window names no edge, and is told so");
  must(/"later" is not a count of Opportunities/.test(applyError("[EFFECT APPLY: Marked; UNTIL: giver opportunity later]")) && /`giver opportunity end`/.test(applyError("[EFFECT APPLY: Marked; UNTIL: recipient]")), "an APPLY window's own slips, the second told every shape");
});

check("applied: linesFor chooses by degree and by the cost paid, and the lines of no degree always stand", () => {
  const line = (slug, extra = {}) => ({ op: "apply", effect: { name: slug, slug, condition: null }, who: "self", until: null, degree: null, cost: null, ...extra });
  const lines = [line("always"), line("on-success", { degree: "success" }), line("on-crit", { degree: "critSuccess" }), line("one", { degree: "success", cost: 1 }), line("three", { degree: "success", cost: 3 }), line("paid-two", { cost: 2 })];
  const slugs = use => linesFor(lines, use).map(l => l.effect.slug);
  same(slugs({ degree: "success", cost: 1 }), ["always", "on-success", "one"], "a Success paid with one action");
  same(slugs({ degree: "success", cost: 3 }), ["always", "on-success", "three"], "the same degree at three");
  same(slugs({ degree: "critSuccess", cost: 2 }), ["always", "on-crit", "paid-two"], "another degree, and a line that waits on the cost alone");
  same(slugs({ degree: null, cost: 1 }), ["always"], "no degree (no Threshold, or no check): only the lines that wait on none");
  same(slugs({ degree: "success", cost: null }), ["always", "on-success"], "no cost known: a line that waits on one does not stand");
  same(slugs({ degree: "success", cost: 0 }), ["always", "on-success"], "nought is a cost, and is not one");
  same([linesFor(null), linesFor([null, {}, { effect: null }])], [[], []], "nothing in, nothing out");
  same([needsCost(lines), needsCost([line("x")]), needsCost(null)], [true, false, false], "does any line wait on the cost?");
});

check("ruleApplies: the row's lines at the rank rolled, from an Item the user does not own; Off drops a line and Skip sets it aside", () => {
  const tess = rulesActor([], { athletics: "trained" });
  const asked = ruleApplies(tess, { item: tripRow, rank: "trained" });
  same(asked.lines.map(l => [l.op, l.effect.slug, l.who, l.degree, l.cost, l.until]), [["apply", "prone", "target", "critSuccess", null, null], ["apply", "prone", "target", "success", null, null], ["apply", "offguard", "self", "critFail", null, { who: "giver", n: 1 }]], "Trip's three lines, each with its degree");
  same(asked.skipped, [], "nothing on Skip");
  same(ruleApplies(tess, { item: demoralizeRow, rank: "trained" }).lines.map(l => [l.effect.value, l.degree, l.cost]), [[2, "critSuccess", 1], [1, "success", 1], [3, "critSuccess", 3], [2, "success", 3]], "Demoralize: a table for each cost");
  same(ruleApplies(tess, { item: standRow, rank: null }).lines.map(l => [l.op, l.effect.slug, l.degree]), [["remove", "prone", null]], "Stand: a use with no check");
  same([ruleApplies(tess, { item: null }), ruleApplies(null, { item: tripRow }), ruleApplies(tess, { item: { ...tripRow, type: "talent" } })].map(a => a.lines.length), [0, 0, 0], "no Item, no user, and only a Maneuver's Item applies");
  // A rank condition: the owner's, and the rank rolled.
  const gated = maneuverWith("Shove ❶", ["[EFFECT APPLY: prone, target; IF: RESULT(success); IF: RANK(Athletics >= expert)]", "[EFFECT APPLY: off-guard, target; IF: RESULT(success); IF: RANK(roll >= master)]"].join("\n"));
  same(ruleApplies(tess, { item: gated, rank: "trained" }).lines.length, 0, "neither rank is met");
  same(ruleApplies(rulesActor([], { athletics: "expert" }), { item: gated, rank: "trained" }).lines.map(l => l.effect.slug), ["prone"], "the owner's rank");
  same(ruleApplies(tess, { item: gated, rank: "master" }).lines.map(l => l.effect.slug), ["offguard"], "the rank rolled");
  same(ruleApplies(tess, { item: gated, rank: null }).lines.length, 0, "with no roll, a line that reads the rank rolled does not hold");
  // An owned copy carries a state; a compendium Item is always on.
  const owned = { ...tripRow, id: "trip0001" };
  const state = (rule, value) => ({ starwrought: { rules: { state: { [ruleStateKey(owned, rule)]: value } } } });
  const off = rulesActor([owned]);
  off.flags = state(owned.system.rules[2], "off");
  same(ruleApplies(off, { item: owned, rank: "trained" }).lines.map(l => l.degree), ["critSuccess", "success"], "Off: the line never arrives");
  const skip = rulesActor([owned]);
  skip.flags = state(owned.system.rules[2], "skip");
  const set = ruleApplies(skip, { item: owned, rank: "trained" });
  same([set.lines.map(l => l.degree), set.skipped.map(s => [s.line.degree, s.marks])], [["critSuccess", "success"], [["critFail", [{ key: ruleStateKey(owned, owned.system.rules[2]), per: "state" }]]]], "Skip: set aside with the mark that clears it, for the caller to file when the line would have stood");
  const stranger = rulesActor([]);
  stranger.flags = state(owned.system.rules[2], "off");
  same(ruleApplies(stranger, { item: owned, rank: "trained" }).lines.length, 3, "an Item the user does not own is always on");
  // A kind whose hook throws costs nothing.
  const cracked = { type: "action", name: "Cracked", system: { rules: [{ kind: "apply", op: "apply", effect: null, line: 1 }, ...tripRow.system.rules] } };
  same(ruleApplies(tess, { item: cracked, rank: "trained" }).lines.length, 3, "a rule with no Effect is passed over");
});

check("applied: the record, its window, and what each turn change does to it (rulings 314 and 316)", () => {
  const giver = { uuid: "Actor.tess", name: "Tess" };
  const maneuver = { slug: "trip", name: "Trip" };
  const effect = { name: "Off-Guard", slug: "offguard", condition: "offGuard" };
  const who = { giverCombatant: "cTess", recipientCombatant: "cBandit" };
  same(appliedWindow(null, who), null, "no UNTIL, no window: the Effect lasts until removed");
  same(appliedWindow({ who: "giver", n: 1 }, who), { who: "giver", edge: "begin", combatant: "cTess", n: 1, begun: 0 }, "a giver's window ends as the Opportunity begins");
  same(appliedWindow({ who: "giver", n: 1, edge: "end" }, who), { who: "giver", edge: "end", combatant: "cTess", n: 1, begun: 0 }, "unless the line says its end");
  same(appliedWindow({ who: "recipient", n: 2 }, who), { who: "recipient", edge: "end", combatant: "cBandit", n: 2, begun: 0 }, "a recipient's ends as its last one ends");
  same(appliedWindow({ who: "recipient", n: 1, edge: "begin" }, who), { who: "recipient", edge: "begin", combatant: "cBandit", n: 1, begun: 0 }, "unless the line says its start");
  const whole = { who: "encounter", edge: null, combatant: null, n: 0, begun: 0 };
  same([appliedWindow({ who: "encounter", n: 0 }, who), appliedWindow({ who: "giver", n: 1 }, { recipientCombatant: "cBandit" }), appliedWindow({ who: "recipient", n: 1 }, {})], [whole, whole, whole], "the encounter's window, and one whose Opportunities cannot be counted, last the encounter");
  const record = (until, extra = {}) => appliedRecord({ effect, maneuver, giver, combat: "c1", until: appliedWindow(until, who), from: "msg1", ...extra });
  const base = record({ who: "giver", n: 1 });
  same(Object.keys(base), ["slug", "name", "condition", "by", "byName", "maneuver", "maneuverName", "combat", "until", "from"], "every key, always");
  same(Object.keys(appliedRecord({ effect: { name: "Taking Cover", slug: "taking-cover" }, maneuver, giver })), Object.keys(base), "the same keys with no window, no Combat and no card");
  same([isAppliedRecord(base), isAppliedRecord({}), isAppliedRecord(null), isAppliedRecord({ slug: "" })], [true, false, false, false], "what a record is");
  same([appliedBy(base, "Actor.tess"), appliedBy(base, "Actor.wren"), appliedBy(null, "Actor.tess"), appliedBy(base, "")], [true, false, false, false], "who put it there");
  // What a window's end asks before it takes an Effect off (the review of 0.32.0): is this still
  // the application the verdict was made on? A later APPLY gives the Effect a new record.
  const counted1 = { ...base, until: { ...base.until, begun: 1 } };
  same([sameApplication(base, { ...base }), sameApplication(base, counted1), sameApplication(base, { ...base, from: "msg2" }), sameApplication(base, { ...base, by: "Actor.wren" }), sameApplication(base, record({ who: "giver", n: 1, edge: "end" })), sameApplication(base, record(null)), sameApplication(base, null), sameApplication(null, null)],
    [true, true, false, false, false, false, false, false], "the same card, giver and window, whatever the count; another card, another giver, another window or none is another application");
  const at = change => ({ combat: "c1", ...change });
  // An overcommit's Off-Guard: until the giver's next Opportunity begins.
  same([settleApplied(base, at({ ended: "cTess" })), settleApplied(base, at({ began: "cBandit" })), settleApplied(base, at({ began: "cTess" }))], ["keep", "keep", "expire"], "a giver's window: kept through the rest of the round, gone as the next Opportunity begins");
  same(settleApplied(base, { combat: "c2", began: "cTess" }), "keep", "another Combat's turns are not this Effect's");
  // Grabbed until the end of the giver's next Opportunity.
  const end = record({ who: "giver", n: 1, edge: "end" });
  const counted = (r, begun) => ({ ...r, until: { ...r.until, begun } });
  same([settleApplied(end, at({ ended: "cTess" })), settleApplied(end, at({ began: "cTess" })), settleApplied(counted(end, 1), at({ ended: "cTess" }))], ["keep", { begun: 1 }, "expire"], "the Opportunity running when it was applied is not counted; the next is, and its end closes the window");
  // Until the recipient's next Opportunity begins.
  const start = record({ who: "recipient", n: 1, edge: "begin" });
  same([settleApplied(start, at({ began: "cTess" })), settleApplied(start, at({ began: "cBandit" }))], ["keep", "expire"], "a recipient's window that ends as their Opportunity begins");
  same(settleApplied(record({ who: "encounter", n: 0 }), at({ began: "cTess", ended: "cBandit" })), "keep", "the encounter's window closes with the Combat, not with a turn");
  same(settleApplied(record(null), at({ began: "cTess" })), "keep", "no window: no turn takes it off");
  same([settleApplied(null, at({})), settleApplied({}, at({}))], ["keep", "keep"], "nothing in, nothing done");
  // GIVE's windows settle exactly as before the edges existed.
  const pending = { combat: "c1", until: { who: "giver", combatant: "cTess", n: 1, begun: 0 } };
  const patient = { combat: "c1", until: { who: "recipient", combatant: "cWren", n: 2, begun: 2 } };
  same([settle(pending, at({ began: "cTess" })), settle(patient, at({ ended: "cWren" })), settle({ ...patient, until: { ...patient.until, begun: 1 } }, at({ ended: "cWren" }))], ["expire", "expire", "keep"], "a pending result's window names no edge and settles as it did");
});

check("applied: `mine` holds only for an Effect the one asking put there (ruling 319)", () => {
  const record = by => ({ slug: "wrongfooted", name: "Wrong-Footed", condition: "wrongFooted", by, byName: "", maneuver: "feint", maneuverName: "Feint", combat: null, until: null, from: null });
  const list = effectList({
    statuses: ["wrongFooted", "prone"],
    effects: [
      { name: "Wrong-Footed", statuses: ["wrongFooted"], applied: record("Actor.tess") },
      { name: "Prone", statuses: ["prone"] },
      { name: "Marked", applied: { ...record("Actor.wren"), slug: "marked", name: "Marked", condition: null } },
      { name: "Blessed" }
    ]
  });
  const mine = name => ({ ...readEffectName(name), mine: true });
  same([listHas(list, mine("wrong-footed"), { by: "Actor.tess" }), listHas(list, mine("wrong-footed"), { by: "Actor.wren" }), listHas(list, mine("wrong-footed"))], [true, false, false], "a Condition you applied; one another applied; nobody asking");
  same([listHas(list, mine("prone"), { by: "Actor.tess" }), listHas(list, readEffectName("prone"), { by: "Actor.tess" })], [false, true], "a Condition put on by other means is nobody's, and is still there for the plain form");
  same([listHas(list, mine("Marked"), { by: "Actor.wren" }), listHas(list, mine("Marked"), { by: "Actor.tess" }), listHas(list, mine("Blessed"), { by: "Actor.tess" })], [true, false, false], "a named Effect the same way; a hand-made one is nobody's");
  same(listHas(list, mine("grabbed"), { by: "Actor.tess" }), false, "one that is not there at all");
  // The line: read after either prefix, stored on the entry, said in the summary.
  const feint = talentWith("Feinting Step", "[EFFECT ATK: 1 situation; IFT: EFFECT(wrong-footed, mine)]");
  same(feint.system.rules[0].has, [{ name: "Wrong-Footed", slug: "wrongfooted", condition: "wrongFooted", on: "other", mine: true }], "stored with the word");
  must(/you made Wrong-Footed/.test(summarize(feint.system.rules[0])), `the summary says whose: "${summarize(feint.system.rules[0])}"`);
  const lists = (by, other) => ({ self: effectList({}), other, by });
  same([effectHolds(feint.system.rules[0], lists("Actor.tess", list)), effectHolds(feint.system.rules[0], lists("Actor.wren", list)), effectHolds(feint.system.rules[0], lists("Actor.tess", effectList({})))], [true, false, false], "the bonus holds against a creature you Wrong-Footed, and no other");
  same(effectHolds(feint.system.rules[0], lists("Actor.tess", null)), false, "with no other party it does not hold, as MARKED does not");
});

check("applied: the words a card and a sheet say, and the build's census (ruling 321)", () => {
  same([effectWords({ name: "Prone" }), effectWords({ name: "Frightened", value: 2 }), effectWords({ slug: "taking-cover" })], ["Prone", "Frightened 2", "taking-cover"], "an Effect as a card names it");
  const line = extra => ({ op: "apply", effect: { name: "Off-Guard", slug: "offguard", condition: "offGuard" }, who: "self", until: null, degree: null, cost: null, ...extra });
  same([lineWords(line()), lineWords(line({ until: { who: "giver", n: 1 } }), { giver: "Tess", recipient: "Tess" }), lineWords(line({ op: "remove" }))], ["Off-Guard", "Off-Guard until Tess's next Opportunity", "no longer Off-Guard"], "a line in a few words, for the button");
  same(untilWords({ who: "giver", n: 1, edge: "end" }, { giver: "you" }), "through your next Opportunity", "a card that speaks to its reader says `your`");
  // 0.32.1 (Mike, of Stand's cell: `REMOVE: prone` and `REMOVE: Supine`): a REMOVE that found
  // nothing is not said beside a line that did something; when nothing was taken off, all is said.
  const did = (op, words, result) => ({ line: { op }, result, words });
  const gone = did("remove", "Tess is no longer Prone.", { ok: true });
  const none = did("remove", "Tess had no Supine to take off.", { skipped: "absent" });
  const held = did("remove", "Off-Guard stays on Tess: something else holds it there.", { skipped: "held" });
  const put = did("apply", "Tess is Off-Guard.", { ok: true });
  const already = did("apply", "Tess already has Prone by other means: nothing changes.", { skipped: "already" });
  same([wordsToSay([gone, none]), wordsToSay([none, gone]), wordsToSay([none, put]), wordsToSay([none, held]), wordsToSay([none, already])],
    [[gone.words], [gone.words], [put.words], [held.words], [already.words]], "the idle REMOVE is left out beside anything else that was done or said");
  same([wordsToSay([none]), wordsToSay([none, { ...none, words: "Tess had no Prone to take off." }]), wordsToSay([]), wordsToSay(null), wordsToSay([{ line: { op: "apply" }, result: { ok: true }, words: "" }])],
    [[none.words], [none.words, "Tess had no Prone to take off."], [], [], []], "with nothing else to say every idle REMOVE is said, so a use is never silent; no words, nothing said");
  // Supine is not a Condition of the system yet: after APPLY and REMOVE it is a named Effect,
  // shown with its capital whatever the cell's casing.
  same([applyRule("[EFFECT REMOVE: supine]").effect, applyRule("[EFFECT APPLY: SUPINE]").effect], [{ name: "Supine", slug: "supine", condition: null }, { name: "Supine", slug: "supine", condition: null }], "Supine after REMOVE and APPLY");
  same([untilWords({ who: "giver", n: 1 }, { giver: "they" }), untilWords({ who: "recipient", n: 2 }, { recipient: "they" })], ["until their next Opportunity", "through their second upcoming Opportunity"], "and `their` for a creature the sentence has already named");
  // The census.
  const carrier = (name, type, cell) => ({ source: `Sheet / ${name}`, name, type, rules: parseAutomation(cell, { resolve, itemName: name, itemType: type }).rules });
  const carriers = [
    carrier("Take Cover ❶", "action", "[EFFECT APPLY: Taking Cover]"),
    carrier("Hunker", "talent", "[EFFECT DEF: 1 situation; IF: EFFECT(Taking Cover)]"),
    carrier("Opportunist", "talent", "[EFFECT ATK: 1 situation; IFT: EFFECT(prone)]\n[EFFECT ATK: 1 situation; IFT: EFFECT(Marked for Death)]"),
    carrier("Finish Them ❶", "action", "[REQUIRES foe in reach with effect Marked for Death]\n[REQUIRES effect Bloodied]"),
    carrier("Rush ❷", "action", "[EFFECT APPLY: off-guard; UNTIL: giver opportunity]"),
    carrier("Stand ❶", "action", "[EFFECT REMOVE: prone]")
  ];
  const warnings = effectCensus(carriers, { runsElsewhere: slug => slug === "rush", slugOf: name => slugify(plainName(name)) });
  same(warnings.length, 3, `three warnings: ${warnings.join(" | ")}`);
  must(/^Sheet \/ Rush ❷: this Maneuver is run by the system another way/.test(warnings[0]), "an APPLY on a row the system runs another way");
  must(/^EFFECT\(Marked for Death\): no Maneuver applies an Effect of that name \(read by Sheet \/ Opportunist, Sheet \/ Finish Them ❶\)/.test(warnings[1]), "a named Effect read twice and applied nowhere, each reader named once");
  must(/^EFFECT\(Bloodied\): no Maneuver applies/.test(warnings[2]), "and one a REQUIRES asks for");
  must(!warnings.some(w => /Taking Cover|prone|Prone/.test(w)), "an Effect that is applied, and a Condition, are never warned about");
  same(effectCensus(null), [], "nothing read, nothing said");
  // The review of 0.32.0: a line that waits on a result, on a Maneuver that rolls no check.
  const waits = "[EFFECT APPLY: prone; IF: RESULT(critical failure)]\n[EFFECT APPLY: off-guard; IF: RESULT(failure)]";
  const noCheck = effectCensus([{ ...carrier("Brace ❶", "action", waits), rolls: false }, { ...carrier("Trip ❶", "action", waits), rolls: true }, carrier("Shove ❶", "action", waits), { ...carrier("Stand ❶", "action", "[EFFECT REMOVE: prone]"), rolls: false }]);
  same(noCheck.length, 1, `one warning, for the row known to roll nothing: ${noCheck.join(" | ")}`);
  must(/^Sheet \/ Brace ❶: this Maneuver rolls no check, so its APPLY and REMOVE lines that wait on a result/.test(noCheck[0]), "said once for the row, and never for a row that rolls, one the build cannot tell, or a line that waits on nothing");
});

/* -------------------------------------------- */
/*  The Conditions workbook (0.33.0)            */
/* -------------------------------------------- */

console.log("\nThe Conditions workbook (0.33.0)");

// Every check above ran with the registry as the system ships it with no workbook read: the
// built-ins alone. The checks below that need the workbook's rows register them and put the
// registry back (`seeded`), so the order of the sections never matters.

/** The resolver a Condition's row is parsed with: the suite's, and the Defenses it lacks. */
const conditionResolve = name => resolve(name) ?? ({
  evade: { type: "constellation", slug: "evade", name: "Evade", category: "Defense" },
  endure: { type: "constellation", slug: "endure", name: "Endure", category: "Defense" },
  awareness: { type: "constellation", slug: "awareness", name: "Awareness", category: "Defense" }
})[slugify(plainName(name))] ?? null;
const onConditionRow = (name, takes = "") => ({ resolve: conditionResolve, itemName: name, itemType: CONDITION_ROW, takes });

/** A Condition's Automation cell, parsed as its row is; fails on any error. */
function conditionCell(name, takes, cell) {
  const parsed = parseAutomation(cell, onConditionRow(name, takes));
  must(parsed.errors.length === 0, `${name}'s cell should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
  return parsed.rules;
}
const conditionRowError = (cell, takes = "") => bonusError(cell, onConditionRow("Row", takes));

const PRONE_CELL = "[EFFECT ATK: -2 situation]\n[EFFECT DEF: 2 situation, evade; IFT: RANGED]";
const EXPOSED_TEXT = "The named Zone has no Protection against the next Hit.";

/** The rows the workbook is seeded with, as the build hands them to the registry. */
function seedRows() {
  return [
    { name: "Off-Guard", rules: conditionCell("Off-Guard", "", "[EFFECT DEF: -2 situation, evade]\n[EFFECT DEF: -2 situation, guard]") },
    // One line since 0.36.0: a bare CHECK reaches every roll and Threshold.
    { name: "Frightened N", takes: "N", rules: conditionCell("Frightened", "n", "[EFFECT CHECK: -N condition]") },
    { name: "Fatigued N", takes: "N", rules: conditionCell("Fatigued", "n", "[EFFECT DEF: -N condition]\n[EFFECT ATK: -N condition]") },
    { name: "Prone", includes: ["Off-Guard"], rules: conditionCell("Prone", "", PRONE_CELL) },
    { name: "Supine", includes: ["Off-Guard"], effect: "On your back.", description: "The sky is all you see.", rules: conditionCell("Supine", "", PRONE_CELL) },
    { name: "Grabbed", includes: ["Off-Guard"] },
    { name: "Restrained", includes: ["Grabbed"] },
    { name: "Blinded", includes: ["Off-Guard"] },
    { name: "Unconscious", includes: ["Prone"] },
    { name: "Wrong-Footed [X]", takes: "X", includes: ["Off-Guard against X"] },
    { name: "Exposed [Zone]", takes: "Zone", system: true, effect: EXPOSED_TEXT, description: "An opening." },
    // A row built before 0.35.0: one text, `description`, and it is the rules.
    { name: "Dying", system: true, description: "At death's door." },
    { name: "Dead", system: true, listed: false }
  ];
}

/** Run `fn` with the workbook's rows registered (it is handed the registration's answer), and put the registry back. */
function seeded(fn, rows = seedRows()) {
  const answer = registerConditions(rows);
  try { return fn(answer); } finally { registerConditions([]); }
}

/** A creature for the Condition checks: statuses, their values, who applied each, its Torso, its Items. */
function creature({ statuses = [], values = {}, appliedBy = {}, torso = {}, items = [], uuid = "Actor.bandit", flags = undefined, ranks = {} } = {}) {
  const actor = {
    uuid, items, statuses: new Set(statuses),
    conditionValue: id => (statuses.includes(id) ? (values[id] ?? 1) : 0),
    effects: statuses.map(id => ({ statuses: new Set([id]), ...(appliedBy[id] ? { flags: { starwrought: { applied: { by: appliedBy[id] } } } } : {}) })),
    system: { zones: { torso: { wounds: 0, critical: false, ...torso } }, proficiency: slug => ({ rank: ranks[slug] ?? "untrained" }) },
    ...(flags ? { flags } : {})
  };
  actor.system.rules = collectRules(actor);
  return actor;
}
const lines = mods => mods.map(m => [m.label, m.value, m.type]);
const defenseLines = (actor, slug, extra = {}) => lines(ruleModifiers(actor, { kind: "defense", slug, item: null, ...extra }).applied);

check("conditions: the registry holds the built-ins alone until a workbook's rows are registered", () => {
  must(!conditionsRegistered(), "nothing registered");
  same([builtInConditionIds().length, Object.keys(CONDITION_REGISTRY).length], [28, 28], "the twenty-four the code knows and the four Exposed");
  same([conditionIdOf("Off-Guard"), conditionIdOf("off guard"), conditionIdOf("offGuard"), conditionIdOf("Blind"), conditionIdOf("blinded"), conditionIdOf("deaf"), conditionIdOf("supine"), conditionIdOf("exposed head"), conditionIdOf("")],
    ["offGuard", "offGuard", "offGuard", "blinded", "blinded", "deafened", null, null, null], "a name is read by its id, its word, or an alias; a Zone's Exposed is never a name; Supine is not one yet");
  same([conditionLabel("offGuard"), conditionLabel("blinded"), conditionLabel("wrongFooted"), conditionLabel("nothing")], ["Off-Guard", "Blinded", "Wrong-Footed", "Nothing"], "a built-in's own printed name");
  same([statusEffectId("prone"), statusEffectId("controlled"), statusEffectId("exposedHead")], ["starwroughtprone", "starwroughtctrld", "starwroughtxHead"], "the static ids are the ones a world already holds");
  same([conditionHasRules("offGuard"), conditionHasRules("frightened"), conditionHasRules("nothing")], [false, false, false], "no lines");
  same([conditionHasRow("offGuard"), conditionHasRow("frightened"), conditionHasRow("fatigued"), conditionHasRow("nothing")], [false, false, false, false], "and no row: the code's own numbers stand (ruling 329)");
  same(ZONE_CONDITIONS, { head: "exposedHead", torso: "exposedTorso", arms: "exposedArms", legs: "exposedLegs" }, "the Zones' mirrors");
  must(Object.isFrozen(CONDITION_REGISTRY.prone) && (CONDITION_REGISTRY.prone.builtIn === true) && (CONDITION_REGISTRY.dying.system === true) && (CONDITION_REGISTRY.prone.system === false), "a record is frozen and says what it is");
  same([CONDITION_REGISTRY.frightened.numeric, CONDITION_REGISTRY.frightened.takes, CONDITION_REGISTRY.prone.takes, CONDITION_REGISTRY.exposedArms.takes], [true, "n", "", "zone"], "what each takes");
  must(!conditionWords().includes("supine") && conditionWords().includes("prone") && !conditionWords().some(w => w.startsWith("exposed")), "the words a message lists");
});

check("conditions: a row lays over the built-in it names, and a row that names none makes a Condition (rulings 322 and 323)", () => {
  seeded(answer => {
    same(answer.created, ["supine"], "Supine is the one new Condition");
    must(["offGuard", "frightened", "blinded", "wrongFooted", "dying", "exposedHead", "exposedLegs"].every(id => answer.matched.includes(id)), "the rows that describe a built-in, the one Exposed row for all four Zones");
    must(answer.missing.includes("heedless") && answer.missing.includes("stunned") && !answer.missing.includes("exposed") && !answer.missing.includes("prone"), "and the built-ins no row describes, for the build to refuse");
    must(conditionsRegistered(), "registered");
    const supine = CONDITION_REGISTRY.supine;
    same([supine.id, supine.name, supine.label, supine.builtIn, supine.numeric, supine.system, supine.img, supine.effect, supine.flavor, supine.statusId],
      ["supine", "Supine", "Supine", false, false, false, DEFAULT_CONDITION_ICON, "On your back.", "The sky is all you see.", newStatusId("supine")], "the new Condition's record, with its two texts");
    must(!("description" in supine), "no record carries `description`: the word meant the rules text through 0.34.0, and a reader left on it finds nothing");
    must(/^sw[0-9a-z]{14}$/.test(statusEffectId("supine")), `a static status id of its own: ${statusEffectId("supine")}`);
    same([conditionIdOf("Supine"), conditionIdOf("SUPINE"), conditionIdOf("Blind"), conditionIdOf("blinded"), conditionLabel("blinded"), conditionLabel("supine")],
      ["supine", "supine", "blinded", "blinded", "Blinded", "Supine"], "read by name; a built-in is printed as its row names it");
    same([CONDITION_REGISTRY.frightened.label, CONDITION_REGISTRY.frightened.numeric, CONDITION_REGISTRY.wrongFooted.label, CONDITION_REGISTRY.wrongFooted.takes],
      ["Frightened", true, "Wrong-Footed", "x"], "the suffix the table prints is no part of the name");
    same([CONDITION_REGISTRY.dying.numeric, CONDITION_REGISTRY.dying.statusId, CONDITION_REGISTRY.dying.id, CONDITION_REGISTRY.dying.effect, CONDITION_REGISTRY.dying.flavor], [true, null, "dying", "At death's door.", ""],
      "a built-in keeps its id, its status id and its value, whatever its row's Takes says; a row of the older shape is its rules text and no flavor");
    same([CONDITION_REGISTRY.wrongFooted.includes, CONDITION_REGISTRY.restrained.includes, CONDITION_REGISTRY.unconscious.includes, CONDITION_REGISTRY.offGuard.includes],
      [[{ id: "offGuard", against: true }], [{ id: "grabbed", against: false }], [{ id: "prone", against: false }], []], "Includes, by id, with `against X`");
    same([CONDITION_REGISTRY.exposedHead.effect, CONDITION_REGISTRY.exposedLegs.effect, CONDITION_REGISTRY.exposedArms.flavor, CONDITION_REGISTRY.dead.listed, CONDITION_REGISTRY.prone.listed], [EXPOSED_TEXT, EXPOSED_TEXT, "An opening.", false, true], "the one Exposed row describes the four; Listed? is kept");
    same([conditionEffect("supine"), conditionFlavor("supine"), conditionEffect("dying"), conditionFlavor("dying"), conditionEffect("grabbed"), conditionFlavor("nothing")], ["On your back.", "The sky is all you see.", "At death's door.", "", "", ""], "the two texts, by id");
    // The alias still reads, and a row written by it names the Condition as written.
    same([conditionIdOf("blind"), conditionIdOf("Blind")], ["blinded", "blinded"], "`blind` stays a word a cell can write");
    same([conditionHasRules("offGuard"), conditionHasRules("frightened"), conditionHasRules("grabbed"), conditionHasRules("supine")], [true, true, false, true], "which Conditions the workbook gives lines");
    // The fallback is keyed on the ROW, not on its lines (ruling 329; the review): a row whose
    // cell is N/A means the Condition changes no number, for a character and an adversary alike.
    same([conditionHasRow("offGuard"), conditionHasRow("grabbed"), conditionHasRow("supine"), conditionHasRow("heedless"), conditionHasRow("exposedHead")], [true, true, true, false, false], "which Conditions a row describes: Heedless has none in this sheet");
    must(conditionWords().includes("supine"), "the new word is listed");
    same(readEffectName("supine"), { name: "Supine", slug: "supine", condition: "supine" }, "and a cell that names it means the Condition");
  });
  // Put back: the system as it shipped.
  same([conditionsRegistered(), conditionIdOf("supine"), CONDITION_REGISTRY.supine, conditionLabel("blinded"), Object.keys(CONDITION_REGISTRY).length], [false, null, undefined, "Blinded", 28], "a registration REBUILDS: with no rows, the built-ins alone");
  seeded(() => same([conditionLabel("blinded"), conditionNameKey("blinded")], ["Blind", "Blind"], "a row named by the alias prints as it is named"), [{ name: "Blind" }]);
  // A row deleted from the sheet is gone at the next registration.
  seeded(() => must(!("supine" in CONDITION_REGISTRY) && (conditionIdOf("supine") === null) && conditionHasRules("prone"), "Supine's row deleted, Supine gone"), seedRows().filter(r => r.name !== "Supine"));
});

check("conditions: a row the registry cannot take is refused in words, and nothing changes", () => {
  const refused = (rows, pattern, what) => throws(() => registerConditions(rows), pattern, what);
  refused([{ name: "  " }], /needs a name/, "no name");
  refused([{ name: "Shield" }], /already means something else/, "a REQUIRES word");
  refused([{ name: "Weapon Bound" }], /already means something else/, "a phrase REQUIRES reads as a weapon");
  refused([{ name: "Foe Sworn" }], /already means something else/, "a phrase REQUIRES reads as who is near");
  refused([{ name: "Exposed Flank" }], /already means something else/, "Exposed is a Zone's own");
  // The two words IMMUNE reads that are no Condition (0.35.0): a row of either name would take
  // the id the prevent kind keeps for it.
  refused([{ name: "Expose" }], /already means something else/, "Expose is IMMUNE's word for an Exposed Zone");
  refused([{ name: "Trait" }], /already means something else/, "Trait is IMMUNE's word for a trait");
  // And by the id the name makes, which drops every mark (the review of 0.35.0).
  refused([{ name: "Trai't" }], /already means something else/, "a mark the id drops does not get round the reserve");
  refused([{ name: "Expo'se" }], /already means something else/, "nor for Expose");
  refused([{ name: "Eff'ect" }], /already means something else/, "nor for a word REQUIRES reads");
  same(TRAIT_IMMUNITY, "trait", "the word the hook is asked with");
  refused([{ name: "Prone" }, { name: "prone" }], /two rows describe the Condition "prone"/, "two rows for one built-in");
  refused([{ name: "Dazed" }, { name: "DAZED" }], /two rows describe/, "two rows for one new Condition");
  refused([{ name: "Blind" }, { name: "Blinded" }], /two rows describe/, "an alias and the name are one Condition");
  // A name that differs from another Condition's only by a mark the id drops would take its word.
  refused([{ name: "Off-Guard" }, { name: "Off'Guard" }], /would be read as the Condition "Off-Guard" wherever a cell names it/, "an apostrophe in place of the hyphen");
  refused([{ name: "Off'Guard" }], /would be read as the Condition "Off-Guard"/, "and with no row for the real one");
  refused([{ name: "Wrong'Footed" }], /would be read as the Condition "Wrong-Footed"/, "the other camel-cased id");
  refused([{ name: "Dazed" }, { name: "Da'zed" }], /two rows describe|would be read as the Condition "Dazed"/, "and a new Condition's");
  refused([{ name: "Dazed", includes: ["Nothing"] }], /includes "Nothing", which is no Condition/, "an Includes that names none");
  refused([{ name: "Dazed", includes: ["Dazed"] }], /includes itself/, "itself");
  refused([{ name: "Dazed", system: true }], /marked System, and the system knows no Condition of that name/, "a System row with no built-in");
  refused([{ name: "Dazed", takes: "Y" }], /Takes is blank, N, Zone or X/, "a Takes nobody knows");
  refused([{ name: "Dazed", takes: "Zone" }], /only the system's own Conditions take a Zone/, "a new Condition with a Zone");
  refused([{ name: "2nd Wind" }], /begins with a letter/, "a name that makes no id");
  refused([{ name: "Dazed", statusId: "short" }], /is not 16 letters and digits/, "a status id of the wrong shape");
  refused([{ name: "Dazed", statusId: "starwroughtprone" }], /share the status id/, "a status id another Condition holds");
  same([conditionsRegistered(), Object.keys(CONDITION_REGISTRY).length, conditionIdOf("dazed")], [false, 28, null], "a refusal leaves the registry as it was");
  // A row may name an Includes that comes after it, and one that is a new Condition.
  seeded(() => same(CONDITION_REGISTRY.dazed.includes, [{ id: "reeling", against: false }], "a later row, a new Condition"), [{ name: "Dazed", includes: ["Reeling"] }, { name: "Reeling" }]);
  // The helpers.
  same([conditionRowName("Frightened N"), conditionRowName("Exposed [Zone]"), conditionRowName("Wrong-Footed [X]"), conditionRowName(" Prone "), conditionRowName("Stunned")], ["Frightened", "Exposed", "Wrong-Footed", "Prone", "Stunned"], "the table's suffix off");
  same([readInclude("Off-Guard against X"), readInclude("Off-Guard"), readInclude("  "), readInclude({ name: "Prone", against: true })],
    [{ name: "Off-Guard", against: true }, { name: "Off-Guard", against: false }, null, { name: "Prone", against: true }], "one Includes entry");
  same([newConditionId("Wrong-Footed"), newConditionId("Supine"), newStatusId("supine") === newStatusId("supine"), newStatusId("supine") === newStatusId("supinf"), newStatusId("a").length], ["wrongfooted", "supine", true, false, 16], "a new Condition's id and its static status id");
  same(CONDITION_TAKES, ["", "n", "zone", "x"], "what Takes may hold");
  // Every word a `[REQUIRES ...]` block reads before it asks for a Condition is one no new
  // Condition may be called: the two lists cannot drift.
  for (const word of ["bind", "spell", "spells", "shield", "shield raised", "raised shield", "rigid", "free hand", "hand free", "holding", "encounter", "weapon", "melee weapon", "ranged weapon", "weapon loaded", "weapon grapple", "foe adjacent", "ally within 30", "creature in sight", "effect Blessed", "bind neutral", "not prone"]) {
    const read = readRequires(word).any[0];
    must(read.test !== "condition" || read.not, `"${word}" is read by REQUIRES as something other than a Condition`);
    refused([{ name: word }], /already means something else/, `so no Condition may be named "${word}"`);
  }
  must(RESERVED_CONDITION_NAMES.includes("exposed"), "and Exposed");
});

check("conditions: a Condition's row reads CHECK, ATK, DEF and INIT, with `-N` for its own value (ruling 326)", () => {
  same(CONDITION_ROW_TAGS, ["check", "skill", "atk", "def", "init", "immune"], "the tags a row may carry (IMMUNE since 0.35.0, in its TRAIT form alone; SKILL since 0.36.0)");
  const frightened = conditionCell("Frightened", "n", "[EFFECT DEF: -N condition]\n[EFFECT CHECK: -N condition]\n[EFFECT ATK: -N condition]\n[EFFECT INIT: N situation]");
  same(frightened.map(r => [r.kind, r.value, r.scale, r.type, r.to.slug]), [["bonus", -1, "N", "condition", "defenses"], ["bonus", -1, "N", "condition", "rolls"], ["bonus", -1, "N", "condition", "attacks"], ["bonus", 1, "N", "situation", "initiative"]], "N is stored as a sign and a scale");
  same(frightened.map(summarize), ["-N Condition penalty to Defenses", "-N Condition penalty to every roll and Threshold", "-N Condition penalty to Attacks", "+N Situation bonus to Initiative"], "and said as N");
  const prone = conditionCell("Prone", "", PRONE_CELL);
  same(prone.map(r => [r.value, r.scale, r.type, r.to.slug]), [[-2, undefined, "situation", "attacks"], [2, undefined, "situation", "evade"]], "a whole number carries no scale");
  must(needsMoment(prone[1]) && !needsMoment(prone[0]), "a line that asks about the attack is read where the attack is known");
  // What a row may not hold, each said in words.
  must(/takes none: put N in the row's Takes cell/.test(conditionRowError("[EFFECT DEF: -N condition]", "")), "N on a row whose Takes is not N");
  must(/takes none/.test(conditionRowError("[EFFECT DEF: -N condition]", "x")), "nor X");
  must(/is a Condition's own value and is written on that Condition's row/.test(bonusError("[EFFECT DEF: -N condition]", { resolve, itemType: "talent" })), "N on a Talent");
  must(/is a Condition's own value/.test(bonusError("[EFFECT ATK: N situation]", { resolve, itemType: "action" })), "N on a Maneuver");
  for (const [cell, what] of [
    ["[EFFECT DEF: -1 condition; IF: RANK(Origin >= trained)]", "IF: RANK"],
    ["[EFFECT DEF: -1 condition; FOR: allies 15]", "FOR:"],
    ["[EFFECT DEF: -1 condition; LIMIT: round]", "LIMIT:"],
    ["[EFFECT CHECK: -1 condition; IF: CLAIM(when it suits)]", "IF: CLAIM"],
    ["[EFFECT ATK: -1 condition; IFT: EFFECT(prone)]", "EFFECT"],
    ["[EFFECT DEF: -1 condition; IF: SEEN]", "IF: SEEN"]
  ]) {
    const message = conditionRowError(cell);
    must(/on a Condition's row does not take/.test(message) && message.includes(what), `${what} is refused on a Condition's row: ${message}`);
  }
  must(/is not read on a Condition's row yet: a Condition's lines are CHECK, SKILL, ATK, DEF, INIT, IMMUNE$/.test(conditionRowError("[EFFECT APPLY: prone]")), "another tag");
  // IMMUNE on a Condition's row (0.35.0): a trait, alone.
  const immune = conditionCell("Blinded", "", "[EFFECT IMMUNE: TRAIT(Visual)]");
  same(immune, [{ effect: "trait", trait: "visual", name: "Visual", kind: "prevent", line: 1, text: "[EFFECT IMMUNE: TRAIT(Visual)]" }], "the stored rule: the trait's key and its name as written");
  same(summarize(immune[0]), "immune to anything with the Visual trait", "As read");
  same(conditionCell("Deafened", "", "[EFFECT IMMUNE: trait( auditory )]")[0], { effect: "trait", trait: "auditory", name: "Auditory", kind: "prevent", line: 1, text: "[EFFECT IMMUNE: trait( auditory )]" }, "case and spaces are forgiven, and the name prints with its capital");
  same(conditionCell("Bound", "", "[EFFECT IMMUNE: TRAIT(Two-Handed)]")[0].trait, "two-handed", "a hyphenated trait is one word");
  same(conditionCell("Blinded", "", "[EFFECT IMMUNE: TRAIT(Visual)]\n[EFFECT IMMUNE: TRAIT(Auditory)]").map(r => r.trait), ["visual", "auditory"], "two immunities are two lines");
  must(/immunity to a Condition or an Expose is not read on a Condition's row yet/.test(conditionRowError("[EFFECT IMMUNE: prone]")), "a Condition's name there is not read yet");
  must(/immunity to a Condition or an Expose is not read on a Condition's row yet/.test(conditionRowError("[EFFECT IMMUNE: expose]")), "nor an Expose");
  for (const cell of ["[EFFECT IMMUNE: TRAIT(Visual, Auditory)]", "[EFFECT IMMUNE: TRAIT(Auditory or Visual)]", "[EFFECT IMMUNE: TRAIT(Visual), TRAIT(Auditory)]", "[EFFECT IMMUNE: TRAIT(Visual), prone]", "[EFFECT IMMUNE: TRAIT(Visual or)]", "[EFFECT IMMUNE: TRAIT(or Visual)]", "[EFFECT IMMUNE: TRAIT(Sight and Sound)]"]) {
    must(/^IMMUNE names one trait to a line: write `\[EFFECT IMMUNE: TRAIT\(Visual\)\]` and a second line for a second trait$/.test(conditionRowError(cell)), `two traits in one line: ${cell}: ${conditionRowError(cell)}`);
  }
  for (const cell of ["[EFFECT IMMUNE: TRAIT()]", "[EFFECT IMMUNE: trait]", "[EFFECT IMMUNE: TRAIT( )]"]) {
    must(/^TRAIT\(\.\.\.\) names a trait, as in/.test(conditionRowError(cell)), `no trait at all: ${cell}: ${conditionRowError(cell)}`);
  }
  must(/"Vis\$ual" is not a trait's name/.test(conditionRowError("[EFFECT IMMUNE: TRAIT(Vis$ual)]")), "a name with a mark in it");
  // One word (the review of 0.35.0): the key is a trait's first word, so a second word was stored
  // in the name and never compared ("visual effects" printed "immune to visual effects effects").
  for (const [cell, name] of [["[EFFECT IMMUNE: TRAIT(visual effects)]", "visual effects"], ["[EFFECT IMMUNE: TRAIT(Reach 5)]", "Reach 5"]]) {
    const said = conditionRowError(cell);
    must(said.startsWith(`"${name}" is not a trait's name: one word`) && /Reach, not Reach 5/.test(said), `${cell}: ${said}`);
  }
  for (const cell of ["[EFFECT IMMUNE: TRAIT(Visual); LIMIT: encounter]", "[EFFECT IMMUNE: TRAIT(Visual); FOR: allies 15]", "[EFFECT IMMUNE: TRAIT(Visual); IF: RANK(Origin >= expert)]", "[EFFECT IMMUNE: TRAIT(Visual); IF: SEEN]", "[EFFECT IMMUNE: TRAIT(Visual); IFT: BLOW]", "[EFFECT IMMUNE: TRAIT(Visual); IFT: TRAIT(Fear)]"]) {
    const said = conditionRowError(cell);
    must(said.startsWith("`IMMUNE: TRAIT(...)` takes nothing after it on a Condition's row yet") && /written alone/.test(said), `${cell}: ${said}`);
  }
  // Off a Condition's row every shape of the form is told where it is read, before anything else.
  for (const cell of ["[EFFECT IMMUNE: TRAIT(Visual), TRAIT(Auditory)]", "[EFFECT IMMUNE: TRAIT(Visual, Auditory)]", "[EFFECT IMMUNE: trait]", "[EFFECT IMMUNE: TRAIT(Visual); LIMIT: encounter]"]) {
    must(/is read on a Condition's row for now/.test(bonusError(cell, { resolve, itemType: "talent" })), `on a Talent: ${cell}: ${bonusError(cell, { resolve, itemType: "talent" })}`);
  }
  same(bonusError("[EFFECT IMMUNE: prone, frightened]", { resolve, itemType: "talent" }), "IMMUNE is written `IMMUNE: <Condition or expose>`, as in `IMMUNE: prone` (2 descriptors given, 1 wanted)", "two Conditions on a Talent is still told its own shape");
  must(/a Condition's row takes `\[EFFECT \.\.\.\]` lines/.test(conditionRowError("[SPEED +1]")), "a feature block");
  // N/A is a row that needs none, as on any sheet.
  same(parseAutomation("N/A", onConditionRow("Heedless")), { rules: [], errors: [], warnings: [] }, "N/A");
});

check("conditions: what a creature HAS is its Conditions closed over what each includes (rulings 325, 327, 328)", () => {
  const ids = set => heldIds(set);
  // With no workbook nothing includes anything; a Wounded or struck Torso is Off-Guard all the same.
  same([ids(closeConditions({ direct: [["prone", {}]] })), ids(closeConditions({ direct: [["restrained", {}]] })), ids(closeConditions({ torso: true })), ids(closeConditions())], [["prone"], ["restrained"], ["offGuard"], []], "the built-ins alone");
  seeded(() => {
    const prone = closeConditions({ direct: [["prone", {}]] });
    same([ids(prone), prone.held.get("offGuard"), prone.held.get("prone").direct], [["prone", "offGuard"], { value: 1, by: null, bys: [], direct: false, via: ["prone"] }, true], "Prone includes Off-Guard");
    same([ids(closeConditions({ direct: [["restrained", {}]] })), ids(closeConditions({ direct: [["unconscious", {}]] })), ids(closeConditions({ direct: [["blinded", {}]] })), ids(closeConditions({ direct: [["supine", {}]] }))],
      [["restrained", "grabbed", "offGuard"], ["unconscious", "prone", "offGuard"], ["blinded", "offGuard"], ["supine", "offGuard"]], "and so on down");
    // One Off-Guard, however many ways it is come by; a direct one stands over an included one.
    const many = closeConditions({ direct: [["prone", {}], ["offGuard", {}], ["grabbed", {}]], torso: true });
    same([ids(many), many.held.get("offGuard").direct, [...many.held.get("offGuard").via].sort()], [["prone", "offGuard", "grabbed"], true, ["grabbed", "prone", "torso"]], "once");
    same(closeConditions({ torso: true }).held.get("offGuard"), { value: 1, by: null, bys: [], direct: false, via: ["torso"] }, "a Torso Wound is Off-Guard (ruling 327)");
    // A value is the Condition's own; an included Condition is whose its includer is (ruling 331).
    const mine = closeConditions({ direct: [["frightened", { value: 2 }], ["prone", { by: "Actor.tess" }]] });
    same([mine.held.get("frightened").value, mine.held.get("prone").by, mine.held.get("offGuard").by], [2, "Actor.tess", "Actor.tess"], "the value, and whose doing");
    // Two creatures whose Conditions both make a third Off-Guard: the Off-Guard is each one's.
    const two = closeConditions({ direct: [["prone", { by: "Actor.tess" }], ["grabbed", { by: "Actor.wren" }]] });
    same([two.held.get("offGuard").bys, two.held.get("offGuard").by], [["Actor.tess", "Actor.wren"], "Actor.tess"], "everyone who applied an includer");
    const twoList = effectList({ statuses: ["prone", "grabbed"], effects: [{ name: "Prone", statuses: ["prone"], applied: { by: "Actor.tess" } }, { name: "Grabbed", statuses: ["grabbed"], applied: { by: "Actor.wren" } }] });
    same([listHas(twoList, { condition: "offGuard", mine: true }, { by: "Actor.tess" }), listHas(twoList, { condition: "offGuard", mine: true }, { by: "Actor.wren" }), listHas(twoList, { condition: "offGuard", mine: true }, { by: "Actor.bandit" })], [true, true, false], "and `mine` holds for each of them");
    // Against X: only against the creature that put the including Condition on.
    const feinted = closeConditions({ direct: [["wrongFooted", { by: "Actor.tess" }]] });
    same([ids(feinted), [...feinted.against.keys()], [...feinted.against.get("offGuard").keys()], [...feinted.unknown]], [["wrongFooted"], ["offGuard"], ["Actor.tess"], []], "Wrong-Footed to Tess is Off-Guard against Tess");
    same([holdsCondition(feinted, "offGuard"), holdsCondition(feinted, "offGuard", "Actor.tess"), holdsCondition(feinted, "offGuard", "Actor.wren"), holdsCondition(feinted, "wrongFooted"), heldIdsFor(feinted, "Actor.tess"), heldIdsFor(feinted, "Actor.wren")],
      [false, true, false, true, ["wrongFooted", "offGuard"], ["wrongFooted"]], "as each creature sees it");
    const byHand = closeConditions({ direct: [["wrongFooted", {}]] });
    same([ids(byHand), byHand.against.size, [...byHand.unknown]], [["wrongFooted"], 0, ["wrongFooted"]], "one put on by hand names nobody, and includes nothing");
    const both = closeConditions({ direct: [["wrongFooted", { by: "Actor.tess" }], ["prone", {}]] });
    same([ids(both), both.against.size], [["wrongFooted", "prone", "offGuard"], 0], "held against everyone, it is not also listed against one");
    // Off the Actor: its statuses that are Conditions, the applied record, the STORED Torso.
    const actor = creature({ statuses: ["prone", "exposedHead", "frightened"], values: { frightened: 3 }, appliedBy: { prone: "Actor.tess" }, torso: { wounds: 1 } });
    const set = conditionSetOf(actor);
    same([ids(set), set.held.get("frightened").value, set.held.get("prone").by, set.held.get("offGuard").via], [["prone", "frightened", "offGuard"], 3, "Actor.tess", ["torso", "prone"]], "a Zone's Exposed is no Condition of the set");
    same([ids(conditionSetOf(creature({ torso: { critical: true } }))), ids(conditionSetOf(creature())), ids(conditionSetOf(null))], [["offGuard"], [], []], "the Torso's Critical Hit effect; nothing; nobody");
    // The Effects list reads the same closure, so EFFECT(...) and REQUIRES agree with the numbers.
    const list = effectList({ statuses: ["prone"], effects: [{ name: "Prone", statuses: ["prone"], applied: { by: "Actor.tess" } }] });
    same([[...list.conditions.keys()], list.via.get("offGuard"), [...list.direct], listHas(list, { condition: "offGuard" }), listHas(list, { condition: "offGuard", mine: true }, { by: "Actor.tess" }), listHas(list, { condition: "offGuard", mine: true }, { by: "Actor.wren" }), listHas(list, { condition: "grabbed" })],
      [["prone", "offGuard"], ["prone"], ["prone"], true, true, false, false], "a Prone creature is Off-Guard to a rule, and the Off-Guard is whose the Prone is");
    const wrong = effectList({ statuses: ["wrongFooted"], effects: [{ name: "Wrong-Footed", statuses: ["wrongFooted"], applied: { by: "Actor.tess" } }] });
    same([listHas(wrong, { condition: "offGuard" }), listHas(wrong, { condition: "offGuard" }, { viewer: "Actor.tess" }), listHas(wrong, { condition: "offGuard" }, { viewer: "Actor.wren" }), listHas(wrong, { condition: "offGuard", mine: true }, { by: "Actor.tess", viewer: "Actor.tess" }), conditionIdsFor(wrong, "Actor.tess"), conditionIdsFor(wrong, "Actor.wren"), conditionIdsFor(null)],
      [false, true, false, true, ["wrongFooted", "offGuard"], ["wrongFooted"], []], "against X, by the creature the question is asked for");
    const reader = bonusRule("[EFFECT ATK: 1 situation; IFT: EFFECT(off-guard)]", { resolve });
    same([effectHolds(reader, { other: wrong, by: "Actor.tess" }), effectHolds(reader, { other: wrong, by: "Actor.wren" }), effectHolds(reader, { other: list, by: "Actor.wren" })], [true, false, true], "`IFT: EFFECT(off-guard)` against a creature you Feinted, and against a Prone one");
    same(effectList({ statuses: ["prone"], torso: true }).via.get("offGuard"), ["torso", "prone"], "the list's Torso");
  });
  // The answer does not depend on the order the statuses are met in (the review of 0.33.0): an
  // includer that is itself included, whose own inclusion is "against X". And a cycle ends.
  const chained = { p: { includes: [{ id: "q", against: false }] }, s: { includes: [{ id: "q", against: false }] }, q: { includes: [{ id: "r", against: true }] }, r: { includes: [] } };
  const shape = set => [heldIds(set).sort(), [...set.against].map(([id, who]) => [id, [...who.keys()]]), [...set.unknown]];
  same([shape(closeConditions({ direct: [["p", {}], ["s", { by: "Actor.tess" }]] }, chained)), shape(closeConditions({ direct: [["s", { by: "Actor.tess" }], ["p", {}]] }, chained))],
    [[["p", "q", "s"], [["r", ["Actor.tess"]]], []], [["p", "q", "s"], [["r", ["Actor.tess"]]], []]], "either order: R against Tess, and nothing left nameless");
  same(shape(closeConditions({ direct: [["p", {}]] }, chained)), [["p", "q"], [], ["q"]], "with no applier anywhere, the includer is the one that names nobody");
  const cycle = { a: { includes: [{ id: "b", against: false }] }, b: { includes: [{ id: "a", against: true }] } };
  same(shape(closeConditions({ direct: [["a", { by: "Actor.tess" }]] }, cycle)), [["a", "b"], [], []], "a cycle ends, and what is held against everyone is not also held against one");
});

check("conditions: a Condition's lines act for whoever has it, through one carrier each (rulings 324 and 334)", () => {
  const afraid = { statuses: ["frightened", "prone"], values: { frightened: 2 } };
  // No workbook: no carrier, and the rules say nothing of a Condition.
  same([conditionCarriers(creature(afraid)), defenseLines(creature(afraid), "evade")], [[], []], "the built-ins carry no lines");
  seeded(() => {
    const actor = creature(afraid);
    const carriers = conditionCarriers(actor);
    same(carriers.map(c => [c.id, c.name, c.type, c.condition.value, c.condition.direct, c.condition.against]),
      [["condition:frightened", "Frightened", CONDITION_CARRIER_TYPE, 2, true, null], ["condition:prone", "Prone", CONDITION_CARRIER_TYPE, 1, true, null], ["condition:offGuard", "Off-Guard (Prone)", CONDITION_CARRIER_TYPE, 1, false, null]],
      "one carrier for each Condition that carries lines, named for what it comes through");
    must(carriers.every(isConditionCarrier) && !isConditionCarrier(humanity) && (CONDITION_CARRIER_TYPE === CONDITION_ROW) && !RULE_ITEM_TYPES.includes(CONDITION_CARRIER_TYPE), "a carrier, never an Item type");
    // The sheet's Threshold: what needs no attack.
    same(defenseLines(actor, "evade", { staticOnly: true }), [["Frightened", -2, "condition"], ["Off-Guard (Prone)", -2, "situation"]], "Evade: Frightened 2 and Off-Guard");
    same(defenseLines(actor, "guard", { staticOnly: true }), [["Frightened", -2, "condition"], ["Off-Guard (Prone)", -2, "situation"]], "Guard the same");
    same([defenseLines(actor, "endure", { staticOnly: true }), defenseLines(actor, "awareness", { staticOnly: true })], [[["Frightened", -2, "condition"]], [["Frightened", -2, "condition"]]], "Endure and Awareness: Frightened alone");
    same(resolveModifiers(ruleModifiers(actor, { kind: "defense", slug: "evade", item: null, staticOnly: true }).applied).total, -4, "which add");
    // The attack answered: Prone's +2 Evade against a ranged Attack, read where the Threat is known.
    same([defenseLines(actor, "evade", { momentOnly: true, threat: { threat: "blow", melee: false } }), defenseLines(actor, "evade", { momentOnly: true, threat: { threat: "blow", melee: true } }), defenseLines(actor, "guard", { momentOnly: true, threat: { threat: "blow", melee: false } }), defenseLines(actor, "evade", { momentOnly: true })],
      [[["Prone", 2, "situation"]], [], [], []], "against a ranged Attack, on Evade, and not otherwise");
    // The creature's own rolls.
    same(lines(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null }).applied), [["Frightened", -2, "condition"], ["Prone", -2, "situation"]], "an attack: Frightened and Prone");
    same([lines(ruleModifiers(actor, { kind: "check", slug: "stealth", item: null }).applied), lines(ruleModifiers(actor, { kind: "initiative", slug: "stealth", item: null }).applied)], [[["Frightened", -2, "condition"]], [["Frightened", -2, "condition"]]], "a check, and an Initiative rolled as one, once");
    // A pairing asks for the rules about the other party alone: a Condition's own line was the die's.
    same(ruleModifiers(actor, { kind: "attack", slug: "melee", item: null, pairingOnly: true, other: { uuid: "Actor.wren" } }).applied, [], "never twice on a Strike");
    // One Condition is one circumstance, however the creature came to have it.
    const piled = creature({ statuses: ["prone", "offGuard", "grabbed"], torso: { wounds: 1, critical: true } });
    same(defenseLines(piled, "guard", { staticOnly: true }), [["Off-Guard", -2, "situation"]], "Off-Guard five ways is -2 once");
    same(ruleModifiers(piled, { kind: "defense", slug: "evade", item: null, staticOnly: true }).applied[0].source, "rule:condition:offGuard", "one source");
    same(defenseLines(creature({ torso: { wounds: 1 } }), "evade", { staticOnly: true }), [["Off-Guard (Torso)", -2, "situation"]], "a Torso Wound alone, named for it");
    // Today's numbers (0.32.1), from the sheet: Fatigued N is the four Defenses and attacks, never a check.
    const tired = creature({ statuses: ["fatigued"], values: { fatigued: 3 } });
    same([defenseLines(tired, "evade", { staticOnly: true }), defenseLines(tired, "awareness", { staticOnly: true }), lines(ruleModifiers(tired, { kind: "attack", slug: "ranged", item: null }).applied), ruleModifiers(tired, { kind: "check", slug: "stealth", item: null }).applied],
      [[["Fatigued", -3, "condition"]], [["Fatigued", -3, "condition"]], [["Fatigued", -3, "condition"]], []], "Fatigued 3");
    const guardless = creature({ statuses: ["offGuard"] });
    same([defenseLines(guardless, "evade", { staticOnly: true }), defenseLines(guardless, "guard", { staticOnly: true }), defenseLines(guardless, "endure", { staticOnly: true }), defenseLines(guardless, "awareness", { staticOnly: true }), ruleModifiers(guardless, { kind: "attack", slug: "melee", item: null }).applied, ruleModifiers(guardless, { kind: "check", slug: "stealth", item: null }).applied],
      [[["Off-Guard", -2, "situation"]], [["Off-Guard", -2, "situation"]], [], [], [], []], "Off-Guard: Evade and Guard, nothing else");
    // Against X: read only where the other party is known, and only for that creature.
    const feinted = creature({ statuses: ["wrongFooted"], appliedBy: { wrongFooted: "Actor.tess" } });
    same(conditionCarriers(feinted).map(c => [c.id, c.name, c.condition.against]), [["condition:offGuard", "Off-Guard (Wrong-Footed)", ["Actor.tess"]]], "the carrier of an Off-Guard held against one creature");
    same([defenseLines(feinted, "guard", { staticOnly: true }), defenseLines(feinted, "guard", { momentOnly: true, other: { uuid: "Actor.tess" } }), defenseLines(feinted, "guard", { momentOnly: true, other: { actor: { uuid: "Actor.tess" } } }), defenseLines(feinted, "guard", { momentOnly: true, other: { uuid: "Actor.wren" } }), defenseLines(feinted, "guard", { momentOnly: true }), defenseLines(feinted, "guard")],
      [[], [["Off-Guard (Wrong-Footed)", -2, "situation"]], [["Off-Guard (Wrong-Footed)", -2, "situation"]], [], [], []], "Tess's attack meets -2; Wren's, and the sheet, do not");
    // A Condition's line has no switch: a state left under its key is never read.
    const carrier = conditionCarriers(guardless)[0];
    const switched = creature({ statuses: ["offGuard"], flags: { starwrought: { rules: { state: { [ruleStateKey(carrier, carrier.system.rules[0])]: "off", [ruleStateKey(carrier, carrier.system.rules[1])]: "skip" } } } } });
    same([defenseLines(switched, "evade", { staticOnly: true }), defenseLines(switched, "guard", { staticOnly: true })], [[["Off-Guard", -2, "situation"]], [["Off-Guard", -2, "situation"]]], "Off and Skip mean nothing here (ruling 334)");
    same(ruleModifiers(switched, { kind: "defense", slug: "guard", item: null, staticOnly: true }).marks, [], "and nothing is marked");
    // The adversary's helper: the Conditions' lines alone, never a Talent's and never an offer.
    const bandit = creature({ statuses: ["frightened"], values: { frightened: 2 }, items: [allDefenses, humanity] });
    same([lines(conditionModifiers(bandit, { kind: "defense", slug: "guard", staticOnly: true })), defenseLines(bandit, "guard", { staticOnly: true }).map(l => l[0]), lines(conditionModifiers(bandit, { kind: "attack", slug: "" })), lines(conditionModifiers(bandit, { kind: "check", slug: "", item: null })), conditionModifiers(creature({ items: [allDefenses] }), { kind: "defense", slug: "guard" })],
      [[["Frightened", -2, "condition"]], ["Stout", "Frightened"], [["Frightened", -2, "condition"]], [["Frightened", -2, "condition"]], []], "a Frightened 2 Bandit is at -2; its Talent's bonus is not read by the helper");
    // The Effects tab switches none of it.
    must(!EFFECT_KINDS.includes(CONDITION_CARRIER_TYPE), "no kind of that name");
  });
});

check("conditions: a name stored before a row made it a Condition means the Condition (ruling 333)", () => {
  // As 0.32.1 stored them: Supine was a named Effect, so the reference carries no Condition.
  const stored = { name: "Supine", slug: "supine", condition: null };
  const dropSupine = maneuverWith("Drop Supine ⓿", "[REQUIRES not supine]\n[EFFECT APPLY: Supine]\n[EFFECT REMOVE: prone]", { id: "ds1" });
  const stand = maneuverWith("Stand ❶", "[REQUIRES prone or supine]\n[EFFECT REMOVE: prone]\n[EFFECT REMOVE: Supine]", { id: "st1" });
  same(dropSupine.system.rules.find(r => r.op === "apply").effect, stored, "the cell as it was parsed with no workbook read");
  const linesOf = row => ruleApplies(rulesActor([row]), { item: row, rank: "untrained" }).lines.map(l => [l.op, l.effect.name, l.effect.slug, l.effect.condition]);
  // No workbook: a named Effect, as in 0.32.1.
  same([conditionOfRef(stored), conditionOfRef({ name: "Prone", slug: "prone", condition: "prone" }), conditionOfRef({ name: "Taking Cover", slug: "taking-cover", condition: null }), conditionOfRef(null)], [null, "prone", null, null], "with the built-ins alone");
  same(linesOf(dropSupine), [["apply", "Supine", "supine", null], ["remove", "Prone", "prone", "prone"]], "the lines a use hands out name the Effect");
  const has = (s, cell) => availability(requiresFor(maneuverWith("Row", cell).system.rules), s).ok;
  same([has({ conditions: [], effects: ["supine"] }, "[REQUIRES supine]"), has({ conditions: [], effects: [] }, "[REQUIRES supine]")], [true, false], "and the word reads the named Effect");
  seeded(() => {
    same([conditionOfRef(stored), conditionOfRef({ name: "supine", slug: "supine" }), conditionOfRef({ name: "Taking Cover", slug: "taking-cover", condition: null })], ["supine", "supine", null], "with the workbook read, the same reference is the Condition");
    same(linesOf(dropSupine), [["apply", "Supine", "supine", "supine"], ["remove", "Prone", "prone", "prone"]], "so the lines a use hands out name the Condition, for the record, the words and the write");
    same(linesOf(stand), [["remove", "Prone", "prone", "prone"], ["remove", "Supine", "supine", "supine"]], "Stand's too");
    const supine = effectList({ statuses: ["supine"] });
    same([listHas(supine, stored), listHas(supine, { ...stored, mine: true }, { by: "Actor.tess" }), listHas(effectList({ statuses: [] }), stored), listHas(supine, { name: "Taking Cover", slug: "taking-cover", condition: null })], [true, false, false, false], "a rule that stored the name finds the Condition");
    same([has({ conditions: ["supine", "offGuard"], effects: [] }, "[REQUIRES supine]"), has({ conditions: [], effects: [] }, "[REQUIRES supine]"), has({ conditions: [], effects: ["supine"] }, "[REQUIRES supine]"), has({ conditions: ["supine"], effects: [] }, "[REQUIRES not supine]"), has({ conditions: ["supine"], effects: [] }, "[REQUIRES effect Supine]")],
      [true, false, true, false, true], "REQUIRES reads the Condition, and still the named Effect beside it");
    same(availability(requiresFor(maneuverWith("Row", "[REQUIRES creature adjacent with effect Supine]").system.rules), { near: [{ relation: "ally", gap: 0, inReach: true, conditions: ["supine"], effects: [] }] }).ok, true, "and what a nearby creature has");
  });
  // A Condition whose row has since been deleted is a named Effect again.
  same(conditionOfRef({ name: "Supine", slug: "supine", condition: "supine" }), null, "a reference to a Condition that no longer exists");
});

check("conditions: the build reads the staged rows, refuses a sheet with a slip, and builds both outputs together", () => {
  // The whole sheet as the converter stages it: every Condition the system has, and Supine.
  const row = (name, extra = {}) => ({ name, takes: "", description: "", effect: `${name}.`, includes: [], automation: "N/A", system: false, listed: true, icon: "", notes: "", row: 2, workbook: "conditions.xlsx", ...extra });
  const cells = {
    "Off-Guard": { automation: "[EFFECT DEF: -2 situation, evade]\n[EFFECT DEF: -2 situation, guard]" },
    Frightened: { takes: "N", automation: "[EFFECT CHECK: -N condition]" },
    Fatigued: { takes: "N", automation: "[EFFECT DEF: -N condition]\n[EFFECT ATK: -N condition]" },
    Prone: { includes: ["Off-Guard"], automation: PRONE_CELL, effect: "Off-Guard.\nStand to clear.", description: "Face in the dirt." },
    "Wrong-Footed": { takes: "X", includes: ["Off-Guard against X"] },
    Stunned: { takes: "N" }, Slowed: { takes: "N" }, Dying: { system: true }, Wounded: { takes: "Zone", system: true },
    Dead: { system: true, listed: false }, Concealed: { listed: false }
  };
  const sheet = (change = rows => rows) => {
    const names = builtInConditionIds().filter(id => !CONDITION_REGISTRY[id].zone).map(id => conditionLabel(id));
    const rows = [...names.map(n => row(n, cells[n] ?? {})), row("Exposed", { takes: "Zone", system: true }), row("Supine", { includes: ["Off-Guard"], automation: PRONE_CELL, icon: "icons/svg/sleep.svg" })];
    return { source: ["conditions.xlsx"], conditions: change(rows) };
  };
  try {
    const built = buildConditions({ staged: sheet() });
    same([built.errors, built.warnings, built.created, built.rules, built.cells], [[], [], ["Supine"], 9, 5], `the seed sheet reads: ${built.errors.join(" | ")}`);
    same(built.json.conditions.length, 26, "every row is written");
    const byName = Object.fromEntries(built.json.conditions.map(c => [c.name, c]));
    same([byName.Supine.id, byName.Supine.builtIn, byName.Supine.statusId, byName.Blinded.id, byName.Blinded.builtIn, "statusId" in byName.Blinded, byName.Exposed.id, byName.Frightened.rules.length, byName.Grabbed.rules, byName.Prone.includes],
      ["supine", false, newStatusId("supine"), "blinded", true, false, "exposed", 1, [], [{ name: "Off-Guard", against: false }]], "what each record carries: a new Condition's status id is fixed by the build");
    // The roster's block: the Listed rows alone, named as the tables print them, paragraphs kept apart.
    const block = Object.fromEntries(built.block);
    same([built.block.length, "Frightened N" in block, "Exposed [Zone]" in block, "Wrong-Footed [X]" in block, "Wounded [Zone]" in block, "Dead" in block, "Concealed" in block, block.Prone, block.Supine],
      [24, true, true, true, true, false, false, "Off-Guard.\n\nStand to clear.", "Supine."], "the reference tables' rows");
    same([listedName("Bound", "x"), listedName("Prone", ""), listedName("Slowed", "N")], ["Bound [X]", "Prone", "Slowed N"], "the suffix a table prints");
    // Two texts (0.35.0): a record carries the flavor line and the rules text, and the block's
    // second slot is the rules text, as it always was (four readers take it by position).
    same([byName.Prone.effect, byName.Prone.description, byName.Supine.effect, byName.Supine.description], ["Off-Guard.\nStand to clear.", "Face in the dirt.", "Supine.", ""], "what each record says");
    same(built.block.find(r => r[0] === "Supine"), ["Supine", "Supine."], "the block's second slot is the Effect, never the flavor");
    must(built.block.every(r => r.length === 2), "two slots, never three");
    // The journal's Conditions page (0.35.0): the block's rows, with the flavor in italics above.
    const page = Object.fromEntries(pageRows(built.json.conditions));
    same([pageRows(built.json.conditions).length, page.Prone, page.Supine], [24, "<em>Face in the dirt.</em><br>Off-Guard.\n\nStand to clear.", "Supine."], "a row with flavor carries it in italics above its Effect; a row with none is exactly its block row");
    same(pageRows([{ name: "Dazed", takes: "", effect: "You see <stars> & more.", description: "A <b>blow</b> & a ringing." }, { name: "Gone", listed: false, effect: "x", description: "y" }]),
      [["Dazed", "<em>A &lt;b&gt;blow&lt;/b&gt; &amp; a ringing.</em><br>You see <stars> & more."]], "the flavor is escaped once, the Effect printed as the tables always printed it, and an unlisted row left out");
    // A file built before 0.35.0 (one text, `description`, the rules) reads as an Effect with no flavor.
    const older = { conditions: built.json.conditions.map(({ effect, description, ...rest }) => ({ ...rest, description: effect })) };
    same([registryRows(older).find(r => r.name === "Prone").effect, registryRows(older).find(r => r.name === "Prone").description, listedRows(older.conditions), pageRows(older.conditions)], ["Off-Guard.\nStand to clear.", "", built.block, built.block], "an older conditions.json: the block and the journal page print what they printed");
    same([textsOf({ effect: " a ", description: " b " }), textsOf({ description: "rules" }), textsOf({ effect: "" }), textsOf(null)], [{ effect: "a", description: "b" }, { effect: "rules", description: "" }, { effect: "", description: "" }, { effect: "", description: "" }], "a row's two texts, whatever shape it was written in");
    same(listedText("One.\n\n Two. \nThree."), "One.\n\nTwo.\n\nThree.", "paragraphs, a blank line between");
    // A staged row of the older shape builds the same way.
    const stagedOld = buildConditions({ staged: sheet(rows => rows.map(({ effect, description, ...rest }) => ({ ...rest, description: effect }))) });
    same([stagedOld.errors, stagedOld.block], [[], built.block], "and an older staged row");
    must(buildConditions({ staged: sheet() }).errors.length === 0, "the registry holds the sheet again");
    // The registry is left holding the sheet, and what the client is handed registers the same.
    must(conditionsRegistered() && (conditionIdOf("supine") === "supine"), "a sheet that reads is registered");
    const again = registerConditions(registryRows(built.json));
    same([again.created, again.missing, CONDITION_REGISTRY.supine.statusId, CONDITION_REGISTRY.supine.img, conditionNameKey("blinded"), conditionNameKey("exposedHead"), conditionEffect("prone"), conditionFlavor("prone"), conditionEffect("exposedArms")],
      [["supine"], [], newStatusId("supine"), "icons/svg/sleep.svg", "Blinded", "STARWROUGHT.Condition.exposedHead", "Off-Guard.\nStand to clear.", "Face in the dirt.", "Exposed."], "conditions.json registers as the build did");

    // A sheet with a slip: said, nothing built, and the registry put back to the system's own,
    // whatever it held before (it is made to hold the good sheet first, each time, so the
    // assertion cannot pass by an earlier case's doing).
    const bad = (change, pattern, what) => {
      must(buildConditions({ staged: sheet() }).errors.length === 0 && conditionsRegistered(), `${what}: the good sheet registered first`);
      const b = buildConditions({ staged: sheet(change) });
      must(b.errors.some(e => pattern.test(e)) && (b.json === null) && (b.block === null), `${what}: ${b.errors.join(" | ") || "no error"}`);
      must(!conditionsRegistered(), `${what}: the registry is the system's own again`);
    };
    bad(rows => rows.filter(r => r.name !== "Stunned"), /no row for Stunned\. Every Condition the system has needs its row/, "a row the system needs, deleted");
    bad(rows => rows.filter(r => r.name !== "Exposed"), /no row for Exposed/, "the Exposed row deleted");
    bad(rows => rows.map(r => (r.name === "Grabbed") ? { ...r, includes: ["Off-Guard against X"] } : r), /Includes says "against X", and this Condition's Takes is not X/, "against X with no X");
    bad(rows => rows.map(r => (r.name === "Grabbed") ? { ...r, automation: "[EFFECT DEF: -N condition]" } : r), /automation: data\/conditions\.xlsx \/ Conditions \/ Grabbed, line 1: .*takes none/, "-N on a row that takes no value");
    bad(rows => rows.map(r => (r.name === "Grabbed") ? { ...r, takes: "N" } : r), /Takes is N, and the system keeps no value for Grabbed/, "Takes N on a Condition the system counts no value for");
    bad(rows => rows.map(r => (r.name === "Exposed") ? { ...r, automation: "[EFFECT DEF: -2 situation]" } : r), /the Exposed row describes the four Zones' statuses together and carries no lines/, "lines on the Exposed row");
    bad(rows => rows.map(r => (r.name === "Heedless") ? { ...r, includes: ["Reeling"] } : r), /includes "Reeling", which is no Condition/, "an Includes that names none");
    bad(rows => [...rows, row("Weapon Bound")], /cannot name a Condition/, "a name REQUIRES reads as something else");
    bad(rows => rows.map(r => (r.name === "Prone") ? { ...r, automation: "[EFFECT IMMUNE: frightened]" } : r), /immunity to a Condition or an Expose is not read on a Condition's row yet/, "immunity to a Condition on a row");
    bad(rows => rows.map(r => (r.name === "Prone") ? { ...r, automation: "[EFFECT APPLY: frightened]" } : r), /is not read on a Condition's row yet/, "another tag on a row");
    bad(rows => [...rows, row("Trait")], /cannot name a Condition/, "a row named Trait");
    // The sheet as Mike saved it: Blinded's line reads, and is one more rule in one more cell.
    const withImmune = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Blinded") ? { ...r, includes: ["Off-Guard"], automation: "[EFFECT IMMUNE: TRAIT(Visual)]" } : r)) });
    same([withImmune.errors, withImmune.warnings, withImmune.rules, withImmune.cells, withImmune.json.conditions.find(c => c.name === "Blinded").rules.map(r => [r.kind, r.effect, r.trait, r.name])],
      [[], [], 10, 6, [["prevent", "trait", "visual", "Visual"]]], "Blinded's IMMUNE line builds");
    // Two lines of one row that reach one roll (0.36.0): one Condition counts once, so the weaker
    // does nothing there. Said in one warning for the row, and the sheet still builds.
    const trapped = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Frightened") ? { ...r, automation: "[EFFECT CHECK: -N condition]\n[EFFECT INIT: -N condition]\n[EFFECT DEF: -N condition]\n[EFFECT DEF: -N condition, evade]" } : r)) });
    same([trapped.errors, trapped.warnings.length], [[], 1], "lines of one row that meet on a roll: one warning for the row");
    must(/Frightened: lines 1 and 2 both reach Initiative; lines 1 and 3 both reach Defenses; lines 1 and 4 both reach Evade; lines 2 and 3 both reach Initiative rolled with Awareness; lines 3 and 4 both reach Evade\. A Condition counts once on a roll, so only the stronger of two such lines applies there; a bare CHECK reaches every roll and Threshold, so a line of the same size beside it can go$/.test(trapped.warnings[0]), `each pair said: ${trapped.warnings[0]}`);
    // Two narrow lines that meet in one place: said, and NOT told that either can go (a SKILL line
    // does not reach the default Initiative, so the INIT line beside it is not covered).
    const narrowPair = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Frightened") ? { ...r, automation: "[EFFECT SKILL: -N condition]\n[EFFECT INIT: -N condition]" } : r)) });
    same([narrowPair.errors, narrowPair.warnings.length], [[], 1], "SKILL beside INIT: one warning");
    must(/Frightened: lines 1 and 2 both reach Initiative rolled with a Skill\. A Condition counts once on a roll, so only the stronger of two such lines applies there$/.test(narrowPair.warnings[0]), `no line is called spare: ${narrowPair.warnings[0]}`);
    // The sheet as it stood through 0.35.1, rebuilt unchanged: said, and it builds.
    const threeLines = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Frightened") ? { ...r, automation: "[EFFECT DEF: -N condition]\n[EFFECT CHECK: -N condition]\n[EFFECT ATK: -N condition]" } : r)) });
    same([threeLines.errors, threeLines.warnings.length, threeLines.rules], [[], 1, 11], "Frightened's three lines still build");
    must(/lines 1 and 2 both reach Defenses; lines 2 and 3 both reach attacks/.test(threeLines.warnings[0]), `and the row is told its narrower lines can go: ${threeLines.warnings[0]}`);
    // `[X]` (0.35.1): the creature a Condition is about. A row that takes one and still writes it
    // as a bare X is told to write [X]; a row that takes none and writes [X] is told it prints as
    // typed. Both are warnings, and the sheet still builds.
    const oldForm = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Wrong-Footed") ? { ...r, effect: "Off-Guard against X only, at X’s reach." } : r)) });
    same([oldForm.errors, oldForm.warnings.length], [[], 1], "a bare X on a row that takes a creature still builds");
    must(/Wrong-Footed: the text writes a bare X and no \[X\]: write \[X\] where the creature's name should appear/.test(oldForm.warnings[0]), `the old form is said: ${oldForm.warnings[0]}`);
    const converted = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Wrong-Footed") ? { ...r, effect: "Off-Guard against [X] only. Plan X stands.", description: "[X] has you." } : r)) });
    same([converted.errors, converted.warnings, converted.block.find(r => r[0] === "Wrong-Footed [X]")[1], converted.json.conditions.find(c => c.name === "Wrong-Footed").description],
      [[], [], "Off-Guard against [X] only. Plan X stands.", "[X] has you."], "a converted row is quiet, a bare X beside its [X] is the author's own, and the tables print [X] as typed");
    const noCreature = buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Grabbed") ? { ...r, effect: "Held by [X]." } : r)) });
    same([noCreature.errors, noCreature.warnings.length], [[], 1], "[X] on a row that takes no creature still builds");
    must(/Grabbed: the text writes \[X\], and this Condition's Takes is not X/.test(noCreature.warnings[0]), `and is said: ${noCreature.warnings[0]}`);
    same(buildConditions({ staged: sheet(rows => rows.map(r => (r.name === "Grabbed") ? { ...r, effect: "Mark the X on the map. eXtra." } : r)) }).warnings, [], "a bare X on a row that takes no creature is only a letter");
    // A row that makes a second new Condition, and a new one that takes a value.
    const more = buildConditions({ staged: sheet(rows => [...rows, row("Dazed", { takes: "N", automation: "[EFFECT ATK: -N condition]" })]) });
    same([more.errors, more.created, CONDITION_REGISTRY.dazed?.numeric], [[], ["Supine", "Dazed"], true], "a new Condition may take a value of its own");
    must(conditionNameFree("Dazed") && !conditionNameFree("Weapon Bound") && !conditionNameFree("melee weapon") && !conditionNameFree("Exposed Flank") && conditionNameFree("Ranged Fury"), "which names are free");
    bad(rows => [...rows, row("Off'Guard")], /would be read as the Condition "Off-Guard" wherever a cell names it/, "a name that would take another Condition's word");
    same([buildConditions({ staged: { conditions: [] } }).errors.length > 0, buildConditions({}).errors.length > 0], [true, true], "an empty sheet lacks every row the system needs");
    // The adversary's helper reads an "against X" Condition where the other party is known.
    registerConditions(registryRows(built.json));
    const feintedFoe = creature({ statuses: ["wrongFooted"], appliedBy: { wrongFooted: "Actor.tess" }, items: [allDefenses] });
    same([lines(conditionModifiers(feintedFoe, { kind: "defense", slug: "guard", other: { uuid: "Actor.tess" } })), conditionModifiers(feintedFoe, { kind: "defense", slug: "guard", other: { uuid: "Actor.wren" } }), conditionModifiers(feintedFoe, { kind: "defense", slug: "guard", staticOnly: true }), conditionModifiers(feintedFoe, { kind: "defense", slug: "guard" })],
      [[["Off-Guard (Wrong-Footed)", -2, "situation"]], [], [], []], "an adversary Wrong-Footed by Tess is Off-Guard when Tess is the other party, and its sheet's number does not move");
  } finally {
    registerConditions([]);
  }
  must(!conditionsRegistered(), "the registry is put back for whatever runs next");
});

check("conditions: `[X]` in a Condition's text is the creature it is about, and a bare X is a letter (rulings 361 to 365)", () => {
  const fill = (text, x = "") => fillConditionText(text, { x, fallback: "that creature" });
  same(CONDITION_TEXT_X, "[X]", "the placeholder");
  same(fill("Your implement is in a neutral Bind with [X]’s. The Bind ends.", "Bandit"), "Your implement is in a neutral Bind with Bandit’s. The Bind ends.", "the name, with its possessive");
  same(fill("You Control [X]’s weapon: [X] has an Exposed Zone. You may Close on [X].", "Tess"), "You Control Tess’s weapon: Tess has an Exposed Zone. You may Close on Tess.", "every one of them");
  same(fill("[X] Controls your weapon. You have a Zone of [X]’s choice: [X] picks. [X] waits.\n[X] again", ""),
    "That creature Controls your weapon. You have a Zone of that creature’s choice: that creature picks. That creature waits.\nThat creature again",
    "nobody named: the fallback, with a capital where it begins a sentence or a paragraph and nowhere else");
  same([fill("X marks the spot; see [x] and [ X ].", "Tess"), fill("Plan X.", ""), fill("", "Tess"), fill(null, "Tess")], ["X marks the spot; see Tess and Tess.", "Plan X.", "", ""], "a bare X is never touched; the placeholder is read in either case");
  same([fillConditionText("[X] stays", {}), fillConditionText("[X] stays"), fillConditionText("[X] goes", { x: "  ", fallback: "someone" })], ["[X] stays", "[X] stays", "Someone goes"], "with neither a name nor a fallback the text is as typed");
  same(fill("Held by [X].", "A <b> & \"C\""), "Held by A <b> & \"C\".", "the name is printed as it stands: the caller escapes the whole text");
  same(fill("[X] costs $& and $1.", "$&"), "$& costs $& and $1.", "a name is never read as a pattern");
  same([hasConditionTextX("with [X]’s"), hasConditionTextX("with [ x ]"), hasConditionTextX("with X’s"), hasConditionTextX(""), hasConditionTextX(null)], [true, true, false, false, false], "which texts write it");
  seeded(() => {
    same([conditionTakesCreature("wrongFooted"), conditionTakesCreature("bound"), conditionTakesCreature("prone"), conditionTakesCreature("frightened"), conditionTakesCreature("nothing")], [true, true, false, false, false], "a Condition takes a creature when its row's Takes is X");
  }, [...seedRows(), { name: "Bound [X]", takes: "X" }]);
  same(conditionTakesCreature("wrongFooted"), false, "the row is the word: with no row, none does");
});

/* -------------------------------------------- */
/*  A Maneuver's check, declared (0.34.0)       */
/* -------------------------------------------- */

console.log("\nA Maneuver's check, declared (0.34.0)");

/** Parse one cell on a Maneuver's own row and return its one rule, or its one error's message. */
const checkRule = (cell, context = onRowOf) => bonusRule(cell, context);
const checkError = (cell, context = onRowOf) => bonusError(cell, context);

check("check: the kind is registered with no hook, read from its block on a Maneuver's own row", () => {
  const kind = kindOf("check");
  must(kind && (kind.id === "check"), "the check kind is registered");
  same(Object.keys(kind.hooks ?? {}), [], "it has no hook: a use hook would take the whole use away from the roll");
  must(!EFFECT_KINDS.includes("check"), "it is no effect: the Effects tab has no switch for it");
  same([FEATURE_KEYWORD_LIST.includes("CHECK"), FEATURE_KEYWORD_LIST.at(-1)], [true, "EFFECT"], "the keyword is listed, and EFFECT stays last");
  same(EFFECT_TAGS.check, "bonus", "CHECK: with its colon is still the tag of a bonus to checks");
  const rule = checkRule("[CHECK Athletics vs Evade or Guard]");
  same([rule.kind, rule.line, rule.text], ["check", 1, "[CHECK Athletics vs Evade or Guard]"], "the stored rule");
  same([rule.rolls, rule.against], [[{ slug: "athletics", name: "Athletics" }], { defenses: ["evade", "guard"] }], "what is rolled, and what it is read against");
  same(summarize(rule), "rolls Athletics vs Evade or Guard (the target picks the Defense)", "As read");
  must(/Maneuver's own row/.test(checkError("[CHECK Athletics]", { resolve, itemType: "talent" })), "refused on a Talent, which grants a Maneuver for a roll");
  must(/Maneuver's own row/.test(checkError("[CHECK Athletics]", { resolve, itemType: "effect" })), "and on a custom effect row");
  must(/Condition's row/.test(checkError("[CHECK Athletics]", { resolve, itemType: CONDITION_ROW })), "and on a Condition's row");
  same(parseAutomation("[CHECK Athletics]", {}).errors.length, 0, "with no carrier named it reads");
  // Beside the row's other blocks, each its own rule.
  const row = parseAutomation("[REQUIRES foe in reach][CHECK Athletics vs Evade or Guard]\n[EFFECT APPLY: prone, target; IF: RESULT(success)]", onRowOf);
  same([row.errors, row.rules.map(r => r.kind)], [[], ["requires", "check", "apply"]], "a whole row: when it is listed, what it rolls, what a result does");
});

check("check: every form reads (rulings 337 and 338)", () => {
  const read = cell => { const { kind, line, text, ...rest } = checkRule(cell); return rest; };
  same(read("[CHECK Athletics]"), { rolls: [{ slug: "athletics", name: "Athletics" }], against: null }, "a check with a typed Threshold");
  same(read("[CHECK Athletics vs Guard]"), { rolls: [{ slug: "athletics", name: "Athletics" }], against: { defenses: ["guard"] } }, "against one Defense");
  same(read("[CHECK Athletics or Acrobatics vs Guard]").rolls.map(r => r.slug), ["athletics", "acrobatics"], "the user's pick, in the order written");
  same(read("[CHECK Athletics vs Evade or Guard or Endure]").against, { defenses: ["evade", "guard", "endure"] }, "the target's pick may be of three");
  same(read("[CHECK relevant]"), { rolls: RELEVANT, against: null }, "a Relevant Check");
  same(read("[CHECK Relevant Check vs Guard]"), { rolls: RELEVANT, against: { defenses: ["guard"] } }, "a Relevant Check against a Defense");
  same(read("[CHECK Stealth vs 15]"), { rolls: [{ slug: "stealth", name: "Stealth" }], against: { threshold: 15 } }, "a Threshold the row names");
  same(read("[check athletics VS. guard]"), read("[CHECK Athletics vs Guard]"), "case blind, and `vs.` with its full stop reads");
  same(read("[CHECK Guard vs 12]").rolls, [{ slug: "guard", name: "Guard" }], "a Defense may be what is rolled");
  same(read("[CHECK Archery vs Guard]").rolls, [{ slug: "archery", name: "Archery" }], "a Combat Style rolls, wearing its parent's rank");
  same(read("[CHECK Armored Fighting vs Guard]").rolls[0].name, "Armored Fighting", "a name of two words");
  // With no resolver (a caller that has none) the names are taken as written.
  const { rules } = parseAutomation("[CHECK Brawling or Athletics vs Awareness]", { itemType: "action" });
  same([rules[0].rolls, rules[0].against], [[{ slug: "brawling", name: "Brawling" }, { slug: "athletics", name: "Athletics" }], { defenses: ["awareness"] }], "no resolver: slugs from the names");
  // The four Defenses are a closed list, read without the resolver.
  same([defenseKeyOf("Evade"), defenseKeyOf("guard"), defenseKeyOf("Endure"), defenseKeyOf("AWARENESS"), defenseKeyOf("Athletics")], ["evade", "guard", "endure", "awareness", null], "the Defenses by name");
  same([...defenseNames()].sort(), ["Awareness", "Endure", "Evade", "Guard"], "the four are named");
});

check("check: every slip is told what to write", () => {
  must(/CHECK is written `\[CHECK <Constellation> or <Constellation> vs <Defense> or <Defense>\]`/.test(checkError("[CHECK]")), "an empty block is told the shape");
  must(/"Juggling" names no Constellation/.test(checkError("[CHECK Juggling vs Guard]")), "a name nobody knows");
  must(/"Aid" is a Maneuver: CHECK names the Constellation that is rolled/.test(checkError("[CHECK Aid]")), "a Maneuver on the left");
  must(/a Lore is each character's own/.test(checkError("[CHECK Lore vs 15]")), "a Lore is told `relevant`");
  must(/Origin is a rank a rule may ask about/.test(checkError("[CHECK Origin]")), "Origin is no check");
  must(/"Stealth" is not a Defense: after `vs` CHECK names Awareness, Evade, Guard, Endure, or a number/.test(checkError("[CHECK Athletics vs Stealth]")), "a Constellation that is no Defense on the right");
  must(/an `or` has nothing beside it/.test(checkError("[CHECK Athletics or vs Guard]")) && /an `or` has nothing beside it/.test(checkError("[CHECK Athletics vs Guard or]")), "a dangling `or`, either side");
  must(/names what is rolled before `vs`/.test(checkError("[CHECK vs Guard]")), "nothing before `vs`");
  must(/names a Defense or a number after `vs`/.test(checkError("[CHECK Athletics vs]")), "nothing after `vs`");
  must(/CHECK has one `vs`/.test(checkError("[CHECK Athletics vs Guard vs Evade]")), "two `vs`");
  must(/"against": CHECK writes it `vs`/.test(checkError("[CHECK Athletics against Guard]")) && /"versus": CHECK writes it `vs`/.test(checkError("[CHECK Athletics versus Guard]")), "the word is `vs`");
  must(/with no comma/.test(checkError("[CHECK Athletics, Acrobatics vs Guard]")), "a comma is told `or`");
  must(/CHECK has no `and`/.test(checkError("[CHECK Athletics and Acrobatics]")), "`and` is told one check");
  must(/"Athletics" is named twice/.test(checkError("[CHECK Athletics or Athletics]")) && /"Guard" is named twice/.test(checkError("[CHECK Athletics vs Guard or Guard]")), "a name given twice");
  must(/`relevant` already means any Constellation/.test(checkError("[CHECK relevant or Athletics]")), "`relevant` stands alone");
  must(/a Threshold is a whole number from 1 to 60, not 0/.test(checkError("[CHECK Athletics vs 0]")) && /not 99/.test(checkError("[CHECK Athletics vs 99]")), "a Threshold out of range");
  must(/after `vs` a number stands alone/.test(checkError("[CHECK Athletics vs 15 or Guard]")), "a number is not one of a choice");
  // The two forms that share the word, each written as the other.
  same(checkError("[CHECK 1 condition aid]"), BONUS_FORM, "a bonus written as the block is told the effect");
  must(/"CHECK:" begins an effect line, and an effect goes in an EFFECT block: write `\[EFFECT CHECK: 1 condition, aid\]`; the check a Maneuver rolls has no colon/.test(checkError("[CHECK: 1 condition, aid]")), "the tag without its EFFECT is told both forms");
  must(/"IMMUNE:" begins an effect line.*write `\[EFFECT IMMUNE: prone\]`$/.test(checkError("[IMMUNE: prone]")), "any tag that lost its EFFECT is told to wrap it");
  must(/CHECK is written `CHECK: <value> <type>, <descriptor>`.*The check a Maneuver rolls is a block of its own, with no EFFECT and no colon: `\[CHECK Athletics vs Evade\]`/.test(checkError("[EFFECT CHECK: Athletics vs Evade]")), "the block written as the tag is told its own block");
  must(/CHECK is a block of its own, not an effect: write `\[CHECK Athletics vs Guard\]`/.test(checkError("[EFFECT CHECK Athletics vs Guard]")), "wrapped in EFFECT with no colon");
  same(bonusRule("[EFFECT CHECK: 1 condition, aid]", { resolve, itemType: "talent" }).kind, "bonus", "and the bonus to checks reads as it always has");
  // A bonus to checks is told its own form wherever it was written, and on whatever carrier
  // (the review of 0.34.0: on a Talent it was sent to a Maneuver's row, and never told the form).
  const onTalent = { resolve, itemType: "talent" };
  const onCustom = { resolve, itemType: "effect" };
  same([checkError("[CHECK 1 condition, aid]"), checkError("[CHECK 1 condition, aid]", onTalent), checkError("[CHECK +2 situation]", onCustom), checkError("[CHECK -N condition]", onTalent)],
    [BONUS_FORM, BONUS_FORM, BONUS_FORM, BONUS_FORM], "the bonus written as the block, on every carrier");
  same([isBonusShape(": 1 condition, aid"), isBonusShape("1 condition, aid"), isBonusShape("-N condition"), isBonusShape("Athletics vs 15"), isBonusShape("15"), isBonusShape("")], [true, true, true, false, false, false], "what reads like a bonus");
  must(/^CHECK is an effect tag and takes a colon: write `\[EFFECT CHECK: 1 condition, aid\]`$/.test(checkError("[EFFECT CHECK 1 condition, aid]", onTalent)), "wrapped in EFFECT with its colon lost: told the colon, not the block");
  must(/^CHECK is an effect tag and takes a colon: write `\[EFFECT CHECK: 1 condition, aid\]`$/.test(checkError("check 1 condition, aid", onTalent)), "the tag typed as a line in a cell");
  must(/^CHECK is an effect tag and takes a colon: write `CHECK: 1 condition, aid`$/.test(checkError("check 1 condition, aid", onCustom)), "and in the custom effects field, in its bare form");
  must(/^CHECK is a feature and is written in brackets: `\[CHECK Athletics vs Guard\]`$/.test(checkError("check Athletics vs Guard")), "the block typed as a line is still told its brackets");
  // Only an effect TAG with a colon is an effect line that lost its EFFECT: these keep the old
  // message, which the red-cell tool reads (`is not a feature keyword`).
  for (const cell of ["[EFFECT: End Persistent Fire Damage; LIMIT: encounter]", "[SPEED: 6]", "[TRAIT: Human]", "[NOTE: ask Mike]"]) {
    must(/is not a feature keyword/.test(checkError(cell, onTalent)), `${cell} is told the keywords, not to wrap it in EFFECT`);
  }
  // A number that stands alone and is not a whole one in range.
  must(/a Threshold is a whole number from 1 to 60, with no sign.*not -5$/.test(checkError("[CHECK Athletics vs -5]")) && /not 15\.5$/.test(checkError("[CHECK Athletics vs 15.5]")) && /not \+15$/.test(checkError("[CHECK Athletics vs +15]")), "a signed or a fractional Threshold is told the range");
  // `and` is a word of some names: with a resolver the names decide.
  const withAnd = { itemType: "action", resolve: name => (slugify(plainName(name)) === "spear-and-polearm-fighting") ? { type: "constellation", slug: "spear-and-polearm-fighting", name: "Spear and Polearm Fighting" } : resolve(name) };
  same(checkRule("[CHECK Spear and Polearm Fighting vs Guard]", withAnd).rolls, [{ slug: "spear-and-polearm-fighting", name: "Spear and Polearm Fighting" }], "a Constellation whose name holds `and` reads");
  must(/CHECK has no `and`/.test(checkError("[CHECK Athletics and Acrobatics vs Guard]", withAnd)) && /CHECK has no `and`/.test(checkError("[CHECK Athletics vs Evade and Guard]", withAnd)), "and an `and` that joins is still refused, either side");
  must(/CHECK has no `and`/.test(checkError("[CHECK Athletics and Acrobatics]", { itemType: "action" })), "with no resolver nothing can tell, so it is refused");
});

check("check: `or` splits on the whole word alone, and no shipped name carries the grammar's words", () => {
  same(splitAlternatives("Athletics or Acrobatics"), ["Athletics", "Acrobatics"], "two alternatives");
  same(splitAlternatives("Armored Fighting OR Lore or Warrior"), ["Armored Fighting", "Lore", "Warrior"], "a word that only contains the letters is left whole");
  same(splitAlternatives("prone or"), ["prone", ""], "a dangling `or` is an empty alternative, for the reader to refuse");
  same(splitAlternatives("  "), [""], "nothing at all is one empty alternative");
  // The names the cells write: were a Constellation or a Maneuver called "Hide or Seek" or
  // "Man vs Beast", the block could not name it.
  // A block names Constellations and Defenses, never a Maneuver, so only the trees are asked;
  // `and` is no joiner (a name may hold it). A build with no trees.json yet has nothing to ask.
  let trees = [];
  try {
    trees = Object.keys(JSON.parse(readFileSync(fileURLToPath(new URL("./trees.json", import.meta.url)), "utf8")));
  } catch { trees = []; }
  const clash = trees.filter(name => /(^|\s)(vs\.?|or|relevant|versus|against)(\s|$)/i.test(name));
  same(clash, [], "no Constellation is named with `vs`, `or`, `against` or `relevant` as a word");
  same([...defenseNames()].filter(name => /(^|\s)(vs\.?|or|relevant)(\s|$)/i.test(name)), [], "and no Defense is");
});

check("check: the plan is the row's rule, else the three stored fields (planOf)", () => {
  const rules = cell => parseAutomation(cell, onRowOf).rules;
  const declared = planOf(rules("[CHECK Athletics or Acrobatics vs Evade or Guard]"), { enabled: true, constellation: "stealth", defense: "endure" });
  same(declared, { enabled: true, declared: true, relevant: false, rolls: [{ slug: "athletics", name: "Athletics" }, { slug: "acrobatics", name: "Acrobatics" }], defenses: ["evade", "guard"], threshold: null, extra: 0 }, "a rule stands over whatever is stored");
  same([userPicks(declared), targetPicks(declared)], [true, true], "both sides pick");
  const one = planOf(rules("[CHECK Intimidation vs Guard]"));
  same([one.rolls.map(r => r.slug), one.defenses, userPicks(one), targetPicks(one)], [["intimidation"], ["guard"], false, false], "one of each: nobody picks");
  const relevant = planOf(rules("[CHECK relevant vs Guard]"));
  same([relevant.relevant, relevant.rolls, relevant.defenses, userPicks(relevant)], [true, [], ["guard"], true], "a Relevant Check is the user's pick");
  const fixed = planOf(rules("[CHECK Stealth vs 15]"));
  same([fixed.threshold, fixed.defenses, targetPicks(fixed)], [15, [], false], "a Threshold, and no Defense");
  // Declared even on a row whose stored fields say "not enabled": the block is the word.
  same(planOf(rules("[CHECK Athletics]"), { enabled: false, constellation: "", defense: "" }).enabled, true, "a block enables the check by itself");
  // No block: the stored fields, as they have always been read.
  same(planOf([], { enabled: true, constellation: "athletics", defense: "evade" }), { enabled: true, declared: false, relevant: false, rolls: [{ slug: "athletics", name: "" }], defenses: ["evade"], threshold: null, extra: 0 }, "a named check from the fields");
  same(planOf([], { enabled: true, constellation: "", defense: "guard" }).relevant, true, "enabled with no Constellation is a Relevant Check");
  same(planOf([{ kind: "requires", any: [] }], { enabled: false, constellation: "evade", defense: "evade" }), { enabled: false, declared: false, relevant: false, rolls: [], defenses: [], threshold: null, extra: 0 }, "a row that is not enabled has no check, whatever it stores (a Posture's row)");
  same(planOf(null, null).enabled, false, "nothing at all is no check");
  same(planOf([], { enabled: true, constellation: "athletics", defense: "nonsense" }).defenses, [], "a Defense nobody knows is none");
  // A hand that typed two blocks: the first stands and the rest are counted.
  same(planOf(rules("[CHECK Athletics][CHECK Stealth]")).extra, 1, "a second block is counted, for the build to refuse and the sheet to say");
  // An error entry is no rule.
  same(planOf([{ error: "x", line: 1, text: "[CHECK Juggling]" }], { enabled: true, constellation: "stealth", defense: "" }).rolls[0].slug, "stealth", "an unread line is not a declared check");
  // The words, from a rule and from a plan built from slugs alone.
  same([checkWords(declared), checkWords(relevant), checkWords(fixed), checkWords(planOf([], { enabled: true, constellation: "armored-fighting", defense: "evade" }))],
    ["Athletics or Acrobatics vs Evade or Guard", "a Relevant Check vs Guard", "Stealth vs 15", "Armored fighting vs Evade"], "said in the cell's own words");
  same(checkWords(planOf([], { enabled: true, constellation: "armored-fighting", defense: "" }), () => "Armored Fighting"), "Armored Fighting", "a caller may hand over the printed names");
  same([checkSummary({ rolls: RELEVANT, against: null }), checkSummary(rules("[CHECK Athletics or Acrobatics]")[0]), checkSummary(rules("[CHECK Stealth vs 15]")[0])],
    ["rolls a Relevant Check (the Constellation is picked when it is rolled)", "rolls Athletics or Acrobatics (the one using the Maneuver picks which is rolled)", "rolls Stealth vs 15 (the roll may change the Threshold)"], "As read, with whose each choice is");
  // The three fields a plan comes to, for the build and the old readers.
  same([storedCheck(one), storedCheck(declared), storedCheck(relevant), storedCheck(planOf([], null))],
    [{ enabled: true, constellation: "intimidation", defense: "guard" }, { enabled: true, constellation: "", defense: "" }, { enabled: true, constellation: "", defense: "guard" }, { enabled: false, constellation: "", defense: "" }], "a choice stores no single answer");
});

check("check: the build is told when a CHECK block is never rolled (effectCensus)", () => {
  const rules = cell => parseAutomation(cell, { itemType: "action" }).rules;
  const slugOf = name => slugify(plainName(name));
  const options = { runsElsewhere: slug => ["strike", "leap"].includes(slug), runsItself: slug => slug === "strike", takesUse: kind => ["mark", "permit", "subordinate"].includes(kind), slugOf };
  const said = effectCensus([
    { source: "Sheet / Strike", name: "Strike ❶", type: "action", rules: rules("[CHECK Melee vs Evade or Guard]"), rolls: true },
    { source: "Sheet / Move Together", name: "Move Together", type: "action", rules: rules("[CHECK Athletics]\n[EFFECT PERMIT: move; FOR: allies 0; LIMIT: round]"), rolls: true },
    { source: "Sheet / Trip", name: "Trip", type: "action", rules: rules("[CHECK Athletics vs Evade or Guard]\n[EFFECT APPLY: prone, target; IF: RESULT(success)]"), rolls: true },
    { source: "Human / Talent", name: "Strike", type: "talent", rules: [{ kind: "check", rolls: "relevant", against: null }] },
    // Leap is paid by the drag and still used from its row: its declared check IS rolled.
    { source: "Sheet / Leap", name: "Leap ❶ to ❸", type: "action", rules: rules("[CHECK Athletics]"), rolls: true }
  ], options);
  same(said.length, 2, "two rows are told; a row that rolls its check, one another act pays for, and a carrier that is no Maneuver are not");
  must(/^Sheet \/ Strike: the system runs this Maneuver itself .*so its CHECK block is read by nothing$/.test(said[0]), "a row the system runs itself");
  must(/^Sheet \/ Move Together: a PERMIT line takes the whole use of this Maneuver, so the check its CHECK block declares is never rolled$/.test(said[1]), "a row whose use a line takes whole");
  // A declared row that waits on a result is never told it rolls no check; one that rolls none still is.
  const waiting = effectCensus([{ source: "Sheet / Brace", name: "Brace", type: "action", rules: rules("[EFFECT APPLY: prone, target; IF: RESULT(success)]"), rolls: false }], options);
  must(/declare the check with a \[CHECK \.\.\.\] block on the row/.test(waiting[0] ?? ""), "the advice for a row with no check names the block");
  // A row that DECLARES its check rolls one, whatever the build made of its prose (`rolls: false`
  // handed over on purpose: the assertion is the census's own reading, not the caller's flag).
  const declared = effectCensus([{ source: "Sheet / Trip", name: "Trip", type: "action", rules: rules("[CHECK Athletics vs Evade or Guard]\n[EFFECT APPLY: prone, target; IF: RESULT(success)]"), rolls: false }], options);
  same(declared, [], "a declared row that waits on a result is never told it rolls no check");
  // A caller that knows only `runsElsewhere` gets the wider answer, as 0.32.0's callers do.
  const older = effectCensus([{ source: "Sheet / Leap", name: "Leap", type: "action", rules: rules("[CHECK Athletics]"), rolls: true }], { runsElsewhere: slug => slug === "leap", slugOf });
  same(older.length, 1, "with no `runsItself` the census falls back to `runsElsewhere`");
});

check("check request: who may answer, which answer stands, and where a request is (rulings 339 and 159)", () => {
  const request = { mode: "answer", defenses: ["evade", "guard"] };
  // A Defense the row offered, from the target's side.
  same([
    validAnswer(request, { defense: "guard" }, { ownsTarget: true }),
    validAnswer(request, { defense: "guard" }, { isGM: true }),
    validAnswer(request, { defense: "guard" }, { ownsUser: true }),
    validAnswer(request, { defense: "endure" }, { ownsTarget: true }),
    validAnswer(request, { defense: "guard" }, {}),
    validAnswer(request, null, { isGM: true }),
    validAnswer(null, { defense: "guard" }, { isGM: true })
  ], [true, true, false, false, false, false, false], "the target's player or the GM, with a Defense the request offered; never the user's own player");
  // A withdrawal is the user's side.
  same([validAnswer(request, { withdrawn: true }, { ownsUser: true }), validAnswer(request, { withdrawn: true }, { ownsTarget: true }), validAnswer(request, { withdrawn: true }, { isGM: true })], [true, false, true], "a withdrawal, from the user's side");
  // The first valid answer in log order stands; a card with the right flags and the wrong author is passed over.
  const log = [
    { id: "a", answer: { defense: "evade" }, author: { ownsUser: true } },
    { id: "b", answer: { defense: "endure" }, author: { ownsTarget: true } },
    { id: "c", answer: { defense: "guard" }, author: { ownsTarget: true } },
    { id: "d", answer: { defense: "evade" }, author: { isGM: true } }
  ];
  same(standingAnswer(request, log), { id: "c", answer: { defense: "guard" } }, "the first VALID answer, never merely the first");
  same([standingAnswer(request, []), standingAnswer(request, null), standingAnswer(request, log.slice(0, 2))], [null, null, null], "no valid answer is none: nothing is ever chosen for the target");
  same(standingAnswer(request, [{ id: "w", answer: { withdrawn: true }, author: { ownsUser: true } }, ...log])?.id, "w", "a withdrawal that came first stands");
  // Where a request is.
  same([
    requestState({}),
    requestState({ answer: { defense: "guard" } }),
    requestState({ answer: { defense: "guard" }, rolled: true }),
    requestState({ answer: { withdrawn: true } }),
    requestState({ combatGone: true }),
    requestState({ answer: { defense: "guard" }, combatGone: true }),
    requestState({ rolled: true, combatGone: true })
  ], ["open", "answered", "rolled", "withdrawn", "lapsed", "answered", "rolled"], "open, answered, rolled, withdrawn, lapsed; an answer outlives its Combat, and a roll closes everything");
  same([...REQUEST_MODES], ["answer", "roll"], "the two requests");
});

check("check request: a request counts only from its user's side (the review of 0.34.0)", () => {
  const answer = { mode: "answer", defenses: ["evade", "guard"] };
  const roll = { mode: "roll", defenses: ["guard"] };
  same([
    validRequest(answer, { ownsUser: true }),
    validRequest(answer, { isGM: true }),
    validRequest(answer, {}),
    validRequest(answer, { ownsUser: false, userIsCharacter: true }),
    validRequest(roll, { isGM: true }),
    validRequest(roll, { ownsUser: true }),
    validRequest(roll, {})
  ], [true, true, false, false, true, true, false], "the GM, or an owner of the creature using the Maneuver; never somebody who owns neither");
  // The forged pair the review found: a player names an adversary as the user and their own
  // character as the target. They own the target and not the user, so it is no request.
  must(!validRequest(roll, { isGM: false, ownsUser: false }), "a player cannot post a request in an adversary's name");
  // A `roll` request is an adversary's alone: a character's Maneuver is rolled by its own player.
  same([validRequest(roll, { ownsUser: true, userIsCharacter: true }), validRequest(roll, { isGM: true, userIsCharacter: true })], [false, false], "no `roll` request names a character as the Maneuver's user");
  same([validRequest(null, { isGM: true }), validRequest({ mode: "nonsense" }, { isGM: true }), validRequest({}, { isGM: true })], [false, false, false], "a record with no mode the system knows is no request");
});

check("check request: the Defenses a target can use, and nobody asked when there is one (ruling 344)", () => {
  const grabbed = key => (key === "evade" ? "Grabbed" : null);
  same(usableDefenses(["evade", "guard"]), ["evade", "guard"], "both usable: the target is asked");
  same(usableDefenses(["evade", "guard"], grabbed), ["guard"], "Evade is unavailable: one is left, and nobody is asked");
  same(usableDefenses(["evade"], grabbed), ["evade"], "the one named stays the one read when it cannot be used; the read says so");
  same(usableDefenses(["evade", "evade", "nonsense", "guard"]), ["evade", "guard"], "named once each, and only Defenses");
  same([usableDefenses([]), usableDefenses(null)], [[], []], "none named is none");
});

check("check request: an adversary's Maneuver is read from the other side, against its typed number (rulings 340 and 341)", () => {
  same(["critSuccess", "success", "fail", "critFail", null, ""].map(userDegree), ["critFail", "fail", "success", "critSuccess", null, null], "the player's Critical Success is the Maneuver's Critical Failure");
  same([adversaryCheck(14), adversaryCheck(null), adversaryCheck(undefined), adversaryCheck(""), adversaryCheck("nonsense"), adversaryCheck("16")],
    [{ base: 14, threshold: 14, shift: 0 }, { base: 10, threshold: 10, shift: 0 }, { base: 10, threshold: 10, shift: 0 }, { base: 10, threshold: 10, shift: 0 }, { base: 10, threshold: 10, shift: 0 }, { base: 16, threshold: 16, shift: 0 }], "a typed number, and blank reads as 10");
  same([adversaryCheck(14, -2), adversaryCheck(null, -2), adversaryCheck(0, 3)], [{ base: 14, threshold: 12, shift: -2 }, { base: 10, threshold: 8, shift: -2 }, { base: 0, threshold: 3, shift: 3 }], "its Conditions move the number in effect, never the one typed");
  // The card kinds the render pass and the socket of nothing read: two words, never the same.
  must(CHECK_REQUEST !== CHECK_ANSWER, "a request and an answer are different cards");
});

/* -------------------------------------------- */
/*  Immunity to a trait (0.35.0)                */
/* -------------------------------------------- */

console.log("\nImmunity to a trait (0.35.0)");

/** The workbook's rows with Blinded's and Deafened's lines, as the Conditions sheet carries them. */
const immuneRows = () => [
  ...seedRows().map(r => (r.name === "Blinded") ? { ...r, rules: conditionCell("Blinded", "", "[EFFECT IMMUNE: TRAIT(Visual)]") } : r),
  { name: "Deafened", rules: conditionCell("Deafened", "", "[EFFECT IMMUNE: TRAIT(Auditory)]") }
];

check("immunity: a thing's traits are groups of alternatives (ruling 357)", () => {
  same(traitGroups(["Auditory or Visual", "Emotion", "Reach 5", "Visual OR Visual", "", null, 7]), [["auditory", "visual"], ["emotion"], ["reach"], ["visual"]], "one group for each trait written; `or` inside one is alternatives; only the first word is the key");
  same([traitGroups("Visual"), traitGroups(null), traitGroups([])], [[], [], []], "no list is no group");
  same(traitKeysOf(["Auditory or Visual", "Visual", "Emotion"]), ["auditory", "visual", "emotion"], "every key once, for the asking");
  const blind = new Map([["visual", { name: "Visual", by: "Blinded" }]]);
  const both = new Map([...blind, ["auditory", { name: "Auditory", by: "Deafened" }]]);
  // Calm Animal: Auditory and Visual, two traits. Immune to either is immune.
  same(coveredGroup(["Auditory", "Concentrate", "Visual"], blind), [{ trait: "visual", name: "Visual", by: "Blinded" }], "separate traits: one is enough");
  // Captivate's exact trait string: it works through either sense, so it takes both gone.
  const captivate = ["Auditory or Visual", "Emotion", "Mental"];
  same(coveredGroup(captivate, blind), null, "\"Auditory or Visual\": a Blinded creature that can hear is still Captivated");
  same(coveredGroup(captivate, both), [{ trait: "auditory", name: "Auditory", by: "Deafened" }, { trait: "visual", name: "Visual", by: "Blinded" }], "and one that is both is immune");
  same([coveredGroup(["Emotion"], both), coveredGroup([], both), coveredGroup(null, both), coveredGroup(["Visual"], new Map())], [null, null, null, null], "a thing with none of the traits, or no traits, is immune to nothing");
  same([coveredGroup(["Visual"], new Set(["visual"])), coveredGroup(["Visual"], ["visual"])], [[{ trait: "visual", name: "Visual", by: "" }], [{ trait: "visual", name: "Visual", by: "" }]], "a plain set of keys answers too");
  same([joinNames([]), joinNames(["A"]), joinNames(["A", "B"]), joinNames(["A", "B", "C"]), joinNames(["A", "A", " "])], ["", "A", "A and B", "A, B and C", "A"], "the names in a sentence");
  same(immunityWords(coveredGroup(captivate, both)), { traits: "Auditory and Visual", by: "Deafened and Blinded" }, "which traits, and what makes the creature immune");
});

check("immunity: a Blinded creature is immune to Visual and to nothing else, character and adversary (rulings 353 and 356)", () => {
  seeded(() => {
    const blinded = creature({ statuses: ["blinded"] });
    same(ruleTraitImmunity(blinded, ["Visual"]), { covered: [{ trait: "visual", name: "Visual", by: "Blinded" }], traits: "Visual", by: "Blinded" }, "immune to a thing with the Visual trait, and it says what makes it so");
    same([ruleTraitImmunity(blinded, ["Auditory"]), ruleTraitImmunity(blinded, ["Emotion", "Mental", "Reach 5"]), ruleTraitImmunity(blinded, []), ruleTraitImmunity(blinded, null), ruleTraitImmunity(null, ["Visual"])], [null, null, null, null, null], "and to nothing else");
    same(ruleTraitImmunity(blinded, ["Auditory", "Visual"])?.traits, "Visual", "Calm Animal, Auditory and Visual: immune by the one");
    same(ruleTraitImmunity(blinded, ["Auditory or Visual", "Emotion"]), null, "Captivate, \"Auditory or Visual\": not immune while it can hear");
    const both = creature({ statuses: ["blinded", "deafened"] });
    same([ruleTraitImmunity(both, ["Auditory or Visual", "Emotion"])?.traits, ruleTraitImmunity(both, ["Auditory or Visual", "Emotion"])?.by], ["Auditory and Visual", "Deafened and Blinded"], "Blinded and Deafened: immune to Captivate");
    same([ruleTraitImmunity(creature({ statuses: ["prone"] }), ["Visual"]), ruleTraitImmunity(creature(), ["Visual"])], [null, null], "a creature without the Condition is immune to nothing");
    // The hook answers only when it is asked about a trait, and only for the trait handed over.
    same(rulePreventers(blinded, { effect: TRAIT_IMMUNITY, threat: { traits: ["visual"] } }).map(p => [p.item.name, p.item.type, p.trait, p.name, p.reaction, p.mark]), [["Blinded", CONDITION_CARRIER_TYPE, "visual", "Visual", false, null]], "the carrier is the Condition, never a Reaction, with no mark to spend");
    same([rulePreventers(blinded, { effect: TRAIT_IMMUNITY }).length, rulePreventers(blinded, { effect: TRAIT_IMMUNITY, threat: { traits: ["auditory"] } }).length, rulePreventers(blinded, { effect: "prone" }).length, rulePreventers(blinded, { effect: "frightened", threat: { traits: ["visual"] } }).length], [0, 0, 0, 0], "no traits, another trait, or a Condition asked about: nothing");
    // An adversary is, to the rules engine, a creature with no ranks (the engine has no branch for
    // one, and its own Talents are unread): the Condition's line holds for it as for a character.
    const npc = creature({ statuses: ["blinded"], uuid: "Actor.bandit" });
    delete npc.system.proficiency;
    npc.system.rules = collectRules(npc);
    same(ruleTraitImmunity(npc, ["Visual"])?.by, "Blinded", "an adversary");
    // A Talent's own IMMUNE of a Condition is never an answer about a trait.
    const stubborn = talentWith("Stubborn Footing", "[EFFECT IMMUNE: prone; LIMIT: encounter]");
    same(ruleTraitImmunity(rulesActor([stubborn]), ["Prone", "Visual"]), null, "a Condition's line answers for no trait");
  }, immuneRows());
  // With no workbook's rows registered the built-in carries no line.
  same(ruleTraitImmunity(creature({ statuses: ["blinded"] }), ["Visual"]), null, "the line is the workbook's: with no rows, no immunity");
});

check("immunity: a Condition held against one creature alone is passed over for anybody else (ruling 359)", () => {
  seeded(() => {
    // Dazzled [X] counts as Blinded against the creature that put it on, and nobody else.
    const dazzled = creature({ statuses: ["dazzled"], appliedBy: { dazzled: "Actor.tess" } });
    must(/Blinded/.test(ruleTraitImmunity(dazzled, ["Visual"], { other: { uuid: "Actor.tess" } })?.by ?? ""), "immune to that creature's Visual effects");
    same([ruleTraitImmunity(dazzled, ["Visual"], { other: { uuid: "Actor.wren" } }), ruleTraitImmunity(dazzled, ["Visual"]), ruleTraitImmunity(dazzled, ["Visual"], { other: null })], [null, null, null], "and to nobody else's, nor when nobody is named");
    // Held outright, the other party does not matter.
    must(ruleTraitImmunity(creature({ statuses: ["blinded"] }), ["Visual"], { other: { uuid: "Actor.wren" } }) !== null, "a Condition held against everyone answers whoever asks");
  }, [...immuneRows(), { name: "Dazzled [X]", takes: "X", includes: ["Blinded against X"] }]);
});

/* -------------------------------------------- */
/*  Every roll, and the narrow word (0.36.0)    */
/* -------------------------------------------- */

console.log("\nEvery roll, and the narrow word (0.36.0)");

/** What counts on a roll: the hook's answer resolved, as every consumer resolves it. */
const counted = (actor, context) => resolveModifiers(ruleModifiers(actor, context).applied).total;
/** The asks a roll or a Threshold makes, by name. `stored` is the Defense pass's, `moment` the roll's on top of it. */
const ASKS = {
  "the sheet's Threshold": { kind: "defense", slug: "guard", item: null, staticOnly: true },
  "a Defense roll, on top of the Threshold": { kind: "defense", slug: "guard", item: null, momentOnly: true },
  "a Threshold read, on top of the Threshold": { kind: "defense", slug: "guard", item: null, momentOnly: true, read: true },
  "a Defense rolled as a check, on top of the Threshold": { kind: "check", slug: "endure", item: null, rank: "trained", momentOnly: true },
  "Initiative with Awareness, on top of the Threshold": { kind: "initiative", slug: "awareness", item: null, rank: "trained", momentOnly: true },
  "Initiative with Stealth": { kind: "initiative", slug: "stealth", item: null, rank: "trained" },
  "a Skill check": { kind: "check", slug: "stealth", item: null, rank: "trained" },
  "a Maneuver's check": { kind: "check", slug: "diplomacy", item: aidItem, rank: "trained" },
  "an attack": { kind: "attack", slug: "melee", item: null, rank: "trained" },
  "a Move": { kind: "move", slug: "", item: null }
};
const reachOf = actor => Object.fromEntries(Object.entries(ASKS).map(([name, ask]) => [name, counted(actor, ask)]));

check("0.36.0: a bare CHECK is every roll and Threshold, SKILL is the narrow scope, and each slip is told what to write (rulings 366 and 368)", () => {
  same([SCOPES.rolls.kinds, SCOPES.checks.kinds, SCOPES.checks.name, SCOPES.rolls.name], [["check", "initiative", "attack", "defense"], ["check", "initiative"], "Skill checks", "every roll and Threshold"], "the two scopes");
  same([scopeReaches("rolls", "defense"), scopeReaches("rolls", "attack"), scopeReaches("rolls", "move"), scopeReaches("checks", "attack"), scopeReaches("checks", "initiative"), scopeReaches("nothing", "check")], [true, true, false, false, true, false], "which rolls a scope reaches");
  same([EFFECT_TAGS.check, EFFECT_TAGS.skill, Object.keys(EFFECT_TAGS).find(t => EFFECT_TAGS[t] === "bonus")], ["bonus", "bonus", "check"], "SKILL is a tag of the bonus kind, and CHECK is still its first");
  same([bonusRule("[EFFECT CHECK: 1 situation]").to.slug, bonusRule("[EFFECT SKILL: 1 situation]").to.slug, bonusRule("[EFFECT SKILL: -2 condition; IF: RANK(roll = untrained)]").value], ["rolls", "checks", -2], "each tag's scope");
  same([summarize(bonusRule("[EFFECT CHECK: -2 condition]")), summarize(bonusRule("[EFFECT SKILL: 1 situation]"))], ["-2 Condition penalty to every roll and Threshold", "+1 Situation bonus to Skill checks"], "As read");
  // A rule stored before 0.36.0 says what it does, whatever name it was stored with.
  same(summarize({ kind: "bonus", value: 1, type: "situation", to: { name: "Checks", slug: "checks", type: "scope" } }), "+1 Situation bonus to Skill checks", "a stored rule is named as the scope is known now");
  must(/^SKILL takes no descriptor: to name a Constellation or a Maneuver write `CHECK: 1 situation, stealth`$/.test(bonusError("[EFFECT SKILL: 1 situation, stealth]", { resolve })), "SKILL with a target");
  for (const word of ["skill", "Skills", "skill checks"]) {
    must(/^for checks that are no attack and no Defense write the tag: `SKILL: 1 situation`$/.test(bonusError(`[EFFECT CHECK: 1 situation, ${word}]`, { resolve })), `"${word}" after CHECK is told the tag`);
  }
  for (const word of ["rolls", "checks", "attacks", "defenses", "initiative"]) {
    must(/is a scope word; CHECK takes a Constellation or a Maneuver, or no descriptor for every roll and Threshold \(SKILL, ATK, DEF and INIT are the narrower tags\)$/.test(bonusError(`[EFFECT CHECK: 1 situation, ${word}]`, { resolve })), `"${word}" as a target`);
  }
  must(/"rolls" is a scope word; GIVE names one Constellation/.test(bonusError("[EFFECT GIVE: 1 situation, rolls; IF: RESULT(success)]", { resolve, itemType: "action" })), "GIVE refuses the new scope word");
  must(/"rolls" is a scope word, and USE never means every check/.test(bonusError("[EFFECT USE: Presence, Origin, rolls]", { resolve })), "and USE");
  // On a Condition's row, with the Condition's own value.
  same(conditionCell("Dazed", "n", "[EFFECT SKILL: -N condition]").map(r => [r.to.slug, r.value, r.scale]), [["checks", -1, "N"]], "a Condition's row reads SKILL");
  must(/SKILL on a Condition's row does not take IF: RANK/.test(conditionRowError("[EFFECT SKILL: -1 condition; IF: RANK(Origin >= trained)]")), "and refuses on it what CHECK refuses");
});

check("0.36.0: an every-roll line counts once on each kind of roll and Threshold, and a SKILL line where a bare CHECK did before (rulings 366 and 369)", () => {
  const lucky = rulesActor([talentWith("Lucky", "[EFFECT CHECK: 1 situation]")]);
  same(reachOf(lucky), {
    "the sheet's Threshold": 1, "a Defense roll, on top of the Threshold": 0, "a Threshold read, on top of the Threshold": 0,
    "a Defense rolled as a check, on top of the Threshold": 0, "Initiative with Awareness, on top of the Threshold": 0,
    "Initiative with Stealth": 1, "a Skill check": 1, "a Maneuver's check": 1, "an attack": 1, "a Move": 0
  }, "every roll: once in the Threshold, and never again by a roll that rolls that Threshold");
  const narrow = { "the sheet's Threshold": 0, "a Defense roll, on top of the Threshold": 0, "a Threshold read, on top of the Threshold": 0,
    "a Defense rolled as a check, on top of the Threshold": 0, "Initiative with Awareness, on top of the Threshold": 0,
    "Initiative with Stealth": 1, "a Skill check": 1, "a Maneuver's check": 1, "an attack": 0, "a Move": 0 };
  same(reachOf(rulesActor([talentWith("Handy", "[EFFECT SKILL: 1 situation]")])), narrow, "SKILL: checks and an Initiative rolled with a Constellation, no attack and no Defense");
  // A rule STORED before 0.36.0 (a bare CHECK as it was read then) is the narrow scope still.
  const stored = { type: "talent", name: "Old Hand", id: "old1", system: { rules: [{ kind: "bonus", line: 1, text: "[EFFECT CHECK: 1 situation]", value: 1, type: "situation", to: { name: "Checks", slug: "checks", type: "scope" }, when: null, for: null, while: null, against: null, seen: false, limit: null, claim: null, marked: false }] } };
  same(reachOf(rulesActor([stored])), narrow, "a stored rule keeps the meaning it was read with");
  // A line that needs the moment is read where the moment is known, once.
  const fearless = rulesActor([talentWith("Fearless", "[EFFECT CHECK: 1 situation; IFT: TRAIT(Fear)]")]);
  const fear = { threat: "blow", melee: true, traits: ["fear"] };
  same([counted(fearless, { ...ASKS["the sheet's Threshold"] }), counted(fearless, { ...ASKS["a Defense roll, on top of the Threshold"], threat: fear }), counted(fearless, { ...ASKS["a Threshold read, on top of the Threshold"], threat: fear }), counted(fearless, { ...ASKS["a Defense roll, on top of the Threshold"] }), counted(fearless, { ...ASKS["a Skill check"] })],
    [0, 1, 1, 0, 0], "an every-roll line that asks about the attack: not in the sheet's number, once on the Defense that answers it");
  // Two Talents are two circumstances.
  same(counted(rulesActor([talentWith("Lucky", "[EFFECT CHECK: 1 situation]"), talentWith("Luckier", "[EFFECT CHECK: 2 situation]")]), ASKS["an attack"]), 3, "two carriers both count");
});

check("0.36.0: one Talent or Condition counts once on a roll, its strongest bonus and its strongest penalty (ruling 367)", () => {
  const both = (cell) => rulesActor([talentWith("Twofold", cell)]);
  const on = (actor, ...names) => names.map(n => counted(actor, ASKS[n]));
  same(on(both("[EFFECT CHECK: 1 situation]\n[EFFECT DEF: 2 situation]"), "the sheet's Threshold", "a Skill check", "an attack"), [2, 1, 1], "CHECK beside DEF: Defenses take the stronger, the rest the CHECK");
  same(on(both("[EFFECT CHECK: 2 situation]\n[EFFECT ATK: 1 situation]"), "an attack", "a Skill check"), [2, 2], "CHECK beside ATK");
  same(on(both("[EFFECT CHECK: 1 situation]\n[EFFECT INIT: 3 situation]"), "Initiative with Stealth", "a Skill check"), [3, 1], "CHECK beside INIT");
  same(on(both("[EFFECT CHECK: 1 situation]\n[EFFECT SKILL: 2 situation]"), "a Skill check", "an attack"), [2, 1], "CHECK beside SKILL");
  same(on(both("[EFFECT CHECK: 1 situation]\n[EFFECT CHECK: 3 situation, stealth]"), "a Skill check", "an attack"), [3, 1], "CHECK beside a line to one Constellation");
  same(on(both("[EFFECT CHECK: -1 condition]\n[EFFECT DEF: 2 situation, guard]"), "the sheet's Threshold", "a Skill check"), [1, -1], "a bonus and a penalty of one carrier both stand");
  same(on(both("[EFFECT DEF: 1 situation]\n[EFFECT DEF: 2 situation, guard]"), "the sheet's Threshold"), [2], "every Defense beside one of them: the stronger, where both added through 0.35.1");
  // Awareness Initiative: the every-roll line is in the Threshold, the INIT line comes at the roll,
  // and the two are one carrier's, so the roll takes the stronger of them.
  const awarenessInitiative = cell => {
    const actor = both(cell);
    return resolveModifiers([
      ...ruleModifiers(actor, { kind: "defense", slug: "awareness", item: null, staticOnly: true }).applied,
      ...ruleModifiers(actor, { kind: "initiative", slug: "awareness", item: null, rank: "trained", momentOnly: true }).applied
    ]).total;
  };
  same([awarenessInitiative("[EFFECT CHECK: 1 situation]"), awarenessInitiative("[EFFECT CHECK: 1 situation]\n[EFFECT INIT: 3 situation]"), awarenessInitiative("[EFFECT INIT: 3 situation]"), awarenessInitiative("[EFFECT SKILL: 1 situation]")], [1, 3, 3, 0], "Initiative with Awareness: once, the stronger of the two");
  // A claim of the moment beside a standing line of the same Talent, on a Defense: stored and moment are resolved together.
  const mixed = both("[EFFECT DEF: 1 situation]\n[EFFECT CHECK: 2 situation; IFT: TRAIT(Fear)]");
  same(resolveModifiers([
    ...ruleModifiers(mixed, { kind: "defense", slug: "guard", item: null, staticOnly: true }).applied,
    ...ruleModifiers(mixed, { kind: "defense", slug: "guard", item: null, momentOnly: true, threat: { threat: "blow", melee: true, traits: ["fear"] } }).applied
  ]).total, 2, "a standing line and a moment line of one Talent on one Defense: the stronger");
});

check("0.36.0: Frightened gives the same numbers as three stored lines, as one line, and as three lines rebuilt, for a character and for an adversary", () => {
  const threeNow = conditionCell("Frightened", "n", "[EFFECT DEF: -N condition]\n[EFFECT CHECK: -N condition]\n[EFFECT ATK: -N condition]");
  // As conditions.json holds the row through 0.35.1: the CHECK line stored as the narrow scope.
  const threeStored = threeNow.map(r => (r.to.slug === "rolls") ? { ...r, to: { name: "Checks", slug: "checks", type: "scope" } } : r);
  const oneLine = conditionCell("Frightened", "n", "[EFFECT CHECK: -N condition]");
  const numbers = rules => seeded(() => {
    const afraid = creature({ statuses: ["frightened"], values: { frightened: 2 } });
    const npcInitiative = resolveModifiers([
      ...conditionModifiers(afraid, { kind: "defense", slug: "awareness", item: null, staticOnly: true }),
      ...conditionModifiers(afraid, { kind: "initiative", slug: "awareness", item: null, momentOnly: true })
    ]).total;
    return {
      ...Object.fromEntries(["evade", "guard", "endure", "awareness"].map(slug => [slug, counted(afraid, { kind: "defense", slug, item: null, staticOnly: true })])),
      "Defense roll": counted(afraid, { kind: "defense", slug: "guard", item: null, momentOnly: true }),
      attack: counted(afraid, { kind: "attack", slug: "melee", item: null }),
      check: counted(afraid, { kind: "check", slug: "stealth", item: null }),
      initiative: counted(afraid, { kind: "initiative", slug: "stealth", item: null }),
      "adversary Threshold": resolveModifiers(conditionModifiers(afraid, { kind: "defense", slug: "guard", item: null, staticOnly: true })).total,
      "adversary attack": resolveModifiers(conditionModifiers(afraid, { kind: "attack", slug: "", item: null, staticOnly: true })).total,
      "adversary check": resolveModifiers(conditionModifiers(afraid, { kind: "check", slug: "athletics", item: null })).total,
      "adversary Initiative": npcInitiative
    };
  }, seedRows().map(r => (r.name === "Frightened N") ? { ...r, rules } : r));
  const want = { evade: -2, guard: -2, endure: -2, awareness: -2, "Defense roll": 0, attack: -2, check: -2, initiative: -2, "adversary Threshold": -2, "adversary attack": -2, "adversary check": -2, "adversary Initiative": -2 };
  same(numbers(threeStored), want, "the three lines as stored through 0.35.1");
  same(numbers(oneLine), want, "the one line");
  same(numbers(threeNow), want, "the three lines read again unchanged: each roll takes -N once");
  // What an adversary's sheet lists beside a number is what counted.
  seeded(() => {
    const afraid = creature({ statuses: ["frightened"], values: { frightened: 2 } });
    same(lines(resolveModifiers(conditionModifiers(afraid, { kind: "defense", slug: "guard", item: null, staticOnly: true })).applied), [["Frightened", -2, "condition"]], "one line of hint, not one for each line of the row");
  }, seedRows().map(r => (r.name === "Frightened N") ? { ...r, rules: threeNow } : r));
});

check("0.36.0: a claim on an every-roll line is offered on every kind of roll, and a Threshold read applies it only when armed (ruling 371)", () => {
  const talent = { ...talentWith("Wide Claim", "[EFFECT CHECK: 2 condition; IF: CLAIM(when it suits)]"), id: "wide1" };
  const actor = rulesActor([talent]);
  const offers = context => ruleModifiers(actor, context).offered.map(o => [o.value, o.ticked === true]);
  same([offers(ASKS["a Skill check"]), offers(ASKS["an attack"]), offers(ASKS["a Defense roll, on top of the Threshold"]), offers(ASKS["Initiative with Stealth"]), offers(ASKS["Initiative with Awareness, on top of the Threshold"])],
    [[[2, false]], [[2, false]], [[2, false]], [[2, false]], [[2, false]]], "offered unticked on a check, an attack, a Defense roll and an Initiative");
  same([ruleModifiers(actor, ASKS["the sheet's Threshold"]).applied, ruleModifiers(actor, ASKS["a Threshold read, on top of the Threshold"]).applied], [[], []], "never in the sheet's number, and a Threshold read leaves an unarmed claim alone");
  const armed = rulesActor([talent]);
  armed.flags = { starwrought: { rules: { armed: { wide1: true } } } };
  const read = ruleModifiers(armed, ASKS["a Threshold read, on top of the Threshold"]);
  same([read.applied.map(m => m.value), read.marks], [[2], [{ key: "wide1", per: "claim" }]], "armed: a foe's Threshold read applies it, with the mark that spends it");
  // The narrow word keeps a claim off attacks, as a bare CHECK did through 0.35.1.
  const narrow = rulesActor([{ ...talentWith("Contract Literate", "[EFFECT SKILL: 2 condition; IF: CLAIM(noticing hidden clauses)]"), id: "lit1" }]);
  same([ruleModifiers(narrow, ASKS["a Skill check"]).offered.length, ruleModifiers(narrow, ASKS["an attack"]).offered.length, ruleModifiers(narrow, ASKS["a Defense roll, on top of the Threshold"]).offered.length, ruleModifiers(narrow, ASKS["a Threshold read, on top of the Threshold"]).applied.length],
    [1, 0, 0, 0], "a SKILL claim: on a check, never on an attack, a Defense roll or a Threshold read");
});

check("0.36.0: a one-roll effect is used up only by a roll its line reached (the Defense pass is asked as it asked)", () => {
  const rowActor = text => {
    const parsed = parseAutomation(text, { resolve, itemName: "Row", itemType: "effect" });
    must(parsed.errors.length === 0, `"${text}" should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
    const actor = { items: [], system: { effects: [{ id: "fx36", label: "Row", text, duration: "roll", rules: parsed.rules }] } };
    actor.system.proficiency = () => ({ rank: "trained" });
    actor.system.rules = collectRules(actor);
    return actor;
  };
  const spent = [{ key: "fx36", per: "effect" }];
  const wind = { kind: "check", slug: "endure", item: null, rank: "trained", momentOnly: true };
  const skill = ruleModifiers(rowActor("SKILL: 1 situation"), wind);
  same([skill.applied, skill.marks], [[], []], "a one-roll bonus to Skill checks is not used up by a Wind roll, which never held it (it was through 0.35.1)");
  same(ruleModifiers(rowActor("SKILL: 1 situation"), { kind: "check", slug: "stealth", item: null, rank: "trained" }).marks, spent, "and is by a Skill check");
  same(ruleModifiers(rowActor("CHECK: 1 situation"), wind).marks, spent, "a one-roll bonus to every roll IS used up by the Wind roll: the Defense's own number held it");
  same(ruleModifiers(rowActor("DEF: 1 situation, endure"), wind).marks, spent, "as a one-roll bonus to that Defense is");
  same(ruleModifiers(rowActor("DEF: 1 situation, guard"), wind).marks, [], "and one to another Defense is not");
  same(ruleModifiers(rowActor("INIT: 1 situation"), { kind: "initiative", slug: "awareness", item: null, rank: "trained", momentOnly: true }).marks, spent, "an INIT line on an Initiative rolled with Awareness, as before");
});

check("0.36.0: the build says which lines of a row meet on a roll, and stays quiet for lines that cannot", () => {
  const meets = cell => overlappingLines(conditionCell("Row", "n", cell)).map(m => `${m.a}+${m.b}: ${m.what}`);
  same(meets("[EFFECT DEF: -N condition]\n[EFFECT CHECK: -N condition]\n[EFFECT ATK: -N condition]"), ["1+2: Defenses", "2+3: attacks"], "Frightened as it stood");
  same(meets("[EFFECT CHECK: -N condition]"), [], "one line");
  same(meets("[EFFECT DEF: -N condition]\n[EFFECT ATK: -N condition]"), [], "Fatigued: two lines that never meet");
  same(meets("[EFFECT ATK: -2 situation]\n[EFFECT DEF: 2 situation, evade; IFT: RANGED]"), [], "Prone: opposite signs, and different rolls");
  same(meets("[EFFECT DEF: -2 situation, evade]\n[EFFECT DEF: -2 situation, guard]"), [], "Off-Guard: two Defenses");
  same(meets("[EFFECT CHECK: -1 condition]\n[EFFECT DEF: 2 situation, guard]"), [], "a penalty and a bonus both stand, so nothing is said");
  same(meets("[EFFECT SKILL: -1 condition]\n[EFFECT INIT: -1 condition]"), ["1+2: Initiative rolled with a Skill"], "SKILL beside INIT: only where the Initiative is rolled with a Skill");
  // The pairs the first cut missed (the review): a scope beside a line to one Constellation or
  // Maneuver, and every Defense or Awareness beside INIT on the default Initiative.
  same(meets("[EFFECT CHECK: -1 condition]\n[EFFECT CHECK: -2 condition, stealth]"), ["1+2: checks with Stealth"], "CHECK beside a line to one Constellation");
  same(meets("[EFFECT SKILL: -1 condition]\n[EFFECT CHECK: -2 condition, stealth]"), ["1+2: checks with Stealth"], "SKILL beside one");
  same(meets("[EFFECT ATK: -1 condition]\n[EFFECT CHECK: -2 condition, stealth]"), ["1+2: attacks made with Stealth"], "ATK beside one");
  same(meets("[EFFECT INIT: -1 condition]\n[EFFECT CHECK: -2 condition, stealth]"), ["1+2: Initiative rolled with Stealth"], "INIT beside one");
  same(meets("[EFFECT DEF: -1 condition]\n[EFFECT CHECK: -2 condition, stealth]"), [], "every Defense and a Skill never meet");
  same(meets("[EFFECT CHECK: -1 condition]\n[EFFECT CHECK: -2 condition, aid]"), ["1+2: checks to Aid"], "CHECK beside a line to a Maneuver");
  same(meets("[EFFECT ATK: -1 condition]\n[EFFECT CHECK: -2 condition, aid]"), [], "an attack is never a Maneuver's check");
  same(meets("[EFFECT DEF: -1 condition]\n[EFFECT INIT: -1 condition]"), ["1+2: Initiative rolled with Awareness"], "every Defense beside INIT: the default Initiative");
  same(meets("[EFFECT DEF: -1 condition, awareness]\n[EFFECT INIT: -1 condition]"), ["1+2: Initiative rolled with Awareness"], "Awareness beside INIT");
  same(meets("[EFFECT DEF: -1 condition, evade]\n[EFFECT INIT: -1 condition]"), [], "another Defense beside INIT");
  same(meets("[EFFECT CHECK: -1 condition, stealth]\n[EFFECT CHECK: -1 condition, aid]"), [], "two named targets never meet");
  // `covers`: one of the two is a bare CHECK, which reaches everything the other does.
  const covers = cell => overlappingLines(conditionCell("Row", "n", cell)).map(m => m.covers);
  same([covers("[EFFECT DEF: -N condition]\n[EFFECT CHECK: -N condition]"), covers("[EFFECT SKILL: -1 condition]\n[EFFECT INIT: -1 condition]"), covers("[EFFECT DEF: -1 condition]\n[EFFECT INIT: -1 condition]")], [[true], [false], [false]], "which pairs a bare CHECK covers");
  same(meets("[EFFECT CHECK: -1 condition]\n[EFFECT SKILL: -2 condition]"), ["1+2: checks, Initiative"], "CHECK beside SKILL");
  same(meets("[EFFECT DEF: -1 condition]\n[EFFECT DEF: -1 condition]"), [], "the same target twice was always one");
  same([overlappingLines(null), overlappingLines([])], [[], []], "no rules, no pairs");
});

check("0.36.0, the review: a message says the value as written, a lost comma is refused, and a line that asks about the roll's rank is warned of", () => {
  // `-N` through the refusals that say what to write: the letter, never the sign it is stored as.
  must(/write `CHECK: -N condition, stealth`$/.test(conditionRowError("[EFFECT SKILL: -N condition, stealth]", "n")), "SKILL with a target, written with -N");
  must(/write the tag: `SKILL: -N condition`$/.test(conditionRowError("[EFFECT CHECK: -N condition, skill]", "n")), "CHECK, skill, written with -N");
  must(/^ATK takes no descriptor: `ATK: -N condition`$/.test(conditionRowError("[EFFECT ATK: -N condition, melee]", "n")), "ATK with a descriptor, written with -N");
  must(/^DEF takes one descriptor, a Defense, not 2: `DEF: N condition, guard`$/.test(conditionRowError("[EFFECT DEF: N condition, guard, evade]", "n")), "and a positive N");
  // A comma with nothing after it is a target that was deleted: refused, never read as every roll.
  for (const cell of ["[EFFECT CHECK: 1 situation, ]", "[EFFECT CHECK: 1 situation,]", "[EFFECT DEF: 1 situation, ; IFT: BLOW]", "[EFFECT CHECK: 1 situation, , stealth]"]) {
    must(/a comma with nothing after it; name the target after the comma, or take the comma out$/.test(bonusError(cell, { resolve })), `"${cell}" is refused`);
  }
  same(bonusRule("[EFFECT CHECK: 1 situation, stealth]", { resolve }).to.slug, "stealth", "a target after its comma still reads");
  // The shape a tag is told is its own: only CHECK, DEF and GIVE take a descriptor.
  must(/^SKILL is written `SKILL: <value> <type>`, as in `SKILL: 1 condition`: a signed whole number first, not "situation"$/.test(bonusError("[EFFECT SKILL: situation]", { resolve })), "SKILL's shape has no descriptor");
  must(/^DEF is written `DEF: <value> <type>, <descriptor>`, as in `DEF: 1 condition, guard`/.test(bonusError("[EFFECT DEF: situation]", { resolve })), "DEF's has");
  // A line that reaches Defenses and asks about the roll's own rank: it reads, with a warning.
  const warned = cell => parseAutomation(cell, { resolve, itemName: "Jack", itemType: "talent" });
  const wide = warned("[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]");
  same([wide.errors, wide.rules.length, wide.warnings.length], [[], 1, 1], "a bare CHECK with a roll-rank condition reads, with one warning");
  must(/^CHECK with IF: RANK\(roll \.\.\.\) is not read on a Defense yet: .* For checks alone write SKILL$/.test(wide.warnings[0].message), `the warning: ${wide.warnings[0].message}`);
  same(warned("[EFFECT SKILL: 1 situation; IF: RANK(roll = untrained)]").warnings, [], "SKILL with the same condition: nothing to say");
  same(warned("[EFFECT CHECK: 1 situation, stealth; IF: RANK(roll = untrained)]").warnings, [], "nor a line to one Constellation");
  same(warned("[EFFECT ATK: 1 situation; IF: RANK(roll >= trained)]").warnings, [], "nor ATK");
  must(/^DEF with IF: RANK\(roll \.\.\.\) is not read on a Defense yet/.test(warned("[EFFECT DEF: 1 situation, guard; IF: RANK(roll >= trained)]").warnings[0]?.message ?? ""), "DEF with it is warned too");
  same(warned("[EFFECT CHECK: 1 situation; IF: RANK(Origin >= trained)]").warnings, [], "a rank of the owner's is no roll's rank");
  // What such a line does: checks, attacks, an Initiative rolled with a Skill, and no Defense's number.
  const jack = rulesActor([{ ...talentWith("Wide Jack", "[EFFECT CHECK: 1 situation; IF: RANK(roll = untrained)]"), id: "wj1" }]);
  const at = (ask, rank) => counted(jack, { ...ASKS[ask], rank });
  same([at("a Skill check", "untrained"), at("a Skill check", "trained"), at("an attack", "untrained"), at("Initiative with Stealth", "untrained"), counted(jack, ASKS["the sheet's Threshold"]), at("a Defense rolled as a check, on top of the Threshold", "untrained"), at("Initiative with Awareness, on top of the Threshold", "untrained")],
    [1, 0, 1, 1, 0, 0, 0], "where a roll-rank line on a bare CHECK counts");
});

check("0.36.0, the review: a Defense rolled as a check takes an every-roll line once, and the second look has no roll's rank", () => {
  // The Wind roll's sum as the roll makes it: the Defense's stored lines and what the moment adds.
  const wind = actor => resolveModifiers([
    ...ruleModifiers(actor, { kind: "defense", slug: "endure", item: null, staticOnly: true }).applied,
    ...ruleModifiers(actor, ASKS["a Defense rolled as a check, on top of the Threshold"]).applied
  ]).total;
  same([wind(rulesActor([talentWith("Lucky", "[EFFECT CHECK: 1 situation]")])), wind(rulesActor([talentWith("Handy", "[EFFECT SKILL: 1 situation]")])), wind(rulesActor([talentWith("Twofold", "[EFFECT CHECK: 1 situation]\n[EFFECT DEF: 2 situation, endure]")]))],
    [1, 0, 2], "once for a bare CHECK, nothing for SKILL, the stronger of one Talent's two");
  // A one-roll row whose line asks about the roll's rank is not used up by a roll that never
  // applied it (through the review the second look handed this roll's rank on, and it answered).
  const rowActor = text => {
    const parsed = parseAutomation(text, { resolve, itemName: "Row", itemType: "effect" });
    must(parsed.errors.length === 0, `"${text}" should parse: ${parsed.errors.map(e => e.message).join("; ")}`);
    const actor = { items: [], system: { effects: [{ id: "fx36r", label: "Row", text, duration: "roll", rules: parsed.rules }] } };
    actor.system.proficiency = () => ({ rank: "untrained" });
    actor.system.rules = collectRules(actor);
    return actor;
  };
  const ranked = "CHECK: 1 situation; IF: RANK(roll = untrained)";
  for (const [name, ask] of [
    ["a Wind roll", { kind: "check", slug: "endure", item: null, rank: "untrained", momentOnly: true }],
    ["a Defense roll", { kind: "defense", slug: "guard", item: null, rank: "untrained", momentOnly: true }],
    ["a Threshold read", { kind: "defense", slug: "guard", item: null, rank: "untrained", momentOnly: true, read: true }],
    ["the default Initiative", { kind: "initiative", slug: "awareness", item: null, rank: "untrained", momentOnly: true }]
  ]) {
    const got = ruleModifiers(rowActor(ranked), ask);
    same([got.applied, got.marks], [[], []], `${name} neither applies the line nor uses the row up`);
  }
  same(ruleModifiers(rowActor(ranked), { kind: "check", slug: "stealth", item: null, rank: "untrained" }).marks, [{ key: "fx36r", per: "effect" }], "a Skill check at that rank does both");
});

check("0.36.0: ten minutes of uninterrupted rest lower Fatigued by 1, and never below nothing (rulings 372 and 374)", () => {
  same([FATIGUED_REST_STEP, FATIGUED_MAX], [1, 3], "one step for ten minutes, to a ceiling of 3");
  same([3, 2, 1, 0].map(value => fatiguedAfterRest(value)), [2, 1, 0, 0], "one stretch: 3 to 2, 2 to 1, 1 ends, and nothing stays nothing");
  same([fatiguedAfterRest(3, 2), fatiguedAfterRest(3, 3), fatiguedAfterRest(3, 9), fatiguedAfterRest(2, 0)], [1, 0, 0, 2], "several stretches, never below 0, and no rest changes nothing");
  // Three presses of the button are thirty minutes: the value after each.
  let value = FATIGUED_MAX;
  const steps = [];
  while (value > 0) { value = fatiguedAfterRest(value); steps.push(value); }
  same(steps, [2, 1, 0], "Fatigued 3 takes three stretches to end");
  // What a hand may have left in the value: read as a whole number, and never raised by rest.
  same([fatiguedAfterRest(undefined), fatiguedAfterRest(null), fatiguedAfterRest("2"), fatiguedAfterRest(2.9), fatiguedAfterRest(-1), fatiguedAfterRest(2, -1), fatiguedAfterRest(2, "x")], [0, 0, 1, 1, 0, 2, 2], "odd values are read safely");
});

/* -------------------------------------------- */

console.log("");
if (failures.length) {
  console.error(`rules framework: ${failures.length} of ${passed + failures.length} checks FAILED:`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
console.log(`rules framework: ${passed} checks passed`);
