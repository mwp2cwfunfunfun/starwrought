/**
 * The aura of a Talent or Maneuver (0.5.1): its fields and the derived colour and label. Used
 * by talent.mjs and action.mjs.
 */

import * as SW from "../../config.mjs";
// The `aura` rule kind (0.13.0): an "aura:" line in the Automation cell is the ring's authoring
// since the Aura column retired, and the kind file is pure, as rules.mjs's imports are.
import { toAuraField } from "../../rules/kinds/aura.mjs";

const fields = foundry.data.fields;

/**
 * The aura of a Talent or Maneuver (0.5.1): the "within N feet" its Effect speaks of, drawn on the
 * map around whoever carries it. `range` is feet from the edge of the carrier's space, null when
 * the ability has none (a blank Aura cell in the spreadsheet); `affects` is who it concerns, which
 * picks its colour (SW.AURA_COLORS). Every ring is preview-only by default (0.17.0; Mike: "ALL
 * auras should be preview-only by default"): it draws on hover and when the carrier shows it from
 * the Auras window, which writes `actor.system.auras.visible.<key>`. The `visible` field of 0.5.1
 * to 0.16.0 (the Item's default mark) is gone; the Talent and action models' `migrateData` drop it.
 */
export function auraFields() {
  return {
    aura: new fields.SchemaField({
      range: new fields.NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
      affects: new fields.StringField({
        required: true, choices: Object.keys(SW.AURA_AUDIENCES), initial: "all"
      })
    })
  };
}

/** Drop the retired `aura.visible` from a stored Item (0.17.0). Called from the models' `migrateData`. */
export function migrateAuraVisible(source) {
  if (source?.aura && Object.hasOwn(source.aura, "visible")) delete source.aura.visible;
  return source;
}

/**
 * An `aura` rule in the Item's stored rules overrides the field (0.13.0): the build writes the
 * field from the rule, and this re-derives it at prepare so a world Item whose Automation textarea
 * a GM edits draws the ring the line says without a second write. Called before prepareAura.
 */
export function applyAuraRule(system) {
  const rule = (system.rules ?? []).find(r => (r?.kind === "aura") && !r.error);
  if (rule) system.aura = toAuraField(rule);
}

/** Whether the ability has an aura at all, its colour, and the short line the sheet prints for it. */
export function prepareAura(system) {
  const aura = system.aura;
  system.hasAura = Number.isInteger(aura?.range) && (aura.range > 0);
  system.auraColor = SW.AURA_COLORS[aura?.affects] ?? SW.AURA_COLORS.all;
  system.auraLabel = system.hasAura
    ? game.i18n.format("STARWROUGHT.Field.auraSummary", {
      feet: aura.range,
      affects: game.i18n.localize(SW.AURA_AUDIENCES[aura.affects]?.label ?? SW.AURA_AUDIENCES.all.label)
    })
    : "";
}
