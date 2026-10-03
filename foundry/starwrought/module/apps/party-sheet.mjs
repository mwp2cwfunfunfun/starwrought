/**
 * The party sheet (0.7.0; party-sheet-plan.md, parts 1 to 4; 0.7.1 adds parts 6 and 7; 0.7.2
 * adds parts 8 and 9).
 *
 * The GM's console and the players' window at once: one template set that branches on `isGM`
 * and on per-member ownership, as the character sheet's header does. The header carries the
 * session and the GM's buttons; the roster, always open above the tabs, is a status board with
 * one row per member; the Skills grid is a tab, Constellations as rows and members as columns,
 * each row header carrying the GM's Ask everyone; the On the road tab (0.7.2) carries each
 * member's Exploration Activity, the party's Travel Speed, Say the plan and Begin the encounter;
 * the Loot tab (0.7.1) lists the party's embedded Items and the purse; the GM's notes are a tab
 * the players never see.
 *
 * Everything member-dependent is computed here, in `_prepareContext`, from the resolved members
 * (plan, risk 2): the party's own data model derives nothing from them. The sheet re-renders its
 * roster, grid and road on the member hooks (updateActor, Items and Active Effects on a member; a
 * member deleted), its road and grid on the Combat hooks (a Combat or a member's Combatant made,
 * changed or deleted; the viewed scene changing), and its loot part on the party's own Item
 * changes, debounced on a timer, never a requestAnimationFrame latch, and only when the changed
 * document is a member, belongs to one, or is the party's own loot. Every rule effect runs on the
 * member's own Actor through a method that already exists and posts its card: `rollCheck`,
 * `rollDefense`, `rollRelevantCheck`, the Combat's `rollInitiativeWithCheck`, `toggleFlare`,
 * `restForTheNight`, and the party operations in helpers/party.mjs for the few small writes the
 * party makes to a member.
 *
 * ApplicationV2 actions fire regardless of editability, and a player opens this sheet as an
 * Observer, so every handler re-checks before writing: `game.user.isGM` for the party's writes
 * and the GM's buttons, `testUserPermission(game.user, "OWNER")` on the member for a player's
 * Flare put-out, Spent, Take, Activity pick and Activity roll. For the same reason every control
 * a player may click is an anchor, since DocumentSheetV2 disables every form element for a user
 * who cannot edit: the Activity and Constellation controls on the road are selects for the GM,
 * written through `_onChangeForm`, and for an owner who cannot edit the party they are anchors
 * that open a small picker dialog (a dialog's own form is never disabled), both ending in the
 * same `setActivity` (ruling 106). A player's Take, and a Give by drag, are two writes a player
 * cannot make alone, so they go to the active GM's client through documents/party-socket.mjs
 * (ruling 97); the GM's own Give to, Split, Ask everyone, Say the plan and Begin the encounter
 * write directly through helpers/party.mjs.
 */

import * as SW from "../config.mjs";
import { SwCheck } from "../dice/check.mjs";
import { enabledConstellations } from "../helpers/content.mjs";
import { windTip, vigorContext, zoneWounds } from "./actor-sheet.mjs";
import { pickFlare } from "./flare-picker.mjs";
import {
  resolveMembers, memberCandidate, addMember, removeMember, addPlayerCharacters,
  beginSession, awardHeroPoint, correctHeroPoint, partyRests, restPreview,
  previewMilestone, awardMilestone, takeBackAward, spendDeferred,
  isLoot, giveTo, previewSplit, splitPurse, coinText, toCopper, askedName, askEveryone,
  explorationActivities, invalidateExplorationActivities, travelActivity, activityOf, activityWarnings,
  activityHasChoice, activityRoll, initiativeFor, constellationName, travelWord, travelUnits,
  setActivity, partyTravel, sayThePlan, beginEncounter, roadRoll, keepableRolls
} from "../helpers/party.mjs";
import { requestTake, requestGive } from "../documents/party-socket.mjs";

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

/**
 * The parts the member hooks redraw; the ones the Combat hooks redraw (the road's Combatant
 * state and the grid's Initiative row are live only while a Combat holds the member); the one a
 * world Activity's change redraws; and the one the party's own loot changes redraw.
 */
const MEMBER_PARTS = Object.freeze(["roster", "skills", "road"]);
const COMBAT_PARTS = Object.freeze(["road", "skills"]);
const ROAD_PARTS = Object.freeze(["road"]);
const LOOT_PARTS = Object.freeze(["loot"]);

/**
 * The hooks a Combat's change arrives on (0.7.2): the Combat itself, its Combatants, and the
 * viewed scene, which decides whether Begin the encounter has somewhere to begin.
 */
const COMBAT_HOOKS = Object.freeze(["createCombat", "updateCombat", "deleteCombat", "canvasReady"]);
const COMBATANT_HOOKS = Object.freeze(["createCombatant", "updateCombatant", "deleteCombatant"]);

/** Foundry's render context for a change to the party's own embedded Items: the loot. */
const LOOT_RENDER_CONTEXT = /^(create|update|delete)Item$/;

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
      rollCell: SwPartySheet.#onRollCell,
      askEveryone: SwPartySheet.#onAskEveryone,
      lootTake: SwPartySheet.#onLootTake,
      lootGive: SwPartySheet.#onLootGive,
      lootChat: SwPartySheet.#onLootChat,
      lootEdit: SwPartySheet.#onLootEdit,
      lootDelete: SwPartySheet.#onLootDelete,
      splitPurse: SwPartySheet.#onSplitPurse,
      pickActivity: SwPartySheet.#onPickActivity,
      pickConstellation: SwPartySheet.#onPickConstellation,
      activityRoll: SwPartySheet.#onActivityRoll,
      sayThePlan: SwPartySheet.#onSayThePlan,
      beginEncounter: SwPartySheet.#onBeginEncounter
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: "systems/starwrought/templates/actor/party-header.hbs" },
    roster: { template: "systems/starwrought/templates/actor/party-roster.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: { template: "systems/starwrought/templates/actor/party-skills.hbs", scrollable: [""] },
    road: { template: "systems/starwrought/templates/actor/party-road.hbs", scrollable: [""] },
    loot: { template: "systems/starwrought/templates/actor/party-loot.hbs", scrollable: [""] },
    notes: { template: "systems/starwrought/templates/actor/party-notes.hbs", scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      initial: "skills",
      labelPrefix: "STARWROUGHT.Tab",
      tabs: [
        { id: "skills", icon: "fa-solid fa-table-cells" },
        { id: "road", icon: "fa-solid fa-route" },
        { id: "loot", icon: "fa-solid fa-sack" },
        { id: "notes", icon: "fa-solid fa-book-open" }
      ]
    }
  };

  /** The member hooks this sheet registered, as [hook, id] pairs, or null while none are. */
  #memberHooks = null;

  /** The pending redraw, or null. One timer collects a burst of changes into one render. */
  #renderTimer = null;

  /** The parts the pending redraw will draw: a burst that touches a member and the loot draws both. */
  #renderParts = new Set();

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
    context.road = await this.#prepareRoad();
    context.loot = this.#prepareLoot(members);
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
          key: `defense-${key}`, kind: "defense", defenseKey: key, slug: def.slug, label: L(def.label), hint: L(def.hint),
          attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells), askable: true
        };
      })
    });

    // Initiative: the modifier, live only while a Combat holds the member, and since 0.7.2 the
    // Constellation the Combatant is flagged to roll (Begin the encounter's, ruling 105; Awareness
    // when nothing flagged it) named on hover, since the cell rolls that and not Awareness.
    const initiativeCells = actors.map(actor => {
      const combatant = actor.combatant;
      const inCombat = !!combatant;
      // Out of an encounter the cell shows the default (Awareness) modifier the model derives. In
      // one it shows the number the cell will actually roll: the flagged Constellation's terms and
      // the Scouts' bonus, through the same assembly the roll uses, so a Combatant flagged Stealth
      // at +0 never reads "+2" (live test, 0.7.2).
      const mod = inCombat
        ? SwCheck.previewTotal(actor, {
          kind: "initiative", slug: combatant.initiativeConstellation, modifiers: combatant.initiativeModifiers ?? []
        })
        : (Number(actor.system.initiative?.mod) || 0);
      const tooltip = inCombat
        ? `${F("STARWROUGHT.Party.initiativeLiveTip", { mod: signed(mod) })} ${F("STARWROUGHT.Travel.gridInitiativeTip", {
          constellation: constellationName(actor, combatant.initiativeConstellation)
        })}`
        : F("STARWROUGHT.Party.initiativeNotInCombat", { mod: signed(mod) });
      return base(actor, {
        kind: "initiative",
        value: mod, display: signed(mod),
        rank: null, rankAbbr: "", untrained: false,
        live: inCombat && (live.get(actor.uuid) ?? false),
        tooltip
      });
    });
    groups[0].rows.push({
      key: "initiative", kind: "initiative", label: L("STARWROUGHT.Field.initiative"),
      hint: L("STARWROUGHT.Party.initiativeHint"), attribute: "", glyph: "", cells: mark(initiativeCells), askable: false
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
      cells: mark(actors.map(actor => checkCell(actor, slug, name))), askable: true
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
        attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells), askable: true
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
            key: `lore-${slug}`, kind: "check", slug, label: meta.name, hint: "", askable: true,
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

  /**
   * The road (0.7.2; plan, parts 8 and 9; rulings 101, 102 and 105 to 107): the party's Travel
   * Speed line from `partyTravel`, the terrain, and one row per member with the Activity, its
   * Travel word, the Constellation the pick implies for Initiative, Investigate's Constellation,
   * the warnings, the Roll when the Activity rolls now, and the member's Combatant state while a
   * Combat holds them. Every Activity is read from the Actions pack's Exploration Mode folder
   * (`explorationActivities`), never from a table here (plan, risk 9). A row is live for the
   * member's owner and the GM: the GM's selects are written through `_onChangeForm`, an owner's
   * anchors open the picker dialog. A Fatigued member's row is locked to Travel with the reason
   * (ruling 101), for the GM as for the player, since `setActivity` refuses either.
   * @returns {Promise<object>}
   */
  async #prepareRoad() {
    const party = this.document;
    const isGM = game.user.isGM;
    const activities = await explorationActivities();
    const travelItem = travelActivity(activities);
    const travel = partyTravel(party, activities);
    // Travel first in every list, since it is the default and the one "" stands for.
    const ordered = travelItem ? [travelItem, ...activities.filter(a => a !== travelItem)] : [...activities];
    const valueOf = item => (item && travelItem && (item === travelItem)) ? "" : (item?.id ?? "");

    const rows = travel.members.map(member => {
      const { actor, item, locked, lockedReason } = member;
      const owner = actor.testUserPermission(game.user, "OWNER");
      const live = owner || isGM;
      const pick = String(actor.system.exploration?.constellation ?? "").trim();
      const needsConstellation = !locked && activityHasChoice(item);
      const init = initiativeFor(actor, item);
      const roll = (live && !locked) ? activityRoll(actor, item) : null;
      // The roll remembered on the road (ruling 108), for everyone who can see the row: it is the
      // character's and public (ruling 110), so it is not gated on `live` as the Roll button is.
      const remembered = roadRoll(actor, item);
      const combatant = actor.combatant;
      const rolled = !!combatant && (combatant.initiative !== null) && (combatant.initiative !== undefined);
      const flagged = combatant ? constellationName(actor, combatant.initiativeConstellation) : "";
      const options = needsConstellation ? this.#constellationOptions(actor, pick) : [];
      return {
        uuid: actor.uuid,
        id: actor.id,
        name: actor.name,
        img: actor.img,
        owner,
        live,
        locked,
        lockedReason,
        fatigued: member.fatigued,
        activity: {
          id: valueOf(item),
          name: item?.name ?? L("STARWROUGHT.Travel.noActivities"),
          speed: travelWord(item),
          effectiveSpeed: member.speed,
          waiting: (locked && member.stored && (member.stored !== item)) ? member.stored.name : ""
        },
        options: ordered.map(a => ({ id: valueOf(a), name: a.name, speed: travelWord(a), selected: a === item })),
        needsConstellation,
        constellation: needsConstellation ? {
          slug: pick,
          name: pick ? constellationName(actor, pick) : "",
          trained: options.filter(o => o.trained),
          untrained: options.filter(o => !o.trained),
          hint: F("STARWROUGHT.Travel.constellationHint", { name: actor.name, activity: item?.name ?? "" })
        } : null,
        initiative: {
          slug: init.slug,
          name: init.name,
          fallback: init.fallback,
          hint: init.fallback ? L("STARWROUGHT.Travel.initiativeFallbackHint") : L("STARWROUGHT.Travel.initiativeTagHint")
        },
        roll: roll ? {
          ...roll,
          label: F("STARWROUGHT.Travel.rollNow", { name: roll.name }),
          hint: F("STARWROUGHT.Travel.rollNowHint", { name: roll.name, member: actor.name })
        } : null,
        // The chip after the Initiative tag: "Stealth 17", the die and when on hover, and whether
        // it stands as the Initiative roll when the encounter begins (ruling 109) or Initiative
        // rolls another Constellation.
        remembered: remembered ? {
          name: remembered.name,
          total: remembered.total,
          natural: remembered.natural,
          ago: remembered.ago,
          usable: remembered.usable,
          hint: F(remembered.usable ? "STARWROUGHT.Travel.rolledHint" : "STARWROUGHT.Travel.rolledHintUnusable", {
            name: actor.name, constellation: remembered.name, total: remembered.total,
            natural: remembered.natural ?? "?", ago: remembered.ago, initiative: init.name
          })
        } : null,
        warnings: activityWarnings(actor, item),
        combatant: combatant ? {
          rolled,
          value: rolled ? combatant.initiative : null,
          constellation: flagged,
          hint: rolled
            ? F("STARWROUGHT.Travel.combatRolledHint", { name: actor.name })
            : F("STARWROUGHT.Travel.combatReadyHint", { name: actor.name, constellation: flagged })
        } : null
      };
    });

    const pace = travel.pacesetter;
    const terrainOptions = Object.entries(SW.TERRAIN ?? {})
      .map(([key, t]) => ({ key, label: L(t.label), selected: key === travel.terrain }));
    const canBegin = isGM && !!canvas?.scene;
    return {
      rows,
      hasActivities: activities.length > 0,
      travel: {
        feet: travel.feetPerMinute,
        mph: travel.milesPerHour,
        mpd: travel.milesPerDay,
        ...travelUnits(travel),
        pacesetter: pace
          ? F("STARWROUGHT.Travel.pacesetter", { name: pace.actor.name, activity: pace.item?.name ?? "", speed: travelWord(pace.item) })
          : L("STARWROUGHT.Travel.noSpeed"),
        terrain: travel.terrain,
        terrainLabel: L(SW.TERRAIN?.[travel.terrain]?.label ?? "STARWROUGHT.Travel.terrainNormal"),
        terrainOptions,
        difficult: travel.terrain !== "normal",
        searching: travel.searching
      },
      canBegin,
      beginTip: canBegin
        ? F("STARWROUGHT.Travel.beginEncounterHint", { scene: canvas.scene.name })
        : L("STARWROUGHT.Travel.beginNoScene")
    };
  }

  /**
   * The Constellations a member may Investigate with, as the Relevant Check picker offers them:
   * the ones they have opened first (every entry of `system.constellations` but the Lore
   * template, their Lores included), then every Constellation that ships (`enabledConstellations`,
   * ruling 61) that they have not, Untrained being a real answer at +0. Each with its rank, and
   * marked when it is the member's pick.
   * @param {Actor} actor
   * @param {string} pick  The slug stored on the character.
   * @returns {Array<{slug: string, name: string, rank: string, rankLabel: string, trained: boolean, selected: boolean}>}
   */
  #constellationOptions(actor, pick) {
    const rows = new Map();
    for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
      if (slug === "lore") continue;
      rows.set(slug, { slug, name: entry.name, rank: entry.rank ?? "untrained" });
    }
    for (const meta of enabledConstellations()) {
      if (!meta.slug || (meta.slug === "lore") || rows.has(meta.slug)) continue;
      rows.set(meta.slug, { slug: meta.slug, name: meta.name, rank: "untrained" });
    }
    const order = SW.RANK_ORDER;
    return [...rows.values()]
      .sort((a, b) => (order.indexOf(b.rank) - order.indexOf(a.rank)) || a.name.localeCompare(b.name))
      .map(r => ({
        ...r,
        rankLabel: L(SW.RANKS[r.rank]?.label ?? SW.RANKS.untrained.label),
        trained: r.rank !== "untrained",
        selected: r.slug === pick
      }));
  }

  /* -------------------------------------------- */

  /**
   * The Loot tab (0.7.1; plan, part 6; rulings 96 to 98): one row per embedded Item of a physical
   * type, by name, with the price string the Item carries and nothing computed from it; the
   * purse; and who may do what. The GM edits quantities, Gives to a member and Deletes; a player
   * who owns a member Takes, which goes to the active GM's client, so the rows say when no GM is
   * connected and the Take would write nothing. Carry state means nothing on a party and is not
   * shown.
   * @param {Array<{uuid: string, actor: Actor|null}>} members
   * @returns {object}
   */
  #prepareLoot(members) {
    const party = this.document;
    const isGM = game.user.isGM;
    const present = members.filter(m => m.actor);
    const owned = present.filter(m => m.actor.testUserPermission(game.user, "OWNER"));
    const gmActive = !!game.users.activeGM;
    const canTake = !isGM && (owned.length > 0);

    const rows = party.items
      .filter(item => isLoot(item))
      .map(item => {
        const quantity = Math.max(0, Number(item.system.quantity) || 0);
        return {
          id: item.id,
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          type: item.type,
          typeLabel: L(CONFIG.Item.typeLabels?.[item.type] ?? `TYPES.Item.${item.type}`),
          quantity,
          price: String(item.system.price ?? "").trim(),
          traits: item.type === "weapon" ? (item.system.totalTraits ?? "") : "",
          inStock: quantity > 0,
          canTake: canTake && (quantity > 0),
          stack: quantity > 1
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const purse = party.system.currency ?? { gp: 0, sp: 0, cp: 0 };
    const copper = toCopper(purse);
    return {
      rows,
      count: rows.length,
      isGM,
      canTake,
      gmActive,
      ownedCount: owned.length,
      memberCount: present.length,
      purse: {
        gp: Number(purse.gp) || 0,
        sp: Number(purse.sp) || 0,
        cp: Number(purse.cp) || 0,
        copper,
        text: coinText(copper),
        empty: copper <= 0
      },
      canSplit: isGM && (copper > 0) && (present.length > 0)
    };
  }

  /* -------------------------------------------- */
  /*  Rendering and the member hooks              */
  /* -------------------------------------------- */

  /** @inheritdoc. The member hooks are registered once, on the first render, and go with the sheet. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.#memberHooks) this.#registerMemberHooks();
  }

  /**
   * @inheritdoc
   * Foundry re-renders a document's sheets when one of its embedded Items is created, changed or
   * deleted (`renderContext` "createItem", "updateItem", "deleteItem"). On a party that is the
   * loot moving, and a Take served on the GM's client is two such changes in a row, so those
   * renders go through the same timer as the member hooks and draw the loot part alone, once
   * (brief, item 4). The party's own update (the purse edited or Split, the name, the notes) and
   * every explicit render still draw as the base class does.
   */
  async render(options = {}, _options = {}) {
    if (typeof options === "boolean") options = Object.assign(_options, { force: options });
    if (!options.force && this.rendered && LOOT_RENDER_CONTEXT.test(String(options.renderContext ?? ""))) {
      this.#queueRender(LOOT_PARTS);
      return this;
    }
    return super.render(options);
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    this.#unregisterMemberHooks();
    if (this.#renderTimer) {
      clearTimeout(this.#renderTimer);
      this.#renderTimer = null;
    }
    this.#renderParts.clear();
  }

  /**
   * Listen for the members' changes: the Actor itself, its Items and Active Effects (Fatigued is
   * an effect; armor is an Item), and its deletion, which turns its row into a missing one.
   * Nothing here reads the change; it only asks for a redraw when the document is a member or
   * belongs to one, and the redraw reads live data. Since 0.7.2 the same list holds the Combat
   * hooks (a Combat made, changed or deleted, a member's Combatant made, changed or deleted, the
   * viewed scene changing), which redraw the road and the grid, and a world action Item's change,
   * which may be one of the road's Activities rewritten, so the cached list is dropped and the
   * road redrawn. All released together in `_onClose`.
   */
  #registerMemberHooks() {
    const hooks = [];
    const onActor = actor => { if (this.#isMember(actor)) this.#queueRender(MEMBER_PARTS); };
    const onEmbedded = doc => {
      const parent = doc?.parent;
      if ((parent?.documentName === "Actor") && this.#isMember(parent)) this.#queueRender(MEMBER_PARTS);
      else if (!parent && (doc?.documentName === "Item") && (doc.type === "action")) {
        invalidateExplorationActivities();
        this.#queueRender(ROAD_PARTS);
      }
    };
    hooks.push(["updateActor", Hooks.on("updateActor", onActor)]);
    hooks.push(["deleteActor", Hooks.on("deleteActor", onActor)]);
    for (const hook of MEMBER_DOCUMENT_HOOKS) hooks.push([hook, Hooks.on(hook, onEmbedded)]);

    const onCombat = () => this.#queueRender(COMBAT_PARTS);
    const onCombatant = combatant => {
      // An unlinked token's Combatant carries a synthetic Actor; `actorId` is the member's either way.
      if (this.#isMemberId(combatant?.actorId ?? combatant?.actor?.id)) this.#queueRender(COMBAT_PARTS);
    };
    for (const hook of COMBAT_HOOKS) hooks.push([hook, Hooks.on(hook, onCombat)]);
    for (const hook of COMBATANT_HOOKS) hooks.push([hook, Hooks.on(hook, onCombatant)]);
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

  /** Is this world Actor id one of the party's members? A member is a world Actor, so its uuid is `Actor.<id>`. */
  #isMemberId(id) {
    if (!id) return false;
    const uuid = `Actor.${id}`;
    return (this.document.system.members ?? []).some(m => m.uuid === uuid);
  }

  /**
   * Redraw once the burst settles: a setTimeout, never a requestAnimationFrame latch (plan, risk
   * 2), and only the parts asked for (the roster and the grid for a member's change, the loot for
   * the party's own Items; a burst that touches both draws both). A change that arrives while the
   * timer runs is read by the render it already scheduled.
   * @param {readonly string[]} parts
   */
  #queueRender(parts) {
    for (const part of parts) this.#renderParts.add(part);
    if (this.#renderTimer) return;
    this.#renderTimer = setTimeout(() => {
      this.#renderTimer = null;
      const drawn = [...this.#renderParts];
      this.#renderParts.clear();
      if (!this.rendered || !drawn.length) return;
      super.render({ parts: drawn })
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

  /**
   * @inheritdoc
   * The base class accepts a drop from an editor alone, which would stop a player's Give before
   * it reached `_onDropItem`; every drop handler here re-checks who is dropping and what, so the
   * gate is opened and the handlers decide.
   */
  _canDragDrop() {
    return true;
  }

  /**
   * @inheritdoc
   * A dropped Item (0.7.1; plan, part 6; rulings 97 and 98). The GM's drop copies, as Foundry
   * does, from the Equipment compendium, the Items sidebar or a character sheet; a non-physical
   * type is refused at creation by `SwItem._preCreate`, with its own notice, so nothing more is
   * done here. A player's drop of one of their own character's Items is a Give of the whole stack,
   * sent to the active GM's client through `requestGive` and copied nowhere by this client; a
   * player's drop from the compendium or the sidebar is the GM's alone and is refused with a
   * notice. A drop of the party's own Item onto itself is Foundry's sort, the GM's.
   */
  async _onDropItem(event, item) {
    const party = this.document;
    const parent = item?.parent ?? null;
    if (parent?.uuid === party.uuid) return game.user.isGM ? super._onDropItem(event, item) : null;

    if (game.user.isGM) {
      if (!this.isEditable) return null;
      return super._onDropItem(event, item);
    }

    const fromCharacter = (parent?.documentName === "Actor") && (parent.type === "character");
    if (!fromCharacter) {
      ui.notifications.warn(L("STARWROUGHT.Loot.dropGmOnly"));
      return null;
    }
    if (!parent.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
      return null;
    }
    if (!isLoot(item)) {
      ui.notifications.warn(F("STARWROUGHT.Loot.giveNotPhysical", { item: item?.name ?? "" }));
      return null;
    }
    await requestGive({ actor: parent, item, party, quantity: Number(item.system.quantity) || 1 });
    return null;
  }

  /* -------------------------------------------- */
  /*  Form changes                                */
  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * The quantity input on a loot row belongs to the Item, not the party, so it carries no `name`
   * (the form never submits it) and is written here; the GM's Activity and Constellation selects
   * on a road row belong to the member the same way (0.7.2); everything else is the party's own
   * form, the terrain select included.
   */
  _onChangeForm(formConfig, event) {
    const input = event.target;
    if (input?.matches?.("input[data-loot-quantity]")) {
      this.#onChangeQuantity(input).catch(err => console.error("STARWROUGHT | the loot quantity could not be written", err));
      return;
    }
    if (input?.matches?.("select[data-activity], select[data-constellation]")) {
      this.#onChangeRoad(input).catch(err => console.error("STARWROUGHT | the Activity could not be written", err));
      return;
    }
    return super._onChangeForm(formConfig, event);
  }

  /**
   * The GM's selects on a road row (ruling 106): the member's Activity, or Investigate's
   * Constellation, through `setActivity`, which writes the member and says the line. A refusal
   * (the member Fatigued, an id the list does not know) writes nothing, so the road is redrawn to
   * put the select back where the data is.
   */
  async #onChangeRoad(select) {
    if (!game.user.isGM) return;
    const actor = this.#memberFor(select);
    if (!actor) return;
    const change = select.hasAttribute("data-activity")
      ? { activityId: String(select.value ?? "") }
      : { constellation: String(select.value ?? "") };
    const written = await setActivity(actor, change);
    if (!written) this.#queueRender(ROAD_PARTS);
  }

  /** The GM's edit of a stack's count. Never below 0; the sheet redraws from the Item's own hook. */
  async #onChangeQuantity(input) {
    if (!game.user.isGM || !this.isEditable) return;
    const item = this.#lootFor(input);
    if (!item) return;
    const quantity = Math.max(0, Math.floor(Number(input.value) || 0));
    if (quantity === (Number(item.system.quantity) || 0)) return;
    await item.update({ "system.quantity": quantity });
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

  /** The loot Item a clicked control belongs to, from the nearest `data-item-id`, read live from the party. */
  #lootFor(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    if (!id) return null;
    const item = this.document.items.get(id) ?? null;
    return isLoot(item) ? item : null;
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
        // The Constellation the Combatant is flagged to roll (Begin the encounter's, ruling 105),
        // Awareness when nothing flagged it; through 0.7.1 this passed Awareness and would have
        // overridden the Activity (plan, risk 10).
        return combat.rollInitiativeWithCheck(combatant.id, combatant.initiativeConstellation);
      }
      default:
        return actor.rollCheck(target.dataset.slug, { dialog });
    }
  }

  /* -------------------------------------------- */
  /*  The road (parts 8 and 9, 0.7.2)             */
  /* -------------------------------------------- */

  /**
   * An owner's Activity anchor (ruling 106): the picker dialog, since the sheet disables a form
   * element for a user who cannot edit the party and a dialog's own form is never disabled. The
   * GM has selects on the row instead and never reaches this.
   */
  static async #onPickActivity(event, target) {
    const actor = this.#memberFor(target);
    if (!actor) return;
    if (!actor.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
      return;
    }
    return this.#pickActivity(actor, { focus: "activity" });
  }

  /** An owner's Constellation anchor on an Investigate row: the same picker, opened on the Constellation. */
  static async #onPickConstellation(event, target) {
    const actor = this.#memberFor(target);
    if (!actor) return;
    if (!actor.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
      return;
    }
    return this.#pickActivity(actor, { focus: "constellation" });
  }

  /**
   * The picker: the Activity (Travel first, each with its Travel word) and, shown while the
   * chosen Activity leaves a Constellation to the member (Investigate), the Constellation, from
   * the member's opened Constellations and every one that ships. Refused with the reason while
   * the member is Fatigued (ruling 101), before any dialog. Set ends in `setActivity`, which
   * writes once and says the line.
   * @param {Actor} actor
   * @param {object} [options]
   * @param {"activity"|"constellation"} [options.focus]  Which select takes focus.
   * @returns {Promise<object|null>}
   */
  async #pickActivity(actor, { focus = "activity" } = {}) {
    const activities = await explorationActivities();
    if (!activities.length) {
      ui.notifications.warn(L("STARWROUGHT.Travel.noActivities"));
      return null;
    }
    const pick = activityOf(actor, activities);
    if (pick.locked) {
      ui.notifications.warn(pick.lockedReason);
      return null;
    }
    const travelItem = travelActivity(activities);
    const ordered = travelItem ? [travelItem, ...activities.filter(a => a !== travelItem)] : [...activities];
    const valueOf = item => (item === travelItem) ? "" : item.id;
    const current = String(actor.system.exploration?.constellation ?? "").trim();

    const activityOptions = ordered.map(a => `<option value="${esc(valueOf(a))}" data-choice="${activityHasChoice(a) ? 1 : 0}"${a === pick.item ? " selected" : ""}>${esc(a.name)} (${esc(travelWord(a))})</option>`).join("");
    const option = r => `<option value="${esc(r.slug)}"${r.selected ? " selected" : ""}>${esc(r.name)} · ${esc(r.rankLabel)}</option>`;
    const rows = this.#constellationOptions(actor, current);
    const trained = rows.filter(r => r.trained).map(option).join("");
    const untrained = rows.filter(r => !r.trained).map(option).join("");
    const constellationOptions = `<option value="">${esc(L("STARWROUGHT.Travel.constellationNone"))}</option>`
      + (trained ? `<optgroup label="${esc(L("STARWROUGHT.Roll.relevantTrained"))}">${trained}</optgroup>` : "")
      + (untrained ? `<optgroup label="${esc(L("STARWROUGHT.Roll.relevantUntrained"))}">${untrained}</optgroup>` : "");
    const showConstellation = activityHasChoice(pick.item);

    const answer = await DialogV2.wait({
      window: { title: F("STARWROUGHT.Travel.pickTitle", { name: actor.name }), icon: "fa-solid fa-route" },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 440 },
      content: `<p>${esc(F("STARWROUGHT.Travel.pickIntro", { name: actor.name }))}</p>
        <div class="form-group">
          <label>${esc(L("STARWROUGHT.Travel.activity"))}</label>
          <div class="form-fields"><select name="activity"${focus === "activity" ? " autofocus" : ""}>${activityOptions}</select></div>
        </div>
        <div class="form-group sw-road-dialog-constellation${showConstellation ? "" : " sw-road-dialog-hidden"}">
          <label>${esc(L("STARWROUGHT.Travel.constellation"))}</label>
          <div class="form-fields"><select name="constellation"${focus === "constellation" ? " autofocus" : ""}>${constellationOptions}</select></div>
        </div>
        <p class="sw-note">${esc(L("STARWROUGHT.Travel.pickHint"))}</p>`,
      render: (renderEvent, dialog) => {
        const root = dialog.element;
        const activitySelect = root.querySelector("select[name='activity']");
        const group = root.querySelector(".sw-road-dialog-constellation");
        const update = () => {
          const chosen = activitySelect?.selectedOptions?.[0];
          group?.classList.toggle("sw-road-dialog-hidden", chosen?.dataset.choice !== "1");
        };
        activitySelect?.addEventListener("change", update);
        update();
      },
      buttons: [
        {
          action: "set", label: "STARWROUGHT.Travel.pickButton", icon: "fa-solid fa-check", default: true,
          callback: (clickEvent, button) => new foundry.applications.ux.FormDataExtended(button.form).object
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel")) return null;
    return setActivity(actor, {
      activityId: String(answer.activity ?? ""),
      constellation: String(answer.constellation ?? "")
    });
  }

  /**
   * The Roll on a road row (ruling 107): the check-now Constellation as the member, with no
   * Threshold, through the path Ask everyone's Roll takes (a Defense slug rolls as the Defense
   * check, a Skill as a check; Search and Investigate say the GM applies the roll); Investigate's
   * `choice` opens the member's Relevant Check picker on the chosen Constellation. Owner or GM;
   * Shift-click skips the dialog, as the grid does.
   */
  static async #onActivityRoll(event, target) {
    const actor = this.#memberFor(target);
    if (!actor) return;
    if (!actor.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(L("STARWROUGHT.Notify.notOwner"));
      return;
    }
    const activities = await explorationActivities();
    const pick = activityOf(actor, activities);
    const roll = activityRoll(actor, pick.item);
    if (!roll) return;
    const dialog = !event.shiftKey;
    if (roll.kind === "choice") {
      return actor.rollRelevantCheck({ dialog, slug: String(actor.system.exploration?.constellation ?? "").trim() });
    }
    if (roll.kind === "defense") {
      return actor.rollDefense(roll.key, { dialog, kind: "check", thresholdLabel: L("STARWROUGHT.Field.threshold") });
    }
    return actor.rollCheck(roll.slug, { dialog });
  }

  /** Say the plan (ruling 106): the GM's card of every member's Activity and the speed line. No confirm. */
  static async #onSayThePlan() {
    if (!game.user.isGM) return;
    return sayThePlan(this.document);
  }

  /**
   * Begin the encounter (ruling 105): the Combat on the viewed scene, the members' tokens as
   * Combatants, the Initiative flags, the Defenders' shields, one card, nothing rolled. No
   * confirm; the button is dimmed with the reason when no scene is viewed, and the helper says
   * so again should the scene close between the render and the click.
   *
   * Since 0.7.3 (ruling 109) one question first, and only when there is something to ask: when a
   * present member's remembered road roll is in the Constellation their Activity rolls for
   * Initiative and their Combatant has not rolled (`keepableRolls`), a dialog lists them, one
   * checkbox each, ticked by default ("Keep Wren's Stealth 17 as Initiative"); Begin passes the
   * ticked uuids on, Cancel does nothing at all. With nobody to ask about, Begin runs as it did.
   * The checkboxes draw as Foundry's glyph by the 0.7.2 fix and are not restyled here.
   */
  static async #onBeginEncounter() {
    if (!game.user.isGM) return;
    if (!canvas?.scene) {
      ui.notifications.warn(L("STARWROUGHT.Travel.noScene"));
      return;
    }
    const party = this.document;
    const keepable = keepableRolls(party, await explorationActivities());
    if (!keepable.length) return beginEncounter(party);

    const items = keepable.map(k => `<li><label class="checkbox"><input type="checkbox" name="keep" value="${esc(k.actor.uuid)}" checked> ${esc(F("STARWROUGHT.Travel.keepLine", { name: k.actor.name, constellation: k.roll.name, total: k.roll.total }))}</label></li>`).join("");
    const keep = await DialogV2.wait({
      window: { title: L("STARWROUGHT.Travel.beginEncounter"), icon: "fa-solid fa-flag" },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 500 },
      content: `<p>${esc(L("STARWROUGHT.Travel.keepIntro"))}</p><ul class="sw-milestone-preview sw-road-keep">${items}</ul><p class="sw-note">${esc(L("STARWROUGHT.Travel.keepHint"))}</p>`,
      buttons: [
        {
          action: "begin", label: "STARWROUGHT.Travel.keepButton", icon: "fa-solid fa-flag", default: true,
          callback: (clickEvent, button) => Array.from(button.form.querySelectorAll("input[name='keep']:checked")).map(i => i.value)
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    // Cancel, or the window closed, is "cancel" or null: nothing begins. Begin with every box
    // unticked is an empty list, and everyone rolls fresh.
    if (!Array.isArray(keep)) return;
    return beginEncounter(party, { keep });
  }

  /* -------------------------------------------- */
  /*  Ask everyone (part 7, 0.7.1)                */
  /* -------------------------------------------- */

  /**
   * The GM's Ask everyone on a grid row header (ruling 100): a small dialog, an optional
   * Threshold and whether the players see it, then one card spoken by the party with a Roll
   * button per member. A hidden Threshold is written nowhere (helpers/party.mjs, askEveryone
   * says why), and the dialog says so before the GM types one.
   */
  static async #onAskEveryone(event, target) {
    if (!game.user.isGM) return;
    const kind = target.dataset.kind === "defense" ? "defense" : "check";
    const slug = target.dataset.slug ?? "";
    const key = target.dataset.key ?? "";
    if ((kind === "defense") ? !SW.DEFENSES[key] : !slug) return;
    const party = this.document;
    if (!resolveMembers(party).some(m => m.actor)) {
      ui.notifications.warn(L("STARWROUGHT.Party.askNoMembers"));
      return;
    }
    const name = askedName(party, slug, { kind, key });
    const answer = await DialogV2.wait({
      window: { title: F("STARWROUGHT.Party.askTitle", { name }), icon: "fa-solid fa-bullhorn" },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 440 },
      content: `<p>${esc(F("STARWROUGHT.Party.askIntro", { name }))}</p>
        <div class="form-group">
          <label>${esc(L("STARWROUGHT.Field.threshold"))}</label>
          <div class="form-fields">
            <input type="number" name="threshold" min="0" step="1" autofocus placeholder="${esc(L("STARWROUGHT.Roll.thresholdPlaceholder"))}">
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox"><input type="checkbox" name="show"> ${esc(L("STARWROUGHT.Party.askShow"))}</label>
        </div>
        <p class="sw-note">${esc(L("STARWROUGHT.Party.askShowHint"))}</p>`,
      buttons: [
        {
          action: "ask", label: "STARWROUGHT.Party.askButton", icon: "fa-solid fa-bullhorn", default: true,
          callback: (clickEvent, button) => new foundry.applications.ux.FormDataExtended(button.form).object
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel")) return;
    const threshold = Number.isNumeric(answer.threshold) ? Number(answer.threshold) : null;
    return askEveryone(party, slug, { kind, key, threshold, show: answer.show === true });
  }

  /* -------------------------------------------- */
  /*  The loot and the purse (part 6, 0.7.1)      */
  /* -------------------------------------------- */

  /**
   * One dialog for a Take and a Give to: which member (a select, when there is more than one to
   * choose from) and how many (a number, when the stack is above one). With one member and one
   * thing there is nothing to ask and the dialog is skipped.
   * @param {object} spec
   * @param {string} spec.title
   * @param {string} spec.icon
   * @param {string} spec.intro
   * @param {string} spec.button  The i18n key of the confirming button.
   * @param {Array<{uuid: string, name: string}>} spec.members  Who may receive.
   * @param {number} spec.stock
   * @param {boolean} [spec.alwaysAsk]  Show the dialog even with nothing to choose (the GM confirms a Give to).
   * @returns {Promise<{uuid: string, quantity: number}|null>}
   */
  async #pickMemberAndCount({ title, icon, intro, button, members, stock, alwaysAsk = false }) {
    if (!members.length) return null;
    const askMember = members.length > 1;
    const askCount = stock > 1;
    if (!askMember && !askCount && !alwaysAsk) return { uuid: members[0].uuid, quantity: 1 };

    const options = members.map(m => `<option value="${esc(m.uuid)}">${esc(m.name)}</option>`).join("");
    const memberField = askMember || alwaysAsk
      ? `<div class="form-group">
          <label>${esc(L("STARWROUGHT.Loot.toWhom"))}</label>
          <div class="form-fields"><select name="uuid" autofocus>${options}</select></div>
        </div>`
      : `<input type="hidden" name="uuid" value="${esc(members[0].uuid)}">`;
    const countField = askCount
      ? `<div class="form-group">
          <label>${esc(L("STARWROUGHT.Loot.howMany"))}</label>
          <div class="form-fields">
            <input type="number" name="quantity" min="1" max="${stock}" step="1" value="1" ${askMember || alwaysAsk ? "" : "autofocus"}>
            <span class="sw-loot-stock">${esc(F("STARWROUGHT.Loot.ofStock", { stock }))}</span>
          </div>
        </div>`
      : `<input type="hidden" name="quantity" value="1">`;

    const answer = await DialogV2.wait({
      window: { title, icon },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 420 },
      content: `<p>${esc(intro)}</p>${memberField}${countField}`,
      buttons: [
        {
          action: "go", label: button, icon, default: true,
          callback: (clickEvent, pressed) => new foundry.applications.ux.FormDataExtended(pressed.form).object
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!answer || (answer === "cancel") || !answer.uuid) return null;
    const quantity = Math.clamp(Math.floor(Number(answer.quantity) || 0), 1, Math.max(1, stock));
    return { uuid: String(answer.uuid), quantity };
  }

  /**
   * A player's Take (rulings 97 and 98): which of their members when they own two, how many when
   * the stack is above one, then `requestTake`, which runs the move on the active GM's client or
   * says that no GM is connected and writes nothing. The GM has Give to instead.
   */
  static async #onLootTake(event, target) {
    const party = this.document;
    const item = this.#lootFor(target);
    if (!item) {
      ui.notifications.warn(L("STARWROUGHT.Loot.rowGone"));
      return;
    }
    const owned = resolveMembers(party)
      .filter(m => m.actor?.testUserPermission(game.user, "OWNER"))
      .map(m => ({ uuid: m.uuid, name: m.actor.name, actor: m.actor }));
    if (!owned.length) {
      ui.notifications.warn(L("STARWROUGHT.Loot.takeNoMember"));
      return;
    }
    const stock = Number(item.system.quantity) || 0;
    if (stock < 1) {
      ui.notifications.warn(F("STARWROUGHT.Loot.takeNone", { item: item.name }));
      return;
    }
    const pick = await this.#pickMemberAndCount({
      title: F("STARWROUGHT.Loot.takeTitle", { item: item.name }),
      icon: "fa-solid fa-hand",
      intro: F("STARWROUGHT.Loot.takeIntro", { item: item.name, stock }),
      button: "STARWROUGHT.Loot.take",
      members: owned,
      stock
    });
    if (!pick) return;
    const actor = owned.find(m => m.uuid === pick.uuid)?.actor ?? null;
    if (!actor) return;
    return requestTake({ party, item, actor, quantity: pick.quantity });
  }

  /**
   * The GM's Give to (plan, part 6): a member picker, a count for a stack, then `giveTo`, which
   * lands the Item on the member as carried, takes it off the party and posts the member's card.
   */
  static async #onLootGive(event, target) {
    if (!game.user.isGM) return;
    const party = this.document;
    const item = this.#lootFor(target);
    if (!item) {
      ui.notifications.warn(L("STARWROUGHT.Loot.rowGone"));
      return;
    }
    const members = resolveMembers(party).filter(m => m.actor).map(m => ({ uuid: m.uuid, name: m.actor.name, actor: m.actor }));
    if (!members.length) {
      ui.notifications.warn(L("STARWROUGHT.Loot.giveNoMembers"));
      return;
    }
    const stock = Number(item.system.quantity) || 0;
    if (stock < 1) {
      ui.notifications.warn(F("STARWROUGHT.Loot.takeNone", { item: item.name }));
      return;
    }
    const pick = await this.#pickMemberAndCount({
      title: F("STARWROUGHT.Loot.giveTitle", { item: item.name }),
      icon: "fa-solid fa-hand-holding",
      intro: F("STARWROUGHT.Loot.giveIntro", { item: item.name, stock }),
      button: "STARWROUGHT.Loot.giveTo",
      members,
      stock,
      alwaysAsk: true
    });
    if (!pick) return;
    const actor = members.find(m => m.uuid === pick.uuid)?.actor ?? null;
    if (!actor) return;
    return giveTo(party, item, actor, pick.quantity);
  }

  /** The name on a loot row puts the Item's card on the table, for anyone who can see the sheet. */
  static async #onLootChat(event, target) {
    return this.#lootFor(target)?.toMessage();
  }

  /** The GM's pen: the Item's own sheet. */
  static async #onLootEdit(event, target) {
    if (!game.user.isGM) return;
    return this.#lootFor(target)?.sheet.render({ force: true });
  }

  /** The GM's Delete, with the confirm the character sheet uses. Posts nothing. */
  static async #onLootDelete(event, target) {
    if (!game.user.isGM || !this.isEditable) return;
    const item = this.#lootFor(target);
    if (!item) return;
    const confirmed = await DialogV2.confirm({
      window: { title: F("STARWROUGHT.Prompt.deleteTitle", { name: item.name }) },
      content: `<p>${esc(F("STARWROUGHT.Prompt.deleteBody", { name: item.name }))}</p>`,
      rejectClose: false
    });
    if (confirmed) return item.delete();
  }

  /**
   * Split among the party (ruling 99): a dialog listing every member ticked, with what each would
   * receive and what would stay, kept current as boxes are ticked, then `splitPurse`.
   */
  static async #onSplitPurse() {
    if (!game.user.isGM) return;
    const party = this.document;
    const members = resolveMembers(party).filter(m => m.actor);
    if (!members.length) {
      ui.notifications.warn(L("STARWROUGHT.Loot.splitNoMembers"));
      return;
    }
    const total = toCopper(party.system.currency);
    if (total <= 0) {
      ui.notifications.warn(L("STARWROUGHT.Loot.splitEmpty"));
      return;
    }
    const items = members.map(m => `<li><label class="checkbox">
        <input type="checkbox" name="split" value="${esc(m.uuid)}" checked>
        <span class="sw-split-name">${esc(m.actor.name)}</span>
        <span class="sw-split-has">${esc(F("STARWROUGHT.Loot.splitHas", { coin: coinText(toCopper(m.actor.system.currency)) }))}</span>
      </label></li>`).join("");
    const previewText = count => {
      const { share, remainder } = previewSplit(party, count);
      return count
        ? F("STARWROUGHT.Loot.splitPreview", { total: coinText(total), n: count, share: coinText(share), remainder: coinText(remainder) })
        : L("STARWROUGHT.Loot.splitPreviewNone");
    };
    const chosen = await DialogV2.wait({
      window: { title: L("STARWROUGHT.Loot.splitTitle"), icon: "fa-solid fa-coins" },
      classes: ["starwrought", "sw-party-dialog"],
      position: { width: 480 },
      content: `<p>${esc(F("STARWROUGHT.Loot.splitIntro", { total: coinText(total) }))}</p>
        <ul class="sw-milestone-preview sw-split-list">${items}</ul>
        <p class="sw-note sw-split-preview">${esc(previewText(members.length))}</p>`,
      render: (renderEvent, dialog) => {
        const root = dialog.element;
        const preview = root.querySelector(".sw-split-preview");
        const update = () => {
          const count = root.querySelectorAll("input[name='split']:checked").length;
          if (preview) preview.textContent = previewText(count);
        };
        for (const box of root.querySelectorAll("input[name='split']")) box.addEventListener("change", update);
      },
      buttons: [
        {
          action: "split", label: "STARWROUGHT.Loot.splitButton", icon: "fa-solid fa-coins", default: true,
          callback: (clickEvent, button) => Array.from(button.form.querySelectorAll("input[name='split']:checked")).map(i => i.value)
        },
        { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false
    });
    if (!Array.isArray(chosen) || !chosen.length) return;
    return splitPurse(party, chosen);
  }
}
