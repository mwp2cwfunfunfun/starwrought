/**
 * Armor: the piece on each Zone, the Fitted Harness, Clatter, Load Strain, the visor, Protection per Zone.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items, data.constellations (Endure's rank), data.zones, data.bonuses.
 * Writes: data.worn, data.shield, data.fittedHarness, data.fittedCount, data.clatter, data.noisy, data.loadStrain, data.visor, data.visorPenalty, data.zones[zone].armor, protection, effective, piece, material and labels.
 */

import * as SW from "../../config.mjs";

/** Armor: which piece sits on which Zone, the Fitted Harness, Clatter, Load Strain, the visor. */
export function prepareArmor(data) {
  for (const item of data.parent.items) {
    if (!item.system.equipped) continue;
    if (item.type === "armor") {
      const zone = item.system.zone;
      if (zone in data.worn && !data.worn[zone]) data.worn[zone] = item;
    } else if (item.type === "shield" && !data.shield) {
      data.shield = item;
    }
  }

  const pieces = Object.values(data.worn).filter(Boolean);

  // The Fitted Harness (PHB v4.21, Armor Traits: "If you wear armor with the Fitted trait in at
  // least three Zones, and they have all been adjusted to you, reduce total Load Strain by 1").
  // A Fitted piece is adjusted when the player ticks it on the Item; a piece without the trait
  // never counts. Through v4.15 this was the matched harness: four pieces of one material, +1
  // Torso Protection and -1 Load Strain, which went with its tables.
  data.fittedCount = pieces.filter(p => p.system.fittedAdjusted).length;
  data.fittedHarness = data.fittedCount >= SW.FITTED_ZONES;

  // Clatter: two or more rigid pieces (mail, lamellar, brigandine, splint, plate; ruling 142)
  // while the torso is not one, a Muffled piece never counting (PHB v4.21, Armor Traits).
  const rigid = pieces.filter(p => p.system.rigidType && !p.system.muffled).length;
  const torsoRigid = !!data.worn.torso?.system.rigidType;
  data.clatter = (rigid >= 2) && !torsoRigid;
  data.noisy = data.clatter || pieces.some(p => p.system.noisy);

  // Load Strain (PHB v4.21, Load and Load Strain): the Load of the armor worn and the shield
  // carried, less 1 for a Fitted Harness, less your Endure relief once you own Endure Training
  // (1 at Trained, 2 at Expert, 3 at Master, 4 at Legendary), to a minimum of 0.
  let load = pieces.reduce((n, p) => n + (p.system.load ?? 0), 0);
  load += data.shield?.system.load ?? 0;
  if (data.fittedHarness) load -= SW.FITTED_RELIEF;
  const endure = data.constellations[SW.DEFENSES.endure.slug];
  if (endure?.points > 0) load -= SW.LOAD_RELIEF[endure.rank] ?? 0;
  data.loadStrain = Math.max(0, load);

  // The visor (PHB v4.21, Visored): the Head piece's, when it has one. Lowered, -1 Gear to
  // Awareness and Initiative (the Defense pass and the check engine read `visorPenalty`); raised,
  // the piece Protects 1 less (the Item's `effectiveProtection`, read below). Through v4.15 the
  // helm's cost was by name, Closed -2 and Open -1, which v4.21's tables no longer carry.
  const head = data.worn.head ?? null;
  data.visor = head?.system.visored ? { piece: head, lowered: !!head.system.visorLowered } : null;
  data.visorPenalty = head?.system.visorPenalty ?? 0;

  // The Protection number each Zone shows, computed with no damage type in hand. `protection`
  // is what the armor gives (and what a Quick Strike meets whatever the Zone's state);
  // `effective` is what a Deliberate or Committed Strike meets, which is 0 on an Exposed Zone.
  for (const zone of Object.keys(SW.ZONES)) {
    const piece = data.worn[zone];
    const z = data.zones[zone];
    const bonus = (z.bonus ?? 0) + data.bonuses.protection;
    // The piece's own number, before any bonus: what zoneProtection starts from. A raised visor
    // is already taken off it (the Item's effectiveProtection).
    z.armor = piece?.system.effectiveProtection ?? 0;
    z.protection = Math.max(0, z.armor + bonus);
    z.effective = z.exposed ? 0 : z.protection;
    z.piece = piece;
    z.material = piece?.system.material ?? "none";
    z.materialLabel = (SW.ARMOR_TYPES[z.material] ?? SW.ARMOR_TYPES.none).label;
    z.label = SW.ZONES[zone].label;
    z.key = zone;
  }
}
