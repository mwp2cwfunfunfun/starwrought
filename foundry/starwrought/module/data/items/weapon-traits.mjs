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
