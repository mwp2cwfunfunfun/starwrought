/**
 * The `prevent` rule kind (0.13.0): an effect does not land. The first triggered kind, from two
 * Human Talents Mike named (2026-11-05): Stubborn Footing ("The first time each encounter you
 * would be knocked prone, you are not") and Steady the Line ❶↺ ("Trigger An adjacent ally's Strike
 * is Stopped and would Expose them. Effect It Exposes nothing"), one kind for both at his word
 * ("combine the prevent and protect kinds, with the <Who> being <self> in the case of prevent").
 *
 *   prevent: <Effect> [, operators]
 *
 *   prevent: Prone, ONCE(encounter)         Stubborn Footing
 *   prevent: Expose, FOR(allies, 0ft)       Steady the Line ❶↺
 *
 * `<Effect>` is a Condition by the book's name (Prone, Frightened, Off-Guard, Grabbed, ...; the
 * keys of SW.CONDITIONS, spaces and hyphens ignored) or `Expose` (a Zone a Stop would Expose). By
 * default the effect is prevented on the owner; with `FOR(allies, ...)` on others within range.
 * When the carrier is a Reaction Talent (↺ in its name) the prevention is OFFERED as that Reaction
 * where the effect would land, and the owner pays the Talent's cost; without ↺ it is automatic.
 *
 * The stored rule: `{ kind: "prevent", line, text, effect, when, for, while, against, seen, limit }`,
 * `effect` a condition id ("prone", "offGuard") or "expose". `seen` (0.14.0) asks that the
 * recipient see the owner; an `IF(Trait=...)` in `when` asks that the attack behind the effect
 * carry the trait (`context.threat.traits`), which an Expose on a card has and a Condition write
 * from the palette has not.
 *
 * THE HOOK, `hooks.prevent(entries, context, actor)` on the `prevent` hook point (../engine.mjs,
 * `rulePreventers`): "which rules prevent `context.effect` on `actor` now?" The entries are the
 * actor's own rules and the other tokens' rules whose FOR reaches it, as the `modifiers` hook has
 * them; the same operator reading (IF for the owner, FOR by relation and range, WHILE around the
 * owner, AGAINST on `context.threat`, FIRST/ONCE on the recipient's marks). The answer is a list
 * of `{ item, owner, ownerToken, reaction, mark }`: `reaction` says the carrier is a ↺ Talent to
 * be offered rather than applied. The hook writes nothing; what is done with the answer (the
 * Condition write refused and a card posted, the Expose widget's button) is the caller's, and
 * which client does it is said at each call site (module/rules/prevent.mjs).
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { readLine, rankMeets, whoMatches, compare, hasTrait, againstHolds, markedHolds, refuseOutcome, refuseComponents, summarizeOperators } from "../operators.mjs";
import { CONDITIONS } from "../../config.mjs";

const SHAPE = "prevent: <Effect> [, operators]";
const EXAMPLE = "prevent: Prone, ONCE(encounter)";
const OPERATORS_TAKEN = Object.freeze(["IF", "FOR", "WHILE", "AGAINST", "SEEN", "FIRST", "ONCE", "MARKED"]);

/** The word for the Expose effect, and the condition ids by their lower-cased, squeezed names. */
export const EXPOSE = "expose";
const CONDITION_WORDS = (() => {
  const out = new Map();
  for (const [id, config] of Object.entries(CONDITIONS)) {
    // The Exposed-by-Zone statuses are mirrors of a Zone, never an effect a rule names; "Expose" is.
    if (config.zone) continue;
    out.set(id.toLowerCase(), id);
    // The i18n key's last word is the English name ("STARWROUGHT.Condition.offGuard" -> "offguard").
    const word = String(config.name ?? "").split(".").at(-1).toLowerCase();
    if (word) out.set(word, id);
  }
  return out;
})();

/** The effect word, checked: "Expose", or a Condition. */
function readEffect(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
  if (!key) throw new RuleSyntaxError(`a prevent is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  if ((key === "expose") || (key === "exposed")) return EXPOSE;
  if (CONDITION_WORDS.has(key)) return CONDITION_WORDS.get(key);
  throw new RuleSyntaxError(`"${String(word ?? "").trim()}" is not a Condition or Expose`);
}

/** A Condition's printed name, from its i18n key's last word, title-cased with the capital kept ("Off-Guard" prints "OffGuard"). */
function effectName(effect) {
  if (effect === EXPOSE) return "Expose";
  const word = String(CONDITIONS[effect]?.name ?? effect).split(".").at(-1);
  return word ? word[0].toUpperCase() + word.slice(1) : effect;
}

export default {
  id: "prevent",
  aliases: [],

  parse(args, context = {}) {
    // The 0.16.0 shape: `IMMUNE: prone; LIMIT: encounter` (FG's own `IMMUNE: [condition]`).
    if (context?.form === "effect") {
      const e = context.effect;
      if (e.descriptors.length !== 1) throw new RuleSyntaxError(`IMMUNE is written \`IMMUNE: <Condition or expose>\`, as in \`IMMUNE: prone\` (${e.descriptors.length} descriptors given, 1 wanted)`);
      refuseComponents(e.ops, "IMMUNE", ["when", "for", "while", "against", "seen", "limit", "marked"]);
      const effect = readEffect(e.descriptors[0]);
      refuseOutcome(e.ops);
      return { effect, when: e.ops.when, for: e.ops.for, while: e.ops.while, against: e.ops.against, seen: e.ops.seen, limit: e.ops.limit, marked: e.ops.marked };
    }
    if (context?.form === "feature") throw new RuleSyntaxError("a prevention is an effect line, not a bracketed feature: `IMMUNE: prone`");
    const { args: parts, ops } = readLine(args, { allow: OPERATORS_TAKEN, kind: "prevent", context });
    if (parts.length !== 1) {
      throw new RuleSyntaxError(`a prevent is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} arguments given, 1 wanted)`);
    }
    const effect = readEffect(parts[0]);
    refuseOutcome(ops);
    return { effect, when: ops.when, for: ops.for, while: ops.while, against: ops.against, seen: ops.seen, limit: ops.limit, marked: ops.marked };
  },

  /** `Prone does not land, once each encounter`; `Expose does not land, for allies within 0 ft`. */
  summary(rule) {
    const tail = summarizeOperators(rule);
    return `${effectName(rule?.effect)} does not land${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * Which of this kind's rules prevent the effect on the recipient now (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object, ownerToken?: object}>} entries
     * @param {{effect: string, threat?: object, scene?: object, encounter?: object}} context
     * @param {object} actor  The recipient: on whom the effect would land.
     * @returns {Array<{item: object, owner: object, ownerToken: object|null, reaction: boolean, mark: object|null}>}
     */
    prevent(entries, context = {}, actor = null) {
      const out = [];
      const effect = String(context?.effect ?? "");
      const scene = context?.scene ?? null;
      const encounter = context?.encounter ?? null;
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || (rule.effect !== effect)) continue;
        const owner = entry.owner ?? actor;
        const ownRoll = owner === actor;
        // MARKED (0.15.0): the effect's source must be the creature this Talent marked.
        if (!markedHolds(rule, { item: carrier, owner }, context)) continue;

        const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
        let holds = true;
        for (const w of whens) {
          if (w.trait) {
            if (!hasTrait(context?.threat?.traits, w.trait)) { holds = false; break; }
            continue;
          }
          if (w.roll) { holds = false; break; }
          if (typeof owner?.system?.proficiency !== "function") { holds = false; break; }
          if (!rankMeets(owner.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;

        const who = rule.for?.who ?? "self";
        if (who === "self") {
          if (!ownRoll) continue;
        } else if (ownRoll) {
          if (who !== "self+allies") continue;
        } else {
          if (!scene || !entry.ownerToken || !scene.token) continue;
          if (!whoMatches(who, scene.relation(entry.ownerToken, scene.token))) continue;
          const range = rule.for?.range;
          if ((range !== null) && (range !== undefined) && (scene.gap(entry.ownerToken, scene.token) > range)) continue;
          if (rule.seen && !((typeof scene.sees === "function") && scene.sees(scene.token, entry.ownerToken))) continue;
        }

        if (rule.while) {
          const ownerToken = entry.ownerToken ?? (ownRoll ? scene?.token : null);
          if (!scene || !ownerToken) continue;
          let count = 0;
          for (const other of scene.tokens ?? []) {
            if (!other?.token || (other.token.id === ownerToken.id)) continue;
            if (!whoMatches(rule.while.who, scene.relation(ownerToken, other.token))) continue;
            const range = rule.while.range;
            if ((range !== null) && (range !== undefined) && (scene.gap(ownerToken, other.token) > range)) continue;
            count += 1;
          }
          if (!compare(count, rule.while.op, rule.while.count)) continue;
        }

        if (!againstHolds(rule, context?.threat)) continue;

        let mark = null;
        if (rule.limit) {
          const key = `${carrier?.id ?? carrier?.name ?? "rule"}:${rule.line ?? 0}`;
          const combat = encounter?.combat ?? null;
          if (combat) {
            const held = (actor?.flags?.starwrought?.rules ?? {})[rule.limit.per]?.[key] ?? null;
            if (rule.limit.per === "round") {
              if (held && (held.combat === combat) && (held.round === (encounter.round ?? 0))) continue;
            } else if (held && ((held === combat) || (held.combat === combat))) continue;
            mark = { key, per: rule.limit.per };
          }
        }

        out.push({
          item: carrier, owner, ownerToken: entry.ownerToken ?? null,
          reaction: carrier?.system?.reaction === true, mark
        });
      }
      return out;
    }
  }
};
