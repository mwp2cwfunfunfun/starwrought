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

/**
 * Attribute Bonus = Attribute Points ÷ 4, rounded down (PHB v4.10: 0-3 is +0, 4-7 is +1, 8-11 is +2,
 * every 4 more is +1 more). The +5 cap is the Key Terms sentence, kept until the book repeals it
 * (v4.10 sync report, ruling 1).
 */
export const ATTRIBUTE_DIVISOR = 4;
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
// PHB v4.10: the Proficiency Bonus is the whole of a check's training term; level never touches
// the die. Trained +3, Expert +6, Master +9, Legendary +12, gated at levels 1 / 5 / 10 / 15.
export const RANKS = Object.freeze({
  untrained: { label: "STARWROUGHT.Rank.untrained", abbr: "U", bonus: 0, points: 0, level: 0, order: 0 },
  trained: { label: "STARWROUGHT.Rank.trained", abbr: "T", bonus: 3, points: 1, level: 1, order: 1 },
  expert: { label: "STARWROUGHT.Rank.expert", abbr: "E", bonus: 6, points: 4, level: 5, order: 2 },
  master: { label: "STARWROUGHT.Rank.master", abbr: "M", bonus: 9, points: 9, level: 10, order: 3 },
  legendary: { label: "STARWROUGHT.Rank.legendary", abbr: "L", bonus: 12, points: 16, level: 15, order: 4 }
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

/**
 * Has a rank reached a minimum? Compares `RANKS[...].order`, so Legendary satisfies an Expert
 * gate. An absent minimum (null or undefined) is no gate at all and is always met: that is how a
 * Reaction granted by a Root alone reads (see REACTIONS). An unrecognised actor rank reads as
 * Untrained; an unrecognised minimum is a gate nobody can name, so it is never met rather than
 * silently open (ruling 63, Counter at Melee Expert).
 * @param {string} rank      The rank held, a key of RANKS.
 * @param {string} [minimum] The rank required, a key of RANKS, or nothing for no requirement.
 * @returns {boolean}
 */
export function rankAtLeast(rank, minimum) {
  if (minimum === undefined || minimum === null) return true;
  const need = RANKS[minimum]?.order;
  if (need === undefined) return false;
  return (RANKS[rank]?.order ?? 0) >= need;
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

/**
 * The version this code was shipped as. Foundry reads system.json on the server, so
 * `game.system.version` is always the server's; if this disagrees with it, the browser is running
 * a cached copy of an older release. `assets/package_system.mjs` refuses to package unless this,
 * `--sw-css-version` in styles/starwrought.css and system.json all agree.
 */
export const SYSTEM_VERSION = "0.9.0";

/**
 * THE CONTENT LOOP (0.8.0; the content-loop brief, Mike 2026-10-03; ruling 115). The pack sources
 * are the content; the compiled LevelDB packs are a release artifact. `node assets/build_all.mjs
 * --content` writes `packs/_source/<pack>/*.json` and, beside them, `packs/_source/index.json`:
 * every document and folder by id with its content hash, and one `build` hash over all of them.
 * Foundry serves the system folder as static files, so the open world reads both over HTTP and
 * `module/apps/content-sync.mjs` brings the compendia level with them in place, no restart. These
 * two paths are the only place the layout is named on the Foundry side; the builder's SOURCE
 * constant is the same folder from the other end.
 */
export const CONTENT_INDEX_PATH = "systems/starwrought/packs/_source/index.json";
export const CONTENT_SOURCE_PATH = "systems/starwrought/packs/_source";

/**
 * The two parent Constellations every Strike rolls (PHB v4.10): Melee for anything in your hand,
 * Ranged for anything that leaves it, a thrown dagger included. Every Combat Style is a child of
 * one of them, and a child's Talents count toward the parent's rank (rank only: the parent's own
 * Talents must still be bought, and Attribute Points are never counted twice).
 */
export const MELEE_SLUG = "melee";
export const RANGED_SLUG = "ranged";
/** @deprecated v3.4 had one Weapons Constellation. Kept for the migration of old Talents. */
export const WEAPONS_SLUG = "weapons";

/**
 * Talents the book moved between Constellations, keyed by the slug of their bare name. An owned
 * copy keeps its document id and is filed where the book now prints it (PHB v4.10: Loose and Move
 * left Archery for Ranged).
 */
export const MOVED_TALENTS = Object.freeze({
  "loose-and-move": { from: "archery", to: RANGED_SLUG }
});

/**
 * The four kinds of threat and the two Defenses that answer each (PHB v4.10, The Four Threats).
 * Guard answers a ranged Blow only with a shield Raised.
 */
export const THREATS = Object.freeze({
  blow: { label: "STARWROUGHT.Threat.blow", defenses: ["evade", "guard"] },
  blast: { label: "STARWROUGHT.Threat.blast", defenses: ["evade", "endure"] },
  blight: { label: "STARWROUGHT.Threat.blight", defenses: ["endure", "awareness"] },
  beguilement: { label: "STARWROUGHT.Threat.beguilement", defenses: ["awareness", "guard"] }
});

/**
 * The three Strikes (PHB v4.10, The Exchange). The count of actions is a statement about how much
 * of yourself is behind the blow.
 *  - Quick ❶: one weapon die plus precision, nothing else; cannot Critically Hit unless the weapon
 *    is Agile (a natural 20 is a Hit); lands on the Torso; full Protection even on an Exposed Zone;
 *    Stopped, it forms at most a neutral Bind and is never Controlled; a Miss Exposes you whatever
 *    the Strike (The Result).
 *  - Deliberate ❷: all dice, specialization and Might; may be placed on an Exposed Zone; a Critical
 *    Hit lets the attacker Expose a plausible Zone; a Miss Exposes the attacker (defender's choice
 *    of Zone); a Parry that Stops it takes Control.
 *  - Committed ❸: Prepared (one action now, two reserved, resolves at the next Opportunity); all
 *    dice; on any Hit may Expose a plausible Zone; Weighted: Stopped at all (Graze or Miss) Exposes
 *    the attacker; a Parry that Stops it takes Control.
 */
export const STRIKE_KINDS = Object.freeze({
  quick: {
    label: "STARWROUGHT.Strike.quick", cost: 1, full: false, canCrit: false, agileCanCrit: true,
    placeOnExposed: false, ignoresExposedProtection: false, exposeOnMiss: true, weighted: false,
    prepared: false, controllable: false
  },
  deliberate: {
    label: "STARWROUGHT.Strike.deliberate", cost: 2, full: true, canCrit: true, agileCanCrit: true,
    placeOnExposed: true, ignoresExposedProtection: true, exposeOnMiss: true, weighted: false,
    prepared: false, controllable: true
  },
  committed: {
    label: "STARWROUGHT.Strike.committed", cost: 3, full: true, canCrit: true, agileCanCrit: true,
    placeOnExposed: true, ignoresExposedProtection: true, exposeOnMiss: true, weighted: true,
    prepared: true, controllable: true
  }
});
export const DEFAULT_STRIKE = "deliberate";

/**
 * The Reactions the Exchange names (PHB v4.10, Answering an Attack). Each is granted by a Talent
 * (`talent`: the slug of the Constellation whose Training root grants it) and paid from the same
 * six actions. `rank`, when present, is the minimum rank in that Constellation as well: the Root
 * must be owned and the derived rank must have reached it (a Combat Style's points count toward
 * Melee once Melee Training is owned, ruling 13). Absent, the Root alone grants the Reaction.
 * Counter is Melee Expert (Mike, 2026-10-01, ruling 63: Melee Training gives one Reaction at
 * Trained, Intercept; Counter arrives at Expert). The handbook still prints Counter under Melee
 * Training; the book is Mike's to bring across.
 */
export const REACTIONS = Object.freeze({
  parry: { label: "STARWROUGHT.Reaction.parry", cost: 1, defense: "guard", bonus: 2, talent: "guard", rigid: true },
  void: { label: "STARWROUGHT.Reaction.void", cost: 1, defense: "evade", bonus: 2, talent: "evade", rigid: false },
  counter: { label: "STARWROUGHT.Reaction.counter", cost: 1, defense: null, bonus: 0, talent: MELEE_SLUG, rank: "expert", rigid: false },
  intercept: { label: "STARWROUGHT.Reaction.intercept", cost: 1, defense: null, bonus: 0, talent: MELEE_SLUG, rigid: false },
  posture: { label: "STARWROUGHT.Reaction.posture", cost: 0, defense: null, bonus: 0, talent: null, rigid: false }
});

/**
 * The Postures the two Defense Training roots grant in their own text (PHB v4.10, the Reaction
 * table: Give Ground ⓿↺ with Evade Training, Set Your Feet ⓿↺ with Guard Training; +2 Situation to
 * the named Defense for the triggering attack, a Zone of your choice Exposed until the end of the
 * round, win or lose). They are not Talents of their own, so the Combat Prompt offers them on the
 * root Talent's id once the root is owned (0.5.3; Mike: "Where can I choose my Posture, like Give
 * Ground or Set Your Feet?"). Keyed by the Defense's Constellation slug.
 */
export const ROOT_POSTURES = Object.freeze({
  evade: {
    name: "Give Ground ⓿↺",
    label: "STARWROUGHT.Posture.giveGround",
    effect: "+2 Situation bonus to Evade for the triggering attack. A Zone of your choice becomes Exposed until the end of the round, win or lose; Recenter does not clear it."
  },
  guard: {
    name: "Set Your Feet ⓿↺",
    label: "STARWROUGHT.Posture.setYourFeet",
    effect: "+2 Situation bonus to Guard for the triggering attack. A Zone of your choice becomes Exposed until the end of the round, win or lose; Recenter does not clear it."
  }
});

/** Support: +1 Situation to melee attacks per other conscious ally whose Total Reach includes the target, to this maximum. */
export const SUPPORT_MAX = 2;
/** Evading a Graze gives this much ground, directly away from the attacker. */
export const GIVE_GROUND_FEET = 3;
/** The Parry weapon trait: a Gear bonus to Guard against melee Attacks while wielded (PHB v4.10). */
export const PARRY_GUARD_BONUS = 1;
/** The Situation penalty to attacks with a weapon someone else Controls, and to attacks by a Controlled Arm's owner. */
export const CONTROLLED_PENALTY = -2;

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

/**
 * The Critical Hit effect of each Zone (until the target Recenters), and the Wound the Zone
 * carries: its critical effect made lasting (PHB v4.10, Wounds). `first` is every Wound short of
 * the last; `final` is what fills the Zone's capacity. Torso and Head final Wounds are Dying.
 */
export const ZONE_CRITICALS = Object.freeze({
  head: { effect: "STARWROUGHT.ZoneCrit.head", first: "STARWROUGHT.Wound.headFirst", final: "STARWROUGHT.Wound.headFinal", finalDying: true },
  torso: { effect: "STARWROUGHT.ZoneCrit.torso", first: "STARWROUGHT.Wound.torsoFirst", final: "STARWROUGHT.Wound.torsoFinal", finalDying: true },
  arms: { effect: "STARWROUGHT.ZoneCrit.arms", first: "STARWROUGHT.Wound.armsFirst", final: "STARWROUGHT.Wound.armsFinal", finalDying: false },
  legs: { effect: "STARWROUGHT.ZoneCrit.legs", first: "STARWROUGHT.Wound.legsFirst", final: "STARWROUGHT.Wound.legsFinal", finalDying: false }
});

/**
 * How many Wounds a Zone carries before its final effect (PHB v4.10, Wound capacity): Medium or
 * smaller 2, Large 3, Huge 4, Gargantuan 5. A creature template may add to it (`system.woundBonus`).
 */
export const WOUND_CAPACITY = Object.freeze({
  tiny: 2, small: 2, medium: 2, large: 3, huge: 4, gargantuan: 5
});

/** The first Torso Wound bleeds. */
export const TORSO_WOUND_BLEED = "1d4";

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
 * Weapon damage dice by character level (PHB v4.10): two dice at 4th, three at 8th, four at 12th,
 * five at 16th. A Quick Strike and a Graze roll one die whatever the level.
 * @param {number} level
 * @returns {number}
 */
export function weaponDice(level) {
  level = Number(level) || 1;
  if (level >= 16) return 5;
  if (level >= 12) return 4;
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

/** Weapon specialization damage by Melee or Ranged rank: +2 Expert, +3 Master, +4 Legendary. */
export const SPECIALIZATION = Object.freeze({
  untrained: 0, trained: 0, expert: 2, master: 3, legendary: 4
});

// There is no Multiple Attack Penalty in v4.10. Tempo is paid in actions: six a round, spread
// across Opportunities, and a Reaction costs the same actions an attack does.

/**
 * Load Strain reduction from your Endure rank, once you own Endure Training (PHB v4.11, Endure
 * Training: "reduce your Load Strain by 1 at Trained, 2 at Expert, 3 at Master, and 4 at
 * Legendary", to a minimum of 0). Until v4.11 the relief began at Expert (ruling R5).
 */
export const LOAD_RELIEF = Object.freeze({
  untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4
});

/**
 * The Endure Bonus to Vigor (PHB v4.11, Endure Training: "at Expert rank in Endure you gain 1
 * more Vigor at every level, 2 at Master, and 3 at Legendary"). It is the per-level term beside
 * Ancestry Vigor, read live from the current Endure rank, so it counts at 1st level too, where it
 * is 0 (ruling R1).
 */
export const ENDURE_VIGOR_BONUS = Object.freeze({
  untrained: 0, trained: 0, expert: 1, master: 2, legendary: 3
});

/**
 * Where Load Strain lands on a check (PHB v4.11, Load and Load Strain: "Climb, Swim, and Stealth
 * checks take your Load Strain as a penalty. Nothing else does"). Stealth is a Constellation of
 * its own, so the engine applies it. Climb and Swim are Athletics checks the engine cannot tell
 * from a grapple or a tumble, so the roll dialog offers the penalty there, unticked, for the
 * player to take when the check is one of those (ruling R2). Evade never takes it.
 */
export const STRAIN_CHECKS = Object.freeze({ stealth: "always", athletics: "offered" });

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
/** The Recovery check while Dying: Endure against 10 + Dying value + Wounds carried. */
export const RECOVERY_BASE = 10;
/** Treating a Wound: ten minutes and an Endure check against 10 + the Wounds the patient carries. */
export const TREAT_WOUND_BASE = 10;

/* -------------------------------------------- */
/*  Advancement                                 */
/* -------------------------------------------- */

/**
 * Milestones that each grant a Milestone Talent Point before the next one is a level (PHB v4.10,
 * Character Mechanics: four make a level, and the fourth is the level itself). Read by the
 * character sheet's star pips and, since 0.7.0, by the Party Sheet's Milestone award
 * (party-sheet-plan.md, part 3), so both count from one constant: an award to a member already at
 * this count raises the level and resets the count, and current Vigor rises with the maximum
 * (ruling 92). It lived in apps/actor-sheet.mjs until 0.7.0.
 */
export const MILESTONES_PER_LEVEL = 3;

/**
 * The flag on a character (`flags.starwrought.trainedAt`) the Party Sheet's Downtime panel writes
 * when a member Trains (0.7.5; party-sheet-plan.md, part 10; ruling 113): `{ level, milestone,
 * time }`, the level and Milestone count the seven days' training happened at and when. A flag
 * and not schema, as the plan says: it is a reminder's record, read by `trainUsed` in
 * helpers/party.mjs for the panel's amber mark and by `SwActor#toggleFlare`'s card for its warning
 * line, and compared against the character's current count rather than cleared, so the next
 * Milestone award makes it stale and nothing has to reset it (the plan's judge struck a
 * `trainedSinceMilestone` field the award would have had to clear). Nothing refuses a Train for it
 * (decision 14).
 */
export const TRAINED_AT_FLAG = "trainedAt";

/* -------------------------------------------- */
/*  The party (0.7.0)                           */
/* -------------------------------------------- */

/**
 * The Actor type of a party (party-sheet-plan.md, phase 1; Mike's "Go!", 2026-10-02): the GM's
 * console and the players' window at once, GM-owned with Observer players, holding only party
 * bookkeeping (members, the session, the last Milestone award, notes) and reading everything about
 * its members live at render. Its data model extends TypeDataModel directly, never SwActorData, so
 * it has no Zones, Vigor, stance or actions, and a party is never a combatant: Support's ally
 * count, `actorsIn` in combat.mjs and the Combat Tracker's readout skip an actor of this type by
 * name (the plan's risk 1), so no card, readout or bonus ever involves a party.
 *
 * The rulings the sheet is built to (91 to 95, continuing the v4.14 report's numbering): a
 * Milestone award goes to every member by default, with a checkbox per member to withhold it (91);
 * when the fourth Milestone raises a level, current Vigor rises by the same amount as the maximum
 * (92); Begin session sets every member's Hero Points to exactly 1 (93); Deferred Talent Points are
 * counted on the character and nothing is enforced (94); players see every member's Thresholds on
 * the Skills grid (95).
 *
 * Phase 2 (0.7.1; rulings 96 to 100): the party's embedded Items are its loot, PHYSICAL_TYPES only
 * (documents/item.mjs refuses the rest in `_preCreate`), and `system.currency` its purse. Neither
 * is a rule: they move Items and coin and value nothing (96). A player's Take or Give runs on the
 * active GM's client over the system socket (documents/party-socket.mjs), the asker read from the
 * server's stamp, destination written before source, requests served in arrival order, and with
 * no GM connected nothing is written (97); a party Item dropped on a character sheet moves the
 * whole stack (98); Split divides the purse equally in copper and the remainder stays (99); Ask
 * everyone posts one party card with a Roll button per member for its owner or the GM (100).
 */
export const PARTY_TYPE = "party";

/* -------------------------------------------- */
/*  On the road (0.7.2)                         */
/* -------------------------------------------- */

/**
 * Phase 3 of the Party Sheet (party-sheet-plan.md, parts 8 and 9; rulings 101 to 107): the
 * Exploration Mode Activity each character is doing, the party's Travel Speed, and Initiative by
 * Activity when the encounter begins. The Activity data itself is content, not code: two
 * positional columns on the roster's `explorationActions` rows (the Constellation the Activity
 * rolls now, and the one it rolls for Initiative, each a name as the trees print it, blank, or
 * ACTIVITY_CHOICE for the member's own pick), which `assets/build_foundry.mjs` writes onto the
 * Activity Item as `system.exploration` and `system.check` (ruling 104). What follows here is the
 * handful of words the book uses that the data only names. Nothing in it is enforced: a Fatigued
 * character's select locks to Travel and the stored pick waits (ruling 101), the party's speed is
 * a line of text and no token moves (ruling 102), and a Scout's Step is announced and not taken
 * (ruling 105).
 */

/**
 * What an Activity does to Travel Speed (PHB v4.15, Exploration Mode: "Exploration Mode Activities
 * (such as Avoid Notice) halve it, except Hustle, which doubles it"; Travel is the full figure).
 * Keyed by the roster row's Speed word, lowercased; the Activity Item derives `multiplier` from it,
 * and the party's Travel Speed is the lowest member's Speed × multiplier, through the book's three
 * formulae in TRAVEL (ruling 102).
 */
export const ACTIVITY_SPEEDS = Object.freeze({
  full: { label: "STARWROUGHT.Travel.full", multiplier: 1 },
  half: { label: "STARWROUGHT.Travel.half", multiplier: 0.5 },
  double: { label: "STARWROUGHT.Travel.double", multiplier: 2 }
});

/**
 * Terrain (PHB v4.15, P343 to P344: "Difficult Terrain halves it; Greater Difficult Terrain cuts it
 * to one-third"). A select on the party (`system.travel.terrain`) and a word on the card, display
 * only (ruling 102).
 */
export const TERRAIN = Object.freeze({
  normal: { label: "STARWROUGHT.Travel.terrainNormal", multiplier: 1 },
  difficult: { label: "STARWROUGHT.Travel.terrainDifficult", multiplier: 0.5 },
  greater: { label: "STARWROUGHT.Travel.terrainGreater", multiplier: 1 / 3 }
});

/**
 * What Begin the encounter does for an Activity beyond its Initiative Constellation (ruling 105).
 * build_foundry.mjs sets the tag from the slug of the roster row's name, so Scout and Defend carry
 * one and every other row carries "": a row Mike adds needs no code unless it does something new
 * (ruling 104). `scout`: every OTHER member's Combatant gets +1 Situation to Initiative
 * (SCOUT_INITIATIVE_BONUS) and the Scout may Step ⓿ on rolling it, which the card says and
 * nothing moves. `defend`: the held shield begins Raised, no action spent and no card of its own;
 * it comes down at the Defender's first Opportunity as any raised shield does, which is what
 * "begins Raised" buys.
 */
export const EXPLORATION_EFFECTS = Object.freeze({
  scout: { label: "STARWROUGHT.Travel.effectScout" },
  defend: { label: "STARWROUGHT.Travel.effectDefend" }
});

/**
 * Scout (PHB v4.15, Table 95): "Every ally gains a +1 Situation bonus to initiative". Written onto
 * each other member's Combatant as an `initiativeModifiers` entry of type "situation", one per
 * Scout; two Scouts give each other one and everyone else two of the same type, of which one
 * applies, as the stacking rule in BONUS_TYPES says (ruling 105).
 */
export const SCOUT_INITIATIVE_BONUS = 1;

/**
 * The token the two roster columns use for "the member's own pick": Investigate rolls the Lore or
 * Skill the character chose (`system.exploration.constellation`) now and for Initiative. The
 * builder writes it through as is; Begin the encounter resolves it against the character's pick,
 * Awareness when there is none, before writing the Combatant's flag (ruling 105).
 */
export const ACTIVITY_CHOICE = "choice";

/* -------------------------------------------- */
/*  Actions: six a round                        */
/* -------------------------------------------- */

/**
 * PHB v4.10: every combatant receives six actions at the start of each round; they expire at the
 * end of it. Play cycles through the initiative order and each visit is an Opportunity: one
 * Maneuver you can afford, or Pass. A full circuit of Passes ends the round. Reactions are paid
 * from the same six. A Maneuver of three or more actions is Prepared: one action now, the rest
 * reserved, resolved at your next Opportunity.
 */
export const ACTIONS_PER_ROUND = 6;
/** A Maneuver costing this many actions or more is Prepared. */
export const PREPARED_THRESHOLD = 3;

/** The action glyphs the handbook prints (PHB v4.10, Symbols). ⓿ is free; ↺ marks the Reaction trait. */
export const ACTION_GLYPHS = Object.freeze({
  0: "⓿", 1: "❶", 2: "❷", 3: "❸", 4: "❹", 5: "❺", 6: "❻"
});
export const REACTION_GLYPH = "↺";

/**
 * Action costs. `passive` is a Talent that is not something you do (no glyph at all); `0` is a
 * free Maneuver ⓿, which never uses up your Opportunity. The Reaction trait is a separate flag on
 * the Item (`system.reaction`), since a Reaction has a cost of its own: Parry is ❶↺, a Posture ⓿↺.
 */
export const ACTION_COSTS = Object.freeze({
  passive: { label: "STARWROUGHT.Action.passive", glyph: "", value: 0 },
  0: { label: "STARWROUGHT.Action.free", glyph: "⓿", value: 0 },
  1: { label: "STARWROUGHT.Action.one", glyph: "❶", value: 1 },
  2: { label: "STARWROUGHT.Action.two", glyph: "❷", value: 2 },
  3: { label: "STARWROUGHT.Action.three", glyph: "❸", value: 3 },
  4: { label: "STARWROUGHT.Action.four", glyph: "❹", value: 4 },
  5: { label: "STARWROUGHT.Action.five", glyph: "❺", value: 5 },
  6: { label: "STARWROUGHT.Action.six", glyph: "❻", value: 6 }
});

/**
 * The v3.x cost keys, mapped onto v4.10's. "free" is ⓿; "reaction" was a free reaction slot, so it
 * is ⓿ with the Reaction trait; "0" on a Talent meant passive.
 */
export const LEGACY_ACTION_COSTS = Object.freeze({
  free: { cost: "0", reaction: false },
  reaction: { cost: "0", reaction: true }
});

/** The number of actions a cost key stands for. */
export function actionCostValue(key) {
  return ACTION_COSTS[key]?.value ?? 0;
}

const COST_TOKEN = /[⓿❶❷❸❹❺❻]|◆+|◇/g;
const tokenValue = token => {
  if (token === "⓿" || token === "◇") return 0;
  if (token[0] === "◆") return Math.min(6, token.length);
  return "❶❷❸❹❺❻".indexOf(token) + 1;
};

/**
 * Read a Maneuver's cost out of the glyphs the handbook prints in its name.
 *
 * Several Maneuvers cost a range rather than a number, and the handbook writes both ends into the
 * name: "Strike ❶ to ❸" is one action to three, and "Disarm ❶ or ❸" is one or three with nothing
 * in between. ↺ is the Reaction trait and rides beside a cost ("Parry ❶↺", "Battle Cry ⓿↺"). The
 * v3.x glyphs ◆ (one action per diamond) and ◇ (free) still parse, so older data converts.
 *
 * @param {string} name
 * @returns {{cost: string, costMax: string, costMode: "to"|"or", reaction: boolean}}
 */
export function parseActionCost(name) {
  let text = String(name ?? "");
  // "Aid ❶ (⓿↺)": the Maneuver costs ❶ and its Reaction half costs ⓿. The bracketed part is the
  // Reaction's own cost, not the far end of a range.
  let reactionCost = "";
  const bracketed = text.match(/\(([^)]*)\)/);
  if (bracketed && COST_TOKEN.test(bracketed[1])) {
    COST_TOKEN.lastIndex = 0;
    const inner = bracketed[1].match(COST_TOKEN) ?? [];
    if (inner.length) reactionCost = String(tokenValue(inner[0]));
    text = text.replace(bracketed[0], " ");
  }
  COST_TOKEN.lastIndex = 0;
  const reaction = String(name ?? "").includes(REACTION_GLYPH);
  const tokens = text.match(COST_TOKEN) ?? [];
  if (!tokens.length) {
    // A bare ↺ (v3.x "Aid ↺") was a free reaction; no glyph at all is a passive Talent.
    return { cost: reaction ? "0" : "passive", costMax: "", costMode: "to", reaction, reactionCost };
  }
  const min = String(tokenValue(tokens[0]));
  if (tokens.length === 1) return { cost: min, costMax: "", costMode: "to", reaction, reactionCost };
  const max = String(tokenValue(tokens[tokens.length - 1]));
  return {
    cost: min,
    costMax: max === min ? "" : max,
    // Only an "or" between two glyphs is a cost joiner; one in the name is not.
    costMode: /(?:[⓿❶❷❸❹❺❻◇]|◆+)\s*or\s*(?:[⓿❶❷❸❹❺❻◇]|◆+)/i.test(text) ? "or" : "to",
    reaction,
    reactionCost
  };
}

/** Render a cost the way the handbook prints it: "❶", "❶ to ❸", "❶ or ❸", "❶↺", "⓿↺", "❶ (⓿↺)". */
export function costGlyphs({ cost, costMax = "", costMode = "to", reaction = false, reactionCost = "" } = {}) {
  const min = ACTION_COSTS[cost]?.glyph ?? "";
  const max = costMax && costMax !== cost ? (ACTION_COSTS[costMax]?.glyph ?? "") : "";
  const range = max ? `${min} ${costMode === "or" ? "or" : "to"} ${max}` : min;
  if (!reaction) return range.trim();
  // A Maneuver whose Reaction half has a cost of its own prints both, as Aid does.
  if (reactionCost !== "" && reactionCost !== cost) {
    return `${range} (${ACTION_COSTS[reactionCost]?.glyph ?? ""}${REACTION_GLYPH})`.trim();
  }
  return `${range}${REACTION_GLYPH}`.trim();
}

/* -------------------------------------------- */
/*  Movement                                    */
/* -------------------------------------------- */

/**
 * PHB v4.10: Speed is how far a single Move ❶ carries you, in feet; a Human's is 6. A Step ❶ is
 * half your Speed and never provokes; a Rush ❸ is five times your Speed in a straight line, less
 * your Load Strain in feet. Leap ❶ is 10 feet (less Load Strain) or 3 up; Crawl ❶ is 3 feet.
 */
export const DEFAULT_SPEED = 6;
export const STEP_DIVISOR = 2;
export const RUSH_MULTIPLIER = 5;
export const LEAP_FEET = 10;
export const CRAWL_FEET = 3;
/** Exploration Mode: feet per minute, miles per hour, miles per day, as multiples of Speed. */
export const TRAVEL = Object.freeze({ feetPerMinute: 40, milesPerHour: 0.5, milesPerDay: 4 });
/**
 * At the end of this round and every round after, a fighter carrying Load Strain 1 or more rolls
 * Endure against 10 + Load Strain or grows Fatigued (PHB v4.13, Wind), unless their Endure
 * Threshold already meets that number: then there is no Wind check at all (ruling 74). The v4.11
 * and v4.12 books delayed the first check to the end of the third round; v4.13 says "at the end
 * of every round while in an encounter", so the check comes from round 1 (ruling 79). The
 * character model derives the comparison as `system.wind` (threshold, endureThreshold, exempt,
 * due).
 */
export const WIND_ROUND = 1;
/**
 * Fatigued N rises by 1 on each failed Wind check, to this ceiling (PHB v4.13, Wind). It ends with
 * ten minutes of rest and with nothing else: the Fatigued card's "Ten minutes' rest" button or a
 * night's rest clears it (ruling 81), never the end of the Combat (through 0.6.1 it did).
 */
export const FATIGUED_MAX = 3;
/** Helm penalties to Awareness checks, the Awareness Threshold and Initiative, by the Head piece's name. */
export const HELM_PENALTIES = Object.freeze({ "Closed helm": -2, "Open helm": -1 });

/* -------------------------------------------- */
/*  Auras (0.5.1)                               */
/* -------------------------------------------- */

/**
 * Who an aura concerns. An ability's "within N feet" is drawn around its carrier, and the colour
 * says at a glance whether the ring is a gift to allies, a threat to enemies, or simply a distance.
 */
export const AURA_AUDIENCES = Object.freeze({
  all: { label: "STARWROUGHT.Field.auraAffectsAll" },
  allies: { label: "STARWROUGHT.Field.auraAffectsAllies" },
  enemies: { label: "STARWROUGHT.Field.auraAffectsEnemies" }
});

/**
 * The colour an aura is drawn in, by audience, as the "#rrggbb" strings the stylesheet's tokens
 * hold (--sw-green, --sw-blood, --sw-presence), so a swatch on the sheet and the ring on the map are
 * the same colour. A custom ring carries its own colour in this form, which is why these are strings
 * and not PIXI numbers; the canvas converts with Color.from.
 */
export const AURA_COLORS = Object.freeze({
  allies: "#5f9e6a",
  enemies: "#b4453f",
  all: "#c07ad8"
});

/**
 * The reach bands in the same form, keyed as the entries of `actor.system.ranges` are: Natural
 * Reach, Total Reach and the Unwieldy dead zone. They mirror the colours reach.mjs has always drawn.
 */
export const REACH_COLORS = Object.freeze({
  reach: "#7fb3c8",
  totalReach: "#e3b23c",
  unwieldy: "#b4453f"
});

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
 * `numeric` conditions carry a value (Frightened 2, Fatigued 1, Stunned 1, Wounded 3).
 * `zone` conditions are Exposed, one per Zone (0.5.1): the token status mirrors
 * `system.zones.<zone>.exposed`, and toggling the status from the palette writes the Zone.
 * `rulesPage` names the Rules Reference journal page the condition's row and card title open.
 * `statusId` is the static ActiveEffect id when the default (see statusEffectId) would collide.
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
  /**
   * Fatigued N (PHB v4.13, Conditions): -N Condition (maximum of 3, FATIGUED_MAX) to Evade, Guard
   * and attack rolls, and no Exploration Mode Activities; ends after ten minutes of rest, which is
   * the rest card (a night is longer than ten minutes) or the Fatigued card's own button, the
   * table's word that the ten minutes have passed (ruling 81). The end of the Combat clears
   * nothing. Raised by a failed Wind check, which a fighter whose Endure Threshold meets 10 + Load
   * Strain never makes.
   */
  fatigued: { id: "fatigued", name: "STARWROUGHT.Condition.fatigued", img: "icons/svg/unconscious.svg", numeric: true },
  blinded: { id: "blinded", name: "STARWROUGHT.Condition.blinded", img: "icons/svg/blind.svg" },
  deafened: { id: "deafened", name: "STARWROUGHT.Condition.deafened", img: "icons/svg/deaf.svg" },
  concealed: { id: "concealed", name: "STARWROUGHT.Condition.concealed", img: "icons/svg/light-off.svg" },
  hidden: { id: "hidden", name: "STARWROUGHT.Condition.hidden", img: "icons/svg/mystery-man.svg" },
  undetected: { id: "undetected", name: "STARWROUGHT.Condition.undetected", img: "icons/svg/invisible.svg" },
  unconscious: { id: "unconscious", name: "STARWROUGHT.Condition.unconscious", img: "icons/svg/unconscious.svg" },
  dying: { id: "dying", name: "STARWROUGHT.Condition.dying", img: "icons/svg/skull.svg", numeric: true },
  /** Any Zone carries a Wound. The Wounds themselves are per Zone on the actor (PHB v4.10). */
  wounded: { id: "wounded", name: "STARWROUGHT.Condition.wounded", img: "icons/svg/blood.svg" },
  /** At 0 Vigor: every Hit Wounds the Zone it strikes, a Critical Hit twice; Grazes never Wound. */
  spent: { id: "spent", name: "STARWROUGHT.Condition.spent", img: "icons/svg/degen.svg" },
  /** The Bind: a neutral Bind, or one someone Controls. The effect carries the particulars (0.5.1). */
  bound: { id: "bound", name: "STARWROUGHT.Condition.bound", img: "icons/svg/combat.svg", rulesPage: "The Bind" },
  // "starwroughtcontrolled" and "starwroughtcontrolling" share their first sixteen characters, so
  // these two name their ids: a shared id would make the palette treat one as the other.
  controlled: { id: "controlled", name: "STARWROUGHT.Condition.controlled", img: "icons/svg/downgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrld" },
  controlling: { id: "controlling", name: "STARWROUGHT.Condition.controlling", img: "icons/svg/upgrade.svg", rulesPage: "The Bind", statusId: "starwroughtctrlg" },
  /** A Maneuver of three or more actions begun: one spent, the rest reserved. */
  preparing: { id: "preparing", name: "STARWROUGHT.Condition.preparing", img: "icons/svg/hazard.svg" },
  dead: { id: "dead", name: "STARWROUGHT.Condition.dead", img: "icons/svg/skull.svg" },
  /**
   * Exposed, one status per Zone (PHB v4.10: "the following condition is placed on you: Exposed
   * [Zone Name]"). Mirrors of `system.zones.<zone>.exposed`, never the record of it: the Zone is
   * the truth and `SwActor#setExposed` keeps the status in step, while the palette hooks in
   * starwrought.mjs carry a toggle on the token back to the Zone.
   */
  exposedHead: { id: "exposedHead", name: "STARWROUGHT.Condition.exposedHead", img: "icons/svg/eye.svg", zone: "head", rulesPage: "Exposed", statusId: "starwroughtxHead" },
  exposedTorso: { id: "exposedTorso", name: "STARWROUGHT.Condition.exposedTorso", img: "icons/svg/bones.svg", zone: "torso", rulesPage: "Exposed", statusId: "starwroughtxTors" },
  exposedArms: { id: "exposedArms", name: "STARWROUGHT.Condition.exposedArms", img: "icons/svg/thrust.svg", zone: "arms", rulesPage: "Exposed", statusId: "starwroughtxArms" },
  exposedLegs: { id: "exposedLegs", name: "STARWROUGHT.Condition.exposedLegs", img: "icons/svg/leg.svg", zone: "legs", rulesPage: "Exposed", statusId: "starwroughtxLegs" }
});

/** Zone key -> the Exposed condition that mirrors it. */
export const ZONE_CONDITIONS = Object.freeze(Object.fromEntries(
  Object.values(CONDITIONS).filter(c => c.zone).map(c => [c.zone, c.id])
));

/**
 * The static ActiveEffect id a condition is created under, the one Foundry's token palette looks
 * for (`Actor#toggleStatusEffect` matches on `_id`, and the HUD lights a status only when the
 * effect carries it). Sixteen alphanumeric characters: the system id and the condition id, padded,
 * except where a condition names its own because the padded form would collide. The system's own
 * `SwActor#setCondition` creates under the same id, so a status set by the rules and one toggled
 * from the token are the same effect and never a pair (0.5.1, "one Bind, one effect").
 * @param {string} id  A key of CONDITIONS.
 * @returns {string}
 */
export function statusEffectId(id) {
  return CONDITIONS[id]?.statusId ?? `${SYSTEM_ID}${id}`.padEnd(16, "0").slice(0, 16);
}

/** Conditions that impose a flat penalty on Evade and Guard. */
export const OFF_GUARD_PENALTY = -2;

/** Unwieldy N: the Situation penalty to attack rolls against a target within N feet. */
export const UNWIELDY_PENALTY = -2;

/* -------------------------------------------- */
/*  Bonus types                                 */
/* -------------------------------------------- */

/**
 * Bonuses of the same type do not stack: take the highest bonus and the worst penalty of each
 * type, then add those two together. Three types, named for where the number comes from
 * (Mike, 2026-09-26): Situation is where you stand and what is happening around you (cover, high
 * ground, an ally's help, a foe Off-Guard); Condition is something on you (Frightened, a stance);
 * Gear is something intrinsic to what you hold or wear: a raised shield's bonus, a weapon's
 * quality, later a magical property. Weapon traits are Situation by ruling (Mike, 2026-09-26):
 * Sweep and Unwieldy describe what the weapon lets you do or stops you doing in the moment, not
 * what the weapon is. PHB v4.10 then prints Parry as "+1 Gear bonus to Guard against melee
 * Attacks while you wield it", and the book wins: Parry is Gear. Untyped is for the base terms of
 * a check and the system's own flat adjustments (Load Strain, the sheet's adjustment fields); no
 * Talent bonus is untyped.
 */
export const BONUS_TYPES = Object.freeze(["situation", "condition", "gear", "untyped"]);

/**
 * The names these types had until v3.3, which echoed another game's. A macro that still passes
 * typed modifiers under them resolves to the same bucket. (Active Effects never carry a type: they
 * can only move the sheet's adjustment fields, which are untyped.)
 */
export const LEGACY_BONUS_TYPES = Object.freeze({
  circumstance: "situation",
  status: "condition",
  item: "gear"
});

/** A modifier type as the engine knows it, whatever name it arrived under. */
export function bonusType(type) {
  const t = String(type ?? "untyped").toLowerCase();
  return LEGACY_BONUS_TYPES[t] ?? t;
}

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
    const type = bonusType(mod.type);
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
    // Cost glyphs never reach a slug: the v4.10 ⓿❶❷❸❹❺❻, a bracketed Reaction cost such as
    // "(⓿↺)", the v3 ◆ and ◇, the Reaction arrow, the capstone star and the Attribute glyphs.
    .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
    .replace(/[◆◇↺★✦✧⓿❶❷❸❹❺❻]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* -------------------------------------------- */
/*  Plain names (0.5.1, T16)                    */
/* -------------------------------------------- */

/**
 * A Talent's or Maneuver's name as it is printed beside its gold cost glyph. The spreadsheets put
 * the glyph in the name ("Bull Rush ❷", "Strike ❶ to ❸", "Aid ❶ (⓿↺)") and document ids hash that
 * name, so the data keeps it; the sheets and cards print the cost once, as `system.glyph`, and
 * the name without it. Mirrors stripGlyphs and actionName in assets/build_foundry.mjs: the v4.10
 * glyphs and ↺, a bracketed Reaction cost, the v3 ◆ and ◇, the capstone star, and the "to" or
 * "or" a cost range leaves dangling. A name that was nothing but glyphs comes back as it was.
 * @param {string} name
 * @returns {string}
 */
export function plainName(name) {
  const raw = String(name ?? "");
  const bare = raw
    .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
    .replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "")
    .replace(/\s+(to|or)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return bare || raw.trim();
}
