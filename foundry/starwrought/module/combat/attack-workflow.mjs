/**
 * The attack workflow's state model (0.5.0 brief: declare, commit, reveal, roll, resolve).
 *
 * One declared Blow is one workflow: an attacker, a Maneuver (a weapon and a Strike, or an
 * adversary's attack row), and one pairing per target. Every rule about the SHAPE of that record
 * lives here, so the coordinator (attack-coordinator.mjs), the prompt and the card all read the
 * same answers to the same questions: which phases there are and which may follow which, who
 * throws the die for a pairing (PHB v4.10: the players roll everything), what each user still has
 * to do, and what of the record may be shown to whom.
 *
 * Nothing here touches a document or the socket. The coordinator is the only writer of a
 * workflow; this module only describes and transforms plain objects.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE, like config.mjs: the scratchpad
 * test imports it from plain Node and asserts the transition table, `rollerFor`, `outstandingFor`
 * and `projectFor` without a browser.
 */

import * as SW from "../config.mjs";

/* -------------------------------------------- */
/*  Phases                                      */
/* -------------------------------------------- */

/**
 * The phases, in the order a Blow passes through them (brief, "Coordination"):
 * declared -> defending -> revealed -> rolling -> resolving -> complete; cancelled from anywhere.
 */
export const PHASES = Object.freeze([
  "declared", "defending", "revealed", "rolling", "resolving", "complete", "cancelled"
]);

/** Follow-up phases the brief reserves for later releases (a Zone to Expose, a Bind to take). Unused. */
export const RESERVED_PHASES = Object.freeze(["choosing"]);

/** A workflow in one of these phases is finished: nothing more happens to it. */
export const TERMINAL_PHASES = Object.freeze(["complete", "cancelled"]);

/**
 * The legal transitions. `defending` is re-entered from `revealed` and `rolling` by the GM's
 * Reset defenses (every commitment cleared, the roll with it); nothing leaves `complete` or
 * `cancelled`. `declared` exists for the instant between the record and its card.
 */
export const TRANSITIONS = Object.freeze({
  declared: Object.freeze(["defending", "cancelled"]),
  defending: Object.freeze(["revealed", "cancelled"]),
  revealed: Object.freeze(["rolling", "defending", "cancelled"]),
  rolling: Object.freeze(["resolving", "defending", "cancelled"]),
  resolving: Object.freeze(["complete", "cancelled"]),
  complete: Object.freeze([]),
  cancelled: Object.freeze([])
});

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

const LIVE_PHASES = Object.freeze(PHASES.filter(p => !TERMINAL_PHASES.includes(p)));

/**
 * The requests a client may send the coordinator (brief, "Data shapes": the socket request's
 * `action`), the phases each is allowed in, and whether it is a GM control. `declare` has no
 * phase: it creates the workflow. `requestState` is read-only and allowed anywhere.
 */
export const ACTIONS = Object.freeze({
  declare: Object.freeze({ phases: null, gm: false }),
  commitDefense: Object.freeze({ phases: Object.freeze(["defending"]), gm: false }),
  submitRoll: Object.freeze({ phases: Object.freeze(["rolling"]), gm: false }),
  cancel: Object.freeze({ phases: LIVE_PHASES, gm: true }),
  // Reset is for the choosing: once a die has been paid for (a Strike's actions, a Reaction's ❶
  // charged before the Defense roll), only Cancel remains (review, 2026-10-01).
  resetDefenses: Object.freeze({ phases: Object.freeze(["defending", "revealed"]), gm: true }),
  resendPrompts: Object.freeze({ phases: LIVE_PHASES, gm: true }),
  // No `useStances` since 0.12.0 (ruling 159): nothing answers for a defender but a commitment,
  // the defender's own or the GM's explicit one for them (`gmDefendAbsent`).
  requestState: Object.freeze({ phases: PHASES, gm: false })
});

/**
 * The kinds of outstanding action `outstandingFor` reports (brief, "Outstanding actions").
 * `gmDefendAbsent` (0.12.0): a player-controlled defender who has not committed, listed for the
 * GM so an absent player's character can be answered for, explicitly and per defender.
 */
export const OUTSTANDING_KINDS = Object.freeze(["defend", "rollAttack", "rollDefense", "gmDefend", "gmDefendAbsent"]);

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** A deep copy of plain data (uuids, numbers, roll JSON): nothing here holds a document. */
function clone(value) {
  if (value === undefined || value === null) return value ?? null;
  return (typeof structuredClone === "function") ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/**
 * Does this user control the actor a snapshot describes? For a player-controlled actor the
 * controlling players alone (the GM gets a `gmDefendAbsent` row for them, secondary, rather than
 * the same prompt row); a character nobody but the GM owns, and every adversary, is the GM's.
 */
function controls(user, snapshot) {
  if (!user || !snapshot) return false;
  const ids = Array.isArray(snapshot.controllerUserIds) ? snapshot.controllerUserIds : [];
  if (snapshot.isPlayer && ids.length) return ids.includes(user.id);
  return !!user.isGM;
}

/* -------------------------------------------- */
/*  The model                                   */
/* -------------------------------------------- */

export class AttackWorkflow {
  /**
   * Build a new workflow record in the `declared` phase (brief, "Data shapes").
   * @param {object} spec
   * @param {string} spec.id
   * @param {string} spec.coordinatorUserId
   * @param {string} spec.initiatingUserId
   * @param {{actorUuid: string, tokenUuid: string, name: string, isPlayer: boolean,
   *          controllerUserIds: string[]}} spec.attacker
   * @param {{weaponId: string|null, weaponName: string, strike: string, glyph: string, label: string,
   *          thrown: boolean|null, prepared: boolean, free: boolean, attackId: string|null,
   *          ranged: boolean}} spec.maneuver
   * @param {Array<{actorUuid: string, tokenUuid: string, name: string, isPlayer: boolean,
   *          controllerUserIds: string[], id?: string}>} spec.targets
   * @returns {object}
   */
  static create({ id, coordinatorUserId, initiatingUserId, attacker, maneuver, targets = [] }) {
    // The source (0.12.0, attack-source.mjs): a weapon or an attack row is a Blow with a Strike;
    // a spell is a Cast with no Strike at all. A record from before 0.12.0 names no source and
    // reads as the Blow it was.
    const source = (maneuver?.source === "spell") ? "spell"
      : (maneuver?.source === "attack") ? "attack"
      : (maneuver?.weaponId ? "weapon" : (maneuver?.attackId ? "attack" : (maneuver?.source ?? "weapon")));
    const spell = (source === "spell") && maneuver?.spell ? { ...maneuver.spell } : null;
    const strike = (source === "spell") ? null : (SW.STRIKE_KINDS[maneuver?.strike] ? maneuver.strike : SW.DEFAULT_STRIKE);
    const kind = strike ? SW.STRIKE_KINDS[strike] : null;
    const castKind = spell ? (SW.CAST_KINDS[spell.cast] ?? SW.CAST_KINDS[SW.DEFAULT_CAST]) : null;
    const reaction = ["intercept", "riposte"].includes(maneuver?.reaction) ? maneuver.reaction : null;
    const threat = SW.THREATS[maneuver?.threat] ? maneuver.threat : "blow";
    const permitted = Array.isArray(maneuver?.defenses) ? maneuver.defenses.filter(d => SW.DEFENSES[d]) : [];
    const defenses = permitted.length ? [...permitted] : [...SW.THREATS[threat].defenses];
    const attackerSnapshot = {
      actorUuid: attacker?.actorUuid ?? "",
      tokenUuid: attacker?.tokenUuid ?? "",
      name: attacker?.name ?? "",
      isPlayer: !!attacker?.isPlayer,
      controllerUserIds: [...(attacker?.controllerUserIds ?? [])]
    };
    return {
      id,
      revision: 0,
      phase: "declared",
      coordinatorUserId,
      initiatingUserId,
      attacker: attackerSnapshot,
      maneuver: {
        source,
        weaponId: maneuver?.weaponId ?? null,
        weaponName: maneuver?.weaponName ?? "",
        strike,
        glyph: maneuver?.glyph ?? SW.ACTION_GLYPHS[(kind ?? castKind)?.cost] ?? "",
        label: maneuver?.label ?? "",
        thrown: maneuver?.thrown ?? null,
        prepared: !!maneuver?.prepared,
        free: !!maneuver?.free || (reaction === "riposte"),
        attackId: maneuver?.attackId ?? null,
        // Whether the Blow is ranged: a melee-only Reaction (Slip the Line, Parry, Deflecting
        // Palms; PHB v4.21) answers a melee Blow alone. A Cast is never melee.
        ranged: (source === "spell") ? true : !!maneuver?.ranged,
        // 0.12.0: a Reaction Strike (Intercept, the Riposte) is answered by a basic Defense alone
        // (a Reaction never triggers a Reaction); the Threat names the two Defenses that answer.
        reaction,
        basicOnly: !!reaction || !!maneuver?.basicOnly,
        threat,
        defenses,
        spell,
        // The attack's traits (0.14.0): the weapon's, the attack Item's or the spell Talent's, as
        // declared, for the Automation rules' `IF(Trait=...)` on the defender's side.
        traits: Array.isArray(maneuver?.traits) ? maneuver.traits.map(t => String(t)) : []
      },
      targets: targets.map((target, index) => {
        const snapshot = {
          actorUuid: target.actorUuid ?? "",
          tokenUuid: target.tokenUuid ?? "",
          name: target.name ?? "",
          isPlayer: !!target.isPlayer,
          controllerUserIds: [...(target.controllerUserIds ?? [])]
        };
        const who = AttackWorkflow.rollerFor({ attacker: attackerSnapshot, defender: snapshot });
        return {
          id: target.id ?? `t${index + 1}`,
          ...snapshot,
          committed: false,
          revealed: null,
          roller: who.roller,
          rollType: who.rollType,
          roll: null,
          outcome: null,
          threshold: null,
          resolutionMessageId: null
        };
      }),
      attackRoll: null,
      log: [],
      messageId: null
    };
  }

  /* -------------------------------------------- */
  /*  The profile                                 */
  /* -------------------------------------------- */

  /**
   * What the defenders of a Maneuver may answer with (0.12.0): the two Defenses its Threat permits
   * (a Blow Evade or Guard; a spell's Threat, or the Defenses its sheet names), whether only a
   * basic Defense answers (a Reaction Strike), whether the melee-only Reactions apply, and whether
   * the resolution offers Position (never for a spell). A record from before 0.12.0 names none of
   * this and reads as a Blow.
   * @param {object} maneuver
   * @returns {{defenses: string[], basicOnly: boolean, melee: boolean, canPosition: boolean, source: string}}
   */
  static profileFor(maneuver) {
    const m = maneuver ?? {};
    const source = m.source ?? "weapon";
    const threat = SW.THREATS[m.threat] ? m.threat : "blow";
    const named = Array.isArray(m.defenses) ? m.defenses.filter(d => SW.DEFENSES[d]) : [];
    return {
      source,
      defenses: named.length ? [...named] : [...SW.THREATS[threat].defenses],
      basicOnly: !!m.basicOnly || !!m.reaction,
      melee: (source !== "spell") && !m.ranged,
      canPosition: source !== "spell"
    };
  }

  /* -------------------------------------------- */
  /*  Phases                                      */
  /* -------------------------------------------- */

  /** May a workflow in `from` move to `to`? */
  static canTransition(from, to) {
    return (TRANSITIONS[from] ?? []).includes(to);
  }

  /**
   * Move a workflow to its next phase, or throw: an illegal transition is a programming error,
   * never something the table should see.
   * @param {object} workflow
   * @param {string} to
   * @returns {object} the workflow
   */
  static transition(workflow, to) {
    if (!AttackWorkflow.canTransition(workflow.phase, to)) {
      throw new Error(`STARWROUGHT | attack workflow ${workflow.id}: no transition ${workflow.phase} -> ${to}`);
    }
    workflow.phase = to;
    return workflow;
  }

  /** Finished: complete or cancelled. */
  static isTerminal(phase) {
    return TERMINAL_PHASES.includes(phase);
  }

  /** Still in play. */
  static isLive(workflow) {
    return !!workflow && PHASES.includes(workflow.phase) && !TERMINAL_PHASES.includes(workflow.phase);
  }

  /** Is this request allowed in this phase? Unknown actions are not. */
  static actionAllowed(action, phase) {
    const spec = ACTIONS[action];
    if (!spec) return false;
    if (spec.phases === null) return true;
    return spec.phases.includes(phase);
  }

  /** Is this request one of the GM controls? */
  static actionNeedsGm(action) {
    return !!ACTIONS[action]?.gm;
  }

  /* -------------------------------------------- */
  /*  Who rolls                                   */
  /* -------------------------------------------- */

  /**
   * Who throws the die for a pairing (brief, "Who rolls"; PHB v4.10: the players roll everything).
   *  - A player-controlled attacker rolls Attack, once, whoever the targets are; that one roll is
   *    read against every defender's Threshold. Player against player is not an opposed roll.
   *  - An adversary's Blow at a player-controlled defender: the defender rolls Defense against the
   *    adversary's Attack Threshold.
   *  - Adversary against adversary: isolated. The GM rolls the attacker's Attack flat (the
   *    adversary model has no attack modifier) against the defender's Threshold through the same
   *    engine. Flagged `isolated` so nothing about it shapes the player-facing path.
   * @param {{attacker: {isPlayer: boolean}, defender?: {isPlayer: boolean}, target?: {isPlayer: boolean}}} pairing
   * @returns {{roller: "attacker"|"defender", rollType: "attack"|"defense", isolated: boolean}}
   */
  static rollerFor(pairing) {
    const attackerIsPlayer = !!pairing?.attacker?.isPlayer;
    const defender = pairing?.defender ?? pairing?.target ?? null;
    const defenderIsPlayer = !!defender?.isPlayer;
    if (attackerIsPlayer) return { roller: "attacker", rollType: "attack", isolated: false };
    if (defenderIsPlayer) return { roller: "defender", rollType: "defense", isolated: false };
    return { roller: "attacker", rollType: "attack", isolated: true };
  }

  /* -------------------------------------------- */
  /*  Pairings                                    */
  /* -------------------------------------------- */

  /** One target row by its id. */
  static targetOf(workflow, targetId) {
    return workflow?.targets?.find(t => t.id === targetId) ?? null;
  }

  /** Has every defender committed? (The reveal fires the moment this is true.) */
  static allCommitted(workflow) {
    return !!workflow?.targets?.length && workflow.targets.every(t => !!t.committed);
  }

  /** Has every pairing its roll? (Resolution fires the moment this is true.) */
  static allRolled(workflow) {
    return !!workflow?.targets?.length && workflow.targets.every(t => !!t.roll);
  }

  /**
   * The roll a pairing resolves with: the attacker's one roll for every pairing the attacker rolls,
   * the defender's own for a Defense roll.
   */
  static rollDataFor(workflow, target) {
    if (!workflow || !target) return null;
    return (target.roller === "attacker") ? (workflow.attackRoll ?? null) : (target.roll ?? null);
  }

  /* -------------------------------------------- */
  /*  Outstanding actions                         */
  /* -------------------------------------------- */

  /**
   * What this user still has to do on a workflow (brief, "Outstanding actions"): the prompt lists
   * these, the card shows the viewer's one, and Resend prompts re-emits them.
   *  - `defending`: `defend` for each uncommitted player-controlled defender this user controls;
   *    `gmDefend` for each uncommitted adversary defender, the GM's to declare; `gmDefendAbsent`
   *    (0.12.0) for the GM on each uncommitted player-controlled defender the GM does not control,
   *    so an absent player's character is answered for explicitly, never by a default.
   *  - `rolling`: `rollAttack`, once, while any pairing waits on the attacker's die (one roll fills
   *    every pairing the attacker rolls); `rollDefense` for each pairing whose defender rolls.
   *  - Any other phase: nothing. The coordinator does the resolving.
   * @param {object} workflow            A workflow record or its public projection.
   * @param {{id: string, isGM: boolean}} user
   * @returns {Array<{workflowId: string, kind: string, targetId: string}>}
   */
  static outstandingFor(workflow, user) {
    const out = [];
    if (!workflow || !user || !Array.isArray(workflow.targets)) return out;
    const workflowId = workflow.id;

    if (workflow.phase === "defending") {
      for (const target of workflow.targets) {
        if (target.committed) continue;
        if (target.isPlayer) {
          if (controls(user, target)) out.push({ workflowId, kind: "defend", targetId: target.id });
          else if (user.isGM) out.push({ workflowId, kind: "gmDefendAbsent", targetId: target.id });
        } else if (user.isGM) {
          out.push({ workflowId, kind: "gmDefend", targetId: target.id });
        }
      }
      return out;
    }

    if (workflow.phase === "rolling") {
      let attackListed = false;
      for (const target of workflow.targets) {
        if (target.roll || target.outcome) continue;
        if (target.roller === "attacker") {
          // The attacker's roll is one die for every pairing they roll: list it once.
          if (attackListed || workflow.attackRoll) continue;
          if (controls(user, workflow.attacker)) {
            out.push({ workflowId, kind: "rollAttack", targetId: target.id });
            attackListed = true;
          }
        } else if (controls(user, target)) {
          out.push({ workflowId, kind: "rollDefense", targetId: target.id });
        }
      }
    }
    return out;
  }

  /**
   * The defenders nobody connected can answer for (0.12.0, ruling 162): with no GM connected, an
   * uncommitted adversary waits for one; nothing answers in its place. The caller passes whether
   * a GM is active, since this module reads no Foundry global.
   * @param {object} workflow
   * @param {{gmActive: boolean}} options
   * @returns {object[]} the waiting target rows
   */
  static waitingForGm(workflow, { gmActive } = {}) {
    if (gmActive || (workflow?.phase !== "defending")) return [];
    return (workflow.targets ?? []).filter(t => !t.committed && !t.isPlayer);
  }

  /* -------------------------------------------- */
  /*  Visibility                                  */
  /* -------------------------------------------- */

  /**
   * May this user see a defender's Threshold (brief, "Visibility")? An adversary's never: players
   * see outcomes, not the number, so it is not even projected. A player-controlled defender's is
   * the defender's own and the GM's always, and the attacker's only when the world setting
   * `attackShowPcThresholds` is on. `user === null` is the shared projection (the card's flags and
   * the state broadcast): it carries a character's Threshold, and the render hook prunes it per
   * viewer; an adversary's is still withheld there.
   * @param {object} workflow
   * @param {object} target
   * @param {{id: string, isGM: boolean}|null} user
   * @param {{showPcThresholds?: boolean}} [policy]
   * @returns {boolean}
   */
  static thresholdVisibleTo(workflow, target, user, { showPcThresholds = false } = {}) {
    if (!target?.isPlayer) return false;
    if (target.threshold === null || target.threshold === undefined) return false;
    if (user === null) return true;
    if (!user) return false;
    if (user.isGM) return true;
    if ((target.controllerUserIds ?? []).includes(user.id)) return true;
    if (showPcThresholds && (workflow?.attacker?.controllerUserIds ?? []).includes(user.id)) return true;
    return false;
  }

  /**
   * The public projection of a workflow (brief, "Data shapes"): what the card's flags and the
   * state broadcast carry, and what a client may hold. Whatever else the coordinator keeps on its
   * record (a `private` map of commitments before the reveal, an adversary's Threshold) is left
   * behind here: the projection is built field by field, never by copying the record.
   * @param {object} workflow
   * @param {{id: string, isGM: boolean}|null} [user]  The viewer; null for the shared projection.
   * @param {{showPcThresholds?: boolean}} [policy]
   * @returns {object|null}
   */
  static projectFor(workflow, user = null, policy = {}) {
    if (!workflow) return null;
    return {
      id: workflow.id,
      revision: workflow.revision ?? 0,
      phase: workflow.phase,
      coordinatorUserId: workflow.coordinatorUserId ?? null,
      initiatingUserId: workflow.initiatingUserId ?? null,
      attacker: clone(workflow.attacker),
      maneuver: clone(workflow.maneuver),
      targets: (workflow.targets ?? []).map(target => ({
        id: target.id,
        actorUuid: target.actorUuid ?? "",
        tokenUuid: target.tokenUuid ?? "",
        name: target.name ?? "",
        isPlayer: !!target.isPlayer,
        controllerUserIds: [...(target.controllerUserIds ?? [])],
        committed: !!target.committed,
        revealed: clone(target.revealed),
        roller: target.roller,
        rollType: target.rollType,
        roll: clone(target.roll),
        outcome: target.outcome ?? null,
        threshold: AttackWorkflow.thresholdVisibleTo(workflow, target, user, policy) ? target.threshold : null,
        resolutionMessageId: target.resolutionMessageId ?? null
      })),
      attackRoll: clone(workflow.attackRoll),
      log: [...(workflow.log ?? [])],
      messageId: workflow.messageId ?? null
    };
  }
}
