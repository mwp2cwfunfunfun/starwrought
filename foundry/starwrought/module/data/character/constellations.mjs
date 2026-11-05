/**
 * Constellations: the Talents rolled up into skies, groups wearing their parent's rank, the Origin, Flares.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items (Constellation and Talent Items), data.flares, data.level, the registry.
 * Writes: data.constellations, data.originPoints, data.origin.
 */

import * as SW from "../../config.mjs";

/**
 * Roll the Talents this character owns up into Constellations. Every Talent costs 1 point, so a
 * Constellation's spend is simply the number of its Talents you own, the Root included.
 *
 * Groups (PHB v4.21, Constellations and shared ranks): a Combat Style is a group of Talents
 * within Melee or Ranged, and a magical specialty a group within its discipline. A group has no
 * rank of its own: every Talent bought in it counts once toward the parent's rank, and the
 * group's row wears the parent's rank, bonus and pool. The parent's own Talents must still be
 * bought for their effects, and an Attribute Point is counted once, at the Talent's own feed (see
 * prepareAttributes). Through v4.15 a Combat Style was a child with a rank of its own as well.
 *
 * Root first governs the counting (ruling 127, the v4.10 sync's R2 kept): the group's points count
 * toward the parent only once the parent's own Root is owned, and the wizard refuses a group
 * Talent before it. Read literally, "every Talent you buy in a group counts toward the parent's
 * rank" would make Archery alone Trained in Ranged, against "buying the Root is what makes you
 * Trained". Without the Root the parent is Untrained whatever the groups hold, and so is every
 * group under it; `inherited` is exposed either way so the sheet can say what is waiting.
 *
 * The Origin (PHB v4.21): Ancestry, Culture and Bloodline are authored as three skies and are one
 * Constellation for rank, which counts every point across them. Each of the three entries wears
 * that shared rank, and `data.origin` is the virtual Constellation itself (slug SW.ORIGIN_SLUG),
 * which `proficiency("origin")` answers from so a rule's "if Origin is Expert" reads it.
 */
export function prepareConstellations(data) {
  const level = data.level;
  const entries = {};

  const ensure = slug => {
    if (entries[slug]) return entries[slug];
    const meta = SW.getConstellation(slug);
    return (entries[slug] = {
      slug,
      name: meta.name,
      category: meta.category,
      attribute: meta.attribute,
      parent: meta.parent ?? "",
      img: meta.img ?? null,
      item: null,
      points: 0,
      inherited: 0,
      children: [],
      talents: [],
      flared: !!data.flares?.[slug]
    });
  };

  // Constellation Items the character has opened carry the authoritative metadata.
  for (const item of data.parent.items) {
    if (item.type !== "constellation") continue;
    const slug = item.system.slug || SW.slugify(item.name);
    // v3.4's Weapons Constellation is Melee in PHB v4.10. Its Talents are refiled by the Talent
    // model; a stale Weapons Item left on the character is ignored rather than drawn as an
    // empty sky, and the next Melee Talent opens a proper Melee Item.
    if (slug === SW.WEAPONS_SLUG) continue;
    const entry = ensure(slug);
    entry.item = item;
    entry.name = item.name;
    entry.category = item.system.category || entry.category;
    entry.attribute = item.system.attribute || entry.attribute;
    entry.parent = item.system.parentSlug || entry.parent;
    entry.img = item.img ?? entry.img;
  }

  // Talents contribute the points.
  for (const item of data.parent.items) {
    if (item.type !== "talent") continue;
    const slug = item.system.constellation;
    if (!slug) continue;
    const entry = ensure(slug);
    entry.points += 1;
    entry.talents.push(item);
  }

  // A Constellation needn't be open to Flare: an untrained critical lights ground you have
  // never bought into, and the Milestone point that follows can buy its Root. So a Flare is
  // reason enough to draw the sky on the sheet.
  for (const slug of Object.keys(data.flares ?? {})) ensure(slug);

  // A group's points flow up to its parent. The parent is drawn even before its own Root is
  // bought, so the sheet can show what its groups are holding for it; the points only count
  // toward its rank once the Root is owned (below).
  for (const entry of Object.values(entries)) {
    if (!entry.parent || !entry.points) continue;
    const parent = ensure(entry.parent);
    parent.inherited += entry.points;
    parent.children.push(entry.slug);
  }

  // Owning a Constellation's Root: the Root Talent itself, or the Constellation Item with any
  // Talent bought in it (an older character whose Root was not flagged).
  const ownsRoot = entry => entry.talents.some(t => t.system.root)
    || (!!entry.item && entry.points > 0);

  // The Origin Constellation has three Roots. Ancestry, Bloodline and Culture are authored as
  // separate skies, but they merge into one: rank counts all the points across its sources.
  const originMembers = Object.values(entries).filter(e => e.category === "origin");
  data.originPoints = originMembers.reduce((n, e) => n + e.points, 0);
  const originRank = SW.rankFor(data.originPoints, level);
  data.origin = {
    slug: SW.ORIGIN_SLUG,
    name: "Origin",
    category: "origin",
    points: data.originPoints,
    pool: data.originPoints,
    rank: originRank,
    bonus: SW.rankBonus(originRank),
    rankLabel: SW.RANKS[originRank].label,
    members: originMembers.map(e => e.slug)
  };

  // Rank, Proficiency Bonus, and what the next rank is still waiting on: first every
  // Constellation with a rank of its own, then the groups, which wear their parent's.
  const rankUp = (entry, pool) => {
    entry.pool = pool;
    entry.rank = SW.rankFor(pool, level);
    entry.bonus = SW.rankBonus(entry.rank);
    entry.rankLabel = SW.RANKS[entry.rank].label;
    const nextKey = SW.RANK_ORDER[SW.RANK_ORDER.indexOf(entry.rank) + 1];
    entry.next = nextKey ? {
      rank: nextKey,
      label: SW.RANKS[nextKey].label,
      points: Math.max(0, SW.RANKS[nextKey].points - pool),
      level: Math.max(0, SW.RANKS[nextKey].level - level)
    } : null;
  };
  const isGroup = entry => !!entry.parent;

  for (const entry of Object.values(entries)) {
    entry.rootOwned = ownsRoot(entry);
    entry.group = isGroup(entry);
    entry.isParent = entry.children.length > 0
      || Object.values(SW.constellations).some(c => c.parent === entry.slug);
    // Every Lore files under Lore, whatever the compendium says its category is.
    if (SW.isLoreSlug(entry.slug)) entry.category = "lore";
    entry.categoryLabel = SW.CATEGORIES[entry.category]?.label ?? SW.CATEGORIES.general.label;
    entry.order = SW.CATEGORIES[entry.category]?.order ?? 9;
    entry.talents.sort((a, b) =>
      ((SW.TIERS[a.system.tier]?.order ?? 9) - (SW.TIERS[b.system.tier]?.order ?? 9))
      || a.name.localeCompare(b.name));
    if (entry.group) continue;
    const pool = entry.category === "origin"
      ? data.originPoints
      : entry.points + (entry.rootOwned ? entry.inherited : 0);
    rankUp(entry, pool);
  }
  for (const entry of Object.values(entries)) {
    if (!entry.group) continue;
    // The parent is always an entry: the roll-up above ensured it when the group held points,
    // and a group with none still names it, so ensure it now (Untrained, drawn as waiting).
    const parent = entries[entry.parent] ?? ensure(entry.parent);
    if (parent.rank === undefined) {
      parent.rootOwned = ownsRoot(parent);
      parent.group = false;
      parent.isParent = true;
      parent.categoryLabel = SW.CATEGORIES[parent.category]?.label ?? SW.CATEGORIES.general.label;
      parent.order = SW.CATEGORIES[parent.category]?.order ?? 9;
      rankUp(parent, parent.points + (parent.rootOwned ? parent.inherited : 0));
    }
    rankUp(entry, parent.pool);
    entry.rankFrom = parent.slug;
  }

  data.constellations = entries;
}
