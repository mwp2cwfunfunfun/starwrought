# The stylesheets

One file per window, in the order `system.json` loads them. A rule lives in the file of the window
it dresses, so a change to the party sheet is made in `party.css` and cannot touch the chat cards,
and a reader looking for the Combat Prompt's styles opens `attack.css` and reads 290 lines, not
3,000. Through 0.10.0 all of it was one `starwrought.css`.

| File | Owns | Serves | Builds on |
|---|---|---|---|
| `starwrought.css` | The version stamp, the scrollbars, the `--sw-*` tokens on `.starwrought`, form controls, the two generic buttons (`sw-primary`, `sw-cancel`), the rules-link idiom, `sw-hidden` | everything | nothing |
| `sheet.css` | The frame, the header skeleton, identity and locked fields, the rich tooltip, header counters, tabs, panels and notes, item rows, tags, traits, tables, currency, the editors | every Actor and Item sheet | `starwrought.css` |
| `item.css` | The read-only Item header pieces, the type line, the Automation panel | `templates/item/*.hbs` | `sheet.css` |
| `character.css` | Progress and Hero Points, the Vigor track, action pips, Attributes, Defenses and stance, Zones and Wounds, Constellations and Talents, Strike pills, carry states, the Strikes grid, movement, the Bind, the Actions tab groups, the wizard banner | the character and npc sheets | `sheet.css` |
| `chargen.css` | The creation wizard | `templates/chargen/*.hbs` | `sheet.css` |
| `hud.css` | The combat tracker's readout, targeting marks, the token HUD's stance button (core's elements, unscoped) | `module/apps/combat-tracker.mjs`, `module/canvas/targeting.mjs` | nothing |
| `auras.css` | The HUD's ring button, the palette window, the ring toggles on the sheets, the Ranges line | `templates/apps/aura-palette.hbs`, the toggles in `templates/actor/*.hbs` | `sheet.css` |
| `chat.css` | The cards and their accents, the roll dialogs (check, Relevant Check, Flare) | `templates/chat/*.hbs`, `templates/dice/*.hbs` | `sheet.css` |
| `attack.css` | The Combat Prompt and the attack card | `templates/apps/combat-prompt.hbs`, `templates/chat/attack-workflow-card.hbs` | `chat.css` |
| `party.css` | The party sheet (roster, Skills grid, loot and purse, On the road, Downtime), its dialogs and cards | `templates/actor/party-*.hbs` | `sheet.css`, `character.css`, `chat.css` |
| `content-sync.css` | The Sync content window and its card | `templates/apps/content-sync.hbs` | `chat.css` |

## The rules

1. **Order is the `styles` array in `system.json`.** A file may rely on the files listed before it
   (the party's roster reuses the character's Vigor track, so `party.css` loads after
   `character.css`) and never on one listed after it.
2. **No selector list is declared twice**, in one file or across two, `:root` excepted. Two
   declarations of one selector make the load order decide which one reads, which is the one thing
   a split cannot afford. Merge them, or give the later one a more specific selector (a modifier
   class, a parent). `node assets/build_all.mjs` (every mode, `--check` included) fails on a
   repeat and names both files.
3. **Every file carries its stamp**, `:root { --sw-css-version-<file name>: "<version>"; }`, equal
   to `system.json`'s version. The game reads each at load and warns, naming the file, when a
   browser or a proxy holds an old copy of any one of them. A release bumps `system.json`,
   `SYSTEM_VERSION` in `module/config/system.mjs` and all eleven stamps; `build_all.mjs` lists every one
   that lags, and `assets/package_system.mjs` refuses to package while one does.
4. **Every `.css` in this folder is listed in `system.json`.** A file left off the list loads
   nowhere and its rules silently never apply; `build_all.mjs` fails on one.

## Where a new rule goes

- A rule for one window: that window's file.
- A piece two windows share: the earliest file both load after. A header widget the character and
  the party both show goes in `sheet.css`; a card accent the party alone uses goes in `party.css`,
  after `chat.css` has drawn the card.
- A new window: a new file, with the header the others carry (what it owns, what it serves, what it
  builds on), its stamp, and a line in `system.json` after the files it builds on, plus a row here.
- Nothing in `starwrought.css` knows about any one window. Tokens, scrollbars, form controls, the
  generic buttons, the one utility class.

Each file's header says the same in its own words, so a reader who opens one file cold has the
rules in front of them.
