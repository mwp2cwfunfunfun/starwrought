/**
 * The player's terrain overlay (0.15.0; ruling 178; Terrain on the map).
 *
 * Mike, 2026-11-05: "players can toggle layers to see what is difficult etc." Foundry draws a
 * Region for the GM on the Regions layer and for players only by the region's own `visibility`,
 * one region at a time; this is the one switch every client has: every Difficult terrain region
 * on the viewed scene, filled in its kind's colour at low alpha with the kind and the cost named
 * at its centre, on or off by the token controls' toggle (`swShowTerrain`, starwrought.mjs) or the
 * client setting `showTerrain` behind it. Drawn the way the auras and the Bind are drawn
 * (auras.mjs): one plain PIXI container on the interface group, rebuilt on canvasReady and on any
 * change to a Region or a RegionBehavior. A hidden region is drawn dashed for the GM and not at
 * all for a player, as core draws it; it also carries no terrain, which FEATURES.md says.
 */

import * as SW from "../config.mjs";
import { terrainOf } from "../data/region-behaviors/difficult-terrain.mjs";

const LAYER_NAME = "starwrought.terrain";
let layer = null;

/** Register the hooks that keep the overlay current. */
export function registerTerrain() {
  Hooks.on("canvasReady", () => { reset(); refresh(); });
  for (const hook of ["createRegion", "updateRegion", "deleteRegion", "createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
    Hooks.on(hook, () => refresh());
  }
}

/** Is the overlay on for this client? The setting, read safely before settings exist. */
export function terrainShown() {
  try {
    return game.settings.get(SW.SYSTEM_ID, "showTerrain") !== false;
  } catch {
    return true;
  }
}

/** Flip the overlay for this client (the scene control's toggle). */
export async function setTerrainShown(state) {
  try {
    await game.settings.set(SW.SYSTEM_ID, "showTerrain", !!state);
  } catch (err) {
    console.warn("STARWROUGHT | the terrain overlay setting could not be written", err);
  }
  refresh();
}

function reset() {
  layer = null;
}

/** Where the overlay is drawn: with the other system layers on the interface group, below the tokens' rings. */
function ensureLayer() {
  if (layer && !layer.destroyed) return layer;
  const parent = canvas.interface ?? canvas.tokens;
  const existing = parent.children.find(c => (c.name === LAYER_NAME) && !c.destroyed);
  if (existing) {
    for (const child of existing.removeChildren()) child.destroy({ children: true });
    layer = existing;
    return layer;
  }
  layer = new PIXI.Container();
  layer.name = LAYER_NAME;
  layer.eventMode = "none";
  // Beneath the auras when they are there, so a ring reads over the ground.
  const auras = parent.children.find(c => c.name === "starwrought.auras");
  if (auras) parent.addChildAt(layer, parent.getChildIndex(auras));
  else parent.addChildAt(layer, 0);
  return layer;
}

/** Redraw the overlay from the viewed scene's regions. */
export function refresh() {
  if (!canvas?.ready || !canvas.scene) return;
  const target = ensureLayer();
  for (const child of target.removeChildren()) child.destroy({ children: true });
  if (!terrainShown()) return;
  const gm = !!game.user?.isGM;
  for (const region of canvas.scene.regions) {
    const kinds = terrainOf(region);
    if (!kinds.length) continue;
    if (region.hidden && !gm) continue;
    const g = new PIXI.Graphics();
    const colour = Number(`0x${(SW.TERRAIN_KINDS[kinds[0].kind]?.colour ?? "#8a6fb0").slice(1)}`);
    g.lineStyle({ width: 2, color: colour, alpha: region.hidden ? 0.5 : 0.9, alignment: 0 });
    g.beginFill(colour, region.hidden ? 0.12 : 0.22);
    try {
      region.polygonTree.drawShape(g);
    } catch (err) {
      console.warn("STARWROUGHT | a terrain region could not be drawn", err);
      g.destroy();
      continue;
    }
    g.endFill();
    target.addChild(g);

    const bounds = region.bounds;
    if (!bounds) continue;
    const text = kinds.map(k => game.i18n.format("STARWROUGHT.Terrain.overlayLabel", {
      kind: game.i18n.localize(SW.TERRAIN_KINDS[k.kind]?.label ?? k.kind), difficulty: k.difficulty
    })).join(" · ");
    const style = new PIXI.TextStyle({
      fontFamily: CONFIG.canvasTextStyle?.fontFamily ?? "Signika", fontSize: 18, fill: 0xffffff,
      stroke: 0x000000, strokeThickness: 4, align: "center"
    });
    const label = new PIXI.Text(text, style);
    label.anchor.set(0.5);
    label.position.set(bounds.x + (bounds.width / 2), bounds.y + (bounds.height / 2));
    label.alpha = 0.9;
    target.addChild(label);
  }
}
