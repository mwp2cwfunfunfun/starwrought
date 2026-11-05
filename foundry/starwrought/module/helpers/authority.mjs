/**
 * Who does the writing, when every client hears the same hook.
 *
 * Two questions the round, the Bind's pair-keeper and the relays all ask. `isElected`: exactly one
 * client counts for the table (the pass streak, a sweep), the active GM when there is one, else
 * the active user with the lowest id, which every client computes the same way. `responsibleFor`:
 * exactly one client writes to a given Actor, the active GM when there is one, else the Actor's
 * first active owner in the user list. Both read `game.users` live and nothing else, so the answer
 * on two clients can only differ while the user list is in flight. Through 0.10.0 they lived in
 * documents/combat.mjs.
 */

/**
 * Exactly one client counts for the Combat: the active GM when there is one, otherwise the active
 * user with the lowest id, which every client computes the same way.
 */
export function isElected() {
  const gm = game.users.activeGM;
  if (gm) return gm.id === game.user.id;
  const first = game.users.filter(u => u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  return first?.id === game.user.id;
}

/**
 * Exactly one client writes to an Actor: the active GM when there is one, otherwise the first
 * active owner in the user list.
 */
export function responsibleFor(actor) {
  if (!actor) return false;
  if (game.users.activeGM) return game.user.isActiveGM;
  const owner = game.users.find(u => u.active && actor.testUserPermission(u, "OWNER"));
  return owner?.id === game.user.id;
}
