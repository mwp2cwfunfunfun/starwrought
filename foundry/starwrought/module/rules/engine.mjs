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
 * Pure over the documents: no writes, no Foundry globals at module scope, so `assets/test_rules.mjs`
 * drives it with a plain `{ items: [...] }` from Node.
 */

import { KINDS, kindOf } from "./kinds/index.mjs";

/**
 * The Item types that may carry rules. A Constellation Item is included now, before any carries
 * one, so that a rule authored on a Constellation one day (a Flare effect, say) is collected by the
 * same pass without a second edit here. Equipment is not: a weapon's traits are read by the weapon
 * trait parser in the Item model, and a sword with an Automation cell is a design the book does
 * not have.
 */
export const RULE_ITEM_TYPES = Object.freeze(["talent", "action", "constellation"]);

/**
 * @typedef {object} RuleEntry
 * @property {object} rule   An entry of the Item's `system.rules`.
 * @property {object} item   The Item that carries it.
 * @property {string} [reason]  On an `unknown` entry: why the engine skips it.
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

  for (const item of actor?.items ?? []) {
    if (!RULE_ITEM_TYPES.includes(item?.type)) continue;
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
 * @param {object} actor
 * @param {string} kind
 * @returns {RuleEntry[]}
 */
export function rulesOfKind(actor, kind) {
  const id = kindOf(kind)?.id ?? String(kind ?? "").trim().toLowerCase();
  if (!id) return [];
  const prepared = actor?.system?.rules?.byKind;
  const byKind = (prepared && (typeof prepared === "object")) ? prepared : collectRules(actor).byKind;
  return Object.hasOwn(byKind, id) ? byKind[id] : [];
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

    let result;
    try {
      result = hook(entries, context, actor);
    } catch (error) {
      console.error(`STARWROUGHT | the "${kind.id}" kind's modifiers hook failed:`, error);
      continue;
    }
    if (!Array.isArray(result)) continue;

    let offers = 0;
    for (const mod of result) {
      if (!mod || (typeof mod !== "object")) continue;
      const value = (typeof mod.value === "string") ? Number(mod.value.trim() || NaN) : mod.value;
      if ((typeof value !== "number") || !Number.isFinite(value) || (value === 0)) continue;
      const clean = { ...mod, value, label: String(mod.label ?? kind.id) };
      const validMark = (clean.mark && (typeof clean.mark === "object") && clean.mark.key && clean.mark.per)
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
        // An offer keeps its mark for the dialog (0.15.0): an armed claim is spent only when the
        // player leaves its box ticked, so the dialog, not the engine, files that mark.
        offered.push({ ...clean, offer: true, key, hint: String(mod.hint ?? ""), ticked: mod.ticked === true, ...(validMark ? { mark: validMark } : {}) });
      } else {
        if (validMark) marks.push(validMark);
        delete clean.offer;
        delete clean.ticked;
        applied.push(clean);
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
    let result;
    try {
      result = hook(entries, context, actor);
    } catch (error) {
      console.error(`STARWROUGHT | the "${kind.id}" kind's prevent hook failed:`, error);
      continue;
    }
    if (!Array.isArray(result)) continue;
    for (const p of result) {
      if (!p || (typeof p !== "object") || !p.item) continue;
      out.push({
        item: p.item, owner: p.owner ?? actor, ownerToken: p.ownerToken ?? null,
        reaction: p.reaction === true,
        mark: (p.mark && p.mark.key && p.mark.per) ? { key: String(p.mark.key), per: String(p.mark.per) } : null
      });
    }
  }
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
    const entries = rulesOfKind(actor, kind.id).filter(e => e?.item === item).map(e => ({ ...e, owner: actor }));
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
    const entries = rulesOfKind(actor, kind.id).map(e => ({ ...e, owner: actor }));
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
