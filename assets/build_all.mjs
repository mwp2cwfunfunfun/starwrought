#!/usr/bin/env node
/**
 * build_all.mjs: the whole pipeline, in order, plus the handbook drift check.
 *
 * The rule this exists to enforce (Mike, 2026-08-27): when the Player's Handbook moves, the web
 * app, the Foundry system, and the system's FEATURES.md all move with it, with a changelog entry
 * at minimum. That rule is easy to state and easy to forget, so it is checked mechanically here
 * rather than remembered.
 *
 *   node assets/build_all.mjs                 run every step, then check for drift
 *   node assets/build_all.mjs --check         only check for drift, build nothing
 *   node assets/build_all.mjs --accept-phb    record the current handbook as synced (after the work)
 *   node assets/build_all.mjs --skip-slow     skip the plate renderer, the sheets, and the compendium
 *
 * Exit 1 on any failing step, or on unresolved handbook drift.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SYNC = path.join(ROOT, "data", "SYNC.json");
const SYSTEM = path.join(ROOT, "foundry", "starwrought");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const accept = args.includes("--accept-phb");
const skipSlow = args.includes("--skip-slow");

const PY = process.platform === "win32" ? "python" : "python3";

/** Every step, in the order CLAUDE.md prints them. */
const STEPS = [
  { name: "xlsx_to_trees", cmd: PY, args: ["assets/xlsx_to_trees.py"] },
  { name: "inject", cmd: PY, args: ["assets/inject.py"] },
  { name: "render_constellations", cmd: PY, args: ["assets/render_constellations.py"], slow: true },
  { name: "sheet_gen", cmd: PY, args: ["assets/sheet_gen.py"], slow: true },
  { name: "build_phb", cmd: "node", args: ["assets/build_phb.js"], slow: true },
  { name: "build_foundry", cmd: "node", args: ["assets/build_foundry.mjs"] },
  // FEATURES.md as a Word document, so the printable copy never lags the file the handbook rule moves.
  { name: "build_features_docx", cmd: PY, args: ["assets/build_features_docx.py"] },
  { name: "check_style", cmd: PY, args: ["assets/check_style.py", "--quiet"] }
];

/* -------------------------------------------- */

/** The highest-numbered handbook in the project root, which is the authoritative one. */
function currentHandbook() {
  const files = fs.readdirSync(ROOT)
    .filter(f => /^Starwrought_Players_Handbook_v[\d.]+\.docx$/.test(f))
    .map(f => ({ file: f, version: f.match(/v([\d.]+)\.docx$/)[1] }))
    .sort((a, b) => compareVersions(a.version, b.version));
  return files.at(-1) ?? null;
}

/** "3.10" is newer than "3.9". */
function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function readSync() {
  if (!fs.existsSync(SYNC)) return { phb: null };
  return JSON.parse(fs.readFileSync(SYNC, "utf8"));
}

/**
 * The SHA-256 of the handbook file, recorded in SYNC.json at --accept-phb. Mike edits the current
 * edition in place as well as accepting redlines (2026-10-02: v4.12 gained a new Wind sentence
 * under its own number), and a version-number comparison cannot see that, so the hash is what
 * tells a same-numbered handbook that moved from one that did not.
 */
function handbookHash(book) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, book.file))).digest("hex");
}

/* -------------------------------------------- */

function run(step) {
  process.stdout.write(`\n=== ${step.name} ===\n`);
  const result = spawnSync(step.cmd, step.args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (result.error) {
    console.error(`  could not run ${step.cmd}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`  ${step.name} exited ${result.status}`);
    return false;
  }
  return true;
}

/* -------------------------------------------- */

/**
 * Has the handbook moved without the rest of the repository following it? A new number on the
 * shelf is drift; so is the same number with different bytes, once a hash has been recorded.
 * @returns {{ok: boolean, book: object, recorded: string|null, missing: string[], changed: boolean, syncedOn: string|null}}
 */
function driftCheck() {
  const book = currentHandbook();
  const sync = readSync();
  const recorded = sync.phb;
  if (!book) return { ok: true, book: null, recorded, missing: [], changed: false, syncedOn: null };

  const drifted = compareVersions(book.version, recorded ?? "0") !== 0;
  if (!drifted) {
    // Same edition number: the bytes decide. No recorded hash (a SYNC.json from before 0.6.2) is
    // taken as in step; the next --accept-phb records one.
    const changed = !!sync.phbSha256 && (handbookHash(book) !== sync.phbSha256);
    return { ok: !changed, book, recorded, missing: [], changed, syncedOn: sync.syncedOn ?? null };
  }

  // The two documents that must name the new version before it counts as synced.
  const missing = [];
  for (const rel of ["CHANGELOG.md", "FEATURES.md"]) {
    const file = path.join(SYSTEM, rel);
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (!text.includes(`v${book.version}`)) missing.push(`foundry/starwrought/${rel}`);
  }
  return { ok: false, book, recorded, missing, changed: false, syncedOn: null };
}

function reportDrift(drift) {
  console.log("\n" + "=".repeat(72));
  if (drift.changed) {
    console.log(`HANDBOOK DRIFT: ${drift.book.file} has changed since it was synced`
      + `${drift.syncedOn ? ` on ${drift.syncedOn}` : ""}, under the same edition number.`);
  } else {
    console.log(`HANDBOOK DRIFT: the repository is synced to v${drift.recorded ?? "nothing"},`
      + ` but ${drift.book.file} is on the shelf.`);
  }
  console.log("=".repeat(72));
  console.log("\nA handbook change is not finished until all of these have caught up:");
  console.log("  1. data/*.xlsx          the rules text the spreadsheets carry");
  console.log("  2. Starwrought_App.html the web app (regenerated by inject.py)");
  console.log("  3. foundry/starwrought/ the Foundry system, code and compendia");
  console.log("  4. FEATURES.md          if a feature changed or was added");
  console.log("  5. CHANGELOG.md         always, even if only to say what moved");
  if (drift.missing.length) {
    console.log(`\nStill not naming v${drift.book.version}:`);
    for (const m of drift.missing) console.log(`  - ${m}`);
  }
  console.log(`\nWhen the work is done:  node assets/build_all.mjs --accept-phb\n`);
}

/* -------------------------------------------- */

/**
 * The three places the system's version lives have to agree: system.json, which the server reads,
 * and the two stamps the client compares it with at load (`SYSTEM_VERSION` in module/config.mjs
 * and `--sw-css-version` in styles/starwrought.css) to catch a browser holding a cached release.
 * `assets/package_system.mjs` made this check at packaging time; 0.5.2 shipped from this pipeline
 * with both stamps still on 0.5.1, so every client saw the warning the stamps exist to raise.
 * Checked here too, after every run, so a release cannot leave the repository with the stamps
 * disagreeing (0.5.3).
 * @returns {string[]}  One line per disagreement; empty when all three agree.
 */
function stampCheck() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SYSTEM, "system.json"), "utf8"));
  const stamps = {
    "module/config.mjs": /export const SYSTEM_VERSION = "([^"]+)"/,
    "styles/starwrought.css": /--sw-css-version:\s*"([^"]+)"/
  };
  const problems = [];
  for (const [rel, pattern] of Object.entries(stamps)) {
    const text = fs.readFileSync(path.join(SYSTEM, rel), "utf8");
    const found = text.match(pattern)?.[1] ?? null;
    if (found !== manifest.version) {
      problems.push(`foundry/starwrought/${rel} is stamped ${found ?? "with nothing"}; system.json says ${manifest.version}.`);
    }
  }
  return problems;
}

/* -------------------------------------------- */

console.log("STARWROUGHT full pipeline");
const book = currentHandbook();
const recorded = readSync().phb;
console.log(`  handbook on the shelf: ${book ? book.file : "none"}`);
console.log(`  repository synced to:  v${recorded ?? "nothing"}`);

if (!checkOnly) {
  for (const step of STEPS) {
    if (skipSlow && step.slow) {
      console.log(`\n=== ${step.name} (skipped) ===`);
      continue;
    }
    if (!run(step)) {
      console.error("\nPipeline stopped. Nothing further was run.");
      process.exit(1);
    }
  }
}

const stamps = stampCheck();
if (stamps.length) {
  console.log("\n" + "=".repeat(72));
  console.log("VERSION STAMPS DISAGREE: the client would warn every user of a stale copy.");
  console.log("=".repeat(72));
  for (const line of stamps) console.log(`  - ${line}`);
  console.log("\nBump SYSTEM_VERSION in module/config.mjs and --sw-css-version in styles/starwrought.css to match system.json.\n");
  process.exit(1);
}

const drift = driftCheck();

if (accept) {
  if (drift.missing.length) {
    reportDrift(drift);
    console.error("Refusing to stamp: the changelog and the features file have to say what changed.");
    process.exit(1);
  }
  const data = readSync();
  data.phb = drift.book?.version ?? data.phb;
  data.syncedOn = new Date().toISOString().slice(0, 10);
  // The bytes of the edition as synced, so an in-place edit under the same number reads as drift.
  if (drift.book) {
    data.phbFile = drift.book.file;
    data.phbSha256 = handbookHash(drift.book);
  }
  fs.writeFileSync(SYNC, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`\nStamped data/SYNC.json: synced to v${data.phb}${data.phbSha256 ? ` (${data.phbSha256.slice(0, 12)})` : ""}.`);
  process.exit(0);
}

if (!drift.ok) {
  reportDrift(drift);
  process.exit(1);
}

console.log(`\nAll steps clean, and the repository is synced to PHB v${drift.recorded}.`);
