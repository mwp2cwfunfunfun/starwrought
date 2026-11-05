/**
 * The attack flow's socket transport (0.12.0; the split CLAUDE.md promised at the first non-Blow
 * Threat, "how the table agrees" cut from "what the attack is"): one request to one coordinator and
 * its one reply, and a state broadcast to everyone. Nothing here knows what a workflow is.
 *
 * What the transport carries, and does not read: `requestId`, `workflowId`, `expectedRevision`,
 * `action`, `payload`, `userId` and `to`. The revision check, the ownership check and the election
 * of `to` are the coordinator's (attack-coordinator.mjs); the transport delivers, correlates a
 * reply with its request, times out, and hands an incoming message to the right handler.
 *
 * Delivery: a request and a reply are emitted with `recipients`, so Foundry's server delivers them
 * to that user alone and a defender's commitment never passes through another player's browser
 * (review, 2026-10-01). A broadcast is for everyone. Who is asking is the server's business:
 * Foundry appends the emitting user's id to every relayed `system.<id>` event
 * (`handleCustomSocket`: `emit(event, data, userId)`), bound from the session, so it is the one
 * thing on the wire a client cannot write; `dispatch` passes it on and refuses a request without it.
 *
 * The damage, reroll and party relays (`documents/cards/shared.mjs`, `documents/party-socket.mjs`)
 * stay on their own emits for now: they are fire-and-forget with a `*:done` or `*:refused` notice,
 * no request correlation and no revision, and moving them would change three reply paths for no
 * gain in this release. `reroll:*` is the first candidate when one of them wants a correlated
 * reply, since it already touches the attack card.
 */

import * as SW from "../config.mjs";

/** The socket channel system.json declares (`"socket": true`). */
export const SOCKET = `system.${SW.SYSTEM_ID}`;

/** How long a request waits for the coordinator before it is given up as unanswered. */
export const REQUEST_TIMEOUT = 15000;

export class AttackSocket {
  /** Requests this client is waiting on, by request id: `{ resolve, timer, to }`. */
  static #pending = new Map();

  /** A timed-out or undeliverable request's reply, in the coordinator's reply shape. */
  static #timeout(message) {
    return { type: "attack:reply", requestId: message.requestId, ok: false, reason: "timeout", workflowId: message.workflowId };
  }

  /**
   * Emit a request to the one user it names (`message.to`) and wait for that user's reply, or a
   * timeout. A coordinator that does not answer in time is reported as such, not as gone.
   * @param {object} message  `{ type: "attack", requestId, workflowId, expectedRevision, action, payload, userId, to }`
   * @returns {Promise<object>} the reply
   */
  static send(message) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        AttackSocket.#pending.delete(message.requestId);
        resolve(AttackSocket.#timeout(message));
      }, REQUEST_TIMEOUT);
      AttackSocket.#pending.set(message.requestId, { resolve, timer, to: message.to });
      try {
        game.socket.emit(SOCKET, message, { recipients: [message.to] });
      } catch (err) {
        clearTimeout(timer);
        AttackSocket.#pending.delete(message.requestId);
        console.error("STARWROUGHT | attack request could not be sent", err);
        resolve(AttackSocket.#timeout(message));
      }
    });
  }

  /** Emit a reply to the one user it names (`reply.to`). */
  static reply(reply) {
    if (!reply?.to) return;
    try {
      game.socket.emit(SOCKET, reply, { recipients: [reply.to] });
    } catch (err) {
      console.error("STARWROUGHT | attack reply could not be sent", err);
    }
  }

  /** Emit a state broadcast to every other client (an emit does not echo to its sender). */
  static broadcast(message) {
    try {
      game.socket.emit(SOCKET, message);
    } catch (err) {
      console.error("STARWROUGHT | attack state could not be broadcast", err);
    }
  }

  /**
   * A reply to one of this client's requests. Accepted only from the user the request went to
   * (review, 2026-10-01): a reply from anyone else is dropped and the request keeps waiting.
   * @param {object} reply
   * @param {string|null} sender  The emitting user's id, from the server.
   */
  static onReply(reply, sender) {
    const pending = AttackSocket.#pending.get(reply.requestId);
    if (!pending) return;
    if (pending.to && sender && (sender !== pending.to)) return;
    clearTimeout(pending.timer);
    AttackSocket.#pending.delete(reply.requestId);
    pending.resolve(reply);
  }

  /**
   * Route one incoming socket message. A request (`attack`) for this user, from a sender the
   * server vouches for, goes to `onRequest(message)` with the sender written over the payload's
   * `userId`, and its returned reply is emitted back; a reply for this user settles its request; a
   * state broadcast goes to `onState(message, sender)`. Anything else is ignored.
   * @param {object} message
   * @param {string} [senderId]  The emitting user's id, supplied by the server.
   * @param {{onRequest: Function, onState: Function}} handlers
   */
  static dispatch(message, senderId, { onRequest, onState }) {
    if (!message || (typeof message !== "object")) return;
    const sender = (typeof senderId === "string") ? senderId : null;
    switch (message.type) {
      case "attack":
        if (message.to !== game.user.id) return;
        if (!sender || !game.users.has(sender)) return;
        Promise.resolve(onRequest({ ...message, userId: sender }))
          .then(reply => { if (reply) AttackSocket.reply(reply); })
          .catch(err => console.error("STARWROUGHT | attack request failed", err));
        return;
      case "attack:reply":
        if (message.to !== game.user.id) return;
        AttackSocket.onReply(message, sender);
        return;
      case "attack:state":
        onState(message, sender);
        return;
      default:
        return;
    }
  }
}
