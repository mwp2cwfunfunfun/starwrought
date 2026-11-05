/**
 * Damage: rolling it, and the order of operations for spending it.
 *
 * The handbook's order (PHB v4.21, Damage Resolution) is followed literally, because it is the
 * sort of arithmetic a VTT is supposed to do for free: Immunity, then the total, then Resistance
 * (all of it), then Weakness (all of it, only if damage remains), then the Zone's Protection once
 * for a Zoned Attack (never for a Pervasive one), then the critical doubling, then Temporary
 * Vigor, then Vigor. What comes after the Vigor is the part v4.10 added: Spent at 0, Wounds per
 * Zone, and Dying only when the Torso or the Head carries its final Wound. Through v4.15 Weakness
 * came before Resistance and the doubling before Protection.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "./check.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export class SwDamage {
  /**
   * Roll the damage for one Result of a Strike and post a card with Apply buttons.
   *
   * PHB v4.10, Strike damage:
   *  - Deliberate or Committed Hit = weapon dice (by level) + specialization + Might (unless the
   *    weapon is Mechanical) + bonuses and penalties + precision, less Protection.
   *  - Quick Strike Hit = one weapon die + precision, less Protection. Nothing else.
   *  - Graze = one weapon die, less Protection, minimum 1. No precision, no talent damage.
   *  - A Critical Hit doubles the total; a Deadly die lands after the doubling.
   * @param {object} config
   * @param {Actor} config.actor
   * @param {Item} config.weapon
   * @param {"hit"|"graze"|"critical"} config.outcome
   * @param {string} [config.strike]        quick | deliberate | committed.
   * @param {string} [config.targetUuid]    The defender's token, for the Zone picker.
   * @param {number} [config.bonus]         Flat talent damage, added to full Hits and Criticals.
   * @param {string} [config.precision]     Precision damage formula (Sneak Attack, Mark Prey).
   * @returns {Promise<ChatMessage>}
   */
  static async roll({
    actor, weapon, outcome = "hit", strike = SW.DEFAULT_STRIKE, targetUuid = "", bonus = 0, precision = "",
    slug = "", thrown = false, rank = null
  } = {}) {
    const sys = actor.system;
    const kind = SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
    if (!SW.STRIKE_KINDS[strike]) strike = SW.DEFAULT_STRIKE;
    const graze = outcome === "graze";
    let critical = outcome === "critical";
    let critDenied = false;
    // A Quick Strike cannot Critically Hit unless the weapon is Agile: asked for a Critical, it
    // rolls a Hit and says why.
    if (critical && !SwCheck.strikeCanCrit(strike, weapon)) {
      critical = false;
      critDenied = true;
      outcome = "hit";
    }
    const flags = weapon.system.flags ?? {};
    const die = weapon.system.effectiveDie;

    const parts = [];
    if (graze || !kind.full) {
      // One weapon die: a Graze, or a Quick Strike's probe.
      parts.push({ label: weapon.name, formula: `1d${die}` });
      // Precision rides on a Quick Strike's Hit, and never on a Graze.
      if (!graze && precision) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Damage.precision"), formula: precision });
      }
    } else {
      // Full damage (PHB v4.21, Weapon Damage Dice): the dice your rank gives you, one at Trained
      // to four at Legendary, in the Proficiency the Strike rolled (Ranged for a weapon that
      // leaves the hand, a thrown dagger included, ruling 14, so the attack's slug decides when it
      // is known; Handling's lowered rank through `rank` when the roll passed it), then Might.
      // There is no specialization damage any more: "do not add them a second time as weapon
      // specialization" (ruling 153).
      const ranged = (slug === SW.RANGED_SLUG) || thrown || (!slug && weapon.system.isRanged);
      const block = ranged ? sys.ranged : sys.melee;
      const dice = SW.weaponDice(rank ?? block?.rank ?? "untrained");
      parts.push({ label: weapon.name, formula: `${dice}d${die}` });
      if (weapon.system.addsMight && sys.attributes?.might?.mod) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Attribute.might"), formula: String(sys.attributes.might.mod) });
      }
      const flat = (Number(bonus) || 0) + (sys.bonuses?.damage ?? 0);
      if (flat) parts.push({ label: game.i18n.localize("STARWROUGHT.Damage.bonus"), formula: String(flat) });
      if (precision) parts.push({ label: game.i18n.localize("STARWROUGHT.Damage.precision"), formula: precision });
    }

    const roll = await new Roll(parts.map(p => p.formula).join(" + ")).evaluate();

    // Deadly dX: on a Critical Hit, add one die of the listed size. It is a critical effect of the
    // weapon, applied after the doubling rather than inside it.
    let deadly = null;
    if (critical && flags.deadly) {
      deadly = await new Roll(`1d${flags.deadly}`).evaluate();
    }

    const damageType = weapon.system.effectiveType;
    const armorPiercing = (flags.armorPiercing && damageType === "piercing") ? flags.armorPiercing : 0;

    // Where it lands (PHB v4.10, The Result). A Graze goes where the defender says; a Critical Hit
    // where the attacker says; a Hit lands on the Torso, or on an Exposed Zone if the Strike was
    // Deliberate or Committed. A Quick Strike lands on the Torso and nowhere else.
    const target = targetUuid ? (fromUuidSync(targetUuid)?.actor ?? null) : null;
    const exposedZones = Object.keys(SW.ZONES).filter(z => target?.system?.zones?.[z]?.exposed);
    let zoneLocked = false;
    let zoneNote = "";
    let offered = Object.keys(SW.ZONES);
    if (graze) zoneNote = "STARWROUGHT.Damage.zoneDefender";
    else if (critical) zoneNote = "STARWROUGHT.Damage.zoneAttacker";
    else if (kind.placeOnExposed) {
      offered = [SW.DEFAULT_ZONE, ...exposedZones.filter(z => z !== SW.DEFAULT_ZONE)];
      zoneNote = exposedZones.length ? "STARWROUGHT.Damage.zoneExposedChoice" : "STARWROUGHT.Damage.zoneTorso";
      zoneLocked = !exposedZones.length;
    } else {
      offered = [SW.DEFAULT_ZONE];
      zoneLocked = true;
      zoneNote = "STARWROUGHT.Damage.zoneQuick";
    }
    // A Critical Hit with a full Strike on an Exposed Zone Wounds it, so that is where it opens.
    const defaultZone = (critical && kind.ignoresExposedProtection && exposedZones.length)
      ? exposedZones[0]
      : SW.DEFAULT_ZONE;

    const content = await renderTemplate("systems/starwrought/templates/chat/damage-card.hbs", {
      actor,
      weapon,
      outcome,
      outcomeLabel: game.i18n.localize(`STARWROUGHT.Outcome.${outcome}`),
      strike,
      strikeLabel: game.i18n.localize(kind.label),
      strikeGlyph: SW.ACTION_GLYPHS[kind.cost],
      critical,
      graze,
      critDenied,
      formula: roll.formula,
      total: roll.total,
      parts,
      deadly: deadly ? { formula: deadly.formula, total: deadly.total } : null,
      damageType,
      damageTypeLabel: game.i18n.localize(SW.DAMAGE_TYPES[damageType].label),
      armorPiercing,
      massive: !!flags.massive,
      nonlethal: !!flags.nonlethal,
      zones: offered.map(key => ({ key, label: SW.ZONES[key].label, exposed: exposedZones.includes(key) })),
      zoneLocked,
      zoneNote,
      defaultZone,
      targetUuid,
      targetName: target?.name ?? ""
    });

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls: deadly ? [roll, deadly] : [roll],
      flags: {
        starwrought: {
          kind: "damage",
          outcome,
          strike,
          base: roll.total,
          deadly: deadly?.total ?? 0,
          damageType,
          critical,
          graze,
          armorPiercing,
          massive: !!flags.massive,
          nonlethal: !!flags.nonlethal,
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
   * Roll a spell's damage for one Result of a Cast and post a card with Apply buttons (PHB v4.21,
   * Spellwork). The dice are the discipline's rank's (SW.spellDice: one at Trained to four at
   * Legendary), one for a Quick Cast; the die and the type are the Talent's spell block; no Might,
   * no specialization and no sheet damage bonus (ruling 136). A Graze on a Focused or Committed
   * Cast is one die; a Quick Cast's Graze deals nothing (the card offers no button). A Critical
   * Hit doubles in the pipeline as any does (ruling 135). The card carries the spell's Delivery,
   * so a Pervasive spell's Apply skips Protection; a Zoned spell lands on the Torso or a Zone the
   * caster picks, as a Deliberate Strike does.
   * @param {object} config
   * @param {Actor} config.actor
   * @param {Item} config.talent
   * @param {"hit"|"graze"|"critical"} [config.outcome]
   * @param {string} [config.cast]
   * @param {string} [config.targetUuid]
   * @returns {Promise<ChatMessage|null>}
   */
  static async rollSpell({ actor, talent, outcome = "hit", cast = SW.DEFAULT_CAST, targetUuid = "" } = {}) {
    const spell = talent?.system?.spell;
    if (!spell?.die) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Cast.noDie", { name: talent?.name ?? "" }));
      return null;
    }
    const kind = SW.CAST_KINDS[cast] ?? SW.CAST_KINDS[SW.DEFAULT_CAST];
    const graze = outcome === "graze";
    const critical = outcome === "critical";
    const discipline = actor.spellDisciplineFor?.(talent) ?? { rank: "untrained", name: "" };
    const dice = (graze || !kind.full) ? 1 : SW.spellDice(discipline.rank);
    const parts = [{ label: `${SW.plainName(talent.name)} (${game.i18n.localize(SW.RANKS[discipline.rank]?.label ?? "")})`, formula: `${dice}d${spell.die}` }];
    const roll = await new Roll(parts.map(p => p.formula).join(" + ")).evaluate();
    const damageType = SW.DAMAGE_TYPES[talent.system.spellType] ? talent.system.spellType : "untyped";
    const delivery = talent.system.spellDelivery || "zoned";
    const pervasive = delivery === "pervasive";

    const target = targetUuid ? (fromUuidSync(targetUuid)?.actor ?? null) : null;
    const exposedZones = Object.keys(SW.ZONES).filter(z => target?.system?.zones?.[z]?.exposed);
    const offered = pervasive ? [SW.DEFAULT_ZONE] : [SW.DEFAULT_ZONE, ...exposedZones.filter(z => z !== SW.DEFAULT_ZONE)];
    const zoneNote = pervasive ? "STARWROUGHT.Cast.zonePervasive"
      : graze ? "STARWROUGHT.Damage.zoneDefender"
      : critical ? "STARWROUGHT.Damage.zoneAttacker"
      : (exposedZones.length ? "STARWROUGHT.Damage.zoneExposedChoice" : "STARWROUGHT.Damage.zoneTorso");

    const content = await renderTemplate("systems/starwrought/templates/chat/damage-card.hbs", {
      actor,
      weapon: { name: SW.plainName(talent.name), img: talent.img },
      outcome,
      outcomeLabel: game.i18n.localize(`STARWROUGHT.Outcome.${outcome}`),
      strike: null,
      strikeLabel: game.i18n.localize(kind.label),
      strikeGlyph: SW.ACTION_GLYPHS[kind.cost],
      critical,
      graze,
      critDenied: false,
      total: roll.total,
      formula: roll.formula,
      parts,
      deadly: null,
      damageType,
      damageTypeLabel: `${game.i18n.localize(SW.DAMAGE_TYPES[damageType].label)} · ${game.i18n.localize(SW.DELIVERIES[delivery].label)}`,
      armorPiercing: 0,
      massive: false,
      targetName: target?.name ?? "",
      zones: offered.map(z => ({ key: z, label: SW.ZONES[z].label, exposed: exposedZones.includes(z) })),
      defaultZone: SW.DEFAULT_ZONE,
      zoneLocked: pervasive || (!graze && !critical && !exposedZones.length),
      zoneNote
    });
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls: [roll],
      flags: {
        starwrought: {
          kind: "damage",
          outcome,
          strike: null,
          base: roll.total,
          deadly: 0,
          damageType,
          critical,
          graze,
          armorPiercing: 0,
          massive: false,
          nonlethal: false,
          delivery,
          targetUuid,
          actorUuid: actor.uuid,
          weaponId: null,
          spellId: talent.id,
          cast
        }
      }
    };
    ChatMessage.applyRollMode(messageData, game.settings.get("core", "rollMode"));
    return ChatMessage.create(messageData);
  }

  /* -------------------------------------------- */

  /**
   * Spend damage against one Actor, following the printed order of operations, then let the body
   * answer: Spent at 0 Vigor, a Wound where the rules put one, Dying when a Wound is the last the
   * Torso or the Head can carry.
   * @param {Actor} actor
   * @param {object} config
   * @param {number} config.base            The rolled total, before doubling and Protection.
   * @param {number} [config.deadly]        A Deadly die, added after the doubling.
   * @param {string} [config.type]          Damage type.
   * @param {string} [config.zone]          Which Zone the blow landed on.
   * @param {boolean} [config.critical]     Double the total, and apply the Zone's critical effect.
   * @param {boolean} [config.graze]        A Graze: Protection applies, minimum 1, and never a Wound.
   * @param {string} [config.strike]        quick | deliberate | committed. Decides whether an
   *                                        Exposed Zone's Protection is 0 and whether a crit Wounds.
   * @param {number} [config.armorPiercing] Protection the attacker ignores.
   * @param {boolean} [config.massive]      The Massive trait: any Critical Hit Wounds.
   * @param {boolean} [config.nonlethal]    Nonlethal: a Wound on a Spent creature knocks it out instead.
   * @param {number} [config.multiplier]    1 for damage, -1 to heal, 0.5 for half.
   * @param {"zoned"|"pervasive"} [config.delivery]  How the damage arrives (PHB v4.21, Damage
   *                                        Delivery): Zoned meets the Zone's Protection once;
   *                                        Pervasive (a Blast's heat, a Blight, Persistent Damage)
   *                                        ignores ordinary Protection.
   * @returns {Promise<object>} A breakdown of what happened.
   */
  static async apply(actor, {
    base = 0, deadly = 0, type = "untyped", zone = SW.DEFAULT_ZONE,
    critical = false, graze = false, strike = SW.DEFAULT_STRIKE, armorPiercing = 0,
    massive = false, nonlethal = false, multiplier = 1, delivery = "zoned"
  } = {}) {
    const sys = actor.system;
    const steps = [];
    // `strike: null` is damage that is not a Strike at all (a fall, a Blast): it meets full
    // Protection and never Wounds through an Exposed Zone. An unknown kind is read as Deliberate.
    const kind = (strike === null) ? null : (SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE]);
    if (!(zone in SW.ZONES)) zone = SW.DEFAULT_ZONE;
    const pervasive = delivery === "pervasive";

    // Healing takes the short road.
    if (multiplier < 0) {
      const healed = Math.abs(Math.floor(base * multiplier * -1));
      return this.#applyHealing(actor, healed);
    }

    // The order is PHB v4.21's (Damage Resolution), followed literally:
    // 1. Apply Immunity.
    if (sys.isImmuneTo(type)) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.immune"), value: 0, total: 0 });
      return { total: 0, steps, zone, applied: 0, vigorBefore: sys.vigor?.value ?? 0, vigorAfter: sys.vigor?.value ?? 0 };
    }

    // 2. Add up all of the remaining dice, damage bonuses, and damage modifiers.
    let total = Math.floor(base * multiplier);
    steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.rolled"), value: total, total });

    // 3. Subtract all applicable Resistance (a sum since v4.21). Unlike Protection, Resistance can
    //    take an instance all the way to 0.
    const resistance = sys.resistanceTo(type);
    if (resistance && total > 0) {
      total = Math.max(0, total - resistance);
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.resistance"), value: -resistance, total });
    }

    // 4. Add all applicable Weakness (a sum since v4.21), only if damage remains after Resistance.
    const weakness = sys.weaknessTo(type);
    if (weakness && total > 0) {
      total += weakness;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.weakness"), value: weakness, total });
    }

    // 5. For a Zoned Attack, subtract the Zone's Protection once, before the doubling (v4.21 moved
    //    it ahead of the Critical Hit: "Protection before doubling", the Example of Play's own
    //    lesson). Protection alone can never reduce positive damage below 1. An Exposed Zone is 0
    //    against a Deliberate or Committed Strike only; a Quick Strike meets it in full. A
    //    Pervasive Attack and Persistent Damage ignore ordinary Protection.
    const exposed = !!sys.zones?.[zone]?.exposed;
    const protection = pervasive
      ? { value: 0, steps: [{ label: game.i18n.localize("STARWROUGHT.Damage.pervasive"), value: 0 }] }
      : sys.zoneProtection(zone, { type, ignore: armorPiercing, strike });
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
    } else if (pervasive && total > 0) {
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.pervasive"), value: 0, total });
    }

    // 6. Double what remains if it was a Critical Hit.
    if (critical && total > 0) {
      total *= 2;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.critical"), value: total / 2, total });
    }

    // A Deadly die is an additional critical effect of the weapon, so it lands after the doubling.
    if (deadly) {
      total += deadly;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.deadly"), value: deadly, total });
    }

    // 7. Deal damage to Temporary Vigor, then to Vigor. Nothing goes below 0: "damage beyond what
    //    it took to empty your Vigor is simply lost".
    const updates = {};
    let remaining = total;
    const temp = sys.vigor?.temp ?? 0;
    if (temp > 0 && remaining > 0) {
      const spent = Math.min(temp, remaining);
      updates["system.vigor.temp"] = temp - spent;
      remaining -= spent;
      steps.push({ label: game.i18n.localize("STARWROUGHT.Damage.temp"), value: -spent, total: remaining });
    }

    const before = sys.vigor?.value ?? 0;
    const after = Math.max(0, before - remaining);
    updates["system.vigor.value"] = after;

    const result = {
      total,
      applied: total,
      zone,
      type,
      steps,
      strike,
      critical,
      graze,
      delivery,
      protection: protection.value,
      vigorBefore: before,
      vigorAfter: after,
      spentBefore: before === 0,
      spent: after === 0,
      // Losing your last point of Temporary Vigor is not being reduced to 0 Vigor.
      droppedTo0: (before > 0) && (after === 0)
    };

    // swAnnounced: the applied card says what the Blow took; the audit stays quiet (0.5.1, T10).
    await actor.update(updates, { swAnnounced: true });

    // Reaching 0 Vigor is Spent: still on your feet, nothing left between the blows and the body.
    if (result.droppedTo0) await actor.setCondition("spent", true);

    // The Zone's critical effect, until the target Recenters. Off-Guard is a condition the system
    // tracks; the Arms, Legs and Head effects are announced on the card for the table to hold.
    if (critical && !graze && total > 0) {
      result.critEffect = SW.ZONE_CRITICALS[zone]?.effect ?? "";
      if (zone === "torso") await actor.setCondition("offGuard", true);
    }

    // Damage while Dying raises the value by 1, or by 2 from a Critical Hit. A Dying body is past
    // counting Wounds.
    if ((sys.dying ?? 0) > 0) {
      if (total > 0) {
        await actor.increaseDying(critical ? 2 : 1);
        result.dyingIncreased = critical ? 2 : 1;
        result.dying = actor.system.dying;
      }
      return result;
    }

    // Wounds (PHB v4.10). Two triggers, and each fires on its own:
    //  - Any Hit that lands while you are Spent Wounds the Zone struck; a Critical Hit inflicts
    //    two. A Graze never Wounds. The blow that empties your Vigor makes you Spent; the Wounds
    //    start with the next one.
    //  - A Critical Hit with a Deliberate or Committed Strike on an Exposed Zone Wounds it; a Quick
    //    Strike is a probe and cannot. An attack with the Massive trait Wounds on any Critical Hit.
    let wounds = 0;
    const reasons = [];
    if (!graze && result.spentBefore && total > 0) {
      wounds += critical ? 2 : 1;
      reasons.push("STARWROUGHT.Wound.reasonSpent");
    }
    if (critical && !graze && kind?.ignoresExposedProtection && exposed) {
      wounds += 1;
      reasons.push("STARWROUGHT.Wound.reasonExposed");
    }
    if (critical && !graze && massive) {
      wounds += 1;
      reasons.push("STARWROUGHT.Wound.reasonMassive");
    }

    if (wounds > 0) {
      if (nonlethal && result.spentBefore) {
        // Nonlethal damage that would Wound a Spent creature knocks it unconscious instead. It
        // wakes in ten minutes, or sooner if roused, with 1 Vigor.
        await actor.setCondition("unconscious", true);
        result.knockedOut = true;
      } else {
        result.wound = await actor.applyWound(zone, wounds, { critical, reasons });
        result.dying = actor.system.dying;
      }
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * Restore Vigor. Any effect that restores even 1 Vigor to a Dying character ends their Dying at
   * once: conscious, with that Vigor, Wounds untouched (PHB v4.10, Healing).
   */
  static async #applyHealing(actor, amount) {
    const sys = actor.system;
    const max = Number.isNumeric(sys.vigor?.max) ? sys.vigor.max : Infinity;
    const before = sys.vigor?.value ?? 0;
    const after = Math.min(max, before + amount);
    let endedDying = false;
    if ((sys.dying ?? 0) > 0 && amount > 0) {
      await actor.endDying({ conscious: true, vigor: after });
      endedDying = true;
    } else {
      await actor.update({ "system.vigor.value": after });
    }
    // Spent ends the moment there is Vigor between the blows and the body again.
    if (after > 0 && before === 0) await actor.setCondition("spent", false);
    return {
      total: -amount, applied: -amount, vigorBefore: before, vigorAfter: after, endedDying, steps: [],
      zone: null, spent: after === 0
    };
  }
}
