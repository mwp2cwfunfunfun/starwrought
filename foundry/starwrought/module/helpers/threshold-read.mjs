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
 * @param {string[]} [args.permitted]       The Defenses the check's row names (0.34.0); the one
 *   named when not given. Never all four: the read does not move to a Defense nobody named.
 * @param {boolean} [args.answered]         The Defense is the target's own answer to a request
 *   (0.34.0), for the wording of the note when it cannot be used now.
 * @returns {object|null}  `threshold`, `thresholdLabel`, `targetDefense`, `targetDefenseKey`,
 *   `targetUuid`, `targetName`, `targetActor`, `targetMarks`, `withholdThreshold`; null when there
 *   is nobody to read or no number comes back.
 */
export function readTargetThreshold({ roller, target = null, token = null, defense, check = null, traits = [], permitted = null, answered = false } = {}) {
  const doc = token?.document ?? token ?? null;
  target ??= doc?.actor ?? null;
  if (!target || !SW.DEFENSES[defense] || (typeof target.defenseThresholdFor !== "function")) return null;
  const tokenDoc = doc ?? target.tokenOnScene?.() ?? null;
  // THE DEFENSES THE CHECK MAY BE READ AGAINST ARE THE ONES ITS ROW NAMES (0.34.0; ruling 345).
  // Through 0.33.0 all four were handed over, so a check "vs Evade" against a creature that could
  // not use Evade (Grabbed) was silently read against the first other one, Awareness: the system
  // choosing a Defense, which ruling 159 forbids. With the one Defense named, the read stays on it
  // and says it is unavailable (`defenseThresholdFor`: "a Threat with no other stays on the one
  // named, noted"); a row that names two is the target's own pick before this is ever called.
  const allowed = (Array.isArray(permitted) ? permitted : []).filter(key => SW.DEFENSES[key]);
  let read;
  try {
    read = target.defenseThresholdFor({
      defense, permitted: allowed.includes(defense) ? allowed : [defense],
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
  // The one Defense named, which the target cannot use now (Evade while Grabbed): it is still
  // the one read, since the row names no other, and the window and the card say so (0.34.0;
  // ruling 345). The reason is a Condition anyone at the table can see, so it is never withheld.
  const blocked = ((read.key ?? defense) === defense) ? (target.system?.defenses?.[defense]?.unavailable ?? null) : null;
  // `answered`: the Defense was the target's own answer to a request, and has become unusable
  // since; the row may name others, so the sentence is the answer's and not "names no other".
  const targetNote = blocked
    ? game.i18n.format(answered ? "STARWROUGHT.CheckRequest.readUnavailableAnswered" : "STARWROUGHT.CheckRequest.readUnavailable", {
      target: name,
      defense: game.i18n.localize(SW.DEFENSES[defense].label),
      reason: game.i18n.localize(SW.conditionNameKey(blocked))
    })
    : "";
  return {
    threshold: Number(read.threshold),
    thresholdLabel: label,
    targetDefense: {
      key: read.key ?? defense,
      label: withhold ? "" : `${label} ${read.threshold}`,
      threshold: withhold ? null : Number(read.threshold),
      unavailable: targetNote || (read.unavailable ?? null),
      hidden: withhold,
      // What the roll window says in place of the number (0.34.0): which Defense the die meets,
      // and that the card will say the result without it.
      ...(withhold ? {
        note: game.i18n.format("STARWROUGHT.Roll.hiddenDefense", { defense: game.i18n.localize(SW.DEFENSES[read.key ?? defense].label) }),
        hint: game.i18n.format("STARWROUGHT.Roll.hiddenDefenseHint", { name, defense: game.i18n.localize(SW.DEFENSES[read.key ?? defense].label) })
      } : {})
    },
    targetNote,
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
