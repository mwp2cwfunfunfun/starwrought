/**
 * The check engine.
 *
 * One formula for everything: d20 + Level + Attribute Bonus + Proficiency Bonus + bonuses and
 * penalties, measured against a Threshold. Attacks and Defenses are the same roll read from
 * opposite sides, which is why they share this code and differ only in which way the degrees run.
 */

import * as SW from "../config.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * @typedef {object} SwCheckConfig
 * @property {Actor} actor                    Who is rolling.
 * @property {Item} [item]                    The Talent, weapon, or action behind the roll.
 * @property {string} kind                    "check", "attack", "defense", "initiative", "recovery".
 * @property {string} [slug]                  Constellation slug supplying the Proficiency Bonus.
 * @property {string} [attribute]             Override the Constellation's Key Attribute.
 * @property {string} label                   What the card is called.
 * @property {number|null} [threshold]        The number to beat, if it is known.
 * @property {string} [thresholdLabel]        Where the Threshold came from.
 * @property {Array} [modifiers]              Extra typed modifiers.
 * @property {number} [mapIndex]              0, 1, or 2 attacks already made this turn.
 * @property {number[]} [map]                 The MAP ladder to use (agile weapons differ).
 * @property {boolean} [dialog]               Show the roll dialog first.
 * @property {string} [rollMode]
 */

/**
 * How many Attack rolls each Actor has made since its turn began, kept in memory on the client
 * that is rolling. It is the dialog's opening guess and nothing more: the player still chooses,
 * because a reaction like Reactive Strike neither suffers the penalty nor accrues it, and no
 * counter can know that on its own.
 * @type {Map<string, number>}
 */
const attacksThisTurn = new Map();

/** Forget an Actor's attack count, at the start of its turn. */
export function resetAttackCount(uuid) {
  if (uuid) attacksThisTurn.delete(uuid);
  else attacksThisTurn.clear();
}

export class SwCheck {
  /**
   * Roll a check and post the card.
   * @param {SwCheckConfig} config
   * @returns {Promise<object|null>} The resolved check, or null if the dialog was dismissed.
   */
  static async roll(config) {
    // Remember whether the caller picked a MAP step, so the count only fills a gap.
    const callerSetMap = Number.isNumeric(config.mapIndex);

    const cfg = foundry.utils.mergeObject({
      kind: "check",
      modifiers: [],
      mapIndex: 0,
      map: SW.MAP.standard,
      dialog: true,
      threshold: null,
      thresholdLabel: "",
      rollMode: game.settings.get("core", "rollMode")
    }, config, { inplace: false });

    const actor = cfg.actor;
    if (!actor) throw new Error("STARWROUGHT | A check needs an Actor.");

    // Open the dialog on the step this actor has actually reached this turn.
    if ((cfg.kind === "attack") && !callerSetMap && game.settings.get(SW.SYSTEM_ID, "trackMap")) {
      cfg.mapIndex = Math.clamp(attacksThisTurn.get(actor.uuid) ?? 0, 0, 2);
    }

    // Assemble the standard modifiers from the character sheet, then whatever the caller worked
    // out that the sheet cannot see: Unwieldy against a close target, a Talent's own bonus.
    const parts = this.#baseModifiers(actor, cfg);
    parts.push(...(cfg.modifiers ?? []));

    // Ask the player what they want to add, and against what.
    if (cfg.dialog) {
      const answer = await this.#prompt(cfg, parts);
      if (!answer) return null;
      Object.assign(cfg, answer.config);
      parts.push(...answer.extra);
    }

    // The Multiple Attack Penalty, chosen after the dialog so a changed answer is honoured.
    if (cfg.kind === "attack" && cfg.mapIndex > 0) {
      const map = cfg.map[Math.clamp(cfg.mapIndex, 0, 2)];
      if (map) parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.map"), value: map });
    }

    const { total: modTotal, applied } = SW.resolveModifiers(parts);
    const formula = ["1d20", ...applied.map(m => (m.value < 0 ? `- ${Math.abs(m.value)}` : `+ ${m.value}`))].join(" ");

    const roll = await new Roll(formula).evaluate();
    const natural = roll.dice[0]?.results?.[0]?.result ?? null;

    let degree = null;
    let outcome = null;
    if (Number.isNumeric(cfg.threshold)) {
      degree = SW.degreeOf(roll.total, cfg.threshold, natural);
      // A Defense roll is the same comparison read from the other side.
      const attackerDegree = cfg.kind === "defense" ? SW.invertDegree(degree) : degree;
      outcome = SW.ATTACK_OUTCOMES[attackerDegree];
      degree = attackerDegree;
    }

    const result = {
      roll,
      natural,
      total: roll.total,
      threshold: cfg.threshold,
      thresholdLabel: cfg.thresholdLabel,
      degree,
      outcome,
      modifiers: applied,
      modTotal,
      config: cfg
    };

    // One more attack on the board, so the next roll opens one step further down the ladder.
    if (cfg.kind === "attack") {
      attacksThisTurn.set(actor.uuid, (attacksThisTurn.get(actor.uuid) ?? 0) + 1);
    }

    await this.#toMessage(result);
    Hooks.callAll("starwrought.check", result);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Level, Attribute Bonus, and Proficiency Bonus: the three terms every check in the game has.
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

    parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.level"), value: sys.level });

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

    // The sheet's own catch-all adjustments.
    if (cfg.kind === "attack" && sys.bonuses.attack) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.attackBonus"), value: sys.bonuses.attack });
    } else if (cfg.kind === "check" && sys.bonuses.checks) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.checkBonus"), value: sys.bonuses.checks });
    }

    // Conditions the system can see for itself.
    const frightened = actor.conditionValue("frightened");
    if (frightened) {
      parts.push({
        label: game.i18n.localize("STARWROUGHT.Condition.frightened"),
        value: -frightened,
        type: "status"
      });
    }

    // Load Strain bites Evade and any Might or Agility Skill check.
    const strainable = (cfg.slug === SW.DEFENSES.evade.slug)
      || (cfg.kind === "check" && ["might", "agility"].includes(attribute));
    if (strainable && sys.loadStrain) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.loadStrain"), value: -sys.loadStrain });
    }

    return parts;
  }

  /* -------------------------------------------- */

  /**
   * The pre-roll dialog: a situational modifier, the Threshold, MAP, and the roll mode.
   * @returns {Promise<{config: object, extra: Array}|null>}
   */
  static async #prompt(cfg, parts) {
    const preview = SW.resolveModifiers(parts);
    const content = await renderTemplate("systems/starwrought/templates/dice/check-dialog.hbs", {
      cfg,
      parts: preview.applied,
      total: preview.total,
      isAttack: cfg.kind === "attack",
      targetName: cfg.targetName ?? "",
      targetDefense: cfg.targetDefense ?? null,
      threshold: Number.isNumeric(cfg.threshold) ? cfg.threshold : "",
      mapLadder: (cfg.map ?? SW.MAP.standard).map((value, index) => ({
        index, value, label: game.i18n.format(`STARWROUGHT.Roll.map${index}`, { value })
      })),
      rollModes: CONFIG.Dice.rollModes,
      rollMode: cfg.rollMode
    });

    const answer = await DialogV2.wait({
      window: { title: cfg.label, icon: "fa-solid fa-dice-d20" },
      classes: ["starwrought", "check-dialog"],
      position: { width: 420 },
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
    if (bonus) extra.push({ label: game.i18n.localize("STARWROUGHT.Roll.situational"), value: bonus, type: "circumstance" });

    const config = { rollMode: answer.rollMode ?? cfg.rollMode };
    if (cfg.targetDefense && !cfg.defenseForced) {
      // The defender's choice, read at the moment of the roll rather than when the dialog opened:
      // the whole point of a stance is that they may change it while you are deciding, and a
      // condition landing meanwhile moves the Threshold too. The attacker is not offered a choice.
      const defender = cfg.targetUuid ? fromUuidSync(cfg.targetUuid)?.actor : null;
      const now = defender?.answeringDefense?.() ?? cfg.targetDefense;
      config.threshold = now.threshold;
      config.thresholdLabel = `${cfg.targetName} ${now.label}`;
      config.defense = now.key;
    } else if (!cfg.targetDefense && Number.isNumeric(answer.threshold)) {
      // A blank box means no Threshold is known, not a Threshold of zero, which every roll beats.
      config.threshold = Number(answer.threshold);
    }
    if (answer.mapIndex !== undefined) config.mapIndex = Number(answer.mapIndex);
    return { config, extra };
  }

  /* -------------------------------------------- */

  /** Post the card. */
  static async #toMessage(result) {
    const cfg = result.config;
    const item = cfg.item;

    const content = await renderTemplate("systems/starwrought/templates/chat/check-card.hbs", {
      label: cfg.label,
      subtitle: cfg.subtitle ?? "",
      kind: cfg.kind,
      actor: cfg.actor,
      item,
      itemDescription: item ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        item.system.chatDescription ?? "", { rollData: cfg.actor.getRollData(), relativeTo: item }
      ) : "",
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
      isAttack: ["attack", "defense"].includes(cfg.kind),
      canDamage: !!result.outcome?.damage && !!cfg.weaponId,
      weaponId: cfg.weaponId ?? "",
      targetUuid: cfg.targetUuid ?? "",
      outcomes: cfg.outcomes ?? null,
      // A Constellation Flares on a Critical Success or Critical Failure on a roll with
      // consequences, directly related to a Talent in it. The die can tell us the first half;
      // which Constellation it was related to is the table's call, so the button asks.
      canFlare: this.#canFlare(result, cfg),
      flareSlug: cfg.slug ?? "",
      flareName: cfg.slug ? SW.getConstellation(cfg.slug).name : ""
    });

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: cfg.actor }),
      content,
      rolls: [result.roll],
      flags: {
        starwrought: {
          kind: cfg.kind,
          degree: result.degree,
          outcome: result.outcome?.key ?? null,
          actorUuid: cfg.actor.uuid,
          itemUuid: item?.uuid ?? null,
          weaponId: cfg.weaponId ?? null,
          targetUuid: cfg.targetUuid ?? null,
          threshold: result.threshold
        }
      }
    };
    ChatMessage.applyRollMode(messageData, cfg.rollMode);
    result.message = await ChatMessage.create(messageData);
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
    const own = cfg.kind === "defense" ? SW.invertDegree(result.degree) : result.degree;
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
