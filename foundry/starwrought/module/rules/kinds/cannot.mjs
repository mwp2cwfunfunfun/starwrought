/**
 * The `cannot` rule kind (0.38.0; rulings 385 to 392): a creature that has a Condition cannot use
 * a Defense. Mike, 2026-11-19: "Grabbed currently is hard-coded to 'cannot Evade' ... I would like
 * to make that an automation grammar to prevent the use of a Defense." The word is his choice.
 *
 *   [EFFECT CANNOT: evade]                                                       Grabbed
 *
 *   CANNOT: <Defense>
 *
 * `<Defense>` is one of the four, by name: Evade, Guard, Endure, Awareness. One Defense to a
 * line; a second Defense is a second line. No component follows it.
 *
 * READ ON A CONDITION'S ROW ALONE in this version (ruling 388, as `IMMUNE: TRAIT(...)` and `COST`
 * began): the line acts for whoever HAS the Condition, a character or an adversary. Not read yet,
 * each refused by name: anything but a Defense (movement, a Maneuver, Reactions, "no action other
 * than Escape"), and the line on a Talent, a Maneuver or a custom effect. The word was chosen so
 * that those can follow (`CANNOT: move, step`).
 *
 * WHAT IT IS ABOUT (ruling 389): ANSWERING. The Defense cannot be the answer to an attack, or to a
 * Maneuver's check read against it. A Defense rolled for its own sake (the Wind check's Endure,
 * Initiative with Awareness, a Search) is untouched.
 *
 * The stored rule: `{ kind: "cannot", line, text, defense, name }`.
 *
 * NO HOOK POINT, as `cost` and `ignore` have none. The reader, `unusableDefenses(actor)`, is
 * ../cannot.mjs's, asked by the two Defense passes (data/character/defenses.mjs and the adversary's
 * model), which write the answer onto `system.defenses[key].unavailable`, where every reader of an
 * unusable Defense already looks.
 *
 * THIS FILE IMPORTS NO MODULE THAT REACHES THE REGISTRY (the lesson of 0.37.0's review): the
 * syntax, the operators and ../check.mjs, which names the four Defenses and imports the config
 * alone. The self-test imports this file first, in a process of its own.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE (the build imports it from Node).
 */

import { RuleSyntaxError, CONDITION_ROW } from "../syntax.mjs";
import { refuseComponents } from "../operators.mjs";
import { defenseKeyOf, defenseNames } from "../check.mjs";

const EXAMPLE = "[EFFECT CANNOT: evade]";
const SHAPE = "CANNOT: <Defense>";
const ONE_DEFENSE = `CANNOT names one Defense to a line: write \`${EXAMPLE}\` and a second line for a second Defense`;

/** The four in the order the book speaks of them, whatever order the config lists them in. */
const BOOK_ORDER = Object.freeze(["Evade", "Guard", "Endure", "Awareness"]);

/** "Evade, Guard, Endure or Awareness". */
function theFour() {
  const known = defenseNames();
  const names = [...BOOK_ORDER.filter(name => known.includes(name)), ...known.filter(name => !BOOK_ORDER.includes(name))];
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** The words of what was written after the tag: split on commas, slashes, `&`, `+` and spaces, the joiners `or` and `and` left out. */
function wordsOf(head) {
  return String(head ?? "").split(/[\s,/&+]+/).map(word => word.trim()).filter(word => word && !/^(?:or|and)$/i.test(word));
}

export default {
  id: "cannot",
  aliases: [],

  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`what a creature cannot use is an effect: \`${EXAMPLE}\``);
    const e = context.effect;
    if (context?.itemType !== CONDITION_ROW) {
      throw new RuleSyntaxError(`\`CANNOT:\` says what a creature cannot use and is read on a Condition's row for now (the Conditions sheet, as Grabbed's \`${EXAMPLE}\`); a Talent's or a Maneuver's own is not read yet`);
    }
    if (!e.descriptors.length) {
      throw new RuleSyntaxError(`CANNOT is written \`${SHAPE}\`, as in \`${EXAMPLE}\`: name the Defense, ${theFour()}`);
    }
    // WHAT WAS WRITTEN DECIDES THE MESSAGE, never the number of commas (the review of 0.38.0:
    // `move, step` was told to write a second line for a second Defense, and `evade guard` that
    // it was not read yet). The whole of what follows the tag is read word by word.
    const head = String(e.components?.[0] ?? "").replace(/^[A-Za-z]+\s*:/, "").trim();
    // A comma with nothing beside it (`CANNOT: evade, `, `CANNOT: , evade`): the effect reader
    // drops an empty descriptor for a tag that takes descriptors alone, so it is caught here, as
    // `COST`'s is (./cost.mjs). An EMPTY operand, not any comma: one inside quotes or parentheses
    // is somebody's words.
    if (/(?:^|,)\s*(?:,|$)/.test(head)) {
      throw new RuleSyntaxError(`CANNOT: a comma with nothing beside it; CANNOT takes one Defense, as in \`${EXAMPLE}\`, so take the comma out`);
    }
    const words = wordsOf(head);
    const defenses = [...new Set(words.map(defenseKeyOf).filter(Boolean))];
    // A value or a type first: the shape of a bonus line (`CANNOT: -2 situation, evade`).
    if (/^[+-]?(?:\d+|N)$/i.test(words[0] ?? "")) {
      throw new RuleSyntaxError(`CANNOT takes no value and no type, only the Defense: write \`${defenses.length === 1 ? `[EFFECT CANNOT: ${defenses[0]}]` : EXAMPLE}\``);
    }
    // Two Defenses however they are joined, or all of them at once.
    if ((defenses.length > 1) || words.some(word => /^(?:all|any|every|both|defen[cs]es?)$/i.test(word))) throw new RuleSyntaxError(ONE_DEFENSE);
    // No component at all: the line acts for whoever has the Condition, against everything.
    refuseComponents(e.ops, "CANNOT", []);
    if (!defenses.length) {
      throw new RuleSyntaxError(`CANNOT names a Defense for now (${theFour()}), as in \`${EXAMPLE}\`: "${head}" is not read yet. What else a creature cannot do (move, use a Maneuver, use Reactions) has no word yet`);
    }
    const defense = defenses[0];
    // One Defense, and words beside it (`evade 2`, `use, evade`, `evade while held`).
    if (words.length > 1) {
      throw new RuleSyntaxError(`CANNOT takes one Defense and nothing beside it: write \`[EFFECT CANNOT: ${defense}]\``);
    }
    return { defense, name: defense[0].toUpperCase() + defense.slice(1) };
  },

  /** `cannot use Evade`. */
  summary(rule) {
    return `cannot use ${rule?.name ?? rule?.defense ?? ""}`;
  },

  hooks: {}
};
