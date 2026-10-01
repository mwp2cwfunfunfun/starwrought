/**
 * Handlebars helpers and template preloading.
 */

import * as SW from "../config.mjs";

const { loadTemplates } = foundry.applications.handlebars;

/** Register the helpers the STARWROUGHT templates use. */
export function registerHandlebarsHelpers() {
  Handlebars.registerHelper({
    /** +4, -2, +0: modifiers always carry their sign. */
    swSigned(value) {
      const n = Number(value) || 0;
      return `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
    },

    /** The Attribute glyph, for the chips and rails. */
    swGlyph(attribute) {
      return SW.ATTRIBUTES[attribute]?.glyph ?? "";
    },

    /** The action-cost glyph for a cost key. */
    swCost(cost) {
      return SW.ACTION_COSTS[cost]?.glyph ?? "";
    },

    /** The glyph for a number of actions: ⓿ ❶ ❷ ❸ ❹ ❺ ❻. */
    swActionGlyph(n) {
      return SW.ACTION_GLYPHS[Number(n)] ?? "";
    },

    /** The glyph a Strike kind costs: Quick ❶, Deliberate ❷, Committed ❸. */
    swStrikeGlyph(kind) {
      const cost = SW.STRIKE_KINDS[kind]?.cost;
      return cost === undefined ? "" : (SW.ACTION_GLYPHS[cost] ?? "");
    },

    /** The rank abbreviation letter. */
    swRankAbbr(rank) {
      return SW.RANKS[rank]?.abbr ?? "U";
    },

    /** Percentage of a bar, clamped so a full bar never overflows its track. */
    swPercent(value, max) {
      const v = Number(value) || 0;
      const m = Number(max) || 0;
      if (!m) return 0;
      return Math.clamp(Math.round((v / m) * 100), 0, 100);
    },

    /** Repeat a string N times, for the action glyphs. */
    swRepeat(text, count) {
      return String(text).repeat(Math.max(0, Number(count) || 0));
    },

    /** Join a list with a separator. Sets count: a SetField hands us one, not an Array. */
    swJoin(list, separator) {
      if (typeof separator !== "string") separator = ", ";
      if (list instanceof Set) return [...list].join(separator);
      return Array.isArray(list) ? list.join(separator) : "";
    },

    /** "1 pt" but "3 pts": no sheet should ever print "1 points". */
    swPlural(count, singular, plural) {
      return (Number(count) === 1) ? singular : plural;
    },

    /** Add numbers. */
    swAdd(...args) {
      return args.slice(0, -1).reduce((n, v) => n + (Number(v) || 0), 0);
    }
  });
}

/* -------------------------------------------- */

/**
 * Preload the partials so a sheet's first render is not a waterfall of fetches. Every path here
 * is also registered as a partial under that path, which is how the two actor headers share the
 * stance chips, the action pips, the Bind line and the Wound pips.
 */
export function preloadTemplates() {
  return loadTemplates([
    "systems/starwrought/templates/actor/header.hbs",
    "systems/starwrought/templates/actor/overview.hbs",
    "systems/starwrought/templates/actor/constellations.hbs",
    "systems/starwrought/templates/actor/equipment.hbs",
    "systems/starwrought/templates/actor/actions.hbs",
    "systems/starwrought/templates/actor/effects.hbs",
    "systems/starwrought/templates/actor/biography.hbs",
    "systems/starwrought/templates/actor/npc-header.hbs",
    "systems/starwrought/templates/actor/npc-statblock.hbs",
    "systems/starwrought/templates/actor/npc-abilities.hbs",
    "systems/starwrought/templates/actor/stance-chips.hbs",
    "systems/starwrought/templates/actor/action-pips.hbs",
    "systems/starwrought/templates/actor/bind-line.hbs",
    "systems/starwrought/templates/actor/wounds.hbs",
    "systems/starwrought/templates/item/header.hbs",
    "systems/starwrought/templates/item/description.hbs",
    "systems/starwrought/templates/item/details.hbs",
    "systems/starwrought/templates/item/effects.hbs",
    "systems/starwrought/templates/chat/check-card.hbs",
    "systems/starwrought/templates/chat/damage-card.hbs",
    "systems/starwrought/templates/chat/applied-card.hbs",
    "systems/starwrought/templates/chat/item-card.hbs",
    "systems/starwrought/templates/dice/check-dialog.hbs",
    "systems/starwrought/templates/chargen/steps.hbs",
    "systems/starwrought/templates/chargen/body.hbs",
    "systems/starwrought/templates/chargen/footer.hbs"
  ]);
}
