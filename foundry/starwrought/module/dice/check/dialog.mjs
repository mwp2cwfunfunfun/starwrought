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
import { substitutionLine } from "./modifiers.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * The pre-roll dialog: a situational modifier, the optional modifiers the engine can name but
 * not decide, the Threshold, the Strike kind for an attack, the Reaction for a Defense roll, and
 * the roll mode.
 *
 * `marks` (0.21.0) are the rule marks of the boxes the player left ticked (an armed claim's spend,
 * a one-roll custom effect's removal). They are RETURNED, not written onto the config: the roll
 * adds them after any rebuild, since a rebuild assembles the roll again and sets the roll's own
 * marks afresh (through 0.20.1 they were written into `config.ruleMarks` and a rebuild lost them).
 * @returns {Promise<{config: object, extra: Array, rebuild: boolean, marks: Array}|null>}
 */
export async function prompt(cfg, parts) {
  const preview = SW.resolveModifiers(parts);
  const actor = cfg.actor;
  const isAttack = cfg.kind === "attack";
  const isDefense = cfg.kind === "defense";

  // A check made with other terms (0.21.0; rulings 216 and 218; `assemble` in ./modifiers.mjs):
  // the roll as it may be made, once with its own terms and once with each swap the rules offer.
  // Each swap is a checkbox naming what it puts in place of what, with the difference it makes to
  // the WHOLE total beside it, ticked when it is the one already standing (the default rule ticks
  // the swap that is strictly better). One swap may stand, so the boxes are exclusive, and the
  // list of terms and the total above follow the box: every variant's list is drawn and the
  // `render` callback below shows the one the boxes name.
  const variants = Array.isArray(cfg.substituteVariants) ? cfg.substituteVariants : [];
  const standing = cfg.substituted?.key ?? null;
  const unswapped = variants.find(v => v.key === null) ?? null;
  const substitutes = variants.filter(v => v.key !== null).map(v => {
    const line = substitutionLine(v.substituted);
    return {
      key: v.key,
      label: line,
      hint: game.i18n.format("STARWROUGHT.Roll.substituteHint", { line }),
      delta: v.total - (unswapped?.total ?? 0),
      checked: v.key === standing
    };
  });
  const variantLists = substitutes.length ? variants.map(v => {
    const resolved = SW.resolveModifiers(v.parts);
    return { key: v.key ?? "", parts: resolved.applied, total: resolved.total, hidden: (v.key ?? null) !== standing };
  }) : null;

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
  const offerRow = o => ({
    key: o.key, label: o.label, hint: o.hint ?? "", value: o.value, type: o.type, source: o.source ?? null, checked: o.ticked === true,
    // Every mark a ticked box files (0.18.1): the claim's spend and, on a one-roll custom effect, the row's removal.
    marks: Array.isArray(o.marks) ? o.marks : (o.mark ? [o.mark] : [])
  });
  if (substitutes.length) {
    // A check that may be made with other terms (0.21.0) is assembled every way it may be made,
    // and each variant has its OWN offers: a claim that reads the roll's rank (`IF: RANK(roll =
    // untrained); IF: CLAIM(...)`) is offered on the check's own terms and not under a swap that
    // borrows a Trained Proficiency (ruling 217). So the rows are the union over the variants,
    // each remembering the variants that offer it (`variants`, "" for the check's own terms); a
    // row the standing variant does not offer is drawn hidden, the `render` callback shows the
    // rows of whichever variant the swap boxes name, and on submit a ticked row counts only when
    // the variant rolled offers it. The Load Strain row above holds for every variant.
    const rows = new Map();
    for (const v of variants) {
      for (const o of v.ruleOffers ?? []) {
        if (!rows.has(o.key)) rows.set(o.key, { ...offerRow(o), variants: [] });
        rows.get(o.key).variants.push(v.key ?? "");
      }
    }
    for (const row of rows.values()) {
      row.hidden = !row.variants.includes(standing ?? "");
      extras.push(row);
    }
  } else {
    for (const o of cfg.ruleOffers ?? []) extras.push(offerRow(o));
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
    variantLists,
    substitutes,
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
    // The attack flow's dice name their defender in the title (0.26.0: one die for each).
    window: { title: cfg.dialogTitle ?? cfg.label, icon: "fa-solid fa-dice-d20" },
    classes: ["starwrought", "check-dialog"],
    position: { width: 440 },
    content,
    // The swap boxes (0.21.0): one may stand, and the terms above follow it. v14 hands the
    // DialogV2 instance; an earlier build handed the <dialog> element (the Relevant Check
    // picker's precedent).
    render: (event, dialog) => {
      const root = (dialog instanceof HTMLElement) ? dialog : (dialog?.element ?? null);
      const boxes = [...(root?.querySelectorAll?.("input[data-substitute]") ?? [])];
      if (!boxes.length) return;
      const show = () => {
        const key = boxes.find(box => box.checked)?.dataset.substitute ?? "";
        for (const list of root.querySelectorAll("[data-substitute-variant]")) {
          list.classList.toggle("sw-hidden", list.dataset.substituteVariant !== key);
        }
        // The offers follow the box too: a row only some variants offer is shown under those.
        for (const el of root.querySelectorAll("[data-offer-index]")) {
          const row = extras[Number(el.dataset.offerIndex)];
          el.classList.toggle("sw-hidden", Array.isArray(row?.variants) && !row.variants.includes(key));
        }
      };
      for (const box of boxes) {
        box.addEventListener("change", () => {
          if (box.checked) {
            for (const other of boxes) {
              if (other !== box) other.checked = false;
            }
          }
          show();
        });
      }
      show();
    },
    buttons: [
      { action: "roll", label: "STARWROUGHT.Roll.roll", icon: "fa-solid fa-dice-d20", default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
      { action: "cancel", label: "STARWROUGHT.Roll.cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });

  if (!answer || answer === "cancel") return null;

  const config = { rollMode: answer.rollMode ?? cfg.rollMode };
  let rebuild = false;

  // The swap the player left standing (0.21.0): the first ticked box, or none. Said outright
  // either way, so the roll is made as the dialog showed it and never by the default rule again;
  // the base terms are rebuilt when it is not the one the dialog opened with. `rolled` is the
  // variant the roll is made as ("" for the check's own terms), null when no swap was on offer.
  let rolled = null;
  if (substitutes.length) {
    const ticked = substitutes.find(s => answer[`substitute-${s.key}`] === true) ?? null;
    config.substitute = ticked ? ticked.key : null;
    if (config.substitute !== standing) rebuild = true;
    rolled = config.substitute ?? "";
  }

  const extra = [];
  const bonus = Number(answer.bonus) || 0;
  if (bonus) extra.push({ label: game.i18n.localize("STARWROUGHT.Roll.situational"), value: bonus, type: "situation" });
  // The offers the player ticked. A checkbox comes back as a boolean under its own name. The
  // `source` rides along (0.15.0) so two ticked claims of one Talent are one circumstance under
  // v4.21's stacking, and a ticked offer's mark (an armed claim) is filed for the roll to write.
  // A row the variant rolled does not offer is passed over (0.21.0): a hidden box still submits
  // its state, and an armed claim's box comes ticked, so this is what keeps a bonus limited to an
  // Untrained roll, and its arming, off a roll made at a borrowed Trained rank.
  const claimMarks = [];
  for (const offer of extras) {
    if (answer[`extra-${offer.key}`] !== true) continue;
    if (Array.isArray(offer.variants) && (rolled !== null) && !offer.variants.includes(rolled)) continue;
    extra.push({ label: offer.label, value: offer.value, type: offer.type, ...(offer.source ? { source: offer.source } : {}) });
    for (const mark of offer.marks ?? []) {
      if (mark?.key && mark?.per) claimMarks.push({ key: mark.key, per: mark.per });
    }
  }

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
  return { config, extra, rebuild, marks: claimMarks };
}
