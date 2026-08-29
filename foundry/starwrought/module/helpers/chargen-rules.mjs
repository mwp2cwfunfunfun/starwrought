/**
 * What a Talent Point may legally buy.
 *
 * This mirrors the rules engine in `Starwrought_App.html` deliberately and clause for clause, so
 * a character built in the wizard and a character built in the app are the same character. If the
 * two ever disagree, the app is the older implementation and has had more play behind it.
 */

import * as SW from "../config.mjs";
import { normalize, rootOf, talentsIn, isLoreSlug, loreName } from "./chargen-data.mjs";

/** The categories that make up the Origin, whose roots are never bought with points. */
export const ORIGIN_CATEGORIES = ["origin"];

/* -------------------------------------------- */

/** Does this character already own a Talent of that name in that Constellation. */
export function ownsTalent(actor, slug, name) {
  const key = normalize(name);
  return actor.items.some(i => (i.type === "talent")
    && (i.system.constellation === slug)
    && (normalize(i.name) === key));
}

/** Talent Points spent in one Constellation. */
export function pointsIn(actor, slug) {
  return actor.items.filter(i => (i.type === "talent") && (i.system.constellation === slug)).length;
}

/** Talent Points across the whole Origin, which progresses as one Constellation. */
export function originPoints(actor, extra = 0) {
  let total = 0;
  for (const item of actor.items) {
    if (item.type !== "talent") continue;
    const slug = item.system.constellation;
    if (categoryOf(actor, slug) === "origin") total += 1;
  }
  return total + extra;
}

/** The category a slug belongs to, honouring anything the character has actually opened. */
export function categoryOf(actor, slug) {
  // Lore first, and for opened instances too: a Lore (X) cloned from the template carries the
  // template's authored category, and grouping an opened Lore apart from an unopened one would
  // put Lore in two places at once and keep a Lore Talent Point out of the Lore you already have.
  if (isLoreSlug(slug)) return "lore";
  const owned = actor?.system?.constellations?.[slug];
  if (owned?.category) return owned.category;
  return SW.getConstellation(slug).category;
}

/**
 * The Proficiency Rank this character would have in a Constellation after spending `extra` more
 * points there. Both gates apply: points in the Constellation, and character level.
 */
export function rankAfter(actor, slug, extra = 0) {
  const level = actor.system.level ?? 1;
  const points = (categoryOf(actor, slug) === "origin")
    ? originPoints(actor, extra)
    : pointsIn(actor, slug) + extra;
  return SW.rankFor(points, level);
}

/* -------------------------------------------- */

/**
 * May this character buy this Talent right now?
 * @param {Actor} actor
 * @param {string} slug            The Constellation the Talent belongs to.
 * @param {object} talent          A cached Talent entry.
 * @returns {{ok: boolean, why?: string}}
 */
export function canBuy(actor, slug, talent) {
  if (ownsTalent(actor, slug, talent.name)) {
    return { ok: false, why: game.i18n.localize("STARWROUGHT.Chargen.whyOwned") };
  }
  if (talent.bloodlineRoot) {
    return { ok: false, why: game.i18n.localize("STARWROUGHT.Chargen.whyBloodlineRoot") };
  }
  if (talent.root && (categoryOf(actor, slug) === "origin")) {
    return { ok: false, why: game.i18n.localize("STARWROUGHT.Chargen.whyIdentityRoot") };
  }

  // Root first. Nothing in a Constellation can be bought before its Root Talent.
  const root = rootOf(slug);
  if (root && !talent.root && !ownsTalent(actor, slug, root.name)) {
    return { ok: false, why: game.i18n.format("STARWROUGHT.Chargen.whyNeedsRoot", { name: root.name }) };
  }

  // Requires is an OR: any one of the named Talents opens it.
  if (talent.requires?.length) {
    const met = talent.requires.some(name => ownsTalent(actor, slug, name));
    if (!met) {
      return { ok: false, why: game.i18n.format("STARWROUGHT.Chargen.whyRequires", { list: talent.requires.join(" or ") }) };
    }
  }

  // The tier gate is measured against the rank you will have once this point lands.
  const after = rankAfter(actor, slug, 1);
  const need = SW.TIERS[talent.tier]?.rank ?? "trained";
  if ((SW.RANKS[after]?.order ?? 0) < (SW.RANKS[need]?.order ?? 1)) {
    return { ok: false, why: game.i18n.format("STARWROUGHT.Chargen.whyTier", {
      tier: game.i18n.localize(SW.TIERS[talent.tier]?.label ?? "")
    }) };
  }

  // A capstone needs a Master Talent in its own Constellation first.
  if (talent.capstone) {
    const hasMaster = actor.items.some(i => (i.type === "talent")
      && (i.system.constellation === slug) && (i.system.tier === "M"));
    if (!hasMaster) {
      return { ok: false, why: game.i18n.localize("STARWROUGHT.Chargen.whyCapstone") };
    }
  }

  return { ok: true };
}

/** The Talents in a Constellation this character could take, each with a reason if they cannot. */
export function talentOptions(actor, slug) {
  return talentsIn(slug).map(talent => ({ talent, ...canBuy(actor, slug, talent) }));
}

/* -------------------------------------------- */
/*  Where a point may go                        */
/* -------------------------------------------- */

/**
 * Every Constellation slug the wizard knows about, including the ones this character has already
 * opened (a Lore instance exists only on the character).
 */
export function allSlugs(actor) {
  const slugs = new Set(Object.keys(SW.constellations));
  for (const slug of Object.keys(actor.system.constellations ?? {})) slugs.add(slug);
  return [...slugs];
}

/**
 * Resolve a point slot into the Constellations it may be spent in.
 * @param {Actor} actor
 * @param {object} slot
 * @returns {string[]} slugs
 */
export function slotTargets(actor, slot) {
  const opened = slug => pointsIn(actor, slug) > 0;

  switch (slot.scope) {
    case "constellation":
      return slot.slugs ?? [];

    case "defense":
      return Object.values(SW.DEFENSES).map(d => d.slug);

    case "calling":
      return allSlugs(actor).filter(s => categoryOf(actor, s) === "calling");

    case "skill":
      // Skill Talent Points include Lore.
      return allSlugs(actor).filter(s => ["skill", "lore"].includes(categoryOf(actor, s)));

    case "lore":
      return allSlugs(actor).filter(s => categoryOf(actor, s) === "lore");

    case "open":
      // An Opening Talent Point buys a Root Talent and nothing else, in a Constellation you have
      // not started. It can never open a piece of somebody's identity.
      return allSlugs(actor).filter(s => !opened(s)
        && (categoryOf(actor, s) !== "origin")
        && (!slot.exclude || categoryOf(actor, s) !== slot.exclude));

    case "opened":
      return allSlugs(actor).filter(opened);

    case "category":
      return allSlugs(actor).filter(s => categoryOf(actor, s) === slot.category);

    case "anywhere":
    default:
      return allSlugs(actor);
  }
}

/**
 * Narrow a slot's targets to the ones that actually have something legal to buy, and apply the
 * "one" and "different" grant modes against what has already been spent from this slot.
 */
export function slotChoices(actor, slot, spent = []) {
  let targets = slotTargets(actor, slot);

  if (slot.mode === "one" && spent.length) targets = targets.filter(s => s === spent[0].slug);
  if (slot.mode === "different") {
    const used = new Set(spent.map(s => s.slug));
    targets = targets.filter(s => !used.has(s));
  }

  return targets
    .map(slug => {
      const options = talentOptions(actor, slug)
        .filter(o => (slot.scope !== "open") || o.talent.root);
      return {
        slug,
        name: constellationLabel(actor, slug),
        category: categoryOf(actor, slug),
        attribute: (actor.system.constellations?.[slug]?.attribute) || SW.getConstellation(slug).attribute,
        options,
        available: options.filter(o => o.ok).length
      };
    })
    .filter(c => c.available > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The display name of a Constellation for this character. */
export function constellationLabel(actor, slug) {
  const owned = actor.system.constellations?.[slug]?.name;
  if (owned) return owned;
  // A Lore instance the character has not opened yet still has a name: Lore (Warfare).
  if (String(slug).startsWith("lore-")) return loreName(slug);
  return SW.getConstellation(slug).name;
}
