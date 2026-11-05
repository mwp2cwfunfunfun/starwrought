/**
 * Settle Position (PHB v4.10, The Exchange, step 5): what the card offers once the Result is read.
 *
 * Part of the check engine (module/dice/check.mjs, SwCheck, which stays the one entry point:
 * roll, resolveAgainst and the public statics). Through 0.10.1 these were the class's private
 * methods; they share no state and pass the roll's `cfg`, `parts` and `result` as arguments, so
 * they are plain functions here. Every entry is an offer the card's buttons carry out, never an automatic write.
 */

import * as SW from "../../config.mjs";

/**
 * Settle Position (PHB v4.10, The Exchange, step 5): what the card offers once the Result is
 * read. Everything here is an offer to the side the rule favours, never an automatic write,
 * because "a plausible Zone" and "if they Guarded with a rigid weapon" are the table's to confirm.
 *
 *  - Miss: a Deliberate or Committed Strike Exposes the attacker in a Zone of the defender's
 *    choice (PHB v4.21: a Quick Strike's Miss costs nothing). A Guard with a rigid implement
 *    takes Control (a Quick Strike can only be bound). An Evade may Step.
 *  - Graze: Weighted (Committed) Exposes the attacker. A Guard with a rigid implement forms a
 *    neutral Bind, or Control if it was a Parry against a Deliberate or Committed Strike. An
 *    Evade gives 3 feet directly away, or what its Reaction offers on a Stop (SW.REACTIONS
 *    `onStop`): a Step of its own choosing after a Sidestep, a Move to any space adjacent to the
 *    attacker after a Slip the Line.
 *  - The Bind is offered only when the attack can be bound: a melee weapon or natural attack
 *    that is neither Flexible nor Unparryable. Otherwise the card says why not.
 *  - Hit or Critical Hit: a Committed Strike may Expose a plausible Zone on any Hit; a Deliberate
 *    Strike may on a Critical Hit.
 *  - Parry that Stops a Deliberate or Committed Strike: Control, and the riposte Quick Strike
 *    when the defender owns Riposte (PHB v4.21: a Talent of its own).
 */
export function position(cfg, result) {
  if (!result.outcome) return null;
  // A spell's Cast (PHB v4.21) is no Strike: nothing to Bind, no Zone to Expose by the Strike
  // rules; what a Hit does is the Talent's text on the card.
  if (cfg.source === "spell") return null;
  const isAttack = cfg.kind === "attack";
  const attacker = isAttack ? cfg.actor : (cfg.attacker ?? null);
  const defender = isAttack ? (cfg.defender ?? null) : cfg.actor;
  const kind = SW.STRIKE_KINDS[cfg.strike] ?? SW.STRIKE_KINDS[SW.DEFAULT_STRIKE];
  const outcome = result.outcome.key;
  const defense = cfg.defense ?? null;
  const reaction = cfg.reaction ?? null;
  const rule = reaction ? (SW.REACTIONS[reaction] ?? null) : null;
  const rigid = isAttack ? (cfg.defenderRigid ?? null) : (cfg.actor.rigidImplement ?? null);
  const ownsRiposte = !!(defender?.system?.reactions?.owned && ("riposte" in defender.system.reactions.owned));

  const pos = {
    zones: Object.entries(SW.ZONES).map(([key, z]) => ({ key, label: z.label })),
    attackerUuid: attacker?.uuid ?? "",
    defenderUuid: defender?.uuid ?? "",
    attackerName: (isAttack ? (cfg.actor.name) : (attacker?.name ?? "")),
    defenderName: (isAttack ? (cfg.targetName || defender?.name || "") : cfg.actor.name),
    attackerTokenUuid: isAttack ? (cfg.attackerTokenUuid ?? "") : (cfg.targetUuid ?? ""),
    defenderTokenUuid: isAttack ? (cfg.targetUuid ?? "") : (cfg.defenderTokenUuid ?? ""),
    exposeAttacker: false,
    exposeDefender: false,
    bind: null,
    bindNote: null,
    ground: null,
    riposte: false,
    counter: false,
    stopped: ["miss", "graze"].includes(outcome)
  };

  if (pos.stopped) {
    // A Miss Exposes the attacker for every Strike the kinds table says it does (a Deliberate or
    // Committed one in PHB v4.21, Table 9; a Quick Strike's Miss costs nothing); a Weighted Strike
    // is Exposed by any Stop. The table is the one place to say otherwise.
    pos.exposeAttacker = ((outcome === "miss") && kind.exposeOnMiss) || kind.weighted;
    // Only a melee weapon or natural attack can be bound (PHB v4.10, The Bind, "What cannot
    // Bind"): nothing Flexible or Unparryable, and nothing that left the hand. A Defense roll
    // does not know the attack, so its offer stands and the table decides.
    const attackFlags = cfg.item?.system?.flags ?? {};
    const bindable = !isAttack
      || !(attackFlags.flexible || attackFlags.unparryable || (cfg.slug === SW.RANGED_SLUG));
    if ((defense === "guard") && rigid && bindable) {
      const control = kind.controllable && ((outcome === "miss") || (rule?.onStop === "control"));
      pos.bind = {
        mode: control ? "control" : "neutral",
        implement: rigid.name ?? "",
        // The weapon that was Stopped, so the Bind records what is held and not whatever the
        // attacker happens to hold first: the Controlled −2 and the "uncontrolled weapon ends
        // the Bind" rule both key on it. A Defense roll has no attacking Item; blank there.
        // A Defense card inside the attack flow names the attack it resolved (`attackName`,
        // 0.5.1), so the Bind records "Bite" rather than "weapon".
        theirs: isAttack ? (cfg.item?.name ?? "") : (cfg.attackName ?? ""),
        label: control ? "STARWROUGHT.Bind.takeControl" : "STARWROUGHT.Bind.form"
      };
      // Riposte (PHB v4.21, a Guard Talent): after a successful Parry, a Quick Strike back instead
      // of Controlling the weapon. Offered beside Control; the defender picks one.
      pos.riposte = control && (rule?.onStop === "control") && ownsRiposte;
    } else if (isAttack && !bindable && (defense === "guard") && rigid) {
      // The Guard would have offered a Bind; say why it does not.
      pos.bindNote = game.i18n.format("STARWROUGHT.Bind.cannotBind", { weapon: cfg.item?.name ?? "" });
    }
    if (defense === "evade") {
      if (rule?.onStop === "adjacent") {
        pos.ground = { mode: "adjacent", label: "STARWROUGHT.Position.adjacent" };
      } else {
        pos.ground = ((outcome === "miss") || (rule?.onStop === "step"))
          ? { mode: "step", label: "STARWROUGHT.Position.step" }
          : { mode: "give", feet: SW.GIVE_GROUND_FEET, label: "STARWROUGHT.Position.giveGround" };
      }
    }
  } else {
    pos.exposeDefender = kind.full && ((cfg.strike === "committed") || (outcome === "critical"));
  }

  pos.any = pos.exposeAttacker || pos.exposeDefender || !!pos.bind || !!pos.bindNote || !!pos.ground
    || pos.riposte || pos.counter;
  return pos;
}
