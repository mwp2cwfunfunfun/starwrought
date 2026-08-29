/**
 * STARWROUGHT for Foundry Virtual Tabletop.
 *
 * "You are what you do." The system's job is to hold the arithmetic so the table can spend its
 * attention on decisions: per-Zone Protection, the material step, the damage order of operations,
 * Exposed, Wounded, Dying, the Multiple Attack Penalty, Load Strain, Attribute derivation and rank
 * thresholds are all things software should do for free.
 */

import * as SW from "./module/config.mjs";
import { SwCharacterData, SwNpcData } from "./module/data/actor.mjs";
import {
  SwActionData, SwArmorData, SwChassisData, SwConstellationData,
  SwGearData, SwShieldData, SwTalentData, SwWeaponData
} from "./module/data/item.mjs";
import { SwActor } from "./module/documents/actor.mjs";
import { SwItem } from "./module/documents/item.mjs";
import { SwCombat, SwCombatant } from "./module/documents/combat.mjs";
import { onRenderChatMessage } from "./module/documents/chat.mjs";
import { registerActionTracking } from "./module/documents/actions.mjs";
import { registerReachRings, refresh as refreshReach } from "./module/canvas/reach.mjs";
import { registerStrideRuler } from "./module/canvas/ruler.mjs";
import { SwCharacterSheet } from "./module/apps/actor-sheet.mjs";
import { SwNpcSheet } from "./module/apps/npc-sheet.mjs";
import { SwItemSheet } from "./module/apps/item-sheet.mjs";
import { SwChargen, promptForChoice } from "./module/apps/chargen.mjs";
import { loadChargenContent } from "./module/helpers/chargen-data.mjs";
import { SwCheck, resetAttackCount } from "./module/dice/check.mjs";
import { SwDamage } from "./module/dice/damage.mjs";
import { registerHandlebarsHelpers, preloadTemplates } from "./module/helpers/handlebars.mjs";
import {
  loadConstellationIndex, refreshConstellationRegistry, checkContent, checkSceneGrid, rulesVersion
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
  /* Token resource bars */
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["hp"], value: ["level", "wounded", "dying", "heroPoints.value", "loadStrain"] },
    npc: { bar: ["hp"], value: ["level", "wounded", "dying", "thresholds.evade", "thresholds.guard"] }
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
  registerHandlebarsHelpers();
  await loadConstellationIndex();
  await preloadTemplates();
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  await refreshConstellationRegistry();
  await checkContent();
  Hooks.on('canvasReady', checkSceneGrid);
  checkSceneGrid();
  Hooks.on("createItem", onCreateItem);
});

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", onRenderChatMessage);

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

  game.settings.register(SW.SYSTEM_ID, "showStrideBands", {
    name: "STARWROUGHT.Settings.showStrideBands",
    hint: "STARWROUGHT.Settings.showStrideBandsHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "trackMap", {
    name: "STARWROUGHT.Settings.trackMap",
    hint: "STARWROUGHT.Settings.trackMapHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "autoRecovery", {
    name: "STARWROUGHT.Settings.autoRecovery",
    hint: "STARWROUGHT.Settings.autoRecoveryHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SW.SYSTEM_ID, "systemVersion", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

/* -------------------------------------------- */
/*  Combat: Recovery checks at the top of a turn */
/* -------------------------------------------- */

Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const combatant = combat.combatants.get(current?.combatantId);
  const actor = combatant?.actor;

  // Your first attack each turn is unpenalized, so the count starts over when your turn does.
  if (actor) resetAttackCount(actor.uuid);

  if (!game.settings.get(SW.SYSTEM_ID, "autoRecovery")) return;
  if (!actor?.system?.dying) return;
  if (!actor.isOwner) return;
  const first = game.users.find(u => u.active && actor.testUserPermission(u, "OWNER"));
  if (first?.id !== game.user.id) return;
  ui.notifications.info(game.i18n.format("STARWROUGHT.Notify.recoveryDue", { name: actor.name }));
});

/** A fresh encounter starts everyone at their first attack. */
Hooks.on("combatStart", () => resetAttackCount());
Hooks.on("deleteCombat", () => resetAttackCount());
