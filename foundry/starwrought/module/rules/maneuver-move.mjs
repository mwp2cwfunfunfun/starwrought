/**
 * A Move made as part of a Maneuver (0.24.0; rulings 240 to 244): the record a `PERMIT` line
 * leaves when its Maneuver is used, and the pure reading of it that the charge
 * (module/documents/movement.mjs) and the ruler (module/canvas/ruler.mjs) share.
 *
 * Mike, 2026-11-14, of Move Together ("You Move up to your Speed. The chosen ally may then spend ❶
 * of its own actions to immediately Move up to its Speed as part of this same Maneuver"): "Plan
 * it." Through 0.23.1 the ally's drag on the user's Opportunity was off-turn and waited for the GM.
 *
 * ONE RECORD, ON THE USER (ruling 244), `flags.starwrought.maneuverMove`:
 *
 *   { nonce,                 // names this use, so the ally can say "I have moved for this one"
 *     combat, round, during, // the encounter, the round and the combatant whose Opportunity was
 *                            // running when the Maneuver was used (not always the user's own: a
 *                            // use the GM approved is off-turn)
 *     from,                  // the Maneuver's plain name, for the move's card
 *     userTokenId,           // the user's token, whose next drag is the Maneuver's own Move
 *     allyTokenId, allyName, // the token permitted to Move
 *     range,                 // the `FOR` range in feet (0 is adjacent), or null: how near the user
 *                            // the permitted Move should end, said on its card when it does not
 *     step,                  // an alteration (`ALTER: <Maneuver>.movement; VALUE: step`) lets a
 *                            // drag within half Speed be a Step for both
 *     moved }                // the user has made their Move
 *
 * It is LIVE only while that Combat, that round and that Opportunity are current, so it ends with
 * the Opportunity the Maneuver was used in. No copy is written on the ally and nothing is relayed:
 * every client can read the user's flags, the ally's client marks its own use on its own actor
 * (`flags.starwrought.maneuverMoved = { nonces: [...] }`, the uses it has moved for, the last few
 * kept: two fighters may permit the same ally in one Opportunity), and the user's drag sets
 * `moved`. The record is taken off its holder WHEN THAT OPPORTUNITY ENDS (./effects-state.mjs,
 * `endManeuverMoves`, on every turn change and on a lone fighter's step to itself): the same
 * combatant comes round again within a round, and the liveness test alone would then wake a
 * record nobody used, or one a rewind stepped back onto. The ally's mark stays until the
 * encounter ends; it is compared by nonce, so an old one spends nothing.
 *
 * WHAT A LIVE RECORD CHANGES (rulings 240 to 242): the drag is the Maneuver's Move. It asks nothing
 * of the GM off-turn, and the GM's own drag of that token counts; it is a Move however short, so it
 * can provoke an Intercept, unless `step` and the drag is within half Speed; it is never a Rush (a
 * longer straight drag is as many Moves as it needs, which the one-Maneuver cap then refuses); a
 * Speed 0 crawl stays a crawl; and the user's own is one Move's worth cheaper, since the click paid.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS: assets/test_rules.mjs drives it from Node.
 */

/** The flag on the user that holds the record, and the flag on the ally that says it has moved. */
export const MOVE_RECORD_FLAG = "maneuverMove";
export const MOVE_USED_FLAG = "maneuverMoved";

/**
 * The record a use writes. Every key is written every time: a flag update merges, so a key left
 * out would keep the last use's value.
 * @param {object} spec
 * @returns {object}
 */
export function moveRecord({ nonce = "", combat = null, round = 0, during = null, from = "", userTokenId = null, allyTokenId = null, allyName = "", range = null, step = false } = {}) {
  return {
    nonce: String(nonce ?? ""),
    combat: combat ?? null,
    round: Number(round) || 0,
    during: during ?? null,
    from: String(from ?? ""),
    userTokenId: userTokenId ?? null,
    allyTokenId: allyTokenId ?? null,
    allyName: String(allyName ?? ""),
    range: Number.isFinite(range) ? Number(range) : null,
    step: step === true,
    moved: false
  };
}

/**
 * Is the record live: made in this Combat, this round, and during the Opportunity now running?
 * @param {object|null} record
 * @param {{combat: string|null, round: number, combatant: string|null}|null} encounter
 * @returns {boolean}
 */
export function recordLive(record, encounter) {
  if (!record || !record.nonce || !record.combat || !record.during) return false;
  if (!encounter?.combat || !encounter.combatant) return false;
  return (record.combat === encounter.combat) && (record.round === (encounter.round ?? 0)) && (record.during === encounter.combatant);
}

/** How many uses an ally's mark remembers. One Opportunity never holds more permissions than this. */
export const MOVE_USED_KEPT = 6;

/**
 * The uses an actor says it has moved for, from its mark: `{ nonces: [...] }`, or a bare nonce or
 * a list of them.
 * @param {object|string|string[]|null} mark
 * @returns {string[]}
 */
export function usedNonces(mark) {
  if (!mark) return [];
  const list = Array.isArray(mark) ? mark : (typeof mark === "string") ? [mark] : [...(Array.isArray(mark.nonces) ? mark.nonces : []), mark.nonce];
  return list.filter(n => (typeof n === "string") && n);
}

/**
 * The mark with one more use on it, the last `MOVE_USED_KEPT` kept.
 * @param {object|string|string[]|null} mark
 * @param {string} nonce
 * @returns {{nonces: string[]}}
 */
export function withUsed(mark, nonce) {
  const nonces = usedNonces(mark).filter(n => n !== nonce);
  if (nonce) nonces.push(String(nonce));
  return { nonces: nonces.slice(-MOVE_USED_KEPT) };
}

/**
 * What a drag of this token is by the records of the encounter: the user's own Move, the ally's
 * permitted Move, or neither.
 * @param {string} tokenId       The dragged token.
 * @param {object} facts
 * @param {object[]} facts.records    Every record held by a fighter of the encounter (live or not).
 * @param {object|string|string[]|null} [facts.used]  The dragged token's own actor's mark: the uses it has moved for.
 * @param {object|null} facts.encounter
 * @returns {{role: "user"|"ally", record: object}|null}
 */
export function moveRoleFor(tokenId, { records = [], used = null, encounter = null } = {}) {
  if (!tokenId) return null;
  const spent = usedNonces(used);
  for (const record of records) {
    if (!recordLive(record, encounter)) continue;
    if ((record.userTokenId === tokenId) && (record.moved !== true)) return { role: "user", record };
    if ((record.allyTokenId === tokenId) && !spent.includes(record.nonce)) return { role: "ally", record };
  }
  return null;
}

/**
 * The drag as the Maneuver's Move: `classifyMove`'s answer with the kind forced and the user's
 * prepaid Move counted. `charge` is what the mover pays.
 * @param {{kind: string, actions: number, moves: number, rushInstead?: boolean}} move
 * @param {{role: "user"|"ally", record: object}} held
 * @returns {{kind: string, actions: number, moves: number, rushInstead: boolean, forced: boolean, prepaid: number, charge: number}}
 */
export function asManeuverMove(move, held) {
  const base = { kind: move?.kind ?? "move", actions: Number(move?.actions) || 0, moves: Number(move?.moves) || 0, rushInstead: false };
  let out = base;
  let forced = false;
  // A crawl is all a fighter at Speed 0 can do, and a Step is a Step when the alteration allows it;
  // anything else is a Move, as many as the distance needs (never a Rush: "Move up to your Speed").
  const kept = (base.kind === "crawl") || (base.kind === "move") || ((base.kind === "step") && (held?.record?.step === true));
  if (!kept) {
    const moves = Math.max(1, base.moves);
    out = { kind: "move", actions: moves, moves, rushInstead: false };
    forced = true;
  }
  const prepaid = (held?.role === "user") ? Math.min(1, out.actions) : 0;
  return { ...out, forced, prepaid, charge: Math.max(0, out.actions - prepaid) };
}
