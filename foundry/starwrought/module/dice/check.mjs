/**
 * The check engine.
 *
 * One formula for everything (PHB v4.10): d20 + Attribute Bonus + Proficiency Bonus + bonuses and
 * penalties, measured against a Threshold of 10 + the same modifier. Level never touches the die;
 * it opens ranks and pays out Talent Points. Attacks and Defenses are the same roll read from
 * opposite sides, which is why they share this code and differ only in which way the degrees run.
 */

import * as SW from "../config.mjs";
import { gapBetween } from "../canvas/geometry.mjs";
import { postureName as postureNameOf } from "../helpers/answers.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

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
 * @property {string} [strike]                quick | deliberate | committed. An attack's commitment,
 *                                            or the commitment behind the blow a Defense answers.
 * @property {string|null} [reaction]         parry | void | counter | null. On a Defense roll, the
 *                                            roller's Reaction; on an attack, the defender's stance.
 * @property {{ranged: boolean, gap: number|null}} [threat]  On an attack, what the defender is
 *                                            answering: a ranged Blow, and the gap in feet, so a
 *                                            Counter stance is read against it at roll time.
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
    // the blow is read as Deliberate: full damage, and the middle of the table.
    if (["attack", "defense"].includes(cfg.kind) && !SW.STRIKE_KINDS[cfg.strike]) cfg.strike = SW.DEFAULT_STRIKE;
    if (cfg.reaction && !SW.REACTIONS[cfg.reaction]) cfg.reaction = null;

    // Assemble the standard modifiers from the character sheet, then whatever the caller worked
    // out that the sheet cannot see: Unwieldy against a close target, Support, a Talent's bonus.
    let parts = this.#assemble(actor, cfg);

    // Ask the player what they want to add, and against what.
    let dialogExtra = [];
    if (cfg.dialog) {
      const answer = await this.#prompt(cfg, parts);
      if (!answer) return null;
      Object.assign(cfg, answer.config);
      // A Reaction chosen in the dialog can change which Defense is rolled, so the base terms are
      // rebuilt around the new slug before the extras go on.
      if (answer.rebuild) parts = this.#assemble(actor, cfg);
      dialogExtra = Array.isArray(answer.extra) ? answer.extra : [];
      parts.push(...dialogExtra);
    }
    // Everything the roll carried beyond the base terms the sheet assembles: the caller's typed
    // modifiers and the dialog's extras. The Party Sheet's remembered road roll keeps these (0.7.3,
    // ruling 109), so a kept roll can be re-assembled as an Initiative with one typed-stacking pass.
    const extras = [...(cfg.modifiers ?? []), ...dialogExtra]
      .filter(m => Number.isNumeric(m?.value))
      .map(m => ({ label: String(m.label ?? ""), value: Number(m.value), type: m.type ?? null }));

    // PHB v4.10, Answering an Attack: a Reaction is paid "before any roll from the same six you
    // attack with". Parry and Void add +2 Situation to the Defense; Counter adds nothing to it.
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

    // The defender's answer is read the moment the die is thrown, not when the dialog opened: the
    // whole point of a stance is that they may change it while the attacker is deciding.
    if (cfg.kind === "attack") this.#readDefender(cfg);

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
      if ((cfg.kind === "attack") && (degree === "critSuccess") && !this.strikeCanCrit(cfg.strike, cfg.item)) {
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

    await this.#toMessage(result);
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
    // The legacy key, which #toMessage maps to the configured mode: CONST.DICE_ROLL_MODES is a
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
    reaction = ["parry", "void", "counter"].includes(reaction) ? reaction : null;
    posture = posture?.talentId ? posture : null;
    // A commitment is a Reaction or a Posture, never both (brief; roster.json forbids the stack).
    if (reaction && posture) throw new Error("STARWROUGHT | A Blow is answered with a Reaction or a Posture, never both.");
    // Void is an Evade and Parry is a Guard, whatever Defense was named; Counter keeps the one given.
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
      if (isAttack && (degree === "critSuccess") && !this.strikeCanCrit(strike, weapon)) {
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
      ? SW.plainName(postureNameOf(defender, posture) ?? game.i18n.localize(SW.REACTIONS.posture.label))
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

    await this.#toMessage(result);
    Hooks.callAll("starwrought.check", result);
    return { message: result.message, outcome: outcome?.key ?? null, degree, critDenied, threshold };
  }

  /* -------------------------------------------- */

  /**
   * The modifier a check would open its dialog with, before the player adds anything: the base
   * terms, whatever the sheet can see for itself (Frightened, Load Strain on Stealth, the
   * adjustment fields), and whatever the caller passes in `config.modifiers`. The Relevant Check
   * picker prints this beside each Constellation so that a strained Stealth ranks where the roll
   * will land. The dialog's own offers (Load Strain on a Climb or a Swim) are not in it.
   * @param {Actor} actor
   * @param {object} [config]  The same shape `roll()` takes; `kind` defaults to "check".
   * @returns {number}
   */
  static previewTotal(actor, config = {}) {
    const cfg = foundry.utils.mergeObject({ kind: "check" }, config, { inplace: false });
    return SW.resolveModifiers(this.#assemble(actor, cfg)).total;
  }

  /** The base terms plus the caller's own modifiers. */
  static #assemble(actor, cfg) {
    const parts = this.#baseModifiers(actor, cfg);
    parts.push(...(cfg.modifiers ?? []));
    return parts;
  }

  /* -------------------------------------------- */

  /**
   * Attribute Bonus and Proficiency Bonus, the two terms every check in the game has (PHB v4.10:
   * there is no level term), and the conditions the sheet can see for itself.
   * @returns {Array}
   */
  static #baseModifiers(actor, cfg) {
    const parts = [];
    const sys = actor.system;

    // Adversaries roll flat; the players own the dice in STARWROUGHT, so an NPC check is rare
    // and uses whatever the GM typed on the sheet.
    if (actor.type === "npc") {
      if (cfg.flatBonus) parts.push({ label: cfg.label, value: cfg.flatBonus });
      return parts;
    }

    // A Defense roll is the Defense's own Threshold with a die in place of the 10, so it rolls the
    // very modifiers the derived Defense already resolved: Attribute, Proficiency, the sheet's
    // adjustment, Off-Guard, Frightened N, Fatigued N, a Parry weapon or a Wounded Arm on Guard,
    // a helm on Awareness. Load Strain is not among them (PHB v4.11: "It never comes off your
    // Evade"). Nothing here can drift from the number on the sheet.
    const defense = SW.DEFENSES[cfg.slug] ? sys.defenses?.[cfg.slug] : null;
    if (defense && Array.isArray(defense.modifiers)) {
      parts.push(...defense.modifiers.map(m => ({ ...m })));
      // Size touches only Evade and Guard, and sits outside the typed stack.
      if (defense.sizeMod) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.size"), value: defense.sizeMod });
      }
      cfg.attribute = defense.attribute;
      cfg.rank = defense.rank;
      // Initiative rolled with Awareness (the default) comes through here, and the sheet's
      // Initiative adjustment belongs on it as the tracker's formula has always had it
      // (`_getInitiativeFormula` folds `system.initiative.mod`, which includes it). The helm is
      // already among Awareness's own modifiers, so only the adjustment is added (0.7.2).
      if ((cfg.kind === "initiative") && sys.bonuses?.initiative) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Field.initiativeBonus"), value: sys.bonuses.initiative });
      }
      return parts;
    }

    const prof = cfg.slug ? sys.proficiency(cfg.slug) : null;
    // A weapon's Handling can lower the rank that applies without changing what you have bought.
    if (prof && cfg.rankOverride && (cfg.rankOverride !== prof.rank)) {
      prof.rank = cfg.rankOverride;
      prof.proficiency = SW.rankBonus(cfg.rankOverride);
      cfg.handlingNote = true;
    }
    const attribute = cfg.attribute || prof?.attribute;
    if (attribute) {
      parts.push({
        label: game.i18n.localize(SW.ATTRIBUTES[attribute].label),
        value: sys.attributes[attribute].mod
      });
      cfg.attribute = attribute;
    }
    if (prof) {
      parts.push({
        label: `${prof.name} (${game.i18n.localize(SW.RANKS[prof.rank].label)})`,
        value: prof.proficiency
      });
      cfg.rank = prof.rank;
    }

    // The sheet's own catch-all adjustments. An Initiative rolled with a Constellation is a check
    // in that Constellation (Mike, 2026-10-02, ruling 111: "ALL active modifiers for any roll
    // should be applied even if that roll is used for initiative"), so it carries everything the
    // check would, the check adjustment here and Load Strain below, and then Initiative's own terms
    // on top. Through 0.7.3 an Initiative rolled with Stealth took neither.
    const asCheck = (cfg.kind === "check") || (cfg.kind === "initiative");
    if (cfg.kind === "attack" && sys.bonuses?.attack) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.attackBonus"), value: sys.bonuses.attack });
    } else if (asCheck && sys.bonuses?.checks) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.checkBonus"), value: sys.bonuses.checks });
    }
    if (cfg.kind === "initiative") {
      if (sys.bonuses?.initiative) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Field.initiativeBonus"), value: sys.bonuses.initiative });
      }
      // PHB v4.10, Helms: a Closed helm is −2 Situation to Initiative, an Open helm −1.
      const helm = SW.HELM_PENALTIES[sys.worn?.head?.name] ?? 0;
      if (helm) parts.push({ label: sys.worn.head.name, value: helm, type: "situation" });
    }

    // Conditions the system can see for itself.
    const frightened = actor.conditionValue("frightened");
    if (frightened) {
      parts.push({
        label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
        value: -frightened,
        type: "condition"
      });
    }

    // The typed modifiers the data model says every attack carries: a Wounded Arm's −2 Situation
    // (PHB v4.10, Wounds), and whatever else the sheet can see. A Controlled weapon's −2 is the
    // same type and is resolved against them rather than added.
    if ((cfg.kind === "attack") && Array.isArray(sys.attackModifiers)) {
      parts.push(...sys.attackModifiers.map(m => ({ ...m })));
    }

    // Load Strain (PHB v4.11, Load and Load Strain): "Climb, Swim, and Stealth checks take your
    // Load Strain as a penalty. Nothing else does." Stealth is applied here, untyped, as the
    // system's own flat adjustment. Climb and Swim are Athletics checks the engine cannot tell
    // from a grapple or a tumble, so the dialog offers the penalty on an Athletics check instead
    // (#prompt). Until 0.6.0 every Might or Agility check took it, and Evade did too. An Initiative
    // rolled with Stealth (Avoid Notice) is a Stealth check and takes it too (ruling 111, 0.7.4).
    if (asCheck && (SW.STRAIN_CHECKS[cfg.slug] === "always") && sys.loadStrain) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.loadStrain"), value: -sys.loadStrain });
    }

    return parts;
  }

  /* -------------------------------------------- */

  /**
   * Can this Strike Critically Hit? Quick cannot, unless the weapon is Agile (PHB v4.10).
   * @param {string} strike
   * @param {Item|null} weapon
   * @returns {boolean}
   */
  static strikeCanCrit(strike, weapon) {
    const kind = SW.STRIKE_KINDS[strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
    if (kind.canCrit) return true;
    return !!(kind.agileCanCrit && weapon?.system?.flags?.agile);
  }

  /**
   * Pay for a Reaction: its cost from the same six actions, and, when the Reaction was the actor's
   * stance, the stance falls back to the basic Defense it was built on. Parry and Void are spent
   * the moment an attack lands on them; Counter likewise. Owned actors only; a card offers the
   * button to whoever owns the defender otherwise.
   * @param {Actor} actor
   * @param {string} key  A key of SW.REACTIONS.
   * @returns {Promise<boolean>} whether the charge was made
   */
  static async chargeReaction(actor, key) {
    const reaction = SW.REACTIONS[key];
    if (!actor?.isOwner || !reaction) return false;
    const fallback = actor.system.stance === key
      ? (reaction.defense ?? actor.answeringDefense?.().key ?? "evade")
      : null;
    await actor.spendActions(reaction.cost, {
      label: `${game.i18n.localize(reaction.label)} ${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`
    });
    if (fallback) await actor.setStance(fallback, { announce: false });
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Read the defender's answer for an attack: which Defense, at what Threshold, with which Reaction
   * behind it. Done at the moment of the roll. A caller may still force a Defense (a Talent that
   * targets Awareness, say), in which case the defender's stance is not consulted.
   */
  static #readDefender(cfg) {
    if (cfg.defenseForced) return;
    const defender = cfg.defender ?? (cfg.targetUuid ? fromUuidSync(cfg.targetUuid)?.actor : null);
    if (!defender?.answeringDefense) return;
    // A party token targeted by mistake has no Defenses to read (0.7.0, risk 1): the Threshold
    // stays unknown rather than reading as a bare 10.
    if (defender.type === SW.PARTY_TYPE) return;
    // The threat the answer is read against: whether the Blow is ranged and how far it came, so
    // a Counter stance falls away for an arrow or a foe beyond Reach (PHB v4.10, Answering an Attack).
    const now = defender.answeringDefense(cfg.threat ?? {});
    cfg.defender = defender;
    cfg.threshold = now.threshold;
    cfg.thresholdLabel = `${cfg.targetName || defender.name} ${now.label}`;
    cfg.defense = now.key;
    cfg.reaction = now.reaction ?? null;
    cfg.defenseNote = now.unavailable ?? null;
    cfg.reactionNote = now.note ?? null;
    cfg.defenderRigid = defender.rigidImplement ?? null;
  }

  /* -------------------------------------------- */

  /**
   * The pre-roll dialog: a situational modifier, the optional modifiers the engine can name but
   * not decide, the Threshold, the Strike kind for an attack, the Reaction for a Defense roll, and
   * the roll mode.
   * @returns {Promise<{config: object, extra: Array, rebuild: boolean}|null>}
   */
  static async #prompt(cfg, parts) {
    const preview = SW.resolveModifiers(parts);
    const actor = cfg.actor;
    const isAttack = cfg.kind === "attack";
    const isDefense = cfg.kind === "defense";

    // Modifiers offered unticked, because the rule applies to a check the engine cannot tell
    // apart from its neighbours. Load Strain on an Athletics check (PHB v4.11): a Climb or a Swim
    // takes it, a grapple or a tumble does not, and only the player knows which this is (ruling
    // R2). Each is a checkbox named `extra-<key>`; the ticked ones join the roll below.
    const extras = [];
    const strain = Number(actor.system?.loadStrain) || 0;
    if ((cfg.kind === "check") && (SW.STRAIN_CHECKS[cfg.slug] === "offered") && (strain >= 1)) {
      extras.push({
        key: "loadStrain",
        label: game.i18n.localize("STARWROUGHT.Roll.strainClimbSwim"),
        hint: game.i18n.localize("STARWROUGHT.Roll.strainClimbSwimHint"),
        value: -strain,
        type: "untyped",
        checked: false
      });
    }

    // The three Strikes, with Committed marked as the one that waits for the next Opportunity.
    const strikes = isAttack ? Object.entries(SW.STRIKE_KINDS).map(([key, kind]) => ({
      key,
      label: game.i18n.localize(kind.label),
      glyph: SW.ACTION_GLYPHS[kind.cost],
      hint: game.i18n.localize(`STARWROUGHT.Strike.${key}Hint`),
      active: key === cfg.strike,
      prepared: kind.prepared && actor.inEncounter && !cfg.prepared,
      canCrit: this.strikeCanCrit(key, cfg.item)
    })) : [];

    // The Reactions this defender owns, offered only against an Attack Threshold: a Defense rolled
    // for its own sake (Endure against a poison) has nothing to React to, and a Defense answering
    // a Reaction (an adversary's Intercept) is the basic roll alone, since a Reaction never
    // triggers a Reaction (PHB v4.10, Answering an Attack); the caller says so with `basicOnly`.
    const owned = actor.system.reactions ?? {};
    const reactions = (isDefense && !cfg.basicOnly && ["evade", "guard"].includes(cfg.slug))
      ? Object.entries(SW.REACTIONS)
        .filter(([key]) => ["parry", "void", "counter"].includes(key))
        .filter(([key]) => (actor.type === "npc") || owned[key])
        .map(([key, reaction]) => ({
          key,
          label: game.i18n.localize(reaction.label),
          glyph: `${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`,
          hint: game.i18n.localize(`STARWROUGHT.Reaction.${key}Hint`),
          defense: reaction.defense ? game.i18n.localize(SW.DEFENSES[reaction.defense].label) : "",
          active: key === cfg.reaction,
          warn: reaction.rigid && !actor.rigidImplement
        }))
      : [];

    const content = await renderTemplate("systems/starwrought/templates/dice/check-dialog.hbs", {
      cfg,
      parts: preview.applied,
      total: preview.total,
      isAttack,
      isDefense,
      extras,
      strikes,
      lockStrike: !!cfg.lockStrike,
      strikeLabel: cfg.strike ? game.i18n.localize(SW.STRIKE_KINDS[cfg.strike].label) : "",
      strikeGlyph: cfg.strike ? SW.ACTION_GLYPHS[SW.STRIKE_KINDS[cfg.strike].cost] : "",
      reactions,
      actionsLeft: actor.inEncounter ? (actor.system.actions?.value ?? null) : null,
      targetName: cfg.targetName ?? "",
      targetDefense: cfg.targetDefense ?? null,
      defenseForced: !!cfg.defenseForced,
      // A Defense rolled inside the attack flow meets the coordinator's Threshold, an adversary's
      // withheld from players, so the dialog offers no box for one (live test, 2026-10-01).
      thresholdWithheld: !!cfg.workflow,
      threshold: Number.isNumeric(cfg.threshold) ? cfg.threshold : "",
      rollModes: CONFIG.Dice.rollModes,
      rollMode: cfg.rollMode
    });

    const answer = await DialogV2.wait({
      window: { title: cfg.label, icon: "fa-solid fa-dice-d20" },
      classes: ["starwrought", "check-dialog"],
      position: { width: 440 },
      content,
      buttons: [
        { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });

    if (!answer || answer === "cancel") return null;

    const extra = [];
    const bonus = Number(answer.bonus) || 0;
    if (bonus) extra.push({ label: game.i18n.localize("STARWROUGHT.Roll.situational"), value: bonus, type: "situation" });
    // The offers the player ticked. A checkbox comes back as a boolean under its own name.
    for (const offer of extras) {
      if (answer[`extra-${offer.key}`] === true) extra.push({ label: offer.label, value: offer.value, type: offer.type });
    }

    const config = { rollMode: answer.rollMode ?? cfg.rollMode };
    let rebuild = false;

    if (!cfg.targetDefense && !isDefense && Number.isNumeric(answer.threshold)) {
      // A blank box means no Threshold is known, not a Threshold of zero, which every roll beats.
      config.threshold = Number(answer.threshold);
    }
    if (isDefense && Number.isNumeric(answer.threshold)) config.threshold = Number(answer.threshold);

    if (isAttack && !cfg.lockStrike && SW.STRIKE_KINDS[answer.strike]) config.strike = answer.strike;

    if (isDefense && reactions.length) {
      const chosen = SW.REACTIONS[answer.reaction] ? answer.reaction : null;
      config.reaction = chosen;
      // Void is an Evade and Parry is a Guard, whatever Defense the button was pressed on.
      const def = chosen ? SW.REACTIONS[chosen].defense : null;
      if (def && (def !== cfg.slug)) {
        config.slug = SW.DEFENSES[def].slug;
        config.label = game.i18n.localize(SW.DEFENSES[def].label);
        config.subtitle = game.i18n.localize(SW.DEFENSES[def].hint);
        config.defense = def;
        rebuild = true;
      }
    }
    return { config, extra, rebuild };
  }

  /* -------------------------------------------- */

  /**
   * Post the card. One renderer for every check card: `roll()` and `resolveAgainst` both come
   * through here, so an attack resolved by the coordinator is the very card an immediate attack
   * posts, with the same content, flags and buttons (0.5.0 brief).
   */
  static async #toMessage(result) {
    const cfg = result.config;
    const isExchange = ["attack", "defense"].includes(cfg.kind);
    const position = isExchange ? this.#position(cfg, result) : null;

    const content = await renderTemplate(
      "systems/starwrought/templates/chat/check-card.hbs",
      await this.#cardContext(result, position)
    );

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: cfg.speakerActor ?? cfg.actor }),
      content,
      rolls: [result.roll],
      flags: { starwrought: this.#cardFlags(result, position) }
    };
    // v14 renamed applyRollMode to applyMode and the modes to "public", "gm", "blind", "self";
    // the dialog still speaks the legacy keys, which core's own mapper translates. The old call
    // remains for a v13 world (review, 2026-10-01).
    if (typeof ChatMessage.applyMode === "function") {
      const mode = foundry.dice.Roll._mapLegacyRollMode?.(cfg.rollMode) ?? cfg.rollMode;
      ChatMessage.applyMode(messageData, mode);
    } else {
      ChatMessage.applyRollMode(messageData, cfg.rollMode);
    }
    result.message = await ChatMessage.create(messageData);
  }

  /** The render context of templates/chat/check-card.hbs for a result. */
  static async #cardContext(result, position) {
    const cfg = result.config;
    const item = cfg.item;
    const isExchange = ["attack", "defense"].includes(cfg.kind);

    const enrich = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(
      html ?? "", { rollData: cfg.actor.getRollData(), relativeTo: item }
    );

    const strikeKind = isExchange ? SW.STRIKE_KINDS[cfg.strike] : null;
    const reaction = cfg.reaction ? SW.REACTIONS[cfg.reaction] : null;
    // A Posture stands where a Reaction would on the card: "{name} ⓿↺ (Expose {zone})". The two
    // never answer the same Blow together, so the slot is one or the other.
    let postureLabel = "";
    if (!reaction && cfg.posture?.talentId) {
      const name = cfg.posture.name ?? game.i18n.localize(SW.REACTIONS.posture.label);
      postureLabel = SW.ZONES[cfg.posture.zone]
        ? game.i18n.format("STARWROUGHT.Attack.answerPosture", { name, zone: game.i18n.localize(SW.ZONES[cfg.posture.zone].label) })
        : `${name} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`;
    }

    // Which damage buttons the attacker gets: a Quick Strike that cannot crit has no Critical.
    const canDamage = !!result.outcome?.damage && !!cfg.weaponId;
    const damageButtons = canDamage ? ["critical", "hit", "graze"]
      .filter(key => (key !== "critical") || this.strikeCanCrit(cfg.strike, item))
      .map(key => ({ key, label: `STARWROUGHT.Outcome.${key}`, primary: key === result.outcome.key }))
      : [];

    return {
      label: cfg.label,
      subtitle: cfg.subtitle ?? "",
      kind: cfg.kind,
      actor: cfg.actor,
      item,
      itemDescription: item ? await enrich(item.system.chatDescription) : "",
      // An action authored with separate flavour and rules prints both, flavour first, as the
      // item card does.
      itemFlavor: (item?.type === "action" && item.system.effect && item.system.description)
        ? await enrich(item.system.description)
        : "",
      total: result.total,
      formula: result.roll.formula,
      natural: result.natural,
      threshold: result.threshold,
      thresholdLabel: result.thresholdLabel,
      modifiers: result.modifiers,
      degree: result.degree,
      degreeLabel: result.degree ? game.i18n.localize(SW.DEGREES[result.degree].label) : "",
      outcome: result.outcome ? game.i18n.localize(result.outcome.label) : "",
      outcomeKey: result.outcome?.key ?? "",
      isAttack: isExchange,
      canDamage,
      damageButtons,
      weaponId: cfg.weaponId ?? "",
      targetUuid: cfg.targetUuid ?? "",
      strike: isExchange ? cfg.strike : "",
      strikeLabel: strikeKind ? game.i18n.localize(strikeKind.label) : "",
      strikeGlyph: strikeKind ? SW.ACTION_GLYPHS[strikeKind.cost] : "",
      critDenied: result.critDenied,
      // Why the defender answered with a Defense other than their stance, if they did. The card is
      // where the answer is revealed, so this is where the reason belongs.
      defenseNote: cfg.defenseNote ?? "",
      rangeNote: cfg.rangeNote ?? "",
      // The Reaction behind the Defense: the roller's own on a Defense card, the defender's stance
      // on an attack card. The ❶ is charged to the defender when the attack resolves; when the
      // rolling client does not own them, the card offers the button to whoever does.
      reaction: cfg.reaction ?? "",
      reactionLabel: reaction
        ? `${game.i18n.localize(reaction.label)} ${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`
        : postureLabel,
      reactionNote: cfg.reactionNote ?? "",
      reactionDue: !!reaction && !cfg.reactionCharged && (cfg.kind === "attack") && !!position?.defenderUuid,
      position,
      outcomes: cfg.outcomes ?? null,
      // A Constellation Flares on a Critical Success or Critical Failure on a roll with
      // consequences, directly related to a Talent in it. The die can tell us the first half;
      // which Constellation it was related to is the table's call, so the button asks.
      canFlare: this.#canFlare(result, cfg),
      flareSlug: cfg.slug ?? "",
      flareName: cfg.slug ? SW.getConstellation(cfg.slug).name : "",
      // Reroll (0.5.3): offered on every Attack and Defense card to the roller's owner and the GM;
      // a card that is itself a reroll says so, and why.
      canReroll: isExchange,
      reroll: cfg.rerollOf ? { reason: cfg.rerollReason ?? "" } : null
    };
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
   * The `flags.starwrought` a check card carries. Every card button rebuilds its state from these
   * after a reload (chat.mjs), so the sixteen keys are a contract: none is renamed or dropped. A
   * Posture, when one answered, is a seventeenth key the attack flow's card reads.
   */
  static #cardFlags(result, position) {
    const cfg = result.config;
    const isExchange = ["attack", "defense"].includes(cfg.kind);
    const flags = {
      kind: cfg.kind,
      degree: result.degree,
      outcome: result.outcome?.key ?? null,
      actorUuid: cfg.actor.uuid,
      itemUuid: cfg.item?.uuid ?? null,
      weaponId: cfg.weaponId ?? null,
      targetUuid: cfg.targetUuid ?? null,
      threshold: result.threshold,
      strike: isExchange ? cfg.strike : null,
      // The Proficiency rolled (melee or ranged), so the damage card adds the right specialization.
      slug: cfg.slug ?? null,
      thrown: !!cfg.thrown,
      defense: cfg.defense ?? null,
      reaction: cfg.reaction ?? null,
      reactionCharged: !!cfg.reactionCharged,
      attackerUuid: position?.attackerUuid ?? null,
      defenderUuid: position?.defenderUuid ?? null
    };
    if (cfg.posture?.talentId) {
      flags.posture = { talentId: cfg.posture.talentId, name: cfg.posture.name ?? "", zone: cfg.posture.zone ?? null };
    }
    // Rerolls (0.5.3) throw the same die again from the card alone, so the card keeps what a
    // reroll needs and the contract above does not carry: the applied modifiers by name (the
    // new card lists them), the adversary's attack row behind a Defense card (its Threshold is
    // read again, on the GM's client), and which card this one replaced, and why.
    if (isExchange) {
      flags.modifiers = (result.modifiers ?? []).map(m => ({ label: m.label, value: m.value, type: m.type ?? null }));
      flags.attackId = cfg.attackId ?? null;
      if (cfg.rerollOf) {
        flags.rerollOf = cfg.rerollOf;
        flags.rerollReason = cfg.rerollReason ?? "";
      }
    }
    return flags;
  }

  /* -------------------------------------------- */

  /**
   * Settle Position (PHB v4.10, The Exchange, step 5): what the card offers once the Result is
   * read. Everything here is an offer to the side the rule favours, never an automatic write,
   * because "a plausible Zone" and "if they Guarded with a rigid weapon" are the table's to confirm.
   *
   *  - Miss: the attacker is Exposed in a Zone of the defender's choice, whatever the Strike. A
   *    Guard with a rigid implement takes Control (a Quick Strike can only be bound). An Evade
   *    may Step.
   *  - Graze: Weighted (Committed) Exposes the attacker. A Guard with a rigid implement forms a
   *    neutral Bind, or Control if it was a Parry against a Deliberate or Committed Strike. An
   *    Evade gives 3 feet directly away, or a Step of its own choosing if it Voided.
   *  - The Bind is offered only when the attack can be bound: a melee weapon or natural attack
   *    that is neither Flexible nor Unparryable. Otherwise the card says why not.
   *  - Hit or Critical Hit: a Committed Strike may Expose a plausible Zone on any Hit; a Deliberate
   *    Strike may on a Critical Hit.
   *  - Counter: the defender's Quick Strike back resolves whatever the Result was.
   *  - Parry that Stops a Deliberate or Committed Strike: Control, and the riposte Quick Strike ⓿.
   */
  static #position(cfg, result) {
    if (!result.outcome) return null;
    const isAttack = cfg.kind === "attack";
    const attacker = isAttack ? cfg.actor : (cfg.attacker ?? null);
    const defender = isAttack ? (cfg.defender ?? null) : cfg.actor;
    const kind = SW.STRIKE_KINDS[cfg.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
    const outcome = result.outcome.key;
    const defense = cfg.defense ?? null;
    const reaction = cfg.reaction ?? null;
    const rigid = isAttack ? (cfg.defenderRigid ?? null) : (cfg.actor.rigidImplement ?? null);

    const pos = {
      zones: Object.entries(SW.ZONES).map(([key, z]) => ({ key, label: z.label })),
      attackerUuid: attacker?.uuid ?? "",
      defenderUuid: defender?.uuid ?? "",
      attackerName: (isAttack ? (cfg.actor.name) : (attacker?.name ?? "")),
      defenderName: (isAttack ? (cfg.targetName || defender?.name || "") : cfg.actor.name),
      attackerTokenUuid: isAttack ? (cfg.attackerTokenUuid ?? "") : (cfg.targetUuid ?? ""),
      defenderTokenUuid: isAttack ? (cfg.targetUuid ?? "") : (cfg.defenderTokenUuid ?? ""),
      exposeAttacker: false,
      exposeDefender: false,
      bind: null,
      bindNote: null,
      ground: null,
      riposte: false,
      counter: reaction === "counter",
      stopped: ["miss", "graze"].includes(outcome)
    };

    if (pos.stopped) {
      // A Miss Exposes the attacker for every Strike the kinds table says it does (all three in
      // PHB v4.10, The Result); a Weighted Strike is Exposed by any Stop. The table is the one
      // place to say otherwise.
      pos.exposeAttacker = ((outcome === "miss") && kind.exposeOnMiss) || kind.weighted;
      // Only a melee weapon or natural attack can be bound (PHB v4.10, The Bind, "What cannot
      // Bind"): nothing Flexible or Unparryable, and nothing that left the hand. A Defense roll
      // does not know the attack, so its offer stands and the table decides.
      const attackFlags = cfg.item?.system?.flags ?? {};
      const bindable = !isAttack
        || !(attackFlags.flexible || attackFlags.unparryable || (cfg.slug === SW.RANGED_SLUG));
      if ((defense === "guard") && rigid && bindable) {
        const control = kind.controllable && ((outcome === "miss") || (reaction === "parry"));
        pos.bind = {
          mode: control ? "control" : "neutral",
          implement: rigid.name ?? "",
          // The weapon that was Stopped, so the Bind records what is held and not whatever the
          // attacker happens to hold first: the Controlled −2 and the "uncontrolled weapon ends
          // the Bind" rule both key on it. A Defense roll has no attacking Item; blank there.
          // A Defense card inside the attack flow names the attack it resolved (`attackName`,
          // 0.5.1), so the Bind records "Bite" rather than "weapon".
          theirs: isAttack ? (cfg.item?.name ?? "") : (cfg.attackName ?? ""),
          label: control ? "STARWROUGHT.Bind.takeControl" : "STARWROUGHT.Bind.form"
        };
        pos.riposte = control && (reaction === "parry");
      } else if (isAttack && !bindable && (defense === "guard") && rigid) {
        // The Guard would have offered a Bind; say why it does not.
        pos.bindNote = game.i18n.format("STARWROUGHT.Bind.cannotBind", { weapon: cfg.item?.name ?? "" });
      }
      if (defense === "evade") {
        pos.ground = ((outcome === "miss") || (reaction === "void"))
          ? { mode: "step", label: "STARWROUGHT.Position.step" }
          : { mode: "give", feet: SW.GIVE_GROUND_FEET, label: "STARWROUGHT.Position.giveGround" };
      }
    } else {
      pos.exposeDefender = kind.full && ((cfg.strike === "committed") || (outcome === "critical"));
    }

    pos.any = pos.exposeAttacker || pos.exposeDefender || !!pos.bind || !!pos.bindNote || !!pos.ground
      || pos.riposte || pos.counter;
    return pos;
  }

  /* -------------------------------------------- */

  /**
   * Was this a critical, on a character who can hold a Flare? The universal trigger also wants
   * the roll to have consequences, which no die can tell us, so the button is an offer.
   */
  static #canFlare(result, cfg) {
    if (!game.settings.get(SW.SYSTEM_ID, "offerFlares")) return false;
    if (cfg.actor?.type !== "character") return false;
    // A Defense roll's degree is written from the attacker's side, so read the defender's own.
    // A denied critical (a Quick Strike's natural 20) was still a critical on the die.
    let own = cfg.kind === "defense" ? SW.invertDegree(result.degree) : result.degree;
    if (result.critDenied) own = "critSuccess";
    return ["critSuccess", "critFail"].includes(own);
  }

  /* -------------------------------------------- */

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
