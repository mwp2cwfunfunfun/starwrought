/**
 * The check engine.
 *
 * One formula for everything (PHB v4.10): d20 + Attribute Bonus + Proficiency Bonus + bonuses and
 * penalties, measured against a Threshold of 10 + the same modifier. Level never touches the die;
 * it opens ranks and pays out Talent Points. Attacks and Defenses are the same roll read from
 * opposite sides, which is why they share this code and differ only in which way the degrees run.
 */

import * as SW from "../config.mjs";

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
      rollMode: game.settings.get("core", "rollMode")
    }, config, { inplace: false });

    const actor = cfg.actor;
    if (!actor) throw new Error("STARWROUGHT | A check needs an Actor.");

    // An attack is one of the three Strikes; a Defense roll answers one. When nobody says which,
    // the blow is read as Deliberate: full damage, and the middle of the table.
    if (["attack", "defense"].includes(cfg.kind) && !SW.STRIKE_KINDS[cfg.strike]) cfg.strike = SW.DEFAULT_STRIKE;
    if (cfg.reaction && !SW.REACTIONS[cfg.reaction]) cfg.reaction = null;

    // Assemble the standard modifiers from the character sheet, then whatever the caller worked
    // out that the sheet cannot see: Unwieldy against a close target, Support, a Talent's bonus.
    let parts = this.#assemble(actor, cfg);

    // Ask the player what they want to add, and against what.
    if (cfg.dialog) {
      const answer = await this.#prompt(cfg, parts);
      if (!answer) return null;
      Object.assign(cfg, answer.config);
      // A Reaction chosen in the dialog can change which Defense is rolled, so the base terms are
      // rebuilt around the new slug before the extras go on.
      if (answer.rebuild) parts = this.#assemble(actor, cfg);
      parts.push(...answer.extra);
    }

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
      modTotal,
      config: cfg
    };

    if (cfg.afterRoll) await cfg.afterRoll(result);

    await this.#toMessage(result);
    Hooks.callAll("starwrought.check", result);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * The modifier a check would open its dialog with, before the player adds anything: the base
   * terms, whatever the sheet can see for itself (Frightened, Load Strain, the adjustment fields),
   * and whatever the caller passes in `config.modifiers`. The Relevant Check picker prints this
   * beside each Constellation so that a strained Athletics ranks where the roll will land.
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
    // adjustment, Off-Guard, Frightened, Fatigued, Load Strain on Evade, a Parry weapon or a
    // Wounded Arm on Guard, a helm on Awareness. Nothing here can drift from the number on the sheet.
    const defense = SW.DEFENSES[cfg.slug] ? sys.defenses?.[cfg.slug] : null;
    if (defense && Array.isArray(defense.modifiers)) {
      parts.push(...defense.modifiers.map(m => ({ ...m })));
      // Size touches only Evade and Guard, and sits outside the typed stack.
      if (defense.sizeMod) {
        parts.push({ label: game.i18n.localize("STARWROUGHT.Roll.size"), value: defense.sizeMod });
      }
      cfg.attribute = defense.attribute;
      cfg.rank = defense.rank;
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

    // The sheet's own catch-all adjustments.
    if (cfg.kind === "attack" && sys.bonuses?.attack) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.attackBonus"), value: sys.bonuses.attack });
    } else if (cfg.kind === "check" && sys.bonuses?.checks) {
      parts.push({ label: game.i18n.localize("STARWROUGHT.Field.checkBonus"), value: sys.bonuses.checks });
    } else if (cfg.kind === "initiative") {
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

    // Load Strain bites any Might or Agility Skill check. Evade takes it through the Defense path.
    const strainable = (cfg.kind === "check") && ["might", "agility"].includes(attribute);
    if (strainable && sys.loadStrain) {
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
   * The pre-roll dialog: a situational modifier, the Threshold, the Strike kind for an attack,
   * the Reaction for a Defense roll, and the roll mode.
   * @returns {Promise<{config: object, extra: Array, rebuild: boolean}|null>}
   */
  static async #prompt(cfg, parts) {
    const preview = SW.resolveModifiers(parts);
    const actor = cfg.actor;
    const isAttack = cfg.kind === "attack";
    const isDefense = cfg.kind === "defense";

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
      strikes,
      lockStrike: !!cfg.lockStrike,
      strikeLabel: cfg.strike ? game.i18n.localize(SW.STRIKE_KINDS[cfg.strike].label) : "",
      strikeGlyph: cfg.strike ? SW.ACTION_GLYPHS[SW.STRIKE_KINDS[cfg.strike].cost] : "",
      reactions,
      actionsLeft: actor.inEncounter ? (actor.system.actions?.value ?? null) : null,
      targetName: cfg.targetName ?? "",
      targetDefense: cfg.targetDefense ?? null,
      defenseForced: !!cfg.defenseForced,
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

  /** Post the card. */
  static async #toMessage(result) {
    const cfg = result.config;
    const item = cfg.item;
    const isExchange = ["attack", "defense"].includes(cfg.kind);

    const enrich = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(
      html ?? "", { rollData: cfg.actor.getRollData(), relativeTo: item }
    );

    const position = isExchange ? this.#position(cfg, result) : null;
    const strikeKind = isExchange ? SW.STRIKE_KINDS[cfg.strike] : null;
    const reaction = cfg.reaction ? SW.REACTIONS[cfg.reaction] : null;

    // Which damage buttons the attacker gets: a Quick Strike that cannot crit has no Critical.
    const canDamage = !!result.outcome?.damage && !!cfg.weaponId;
    const damageButtons = canDamage ? ["critical", "hit", "graze"]
      .filter(key => (key !== "critical") || this.strikeCanCrit(cfg.strike, item))
      .map(key => ({ key, label: `STARWROUGHT.Outcome.${key}`, primary: key === result.outcome.key }))
      : [];

    const content = await renderTemplate("systems/starwrought/templates/chat/check-card.hbs", {
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
        : "",
      reactionNote: cfg.reactionNote ?? "",
      reactionDue: !!reaction && !cfg.reactionCharged && (cfg.kind === "attack") && !!position?.defenderUuid,
      position,
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
        }
      }
    };
    ChatMessage.applyRollMode(messageData, cfg.rollMode);
    result.message = await ChatMessage.create(messageData);
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
          theirs: isAttack ? (cfg.item?.name ?? "") : "",
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
