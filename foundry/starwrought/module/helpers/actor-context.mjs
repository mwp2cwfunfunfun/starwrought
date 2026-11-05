/**
 * The actor sheets' shared context: the header's live state and the tooltips, as the templates
 * want them. Used by the character sheet, the adversary sheet and the party sheet (the roster
 * borrows the Vigor track, the Wound pips and the Wind tooltip), which is why they live here and
 * not in any one sheet's module: through 0.10.1 they were exports of apps/actor-sheet.mjs, and
 * two sheets imported the character sheet's module to render. Every function takes the Actor
 * and returns plain data; none renders, none writes.
 */

import * as SW from "../config.mjs";
import { chassisByName } from "./content.mjs";


/**
 * The six actions as pips, one state each: `free` (yours to spend now), `reserved` (spoken for by
 * a Prepared Maneuver: one action spent, the rest held until the next Opportunity), `spent`. The
 * one computation behind the sheet's pips and the combat tracker's (0.10.1; through 0.10.0 the
 * tracker lit a pip only while free, so a reserved action looked spent there), so the two can
 * never disagree about a Prepared Maneuver. A creature with more actions than the round's count
 * (a correction by hand) gets a slot per action, never fewer than the round's.
 * @param {Actor} actor
 * @returns {{perRound: number, free: number, reserved: number, spent: number,
 *            states: Array<"free"|"reserved"|"spent">, legend: string}}
 *   `legend` reads "2 available, 2 reserved, 2 spent", the tooltip both displays carry.
 */
export function actionPips(actor) {
  const sys = actor.system;
  const actions = sys.actions ?? {};
  // The actor's one getter (a character's six plus its adjustment, an adversary's field), at least
  // one slot so a count of 0 still draws a row.
  const perRound = Math.max(1, Number.isFinite(actor.actionsPerRound) ? actor.actionsPerRound : SW.ACTIONS_PER_ROUND);
  const free = Math.max(0, Number(actions.value) || 0);
  const reserved = Math.max(0, Number(actions.reserved) || 0);
  const slots = Math.max(perRound, free + reserved);
  const spent = slots - free - reserved;
  const states = Array.fromRange(slots, 1).map(n => (n <= free ? "free" : n <= free + reserved ? "reserved" : "spent"));
  const legend = game.i18n.format("STARWROUGHT.Actions.legend", { free, reserved, spent });
  return { perRound, free, reserved, spent, states, legend };
}

/**
 * The action economy as the header shows it: six pips a round (more for a creature with more),
 * lit while free, marked while reserved for a Prepared Maneuver, dim once spent (`actionPips`).
 * Only meaningful in an encounter, so `show` is false outside one. Shared by the character and
 * adversary sheets.
 * @param {Actor} actor
 * @returns {object}
 */
export function actionsContext(actor) {
  const sys = actor.system;
  const actions = sys.actions;
  if (!actions || !actor.inEncounter) return { show: false };

  const { perRound, free: value, reserved, states, legend } = actionPips(actor);
  const isTurn = actor.isTurn;

  const pips = states.map((state, i) => {
    const n = i + 1;
    return {
      value: n,
      state,
      glyph: SW.ACTION_GLYPHS[n] ?? "●",
      tooltip: state === "reserved"
        ? game.i18n.format("STARWROUGHT.Actions.reserved", { n: reserved })
        : game.i18n.format("STARWROUGHT.Actions.setTo", { n })
    };
  });

  const preparing = actions.preparing ?? null;
  let preparingLabel = null;
  if (preparing) {
    preparingLabel = preparing.label
      || (preparing.strike ? game.i18n.localize(SW.STRIKE_KINDS[preparing.strike]?.label ?? "") : "")
      || game.i18n.localize(SW.CONDITIONS.preparing.name);
    const cost = SW.ACTION_GLYPHS[Number(preparing.cost)] ?? "";
    if (cost) preparingLabel = `${preparingLabel} ${cost}`;
  }

  return {
    show: true,
    isTurn,
    value,
    reserved,
    perRound,
    pips,
    preparing,
    preparingLabel,
    passGlyph: SW.ACTION_GLYPHS[0],
    // The block's tooltip: whose Opportunity it is, then the legend of the three pip states.
    tooltip: `${isTurn
      ? game.i18n.format("STARWROUGHT.Actions.yourTurn", { left: value, total: perRound })
      : game.i18n.localize("STARWROUGHT.Actions.notYourTurn")} ${legend}`
  };
}

/**
 * The Bind this actor is in, as one line: neutral, Controlling, or Controlled, with the partner's
 * name and both implements. Null when there is none. Shared by both sheets.
 * @param {Actor} actor
 * @returns {object|null}
 */
export function bindContext(actor) {
  const bind = actor.system.bind;
  const state = bind?.state;
  if (!state || !(state in BIND_KEYS)) return null;

  let partner = null;
  try { partner = bind.partnerUuid ? fromUuidSync(bind.partnerUuid) : null; } catch { partner = null; }
  const args = {
    partner: partner?.name ?? game.i18n.localize("STARWROUGHT.Bind.unknownPartner"),
    mine: bind.mine || game.i18n.localize("STARWROUGHT.Bind.unnamedImplement"),
    theirs: bind.theirs || game.i18n.localize("STARWROUGHT.Bind.unnamedImplement")
  };
  const condition = SW.CONDITIONS[BIND_KEYS[state]];
  return {
    state,
    text: game.i18n.format(`STARWROUGHT.Bind.${state}`, args),
    conditionLabel: game.i18n.localize(condition.name),
    img: condition.img
  };
}

/** Bind states, mapped onto the condition each shows on the token. */
const BIND_KEYS = Object.freeze({ neutral: "bound", controlling: "controlling", controlled: "controlled" });

// MILESTONES_PER_LEVEL lived here until 0.7.0; it is SW.MILESTONES_PER_LEVEL now, so the Party
// Sheet's Milestone award and these pips count from one constant (party-sheet-plan.md).

/**
 * The Rules Reference page an effect's row opens: the first of its statuses that names one in
 * SW.CONDITIONS (the Bind's three and the four Exposed, 0.5.1), else null. Shared by both sheets.
 * @param {ActiveEffect} effect
 * @returns {string|null}
 */
export function rulesPageOf(effect) {
  for (const status of effect.statuses ?? []) {
    const page = SW.CONDITIONS[status]?.rulesPage;
    if (page) return page;
  }
  return null;
}

/**
 * Vigor as the bar draws it: the value's share of the track, and Temporary Vigor laid on top as
 * its own segment, capped so the two together never overflow. Shared by both sheets.
 * @param {Actor} actor
 * @returns {object}
 */
export function vigorContext(actor) {
  const vigor = actor.system.vigor ?? {};
  const max = Math.max(0, Number(vigor.max) || 0);
  const value = Math.max(0, Number(vigor.value) || 0);
  const temp = Math.max(0, Number(vigor.temp) || 0);
  const pct = max ? Math.clamp(Math.round((value / max) * 100), 0, 100) : 0;
  const tempPct = max ? Math.clamp(Math.round((temp / max) * 100), 0, 100 - pct) : 0;
  return {
    value, temp, max, pct, tempPct,
    perLevel: vigor.perLevel ?? 0,
    rest: vigor.rest ?? 0
  };
}

/**
 * The Wounds one Zone carries, as pips against its capacity, with the effect in force. Reads the
 * derived fields when the data model provides them and falls back to the rules constants when it
 * does not, so the sheet never shows a blank where a number belongs. Shared by both sheets.
 * @param {Actor} actor
 * @param {string} key  A key of SW.ZONES.
 * @returns {object}
 */
export function zoneWounds(actor, key) {
  const sys = actor.system;
  const z = sys.zones?.[key] ?? {};
  const wounds = Math.max(0, Number(z.wounds) || 0);
  const capacity = Math.max(1,
    Number(z.capacity)
    || Number(sys.woundCapacity?.(key))
    || ((SW.WOUND_CAPACITY[sys.size] ?? SW.WOUND_CAPACITY.medium) + (Number(sys.woundBonus) || 0)));
  const final = z.final ?? (wounds >= capacity);
  const crit = SW.ZONE_CRITICALS[key];
  const effectKey = z.woundEffect ?? (wounds <= 0 ? null : final ? crit.final : crit.first);
  const effect = effectKey ? game.i18n.localize(effectKey) : null;
  const zoneLabel = game.i18n.localize(SW.ZONES[key].label);

  return {
    key,
    wounds,
    capacity,
    final,
    wounded: wounds > 0,
    effect,
    pips: Array.fromRange(capacity, 1).map(n => ({
      filled: n <= wounds,
      final: n === capacity
    })),
    tooltip: wounds > 0
      ? game.i18n.format("STARWROUGHT.Wound.inForce", { zone: zoneLabel, effect })
      : game.i18n.format("STARWROUGHT.Field.woundsHint", { capacity })
  };
}

/* -------------------------------------------- */

/**
 * What the locked fields mean (Mike, 2026-10-01): a player reads Ancestry, Bloodline, Culture,
 * Background and Calling as names, so hovering one shows the chassis's description from the book
 * and, where the choice brought a Root Talent onto the sheet, that Talent's Description and
 * Effect, then the line saying the GM changes it. Ancestry Vigor, Calling Vigor and Ancestry
 * Speed say where their number comes from and what it feeds. HTML, which Foundry's tooltip renders.
 * @param {Actor} actor
 * @returns {Record<string, string>}
 */
/**
 * The creature traits the character's chassis confer (0.14.0; the `_Tree Index`'s Traits column,
 * Mike's): the Ancestry's, Bloodline's and Culture's `system.traits`, read off the chassis by the
 * names the sheet stores, de-duplicated, in that order. Derived at render and never stored, so a
 * change to the sheet reaches every character through Sync content (ruling 173). Empty before the
 * chassis index has loaded.
 * @param {Actor} actor
 * @returns {string[]}
 */
export function traitChips(actor) {
  const details = actor?.system?.details ?? {};
  const out = [];
  const seen = new Set();
  for (const kind of ["ancestry", "bloodline", "culture"]) {
    const chassis = chassisByName(details[kind]?.name ?? "");
    for (const trait of chassis?.system?.traits ?? []) {
      const text = String(trait ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

export function lockedTips(actor) {
  const L = key => game.i18n.localize(key);
  const F = (key, data) => game.i18n.format(key, data);
  const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
  const details = actor.system.details ?? {};
  const talents = actor.items.filter(i => i.type === "talent");
  const foot = `<span class="sw-tip-foot">${esc(L("STARWROUGHT.Sheet.lockedField"))}</span>`;

  const rootFor = (chassis, kind, name) => {
    if (kind === "bloodline") {
      const plain = SW.plainName(name).toLowerCase();
      return talents.find(t => t.system.bloodlineRoot && (SW.plainName(t.name).toLowerCase() === plain)) ?? null;
    }
    const slug = chassis?.system?.constellation || "";
    if (!slug) return null;
    return talents.find(t => t.system.root && !t.system.bloodlineRoot && (t.system.constellation === slug)) ?? null;
  };

  const chassisTip = kind => {
    const name = details[kind]?.name ?? "";
    const chassis = chassisByName(name);
    const kindLabel = L(`STARWROUGHT.Chassis.${kind}`);
    if (!name) return `<span class="sw-tip-title">${esc(kindLabel)}</span>${foot}`;
    const parts = [`<span class="sw-tip-title">${esc(name)}<span class="sw-tip-kind">${esc(kindLabel)}</span></span>`];
    // The description, then the effect, once. A chassis's special ability is the book's summary
    // of its Root Talent, so when the character owns that Talent its own description and effect
    // speak and the summary is left out; without it, the summary stands in.
    const root = rootFor(chassis, kind, name);
    if (chassis) {
      if (chassis.system.description) parts.push(chassis.system.description);
      if (chassis.system.specialAbility && !root) parts.push(chassis.system.specialAbility);
    } else {
      parts.push(`<p>${esc(L("STARWROUGHT.Sheet.lockedUnknown"))}</p>`);
    }
    if (root) {
      // A Bloodline's Root Talent carries the Bloodline's own name; naming it again says nothing.
      const rootName = SW.plainName(root.name);
      if (rootName.toLowerCase() !== String(name).trim().toLowerCase()) {
        parts.push(`<span class="sw-tip-root">${esc(F("STARWROUGHT.Sheet.lockedRoot", { name: rootName }))}</span>`);
      }
      if (root.system.description) parts.push(root.system.description);
      if (root.system.effect) parts.push(root.system.effect);
    }
    parts.push(foot);
    return parts.join("");
  };

  const ancestry = details.ancestry?.name || L("STARWROUGHT.Chassis.ancestry");
  const calling = details.calling?.name || L("STARWROUGHT.Chassis.calling");
  return {
    ancestry: chassisTip("ancestry"),
    bloodline: chassisTip("bloodline"),
    culture: chassisTip("culture"),
    background: chassisTip("background"),
    calling: chassisTip("calling"),
    // PHB v4.11: the Ancestry's number is per level, beside the Endure Bonus; the Calling's is
    // Opening Vigor, added once. The live Endure Bonus is the data model's (`vigor.endureBonus`).
    ancestryVigor: `<p>${esc(F("STARWROUGHT.Sheet.lockedAncestryVigor", {
      name: ancestry, n: details.ancestry?.vigor ?? 0, endure: actor.system.vigor?.endureBonus ?? 0
    }))}</p>${foot}`,
    callingVigor: `<p>${esc(F("STARWROUGHT.Sheet.lockedCallingVigor", { name: calling, n: details.calling?.vigor ?? 0 }))}</p>${foot}`,
    ancestrySpeed: `<p>${esc(F("STARWROUGHT.Sheet.lockedSpeed", { name: ancestry, n: details.ancestry?.speed ?? 0 }))}</p>${foot}`
  };
}

/**
 * The Load Strain field's tooltip (0.6.1; PHB v4.13, Wind, rulings 74 and 79): what Load Strain
 * is, then the Wind line with the numbers: the Wind Threshold (10 + Load Strain) and the Endure
 * Threshold it is rolled with. The field is derived and read-only for everyone, so unlike the
 * locked tips this one is the same for the GM and the player. Two readings since PHB v4.21 (the
 * exemption of v4.12 to v4.15 is gone, ruling 150), one string each: Load Strain carried (the
 * check comes at the end of every round), and no Load Strain at all (no check, but any Load would
 * bring one). The numbers are the data model's (`system.wind`), read defensively for a document
 * not yet through prepareDerivedData. HTML, which Foundry's tooltip renders.
 * @param {Actor} actor
 * @returns {string}
 */
export function windTip(actor) {
  const L = key => game.i18n.localize(key);
  const F = (key, data) => game.i18n.format(key, data);
  const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
  const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const sys = actor.system;
  const strain = num(sys.loadStrain, 0);
  const wind = sys.wind ?? {};
  const threshold = num(wind.threshold, 10 + strain);
  const endure = num(wind.endureThreshold ?? sys.defenses?.endure?.threshold, 10);
  const key = (strain >= 1) ? "STARWROUGHT.Field.windDue" : "STARWROUGHT.Field.windNoLoad";
  return `<p>${esc(L("STARWROUGHT.Field.loadStrainHint"))}</p>`
    + `<p><span class="sw-tip-title">${esc(L("STARWROUGHT.Combat.wind"))}</span>${esc(F(key, { endure, threshold }))}</p>`;
}
