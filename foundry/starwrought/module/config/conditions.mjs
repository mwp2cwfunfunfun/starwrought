/**
 * Conditions, registered as Foundry status effects, and the static effect id each is created under.
 * Imports SYSTEM_ID from system.mjs for the padded id; nothing here imports the barrel, so there
 * is no import cycle.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 *
 * THE REGISTRY (0.33.0; rulings 322 and 323). Mike, 2026-11-18: "can we build a conditions.xlsx
 * that includes every condition, and the automation effects (if any) of it?", and by question:
 * the workbook is the source the system reads, and a new row makes a new Condition. So the list is
 * no longer fixed at import. `CONDITIONS` is a LIVE registry, emptied and refilled in place as
 * `TERRAIN_KINDS` is (./terrain.mjs): it always holds the BUILT-INS below, the Conditions the
 * system's own code knows by id, and `registerConditions(rows)` lays the workbook's rows over
 * them and adds the rows that match none (Supine is the first).
 *
 *   A BUILT-IN keeps its id, its `name` (an i18n key: `${name}Hint` and the English word that
 *   ends it are still read), its static status id and its `numeric`, whatever a row says. A row
 *   gives it a `label` (the name as the sheet prints it), its `effect` and `flavor` (the sheet's
 *   Effect and Description columns, 0.35.0), what it `includes`, its `rules` and, when the cell
 *   is filled, its icon.
 *   A NEW CONDITION takes its id from its name (letters and digits, lower-cased), is numeric when
 *   its row's Takes is N, and gets a static status id from a hash of its id alone, so adding a
 *   row never moves another's.
 *
 * Every registration REBUILDS from the built-ins plus the rows given: a row deleted from the sheet
 * is gone at the next one, and `registerConditions([])` is the system as it shipped before the
 * workbook.
 */

import { SYSTEM_ID } from "./system.mjs";

/** The icon a Condition made by a row wears when its Icon cell is empty. */
export const DEFAULT_CONDITION_ICON = "icons/svg/aura.svg";

/**
 * The Conditions the system's own code knows by id.
 * `numeric` conditions carry a value (Frightened 2, Fatigued 1, Stunned 1, Wounded 3).
 * `zone` conditions are Exposed, one per Zone (0.5.1): the token status mirrors
 * `system.zones.<zone>.exposed`, and toggling the status from the palette writes the Zone.
 * `rulesPage` names the Rules Reference journal page the condition's row and card title open.
 * `statusId` is the static ActiveEffect id when the default (see statusEffectId) would collide.
 * `system` (0.33.0) marks the ones the system itself puts on and takes off from other data: the
 * workbook holds their text and nothing else.
 * `aliases` (0.33.0) are other names a row or a cell may write it by: the handbook's table prints
 * "Blind" for `blinded`.
 */
const BUILT_INS = Object.freeze({
  offGuard: { id: "offGuard", name: "STARWROUGHT.Condition.offGuard", img: "icons/svg/downgrade.svg" },
  wrongFooted: { id: "wrongFooted", name: "STARWROUGHT.Condition.wrongFooted", img: "icons/svg/target.svg" },
  frightened: { id: "frightened", name: "STARWROUGHT.Condition.frightened", img: "icons/svg/terror.svg", numeric: true },
  prone: { id: "prone", name: "STARWROUGHT.Condition.prone", img: "icons/svg/falling.svg" },
  grabbed: { id: "grabbed", name: "STARWROUGHT.Condition.grabbed", img: "icons/svg/net.svg" },
  restrained: { id: "restrained", name: "STARWROUGHT.Condition.restrained", img: "icons/svg/padlock.svg" },
  heedless: { id: "heedless", name: "STARWROUGHT.Condition.heedless", img: "icons/svg/explosion.svg" },
  stunned: { id: "stunned", name: "STARWROUGHT.Condition.stunned", img: "icons/svg/daze.svg", numeric: true },
  slowed: { id: "slowed", name: "STARWROUGHT.Condition.slowed", img: "icons/svg/clockwork.svg", numeric: true },
  /**
   * Fatigued N (PHB v4.21, Conditions): -N Condition (maximum of 3, FATIGUED_MAX) to all four
   * Defenses and attack rolls (Evade and Guard only through v4.15), and no Exploration Mode
   * Activity but Travel; ends after ten minutes of rest, which is the short rest, the rest card (a
   * night is longer than ten minutes) or the Fatigued card's own button, the table's word that the
   * ten minutes have passed (ruling 81). The end of the Combat clears nothing. Raised by 1 on a
   * failed Wind check and by 2 on a critical failure.
   */
  fatigued: { id: "fatigued", name: "STARWROUGHT.Condition.fatigued", img: "icons/svg/unconscious.svg", numeric: true },
  blinded: { id: "blinded", name: "STARWROUGHT.Condition.blinded", img: "icons/svg/blind.svg", aliases: ["blind"] },
  deafened: { id: "deafened", name: "STARWROUGHT.Condition.deafened", img: "icons/svg/deaf.svg", aliases: ["deaf"] },
  concealed: { id: "concealed", name: "STARWROUGHT.Condition.concealed", img: "icons/svg/light-off.svg" },
  hidden: { id: "hidden", name: "STARWROUGHT.Condition.hidden", img: "icons/svg/mystery-man.svg" },
  undetected: { id: "undetected", name: "STARWROUGHT.Condition.undetected", img: "icons/svg/invisible.svg" },
  unconscious: { id: "unconscious", name: "STARWROUGHT.Condition.unconscious", img: "icons/svg/unconscious.svg" },
  dying: { id: "dying", name: "STARWROUGHT.Condition.dying", img: "icons/svg/skull.svg", numeric: true, system: true },
  /** Any Zone carries a Wound. The Wounds themselves are per Zone on the actor (PHB v4.10). */
  wounded: { id: "wounded", name: "STARWROUGHT.Condition.wounded", img: "icons/svg/blood.svg", system: true },
  /** At 0 Vigor: every Hit Wounds the Zone it strikes, a Critical Hit twice; Grazes never Wound. */
  spent: { id: "spent", name: "STARWROUGHT.Condition.spent", img: "icons/svg/degen.svg", system: true },
  /** The Bind: a neutral Bind, or one someone Controls. The effect carries the particulars (0.5.1). */
  bound: { id: "bound", name: "STARWROUGHT.Condition.bound", img: "icons/svg/combat.svg", rulesPage: "The Bind", system: true },
  // "starwroughtcontrolled" and "starwroughtcontrolling" share their first sixteen characters, so
  // these two name their ids: a shared id would make the palette treat one as the other.
  controlled: { id: "controlled", name: "STARWROUGHT.Condition.controlled", img: "icons/svg/downgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrld", system: true },
  controlling: { id: "controlling", name: "STARWROUGHT.Condition.controlling", img: "icons/svg/upgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrlg", system: true },
  /** A Maneuver of three or more actions begun: one spent, the rest reserved. */
  preparing: { id: "preparing", name: "STARWROUGHT.Condition.preparing", img: "icons/svg/hazard.svg", system: true },
  dead: { id: "dead", name: "STARWROUGHT.Condition.dead", img: "icons/svg/skull.svg", system: true },
  /**
   * Exposed, one status per Zone (PHB v4.10: "the following condition is placed on you: Exposed
   * [Zone Name]"). Mirrors of `system.zones.<zone>.exposed`, never the record of it: the Zone is
   * the truth and `SwActor#setExposed` keeps the status in step, while the palette hooks in
   * starwrought.mjs carry a toggle on the token back to the Zone.
   */
  exposedHead: { id: "exposedHead", name: "STARWROUGHT.Condition.exposedHead", img: "icons/svg/eye.svg", zone: "head", rulesPage: "Exposed", statusId: "starwroughtxHead", system: true },
  exposedTorso: { id: "exposedTorso", name: "STARWROUGHT.Condition.exposedTorso", img: "icons/svg/bones.svg", zone: "torso", rulesPage: "Exposed", statusId: "starwroughtxTors", system: true },
  exposedArms: { id: "exposedArms", name: "STARWROUGHT.Condition.exposedArms", img: "icons/svg/thrust.svg", zone: "arms", rulesPage: "Exposed", statusId: "starwroughtxArms", system: true },
  exposedLegs: { id: "exposedLegs", name: "STARWROUGHT.Condition.exposedLegs", img: "icons/svg/leg.svg", zone: "legs", rulesPage: "Exposed", statusId: "starwroughtxLegs", system: true }
});

/**
 * The words a NEW Condition may not be named, each because it already means something where a
 * Condition's name is read: the words a `[REQUIRES ...]` block reads before it asks for a
 * Condition (module/rules/requires.mjs), the words of a name (module/rules/effect-list.mjs), and
 * "exposed", which is a Zone's own. Compared squeezed (lower-cased, spaces and hyphens out). The
 * self-test holds this list against the REQUIRES words, so the two cannot drift.
 */
export const RESERVED_CONDITION_NAMES = Object.freeze([
  "bind", "spell", "spells", "shield", "shieldraised", "raisedshield", "rigid", "freehand", "handfree", "holding",
  "weapon", "meleeweapon", "rangedweapon", "foe", "ally", "creature", "encounter", "effect", "effects",
  "and", "or", "not", "self", "target", "mine", "used", "with", "na", "n/a", "none", "exposed",
  // 0.35.0: the two words `IMMUNE:` reads that are no Condition. A row named "Expose" would take
  // the id the `prevent` kind keeps for an Exposed Zone (an open hole through 0.34.0), and one
  // named "Trait" the id it keeps for immunity to a trait.
  "expose", "trait"
]);

/**
 * The words a new Condition's name may not BEGIN with: a `[REQUIRES ...]` block reads the phrase
 * they open as something else (`weapon loaded`, `foe in reach`, `effect Blessed`, `bind, neutral`,
 * `not prone`), so a Condition called "Weapon Bound" could never be asked for.
 */
export const RESERVED_CONDITION_FIRST_WORDS = Object.freeze([
  "weapon", "foe", "foes", "enemy", "enemies", "ally", "allies", "creature", "creatures", "effect", "effects", "bind", "not"
]);

/**
 * May a NEW Condition carry this name? False when the name, or the word it begins with, already
 * means something else where a Condition is read (the two lists above; "exposed" is a Zone's own).
 * @param {string} label  The row's name, its suffix already off.
 * @returns {boolean}
 */
export function conditionNameFree(label) {
  const key = squeeze(label);
  if (!key || RESERVED_CONDITION_NAMES.includes(key) || key.startsWith("exposed")) return false;
  const words = String(label ?? "").trim().toLowerCase().split(/[\s-]+/);
  if (RESERVED_CONDITION_FIRST_WORDS.includes(words[0])) return false;
  if (((words[0] === "melee") || (words[0] === "ranged")) && (words[1] === "weapon")) return false;
  return true;
}

/** The values a row's Takes cell may hold: nothing, a value, a Zone, or a creature. */
export const CONDITION_TAKES = Object.freeze(["", "n", "zone", "x"]);

/**
 * The Conditions, keyed by id: the live registry (the header, THE REGISTRY). Each record is frozen:
 * `{ id, name, label, img, numeric, zone, rulesPage, statusId, system, aliases, builtIn, takes,
 * effect, flavor, includes: [{ id, against }], rules, listed }`. `effect` is the rules text players
 * read and `flavor` the row's one line of flavor (0.35.0; the sheet's Effect and Description
 * columns). There is no `description` on a record: through 0.34.0 that word meant the rules text,
 * and a reader left on it should find nothing rather than the flavor line.
 * @type {Object<string, object>}
 */
export const CONDITIONS = {};

/** Lower-cased, spaces and hyphens out: the form a Condition's name is compared in. */
function squeeze(word) {
  return String(word ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
}

/** The English word that ends a built-in's i18n key: "offGuard", "prone". */
function keyWord(record) {
  return String(record?.name ?? "").split(".").at(-1);
}

/** "offGuard" as it is printed: "Off-Guard". */
function titled(word) {
  const spaced = String(word ?? "").replace(/([a-z])([A-Z])/g, "$1-$2");
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : "";
}

/** The squeezed word a built-in is found by, to its id: the id, its key's word, its aliases. */
const BUILT_IN_WORDS = (() => {
  const out = new Map();
  for (const [id, record] of Object.entries(BUILT_INS)) {
    if (record.zone) continue;
    for (const word of [id, keyWord(record), ...(record.aliases ?? [])]) {
      const key = squeeze(word);
      if (key) out.set(key, id);
    }
  }
  return out;
})();

/** The four Exposed statuses, which one "Exposed" row of the workbook describes together. */
const EXPOSED_IDS = Object.freeze(Object.values(BUILT_INS).filter(c => c.zone).map(c => c.id));

/** The live word index: squeezed word to id, for every Condition a cell may name (never a Zone's). */
let WORDS = new Map();

/** A built-in as the registry holds it before any row is laid over it. */
function builtInRecord(record) {
  return {
    id: record.id, name: record.name, label: null, img: record.img,
    numeric: record.numeric === true, zone: record.zone ?? null, rulesPage: record.rulesPage ?? null,
    statusId: record.statusId ?? null, system: record.system === true,
    aliases: [...(record.aliases ?? [])], builtIn: true,
    takes: record.numeric ? "n" : (record.zone ? "zone" : ""), effect: "", flavor: "", includes: [], rules: [], listed: true
  };
}

/**
 * A 16-character static ActiveEffect id for a Condition a row made: a hash of its id alone (FNV-1a,
 * twice, in base 36), so a new row never moves another's id and two ids that share their first
 * letters (the padded built-in formula keeps only five) cannot collide. Letters and digits only,
 * which is what a document id may be.
 * @param {string} id  The new Condition's id.
 * @returns {string}
 */
export function newStatusId(id) {
  const text = String(id ?? "");
  const hash = seed => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36).padStart(7, "0").slice(-7);
  };
  return `sw${hash(0x811c9dc5)}${hash(0x01234567)}`.padEnd(16, "0").slice(0, 16);
}

/** The id a NEW Condition gets from its name: its letters and digits, lower-cased ("Supine" is `supine`). */
export function newConditionId(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * A row's name without the suffix the handbook's table prints after it: "Frightened N",
 * "Exposed [Zone]", "Wrong-Footed [X]", "Bound [X]" are Frightened, Exposed, Wrong-Footed, Bound.
 */
export function conditionRowName(name) {
  return String(name ?? "").replace(/\s*\[[^\]]*\]\s*$/, "").replace(/\s+N$/, "").trim();
}

/**
 * Read one entry of a row's Includes: `Off-Guard`, or `Off-Guard against X` (only against the
 * creature that put this Condition on). Null for an empty entry.
 * @param {string|{name?: string, id?: string, against?: boolean}} entry
 * @returns {{name: string, against: boolean}|null}
 */
export function readInclude(entry) {
  if (entry && (typeof entry === "object")) {
    const name = String(entry.name ?? entry.id ?? "").trim();
    return name ? { name, against: entry.against === true } : null;
  }
  const text = String(entry ?? "").trim();
  if (!text) return null;
  const against = /\s+against\s+x$/i.test(text);
  return { name: text.replace(/\s+against\s+x$/i, "").trim(), against };
}

/**
 * Fill the registry from the workbook's rows (content/conditions.json's records, or the build's
 * own), replacing whatever it held: `CONDITIONS` is emptied and refilled in place with the
 * built-ins, each row laid over the built-in it names or added as a new Condition. Throws on a row
 * it cannot take (no name, a reserved name, two rows for one Condition, an Includes that names no
 * Condition); nothing is changed when it throws.
 *
 * A row: `{ name, takes?, effect?, description?, includes?, rules?, system?, icon?, listed?,
 * statusId? }`. `effect` is the rules text and `description` the flavor line (0.35.0); a row with
 * no `effect` key was built before then, when `description` was the rules, and is read so.
 * `includes` is a list of names (or `{ name, against }`), `rules` the parsed Automation lines.
 *
 * @param {Array<object>} rows
 * @returns {{created: string[], matched: string[], missing: string[]}}  The ids of the Conditions
 *          rows made, of the built-ins rows described, and of the built-ins no row describes (a
 *          Zone's Exposed status counts as described by the one "Exposed" row).
 */
export function registerConditions(rows) {
  const next = {};
  for (const record of Object.values(BUILT_INS)) next[record.id] = builtInRecord(record);
  const words = new Map(BUILT_IN_WORDS);
  const seen = new Set();
  const created = [];
  const matched = [];
  const pending = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || (typeof row !== "object")) continue;
    const label = conditionRowName(row.name);
    if (!label) throw new Error("a Condition needs a name (the row's Condition cell)");
    const key = squeeze(label);
    const takes = squeeze(row.takes);
    if (!CONDITION_TAKES.includes(takes)) throw new Error(`"${label}": Takes is blank, N, Zone or X, not "${row.takes}"`);
    // Two texts since 0.35.0. A row with no `effect` key is the older shape (one text, the rules).
    const older = !Object.hasOwn(row, "effect");
    const effect = String((older ? row.description : row.effect) ?? "").trim();
    const flavor = older ? "" : String(row.description ?? "").trim();
    const rules = Array.isArray(row.rules) ? row.rules : [];
    const icon = String(row.icon ?? "").trim();
    const listed = row.listed !== false;
    const includes = (Array.isArray(row.includes) ? row.includes : []).map(readInclude).filter(Boolean);

    // The one "Exposed" row describes the four statuses that mirror the Zones.
    if (key === "exposed") {
      if (seen.has("exposed")) throw new Error(`two rows describe the Condition "${label}"`);
      seen.add("exposed");
      for (const id of EXPOSED_IDS) {
        next[id] = { ...next[id], effect, flavor, listed, ...(icon ? { img: icon } : {}) };
        matched.push(id);
      }
      continue;
    }

    const builtIn = words.get(key) ?? null;
    if (builtIn && next[builtIn]?.builtIn) {
      if (seen.has(builtIn)) throw new Error(`two rows describe the Condition "${label}"`);
      seen.add(builtIn);
      next[builtIn] = { ...next[builtIn], label, takes: takes || next[builtIn].takes, effect, flavor, rules, listed, ...(icon ? { img: icon } : {}) };
      words.set(key, builtIn);
      matched.push(builtIn);
      pending.push({ id: builtIn, label, includes });
      continue;
    }

    // A new Condition (ruling 323).
    if (row.system === true) {
      throw new Error(`"${label}" is marked System, and the system knows no Condition of that name: the ones it runs itself are fixed in code`);
    }
    const id = newConditionId(label);
    if (!id || !/^[a-z]/.test(id)) throw new Error(`"${label}" cannot name a Condition: a name begins with a letter`);
    // Asked of the name AND of the id it makes: the id drops every mark, so "Trai't" would
    // otherwise take the word `trait`, and "Expo'se" the kind's own `expose` (the review of 0.35.0).
    if (!conditionNameFree(label) || !conditionNameFree(id)) {
      throw new Error(`"${label}" cannot name a Condition: the word already means something else where a Condition is read`);
    }
    if (takes === "zone") throw new Error(`"${label}": only the system's own Conditions take a Zone`);
    if (next[id] || seen.has(id)) throw new Error(`two rows describe the Condition "${label}"`);
    // The id is the name's letters and digits, and a cell reads a Condition by that same squeezed
    // word. A name that differs from another Condition's only by a mark the id drops (an
    // apostrophe: "Off'Guard") would take that Condition's word and be read in its place by every
    // cell that names it (the review of 0.33.0): refused, naming the Condition it would shadow.
    const shadowed = words.get(id) ?? Object.keys(next).find(k => k.toLowerCase() === id) ?? null;
    if (shadowed) {
      throw new Error(`"${label}" would be read as the Condition "${next[shadowed]?.label ?? titled(keyWord(next[shadowed])) ?? shadowed}" wherever a cell names it: the two names differ only by a mark; rename the row`);
    }
    seen.add(id);
    next[id] = {
      id, name: label, label, img: icon || DEFAULT_CONDITION_ICON,
      numeric: takes === "n", zone: null, rulesPage: null,
      statusId: String(row.statusId ?? "").trim() || newStatusId(id), system: false,
      aliases: [], builtIn: false, takes, effect, flavor, includes: [], rules, listed
    };
    words.set(key, id);
    words.set(id, id);
    created.push(id);
    pending.push({ id, label, includes });
  }

  // Includes are read once every row is known, so a row may name one that comes after it.
  for (const { id, label, includes } of pending) {
    const out = [];
    for (const entry of includes) {
      const target = words.get(squeeze(conditionRowName(entry.name))) ?? null;
      if (!target) throw new Error(`"${label}" includes "${entry.name}", which is no Condition`);
      if (target === id) throw new Error(`"${label}" includes itself`);
      if (!out.some(e => (e.id === target) && (e.against === entry.against))) out.push({ id: target, against: entry.against });
    }
    next[id] = { ...next[id], includes: out };
  }

  const statusIds = new Map();
  for (const record of Object.values(next)) {
    const sid = record.statusId ?? `${SYSTEM_ID}${record.id}`.padEnd(16, "0").slice(0, 16);
    if (!/^[A-Za-z0-9]{16}$/.test(sid)) throw new Error(`the Condition "${record.label ?? record.id}" has the status id "${sid}", which is not 16 letters and digits`);
    if (statusIds.has(sid)) throw new Error(`the Conditions "${record.label ?? record.id}" and "${statusIds.get(sid)}" share the status id "${sid}"`);
    statusIds.set(sid, record.label ?? record.id);
  }

  for (const id of Object.keys(CONDITIONS)) delete CONDITIONS[id];
  for (const [id, record] of Object.entries(next)) {
    CONDITIONS[id] = Object.freeze({ ...record, includes: Object.freeze(record.includes.map(e => Object.freeze({ ...e }))) });
  }
  WORDS = words;
  const missing = Object.values(BUILT_INS).filter(c => !c.zone && !seen.has(c.id)).map(c => c.id);
  if (!seen.has("exposed")) missing.push("exposed");
  return { created, matched, missing };
}

// The registry as the system ships with no workbook read: the built-ins alone.
registerConditions([]);

/** Do any rows stand over the built-ins? False until a workbook's rows are registered. */
export function conditionsRegistered() {
  return Object.values(CONDITIONS).some(c => !c.builtIn || c.label !== null);
}

/** The ids of the built-ins, the Conditions the system's own code knows. */
export function builtInConditionIds() {
  return Object.keys(BUILT_INS);
}

/**
 * A Condition by the name a cell writes (0.28.0; the `prevent` kind's own reading since 0.13.0,
 * shared with `requires`): the id, the name the workbook gives it, the English name that ends a
 * built-in's i18n key, or an alias, with case, spaces and hyphens ignored, so `prone`,
 * `Off-Guard`, `off guard`, `offGuard` and `Blind` all read. The Exposed-by-Zone statuses are
 * mirrors of a Zone and never a Condition a rule names. Null for a word that is none.
 * @param {string} word
 * @returns {string|null}  A key of CONDITIONS.
 */
export function conditionIdOf(word) {
  const key = squeeze(word);
  return (key && WORDS.get(key)) || null;
}

/** A Condition's name as it is printed: the workbook's, else a built-in's own ("Off-Guard"). */
export function conditionLabel(id) {
  const record = CONDITIONS[id];
  if (!record) return titled(id) || String(id ?? "");
  return record.label || titled(keyWord(record)) || String(id);
}

/**
 * What to show for a Condition's name on a screen, for the caller to localize: the workbook's name
 * ("Blind"), which localizes to itself, else a built-in's i18n key (an Exposed Zone's, and every
 * built-in before a workbook is read).
 */
export function conditionNameKey(id) {
  const record = CONDITIONS[id];
  return record ? (record.label || record.name) : String(id ?? "");
}

/**
 * The rules text players read for a Condition: its row's Effect, or "" when the workbook gives
 * none (a caller may then fall back to the built-in's `${name}Hint` string). `conditionDescription`
 * through 0.34.0, when the sheet's one text column was headed Description; retired by name in
 * 0.35.0, so that a caller left on the old word fails at import instead of showing flavor as rules.
 */
export function conditionEffect(id) {
  return String(CONDITIONS[id]?.effect ?? "");
}

/** A Condition's one line of flavor: its row's Description (0.35.0), or "". */
export function conditionFlavor(id) {
  return String(CONDITIONS[id]?.flavor ?? "");
}

/** The names a cell may write a Condition by, in order, for a message: "prone, grabbed, ...". */
export function conditionWords() {
  return Object.values(CONDITIONS).filter(c => !c.zone).map(c => (c.builtIn ? keyWord(c) : c.id).toLowerCase());
}

/** Does the registry hold rule lines for this Condition? */
export function conditionHasRules(id) {
  return (CONDITIONS[id]?.rules?.length ?? 0) > 0;
}

/**
 * Does a ROW of the workbook describe this Condition? Then the row, and never the code, says what
 * the Condition does (ruling 329): its lines, or nothing at all when its cell is blank or `N/A`.
 * A built-in no row describes (the Conditions file could not be read, or the build has not been
 * run) is the system's own, and the numbers the code had for it stand.
 * @param {string} id
 * @returns {boolean}
 */
export function conditionHasRow(id) {
  const record = CONDITIONS[id];
  return !!record && (!record.builtIn || (record.label !== null));
}

/** Zone key -> the Exposed condition that mirrors it. */
export const ZONE_CONDITIONS = Object.freeze(Object.fromEntries(
  Object.values(BUILT_INS).filter(c => c.zone).map(c => [c.zone, c.id])
));

/**
 * The static ActiveEffect id a condition is created under, the one Foundry's token palette looks
 * for (`Actor#toggleStatusEffect` matches on `_id`, and the HUD lights a status only when the
 * effect carries it). Sixteen alphanumeric characters: the system id and the condition id, padded,
 * except where a condition names its own because the padded form would collide. The system's own
 * `SwActor#setCondition` creates under the same id, so a status set by the rules and one toggled
 * from the token are the same effect and never a pair (0.5.1, "one Bind, one effect"). A Condition
 * a row made carries a hashed id of its own (`newStatusId`, 0.33.0).
 * @param {string} id  A key of CONDITIONS.
 * @returns {string}
 */
export function statusEffectId(id) {
  return CONDITIONS[id]?.statusId ?? `${SYSTEM_ID}${id}`.padEnd(16, "0").slice(0, 16);
}
