/**
 * The Actor document.
 *
 * Everything a character does at the table is a method here: rolling a check, answering a blow,
 * settling Position, Recentering, taking a Wound, going down, and coming back. The rules
 * arithmetic lives in the data model; this class is the verbs.
 *
 * PHB v4.10 vocabulary, as the code uses it: six actions a round, spent across Opportunities;
 * a Strike is Quick ❶, Deliberate ❷ or Committed ❸ (Prepared); a Reaction is paid from the same
 * six; Vigor is what stands between a blow and the body, Spent is 0 Vigor, Wounds are per Zone,
 * and Dying begins when the Torso or the Head carries its final Wound.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { SwDamage } from "../dice/damage.mjs";
import { gapBetween } from "../canvas/geometry.mjs";
import { enabledConstellations } from "../helpers/content.mjs";
import { postureName as postureNameOf } from "../helpers/answers.mjs";
import { AttackCoordinator } from "../combat/attack-coordinator.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

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

/**
 * Is the attack flow on? The world setting is registered by starwrought.mjs (default on); read
 * defensively so a build without it, or a read before init, Strikes at once exactly as 0.4.2 did.
 * @returns {boolean}
 */
function attackFlowOn() {
  try {
    return !!game.settings.get(SW.SYSTEM_ID, "attackFlow");
  } catch {
    return false;
  }
}

/** Names compared the way a player types them: case and stray spaces do not count. */
const sameName = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

export class SwActor extends Actor {
  /* -------------------------------------------- */
  /*  Lookups                                     */
  /* -------------------------------------------- */

  /**
   * The Actor behind a uuid, whether the uuid names an Actor or a Token.
   * @param {string} uuid
   * @returns {Actor|null}
   */
  static resolveActor(uuid) {
    if (!uuid) return null;
    const doc = fromUuidSync(uuid);
    if (!doc) return null;
    if (doc.documentName === "Actor") return doc;
    return doc.actor ?? null;
  }

  /* -------------------------------------------- */
  /*  Conditions                                  */
  /* -------------------------------------------- */

  /**
   * The value of a numeric condition (Frightened 2, Slowed 1), or 0 if it is not on you. Wounded
   * reads the Wounds carried across every Zone (PHB v4.10: Wounds are per Zone, not a number).
   * @param {string} id  A key of SW.CONDITIONS.
   * @returns {number}
   */
  conditionValue(id) {
    if (id === "wounded") return this.woundCount;
    if (id === "dying") return this.system.dying ?? 0;
    if (!this.statuses?.has(id)) return 0;
    for (const effect of this.effects) {
      if (!effect.statuses?.has(id)) continue;
      const value = effect.getFlag(SW.SYSTEM_ID, "value");
      if (Number.isNumeric(value)) return Number(value);
    }
    return 1;
  }

  /**
   * Put a condition on, take it off, or set its value.
   *
   * One condition, one effect (0.5.1). Writes to one actor's conditions are run one after another
   * on this client, so a second call finds what the first created instead of creating its own; the
   * effect is created under the condition's static id (SW.statusEffectId), the id Foundry's token
   * palette creates and looks for, so a status set by the rules and one toggled from the token are
   * the same document and a create that loses a race with another client fails on the id rather
   * than landing a twin; and any twin that exists anyway (an older release's) is removed on the
   * way through.
   * @param {string} id
   * @param {number|boolean} [value]  A number for numeric conditions, true/false otherwise.
   * @param {object} [data]  Effect data to carry on it (name, description, origin, flags); applied
   *                         on creation and to an effect already there.
   * @returns {Promise<ActiveEffect|null>}  The effect carrying the condition, or null when off.
   */
  async setCondition(id, value = true, data = {}) {
    const config = SW.CONDITIONS[id];
    if (!config) return null;
    const prior = SwActor.#conditionWrites.get(this.uuid) ?? Promise.resolve();
    const run = prior.catch(() => null).then(() => this.#writeCondition(id, value, data));
    SwActor.#conditionWrites.set(this.uuid, run);
    try {
      return await run;
    } finally {
      if (SwActor.#conditionWrites.get(this.uuid) === run) SwActor.#conditionWrites.delete(this.uuid);
    }
  }

  /** Actor uuid -> the condition write in flight on this client, so they queue (see setCondition). */
  static #conditionWrites = new Map();

  /** One queued condition write; the rules are in setCondition's note. */
  async #writeCondition(id, value, data) {
    const config = SW.CONDITIONS[id];
    const staticId = SW.statusEffectId(id);
    // Foundry's own ownership rule for a status: the effect under its static id, or a single-status
    // effect. An authored effect carrying several statuses (a net that is Prone and Restrained
    // with a Speed change) is the GM's and is never deleted as a twin (review, 2026-10-01).
    const ours = e => e.statuses?.has(id) && ((e.id === staticId) || (e.statuses.size === 1));
    const matching = this.effects.filter(ours);
    const off = (value === false) || (config.numeric && Number(value) <= 0);

    if (off) {
      if (matching.length) await this.deleteEmbeddedDocuments("ActiveEffect", matching.map(e => e.id));
      return null;
    }

    // The one under the static id is the one the palette knows; any other goes.
    matching.sort((a, b) => (a.id === staticId ? -1 : 0) - (b.id === staticId ? -1 : 0));
    const [existing, ...twins] = matching;
    if (twins.length) await this.deleteEmbeddedDocuments("ActiveEffect", twins.map(e => e.id));

    const update = foundry.utils.deepClone(data ?? {});
    if (config.numeric) {
      const n = Number(value) || 1;
      update.name ??= `${game.i18n.localize(config.name)} ${n}`;
      foundry.utils.setProperty(update, `flags.${SW.SYSTEM_ID}.value`, n);
    }
    if (existing) {
      if (!foundry.utils.isEmpty(update)) await existing.update(update);
      return existing;
    }

    const source = foundry.utils.mergeObject({
      _id: staticId, name: game.i18n.localize(config.name), img: config.img, statuses: [id]
    }, update);
    try {
      const [created] = await this.createEmbeddedDocuments("ActiveEffect", [source], { keepId: true });
      return created ?? this.effects.get(staticId) ?? null;
    } catch (err) {
      // Another client got there first under the same id: that effect is the one to keep.
      const theirs = this.effects.get(staticId) ?? this.effects.find(ours);
      if (!theirs) throw err;
      return theirs;
    }
  }

  /* -------------------------------------------- */
  /*  Body                                        */
  /* -------------------------------------------- */

  /** Wounds carried across every Zone. Recovery and Treat Wound Thresholds count them all. */
  get woundCount() {
    if (Number.isNumeric(this.system.woundCount)) return this.system.woundCount;
    return Object.values(this.system.zones ?? {}).reduce((n, z) => n + (z?.wounds ?? 0), 0);
  }

  /**
   * How many Wounds a Zone carries before its final effect: Medium or smaller 2, Large 3, Huge 4,
   * Gargantuan 5, plus whatever a creature template adds (PHB v4.10, Wound capacity).
   * @param {string} zone
   * @returns {number}
   */
  woundCapacity(zone) {
    const derived = this.system.woundCapacity?.(zone);
    if (Number.isNumeric(derived)) return derived;
    return (SW.WOUND_CAPACITY[this.system.size] ?? 2) + (this.system.woundBonus ?? 0);
  }

  /**
   * The rigid implement in hand, if any: what a Guard forms a Bind with and what a Parry needs.
   * A shield counts, raised or not; a weapon counts unless it is Flexible or a bare hand
   * (PHB v4.10, The Bind: "a bare hand or a Flexible weapon can Guard, but cannot Bind"). An
   * adversary's profile decides for it, so an adversary is assumed to have one: the card offers
   * the Bind and the GM confirms.
   * @returns {{name: string, shield?: boolean, raised?: boolean, assumed?: boolean}|null}
   */
  get rigidImplement() {
    if (this.type !== "character") return { name: "", assumed: true };
    // The data model's own answer, when it has one, wins over the item scan below.
    if (this.system.reactions?.rigid === false) return null;
    const shield = this.items.find(i => (i.type === "shield") && i.system.held);
    if (shield) return { name: shield.name, shield: true, raised: !!shield.system.raised };
    const isRigid = i => (typeof i.system.rigid === "boolean") ? i.system.rigid : !i.system.flags?.flexible;
    const weapon = this.items.find(i => (i.type === "weapon") && i.system.held
      && isRigid(i)
      && !/natural/i.test(i.system.group ?? ""));
    return weapon ? { name: weapon.name } : null;
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * Actor#getRollData returns the live system object, so this builds a plain copy instead: a
   * roll formula must never be able to write back onto the character. Active Effects also ask
   * for roll data during prepareEmbeddedDocuments, before the derived pass, so every derived
   * value read here has to survive being asked too early.
   */
  getRollData() {
    const sys = this.system;
    const data = sys.toObject();
    data.level = sys.level ?? 1;
    if (this.type !== "character") return data;
    for (const [key, attr] of Object.entries(sys.attributes ?? {})) data[key] = attr.mod ?? 0;
    data.spec = sys.melee?.specialization ?? 0;
    data.rangedSpec = sys.ranged?.specialization ?? 0;
    data.dice = sys.weaponDice ?? 1;
    data.loadStrain = sys.loadStrain ?? 0;
    data.wounds = this.woundCount;
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Roll a check in a Constellation. Untrained is a real answer, not an error.
   * @param {string} slug
   * @param {object} [options]
   */
  async rollCheck(slug, options = {}) {
    const meta = this.system.constellations?.[slug] ?? SW.getConstellation(slug);
    return SwCheck.roll(foundry.utils.mergeObject({
      actor: this,
      kind: "check",
      slug,
      label: meta.name,
      subtitle: game.i18n.localize("STARWROUGHT.Roll.check")
    }, options, { inplace: false }));
  }

  /**
   * Roll a Relevant Check.
   *
   * The handbook's term (Mike, 2026-09-26) for a roll whose Constellation is the actor's to
   * choose, subject to their justification and the GM's approval: Aid is written with it, and
   * initiative-by-activity has always worked this way. The system's part is to make the choice
   * visible rather than to police it: the actor picks from every Constellation, Untrained ones
   * included (Untrained is a real answer, at +0 Proficiency), says why, and the card names both.
   * The roll itself is an ordinary check in that Constellation, so a critical can Flare it.
   * @param {object} [options]  Passed through to the roll. `threshold` prefills the picker.
   */
  async rollRelevantCheck(options = {}) {
    if (this.type !== "character") {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Roll.relevantNpc"));
      return null;
    }
    const sys = this.system;
    // The number beside each Constellation is the one the roll dialog will open with, computed
    // by the check engine itself, so Load Strain on a Might check or a Frightened value shows
    // here and ranks the list the way the dice will see it.
    const row = (slug, name, rank, attribute) => ({
      slug,
      name,
      rank,
      rankLabel: game.i18n.localize(SW.RANKS[rank].label),
      glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "",
      mod: SwCheck.previewTotal(this, { kind: "check", slug }),
      trained: rank !== "untrained"
    });

    // Every Constellation that ships (Enabled? = Yes, ruling 61), at this character's rank in it;
    // the character's own Constellations are added below, so an owned one that has since been
    // disabled still appears. The Lore template is not itself rollable; the Lores this character
    // has opened are on the character.
    const rows = enabledConstellations()
      .filter(c => c.slug && (c.slug !== "lore"))
      .map(c => {
        const p = sys.proficiency(c.slug);
        return row(c.slug, p.name ?? c.name, p.rank, p.attribute);
      });
    for (const [slug, con] of Object.entries(sys.constellations ?? {})) {
      if (rows.some(r => r.slug === slug)) continue;
      rows.push(row(slug, con.name, con.rank, con.attribute));
    }
    rows.sort((a, b) => (Number(b.trained) - Number(a.trained)) || (b.mod - a.mod) || a.name.localeCompare(b.name));

    const content = await renderTemplate("systems/starwrought/templates/dice/relevant-check.hbs", {
      trained: rows.filter(r => r.trained),
      untrained: rows.filter(r => !r.trained),
      threshold: Number.isNumeric(options.threshold) ? options.threshold : ""
    });
    const answer = await DialogV2.wait({
      window: { title: game.i18n.localize("STARWROUGHT.Roll.relevantCheck"), icon: "fa-solid fa-scale-balanced" },
      classes: ["starwrought", "check-dialog"],
      position: { width: 460 },
      content,
      buttons: [
        { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
          callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel") || !answer.slug) return null;

    const chosen = rows.find(r => r.slug === answer.slug);
    if (!chosen) return null;
    const why = String(answer.why ?? "").trim();
    const opts = {
      ...options,
      label: game.i18n.localize("STARWROUGHT.Roll.relevantCheck"),
      // The card's subtitle is the approval surface: which Constellation, and the reason given.
      subtitle: why ? `${chosen.name}: ${why}` : chosen.name
    };
    if (Number.isNumeric(answer.threshold)) opts.threshold = Number(answer.threshold);
    return this.rollCheck(chosen.slug, opts);
  }

  /* -------------------------------------------- */

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

  /* -------------------------------------------- */

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
   *                                       ❶↺ instead of the Strike's cost; "counter" and "riposte"
   *                                       were paid by the Reaction that granted them. All three
   *                                       are Quick Strikes.
   * @param {string} [options.defense]     Force the Defense answering (a Talent that targets Awareness).
   * @param {boolean} [options.blind]      The attack flow's roll (0.5.0 brief): everything is
   *                                       assembled as usual (Handling, Support, Unwieldy, the
   *                                       range note, the spend) but the defender is not read at
   *                                       all, no Threshold is known, the Strike is locked, and
   *                                       nothing posts; the result comes back for the coordinator
   *                                       to resolve against each defender.
   *
   * With the world setting `attackFlow` on and at least one target with an actor, a Strike that
   * is not itself a Reaction and not about to Prepare does not roll: it is DECLARED through the
   * AttackCoordinator, and the die is thrown at the roll step once every defender has committed
   * (brief, Entry points). With the setting off, or no target, the Strike rolls at once as 0.4.2.
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

    // A Strike made as a Reaction (Intercept, Counter, the riposte) is always a Quick Strike. Only
    // Intercept pays here; Counter's ❶↺ is charged when the attack it answers resolves, and the
    // riposte is ⓿.
    const reactionStrike = ["intercept", "counter", "riposte"].includes(asReaction) ? asReaction : null;
    const strike = reactionStrike ? "quick" : (SW.STRIKE_KINDS[askedStrike] ? askedStrike : SW.DEFAULT_STRIKE);
    const free = askedFree || ["counter", "riposte"].includes(reactionStrike);
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

    // Declaring (brief, Entry points): the flow is on, this Strike is a Maneuver of the attacker's
    // own (not a Counter, an Intercept or the riposte, which answer a Blow already declared), and
    // it is not the flow's own blind roll. The targets are snapshotted now: every token the user
    // has targeted, or the one the caller named. With several, the first stands in as the
    // reference for reach and the thrown inference below.
    const declaring = attackFlowOn() && !blind && !reactionStrike;
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
      const pub = await AttackCoordinator.declare({ attacker: this, weaponId, strike: kindKey, targets, prepared, free, thrown });
      if (pub && !paid) {
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

    // The Strike Attribute: the higher of the weapon's natural Attribute and the Key Attribute of
    // a Combat Style whose root you own and whose weapon this is (PHB v4.10, The Attack).
    const strikeAttribute = this.system.strikeAttributeFor?.(weapon)
      ?? { attribute: weapon.system.attackAttribute, source: "weapon" };

    // The defender decides how to answer. Their stance is that decision, made in advance and
    // changeable until the die leaves the hand, so the roll reads it rather than asking the
    // attacker: the dialog shows it and offers no choice. A caller may still force a Defense (a
    // Talent that targets Awareness, say); otherwise the defender's answer is read again at the
    // moment of the roll, Reaction included. The answer is read against this threat: a Counter
    // stance answers only a melee Blow from within Reach, so it is told whether the Blow is
    // ranged and how far it came.
    //
    // A Reaction never triggers another Reaction (PHB v4.10, Answering an Attack): a Counter,
    // an Intercept or the riposte meets the target's basic Defense only, with nothing behind
    // it and nothing charged to them. answeringDefense() already names that basic Defense
    // (Parry -> Guard, Void -> Evade, Counter -> the better of the two, Grabbed swap applied);
    // SwCheck.thresholdOf reads it without the Reaction's +2, and treating it as forced keeps
    // the roll-time re-read, the charge and the Counter offer all out of it.
    //
    // The flow's blind roll reads nothing of the defender (brief): the commitments are the
    // coordinator's, revealed and read there. The dialog still names the target and says the
    // answer is theirs to reveal, which is exactly true.
    const forced = options.defense !== undefined || !!reactionStrike;
    const answering = (blind ? null : targetActor?.answeringDefense?.({ ranged, gap })) ?? null;
    const defense = options.defense ?? answering?.key ?? "evade";
    const target = (!blind && targetToken) ? SwCheck.thresholdOf(targetToken, defense) : null;
    const targetDefense = !targetActor ? null
      : blind ? { key: null, label: "", threshold: null, unavailable: null, hidden: true }
      : forced
        ? { key: defense, label: game.i18n.localize(SW.DEFENSES[defense].label), threshold: target?.threshold ?? 10, unavailable: null }
        : answering;
    // Why the Defense met is not the stance: swapped by a condition (Evade while Grabbed), or a
    // Reaction set aside because this Strike is itself a Reaction. A caller who forced the
    // Defense has its own reason and gets no note.
    const defenseNote = ((options.defense !== undefined) || blind) ? null
      : (answering?.unavailable
        ?? ((reactionStrike && answering?.reaction) ? game.i18n.localize("STARWROUGHT.Reaction.basicOnly") : null));

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
    const controlledWeapon = (bind?.state === "controlled") && sameName(bind.mine, weapon.name);
    if (controlledWeapon) {
      modifiers.push({
        label: game.i18n.format("STARWROUGHT.Roll.controlledWeapon", { weapon: weapon.name }),
        value: SW.CONTROLLED_PENALTY,
        type: "situation"
      });
    }

    const kindLabel = key => `${game.i18n.localize(SW.STRIKE_KINDS[key].label)} ${SW.ACTION_GLYPHS[SW.STRIKE_KINDS[key].cost]}`;
    const reactionLabel = reactionStrike
      ? ` · ${game.i18n.localize(reactionStrike === "riposte" ? "STARWROUGHT.Reaction.riposte" : SW.REACTIONS[reactionStrike].label)}`
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
      label: weapon.name,
      subtitle: subtitleFor(strike),
      strike,
      // The declared Strike is locked at the roll step, as a paid one always was.
      lockStrike: paid || !!reactionStrike || blind,
      prepared,
      asReaction: reactionStrike,
      modifiers,
      threshold: target?.threshold ?? null,
      thresholdLabel: target?.label ?? "",
      // The blind roll passes no target to the engine: #readDefender has nothing to read.
      targetUuid: blind ? "" : (target?.uuid ?? ""),
      targetDefense,
      defenseForced: forced,
      defenseNote,
      // What the defender is answering, for the roll-time re-read of their stance.
      threat: { ranged, gap },
      rangeNote,
      reaction: forced ? null : (answering?.reaction ?? null),
      reactionNote: forced ? null : (answering?.note ?? null),
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
        if (reactionStrike === "intercept") {
          // Intercept ❶↺: the Reaction's own cost, in place of the Strike's.
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
        if (bind?.state && bind.mine && !sameName(bind.mine, weapon.name)) await this.endBind();
        return true;
      },

      // The blow has resolved. The defender's Reaction is paid now (their stance falls back to
      // its basic Defense), a Bind between the two ends, and a Controller struck by a third party
      // loses the line. Writes land only where this client owns the actor; the card offers the
      // rest to whoever does.
      afterRoll: async result => {
        const cfg = result.config;
        if (cfg.reaction && cfg.defender) {
          cfg.reactionCharged = await SwCheck.chargeReaction(cfg.defender, cfg.reaction);
        }
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
   * This actor's token on the current scene: the one you have selected if it is one of yours,
   * otherwise the first. Null when the actor is not on the map, in which case nothing that needs a
   * distance applies.
   * @returns {TokenDocument|null}
   */
  tokenOnScene() {
    if (this.isToken) return this.token;
    const docs = this.getActiveTokens(false, true);
    return docs.find(d => d.object?.controlled) ?? docs[0] ?? null;
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

  /* -------------------------------------------- */

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

  /* -------------------------------------------- */
  /*  Wounds, and going down                      */
  /* -------------------------------------------- */

  /**
   * Take Wounds on a Zone (PHB v4.10, Wounds). Each fills the Zone toward its capacity; a further
   * Wound to a useless Arm or Leg goes to the Torso instead. The first Wound has the Zone's first
   * effect, every one short of the last repeats it, and the last has the final effect: a useless
   * arm, a fall you cannot Stand from, or, for the Torso and the Head, Dying. Taking a Wound
   * abandons a Prepared Maneuver.
   * @param {string} zone
   * @param {number} [n=1]
   * @param {object} [options]
   * @param {boolean} [options.critical]  The blow was a Critical Hit (Dying starts at 2).
   * @param {string[]} [options.reasons]  i18n keys saying why, for the card.
   * @returns {Promise<object|null>}
   */
  async applyWound(zone, n = 1, { critical = false, reasons = [] } = {}) {
    if (!(zone in SW.ZONES)) zone = SW.DEFAULT_ZONE;
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n) return null;

    const current = {};
    for (const z of Object.keys(SW.ZONES)) current[z] = this.system.zones?.[z]?.wounds ?? 0;
    const updates = {};
    const landed = [];
    let dyingFrom = null;

    let overflow = false;
    for (let i = 0; i < n; i++) {
      let z = zone;
      // A further Wound to a useless Arm or Leg goes to the Torso instead.
      if (["arms", "legs"].includes(z) && (current[z] >= this.woundCapacity(z))) z = "torso";
      const capacity = this.woundCapacity(z);
      // A Torso or Head already at capacity has nothing left to mark: the body is Dying, or Dying
      // again (1, or 2 on a Critical Hit) if it had been brought back.
      if (current[z] >= capacity) {
        overflow = true;
        dyingFrom = z;
        continue;
      }
      current[z] += 1;
      updates[`system.zones.${z}.wounds`] = current[z];
      const final = current[z] >= capacity;
      const rules = SW.ZONE_CRITICALS[z];
      landed.push({
        zone: z,
        zoneLabel: game.i18n.localize(SW.ZONES[z].label),
        fromLabel: game.i18n.localize(SW.ZONES[zone].label),
        count: current[z],
        capacity,
        final,
        effect: game.i18n.localize(final ? rules.final : rules.first),
        bleed: (z === "torso") && !final ? SW.TORSO_WOUND_BLEED : null,
        redirected: z !== zone
      });
      if (final && rules.finalDying) dyingFrom = z;
    }
    if (!landed.length && !overflow) return null;

    if (landed.length) {
      await this.update(updates);
      await this.setCondition("wounded", true);
    }

    // Taking a Wound abandons preparation automatically; Vigor damage does not.
    if (this.system.actions?.preparing) await this.abandonPrepared({ reason: "wound" });

    // Legs, final: you fall Prone and cannot Stand.
    if (landed.some(w => (w.zone === "legs") && w.final)) await this.setCondition("prone", true);

    // Torso or Head, final: Dying (Head: and unconscious, which Dying already is).
    if (dyingFrom) await this.beginDying({ critical });

    const content = await renderTemplate("systems/starwrought/templates/chat/wound-card.hbs", {
      actor: this,
      landed,
      reasons: reasons.map(r => game.i18n.localize(r)),
      total: this.woundCount,
      dying: this.system.dying ?? 0,
      dyingFrom: dyingFrom ? game.i18n.localize(SW.ZONES[dyingFrom].label) : null,
      abandoned: false
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });

    return { zone, landed, total: this.woundCount, dying: this.system.dying ?? 0, dyingFrom };
  }

  /**
   * The sheet's Wound stepper, for a player or the GM (0.5.3; Mike: "player and GM should be able
   * to change Wounds, and log to chat"). Adding goes through `applyWound`, so everything a Wound
   * does fires and its card says it was marked by hand; taking one off is bookkeeping with no
   * check behind it, written silently for the audit and said in its own card. Dying, Prone and a
   * Zone's effects are not unwound by a removal: a corrected Wound is the table's to tidy after.
   * @param {string} zone
   * @param {number} delta  +1 or -1 from the stepper; any integer works.
   * @returns {Promise<object|null>}
   */
  async adjustWounds(zone, delta) {
    if (!(zone in SW.ZONES)) return null;
    delta = Math.trunc(Number(delta) || 0);
    if (!delta) return null;
    if (delta > 0) return this.applyWound(zone, delta, { reasons: ["STARWROUGHT.Wound.reasonHand"] });

    const current = this.system.zones?.[zone]?.wounds ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return null;
    await this.update({ [`system.zones.${zone}.wounds`]: next }, { swAnnounced: true });
    // Wounded is also a token condition: on while any Zone carries a Wound.
    const any = Object.keys(SW.ZONES).some(z => (this.system.zones?.[z]?.wounds ?? 0) > 0);
    await this.setCondition("wounded", any);

    const zoneLabel = game.i18n.localize(SW.ZONES[zone].label);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-wound-removed">
        <h3><i class="fa-solid fa-bandage"></i> ${game.i18n.localize("STARWROUGHT.Wound.removedTitle")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Wound.removedText", {
          name: foundry.utils.escapeHTML(this.name), zone: zoneLabel, count: next,
          capacity: this.woundCapacity(zone), by: foundry.utils.escapeHTML(game.user.name)
        })}</p></div>`,
      whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
    return { zone, wounds: next, total: this.woundCount };
  }

  /**
   * Dying begins when the Torso or the Head takes its final Wound: Dying 1, or 2 if the blow was
   * a Critical Hit. Unconscious and helpless while it lasts (PHB v4.10, Dying).
   * @param {object} [options]
   * @param {boolean} [options.critical]
   */
  async beginDying({ critical = false } = {}) {
    const start = critical ? 2 : 1;
    const dying = Math.min(SW.DYING_MAX, Math.max(this.system.dying ?? 0, start));
    await this.update({ "system.dying": dying }, { swAnnounced: true });
    await this.setCondition("dying", dying);
    await this.setCondition("unconscious", true);
    if (this.system.actions?.preparing) await this.abandonPrepared({ reason: "wound" });
    if (dying >= SW.DYING_MAX) await this.#die();
    else ui.notifications.warn(game.i18n.format("STARWROUGHT.Notify.dying", { name: this.name, value: dying }));
  }

  /** Taking damage while Dying increases the value by 1, or by 2 from a Critical Hit. */
  async increaseDying(amount = 1) {
    const dying = Math.min(SW.DYING_MAX, (this.system.dying ?? 0) + amount);
    await this.update({ "system.dying": dying }, { swAnnounced: true });
    await this.setCondition("dying", dying);
    if (dying >= SW.DYING_MAX) await this.#die();
  }

  /**
   * Dying ends. Conscious with the Vigor given (at least 1) when healed or on a critical Recovery;
   * stable and still unconscious when the value simply reaches 0. Wounds remain: v4.10 has no
   * Wounded increment on the way back up.
   * @param {object} [options]
   * @param {boolean} [options.conscious]
   * @param {number} [options.vigor]
   */
  async endDying({ conscious = false, vigor = 0, hp = 0 } = {}) {
    const updates = { "system.dying": 0 };
    if (conscious) updates["system.vigor.value"] = Math.max(1, Number(vigor) || Number(hp) || 0);
    await this.update(updates, { swAnnounced: true });
    await this.setCondition("dying", 0);
    if (conscious) {
      await this.setCondition("unconscious", false);
      await this.setCondition("spent", false);
    }
  }

  async #die() {
    await this.setCondition("dead", true);
    ui.notifications.error(game.i18n.format("STARWROUGHT.Notify.dead", { name: this.name }));
  }

  /* -------------------------------------------- */

  /**
   * A Recovery check (PHB v4.10): at the start of each round while Dying, Endure against 10 + your
   * Dying value + the Wounds you carry. It costs no action. Critical success ends Dying, conscious
   * with 1 Vigor; success drops Dying by 1 (0 is stable, still unconscious); failure raises it by
   * 1; critical failure by 2. An adjacent ally's ❶ of help is the dialog's +2 Situation.
   */
  async rollRecovery() {
    if (!this.system.dying) {
      ui.notifications.info(game.i18n.localize("STARWROUGHT.Notify.notDying"));
      return null;
    }
    const wounds = this.woundCount;
    const threshold = SW.RECOVERY_BASE + this.system.dying + wounds;
    const result = await SwCheck.roll({
      actor: this,
      kind: "check",
      slug: SW.DEFENSES.endure.slug,
      label: game.i18n.localize("STARWROUGHT.Roll.recovery"),
      subtitle: game.i18n.format("STARWROUGHT.Roll.recoveryHint", { value: this.system.dying, wounds }),
      threshold,
      thresholdLabel: game.i18n.localize("STARWROUGHT.Roll.recoveryThreshold")
    });
    if (!result) return null;

    switch (result.degree) {
      case "critSuccess":
        await this.endDying({ conscious: true, vigor: 1 });
        break;
      case "success": {
        const dying = this.system.dying - 1;
        if (dying <= 0) await this.endDying({ conscious: false });
        else await this.update({ "system.dying": dying }, { swAnnounced: true }).then(() => this.setCondition("dying", dying));
        break;
      }
      case "fail":
        await this.increaseDying(1);
        break;
      case "critFail":
        await this.increaseDying(2);
        break;
    }
    return result;
  }

  /**
   * Refusing Death. Not a roll: it cannot fail, and nothing in the game can stop it. Dying drops
   * to 0; unconscious and stable at 0 Vigor (Spent); the Wounds remain; every Hero Point is spent.
   */
  async refuseDeath() {
    if (!this.system.heroPoints?.value) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noHeroPoints"));
      return;
    }
    // Only the Dying refuse death (0.5.1, T13): the button is disabled otherwise, and a macro
    // that reaches here anyway is told why nothing happened.
    if (!((this.system.dying ?? 0) > 0)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Roll.refuseDeathNotDying"));
      return;
    }
    await this.update({
      "system.dying": 0,
      "system.vigor.value": 0,
      "system.heroPoints.value": 0
    }, { swAnnounced: true });
    await this.setCondition("dying", 0);
    await this.setCondition("dead", false);
    await this.setCondition("unconscious", true);
    await this.setCondition("spent", true);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought refuse-death"><h3>${game.i18n.localize("STARWROUGHT.Roll.refuseDeath")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Roll.refuseDeathText", { name: this.name })}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Hero Points (0.5.1, T9)                     */
  /* -------------------------------------------- */

  /**
   * Spend one Hero Point, and say so. Players cannot add Hero Points (the GM awards them, with the
   * stepper the GM's sheet keeps), so the player's header carries one button, this, and every
   * press is a public card: "Hrolda spends a Hero Point (2 left)." Refuse Death keeps its own
   * path and takes every point at once. The update is marked for the audit (module/documents/
   * audit.mjs), which would otherwise announce the same change a second time.
   * @returns {Promise<number|null>} the points left, or null when there was nothing to spend
   */
  async spendHeroPoint() {
    const have = Number(this.system.heroPoints?.value) || 0;
    if (have <= 0) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noHeroPoints"));
      return null;
    }
    const left = have - 1;
    await this.update({ "system.heroPoints.value": left }, { swAnnounced: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-hero-card" data-actor-uuid="${this.uuid}">
        <h3><i class="fa-solid fa-star"></i> ${game.i18n.localize("STARWROUGHT.HeroPoints.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.HeroPoints.spent", { name: foundry.utils.escapeHTML(this.name), left })}</p></div>`
    });
    return left;
  }

  /* -------------------------------------------- */

  /**
   * Treat a Wound (PHB v4.10): ten minutes and an Endure check against 10 + the Wounds the patient
   * carries. On a success the Wound is bound: its effect ends. The book keeps a bound Wound on the
   * count for a week; the system takes it off the Zone and says so on the card, which is the
   * simplification the sync brief asked for.
   * @param {string} zone
   * @param {object} [options]
   * @param {Actor} [options.healer]  Who rolls. Defaults to a selected token that is not the
   *                                  patient, then to the patient.
   */
  async treatWound(zone, { healer = null } = {}) {
    if (!(zone in SW.ZONES)) return null;
    const wounds = this.system.zones?.[zone]?.wounds ?? 0;
    if (!wounds) {
      ui.notifications.info(game.i18n.format("STARWROUGHT.Wound.none", {
        name: this.name, zone: game.i18n.localize(SW.ZONES[zone].label)
      }));
      return null;
    }
    const medic = healer
      ?? canvas?.tokens?.controlled?.map(t => t.actor).find(a => a && (a.id !== this.id) && a.isOwner)
      ?? this;
    const threshold = SW.TREAT_WOUND_BASE + this.woundCount;
    const zoneLabel = game.i18n.localize(SW.ZONES[zone].label);
    const result = await SwCheck.roll({
      actor: medic,
      kind: "check",
      slug: SW.DEFENSES.endure.slug,
      label: game.i18n.localize("STARWROUGHT.Wound.treat"),
      subtitle: `${this.name}: ${zoneLabel} · ${game.i18n.format("STARWROUGHT.Wound.count", { n: this.woundCount })}`,
      threshold,
      thresholdLabel: game.i18n.localize("STARWROUGHT.Wound.treatThreshold")
    });
    if (!result) return null;

    const success = ["success", "critSuccess"].includes(result.degree);
    if (success) {
      await this.update({ [`system.zones.${zone}.wounds`]: wounds - 1 });
      if (!this.woundCount) await this.setCondition("wounded", false);
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: medic }),
      content: `<div class="starwrought action-card"><h3><i class="fa-solid fa-bandage"></i> ${
        game.i18n.localize("STARWROUGHT.Wound.treat")}</h3>
        <p>${game.i18n.format(success ? "STARWROUGHT.Wound.treated" : "STARWROUGHT.Wound.notTreated", {
          healer: medic.name, name: this.name, zone: zoneLabel
        })}</p></div>`
    });
    return result;
  }

  /* -------------------------------------------- */
  /*  Actions: six a round                        */
  /* -------------------------------------------- */

  /** Is this Actor in a running encounter, where actions and rounds mean anything? */
  get inEncounter() {
    return !!game.combat?.started && game.combat.combatants.some(c => c.actor?.id === this.id);
  }

  /** Is it this Actor's Opportunity right now? (A Foundry turn is an Opportunity.) */
  get isTurn() {
    return this.inEncounter && (game.combat.combatant?.actor?.id === this.id);
  }

  /** This Actor's combatant in the running encounter, if any. */
  get combatant() {
    return game.combat?.combatants.find(c => c.actor?.id === this.id) ?? null;
  }

  /**
   * Spend actions from the six a round (PHB v4.10). There is no reaction slot: a Reaction is paid
   * from the same pool.
   *
   * This never stops anything happening. The table is in charge of the fiction, and a system that
   * refuses a Strike because its own arithmetic disagrees is worse than one that says so and gets
   * out of the way. So an overspend goes to chat, where both the player and the GM can see it, and
   * the action still resolves. Outside an encounter nothing is counted at all.
   * Every spend by a player-controlled actor is said in public chat (Mike, 2026-10-01): what it
   * was, how many actions it took, and how many are left this round. A caller whose own card
   * already carries that line (a Move, Raise a Shield, Recenter) passes `announce: false` so the
   * table reads it once. An adversary the GM runs stays quiet unless it overspends.
   * @param {number|string} cost   A number, or a key of SW.ACTION_COSTS (legacy "free"/"reaction" map).
   * @param {object} [options]
   * @param {string} [options.label]      What is being paid for.
   * @param {boolean} [options.announce]  Post the spend card (default true).
   * @returns {Promise<boolean>} always true; the return value is kept for callers that read it
   */
  async spendActions(cost, { label = "", announce = true } = {}) {
    if (!this.inEncounter) return true;
    if (!this.system.actions) return true;

    let n;
    if (typeof cost === "string") {
      const legacy = SW.LEGACY_ACTION_COSTS[cost];
      if (legacy) n = SW.actionCostValue(legacy.cost);
      else if (cost in SW.ACTION_COSTS) n = SW.actionCostValue(cost);
      else n = Number(cost) || 0;
    } else {
      n = Number(cost) || 0;
    }
    if (n <= 0) return true;

    const left = this.system.actions.value ?? 0;
    // swAnnounced: the spend card (or the overspend card) says it; the audit stays quiet.
    await this.update({ "system.actions.value": Math.max(0, left - n) }, { swAnnounced: true });
    if (n > left) await this.#announceOverspend({ label, need: n, left });
    else if (announce && this.announcesSpends) await this.#announceSpend({ label, spent: n });

    // A Maneuver paid for at your own Opportunity keeps the round going: the Combat's pass streak
    // starts over.
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);
    return true;
  }

  /**
   * Does this actor's spending go to public chat? A player's character, or any actor a player
   * owns. The GM's adversaries keep their pips to themselves.
   * @type {boolean}
   */
  get announcesSpends() {
    return (this.type === "character") || this.hasPlayerOwner;
  }

  /** The actions a round starts with: six for a character, an adversary's own number. */
  get actionsPerRound() {
    return (this.type === "npc") ? (this.system.actionsPerRound ?? SW.ACTIONS_PER_ROUND) : SW.ACTIONS_PER_ROUND;
  }

  /**
   * "4 of 6 actions left this round" (and the reserved count while Preparing), for the cards that
   * announce a spend. Empty outside an encounter, where nothing is counted.
   * @returns {string}
   */
  actionsLeftLine() {
    if (!this.inEncounter || !this.system.actions) return "";
    const left = this.system.actions.value ?? 0;
    const reserved = this.system.actions.reserved ?? 0;
    const per = this.actionsPerRound;
    return reserved > 0
      ? game.i18n.format("STARWROUGHT.Actions.leftReserved", { left, per, reserved })
      : game.i18n.format("STARWROUGHT.Actions.leftLine", { left, per });
  }

  /**
   * The spend card: what was done, in the glyph the book prints, how many actions it took, and
   * how many are left. Always public, so the whole table keeps the same count.
   */
  async #announceSpend({ label, spent }) {
    const glyph = SW.ACTION_GLYPHS[spent] ?? `${spent}`;
    // Labels such as "Deliberate ❷: Battleaxe" or "Parry ❶↺" already carry their glyph.
    const title = label.includes(glyph)
      ? foundry.utils.escapeHTML(label)
      : `<span class="sw-spend-glyph">${glyph}</span> ${foundry.utils.escapeHTML(label)}`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-spend-card" data-actor-uuid="${this.uuid}">
        <h3>${title}</h3>
        <p>${game.i18n.format("STARWROUGHT.Actions.spent", { name: foundry.utils.escapeHTML(this.name), spent })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`
    });
  }

  /**
   * Say plainly, in chat, that something happened without the actions to pay for it, and how many
   * are left (none). Whispered to the GM for an adversary, public for a player's actor, because
   * the table needs to see it.
   */
  async #announceOverspend({ label, need = 0, left = 0 }) {
    const body = game.i18n.format("STARWROUGHT.Actions.overActions", {
      name: this.name, what: label, need, left, over: need - left
    });
    ui.notifications.warn(body);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-overspend">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
          game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3>
        <p>${body} <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p>
        <p class="sw-card-note">${game.i18n.localize("STARWROUGHT.Actions.overNote")}</p></div>`,
      whisper: this.announcesSpends ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /**
   * A fresh round: six actions (an adversary's own number), nothing reserved, nothing Preparing.
   * Unspent actions expired with the old round; a Prepared Maneuver that never reached its next
   * Opportunity expires with them. Slowed N loses N actions at the start of the round.
   * @param {object} [options]
   * @param {boolean} [options.byHand=false]  The sheet's reset arrow rather than the round's turn:
   *                                           a player's hand adjustment, which the audit announces
   *                                           (0.5.1, T10); the round's own reset is marked silent.
   */
  async resetActions({ byHand = false } = {}) {
    const sys = this.system;
    if (!sys.actions) return;
    const per = (this.type === "npc") ? (sys.actionsPerRound ?? SW.ACTIONS_PER_ROUND) : SW.ACTIONS_PER_ROUND;
    const slowed = this.conditionValue("slowed");
    const hadPreparation = sys.actions.preparing;
    await this.update({
      "system.actions.value": Math.max(0, per - slowed),
      "system.actions.reserved": 0,
      "system.actions.preparing": null
    }, { swAnnounced: !byHand });
    if (hadPreparation) {
      await this.setCondition("preparing", false);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
          <p>${game.i18n.format("STARWROUGHT.Prepared.expired", { name: this.name, what: hadPreparation.label ?? "" })}</p></div>`,
        whisper: this.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a Maneuver of three or more actions (PHB v4.10): spend one now, set the rest aside as
   * reserved, mark yourself Preparing. Nothing happens yet. At your next Opportunity you finish
   * it or abandon it; you cannot Pass while Preparing. Taking a Wound abandons it.
   * @param {object} config
   * @param {"strike"|"maneuver"} [config.kind]
   * @param {string} config.label
   * @param {number} config.cost           The whole cost; one is spent now.
   * @param {string} [config.weaponId]     For a Committed Strike.
   * @param {string} [config.targetTokenId]
   * @param {string} [config.targetUuid]
   * @param {string} [config.strike]       "committed" for a Strike.
   * @returns {Promise<object|null>} what is being prepared
   */
  async prepare({ kind = "maneuver", label = "", cost = SW.PREPARED_THRESHOLD, weaponId = "", targetTokenId = "", targetUuid = "", strike = "" } = {}) {
    if (!this.inEncounter || !this.system.actions) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Prepared.outsideEncounter"));
      return null;
    }
    if (this.system.actions.preparing) {
      // One preparation at a time: the old one is abandoned, its action lost.
      await this.abandonPrepared({ reason: "replaced" });
    }
    cost = Math.max(1, Math.floor(Number(cost) || SW.PREPARED_THRESHOLD));
    const reserve = cost - 1;
    const left = this.system.actions.value ?? 0;
    const preparing = { kind, label, weaponId, targetTokenId, targetUuid, cost, strike };
    await this.update({
      "system.actions.value": Math.max(0, left - cost),
      "system.actions.reserved": reserve,
      "system.actions.preparing": preparing
    }, { swAnnounced: true });
    // "You must have enough unspent actions." Announced, not enforced.
    if (cost > left) await this.#announceOverspend({ label: game.i18n.format("STARWROUGHT.Prepared.paying", { what: label }), need: cost, left });
    await this.setCondition("preparing", true);
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-prepared-card" data-actor-uuid="${this.uuid}">
        <h3><i class="fa-solid fa-hourglass-half"></i> ${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Prepared.begun", { name: this.name, what: label, reserved: reserve })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p>
        <div class="sw-card-buttons">
          <button type="button" data-sw-action="finishPrepared" data-actor-uuid="${this.uuid}" data-owner-uuid="${this.uuid}">
            <i class="fa-solid fa-check"></i> ${game.i18n.localize("STARWROUGHT.Prepared.finish")}
          </button>
          <button type="button" data-sw-action="abandonPrepared" data-actor-uuid="${this.uuid}" data-owner-uuid="${this.uuid}">
            <i class="fa-solid fa-xmark"></i> ${game.i18n.localize("STARWROUGHT.Prepared.abandon")}
          </button>
        </div></div>`,
      flags: { [SW.SYSTEM_ID]: { kind: "prepared", actorUuid: this.uuid } }
    });
    return preparing;
  }

  /**
   * Finish a Prepared Maneuver at your Opportunity: the reserved actions are spent (they left the
   * pool when the preparation began) and the Maneuver resolves. A Committed Strike rolls now,
   * already paid for. Range, line of effect and requirements are the table's to check again.
   */
  async finishPrepared() {
    const prep = this.system.actions?.preparing;
    if (!prep) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Prepared.nothing"));
      return null;
    }
    await this.update({ "system.actions.reserved": 0, "system.actions.preparing": null });
    await this.setCondition("preparing", false);
    if (this.isTurn) game.combat?.registerAction?.(this.combatant);

    if (prep.kind === "strike" && prep.weaponId) {
      const targetUuid = prep.targetUuid
        || (prep.targetTokenId ? (canvas.tokens?.get(prep.targetTokenId)?.document.uuid ?? "") : "");
      return this.rollAttack(prep.weaponId, {
        strike: SW.STRIKE_KINDS[prep.strike] ? prep.strike : "committed",
        prepared: true,
        targetUuid
      });
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Prepared.finished", { name: this.name, what: prep.label ?? "" })}</p></div>`
    });
    return prep;
  }

  /**
   * Abandon a Prepared Maneuver: the action already spent is lost, the reserved actions return.
   * @param {object} [options]
   * @param {"choice"|"wound"|"replaced"} [options.reason]
   */
  async abandonPrepared({ reason = "choice" } = {}) {
    const actions = this.system.actions;
    const prep = actions?.preparing;
    if (!prep) return null;
    await this.update({
      "system.actions.value": (actions.value ?? 0) + (actions.reserved ?? 0),
      "system.actions.reserved": 0,
      "system.actions.preparing": null
    }, { swAnnounced: true });
    await this.setCondition("preparing", false);
    const key = reason === "wound" ? "STARWROUGHT.Wound.abandonsPrepared"
      : reason === "replaced" ? "STARWROUGHT.Prepared.abandonedReplaced"
      : "STARWROUGHT.Prepared.abandoned";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Prepared.title")}</h3>
        <p>${game.i18n.format(key, { name: this.name, what: prep.label ?? "", returned: actions.reserved ?? 0 })}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`,
      whisper: this.announcesSpends ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
    return prep;
  }

  /* -------------------------------------------- */

  /**
   * Pass ⓿: decline this Opportunity. You may still use Reactions. When a full circuit passes in
   * which everyone Passes, the round ends; the Combat keeps that count. You cannot Pass while
   * Preparing (finish or abandon first), so that one is refused rather than announced: it is a
   * tracker control, not a thing that happens in the fiction.
   * @returns {Promise<boolean>} whether the Opportunity was passed
   */
  async pass() {
    if (!this.inEncounter) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noCombatant"));
      return false;
    }
    if (!this.isTurn) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Actions.notYourOpportunity"));
      return false;
    }
    if (this.system.actions?.preparing) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Prepared.cannotPass", { name: this.name }));
      return false;
    }
    const combatant = this.combatant;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card sw-pass-card"><h3>⓿ ${game.i18n.localize("STARWROUGHT.Actions.pass")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Actions.passText", { name: this.name, left: this.system.actions?.value ?? 0 })}</p></div>`
    });
    // The Combat registers the Pass, keeps the streak, and advances the turn only if the round
    // did not just end on a full circuit of Passes.
    if (game.combat.pass) return game.combat.pass(combatant);
    await game.combat.registerPass?.(combatant);
    await game.combat.nextTurn();
    return true;
  }

  /**
   * End this Opportunity after a Maneuver, without Passing: play moves to the next combatant and
   * the round keeps going.
   * @returns {Promise<boolean>}
   */
  async endOpportunity() {
    if (!this.isTurn) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Actions.notYourOpportunity"));
      return false;
    }
    await game.combat.nextTurn();
    return true;
  }

  /* -------------------------------------------- */
  /*  Carrying                                    */
  /* -------------------------------------------- */

  /**
   * Move a piece of equipment between held, worn, and carried.
   *
   * Drawing or stowing something is an Interact, which costs an action in an encounter. Armor is
   * the exception the handbook is explicit about: putting a piece on or taking it off takes a
   * minute per point of Protection, so it is not something you do mid-fight at all. Putting away
   * an implement that is in a Bind ends the Bind (a dropped implement does).
   * @param {string} itemId
   * @param {string} state  A key of SW.CARRY_STATES.
   */
  async setCarryState(itemId, state) {
    const item = this.items.get(itemId);
    if (!item || !(state in SW.CARRY_STATES)) return;
    if (item.system.state === state) return;

    if (item.type === "armor") {
      // "Putting on or taking off a single piece takes 1 minute for each point of Protection."
      // Said plainly rather than forbidden: it is the table's call whether the fiction allows it.
      if (this.inEncounter) {
        const minutes = Math.max(1, item.system.protection);
        const body = game.i18n.format("STARWROUGHT.Actions.armorInCombat", { name: item.name, minutes });
        ui.notifications.warn(body);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          content: `<div class="starwrought action-card sw-overspend">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> ${
              game.i18n.localize("STARWROUGHT.Actions.overTitle")}</h3><p>${body}</p></div>`
        });
      }
    } else if (state === "held" || item.system.state === "held") {
      // Drawing it or putting it away: one Interact.
      await this.spendActions(1, { label: game.i18n.format("STARWROUGHT.Actions.interactLabel", { name: item.name }) });
    }

    if ((item.system.state === "held") && this.system.bind?.state && sameName(this.system.bind.mine, item.name)) {
      await this.endBind();
    }
    return item.update({ "system.state": state });
  }

  /* -------------------------------------------- */
  /*  Zones and Position                          */
  /* -------------------------------------------- */

  /**
   * Recenter ❶ (PHB v4.10): gather yourself, clear every Exposed Zone on you (except one Exposed
   * by a Posture, which lasts to the end of the round) and end any Bind you are in.
   */
  async recenter() {
    // The card below carries the actions-left line, so the spend itself posts nothing.
    await this.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.recenter"), announce: false });
    const updates = {};
    let kept = 0;
    for (const zone of Object.keys(SW.ZONES)) {
      if (this.system.zones?.[zone]?.postureExposed) { kept++; continue; }
      updates[`system.zones.${zone}.exposed`] = false;
    }
    await this.update(updates, { swAnnounced: true });
    const hadBind = !!this.system.bind?.state;
    if (hadBind) await this.endBind({ announce: false });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3><span class="sw-spend-glyph">❶</span> ${game.i18n.localize("STARWROUGHT.Action.recenter")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Action.recenterText", { name: this.name })}${
          kept ? " " + game.i18n.localize("STARWROUGHT.Action.recenterPosture") : ""}
        <strong class="sw-actions-left">${this.actionsLeftLine()}</strong></p></div>`
    });
  }

  /**
   * Open or close one Zone. A Zone Exposed by a Posture is marked so Recenter leaves it alone.
   * @param {string} zone
   * @param {boolean} [exposed=true]
   * @param {object} [options]
   * @param {boolean} [options.posture=false]
   * @param {boolean} [options.announced]  The caller's card already says it (a Posture's reveal,
   *                                        a Position offer), so the audit stays quiet (0.5.1,
   *                                        T10). Defaults to `posture`; a sheet toggle is announced.
   */
  async setExposed(zone, exposed = true, { posture = false, announced = posture } = {}) {
    if (!(zone in SW.ZONES)) return;
    const on = !!exposed;
    const z = this.system.zones?.[zone];
    // The Zone is the record; a call that changes nothing writes nothing, so the palette hook
    // (which calls this when a status is toggled on the token) settles in one pass.
    if ((!!z?.exposed !== on) || (!!z?.postureExposed !== (on && !!posture))) {
      await this.update({
        [`system.zones.${zone}.exposed`]: on,
        [`system.zones.${zone}.postureExposed`]: on && !!posture
      }, { swAnnounced: !!announced });
    }
    // The token status mirrors the Zone (0.5.1): Exposed: Head on the token when the Head is open.
    await this.setCondition(SW.ZONE_CONDITIONS[zone], on);
    return this.system.zones?.[zone];
  }

  /** End of round: a Zone Exposed by a Posture closes now, and only now. */
  async clearPostureExposed() {
    const updates = {};
    const closed = [];
    for (const zone of Object.keys(SW.ZONES)) {
      if (!this.system.zones?.[zone]?.postureExposed) continue;
      updates[`system.zones.${zone}.exposed`] = false;
      updates[`system.zones.${zone}.postureExposed`] = false;
      closed.push(zone);
    }
    if (Object.keys(updates).length) await this.update(updates, { swAnnounced: true });
    // The statuses follow the Zones they mirror.
    for (const zone of closed) await this.setCondition(SW.ZONE_CONDITIONS[zone], false);
  }

  /* -------------------------------------------- */
  /*  Auras (0.5.1)                               */
  /* -------------------------------------------- */

  /**
   * Mark a range Visible, or not. A Visible range is pinned on the map for everyone while an
   * encounter runs; the rest show only in the preview. The marks live on the actor
   * (`system.auras.visible[key]`; Mike: new tokens inherit them), so a flip reaches every client
   * as an ordinary actor update, and the owner and the GM can both make it.
   * @param {string|string[]} key  A range key (an Item id; `reach`, `totalReach` or `unwieldy`; a
   *                               custom ring's key), or several at once for one update.
   * @param {boolean} visible
   */
  async setAuraVisible(key, visible) {
    const keys = (Array.isArray(key) ? key : [key]).filter(k => (typeof k === "string") && k && !k.includes("."));
    if (!keys.length) return this;
    const updates = {};
    for (const k of keys) updates[`system.auras.visible.${k}`] = !!visible;
    return this.update(updates);
  }

  /**
   * Every mark unset: back to the data defaults, in which an ability's own Visible flag still
   * counts and reach is preview only. The GM's Clear control calls it on every combatant.
   * @returns {Promise<boolean>}  True when there was something to clear.
   */
  async clearAuraMarks() {
    const marks = foundry.utils.getProperty(this._source, "system.auras.visible") ?? {};
    const keys = Object.keys(marks);
    if (!keys.length) return false;
    const updates = {};
    for (const k of keys) updates[`system.auras.visible.-=${k}`] = null;
    await this.update(updates);
    return true;
  }

  /**
   * Add a custom ring, Visible from the start: the "within 20 feet" the GM improvises mid-fight,
   * or a player's own marker. `gmOnly` hides it from players always.
   * @param {object} spec
   * @param {string} [spec.label]
   * @param {number} [spec.feet]
   * @param {"all"|"allies"|"enemies"} [spec.audience]
   * @param {string|null} [spec.color]  A CSS colour, or null for the audience's.
   * @param {boolean} [spec.gmOnly]
   * @returns {Promise<string>}  The new ring's key.
   */
  async addCustomAura({ label = "", feet = 0, audience = "all", color = null, gmOnly = false } = {}) {
    const key = `custom-${foundry.utils.randomID(8)}`;
    const custom = foundry.utils.deepClone(foundry.utils.getProperty(this._source, "system.auras.custom") ?? []);
    custom.push({
      key,
      label: String(label ?? ""),
      feet: Math.max(0, Number(feet) || 0),
      audience: ["all", "allies", "enemies"].includes(audience) ? audience : "all",
      color: color || null,
      gmOnly: !!gmOnly
    });
    await this.update({ "system.auras.custom": custom, [`system.auras.visible.${key}`]: true });
    return key;
  }

  /**
   * Take a custom ring off, and its mark with it.
   * @param {string} key
   */
  async removeCustomAura(key) {
    const custom = foundry.utils.deepClone(foundry.utils.getProperty(this._source, "system.auras.custom") ?? []);
    const next = custom.filter(c => c.key !== key);
    if (next.length === custom.length) return this;
    return this.update({ "system.auras.custom": next, [`system.auras.visible.-=${key}`]: null });
  }

  /* -------------------------------------------- */

  /**
   * Form a Bind with a partner (PHB v4.10, The Bind): neutral when neither has the line, or
   * Controlled by one of them. One relationship per implement, both named. Written on both
   * actors when this client owns both; otherwise on this one, marked unpaired, and the partner's
   * owning client writes the mirror as the update reaches it (module/canvas/bind.mjs).
   * @param {Actor|Token} partner
   * @param {object} [options]
   * @param {"neutral"|"controlling"|"controlled"} [options.state]  This actor's side of it.
   * @param {string} [options.mine]    This actor's implement. Defaults to the rigid one in hand.
   * @param {string} [options.theirs]  The partner's implement.
   * @param {boolean} [options.announce=true]
   * @param {boolean} [options.pair=true]  Write the partner's side too when this client owns it.
   *   False when this call IS the partner's side, picked up from the other's write
   *   (module/canvas/bind.mjs keeps the pair whole), so the pickup never bounces back.
   * @param {string} [options.id]  The Bind's identity, shared by both sides; a pickup passes the
   *   one it is mirroring, a fresh Bind gets a new one.
   */
  async formBind(partner, { state = "neutral", mine = "", theirs = "", announce = true, pair = true, id = "" } = {}) {
    const other = partner?.actor ?? (partner?.documentName === "Actor" ? partner : null);
    // A Bind is between two implements on two fighters; a token of your own is not a partner.
    if (!other || (other === this) || !other.uuid) return null;
    const mirror = { neutral: "neutral", controlling: "controlled", controlled: "controlling" };
    if (!(state in mirror)) state = "neutral";
    mine = mine || this.rigidImplement?.name || "";
    theirs = theirs || other.rigidImplement?.name || "";

    // One Bind per fighter (PHB v4.10, The Bind): forming one over a Bind with someone else ends
    // the old one first, on both sides. endBind clears the old partner's side when this client
    // owns it; otherwise its write carries previousPartner and the elected client clears it
    // (module/canvas/bind.mjs, pickUpMirror). Review, 2026-10-01.
    const current = this.system.bind;
    if (current?.state && (current.partnerUuid !== other.uuid)) await this.endBind({ announce: false });
    id = id || foundry.utils.randomID();

    // Both sides land here when this client owns both. Otherwise the write goes out marked
    // unpaired, and the partner's owning client (the GM's, when one is connected) writes the
    // mirror as the update reaches it, so a player's click on the card still forms the pair.
    const bothSides = pair && other.isOwner;
    await this.#writeBind({ state, partnerUuid: other.uuid, mine, theirs, id }, { paired: bothSides || !pair });
    if (bothSides) {
      await other.#writeBind({ state: mirror[state], partnerUuid: this.uuid, mine: theirs, theirs: mine, id }, { paired: true });
    }

    if (announce) {
      const controller = state === "controlling" ? this : state === "controlled" ? other : null;
      const partnerOf = controller === this ? other : this;
      const text = controller
        ? game.i18n.format("STARWROUGHT.Bind.controlTaken", {
            name: controller.name, partner: partnerOf.name,
            theirs: controller === this ? (theirs || game.i18n.localize("STARWROUGHT.Bind.weapon")) : (mine || game.i18n.localize("STARWROUGHT.Bind.weapon"))
          })
        : game.i18n.format("STARWROUGHT.Bind.formed", {
            name: this.name, partner: other.name,
            mine: mine || game.i18n.localize("STARWROUGHT.Bind.weapon"),
            theirs: theirs || game.i18n.localize("STARWROUGHT.Bind.weapon")
          });
      // The title opens the rules page for the Bind (0.5.1, T6): chat.mjs wires `rulesPage` on
      // every card, flags or none.
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3><p>${text}</p>${
          bothSides ? "" : `<p class="sw-card-note">${game.i18n.format("STARWROUGHT.Bind.partnerNotOwned", { partner: other.name })}</p>`
        }</div>`
      });
    }
    return this.system.bind;
  }

  /**
   * End the Bind this actor is in: a Strike between the two resolved, someone Moved or Stepped
   * (Close excepted), someone Recentered, the Controller was attacked by a third party, or an
   * implement was dropped or Disarmed. The partner's side is cleared too when this client owns it;
   * otherwise the write goes out unpaired and the partner's owning client clears the mirror.
   * @param {object} [options]
   * @param {boolean} [options.announce=true]
   * @param {boolean} [options.pair=true]  False when this call is the mirror being picked up.
   */
  async endBind({ announce = true, pair = true } = {}) {
    const bind = this.system.bind;
    if (!bind?.state) return;
    const partner = SwActor.resolveActor(bind.partnerUuid);
    const partnerMirrors = partner?.system?.bind?.partnerUuid === this.uuid;
    const bothSides = pair && !!partner?.isOwner && partnerMirrors;
    // The emptied record keeps the Bind's id as a tombstone: the pair-keeper reads it to tell a
    // Bind this side ended from a mirror that was never written (module/canvas/bind.mjs).
    const ended = { state: "", partnerUuid: "", mine: "", theirs: "", id: bind.id ?? "" };
    await this.#writeBind(ended, {
      paired: bothSides || !pair || !partnerMirrors,
      previousPartner: bind.partnerUuid
    });
    if (bothSides) await partner.#writeBind({ ...ended }, { paired: true });
    if (announce) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="starwrought action-card sw-bind-card"><h3><a class="sw-rules-link" data-sw-action="rulesPage" data-page="The Bind" data-tooltip="STARWROUGHT.Rules.openBind"><i class="fa-solid fa-link-slash"></i> ${
          game.i18n.localize("STARWROUGHT.Bind.label")}</a></h3>
          <p>${game.i18n.format("STARWROUGHT.Bind.ended", { name: this.name, partner: partner?.name ?? "" })}</p></div>`
      });
    }
  }

  /**
   * Write one side of a Bind and keep the three token statuses in step with it. The status
   * effect carries the Bind (0.5.1, T4): its name says who with, its description names the
   * partner, both implements and the state, its origin is the partner, and
   * `flags.starwrought.bind = {partnerUuid, mine, theirs, state}` is the record for anything that
   * reads effects rather than actors. The update's `swBind` option tells the pair-keeper in
   * module/canvas/bind.mjs whether the writer handled both sides.
   * @param {{state: string, partnerUuid: string, mine: string, theirs: string}} bind
   * @param {{paired?: boolean, previousPartner?: string}} [mark]
   */
  async #writeBind(bind, { paired = true, previousPartner = "" } = {}) {
    await this.update({ "system.bind": bind }, { swBind: { paired, previousPartner } });

    const partner = bind.state ? SwActor.resolveActor(bind.partnerUuid) : null;
    const weapon = game.i18n.localize("STARWROUGHT.Bind.weapon");
    const args = {
      partner: partner?.name ?? game.i18n.localize("STARWROUGHT.Bind.unknownPartner"),
      mine: bind.mine || weapon,
      theirs: bind.theirs || weapon
    };
    const states = { neutral: "bound", controlling: "controlling", controlled: "controlled" };
    for (const [state, conditionId] of Object.entries(states)) {
      const on = bind.state === state;
      if (!on) {
        await this.setCondition(conditionId, false);
        continue;
      }
      const condition = SW.CONDITIONS[conditionId];
      const stateWord = state.charAt(0).toUpperCase() + state.slice(1);
      await this.setCondition(conditionId, true, {
        name: `${game.i18n.localize(condition.name)}: ${game.i18n.format(`STARWROUGHT.Bind.effect${stateWord}`, args)}`,
        description: `<p>${game.i18n.format(`STARWROUGHT.Bind.${state}`, args)}</p>`
          + `<p>${game.i18n.localize(`${condition.name}Hint`)}</p>`
          + `<p>${game.i18n.format("STARWROUGHT.Rules.where", { page: condition.rulesPage })}</p>`,
        origin: partner?.uuid ?? bind.partnerUuid ?? "",
        flags: { [SW.SYSTEM_ID]: { bind: { partnerUuid: bind.partnerUuid, mine: bind.mine, theirs: bind.theirs, state } } }
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Give ground: an Evade that Grazes gives 3 feet directly away from the attacker (PHB v4.10,
   * Graze). The token moves along the line from the attacker, rounded to whole squares, and the
   * move is not charged as a Move.
   * @param {Token|TokenDocument} attackerToken
   * @param {number} [feet]
   * @returns {Promise<boolean>}
   */
  async giveGround(attackerToken, feet = SW.GIVE_GROUND_FEET) {
    const mine = this.tokenOnScene();
    const theirs = attackerToken?.document ?? attackerToken ?? null;
    if (!mine || !theirs || !canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noToken"));
      return false;
    }
    const size = canvas.scene.grid.size;
    const distance = canvas.scene.grid.distance || 1;
    const centre = doc => ({ x: doc.x + (doc.width * size / 2), y: doc.y + (doc.height * size / 2) });
    const a = centre(theirs);
    const b = centre(mine);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (!dx && !dy) dy = 1;
    const length = Math.hypot(dx, dy);
    const cells = feet / distance;
    const nx = Math.round((dx / length) * cells);
    const ny = Math.round((dy / length) * cells);
    await mine.update({ x: mine.x + (nx * size), y: mine.y + (ny * size) }, { swNoCost: true, animate: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Position.giveGround")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Position.gaveGround", { name: this.name, feet })}</p></div>`
    });
    return true;
  }

  /**
   * A Step granted by the Exchange (an Evade that answered a Miss, or a Void that Stopped the
   * attack) costs nothing: the card says so, and the player moves the token.
   */
  async announceStep() {
    const step = this.system.step ?? Math.floor((this.system.speed ?? SW.DEFAULT_SPEED) / SW.STEP_DIVISOR);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>⓿ ${game.i18n.localize("STARWROUGHT.Position.step")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Position.stepText", { name: this.name, feet: step })}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Flares                                      */
  /* -------------------------------------------- */

  /**
   * A Constellation is Flared or it is not: a checkbox, not a count. It stays Flared until you
   * spend into it.
   * @param {string} slug
   * @param {boolean} [state]
   */
  async toggleFlare(slug, state) {
    const next = state ?? !this.system.flares?.[slug];
    // An update merges objects, so putting a Flare out takes the deletion key rather than a
    // clone with the property removed.
    return this.update(next
      ? { [`system.flares.${slug}`]: true }
      : { [`system.flares.-=${slug}`]: null });
  }

  /** Which Constellations are currently Flared. */
  get flared() {
    return Object.keys(this.system.flares ?? {});
  }

  /* -------------------------------------------- */
  /*  Rest                                        */
  /* -------------------------------------------- */

  /**
   * A full night's rest restores Vigor equal to your level times your Presence (or your level, if
   * Presence is 1 or less). Wounds do not come back with sleep (PHB v4.10, Treating Wounds).
   */
  async restForTheNight() {
    const sys = this.system;
    const vigor = sys.vigor ?? { value: 0, temp: 0 };
    const rest = Number.isNumeric(vigor.rest)
      ? vigor.rest
      : (sys.level ?? 1) * Math.max(1, sys.attributes?.presence?.mod ?? 0);
    const max = Number.isNumeric(vigor.max) ? vigor.max : (vigor.value + rest);
    const healed = Math.max(0, Math.min(rest, max - vigor.value));
    // A night's rest gives no Hero Point (Mike, 0.5.1 T12); the GM awards those. The rest card
    // says what the night did, so the audit stays quiet about the Temporary Vigor it cleared.
    const updates = { "system.vigor.value": vigor.value + healed, "system.vigor.temp": 0 };
    await this.update(updates, { swAnnounced: true });
    if ((vigor.value + healed) > 0) await this.setCondition("spent", false);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Rest.title")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Rest.text", { name: this.name, hp: healed, wounds: this.woundCount })}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Creation                                    */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const prototypeToken = {
      sight: { enabled: true },
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    };
    if (this.type === "character") {
      Object.assign(prototypeToken, { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
    }
    // The grid is 1 foot, so a Medium creature is a 3x3 token rather than a 1x1.
    const space = SW.SIZES[data.system?.size ?? "medium"]?.space ?? 3;
    prototypeToken.width = space;
    prototypeToken.height = space;
    this.updateSource({ prototypeToken });
  }

  /** @inheritdoc */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    // Keep the token footprint honest when Size changes: the grid is in feet.
    const size = changes.system?.size;
    if (size && SW.SIZES[size]) {
      const space = SW.SIZES[size].space;
      foundry.utils.setProperty(changes, "prototypeToken.width", space);
      foundry.utils.setProperty(changes, "prototypeToken.height", space);
    }
  }
}
