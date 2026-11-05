/**
 * Encounter Mode, as the Combat document runs it: the two documents (`SwCombatant`, `SwCombat`)
 * and the hooks that move the round.
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
 *
 * What left this file in 0.10.1, and where it went:
 *  - the cards the round posts (Recovery, Wind, Persistent Damage, a Prepared Maneuver) and their
 *    buttons: `documents/cards/round.mjs`;
 *  - the card builder, the whisper lists and the `data-sw-combat` button binding every system card
 *    shares: `helpers/cards.mjs`;
 *  - the election (`isElected`, `responsibleFor`): `helpers/authority.mjs`; the safe settings read
 *    (`setting`): `helpers/settings.mjs`;
 *  - the tracker's readout and Pass button: `apps/combat-tracker.mjs`.
 * This file reads the first three and is read by the fourth.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { isElected, responsibleFor } from "../helpers/authority.mjs";
import { setting } from "../helpers/settings.mjs";
import { registerCardButtons } from "../helpers/cards.mjs";
import {
  registerRoundCards, postRecoveryReminder, postWindReminder, postPersistentReminder, postPreparedCard,
  announcePassWhilePreparing, persistentDamageOf, endureThresholdOf
} from "./cards/round.mjs";

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
 * The buttons on those cards are bound by `registerCardButtons` (helpers/cards.mjs) and handled by
 * `registerRoundCards` (documents/cards/round.mjs); the tracker's readout is registered by
 * `starwrought.mjs` itself (`registerTrackerReadout` in apps/combat-tracker.mjs), since that module
 * imports `SwCombat` from here and a registration from here would close a circle.
 * Idempotent: `movement.mjs` calls it from `registerMovementTracking`, and `starwrought.mjs` may too.
 */
export function registerCombatTracking() {
  if (registered) return;
  registered = true;

  Hooks.on("combatTurnChange", onTurnChange);
  Hooks.on("deleteCombat", onCombatEnds);
  registerCardButtons();
  registerRoundCards();
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
