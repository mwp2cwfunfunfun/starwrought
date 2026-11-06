/**
 * What the rules engine needs from the table that only a client with a canvas can give (0.13.0):
 * where the tokens stand, which encounter and round it is, and the marks a FIRST(round) or
 * ONCE(encounter) leaves on the recipient.
 *
 * `engine.mjs` and the kinds stay pure and read a `scene`, an `encounter` and the recipient's
 * flags that the caller puts on the roll context; this module builds them on the Foundry side and
 * writes the marks. It is the one file under module/rules/ that touches `canvas` and `game`, and
 * only inside its functions, so the build may still import the folder's index without it.
 *
 * Who counts: the tokens `supportFor` counts as allies do (documents/actor/attack.mjs): never a
 * party token, a hidden token, or a Dying, unconscious or dead body. Relation is by disposition
 * against the owner's token: the same disposition is an ally, the opposite an enemy, anything else
 * neutral. Ranges are edge to edge in feet (canvas/geometry.mjs, `gapBetween`); 0 ft is adjacency.
 * Sight (`SEEN`, 0.14.0; ruling 170) is `canSeeToken` below: line of sight between the two tokens'
 * centres against the scene's sight-blocking walls, the seer not Blinded, the seen token not hidden
 * and its actor neither Hidden nor Undetected. Nothing finer (light, sight range, hearing).
 */

import * as SW from "../config.mjs";
import { gapBetween } from "../canvas/geometry.mjs";
// CHARACTER EFFECTS (0.16.0): the two marks the state switch and a one-roll custom effect ask for.
import { markUpdates } from "./effects-state.mjs";

/** Is this token one the rules count? */
function eligible(token) {
  const actor = token?.actor;
  if (!actor || token.document.hidden) return false;
  if (actor.type === SW.PARTY_TYPE) return false;
  const statuses = actor.statuses ?? new Set();
  if ((actor.system?.dying ?? 0) > 0) return false;
  if (actor.system?.conscious === false) return false;
  return !["unconscious", "dying", "dead"].some(s => statuses.has(s));
}

/** ally | enemy | neutral | self, by disposition against the first token's. */
export function relation(a, b) {
  if (!a || !b) return "neutral";
  if (a.id === b.id) return "self";
  const da = a.disposition;
  const db = b.disposition;
  if (da === db) return "ally";
  const friendly = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  const hostile = CONST.TOKEN_DISPOSITIONS.HOSTILE;
  if (((da === friendly) && (db === hostile)) || ((da === hostile) && (db === friendly))) return "enemy";
  return "neutral";
}

/** A token's centre in scene pixels, from the placeable when it is drawn, else from the document. */
function centerOf(doc) {
  const drawn = doc?.object?.center;
  if (drawn) return { x: drawn.x, y: drawn.y };
  const grid = canvas.grid;
  return { x: doc.x + ((doc.width ?? 1) * grid.sizeX) / 2, y: doc.y + ((doc.height ?? 1) * grid.sizeY) / 2 };
}

/**
 * Can the first token see the second (the `SEEN` operator; ruling 170)? A token always sees
 * itself. Otherwise: the seer's actor is not Blinded; the seen token is not hidden and its actor
 * is neither Hidden nor Undetected; and the straight line between the two centres meets no
 * sight-blocking wall (Foundry's sight polygon backend, `mode: "any"`). When the backend is not
 * there to ask, walls are not read and the statuses alone decide.
 * @param {TokenDocument} seer
 * @param {TokenDocument} seen
 * @returns {boolean}
 */
export function canSeeToken(seer, seen) {
  if (!seer || !seen) return false;
  if (seer.id === seen.id) return true;
  if (seer.actor?.statuses?.has("blinded")) return false;
  if (seen.hidden) return false;
  const statuses = seen.actor?.statuses ?? new Set();
  if (statuses.has("hidden") || statuses.has("undetected")) return false;
  const backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
  if (typeof backend?.testCollision !== "function") return true;
  try {
    return !backend.testCollision(centerOf(seer), centerOf(seen), { type: "sight", mode: "any" });
  } catch (error) {
    console.warn("STARWROUGHT | sight test failed; reading the tokens as in sight:", error);
    return true;
  }
}

/**
 * The scene as the rules read it, for one recipient: its token (the one given, else the actor's
 * on the viewed scene), every eligible token with its actor, and the measures (relation, gap and,
 * since 0.14.0, sight). Null when there is no canvas or the recipient has no token there, in which
 * case every positional rule is skipped.
 * @param {Actor} actor
 * @param {TokenDocument|Token|null} [token]
 * @returns {{token: TokenDocument, tokens: Array<{actor: Actor, token: TokenDocument}>, relation: Function, gap: Function, sees: Function}|null}
 */
export function sceneContextFor(actor, token = null) {
  if (!globalThis.canvas?.ready || !globalThis.canvas.scene) return null;
  const doc = token?.document ?? token ?? actor?.tokenOnScene?.() ?? null;
  if (!doc || (doc.parent !== canvas.scene)) return null;
  const tokens = [];
  for (const placeable of canvas.tokens.placeables) {
    if (!eligible(placeable)) continue;
    tokens.push({ actor: placeable.actor, token: placeable.document });
  }
  return { token: doc, tokens, relation, gap: (a, b) => gapBetween(a, b), sees: (a, b) => canSeeToken(a, b) };
}

/**
 * The encounter the marks are filed under: the viewed Combat's id and round, or null when there
 * is none (outside an encounter a FIRST or ONCE applies every time, said on the card).
 * @returns {{combat: string|null, round: number}}
 */
export function encounterContext() {
  const combat = globalThis.game?.combat ?? null;
  return { combat: combat?.id ?? null, round: combat?.round ?? 0 };
}

/**
 * The Threat a Defense answers, from the attack flow's Maneuver record (attack-workflow.mjs):
 * its Threat word, whether the Blow reached in melee, and (0.14.0) the attack's traits for
 * `IF(Trait=...)`. Null for no record.
 * @param {object|null} maneuver
 * @returns {{threat: string, melee: boolean, traits: string[]}|null}
 */
export function threatContext(maneuver) {
  if (!maneuver) return null;
  return {
    threat: maneuver.threat ?? "blow",
    melee: !maneuver.ranged && (maneuver.source !== "spell"),
    traits: Array.isArray(maneuver.traits) ? maneuver.traits.map(t => String(t)) : []
  };
}

/** The kinds of mark a client may be asked to write (module/rules/engine.mjs, the dispatchers). */
const MARK_KINDS = Object.freeze(["round", "encounter", "claim", "state", "effect"]);

/** The system socket, shared with the attack flow, the cards and the party (starwrought.mjs routes by prefix). */
const SOCKET = `system.${SW.SYSTEM_ID}`;

/**
 * Remember that a FIRST(round) or ONCE(encounter) rule applied to this actor, so it does not again
 * until the next round or encounter. `flags.starwrought.rules.round[<key>] = { combat, round }` and
 * `flags.starwrought.rules.encounter[<key>] = { combat }`. Written by the client that resolved the
 * roll when it may write the actor (the owner, or the GM); since 0.18.1 a client that may not
 * RELAYS the marks over the system socket as `rules:marks` to the active GM's client, else to an
 * active owner's, and only a table with neither sees the rule apply again (noted in
 * AUTOMATION_GRAMMAR.md). Through 0.18.0 such a mark was dropped, so a Skip set on Wren's
 * Torchbearer line and spent on Tess's Defense roll stayed Skip until Wren's own client touched it.
 *
 * Since 0.16.0 two more kinds of mark (module/rules/engine.mjs, the dispatchers; the writes in
 * module/rules/effects-state.mjs, `markUpdates`): `per: "state"` clears a Skip line's state
 * (`flags.starwrought.rules.state.<key>` deleted, so the line is On again), and `per: "effect"`
 * spends a one-roll custom effect (its row removed from `system.effects`). A mark may name another
 * actor as `owner` (a Skip on another token's FOR rule, which is that owner's state): it is
 * written there, or relayed, the same way.
 * @param {Actor} actor
 * @param {Array<{key: string, per: string, owner?: string}>} marks
 * @param {{combat: string|null, round: number}} [encounter]
 */
export async function writeRuleMarks(actor, marks, encounter = encounterContext()) {
  if (!actor || !Array.isArray(marks) || !marks.length) return;
  const own = marks.filter(m => !m?.owner || (m.owner === actor.uuid));
  const others = marks.filter(m => m?.owner && (m.owner !== actor.uuid));
  await writeOrRelay(actor, own, encounter);
  // Another owner's state marks, grouped by owner (0.16.0).
  const byOwner = new Map();
  for (const mark of others) (byOwner.get(mark.owner) ?? byOwner.set(mark.owner, []).get(mark.owner)).push(mark);
  for (const [uuid, list] of byOwner) {
    const target = resolveActor(uuid);
    if (target) await writeOrRelay(target, list, encounter);
  }
}

/** The Actor a uuid names, through a Token when it names one; null for anything else. */
function resolveActor(uuid) {
  try {
    const doc = globalThis.fromUuidSync?.(uuid) ?? null;
    if (doc?.documentName === "Actor") return doc;
    if (doc?.documentName === "Token") return doc.actor ?? null;
  } catch { /* an unreadable uuid names nobody */ }
  return null;
}

/** Write the marks here when this client may, else hand them to a client that may (0.18.1). */
async function writeOrRelay(actor, marks, encounter) {
  if (!actor || !marks.length) return;
  if (actor.isOwner || globalThis.game?.user?.isGM) return writeMarksOn(actor, marks, encounter);
  relayMarks(actor, marks);
}

/**
 * Send the marks to a client that can write the actor: the active GM's, else the first active
 * owner's. With neither connected nothing is sent and the rule applies again next time, as it did
 * through 0.18.0. The payload is the actor's uuid and the marks' keys and kinds, nothing else; the
 * receiving client reads the encounter from its own view.
 */
function relayMarks(actor, marks) {
  const users = globalThis.game?.users;
  const recipient = users?.activeGM ?? users?.find?.(u => u.active && actor.testUserPermission(u, "OWNER")) ?? null;
  if (!recipient || (recipient.id === game.user.id)) return;
  game.socket.emit(SOCKET, {
    type: "rules:marks", to: recipient.id, actorUuid: actor.uuid,
    marks: marks.map(({ key, per }) => ({ key: String(key ?? ""), per: String(per ?? "") }))
  }, { recipients: [recipient.id] });
}

/**
 * The rules' half of the system socket (0.18.1): starwrought.mjs routes every `rules:*` message
 * here. A `rules:marks` is served on the client it is addressed to, when that client may write the
 * actor; the asker is the server's stamp, never a field of the payload, and the payload is trusted
 * for nothing but the uuid and the marks' keys and kinds (a key the flags do not hold deletes
 * nothing; a round or encounter mark is filed under this client's own view of the Combat). No
 * reply: a mark is bookkeeping, and the roll's card is the record.
 * @param {object} message
 * @param {string} [senderId]  The emitting user's id, supplied by the server.
 */
export async function onRulesSocket(message, senderId) {
  if (!message || (typeof message !== "object") || (message.to !== game.user.id)) return;
  if ((message.type !== "rules:marks") || !((typeof senderId === "string") && game.users.has(senderId))) return;
  const actor = resolveActor(message.actorUuid);
  if (!actor || !(actor.isOwner || game.user.isGM)) return;
  const marks = (Array.isArray(message.marks) ? message.marks : [])
    .filter(m => m && (typeof m.key === "string") && m.key && MARK_KINDS.includes(m.per))
    .map(m => ({ key: m.key, per: m.per }));
  if (!marks.length) return;
  try {
    await writeMarksOn(actor, marks, encounterContext());
  } catch (error) {
    console.error(`STARWROUGHT | the rule marks relayed for ${actor.name} could not be written`, error);
  }
}

/** The marks for one actor, written in one update when this client may write it. */
async function writeMarksOn(actor, marks, encounter) {
  if (!actor || !marks.length) return;
  if (!(actor.isOwner || globalThis.game?.user?.isGM)) return;
  const update = {};
  for (const { key, per } of marks) {
    if (!key) continue;
    // A flag key is a path: the colon of "<item>:<line>" is fine, a dot would not be.
    const safe = SW.flagKey(key);
    // A claim's mark spends an armed claim (0.15.0, ruling 174): the pin goes out.
    if (per === "claim") {
      if (actor.flags?.starwrought?.rules?.armed?.[safe] !== undefined) update[`flags.starwrought.rules.armed.-=${safe}`] = null;
      continue;
    }
    // A Skip spent or a one-roll effect used (0.16.0): effects-state.mjs knows the two writes.
    if ((per === "state") || (per === "effect")) continue;
    if (!["round", "encounter"].includes(per) || !encounter?.combat) continue;
    update[`flags.starwrought.rules.${per}.${safe}`] = per === "round"
      ? { combat: encounter.combat, round: encounter.round ?? 0 }
      : { combat: encounter.combat };
  }
  Object.assign(update, markUpdates(actor, marks));
  if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
}
