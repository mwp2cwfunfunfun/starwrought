/**
 * A system setting read without throwing. A hook can fire before `registerSettings` has run (a
 * token moved during load), and a module's constant default is the right answer then, so every
 * reader that may run early uses this rather than `game.settings.get` bare. Through 0.10.0 it
 * lived in documents/combat.mjs; the attack coordinator keeps a private copy, which stays with the
 * coordinator (Mike, 2026-11-04: leave it whole until the Threat model broadens).
 */

import * as SW from "../config.mjs";

/** A setting that may not be registered yet, read without throwing. */
export function setting(key, fallback) {
  try {
    return game.settings.get(SW.SYSTEM_ID, key);
  } catch {
    return fallback;
  }
}
