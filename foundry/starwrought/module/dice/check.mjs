/**
 * The check engine.
 *
 * One formula for everything (PHB v4.10): d20 + Attribute Bonus + Proficiency Bonus + bonuses and
 * penalties, measured against a Threshold of 10 + the same modifier. Level never touches the die;
 * it opens ranks and pays out Talent Points. Attacks and Defenses are the same roll read from
 * opposite sides, which is why they share this code and differ only in which way the degrees run.
 *
 * The bonuses and penalties come from three places: what the sheet can see for itself (Frightened,
 * Load Strain on Stealth, the adjustment fields), what the caller worked out (Support, Unwieldy, a
 * Talent's bonus passed in `modifiers`), and, since 0.10.0, what the Automation rules on the
 * character's Items grant (the `modifiers` hook point in ../rules/engine.mjs, asked once per roll
 * in check/modifiers.mjs; ruling 124). A rule the engine can name but not decide (a bonus to a Maneuver
 * on a check made without that Maneuver's Item) is offered unticked in the dialog, as Load Strain
 * on a Climb or a Swim is (ruling 122).
 */

import * as SW from "../config.mjs";
import { gapBetween } from "../canvas/geometry.mjs";
import { postureName as postureNameOf } from "../helpers/answers.mjs";
// The engine's parts, one module each (0.10.1): the modifiers a roll starts from, the dialog, the
// card and Settle Position. This file is the entry point and the order of a roll; it keeps
// roll, resolveAgainst and the public statics so every caller still says `SwCheck.x`.
import { assemble } from "./check/modifiers.mjs";
import { prompt } from "./check/dialog.mjs";
import { toMessage } from "./check/card.mjs";
import { strikeCanCrit } from "./check/strike.mjs";



/**
 * @typedef {object} SwCheckConfig
 * @property {Actor} actor                    Who is rolling.
 * @property {Item} [item]                    The Talent, weapon, or action behind the roll.
 * @property {string} kind                    "check", "attack", "defense", "initiative".
 * @property {string} [slug]                  Constellation slug supplying the Proficiency Bonus.
 * @property {string} [attribute]             Override the Constellation's Key Attribute.
 * @property {string} label                   What the card is called.
 * @property {number|null} [threshold]        The number to beat, if it is known.
 * @property {string} [thresholdLabel]        Where the Threshold came from.
 * @property {Array} [modifiers]              Extra typed modifiers.
 * @property {Array} [ruleOffers]             Written by the engine, not the caller (0.10.0): the
 *                                            Automation rules' modifiers offered unticked in the
 *                                            dialog, `{ key, label, value, type, hint }` each.
 * @property {string} [strike]                quick | deliberate | committed. An attack's commitment,
 *                                            or the commitment behind the blow a Defense answers.
 * @property {string|null} [reaction]         A key of SW.REACTIONS of kind "reaction", or null. On
 *                                            a Defense roll, the roller's Reaction; on a resolved
 *                                            attack, the defender's committed one.
 * @property {boolean} [lockStrike]           The dialog shows the Strike kind but cannot change it.
 * @property {Function} [beforeRoll]          async (cfg) => boolean|void. Runs once the dialog has
 *                                            settled and before the die is thrown; `false` aborts.
 * @property {Function} [afterRoll]           async (result) => void. Runs before the card posts.
 * @property {boolean} [dialog]               Show the roll dialog first.
 * @property {string} [rollMode]
 * @property {boolean} [postCard]             Post the card (default true). False evaluates the die
 *                                            and returns the result without a message: the attack
 *                                            flow's roller rolls once, blind, and the coordinator
 *                                            resolves it against each defender with
 *                                            {@link SwCheck.resolveAgainst} (0.5.0 brief).
 * @property {Actor} [speakerActor]           Whose name the card speaks under, when not the roller's.
 * @property {{talentId: string, name?: string, zone?: string}|null} [posture]  A Posture ⓿↺ behind
 *                                            the Defense (brief): +2 Situation folded into the
 *                                            Threshold or the roll, and a Zone Exposed. Shown on
 *                                            the card where a Reaction would be.
 */

/**
 * v3.4 counted attacks per turn for the Multiple Attack Penalty. PHB v4.10 has no MAP: tempo is
 * paid in actions, six a round. The export stays so `starwrought.mjs` keeps importing something;
 * it does nothing and can be dropped with its call sites.
 */
export function resetAttackCount() {}

export class SwCheck {
  /**
   * Roll a check and post the card.
   * @param {SwCheckConfig} config
   * @returns {Promise<object|null>} The resolved check, or null if the dialog was dismissed.
   */
  static async roll(config) {
    const cfg = foundry.utils.mergeObject({
      kind: "check",
      modifiers: [],
      dialog: true,
      threshold: null,
      thresholdLabel: "",
      strike: null,
      reaction: null,
      lockStrike: false,
      postCard: true,
      rollMode: game.settings.get("core", "rollMode")
    }, config, { inplace: false });

    const actor = cfg.actor;
    if (!actor) throw new Error("STARWROUGHT | A check needs an Actor.");
    // A party is never a combatant and rolls nothing (0.7.0, party-sheet-plan.md risk 1): a check
    // from the Party Sheet is made as the member, through the member's own methods.
    if (actor.type === SW.PARTY_TYPE) throw new Error("STARWROUGHT | A party rolls nothing; roll as the member.");

    // An attack is one of the three Strikes; a Defense roll answers one. When nobody says which,
    // the blow is read as Deliberate: full damage, and the middle of the table. A spell's Cast
    // (PHB v4.21; `source: "spell"`) is no Strike and keeps `strike` null: the card prints its
    // Cast instead, and the Position and Bind offers stay away from it.
    if (["attack", "defense"].includes(cfg.kind) && (cfg.source !== "spell") && !SW.STRIKE_KINDS[cfg.strike]) cfg.strike = SW.DEFAULT_STRIKE;
    if (cfg.reaction && !SW.REACTIONS[cfg.reaction]) cfg.reaction = null;

    // Assemble the standard modifiers from the character sheet and the Automation rules on the
    // character's Items (0.10.0), then whatever the caller worked out that neither can see:
    // Unwieldy against a close target, Support, a Talent's bonus passed by hand.
    let parts = assemble(actor, cfg);

    // Ask the player what they want to add, and against what.
    let dialogExtra = [];
    if (cfg.dialog) {
      const answer = await prompt(cfg, parts);
      if (!answer) return null;
      Object.assign(cfg, answer.config);
      // A Reaction chosen in the dialog can change which Defense is rolled, so the base terms are
      // rebuilt around the new slug before the extras go on.
      if (answer.rebuild) parts = assemble(actor, cfg);
      dialogExtra = Array.isArray(answer.extra) ? answer.extra : [];
      parts.push(...dialogExtra);
    }
    // Everything the roll carried beyond the base terms the sheet assembles: the caller's typed
    // modifiers and the dialog's extras. The Party Sheet's remembered road roll keeps these (0.7.3,
    // ruling 109), so a kept roll can be re-assembled as an Initiative with one typed-stacking pass.
    const extras = [...(cfg.modifiers ?? []), ...dialogExtra]
      .filter(m => Number.isNumeric(m?.value))
      .map(m => ({ label: String(m.label ?? ""), value: Number(m.value), type: m.type ?? null }));

    // PHB v4.21, Answering an Attack: a Reaction is paid "before any roll from the same six you
    // attack with", and its Situation bonus goes onto the Defense it stands on (SW.REACTIONS).
    if ((cfg.kind === "defense") && cfg.reaction) {
      const reaction = SW.REACTIONS[cfg.reaction];
      if (reaction.bonus) {
        parts.push({ label: game.i18n.localize(reaction.label), value: reaction.bonus, type: "situation" });
      }
      // Parry needs a rigid implement. Said, not enforced: the table may know about a Talent.
      if (reaction.rigid && !actor.rigidImplement) {
        cfg.reactionNote = game.i18n.localize("STARWROUGHT.Reaction.needsRigid");
        ui.notifications.warn(cfg.reactionNote);
      }
      await this.chargeReaction(actor, cfg.reaction);
      cfg.reactionCharged = true;
    }

    // The caller's last word once the dialog has settled: an attack spends its Strike here, or
    // turns into a Prepared Maneuver and never reaches the die.
    if (cfg.beforeRoll) {
      const go = await cfg.beforeRoll(cfg);
      if (go === false) return null;
    }

    // No Defense is read here (0.12.0, ruling 159): an attack at a defender goes through the
    // attack flow, where the defender commits the Defense and the coordinator resolves against
    // it; an attack with no defender rolls against the Threshold the dialog was given.

    const { total: modTotal, applied } = SW.resolveModifiers(parts);
    const formula = ["1d20", ...applied.map(m => (m.value < 0 ? `- ${Math.abs(m.value)}` : `+ ${m.value}`))].join(" ");

    const roll = await new Roll(formula).evaluate();
    const natural = roll.dice[0]?.results?.[0]?.result ?? null;

    let degree = null;
    let outcome = null;
    let critDenied = false;
    if (Number.isNumeric(cfg.threshold)) {
      degree = SW.degreeOf(roll.total, cfg.threshold, natural);
      // A Defense roll is the same comparison read from the other side.
      if (cfg.kind === "defense") degree = SW.invertDegree(degree);
      // PHB v4.10, Strikes: a Quick Strike cannot Critically Hit; a natural 20 is a Hit. Agile
      // weapons are light enough to bite on the way in, and may.
      if ((cfg.kind === "attack") && (degree === "critSuccess") && !strikeCanCrit(cfg.strike, cfg.item)) {
        degree = "success";
        critDenied = true;
      }
      outcome = SW.ATTACK_OUTCOMES[degree];
    }

    const result = {
      roll,
      natural,
      total: roll.total,
      threshold: cfg.threshold,
      thresholdLabel: cfg.thresholdLabel,
      degree,
      outcome,
      critDenied,
      modifiers: applied,
      extras,
      modTotal,
      config: cfg
    };

    if (cfg.afterRoll) await cfg.afterRoll(result);

    // A blind roll (the attack flow's roller) stops here: no card, and the `starwrought.check`
    // hook keeps its meaning of "a card was posted". The coordinator posts one card per defender
    // from this result through resolveAgainst.
    if (cfg.postCard === false) return result;

    await toMessage(result);
    Hooks.callAll("starwrought.check", result);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Resolve a roll already made against one defender and post the Exchange card for the pairing
   * (0.5.0 brief, "The roll and the resolution"). The attack flow rolls once, blind, and the
   * coordinator calls this once per defender when the commitments have revealed, so a player
   * attacker with three targets gets three of today's cards from one die.
   *
   * The comparison is `roll()`'s exactly: degree from SW.degreeOf, inverted for a Defense roll,
   * a Quick Strike's critical demoted to a Hit unless the weapon is Agile (PHB v4.10, Strikes).
   * Position is built with the committed Defense and Reaction and the defender's rigid implement.
   * The Reaction's ❶ is charged here on an attack when this client owns the defender (a Defense
   * roll charged before the die, as `roll()` does); otherwise the card offers the Charge button.
   * The Threshold is printed and written to the flags only when `showThreshold` is true: the
   * number of an adversary's Defense is the GM's, and the policy that hides it is applied by the
   * caller, never guessed here.
   *
   * @param {object} opts
   * @param {Actor} [opts.attacker]            Who struck. The roller when `kind` is "attack".
   * @param {Actor} [opts.defender]            Who answered. The roller when `kind` is "defense".
   * @param {Token|TokenDocument} [opts.attackerToken]
   * @param {Token|TokenDocument} [opts.defenderToken]
   * @param {Item} [opts.weapon]               The attacker's weapon Item (a character's Strike).
   * @param {string} [opts.attackId]           An adversary's attack row (an action Item id on the attacker).
   * @param {string} [opts.strike]             quick | deliberate | committed.
   * @param {object} opts.rollData             `roll.toJSON()` of the blind roll, or the whole
   *                                           `{ roll, total, natural, modifiers }` the roller sent.
   * @param {Array} [opts.modifiers]           The blind roll's applied modifiers, for the card's list.
   * @param {"attack"|"defense"} [opts.kind]   Which side rolled.
   * @param {string} [opts.defense]            evade | guard: the Defense that met the Blow.
   * @param {string|null} [opts.reaction]      parry | void | counter | null.
   * @param {object|null} [opts.posture]       { talentId, name?, zone } or null. Never beside a Reaction.
   * @param {number|null} [opts.threshold]     The authoritative Threshold (the coordinator's number).
   * @param {boolean} [opts.showThreshold]     Print it and write it to the flags.
   * @param {Actor} [opts.speakerActor]        Whose name the card speaks under (default the roller).
   * @param {string} [opts.slug]               melee | ranged for an attack (the Proficiency rolled).
   * @param {boolean} [opts.thrown]
   * @param {string} [opts.rollMode]           Default public: the resolution is the table's record.
   * @returns {Promise<{message: ChatMessage, outcome: string|null, degree: string|null, critDenied: boolean, threshold: number|null}>}
   */
  static async resolveAgainst({
    attacker = null, defender = null, attackerToken = null, defenderToken = null,
    weapon = null, attackId = null, strike = SW.DEFAULT_STRIKE, rollData, modifiers = null,
    kind = "attack", defense = null, reaction = null, posture = null,
    threshold = null, showThreshold = true, speakerActor = null, slug = null, thrown = false,
    // The legacy key, which the card's toMessage maps to the configured mode: CONST.DICE_ROLL_MODES is a
    // deprecation shim in v14 and gone in v16 (review, 2026-10-01).
    rollMode = "publicroll",
    // A reroll (0.5.3) resolves a Blow whose Reaction was paid when the first die landed: true
    // here skips the charge and prints the Reaction as already paid. Null means "charge as usual".
    reactionCharged: alreadyCharged = null,
    // A reroll names the card it replaces and why (0.5.3); both ride into the flags and the card.
    rerollOf = null, rerollReason = ""
  } = {}) {
    if (!rollData) throw new Error("STARWROUGHT | resolveAgainst needs the roll's data.");
    // The roller may have sent its whole submission rather than the bare Roll data.
    if (rollData.roll && !rollData.terms) {
      modifiers ??= rollData.modifiers ?? null;
      rollData = rollData.roll;
    }
    const isAttack = kind !== "defense";
    kind = isAttack ? "attack" : "defense";
    const roller = isAttack ? attacker : defender;
    if (!roller) throw new Error("STARWROUGHT | resolveAgainst needs the roller: the attacker on an Attack roll, the defender on a Defense roll.");
    if (!SW.STRIKE_KINDS[strike]) strike = SW.DEFAULT_STRIKE;
    reaction = (SW.REACTIONS[reaction]?.kind === "reaction") ? reaction : null;
    posture = posture?.talentId ? posture : null;
    // A commitment is a Reaction or a Posture, never both (brief; one answer per attack, PHB v4.21).
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");
    // A Reaction stands on its own Defense (Sidestep on Evade, Parry on Guard), whatever was named.
    if (SW.REACTIONS[reaction]?.defense) defense = SW.REACTIONS[reaction].defense;
    if (!SW.DEFENSES[defense]) defense = "evade";

    const roll = Roll.fromData(rollData);
    const natural = roll.dice[0]?.results?.[0]?.result ?? null;
    const total = roll.total;

    let degree = null;
    let outcome = null;
    let critDenied = false;
    if (Number.isNumeric(threshold)) {
      degree = SW.degreeOf(total, threshold, natural);
      // A Defense roll is the same comparison read from the other side.
      if (!isAttack) degree = SW.invertDegree(degree);
      // PHB v4.10, Strikes: a Quick Strike cannot Critically Hit unless the weapon is Agile.
      if (isAttack && (degree === "critSuccess") && !strikeCanCrit(strike, weapon)) {
        degree = "success";
        critDenied = true;
      }
      outcome = SW.ATTACK_OUTCOMES[degree];
    }

    const attackerDoc = attackerToken?.document ?? attackerToken ?? null;
    const defenderDoc = defenderToken?.document ?? defenderToken ?? null;
    const attackerName = attackerDoc?.name ?? attacker?.name ?? "";
    const defenderName = defenderDoc?.name ?? defender?.name ?? "";

    const strikeKind = SW.STRIKE_KINDS[strike];
    const strikeText = `${game.i18n.localize(strikeKind.label)} ${SW.ACTION_GLYPHS[strikeKind.cost]}`;
    const attackItem = attackId ? (attacker?.items?.get(attackId) ?? null) : null;
    const attackName = weapon?.name ?? attackItem?.name ?? "";
    slug ??= isAttack
      ? (thrown ? SW.RANGED_SLUG : (weapon?.system?.strikeSlug ?? SW.MELEE_SLUG))
      : SW.DEFENSES[defense].slug;
    const ranged = slug === SW.RANGED_SLUG;

    // A Strike at a target the weapon cannot reach is said on the card, never refused, so the GM
    // can adjudicate (Mike, 2026-10-01). The immediate card (rollAttack) worked this out before
    // the die; a card resolved here (the attack flow, a reroll) had `rangeNote: null` written
    // into it and so never said so (Mike, 2026-10-01: "he was within my range, but I wasn't
    // within his range. It should have put the warning into chat"). The same reading as
    // rollAttack's, per pairing, from the two tokens as they stand when the Blow resolves.
    const rangeNote = (attackerDoc && defenderDoc && canvas?.ready)
      ? this.rangeNoteFor({ attacker, weapon, attackItem, attackerDoc, defenderDoc, thrown, ranged })
      : null;

    // The answer behind the Defense, named as answeringDefense names it: "Guard (Parry)", or
    // the Posture's own name.
    // Plain (0.5.1, T16): the card appends the ⓿↺ itself, so the data's glyph would print twice.
    const postureName = posture
      ? SW.plainName(postureNameOf(defender, posture) ?? game.i18n.localize("STARWROUGHT.Reaction.posture"))
      : "";
    const answerText = reaction ? game.i18n.localize(SW.REACTIONS[reaction].label) : postureName;
    const defenseLabel = game.i18n.localize(SW.DEFENSES[defense].label);
    const answeredLabel = answerText ? `${defenseLabel} (${answerText})` : defenseLabel;

    // PHB v4.10, Answering an Attack: the Reaction is paid when the Blow resolves. On an attack
    // this client charges the defender when it owns them; a Defense roll charged before the die.
    let reactionCharged = false;
    if (reaction) {
      if (alreadyCharged === true) reactionCharged = true;
      else reactionCharged = isAttack ? await this.chargeReaction(defender, reaction) : true;
    }

    const cfg = {
      actor: roller,
      item: isAttack ? weapon : null,
      weaponId: isAttack ? (weapon?.id ?? "") : "",
      // The attack by name on either card, so a Defense card's Bind records what was Stopped (0.5.1).
      attackName,
      kind,
      slug,
      label: isAttack ? (attackName || roller.name) : defenseLabel,
      subtitle: isAttack
        ? `${strikeText} · ${game.i18n.localize(ranged ? "STARWROUGHT.Roll.rangedStrike" : "STARWROUGHT.Roll.meleeStrike")}`
        : (attackName ? `${strikeText} · ${attackName}` : game.i18n.localize(SW.DEFENSES[defense].hint)),
      strike,
      reaction,
      posture: posture ? { talentId: posture.talentId, name: postureName, zone: posture.zone ?? null } : null,
      defense,
      threshold: showThreshold ? threshold : null,
      thresholdLabel: !showThreshold ? ""
        : isAttack ? `${defenderName} ${answeredLabel}`.trim()
        : game.i18n.localize("STARWROUGHT.Roll.attackThreshold"),
      // Token uuids where the card's handlers expect them: the target of an attack is the
      // defender's token; the "target" of a Defense roll is the attacker's.
      targetUuid: isAttack ? (defenderDoc?.uuid ?? "") : (attackerDoc?.uuid ?? ""),
      targetName: isAttack ? defenderName : attackerName,
      attackerTokenUuid: isAttack ? (attackerDoc?.uuid ?? "") : "",
      defenderTokenUuid: isAttack ? "" : (defenderDoc?.uuid ?? ""),
      defender: isAttack ? defender : null,
      attacker: isAttack ? null : attacker,
      defenderRigid: defender?.rigidImplement ?? null,
      reactionCharged,
      reactionNote: (reaction && SW.REACTIONS[reaction].rigid && !defender?.rigidImplement)
        ? game.i18n.localize("STARWROUGHT.Reaction.needsRigid") : null,
      defenseNote: null,
      rangeNote,
      thrown: !!thrown,
      rollMode,
      speakerActor,
      outcomes: null,
      // An adversary's attack row, so a reroll of a Defense card can read the Attack Threshold again.
      attackId: attackId ?? null,
      rerollOf: rerollOf ?? null,
      rerollReason: rerollReason ?? ""
    };

    const applied = Array.isArray(modifiers) ? modifiers : [];
    const result = {
      roll,
      natural,
      total,
      threshold: cfg.threshold,
      thresholdLabel: cfg.thresholdLabel,
      degree,
      outcome,
      critDenied,
      modifiers: applied,
      modTotal: applied.length ? applied.reduce((n, m) => n + (Number(m.value) || 0), 0) : (total - (natural ?? 0)),
      config: cfg
    };

    await toMessage(result);
    Hooks.callAll("starwrought.check", result);
    return { message: result.message, outcome: outcome?.key ?? null, degree, critDenied, threshold };
  }

  /* -------------------------------------------- */

  /**
   * The modifier a check would open its dialog with, before the player adds anything: the base
   * terms, whatever the sheet can see for itself (Frightened, Load Strain on Stealth, the
   * adjustment fields), the Automation rules that apply to the roll as configured (0.10.0: a
   * `bonus` to the Constellation named, or to the Maneuver in `config.item`), and whatever the
   * caller passes in `config.modifiers`. The Relevant Check picker prints this beside each
   * Constellation so that a strained Stealth ranks where the roll will land. The dialog's own
   * offers (Load Strain on a Climb or a Swim; a rule's bonus to a Maneuver this roll may or may not
   * be) are not in it.
   * @param {Actor} actor
   * @param {object} [config]  The same shape `roll()` takes; `kind` defaults to "check".
   * @returns {number}
   */
  static previewTotal(actor, config = {}) {
    const cfg = foundry.utils.mergeObject({ kind: "check" }, config, { inplace: false });
    return SW.resolveModifiers(assemble(actor, cfg)).total;
  }

  /**
   * Can this Strike Critically Hit? Quick cannot, unless the weapon is Agile (PHB v4.10). The rule
   * lives in check/strike.mjs; this is the public name the damage roll calls.
   * @param {string} strike
   * @param {Item|null} weapon
   * @returns {boolean}
   */
  static strikeCanCrit(strike, weapon) {
    return strikeCanCrit(strike, weapon);
  }

  /**
   * Pay for a Reaction: its cost from the same six actions (PHB v4.21: a Reaction Talent's ❶↺ is
   * spent the moment the attack it answers lands). Owned actors only; a card offers the button to
   * whoever owns the defender otherwise. A ⓿↺ answer costs nothing and spends nothing.
   * @param {Actor} actor
   * @param {string} key  A key of SW.REACTIONS.
   * @returns {Promise<boolean>} whether the charge was made
   */
  static async chargeReaction(actor, key) {
    const reaction = SW.REACTIONS[key];
    if (!actor?.isOwner || !reaction) return false;
    if (!reaction.cost) return true;
    await actor.spendActions(reaction.cost, {
      label: `${game.i18n.localize(reaction.label)} ${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`
    });
    return true;
  }

  /* -------------------------------------------- */

  /**
   * The out-of-reach or out-of-range note for a Strike, or null when the target is within what
   * the attack can reach (PHB v4.10; Mike, 2026-10-01: said on the card, never refused). Melee: the
   * whole-square gap between the two spaces is more than the attacker's Natural Reach plus the
   * weapon's (or an adversary's attack row's reach). Ranged or thrown: more than the weapon's
   * range. One reading for the immediate card and the resolved one.
   * @param {object} opts
   * @param {Actor} opts.attacker
   * @param {Item|null} [opts.weapon]       A character's weapon.
   * @param {Item|null} [opts.attackItem]   An adversary's attack row (an action Item).
   * @param {TokenDocument} opts.attackerDoc
   * @param {TokenDocument} opts.defenderDoc
   * @param {boolean} [opts.thrown]
   * @param {boolean} [opts.ranged]
   * @returns {string|null}
   */
  static rangeNoteFor({ attacker, weapon = null, attackItem = null, attackerDoc, defenderDoc, thrown = false, ranged = false } = {}) {
    if (!attackerDoc || !defenderDoc) return null;
    let gap;
    try {
      gap = gapBetween(attackerDoc, defenderDoc);
    } catch {
      return null;
    }
    if (!Number.isFinite(gap)) return null;
    const feet = Math.round(gap);
    if (!ranged) {
      const row = attackItem?.system?.attack ?? attackItem?.system ?? null;
      const rowReach = Number(row?.reach);
      const reachWith = weapon
        ? (Number(attacker?.system?.reach) || 0) + (Number(weapon.system?.reach) || 0)
        : (Number.isFinite(rowReach) ? rowReach : (Number(attacker?.system?.totalReach ?? attacker?.system?.reach) || 0));
      return (gap > reachWith) ? game.i18n.format("STARWROUGHT.Strike.outOfReach", { gap: feet, reach: reachWith }) : null;
    }
    const range = thrown ? weapon?.system?.flags?.thrown : weapon?.system?.flags?.ranged;
    if (Number.isFinite(range) && (range > 0) && (gap > range)) {
      return game.i18n.format("STARWROUGHT.Strike.outOfRange", { gap: feet, range });
    }
    return null;
  }

  /**
   * Throw an Attack or Defense card's die again (0.5.3; Mike: "Players (and the GM) should have a
   * 'reroll' option on the Attack, for special cases", "and for Defense rolls, too"). Everything
   * but the d20 stays as it was: the card's own flags carry the roller, the weapon or attack row,
   * the Strike, the defender's Defense, Reaction and Posture, the Proficiency rolled, the applied
   * modifiers and the Threshold where it was shown. Nothing is paid again: the Reaction was
   * charged when the first die landed and the Strike's actions were spent before it. The new card
   * names the one it replaces and the reason given; the old card is marked superseded here when
   * this client may write it (its author or a GM), so its buttons stop acting.
   *
   * The Threshold is the caller's to supply when the card hid it: an adversary's number inside the
   * attack flow is read again on the GM's client (chat.mjs relays the reroll there), from
   * `AttackCoordinator.thresholdForCard`. A card that showed its Threshold shows it again.
   *
   * @param {ChatMessage} message       The card being rerolled.
   * @param {object} options
   * @param {object} options.rollData   `{ roll, total, natural, formula, modifiers }` of the new die.
   * @param {string} [options.reason]   What the table said: "Hero Point", "GM ruling".
   * @param {number|null} [options.threshold]  The Threshold to read the die against.
   * @returns {Promise<object|null>}  resolveAgainst's result, or null for a card that cannot be rerolled.
   */
  static async rerollCard(message, { rollData, reason = "", threshold = null } = {}) {
    const flags = message?.flags?.[SW.SYSTEM_ID];
    if (!flags || !["attack", "defense"].includes(flags.kind) || !rollData) return null;
    const actorOf = uuid => {
      const doc = uuid ? fromUuidSync(uuid) : null;
      if (!doc) return null;
      return (doc.documentName === "Actor") ? doc : (doc.actor ?? null);
    };
    const tokenOf = uuid => {
      const doc = uuid ? fromUuidSync(uuid) : null;
      if (!doc) return null;
      if (doc.documentName === "Token") return doc;
      if (doc.documentName === "Actor") return doc.getActiveTokens(false, true)[0] ?? null;
      return null;
    };
    const isAttack = flags.kind === "attack";
    const roller = actorOf(flags.actorUuid);
    if (!roller) return null;
    const attacker = isAttack ? roller : actorOf(flags.attackerUuid);
    const defender = isAttack ? actorOf(flags.defenderUuid) : roller;
    // The card's "target" token is the defender's on an attack card and the attacker's on a Defense card.
    const targetDoc = tokenOf(flags.targetUuid);
    const own = actor => actor?.tokenOnScene?.() ?? (actor ? tokenOf(actor.uuid) : null);

    const result = await this.resolveAgainst({
      attacker, defender,
      attackerToken: isAttack ? own(attacker) : targetDoc,
      defenderToken: isAttack ? targetDoc : own(defender),
      weapon: (flags.weaponId && attacker) ? (attacker.items.get(flags.weaponId) ?? null) : null,
      attackId: flags.attackId ?? null,
      strike: flags.strike ?? SW.DEFAULT_STRIKE,
      rollData,
      modifiers: Array.isArray(flags.modifiers) ? flags.modifiers : null,
      kind: flags.kind,
      defense: flags.defense ?? null,
      reaction: flags.reaction ?? null,
      posture: flags.posture ?? null,
      threshold: Number.isNumeric(threshold) ? Number(threshold) : null,
      showThreshold: Number.isNumeric(flags.threshold),
      speakerActor: ChatMessage.getSpeakerActor(message.speaker) ?? roller,
      slug: flags.slug ?? null,
      thrown: !!flags.thrown,
      rollMode: message.whisper?.length ? "gmroll" : "publicroll",
      // Paid when the first die landed: never again. A first card whose Charge button was never
      // pressed still owes the ❶, so that card's state carries over and the charge runs as usual.
      reactionCharged: flags.reactionCharged ? true : null,
      rerollOf: message.id,
      rerollReason: reason
    });

    if (message.isAuthor || game.user.isGM) {
      await message.update({ [`flags.${SW.SYSTEM_ID}.superseded`]: { by: result?.message?.id ?? null, reason } });
    }
    // The attack flow's card shows this pairing's outcome; the coordinator module moves it on.
    Hooks.callAll("starwrought.reroll", { oldId: message.id, result, reason });
    return result;
  }

  /**
   * The user's current target, if there is exactly one with an Actor behind it.
   * @returns {Token|null}
   */
  static currentTarget() {
    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) return null;
    return targets[0].actor ? targets[0] : null;
  }

  /**
   * One of a token's Defense Thresholds, labelled for the card.
   * @param {Token} token
   * @param {string} defense  A key of SW.DEFENSES.
   * @returns {{threshold: number, label: string, uuid: string}|null}
   */
  static thresholdOf(token, defense) {
    const value = token.actor?.system.defenses?.[defense]?.threshold;
    if (!Number.isNumeric(value)) return null;
    return {
      threshold: value,
      label: `${token.name} ${game.i18n.localize(SW.DEFENSES[defense].label)}`,
      uuid: token.document.uuid
    };
  }

  /**
   * Read a Threshold off the user's current target, if there is exactly one.
   * @param {string} defense  A key of SW.DEFENSES.
   * @returns {{threshold: number, label: string, uuid: string}|null}
   */
  static targetThreshold(defense) {
    const token = this.currentTarget();
    return token ? this.thresholdOf(token, defense) : null;
  }
}
