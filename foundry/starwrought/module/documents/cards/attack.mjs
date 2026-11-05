/**
 * The attack card's buttons (0.5.0, templates/chat/attack-workflow-card.hbs): recovery, never
 * decision. They open the Combat Prompt, hand the roll to the coordinator's `rollFor`, or send a
 * GM control through `AttackCoordinator.request`; and the render pass prunes the "vs {threshold}"
 * spans this viewer may not see, by the policy in combat/attack-card.mjs. Through 0.10.0 this
 * lived in documents/chat.mjs.
 */

import { AttackCoordinator } from "../../combat/attack-coordinator.mjs";
import { thresholdVisibleTo, mayControl } from "../../combat/attack-card.mjs";
import { SwCombatPrompt } from "../../apps/combat-prompt.mjs";
import { resolveActor } from "./shared.mjs";

/**
 * The attack card's "vs {threshold}" spans: kept only where the brief's policy lets this viewer
 * see the number (the defender's owner and the GM always; the attacker's owner under the
 * attackShowPcThresholds setting; never a player for an adversary). The policy itself lives in
 * attack-card.mjs so a user-specific render and this prune can never disagree.
 */
export function pruneAttackThresholds(html, state) {
  for (const el of html.querySelectorAll("[data-sw-threshold-for]")) {
    const targetId = el.closest("[data-target-id]")?.dataset.targetId;
    const target = state?.targets?.find(t => (t.id === targetId) || (!targetId && (t.actorUuid === el.dataset.swThresholdFor)));
    if (!target || !thresholdVisibleTo(game.user, state, target)) el.remove();
  }
}

/**
 * The per-user button's second gate. The render hook already removed it for anyone who cannot act
 * for its actor; a click that reaches here from a stale card is checked again, and the message is
 * the attack flow's own ("That decision belongs to another player.").
 */
function actsForAttackButton(button) {
  const uuid = button.dataset.ownerUuid;
  if (!uuid) return true;
  const actor = resolveActor(uuid);
  if (!actor) return game.user.isGM;
  if (actor.isOwner) return true;
  ui.notifications.warn(game.i18n.localize("STARWROUGHT.Attack.notYours"));
  return false;
}

/** Choose Defense, or reopen the Combat Prompt on this attack: the prompt lists what is yours to do. */
export async function openAttackPrompt(button) {
  const workflowId = button.dataset.workflowId;
  if (!workflowId) return;
  if (!actsForAttackButton(button)) return;
  return SwCombatPrompt.open({ workflowId });
}

/**
 * Roll Attack or Roll Defense. The roller's own client throws the die blind (no Threshold) and
 * hands the result to the coordinator, which reads it against every pairing (brief, "The roll and
 * the resolution"); `AttackCoordinator.rollFor` is that whole step.
 */
export async function rollFromAttackCard(button) {
  const { workflowId, targetId } = button.dataset;
  if (!workflowId) return;
  if (!actsForAttackButton(button)) return;
  return AttackCoordinator.rollFor(workflowId, targetId || null);
}

/**
 * A GM control: cancel, resetDefenses, resendPrompts or useStances, sent through the coordinator
 * like every other mutation. The expected revision is the live one when this client knows it
 * (the card's flags can lag a step behind the coordinator's memory), else the card's; a stale
 * request is refused visibly by the coordinator, never silently.
 */
export async function gmAttackRequest(flags, button, action) {
  const state = flags?.attackWorkflow ?? null;
  const workflowId = button.dataset.workflowId || state?.id;
  if (!workflowId) return;
  const live = AttackCoordinator.get(workflowId);
  // The GM's, or the coordinator's with no GM connected: the same test the card and the
  // coordinator apply, read from the live state since the card's flags can lag a step.
  if (!mayControl(game.user, live ?? state)) return ui.notifications.warn(game.i18n.localize("STARWROUGHT.Attack.gmOnly"));
  const expectedRevision = live?.revision ?? state?.revision ?? 0;
  return AttackCoordinator.request(action, { workflowId, expectedRevision, payload: {} });
}
