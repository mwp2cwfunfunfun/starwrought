/**
 * The party sheet's roster rows (apps/party-sheet.mjs; 0.7.0; plan, part 1): the context one tab's templates render,
 * read live off the members and the party at render and computed nowhere else (the plan's risk 2).
 * Plain functions over the party and its members, no `this`: the sheet calls them from
 * `_prepareContext` and the handlers stay with the sheet. Through 0.10.1 these were the sheet's own
 * private methods.
 */

import * as SW from "../../config.mjs";
import { vigorContext, windTip, zoneWounds } from "../../helpers/actor-context.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * One roster row, every number the member's own derived data, read, never recomputed (plan,
 * part 1). A member whose Actor cannot be found prints as a missing row with Remove only.
 * @param {{uuid: string, actor: Actor|null}} member
 * @returns {object}
 */
export function memberRow({ uuid, actor }) {
  if (!actor) {
    return { uuid, missing: true, name: L("STARWROUGHT.Party.missingMember"), owner: false };
  }
  const sys = actor.system;
  const owner = actor.testUserPermission(game.user, "OWNER");
  const of = SW.MILESTONES_PER_LEVEL;
  const reached = Math.clamp(Number(sys.milestone) || 0, 0, of);
  const heroPoints = Number(sys.heroPoints?.value) || 0;

  // The Flared Constellations as chips, named as the member's own data spells them.
  const flares = Object.keys(sys.flares ?? {})
    .map(slug => ({ slug, name: sys.constellations?.[slug]?.name ?? SW.getConstellation(slug)?.name ?? slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Wounds: the count, with the Zones on hover.
  const zones = Object.keys(SW.ZONES).map(key => zoneWounds(actor, key)).filter(z => z.wounds > 0);
  const woundCount = Number(sys.woundCount) || zones.reduce((n, z) => n + z.wounds, 0);
  const woundsTip = zones.length
    ? zones.map(z => F("STARWROUGHT.Party.woundsZone", {
        zone: L(SW.ZONES[z.key].label), n: z.wounds, capacity: z.capacity
      })).join("; ")
    : L("STARWROUGHT.Party.woundsNone");

  // The players who own the character, as colour dots, dim when not connected.
  const players = game.users
    .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
    .map(u => ({ id: u.id, name: u.name, color: String(u.color?.css ?? u.color ?? "#888888"), active: !!u.active }));

  return {
    uuid,
    id: actor.id,
    name: actor.name,
    img: actor.img,
    owner,
    missing: false,
    level: Number(sys.level) || 1,
    milestones: {
      reached,
      pips: Array.fromRange(of, 1).map(n => ({ n, filled: n <= reached })),
      tooltip: F("STARWROUGHT.Milestone.pipHint", { n: reached, of })
    },
    deferred: Number(sys.deferred) || 0,
    heroPoints,
    heroMax: SW.HERO_POINTS_MAX,
    heroFull: heroPoints >= SW.HERO_POINTS_MAX,
    vigor: vigorContext(actor),
    spent: sys.spent ?? ((sys.vigor?.value ?? 1) === 0),
    woundCount,
    woundsTip,
    dying: Number(sys.dying) || 0,
    fatigued: Number(actor.conditionValue?.("fatigued")) || 0,
    loadStrain: Number(sys.loadStrain) || 0,
    loadStrainTip: windTip(actor),
    speed: Number(sys.speed ?? sys.moveSpeed) || 0,
    players,
    flares
  };
}
