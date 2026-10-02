/**
 * The attack coordinator (0.5.0 brief, "Coordination"): the one client that runs a declared Blow
 * from declaration to resolution, and the socket protocol every other client talks to it with.
 *
 * The table's steps (PHB v4.10, The Exchange, as the brief words them):
 *  1. The attacker declares a Maneuver at one or more targets; once declared it is locked.
 *  2. Every defender commits, in private, a Defense (Evade or Guard) and an answer built on it:
 *     nothing, a Reaction they own, or a Posture ⓿↺ with the Zone it Exposes.
 *  3. When every defender has committed, every commitment reveals at once.
 *  4. The players roll: a player-controlled attacker once, read against every Threshold; a
 *     player-controlled defender of an adversary's Blow against the adversary's Attack Threshold.
 *  5. Each pairing resolves to Miss, Graze, Hit or Critical Hit with today's full card.
 *
 * Three rules shape this file:
 *  - One writer. The coordinator is `game.users.activeGM` when a GM is connected, otherwise the
 *    attacker's user. Every mutation is a socket request to it; it alone validates, changes the
 *    phase, bumps the revision, writes the card and broadcasts the new state. A client that is the
 *    coordinator calls the handler directly.
 *  - Privacy is memory, not whispers. A commitment before the reveal exists in exactly two places:
 *    this client's memory (mirrored to the client-scope setting `attackPrivate` so a reload
 *    restores it) and the committing user's own prompt. It reaches no flag, document or message
 *    until the reveal. The public state (brief, "Data shapes") lives in the card's flags.
 *  - Thresholds are never trusted from a client. A client submits semantic choices; the
 *    coordinator computes every Threshold from actor data when it resolves, and strips an
 *    adversary's number from everything players receive.
 */

import * as SW from "../config.mjs";
import { AttackWorkflow, ACTIONS, TERMINAL_PHASES } from "./attack-workflow.mjs";
import { renderAttackCard, updateAttackCard, mayControl } from "./attack-card.mjs";
import { SwCheck } from "../dice/check.mjs";
import { isLegalAnswer, postureName } from "../helpers/answers.mjs";
import { gapBetween } from "../canvas/geometry.mjs";

/** The socket channel system.json declares (`"socket": true`). */
export const SOCKET = `system.${SW.SYSTEM_ID}`;

/** The custom hook every client fires after a state broadcast; the prompt listens. */
export const HOOK = "starwrought.attack";

/** How long a request waits for the coordinator before it is given up as unanswered. */
const REQUEST_TIMEOUT = 15000;

/** How long a card update waits for the matching socket broadcast before it stands in for it. */
const SYNC_GRACE = 1500;

/**
 * A Posture's bonus (brief, "What the table does": "+2 Situation to that Defense"). Used only by
 * the fallback Threshold arithmetic below; `SwActor#defenseThresholdFor` is the authority.
 */
const POSTURE_BONUS = 2;

/** Rejection reasons on the wire, and the string the requester shows for each. */
const REASONS = Object.freeze({
  stale: "STARWROUGHT.Attack.stale",
  notYours: "STARWROUGHT.Attack.notYours",
  noCoordinator: "STARWROUGHT.Attack.noCoordinator",
  missing: "STARWROUGHT.Attack.missing",
  wrongPhase: "STARWROUGHT.Attack.wrongPhase",
  illegal: "STARWROUGHT.Attack.illegalAnswer",
  gmOnly: "STARWROUGHT.Attack.gmOnly",
  counterNeedsMelee: "STARWROUGHT.Prompt.counterNeedsMelee",
  noTargets: "STARWROUGHT.Attack.noTargets",
  alreadyDeclared: "STARWROUGHT.Attack.alreadyDeclared",
  noActor: "STARWROUGHT.Notify.noActor",
  noWeapon: "STARWROUGHT.Notify.noWeapon",
  badRoll: "STARWROUGHT.Attack.badRoll",
  timeout: "STARWROUGHT.Attack.timeout",
  error: "STARWROUGHT.Attack.failed"
});

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** The Actor behind a uuid that names an Actor or a Token (the system's convention everywhere). */
function resolveActor(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { return null; }
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  return doc.actor ?? null;
}

/** The TokenDocument behind a Token uuid, or an Actor's first token on the scene. */
function resolveTokenDoc(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { return null; }
  if (!doc) return null;
  if (doc.documentName === "Token") return doc;
  if (doc.documentName === "Actor") return doc.getActiveTokens(false, true)[0] ?? null;
  return null;
}

/** A setting that may not be registered yet, read without throwing. */
function setting(key, fallback) {
  try { return game.settings.get(SW.SYSTEM_ID, key); } catch { return fallback; }
}

/** The non-GM users who own an actor: the players whose decision it is. */
function controllersOf(actor) {
  return game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => u.id);
}

/**
 * An actor as the workflow records it. `isPlayer` is `announcesSpends` (a character, or anything
 * a player owns), the brief's definition of player-controlled.
 */
function snapshot(actor, tokenDoc) {
  return {
    actorUuid: actor.uuid,
    tokenUuid: tokenDoc?.uuid ?? "",
    // The token's name, not the actor's: the token name is the one the GM chose to show.
    name: tokenDoc?.name ?? actor.name,
    isPlayer: !!actor.announcesSpends,
    controllerUserIds: controllersOf(actor)
  };
}

/** The Posture a client committed, in the shape the record keeps, or null. */
function normalizePosture(posture) {
  if (!posture || (typeof posture !== "object") || !posture.talentId) return null;
  return { talentId: String(posture.talentId), zone: posture.zone ? String(posture.zone) : null };
}

/** The roll a client submitted, checked for the pieces resolution needs, or null. */
function normalizeRollData(rollData) {
  if (!rollData || (typeof rollData !== "object")) return null;
  if (!rollData.roll || (typeof rollData.roll !== "object")) return null;
  const total = Number(rollData.total ?? rollData.roll.total);
  if (!Number.isFinite(total)) return null;
  const natural = Number.isFinite(Number(rollData.natural)) ? Number(rollData.natural) : null;
  return {
    roll: rollData.roll,
    total,
    natural,
    formula: String(rollData.formula ?? rollData.roll.formula ?? ""),
    modifiers: Array.isArray(rollData.modifiers) ? rollData.modifiers : []
  };
}

/* -------------------------------------------- */
/*  The coordinator                             */
/* -------------------------------------------- */

export class AttackCoordinator {
  /** The state model, for callers that reach this class through `game.starwrought.attacks`. */
  static Workflow = AttackWorkflow;

  /** Live workflows by id: the full record on the coordinator, the latest public state elsewhere. */
  static #workflows = new Map();

  /** Coordinator only: commitments before the reveal, by workflow id then target id. */
  static #private = new Map();

  /** Coordinator only, memory only: the revision at which the current phase (or a reset) began. */
  static #meta = new Map();

  /** Requests this client is waiting on, by request id. */
  static #pending = new Map();

  /** Posture Exposures this client has applied, keyed on workflow, target and reveal revision. */
  static #applied = new Set();

  /** Deferred catch-ups from card updates, by workflow id (see #syncFromMessage). */
  static #syncTimers = new Map();

  /**
   * Coordinator only: the resolution loop in flight per workflow, so a second caller (two rolls
   * landing within one card write of each other, or an adoption mid-resolution) joins it instead
   * of starting another and posting every pairing twice (review, 2026-10-01).
   */
  static #resolving = new Map();

  static #registered = false;

  /* -------------------------------------------- */
  /*  Registration and recovery                   */
  /* -------------------------------------------- */

  /**
   * Hook up everything but the socket, which starwrought.mjs registers at `ready` with
   * `game.socket.on("system.starwrought", AttackCoordinator.onSocket)`.
   */
  static register() {
    if (AttackCoordinator.#registered) return;
    AttackCoordinator.#registered = true;
    Hooks.on("userConnected", (user, connected) => AttackCoordinator.onUserConnected(user, connected));
    // A client that missed a broadcast (reconnecting, say) still receives the card's document
    // update; the flags are the persisted public state, so they refresh the local copy.
    Hooks.on("createChatMessage", message => AttackCoordinator.#syncFromMessage(message));
    Hooks.on("updateChatMessage", message => AttackCoordinator.#syncFromMessage(message));
  }

  /**
   * At `ready`: rebuild the live workflows from the chat log (every message whose
   * `flags.starwrought.attackWorkflow.phase` is not complete or cancelled), restore this client's
   * private commitments from the `attackPrivate` setting, take up whatever this client should be
   * coordinating, and tell this client's prompt what is outstanding.
   */
  static async rebuild() {
    AttackCoordinator.#workflows.clear();
    AttackCoordinator.#meta.clear();
    AttackCoordinator.#private.clear();
    const stored = setting("attackPrivate", {}) ?? {};

    for (const message of game.messages) {
      const flags = message.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
      if (!flags?.id || TERMINAL_PHASES.includes(flags.phase)) continue;
      // A card is believed only from a hand that could have written it (review, 2026-10-01).
      if (!AttackCoordinator.#trustedCard(message, flags)) continue;
      const record = foundry.utils.deepClone(flags);
      record.messageId ||= message.id;
      record.log = Array.isArray(record.log) ? record.log : [];
      AttackCoordinator.#workflows.set(record.id, record);
      // Strict until the next change: nothing is known about what moved before the reload.
      AttackCoordinator.#meta.set(record.id, { phaseRevision: record.revision ?? 0 });
      if (stored[record.id] && (typeof stored[record.id] === "object")) {
        AttackCoordinator.#private.set(record.id, foundry.utils.deepClone(stored[record.id]));
      }
    }
    // Commitments for workflows that have finished are of no use to anyone.
    await AttackCoordinator.#savePrivate();

    for (const workflow of [...AttackCoordinator.#workflows.values()]) {
      try {
        await AttackCoordinator.#takeUp(workflow);
      } catch (err) {
        console.error(`STARWROUGHT | attack workflow ${workflow.id} could not be resumed`, err);
      }
    }
    for (const workflow of AttackCoordinator.#workflows.values()) {
      Hooks.callAll(HOOK, { type: "prompt", workflow: AttackCoordinator.get(workflow.id) });
    }
  }

  /**
   * A user came or went. A workflow whose coordinator has gone is taken up by whoever the
   * election now names, if that is this client; everyone else re-evaluates their prompts (the
   * `noCoordinator` line comes and goes with the GM).
   */
  static async onUserConnected(user, connected) {
    for (const workflow of [...AttackCoordinator.#workflows.values()]) {
      if (TERMINAL_PHASES.includes(workflow.phase)) continue;
      const elected = AttackCoordinator.coordinatorFor(workflow);
      if ((elected === game.user.id) && (workflow.coordinatorUserId !== game.user.id)) {
        try {
          await AttackCoordinator.#takeUp(workflow);
        } catch (err) {
          console.error(`STARWROUGHT | attack workflow ${workflow.id} could not be taken up`, err);
        }
      } else if (!connected && user.isGM && !game.users.activeGM && (elected === game.user.id)
        && (workflow.phase === "defending")) {
        // The last GM left while this client coordinates: the adversaries nobody can now declare
        // for answer with their standing stances at once, as they would have at the declaration
        // (review, 2026-10-01).
        try {
          const before = workflow.revision;
          await AttackCoordinator.#commitUnanswerable(workflow);
          if (workflow.revision !== before) {
            await AttackCoordinator.#persist(workflow);
            await AttackCoordinator.#broadcast(workflow, "state");
            await AttackCoordinator.#advanceIfReady(workflow);
          }
        } catch (err) {
          console.error(`STARWROUGHT | attack workflow ${workflow.id}: adversaries could not answer`, err);
        }
      } else if (!connected || (elected !== game.user.id)) {
        Hooks.callAll(HOOK, { type: "state", workflow: AttackCoordinator.get(workflow.id) });
      }
    }
  }

  /**
   * Become, or go on being, the coordinator of a workflow this client is elected for.
   *
   * Adoption (the stored coordinator is gone): the public state carries on; the private
   * commitments do not, so a workflow still in `defending` resets ("Defenses reset: choose
   * again", brief, "Visibility"). A workflow past the reveal needs nothing private and resumes
   * where it stood: the die if it is still awaited, the resolution if every roll is in.
   */
  static async #takeUp(workflow) {
    if (AttackCoordinator.coordinatorFor(workflow) !== game.user.id) return;
    let changed = false;

    if (workflow.coordinatorUserId !== game.user.id) {
      if (!AttackCoordinator.#canWriteCard(workflow, game.user)) return;
      workflow.coordinatorUserId = game.user.id;
      workflow.log.push(format("STARWROUGHT.Attack.adopted", { name: game.user.name }));
      AttackCoordinator.#private.delete(workflow.id);
      changed = true;
    }

    // The record says committed but this client holds no commitment for it: the private half of
    // the defense phase is lost, so the phase starts over.
    if (workflow.phase === "defending") {
      const store = AttackCoordinator.#private.get(workflow.id) ?? {};
      const lost = workflow.targets.some(t => t.committed && !store[t.id]);
      if (lost) {
        AttackCoordinator.#clearCommitments(workflow);
        workflow.log.push(localize("STARWROUGHT.Attack.reset"));
        changed = true;
      }
    }

    if (changed) {
      AttackCoordinator.#bump(workflow, { phase: true });
      await AttackCoordinator.#commitUnanswerable(workflow);
      await AttackCoordinator.#persist(workflow);
    }
    await AttackCoordinator.#broadcast(workflow, "prompt");
    await AttackCoordinator.#advanceIfReady(workflow);
  }

  /* -------------------------------------------- */
  /*  Election                                    */
  /* -------------------------------------------- */

  /**
   * The user coordinating a workflow right now: the stored coordinator while connected, else the
   * active GM, else the attacker's user when they are connected and may write the card. Null when
   * nobody can (the GM authored the card and left): requests are refused with `noCoordinator`
   * until a GM returns and adopts it.
   * @param {object} workflow
   * @returns {string|null} a user id
   */
  static coordinatorFor(workflow) {
    if (!workflow) return null;
    const stored = workflow.coordinatorUserId ? game.users.get(workflow.coordinatorUserId) : null;
    if (stored?.active) return stored.id;
    const gm = game.users.activeGM;
    if (gm) return gm.id;
    const initiator = workflow.initiatingUserId ? game.users.get(workflow.initiatingUserId) : null;
    if (initiator?.active && AttackCoordinator.#canWriteCard(workflow, initiator)) return initiator.id;
    return null;
  }

  /** Is this client the coordinator of a workflow? */
  static isCoordinator(workflow) {
    return !!workflow && (AttackCoordinator.coordinatorFor(workflow) === game.user.id);
  }

  /** Only a message's author or a GM may update a ChatMessage: the card's writer must be one. */
  static #canWriteCard(workflow, user) {
    if (!user) return false;
    const message = workflow.messageId ? game.messages.get(workflow.messageId) : null;
    if (!message) return true;
    return user.isGM || (message.author?.id === user.id);
  }

  /**
   * The GM controls: the GM's, or, at a table with no GM connected, the coordinator's. One
   * definition, in attack-card.mjs, so the card, the click handler and this check agree on who
   * sees and who may press them (review, 2026-10-01).
   */
  static #mayControl(user, workflow) {
    return mayControl(user, workflow);
  }

  /* -------------------------------------------- */
  /*  Reading                                     */
  /* -------------------------------------------- */

  /**
   * One live workflow as this user may see it: the public state, with a character's Threshold
   * only where the visibility policy allows (brief, "Visibility").
   * @param {string} id
   * @param {object} [options]
   * @param {User|null} [options.forUser]  Defaults to this client's user.
   * @returns {object|null}
   */
  static get(id, { forUser = game.user } = {}) {
    const workflow = AttackCoordinator.#workflows.get(id);
    if (!workflow) return null;
    return AttackWorkflow.projectFor(workflow, forUser ?? null, {
      showPcThresholds: !!setting("attackShowPcThresholds", false)
    });
  }

  /** Every live workflow, as this user may see them. */
  static live({ forUser = game.user } = {}) {
    return [...AttackCoordinator.#workflows.values()]
      .filter(w => !TERMINAL_PHASES.includes(w.phase))
      .map(w => AttackCoordinator.get(w.id, { forUser }));
  }

  /** Everything this user still has to do, across every live workflow. */
  static outstanding(user = game.user) {
    const out = [];
    for (const workflow of AttackCoordinator.#workflows.values()) {
      out.push(...AttackWorkflow.outstandingFor(workflow, user));
    }
    return out;
  }

  /** The shared projection: no private state, no adversary Thresholds. */
  static #public(workflow) {
    return AttackWorkflow.projectFor(workflow, null);
  }

  /* -------------------------------------------- */
  /*  Entry: declare                              */
  /* -------------------------------------------- */

  /**
   * Declare a Maneuver (brief, "Entry points"): `SwActor#rollAttack` calls this instead of rolling
   * when the attack flow is on and there is a target; an adversary's `attackWith` likewise.
   * Targets are snapshotted now; changing Foundry targets afterwards changes nothing.
   * @param {object} spec
   * @param {Actor} spec.attacker
   * @param {string|null} [spec.weaponId]   The weapon Item, for a character's Strike.
   * @param {string|null} [spec.attackId]   The attack row's action Item, for an adversary's.
   * @param {string} spec.strike            quick | deliberate | committed.
   * @param {Token[]} spec.targets          Token placeables (or TokenDocuments) with actors.
   * @param {boolean} [spec.prepared]       A Prepared Committed Strike being finished: already paid.
   * @param {boolean} [spec.free]           A Strike a Reaction paid for.
   * @param {boolean} [spec.thrown]         Throw it; inferred from distance when omitted.
   * @returns {Promise<object|null>} the public state, or null when nothing was declared
   */
  static async declare({ attacker, weaponId = null, attackId = null, strike, targets = [], prepared = false, free = false, thrown } = {}) {
    if (!attacker) return null;
    if (!attacker.isOwner) {
      ui.notifications.warn(localize("STARWROUGHT.Notify.notOwner"));
      return null;
    }
    const tokens = (targets ?? []).filter(t => t && (t.actor ?? t.document?.actor));
    if (!tokens.length) {
      ui.notifications.warn(localize("STARWROUGHT.Attack.noTargets"));
      return null;
    }
    const payload = {
      attackerUuid: attacker.uuid,
      attackerTokenUuid: attacker.tokenOnScene?.()?.uuid ?? "",
      weaponId: weaponId || null,
      attackId: attackId || null,
      strike: SW.STRIKE_KINDS[strike] ? strike : SW.DEFAULT_STRIKE,
      prepared: !!prepared,
      free: !!free,
      thrown: (thrown === undefined || thrown === null) ? null : !!thrown,
      targets: tokens.map(t => {
        const doc = t.document ?? t;
        return { tokenUuid: doc.uuid ?? "", actorUuid: (t.actor ?? doc.actor).uuid };
      })
    };
    const reply = await AttackCoordinator.request("declare", { workflowId: null, expectedRevision: null, payload });
    if (!reply?.ok) return null;
    return reply.public ?? AttackCoordinator.get(reply.workflowId);
  }

  /* -------------------------------------------- */
  /*  Requests and the socket                     */
  /* -------------------------------------------- */

  /**
   * Send a mutating request to the coordinator and await its reply (brief, "Data shapes":
   * `{ type: "attack", requestId, workflowId, expectedRevision, action, payload, userId }`). A
   * client that is the coordinator handles it directly. A rejection is shown to the requester.
   * @param {string} action   declare | commitDefense | submitRoll | cancel | resetDefenses |
   *                          resendPrompts | useStances | requestState
   * @param {object} options
   * @param {string|null} options.workflowId
   * @param {number|null} options.expectedRevision
   * @param {object} [options.payload]
   * @returns {Promise<{ok: boolean, reason?: string, revision?: number, public?: object, private?: object}>}
   */
  static async request(action, { workflowId = null, expectedRevision = null, payload = {} } = {}) {
    const requestId = foundry.utils.randomID();
    const message = {
      type: "attack", requestId, workflowId, expectedRevision, action,
      payload: payload ?? {}, userId: game.user.id
    };
    const to = (action === "declare")
      ? (game.users.activeGM?.id ?? game.user.id)
      : AttackCoordinator.coordinatorFor(AttackCoordinator.#workflows.get(workflowId));
    let reply;
    if (!to) {
      reply = { type: "attack:reply", requestId, ok: false, reason: "noCoordinator", workflowId };
    } else {
      message.to = to;
      reply = (to === game.user.id)
        ? await AttackCoordinator.#handle(message)
        : await AttackCoordinator.#send(message);
    }
    AttackCoordinator.#notifyRejection(reply);
    return reply;
  }

  /**
   * Emit a request and wait for the coordinator's reply, or a timeout. The request is delivered to
   * the coordinator alone (`recipients`): Foundry's server honours that option on a system socket
   * and emits to no one else, so a defender's commitment never passes through another player's
   * browser on its way to the coordinator (review, 2026-10-01). A coordinator that does not answer
   * in time is reported as such, not as gone.
   */
  static #send(message) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        AttackCoordinator.#pending.delete(message.requestId);
        resolve({ type: "attack:reply", requestId: message.requestId, ok: false, reason: "timeout", workflowId: message.workflowId });
      }, REQUEST_TIMEOUT);
      AttackCoordinator.#pending.set(message.requestId, { resolve, timer, to: message.to });
      try {
        game.socket.emit(SOCKET, message, { recipients: [message.to] });
      } catch (err) {
        clearTimeout(timer);
        AttackCoordinator.#pending.delete(message.requestId);
        console.error("STARWROUGHT | attack request could not be sent", err);
        resolve({ type: "attack:reply", requestId: message.requestId, ok: false, reason: "timeout", workflowId: message.workflowId });
      }
    });
  }

  /** Rejections are visible, never silent (brief, "Coordination"). */
  static #notifyRejection(reply) {
    if (!reply || reply.ok) return;
    const key = REASONS[reply.reason] ?? REASONS.error;
    const text = reply.reasonData ? format(key, reply.reasonData) : localize(key);
    ui.notifications.warn(text);
  }

  /**
   * The socket handler: starwrought.mjs registers it at `ready`. Requests and replies carry `to`,
   * the user they are for, and are emitted with `recipients` so the server delivers them to that
   * user alone; state broadcasts are for everyone. Written against the class name rather than
   * `this` so it may be passed unbound.
   *
   * Who is asking is the second argument: Foundry's server appends the emitting user's id to every
   * relayed `system.<id>` event (`handleCustomSocket`: `emit(event, data, userId)`), bound from the
   * session, so it is the one thing on the wire a client cannot write. The payload's `userId` is
   * informational; a request without a server-supplied sender is refused outright, and a reply is
   * accepted only from the coordinator it was sent to (review, 2026-10-01).
   * @param {object} message
   * @param {string} [senderId]  The emitting user's id, supplied by the server.
   */
  static onSocket(message, senderId) {
    if (!message || (typeof message !== "object")) return;
    const sender = (typeof senderId === "string") ? senderId : null;
    switch (message.type) {
      case "attack":
        if (message.to !== game.user.id) return;
        if (!sender || !game.users.has(sender)) return;
        AttackCoordinator.#handle({ ...message, userId: sender })
          .then(reply => { if (reply) game.socket.emit(SOCKET, reply, { recipients: [reply.to] }); })
          .catch(err => console.error("STARWROUGHT | attack request failed", err));
        return;
      case "attack:reply":
        if (message.to !== game.user.id) return;
        AttackCoordinator.#onReply(message, sender);
        return;
      case "attack:state":
        AttackCoordinator.#onState(message, sender);
        return;
      default:
        return;
    }
  }

  /** A reply to one of this client's requests, from the coordinator the request went to. */
  static #onReply(reply, sender) {
    const pending = AttackCoordinator.#pending.get(reply.requestId);
    if (!pending) return;
    if (pending.to && sender && (sender !== pending.to)) return;
    clearTimeout(pending.timer);
    AttackCoordinator.#pending.delete(reply.requestId);
    pending.resolve(reply);
  }

  /**
   * A state broadcast (`{ type: "attack:state", workflowId, revision, event, public }`), from the
   * coordinator or from this client's own emit. Every client keeps the latest public state, applies
   * the reveal's Postures for actors it owns, and fires the `starwrought.attack` hook the prompt
   * listens to.
   */
  static #onState(message, sender = null) {
    const claimed = message?.public;
    if (!claimed?.id) return;
    const current = AttackCoordinator.#workflows.get(claimed.id);
    // The socket is a relay any connected client may write to, so a broadcast is a wake-up and
    // never a source of state. The state is the card's flags: only the author or a GM may update
    // a ChatMessage, and the coordinator writes the card before every broadcast, so the document
    // reaches each client ahead of the socket message (review, 2026-10-01). This client's own
    // local call from #broadcast carries no sender and its own state, and passes the same test.
    const pub = (sender === null) && (claimed.coordinatorUserId === game.user.id)
      ? claimed
      : AttackCoordinator.#fromCard(current, claimed);
    if (!pub) return;
    // The coordinator's own record is the richer one; everyone else keeps the projection. A
    // record this client coordinated before the GM adopted the Blow is stale and yields too.
    const mine = !!current && (current.coordinatorUserId === game.user.id) && (pub.coordinatorUserId === game.user.id);
    if (!mine && (!current || ((pub.revision ?? 0) >= (current.revision ?? 0)))) {
      AttackCoordinator.#workflows.set(pub.id, foundry.utils.deepClone(pub));
    }
    AttackCoordinator.#applyReveal(pub);
    Hooks.callAll(HOOK, { type: message.event ?? "state", workflow: pub });
    if (TERMINAL_PHASES.includes(pub.phase)) AttackCoordinator.#forget(pub.id);
  }

  /**
   * The public state the card bears out for a broadcast, or null: the card this client already
   * knows for the workflow (else the one the broadcast names), carrying the same workflow id at a
   * revision no older than the one claimed. A workflow this client has never seen is taken only
   * from a card its coordinator could have authored (#trustedCard).
   */
  static #fromCard(current, claimed) {
    const doc = game.messages.get(current?.messageId ?? claimed.messageId ?? "");
    const flags = doc?.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
    if (!flags || (flags.id !== claimed.id)) return null;
    if ((flags.revision ?? 0) < (claimed.revision ?? 0)) return null;
    if (!current && !AttackCoordinator.#trustedCard(doc, flags)) return null;
    return foundry.utils.deepClone(flags);
  }

  /**
   * Could this card have been written by a coordinator? The server guarantees who authored a
   * message, so the author must be a GM, or the user who declared the Blow (the coordinator at a
   * table with no GM connected) and then only for an attacker that user owns. Anything else is a
   * message a player dressed up as a card, and is ignored (review, 2026-10-01).
   */
  static #trustedCard(doc, flags) {
    const author = doc?.author;
    if (!author) return false;
    if (author.isGM) return true;
    if (author.id !== flags?.initiatingUserId) return false;
    const attacker = resolveActor(flags?.attacker?.actorUuid);
    return !!attacker && attacker.testUserPermission(author, "OWNER");
  }

  /**
   * The card's flags are the persisted public state, and every client receives the document
   * update, so a client that missed a broadcast catches up here. The coordinator writes the card
   * before it broadcasts, so the update normally arrives a moment before the socket message: this
   * path waits a beat and yields when the broadcast has brought the same revision, and fires the
   * hook itself only when it has not.
   */
  static #syncFromMessage(message) {
    const flags = message?.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
    if (!flags?.id || !AttackCoordinator.#isNewer(flags)) return;
    const pub = foundry.utils.deepClone(flags);
    const prior = AttackCoordinator.#syncTimers.get(pub.id);
    if (prior) clearTimeout(prior);
    const timer = setTimeout(() => {
      AttackCoordinator.#syncTimers.delete(pub.id);
      if (!AttackCoordinator.#isNewer(pub)) return;
      AttackCoordinator.#onState({ type: "attack:state", workflowId: pub.id, revision: pub.revision, event: "state", public: pub });
    }, SYNC_GRACE);
    AttackCoordinator.#syncTimers.set(pub.id, timer);
  }

  /** Would this public state tell this client something it does not know? */
  static #isNewer(pub) {
    const current = AttackCoordinator.#workflows.get(pub.id);
    if (current && (current.coordinatorUserId === game.user.id)) return false;
    if (current) return (pub.revision ?? 0) > (current.revision ?? 0);
    return !TERMINAL_PHASES.includes(pub.phase);
  }

  /** Broadcast the new state to every client, this one included (an emit does not echo). */
  static async #broadcast(workflow, event) {
    const message = {
      type: "attack:state",
      workflowId: workflow.id,
      revision: workflow.revision,
      event,
      public: AttackCoordinator.#public(workflow)
    };
    try {
      game.socket.emit(SOCKET, message);
    } catch (err) {
      console.error("STARWROUGHT | attack state could not be broadcast", err);
    }
    AttackCoordinator.#onState(message);
  }

  /* -------------------------------------------- */
  /*  Handling requests (coordinator side)        */
  /* -------------------------------------------- */

  /**
   * Validate and apply one request, in the brief's order: the workflow exists and is live; the
   * expected revision is current; the phase allows the action; the user may perform it; the
   * choice is legal. Only then mutate, bump the revision, persist, re-render and broadcast.
   * @returns {Promise<object>} the reply
   */
  static async #handle(message) {
    const base = { type: "attack:reply", requestId: message.requestId, to: message.userId, workflowId: message.workflowId ?? null };
    const user = game.users.get(message.userId);
    if (!user) return { ...base, ok: false, reason: "notYours" };

    try {
      if (message.action === "declare") {
        return { ...base, ...(await AttackCoordinator.#handleDeclare(message.payload ?? {}, user)) };
      }

      // 1. The workflow exists and is not complete or cancelled.
      const workflow = AttackCoordinator.#workflows.get(message.workflowId);
      if (!workflow || TERMINAL_PHASES.includes(workflow.phase)) return { ...base, ok: false, reason: "missing" };
      if (!AttackCoordinator.isCoordinator(workflow)) return { ...base, ok: false, reason: "noCoordinator" };
      if (workflow.coordinatorUserId !== game.user.id) await AttackCoordinator.#takeUp(workflow);
      const spec = ACTIONS[message.action];
      if (!spec) return { ...base, ok: false, reason: "wrongPhase" };

      // 2. The request was made against the current state.
      if (!AttackCoordinator.#revisionCurrent(workflow, message.expectedRevision, message.action)) {
        return { ...base, ok: false, reason: "stale", revision: workflow.revision, public: AttackCoordinator.#public(workflow) };
      }
      // 3. The phase allows the action.
      if (!AttackWorkflow.actionAllowed(message.action, workflow.phase)) {
        return { ...base, ok: false, reason: "wrongPhase", revision: workflow.revision };
      }
      // 4 and 5 are the action's own: who may do it, and whether the choice is legal.
      switch (message.action) {
        case "commitDefense":
          return { ...base, ...(await AttackCoordinator.#commitDefense(workflow, message.payload ?? {}, user)) };
        case "submitRoll":
          return { ...base, ...(await AttackCoordinator.#submitRoll(workflow, message.payload ?? {}, user)) };
        case "cancel":
        case "resetDefenses":
        case "resendPrompts":
        case "useStances":
          return { ...base, ...(await AttackCoordinator.#gmControl(workflow, message.action, user)) };
        case "requestState":
          return {
            ...base, ok: true, revision: workflow.revision,
            public: AttackCoordinator.#public(workflow),
            private: AttackCoordinator.#privateFor(workflow, user)
          };
        default:
          return { ...base, ok: false, reason: "wrongPhase" };
      }
    } catch (err) {
      console.error("STARWROUGHT | attack request failed", err);
      return { ...base, ok: false, reason: "error" };
    }
  }

  /**
   * "That attack has moved on": a request is stale when it was made against a revision older
   * than the one at which the current phase began, or than a reset (brief, "Coordination"). A
   * sibling defender's commitment or roll since then does not make yours stale: your choice still
   * applies, and refusing it would be a lie. The phase revision lives in memory, so after a reload
   * the check is strict until the next change. Cancel and Resend prompts cannot be made wrong by
   * being late and are never stale; `requestState` reads only.
   */
  static #revisionCurrent(workflow, expected, action) {
    if (["requestState", "cancel", "resendPrompts"].includes(action)) return true;
    if (!Number.isInteger(expected)) return false;
    if (expected > workflow.revision) return false;
    const meta = AttackCoordinator.#metaFor(workflow);
    return expected >= meta.phaseRevision;
  }

  static #metaFor(workflow) {
    let meta = AttackCoordinator.#meta.get(workflow.id);
    if (!meta) {
      meta = { phaseRevision: workflow.revision ?? 0 };
      AttackCoordinator.#meta.set(workflow.id, meta);
    }
    return meta;
  }

  /** Every change bumps the revision; a phase change or a reset also moves the staleness line. */
  static #bump(workflow, { phase = false } = {}) {
    workflow.revision = (workflow.revision ?? 0) + 1;
    if (phase) AttackCoordinator.#metaFor(workflow).phaseRevision = workflow.revision;
  }

  /* -------------------------------------------- */

  /** Create the record and its card (brief, "The coordinator authors the card"). */
  static async #handleDeclare(payload, user) {
    const attacker = resolveActor(payload.attackerUuid);
    if (!attacker) return { ok: false, reason: "noActor" };
    if (!attacker.testUserPermission(user, "OWNER")) return { ok: false, reason: "notYours" };

    // One Blow at a time (0.5.3; Mike: "my partner clicked attack twice, and it popped up two
    // defense boxes"). A Blow of this attacker's that nobody has answered yet is replaced by the
    // new declaration, since a second click means one attack; one that is further along is kept
    // and the new one refused, because a defender has committed or a die may be in flight.
    for (const live of [...AttackCoordinator.#workflows.values()]) {
      if (TERMINAL_PHASES.includes(live.phase) || (live.attacker?.actorUuid !== attacker.uuid)) continue;
      const untouched = (live.phase === "defending") && !live.targets.some(t => t.committed);
      if (!untouched) {
        return {
          ok: false, reason: "alreadyDeclared",
          reasonData: { name: attacker.name, targets: live.targets.map(t => t.name).join(", ") }
        };
      }
      await AttackCoordinator.#cancel(live, "STARWROUGHT.Attack.replaced");
    }

    const targets = [];
    for (const row of (payload.targets ?? [])) {
      const tokenDoc = resolveTokenDoc(row?.tokenUuid);
      const actor = tokenDoc?.actor ?? resolveActor(row?.actorUuid);
      if (!actor) continue;
      targets.push({ actor, tokenDoc });
    }
    if (!targets.length) return { ok: false, reason: "noTargets" };

    const weapon = payload.weaponId ? attacker.items.get(payload.weaponId) : null;
    const attackItem = payload.attackId ? attacker.items.get(payload.attackId) : null;
    const attackRow = payload.attackId ? attacker.system.attacks?.find(a => a.id === payload.attackId) : null;
    if ((payload.weaponId && (weapon?.type !== "weapon")) || (!weapon && !attackItem && !attackRow)) {
      return { ok: false, reason: "noWeapon" };
    }

    const attackerToken = resolveTokenDoc(payload.attackerTokenUuid) ?? attacker.tokenOnScene?.() ?? null;
    const strike = SW.STRIKE_KINDS[payload.strike] ? payload.strike : SW.DEFAULT_STRIKE;
    const kind = SW.STRIKE_KINDS[strike];

    // Melee for a weapon in hand, Ranged for one that leaves it (PHB v4.10). A Thrown weapon
    // leaves the hand when its target is beyond Total Reach, read against the first target, as
    // rollAttack infers it; the declaration fixes the answer so the roll step agrees with the card.
    let thrown = null;
    let ranged = false;
    if (weapon) {
      const gap = (attackerToken && targets[0].tokenDoc && canvas?.ready)
        ? gapBetween(attackerToken, targets[0].tokenDoc) : null;
      const reachWith = (attacker.system.reach ?? 0) + (weapon.system.reach ?? 0);
      thrown = (payload.thrown !== null && payload.thrown !== undefined) ? !!payload.thrown
        : (!!weapon.system.flags?.thrown && !weapon.system.isRanged && (gap !== null) && (gap > reachWith));
      ranged = !!weapon.system.isRanged || thrown;
    }

    const weaponName = weapon?.name ?? attackItem?.name ?? attackRow?.name ?? "";
    const glyph = SW.ACTION_GLYPHS[kind.cost] ?? "";
    const maneuver = {
      weaponId: weapon?.id ?? null,
      weaponName,
      strike,
      glyph,
      label: `${weaponName}: ${localize(kind.label)} ${glyph}`.trim(),
      thrown,
      prepared: !!payload.prepared,
      free: !!payload.free,
      attackId: (attackItem?.id ?? attackRow?.id) ?? null,
      ranged
    };

    const workflow = AttackWorkflow.create({
      id: foundry.utils.randomID(),
      coordinatorUserId: game.user.id,
      initiatingUserId: user.id,
      attacker: snapshot(attacker, attackerToken),
      maneuver,
      targets: targets.map(({ actor, tokenDoc }) => snapshot(actor, tokenDoc))
    });
    AttackCoordinator.#workflows.set(workflow.id, workflow);
    AttackCoordinator.#meta.set(workflow.id, { phaseRevision: 0 });

    // Declared, and straight into the defense phase: the card is the first thing anyone sees.
    AttackWorkflow.transition(workflow, "defending");
    AttackCoordinator.#bump(workflow, { phase: true });
    await AttackCoordinator.#commitUnanswerable(workflow);
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "prompt");
    await AttackCoordinator.#advanceIfReady(workflow);

    return { ok: true, workflowId: workflow.id, revision: workflow.revision, public: AttackCoordinator.#public(workflow) };
  }

  /* -------------------------------------------- */

  /**
   * A defender's commitment (brief, step 2): a Defense that answers a Blow and one answer built on
   * it, revalidated against the rules layer (`isLegalAnswer`), never trusted from the prompt.
   */
  static async #commitDefense(workflow, payload, user) {
    const target = AttackWorkflow.targetOf(workflow, payload.targetId);
    if (!target) return { ok: false, reason: "wrongPhase" };
    // Already answered: a second prompt, or the GM's standing stances got there first.
    if (target.committed) return { ok: false, reason: "stale", revision: workflow.revision };
    const actor = resolveActor(target.actorUuid);
    if (!actor) return { ok: false, reason: "noActor" };

    // 4. The decision belongs to the defender's owner (a GM owns everything).
    if (!actor.testUserPermission(user, "OWNER")) return { ok: false, reason: "notYours" };

    // 5. The choice is legal: Evade or Guard; nothing, an owned Reaction or an owned Posture,
    //    never both; a Posture names the Zone it Exposes (PHB v4.10, Answering an Attack).
    const defense = String(payload.defense ?? "");
    const reaction = payload.reaction ? String(payload.reaction) : null;
    const posture = normalizePosture(payload.posture);
    const defenseLabel = SW.DEFENSES[defense] ? localize(SW.DEFENSES[defense].label) : defense;
    const illegal = { ok: false, reason: "illegal", reasonData: { name: actor.name, defense: defenseLabel } };
    if (!isLegalAnswer(actor, defense, { reaction, posture })) return illegal;
    if (posture && !(posture.zone in SW.ZONES)) return illegal;
    // Counter answers only a melee Blow from a foe within Reach.
    if ((reaction === "counter") && !AttackCoordinator.#counterAnswers(workflow, target, actor)) {
      return { ok: false, reason: "counterNeedsMelee" };
    }

    const store = AttackCoordinator.#storeFor(workflow.id);
    store[target.id] = {
      defense,
      reaction,
      // The Posture's name as the table reads it: a root-granted one ("Set Your Feet ⓿↺") is
      // named by the Reaction table, not by the root Talent it rides on (0.5.3).
      posture: posture ? { talentId: posture.talentId, name: postureName(actor, posture) ?? "", zone: posture.zone } : null,
      userId: user.id
    };
    await AttackCoordinator.#savePrivate();
    target.committed = true;
    AttackCoordinator.#bump(workflow);
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "state");
    await AttackCoordinator.#advanceIfReady(workflow);

    return {
      ok: true, revision: workflow.revision,
      public: AttackCoordinator.#public(workflow),
      private: { [target.id]: store[target.id] }
    };
  }

  /**
   * PHB v4.10, Answering an Attack: Counter answers only a melee Blow from a foe within your
   * Reach. An unknown distance (no canvas) is not refused: nothing in this system is stopped on
   * arithmetic the table cannot see.
   */
  static #counterAnswers(workflow, target, actor) {
    if (workflow.maneuver?.ranged) return false;
    const gap = AttackCoordinator.#gapFor(workflow, target);
    if (gap === null) return true;
    const reach = actor.system?.totalReach ?? actor.system?.reach ?? 0;
    return gap <= reach;
  }

  /** The gap in feet between the attacker's token and a target's, edge to edge, or null off the map. */
  static #gapFor(workflow, target) {
    if (!canvas?.ready) return null;
    const a = resolveTokenDoc(workflow.attacker?.tokenUuid);
    const b = resolveTokenDoc(target?.tokenUuid);
    if (!a || !b) return null;
    try { return gapBetween(a, b); } catch { return null; }
  }

  /* -------------------------------------------- */

  /**
   * A roll from the roller's client (brief, "The roll and the resolution"): the die thrown blind,
   * handed over as `{ roll: Roll JSON, total, natural, formula, modifiers }`. A player attacker's
   * one roll fills every pairing the attacker rolls; a defender's fills its own.
   */
  static async #submitRoll(workflow, payload, user) {
    let target = AttackWorkflow.targetOf(workflow, payload.targetId);
    if (!target) target = workflow.targets.find(t => (t.roller === "attacker") && !t.roll) ?? null;
    if (!target) return { ok: false, reason: "wrongPhase" };
    if (target.roll) return { ok: false, reason: "stale", revision: workflow.revision };

    // 4. The die belongs to the roller's owner.
    const rollerUuid = (target.roller === "attacker") ? workflow.attacker.actorUuid : target.actorUuid;
    const roller = resolveActor(rollerUuid);
    if (!roller) return { ok: false, reason: "noActor" };
    if (!roller.testUserPermission(user, "OWNER")) return { ok: false, reason: "notYours" };

    // 5. The roll is a roll.
    const rollData = normalizeRollData(payload.rollData);
    if (!rollData) return { ok: false, reason: "badRoll" };

    const summary = { total: rollData.total, natural: rollData.natural, formula: rollData.formula };
    if (target.roller === "attacker") {
      workflow.attackRoll = rollData;
      for (const t of workflow.targets) {
        if ((t.roller === "attacker") && !t.roll) t.roll = { ...summary };
      }
    } else {
      // The whole roll, so a coordinator rebuilt from the card can still read it against the Threshold.
      target.roll = rollData;
    }
    AttackCoordinator.#bump(workflow);
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "state");
    await AttackCoordinator.#advanceIfReady(workflow);
    return { ok: true, revision: workflow.revision, public: AttackCoordinator.#public(workflow) };
  }

  /* -------------------------------------------- */

  /**
   * Cancel a Blow: the GM's control, or a declaration replaced by the attacker's next (0.5.3).
   * Logged on the card, the private store dropped, the Strike's actions returned when no die was
   * thrown, the card written and the cancellation broadcast, then forgotten.
   * @returns {Promise<object>} the public state
   */
  static async #cancel(workflow, logKey = "STARWROUGHT.Attack.cancelled") {
    AttackWorkflow.transition(workflow, "cancelled");
    workflow.log.push(localize(logKey));
    AttackCoordinator.#bump(workflow, { phase: true });
    AttackCoordinator.#private.delete(workflow.id);
    await AttackCoordinator.#savePrivate();
    await AttackCoordinator.#refundStrike(workflow);
    await AttackCoordinator.#persist(workflow);
    const pub = AttackCoordinator.#public(workflow);
    await AttackCoordinator.#broadcast(workflow, "cancelled");
    AttackCoordinator.#forget(workflow.id);
    return pub;
  }

  /**
   * A Strike pays when it declares (0.5.3; a character's in rollAttack, an adversary's in
   * attackWith). A Blow cancelled before any die was thrown gives those actions back, said in a
   * card; a Prepared or free Strike paid elsewhere and is left alone, as is a Blow already rolled.
   */
  static async #refundStrike(workflow) {
    const maneuver = workflow.maneuver ?? {};
    if (maneuver.prepared || maneuver.free) return;
    if (workflow.attackRoll || (workflow.targets ?? []).some(t => t.roll)) return;
    const attacker = resolveActor(workflow.attacker?.actorUuid);
    if (!attacker?.isOwner || !attacker.inEncounter || !attacker.system?.actions) return;
    const kind = SW.STRIKE_KINDS[maneuver.strike];
    const cost = Number(kind?.cost) || 0;
    if (!cost) return;
    const per = Number(attacker.actionsPerRound) || SW.ACTIONS_PER_ROUND;
    const value = Math.min(per, (attacker.system.actions.value ?? 0) + cost);
    await attacker.update({ "system.actions.value": value }, { swAnnounced: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="starwrought action-card sw-refund-card">
        <h3><i class="fa-solid fa-rotate-left"></i> ${localize("STARWROUGHT.Attack.refundedTitle")}</h3>
        <p>${format("STARWROUGHT.Attack.refunded", {
          name: foundry.utils.escapeHTML(attacker.name),
          strike: `${localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost] ?? ""}`.trim(),
          n: cost, left: value, per
        })}</p></div>`,
      whisper: attacker.hasPlayerOwner ? [] : ChatMessage.getWhisperRecipients("GM").map(u => u.id)
    });
  }

  /**
   * The GM controls (brief, "Coordination" and "The absent player"), each logged on the card:
   * cancel; resetDefenses (every commitment cleared, back to `defending`); resendPrompts; and
   * useStances, which answers every uncommitted defender with its standing stance, as the live
   * stance read did before 0.5.0, so an absent player never blocks the attacker.
   */
  static async #gmControl(workflow, action, user) {
    if (!AttackCoordinator.#mayControl(user, workflow)) return { ok: false, reason: "gmOnly" };

    switch (action) {
      case "cancel": {
        const pub = await AttackCoordinator.#cancel(workflow);
        return { ok: true, revision: pub.revision, public: pub };
      }
      case "resetDefenses": {
        AttackCoordinator.#clearCommitments(workflow);
        if (workflow.phase !== "defending") AttackWorkflow.transition(workflow, "defending");
        workflow.log.push(localize("STARWROUGHT.Attack.reset"));
        AttackCoordinator.#bump(workflow, { phase: true });
        await AttackCoordinator.#savePrivate();
        await AttackCoordinator.#commitUnanswerable(workflow);
        await AttackCoordinator.#persist(workflow);
        await AttackCoordinator.#broadcast(workflow, "prompt");
        await AttackCoordinator.#advanceIfReady(workflow);
        break;
      }
      case "resendPrompts": {
        workflow.log.push(localize("STARWROUGHT.Attack.resent"));
        AttackCoordinator.#bump(workflow);
        await AttackCoordinator.#persist(workflow);
        await AttackCoordinator.#broadcast(workflow, "prompt");
        break;
      }
      case "useStances": {
        const names = [];
        for (const target of workflow.targets) {
          if (target.committed) continue;
          const actor = resolveActor(target.actorUuid);
          if (!actor) continue;
          AttackCoordinator.#commitWithStance(workflow, target, actor, user.id);
          names.push(target.name);
        }
        if (!names.length) return { ok: false, reason: "wrongPhase", revision: workflow.revision };
        workflow.log.push(`${localize("STARWROUGHT.Attack.usedStances")}: ${names.join(", ")}`);
        AttackCoordinator.#bump(workflow);
        await AttackCoordinator.#savePrivate();
        await AttackCoordinator.#persist(workflow);
        await AttackCoordinator.#broadcast(workflow, "state");
        await AttackCoordinator.#advanceIfReady(workflow);
        break;
      }
      default:
        return { ok: false, reason: "wrongPhase" };
    }
    return { ok: true, revision: workflow.revision, public: AttackCoordinator.#public(workflow) };
  }

  /* -------------------------------------------- */
  /*  Commitments                                 */
  /* -------------------------------------------- */

  /** This workflow's private commitments, created on first use. */
  static #storeFor(workflowId) {
    let store = AttackCoordinator.#private.get(workflowId);
    if (!store) {
      store = {};
      AttackCoordinator.#private.set(workflowId, store);
    }
    return store;
  }

  /** The commitments this user may know of: their own, and those of defenders they control. */
  static #privateFor(workflow, user) {
    const store = AttackCoordinator.#private.get(workflow.id) ?? {};
    const out = {};
    for (const [targetId, commitment] of Object.entries(store)) {
      if (commitment.userId === user.id) { out[targetId] = commitment; continue; }
      const target = AttackWorkflow.targetOf(workflow, targetId);
      const actor = target ? resolveActor(target.actorUuid) : null;
      if (actor?.testUserPermission(user, "OWNER")) out[targetId] = commitment;
    }
    return out;
  }

  /** Mirror the private store to this client's own browser so a reload restores it. */
  static async #savePrivate() {
    try {
      await game.settings.set(SW.SYSTEM_ID, "attackPrivate", Object.fromEntries(AttackCoordinator.#private));
    } catch (err) {
      console.warn("STARWROUGHT | private attack commitments could not be mirrored", err);
    }
  }

  /**
   * Clear every commitment, revealed answer, Threshold and roll: the defense phase starts over.
   * A Posture revealed in the meantime had its Zone Exposed; that is taken back where this client
   * owns the actor, so a reset does not leave two Zones open for one Blow (review, 2026-10-01).
   * Reset is refused once a die has been paid for (ACTIONS.resetDefenses), so nothing spent needs
   * refunding here.
   */
  static #clearCommitments(workflow) {
    AttackCoordinator.#private.delete(workflow.id);
    for (const target of workflow.targets) {
      const zone = target.revealed?.posture?.zone;
      if (zone && (zone in SW.ZONES)) {
        const actor = resolveActor(target.actorUuid);
        if (actor?.isOwner) {
          actor.setExposed(zone, false, { announced: true })
            .catch(err => console.error(`STARWROUGHT | ${actor.name}: the Posture's Zone could not be closed again`, err));
        }
      }
      target.committed = false;
      target.revealed = null;
      target.threshold = null;
      target.roll = null;
      target.outcome = null;
      target.resolutionMessageId = null;
    }
    workflow.attackRoll = null;
  }

  /**
   * Commit a defender with its standing stance: the `answeringDefense()` reading against this
   * Blow (ranged or not, and the gap), Reaction included, never a Posture. The reading already
   * applies every rule (a Head Wound, a stale Reaction stance, Counter's melee test), so it is legal
   * by construction.
   */
  static #commitWithStance(workflow, target, actor, userId) {
    const reading = actor.answeringDefense?.({ ranged: !!workflow.maneuver?.ranged, gap: AttackCoordinator.#gapFor(workflow, target) })
      ?? { key: "evade", reaction: null };
    const store = AttackCoordinator.#storeFor(workflow.id);
    store[target.id] = {
      defense: ["evade", "guard"].includes(reading.key) ? reading.key : "evade",
      reaction: reading.reaction ?? null,
      posture: null,
      userId
    };
    target.committed = true;
  }

  /**
   * At a table with no GM connected, an adversary defender has nobody to declare for it, so it
   * answers with its standing stance at once rather than stalling the Blow; the card says so.
   */
  static async #commitUnanswerable(workflow) {
    if (game.users.activeGM) return;
    let any = false;
    for (const target of workflow.targets) {
      if (target.committed || target.isPlayer) continue;
      const actor = resolveActor(target.actorUuid);
      if (!actor) continue;
      AttackCoordinator.#commitWithStance(workflow, target, actor, game.user.id);
      workflow.log.push(format("STARWROUGHT.Attack.autoStance", { name: target.name }));
      any = true;
    }
    if (any) {
      await AttackCoordinator.#savePrivate();
      AttackCoordinator.#bump(workflow);
    }
  }

  /* -------------------------------------------- */
  /*  Advancing: reveal and resolve               */
  /* -------------------------------------------- */

  /**
   * The gates that move a Blow on by themselves: every commitment in, every roll in. A workflow
   * found mid-resolution (a coordinator rebuilt from the card) picks up where it stood.
   */
  static async #advanceIfReady(workflow) {
    if ((workflow.phase === "defending") && AttackWorkflow.allCommitted(workflow)) {
      await AttackCoordinator.#reveal(workflow);
    }
    // A card persisted at `revealed` (the coordinator went down between the reveal's two writes,
    // or another client adopted it in that window) has nothing left to wait for: the dice are
    // next (review, 2026-10-01).
    if (workflow.phase === "revealed") {
      AttackWorkflow.transition(workflow, "rolling");
      AttackCoordinator.#bump(workflow, { phase: true });
      await AttackCoordinator.#persist(workflow);
      await AttackCoordinator.#broadcast(workflow, "prompt");
    }
    if ((workflow.phase === "rolling") && AttackWorkflow.allRolled(workflow)) {
      await AttackCoordinator.#resolve(workflow);
    } else if (workflow.phase === "resolving") {
      await AttackCoordinator.#finishResolving(workflow);
    }
  }

  /**
   * The reveal (brief, step 3): every commitment becomes public at once, each with the Threshold
   * it makes (a character's shown by policy, an adversary's withheld), then the Blow waits on the
   * dice. Postures Expose their Zones now: the coordinator for actors it owns, otherwise the owning
   * client when the revealed state reaches it (see #applyReveal). The private store is emptied:
   * what it held is on the card.
   */
  static async #reveal(workflow) {
    const store = AttackCoordinator.#private.get(workflow.id) ?? {};
    AttackWorkflow.transition(workflow, "revealed");
    AttackCoordinator.#bump(workflow, { phase: true });

    for (const target of workflow.targets) {
      const commitment = store[target.id] ?? { defense: "evade", reaction: null, posture: null };
      const actor = resolveActor(target.actorUuid);
      const reading = AttackCoordinator.#thresholdFor(actor, commitment);
      target.revealed = {
        defense: reading?.key ?? commitment.defense,
        reaction: commitment.reaction ?? null,
        posture: commitment.posture ?? null,
        note: reading?.note ?? null,
        // The revision this reveal happened at: the owning clients apply its Postures once, keyed on it.
        revision: workflow.revision
      };
      target.threshold = reading?.threshold ?? null;
    }
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "state");
    // The GM may have cancelled while the card was being written.
    if (workflow.phase !== "revealed") return;

    AttackWorkflow.transition(workflow, "rolling");
    AttackCoordinator.#bump(workflow, { phase: true });
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "prompt");

    AttackCoordinator.#private.delete(workflow.id);
    await AttackCoordinator.#savePrivate();
  }

  /**
   * Apply a reveal's Postures on this client (brief, "The roll and the resolution"): each client
   * Exposes the Zone for the actors it owns, once per reveal, with `posture: true` so Recenter
   * leaves it and the end of the round clears it. The coordinator applies for what it owns; another
   * owner steps in only where the coordinator does not own the actor.
   */
  static #applyReveal(pub) {
    if (!["revealed", "rolling"].includes(pub?.phase)) return;
    const coordinator = pub.coordinatorUserId ? game.users.get(pub.coordinatorUserId) : null;
    const iCoordinate = pub.coordinatorUserId === game.user.id;
    for (const target of (pub.targets ?? [])) {
      const posture = target.revealed?.posture;
      if (!posture?.zone || !(posture.zone in SW.ZONES)) continue;
      const key = `${pub.id}:${target.id}:${target.revealed.revision ?? pub.revision}`;
      if (AttackCoordinator.#applied.has(key)) continue;
      const actor = resolveActor(target.actorUuid);
      if (!actor?.isOwner) continue;
      if (!iCoordinate && coordinator?.active && actor.testUserPermission(coordinator, "OWNER")) continue;
      AttackCoordinator.#applied.add(key);
      actor.setExposed(posture.zone, true, { posture: true })
        .catch(err => console.error(`STARWROUGHT | ${actor.name}: the Posture's Zone could not be Exposed`, err));
    }
  }

  /**
   * A defender's Threshold with the committed answer folded in, from actor data on this client
   * (brief, "Thresholds": never trusted from a client). `SwActor#defenseThresholdFor` is the
   * authority; the arithmetic below stands in only if it is missing, folding the +2 into the
   * Defense's Situation stack exactly as `answeringDefense` does, so a Reaction and a Situation
   * bonus already on the Defense do not stack.
   * @returns {{key: string, threshold: number, note: string|null}|null}
   */
  static #thresholdFor(actor, { defense, reaction = null, posture = null } = {}) {
    if (!actor) return null;
    if (typeof actor.defenseThresholdFor === "function") {
      const reading = actor.defenseThresholdFor({ defense, reaction, posture });
      if (reading && Number.isFinite(Number(reading.threshold))) {
        return { key: reading.key ?? defense, threshold: Number(reading.threshold), note: reading.note ?? reading.unavailable ?? null };
      }
    }
    const defenses = actor.system?.defenses ?? {};
    let key = ["evade", "guard"].includes(defense) ? defense : "evade";
    let note = null;
    if (defenses[key]?.unavailable) {
      key = (key === "evade") ? "guard" : "evade";
      note = defenses[defense]?.unavailable ?? null;
    }
    const def = defenses[key];
    let threshold = Number(def?.threshold ?? 10);
    const extra = [];
    if (reaction && SW.REACTIONS[reaction]?.bonus) {
      extra.push({ label: localize(SW.REACTIONS[reaction].label), value: SW.REACTIONS[reaction].bonus, type: "situation" });
    }
    if (posture) extra.push({ label: posture.name ?? localize("STARWROUGHT.Reaction.posture"), value: POSTURE_BONUS, type: "situation" });
    if (extra.length) {
      if (Array.isArray(def?.modifiers)) {
        const { total } = SW.resolveModifiers([...def.modifiers, ...extra]);
        threshold = 10 + total + (def.sizeMod ?? 0);
      } else {
        threshold += SW.resolveModifiers(extra).total;
      }
    }
    return { key, threshold, note };
  }

  /** An adversary's Attack Threshold: the attack row's own number (brief, "Thresholds"). */
  static #attackThreshold(attacker, maneuver) {
    const item = maneuver?.attackId ? attacker.items.get(maneuver.attackId) : null;
    const row = maneuver?.attackId ? attacker.system.attacks?.find(a => a.id === maneuver.attackId) : null;
    const value = item?.system?.attack?.threshold ?? row?.threshold ?? row?.thresholds?.[0];
    const n = Number(value);
    return Number.isFinite(n) ? n : 10;
  }

  /**
   * The Threshold a resolved card's die was read against, computed again from actor data for a
   * reroll (0.5.3) of a card that hid it: the defender's Defense with the revealed answer folded
   * in for an attack card, the adversary's Attack Threshold for a Defense card. Null when the
   * actors are gone. The GM's client asks, so an adversary's number never reaches a player.
   * @param {object} flags  A check card's `flags.starwrought`.
   * @returns {number|null}
   */
  static thresholdForCard(flags) {
    if (!flags) return null;
    if (flags.kind === "attack") {
      const defender = resolveActor(flags.defenderUuid);
      const reading = AttackCoordinator.#thresholdFor(defender, {
        defense: flags.defense, reaction: flags.reaction ?? null, posture: flags.posture ?? null
      });
      return Number.isFinite(reading?.threshold) ? reading.threshold : null;
    }
    if (flags.kind === "defense") {
      // A Defense card from before 0.5.3 carries no attack row; its number cannot be read again,
      // and the default 10 would be a guess dressed as a Threshold.
      if (!flags.attackId) return null;
      const attacker = resolveActor(flags.attackerUuid);
      return attacker ? AttackCoordinator.#attackThreshold(attacker, { attackId: flags.attackId }) : null;
    }
    return null;
  }

  /**
   * The resolution cards one die filled (0.5.3). Inside the attack flow a player attacker rolls
   * once against every defender, so a reroll of that die is a reroll of every pairing it filled:
   * the ids of all the attacker-rolled pairings' cards of the same Blow, this one included. A
   * defender's die fills its own pairing alone, and a card no attack card knows (the plain path)
   * is its own set.
   * @param {string} messageId  A resolution card's id.
   * @returns {string[]}
   */
  static siblingResolutions(messageId) {
    if (!messageId) return [];
    for (const doc of game.messages.contents) {
      const pub = doc.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
      const target = pub?.targets?.find(t => t.resolutionMessageId === messageId);
      if (!target) continue;
      if (target.roller !== "attacker") return [messageId];
      const ids = pub.targets
        .filter(t => (t.roller === "attacker") && t.resolutionMessageId)
        .map(t => t.resolutionMessageId);
      return ids.includes(messageId) ? ids : [messageId, ...ids];
    }
    return [messageId];
  }

  /**
   * A pairing's resolution card was rerolled (0.5.3): the attack card that carried its outcome
   * follows the new card. Runs on every client from the `starwrought.reroll` hook; only one that
   * may write the card (its author, or a GM) does so, and only once the Blow is complete, so this
   * is a note in the record and never a step of the flow: the row's outcome and resolution card
   * move, the revision advances, the log says so.
   */
  static async noteReroll({ oldId, result, reason = "" } = {}) {
    const newId = result?.message?.id ?? null;
    if (!oldId || !newId) return;
    // The new card must say it replaced the old one: the hook is local, but the card is the record.
    if (game.messages.get(newId)?.flags?.[SW.SYSTEM_ID]?.rerollOf !== oldId) return;
    for (const doc of game.messages.contents) {
      const pub = doc.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
      const index = pub?.targets?.findIndex(t => t.resolutionMessageId === oldId) ?? -1;
      if (index < 0) continue;
      if (!(doc.isAuthor || game.user.isGM)) return;
      if (!TERMINAL_PHASES.includes(pub.phase)) return;
      const next = foundry.utils.deepClone(pub);
      const target = next.targets[index];
      const outcome = result?.outcome;
      target.outcome = (typeof outcome === "string") ? outcome : (outcome?.key ?? target.outcome ?? null);
      target.resolutionMessageId = newId;
      next.revision = (next.revision ?? 0) + 1;
      next.log = [...(next.log ?? []), reason
        ? format("STARWROUGHT.Attack.rerolled", { name: target.name ?? "", reason })
        : format("STARWROUGHT.Attack.rerolledPlain", { name: target.name ?? "" })];
      next.messageId = doc.id;
      try {
        await updateAttackCard(next);
      } catch (err) {
        console.error("STARWROUGHT | the attack card could not follow a reroll", err);
      }
      return;
    }
  }

  /**
   * Resolution (brief, step 5): one `SwCheck.resolveAgainst` per pairing, so every pairing gets
   * today's full card (Position, the damage buttons, the Reaction line) and the attack card's rows
   * get the outcomes. Persisted after each pairing, so a coordinator rebuilt mid-way resolves only
   * what is left. Then complete.
   */
  static async #resolve(workflow) {
    AttackWorkflow.transition(workflow, "resolving");
    AttackCoordinator.#bump(workflow, { phase: true });
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "state");
    await AttackCoordinator.#finishResolving(workflow);
  }

  /**
   * Resolve every pairing not yet resolved, then complete. The GM may cancel while this runs (each
   * pairing awaits the card it posts), so the phase is checked before every step: a cancelled
   * Blow resolves nothing more and is never marked complete.
   */
  static #finishResolving(workflow) {
    const inFlight = AttackCoordinator.#resolving.get(workflow.id);
    if (inFlight) return inFlight;
    const run = AttackCoordinator.#finishResolvingNow(workflow)
      .finally(() => AttackCoordinator.#resolving.delete(workflow.id));
    AttackCoordinator.#resolving.set(workflow.id, run);
    return run;
  }

  /** The resolution loop itself; #finishResolving sees that only one runs per workflow. */
  static async #finishResolvingNow(workflow) {
    const showPcThresholds = !!setting("attackShowPcThresholds", false);
    for (const target of workflow.targets) {
      if (workflow.phase !== "resolving") return;
      if (target.outcome || target.resolutionMessageId) continue;
      try {
        await AttackCoordinator.#resolvePairing(workflow, target, showPcThresholds);
      } catch (err) {
        console.error(`STARWROUGHT | attack workflow ${workflow.id}: pairing ${target.id} did not resolve`, err);
        workflow.log.push(format("STARWROUGHT.Attack.resolveFailed", { name: target.name }));
      }
      if (workflow.phase !== "resolving") return;
      AttackCoordinator.#bump(workflow);
      await AttackCoordinator.#persist(workflow);
      await AttackCoordinator.#broadcast(workflow, "state");
    }
    if (workflow.phase !== "resolving") return;

    AttackWorkflow.transition(workflow, "complete");
    AttackCoordinator.#bump(workflow, { phase: true });
    await AttackCoordinator.#persist(workflow);
    await AttackCoordinator.#broadcast(workflow, "complete");
    AttackCoordinator.#forget(workflow.id);
  }

  /**
   * One pairing. The Threshold is computed here, from actor data, at the moment of resolution:
   *  - the attacker rolled (a player's Strike, or adversary against adversary): the defender's
   *    Defense Threshold with the revealed answer folded in; shown on the card only for a
   *    character and only when the world setting allows (the flags are shared by every client);
   *  - the defender rolled (an adversary's Blow at a character): the adversary's Attack Threshold,
   *    never shown.
   * The Reaction's ❶ (PHB v4.10, Answering an Attack) is charged when the Blow resolves, by this
   * client when it owns the defender, else the card's Charge button; a Defense roll paid it before
   * the die, as `SwCheck.roll` does for every Defense roll.
   */
  static async #resolvePairing(workflow, target, showPcThresholds) {
    const attacker = resolveActor(workflow.attacker.actorUuid);
    const defender = resolveActor(target.actorUuid);
    if (!attacker || !defender) throw new Error("an actor of the pairing is gone");
    const attackerToken = resolveTokenDoc(workflow.attacker.tokenUuid) ?? attacker.tokenOnScene?.() ?? null;
    const defenderToken = resolveTokenDoc(target.tokenUuid) ?? defender.tokenOnScene?.() ?? null;
    const maneuver = workflow.maneuver;
    const weapon = maneuver.weaponId ? (attacker.items.get(maneuver.weaponId) ?? null) : null;
    const revealed = target.revealed ?? { defense: "evade", reaction: null, posture: null };
    const rollData = AttackWorkflow.rollDataFor(workflow, target);
    if (!rollData?.roll) throw new Error("the pairing has no roll");

    let kind, threshold, showThreshold, speakerActor;
    if (target.roller === "attacker") {
      kind = "attack";
      const reading = AttackCoordinator.#thresholdFor(defender, revealed);
      threshold = reading?.threshold ?? target.threshold ?? 10;
      target.threshold = threshold;
      showThreshold = !!target.isPlayer && showPcThresholds;
      speakerActor = attacker;
    } else {
      kind = "defense";
      threshold = AttackCoordinator.#attackThreshold(attacker, maneuver);
      showThreshold = false;
      speakerActor = defender;
    }

    const reaction = (revealed.reaction && SW.REACTIONS[revealed.reaction]) ? revealed.reaction : null;

    // `resolveAgainst` charges the Reaction's ❶ itself on an attack when this client owns the
    // defender (`SwCheck.chargeReaction`, owner-gated) and writes `reactionCharged` to the card,
    // else the card offers the Charge button; a Defense roll paid it before the die. Charging here
    // as well would pay it twice.
    const result = await SwCheck.resolveAgainst({
      attacker, defender, attackerToken, defenderToken, weapon,
      attackId: maneuver.attackId ?? null,
      strike: maneuver.strike,
      rollData,
      kind,
      defense: revealed.defense,
      reaction,
      posture: revealed.posture ?? null,
      threshold,
      showThreshold,
      speakerActor,
      thrown: !!maneuver.thrown
    });

    const outcome = result?.outcome;
    target.outcome = (typeof outcome === "string") ? outcome : (outcome?.key ?? null);
    target.resolutionMessageId = result?.message?.id ?? null;
  }

  /* -------------------------------------------- */
  /*  Persistence                                 */
  /* -------------------------------------------- */

  /**
   * Write the public state to the card (`flags.starwrought.attackWorkflow`) through the card
   * module, which creates the message on the first call and updates it afterwards. The flags are
   * the persistence model, so if the card module left them behind this revision, they are written
   * here as well.
   */
  static async #persist(workflow) {
    const pub = AttackCoordinator.#public(workflow);
    let message = null;
    try {
      message = await updateAttackCard(pub);
    } catch (err) {
      console.error(`STARWROUGHT | attack workflow ${workflow.id}: the card could not be written`, err);
    }
    if (!workflow.messageId) workflow.messageId = pub.messageId ?? message?.id ?? null;

    const doc = workflow.messageId ? game.messages.get(workflow.messageId) : null;
    const stored = doc?.flags?.[SW.SYSTEM_ID]?.attackWorkflow;
    if (doc && (stored?.revision !== workflow.revision) && (doc.isAuthor || game.user.isGM)) {
      try {
        await doc.update({ [`flags.${SW.SYSTEM_ID}.attackWorkflow`]: { ...pub, messageId: workflow.messageId } });
      } catch (err) {
        console.error(`STARWROUGHT | attack workflow ${workflow.id}: the flags could not be written`, err);
      }
    }
  }

  /** The card's HTML for one user, for a caller that wants to show it outside chat. */
  static async render(id, { forUser = game.user } = {}) {
    const workflow = AttackCoordinator.#workflows.get(id);
    if (!workflow) return "";
    return renderAttackCard(AttackCoordinator.#public(workflow), { forUser });
  }

  /** A finished workflow leaves memory; its card remains the record. */
  static #forget(id) {
    AttackCoordinator.#workflows.delete(id);
    AttackCoordinator.#meta.delete(id);
    if (AttackCoordinator.#private.delete(id)) AttackCoordinator.#savePrivate();
  }

  /* -------------------------------------------- */
  /*  The roll, on the roller's client            */
  /* -------------------------------------------- */

  /**
   * Throw the die for a pairing (brief, step 4), on the roller's own client, and hand the result
   * to the coordinator. Blind: no Threshold is read here; the coordinator reads the roll against
   * every pairing it fills.
   *  - The attacker's roll: `rollAttack` with the Strike locked and `postCard: false`, so the
   *    whole modifier assembly (Handling, the Strike Attribute, Unwieldy, Support, Control) is
   *    reused and the Strike's actions are spent in `beforeRoll` as today (a Prepared Committed
   *    Strike is already paid). `blind` and `workflow` tell `rollAttack` not to declare again.
   *  - Adversary against adversary: the GM rolls the attacker flat (`flatBonus: 0`), the one place
   *    the brief flags to revise.
   *  - A defender's roll: `rollDefense` with the committed answer, which forces kind "defense",
   *    folds the Reaction's or Posture's +2 and pays the Reaction before the die.
   * @param {string} workflowId
   * @param {string|null} [targetId]  Omitted, the first pairing awaiting the attacker's die.
   * @returns {Promise<object|null>} the coordinator's reply, or null when nothing was rolled
   */
  static async rollFor(workflowId, targetId = null) {
    const workflow = AttackCoordinator.#workflows.get(workflowId);
    if (!workflow || (workflow.phase !== "rolling")) {
      ui.notifications.warn(localize("STARWROUGHT.Attack.stale"));
      return null;
    }
    let target = targetId ? AttackWorkflow.targetOf(workflow, targetId) : null;
    if (!target) {
      target = workflow.targets.find(t => (t.roller === "attacker") && !t.roll)
        ?? workflow.targets.find(t => !t.roll) ?? null;
    }
    if (!target || target.roll) {
      ui.notifications.warn(localize("STARWROUGHT.Attack.stale"));
      return null;
    }

    const attacker = resolveActor(workflow.attacker.actorUuid);
    const defender = resolveActor(target.actorUuid);
    const attackerToken = resolveTokenDoc(workflow.attacker.tokenUuid);
    const maneuver = workflow.maneuver;
    const link = { id: workflow.id, targetId: target.id };
    // The revision this die is built against, read before any dialog opens: a Reset defenses and a
    // re-reveal while the dialog is up move the phase line past it, and the coordinator must then
    // refuse the late roll as stale rather than read it against the new answer (review, 2026-10-01).
    const expectedRevision = workflow.revision;
    let result = null;

    if (target.roller === "attacker") {
      if (!attacker) return void ui.notifications.warn(localize("STARWROUGHT.Notify.noActor"));
      if (!attacker.isOwner) return void ui.notifications.warn(localize("STARWROUGHT.Attack.notYours"));
      if (maneuver.weaponId && attacker.items.get(maneuver.weaponId)) {
        result = await attacker.rollAttack(maneuver.weaponId, {
          strike: maneuver.strike,
          prepared: !!maneuver.prepared,
          free: !!maneuver.free,
          thrown: (maneuver.thrown === null || maneuver.thrown === undefined) ? undefined : !!maneuver.thrown,
          targetUuid: target.tokenUuid || target.actorUuid,
          dialog: true,
          lockStrike: true,
          postCard: false,
          blind: true,
          workflow: link
        });
      } else {
        // Adversary against adversary: a flat d20 for the GM, the Strike locked, no Threshold.
        const kind = SW.STRIKE_KINDS[maneuver.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
        result = await SwCheck.roll({
          actor: attacker,
          kind: "attack",
          slug: SW.MELEE_SLUG,
          label: maneuver.weaponName || attacker.name,
          subtitle: `${localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost] ?? ""}`.trim(),
          strike: maneuver.strike,
          lockStrike: true,
          dialog: true,
          postCard: false,
          flatBonus: 0,
          threshold: null,
          defenseForced: true,
          workflow: link
        });
      }
    } else {
      if (!defender) return void ui.notifications.warn(localize("STARWROUGHT.Notify.noActor"));
      if (!defender.isOwner) return void ui.notifications.warn(localize("STARWROUGHT.Attack.notYours"));
      const revealed = target.revealed ?? { defense: "evade", reaction: null, posture: null };
      result = await defender.rollDefense(revealed.defense, {
        workflow: link,
        reaction: revealed.reaction ?? null,
        posture: revealed.posture ?? null,
        strike: maneuver.strike,
        attacker: attackerToken?.object ?? attacker ?? undefined,
        postCard: false,
        dialog: true
      });
    }

    // The dialog was dismissed, or the Strike became a Prepared Maneuver: nothing to hand over.
    if (!result?.roll) return null;
    const rollData = {
      roll: result.roll.toJSON(),
      total: result.total ?? result.roll.total,
      natural: result.natural ?? null,
      formula: result.roll.formula,
      modifiers: result.modifiers ?? []
    };
    return AttackCoordinator.request("submitRoll", {
      workflowId,
      expectedRevision,
      payload: { targetId: target.id, rollData }
    });
  }
}
