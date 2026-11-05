/**
 * SwActor: answering a blow. The Defense roll with its Reaction or Posture, which Defense a
 * defender stands ready with (the stance), the Threshold a given answer presents, and setting the
 * stance. Every Reaction is a Talent since PHB v4.21 and the table of the ones the system
 * implements is SW.REACTIONS; the words here are the two basic Defenses and the fold of an
 * answer's bonus into one of them.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import {
  postureName as postureNameOf, postureBonus, postureZone, postureNeedsZone, postureRule
} from "../../helpers/answers.mjs";

/** The two basic Defenses that answer a Blow (PHB v4.21, The Four Threats), and the two stances. */
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
   */
  async rollDefense(key, options = {}) {
    const { reaction: askedReaction, attacker: givenAttacker, workflow = null, posture: askedPosture = null, ...rest } = options;
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
   * The Defense that answers a physical Attack on this actor right now: the stance, unless the
   * rules make its Defense unavailable (Evade while Grabbed or Restrained), in which case the
   * other basic Defense. Read live, so a stance changed a moment ago is what the attacker's roll
   * meets. No Reaction rides on a stance since PHB v4.21: one is chosen per Blow in the prompt.
   * @param {object} [_threat]  What is being answered; kept for the callers that pass it.
   * @returns {{key: string, stance: string, reaction: null, bonus: number, label: string,
   *            threshold: number, unavailable: string|null, note: string|null}}
   */
  answeringDefense(_threat = {}) {
    const sys = this.system;
    const stance = SW.LEGACY_STANCES[sys.stance] ?? sys.stance;
    const stanceDefense = BLOW_DEFENSES.includes(sys.stanceDefense) ? sys.stanceDefense
      : (BLOW_DEFENSES.includes(stance) ? stance : "evade");
    const read = this.defenseThresholdFor({ defense: stanceDefense });
    return {
      key: read.key,
      stance: stanceDefense,
      reaction: null,
      bonus: read.bonus,
      label: read.label,
      threshold: read.threshold,
      unavailable: read.unavailable,
      note: read.note
    };
  }

  /**
   * The Threshold a Defense presents with an answer folded in (0.5.0 brief, Thresholds): the one
   * rules function behind both the standing stance (`answeringDefense`) and a commitment made in
   * the attack flow's prompt, so the sheet, the prompt's preview and the coordinator's
   * resolution all read the same number. Pure: nothing is written.
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
   * @returns {{key: string, threshold: number, bonus: number, label: string, reaction: string|null,
   *            posture: object|null, note: string|null, unavailable: string|null}}
   * @throws {Error} when both a Reaction and a Posture are given.
   */
  defenseThresholdFor({ defense, reaction = null, posture = null } = {}) {
    const sys = this.system;
    reaction = answeringReaction(reaction) ? reaction : null;
    posture = (posture && (typeof posture === "object") && posture.talentId) ? posture : null;
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");

    // Which Defense: the Reaction's own, else the one named.
    let key = SW.REACTIONS[reaction]?.defense ?? (SW.DEFENSES[defense] ? defense : "evade");
    const named = key;

    const blocked = BLOW_DEFENSES.includes(key) ? (sys.defenses?.[key]?.unavailable ?? null) : null;
    if (blocked) {
      key = (key === "evade") ? "guard" : "evade";
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
      note = game.i18n.format("STARWROUGHT.Stance.needsTalent", {
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
    if (bonus) {
      if (Array.isArray(def?.modifiers)) {
        const { total } = SW.resolveModifiers([
          ...def.modifiers,
          { label: answerLabel, value: bonus, type: "situation" }
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
      unavailable: blocked
        ? game.i18n.format("STARWROUGHT.Stance.answeringInstead", {
            stance: game.i18n.localize(SW.DEFENSES[named].label),
            reason: game.i18n.localize(SW.CONDITIONS[blocked]?.name ?? blocked),
            defense: defenseLabel
          })
        : null
    };
  }

  /**
   * Choose how the next physical Attack is answered: Evade or Guard as the basic Defense (PHB
   * v4.21; a Reaction is chosen per Blow in the Combat Prompt, never stood ready). The defender's
   * call, so it lives here, and the attacker's roll reads it. A legacy Reaction stance (void,
   * parry, counter) is taken as the Defense it stood on.
   * @param {"evade"|"guard"} key
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   */
  async setStance(key, { announce = true } = {}) {
    key = SW.LEGACY_STANCES[key] ?? key;
    if (!BLOW_DEFENSES.includes(key)) return;
    if (this.system.stance === key) return;
    await this.update({ "system.stance": key });
    const answer = this.answeringDefense();
    // A Defense the rules say you cannot use right now is still yours to choose; the system says
    // so and leaves the ruling to the table.
    const notes = [answer.unavailable, answer.note].filter(Boolean);
    for (const note of notes) ui.notifications.warn(note);

    // Which Defense meets an Attack is the defender's to reveal, and the roll's card reveals it.
    // So nothing goes to the table here. A player's change is whispered to the GM, who is running
    // the thing about to swing and would otherwise have to ask; a GM's own change goes nowhere.
    if (!announce || !this.inEncounter || !this.hasPlayerOwner) return;
    const gms = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    if (!gms.length) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      whisper: gms,
      content: `<div class="starwrought sw-stance-card">${game.i18n.format("STARWROUGHT.Stance.set", {
        name: this.name,
        defense: answer.label,
        threshold: answer.threshold
      })}${notes.length ? " " + notes.join(" ") : ""}</div>`
    });
  }
};
