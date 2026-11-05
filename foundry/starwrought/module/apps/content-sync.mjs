/**
 * Sync content, the window (0.8.0): the plan by pack and by name, the copies line with its
 * checkbox, and the three buttons; while applying, the buttons disabled and a progress line;
 * after, the result in place of the plan. GM only (the Settings menu is `restricted`; `open`
 * refuses a player). One window: the Settings menu constructs its own instance, so the newest
 * render closes the one before it rather than two plans disagreeing.
 *
 * The synchronisation itself, fetching the index, planning the diff, applying it and refreshing
 * the characters' copies, is helpers/content-sync.mjs, which this window calls and a macro can
 * call without it (rulings 115 to 117 are recorded there). Through 0.10.1 the two shared this
 * file.
 */

import * as SW from "../config.mjs";
import {
  fetchContentIndex, planContentSync, applyContentSync, formatWhen, shortHash, SETTING_BUILD, SETTING_STAMP
} from "../helpers/content-sync.mjs";
// Re-exported so the three logic entry points keep their 0.8.0 import path for macros and for
// starwrought.mjs, which imports the window and the plan functions together.
export { fetchContentIndex, planContentSync, applyContentSync, formatWhen } from "../helpers/content-sync.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

const TEMPLATE = "systems/starwrought/templates/apps/content-sync.hbs";

/**
 * Sync content: the plan, by pack and by name, the copies line with its checkbox, and the three
 * buttons; while applying, the buttons disabled and a progress line; after, the result in place
 * of the plan. GM only (the Settings menu is `restricted`; `open` refuses a player). One window:
 * the Settings menu constructs its own instance, so the newest render closes the one before it
 * rather than two plans disagreeing.
 */
export class ContentSync extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "sw-content-sync",
    classes: ["starwrought", "sw-content-sync"],
    position: { width: 560, height: "auto" },
    window: {
      title: "STARWROUGHT.Content.title",
      icon: "fa-solid fa-rotate",
      resizable: true,
      minimizable: true
    },
    actions: {
      refresh: ContentSync.#onRefresh,
      sync: ContentSync.#onSync,
      close: ContentSync.#onCloseButton
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: TEMPLATE, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Opening                                     */
  /* -------------------------------------------- */

  static #instance = null;

  /** The one window of this client, or null. */
  static get instance() {
    return ContentSync.#instance;
  }

  /**
   * Open the window, or bring the open one to the front. A plan already computed (the load offer
   * has one) is shown as it is rather than computed again.
   * @param {{plan?: object|null}} [options]
   * @returns {Promise<ContentSync|null>}
   */
  static async open({ plan = null } = {}) {
    if (!game.user?.isGM) {
      ui.notifications.warn(localize("STARWROUGHT.Content.gmOnly"));
      return null;
    }
    let app = ContentSync.#instance;
    if (!app?.rendered) app = new ContentSync();
    if (plan) app.#seed(plan);
    await app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  /** The plan on show, or null while none has been computed (or after a sync, until Refresh). */
  #plan = null;
  /** The result of the last Sync, shown in place of the plan. */
  #result = null;
  /** A message when the index or the plan could not be read. */
  #error = null;
  #loading = false;
  #applying = false;
  #progress = "";
  /**
   * The checkbox: ticked by default (ruling 117) once the world has synced before. On the very
   * first sync of a world (no build recorded, so no copy carries a hash) every owned Item would be
   * rewritten from its source and a hand edit to a copy lost, so it starts unticked and the GM
   * opts in.
   */
  #refreshCopies = !!game.settings.get(SW.SYSTEM_ID, SETTING_BUILD);

  #seed(plan) {
    this.#plan = plan;
    this.#result = null;
    this.#error = null;
  }

  /** Read the index and compute the plan, recording a failure as the window's message. */
  async #load() {
    this.#loading = true;
    try {
      const index = await fetchContentIndex({ notify: false });
      if (!index) {
        this.#error = localize("STARWROUGHT.Content.noIndex");
        this.#plan = null;
        return;
      }
      this.#plan = await planContentSync(index);
      this.#error = null;
    } catch (error) {
      console.error("STARWROUGHT | the content plan could not be made", error);
      this.#error = error.message;
      this.#plan = null;
    } finally {
      this.#loading = false;
    }
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!game.user.isGM) {
      return Object.assign(context, {
        error: localize("STARWROUGHT.Content.gmOnly"),
        buttons: { refreshDisabled: true, syncDisabled: true, closeDisabled: false }
      });
    }
    if (!this.#plan && !this.#result && !this.#error && !this.#applying) await this.#load();

    const plan = this.#plan ? this.#planContext(this.#plan) : null;
    const copies = this.#plan?.copies?.count ?? 0;
    const canSync = !!this.#plan && !this.#applying && (!this.#plan.empty || (this.#refreshCopies && (copies > 0)));
    return Object.assign(context, {
      loading: this.#loading,
      applying: this.#applying,
      progress: this.#progress,
      error: this.#error,
      result: this.#result ? this.#resultContext(this.#result) : null,
      plan,
      refreshCopies: this.#refreshCopies,
      copiesDisabled: this.#applying || (copies === 0),
      // Spelled as the template's `disabled` helper wants them, so no helper expression is nested.
      buttons: {
        refreshDisabled: this.#applying,
        syncDisabled: !canSync,
        closeDisabled: this.#applying
      }
    });
  }

  /** One pack's three name lists, documents and folders together, folders marked. */
  static #lists(packPlan) {
    const rows = (docs, folders) => [
      ...docs.map(r => ({ name: r.name, folder: false })),
      ...folders.map(r => ({ name: r.name, folder: true }))
    ];
    const list = (kind, key, docs, folders) => {
      const items = rows(docs, folders);
      return { kind, items, count: items.length, any: items.length > 0, label: format(key, { count: items.length }) };
    };
    return [
      list("create", "STARWROUGHT.Content.createdList", packPlan.documents.create, packPlan.folders.create),
      list("update", "STARWROUGHT.Content.updatedList", packPlan.documents.update, packPlan.folders.update),
      list("delete", "STARWROUGHT.Content.deletedList", packPlan.documents.delete, packPlan.folders.delete)
    ];
  }

  #planContext(plan) {
    const lastStamp = game.settings.get(SW.SYSTEM_ID, SETTING_STAMP);
    const lastBuild = game.settings.get(SW.SYSTEM_ID, SETTING_BUILD);
    const when = formatWhen(plan.stamp);
    const copies = plan.copies ?? { count: 0, actorCount: 0, names: [] };
    return {
      when,
      stamp: plan.stamp,
      build: plan.build,
      buildShort: shortHash(plan.build),
      system: plan.system,
      lastWhen: lastStamp ? formatWhen(lastStamp) : localize("STARWROUGHT.Content.never"),
      lastBuildShort: shortHash(lastBuild),
      sameBuild: !!plan.build && (plan.build === lastBuild),
      empty: plan.empty,
      emptyText: format("STARWROUGHT.Content.nothing", { when }),
      counts: plan.counts,
      packs: plan.packs.map(p => ({
        label: p.label,
        work: p.work,
        hasWork: p.work > 0,
        counts: p.counts,
        lists: ContentSync.#lists(p).filter(l => l.any)
      })),
      skipped: plan.skipped.length ? format("STARWROUGHT.Content.skipped", { packs: plan.skipped.map(s => s.label).join(", ") }) : "",
      copies: {
        count: copies.count,
        any: copies.count > 0,
        line: copies.count
          ? format("STARWROUGHT.Content.copiesLine", { count: copies.count, actors: copies.actorCount, names: copies.names.join(", ") })
          : localize("STARWROUGHT.Content.copiesNone")
      }
    };
  }

  #resultContext(result) {
    return {
      when: formatWhen(result.stamp),
      buildShort: shortHash(result.build),
      recorded: result.recorded,
      packs: result.packs.map(p => {
        const folders = p.folders.create + p.folders.update + p.folders.delete;
        return {
          label: p.label,
          text: format("STARWROUGHT.Content.resultPack", {
            pack: p.label, create: p.create, update: p.update, delete: p.delete,
            folders: folders ? format("STARWROUGHT.Content.resultFolders", { count: folders }) : ""
          })
        };
      }),
      copies: result.copies.count
        ? format("STARWROUGHT.Content.resultCopies", { count: result.copies.count, actors: result.copies.actors.map(a => `${a.name} (${a.count})`).join(", ") })
        : localize("STARWROUGHT.Content.resultCopiesNone"),
      errors: result.errors.map(e => [e.where, e.name, e.message].filter(Boolean).join(": ")),
      errorsText: result.errors.length ? format("STARWROUGHT.Content.resultErrors", { count: result.errors.length }) : "",
      done: result.recorded ? format("STARWROUGHT.Content.resultDone", { when: formatWhen(result.stamp) }) : ""
    };
  }

  /**
   * One window: the Settings menu constructs its own instance, so whichever renders next closes
   * the one before it. Done here, before this window's frame exists, because ApplicationV2 keys
   * `foundry.applications.instances` by id and the two share one: closing the old window after
   * the new frame registered would unregister the new one.
   * @inheritdoc
   */
  async _preFirstRender(context, options) {
    await super._preFirstRender?.(context, options);
    const previous = ContentSync.#instance;
    if (previous && (previous !== this) && previous.rendered) await previous.close();
    ContentSync.#instance = this;
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // The checkbox is read on change, not on submit, and never forces a re-render: the plan does
    // not depend on it, only the Sync button's state does.
    const box = this.element?.querySelector('input[name="refreshCopies"]');
    box?.addEventListener("change", event => {
      this.#refreshCopies = !!event.currentTarget.checked;
      this.#syncButtonState();
    });
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose?.(options);
    if (ContentSync.#instance === this) ContentSync.#instance = null;
  }

  /** Enable or disable Sync from the plan and the checkbox, without a render. */
  #syncButtonState() {
    const button = this.element?.querySelector('button[data-action="sync"]');
    if (!button) return;
    const copies = this.#plan?.copies?.count ?? 0;
    button.disabled = !this.#plan || this.#applying || (this.#plan.empty && !(this.#refreshCopies && (copies > 0)));
  }

  /** The progress line, written in place so the window does not redraw on every step. */
  #setProgress(text) {
    this.#progress = text;
    const line = this.element?.querySelector(".sw-content-progress span");
    if (line) line.textContent = text;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Read the index and compute the plan again. */
  static async #onRefresh() {
    if (this.#applying) return;
    this.#plan = null;
    this.#result = null;
    this.#error = null;
    await this.render();
  }

  /** Apply the plan on show. */
  static async #onSync() {
    if (this.#applying || !this.#plan) return;
    const plan = this.#plan;
    this.#applying = true;
    this.#progress = localize("STARWROUGHT.Content.starting");
    await this.render();
    try {
      this.#result = await applyContentSync(plan, {
        refreshCopies: this.#refreshCopies,
        onProgress: text => this.#setProgress(text)
      });
      this.#plan = null;
      this.#error = null;
    } catch (error) {
      console.error("STARWROUGHT | Sync content failed", error);
      this.#error = error.message;
      ui.notifications.error(error.message);
    } finally {
      this.#applying = false;
      this.#progress = "";
      if (this.rendered) await this.render();
    }
  }

  static async #onCloseButton() {
    if (this.#applying) return;
    await this.close();
  }
}
