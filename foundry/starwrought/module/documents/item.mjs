/**
 * The Item document. Talents, gear, and Maneuvers all know how to put themselves on the table.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { parseAutomation, ruleEntries } from "../rules/grammar.mjs";
// content.mjs imports config.mjs alone at module scope (its other imports are dynamic), so this
// closes no circle; a static import of this file from there would, and must not be added.
import { resolveRuleTarget } from "../helpers/content.mjs";
// The Maneuvers the system implements, by name (0.10.1): Recenter, Raise a Shield.
import { BUILT_IN_MANEUVERS } from "./maneuvers.mjs";
import { relation as tokenRelation } from "../rules/scene.mjs";
import { usableByRule } from "../rules/engine.mjs";

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
   * A Maneuver with the Reaction trait (PHB v4.10) is paid from the same six actions the moment
   * its Trigger occurs, so using one spends its cost; every other Maneuver is the table's to pay,
   * with the pips, because the system cannot see most of them being used.
   *
   * A Maneuver's check names its Constellation (Search's Awareness) or names none: `check.enabled`
   * with a blank `constellation` is a Relevant Check (0.10.0; ruling 123), the book's term for a
   * roll whose Constellation the roller picks and justifies, and Aid is written with one. Both
   * rolls carry the Maneuver as `item`, which is what makes a roll an Aid to the Automation rules
   * (ruling 122: a `bonus ... to Aid` applies to a roll made from Aid's Item, and is only offered
   * on a check made without it).
   *
   * A Maneuver the system implements (Recenter, Raise a Shield; documents/maneuvers.mjs, by the
   * slug of its plain name) runs that behaviour when used (0.10.1): the Action is the entry
   * point, the sheet button and the Macro are other doors to the same method. The behaviour pays
   * its own action and posts its own card, so nothing here does either for it.
   * @param {object} [options]
   * @param {Actor} [options.actor]   Who is using an unowned Item.
   * @param {string} [options.strike] For a weapon: quick | deliberate | committed.
   */
  async use(options = {}) {
    const { actor: given, ...rest } = options;
    const actor = this.actor ?? given ?? null;
    switch (this.type) {
      case "weapon":
        if (!this.actor) return this.toMessage({ actor });
        return this.actor.rollAttack(this.id, rest);
      case "action": {
        const builtIn = BUILT_IN_MANEUVERS[SW.slugify(SW.plainName(this.name))];
        if (builtIn && actor) return builtIn(actor, this, rest);
        // A Maneuver whose rules act when it is used (0.16.0: Oathbound's `MARK`, granted by a
        // Talent's `[MANEUVER Oathbound]`): paid and run as a Talent with such rules is.
        if (actor && this.actor && usableByRule(this)) return this.#useWithRules(actor);
        if (this.system.reaction && actor) {
          // A Reaction with a cost of its own (Aid ❶ (⓿↺)) pays that one; otherwise the cost printed.
          const own = this.system.reactionCost;
          const key = (own !== undefined && own !== null && own !== "") ? own : this.system.cost;
          const n = SW.actionCostValue(key);
          if (n) {
            // The plain name, so the glyph appended here is the only one (0.5.1, T16).
            await actor.spendActions(n, { label: `${SW.plainName(this.name)} ${this.system.glyph ?? ""}`.trim() });
          }
        }
        if (this.system.check.enabled && actor && !this.system.check.constellation) {
          // A Relevant Check: the picker chooses the Constellation and says why, the Maneuver
          // rides along as the roll's Item, and the card is called by the Maneuver's name. An
          // adversary gets rollRelevantCheck's own warning and null (it carries Thresholds).
          return actor.rollRelevantCheck(foundry.utils.mergeObject({
            item: this,
            label: SW.plainName(this.name),
            subtitle: `${this.system.glyph} ${this.system.category}`.trim(),
            outcomes: this.#outcomeList()
          }, rest, { inplace: false }));
        }
        if (this.system.check.enabled && actor) {
          // A check against a target's Threshold (0.15.0, ruling 179): a Maneuver whose check names
          // a Defense (Demoralize against Guard), used with exactly one target, reads that target's
          // live Threshold through the fold the attack flow uses (`defenseThresholdFor`, with the
          // check's Constellation as the Threat and the roller as the other party, so
          // `AGAINST(Intimidation)` and `MARKED` apply); the number prints for a character target
          // or a GM roller and is withheld for an adversary as the flow withholds it.
          const read = this.#targetThreshold(actor);
          return SwCheck.roll(foundry.utils.mergeObject({
            actor,
            item: this,
            kind: "check",
            slug: this.system.check.constellation,
            label: SW.plainName(this.name),
            subtitle: `${this.system.glyph} ${this.system.category}`.trim(),
            outcomes: this.#outcomeList(),
            ...(read ?? {})
          }, rest, { inplace: false }));
        }
        return this.toMessage({ actor });
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
        if (actor && this.actor && ((this.system.cost !== "passive") || usableByRule(this))) return this.#useWithRules(actor);
        return this.toMessage({ actor });
      default:
        return this.toMessage({ actor });
    }
  }

  /* -------------------------------------------- */

  /**
   * Use a Talent or a Maneuver that carries a cost or a rule that acts on use (0.15.0, ruling 176;
   * a Maneuver since 0.16.0). The kinds' `use` hook answers first (module/rules/engine.mjs,
   * `ruleUses`): a refusal (Oathbound with no target) is a notice and nothing is paid; otherwise
   * the cost in the Item's name is paid in an encounter (the Reaction half's own when it has one),
   * the writes land on the owner, and the Item's card goes out with the kinds' lines under it. An
   * Item with no `use` rules still pays and posts.
   */
  async #useWithRules(actor) {
    const { ruleUses } = await import("../rules/engine.mjs");
    const { encounterContext } = await import("../rules/scene.mjs");
    const targetToken = SwCheck.currentTarget();
    const target = targetToken ? {
      actor: targetToken.actor, uuid: targetToken.actor?.uuid ?? null, tokenUuid: targetToken.document.uuid,
      name: targetToken.name, relation: relationTo(actor, targetToken)
    } : null;
    const uses = ruleUses(actor, this, { target, encounter: encounterContext() });
    const refused = uses.find(u => u.refuse);
    if (refused) return void ui.notifications.warn(refused.refuse);

    const own = this.system.reactionCost;
    const key = (this.system.reaction && own !== undefined && own !== null && own !== "") ? own : this.system.cost;
    const n = SW.actionCostValue(key);
    if (n && actor.inEncounter && (typeof actor.spendActions === "function")) {
      await actor.spendActions(n, { label: `${SW.plainName(this.name)} ${this.system.glyph ?? ""}`.trim() });
    }
    const update = {};
    const lines = [];
    for (const u of uses) {
      if (u.write) Object.assign(update, u.write);
      if (u.say) lines.push(u.say);
    }
    if (Object.keys(update).length && (actor.isOwner || game.user.isGM)) await actor.update(update, { swAnnounced: true });
    return this.toMessage({ actor, lines });
  }

  /**
   * The target's Threshold a check Maneuver reads (0.15.0, ruling 179), as roll config: the
   * Threshold, its label, `targetDefense` for the dialog, `withholdThreshold` for an adversary's
   * number when the roller is not the GM, and the read's marks to write on the target. Null when
   * the Maneuver names no Defense or there is not exactly one target with an Actor.
   */
  #targetThreshold(actor) {
    const defense = this.system.check?.defense;
    if (!defense || !SW.DEFENSES[defense]) return null;
    const token = SwCheck.currentTarget();
    const target = token?.actor;
    if (!target || (typeof target.defenseThresholdFor !== "function")) return null;
    let read;
    try {
      read = target.defenseThresholdFor({
        defense, permitted: Object.keys(SW.DEFENSES),
        threat: { threat: "check", melee: false, traits: this.system.traits ?? [], check: this.system.check.constellation || null },
        attacker: actor.tokenOnScene?.() ?? actor
      });
    } catch (err) {
      console.warn("STARWROUGHT | the target's Threshold could not be read", err);
      return null;
    }
    if (!Number.isFinite(Number(read?.threshold))) return null;
    const withhold = (target.type !== "character") && !game.user.isGM;
    const label = `${token.name} ${game.i18n.localize(SW.DEFENSES[read.key ?? defense].label)}`;
    return {
      threshold: Number(read.threshold),
      thresholdLabel: label,
      targetDefense: { key: read.key ?? defense, label: withhold ? "" : `${label} ${read.threshold}`, threshold: withhold ? null : Number(read.threshold), unavailable: read.unavailable ?? null, hidden: withhold },
      targetDefenseKey: read.key ?? defense,
      targetUuid: token.document.uuid,
      targetName: token.name,
      targetActor: target,
      targetMarks: read.marks ?? [],
      withholdThreshold: withhold
    };
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
   */
  async toMessage({ actor = null, lines = [] } = {}) {
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
      lines: Array.isArray(lines) ? lines.filter(Boolean) : []
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
    const text = foundry.utils.getProperty(changed, "system.automation") ?? changed["system.automation"];
    if (typeof text !== "string") return;
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
