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
 *   node assets/build_all.mjs --content       the content loop: spreadsheets to the web app, the viewer
 *                                             and the Foundry pack sources, no compile (0.8.0)
 *   node assets/build_all.mjs --check         only check for drift, build nothing
 *   node assets/build_all.mjs --accept-phb    record the current handbook as synced (after the work)
 *   node assets/build_all.mjs --skip-slow     skip the plate renderer, the sheets, and the compendium
 *
 * Exit 1 on any failing step, or on unresolved handbook drift.
 *
 * --content (Mike, 2026-10-03; rulings 115 to 117) is its own mode and takes no other flag. It runs
 * xlsx_to_trees, inject, render_constellations --changed (only the plates whose Constellation moved
 * or is new), build_foundry --no-compile (the pack sources and packs/_source/index.json, never the
 * LevelDB compendia, which a running Foundry holds open) and check_style; it skips the sheets, the
 * compendium docx and the features docx and says so; and it reports handbook drift as a warning
 * rather than stopping, because adding a Talent to a sheet is not a handbook sync (ruling 115). The
 * open Foundry world then syncs its compendia from the sources in place (Settings > STARWROUGHT >
 * Sync content). sync_content.cmd in the project root runs this mode from a double-click. Exit 1 on
 * a failing step or on disagreeing version stamps; drift alone exits 0 in this mode.
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
const content = args.includes("--content");

// Content mode is a different question from the other three flags: --check and --skip-slow shape the
// full pipeline, and --accept-phb stamps a handbook sync, which content work by definition is not
// (ruling 115). Refuse the mix rather than guess which flag wins.
if (content && (checkOnly || skipSlow || accept)) {
  console.error("--content is its own mode: run it alone, not with --check, --skip-slow or --accept-phb.");
  process.exit(1);
}

const PY = process.platform === "win32" ? "python" : "python3";

/**
 * Every step, in the order CLAUDE.md prints them. `slow` marks what --skip-slow leaves out. `content`
 * is the step's shape in --content mode: `false` skips it (the sheets, the compendium docx and the
 * features docx belong to a release, not to a content change), an argument list replaces `args` (the
 * plates only where the Constellation moved; the pack sources without a compile), and absent runs
 * the step as it is.
 */
const STEPS = [
  { name: "xlsx_to_trees", cmd: PY, args: ["assets/xlsx_to_trees.py"] },
  { name: "inject", cmd: PY, args: ["assets/inject.py"] },
  { name: "render_constellations", cmd: PY, args: ["assets/render_constellations.py"], slow: true,
    content: ["assets/render_constellations.py", "--changed"] },
  { name: "sheet_gen", cmd: PY, args: ["assets/sheet_gen.py"], slow: true, content: false },
  { name: "build_phb", cmd: "node", args: ["assets/build_phb.js"], slow: true, content: false },
  { name: "build_foundry", cmd: "node", args: ["assets/build_foundry.mjs"],
    content: ["assets/build_foundry.mjs", "--no-compile"] },
  // FEATURES.md as a Word document, so the printable copy never lags the file the handbook rule moves.
  { name: "build_features_docx", cmd: PY, args: ["assets/build_features_docx.py"], content: false },
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

/** Run one step; `args` and `label` are the content-mode overrides, else the step's own. */
function run(step, { args: stepArgs = step.args, label = step.name } = {}) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync(step.cmd, stepArgs, { cwd: ROOT, stdio: "inherit", shell: false });
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

/**
 * Say what drifted and what has to catch up. In content mode (`warning`) the same report is printed
 * under a banner that says it is a warning, and the run goes on: the handbook rule is about a
 * handbook sync, and the content loop is not one (ruling 115). The full pipeline still stops here.
 */
function reportDrift(drift, { warning = false } = {}) {
  const head = warning ? "HANDBOOK DRIFT (a warning in content mode)" : "HANDBOOK DRIFT";
  console.log("\n" + "=".repeat(72));
  if (drift.changed) {
    console.log(`${head}: ${drift.book.file} has changed since it was synced`
      + `${drift.syncedOn ? ` on ${drift.syncedOn}` : ""}, under the same edition number.`);
  } else {
    console.log(`${head}: the repository is synced to v${drift.recorded ?? "nothing"},`
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
  if (warning) {
    console.log("\nContent mode does not stop for this: a content change is not a handbook sync (ruling 115).");
    console.log("The full pipeline will, until the work above is done and recorded:  node assets/build_all.mjs --accept-phb\n");
  } else {
    console.log(`\nWhen the work is done:  node assets/build_all.mjs --accept-phb\n`);
  }
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

console.log(content ? "STARWROUGHT content loop" : "STARWROUGHT full pipeline");
const book = currentHandbook();
const recorded = readSync().phb;
console.log(`  handbook on the shelf: ${book ? book.file : "none"}`);
console.log(`  repository synced to:  v${recorded ?? "nothing"}`);

if (!checkOnly) {
  for (const step of STEPS) {
    if (content && step.content === false) {
      console.log(`\n=== ${step.name} (skipped in content mode) ===`);
      continue;
    }
    if (skipSlow && step.slow) {
      console.log(`\n=== ${step.name} (skipped) ===`);
      continue;
    }
    // In content mode a step with its own argument list runs with it, and the heading shows the
    // flags that differ from the full pipeline's, so the log says which shape ran.
    const contentArgs = content && Array.isArray(step.content) ? step.content : null;
    const ok = contentArgs
      ? run(step, { args: contentArgs, label: `${step.name} ${contentArgs.filter(a => !step.args.includes(a)).join(" ")}`.trim() })
      : run(step);
    if (!ok) {
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
  reportDrift(drift, { warning: content });
  if (!content) process.exit(1);
}

if (content) {
  console.log("\nContent rebuilt: the web app and the viewer are current (reload the browser tab); in Foundry,");
  console.log("sync the open world from Settings > STARWROUGHT > Sync content.");
} else {
  console.log(`\nAll steps clean, and the repository is synced to PHB v${drift.recorded}.`);
}
