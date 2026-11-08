/**
 * The party sheet's On the road tab, with the Downtime panel at its foot (apps/party-sheet.mjs; 0.7.2 and 0.7.5; plan, parts 8 to 10; rulings 101 to 114): the context one tab's templates render,
 * read live off the members and the party at render and computed nowhere else (the plan's risk 2).
 * Plain functions over the party and its members, no `this`: the sheet calls them from
 * `_prepareContext` and the handlers stay with the sheet. Through 0.10.1 these were the sheet's own
 * private methods.
 */

import * as SW from "../../config.mjs";
import { enabledConstellations } from "../../helpers/content.mjs";
import {
  activityHasChoice, activityRoll, activityWarnings, agoText, constellationName,
  downtimeActivities, downtimeHandLine, explorationActivities, initiativeFor, partyTravel,
  resolveMembers, roadRoll, trainUsed, trainedAt, travelActivity, travelUnits, travelWord
} from "../../helpers/party.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);

/**
 * The road (0.7.2; plan, parts 8 and 9; rulings 101, 102 and 105 to 107): the party's Travel
 * Speed line from `partyTravel`, the terrain, and one row per member with the Activity, its
 * Travel word, the Constellation the pick implies for Initiative, Investigate's Constellation,
 * the warnings, the Roll when the Activity rolls now, and the member's Combatant state while a
 * Combat holds them. Every Activity is read from the Actions pack's Exploration Mode folder
 * (`explorationActivities`), never from a table here (plan, risk 9). A row is live for the
 * member's owner and the GM: the GM's selects are written through `_onChangeForm`, an owner's
 * anchors open the picker dialog. A Fatigued member's row is locked to Travel with the reason
 * (ruling 101), for the GM as for the player, since `setActivity` refuses either.
 * @param {Actor} party
 * @returns {Promise<object>}
 */
export async function prepareRoad(party) {
  const isGM = game.user.isGM;
  const activities = await explorationActivities();
  const travelItem = travelActivity(activities);
  const travel = partyTravel(party, activities);
  // Travel first in every list, since it is the default and the one "" stands for.
  const ordered = travelItem ? [travelItem, ...activities.filter(a => a !== travelItem)] : [...activities];
  const valueOf = item => (item && travelItem && (item === travelItem)) ? "" : (item?.id ?? "");

  const rows = travel.members.map(member => {
    const { actor, item, locked, lockedReason } = member;
    const owner = actor.testUserPermission(game.user, "OWNER");
    const live = owner || isGM;
    const pick = String(actor.system.exploration?.constellation ?? "").trim();
    const needsConstellation = !locked && activityHasChoice(item);
    const init = initiativeFor(actor, item);
    const roll = (live && !locked) ? activityRoll(actor, item) : null;
    // The roll remembered on the road (ruling 108), for everyone who can see the row: it is the
    // character's and public (ruling 110), so it is not gated on `live` as the Roll button is.
    const remembered = roadRoll(actor, item);
    const combatant = actor.combatant;
    const rolled = !!combatant && (combatant.initiative !== null) && (combatant.initiative !== undefined);
    const flagged = combatant ? constellationName(actor, combatant.initiativeConstellation) : "";
    const options = needsConstellation ? constellationOptions(actor, pick) : [];
    return {
      uuid: actor.uuid,
      id: actor.id,
      name: actor.name,
      img: actor.img,
      owner,
      live,
      locked,
      lockedReason,
      fatigued: member.fatigued,
      activity: {
        id: valueOf(item),
        name: item?.name ?? L("STARWROUGHT.Travel.noActivities"),
        speed: travelWord(item),
        effectiveSpeed: member.speed,
        waiting: (locked && member.stored && (member.stored !== item)) ? member.stored.name : ""
      },
      options: ordered.map(a => ({ id: valueOf(a), name: a.name, speed: travelWord(a), selected: a === item })),
      needsConstellation,
      constellation: needsConstellation ? {
        slug: pick,
        name: pick ? constellationName(actor, pick) : "",
        trained: options.filter(o => o.trained),
        untrained: options.filter(o => !o.trained),
        hint: F("STARWROUGHT.Travel.constellationHint", { name: actor.name, activity: item?.name ?? "" })
      } : null,
      initiative: {
        slug: init.slug,
        name: init.name,
        fallback: init.fallback,
        hint: init.fallback ? L("STARWROUGHT.Travel.initiativeFallbackHint") : L("STARWROUGHT.Travel.initiativeTagHint")
      },
      roll: roll ? {
        ...roll,
        label: F("STARWROUGHT.Travel.rollNow", { name: roll.name }),
        hint: F("STARWROUGHT.Travel.rollNowHint", { name: roll.name, member: actor.name })
      } : null,
      // The chip after the Initiative tag: "Stealth 17", the die and when on hover, and whether
      // it stands as the Initiative roll when the encounter begins (ruling 109) or Initiative
      // rolls another Constellation.
      remembered: remembered ? {
        name: remembered.name,
        total: remembered.total,
        natural: remembered.natural,
        ago: remembered.ago,
        usable: remembered.usable,
        hint: F(remembered.usable ? "STARWROUGHT.Travel.rolledHint" : "STARWROUGHT.Travel.rolledHintUnusable", {
          name: actor.name, constellation: remembered.name, total: remembered.total,
          natural: remembered.natural ?? "?", ago: remembered.ago, initiative: init.name
        })
      } : null,
      warnings: activityWarnings(actor, item),
      combatant: combatant ? {
        rolled,
        value: rolled ? combatant.initiative : null,
        constellation: flagged,
        hint: rolled
          ? F("STARWROUGHT.Travel.combatRolledHint", { name: actor.name })
          : F("STARWROUGHT.Travel.combatReadyHint", { name: actor.name, constellation: flagged })
      } : null
    };
  });

  const pace = travel.pacesetter;
  const terrainOptions = Object.entries(SW.TERRAIN ?? {})
    .map(([key, t]) => ({ key, label: L(t.label), selected: key === travel.terrain }));
  const canBegin = isGM && !!canvas?.scene;
  return {
    rows,
    hasActivities: activities.length > 0,
    travel: {
      feet: travel.feetPerMinute,
      mph: travel.milesPerHour,
      mpd: travel.milesPerDay,
      ...travelUnits(travel),
      pacesetter: pace
        ? F("STARWROUGHT.Travel.pacesetter", { name: pace.actor.name, activity: pace.item?.name ?? "", speed: travelWord(pace.item) })
        : L("STARWROUGHT.Travel.noSpeed"),
      terrain: travel.terrain,
      terrainLabel: L(SW.TERRAIN?.[travel.terrain]?.label ?? "STARWROUGHT.Travel.terrainNormal"),
      terrainOptions,
      difficult: travel.terrain !== "normal",
      searching: travel.searching
    },
    canBegin,
    beginTip: canBegin
      ? F("STARWROUGHT.Travel.beginEncounterHint", { scene: canvas.scene.name })
      : L("STARWROUGHT.Travel.beginNoScene"),
    // The Downtime panel at the foot of the part (0.7.5; plan, part 10).
    downtime: await prepareDowntime(party)
  };
}

/**
 * The Downtime panel (0.7.5; plan, part 10; rulings 112 to 114), at the foot of the road part:
 * the days the GM has given (the party's own field, typed by the GM and read by the players,
 * counted by nothing), the Downtime Activities from the Actions pack's Downtime Mode folder with
 * the duration the Item's Requirements carry and its description enriched (a GM's world rewrite
 * may carry links), Retrain's and Provision's hand lines, and one strip entry per member with
 * the Train control for the owner or the GM and the once-between-Milestones warning for
 * everyone, since the record is a flag on the character that every reader of it can see. The
 * road part redraws on the member's `updateActor`, and the flag write is one, so the amber mark
 * appears as the Flare card lands and goes as the next Milestone card does. Nothing here is
 * member-dependent arithmetic on the party (plan, risk 2): every number is read off the member.
 * @param {Actor} party
 * @returns {Promise<object>}
 */
export async function prepareDowntime(party) {
  const isGM = game.user.isGM;
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  const activities = [];
  for (const item of await downtimeActivities()) {
    activities.push({
      id: item.id,
      slug: SW.slugify(item.name),
      name: item.name,
      // The Duration column of data/endeavors.xlsx (0.20.0); `requirements` held it through 0.19.0.
      duration: String(item.system.duration || item.system.requirements || "").trim(),
      // The sheet's Effect is the rules and the Description the flavour line (0.20.0); a row with
      // no flavour prints its Effect, as the chat card does (chatDescription).
      description: await TextEditor.enrichHTML(String(item.system.description || item.system.effect || ""), { relativeTo: item }),
      byHand: downtimeHandLine(item)
    });
  }
  const of = SW.MILESTONES_PER_LEVEL;
  const members = resolveMembers(party).filter(m => m.actor).map(({ uuid, actor }) => {
    const owner = actor.testUserPermission(game.user, "OWNER");
    const used = trainUsed(actor);
    const at = used ? trainedAt(actor) : null;
    const ago = at ? agoText(at.time) : "";
    const usedHint = used
      ? F("STARWROUGHT.Travel.trainUsedHint", {
        name: actor.name, level: at.level, milestone: at.milestone, of,
        when: ago ? F("STARWROUGHT.Travel.trainedWhen", { ago }) : ""
      })
      : "";
    return {
      uuid,
      id: actor.id,
      name: actor.name,
      img: actor.img,
      owner,
      live: owner || isGM,
      used,
      usedHint,
      // The anchor's tooltip: the warning while it stands, what Train does otherwise.
      trainHint: used ? usedHint : F("STARWROUGHT.Travel.trainHint", { name: actor.name })
    };
  });
  return {
    days: Math.max(0, Number(party.system.downtime?.days) || 0),
    activities,
    hasActivities: activities.length > 0,
    members,
    anyLive: members.some(m => m.live)
  };
}

/**
 * The Constellations a member may Investigate with, as the Relevant Check picker offers them:
 * the ones they have opened first (every entry of `system.constellations` but the Lore
 * template, their Lores included), then every Constellation that ships (`enabledConstellations`,
 * ruling 61) that they have not, Untrained being a real answer at +0. Each with its rank, and
 * marked when it is the member's pick.
 * @param {Actor} actor
 * @param {string} pick  The slug stored on the character.
 * @returns {Array<{slug: string, name: string, rank: string, rankLabel: string, trained: boolean, selected: boolean}>}
 */
export function constellationOptions(actor, pick) {
  const rows = new Map();
  for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
    if (slug === "lore") continue;
    rows.set(slug, { slug, name: entry.name, rank: entry.rank ?? "untrained" });
  }
  for (const meta of enabledConstellations()) {
    if (!meta.slug || (meta.slug === "lore") || rows.has(meta.slug)) continue;
    rows.set(meta.slug, { slug: meta.slug, name: meta.name, rank: "untrained" });
  }
  const order = SW.RANK_ORDER;
  return [...rows.values()]
    .sort((a, b) => (order.indexOf(b.rank) - order.indexOf(a.rank)) || a.name.localeCompare(b.name))
    .map(r => ({
      ...r,
      rankLabel: L(SW.RANKS[r.rank]?.label ?? SW.RANKS.untrained.label),
      trained: r.rank !== "untrained",
      selected: r.slug === pick
    }));
}
