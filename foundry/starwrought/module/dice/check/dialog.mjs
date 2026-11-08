/**
 * The pre-roll dialog: the situational modifier, the offers, the Threshold, the Strike kind, the Reaction, the roll mode.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. Renders templates/dice/check-dialog.hbs.
 */

import * as SW from "../../config.mjs";
import { strikeCanCrit } from "./strike.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * The pre-roll dialog: a situational modifier, the optional modifiers the engine can name but
 * not decide, the Threshold, the Strike kind for an attack, the Reaction for a Defense roll, and
 * the roll mode.
 * @returns {Promise<{config: object, extra: Array, rebuild: boolean}|null>}
 */
export async function prompt(cfg, parts) {
  const preview = SW.resolveModifiers(parts);
  const actor = cfg.actor;
  const isAttack = cfg.kind === "attack";
  const isDefense = cfg.kind === "defense";

  // Modifiers offered unticked, because the rule applies to a check the engine cannot tell
  // apart from its neighbours. Load Strain on an Athletics check (PHB v4.21, Speed at the
  // margin): a Climb or a Swim takes it, a grapple or a tumble does not, and only the player
  // knows which this is (ruling R2). Typed Condition as the book says. Each is a checkbox named
  // `extra-<key>`; the ticked ones join the roll below.
  const extras = [];
  const strain = Number(actor.system?.loadStrain) || 0;
  if ((cfg.kind === "check") && (SW.STRAIN_CHECKS[cfg.slug] === "offered") && (strain >= 1)) {
    extras.push({
      key: "loadStrain",
      label: game.i18n.localize("STARWROUGHT.Roll.strainClimbSwim"),
      hint: game.i18n.localize("STARWROUGHT.Roll.strainClimbSwimHint"),
      value: -strain,
      type: SW.STRAIN_TYPE,
      checked: false
    });
  }
  // The Automation rules' offers (0.10.0; ruling 122): a `bonus` to a Maneuver, on a check made
  // without that Maneuver's Item, is the same shape of question ("is this roll an Aid?") and gets
  // the same checkbox, unticked, with the Talent and the Maneuver named on it. baseModifiers
  // left them on `cfg.ruleOffers` with a key unique per offer; a ticked one joins the roll below
  // as any extra does, and `result.extras` records it, so a kept road roll re-counts it (0.7.3).
  // A claim the player armed on the Talent's row (0.15.0, ruling 174) comes ticked, and carries
  // the mark that spends the arming once the roll goes through with the box still ticked.
  for (const o of cfg.ruleOffers ?? []) {
    extras.push({
      key: o.key, label: o.label, hint: o.hint ?? "", value: o.value, type: o.type, source: o.source ?? null, checked: o.ticked === true,
      // Every mark a ticked box files (0.18.1): the claim's spend and, on a one-roll custom effect, the row's removal.
      marks: Array.isArray(o.marks) ? o.marks : (o.mark ? [o.mark] : [])
    });
  }

  // The three Strikes, with Committed marked as the one that waits for the next Opportunity.
  const strikes = isAttack ? Object.entries(SW.STRIKE_KINDS).map(([key, kind]) => ({
    key,
    label: game.i18n.localize(kind.label),
    glyph: SW.ACTION_GLYPHS[kind.cost],
    hint: game.i18n.localize(`STARWROUGHT.Strike.${key}Hint`),
    active: key === cfg.strike,
    prepared: kind.prepared && actor.inEncounter && !cfg.prepared,
    canCrit: strikeCanCrit(key, cfg.item)
  })) : [];

  // The Reactions this defender owns, offered only against an Attack Threshold: a Defense rolled
  // for its own sake (Endure against a poison) has nothing to React to, and a Defense answering
  // a Reaction (an adversary's Intercept) is the basic roll alone, since a Reaction never
  // triggers a Reaction (PHB v4.10, Answering an Attack); the caller says so with `basicOnly`.
  // PHB v4.21: the Reactions are Talents (SW.REACTIONS, kind "reaction"); the ones this actor owns
  // on the Defense being rolled are offered, an adversary's all (the GM's to declare).
  const owned = actor.system.reactions?.owned ?? {};
  const reactions = (isDefense && !cfg.basicOnly && ["evade", "guard"].includes(cfg.slug))
    ? Object.entries(SW.REACTIONS)
      .filter(([, reaction]) => (reaction.kind === "reaction") && (reaction.defense === cfg.slug))
      .filter(([key]) => (actor.type === "npc") || (key in owned))
      .map(([key, reaction]) => ({
        key,
        label: game.i18n.localize(reaction.label),
        glyph: `${SW.ACTION_GLYPHS[reaction.cost]}${SW.REACTION_GLYPH}`,
        hint: game.i18n.localize(`${reaction.label}Hint`),
        defense: reaction.defense ? game.i18n.localize(SW.DEFENSES[reaction.defense].label) : "",
        active: key === cfg.reaction,
        warn: reaction.rigid && !actor.rigidImplement
      }))
    : [];

  // A Strike made as part of another Maneuver (PHB v4.21, The Attack): the owned Talents and
  // Maneuvers whose Key Attribute beats the weapon's own, offered as a select, none by default.
  // The Maneuver's Requirements are the table's to hold; the hint says so.
  const maneuvers = (isAttack ? (cfg.maneuverChoices ?? []) : []).map(m => ({
    id: m.id,
    label: `${m.name} · ${game.i18n.localize(SW.ATTRIBUTES[m.attribute]?.label ?? "")} ${m.mod >= 0 ? "+" : ""}${m.mod}`
  }));

  const content = await renderTemplate("systems/starwrought/templates/dice/check-dialog.hbs", {
    cfg,
    parts: preview.applied,
    total: preview.total,
    isAttack,
    isDefense,
    extras,
    strikes,
    maneuvers,
    attributeLabel: cfg.attribute ? game.i18n.localize(SW.ATTRIBUTES[cfg.attribute]?.label ?? "") : "",
    lockStrike: !!cfg.lockStrike,
    strikeLabel: cfg.strike ? game.i18n.localize(SW.STRIKE_KINDS[cfg.strike].label) : "",
    strikeGlyph: cfg.strike ? SW.ACTION_GLYPHS[SW.STRIKE_KINDS[cfg.strike].cost] : "",
    reactions,
    actionsLeft: actor.inEncounter ? (actor.system.actions?.value ?? null) : null,
    targetName: cfg.targetName ?? "",
    targetDefense: cfg.targetDefense ?? null,
    defenseForced: !!cfg.defenseForced,
    // A Defense rolled inside the attack flow meets the coordinator's Threshold, an adversary's
    // withheld from players, so the dialog offers no box for one (live test, 2026-10-01).
    thresholdWithheld: !!cfg.workflow,
    threshold: Number.isNumeric(cfg.threshold) ? cfg.threshold : "",
    rollModes: CONFIG.Dice.rollModes,
    rollMode: cfg.rollMode,
    // A caller that fixes the visibility (the Wind roll, public since 0.19.0) shows the select
    // disabled; a disabled control is not submitted, so the answer falls back to the caller's mode.
    lockRollMode: !!cfg.lockRollMode
  });

  const answer = await DialogV2.wait({
    window: { title: cfg.label, icon: "fa-solid fa-dice-d20" },
    classes: ["starwrought", "check-dialog"],
    position: { width: 440 },
    content,
    buttons: [
      { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
      { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });

  if (!answer || answer === "cancel") return null;

  const extra = [];
  const bonus = Number(answer.bonus) || 0;
  if (bonus) extra.push({ label: game.i18n.localize("STARWROUGHT.Roll.situational"), value: bonus, type: "situation" });
  // The offers the player ticked. A checkbox comes back as a boolean under its own name. The
  // `source` rides along (0.15.0) so two ticked claims of one Talent are one circumstance under
  // v4.21's stacking, and a ticked offer's mark (an armed claim) is filed for the roll to write.
  const claimMarks = [];
  for (const offer of extras) {
    if (answer[`extra-${offer.key}`] !== true) continue;
    extra.push({ label: offer.label, value: offer.value, type: offer.type, ...(offer.source ? { source: offer.source } : {}) });
    for (const mark of offer.marks ?? []) {
      if (mark?.key && mark?.per) claimMarks.push({ key: mark.key, per: mark.per });
    }
  }

  const config = { rollMode: answer.rollMode ?? cfg.rollMode };
  if (claimMarks.length) config.ruleMarks = [...(cfg.ruleMarks ?? []), ...claimMarks];
  let rebuild = false;

  if (!cfg.targetDefense && !isDefense && Number.isNumeric(answer.threshold)) {
    // A blank box means no Threshold is known, not a Threshold of zero, which every roll beats.
    config.threshold = Number(answer.threshold);
  }
  if (isDefense && Number.isNumeric(answer.threshold)) config.threshold = Number(answer.threshold);

  if (isAttack && !cfg.lockStrike && SW.STRIKE_KINDS[answer.strike]) config.strike = answer.strike;

  // The Maneuver chosen lends its Key Attribute (PHB v4.21): the base terms are rebuilt around it,
  // and the card says which Maneuver the Strike was part of.
  if (isAttack && maneuvers.length && answer.maneuver) {
    const chosen = (cfg.maneuverChoices ?? []).find(m => m.id === answer.maneuver);
    if (chosen) {
      config.attribute = chosen.attribute;
      config.attributeSource = "maneuver";
      config.viaManeuver = chosen.name;
      config.subtitle = `${cfg.subtitle ?? ""} · ${game.i18n.format("STARWROUGHT.Roll.viaManeuver", { name: chosen.name })}`.replace(/^ · /, "");
      rebuild = true;
    }
  }

  if (isDefense && reactions.length) {
    const chosen = (SW.REACTIONS[answer.reaction]?.kind === "reaction") ? answer.reaction : null;
    config.reaction = chosen;
    // A Reaction stands on its own Defense, whatever Defense the button was pressed on.
    const def = chosen ? SW.REACTIONS[chosen].defense : null;
    if (def && (def !== cfg.slug)) {
      config.slug = SW.DEFENSES[def].slug;
      config.label = game.i18n.localize(SW.DEFENSES[def].label);
      config.subtitle = game.i18n.localize(SW.DEFENSES[def].hint);
      config.defense = def;
      rebuild = true;
    }
  }
  return { config, extra, rebuild };
}
