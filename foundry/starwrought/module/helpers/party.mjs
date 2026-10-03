/**
 * The party's operations (0.7.0; party-sheet-plan.md, parts 1 to 3).
 *
 * The party sheet is the GM's console and the players' window; these are the verbs it calls, and
 * nothing else needs to know about them. The party never does a member's arithmetic: a rest is the
 * member's `restForTheNight`, a Flare is the member's `toggleFlare`, and a Milestone, a Hero Point
 * or a Deferred point is one small write to the member's own fields, read back from the member's
 * derived data (the Vigor maximum a level raises is read after the level lands, never computed
 * here). Every write to a character goes through `actor.update(..., { swAnnounced: true })`, so
 * the player-edit audit (documents/audit.mjs) never doubles a card the party has already posted.
 *
 * Cards: the party speaks (`ChatMessage.getSpeaker({ actor: party })`) for Begin session, the
 * Milestone award, Take back and the party's night; the member speaks for a Hero Point award or
 * correction and for a Deferred point spent. Dialogs belong to the sheet; these functions refuse,
 * write and say.
 *
 * Rulings (Mike, 2026-10-02, numbered on from the v4.14 report): 91 a Milestone award goes to
 * every member by default, with a checkbox per member to withhold it; 92 when the fourth Milestone
 * raises a level, current Vigor rises by the same amount as the maximum; 93 Begin session sets
 * every member's Hero Points to exactly 1; 94 Deferred Talent Points are counted on the character
 * and nothing is enforced; 95 players see every member's Thresholds on the Skills grid.
 */

import * as SW from "../config.mjs";
import { cardHtml, postCard } from "../documents/combat.mjs";

const { escapeHTML } = foundry.utils;
const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/* -------------------------------------------- */
/*  Members                                     */
/* -------------------------------------------- */

/**
 * The world Actor a member uuid names, or null when it names nothing a party can hold (deleted,
 * or no longer a character).
 * @param {string} uuid
 * @returns {Actor|null}
 */
function actorFor(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { doc = null; }
  if (!doc || (doc.documentName !== "Actor")) return null;
  if (doc.type !== "character") return null;
  return doc;
}

/**
 * The members, resolved: `actor` is null for one that cannot be found, and the sheet prints that
 * row with Remove only (plan, risk 7).
 * @param {Actor} party
 * @returns {Array<{uuid: string, actor: Actor|null}>}
 */
export function resolveMembers(party) {
  return (party?.system?.members ?? []).map(({ uuid }) => ({ uuid, actor: actorFor(uuid) }));
}

/** The resolved members that exist, as Actors, in order. */
export function memberActors(party) {
  return resolveMembers(party).map(m => m.actor).filter(Boolean);
}

/**
 * May this Actor join a party? Characters only, in every phase planned (plan, decision 13): a
 * linked token stands for its base Actor; an unlinked token's synthetic Actor, an adversary, a
 * party and a compendium Actor are refused, each with its own notice.
 * @param {Actor} actor  The dropped document.
 * @returns {{actor: Actor|null, refusal: string|null}}  The Actor to add, or the i18n key saying why not.
 */
export function memberCandidate(actor) {
  if (!actor || (actor.documentName !== "Actor")) return { actor: null, refusal: "STARWROUGHT.Party.refusedUnknown" };
  // A linked token's actor is the world Actor itself; a synthetic one belongs to an unlinked token.
  if (actor.isToken) {
    const base = actor.token?.actorLink ? (actor.token.baseActor ?? null) : null;
    if (!base) return { actor: null, refusal: "STARWROUGHT.Party.refusedUnlinked" };
    actor = base;
  }
  if (actor.pack || actor.inCompendium) return { actor: null, refusal: "STARWROUGHT.Party.refusedCompendium" };
  if (actor.type === SW.PARTY_TYPE) return { actor: null, refusal: "STARWROUGHT.Party.refusedParty" };
  if (actor.type !== "character") return { actor: null, refusal: "STARWROUGHT.Party.refusedNpc" };
  return { actor, refusal: null };
}

/**
 * Add a character to the party, once. Membership posts nothing: the roster is the record.
 * @param {Actor} party
 * @param {Actor} actor  A world character (see memberCandidate).
 * @returns {Promise<boolean>}  Whether the roster changed.
 */
export async function addMember(party, actor) {
  if (!game.user.isGM) return false;
  const members = (party.system.members ?? []).map(m => ({ uuid: m.uuid }));
  if (members.some(m => m.uuid === actor.uuid)) {
    ui.notifications.info(F("STARWROUGHT.Party.alreadyMember", { name: actor.name }));
    return false;
  }
  members.push({ uuid: actor.uuid });
  await party.update({ "system.members": members });
  return true;
}

/**
 * Remove a member by uuid, found or missing. The character itself is untouched.
 * @param {Actor} party
 * @param {string} uuid
 * @returns {Promise<boolean>}
 */
export async function removeMember(party, uuid) {
  if (!game.user.isGM) return false;
  const members = (party.system.members ?? []).filter(m => m.uuid !== uuid).map(m => ({ uuid: m.uuid }));
  if (members.length === (party.system.members ?? []).length) return false;
  await party.update({ "system.members": members });
  return true;
}

/**
 * Add every user's assigned character, each once, in user order (the toolbar button). A user with
 * no character, or one whose character is not a world character, adds nothing.
 * @param {Actor} party
 * @returns {Promise<number>}  How many joined.
 */
export async function addPlayerCharacters(party) {
  if (!game.user.isGM) return 0;
  const members = (party.system.members ?? []).map(m => ({ uuid: m.uuid }));
  let added = 0;
  for (const user of game.users) {
    const { actor } = memberCandidate(user.character);
    if (!actor || members.some(m => m.uuid === actor.uuid)) continue;
    members.push({ uuid: actor.uuid });
    added++;
  }
  if (added) await party.update({ "system.members": members });
  return added;
}

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

/** A card spoken by the party, in the system's card idiom (cardHtml in documents/combat.mjs). */
function postPartyCard(party, { root, icon = "", title, lines = [], notes = [] }) {
  const heading = icon ? `<i class="${escapeHTML(icon)}"></i> ${title}` : title;
  return postCard(party, cardHtml({ root: `sw-party-card ${root}`, actorUuid: party.uuid, title: heading, lines, notes }));
}

/** A card spoken by a member, the same way. */
function postMemberCard(actor, { root, icon = "", title, lines = [], notes = [] }) {
  const heading = icon ? `<i class="${escapeHTML(icon)}"></i> ${title}` : title;
  return postCard(actor, cardHtml({ root, actorUuid: actor.uuid, title: heading, lines, notes }));
}

/* -------------------------------------------- */
/*  Session start and Hero Points (part 2)      */
/* -------------------------------------------- */

/**
 * Begin a session: `session.number + 1`, and every member's Hero Points set to exactly 1 (ruling
 * 93; PHB: you start each session with 1 and the GM awards more, so a point carried out of the
 * last session is reset and a GM who wants a player to keep one adds it back in public). One card
 * spoken by the party, with a line per member whose count changed. The sheet confirms first.
 * @param {Actor} party
 * @returns {Promise<number|null>}  The new session number, or null when nothing was done.
 */
export async function beginSession(party) {
  if (!game.user.isGM) return null;
  const next = (Number(party.system.session?.number) || 0) + 1;
  const lines = [F("STARWROUGHT.Party.sessionBegins", { n: next })];
  for (const actor of memberActors(party)) {
    const before = Number(actor.system.heroPoints?.value) || 0;
    if (before === 1) continue;
    await actor.update({ "system.heroPoints.value": 1 }, { swAnnounced: true });
    lines.push(escapeHTML(F("STARWROUGHT.Party.heroPointsReset", { name: actor.name, from: before })));
  }
  await party.update({ "system.session.number": next, "system.session.began": Date.now() });
  await postPartyCard(party, {
    root: "sw-session-card",
    icon: "fa-solid fa-play",
    title: escapeHTML(F("STARWROUGHT.Party.sessionTitle", { n: next })),
    lines
  });
  return next;
}

/**
 * Award a member one Hero Point, with an optional reason for the record, refused at the maximum
 * with a notice before any write (the schema's `max` would otherwise throw mid-batch; plan, risk
 * 13). The member speaks: "The GM awards Hrolda a Hero Point: carrying Toric out of the fire
 * (2 of 3)."
 * @param {Actor} actor
 * @param {object} [options]
 * @param {string} [options.reason]
 * @returns {Promise<number|null>}  The new count, or null when refused.
 */
export async function awardHeroPoint(actor, { reason = "" } = {}) {
  if (!game.user.isGM || !actor) return null;
  const have = Number(actor.system.heroPoints?.value) || 0;
  const max = SW.HERO_POINTS_MAX;
  if (have >= max) {
    ui.notifications.warn(F("STARWROUGHT.Party.heroPointsFull", { name: actor.name, max }));
    return null;
  }
  const next = have + 1;
  await actor.update({ "system.heroPoints.value": next }, { swAnnounced: true });
  const why = String(reason ?? "").trim();
  const line = why
    ? F("STARWROUGHT.HeroPoints.awardedFor", { name: escapeHTML(actor.name), reason: escapeHTML(why), n: next, max })
    : F("STARWROUGHT.HeroPoints.awarded", { name: escapeHTML(actor.name), n: next, max });
  await postMemberCard(actor, {
    root: "sw-hero-card",
    icon: "fa-solid fa-star",
    title: L("STARWROUGHT.HeroPoints.title"),
    lines: [line]
  });
  return next;
}

/**
 * Correct a member's Hero Points by a delta (the minus on the roster; a mistake, not a spend, so
 * it is said as a correction). Clamped to 0 and the maximum; a change to nothing writes nothing.
 * @param {Actor} actor
 * @param {number} delta
 * @returns {Promise<number|null>}  The new count, or null when nothing changed.
 */
export async function correctHeroPoint(actor, delta) {
  if (!game.user.isGM || !actor) return null;
  const have = Number(actor.system.heroPoints?.value) || 0;
  const next = Math.clamp(have + (Number(delta) || 0), 0, SW.HERO_POINTS_MAX);
  if (next === have) return null;
  await actor.update({ "system.heroPoints.value": next }, { swAnnounced: true });
  await postMemberCard(actor, {
    root: "sw-hero-card",
    icon: "fa-solid fa-star",
    title: L("STARWROUGHT.HeroPoints.title"),
    lines: [F("STARWROUGHT.HeroPoints.corrected", { name: escapeHTML(actor.name), n: next })]
  });
  return next;
}

/* -------------------------------------------- */
/*  The party's night (part 2)                  */
/* -------------------------------------------- */

/**
 * Who would sleep in armor without Comfort tonight: the members whose worn Torso piece lacks the
 * trait, named for the confirm. The book's "waking Fatigued 1" is not implemented (FEATURES,
 * section 7); the preview names them and the table decides.
 * @param {Actor} party
 * @returns {Array<{name: string, piece: string}>}
 */
export function restPreview(party) {
  const rows = [];
  for (const actor of memberActors(party)) {
    const torso = actor.system.worn?.torso ?? null;
    if (!torso || torso.system?.comfort) continue;
    rows.push({ name: actor.name, piece: torso.name });
  }
  return rows;
}

/**
 * The party's night: `restForTheNight()` on every member in turn, each posting its own rest card
 * as the sheet's Rest button does, then one line from the party. The sheet confirms first.
 * @param {Actor} party
 * @returns {Promise<number>}  How many members rested.
 */
export async function partyRests(party) {
  if (!game.user.isGM) return 0;
  const actors = memberActors(party);
  for (const actor of actors) await actor.restForTheNight();
  await postPartyCard(party, {
    root: "sw-rest-card",
    icon: "fa-solid fa-bed",
    title: L("STARWROUGHT.Party.restsTitle"),
    lines: [L("STARWROUGHT.Party.rested")]
  });
  return actors.length;
}

/* -------------------------------------------- */
/*  The Milestone award (part 3)                */
/* -------------------------------------------- */

/** The names of a member's Flared Constellations, as the member's own data spells them. */
function flaredNames(actor) {
  const sys = actor.system;
  return Object.keys(sys.flares ?? {})
    .map(slug => sys.constellations?.[slug]?.name ?? SW.getConstellation(slug)?.name ?? slug)
    .sort((a, b) => a.localeCompare(b));
}

/** The numbers an award writes, as they stand now. */
function snapshot(actor) {
  const sys = actor.system;
  return {
    level: Number(sys.level) || 0,
    milestone: Number(sys.milestone) || 0,
    deferred: Number(sys.deferred) || 0,
    vigor: Number(sys.vigor?.value) || 0
  };
}

/**
 * The Vigor maximum the character model would derive at a level (data/actor.mjs, #prepareVigor):
 * 10 + Opening Vigor + (Ancestry Vigor + Endure Bonus) × level + the adjustment, with the Endure
 * Bonus read from the rank the Endure pool reaches at that level, so a level that opens Expert
 * in Endure lifts every level's share. The preview uses the difference between this at the
 * current level and at the next, applied to the maximum the model shows, so any drift between
 * this and the model cancels; the award itself reads the recomputed maximum after the level lands.
 * @param {Actor} actor
 * @param {number} level
 * @returns {number}
 */
function vigorMaxAt(actor, level) {
  const sys = actor.system;
  const endure = sys.constellations?.[SW.DEFENSES.endure.slug];
  const pool = Number(endure?.pool ?? endure?.points) || 0;
  const rank = endure ? SW.rankFor(pool, level) : "untrained";
  const perLevel = (Number(sys.details?.ancestry?.vigor) || 0) + (SW.ENDURE_VIGOR_BONUS[rank] ?? 0);
  const opening = Number(sys.details?.calling?.vigor) || 0;
  return Math.max(1, 10 + opening + (perLevel * level) + (Number(sys.bonuses?.vigor) || 0));
}

/** The rank whose level gate a new level reaches exactly (Expert at 5th, Master at 10th, Legendary at 15th), or null. */
function rankOpeningAt(level) {
  for (const key of SW.RANK_ORDER) {
    const rank = SW.RANKS[key];
    if ((rank.level === level) && (rank.level > 1)) return rank;
  }
  return null;
}

/**
 * One preview line per member, for the award dialog (ruling 91: every member ticked by default):
 * "Hrolda: Milestone 2 of 3, a Milestone Talent Point (Flared: Melee, Athletics)"; "Wren:
 * Milestone 3 of 3, no Constellation Flared, so a Deferred point"; "Kessa: the 4th Milestone,
 * level 3, Vigor 36 to 45, a Comet", with "; Expert opens" at 5th, 10th and 15th (decision 10).
 * @param {Actor} party
 * @returns {Array<{uuid: string, name: string, line: string, levelUp: boolean}>}
 */
export function previewMilestone(party) {
  const of = SW.MILESTONES_PER_LEVEL;
  const rows = [];
  for (const { uuid, actor } of resolveMembers(party)) {
    if (!actor) continue;
    const sys = actor.system;
    const reached = Math.clamp(Number(sys.milestone) || 0, 0, of);
    const name = actor.name;
    if (reached < of) {
      const flared = flaredNames(actor);
      const line = flared.length
        ? F("STARWROUGHT.Milestone.previewPoint", { name, n: reached + 1, of, flared: flared.join(", ") })
        : F("STARWROUGHT.Milestone.previewDeferred", { name, n: reached + 1, of });
      rows.push({ uuid, name, line, levelUp: false });
      continue;
    }
    const level = (Number(sys.level) || 1) + 1;
    // The rise the model will derive, read as a difference so any drift from its formula cancels.
    const rise = Math.max(0, vigorMaxAt(actor, level) - vigorMaxAt(actor, level - 1));
    const from = Number(sys.vigor?.value) || 0;
    let line = F("STARWROUGHT.Milestone.previewLevel", { name, level, from, to: from + rise });
    const opens = rankOpeningAt(level);
    if (opens) line += F("STARWROUGHT.Milestone.previewRank", { rank: L(opens.label) });
    rows.push({ uuid, name, line, levelUp: true });
  }
  return rows;
}

/**
 * Award a Milestone to the chosen members (ruling 91). Each: `milestone + 1`, and `deferred + 1`
 * when no Constellation is Flared to receive the point (ruling 94; PHB Table 4: a Milestone
 * Talent Point with no Flared Constellation becomes a Deferred Talent Point, spent the instant a
 * Constellation is Flared); or, for a member already at the third, `level + 1` and `milestone 0`,
 * then the recomputed maximum is read and current Vigor rises by the same amount (ruling 92; two
 * writes, since the maximum is the model's to derive). The before-state of every member written
 * goes to the party's `lastAward` for Take back, and one public card spoken by the party carries
 * a line per member, with the next rank named at 5th, 10th and 15th.
 * @param {Actor} party
 * @param {string[]} uuids  The ticked members.
 * @returns {Promise<object|null>}  The record written to `lastAward`, or null when nothing was.
 */
export async function awardMilestone(party, uuids) {
  if (!game.user.isGM) return null;
  const chosen = new Set(Array.isArray(uuids) ? uuids : []);
  const of = SW.MILESTONES_PER_LEVEL;
  const record = { at: Date.now(), session: Number(party.system.session?.number) || 0, members: [] };
  const lines = [];

  for (const { uuid, actor } of resolveMembers(party)) {
    if (!actor || !chosen.has(uuid)) continue;
    const sys = actor.system;
    const before = snapshot(actor);
    const name = escapeHTML(actor.name);
    const reached = Math.clamp(before.milestone, 0, of);
    let rise = 0;

    if (reached < of) {
      const next = reached + 1;
      const flared = flaredNames(actor);
      const updates = { "system.milestone": next };
      if (!flared.length) updates["system.deferred"] = before.deferred + 1;
      await actor.update(updates, { swAnnounced: true });
      lines.push(flared.length
        ? F("STARWROUGHT.Milestone.cardPoint", { name, n: next, of, flared: escapeHTML(flared.join(", ")) })
        : F("STARWROUGHT.Milestone.cardDeferred", { name, n: next, of, held: Number(actor.system.deferred) || 0 }));
    } else {
      const level = before.level + 1;
      const maxBefore = Number(sys.vigor?.max) || 0;
      await actor.update({ "system.level": level, "system.milestone": 0 }, { swAnnounced: true });
      // The model has derived the new maximum by now; the rise is what current Vigor gains.
      const maxAfter = Number(actor.system.vigor?.max) || maxBefore;
      rise = Math.max(0, maxAfter - maxBefore);
      const to = Math.min(maxAfter, before.vigor + rise);
      if (to !== (Number(actor.system.vigor?.value) || 0)) {
        await actor.update({ "system.vigor.value": to }, { swAnnounced: true });
      }
      let line = F("STARWROUGHT.Milestone.cardLevel", { name, level, from: before.vigor, to });
      const opens = rankOpeningAt(level);
      if (opens) line += ` ${F("STARWROUGHT.Milestone.cardRankOpens", { rank: L(opens.label), level })}`;
      lines.push(line);
    }
    record.members.push({ uuid, name: actor.name, before, after: snapshot(actor), rise });
  }

  if (!record.members.length) return null;
  await party.update({ "system.lastAward": record });
  await postPartyCard(party, {
    root: "sw-milestone-card",
    icon: "fa-solid fa-star",
    title: L("STARWROUGHT.Milestone.cardTitle"),
    lines
  });
  return record;
}

/**
 * Take back the last award: exactly those numbers on exactly those members. Refused, with a
 * notice and no write, if any member's level, Milestone or Deferred count has since been edited
 * by hand (it no longer reads what the award left), or a member cannot be found. A level's Vigor
 * rise comes off current Vigor (never below 0) rather than restoring the old value, since Vigor
 * moves in play between an award and its reversal. Posts a card and clears `lastAward`. There is
 * no other undo: a Talent spent is the player's to move, as today.
 * @param {Actor} party
 * @returns {Promise<boolean>}
 */
export async function takeBackAward(party) {
  if (!game.user.isGM) return false;
  const record = party.system.lastAward;
  if (!record?.members?.length) {
    ui.notifications.warn(L("STARWROUGHT.Milestone.takeBackNone"));
    return false;
  }

  const rows = [];
  for (const entry of record.members) {
    const actor = actorFor(entry.uuid);
    if (!actor) {
      ui.notifications.warn(F("STARWROUGHT.Milestone.takeBackMissing", { name: entry.name ?? entry.uuid }));
      return false;
    }
    const now = snapshot(actor);
    for (const [field, label] of [["level", "STARWROUGHT.Field.level"], ["milestone", "STARWROUGHT.Field.milestone"], ["deferred", "STARWROUGHT.Party.deferred"]]) {
      if (now[field] === (Number(entry.after?.[field]) || 0)) continue;
      ui.notifications.warn(F("STARWROUGHT.Milestone.takeBackRefused", {
        name: actor.name, field: L(label), was: Number(entry.after?.[field]) || 0, now: now[field]
      }));
      return false;
    }
    rows.push({ actor, entry, now });
  }

  const of = SW.MILESTONES_PER_LEVEL;
  const lines = [];
  for (const { actor, entry, now } of rows) {
    const before = entry.before ?? {};
    const updates = {
      "system.level": Number(before.level) || 1,
      "system.milestone": Number(before.milestone) || 0,
      "system.deferred": Number(before.deferred) || 0
    };
    const rise = Number(entry.rise) || 0;
    if (rise) updates["system.vigor.value"] = Math.max(0, now.vigor - rise);
    await actor.update(updates, { swAnnounced: true });
    lines.push(F("STARWROUGHT.Milestone.takenBackLine", {
      name: escapeHTML(actor.name), level: updates["system.level"], n: updates["system.milestone"], of
    }));
  }
  await party.update({ "system.lastAward": null });
  await postPartyCard(party, {
    root: "sw-milestone-card sw-milestone-taken-back",
    icon: "fa-solid fa-rotate-left",
    title: L("STARWROUGHT.Milestone.takeBackTitle"),
    lines: [L("STARWROUGHT.Milestone.takenBack"), ...lines]
  });
  return true;
}

/* -------------------------------------------- */
/*  Deferred Talent Points (part 3)             */
/* -------------------------------------------- */

/**
 * Spend one Deferred Talent Point (ruling 94): `deferred - 1`, never below 0, and a one-line card
 * spoken by the character. For the character's owner or the GM. Spending is what it is today, a
 * Talent dragged or bought, unpoliced: this is the count coming down, not the spend itself. The
 * character's own `spendDeferred` (documents/actor.mjs, 0.7.0) does the write and says the card,
 * so the header's badge and the party's roster say it once from either; the write below is the
 * fallback for a build without it.
 * @param {Actor} actor
 * @returns {Promise<number|null>}  The points still held, or null when there was nothing to spend.
 */
export async function spendDeferred(actor) {
  if (!actor?.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  if (typeof actor.spendDeferred === "function") return actor.spendDeferred();
  const have = Number(actor.system.deferred) || 0;
  if (have <= 0) {
    ui.notifications.warn(F("STARWROUGHT.Party.deferredNone", { name: actor.name }));
    return null;
  }
  const left = have - 1;
  await actor.update({ "system.deferred": left }, { swAnnounced: true });
  await postMemberCard(actor, {
    root: "sw-deferred-card",
    icon: "fa-solid fa-hourglass-half",
    title: L("STARWROUGHT.Party.deferredTitle"),
    lines: [F("STARWROUGHT.Party.deferredSpent", { name: escapeHTML(actor.name), left })]
  });
  return left;
}
