/**
 * Armor: the piece on each Zone, matched harness, Clatter, Load Strain, the helm, Protection per Zone.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items, data.constellations (Endure's rank), data.zones, data.bonuses.
 * Writes: data.worn, data.shield, data.matchedHarness, data.clatter, data.noisy, data.loadStrain, data.helmPenalty, data.zones[zone].armor, protection, effective, piece, material and labels.
 */

import * as SW from "../../config.mjs";
import { helmPenaltyFor } from "../items/armor.mjs";

/** Armor: which piece sits on which Zone, matched harness, Clatter, Load Strain, the helm. */
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

  // Matched harness: all four pieces the same Material and Protection.
  data.matchedHarness = pieces.length === 4
    && pieces.every(p => p.system.material === pieces[0].system.material
      && p.system.protection === pieces[0].system.protection);

  // Clatter: two or more mail or plate pieces while the torso is neither.
  const rigid = pieces.filter(p => ["mail", "plate"].includes(p.system.material)).length;
  const torsoRigid = ["mail", "plate"].includes(data.worn.torso?.system.material);
  data.clatter = (rigid >= 2) && !torsoRigid;
  data.noisy = data.clatter || pieces.some(p => p.system.traits?.includes?.("Noisy"));

  // Load Strain, relieved by your Endure rank once you own Endure Training: 1 at Trained, 2 at
  // Expert, 3 at Master, 4 at Legendary (PHB v4.11), to a minimum of 0.
  let load = pieces.reduce((n, p) => n + (p.system.load ?? 0), 0);
  load += data.shield?.system.load ?? 0;
  if (data.matchedHarness) load -= 1;
  const endure = data.constellations[SW.DEFENSES.endure.slug];
  if (endure?.points > 0) load -= SW.LOAD_RELIEF[endure.rank] ?? 0;
  data.loadStrain = Math.max(0, load);

  // Sight and hearing (PHB v4.10, Load and Load Strain): a Closed helm is -2 Situation to
  // Awareness checks, the Awareness Threshold and Initiative; an Open helm -1. Matched by the
  // Head piece's name, since the book has no trait for it.
  data.helmPenalty = helmPenaltyFor(data.worn.head?.name);

  // The Protection number each Zone shows, computed with no damage type in hand. `protection`
  // is what the armor gives (and what a Quick Strike meets whatever the Zone's state);
  // `effective` is what a Deliberate or Committed Strike meets, which is 0 on an Exposed Zone.
  for (const zone of Object.keys(SW.ZONES)) {
    const piece = data.worn[zone];
    const z = data.zones[zone];
    const bonus = (z.bonus ?? 0)
      + (data.matchedHarness && zone === "torso" ? 1 : 0)
      + data.bonuses.protection;
    // The piece's own number, before any bonus: what zoneProtection starts from.
    z.armor = piece?.system.protection ?? 0;
    z.protection = Math.max(0, (piece?.system.protection ?? 0) + bonus);
    z.effective = z.exposed ? 0 : z.protection;
    z.piece = piece;
    z.material = piece?.system.material ?? "none";
    z.materialLabel = SW.MATERIALS[z.material].label;
    z.weakTo = SW.MATERIALS[z.material].weakTo;
    z.label = SW.ZONES[zone].label;
    z.key = zone;
  }
}
