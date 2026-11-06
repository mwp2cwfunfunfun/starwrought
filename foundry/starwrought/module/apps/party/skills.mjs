/**
 * The party sheet's Skills grid (apps/party-sheet.mjs; 0.7.0; plan, part 4; ruling 95): the context one tab's templates render,
 * read live off the members and the party at render and computed nowhere else (the plan's risk 2).
 * Plain functions over the party and its members, no `this`: the sheet calls them from
 * `_prepareContext` and the handlers stay with the sheet. Through 0.10.1 these were the sheet's own
 * private methods.
 */

import * as SW from "../../config.mjs";
import { SwCheck } from "../../dice/check.mjs";
import { enabledConstellations } from "../../helpers/content.mjs";
import { constellationName } from "../../helpers/party.mjs";

const L = key => game.i18n.localize(key);
const F = (key, data) => game.i18n.format(key, data);
const signed = value => {
  const n = Number(value) || 0;
  return `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
};

/**
 * The Skills grid (plan, part 4): Constellations as rows, members as columns, because the
 * question is "who has Stealth". The four Defenses show the Threshold, since that is what a
 * Sneak, a Feint or a Lie is measured against (ruling 95: players see them too); an Initiative
 * row, live only while a Combat holds the member; the Skill Constellations that ship, the Lore
 * template left out, plus any a member has opened that has since been switched off; Melee and
 * Ranged with rank and Proficiency and the inherited pool on hover; and one row per Lore any
 * member has opened. A Skill cell is `SwCheck.previewTotal`, so Stealth carries Load Strain and
 * a Frightened member's cells carry the penalty; the best in each row is marked, ties all; a
 * cell is live only on a member the user owns.
 * @param {Actor[]} actors
 * @returns {object}
 */
export function prepareGrid(actors) {
  const columns = actors.map(a => ({
    uuid: a.uuid, id: a.id, name: a.name, img: a.img,
    live: a.testUserPermission(game.user, "OWNER")
  }));
  const live = new Map(columns.map(c => [c.uuid, c.live]));
  const rankLabel = rank => L(SW.RANKS[rank]?.label ?? SW.RANKS.untrained.label);

  // Mark the best value in a row, ties all; blank cells never compete.
  const mark = cells => {
    const values = cells.filter(c => !c.blank && Number.isFinite(c.value)).map(c => c.value);
    if (!values.length) return cells;
    const best = Math.max(...values);
    for (const cell of cells) cell.best = !cell.blank && (cell.value === best);
    return cells;
  };
  const base = (actor, extra) => ({ uuid: actor.uuid, live: live.get(actor.uuid) ?? false, blank: false, best: false, ...extra });

  const groups = [];

  // The four Defenses: the Threshold, with the modifier and rank on hover.
  groups.push({
    key: "defenses",
    label: L("STARWROUGHT.Category.defense"),
    rows: Object.entries(SW.DEFENSES).map(([key, def]) => {
      const cells = actors.map(actor => {
        const d = actor.system.defenses?.[key];
        const rank = d?.rank ?? "untrained";
        const threshold = Number(d?.threshold) || 10;
        return base(actor, {
          kind: "defense", key,
          value: threshold, display: String(threshold),
          rank, rankAbbr: SW.RANKS[rank]?.abbr ?? "U", untrained: rank === "untrained",
          tooltip: F("STARWROUGHT.Party.defenseCellTip", {
            defense: L(def.label), threshold, mod: signed(d?.mod ?? 0), rank: rankLabel(rank)
          })
        });
      });
      const attribute = SW.DEFENSES[key].attribute;
      return {
        key: `defense-${key}`, kind: "defense", defenseKey: key, slug: def.slug, label: L(def.label), hint: L(def.hint),
        attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells), askable: true
      };
    })
  });

  // Initiative: the modifier, live only while a Combat holds the member, and since 0.7.2 the
  // Constellation the Combatant is flagged to roll (Begin the encounter's, ruling 105; Awareness
  // when nothing flagged it) named on hover, since the cell rolls that and not Awareness.
  const initiativeCells = actors.map(actor => {
    const combatant = actor.combatant;
    const inCombat = !!combatant;
    // Out of an encounter the cell shows the default (Awareness) modifier the model derives. In
    // one it shows the number the cell will actually roll: the flagged Constellation's terms and
    // the Scouts' bonus, through the same assembly the roll uses, so a Combatant flagged Stealth
    // at +0 never reads "+2" (live test, 0.7.2).
    const mod = inCombat
      ? SwCheck.previewTotal(actor, {
        kind: "initiative", slug: combatant.initiativeConstellation, modifiers: combatant.initiativeModifiers ?? []
      })
      : (Number(actor.system.initiative?.mod) || 0);
    const tooltip = inCombat
      ? `${F("STARWROUGHT.Party.initiativeLiveTip", { mod: signed(mod) })} ${F("STARWROUGHT.Travel.gridInitiativeTip", {
        constellation: constellationName(actor, combatant.initiativeConstellation)
      })}`
      : F("STARWROUGHT.Party.initiativeNotInCombat", { mod: signed(mod) });
    return base(actor, {
      kind: "initiative",
      value: mod, display: signed(mod),
      rank: null, rankAbbr: "", untrained: false,
      live: inCombat && (live.get(actor.uuid) ?? false),
      tooltip
    });
  });
  groups[0].rows.push({
    key: "initiative", kind: "initiative", label: L("STARWROUGHT.Field.initiative"),
    hint: L("STARWROUGHT.Party.initiativeHint"), attribute: "", glyph: "", cells: mark(initiativeCells), askable: false
  });

  // A Skill cell: the preview total, rank letter, Threshold in the tooltip.
  const checkCell = (actor, slug, name) => {
    const prof = actor.system.proficiency(slug);
    const mod = SwCheck.previewTotal(actor, { kind: "check", slug });
    return base(actor, {
      kind: "check", slug,
      value: mod, display: signed(mod),
      rank: prof.rank, rankAbbr: SW.RANKS[prof.rank]?.abbr ?? "U", untrained: prof.rank === "untrained",
      tooltip: F("STARWROUGHT.Party.checkCellTip", { name, mod: signed(mod), rank: rankLabel(prof.rank), threshold: 10 + mod })
    });
  };
  const skillRow = (slug, name, attribute) => ({
    key: `skill-${slug}`, kind: "check", slug, label: name, hint: "",
    attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "",
    cells: mark(actors.map(actor => checkCell(actor, slug, name))), askable: true
  });

  // The Skill Constellations that ship, the Lore template excluded, and any skill a member has
  // opened that the spreadsheets have since switched off (as the Relevant Check picker lists it).
  const skills = new Map();
  for (const meta of enabledConstellations()) {
    if (!meta.slug || (meta.category !== "skill") || SW.isLoreSlug(meta.slug)) continue;
    skills.set(meta.slug, { name: meta.name, attribute: meta.attribute });
  }
  for (const actor of actors) {
    for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
      if (skills.has(slug) || (entry.category !== "skill") || SW.isLoreSlug(slug)) continue;
      skills.set(slug, { name: entry.name, attribute: entry.attribute });
    }
  }
  groups.push({
    key: "skills",
    label: L("STARWROUGHT.Category.skill"),
    rows: [...skills.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([slug, meta]) => skillRow(slug, meta.name, meta.attribute))
  });

  // Melee and Ranged: rank and Proficiency, the pool and what is inherited on hover.
  const weaponRow = (slug, key, fallbackAttribute) => {
    const name = L(`STARWROUGHT.Field.${key}`);
    const cells = actors.map(actor => {
      const training = actor.system[key] ?? { rank: "untrained", proficiency: 0, points: 0, pool: 0 };
      const con = actor.system.constellations?.[slug];
      const rank = training.rank ?? "untrained";
      return base(actor, {
        kind: "check", slug,
        value: Number(training.proficiency) || 0, display: signed(training.proficiency),
        rank, rankAbbr: SW.RANKS[rank]?.abbr ?? "U", untrained: rank === "untrained",
        tooltip: F("STARWROUGHT.Party.weaponCellTip", {
          name, rank: rankLabel(rank), mod: signed(training.proficiency),
          pool: Number(con?.pool ?? training.pool) || 0, inherited: Number(con?.inherited) || 0
        })
      });
    });
    const attribute = actors[0]?.system.constellations?.[slug]?.attribute ?? SW.constellations[slug]?.attribute ?? fallbackAttribute;
    return {
      key: `weapon-${slug}`, kind: "check", slug, label: name, hint: L(`STARWROUGHT.Field.${key}Hint`),
      attribute, glyph: SW.ATTRIBUTES[attribute]?.glyph ?? "", cells: mark(cells), askable: true
    };
  };
  groups.push({
    key: "weapons",
    label: L("STARWROUGHT.Category.weapon"),
    rows: [weaponRow(SW.MELEE_SLUG, "melee", "might"), weaponRow(SW.RANGED_SLUG, "ranged", "agility")]
  });

  // One row per Lore any member has opened; a member without it shows a blank. A Lore left
  // unnamed from before 0.18.0 prints its Item's name, "Lore (unnamed)" since the 0.18.1 migration,
  // as the character's own tab does.
  const lores = new Map();
  for (const actor of actors) {
    for (const [slug, entry] of Object.entries(actor.system.constellations ?? {})) {
      if (!SW.isLoreSlug(slug) || lores.has(slug)) continue;
      lores.set(slug, { name: entry.name, attribute: entry.attribute });
    }
  }
  if (lores.size) {
    groups.push({
      key: "lore",
      label: L("STARWROUGHT.Category.lore"),
      rows: [...lores.entries()]
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([slug, meta]) => ({
          key: `lore-${slug}`, kind: "check", slug, label: meta.name, hint: "", askable: true,
          attribute: meta.attribute, glyph: SW.ATTRIBUTES[meta.attribute]?.glyph ?? "",
          cells: mark(actors.map(actor => (actor.system.constellations?.[slug]
            ? checkCell(actor, slug, meta.name)
            : base(actor, { kind: "check", slug, blank: true, live: false, value: null, display: "", rank: null, rankAbbr: "", untrained: true, tooltip: "" }))))
        }))
    });
  }

  return { columns, groups, span: columns.length + 1 };
}
