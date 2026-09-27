/**
 * The character-creation wizard.
 *
 * Creation in STARWROUGHT is a sequence, not a form: your Ancestry decides which Bloodlines exist,
 * your Background decides which Skills its points are allowed to buy, and a Talent you take on one
 * step can hand you another point to spend on that same step. So the wizard walks forward one step
 * at a time and will not let you past a step with an unspent point.
 *
 * Choices are written to the Actor as you make them, so the sheet fills in behind you. Every write
 * is recorded against the step that made it, and Back replays that record in reverse: the Talents
 * that step added are deleted, and the fields it set go back to what they were. Changing a choice
 * inside a step does the same thing before applying the new one, so the Actor never accumulates
 * the residue of a decision you walked away from.
 */

import * as SW from "../config.mjs";
import {
  SwContent, loadChargenContent, talentsIn, rootOf, bloodlinesIn,
  talentDocument, loreSlug, loreName, normalize, choiceOptions
} from "../helpers/chargen-data.mjs";
import {
  canBuy, ownsTalent, pointsIn, slotChoices, constellationLabel, categoryOf
} from "../helpers/chargen-rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** The steps, in the order the handbook prints them. */
const STEPS = [
  { id: "start", icon: "fa-solid fa-star" },
  { id: "ancestry", icon: "fa-solid fa-person" },
  { id: "bloodline", icon: "fa-solid fa-droplet" },
  { id: "culture", icon: "fa-solid fa-landmark" },
  { id: "background", icon: "fa-solid fa-scroll" },
  { id: "calling", icon: "fa-solid fa-fire" },
  { id: "defenses", icon: "fa-solid fa-shield-halved" },
  { id: "comets", icon: "fa-solid fa-meteor" },
  { id: "review", icon: "fa-solid fa-check" }
];

/** The Constellations every character is Trained in for free, before a single point is spent. */
const FREE_TRAININGS = [SW.WEAPONS_SLUG, ...Object.values(SW.DEFENSES).map(d => d.slug)];

/** The grant DSL in the spreadsheets, mapped onto the slot scopes the rules module understands. */
const GRANT_SCOPES = {
  Skill: { scope: "category", category: "skill" },
  Lore: { scope: "lore" },
  Calling: { scope: "category", category: "calling" },
  "Combat Style": { scope: "category", category: "combatStyle" },
  Armor: { scope: "category", category: "combatStyle" },
  Save: { scope: "defense" },
  Defense: { scope: "defense" },
  Weapon: { scope: "category", category: "weapon" },
  opened: { scope: "opened" },
  anywhere: { scope: "anywhere" }
};

/* -------------------------------------------- */

export class SwChargen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "sw-chargen-{id}",
    classes: ["starwrought", "sw-chargen"],
    position: { width: 900, height: 780 },
    window: { title: "STARWROUGHT.Chargen.title", icon: "fa-solid fa-wand-magic-sparkles", resizable: true },
    actions: {
      chooseAncestry: SwChargen.#onChoose("ancestry"),
      chooseBloodline: SwChargen.#onChoose("bloodline"),
      chooseCulture: SwChargen.#onChoose("culture"),
      chooseBackground: SwChargen.#onChoose("background"),
      chooseCalling: SwChargen.#onChoose("calling"),
      pickConstellation: SwChargen.#onPickConstellation,
      buyTalent: SwChargen.#onBuyTalent,
      undoSpend: SwChargen.#onUndoSpend,
      revealSlot: SwChargen.#onRevealSlot,
      next: SwChargen.#onNext,
      back: SwChargen.#onBack,
      goto: SwChargen.#onGoto,
      finish: SwChargen.#onFinish,
      cancel: SwChargen.#onCancel
    }
  };

  /** @inheritdoc */
  static PARTS = {
    steps: { template: "systems/starwrought/templates/chargen/steps.hbs" },
    body: { template: "systems/starwrought/templates/chargen/body.hbs", scrollable: [""] },
    footer: { template: "systems/starwrought/templates/chargen/footer.hbs" }
  };

  /** The Constellation currently selected inside each point slot's picker. */
  #openPicker = {};

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  /** The wizard's whole state, kept on the Actor so a reload does not lose your place. */
  get state() {
    return this.actor.getFlag(SW.SYSTEM_ID, "chargen") ?? {
      step: 0, history: {}, picks: {}, spends: {}
    };
  }

  get step() {
    return this.state.step ?? 0;
  }

  get picks() {
    return this.state.picks ?? {};
  }

  get spends() {
    return this.state.spends ?? {};
  }

  async #setState(changes) {
    const state = foundry.utils.mergeObject(this.state, changes, { inplace: false });
    await this.actor.setFlag(SW.SYSTEM_ID, "chargen", state);
  }

  /** Replace the whole state, so deletions actually delete. */
  async #putState(state) {
    await this.actor.unsetFlag(SW.SYSTEM_ID, "chargen");
    await this.actor.setFlag(SW.SYSTEM_ID, "chargen", state);
  }

  /* -------------------------------------------- */
  /*  Writing and unwriting                       */
  /* -------------------------------------------- */

  /**
   * Record that the current step created these Items, and changed these Actor fields.
   * @param {object} record
   * @param {string[]} [record.items]
   * @param {object} [record.updates]  path -> the value it had before
   */
  async #record({ items = [], updates = {} }) {
    const state = foundry.utils.deepClone(this.state);
    const entry = state.history[this.step] ??= { items: [], updates: {} };
    entry.items.push(...items);
    // Only the FIRST value matters: undoing a step restores what it looked like on the way in.
    for (const [path, before] of Object.entries(updates)) {
      if (!(path in entry.updates)) entry.updates[path] = before;
    }
    await this.#putState(state);
  }

  /** Change Actor fields, remembering what they were. */
  async #update(changes) {
    const before = {};
    for (const path of Object.keys(changes)) {
      before[path] = foundry.utils.getProperty(this.actor, path) ?? null;
    }
    await this.actor.update(changes);
    await this.#record({ updates: before });
  }

  /**
   * Undo everything a step wrote: delete the Talents it added, put the fields it changed back,
   * and forget any point it spent (a spend's Item is one of the ones just deleted).
   */
  async #undoStep(step) {
    const state = foundry.utils.deepClone(this.state);
    const entry = state.history[step];
    if (!entry) return;

    const ids = entry.items.filter(id => this.actor.items.has(id));
    if (ids.length) await this.actor.deleteEmbeddedDocuments("Item", ids);

    const restore = {};
    for (const [path, before] of Object.entries(entry.updates)) restore[path] = before;
    if (Object.keys(restore).length) await this.actor.update(restore);

    // Any spend whose Item is gone was made by this step.
    for (const [slotId, list] of Object.entries(state.spends ?? {})) {
      const kept = list.filter(s => this.actor.items.has(s.itemId));
      if (kept.length) state.spends[slotId] = kept;
      else delete state.spends[slotId];
    }

    // The identity choice this step made goes with it.
    const pickKey = STEPS[step]?.id;
    if (pickKey && (pickKey in (state.picks ?? {}))) delete state.picks[pickKey];

    delete state.history[step];
    await this.#putState(state);
  }

  /* -------------------------------------------- */

  /**
   * Put a Talent on the character, opening its Constellation if this is the first point in it.
   * @returns {string|null} the created Item's id
   */
  async #addTalent(entry, { slug = null, constellationName = null } = {}) {
    const doc = await talentDocument(entry);
    if (!doc) return null;
    const data = doc.toObject();
    const target = slug ?? entry.slug;
    data.system.constellation = target;
    if (constellationName) data.system.constellationName = constellationName;

    // A Talent that demands a build-time pick is not doing anything until it has an answer, so
    // ask now rather than leaving a Weapon Familiarity on the sheet that makes you familiar with
    // nothing. Declining is allowed: the Item sheet can fill it in later.
    const free = entry.freeTalent || data.system.freeTalent;
    if (data.system.choice?.prompt && !data.system.choice.value) {
      data.system.choice.value = await promptForChoice(data.system.choice.prompt, entry.name, {
        alsoApplies: free && sharesChoice(free) ? free : null
      }) ?? "";
    }

    const constellationId = await this.#ensureConstellation(target, constellationName);
    const created = await this.actor.createEmbeddedDocuments("Item", [data], { swAuto: true });
    const ids = created.map(i => i.id);
    if (constellationId) ids.unshift(constellationId);

    // Some Talents hand over another Talent outright, with no point spent. Drilled gives you
    // Weapon Familiarity, and the answer carries across rather than being asked twice.
    if (free) {
      const freeId = await this.#addFreeTalent(free, { inherit: data.system.choice?.value });
      if (freeId) ids.push(freeId);
    }

    await this.#record({ items: ids });
    return created[0]?.id ?? null;
  }

  /**
   * Add a Talent named by another Talent's Free Talent column. It is found anywhere in the book,
   * because the one that grants it need not live in the same Constellation.
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async #addFreeTalent(name, { inherit = "" } = {}) {
    const key = normalize(name);
    const entry = [...SwContent.byName.values()].find(t => normalize(t.name) === key);
    if (!entry) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Chargen.freeTalentMissing", { name }));
      return null;
    }
    if (ownsTalent(this.actor, entry.slug, entry.name)) return null;

    const doc = await talentDocument(entry);
    if (!doc) return null;
    const data = doc.toObject();
    if (data.system.choice?.prompt && !data.system.choice.value) {
      // Drilled's group has to be one you are Familiar with, and the Familiarity it hands over is
      // the only one you have, so the two are the same answer. Take it across rather than ask again.
      data.system.choice.value = adoptChoice(inherit, data.system.choice.prompt)
        || (await promptForChoice(data.system.choice.prompt, entry.name) ?? "");
    }
    const ids = [];
    const constellationId = await this.#ensureConstellation(entry.slug);
    if (constellationId) ids.push(constellationId);
    const [created] = await this.actor.createEmbeddedDocuments("Item", [data], { swAuto: true });
    if (created) ids.push(created.id);
    // Recorded by the caller along with the Talent that granted it, so Back takes both.
    if (ids.length > 1) await this.#record({ items: ids.slice(0, -1) });
    return created?.id ?? null;
  }

  /**
   * Make sure the Constellation Item exists, so the sheet draws the sky and a Lore instance
   * carries its own field name. Returns the created id, or null if it was already there.
   */
  async #ensureConstellation(slug, name = null) {
    const existing = this.actor.items.find(i => (i.type === "constellation")
      && ((i.system.slug || SW.slugify(i.name)) === slug));
    if (existing) return null;

    const pack = game.packs.get(`${SW.SYSTEM_ID}.constellations`);
    if (!pack) return null;
    const index = await pack.getIndex({ fields: ["system.slug"] });

    // A Lore (X) is a copy of the one authored Lore template.
    const templateSlug = slug.startsWith("lore-") ? "lore" : slug;
    const found = index.find(e => (e.system?.slug ?? SW.slugify(e.name)) === templateSlug);
    if (!found) return null;

    const doc = await pack.getDocument(found._id);
    const data = doc.toObject();
    data.system.slug = slug;
    if (name) data.name = name;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [data], { swAuto: true });
    return created?.id ?? null;
  }

  /* -------------------------------------------- */
  /*  Point slots                                 */
  /* -------------------------------------------- */

  /** Which step created a given Item, so a granted point appears where it was earned. */
  #stepOfItem(itemId) {
    for (const [step, entry] of Object.entries(this.state.history ?? {})) {
      if (entry.items?.includes(itemId)) return Number(step);
    }
    return this.step;
  }

  /** The point slots that belong to a step, worked out from what the character has so far. */
  #slotsFor(step) {
    const slots = [];
    const picks = this.picks;

    if (step === 4 && picks.background) {
      const bg = SwContent.chassis.background.find(b => b.name === picks.background);
      const grants = bg?.grants ?? [];
      grants.forEach((granted, i) => {
        const isLore = /^Lore\b/i.test(granted);
        const slug = isLore ? loreSlug(fieldOf(granted)) : SW.slugify(granted);
        slots.push({
          id: `bg-${i}`,
          n: 1,
          label: game.i18n.format("STARWROUGHT.Chargen.trainedIn", { name: granted }),
          hint: isLore ? "STARWROUGHT.Chargen.loreHint" : "STARWROUGHT.Chargen.trainedHint",
          scope: "constellation",
          slugs: [slug],
          constellationName: isLore ? granted : null
        });
      });
    }

    if (step === 5 && picks.calling) {
      const calling = SwContent.chassis.calling.find(c => c.name === picks.calling);
      const slug = calling?.constellation || SW.slugify(picks.calling);
      slots.push({
        id: "calling-point",
        n: 1,
        label: game.i18n.format("STARWROUGHT.Chargen.callingPoint", { name: picks.calling }),
        hint: "STARWROUGHT.Chargen.callingHint",
        scope: "constellation",
        slugs: [slug]
      });
      const granted = calling?.grants?.[0];
      if (granted) {
        slots.push({
          id: "calling-skill",
          n: 1,
          label: game.i18n.format("STARWROUGHT.Chargen.trainedIn", { name: granted }),
          hint: "STARWROUGHT.Chargen.callingSkillHint",
          scope: "constellation",
          slugs: [SW.slugify(granted)]
        });
      }
    }

    if (step === 6) {
      slots.push({
        id: "defense",
        n: 1,
        label: game.i18n.localize("STARWROUGHT.Chargen.defensePoint"),
        hint: "STARWROUGHT.Chargen.defenseHint",
        scope: "defense"
      });
    }

    if (step === 7) {
      slots.push({
        id: "comets",
        n: 3,
        label: game.i18n.localize("STARWROUGHT.Chargen.cometPoints"),
        hint: "STARWROUGHT.Chargen.cometHint",
        scope: "anywhere"
      });
    }

    // A Talent that grants a point puts that point on the step where the Talent was acquired.
    for (const item of this.actor.items) {
      if (item.type !== "talent") continue;
      const grant = item.system.grant;
      if (!grant?.n) continue;
      if (this.#stepOfItem(item.id) !== step) continue;
      slots.push(grantSlot(item, grant));
    }

    return slots;
  }

  /**
   * A slot, with everything it needs to render: what is spent, and what is still choosable.
   *
   * Every Constellation's Talent list is rendered, and all but the selected one is hidden. That
   * is what lets the picker be an ordinary `<select>`: changing it toggles a class rather than
   * re-rendering the wizard, so the dropdown behaves the way a dropdown is supposed to.
   */
  #slotView(slot) {
    const spent = this.spends[slot.id] ?? [];
    const remaining = Math.max(0, slot.n - spent.length);
    const choices = remaining ? slotChoices(this.actor, slot, spent) : [];

    // With one Constellation in scope there is nothing to choose, so it is simply shown. With
    // several, nothing is selected until the player says so: a picker that arrives pre-set on the
    // first entry reads as a decision already taken, and "Awareness" is not the answer just
    // because it sorts first.
    const single = choices.length === 1 ? choices[0] : null;
    const wanted = this.#openPicker[slot.id];
    const selected = single ? single.slug : (choices.some(c => c.slug === wanted) ? wanted : null);

    // The chips, grouped the way the sheet groups Constellations, so a long list stays scannable.
    const byCategory = {};
    for (const choice of choices) {
      const group = (byCategory[choice.category] ??= {
        key: choice.category,
        label: game.i18n.localize(SW.CATEGORIES[choice.category]?.label ?? SW.CATEGORIES.general.label),
        order: SW.CATEGORIES[choice.category]?.order ?? 9,
        constellations: []
      });
      group.constellations.push({
        slug: choice.slug,
        name: choice.name,
        attribute: choice.attribute,
        glyph: SW.ATTRIBUTES[choice.attribute]?.glyph ?? "",
        available: choice.available,
        active: choice.slug === selected
      });
    }

    return {
      ...slot,
      hint: slot.hint ? game.i18n.localize(slot.hint) : "",
      spent: spent.map(s => ({ ...s, constellation: constellationLabel(this.actor, s.slug) })),
      remaining,
      done: remaining === 0,
      choices,
      selected,
      single: !!single,
      singleName: single?.name ?? "",
      chipGroups: Object.values(byCategory).sort((a, b) => a.order - b.order),
      groups: choices.map(choice => ({
        slug: choice.slug,
        name: choice.name,
        available: choice.available,
        active: choice.slug === selected,
        talents: choice.options.map(o => ({
          name: o.talent.name,
          id: o.talent.id,
          slug: choice.slug,
          tier: o.talent.tier,
          root: o.talent.root,
          effect: o.talent.effect,
          ok: o.ok,
          why: o.why ?? ""
        }))
      })),
      // A slot with nowhere legal left to go must not be able to block the wizard forever.
      stuck: remaining > 0 && choices.length === 0
    };
  }

  /** Every slot on a step, viewed. */
  #stepSlots(step) {
    return this.#slotsFor(step).map(s => this.#slotView(s));
  }

  /**
   * Spend any point that has only one legal home.
   *
   * "Become Trained in X" is the case this exists for: if X is not open, the point buys X's Root,
   * and that purchase is what makes you Trained. There is nothing to decide, so the wizard should
   * not make you click it. The same is true of the Calling point at creation, which can only buy
   * the signature technique sitting at its Root.
   *
   * The test is simply whether the slot has exactly one legal purchase anywhere in its scope, so
   * no slot needs special-casing: a Comet never qualifies, and a directed Training always does
   * until the Constellation is already open and offers something deeper.
   */
  async #autoSpend() {
    // Buying can hand out another point, which can itself be forced, so this settles rather than
    // running once. The bound is a backstop against a data loop, not an expected path.
    for (let pass = 0; pass < 20; pass++) {
      let spentSomething = false;

      for (const slot of this.#slotsFor(this.step)) {
        const spent = this.spends[slot.id] ?? [];
        const remaining = slot.n - spent.length;
        if (remaining <= 0) continue;

        const choices = slotChoices(this.actor, slot, spent);
        const legal = choices.flatMap(c => c.options.filter(o => o.ok).map(o => ({ choice: c, option: o })));
        if (legal.length !== 1) continue;

        const { choice, option } = legal[0];
        await this.#spend(slot, choice.slug, option.talent, { auto: true });
        spentSomething = true;
        break; // The state moved; work the list out again.
      }

      if (!spentSomething) return;
    }
  }

  /**
   * Put one Talent on the character and record it against a slot.
   * @param {object} slot
   * @param {string} slug
   * @param {object} entry     A cached Talent entry.
   * @param {object} [options]
   * @param {boolean} [options.auto]  Taken automatically because nothing else was legal.
   */
  async #spend(slot, slug, entry, { auto = false } = {}) {
    const itemId = await this.#addTalent(entry, {
      slug,
      constellationName: slot.constellationName ?? (slug.startsWith("lore-") ? loreName(slug) : null)
    });
    if (!itemId) return null;
    const spends = foundry.utils.deepClone(this.spends);
    (spends[slot.id] ??= []).push({ slug, name: entry.name, itemId, auto });
    await this.#setState({ spends });
    return itemId;
  }

  /** Settle any forced spends, then draw. */
  async #refresh() {
    await this.#autoSpend();
    this.render();
  }

  /**
   * What is still holding this step up, named. A blocked Next button that only says "incomplete"
   * is no help when the thing blocking it is below the fold.
   */
  #outstanding(step) {
    const needs = { 1: "ancestry", 2: "bloodline", 3: "culture", 4: "background", 5: "calling" }[step];
    if (needs && !this.picks[needs]) {
      return [{ id: "", label: game.i18n.format("STARWROUGHT.Chargen.needChoice", {
        step: game.i18n.localize(`STARWROUGHT.Chargen.step.${STEPS[step].id}`)
      }) }];
    }
    return this.#stepSlots(step)
      .filter(s => !s.done && !s.stuck)
      .map(s => ({ id: s.id, label: s.label, remaining: s.remaining }));
  }

  /** A step is complete when its choice is made and its points are spent. */
  #stepComplete(step) {
    const picks = this.picks;
    const needs = {
      1: "ancestry", 2: "bloodline", 3: "culture", 4: "background", 5: "calling"
    }[step];
    if (needs && !picks[needs]) return false;
    return this.#stepSlots(step).every(s => s.done || s.stuck);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    await loadChargenContent();
    const step = this.step;
    const picks = this.picks;

    const context = {
      actor: this.actor,
      system: this.actor.system,
      step,
      stepId: STEPS[step].id,
      picks,
      steps: STEPS.map((s, i) => ({
        index: i,
        id: s.id,
        icon: s.icon,
        label: game.i18n.localize(`STARWROUGHT.Chargen.step.${s.id}`),
        active: i === step,
        done: i < step,
        reachable: i <= step
      })),
      slots: this.#stepSlots(step),
      // The five identity steps share one card grid, so the template needs the action's name.
      chooseAction: `choose${STEPS[step].id.charAt(0).toUpperCase()}${STEPS[step].id.slice(1)}`,
      complete: this.#stepComplete(step),
      outstanding: this.#outstanding(step),
      isFirst: step === 0,
      isLast: step === STEPS.length - 1,
      SW
    };

    await this[`_context_${STEPS[step].id}`]?.(context);
    context.summary = this.#summary();
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context) {
    context.partId = partId;
    return context;
  }

  async _context_start(context) {
    context.freeTrainings = FREE_TRAININGS.map(slug => ({
      slug,
      name: SW.getConstellation(slug).name,
      root: rootOf(slug)?.name ?? "",
      owned: pointsIn(this.actor, slug) > 0
    }));
  }

  async _context_ancestry(context) {
    context.cards = SwContent.chassis.ancestry.map(a => ({
      key: a.name,
      name: a.name,
      img: a.img,
      chosen: this.picks.ancestry === a.name,
      lines: [
        `${a.hp} ${game.i18n.localize("STARWROUGHT.Field.hpPerLevel")}`,
        game.i18n.localize(SW.SIZES[a.size]?.label ?? ""),
        `${a.speed} ft`
      ].filter(Boolean),
      description: a.description
    }));
  }

  async _context_bloodline(context) {
    const ancestry = SwContent.chassis.ancestry.find(a => a.name === this.picks.ancestry);
    const slug = ancestry?.constellation;
    context.cards = slug ? bloodlinesIn(slug).map(t => ({
      key: t.name,
      name: t.name,
      img: t.img,
      chosen: this.picks.bloodline === t.name,
      lines: [],
      description: t.effect
    })) : [];
    context.parentName = ancestry?.name ?? "";
  }

  async _context_culture(context) {
    context.cards = SwContent.chassis.culture.map(c => ({
      key: c.name,
      name: c.name,
      img: c.img,
      chosen: this.picks.culture === c.name,
      lines: [c.languages].filter(Boolean),
      description: `${c.description ?? ""}${c.specialAbility ?? ""}`
    }));
  }

  async _context_background(context) {
    context.cards = SwContent.chassis.background.map(b => ({
      key: b.name,
      name: b.name,
      img: b.img,
      chosen: this.picks.background === b.name,
      lines: b.grants ?? [],
      description: `${b.description ?? ""}${b.specialAbility ?? ""}`
    }));
  }

  async _context_calling(context) {
    context.cards = SwContent.chassis.calling.map(c => ({
      key: c.name,
      name: c.name,
      img: c.img,
      chosen: this.picks.calling === c.name,
      lines: [
        `${c.hp} ${game.i18n.localize("STARWROUGHT.Field.hpPerLevel")}`,
        ...(c.grants ?? [])
      ],
      description: `${c.specialAbility ?? ""}${c.description ?? ""}`
    }));
  }

  async _context_review(context) {
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    context.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.details.biography ?? "", {
      relativeTo: this.actor
    });
  }

  /** The build so far, shown on every step. */
  #summary() {
    const sys = this.actor.system;
    const constellations = Object.values(sys.constellations ?? {})
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map(c => ({
        name: c.name,
        points: c.points,
        rank: game.i18n.localize(c.rankLabel ?? ""),
        glyph: SW.ATTRIBUTES[c.attribute]?.glyph ?? ""
      }));
    return {
      talents: this.actor.items.filter(i => i.type === "talent").length,
      constellations,
      attributes: Object.entries(sys.attributes ?? {}).map(([key, a]) => ({
        key, glyph: a.glyph, mod: a.mod, points: a.points,
        label: game.i18n.localize(a.label ?? "")
      })),
      hp: sys.hp?.max ?? 0,
      defenses: Object.values(sys.defenses ?? {}).map(d => ({
        label: game.i18n.localize(d.label), mod: d.mod, threshold: d.threshold
      }))
    };
  }

  /* -------------------------------------------- */
  /*  Identity choices                            */
  /* -------------------------------------------- */

  /** One handler shape for all five identity steps. */
  static #onChoose(kind) {
    return async function (event, target) {
      const key = target.dataset.key;
      if (this.picks[kind] === key) return;

      // Walking away from a choice takes everything that came with it.
      await this.#undoStep(this.step);

      await this[`_choose_${kind}`](key);
      await this.#setState({ picks: { [kind]: key } });
      this.#openPicker = {};
      await this.#refresh();
    };
  }

  async _choose_ancestry(name) {
    const ancestry = SwContent.chassis.ancestry.find(a => a.name === name);
    if (!ancestry) return;
    await this.#update({
      "system.details.ancestry.name": ancestry.name,
      "system.details.ancestry.hp": ancestry.hp ?? 0,
      "system.details.ancestry.speed": ancestry.speed ?? 25,
      "system.details.ancestry.senses": ancestry.senses ?? "",
      "system.size": ancestry.size ?? "medium"
    });
    const root = rootOf(ancestry.constellation);
    if (root) await this.#addTalent(root);
  }

  async _choose_bloodline(name) {
    const ancestry = SwContent.chassis.ancestry.find(a => a.name === this.picks.ancestry);
    const entry = bloodlinesIn(ancestry?.constellation ?? "").find(t => t.name === name);
    if (!entry) return;
    await this.#update({ "system.details.bloodline.name": name });
    await this.#addTalent(entry);
  }

  async _choose_culture(name) {
    const culture = SwContent.chassis.culture.find(c => c.name === name);
    if (!culture) return;
    const existing = this.actor.system.details.languages;
    const languages = [existing, culture.languages].filter(Boolean).join(", ");
    await this.#update({
      "system.details.culture.name": name,
      "system.details.languages": languages
    });
    const root = rootOf(culture.constellation);
    if (root) await this.#addTalent(root);
  }

  async _choose_background(name) {
    await this.#update({ "system.details.background.name": name });
  }

  async _choose_calling(name) {
    const calling = SwContent.chassis.calling.find(c => c.name === name);
    if (!calling) return;
    await this.#update({
      "system.details.calling.name": name,
      "system.details.calling.hp": calling.hp ?? 0
    });
  }

  /* -------------------------------------------- */
  /*  Spending                                    */
  /* -------------------------------------------- */

  /**
   * Choosing which Constellation a point goes into swaps the Talent list below. Every list is
   * already in the DOM, so this toggles classes rather than re-rendering: the page does not jump,
   * and the scroll position is kept.
   */
  static #onPickConstellation(event, target) {
    const slotId = target.dataset.slot;
    const slug = target.dataset.slug;
    this.#openPicker[slotId] = slug;

    const panel = target.closest(".sw-slot");
    for (const chip of panel.querySelectorAll(".sw-con-chip")) {
      chip.classList.toggle("active", chip.dataset.slug === slug);
    }
    for (const list of panel.querySelectorAll("[data-group]")) {
      list.classList.toggle("active", list.dataset.group === slug);
    }
    panel.querySelector(".sw-picker-hint")?.classList.add("sw-hidden");
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const body = this.element.querySelector(".sw-chargen-body");
    if (!body) return;

    // The talent cards are list items acting as buttons, so give them a keyboard.
    body.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      const card = event.target.closest?.(".sw-talent-option[data-action]");
      if (!card) return;
      event.preventDefault();
      card.click();
    });

    // The parts are rebuilt on every render, so the scroll listener is too.
    body.addEventListener("scroll", () => this.#updateScrollCue(), { passive: true });
    this.#updateScrollCue();
  }

  /**
   * Show the "more below" cue while the first unspent point is out of sight beneath the fold, and
   * hide it otherwise. A greyed Next and a small footer link were not cue enough on their own: the
   * playtest read a step with an unspent point below the fold as "Next is broken".
   */
  #updateScrollCue() {
    const body = this.element?.querySelector(".sw-chargen-body");
    const cue = this.element?.querySelector(".sw-scroll-cue");
    if (!body || !cue) return;
    const pending = body.querySelector(".sw-slot:not(.sw-slot-done):not(.sw-slot-stuck)");
    const below = !!pending
      && (pending.getBoundingClientRect().top > (body.getBoundingClientRect().bottom - 48));
    cue.hidden = !below;
    if (below) cue.dataset.slot = pending.dataset.slotId;
    this.element.querySelector(".sw-outstanding")?.classList.toggle("sw-below-fold", below);
  }

  static async #onBuyTalent(event, target) {
    const slotId = target.dataset.slot;
    let slug = target.dataset.slug;
    const talentId = target.dataset.talent;

    const slot = this.#slotsFor(this.step).find(s => s.id === slotId);
    if (!slot) return;

    let entry = talentsIn(slug).find(t => t.id === talentId);
    let constellationName = slot.constellationName ?? null;

    // Every Lore (X) is its own Constellation. Ask which field this one is.
    if (slug === "lore") {
      const field = await promptForLoreField();
      if (!field) return;
      constellationName = `Lore (${field})`;
      slug = loreSlug(field);
      entry = talentsIn("lore").find(t => t.id === talentId);
    } else if (slug.startsWith("lore-")) {
      constellationName ??= loreName(slug);
    }
    if (!entry) return;

    const check = canBuy(this.actor, slug, entry);
    if (!check.ok) {
      ui.notifications.warn(check.why);
      return;
    }

    await this.#spend({ ...slot, constellationName }, slug, entry);
    await this.#refresh();
  }

  /**
   * Scroll the slot that is blocking Next into view, and flash it.
   *
   * Measured and scrolled by hand rather than with scrollIntoView, which does nothing here: the
   * scrolling element is the Application part itself, and asking the child to bring itself into
   * view leaves it where it was.
   */
  static #onRevealSlot(event, target) {
    const slot = this.element.querySelector(`.sw-slot[data-slot-id="${target.dataset.slot}"]`);
    const container = this.element.querySelector(".sw-chargen-body");
    if (!slot || !container) return;

    const box = container.getBoundingClientRect();
    const rect = slot.getBoundingClientRect();
    const delta = (rect.top - box.top) - ((box.height - rect.height) / 2);
    // Instant rather than smooth: a smooth scroll is an animation, and an animation that never
    // gets a frame never arrives. The flash is what marks the landing.
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "instant" });

    slot.classList.remove("sw-slot-flash");
    // Reading offsetWidth restarts the animation when the same slot is clicked twice.
    void slot.offsetWidth;
    slot.classList.add("sw-slot-flash");
  }

  static async #onUndoSpend(event, target) {
    const slotId = target.dataset.slot;
    const itemId = target.dataset.item;
    const state = foundry.utils.deepClone(this.state);
    const list = state.spends?.[slotId] ?? [];
    const index = list.findIndex(s => s.itemId === itemId);
    if (index < 0) return;

    // Take back the Talent, and the Constellation Item if that Talent was the only thing in it.
    const item = this.actor.items.get(itemId);
    const slug = list[index].slug;
    const ids = [itemId];
    if (item && (pointsIn(this.actor, slug) === 1)) {
      const constellation = this.actor.items.find(i => (i.type === "constellation")
        && ((i.system.slug || SW.slugify(i.name)) === slug));
      if (constellation) ids.push(constellation.id);
    }
    await this.actor.deleteEmbeddedDocuments("Item", ids.filter(id => this.actor.items.has(id)));

    list.splice(index, 1);
    if (list.length) state.spends[slotId] = list;
    else delete state.spends[slotId];
    for (const entry of Object.values(state.history ?? {})) {
      entry.items = (entry.items ?? []).filter(id => !ids.includes(id));
    }
    await this.#putState(state);
    await this.#refresh();
  }

  /* -------------------------------------------- */
  /*  Movement                                    */
  /* -------------------------------------------- */

  static async #onNext() {
    if (!this.#stepComplete(this.step)) {
      ui.notifications.warn(game.i18n.localize("STARWROUGHT.Chargen.incomplete"));
      return;
    }
    if (this.step === 0) await this.#grantFreeTrainings();
    await this.#setState({ step: Math.min(STEPS.length - 1, this.step + 1) });
    this.#openPicker = {};
    await this.#refresh();
  }

  static async #onBack() {
    if (this.step === 0) return;
    // Backing out of a step takes the choices that step made with it.
    await this.#undoStep(this.step);
    await this.#setState({ step: this.step - 1 });
    this.#openPicker = {};
    await this.#refresh();
  }

  /** Clicking an earlier step in the trail unwinds every step between here and there. */
  static async #onGoto(event, target) {
    const target_ = Number(target.dataset.index);
    if (!Number.isInteger(target_) || target_ >= this.step) return;
    for (let s = this.step; s > target_; s--) await this.#undoStep(s);
    await this.#setState({ step: target_ });
    this.#openPicker = {};
    await this.#refresh();
  }

  /** Weapons Training and all four Defense Trainings, free, before anything is spent. */
  async #grantFreeTrainings() {
    for (const slug of FREE_TRAININGS) {
      const root = rootOf(slug);
      if (!root || ownsTalent(this.actor, slug, root.name)) continue;
      await this.#addTalent(root);
    }
  }

  static async #onFinish() {
    const blockers = [];
    for (let s = 0; s < STEPS.length - 1; s++) {
      if (!this.#stepComplete(s)) {
        blockers.push(game.i18n.localize(`STARWROUGHT.Chargen.step.${STEPS[s].id}`));
      }
    }
    if (blockers.length) {
      ui.notifications.warn(game.i18n.format("STARWROUGHT.Chargen.blocked", { steps: blockers.join(", ") }));
      return;
    }
    const name = this.element.querySelector("input[name='charname']")?.value?.trim();
    const updates = { "system.hp.value": this.actor.system.hp.max };
    if (name) updates.name = name;
    await this.actor.update(updates);
    await this.actor.unsetFlag(SW.SYSTEM_ID, "chargen");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="starwrought action-card"><h3>${game.i18n.localize("STARWROUGHT.Chargen.done")}</h3>
        <p>${game.i18n.format("STARWROUGHT.Chargen.doneText", {
          name: this.actor.name,
          talents: this.actor.items.filter(i => i.type === "talent").length,
          ancestry: this.actor.system.details.ancestry.name,
          calling: this.actor.system.details.calling.name
        })}</p></div>`
    });
    await this.close();
    this.actor.sheet.render({ force: true });
  }

  /** Abandon the whole build, taking every choice back off the character. */
  static async #onCancel() {
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("STARWROUGHT.Chargen.cancelTitle") },
      content: `<p>${game.i18n.localize("STARWROUGHT.Chargen.cancelBody")}</p>`
    });
    if (!confirmed) return;
    for (let s = this.step; s >= 0; s--) await this.#undoStep(s);
    await this.actor.unsetFlag(SW.SYSTEM_ID, "chargen");
    await this.close();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async close(options) {
    // Leaving the wizard open on a half-built character is fine: the state is on the Actor.
    return super.close(options);
  }
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/**
 * Would this Talent's own build-time question be answered by the same pick? Used to say so on the
 * one prompt that gets shown, rather than surprising the player with a second one.
 * @param {string} name  A Talent name.
 */
function sharesChoice(name) {
  const key = normalize(name);
  const entry = [...SwContent.byName.values()].find(t => normalize(t.name) === key);
  return !!entry?.choice;
}

/**
 * Take an answer across from the Talent that granted this one, but only if it is actually a legal
 * answer here. A free-text choice accepts anything; a listed one has to contain it.
 * @param {string} value
 * @param {string} prompt
 * @returns {string} the adopted answer, or "" if it does not fit
 */
function adoptChoice(value, prompt) {
  if (!value) return "";
  const options = choiceOptions(prompt);
  if (!options) return value;
  return options.includes(value) ? value : "";
}

/** "Lore (Circus)" into "Circus". */
function fieldOf(name) {
  const match = String(name).match(/\(([^)]+)\)/);
  return match ? match[1] : String(name).replace(/^Lore\s*/i, "").trim();
}

/** Turn a Talent's Grants column into a point slot. */
function grantSlot(item, grant) {
  const scope = GRANT_SCOPES[grant.scope] ?? { scope: "anywhere" };
  const slot = {
    id: `grant:${item.id}`,
    n: grant.n,
    mode: grant.mode,
    label: game.i18n.format("STARWROUGHT.Chargen.grantPoint", { name: item.name, n: grant.n }),
    hint: "STARWROUGHT.Chargen.grantHint",
    ...scope
  };
  if (grant.mode === "open") {
    slot.scope = "open";
    if (grant.scope === "non-Skill") slot.exclude = "skill";
  }
  return slot;
}

/**
 * Ask a Talent's build-time question. A recognized prompt gets a list to pick from; anything else
 * gets a text box, so a new kind of Choice can be authored in the spreadsheet and answered before
 * any code knows what it means.
 * @param {string} prompt   The spreadsheet's Choice cell.
 * @param {string} talent   The Talent asking.
 * @returns {Promise<string|null>}
 */
export async function promptForChoice(prompt, talent, { alsoApplies = null } = {}) {
  const options = choiceOptions(prompt);
  const field = options
    ? `<select name="value" style="width: 100%">${
        options.map(o => `<option value="${foundry.utils.escapeHTML(o)}">${foundry.utils.escapeHTML(o)}</option>`).join("")
      }</select>`
    : `<input type="text" name="value" style="width: 100%">`;

  const shared = alsoApplies
    ? `<p class="sw-note">${game.i18n.format("STARWROUGHT.Chargen.choiceShared", { name: alsoApplies })}</p>`
    : "";

  return DialogV2.prompt({
    window: { title: game.i18n.format("STARWROUGHT.Chargen.choiceTitle", { talent }), icon: "fa-solid fa-hand-pointer" },
    classes: ["starwrought"],
    content: `<p>${game.i18n.format("STARWROUGHT.Chargen.choicePrompt", { talent, prompt })}</p>${shared}${field}`,
    ok: {
      label: game.i18n.localize("STARWROUGHT.Chargen.choiceOk"),
      callback: (event, target) => target.form.elements.value.value.trim()
    },
    rejectClose: false
  });
}

/** Ask which field of Lore this is, since every Lore (X) is its own Constellation. */
async function promptForLoreField() {
  return DialogV2.prompt({
    window: { title: game.i18n.localize("STARWROUGHT.Chargen.loreTitle") },
    classes: ["starwrought"],
    content: `<p>${game.i18n.localize("STARWROUGHT.Chargen.lorePrompt")}</p>
      <input type="text" name="field" placeholder="${game.i18n.localize("STARWROUGHT.Chargen.lorePlaceholder")}">`,
    ok: { callback: (event, target) => target.form.elements.field.value.trim() },
    rejectClose: false
  });
}
