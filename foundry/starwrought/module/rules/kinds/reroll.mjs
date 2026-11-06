/**
 * The `reroll` rule kind (0.15.0; ruling 177): throw a check's die again. From the Kestrel Reach
 * Culture's Quick Tongue ❶↺ (Mike, 2026-11-05): "Trigger You critically fail a Diplomacy check.
 * Requirements You're in a settlement or community, and you haven't used Quick Tongue in this
 * settlement or community within the past month. Effect Reroll the triggering Diplomacy check,
 * using the second result." The Trigger is this kind's business; the Requirements are the table's,
 * said on the card.
 *
 *   [EFFECT REROLL: [<Constellation>]; IF: RESULT(<degree>); IF: RANK(...)]
 *
 *   [EFFECT REROLL: diplomacy; IF: RESULT(critical failure)]     Quick Tongue ❶↺ (the Maneuver row)
 *
 * `<Target>` is a Constellation by name, or `Checks` (every check that is not an attack or a
 * Defense). The stored rule: `{ kind: "reroll", line, text, to: { name, slug, type }, when }`.
 *
 * THE HOOK, `hooks.card(entries, context, actor)` on the `card` hook point (../engine.mjs,
 * `ruleCardOffers`), defined with this kind: "a card of the owner's roll was posted; what does the
 * kind offer on it?" The context is the card's flags as the check card wrote them (`{ kind, slug,
 * degree, itemUuid, threshold, ... }`) plus `encounter`; the answer is a list of offers `{ item,
 * label, action }`, which the chat render pass (documents/chat.mjs) draws as buttons for the
 * owner or the GM. The press is the presser's client's to act on (documents/cards/reroll.mjs,
 * `rerollByRule`): it pays the Talent's cost through the owner's actions when a Combat runs,
 * nothing outside one, and throws the same die again. The hook writes nothing and rolls nothing.
 * Attack and Defense cards keep the 0.5.3 Reroll button and are not offered to.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, summarizeOperators } from "../operators.mjs";
import { slugify, plainName, isLoreSlug } from "../../config.mjs";

const SHAPE = "REROLL: [<Constellation>]; IF: RESULT(<degree>)";
const EXAMPLE = "REROLL: diplomacy; IF: RESULT(critical failure)";

/** The target: a Constellation, or the word Checks. */
function readTarget(name, resolve) {
  const written = String(name ?? "").trim();
  if (slugify(written) === "checks") return { name: "Checks", slug: "checks", type: "scope" };
  let target;
  if (typeof resolve === "function") {
    const found = resolve(written);
    if (!found || (found.type !== "constellation") || !found.slug) throw new RuleSyntaxError(`a reroll is written \`${SHAPE}\`: "${written}" names no Constellation (or write Checks)`);
    target = { name: String(found.name ?? written), slug: String(found.slug), type: "constellation" };
  } else {
    target = { name: written, slug: slugify(plainName(written)), type: null };
  }
  if (!target.slug) throw new RuleSyntaxError(`a reroll is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  if (isLoreSlug(target.slug)) throw new RuleSyntaxError("a Lore is the character's own; a reroll cannot name it");
  return target;
}

export default {
  id: "reroll",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a reroll is an effect: \`[EFFECT ${EXAMPLE}]\``);
    // `REROLL: diplomacy; IF: RESULT(critical failure)`; with no descriptor, any check.
    const e = context.effect;
    if (e.descriptors.length > 1) throw new RuleSyntaxError(`REROLL takes one descriptor, a Constellation, or none for any check (${e.descriptors.length} given)`);
    refuseComponents(e.ops, "REROLL", ["when"]);
    const to = e.descriptors.length ? readTarget(e.descriptors[0], context?.resolve) : { name: "Checks", slug: "checks", type: "scope" };
    return { to, when: e.ops.when };
  },

  /** `reroll a Diplomacy check, on a Critical Failure`. */
  summary(rule) {
    const what = rule?.to?.type === "scope" ? "any check" : `${/^[aeiou]/i.test(rule?.to?.name ?? "") ? "an" : "a"} ${rule?.to?.name ?? ""} check`;
    const tail = summarizeOperators(rule);
    return `reroll ${what}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * What this kind offers on a posted card of the owner's roll (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, owner?: object}>} entries  This kind's rules on the roller.
     * @param {{kind: string, slug: string, degree: string|null, encounter?: object}} context  The card's flags.
     * @param {object} actor  The roller.
     * @returns {Array<{item: object, label: string, action: string}>}
     */
    card(entries, context = {}, actor = null) {
      const out = [];
      if (context?.kind !== "check") return out;
      const slug = String(context?.slug ?? "");
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        const carrier = entry?.item;
        if (!rule?.to?.slug || !carrier) continue;
        if ((rule.to.type !== "scope") && (slug !== rule.to.slug)) continue;
        const whens = Array.isArray(rule.when) ? rule.when : (rule.when ? [rule.when] : []);
        let holds = true;
        for (const w of whens) {
          if (w.outcome) {
            if (!context?.degree || (context.degree !== w.outcome)) { holds = false; break; }
            continue;
          }
          if (w.roll || w.trait) { holds = false; break; }
          if (typeof actor?.system?.proficiency !== "function") { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;
        const glyph = carrier.system?.glyph ?? "";
        out.push({
          item: carrier,
          label: `${plainName(carrier.name ?? "")}${glyph ? ` ${glyph}` : ""}: reroll`,
          action: "ruleReroll"
        });
      }
      return out;
    }
  }
};
