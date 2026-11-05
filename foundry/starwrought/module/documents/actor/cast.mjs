/**
 * SwActor: the Cast Maneuver (PHB v4.21, Spellwork; 0.11.0, in the attack flow since 0.12.0). A
 * spell Talent (`system.isSpell`) is cast Quick ❷, Focused ❸ or Committed ❹ (SW.CAST_KINDS): the
 * roll is the discipline's Proficiency (the Talent's Constellation, or its parent when the Talent
 * is a specialty's) with the discipline's Key Attribute, against one of the two Defenses the
 * spell's Threat permits on the target, and the card offers the spell's damage
 * (SwDamage.rollSpell: the discipline's rank in dice, one for a Quick Cast, no Might, delivered as
 * the spell says).
 *
 * No Defense is ever chosen by the system (0.12.0, rulings 159 and 163). A Cast with a target
 * DECLARES through the AttackCoordinator like any Blow: every defender commits one of the Threat's
 * two Defenses and an answer in the Combat Prompt, all reveal, and the caster's one die is read
 * against every target's Threshold (ruling 155). A Focused or Committed Cast in an encounter is
 * Prepared under the three-action rule first and declares when it is Finished, as a Committed
 * Strike does; a Quick Cast declares at once. With no target there is no defender, and the Cast
 * rolls against the Threshold typed in the dialog. Areas, pushes, conditions on a Hit, summons,
 * Temporary Vigor pools and healing are the Talent's text on the card, the table's to apply.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { AttackCoordinator } from "../../combat/attack-coordinator.mjs";
import { castOutcomes } from "../../combat/attack-source.mjs";

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
   * @param {string} [options.targetUuid]     A Token or Actor uuid, instead of the user's targets.
   * @param {string[]} [options.targetUuids]  Several, from a finished preparation.
   * @param {boolean} [options.prepared]      A finished preparation: the actions were paid when it began.
   * @param {boolean} [options.blind]         The attack flow's roll (0.5.0 brief): the die for the
   *                                          coordinator to read against every target, nothing of
   *                                          the defender read, nothing posted, nothing paid.
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
    const {
      cast: askedCast, targetUuid: askedTarget = "", targetUuids: askedTargets = [],
      prepared = false, blind = false, ...rest
    } = options;
    const cast = SW.CAST_KINDS[askedCast] ? askedCast : SW.DEFAULT_CAST;
    const kind = SW.CAST_KINDS[cast];
    const spell = talent.system.spell;
    const discipline = this.spellDisciplineFor(talent);
    const castLabel = `${game.i18n.localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost]}`;
    const name = SW.plainName(talent.name);

    // The targets: the ones a finished preparation remembered, else the one named, else the user's
    // targets, else the one this token is remembered as having (SwActor#declaredTargets).
    const remembered = (askedTargets ?? []).map(uuid => this.#tokenForUuid(uuid)).filter(t => t?.actor);
    const targets = remembered.length ? remembered : this.declaredTargets({ targetUuid: askedTarget });
    const targetToken = targets[0] ?? null;
    const targetActor = targetToken?.actor ?? null;

    // Prepare first (PHB v4.21: a Focused or Committed Cast is Prepared under the three-action
    // rule in an encounter) and resolve at the next Opportunity; a finished preparation paid already.
    if (!blind && !prepared && kind.prepared && this.inEncounter) {
      return this.prepare({
        kind: "cast",
        label: `${name}: ${castLabel}`,
        cost: kind.cost,
        talentId: talent.id,
        cast,
        targetUuid: targetToken?.document?.uuid ?? "",
        targetUuids: targets.map(t => t.document?.uuid ?? "").filter(Boolean)
      });
    }

    // DECLARE rather than roll (0.12.0): a Cast at a target enters the attack flow, and pays its
    // actions as the declaration stands, as a Strike does. The coordinator reads the Threat and
    // its two Defenses off the Talent; the defenders choose.
    if (!blind && targets.length) {
      const pub = await AttackCoordinator.declare({ attacker: this, talentId: talent.id, cast, targets, prepared });
      if (pub && !prepared) await this.spendActions(kind.cost, { label: `${castLabel}: ${name}` });
      return pub;
    }

    // The flow's blind roll, or a Cast with no defender against a typed Threshold.
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
      label: name,
      subtitle,
      strike: null,
      lockStrike: true,
      // No Defense is read here (ruling 159): the coordinator holds the committed one, or there is
      // no defender at all.
      defense: null,
      defenseForced: true,
      threshold: null,
      thresholdLabel: "",
      targetUuid: blind ? "" : (targetToken?.document?.uuid ?? ""),
      targetName: targetToken?.name ?? "",
      targetDefense: (blind && targetActor) ? { key: null, label: "", threshold: null, unavailable: null, hidden: true } : null,
      defender: blind ? null : targetActor,
      attackerTokenUuid: this.tokenOnScene()?.uuid ?? "",
      outcomes: castOutcomes(talent, cast),
      // A Cast with no defender pays here; the flow's blind roll paid at the declaration, and a
      // finished preparation when it began.
      beforeRoll: async () => {
        if (prepared || blind) return true;
        await this.spendActions(kind.cost, { label: `${castLabel}: ${name}` });
        return true;
      }
    }, rest, { inplace: false });
    // The blind roll never posts, whatever a caller's passthrough says: the coordinator's
    // resolution cards are the record.
    if (blind) config.postCard = false;
    return SwCheck.roll(config);
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
