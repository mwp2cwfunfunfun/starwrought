/**
 * The party's operations (0.7.0; party-sheet-plan.md, parts 1 to 3; 0.7.1 adds parts 6 and 7).
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
 * Milestone award, Take back, the party's night, the Split and Ask everyone; the member speaks for
 * a Hero Point award or correction, a Deferred point spent and a Give to. Dialogs belong to the
 * sheet; these functions refuse, write and say.
 *
 * Rulings (Mike, 2026-10-02, numbered on from the v4.14 report): 91 a Milestone award goes to
 * every member by default, with a checkbox per member to withhold it; 92 when the fourth Milestone
 * raises a level, current Vigor rises by the same amount as the maximum; 93 Begin session sets
 * every member's Hero Points to exactly 1; 94 Deferred Talent Points are counted on the character
 * and nothing is enforced; 95 players see every member's Thresholds on the Skills grid.
 *
 * Phase 2 (0.7.1): 96 the loot and the purse are a convenience with no rule authority (they move
 * Items and coin and value nothing; a row prints its price, nothing computes with it); 99 Split
 * divides the purse in copper equally among the ticked members and the remainder stays in the
 * purse; 100 Ask everyone posts one card spoken by the party with a Roll button per member that
 * only the member's owner (or the GM) can press, the Threshold optional and hidden from players
 * unless the GM shows it. The GM's own moves live here (Give to, Split); a player's Take or Give
 * runs on the active GM's client through documents/party-socket.mjs (rulings 97 and 98).
 *
 * Phase 3 (0.7.2; plan, parts 8 and 9): the road. 101 a Fatigued character Travels and does
 * nothing else (the Activity locks to Travel with the reason; the stored pick waits); 102 the
 * party's Travel Speed is the slowest member's after their Activity, times the terrain, display
 * only; 105 Begin the encounter writes Initiative by Activity onto the Combatants (the
 * Constellation, the Scout's +1 Situation for every other member, a Defender's shield Raised with
 * no action spent) and rolls nothing; 106 the pick is the character's, written by its owner or the
 * GM directly and said once by the member; 107 an Activity's own roll goes through the member's
 * check with no Threshold. What an Activity rolls now and for Initiative, its Travel word and its
 * effect are read from the action Item's `system.exploration`, which the pipeline writes from the
 * roster's two positional columns (ruling 104): nothing here is a table of Activity names.
 *
 * Phase 3b (0.7.3; Mike, with a screenshot of the tab: "the result of the rolls should be
 * displayed ... when the GM Begins the Encounter, they should be able to check a box or something
 * to use that roll"): 108 the Activity's roll is remembered on the character
 * (`system.exploration.roll`, written from the `starwrought.check` hook on the roller's client
 * when the check is in the Constellation the Activity rolls now, cleared when the pick changes,
 * shown as a chip and printed by Say the plan, computed with by nothing but the next ruling); 109
 * Begin the encounter can keep a remembered roll as the Initiative roll, one checkbox per member
 * whose roll is in the Constellation their Activity rolls for Initiative, the Initiative set to the
 * roll's total plus the Initiative-only terms the check engine finds between its two assemblies;
 * 110 the remembered roll is the character's and public, the roll's own card the record of the die.
 */

import * as SW from "../config.mjs";
import { cardHtml, postCard } from "../documents/combat.mjs";
import { COIN_IN_COPPER } from "../data/party.mjs";
// The kept roll's Initiative-only terms (ruling 109) are the difference between two of the engine's
// own assemblies, so the party never does the Initiative arithmetic itself.
import { SwCheck } from "../dice/check.mjs";

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

/* -------------------------------------------- */
/*  Coin (part 6, 0.7.1)                        */
/* -------------------------------------------- */

/** A purse or a character's coin as copper, through the ladder in data/party.mjs. */
export function toCopper(currency) {
  return Object.entries(COIN_IN_COPPER)
    .reduce((sum, [coin, worth]) => sum + (Math.max(0, Math.floor(Number(currency?.[coin]) || 0)) * worth), 0);
}

/** Copper broken into gp, sp and cp, the larger coin first, so 3025 is 30 gp 2 sp 5 cp. */
export function fromCopper(copper) {
  let left = Math.max(0, Math.floor(Number(copper) || 0));
  const coins = {};
  for (const [coin, worth] of Object.entries(COIN_IN_COPPER)) {
    coins[coin] = Math.floor(left / worth);
    left -= coins[coin] * worth;
  }
  return coins;
}

/** Copper as a card prints it: "30 gp 2 sp 5 cp", the empty coins left out, "0 cp" for nothing. */
export function coinText(copper) {
  const parts = Object.entries(fromCopper(copper)).filter(([, n]) => n > 0).map(([coin, n]) => `${n} ${coin}`);
  return parts.length ? parts.join(" ") : "0 cp";
}

/* -------------------------------------------- */
/*  The loot (part 6, 0.7.1)                    */
/* -------------------------------------------- */

/** Is this Item one a party can hold: a weapon, a piece of armor, a shield or gear (SW.PHYSICAL_TYPES)? */
export function isLoot(item) {
  return !!item && (item.documentName === "Item") && SW.PHYSICAL_TYPES.includes(item.type);
}

/**
 * May this stack move from the party to that member? The GM's own check before a Give to; the
 * relay (documents/party-socket.mjs) makes the same checks again on the GM's client for a Take,
 * trusting its payload for nothing but ids and the count.
 * @param {Actor} party
 * @param {Item} item        An Item embedded on the party.
 * @param {Actor} actor      The destination character.
 * @param {number} quantity  How many of the stack.
 * @returns {{count: number, stock: number, refusal: string|null}}  The count and the stock, or the i18n key saying why not.
 */
export function lootMoveCheck(party, item, actor, quantity) {
  const stock = Number(item?.system?.quantity) || 0;
  const count = Math.floor(Number(quantity) || 0);
  if (!item || (item.parent !== party)) return { count, stock, refusal: "STARWROUGHT.Loot.giveToGone" };
  if (!isLoot(item)) return { count, stock, refusal: "STARWROUGHT.Loot.giveToNotPhysical" };
  const member = !!actor && (party.system.members ?? []).some(m => m.uuid === actor.uuid);
  if (!member || (actor.type !== "character")) return { count, stock, refusal: "STARWROUGHT.Loot.giveToNoMember" };
  if ((count < 1) || (count > stock)) return { count, stock, refusal: "STARWROUGHT.Loot.giveToNotEnough" };
  return { count, stock, refusal: null };
}

/**
 * Move part or all of a stack from one Actor to another. A copy of the Item's source data lands on
 * the destination FIRST, with `system.quantity` the moved count and `system.state` "carried" when
 * the destination is a character (carry state means nothing on a party, and a thing taken from
 * the loot is in the pack until an Interact draws it), and the source is decremented or deleted
 * SECOND, so a failure between the two leaves a duplicate and never a loss (plan, part 6). Both
 * writes are announced, so the audit says nothing. No merging: arrows taken from the party are a
 * second stack beside the character's own, as a drop from the compendium would be.
 * @param {Item} item
 * @param {Actor} destination
 * @param {number} count
 * @returns {Promise<{created: Item|null, left: number}>}  The new Item, and how many stayed behind.
 */
export async function moveStack(item, destination, count) {
  const stock = Number(item.system.quantity) || 0;
  const moved = Math.clamp(Math.floor(Number(count) || 0), 1, Math.max(1, stock));
  const data = item.toObject();
  delete data._id;
  delete data.folder;
  delete data.sort;
  data.system ??= {};
  data.system.quantity = moved;
  if (destination.type !== SW.PARTY_TYPE) data.system.state = "carried";
  const [created] = await destination.createEmbeddedDocuments("Item", [data], { swAnnounced: true });
  const left = Math.max(0, stock - moved);
  if (left > 0) await item.update({ "system.quantity": left }, { swAnnounced: true });
  else await item.delete({ swAnnounced: true });
  return { created: created ?? null, left };
}

/**
 * The GM's direct Give to (plan, part 6): the stack, or part of it, lands on the member as carried
 * and leaves the party, and the member speaks: "Toric is given a Dagger." This is the one move
 * that needs no relay, since the GM writes both documents; a player's Take or Give goes through
 * documents/party-socket.mjs (ruling 97). Refused, with a notice and no write, when the Item is
 * gone from the party, is not physical, the character is not a member, or the count is not in
 * stock.
 * @param {Actor} party
 * @param {Item} item
 * @param {Actor} actor
 * @param {number|null} [quantity]  How many; the whole stack when null.
 * @returns {Promise<Item|null>}  The Item created on the member, or null when refused.
 */
export async function giveTo(party, item, actor, quantity = null) {
  if (!game.user.isGM) return null;
  const asked = (quantity === null || quantity === undefined) ? (Number(item?.system?.quantity) || 0) : quantity;
  const { count, stock, refusal } = lootMoveCheck(party, item, actor, asked);
  if (refusal) {
    ui.notifications.warn(F(refusal, { name: actor?.name ?? "", item: item?.name ?? "", count, stock }));
    return null;
  }
  const { created, left } = await moveStack(item, actor, count);
  const name = escapeHTML(actor.name);
  const itemName = escapeHTML(item.name);
  let line = (count === 1)
    ? F("STARWROUGHT.Loot.givenOne", { name, item: itemName })
    : F("STARWROUGHT.Loot.givenMany", { name, item: itemName, count });
  if (left > 0) line += ` ${F("STARWROUGHT.Loot.left", { left })}`;
  await postMemberCard(actor, {
    root: "sw-loot-card",
    icon: "fa-solid fa-hand-holding",
    title: L("STARWROUGHT.Loot.cardTitle"),
    lines: [line]
  });
  return created;
}

/* -------------------------------------------- */
/*  The purse (part 6, 0.7.1)                   */
/* -------------------------------------------- */

/**
 * What a Split would do, for the dialog: the purse in copper, each ticked member's share and the
 * remainder, before anything is written.
 * @param {Actor} party
 * @param {number} count  How many members are ticked.
 * @returns {{total: number, share: number, remainder: number}}
 */
export function previewSplit(party, count) {
  const total = toCopper(party.system.currency);
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!n) return { total, share: 0, remainder: total };
  return { total, share: Math.floor(total / n), remainder: total % n };
}

/**
 * Split the purse among the ticked members (ruling 99): the coin to copper, an equal share to each
 * in one `Actor.updateDocuments` batch (announced, so no Adjusted card doubles it), the remainder
 * written back to the purse, and one card spoken by the party listing every share and what
 * stayed. A share is added to what the member already holds, coin by coin, so a member's own gp,
 * sp and cp are never re-counted into other denominations. Refused, with a notice and no write,
 * when nobody is ticked, the purse is empty, or it holds less than one copper a head.
 * @param {Actor} party
 * @param {string[]} uuids  The ticked members.
 * @returns {Promise<{total: number, share: number, remainder: number, members: string[]}|null>}
 */
export async function splitPurse(party, uuids) {
  if (!game.user.isGM) return null;
  const chosen = new Set(Array.isArray(uuids) ? uuids : []);
  const members = resolveMembers(party).filter(m => m.actor && chosen.has(m.uuid)).map(m => m.actor);
  if (!members.length) {
    ui.notifications.warn(L("STARWROUGHT.Loot.splitNoMembers"));
    return null;
  }
  const { total, share, remainder } = previewSplit(party, members.length);
  if (total <= 0) {
    ui.notifications.warn(L("STARWROUGHT.Loot.splitEmpty"));
    return null;
  }
  if (share <= 0) {
    ui.notifications.warn(F("STARWROUGHT.Loot.splitTooSmall", { total: coinText(total), n: members.length }));
    return null;
  }

  const shareCoins = fromCopper(share);
  const updates = members.map(actor => {
    const have = actor.system.currency ?? {};
    const update = { _id: actor.id };
    for (const coin of Object.keys(COIN_IN_COPPER)) {
      update[`system.currency.${coin}`] = Math.max(0, Math.floor(Number(have[coin]) || 0)) + shareCoins[coin];
    }
    return update;
  });
  await Actor.implementation.updateDocuments(updates, { swAnnounced: true });
  await party.update({ "system.currency": fromCopper(remainder) });

  const lines = [escapeHTML(F("STARWROUGHT.Loot.splitLine", { total: coinText(total), n: members.length, share: coinText(share) }))];
  for (const actor of members) {
    lines.push(escapeHTML(F("STARWROUGHT.Loot.splitShare", {
      name: actor.name, share: coinText(share), now: coinText(toCopper(actor.system.currency))
    })));
  }
  lines.push(escapeHTML(remainder
    ? F("STARWROUGHT.Loot.splitRemainder", { remainder: coinText(remainder) })
    : L("STARWROUGHT.Loot.splitNoRemainder")));
  await postPartyCard(party, {
    root: "sw-purse-card",
    icon: "fa-solid fa-coins",
    title: L("STARWROUGHT.Loot.splitTitle"),
    lines
  });
  return { total, share, remainder, members: members.map(a => a.uuid) };
}

/* -------------------------------------------- */
/*  Ask everyone (part 7, 0.7.1)                */
/* -------------------------------------------- */

/** The `data-sw-action` the card's buttons carry and the flag kind on the message, for documents/chat.mjs. */
export const ASK_CARD_KIND = "partyAsk";

/**
 * What the card calls the thing asked for: a Defense's label, or the Constellation's name as a
 * member's own data spells it (falling back to the content index, then the slug).
 * @param {Actor} party
 * @param {string} slug
 * @param {object} [options]
 * @param {"check"|"defense"} [options.kind]
 * @param {string} [options.key]  The Defense key.
 * @returns {string}
 */
export function askedName(party, slug, { kind = "check", key = "" } = {}) {
  if (kind === "defense") return L(SW.DEFENSES[key]?.label ?? SW.DEFENSES.awareness.label);
  for (const actor of memberActors(party)) {
    const name = actor.system.constellations?.[slug]?.name;
    if (name) return name;
  }
  return SW.getConstellation(slug)?.name ?? slug;
}

/**
 * Ask everyone (ruling 100): one public card spoken by the party, "Everyone roll Awareness.", with
 * a row per member and a Roll button on each. A button carries the member's uuid as
 * `data-owner-uuid`, which the render pass in documents/chat.mjs removes for every viewer who does
 * not own the member (the GM owns everything), and `data-sw-action="partyAsk"`, which the
 * dispatcher there hands to `rollAskedCheck`. The Threshold goes onto the buttons and into the
 * flags only when the GM chose to show it. A Threshold the GM kept hidden is written nowhere:
 * Foundry has no store a player's client cannot read (a whispered message, a flag and a world
 * setting all reach every client and differ only in what is displayed), so the card says the GM
 * holds it and reads the totals, which the plan calls the normal case anyway (Search and
 * Investigate have the GM apply the roll to the Thresholds).
 * @param {Actor} party
 * @param {string} slug  The Constellation's slug (a Defense's own slug for a Defense).
 * @param {object} [options]
 * @param {"check"|"defense"} [options.kind]  Which method the member rolls with.
 * @param {string} [options.key]  The Defense key, for a Defense.
 * @param {number|null} [options.threshold]  The number to beat, if the GM has one.
 * @param {boolean} [options.show]  Whether players see the Threshold.
 * @returns {Promise<ChatMessage|null>}
 */
export async function askEveryone(party, slug, { kind = "check", key = "", threshold = null, show = false } = {}) {
  if (!game.user.isGM) return null;
  const actors = memberActors(party);
  if (!actors.length) {
    ui.notifications.warn(L("STARWROUGHT.Party.askNoMembers"));
    return null;
  }
  const isDefense = kind === "defense";
  if (isDefense && !SW.DEFENSES[key]) return null;
  if (!isDefense && !slug) return null;
  const name = askedName(party, slug, { kind, key });
  const has = Number.isNumeric(threshold);
  const shown = (show && has) ? Number(threshold) : null;

  const note = (shown !== null) ? F("STARWROUGHT.Party.askThresholdShown", { threshold: shown })
    : has ? L("STARWROUGHT.Party.askThresholdHeld")
    : L("STARWROUGHT.Party.askNoThreshold");
  const rows = actors.map(actor => {
    const attrs = [
      `data-sw-action="${ASK_CARD_KIND}"`,
      `data-owner-uuid="${escapeHTML(actor.uuid)}"`,
      `data-slug="${escapeHTML(slug)}"`,
      `data-kind="${isDefense ? "defense" : "check"}"`,
      `data-key="${escapeHTML(isDefense ? key : "")}"`
    ];
    if (shown !== null) attrs.push(`data-threshold="${shown}"`);
    return `<li class="sw-ask-row">
      <img class="sw-ask-portrait" src="${escapeHTML(actor.img)}" alt="">
      <span class="sw-ask-name">${escapeHTML(actor.name)}</span>
      <button type="button" ${attrs.join(" ")}><i class="fa-solid fa-dice-d20"></i> ${escapeHTML(L("STARWROUGHT.Roll.roll"))}</button>
    </li>`;
  });
  const content = `<div class="starwrought action-card sw-party-card sw-ask-card" data-actor-uuid="${escapeHTML(party.uuid)}">
    <h3><i class="fa-solid fa-bullhorn"></i> ${escapeHTML(F("STARWROUGHT.Party.askTitle", { name }))}</h3>
    <p>${escapeHTML(F("STARWROUGHT.Party.askLine", { name }))}</p>
    <p class="sw-card-note">${escapeHTML(note)}</p>
    <ul class="sw-ask-rows">${rows.join("")}</ul></div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: party }),
    content,
    flags: {
      [SW.SYSTEM_ID]: {
        kind: ASK_CARD_KIND,
        partyUuid: party.uuid,
        slug,
        checkKind: isDefense ? "defense" : "check",
        key: isDefense ? key : "",
        name,
        threshold: shown,
        members: actors.map(a => a.uuid)
      }
    }
  });
}

/**
 * The Roll button on an Ask everyone card (ruling 100), reached through the dispatcher in
 * documents/chat.mjs. The member is read from the button's `data-owner-uuid`; the press is the
 * member's owner's or the GM's and nobody else's (the render pass has already hidden it from the
 * rest; this is the check behind the hiding); the roll is the member's own `rollCheck` for a Skill
 * or a Lore and `rollDefense` for a Defense, so the card speaks as the member and can Flare. The
 * Threshold is passed only when the button carries one. A Defense asked this way is a plain check
 * against a Threshold (Awareness against a Stealth Threshold, Endure against a poison's), never an
 * answer to an Attack: `kind: "check"` keeps the degrees the right way up, since the engine reads
 * a Defense roll from the attacker's side.
 * @param {ChatMessage} message
 * @param {object} flags  The system's flags on the message.
 * @param {HTMLButtonElement} button
 * @returns {Promise<object|null>}  The resolved check, or null.
 */
export async function rollAskedCheck(message, flags, button) {
  let actor = null;
  try { actor = fromUuidSync(button?.dataset.ownerUuid ?? ""); } catch { actor = null; }
  if (actor?.documentName === "Token") actor = actor.actor ?? null;
  if (!actor || (actor.documentName !== "Actor")) {
    ui.notifications.warn(L("STARWROUGHT.Notify.noActor"));
    return null;
  }
  if (!actor.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const options = {};
  const threshold = button.dataset.threshold;
  if (Number.isNumeric(threshold)) options.threshold = Number(threshold);
  if (button.dataset.kind === "defense") {
    const key = SW.DEFENSES[button.dataset.key] ? button.dataset.key : null;
    if (!key) return null;
    return actor.rollDefense(key, { ...options, kind: "check", thresholdLabel: L("STARWROUGHT.Field.threshold") });
  }
  const slug = button.dataset.slug || flags?.slug;
  if (!slug) return null;
  return actor.rollCheck(slug, options);
}

/* -------------------------------------------- */
/*  The road (parts 8 and 9, 0.7.2)             */
/* -------------------------------------------- */

/**
 * The compendium category of an Exploration Mode Activity, as `build_foundry.mjs` writes it on the
 * action Item (the folder of the same name in the Actions pack is the book's Table 95) and as the
 * action data model derives `isExploration` from it since 0.7.2. Read here only for an Item the
 * model has not flagged.
 */
const EXPLORATION_CATEGORY = "Exploration Mode";

/**
 * The Activities the sheet knows by name, as `SW.slugify` spells them, because the book writes
 * what they do in prose rather than in a column (ruling 104): Look Harmless's Requirements (a held
 * weapon with Reach, worn Load above 1) are a warning drawn from live data and never a refusal
 * (ruling 107); Search is what holds a location to ten minutes (P346) and the party to Half;
 * Investigate is the one whose chat line reads "Investigates with"; Travel is the default row, the
 * one "" stands for on the character. Everything else an Activity does (its Travel word, what it
 * rolls now and for Initiative, the Scout's and the Defender's effect) is read from
 * `system.exploration` on the Item, so a row Mike adds needs no code here unless it does
 * something new.
 */
const LOOK_HARMLESS = "look-harmless";
const SEARCH = "search";
const INVESTIGATE = "investigate";
const TRAVEL = "travel";

/**
 * The two flags on a Combatant (`flags.starwrought.*`) that Begin the encounter writes and every
 * Initiative roll in the system reads (ruling 105): the Constellation to roll, and the typed
 * modifiers to add (one Scout entry per other Scout, all +1 Situation, of which one applies).
 */
const FLAG_INITIATIVE_CONSTELLATION = "initiativeConstellation";
const FLAG_INITIATIVE_MODIFIERS = "initiativeModifiers";

/** The pipeline's `effect` tags (SW.EXPLORATION_EFFECTS), named once. */
const EFFECT_SCOUT = "scout";
const EFFECT_DEFEND = "defend";

let explorationCache = null;

/** Is this action Item an Exploration Mode Activity? The model's flag when it carries one, the category otherwise. */
function isExplorationAction(item) {
  if (!item || (item.type !== "action")) return false;
  return item.system.isExploration ?? (item.system.category === EXPLORATION_CATEGORY);
}

/**
 * The Exploration Mode Activities (Table 95): the Actions pack's "Exploration Mode" folder, in
 * folder order, then the Items' own sort, then by name, cached once per session as
 * `loadBasicActions` caches the Basic Actions (helpers/content.mjs). A world action Item of the
 * same name in the same category replaces the printed one and keeps its place, so a GM's rewrite
 * wins, and a world-only addition goes after the book. These are unowned Items: nothing is copied
 * to a character, the pick is an id on the character (ruling 106).
 * @returns {Promise<Item[]>}
 */
export async function explorationActivities() {
  if (explorationCache) return explorationCache;
  const pack = game.packs.get(`${SW.SYSTEM_ID}.actions`);
  const printed = pack ? (await pack.getDocuments()).filter(isExplorationAction) : [];
  const key = item => item.name.trim().toLowerCase();
  const place = new Map(printed.map(i => [key(i), Number(i.folder?.sort) || 0]));
  const byName = new Map(printed.map(i => [key(i), i]));
  for (const item of game.items ?? []) {
    if (isExplorationAction(item)) byName.set(key(item), item);
  }
  const order = item => place.get(key(item)) ?? 1000;
  explorationCache = [...byName.values()].sort((a, b) =>
    (order(a) - order(b))
    || ((Number(a.sort) || 0) - (Number(b.sort) || 0))
    || a.name.localeCompare(b.name));
  return explorationCache;
}

/** Forget the cached Activities, so the next render reads the world again (a world action Item changed). */
export function invalidateExplorationActivities() {
  explorationCache = null;
}

/**
 * The `system.exploration` block of an Activity, with the model's own defaults for an Item that
 * lacks one (a world Item written by hand): Full, nothing rolled now, Awareness for Initiative,
 * no effect. A named check-now Constellation is also read from `system.check`, which the pipeline
 * writes beside it, so an Item carrying only that still rolls.
 * @param {Item|null} item
 * @returns {{travel: string, check: string, initiative: string, effect: string}}
 */
export function explorationOf(item) {
  const ex = item?.system?.exploration ?? {};
  const check = item?.system?.check;
  return {
    travel: ex.travel || "full",
    check: ex.check || ((check?.enabled && check?.constellation) ? String(check.constellation) : ""),
    initiative: ex.initiative || "",
    effect: ex.effect || ""
  };
}

/** The Activity's Travel word (Full, Half, Double), localized. */
export function travelWord(item) {
  return L(SW.ACTIVITY_SPEEDS?.[explorationOf(item).travel]?.label ?? "STARWROUGHT.Travel.full");
}

/** The Activity's Speed multiplier (Full 1, Half one half, Double 2). */
export function travelMultiplier(item) {
  return Number(SW.ACTIVITY_SPEEDS?.[explorationOf(item).travel]?.multiplier) || 1;
}

/** An Activity's name as a slug, for the four the book writes in prose. */
function activitySlug(item) {
  return item ? SW.slugify(item.name) : "";
}

/** Does this Activity leave a Constellation to the member's own pick, now or for Initiative? */
export function activityHasChoice(item) {
  const ex = explorationOf(item);
  return (ex.check === SW.ACTIVITY_CHOICE) || (ex.initiative === SW.ACTIVITY_CHOICE);
}

/**
 * The default Activity, the one "" stands for on the character: the row named Travel; failing
 * that, a Full row that rolls nothing and does nothing; failing that, the first row. Null with no
 * Activities at all (an unbuilt pack).
 * @param {Item[]} activities
 * @returns {Item|null}
 */
export function travelActivity(activities) {
  const list = Array.isArray(activities) ? activities : [];
  if (!list.length) return null;
  return list.find(a => activitySlug(a) === TRAVEL)
    ?? list.find(a => {
      const ex = explorationOf(a);
      return (ex.travel === "full") && !ex.check && !ex.effect;
    })
    ?? list[0];
}

/**
 * The member's Activity, resolved from `system.exploration.activity` (ruling 106): "" or an id
 * the list does not know is Travel. While the member is Fatigued the Activity IS Travel and the
 * row is locked with the reason (ruling 101): the book's Fatigued row says "can't use Exploration
 * Mode Activities", and read literally the party cannot move once a fighter in plate is winded,
 * so Travel stays open and nothing else does. The stored pick is left as it was and comes back
 * when the Fatigue ends (ten minutes' rest, ruling 81); `stored` says what is waiting.
 * @param {Actor} actor
 * @param {Item[]} activities
 * @returns {{item: Item|null, stored: Item|null, locked: boolean, lockedReason: string, fatigued: number}}
 */
export function activityOf(actor, activities) {
  const list = Array.isArray(activities) ? activities : [];
  const travel = travelActivity(list);
  const id = String(actor?.system?.exploration?.activity ?? "").trim();
  let stored = id ? (list.find(a => a.id === id) ?? null) : null;
  if (id && !stored) {
    // A compendium id stored before the GM wrote a world Item of the same name: the pack's index
    // still knows the name, and the name finds the replacement.
    const name = game.packs.get(`${SW.SYSTEM_ID}.actions`)?.index.get(id)?.name;
    if (name) stored = list.find(a => a.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  }
  stored ??= travel;
  const fatigued = Number(actor?.conditionValue?.("fatigued")) || 0;
  if (fatigued > 0) {
    let reason = F("STARWROUGHT.Travel.fatiguedLock", { name: actor.name, n: fatigued });
    if (stored && travel && (stored !== travel)) reason += ` ${F("STARWROUGHT.Travel.fatiguedLockStored", { activity: stored.name })}`;
    return { item: travel, stored, locked: true, lockedReason: reason, fatigued };
  }
  return { item: stored, stored, locked: false, lockedReason: "", fatigued: 0 };
}

/**
 * A Constellation's name as the member's own data spells it, a Defense's label for one of the
 * four, the content index's name otherwise, and the slug when nothing knows it.
 * @param {Actor|null} actor
 * @param {string} slug
 * @returns {string}
 */
export function constellationName(actor, slug) {
  if (!slug) return "";
  const own = actor?.system?.constellations?.[slug]?.name;
  if (own) return own;
  const def = Object.values(SW.DEFENSES).find(d => d.slug === slug);
  if (def) return L(def.label);
  return SW.getConstellation(slug)?.name ?? slug;
}

/**
 * What the member rolls for Initiative under this Activity (PHB P323: Awareness, or another
 * Constellation by Activity): the Item's `exploration.initiative` ("" is Awareness; `choice` is
 * the member's own pick, Awareness until one is made, with `fallback` saying so).
 * @param {Actor} actor
 * @param {Item|null} item
 * @returns {{slug: string, name: string, choice: boolean, fallback: boolean}}
 */
export function initiativeFor(actor, item) {
  const awareness = SW.DEFENSES.awareness.slug;
  const named = explorationOf(item).initiative;
  if (!named) return { slug: awareness, name: constellationName(actor, awareness), choice: false, fallback: false };
  if (named === SW.ACTIVITY_CHOICE) {
    const pick = memberPick(actor);
    const slug = pick || awareness;
    return { slug, name: constellationName(actor, slug), choice: true, fallback: !pick };
  }
  return { slug: named, name: constellationName(actor, named), choice: false, fallback: false };
}

/**
 * Is this slug a Constellation anyone can name: one the character has opened, one the registry
 * knows (every shipping Constellation, enabled or not, and the four Defenses, so an Untrained pick
 * at +0 is a real answer), or a Lore the character holds? Anything else is a stale pick (a Lore
 * deleted since it was chosen, a renamed Constellation), and `SW.getConstellation` would otherwise
 * synthesize a name and Might for it and roll it without a word (review, 0.7.2).
 * @param {Actor} actor
 * @param {string} slug
 * @returns {boolean}
 */
export function knownConstellation(actor, slug) {
  if (!slug) return false;
  if (actor?.system?.constellations?.[slug]) return true;
  if (SW.constellations[slug]) return true;
  return Object.values(SW.DEFENSES).some(d => d.slug === slug);
}

/** The member's own pick (Investigate's Lore or Skill), or "" when none is made or it is stale. */
export function memberPick(actor) {
  const pick = String(actor?.system?.exploration?.constellation ?? "").trim();
  return knownConstellation(actor, pick) ? pick : "";
}

/**
 * What the member rolls NOW under this Activity, if anything (ruling 107): the Item's
 * `exploration.check`. A Defense's slug rolls as the Defense check (Search's Awareness, as Ask
 * everyone rolls a Defense: a plain check against a Threshold the GM holds, never an answer to an
 * Attack), any other slug as a check, and `choice` opens the Relevant Check picker on the member's
 * pick. Null when the Activity rolls nothing now.
 * @param {Actor} actor
 * @param {Item|null} item
 * @returns {{kind: "check"|"defense"|"choice", slug: string, key: string, name: string}|null}
 */
export function activityRoll(actor, item) {
  const check = explorationOf(item).check;
  if (!check) return null;
  if (check === SW.ACTIVITY_CHOICE) {
    const pick = activityCheckSlug(actor, item);
    return { kind: "choice", slug: pick, key: "", name: pick ? constellationName(actor, pick) : L("STARWROUGHT.Roll.relevantCheck") };
  }
  const key = Object.keys(SW.DEFENSES).find(k => SW.DEFENSES[k].slug === check) ?? "";
  return { kind: key ? "defense" : "check", slug: check, key, name: constellationName(actor, check) };
}

/**
 * The Constellation the Activity rolls NOW for this member, resolved to a slug (ruling 108): the
 * Item's check-now Constellation, the member's own pick for `choice` (Investigate; "" while none
 * is made or the pick is stale), or "" when the Activity rolls nothing now. The Roll button and the
 * remembered roll both read it, so what the button rolls is what the record counts.
 * @param {Actor} actor
 * @param {Item|null} item
 * @returns {string}
 */
export function activityCheckSlug(actor, item) {
  const check = explorationOf(item).check;
  if (!check) return "";
  if (check === SW.ACTIVITY_CHOICE) return memberPick(actor);
  return check;
}

/* -------------------------------------------- */
/*  The road roll remembered (0.7.3)            */
/* -------------------------------------------- */

/** What `system.exploration.roll` reads when nothing is remembered: the schema's own defaults. */
const NO_ROAD_ROLL = Object.freeze({ slug: "", total: null, natural: null, time: null, modifiers: [] });

/**
 * Remember a check as the Activity's roll (ruling 108): the body of the `starwrought.check` hook.
 * Writes nothing unless `actor` is a character this user owns (the roller's own client records it,
 * and an owner may write their own Actor; the GM may roll for anyone), the result is a plain check
 * (`config.kind` "check": an Initiative, Attack or Defense roll is never the Activity's roll, and a
 * Defense rolled for its own sake comes through as a check, which is how Search's Awareness
 * arrives), its Constellation is the one the member's Activity rolls now (`activityCheckSlug`; a
 * Fatigued member Travels, which rolls nothing, so nothing is kept for them), and it has a total.
 * Wherever it was rolled counts: the road row's Roll, an Ask everyone card, the Skills grid, the
 * character sheet. One write with `{ swAnnounced: true }` and no chat: the roll's own card is the
 * record of the die, and this is a pointer to it (ruling 110). A newer roll in the same
 * Constellation replaces an older one; a check in another Constellation leaves it alone.
 * @param {Actor|null} actor   The roller (`result.config.actor`).
 * @param {object|null} result The check engine's result (`{ total, natural, config }`).
 * @returns {Promise<object|null>}  The record written, or null when nothing was.
 */
export async function rememberActivityRoll(actor, result) {
  if (!actor || (actor.documentName !== "Actor") || (actor.type !== "character")) return null;
  if (!actor.isOwner) return null;
  const cfg = result?.config ?? null;
  if (!cfg || (cfg.kind !== "check")) return null;
  const slug = String(cfg.slug ?? "").trim();
  if (!slug || !Number.isNumeric(result.total)) return null;
  // The chip is public (ruling 110), so only a public roll is remembered: a blind or whispered
  // card would otherwise show its total to every player on the party sheet. The posted card says
  // what it was (`SwCheck.#toMessage` sets `result.message` before the hook fires); the roll mode
  // is the fallback when no card was made.
  const message = result.message ?? null;
  const hidden = message
    ? (!!message.blind || ((message.whisper?.length ?? 0) > 0))
    : !["publicroll", "public"].includes(String(cfg.rollMode ?? ""));
  if (hidden) return null;
  const activities = await explorationActivities();
  const { item } = activityOf(actor, activities);
  if (activityCheckSlug(actor, item) !== slug) return null;
  const record = {
    slug,
    total: Number(result.total),
    natural: Number.isNumeric(result.natural) ? Number(result.natural) : null,
    time: Date.now(),
    // The check's own typed extras (the dialog's situational entry, a caller's typed bonus), so a
    // kept roll can be re-counted as an Initiative in one typed-stacking pass (ruling 109).
    modifiers: (Array.isArray(result.extras) ? result.extras : [])
      .filter(m => Number.isNumeric(m?.value))
      .map(m => ({ label: String(m.label ?? ""), value: Number(m.value), type: m.type ?? null }))
  };
  await actor.update({ "system.exploration.roll": record }, { swAnnounced: true });
  return record;
}

/**
 * The road's one hook, registered once at ready (starwrought.mjs): every check the engine posts a
 * card for is offered to `rememberActivityRoll`, which keeps the ones that are the roller's
 * Activity's roll. `SwCheck.roll` fires `starwrought.check` after the card, with `config.actor` the
 * roller; a blind roll (the attack flow's, `postCard: false`) never fires it, which is right, since
 * no Activity rolls an Attack.
 */
export function registerRoadHooks() {
  Hooks.on("starwrought.check", result => rememberActivityRoll(result?.config?.actor ?? null, result));
}

/**
 * How long ago, in the row's own words: "just now" under a minute, then minutes, hours and days,
 * the singular for one of each. "" for a record with no time.
 * @param {number|null} time  Epoch milliseconds.
 * @returns {string}
 */
function agoText(time) {
  if (!Number.isNumeric(time)) return "";
  const minutes = Math.floor(Math.max(0, Date.now() - Number(time)) / 60000);
  if (minutes < 1) return L("STARWROUGHT.Travel.agoNow");
  if (minutes < 60) return (minutes === 1) ? L("STARWROUGHT.Travel.agoMinute") : F("STARWROUGHT.Travel.agoMinutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return (hours === 1) ? L("STARWROUGHT.Travel.agoHour") : F("STARWROUGHT.Travel.agoHours", { n: hours });
  const days = Math.floor(hours / 24);
  return (days === 1) ? L("STARWROUGHT.Travel.agoDay") : F("STARWROUGHT.Travel.agoDays", { n: days });
}

/**
 * The member's remembered roll, read against the Activity they are doing now (ruling 108): null
 * when nothing is remembered, or when the remembered Constellation is no longer the one the
 * Activity rolls now (the pick moved under it without `setActivity`, say, or a stale Lore), in
 * which case it is stale and shown as nothing rather than as a number that means something else.
 * `usable` says whether it is in the Constellation the Activity rolls for Initiative, which is what
 * Begin the encounter asks about (ruling 109); `ago` is the time in words for the hover.
 * @param {Actor} actor
 * @param {Item|null} item  The member's Activity (`activityOf(...).item`).
 * @returns {{slug: string, name: string, total: number, natural: number|null, time: number|null, usable: boolean, ago: string}|null}
 */
export function roadRoll(actor, item) {
  const record = actor?.system?.exploration?.roll ?? null;
  const slug = String(record?.slug ?? "").trim();
  if (!slug || !Number.isNumeric(record?.total)) return null;
  const now = activityCheckSlug(actor, item);
  if (!now || (slug !== now)) return null;
  const time = Number.isNumeric(record.time) ? Number(record.time) : null;
  return {
    slug,
    name: constellationName(actor, slug),
    total: Number(record.total),
    natural: Number.isNumeric(record.natural) ? Number(record.natural) : null,
    time,
    modifiers: (Array.isArray(record.modifiers) ? record.modifiers : [])
      .filter(m => Number.isNumeric(m?.value))
      .map(m => ({ label: String(m.label ?? ""), value: Number(m.value), type: m.type ?? null })),
    usable: slug === initiativeFor(actor, item).slug,
    ago: agoText(time)
  };
}

/**
 * The members whose remembered roll Begin the encounter can keep as Initiative (ruling 109), for
 * the sheet's dialog: present (a token on the viewed scene, as Begin counts presence), their
 * `roadRoll` usable (in the Constellation their Activity rolls for Initiative), and at least one of
 * their Combatants on the scene's unstarted Combat not yet rolled (no Combat, or no Combatant yet,
 * is "not rolled" too: Begin will make one). A member who has rolled Initiative is left alone and
 * not listed, so a second Begin asks nothing about them.
 * @param {Actor} party
 * @param {Item[]} activities
 * @returns {Array<{actor: Actor, item: Item|null, roll: object, init: {slug: string, name: string, choice: boolean, fallback: boolean}}>}
 */
export function keepableRolls(party, activities) {
  const scene = canvas?.scene ?? null;
  if (!scene) return [];
  const combat = game.combats.find(c => (c.scene?.id === scene.id) && !c.started) ?? null;
  const rows = [];
  for (const actor of memberActors(party)) {
    const tokens = scene.tokens.filter(t => t.actorId === actor.id);
    if (!tokens.length) continue;
    const { item } = activityOf(actor, activities);
    const roll = roadRoll(actor, item);
    if (!roll?.usable) continue;
    const unrolled = tokens.some(t => {
      const combatant = combat?.getCombatantsByToken(t.id)[0] ?? null;
      return !combatant || (combatant.initiative === null) || (combatant.initiative === undefined);
    });
    if (!unrolled) continue;
    rows.push({ actor, item, roll, init: initiativeFor(actor, item) });
  }
  return rows;
}

/**
 * The warnings a row shows, read from live data and never enforced (ruling 107): Look Harmless's
 * Requirements, "You wield no weapon with a Reach greater than Adjacent, and your worn armor
 * totals Load 1 or less", as a held weapon whose `system.reach` is above 0 (the data writes
 * Adjacent as 0 and a Shortsword as 2), named with its Reach, and the worn pieces' Load summed
 * when it passes 1; an Activity whose roll is the member's pick with no pick made; and a pick
 * left blank where only Initiative wanted one (Awareness until then). Localized strings, in the
 * order the row prints them.
 * @param {Actor} actor
 * @param {Item|null} item
 * @returns {string[]}
 */
export function activityWarnings(actor, item) {
  const warnings = [];
  if (!actor || !item) return warnings;
  const ex = explorationOf(item);
  if (activitySlug(item) === LOOK_HARMLESS) {
    const reaching = actor.items.filter(i => (i.type === "weapon") && i.system.held && ((Number(i.system.reach) || 0) > 0));
    for (const weapon of reaching) {
      warnings.push(F("STARWROUGHT.Travel.warnReach", { weapon: weapon.name, reach: Number(weapon.system.reach) || 0 }));
    }
    const load = Object.values(actor.system.worn ?? {}).filter(Boolean)
      .reduce((sum, piece) => sum + (Number(piece.system?.load) || 0), 0);
    if (load > 1) warnings.push(F("STARWROUGHT.Travel.warnLoad", { load }));
  }
  // A stale pick (a Lore since deleted) counts as none, so the row says so rather than rolling it.
  const pick = memberPick(actor);
  if (!pick) {
    if (ex.check === SW.ACTIVITY_CHOICE) warnings.push(F("STARWROUGHT.Travel.warnNoConstellation", { activity: item.name }));
    else if (ex.initiative === SW.ACTIVITY_CHOICE) warnings.push(F("STARWROUGHT.Travel.warnInitiativeFallback", { activity: item.name }));
  }
  return warnings;
}

/**
 * Set a member's Activity, its Constellation, or both (ruling 106). The owner or the GM, directly:
 * an owner may write their own Actor, so there is no relay. `activityId` is the Item's id, "" for
 * Travel, or undefined to keep what is stored; `constellation` is a slug, "" to clear, or
 * undefined to keep it, and it is cleared when the Activity names its own Constellations (the
 * pick means nothing to Search). Refused with a notice while the member is Fatigued and the
 * Activity is not Travel (ruling 101). Travel is stored as "" so the default never depends on an
 * id. One write with `{ swAnnounced: true }`, then ONE line spoken by the member: "{name}'s
 * Activity is now Search (Half)." or, when only the Constellation moved, "{name} Investigates
 * with Lore (Warfare)." (risk 12: if a line a pick is too many, this goes quiet and Say the plan
 * is the record). Nothing written and nothing said when nothing changed.
 * @param {Actor} actor
 * @param {object} [change]
 * @param {string} [change.activityId]
 * @param {string} [change.constellation]
 * @returns {Promise<{activity: string, constellation: string, item: Item|null}|null>}
 */
export async function setActivity(actor, { activityId, constellation } = {}) {
  if (!actor || (actor.type !== "character")) return null;
  if (!actor.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
    return null;
  }
  const activities = await explorationActivities();
  const travel = travelActivity(activities);
  const current = actor.system.exploration ?? { activity: "", constellation: "" };
  const before = activityOf(actor, activities).stored ?? travel;

  let item = before;
  if (activityId !== undefined) {
    const id = String(activityId ?? "").trim();
    item = id ? (activities.find(a => a.id === id) ?? null) : travel;
    if (!item) {
      ui.notifications.warn(L("STARWROUGHT.Travel.unknownActivity"));
      return null;
    }
  }
  let slug = String(current.constellation ?? "").trim();
  if (constellation !== undefined) slug = String(constellation ?? "").trim();
  if (!activityHasChoice(item)) slug = "";

  const fatigued = Number(actor.conditionValue?.("fatigued")) || 0;
  if ((fatigued > 0) && item && travel && (item !== travel)) {
    ui.notifications.warn(F("STARWROUGHT.Travel.fatiguedRefused", { name: actor.name, n: fatigued }));
    return null;
  }

  const storedId = (item && travel && (item === travel)) ? "" : (item?.id ?? "");
  const activityChanged = item !== before;
  const constellationChanged = slug !== String(current.constellation ?? "").trim();
  if (!activityChanged && !constellationChanged) return null;

  // The remembered roll goes with the pick (ruling 108): a Search is not an Avoid Notice, and a
  // Lore rolled for one Investigation is not the Skill chosen for the next. Cleared in the same
  // write, so no render sees the old number beside the new Activity.
  await actor.update({
    "system.exploration.activity": storedId,
    "system.exploration.constellation": slug,
    "system.exploration.roll": { ...NO_ROAD_ROLL }
  }, { swAnnounced: true });

  const name = escapeHTML(actor.name);
  const activity = escapeHTML(item?.name ?? "");
  const picked = slug ? escapeHTML(constellationName(actor, slug)) : "";
  let line;
  if (activityChanged) {
    line = picked
      ? F("STARWROUGHT.Travel.saidActivityWith", { name, activity, speed: escapeHTML(travelWord(item)), constellation: picked })
      : F("STARWROUGHT.Travel.saidActivity", { name, activity, speed: escapeHTML(travelWord(item)) });
  } else if (picked) {
    line = (activitySlug(item) === INVESTIGATE)
      ? F("STARWROUGHT.Travel.saidInvestigate", { name, constellation: picked })
      : F("STARWROUGHT.Travel.saidConstellation", { name, activity, constellation: picked });
  } else {
    line = F("STARWROUGHT.Travel.saidConstellationCleared", { name, activity });
  }
  await postMemberCard(actor, {
    root: "sw-travel-card",
    icon: "fa-solid fa-route",
    title: L("STARWROUGHT.Travel.cardTitle"),
    lines: [line]
  });
  return { activity: storedId, constellation: slug, item };
}

/**
 * The party's Travel Speed (ruling 102), display only. Each member's `moveSpeed` (after the Legs'
 * Wounds, as the character's own figures read it) times their Activity's multiplier; the lowest,
 * times the terrain (`SW.TERRAIN`: normal 1, Difficult one half, Greater Difficult one third;
 * PHB P343 to P344); then the book's three figures through `SW.TRAVEL`, miles an hour rounded
 * down as the character's are (Math Conventions: an odd Speed never prints a half mile), the
 * other two rounded. The pacesetter is the slowest member, the first on a tie; `searching` says
 * whether anyone Searches, for the ten-minutes note (P346). No members: zero figures and no
 * pacesetter. Nothing here moves a token.
 * @param {Actor} party
 * @param {Item[]} activities
 * @returns {{speed: number, feetPerMinute: number, milesPerHour: number, milesPerDay: number,
 *   pacesetter: {actor: Actor, item: Item|null, multiplier: number, speed: number}|null,
 *   terrain: string, terrainMultiplier: number, searching: boolean,
 *   members: Array<{actor: Actor, item: Item|null, stored: Item|null, locked: boolean, lockedReason: string, fatigued: number, multiplier: number, speed: number}>}}
 */
export function partyTravel(party, activities) {
  const terrain = String(party?.system?.travel?.terrain ?? "normal");
  const terrainMultiplier = Number(SW.TERRAIN?.[terrain]?.multiplier) || 1;
  const members = memberActors(party).map(actor => {
    const pick = activityOf(actor, activities);
    const multiplier = travelMultiplier(pick.item);
    const speed = (Number(actor.system.moveSpeed) || 0) * multiplier;
    return { actor, ...pick, multiplier, speed };
  });
  if (!members.length) {
    return { speed: 0, feetPerMinute: 0, milesPerHour: 0, milesPerDay: 0, pacesetter: null, terrain, terrainMultiplier, searching: false, members };
  }
  let slowest = members[0];
  for (const member of members) if (member.speed < slowest.speed) slowest = member;
  const speed = slowest.speed * terrainMultiplier;
  return {
    speed,
    feetPerMinute: Math.round(speed * SW.TRAVEL.feetPerMinute),
    milesPerHour: Math.floor(speed * SW.TRAVEL.milesPerHour),
    milesPerDay: Math.round(speed * SW.TRAVEL.milesPerDay),
    pacesetter: { actor: slowest.actor, item: slowest.item, multiplier: slowest.multiplier, speed: slowest.speed },
    terrain,
    terrainMultiplier,
    searching: members.some(m => activitySlug(m.item) === SEARCH),
    members
  };
}

/** A modifier as a card prints it: "+1", "−2" (the minus sign, as the sheet's figures print it), "+0". */
function signedText(value) {
  const n = Number(value) || 0;
  return `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
}

/** The terrain clause of the speed line: "" on normal ground, " over Difficult terrain" otherwise. */
function terrainClause(terrain) {
  if (!terrain || (terrain === "normal")) return "";
  const label = SW.TERRAIN?.[terrain]?.label;
  return label ? F("STARWROUGHT.Travel.speedOver", { terrain: L(label) }) : "";
}

/**
 * Say the plan (ruling 106: the record): one public card spoken by the party, a line per member
 * ("Hrolda: Search (Half); Initiative: Awareness.", with the Constellation when the Activity is
 * the member's pick and the Fatigued lock when it holds), the member's warnings dim beneath it,
 * then the speed line ("The party moves at 120 feet a minute, 1 miles an hour, 12 miles a day:
 * Wren sets the pace (Search, Half).") and the ten-minutes note when anyone Searches. GM only.
 * @param {Actor} party
 * @returns {Promise<ChatMessage|null>}
 */
/**
 * The unit words beside the two figures that can read as one: "1 mile an hour" and "1 mile a day"
 * (a Searching party over Greater Difficult terrain gets there), the plural otherwise. Feet never
 * reach one in practice and keep their one word.
 * @param {{milesPerHour: number, milesPerDay: number}} travel  From partyTravel.
 * @returns {{mphUnit: string, mpdUnit: string}}
 */
export function travelUnits(travel) {
  return {
    mphUnit: L((Number(travel?.milesPerHour) === 1) ? "STARWROUGHT.Travel.mileAnHour" : "STARWROUGHT.Travel.milesAnHour"),
    mpdUnit: L((Number(travel?.milesPerDay) === 1) ? "STARWROUGHT.Travel.mileADay" : "STARWROUGHT.Travel.milesADay")
  };
}

export async function sayThePlan(party) {
  if (!game.user.isGM) return null;
  const activities = await explorationActivities();
  const travel = partyTravel(party, activities);
  if (!travel.members.length) {
    ui.notifications.warn(L("STARWROUGHT.Travel.planNoMembers"));
    return null;
  }
  const lines = [];
  const notes = [];
  for (const member of travel.members) {
    const { actor, item } = member;
    const name = escapeHTML(actor.name);
    let line = F("STARWROUGHT.Travel.planLine", { name, activity: escapeHTML(item?.name ?? ""), speed: escapeHTML(travelWord(item)) });
    const pick = String(actor.system.exploration?.constellation ?? "").trim();
    if (activityHasChoice(item) && pick) line += F("STARWROUGHT.Travel.planWith", { constellation: escapeHTML(constellationName(actor, pick)) });
    line += F("STARWROUGHT.Travel.planInitiative", { constellation: escapeHTML(initiativeFor(actor, item).name) });
    // The roll remembered on the road (ruling 108), as the row's chip shows it. Whether it can
    // stand as Initiative is Begin the encounter's question, asked there and not here.
    const remembered = roadRoll(actor, item);
    if (remembered) line += escapeHTML(F("STARWROUGHT.Travel.planRolled", { constellation: remembered.name, total: remembered.total }));
    if (member.locked) line += ` ${escapeHTML(F("STARWROUGHT.Travel.planLocked", { n: member.fatigued }))}`;
    const warnings = activityWarnings(actor, item);
    if (warnings.length) line += `<br><span class="sw-card-note sw-warn">${warnings.map(w => escapeHTML(w)).join(" ")}</span>`;
    lines.push(line);
  }
  const pace = travel.pacesetter;
  lines.push(escapeHTML(F("STARWROUGHT.Travel.speedCard", {
    feet: travel.feetPerMinute, mph: travel.milesPerHour, mpd: travel.milesPerDay,
    ...travelUnits(travel),
    terrain: terrainClause(travel.terrain),
    pacesetter: pace.actor.name, activity: pace.item?.name ?? "", speed: travelWord(pace.item)
  })));
  if (travel.searching) notes.push(escapeHTML(L("STARWROUGHT.Travel.searchingNote")));
  return postPartyCard(party, {
    root: "sw-travel-card sw-plan-card",
    icon: "fa-solid fa-route",
    title: L("STARWROUGHT.Travel.planTitle"),
    lines,
    notes
  });
}

/**
 * The degrees of success printed on an Activity, for the GM to compare by hand: the Item's
 * description from its first "Critical Success" to the end of that run of text, or the whole
 * description when it prints no degrees. The system's own content is written this way (Look
 * Harmless); a GM's rewrite is theirs and prints as written.
 * @param {Item|null} item
 * @returns {string}  HTML, as the Item carries it.
 */
function degreesOf(item) {
  const html = String(item?.system?.description ?? "");
  const at = html.indexOf("<b>Critical Success</b>");
  if (at < 0) return html;
  const rest = html.slice(at);
  const end = rest.search(/<br\s*\/?>|<\/p>/i);
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * Begin the encounter (ruling 105): Initiative by Activity written onto the Combatants, and
 * nothing rolled. GM only. The viewed scene must exist. An unstarted Combat on that scene is
 * reused, else one is created and made active. For every member, their tokens on the scene
 * (linked or not: `actorId` is the member's) become Combatants where they are not already, one
 * per token as the tracker does; a member with no token is named in the card and skipped for
 * everything that follows (a Scout with no token on the field gives no bonus). Then, on every
 * member Combatant that has not rolled: `initiativeConstellation` is the Activity's Initiative
 * Constellation (Awareness when it names none; Investigate's pick, or Awareness with a note), and
 * `initiativeModifiers` carries one entry per OTHER present member whose Activity has the
 * `scout` effect (`{ label: "Scout (Hrolda)", value: 1, type: "situation" }`; same type, so two
 * Scouts give everyone else two of which one applies, and each other one, as the book's stacking
 * rule says). A Combatant that already has an Initiative value is left alone and named. Every
 * present member whose Activity has the `defend` effect has their held shield Raised with
 * `update({ "system.raised": true }, { swAnnounced: true })`, no action spent and no card of its
 * own (the Raise a Shield card would print a cost); it comes down at their next Opportunity, as
 * any raised shield does, which is the book's "begins Raised". Then ONE public card spoken by the
 * party. The Scout's Step is announced, not moved; Look Harmless's degrees are printed for the GM
 * to compare by hand against each enemy's Awareness Threshold (adversary Thresholds never reach a
 * player); whether an Investigation was related is the GM's call before the die. Players roll
 * their own from the tracker or the sheet; the GM rolls for the absent.
 *
 * Since 0.7.3 (ruling 109) a roll made on the road can stand as the Initiative roll: the book says
 * a character "can roll" their Activity's Constellation when the encounter begins, and a roll
 * already made in that Constellation on the road is that roll. `keep` names the members (by Actor
 * uuid) the GM ticked in the sheet's dialog (`keepableRolls` lists who may be asked about); for
 * each whose `roadRoll` is usable and whose Combatants have not rolled, the Initiative is the same
 * die re-counted as an Initiative by the check engine: the natural die plus its Initiative
 * assembly for that Constellation with the Combatant's Scout modifiers and the check's own typed
 * extras resolved in one pass. Since ruling 111 (0.7.4) an Initiative rolled with a Constellation
 * carries every modifier that Constellation's check does, so against the check's total the only
 * difference is Initiative's own terms: the helm where the check lacked it, the sheet's Initiative
 * adjustment, and the Scouts' +1 (stacking with a check's own Situation entry by the rule).
 * The flags are written first as for anyone, `setInitiative` sets the number, the card says what
 * was kept and by how much it moved, and the remembered roll is left in place. An unticked member
 * rolls fresh as before; nothing else about Begin changes.
 * @param {Actor} party
 * @param {object} [options]
 * @param {string[]} [options.keep]  Actor uuids whose remembered roll stands as Initiative.
 * @returns {Promise<Combat|null>}
 */
export async function beginEncounter(party, { keep = [] } = {}) {
  if (!game.user.isGM) return null;
  const scene = canvas?.scene ?? null;
  if (!scene) {
    ui.notifications.warn(L("STARWROUGHT.Travel.noScene"));
    return null;
  }
  const members = memberActors(party);
  if (!members.length) {
    ui.notifications.warn(L("STARWROUGHT.Travel.planNoMembers"));
    return null;
  }
  const activities = await explorationActivities();

  let combat = game.combats.find(c => (c.scene?.id === scene.id) && !c.started) ?? null;
  const created = !combat;
  if (!combat) combat = await Combat.implementation.create({ scene: scene.id, active: true });
  else if (!combat.active) await combat.activate();
  if (!combat) return null;

  // Who is on the field: the members' tokens, one Combatant each.
  const present = [];
  const absent = [];
  const toCreate = [];
  for (const actor of members) {
    const tokens = scene.tokens.filter(t => t.actorId === actor.id);
    if (!tokens.length) {
      absent.push(actor);
      continue;
    }
    present.push({ actor, pick: activityOf(actor, activities), tokens });
    for (const token of tokens) {
      if (combat.getCombatantsByToken(token.id)[0]) continue;
      toCreate.push({ tokenId: token.id, sceneId: scene.id, actorId: token.actorId, hidden: token.hidden });
    }
  }
  if (toCreate.length) await combat.createEmbeddedDocuments("Combatant", toCreate);

  // The flags: the Constellation each rolls, and the Scouts' bonus for everyone but the Scout.
  const scouts = present.filter(p => explorationOf(p.pick.item).effect === EFFECT_SCOUT);
  const updates = [];
  const entries = [];
  for (const p of present) {
    const init = initiativeFor(p.actor, p.pick.item);
    const modifiers = scouts.filter(s => s.actor !== p.actor).map(s => ({
      label: F("STARWROUGHT.Travel.scoutBonus", { name: s.actor.name }),
      value: Number(SW.SCOUT_INITIATIVE_BONUS) || 1,
      type: "situation"
    }));
    const combatants = p.tokens.map(t => combat.getCombatantsByToken(t.id)[0] ?? null).filter(Boolean);
    let rolled = 0;
    for (const combatant of combatants) {
      if ((combatant.initiative !== null) && (combatant.initiative !== undefined)) {
        rolled++;
        continue;
      }
      updates.push({
        _id: combatant.id,
        [`flags.${SW.SYSTEM_ID}.${FLAG_INITIATIVE_CONSTELLATION}`]: init.slug,
        [`flags.${SW.SYSTEM_ID}.${FLAG_INITIATIVE_MODIFIERS}`]: modifiers
      });
    }
    entries.push({ ...p, init, modifiers, combatants, rolled, scouts: scouts.filter(s => s.actor !== p.actor).map(s => s.actor.name) });
  }
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);

  // The road rolls kept as Initiative (ruling 109): the ticked members whose remembered roll is in
  // the Constellation they roll for Initiative and whose Combatants have not rolled. The number is
  // the same die re-counted as an Initiative: the natural die plus the engine's Initiative
  // assembly for that Constellation, with the Scouts' modifiers and the check's own typed extras
  // (the dialog's situational entry) resolved in ONE pass, so a +2 Situation for cover and a
  // Scout's +1 Situation stack as the rule says, highest only, rather than both landing (the
  // review of 0.7.3). Against the check's total that is the helm where the check lacked it, the
  // sheet's Initiative adjustment and the Scouts' bonus, and nothing else: since ruling 111
  // (0.7.4) an Initiative rolled with a Constellation carries every modifier that Constellation's
  // check does, Load Strain on a Stealth roll included, so the kept die lands where a fresh one
  // would with the same face. A record
  // with no die (none is written without one, but the schema allows it) falls back to the total
  // plus the gap between the two assemblies. `previewTotal` is static and pure.
  const kept = new Set(Array.isArray(keep) ? keep : []);
  for (const entry of entries) {
    if (!kept.has(entry.actor.uuid)) continue;
    const roll = roadRoll(entry.actor, entry.pick.item);
    if (!roll?.usable) continue;
    const unrolled = entry.combatants.filter(c => (c.initiative === null) || (c.initiative === undefined));
    if (!unrolled.length) continue;
    const scoutMods = entry.modifiers.map(m => ({ ...m }));
    const value = Number.isNumeric(roll.natural)
      ? roll.natural + SwCheck.previewTotal(entry.actor, {
        kind: "initiative", slug: roll.slug, modifiers: [...scoutMods, ...roll.modifiers.map(m => ({ ...m }))]
      })
      : roll.total + SwCheck.previewTotal(entry.actor, { kind: "initiative", slug: roll.slug, modifiers: scoutMods })
        - SwCheck.previewTotal(entry.actor, { kind: "check", slug: roll.slug });
    const delta = value - roll.total;
    for (const combatant of unrolled) await combat.setInitiative(combatant.id, value);
    entry.kept = { name: roll.name, total: roll.total, delta, value };
  }

  // The Defenders' shields: Raised, quietly, with no action spent.
  for (const entry of entries) {
    if (explorationOf(entry.pick.item).effect !== EFFECT_DEFEND) continue;
    const actor = entry.actor;
    const shield = actor.system.shield ?? actor.items.find(i => (i.type === "shield") && i.system.held) ?? null;
    entry.shield = shield;
    if (shield && !shield.system.raised) await shield.update({ "system.raised": true }, { swAnnounced: true });
  }

  // The card.
  const lines = [escapeHTML(F(created ? "STARWROUGHT.Travel.encounterCreated" : "STARWROUGHT.Travel.encounterReused", { scene: scene.name }))];
  const notes = [];
  for (const entry of entries) {
    const { actor, pick, init } = entry;
    const name = escapeHTML(actor.name);
    const activity = escapeHTML(pick.item?.name ?? "");
    if (entry.rolled && (entry.rolled === entry.combatants.length)) {
      lines.push(escapeHTML(F("STARWROUGHT.Travel.encounterRolledAlready", { name: actor.name, activity: pick.item?.name ?? "" })));
      continue;
    }
    let line;
    if (entry.kept) {
      // A kept road roll stands in for the "rolls X for Initiative" line (ruling 109), with the
      // move when Initiative's own terms made one; the Scout's Step and the shield still follow.
      const k = entry.kept;
      const constellation = escapeHTML(k.name);
      line = k.delta
        ? F("STARWROUGHT.Travel.encounterKeptAdjusted", { name, constellation, total: k.total, delta: signedText(k.delta), value: k.value })
        : F("STARWROUGHT.Travel.encounterKept", { name, constellation, total: k.total });
    } else {
      const bonus = entry.modifiers.length
        ? F("STARWROUGHT.Travel.encounterScoutBonus", { value: entry.modifiers[0].value, scouts: escapeHTML(entry.scouts.join(", ")) })
        : "";
      line = F("STARWROUGHT.Travel.encounterRolls", { name, activity, constellation: escapeHTML(init.name), bonus });
      if (init.fallback) line += ` ${escapeHTML(F("STARWROUGHT.Travel.encounterFallback", { name: actor.name }))}`;
    }
    const ex = explorationOf(pick.item);
    if (ex.effect === EFFECT_SCOUT) line += ` ${escapeHTML(F("STARWROUGHT.Travel.encounterScoutStep", { name: actor.name }))}`;
    if (ex.effect === EFFECT_DEFEND) {
      line += ` ${escapeHTML(entry.shield
        ? F("STARWROUGHT.Travel.encounterDefend", { name: actor.name, shield: entry.shield.name })
        : F("STARWROUGHT.Travel.encounterDefendNoShield", { name: actor.name }))}`;
    }
    if (pick.locked) line += ` ${escapeHTML(F("STARWROUGHT.Travel.planLocked", { n: pick.fatigued }))}`;
    lines.push(line);
    if (activitySlug(pick.item) === LOOK_HARMLESS) {
      lines.push(`${escapeHTML(F("STARWROUGHT.Travel.encounterLookHarmless", { name: actor.name, constellation: init.name }))}<br><span class="sw-card-note">${degreesOf(pick.item)}</span>`);
    }
    if (activityHasChoice(pick.item)) notes.push(escapeHTML(F("STARWROUGHT.Travel.encounterInvestigate", { name: actor.name, activity: pick.item?.name ?? "" })));
  }
  if (absent.length) notes.push(escapeHTML(F("STARWROUGHT.Travel.encounterNoToken", { scene: scene.name, names: absent.map(a => a.name).join(", ") })));
  if (!entries.length) notes.push(escapeHTML(F("STARWROUGHT.Travel.encounterNoCombatants", { scene: scene.name })));
  notes.push(escapeHTML(L("STARWROUGHT.Travel.encounterPlayersRoll")));
  await postPartyCard(party, {
    root: "sw-travel-card sw-encounter-card",
    icon: "fa-solid fa-flag",
    title: L("STARWROUGHT.Travel.encounterTitle"),
    lines,
    notes
  });
  return combat;
}
