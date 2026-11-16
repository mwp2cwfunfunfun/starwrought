/**
 * A check read against another creature's Defense Threshold, as roll config (0.15.0, ruling 179;
 * here since 0.27.0).
 *
 * A Maneuver whose check names a Defense (Demoralize against Guard), used with one target, reads
 * that target's live Threshold through the fold the attack flow uses (`defenseThresholdFor`, with
 * the check's Constellation as the Threat and the roller as the other party, so `AGAINST(...)` and
 * `MARKED` apply). The number prints for a character target or a GM roller and is withheld for an
 * adversary, as the flow withholds it.
 *
 * Through 0.26.1 this was `SwItem`'s private `#targetThreshold`, which read the Maneuver's own
 * check block and the user's one target. Gain Control (documents/actor/bind.mjs) reads its Bind
 * partner's Guard with no target and no check block on its row, so the read takes the creature it
 * is told and both callers share it.
 */

import * as SW from "../config.mjs";

/**
 * @param {object} args
 * @param {Actor} args.roller               Whose check it is: the other party of the read.
 * @param {Actor} [args.target]             The creature whose Threshold is read.
 * @param {Token|TokenDocument|null} [args.token]  Its token, when the caller has it (a name the GM
 *   chose to show, and the uuid a reroll finds the creature by). The target's token on the scene
 *   is used otherwise.
 * @param {string} args.defense             A key of SW.DEFENSES.
 * @param {string|null} [args.check]        The Constellation the check rolls, for `AGAINST(...)`.
 * @param {string[]} [args.traits]          The Maneuver's traits, for `IFT: TRAIT(...)`.
 * @returns {object|null}  `threshold`, `thresholdLabel`, `targetDefense`, `targetDefenseKey`,
 *   `targetUuid`, `targetName`, `targetActor`, `targetMarks`, `withholdThreshold`; null when there
 *   is nobody to read or no number comes back.
 */
export function readTargetThreshold({ roller, target = null, token = null, defense, check = null, traits = [] } = {}) {
  const doc = token?.document ?? token ?? null;
  target ??= doc?.actor ?? null;
  if (!target || !SW.DEFENSES[defense] || (typeof target.defenseThresholdFor !== "function")) return null;
  const tokenDoc = doc ?? target.tokenOnScene?.() ?? null;
  let read;
  try {
    read = target.defenseThresholdFor({
      defense, permitted: Object.keys(SW.DEFENSES),
      threat: { threat: "check", melee: false, traits: traits ?? [], check: check || null },
      attacker: roller?.tokenOnScene?.() ?? roller
    });
  } catch (err) {
    console.warn("STARWROUGHT | the target's Threshold could not be read", err);
    return null;
  }
  if (!Number.isFinite(Number(read?.threshold))) return null;
  const withhold = (target.type !== "character") && !game.user.isGM;
  const name = tokenDoc?.name ?? target.name;
  const label = `${name} ${game.i18n.localize(SW.DEFENSES[read.key ?? defense].label)}`;
  return {
    threshold: Number(read.threshold),
    thresholdLabel: label,
    targetDefense: {
      key: read.key ?? defense,
      label: withhold ? "" : `${label} ${read.threshold}`,
      threshold: withhold ? null : Number(read.threshold),
      unavailable: read.unavailable ?? null,
      hidden: withhold
    },
    targetDefenseKey: read.key ?? defense,
    // The token's uuid where there is one: a reroll finds the creature again by it
    // (documents/cards/reroll.mjs reads `fromUuidSync(flags.targetUuid)?.actor`).
    targetUuid: tokenDoc?.uuid ?? "",
    targetName: name,
    targetActor: target,
    targetMarks: read.marks ?? [],
    withholdThreshold: withhold
  };
}
