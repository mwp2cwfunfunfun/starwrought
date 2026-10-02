/**
 * STARWROUGHT for Foundry Virtual Tabletop.
 *
 * "You are what you do." The system's job is to hold the arithmetic so the table can spend its
 * attention on decisions: per-Zone Protection, the material step, the damage order of operations,
 * Exposed, Wounds per Zone, Spent, Dying, the Bind, six actions a round, Load Strain, Attribute
 * derivation and rank thresholds are all things software should do for free.
 */

import * as SW from "./module/config.mjs";
import { SwCharacterData, SwNpcData } from "./module/data/actor.mjs";
import {
  SwActionData, SwArmorData, SwChassisData, SwConstellationData,
  SwGearData, SwShieldData, SwTalentData, SwWeaponData, LEGACY_SPEED_FLOOR, migrateSpeed
} from "./module/data/item.mjs";
import { SwActor } from "./module/documents/actor.mjs";
import { SwItem } from "./module/documents/item.mjs";
import { SwCombat, SwCombatant } from "./module/documents/combat.mjs";
import { onRenderChatMessage, onChatSocket } from "./module/documents/chat.mjs";
import { registerActionTracking } from "./module/documents/actions.mjs";
import { registerAudit } from "./module/documents/audit.mjs";
import { registerReachRings, refresh as refreshReach } from "./module/canvas/reach.mjs";
// AURAS (0.5.1): the pinned rings, the client setting that mutes them, and the GM's two controls.
import {
  registerAuras, refresh as refreshAuras, aurasSuppressed, setAurasSuppressed, clearAuraMarks
} from "./module/canvas/auras.mjs";
import { registerStrideRuler } from "./module/canvas/ruler.mjs";
import { registerTargeting, refresh as refreshTargets } from "./module/canvas/targeting.mjs";
import { registerBind } from "./module/canvas/bind.mjs";
import { registerStanceHud } from "./module/apps/token-hud.mjs";
import { SwCharacterSheet } from "./module/apps/actor-sheet.mjs";
import { SwNpcSheet } from "./module/apps/npc-sheet.mjs";
import { SwItemSheet } from "./module/apps/item-sheet.mjs";
import { SwChargen, promptForChoice } from "./module/apps/chargen.mjs";
import { loadChargenContent } from "./module/helpers/chargen-data.mjs";
import { SwCheck } from "./module/dice/check.mjs";
import { SwDamage } from "./module/dice/damage.mjs";
import { AttackCoordinator } from "./module/combat/attack-coordinator.mjs";
import { SwCombatPrompt } from "./module/apps/combat-prompt.mjs";
import { registerHandlebarsHelpers, preloadTemplates } from "./module/helpers/handlebars.mjs";
import {
  loadConstellationIndex, refreshConstellationRegistry, checkContent, checkSceneGrid, rulesVersion,
  loadChassisIndex, invalidateChassisIndex,
  invalidateBasicActions
} from "./module/helpers/content.mjs";

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", async () => {
  console.log("STARWROUGHT | Lighting the sky.");

  globalThis.starwrought = game.starwrought = {
    config: SW,
    SwActor,
    SwItem,
    SwCheck,
    SwDamage,
    documents: { SwActor, SwItem, SwCombat, SwCombatant },
    applications: { SwCharacterSheet, SwNpcSheet, SwItemSheet, SwChargen },
    /** Open the creation wizard on an Actor: `game.starwrought.chargen(actor)`. */
    chargen: actor => new SwChargen(actor).render({ force: true }),
    /**
     * The attack flow (0.5.0): declare, commit, reveal, roll, resolve. `game.starwrought.attacks.live()`
     * lists the Blows in play; `.declare(...)`, `.request(...)` and `.rollFor(...)` are the verbs the
     * sheets, the prompt and the cards use; `.Workflow` is the state model.
     */
    attacks: AttackCoordinator,
    combatPrompt: SwCombatPrompt,
    /** Which Player's Handbook the shipped content was built from. */
    rules: rulesVersion
  };
  CONFIG.STARWROUGHT = SW;

  /* Documents */
  CONFIG.Actor.documentClass = SwActor;
  CONFIG.Item.documentClass = SwItem;
  CONFIG.Combat.documentClass = SwCombat;
  CONFIG.Combatant.documentClass = SwCombatant;

  /* Data models */
  CONFIG.Actor.dataModels = {
    character: SwCharacterData,
    npc: SwNpcData
  };
  CONFIG.Item.dataModels = {
    constellation: SwConstellationData,
    talent: SwTalentData,
    chassis: SwChassisData,
    weapon: SwWeaponData,
    armor: SwArmorData,
    shield: SwShieldData,
    gear: SwGearData,
    action: SwActionData
  };

  /* Labels and icons */
  CONFIG.Actor.typeLabels = {
    character: "STARWROUGHT.Type.character",
    npc: "STARWROUGHT.Type.npc"
  };
  CONFIG.Item.typeLabels = {
    constellation: "STARWROUGHT.Type.constellation",
    talent: "STARWROUGHT.Type.talent",
    chassis: "STARWROUGHT.Type.chassis",
    weapon: "STARWROUGHT.Type.weapon",
    armor: "STARWROUGHT.Type.armor",
    shield: "STARWROUGHT.Type.shield",
    gear: "STARWROUGHT.Type.gear",
    action: "STARWROUGHT.Type.action"
  };
  /* Token resource bars. Vigor replaced Hit Points in PHB v4.10; Wounds are per Zone now, so the
     old numeric `wounded` is gone from the list. */
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["vigor"], value: ["level", "dying", "heroPoints.value", "loadStrain", "actions.value"] },
    npc: { bar: ["vigor"], value: ["level", "dying", "actionsPerRound", "thresholds.evade", "thresholds.guard"] }
  };

  /* Conditions, as toggleable token statuses. The static id is the one SwActor#setCondition creates
     under too, so a status set by the rules and one toggled from the palette are one effect (0.5.1). */
  CONFIG.statusEffects = Object.values(SW.CONDITIONS).map(c => ({
    id: c.id,
    name: c.name,
    img: c.img,
    _id: SW.statusEffectId(c.id)
  }));
  CONFIG.specialStatusEffects.DEFEATED = "dead";
  CONFIG.specialStatusEffects.BLIND = "blinded";

  /* Sheets */
  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet(SW.SYSTEM_ID, SwCharacterSheet, {
    types: ["character"], makeDefault: true, label: "STARWROUGHT.Sheet.character"
  });
  Actors.registerSheet(SW.SYSTEM_ID, SwNpcSheet, {
    types: ["npc"], makeDefault: true, label: "STARWROUGHT.Sheet.npc"
  });
  Items.registerSheet(SW.SYSTEM_ID, SwItemSheet, {
    makeDefault: true, label: "STARWROUGHT.Sheet.item"
  });

  /* Dice */
  CONFIG.Dice.rolls = [Roll];

  registerSettings();
  registerActionTracking();
  registerAudit();
  registerReachRings();
  registerAuras(); // AURAS (0.5.1)
  registerStrideRuler();
  registerTargeting();
  registerBind();
  registerExposedStatuses();
  registerStanceHud();
  registerHandlebarsHelpers();
  await loadConstellationIndex();
  await preloadTemplates();
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  await refreshConstellationRegistry();
  // The chassis by name, for the sheet's locked fields to explain themselves.
  await loadChassisIndex();
  try {
    await migrateWorld();
  } catch (err) {
    // Not stamped, so it runs again next load; the rest of ready still happens.
    console.error("STARWROUGHT | world migration failed", err);
  }
  await checkContent();
  Hooks.on('canvasReady', checkSceneGrid);
  checkSceneGrid();
  checkForStaleAssets();
  Hooks.on("createItem", onCreateItem);

  // The attack flow's channel (system.json declares `"socket": true`). Every mutation of a
  // declared Blow is a request to its coordinator (the active GM, else the attacker's user) and
  // every change comes back as a state broadcast; the handler sorts the three message types.
  // Then the live Blows are rebuilt from the chat log: every card whose
  // `flags.starwrought.attackWorkflow.phase` is neither complete nor cancelled, with this client's
  // private commitments restored from its own `attackPrivate` setting.
  // One system socket, two listeners: `damage:*` (a player's Apply on a creature they cannot
  // write), `reroll:*` (a die read again on the GM's client) and `expose:*` (a Zone one side
  // chooses on the other side's body), all 0.5.3, go to chat.mjs; everything else to the attack
  // coordinator.
  game.socket.on(`system.${SW.SYSTEM_ID}`, (message, senderId) => {
    if (/^(damage|reroll|expose):/.test(String(message?.type ?? ""))) return onChatSocket(message, senderId);
    return AttackCoordinator.onSocket(message, senderId);
  });
  // A rerolled resolution card (0.5.3): the attack card that carried its outcome follows it.
  Hooks.on("starwrought.reroll", data => AttackCoordinator.noteReroll(data));
  AttackCoordinator.register();
  // The Combat Prompt listens for the attack flow's state events and opens for whoever must act.
  SwCombatPrompt.register();
  try {
    await AttackCoordinator.rebuild();
  } catch (err) {
    console.error("STARWROUGHT | the live attacks could not be rebuilt", err);
  }

  // The Basic Actions list is memoised. Forget it whenever an unowned action changes, so a GM's
  // new, edited, re-flagged or deleted Basic Action reaches the sheets without a reload. Owned
  // copies are a character's own and never in the list, so they do not count.
  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => {
      if (item.parent) return;
      if (item.type === "action") invalidateBasicActions();
      // A GM's new or edited world chassis is read on the next sheet render.
      if (item.type === "chassis") { invalidateChassisIndex(); loadChassisIndex(); }
    });
  }
});

/* -------------------------------------------- */
/*  World migration                             */
/* -------------------------------------------- */

/**
 * One-time changes to stored data, run by the first GM to open the world on a newer release and
 * recorded in the `systemVersion` world setting so they never run twice. The setting is stamped
 * every time the check runs, a brand-new world included, so the next load compares two versions
 * and touches nothing.
 *
 * 0.4.0 (PHB v4.10, sync report ruling 41): Speed moved from the five-foot scale to feet per Move
 * on the one-foot grid, so a stored Speed of 15 or more is a v3.x value and becomes a quarter of
 * itself (a Human's 25 is 6). Done once, here, rather than in `migrateData`, which ran on every
 * load and every write and so made 15 a ceiling no Speed could be typed past. The stored value is
 * read from `_source`, which `migrateData` no longer touches.
 */
async function migrateWorld() {
  if (!game.user.isGM) return;
  const done = game.settings.get(SW.SYSTEM_ID, "systemVersion") || "0.0.0";
  // Each step runs once, for a world last opened under a version older than the one it names.
  const needs = version => foundry.utils.isNewerVersion(version, done);
  if (!needs("0.4.0") && !needs("0.4.1") && !needs("0.5.1")) {
    // Nothing to change, but the stamp still names the release the world last ran under.
    if (done !== game.system.version) await game.settings.set(SW.SYSTEM_ID, "systemVersion", game.system.version);
    return;
  }

  let count = 0;
  if (needs("0.4.0")) {
    const quarter = value => {
      if ((typeof value !== "number") || (value < LEGACY_SPEED_FLOOR)) return null;
      return migrateSpeed(value);
    };

    // An adversary stores its own Speed at the top; a character's is its Ancestry's.
    for (const actor of game.actors) {
      const path = actor.type === "npc" ? "system.speed" : "system.details.ancestry.speed";
      const next = quarter(foundry.utils.getProperty(actor._source, path));
      if (next === null) continue;
      await actor.update({ [path]: next });
      count++;
    }

    // Chassis Items in the world, and in any Item pack a GM has unlocked (the shipped packs are
    // locked and built on the one-foot grid already).
    const chassis = game.items.filter(i => i.type === "chassis");
    for (const pack of game.packs.filter(p => (p.metadata.type === "Item") && !p.locked)) {
      chassis.push(...(await pack.getDocuments({ type: "chassis" })));
    }
    for (const item of chassis) {
      const next = quarter(item._source.system?.speed);
      if (next === null) continue;
      await item.update({ "system.speed": next });
      count++;
    }
  }

  // 0.4.1: Counter needs Expert rank in Melee (ruling 63). A character saved holding a Reaction
  // stance it no longer qualifies for falls back to the basic Defense that stance was built on, so
  // the sheet and the HUD stop showing a stance the roll would set aside anyway.
  let stances = 0;
  if (needs("0.4.1")) {
    for (const actor of game.actors) {
      if (actor.type !== "character") continue;
      const stance = actor.system.stance;
      if (!(stance in SW.REACTIONS) || (actor.system.reactions?.[stance] !== false)) continue;
      const fallback = SW.REACTIONS[stance].defense ?? actor.answeringDefense?.().key ?? "evade";
      await actor.update({ "system.stance": fallback });
      stances++;
    }
  }

  // 0.5.1: Exposed became four token statuses (Exposed: Head, Torso, Arms, Legs), mirrors of the
  // Zones, so a Zone already open when the world last closed gets its status now. The same pass
  // brings every condition effect under the static id the token palette looks for: before 0.5.1
  // the rules created them under random ids, so the palette showed a Spent or Bound creature as
  // having neither and a click there laid a twin beside the first. Twins go; the survivor is
  // recreated under the static id with its data intact. Unlinked tokens carry their own actors,
  // so every scene is walked.
  let exposed = 0;
  let normalised = 0;
  let auras = 0;
  if (needs("0.5.1")) {
    const actors = [...game.actors];
    for (const scene of game.scenes) {
      for (const token of scene.tokens) if (!token.actorLink && token.actor) actors.push(token.actor);
    }
    for (const actor of actors) {
      if (!actor.system?.zones) continue;
      for (const [zone, conditionId] of Object.entries(SW.ZONE_CONDITIONS)) {
        const on = !!actor.system.zones[zone]?.exposed;
        if (on === !!actor.statuses?.has(conditionId)) continue;
        await actor.setCondition(conditionId, on);
        exposed++;
      }
      normalised += await normaliseConditionEffects(actor);
    }

    // A Talent or Maneuver owned before the Aura field existed carries no range, while its
    // compendium copy now may (the Aura column, 0.5.1). The compendium's aura is copied onto every
    // owned copy that has none of its own, matched by plain name within the pack of its type, so
    // a Torchbearer's 15 feet reach the sheet without the Talent being dragged on again.
    const auraByName = new Map();
    for (const packId of [`${SW.SYSTEM_ID}.talents`, `${SW.SYSTEM_ID}.actions`]) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      for (const doc of await pack.getDocuments()) {
        const range = doc.system?.aura?.range;
        if (!Number.isFinite(range) || (range <= 0)) continue;
        auraByName.set(`${doc.type}|${SW.plainName(doc.name)}`, foundry.utils.deepClone(doc.system.aura));
      }
    }
    for (const actor of actors) {
      const updates = [];
      for (const item of actor.items) {
        if (!["talent", "action"].includes(item.type)) continue;
        if (Number.isFinite(item._source.system?.aura?.range)) continue;
        const aura = auraByName.get(`${item.type}|${SW.plainName(item.name)}`);
        if (aura) updates.push({ _id: item.id, "system.aura": aura });
      }
      if (!updates.length) continue;
      await actor.updateEmbeddedDocuments("Item", updates);
      auras += updates.length;
    }
  }

  await game.settings.set(SW.SYSTEM_ID, "systemVersion", game.system.version);
  if (auras > 0) {
    const message = game.i18n.format("STARWROUGHT.Migration.auras", { version: game.system.version, count: auras });
    console.log(`STARWROUGHT | ${message}`);
    ui.notifications.info(message);
  }
  if ((exposed > 0) || (normalised > 0)) {
    const message = game.i18n.format("STARWROUGHT.Migration.exposed", { version: game.system.version, exposed, normalised });
    console.log(`STARWROUGHT | ${message}`);
    ui.notifications.info(message);
  }
  if (count > 0) {
    const message = game.i18n.format("STARWROUGHT.Migration.speed", { version: game.system.version, count });
    console.log(`STARWROUGHT | ${message}`);
    ui.notifications.info(message);
  }
  if (stances > 0) {
    const message = game.i18n.format("STARWROUGHT.Migration.stance", { version: game.system.version, count: stances });
    console.log(`STARWROUGHT | ${message}`);
    ui.notifications.info(message);
  }
}

/**
 * One effect per condition, under the id the token palette uses (the 0.5.1 migration's second
 * half). For each condition an actor carries: effects that duplicate it are deleted, and the one
 * kept is recreated under `SW.statusEffectId` when it sits under another id, data and all. An
 * effect carrying several statuses is left alone; it is not one of ours.
 * @param {Actor} actor
 * @returns {Promise<number>}  Effects deleted or recreated.
 */
async function normaliseConditionEffects(actor) {
  let changed = 0;
  for (const id of Object.keys(SW.CONDITIONS)) {
    const staticId = SW.statusEffectId(id);
    // The same ownership rule setCondition applies: an authored multi-status effect is not ours.
    const carrying = actor.effects.filter(e => e.statuses?.has(id) && ((e.id === staticId) || (e.statuses.size === 1)));
    if (!carrying.length) continue;
    const keep = carrying.find(e => e.id === staticId) ?? carrying[0];
    const twins = carrying.filter(e => e !== keep);
    if (twins.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", twins.map(e => e.id));
      changed += twins.length;
    }
    if ((keep.id === staticId) || (keep.statuses.size !== 1)) continue;
    const data = keep.toObject();
    data._id = staticId;
    await keep.delete();
    await actor.createEmbeddedDocuments("ActiveEffect", [data], { keepId: true });
    changed++;
  }
  return changed;
}

/**
 * Is this browser running the release the server has?
 *
 * A server behind a caching proxy can hand a browser this week's templates with last week's
 * stylesheet or script: Cloudflare, for one, rewrites Foundry's `no-cache` into a four-hour browser
 * cache. The result looks exactly like a bug in the new release. Foundry reads system.json on the
 * server, so `game.system.version` is always current; the code and the stylesheet each carry their
 * own stamp, and a mismatch means a stale copy, which a hard reload cures.
 */
function checkForStaleAssets() {
  const server = game.system.version;
  const css = getComputedStyle(document.documentElement).getPropertyValue("--sw-css-version")
    .trim().replace(/^["']|["']$/g, "");
  const stale = [];
  if (SW.SYSTEM_VERSION !== server) stale.push(`${game.i18n.localize("STARWROUGHT.Notify.staleCode")} ${SW.SYSTEM_VERSION}`);
  if (css !== server) stale.push(`${game.i18n.localize("STARWROUGHT.Notify.staleStyles")} ${css || "?"}`);
  if (!stale.length) return;
  const message = game.i18n.format("STARWROUGHT.Notify.staleAssets", { server, stale: stale.join(", ") });
  console.warn(`STARWROUGHT | ${message}`);
  ui.notifications.warn(message, { permanent: true });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", onRenderChatMessage);

/**
 * The core User Configuration window (Player Name, Avatar, Color, Pronouns, Player Character) is
 * Foundry's, not ours, but it is an ApplicationV2 and fires this hook with its rendered element.
 * The table does not use the Pronouns field (Mike, 2026-10-01), so the row is taken out before
 * anyone sees it. The stored value is untouched, and the row returns the moment this hook goes.
 */
Hooks.on("renderUserConfig", (app, element) => {
  element.querySelector('[name="pronouns"]')?.closest(".form-group")?.remove();
});

/* -------------------------------------------- */
/*  Exposed on the token (0.5.1, T7)             */
/* -------------------------------------------- */

/**
 * The four Exposed statuses are mirrors of `system.zones.<zone>.exposed`, and the mirror runs both
 * ways. `SwActor#setExposed` writes the Zone and then the status; these hooks cover the other
 * paths: a status toggled on the token palette (or deleted from the Effects tab) writes the Zone,
 * and a Zone written directly (Recenter clears them in one update) writes the status. Only the
 * client that made the change acts, so one toggle is one write, and each side checks the other
 * before writing, so the two never chase each other.
 */
function registerExposedStatuses() {
  const zoneOf = effect => {
    for (const status of effect.statuses ?? []) {
      const zone = SW.CONDITIONS[status]?.zone;
      if (zone) return zone;
    }
    return null;
  };
  const carryToZone = (effect, on, userId) => {
    if (userId !== game.user.id) return;
    const actor = effect.parent;
    if (!(actor instanceof Actor)) return;
    const zone = zoneOf(effect);
    if (!zone || (!!actor.system?.zones?.[zone]?.exposed === on)) return;
    actor.setExposed(zone, on)
      .catch(err => console.error(`STARWROUGHT | ${actor.name}: the Exposed status could not be carried to the Zone`, err));
  };
  Hooks.on("createActiveEffect", (effect, options, userId) => carryToZone(effect, true, userId));
  Hooks.on("deleteActiveEffect", (effect, options, userId) => carryToZone(effect, false, userId));

  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id) return;
    const zones = changes.system?.zones;
    if (!zones) return;
    for (const [zone, conditionId] of Object.entries(SW.ZONE_CONDITIONS)) {
      if (!("exposed" in (zones[zone] ?? {}))) continue;
      const on = !!actor.system.zones?.[zone]?.exposed;
      if (!!actor.statuses?.has(conditionId) === on) continue;
      actor.setCondition(conditionId, on)
        .catch(err => console.error(`STARWROUGHT | ${actor.name}: the Exposed status could not follow the Zone`, err));
    }
  });
}

/**
 * AURAS (0.5.1): the GM's two Token-layer controls. Suppress auras is a toggle on the scene flag
 * `flags.starwrought.aurasSuppressed`: players see no pinned ring until it is released, and the
 * marks themselves are untouched. Clear aura marks is a button: every combatant's Visible marks
 * back to their data defaults, after a confirm. Foundry builds the controls once per canvas, so
 * the toggle reads its state from the flag then; auras.mjs rebuilds them when the flag changes.
 */
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  const tools = controls.tokens?.tools;
  if (!tools) return;
  const order = Object.keys(tools).length;
  tools.swSuppressAuras = {
    name: "swSuppressAuras",
    title: "STARWROUGHT.Aura.suppress",
    icon: "fa-solid fa-circle-xmark",
    order,
    toggle: true,
    active: aurasSuppressed(),
    onChange: (event, active) => setAurasSuppressed(active)
  };
  tools.swClearAuras = {
    name: "swClearAuras",
    title: "STARWROUGHT.Aura.clear",
    icon: "fa-solid fa-eraser",
    order: order + 1,
    button: true,
    onChange: () => clearAuraMarks()
  };
});

/**
 * Buying a Talent in a Constellation you have not opened is buying its Root, so draw the sky
 * whenever a Talent lands on a character without one.
 */
async function onCreateItem(item, options, userId) {
  if (game.user.id !== userId) return;
  if (options.swAuto) return;
  if (item.type !== "talent" || !item.parent) return;
  if (game.settings.get(SW.SYSTEM_ID, "autoOpenConstellations")) {
    await SwItem.ensureConstellation(item.parent, item.system.constellation);
  }

  // A Talent that demands a build-time pick does nothing until it has an answer. The wizard asks
  // as it goes; a Talent dragged straight onto a sheet has to be asked here.
  if (item.system.needsChoice) {
    await loadChargenContent();
    const value = await promptForChoice(item.system.choice.prompt, item.name);
    if (value) await item.update({ "system.choice.value": value });
  }

  // Some Talents hand over another Talent outright, with no point spent. The answer above carries
  // across, so Drilled and the Weapon Familiarity it grants are one question, not two.
  if (item.system.freeTalent) {
    await SwItem.grantFreeTalent(item.parent, item.system.freeTalent, {
      inherit: item.system.choice?.value
    });
  }
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(SW.SYSTEM_ID, "autoOpenConstellations", {
    name: "STARWROUGHT.Settings.autoOpen",
    hint: "STARWROUGHT.Settings.autoOpenHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "offerFlares", {
    name: "STARWROUGHT.Settings.offerFlares",
    hint: "STARWROUGHT.Settings.offerFlaresHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // One Maneuver per Opportunity on the map (0.5.3; Mike, 2026-10-01): a drag at your own
  // Opportunity may be one Step, one Move, one Crawl or one straight Rush, and a second Move's
  // worth is refused before the token lands. Off, the move lands and its card counts the Moves.
  game.settings.register(SW.SYSTEM_ID, "capMoves", {
    name: "STARWROUGHT.Settings.capMoves",
    hint: "STARWROUGHT.Settings.capMovesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "trackActions", {
    name: "STARWROUGHT.Settings.trackActions",
    hint: "STARWROUGHT.Settings.trackActionsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "showReach", {
    name: "STARWROUGHT.Settings.showReach",
    hint: "STARWROUGHT.Settings.showReachHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    // The pinned layer steps aside for a previewed token, so it is redrawn with the preview.
    onChange: () => { refreshReach(); refreshAuras(); }
  });

  // AURAS (0.5.1): the pinned drawing, muted on this client. The preview stays under showReach.
  game.settings.register(SW.SYSTEM_ID, "showAuras", {
    name: "STARWROUGHT.Settings.showAuras",
    hint: "STARWROUGHT.Settings.showAurasHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => { refreshAuras(); refreshReach(); }
  });

  // How boldly the rings are drawn (0.5.3; Mike: "sometimes the Ranges are hard to see, depending
  // on the colour of the battlemap tiles"). Every ring has a dark halo under its outline at either
  // level; Strong thickens the lines and deepens the fills. The level is part of the ring
  // signature, so the refresh redraws.
  game.settings.register(SW.SYSTEM_ID, "ringContrast", {
    name: "STARWROUGHT.Settings.ringContrast",
    hint: "STARWROUGHT.Settings.ringContrastHint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      normal: "STARWROUGHT.Settings.ringContrastNormal",
      strong: "STARWROUGHT.Settings.ringContrastStrong"
    },
    default: "normal",
    onChange: () => { refreshReach(); refreshAuras(); }
  });

  game.settings.register(SW.SYSTEM_ID, "showTargetArrows", {
    name: "STARWROUGHT.Settings.showTargetArrows",
    hint: "STARWROUGHT.Settings.showTargetArrowsHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => refreshTargets()
  });

  // A Stride is a Move in PHB v4.10. The 0.3.x client choice lived under `showStrideBands`, which
  // is no longer registered and so can never be read through game.settings.get; read it once from
  // the client store here to seed the default, so a player who switched the bands off keeps them
  // off. Client values are stored in localStorage as JSON under `<namespace>.<key>`.
  let legacyBands = true;
  try {
    const stored = game.settings.storage.get("client")?.getItem(`${SW.SYSTEM_ID}.showStrideBands`);
    if (stored != null) legacyBands = JSON.parse(stored) !== false;
  } catch {
    // No legacy value, or one that will not parse: keep the default.
  }
  game.settings.register(SW.SYSTEM_ID, "showMoveBands", {
    name: "STARWROUGHT.Settings.showMoveBands",
    hint: "STARWROUGHT.Settings.showMoveBandsHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: legacyBands
  });

  // There is no Multiple Attack Penalty in PHB v4.10, so the `trackMap` world setting that
  // remembered attacks made this turn is gone with it. A world that still carries a stored value
  // for it is harmless: Foundry ignores settings nobody registers.

  // Recovery checks are made at the start of each ROUND while Dying (PHB v4.10, Recovery
  // Checks), and SwCombat's round-start handling (module/documents/combat.mjs) is what prompts
  // for them; this setting is the switch it reads.
  game.settings.register(SW.SYSTEM_ID, "autoRecovery", {
    name: "STARWROUGHT.Settings.autoRecovery",
    hint: "STARWROUGHT.Settings.autoRecoveryHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // COMBAT SETTINGS (0.4.0): any world or client setting the six-action round needs (Wind
  // reminders, the end-of-round Persistent Damage card, Intercept offers) is registered here, so
  // that every setting the system owns is in this one function. Add them below this line.

  // THE ATTACK FLOW (0.5.0; PHB v4.10, The Exchange). On, a Strike at a target declares first:
  // every defender commits a Defense and an answer in private, all reveal at once, then the
  // players roll and each pairing resolves. Off, a Strike rolls at once against the defender's
  // standing stance, exactly as 0.4.2 did; with no target it does so whatever this says.
  game.settings.register(SW.SYSTEM_ID, "attackFlow", {
    name: "STARWROUGHT.Settings.attackFlow",
    hint: "STARWROUGHT.Settings.attackFlowHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // A presentation policy, not a rule (brief, "Visibility"): a character's Defense Threshold is
  // the defender's and the GM's to see always; this lets the attacking player see it on the card
  // after the defenses reveal. An adversary's Thresholds are never shown to players.
  game.settings.register(SW.SYSTEM_ID, "attackShowPcThresholds", {
    name: "STARWROUGHT.Settings.attackShowPcThresholds",
    hint: "STARWROUGHT.Settings.attackShowPcThresholdsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // The coordinator's private half of the defense phase: each defender's commitment before the
  // reveal, keyed by workflow then target, mirrored to the coordinating client's own browser so a
  // reload restores it. Client scope on purpose: it must never reach a world setting, a flag or
  // a message, which every client receives. Nothing but the coordinator reads or writes it.
  game.settings.register(SW.SYSTEM_ID, "attackPrivate", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(SW.SYSTEM_ID, "systemVersion", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

/* -------------------------------------------- */
/*  Combat                                       */
/* -------------------------------------------- */

// Everything that happens at the turn of a round or an Opportunity (six fresh actions, Recovery
// checks for the Dying, the Wind check from round three, a Prepared Maneuver coming due) lives on
// SwCombat in module/documents/combat.mjs, which owns the Combat document. Nothing is hooked here.
