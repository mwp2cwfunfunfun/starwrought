/**
 * What a Maneuver needs before it can be used, and so whether the Maneuvers tab lists it now
 * (0.28.0; rulings 281 to 289). Mike, 2026-11-15, with a screenshot of the tab: "Many actions that
 * should unavailable based on the situation are there. I would like to only show Maneuvers that
 * the system detects are applicable ... if you are not Prone or Supine, you cannot Stand. If you
 * have no Spells, you cannot Cast. If nobody is within your reach, you cannot Grapple."
 *
 * A Maneuver's Requirements are prose, which nothing can check; so the conditions are written on
 * the Maneuver's own row, in the Automation cell, as `[REQUIRES ...]` blocks (the `requires` kind,
 * ./kinds/requires.mjs, reads them with `readRequires` below):
 *
 *   [REQUIRES prone or supine]                                     Stand, Kip Up
 *   [REQUIRES free hand or weapon grapple][REQUIRES creature in reach]  Grapple
 *   [REQUIRES grabbed or restrained]                               Escape
 *   [REQUIRES not prone]                                           Drop Prone
 *
 * Every block on a row must hold; inside one block `or` gives alternatives; `not` turns a word
 * round. The words (REQUIRE_WORDS, for the message that lists them):
 *
 *   <Condition>               the character has the Condition (prone, grabbed, hidden, controlling)
 *   supine                    accepted, and never true until Supine is built
 *   bind                      in a Bind, of any kind
 *   bind, <state>             in a Bind in that state: neutral, controlling, controlled (0.31.0)
 *   effect <Name>             the character has a named Effect (0.31.0)
 *   spell                     owns a spell Talent
 *   shield, shield raised     a shield in hand; and it is Raised
 *   rigid                     a rigid implement in hand
 *   free hand, holding        a hand is free (an estimate); anything is in hand
 *   weapon, melee weapon, ranged weapon, weapon <trait>
 *   weapon loaded, ranged weapon loaded, weapon unloaded   (0.29.0: ready to shoot; to reload)
 *   foe | ally | creature, then adjacent | in reach | in sight | within <feet>
 *   ... with <Condition>, ... with effect <Name>   and that creature has it (0.31.0)
 *   encounter                 a fighter in a running encounter
 *
 * EFFECTS-BASED (0.31.0; rulings 305 to 310; Mike, 2026-11-17: "REQUIRES should just look for a
 * string in that Effects list"). A Condition's name has always been looked up in the character's
 * statuses, and the Bind, Preparing, Spent, Wounded and Dying are Conditions, so most of the list
 * was already read here. Three forms were missing. `effect <Name>` reads a named Effect, anything
 * on the creature that is no Condition (./effect-list.mjs): the word in front is Mike's choice,
 * so that a bare word stays a Condition or one of the words above and a typo is still an error.
 * `bind, neutral` (his example; the comma may be left out) reads the Bind's own record, where
 * `bound`, `controlling` and `controlled` read the Conditions that mirror it. And `with` asks
 * about the creature that is near: `creature adjacent with dying` is Stabilize's.
 *
 * `in sight` (0.29.0; Mike: "I can foresee many situations ... 'if you can see an ally' or 'if you
 * can see an enemy'") is sight alone, at any distance. The list of who is near already holds only
 * the tokens the character can see, so the word asks whether one of the right kind is in it.
 *
 * THREE ANSWERS, NOT TWO. A word is true, false, or cannot be told (null): the character's token
 * is not on the scene, a hand the system cannot be sure of, a fact the caller did not give. A block
 * FAILS only when every alternative is known false, so the tab hides a row only when the system
 * knows it does not apply (Mike's "that the system detects"); `not` of "cannot tell" is still
 * "cannot tell".
 *
 * The same module says what the tab does with a row (`maneuverStatus`, the four reasons a row is
 * left out: its own conditions, the wrong mode, a cost the fighter cannot pay, not its
 * Opportunity), counts hands (`freeHands`) and orders the list (`arrangeManeuvers`: Favorites
 * first, no row twice). All of it is plain data in and out; the character's situation is read on
 * the Foundry side, in one place (module/helpers/situation.mjs).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build and the self-test import it
 * from Node). It imports ./syntax.mjs and the config.
 */

import { RuleSyntaxError } from "./syntax.mjs";
import { conditionIdOf, conditionWords } from "../config.mjs";
import { conditionTitle, readEffectName } from "./effect-list.mjs";

/* -------------------------------------------- */
/*  Reading the block                           */
/* -------------------------------------------- */

const SHAPE = "[REQUIRES <condition> or <condition>]";
const EXAMPLE = "[REQUIRES prone or supine]";

/** The words a block may use besides a Condition's name, as the refusal lists them. */
export const REQUIRE_WORDS = Object.freeze([
  "supine", "bind", "spell", "shield", "shield raised", "rigid", "free hand", "holding",
  "weapon", "melee weapon", "ranged weapon", "weapon <trait>", "weapon loaded", "weapon unloaded",
  "foe adjacent", "foe in reach", "foe in sight", "foe within <feet>", "ally ...", "creature ...", "encounter",
  "bind, <state>", "effect <Name>", "creature adjacent with <Condition>"
]);

/** The states a Bind may be asked for by name (0.31.0): `bind, neutral`. */
export const BIND_STATES = Object.freeze(["neutral", "controlling", "controlled"]);

/**
 * The two words after `weapon` that are a state and not a trait (0.29.0): `loaded`, the weapon is
 * ready to shoot (a shot is in it, or it needs none), and `unloaded`, it takes ammunition and is
 * not full. Read before the trait reading, which would otherwise take them for traits.
 */
export const WEAPON_STATES = Object.freeze(["loaded", "unloaded"]);

/** Whom a nearness word is about, by the word written. */
const NEAR_WHO = Object.freeze({
  foe: "enemy", foes: "enemy", enemy: "enemy", enemies: "enemy",
  ally: "ally", allies: "ally",
  creature: "any", creatures: "any"
});

/** "prone or supine" and the rest, for the message a word nobody knows gets. */
function wordList() {
  return `a Condition (${conditionWords().slice(0, 6).join(", ")}, ...), ${REQUIRE_WORDS.join(", ")}`;
}

/**
 * One alternative of a block, read: `not prone`, `weapon grapple`, `foe within 30`.
 * @param {string} written
 * @returns {object}  `{ test, not?, ... }`, plain data.
 */
function readTerm(written) {
  let words = String(written ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!words) throw new RuleSyntaxError(`REQUIRES is written \`${SHAPE}\`, as in \`${EXAMPLE}\`: an \`or\` has nothing beside it`);
  let not = false;
  if (/^not\s+/.test(words)) {
    not = true;
    words = words.replace(/^not\s+/, "");
    if (/^not(\s|$)/.test(words)) throw new RuleSyntaxError(`"${String(written).trim()}": one \`not\` is enough`);
  }
  const term = readBareTerm(words, String(written ?? "").trim());
  return not ? { ...term, not: true } : term;
}

/**
 * What follows `with` on a nearness word (0.31.0): a Condition by its name, or `effect <Name>`.
 * @param {string} words    The words after `with`, lower-cased.
 * @param {string} written  The same words as they were written, for a named Effect's own casing.
 * @returns {{condition: string}|{slug: string, name: string}}
 */
function readWith(words, written) {
  const named = written.match(/^effects?\s+(.+)$/i);
  if (named) {
    const read = readEffectName(named[1]);
    return read.condition ? { condition: read.condition } : { slug: read.slug, name: read.name };
  }
  const id = conditionIdOf(words);
  if (id) return { condition: id };
  throw new RuleSyntaxError(`"${written}": after \`with\` write a Condition (\`creature adjacent with dying\`) or a named Effect (\`foe in reach with effect Marked\`)`);
}

function readBareTerm(words, written) {
  if (words === "supine") return { test: "supine" };
  if (words === "bind") return { test: "bind" };
  // `bind, neutral` (0.31.0; Mike's example): the Bind in one state. The comma has been taken out
  // by `readRequires`, so `bind neutral` reads the same.
  let m = words.match(/^bind (\S+)$/);
  if (m) {
    if (!BIND_STATES.includes(m[1])) throw new RuleSyntaxError(`"${written}": a Bind's state is ${BIND_STATES.join(", ")}, as in \`bind, neutral\``);
    return { test: "bind", state: m[1] };
  }
  // `effect <Name>` (0.31.0): a named Effect. A Condition's name is reserved, so `effect prone` is
  // the Condition and never an Effect called Prone.
  // (`written` still carries a leading `not`; the name is read in its own casing without it.)
  const own = written.replace(/^not\s+/i, "");
  m = own.match(/^effects?\s+(.+)$/i);
  if (m) {
    const read = readEffectName(m[1]);
    return read.condition ? { test: "condition", id: read.condition } : { test: "effect", slug: read.slug, name: read.name };
  }
  if ((words === "effect") || (words === "effects")) {
    throw new RuleSyntaxError(`"${written}": name the Effect, as in \`effect Taking Cover\``);
  }
  if ((words === "spell") || (words === "spells")) return { test: "spell" };
  if (words === "shield") return { test: "shield" };
  if ((words === "shield raised") || (words === "raised shield")) return { test: "shield", raised: true };
  if (words === "rigid") return { test: "rigid" };
  if ((words === "free hand") || (words === "hand free")) return { test: "freeHand" };
  if (words === "holding") return { test: "holding" };
  if (words === "encounter") return { test: "encounter" };

  m = words.match(/^(?:(melee|ranged) )?weapon(?: ([a-z][a-z-]*))?$/);
  if (m) {
    const term = { test: "weapon" };
    if (m[1]) term.reach = m[1];
    if (WEAPON_STATES.includes(m[2])) term.state = m[2];
    else if (m[2]) term.trait = m[2];
    return term;
  }

  // Who is near, and (0.31.0) what that creature has: `creature adjacent with dying`. Only the
  // whole word `with` begins it, so `within 30` is never read as one.
  m = words.match(/^([a-z]+) (adjacent|in reach|in sight|within (\d+) ?(?:ft\.?|feet|foot)?)(?: with (.+))?$/);
  if (m && Object.hasOwn(NEAR_WHO, m[1])) {
    const who = NEAR_WHO[m[1]];
    const term = { test: "near", who, range: (m[2] === "adjacent") ? 0 : (m[2] === "in reach") ? "reach" : (m[2] === "in sight") ? "sight" : Number(m[3]) };
    if (m[4]) term.with = readWith(m[4], own.replace(/^.*?\swith\s+/i, ""));
    return term;
  }
  if (Object.hasOwn(NEAR_WHO, words.split(" ")[0])) {
    throw new RuleSyntaxError(`"${written}": say how near, as in \`foe adjacent\`, \`foe in reach\`, \`foe in sight\` or \`ally within 30\``);
  }

  const id = conditionIdOf(words);
  if (id) return { test: "condition", id };
  throw new RuleSyntaxError(`"${written}" is not something REQUIRES can check: write ${wordList()}`);
}

/**
 * A `[REQUIRES ...]` block's data, read into its alternatives.
 * @param {string} data  The text after the keyword.
 * @returns {{any: object[]}}
 */
export function readRequires(data) {
  let text = String(data ?? "").trim().replace(/\.$/, "").trim();
  if (!text) throw new RuleSyntaxError(`REQUIRES is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  // `bind, neutral` (0.31.0): the one place a comma is read, a name and then its state, as
  // `EFFECT(Aid, used)` is written. It is taken out here so every other comma keeps its message,
  // and only where `bind` BEGINS an alternative (the block's start, after `or`, after `not`): an
  // Effect whose name ends in "bind" keeps its comma's refusal (the review of 0.31.0).
  text = text.replace(/(^|\bor\s+)(not\s+)?bind\s*,\s*(?=\S)/gi, "$1$2bind ");
  if (/[,;]/.test(text)) {
    throw new RuleSyntaxError(`REQUIRES joins alternatives with \`or\`, and a condition that must ALSO hold is a second block: \`[REQUIRES free hand or weapon grapple][REQUIRES creature in reach]\``);
  }
  if (/(^|\s)and(\s|$)/i.test(text)) {
    throw new RuleSyntaxError(`REQUIRES has no \`and\`: a condition that must ALSO hold is a second block, as in \`[REQUIRES free hand or weapon grapple][REQUIRES creature in reach]\``);
  }
  // Split on the word `or` wherever it stands, so one left dangling ("prone or") is an empty
  // alternative and is told so, never a Condition called "prone or".
  const alternatives = [[]];
  for (const word of text.split(/\s+/)) {
    if (word.toLowerCase() === "or") alternatives.push([]);
    else alternatives.at(-1).push(word);
  }
  return { any: alternatives.map(words => readTerm(words.join(" "))) };
}

/* -------------------------------------------- */
/*  Saying it                                   */
/* -------------------------------------------- */

/** The Conditions whose bare name reads oddly after "Needs:", said in full. */
const CONDITION_PHRASES = Object.freeze({ controlling: "Controlling a weapon" });

/** A Condition's printed name from its id: "Prone", "Off-Guard". */
function conditionName(id) {
  if (Object.hasOwn(CONDITION_PHRASES, id)) return CONDITION_PHRASES[id];
  return conditionTitle(id);
}

/** A Bind in one state, in words (0.31.0). */
const BIND_STATE_WORDS = Object.freeze({
  neutral: ["in a neutral Bind", "not in a neutral Bind"],
  controlling: ["Controlling a weapon in a Bind", "not Controlling a weapon in a Bind"],
  controlled: ["Controlled in a Bind", "not Controlled in a Bind"]
});

/** "a foe", "an ally", "a creature". */
function nearNoun(who) {
  return who === "enemy" ? "foe" : who === "ally" ? "ally" : "creature";
}

/**
 * One alternative in words, as the tab's tooltip and the sheet's As read list say it: "Prone",
 * "not Prone", "a free hand", "no foe in reach".
 * @param {object} term
 * @returns {string}
 */
export function termWords(term) {
  const not = !!term?.not;
  const noun = text => (not ? `no ${text}` : `${/^[aeiou]/i.test(text) ? "an" : "a"} ${text}`);
  switch (term?.test) {
    case "condition": return `${not ? "not " : ""}${conditionName(term.id)}`;
    case "supine": return `${not ? "not " : ""}Supine`;
    case "bind": {
      const words = BIND_STATE_WORDS[term.state];
      if (words) return words[not ? 1 : 0];
      return not ? "not in a Bind" : "in a Bind";
    }
    case "effect": return `${not ? "not " : ""}${term.name ?? term.slug ?? ""}`;
    case "spell": return noun("spell");
    case "shield": return term.raised ? noun("Raised shield") : noun("shield in hand");
    case "rigid": return noun("rigid implement in hand");
    case "freeHand": return noun("free hand");
    case "holding": return not ? "nothing in hand" : "something in hand";
    case "encounter": return noun("encounter");
    case "weapon": {
      const kind = term.reach ? `${term.reach} weapon` : "weapon";
      if (term.state === "loaded") return noun(`loaded ${kind} in hand`);
      if (term.state === "unloaded") return noun(`${kind} in hand to reload`);
      const trait = term.trait ? ` with the ${term.trait[0].toUpperCase()}${term.trait.slice(1)} trait` : " in hand";
      return noun(`${kind}${trait}`);
    }
    case "near": {
      const who = nearNoun(term.who);
      // What that creature has (0.31.0): "an adjacent creature that is Dying", "a foe in reach
      // with Marked".
      const having = !term.with ? "" : term.with.condition ? ` that is ${conditionName(term.with.condition)}` : ` with ${term.with.name ?? term.with.slug ?? ""}`;
      if (term.range === 0) return noun(`adjacent ${who}${having}`);
      if (term.range === "reach") return noun(`${who} in reach${having}`);
      if (term.range === "sight") return noun(`${who} in sight${having}`);
      return noun(`${who} within ${term.range} ft${having}`);
    }
    default: return "";
  }
}

/** A block in words: its alternatives joined by "or". */
export function requireWords(rule) {
  return (rule?.any ?? []).map(termWords).filter(Boolean).join(" or ");
}

/* -------------------------------------------- */
/*  Checking it                                 */
/* -------------------------------------------- */

/**
 * @typedef {object} Situation  What is known of the character now. A member left out (undefined)
 *   or null is "cannot tell", never "no".
 * @property {string[]|Set<string>} [conditions]  The Condition ids the character has.
 * @property {string[]|Set<string>} [effects]  The slugs of the character's named Effects (0.31.0;
 *   ./effect-list.mjs): what is on it that is no Condition.
 * @property {string|null} [bind]       The Bind's state (neutral, controlling, controlled), or null for none.
 * @property {number} [spells]          How many spell Talents the character owns.
 * @property {{held: boolean, raised: boolean}} [shield]
 * @property {boolean|null} [rigid]     A rigid implement is in hand.
 * @property {{free: boolean|null, holding: boolean}} [hands]  `freeHands` below.
 * @property {Array<{reach: "melee"|"ranged", traits: string[], natural?: boolean, takesAmmunition?: boolean, loaded?: boolean, full?: boolean}>} [weapons]
 *   The weapons in hand: `natural` for the bare fist, which takes no hand and is no "weapon in
 *   hand"; `takesAmmunition`, `loaded` (a shot is in it, or it needs none) and `full` since 0.29.0.
 * @property {Array<{relation: string, gap: number, inReach: boolean, conditions?: string[], effects?: string[]}>|null} [near]  The other
 *   tokens the character can see, each with its relation to the character's (ally, enemy, neutral),
 *   the gap in feet, edge to edge, whether that is within the character's reach, and (0.31.0) the
 *   Condition ids and named-Effect slugs on that creature, for `with`; null when the character
 *   has no token on the viewed scene.
 * @property {boolean} [encounter]      A fighter in a running encounter.
 * @property {boolean} [tracking]       The `trackActions` setting.
 * @property {number} [actionsLeft]     Free actions this round.
 * @property {boolean} [isTurn]         It is the character's Opportunity.
 * @property {boolean} [permit]         The GM's approval of one off-turn Maneuver stands.
 */

const has = (list, value) => (list instanceof Set ? list.has(value) : Array.isArray(list) ? list.includes(value) : null);

/** One alternative before its `not`: true, false, or null for "cannot tell". */
function bare(term, s) {
  switch (term?.test) {
    case "condition": return has(s?.conditions, term.id);
    // Supine is in the book's Conditions table and not in the system (ruling 266): the word is
    // accepted so a cell can be written once, and it is known false until the Condition exists.
    case "supine": return false;
    case "bind": {
      if (s?.bind === undefined) return null;
      return term.state ? (s.bind === term.state) : !!s.bind;
    }
    // A named Effect (0.31.0): the slugs of what is on the character that is no Condition.
    case "effect": return has(s?.effects, term.slug);
    case "spell": return ((s?.spells === undefined) || (s.spells === null)) ? null : (Number(s.spells) > 0);
    case "shield": {
      if (!s?.shield) return null;
      return term.raised ? (!!s.shield.held && !!s.shield.raised) : !!s.shield.held;
    }
    case "rigid": return (typeof s?.rigid === "boolean") ? s.rigid : null;
    case "freeHand": return (typeof s?.hands?.free === "boolean") ? s.hands.free : null;
    case "holding": return (typeof s?.hands?.holding === "boolean") ? s.hands.holding : null;
    case "encounter": return (typeof s?.encounter === "boolean") ? s.encounter : null;
    case "weapon": {
      if (!Array.isArray(s?.weapons)) return null;
      return s.weapons.some(w => {
        if (term.reach && (w?.reach !== term.reach)) return false;
        // A trait is asked of everything in hand, the bare fist included (a natural weapon may
        // carry Grapple). Every other weapon word means a held OBJECT: since 0.29.0 every
        // character has an Unarmed Strike in hand, and "a weapon in hand" must not always be true.
        if (term.trait) return (w?.traits ?? []).includes(term.trait);
        if (w?.natural) return false;
        // `loaded`: ready to shoot, which a weapon that takes no ammunition always is.
        if (term.state === "loaded") return w?.loaded !== false;
        // `unloaded`: it takes ammunition and is not full, so Reload has something to do.
        if (term.state === "unloaded") return !!w?.takesAmmunition && (w?.full === false);
        return true;
      });
    }
    case "near": {
      if (!Array.isArray(s?.near)) return null;
      // `with` (0.31.0): the creature that is near must also have a Condition or a named Effect.
      // One whose Effects were not given cannot be told, and is never taken for a "no".
      let unsure = false;
      for (const t of s.near) {
        if ((term.who === "enemy") && (t?.relation !== "enemy")) continue;
        if ((term.who === "ally") && (t?.relation !== "ally")) continue;
        // `in sight`: the list holds only the tokens the character can see, at any distance.
        const placed = (term.range === "reach") ? !!t?.inReach : (term.range === "sight") ? true : (Number(t?.gap) <= term.range);
        if (!placed) continue;
        if (!term.with) return true;
        const held = term.with.condition ? has(t?.conditions, term.with.condition) : has(t?.effects, term.with.slug);
        if (held === true) return true;
        if (held === null) unsure = true;
      }
      return unsure ? null : false;
    }
    default: return null;
  }
}

/**
 * Does one alternative hold? True, false, or null when the system cannot tell.
 * @param {object} term
 * @param {Situation} situation
 * @returns {boolean|null}
 */
export function checkCondition(term, situation) {
  const answer = bare(term, situation);
  if (answer === null) return null;
  return term?.not ? !answer : answer;
}

/**
 * Do a row's blocks hold? A block FAILS only when every alternative is known false; one that
 * cannot be told is not a failure, and is reported as `unknown` so a caller may say so.
 * @param {object[]} rules      The row's `requires` rules.
 * @param {Situation} situation
 * @returns {{ok: boolean, failed: object[], unknown: boolean}}
 */
export function availability(rules, situation) {
  const failed = [];
  let unknown = false;
  for (const rule of rules ?? []) {
    const answers = (rule?.any ?? []).map(term => checkCondition(term, situation));
    if (!answers.length || answers.some(a => a === true)) continue;
    if (answers.every(a => a === false)) failed.push(rule);
    else unknown = true;
  }
  return { ok: !failed.length, failed, unknown };
}

/**
 * The conditions that stand for a row: its own `[REQUIRES ...]` rules, else the engine's for a
 * Maneuver the system itself runs (`ENGINE_REQUIRES` in documents/maneuvers.mjs: the data of each
 * block, read here). A block in the cell REPLACES the engine's: the sheet is the author.
 * @param {object[]} rules      The Item's `system.rules`.
 * @param {string[]} [engine]   The engine's blocks for the Maneuver, each a block's data.
 * @returns {object[]}  `requires` rules.
 */
export function requiresFor(rules, engine = []) {
  const own = (Array.isArray(rules) ? rules : []).filter(r => (r?.kind === "requires") && !r.error && Array.isArray(r.any));
  if (own.length) return own;
  return (engine ?? []).map(data => ({ kind: "requires", ...readRequires(data) }));
}

/* -------------------------------------------- */
/*  A row of the tab                            */
/* -------------------------------------------- */

/** The reasons a row is left out of the tab, in the order they are said. */
export const STATUS_REASONS = Object.freeze(["requires", "mode", "opportunity", "cost"]);

/**
 * Does this Maneuver apply now, and if not, why not?
 *
 * Four reasons (Mike's choices of 2026-11-15, by question):
 *  - `requires`: a `[REQUIRES ...]` block the character does not meet, one reason per block;
 *  - `mode`: in an encounter, an Exploration Activity or a Downtime Endeavor;
 *  - `opportunity`: in an encounter, outside the character's Opportunity with no approval of the
 *    GM's standing, anything but a Reaction (the gate every such Maneuver waits at, 0.19.0);
 *  - `cost`: in an encounter with the six-action round tracked, a cheapest cost above the actions
 *    left. A Reaction half with a cost of its own counts as a way to pay.
 * Outside an encounter only the first applies.
 *
 * @param {object} row
 * @param {object[]} [row.requires]      The row's `requires` rules.
 * @param {"encounter"|"exploration"|"downtime"} [row.mode]
 * @param {boolean} [row.reaction]       Performed outside the Opportunity.
 * @param {number[]} [row.costs]         Every number of actions the row may cost.
 * @param {number|null} [row.reactionCost]  The Reaction half's own cost, when it has one.
 * @param {Situation} situation
 * @returns {{applicable: boolean, reasons: Array<{code: string, needs?: string, mode?: string, cost?: number, left?: number}>}}
 */
export function maneuverStatus(row, situation) {
  const reasons = [];
  const s = situation ?? {};
  for (const rule of availability(row?.requires, s).failed) reasons.push({ code: "requires", needs: requireWords(rule) });

  if (s.encounter === true) {
    const mode = row?.mode ?? "encounter";
    if (mode !== "encounter") reasons.push({ code: "mode", mode });
    if (!row?.reaction && (s.isTurn === false) && !s.permit) reasons.push({ code: "opportunity" });
    const costs = (row?.costs ?? []).filter(n => Number.isFinite(n));
    if ((row?.reactionCost !== null) && (row?.reactionCost !== undefined) && Number.isFinite(row.reactionCost)) costs.push(row.reactionCost);
    if ((s.tracking !== false) && costs.length && Number.isFinite(s.actionsLeft)) {
      const cheapest = Math.min(...costs);
      if (cheapest > s.actionsLeft) reasons.push({ code: "cost", cost: cheapest, left: s.actionsLeft });
    }
  }
  return { applicable: !reasons.length, reasons };
}

/* -------------------------------------------- */
/*  Hands                                       */
/* -------------------------------------------- */

/**
 * How many hands are free, from what is in them. An estimate, and it says when it cannot tell:
 * a weapon or a shield in hand is a hand (two for a weapon held in two, none for a natural
 * weapon); a piece of gear marked In hand is PROBABLY a hand, but a pack or a lantern on a pole is
 * marked the same way. So: free when everything in hand, gear included, leaves a hand; not free
 * when weapons and shields alone fill both; otherwise null, and the row is shown.
 * @param {Array<{type: string, natural?: boolean, twoHands?: boolean, quantity?: number}>} held
 * @param {number} [hands=2]
 * @returns {{free: boolean|null, holding: boolean, sure: number, maybe: number}}
 */
export function freeHands(held, hands = 2) {
  let sure = 0;
  let gear = 0;
  let holding = false;
  for (const thing of held ?? []) {
    if (!thing) continue;
    if ((thing.type === "weapon") && thing.natural) continue;
    holding = true;
    if (thing.type === "weapon") sure += thing.twoHands ? 2 : 1;
    else if (thing.type === "shield") sure += 1;
    else gear += 1;
  }
  const maybe = sure + gear;
  const free = (maybe < hands) ? true : (sure >= hands) ? false : null;
  return { free, holding, sure, maybe };
}

/* -------------------------------------------- */
/*  The list                                    */
/* -------------------------------------------- */

/**
 * The rows of the tab, arranged: no Basic Maneuver beside a row of the same name before it (the
 * caller lists the character's own copies before the Basic ones, so a copy stands over the book's
 * row), Favorites first and never left out, and the rest filtered to what applies unless every
 * Maneuver is asked for.
 * @param {Array<{slug: string, applicable: boolean, isBasic?: boolean}>} rows   In priority order.
 * @param {string[]} [favorites]                               Slugs, in the order they were marked.
 * @param {object} [options]
 * @param {boolean} [options.showAll=false]
 * @returns {{favorites: object[], rest: object[], left: object[], hidden: number}}  `left` is the
 *   rows that are no Favorite and do not apply now (left out, or with `showAll` listed dimmed in
 *   `rest` as well), and `hidden` how many they are.
 */
export function arrangeManeuvers(rows, favorites = [], { showAll = false } = {}) {
  // Only a BASIC row gives way: it is the book's copy, and a row of the same name before it is the
  // character's own. Two Items on the sheet that share a name (two "New Maneuver" rows made with
  // the + button) are both the character's, and both are listed, or one could never be reached.
  const seen = new Set();
  const unique = [];
  for (const row of rows ?? []) {
    if (!row) continue;
    if (seen.has(row.slug) && row.isBasic) continue;
    seen.add(row.slug);
    unique.push(row);
  }
  const order = new Map((favorites ?? []).map((slug, i) => [slug, i]));
  const favoured = unique.filter(r => order.has(r.slug)).sort((a, b) => order.get(a.slug) - order.get(b.slug));
  const others = unique.filter(r => !order.has(r.slug)).map(r => ({ ...r, favorite: false }));
  const left = others.filter(r => !r.applicable);
  return {
    favorites: favoured.map(r => ({ ...r, favorite: true })),
    rest: showAll ? others : others.filter(r => r.applicable),
    left,
    hidden: left.length
  };
}
