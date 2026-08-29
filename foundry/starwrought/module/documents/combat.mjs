/**
 * Initiative.
 *
 * "Initiative is whatever you were already doing." Awareness is the default, but a character who
 * was creeping along a wall rolls Stealth instead, which rewards the character who was doing the
 * useful thing. Adversaries do not roll: they have an Initiative Threshold and the GM writes the
 * order down.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";

export class SwCombatant extends Combatant {
  /** @inheritdoc */
  _getInitiativeFormula() {
    const actor = this.actor;
    if (!actor) return "1d20";
    if (actor.type === "npc") return String(actor.system.thresholds?.initiative ?? 10);
    const slug = this.getFlag(SW.SYSTEM_ID, "initiativeConstellation") || actor.system.initiative.slug;
    const prof = actor.system.proficiency(slug);
    const mod = actor.system.level
      + actor.system.attributes[prof.attribute].mod
      + prof.proficiency
      + actor.system.bonuses.initiative;
    return `1d20 ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`;
  }

  /** Which Constellation this combatant is rolling Initiative with. */
  get initiativeConstellation() {
    return this.getFlag(SW.SYSTEM_ID, "initiativeConstellation")
      || this.actor?.system.initiative?.slug
      || SW.DEFENSES.awareness.slug;
  }
}

/* -------------------------------------------- */

export class SwCombat extends Combat {
  /**
   * Roll initiative, letting a player nominate the Constellation that matches what they were
   * actually doing when the world sped up.
   * @param {string[]} ids
   * @param {object} [options]
   * @param {string} [options.constellation]  Force a Constellation for every combatant rolled.
   */
  async rollInitiative(ids, options = {}) {
    if (options.constellation) {
      const updates = ids.map(id => ({
        _id: id,
        [`flags.${SW.SYSTEM_ID}.initiativeConstellation`]: options.constellation
      }));
      await this.updateEmbeddedDocuments("Combatant", updates);
    }
    return super.rollInitiative(ids, options);
  }

  /**
   * Roll Initiative for one combatant through the normal check pipeline, so the card shows the
   * Constellation, the modifiers, and any situational bonus.
   * @param {string} combatantId
   * @param {string} slug
   */
  async rollInitiativeWithCheck(combatantId, slug) {
    const combatant = this.combatants.get(combatantId);
    const actor = combatant?.actor;
    if (!actor) return null;

    if (actor.type === "npc") {
      const value = actor.system.thresholds?.initiative ?? 10;
      await this.setInitiative(combatantId, value);
      return value;
    }

    const meta = actor.system.constellations?.[slug] ?? SW.getConstellation(slug);
    const result = await SwCheck.roll({
      actor,
      kind: "initiative",
      slug,
      label: game.i18n.localize("STARWROUGHT.Roll.initiative"),
      subtitle: meta.name
    });
    if (!result) return null;
    await combatant.setFlag(SW.SYSTEM_ID, "initiativeConstellation", slug);
    await this.setInitiative(combatantId, result.total);
    return result.total;
  }
}
