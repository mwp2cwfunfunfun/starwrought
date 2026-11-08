/**
 * The Bind's two-sided record, kept whole (0.5.1; the protocol moved here from canvas/bind.mjs in
 * 0.10.1).
 *
 * A Bind is written on two actors (`system.bind` on each side, PHB v4.10, The Bind), and the
 * client that forms or ends it may own only one of them: a player clicking "Form a Bind" on the
 * card against an adversary. `SwActor#formBind` and `SwActor#endBind` write what they can and
 * mark the update with an `swBind` option saying whether the writer handled both sides
 * (`paired`), and, for an ending, who the partner was (`previousPartner`). When the writer could
 * not, exactly one other client, the active GM, else the connected owner of the partner with the
 * lowest id, writes the partner's side as the update reaches it (`pickUpMirror`); the same pickup
 * clears the partner's side when a Bind ends. A sweep at ready and at each canvas settles whatever
 * was left half-written while an owner was away (`keepPaired`). The emptied record keeps the
 * Bind's `id` as a tombstone, so a half that was never mirrored can be told from a half whose
 * partner ended it (review, 2026-10-01).
 *
 * This file writes documents and draws nothing: the chains on the map are canvas/bind.mjs, which
 * only redraws on the same hook. The mirror table and the uuid resolver are defined here once and
 * imported by documents/actor.mjs and canvas/bind.mjs, where each had a copy through 0.10.1.
 */

/** This actor's state -> the state the partner's side must show. */
export const MIRROR = Object.freeze({ neutral: "neutral", controlling: "controlled", controlled: "controlling" });

/**
 * The Actor behind a uuid, whether the uuid names an Actor or a Token; null when it names nothing
 * or the uuid cannot be read.
 * @param {string} uuid
 * @returns {Actor|null}
 */
export function resolveActor(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { doc = null; }
  if (!doc) return null;
  if (doc.documentName === "Actor") return doc;
  return doc.actor ?? null;
}

/** Register the hooks that keep the pairs whole. Called once at init, beside the canvas hooks. */
export function registerBindSync() {
  Hooks.on("updateActor", (actor, changes, options) => {
    if (!foundry.utils.hasProperty(changes, "system.bind")) return;
    pickUpMirror(actor, options?.swBind ?? {});
  });
  Hooks.once("ready", () => keepPaired());
  // A scene change brings this scene's unlinked tokens into the sweep, so it runs again here.
  Hooks.on("canvasReady", () => {
    if (game.ready) keepPaired();
  });
}

/**
 * Write the partner's side of a Bind this actor just recorded, or clear it for a Bind this actor
 * just ended, when the writer could not and this client is the one elected to.
 * @param {Actor} actor
 * @param {{paired?: boolean, previousPartner?: string}} mark  The update's `swBind` option.
 */
export function pickUpMirror(actor, { paired = true, previousPartner = "" } = {}) {
  if (paired) return;
  const bind = actor.system?.bind;
  const partner = resolveActor(bind?.state ? bind.partnerUuid : previousPartner);
  if (!partner || (partner === actor) || !partner.isOwner || !isMirrorWriter(partner)) return;
  const theirs = partner.system?.bind;

  if (bind?.state) {
    // The partner's empty side still naming this Bind's id is the side that ended it (a Recenter
    // or a Move while nobody could write the mirror): the record here is the stale half, so it is
    // cleared rather than the pair re-formed (review, 2026-10-01). A record from before Binds had
    // ids falls through to the mirror write below, as it always did.
    if (!theirs?.state && theirs?.id && (theirs.id === bind.id)) {
      if (actor.isOwner) {
        actor.endBind({ announce: false, pair: false })
          .catch(err => console.error(`STARWROUGHT | ${actor.name}: a Bind its partner had ended could not be cleared`, err));
      }
      return;
    }
    const want = MIRROR[bind.state];
    if ((theirs?.state === want) && (theirs.partnerUuid === actor.uuid)) return;
    // The Control's Zone (0.19.0) rides along, so the Controlled side's write opens it here.
    partner.formBind(actor, { state: want, mine: bind.theirs, theirs: bind.mine, id: bind.id, zone: bind.zone ?? "", announce: false, pair: false })
      .catch(err => console.error(`STARWROUGHT | ${partner.name}: the Bind's other side could not be written`, err));
    return;
  }
  if (theirs?.state && (theirs.partnerUuid === actor.uuid)) {
    partner.endBind({ announce: false, pair: false })
      .catch(err => console.error(`STARWROUGHT | ${partner.name}: the Bind's other side could not be cleared`, err));
  }
}

/**
 * Exactly one client writes a mirror: the active GM, who owns everything, else the connected
 * owner with the lowest id. Two owners of one character therefore never race each other.
 * @param {Actor} actor
 * @returns {boolean}
 */
function isMirrorWriter(actor) {
  const gm = game.users.activeGM;
  if (gm) return gm.id === game.user.id;
  const owners = game.users
    .filter(u => u.active && actor.testUserPermission(u, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  return owners[0]?.id === game.user.id;
}

/**
 * Settle half-written pairs: every actor recording a Bind whose partner does not record it back
 * gets its mirror written, by the elected client, or is cleared when the partner's emptied record
 * carries this Bind's id (the partner ended it while nobody could write the mirror). Run once at
 * ready and on each canvas, for a Bind formed or ended while the partner's owner was away; one
 * changed while they are connected is picked up as it is written.
 */
export function keepPaired() {
  const actors = [...game.actors];
  for (const token of canvas?.scene?.tokens ?? []) {
    if (!token.actorLink && token.actor) actors.push(token.actor);
  }
  for (const actor of actors) {
    if (actor.system?.bind?.state) pickUpMirror(actor, { paired: false });
  }
}
