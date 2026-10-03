/**
 * The party sheet (0.7.0; party-sheet-plan.md, parts 1 to 4).
 *
 * The GM's console and the players' window at once: one template set that branches on `isGM`
 * and on per-member ownership, as the character sheet's header does. The header carries the
 * session and the GM's buttons; the roster, always open above the tabs, is a status board with
 * one row per member; the Skills grid is a tab, Constellations as rows and members as columns;
 * the GM's notes are a tab the players never see.
 *
 * Everything member-dependent is computed here, in `_prepareContext`, from the resolved members
 * (plan, risk 2): the party's own data model derives nothing from them. The sheet re-renders its
 * roster and grid on the member hooks (updateActor, Items and Active Effects on a member; a
 * member deleted), debounced on a timer, never a requestAnimationFrame latch, and only when the
 * changed document is a member or belongs to one. Every rule effect runs on the member's own
 * Actor through a method that already exists and posts its card: `rollCheck`, `rollDefense`, the
 * Combat's `rollInitiativeWithCheck`, `toggleFlare`, `restForTheNight`, and the party operations
 * in helpers/party.mjs for the few small writes the party makes to a member.
 *
 * ApplicationV2 actions fire regardless of editability, and a player opens this sheet as an
 * Observer, so every handler re-checks before writing: `game.user.isGM` for the party's writes
 * and the GM's buttons, `testUserPermission(game.user, "OWNER")` on the member for a player's
 * Flare put-out and Spent. For the same reason every control a player may click is an anchor,
 * since DocumentSheetV2 disables every form element for a user who cannot edit.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { enabledConstellations } from "../helpers/content.mjs";
import { windTip, vigorContext, zoneWounds } from "./actor-sheet.mjs";
import { pickFlare } from "./flare-picker.mjs";
import {
  resolveMembers, memberCandidate, addMember, removeMember, addPlayerCharacters,
  beginSession, awardHeroPoint, correctHeroPoint, partyRests, restPreview,
  previewMilestone, awardMilestone, takeBackAward, spendDeferred
} from "../helpers/party.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const signed = value => {
  const n = Number(value) || 0;
  return `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
};

/** How long a burst of member changes is collected before the board redraws once, in ms. */
const RERENDER_DELAY = 150;

/** The hooks a member's change arrives on. Items and Active Effects carry their parent. */
const MEMBER_DOCUMENT_HOOKS = Object.freeze([
  "createItem", "updateItem", "deleteItem",
  "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"
]);

export class SwPartySheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["starwrought", "sheet", "actor", "party"],
    position: { width: 980, height: 780 },
    window: { resizable: true, icon: "fa-solid fa-people-group" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: SwPartySheet.#onEditImage,
      openMember: SwPartySheet.#onOpenMember,
      removeMember: SwPartySheet.#onRemoveMember,
      addPlayerCharacters: SwPartySheet.#onAddPlayerCharacters,
      beginSession: SwPartySheet.#onBeginSession,
      awardMilestone: SwPartySheet.#onAwardMilestone,
      takeBack: SwPartySheet.#onTakeBack,
      partyRests: SwPartySheet.#onPartyRests,
      awardHeroPoint: SwPartySheet.#onAwardHeroPoint,
      correctHeroPoint: SwPartySheet.#onCorrectHeroPoint,
      flareAward: SwPartySheet.#onFlareAward,
      flareOut: SwPartySheet.#onFlareOut,
      spendDeferred: SwPartySheet.#onSpendDeferred,
      rollCell: SwPartySheet.#onRollCell
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: "systems/starwrought/templates/actor/party-header.hbs" },
    roster: { template: "systems/starwrought/templates/actor/party-roster.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: { template: "systems/starwrought/templates/actor/party-skills.hbs", scrollable: [""] },
    notes: { template: "systems/starwrought/templates/actor/party-notes.hbs", scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      initial: "skills",
      labelPrefix: "STARWROUGHT.Tab",
      tabs: [
        { id: "skills", icon: "fa-solid fa-table-cells" },
        { id: "notes", icon: "fa-solid fa-book-open" }
      ]
    }
  };

  /** The member hooks this sheet registered, as [hook, id] pairs, or null while none are. */
  #memberHooks = null;

  /** The pending redraw, or null. One timer collects a burst of member changes into one render. */
  #renderTimer = null;

  /** True while a Milestone award is being written, so a second click cannot double it (plan, risk 3). */
  #awarding = false;

  /* -------------------------------------------- */
  /*  Parts and tabs                              */
  /* -------------------------------------------- */

  /** @inheritdoc. The GM's notes are a part the players never render. */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!game.user.isGM) delete parts.notes;
    return parts;
  }

  /** @inheritdoc. And a tab they never see. */
  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if (!config || game.user.isGM) return config;
    return { ...config, tabs: config.tabs.filter(t => t.id !== "notes") };
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const party = this.document;
    const isGM = game.user.isGM;
    const members = resolveMembers(party);

    Object.assign(context, {
      actor: party,
      system: party.system,
      editable: this.isEditable,
      isGM,
      config: SW,
      SW
    });

    const session = party.system.session ?? {};
    context.session = {
      number: Number(session.number) || 0,
      began: session.began ? new Date(session.began).toLocaleString() : null
    };

    const award = party.system.lastAward;
    context.lastAward = award?.members?.length ? {
      count: award.members.length,
      session: award.session ?? 0,
      names: award.members.map(m => m.name).join(", "),
      tooltip: F("STARWROUGHT.Party.takeBackHint", {
        count: award.members.length, session: award.session ?? 0, names: award.members.map(m => m.name).join(", ")
      })
    } : null;

    context.rows = members.map(m => this.#memberRow(m));
    context.anyOwned = context.rows.some(r => r.owner);
    context.grid = this.#prepareGrid(members.map(m => m.actor).filter(Boolean));
    context.milestoneMax = SW.MILESTONES_PER_LEVEL;
    context.heroMax = SW.HERO_POINTS_MAX;

    if (isGM) {
      const TextEditor = foundry.applications.ux.TextEditor.implementation;
      context.enrichedNotes = await TextEditor.enrichHTML(party.system.notes, { relativeTo: party });
    }
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context) {
    context.partId = partId;
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */

  /**
   * One roster row, every number the member's own derived data, read, never recomputed (plan,
   * part 1). A member whose Actor cannot be found prints as a missing row with Remove only.
   * @param {{uuid: string, actor: Actor|null}} member
   * @returns {object}
   */
  #memberRow({ uuid, actor }) {
    if (!actor) {
      return { uuid, missing: true, name: L("STARWROUGHT.Party.missingMember"), owner: false };
    }
    const sys = actor.system;
    const owner = actor.testUserPermission(game.user, "OWNER");
    const of = SW.MILESTONES_PER_LEVEL;
    const reached = Math.clamp(Number(sys.milestone) || 0, 0, of);
    const heroPoints = Number(sys.heroPoints?.value) || 0;

    // The Flared Constellations as chips, named as the member's own data spells them.
    const flares = Object.keys(sys.flares ?? {})
      .map(slug => ({ slug, name: sys.constellations?.[slug]?.name ?? SW.getConstellation(slug)?.name ?? slug }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Wounds: the count, with the Zones on hover.
    const zones = Object.keys(SW.ZONES).map(key => zoneWounds(actor, key)).filter(z => z.wounds > 0);
    const woundCount = Number(sys.woundCount) || zones.reduce((n, z) => n + z.wounds, 0);
    const woundsTip = zones.length
      ? zones.map(z => F("STARWROUGHT.Party.woundsZone", {
          zone: L(SW.ZONES[z.key].label), n: z.wounds, capacity: z.capacity
        })).join("; ")
      : L("STARWROUGHT.Party.woundsNone");

    // The players who own the character, as colour dots, dim when not connected.
    const players = game.users
      .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
      .map(u => ({ id: u.id, name: u.name, color: String(u.color?.css ?? u.color ?? "#888888"), active: !!u.active }));

    return {
      uuid,
      id: actor.id,
      name: actor.name,
      img: actor.img,
      owner,
      missing: false,
      level: Number(sys.level) || 1,
      milestones: {
        reached,
        pips: Array.fromRange(of, 1).map(n => ({ n, filled: n <= reached })),
        tooltip: F("STARWROUGHT.Milestone.pipHint", { n: reached, of })
      },
      deferred: Number(sys.deferred) || 0,
      heroPoints,
      heroMax: SW.HERO_POINTS_MAX,
      heroFull: heroPoints >= SW.HERO_POINTS_MAX,
      vigor: vigorContext(actor),
      spent: sys.spent ?? ((sys.vigor?.value ?? 1) === 0),
      woundCount,
      woundsTip,
      dying: Number(sys.dying) || 0,
      fatigued: Number(actor.conditionValue?.("fatigued")) || 0,
      loadStrain: Number(sys.loadStrain) || 0,
      loadStrainTip: windTip(actor),
      speed: Number(sys.speed ?? sys.moveSpeed) || 0,
      players,
      flares
    };
  }

  /* -------------------------------------------- */

  /**
   * The Skills grid (plan, part 4): Constellations as rows, members as columns, because the
   * question is "who has Stealth". The four Defenses show the Threshold, since that is what a
   * Sneak, a Feint or a Lie is measured against (ruling 95: players see them too); an Initiative
   * row, live only while a Combat holds the member; the Skill Constellations that ship, the Lore
   * template left out, plus any a member has opened that has since been switched off; Melee and
   * Ranged with rank and Proficiency and the inherited pool on hover; and one row per Lore any
   * member has opened. A Skill cell is `SwCheck.previewTotal`, so Stealth carries Load Strain and
   * a Frightened member's cells carry the penalty; the best in each row is marked, ties all; a
   * cell is live only on a member the user owns.
   * @param {Actor[]} actors
   * @returns {object}
   */
  #prepareGrid(actors) {
    const columns = actors.map(a => ({
      uuid: a.uuid, id: a.id, name: a.name, img: a.img,
      live: a.testUserPermission(game.user, "OWNER")
    }));
    const live = new Map(columns.map(c => [c.uuid, c.live]));
    const rankLabel = rank => L(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label);

    // Mark the best value in a row, ties all; blank cells never compete.
    const mark = cells => {
      const values = cells.filter(c => !c.blank && Number.isFinite(c.value)).map(c => c.value);
      if (!values.length) return cells;
      const best = Math.max(...values);
      for (const cell of cells) cell.best = !cell.blank && (cell.value === best);
      return cells;
    };
    const base = (actor, extra) => ({ uuid: actor.uuid, live: live.get(actor.uuid) ?? false, blank: false, best: false, ...extra });

    const groups = [];

    // The four Defenses: the Threshold, with the modifier and rank on hover.
    groups.push({
      key: "defenses",
      label: L("STARWROUGHT.Category.defense"),
      rows: Object.entries(SW.DEFENSES).map(([key, def]) => {
        const cells = actors.map(actor => {
          const d = actor.system.defenses?.[key];
          const rank = d?.rank ?? "untrained";
          const threshold = Number(d?.threshold) || 10;
          return base(actor, {
            kind: "defense", key,
            value: threshold, display: String(threshold),
            rank, rankAbbr: SW.RANKS[rank]?.abbr ?? "U", untrained: rank === "untrained",
            tooltip: F("STARWROUGHT.Party.defenseCellTip", {
              defense: L(def.label), threshold, mod: signed(d?.mod ?? 0), rank: rankLabel(rank)
            })
          });
        });
        const attribute = SW.DEFENSES[key].attribute;
        return {
          key: `defense-${key}`, kind: "defense", label: L(def.label), hint: L(def.hint),
          attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells)
        };
      })
    });

    // Initiative: the modifier, live only while a Combat holds the member.
    const initiativeCells = actors.map(actor => {
      const mod = Number(actor.system.initiative?.mod) || 0;
      const inCombat = !!actor.combatant;
      return base(actor, {
        kind: "initiative",
        value: mod, display: signed(mod),
        rank: null, rankAbbr: "", untrained: false,
        live: inCombat && (live.get(actor.uuid) ?? false),
        tooltip: F(inCombat ? "STARWROUGHT.Party.initiativeLiveTip" : "STARWROUGHT.Party.initiativeNotInCombat", { mod: signed(mod) })
      });
    });
    groups[0].rows.push({
      key: "initiative", kind: "initiative", label: L("STARWROUGHT.Field.initiative"),
      hint: L("STARWROUGHT.Party.initiativeHint"), attribute: "", glyph: "", cells: mark(initiativeCells)
    });

    // A Skill cell: the preview total, rank letter, Threshold in the tooltip.
    const checkCell = (actor, slug, name) => {
      const prof = actor.system.proficiency(slug);
      const mod = SwCheck.previewTotal(actor, { kind: "check", slug });
      return base(actor, {
        kind: "check", slug,
        value: mod, display: signed(mod),
        rank: prof.rank, rankAbbr: SW.RANKS[prof.rank]?.abbr ?? "U", untrained: prof.rank === "untrained",
        tooltip: F("STARWROUGHT.Party.checkCellTip", { name, mod: signed(mod), rank: rankLabel(prof.rank), threshold: 10 + mod })
      });
    };
    const skillRow = (slug, name, attribute) => ({
      key: `skill-${slug}`, kind: "check", slug, label: name, hint: "",
      attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "",
      cells: mark(actors.map(actor => checkCell(actor, slug, name)))
    });

    // The Skill Constellations that ship, the Lore template excluded, and any skill a member has
    // opened that the spreadsheets have since switched off (as the Relevant Check picker lists it).
    const skills = new Map();
    for (const meta of enabledConstellations()) {
      if (!meta.slug || (meta.category !== "skill") || SW.isLoreSlug(meta.slug)) continue;
      skills.set(meta.slug, { name: meta.name, attribute: meta.attribute });
    }
    for (const actor of actors) {
      for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
        if (skills.has(slug) || (entry.category !== "skill") || SW.isLoreSlug(slug)) continue;
        skills.set(slug, { name: entry.name, attribute: entry.attribute });
      }
    }
    groups.push({
      key: "skills",
      label: L("STARWROUGHT.Category.skill"),
      rows: [...skills.entries()]
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([slug, meta]) => skillRow(slug, meta.name, meta.attribute))
    });

    // Melee and Ranged: rank and Proficiency, the pool and what is inherited on hover.
    const weaponRow = (slug, key, fallbackAttribute) => {
      const name = L(`STARWROUGHT.Field.${key}`);
      const cells = actors.map(actor => {
        const training = actor.system[key] ?? { rank: "untrained", proficiency: 0, points: 0, pool: 0 };
        const con = actor.system.constellations?.[slug];
        const rank = training.rank ?? "untrained";
        return base(actor, {
          kind: "check", slug,
          value: Number(training.proficiency) || 0, display: signed(training.proficiency),
          rank, rankAbbr: SW.RANKS[rank]?.abbr ?? "U", untrained: rank === "untrained",
          tooltip: F("STARWROUGHT.Party.weaponCellTip", {
            name, rank: rankLabel(rank), mod: signed(training.proficiency),
            pool: Number(con?.pool ?? training.pool) || 0, inherited: Number(con?.inherited) || 0
          })
        });
      });
      const attribute = actors[0]?.system.constellations?.[slug]?.attribute ?? SW.constellations[slug]?.attribute ?? fallbackAttribute;
      return {
        key: `weapon-${slug}`, kind: "check", slug, label: name, hint: L(`STARWROUGHT.Field.${key}Hint`),
        attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells)
      };
    };
    groups.push({
      key: "weapons",
      label: L("STARWROUGHT.Category.weapon"),
      rows: [weaponRow(SW.MELEE_SLUG, "melee", "might"), weaponRow(SW.RANGED_SLUG, "ranged", "agility")]
    });

    // One row per Lore any member has opened; a member without it shows a blank.
    const lores = new Map();
    for (const actor of actors) {
      for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
        if (!SW.isLoreSlug(slug) || (slug === "lore") || lores.has(slug)) continue;
        lores.set(slug, { name: entry.name, attribute: entry.attribute });
      }
    }
    if (lores.size) {
      groups.push({
        key: "lore",
        label: L("STARWROUGHT.Category.lore"),
        rows: [...lores.entries()]
          .sort((a, b) => a[1].name.localeCompare(b[1].name))
          .map(([slug, meta]) => ({
            key: `lore-${slug}`, kind: "check", slug, label: meta.name, hint: "",
            attribute: meta.attribute, glyph: SW.ATTRIBUTES[meta.attribute]?.glyph ?? "",
            cells: mark(actors.map(actor => (actor.system.constellations?.[slug]
              ? checkCell(actor, slug, meta.name)
              : base(actor, { kind: "check", slug, blank: true, live: false, value: null, display: "", rank: null, rankAbbr: "", untrained: true, tooltip: "" }))))
          }))
      });
    }

    return { columns, groups, span: columns.length + 1 };
  }

  /* -------------------------------------------- */
  /*  Rendering and the member hooks              */
  /* -------------------------------------------- */

  /** @inheritdoc. The member hooks are registered once, on the first render, and go with the sheet. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.#memberHooks) this.#registerMemberHooks();
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    this.#unregisterMemberHooks();
    if (this.#renderTimer) {
      clearTimeout(this.#renderTimer);
      this.#renderTimer = null;
    }
  }

  /**
   * Listen for the members' changes: the Actor itself, its Items and Active Effects (Fatigued is
   * an effect; armor is an Item), and its deletion, which turns its row into a missing one.
   * Nothing here reads the change; it only asks for a redraw when the document is a member or
   * belongs to one, and the redraw reads live data.
   */
  #registerMemberHooks() {
    const hooks = [];
    const onActor = actor => { if (this.#isMember(actor)) this.#queueRender(); };
    const onEmbedded = doc => {
      const parent = doc?.parent;
      if ((parent?.documentName === "Actor") && this.#isMember(parent)) this.#queueRender();
    };
    hooks.push(["updateActor", Hooks.on("updateActor", onActor)]);
    hooks.push(["deleteActor", Hooks.on("deleteActor", onActor)]);
    for (const hook of MEMBER_DOCUMENT_HOOKS) hooks.push([hook, Hooks.on(hook, onEmbedded)]);
    this.#memberHooks = hooks;
  }

  #unregisterMemberHooks() {
    for (const [hook, id] of this.#memberHooks ?? []) Hooks.off(hook, id);
    this.#memberHooks = null;
  }

  /** Is this Actor one of the party's members, by uuid? */
  #isMember(actor) {
    const uuid = actor?.uuid;
    if (!uuid) return false;
    return (this.document.system.members ?? []).some(m => m.uuid === uuid);
  }

  /**
   * Redraw the roster and the grid once the burst settles: a setTimeout, never a
   * requestAnimationFrame latch (plan, risk 2), and only the two member-dependent parts. A change
   * that arrives while the timer runs is read by the render it already scheduled.
   */
  #queueRender() {
    if (this.#renderTimer) return;
    this.#renderTimer = setTimeout(() => {
      this.#renderTimer = null;
      if (!this.rendered) return;
      this.render({ parts: ["roster", "skills"] })
        .catch(err => console.error("STARWROUGHT | the party sheet could not redraw", err));
    }, RERENDER_DELAY);
  }

  /* -------------------------------------------- */

  /**
   * An open Notes editor across a re-render, as the character and adversary sheets keep theirs
   * (see SwCharacterSheet._preSyncPartState for the why): the draft is written to the document
   * here, since the change the editor fires is dropped while the sheet is rendering, and the
   * reopened editor is seeded with it.
   * @inheritdoc
   */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    state.swOpenEditors = [];
    state.swDrafts = {};
    for (const editor of priorElement.querySelectorAll("prose-mirror[open]")) {
      if (editor.name) state.swOpenEditors.push(editor.name);
      let changed = false;
      const onChange = () => { changed = true; };
      editor.addEventListener("change", onChange);
      try { editor.save(); } catch (err) { console.error("STARWROUGHT | an open editor could not be saved before the sheet redrew", err); }
      editor.removeEventListener("change", onChange);
      if (changed && editor.name) state.swDrafts[editor.name] = editor.value;
    }
    if (this.isEditable && !foundry.utils.isEmpty(state.swDrafts)) {
      this.document.update(foundry.utils.deepClone(state.swDrafts))
        .catch(err => console.error("STARWROUGHT | an editor's draft could not be written while the sheet redrew", err));
    }
  }

  /** @inheritdoc */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    const drafts = state.swDrafts ?? {};
    for (const name of state.swOpenEditors ?? []) {
      const editor = newElement.querySelector(`prose-mirror[name="${CSS.escape(name)}"]`);
      if (!editor || editor.disabled) continue;
      if (name in drafts) editor.value = drafts[name];
      editor.toggleAttribute("open", true);
    }
  }

  /* -------------------------------------------- */
  /*  Drops                                       */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * A Token document, should one arrive: a linked token stands for its Actor and is handed on; an
   * unlinked one has no world Actor to join and is refused with a notice (plan, part 1).
   */
  async _onDropDocument(event, document) {
    if (document?.documentName === "Token") {
      if (document.actorLink && document.actor) return this._onDropActor(event, document.actor);
      ui.notifications.warn(L("STARWROUGHT.Party.refusedUnlinked"));
      return null;
    }
    return super._onDropDocument(event, document);
  }

  /**
   * @inheritdoc
   * A dropped Actor joins the party, once: a world character only. An unlinked token's Actor, an
   * adversary, a party and a compendium Actor are each refused with a notice and no change. The
   * base class offers the drop to editable users alone, and the GM is re-checked here regardless.
   */
  async _onDropActor(event, actor) {
    if (!game.user.isGM || !this.isEditable) return null;
    const { actor: candidate, refusal } = memberCandidate(actor);
    if (refusal) {
      ui.notifications.warn(F(refusal, { name: actor?.name ?? "" }));
      return null;
    }
    const added = await addMember(this.document, candidate);
    return added ? candidate : null;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** The member a clicked control belongs to, from the nearest `data-uuid`, resolved live. */
  #memberFor(target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return null;
    return resolveMembers(this.document).find(m => m.uuid === uuid)?.actor ?? null;
  }

  static async #onEditImage() {
    if (!this.isEditable || !game.user.isGM) return;
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.document.img,
      callback: path => this.document.update({ img: path })
    });
    return fp.browse();
  }

  /** The portrait and the name open the member's sheet, for anyone allowed to see it. */
  static async #onOpenMember(event, target) {
    const actor = this.#memberFor(target);
    if (!actor) return;
    if (!actor.testUserPermission(game.user, "LIMITED")) {
      ui.notifications.warn(L("STARWROUGHT.Party.notPermitted"));
      return;
    }
    return actor.sheet.render({ force: true });
  }

  /** Remove, with a confirm. Works on a missing row too, which is the point of the row. */
  static async #onRemoveMember(event, target) {
    if (!game.user.isGM) return;
    const uuid = target.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return;
    const actor = this.#memberFor(target);
    const name = actor?.name ?? L("STARWROUGHT.Party.missingMember");
    const confirmed = await DialogV2.confirm({
      window: { title: F("STARWROUGHT.Party.removeTitle", { name }), icon: "fa-solid fa-user-minus" },
      content: `<p>${esc(F("STARWROUGHT.Party.removeConfirm", { name }))}</p>`,
      rejectClose: false
    });
    if (confirmed) return removeMember(this.document, uuid);
  }

  /** The toolbar button: every user's assigned character, each once. */
  static async #onAddPlayerCharacters() {
    if (!game.user.isGM) return;
    const added = await addPlayerCharacters(this.document);
    ui.notifications.info(added
      ? F("STARWROUGHT.Party.addedPlayers", { count: added })
      : L("STARWROUGHT.Party.addedNone"));
  }

  /** Begin session (confirm): the number goes up, every member's Hero Points to exactly 1 (ruling 93). */
  static async #onBeginSession() {
    if (!game.user.isGM) return;
    const next = (Number(this.document.system.session?.number) || 0) + 1;
    const confirmed = await DialogV2.confirm({
      window: { title: F("STARWROUGHT.Party.sessionTitle", { n: next }), icon: "fa-solid fa-play" },
      content: `<p>${esc(F("STARWROUGHT.Party.beginSessionConfirm", { n: next }))}</p>`,
      rejectClose: false
    });
    if (confirmed) return beginSession(this.document);
  }

  /**
   * Award a Milestone (rulings 91 and 92): a dialog listing every member ticked, with its preview
   * line; untick a character who has left or sat the arc out; Confirm disables the button while
   * the award runs, so a double click cannot award twice (plan, risk 3).
   */
  static async #onAwardMilestone(event, target) {
    if (!game.user.isGM || this.#awarding) return;
    const preview = previewMilestone(this.document);
    if (!preview.length) {
      ui.notifications.warn(L("STARWROUGHT.Milestone.noMembers"));
      return;
    }
    const items = preview.map(p => `<li><label class="checkbox"><input type="checkbox" name="award" value="${esc(p.uuid)}" checked> ${esc(p.line)}</label></li>`).join("");
    const chosen = await DialogV2.wait({
      window: { title: L("STARWROUGHT.Milestone.awardTitle"), icon: "fa-solid fa-star" },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 540 },
      content: `<p>${esc(L("STARWROUGHT.Milestone.awardIntro"))}</p><ul class="sw-milestone-preview">${items}</ul>`,
      buttons: [
        {
          action: "award", label: "STARWROUGHT.Milestone.awardButton", icon: "fa-solid fa-star", default: true,
          callback: (clickEvent, button) => Array.from(button.form.querySelectorAll("input[name='award']:checked")).map(i => i.value)
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!Array.isArray(chosen) || !chosen.length) return;

    this.#awarding = true;
    if (target) target.disabled = true;
    try {
      await awardMilestone(this.document, chosen);
    } finally {
      this.#awarding = false;
      if (target?.isConnected) target.disabled = false;
    }
  }

  /** Take back the last award (confirm). The helper refuses if a number has been edited since. */
  static async #onTakeBack() {
    if (!game.user.isGM) return;
    const award = this.document.system.lastAward;
    if (!award?.members?.length) {
      ui.notifications.warn(L("STARWROUGHT.Milestone.takeBackNone"));
      return;
    }
    const confirmed = await DialogV2.confirm({
      window: { title: L("STARWROUGHT.Milestone.takeBackTitle"), icon: "fa-solid fa-rotate-left" },
      content: `<p>${esc(F("STARWROUGHT.Milestone.takeBackConfirm", {
        count: award.members.length, names: award.members.map(m => m.name).join(", ")
      }))}</p>`,
      rejectClose: false
    });
    if (confirmed) return takeBackAward(this.document);
  }

  /** The party rests (confirm), naming the members who would sleep in armor without Comfort. */
  static async #onPartyRests() {
    if (!game.user.isGM) return;
    const lines = [`<p>${esc(L("STARWROUGHT.Party.restsConfirm"))}</p>`];
    const uncomfortable = restPreview(this.document);
    if (uncomfortable.length) {
      lines.push(`<p class="sw-note sw-warn">${esc(F("STARWROUGHT.Party.restsComfort", {
        names: uncomfortable.map(r => `${r.name} (${r.piece})`).join(", ")
      }))}</p>`);
    }
    const confirmed = await DialogV2.confirm({
      window: { title: L("STARWROUGHT.Party.restsTitle"), icon: "fa-solid fa-bed" },
      classes: ["starwrought", "sw-party-dialog"],
      content: lines.join(""),
      rejectClose: false
    });
    if (confirmed) return partyRests(this.document);
  }

  /** The plus on a row: an optional one-line reason, then +1, refused at the maximum before any write. */
  static async #onAwardHeroPoint(event, target) {
    if (!game.user.isGM) return;
    const actor = this.#memberFor(target);
    if (!actor) return;
    if ((Number(actor.system.heroPoints?.value) || 0) >= SW.HERO_POINTS_MAX) {
      ui.notifications.warn(F("STARWROUGHT.Party.heroPointsFull", { name: actor.name, max: SW.HERO_POINTS_MAX }));
      return;
    }
    const reason = await DialogV2.prompt({
      window: { title: F("STARWROUGHT.Party.heroReasonTitle", { name: actor.name }), icon: "fa-solid fa-star" },
      classes: ["starwrought", "sw-party-dialog"],
      content: `<p>${esc(L("STARWROUGHT.Party.heroReasonPrompt"))}</p>
        <input type="text" name="reason" autofocus style="width: 100%" placeholder="${esc(L("STARWROUGHT.Party.heroReasonPlaceholder"))}">`,
      ok: {
        label: "STARWROUGHT.HeroPoints.award",
        icon: "fa-solid fa-star",
        callback: (clickEvent, button) => String(button.form.elements.reason?.value ?? "")
      },
      rejectClose: false
    });
    if (reason === null) return;
    return awardHeroPoint(actor, { reason });
  }

  /** The minus on a row: a correction, said as one. */
  static async #onCorrectHeroPoint(event, target) {
    if (!game.user.isGM) return;
    const actor = this.#memberFor(target);
    if (!actor) return;
    return correctHeroPoint(actor, Number(target.dataset.delta) || -1);
  }

  /**
   * The GM's Flare plus: the picker the critical card uses (pickFlare, shared since 0.7.0), with
   * its reason field, then the member's own `toggleFlare`, which posts the card with the
   * "awarded by the GM" line.
   */
  static async #onFlareAward(event, target) {
    if (!game.user.isGM) return;
    const actor = this.#memberFor(target);
    if (!actor) return;
    const pick = await pickFlare(actor, { askReason: true });
    if (!pick?.slug) return;
    return actor.toggleFlare(pick.slug, true, { reason: pick.reason ?? "" });
  }

  /** A Flare chip on a character the user owns puts it out, through `toggleFlare`, which posts its card. */
  static async #onFlareOut(event, target) {
    const actor = this.#memberFor(target);
    const slug = target.dataset.slug;
    if (!actor || !slug) return;
    if (!actor.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
      return;
    }
    return actor.toggleFlare(slug, false);
  }

  /** The Deferred badge's one control, for the owner or the GM (ruling 94). */
  static async #onSpendDeferred(event, target) {
    const actor = this.#memberFor(target);
    if (!actor) return;
    return spendDeferred(actor);
  }

  /**
   * A grid cell rolls that check as that member, through the member's existing methods; a
   * player's click on a member they do not own does nothing. Shift-click skips the dialog, as
   * the sheets do.
   */
  static async #onRollCell(event, target) {
    const actor = this.#memberFor(target);
    if (!actor || !actor.testUserPermission(game.user, "OWNER")) return;
    const dialog = !event.shiftKey;
    switch (target.dataset.kind) {
      case "defense":
        return actor.rollDefense(target.dataset.key, { dialog });
      case "initiative": {
        const combat = game.combat;
        const combatant = actor.combatant;
        if (!combat || !combatant) {
          ui.notifications.warn(L("STARWROUGHT.Notify.noCombatant"));
          return;
        }
        return combat.rollInitiativeWithCheck(combatant.id, actor.system.initiative?.slug ?? SW.DEFENSES.awareness.slug);
      }
      default:
        return actor.rollCheck(target.dataset.slug, { dialog });
    }
  }
}
