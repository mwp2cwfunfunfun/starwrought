#!/usr/bin/env node
/**
 * build_foundry.js
 *
 * assets/trees.json + assets/roster.json + assets/backgrounds.json + assets/languages.json
 *   + assets/actions.json and assets/equipment.json when the converter has written them
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
 * Foundry is the play surface and ships only what the spreadsheets mark `Enabled? = Yes` (Mike,
 * 2026-10-01; ruling 61). The converter drops nothing: every talent, tree, background and action in
 * the JSON carries `enabled: true|false`, and this build writes a compendium document only for the
 * enabled ones. The web app, the compendium docx and the plates are authoring views of the whole
 * book and do not read the flag. Because the ids are hashes, enabling a row later restores the
 * same UUID, so nothing already on a character sheet is orphaned by a round trip through disabled.
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
import {
  slugify, parseActionCost, DEFENSES, ACTIVITY_SPEEDS, EXPLORATION_EFFECTS, ACTIVITY_CHOICE
} from "../foundry/starwrought/module/config.mjs";

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

/**
 * The `Enabled?` gate (ruling 61). The converter writes `enabled: true|false` on every node, tree,
 * background, action and equipment row; only an explicit `false` turns a row off here, so JSON from
 * before the column existed, or a sheet that has not been curated yet, still ships everything.
 */
const isEnabled = row => row?.enabled !== false;

/** Enabled-versus-authored tallies for the build summary and content/sync.json. */
const tally = {
  constellations: { enabled: 0, total: 0 },
  talents: { enabled: 0, total: 0 },
  chassis: { enabled: 0, total: 0 },
  sheetActions: { enabled: 0, total: 0 },
  equipment: { enabled: 0, total: 0 }
};
function count(kind, enabled) {
  tally[kind].total += 1;
  if (enabled) tally[kind].enabled += 1;
  return enabled;
}

/** A stable 16-character document id. */
function docId(pack, key) {
  return crypto.createHash("sha1").update(`starwrought|${pack}|${key}`).digest("hex").slice(0, 16);
}

/**
 * Strip the action glyphs from a Talent or Maneuver name for matching and slugs: the v4.10
 * ⓿ ❶ ❷ ❸ ❹ ❺ ❻ and ↺, a bracketed Reaction cost such as "(⓿↺)", the v3 ◆ and ◇, and the
 * capstone star. Slugs come from the bare name, so a glyph change never moves a document id.
 */
const stripGlyphs = name => String(name)
  .replace(/\(\s*[◆◇↺★⓿❶❷❸❹❺❻\s]*\)/g, "")
  .replace(/[◆◇↺★⓿❶❷❸❹❺❻]/g, "")
  .trim();

/**
 * The plain name of a Maneuver, with the cost glyphs and the connective that joined them removed.
 * "Strike ❶ to ❸" is the Maneuver Strike; "Disarm ❶ or ❸" is Disarm; "Aid ❶ (⓿↺)" is Aid. The
 * cost itself is parsed separately by parseActionCost, so nothing is lost here.
 */
function actionName(name) {
  const bare = stripGlyphs(name)
    .replace(/\s+(to|or)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return bare || String(name).trim();
}

/**
 * The aura of a Talent or Maneuver (0.5.1), as the converter wrote it from the Aura column: feet
 * around the carrier, who it concerns, and whether it is Visible by default. Only a row with the
 * cell set carries one; the Item model supplies "none" for every other, so the sources stay small.
 */
const auraOf = row => (row.aura ? {
  aura: {
    range: Number.isInteger(row.aura.range) ? row.aura.range : null,
    affects: row.aura.affects ?? "all",
    visible: !!row.aura.visible
  }
} : {});

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
  // A child of Melee or Ranged (v4.10): its Talents count toward the parent's rank as well.
  const parent = tree.parent ? slugify(tree.parent) : "";
  // A Constellation exists in play when its Root does: the converter sets the tree's flag from
  // its root talent (ruling 60), and the Constellation document ships only when that is on.
  const treeEnabled = count("constellations", isEnabled(tree));

  if (treeEnabled) item("constellations", {
    key: `constellation:${slug}`,
    name,
    type: "constellation",
    img: plate ?? ICON.constellation,
    system: {
      slug,
      category,
      attribute,
      // `parent` is the owning Item on a data model, so the field is parentSlug; the registry
      // entry in content/constellations.json keeps the plain name.
      parentSlug: parent,
      meta: tree.meta ?? "",
      flareTrigger: tree.sparks ?? "",
      identity: ["Ancestry", "Culture", "Bloodline", "Heritage"].includes(tree.category),
      description: tree.meta ? `<p>${tree.meta}</p>` : "",
      traits: [],
      source: "STARWROUGHT Playtest v4.10"
    }
  });

  // The runtime index keeps EVERY Constellation, disabled ones included, so a character who already
  // owns a Talent of a Constellation that has since been turned off still resolves its name,
  // category, attribute and parent. `enabled` is what the runtime filters its pickers on.
  constellationIndex.push({ slug, name, category, attribute, parent, img: plate ?? ICON.constellation, enabled: treeEnabled });

  // One folder per Constellation keeps 170 Talents navigable in the sidebar. A Constellation that
  // ships no Talent gets no folder, so the sidebar shows nothing it cannot open.
  const shipped = tree.nodes.filter(node => count("talents", isEnabled(node)));
  const folderId = shipped.length ? folder("talents", name, { color: "#3b2f63" }) : null;

  for (const node of shipped) {
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
        ...auraOf(node),
        traits: [],
        source: "STARWROUGHT Playtest v4.10"
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

// Which chassis ship (ruling 61): an Ancestry, Culture or Calling when the Constellation of that
// name is enabled (the converter also copies the ancestry tree's flag onto the roster block, so
// both are checked); a Bloodline on its own root talent's flag, since the two Human bloodlines are
// curated separately from Humanity; a Background on its own flag. The folders always ship, so an
// empty step in chargen still has somewhere to say that nothing is enabled.
const ancestryTree = ancestry => trees[ancestry.tree ?? ancestry.name];

// Every chassis, enabled or not, for content/chassis.json: a character stores the names it chose
// at creation, not the Items, and the sheet explains a locked name from this index when the pack
// does not carry it (a Background or Calling switched off after the character was made, or never
// enabled at all). The pack holds only the enabled ones; the index is the whole book.
const chassisIndex = [];
function chassis(enabled, doc) {
  chassisIndex.push({ name: doc.name, img: doc.img ?? ICON.chassis, enabled, system: doc.system });
  if (count("chassis", enabled)) item("chassis", doc);
}

function bloodlineEnabled(ancestry, bloodName) {
  const want = stripGlyphs(bloodName).toLowerCase();
  const root = (ancestryTree(ancestry)?.nodes ?? []).find(n => n.hroot && stripGlyphs(n.name).toLowerCase() === want);
  // A bloodline row with no hroot talent of that name is a roster-versus-sheet mismatch the
  // converter does not police here; it follows its ancestry rather than vanishing on a typo.
  return root ? isEnabled(root) : isEnabled(ancestryTree(ancestry));
}

for (const ancestry of roster.ancestries ?? []) {
  const treeSlug = slugify(ancestry.tree ?? ancestry.name);
  chassis(isEnabled(ancestry) && isEnabled(ancestryTree(ancestry)), {
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
      vigor: ancestry.vigor ?? ancestry.hp ?? 0,
      size: String(ancestry.size ?? "Medium").toLowerCase(),
      speed: parseReach(ancestry.speed),
      senses: ancestry.senses === "—" ? "" : (ancestry.senses ?? ""),
      description: `<p>${ancestry.blurb ?? ""}</p>`,
      traits: [],
      source: "STARWROUGHT Playtest v4.10"
    }
  });

  for (const [bloodName, effect] of ancestry.bloodlines ?? []) {
    chassis(bloodlineEnabled(ancestry, bloodName), {
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
        source: "STARWROUGHT Playtest v4.10"
      }
    });
  }
}

for (const [name, langs, attribute, blurb] of roster.cultures ?? []) {
  chassis(isEnabled(trees[name]), {
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
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

for (const background of backgrounds) {
  chassis(isEnabled(background), {
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
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

for (const [name, training, hp, attribute, ability] of roster.callings ?? []) {
  chassis(isEnabled(trees[name]), {
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
      vigor: hp,
      grants: [training],
      specialAbility: `<p>${ability}</p>`,
      description: `<p>Grants Training in ${training}, and ${hp} Opening Vigor, added once if it is your first Calling.</p>`,
      traits: [],
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

/* -------------------------------------------- */
/*  Equipment                                   */
/* -------------------------------------------- */

// data/equipment.xlsx is authoritative for weapons, armor and shields (Mike, 2026-10-01; ruling 64).
// The converter writes assets/equipment.json from it, every row carrying `enabled`, and regenerates
// the roster's weaponsMelee, weaponsRanged, armorPieces and shields blocks from the same rows for the
// authoring views (the ancestries precedent). This build reads the JSON when it is there and writes
// a document for each enabled row alone (ruling 61). A checkout without the workbook has no JSON,
// and then the roster blocks build the pack as they did before the sheet existed, every row
// shipping, because hand-kept roster JSON carries no flag (the actions precedent: roster rows
// always ship).
//
// Whichever source is read, a document is keyed `weapon:<slug>`, `armor:<slug>` or `shield:<slug>`
// of its name, exactly as the roster loops keyed it, so the sheet moves no id and orphans no owned
// Item's UUID, and a row disabled today restores the same document when it is enabled again.
const equipmentPath = path.join(ROOT, "assets", "equipment.json");
const equipment = fs.existsSync(equipmentPath) ? read("equipment.json") : null;
const equipmentSource = equipment ? "data/equipment.xlsx" : "STARWROUGHT Playtest v4.10";

// The roster blocks read into the sheet's row shape, so one builder per type serves both sources.
// The ranged block has no price column, and neither does the book's Ranged Weapons table, so a
// ranged weapon's price is blank from either source; the sheet's Price column is filled only for
// melee weapons (Unarmed Strike excepted), and priceOf turns the blank into "".
const rosterEquipment = {
  weapons: [
    ...(roster.weaponsMelee ?? []).map(([name, handling, group, damage, reach, traits, price]) =>
      ({ name, kind: "Melee", handling, group, damage, reach, traits, price, enabled: true })),
    ...(roster.weaponsRanged ?? []).map(([name, handling, group, damage, range, traits]) =>
      ({ name, kind: "Ranged", handling, group, damage, range, traits, enabled: true }))
  ],
  armor: (roster.armorPieces ?? []).map(([name, zone, protection, load, price, traits, material]) =>
    ({ name, zone, protection, load, price, traits, material, enabled: true })),
  shields: (roster.shields ?? []).map(([name, bonus, hardness, load, price, note]) =>
    ({ name, bonus, hardness, load, price, note, enabled: true }))
};
// The JSON, once present, is the whole truth: a block it lacks is an empty block, not a reason to
// read the roster for that type, so a sheet that drops every shield ships no shield.
const equipmentRows = type => (equipment ? equipment[type] : rosterEquipment[type]) ?? [];

/** A printed price, or blank: the tables mark a free or priceless row with a dash. */
const priceOf = price => (price == null || price === "—" || price === "-") ? "" : String(price);

/** A whole number from either source; a blank cell reads as 0. */
const whole = value => Number(value ?? 0) || 0;

// The four folders always ship, so the sidebar has a place to say nothing is enabled under them.
const equipFolders = {
  melee: folder("equipment", "Melee Weapons", { sort: 0, color: "#5a2f2f" }),
  ranged: folder("equipment", "Ranged Weapons", { sort: 1, color: "#5a2f2f" }),
  armor: folder("equipment", "Armor", { sort: 2, color: "#2f4a5a" }),
  shields: folder("equipment", "Shields", { sort: 3, color: "#2f4a5a" })
};

for (const row of equipmentRows("weapons")) {
  if (!count("equipment", isEnabled(row))) continue;
  const ranged = /^ranged$/i.test(String(row.kind ?? "").trim());
  item("equipment", {
    key: `weapon:${slugify(row.name)}`,
    name: row.name,
    type: "weapon",
    folder: ranged ? equipFolders.ranged : equipFolders.melee,
    system: {
      handling: String(row.handling ?? "").toLowerCase(),
      group: row.group ?? "",
      damage: parseDamage(row.damage),
      // A ranged weapon's Range lives in its Ranged N trait, which is where the system reads it; its
      // reach is 0 whatever the sheet's Range or Reach cell says.
      reach: ranged ? 0 : parseReach(row.reach),
      traits: splitTraits(row.traits),
      price: priceOf(row.price),
      quantity: 1,
      load: 0,
      state: "carried",
      // The sheet's Notes column (Unarmed Strike's "Varies; typically" remark) is the only prose a
      // weapon row has; the roster never carried any.
      description: row.notes ? `<p>${row.notes}</p>` : "",
      source: equipmentSource
    }
  });
}

for (const row of equipmentRows("armor")) {
  if (!count("equipment", isEnabled(row))) continue;
  item("equipment", {
    key: `armor:${slugify(row.name)}`,
    name: row.name,
    type: "armor",
    folder: equipFolders.armor,
    system: {
      zone: String(row.zone ?? "").toLowerCase(),
      protection: whole(row.protection),
      load: whole(row.load),
      // The converter fills a blank Material from the first trait, so the sheet always names one;
      // "none" is only for a roster row that never had the column.
      material: String(row.material ?? "none").toLowerCase(),
      traits: splitTraits(row.traits),
      price: priceOf(row.price),
      quantity: 1,
      state: "carried",
      description: "",
      source: equipmentSource
    }
  });
}

for (const row of equipmentRows("shields")) {
  if (!count("equipment", isEnabled(row))) continue;
  // The Tower Shield's Note is the book's footnote, and it is what makes the shield grant Cover.
  const note = String(row.note ?? "").trim();
  item("equipment", {
    key: `shield:${slugify(row.name)}`,
    name: row.name,
    type: "shield",
    folder: equipFolders.shields,
    system: {
      bonus: whole(row.bonus),
      hardness: whole(row.hardness),
      load: whole(row.load),
      cover: /cover/i.test(note),
      price: priceOf(row.price),
      quantity: 1,
      state: "carried",
      traits: [],
      description: note ? `<p>${note}</p>` : "",
      source: equipmentSource
    }
  });
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

// data/actions.xlsx is authoritative for any action it names (Mike, 2026-09-26). A roster row of
// the same name is retired, so Aid written in the sheet replaces Aid printed in the roster under
// the same document id, and a character who already has Aid keeps a working link. Rows the sheet
// does not carry yet stay, so nothing vanishes until the sheet has it. The sheet's Basic Actions
// and the roster's Encounter Mode rows are flagged `basic`, which is what puts them on every
// character's Actions tab without a copy being made.
//
// The sheet stays authoritative when its row is disabled (ruling 61): a sheet action marked anything
// but `Enabled? = Yes` is not written, AND it still retires the roster row of the same name, so the
// action ships nowhere until Mike enables it. The build names those rows so the gap is deliberate
// rather than a surprise; the roster rows themselves (Encounter, Exploration, Downtime, Reactions)
// are hand-kept JSON and always ship.
const actionsPath = path.join(ROOT, "assets", "actions.json");
const sheetActions = fs.existsSync(actionsPath) ? (read("actions.json").actions ?? []) : [];
/** The workbook that wrote a sheet action, as the Item's Source line; a pre-0.5.1 actions.json carried no stamp and was actions.xlsx alone. */
const actionSource = a => a.workbook ? `data/${a.workbook}` : "data/actions.xlsx";
const fromSheet = new Set(sheetActions.map(a => a.name.toLowerCase()));
const disabledOnSheet = new Set(sheetActions.filter(a => !isEnabled(a)).map(a => a.name.toLowerCase()));
const retired = [];
const retiredByDisabled = [];
function supersededBySheet(name) {
  const bare = actionName(name);
  if (!fromSheet.has(bare.toLowerCase())) return false;
  retired.push(bare);
  if (disabledOnSheet.has(bare.toLowerCase())) retiredByDisabled.push(bare);
  return true;
}

/**
 * Blank-line separated prose in a cell becomes paragraphs; single line breaks stay breaks. An
 * inline tag the converter wrapped around a run that spans a blank line is closed at the end of
 * each paragraph and reopened at the start of the next, so the HTML stays well formed, and a
 * segment with no text (a leading or trailing blank line) produces no paragraph.
 */
function paragraphs(html) {
  const text = String(html ?? "").trim();
  if (!text) return "";
  const out = [];
  let open = [];
  for (const segment of text.split(/(?:\s*<br\s*\/?>\s*){2,}/)) {
    const body = segment.trim();
    const after = openTags(open, body);
    if (body.replace(/<[^>]+>/g, "").trim()) {
      const closers = [...after].reverse().map(tag => `</${tag.match(/^<(\w+)/)[1]}>`).join("");
      out.push(`<p>${open.join("")}${body}${closers}</p>`);
    }
    open = after;
  }
  return out.join("");
}

/** The inline tags still open after a fragment, given those open before it. */
function openTags(before, fragment) {
  const stack = [...before];
  for (const m of fragment.matchAll(/<(\/?)(b|i|u|s|span)\b[^>]*>/g)) {
    if (!m[1]) { stack.push(m[0]); continue; }
    const i = stack.map(t => t.match(/^<(\w+)/)[1]).lastIndexOf(m[2]);
    if (i >= 0) stack.splice(i, 1);
  }
  return stack;
}

// A roster row is keyed on its printed name and its mode ("Strike ◆ to ◆◆◆" slugs to strike-to,
// Search lives under exploration:), and that key is the compendium UUID already sitting in macros,
// chat cards and journal links. A sheet action that takes a roster row over inherits the row's key
// rather than deriving one from its bare name, so the document id really is unchanged.
const rosterKey = new Map();
function inherit(name, key) {
  const bare = actionName(name).toLowerCase();
  if (rosterKey.has(bare)) console.warn(`  two roster actions are named "${bare}"; the sheet inherits ${rosterKey.get(bare)}`);
  else rosterKey.set(bare, key);
}
for (const rows of Object.values(roster.actions ?? {})) for (const [name] of rows) inherit(name, `action:${slugify(name)}`);
for (const [name] of roster.explorationActions ?? []) inherit(name, `exploration:${slugify(name)}`);
for (const [name] of roster.downtimeActions ?? []) inherit(name, `downtime:${slugify(name)}`);
// The roster's `postures` block is the Reaction table now (Parry, Void, Counter, Intercept, and the
// Talent-granted Postures). The four named Reactions are also Defense & Recovery Maneuvers, and
// the Maneuver row is the one that ships; a Reaction row of the same name is skipped, not doubled.
const encounterNames = new Set(
  Object.values(roster.actions ?? {}).flat().map(([name]) => actionName(name).toLowerCase())
);
for (const [name] of roster.postures ?? []) {
  if (encounterNames.has(actionName(name).toLowerCase())) continue;
  inherit(name, `posture:${slugify(name)}`);
}

// Only enabled sheet actions are written, and a sheet type folder only when one of its actions
// ships; a roster category of the same name still claims the folder below with `??=`.
const shippedSheetActions = sheetActions.filter(a => count("sheetActions", isEnabled(a)));
const actionFolders = {};
let actionSort = 0;
// A sheet action's group is the sheet it sits on (the book's Motion, Attack, Defense & Recovery
// and so on in data/maneuvers.xlsx), falling back to its Type for a workbook with no such
// grouping; the `basic` flag still reads the Type. So the Maneuvers tab and the pack keep the
// book's groups rather than one "Basic Action" heap (review, 2026-10-01).
const actionGroup = a => a.sheet || a.type;
for (const group of [...new Set(shippedSheetActions.map(actionGroup))]) {
  actionFolders[group] = folder("actions", group, { sort: actionSort++, color: "#5a4a1e" });
}
for (const a of shippedSheetActions) {
  item("actions", {
    key: rosterKey.get(a.name.toLowerCase()) ?? `action:${slugify(a.name)}`,
    name: a.name,
    type: "action",
    folder: actionFolders[actionGroup(a)],
    system: {
      cost: a.cost,
      costMax: a.costMax ?? "",
      costMode: a.costMode ?? "to",
      reaction: a.reaction ?? false,
      reactionCost: a.reactionCost ?? "",
      category: actionGroup(a),
      basic: /^basic\b/i.test(a.type),
      traits: a.traits ?? [],
      prerequisites: a.prerequisites ?? "",
      requirements: a.requirements ?? "",
      trigger: a.trigger ?? "",
      description: a.description ? `<p>${a.description}</p>` : "",
      effect: paragraphs(a.effect),
      automation: a.automation ?? "",
      ...auraOf(a),
      source: actionSource(a)
    }
  });
}

for (const [category, rows] of Object.entries(roster.actions ?? {})) {
  const folderId = (actionFolders[category] ??= folder("actions", category, { sort: actionSort++, color: "#3b2f63" }));
  for (const [name, traitLine, description] of rows) {
    if (supersededBySheet(name)) continue;
    item("actions", {
      key: `action:${slugify(name)}`,
      name: actionName(name),
      type: "action",
      folder: folderId,
      system: {
        ...parseActionCost(name),
        category,
        basic: true,
        traits: splitTraits(traitLine),
        description: `<p>${description}</p>`,
        source: "STARWROUGHT Playtest v4.10"
      }
    });
  }
}

/**
 * A content error the build must not paper over: say it and stop. Every document is queued in
 * memory until writeSources() runs at the end, so a build that fails here leaves packs/_source and
 * the compendia exactly as they were.
 */
function fail(message) {
  console.error(`\n  ${message}`);
  process.exit(1);
}

/**
 * The Constellations an Activity column may name (0.7.2, ruling 104): every tree in trees.json and
 * the four Defenses, by name as the trees print them, case blind. The four Defenses are trees too,
 * and their lowercased names are their slugs, so the second loop is the brief's belt to the first
 * loop's braces. Lore is a template and its instances are the character's own, so a column cannot
 * name one; ACTIVITY_CHOICE covers Investigate's pick.
 */
const activityConstellations = new Map();
for (const treeName of Object.keys(trees)) {
  const slug = slugify(treeName);
  if (slug === "lore") continue; // the template: no character rolls it, so no column may name it
  activityConstellations.set(treeName.trim().toLowerCase(), slug);
}
for (const slug of Object.keys(DEFENSES)) activityConstellations.set(slug, slug);

/**
 * One Activity column: "" as is, `choice` as is (written as the constant, whatever its case), else
 * the slug of the named Constellation. A name that is neither is an authoring error and stops the
 * build, because a slug nobody can roll would ship as a silent Awareness.
 * @param {string} cell      The roster cell.
 * @param {string} activity  The row's name, for the message.
 * @param {string} column    Which column, for the message.
 * @returns {string}
 */
function activityConstellation(cell, activity, column) {
  const text = String(cell ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === ACTIVITY_CHOICE) return ACTIVITY_CHOICE;
  const slug = activityConstellations.get(text.toLowerCase());
  if (!slug) {
    fail(`roster.json explorationActions: "${activity}" names "${text}" for ${column}, which is neither a `
      + `Constellation in trees.json nor a Defense (nor "${ACTIVITY_CHOICE}"; a Lore is the member's own pick, `
      + `so write "${ACTIVITY_CHOICE}" for one).`);
  }
  return slug;
}

// The Exploration Mode Activities (PHB v4.15, Table 95), from the roster's hand-kept rows. Since
// 0.7.2 (party-sheet-plan.md, part 8; ruling 104) each row carries two more positional columns:
// the Constellation the Activity rolls NOW (Search's Awareness, Look Harmless's Guile) and the one
// it rolls for INITIATIVE (Hustle's Athletics, Avoid Notice's Stealth), each a name, blank, or
// `choice` for the member's own pick (Investigate's relevant Lore or Skill). They land on the Item
// as `system.exploration` and, for a named check-now Constellation, `system.check`, so the Party
// Sheet reads the Activity from the Item and never from a table of its own (the plan's risk 9).
// The Scout's bonus and Step and the Defender's shield are `effect` tags set by the row's name,
// not Constellations, so a row Mike adds ships here with no code unless it does something new.
// The key and the name are as they were, so the ids do not move (an id is a compendium UUID the
// moment an Activity lands on a sheet), and neither does the Source line.
const explorationFolder = folder("actions", "Exploration Mode", { sort: 90, color: "#2f5a3f" });
for (const [name, speed, description, checkNow = "", initiative = ""] of roster.explorationActions ?? []) {
  if (supersededBySheet(name)) continue;
  const travel = String(speed ?? "").trim().toLowerCase();
  if (!ACTIVITY_SPEEDS[travel]) {
    fail(`roster.json explorationActions: "${name}" has Speed "${speed}"; it must be one of `
      + `${Object.keys(ACTIVITY_SPEEDS).map(k => k[0].toUpperCase() + k.slice(1)).join(", ")}.`);
  }
  const check = activityConstellation(checkNow, name, "the check it rolls now");
  const rolls = activityConstellation(initiative, name, "Initiative");
  const effectSlug = slugify(name);
  const effect = EXPLORATION_EFFECTS[effectSlug] ? effectSlug : "";
  // A named check-now Constellation is also the Item's own check (SwItem#roll rolls it), so an
  // owned copy of Search rolls Awareness from the sheet exactly as the Party Sheet's Roll does.
  // `choice` is not a Constellation and opens the Relevant Check picker instead (ruling 107).
  const named = check && (check !== ACTIVITY_CHOICE);
  item("actions", {
    key: `exploration:${slugify(name)}`,
    name,
    type: "action",
    folder: explorationFolder,
    system: {
      ...parseActionCost(name),
      category: "Exploration Mode",
      requirements: `Travel Speed: ${speed}`,
      traits: [],
      description: `<p>${description}</p>`,
      exploration: { travel, check, initiative: rolls, effect },
      ...(named ? { check: { enabled: true, constellation: check, defense: "" } } : {}),
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

const downtimeFolder = folder("actions", "Downtime Mode", { sort: 91, color: "#2f5a3f" });
for (const [name, time, description] of roster.downtimeActions ?? []) {
  if (supersededBySheet(name)) continue;
  item("actions", {
    key: `downtime:${slugify(name)}`,
    name,
    type: "action",
    folder: downtimeFolder,
    system: {
      ...parseActionCost(name),
      category: "Downtime Mode",
      requirements: time,
      traits: [],
      description: `<p>${description}</p>`,
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

// Reactions (PHB v4.10, Answering an Attack): the roster row's second column reads
// "<Granting Talent> • <Defense> +N Situation", or "A Zone" for a Posture. The Defense it names is
// the one the Reaction answers with; the cost comes from the glyphs in the name (Parry ❶↺, a
// Posture ⓿↺). The four Reactions that are also Maneuvers were written above and are skipped here.
const reactionFolder = folder("actions", "Reactions", { sort: 92, color: "#5a2f4a" });
for (const [name, grantedBy, description] of roster.postures ?? []) {
  if (supersededBySheet(name)) continue;
  if (encounterNames.has(actionName(name).toLowerCase())) continue;
  const defenseWord = (String(grantedBy).match(/•\s*(Awareness|Evade|Guard|Endure)\b/i)?.[1]
    ?? String(grantedBy).match(/^(Awareness|Evade|Guard|Endure)\b/i)?.[1]
    ?? "").toLowerCase();
  const cost = parseActionCost(name);
  item("actions", {
    key: `posture:${slugify(name)}`,
    name: actionName(name),
    type: "action",
    folder: reactionFolder,
    system: {
      ...cost,
      reaction: true,
      category: "Reaction",
      requirements: grantedBy,
      trigger: "You are attacked, before you know whether the attack was successful.",
      check: { enabled: false, constellation: defenseWord, defense: defenseWord },
      traits: ["Reaction"],
      description: `<p>${description}</p>`,
      source: "STARWROUGHT Playtest v4.10"
    }
  });
}

if (sheetActions.length) {
  console.log(`  ${shippedSheetActions.length} of ${sheetActions.length} action(s) from ${[...new Set(sheetActions.map(actionSource))].join(", ")} enabled`
    + (retired.length ? `; roster rows retired in their favour: ${retired.join(", ")}` : ""));
  // An action in this list is in neither the sheet's output nor the roster's: it is off the table
  // entirely until its sheet row reads Enabled? = Yes, and the sync report flags it for Mike.
  if (retiredByDisabled.length) console.log(`  retired by a disabled sheet row: ${retiredByDisabled.join(", ")}`);
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

/* The two pages the Bind and Exposed cards, the sheet's bind line, the Zones panel's EXPOSED badge
   and a condition's row open (system 0.5.1, T6). The rules prose is the handbook's, quoted
   (PHB v4.10, Chapter 2, 5. Position: Exposed; The Bind; Allies in the Exchange), with one change:
   the book writes a neutral Bind with a dash ("longsword, dash, spear") and the style rule allows
   no dash in shipping prose, so the notation is the slash the system draws on the map. The
   condition, Maneuver and Reaction rows are read from the roster so they cannot drift from the
   Conditions, Maneuvers and Reaction pages. */
const REFERENCE_ID = docId("rules", "journal:reference");
const pageLink = title =>
  `@UUID[Compendium.starwrought.rules.JournalEntry.${REFERENCE_ID}.JournalEntryPage.${docId("rules", `page:${title}`)}]{${title}}`;
const conditionRows = (...names) => names.map(n => (roster.conditions ?? []).find(r => r[0] === n)).filter(Boolean);
const actionRows = (...names) => {
  const all = Object.values(roster.actions ?? {}).flat();
  return names.map(n => all.find(r => r[0] === n)).filter(Boolean).map(([name, , effect]) => [name, effect]);
};
const reactionRows = (...names) => names.map(n => (roster.postures ?? []).find(r => r[0] === n)).filter(Boolean);

const exposedPage = [
  "<p>When a Zone becomes Exposed, a part of you is open for a focused attack:</p>",
  "<ul>",
  "<li>Its Protection counts as 0 against a Deliberate or Committed Strike. A Quick Strike gains nothing from it.</li>",
  "<li>An ordinary Hit from a Deliberate or Committed Strike may be placed there instead of the Torso.</li>",
  "<li>It stays Exposed until you Recenter ❶ (see Chapter 7: Rules Elements), except that a Zone Exposed by a Posture stays Exposed until the end of the round, and Recenter does not clear it.</li>",
  "<li>A Critical Hit on it with a Deliberate or Committed Strike Wounds it.</li>",
  "</ul>",
  "<p>When a Zone is Exposed, the following condition is placed on you: Exposed [Zone Name]. Zones become Exposed when your own Committed Strike is Stopped; when any Strike of yours Misses; when you take a Posture; when a foe Controls your weapon in a Bind; and through certain Talents and critical effects.</p>",
  "<h2>The condition</h2>",
  table(["Condition", "Effect"], conditionRows("Exposed [Zone]")),
  "<h2>Opening and closing a Zone</h2>",
  table(["Maneuver", "Effect"], actionRows("Recenter ❶")),
  table(["Reaction", "Grants", "Effect"], reactionRows("Posture ⓿↺", "Give Ground ⓿↺", "Set Your Feet ⓿↺")),
  `<p>What a Critical Hit does to each Zone, Exposed or not, is on ${pageLink("Zones and Critical Hits")}.</p>`,
  "<h2>In the system</h2>",
  "<p>Each Exposed Zone shows on the token as its own status (Exposed: Head, Exposed: Torso, Exposed: Arms, Exposed: Legs) and in the Zones panel of the sheet. Toggling the status on the token and toggling the Zone on the sheet are the same change. Recenter closes every Exposed Zone except one a Posture opened, and the statuses close with them.</p>"
].join("");

const bindPage = [
  "<p>When a rigid weapon or shield stops a melee weapon or natural attack, the two are in contact: a Bind. Track one relationship per implement, and name the two implements: longsword / spear, or shield > bite. A Bind is neutral (/) when neither fighter has the line, or Controlled (>) when one does. Only Guard can form a Bind, and only with a rigid weapon, a shield, or a natural weapon its profile allows. A bare hand or a Flexible weapon can Guard, but cannot Bind.</p>",
  "<p>A Bind forms when a Guard Stops an attack, or when a Gain Control action Grazes. Control is taken when a Parry Stops a Deliberate or Committed Strike, when a Guard answers a Miss, or when Gain Control succeeds. A Quick Strike is a probe: Stopped, it can be bound but never Controlled.</p>",
  "<h2>While you Control a weapon</h2>",
  "<ul>",
  "<li>Your partner has an Exposed Zone of your choice, and it stays Exposed while the Bind lasts.</li>",
  "<li>Your partner's attacks with the Controlled weapon take a −2 Situation penalty.</li>",
  "<li>You may Close ❶: Step toward your partner while keeping the Bind. The Controlled weapon cannot Intercept you.</li>",
  "<li>A Bind has one Controller at most. A new Control replaces the old.</li>",
  "</ul>",
  "<h2>How a Bind ends</h2>",
  "<p>A Bind ends when a Strike between the two actors resolves, when either partner Moves or Steps (Close excepted), when either actor Recenters, when the Controlling actor is attacked by a third party, or when either implement is dropped or Disarmed. Controlled is not Grappled or Restrained: you are redirecting a weapon, not holding a body. The Controlled actor may still Step, Move, or attack with something else, and attacking with an uncontrolled weapon or limb ends the Bind before the roll.</p>",
  "<p>Recenter ❶ clears every Exposed Zone on you (except one Exposed by a Posture) and ends any Bind you are in. Being Controlled costs you the same action that being Exposed does. That is the tempo price of a lost line, and it is the reason Gain Control is worth an action.</p>",
  "<p><strong>Size.</strong> An actor one Size larger or smaller Binds normally. Two or more Sizes apart, the smaller actor gains only momentary Control: it lasts until its first benefit is used or until the end of the Controller's next Opportunity, whichever comes first, and the larger creature Moves without first breaking the Bind. You can redirect a dragon's claw, but you cannot hold it.</p>",
  "<p><strong>What cannot Bind.</strong> Flexible weapons (whips and flails), bare hands without a Talent, areas, spells, and attacks with the Unparryable trait. Incorporeal and amorphous attackers offer nothing to bind. Measure, footwork, and commitment still apply to all of them.</p>",
  "<p><strong>Third parties.</strong> A Bind is between two implements. Your ally striking the opponent you Control does not break your Bind; that is the point of holding the line. An enemy striking you does.</p>",
  "<h2>The conditions</h2>",
  table(["Condition", "Effect"], conditionRows("Bound [X]", "Controlled [X]", "Controlling [X]")),
  "<h2>Maneuvers and Reactions in the Bind</h2>",
  table(["Maneuver", "Effect"], actionRows("Gain Control ❶", "Close ❶", "Recenter ❶")),
  table(["Reaction", "Grants", "Effect"], reactionRows("Parry ❶↺")),
  `<p>The Zone a Controller opens follows the rules on ${pageLink("Exposed")}.</p>`,
  "<h2>In the system</h2>",
  "<p>A Bind is recorded on both fighters and drawn on the map as a gold chain between their tokens, labelled with the two implements; a Controlled Bind runs from the Controller to the Controlled with an arrowhead and the word Control. The token carries Bound, Controlling or Controlled, and that effect names the partner, both implements and the state. The sheet's bind line and the Recenter Maneuver end it; a Strike between the two ends it when the Strike resolves.</p>"
].join("");

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
  ["Exposed", exposedPage],
  ["The Bind", bindPage],
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
  const _id = REFERENCE_ID;
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
    command: `// Recenter: clear every Exposed Zone on the selected tokens (a Posture's stays) and end any Bind.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
if ( !actors.length ) ui.notifications.warn("Select a token first.");
for ( const actor of actors ) await actor.recenter();`
  },
  {
    name: "Recovery Check",
    img: "icons/svg/heal.svg",
    command: `// A Recovery check: Endure against 10 + your Dying value + the Wounds you carry.
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if ( !actor ) ui.notifications.warn("Select a token, or set a player character.");
else await actor.rollRecovery();`
  },
  {
    name: "A Night's Rest",
    img: "icons/svg/regen.svg",
    command: `// Restore level x Presence Vigor (at least level). Wounds do not clear with rest.
const actors = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isOwner);
const targets = actors.length ? actors : (game.user.character ? [game.user.character] : []);
if ( !targets.length ) ui.notifications.warn("Select a token first.");
for ( const actor of targets ) await actor.restForTheNight();`
  },
  {
    name: "Relevant Check",
    img: "icons/svg/book.svg",
    command: `// A Relevant Check: you choose the Constellation, say why, and the GM approves.
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
if ( !actor ) return ui.notifications.warn("Select a token, or set a player character.");
await actor.rollRelevantCheck();`
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

  // Every chassis, flagged, so the sheet can explain a locked name the pack no longer carries.
  fs.writeFileSync(
    path.join(CONTENT, "chassis.json"),
    `${JSON.stringify(chassisIndex, null, 2)}\n`,
    "utf8"
  );

  // Carry the handbook version into the system, so the rules it implements can be read in game
  // rather than inferred from the system's own version number. `constellations`, `talents` and
  // `equipment` are the authored totals; `enabled` is what the packs actually hold, so the init log
  // in helpers/content.mjs can say how many of the authored Talents ship (ruling 61). Equipment
  // counts weapons, armor and shields together, from the sheet or from the roster fallback
  // (ruling 64).
  const syncPath = path.join(ROOT, "data", "SYNC.json");
  if (fs.existsSync(syncPath)) {
    const sync = JSON.parse(fs.readFileSync(syncPath, "utf8"));
    fs.writeFileSync(path.join(CONTENT, "sync.json"), `${JSON.stringify({
      phb: sync.phb,
      syncedOn: sync.syncedOn,
      constellations: tally.constellations.total,
      talents: tally.talents.total,
      equipment: tally.equipment.total,
      enabled: {
        constellations: tally.constellations.enabled,
        talents: tally.talents.enabled,
        equipment: tally.equipment.enabled
      }
    }, null, 2)}\n`, "utf8");
  }
}

function copyArt() {
  const dest = path.join(SYSTEM, "assets", "constellations");
  fs.mkdirSync(dest, { recursive: true });
  // Mirror the source: a plate the renderer pruned (a retired Constellation) leaves the system too.
  for (const file of fs.readdirSync(dest)) {
    if (file.endsWith(".png") && !plates.has(file)) fs.rmSync(path.join(dest, file));
  }
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
// What the Enabled? column let through, per pack, against what the sheets author (ruling 61).
const ratio = kind => `${tally[kind].enabled} of ${tally[kind].total}`;
console.log(`  enabled for Foundry: ${ratio("constellations")} constellations, ${ratio("talents")} talents, `
  + `${ratio("chassis")} chassis, ${ratio("sheetActions")} sheet actions.`);
// Weapons, armor and shields together (ruling 64), and which source built them: the roster fallback
// is always N of N, since hand-kept rows carry no flag.
console.log(`  equipment: ${ratio("equipment")} enabled`
  + (equipment ? " (data/equipment.xlsx)" : " (roster fallback: assets/equipment.json is absent)"));

let compiled = null;
if (!process.argv.includes("--no-compile")) compiled = await compile();

if (compiled === false) {
  console.log("\nSources are current; the compendia were left alone.");
  process.exitCode = 1;
} else {
  console.log("Done.");
}
