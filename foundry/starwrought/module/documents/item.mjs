/**
 * The Item document. Talents, gear, and Maneuvers all know how to put themselves on the table.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { parseAutomation, ruleEntries } from "../rules/grammar.mjs";
// content.mjs imports config.mjs alone at module scope (its other imports are dynamic), so this
// closes no circle; a static import of this file from there would, and must not be added.
import { resolveRuleTarget, findManeuver } from "../helpers/content.mjs";
// The Maneuvers the system implements, by name (0.10.1): Recenter, Raise a Shield.
import { BUILT_IN_MANEUVERS, CHARACTER_BUILT_INS } from "./maneuvers.mjs";
import { relation as tokenRelation } from "../rules/scene.mjs";
import { usableByRule } from "../rules/engine.mjs";
// Where a Maneuver's cost is settled (0.23.0, `paidElsewhere`), and what a Condition adds to it
// (0.37.0, `rowRaise`): one module, shared with the Maneuvers tab and the build.
import { paidElsewhere, rowRaise, raiseWords, raiseReason } from "../rules/cost.mjs";
import { setting } from "../helpers/settings.mjs";
// A check read against another creature's Threshold (0.15.0; shared with Gain Control since 0.27.0).
import { readTargetThreshold } from "../helpers/threshold-read.mjs";
// 0.35.0: a target immune to a trait the Maneuver carries (a Condition's `IMMUNE: TRAIT(...)`).
import { immunityRecord } from "../rules/prevent.mjs";
// 0.34.0: the check a Maneuver's row declares, and the request its target answers first.
import { planOf } from "../rules/check.mjs";
import { usableDefenses } from "../rules/check-request.mjs";
import { actorFromUuid } from "../helpers/cards.mjs";

// `paidElsewhere(item)`, which lived here through 0.36.0, is rules/cost.mjs's since 0.37.0: the
// Maneuvers tab and the build ask the same question of a row.

/**
 * Why a use costs more than its row prints (0.37.0; rulings 375 to 384), in the few words a
 * spend's label carries: "Heedless +1". Empty when nothing is raised.
 * @param {{raise?: object}|null} plan  `#chargePlan`'s answer.
 */
function raisedBy(plan) {
  return plan?.raise?.extra ? raiseWords(plan.raise) : "";
}

/** The same, as the sentence a card's own line says: "Heedless: Concentrate takes 1 extra action, so ...". */
function raisedLine(plan) {
  return plan?.raise?.extra ? game.i18n.format("STARWROUGHT.Cost.raised", { reason: raiseReason(plan.raise) }) : "";
}

/**
 * The Maneuvers in the middle of being used, as "<actor uuid>|<item uuid>" (0.23.0): `SwItem#use`
 * holds a Maneuver to one use at a time for an actor, so a second click while the first is still
 * asking something is ignored rather than paid for twice.
 * @type {Set<string>}
 */
const USING = new Set();

/** The target's relation to the user's actor, for a `mark` (0.15.0): by the two tokens' dispositions. */
function relationTo(actor, targetToken) {
  const own = actor?.tokenOnScene?.() ?? null;
  if (!own || !targetToken?.document) return null;
  return tokenRelation(own, targetToken.document);
}

export class SwItem extends Item {
  /** @inheritdoc */
  getRollData() {
    const data = this.actor?.getRollData() ?? {};
    data.item = foundry.utils.deepClone(this.system);
    return data;
  }

  /* -------------------------------------------- */

  /** Whether this Item is one of the Talent-like things that costs a Talent Point. */
  get isFeature() {
    return SW.FEATURE_TYPES.includes(this.type);
  }

  /** Whether this Item can be worn or wielded. */
  get isPhysical() {
    return SW.PHYSICAL_TYPES.includes(this.type);
  }

  /* -------------------------------------------- */

  /**
   * The default thing to do when a player clicks the Item: Strike with a weapon, roll the check
   * a Maneuver calls for, or simply post the card.
   *
   * A Basic Maneuver lives in the compendium and is used straight from a character's Maneuvers
   * tab without ever being copied onto the character, so it has no `actor` of its own. The sheet
   * passes the character in `options.actor`, and that character is who rolls and who speaks.
   *
   * **A Maneuver used in an encounter pays its printed cost (0.23.0, rulings 231 to 236; Mike:
   * "Aid's ❶ is not spent by the system ... why not?").** Through 0.22.0 only a Reaction, a
   * built-in and a Maneuver with a use rule paid, and every other was the table's to pay on the
   * pips. Now, in an encounter and with the `trackActions` setting on:
   *  - a range of costs (Leap ❶ to ❸) asks first, one button per number (apps/cost-picker.mjs),
   *    before the Opportunity gate, so a closed pick never spends the GM's permit;
   *  - one or two actions with a check are paid in the roll's `beforeRoll`, once the dialog has
   *    settled: a closed dialog charges nothing;
   *  - one or two with no check are paid at once and the Maneuver's card carries the spend line;
   *  - three or more is Prepared, by the book (`actor.prepare`, kind "maneuver", remembering this
   *    Item): Finish at the next Opportunity comes back here with `prepared: true`, which skips the
   *    gate and the charge and makes the roll or posts the card;
   *  - ⓿ and a passive row (an Activity, an Endeavor) pay nothing;
   *  - a Maneuver the system pays for another way (`paidElsewhere`: Cast, the movement
   *    rows, one whose rule pays from a card button) pays nothing here and its card says who does.
   * Outside an encounter nothing is asked, paid or Prepared. A Maneuver with the Reaction trait
   * (PHB v4.10) keeps its own rule: paid from the same six the moment its Trigger occurs, before
   * any roll.
   *
   * A Maneuver's check names its Constellation (Search's Awareness) or names none: `check.enabled`
   * with a blank `constellation` is a Relevant Check (0.10.0; ruling 123), the book's term for a
   * roll whose Constellation the roller picks and justifies, and Aid is written with one. Both
   * rolls carry the Maneuver as `item`, which is what makes a roll an Aid to the Automation rules
   * (ruling 122: a `bonus ... to Aid` applies to a roll made from Aid's Item, and is only offered
   * on a check made without it).
   *
   * A Maneuver the system implements (Recenter, Raise a Shield, the visor, Pass since 0.23.1, Strike and Reload since 0.29.0;
   * documents/maneuvers.mjs, by the slug of its plain name) runs that behaviour when used (0.10.1): the Action is the entry
   * point, the sheet button and the Macro are other doors to the same method. The behaviour pays
   * its own action and posts its own card, so nothing here does either for it.
   * @param {object} [options]
   * @param {Actor} [options.actor]   Who is using an unowned Item.
   * @param {string} [options.strike] For a weapon: quick | deliberate | committed.
   * @param {boolean} [options.prepared]  For a Maneuver: Finish re-entering a Prepared one (0.23.0),
   *                                      already paid, so nothing is asked, gated or charged.
   */
  async use(options = {}) {
    const { actor: given, ...rest } = options;
    const actor = this.actor ?? given ?? null;
    switch (this.type) {
      case "weapon":
        if (!this.actor) return this.toMessage({ actor });
        return this.actor.rollAttack(this.id, rest);
      case "action": {
        // One use at a time for an actor and a Maneuver (0.23.0): a second click while the first
        // is still asking (the cost pick, the roll dialog, Finish's dialog) is not a second
        // Maneuver. Through 0.22.0 a double-click cost a duplicate card; now it would cost the
        // actions twice.
        const key = `${actor?.uuid ?? ""}|${this.uuid}`;
        if (USING.has(key)) return null;
        USING.add(key);
        try {
          return await this.#useManeuver(actor, rest);
        } finally {
          USING.delete(key);
        }
      }
      case "shield":
        return this.raise();
      case "talent":
        // A spell Talent is cast (PHB v4.21, the Cast Maneuver; `cast` picks ❷ ❸ ❹, Focused by
        // default); a Talent with a cost in its name is USED (0.15.0, ruling 176: the Use button
        // on its row pays the cost in an encounter and runs the kinds' `use` hook, so Oathbound ❶
        // marks its target); any other Talent goes to chat as before.
        if (this.system.isSpell && this.actor && (typeof this.actor.castSpell === "function")) {
          return this.actor.castSpell(this.id, rest);
        }
        if (actor && this.actor && ((this.system.cost !== "passive") || usableByRule(this))) {
          // A Talent used as a Maneuver (0.15.0) passes the Opportunity gate (0.19.0) unless it is
          // a Reaction or a Posture, the book's out-of-turn Maneuvers. The gate is asked and
          // passed inside `#useWithRules`, after the rules' own refusals, so a refused use spends
          // no permit (0.24.0) and asks the GM for none (0.25.0; through 0.24.0 the request card
          // went out here first, even for a use the rules would then refuse).
          const label = `${SW.plainName(this.name)} ${this.system.glyph ?? ""}`.trim();
          const gated = !this.system.reaction && (typeof actor.mayActNow === "function");
          return this.#useWithRules(actor, { gate: gated, label, dialog: rest.dialog });
        }
        return this.toMessage({ actor });
      default:
        return this.toMessage({ actor });
    }
  }

  /* -------------------------------------------- */

  /**
   * Use a Maneuver (an action Item): the body of `use` for one, held to one call at a time per
   * actor and Maneuver by `use` itself.
   * @param {Actor|null} actor  Who is using it.
   * @param {object} rest       The use options, minus `actor`.
   */
  async #useManeuver(actor, rest) {
    // A built-in Maneuver's method (Recenter, Raise a Shield, the visor) passes the Opportunity
    // gate itself, so it is not asked twice.
    // `prepared` is this method's own word (Finish coming back) and never the roll's: the
    // roll dialog reads `cfg.prepared` for a Committed Strike. `partOf` (0.25.0) is the same:
    // this Maneuver is being performed as part of another (`#performSubordinate`), which names
    // the spend, sets the cost and hands over the marks to file once the use stands.
    // `paid` (0.32.0) is Finish's too: the cost the Prepared Maneuver was paid at, which the row's
    // `IF: COST(<n>)` lines read, since nothing is charged on the way back in.
    // `charged` (0.37.0) is Finish's as well: what the Prepared Maneuver was PAID at, which differs
    // from `paid` (the version) when a Condition raised the price. Only the card's glyph reads it.
    const { prepared = false, partOf = null, paid = null, charged = null, ...config } = rest;
    const plain = SW.plainName(this.name);
    const slug = SW.slugify(SW.plainName(this.name));
    // A built-in that is a character's alone (Reload: it loads a weapon Item) is passed by for an
    // adversary, whose row stays the plain Maneuver it was (0.29.0). An own key only: a Maneuver
    // named "Constructor" is no built-in (the review of 0.37.0).
    const builtIn = (!Object.hasOwn(BUILT_IN_MANEUVERS, slug) || (CHARACTER_BUILT_INS.has(slug) && (actor?.type !== "character"))) ? null : BUILT_IN_MANEUVERS[slug];
    if (builtIn && actor) {
      // A built-in pays and posts for itself, so it cannot be handed another Maneuver's cost yet
      // (`#performSubordinate` refuses it first; this is the guard for any other caller).
      if (partOf) return void ui.notifications.warn(game.i18n.format("STARWROUGHT.Subordinate.notYet", { parent: partOf.label, name: plain }));
      return builtIn(actor, this, rest);
    }
    // A Maneuver whose rules act when it is used (0.16.0: Oathbound's `MARK`, granted by a
    // Talent's `[MANEUVER Oathbound]`) is paid and run as a Talent with such rules is.
    const byRule = !!actor && !!this.actor && usableByRule(this);
    const elsewhere = paidElsewhere(this);
    // What this use will be paid at (0.23.0), asked BEFORE the gate: a range of costs is the
    // player's pick, and a pick that is closed must not have spent the GM's permit. A subordinate
    // (0.25.0; Mike's Subordinate Maneuver rule) is paid at its parent's listed cost and never
    // its own: ⓿ for an Aid made as part of Pay It Forward.
    // `picked` (0.32.0): the number IS the cost of this use, nought included, which a line that
    // waits on the cost paid reads. A subordinate's is its parent's wherever actions are counted.
    const counted = !!actor?.inEncounter && !!actor.system?.actions && setting("trackActions", true);
    const plan = (prepared || byRule) ? { n: 0, note: null, cancelled: false }
      : partOf ? { n: this.#subordinateCost(actor, partOf), note: null, cancelled: false, picked: counted }
        : await this.#chargePlan(actor, elsewhere);
    if (plan.cancelled) return null;
    // What the row's APPLY and REMOVE lines will read (0.32.0; rulings 318 and 321). Never on a
    // row the system runs another way (a Rush is the drag, not a use of its row): such a row
    // applies nothing, and the build warns about the line. The cost is the one this use is paid
    // at; where nothing is paid (outside an encounter, or with `trackActions` off) a row whose
    // lines wait on the cost is asked which version this is, and a closed pick ends the use.
    const applying = !!actor && !elsewhere && (this.system.rules ?? []).some(r => r?.kind === "apply");
    let applyCost = null;
    if (applying) {
      applyCost = await this.#applyCost(plan, paid);
      if (applyCost === undefined) return null;
    }
    // The label carries the number chosen: a range row's own glyph is "❶ to ❸". A subordinate is
    // named for its parent, which is what the table is paying for.
    // A RAISED COST SAYS WHY (0.37.0): "Seek ❷ (Heedless +1)". The label is what the GM's leave
    // card, the spend card, the overspend card and a check's request all print, so the reason
    // reaches each of them from here.
    const why = raisedBy(plan);
    const label = partOf ? String(partOf.label ?? plain)
      : `${plain} ${plan.n ? (SW.ACTION_GLYPHS[plan.n] ?? "") : (this.system.glyph ?? "")}${why ? ` (${why})` : ""}`.trim();
    // The check this Maneuver rolls (0.34.0): its `[CHECK ...]` block, else the three stored
    // fields (rules/check.mjs, `planOf`; the data model derives it as `system.checkPlan`).
    const check = this.system.checkPlan ?? planOf(this.system.rules, this.system.check);
    const rolls = !!actor && check.enabled;
    // Outside the actor's Opportunity a Maneuver that is not a Reaction waits for the GM
    // (0.19.0, the gate in documents/actor/actions.mjs); a Reaction is the book's own
    // out-of-turn Maneuver and goes straight on, and so does Finish, which was never gated.
    // A row that only shows its card because the system pays for it elsewhere performs
    // nothing, so it asks nothing (0.23.0): the Strike, the Cast and the drag pass the gate
    // themselves, and through 0.22.0 the row had already spent the GM's permit by then.
    // A subordinate is gated as its PARENT is (0.25.0): the parent's use passed nothing on the
    // way here, so that the one gate is passed where the cost is paid.
    const gated = !!actor && (typeof actor.mayActNow === "function") && (partOf
      ? (partOf.gated === true)
      : (!prepared && !this.system.reaction && !(elsewhere && !rolls)));
    // A Maneuver that rolls passes the gate when the roll is made (0.23.0): here it is only
    // asked whether it may, so a roll dialog that is closed has not spent the permit either.
    // Asked now when the answer is no, since the request card is what the click is for then.
    const atRoll = gated && rolls && !byRule && (plan.n < SW.PREPARED_THRESHOLD);
    // A Maneuver with a use rule passes the gate inside `#useWithRules`, after its rules have had
    // their say (0.24.0): through 0.23.1 a use the rules then refused (Move Together with nobody
    // targeted) had already spent the GM's permit.
    // Since 0.25.0 it is not ASKED here either: `#useWithRules` sends the request card itself when
    // the answer is no, after the refusals, so a use the rules refuse outright (Pay It Forward
    // off-turn, which its trigger can never allow) no longer asks the GM for leave it cannot use.
    if (gated && !byRule && !(atRoll && actor.canActNow()) && !(await actor.mayActNow({ label }))) return null;
    if (byRule) return this.#useWithRules(actor, { gate: gated, label, dialog: config.dialog, partOf, applyCost: applying ? applyCost : undefined });
    if (this.system.reaction && actor && !elsewhere && !partOf) {
      // A Reaction with a cost of its own pays that one; otherwise the cost printed. One whose
      // rule pays from a card button is left to that button (0.23.0), or the row and the
      // button would both pay.
      const own = this.system.reactionCost;
      const key = (own !== undefined && own !== null && own !== "") ? own : this.system.cost;
      const n = SW.actionCostValue(key);
      if (n) {
        // The plain name, so the glyph appended here is the only one (0.5.1, T16).
        await actor.spendActions(n, { label: `${plain} ${this.system.glyph ?? ""}`.trim() });
      }
    }
    // Three or more actions is Prepared (PHB v4.24; ruling 234): two now, the rest reserved,
    // and nothing rolls until Finish at the next Opportunity brings this Item back here. The
    // label is the plain name: the sheet and the round's card print the cost beside it.
    // A cost a Condition raised to three is Prepared as any other (0.37.0, ruling 376; Mike: "by
    // the book"). The preparation remembers BOTH numbers: `cost`, what is paid, and `listed`, the
    // version of the Maneuver used, which Finish hands back for the row's `IF: COST(<n>)` lines.
    if ((plan.n >= SW.PREPARED_THRESHOLD) && !partOf) {
      return actor.prepare({
        kind: "maneuver", label: plain, cost: plan.n, itemUuid: this.uuid,
        targetUuid: SwCheck.currentTarget()?.document?.uuid ?? "",
        ...(Number.isInteger(plan.listed) ? { listed: plan.listed } : {}),
        ...(why ? { note: raisedLine(plan) } : {})
      });
    }
    // A Maneuver that rolls: the gate is passed and the cost paid once the dialog has settled,
    // so a dialog that is closed spends nothing, neither actions nor the GM's permit (ruling
    // 232). A caller's own `beforeRoll` runs first and may stop the roll; a permit that went
    // to another Maneuver while this dialog stood open sends the request card and stops it too.
    // A subordinate that rolls (0.25.0): the same moment files what its parent handed over (the
    // parent's LIMIT, the used Effect it spends), so a closed dialog has spent none of it either.
    if (atRoll || (partOf && rolls)) {
      const callers = config.beforeRoll;
      config.beforeRoll = async cfg => {
        if (typeof callers === "function") {
          const go = await callers(cfg);
          if (go === false) return false;
        }
        if (atRoll && !(await actor.mayActNow({ label }))) return false;
        if (plan.n) await actor.spendActions(plan.n, { label });
        if (partOf) await this.#fileSubordinateMarks(actor, partOf);
        return true;
      };
    }
    // What the card says of the cost: the Maneuver's own glyph and group, or (a subordinate) the
    // Maneuver it is part of, since that is who paid.
    // A raised cost shows what is paid (0.37.0): the row's own glyph would say ❶ beside a spend
    // card that says ❷.
    // At Finish nothing is charged, so the plan knows of no raise: a Maneuver Prepared at a raised
    // price says the price it was Prepared at, as its Prepared card did (the review of 0.37.0).
    const finishedAt = (prepared && Number.isInteger(charged) && Number.isInteger(paid) && (charged > paid)) ? charged : null;
    const paidGlyph = why ? (SW.ACTION_GLYPHS[plan.n] ?? this.system.glyph)
      : (finishedAt !== null) ? (SW.ACTION_GLYPHS[finishedAt] ?? this.system.glyph) : this.system.glyph;
    // An actor whose spends are not announced (a GM's adversary) posts no spend card, which is
    // where a character's reason is read ("Seek ❷ (Heedless +1)"): its check card says it instead.
    const unsaid = (why && actor && !actor.announcesSpends) ? ` (${why})` : "";
    const subtitle = partOf?.note ? String(partOf.note) : `${paidGlyph} ${this.system.category}${unsaid}`.trim();
    // What the roll hands the check engine for the row's APPLY and REMOVE lines (0.32.0): the cost
    // paid and the one creature targeted. The engine reads the lines after the die and the card
    // carries them (dice/check.mjs; documents/cards/apply.mjs).
    const applies = applying ? { applies: { cost: applyCost, target: this.#applyTarget(actor) } } : {};
    // The check (0.34.0): what is rolled is the user's pick where the row names a choice, what
    // it is read against is the target's; `#startCheck` settles both and rolls, or posts the
    // request the target answers first (documents/cards/check-request.mjs).
    if (rolls) {
      // A subordinate's roll carries its parent's traits (0.35.0), in the roll's own config.
      if (Array.isArray(partOf?.traits) && partOf.traits.length) config.partOfTraits = [...partOf.traits];
      return this.#startCheck(actor, {
        check, config, subtitle, note: partOf?.note ? String(partOf.note) : "", applies,
        cost: plan.n, label, prepared, paid, partOf,
        // What a request card's head prints when the cost was raised (0.37.0).
        ...((why || (finishedAt !== null)) ? { glyph: paidGlyph } : {}),
        // How the resumed roll passes the gate: not at all when this use has passed it already
        // (or needs none); else at the roll, as a use with no request does.
        gate: atRoll ? "roll" : "none"
      });
    }
    // No check: the card is the Maneuver. One or two actions are paid here and said on the
    // card itself, as Recenter and Raise a Shield say theirs, so the table reads one card; a
    // row paid elsewhere says who pays; a Prepared one finished says it was paid already.
    const lines = [];
    if (plan.n && actor) {
      await actor.spendActions(plan.n, { label, announce: false });
      if (actor.announcesSpends) {
        lines.push(`${game.i18n.format("STARWROUGHT.Actions.spent", { name: actor.name, spent: plan.n })} ${actor.actionsLeftLine?.() ?? ""}`.trim());
      }
      // The card's head prints the row's own cost: say why more was spent (0.37.0). Said for an
      // adversary too, whose spend line is not (the review of 0.37.0): its Prepared card and its
      // Recenter card say the reason, and a card with the row's ❶ on it and two pips gone said
      // nothing.
      if (why) lines.push(raisedLine(plan));
    }
    if (plan.note) lines.push(plan.note);
    if (prepared) lines.push(game.i18n.localize("STARWROUGHT.Cost.preparedPaid"));
    // A subordinate with no roll (0.25.0): it stands the moment it is used, so what its parent
    // handed over is filed here, and its card says whose part it is.
    if (partOf && actor) {
      await this.#fileSubordinateMarks(actor, partOf);
      if (partOf.note) lines.push(String(partOf.note));
    }
    // What using it puts on the user, and takes off (0.32.0): the row's lines of no degree, now
    // that the use has stood and its cost is paid (Stand ends Prone; Drop Prone begins it).
    if (applying) lines.push(...(await this.#applyOnUse(actor, { cost: applyCost })));
    return this.toMessage({ actor, lines });
  }

  /**
   * The cost a use's `IF: COST(<n>)` lines read (0.32.0; ruling 318): what Finish says was paid,
   * else what this use is paid at, else (nothing is paid here: outside an encounter, or with the
   * `trackActions` setting off) the row's one cost, or the player's pick of the version when the
   * row prints a range and a line waits on it. Null when no line asks and nothing was paid;
   * undefined when the pick was closed, which ends the use.
   * @param {{n: number, picked?: boolean}} plan  `#chargePlan`'s answer.
   * @param {number|null} paid                    The cost a Prepared Maneuver was paid at.
   * @returns {Promise<number|null|undefined>}
   */
  async #applyCost(plan, paid) {
    if (Number.isInteger(paid) && (paid >= 0)) return paid;
    // THE VERSION USED, never a raised price (0.37.0, ruling 380): `listed` is the row's own cost
    // for this use, `n` what a Condition made of it. A plan with no `listed` was never raised.
    if (plan?.picked || plan?.n) return Number.isInteger(plan.listed) ? plan.listed : plan.n;
    // A Reaction pays its own half where the row prints one ("❶ (⓿↺)" pays nought), and that
    // is the cost its lines read, in an encounter or out of one.
    if (this.system.reaction) {
      const own = this.system.reactionCost;
      return SW.actionCostValue((own !== undefined && own !== null && own !== "") ? own : this.system.cost);
    }
    const waits = (this.system.rules ?? []).some(r => (r?.kind === "apply") && (r.cost !== null) && (r.cost !== undefined));
    if (!waits) return null;
    const options = SW.actionCostOptions(this.system);
    if (!options.length) return null;
    if (options.length === 1) return options[0];
    const { pickCost } = await import("../apps/cost-picker.mjs");
    const n = await pickCost({ name: SW.plainName(this.name), options });
    return (n === null) ? undefined : n;
  }

  /**
   * The one creature a Maneuver's `APPLY: ..., target` lines are about (0.32.0), read when the
   * Maneuver is used: the one token the user has targeted, when it is not the user's own body.
   * Any creature, an adversary too. Null with no target or several; the card's button then reads
   * the presser's target when it is pressed.
   * @param {Actor} actor  Who is using the Maneuver.
   * @returns {{uuid: string, name: string}|null}
   */
  #applyTarget(actor) {
    const token = SwCheck.currentTarget();
    const target = token?.actor;
    if (!target || (target.uuid === actor?.uuid)) return null;
    if ((target.id === actor?.id) && !(target.isToken && actor?.isToken)) return null;
    return { uuid: target.uuid, name: token.name };
  }

  /**
   * Apply a row's lines that wait on no result, as the Maneuver is used (0.32.0; rulings 315 and
   * 321): every `APPLY` and `REMOVE` line with no `IF: RESULT`, about the user (a line about a
   * target needs a check and its card). Called where the use has stood and its cost is paid, by
   * the no-check path and by `#useWithRules`; a movement row could call it later. The user's own
   * act is never prevented (`force`): Dropping Prone by choice is not stopped by an `IMMUNE` line
   * and does not use it up. Answers the lines for the Maneuver's own card.
   * @param {Actor} actor
   * @param {{cost?: number|null}} [use]
   * @returns {Promise<string[]>}
   */
  async #applyOnUse(actor, { cost = null } = {}) {
    if (!actor || !(actor.isOwner || game.user.isGM)) return [];
    try {
      const { ruleApplies } = await import("../rules/engine.mjs");
      const { linesFor, wordsToSay } = await import("../rules/applied.mjs");
      const asked = ruleApplies(actor, { item: this, rank: null });
      const own = line => line.who !== "target";
      // A line on Skip is passed over once, by the use it would have stood for.
      const skipped = asked.skipped.filter(s => own(s.line) && linesFor([s.line], { degree: null, cost }).length);
      if (skipped.length) {
        const { writeRuleMarks } = await import("../rules/scene.mjs");
        await writeRuleMarks(actor, skipped.flatMap(s => s.marks));
      }
      const standing = linesFor(asked.lines.filter(own), { degree: null, cost });
      if (!standing.length) return [];
      const { applyLinesTo } = await import("./cards/apply.mjs");
      const done = await applyLinesTo(actor, standing, {
        giver: actor,
        maneuver: { slug: SW.slugify(SW.plainName(this.name)), name: SW.plainName(this.name) },
        from: null, force: true
      });
      // A REMOVE that found nothing is not said beside a line that did something (0.32.1): Stand
      // carries one for Prone and one for Supine, and the creature has one of the two.
      return wordsToSay(done);
    } catch (error) {
      console.error(`STARWROUGHT | ${this.name}: what the Maneuver applies could not be written:`, error);
      return [];
    }
  }

  /**
   * What a subordinate Maneuver is paid at (0.25.0; ruling 245): its PARENT's listed cost, which
   * `#performSubordinate` hands over, and nothing outside an encounter or with the `trackActions`
   * setting off, as every sheet Maneuver (`#chargePlan`).
   * @param {Actor|null} actor
   * @param {{cost?: number}} partOf
   * @returns {number}
   */
  #subordinateCost(actor, partOf) {
    if (!actor?.inEncounter || !actor.system?.actions || !setting("trackActions", true)) return 0;
    return Math.max(0, Number(partOf?.cost) || 0);
  }

  /**
   * File what a parent Maneuver handed its subordinate (0.25.0): the parent's LIMIT, a Skip or a
   * one-roll effect its alteration owes, the used Effect it spends. Called where the subordinate's
   * use stands (its roll's `beforeRoll`, or at once when it has no roll), never before.
   * @param {Actor} actor
   * @param {{marks?: Array<{key: string, per: string}>}} partOf
   */
  async #fileSubordinateMarks(actor, partOf) {
    const marks = Array.isArray(partOf?.marks) ? partOf.marks : [];
    if (!marks.length || !(actor.isOwner || game.user.isGM)) return;
    const { writeRuleMarks } = await import("../rules/scene.mjs");
    await writeRuleMarks(actor, marks).catch(err => console.error("STARWROUGHT | the subordinate Maneuver's rule marks could not be written", err));
  }

  /* -------------------------------------------- */

  /**
   * What a Maneuver's use will be paid at, and what its card should say about that (0.23.0;
   * rulings 231, 233, 235, 236). Nothing is paid outside an encounter, with the `trackActions`
   * setting off (the table has asked for no automatic spending), by a Reaction (its own branch pays
   * at once, as before), by a passive row (an Activity, an Endeavor) or by a row the system pays
   * another way, which says so on its card instead. A range of costs is asked of the player, and a
   * closed pick comes back `cancelled`: the use stops there, before the gate.
   *
   * WHAT A CONDITION ADDS (0.37.0; rulings 375 to 384; Heedless: "Maneuvers with Concentrate take
   * 1 extra action") is added HERE and nowhere else on this path, at the two answers that are a
   * cost of the use (`picked`): a fixed cost and a picked one. So a row this method never charges
   * is never raised either (a passive row, a Reaction, one paid elsewhere), by construction.
   * `listed` is the row's own cost for this use, the version of the Maneuver; `n` is what is
   * paid; `raise` says by how much and by which Condition (rules/cost.mjs, `rowRaise`, the same
   * function the Maneuvers tab asks, so the two agree).
   * @param {Actor|null} actor
   * @param {string|null} elsewhere  `paidElsewhere(this)`: the i18n key of who pays, or null.
   * @returns {Promise<{n: number, note: string|null, cancelled: boolean, picked?: boolean, listed?: number, raise?: object}>}
   */
  async #chargePlan(actor, elsewhere) {
    const none = { n: 0, note: null, cancelled: false };
    if (!actor?.inEncounter || !actor.system?.actions) return none;
    if (!setting("trackActions", true)) return none;
    if (elsewhere) return { ...none, note: game.i18n.localize(elsewhere) };
    if (this.system.reaction) return none;
    const options = SW.actionCostOptions(this.system);
    if (!options.length) return none;
    const raise = rowRaise(actor, this);
    const extra = raise.extra;
    // `picked` (0.32.0): this number IS the cost of the use, nought included, so a line that
    // waits on the cost paid reads it and nothing asks a second time.
    if (options.length === 1) return { ...none, n: options[0] + extra, listed: options[0], picked: true, raise };
    const { pickCost } = await import("../apps/cost-picker.mjs");
    // The picker shows what each version will cost and answers the version (0.37.0).
    const n = await pickCost({ name: SW.plainName(this.name), options, extra, why: extra ? raiseReason(raise) : "" });
    return (n === null) ? { ...none, cancelled: true } : { ...none, n: n + extra, listed: n, picked: true, raise };
  }

  /**
   * Use a Talent or a Maneuver that carries a cost or a rule that acts on use (0.15.0, ruling 176;
   * a Maneuver since 0.16.0). The kinds' `use` hook answers first (module/rules/engine.mjs,
   * `ruleUses`): a refusal (Oathbound with no target) is a notice and nothing is paid; otherwise
   * the cost in the Item's name is paid in an encounter (the Reaction half's own when it has one),
   * the writes land on the owner, and the Item's card goes out with the kinds' lines under it. An
   * Item with no `use` rules still pays and posts.
   *
   * Since 0.24.0 (Move Together's `PERMIT`): the hooks are handed the scene and the target's token
   * (so a kind can measure a gap without touching the canvas), the running Opportunity, and a nonce
   * that names this use; an answer may carry `warn` lines, printed on the card as warnings while
   * the use still happens, and `marks`, a LIMIT filed as FIRST and ONCE are; the Opportunity gate
   * is passed here, after the refusals, so a refused use spends no permit; the payment honours the
   * `trackActions` setting (ruling 236; through 0.23.1 this path paid whatever the setting said);
   * and the spend is said on the Item's own card, as a no-roll Maneuver's is since 0.23.0, in
   * place of a second card.
   *
   * Since 0.25.0 (Pay It Forward's `SUBORDINATE`; Mike's Subordinate Maneuver rule): an answer may
   * carry `perform`, the Maneuver this use performs as part of itself. Then this Item posts no card
   * and pays nothing here: `#performSubordinate` finds the Maneuver and uses it with this Item's
   * cost, name and marks (`partOf`), so the one roll is the subordinate's, under the parent's name,
   * and nothing is spent until that roll is made. And an Item with use rules may itself BE a
   * subordinate (`partOf` handed in): it is then paid at its parent's cost and files its parent's
   * marks with its own.
   * @param {Actor} actor
   * @param {object} [options]
   * @param {boolean} [options.gate=false]  Pass the Opportunity gate once the rules have not refused.
   * @param {string} [options.label]        The Maneuver as the gate and the spend name it.
   * @param {boolean} [options.dialog]      Handed on to a subordinate's roll (false on a Shift-click).
   * @param {object|null} [options.partOf]  This Item is being performed as part of another.
   */
  async #useWithRules(actor, { gate = false, label = "", dialog = undefined, partOf = null, applyCost = undefined } = {}) {
    const { ruleUses } = await import("../rules/engine.mjs");
    const { encounterContext, sceneContextFor, writeRuleMarks } = await import("../rules/scene.mjs");
    const targetToken = SwCheck.currentTarget();
    const target = targetToken ? {
      actor: targetToken.actor, uuid: targetToken.actor?.uuid ?? null, tokenUuid: targetToken.document.uuid,
      tokenId: targetToken.document.id, token: targetToken.document,
      name: targetToken.name, relation: relationTo(actor, targetToken),
      inEncounter: !!targetToken.actor?.inEncounter
    } : null;
    const encounter = encounterContext();
    const uses = ruleUses(actor, this, { target, encounter, scene: sceneContextFor(actor), nonce: foundry.utils.randomID() });
    const refused = uses.find(u => u.refuse);
    if (refused) return void ui.notifications.warn(refused.refuse);
    const named = label || `${SW.plainName(this.name)} ${this.system.glyph ?? ""}`.trim();
    const own = this.system.reactionCost;
    const key = (this.system.reaction && own !== undefined && own !== null && own !== "") ? own : this.system.cost;
    // A subordinate is paid at its parent's listed cost and never its own (0.25.0, ruling 245).
    const n = partOf ? Math.max(0, Number(partOf.cost) || 0) : SW.actionCostValue(key);
    // This use performs another Maneuver as part of itself (0.25.0): before the gate and before
    // any payment, since both belong to the subordinate's roll.
    if (uses.some(u => u.perform)) {
      if (partOf) return void ui.notifications.warn(game.i18n.format("STARWROUGHT.Subordinate.nested", { parent: partOf.label, name: SW.plainName(this.name) }));
      return this.#performSubordinate(actor, uses, { gate, named, cost: n, dialog });
    }
    if (gate && (typeof actor.mayActNow === "function") && !(await actor.mayActNow({ label: named }))) return null;

    const lines = [];
    if (n && actor.inEncounter && setting("trackActions", true) && (typeof actor.spendActions === "function")) {
      await actor.spendActions(n, { label: named, announce: false });
      if (actor.announcesSpends) {
        lines.push(`${game.i18n.format("STARWROUGHT.Actions.spent", { name: actor.name, spent: n })} ${actor.actionsLeftLine?.() ?? ""}`.trim());
      }
    }
    const update = {};
    const warns = [];
    const marks = [];
    for (const u of uses) {
      if (u.write) Object.assign(update, u.write);
      if (u.say) lines.push(u.say);
      if (u.warn?.length) warns.push(...u.warn);
      if (u.marks?.length) marks.push(...u.marks);
    }
    // As a subordinate (0.25.0): the parent's marks are filed with this use, which has now stood,
    // and the card says whose part it is.
    if (partOf) {
      if (Array.isArray(partOf.marks)) marks.push(...partOf.marks);
      if (partOf.note) lines.push(String(partOf.note));
    }
    if (actor.isOwner || game.user.isGM) {
      if (Object.keys(update).length) await actor.update(update, { swAnnounced: true });
      if (marks.length) await writeRuleMarks(actor, marks, encounter);
    }
    // A Maneuver with a use rule and APPLY lines of no degree (0.32.0): they stand with the use.
    // (`applyCost` is handed over only by a Maneuver's row; a Talent used this way has no such line.)
    if (applyCost !== undefined) lines.push(...(await this.#applyOnUse(actor, { cost: applyCost ?? (n || null) })));
    return this.toMessage({ actor, lines, warns });
  }

  /**
   * Perform another Maneuver as part of this one (0.25.0; rulings 245 and 246; Mike's Subordinate
   * Maneuver rule: "any time a maneuver says to perform another maneuver as part of it, it is at
   * the original maneuver's listed cost ... unless otherwise specified"). The `subordinate` kind's
   * `use` hook has answered `perform` and has not refused (rules/kinds/subordinate.mjs). This Item
   * posts no card of its own: the subordinate's use is the Maneuver, with this Item's name on the
   * spend and the card, this Item's cost in place of its own, and this use's marks (the LIMIT, the
   * used Effect it spends) filed where that use stands. So for an Aid made as part of Pay It
   * Forward, a roll dialog that is closed has paid nothing and used nothing up.
   *
   * What this version does not perform, each told so by name and nothing done: a built-in (Recenter,
   * Raise a Shield: it pays and posts for itself), a row the system pays another way (a Strike, a
   * Cast, a Move: the drag or the weapon pays), and a parent whose own cost is three or more (it
   * would be Prepared, and Finish does not come back through here yet).
   * @param {Actor} actor
   * @param {Array<object>} uses   `ruleUses`' answers for this use, none a refusal.
   * @param {object} options
   * @param {boolean} options.gate   Whether the parent passes the Opportunity gate.
   * @param {string} options.named   The parent as the gate and the spend name it ("Pay It Forward ⓿").
   * @param {number} options.cost    The parent's listed cost.
   * @param {boolean} [options.dialog]
   */
  async #performSubordinate(actor, uses, { gate, named, cost, dialog }) {
    const performs = uses.filter(u => u.perform);
    const perform = performs[0].perform;
    const F = (key, data) => game.i18n.format(key, data);
    if (performs.length > 1) ui.notifications.warn(F("STARWROUGHT.Subordinate.oneOnly", { parent: named, name: perform.name }));
    const target = await findManeuver(actor, perform.slug);
    if (!target) return void ui.notifications.warn(F("STARWROUGHT.Subordinate.missing", { parent: named, name: perform.name }));
    const sub = SW.plainName(target.name);
    const counted = !!actor?.inEncounter && setting("trackActions", true);
    if (BUILT_IN_MANEUVERS[perform.slug] || paidElsewhere(target) || (counted && (cost >= SW.PREPARED_THRESHOLD))) {
      return void ui.notifications.warn(F("STARWROUGHT.Subordinate.notYet", { parent: named, name: sub }));
    }
    // What the kinds had to say goes to the user as notices: there is no card of this Item's own.
    const update = {};
    const marks = [];
    for (const u of uses) {
      // A second SUBORDINATE line is not performed in this version, so nothing of it is counted:
      // its limit and the used Effect it would spend stay as they are (the review of 2026-11-15).
      if (u.perform && (u !== performs[0])) continue;
      if (u.write) Object.assign(update, u.write);
      for (const warn of u.warn ?? []) ui.notifications.warn(warn);
      if (u.say) ui.notifications.info(u.say);
      if (u.marks?.length) marks.push(...u.marks);
    }
    // Another kind's write on the same row (a MARK beside the SUBORDINATE) is that kind's own act
    // at the use, as it always was; the marks wait for the subordinate's roll.
    if (Object.keys(update).length && (actor.isOwner || game.user.isGM)) await actor.update(update, { swAnnounced: true });
    return target.use({
      actor,
      ...((dialog === undefined) ? {} : { dialog }),
      // `traits` (0.35.0): the parent's own traits, which the subordinate's roll carries with
      // its own, so a creature immune to the parent's trait is immune to what it performs.
      partOf: { label: named, cost, marks, gated: gate === true, note: F("STARWROUGHT.Subordinate.partOf", { parent: named }), traits: [...(this.system.traits ?? [])] }
    });
  }

  // `#findManeuver`, which lived here through 0.36.0, is `findManeuver` in helpers/content.mjs
  // since 0.37.0: Recenter's own method reads its row the same way.

  /**
   * The ally a Maneuver that GIVES a result is made for (0.22.0), as roll config: the one token
   * the user has targeted, when its Actor is a character other than the roller. The check card
   * then offers the result to that character in one click (documents/cards/give.mjs); with no
   * such target it asks who. Named `ally`, never `targetUuid`: a target is the roll's other
   * party to the rules (`MARKED`, a Threshold read), and the ally of an Aid is neither.
   * @param {Actor} actor  The roller.
   * @returns {{ally: {uuid: string, name: string}}|{}}
   */
  #allyFor(actor) {
    if (!(this.system.rules ?? []).some(r => r?.kind === "give")) return {};
    const token = SwCheck.currentTarget();
    const target = token?.actor;
    if (!target || (target.type !== "character") || (target.uuid === actor?.uuid)) return {};
    // A token's Actor and the world Actor it is drawn from are one body (an unlinked token reads
    // its base Actor's flags): the roller's own token is no ally either way.
    if ((target.id === actor?.id) && !(target.isToken && actor?.isToken)) return {};
    return { ally: { uuid: target.uuid, name: token.name } };
  }

  /* -------------------------------------------- */
  /*  The check a Maneuver rolls (0.34.0)         */
  /* -------------------------------------------- */

  /**
   * Settle a Maneuver's check and roll it (0.34.0; rulings 337 to 349), from the plan its row
   * declares (`[CHECK Athletics or Acrobatics vs Evade or Guard]`) or its stored fields come to.
   *
   *  - WHAT IS ROLLED is the user's own pick where the row names a choice (ruling 338): a short
   *    window lists those Constellations with their totals; `relevant` opens the whole list, with
   *    its reason, as a Relevant Check always has.
   *  - WHAT IT IS READ AGAINST is the target's pick where the row names two Defenses: with one
   *    token targeted, a request card goes out and the target's player answers it (the GM for an
   *    adversary), and the roll follows the answer (`resumeCheck`). No Defense is ever chosen by
   *    the system (ruling 159): only when the target can use exactly ONE of those named is nobody
   *    asked. One Defense named is read as it stands, unavailable or not, and the card says so.
   *  - With no token targeted nothing is read and the Threshold is typed, as it always was.
   *
   * An adversary's Maneuver goes its own way (`#startAdversaryCheck`): players always roll
   * against adversaries (ruling 340).
   *
   * @returns {Promise<object|null>}  The roll's result; `{ pending: true, message }` when a
   *   request went out and the roll waits on its answer; null when a window was closed.
   */
  async #startCheck(actor, how) {
    // A roll, a payment and a request are the creature's owner's to make (the review of 0.34.0:
    // an Observer could press an adversary's new Use control).
    if (!actor.isOwner) return void ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    if (actor.type !== "character") return this.#startAdversaryCheck(actor, how);
    const { check, config, subtitle, note, applies } = how;
    const token = SwCheck.currentTarget();
    const target = token?.actor ?? null;
    const facing = !!target && (check.defenses.length > 0);

    // The user's own pick.
    let rolled = (!check.relevant && (check.rolls.length === 1)) ? check.rolls[0] : null;
    let line = "";
    let typed = check.threshold;
    let typedInPicker = false;
    if (!rolled) {
      const picked = await actor.pickConstellation({
        only: check.relevant ? null : check.rolls.map(roll => roll.slug),
        // A caller's `slug` is what the picker opens on, as it always was for a Relevant Check.
        slug: config.slug ?? null,
        item: this,
        threshold: check.threshold ?? config.threshold ?? null,
        // A Defense is about to be read, so no number is typed.
        askThreshold: !facing,
        dialog: config.dialog
      });
      if (!picked) return null;
      rolled = { slug: picked.slug, name: picked.name };
      line = picked.line;
      if (picked.threshold !== null) {
        typed = picked.threshold;
        typedInPicker = true;
      }
    }
    // The picker's line is the approval surface (which Constellation, and why); a subordinate's
    // note rides beside it. With no pick the card says the Maneuver's own cost and group.
    const said = line ? [line, String(note ?? "").trim()].filter(Boolean).join(" · ") : subtitle;

    // The target's pick.
    let defense = null;
    if (facing) {
      const usable = usableDefenses(check.defenses, key => target.system?.defenses?.[key]?.unavailable);
      if (check.defenses.length === 1) defense = check.defenses[0];
      else if (usable.length === 1) defense = usable[0];
      else return this.#askTarget(actor, how, { token: token.document, rolled, line: said });
    }
    return this.#rollPlanned(actor, {
      rolled, defense, permitted: check.defenses, token: token?.document ?? null,
      threshold: typed, typed: typedInPicker, subtitle: said, applies, ally: this.#allyFor(actor), config
    });
  }

  /**
   * The row names two Defenses the target can use: ask the target (0.34.0; rulings 338 and 339).
   * A request card goes out with a button for each, the target's player answers it (the GM for a
   * creature no player owns), and the roll follows the answer (`resumeCheck`).
   * @returns {Promise<{pending: true, message: ChatMessage}|null>}
   */
  async #askTarget(actor, how, { token, rolled, line }) {
    // A Maneuver performed as part of another hands over marks to file when the roll is made
    // (the parent's LIMIT, the Effect it spends): a roll that waits on another player's answer
    // is the most intricate road for those, and no row needs it yet.
    if (how.partOf) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.CheckRequest.notAsPart", { name: SW.plainName(this.name), parent: how.partOf.label ?? "" }));
      return null;
    }
    const { postCheckRequest } = await import("./cards/check-request.mjs");
    return postCheckRequest({
      mode: "answer", user: actor, item: this, token, rolled, line,
      defenses: how.check.defenses,
      cost: how.cost, label: how.label, glyph: how.glyph,
      // Where the gate is still to be passed (a Maneuver that rolls passes it at the roll): begun
      // at the user's own Opportunity, the request stands whenever the answer comes; begun on
      // the GM's leave, that leave is spent when the roll is made.
      gate: (how.gate !== "roll") ? "none" : ((game.user.isGM || !actor.inEncounter || actor.isTurn) ? "turn" : "permit"),
      applies: how.applies?.applies ?? null, ally: this.#allyFor(actor).ally ?? null,
      prepared: how.prepared === true, paid: how.paid ?? null,
      dialog: how.config?.dialog
    });
  }

  /**
   * Roll the check, everything settled (0.34.0): the Constellation, the Defense read (when a
   * creature is targeted and one was named or answered), else the Threshold the row or the
   * window gave. A check against a target's Threshold (0.15.0, ruling 179) reads that target's
   * live number through the fold the attack flow uses (`defenseThresholdFor`, with the check's
   * Constellation as the Threat and the roller as the other party, so `AGAINST(Intimidation)` and
   * `MARKED` apply); the number prints for a character target or a GM roller and is withheld for
   * an adversary as the flow withholds it.
   * @param {Actor} actor
   * @param {object} how
   * @param {{slug: string, name: string}} how.rolled
   * @param {string|null} [how.defense]     The Defense read, a key of SW.DEFENSES.
   * @param {string[]} [how.permitted]      The Defenses the row names.
   * @param {TokenDocument|null} [how.token]  The target.
   * @param {number|null} [how.threshold]   A Threshold to open on, when no Defense is read.
   * @param {string} [how.subtitle]
   * @param {object} [how.applies]          `{ applies: { cost, target } }`, or `{}`.
   * @param {object} [how.ally]             `{ ally }`, or `{}`.
   * @param {boolean} [how.typed]           The Threshold was typed in this use's own picker, so
   *   it stands over a caller's.
   * @param {boolean} [how.answered]        The Defense is the target's own answer to a request.
   * @param {object} [how.config]           The caller's roll options (`beforeRoll`, `dialog`, ...).
   * @param {object} [how.extra]            More roll config (`checkRequest`).
   */
  async #rollPlanned(actor, how) {
    // The traits this use carries (0.35.0): the Maneuver's own, with its parent's when it is
    // performed as part of one (`partOf.traits`, which the roll's own `beforeRoll` closure knows
    // nothing of, so they ride in the caller's config).
    const traits = [...(this.system.traits ?? []), ...(Array.isArray(how.config?.partOfTraits) ? how.config.partOfTraits : [])];
    const read = (how.defense && how.token?.actor)
      // The read itself is shared with Gain Control since 0.27.0 (helpers/threshold-read.mjs).
      ? readTargetThreshold({
        roller: actor, token: how.token, defense: how.defense,
        permitted: how.permitted ?? [how.defense],
        answered: how.answered === true,
        check: how.rolled.slug, traits
      })
      : null;
    // IMMUNITY TO A TRAIT (0.35.0; rulings 353 and 354): the one creature this is used on (the
    // token targeted) is immune to a trait the Maneuver carries. The system says it and goes on
    // (Mike): this is the roll window's line, said before the roll, which is still the roller's
    // to make and to pay for. The card asks again for itself as it is posted (dice/check/card.mjs).
    // Its own token targeted is no other creature: one body, whether it is rolled from the token
    // or from the sidebar sheet of an unlinked creature (the review of 0.35.0).
    const targeted = how.token?.actor ?? null;
    const oneBody = !!targeted && ((targeted === actor) || (targeted.uuid === actor.uuid) || ((targeted.id === actor.id) && !(targeted.isToken && actor.isToken)));
    const facedActor = oneBody ? null : targeted;
    const immune = (facedActor && traits.length)
      ? immunityRecord(facedActor, how.token.name ?? facedActor.name, traits, { other: actor })
      : null;
    const typed = (!read && Number.isFinite(how.threshold)) ? { threshold: Number(how.threshold) } : {};
    // An adversary rolls flat (dice/check/modifiers.mjs): its typed number for this Constellation
    // gives the die's bonus, named for the Constellation; its Conditions' lines are added there,
    // so the typed number is handed over and never the one in effect. Its card is read by the
    // table: another adversary's Threshold is never printed on it, though the GM is the one
    // rolling (the attack flow's rule, kept here). Here, so every road to an adversary's own roll
    // has them (the GM's window, and a request its target's player answered).
    const flat = (actor.type !== "character") ? {
      flatBonus: (actor.system.checkBase?.(how.rolled.slug) ?? 10) - 10,
      flatLabel: how.rolled.name || SW.getConstellation(how.rolled.slug)?.name || how.rolled.slug,
      ...((read && (how.token.actor.type !== "character")) ? { withholdThreshold: true } : {})
    } : {};
    const cfg = foundry.utils.mergeObject({
      actor,
      item: this,
      kind: "check",
      slug: how.rolled.slug,
      label: SW.plainName(this.name),
      subtitle: how.subtitle ?? "",
      outcomes: this.#outcomeList(),
      ...(how.ally ?? {}),
      ...(how.applies ?? {}),
      ...typed,
      ...(read ?? {}),
      ...flat,
      ...(immune ? { immuneNote: immune.note } : {}),
      // The one creature this is used on (the token targeted), whether or not a Defense of its is
      // read or a line of the row names it: the card asks that creature's immunity (0.35.0).
      ...(facedActor ? { usedOn: { uuid: how.token.uuid, name: how.token.name ?? facedActor.name } } : {}),
      // With a parent's traits beside its own, the card is told the whole list (it would read the
      // Item's alone); a Maneuver used by itself needs nothing said.
      ...((traits.length > (this.system.traits ?? []).length) ? { itemTraits: traits } : {}),
      ...(how.extra ?? {})
    }, how.config ?? {}, { inplace: false });
    delete cfg.partOfTraits;
    // What this use settled stands over a caller's own options: the Constellation picked or
    // declared, and a Threshold typed in this use's picker (the review of 0.34.0).
    cfg.slug = how.rolled.slug;
    if (how.typed && typed.threshold !== undefined) cfg.threshold = typed.threshold;
    return SwCheck.roll(cfg);
  }

  /**
   * Roll the check a request was waiting on (0.34.0), once its target has answered: the roll
   * `#startCheck` would have made, from what the request card stored, so it is the same after a
   * reload and never re-enters `use` (which would ask the cost and pay a Reaction again).
   *
   * The gate and the cost are settled as the roll is made, as for any rolled Maneuver (ruling
   * 232): a roll window that is closed has spent nothing. The request is checked once more there,
   * since two clients of one user could each have the window open: one request gives one roll.
   *
   * @param {object} request     The request card's `checkRequest` record.
   * @param {object} given
   * @param {string} given.requestId  The request card's id.
   * @param {string} given.defense    The Defense the target answered with.
   * @returns {Promise<object|null>}
   */
  async resumeCheck(request, { requestId, defense } = {}) {
    const actor = await actorFromUuid(request?.userUuid);
    if (!actor) return void ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.noActor"));
    if (!actor.isOwner) return void ui.notifications.warn(game.i18n.localize("STARWROUGHT.Notify.notOwner"));
    const key = `${actor.uuid}|${this.uuid}`;
    if (USING.has(key)) return null;
    USING.add(key);
    try {
      const { requestStillWaits } = await import("./cards/check-request.mjs");
      let token = null;
      try { token = request.tokenUuid ? fromUuidSync(request.tokenUuid) : null; } catch { token = null; }
      const label = String(request.label ?? SW.plainName(this.name));
      const beforeRoll = async () => {
        // One request gives one roll, and only while its answer stands: it may have been rolled
        // from another client, or its Combat ended, while this window stood open.
        if (!requestStillWaits(requestId, { mode: "answer", defense })) return false;
        // A Prepared Maneuver must still be standing when the die is thrown, as at Finish, and
        // this must be the request THAT preparation posted (`finishPrepared` writes its id on
        // the preparation): a card left over from an earlier one finishes nothing.
        const prep = actor.system.actions?.preparing;
        if (request.prepared && ((prep?.itemUuid !== this.uuid) || (prep?.request !== requestId))) {
          ui.notifications.warn(game.i18n.format("STARWROUGHT.CheckRequest.notPrepared", { name: SW.plainName(this.name) }));
          return false;
        }
        // The gate (0.19.0), where this use had not passed it: a request made at the user's own
        // Opportunity stands though that Opportunity has since ended (the Maneuver was begun in
        // it, and the wait was the target's); one made on the GM's leave spends that leave now.
        if ((request.gate === "permit") && !(await actor.mayActNow({ label }))) return false;
        if (request.cost) await actor.spendActions(request.cost, { label });
        return true;
      };
      const result = await this.#rollPlanned(actor, {
        rolled: request.rolled,
        defense,
        // The answer is the answer: the read stays on it, and says so if the target can no
        // longer use it, never moving to another Defense the row names (ruling 159).
        permitted: [defense],
        answered: true,
        token: token?.actor ? token : null,
        subtitle: request.line ?? "",
        applies: request.applies ? { applies: request.applies } : {},
        ally: request.ally ? { ally: request.ally } : {},
        config: { beforeRoll, ...((request.dialog === false) ? { dialog: false } : {}) },
        extra: { checkRequest: { from: requestId } }
      });
      // A Prepared Maneuver is finished by its roll, as Finish would have finished it.
      if (result && request.prepared) await actor.settlePreparation?.();
      return result;
    } finally {
      USING.delete(key);
    }
  }

  /**
   * An adversary's Maneuver with a check (0.34.0; rulings 340 and 341). Mike: "players ALWAYS
   * roll vs. NPCs".
   *
   *  - AGAINST A PLAYER'S CHARACTER, where the row names a Defense: the adversary pays at once,
   *    as its Gain Control does, and a request card asks the character's player to roll, one
   *    button for each Defense named (the target's own pick, made by rolling it). The roll is read
   *    against the adversary's typed number for the Constellation, and the GM's client then posts
   *    the Maneuver's result, read from the other side (documents/cards/check-request.mjs).
   *  - AGAINST ANOTHER ADVERSARY, or with nobody's Defense to read: the GM rolls for it, the
   *    die's bonus the typed number less 10. The GM answers for both sides, so the Constellation
   *    (where the row names a choice) and the target's Defense (where it names two) are asked in
   *    one window.
   *  - WHERE THE ONE WINDOW WOULD HAVE THE WRONG PERSON PICK the Defense (the user is no GM: a
   *    player-owned adversary; or the target is a creature a player owns that is no character: a
   *    companion), the target is asked by the request card, as for a character's Maneuver.
   */
  async #startAdversaryCheck(actor, how) {
    const { check, config, subtitle, applies } = how;
    const token = SwCheck.currentTarget();
    const target = token?.actor ?? null;
    const facing = !!target && (check.defenses.length > 0);
    const playerRolls = facing && (target.type === "character");
    const usable = facing ? usableDefenses(check.defenses, key => target.system?.defenses?.[key]?.unavailable) : [];
    const needRoll = check.relevant || (check.rolls.length > 1);
    // Two Defenses named and both usable: the target's own pick. The GM answers in the window
    // for a creature no player owns; anybody else's is asked by the card.
    const twoWays = facing && !playerRolls && (check.defenses.length > 1) && (usable.length > 1);
    const needDefense = twoWays && game.user.isGM && !target.hasPlayerOwner;

    let rolled = needRoll ? null : (check.rolls[0] ?? null);
    let defense = null;
    if (needRoll || needDefense) {
      const { pickAdversaryCheck } = await import("../apps/check-picker.mjs");
      const picked = await pickAdversaryCheck(actor, {
        name: SW.plainName(this.name),
        rolls: needRoll ? (check.relevant ? null : check.rolls) : undefined,
        defenses: needDefense ? usable : undefined,
        targetName: token?.name ?? target?.name ?? ""
      });
      if (!picked) return null;
      if (picked.rolled) rolled = picked.rolled;
      if (picked.defense) defense = picked.defense;
    }
    if (!rolled?.slug) return this.toMessage({ actor });
    const rolledName = rolled.name || SW.getConstellation(rolled.slug)?.name || rolled.slug;
    rolled = { slug: rolled.slug, name: rolledName };
    const said = needRoll ? rolledName : subtitle;

    if (playerRolls) {
      // The gate, where this use has still to pass it (a player-owned adversary outside its
      // Opportunity): passed as the adversary pays, since no roll of its own follows.
      if ((how.gate === "roll") && !(await actor.mayActNow({ label: how.label }))) return null;
      if (how.cost) await actor.spendActions(how.cost, { label: how.label });
      const { postCheckRequest } = await import("./cards/check-request.mjs");
      const posted = await postCheckRequest({
        mode: "roll", user: actor, item: this, token: token.document,
        rolled, line: said,
        defenses: check.defenses,
        cost: 0, label: how.label, glyph: how.glyph, gate: "none",
        applies: applies?.applies ?? null, ally: null,
        prepared: false, paid: how.paid ?? null,
        dialog: config.dialog,
        // Performed as part of another Maneuver, it carries that one's traits too (0.35.0).
        traits: Array.isArray(config.partOfTraits) ? config.partOfTraits : null
      });
      // A Prepared Maneuver is finished as its request goes out: the adversary's part is done,
      // and the roll is the player's (the review of 0.34.0: it stayed Preparing, since only a
      // roll of the adversary's own settled it).
      if (posted && how.prepared) await actor.settlePreparation?.();
      return posted;
    }
    if (twoWays && !needDefense) return this.#askTarget(actor, how, { token: token.document, rolled, line: said });
    // One Defense named is the one read; of two, the one the target can use (ruling 344).
    if (facing && !defense) defense = (check.defenses.length === 1) ? check.defenses[0] : (usable[0] ?? null);
    return this.#rollPlanned(actor, {
      rolled, defense, permitted: check.defenses, token: token?.document ?? null,
      threshold: check.threshold, subtitle: said, applies, ally: {}, config
    });
  }

  /* -------------------------------------------- */

  /**
   * Raise a Shield ❶ (PHB v4.10): its Gear bonus to Guard until your next Opportunity. The bonus
   * itself is derived by the data model from `system.raised`, so all this does is flip the flag
   * and pay the action; the combat tracker lowers it when the actor's next Opportunity begins.
   * A raised shield is a rigid implement: it can Parry, Bind and Gain Control. Lowering it is
   * free: you simply stop.
   */
  async raise() {
    if (!this.actor) return;
    if (!this.system.held) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notHeld", { name: this.name }));
    }
    const raised = !this.system.raised;
    // Raising is a Maneuver and passes the Opportunity gate (0.19.0); lowering is free and does not.
    if (raised && (typeof this.actor.mayActNow === "function")
      && !(await this.actor.mayActNow({ label: game.i18n.localize("STARWROUGHT.Action.raiseShield") }))) return null;
    if (raised) {
      // The card below carries the actions-left line, so the spend itself posts nothing.
      await this.actor.spendActions(1, { label: game.i18n.localize("STARWROUGHT.Action.raiseShield"), announce: false });
    }
    await this.update({ "system.raised": raised });
    const left = raised ? (this.actor.actionsLeftLine?.() ?? "") : "";
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="starwrought action-card"><h3><span class="sw-spend-glyph">❶</span> ${game.i18n.localize("STARWROUGHT.Action.raiseShield")}</h3>
        <p>${game.i18n.format(raised ? "STARWROUGHT.Action.raiseShieldOn" : "STARWROUGHT.Action.raiseShieldOff", {
          name: this.actor.name, shield: this.name, bonus: this.system.bonus
        })}${left ? ` <strong class="sw-actions-left">${left}</strong>` : ""}</p></div>`
    });
  }

  /* -------------------------------------------- */

  /**
   * Raise or lower a Visored piece's visor (PHB v4.21, Armor Traits: "Can Raise or Lower the visor
   * as a single action. Lowered: Imposes -1 Gear penalty to Awareness and Initiative. Raised:
   * Protection is reduced by 1"). The penalty and the Protection are derived by the data model
   * from `system.lowered`, so all this does is flip the flag, pay the action and say so; the
   * Equipment tab's control and the two Maneuvers (documents/maneuvers.mjs) both come here. A
   * piece without the trait, or one not worn, is told and nothing changes.
   * @param {boolean} [lowered]  The state to set; omitted, the visor flips.
   */
  async toggleVisor(lowered) {
    if (!this.actor || (this.type !== "armor")) return null;
    if (!this.system.visored) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.noVisor", { name: this.name }));
      return null;
    }
    if (!this.system.worn) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Actions.notWorn", { name: this.name }));
      return null;
    }
    const next = (lowered === undefined) ? !this.system.lowered : !!lowered;
    if (next === !!this.system.lowered) return null;
    const label = game.i18n.localize(next ? "STARWROUGHT.Action.lowerVisor" : "STARWROUGHT.Action.raiseVisor");
    // A single action, so a Maneuver: the Opportunity gate (0.19.0).
    if ((typeof this.actor.mayActNow === "function") && !(await this.actor.mayActNow({ label }))) return null;
    // The card below carries the actions-left line, so the spend itself posts nothing.
    await this.actor.spendActions(1, { label, announce: false });
    await this.update({ "system.lowered": next });
    const left = this.actor.actionsLeftLine?.() ?? "";
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="starwrought action-card"><h3><span class="sw-spend-glyph">❶</span> ${label}</h3>
        <p>${game.i18n.format(next ? "STARWROUGHT.Action.visorLowered" : "STARWROUGHT.Action.visorRaised", {
          name: this.actor.name, piece: this.name
        })}${left ? ` <strong class="sw-actions-left">${left}</strong>` : ""}</p></div>`
    });
  }

  /* -------------------------------------------- */

  /**
   * Put the Item on the table as a card, with no roll.
   * @param {object} [options]
   * @param {Actor} [options.actor]  Who speaks, when the Item is not owned (a Basic Maneuver).
   * @param {string[]} [options.lines]  Lines said under the card (0.15.0: what a Use did).
   * @param {string[]} [options.warns]  Warnings said under those (0.24.0: a requirement the table
   *                                    should look at; the use happened all the same).
   */
  async toMessage({ actor = null, lines = [], warns = [] } = {}) {
    const speaker = this.actor ?? actor;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enrich = html => TextEditor.enrichHTML(html ?? "", { rollData: this.getRollData(), relativeTo: this });
    const description = await enrich(this.system.chatDescription);
    // A Maneuver authored with separate flavour and rules prints both, flavour first.
    const flavor = (this.type === "action" && this.system.effect && this.system.description)
      ? await enrich(this.system.description)
      : "";
    const { renderTemplate } = foundry.applications.handlebars;
    const content = await renderTemplate("systems/starwrought/templates/chat/item-card.hbs", {
      item: this,
      description,
      flavor,
      subtitle: this.#subtitle(),
      traits: this.system.traits ?? [],
      outcomes: this.#outcomeList(),
      lines: Array.isArray(lines) ? lines.filter(Boolean) : [],
      warns: Array.isArray(warns) ? warns.filter(Boolean) : []
    });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: speaker }),
      content,
      flags: { [SW.SYSTEM_ID]: { kind: "item", itemUuid: this.uuid } }
    });
  }

  /* -------------------------------------------- */

  /** The grey line under the Item's name on a card. */
  #subtitle() {
    switch (this.type) {
      case "talent": {
        const con = SW.getConstellation(this.system.constellation);
        return `${con.name} • ${game.i18n.localize(this.system.tierLabel)}`;
      }
      case "constellation":
        return this.system.meta || game.i18n.localize(this.system.categoryLabel);
      case "chassis":
        return game.i18n.localize(this.system.kindLabel);
      case "weapon":
        return `${this.system.handlingLabel ? game.i18n.localize(this.system.handlingLabel) : ""} • ${this.system.group}`;
      case "armor":
        return `${game.i18n.localize(this.system.zoneLabel)} • ${game.i18n.localize("STARWROUGHT.Field.protection")} ${this.system.protection}`;
      case "action":
        // The card's title carries the glyph (item-card.hbs, 0.5.1 T16), so the subline does not.
        return String(this.system.category ?? "").trim();
      default:
        return "";
    }
  }

  /**
   * The four degrees, for a card built outside this class (0.34.0: the result of an adversary's
   * Maneuver, read from the player's roll; documents/cards/check-request.mjs).
   */
  get checkOutcomes() {
    return this.#outcomeList();
  }

  /** The four degrees, when a Maneuver prints them. */
  #outcomeList() {
    const out = this.system.outcomes;
    if (!out) return null;
    const rows = [
      { key: "critSuccess", label: "STARWROUGHT.Degree.critSuccess", text: out.critSuccess },
      { key: "success", label: "STARWROUGHT.Degree.success", text: out.success },
      { key: "fail", label: "STARWROUGHT.Degree.fail", text: out.fail },
      { key: "critFail", label: "STARWROUGHT.Degree.critFail", text: out.critFail }
    ].filter(r => r.text);
    return rows.length ? rows : null;
  }

  /* -------------------------------------------- */

  /**
   * @inheritdoc
   *
   * THE PARTY'S LOOT (0.7.1; party-sheet-plan.md, part 6): a party holds gear and nothing else.
   * A Talent, a Constellation, a chassis or a Maneuver dropped on a party is refused here, with a
   * notice, before it lands, whoever drops it and from wherever (the compendium, the sidebar, a
   * character sheet). The fence is on the document so every path meets it: the party sheet's
   * drop, a macro, a module.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    const parent = this.parent;
    if ((parent?.documentName === "Actor") && (parent.type === SW.PARTY_TYPE) && !this.isPhysical) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Loot.fenceNotPhysical", {
        name: this.name,
        type: game.i18n.localize(CONFIG.Item.typeLabels?.[this.type] ?? this.type)
      }));
      return false;
    }
    // Give new Items a type-appropriate icon rather than the generic bag.
    if (!data.img || (data.img === "icons/svg/item-bag.svg")) {
      const img = SW.TYPE_ICONS[this.type];
      if (img) this.updateSource({ img });
    }
  }

  /* -------------------------------------------- */

  /**
   * @inheritdoc
   *
   * THE AUTOMATION FRAMEWORK (0.9.0; ruling 118): when a GM edits the Automation textarea on a
   * world Item, or an owner on their copy, the text is parsed here with the grammar the build
   * used and `system.rules` is rewritten from it through the grammar's own `ruleEntries`: the
   * parsed rules, and `{ error, line, text }` for every line that did not parse, in the cell's
   * line order. The update is never refused. The text always saves and the sheet shows the red
   * row, so a half-typed cell is a cell with a mark on it rather than a lost keystroke; the build
   * is the strict one, and a bad line fails it. (A compendium copy on a character edited here
   * diverges from its source until the content loop's copies refresh (0.8.0) overwrites both
   * fields from the source again, which is right: the cell is the author, ruling 120.) `changed`
   * is the differential, so a sheet that submits its whole form still only reaches the parse when
   * the textarea's text is in the diff; both the expanded and the flattened spelling of the key
   * are read, since a macro may pass either.
   *
   * Since 0.10.0 the context carries `resolve` (helpers/content.mjs, resolveRuleTarget): the
   * registry's Constellations, then the Actions pack's index and the world's Maneuvers, by name.
   * It is the client's counterpart of the resolver the build hands the same grammar, so a target
   * typed here is checked as a cell is at build time (`"Aidd" names no Constellation or Maneuver`
   * is a red row, not a silent rule that never fires) and a rule stores the same `to.type`, slug
   * and name either way. A kind that takes no target ignores it.
   */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;
    // A FULL WEAPON IS STORED AS "NEVER SET" (0.29.0; the review's finding). The weapon's sheet
    // submits its Loaded field with every save, which would pin a weapon nobody ever emptied at
    // its magazine of that day (1 of 1), so a Capacity trait added later left it at 1 of 5. Null
    // reads as full whatever the magazine is, so a count at or above the magazine is written as
    // null: by the sheet, the chip, Reload and the refund alike.
    if (this.type === "weapon") {
      const loaded = foundry.utils.getProperty(changed, "system.loaded");
      const magazine = Number(this.system?.magazine) || 0;
      if ((typeof loaded === "number") && (magazine > 0) && (loaded >= magazine)) {
        foundry.utils.setProperty(changed, "system.loaded", null);
      }
    }
    const text = foundry.utils.getProperty(changed, "system.automation") ?? changed["system.automation"];
    if (typeof text !== "string") return;
    // THE BUILD'S PARSE STANDS (0.36.0, the review; ruling 369). Sync content writes a source
    // document whole (`recursive: false, diff: false`), its `system.rules` the ones the build
    // parsed from the cell, and says so with `swBuilt`. Parsed again here, under the grammar this
    // client runs, a cell read before a word changed its meaning would change with it on the one
    // copy the sync happened to write (a bare CHECK stored as the narrow scope became every roll on
    // a character whose copy was refreshed, and stayed narrow on the next). A stored rule keeps the
    // meaning it was read with until its CELL is built again.
    if ((options?.swBuilt === true) && Array.isArray(foundry.utils.getProperty(changed, "system.rules"))) return;
    const parsed = parseAutomation(text, {
      itemName: this.name,
      constellation: (this.type === "constellation") ? this.name : (this.system.constellationName || this.system.category || ""),
      itemType: this.type,
      resolve: resolveRuleTarget
    });
    foundry.utils.setProperty(changed, "system.rules", ruleEntries(parsed));
  }

  /* -------------------------------------------- */

  /**
   * Hand over a Talent named by another Talent's Free Talent column, with no point spent.
   * Drilled is the case this exists for: it gives you Weapon Familiarity outright.
   * @param {Actor} actor
   * @param {string} name  The Talent's name, which may live in any Constellation.
   */
  static async grantFreeTalent(actor, name, { inherit = "" } = {}) {
    if (!actor || !name) return null;
    const key = String(name).replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "").trim().toLowerCase();
    const clean = n => n.replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "").trim().toLowerCase();
    const owned = actor.items.some(i => (i.type === "talent") && (clean(i.name) === key));
    if (owned) return null;

    const pack = game.packs.get(`${SW.SYSTEM_ID}.talents`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.constellation"] });
    const entry = index.find(e => clean(e.name) === key);
    if (!entry) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Chargen.freeTalentMissing", { name }));
      return null;
    }

    const doc = await pack.getDocument(entry._id);
    await this.ensureConstellation(actor, doc.system.constellation);
    const data = doc.toObject();

    // The granting Talent's answer carries across when it is a legal answer here, so Drilled and
    // the Weapon Familiarity it hands over are one question rather than two.
    if (inherit && data.system.choice?.prompt && !data.system.choice.value) {
      const { loadChargenContent, choiceOptions } = await import("../helpers/chargen-data.mjs");
      await loadChargenContent();
      const options = choiceOptions(data.system.choice.prompt);
      if (!options || options.includes(inherit)) data.system.choice.value = inherit;
    }

    // Deliberately not swAuto unless the question is already settled: the free Talent may have a
    // build-time question of its own, and the createItem hook is what asks it. The owned check
    // above is what stops that recursing.
    const settled = !data.system.choice?.prompt || !!data.system.choice.value;
    const [created] = await actor.createEmbeddedDocuments("Item", [data], { swAuto: settled });
    ui.notifications.info(game.i18n.format("STARWROUGHT.Chargen.freeTalentGranted", { name: doc.name }));
    return created ?? null;
  }

  /**
   * TALENT MANEUVERS (0.16.0; the plan's Part 3; Mike: the Talent "only adding the Maneuver", the
   * Maneuver's own row in maneuvers.xlsx carrying its Cost and Automation). A Talent whose rules
   * carry `[MANEUVER <Name>]` puts the Maneuver on the character as an owned action Item copied
   * from the Actions pack, flagged `grantedBy` with the Talent's id, `basic` off, so it shows under
   * "From your Talents" on the Actions tab, is used from there, and its rules are indexed on the
   * actor as any owned Item's are (`collectRules` walks owned Items; a compendium Maneuver is
   * never indexed). One already owned, by any route, is left alone. Called when a Talent lands
   * (the createItem hook, the wizard's #addTalent) and by `grantMissingManeuvers` at ready for
   * Talents that gained the rule through Sync content, which fires no createItem. The pack's index
   * is fetched once per call unless the caller hands one in (`grantMissingManeuvers` walks every
   * character with one index; 0.18.1).
   * @param {Actor} actor
   * @param {Item} talent
   * @param {object} [options]
   * @param {Collection|Array|null} [options.index]  The Actions pack's index, when the caller already has it.
   * @returns {Promise<Item[]>}  The actions created.
   */
  static async grantManeuvers(actor, talent, { index = null } = {}) {
    if (!actor || !talent || (talent.type !== "talent")) return [];
    const wanted = (talent.system.rules ?? []).filter(r => (r?.kind === "maneuver") && !r.error && r.slug);
    if (!wanted.length) return [];
    const pack = game.packs.get(`${SW.SYSTEM_ID}.actions`);
    if (!pack) return [];
    index ??= await pack.getIndex({ fields: ["system.category"] });
    const slugOf = name => SW.slugify(SW.plainName(name ?? ""));
    const owned = new Set(actor.items.filter(i => i.type === "action").map(i => slugOf(i.name)));
    const data = [];
    for (const rule of wanted) {
      if (owned.has(rule.slug)) continue;
      const entry = index.find(e => slugOf(e.name) === rule.slug) ?? null;
      if (!entry) {
        ui.notifications.warn(game.i18n.format("STARWROUGHT.Chargen.maneuverMissing", { name: rule.name ?? rule.slug, talent: SW.plainName(talent.name) }));
        continue;
      }
      const doc = await pack.getDocument(entry._id);
      const object = doc.toObject();
      object.system.basic = false;
      foundry.utils.setProperty(object, `flags.${SW.SYSTEM_ID}.grantedBy`, talent.id);
      data.push(object);
      owned.add(rule.slug);
    }
    if (!data.length) return [];
    return actor.createEmbeddedDocuments("Item", data, { swAuto: true });
  }

  /** The Maneuvers a deleted Talent granted go with it (0.16.0). */
  static async removeGrantedManeuvers(actor, talentId) {
    if (!actor || !talentId) return;
    const ids = actor.items.filter(i => (i.type === "action") && (i.getFlag(SW.SYSTEM_ID, "grantedBy") === talentId)).map(i => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids, { swAuto: true });
  }

  /**
   * Every character's Talents that name a Maneuver not yet on the character: granted now. Run on
   * the GM's client at ready (0.16.0), since Sync content refreshes a Talent's rules without a
   * createItem, and a world built before 0.16.0 has the Talents and none of their Maneuvers.
   */
  static async grantMissingManeuvers() {
    let granted = 0;
    // Only the Talents whose rules name a Maneuver are asked, with one index for all of them
    // (0.18.1; through 0.18.0 every Talent of every character fetched the index).
    const names = talent => (talent.system.rules ?? []).some(r => (r?.kind === "maneuver") && !r.error && r.slug);
    let index = null;
    for (const actor of game.actors.filter(a => a.type === "character")) {
      for (const talent of actor.items.filter(i => (i.type === "talent") && names(i))) {
        index ??= await game.packs.get(`${SW.SYSTEM_ID}.actions`)?.getIndex({ fields: ["system.category"] });
        if (!index) return granted;
        const made = await this.grantManeuvers(actor, talent, { index });
        granted += made.length;
      }
    }
    if (granted) console.log(`STARWROUGHT | ${granted} Talent Maneuver(s) granted to characters whose Talents name them`);
    return granted;
  }

  /**
   * Opening a Constellation is buying its Root, so when a Talent arrives on a character who has
   * no Constellation Item for it, fetch one from the compendium so the sky is drawn.
   *
   * A Lore (X) (0.18.0) is a copy of the one authored Lore template: a `lore-` slug fetches the
   * template and writes the slug and the given `name` ("Lore (Circus)") onto the copy, which is
   * what the wizard's private `#ensureConstellation` did through 0.17.0 and now delegates here.
   * @param {Actor} actor
   * @param {string} slug
   * @param {object} [options]
   * @param {string|null} [options.name]  The copy's name, when the pack's is not it.
   * @param {boolean} [options.report]    Answer `{ item, created }` instead of the Item (0.18.1), for
   *                                      a caller that must know whether it made one (the wizard's
   *                                      Back).
   * @returns {Promise<Item|null|{item: Item|null, created: boolean}>}  The Item on the character, found or made.
   */
  static async ensureConstellation(actor, slug, { name = null, report = false } = {}) {
    const answer = (item, created) => (report ? { item, created } : item);
    if (!actor || !slug) return answer(null, false);
    const existing = actor.items.find(i => (i.type === "constellation") && (SW.constellationSlugOf(i) === slug));
    if (existing) return answer(existing, false);
    const pack = game.packs.get(`${SW.SYSTEM_ID}.constellations`);
    if (!pack) return answer(null, false);
    const index = await pack.getIndex({ fields: ["system.slug"] });
    const templateSlug = (SW.isLoreSlug(slug) && (slug !== SW.LORE_TEMPLATE_SLUG)) ? SW.LORE_TEMPLATE_SLUG : slug;
    const entry = index.find(e => (e.system?.slug ?? SW.slugify(e.name)) === templateSlug);
    if (!entry) return answer(null, false);
    const doc = await pack.getDocument(entry._id);
    const data = doc.toObject();
    data.system.slug = slug;
    if (name) data.name = name;
    else if (templateSlug !== slug) data.name = SW.loreName(slug);
    const created = await actor.createEmbeddedDocuments("Item", [data], { swAuto: true });
    return answer(created[0] ?? null, !!created[0]);
  }
}
