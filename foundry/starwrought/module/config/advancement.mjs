/**
 * Advancement: Milestones per level, and the flag Downtime's Train leaves on a character.
 * Read by the character sheet and the Party Sheet alike.
 *
 * Pure at module scope, as every file in module/config/ is: no `game`, `CONFIG`, `foundry` or `ui`
 * outside a function body, because assets/build_foundry.mjs and the self-test import these from
 * plain Node (config.mjs says why).
 */

/**
 * Milestones that each grant a Milestone Talent Point before the next one is a level (PHB v4.10,
 * Character Mechanics: four make a level, and the fourth is the level itself). Read by the
 * character sheet's star pips and, since 0.7.0, by the Party Sheet's Milestone award
 * (party-sheet-plan.md, part 3), so both count from one constant: an award to a member already at
 * this count raises the level and resets the count, and current Vigor rises with the maximum
 * (ruling 92). It lived in apps/actor-sheet.mjs until 0.7.0.
 */
export const MILESTONES_PER_LEVEL = 3;

/**
 * The flag on a character (`flags.starwrought.trainedAt`) the Party Sheet's Downtime panel writes
 * when a member Trains (0.7.5; party-sheet-plan.md, part 10; ruling 113): `{ level, milestone,
 * time }`, the level and Milestone count the seven days' training happened at and when. A flag
 * and not schema, as the plan says: it is a reminder's record, read by `trainUsed` in
 * helpers/party.mjs for the panel's amber mark and by `SwActor#toggleFlare`'s card for its warning
 * line, and compared against the character's current count rather than cleared, so the next
 * Milestone award makes it stale and nothing has to reset it (the plan's judge struck a
 * `trainedSinceMilestone` field the award would have had to clear). Nothing refuses a Train for it
 * (decision 14).
 */
export const TRAINED_AT_FLAG = "trainedAt";
