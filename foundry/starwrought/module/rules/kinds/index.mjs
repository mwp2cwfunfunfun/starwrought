/**
 * The registry of rule kinds (0.9.0; rulings 118 to 120).
 *
 * An Automation cell is one rule per line, `kind: arguments`, and the word before the colon names
 * a kind. A kind is one file in this folder exporting a definition with the contract set out in
 * ../README.md (its id, its aliases, `parse`, `summary` and `hooks`), registered here through
 * `registerKind`. The grammar (../grammar.mjs) consults this registry through `kindOf` and knows
 * no kind's syntax; the engine (../engine.mjs) indexes an Actor's rules by the ids registered
 * here; the Item sheet prints each kind's `summary`. That is the whole of what the framework knows
 * about a kind, and it is the point: the aura that will serve Torchbearer serves every aura in the
 * book without this file learning anything about auras (ruling 119).
 *
 * THE KINDS: `bonus` (./bonus.mjs; 0.10.0; rulings 121 to 124), Mike's first, for Humanity's
 * "+1 Condition bonus on checks to Aid", rewritten to the operator grammar in 0.13.0; `grant`
 * (./grant.mjs; 0.13.0), the Grants column's successor; `aura` (./aura.mjs; 0.13.0), the Aura
 * column's successor and the ring Mike named first. Each is registered at the foot of this file
 * with two lines, and the one engine hook point, `modifiers`, was defined with `bonus`
 * (../engine.mjs, `ruleModifiers`). The framework was built empty on purpose (Mike, 2026-10-03:
 * "do NOT survey the talents yet or build ANY of the automation hooks. just build the framework. we
 * will build automation syntax hooks one at a time"), and the kinds still come one at a time, with
 * him, any new hook point defined with the kind that needs it and not before; the grammar they
 * share is AUTOMATION_GRAMMAR.md. A non-comment line in a cell that names no registered
 * kind is an unknown rule kind, which the build refuses (naming the Constellation, the Talent and
 * the line) and the Item sheet marks in red. `assets/test_rules.mjs` asserts the list of shipped
 * kinds, so a kind registered here without its test fails the pipeline.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. `assets/build_foundry.mjs` imports the
 * grammar, and through it this registry, from plain Node, so the build and the client parse a cell
 * identically (ruling 120); a `game.` or `CONFIG.` reference outside a function body breaks the
 * content build. A kind file is held to the same rule, because this index imports it.
 */

/**
 * The shape of a kind's word, id and alias alike: lower-case letters and hyphens, starting with
 * a letter. The grammar lower-cases the word it reads from a cell before looking it up, so a
 * designer may write `Aura:`; the id itself is always written in lower case.
 */
export const KIND_WORD = /^[a-z][a-z-]*$/;

/**
 * @typedef {object} RuleKind
 * @property {string} id                                         The word before the colon.
 * @property {string[]} aliases                                  Other words accepted before the colon.
 * @property {(args: string, context: object) => (object|void)} parse   The text after the colon, trimmed, to the rule's data.
 * @property {(rule: object) => string} summary                  One short line for the Item sheet.
 * @property {Object<string, Function>} hooks                    The engine hook points the kind speaks at (`modifiers` since 0.10.0; see ../engine.mjs).
 */

/**
 * Every registered kind, by id. Aliases resolve through `kindOf`, never by reading this Map, so a
 * lookup here by alias missing is not a bug in the caller. Exported so the build and the sheet can
 * count the kinds; write to it only through `registerKind`.
 * @type {Map<string, RuleKind>}
 */
export const KINDS = new Map();

/** Alias to id, so an alias is as taken as an id and resolves in one step. */
const ALIASES = new Map();

/* -------------------------------------------- */

/**
 * Register a kind. The checks are the contract, enforced: a definition missing `id`, `parse` or
 * `summary`, or whose id or alias is already taken, is refused with a plain Error, which is what a
 * developer wants at load (a broken kind should stop the system, not parse every cell that names
 * it into silence). A refusal is never a cell's fault, so the messages are about the file.
 * @param {RuleKind} def
 * @returns {RuleKind}  The registered definition, aliases and hooks filled in.
 */
export function registerKind(def) {
  if (!def || (typeof def !== "object")) throw new Error("registerKind: a kind is an object with id, parse and summary.");
  const id = def.id;
  if ((typeof id !== "string") || !KIND_WORD.test(id)) {
    throw new Error(`registerKind: a kind's id is lower-case letters and hyphens, starting with a letter; got ${JSON.stringify(id)}.`);
  }
  if (typeof def.parse !== "function") throw new Error(`registerKind: the "${id}" kind has no parse(args, context) function.`);
  if (typeof def.summary !== "function") throw new Error(`registerKind: the "${id}" kind has no summary(rule) function.`);

  const aliases = def.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.some(a => (typeof a !== "string") || !KIND_WORD.test(a))) {
    throw new Error(`registerKind: the "${id}" kind's aliases must be an array of kind words (lower-case letters and hyphens).`);
  }
  if (aliases.includes(id)) throw new Error(`registerKind: the "${id}" kind lists its own id as an alias.`);

  const hooks = def.hooks ?? {};
  if (!hooks || (typeof hooks !== "object") || Array.isArray(hooks)) {
    throw new Error(`registerKind: the "${id}" kind's hooks must be an object of hook point to function.`);
  }
  for (const [point, fn] of Object.entries(hooks)) {
    if (typeof fn !== "function") throw new Error(`registerKind: the "${id}" kind's hook "${point}" is not a function.`);
  }

  // Taken means taken as either an id or an alias: two kinds answering to one word would make a
  // cell mean two things.
  for (const word of [id, ...aliases]) {
    const holder = KINDS.has(word) ? word : ALIASES.get(word);
    if (holder) throw new Error(`registerKind: the word "${word}" is already taken by the "${holder}" kind.`);
  }
  if (new Set(aliases).size !== aliases.length) throw new Error(`registerKind: the "${id}" kind repeats an alias.`);

  const kind = { ...def, id, aliases: [...aliases], hooks };
  KINDS.set(id, kind);
  for (const alias of aliases) ALIASES.set(alias, id);
  return kind;
}

/**
 * The kind a word names, by id or alias, case and surrounding space ignored; `undefined` when no
 * kind answers to it. The grammar's only question of the registry.
 * @param {string} word
 * @returns {RuleKind|undefined}
 */
export function kindOf(word) {
  if (typeof word !== "string") return undefined;
  const key = word.trim().toLowerCase();
  if (!key) return undefined;
  return KINDS.get(key) ?? KINDS.get(ALIASES.get(key));
}

/**
 * The registered ids, sorted, for messages ("known kinds: a, b") and the self-test's assertion
 * that nothing ships unannounced. Aliases are not listed: a message names the canonical word.
 * @returns {string[]}
 */
export function knownKinds() {
  return [...KINDS.keys()].sort();
}

/* -------------------------------------------- */
/*  The kinds                                   */
/* -------------------------------------------- */

// One kind at a time, with Mike (ruling 119). Each is two lines here, the import and the
// registration, and its id in SHIPPED_KINDS in `assets/test_rules.mjs`, or the pipeline fails at
// test_rules. The imports sit at the foot so the list of kinds reads as one block; an ES import
// is hoisted wherever it is written, and the circle (a kind file imports the grammar, which
// imports this file) is harmless because a kind uses its imports only inside `parse`, `summary`
// and its hooks, never at module scope (../README.md).

import bonus from "./bonus.mjs";
registerKind(bonus);

// 0.13.0: the Grants column's successor, the Aura column's successor, and the first triggered kind.
import grant from "./grant.mjs";
registerKind(grant);
import aura from "./aura.mjs";
registerKind(aura);
