/**
 * CHARACTER EFFECTS (0.16.0): the sheet's and the tracker's view of the rule lines a character
 * carries that act in play, in the spirit of Fantasy Grounds' Character Effects (Mike's ask). The
 * Effects panel on the Effects tab (templates/actor/effects.hbs; on the Overview through 0.16.0)
 * lists every effect line grouped
 * by the Talent, Maneuver or Constellation that carries it, each with its As read summary and its
 * state switch (On, Skip, Off; module/rules/effects-state.mjs), then the custom effects, each a
 * row the owner edits with its own lines under it; the combat tracker shows the count as a badge
 * with the lines as its tooltip (module/apps/combat-tracker.mjs). Every function takes the Actor
 * and returns plain data; none renders, none writes. A claim line (a `bonus` with `CLAIM(...)`)
 * has no state switch, since the player's decision is the claim itself, and its row carries an
 * "Apply to next roll" button instead (0.17.0), which arms the carrier's claims exactly as the pin
 * on the Talent's row does: `armClaim` in module/rules/claims.mjs, the one writer, for an Item or
 * for a custom effect's carrier (`effect:<row id>`) alike since 0.18.1.
 */

import * as SW from "../config.mjs";
import { summarize } from "../rules/grammar.mjs";
import { EFFECT_CARRIER_TYPE, ruleStateKey, givenResults, isConditionCarrier } from "../rules/engine.mjs";
import { pendingRule, pendingWindowWords, appliesNow, usedEffects, usedLive } from "../rules/given.mjs";
import { stateOf, RULE_STATES, appliedOf } from "../rules/effects-state.mjs";
import { untilWords } from "../rules/operators.mjs";
import { claimsOf, isArmed } from "../rules/claims.mjs";
import { conditionTitle, readEffectName } from "../rules/effect-list.mjs";
// What a Condition also counts as (0.33.0), for the lines listed under its row.
import { closeConditions } from "../rules/condition-set.mjs";

// The sheet's action (`armClaimLine`) is the one writer in module/rules/claims.mjs.
export { armClaim as armClaimLine } from "../rules/claims.mjs";

/**
 * The kinds whose rules are effects: something the engine does on a roll, a Condition, a Use or a
 * card. The feature kinds (trait, size, speed, vigor, sense, language, maneuver, talent, choice)
 * describe what owning a Talent makes the character and are not switched; `grant` is spent at
 * creation and `aura` is a ring on the map with its own toggle. Since 0.22.0 `give` (the GIVE
 * lines on a copy of a Maneuver the character owns) and `alter` (a Talent's change to what a
 * Maneuver gives) are switched as any line; a result PENDING on the character is a `give` rule
 * too, on a carrier of its own, and is listed apart without a switch (`givenContext`).
 */
export const EFFECT_KINDS = Object.freeze(["bonus", "prevent", "mark", "reroll", "ignore", "substitute", "give", "alter", "permit", "subordinate", "apply", "cost"]);

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * How a line of Automation reads one ActiveEffect (0.31.0; module/rules/effect-list.mjs), for the
 * tag beside it on a sheet's Effects list: a Condition's own effect by the Condition's name, any
 * other by `EFFECT(<its name>)`. Null for a Zone's Exposed mirror, which is the Zone's own.
 * `unread` when no line can read it as it is named: a name that is a Condition's (reserved, and
 * this effect carries no such status) or one a cell could not write (a comma, a bracket).
 * @param {ActiveEffect|object} effect
 * @returns {{words: string, tip: string, condition?: boolean, unread?: boolean}|null}
 */
export function effectReadAs(effect) {
  const statuses = [...(effect?.statuses ?? [])];
  if ((statuses.length === 1) && Object.hasOwn(SW.CONDITIONS, statuses[0])) {
    const condition = SW.CONDITIONS[statuses[0]];
    if (condition.zone) return null;
    const words = conditionTitle(condition.id).toLowerCase();
    return { words, tip: F("STARWROUGHT.Effects.readAsCondition", { name: words }), condition: true };
  }
  // The same reading the Effects list makes (`namedEffectOf`: glyphs out, then the name's shape),
  // so the tag never says "not read" of an effect a rule matches, nor the reverse.
  try {
    const read = readEffectName(SW.plainName(String(effect?.name ?? "")));
    if (read.condition) return { words: "", tip: F("STARWROUGHT.Effects.readAsReserved", { name: read.name }), unread: true };
    return { words: `EFFECT(${read.name})`, tip: F("STARWROUGHT.Effects.readAs", { name: read.name }) };
  } catch (error) {
    // The reason quotes the effect's own name, and a tooltip is read back as HTML: escaped here.
    return { words: "", tip: F("STARWROUGHT.Effects.readAsNone", { reason: foundry.utils.escapeHTML(String(error?.message ?? "")) }), unread: true };
  }
}

/**
 * The tag an Effect that a Maneuver APPLIED wears on a sheet's Effects list (0.32.0;
 * module/rules/applied.mjs): who put it there, with which Maneuver, and until when. Null for an
 * effect put on by any other means, which has no such record.
 * @param {ActiveEffect|object} effect
 * @returns {{words: string, tip: string}|null}
 */
export function effectAppliedTag(effect) {
  const record = appliedOf(effect);
  if (!record) return null;
  const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
  const until = record.until;
  const window = until
    ? F("STARWROUGHT.Applied.tagWindow", {
      window: esc(untilWords((until.who === "encounter") ? { who: "encounter", n: 0 } : until, {
        giver: record.byName || L("STARWROUGHT.Applied.theGiver"),
        recipient: effect?.parent?.name || L("STARWROUGHT.Applied.theTarget")
      }))
    })
    : L("STARWROUGHT.Applied.tagNoWindow");
  return {
    words: L("STARWROUGHT.Applied.tag"),
    tip: F("STARWROUGHT.Applied.tagHint", { maneuver: esc(record.maneuverName || record.maneuver), giver: esc(record.byName), window })
  };
}

/** The three states as the switch shows them: label, icon and the next state's name for the hint. */
const STATE_LOOK = Object.freeze({
  on: { icon: "fa-toggle-on" },
  skip: { icon: "fa-forward-step" },
  off: { icon: "fa-toggle-off" }
});

/**
 * The claim control of a line (0.17.0), or null for a line with no `CLAIM`: whether the carrier's
 * claims are armed, the button's label and its hint (the pin's own strings, naming every claim
 * text the carrier holds), and the key `armClaimLine` takes.
 * @param {object} actor
 * @param {object} item     The carrier (an Item or an effect carrier).
 * @param {object} rule
 * @param {Map} claims      `claimsOf(actor)`.
 */
function claimControl(actor, item, rule, claims) {
  if (!rule?.claim || !item?.id) return null;
  const held = claims.get(SW.ruleCarrierKey(item));
  const armed = held ? held.armed : isArmed(actor, item.id);
  const texts = (held?.texts ?? [String(rule.claim.text ?? "")]).join("; ");
  return {
    key: String(item.id),
    armed,
    label: L(armed ? "STARWROUGHT.Effects.armed" : "STARWROUGHT.Effects.applyNext"),
    hint: F(armed ? "STARWROUGHT.Sheet.claimArmed" : "STARWROUGHT.Sheet.claimArm", { texts })
  };
}

/**
 * One line's row for the panel: the state, its look, the summary and the tooltip; a claim line
 * (0.17.0) carries `claim` and the template draws the arm button in the switch's place.
 */
function lineRow(actor, item, rule, { error = "", claims = null } = {}) {
  const key = ruleStateKey(item, rule);
  const state = error ? "on" : stateOf(actor, key);
  const next = RULE_STATES[(RULE_STATES.indexOf(state) + 1) % RULE_STATES.length];
  const stateLabel = L(`STARWROUGHT.Effects.state${state[0].toUpperCase()}${state.slice(1)}`);
  return {
    key,
    kind: String(rule?.kind ?? ""),
    line: rule?.line ?? 0,
    text: String(rule?.text ?? ""),
    summary: error ? F("STARWROUGHT.Rules.error", { message: error }) : summarize(rule),
    error: !!error,
    state,
    stateLabel,
    icon: STATE_LOOK[state].icon,
    // A line the roll dialog OFFERS (0.21.0: a USE line's swap, ticked when it is better) reads
    // the three states in its own words; the switch is also the one way to decline it on a roll
    // made with no dialog.
    stateHint: F((rule?.kind === "substitute") ? "STARWROUGHT.Effects.stateHintOffer" : "STARWROUGHT.Effects.stateHint", {
      state: stateLabel,
      next: L(`STARWROUGHT.Effects.state${next[0].toUpperCase()}${next.slice(1)}`)
    }),
    tooltip: F("STARWROUGHT.Rules.lineTooltip", { line: rule?.line ?? 0, text: rule?.text ?? "" }),
    claim: (error || !claims) ? null : claimControl(actor, item, rule, claims)
  };
}

/**
 * The effect lines on an actor, by carrier: the Items' lines first (in the order the Items were
 * added), then the custom effects' (in row order), each carrier with its rows. An error entry on
 * a custom effect is listed under it in red; an Item's errors stay on the Item sheet, as before.
 * @param {Actor} actor
 * @returns {Array<{id: string, name: string, custom: boolean, effect: object|null, rows: object[]}>}
 */
export function effectGroups(actor) {
  const index = actor?.system?.rules;
  if (!index) return [];
  const groups = new Map();
  const groupFor = item => {
    const id = String(item?.id ?? item?.name ?? "");
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: SW.plainName(item?.name ?? "") || L("STARWROUGHT.Effects.unnamed"),
        custom: item?.type === EFFECT_CARRIER_TYPE,
        effect: item?.type === EFFECT_CARRIER_TYPE ? (item.effect ?? null) : null,
        rows: []
      });
    }
    return groups.get(id);
  };
  // The carriers' claims, read once (0.17.0): a claim line's row gets the arm button, not the switch.
  const claims = claimsOf(actor);
  for (const { rule, item } of index.all ?? []) {
    if (!EFFECT_KINDS.includes(rule?.kind)) continue;
    // A result a Maneuver gave this character (0.22.0) is no line of the character's own: it has
    // no switch and is listed apart (`givenContext`).
    if (item?.given) continue;
    // A Condition's own line (0.33.0, ruling 334) has no switch either: the Condition is the
    // switch. Its lines are listed read-only under the Condition's own row (`conditionInfo`).
    if (isConditionCarrier(item)) continue;
    groupFor(item).rows.push(lineRow(actor, item, rule, { claims }));
  }
  for (const { rule, item, reason } of index.unknown ?? []) {
    if ((item?.type !== EFFECT_CARRIER_TYPE) || item.given) continue;
    groupFor(item).rows.push(lineRow(actor, item, rule, { error: String(reason ?? rule?.error ?? "") }));
  }
  for (const group of groups.values()) group.rows.sort((a, b) => a.line - b.line);
  return [...groups.values()];
}

/** A Condition's lines as read, at the value they are counted at: "-2 Condition penalty to Defenses". */
function linesOf(id, value = 1) {
  return (SW.CONDITIONS[id]?.rules ?? []).map(rule => {
    const words = summarize(rule);
    if ((rule.scale !== "N") || !Number.isFinite(rule.value)) return words;
    const n = rule.value * Math.max(1, Number(value) || 1);
    return words.replace(/[+-]N\b/, n > 0 ? `+${n}` : String(n));
  });
}

/** The Bind's three Conditions, each with the state of `system.bind` it mirrors. */
const BIND_STATE = Object.freeze({ bound: "neutral", controlling: "controlling", controlled: "controlled" });

/** The creature's own effect for a Condition, by the Condition's id or its status id; null when it has none on. */
function ownEffectOf(actor, id) {
  const record = SW.CONDITIONS[id];
  const ids = [id, record?.statusId].filter(Boolean);
  const effects = actor?.appliedEffects ?? [...(actor?.effects ?? [])];
  for (const effect of effects) {
    if (effect?.disabled || effect?.isSuppressed) continue;
    if (ids.some(status => effect?.statuses?.has?.(status))) return effect;
  }
  return null;
}

/**
 * WHO `[X]` IS (0.35.1; ruling 364): the name of the creature a Condition on this Actor is about,
 * or "" when nobody is named. Only a Condition whose row's Takes is X has one.
 *
 *  - Bound, Controlled, Controlling: the Bind partner (`system.bind.partnerUuid`), while the
 *    Bind's state is that Condition's. Named as the sheet's Bind line names it
 *    (helpers/actor-context.mjs, `bindContext`). One toggled from the token by hand is no Bind.
 *  - Any other (Wrong-Footed today): whoever put it on with a Maneuver, by the applied record on
 *    the Condition's own effect (`byName`, the name the "Applied" tag shows). One toggled by hand
 *    has no record.
 *
 * @param {Actor} actor
 * @param {string} id  The Condition's id.
 * @param {ActiveEffect|object|null} [effect]  The Condition's own effect, when the caller has it.
 * @returns {string}
 */
export function conditionCreature(actor, id, effect = null) {
  if (!SW.conditionTakesCreature(id)) return "";
  if (Object.hasOwn(BIND_STATE, id)) {
    const bind = actor?.system?.bind;
    if (!bind?.partnerUuid || (bind.state !== BIND_STATE[id])) return "";
    let partner = null;
    try { partner = fromUuidSync(bind.partnerUuid); } catch { partner = null; }
    return String(partner?.name ?? "").trim();
  }
  return String(appliedOf(effect ?? ownEffectOf(actor, id))?.byName ?? "").trim();
}

/**
 * A Condition's two texts as they read ON THIS CREATURE (0.35.1): the row's Effect and its flavor
 * line with every `[X]` filled in with the creature the Condition is about, or "that creature"
 * when nobody is named (Mike). A row whose Takes is not X is returned as typed. Raw text: the
 * caller escapes it.
 * @returns {{effect: string, flavor: string}}
 */
export function conditionTexts(actor, id, effect = null) {
  const texts = { effect: SW.conditionEffect(id), flavor: SW.conditionFlavor(id) };
  if (!SW.conditionTakesCreature(id) || !(SW.hasConditionTextX(texts.effect) || SW.hasConditionTextX(texts.flavor))) return texts;
  // "that creature" (Mike), a key of its own: `Conditions.thatCreature` is the longer phrase the
  // "Counts as ... against" line uses ("the creature that put it on").
  const fill = { x: conditionCreature(actor, id, effect), fallback: L("STARWROUGHT.Conditions.unnamedCreature") };
  return { effect: SW.fillConditionText(texts.effect, fill), flavor: SW.fillConditionText(texts.flavor, fill) };
}

/**
 * What a sheet says of a Condition's own effect (0.33.0): the texts its row of the Conditions
 * workbook gives it (the flavor line, then the Effect; 0.35.0), as the row's tooltip, and under
 * the row, read-only, what the
 * Condition is doing: its own lines at its value, then each Condition it also counts as with that
 * Condition's lines ("Counts as Off-Guard: -2 Situation penalty to Evade; ..."), a Condition held
 * against one creature alone said so. Null for an effect that is no Condition's own. A Condition
 * that is switched off does nothing, and lists nothing.
 * @param {Actor} actor
 * @param {ActiveEffect|object} effect
 * @returns {{description: string, lines: string[]}|null}
 */
export function conditionInfo(actor, effect) {
  const statuses = [...(effect?.statuses ?? [])];
  if (statuses.length !== 1) return null;
  const record = SW.CONDITIONS[statuses[0]];
  if (!record) return null;
  const hintKey = record.builtIn ? `${record.name}Hint` : "";
  const fallback = (hintKey && game.i18n.has?.(hintKey)) ? L(hintKey) : "";
  // The row's flavor line in italics, then its Effect (0.35.0; Mike: the flavor shows in the
  // journal and on the sheet). Each is escaped here, so the only markup is this function's own.
  // `[X]` in either text is the creature this Condition is about (0.35.1): filled in BEFORE the
  // escape, so the name is escaped with the text.
  const esc = text => foundry.utils.escapeHTML(String(text ?? "")).replace(/\n+/g, "<br>");
  const texts = conditionTexts(actor, record.id, effect);
  const effectText = esc(texts.effect || fallback);
  const flavor = esc(texts.flavor);
  const description = flavor ? `<em>${flavor}</em>${effectText ? `<br>${effectText}` : ""}` : effectText;
  const lines = [];
  if (!effect.disabled && !effect.isSuppressed && !record.zone) {
    const value = record.numeric ? (Number(actor?.conditionValue?.(record.id)) || 1) : 1;
    const applied = appliedOf(effect);
    lines.push(...linesOf(record.id, value));
    const set = closeConditions({ direct: [[record.id, { value, by: applied?.by ?? null }]] });
    const said = (id, key, data = {}) => {
      const own = linesOf(id, 1);
      lines.push(F(key, { name: SW.conditionLabel(id), lines: own.length ? `: ${own.join("; ")}` : "", ...data }));
    };
    for (const id of set.held.keys()) if (id !== record.id) said(id, "STARWROUGHT.Conditions.countsAs");
    for (const id of set.against.keys()) {
      said(id, "STARWROUGHT.Conditions.countsAsAgainst", { who: applied?.byName || L("STARWROUGHT.Conditions.thatCreature") });
    }
    if (set.unknown.has(record.id)) lines.push(L("STARWROUGHT.Conditions.againstNobody"));
  }
  return { description, lines };
}

/**
 * The panel's context: the Items' groups, the custom effects with their rows and form indexes,
 * the duration choices, and the count the title and the tracker badge both print (every line not
 * Off; a Skip line counts, since it comes back after one roll).
 * @param {Actor} actor
 * @returns {object}
 */
export function effectsContext(actor) {
  const groups = effectGroups(actor);
  const byCarrier = new Map(groups.filter(g => g.custom).map(g => [g.id, g]));
  const rows = Array.isArray(actor?.system?.effects) ? actor.system.effects : [];
  const custom = rows.map((effect, index) => {
    const group = byCarrier.get(`effect:${effect.id}`);
    return {
      index,
      id: effect.id,
      label: effect.label ?? "",
      text: effect.text ?? "",
      duration: effect.duration ?? "always",
      rows: group?.rows ?? [],
      hasError: (group?.rows ?? []).some(r => r.error)
    };
  });
  const items = groups.filter(g => !g.custom);
  const given = givenContext(actor);
  // A result held over from another encounter is listed, dimmed, and not counted: no roll carries it.
  // A used Effect (0.25.0) is listed with them and counted with neither: it changes no roll.
  const active = groups.flatMap(g => g.rows).filter(r => !r.error && (r.state !== "off")).length + given.filter(g => !g.stale && !g.used).length;
  return {
    groups: items,
    custom,
    // 0.22.0: what Maneuvers have given this character and it has not yet used.
    given,
    canRemoveGiven: !!game.user?.isGM,
    count: active,
    countLabel: active === 1 ? L("STARWROUGHT.Effects.activeOne") : F("STARWROUGHT.Effects.active", { n: active }),
    hasAny: items.length > 0,
    durations: {
      always: L("STARWROUGHT.Effects.durationAlways"),
      roll: L("STARWROUGHT.Effects.durationRoll"),
      encounter: L("STARWROUGHT.Effects.durationEncounter")
    },
    placeholder: L("STARWROUGHT.Effects.textPlaceholder")
  };
}

/**
 * The tracker's badge: how many effect lines are live on the actor and one line each for the
 * tooltip, "<Carrier>: <summary>", a Skip line marked. Null when there is nothing to show.
 * @param {Actor} actor
 * @returns {{count: number, lines: string[]}|null}
 */
export function effectsBadge(actor) {
  const groups = effectGroups(actor);
  const lines = [];
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.error || (row.state === "off")) continue;
      lines.push(`${group.name}: ${row.summary}${row.state === "skip" ? ` ${L("STARWROUGHT.Effects.skipped")}` : ""}`);
    }
  }
  // A pending result (0.22.0) is live until a roll uses it or its window closes; one held over
  // from another encounter is on the sheet for the GM to remove and is not live.
  for (const row of givenContext(actor)) {
    if (!row.stale && !row.used) lines.push(`${row.name}: ${row.summary}, ${row.window}`);
  }
  return lines.length ? { count: lines.length, lines } : null;
}

/**
 * The results pending on a character (0.22.0), for the Effects tab and the tracker's badge: what a
 * Maneuver gave it (Aid's bonus from an ally) and it has not yet used, each with who gave it, what
 * it is a bonus to, and when it ends. Read-only: a result has no switch (it is used by not being
 * declined, and a penalty is not the holder's to strike), and Remove is the GM's. A result of a
 * Combat that is not the one viewed is listed as held over, since no roll will carry it.
 * @param {Actor} actor
 * @returns {Array<{key: string, name: string, summary: string, window: string, stale: boolean, used?: boolean, tooltip: string}>}
 */
export function givenContext(actor) {
  const out = [];
  for (const entry of givenResults(actor)) {
    const rule = pendingRule(entry);
    const stale = !appliesNow(entry, encounterNow());
    out.push({
      key: String(entry.id),
      name: String(entry.label ?? ""),
      summary: summarize(rule),
      window: stale ? L("STARWROUGHT.Given.heldOver") : pendingWindowWords(entry, { giver: entry.byName || undefined, recipient: actor?.name }),
      stale,
      tooltip: F("STARWROUGHT.Given.lineTooltip", { maneuver: entry.maneuverName ?? "", giver: entry.byName ?? "" })
    });
  }
  // 0.25.0, named Effects, step one: what a roll of the character's has just used up ("Aid from
  // Wren (used)"), held until the Opportunity it was left in ends. It is no modifier, so it is
  // listed here and never counted among the lines that act on a roll (`used`).
  for (const record of usedEffects(actor)) {
    const live = usedLive(record, encounterNow());
    out.push({
      key: String(record.id),
      name: String(record.label ?? ""),
      summary: L("STARWROUGHT.Used.summary"),
      window: live ? L("STARWROUGHT.Used.window") : L("STARWROUGHT.Given.heldOver"),
      stale: !live,
      used: true,
      tooltip: F("STARWROUGHT.Used.lineTooltip", { maneuver: record.maneuverName ?? "", giver: record.byName ?? "" })
    });
  }
  return out;
}

/** The viewed Combat, as the rules' encounter context reads it; nothing to read from Node. */
function encounterNow() {
  const combat = globalThis.game?.combat ?? null;
  return { combat: combat?.id ?? null, round: combat?.round ?? 0, combatant: (combat?.started ? combat.combatant?.id : null) ?? null };
}
