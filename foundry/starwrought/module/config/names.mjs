/**
 * The name rules every consumer must agree on: a name to a slug, a name without its cost glyph,
 * and two names compared the way a player types them.
 * Mirrored by assets/build_foundry.mjs through import, never by copy.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/** Slugify a Constellation or Talent name the same way everywhere. */
export function slugify(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Cost glyphs never reach a slug: the v4.10 ⓿❶❷❸❹❺❻, a bracketed Reaction cost such as
    // "(⓿↺)", the v3 ◆ and ◇, the Reaction arrow, the capstone star and the Attribute glyphs.
    .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
    .replace(/[◆◇↺★✦✧⓿❶❷❸❹❺❻]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A Talent's or Maneuver's name as it is printed beside its gold cost glyph. The spreadsheets put
 * the glyph in the name ("Bull Rush ❷", "Strike ❶ to ❸", "Aid ❶ (⓿↺)") and document ids hash that
 * name, so the data keeps it; the sheets and cards print the cost once, as `system.glyph`, and
 * the name without it. Mirrors stripGlyphs and actionName in assets/build_foundry.mjs: the v4.10
 * glyphs and ↺, a bracketed Reaction cost, the v3 ◆ and ◇, the capstone star, and the "to" or
 * "or" a cost range leaves dangling. A name that was nothing but glyphs comes back as it was.
 * @param {string} name
 * @returns {string}
 */
export function plainName(name) {
  const raw = String(name ?? "");
  const bare = raw
    .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
    .replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "")
    .replace(/\s+(to|or)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return bare || raw.trim();
}

/**
 * Names compared the way a player types them: case and stray spaces do not count. Used where a
 * typed name is matched against a document's (an implement named in a Bind, a weapon in a carry
 * state change); in documents/actor.mjs through 0.10.0.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const sameName = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
