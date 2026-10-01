/**
 * The attack card: one evolving ChatMessage per attack workflow (0.5.0 brief, "The three
 * surfaces"). It is the table's shared record and status board for a declared Blow: attacker and
 * Maneuver, each target with its status (Waiting / Committed / the revealed Defense and answer /
 * the outcome), the rolls once made, who is awaited, the GM's recovery controls, and the one
 * context-sensitive button that is the viewing user's. Decisions are made in the Combat Prompt;
 * recovery is made here.
 *
 * Two rules shape this file:
 *  - The coordinator authors the card. Only a message's author or a GM may update a ChatMessage,
 *    so `updateAttackCard` is called by the coordinator's client alone: it creates the message on
 *    the first call and `message.update`s it afterwards. The message carries
 *    `flags.starwrought = { kind: "attackWorkflow", attackWorkflow: <public state> }` and speaks as
 *    the attacker.
 *  - Privacy is memory, not whispers. Foundry sends every message to every client, so the content
 *    and the flags hold public state only (`publicStateOf` whitelists the brief's fields), and an
 *    adversary's Threshold is never in that state. What differs per viewer is pruned in the render
 *    hook (module/documents/chat.mjs) from markers this template emits: `data-owner-uuid` on each
 *    button, `data-gm-only` on the GM controls, `data-sw-threshold-for` on a character's Threshold.
 *    `renderAttackCard(workflow, { forUser })` applies the same policy at render time instead, for
 *    a caller that wants one user's view of the card.
 *
 * KEEP THIS MODULE FREE OF FOUNDRY GLOBALS AT MODULE SCOPE: the scratchpad render test imports it
 * from plain Node with `game` and `foundry` mocked after import.
 */

import * as SW from "../config.mjs";

/** The template every render of the card goes through. */
export const ATTACK_CARD_TEMPLATE = "systems/starwrought/templates/chat/attack-workflow-card.hbs";

/** `flags.starwrought.kind` on an attack card. */
export const CARD_KIND = "attackWorkflow";

/** A workflow in one of these phases is finished: no buttons, no GM controls. */
export const TERMINAL_PHASES = Object.freeze(["complete", "cancelled"]);

/** Phases in which defenders are still committing (brief, "Coordination": declared -> defending). */
const DEFENDING_PHASES = Object.freeze(["declared", "defending"]);

/**
 * The public state's fields (brief, "Data shapes"). Nothing outside this list reaches the card's
 * content or flags, however the coordinator's own record is shaped, so a private commitment can
 * never leak through this module.
 */
const PUBLIC_KEYS = Object.freeze([
  "id", "revision", "phase", "coordinatorUserId", "initiatingUserId",
  "attacker", "maneuver", "targets", "attackRoll", "log", "messageId"
]);
const TARGET_KEYS = Object.freeze([
  "id", "actorUuid", "tokenUuid", "name", "isPlayer", "controllerUserIds",
  "committed", "revealed", "roller", "rollType", "roll", "outcome", "threshold", "resolutionMessageId"
]);

/* -------------------------------------------- */
/*  State                                       */
/* -------------------------------------------- */

/**
 * The public state of a workflow as a plain object, whether the caller hands over the public
 * projection itself or the coordinator's live record (an instance with `toJSON()`, or a `public`
 * property, is read through it).
 * @param {object} workflow
 * @returns {object}
 */
export function publicStateOf(workflow) {
  if (!workflow) return null;
  let source = workflow;
  if (typeof workflow.toJSON === "function") source = workflow.toJSON();
  else if (workflow.public && (typeof workflow.public === "object")) source = workflow.public;

  const clone = value => foundry.utils.deepClone(value);
  const state = {};
  for (const key of PUBLIC_KEYS) {
    if (key in source) state[key] = clone(source[key]);
    else if (key in workflow) state[key] = clone(workflow[key]);
    else state[key] = null;
  }
  state.targets = Array.isArray(state.targets)
    ? state.targets.map(target => {
      const row = {};
      for (const key of TARGET_KEYS) row[key] = (key in target) ? target[key] : null;
      row.committed = !!row.committed;
      return row;
    })
    : [];
  state.log = Array.isArray(state.log) ? state.log : [];
  return state;
}

/** Whether the workflow is still in play. */
export function isLive(state) {
  return !!state && !TERMINAL_PHASES.includes(state.phase);
}

/* -------------------------------------------- */
/*  Visibility policy                           */
/* -------------------------------------------- */

/** The Actor behind a uuid that names an Actor or a Token, or null. */
function actorFor(uuid) {
  if (!uuid) return null;
  let doc = null;
  try { doc = fromUuidSync(uuid); } catch { return null; }
  if (!doc) return null;
  return (doc.documentName === "Actor") ? doc : (doc.actor ?? null);
}

/**
 * May this user act for the actor a button is for? Owner permission; a GM passes, as everywhere
 * in the system ("the GM sees them all", FEATURES.md).
 * @param {User} user
 * @param {string} actorUuid
 * @returns {boolean}
 */
export function canActFor(user, actorUuid) {
  if (!user) return false;
  const actor = actorFor(actorUuid);
  if (!actor) return !!user.isGM;
  return actor.testUserPermission(user, "OWNER");
}

/**
 * May this user use the GM controls on a workflow (Cancel, Reset defenses, Resend prompts, Answer
 * with standing stances)? The GM always; at a table with no GM connected, the workflow's
 * coordinator (the attacker's client), so an absent defender never holds the table. The card, the
 * click handler and the coordinator's own check all read this one definition (review,
 * 2026-10-01). Reads `game` at call time only: this module stays free of Foundry globals at module
 * scope.
 * @param {User} user
 * @param {object} state   The public state (or the coordinator's record).
 * @returns {boolean}
 */
export function mayControl(user, state) {
  if (!user) return false;
  if (user.isGM) return true;
  let gmActive = false;
  try { gmActive = !!game.users?.activeGM; } catch { gmActive = false; }
  return !gmActive && !!state?.coordinatorUserId && (user.id === state.coordinatorUserId);
}

/**
 * The brief's Threshold visibility policy (brief, "Visibility"): a player-controlled defender's
 * Threshold is shown to that defender's owner and to the GM always, and to the attacker's owner
 * only when the world setting `attackShowPcThresholds` is on. An adversary's Threshold is never
 * shown to anyone from the card, whatever the state carries: players see outcomes, never the
 * number (the GM reads it from the sheet). A presentation rule, applied here and in the render
 * hook, never in the resolver.
 * @param {User} user
 * @param {object} state     The public state.
 * @param {object} target    One of `state.targets`.
 * @returns {boolean}
 */
export function thresholdVisibleTo(user, state, target) {
  if (!user || !target) return false;
  if (target.threshold === null || target.threshold === undefined || target.threshold === "") return false;
  if (!target.isPlayer) return false;
  if (user.isGM) return true;
  if (canActFor(user, target.actorUuid)) return true;
  if (showPcThresholdsToAttacker() && canActFor(user, state?.attacker?.actorUuid)) return true;
  return false;
}

/** The world setting, read safely: false until the setting is registered. */
function showPcThresholdsToAttacker() {
  try { return !!game.settings.get(SW.SYSTEM_ID, "attackShowPcThresholds"); }
  catch { return false; }
}

/* -------------------------------------------- */
/*  Context                                     */
/* -------------------------------------------- */

/** Outcome key (miss, graze, hit, critical) to its label key. */
function outcomeLabelKey(key) {
  for (const band of Object.values(SW.ATTACK_OUTCOMES)) {
    if (band.key === key) return band.label;
  }
  return "";
}

/** "{name} {glyph}" for a Reaction: "Parry ❶↺". */
function reactionAnswer(key) {
  const reaction = SW.REACTIONS[key];
  if (!reaction) return "";
  return game.i18n.format("STARWROUGHT.Attack.answerReaction", {
    name: game.i18n.localize(reaction.label),
    glyph: `${SW.ACTION_GLYPHS[reaction.cost] ?? ""}${SW.REACTION_GLYPH}`
  });
}

/**
 * The answer a defender revealed, as text: "No Reaction: the basic Defense", "Parry ❶↺" or
 * "Slip the Line ⓿↺ (Expose Arms)". A commitment is a Reaction or a Posture, never both.
 */
function answerText(revealed) {
  if (!revealed) return "";
  if (revealed.posture) {
    const zone = SW.ZONES[revealed.posture.zone];
    return game.i18n.format("STARWROUGHT.Attack.answerPosture", {
      name: revealed.posture.name ?? "",
      zone: zone ? game.i18n.localize(zone.label) : (revealed.posture.zone ?? "")
    });
  }
  if (revealed.reaction) return reactionAnswer(revealed.reaction);
  return game.i18n.localize("STARWROUGHT.Attack.answerNone");
}

/** The localized name of a roll kind, for "{kind} roll: {total}" and "Waiting for {name} to roll {kind}". */
function rollKindLabel(rollType) {
  return game.i18n.localize(rollType === "defense" ? "STARWROUGHT.Attack.kindDefense" : "STARWROUGHT.Attack.kindAttack");
}

/**
 * The one status line (brief, "Attack card": who is awaited). One text per phase:
 * Waiting for defenses / {n} of {total} defenders ready / Defenses revealed /
 * Waiting for {name} to roll {kind} / Resolving / Complete / Cancelled by the GM.
 */
function statusLine(state) {
  const L = key => game.i18n.localize(key);
  const F = (key, data) => game.i18n.format(key, data);
  const targets = state.targets;
  switch (state.phase) {
    case "declared":
      return L("STARWROUGHT.Attack.waitingDefenses");
    case "defending": {
      const n = targets.filter(t => t.committed).length;
      return n ? F("STARWROUGHT.Attack.readyCount", { n, total: targets.length }) : L("STARWROUGHT.Attack.waitingDefenses");
    }
    case "revealed":
      return L("STARWROUGHT.Attack.revealed");
    case "rolling": {
      // Who still has a die to throw: the attacker once for every pairing they roll, each
      // player-controlled defender of an adversary's Blow for their own (brief, "Who rolls").
      const groups = new Map();
      const add = (kind, name) => {
        if (!groups.has(kind)) groups.set(kind, []);
        if (!groups.get(kind).includes(name)) groups.get(kind).push(name);
      };
      if (!state.attackRoll && targets.some(t => (t.roller === "attacker") && !t.outcome)) {
        add(rollKindLabel("attack"), state.attacker?.name ?? "");
      }
      for (const t of targets) {
        if ((t.roller === "defender") && !t.roll && !t.outcome) add(rollKindLabel(t.rollType ?? "defense"), t.name);
      }
      if (!groups.size) return L("STARWROUGHT.Attack.resolving");
      return [...groups.entries()]
        .map(([kind, names]) => F("STARWROUGHT.Attack.waitingRoll", { name: names.join(", "), kind }))
        .join("; ");
    }
    case "complete":
      return L("STARWROUGHT.Attack.complete");
    case "cancelled":
      return L("STARWROUGHT.Attack.cancelled");
    case "resolving":
    default:
      return L("STARWROUGHT.Attack.resolving");
  }
}

/**
 * The per-user button on a target row: the one action that is this defender's right now.
 * Choose Defense while uncommitted, Open prompt once committed (to see the locked choice and who
 * is awaited), Roll Defense when the roll is theirs. The GM owns everything, so the GM sees them
 * all; that is the system's rule for every card.
 */
function targetButton(state, target) {
  const L = key => game.i18n.localize(key);
  if (!isLive(state)) return null;
  if (DEFENDING_PHASES.includes(state.phase)) {
    return target.committed
      ? { action: "attackOpenPrompt", label: L("STARWROUGHT.Attack.openPrompt"), icon: "fa-solid fa-window-restore" }
      : { action: "attackOpenPrompt", label: L("STARWROUGHT.Attack.chooseDefense"), icon: "fa-solid fa-shield-halved" };
  }
  if (state.phase === "revealed") {
    return { action: "attackOpenPrompt", label: L("STARWROUGHT.Attack.openPrompt"), icon: "fa-solid fa-window-restore" };
  }
  if ((state.phase === "rolling") && (target.roller === "defender") && !target.roll && !target.outcome) {
    return { action: "attackRoll", label: L("STARWROUGHT.Attack.rollDefense"), icon: "fa-solid fa-dice-d20" };
  }
  return null;
}

/**
 * The attacker's button: Roll Attack, once, while any pairing waits on the attacker's die. The
 * target id it carries is the first such pairing; the coordinator reads the one roll against every
 * pairing the attacker rolls (brief, "Who rolls").
 */
function attackerButton(state) {
  if (state.phase !== "rolling" || state.attackRoll) return null;
  const pending = state.targets.find(t => (t.roller === "attacker") && !t.outcome);
  if (!pending) return null;
  return {
    action: "attackRoll",
    label: game.i18n.localize("STARWROUGHT.Attack.rollAttack"),
    icon: "fa-solid fa-dice-d20",
    targetId: pending.id
  };
}

/**
 * The GM controls offered in this phase (brief, "Coordination" and "The absent player"). Cancel
 * and Resend prompts while the workflow lives; Reset defenses once there are commitments to clear;
 * Answer with standing stances while defenders are still committing.
 */
function gmControls(state) {
  if (!isLive(state)) return null;
  const L = key => game.i18n.localize(key);
  return {
    cancel: true, cancelLabel: L("STARWROUGHT.Attack.cancel"),
    resend: true, resendLabel: L("STARWROUGHT.Attack.resend"),
    reset: ["defending", "revealed"].includes(state.phase), resetLabel: L("STARWROUGHT.Attack.resetDefenses"),
    useStances: DEFENDING_PHASES.includes(state.phase) && state.targets.some(t => !t.committed),
    useStancesLabel: L("STARWROUGHT.Attack.useStances")
  };
}

/**
 * The render context for attack-workflow-card.hbs.
 * @param {object} state                The public state (see `publicStateOf`).
 * @param {object} [options]
 * @param {User|null} [options.forUser] Render one user's view: buttons they can act on, Thresholds
 *                                      they may see, GM controls only for a GM. Omitted, the card
 *                                      carries everything and the render hook prunes per viewer.
 * @returns {object}
 */
export function attackCardContext(state, { forUser = null } = {}) {
  const L = key => game.i18n.localize(key);
  const F = (key, data) => game.i18n.format(key, data);

  const strike = SW.STRIKE_KINDS[state.maneuver?.strike] ?? null;
  const glyph = strike ? (SW.ACTION_GLYPHS[strike.cost] ?? "") : (state.maneuver?.glyph ?? "");
  const kindLabel = strike ? L(strike.label) : (state.maneuver?.label ?? "");
  const kind = `${kindLabel} ${L("STARWROUGHT.Strike.kind")}`.trim();
  const weapon = state.maneuver?.weaponName ?? "";
  const maneuverText = `${kind} ${glyph}${weapon ? ` (${weapon})` : ""}`.trim();
  const attackerName = state.attacker?.name ?? "";
  const attackerUuid = state.attacker?.actorUuid ?? "";
  const attackerActor = actorFor(attackerUuid);

  const targets = state.targets.map(target => {
    const revealed = target.revealed ?? null;
    const defense = revealed?.defense ? SW.DEFENSES[revealed.defense] : null;
    let status;
    if (revealed) status = defense ? L(defense.label) : (revealed.defense ?? "");
    else status = target.committed ? L("STARWROUGHT.Attack.committed") : L("STARWROUGHT.Attack.waiting");

    // "vs 14" is the number the attacker's die meets, so it is printed only where the attacker
    // rolls. Where the defender rolls, the die meets the adversary's Attack Threshold instead, which
    // the card withholds, and printing the defender's own Threshold beside their Defense roll would
    // read as the number that roll was measured against (live test, 2026-10-01).
    const showThreshold = (target.roller !== "defender") && (forUser
      ? thresholdVisibleTo(forUser, state, target)
      : (target.isPlayer && (target.threshold !== null) && (target.threshold !== undefined) && (target.threshold !== "")));
    let button = targetButton(state, target);
    if (button && forUser && !canActFor(forUser, target.actorUuid)) button = null;

    return {
      id: target.id,
      name: target.name,
      actorUuid: target.actorUuid,
      tokenUuid: target.tokenUuid,
      isPlayer: !!target.isPlayer,
      committed: target.committed,
      status,
      answer: revealed ? answerText(revealed) : "",
      // A defender's own Defense roll; the attacker's one roll is printed once, above the list.
      roll: (target.roll && (target.roller === "defender"))
        ? F("STARWROUGHT.Attack.rolled", { kind: rollKindLabel(target.rollType ?? "defense"), total: target.roll.total })
        : "",
      outcome: target.outcome ? { key: target.outcome, label: L(outcomeLabelKey(target.outcome)) } : null,
      threshold: showThreshold ? F("STARWROUGHT.Attack.vs", { threshold: target.threshold }) : "",
      resolutionMessageId: target.resolutionMessageId ?? null,
      button
    };
  });

  let attackerBtn = attackerButton(state);
  if (attackerBtn && forUser && !canActFor(forUser, attackerUuid)) attackerBtn = null;
  let gm = gmControls(state);
  if (gm && forUser && !mayControl(forUser, state)) gm = null;

  return {
    workflowId: state.id,
    revision: state.revision ?? 0,
    phase: state.phase,
    live: isLive(state),
    title: L("STARWROUGHT.Attack.title"),
    img: attackerActor?.img ?? "",
    attackerName,
    attackerUuid,
    maneuver: { glyph, kind, weapon, text: maneuverText },
    declared: F("STARWROUGHT.Attack.declared", {
      attacker: attackerName,
      maneuver: maneuverText,
      targets: state.targets.map(t => t.name).join(", ")
    }),
    status: statusLine(state),
    attackRoll: state.attackRoll
      ? F("STARWROUGHT.Attack.rolled", { kind: rollKindLabel("attack"), total: state.attackRoll.total })
      : "",
    attackerButton: attackerBtn,
    targets,
    log: state.log.map(line => (typeof line === "string") ? line : (line?.text ?? "")).filter(Boolean),
    gm
  };
}

/* -------------------------------------------- */
/*  Rendering and the message                   */
/* -------------------------------------------- */

/**
 * Render the card.
 * @param {object} workflow             The workflow (public state or the coordinator's record).
 * @param {object} [options]
 * @param {User|null} [options.forUser] One user's view; omitted, the full card for the hook to prune.
 * @returns {Promise<string>}           HTML.
 */
export async function renderAttackCard(workflow, { forUser = null } = {}) {
  const state = publicStateOf(workflow);
  if (!state) return "";
  const { renderTemplate } = foundry.applications.handlebars;
  return renderTemplate(ATTACK_CARD_TEMPLATE, attackCardContext(state, { forUser }));
}

/** The attacker as the speaker: their token when it is on a scene, else the actor, else the name. */
function speakerFor(state) {
  const actor = actorFor(state.attacker?.actorUuid);
  let token = null;
  try {
    const doc = state.attacker?.tokenUuid ? fromUuidSync(state.attacker.tokenUuid) : null;
    if (doc?.documentName === "Token") token = doc;
  } catch { token = null; }
  if (!actor && !token) return ChatMessage.getSpeaker({ alias: state.attacker?.name ?? "" });
  return ChatMessage.getSpeaker({ actor: actor ?? undefined, token: token ?? undefined });
}

/** The flags the card carries: the kind, and the public state alone. */
function flagsFor(state) {
  return { kind: CARD_KIND, attackWorkflow: state };
}

/**
 * Create or update the card. Called by the coordinator alone (brief, "The coordinator authors the
 * card"): the first call creates the message, with an id chosen up front so the state can carry
 * its own `messageId` from the start; every later call is a `message.update` of the content and
 * the flags by the same client. The workflow handed in gets `messageId` written back on creation.
 * @param {object} workflow
 * @returns {Promise<ChatMessage|null>}
 */
export async function updateAttackCard(workflow) {
  const state = publicStateOf(workflow);
  if (!state) return null;

  const existing = state.messageId ? game.messages.get(state.messageId) : null;
  if (!existing) {
    const id = (state.messageId && !game.messages.get(state.messageId)) ? state.messageId : foundry.utils.randomID();
    state.messageId = id;
    if (workflow && (typeof workflow === "object")) {
      try { workflow.messageId = id; } catch { /* a frozen projection: the coordinator keeps its own */ }
    }
    const content = await renderAttackCard(state);
    return ChatMessage.create({
      _id: id,
      speaker: speakerFor(state),
      content,
      flags: { [SW.SYSTEM_ID]: flagsFor(state) }
    }, { keepId: true });
  }

  const content = await renderAttackCard(state);
  await existing.update({
    content,
    [`flags.${SW.SYSTEM_ID}`]: flagsFor(state)
  });
  return existing;
}
