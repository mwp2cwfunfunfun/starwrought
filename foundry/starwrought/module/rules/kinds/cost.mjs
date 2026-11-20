/**
 * The `cost` rule kind (0.37.0; rulings 375 to 384): what a creature uses costs more actions while
 * it has a Condition. From the Heedless row of the Conditions workbook (Mike, 2026-11-19):
 * "Maneuvers with Concentrate take 1 extra action", and his question, "how should we automate
 * Heedless?"
 *
 *   [EFFECT COST: 1; IF: TRAIT(Concentrate)]                                    Heedless
 *
 *   COST: <n>; IF: TRAIT(<Trait>)
 *
 * `<n>` is a whole number of EXTRA actions, 1 to 6. The one condition is the trait of the thing
 * being used: on a COST line `TRAIT(...)` is asked of what the creature is paying for, where on a
 * bonus line it is asked of the attack being answered (the effect reader stores it the same way
 * after `IF:` and `IFT:`; the kind decides what it is about). One trait to a line, named by one
 * word, the word every comparison of a trait keys on (`traitKey`), as `IMMUNE: TRAIT(...)` names
 * it.
 *
 * READ ON A CONDITION'S ROW ALONE in this version (ruling 379, Mike's choice, as `IMMUNE:
 * TRAIT(...)` began): the line acts for whoever HAS the Condition, a character or an adversary. A
 * Condition's line has no On / Skip / Off and no one-roll duration, so its reader is a plain
 * calculation with nothing to spend and nothing to write. Not read yet, each refused by name: a
 * cost made cheaper, a cost raised for everything (no trait), a Maneuver named after a comma, and
 * the line on a Talent, a Maneuver or a custom effect.
 *
 * The stored rule: `{ kind: "cost", line, text, value, trait, name }`.
 *
 * NO HOOK POINT, as `ignore` has none (./ignore.mjs): a hook point is a dispatch over every kind
 * for a moment several kinds speak at, and one kind speaks here. The reader, `costRaise(actor,
 * traits)`, is ../cost.mjs's, asked by the places that settle a cost (`rowRaise` there;
 * `SwActor#recenterCost`).
 *
 * THIS FILE IMPORTS NO MODULE THAT REACHES THE REGISTRY (./index.mjs imports it, and the engine
 * imports ./index.mjs): through the first build of 0.37.0 the reader lived here and imported the
 * engine, so importing this file before the registry threw "Cannot access 'cost' before
 * initialization" (the review of 0.37.0; both readers found it). What reads the actor is
 * ../cost.mjs's, which imports the registry first. The self-test imports this file first, alone.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError, CONDITION_ROW } from "../syntax.mjs";
import { refuseComponents, traitKey } from "../operators.mjs";

const EXAMPLE = "[EFFECT COST: 1; IF: TRAIT(Concentrate)]";
const SHAPE = "COST: <n>; IF: TRAIT(<Trait>)";
const ONE_TRAIT = `COST names one trait to a line: write \`${EXAMPLE}\` and a second line for a second trait`;

/** The most a line may add: a round is six actions. */
export const COST_RAISE_MAX = 6;

export default {
  id: "cost",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`a cost is an effect: \`${EXAMPLE}\``);
    const e = context.effect;
    if (context?.itemType !== CONDITION_ROW) {
      throw new RuleSyntaxError(`\`COST:\` raises what a thing costs and is read on a Condition's row for now (the Conditions sheet, as Heedless's \`${EXAMPLE}\`); a Talent's or a Maneuver's own change of cost is not read yet`);
    }
    if (!e.descriptors.length) {
      throw new RuleSyntaxError(`COST is written \`${SHAPE}\`, as in \`${EXAMPLE}\`: the number of extra actions comes first`);
    }
    if (e.descriptors.length > 1) {
      throw new RuleSyntaxError(`COST takes one number and nothing after a comma yet: a Maneuver named as the target is not read yet. What costs more is named by its trait, as in \`${EXAMPLE}\``);
    }
    // A comma with nothing beside it (`COST: 1, `, `COST: , 1`): the effect reader drops an empty
    // descriptor for a tag that takes descriptors alone, so the stray comma is caught here (the
    // review of 0.37.0), as a modifier tag's is caught there.
    const head = String(e.components?.[0] ?? "").replace(/^[A-Za-z]+\s*:/, "");
    if (head.includes(",")) {
      throw new RuleSyntaxError(`COST: a comma with nothing beside it; COST takes one number, as in \`${EXAMPLE}\`, so take the comma out`);
    }
    const written = String(e.descriptors[0]).trim();
    if (!/^[+-]?\d+$/.test(written)) {
      throw new RuleSyntaxError(`COST is written \`${SHAPE}\`, as in \`${EXAMPLE}\`: a whole number of extra actions first, not "${written}"`);
    }
    const value = Number(written);
    if (value === 0) throw new RuleSyntaxError("a cost raised by 0 does nothing");
    if (value < 0) throw new RuleSyntaxError("a cost made cheaper is not read yet: COST takes a whole number above 0, the extra actions");
    if (value > COST_RAISE_MAX) throw new RuleSyntaxError(`COST raises a cost by 1 to ${COST_RAISE_MAX} actions: a round has six`);
    // The one condition a COST line takes is the trait; every other component is refused by name.
    refuseComponents(e.ops, "COST", ["when"]);
    const whens = Array.isArray(e.ops.when) ? e.ops.when : (e.ops.when ? [e.ops.when] : []);
    if (!whens.length) {
      throw new RuleSyntaxError(`COST names the trait of what costs more, as in \`${EXAMPLE}\`; a cost raised for everything is not read yet`);
    }
    if (whens.some(w => !w?.trait)) {
      throw new RuleSyntaxError(`COST takes one condition, the trait of what costs more, as in \`${EXAMPLE}\`: a rank or a result is not read on it`);
    }
    if (whens.length > 1) throw new RuleSyntaxError(ONE_TRAIT);
    const name = String(whens[0].name ?? "").trim();
    // `TRAIT(Auditory or Visual)`: two traits in one pair of parentheses, told as two components are.
    if (/\s+(?:or|and)\s+/i.test(name)) throw new RuleSyntaxError(ONE_TRAIT);
    // One word, ending in a letter or a digit (`Concentrate-` would be stored as a key no trait has).
    if (!/^[A-Za-z](?:[A-Za-z0-9'-]*[A-Za-z0-9])?$/.test(name)) {
      throw new RuleSyntaxError(`"${name}" is not a trait's name: one word of letters, digits, hyphens and apostrophes, as in \`${EXAMPLE}\` (a trait is named without its value: Reach, not Reach 5)`);
    }
    return { value, trait: traitKey(name), name: name[0].toUpperCase() + name.slice(1) };
  },

  /** `things with the Concentrate trait cost 1 more action`. */
  summary(rule) {
    const n = Number(rule?.value) || 0;
    return `things with the ${rule?.name ?? rule?.trait ?? ""} trait cost ${n} more action${n === 1 ? "" : "s"}`;
  },

  hooks: {}
};
