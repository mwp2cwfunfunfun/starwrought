/**
 * Weapon Trait parsing. Equipment carries its Traits as authored text and derives the
 * mechanical flags from them, so a weapon's rules come from its Trait line rather than from a
 * second place that can drift.
 *
 * PURE: no Foundry global at module scope and none inside, only config.mjs, so the build
 * (assets/build_foundry.mjs) imports it as it imports the automation grammar, and the
 * converter's output and the client never hold two readings of a Trait cell. Keep it so.
 */

import * as SW from "../../config.mjs";

/* -------------------------------------------- */
/*  Trait parsing                               */
/* -------------------------------------------- */

/**
 * Read the mechanical flags out of a weapon's Trait line. "A Trait is never flavor: if the word
 * is in a Trait line, some rule cares about it." (PHB v4.10, Weapon Traits.)
 * @param {string[]} traits
 * @returns {object}
 */
export function parseWeaponTraits(traits = []) {
  const flags = {
    agile: false,
    finesse: false,
    close: false,
    /** +1 Gear bonus to Guard against melee Attacks while wielded. */
    parry: false,
    sweep: false,
    mechanical: false,
    nonlethal: false,
    twoHanded: false,
    /** Cannot Parry, form a Bind, or be Bound. It can still Guard. */
    flexible: false,
    /** Wounds on any Critical Hit, Exposed Zone or not. */
    massive: false,
    /** An attack that offers nothing to bind. */
    unparryable: false,
    ranged: null,
    thrown: null,
    reload: 0,
    capacity: 0,
    unwieldy: 0,
    armorPiercing: 0,
    deadly: null,
    twoHandDie: null,
    versatile: null,
    maneuvers: []
  };
  for (const raw of traits) {
    const trait = String(raw).trim();
    const lower = trait.toLowerCase();
    let m;
    if (lower === "agile") flags.agile = true;
    else if (lower === "finesse") flags.finesse = true;
    else if (lower === "close") flags.close = true;
    else if (lower === "parry") flags.parry = true;
    else if (lower === "sweep") flags.sweep = true;
    else if (lower === "mechanical") flags.mechanical = true;
    else if (lower === "nonlethal") flags.nonlethal = true;
    else if (lower === "two-handed") flags.twoHanded = true;
    else if (lower === "flexible") flags.flexible = true;
    else if (lower === "massive") flags.massive = true;
    else if (lower === "unparryable") flags.unparryable = true;
    // "Composite" (PHB v4.14, 0.6.3) is no trait in v4.21: a ranged weapon is Agility and a thrown
    // one Might, whatever it is made of, so the word is read as nothing in particular.
    else if ((m = lower.match(/^ranged\s+(\d+)/))) flags.ranged = Number(m[1]);
    else if ((m = lower.match(/^thrown\s+(\d+)/))) flags.thrown = Number(m[1]);
    else if ((m = lower.match(/^reload\s+\[?(\d+)/))) flags.reload = Number(m[1]);
    else if ((m = lower.match(/^capacity\s+\[?(\d+)/))) flags.capacity = Number(m[1]);
    else if ((m = lower.match(/^unwieldy\s+\[?(\d+)/))) flags.unwieldy = Number(m[1]);
    // The book prints both "Armor-Piercing 1" and "Armor Piercing 1".
    else if ((m = lower.match(/^armor[- ]piercing\s+\[?(\d+)/))) flags.armorPiercing = Number(m[1]);
    else if ((m = lower.match(/^deadly\s+d(\d+)/))) flags.deadly = Number(m[1]);
    else if ((m = lower.match(/^two-hand\s+d(\d+)/))) flags.twoHandDie = Number(m[1]);
    else if ((m = lower.match(/^versatile\s+([bps])\b/))) flags.versatile = SW.DAMAGE_ABBR[m[1].toUpperCase()];
    else if (/^(grapple|trip|disarm|shove)$/.test(lower)) flags.maneuvers.push(lower);
    else if (/^(grapple|trip|disarm|shove)(,\s*(grapple|trip|disarm|shove))+$/.test(lower)) {
      flags.maneuvers.push(...lower.split(/,\s*/));
    }
  }
  return flags;
}

/* -------------------------------------------- */
/*  Ammunition (0.29.0)                         */
/* -------------------------------------------- */

/**
 * What a weapon holds to shoot (0.29.0; rulings 290 to 292). Mike, of Strike's requirement: "For a
 * ranged weapon, it must also be loaded." Through 0.28.0 the Reload and Capacity traits were read
 * into numbers that nothing used.
 *
 * A ranged weapon with the Reload trait TAKES AMMUNITION: every bow, crossbow and sling in the
 * book (Reload 1, 2 or 3; PHB v4.25, Weapon Traits, Reload [N]: "After firing, you must spend N
 * Interact actions before the weapon can fire again", which the Reload Maneuver pays). One with no
 * Reload (Bolas) is thrown whole and needs no loading. Its magazine is its Capacity (PHB: "The
 * weapon can fire N times before it must be reloaded"), one shot when it has none. `loaded` is the stored count of shots in it; null, the value a weapon has
 * never had written, reads as FULL, so every weapon made before 0.29.0 starts loaded and nothing
 * needs migrating.
 * @param {object} flags            `parseWeaponTraits` output.
 * @param {number|null} [loaded]    The stored count; null or undefined for "never set".
 * @returns {{takes: boolean, magazine: number, shots: number, loaded: boolean, full: boolean, reload: number}}
 *   `loaded` is "ready to shoot": a shot is in it, or it takes none. `reload` is the Reload
 *   Maneuver's cost for this weapon, in actions.
 */
export function ammunitionOf(flags, loaded = null) {
  const ranged = (flags?.ranged !== null) && (flags?.ranged !== undefined);
  const reload = Math.max(0, Number(flags?.reload) || 0);
  const capacity = Math.max(0, Number(flags?.capacity) || 0);
  if (!ranged || !(reload > 0 || capacity > 0)) {
    return { takes: false, magazine: 0, shots: 0, loaded: true, full: true, reload: 0 };
  }
  const magazine = Math.max(1, capacity);
  const stored = ((loaded === null) || (loaded === undefined)) ? magazine : Number(loaded);
  const shots = Number.isFinite(stored) ? Math.min(magazine, Math.max(0, Math.floor(stored))) : magazine;
  return { takes: true, magazine, shots, loaded: shots > 0, full: shots >= magazine, reload };
}

/**
 * What a Strike does to the shots (rulings 290 and 291), decided here so the attack only writes
 * what this says. A weapon that takes no ammunition, and a throw, use nothing. A Strike with an
 * EMPTY weapon still happens (Mike: "Warn and go on"): `warn` says the card should say so, and
 * the count stays at nought. A shot is USED only in an encounter, as actions are counted only
 * there ("Outside an encounter nothing is counted at all").
 * @param {{takes: boolean, shots: number}} ammunition  `ammunitionOf`.
 * @param {object} [moment]
 * @param {boolean} [moment.inEncounter=false]
 * @param {boolean} [moment.thrown=false]
 * @returns {{uses: boolean, left: number, warn: boolean}}
 */
export function shotPlan(ammunition, { inEncounter = false, thrown = false } = {}) {
  const shots = Math.max(0, Number(ammunition?.shots) || 0);
  if (!ammunition?.takes || thrown) return { uses: false, left: shots, warn: false };
  if (shots <= 0) return { uses: false, left: 0, warn: true };
  return inEncounter ? { uses: true, left: shots - 1, warn: false } : { uses: false, left: shots, warn: false };
}

/**
 * What the hand-correction on the Equipment row does to the count: an empty weapon is made full,
 * and anything else gives up one shot, so one click flips a bow and a few step a Repeating
 * Crossbow down.
 * @param {{magazine: number, shots: number}} ammunition
 * @returns {number}
 */
export function nextLoaded(ammunition) {
  const magazine = Math.max(1, Number(ammunition?.magazine) || 1);
  const shots = Math.max(0, Number(ammunition?.shots) || 0);
  return (shots <= 0) ? magazine : shots - 1;
}

/* -------------------------------------------- */
/*  What is in hand (0.29.0)                    */
/* -------------------------------------------- */

/**
 * Is this Weapon Group the body's own? "Natural Weapons": the Unarmed Strike, claws, a bite. The
 * one reading, for the weapon model's `natural` and for the stored data the Unarmed Strike's gift
 * looks through before an Item is prepared (0.29.0).
 * @param {string} group
 * @returns {boolean}
 */
export function isNaturalGroup(group) {
  return /natural\s+weapons?/i.test(String(group ?? ""));
}

/**
 * Does this character already have a natural weapon (0.29.0, ruling 294)? Asked of stored Item
 * data (`_source.items`) or of Items: a character who has one is given no second Unarmed Strike,
 * at creation (a copy, an import) or by the one-time update.
 * @param {Iterable<{type?: string, system?: {group?: string}}>} items
 * @returns {boolean}
 */
export function hasNaturalWeapon(items) {
  for (const item of items ?? []) {
    if ((item?.type === "weapon") && isNaturalGroup(item?.system?.group)) return true;
  }
  return false;
}

/**
 * THE FIST NEVER STANDS IN FRONT OF A WEAPON (0.29.0, ruling 294). Every character has an Unarmed
 * Strike since 0.29.0, a natural weapon that is always in hand. So every reader that asks "which
 * weapon in hand?" must prefer a real one and fall back to the fist, or a dagger and a fist, which
 * tie on reach, would be told apart by which was added to the sheet first. These two are the one
 * place that order is decided.
 *
 * `longestMelee`: the melee weapon in hand that sets Total Reach, and so the one a Riposte and an
 * Intercept Strike with: the longer reach, and where two tie a real weapon before a natural one.
 * So the weapon named is always the one whose reach Total Reach is (a claw longer than the dagger
 * beside it sets the reach AND is the weapon), and the fist, whose reach is the body's own, wins
 * only when it is all there is. Null with nothing but ranged weapons in hand.
 * @param {Array<{ranged?: boolean, natural?: boolean, reach?: number}>} weapons  The weapons in hand.
 * @returns {object|null}  One of the entries given.
 */
export function longestMelee(weapons) {
  return [...(weapons ?? [])]
    .filter(w => w && !w.ranged)
    .sort((a, b) => ((Number(b.reach) || 0) - (Number(a.reach) || 0)) || ((a.natural ? 1 : 0) - (b.natural ? 1 : 0)))[0] ?? null;
}

/**
 * What a character may Strike with, in the order the chooser lists it: every weapon in hand, the
 * real ones first by name, the natural ones (the Unarmed Strike) last. A weapon that is worn or
 * packed is not offered: it is drawn first.
 * @param {Array<{id: string, name: string, held?: boolean, natural?: boolean}>} weapons
 * @returns {object[]}  The entries given, filtered and ordered.
 */
export function strikeOptions(weapons) {
  return [...(weapons ?? [])]
    .filter(w => w && (w.held || w.natural))
    .sort((a, b) => ((a.natural ? 1 : 0) - (b.natural ? 1 : 0)) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

/**
 * What the Reload Maneuver may load: the weapons in hand that take ammunition and are not full,
 * by name. A weapon that is worn or packed is drawn first.
 * @param {Array<{name: string, held?: boolean, takesAmmunition?: boolean, full?: boolean}>} weapons
 * @returns {object[]}
 */
export function reloadOptions(weapons) {
  return [...(weapons ?? [])]
    .filter(w => w && w.held && w.takesAmmunition && !w.full)
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

/** The table null-markers a Trait cell may hold instead of Traits: a hyphen, or the long dash (U+2014). */
const NULL_MARKERS = new Set(["-", String.fromCharCode(0x2014)]);

/** Split an authored Trait line ("Agile, Close, Finesse, Thrown 10 ft") into an array. */
export function splitTraits(line) {
  if (Array.isArray(line)) return line;
  return String(line ?? "")
    .split(/,(?![^(]*\))/)
    .map(t => t.trim())
    .filter(t => t && !NULL_MARKERS.has(t));
}
