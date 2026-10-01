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
import { onRenderChatMessage } from "./module/documents/chat.mjs";
import { registerActionTracking } from "./module/documents/actions.mjs";
import { registerReachRings, refresh as refreshReach } from "./module/canvas/reach.mjs";
import { registerStrideRuler } from "./module/canvas/ruler.mjs";
import { registerTargeting, refresh as refreshTargets } from "./module/canvas/targeting.mjs";
import { registerStanceHud } from "./module/apps/token-hud.mjs";
import { SwCharacterSheet } from "./module/apps/actor-sheet.mjs";
import { SwNpcSheet } from "./module/apps/npc-sheet.mjs";
import { SwItemSheet } from "./module/apps/item-sheet.mjs";
import { SwChargen, promptForChoice } from "./module/apps/chargen.mjs";
import { loadChargenContent } from "./module/helpers/chargen-data.mjs";
import { SwCheck } from "./module/dice/check.mjs";
import { SwDamage } from "./module/dice/damage.mjs";
import { registerHandlebarsHelpers, preloadTemplates } from "./module/helpers/handlebars.mjs";
import {
  loadConstellationIndex, refreshConstellationRegistry, checkContent, checkSceneGrid, rulesVersion,
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

  /* Conditions, as toggleable token statuses */
  CONFIG.statusEffects = Object.values(SW.CONDITIONS).map(c => ({
    id: c.id,
    name: c.name,
    img: c.img,
    _id: `starwrought${c.id}`.padEnd(16, "0").slice(0, 16)
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
  registerReachRings();
  registerStrideRuler();
  registerTargeting();
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

  // The Basic Actions list is memoised. Forget it whenever an unowned action changes, so a GM's
  // new, edited, re-flagged or deleted Basic Action reaches the sheets without a reload. Owned
  // copies are a character's own and never in the list, so they do not count.
  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => {
      if ((item.type !== "action") || item.parent) return;
      invalidateBasicActions();
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
  if (!needs("0.4.0") && !needs("0.4.1")) return;

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

  await game.settings.set(SW.SYSTEM_ID, "systemVersion", game.system.version);
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
    onChange: () => refreshReach()
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
