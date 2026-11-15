/**
 * The `alter` rule kind (0.22.0; rulings 223 to 230): a Talent that changes one property of what a
 * Maneuver gives. From two Human Talents (Mike, 2026-11-14), in the shape he drafted in their
 * cells before the kind existed:
 *
 *   [EFFECT ALTER: <Maneuver>.<property>; VALUE: <value>; IF: RANK(...)]
 *
 *   [EFFECT ALTER: Aid.beneficial-duration; VALUE: recipient opportunity 2]    Patient Assistance
 *   [EFFECT ALTER: Aid.critical-failure; VALUE: nothing]                       Sure Assistance
 *
 * One descriptor, the Maneuver by the name the action sheets print, a dot, and the property; then
 * `VALUE:`, what the property becomes. The properties read in this version (../given.mjs):
 *
 *   duration               every result's window                      VALUE: a window (`readUntil`)
 *   beneficial-duration    the window of the results that give a bonus VALUE: a window
 *   critical-success, success, failure, critical-failure               VALUE: nothing
 *   movement               how the Move made as part of it is read     VALUE: step
 *
 * `movement` (0.24.0; ruling 242; Coordinated Footwork, of Move Together) is the one property that
 * is not about what the Maneuver gives: `[EFFECT ALTER: Move Together.movement; VALUE: step]` lets
 * a drag within half Speed made as part of that Maneuver be a Step, for everyone who moves in it.
 * It stores `movement: "step"`, is skipped by the `gives` hook below, and is read when the Maneuver
 * is used: the engine's `ruleUses` hands the owner's alterations to the kinds' `use` hooks, so
 * this kind gains no `use` hook of its own and draws no Use control.
 *
 * Any other property is refused as not read yet, naming these, before the Maneuver is looked up:
 * the cells Mike has drafted for later Talents (`Aid.beneficial-uses`,
 * `Working Knowledge.proficiency`) then say what is missing rather than what is misspelt. His
 * `PRESERVE:` is not a component: an ALTER changes one property and leaves the rest, so the degree
 * rolled is the degree rolled (a Critical Failure that gives nothing still Flares). `IF: RANK(...)`
 * reads the owner's rank, `RANK(roll ...)` the rank rolled.
 *
 * The stored rule:
 *
 *   { kind: "alter", line, text,
 *     to: { name: "Aid", slug: "aid", type: "action" | null },   // null without a resolver
 *     property: "beneficial-duration",
 *     nothing: true | false,                                      // a degree property set to nothing
 *     until: { who, n } | null,                                   // a duration property's window
 *     when: [...] | null }
 *
 * THE HOOK, `hooks.gives(entries, context, actor)` on the `gives` hook point (../engine.mjs,
 * `ruleGives`; defined with the `give` kind, calculated in category): of the entries marked `from:
 * "own"` (the roller's Talents, owned Maneuvers and custom effects), one `{ alteration }` per rule
 * that names the Maneuver behind the roll and whose rank conditions hold. The engine applies them
 * to the table the `give` kind's lines make (../given.mjs, `buildTable`). An ALTER never touches
 * the roll itself.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE. It imports ../syntax.mjs,
 * ../operators.mjs and ../given.mjs (all pure) and the config, never the grammar or the registry.
 */

import { RuleSyntaxError } from "../syntax.mjs";
import { rankMeets, refuseComponents, refuseOutcome, summarizeOperators, readTargetName, readUntil, untilWords } from "../operators.mjs";
import { ALTER_PROPERTIES, DEGREE_PROPERTIES, DURATION_PROPERTIES, MOVEMENT_PROPERTY, MOVEMENT_VALUES, propertyKey, degreeName } from "../given.mjs";
import { plainName, ruleCarrierKey } from "../../config.mjs";

const SHAPE = "ALTER: <Maneuver>.<property>; VALUE: <value>";
const EXAMPLE = "ALTER: Aid.critical-failure; VALUE: nothing";

/** The word a degree property is set to: that degree gives nothing. */
export const NOTHING = "nothing";

/** The properties read, as a message lists them. */
function propertyList() {
  return `${ALTER_PROPERTIES.slice(0, -1).join(", ")} and ${ALTER_PROPERTIES.at(-1)}`;
}

/** The conditions of a rule as a list, whatever shape `when` was stored in. */
function whensOf(rule) {
  return Array.isArray(rule?.when) ? rule.when : (rule?.when ? [rule.when] : []);
}

/* -------------------------------------------- */

export default {
  id: "alter",
  aliases: [],

  /**
   * @param {string} args      The text after the tag, trimmed (unused: the effect reader has split it).
   * @param {object} context   The grammar's context; `effect` and `resolve` are read from it.
   */
  parse(args, context = {}) {
    if (context?.form !== "effect") throw new RuleSyntaxError(`an alteration is an effect: \`[EFFECT ${EXAMPLE}]\``);
    const e = context.effect;
    if (/^\[\s*AURA\b/i.test(String(context.text ?? ""))) {
      throw new RuleSyntaxError(`an alteration changes the owner's own Maneuver and cannot ride an [AURA ...] block; write it as its own \`[EFFECT ${EXAMPLE}]\``);
    }
    const ops = refuseComponents(e.ops, "ALTER", ["when", "set"]);
    refuseOutcome(ops);
    if (whensOf(ops).some(w => w?.trait)) throw new RuleSyntaxError("ALTER does not take IFT: TRAIT(...)");

    if (e.descriptors.length !== 1) {
      throw new RuleSyntaxError(`an alteration is written \`${SHAPE}\`, as in \`${EXAMPLE}\` (${e.descriptors.length} descriptors given, 1 wanted: the Maneuver, a dot, the property)`);
    }
    const written = e.descriptors[0];
    const dot = written.lastIndexOf(".");
    if ((dot <= 0) || (dot === written.length - 1)) {
      throw new RuleSyntaxError(`"${written}": an alteration names the Maneuver, a dot, and the property it changes, as in \`${EXAMPLE}\``);
    }
    const maneuverName = written.slice(0, dot).trim();
    const property = propertyKey(written.slice(dot + 1));

    // The property first: a cell drafted for a later version is told what is not read yet, not
    // that its Maneuver is unknown.
    if (!ALTER_PROPERTIES.includes(property)) {
      throw new RuleSyntaxError(`the property "${written.slice(dot + 1).trim()}" is not read yet: ALTER reads ${propertyList()}`);
    }
    const read = readTargetName(maneuverName, context.resolve);
    if (!read || !read.slug) throw new RuleSyntaxError(`"${maneuverName}" names no Maneuver`);
    if (read.type === "constellation") {
      throw new RuleSyntaxError(`"${read.name}" is a Constellation: ALTER changes what a Maneuver gives, as in \`${EXAMPLE}\``);
    }
    const to = { name: read.name, slug: read.slug, type: read.type };

    if (ops.set === null) {
      throw new RuleSyntaxError(`ALTER says what the property becomes: add \`VALUE: ...\`, as in \`${EXAMPLE}\``);
    }
    const value = String(ops.set).trim();
    if (DURATION_PROPERTIES.includes(property)) {
      return { to, property, nothing: false, until: readUntil(value), when: ops.when };
    }
    // The Maneuver's movement (0.24.0): the one property that is not about what it gives. Its key
    // is stored on this branch alone, so every other alteration keeps the shape it had.
    if (property === MOVEMENT_PROPERTY) {
      if (!MOVEMENT_VALUES.includes(value.toLowerCase())) {
        throw new RuleSyntaxError(`"${value}": a Maneuver's movement is changed to \`step\` in this version, as in \`ALTER: ${to.name}.movement; VALUE: step\` (a drag within half Speed made as part of the Maneuver is then a Step, for everyone who moves in it)`);
      }
      return { to, property, nothing: false, until: null, movement: value.toLowerCase(), when: ops.when };
    }
    if (value.toLowerCase() !== NOTHING) {
      throw new RuleSyntaxError(`"${value}": a result is changed to nothing in this version, as in \`ALTER: ${to.name}.${property}; VALUE: nothing\``);
    }
    return { to, property, nothing: true, until: null, when: ops.when };
  },

  /**
   * `Aid's Critical Failure gives nothing`; `Aid's results that give a bonus last through the
   * recipient's second upcoming Opportunity`.
   */
  summary(rule) {
    const maneuver = `${rule?.to?.name ?? ""}'s`;
    const tail = summarizeOperators(rule).replace(/the roll's rank/g, "the rank rolled");
    const property = propertyKey(rule?.property);
    let what;
    if (Object.hasOwn(DEGREE_PROPERTIES, property)) what = `${maneuver} ${degreeName(DEGREE_PROPERTIES[property])} gives nothing`;
    else if (property === MOVEMENT_PROPERTY) what = `a drag within half Speed made as part of ${rule?.to?.name ?? "the Maneuver"} is a Step`;
    else what = `${maneuver} results${property === "beneficial-duration" ? " that give a bonus" : ""} last ${untilWords(rule?.until ?? null)}`;
    return `${what}${tail ? `, ${tail}` : ""}`;
  },

  hooks: {
    /**
     * The roller's alterations of the Maneuver behind the roll (the header, THE HOOK).
     * @param {Array<{rule: object, item: object, from: "item"|"own"}>} entries
     * @param {{maneuver?: string, rank?: string}} context  `maneuver` is the slug of the Item behind
     *        the roll; `rank` the rank ROLLED.
     * @param {object} actor  The roller.
     * @returns {Array<{alteration: import("../given.mjs").GiveAlteration}>}
     */
    gives(entries, context = {}, actor = null) {
      const out = [];
      const maneuver = String(context?.maneuver ?? "");
      if (!maneuver) return out;
      for (const entry of entries ?? []) {
        const rule = entry?.rule;
        if ((entry?.from !== "own") || !rule?.to?.slug || (rule.to.slug !== maneuver)) continue;
        // A rule stored by hand that names a Constellation is passed over (the parse refuses it).
        if (rule.to.type === "constellation") continue;
        // The movement property changes nothing a Maneuver gives (0.24.0): it is read at use.
        if (propertyKey(rule.property) === MOVEMENT_PROPERTY) continue;
        let holds = true;
        for (const w of whensOf(rule)) {
          if (w?.roll === true) {
            if ((context?.rank === undefined) || (context?.rank === null) || !rankMeets(context.rank, w.op ?? "=", w.rank)) { holds = false; break; }
            continue;
          }
          if (!w?.constellation || w.trait || w.outcome || (typeof actor?.system?.proficiency !== "function")) { holds = false; break; }
          if (!rankMeets(actor.system.proficiency(w.constellation)?.rank ?? "untrained", w.op ?? "=", w.rank)) { holds = false; break; }
        }
        if (!holds) continue;
        out.push({
          alteration: {
            key: `${ruleCarrierKey(entry.item)}:${rule.line ?? 0}`,
            property: propertyKey(rule.property),
            nothing: rule.nothing === true,
            until: rule.until ?? null,
            label: plainName(entry.item?.name ?? "")
          }
        });
      }
      return out;
    }
  }
};
