/**
 * What an attack IS (0.12.0; the split CLAUDE.md promised at the first non-Blow Threat, "what the
 * attack is" cut from "how the table agrees"): one reading of the thing declared, whatever it is
 * made with, so the coordinator, the prompt and the card never ask "weapon or attack row or spell"
 * for themselves.
 *
 * Three sources, one shape:
 *  - a **weapon** Item of a character (a Strike, Quick ❶, Deliberate ❷ or Committed ❸; or a
 *    Reaction's Quick Strike, Intercept ❶↺ or the Riposte);
 *  - an **attack row** of an adversary (`system.attacks`, or an action Item with `attack.enabled`);
 *  - a **spell** Talent (PHB v4.21, Spellwork: a Cast, Quick ❷, Focused ❸ or Committed ❹, a Threat
 *    answered by one of two Defenses, never a Strike).
 *
 * `resolveSource` reads the attacker's own Items and trusts nothing else from the wire: the Threat,
 * the permitted Defenses, the cost and whether the Blow is ranged come from the Item, never from
 * the declaring client. `maneuverFrom` is the record's `maneuver` (attack-workflow.mjs); the rest
 * read that record back: what it costs (`costOf`, for a refund), how its attacker rolls blind
 * (`rollBlind`), what `SwCheck.resolveAgainst` needs of it (`resolveArgs`), and how it is named
 * (`describe`).
 *
 * `game` and `canvas` are read at call time only, so the module may be imported under Node with
 * them mocked afterwards, as attack-workflow.mjs and attack-card.mjs are.
 */

import * as SW from "../config.mjs";
import { gapBetween } from "../canvas/geometry.mjs";

const localize = key => game.i18n.localize(key);

/** The Reaction Strikes the flow knows: Intercept pays its own ❶↺, the Riposte was paid by its Parry. */
export const REACTION_STRIKES = Object.freeze(["intercept", "riposte"]);

/** The three kinds of source. */
export const SOURCES = Object.freeze(["weapon", "attack", "spell"]);

/* -------------------------------------------- */
/*  Reading the declaration                     */
/* -------------------------------------------- */

/**
 * Read what a declaration names on the attacker.
 * @param {Actor} attacker
 * @param {object} payload   `{ weaponId, attackId, talentId, strike, cast, reaction, thrown, prepared, free }`
 * @param {object} [context]
 * @param {TokenDocument|null} [context.attackerToken]  For the thrown inference.
 * @param {TokenDocument|null} [context.targetDoc]      The first target, the reference for reach.
 * @returns {object} the source, or `{ error }` with a REASONS key (noWeapon, noSpell, npcCast)
 */
export function resolveSource(attacker, payload = {}, { attackerToken = null, targetDoc = null } = {}) {
  const reaction = REACTION_STRIKES.includes(payload.reaction) ? payload.reaction : null;

  if (payload.talentId) {
    const talent = attacker.items.get(payload.talentId);
    if (!talent || (talent.type !== "talent") || !talent.system?.isSpell) {
      return { error: "noSpell", errorData: { name: talent?.name ?? payload.talentId } };
    }
    // Adversaries do not Cast in 0.12.0: their magic is the GM's narration (CLAUDE.md, Known outstanding work).
    if (attacker.type === "npc") return { error: "npcCast" };
    const cast = SW.CAST_KINDS[payload.cast] ? payload.cast : SW.DEFAULT_CAST;
    const castKind = SW.CAST_KINDS[cast];
    const spell = talent.system.spell ?? {};
    const threat = SW.THREATS[talent.system.spellThreat] ? talent.system.spellThreat
      : (SW.THREATS[spell.threat] ? spell.threat : "blow");
    const named = Array.isArray(talent.system.spellDefenses) ? talent.system.spellDefenses.filter(d => SW.DEFENSES[d]) : [];
    const defenses = named.length ? [...named] : [...SW.THREATS[threat].defenses];
    const name = SW.plainName(talent.name);
    const glyph = SW.ACTION_GLYPHS[castKind.cost] ?? "";
    return {
      kind: "spell",
      talent,
      weapon: null, attackItem: null, attackRow: null,
      name,
      // A Cast is no melee Blow: nothing about reach applies, and no melee-only Reaction answers it.
      ranged: true, thrown: null, melee: false,
      threat, defenses,
      reaction: null, basicOnly: false,
      strike: null, cast,
      cost: castKind.cost,
      glyph,
      label: `${name}: ${localize(castKind.label)} ${glyph}`.trim(),
      spell: {
        talentId: talent.id,
        cast,
        threat,
        delivery: talent.system.spellDelivery ?? spell.delivery ?? "",
        die: Number(spell.die) || 0,
        name
      }
    };
  }

  const weapon = payload.weaponId ? attacker.items.get(payload.weaponId) : null;
  const attackItem = payload.attackId ? attacker.items.get(payload.attackId) : null;
  const attackRow = payload.attackId ? attacker.system.attacks?.find(a => a.id === payload.attackId) : null;
  if ((payload.weaponId && (weapon?.type !== "weapon")) || (!weapon && !attackItem && !attackRow)) {
    return { error: "noWeapon" };
  }

  // A Reaction's Strike is always a Quick Strike (PHB v4.21).
  const strike = reaction ? "quick" : (SW.STRIKE_KINDS[payload.strike] ? payload.strike : SW.DEFAULT_STRIKE);
  const strikeKind = SW.STRIKE_KINDS[strike];

  // Melee for a weapon in hand, Ranged for one that leaves it (PHB v4.10). A Thrown weapon leaves
  // the hand when its target is beyond Total Reach, read against the first target as rollAttack
  // infers it; the declaration fixes the answer so the roll step agrees with the card.
  let thrown = null;
  let ranged = false;
  if (weapon) {
    let gap = null;
    try {
      gap = (attackerToken && targetDoc && canvas?.ready) ? gapBetween(attackerToken, targetDoc) : null;
    } catch { gap = null; }
    const reachWith = (attacker.system.reach ?? 0) + (weapon.system.reach ?? 0);
    thrown = (payload.thrown !== null && payload.thrown !== undefined) ? !!payload.thrown
      : (!!weapon.system.flags?.thrown && !weapon.system.isRanged && (gap !== null) && (gap > reachWith));
    ranged = !!weapon.system.isRanged || thrown;
  }

  const name = weapon?.name ?? attackItem?.name ?? attackRow?.name ?? "";
  const glyph = SW.ACTION_GLYPHS[strikeKind.cost] ?? "";
  const reactionLabel = reaction ? `${localize(SW.REACTIONS[reaction].label)}: ` : "";
  return {
    kind: weapon ? "weapon" : "attack",
    talent: null,
    weapon, attackItem, attackRow,
    name,
    ranged, thrown, melee: !ranged,
    threat: "blow",
    defenses: [...SW.THREATS.blow.defenses],
    reaction,
    // A Reaction never triggers a Reaction (PHB v4.21, Answering an Attack): the defender of a
    // Reaction Strike answers with a basic Defense alone.
    basicOnly: !!reaction,
    strike, cast: null,
    // Intercept pays its own ❶↺ in place of the Strike's cost; the Riposte was paid by its Parry.
    cost: (reaction === "intercept") ? SW.REACTIONS.intercept.cost : (reaction ? 0 : strikeKind.cost),
    glyph,
    label: `${name}: ${reactionLabel}${localize(strikeKind.label)} ${glyph}`.trim(),
    spell: null
  };
}

/**
 * The record's `maneuver` for a source (attack-workflow.mjs, `AttackWorkflow.create`).
 * @param {object} source   From `resolveSource`.
 * @param {object} payload  The declaration.
 * @returns {object}
 */
export function maneuverFrom(source, payload = {}) {
  return {
    source: source.kind,
    weaponId: source.weapon?.id ?? null,
    weaponName: source.name,
    strike: source.strike,
    glyph: source.glyph,
    label: source.label,
    thrown: source.thrown,
    prepared: !!payload.prepared,
    free: !!payload.free || (source.reaction === "riposte"),
    attackId: (source.attackItem?.id ?? source.attackRow?.id) ?? null,
    ranged: !!source.ranged,
    reaction: source.reaction ?? null,
    basicOnly: !!source.basicOnly,
    threat: source.threat,
    defenses: [...source.defenses],
    spell: source.spell ? { ...source.spell } : null,
    traits: traitsOf(source)
  };
}

/**
 * The traits the attack carries (0.14.0), for a defender's `IF(Trait=...)` rules: a spell Talent's
 * `system.traits`, a weapon's, an adversary attack Item's, or the attack row's copy of them.
 * @param {object} source  From `resolveSource`.
 * @returns {string[]}
 */
export function traitsOf(source) {
  const list = source?.talent?.system?.traits
    ?? source?.weapon?.system?.traits
    ?? source?.attackItem?.system?.traits
    ?? source?.attackRow?.traits
    ?? [];
  return Array.isArray(list) ? list.map(t => String(t)).filter(Boolean) : [];
}

/* -------------------------------------------- */
/*  Reading the record                          */
/* -------------------------------------------- */

/**
 * The actions a declared Maneuver cost, for a refund when the Blow is cancelled before any die:
 * nothing for a Prepared or free one (paid elsewhere) or a Riposte; Intercept's ❶↺; a Cast's or
 * a Strike's own.
 * @param {object} maneuver
 * @returns {number}
 */
export function costOf(maneuver) {
  if (!maneuver || maneuver.prepared || maneuver.free) return 0;
  if (maneuver.reaction === "intercept") return Number(SW.REACTIONS.intercept.cost) || 0;
  if (maneuver.reaction) return 0;
  if (maneuver.source === "spell") return Number(SW.CAST_KINDS[maneuver.spell?.cast]?.cost) || 0;
  return Number(SW.STRIKE_KINDS[maneuver.strike]?.cost) || 0;
}

/** Do melee-only Reactions (Slip the Line, Parry, Deflecting Palms) answer this Maneuver? */
export function meleeAnswers(maneuver) {
  return !!maneuver && (maneuver.source !== "spell") && !maneuver.ranged;
}

/**
 * An adversary's Attack Threshold: the attack row's own number (brief, "Thresholds"), less the
 * Controlled penalty (0.19.0; PHB v4.24, The Bind: "Attacks with the Controlled implement take a
 * −2 Situation penalty") while a foe Controls the implement the row attacks with: the row whose
 * name is the Bind's `mine`, or the adversary's only row when the names do not match. A character's
 * Strike takes the same penalty as a modifier (documents/actor/attack.mjs).
 */
export function attackThreshold(attacker, maneuver) {
  const item = maneuver?.attackId ? attacker.items.get(maneuver.attackId) : null;
  const rows = attacker.system.attacks ?? [];
  const row = maneuver?.attackId ? rows.find(a => a.id === maneuver.attackId) : null;
  const value = item?.system?.attack?.threshold ?? row?.threshold ?? row?.thresholds?.[0];
  const n = Number(value);
  const base = Number.isFinite(n) ? n : 10;
  return base + (controlledPenaltyFor(attacker, item?.name ?? row?.name ?? maneuver?.weaponName, rows.length) ? SW.CONTROLLED_PENALTY : 0);
}

/**
 * Does the Controlled penalty reach this attack of this attacker? Yes while the attacker's Bind
 * says Controlled and the attack is made with the Bound implement: the row named as the Bind's
 * `mine`, or, when no row carries that name, the attacker's one and only row.
 * @param {Actor} attacker
 * @param {string} attackName
 * @param {number} rowCount
 * @returns {boolean}
 */
export function controlledPenaltyFor(attacker, attackName, rowCount = 0) {
  const bind = attacker?.system?.bind;
  if (bind?.state !== "controlled") return false;
  if (bind.mine && attackName && SW.sameName(bind.mine, attackName)) return true;
  return !bind.mine || (rowCount <= 1);
}

/**
 * How the Maneuver is named on the card and in the prompt: "Deliberate Strike ❷ (Longsword)",
 * "Intercept ❶↺: Quick Strike (Spear)", "Focused Cast ❸ (Flame Seed), a Blast".
 * @param {object} maneuver
 * @returns {{kindLabel: string, glyph: string, name: string, threatLabel: string, text: string}}
 */
export function describe(maneuver) {
  const m = maneuver ?? {};
  const name = m.weaponName ?? "";
  if (m.source === "spell") {
    const castKind = SW.CAST_KINDS[m.spell?.cast] ?? SW.CAST_KINDS[SW.DEFAULT_CAST];
    const glyph = SW.ACTION_GLYPHS[castKind.cost] ?? "";
    // "Quick Cast", "Focused Cast": the Cast labels already carry the word.
    const kindLabel = localize(castKind.label);
    const threatLabel = localize(SW.THREATS[m.threat]?.label ?? "STARWROUGHT.Threat.label");
    return { kindLabel, glyph, name, threatLabel, text: `${kindLabel} ${glyph}${name ? ` (${name})` : ""}, ${threatLabel}`.trim() };
  }
  const strike = SW.STRIKE_KINDS[m.strike] ?? null;
  const glyph = strike ? (SW.ACTION_GLYPHS[strike.cost] ?? "") : (m.glyph ?? "");
  let kindLabel = `${strike ? localize(strike.label) : (m.label ?? "")} ${localize("STARWROUGHT.Strike.kind")}`.trim();
  if (m.reaction && SW.REACTIONS[m.reaction]) {
    const r = SW.REACTIONS[m.reaction];
    kindLabel = `${localize(r.label)} ${SW.ACTION_GLYPHS[r.cost] ?? ""}${SW.REACTION_GLYPH}: ${kindLabel}`;
  }
  const threatLabel = localize(SW.THREATS.blow.label);
  return { kindLabel, glyph, name, threatLabel, text: `${kindLabel} ${glyph}${name ? ` (${name})` : ""}`.trim() };
}

/**
 * The three Cast texts as a card's outcome rows, keyed by degree so the one rolled is lit (PHB
 * v4.21, Spellwork: a Quick Cast's Graze deals nothing, a Focused or Committed Cast's one die).
 * @param {Item} talent
 * @param {string} cast
 * @returns {Array<{key: string, label: string, text: string}>|null}
 */
export function castOutcomes(talent, cast) {
  const effects = talent?.system?.spell?.effects ?? {};
  const text = effects[cast] || effects.focused || effects.quick || "";
  if (!text) return null;
  const kind = SW.CAST_KINDS[cast] ?? SW.CAST_KINDS[SW.DEFAULT_CAST];
  const graze = kind.grazeDie
    ? localize("STARWROUGHT.Cast.grazeDie")
    : localize("STARWROUGHT.Cast.grazeNothing");
  return [
    { key: "critSuccess", label: "STARWROUGHT.Outcome.critical", text: `${text} ${localize("STARWROUGHT.Cast.criticalNote")}` },
    { key: "success", label: "STARWROUGHT.Outcome.hit", text },
    { key: "fail", label: "STARWROUGHT.Outcome.graze", text: graze },
    { key: "critFail", label: "STARWROUGHT.Outcome.miss", text: localize("STARWROUGHT.Cast.missNothing") }
  ];
}

/**
 * The source-specific slice of `SwCheck.resolveAgainst`'s arguments for a pairing.
 * @param {Actor} attacker
 * @param {object} maneuver
 * @returns {object}
 */
export function resolveArgs(attacker, maneuver) {
  if (maneuver?.source === "spell") {
    const talent = attacker.items.get(maneuver.spell?.talentId) ?? null;
    const discipline = (talent && (typeof attacker.spellDisciplineFor === "function")) ? attacker.spellDisciplineFor(talent) : null;
    return {
      source: "spell",
      talent,
      cast: maneuver.spell?.cast ?? SW.DEFAULT_CAST,
      outcomes: talent ? castOutcomes(talent, maneuver.spell?.cast ?? SW.DEFAULT_CAST) : null,
      slug: discipline?.slug ?? null,
      weapon: null,
      attackId: null,
      strike: null,
      thrown: false
    };
  }
  return {
    weapon: maneuver?.weaponId ? (attacker.items.get(maneuver.weaponId) ?? null) : null,
    attackId: maneuver?.attackId ?? null,
    strike: maneuver?.strike ?? SW.DEFAULT_STRIKE,
    thrown: !!maneuver?.thrown
  };
}

/**
 * Throw the attacker's die for a pairing, blind (brief, step 4): the whole modifier assembly is
 * reused, nothing of the defender is read, nothing posts, and the result comes back for the
 * coordinator to read against every pairing it fills.
 *  - A weapon: `rollAttack` with the Strike locked (`blind`, `workflow`).
 *  - A spell: `castSpell` with the Cast locked, already paid at the declaration.
 *  - An attack row (adversary against adversary): a flat d20 for the GM, no Threshold.
 * @param {Actor} attacker
 * @param {object} maneuver
 * @param {object} target     The pairing's target row.
 * @param {{id: string, targetId: string}} link
 * @returns {Promise<object|null>}
 */
export async function rollBlind(attacker, maneuver, target, link) {
  const targetUuid = target.tokenUuid || target.actorUuid;
  if (maneuver.source === "spell") {
    if (typeof attacker.castSpell !== "function") return null;
    return attacker.castSpell(maneuver.spell?.talentId, {
      cast: maneuver.spell?.cast,
      prepared: true,
      blind: true,
      targetUuid,
      dialog: true,
      postCard: false,
      workflow: link
    });
  }
  if (maneuver.weaponId && attacker.items.get(maneuver.weaponId)) {
    return attacker.rollAttack(maneuver.weaponId, {
      strike: maneuver.strike,
      prepared: !!maneuver.prepared,
      free: !!maneuver.free,
      reaction: maneuver.reaction ?? null,
      thrown: (maneuver.thrown === null || maneuver.thrown === undefined) ? undefined : !!maneuver.thrown,
      targetUuid,
      dialog: true,
      lockStrike: true,
      postCard: false,
      blind: true,
      workflow: link
    });
  }
  // Adversary against adversary: a flat d20 for the GM, the Strike locked, no Threshold.
  const { SwCheck } = await import("../dice/check.mjs");
  const kind = SW.STRIKE_KINDS[maneuver.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  return SwCheck.roll({
    actor: attacker,
    kind: "attack",
    slug: SW.MELEE_SLUG,
    label: maneuver.weaponName || attacker.name,
    subtitle: `${localize(kind.label)} ${SW.ACTION_GLYPHS[kind.cost] ?? ""}`.trim(),
    strike: maneuver.strike,
    lockStrike: true,
    dialog: true,
    postCard: false,
    flatBonus: 0,
    threshold: null,
    defenseForced: true,
    workflow: link
  });
}
