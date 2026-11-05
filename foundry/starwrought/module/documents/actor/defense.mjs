/**
 * SwActor: answering a blow. The Defense roll with its Reaction or Posture, which Defense and answer
 * a defender stands ready with (the stance), the Threshold a given answer presents, and setting the
 * stance. The stance words and the Posture's +2 Situation live here with their one reader.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { postureName as postureNameOf } from "../../helpers/answers.mjs";

/** The five stances: the two basic Defenses, and the three Reactions a defender can stand ready with. */
const STANCES = Object.freeze(["evade", "guard", "void", "parry", "counter"]);
const REACTION_STANCES = Object.freeze(["void", "parry", "counter"]);
/** The two basic Defenses that answer a Blow (PHB v4.10, The Four Threats). */
const BLOW_DEFENSES = Object.freeze(["evade", "guard"]);

/**
 * A Posture ⓿↺ (0.5.0 brief, after PHB v4.10's Slip the Line and Catch the Blade): an owned
 * Talent with a ⓿↺ cost in the Defense's Constellation, +2 Situation to that Defense and a Zone
 * of the defender's choice Exposed until the end of the round, whether or not it works. The
 * bonus is the same Situation stack a Reaction's +2 lives in, so the two never add.
 */
const POSTURE_BONUS = 2;

/** @param {typeof Actor} Base */
export const DefenseMixin = Base => class extends Base {
  /**
   * Roll one of the four Defenses. When it answers an Attack, pass the attacker's Attack
   * Threshold; the degrees are then read from the attacker's side, so beating it by 10 is a Miss.
   *
   * PHB v4.10, Answering an Attack: the basic Defense always rolls, whatever you have left. A
   * Reaction does better and is paid from the same six actions: Parry ❶↺ is Guard at +2
   * Situation and needs a rigid implement; Void ❶↺ is Evade at +2 Situation; Counter ❶↺ adds
   * nothing to the Defense and answers with a Quick Strike of your own. The dialog offers the
   * Reactions this actor owns; the engine charges the action.
   * @param {string} key  A key of SW.DEFENSES.
   * @param {object} [options]
   * @param {number} [options.threshold]   The Attack Threshold being answered.
   * @param {string|null} [options.reaction]  parry | void | counter | null.
   * @param {string} [options.strike]      The attacker's commitment, if known (quick | deliberate | committed).
   * @param {Actor|Token} [options.attacker]  Who is attacking; defaults to the current target.
   * @param {{id: string, targetId: string}} [options.workflow]  The attack flow's Defense roll
   *                                       (0.5.0 brief): kind "defense" with no Threshold, since
   *                                       the coordinator holds the adversary's number and reads
   *                                       this die against it; the answer was committed in the
   *                                       prompt, so no Reaction is offered here; nothing posts.
   * @param {{talentId: string, name?: string, zone: string}} [options.posture]  A Posture ⓿↺
   *                                       committed in the prompt: +2 Situation to the Defense,
   *                                       its Zone Exposed before the die. Never beside a Reaction.
   */
  async rollDefense(key, options = {}) {
    const { reaction: askedReaction, attacker: givenAttacker, workflow = null, posture: askedPosture = null, ...rest } = options;
    const reaction = SW.REACTIONS[askedReaction] && ["parry", "void", "counter"].includes(askedReaction)
      ? askedReaction : null;
    // Void is an Evade and Parry is a Guard, whichever button was pressed.
    if (reaction && SW.REACTIONS[reaction].defense) key = SW.REACTIONS[reaction].defense;
    const def = SW.DEFENSES[key];
    if (!def) return null;

    // A Posture is an answer in its own right (brief): it never stands beside a Reaction, and the
    // Zone is the player's choice at the prompt, so one without a Zone is not a Posture yet.
    const posture = (askedPosture?.talentId && (askedPosture.zone in SW.ZONES)) ? askedPosture : null;
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");
    // Plain, so the ⓿↺ the modifier line and the card append is the only one shown (0.5.1, T16).
    const postureName = posture
      ? SW.plainName(postureNameOf(this, posture) ?? game.i18n.localize(SW.REACTIONS.posture.label))
      : "";

    const attackerToken = givenAttacker?.document ? givenAttacker
      : (givenAttacker?.getActiveTokens?.(false, false)?.[0] ?? SwCheck.currentTarget());
    const attacker = givenAttacker?.actor ?? (givenAttacker?.documentName === "Actor" ? givenAttacker : null)
      ?? attackerToken?.actor ?? null;

    // The Posture's +2 Situation goes into the same stack as the Defense's own modifiers and a
    // Reaction's +2 (the engine adds a Reaction's in roll()), so it cannot add to either.
    const { modifiers: givenModifiers, beforeRoll: callerBeforeRoll, ...passthrough } = rest;
    const modifiers = [...(givenModifiers ?? [])];
    if (posture) {
      modifiers.push({
        label: `${postureName} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`,
        value: POSTURE_BONUS,
        type: "situation"
      });
    }

    const config = {
      actor: this,
      kind: (workflow || (options.threshold !== undefined)) ? "defense" : "check",
      slug: def.slug,
      label: game.i18n.localize(def.label),
      subtitle: game.i18n.localize(def.hint),
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.attackThreshold"),
      defense: key,
      reaction,
      posture: posture ? { talentId: posture.talentId, name: postureName, zone: posture.zone } : null,
      attacker,
      targetUuid: attackerToken?.document?.uuid ?? "",
      targetName: attackerToken?.name ?? attacker?.name ?? "",
      defenderTokenUuid: this.tokenOnScene()?.uuid ?? "",
      modifiers,
      // A Posture Exposes its Zone whether or not it works (brief), so the Zone opens before the
      // die, marked as a Posture's so Recenter leaves it and the end of the round clears it.
      beforeRoll: async cfg => {
        if (posture) await this.setExposed(posture.zone, true, { posture: true });
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
   * The Defense that answers a physical Attack on this actor right now, with the Reaction behind
   * it: the stance, unless the rules make its Defense unavailable (Evade while Grabbed or
   * Restrained), in which case the other basic Defense and no Reaction. Read live, so a stance
   * changed a moment ago is what the attacker's roll meets.
   *
   * Void is Evade +2 Situation; Parry is Guard +2 Situation (a rigid implement is needed, and its
   * absence is noted, not enforced); Counter is the better of the two basic Defenses with no bonus
   * and a Quick Strike back, and answers only a melee Blow from within Reach. The Reaction's ❶ is
   * charged when the attack resolves.
   * @param {object} [threat]            What is being answered. Omitted, nothing is ruled out.
   * @param {boolean} [threat.ranged]    The Blow is ranged (a ranged weapon, or a throw).
   * @param {number|null} [threat.gap]   The gap to the attacker in feet, edge to edge; null if unknown.
   * @returns {{key: string, stance: string, reaction: string|null, bonus: number, label: string,
   *            threshold: number, unavailable: string|null, note: string|null}}
   */
  answeringDefense({ ranged = false, gap = null } = {}) {
    const sys = this.system;
    const stance = STANCES.includes(sys.stance) ? sys.stance : "evade";
    // The data model reads the stance apart into its Defense and its Reaction; fall back to the
    // same reading here when it has not.
    const stanceReaction = (sys.stanceReaction !== undefined)
      ? (REACTION_STANCES.includes(sys.stanceReaction) ? sys.stanceReaction : null)
      : (REACTION_STANCES.includes(stance) ? stance : null);
    const stanceDefense = BLOW_DEFENSES.includes(sys.stanceDefense) ? sys.stanceDefense
      : (BLOW_DEFENSES.includes(stance) ? stance : "evade");

    // One reading for a stance and for a committed answer, so the two can never disagree: the
    // Defense, the swap when it is unavailable, the Head Wound, a stale Reaction, Parry's rigid
    // implement, and the +2 folded once into the Situation stack all live in defenseThresholdFor.
    const read = this.defenseThresholdFor({ defense: stanceDefense, reaction: stanceReaction });
    let { key, reaction, label, note } = read;

    // Counter answers only a melee Blow from a foe within your Reach (PHB v4.10, Answering an
    // Attack). Anything else meets the basic Defense, nothing is charged, and the stance stands.
    // Counter adds nothing to the Threshold, so only the answer's name changes here.
    if (reaction === "counter") {
      const reach = sys.totalReach ?? sys.reach ?? 0;
      if (ranged || ((gap !== null) && (gap > reach))) {
        reaction = null;
        note = game.i18n.localize("STARWROUGHT.Reaction.counterNeedsMelee");
        label = game.i18n.localize(SW.DEFENSES[key].label);
      }
    }

    return {
      key,
      stance,
      reaction,
      bonus: read.bonus,
      label,
      threshold: read.threshold,
      unavailable: read.unavailable,
      note
    };
  }

  /**
   * The Threshold a Defense presents with an answer folded in (0.5.0 brief, Thresholds): the one
   * rules function behind both the standing stance (`answeringDefense`) and a commitment made in
   * the attack flow's prompt, so the sheet, the prompt's preview and the coordinator's
   * resolution all read the same number. Pure: nothing is written.
   *
   * PHB v4.10, Answering an Attack. Void is Evade +2 Situation and Parry is Guard +2 Situation,
   * whatever Defense was named; Counter adds nothing and stands on the better of the two basic
   * Defenses. A Posture ⓿↺ (brief) is +2 Situation to its own Defense. The bonus goes into the
   * same Situation stack as the Defense's own modifiers through SW.resolveModifiers, so it never
   * adds to another Situation bonus already there (highest of the type counts), and a commitment
   * is a Reaction or a Posture, never both. An adversary's Defenses carry no modifier stack, so
   * its bonus is added arithmetically to the GM's Threshold. When the Defense is unavailable
   * (Evade while Grabbed or Restrained) the other basic Defense answers and anything built on the
   * lost one falls away; a Head Wound removes every Reaction and Posture; a Reaction stance the
   * character no longer qualifies for falls back; a Parry without a rigid implement is noted,
   * not enforced.
   *
   * @param {object} answer
   * @param {string} answer.defense               A key of SW.DEFENSES (evade or guard for a Blow).
   * @param {string|null} [answer.reaction]       parry | void | counter | null.
   * @param {{talentId: string, name?: string, zone?: string}|null} [answer.posture]
   * @returns {{key: string, threshold: number, bonus: number, label: string, reaction: string|null,
   *            posture: object|null, note: string|null, unavailable: string|null}}
   * @throws {Error} when both a Reaction and a Posture are given.
   */
  defenseThresholdFor({ defense, reaction = null, posture = null } = {}) {
    const sys = this.system;
    reaction = (REACTION_STANCES.includes(reaction) && SW.REACTIONS[reaction]) ? reaction : null;
    posture = (posture && (typeof posture === "object") && posture.talentId) ? posture : null;
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");

    // Which Defense: the Reaction's own, Counter's better basic one, else the one named.
    let key = (reaction === "counter") ? this.#bestBasicDefense()
      : (SW.REACTIONS[reaction]?.defense ?? (SW.DEFENSES[defense] ? defense : "evade"));
    const named = key;

    const blocked = BLOW_DEFENSES.includes(key) ? (sys.defenses?.[key]?.unavailable ?? null) : null;
    if (blocked) {
      key = (key === "evade") ? "guard" : "evade";
      // A Void is an Evade, and a Posture is a Talent of its Defense's Constellation: when the
      // Defense cannot be used, neither can what was built on it.
      if (reaction === "void") reaction = null;
      posture = null;
    }

    let note = null;
    // No Reactions at all: a Head Wound, a Head critical, a Rush. The basic Defense still rolls.
    const noReactions = sys.reactions?.blocked;
    if ((reaction || posture) && noReactions) {
      reaction = null;
      posture = null;
      note = (typeof noReactions === "string")
        ? game.i18n.localize(noReactions)
        : game.i18n.format("STARWROUGHT.Reaction.blocked", { name: this.name });
    }
    // A Reaction the character no longer qualifies for falls back to the basic Defense: a
    // Counter held from before ruling 63 at a Melee rank below Expert, or a Training Root since
    // removed. setStance only guards the way in; the roll has to read what is true now. Parry's
    // rigid implement is noted below rather than enforced, so for Parry only the Root is tested.
    if (reaction && (this.type === "character") && (sys.reactions?.[reaction] === false)) {
      const stale = (reaction !== "parry") || !sys.constellations?.[SW.REACTIONS.parry.talent]?.rootOwned;
      if (stale) {
        const needs = { void: "STARWROUGHT.Stance.needsVoid", parry: "STARWROUGHT.Stance.needsParry", counter: "STARWROUGHT.Stance.needsCounter" };
        note = game.i18n.localize(needs[reaction]);
        reaction = null;
      }
    }
    if ((reaction === "parry") && !this.rigidImplement) {
      note = game.i18n.localize("STARWROUGHT.Reaction.needsRigid");
    }

    // The answer's name: a Reaction's label, or the Posture Talent's own name.
    const postureName = posture
      ? (postureNameOf(this, posture) ?? game.i18n.localize(SW.REACTIONS.posture.label))
      : "";
    const answerLabel = reaction ? game.i18n.localize(SW.REACTIONS[reaction].label) : postureName;

    // The fold. The data model leaves a Reaction's bonus out of its own Threshold on purpose; it
    // is added here, once, through the same stack the Defense already resolved.
    const def = sys.defenses?.[key];
    let threshold = def?.threshold ?? 10;
    const bonus = reaction ? (SW.REACTIONS[reaction].bonus ?? 0) : (posture ? POSTURE_BONUS : 0);
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
      posture: posture ? { talentId: posture.talentId, name: postureName, zone: posture.zone ?? null } : null,
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

  /** Of Evade and Guard, the one with the higher Threshold that the rules allow right now. */
  #bestBasicDefense() {
    const defs = this.system.defenses ?? {};
    const open = ["evade", "guard"].filter(k => !defs[k]?.unavailable);
    const pool = open.length ? open : ["evade", "guard"];
    return pool.sort((a, b) => (defs[b]?.threshold ?? 10) - (defs[a]?.threshold ?? 10))[0];
  }

  /**
   * Choose how the next physical Attack is answered: Evade or Guard as the basic Defense, or
   * stand ready with a Reaction (Void, Parry, Counter) that the attack pays for when it lands.
   * The defender's call, so it lives here, and the attacker's roll reads it. A Reaction stance is
   * only a character's to take when the Talent grants it; an adversary's profile is the GM's.
   * @param {"evade"|"guard"|"void"|"parry"|"counter"} key
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   */
  async setStance(key, { announce = true } = {}) {
    if (!STANCES.includes(key)) return;
    if (REACTION_STANCES.includes(key) && (this.type === "character") && !this.system.reactions?.[key]) {
      // The gate the Reaction needs: its constellation at REACTIONS[key].rank when one is set
      // (Counter at Melee Expert, ruling 63), otherwise the Root alone, which reads as Trained.
      const { talent, rank } = SW.REACTIONS[key];
      const rankLabel = SW.RANKS[rank ?? "trained"]?.label ?? "STARWROUGHT.Rank.trained";
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Stance.reactionUnavailable", {
        stance: game.i18n.localize(SW.REACTIONS[key].label),
        talent: talent ? `${SW.getConstellation(talent).name} ${game.i18n.localize(rankLabel)}` : ""
      }));
      return;
    }
    if (this.system.stance === key) return;
    await this.update({ "system.stance": key });
    const answer = this.answeringDefense();
    // A Defense the rules say you cannot use right now is still yours to choose; the system says
    // so and leaves the ruling to the table. So is a Parry with nothing rigid in hand.
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
