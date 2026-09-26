/**
 * STARWROUGHT rules constants.
 *
 * Everything here is a rule from the Player's Handbook, expressed once so the rest of the
 * system can do arithmetic without repeating a number that might drift. If a value in this
 * file disagrees with the handbook, the handbook wins and this file is the bug.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. `assets/build_foundry.mjs` imports
 * it from plain Node so that the slug rule and the action-cost parser exist in exactly one
 * place; a `game.` or `CONFIG.` reference outside a function body breaks the content build.
 */

export const SYSTEM_ID = "starwrought";

/* -------------------------------------------- */
/*  Attributes                                  */
/* -------------------------------------------- */

/**
 * The four Attributes. Never bought, never rolled: derived from the Talents you own.
 * Attribute Bonus = Attribute Points / 3, rounded down, maximum +5. There is no minimum +1;
 * 0-2 points is +0 (PHB v3.1 Attribute table).
 */
export const ATTRIBUTES = Object.freeze({
  might: { label: "STARWROUGHT.Attribute.might", abbr: "STARWROUGHT.Attribute.mightAbbr", glyph: "▲" },
  agility: { label: "STARWROUGHT.Attribute.agility", abbr: "STARWROUGHT.Attribute.agilityAbbr", glyph: "⚡" },
  wits: { label: "STARWROUGHT.Attribute.wits", abbr: "STARWROUGHT.Attribute.witsAbbr", glyph: "◉" },
  presence: { label: "STARWROUGHT.Attribute.presence", abbr: "STARWROUGHT.Attribute.presenceAbbr", glyph: "✦" }
});

export const ATTRIBUTE_DIVISOR = 3;
export const ATTRIBUTE_MAX = 5;

/**
 * Convert Attribute Points into an Attribute Bonus.
 * @param {number} points
 * @returns {number}
 */
export function attributeBonus(points) {
  return Math.min(ATTRIBUTE_MAX, Math.floor((Number(points) || 0) / ATTRIBUTE_DIVISOR));
}

/* -------------------------------------------- */
/*  Proficiency                                 */
/* -------------------------------------------- */

/**
 * Proficiency Ranks. `points` is the minimum spend in the Constellation, `level` the minimum
 * character level. Both gates must be met.
 */
export const RANKS = Object.freeze({
  untrained: { label: "STARWROUGHT.Rank.untrained", abbr: "U", bonus: 0, points: 0, level: 0, order: 0 },
  trained: { label: "STARWROUGHT.Rank.trained", abbr: "T", bonus: 4, points: 1, level: 1, order: 1 },
  expert: { label: "STARWROUGHT.Rank.expert", abbr: "E", bonus: 7, points: 4, level: 5, order: 2 },
  master: { label: "STARWROUGHT.Rank.master", abbr: "M", bonus: 10, points: 9, level: 13, order: 3 },
  legendary: { label: "STARWROUGHT.Rank.legendary", abbr: "L", bonus: 13, points: 16, level: 19, order: 4 }
});

/** Rank keys in ascending order. */
export const RANK_ORDER = Object.freeze(["untrained", "trained", "expert", "master", "legendary"]);

/** Talent tier letters, as authored in the spreadsheets, mapped to the rank they require. */
export const TIERS = Object.freeze({
  T: { label: "STARWROUGHT.Rank.trained", rank: "trained", order: 1 },
  E: { label: "STARWROUGHT.Rank.expert", rank: "expert", order: 2 },
  M: { label: "STARWROUGHT.Rank.master", rank: "master", order: 3 },
  L: { label: "STARWROUGHT.Rank.legendary", rank: "legendary", order: 4 }
});

/**
 * Resolve a Proficiency Rank from points spent in a Constellation and character level.
 * @param {number} points
 * @param {number} level
 * @returns {string} A key of RANKS.
 */
export function rankFor(points, level) {
  points = Number(points) || 0;
  level = Number(level) || 1;
  let rank = "untrained";
  for (const key of RANK_ORDER) {
    const gate = RANKS[key];
    if (points >= gate.points && level >= gate.level) rank = key;
  }
  return rank;
}

/** The Proficiency Bonus of a rank key. */
export function rankBonus(rank) {
  return RANKS[rank]?.bonus ?? 0;
}

/** Step a rank down by N steps, floored at untrained. Used by Practiced weapon Handling. */
export function stepRank(rank, steps = -1) {
  const i = RANK_ORDER.indexOf(rank);
  if (i < 0) return "untrained";
  return RANK_ORDER[Math.clamp(i + steps, 0, RANK_ORDER.length - 1)];
}

/* -------------------------------------------- */
/*  Constellations                              */
/* -------------------------------------------- */

/** Constellation categories, in the order they should be listed on a sheet. */
export const CATEGORIES = Object.freeze({
  origin: { label: "STARWROUGHT.Category.origin", order: 0 },
  calling: { label: "STARWROUGHT.Category.calling", order: 1 },
  defense: { label: "STARWROUGHT.Category.defense", order: 2 },
  weapon: { label: "STARWROUGHT.Category.weapon", order: 3 },
  combatStyle: { label: "STARWROUGHT.Category.combatStyle", order: 4 },
  skill: { label: "STARWROUGHT.Category.skill", order: 5 },
  lore: { label: "STARWROUGHT.Category.lore", order: 6 },
  general: { label: "STARWROUGHT.Category.general", order: 7 }
});

/**
 * The categories the converter writes, mapped onto ours. Ancestry, Bloodline and Culture all
 * merge into the Origin Constellation (PHB: "your history, drawn as a single sky").
 */
export const CATEGORY_ALIASES = Object.freeze({
  Ancestry: "origin",
  Bloodline: "origin",
  Heritage: "origin",
  Culture: "origin",
  Origin: "origin",
  Background: "lore",
  Calling: "calling",
  Defense: "defense",
  Save: "defense",
  Weapon: "weapon",
  Weapons: "weapon",
  "Combat Style": "combatStyle",
  Armor: "combatStyle",
  Skill: "skill",
  Lore: "lore",
  General: "general"
});

/** The four Defenses, and the Attribute each keys off. */
export const DEFENSES = Object.freeze({
  awareness: {
    label: "STARWROUGHT.Defense.awareness",
    attribute: "wits",
    slug: "awareness",
    hint: "STARWROUGHT.Defense.awarenessHint"
  },
  evade: {
    label: "STARWROUGHT.Defense.evade",
    attribute: "agility",
    slug: "evade",
    hint: "STARWROUGHT.Defense.evadeHint"
  },
  guard: {
    label: "STARWROUGHT.Defense.guard",
    attribute: "presence",
    slug: "guard",
    hint: "STARWROUGHT.Defense.guardHint"
  },
  endure: {
    label: "STARWROUGHT.Defense.endure",
    attribute: "might",
    slug: "endure",
    hint: "STARWROUGHT.Defense.endureHint"
  }
});

/** The Constellation slug every attack roll uses. */
export const WEAPONS_SLUG = "weapons";

/* -------------------------------------------- */
/*  Zones, Protection, and materials             */
/* -------------------------------------------- */

/** The four Zones a body is divided into. Ordinary Hits land on the Torso. */
export const ZONES = Object.freeze({
  head: { label: "STARWROUGHT.Zone.head", order: 0 },
  torso: { label: "STARWROUGHT.Zone.torso", order: 1 },
  arms: { label: "STARWROUGHT.Zone.arms", order: 2 },
  legs: { label: "STARWROUGHT.Zone.legs", order: 3 }
});

export const DEFAULT_ZONE = "torso";

/** The Critical Hit effect of each Zone, and the extra Wounded it deals when Exposed. */
export const ZONE_CRITICALS = Object.freeze({
  head: { effect: "STARWROUGHT.ZoneCrit.head", wounded: 3 },
  torso: { effect: "STARWROUGHT.ZoneCrit.torso", wounded: 2 },
  arms: { effect: "STARWROUGHT.ZoneCrit.arms", wounded: 1 },
  legs: { effect: "STARWROUGHT.ZoneCrit.legs", wounded: 1 }
});

/** Physical damage types. */
export const PHYSICAL_DAMAGE = Object.freeze(["bludgeoning", "piercing", "slashing"]);

/** Every damage type the system knows about. */
export const DAMAGE_TYPES = Object.freeze({
  bludgeoning: { label: "STARWROUGHT.Damage.bludgeoning", abbr: "B" },
  piercing: { label: "STARWROUGHT.Damage.piercing", abbr: "P" },
  slashing: { label: "STARWROUGHT.Damage.slashing", abbr: "S" },
  acid: { label: "STARWROUGHT.Damage.acid" },
  cold: { label: "STARWROUGHT.Damage.cold" },
  fire: { label: "STARWROUGHT.Damage.fire" },
  electricity: { label: "STARWROUGHT.Damage.electricity" },
  poison: { label: "STARWROUGHT.Damage.poison" },
  bleed: { label: "STARWROUGHT.Damage.bleed" },
  mental: { label: "STARWROUGHT.Damage.mental" },
  untyped: { label: "STARWROUGHT.Damage.untyped" }
});

/** Single-letter damage abbreviations as printed on the weapon tables. */
export const DAMAGE_ABBR = Object.freeze({ B: "bludgeoning", P: "piercing", S: "slashing" });

/**
 * Armor materials, and the one damage type each turns poorly. A piece's Protection is reduced
 * by 1 against that type. Scale turns nothing poorly, which is what it is for.
 */
export const MATERIALS = Object.freeze({
  none: { label: "STARWROUGHT.Material.none", weakTo: null },
  padded: { label: "STARWROUGHT.Material.padded", weakTo: "slashing" },
  leather: { label: "STARWROUGHT.Material.leather", weakTo: "slashing" },
  mail: { label: "STARWROUGHT.Material.mail", weakTo: "piercing" },
  scale: { label: "STARWROUGHT.Material.scale", weakTo: null },
  plate: { label: "STARWROUGHT.Material.plate", weakTo: "bludgeoning" }
});

/* -------------------------------------------- */
/*  Sizes, movement, cover                      */
/* -------------------------------------------- */

/**
 * Creature sizes. The grid is 1 foot, so `space` is the token footprint in feet and `reach`
 * is Natural Reach, to which a weapon's own Reach is added.
 */
export const SIZES = Object.freeze({
  tiny: { label: "STARWROUGHT.Size.tiny", space: 1, reach: 0, evade: 2, guard: -2 },
  small: { label: "STARWROUGHT.Size.small", space: 2, reach: 1, evade: 1, guard: -1 },
  medium: { label: "STARWROUGHT.Size.medium", space: 3, reach: 2, evade: 0, guard: 0 },
  large: { label: "STARWROUGHT.Size.large", space: 5, reach: 4, evade: -1, guard: 1 },
  huge: { label: "STARWROUGHT.Size.huge", space: 10, reach: 8, evade: -2, guard: 2 },
  gargantuan: { label: "STARWROUGHT.Size.gargantuan", space: 15, reach: 12, evade: -2, guard: 2 }
});

/** Cover grades, by the number of Zones the obstacle stands in front of. */
export const COVER = Object.freeze({
  none: { label: "STARWROUGHT.Cover.none", zones: 0, bonus: 0 },
  lesser: { label: "STARWROUGHT.Cover.lesser", zones: 1, bonus: 1 },
  standard: { label: "STARWROUGHT.Cover.standard", zones: 2, bonus: 2 },
  greater: { label: "STARWROUGHT.Cover.greater", zones: 3, bonus: 4 },
  total: { label: "STARWROUGHT.Cover.total", zones: 4, bonus: null }
});

/** Detection states, worst-known to best-known from the observer's point of view. */
export const DETECTION = Object.freeze({
  observed: { label: "STARWROUGHT.Detection.observed", bonus: 0, order: 3 },
  concealed: { label: "STARWROUGHT.Detection.concealed", bonus: 2, order: 2 },
  hidden: { label: "STARWROUGHT.Detection.hidden", bonus: 4, order: 1 },
  undetected: { label: "STARWROUGHT.Detection.undetected", bonus: 4, order: 0 }
});

/* -------------------------------------------- */
/*  Weapons                                     */
/* -------------------------------------------- */

/**
 * Handling. What happens to your Weapons Proficiency Bonus when you lack Familiarity with
 * the weapon: Intuitive costs nothing, Practiced drops a rank, Technical drops you to Untrained.
 */
export const HANDLING = Object.freeze({
  intuitive: { label: "STARWROUGHT.Handling.intuitive", steps: 0, untrained: false },
  practiced: { label: "STARWROUGHT.Handling.practiced", steps: -1, untrained: false },
  technical: { label: "STARWROUGHT.Handling.technical", steps: 0, untrained: true }
});

/** Weapon groups, used by Weapon Familiarity. */
export const WEAPON_GROUPS = Object.freeze([
  "Axes", "Bows", "Clubs", "Crossbows", "Flails", "Hammers", "Knives",
  "Natural Weapons", "Picks", "Polearms", "Slings", "Spears", "Swords", "Whips"
]);

/**
 * Weapon damage dice by character level: two dice at 4th, three at 12th, four at 19th.
 * @param {number} level
 * @returns {number}
 */
export function weaponDice(level) {
  level = Number(level) || 1;
  if (level >= 19) return 4;
  if (level >= 12) return 3;
  if (level >= 4) return 2;
  return 1;
}

/** Weapon specialization damage by Weapons rank: +2 Expert, +3 Master, +4 Legendary. */
export const SPECIALIZATION = Object.freeze({
  untrained: 0, trained: 0, expert: 2, master: 3, legendary: 4
});

/** Multiple Attack Penalty. Agile weapons use the second column. */
export const MAP = Object.freeze({
  standard: [0, -5, -10],
  agile: [0, -4, -8]
});

/**
 * Load Strain reduction from your Endure rank, once you own Endure Training. Trained buys none of
 * it: the relief starts at Expert (PHB v3.2 reword of Endure Training).
 */
export const LOAD_RELIEF = Object.freeze({
  untrained: 0, trained: 0, expert: 1, master: 2, legendary: 3
});

/* -------------------------------------------- */
/*  Degrees of success                          */
/* -------------------------------------------- */

/**
 * The four bands, named from the attacker's point of view. STARWROUGHT's signature change is
 * that "failure" is a Graze: reduced damage, and a Zone opens on the defender.
 */
export const DEGREES = Object.freeze({
  critFail: { label: "STARWROUGHT.Degree.critFail", attack: "miss", order: 0 },
  fail: { label: "STARWROUGHT.Degree.fail", attack: "graze", order: 1 },
  success: { label: "STARWROUGHT.Degree.success", attack: "hit", order: 2 },
  critSuccess: { label: "STARWROUGHT.Degree.critSuccess", attack: "critical", order: 3 }
});

export const DEGREE_ORDER = Object.freeze(["critFail", "fail", "success", "critSuccess"]);

/** Attack outcome labels, keyed by degree. */
export const ATTACK_OUTCOMES = Object.freeze({
  critFail: { label: "STARWROUGHT.Outcome.miss", key: "miss", damage: null },
  fail: { label: "STARWROUGHT.Outcome.graze", key: "graze", damage: "graze" },
  success: { label: "STARWROUGHT.Outcome.hit", key: "hit", damage: "hit" },
  critSuccess: { label: "STARWROUGHT.Outcome.critical", key: "critical", damage: "critical" }
});

/**
 * Compare a check total to a Threshold and return the degree.
 * A natural 20 steps the result up one band, a natural 1 steps it down.
 * @param {number} total
 * @param {number} threshold
 * @param {number|null} natural  The face of the d20, if it was a single d20 roll.
 * @returns {string} A key of DEGREES.
 */
export function degreeOf(total, threshold, natural = null) {
  const delta = total - threshold;
  let index;
  if (delta >= 10) index = 3;
  else if (delta >= 0) index = 2;
  else if (delta > -10) index = 1;
  else index = 0;
  if (natural === 20) index = Math.min(3, index + 1);
  else if (natural === 1) index = Math.max(0, index - 1);
  return DEGREE_ORDER[index];
}

/**
 * Invert a degree. A Defense roll is the same comparison read from the other side: beating an
 * Attack Threshold by 10 is a Miss for the attacker, missing it by 10 is their Critical Hit.
 * @param {string} degree
 * @returns {string}
 */
export function invertDegree(degree) {
  return DEGREE_ORDER[3 - DEGREE_ORDER.indexOf(degree)];
}

/* -------------------------------------------- */
/*  Going down                                  */
/* -------------------------------------------- */

export const DYING_MAX = 5;
export const HERO_POINTS_MAX = 3;

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

/** Action costs and the glyphs the handbook prints for them. */
export const ACTION_COSTS = Object.freeze({
  0: { label: "STARWROUGHT.Action.passive", glyph: "" },
  1: { label: "STARWROUGHT.Action.one", glyph: "◆" },
  2: { label: "STARWROUGHT.Action.two", glyph: "◆◆" },
  3: { label: "STARWROUGHT.Action.three", glyph: "◆◆◆" },
  free: { label: "STARWROUGHT.Action.free", glyph: "◇" },
  reaction: { label: "STARWROUGHT.Action.reaction", glyph: "↺" }
});

/**
 * Read an action's cost out of the glyphs the handbook prints in its name.
 *
 * Several actions cost a range rather than a number, and the handbook writes both ends into the
 * name: "Strike ◆ to ◆◆◆" is one action or three, and "Disarm ◆ or ◆◆◆" is one or three with
 * nothing in between. Counting every diamond in the string makes Strike a three-action activity,
 * which is how this was wrong the first time.
 *
 * @param {string} name
 * @returns {{cost: string, costMax: string, costMode: "to"|"or"}}
 */
export function parseActionCost(name) {
  const text = String(name ?? "");
  if (/↺/.test(text)) return { cost: "reaction", costMax: "", costMode: "to" };
  if (/◇/.test(text)) return { cost: "free", costMax: "", costMode: "to" };
  const runs = text.match(/◆+/g);
  if (!runs?.length) return { cost: "0", costMax: "", costMode: "to" };
  const min = String(Math.min(3, runs[0].length));
  if (runs.length === 1) return { cost: min, costMax: "", costMode: "to" };
  const max = String(Math.min(3, runs[runs.length - 1].length));
  return {
    cost: min,
    costMax: max === min ? "" : max,
    costMode: /\bor\b/i.test(text) ? "or" : "to"
  };
}

/** The icon a freshly created Item of each type gets, rather than the generic bag. */
export const TYPE_ICONS = Object.freeze({
  constellation: "systems/starwrought/assets/icons/constellation.svg",
  talent: "systems/starwrought/assets/icons/talent.svg",
  chassis: "systems/starwrought/assets/icons/chassis.svg",
  weapon: "icons/svg/sword.svg",
  armor: "icons/svg/shield.svg",
  shield: "icons/svg/shield.svg",
  gear: "icons/svg/item-bag.svg",
  action: "icons/svg/target.svg"
});

/** Item types that represent an owned Talent-like thing rather than gear. */
export const FEATURE_TYPES = Object.freeze(["talent", "chassis", "action"]);

/** Item types that can be equipped. */
export const PHYSICAL_TYPES = Object.freeze(["weapon", "armor", "shield", "gear"]);

/**
 * Where a piece of equipment is.
 *
 * Held is in your hands: a weapon you can Strike with, a shield you can Raise. Worn is on your
 * body: armor covering a Zone, or a sheathed blade you could draw. Carried is in a pack, which
 * needs an action and a container to get at; containers are not in this playtest, so Carried is
 * where armor goes when it comes off.
 */
export const CARRY_STATES = Object.freeze({
  held: { label: "STARWROUGHT.Carry.held", icon: "fa-solid fa-hand-fist" },
  worn: { label: "STARWROUGHT.Carry.worn", icon: "fa-solid fa-shirt" },
  carried: { label: "STARWROUGHT.Carry.carried", icon: "fa-solid fa-sack" }
});

/**
 * The state in which each kind of equipment is actually doing its job: armor Protects while worn,
 * a weapon or shield works while held.
 */
export const ACTIVE_STATE = Object.freeze({
  armor: "worn",
  weapon: "held",
  shield: "held",
  gear: "held"
});

/* -------------------------------------------- */
/*  Conditions                                  */
/* -------------------------------------------- */

/**
 * Conditions, registered as Foundry status effects so they can be toggled on a token.
 * `numeric` conditions carry a value (Frightened 2, Stunned 1, Wounded 3).
 * `zone` conditions are Exposed, one per Zone.
 */
export const CONDITIONS = Object.freeze({
  offGuard: { id: "offGuard", name: "STARWROUGHT.Condition.offGuard", img: "icons/svg/downgrade.svg" },
  wrongFooted: { id: "wrongFooted", name: "STARWROUGHT.Condition.wrongFooted", img: "icons/svg/target.svg" },
  frightened: { id: "frightened", name: "STARWROUGHT.Condition.frightened", img: "icons/svg/terror.svg", numeric: true },
  prone: { id: "prone", name: "STARWROUGHT.Condition.prone", img: "icons/svg/falling.svg" },
  grabbed: { id: "grabbed", name: "STARWROUGHT.Condition.grabbed", img: "icons/svg/net.svg" },
  restrained: { id: "restrained", name: "STARWROUGHT.Condition.restrained", img: "icons/svg/padlock.svg" },
  heedless: { id: "heedless", name: "STARWROUGHT.Condition.heedless", img: "icons/svg/explosion.svg" },
  stunned: { id: "stunned", name: "STARWROUGHT.Condition.stunned", img: "icons/svg/daze.svg", numeric: true },
  slowed: { id: "slowed", name: "STARWROUGHT.Condition.slowed", img: "icons/svg/clockwork.svg", numeric: true },
  fatigued: { id: "fatigued", name: "STARWROUGHT.Condition.fatigued", img: "icons/svg/unconscious.svg" },
  blinded: { id: "blinded", name: "STARWROUGHT.Condition.blinded", img: "icons/svg/blind.svg" },
  deafened: { id: "deafened", name: "STARWROUGHT.Condition.deafened", img: "icons/svg/deaf.svg" },
  concealed: { id: "concealed", name: "STARWROUGHT.Condition.concealed", img: "icons/svg/light-off.svg" },
  hidden: { id: "hidden", name: "STARWROUGHT.Condition.hidden", img: "icons/svg/mystery-man.svg" },
  undetected: { id: "undetected", name: "STARWROUGHT.Condition.undetected", img: "icons/svg/invisible.svg" },
  unconscious: { id: "unconscious", name: "STARWROUGHT.Condition.unconscious", img: "icons/svg/unconscious.svg" },
  dying: { id: "dying", name: "STARWROUGHT.Condition.dying", img: "icons/svg/skull.svg", numeric: true },
  wounded: { id: "wounded", name: "STARWROUGHT.Condition.wounded", img: "icons/svg/blood.svg", numeric: true },
  dead: { id: "dead", name: "STARWROUGHT.Condition.dead", img: "icons/svg/skull.svg" }
});

/** Conditions that impose a flat penalty on Evade and Guard. */
export const OFF_GUARD_PENALTY = -2;

/** Unwieldy N: the circumstance penalty to attack rolls against a target within N feet. */
export const UNWIELDY_PENALTY = -2;

/* -------------------------------------------- */
/*  Bonus types                                 */
/* -------------------------------------------- */

/**
 * Bonuses of the same type do not stack: take the highest bonus and the worst penalty of each
 * type, then add those two together.
 */
export const BONUS_TYPES = Object.freeze(["circumstance", "status", "item", "untyped"]);

/**
 * Collapse a list of typed modifiers per the Math Conventions: highest bonus and worst penalty
 * of each type are added together; untyped modifiers all stack.
 * @param {Array<{label: string, value: number, type?: string, enabled?: boolean}>} modifiers
 * @returns {{total: number, applied: Array}}
 */
export function resolveModifiers(modifiers = []) {
  const active = modifiers.filter(m => m && m.enabled !== false && Number.isNumeric(m.value) && m.value !== 0);
  const best = {};
  const applied = [];
  let total = 0;
  for (const mod of active) {
    const type = mod.type ?? "untyped";
    if (type === "untyped") {
      total += mod.value;
      applied.push(mod);
      continue;
    }
    const bucket = (best[type] ??= { positive: null, negative: null });
    const side = mod.value > 0 ? "positive" : "negative";
    const current = bucket[side];
    const better = side === "positive" ? mod.value > (current?.value ?? -Infinity) : mod.value < (current?.value ?? Infinity);
    if (better) bucket[side] = mod;
  }
  for (const bucket of Object.values(best)) {
    for (const mod of [bucket.positive, bucket.negative]) {
      if (!mod) continue;
      total += mod.value;
      applied.push(mod);
    }
  }
  return { total, applied };
}

/* -------------------------------------------- */
/*  Runtime registry                            */
/* -------------------------------------------- */

/**
 * Constellation metadata, keyed by slug, populated at init from the shipped content index and
 * overridden by any Constellation Item found in the world or a compendium. Talents reference
 * their Constellation by slug, so this registry is what turns a slug into a Key Attribute.
 * @type {Record<string, {slug: string, name: string, category: string, attribute: string, img?: string}>}
 */
export const constellations = {};

/**
 * Register (or override) Constellation metadata.
 * @param {object} data
 */
export function registerConstellation(data) {
  if (!data?.slug) return;
  constellations[data.slug] = Object.assign(constellations[data.slug] ?? {}, data);
}

/** Look up a Constellation by slug, falling back to a synthetic entry so nothing ever throws. */
export function getConstellation(slug) {
  if (!slug) return null;
  return constellations[slug] ?? {
    slug,
    name: slug.replace(/-/g, " ").titleCase(),
    category: "general",
    attribute: "might"
  };
}

/**
 * Is this slug the Lore template or one of its instances?
 *
 * Lore is authored as a Skill constellation, because that is what it is in the book, but every
 * Lore (X) is a copy with its own rank and the game gives Lore its own kind of Talent Point. So
 * the system files them under their own category, and that decision lives here so the sheet, the
 * chargen pickers and the point scopes cannot disagree about it.
 */
export function isLoreSlug(slug) {
  return (slug === "lore") || String(slug ?? "").startsWith("lore-");
}

/** Slugify a Constellation or Talent name the same way everywhere. */
export function slugify(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[◆◇↺★✦✧]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
