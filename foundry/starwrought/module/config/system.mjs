/**
 * The system's identity: its id, the version stamp the client compares with the server's,
 * and where the pack sources are served from. Nothing here is a rule of the game.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

export const SYSTEM_ID = "starwrought";

/**
 * The version this code was shipped as. Foundry reads system.json on the server, so
 * `game.system.version` is always the server's; if this disagrees with it, the browser is running
 * a cached copy of an older release. `assets/package_system.mjs` refuses to package, and
 * `assets/build_all.mjs` to pass, unless this, `--sw-css-version-<name>` in every stylesheet
 * system.json lists (styles/README.md) and system.json all agree.
 */
export const SYSTEM_VERSION = "0.20.1";

/**
 * THE CONTENT LOOP (0.8.0; the content-loop brief, Mike 2026-10-03; ruling 115). The pack sources
 * are the content; the compiled LevelDB packs are a release artifact. `node assets/build_all.mjs
 * --content` writes `packs/_source/<pack>/*.json` and, beside them, `packs/_source/index.json`:
 * every document and folder by id with its content hash, and one `build` hash over all of them.
 * Foundry serves the system folder as static files, so the open world reads both over HTTP and
 * `module/apps/content-sync.mjs` brings the compendia level with them in place, no restart. These
 * two paths are the only place the layout is named on the Foundry side; the builder's SOURCE
 * constant is the same folder from the other end.
 */
export const CONTENT_INDEX_PATH = "systems/starwrought/packs/_source/index.json";
export const CONTENT_SOURCE_PATH = "systems/starwrought/packs/_source";
