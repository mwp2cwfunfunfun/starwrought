/**
 * The rules engine's index (0.9.0; rulings 118 to 120).
 *
 * A Talent, an action or a Constellation Item carries `system.rules`, the parsed rules of its
 * Automation cell. An Actor who owns a hundred Items should not be walked by every hook that wants
 * to know whether any of them carries an aura, so the character and npc data models call
 * `collectRules` first thing in `prepareDerivedData` and keep the answer as `system.rules`:
 *
 *   { all: [{ rule, item }], byKind: { <kind id>: [{ rule, item }] }, unknown: [{ rule, item, reason }] }
 *
 * `all` is every usable rule; `byKind` the same entries filed under the canonical id of their kind
 * (an alias in a stored rule resolves to the id; a kind not in use has no key, so read through
 * `rulesOfKind`); `unknown` what the engine must skip and the sheet may show: an entry the client
 * wrote with `error` when a GM typed a line that did not parse, or a rule whose kind is no longer
 * registered. The item in each entry is the Item document itself, so a hook can reach the
 * carrier's name, its Constellation and its chosen option without a second lookup.
 *
 * ONE HOOK POINT READS THE INDEX: `modifiers` (0.10.0; ruling 124), through `ruleModifiers` below.
 * The check engine calls it once per roll (`baseModifiers` in dice/check/modifiers.mjs, the non-Defense branch) and
 * the character's Defense pass calls it once per Defense (`prepareDefenses` in data/character/defenses.mjs, so a
 * bonus to Guard moves the Threshold on the sheet and the Guard roll alike, and a Defense roll,
 * which rolls the Defense's own folded modifiers, carries it once and never twice). The dispatch
 * is generic: the engine walks the registry and asks each kind that declares `hooks.modifiers`
 * for the modifiers its own rules put on this roll, and knows nothing of any kind's syntax. A
 * second kind that wants the same moment adds no engine code; a NEW moment is still defined with
 * the first kind that needs it (ruling 119 stands). The framework was built empty by instruction
 * (Mike, 2026-10-03: "do NOT survey the talents yet or build ANY of the automation hooks. just
 * build the framework"); the `bonus` kind, for Humanity, is the first to read what this module
 * files, and the aura for Torchbearer is next.
 *
 * CHARACTER EFFECTS (0.16.0; the sheet's Effects panel, in the spirit of Fantasy Grounds' Character
 * Effects, Mike's ask). Two additions, both read here and written nowhere in this file: a STATE
 * per rule line on its owner (`flags.starwrought.rules.state.<carrier>:<line>`, `"skip"` or
 * `"off"`, absent meaning on), applied by `rulesOfKind` so an Off line reaches no hook point and
 * a Skip line is dropped by the dispatchers once and then cleared through a `per: "state"` mark;
 * and CUSTOM EFFECTS, the rows of a character's `system.effects`, each indexed by `collectRules`
 * through a pseudo-Item (`effectCarrier`) so every kind reads them as a Talent's lines, a one-roll
 * effect spent through a `per: "effect"` mark. The marks are written by `writeRuleMarks`
 * (module/rules/scene.mjs) where the callers already write FIRST and ONCE; the state and the rows
 * are written by module/rules/effects-state.mjs.
 *
 * Pure over the documents: no writes, no Foundry globals at module scope, so `assets/test_rules.mjs`
 * drives it with a plain `{ items: [...] }` from Node.
 */

import { KINDS, kindOf } from "./kinds/index.mjs";
import { flagKey, ruleCarrierKey } from "../config.mjs";

/**
 * The Item types that may carry rules. A Constellation Item is included now, before any carries
 * one, so that a rule authored on a Constellation one day (a Flare effect, say) is collected by the
 * same pass without a second edit here. Equipment is not: a weapon's traits are read by the weapon
 * trait parser in the Item model, and a sword with an Automation cell is a design the book does
 * not have.
 */
export const RULE_ITEM_TYPES = Object.freeze(["talent", "action", "constellation"]);

/**
 * CHARACTER EFFECTS (0.16.0): the pseudo-Item type of a custom effect's carrier. A character's
 * `system.effects` rows (a label, a line or two in the grammar, a duration) are indexed by
 * `collectRules` as if each were a Talent with that cell, through `effectCarrier` below, so every
 * hook point reads them as it reads a Talent's lines and no kind learns what a custom effect is.
 */
export const EFFECT_CARRIER_TYPE = "effect";

/** The three durations a custom effect may have (the `duration` field of a `system.effects` row). */
export const EFFECT_DURATIONS = Object.freeze(["always", "roll", "encounter"]);

/**
 * The carrier of one custom effect: the shape a kind's hook reads off a Talent (`id`, `name`,
 * `type`, `system.rules`, and the two fields the `prevent` and `reroll` kinds look at, `reaction`
 * and `glyph`, both the passive answer), with the row itself under `effect`. Its id is
 * `effect:<row id>`, which no Item id can be, so a rule's `source`, its FIRST/ONCE mark and its
 * state key are its own. Pure.
 * @param {{id: string, label?: string, text?: string, duration?: string, rules?: object[]}} effect
 * @returns {object}
 */
export function effectCarrier(effect) {
  const id = String(effect?.id ?? "");
  return {
    id: `effect:${id}`,
    name: String(effect?.label ?? "").trim() || "Custom effect",
    type: EFFECT_CARRIER_TYPE,
    effect: { id, label: effect?.label ?? "", text: effect?.text ?? "", duration: effect?.duration ?? "always" },
    system: { rules: Array.isArray(effect?.rules) ? effect.rules : [], automation: effect?.text ?? "", reaction: false, glyph: "", cost: "passive" }
  };
}

/**
 * The state key of one rule line on its carrier (0.16.0): `<carrier id>:<line>`, dots replaced,
 * since the key is a path under `flags.starwrought.rules.state`. The same shape the FIRST/ONCE
 * marks use, so a line is one thing wherever the flags name it.
 * @param {object} item  The carrier (an Item or an effect carrier).
 * @param {object} rule  The stored rule.
 * @returns {string}
 */
export function ruleStateKey(item, rule) {
  return flagKey(`${ruleCarrierKey(item)}:${rule?.line ?? 0}`);
}

/**
 * The state of every rule line on an actor, by state key (0.16.0): `"skip"` or `"off"`; a line
 * absent from the map is on. Read off `flags.starwrought.rules.state`; written by
 * module/rules/effects-state.mjs (the sheet's switch) and cleared by `writeRuleMarks` (a skip
 * spent). A plain object in a test, so the engine reads it the same from Node.
 * @param {object} actor
 * @returns {Object<string, string>}
 */
export function ruleStates(actor) {
  const state = actor?.flags?.starwrought?.rules?.state;
  return (state && (typeof state === "object")) ? state : {};
}

/**
 * @typedef {object} RuleEntry
 * @property {object} rule   An entry of the Item's `system.rules`.
 * @property {object} item   The Item that carries it (or an effect carrier, `effectCarrier`).
 * @property {string} [reason]  On an `unknown` entry: why the engine skips it.
 * @property {boolean} [skip]   From `rulesOfKind`: the line's state is Skip (0.16.0): the next
 *                              roll it would touch goes without it, then the state clears.
 */

/**
 * Collect and file every rule on an Actor's Items. `actor.items` may be Foundry's Collection
 * (iterable over its documents) or a plain array; an Item of another type, an Item whose
 * `system.rules` is not an array and an entry that is not an object are passed over without
 * comment, since a half-migrated world is not an error the engine should shout about on every
 * prepare.
 * @param {{items?: Iterable<object>}} actor
 * @returns {{all: RuleEntry[], byKind: Object<string, RuleEntry[]>, unknown: RuleEntry[]}}
 */
export function collectRules(actor) {
  const all = [];
  const unknown = [];
  // A null-prototype index, so a kind id that happens to be an Object.prototype name
  // ("constructor" passes KIND_WORD) files its rules instead of landing on a function (review).
  const byKind = Object.create(null);

  // The carriers: every Item of a rule-bearing type, then (0.16.0) a carrier per custom effect on
  // the character's `system.effects`, each read as a Talent with that cell would be.
  const carriers = [];
  for (const item of actor?.items ?? []) {
    if (RULE_ITEM_TYPES.includes(item?.type)) carriers.push(item);
  }
  const effects = actor?.system?.effects;
  if (Array.isArray(effects)) {
    for (const effect of effects) {
      if (effect && (typeof effect === "object") && effect.id) carriers.push(effectCarrier(effect));
    }
  }

  for (const item of carriers) {
    const rules = item.system?.rules;
    if (!Array.isArray(rules)) continue;

    for (const rule of rules) {
      if (!rule || (typeof rule !== "object")) continue;
      // A line the client could not parse: saved with its message so the sheet can show it, and
      // skipped here so no hook ever sees half a rule (ruling 118).
      if (rule.error) {
        unknown.push({ rule, item, reason: String(rule.error) });
        continue;
      }
      const kind = kindOf(rule.kind);
      if (!kind) {
        unknown.push({ rule, item, reason: `unknown rule kind "${rule.kind ?? ""}"` });
        continue;
      }
      const entry = { rule, item };
      all.push(entry);
      (byKind[kind.id] ??= []).push(entry);
    }
  }

  return { all, byKind, unknown };
}

/**
 * The usable rules of one kind on an Actor, by id or alias. Reads the index the data model
 * prepared when there is one (`actor.system.rules.byKind`), else collects on the spot, so the
 * answer is the same from a prepared document and from a plain object in a test. Always an array,
 * so a hook can iterate without a guard; `SwActor#rulesOfKind` is this with `this`.
 *
 * THE STATE SWITCH (0.16.0; Fantasy Grounds' Active State, Mike's ask): each line has a state on
 * its owner, On, Skip or Off (`ruleStates`). An Off line is dropped here, so no hook point ever
 * sees it; a Skip line comes back with `skip: true`, and the dispatchers below drop what it would
 * have contributed and ask the caller to clear the state once the roll resolves. The index itself
 * holds every line (the sheet lists them all); the filter is at the one reading every hook uses.
 * @param {object} actor
 * @param {string} kind
 * @returns {RuleEntry[]}
 */
export function rulesOfKind(actor, kind) {
  const id = kindOf(kind)?.id ?? String(kind ?? "").trim().toLowerCase();
  if (!id) return [];
  const prepared = actor?.system?.rules?.byKind;
  const byKind = (prepared && (typeof prepared === "object")) ? prepared : collectRules(actor).byKind;
  const entries = Object.hasOwn(byKind, id) ? byKind[id] : [];
  const states = ruleStates(actor);
  if (!Object.keys(states).length) return entries;
  const out = [];
  for (const entry of entries) {
    const state = states[ruleStateKey(entry.item, entry.rule)];
    if (state === "off") continue;
    out.push(state === "skip" ? { ...entry, skip: true } : entry);
  }
  return out;
}

/* -------------------------------------------- */
/*  Tracing an entry's contribution (0.16.0)    */
/* -------------------------------------------- */

/**
 * Does the dispatcher need to know which entry a hook's answer came from? Yes for a Skip line
 * (its answer is dropped and its state cleared) and for a custom effect that lasts one roll (its
 * answer is applied and the effect removed). A kind's hook takes a list of entries and returns a
 * flat list of answers with no pointer back, and the kinds are not changed for this (they come one
 * at a time, with Mike); so when any entry on this actor needs tracing the dispatcher calls the
 * hook ONCE PER ENTRY and reads the answer by the call, and otherwise once with every entry as
 * before. The kinds' hooks are independent per entry (each loops its entries and answers for each
 * alone), which is what makes the two calls equal. Other tokens' entries are traced too: the mark
 * then names their owner, and `writeRuleMarks` writes it there.
 */
function needsTrace(entry) {
  return (entry?.skip === true) || (entry?.item?.effect?.duration === "roll");
}

/**
 * The marks an entry's answer asks for beyond the kind's own: a Skip line's state cleared
 * (`per: "state"`), a one-roll custom effect spent (`per: "effect"`), each naming the owner when
 * the entry is another token's.
 */
function traceMarks(entry, actor) {
  const marks = [];
  const owner = (entry.owner && (entry.owner !== actor) && entry.owner.uuid) ? { owner: String(entry.owner.uuid) } : {};
  if (entry.skip === true) marks.push({ key: ruleStateKey(entry.item, entry.rule), per: "state", ...owner });
  if (entry.item?.effect?.duration === "roll") marks.push({ key: String(entry.item.effect.id ?? ""), per: "effect", ...owner });
  return marks;
}

/** Push a mark once: two lines of one Skip carrier, or two answers of one line, ask for one write. */
function addMark(marks, mark) {
  if (!mark?.key || !mark?.per) return;
  if (marks.some(m => (m.key === mark.key) && (m.per === mark.per) && (m.owner === mark.owner))) return;
  marks.push(mark);
}

/**
 * Call a kind's hook for the entries, by the call shape `needsTrace` wants: one call with every
 * entry when none is traced, else one per entry. Returns `[{ entry, result, touched }]`: `entry`
 * null for the untraced batch; `result` what to take; `touched` whether the entry's rule reached
 * this roll at all, which for a traced entry under a `momentOnly` ask is read with the half-split
 * lifted (a static Skip line on a Defense roll was dropped by the sheet's pass and must still clear
 * here; a one-roll DEF effect folded into the Threshold must still be spent by the Defense roll),
 * while `result` keeps the split so nothing is counted twice. A hook that throws is reported once
 * and contributes nothing (a roll never dies over a rule).
 */
function callHook(kind, point, hook, entries, context, actor) {
  const run = (batch, ctx) => {
    try {
      const result = hook(batch, ctx, actor);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`STARWROUGHT | the "${kind.id}" kind's ${point} hook failed:`, error);
      return null;
    }
  };
  if (!entries.some(needsTrace)) {
    const result = run(entries, context);
    return result ? [{ entry: null, result, touched: result.length > 0 }] : [];
  }
  const out = [];
  for (const entry of entries) {
    const result = run([entry], context);
    if (!result) continue;
    let touched = result.length > 0;
    if (needsTrace(entry) && context?.momentOnly && !touched) {
      const whole = run([entry], { ...context, momentOnly: false, staticOnly: false });
      touched = !!whole && (whole.length > 0);
    }
    out.push({ entry, result: entry.skip === true ? [] : result, touched });
  }
  return out;
}

/* -------------------------------------------- */
/*  The `modifiers` hook point (0.10.0)         */
/* -------------------------------------------- */

/**
 * @typedef {object} RuleModifier
 * @property {string} label      The card's line ("Humanity").
 * @property {number} value      Signed, never 0.
 * @property {string} [type]     situation | condition | gear; untyped when absent.
 * @property {boolean} [offer]   True: offered unticked in the roll dialog rather than applied.
 * @property {string} [key]      On an offer, the checkbox's name; unique per offer.
 * @property {string} [hint]     On an offer, the tooltip.
 */

/**
 * @typedef {object} RollContext
 * @property {string} kind              "check" | "attack" | "defense" | "initiative".
 * @property {string} slug              The Constellation slug supplying the Proficiency Bonus ("" when none).
 * @property {object|null} item         The Item behind the roll (a Maneuver, a weapon, a Talent), when there is one.
 * @property {string} [rank]            The roll's own rank, Handling included (`IF(Rank=Untrained)` reads it; 0.13.0).
 * @property {{threat: string, melee: boolean, traits: string[]}|null} [threat]  The Threat a Defense answers
 *                                      in the attack flow (`AGAINST`) with the attack's traits (`IF(Trait=...)`,
 *                                      0.14.0), null when the roll answers nothing or nobody knows.
 * @property {object|null} [scene]      Where the tokens stand (`FOR`, `WHILE`, `SEEN`): { token, tokens: [{ actor,
 *                                      token }], relation(a, b), gap(a, b), sees(a, b) }, built by
 *                                      module/rules/scene.mjs on a client with a canvas, or a fake in a test;
 *                                      null when unknown.
 * @property {{combat: string|null, round: number}|null} [encounter]  The Combat and round (`FIRST`, `ONCE`).
 * @property {{actor: object|null, uuid: string|null, tokenUuid: string|null, name: string}|null} [other]
 *                                      The roll's other party (0.15.0, `MARKED`): the attacker a Defense
 *                                      answers, the defender a Strike's pairing resolves against, the roller
 *                                      whose check reads this Threshold; null when nobody is known.
 * @property {boolean} [staticOnly]     Answer only the rules that need none of the above (the sheet's
 *                                      Defense pass, which has no token and no Threat).
 * @property {boolean} [momentOnly]     Answer only the rules that do (a Defense roll or a Threshold read in
 *                                      the attack flow, whose static rules the sheet already folded in).
 * @property {boolean} [pairingOnly]    Answer only the rules about the other party (a Strike's pairing as it
 *                                      resolves; the blind die had everything else).
 * @property {boolean} [read]           A Threshold read with no dialog: a claim applies only when armed.
 */

/**
 * The modifiers every registered kind's rules put on one roll, in two lists: `applied` goes on
 * the roll as the sheet's own terms do, `offered` is shown unticked in the roll dialog for the
 * player to claim (the Load Strain Climb-or-Swim precedent, PHB v4.11, ruling R2; `previewTotal`
 * ignores offers). A kind takes part by declaring `hooks.modifiers(entries, context, actor)`,
 * where `entries` are its own rules on this actor from `rulesOfKind`, and returns RuleModifiers.
 *
 * The engine's whole knowledge of a kind at this moment is in this function: a kind without the
 * hook is skipped, a kind with no rules on this actor is not asked, a hook that throws is reported
 * once to the console and contributes nothing (a roll never dies over a rule), a modifier without
 * a numeric non-zero `value` is dropped, and an offer without a `key` gets a stable one of the
 * engine's making (`<kind>-<n>`, counting that kind's offers on this roll; a key two offers share
 * is suffixed, so the dialog's checkboxes never collide). Typed stacking is not done here: the
 * caller's `SW.resolveModifiers` pass treats what comes back as it treats every other term.
 * Since 0.13.0 the entries handed to a kind are the actor's own rules AND the rules of the other
 * tokens on the scene whose `FOR` names someone other than the owner (Torchbearer's `FOR(allies,
 * 15ft)` on an ally's Defense), each entry carrying `owner` and `ownerToken` (the actor's own carry
 * the actor and `context.scene?.token`), when the caller gives a `scene`; and a modifier may carry
 * `mark: { key, per }`, a FIRST or ONCE the recipient should remember once the roll resolves, which
 * the dispatcher lifts into `marks` for the caller to write (module/rules/scene.mjs,
 * `writeRuleMarks`); a preview never writes one.
 * @param {object} actor
 * @param {RollContext} context
 * @returns {{applied: RuleModifier[], offered: RuleModifier[], marks: Array<{key: string, per: string}>}}
 */
export function ruleModifiers(actor, context = {}) {
  const applied = [];
  const offered = [];
  const marks = [];
  const keys = new Set();
  const scene = context?.scene ?? null;

  for (const kind of KINDS.values()) {
    const hook = kind.hooks?.modifiers;
    if (typeof hook !== "function") continue;
    const entries = rulesOfKind(actor, kind.id).map(e => ({ ...e, owner: actor, ownerToken: scene?.token ?? null }));
    // Other tokens' rules that reach this actor (0.13.0): a FOR naming anyone but the owner. The
    // relation and the range are the kind's to check; the engine only knows the operator's shape.
    if (scene?.tokens) {
      for (const other of scene.tokens) {
        if (!other?.actor || (other.actor === actor) || (other.token && scene.token && (other.token.id === scene.token.id))) continue;
        for (const e of rulesOfKind(other.actor, kind.id)) {
          const who = e.rule?.for?.who;
          if (who && (who !== "self")) entries.push({ ...e, owner: other.actor, ownerToken: other.token ?? null });
        }
      }
    }
    if (!entries.length) continue;

    let offers = 0;
    // One call, or one per entry when a Skip line or a one-roll effect must be traced (0.16.0,
    // `callHook`): a traced entry whose rule reached this roll asks for its marks, and a Skip's
    // answer is already dropped.
    for (const { entry, result, touched } of callHook(kind, "modifiers", hook, entries, context, actor)) {
      const extra = (entry && touched) ? traceMarks(entry, actor) : [];
      // A one-roll effect's mark rides on its offer when the kind gave none, so a ticked box
      // spends it as a claim's would; a Skip's state clears whether or not a box is ticked.
      for (const m of extra) {
        if ((m.per === "state") || !result.some(mod => mod?.offer === true)) addMark(marks, m);
      }
      for (const mod of result) {
        if (!mod || (typeof mod !== "object")) continue;
        const value = (typeof mod.value === "string") ? Number(mod.value.trim() || NaN) : mod.value;
        if ((typeof value !== "number") || !Number.isFinite(value) || (value === 0)) continue;
        const clean = { ...mod, value, label: String(mod.label ?? kind.id) };
        let validMark = (clean.mark && (typeof clean.mark === "object") && clean.mark.key && clean.mark.per)
          ? { key: String(clean.mark.key), per: String(clean.mark.per) } : null;
        delete clean.mark;
        if (mod.offer === true) {
          let key = String(mod.key ?? "") || `${kind.id}-${offers}`;
          offers += 1;
          if (keys.has(key)) {
            let n = 2;
            while (keys.has(`${key}-${n}`)) n += 1;
            key = `${key}-${n}`;
          }
          keys.add(key);
          // An offer keeps its marks for the dialog (0.15.0): an armed claim is spent only when the
          // player leaves its box ticked, so the dialog, not the engine, files them. BOTH ride: the
          // kind's own (the claim's spend) and the traced one-roll effect's, since a ticked claim on
          // a one-roll custom effect spends the claim and the effect alike (0.18.1; through 0.18.0
          // the effect's mark was dropped whenever the kind gave one, and the row never left).
          const offerMarks = [...(validMark ? [validMark] : []), ...extra.filter(m => m.per === "effect").map(m => ({ key: m.key, per: m.per }))];
          offered.push({
            ...clean, offer: true, key, hint: String(mod.hint ?? ""), ticked: mod.ticked === true,
            ...(offerMarks.length ? { mark: offerMarks[0], marks: offerMarks } : {})
          });
        } else {
          if (validMark) addMark(marks, validMark);
          delete clean.offer;
          delete clean.ticked;
          applied.push(clean);
        }
      }
    }
  }

  return { applied, offered, marks };
}

/* -------------------------------------------- */
/*  The `prevent` hook point (0.13.0)           */
/* -------------------------------------------- */

/**
 * @typedef {object} Preventer
 * @property {object} item           The Talent carrying the rule.
 * @property {object} owner          Whose Talent it is (the recipient for their own).
 * @property {object|null} ownerToken
 * @property {boolean} reaction      The carrier is a ↺ Talent: offered as that Reaction, not applied.
 * @property {{key: string, per: string}|null} mark  A FIRST or ONCE to remember on the recipient.
 */

/**
 * The rules that would stop an effect landing on an actor now (the `prevent` hook point, defined
 * with the `prevent` kind). Triggered in category (../README.md): the hook itself answers with
 * data and writes nothing, and the caller that asked, in module/rules/prevent.mjs, is the one
 * client that acts on the answer (refusing the Condition write and posting the card, or offering
 * the Expose button). The dispatch is `ruleModifiers`' twin: every kind with `hooks.prevent`, its
 * own rules and the other tokens' FOR rules, try/catch, the answer validated.
 * @param {object} actor
 * @param {{effect: string, threat?: object|null, scene?: object|null, encounter?: object|null}} context
 * @returns {Preventer[]}
 */
export function rulePreventers(actor, context = {}) {
  const out = [];
  const skipped = [];
  const scene = context?.scene ?? null;
  for (const kind of KINDS.values()) {
    const hook = kind.hooks?.prevent;
    if (typeof hook !== "function") continue;
    const entries = rulesOfKind(actor, kind.id).map(e => ({ ...e, owner: actor, ownerToken: scene?.token ?? null }));
    if (scene?.tokens) {
      for (const other of scene.tokens) {
        if (!other?.actor || (other.actor === actor) || (other.token && scene.token && (other.token.id === scene.token.id))) continue;
        for (const e of rulesOfKind(other.actor, kind.id)) {
          const who = e.rule?.for?.who;
          if (who && (who !== "self")) entries.push({ ...e, owner: other.actor, ownerToken: other.token ?? null });
        }
      }
    }
    if (!entries.length) continue;
    for (const { entry, result, touched } of callHook(kind, "prevent", hook, entries, context, actor)) {
      // A Skip line that would have prevented this effect is dropped and asks to clear (0.16.0).
      // The answer is a list of preventers with no slot for a mark of nobody's, so the marks ride
      // on the returned array as `marks`, for the one client that acts (module/rules/prevent.mjs)
      // to write beside the preventer's own. A one-roll custom effect is never a preventer's
      // concern here: it is spent by a roll, and a prevention is not one.
      if (entry && touched && (entry.skip === true)) {
        for (const m of traceMarks(entry, actor)) {
          if (m.per === "state") addMark(skipped, m);
        }
      }
      for (const p of result) {
        if (!p || (typeof p !== "object") || !p.item) continue;
        out.push({
          item: p.item, owner: p.owner ?? actor, ownerToken: p.ownerToken ?? null,
          reaction: p.reaction === true,
          mark: (p.mark && p.mark.key && p.mark.per) ? { key: String(p.mark.key), per: String(p.mark.per) } : null
        });
      }
    }
  }
  out.marks = skipped;
  return out;
}

/* -------------------------------------------- */
/*  The `use` hook point (0.15.0)               */
/* -------------------------------------------- */

/**
 * @typedef {object} RuleUse
 * @property {object} item            The Talent used.
 * @property {object} [write]         An update to apply to the owner (`{ [path]: value }`).
 * @property {string} [say]           A line for the card.
 * @property {string} [refuse]        Why nothing happens (a notice; nothing is written or paid).
 */

/**
 * What the kinds do when the owner USES a Talent (the `use` hook point, defined with the `mark`
 * kind; ruling 176). Triggered in category (../README.md): the hook answers with data, and the one
 * client that used the Talent (its owner's, in `SwItem#use`) pays the cost, applies the writes and
 * posts the card. Only the rules ON THE USED ITEM are handed to a kind: a Talent's use is its
 * own business, never another Talent's. The dispatch is `ruleModifiers`' twin: every kind with
 * `hooks.use`, try/catch, the answer validated.
 * @param {object} actor
 * @param {object} item
 * @param {{target?: object|null, encounter?: object|null}} context
 * @returns {RuleUse[]}
 */
/**
 * Does this Item carry a rule of a kind that acts when the Item is used (`mark`)? The sheet shows
 * the Use control for it even when the Talent's name carries no cost glyph (a row whose Effect
 * says "You gain the Oathbound ❶ Maneuver" with a plain name pays nothing and still marks).
 * @param {object} item
 * @returns {boolean}
 */
export function usableByRule(item) {
  const rules = item?.system?.rules;
  if (!Array.isArray(rules)) return false;
  return rules.some(r => r?.kind && (typeof kindOf(r.kind)?.hooks?.use === "function"));
}

export function ruleUses(actor, item, context = {}) {
  const out = [];
  if (!actor || !item) return out;
  for (const kind of KINDS.values()) {
    const hook = kind.hooks?.use;
    if (typeof hook !== "function") continue;
    // An Off line is already gone (`rulesOfKind`); a Skip line is read as On here, since a Use is
    // deliberate and a custom effect's carrier is no Item to use (0.16.0).
    const entries = rulesOfKind(actor, kind.id).filter(e => (e?.item === item) && (e.item?.type !== EFFECT_CARRIER_TYPE)).map(e => ({ ...e, owner: actor, skip: false }));
    if (!entries.length) continue;
    let result;
    try {
      result = hook(entries, { ...context, item }, actor);
    } catch (error) {
      console.error(`STARWROUGHT | the "${kind.id}" kind's use hook failed:`, error);
      continue;
    }
    if (!Array.isArray(result)) continue;
    for (const u of result) {
      if (!u || (typeof u !== "object") || !u.item) continue;
      const write = (u.write && (typeof u.write === "object") && !Array.isArray(u.write)) ? u.write : null;
      out.push({ item: u.item, write, say: u.say ? String(u.say) : "", refuse: u.refuse ? String(u.refuse) : "" });
    }
  }
  return out;
}

/* -------------------------------------------- */
/*  The `card` hook point (0.15.0)              */
/* -------------------------------------------- */

/**
 * @typedef {object} RuleCardOffer
 * @property {object} item      The Talent offering.
 * @property {string} label     The button's text ("Quick Tongue ❶↺: reroll").
 * @property {string} action    The button's `data-action`, which the chat dispatch knows ("ruleReroll").
 */

/**
 * What the kinds offer on a posted card of the actor's roll (the `card` hook point, defined with
 * the `reroll` kind; ruling 177). Triggered in category: the hook answers with data, the chat
 * render pass (documents/chat.mjs) draws the buttons for the owner or the GM, and the presser's
 * client acts (documents/cards/reroll.mjs). The context is the card's flags, so a reload rebuilds
 * the same buttons from the same record.
 * @param {object} actor
 * @param {object} flags  The card's `flags.starwrought`.
 * @param {{encounter?: object|null}} [extra]
 * @returns {RuleCardOffer[]}
 */
export function ruleCardOffers(actor, flags, extra = {}) {
  const out = [];
  if (!actor || !flags) return out;
  for (const kind of KINDS.values()) {
    const hook = kind.hooks?.card;
    if (typeof hook !== "function") continue;
    // As in `ruleUses`: Off dropped, Skip read as On (a button is pressed on purpose), and a custom
    // effect's carrier offers no button, having no Item to pay or to name on the card (0.16.0).
    const entries = rulesOfKind(actor, kind.id).filter(e => e.item?.type !== EFFECT_CARRIER_TYPE).map(e => ({ ...e, owner: actor, skip: false }));
    if (!entries.length) continue;
    let result;
    try {
      result = hook(entries, { ...flags, ...extra }, actor);
    } catch (error) {
      console.error(`STARWROUGHT | the "${kind.id}" kind's card hook failed:`, error);
      continue;
    }
    if (!Array.isArray(result)) continue;
    for (const o of result) {
      if (!o || (typeof o !== "object") || !o.item || !o.action) continue;
      out.push({ item: o.item, label: String(o.label ?? o.item.name ?? kind.id), action: String(o.action) });
    }
  }
  return out;
}
