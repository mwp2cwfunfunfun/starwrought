/**
 * The cards the round posts, and their buttons (PHB v4.10; Wind as PHB v4.13 has it).
 *
 * documents/combat.mjs decides WHEN: at the start of a round a Recovery reminder for each Dying
 * character; at its end a Persistent Damage card per source and a Wind card for a fighter whose
 * Endure Threshold falls short; at an Opportunity the Prepared Maneuver's finish-or-abandon card;
 * and a note when someone Passes while Preparing. This module decides what each card SAYS and what
 * its buttons do: Roll Recovery, Endure against the Wind Threshold and the Fatigued it raises, the
 * ten minutes' rest that ends Fatigued (ruling 81), the Persistent roll and the Endure that ends
 * it, Finish and Abandon. Every handler is registered in `cardActions` (helpers/cards.mjs) by
 * `registerRoundCards`, which `registerCombatTracking` calls, and every button acts for its
 * actor's owner only (`requireOwner`). `persistentDamageOf`, what is still hurting an actor, is
 * here too, since the card is the one reader of it. Through 0.10.0 all of this lived in
 * documents/combat.mjs.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { cardActions, cardHtml, postCard, ownersOf, tableFor, requireOwner } from "../../helpers/cards.mjs";

const { escapeHTML } = foundry.utils;
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/** Register the round's card buttons in `cardActions`. Idempotent, since the map is keyed. */
export function registerRoundCards() {
  cardActions.set("rollRecovery", onRollRecovery);
  cardActions.set("windCheck", onWindCheck);
  cardActions.set("windRest", onWindRest);
  cardActions.set("persistentRoll", onPersistentRoll);
  cardActions.set("persistentEndure", onPersistentEndure);
  cardActions.set("finishPrepared", onFinishPrepared);
  cardActions.set("abandonPrepared", onAbandonPrepared);
}

/* -------------------------------------------- */
/*  The cards                                   */
/* -------------------------------------------- */

export async function postRecoveryReminder(actor, round) {
  const dying = Number(actor.system.dying) || 0;
  const wounds = Number(actor.system.woundCount) || 0;
  const threshold = SW.RECOVERY_BASE + dying + wounds;
  const content = cardHtml({
    root: "sw-round-card sw-recovery-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Roll.recovery"),
    lines: [format("STARWROUGHT.Combat.recoveryText", {
      name: escapeHTML(actor.name), round, dying, wounds, threshold
    })],
    notes: [localize("STARWROUGHT.Combat.recoveryOutcomes"), localize("STARWROUGHT.Combat.recoveryHelp")],
    buttons: [{ action: "rollRecovery", icon: "fa-solid fa-heart-pulse", label: localize("STARWROUGHT.Combat.recoveryRoll") }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

/**
 * The Endure Threshold the Wind rule compares (PHB v4.12, ruling 74): the character model's own
 * reading when it has one, else the Defense as the sheet shows it, else the bare 10.
 */
export function endureThresholdOf(actor) {
  const derived = Number(actor.system.wind?.endureThreshold);
  if (Number.isFinite(derived)) return derived;
  const shown = Number(actor.system.defenses?.endure?.threshold);
  return Number.isFinite(shown) ? shown : 10;
}

export async function postWindReminder(actor, strain, round, fatigued = 0) {
  const threshold = 10 + strain;
  // The card says why it came: the Endure Threshold that fell short of the Wind Threshold.
  const endure = endureThresholdOf(actor);
  // What a failure would make of them: Fatigued 1, or one more than they carry now.
  const next = Math.min(SW.FATIGUED_MAX, fatigued + 1);
  const content = cardHtml({
    root: "sw-round-card sw-wind-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.wind"),
    lines: [format("STARWROUGHT.Combat.windText", { name: escapeHTML(actor.name), round, strain, threshold, endure, next })],
    notes: [
      fatigued ? format("STARWROUGHT.Combat.windCarrying", { name: escapeHTML(actor.name), value: fatigued }) : "",
      localize("STARWROUGHT.Combat.windNote")
    ],
    buttons: [{
      action: "windCheck", icon: "fa-solid fa-lungs",
      label: format("STARWROUGHT.Combat.endureVs", { threshold })
    }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

export async function postPersistentReminder(actor, source, round) {
  const type = damageLabel(source.type);
  const lines = [format("STARWROUGHT.Combat.persistentText", {
    name: escapeHTML(actor.name), round, formula: escapeHTML(source.formula), type
  })];
  const notes = [localize("STARWROUGHT.Combat.persistentNote")];
  if (source.source === "torsoWound") notes.push(localize("STARWROUGHT.Combat.persistentWoundNote"));
  const content = cardHtml({
    root: "sw-round-card sw-persistent-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.persistent"),
    lines,
    notes,
    buttons: [{
      action: "persistentRoll", icon: "fa-solid fa-droplet",
      label: format("STARWROUGHT.Combat.persistentRoll", { formula: escapeHTML(source.formula), type }),
      data: { formula: source.formula, type: source.type, source: source.source ?? "" }
    }]
  });
  return postCard(actor, content, { whisper: ownersOf(actor) });
}

export async function postPreparedCard(actor, preparing, combat) {
  const cost = Number(preparing.cost) || SW.PREPARED_THRESHOLD;
  const reserved = Number(actor.system.actions?.reserved) || Math.max(0, cost - 1);
  const label = preparing.label || (preparing.strike ? localize(SW.STRIKE_KINDS[preparing.strike]?.label ?? "STARWROUGHT.Roll.strike") : localize("STARWROUGHT.Condition.preparing"));
  const content = cardHtml({
    root: "sw-prepared-card",
    actorUuid: actor.uuid,
    glyph: SW.ACTION_GLYPHS[cost] ?? "",
    title: localize("STARWROUGHT.Condition.preparing"),
    lines: [format("STARWROUGHT.Combat.preparedText", {
      name: escapeHTML(actor.name), label: escapeHTML(label), cost, reserved, round: combat.round
    })],
    notes: [localize("STARWROUGHT.Combat.preparedNote")],
    buttons: [
      { action: "finishPrepared", icon: "fa-solid fa-check", label: localize("STARWROUGHT.Combat.preparedFinish") },
      { action: "abandonPrepared", icon: "fa-solid fa-xmark", label: localize("STARWROUGHT.Combat.preparedAbandon") }
    ]
  });
  // Preparation "is telegraphed by design", so the card is public; the buttons still check ownership.
  return postCard(actor, content);
}

export async function announcePassWhilePreparing(actor) {
  const label = actor.system.actions.preparing?.label || localize("STARWROUGHT.Condition.preparing");
  const body = format("STARWROUGHT.Combat.passWhilePreparing", { name: escapeHTML(actor.name), label: escapeHTML(label) });
  ui.notifications.warn(body);
  return postCard(actor, cardHtml({
    root: "sw-overspend sw-pass-note",
    actorUuid: actor.uuid,
    title: `<i class="fa-solid fa-triangle-exclamation"></i> ${localize("STARWROUGHT.Actions.overTitle")}`,
    lines: [body],
    notes: [localize("STARWROUGHT.Actions.overNote")]
  }), { whisper: ownersOf(actor) });
}

/** A damage type's printed name. */
function damageLabel(type) {
  const key = SW.DAMAGE_TYPES[type]?.label;
  return key ? localize(key) : escapeHTML(String(type ?? ""));
}

/**
 * What is still hurting this actor, as `{type, formula, source?}` rows.
 *
 * The contract's data model carries no Persistent Damage field, so this reads, in order: an array,
 * map or string at `system.persistentDamage` (rows of `{type, formula}`, a `{type: formula}` map,
 * or "1d4 bleed"), the same shapes under `flags.starwrought.persistentDamage`, and then the one
 * source the engine itself creates: a Torso Wound. PHB v4.10's Wounds table makes the first Torso
 * Wound "Off-Guard, and 1d4 persistent bleed", every Wound short of the final one repeats it, and
 * the effect is "made lasting: it does not clear when you Recenter, only when the Wound is
 * treated". Ruling: the bleed runs at the end of every round while the Wound stands, and the
 * ordinary Endure check to end Persistent Damage does not close it; treating the Wound does.
 */
export function persistentDamageOf(actor) {
  const rows = [];
  const push = (type, formula, source) => {
    if (!formula) return;
    rows.push({ type: String(type || "untyped"), formula: String(formula).trim(), source });
  };
  const read = (raw, source) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (!row) continue;
        if (typeof row === "string") parseRow(row, source);
        else push(row.type, row.formula ?? row.amount ?? row.value, source);
      }
    } else if (typeof raw === "string") parseRow(raw, source);
    else if (typeof raw === "object") for (const [type, formula] of Object.entries(raw)) push(type, formula, source);
  };
  const parseRow = (text, source) => {
    const m = String(text).match(/^\s*([\dd+\-\s]+?)\s*(?:persistent\s+)?([a-z]+)?\s*$/i);
    if (m) push(m[2]?.toLowerCase() ?? "untyped", m[1], source);
  };

  read(actor.system.persistentDamage, "system");
  read(actor.getFlag?.(SW.SYSTEM_ID, "persistentDamage"), "flag");

  const torso = actor.system.zones?.torso;
  const wounds = Number(torso?.wounds) || 0;
  if ((wounds > 0) && !rows.some(r => r.type === "bleed")) {
    const capacity = Number(torso.capacity) || SW.WOUND_CAPACITY[actor.system.size] || 2;
    const bleeding = Math.min(wounds, Math.max(0, capacity - 1));
    const die = SW.TORSO_WOUND_BLEED.replace(/^\d+/, "");
    if (bleeding > 0) push("bleed", `${bleeding}${die}`, "torsoWound");
  }
  return rows;
}

/* -------------------------------------------- */
/*  The buttons                                 */
/* -------------------------------------------- */

async function onRollRecovery({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.rollRecovery !== "function") return;
  return actor.rollRecovery();
}

/**
 * Wind (PHB v4.13, Load and Load Strain): Endure against 10 + Load Strain, read live at the click,
 * and on a failure Fatigued raised by 1 to a maximum of 3: -N Condition to Evade, Guard and attack
 * rolls until ten minutes of rest. The card names the new value and carries the "Ten minutes'
 * rest" button that ends the condition (onWindRest, ruling 81).
 */
async function onWindCheck({ actor }) {
  if (!requireOwner(actor)) return;
  const strain = Number(actor.system.loadStrain) || 0;
  const threshold = 10 + strain;
  const result = await SwCheck.roll({
    actor,
    kind: "check",
    slug: SW.DEFENSES.endure.slug,
    label: localize("STARWROUGHT.Combat.wind"),
    subtitle: format("STARWROUGHT.Combat.windSubtitle", { strain }),
    threshold,
    thresholdLabel: localize("STARWROUGHT.Combat.windThreshold")
  });
  if (!result) return;
  if (["fail", "critFail"].includes(result.degree)) {
    // PHB v4.21, Wind: Fatigued rises by 1 on a failure and by 2 on a critical failure.
    const rise = result.degree === "critFail" ? SW.WIND_CRIT_FAIL_RISE : SW.WIND_FAIL_RISE;
    const current = Number(actor.conditionValue?.("fatigued")) || 0;
    const value = Math.min(SW.FATIGUED_MAX, current + rise);
    await actor.setCondition?.("fatigued", value);
    await postCard(actor, cardHtml({
      root: "sw-round-card sw-wind-card",
      actorUuid: actor.uuid,
      title: `${localize("STARWROUGHT.Condition.fatigued")} ${value}`,
      lines: [format("STARWROUGHT.Combat.windFatigued", { name: escapeHTML(actor.name), value })],
      notes: [
        (value >= SW.FATIGUED_MAX) ? localize("STARWROUGHT.Combat.windCeiling") : "",
        localize("STARWROUGHT.Combat.windRestNote")
      ],
      buttons: [{ action: "windRest", icon: "fa-solid fa-mug-hot", label: localize("STARWROUGHT.Combat.windRest") }]
    }), { whisper: tableFor(actor) });
  }
}

/**
 * Ten minutes' rest (PHB v4.21, Conditions: Fatigued "ends after ten minutes of rest"; ruling 81).
 * The system has no clock for ten minutes, and the end of the Combat is not one either (through
 * 0.6.1 it cleared Fatigued there, ruling 70, now superseded), so whether the ten minutes have
 * passed is the table's call: the Fatigued card carries this button for the actor's owner or the
 * GM (`requireOwner`; a GM owns everything). Since 0.11.0 the ten minutes are the character's own
 * short rest (SwActor#restTenMinutes: Fatigued off and level x Presence Vigor back, PHB v4.21),
 * so a character goes through that and its card; an adversary, which has no short rest, keeps
 * the old path: Fatigued comes off whole, whatever its value, and a one-line card tells the same
 * table the Fatigued card went to. A night's rest clears it too (SwActor#restForTheNight).
 * Clicked for an actor no longer Fatigued, it says so quietly and writes nothing.
 */
async function onWindRest({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.restTenMinutes === "function") return actor.restTenMinutes();
  const current = Number(actor.conditionValue?.("fatigued")) || 0;
  if (!current) {
    ui.notifications.info(format("STARWROUGHT.Notify.notFatigued", { name: actor.name }));
    return;
  }
  await actor.setCondition?.("fatigued", false);
  return postCard(actor, cardHtml({
    root: "sw-round-card sw-wind-card sw-wind-rest-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.windRest"),
    lines: [format("STARWROUGHT.Combat.windRested", { name: escapeHTML(actor.name), value: current })]
  }), { whisper: tableFor(actor) });
}

/**
 * Persistent Damage (PHB v4.21): roll it fresh and apply it Pervasive, past ordinary Protection,
 * through the damage pipeline (Immunity, Resistance, Weakness, Temporary Vigor, Vigor, Spent and
 * the Wounds of a Spent body all read as for any damage; `delivery: "pervasive"` skips the
 * Protection step), then Endure against 10 + the amount just taken to end it. Through 0.10.1 the
 * card named the amount and left the applying to the owner on the sheet.
 */
async function onPersistentRoll({ actor, button }) {
  if (!requireOwner(actor)) return;
  const formula = button.dataset.formula;
  const type = button.dataset.type || "untyped";
  if (!Roll.validate(formula)) {
    ui.notifications.warn(format("STARWROUGHT.Combat.persistentBadFormula", { formula }));
    return;
  }
  const roll = await new Roll(formula).evaluate();
  const total = roll.total;
  const fromWound = button.dataset.source === "torsoWound";
  const threshold = 10 + total;
  let applied = null;
  try {
    applied = await SwDamage.apply(actor, { base: total, type, strike: null, delivery: "pervasive" });
  } catch (err) {
    console.error(`STARWROUGHT | ${actor.name}: Persistent Damage could not be applied`, err);
  }
  const buttons = fromWound ? [] : [{
    action: "persistentEndure", icon: "fa-solid fa-shield-heart",
    label: format("STARWROUGHT.Combat.endureVs", { threshold }),
    data: { threshold, type }
  }];
  const lines = [format("STARWROUGHT.Combat.persistentTaken", { name: escapeHTML(actor.name), total, type: damageLabel(type) })];
  if (applied) {
    lines.push(format("STARWROUGHT.Combat.persistentApplied", {
      name: escapeHTML(actor.name), applied: applied.applied, before: applied.vigorBefore, after: applied.vigorAfter
    }));
  }
  const content = cardHtml({
    root: "sw-round-card sw-persistent-card",
    actorUuid: actor.uuid,
    title: localize("STARWROUGHT.Combat.persistent"),
    lines,
    notes: [
      fromWound ? localize("STARWROUGHT.Combat.persistentWoundNote") : format("STARWROUGHT.Combat.persistentEndNote", { threshold }),
      applied ? localize("STARWROUGHT.Combat.persistentPervasiveNote") : localize("STARWROUGHT.Combat.persistentApplyNote")
    ],
    buttons
  });
  return postCard(actor, content, { rolls: [roll], whisper: tableFor(actor) });
}

async function onPersistentEndure({ actor, button }) {
  if (!requireOwner(actor)) return;
  const threshold = Number(button.dataset.threshold) || 10;
  const result = await SwCheck.roll({
    actor,
    kind: "check",
    slug: SW.DEFENSES.endure.slug,
    label: localize("STARWROUGHT.Combat.persistentEndure"),
    subtitle: damageLabel(button.dataset.type || "untyped"),
    threshold,
    thresholdLabel: localize("STARWROUGHT.Combat.persistentThreshold")
  });
  if (!result) return;
  if (["success", "critSuccess"].includes(result.degree)) {
    ui.notifications.info(format("STARWROUGHT.Combat.persistentEnded", { name: actor.name, type: damageLabel(button.dataset.type || "untyped") }));
  }
}

async function onFinishPrepared({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.finishPrepared !== "function") {
    ui.notifications.warn(localize("STARWROUGHT.Combat.preparedNoMethod"));
    return;
  }
  return actor.finishPrepared();
}

async function onAbandonPrepared({ actor }) {
  if (!requireOwner(actor)) return;
  if (typeof actor.abandonPrepared !== "function") {
    ui.notifications.warn(localize("STARWROUGHT.Combat.preparedNoMethod"));
    return;
  }
  return actor.abandonPrepared();
}
