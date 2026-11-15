/**
 * The `subordinate` rule kind (0.25.0; rulings 245 to 251): using this Maneuver performs another
 * Maneuver as part of it. THE SUBORDINATE MANEUVER RULE is Mike's (2026-11-15): "there are many
 * maneuvers that do this... can we make a general 'subordinate maneuver' rule where any time a
 * maneuver says to perform another maneuver as part of it, it is at the original maneuver's listed
 * cost (i.e. costs 0 additional actions) unless otherwise specified?" So the Maneuver named keeps
 * its own check, its own results and its own requirements, and its own cost is never charged: the
 * cost printed on THIS row is the only one paid. The tag word is his.
 *
 * The first row is the Human's Pay It Forward ⓿ (his draft, 2026-11-09): "Requirements You are
 * acting at your own Opportunity and have just finished a check that consumed a beneficial Aid
 * result from another creature. Effect Immediately after that check resolves, Aid one other
 * willing ally as a ⓿ Maneuver. Make the normal Aid check and meet its normal requirements. You
 * cannot target yourself. ... A carried, unconsumed Aid result does not activate this Talent."
 *
 *   [EFFECT SUBORDINATE: <Maneuver>; IF: EFFECT(<name>, used); LIMIT: round | encounter; IF: RANK(...)]
 *
 *   [EFFECT SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter]          Pay It Forward ⓿
 *
 * One descriptor, the Maneuver performed, by the name the action sheets print. `IF: EFFECT(<name>,
 * used)` is the trigger (../effects.mjs; ../given.mjs, the used Effect): a roll of the owner's, at
 * the owner's own Opportunity that is still running, has used up a bonus another creature's
 * Maneuver of that name gave. `LIMIT:` is the row's Frequency, which the owner's `ALTER:
 * <Maneuver>.limit` may replace (Reciprocal Effort; `limitOf`). `IF: RANK(...)` reads the owner's
 * rank. Written on a Maneuver's own row and nowhere else, as `GIVE` and `PERMIT` are.
 *
 * The stored rule: `{ kind: "subordinate", line, text, to: { name, slug, type: "action" | null },
 * used: { name, slug } | null, limit: { per } | null, when }`.
 *
 * TWO HOOKS, because the Maneuver has two doors and one path (ruling 251).
 *
 * `hooks.use(entries, context, actor)`, on the `use` hook point (../engine.mjs, `ruleUses`): "the
 * owner used this Maneuver; what does the kind do?" A refusal (`{ item, refuse }`: nothing is paid
 * and nothing is performed), or `{ item, perform: { slug, name }, marks, say? }`. REFUSED (Mike:
 * "Refuse"): in a fight, when the trigger does not hold, and a second use within the limit. The
 * marks are the limit's, the alteration's (a Skip, a one-roll effect) and the used Effect's own
 * (`per: "effect"`: the Maneuver it triggers spends it); the Item's use hands them to the
 * subordinate's use, which files them when its roll is made, so a roll dialog that is closed has
 * spent nothing (documents/item.mjs). Outside an encounter the Maneuver is performed and nothing
 * is asked or counted.
 *
 * `hooks.card(entries, context, actor)`, on the `card` hook point (`ruleCardOffers`): a button on
 * the card of the roll that used the Effect up, drawn for the roller's owner and the GM. Only a
 * rule with a trigger offers one, since nothing else ties a Maneuver to a card; the card must carry
 * the used result among its modifiers (`given: <maneuver>`, kept by the check card since 0.25.0),
 * the Effect must still be held and the limit unspent. The button's action is `ruleUse`: the chat
 * dispatch uses the offering Item, which is the row's own path through the `use` hook above, so a
 * button that has gone stale can do nothing the row would refuse.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node). It
 * imports ../syntax.mjs, ../operators.mjs and ../given.mjs (all pure) and the config.
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, refuseOutcome, summarizeOperators, readTargetName, limitKey, limitSpent } from "../operators.mjs";
import { limitOf, usedOf, usedLive } from "../given.mjs";
import { plainName, slugify } from "../../config.mjs";

const SHAPE = "SUBORDINATE: <Maneuver>";
const EXAMPLE = "SUBORDINATE: Aid; IF: EFFECT(Aid, used); LIMIT: encounter";

/** The card kinds a roll that uses up a result may post: a check, a Strike or Cast, a Defense roll. */
const ROLL_CARDS = Object.freeze(["check", "attack", "defense"]);

/** The button's icon: one creature handing something to another. */
const ICON = "fa-solid fa-people-arrows";

/** The conditions of a rule as a list, whatever shape `when` was stored in. */
function whensOf(rule) {
  return Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
}

/** Do the rule's rank conditions hold for the owner? One about a roll, a trait or a degree cannot. */
function ranksHold(rule, actor) {
  for (const w of whensOf(rule)) {
    if (w.roll || w.trait || w.outcome || (typeof actor?.system?.proficiency !== "function")) return false;
    if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) return false;
  }
  return true;
}

export default {
  id: "subordinate",
  aliases: [],

  /**
   * @param {string} args      The text after the tag, trimmed (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect`, `resolve`, `itemType` and `itemName` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a subordinate Maneuver is an effect: \`[EFFECT ${EXAMPLE}]\``);
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`a subordinate Maneuver is performed when its Maneuver is used and cannot ride an [AURA ...] block; write it as its own \`[EFFECT ${EXAMPLE}]\``);
    }
    if (context.itemType && (context.itemType !== "action")) {
      throw new RuleSyntaxError("SUBORDINATE is written on the Maneuver's own row: it is the Maneuver that using that row performs as part of itself");
    }
    const e = context.effect;
    const ops = refuseComponents(e.ops, "SUBORDINATE", ["when", "used", "limit"]);
    refuseOutcome(ops);
    for (const w of whensOf(ops)) {
      if (w?.trait) throw new RuleSyntaxError("SUBORDINATE does not take IFT: TRAIT(...)");
      if (w?.roll) throw new RuleSyntaxError("SUBORDINATE acts when the Maneuver is used, before any roll of its own: `IF: RANK(roll ...)` has no roll to read; name a Constellation, as in `IF: RANK(Origin >= expert)`");
    }
    if (e.descriptors.length !== 1) {
      throw new RuleSyntaxError(`a subordinate Maneuver is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${e.descriptors.length} descriptors given, 1 wanted: the Maneuver performed; a row that performs two writes two lines, which is not read yet)`);
    }
    const written = e.descriptors[0];
    const read = readTargetName(written, context.resolve);
    if (!read || !read.slug) throw new RuleSyntaxError(`"${written}" names no Maneuver: SUBORDINATE names the Maneuver performed, as in \`${EXAMPLE}\``);
    if (read.type === "constellation") {
      throw new RuleSyntaxError(`"${read.name}" is a Constellation: SUBORDINATE names the Maneuver performed, as in \`${EXAMPLE}\``);
    }
    if (context.itemName && (slugify(plainName(context.itemName)) === read.slug)) {
      throw new RuleSyntaxError(`${read.name} cannot be its own subordinate: name the Maneuver it performs`);
    }
    return { to: { name: read.name, slug: read.slug, type: read.type }, used: ops.used, limit: ops.limit, when: ops.when };
  },

  /** `performs Aid as part of this Maneuver, at this Maneuver's own cost, once a roll of yours at this Opportunity has used up Aid, once an encounter`. */
  summary(rule) {
    const tail = summarizeOperators({ when: rule?.when, used: rule?.used });
    const limit = rule?.limit ? (rule.limit.per === "round" ? ", once a round" : ", once an encounter") : "";
    return `performs ${rule?.to?.name ?? "a Maneuver"} as part of this Maneuver, at this Maneuver's own cost${tail ? `, ${tail}` : ""}${limit}`;
  },

  hooks: {
    /**
     * The owner used the Maneuver (the header, TWO HOOKS).
     * @param {Array<{rule: object, item: object}>} entries  This kind's rules on the used Item.
     * @param {{item: object, encounter?: object|null, alterations?: object[]}} context
     * @param {object} actor  The owner, who used it.
     * @returns {Array<{item: object, refuse?: string, perform?: {slug: string, name: string}, say?: string, marks?: object[]}>}
     */
    use(entries, context = {}, actor = null) {
      const out = [];
      const encounter = context?.encounter ?? null;
      // In the fight: a started Combat is viewed AND the owner is a fighter in it (as `permit`).
      const inFight = !!encounter?.combat && (actor?.inEncounter !== false);
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule?.to?.slug || !carrier || (carrier !== context?.item)) continue;

        const name = plainName(carrier.name ?? "");
        const owner = actor?.name ?? "The owner";
        const perform = { slug: rule.to.slug, name: rule.to.name ?? rule.to.slug };
        // A rank the owner has not reached: refused, saying so. With no answer the use would fall
        // through to a plain one, paying the row's cost for a card that performs nothing (the
        // review of 2026-11-15).
        if (!ranksHold(rule, actor)) {
          const needs = summarizeOperators({ when: rule.when });
          out.push({ item: carrier, refuse: `${name} performs ${perform.name} only ${needs || "at a rank its owner has not reached"}.` });
          continue;
        }
        if (!inFight) {
          out.push({ item: carrier, perform, say: `${perform.name} is made as part of ${name}. Outside an encounter nothing is counted.` });
          continue;
        }

        // The trigger: a used Effect the owner still holds. With none, the use is refused, since
        // without it this would be a free Maneuver once per limit (Mike: "Refuse").
        const marks = [];
        if (rule.used?.slug) {
          const record = usedOf(actor, rule.used.slug);
          if (!usedLive(record, encounter)) {
            out.push({ item: carrier, refuse: `${name}: no roll of ${owner}'s at this Opportunity has used up another creature's ${rule.used.name ?? rule.used.slug}.` });
            continue;
          }
          // The Maneuver the Effect triggers spends it: one used result, one use.
          marks.push({ key: String(record.id ?? `used:${rule.used.slug}`), per: "effect" });
        }

        const key = limitKey(carrier, rule);
        const limit = limitOf(rule, context?.alterations);
        if (limitSpent(actor, key, limit.per, encounter)) {
          out.push({ item: carrier, refuse: `${name}: already used this ${limit.per}.` });
          continue;
        }
        if (limit.per) marks.unshift({ key, per: limit.per });
        marks.push(...limit.marks);
        out.push({ item: carrier, perform, ...(marks.length ? { marks } : {}) });
      }
      return out;
    },

    /**
     * What this kind offers on a posted card of the owner's roll (the header, TWO HOOKS).
     * @param {Array<{rule: object, item: object, alterations?: object[]}>} entries  This kind's rules on the roller.
     * @param {{kind: string, modifiers?: object[], encounter?: object|null}} context  The card's flags, and the encounter.
     * @param {object} actor  The roller.
     * @returns {Array<{item: object, label: string, action: string, icon: string}>}
     */
    card(entries, context = {}, actor = null) {
      const out = [];
      if (!ROLL_CARDS.includes(context?.kind)) return out;
      const encounter = context?.encounter ?? null;
      if (!encounter?.combat || (actor?.inEncounter === false)) return out;
      const modifiers = Array.isArray(context?.modifiers) ? context.modifiers : [];
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule?.to?.slug || !rule.used?.slug || !carrier) continue;
        if (!ranksHold(rule, actor)) continue;
        const record = usedOf(actor, rule.used.slug);
        if (!usedLive(record, encounter)) continue;
        // This card's roll is THE one that used that result up, and it was a bonus: the modifier
        // and the used Effect name the same give (the card of the check that gave it). A card
        // from before 0.25.0, or a result with no card behind it, names none and is matched on
        // the Maneuver alone.
        const used = m => m && (m.given === rule.used.slug) && (Number(m.value) > 0)
          && (!record.from || !m.givenFrom || (m.givenFrom === record.from));
        if (!modifiers.some(used)) continue;
        const limit = limitOf(rule, entry.alterations);
        if (limitSpent(actor, limitKey(carrier, rule), limit.per, encounter)) continue;
        const glyph = carrier.system?.glyph ?? "";
        out.push({
          item: carrier,
          label: `${plainName(carrier.name ?? "")}${glyph ? ` ${glyph}` : ""}: ${rule.to.name ?? rule.to.slug}`,
          action: "ruleUse",
          icon: ICON
        });
      }
      return out;
    }
  }
};
