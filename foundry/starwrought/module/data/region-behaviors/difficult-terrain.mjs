/**
 * The Difficult terrain region behavior (0.15.0; ruling 178; Terrain on the map).
 *
 * Mike, 2026-11-05, on Riverfoot's "You ignore difficult terrain from mud, decking, loose stone,
 * and shallow water": "Let's build Difficult terrain INTO the maps! using a region or some sort
 * of method! so this can be automated. and players can toggle layers to see what is difficult etc."
 *
 * The GM draws a Region with Foundry's own tools and adds this behavior to it, naming what the
 * ground is made of (`kind`, one of SW.TERRAIN_KINDS) and what a foot of it costs (`difficulty`,
 * the book's difficult terrain doubling it). Since 0.18.0 the kinds are the roster's `terrainKinds`
 * block, loaded into the registry at init (helpers/content.mjs), so the `kind` field reads its
 * choices LAZILY (a function, read when the select renders) and does not gate on them: a region
 * whose kind Mike has since struck from the roster keeps the slug it stored, reads with the title-
 * cased slug and the fallback colour, and is never made an invalid document by a list that moved. Foundry then charges the cost along every token's
 * path, slows the animation, splits the ruler at the region's edge, and the system's movement
 * tracker reads the cost as it always has (documents/movement.mjs: a Step cannot enter difficult
 * terrain, a Move pays for the cost). The one thing of ours in the loop is `_getTerrainEffects`:
 * a token whose actor ignores this kind (a Talent's `ignore: Terrain, Mud` line;
 * module/rules/kinds/ignore.mjs) gets no effect at all, so it is never split, charged, slowed or
 * labelled by this region. Core's `ModifyMovementCostRegionBehaviorType` is the model
 * (increase-movement-cost.mjs in the Foundry client): the events that recalculate planned paths
 * are the same.
 *
 * A hidden region carries no terrain for anyone (Foundry skips hidden regions when it builds the
 * terrain path), so a terrain region is never hidden to keep it secret; the player's overlay
 * (canvas/terrain.mjs) is theirs to toggle.
 */

import * as SW from "../../config.mjs";
import { ignoresTerrain } from "../../rules/kinds/ignore.mjs";

const fields = foundry.data.fields;
const { RegionBehaviorType } = foundry.data.regionBehaviors;

/**
 * The `kind` field (0.18.0): a StringField whose `choices` are the registry's current slug-to-name
 * map (a function, so the dropdown is right at render time, after the roster block has loaded) and
 * whose validation asks only for a non-blank string, never membership. Core's StringField refuses a
 * value outside `choices`, which would turn a stored kind into an invalid behavior the moment its
 * row left the roster, or on a client where content/terrain.json lost the race with the world's
 * load; the choices are the dropdown's, not a gate.
 */
class TerrainKindField extends fields.StringField {
  /** @inheritdoc */
  _validateType(value, options) {
    if (typeof value !== "string") throw new Error("must be a string");
    if (value === "") throw new Error("may not be a blank string");
    return true;
  }
}

export class DifficultTerrainBehaviorType extends RegionBehaviorType {
  /** The system's type word, in `system.json` and `CONFIG.RegionBehavior`. */
  static TYPE = "difficultTerrain";

  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["STARWROUGHT.Terrain.behaviorFields"];

  /** @inheritdoc */
  static defineSchema() {
    return {
      kind: new TerrainKindField({
        required: true, blank: false, choices: () => SW.terrainKindChoices(), initial: "other",
        label: "STARWROUGHT.Terrain.kindField", hint: "STARWROUGHT.Terrain.kindHint"
      }),
      difficulty: new fields.NumberField({
        required: true, nullable: false, initial: SW.DEFAULT_TERRAIN_DIFFICULTY, min: 1, max: 5, step: 0.25,
        label: "STARWROUGHT.Terrain.difficultyField", hint: "STARWROUGHT.Terrain.difficultyHint"
      })
    };
  }

  /** @inheritdoc */
  static events = {
    [CONST.REGION_EVENTS.BEHAVIOR_VIEWED]: DifficultTerrainBehaviorType.#recalculate,
    [CONST.REGION_EVENTS.BEHAVIOR_UNVIEWED]: DifficultTerrainBehaviorType.#recalculate,
    [CONST.REGION_EVENTS.REGION_BOUNDARY]: DifficultTerrainBehaviorType.#recalculate
  };

  /** Planned paths are measured again when the region or the behavior changes, as core's does. */
  static async #recalculate() {
    canvas.tokens?.recalculatePlannedMovementPaths?.();
  }

  /** @inheritdoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate?.(changed, options, userId);
    if (("kind" in changed) || ("difficulty" in changed)) canvas.tokens?.recalculatePlannedMovementPaths?.();
  }

  /**
   * The effect this region has on a token's movement: nothing for a token whose actor ignores the
   * kind (the one decision of ours in Foundry's loop), else the difficulty with the kind named, for
   * SwTerrainData to keep (data/terrain-data.mjs).
   * @param {TokenDocument} token
   * @param {object} segment
   * @returns {Array<{name: string, difficulty: number, kind: string}>}
   */
  _getTerrainEffects(token, segment) {
    const difficulty = Number(this.difficulty);
    if (!Number.isFinite(difficulty) || (difficulty === 1)) return [];
    // Teleports and the like cross nothing (core's own actions with no terrain action).
    if (segment?.action && (CONFIG.Token.movement.actions[segment.action]?.terrainAction === null)) return [];
    if (ignoresTerrain(token?.actor ?? null, this.kind)) return [];
    return [{ name: "difficulty", difficulty, kind: this.kind }];
  }

  /** The kind's printed name, the roster row's (0.18.0), for the overlay and the ruler. */
  get kindName() {
    return SW.terrainKindName(this.kind);
  }
}

/** Install the behavior type (at init, with the Item and Actor models). */
export function registerDifficultTerrain() {
  CONFIG.RegionBehavior.dataModels[DifficultTerrainBehaviorType.TYPE] = DifficultTerrainBehaviorType;
  CONFIG.RegionBehavior.typeLabels ??= {};
  CONFIG.RegionBehavior.typeLabels[DifficultTerrainBehaviorType.TYPE] = "STARWROUGHT.Terrain.behavior";
  CONFIG.RegionBehavior.typeHints ??= {};
  CONFIG.RegionBehavior.typeHints[DifficultTerrainBehaviorType.TYPE] = "STARWROUGHT.Terrain.behaviorHint";
  CONFIG.RegionBehavior.typeIcons ??= {};
  CONFIG.RegionBehavior.typeIcons[DifficultTerrainBehaviorType.TYPE] = "fa-solid fa-water";
}

/**
 * The enabled Difficult terrain behaviors of a region, each `{ kind, difficulty }`.
 * @param {RegionDocument} region
 * @returns {Array<{kind: string, difficulty: number}>}
 */
export function terrainOf(region) {
  const out = [];
  for (const behavior of region?.behaviors ?? []) {
    if (behavior.disabled || (behavior.type !== DifficultTerrainBehaviorType.TYPE)) continue;
    out.push({ kind: behavior.system.kind, difficulty: Number(behavior.system.difficulty) || 1 });
  }
  return out;
}
