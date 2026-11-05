/**
 * Legal answers to a Blow: the rules layer the Combat Prompt renders from and the attack
 * coordinator revalidates against (0.5.0 attack-flow brief, "Legal answers").
 *
 * A defender meets a Blow with one of the two basic Defenses that answer it, Evade or Guard
 * (PHB v4.21, The Four Threats), and builds an answer on it:
 *  - nothing: the basic Defense alone, always legal;
 *  - a Reaction ❶↺ the defender owns as a Talent (PHB v4.21: Sidestep and Slip the Line on Evade,
 *    Parry and Deflecting Palms on Guard; SW.REACTIONS, kind "reaction");
 *  - a Posture ⓿↺ (PHB v4.21, the Posture trait): Give Ground with Evade Training, Set Your Feet
 *    with Guard Training, Drop Flat, Kneel Behind the Shield (kind "posture"), each Exposing a Zone
 *    of the defender's choice, a named Zone, or carrying its own drawback instead; and, by the
 *    general rule, any other owned ⓿↺ Reaction Talent in the Defense's own Constellation.
 * A Head Wound blocks every Reaction and Posture; the basic Defense still rolls (PHB v4.10,
 * Wounds). The data model records that as `system.reactions.blocked`.
 *
 * One answer per attack (PHB v4.21, Reactions and Postures; ruling 133): a commitment is a
 * Reaction or a Posture, never both.
 *
 * Nothing here touches `game` at module scope or in `legalAnswers`, so the function runs under
 * Node for its tests; only `describeAnswer` localizes.
 */

import * as SW from "../config.mjs";

/** The two Defenses that answer a Blow, in display order. */
export const BLOW_DEFENSES = Object.freeze([...SW.THREATS.blow.defenses]);

/** The Reaction key a Talent is, by the slug of its plain name, or null when the table has no row. */
export function reactionKeyOf(item) {
  if (item?.type !== "talent") return null;
  const key = SW.slugify(SW.plainName(item.name ?? ""));
  return SW.REACTIONS[key] ? key : null;
}

/**
 * The Reactions this actor owns (PHB v4.21: as Talents, or granted by a Training root), as a map
 * of Reaction key to the Item id that carries it: the Talent's, or the root Talent's for a
 * root-granted one, so a Posture answer can name the Item it rides on. An adversary owns every
 * answer: its Reactions are the GM's to declare, as its stance is (the key maps to null).
 * @param {Actor} actor
 * @returns {Record<string, string|null>}
 */
export function ownedReactions(actor) {
  const owned = {};
  if (!actor) return owned;
  if (actor.type === "npc") {
    for (const [key, rule] of Object.entries(SW.REACTIONS)) {
      if (["reaction", "posture", "movement", "modifier"].includes(rule.kind)) owned[key] = null;
    }
    return owned;
  }
  const items = [...(actor.items ?? [])];
  for (const item of items) {
    const key = reactionKeyOf(item);
    if (key) owned[key] ??= item.id;
  }
  const constellations = actor.system?.constellations ?? {};
  for (const [slug, key] of Object.entries(SW.ROOT_REACTIONS)) {
    if (owned[key] || !constellations[slug]?.rootOwned) continue;
    const root = items.find(i => (i?.type === "talent") && i.system?.root && !i.system?.bloodlineRoot && (i.system?.constellation === slug));
    owned[key] = root?.id ?? null;
  }
  return owned;
}

/**
 * Is this Item a Posture by the general rule: owned, a ⓿↺ Reaction, filed under the Defense's
 * Constellation, and not a row of the table (which has its own say).
 * @param {Item} item
 * @param {string} slug  The Defense's Constellation slug (evade or guard).
 * @returns {boolean}
 */
function isGenericPostureFor(item, slug) {
  if (item?.type !== "talent") return false;
  if (reactionKeyOf(item)) return false;
  const sys = item.system ?? {};
  return (String(sys.cost) === "0") && (sys.reaction === true) && (sys.constellation === slug);
}

/**
 * The answers this actor may commit on a Defense right now.
 * @param {Actor} actor
 * @param {string} defense  "evade" or "guard".
 * @returns {{none: boolean, reactions: string[], postures: {talentId: string, key: string|null, name: string, hint?: string, exposes: boolean|string, granted?: boolean}[]}}
 */
export function legalAnswers(actor, defense) {
  const none = { none: true, reactions: [], postures: [] };
  if (!actor || !BLOW_DEFENSES.includes(defense)) return none;

  const reactions = actor.system?.reactions ?? {};
  // A Head Wound: no Reactions and no Postures at all; only the basic Defense answers.
  if (reactions.blocked) return none;

  const owned = reactions.owned ?? ownedReactions(actor);
  const legalReactions = [];
  const postures = [];
  for (const [key, rule] of Object.entries(SW.REACTIONS)) {
    if (!(key in owned) || (rule.defense !== defense)) continue;
    if (rule.kind === "reaction") legalReactions.push(key);
    else if (rule.kind === "posture") {
      postures.push({
        talentId: owned[key] ?? key,
        key,
        name: `${plainLabel(rule.label)} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`,
        exposes: rule.exposes,
        drawback: rule.drawback ?? null,
        granted: !!rule.grantedBy
      });
    }
  }

  const slug = SW.DEFENSES[defense]?.slug ?? defense;
  for (const item of actor.items ?? []) {
    if (isGenericPostureFor(item, slug)) postures.push({ talentId: item.id, key: null, name: item.name, exposes: true, drawback: null });
  }

  return { none: true, reactions: legalReactions, postures };
}

/** A Reaction's label as plain text: the i18n key's last word titled when `game` is not there. */
function plainLabel(key) {
  try {
    return globalThis.game?.i18n?.localize?.(key) ?? key;
  } catch {
    return key;
  }
}

/**
 * The table's row behind a committed Posture: the Talent's own row by its name, the root-granted
 * row when the Talent is a Training root, or null for a Posture by the general rule.
 * @param {Actor|null} actor
 * @param {{talentId?: string, key?: string}|null} posture
 * @returns {{key: string, rule: object}|null}
 */
export function postureRule(actor, posture) {
  if (!posture) return null;
  if (posture.key && SW.REACTIONS[posture.key]?.kind === "posture") return { key: posture.key, rule: SW.REACTIONS[posture.key] };
  const id = posture.talentId;
  if (id && (SW.REACTIONS[id]?.kind === "posture")) return { key: id, rule: SW.REACTIONS[id] };
  const item = id ? actor?.items?.get?.(id) : null;
  if (!item) return null;
  const own = reactionKeyOf(item);
  if (own && (SW.REACTIONS[own].kind === "posture")) return { key: own, rule: SW.REACTIONS[own] };
  const sys = item.system ?? {};
  if (sys.root && !sys.bloodlineRoot) {
    const granted = SW.ROOT_REACTIONS[sys.constellation];
    if (granted && (SW.REACTIONS[granted]?.kind === "posture")) return { key: granted, rule: SW.REACTIONS[granted] };
  }
  return null;
}

/** A committed Posture's Situation bonus: the table's, or the general rule's +2. */
export function postureBonus(actor, posture) {
  return postureRule(actor, posture)?.rule.bonus ?? SW.POSTURE_DEFAULT_BONUS;
}

/**
 * Does a committed Posture need a Zone of the defender's choice: the general rule and the two
 * root Postures do; Drop Flat Exposes nothing and Kneel names its Zone.
 * @param {Actor|null} actor
 * @param {object|null} posture
 * @returns {boolean}
 */
export function postureNeedsZone(actor, posture) {
  const exposes = postureRule(actor, posture)?.rule.exposes;
  return (exposes === undefined) || (exposes === true);
}

/** The Zone a committed Posture Exposes: the one chosen, the one the rule names, or null. */
export function postureZone(actor, posture) {
  const rule = postureRule(actor, posture)?.rule;
  if (rule && (typeof rule.exposes === "string")) return rule.exposes;
  if (rule && (rule.exposes === false)) return null;
  return (posture?.zone in SW.ZONES) ? posture.zone : null;
}

/**
 * A Posture's name as the table reads it: the record's own when it carries one, else the table's
 * for a row it knows (a root-granted one is named by the table, never by the root: "Give Ground
 * ⓿↺", not "Evade Training"), else the Talent's. Null when nothing names it.
 * @param {Actor|null} actor
 * @param {{talentId?: string, name?: string, key?: string}|null} posture
 * @returns {string|null}
 */
export function postureName(actor, posture) {
  if (posture?.name) return posture.name;
  const found = postureRule(actor, posture);
  if (found) return `${plainLabel(found.rule.label)} ${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`;
  const item = posture?.talentId ? actor?.items?.get?.(posture.talentId) : null;
  return item?.name ?? null;
}

/**
 * Is a committed choice legal for this actor: the Defense answers a Blow, the Reaction or the
 * Posture is among the legal answers, and it is one or the other, never both. A Posture that
 * Exposes a Zone of the defender's choice must name one in SW.ZONES; one that names its own Zone,
 * or none, needs nothing.
 * @param {Actor} actor
 * @param {string} defense
 * @param {{reaction?: string|null, posture?: {talentId: string, zone?: string}|null}} [choice]
 * @returns {boolean}
 */
export function isLegalAnswer(actor, defense, { reaction = null, posture = null } = {}) {
  if (!BLOW_DEFENSES.includes(defense)) return false;
  if (reaction && posture) return false;
  const legal = legalAnswers(actor, defense);
  if (reaction) return legal.reactions.includes(reaction);
  if (posture) {
    if (!posture.talentId) return false;
    if (!legal.postures.some(p => p.talentId === posture.talentId)) return false;
    if (postureNeedsZone(actor, posture)) return posture.zone in SW.ZONES;
    return !posture.zone || (posture.zone in SW.ZONES);
  }
  return legal.none;
}

/** A Talent's name without the glyphs it carries: "Slip the Line ❶↺" reads "Slip the Line". */
export function bareName(name) {
  return String(name ?? "").replace(/[⓿❶❷❸❹❺❻↺◆◇★]/g, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * The answer as the table reads it: "No Reaction: the basic Defense", "Parry ❶↺", "Give Ground ⓿↺
 * (Expose Legs)" (just "Give Ground ⓿↺" until a Zone is named) or "Drop Flat ⓿↺". Localized, so
 * for the browser only.
 * @param {{reaction?: string|null, posture?: {talentId?: string, name?: string, zone?: string|null}|null}} [answer]
 * @param {Actor} [actor]  Resolves a Posture's name and Zone from its talentId when the record lacks them.
 * @returns {string}
 */
export function describeAnswer({ reaction = null, posture = null } = {}, actor = null) {
  if (reaction && SW.REACTIONS[reaction]) {
    const r = SW.REACTIONS[reaction];
    return game.i18n.format("STARWROUGHT.Attack.answerReaction", {
      name: game.i18n.localize(r.label),
      glyph: `${SW.ACTION_GLYPHS[r.cost] ?? ""}${SW.REACTION_GLYPH}`
    });
  }
  if (posture) {
    const name = bareName(postureName(actor, posture) ?? "");
    const glyph = `${SW.ACTION_GLYPHS[0]}${SW.REACTION_GLYPH}`;
    const zone = postureZone(actor, posture);
    if (!zone) return game.i18n.format("STARWROUGHT.Attack.answerReaction", { name, glyph });
    return game.i18n.format("STARWROUGHT.Attack.answerPosture", { name, zone: game.i18n.localize(SW.ZONES[zone]?.label ?? zone) });
  }
  return game.i18n.localize("STARWROUGHT.Attack.answerNone");
}
