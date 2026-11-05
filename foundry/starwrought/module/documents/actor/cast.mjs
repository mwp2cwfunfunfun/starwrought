/**
 * SwActor: the Cast Maneuver (PHB v4.21, Spellwork; 0.11.0). A spell Talent (`system.isSpell`) is
 * cast Quick ❷, Focused ❸ or Committed ❹ (SW.CAST_KINDS): the roll is the discipline's Proficiency
 * (the Talent's Constellation, or its parent when the Talent is a specialty's) with the
 * discipline's Key Attribute, against the better of the two Defenses the spell's Threat permits
 * on the target, and the card offers the spell's damage (SwDamage.rollSpell: the discipline's
 * rank in dice, one for a Quick Cast, no Might, delivered as the spell says).
 *
 * First cut: a Cast rolls at once, as a Reaction Strike does, outside the attack flow's declare,
 * commit and reveal (the coordinator declares weapon Blows and adversary attack rows only; the
 * first non-Blow Threat in the flow is the split CLAUDE.md names, and it is not in 0.11.0). The
 * defender's choice between the two Defenses is read as the higher Threshold, which is what a
 * defender choosing would choose, and the card names it; a Focused or Committed Cast in an
 * encounter is Prepared under the three-action rule and resolves at the next Opportunity, as a
 * Committed Strike does. Areas, pushes, conditions on a Hit, summons, Temporary Vigor pools and
 * healing are the Talent's text on the card, the table's to apply.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";

/** @param {typeof Actor} Base */
export const CastMixin = Base => class extends Base {
  /**
   * The discipline a spell Talent rolls: its Constellation, or the parent when that Constellation
   * is a group (a specialty within a discipline).
   * @param {Item} talent
   * @returns {{slug: string, name: string, rank: string, proficiency: number, attribute: string}}
   */
  spellDisciplineFor(talent) {
    const own = talent?.system?.constellation ?? "";
    const entry = this.system.constellations?.[own];
    const slug = entry?.parent || SW.getConstellation(own)?.parent || own;
    const prof = this.system.proficiency?.(slug) ?? { rank: "untrained", proficiency: 0, attribute: "wits", name: slug };
    const attribute = (prof.attribute in SW.ATTRIBUTES) ? prof.attribute : (SW.getConstellation(slug)?.attribute ?? "wits");
    return { slug, name: prof.name ?? SW.getConstellation(slug)?.name ?? slug, rank: prof.rank, proficiency: prof.proficiency, attribute };
  }

  /**
   * Cast a spell Talent.
   * @param {string} talentId
   * @param {object} [options]
   * @param {"quick"|"focused"|"committed"} [options.cast]  The commitment; Focused by default.
   * @param {string} [options.targetUuid]   A Token or Actor uuid, instead of the user's target.
   * @param {boolean} [options.prepared]    A finished preparation: the actions were paid when it began.
   * @returns {Promise<object|null>}
   */
  async castSpell(talentId, options = {}) {
    const talent = this.items.get(talentId);
    if (!talent || (talent.type !== "talent") || !talent.system.isSpell) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Cast.notASpell", { name: talent?.name ?? talentId }));
      return null;
    }
    if (this.type === "npc") {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Cast.npc"));
      return null;
    }
    const { cast: askedCast, targetUuid: askedTarget, prepared = false, ...rest } = options;
    const cast = SW.CAST_KINDS[askedCast] ? askedCast : SW.DEFAULT_CAST;
    const kind = SW.CAST_KINDS[cast];
    const spell = talent.system.spell;
    const discipline = this.spellDisciplineFor(talent);

    // The target: the one named, else the user's one target.
    let targetToken = askedTarget ? this.#tokenForUuid(askedTarget) : null;
    if (!targetToken) targetToken = SwCheck.currentTarget();
    const targetActor = targetToken?.actor ?? null;

    // The Defense met: the higher of the two the Threat permits on this target (the defender's
    // choice, read as the choice a defender makes), named on the card. An adversary's number is
    // printed as a Reaction Strike's is (the immediate path, 0.4.2's).
    const permitted = talent.system.spellDefenses?.length ? talent.system.spellDefenses : (SW.THREATS[spell.threat]?.defenses ?? []);
    let target = null;
    let defense = permitted[0] ?? "evade";
    if (targetToken && (targetActor?.type !== SW.PARTY_TYPE)) {
      for (const key of permitted) {
        const read = SwCheck.thresholdOf(targetToken, key);
        if (read && (!target || read.threshold > target.threshold)) {
          target = read;
          defense = key;
        }
      }
    }

    const castLabel = `${game.i18n.localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost]}`;
    const threatLabel = game.i18n.localize(SW.THREATS[spell.threat]?.label ?? "STARWROUGHT.Threat.label");
    const deliveryLabel = talent.system.spellDelivery ? game.i18n.localize(SW.DELIVERIES[talent.system.spellDelivery].label) : "";
    const subtitle = [castLabel, threatLabel, deliveryLabel, discipline.name].filter(Boolean).join(" · ");

    const config = foundry.utils.mergeObject({
      actor: this,
      item: talent,
      kind: "attack",
      source: "spell",
      spellId: talent.id,
      cast,
      slug: discipline.slug,
      attribute: discipline.attribute,
      label: SW.plainName(talent.name),
      subtitle,
      strike: null,
      lockStrike: true,
      defense,
      defenseForced: true,
      threshold: target?.threshold ?? null,
      thresholdLabel: target?.label ?? "",
      targetUuid: targetToken?.document?.uuid ?? "",
      targetName: targetToken?.name ?? "",
      targetDefense: targetActor ? { key: defense, label: game.i18n.localize(SW.DEFENSES[defense].label), threshold: target?.threshold ?? 10, unavailable: null } : null,
      defender: targetActor,
      attackerTokenUuid: this.tokenOnScene()?.uuid ?? "",
      outcomes: this.#castOutcomes(talent, cast),
      // Pay for it, or Prepare it (PHB v4.21: a Focused or Committed Cast is Prepared under the
      // three-action rule) and resolve at the next Opportunity. A finished preparation paid already.
      beforeRoll: async () => {
        if (prepared) return true;
        if (kind.prepared && this.inEncounter) {
          await this.prepare({
            kind: "cast",
            label: `${SW.plainName(talent.name)}: ${castLabel}`,
            cost: kind.cost,
            talentId: talent.id,
            cast,
            targetUuid: targetToken?.document?.uuid ?? ""
          });
          return false;
        }
        await this.spendActions(kind.cost, { label: `${castLabel}: ${SW.plainName(talent.name)}` });
        return true;
      }
    }, rest, { inplace: false });
    return SwCheck.roll(config);
  }

  /** The three Cast texts as the card's outcome rows, keyed by degree so the one rolled is lit. */
  #castOutcomes(talent, cast) {
    const effects = talent.system.spell.effects ?? {};
    const text = effects[cast] || effects.focused || effects.quick || "";
    if (!text) return null;
    const kind = SW.CAST_KINDS[cast];
    const graze = kind.grazeDie
      ? game.i18n.localize("STARWROUGHT.Cast.grazeDie")
      : game.i18n.localize("STARWROUGHT.Cast.grazeNothing");
    return [
      { key: "critSuccess", label: "STARWROUGHT.Outcome.critical", text: `${text} ${game.i18n.localize("STARWROUGHT.Cast.criticalNote")}` },
      { key: "success", label: "STARWROUGHT.Outcome.hit", text },
      { key: "fail", label: "STARWROUGHT.Outcome.graze", text: graze },
      { key: "critFail", label: "STARWROUGHT.Outcome.miss", text: game.i18n.localize("STARWROUGHT.Cast.missNothing") }
    ];
  }

  /** A Token placeable for a Token or Actor uuid, on the viewed scene. */
  #tokenForUuid(uuid) {
    try {
      const doc = fromUuidSync(uuid);
      if (!doc) return null;
      if (doc.documentName === "Token") return doc.object ?? null;
      if (doc.documentName === "Actor") return doc.getActiveTokens?.(true, false)?.[0] ?? null;
    } catch {
      return null;
    }
    return null;
  }
};
