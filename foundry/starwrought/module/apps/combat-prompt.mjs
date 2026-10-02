/**
 * The Combat Prompt: where a defender's decisions are made (0.5.0 attack-flow brief, "The three
 * surfaces"). One small, non-modal window per client, bottom-right by default, never blocking
 * Foundry. It lists every outstanding action the current user has across every live attack
 * workflow, re-renders in place as the state moves, and closes itself a few seconds after the
 * user has nothing left to do. The attack card in chat reopens it.
 *
 * Modes, one section per task:
 *  - defend: the Defense (Evade or Guard, the two that answer a Blow; PHB v4.10, The Four
 *    Threats), the answers legal on it (nothing, a Reaction, a Posture ⓿↺; PHB v4.10, Answering an
 *    Attack), a Zone when a Posture is picked, a Threshold preview for a player-controlled
 *    defender, and Commit. The defender's standing stance is the pre-selection, so a present
 *    player commits with one click; the stance itself is not changed.
 *  - gm: the same for an adversary target, which is the GM's to declare.
 *  - locked: this defender has committed; "{n} of {total} defenders ready" and who is awaited.
 *  - rollAttack / rollDefense: one button, AttackCoordinator.rollFor.
 *  - choose: a generic option list for later follow-ups (built, not yet wired).
 *  - stale: a submit the coordinator rejected as stale shows "That attack has moved on" and the
 *    task refreshes from the live state.
 *
 * Every choice travels as semantics only (defense, reaction, posture) and the coordinator computes
 * the Thresholds and revalidates against legalAnswers; nothing here is trusted by anyone else.
 * No requestAnimationFrame anywhere: a background tab gets no frames, so rendering happens on
 * state events and the only timer is the auto-close.
 */

import * as SW from "../config.mjs";
import { AttackCoordinator } from "../combat/attack-coordinator.mjs";
import { AttackWorkflow } from "../combat/attack-workflow.mjs";
import { legalAnswers, describeAnswer, BLOW_DEFENSES } from "../helpers/answers.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The window closes this long after the user has nothing outstanding (brief: "a few seconds"). */
const AUTO_CLOSE_MS = 4000;
/** A stale notice stays on its task this long; the task itself refreshes from the live state at once. */
const STALE_NOTICE_MS = 8000;
const TEMPLATE = "systems/starwrought/templates/apps/combat-prompt.hbs";
const ENDED = new Set(["complete", "cancelled"]);
/** outstandingFor kinds, mapped onto the prompt's modes. */
const MODES = Object.freeze({
  defend: "defend", gmDefend: "gm", gm: "gm", rollAttack: "rollAttack", rollDefense: "rollDefense", choose: "choose"
});

/* -------------------------------------------- */

/** The Actor behind a uuid, whether the uuid names an Actor or a Token (as chat.mjs reads them). */
function actorFrom(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { doc = null; }
  if (!doc) return null;
  return (doc.documentName === "Actor") ? doc : (doc.actor ?? null);
}

/** Escape text for HTML, then set the action glyphs in the spend-glyph class the cards use. */
function glyphed(text) {
  const safe = foundry.utils.escapeHTML(String(text ?? ""));
  return safe.replace(/[⓿❶❷❸❹❺❻↺]+/g, m => `<span class="sw-spend-glyph">${m}</span>`);
}

/** HTML prose to a one-line tooltip. */
function plainText(html, max = 240) {
  const text = String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** One key per task: workflow, kind and target. Workflow ids are random ids, so "|" is safe. */
function taskKey(workflowId, kind, targetId) {
  return `${workflowId}|${kind}|${targetId ?? ""}`;
}

/* -------------------------------------------- */

export class SwCombatPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "sw-combat-prompt",
    classes: ["starwrought", "sw-combat-prompt"],
    position: { width: 360, height: "auto" },
    window: {
      title: "STARWROUGHT.Prompt.title",
      icon: "fa-solid fa-shield-halved",
      resizable: false,
      minimizable: true
    },
    actions: {
      commit: SwCombatPrompt.#onCommit,
      roll: SwCombatPrompt.#onRoll,
      choose: SwCombatPrompt.#onChoose
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: TEMPLATE, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Singleton and registration                  */
  /* -------------------------------------------- */

  static #instance = null;

  /** The one prompt window of this client, created on first use. */
  static get instance() {
    SwCombatPrompt.#instance ??= new SwCombatPrompt();
    return SwCombatPrompt.#instance;
  }

  static #registered = false;

  /**
   * Listen for the attack events the coordinator broadcasts, once. Importing this module registers
   * the listener; calling this again from init is harmless.
   */
  static register() {
    if (SwCombatPrompt.#registered) return;
    SwCombatPrompt.#registered = true;
    Hooks.on("starwrought.attack", event => SwCombatPrompt.#onAttackEvent(event));
  }

  /**
   * Focus the prompt on a workflow, opening it if it is closed (the attack card's "Open prompt").
   * @param {{workflowId?: string}} [options]
   * @returns {Promise<SwCombatPrompt>}
   */
  static async open({ workflowId = null } = {}) {
    return SwCombatPrompt.instance.show({ workflowId });
  }

  /**
   * Hand the prompt a task of its own, for the generic `choose` mode (follow-ups the coordinator
   * does not yet carry) and for driving the window without a live attack. The task needs `kind:
   * "choose"`, a `title`, `options: [{value, label, hint?}]`, and either an `onChoose(value)`
   * callback or an `action` for AttackCoordinator.request with `workflowId`, `targetId` and
   * `revision`. Returns the task key, which `removeTask` takes.
   * @param {object} task
   * @returns {string}
   */
  static pushTask(task) {
    const prompt = SwCombatPrompt.instance;
    const key = task.key ?? taskKey(task.workflowId ?? "local", task.kind ?? "choose", task.targetId ?? foundry.utils.randomID());
    prompt.#local.set(key, { ...task, key, kind: task.kind ?? "choose" });
    prompt.show({ workflowId: task.workflowId ?? null });
    return key;
  }

  /** Withdraw a task given to pushTask. */
  static removeTask(key) {
    const prompt = SwCombatPrompt.instance;
    if (prompt.#local.delete(key) && prompt.rendered) prompt.render();
  }

  /** The task key the prompt uses, so other code can name a task when it must. */
  static taskKey(workflowId, kind, targetId) {
    return taskKey(workflowId, kind, targetId);
  }

  /**
   * Every attack event: a `prompt` is an explicit call to act, so it reopens a window the user
   * closed; a `state`, `complete` or `cancelled` re-renders an open window and opens a closed one
   * only for tasks the user has not dismissed.
   */
  static #onAttackEvent(event = {}) {
    const prompt = SwCombatPrompt.instance;
    const id = event.workflow?.id ?? event.workflowId ?? null;
    if (event.type === "prompt") prompt.#undismiss(id);
    prompt.refresh({ open: event.type === "prompt" });
  }

  /* -------------------------------------------- */
  /*  State                                       */
  /* -------------------------------------------- */

  /** Per-task drafts before Commit: key -> {defense, answer, zone}; answer is "none", "reaction:<key>" or "posture:<talentId>". */
  #drafts = new Map();
  /** What this client committed, so the locked row can say so: "<workflowId>|<targetId>" -> {defense, reaction, posture, revision}. */
  #mine = new Map();
  /** Tasks whose last submit came back stale: key -> the time the notice expires. */
  #stale = new Map();
  /** Tasks with a request in flight. */
  #busy = new Set();
  /** Tasks the user closed the window on; a `prompt` event for the workflow clears them. */
  #dismissed = new Set();
  /** Tasks handed in by pushTask. */
  #local = new Map();
  /** The tasks of the last render, by key, for the button handlers. */
  #tasks = new Map();
  #closeTimer = null;
  #focusWorkflowId = null;
  #refocus = null;
  #placed = false;

  /* -------------------------------------------- */
  /*  Public surface                              */
  /* -------------------------------------------- */

  /**
   * Re-render in place. Closed, the window opens when the user has something to do that they did
   * not dismiss, or anything at all when `open` is set.
   * @param {{open?: boolean}} [options]
   */
  async refresh({ open = false } = {}) {
    if (this.rendered) return this.render();
    const tasks = this.#collectTasks();
    const pending = open ? tasks : tasks.filter(t => !this.#dismissed.has(t.key));
    if (pending.length) return this.render({ force: true });
    return this;
  }

  /**
   * Open or focus the window, scrolling to a workflow's tasks.
   * @param {{workflowId?: string|null}} [options]
   */
  async show({ workflowId = null } = {}) {
    this.#focusWorkflowId = workflowId;
    this.#undismiss(workflowId);
    await this.render({ force: true });
    this.bringToFront?.();
    return this;
  }

  /** Does the user have anything outstanding (a locked wait counts: the reveal is still to come). */
  hasTasks() {
    return this.#collectTasks().length > 0;
  }

  /** @inheritdoc */
  async close(options = {}) {
    this.#clearCloseTimer();
    // Closed by hand with work outstanding: remember, so a mere state change does not reopen it.
    if (!options.swAuto) for (const key of this.#tasks.keys()) this.#dismissed.add(key);
    return super.close(options);
  }

  /* -------------------------------------------- */
  /*  Tasks                                       */
  /* -------------------------------------------- */

  /** The live, unfinished workflows the coordinator knows about. */
  #workflows() {
    let live;
    try { live = AttackCoordinator.live?.() ?? []; }
    catch (err) { console.error("STARWROUGHT | live attack workflows could not be read", err); live = []; }
    if (live instanceof Map) live = [...live.values()];
    else if (!Array.isArray(live)) live = Array.from(live ?? []);
    return live.filter(wf => wf?.id && !ENDED.has(wf.phase));
  }

  /** The outstanding actions of this user on a workflow, as the workflow core lists them. */
  #outstanding(wf) {
    try { return AttackWorkflow.outstandingFor?.(wf, game.user) ?? []; }
    catch (err) { console.error("STARWROUGHT | outstanding actions could not be read", err); return []; }
  }

  /**
   * Did this client commit for the target against the workflow's current revision? True between
   * the coordinator's reply and its state broadcast; once the state moves the committed flag
   * takes over, and a later revision that asks again means the commitment was reset.
   */
  #committedHere(wf, targetId) {
    const mine = this.#mine.get(`${wf.id}|${targetId}`);
    return !!mine && (mine.revision === wf.revision);
  }

  /** Does this target's commitment belong to this user: committed here, or controlled by them. */
  #controls(wf, target) {
    if (this.#mine.has(`${wf.id}|${target.id}`)) return true;
    if (Array.isArray(target.controllerUserIds) && target.controllerUserIds.includes(game.user.id)) return true;
    // Adversaries are the GM's; a GM is also an owner of every character, which is not the same thing.
    return game.user.isGM && (target.isPlayer === false);
  }

  /** Every task to show, in workflow order, and the housekeeping that goes with a fresh look. */
  #collectTasks() {
    const workflows = this.#workflows();
    const liveIds = new Set(workflows.map(wf => wf.id));
    this.#prune(liveIds);

    const tasks = [];
    for (const wf of workflows) {
      const outstanding = this.#outstanding(wf);
      const locked = new Set();
      for (const o of outstanding) {
        const mode = MODES[o.kind] ?? o.kind;
        // Committed here at this very revision: the reply is back but the state broadcast is not.
        // Show the lock at once rather than the form again (and never void that commitment).
        if (((mode === "defend") || (mode === "gm")) && this.#committedHere(wf, o.targetId)) {
          const target = (wf.targets ?? []).find(t => t.id === o.targetId);
          if (target) {
            tasks.push(this.#lockedTask(wf, target));
            locked.add(target.id);
            continue;
          }
        }
        const task = this.#taskFor(wf, o);
        if (task) tasks.push(task);
      }
      if (wf.phase !== "defending") continue;
      // A defender who has committed waits on the others (brief: "locked").
      for (const target of wf.targets ?? []) {
        if (locked.has(target.id)) continue;
        if (!target.committed || !this.#controls(wf, target)) continue;
        if (outstanding.some(o => o.targetId === target.id)) continue;
        tasks.push(this.#lockedTask(wf, target));
      }
    }
    for (const task of this.#local.values()) tasks.push(this.#chooseTask(task));
    tasks.forEach((task, index) => {
      task.index = index;
      task.focus = !!this.#focusWorkflowId && (task.workflowId === this.#focusWorkflowId);
      task.disabled = task.disabled || this.#busy.has(task.key);
      const staleUntil = this.#stale.get(task.key);
      task.stale = (staleUntil && (staleUntil > Date.now())) ? game.i18n.localize("STARWROUGHT.Attack.stale") : null;
    });
    return tasks;
  }

  /** Forget drafts, commitments and dismissals of workflows that have ended. */
  #prune(liveIds) {
    const gone = key => !liveIds.has(key.split("|")[0]) && !key.startsWith("local|");
    for (const key of [...this.#drafts.keys()]) if (gone(key)) this.#drafts.delete(key);
    for (const key of [...this.#mine.keys()]) if (gone(key)) this.#mine.delete(key);
    for (const key of [...this.#dismissed]) if (gone(key)) this.#dismissed.delete(key);
    for (const [key, until] of [...this.#stale]) if (gone(key) || (until <= Date.now())) this.#stale.delete(key);
    if (this.#focusWorkflowId && !liveIds.has(this.#focusWorkflowId)) this.#focusWorkflowId = null;
  }

  #undismiss(workflowId) {
    for (const key of [...this.#dismissed]) {
      if (!workflowId || key.startsWith(`${workflowId}|`)) this.#dismissed.delete(key);
    }
  }

  /** One outstanding action into a task context. */
  #taskFor(wf, o) {
    const mode = MODES[o.kind] ?? o.kind;
    const target = (wf.targets ?? []).find(t => t.id === o.targetId) ?? null;
    switch (mode) {
      case "defend": return this.#defendTask(wf, o, target, false);
      case "gm": return this.#defendTask(wf, o, target, true);
      case "rollAttack":
      case "rollDefense": return this.#rollTask(wf, o, target, mode);
      case "choose": return this.#chooseTask({ ...o, key: taskKey(wf.id, "choose", o.targetId), revision: wf.revision });
      default: return null;
    }
  }

  /** "{attacker} uses {maneuver} against {defender}." with the Maneuver's glyph and weapon. */
  #maneuverText(wf) {
    const m = wf.maneuver ?? {};
    const kind = SW.STRIKE_KINDS[m.strike];
    const glyph = m.glyph ?? (kind ? SW.ACTION_GLYPHS[kind.cost] : "");
    let label = m.label ?? (kind ? game.i18n.localize(kind.label) : "");
    if (glyph && !label.includes(glyph)) label = `${glyph} ${label}`.trim();
    if (m.weaponName && !label.includes(m.weaponName)) label = `${label} (${m.weaponName})`;
    return label;
  }

  #defendText(wf, defenderName) {
    return glyphed(game.i18n.format("STARWROUGHT.Prompt.defendText", {
      attacker: wf.attacker?.name ?? "", maneuver: this.#maneuverText(wf), defender: defenderName ?? ""
    }));
  }

  /**
   * The draft for a defend task, seeded from the defender's standing stance (brief: the stance
   * chips are the DEFAULT pre-selection): its Defense, and its Reaction when that Reaction is a
   * legal answer on that Defense right now. The seed never changes the stance.
   */
  #draft(key, actor) {
    let draft = this.#drafts.get(key);
    if (draft) return draft;
    let defense = BLOW_DEFENSES[0];
    let reaction = null;
    try {
      const standing = actor.answeringDefense?.() ?? {};
      if (BLOW_DEFENSES.includes(standing.key)) defense = standing.key;
      reaction = standing.reaction ?? null;
    } catch (err) {
      console.warn("STARWROUGHT | the standing stance could not be read", err);
    }
    const legal = legalAnswers(actor, defense);
    draft = {
      defense,
      answer: (reaction && legal.reactions.includes(reaction)) ? `reaction:${reaction}` : "none",
      zone: ""
    };
    this.#drafts.set(key, draft);
    return draft;
  }

  /** Split a draft's answer into the commit payload's reaction and posture. */
  static #answerParts(draft) {
    const reaction = draft.answer.startsWith("reaction:") ? draft.answer.slice("reaction:".length) : null;
    const talentId = draft.answer.startsWith("posture:") ? draft.answer.slice("posture:".length) : null;
    const posture = talentId ? { talentId, zone: draft.zone || null } : null;
    return { reaction, posture };
  }

  /** The Threshold preview through the one helper that folds an answer in (actor.defenseThresholdFor). */
  #preview(actor, defense, reaction, posture) {
    if (typeof actor.defenseThresholdFor !== "function") return null;
    try {
      const read = actor.defenseThresholdFor({ defense, reaction, posture });
      if (!read || !Number.isFinite(read.threshold)) return null;
      return {
        threshold: read.threshold,
        text: game.i18n.format("STARWROUGHT.Prompt.preview", { threshold: read.threshold }),
        notes: [read.unavailable, read.note].filter(Boolean)
      };
    } catch (err) {
      console.warn("STARWROUGHT | the Threshold preview failed", err);
      return null;
    }
  }

  /** The basic Threshold of a Defense, for the radio: the same helper, no answer folded in. */
  #basicThreshold(actor, defense) {
    if (typeof actor.defenseThresholdFor === "function") {
      try {
        const read = actor.defenseThresholdFor({ defense });
        if (Number.isFinite(read?.threshold)) return read.threshold;
      } catch { /* fall through to the data model */ }
    }
    const threshold = actor.system?.defenses?.[defense]?.threshold;
    return Number.isFinite(threshold) ? threshold : null;
  }

  /** The defend and gm modes. */
  #defendTask(wf, o, target, gm) {
    const key = taskKey(wf.id, gm ? "gm" : "defend", o.targetId);
    const name = target?.name ?? "";
    const base = {
      key, kind: gm ? "gm" : "defend", isDefend: true,
      workflowId: wf.id, targetId: o.targetId, revision: wf.revision,
      title: gm ? game.i18n.format("STARWROUGHT.Prompt.gmDefend", { name }) : game.i18n.localize("STARWROUGHT.Prompt.defendTitle"),
      text: this.#defendText(wf, name)
    };
    const actor = actorFrom(target?.actorUuid) ?? actorFrom(target?.tokenUuid);
    if (!actor) return { ...base, error: game.i18n.localize("STARWROUGHT.Notify.noActor"), disabled: true };

    // Asked to choose again after the state moved past our commitment (a GM reset, or the
    // coordinator was lost): the old commitment is void. At the same revision it is simply not
    // broadcast yet, and #collectTasks shows the lock instead of reaching here.
    const mine = this.#mine.get(`${wf.id}|${o.targetId}`);
    if (mine && (wf.revision > mine.revision)) this.#mine.delete(`${wf.id}|${o.targetId}`);

    const draft = this.#draft(key, actor);
    const legal = legalAnswers(actor, draft.defense);
    // The Zone and the preview are shown to a player for their own character only (brief:
    // "a Threshold preview for a player-controlled defender, none for an adversary").
    const showThresholds = !gm && (target?.isPlayer !== false) && (actor.type === "character");

    const defenses = BLOW_DEFENSES.map(d => {
      const def = SW.DEFENSES[d];
      const row = actor.system?.defenses?.[d] ?? {};
      const blocked = row.unavailable ? game.i18n.localize(SW.CONDITIONS[row.unavailable]?.name ?? row.unavailable) : null;
      return {
        key: d,
        label: game.i18n.localize(def.label),
        hint: blocked
          ? game.i18n.format("STARWROUGHT.Stance.unavailableNote", { reason: blocked })
          : game.i18n.localize(def.hint),
        threshold: showThresholds ? this.#basicThreshold(actor, d) : null,
        active: d === draft.defense,
        unavailable: blocked
      };
    });

    const answers = [{
      value: "none",
      label: glyphed(game.i18n.localize("STARWROUGHT.Attack.answerNone")),
      hint: game.i18n.localize("STARWROUGHT.Roll.noReaction"),
      active: draft.answer === "none"
    }];
    for (const r of legal.reactions) {
      answers.push({
        value: `reaction:${r}`,
        label: glyphed(describeAnswer({ reaction: r })),
        hint: game.i18n.localize(`${SW.REACTIONS[r].label}Hint`),
        active: draft.answer === `reaction:${r}`,
        reaction: true
      });
    }
    for (const p of legal.postures) {
      const talent = actor.items?.get?.(p.talentId);
      // A root-granted Posture (Give Ground, Set Your Feet; 0.5.3) carries the Reaction table's
      // effect as its hint, since the root Talent's own text is the whole of Evade or Guard Training.
      const hint = p.hint || plainText(talent?.system?.effect) || game.i18n.localize("STARWROUGHT.Reaction.postureHint");
      answers.push({
        value: `posture:${p.talentId}`,
        label: glyphed(describeAnswer({ posture: { ...p, zone: null } }, actor)),
        hint,
        active: draft.answer === `posture:${p.talentId}`,
        posture: true
      });
    }
    if (!answers.some(a => a.active)) {
      draft.answer = "none";
      answers[0].active = true;
    }

    const { reaction, posture } = SwCombatPrompt.#answerParts(draft);
    const zones = posture
      ? Object.entries(SW.ZONES).sort((a, b) => a[1].order - b[1].order).map(([z, def]) => {
        const label = game.i18n.localize(def.label);
        return {
          key: z,
          label: actor.system?.zones?.[z]?.exposed ? game.i18n.format("STARWROUGHT.Prompt.zoneExposed", { zone: label }) : label,
          selected: z === draft.zone
        };
      })
      : null;

    return {
      ...base,
      defenses,
      answers,
      zones,
      zone: draft.zone,
      headWound: actor.system?.reactions?.blocked ? game.i18n.localize("STARWROUGHT.Prompt.headWound") : null,
      counterHint: legal.reactions.includes("counter") ? game.i18n.localize("STARWROUGHT.Prompt.counterNeedsMelee") : null,
      preview: showThresholds ? this.#preview(actor, draft.defense, reaction, posture) : null,
      // A Posture Exposes "a Zone of the defender's choice" (PHB v4.10): the choice is theirs to make, so
      // nothing is pre-picked and Commit waits for it.
      disabled: !!posture && !draft.zone
    };
  }

  /** The locked mode: committed, waiting on the rest. */
  #lockedTask(wf, target) {
    const key = taskKey(wf.id, "locked", target.id);
    const mine = this.#mine.get(`${wf.id}|${target.id}`);
    const actor = actorFrom(target.actorUuid) ?? actorFrom(target.tokenUuid);
    const targets = wf.targets ?? [];
    // A commitment made here and not yet broadcast counts as ready; the coordinator's flag follows.
    const ready = t => t.committed || this.#committedHere(wf, t.id);
    const awaited = targets.filter(t => !ready(t)).map(t => t.name).filter(Boolean);
    return {
      key, kind: "locked", isLocked: true,
      workflowId: wf.id, targetId: target.id, revision: wf.revision,
      title: game.i18n.localize("STARWROUGHT.Prompt.locked"),
      text: this.#defendText(wf, target.name),
      yourChoice: mine
        ? glyphed(game.i18n.format("STARWROUGHT.Prompt.yourChoice", {
          defense: game.i18n.localize(SW.DEFENSES[mine.defense]?.label ?? mine.defense),
          answer: describeAnswer(mine, actor)
        }))
        : null,
      ready: game.i18n.format("STARWROUGHT.Attack.readyCount", {
        n: targets.filter(ready).length, total: targets.length
      }),
      waitingFor: awaited.length ? game.i18n.format("STARWROUGHT.Prompt.waitingFor", { names: awaited.join(", ") }) : null
    };
  }

  /** The rollAttack and rollDefense modes: the revealed answers, then one button. */
  #rollTask(wf, o, target, mode) {
    const isAttack = mode === "rollAttack";
    const key = taskKey(wf.id, mode, o.targetId);
    const lines = [];
    const describe = t => {
      const revealed = t.revealed ?? {};
      const actor = actorFrom(t.actorUuid) ?? actorFrom(t.tokenUuid);
      const defense = revealed.defense ? game.i18n.localize(SW.DEFENSES[revealed.defense]?.label ?? revealed.defense) : "";
      const answer = describeAnswer(revealed, actor);
      return defense ? game.i18n.format("STARWROUGHT.Prompt.defenseAndAnswer", { defense, answer }) : answer;
    };
    if (isAttack) {
      lines.push(this.#defendText(wf, (wf.targets ?? []).map(t => t.name).join(", ")));
      for (const t of wf.targets ?? []) {
        if (!t.revealed) continue;
        lines.push(glyphed(game.i18n.format("STARWROUGHT.Prompt.revealedLine", { name: t.name, answer: describe(t) })));
      }
    } else {
      lines.push(this.#defendText(wf, target?.name));
      if (target?.revealed) {
        lines.push(glyphed(game.i18n.format("STARWROUGHT.Prompt.yourChoice", {
          defense: game.i18n.localize(SW.DEFENSES[target.revealed.defense]?.label ?? target.revealed.defense ?? ""),
          answer: describeAnswer(target.revealed, actorFrom(target.actorUuid) ?? actorFrom(target.tokenUuid))
        })));
      }
    }
    const roller = isAttack ? wf.attacker : target;
    return {
      key, kind: mode, isRoll: true,
      workflowId: wf.id, targetId: o.targetId, revision: wf.revision,
      title: game.i18n.format(isAttack ? "STARWROUGHT.Attack.attackerRolls" : "STARWROUGHT.Attack.defenderRolls", { name: roller?.name ?? "" }),
      text: null,
      lines,
      button: game.i18n.localize(isAttack ? "STARWROUGHT.Attack.rollAttack" : "STARWROUGHT.Attack.rollDefense")
    };
  }

  /** The generic choose mode. */
  #chooseTask(task) {
    const draft = this.#drafts.get(task.key) ?? { choice: task.selected ?? null };
    this.#drafts.set(task.key, draft);
    const options = (task.options ?? []).map(opt => ({
      value: opt.value,
      label: glyphed(opt.label ?? opt.value),
      hint: opt.hint ?? "",
      active: opt.value === draft.choice
    }));
    return {
      key: task.key, kind: "choose", isChoose: true,
      workflowId: task.workflowId ?? null, targetId: task.targetId ?? null, revision: task.revision ?? null,
      title: task.title ?? game.i18n.localize("STARWROUGHT.Prompt.choose"),
      text: task.text ? glyphed(task.text) : null,
      options,
      button: task.button ?? game.i18n.localize("STARWROUGHT.Prompt.choose"),
      disabled: !options.some(o => o.active)
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const tasks = this.#collectTasks();
    this.#tasks = new Map(tasks.map(t => [t.key, t]));
    return {
      tasks,
      empty: tasks.length === 0,
      keysHint: game.i18n.localize("STARWROUGHT.Prompt.keysHint")
    };
  }

  /** @inheritdoc */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    if (!this.#placed) {
      this.#placed = true;
      this.#placeBottomRight();
    }
    // Keys on the frame itself, so Escape works wherever the focus landed.
    const frame = this.element;
    if (frame && !frame.dataset.swKeys) {
      frame.dataset.swKeys = "1";
      frame.addEventListener("keydown", event => this.#onKeydown(event));
    }
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const body = this.element?.querySelector(".sw-combat-prompt-body");
    if (!body) return;
    // The part is rebuilt on every render, so its listeners are too.
    body.addEventListener("change", event => this.#onChange(event));

    if (this.#refocus) {
      const { field, task, value } = this.#refocus;
      this.#refocus = null;
      const section = body.querySelector(`[data-task="${CSS.escape(task)}"]`);
      const control = (field === "zone")
        ? section?.querySelector("select[data-field='zone']")
        : section?.querySelector(`input[data-field="${CSS.escape(field)}"][value="${CSS.escape(value)}"]`);
      control?.focus();
    } else if (this.#focusWorkflowId) {
      const section = body.querySelector(`[data-workflow-id="${CSS.escape(this.#focusWorkflowId)}"]`);
      section?.scrollIntoView?.({ block: "nearest" });
      (section ?? body).querySelector("input:checked, button[data-action]")?.focus();
      this.#focusWorkflowId = null;
    }

    this.#scheduleClose(context.empty);
  }

  /** Bottom-right of the game area, clear of the sidebar, the first time the window opens. */
  #placeBottomRight() {
    const width = Number(this.position?.width) || 360;
    const height = this.element?.offsetHeight || 320;
    const sidebar = ui.sidebar?.element?.offsetWidth ?? document.getElementById("sidebar")?.offsetWidth ?? 0;
    const margin = 24;
    const left = Math.max(0, window.innerWidth - sidebar - width - margin);
    const top = Math.max(0, window.innerHeight - height - margin);
    this.setPosition({ left, top });
  }

  /** Nothing outstanding: close a few seconds from now unless something arrives. */
  #scheduleClose(empty) {
    if (!empty) return this.#clearCloseTimer();
    if (this.#closeTimer) return;
    this.#closeTimer = setTimeout(() => {
      this.#closeTimer = null;
      if (this.rendered && !this.hasTasks()) this.close({ swAuto: true });
    }, AUTO_CLOSE_MS);
  }

  #clearCloseTimer() {
    if (this.#closeTimer) clearTimeout(this.#closeTimer);
    this.#closeTimer = null;
  }

  /* -------------------------------------------- */
  /*  Interaction                                 */
  /* -------------------------------------------- */

  /** A radio or the Zone select changed: update the draft and redraw that task. */
  #onChange(event) {
    const control = event.target;
    const field = control?.dataset?.field;
    const section = control?.closest?.("[data-task]");
    if (!field || !section) return;
    const key = section.dataset.task;
    const draft = this.#drafts.get(key);
    if (!draft) return;
    const value = control.value;

    if (field === "defense") {
      draft.defense = value;
      // An answer that is not legal on the new Defense (a Void under Guard) falls back to nothing.
      const task = this.#tasks.get(key);
      const actor = task ? this.#actorForTask(task) : null;
      if (actor) {
        const legal = legalAnswers(actor, value);
        const { reaction, posture } = SwCombatPrompt.#answerParts(draft);
        const stillLegal = reaction ? legal.reactions.includes(reaction)
          : posture ? legal.postures.some(p => p.talentId === posture.talentId)
          : true;
        if (!stillLegal) draft.answer = "none";
      }
    } else if (field === "answer") {
      draft.answer = value;
    } else if (field === "zone") {
      draft.zone = value;
    } else if (field === "choice") {
      draft.choice = value;
    } else return;

    this.#refocus = { field, task: key, value };
    this.render();
  }

  /** Enter commits the task under the cursor (or the first), Escape closes. */
  #onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key !== "Enter") return;
    const target = event.target;
    if (target?.tagName === "BUTTON" || target?.tagName === "TEXTAREA") return;
    const body = this.element?.querySelector(".sw-combat-prompt-body");
    const section = target?.closest?.("[data-task]") ?? body?.querySelector("[data-task]");
    const button = section?.querySelector("button[data-action]");
    if (!button || button.disabled) return;
    event.preventDefault();
    button.click();
  }

  #actorForTask(task) {
    const wf = this.#workflows().find(w => w.id === task.workflowId);
    const target = (wf?.targets ?? []).find(t => t.id === task.targetId);
    return actorFrom(target?.actorUuid) ?? actorFrom(target?.tokenUuid);
  }

  /** The task a button belongs to. */
  #taskOf(button) {
    const key = button.closest("[data-task]")?.dataset.task;
    return key ? this.#tasks.get(key) ?? null : null;
  }

  /**
   * Commit a Defense and its answer. Semantics only: the coordinator computes the Threshold and
   * revalidates the choice (brief: "A client submits semantic choices only").
   */
  static async #onCommit(event, button) {
    const task = this.#taskOf(button);
    if (!task?.isDefend || this.#busy.has(task.key)) return;
    const draft = this.#drafts.get(task.key);
    if (!draft) return;
    const { reaction, posture } = SwCombatPrompt.#answerParts(draft);
    if (posture && !posture.zone) return;

    this.#busy.add(task.key);
    this.render();
    try {
      const reply = await AttackCoordinator.request("commitDefense", {
        workflowId: task.workflowId,
        expectedRevision: task.revision,
        payload: { targetId: task.targetId, defense: draft.defense, reaction, posture }
      });
      if (reply?.ok) {
        this.#mine.set(`${task.workflowId}|${task.targetId}`, {
          defense: draft.defense, reaction, posture, revision: task.revision
        });
      } else if (reply?.reason === "stale") {
        // The attack moved on under us: say so on the task and let the next render read the live state.
        this.#stale.set(task.key, Date.now() + STALE_NOTICE_MS);
        // The coordinator already warned the requester once; the task carries the stale notice.
      }
      // Any other refusal was already warned to this user by the coordinator (brief: "Reject visibly").
    } catch (err) {
      console.error("STARWROUGHT | commitDefense failed", err);
      ui.notifications.error(err.message);
    } finally {
      this.#busy.delete(task.key);
      if (this.rendered) this.render();
    }
  }

  /** Roll Attack or Roll Defense: the roller's client rolls through the coordinator's own entry. */
  static async #onRoll(event, button) {
    const task = this.#taskOf(button);
    if (!task?.isRoll || this.#busy.has(task.key)) return;
    this.#busy.add(task.key);
    this.render();
    try {
      await AttackCoordinator.rollFor(task.workflowId, task.targetId);
    } catch (err) {
      console.error("STARWROUGHT | the roll could not be made", err);
      ui.notifications.error(err.message);
    } finally {
      this.#busy.delete(task.key);
      if (this.rendered) this.render();
    }
  }

  /** The generic choice: a callback when the task has one, else a coordinator request. */
  static async #onChoose(event, button) {
    const task = this.#taskOf(button);
    if (!task?.isChoose || this.#busy.has(task.key)) return;
    const draft = this.#drafts.get(task.key);
    const value = draft?.choice ?? null;
    if (value === null || value === undefined) return;
    const source = this.#local.get(task.key);
    this.#busy.add(task.key);
    this.render();
    try {
      if (typeof source?.onChoose === "function") await source.onChoose(value, task);
      else if (source?.action ?? task.action) {
        const reply = await AttackCoordinator.request(source?.action ?? task.action, {
          workflowId: task.workflowId,
          expectedRevision: task.revision,
          payload: { targetId: task.targetId, value }
        });
        if (reply && !reply.ok && (reply.reason === "stale")) {
          this.#stale.set(task.key, Date.now() + STALE_NOTICE_MS);
          // The coordinator already warned the requester once; the task carries the stale notice.
          return;
        }
      }
      this.#local.delete(task.key);
      this.#drafts.delete(task.key);
    } catch (err) {
      console.error("STARWROUGHT | the choice could not be made", err);
      ui.notifications.error(err.message);
    } finally {
      this.#busy.delete(task.key);
      if (this.rendered) this.render();
    }
  }
}

/** Register the attack-event listener; also exported for an explicit call at init. */
export function registerCombatPrompt() {
  SwCombatPrompt.register();
}

// Importing the module is enough to listen; Hooks exists before any system module is evaluated.
if (globalThis.Hooks?.on) SwCombatPrompt.register();
