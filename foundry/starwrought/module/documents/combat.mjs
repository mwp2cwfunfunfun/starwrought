/**
 * Encounter Mode, as the Combat document runs it.
 *
 * PHB v4.10 rewrote the turn. Every combatant receives six actions at the start of each round, and
 * unspent actions expire at its end. Initiative order is fixed and play cycles through it; each
 * time the order reaches you is an Opportunity: one Maneuver you can afford, or Pass. When a full
 * circuit goes by in which everyone Passes, the round ends. Reactions are paid from the same six,
 * at anyone's Opportunity, so there is no reaction slot to hand out.
 *
 * In Foundry a "turn" is an Opportunity. So the turn order wraps within the round instead of ending
 * it (see `nextTurn`), and the round ends when the pass streak, a flag on the Combat, reaches the
 * number of combatants who get an Opportunity. Only a GM may write a Combat flag, so each Pass is
 * stamped on the passing Combatant, whose owner may write that, and one elected client (the active
 * GM whenever there is one) does the counting as the turn moves on. Nothing here prevents anything:
 * the count is announced, the drop still lands, and a GM can always click Next Round.
 *
 * Initiative is unchanged in spirit: "whatever you were already doing", Awareness by default, and
 * adversaries carry a Threshold instead of rolling. There is no level term in v4.10.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";

/** The Combat flag holding how many Passes in a row the table has made this round. */
const FLAG_STREAK = "passStreak";
/** Combatant flags: the Opportunity ({round, turn}) at which this combatant Passed, or spent actions. */
const MARK_PASSED = "passed";
const MARK_ACTED = "acted";

/**
 * Pass streaks kept in memory, by combat id, for a table with no GM connected. A player cannot
 * write a Combat flag, so the elected player client counts here instead and the count is its own.
 */
const localStreaks = new Map();

/**
 * Card buttons handled by this module and by `actions.mjs`, keyed by their `data-sw-combat` value.
 * A handler receives `{actor, button, root, message}`; `actor` is the document named by the card's
 * `data-actor-uuid`, already resolved. Registered here rather than in `chat.mjs` so the combat
 * cards stay one owner's business.
 * @type {Map<string, (context: {actor: Actor|null, button: HTMLButtonElement, root: HTMLElement|null, message: ChatMessage}) => Promise<unknown>>}
 */
export const cardActions = new Map();

/* -------------------------------------------- */
/*  Combatant: initiative                       */
/* -------------------------------------------- */

export class SwCombatant extends Combatant {
  /**
   * @inheritdoc
   * PHB v4.10: Initiative is Attribute Bonus + Proficiency Bonus + bonuses, with the helm penalty
   * (Closed helm -2, Open helm -1). Level never touches the die. The data model folds every term of
   * the default Constellation into `system.initiative.mod`; rolling with what you were actually
   * doing rolls that Constellation's two terms instead. Since 0.7.2 the typed modifiers the Party
   * Sheet's Begin the encounter wrote onto this Combatant (a Scout's +1 Situation for every other
   * member present, ruling 105) go on top, collapsed per type as every check is: two Scouts leave
   * two entries of one type, of which one applies. This is the tracker's die, and it asks the check
   * engine for the very total the dialog of `rollInitiativeWithCheck` would show (`previewTotal`
   * with the same Constellation and the same modifiers), so the two can never disagree: through
   * 0.7.1 this swapped the two Constellation terms by hand on `system.initiative.mod` and carried
   * the sheet's Awareness adjustment along into a Stealth roll, which the dialog did not.
   */
  _getInitiativeFormula() {
    const actor = this.actor;
    if (!actor) return "1d20";
    if (actor.type === "npc") return String(actor.system.thresholds?.initiative ?? 10);

    const mod = SwCheck.previewTotal(actor, {
      kind: "initiative",
      slug: this.initiativeConstellation,
      modifiers: this.initiativeModifiers.map(m => ({ ...m }))
    });
    return `1d20 ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`;
  }

  /**
   * Which Constellation this combatant is rolling Initiative with: the `initiativeConstellation`
   * flag (the tracker's "roll with", or since 0.7.2 the Activity's Constellation that Begin the
   * encounter wrote, ruling 105), else the actor's default, else Awareness. The data's token for
   * "the member's own pick" (SW.ACTIVITY_CHOICE, Investigate's row) is resolved before the flag is
   * written; a flag that still carries it reads the character's pick here, Awareness when there is
   * none, so no reader ever asks the proficiency of a word.
   */
  get initiativeConstellation() {
    const flagged = this.getFlag(SW.SYSTEM_ID, "initiativeConstellation");
    const actor = this.actor;
    // A slug nobody can name (a Lore deleted since it was chosen, a Constellation renamed) is not
    // rolled under a made-up name at Might +0: it reads as Awareness, as a blank pick does.
    const known = slug => !!slug && (!!actor?.system?.constellations?.[slug] || !!SW.constellations[slug]
      || Object.values(SW.DEFENSES).some(d => d.slug === slug));
    if (flagged === SW.ACTIVITY_CHOICE) {
      const pick = actor?.system.exploration?.constellation;
      return known(pick) ? pick : SW.DEFENSES.awareness.slug;
    }
    if (flagged) return known(flagged) ? flagged : SW.DEFENSES.awareness.slug;
    return actor?.system.initiative?.slug || SW.DEFENSES.awareness.slug;
  }

  /**
   * The typed modifiers this combatant's Initiative carries beyond its Constellation, as the Party
   * Sheet's Begin the encounter wrote them (0.7.2, ruling 105): `[{ label, value, type }]`, one
   * entry per Scout among the OTHER members ("Scout (Hrolda)", +1 Situation), or [] when nothing
   * was written. An entry with no number is dropped rather than rolled. The entries are the flag's
   * own objects, so a caller that hands them to the check engine copies them first.
   * @type {Array<{label: string, value: number, type?: string}>}
   */
  get initiativeModifiers() {
    const raw = this.getFlag(SW.SYSTEM_ID, "initiativeModifiers");
    if (!Array.isArray(raw)) return [];
    return raw.filter(m => m && Number.isNumeric(m.value));
  }
}

/* -------------------------------------------- */
/*  Combat                                      */
/* -------------------------------------------- */

export class SwCombat extends Combat {
  /**
   * Roll initiative, letting a player nominate the Constellation that matches what they were
   * actually doing when the world sped up.
   * @param {string[]} ids
   * @param {object} [options]
   * @param {string} [options.constellation]  Force a Constellation for every combatant rolled.
   */
  async rollInitiative(ids, options = {}) {
    if (options.constellation) {
      const updates = ids.map(id => ({
        _id: id,
        [`flags.${SW.SYSTEM_ID}.initiativeConstellation`]: options.constellation
      }));
      await this.updateEmbeddedDocuments("Combatant", updates);
    }
    return super.rollInitiative(ids, options);
  }

  /**
   * Roll Initiative for one combatant through the normal check pipeline, so the card shows the
   * Constellation, the modifiers, and any situational bonus.
   *
   * Since 0.7.2 both arguments default to what the Combatant carries (ruling 105; party-sheet-plan.md,
   * risk 10): the Constellation its `initiativeConstellation` flag names (the Activity's, written by
   * the Party Sheet's Begin the encounter; else the actor's default, Awareness) and the typed
   * modifiers its `initiativeModifiers` flag holds (a Scout's +1 Situation). A caller that names a
   * Constellation overrides the flag, as the tracker's "roll with" always has; one that passes
   * `modifiers` replaces the flag's list rather than adding to it. The card's subtitle names the
   * Constellation rolled, and the die is the one `_getInitiativeFormula` would throw.
   * @param {string} combatantId
   * @param {string|null} [slug]              The Constellation to roll with; null reads the flag.
   * @param {object} [options]
   * @param {Array|null} [options.modifiers]  Typed modifiers for the die; null reads the flag.
   */
  async rollInitiativeWithCheck(combatantId, slug = null, { modifiers = null } = {}) {
    const combatant = this.combatants.get(combatantId);
    const actor = combatant?.actor;
    if (!actor) return null;

    if (actor.type === "npc") {
      const value = actor.system.thresholds?.initiative ?? 10;
      await this.setInitiative(combatantId, value);
      return value;
    }

    slug ??= combatant.initiativeConstellation;
    modifiers ??= combatant.initiativeModifiers;
    const meta = actor.system.constellations?.[slug] ?? SW.getConstellation(slug);
    const result = await SwCheck.roll({
      actor,
      kind: "initiative",
      slug,
      label: game.i18n.localize("STARWROUGHT.Roll.initiative"),
      subtitle: meta.name,
      // Copies: the flag's own objects are the Combatant's data, and the check engine's dialog
      // marks what it applies.
      modifiers: modifiers.map(m => ({ ...m }))
    });
    if (!result) return null;
    await combatant.setFlag(SW.SYSTEM_ID, "initiativeConstellation", slug);
    await this.setInitiative(combatantId, result.total);
    return result.total;
  }

  /* -------------------------------------------- */
  /*  Opportunities                               */
  /* -------------------------------------------- */

  /** How many Passes in a row the table has made this round. */
  get passStreak() {
    if (game.users.activeGM) return Number(this.getFlag(SW.SYSTEM_ID, FLAG_STREAK)) || 0;
    return localStreaks.get(this.id) ?? 0;
  }

  /**
   * The combatants who get an Opportunity each circuit: everyone in the order, less the defeated
   * when the tracker is set to skip them. This is the count a full circuit of Passes has to reach.
   * @type {Combatant[]}
   */
  get opportunityHolders() {
    return this.settings.skipDefeated ? this.turns.filter(c => !c.isDefeated) : [...this.turns];
  }

  /**
   * @inheritdoc
   * PHB v4.10: "Initiative order is fixed for the encounter, and play cycles through it repeatedly."
   * The order wraps to its first combatant within the same round; only a full circuit of Passes (or
   * the GM's own Next Round) begins a new one. Core's version starts a new round at the end of the
   * order, which would hand out six fresh actions every circuit.
   */
  async nextTurn() {
    if (this.round === 0) return this.nextRound();
    const n = this.turns.length;
    if (!n) return this.nextRound();

    const turn = this.turn ?? -1;
    let next = null;
    for (let i = 1; i <= n; i++) {
      const index = (turn + i) % n;
      if (this.settings.skipDefeated && this.turns[index].isDefeated) continue;
      next = index;
      break;
    }
    // Nobody left standing: let core say so.
    if (next === null) return this.nextRound();
    // One combatant alone cycles to itself. Its Pass already ended the round in registerPass; any
    // other Next Turn is simply its next Opportunity in the same round, so the round does not move
    // and no fresh six are handed out. No update is written, so the Opportunity's housekeeping (a
    // raised shield coming down, a Prepared card) runs here on this client; ending the round for a
    // lone holder is an explicit Pass or the GM's Next Round.
    if (next === turn) {
      if (this.combatant) await beginOpportunity(this, this.combatant);
      return this;
    }

    const delta = Math.max(0, this.getTimeDelta(this.round, this.turn, this.round, next));
    const updateData = { round: this.round, turn: next };
    const updateOptions = { direction: 1, worldTime: { delta } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Pass ⓿: decline the Opportunity (PHB v4.10). The Pass is stamped on the Combatant, the pass
   * streak grows by one, and when it reaches the number of combatants who get an Opportunity the
   * round ends: `nextRound()` is called here and the streak resets with the new round.
   *
   * The streak lives on the Combat and is written by the elected client as the turn moves on, so
   * the count read here may be a beat behind; whichever client finds the circuit complete first
   * ends the round, and the other sees the round change and does nothing more.
   *
   * "You cannot Pass while Preparing." Announced, never prevented, like everything else.
   * @param {Combatant|Actor|string} combatant
   * @returns {Promise<boolean>}  True when this Pass ended the round. A caller that advances the
   *   turn itself must skip that when this is true; `pass()` does both in the right order.
   */
  async registerPass(combatant) {
    combatant = this.resolveCombatant(combatant);
    if (!combatant) return false;
    if (!this.started || (this.combatant?.id !== combatant.id)) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Combat.notOpportunity", { name: combatant.name }));
      return false;
    }
    const actor = combatant.actor;
    if (actor?.system?.actions?.preparing) await announcePassWhilePreparing(actor);

    await mark(combatant, MARK_PASSED, this);
    const needed = this.opportunityHolders.length;
    if (needed && ((this.passStreak + 1) >= needed)) {
      await this.nextRound();
      return true;
    }
    return false;
  }

  /**
   * A Maneuver that spends actions at the actor's own Opportunity breaks the circuit of Passes
   * (PHB v4.10: the round ends only when everyone Passes in a row). A Reaction between
   * Opportunities is not at the actor's own Opportunity, so it does not count, which is why the
   * combatant is checked against the current turn here rather than trusted.
   * @param {Combatant|Actor|string} combatant
   * @returns {Promise<boolean>}  True when the streak was reset.
   */
  async registerAction(combatant) {
    combatant = this.resolveCombatant(combatant);
    if (!combatant || !this.started || (this.combatant?.id !== combatant.id)) return false;
    await mark(combatant, MARK_ACTED, this);
    // The elected client settles the streak when the turn moves on; a GM can also drop it now so
    // the tracker reads right at once.
    if (game.user.isGM && this.passStreak) await this.setPassStreak(0);
    return true;
  }

  /**
   * The whole Pass Maneuver from the Combat's side: stamp it, end the round if the circuit is
   * complete, otherwise move to the next Opportunity. `SwActor#pass()` should call this.
   * @param {Combatant|Actor|string} combatant
   * @returns {Promise<boolean>}  True when the Pass ended the round.
   */
  async pass(combatant) {
    combatant = this.resolveCombatant(combatant);
    if (!combatant || !this.started || (this.combatant?.id !== combatant.id)) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Combat.notOpportunity", { name: combatant?.name ?? "?" }));
      return false;
    }
    const ended = await this.registerPass(combatant);
    if (!ended) await this.nextTurn();
    return ended;
  }

  /**
   * Write the streak. A GM writes the Combat flag; a player-run table keeps it in memory.
   * @param {number} value
   */
  async setPassStreak(value) {
    value = Math.max(0, Number(value) || 0);
    if (game.user.isGM) {
      if ((Number(this.getFlag(SW.SYSTEM_ID, FLAG_STREAK)) || 0) !== value) {
        await this.setFlag(SW.SYSTEM_ID, FLAG_STREAK, value);
      }
      return;
    }
    localStreaks.set(this.id, value);
    if (this.isView) ui.combat?.render();
  }

  /**
   * A Combatant from whatever the caller has in hand: the Combatant, its Actor (a token's synthetic
   * Actor included), or an id.
   * @param {Combatant|Actor|string} ref
   * @returns {Combatant|null}
   */
  resolveCombatant(ref) {
    if (!ref) return null;
    if (ref instanceof Combatant) return ref.combat === this ? ref : (this.combatants.get(ref.id) ?? null);
    if (typeof ref === "string") return this.combatants.get(ref) ?? null;
    if (ref instanceof Actor) return this.getCombatantsByActor(ref)[0] ?? null;
    return null;
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

let registered = false;

/**
 * Register the hooks that run the round: the pass streak, the six actions, Recovery at the start of
 * a round, Wind and Persistent Damage at its end, a Prepared Maneuver at its owner's Opportunity,
 * the tracker's Pass button and actions readout, and the buttons on the cards all of that posts.
 * Idempotent: `actions.mjs` calls it from `registerActionTracking`, and `starwrought.mjs` may too.
 */
export function registerCombatTracking() {
  if (registered) return;
  registered = true;

  Hooks.on("combatTurnChange", onTurnChange);
  Hooks.on("deleteCombat", onCombatEnds);
  Hooks.on("renderCombatTracker", onRenderTracker);
  Hooks.on("renderChatMessageHTML", onRenderCard);
  Hooks.on("updateActor", onActorChanged);

  cardActions.set("rollRecovery", onRollRecovery);
  cardActions.set("windCheck", onWindCheck);
  cardActions.set("windRest", onWindRest);
  cardActions.set("persistentRoll", onPersistentRoll);
  cardActions.set("persistentEndure", onPersistentEndure);
  cardActions.set("finishPrepared", onFinishPrepared);
  cardActions.set("abandonPrepared", onAbandonPrepared);
}

/* -------------------------------------------- */

/**
 * The turn moved. Every client hears this; the elected client counts, and each actor's responsible
 * client (the GM, or its first active owner when no GM is connected) writes to that actor.
 *
 * Three shapes: a new round (end the old one, start the new, then the first Opportunity), a rewind
 * (forget the streak, touch nothing else), or a step forward within the round (settle the
 * Opportunity that ended, then begin the one that starts).
 */
async function onTurnChange(combat, previous, current) {
  if (!(combat instanceof SwCombat) || !combat.started) return;
  try {
    const roundDelta = (current.round ?? 0) - (previous.round ?? 0);
    if (roundDelta < 0) {
      if (isElected()) await combat.setPassStreak(0);
      return;
    }
    if (roundDelta > 0) {
      if (previous.round > 0) await endRound(combat, previous.round);
      await startRound(combat, current.round);
    } else {
      if (!movedForward(combat, previous, current)) return;
      if (previous.combatantId && (previous.combatantId !== current.combatantId) && isElected()) {
        const ended = await settleOpportunity(combat, previous);
        // nextRound() is on its way; the turn change it causes does the rest.
        if (ended) return;
      }
    }
    const combatant = combat.combatants.get(current.combatantId);
    if (combatant) await beginOpportunity(combat, combatant);
  } catch (err) {
    console.error("STARWROUGHT | combat turn change failed", err);
  }
}

/**
 * Did the turn go forward? Within a round, forward is a higher turn index, or the wrap from the
 * last Opportunity holder to the first. Anything else is a GM rewinding, which settles nothing.
 */
function movedForward(combat, previous, current) {
  if ((current.turn === null) || (previous.turn === null)) return true;
  if (current.turn > previous.turn) return true;
  const holders = combat.opportunityHolders;
  if (!holders.length) return false;
  const first = combat.turns.indexOf(holders[0]);
  const last = combat.turns.indexOf(holders[holders.length - 1]);
  return (current.turn === first) && (previous.turn === last);
}

/* -------------------------------------------- */

/**
 * The Opportunity just ended: was it a Pass? Stamped Passes count; a stamped spend, or neither,
 * breaks the streak (a GM who clicks Next Turn for a monster that swung has not Passed for it: only
 * an explicit Pass counts, because a round ended early cannot be undone and one that runs long can
 * always be ended with Next Round). A combatant who cannot act at all (Defeated, Unconscious,
 * Dying) Passes by necessity.
 * @returns {Promise<boolean>}  True when the circuit completed and the round was ended.
 */
async function settleOpportunity(combat, previous) {
  const combatant = combat.combatants.get(previous.combatantId);
  const passed = didPass(combatant, previous);
  const streak = passed ? combat.passStreak + 1 : 0;
  await combat.setPassStreak(streak);
  const needed = combat.opportunityHolders.length;
  if (passed && needed && (streak >= needed)) {
    await combat.nextRound();
    return true;
  }
  return false;
}

function didPass(combatant, at) {
  if (!combatant) return false;
  const stamped = key => {
    const m = combatant.getFlag(SW.SYSTEM_ID, key);
    return !!m && (m.round === at.round) && (m.turn === at.turn);
  };
  if (stamped(MARK_ACTED)) return false;
  if (stamped(MARK_PASSED)) return true;
  return !canAct(combatant);
}

/** Can this combatant do anything at its Opportunity? Not if it is out of the fight or out cold. */
function canAct(combatant) {
  if (combatant.isDefeated) return false;
  // A party cannot act at all (0.7.0, risk 1): its Opportunity Passes by necessity, so a party
  // token in the tracker never breaks the circuit of Passes.
  if (combatant.actor?.type === SW.PARTY_TYPE) return false;
  const statuses = combatant.actor?.statuses;
  return !(statuses?.has("unconscious") || statuses?.has("dying"));
}

/** Stamp an Opportunity on a Combatant. Its owner may write the flag; a GM may write anyone's. */
async function mark(combatant, key, combat) {
  const value = { round: combat.round, turn: combat.turn };
  try {
    await combatant.setFlag(SW.SYSTEM_ID, key, value);
  } catch (err) {
    console.warn(`STARWROUGHT | could not stamp ${key} on ${combatant.name}`, err);
  }
}

/* -------------------------------------------- */

/**
 * The end of a round (PHB v4.10; Wind as PHB v4.13 has it):
 *  - Persistent Damage is taken at the end of each round, dice rolled fresh, Protection ignored.
 *  - Wind: at the end of every round, from the first (ruling 79; v4.11 and v4.12 waited for the
 *    third), a fighter carrying Load Strain 1 or more whose Endure Threshold is less than 10 +
 *    Load Strain rolls Endure against that number; on a failure their Fatigued rises by 1, to a
 *    maximum of 3. An Endure Threshold that meets the Wind Threshold is exempt and never rolls
 *    (ruling 74).
 * Both are cards with a roll button, whispered to the actor's owners and the GM.
 */
async function endRound(combat, round) {
  for (const actor of actorsIn(combat)) {
    if (!responsibleFor(actor)) continue;
    const statuses = actor.statuses ?? new Set();
    if (statuses.has("dead")) continue;

    // A Zone Exposed by a Posture stays Exposed "until the end of the round" and Recenter does not
    // clear it; the round's end does.
    if (typeof actor.clearPostureExposed === "function") await actor.clearPostureExposed();

    for (const source of persistentDamageOf(actor)) await postPersistentReminder(actor, source, round);

    if (round >= SW.WIND_ROUND) {
      const strain = Number(actor.system.loadStrain) || 0;
      const threshold = 10 + strain;
      const fatigued = Number(actor.conditionValue?.("fatigued")) || 0;
      // PHB v4.13, Wind (ruling 74): a fighter whose Endure Threshold meets 10 + Load Strain never
      // rolls. The character model derives `wind.exempt`; an adversary may lack the field, so the
      // comparison itself stands in. A fighter with no Load Strain has nothing to be winded by,
      // which is the book's own clause since v4.13 (ruling 80). Fatigued 3 is as winded as the rule
      // goes (ruling R3; until 0.6.0 one failure ended the checks), and the unconscious and the
      // Dying are out of the fight: nothing left to roll for.
      const exempt = actor.system.wind?.exempt ?? (endureThresholdOf(actor) >= threshold);
      if ((strain >= 1) && !exempt && (fatigued < SW.FATIGUED_MAX) && !statuses.has("unconscious") && !statuses.has("dying")) {
        await postWindReminder(actor, strain, round, fatigued);
      }
    }
  }
}

/**
 * The encounter ends: the Combat document is deleted. The pass streak a GM-less table kept in
 * memory goes with it, and nothing else happens here. Through 0.6.1 Fatigued came off every
 * combatant at this point, the end of the fight standing in for the "ten minutes of rest" that
 * end it (ruling 70); Mike's word (2026-10-02) is that it "should only go away with a 10 minutes'
 * rest", so the condition now outlives the Combat and is cleared by the Fatigued card's own
 * button (onWindRest) or by a night's rest (SwActor#restForTheNight), ruling 81.
 */
async function onCombatEnds(combat) {
  localStreaks.delete(combat.id);
}

/**
 * The start of a round (PHB v4.10): every combatant receives its actions (six, or the creature's
 * own count), the pass streak starts over, and each Dying character makes a Recovery check, which
 * "costs no action" and is made "at the start of each round while Dying".
 */
async function startRound(combat, round) {
  if (isElected()) await combat.setPassStreak(0);
  const remind = setting("autoRecovery", true);
  for (const actor of actorsIn(combat)) {
    if (!responsibleFor(actor)) continue;
    if (typeof actor.resetActions === "function") await actor.resetActions();
    if (remind && ((Number(actor.system.dying) || 0) > 0)) await postRecoveryReminder(actor, round);
  }
}

/**
 * An Opportunity begins (PHB v4.10):
 *  - Raise a Shield lasts "until your next Opportunity", so a raised shield comes down here.
 *  - A Prepared Maneuver must be finished or abandoned now; the card offers both and rolls nothing
 *    on its own, because finishing means checking range, line of effect and requirements again.
 */
async function beginOpportunity(combat, combatant) {
  const actor = combatant.actor;
  if (!actor?.system || !responsibleFor(actor)) return;

  // The trail of the last Opportunity's Moves goes when the next begins (Mike, 2026-10-01: "My past
  // Move trails should disappear when it is my opportunity to go again"). Core clears every
  // combatant's movement history when a turn starts, but only on the active GM's client and only
  // when the Combat document changed: a table with no GM connected, and a lone combatant whose
  // next Opportunity writes no update (nextTurn above), kept their trails. The responsible client
  // clears this combatant's own token here, which it may write; a second clear after core's is
  // free (0.5.3).
  const token = combatant.token;
  if (token?.isOwner && (token.movementHistory?.length > 0) && (typeof token.clearMovementHistory === "function")) {
    try {
      await token.clearMovementHistory();
    } catch (err) {
      console.warn("STARWROUGHT | the move trail could not be cleared", err);
    }
  }

  for (const shield of actor.items.filter(i => (i.type === "shield") && i.system.raised)) {
    await lowerShield(actor, shield);
  }

  const preparing = actor.system.actions?.preparing;
  if (preparing) await postPreparedCard(actor, preparing, combat);
}

/**
 * Lower a raised shield: the flag off, quietly, since every Opportunity would otherwise print a
 * card. Its Gear bonus to Guard is derived by the data model from `system.raised`, so nothing on
 * the actor needs writing back.
 */
async function lowerShield(actor, shield) {
  if (typeof shield.lower === "function") return shield.lower();
  await shield.update({ "system.raised": false });
}

/* -------------------------------------------- */
/*  Who does the writing                        */
/* -------------------------------------------- */

/**
 * Exactly one client counts for the Combat: the active GM when there is one, otherwise the active
 * user with the lowest id, which every client computes the same way.
 */
export function isElected() {
  const gm = game.users.activeGM;
  if (gm) return gm.id === game.user.id;
  const first = game.users.filter(u => u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  return first?.id === game.user.id;
}

/**
 * Exactly one client writes to an Actor: the active GM when there is one, otherwise the first
 * active owner in the user list.
 */
export function responsibleFor(actor) {
  if (!actor) return false;
  if (game.users.activeGM) return game.user.isActiveGM;
  const owner = game.users.find(u => u.active && actor.testUserPermission(u, "OWNER"));
  return owner?.id === game.user.id;
}

/** The distinct Actors in a combat, defeated included (the caller decides about those). */
function actorsIn(combat) {
  const seen = new Set();
  const out = [];
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor?.system || seen.has(actor.uuid)) continue;
    // A party is never a combatant (0.7.0, party-sheet-plan.md risk 1): no Wind, Recovery or reset
    // card is ever addressed to one, whatever token the GM dragged into the tracker.
    if (actor.type === SW.PARTY_TYPE) continue;
    seen.add(actor.uuid);
    out.push(actor);
  }
  return out;
}

/** A setting that may not be registered yet, read without throwing. */
export function setting(key, fallback) {
  try {
    return game.settings.get(SW.SYSTEM_ID, key);
  } catch {
    return fallback;
  }
}

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

const { escapeHTML } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/**
 * Build one of this module's cards. Every button carries `data-sw-combat`, which the
 * renderChatMessageHTML hook below binds to `cardActions`, and the root carries the actor the
 * buttons act for.
 * @param {object} spec
 * @param {string} spec.root            The card's own class, e.g. `sw-round-card`.
 * @param {string} [spec.actorUuid]     Who the buttons act for.
 * @param {string} [spec.glyph]         Action glyphs printed before the title.
 * @param {string} spec.title
 * @param {string[]} [spec.lines]       Body paragraphs (already escaped or trusted).
 * @param {string[]} [spec.notes]       Small print.
 * @param {Array<{action: string, label: string, icon?: string, data?: object}>} [spec.buttons]
 * @param {object} [spec.data]          Extra data attributes on the root.
 * @returns {string}
 */
export function cardHtml({ root, actorUuid = "", glyph = "", title, lines = [], notes = [], buttons = [], data = {} }) {
  const attr = (k, v) => ` data-${k}="${escapeHTML(String(v ?? ""))}"`;
  const rootAttrs = Object.entries(data).map(([k, v]) => attr(k, v)).join("");
  const body = lines.map(l => `<p>${l}</p>`).join("");
  const small = notes.filter(Boolean).map(n => `<p class="sw-card-note">${n}</p>`).join("");
  const row = buttons.length
    ? `<div class="sw-card-buttons">${buttons.map(b => `<button type="button" data-sw-combat="${escapeHTML(b.action)}"${
      Object.entries(b.data ?? {}).map(([k, v]) => attr(k, v)).join("")}>${
      b.icon ? `<i class="${escapeHTML(b.icon)}"></i> ` : ""}${b.label}</button>`).join("")}</div>`
    : "";
  return `<div class="starwrought action-card ${escapeHTML(root)}"${attr("actor-uuid", actorUuid)}${rootAttrs}>
    <h3>${glyph ? `${glyph} ` : ""}${title}</h3>${body}${small}${row}</div>`;
}

/** Every user who owns the actor, and every GM: the people a reminder about it belongs to. */
export function ownersOf(actor) {
  return game.users.filter(u => u.isGM || actor.testUserPermission(u, "OWNER")).map(u => u.id);
}

/**
 * Public for a player-controlled actor (a character, or anything a player owns), the GM's business
 * for an adversary: the system's usual split, and the one spendActions uses (Mike, 2026-10-01).
 */
export function tableFor(actor) {
  const theirs = actor.announcesSpends ?? actor.hasPlayerOwner;
  return theirs ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id);
}

/** Post a card spoken by an actor. */
export function postCard(actor, content, { whisper = [], rolls = [] } = {}) {
  const data = { speaker: ChatMessage.getSpeaker({ actor }), content, whisper };
  if (rolls.length) data.rolls = rolls;
  return ChatMessage.create(data);
}

/* -------------------------------------------- */

async function postRecoveryReminder(actor, round) {
  const dying = Number(actor.system.dying) || 0;
  const wounds = Number(actor.system.woundCount) || 0;
  const threshold = SW.RECOVERY_BASE + dying + wounds;
  const content = cardHtml({
    root: "sw-round-card sw-recovery-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Roll.recovery"),
    lines: [format("STARWROUGHT.Combat.recoveryText", {
      name: escapeHTML(actor.name), round, dying, wounds, threshold
    })],
    notes: [localize("STARWROUGHT.Combat.recoveryOutcomes"), localize("STARWROUGHT.Combat.recoveryHelp")],
    buttons: [{ action: "rollRecovery", icon: "fa-solid fa-heart-pulse", label: localize("STARWROUGHT.Combat.recoveryRoll") }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

/**
 * The Endure Threshold the Wind rule compares (PHB v4.12, ruling 74): the character model's own
 * reading when it has one, else the Defense as the sheet shows it, else the bare 10.
 */
function endureThresholdOf(actor) {
  const derived = Number(actor.system.wind?.endureThreshold);
  if (Number.isFinite(derived)) return derived;
  const shown = Number(actor.system.defenses?.endure?.threshold);
  return Number.isFinite(shown) ? shown : 10;
}

async function postWindReminder(actor, strain, round, fatigued = 0) {
  const threshold = 10 + strain;
  // The card says why it came: the Endure Threshold that fell short of the Wind Threshold.
  const endure = endureThresholdOf(actor);
  // What a failure would make of them: Fatigued 1, or one more than they carry now.
  const next = Math.min(SW.FATIGUED_MAX, fatigued + 1);
  const content = cardHtml({
    root: "sw-round-card sw-wind-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.wind"),
    lines: [format("STARWROUGHT.Combat.windText", { name: escapeHTML(actor.name), round, strain, threshold, endure, next })],
    notes: [
      fatigued ? format("STARWROUGHT.Combat.windCarrying", { name: escapeHTML(actor.name), value: fatigued }) : "",
      localize("STARWROUGHT.Combat.windNote")
    ],
    buttons: [{
      action: "windCheck", icon: "fa-solid fa-lungs",
      label: format("STARWROUGHT.Combat.endureVs", { threshold })
    }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

async function postPersistentReminder(actor, source, round) {
  const type = damageLabel(source.type);
  const lines = [format("STARWROUGHT.Combat.persistentText", {
    name: escapeHTML(actor.name), round, formula: escapeHTML(source.formula), type
  })];
  const notes = [localize("STARWROUGHT.Combat.persistentNote")];
  if (source.source === "torsoWound") notes.push(localize("STARWROUGHT.Combat.persistentWoundNote"));
  const content = cardHtml({
    root: "sw-round-card sw-persistent-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.persistent"),
    lines,
    notes,
    buttons: [{
      action: "persistentRoll", icon: "fa-solid fa-droplet",
      label: format("STARWROUGHT.Combat.persistentRoll", { formula: escapeHTML(source.formula), type }),
      data: { formula: source.formula, type: source.type, source: source.source ?? "" }
    }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

async function postPreparedCard(actor, preparing, combat) {
  const cost = Number(preparing.cost) || SW.PREPARED_THRESHOLD;
  const reserved = Number(actor.system.actions?.reserved) || Math.max(0, cost - 1);
  const label = preparing.label || (preparing.strike ? localize(SW.STRIKE_KINDS[preparing.strike]?.label ?? "STARWROUGHT.Roll.strike") : localize("STARWROUGHT.Condition.preparing"));
  const content = cardHtml({
    root: "sw-prepared-card",
    actorUuid: actor.uuid,
    glyph: SW.ACTION_GLYPHS[Math.min(6, cost)] ?? "",
    title: localize("STARWROUGHT.Condition.preparing"),
    lines: [format("STARWROUGHT.Combat.preparedText", {
      name: escapeHTML(actor.name), label: escapeHTML(label), cost, reserved, round: combat.round
    })],
    notes: [localize("STARWROUGHT.Combat.preparedNote")],
    buttons: [
      { action: "finishPrepared", icon: "fa-solid fa-check", label: localize("STARWROUGHT.Combat.preparedFinish") },
      { action: "abandonPrepared", icon: "fa-solid fa-xmark", label: localize("STARWROUGHT.Combat.preparedAbandon") }
    ]
  });
  // Preparation "is telegraphed by design", so the card is public; the buttons still check ownership.
  return postCard(actor, content);
}

async function announcePassWhilePreparing(actor) {
  const label = actor.system.actions.preparing?.label || localize("STARWROUGHT.Condition.preparing");
  const body = format("STARWROUGHT.Combat.passWhilePreparing", { name: escapeHTML(actor.name), label: escapeHTML(label) });
  ui.notifications.warn(body);
  return postCard(actor, cardHtml({
    root: "sw-overspend sw-pass-note",
    actorUuid: actor.uuid,
    title: `<i class="fa-solid fa-triangle-exclamation"></i> ${localize("STARWROUGHT.Actions.overTitle")}`,
    lines: [body],
    notes: [localize("STARWROUGHT.Actions.overNote")]
  }), { whisper: ownersOf(actor) });
}

/** A damage type's printed name. */
function damageLabel(type) {
  const key = SW.DAMAGE_TYPES[type]?.label;
  return key ? localize(key) : escapeHTML(String(type ?? ""));
}

/**
 * What is still hurting this actor, as `{type, formula, source?}` rows.
 *
 * The contract's data model carries no Persistent Damage field, so this reads, in order: an array,
 * map or string at `system.persistentDamage` (rows of `{type, formula}`, a `{type: formula}` map,
 * or "1d4 bleed"), the same shapes under `flags.starwrought.persistentDamage`, and then the one
 * source the engine itself creates: a Torso Wound. PHB v4.10's Wounds table makes the first Torso
 * Wound "Off-Guard, and 1d4 persistent bleed", every Wound short of the final one repeats it, and
 * the effect is "made lasting: it does not clear when you Recenter, only when the Wound is
 * treated". Ruling: the bleed runs at the end of every round while the Wound stands, and the
 * ordinary Endure check to end Persistent Damage does not close it; treating the Wound does.
 */
export function persistentDamageOf(actor) {
  const rows = [];
  const push = (type, formula, source) => {
    if (!formula) return;
    rows.push({ type: String(type || "untyped"), formula: String(formula).trim(), source });
  };
  const read = (raw, source) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (!row) continue;
        if (typeof row === "string") parseRow(row, source);
        else push(row.type, row.formula ?? row.amount ?? row.value, source);
      }
    } else if (typeof raw === "string") parseRow(raw, source);
    else if (typeof raw === "object") for (const [type, formula] of Object.entries(raw)) push(type, formula, source);
  };
  const parseRow = (text, source) => {
    const m = String(text).match(/^\s*([\dd+\-\s]+?)\s*(?:persistent\s+)?([a-z]+)?\s*$/i);
    if (m) push(m[2]?.toLowerCase() ?? "untyped", m[1], source);
  };

  read(actor.system.persistentDamage, "system");
  read(actor.getFlag?.(SW.SYSTEM_ID, "persistentDamage"), "flag");

  const torso = actor.system.zones?.torso;
  const wounds = Number(torso?.wounds) || 0;
  if ((wounds > 0) && !rows.some(r => r.type === "bleed")) {
    const capacity = Number(torso.capacity) || SW.WOUND_CAPACITY[actor.system.size] || 2;
    const bleeding = Math.min(wounds, Math.max(0, capacity - 1));
    const die = SW.TORSO_WOUND_BLEED.replace(/^\d+/, "");
    if (bleeding > 0) push("bleed", `${bleeding}${die}`, "torsoWound");
  }
  return rows;
}

/* -------------------------------------------- */
/*  Card buttons                                */
/* -------------------------------------------- */

function onRenderCard(message, html) {
  for (const button of html.querySelectorAll("[data-sw-combat]")) {
    button.addEventListener("click", event => onCardButton(event, message));
  }
}

async function onCardButton(event, message) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const handler = cardActions.get(button.dataset.swCombat);
  if (!handler) return;
  const root = button.closest("[data-actor-uuid]");
  const actor = await actorFromUuid(root?.dataset.actorUuid);
  button.disabled = true;
  try {
    await handler({ actor, button, root, message });
  } catch (err) {
    console.error(`STARWROUGHT | ${button.dataset.swCombat} failed`, err);
  } finally {
    button.disabled = false;
  }
}

/** The Actor behind a uuid, whether it names the Actor or its Token. */
export async function actorFromUuid(uuid) {
  if (!uuid) return null;
  const doc = await fromUuid(uuid);
  return doc?.actor ?? doc ?? null;
}

/** A card button acts for its actor's owner only. */
export function requireOwner(actor) {
  if (!actor) {
    ui.notifications.warn(localize("STARWROUGHT.Notify.noActor"));
    return false;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(localize("STARWROUGHT.Notify.notOwner"));
    return false;
  }
  return true;
}

async function onRollRecovery({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.rollRecovery !== "function") return;
  return actor.rollRecovery();
}

/**
 * Wind (PHB v4.13, Load and Load Strain): Endure against 10 + Load Strain, read live at the click,
 * and on a failure Fatigued raised by 1 to a maximum of 3: -N Condition to Evade, Guard and attack
 * rolls until ten minutes of rest. The exemption (an Endure Threshold that meets the Wind
 * Threshold, ruling 74) is applied where the card is posted, in endRound, not here: a card already
 * posted still rolls. The card names the new value and carries the "Ten minutes' rest" button that
 * ends the condition (onWindRest, ruling 81).
 */
async function onWindCheck({ actor }) {
  if (!requireOwner(actor)) return;
  const strain = Number(actor.system.loadStrain) || 0;
  const threshold = 10 + strain;
  const result = await SwCheck.roll({
    actor,
    kind: "check",
    slug: SW.DEFENSES.endure.slug,
    label: localize("STARWROUGHT.Combat.wind"),
    subtitle: format("STARWROUGHT.Combat.windSubtitle", { strain }),
    threshold,
    thresholdLabel: localize("STARWROUGHT.Combat.windThreshold")
  });
  if (!result) return;
  if (["fail", "critFail"].includes(result.degree)) {
    const current = Number(actor.conditionValue?.("fatigued")) || 0;
    const value = Math.min(SW.FATIGUED_MAX, current + 1);
    await actor.setCondition?.("fatigued", value);
    await postCard(actor, cardHtml({
      root: "sw-round-card sw-wind-card",
      actorUuid: actor.uuid,
      title: `${localize("STARWROUGHT.Condition.fatigued")} ${value}`,
      lines: [format("STARWROUGHT.Combat.windFatigued", { name: escapeHTML(actor.name), value })],
      notes: [
        (value >= SW.FATIGUED_MAX) ? localize("STARWROUGHT.Combat.windCeiling") : "",
        localize("STARWROUGHT.Combat.windRestNote")
      ],
      buttons: [{ action: "windRest", icon: "fa-solid fa-mug-hot", label: localize("STARWROUGHT.Combat.windRest") }]
    }), { whisper: tableFor(actor) });
  }
}

/**
 * Ten minutes' rest (PHB v4.13, Conditions: Fatigued "ends after ten minutes of rest"; ruling 81).
 * The system has no clock for ten minutes, and the end of the Combat is not one either (through
 * 0.6.1 it cleared Fatigued there, ruling 70, now superseded), so whether the ten minutes have
 * passed is the table's call: the Fatigued card carries this button for the actor's owner or the
 * GM (`requireOwner`; a GM owns everything). Fatigued comes off whole, whatever its value, and a
 * one-line card tells the same table the Fatigued card went to. A night's rest clears it too
 * (SwActor#restForTheNight). Clicked for an actor no longer Fatigued, it says so quietly and
 * writes nothing.
 */
async function onWindRest({ actor }) {
  if (!requireOwner(actor)) return;
  const current = Number(actor.conditionValue?.("fatigued")) || 0;
  if (!current) {
    ui.notifications.info(format("STARWROUGHT.Notify.notFatigued", { name: actor.name }));
    return;
  }
  await actor.setCondition?.("fatigued", false);
  return postCard(actor, cardHtml({
    root: "sw-round-card sw-wind-card sw-wind-rest-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.windRest"),
    lines: [format("STARWROUGHT.Combat.windRested", { name: escapeHTML(actor.name), value: current })]
  }), { whisper: tableFor(actor) });
}

/**
 * Persistent Damage (PHB v4.10): roll it fresh, Protection does not apply, then Endure against
 * 10 + the amount just taken to end it. The card names the amount; applying it is the owner's, on
 * the sheet, since the engine's damage pipeline is built around a Zone and its Protection.
 */
async function onPersistentRoll({ actor, button }) {
  if (!requireOwner(actor)) return;
  const formula = button.dataset.formula;
  const type = button.dataset.type || "untyped";
  if (!Roll.validate(formula)) {
    ui.notifications.warn(format("STARWROUGHT.Combat.persistentBadFormula", { formula }));
    return;
  }
  const roll = await new Roll(formula).evaluate();
  const total = roll.total;
  const fromWound = button.dataset.source === "torsoWound";
  const threshold = 10 + total;
  const buttons = fromWound ? [] : [{
    action: "persistentEndure", icon: "fa-solid fa-shield-heart",
    label: format("STARWROUGHT.Combat.endureVs", { threshold }),
    data: { threshold, type }
  }];
  const content = cardHtml({
    root: "sw-round-card sw-persistent-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.persistent"),
    lines: [format("STARWROUGHT.Combat.persistentTaken", { name: escapeHTML(actor.name), total, type: damageLabel(type) })],
    notes: [
      fromWound ? localize("STARWROUGHT.Combat.persistentWoundNote") : format("STARWROUGHT.Combat.persistentEndNote", { threshold }),
      localize("STARWROUGHT.Combat.persistentApplyNote")
    ],
    buttons
  });
  return postCard(actor, content, { rolls: [roll], whisper: tableFor(actor) });
}

async function onPersistentEndure({ actor, button }) {
  if (!requireOwner(actor)) return;
  const threshold = Number(button.dataset.threshold) || 10;
  const result = await SwCheck.roll({
    actor,
    kind: "check",
    slug: SW.DEFENSES.endure.slug,
    label: localize("STARWROUGHT.Combat.persistentEndure"),
    subtitle: damageLabel(button.dataset.type || "untyped"),
    threshold,
    thresholdLabel: localize("STARWROUGHT.Combat.persistentThreshold")
  });
  if (!result) return;
  if (["success", "critSuccess"].includes(result.degree)) {
    ui.notifications.info(format("STARWROUGHT.Combat.persistentEnded", { name: actor.name, type: damageLabel(button.dataset.type || "untyped") }));
  }
}

async function onFinishPrepared({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.finishPrepared !== "function") {
    ui.notifications.warn(localize("STARWROUGHT.Combat.preparedNoMethod"));
    return;
  }
  return actor.finishPrepared();
}

async function onAbandonPrepared({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.abandonPrepared !== "function") {
    ui.notifications.warn(localize("STARWROUGHT.Combat.preparedNoMethod"));
    return;
  }
  return actor.abandonPrepared();
}

/* -------------------------------------------- */
/*  The tracker                                 */
/* -------------------------------------------- */

/**
 * Under each combatant's name, the actions it has left (and anything reserved for a Prepared
 * Maneuver); beside its controls, a Pass button for its owner, live only at its own Opportunity;
 * beside the round, the pass streak. Injected into core's rows rather than replacing its template,
 * as the targeting line is, so a Foundry update that reshapes the tracker is a one-line fix.
 */
function onRenderTracker(app, element) {
  const combat = app.viewed ?? game.combat;
  if (!(combat instanceof SwCombat)) return;

  if (combat.started) {
    const title = element.querySelector(".encounter-title");
    if (title) {
      // A partial re-render of the rows leaves the header standing, so replace rather than skip.
      title.querySelector(".sw-pass-streak")?.remove();
      const span = document.createElement("span");
      span.className = "sw-pass-streak";
      span.dataset.tooltip = localize("STARWROUGHT.Tracker.passStreakHint");
      span.textContent = format("STARWROUGHT.Tracker.passStreak", {
        n: combat.passStreak, of: combat.opportunityHolders.length
      });
      title.append(" ", span);
    }
  }

  for (const li of element.querySelectorAll("li.combatant[data-combatant-id]")) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    const actor = combatant?.actor;
    if (!actor?.system) continue;
    // A party is never a combatant (0.7.0, risk 1): no actions readout, no Pass button.
    if (actor.type === SW.PARTY_TYPE) continue;

    const actions = actor.system.actions;
    if (actions && combat.started && !li.querySelector(".sw-tracker-actions")) {
      li.querySelector(".token-name")?.append(actionsReadout(actor, actions));
    }

    if (combatant.isOwner && combat.started && !li.querySelector(".sw-pass")) {
      const controls = li.querySelector(".combatant-controls");
      if (!controls) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inline-control combatant-control icon fa-solid fa-hand sw-pass";
      const live = combat.combatant?.id === combatant.id;
      button.disabled = !live;
      button.dataset.tooltip = live
        ? localize("STARWROUGHT.Tracker.pass")
        : format("STARWROUGHT.Combat.notOpportunity", { name: combatant.name });
      button.setAttribute("aria-label", localize("STARWROUGHT.Tracker.pass"));
      // No data-action: the row itself is core's "activate this combatant" control, and the click
      // must not reach it.
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        onPassClick(combat, combatant);
      });
      const effects = controls.querySelector(".token-effects");
      if (effects) controls.insertBefore(button, effects);
      else controls.append(button);
    }
  }
}

/**
 * The line under the name: actions left as a large number over the round's count, with a pip per
 * action (lit while unspent), plus what is reserved and what is Preparing. It was one small
 * circled glyph until 0.5.3 (Mike: "# actions remaining in combat tracker are very small/hard to
 * read"); the pips are the sheet's, so the two readouts agree at a glance.
 */
function actionsReadout(actor, actions) {
  const line = document.createElement("div");
  line.className = "sw-tracker-actions";
  const value = Math.max(0, Number(actions.value) || 0);
  const per = Number(actor.system.actionsPerRound) || SW.ACTIONS_PER_ROUND;
  line.dataset.tooltip = format("STARWROUGHT.Tracker.actionsLeft", { value, per });
  if (!value) line.classList.add("sw-none");

  const count = document.createElement("span");
  count.className = "sw-tracker-actions-left";
  count.textContent = String(value);
  const of = document.createElement("span");
  of.className = "sw-tracker-actions-of";
  of.textContent = `/${per}`;
  count.append(of);
  line.append(count);

  const pips = document.createElement("span");
  pips.className = "sw-tracker-pips";
  for (let i = 0; i < Math.min(per, 12); i++) {
    const pip = document.createElement("i");
    pip.className = `sw-tracker-pip${i < value ? " sw-lit" : ""}`;
    pips.append(pip);
  }
  line.append(pips);

  const reserved = Number(actions.reserved) || 0;
  if (reserved) {
    const held = document.createElement("span");
    held.className = "sw-tracker-actions-reserved";
    held.textContent = format("STARWROUGHT.Tracker.reserved", { n: reserved });
    line.append(" ", held);
  }
  if (actions.preparing) {
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-hourglass-half sw-tracker-preparing";
    icon.dataset.tooltip = format("STARWROUGHT.Tracker.preparing", {
      label: actions.preparing.label || localize("STARWROUGHT.Condition.preparing")
    });
    line.append(" ", icon);
  }
  return line;
}

/** The tracker's Pass: the Actor's own Pass when it has one (it may have things to tidy), else the Combat's. */
async function onPassClick(combat, combatant) {
  const actor = combatant.actor;
  try {
    if (typeof actor?.pass === "function") return await actor.pass();
    return await combat.pass(combatant);
  } catch (err) {
    console.error("STARWROUGHT | Pass failed", err);
    ui.notifications.error(localize("STARWROUGHT.Combat.passFailed"));
  }
}

/** The readout is live: an actor spending actions re-renders its row. */
function onActorChanged(actor, changes) {
  const combat = game.combat;
  if (!combat?.started || !combat.isView) return;
  if (!foundry.utils.hasProperty(changes, "system.actions")) return;
  if (combat.getCombatantsByActor(actor).length) ui.combat?.render();
}
