/**
 * SwActor: answering a blow. The Defense roll with its Reaction or Posture, and the Threshold a
 * given answer presents. Every Reaction is a Talent since PHB v4.21 and the table of the ones the
 * system implements is SW.REACTIONS; the words here are the fold of an answer's bonus into the
 * Defense it stands on. No Defense stands ready (0.12.0, ruling 159): the one that answers an
 * attack is committed in the Combat Prompt, per attack, by the defender or by the GM for them.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import {
  postureName as postureNameOf, postureBonus, postureZone, postureNeedsZone, postureRule
} from "../../helpers/answers.mjs";
import { ruleModifiers } from "../../rules/engine.mjs";
import { sceneContextFor, encounterContext } from "../../rules/scene.mjs";

/** The two basic Defenses that answer a Blow (PHB v4.21, The Four Threats): the default `permitted` list. */
const BLOW_DEFENSES = Object.freeze(["evade", "guard"]);

/** Is this key a Reaction ❶↺ that answers a Blow on the actor's own Defense (SW.REACTIONS, kind "reaction")? */
function answeringReaction(key) {
  return !!key && (SW.REACTIONS[key]?.kind === "reaction");
}

/** @param {typeof Actor} Base */
export const DefenseMixin = Base => class extends Base {
  /**
   * Roll one of the four Defenses. When it answers an Attack, pass the attacker's Attack
   * Threshold; the degrees are then read from the attacker's side, so beating it by 10 is a Miss.
   *
   * PHB v4.21, Answering an Attack: the basic Defense always rolls, whatever you have left. A
   * Reaction does better and is paid from the same six actions: a Talent of Evade or Guard
   * (Sidestep ❶↺ is Evade +2 Situation and a Step on a Stop; Parry ❶↺ is Guard +2 Situation with
   * a rigid implement and Control on a Stop; ...), one answer per attack. The dialog offers the
   * Reactions this actor owns; the engine charges the action.
   * @param {string} key  A key of SW.DEFENSES.
   * @param {object} [options]
   * @param {number} [options.threshold]   The Attack Threshold being answered.
   * @param {string|null} [options.reaction]  A key of SW.REACTIONS of kind "reaction", or null.
   * @param {string} [options.strike]      The attacker's commitment, if known (quick | deliberate | committed).
   * @param {Actor|Token} [options.attacker]  Who is attacking; defaults to the current target.
   * @param {{id: string, targetId: string}} [options.workflow]  The attack flow's Defense roll
   *                                       (0.5.0 brief): kind "defense" with no Threshold, since
   *                                       the coordinator holds the adversary's number and reads
   *                                       this die against it; the answer was committed in the
   *                                       prompt, so no Reaction is offered here; nothing posts.
   * @param {{talentId: string, name?: string, zone: string|null}} [options.posture]  A Posture ⓿↺
   *                                       committed in the prompt: its Situation bonus to the
   *                                       Defense, its Zone Exposed before the die (or its
   *                                       drawback applied). Never beside a Reaction.
   * @param {{threat: string, melee: boolean}|null} [options.threat]  The Threat answered (0.13.0),
   *                                       for the Automation rules' `AGAINST`; rides into the roll
   *                                       as `cfg.threat`.
   */
  async rollDefense(key, options = {}) {
    const { reaction: askedReaction, attacker: givenAttacker, workflow = null, posture: askedPosture = null, threat = null, ...rest } = options;
    const reaction = answeringReaction(askedReaction) ? askedReaction : null;
    // A Reaction stands on its own Defense (Sidestep on Evade, Parry on Guard), whichever button was pressed.
    if (reaction && SW.REACTIONS[reaction].defense) key = SW.REACTIONS[reaction].defense;
    const def = SW.DEFENSES[key];
    if (!def) return null;

    // A Posture is an answer in its own right (brief): it never stands beside a Reaction, and a
    // Posture that Exposes a Zone of the defender's choice is not a Posture until the Zone is
    // named (the prompt names it; Drop Flat and Kneel need none).
    const posture = (askedPosture?.talentId && (!postureNeedsZone(this, askedPosture) || (askedPosture.zone in SW.ZONES)))
      ? askedPosture : null;
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");
    // Plain, so the ⓿↺ the modifier line and the card append is the only one shown (0.5.1, T16).
    const postureName = posture
      ? SW.plainName(postureNameOf(this, posture) ?? game.i18n.localize("STARWROUGHT.Reaction.posture"))
      : "";

    const attackerToken = givenAttacker?.document ? givenAttacker
      : (givenAttacker?.getActiveTokens?.(false, false)?.[0] ?? SwCheck.currentTarget());
    const attacker = givenAttacker?.actor ?? (givenAttacker?.documentName === "Actor" ? givenAttacker : null)
      ?? attackerToken?.actor ?? null;

    // The Posture's bonus goes into the Defense's own modifiers (the engine adds a Reaction's in
    // roll()); with PHB v4.21's stacking it adds to what is there, and one answer per attack keeps
    // it one.
    const { modifiers: givenModifiers, beforeRoll: callerBeforeRoll, ...passthrough } = rest;
    const modifiers = [...(givenModifiers ?? [])];
    const bonus = posture ? postureBonus(this, posture) : 0;
    if (posture && bonus) {
      modifiers.push({
        label: `${postureName} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`,
        value: bonus,
        type: "situation"
      });
    }
    const zone = posture ? postureZone(this, posture) : null;
    const drawback = posture ? (postureRule(this, posture)?.rule.drawback ?? null) : null;

    const config = {
      actor: this,
      kind: (workflow || (options.threshold !== undefined)) ? "defense" : "check",
      slug: def.slug,
      label: game.i18n.localize(def.label),
      subtitle: game.i18n.localize(def.hint),
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.attackThreshold"),
      defense: key,
      reaction,
      posture: posture ? { talentId: posture.talentId, name: postureName, zone } : null,
      attacker,
      targetUuid: attackerToken?.document?.uuid ?? "",
      targetName: attackerToken?.name ?? attacker?.name ?? "",
      defenderTokenUuid: this.tokenOnScene()?.uuid ?? "",
      threat,
      modifiers,
      // A Posture Exposes its Zone whether or not it works (brief), so the Zone opens before the
      // die, marked as a Posture's so Recenter leaves it and the end of the round clears it; Drop
      // Flat drops you Prone instead (PHB v4.21).
      beforeRoll: async cfg => {
        if (zone) await this.setExposed(zone, true, { posture: true });
        if (drawback === "prone") await this.setCondition?.("prone", true);
        return callerBeforeRoll ? callerBeforeRoll(cfg) : true;
      }
    };
    if (workflow) {
      Object.assign(config, {
        workflow,
        // The coordinator's Threshold is authoritative and an adversary's is hidden from players,
        // so the die is read there: a null Threshold here, and no card.
        threshold: null,
        // The answer was committed in the prompt: the dialog offers no Reaction radios, as it
        // offers none when a Reaction answers a Reaction.
        basicOnly: true,
        postCard: false
      });
    }
    return SwCheck.roll(foundry.utils.mergeObject(config, passthrough, { inplace: false }));
  }

  /**
   * The Threshold a Defense presents with an answer folded in (0.5.0 brief, Thresholds): the one
   * rules function behind a commitment made in the attack flow's prompt, so the prompt's preview
   * and the coordinator's resolution read the same number. Pure: nothing is written. No Defense
   * is ever chosen by the system (0.12.0, ruling 159): the `defense` is always the one a
   * defender, or the GM for them, committed.
   *
   * PHB v4.21, Answering an Attack. A Reaction stands on its own Defense (SW.REACTIONS) with its
   * bonus; a Posture ⓿↺ stands on its Defense with its bonus (the table's, or the general rule's
   * +2). The bonus goes into the Defense's own modifiers through SW.resolveModifiers, where it
   * adds (v4.21's stacking), and a commitment is a Reaction or a Posture, never both. An
   * adversary's Defenses carry no modifier stack, so its bonus is added arithmetically to the
   * GM's Threshold. When the Defense is unavailable (Evade while Grabbed or Restrained) the other
   * basic Defense answers and anything built on the lost one falls away; a Head Wound removes
   * every Reaction and Posture; a Reaction the character does not own falls back; a Parry without
   * a rigid implement is noted, not enforced.
   *
   * @param {object} answer
   * @param {string} answer.defense               A key of SW.DEFENSES (evade or guard for a Blow).
   * @param {string|null} [answer.reaction]       A key of SW.REACTIONS of kind "reaction", or null.
   * @param {{talentId: string, name?: string, zone?: string}|null} [answer.posture]
   * @param {string[]} [answer.permitted]         The Defenses the Threat allows (0.12.0): when the
   *                                              one named is unavailable, the other of these
   *                                              answers. A Blow's two by default.
   * @param {{threat: string, melee: boolean}|null} [answer.threat]  The Threat answered (0.13.0), for
   *                                              the Automation rules' `AGAINST`; with it, and the
   *                                              defender's token on the scene, the rules that need
   *                                              the map or the round are folded in here, which the
   *                                              sheet's own Threshold leaves out.
   * @returns {{key: string, threshold: number, bonus: number, label: string, reaction: string|null,
   *            posture: object|null, note: string|null, unavailable: string|null,
   *            marks: Array<{key: string, per: string}>}}
   * @throws {Error} when both a Reaction and a Posture are given.
   */
  defenseThresholdFor({ defense, reaction = null, posture = null, permitted = BLOW_DEFENSES, threat = null, attacker = null } = {}) {
    const sys = this.system;
    // The other party (0.15.0, `MARKED`): the attacker whose Blow this Threshold answers, or the
    // roller whose check reads it; an Actor, a Token or a TokenDocument, as the caller has it.
    const attackerDoc = attacker?.document ?? (attacker?.documentName === "Token" ? attacker : null);
    const attackerActor = attacker?.actor ?? (attacker?.documentName === "Actor" ? attacker : null) ?? attackerDoc?.actor ?? null;
    const other = (attackerActor || attackerDoc)
      ? { actor: attackerActor, uuid: attackerActor?.uuid ?? null, tokenUuid: attackerDoc?.uuid ?? attackerActor?.tokenOnScene?.()?.uuid ?? null, name: String(attackerDoc?.name ?? attackerActor?.name ?? "") }
      : null;
    reaction = answeringReaction(reaction) ? reaction : null;
    posture = (posture && (typeof posture === "object") && posture.talentId) ? posture : null;
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");
    const allowed = (Array.isArray(permitted) && permitted.length) ? permitted.filter(d => SW.DEFENSES[d]) : [...BLOW_DEFENSES];

    // Which Defense: the Reaction's own, else the one named.
    let key = SW.REACTIONS[reaction]?.defense ?? (SW.DEFENSES[defense] ? defense : allowed[0]);
    const named = key;

    const blocked = sys.defenses?.[key]?.unavailable ?? null;
    if (blocked) {
      // The other Defense the Threat permits answers (Guard for a Blow's Evade while Grabbed); a
      // Threat with no other stays on the one named, noted.
      key = allowed.find(d => (d !== key) && !sys.defenses?.[d]?.unavailable) ?? key;
      // A Reaction is a Talent of its Defense, and so is a Posture: when the Defense cannot be
      // used, neither can what was built on it.
      reaction = null;
      posture = null;
    }

    let note = null;
    // No Reactions at all: a Head Wound, a Head critical. The basic Defense still rolls.
    const noReactions = sys.reactions?.blocked;
    if ((reaction || posture) && noReactions) {
      reaction = null;
      posture = null;
      note = (typeof noReactions === "string")
        ? game.i18n.localize(noReactions)
        : game.i18n.format("STARWROUGHT.Reaction.blocked", { name: this.name });
    }
    // A Reaction the character does not own falls back to the basic Defense: a Talent since
    // removed. The roll has to read what is true now; an adversary owns them all (the GM's call).
    if (reaction && (this.type === "character") && !(reaction in (sys.reactions?.owned ?? {}))) {
      note = game.i18n.format("STARWROUGHT.Reaction.needsTalent", {
        reaction: game.i18n.localize(SW.REACTIONS[reaction].label),
        talent: game.i18n.localize(SW.REACTIONS[reaction].label)
      });
      reaction = null;
    }
    if (reaction && SW.REACTIONS[reaction].rigid && !this.rigidImplement) {
      note = game.i18n.localize("STARWROUGHT.Reaction.needsRigid");
    }

    // The answer's name: a Reaction's label, or the Posture's own name.
    const postureName = posture
      ? (postureNameOf(this, posture) ?? game.i18n.localize("STARWROUGHT.Reaction.posture"))
      : "";
    const answerLabel = reaction ? game.i18n.localize(SW.REACTIONS[reaction].label) : postureName;

    // The fold. The data model leaves an answer's bonus out of its own Threshold on purpose; it
    // is added here, once, through the same stack the Defense already resolved.
    const def = sys.defenses?.[key];
    let threshold = def?.threshold ?? 10;
    const bonus = reaction ? (SW.REACTIONS[reaction].bonus ?? 0) : (posture ? postureBonus(this, posture) : 0);
    // The Automation rules the sheet's pass could not read (0.13.0): those that need the map, the
    // Threat or the round, asked with `momentOnly` so nothing is counted twice. An adversary has
    // no modifier stack and its rules do not reach its Defenses (adversaries roll flat).
    let marks = [];
    let momentMods = [];
    if (Array.isArray(def?.modifiers) && (this.type === "character")) {
      // `read` (0.15.0): a Threshold read has no dialog, so a claim applies only when armed.
      const moment = ruleModifiers(this, {
        kind: "defense", slug: SW.DEFENSES[key].slug, item: null, rank: def.rank ?? "untrained",
        threat, other, scene: sceneContextFor(this), encounter: encounterContext(), momentOnly: true, read: true
      });
      momentMods = moment.applied;
      marks = moment.marks;
    }
    if (bonus || momentMods.length) {
      if (Array.isArray(def?.modifiers)) {
        const { total } = SW.resolveModifiers([
          ...def.modifiers,
          ...momentMods,
          ...(bonus ? [{ label: answerLabel, value: bonus, type: "situation" }] : [])
        ]);
        threshold = 10 + total + (def.sizeMod ?? 0);
      } else {
        threshold += bonus;
      }
    }

    const defenseLabel = game.i18n.localize(SW.DEFENSES[key].label);
    return {
      key,
      threshold,
      bonus,
      label: answerLabel ? `${defenseLabel} (${answerLabel})` : defenseLabel,
      reaction,
      posture: posture ? { talentId: posture.talentId, name: postureName, zone: postureZone(this, posture) } : null,
      note,
      marks,
      unavailable: blocked
        ? game.i18n.format("STARWROUGHT.Defense.answeringInstead", {
            named: game.i18n.localize(SW.DEFENSES[named].label),
            reason: game.i18n.localize(SW.CONDITIONS[blocked]?.name ?? blocked),
            defense: defenseLabel
          })
        : null
    };
  }
};
