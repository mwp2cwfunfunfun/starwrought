/**
 * Package the Foundry system for a server that is not this machine.
 *
 * Produces two files in `dist/`:
 *
 *   starwrought.zip   the system, with `system.json` at the root of the archive, which is the shape
 *                     Foundry's installer expects behind a `download` URL. The name carries no
 *                     version on purpose: a GitHub `releases/latest/download/<asset>` URL only
 *                     resolves if the asset is named the same in every release.
 *   system.json       the same manifest, alone, for a `manifest` URL.
 *
 * `packs/_source` is left out. Those JSON files are the input to the compiled LevelDB packs, not
 * something Foundry reads at runtime, and they are most of the weight.
 *
 * Run it from the project root:
 *
 *   node assets/package_system.mjs
 *   node assets/package_system.mjs --repo yourname/starwrought
 *
 * With a repository given (or `GITHUB_REPOSITORY` set, as it is inside a GitHub Action) the
 * manifest and download URLs are rewritten to point at that repository's latest release, in both
 * the standalone `system.json` and the copy inside the archive. Foundry reads `manifest` from the
 * installed copy when it checks for updates, so the two have to agree.
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SYSTEM = join(ROOT, "foundry", "starwrought");
const DIST = join(ROOT, "dist");
const STAGE = join(DIST, "staging");
const ASSET = "starwrought.zip";

/** Anything here is build input rather than something the server needs. */
const EXCLUDE = new Set([join(SYSTEM, "packs", "_source")]);

/**
 * LevelDB's per-process files. `LOCK` is held open by whatever Foundry is running against these
 * packs, so copying it fails outright on Windows, and shipping either of these to another machine
 * would be meaningless anyway: the destination makes its own.
 */
const RUNTIME_FILES = new Set(["LOCK", "LOG", "LOG.old"]);

const args = process.argv.slice(2);
const repo = valueOf("--repo") ?? process.env.GITHUB_REPOSITORY ?? null;

const manifest = JSON.parse(readFileSync(join(SYSTEM, "system.json"), "utf8"));
if (repo) {
  const base = `https://github.com/${repo}/releases/latest/download`;
  manifest.url = `https://github.com/${repo}`;
  manifest.manifest = `${base}/system.json`;
  manifest.download = `${base}/${ASSET}`;
}

const zipPath = join(DIST, ASSET);
console.log(`STARWROUGHT | packaging ${manifest.id} v${manifest.version}${repo ? ` for ${repo}` : ""}`);

// The compiled packs are not committed, so a fresh checkout has none. Say so rather than shipping
// a system whose compendia are empty directories.
const missing = (manifest.packs ?? []).filter(p => !existsSync(join(SYSTEM, p.path, "CURRENT")));
if (missing.length) {
  console.error(`\nNo compiled pack at: ${missing.map(p => p.path).join(", ")}`);
  console.error("Run `node assets/build_foundry.mjs` first; it compiles packs/_source into LevelDB.");
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(STAGE, { recursive: true });

cpSync(SYSTEM, STAGE, {
  recursive: true,
  filter: src => !EXCLUDE.has(resolve(src)) && !RUNTIME_FILES.has(basename(src))
});

// The copy inside the archive is the one Foundry installs, so it carries the rewritten URLs too.
const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
writeFileSync(join(STAGE, "system.json"), manifestJson);

// No zip library in the repo, so use whatever the platform ships with.
if (process.platform === "win32") {
  execFileSync("powershell", [
    "-NoProfile", "-Command",
    `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${zipPath}' -Force`
  ], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: STAGE, stdio: "inherit" });
}

writeFileSync(join(DIST, "system.json"), manifestJson);
rmSync(STAGE, { recursive: true, force: true });

const mb = (statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log(`
  dist/${ASSET}   ${mb} MB
  dist/system.json

  manifest  ${manifest.manifest}
  download  ${manifest.download}
`);

/** Read `--flag value` off the command line. */
function valueOf(flag) {
  const i = args.indexOf(flag);
  return (i >= 0) ? args[i + 1] : null;
}
