#!/usr/bin/env node
/**
 * Link foundry/starwrought into your Foundry Virtual Tabletop data directory.
 *
 * A link rather than a copy, so `node assets/build_foundry.mjs` is live the moment it finishes
 * and you only have to reload the world.
 *
 *   node foundry/install.mjs                 find the data path and link
 *   node foundry/install.mjs <dataPath>      use this data path instead
 *   node foundry/install.mjs --copy          copy rather than link
 *   node foundry/install.mjs --uninstall     remove the link
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, "starwrought");
const args = process.argv.slice(2);
const copy = args.includes("--copy");
const uninstall = args.includes("--uninstall");
const explicit = args.find(a => !a.startsWith("--"));

/** Where Foundry keeps its user data, honouring an options.json dataPath if there is one. */
function findDataPath() {
  if (explicit) return explicit;

  const candidates = [];
  if (process.platform === "win32") {
    candidates.push(path.join(process.env.LOCALAPPDATA ?? "", "FoundryVTT"));
  } else if (process.platform === "darwin") {
    candidates.push(path.join(os.homedir(), "Library", "Application Support", "FoundryVTT"));
  } else {
    candidates.push(path.join(os.homedir(), ".local", "share", "FoundryVTT"));
  }

  for (const base of candidates) {
    const options = path.join(base, "Config", "options.json");
    if (fs.existsSync(options)) {
      try {
        const { dataPath } = JSON.parse(fs.readFileSync(options, "utf8"));
        // options.json's dataPath is the folder that CONTAINS Data.
        if (dataPath && fs.existsSync(path.join(dataPath, "Data"))) return dataPath;
      } catch { /* fall through to the base itself */ }
    }
    if (fs.existsSync(path.join(base, "Data"))) return base;
  }
  return null;
}

const dataPath = findDataPath();
if (!dataPath) {
  console.error("Could not find a Foundry user data directory.");
  console.error("Pass it explicitly:  node foundry/install.mjs \"D:/FoundryVTT\"");
  process.exit(1);
}

const target = path.join(dataPath, "Data", "systems", "starwrought");
fs.mkdirSync(path.dirname(target), { recursive: true });

if (fs.existsSync(target) || fs.lstatSync(target, { throwIfNoEntry: false })) {
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed the existing ${target}`);
}
if (uninstall) {
  console.log("Uninstalled.");
  process.exit(0);
}

if (copy) {
  fs.cpSync(SOURCE, target, { recursive: true });
  console.log(`Copied  ${SOURCE}\n     -> ${target}`);
} else {
  try {
    // "junction" is the one Windows link type that needs no elevation. Elsewhere it is ignored.
    fs.symlinkSync(SOURCE, target, "junction");
    console.log(`Linked  ${SOURCE}\n     -> ${target}`);
  } catch (error) {
    console.error(`Could not create a link (${error.code}). Retrying as a copy.`);
    fs.cpSync(SOURCE, target, { recursive: true });
    console.log(`Copied  ${SOURCE}\n     -> ${target}`);
  }
}

console.log("\nStart Foundry, create a world with the STARWROUGHT system, and you are away.");
