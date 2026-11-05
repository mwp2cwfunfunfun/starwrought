/**
 * SwActor: the attack. A Strike at a target declared into the attack flow (0.5.0; the flow is
 * not optional since 0.12.0, ruling 160), a Strike with no target rolled against a typed
 * Threshold, a Maneuver's attack, the declared targets, Support (an ally in reach), the Grab
 * announcement, the rank a weapon is wielded at, and damage for a Result.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { SwDamage } from "../../dice/damage.mjs";
import { gapBetween } from "../../canvas/geometry.mjs";
import { AttackCoordinator } from "../../combat/attack-coordinator.mjs";

/** @param {typeof Actor} Base */
export const AttackMixin = Base => class extends Base {
  /**
   * Strike with a weapon (PHB v4.10, Strikes). The attack is Melee Proficiency for a weapon in
   * hand or Ranged for one that leaves it (a thrown dagger included), adjusted for Handling,
   * plus the Strike Attribute, against the Defense the defender answers with.
   *
   * The count of actions is the commitment: Quick ❶ (one die, cannot crit unless Agile, Torso),
   * Deliberate ❷ (full damage, may land on an Exposed Zone), Committed ❸ (Prepared: one action
   * now, two reserved, resolves at the next Opportunity). There is no Multiple Attack Penalty.
   * @param {string} weaponId
   * @param {object} [options]
   * @param {string} [options.strike]      quick | deliberate | committed. Default SW.DEFAULT_STRIKE.
   * @param {boolean} [options.prepared]   Finishing a Prepared Committed Strike: already paid.
   * @param {boolean} [options.free]       A Quick Strike granted by a Reaction (riposte, Counter,
   *                                       Intercept): the Reaction paid for it.
   * @param {boolean} [options.thrown]     Throw it (Ranged Proficiency). Inferred from distance
   *                                       for a Thrown weapon when not given.
   * @param {string} [options.targetUuid]  A Token or Actor uuid to strike, instead of the user's target.
   * @param {string} [options.targetTokenId]  A canvas Token id to strike (the Intercept card passes one).
   * @param {string} [options.reaction]    The Reaction this Strike is: "intercept" pays Intercept's
   *                                       ❶↺ instead of the Strike's cost; "riposte" was paid by
   *                                       the Parry that granted it. Both are Quick Strikes, and
   *                                       both declare like any Blow, answered by a basic Defense
   *                                       alone (0.12.0, ruling 161).
   * @param {boolean} [options.blind]      The attack flow's roll (0.5.0 brief): everything is
   *                                       assembled as usual (Handling, Support, Unwieldy, the
   *                                       range note, the spend) but the defender is not read at
   *                                       all, no Threshold is known, the Strike is locked, and
   *                                       nothing posts; the result comes back for the coordinator
   *                                       to resolve against each defender.
   *
   * With at least one target with an actor, a Strike that is not about to Prepare does not roll:
   * it is DECLARED through the AttackCoordinator, and the die is thrown at the roll step once
   * every defender has committed (brief, Entry points). No Defense is ever chosen by the system
   * (0.12.0, ruling 159), and the flow is not optional (ruling 160). With no target there is no
   * defender: the Strike rolls at once against the Threshold typed in the dialog.
   */
  async rollAttack(weaponId, options = {}) {
    const weapon = this.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;
    const {
      strike: askedStrike, prepared = false, free: askedFree = false, thrown: askedThrown,
      targetUuid: askedTarget, targetTokenId, reaction: asReaction = null,
      modifiers: givenModifiers, blind = false, ...rest
    } = options;

    // Striking with something you are not holding is worth saying out loud, and nothing more.
    if (!weapon.system.held) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notHeld", { name: weapon.name }));
    }

    // A Strike made as a Reaction (Intercept, the Riposte after a Parry) is always a Quick Strike
    // (PHB v4.21). Only Intercept pays; the Riposte's Parry was paid when the attack it answered
    // resolved, and the Riposte itself costs nothing more. (Counter, 0.4.2 to 0.10.1, is gone from
    // the book.)
    const reactionStrike = ["intercept", "riposte"].includes(asReaction) ? asReaction : null;
    const strike = reactionStrike ? "quick" : (SW.STRIKE_KINDS[askedStrike] ? askedStrike : SW.DEFAULT_STRIKE);
    const free = askedFree || (reactionStrike === "riposte");
    // The flow's blind roll is the second step of a Strike that paid when it declared (0.5.3).
    const paid = !!(prepared || free || blind);

    // Your named target first, then your Foundry target, then the one target this token is
    // remembered as having, so a reload does not cost you the Threshold along with the arrow.
    let targetToken = targetTokenId ? (canvas.tokens?.get(targetTokenId) ?? null) : null;
    if (!targetToken && askedTarget) targetToken = this.#tokenFor(askedTarget);
    if (!targetToken) targetToken = SwCheck.currentTarget();
    if (!targetToken) {
      const remembered = this.tokenOnScene()?.getFlag(SW.SYSTEM_ID, "targets")?.ids ?? [];
      const only = (remembered.length === 1) ? canvas.tokens?.get(remembered[0]) : null;
      if (only?.actor) targetToken = only;
    }

    // Declaring (brief, Entry points): every Strike at a target declares, a Reaction Strike (an
    // Intercept, the Riposte) included since 0.12.0 (ruling 161: the defender names a basic
    // Defense in the prompt rather than having one read for them); only the flow's own blind roll
    // does not. The targets are snapshotted now: every token the user has targeted, or the one the
    // caller named. With several, the first stands in as the reference for reach and the thrown
    // inference below.
    const declaring = !blind;
    const targets = declaring ? this.#declaredTargets({ targetTokenId, targetUuid: askedTarget }) : [];
    if (declaring && targets.length && !targetToken) targetToken = targets[0];

    const targetActor = targetToken?.actor ?? null;
    const attackerToken = this.tokenOnScene();
    const gap = (attackerToken && targetToken && canvas?.ready) ? gapBetween(attackerToken, targetToken.document) : null;

    // Melee for a weapon in hand, Ranged for one that leaves it. A Thrown weapon leaves the hand
    // when its target is beyond your Total Reach with it, unless the caller says otherwise.
    const reachWith = (this.system.reach ?? 0) + (weapon.system.reach ?? 0);
    const thrown = askedThrown ?? (!!weapon.system.flags?.thrown && !weapon.system.isRanged
      && (gap !== null) && (gap > reachWith));
    const ranged = !!weapon.system.isRanged || thrown;
    const slug = thrown ? SW.RANGED_SLUG : (weapon.system.strikeSlug ?? (ranged ? SW.RANGED_SLUG : SW.MELEE_SLUG));
    const rank = this.weaponRank(weapon, slug);

    // DECLARE rather than roll. A Committed Strike ❸ in an encounter still Prepares as today
    // (PHB v4.10: one action now, the rest reserved) and declares when finishPrepared re-enters
    // here with `prepared: true`; the dialog it opens may still change the Strike, and beforeRoll
    // below declares the changed one. Everything else declares now, with no dialog: the Strike
    // kind is the button pressed, and the dialog opens at the roll step with it locked.
    const preparesNow = SW.STRIKE_KINDS[strike].prepared && this.inEncounter && !paid;
    // The declaration is the Maneuver (0.5.3; Mike: "I used a deliberate strike, but I don't think
    // it reduced my actions by 2"): a character's Strike pays when it declares, as an adversary's
    // does, and the flow's roll step pays nothing (`blind` counts as paid below). A Prepared
    // Strike paid when it was Prepared, a Reaction's Strike was paid by the Reaction, and a Blow
    // the GM cancels before any die returns the cost (AttackCoordinator).
    const declareStrike = async kindKey => {
      const pub = await AttackCoordinator.declare({
        attacker: this, weaponId, strike: kindKey, targets, prepared, free, thrown, reaction: reactionStrike
      });
      if (!pub || paid) return pub;
      if (reactionStrike === "intercept") {
        // Intercept ❶↺: the Reaction's own cost, in place of the Strike's, paid as the Blow is
        // declared and returned by the coordinator if the Blow is cancelled before the die.
        const r = SW.REACTIONS.intercept;
        await this.spendActions(r.cost, {
          label: `${game.i18n.localize(r.label)} ${SW.ACTION_GLYPHS[r.cost]}${SW.REACTION_GLYPH}: ${weapon.name}`
        });
      } else {
        const k = SW.STRIKE_KINDS[kindKey] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
        await this.spendActions(k.cost, {
          label: `${game.i18n.localize(k.label)} ${SW.ACTION_GLYPHS[k.cost]}: ${weapon.name}`
        });
      }
      return pub;
    };
    if (declaring && targets.length && !preparesNow) return declareStrike(strike);

    // A Strike at a target the weapon cannot reach is said on the card, never refused, so the GM
    // can adjudicate (Mike, 2026-10-01). Melee: the gap is more than Natural Reach plus the
    // weapon's. Ranged or thrown: the gap is more than the weapon's range. No target, no note.
    let rangeNote = null;
    if (gap !== null) {
      const feet = Math.round(gap);
      if (!ranged && (gap > reachWith)) {
        rangeNote = game.i18n.format("STARWROUGHT.Strike.outOfReach", { gap: feet, reach: reachWith });
      } else if (ranged) {
        const range = thrown ? weapon.system.flags?.thrown : weapon.system.flags?.ranged;
        if (Number.isFinite(range) && (range > 0) && (gap > range)) {
          rangeNote = game.i18n.format("STARWROUGHT.Strike.outOfRange", { gap: feet, range });
        }
      }
    }

    // The Strike Attribute (PHB v4.21, The Attack): the weapon's own, Might for a throw (ruling
    // 129); a Maneuver's Key Attribute may stand in when higher, which the dialog offers from the
    // owned Talents and Maneuvers that have one and the roll applies when the player picks one.
    const strikeAttribute = this.system.strikeAttributeFor?.(weapon, { thrown })
      ?? { attribute: thrown ? "might" : weapon.system.attackAttribute, source: "weapon" };
    const maneuverChoices = blind ? [] : (this.system.maneuverChoicesFor?.(weapon, { thrown }) ?? []);

    // No Defense is read here (0.12.0, ruling 159). The defender's answer is theirs: committed in
    // the Combat Prompt, revealed by the coordinator and read there against this die on the flow's
    // blind roll, which the dialog says in so many words. With no target there is no defender, and
    // the dialog's typed Threshold stands.
    const targetDefense = targetActor
      ? { key: null, label: "", threshold: null, unavailable: null, hidden: true }
      : null;

    const modifiers = [...(givenModifiers ?? [])];

    // Unwieldy N: a −2 Situation penalty against a target within N feet, measured edge to edge
    // like everything else on the grid, and no attack at all while Grabbed. The penalty is applied;
    // the Grabbed clause is announced, since nothing in this system prevents a roll.
    const unwieldy = weapon.system.flags?.unwieldy ?? 0;
    if (unwieldy) {
      if ((gap !== null) && (gap <= unwieldy)) {
        modifiers.push({
          label: game.i18n.format("STARWROUGHT.Roll.unwieldy", { n: unwieldy }),
          value: SW.UNWIELDY_PENALTY,
          type: "situation"
        });
      }
      if (this.statuses?.has("grabbed")) await this.#announceGrabbed(weapon);
    }

    // Support (PHB v4.10, Allies in the Exchange): +1 Situation to a melee attack per other
    // conscious ally whose Total Reach includes the target, to a maximum of +2. Same type as
    // Control's penalty, so the two are resolved against each other rather than added.
    if (!ranged && targetToken && attackerToken) {
      const support = this.supportFor(targetToken, attackerToken);
      if (support.count) {
        modifiers.push({
          label: game.i18n.format("STARWROUGHT.Roll.support", { n: support.count, names: support.names.join(", ") }),
          value: support.count,
          type: "situation"
        });
      }
    }

    // Your partner's attacks with the Controlled weapon take a −2 Situation penalty (The Bind).
    const bind = this.system.bind;
    const controlledWeapon = (bind?.state === "controlled") && SW.sameName(bind.mine, weapon.name);
    if (controlledWeapon) {
      modifiers.push({
        label: game.i18n.format("STARWROUGHT.Roll.controlledWeapon", { weapon: weapon.name }),
        value: SW.CONTROLLED_PENALTY,
        type: "situation"
      });
    }

    const kindLabel = key => `${game.i18n.localize(SW.STRIKE_KINDS[key].label)} ${SW.ACTION_GLYPHS[SW.STRIKE_KINDS[key].cost]}`;
    const reactionLabel = reactionStrike
      ? ` · ${game.i18n.localize(SW.REACTIONS[reactionStrike]?.label ?? "STARWROUGHT.Reaction.label")}`
      : "";
    const subtitleFor = key => `${kindLabel(key)}${reactionLabel} · ${
      game.i18n.localize(ranged ? "STARWROUGHT.Roll.rangedStrike" : "STARWROUGHT.Roll.meleeStrike")}`;

    const config = foundry.utils.mergeObject({
      actor: this,
      item: weapon,
      weaponId,
      kind: "attack",
      slug,
      rankOverride: rank,
      attribute: strikeAttribute.attribute,
      attributeSource: strikeAttribute.source,
      maneuverChoices,
      label: weapon.name,
      subtitle: subtitleFor(strike),
      strike,
      // The declared Strike is locked at the roll step, as a paid one always was.
      lockStrike: paid || !!reactionStrike || blind,
      prepared,
      asReaction: reactionStrike,
      modifiers,
      // No Threshold is known here: the coordinator reads the committed Defense's (ruling 159),
      // or the dialog takes one typed for a Strike with no defender.
      threshold: null,
      thresholdLabel: "",
      targetUuid: blind ? "" : (targetToken?.document?.uuid ?? ""),
      targetDefense,
      defenseForced: true,
      defenseNote: null,
      rangeNote,
      reaction: null,
      reactionNote: null,
      defender: blind ? null : targetActor,
      defenderRigid: blind ? null : (targetActor?.rigidImplement ?? null),
      attackerTokenUuid: attackerToken?.uuid ?? "",
      // The token's name, not the actor's: the token name is the one the GM chose to show.
      targetName: targetToken?.name ?? "",

      // Once the dialog has settled which Strike this is: pay for it, or turn a Committed Strike
      // into a Prepared Maneuver that resolves at the next Opportunity and never reaches the die
      // now. A Strike already paid for (a finished preparation, a riposte) spends nothing.
      beforeRoll: async cfg => {
        const kind = SW.STRIKE_KINDS[cfg.strike];
        cfg.subtitle = subtitleFor(cfg.strike);
        // The dialog opened for a Committed Strike, which Prepares, and the player chose a Quick
        // or Deliberate one instead: with the flow on and a target, that Strike declares.
        if (declaring && targets.length && !paid && !(kind.prepared && this.inEncounter)) {
          await declareStrike(cfg.strike);
          return false;
        }
        if ((reactionStrike === "intercept") && !blind) {
          // Intercept ❶↺ with no target to declare at: the Reaction's own cost, in place of the
          // Strike's. (The flow's blind roll paid at the declaration.)
          const r = SW.REACTIONS.intercept;
          await this.spendActions(r.cost, {
            label: `${game.i18n.localize(r.label)} ${SW.ACTION_GLYPHS[r.cost]}${SW.REACTION_GLYPH}: ${weapon.name}`
          });
        } else if (!paid) {
          if (kind.prepared && this.inEncounter) {
            await this.prepare({
              kind: "strike",
              label: `${weapon.name}: ${kindLabel(cfg.strike)}`,
              cost: kind.cost,
              weaponId,
              targetTokenId: targetToken?.id ?? "",
              targetUuid: targetToken?.document?.uuid ?? "",
              strike: cfg.strike
            });
            return false;
          }
          await this.spendActions(kind.cost, { label: `${kindLabel(cfg.strike)}: ${weapon.name}` });
        }
        // "Attacking with an uncontrolled weapon or limb ends the Bind before the roll."
        if (bind?.state && bind.mine && !SW.sameName(bind.mine, weapon.name)) await this.endBind();
        return true;
      },

      // The blow has resolved: a Bind between the two ends, and a Controller struck by a third
      // party loses the line. (A committed Reaction's ❶ is charged by the coordinator's
      // resolution, never here.) Writes land only where this client owns the actor; the card
      // offers the rest to whoever does.
      afterRoll: async () => {
        if (!targetActor) return;
        const mine = this.system.bind;
        if (mine?.state && (mine.partnerUuid === targetActor.uuid)) await this.endBind();
        const theirs = targetActor.system.bind;
        if ((theirs?.state === "controlling") && (theirs.partnerUuid !== this.uuid) && targetActor.isOwner) {
          await targetActor.endBind();
        }
      }
    }, rest, { inplace: false });
    // The blind roll never posts, whatever a caller's passthrough says: the coordinator's
    // resolution cards are the record.
    if (blind) config.postCard = false;
    return SwCheck.roll(config);
  }

  /**
   * An adversary's Maneuver (0.5.0 brief, Entry points): declare one of its attack rows, Quick ❶,
   * Deliberate ❷ or Committed ❸, against the GM's current targets. Adversaries do not roll in
   * STARWROUGHT, so there is no roll-at-once form of this and the `attackFlow` setting does not
   * apply: player-controlled targets get the defend prompt and then roll Defense against the
   * attack's Threshold; an adversary target falls to the adversary-against-adversary rule. The
   * Strike's actions are paid once the declaration stands, since the declaration is the Maneuver.
   * @param {string} itemId   An action Item on this actor with `system.attack.enabled`.
   * @param {object} [options]
   * @param {string} [options.strike]  quick | deliberate | committed. Default SW.DEFAULT_STRIKE.
   * @returns {Promise<object|null>} the workflow, or null when nothing was declared
   */
  async attackWith(itemId, { strike = SW.DEFAULT_STRIKE } = {}) {
    const item = this.items.get(itemId);
    if (!item || (item.type !== "action") || !item.system.attack?.enabled) return null;
    if (!SW.STRIKE_KINDS[strike]) strike = SW.DEFAULT_STRIKE;
    // Every target must be an actor: a bare token has no Defense to answer with.
    const targets = Array.from(game.user?.targets ?? []).filter(t => t?.actor);
    if (!targets.length) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noTarget"));
      return null;
    }
    const workflow = await AttackCoordinator.declare({ attacker: this, attackId: itemId, strike, targets });
    if (!workflow) return null;
    // A Committed ❸ by an adversary is paid in full here: the Prepared machinery is a weapon's
    // (finishPrepared re-enters rollAttack), and nothing of an adversary's reaches a die.
    const kind = SW.STRIKE_KINDS[strike];
    await this.spendActions(kind.cost, {
      label: `${game.i18n.localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost]}: ${item.name}`
    });
    return workflow;
  }

  /**
   * The targets a declaration snapshots (brief): the token the caller named, else every token this
   * user has targeted that has an actor behind it, else the one target this actor's token is
   * remembered as having. Changing Foundry targets afterwards changes nothing.
   * @param {object} [options]
   * @param {string} [options.targetTokenId]
   * @param {string} [options.targetUuid]
   * @returns {Token[]}
   */
  #declaredTargets({ targetTokenId = "", targetUuid = "" } = {}) {
    const named = targetTokenId ? (canvas.tokens?.get(targetTokenId) ?? null) : null;
    if (named?.actor) return [named];
    const asked = targetUuid ? this.#tokenFor(targetUuid) : null;
    if (asked?.actor) return [asked];
    const targeted = Array.from(game.user?.targets ?? []).filter(t => t?.actor);
    if (targeted.length) return targeted;
    const remembered = this.tokenOnScene()?.getFlag(SW.SYSTEM_ID, "targets")?.ids ?? [];
    const only = (remembered.length === 1) ? canvas.tokens?.get(remembered[0]) : null;
    return only?.actor ? [only] : [];
  }

  /**
   * A Token on the canvas for a uuid that names a Token or an Actor.
   * @param {string} uuid
   * @returns {Token|null}
   */
  #tokenFor(uuid) {
    const doc = fromUuidSync(uuid);
    if (!doc) return null;
    if (doc.documentName === "Token") return doc.object ?? null;
    if (doc.documentName === "Actor") return doc.getActiveTokens(false, false)[0] ?? null;
    return null;
  }

  /**
   * Support for a melee attack on a target: the other conscious allies whose Total Reach includes
   * it, capped at SW.SUPPORT_MAX. Allies are tokens of the same disposition; a Dying, unconscious
   * or dead body grants nothing, and neither does anyone who could not actually reach.
   * @param {Token} targetToken
   * @param {TokenDocument} [attackerToken]
   * @returns {{count: number, names: string[]}}
   */
  supportFor(targetToken, attackerToken = this.tokenOnScene()) {
    const names = [];
    if (!canvas?.ready || !targetToken || !attackerToken) return { count: 0, names };
    for (const token of canvas.tokens.placeables) {
      const actor = token.actor;
      if (!actor || (token.document.id === attackerToken.id) || (token.document.id === targetToken.document.id)) continue;
      // A party is never a combatant (0.7.0, party-sheet-plan.md risk 1): a friendly party token
      // standing in reach is nobody's ally and hands out no Support.
      if (actor.type === SW.PARTY_TYPE) continue;
      if (token.document.disposition !== attackerToken.disposition) continue;
      if (token.document.hidden) continue;
      const statuses = actor.statuses ?? new Set();
      if ((actor.system.dying ?? 0) > 0) continue;
      if (actor.system.conscious === false) continue;
      if (["unconscious", "dying", "dead"].some(s => statuses.has(s))) continue;
      const reach = actor.system.totalReach ?? actor.system.reach ?? 0;
      if (gapBetween(token.document, targetToken.document) > reach) continue;
      names.push(token.name);
      if (names.length >= SW.SUPPORT_MAX) break;
    }
    return { count: names.length, names };
  }

  /**
   * "You cannot attack with it at all while you are Grabbed." Said to the table the way an
   * overspent action is, and never enforced: the roll posts, and the table decides.
   */
  async #announceGrabbed(weapon) {
    const body = game.i18n.format("STARWROUGHT.Roll.unwieldyGrabbed", { name: this.name, weapon: weapon.name });
    ui.notifications.warn(body);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-overspend">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
          game.i18n.localize("STARWROUGHT.Roll.unwieldyGrabbedTitle")}</h3>
        <p>${body}</p></div>`,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /**
   * The Proficiency Rank that actually applies to a weapon, after Handling and Familiarity, in
   * Melee or Ranged. Intuitive costs nothing; Practiced drops a rank; Technical drops you to
   * Untrained.
   * @param {Item} weapon
   * @param {string} [slug]  SW.MELEE_SLUG or SW.RANGED_SLUG; read off the weapon when omitted.
   * @returns {string}
   */
  weaponRank(weapon, slug = null) {
    slug ??= weapon.system.isRanged ? SW.RANGED_SLUG : SW.MELEE_SLUG;
    const base = this.system.proficiency?.(slug)?.rank ?? "untrained";
    const handling = weapon.system.handling ?? "intuitive";
    // `familiar` is the derived set: what your Talents recorded, plus the sheet's own list.
    const familiar = this.system.familiar?.has(weapon.system.group)
      || this.system.familiar?.has(weapon.name);
    if (familiar || handling === "intuitive") return base;
    if (handling === "practiced") return SW.stepRank(base, -1);
    return "untrained";
  }

  /**
   * Roll damage for a Result of a Strike.
   * @param {string} weaponId
   * @param {"hit"|"graze"|"critical"} outcome
   * @param {object} [options]  `strike`, `targetUuid`, `bonus`, `precision`.
   */
  async rollDamage(weaponId, outcome, options = {}) {
    const weapon = this.items.get(weaponId);
    if (!weapon) return null;
    return SwDamage.roll({ actor: this, weapon, outcome, ...options });
  }
};
