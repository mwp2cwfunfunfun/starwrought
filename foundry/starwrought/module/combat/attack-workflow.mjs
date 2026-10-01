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
  useStances: Object.freeze({ phases: Object.freeze(["defending"]), gm: true }),
  requestState: Object.freeze({ phases: PHASES, gm: false })
});

/** The kinds of outstanding action `outstandingFor` reports (brief, "Outstanding actions"). */
export const OUTSTANDING_KINDS = Object.freeze(["defend", "rollAttack", "rollDefense", "gmDefend"]);

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
 * controlling players alone (the GM has `useStances` and the card's owner-gated buttons rather
 * than a prompt row for every character); a character nobody but the GM owns, and every
 * adversary, is the GM's.
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
    const strike = SW.STRIKE_KINDS[maneuver?.strike] ? maneuver.strike : SW.DEFAULT_STRIKE;
    const kind = SW.STRIKE_KINDS[strike];
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
        weaponId: maneuver?.weaponId ?? null,
        weaponName: maneuver?.weaponName ?? "",
        strike,
        glyph: maneuver?.glyph ?? SW.ACTION_GLYPHS[kind.cost] ?? "",
        label: maneuver?.label ?? "",
        thrown: maneuver?.thrown ?? null,
        prepared: !!maneuver?.prepared,
        free: !!maneuver?.free,
        attackId: maneuver?.attackId ?? null,
        // Whether the Blow is ranged, for the stance reading and the Counter rule (PHB v4.10,
        // Answering an Attack: Counter answers a melee Blow within Reach only).
        ranged: !!maneuver?.ranged
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
   *    `gmDefend` for each uncommitted adversary defender, the GM's to declare.
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
