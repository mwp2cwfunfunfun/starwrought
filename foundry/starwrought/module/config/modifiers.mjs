/**
 * Bonus types and stacking (PHB v4.21, Bonuses and Penalties; Mike, 2026-09-26 for the names).
 * `resolveModifiers` uses Foundry's `Number.isNumeric` inside its body only.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Three types, named for where the number comes from (Mike, 2026-09-26): Situation is where you
 * stand and what is happening around you (cover, high ground, an ally's help, a foe Off-Guard);
 * Condition is something on you (Frightened, Fatigued, a stance); Gear is something intrinsic to
 * what you hold or wear: a raised shield's bonus, a weapon's quality, later a magical property.
 * Weapon traits are Situation by ruling (Mike, 2026-09-26): Sweep and Unwieldy describe what the
 * weapon lets you do or stops you doing in the moment, not what the weapon is. PHB v4.10 then
 * prints Parry as "+1 Gear bonus to Guard against melee Attacks while you wield it", and the book
 * wins: Parry is Gear. Untyped is for the base terms of a check and the system's own flat
 * adjustments (the sheet's adjustment fields); no Talent bonus is untyped.
 *
 * Since PHB v4.21 the type no longer decides stacking ("Bonuses of the same type stack; count
 * each circumstance once"): every bonus and penalty adds, and it is the CIRCUMSTANCE that may be
 * counted only once. The type stays on every modifier as the book's label for where the number
 * comes from, printed on the card and the tooltip, and a later rule that cares about a type
 * ("a Gear bonus to Guard") still finds it. Through 0.10.1 (PHB v3.3 to v4.15) the highest bonus
 * and the worst penalty of each type were taken and added across types.
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
 * Sum a list of modifiers per PHB v4.21: every active entry adds, and entries that carry the same
 * `source` are one circumstance counted once, the strongest bonus and the strongest penalty among
 * them standing for the rest. A `source` is a short string naming the circumstance, put on by the
 * code that knows two entries are one thing: `off-guard` on the Off-Guard condition and the first
 * Torso Wound (which is Off-Guard made lasting, so a foe Off-Guard with a Wounded Torso is -2, not
 * -4); `rule:<item>:<target>` on the lines of one Talent's `bonus` rules for one target, so a
 * Talent that writes one line per rank gives the higher when two lines happen to apply. Entries
 * with no `source` are independent circumstances and all add (two allies' Support, Frightened and
 * Fatigued, a Parry weapon and a raised shield, ruling 125). `enabled: false` leaves one out;
 * a zero or non-numeric value is dropped.
 * @param {Array<{label: string, value: number, type?: string, source?: string, enabled?: boolean}>} modifiers
 * @returns {{total: number, applied: Array, suppressed: Array}}  `suppressed` is what a shared
 *   source set aside, for a card or tooltip that wants to say so.
 */
export function resolveModifiers(modifiers = []) {
  const active = modifiers.filter(m => m && m.enabled !== false && Number.isNumeric(m.value) && m.value !== 0);
  const bySource = new Map();
  const applied = [];
  const suppressed = [];
  for (const mod of active) {
    const source = mod.source ? String(mod.source) : "";
    if (!source) {
      applied.push(mod);
      continue;
    }
    const bucket = bySource.get(source) ?? { positive: null, negative: null };
    const side = mod.value > 0 ? "positive" : "negative";
    const current = bucket[side];
    const stronger = current === null || Math.abs(mod.value) > Math.abs(current.value);
    if (stronger) {
      if (current) suppressed.push(current);
      bucket[side] = mod;
    } else {
      suppressed.push(mod);
    }
    bySource.set(source, bucket);
  }
  for (const bucket of bySource.values()) {
    for (const mod of [bucket.positive, bucket.negative]) if (mod) applied.push(mod);
  }
  const total = applied.reduce((n, m) => n + m.value, 0);
  return { total, applied, suppressed };
}
