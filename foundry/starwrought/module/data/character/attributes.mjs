/**
 * Attributes: a point per Talent at its feed, the bonus by the divisor.
 *
 * One pass of the character's derived data (module/data/actor.mjs, SwCharacterData, whose
 * prepareDerivedData is the ordered pipeline; through 0.10.1 these were its private methods). A
 * plain function over the data model: `data` is the SwCharacterData instance, `data.parent` the
 * Actor. Reads: data.parent.items, data.constellations, data.attributes (scaffolded by prepareBaseData).
 * Writes: data.attributes[key].points, mod, label, abbr, glyph, next.
 */

import * as SW from "../../config.mjs";

/**
 * Attribute Points are counted per Talent bought: each point flows to that Talent's feed,
 * defaulting to its Constellation's Key Attribute. Attribute Bonus = points divided by 4,
 * rounded down (PHB v4.10), through SW.attributeBonus. A child Constellation's Talent feeds its
 * own Attribute once; the parent inherits rank, never points.
 */
export function prepareAttributes(data) {
  for (const item of data.parent.items) {
    if (item.type !== "talent") continue;
    const feed = item.system.attribute
      || data.constellations[item.system.constellation]?.attribute
      || SW.getConstellation(item.system.constellation)?.attribute;
    if (feed && data.attributes[feed]) data.attributes[feed].points += 1;
  }
  for (const [key, attr] of Object.entries(data.attributes)) {
    attr.mod = SW.attributeBonus(attr.points);
    attr.label = SW.ATTRIBUTES[key].label;
    attr.abbr = SW.ATTRIBUTES[key].abbr;
    attr.glyph = SW.ATTRIBUTES[key].glyph;
    attr.next = (attr.mod >= SW.ATTRIBUTE_MAX)
      ? null
      : ((attr.mod + 1) * SW.ATTRIBUTE_DIVISOR) - attr.points;
  }
}
