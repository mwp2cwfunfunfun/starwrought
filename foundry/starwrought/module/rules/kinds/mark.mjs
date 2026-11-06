/**
 * The `mark` rule kind (0.15.0; ruling 176): name one creature. The second triggered kind, from
 * the Serrovane Culture's Oathbound ❶ (Mike, 2026-11-05): "Name one creature that has either
 * formally challenged you, or that has broken a bargain or a truce with you. You gain a +1
 * Condition bonus to Attack checks and Defense checks against that creature until the encounter
 * ends." The naming is this kind; the bonuses are `bonus` lines with `MARKED` on the same Talent.
 *
 *   [EFFECT MARK: [<Who>] [, <Until>]]
 *
 *   [EFFECT MARK: enemies]                        Oathbound ❶ (the Maneuver row)
 *   [EFFECT ATK: 1 condition; IFT: MARKED]
 *   [EFFECT DEF: 1 condition; IFT: MARKED]
 *
 * `<Who>` is who may be named, `enemies` or `all` (the default); `<Until>` how long the mark holds,
 * `encounter` (the one word so far, and the default). The stored rule: `{ kind: "mark", line,
 * text, who, until, when }`.
 *
 * THE HOOK, `hooks.use(entries, context, actor)` on the `use` hook point (../engine.mjs,
 * `ruleUses`), defined with this kind: "the owner used this Talent; what does the kind do?" The
 * context is `{ item, target: { actor, uuid, tokenUuid, name, relation } | null, encounter }`;
 * the answer is a list of actions `{ item, write: { [path]: value }, say: string }` or refusals
 * `{ item, refuse: string }`, which the one client that used the Talent (the owner's) applies:
 * `SwItem#use` writes the flag on the owner and posts the card. The hook writes nothing itself.
 * The mark is `flags.starwrought.rules.marks.<itemId> = { uuid, tokenUuid, name, combat }`, read by
 * `markedHolds` in ../operators.mjs: it holds while `combat` is the viewed Combat's id (null for a
 * mark made outside an encounter, which holds while none runs); nothing clears it, as FIRST and
 * ONCE marks are compared and never cleared.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseOutcome, refuseComponents, summarizeOperators } from "../operators.mjs";
import { plainName } from "../../config.mjs";

const SHAPE = "MARK: [<Who>] [, <Until>]";
const EXAMPLE = "MARK: enemies";

/** Who may be named: the relation words a target may bear to the owner. */
export const MARK_WHO = Object.freeze({ enemies: ["enemy"], all: ["enemy", "ally", "neutral"] });
/** How long a mark holds. One word so far. */
export const MARK_UNTIL = Object.freeze(["encounter"]);

export default {
  id: "mark",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form === "feature") throw new RuleSyntaxError("a mark is an effect line, not a bracketed feature: `MARK: enemies`");
    if (context?.form !== "effect") throw new RuleSyntaxError(`a mark is an effect: \`[EFFECT ${EXAMPLE}]\``);
    // The descriptors are the words; the components (IF only) come from the effect reader.
    const parts = context.effect.descriptors;
    const ops = refuseComponents(context.effect.ops, "MARK", ["when"]);
    if (parts.length > 2) throw new RuleSyntaxError(`a mark is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${parts.length} arguments given, at most 2)`);
    let who = "all";
    let until = "encounter";
    for (const part of parts) {
      const word = part.toLowerCase().replace(/\s+/g, "");
      if (Object.hasOwn(MARK_WHO, word)) who = word;
      else if (MARK_UNTIL.includes(word)) until = word;
      else throw new RuleSyntaxError(`a mark is written \`${SHAPE}\`: Who is enemies or all, Until is encounter, not "${part}"`);
    }
    refuseOutcome(ops);
    return { who, until, when: ops.when };
  },

  /** `marks one enemy until the encounter ends`. */
  summary(rule) {
    const who = rule?.who === "enemies" ? "enemy" : "creature";
    const tail = summarizeOperators(rule);
    return `marks one ${who} until the encounter ends${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * The owner used the Talent: name the target (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object}>} entries  This kind's rules on the used Item.
     * @param {{item: object, target: object|null, encounter: {combat: string|null}|null}} context
     * @param {object} actor  The owner, who used it.
     * @returns {Array<{item: object, write?: object, say?: string, refuse?: string}>}
     */
    use(entries, context = {}, actor = null) {
      const out = [];
      const target = context?.target ?? null;
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule || !carrier || (carrier !== context?.item)) continue;
        // IF: the owner's rank.
        const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
        let holds = true;
        for (const w of whens) {
          if (w.roll || w.trait || w.outcome) { holds = false; break; }
          if (typeof actor?.system?.proficiency !== "function") { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;
        const name = plainName(carrier.name ?? "");
        if (!target || (!target.uuid && !target.tokenUuid)) {
          out.push({ item: carrier, refuse: `${name}: target exactly one creature first.` });
          continue;
        }
        if (target.relation && !MARK_WHO[rule.who]?.includes(target.relation)) {
          out.push({ item: carrier, refuse: `${name} names ${rule.who === "enemies" ? "an enemy" : "a creature"}; ${target.name ?? "that"} is not one.` });
          continue;
        }
        const id = String(carrier.id ?? carrier.name ?? "rule").replace(/\./g, "-");
        out.push({
          item: carrier,
          write: {
            [`flags.starwrought.rules.marks.${id}`]: {
              uuid: target.uuid ?? null, tokenUuid: target.tokenUuid ?? null,
              name: String(target.name ?? ""), combat: context?.encounter?.combat ?? null
            }
          },
          say: `${actor?.name ?? "The owner"} marks ${target.name ?? "the target"}: ${name}.`
        });
      }
      return out;
    }
  }
};
