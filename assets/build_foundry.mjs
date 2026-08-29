#!/usr/bin/env node
/**
 * build_foundry.js
 *
 * assets/trees.json + assets/roster.json + assets/backgrounds.json + assets/languages.json
 *   -> foundry/starwrought/packs/_source/<pack>/*.json     (compendium pack sources)
 *   -> foundry/starwrought/content/constellations.json     (the runtime Constellation index)
 *   -> foundry/starwrought/assets/constellations/*.png     (plate art, copied)
 *   -> foundry/starwrought/packs/<pack>                    (compiled LevelDB, if the CLI is present)
 *
 * The Foundry system is generated content in exactly the way the app HTML is: edit the
 * spreadsheets, run the pipeline, run this. Nothing here is authored by hand.
 *
 * Document ids are a hash of pack plus name, so they are stable across rebuilds. That matters:
 * an id becomes a compendium UUID the moment somebody drags a Talent onto a character sheet.
 *
 * Usage:  node assets/build_foundry.js [--no-compile]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// The slug rule and the action-cost parser are imported from the system rather than copied, so
// they cannot drift: a slug that disagrees is a Talent that stops matching its Constellation.
// This is why module/config.mjs must stay free of Foundry globals at module scope.
import { slugify, parseActionCost } from "../foundry/starwrought/module/config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SYSTEM = path.join(ROOT, "foundry", "starwrought");
const SOURCE = path.join(SYSTEM, "packs", "_source");
const CONTENT = path.join(SYSTEM, "content");

const ICON = {
  constellation: "systems/starwrought/assets/icons/constellation.svg",
  talent: "systems/starwrought/assets/icons/talent.svg",
  chassis: "systems/starwrought/assets/icons/chassis.svg",
  weapon: "icons/svg/sword.svg",
  armor: "icons/svg/shield.svg",
  shield: "icons/svg/shield.svg",
  gear: "icons/svg/item-bag.svg",
  action: "icons/svg/target.svg",
  journal: "icons/svg/book.svg",
  macro: "icons/svg/dice-target.svg"
};

/* -------------------------------------------- */
/*  Small helpers                               */
/* -------------------------------------------- */

const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, "assets", name), "utf8"));

/** A stable 16-character document id. */
function docId(pack, key) {
  return crypto.createHash("sha1").update(`starwrought|${pack}|${key}`).digest("hex").slice(0, 16);
}

/** Strip the action glyphs from a Talent name for matching and slugs. */
const stripGlyphs = name => String(name).replace(/[◆◇↺★]/g, "").trim();

/**
 * The plain name of an action, with the cost glyphs and the connective that joined them removed.
 * "Strike ◆ to ◆◆◆" is the action Strike; "Disarm ◆ or ◆◆◆" is the action Disarm. The cost itself
 * is parsed separately by parseActionCost, so nothing is lost here.
 */
function actionName(name) {
  const bare = stripGlyphs(name)
    .replace(/\s+(to|or)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return bare || String(name).trim();
}

/** Split an authored Trait line into an array. */
function splitTraits(line) {
  if (Array.isArray(line)) return line;
  return String(line ?? "")
    .split(/,(?![^(]*\))/)
    .map(t => t.trim())
    .filter(t => t && t !== "—" && t !== "-");
}

const DAMAGE_ABBR = { B: "bludgeoning", P: "piercing", S: "slashing" };

/** "1d8 S" into a die size and a damage type. */
function parseDamage(text) {
  const match = String(text).match(/(\d*)d(\d+)\s*([BPS])?/i);
  if (!match) return { die: 6, type: "bludgeoning" };
  return { die: Number(match[2]), type: DAMAGE_ABBR[(match[3] ?? "B").toUpperCase()] };
}

/** "Adjacent", "3 ft", 4 into a number of feet. */
function parseReach(text) {
  if (typeof text === "number") return text;
  const value = String(text ?? "").trim();
  if (/adjacent/i.test(value)) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/* -------------------------------------------- */
/*  Document builders                           */
/* -------------------------------------------- */

const packs = {};

/** Queue one document into a pack. */
function push(pack, collection, doc) {
  (packs[pack] ??= []).push({ ...doc, _key: `!${collection}!${doc._id}` });
  return doc;
}

function item(pack, { key, name, type, img, system, folder = null, sort = 0 }) {
  const _id = docId(pack, key ?? `${type}:${name}`);
  return push(pack, "items", {
    _id,
    name,
    type,
    img: img ?? ICON[type],
    system,
    folder,
    sort,
    ownership: { default: 0 },
    flags: {},
    effects: [],
    _stats: { systemId: "starwrought" }
  });
}

function folder(pack, name, { color = "#3b2f63", sort = 0, type = "Item" } = {}) {
  const _id = docId(pack, `folder:${name}`);
  push(pack, "folders", {
    _id,
    name,
    type,
    description: "",
    folder: null,
    sorting: "a",
    sort,
    color,
    flags: {}
  });
  return _id;
}

/* -------------------------------------------- */
/*  Constellations and Talents                  */
/* -------------------------------------------- */

const CATEGORY_ALIASES = {
  Ancestry: "origin",
  Bloodline: "origin",
  Heritage: "origin",
  Culture: "origin",
  Background: "lore",
  Calling: "calling",
  Defense: "defense",
  Save: "defense",
  Weapon: "weapon",
  Weapons: "weapon",
  "Combat Style": "combatStyle",
  Armor: "combatStyle",
  Skill: "skill",
  Lore: "lore",
  General: "general"
};

const trees = read("trees.json");
const roster = read("roster.json");
const backgrounds = read("backgrounds.json");
const languages = read("languages.json");

const constellationIndex = [];
const plateDir = path.join(ROOT, "assets", "constellations");
const plates = fs.existsSync(plateDir) ? new Set(fs.readdirSync(plateDir)) : new Set();

for (const [name, tree] of Object.entries(trees)) {
  const slug = slugify(name);
  const category = CATEGORY_ALIASES[tree.category] ?? "general";
  const attribute = String(tree.feeds ?? "Might").toLowerCase();
  const plate = plates.has(`${slug}.png`) ? `systems/starwrought/assets/constellations/${slug}.png` : null;

  item("constellations", {
    key: `constellation:${slug}`,
    name,
    type: "constellation",
    img: plate ?? ICON.constellation,
    system: {
      slug,
      category,
      attribute,
      meta: tree.meta ?? "",
      flareTrigger: tree.sparks ?? "",
      identity: ["Ancestry", "Culture", "Bloodline", "Heritage"].includes(tree.category),
      description: tree.meta ? `<p>${tree.meta}</p>` : "",
      traits: [],
      source: "STARWROUGHT Playtest v3.1"
    }
  });

  constellationIndex.push({ slug, name, category, attribute, img: plate ?? ICON.constellation });

  // One folder per Constellation keeps 170 Talents navigable in the sidebar.
  const folderId = folder("talents", name, { color: "#3b2f63" });

  for (const node of tree.nodes) {
    const bare = stripGlyphs(node.name);
    item("talents", {
      key: `talent:${slug}:${slugify(bare)}`,
      name: node.name,
      type: "talent",
      folder: folderId,
      img: ICON.talent,
      system: {
        constellation: slug,
        constellationName: name,
        tier: node.tier ?? "T",
        root: !!node.root,
        bloodlineRoot: !!node.hroot,
        capstone: /★/.test(node.name),
        requires: node.requires ?? [],
        prerequisites: node.prereqs ?? "",
        attribute: node.feeds ? String(node.feeds).toLowerCase() : "",
        effect: node.effect ?? "",
        description: node.desc ? `<p>${node.desc}</p>` : "",
        ...parseActionCost(node.name),
        grant: {
          n: node.grant?.n ?? 0,
          mode: node.grant?.mode ?? "",
          scope: node.grant?.scope ?? ""
        },
        choice: { prompt: node.choice ?? "", value: "" },
        freeTalent: node.freeTalent ?? "",
        traits: [],
        source: "STARWROUGHT Playtest v3.1"
      }
    });
  }
}

/* -------------------------------------------- */
/*  Chassis: Ancestries, Bloodlines, Cultures,  */
/*  Backgrounds, Callings                       */
/* -------------------------------------------- */

const chassisFolders = {
  ancestry: folder("chassis", "Ancestries", { sort: 0 }),
  bloodline: folder("chassis", "Bloodlines", { sort: 1 }),
  culture: folder("chassis", "Cultures", { sort: 2 }),
  background: folder("chassis", "Backgrounds", { sort: 3 }),
  calling: folder("chassis", "Callings", { sort: 4 })
};

for (const ancestry of roster.ancestries ?? []) {
  const treeSlug = slugify(ancestry.tree ?? ancestry.name);
  item("chassis", {
    key: `chassis:ancestry:${slugify(ancestry.name)}`,
    name: ancestry.name,
    type: "chassis",
    folder: chassisFolders.ancestry,
    img: plates.has(`${treeSlug}.png`)
      ? `systems/starwrought/assets/constellations/${treeSlug}.png`
      : ICON.chassis,
    system: {
      kind: "ancestry",
      constellation: treeSlug,
      attribute: String(trees[ancestry.tree]?.feeds ?? "Presence").toLowerCase(),
      hp: ancestry.hp ?? 0,
      size: String(ancestry.size ?? "Medium").toLowerCase(),
      speed: parseReach(ancestry.speed),
      senses: ancestry.senses === "—" ? "" : (ancestry.senses ?? ""),
      description: `<p>${ancestry.blurb ?? ""}</p>`,
      traits: [],
      source: "STARWROUGHT Playtest v3.1"
    }
  });

  for (const [bloodName, effect] of ancestry.bloodlines ?? []) {
    item("chassis", {
      key: `chassis:bloodline:${slugify(bloodName)}`,
      name: bloodName,
      type: "chassis",
      folder: chassisFolders.bloodline,
      system: {
        kind: "bloodline",
        constellation: treeSlug,
        attribute: String(trees[ancestry.tree]?.feeds ?? "Presence").toLowerCase(),
        specialAbility: `<p>${effect}</p>`,
        description: `<p>A bloodline of the ${ancestry.name} ancestry. Its Root Talent is granted free by the character-creation choice.</p>`,
        traits: [],
        source: "STARWROUGHT Playtest v3.1"
      }
    });
  }
}

for (const [name, langs, attribute, blurb] of roster.cultures ?? []) {
  item("chassis", {
    key: `chassis:culture:${slugify(name)}`,
    name,
    type: "chassis",
    folder: chassisFolders.culture,
    img: plates.has(`${slugify(name)}.png`)
      ? `systems/starwrought/assets/constellations/${slugify(name)}.png`
      : ICON.chassis,
    system: {
      kind: "culture",
      constellation: slugify(name),
      attribute: String(attribute).toLowerCase(),
      languages: String(langs).replace(/\s*•\s*/g, ", "),
      description: `<p>${blurb}</p>`,
      specialAbility: "<p>Its Root Talent is granted free by the character-creation choice: a language, and a Diplomacy bonus toward those who share your Culture that rises with your Proficiency Rank in your Origin.</p>",
      traits: [],
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

for (const background of backgrounds) {
  item("chassis", {
    key: `chassis:background:${slugify(background.name)}`,
    name: background.name,
    type: "chassis",
    folder: chassisFolders.background,
    system: {
      kind: "background",
      attribute: "wits",
      grants: [...(background.skills ?? []), background.lore].filter(Boolean),
      specialAbility: `<p>${background.effect ?? ""}</p>`,
      description: `<p>${background.desc ?? ""}</p>`,
      traits: background.rarity ? [background.rarity] : [],
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

for (const [name, training, hp, attribute, ability] of roster.callings ?? []) {
  item("chassis", {
    key: `chassis:calling:${slugify(name)}`,
    name,
    type: "chassis",
    folder: chassisFolders.calling,
    img: plates.has(`${slugify(name)}.png`)
      ? `systems/starwrought/assets/constellations/${slugify(name)}.png`
      : ICON.chassis,
    system: {
      kind: "calling",
      constellation: slugify(name),
      attribute: String(attribute).toLowerCase(),
      hp,
      grants: [training],
      specialAbility: `<p>${ability}</p>`,
      description: `<p>Grants Training in ${training}, and ${hp} Hit Points per level. Only your first Calling counts toward Hit Points, however many you open later.</p>`,
      traits: [],
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

/* -------------------------------------------- */
/*  Equipment                                   */
/* -------------------------------------------- */

const equipFolders = {
  melee: folder("equipment", "Melee Weapons", { sort: 0, color: "#5a2f2f" }),
  ranged: folder("equipment", "Ranged Weapons", { sort: 1, color: "#5a2f2f" }),
  armor: folder("equipment", "Armor", { sort: 2, color: "#2f4a5a" }),
  shields: folder("equipment", "Shields", { sort: 3, color: "#2f4a5a" })
};

for (const [name, handling, group, damage, reach, traitLine, price] of roster.weaponsMelee ?? []) {
  const dmg = parseDamage(damage);
  item("equipment", {
    key: `weapon:${slugify(name)}`,
    name,
    type: "weapon",
    folder: equipFolders.melee,
    system: {
      handling: String(handling).toLowerCase(),
      group,
      damage: dmg,
      reach: parseReach(reach),
      traits: splitTraits(traitLine),
      price: price === "—" ? "" : (price ?? ""),
      quantity: 1,
      load: 0,
      state: "carried",
      description: "",
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

for (const [name, handling, group, damage, , traitLine] of roster.weaponsRanged ?? []) {
  const dmg = parseDamage(damage);
  item("equipment", {
    key: `weapon:${slugify(name)}`,
    name,
    type: "weapon",
    folder: equipFolders.ranged,
    system: {
      handling: String(handling).toLowerCase(),
      group,
      damage: dmg,
      reach: 0,
      traits: splitTraits(traitLine),
      price: "",
      quantity: 1,
      load: 0,
      state: "carried",
      description: "",
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

for (const [name, zone, protection, load, price, traitLine, material] of roster.armorPieces ?? []) {
  item("equipment", {
    key: `armor:${slugify(name)}`,
    name,
    type: "armor",
    folder: equipFolders.armor,
    system: {
      zone: String(zone).toLowerCase(),
      protection,
      load,
      material: String(material ?? "none").toLowerCase(),
      traits: splitTraits(traitLine),
      price,
      quantity: 1,
      state: "carried",
      description: "",
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

for (const [name, bonus, hardness, load, price, note] of roster.shields ?? []) {
  item("equipment", {
    key: `shield:${slugify(name)}`,
    name,
    type: "shield",
    folder: equipFolders.shields,
    system: {
      bonus,
      hardness,
      load,
      cover: /cover/i.test(note ?? ""),
      price,
      quantity: 1,
      state: "carried",
      traits: [],
      description: note ? `<p>${note}</p>` : "",
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

const actionFolders = {};
let actionSort = 0;
for (const [category, rows] of Object.entries(roster.actions ?? {})) {
  const folderId = (actionFolders[category] ??= folder("actions", category, { sort: actionSort++, color: "#3b2f63" }));
  for (const [name, traitLine, description] of rows) {
    item("actions", {
      key: `action:${slugify(name)}`,
      name: actionName(name),
      type: "action",
      folder: folderId,
      system: {
        ...parseActionCost(name),
        category,
        traits: splitTraits(traitLine),
        description: `<p>${description}</p>`,
        source: "STARWROUGHT Playtest v3.1"
      }
    });
  }
}

const explorationFolder = folder("actions", "Exploration Mode", { sort: 90, color: "#2f5a3f" });
for (const [name, speed, description] of roster.explorationActions ?? []) {
  item("actions", {
    key: `exploration:${slugify(name)}`,
    name,
    type: "action",
    folder: explorationFolder,
    system: {
      cost: "0",
      category: "Exploration Mode",
      requirements: `Travel Speed: ${speed}`,
      traits: [],
      description: `<p>${description}</p>`,
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

const downtimeFolder = folder("actions", "Downtime Mode", { sort: 91, color: "#2f5a3f" });
for (const [name, time, description] of roster.downtimeActions ?? []) {
  item("actions", {
    key: `downtime:${slugify(name)}`,
    name,
    type: "action",
    folder: downtimeFolder,
    system: {
      cost: "0",
      category: "Downtime Mode",
      requirements: time,
      traits: [],
      description: `<p>${description}</p>`,
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

const postureFolder = folder("actions", "Postures", { sort: 92, color: "#5a2f4a" });
for (const [name, defense, description] of roster.postures ?? []) {
  item("actions", {
    key: `posture:${slugify(name)}`,
    name: stripGlyphs(name),
    type: "action",
    folder: postureFolder,
    system: {
      cost: "reaction",
      category: "Posture",
      trigger: "You are attacked, before you know whether the attack was successful.",
      check: { enabled: false, constellation: slugify(defense), defense: defense.toLowerCase() },
      traits: ["Reaction"],
      description: `<p>${description}</p>`,
      source: "STARWROUGHT Playtest v3.1"
    }
  });
}

/* -------------------------------------------- */
/*  Rules reference journal                     */
/* -------------------------------------------- */

/** Render a table from an array of rows. */
function table(headers, rows) {
  const head = headers.map(h => `<th>${h}</th>`).join("");
  const body = rows.map(row => `<tr>${row.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const journalPages = [
  ["Key Terms: Talent Points", table(
    ["Type", "May be spent on", "Flare required?"], roster.talentPointTypes ?? [])],
  ["Character Creation", table(
    ["Step", "You choose", "You get", "Talent Points"], roster.chargenSteps ?? [])],
  ["Skills", table(["Skill", "Key Attribute", "Covers"], roster.skillRoster ?? [])],
  ["Combat Styles", table(["Style", "Key Attribute", "How you wield"], roster.weaponStyles ?? [])],
  ["Defenses", table(
    ["Defense", "Key Attribute", "In a word", "Physical", "Mental"], roster.defenses ?? [])],
  ["Zones and Critical Hits", table(
    ["Zone", "Critical Hit", "Critical Hit on an Exposed Zone"],
    (roster.zones ?? []).map(([z, a, b]) => [z, a, b]))],
  ["Damage: order of operations", table(["Step", "Do this"], roster.damageOrder ?? [])],
  ["Protection: finding a Zone's number", table(["Step", "Do this"], roster.protectionSteps ?? [])],
  ["Conditions", table(["Condition", "Effect"], roster.conditions ?? [])],
  ["Weapon Traits", table(["Trait", "Effect"], roster.weaponTraits ?? [])],
  ["Armor Traits", table(["Trait", "Effect"], roster.armorTraits ?? [])],
  ["Action Traits", table(["Trait", "Effect"], roster.actionTraits ?? [])],
  ["Weapon Handling", table(["Handling", "Meaning", "If you lack Familiarity"], roster.handling ?? [])],
  ["Armor Materials", table(
    ["Material", "Turns this damage type poorly"],
    (roster.materials ?? []).map(([m, w]) => [m, w]))],
  ["Size, Space and Reach", table(
    ["Size", "Space", "Natural Reach", "Evade and Guard"], roster.sizes ?? [])],
  ["Detection", table(["State", "What your foe knows", "Effect", "Examples"], roster.detection ?? [])],
  ["Light", table(["If a creature is in", "Effect on you"], roster.light ?? [])],
  ["Cover", table(["Zones covered", "Grade", "Effect"], roster.cover ?? [])],
  ["Recovery Checks", table(["Result", "Effect"], roster.recovery ?? [])],
  ["Languages", table(
    ["Language", "Rarity", "Notes"], languages.map(l => [l.name, l.rarity, l.desc]))]
];

{
  const _id = docId("rules", "journal:reference");
  push("rules", "journal", {
    _id,
    name: "STARWROUGHT Reference",
    folder: null,
    sort: 0,
    ownership: { default: 2 },
    flags: {},
    categories: [],
    _stats: { systemId: "starwrought" },
    pages: journalPages.map(([title, html], index) => {
      const pageId = docId("rules", `page:${title}`);
      return {
        _id: pageId,
        _key: `!journal.pages!${_id}.${pageId}`,
        name: title,
        type: "text",
        title: { show: true, level: 1 },
        text: { format: 1, content: html },
        image: {},
        video: { controls: true, volume: 0.5 },
        src: null,
        system: {},
        sort: index * 100,
        ownership: { default: -1 },
        flags: {},
        category: null
      };
    })
  });
}

/* -------------------------------------------- */
/*  Macros                                      */
/* -------------------------------------------- */

const MACROS = [
  {
    name: "Recenter",
    img: "icons/svg/shield.svg",
    command: `// Recenter: clear every Exposed Zone on the selected tokens.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
if ( !actors.length ) ui.notifications.warn("Select a token first.");
for ( const actor of actors ) await actor.recenter();`
  },
  {
    name: "Recovery Check",
    img: "icons/svg/heal.svg",
    command: `// A Recovery check: Endure against 10 + your level + your Dying value.
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if ( !actor ) ui.notifications.warn("Select a token, or set a player character.");
else await actor.rollRecovery();`
  },
  {
    name: "A Night's Rest",
    img: "icons/svg/regen.svg",
    command: `// Restore level x Presence Hit Points, and clear Wounded.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
const targets = actors.length ? actors : (game.user.character ? [game.user.character] : []);
if ( !targets.length ) ui.notifications.warn("Select a token first.");
for ( const actor of targets ) await actor.restForTheNight();`
  },
  {
    name: "Roll Initiative by Activity",
    img: "icons/svg/eye.svg",
    command: `// Initiative is whatever you were already doing.
const combat = game.combat;
if ( !combat ) return ui.notifications.warn("No encounter is running.");
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
const combatant = actor ? combat.getCombatantsByActor(actor)[0] : null;
if ( !combatant ) return ui.notifications.warn("That character is not in the encounter.");
const choices = Object.fromEntries(Object.values(actor.system.constellations)
  .sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.slug, c.name]));
const slug = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Initiative" },
  content: \`<p>What were you actually doing?</p>
    <select name="slug">\${Object.entries(choices).map(([k, v]) =>
      \`<option value="\${k}">\${v}</option>\`).join("")}</select>\`,
  ok: { callback: (event, button) => button.form.elements.slug.value }
});
if ( slug ) await combat.rollInitiativeWithCheck(combatant.id, slug);`
  }
];

for (const macro of MACROS) {
  const _id = docId("macros", `macro:${macro.name}`);
  push("macros", "macros", {
    _id,
    name: macro.name,
    type: "script",
    author: null,
    img: macro.img,
    scope: "global",
    command: macro.command,
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: { systemId: "starwrought" }
  });
}

/* -------------------------------------------- */
/*  Write everything out                        */
/* -------------------------------------------- */

function writeSources() {
  fs.rmSync(SOURCE, { recursive: true, force: true });
  let count = 0;
  for (const [pack, docs] of Object.entries(packs)) {
    const dir = path.join(SOURCE, pack);
    fs.mkdirSync(dir, { recursive: true });
    for (const doc of docs) {
      const prefix = doc._key.startsWith("!folders") ? "folder_" : "";
      const file = `${prefix}${slugify(doc.name) || doc._id}_${doc._id}.json`;
      fs.writeFileSync(path.join(dir, file), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      count += 1;
    }
    console.log(`  ${pack.padEnd(16)} ${docs.length} documents`);
  }
  return count;
}

function writeContentIndex() {
  fs.mkdirSync(CONTENT, { recursive: true });
  constellationIndex.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(
    path.join(CONTENT, "constellations.json"),
    `${JSON.stringify(constellationIndex, null, 2)}\n`,
    "utf8"
  );

  // Carry the handbook version into the system, so the rules it implements can be read in game
  // rather than inferred from the system's own version number.
  const syncPath = path.join(ROOT, "data", "SYNC.json");
  if (fs.existsSync(syncPath)) {
    const sync = JSON.parse(fs.readFileSync(syncPath, "utf8"));
    fs.writeFileSync(path.join(CONTENT, "sync.json"), `${JSON.stringify({
      phb: sync.phb,
      syncedOn: sync.syncedOn,
      constellations: constellationIndex.length,
      talents: (packs.talents ?? []).filter(d => d._key.startsWith("!items")).length
    }, null, 2)}\n`, "utf8");
  }
}

function copyArt() {
  const dest = path.join(SYSTEM, "assets", "constellations");
  fs.mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const file of plates) {
    if (!file.endsWith(".png")) continue;
    fs.copyFileSync(path.join(plateDir, file), path.join(dest, file));
    copied += 1;
  }
  const banner = path.join(ROOT, "assets", "cover_banner.png");
  if (fs.existsSync(banner)) {
    fs.copyFileSync(banner, path.join(SYSTEM, "assets", "cover_banner.png"));
  }
  return copied;
}

async function compile() {
  let compilePack;
  try {
    ({ compilePack } = await import("@foundryvtt/foundryvtt-cli"));
  } catch {
    console.log("\n  @foundryvtt/foundryvtt-cli is not installed, so the packs were not compiled.");
    console.log("  Run: npm install --save-dev @foundryvtt/foundryvtt-cli");
    return false;
  }
  // Foundry holds a lock on every LevelDB pack in a world it has open, and a half-deleted pack is
  // worse than an uncompiled one. So move the old pack aside first: a directory with open files
  // will not rename, which makes this the check and the backup in one move.
  const staged = [];
  for (const pack of Object.keys(packs)) {
    const dest = path.join(SYSTEM, "packs", pack);
    const aside = `${dest}.replacing`;
    try {
      fs.rmSync(aside, { recursive: true, force: true });
      if (fs.existsSync(dest)) fs.renameSync(dest, aside);
    } catch (error) {
      const locked = /LOCK|EBUSY|EPERM|resource temporarily unavailable/i.test(String(error?.message));
      console.error(`\n  Could not replace packs/${pack}: ${error.message}`);
      if (locked) console.error("  Foundry has these compendia open. Close Foundry and run this again.");
      console.error("  Nothing was changed under packs/, and packs/_source is written and current.");
      for (const [restore, from] of staged) fs.renameSync(from, restore);
      return false;
    }
    staged.push([dest, aside]);
  }

  for (const pack of Object.keys(packs)) {
    const dest = path.join(SYSTEM, "packs", pack);
    await compilePack(path.join(SOURCE, pack), dest);
    console.log(`  compiled packs/${pack}`);
  }
  for (const [, aside] of staged) fs.rmSync(aside, { recursive: true, force: true });
  return true;
}

/* -------------------------------------------- */

console.log("STARWROUGHT -> Foundry VTT");
console.log(`  system: ${path.relative(ROOT, SYSTEM)}`);
const total = writeSources();
writeContentIndex();
const art = copyArt();
console.log(`  ${total} documents written, ${constellationIndex.length} Constellations indexed, ${art} plates copied.`);

let compiled = null;
if (!process.argv.includes("--no-compile")) compiled = await compile();

if (compiled === false) {
  console.log("\nSources are current; the compendia were left alone.");
  process.exitCode = 1;
} else {
  console.log("Done.");
}
