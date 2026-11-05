/**
 * Zones, Wounds, damage types and armor materials (PHB v4.10, Protection and Wounds).
 * A Zone's capacity, its Critical and Wound effects, the damage types and the material step.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

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
  /** PHB v4.21's spells (Forceweaving's force, Mindweaving's psychic), beside `mental`, not in its place (ruling 134). */
  force: { label: "STARWROUGHT.Damage.force" },
  psychic: { label: "STARWROUGHT.Damage.psychic" },
  untyped: { label: "STARWROUGHT.Damage.untyped" }
});

/**
 * How damage arrives (PHB v4.21, Damage Delivery). Zoned lands on one Zone and meets its
 * Protection once; Pervasive (a Blast's heat, a Blight's poison, Persistent Damage) ignores
 * ordinary Protection. A weapon's Strike is Zoned; a spell says which.
 */
export const DELIVERIES = Object.freeze({
  zoned: { label: "STARWROUGHT.Delivery.zoned" },
  pervasive: { label: "STARWROUGHT.Delivery.pervasive" }
});

/** Single-letter damage abbreviations as printed on the weapon tables. */
export const DAMAGE_ABBR = Object.freeze({ B: "bludgeoning", P: "piercing", S: "slashing" });

/**
 * Armor types (PHB v4.21, Armor Types): what a piece is made of, as the armor table's Type column
 * prints it. `rigid` is what Clatter counts (ruling 142: two or more rigid pieces while the Torso
 * is not). Nothing turns a damage type poorly any more: the material-weakness step of v4.10 to
 * v4.15 (padded and leather -1 against slashing, mail against piercing, plate against bludgeoning)
 * went with its table (ruling 149), and Scale became Lamellar (ruling 141; `migrateData` on the
 * armor Item brings a stored `scale` across). The armor Item's field is still named `material`.
 */
export const ARMOR_TYPES = Object.freeze({
  none: { label: "STARWROUGHT.Material.none", rigid: false },
  padded: { label: "STARWROUGHT.Material.padded", rigid: false },
  leather: { label: "STARWROUGHT.Material.leather", rigid: false },
  mail: { label: "STARWROUGHT.Material.mail", rigid: true },
  lamellar: { label: "STARWROUGHT.Material.lamellar", rigid: true },
  brigandine: { label: "STARWROUGHT.Material.brigandine", rigid: true },
  splint: { label: "STARWROUGHT.Material.splint", rigid: true },
  plate: { label: "STARWROUGHT.Material.plate", rigid: true }
});
/** The v4.10 to v4.15 names a stored armor Item or adversary Zone may still carry, and what each is now. */
export const LEGACY_ARMOR_TYPES = Object.freeze({ scale: "lamellar" });
