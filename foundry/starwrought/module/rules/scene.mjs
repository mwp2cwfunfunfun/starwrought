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
 */

import * as SW from "../config.mjs";
import { gapBetween } from "../canvas/geometry.mjs";

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
function relation(a, b) {
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

/**
 * The scene as the rules read it, for one recipient: its token (the one given, else the actor's
 * on the viewed scene), every eligible token with its actor, and the two measures. Null when there
 * is no canvas or the recipient has no token there, in which case every positional rule is skipped.
 * @param {Actor} actor
 * @param {TokenDocument|Token|null} [token]
 * @returns {{token: TokenDocument, tokens: Array<{actor: Actor, token: TokenDocument}>, relation: Function, gap: Function}|null}
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
  return { token: doc, tokens, relation, gap: (a, b) => gapBetween(a, b) };
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
 * its Threat word and whether the Blow reached in melee. Null for no record.
 * @param {object|null} maneuver
 * @returns {{threat: string, melee: boolean}|null}
 */
export function threatContext(maneuver) {
  if (!maneuver) return null;
  return { threat: maneuver.threat ?? "blow", melee: !maneuver.ranged && (maneuver.source !== "spell") };
}

/**
 * Remember that a FIRST(round) or ONCE(encounter) rule applied to this actor, so it does not again
 * until the next round or encounter. `flags.starwrought.rules.round[<key>] = { combat, round }` and
 * `flags.starwrought.rules.encounter[<key>] = { combat }`. Written by the client that resolved the
 * roll, when it may write the actor (the owner, or the GM); nothing else is written, and a table
 * with no such client sees the rule apply again, noted in AUTOMATION_GRAMMAR.md.
 * @param {Actor} actor
 * @param {Array<{key: string, per: string}>} marks
 * @param {{combat: string|null, round: number}} [encounter]
 */
export async function writeRuleMarks(actor, marks, encounter = encounterContext()) {
  if (!actor || !Array.isArray(marks) || !marks.length || !encounter?.combat) return;
  if (!(actor.isOwner || globalThis.game?.user?.isGM)) return;
  const update = {};
  for (const { key, per } of marks) {
    if (!key || !["round", "encounter"].includes(per)) continue;
    // A flag key is a path: the colon of "<item>:<line>" is fine, a dot would not be.
    const safe = String(key).replace(/\./g, "-");
    update[`flags.starwrought.rules.${per}.${safe}`] = per === "round"
      ? { combat: encounter.combat, round: encounter.round ?? 0 }
      : { combat: encounter.combat };
  }
  if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
}
