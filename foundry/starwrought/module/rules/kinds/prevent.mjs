/**
 * The `prevent` rule kind (0.13.0): an effect does not land. The first triggered kind, from two
 * Human Talents Mike named (2026-11-05): Stubborn Footing ("The first time each encounter you
 * would be knocked prone, you are not") and Steady the Line ❶↺ ("Trigger An adjacent ally's Strike
 * is Stopped and would Expose them. Effect It Exposes nothing"), one kind for both at his word
 * ("combine the prevent and protect kinds, with the <Who> being <self> in the case of prevent").
 *
 *   [EFFECT IMMUNE: <Effect>; <component>; ...]          (FG's own `IMMUNE: [condition]`)
 *
 *   [EFFECT IMMUNE: prone; LIMIT: encounter]       Stubborn Footing
 *   [EFFECT IMMUNE: expose; FOR: allies 0]         Steady the Line ❶↺ (the Maneuver row)
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
 * IMMUNITY TO A TRAIT (0.35.0; rulings 350 to 360). Mike, of the Blinded Condition: "We already
 * have [IMMUNE] in automation grammar, so should we extend it to allow for adding of Traits in
 * there?"
 *
 *   [EFFECT IMMUNE: TRAIT(Visual)]                 the Blinded row of data/conditions.xlsx
 *   [EFFECT IMMUNE: TRAIT(Auditory)]               Deafened
 *
 * Whoever has the Condition is immune to anything that carries the trait: a Maneuver used on it
 * puts nothing on it, and an attack or a spell deals it no damage. Read ON A CONDITION'S ROW ALONE
 * in this version, one trait to a line, with no component after it: the line acts for whoever has
 * the Condition, so it asks nothing about an owner, and so every client answers the same. On a
 * Talent, a Maneuver or a custom effect it is refused (its On / Skip / Off, a `FOR` judged on two
 * clients at once, and a card that would name an adversary's hidden Talent each need settling
 * first). A Condition after `IMMUNE:` stays a bare word, here and everywhere (Mike: "keep as is").
 *
 * The stored rule of the trait form: `{ kind: "prevent", line, text, effect: "trait", trait, name }`
 * (`trait` the key `traitKey` makes, "visual"; `name` as written, "Visual"). `trait` and `name` are
 * on this form only, so the stored rule of every Condition and Expose line is what it was.
 *
 * It is asked with `context.effect === "trait"` and the traits of the thing that would land in
 * `context.threat.traits`, as keys (../prevent.mjs, `traitImmunity`; the grouping of a Maneuver's
 * traits into alternatives is ../immunity.mjs). The answer carries `trait` and `name` beside the
 * usual fields, so the caller can say which trait and what makes the creature immune.
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

import { RuleSyntaxError, CONDITION_ROW } from "../syntax.mjs";
import { rankMeets, whoMatches, compare, hasTrait, traitKey, againstHolds, markedHolds, refuseOutcome, refuseComponents, summarizeOperators } from "../operators.mjs";
import { CONDITIONS, conditionIdOf } from "../../config.mjs";

const SHAPE = "IMMUNE: <Condition or expose>; <component>; ...";
const EXAMPLE = "IMMUNE: prone; LIMIT: encounter";
const TRAIT_EXAMPLE = "[EFFECT IMMUNE: TRAIT(Visual)]";

/** The word for the Expose effect. A Condition is read by its name (`conditionIdOf`, the config's). */
export const EXPOSE = "expose";

/**
 * The `effect` of a rule that is immunity to a trait (0.35.0), and what a caller asks the hook
 * with. No Condition can take the word: "trait" and "expose" are reserved names
 * (RESERVED_CONDITION_NAMES, the config's).
 */
export const TRAIT = "trait";

/** Is a descriptor the trait form, or the start of one: `TRAIT(Visual)`, `trait (visual`, the bare word `trait`? */
function isTraitWord(word) {
  return /^trait\s*(\(|$)/i.test(String(word ?? "").trim());
}

const ONE_TRAIT = `IMMUNE names one trait to a line: write \`${TRAIT_EXAMPLE}\` and a second line for a second trait`;

/**
 * A descriptor written `TRAIT(<Trait>)`, read: `{ trait, name }`. One trait to a line, named by
 * ONE WORD, the word every comparison of a trait keys on (../operators.mjs, `traitKey`): a trait
 * is named without its value ("Reach", never "Reach 5"), so what is stored is what is compared and
 * what a card prints (the review of 0.35.0: "visual effects" stored the key `visual` under a name
 * that then read "immune to visual effects effects"). The name's first letter is printed as a
 * capital however it was typed.
 */
function readTrait(word) {
  const match = /^trait\s*\((.*)\)$/i.exec(String(word ?? "").trim());
  const name = match ? match[1].trim() : "";
  if (!name) throw new RuleSyntaxError(`TRAIT(...) names a trait, as in \`${TRAIT_EXAMPLE}\``);
  if (/[,;]/.test(name) || /(^|\s)(or|and)(\s|$)/i.test(name)) throw new RuleSyntaxError(ONE_TRAIT);
  if (!/^[A-Za-z][A-Za-z0-9'-]*$/.test(name)) {
    throw new RuleSyntaxError(`"${name}" is not a trait's name: one word of letters, digits, hyphens and apostrophes, as in \`${TRAIT_EXAMPLE}\` (a trait is named without its value: Reach, not Reach 5)`);
  }
  return { trait: traitKey(name), name: name[0].toUpperCase() + name.slice(1) };
}

/** The effect word, checked: "Expose", or a Condition. */
function readEffect(word) {
  const key = String(word ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
  if (!key) throw new RuleSyntaxError(`a prevent is written \`${SHAPE}\`, as in \`${EXAMPLE}\``);
  if ((key === "expose") || (key === "exposed")) return EXPOSE;
  const id = conditionIdOf(key);
  if (id) return id;
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
      const onRow = context?.itemType === CONDITION_ROW;
      // Immunity to a trait (0.35.0), read before anything else is said of the line: on a
      // Condition's row, alone, and nowhere else yet. The form is known by ANY descriptor that
      // begins it, so two of them on one line, the form on a Talent, and the bare word `trait`
      // are each told what is wrong with THAT, in this order: where the form is read at all, one
      // trait to a line, then the trait's own name (the review of 0.35.0: two descriptors were
      // told to write what they had written, and a Talent was told to write a second line that
      // would then be refused).
      if (e.descriptors.some(isTraitWord)) {
        if (!onRow) {
          throw new RuleSyntaxError(`\`IMMUNE: TRAIT(...)\` is read on a Condition's row for now (the Conditions sheet, as Blinded's \`${TRAIT_EXAMPLE}\`); a Talent's immunity to a trait is not read yet`);
        }
        if (e.descriptors.length !== 1) throw new RuleSyntaxError(ONE_TRAIT);
        const trait = readTrait(e.descriptors[0]);
        try {
          refuseComponents(e.ops, "IMMUNE", []);
        } catch {
          throw new RuleSyntaxError(`\`IMMUNE: TRAIT(...)\` takes nothing after it on a Condition's row yet (no IF:, IFT:, FOR: or LIMIT:): the line acts for whoever has the Condition, so it is written alone, as \`${TRAIT_EXAMPLE}\``);
        }
        return { effect: TRAIT, trait: trait.trait, name: trait.name };
      }
      if (onRow) {
        // A Condition another one counts as would still count, so immunity to a Condition from a
        // Condition's row is only half a rule; it stays unread until that is settled.
        throw new RuleSyntaxError(`on a Condition's row IMMUNE names a trait, as \`${TRAIT_EXAMPLE}\`; immunity to a Condition or an Expose is not read on a Condition's row yet`);
      }
      if (e.descriptors.length !== 1) throw new RuleSyntaxError(`IMMUNE is written \`IMMUNE: <Condition or expose>\`, as in \`IMMUNE: prone\` (${e.descriptors.length} descriptors given, 1 wanted)`);
      refuseComponents(e.ops, "IMMUNE", ["when", "for", "while", "against", "seen", "limit", "marked"]);
      const effect = readEffect(e.descriptors[0]);
      refuseOutcome(e.ops);
      return { effect, when: e.ops.when, for: e.ops.for, while: e.ops.while, against: e.ops.against, seen: e.ops.seen, limit: e.ops.limit, marked: e.ops.marked };
    }
    throw new RuleSyntaxError(`a prevention is an effect: \`[EFFECT ${EXAMPLE}]\``);
  },

  /** `Prone does not land, once each encounter`; `Expose does not land, for allies within 0 ft`. */
  summary(rule) {
    if (rule?.effect === TRAIT) return `immune to anything with the ${rule.name ?? rule.trait} trait`;
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
        // Immunity to a trait (0.35.0): the thing that would land must carry this rule's trait.
        if ((effect === TRAIT) && !hasTrait(context?.threat?.traits, rule.trait)) continue;
        // A Condition held only AGAINST ONE CREATURE (an "against X" inclusion; ../engine.mjs,
        // `conditionCarriers`) holds for that creature's acts and nobody else's, as its bonus
        // lines do (./bonus.mjs): with no other party known, or another one, it prevents nothing.
        const againstOnly = Array.isArray(carrier?.condition?.against) ? carrier.condition.against : null;
        if (againstOnly && !againstOnly.includes(String(context?.other?.uuid ?? ""))) continue;
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
          reaction: carrier?.system?.reaction === true, mark,
          ...((effect === TRAIT) ? { trait: rule.trait, name: rule.name ?? rule.trait } : {})
        });
      }
      return out;
    }
  }
};
