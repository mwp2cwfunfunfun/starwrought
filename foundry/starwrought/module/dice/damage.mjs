/**
 * Damage: rolling it, and the order of operations for spending it.
 *
 * The handbook's order is followed literally, because it is the sort of arithmetic a VTT is
 * supposed to do for free: Immunity, then the total, then Weakness, then Resistance, then the
 * critical doubling, then Protection, then Temporary Hit Points, then Hit Points.
 */

import * as SW from "../config.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export class SwDamage {
  /**
   * Roll the damage for one degree of success and post a card with Apply buttons.
   * @param {object} config
   * @param {Actor} config.actor
   * @param {Item} config.weapon
   * @param {"hit"|"graze"|"critical"} config.outcome
   * @param {string} [config.targetUuid]
   * @param {number} [config.bonus]        Flat talent damage, added to Hits and Criticals.
   * @param {string} [config.precision]    Precision damage formula (Sneak Attack, Mark Prey).
   * @returns {Promise<ChatMessage>}
   */
  static async roll({ actor, weapon, outcome = "hit", targetUuid = "", bonus = 0, precision = "" } = {}) {
    const sys = actor.system;
    const graze = outcome === "graze";
    const critical = outcome === "critical";
    const flags = weapon.system.flags;

    // A Graze is one weapon die and nothing else: no Might, no specialization, no extra dice from
    // your level, no talent damage of any kind.
    const parts = [];
    if (graze) {
      parts.push({ label: weapon.name, formula: `1d${weapon.system.effectiveDie}` });
    } else {
      parts.push({ label: weapon.name, formula: `${sys.weapons.dice}d${weapon.system.effectiveDie}` });
      if (weapon.system.addsMight && sys.attributes.might.mod) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Attribute.might"), formula: String(sys.attributes.might.mod) });
      }
      if (sys.weapons.specialization) {
        parts.push({
          label: game.i18n.localize("STARWROUGHT.Damage.specialization"),
          formula: String(sys.weapons.specialization)
        });
      }
      const flat = bonus + sys.bonuses.damage;
      if (flat) parts.push({ label: game.i18n.localize("STARWROUGHT.Damage.bonus"), formula: String(flat) });
      // Precision Damage is added to a Hit and to a Critical Hit, and is never added to a Graze.
      if (precision) parts.push({ label: game.i18n.localize("STARWROUGHT.Damage.precision"), formula: precision });
    }

    const roll = await new Roll(parts.map(p => p.formula).join(" + ")).evaluate();

    // Deadly dX: on a critical hit, add one die of the listed size. It is a critical effect of the
    // weapon, applied after the doubling rather than inside it.
    let deadly = null;
    if (critical && flags.deadly) {
      deadly = await new Roll(`1d${flags.deadly}`).evaluate();
    }

    const damageType = weapon.system.effectiveType;
    const content = await renderTemplate("systems/starwrought/templates/chat/damage-card.hbs", {
      actor,
      weapon,
      outcome,
      outcomeLabel: game.i18n.localize(`STARWROUGHT.Outcome.${outcome}`),
      critical,
      graze,
      formula: roll.formula,
      total: roll.total,
      parts,
      deadly: deadly ? { formula: deadly.formula, total: deadly.total } : null,
      damageType,
      damageTypeLabel: game.i18n.localize(SW.DAMAGE_TYPES[damageType].label),
      armorPiercing: (flags.armorPiercing && damageType === "piercing") ? flags.armorPiercing : 0,
      zones: Object.entries(SW.ZONES).map(([key, z]) => ({ key, label: z.label })),
      defaultZone: critical ? SW.DEFAULT_ZONE : SW.DEFAULT_ZONE,
      targetUuid
    });

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls: deadly ? [roll, deadly] : [roll],
      flags: {
        starwrought: {
          kind: "damage",
          outcome,
          base: roll.total,
          deadly: deadly?.total ?? 0,
          damageType,
          critical,
          graze,
          armorPiercing: (flags.armorPiercing && damageType === "piercing") ? flags.armorPiercing : 0,
          targetUuid,
          actorUuid: actor.uuid,
          weaponId: weapon.id
        }
      }
    };
    ChatMessage.applyRollMode(messageData, game.settings.get("core", "rollMode"));
    return ChatMessage.create(messageData);
  }

  /* -------------------------------------------- */

  /**
   * Spend damage against one Actor, following the printed order of operations.
   * @param {Actor} actor
   * @param {object} config
   * @param {number} config.base            The rolled total, before doubling and Protection.
   * @param {number} [config.deadly]        A Deadly die, added after the doubling.
   * @param {string} [config.type]          Damage type.
   * @param {string} [config.zone]          Which Zone the blow landed on.
   * @param {boolean} [config.critical]     Double the total.
   * @param {boolean} [config.graze]        A Graze: Protection still applies, and a Zone opens.
   * @param {number} [config.armorPiercing] Protection the attacker ignores.
   * @param {number} [config.multiplier]    1 for damage, -1 to heal, 0.5 for half.
   * @returns {Promise<object>} A breakdown of what happened.
   */
  static async apply(actor, {
    base = 0, deadly = 0, type = "untyped", zone = SW.DEFAULT_ZONE,
    critical = false, graze = false, armorPiercing = 0, multiplier = 1
  } = {}) {
    const sys = actor.system;
    const steps = [];

    // Healing takes the short road.
    if (multiplier < 0) {
      const healed = Math.abs(Math.floor(base * multiplier * -1));
      return this.#applyHealing(actor, healed);
    }

    // 1. Apply Immunity.
    if (sys.isImmuneTo(type)) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.immune"), value: 0, total: 0 });
      return { total: 0, steps, zone, applied: 0 };
    }

    // 2. Add up all of the remaining dice, damage bonuses, and damage modifiers.
    let total = Math.floor(base * multiplier);
    steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.rolled"), value: total, total });

    // 3. Add Weakness of the applicable damage type. A single point is enough to trigger it.
    const weakness = sys.weaknessTo(type);
    if (weakness && total > 0) {
      total += weakness;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.weakness"), value: weakness, total });
    }

    // 4. Subtract Resistance. Unlike Protection, Resistance can take an instance all the way to 0.
    const resistance = sys.resistanceTo(type);
    if (resistance) {
      total = Math.max(0, total - resistance);
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.resistance"), value: -resistance, total });
    }

    // 5. Double the total if it was a Critical Hit.
    if (critical) {
      total *= 2;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.critical"), value: total / 2, total });
    }

    // A Deadly die is an additional critical effect of the weapon, so it lands after the doubling.
    if (deadly) {
      total += deadly;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.deadly"), value: deadly, total });
    }

    // 6. Subtract Protection. Protection alone can never reduce damage below 1.
    const protection = sys.zoneProtection(zone, { type, ignore: armorPiercing });
    if (protection.value && total > 0) {
      const before = total;
      total = Math.max(1, total - protection.value);
      steps.push({
        label: game.i18n.format("STARWROUGHT.Damage.protection", {
          zone: game.i18n.localize(SW.ZONES[zone].label)
        }),
        value: total - before,
        total,
        detail: protection.steps
      });
    }

    // 7. Deal damage to Temporary Hit Points. 8. Deal damage to Hit Points.
    const updates = {};
    let remaining = total;
    const temp = sys.hp.temp ?? 0;
    if (temp > 0 && remaining > 0) {
      const spent = Math.min(temp, remaining);
      updates["system.hp.temp"] = temp - spent;
      remaining -= spent;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.temp"), value: -spent, total: remaining });
    }

    const before = sys.hp.value;
    const after = Math.max(0, before - remaining);
    updates["system.hp.value"] = after;

    const result = {
      total,
      applied: total,
      zone,
      type,
      steps,
      protection: protection.value,
      hpBefore: before,
      hpAfter: after,
      droppedTo0: (before > 0) && (after === 0)
    };

    // A Graze costs the defender an open Zone, win or lose. The defender chooses which; the
    // system opens the Zone that was struck, and the sheet lets them move it.
    if (graze) {
      updates[`system.zones.${zone}.exposed`] = true;
      result.exposed = zone;
    }

    await actor.update(updates);

    // Reaching 0 Hit Points, or taking damage while already Dying.
    if (result.droppedTo0) await actor.dropToZero({ critical });
    else if (sys.dying > 0 && total > 0) await actor.increaseDying(critical ? 2 : 1);

    return result;
  }

  /* -------------------------------------------- */

  /** Any effect that restores even 1 Hit Point to a Dying character ends their Dying at once. */
  static async #applyHealing(actor, amount) {
    const sys = actor.system;
    const max = sys.hp.max;
    const before = sys.hp.value;
    const after = Math.min(max, before + amount);
    const updates = { "system.hp.value": after };
    let endedDying = false;
    if (sys.dying > 0 && amount > 0) {
      updates["system.dying"] = 0;
      updates["system.wounded"] = sys.wounded + 1;
      endedDying = true;
    }
    await actor.update(updates);
    return { total: -amount, applied: -amount, hpBefore: before, hpAfter: after, endedDying, steps: [] };
  }
}
