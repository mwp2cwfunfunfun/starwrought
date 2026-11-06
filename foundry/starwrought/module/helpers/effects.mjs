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
import { EFFECT_CARRIER_TYPE, ruleStateKey } from "../rules/engine.mjs";
import { stateOf, RULE_STATES } from "../rules/effects-state.mjs";
import { claimsOf, isArmed } from "../rules/claims.mjs";

// The sheet's action (`armClaimLine`) is the one writer in module/rules/claims.mjs.
export { armClaim as armClaimLine } from "../rules/claims.mjs";

/**
 * The kinds whose rules are effects: something the engine does on a roll, a Condition, a Use or a
 * card. The feature kinds (trait, size, speed, vigor, sense, language, maneuver, talent, choice)
 * describe what owning a Talent makes the character and are not switched; `grant` is spent at
 * creation and `aura` is a ring on the map with its own toggle.
 */
export const EFFECT_KINDS = Object.freeze(["bonus", "prevent", "mark", "reroll", "ignore"]);

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

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
    stateHint: F("STARWROUGHT.Effects.stateHint", {
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
    groupFor(item).rows.push(lineRow(actor, item, rule, { claims }));
  }
  for (const { rule, item, reason } of index.unknown ?? []) {
    if (item?.type !== EFFECT_CARRIER_TYPE) continue;
    groupFor(item).rows.push(lineRow(actor, item, rule, { error: String(reason ?? rule?.error ?? "") }));
  }
  for (const group of groups.values()) group.rows.sort((a, b) => a.line - b.line);
  return [...groups.values()];
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
  const active = groups.flatMap(g => g.rows).filter(r => !r.error && (r.state !== "off"));
  return {
    groups: items,
    custom,
    count: active.length,
    countLabel: active.length === 1 ? L("STARWROUGHT.Effects.activeOne") : F("STARWROUGHT.Effects.active", { n: active.length }),
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
  return lines.length ? { count: lines.length, lines } : null;
}
