/**
 * Bonus types and typed stacking (PHB Math Conventions; Mike, 2026-09-26).
 * `resolveModifiers` uses Foundry's `Number.isNumeric` inside its body only.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

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
